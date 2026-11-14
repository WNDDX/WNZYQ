/**
 * POST /api/track
 * 前台埋点（公开接口）：记录资源浏览 / 点击咨询客服
 * body: { product_id: 1, type: 'view' | 'contact' | 'resource_unlock' }
 * 前台用"发了就不管"方式调用，失败不影响页面
 *
 * R168（用户定稿）：统计口径三项——
 * ① 总浏览去水：view 埋点按「同一设备（IP）+ 同一资源」1 小时窗口去重，窗口内重复打开只记一次；
 * ② 管理员自己浏览前台不计入：带管理员会话 Cookie 的请求一律不记（后台看数据不污染前台统计）；
 * ③ 时区统一北京时间：聚合口径见 admin/stats.js（存储仍为 UTC，展示/切日一律 +8 小时）。
 *
 * R169（用户定稿）：①的去重口径同步到全部埋点类型——view / contact / resource_unlock
 * 统一按「同一设备（IP）+ 同一资源 + 同一类型」1 小时窗口去重（同一设备同一点击 1 小时内只算一次）。
 */
import { json, readJSON, getCookie, getAuthAdmin, rateLimit } from '../_utils.js';

// 允许的埋点类型白名单：不认识的类型一律按 'view' 记录
const VALID_TRACK_TYPES = ['view', 'contact', 'resource_unlock', 'ann_read']; /* v439 #118：公告阅读 */
/* v633：每日清理任务的进程内节流时间戳（见下方 __cleanupJob） */
let __cleanupTryAt = 0;

/* v632a：IP → 不可逆哈希（24 位十六进制）。只用于「同设备 1 小时去重」，不需要还原原始 IP。
   盐值取固定串即可：哈希只在本库内部做比对，不对外暴露，也不需要跨环境可迁移。 */
