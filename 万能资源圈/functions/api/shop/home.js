/**
 * GET /api/shop/home
 * 前台首页聚合接口（R308）：一次返回首屏全部数据
 * 带版本号：客户端传 ?v=lastVersion，没变则返回 { unchanged: true }
 */
import { json, cleanProduct, cleanVariantPublic, ensureVariantColumns, ensureProductColumns } from '../../_utils.js'; // v299（用户 10-04 23:11）：修复引用层级错误致 Cloudflare 构建失败

// v317（用户 10-05 18:40）：根因→老板拍板规则1/2/3/4+优化2/3/4，v315全量返回需改回首屏只拿第一页，翻页/切分类/搜索点到才拉；修法→恢复20条分页，首屏一趟拿第一页+分类+设置，其余前端按需拉取。
const PUBLIC_KEYS = ['shop_name', 'shop_logo', 'contact_url', 'announcement', 'announcement_mode', 'announcements', 'resource_bind_limit'];
const HOME_PAGE_SIZE = 20;

// 计算数据版本（ Beijing 时间口径，与 U8 统一 ）
async function computeVersion(env) {
  const [pRow, cRow, setRow] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(updated_at),'') AS m FROM products").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM categories WHERE is_hidden = 0").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM settings").first(),
  ]);
  return `p${pRow.n}_${pRow.m}_c${cRow.n}_s${setRow.n}`;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  /* v339 条225：原来 9 次串行查库（每次一个跨区域来回）导致进页接口首字节 2.5 秒+。
     改为 4 轮并行——第 1 轮把互不依赖的查询全部同时发出，实测首字节显著下降。 */
  // 第 1 轮（并行）：版本指纹 + 定时预检 + 列迁移 + 分类 + 设置
  const [version, pre, , catRes, setRes] = await Promise.all([
    computeVersion(env),
    env.DB.prepare(
      `SELECT
         EXISTS(SELECT 1 FROM products WHERE is_online = 0 AND schedule_on IS NOT NULL AND schedule_on <= datetime('now', '+8 hours')) AS need_show,
         EXISTS(SELECT 1 FROM products WHERE is_online = 1 AND schedule_off IS NOT NULL AND schedule_off <= datetime('now', '+8 hours')) AS need_hide`
    ).first().catch(() => null),
    (async () => { await ensureProductColumns(env); await ensureVariantColumns(env); })().catch(() => {}),
    env.DB.prepare('SELECT id, name, sort, parent_id, is_hidden FROM categories WHERE is_hidden = 0 ORDER BY sort ASC, id ASC').all().catch(() => ({ results: [] })),
    env.DB.prepare('SELECT key, value FROM settings').all().catch(() => ({ results: [] })),
  ]);

  const url = new URL(request.url);
  const clientV = url.searchParams.get('v') || '';
  if (clientV && clientV === version) {
    return json({ ok: true, unchanged: true, version });
  }

  // 第 2 轮：定时显示/隐藏（绝大多数请求是空操作，有需要才写库）
  try {
    if (pre && pre.need_show) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 1, is_hidden = 0, updated_at = datetime('now')
         WHERE is_online = 0 AND schedule_on IS NOT NULL AND schedule_on <= datetime('now', '+8 hours')`
      ).run();
    }
    if (pre && pre.need_hide) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 0, updated_at = datetime('now')
         WHERE is_online = 1 AND schedule_off IS NOT NULL AND schedule_off <= datetime('now', '+8 hours')`
      ).run();
    }
  } catch (e) {}

  // 第 3 轮（并行）：总数 + 第一页资源
  const [countRes, prodRes] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE is_online = 1 AND is_hidden = 0').first(),
    env.DB.prepare(
      'SELECT * FROM products WHERE is_online = 1 AND is_hidden = 0 ORDER BY sort ASC, id DESC LIMIT ? OFFSET ?'
    ).bind(HOME_PAGE_SIZE, 0).all(),
  ]);
  const total = countRes ? countRes.n : 0;
  const prodRows = prodRes.results || [];

  // 第 4 轮：类型（依赖资源 id 列表）
  const ids = prodRows.map((p) => p.id);
  let variantsByProduct = {};
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const { results: vrows } = await env.DB.prepare(
      `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY sort ASC, id ASC`
    ).bind(...ids).all();
    for (const v of vrows) {
      if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
      if (v.is_hidden) continue;
      variantsByProduct[v.product_id].push(cleanVariantPublic(v));
    }
  }
  const products = prodRows.map((p) => {
    const item = cleanProduct(p);
    item.variants = variantsByProduct[p.id] || [];
    return item;
  });

  const categories = catRes.results || [];
  const settings = {};
  for (const r of (setRes.results || [])) {
    if (PUBLIC_KEYS.indexOf(r.key) !== -1) settings[r.key] = r.value;
  }

  // v317（用户 10-05 18:40）：首屏返回第一页分页元数据，前端按后端分页口径渲染
  return json({
    ok: true,
    version,
    products: {
      list: products,
      total,
      page: 1,
      page_size: HOME_PAGE_SIZE,
      total_pages: Math.ceil(total / HOME_PAGE_SIZE)
    },
    categories,
    settings
  });
}
