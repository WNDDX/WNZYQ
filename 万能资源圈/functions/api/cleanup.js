/**
 * GET /api/cleanup
 * 定期清理旧数据（由 Cron Trigger 每天触发，或手动调用）
 * 清理内容：
 *   1. stats 表：只保留最近 30 天（避免数据库无限增长）
 *   2. sessions 表：删除 30 天前的会话
 *   3. login_attempts 表：删除 30 天前的记录
 * 全系统统一保留最近 30 天数据
 * 需要 header: x-cleanup-token = 环境变量 CLEANUP_TOKEN
 * 安全策略：设置了 CLEANUP_TOKEN 就必须带对 token；
 * 未设置 CLEANUP_TOKEN 时仅允许本地调试（localhost/127.0.0.1）调用，
 * 公网一律拒绝，防止陌生人直接清空统计数据
 */
import { json } from '../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;

  // Token 校验（如果设置了环境变量）
  const expectedToken = env.CLEANUP_TOKEN || '';
  if (expectedToken) {
    const token = request.headers.get('x-cleanup-token') || '';
    if (token !== expectedToken) {
      return json({ ok: false, msg: '未授权' }, 401);
    }
  } else {
    const host = new URL(request.url).hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return json({ ok: false, msg: '未设置 CLEANUP_TOKEN，公网调用已禁用。请在 Cloudflare Pages 环境变量里设置 CLEANUP_TOKEN 后再使用定时清理' }, 401);
    }
  }

  const results = {};

  try {
    // 1. 清理 stats：只保留最近 30 天
    const r1 = await env.DB.prepare(
      `DELETE FROM stats WHERE created_at < datetime('now', '-30 days')`
    ).run();
    results.stats_deleted = r1.meta.changes || 0;

    // 2. 清理 sessions：只保留最近 30 天（含未过期的，过期的也删）
    const r2 = await env.DB.prepare(
      `DELETE FROM sessions WHERE created_at < datetime('now', '-30 days')`
    ).run();
    results.sessions_deleted = r2.meta.changes || 0;

    // 3. 清理 login_attempts：只保留最近 30 天
    const r3 = await env.DB.prepare(
      `DELETE FROM login_attempts WHERE last_attempt < datetime('now', '-30 days')`
    ).run();
    results.login_attempts_deleted = r3.meta.changes || 0;

    // 4. 统计当前各表行数（用于监控）
    const counts = {};
    for (const table of ['products', 'categories', 'stats', 'sessions', 'login_attempts']) {
      try {
        const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first();
        counts[table] = r ? r.n : 0;
      } catch (e) {
        counts[table] = -1;
      }
    }
    results.current_counts = counts;

    return json({ ok: true, msg: '清理完成', results });
  } catch (err) {
    return json({ ok: false, msg: '清理失败: ' + err.message }, 500);
  }
}
