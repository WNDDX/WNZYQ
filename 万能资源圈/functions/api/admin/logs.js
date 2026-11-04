/**
 * v530 操作日志（老板：谁在什么时候改了设置/删了资源，保留 60 天）
 *
 * GET /api/admin/logs?page=1&size=30&who=&q=
 *   → { ok, list:[{id, at, who, action, target}], total, page, size, days:60 }
 *
 * 数据源：复用已有的 audit_log 表（系统本来就在写，只是操作者写死成 'admin'）。
 * v530 起 _utils.js 的 audit() 会记录真实账号；60 天清理由 /api/track 里的清理清单负责。
 * 不建新表、不新增写入点——20 多个业务调用点自动被覆盖。
 */
import { json, requireAuth, requirePerm, ensureAdminUsers } from '../../_utils.js';

export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    await ensureAdminUsers(env);

    /* 权限：超管，或有「账号管理」权限的人（日志属于账号安全范畴） */
    const auth = await requirePerm(env, request, 'users');
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(url.searchParams.get('size') || '30', 10) || 30));
    const who = (url.searchParams.get('who') || '').slice(0, 40);
    const q = (url.searchParams.get('q') || '').slice(0, 60);

    /* 表可能还没建（全新库）：建一次空表，返回空列表而不是 500 */
    try {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT (datetime('now')), admin TEXT NOT NULL DEFAULT 'admin', action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '')").run();
    } catch (e) {}

    const where = [];
    const binds = [];
    if (who) { where.push('admin = ?'); binds.push(who); }
    if (q) { where.push('(action LIKE ? OR target LIKE ?)'); binds.push('%' + q + '%'); binds.push('%' + q + '%'); }
    /* 只给最近 60 天（与清理口径一致，避免看到已被清理边界外的残留） */
    where.push("created_at >= datetime('now', '-60 day')");
    const w = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    let q1 = env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log ' + w);
    if (binds.length) q1 = q1.bind.apply(q1, binds);
    const totalRow = await q1.first();

    let q2 = env.DB.prepare('SELECT id, created_at AS at, admin AS who, action, target FROM audit_log ' + w + ' ORDER BY id DESC LIMIT ? OFFSET ?');
    q2 = q2.bind.apply(q2, binds.concat([size, (page - 1) * size]));
    const rows = await q2.all();

    return json({
      ok: true,
      list: (rows && rows.results) || [],
      total: (totalRow && totalRow.n) || 0,
      page, size, days: 60
    });
  } catch (e) {
    return json({ ok: false, msg: '日志读取失败：' + (e && e.message || '未知错误') }, 500);
  }
}
