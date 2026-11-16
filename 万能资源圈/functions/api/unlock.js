/**
 * POST /api/unlock   公开接口：资源码验证 + 专属内容解锁（R92 一机一码·宽松模式）
 * body: { productId, variantId, code }
 *
 * 设计（与 R90 方案一致）：
 *   码 = 入场券，只管"第一次"——验证资源码成功后把当前设备绑定到该类型；
 *   绑定 = 通行证，管"以后每一次"——已绑定的设备不再验码，直接返回专属内容。
 *   宽松模式：管理员改码只废旧码的入场资格，已绑定设备不受影响、照常解锁。
 *
 * R221（老板 15:44 拍板·复制即换码 + 60 天兑换窗口）：
 *   验码不再只对"当前码"，改为查该类型 60 天窗口内的发码记录（code_issues）；
 *   后台点「复制」= 发码：旧码入 issued 记录（窗口从点复制时刻起算）+ 面板立即出新码；
 *   R96 绑满自动换码退役——换码只由后台复制触发，绑定上限（bind_limit）保留，限制单个码可绑设备数；
 *   60 天是兑换窗口：窗口内的码可兑换、绑定后设备永久可用；超 60 天的码兑换被拒（明确文案）；
 *   升级迁移：库里还没有发码记录的类型按旧机制比对当前码，命中即顺手补一条 issued 记录
 *   （老客户手里已发的码照常可兑换，issued_at 取首次兑换时刻，窗口起点只晚不早于上线时刻）。
 *
 * 设备凭据：HttpOnly Cookie wnzyq_device（服务端随机 32 字节 hex，首次访问时种下，
 * JS 不可见、不被 XSS 读取，与登录会话 wnzyq_token 同一套思路）。
 *
 * 响应：
 *   { ok: true, content, bound }        解锁成功（bound=本次是否新绑定）
 *   { ok: false, need_code: true }      有码且未绑定、请求未携带码（前台显示输入框）
 *   { ok: false, msg: '...' }           验证失败 / 超上限 / 资源不存在等
 *
 * 统计：resource_unlock 埋点仍由前台在内容渲染成功后统一上报（口径不变），本接口不写 stats。
 */
import { corsHeaders, ensureBindingsTable, ensureCodeIssuesTable, ensureSoftDelete, ensureVariantColumns, getCookie, getSetting, json, randomToken, readJSON } from '../_utils.js';

// 设备 Cookie 名与有效期（10 年，等效永久设备标识）
const DEVICE_COOKIE = 'wnzyq_device';

/* v439 #98：资源码爆破防护——同设备连续输错 10 次 → 锁 15 分钟（输对立即清零；内存口径，重启清零可接受） */
const __wrongStreak = new Map();
function wrongGuard(device) {
  const k = device || 'anon';
  const rec = __wrongStreak.get(k);
  if (rec && rec.lockedUntil > Date.now()) return Math.ceil((rec.lockedUntil - Date.now()) / 60000);
  return 0;
}
function wrongHit(device) {
  const k = device || 'anon';
  const rec = __wrongStreak.get(k) || { n: 0, lockedUntil: 0 };
  rec.n += 1;
  if (rec.n >= 10) { rec.lockedUntil = Date.now() + 15 * 60000; rec.n = 0; }
  __wrongStreak.set(k, rec);
}
function wrongClear(device) { __wrongStreak.delete(device || 'anon'); }

