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
import { json, readJSON, corsHeaders, randomToken, ensureBindingsTable, ensureVariantColumns, ensureCodeIssuesTable, getSetting } from '../_utils.js';

// 设备 Cookie 名与有效期（10 年，等效永久设备标识）
const DEVICE_COOKIE = 'wnzyq_device';

export async function onRequestPost(context) {
  const { request, env } = context;
  const b = await readJSON(request);
  const productId = Number(b.productId) || 0;
  const variantId = Number(b.variantId) || 0;
  const code = String(b.code || '').trim();
  if (!productId || !variantId) {
    return json({ ok: false, msg: '参数错误' }, 400);
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
       WHERE v.id = ? AND v.product_id = ?`
    ).bind(variantId, productId).first();
  } catch (e) {
    console.error('R106 类型查询失败（无 bind_limit 降级重查）:', e && e.message);
    v = await env.DB.prepare(
      `SELECT v.id, v.product_id, v.resource_code, v.resource_content,
              p.is_online, p.is_hidden
       FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE v.id = ? AND v.product_id = ?`
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
    return json({ ok: true, content, bound: false }, 200, extraHeaders);
  }

  // 4. 有码：先查通行证——已绑定设备直接放行（宽松模式，不验码、换码不影响）
  // R106：绑定表查询防御——表异常时按"未绑定"继续验码，不再直接 500
  // R243 条3：通行证查询 + last_access 更新合并为一次往返——原先 SELECT 查通行证、命中后再发一条
  // UPDATE 刷 last_access（两次串行往返）；改为直接 UPDATE（unique index 保证 changes ∈ {0,1}），
  // meta.changes==1 即通行证存在且顺手刷了 last_access（供后台绑定清单展示），0 = 未绑定照常验码。
  // 已绑定路径串行往返 3 → 2（variant 查询 + 本条 UPDATE）。
  let boundHit = false;
  try {
    const upd = await env.DB.prepare(
      "UPDATE resource_bindings SET last_access = datetime('now') WHERE variant_id = ? AND device_token = ?"
    ).bind(variantId, device).run();
    boundHit = !!(upd && upd.meta && upd.meta.changes);
  } catch (e) { console.error('R106 通行证查询失败（按未绑定降级）:', e && e.message); }
  if (boundHit) {
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
      } catch (e) { console.error('R221 迁移发码记录写入失败:', e && e.message); }
    }
    if (!issue) {
      return json({ ok: false, msg: '资源码错误，请重试' }, 200, extraHeaders);
    }
  }

  // R221：60 天兑换窗口——发放超过 60 天的码不再允许新设备兑换（明确文案）；
  // 已绑定设备走上方通行证路径不受影响（绑定 = 永久，跨 60 天照常解锁）
  // R243 条3：窗口判定改读合并 SELECT 带回的 in_window（不再单独发窗口查询）
  if (!issue.in_window) {
    return json({ ok: false, msg: '该资源码已超过 60 天有效期，请联系客服获取新码' }, 200, extraHeaders);
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
    // R221：绑满不再自动换码（换码只由后台复制触发），本次仍拒绝
    return json({ ok: false, msg: '该码绑定设备已满（上限 ' + limit + ' 台），请联系客服。注意：换浏览器、无痕模式、清除缓存都会被识别为新设备' }, 200, extraHeaders);
  }

  // 7. 绑定本设备（记录当时的码）并返回内容
  //    R106 防御：绑定表异常导致写不进去时降级放行（码已验对，只是这台记不上账），不再 500
  const ua = (request.headers.get('User-Agent') || '').slice(0, 200);
  let bound = true;
  try {
    await env.DB.prepare(
      'INSERT INTO resource_bindings (variant_id, product_id, device_token, ua, code) VALUES (?, ?, ?, ?, ?)'
    ).bind(variantId, productId, device, ua, bindCode).run();
  } catch (e) {
    bound = false;
    console.error('R106 绑定记录写入失败（降级放行）:', e && e.message);
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
