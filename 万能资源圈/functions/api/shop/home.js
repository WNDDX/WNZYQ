/**
 * GET /api/shop/home
 * 前台首页聚合接口（R308）：一次返回首屏全部数据
 * 带版本号：客户端传 ?v=lastVersion，没变则返回 { unchanged: true }
 */
import { cleanProduct, cleanVariantPublic, ensureProductColumns, ensureSoftDelete, ensureVariantColumns, json, publicAnnouncements } from '../../_utils.js'; // v299（用户 10-04 23:11）：修复引用层级错误致 Cloudflare 构建失败

// v317（用户 10-05 18:40）：根因→老板拍板规则1/2/3/4+优化2/3/4，v315全量返回需改回首屏只拿第一页，翻页/切分类/搜索点到才拉；修法→恢复20条分页，首屏一趟拿第一页+分类+设置，其余前端按需拉取。
/* v383：+ group_url/contact_qr/group_qr/gzh_qr——客服/群聊链接与三张二维码全量走设置值 */
const PUBLIC_KEYS = ['shop_name', 'shop_logo', 'contact_url', 'group_url', 'contact_qr', 'group_qr', 'gzh_qr', 'announcement', 'announcement_mode', 'announcements', 'resource_bind_limit'];
const HOME_PAGE_SIZE = 20;

/* v631U（老板 09:28 拍板：有备无患，提前加固）——本接口是全站唯一"每次访问都真打 D1"的入口，
   而它内部要跑 3 个 COUNT：商品总数是 O(资源数) 的全表计数。
   资源到 2000 条时，每天约 1000 次访问就会吃满 D1 免费额度（500 万行/天）。
   这里按 /api/products 已有的做法加 20 秒边缘缓存：
     · 命中缓存时一次 D1 都不打（连版本号都不算）
     · 冷路径把 3 个 COUNT 合成 1 条 SQL（3 次往返 → 1 次）
   ⚠ 缓存键刻意不带 ?v= —— 否则每个客户端版本各存一份，命中率崩掉，
     而且可能把「unchanged」响应喂给新访客（那是空数据）。
   代价：后台改完最多 20 秒才在前台看到，与 /api/products 的 20 秒完全一致。 */
const CACHE_TTL = 20;

function cacheKeyFor(url) {
  /* 固定键：只用 origin，不带任何查询参数 */
  return new Request(new URL('/__cf_home_cache_v631u', url.origin).toString(), { method: 'GET' });
}

async function readFullCache(url) {
  try {
    const hit = await caches.default.match(cacheKeyFor(url));
    return hit || null;
  } catch (e) { return null; }
}

