/**
 * GET /api/admin/info?last=<ISO时间>
 * 信息中心（需登录）：距上次查看的增量 + 今日概览 + 明细列表（谁/什么时候/做了什么）
 * 数据源：stats 表（view/contact/resource_unlock）+ resource_bindings 表（领取绑定），不建新表
 */
import { json, requireAuth, ensureBindingsTable } from '../../_utils.js';

const BJ = 8 * 3600 * 1000;

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
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

  const [dView, dContact, dUnlock, dBind, tView, tContact, tUnlock, tBind, recent] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='view' AND created_at > ?1").bind(last).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='contact' AND created_at > ?1").bind(last).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='resource_unlock' AND created_at > ?1").bind(last).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM resource_bindings WHERE created_at > ?1').bind(last).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='view' AND created_at > ?1").bind(todayStartUTC).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='contact' AND created_at > ?1").bind(todayStartUTC).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM stats WHERE type='resource_unlock' AND created_at > ?1").bind(todayStartUTC).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM resource_bindings WHERE created_at > ?1').bind(todayStartUTC).first(),
    // 明细：stats 事件（含资源名）与绑定事件合并，按时间倒序取 100 条
    env.DB.prepare(
      `SELECT * FROM (
         SELECT s.created_at AS at, s.type AS type, s.ip AS who, COALESCE(s.region, '') AS region, COALESCE(p.title, '已删除资源') AS title, '' AS extra
           FROM stats s LEFT JOIN products p ON p.id = s.product_id
          WHERE s.created_at > ?1
         UNION ALL
         SELECT b.created_at, 'bind', '设备 ' || substr(b.device_token, 1, 6), COALESCE(b.region, ''), COALESCE(p.title, '已删除资源'), COALESCE(v.title, '')
           FROM resource_bindings b
           LEFT JOIN products p ON p.id = b.product_id
           LEFT JOIN product_variants v ON v.id = b.variant_id
          WHERE b.created_at > ?1
       ) ORDER BY at DESC LIMIT 100`
    ).bind(last).all()
  ]);

  const rows = (recent.results || []).map(function (r) { return { at: r.at, type: r.type, who: r.who || '', region: r.region || '', title: r.title || '', extra: r.extra || '' }; });

  return json({
    ok: true,
    lastSeen: last,
    delta: { view: (dView && dView.n) || 0, contact: (dContact && dContact.n) || 0, unlock: (dUnlock && dUnlock.n) || 0, bind: (dBind && dBind.n) || 0 },
    today: { view: (tView && tView.n) || 0, contact: (tContact && tContact.n) || 0, unlock: (tUnlock && tUnlock.n) || 0, bind: (tBind && tBind.n) || 0 },
    recent: rows,
    serverNow: new Date().toISOString()
  });
}
