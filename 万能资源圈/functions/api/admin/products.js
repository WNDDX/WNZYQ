/**
 * GET  /api/admin/products        → 全部资源列表（含隐藏），管理后台用
 * POST /api/admin/products        → 新增资源（需登录）
 * body: { cid, title, desc, detail, img, detailImages[], detailVideos[], contactUrl, is_online, sort }
 * R303（09-30）：GET 支持分页按页拉取（page + page_size），支持筛选（kw / cid / status）
 */
import { json, requireAuth, readJSON, cleanProduct, cleanVariant, ensureVariantColumns, ensureProductColumns, ensureBindingsTable, ensureCodeIssuesTable, clearPublicCache } from '../../_utils.js';

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
  } catch (e) { console.error('R113 绑定计数批量查询失败（按0兜底）:', e && e.message); }
  await ensureCodeIssuesTable(env);
  const map = {};
  for (const v of (vrows || [])) {
    if (!map[v.product_id]) map[v.product_id] = [];
    map[v.product_id].push(Object.assign(cleanVariant(v), {
      bindings: bindMap[v.id] || 0,
    }));
  }
  list.forEach((p) => { p.variants = map[p.id] || []; });
  return list;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(0, Number(url.searchParams.get('page_size')) || 0));
  const kw = String(url.searchParams.get('kw') || '').trim().toLowerCase();
  const cid = String(url.searchParams.get('cid') || '0');
  const status = String(url.searchParams.get('status') || '');

  // 构建 WHERE 条件
  let where = 'WHERE 1=1';
  const params = [];

  if (kw) {
    where += ' AND (LOWER(title) LIKE ? OR LOWER("desc") LIKE ?)';
    params.push('%' + kw + '%', '%' + kw + '%');
  }

  if (cid && cid !== '0') {
    const catVal = Number(cid);
    // 检查是否一级分类（含子分类）
    const subRes = await env.DB.prepare('SELECT id FROM categories WHERE parent_id = ?').bind(catVal).all();
    const subIds = (subRes.results || []).map((r) => r.id);
    if (subIds.length > 0) {
      where += ' AND (cid = ? OR cid IN (' + subIds.map(() => '?').join(',') + '))';
      params.push(catVal, ...subIds);
    } else {
      where += ' AND cid = ?';
      params.push(catVal);
    }
  }

  if (status === 'online') {
    where += ' AND is_online = 1 AND is_hidden = 0';
  } else if (status === 'hidden') {
    where += ' AND (is_online = 0 OR is_hidden = 1)';
  }

  await ensureVariantColumns(env);

  // 不分页（page_size=0 或未传）：返回全部（兼容旧口径）
  if (pageSize === 0) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM products ' + where + ' ORDER BY sort ASC, id DESC'
    ).bind(...params).all();
    const list = await attachVariants(env, results.map(cleanProduct));
    return json({ ok: true, list: list, total: list.length });
  }

  // 分页查询
  const offset = (page - 1) * pageSize;
  const countRes = await env.DB.prepare('SELECT COUNT(*) AS n FROM products ' + where).bind(...params).first();
  const total = countRes ? countRes.n : 0;
  const { results } = await env.DB.prepare(
    'SELECT * FROM products ' + where + ' ORDER BY sort ASC, id DESC LIMIT ? OFFSET ?'
  ).bind(...params, pageSize, offset).all();

  return json({
    ok: true,
    list: await attachVariants(env, results.map(cleanProduct)),
    total: total,
    page: page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize)
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  await ensureProductColumns(env);
  const b = await readJSON(request);
  if (!String(b.title || '').trim()) return json({ ok: false, msg: '请填写资源标题' }, 400);

  var ci = b.cover_images;
  if (typeof ci === 'string') { try { ci = JSON.parse(ci); } catch (e) { ci = []; } }
  if (!Array.isArray(ci)) ci = [];
  ci = ci.filter(function (u) { return typeof u === 'string' && u.trim(); });
  const coverImages = JSON.stringify(ci);

  const detailImages = JSON.stringify(Array.isArray(b.detailImages) ? b.detailImages : []);
  const detailVideos = JSON.stringify(Array.isArray(b.detailVideos) ? b.detailVideos : []);

  const r = await env.DB.prepare(
    `INSERT INTO products (cid, title, "desc", detail, img, cover_images, detail_images, detail_videos, contact_url, price, is_online, is_hidden, schedule_on, schedule_off, sort)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      Number(b.cid) || 0,
      String(b.title || '').trim(),
      String(b.desc || ''),
      String(b.detail || ''),
      String(b.img || ''),
      coverImages,
      detailImages,
      detailVideos,
      String(b.contactUrl || ''),
      Number(b.price) || 0,
      b.is_online ? 1 : 0,
      b.is_hidden ? 1 : 0,
      b.schedule_on ? String(b.schedule_on) : null,
      b.schedule_off ? String(b.schedule_off) : null,
      Number(b.sort) || 0
    )
    .run();

  /* v333：新增资源后立刻清掉前台公开接口缓存 —— 否则访客那边最长要等 20 秒才看得到新资源 */
  try { await clearPublicCache(request); } catch (e) {}

  return json({ ok: true, id: r.meta.last_row_id });
}
