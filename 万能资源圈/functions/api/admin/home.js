/**
 * GET /api/admin/home
 * 管理后台首页聚合接口（R308）：一次返回首屏全部数据
 * 带版本号：客户端传 ?v=lastVersion，没变则返回 { unchanged: true }
 */
import { json, requireAuth, cleanProduct, cleanVariant, ensureVariantColumns, ensureProductColumns, ensureBindingsTable, ensureCodeIssuesTable } from '../../_utils.js';

const ADMIN_PAGE_SIZE = 20;

// 给资源列表批量挂上各自的类型（后台需要看到类型/资源码状态、导出资源类型表）
async function attachVariants(env, list) {
  if (!list || !list.length) return list;
  const ids = list.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const { results: vrows } = await env.DB.prepare(
    `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY sort ASC, id ASC`
  ).bind(...ids).all();
  const bindMap = {};
  try {
    await ensureBindingsTable(env);
    const { results: bindRows } = await env.DB.prepare(
      `SELECT variant_id, COUNT(*) AS n FROM resource_bindings WHERE product_id IN (${placeholders}) GROUP BY variant_id`
    ).bind(...ids).all();
    (bindRows || []).forEach((r) => { bindMap[r.variant_id] = r.n; });
  } catch (e) { console.error('home attachVariants 绑定计数失败:', e && e.message); }
  await ensureCodeIssuesTable(env);
  const map = {};
  for (const v of (vrows || [])) {
    if (!map[v.product_id]) map[v.product_id] = [];
    map[v.product_id].push(Object.assign(cleanVariant(v), { bindings: bindMap[v.id] || 0 }));
  }
  list.forEach((p) => { p.variants = map[p.id] || []; });
  return list;
}

// 计算数据版本（ Beijing 时间口径，与 U8 统一 ）
async function computeVersion(env) {
  const [pRow, cRow, sRow, setRow] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(updated_at),'') AS m FROM products").first(),
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(created_at),'') AS m FROM categories").first(),
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(created_at),'') AS m FROM stats").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM settings").first(),
  ]);
  return `a${pRow.n}_${pRow.m}_c${cRow.n}_${cRow.m}_s${sRow.n}_${sRow.m}_st${setRow.n}`;
}

