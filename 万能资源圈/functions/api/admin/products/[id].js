/**
 * PUT    /api/admin/products/:id   → 更新资源（含显示/隐藏 is_online）
 * DELETE /api/admin/products/:id   → 删除资源（同时删其类型和统计）
 * 均需登录
 */
import { json, requireAuth, readJSON, deleteBucketImages } from '../../../_utils.js';

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少资源 id' }, 400);

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
  if (!id) return json({ ok: false, msg: '缺少资源 id' }, 400);

  // R31-#7：删除资源前先取出图片字段，删除后联动清理图仓里的自有图片（外链图不归我们管，跳过）
  const row = await env.DB.prepare('SELECT img, detail, detail_images FROM products WHERE id = ?').bind(id).first();
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM product_variants WHERE product_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM stats WHERE product_id = ?').bind(id).run();
  if (row) await deleteBucketImages(env, [row.img, row.detail, row.detail_images]);

  return json({ ok: true });
}
