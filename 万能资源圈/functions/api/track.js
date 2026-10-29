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
import { json, readJSON, getCookie, getAuthAdmin } from '../_utils.js';

// 允许的埋点类型白名单：不认识的类型一律按 'view' 记录
const VALID_TRACK_TYPES = ['view', 'contact', 'resource_unlock', 'ann_read']; /* v439 #118：公告阅读 */

export async function onRequestPost(context) {
  const { env, request } = context;
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
        { name: 'categories', dateCol: 'deleted_at', extra: 'AND deleted_at IS NOT NULL' }
      ];
      /* v439 复检修正：回收站到期彻底删除时联动清理派生数据——
         ① 先收集到期资源的图仓 key 并删除（否则 R2 永久孤儿占存储）
         ② 删 product_variants（类型/资源码）与 resource_bindings（绑定记录），否则残留孤儿
         categories 到期时其下资源早已随资源各自到期处理，此处仅删分类行 */
      for (const t of tables) {
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
            } catch (e1) { console.error('到期清理收集图仓地址失败(继续):', e1 && e1.message); }
            /* ② 派生行清理：类型/码 + 绑定（在删主表前删，靠 product_id 关联） */
            try {
              await env.DB.prepare(
                `DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE deleted_at < datetime('now', '-60 days') AND deleted_at IS NOT NULL)`
              ).run();
              await env.DB.prepare(
                `DELETE FROM resource_bindings WHERE product_id IN (SELECT id FROM products WHERE deleted_at < datetime('now', '-60 days') AND deleted_at IS NOT NULL)`
              ).run();
            } catch (e2) { console.error('到期清理派生行失败(继续):', e2 && e2.message); }
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
            } catch (e3) { console.error('到期清理图仓失败(不影响删行):', e3 && e3.message); }
          }
        }
      }
      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_cleanup_date', ?)").bind(today).run();
    }
  } catch (e) { console.error('每日清理失败(不影响埋点):', e); }

  // R169：去重口径统一到全部类型——「同设备+同资源+同类型」1 小时窗口内已有记录则本次不记
  // （created_at 为 UTC，与 datetime('now','-1 hour') 同系直接比较，窗口 1 小时与时区无关）
  try {
    const dup = await env.DB.prepare(
      "SELECT id FROM stats WHERE type = ? AND product_id = ? AND ip = ? AND created_at >= datetime('now', '-1 hour') LIMIT 1"
    ).bind(type, pid, ip).first();
    if (dup) return json({ ok: true, deduped: true });
  } catch (e) { console.error('埋点去重查询失败(降级为记录):', e); }

  await env.DB.prepare('INSERT INTO stats (product_id, type, ip, region) VALUES (?, ?, ?, ?)')
    .bind(pid, type, ip, (request.cf && request.cf.region) || '')
    .run();

  return json({ ok: true });
}