// 统计辅助：count
async function count(db, sql, params) {
  const r = await db.prepare(sql).bind(...(params || [])).first();
  return r ? r.n : 0;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const version = await computeVersion(env);
  const url = new URL(request.url);
  const clientV = url.searchParams.get('v') || '';
  if (clientV && clientV === version) {
    return json({ ok: true, unchanged: true, version });
  }

  await ensureProductColumns(env);
  await ensureVariantColumns(env);

  // 1. 产品列表（第 1 页，默认无筛选）
  const pageSize = ADMIN_PAGE_SIZE;
  const countRes = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first();
  const total = countRes ? countRes.n : 0;
  const { results: prodRows } = await env.DB.prepare(
    'SELECT * FROM products ORDER BY sort ASC, id DESC LIMIT ? OFFSET 0'
  ).bind(pageSize).all();
  const products = await attachVariants(env, prodRows.map(cleanProduct));

  // 2. 分类列表
  const { results: catRows } = await env.DB.prepare(
    `SELECT c.id, c.name, c.sort, c.parent_id, c.is_hidden,
            (SELECT COUNT(*) FROM products p WHERE p.cid = c.id) AS cnt
     FROM categories c
     ORDER BY c.sort ASC, c.id ASC`
  ).all();
  let totalProducts = 0;
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first();
    totalProducts = row ? row.n : 0;
  } catch (e) {}
  const categories = (catRows || []).map((c) => {
    if (Number(c.id) === 0) c.cnt = totalProducts;
    return c;
  });

  // 3. 设置
  const { results: setRows } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of setRows) settings[r.key] = r.value;

  // 4. 统计（默认 1 天档，北京口径）
  const bjOffsetMs = 8 * 3600 * 1000;
  const todayBJ = new Date(Date.now() + bjOffsetMs).toISOString().slice(0, 10);
  const statsDateFilter = ` AND date(stats.created_at, '+8 hours') >= ? AND date(stats.created_at, '+8 hours') <= ?`;
  const statsDateParams = [todayBJ, todayBJ];

  await ensureBindingsTable(env);

  const [oViews, oContacts, oUnlocks, oBindings, byProductRes, trendRowsRes, recentRes, hourlyRowsRes] = await Promise.all([
    count(env.DB, `SELECT COUNT(*) AS n FROM stats WHERE stats.type = 'view'${statsDateFilter}`, statsDateParams),
    count(env.DB, `SELECT COUNT(*) AS n FROM stats WHERE stats.type = 'contact'${statsDateFilter}`, statsDateParams),
    count(env.DB, `SELECT COUNT(*) AS n FROM stats WHERE stats.type = 'resource_unlock'${statsDateFilter}`, statsDateParams),
    count(env.DB, 'SELECT COUNT(*) AS n FROM resource_bindings'),
    env.DB.prepare(
      `SELECT p.id, p.title, p.is_online, p.is_hidden,
              COALESCE(SUM(CASE WHEN s.type='view' THEN 1 ELSE 0 END),0) AS views,
              COALESCE(SUM(CASE WHEN s.type='contact' THEN 1 ELSE 0 END),0) AS contacts,
              COALESCE(SUM(CASE WHEN s.type='resource_unlock' THEN 1 ELSE 0 END),0) AS resource_unlocks,
              COALESCE((SELECT COUNT(*) FROM resource_bindings rb WHERE rb.product_id = p.id),0) AS bindings
       FROM products p
       LEFT JOIN stats s ON s.product_id = p.id${statsDateFilter.replace(/stats\.created_at/g, 's.created_at')}
       GROUP BY p.id
       ORDER BY views DESC, p.id DESC`
    ).bind(...statsDateParams).all(),
    env.DB.prepare(
      `SELECT date(stats.created_at, '+8 hours') AS day, stats.type, COUNT(*) AS cnt
       FROM stats
       WHERE 1=1${statsDateFilter}
       GROUP BY day, stats.type ORDER BY day ASC`
    ).bind(...statsDateParams).all(),
    env.DB.prepare(
      `SELECT s.id, s.type, s.created_at, p.title, p.img
       FROM stats s
       LEFT JOIN products p ON p.id = s.product_id
       WHERE s.created_at >= datetime('now', '-60 days')
       ORDER BY s.id DESC`
    ).all(),
    env.DB.prepare(
      `SELECT strftime('%H', stats.created_at, '+8 hours') AS hour, stats.type, COUNT(*) AS cnt
       FROM stats
       WHERE date(stats.created_at, '+8 hours') = ?
       GROUP BY hour, stats.type ORDER BY hour ASC`
    ).bind(todayBJ).all(),
  ]);

  const overview = { products: total, online: 0, hidden: 0, views: oViews, contacts: oContacts, resource_unlocks: oUnlocks, bindings: oBindings };
  try {
    const oRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE is_online = 1 AND is_hidden = 0').first();
    overview.online = oRow ? oRow.n : 0;
    const hRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE is_online = 0 OR is_hidden = 1').first();
    overview.hidden = hRow ? hRow.n : 0;
  } catch (e) {}

  const trendRows = trendRowsRes.results || [];
  const trend = [{
    day: todayBJ,
    views: trendRows.find((r) => r.day === todayBJ && r.type === 'view')?.cnt || 0,
    contacts: trendRows.find((r) => r.day === todayBJ && r.type === 'contact')?.cnt || 0,
    resource_unlocks: trendRows.find((r) => r.day === todayBJ && r.type === 'resource_unlock')?.cnt || 0,
  }];

  const hourlyRows = hourlyRowsRes.results || [];
  const hourly = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    const rows = hourlyRows.filter((r) => r.hour === hh);
    hourly.push({ hour: hh, views: rows.find((r) => r.type === 'view')?.cnt || 0, contacts: rows.find((r) => r.type === 'contact')?.cnt || 0, resource_unlocks: rows.find((r) => r.type === 'resource_unlock')?.cnt || 0 });
  }

  return json({
    ok: true,
    version,
    products: {
      list: products,
      total,
      page: 1,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize)
    },
    categories,
    settings,
    stats: {
      overview,
      overview_prev: { views: 0, contacts: 0, resource_unlocks: 0 },
      trend,
      trend_prev: [],
      byProduct: (byProductRes.results || []).map((r) => ({ id: r.id, title: r.title, is_online: r.is_online, is_hidden: r.is_hidden, views: r.views, contacts: r.contacts, resource_unlocks: r.resource_unlocks, bindings: r.bindings })),
      byCategory: [],
      recent: (recentRes.results || []).map((r) => ({ id: r.id, type: r.type, created_at: r.created_at, title: r.title || '(已删除)', img: r.img || '' })),
      hourly,
      hourly_prev: null,
    }
  });
}
