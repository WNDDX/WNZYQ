/**
 * GET /api/admin/info?last=<ISO时间>
 * 信息中心（需登录）：距上次查看的增量 + 今日概览 + 明细列表（谁/什么时候/做了什么）
 * 数据源：stats 表（view/contact/resource_unlock）+ resource_bindings 表（领取绑定），不建新表
 */
import { json, requireAuth, requirePerm, ensureAdminUsers } from '../../_utils.js';

const BJ = 8 * 3600 * 1000;

export async function onRequestGet(context) {
  await ensureAdminUsers(env);
  const { env, request } = context;
  const auth = await requirePerm(env, request, 'info.view');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  let last = url.searchParams.get('last') || '';
  /* v434 修复：接受带 Z 结尾的 ISO（旧前端 markSeen 存的格式），归一化后使用 */
  if (/Z$/.test(last)) last = last.slice(0, 19).replace('T', ' ');
  if (!/^\d{4}-\d{2}-\d{2}[T ][0-9:.]+$/.test(last)) {
    // 无有效上次时间：默认取 24 小时前（首次使用不亮红点只看概览）
    last = new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' ');
  }
  last = last.slice(0, 19).replace('T', ' ');

  // 30 天封顶（防数字爆炸，与统计页最大范围同口径）——v434 修复：原多加了 +8h 使下限前移 8 小时
  const floor = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  if (last < floor) last = floor;

  // 今日 0 点（北京口径，与统计页一致）
  const todayBJ = new Date(Date.now() + BJ).toISOString().slice(0, 10);
  const todayStartUTC = new Date(new Date(todayBJ + 'T00:00:00+08:00').getTime() - 0).toISOString().slice(0, 19).replace('T', ' ');

  await ensureBindingsTable(env);
  /* v439 #63/#64：登录/审计表兜底建表（首次使用前确保 recent UNION 不因缺表 500） */
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_logins (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT (datetime('now')), device TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '', ua TEXT NOT NULL DEFAULT '')").run();
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT (datetime('now')), admin TEXT NOT NULL DEFAULT 'admin', action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '')").run();
  } catch (e) {}

  const whoFilter = (url.searchParams.get('who') || '').slice(0, 20); /* #116：按人筛选留痕 */
  const isSub = auth.role !== 'super';
  const [dView, dContact, dUnlock, dBind, dLogin, dAudit, tView, tContact, tUnlock, tBind, recent] = await Promise.all([ /* v439：+登录增量+#116 下级动作增量 */
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='view' AND created_at > ?1").bind(last).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='contact' AND created_at > ?1").bind(last).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='resource_unlock' AND created_at > ?1").bind(last).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM resource_bindings WHERE created_at > ?1').bind(last).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM admin_logins WHERE created_at > ?1').bind(last).first().catch(() => ({ n: 0 })),
    isSub
      ? env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE created_at > ?1 AND admin = ?2').bind(last, auth.username).first().catch(() => ({ n: 0 })) /* #116 复检：sub 红点只按自己的动作（与列表过滤口径一致，不「亮着却看不到」） */
      : env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE created_at > ?1 AND admin != 'admin'").bind(last).first().catch(() => ({ n: 0 })), /* #116：下级动作增量（排除超管自己的 admin 记录） */
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='view' AND created_at > ?1").bind(todayStartUTC).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='contact' AND created_at > ?1").bind(todayStartUTC).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='resource_unlock' AND created_at > ?1").bind(todayStartUTC).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM resource_bindings WHERE created_at > ?1').bind(todayStartUTC).first(),
    // 明细：stats 事件（含资源名）+ 绑定事件 + 管理登录 + 审计，按时间倒序取 100 条（v439 #63/#64）
    env.DB.prepare(
      `SELECT * FROM (
         SELECT s.created_at AS at, s.type AS type, s.ip AS who, COALESCE(s.region, '') AS region,
                CASE WHEN s.type = 'ann_read' THEN '公告#' || s.product_id ELSE COALESCE(p.title, '已删除资源') END AS title, '' AS extra
           FROM stats s LEFT JOIN products p ON p.id = s.product_id
          WHERE s.created_at > ?1
         UNION ALL
         SELECT b.created_at, 'bind', '设备 ' || substr(b.device_token, 1, 6), COALESCE(b.region, ''), COALESCE(p.title, '已删除资源'), COALESCE(v.title, '')
           FROM resource_bindings b
           LEFT JOIN products p ON p.id = b.product_id
           LEFT JOIN product_variants v ON v.id = b.variant_id
          WHERE b.created_at > ?1
         UNION ALL
         SELECT g.created_at, 'login', g.device, '', '管理后台', '新设备登录'
           FROM admin_logins g WHERE g.created_at > ?1
         UNION ALL
         SELECT a.created_at, 'audit', a.admin, '', a.action, a.target
           FROM audit_log a WHERE a.created_at > ?1
       ) ORDER BY at DESC LIMIT 100`
    ).bind(last).all()
  ]);

  let rows = (recent.results || []).map(function (r) { return { at: r.at, type: r.type, who: r.who || '', region: r.region || '', title: r.title || '', extra: r.extra || '' }; });
  /* #116：子账号视角——别人的操作留痕与管理登录不给看 */
  if (isSub) rows = rows.filter(function (r) { return !(r.type === 'audit' && r.who !== auth.username) && r.type !== 'login'; });
  /* #116 复检修正：信息锁（IP）——sub 无 data.ip 权限时访客地址脱敏（此前勾不勾都看得到全站访客 IP） */
  if (isSub) {
    try {
      const { parsePerms, can } = await import('../../_perms.js');
      const _pp = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
      if (!can('data.ip', auth.role, _pp)) {
        rows = rows.map(function (r) {
          if (r.type === 'audit') return r; /* 自己的操作留痕不脱敏 */
          const seg = String(r.who || '').split('.');
          r.who = seg.length >= 4 ? seg[0] + '.' + seg[1] + '.*.*' : (String(r.who || '').slice(0, 3) + '***');
          return r;
        });
      }
    } catch (eM) { /* 脱敏失败按原文返回 */ }
  }
  /* #116：按人筛选（超管查某个员工的账） */
  if (whoFilter) rows = rows.filter(function (r) { return r.type === 'audit' ? r.who === whoFilter : true; });

  return json({
    ok: true,
    lastSeen: last,
    delta: { view: (dView && dView.n) || 0, contact: (dContact && dContact.n) || 0, unlock: (dUnlock && dUnlock.n) || 0, bind: (dBind && dBind.n) || 0, login: (dLogin && dLogin.n) || 0, audit: (dAudit && dAudit.n) || 0 },
    today: { view: (tView && tView.n) || 0, contact: (tContact && tContact.n) || 0, unlock: (tUnlock && tUnlock.n) || 0, bind: (tBind && tBind.n) || 0 },
    recent: rows,
    serverNow: new Date().toISOString()
  });
}
