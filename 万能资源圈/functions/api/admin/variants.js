/**
 * 资源类型管理（需登录）
 * GET  /api/admin/variants?product_id=xxx  → 某资源的类型列表
 * POST /api/admin/variants                   → 新增类型
 * body: { productId, name, desc, img, video, contactUrl, sort }
 */
import { json, requireAuth, readJSON, cleanVariant } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const productId = Number(url.searchParams.get('product_id') || 0);
  if (!productId) return json({ ok: false, msg: '缺少 product_id' }, 400);

  const { results } = await env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort ASC, id ASC'
  ).bind(productId).all();

  return json({ ok: true, list: results.map(cleanVariant) });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const productId = Number(b.productId) || 0;
  const name = String(b.name || '').trim();
  if (!productId) return json({ ok: false, msg: '缺少资源 id' }, 400);
  if (!name) return json({ ok: false, msg: '请填写类型名称' }, 400);

  const r = await env.DB.prepare(
    `INSERT INTO product_variants (product_id, name, "desc", img, video, contact_url, price, sort)
     VALUES (?,?,?,?,?,?,?,?)`
  )
    .bind(
      productId,
      name,
      String(b.desc || ''),
      String(b.img || ''),
      String(b.video || ''),
      String(b.contactUrl || ''),
      Number(b.price) || 0,
      Number(b.sort) || 0
    )
    .run();

  return json({ ok: true, id: r.meta.last_row_id });
}
