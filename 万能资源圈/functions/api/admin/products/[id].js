/**
 * PUT    /api/admin/products/:id   → 更新商品（含上下架 is_online）
 * DELETE /api/admin/products/:id   → 删除商品（同时删其类型和统计）
 * 均需登录
 */
import { json, requireAuth, readJSON } from '../../_utils.js';

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少商品 id' }, 400);

  const b = await readJSON(request);
  const detailImages = JSON.stringify(Array.isArray(b.detailImages) ? b.detailImages : []);
  const detailVideos = JSON.stringify(Array.isArray(b.detailVideos) ? b.detailVideos : []);

  await env.DB.prepare(
    `UPDATE products SET cid=?, title=?, "desc"=?, detail=?, img=?,
       detail_images=?, detail_videos=?, contact_url=?, price=?, is_online=?, is_hidden=?,
       schedule_on=?, schedule_off=?, sort=?,
       updated_at=datetime('now') WHERE id=?`
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
      Number(b.sort) || 0,
      id
    )
    .run();

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少商品 id' }, 400);

  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM product_variants WHERE product_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM stats WHERE product_id = ?').bind(id).run();

  return json({ ok: true });
}
