/**
 * POST /api/admin/batch
 * 批量操作资源（需登录）
 * body: { ids: [1,2,3], action: 'online'|'offline'|'hide'|'show'|'delete'|'changeCat'|'changePrice', cid?: number, price?: number }
 *   online      批量显示（资源页可见，同时清掉隐藏标记）
 *   offline     批量隐藏（资源页不显示）
 *   hide/show   旧版动作，保留兼容（前端现已统一走 online/offline 两态）
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

  if (ids.length === 0) return json({ ok: false, msg: '请选择资源' }, 400);
  if (!['online', 'offline', 'hide', 'show', 'delete', 'changeCat', 'changePrice'].includes(action)) {
    return json({ ok: false, msg: '未知操作' }, 400);
  }

  const placeholders = ids.map(() => '?').join(',');

  if (action === 'delete') {
    // 性能：三条删除并行执行（原先串行三次 D1 往返），批量删除耗时约降为 1/3
    await Promise.all([
      env.DB.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).bind(...ids).run(),
      env.DB.prepare(`DELETE FROM product_variants WHERE product_id IN (${placeholders})`).bind(...ids).run(),
      env.DB.prepare(`DELETE FROM stats WHERE product_id IN (${placeholders})`).bind(...ids).run(),
    ]);
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
  } else if (action === 'online') {
    // 两态：显示 = is_online=1 且清掉 is_hidden（旧隐藏数据也能真正显示）
    await env.DB.prepare(
      `UPDATE products SET is_online = 1, is_hidden = 0, updated_at = datetime('now') WHERE id IN (${placeholders})`
    ).bind(...ids).run();
  } else if (action === 'offline') {
    // 两态：隐藏 = is_online=0 且清掉 is_hidden
    await env.DB.prepare(
      `UPDATE products SET is_online = 0, is_hidden = 0, updated_at = datetime('now') WHERE id IN (${placeholders})`
    ).bind(...ids).run();
  } else {
    // hide/show：旧版动作兼容（前端已不再调用）
    const val = action === 'show' ? 1 : 0;
    await env.DB.prepare(
      `UPDATE products SET is_hidden = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
    ).bind(val, ...ids).run();
  }

  return json({ ok: true, count: ids.length });
}
