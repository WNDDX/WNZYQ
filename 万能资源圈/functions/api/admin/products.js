/**
 * GET  /api/admin/products        → 全部资源列表（含下架），管理后台用
 * POST /api/admin/products        → 新增资源（需登录）
 * body: { cid, title, desc, detail, img, detailImages[], detailVideos[], contactUrl, is_online, sort }
 */
import { json, requireAuth, readJSON, cleanProduct, cleanVariant, ensureVariantColumns, ensureProductColumns } from '../../_utils.js';

// 给资源列表批量挂上各自的类型（后台需要看到类型/资源码状态、导出资源类型表）
async function attachVariants(env, list) {
  if (!list || !list.length) return list;
  const ids = list.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const { results: vrows } = await env.DB.prepare(
    `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY sort ASC, id ASC`
  ).bind(...ids).all();
  const map = {};
  (vrows || []).forEach((v) => {
    if (!map[v.product_id]) map[v.product_id] = [];
    map[v.product_id].push(cleanVariant(v));
  });
  list.forEach((p) => { p.variants = map[p.id] || []; });
  return list;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  // page_size=0 或未传 → 返回全部（管理后台一次展示所有资源）
  const pageSize = Math.min(100, Math.max(0, Number(url.searchParams.get('page_size')) || 0));

  // 不分页（page_size=0 或未传）：返回全部
  if (pageSize === 0) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM products ORDER BY sort ASC, id DESC'
    ).all();
    await ensureProductColumns(env);
    await ensureVariantColumns(env);
    const list = await attachVariants(env, results.map(cleanProduct));
    return json({ ok: true, list: list, total: list.length });
  }

  // 分页查询
  const offset = (page - 1) * pageSize;
  await ensureVariantColumns(env);
  const countRes = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first();
  const total = countRes ? countRes.n : 0;
  const { results } = await env.DB.prepare(
    'SELECT * FROM products ORDER BY sort ASC, id DESC LIMIT ? OFFSET ?'
  ).bind(pageSize, offset).all();

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

  const detailImages = JSON.stringify(Array.isArray(b.detailImages) ? b.detailImages : []);
  const detailVideos = JSON.stringify(Array.isArray(b.detailVideos) ? b.detailVideos : []);

  const r = await env.DB.prepare(
    `INSERT INTO products (cid, title, "desc", detail, img, detail_images, detail_videos, contact_url, price, is_online, is_hidden, schedule_on, schedule_off, sort)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      Number(b.cid) || 0,
      String(b.title || '').trim(),
      String(b.desc || ''),
      String(b.detail || ''),
      String(b.img || ''),
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

  return json({ ok: true, id: r.meta.last_row_id });
}