const __IP_SALT = 'wnzyq-track-v1';
async function __hashIp(ip) {
  if (!ip) return '';
  try {
    const buf = new TextEncoder().encode(__IP_SALT + '|' + ip);
    const dig = await crypto.subtle.digest('SHA-256', buf);
    const arr = new Uint8Array(dig).slice(0, 12);
    let out = '';
    for (let i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, '0');
    return out;
  } catch (e) {
    /* 极端环境下没有 crypto.subtle：宁可记为“未知来源”，也不退回明文 */
    return '';
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  /* v626 D2（老板 11-13）：公开埋点限流 60 次/分钟/IP，超限对访客静默丢弃（返回 ok，不打扰页面） */
  if (!rateLimit(request, 'track', 60)) return json({ ok: true });
  const body = await readJSON(request);
  const pid = Number(body.product_id);
  const type = VALID_TRACK_TYPES.indexOf(body.type) !== -1 ? body.type : 'view';
  if (!pid) return json({ ok: false, msg: '缺少 product_id' }, 400);

  // R168-②：管理员自己浏览前台不计入——带管理会话 Cookie 的请求直接跳过（普通访客无此 Cookie，零额外开销）
  const tok = getCookie(request, 'wnzyq_token');
  if (tok) {
    try {
      const admin = await getAuthAdmin(env, request);
      if (admin) return json({ ok: true, skipped: 'admin' });
    } catch (e) { /* 会话校验失败按普通访客继续记录 */ }
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';
  /* v632a（老板 22:38「改一个隐私项」）：访客 IP 不再明文入库，改存不可逆哈希。
     stats 表每条浏览记录都带完整 IP（保留 60 天），属个人信息；
     而它唯一的用途只是「1 小时内同一个人不重复计数」——哈希完全够用。
     取 SHA-256 前 12 字节转 24 位十六进制：量级上撞车可忽略，且无法反推原始 IP。
     历史明文会在 60 天内自然清掉；过渡期同一人最多被多记一次，可接受。 */
  const ipHash = await __hashIp(ip);
  try { const { ensureStatsColumns } = await import('../_utils.js'); await ensureStatsColumns(env); } catch (eM) {} /* v441b：stats.region 幂等补列（缺列=埋点 INSERT 一直失败） */
  /* v633：整段每日清理搬进后台任务（waitUntil）。原来是埋点响应前同步串行跑的——
     当天第一笔埋点要跑 8 张表的 COUNT + settings 读写，几百毫秒到数秒，用户点开第一个资源就卡一下；
     并发首访还会同时跑多份、互相抢写锁。现在埋点立刻返回，清理在后台完成。 */
  const __cleanupJob = (async function () {
    /* v633：同实例 10 分钟内只尝试一次——埋点现在不阻塞响应，短时间多笔请求会同时启动多份清理任务，
       都在读「今天清过没」之前就开跑，等于同一批表被删好几遍、互抢写锁。加个进程内节流就解决。 */
    if (Date.now() - __cleanupTryAt < 10 * 60 * 1000) return;
    __cleanupTryAt = Date.now();
    // R298（用户 09-30）：60 天清理统一每天一次——纯代码实现，不碰后台定时配置。
    // 记录上次清理日期在 settings 表（key='last_cleanup_date'），跨天首访触发一次；先检查真有旧数据才删。
    try {
      // R307 U8（用户 09-30 拍板「全系统统一用固定按北京时间加 8 小时算」）：
      // 原 toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) 改为与 stats.js / export.js
      // 完全一致的固定 +8 偏移写法，全系统时间口径单一。
      const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
      const last = await env.DB.prepare("SELECT value FROM settings WHERE key = 'last_cleanup_date'").first();
      if (!last || last.value !== today) {
        const tables = [
          { name: 'stats', dateCol: 'created_at' },
          { name: 'sessions', dateCol: 'created_at' },
          { name: 'login_attempts', dateCol: 'last_attempt' },
          { name: 'code_issues', dateCol: 'issued_at', extra: "AND status = 'issued'" },
          /* v439 #64/#63/#68：审计/登录记录 60 天清；回收站到期（deleted_at 超 60 天）彻底删除 */
          { name: 'audit_log', dateCol: 'created_at' },
          { name: 'admin_logins', dateCol: 'created_at' },
          { name: 'products', dateCol: 'deleted_at', extra: 'AND deleted_at IS NOT NULL' },
          { name: 'categories', dateCol: 'deleted_at', extra: 'AND deleted_at IS NOT NULL' },
          /* v633：性能实测（web_vitals）和前端报错（client_errors）从来没进过清理清单——
             每次访问都写一条，只增不减。攒上一年，后台"性能实测"的 p75 查询会越来越慢，
             还白占 D1 存储额度。同样按 60 天清。
             这两张表是"用到才建"的（vitals.js / error.js 里 CREATE TABLE IF NOT EXISTS），
             所以**必须排在数组最后**：万一某个库还没建过它们，这里会抛 no such table，
             而整个循环共用外层一个 try——放最后就不会连累前面的表清不掉。 */
          { name: 'web_vitals', dateCol: 'created_at' },
          { name: 'client_errors', dateCol: 'created_at' }
        ];
        /* v439 复检修正：回收站到期彻底删除时联动清理派生数据——
           ① 先收集到期资源的图仓 key 并删除（否则 R2 永久孤儿占存储）
           ② 删 product_variants（类型/资源码）与 resource_bindings（绑定记录），否则残留孤儿
           categories 到期时其下资源早已随资源各自到期处理，此处仅删分类行 */
        /* v633：先拿一份"这座库里到底有哪些表"，只清理存在的。
           原因：web_vitals / client_errors 是懒建表（没人访问过就没有），
           而整个循环共用外层一个 try——一张表 no such table 就会让后面的表全都清不掉。
           先筛一遍最稳，代价只有每天一次 sqlite_master 查询。 */
        let __exist = null;
        try {
          const __er = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
          __exist = new Set((__er.results || []).map(function (r) { return r.name; }));
        } catch (eE) { __exist = null; }
        for (const t of tables) {
          if (__exist && !__exist.has(t.name)) continue;
          const countRow = await env.DB.prepare(
            `SELECT COUNT(*) AS n FROM ${t.name} WHERE ${t.dateCol} < datetime('now', '-60 days') ${t.extra || ''}`
          ).first();
          if (countRow && countRow.n > 0) {
            if (t.name === 'products') {
              /* ① 先收集到期资源的图仓地址（删行前取，之后行没了查不到） */
              let sources = [];
              try {
                const { results: expRows } = await env.DB.prepare(
                  `SELECT p.img, p.detail, p.detail_images, p.detail_videos, v."desc" AS vd, v.img AS vi, v.video AS vv, v.resource_content AS vrc
                   FROM products p LEFT JOIN product_variants v ON v.product_id = p.id
                   WHERE p.deleted_at < datetime('now', '-60 days') AND p.deleted_at IS NOT NULL`
                ).all();
                for (const r of (expRows || [])) sources.push(r.img, r.detail, r.detail_images, r.detail_videos, r.vd, r.vi, r.vv, r.vrc);
              } catch (e1) { console.error('到期清理收集图仓地址失败（继续):', e1 && e1.message); }
              /* ② 派生行清理：类型/码 + 绑定（在删主表前删，靠 product_id 关联） */
              try {
                await env.DB.prepare(
                  `DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE deleted_at < datetime('now', '-60 days') AND deleted_at IS NOT NULL)`
                ).run();
                await env.DB.prepare(
                  `DELETE FROM resource_bindings WHERE product_id IN (SELECT id FROM products WHERE deleted_at < datetime('now', '-60 days') AND deleted_at IS NOT NULL)`
                ).run();
              } catch (e2) { console.error('到期清理派生行失败（继续):', e2 && e2.message); }
            }
            await env.DB.prepare(
              `DELETE FROM ${t.name} WHERE ${t.dateCol} < datetime('now', '-60 days') ${t.extra || ''}`
            ).run();
            /* ③ 图仓清理必须放在删行之后——deleteBucketImages 的引用保护会把仍在库里的行算作引用者，
               先删图会把到期资源自己的图当成「别处在用」而漏删（v440 复检修正顺序） */
            if (t.name === 'products' && sources.length) {
              try {
                const { deleteBucketImages } = await import('../_utils.js');
                await deleteBucketImages(env, sources);
              } catch (e3) { console.error('到期清理图仓失败（不影响删行):', e3 && e3.message); }
            }
          }
        }
        await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_cleanup_date', ?)").bind(today).run();
      }
    } catch (e) { console.error('每日清理失败（不影响埋点):', e); }
  })();
  if (context.waitUntil) context.waitUntil(__cleanupJob);


  // R169：去重口径统一到全部类型——「同设备+同资源+同类型」1 小时窗口内已有记录则本次不记
  // （created_at 为 UTC，与 datetime('now','-1 hour') 同系直接比较，窗口 1 小时与时区无关）
  /* v633：顺手把「资源是否存在」一起判了（同一个 SELECT 两个 EXISTS，不多一次往返、不多一次计费）。
     原来 product_id 完全不校验，脚本随便填个 999999 就写进 stats，攒一堆查不到资源的脏行；
     公告阅读（ann_read）的 id 是公告 id 不是资源 id，所以它不做这项校验。 */
  try {
    const chk = await env.DB.prepare(
      `SELECT
         EXISTS(SELECT 1 FROM stats WHERE type = ? AND product_id = ? AND ip = ? AND created_at >= datetime('now', '-1 hour')) AS dup,
         EXISTS(SELECT 1 FROM products WHERE id = ? AND deleted_at IS NULL) AS live`
    ).bind(type, pid, ipHash, pid).first();
    if (chk && chk.dup) return json({ ok: true, deduped: true });
    if (type !== 'ann_read' && chk && !chk.live) return json({ ok: true, skipped: 'no-product' });
  } catch (e) { console.error('埋点去重查询失败（降级为记录):', e); }

  await env.DB.prepare('INSERT INTO stats (product_id, type, ip, region) VALUES (?, ?, ?, ?)')
    .bind(pid, type, ipHash, (request.cf && request.cf.region) || '')
    .run();

  /* v534：顺带自动采集——和上面 60 天清理完全同一个思路，纯代码实现，不碰任何定时配置。
     当天第一次有人访问就把勾了「每天自动」的平台采一遍；交给 waitUntil 后台跑，这条埋点照常立刻返回。 */
  try {
    const job = import('../_autocollect.js')
      .then(function (m) { return m.maybeAutoCollect(context); })
      .catch(function (e) { console.error('自动采集失败（不影响埋点):', e && e.message); });
    if (context.waitUntil) context.waitUntil(job);
  } catch (eA) { console.error('自动采集挂载失败（不影响埋点):', eA && eA.message); }

  return json({ ok: true });
}
