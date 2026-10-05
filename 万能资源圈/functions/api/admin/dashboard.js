/**
 * GET /api/admin/dashboard
 * 管理后台首屏聚合接口（v313）：一次请求带回四屏首屏所需数据
 * 只包含轻量查询：产品列表第1页 + 分类列表 + 设置 + stats 总览 COUNT
 * 重的统计明细（byProduct/trend/recent/hourly）留给用户切到 stats tab 时通过 admin/stats 拉取
 * 带版本号：客户端传 ?v=lastVersion，没变则返回 { unchanged: true }
 */
import { json, requireAuth, cleanProduct, cleanVariant, ensureVariantColumns, ensureProductColumns, ensureBindingsTable } from '../../_utils.js';

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
  } catch (e) { /* 绑定计数失败按0兜底 */ }
  const map = {};
  for (const v of (vrows || [])) {
    if (!map[v.product_id]) map[v.product_id] = [];
    map[v.product_id].push(Object.assign(cleanVariant(v), { bindings: bindMap[v.id] || 0 }));
  }
  list.forEach((p) => { p.variants = map[p.id] || []; });
  return list;
}

// 计算数据版本（Beijing 时间口径）
async function computeVersion(env) {
  const [pRow, cRow, sRow, setRow] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(updated_at),'') AS m FROM products").first(),
    // v313：categories 表无 created_at，用 MAX(id) 反映增删变化
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(id),'') AS m FROM categories").first(),
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(created_at),'') AS m FROM stats").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM settings").first(),
  ]);
  return `a${pRow.n}_${pRow.m}_c${cRow.n}_${cRow.m}_s${sRow.n}_${sRow.m}_st${setRow.n}`;
}

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

  const pageSize = ADMIN_PAGE_SIZE;
  const bjOffsetMs = 8 * 3600 * 1000;
  const todayBJ = new Date(Date.now() + bjOffsetMs).toISOString().slice(0, 10);

  // v313：全部子查询并行——只保留首屏真正需要的轻量数据
  // stats 仅保留 overview COUNT（六卡数字），去掉 byProduct/trend/recent/hourly 等重查询
  const [countRes, { results: prodRows }, { results: catRows }, { results: setRows },
    oProducts, oOnline, oHidden, oViews, oContacts, oUnlocks, oBindings] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM products').first(),
    env.DB.prepare('SELECT * FROM products ORDER BY sort ASC, id DESC LIMIT ? OFFSET 0').bind(pageSize).all(),
    env.DB.prepare(
      `SELECT c.id, c.name, c.sort, c.parent_id, c.is_hidden,
              (SELECT COUNT(*) FROM products p WHERE p.cid = c.id) AS cnt
       FROM categories c
       ORDER BY c.sort ASC, c.id ASC`
    ).all(),
    env.DB.prepare('SELECT key, value FROM settings').all(),
    count(env.DB, 'SELECT COUNT(*) AS n FROM products'),
    count(env.DB, 'SELECT COUNT(*) AS n FROM products WHERE is_online = 1 AND is_hidden = 0'),
    count(env.DB, 'SELECT COUNT(*) AS n FROM products WHERE is_online = 0 OR is_hidden = 1'),
    count(env.DB, `SELECT COUNT(*) AS n FROM stats WHERE type = 'view' AND date(created_at, '+8 hours') >= ? AND date(created_at, '+8 hours') <= ?`, [todayBJ, todayBJ]),
    count(env.DB, `SELECT COUNT(*) AS n FROM stats WHERE type = 'contact' AND date(created_at, '+8 hours') >= ? AND date(created_at, '+8 hours') <= ?`, [todayBJ, todayBJ]),
    count(env.DB, `SELECT COUNT(*) AS n FROM stats WHERE type = 'resource_unlock' AND date(created_at, '+8 hours') >= ? AND date(created_at, '+8 hours') <= ?`, [todayBJ, todayBJ]),
    count(env.DB, 'SELECT COUNT(*) AS n FROM resource_bindings'),
  ]);

  const total = countRes ? countRes.n : 0;
  const products = await attachVariants(env, prodRows.map(cleanProduct));

  let totalProducts = 0;
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first();
    totalProducts = row ? row.n : 0;
  } catch (e) {}
  const categories = (catRows || []).map((c) => {
    if (Number(c.id) === 0) c.cnt = totalProducts;
    return c;
  });

  const settings = {};
  for (const r of setRows) settings[r.key] = r.value;

  const overview = {
    products: oProducts,
    online: oOnline,
    hidden: oHidden,
    views: oViews,
    contacts: oContacts,
    resource_unlocks: oUnlocks,
    bindings: oBindings,
  };

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
      // v313：首屏不返回重统计明细，留给 admin/stats 按需拉取
    }
  });
}
