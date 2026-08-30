/**
 * GET  /api/admin/products        → 全部资源列表（含下架），管理后台用
 * POST /api/admin/products        → 新增资源（需登录）
 * body: { cid, title, desc, detail, img, detailImages[], detailVideos[], contactUrl, is_online, sort }
 */
import { json, requireAuth, readJSON, cleanProduct } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size')) || 0));

  // 不分页（page_size=0 或未传）：返回全部
  if (pageSize === 0) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM products ORDER BY sort ASC, id DESC'
    ).all();
    return json({ ok: true, list: results.map(cleanProduct), total: results.length });
  }

  // 分页查询
  const offset = (page - 1) * pageSize;
  const countRes = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first();
  const total = countRes ? countRes.n : 0;
  const { results } = await env.DB.prepare(
    'SELECT * FROM products ORDER BY sort ASC, id DESC LIMIT ? OFFSET ?'
  ).bind(pageSize, offset).all();

  return json({
    ok: true,
    list: results.map(cleanProduct),
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
