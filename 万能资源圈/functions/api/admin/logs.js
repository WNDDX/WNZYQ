/**
 * v530 操作日志（老板：谁在什么时候改了设置/删了资源，保留 60 天）
 * v540 加「员工操作日报」：按人 / 按动作 / 按天汇总，可选今天 / 近 7 天 / 近 30 天。
 *
 * GET /api/admin/logs?page=1&size=20&who=&q=&days=7
 *   → { ok, list:[{id, at, who, action, target}], total, page, size, days,
 *       summary:{ range, total, people:[{who,n}], actions:[{action,n}], byDay:[{day,n}] } }
 *
 * 数据源：复用已有的 audit_log 表（系统本来就在写）。
 * 不建新表、不新增写入点——20 多个业务调用点自动被覆盖。
 */
import { json, requirePerm, ensureAdminUsers } from '../../_utils.js';

export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    await ensureAdminUsers(env);

    /* 权限：超管，或有「账号管理」权限的人（日志属于账号安全范畴） */
    const auth = await requirePerm(env, request, 'users');
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    /* v540：一页固定 20 条（老板：所有长列表只显示 20 条 + 翻页） */
    /* v543：size=0 = 导出用全量（最多 3000 条，够 60 天用；界面永远走 20 条分页） */
    const sizeRaw = parseInt(url.searchParams.get('size') || '20', 10);
    const allRows = sizeRaw === 0;
    const size = allRows ? 3000 : Math.min(100, Math.max(5, sizeRaw || 20));
    const who = (url.searchParams.get('who') || '').slice(0, 40);
    const q = (url.searchParams.get('q') || '').slice(0, 60);
    /* 时间范围：1=今天 7=近 7 天 30=近 30 天（其它值按 7 处理） */
    let days = parseInt(url.searchParams.get('days') || '7', 10) || 7;
    if ([1, 7, 30].indexOf(days) === -1) days = 7;

    /* 表可能还没建（全新库）：建一次空表，返回空列表而不是 500 */
    try {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT (datetime('now')), admin TEXT NOT NULL DEFAULT 'admin', action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '')").run();
    } catch (e) {}

    /* 时间窗口：1 天 = 北京时间今天 0 点起；7 / 30 天 = 滚动 N 天 */
    const RANGE = days === 1
      ? "created_at >= datetime('now', '+8 hours', 'start of day', '-8 hours')"
      : "created_at >= datetime('now', '-" + days + " day')";

    const where = [RANGE];
    const binds = [];
    if (who) { where.push('admin = ?'); binds.push(who); }
    if (q) { where.push('(action LIKE ? OR target LIKE ?)'); binds.push('%' + q + '%'); binds.push('%' + q + '%'); }
    const w = 'WHERE ' + where.join(' AND ');

    let q1 = env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log ' + w);
    if (binds.length) q1 = q1.bind.apply(q1, binds);
    const totalRow = await q1.first();

    let q2 = env.DB.prepare('SELECT id, created_at AS at, admin AS who, action, target FROM audit_log ' + w + ' ORDER BY id DESC LIMIT ? OFFSET ?');
    q2 = q2.bind.apply(q2, binds.concat([size, allRows ? 0 : (page - 1) * size]));
    const rows = await q2.all();

    /* ===== 员工操作日报：同一时间窗口内按人 / 按动作 / 按天汇总（搜索词也算进去） ===== */
    const sumWhere = [RANGE];
    const sumBinds = [];
    if (q) { sumWhere.push('(action LIKE ? OR target LIKE ?)'); sumBinds.push('%' + q + '%'); sumBinds.push('%' + q + '%'); }
    const sw = 'WHERE ' + sumWhere.join(' AND ');
    const runAgg = async (sql) => {
      try {
        let st = env.DB.prepare(sql);
        if (sumBinds.length) st = st.bind.apply(st, sumBinds);
        const r = await st.all();
        return (r && r.results) || [];
      } catch (e) { return []; }
    };
    const people = await runAgg('SELECT admin AS who, COUNT(*) AS n FROM audit_log ' + sw + ' GROUP BY admin ORDER BY n DESC LIMIT 20');
    const actions = await runAgg('SELECT action, COUNT(*) AS n FROM audit_log ' + sw + ' GROUP BY action ORDER BY n DESC LIMIT 8');
    const byDay = await runAgg("SELECT strftime('%Y-%m-%d', created_at, '+8 hours') AS day, COUNT(*) AS n FROM audit_log " + sw + ' GROUP BY day ORDER BY day DESC LIMIT 31');

    return json({
      ok: true,
      list: (rows && rows.results) || [],
      total: (totalRow && totalRow.n) || 0,
      page, size, days,
      /* v544：导出上限 3000 条——到顶了要告诉前端，别静默少导 */
      truncated: allRows && ((totalRow && totalRow.n) || 0) > size,
      summary: {
        range: days,
        total: (totalRow && totalRow.n) || 0,
        people: people || [],
        actions: actions || [],
        byDay: byDay || []
      }
    });
  } catch (e) {
    return json({ ok: false, msg: '日志读取失败：' + (e && e.message || '未知错误') }, 500);
  }
}