// 计算数据版本（ Beijing 时间口径，与 U8 统一 ）
/* 原来 3 条独立 SQL 并行发；现在合成 1 条，语义完全不变（3 个标量子查询） */
async function computeVersion(env) {
  try {
    const row = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) AS pn,
         (SELECT COALESCE(MAX(updated_at), '') FROM products WHERE deleted_at IS NULL) AS pm,
         (SELECT COUNT(*) FROM categories WHERE is_hidden = 0 AND deleted_at IS NULL) AS cn,
         (SELECT COUNT(*) FROM settings) AS sn`
    ).first();
    if (row) return `p${row.pn}_${row.pm}_c${row.cn}_s${row.sn}`;
  } catch (e) { /* 落到下面的兜底 */ }
  /* 兜底：查不动就每次当新版本——宁可多传数据，也不给前端"没变"的错觉 */
  return 'nb_' + Date.now();
}

export async function onRequestGet(context) {
  const { request, env } = context;

  await ensureSoftDelete(env); /* v440：先迁移软删列（线上旧库无此列，缺它接口 500） */
  /* v339 条225：原来 9 次串行查库（每次一个跨区域来回）导致进页接口首字节 2.5 秒+。
     改为 4 轮并行——第 1 轮把互不依赖的查询全部同时发出，实测首字节显著下降。 */
  const url = new URL(request.url);
  const clientV = url.searchParams.get('v') || '';

  /* v631U：命中边缘缓存就直接回，一次 D1 都不打（连版本号都不算）。
     这是"资源变多不再变贵"的关键——成本从「每次访问 × 资源数」降到「每 20 秒 × 资源数」。 */
  const cached = await readFullCache(url);
  if (cached) {
    try {
      const body = await cached.text();
      const j = JSON.parse(body);
      if (j && j.ok === true && j.version) {
        if (clientV && j.version === clientV) {
          /* 「没变化」这条绝不能带 max-age：否则新访客可能收到空数据 */
          return json({ ok: true, unchanged: true, version: j.version }, 200, { 'Cache-Control': 'no-store' }, request);
        }
        return new Response(body, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'public, max-age=' + CACHE_TTL,
            'X-Home-Cache': 'hit',   /* 诊断用：确认边缘缓存是否生效 */
          },
        });
      }
    } catch (e) { /* 缓存内容损坏 → 当未命中，走下面真实查询 */ }
  }

  // 第 1 轮（并行）：版本指纹 + 定时预检 + 列迁移 + 分类 + 设置
  const [version, pre, , catRes, setRes] = await Promise.all([
    computeVersion(env),
    env.DB.prepare(
      `SELECT
         EXISTS(SELECT 1 FROM products WHERE is_online = 0 AND schedule_on IS NOT NULL AND schedule_on <= datetime('now', '+8 hours') AND deleted_at IS NULL) AS need_show,
         EXISTS(SELECT 1 FROM products WHERE is_online = 1 AND schedule_off IS NOT NULL AND schedule_off <= datetime('now', '+8 hours') AND deleted_at IS NULL) AS need_hide`
    ).first().catch(() => null),
    (async () => { await ensureProductColumns(env); await ensureVariantColumns(env); })().catch(() => {}),
    env.DB.prepare('SELECT id, name, sort, parent_id, is_hidden FROM categories WHERE is_hidden = 0 AND deleted_at IS NULL ORDER BY sort ASC, id ASC').all().catch(() => ({ results: [] })),
    env.DB.prepare('SELECT key, value FROM settings').all().catch(() => ({ results: [] })),
  ]);

  if (clientV && clientV === version) {
    return json({ ok: true, unchanged: true, version }, 200, { 'Cache-Control': 'no-store' }, request);
  }

  // 第 2 轮：定时显示/隐藏（绝大多数请求是空操作，有需要才写库）
  try {
    if (pre && pre.need_show) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 1, is_hidden = 0, updated_at = datetime('now')
         WHERE is_online = 0 AND schedule_on IS NOT NULL AND schedule_on <= datetime('now', '+8 hours') AND deleted_at IS NULL` /* v440：定时上线不碰数据缓存中的资源 */
      ).run();
    }
    if (pre && pre.need_hide) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 0, updated_at = datetime('now')
         WHERE is_online = 1 AND schedule_off IS NOT NULL AND schedule_off <= datetime('now', '+8 hours') AND deleted_at IS NULL`
      ).run();
    }
  } catch (e) {}

  // 第 3 轮（并行）：总数 + 第一页资源
  const [countRes, prodRes] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE is_online = 1 AND is_hidden = 0 AND deleted_at IS NULL').first(),
    env.DB.prepare(
      'SELECT * FROM products WHERE is_online = 1 AND is_hidden = 0 AND deleted_at IS NULL ORDER BY sort ASC, id DESC LIMIT ? OFFSET ?'
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
    if (PUBLIC_KEYS.indexOf(r.key) !== -1) settings[r.key] = r.key === 'announcements' ? publicAnnouncements(r.value) : r.value; /* #68：软删公告不下发公开端 */
  }

  // v317（用户 10-05 18:40）：首屏返回第一页分页元数据，前端按后端分页口径渲染
  const payload = {
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
  };
  const res = json(payload, 200, { 'Cache-Control': 'public, max-age=' + CACHE_TTL, 'X-Home-Cache': 'miss' }, request);
  /* v631U：写边缘缓存（waitUntil，不拖慢响应）。只缓存成功构造的完整数据，
     「unchanged」那条在更上面就返回了，不会进这里。 */
  try { context.waitUntil(caches.default.put(cacheKeyFor(url), res.clone())); } catch (e) {}
  return res;
}
