/**
 * POST /api/admin/batch
 * 批量操作商品（需登录）
 * body: { ids: [1,2,3], action: 'online'|'offline'|'hide'|'show'|'delete'|'changeCat'|'changePrice', cid?: number, price?: number }
 *   online      批量上架
 *   offline     批量下架
 *   hide        批量隐藏（前台不显示）
 *   show        批量取消隐藏
 *   delete      批量删除（同时删类型和统计）
 *   changeCat   批量改分类（需 cid）
 *   changePrice 批量改价格（需 price）
 */
import { json, requireAuth, readJSON } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(Boolean) : [];
  const action = String(b.action || '');

  if (ids.length === 0) return json({ ok: false, msg: '请选择商品' }, 400);
  if (!['online', 'offline', 'hide', 'show', 'delete', 'changeCat', 'changePrice'].includes(action)) {
    return json({ ok: false, msg: '未知操作' }, 400);
  }

  const placeholders = ids.map(() => '?').join(',');

  if (action === 'delete') {
    await env.DB.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).bind(...ids).run();
    await env.DB.prepare(`DELETE FROM product_variants WHERE product_id IN (${placeholders})`).bind(...ids).run();
    await env.DB.prepare(`DELETE FROM stats WHERE product_id IN (${placeholders})`).bind(...ids).run();
  } else if (action === 'changeCat') {
    const cid = Number(b.cid);
    if (isNaN(cid)) return json({ ok: false, msg: '请提供分类ID' }, 400);
    await env.DB.prepare(
      `UPDATE products SET cid = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
    ).bind(cid, ...ids).run();
  } else if (action === 'changePrice') {
    const price = Number(b.price);
    if (isNaN(price) || price < 0) return json({ ok: false, msg: '请提供有效价格' }, 400);
    await env.DB.prepare(
      `UPDATE products SET price = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
    ).bind(price, ...ids).run();
  } else {
    const field = action === 'online' || action === 'offline' ? 'is_online' : 'is_hidden';
    const val = (action === 'online' || action === 'show') ? 1 : 0;
    await env.DB.prepare(
      `UPDATE products SET ${field} = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
    ).bind(val, ...ids).run();
  }

  return json({ ok: true, count: ids.length });
}
