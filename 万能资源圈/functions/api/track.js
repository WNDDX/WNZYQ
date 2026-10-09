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
const VALID_TRACK_TYPES = ['view', 'contact', 'resource_unlock'];

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
        { name: 'code_issues', dateCol: 'issued_at', extra: "AND status = 'issued'" }
      ];
      for (const t of tables) {
        const countRow = await env.DB.prepare(
          `SELECT COUNT(*) AS n FROM ${t.name} WHERE ${t.dateCol} < datetime('now', '-60 days') ${t.extra || ''}`
        ).first();
        if (countRow && countRow.n > 0) {
          await env.DB.prepare(
            `DELETE FROM ${t.name} WHERE ${t.dateCol} < datetime('now', '-60 days') ${t.extra || ''}`
          ).run();
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

  await env.DB.prepare('INSERT INTO stats (product_id, type, ip) VALUES (?, ?, ?)')
    .bind(pid, type, ip)
    .run();

  return json({ ok: true });
}
