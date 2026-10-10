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
import { json, requireAuth, readJSON, deleteBucketImages } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(Boolean) : [];
  const action = String(b.action || '');

  if (ids.length === 0) return json({ ok: false, msg: '请选择资源' }, 400);
  // R307（用户 09-30）：单次批量操作最多 500 条的限制已取消，不再做条数限制；
  // 底层单次执行机制（placeholders + 事务）保持不变
  if (!['online', 'offline', 'hide', 'show', 'delete', 'changeCat', 'changePrice'].includes(action)) {
    return json({ ok: false, msg: '未知操作' }, 400);
  }

  /* v348 条30：不设条数上限（按老板要求），但一条 SQL 能带的变量有上限——
     一次塞几千个 id 会整批报错。现在按 200 条一批拆分执行，选多少都能稳稳做完。 */
  const CHUNK = 200;
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  const ph = (arr) => arr.map(() => '?').join(',');

  if (action === 'delete') {
    // R31-#7：批量删除前先取出图片字段，删除后联动清理图仓里的自有图片
    // R36：清理范围扩到详情视频 + 类型富文本字段
    const sources = [];
    try {
      for (const c of chunks) {
        const p = ph(c);
        const { results: imgRows } = await env.DB.prepare(`SELECT img, detail, detail_images, detail_videos FROM products WHERE id IN (${p})`).bind(...c).all();
        const { results: vRows } = await env.DB.prepare(`SELECT "desc", img, video, resource_content FROM product_variants WHERE product_id IN (${p})`).bind(...c).all();
        for (const r of (imgRows || [])) sources.push(r.img, r.detail, r.detail_images, r.detail_videos);
        for (const v of (vRows || [])) sources.push(v.desc, v.img, v.video, v.resource_content);
      }
    } catch (e) { console.error('批量删除取媒体字段失败(不影响删除):', e); }
    // 逐批删除（每批内三条并行）；全部删完再清图仓
    for (const c of chunks) {
      const p = ph(c);
      await Promise.all([
        env.DB.prepare(`DELETE FROM products WHERE id IN (${p})`).bind(...c).run(),
        env.DB.prepare(`DELETE FROM product_variants WHERE product_id IN (${p})`).bind(...c).run(),
        env.DB.prepare(`DELETE FROM stats WHERE product_id IN (${p})`).bind(...c).run(),
      ]);
    }
    if (sources.length) await deleteBucketImages(env, sources);
  } else if (action === 'changeCat') {
    const cid = Number(b.cid);
    if (isNaN(cid)) return json({ ok: false, msg: '请提供分类ID' }, 400);
    for (const c of chunks) {
      await env.DB.prepare(
        `UPDATE products SET cid = ?, updated_at = datetime('now') WHERE id IN (${ph(c)})`
      ).bind(cid, ...c).run();
    }
  } else if (action === 'changePrice') {
    const price = Number(b.price);
    if (isNaN(price) || price < 0) return json({ ok: false, msg: '请提供有效价格' }, 400);
    for (const c of chunks) {
      await env.DB.prepare(
        `UPDATE products SET price = ?, updated_at = datetime('now') WHERE id IN (${ph(c)})`
      ).bind(price, ...c).run();
    }
  } else if (action === 'online') {
    // 两态：显示 = is_online=1 且清掉 is_hidden（旧隐藏数据也能真正显示）
    for (const c of chunks) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 1, is_hidden = 0, updated_at = datetime('now') WHERE id IN (${ph(c)})`
      ).bind(...c).run();
    }
  } else if (action === 'offline') {
    // 两态：隐藏 = is_online=0 且清掉 is_hidden
    for (const c of chunks) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 0, is_hidden = 0, updated_at = datetime('now') WHERE id IN (${ph(c)})`
      ).bind(...c).run();
    }
  } else {
    // hide/show：旧版动作兼容（前端已不再调用）
    const val = action === 'show' ? 1 : 0;
    for (const c of chunks) {
      await env.DB.prepare(
        `UPDATE products SET is_hidden = ?, updated_at = datetime('now') WHERE id IN (${ph(c)})`
      ).bind(val, ...c).run();
    }
  }

  return json({ ok: true, count: ids.length });
}
