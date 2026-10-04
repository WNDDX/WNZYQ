/**
 * GET    /api/admin/products/:id   → 单条资源详情（含类型，编辑回显用）
 * PUT    /api/admin/products/:id   → 更新资源（含显示/隐藏 is_online）
 * DELETE /api/admin/products/:id   → 删除资源（同时删其类型和统计）
 * 均需登录
 */
import { json, requireAuth, readJSON, deleteBucketImages, cleanProduct, cleanVariant, clearPublicCache } from '../../../_utils.js';

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少资源 id' }, 400);

  const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!row) return json({ ok: false, msg: '资源不存在' }, 404);

  const { results: vrows } = await env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort ASC, id ASC'
  ).bind(id).all();

  const product = cleanProduct(row);
  product.variants = (vrows || []).map(cleanVariant);
  return json({ ok: true, product });
}

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少资源 id' }, 400);

  const b = await readJSON(request);

  // v294（用户 10-04 02:14）：211 并发编辑乐观锁——读取当前 updated_at，与前端传来的比对
  const currentRow = await env.DB.prepare('SELECT updated_at FROM products WHERE id = ?').bind(id).first();
  if (!currentRow) return json({ ok: false, msg: '资源不存在' }, 404);
  const clientUpdatedAt = String(b.updated_at || '').trim();
  const dbUpdatedAt = String(currentRow.updated_at || '').trim();
  if (clientUpdatedAt && dbUpdatedAt && clientUpdatedAt !== dbUpdatedAt) {
    return json({ ok: false, msg: '该资源已被修改，请刷新后重试' }, 409);
  }

  // R270（用户 09-27 17:30）：根因→前端发 JSON 字符串，服务端只认数组 → cover_images 永远存 "[]"
  // 修法→兼容字符串/数组两种格式，先 parse 再过滤空串/非字符串项
  var ci = b.cover_images;
  if (typeof ci === 'string') { try { ci = JSON.parse(ci); } catch (e) { ci = []; } }
  if (!Array.isArray(ci)) ci = [];
  ci = ci.filter(function (u) { return typeof u === 'string' && u.trim(); });
  const coverImages = JSON.stringify(ci);

  const detailImages = JSON.stringify(Array.isArray(b.detailImages) ? b.detailImages : []);
  const detailVideos = JSON.stringify(Array.isArray(b.detailVideos) ? b.detailVideos : []);

  await env.DB.prepare(
    `UPDATE products SET cid=?, title=?, "desc"=?, detail=?, img=?,
       cover_images=?, detail_images=?, detail_videos=?, contact_url=?, price=?, is_online=?, is_hidden=?,
       schedule_on=?, schedule_off=?, sort=?,
       updated_at=datetime('now') WHERE id=?`
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
      Number(b.sort) || 0,
      id
    )
    .run();

  await clearPublicCache(request);
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少资源 id' }, 400);

  // R31-#7：删除资源前先取出图片字段，删除后联动清理图仓里的自有图片（外链图不归我们管，跳过）
  // R36：清理范围扩到详情视频 + 类型（desc/img/video/resource_code 之外的富文本字段）
  const row = await env.DB.prepare('SELECT img, detail, detail_images, detail_videos FROM products WHERE id = ?').bind(id).first();
  const vrows = await env.DB.prepare('SELECT "desc", img, video, resource_content FROM product_variants WHERE product_id = ?').bind(id).all();
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM product_variants WHERE product_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM stats WHERE product_id = ?').bind(id).run();
  const sources = [];
  if (row) sources.push(row.img, row.detail, row.detail_images, row.detail_videos);
  (vrows.results || []).forEach(function (v) { sources.push(v.desc, v.img, v.video, v.resource_content); });
  if (sources.length) await deleteBucketImages(env, sources);

  await clearPublicCache(request);
  return json({ ok: true });
}