export async function onRequestPost(context) {
  const { request, env } = context;

  await ensureSoftDelete(env); /* v440：先迁移软删列（线上旧库无此列，缺它接口 500） */  /* v440 复检加固：IP 级解锁限流——#98 的错码计数按设备 Cookie 记账，换 Cookie 即绕过；
     此处按 IP 兜底 30 次/分（正常访客充裕，脚本爆破被压平） */
  try {
    const { rateLimit } = await import('../_utils.js');
    if (!rateLimit(request, 'unlock', 30)) return json({ ok: false, msg: '操作太频繁，请稍后再试' }, 429);
  } catch (e0) { /* 限流失败不拦正常访问 */ }
  const b = await readJSON(request);
  const productId = Number(b.productId) || 0;
  const variantId = Number(b.variantId) || 0;
  const code = String(b.code || '').trim();
  if (!productId || !variantId) {
    return json({ ok: false, msg: '参数错误' }, 400);
  }

  /* v439 #98：爆破防护——锁定中直接拒绝 */
  const __device = getCookie(request, DEVICE_COOKIE);
  const __lockMin = wrongGuard(__device);
  if (__lockMin > 0) {
    return json({ ok: false, msg: '尝试次数过多，请 ' + __lockMin + ' 分钟后再试' }, 429);
  }

  await ensureBindingsTable(env);
  // R106：确保 product_variants 有 bind_limit 列（老库自动补列；前台链路原本不走列确保）
  await ensureVariantColumns(env);

  // 1. 查类型 + 校验资源在线显示（下架/隐藏的类型不可解锁）
  //    R106 防御：极端情况下列补齐失败（如库只读）会令带 bind_limit 的查询报"无此列"——
  //    降级为去掉该列重查一次（上限按全局设置兜底），不再 500
  let v = null;
  try {
    v = await env.DB.prepare(
      `SELECT v.id, v.product_id, v.resource_code, v.resource_content, v.bind_limit,
              p.is_online, p.is_hidden
       FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE v.id = ? AND v.product_id = ? AND p.deleted_at IS NULL` /* v440：软删（回收站中）资源的码不可解锁 */
    ).bind(variantId, productId).first();
  } catch (e) {
    console.error('R106 类型查询失败（无 bind_limit 降级重查）:', e && e.message);
    v = await env.DB.prepare(
      `SELECT v.id, v.product_id, v.resource_code, v.resource_content,
              p.is_online, p.is_hidden
       FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE v.id = ? AND v.product_id = ? AND p.deleted_at IS NULL` /* v440：软删（回收站中）资源的码不可解锁 */
    ).bind(variantId, productId).first();
  }
  if (!v || !v.is_online || v.is_hidden) {
    return json({ ok: false, msg: '资源不存在或已下架' }, 404);
  }

  const hasCode = !!(v.resource_code && String(v.resource_code).trim());
  const content = String(v.resource_content || '');

  // 2. 设备凭据：读 Cookie，没有则生成并种下（本次请求即生效）
  let extraHeaders = {};
  let device = '';
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const kv = part.trim().split('=');
    if (kv[0] === DEVICE_COOKIE) device = decodeURIComponent(kv.slice(1).join('=') || '');
  }
  if (!device) {
    device = randomToken();
    extraHeaders['Set-Cookie'] = DEVICE_COOKIE + '=' + device + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=315360000';
  }

  // 3. 无码类型：内容直接返回（前台"立即获取"键场景）
  if (!hasCode) {
    if (!content.trim()) return json({ ok: false, msg: '该资源未设置专属内容' }, 400);
    wrongClear(getCookie(request, DEVICE_COOKIE)); /* v439 #98 */
    return json({ ok: true, content, bound: false }, 200, extraHeaders);
  }

  // 4. 有码：先查通行证——已绑定设备直接放行（宽松模式，不验码、换码不影响）
  // R106：绑定表查询防御——表异常时按"未绑定"继续验码，不再直接 500
  // R243 条3：通行证查询 + last_access 更新合并为一次往返——原先 SELECT 查通行证、命中后再发一条
  // UPDATE 刷 last_access（两次串行往返）；改为直接 UPDATE（unique index 保证 changes ∈ {0,1}），
  // meta.changes==1 即通行证存在且顺手刷了 last_access（供后台绑定清单展示），0 = 未绑定照常验码。
  // 已绑定路径串行往返 3 → 2（variant 查询 + 本条 UPDATE）。
  // v633：又改回「先 SELECT 再按需补写」——R243 那次的 UPDATE 是每次访问都写一行，
  // 写额度比读额度紧 50 倍，老客户反复看资源全耗在这。现在命中只读 1 行、6 小时内不重复写。
  /* v633：把「UPDATE 兼作查询」改成「SELECT 判定 + 必要时后台补写」。
     原写法每次已绑定设备看资源都要 UPDATE 一行——写额度是免费套餐里最紧的一项
     （10 万行/天，读是 500 万行/天，差 50 倍），老客户反复打开资源时全耗在刷「最近访问」上。
     现在：命中只读 1 行（有唯一索引，读 1 行），last_access 超过 6 小时才异步补写一次，
     后台「最近访问」的展示精度几乎不变，写次数降一个量级。 */
  let boundHit = false;
  try {
    const row = await env.DB.prepare(
      'SELECT id, last_access FROM resource_bindings WHERE variant_id = ? AND device_token = ? LIMIT 1'
    ).bind(variantId, device).first();
    boundHit = !!row;
    if (row) {
      let stale = true;
      if (row.last_access) {
        const t = new Date(String(row.last_access).replace(' ', 'T') + 'Z').getTime();
        if (!isNaN(t)) stale = (Date.now() - t) > 6 * 3600 * 1000;
      }
      if (stale) {
        const job = env.DB.prepare("UPDATE resource_bindings SET last_access = datetime('now') WHERE id = ?")
          .bind(row.id).run().catch(function () {});
        if (context.waitUntil) context.waitUntil(job);
      }
    }
  } catch (e) { console.error('R106 通行证查询失败（按未绑定降级）:', e && e.message); }
  if (boundHit) {
    wrongClear(getCookie(request, DEVICE_COOKIE)); /* v439 #98 */
    return json({ ok: true, content, bound: true }, 200, extraHeaders);
  }

  // 5. 未绑定：验码（不区分大小写，沿用前台既有验证口径）
  if (!code) {
    return json({ ok: false, need_code: true }, 200, extraHeaders);
  }

  // R221：验码改为查该类型 60 天窗口内的发码记录（不再只对当前码）
  await ensureCodeIssuesTable(env);
  const codeLower = code.toLowerCase();
  let issue = null;
  /* R243 条3：发码记录查询 + 60 天兑换窗口 + 绑定计数合并为一次往返——原先三条串行
     SELECT（issue 记录、窗口判定、COUNT 绑定数）；改为单条多子查询 SELECT 一次带回
     （in_window / bind_cnt 由子查询算出），未绑定验码路径串行往返 7 → 5 */
  try {
    issue = await env.DB.prepare(
      `SELECT ci.id, ci.code, ci.status, ci.issued_at,
              (ci.issued_at >= datetime('now','-60 days')) AS in_window,
              (SELECT COUNT(*) FROM resource_bindings rb WHERE rb.variant_id = ci.variant_id AND rb.code = ci.code) AS bind_cnt
       FROM code_issues ci
       WHERE ci.variant_id = ? AND LOWER(ci.code) = ?
       ORDER BY ci.id DESC LIMIT 1`
    ).bind(variantId, codeLower).first();
  } catch (e) { console.error('R221 发码记录查询失败（按旧机制降级）:', e && e.message); }

  if (!issue) {
    // R221 迁移回退：库里还没有该码的发码记录——按旧机制比对当前 resource_code
    // （升级前发出去的码 / 管理员手动改的码），命中即顺手补一条 issued 记录再走新链路
    if (codeLower === String(v.resource_code).trim().toLowerCase()) {
      try {
        await env.DB.prepare('INSERT INTO code_issues (variant_id, product_id, code) VALUES (?, ?, ?)')
          .bind(variantId, productId, String(v.resource_code).trim()).run();
        issue = await env.DB.prepare(
          `SELECT ci.id, ci.code, ci.status, ci.issued_at,
                  (ci.issued_at >= datetime('now','-60 days')) AS in_window,
                  (SELECT COUNT(*) FROM resource_bindings rb WHERE rb.variant_id = ci.variant_id AND rb.code = ci.code) AS bind_cnt
           FROM code_issues ci
           WHERE ci.variant_id = ? AND LOWER(ci.code) = ?
           ORDER BY ci.id DESC LIMIT 1`
        ).bind(variantId, codeLower).first();
      } catch (e) { console.error('R221 迁移发码记录写入失败：', e && e.message); }
    }
    if (!issue) {
      wrongHit(getCookie(request, DEVICE_COOKIE)); /* v439 #98：错码计数 */
      return json({ ok: false, msg: '资源码错误，请重试' }, 200, extraHeaders);
    }
  }

  // R221：60 天兑换窗口——发放超过 60 天的码不再允许新设备兑换（明确文案）；
  // 已绑定设备走上方通行证路径不受影响（绑定 = 永久，跨 60 天照常解锁）
  // R243 条3：窗口判定改读合并 SELECT 带回的 in_window（不再单独发窗口查询）
  if (!issue.in_window) {
    return json({ ok: false, msg: '资源码已过期，请联系客服' }, 200, extraHeaders);
  }

  // 6. 码正确：检查该码的绑定上限（R221 按"每个码"计数；后台可调，默认 1 台）
  // R106：绑定设备上限挪进类型编辑表单——类型自身设置优先，未设置再按全局设置（默认 1）
  const vLimit = parseInt(v.bind_limit, 10);
  const limit = vLimit >= 1 ? vLimit : Math.max(1, parseInt(await getSetting(env, 'resource_bind_limit', '1'), 10) || 1);
  const bindCode = String(issue.code);
  /* R243 条3：绑定计数改读合并 SELECT 带回的 bind_cnt 子查询（不再单独发 COUNT 往返），
     未绑定验码路径串行往返 7 → 5 的最后一处合并 */
  const cnt = issue.bind_cnt;
  if (cnt && cnt >= limit) {
    /* v642（QA 回归）同一设备并发被误判「已满」——第 4 步的通行证查询可能早于另一条同设备请求的
       INSERT 提交（那一刻还查不到），而 bind_cnt 是在此之后读的快照（已经算进了那条刚落库的绑定），
       于是一台已绑定的设备被当成新设备，在这里就被拒了，压根走不到第 7 步的幂等复核。
       所以拒绝之前先确认「本设备是否已经在绑定表里」：在，就是同一台设备连点，按通行证放行。 */
    let _mine0 = 0;
    try {
      const _m = await env.DB.prepare(
        'SELECT 1 AS one FROM resource_bindings WHERE variant_id = ? AND device_token = ? LIMIT 1'
      ).bind(variantId, device).first();
      _mine0 = _m ? 1 : 0;
    } catch (e) { _mine0 = 0; /* 查询失败按未绑定处理，保持原有「满就拒」语义 */ }
    if (_mine0 > 0) {
      wrongClear(getCookie(request, DEVICE_COOKIE)); /* v439 #98：与第 4 步通行证命中保持一致 */
      return json({ ok: true, content, bound: true }, 200, extraHeaders);
    }
    // R221：绑满不再自动换码（换码只由后台复制触发），本次仍拒绝
    return json({ ok: false, msg: '该码绑定设备已满（上限 ' + limit + ' 台），请联系客服。注意：换浏览器、无痕模式、清除缓存都会被识别为新设备' }, 200, extraHeaders);
  }

  // 7. 绑定本设备（记录当时的码）并返回内容
  //    R106 防御：绑定表异常导致写不进去时降级放行（码已验对，只是这台记不上账），不再 500
  // v294（用户 10-04 02:14）：212 并发解锁幂等——同一设备并发请求时，第二个可能撞唯一约束，
  // 此时设备已被第一个请求绑定，应视为绑定成功而非失败
  const ua = (request.headers.get('User-Agent') || '').slice(0, 200);
  let bound = true;
  try {
    /* v641 P0 并发超发修复：上面的 cnt 检查是「读」，本条 INSERT 是「写」，两者之间无原子性——
       多台不同设备同一时刻提交同一个码时会同时读到 cnt=0 全部通过检查，全部 INSERT → 超发。
       改为「条件插入」：把「已绑定数 < 上限」写进 INSERT 的 WHERE 子查询，
       由数据库在同一条语句、同一把写锁内一次性判定，条件不成立就落 0 行。
       参数共 9 个：前 6 个给 INSERT 的列，后 3 个给 WHERE 里的子查询（D1 用位置 ? 重复传值，不用 ?1 ?2 编号参数）。 */
    const _ins = await env.DB.prepare(
      `INSERT INTO resource_bindings (variant_id, product_id, device_token, ua, code, region)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM resource_bindings WHERE variant_id = ? AND code = ?) < ?`
    ).bind(variantId, productId, device, ua, bindCode, (request.cf && request.cf.region) || '', variantId, bindCode, limit).run();

    /* 条件插入没落行 = 被并发挤满（同一设备重复提交会撞唯一约束，走下面 catch，不会走到这里） */
    const _changed = (_ins && _ins.meta && _ins.meta.changes) || 0;
    if (_changed === 0) {
      /* 再确认一次：是满了，还是本设备已经在里面了，还是别的意外。
         注意不能直接按「满」返回——同一台设备并发提交时，第一条已经把行写进去了，
         后两条的 WHERE 子查询会算出「已绑定数 = 上限」而落 0 行，若此时一律报「已满」，
         就把 v294 的幂等语义修坏了（同一设备连点会看到「已满」而不是正常解锁）。
         所以一条查询同时取：该码已绑定总数 c + 本设备是否已在其中 mine。 */
      let _now = 0, _mine = 0;
      try {
        const _c = await env.DB.prepare(
          'SELECT COUNT(*) AS c, SUM(CASE WHEN device_token = ? THEN 1 ELSE 0 END) AS mine FROM resource_bindings WHERE variant_id = ? AND code = ?'
        ).bind(device, variantId, bindCode).first();
        _now = (_c && _c.c) || 0;
        _mine = (_c && _c.mine) || 0;
      } catch (e2) { _now = 0; _mine = 0; }
      if (_mine > 0) {
        bound = true; /* 本设备已在绑定表里（并发重复提交）：幂等成功，不能报「已满」 */
      } else if (_now >= limit) {
        return json({ ok: false, msg: '该码绑定设备已满（上限 ' + limit + ' 台），请联系客服。注意：换浏览器、无痕模式、清除缓存都会被识别为新设备' }, 200, extraHeaders);
      } else {
        bound = false; /* 非预期情况：放行但不记绑定（沿用原来的降级语义） */
      }
    }
  } catch (e) {
    const msg = String(e && e.message || '');
    if (msg.includes('UNIQUE constraint failed')) {
      bound = true; // 已绑定，幂等返回成功
    } else {
      bound = false;
      console.error('R106 绑定记录写入失败（降级放行）:', msg);
    }
  }

  // 8. R221：该发码记录置为已用（bound_at=首次绑定时刻；已 bound 的不重复改）
  if (bound) {
    try {
      await env.DB.prepare(
        "UPDATE code_issues SET status = 'bound', bound_at = COALESCE(bound_at, datetime('now')) WHERE id = ? AND status = 'issued'"
      ).bind(issue.id).run();
    } catch (e) { /* 记录状态更新失败不影响本次解锁 */ }
  }
  return json({ ok: true, content, bound }, 200, extraHeaders);
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request) });
}
