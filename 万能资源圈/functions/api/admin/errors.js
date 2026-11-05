/**
 * GET /api/admin/errors?days=7&q=&page=1   —— 前端报错列表（谁在用、报了什么）
 * DELETE /api/admin/errors                 —— 清空已读（老板看完了想归零时用）
 *
 * 权限：sensitive.super（与「清空数据」同级）——报错里有页面路径和 UA，属运维信息，只给超管。
 * 保留：60 天。这个清理挂在每天的 stats 清理里没必要重复做，这里读取时顺手删一次旧的（有 30 分钟节流）。
 */
import { json, requirePerm, audit } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requirePerm(env, request, 'sensitive.super');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const days = [1, 7, 30].indexOf(parseInt(url.searchParams.get('days') || '7', 10)) >= 0
    ? parseInt(url.searchParams.get('days') || '7', 10) : 7;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const size = 20;
  const q = String(url.searchParams.get('q') || '').slice(0, 60).trim();

  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS client_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_at TEXT NOT NULL DEFAULT (datetime('now')),
      kind TEXT NOT NULL DEFAULT 'js',
      msg TEXT NOT NULL,
      stack TEXT NOT NULL DEFAULT '',
      page TEXT NOT NULL DEFAULT '',
      ua TEXT NOT NULL DEFAULT '',
      ip_hash TEXT NOT NULL DEFAULT '',
      cnt INTEGER NOT NULL DEFAULT 1
    )`).run();
  } catch (e) {}

  /* 顺手清理 60 天前的（节流：settings 里记上次清理日，跨天才删一次） */
  try {
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    const last = await env.DB.prepare("SELECT value FROM settings WHERE key = 'client_err_cleanup'").first();
    if (!last || last.value !== today) {
      await env.DB.prepare("DELETE FROM client_errors WHERE last_at < datetime('now','-60 day')").run();
      await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('client_err_cleanup', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(today).run();
    }
  } catch (e) {}

  const RANGE = days === 1
    ? "last_at >= datetime('now', '+8 hours', 'start of day', '-8 hours')"
    : "last_at >= datetime('now', '-" + days + " day')";

  const where = [RANGE];
  const binds = [];
  if (q) { where.push('(msg LIKE ? OR page LIKE ?)'); binds.push('%' + q + '%'); binds.push('%' + q + '%'); }
  const w = 'WHERE ' + where.join(' AND ');

  try {
    const totalRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM client_errors ' + w).bind(...binds).first();
    const total = Number((totalRow && totalRow.n) || 0);

    const sumRow = await env.DB.prepare(
      'SELECT COALESCE(SUM(cnt),0) AS hits, COUNT(DISTINCT ip_hash) AS devices FROM client_errors ' + w
    ).bind(...binds).first();

    const rows = await env.DB.prepare(
      'SELECT id, created_at, last_at, kind, msg, stack, page, ua, ip_hash, cnt FROM client_errors ' + w +
      ' ORDER BY last_at DESC LIMIT ? OFFSET ?'
    ).bind(...binds, size, (page - 1) * size).all();

    /* 按页面归类：哪个页面最容易出错，一眼看出来 */
    const byPage = await env.DB.prepare(
      'SELECT page, COUNT(*) AS n, SUM(cnt) AS hits FROM client_errors ' + w + ' GROUP BY page ORDER BY hits DESC LIMIT 8'
    ).bind(...binds).all();

    return json({
      ok: true, days, page, size, total,
      hits: Number((sumRow && sumRow.hits) || 0),
      devices: Number((sumRow && sumRow.devices) || 0),
      list: (rows && rows.results) || [],
      byPage: (byPage && byPage.results) || []
    });
  } catch (e) {
    return json({ ok: true, total: 0, hits: 0, devices: 0, list: [], byPage: [], msg: '读取失败' });
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const auth = await requirePerm(env, request, 'sensitive.super');
  if (auth instanceof Response) return auth;
  try {
    await env.DB.prepare('DELETE FROM client_errors').run();
    try { await audit(env, request, '清空前端报错', 'client_errors'); } catch (e) {}
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, msg: '清空失败' }, 500);
  }
}
