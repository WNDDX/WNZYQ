/**
 * GET /api/products
 * 返回所有【上架中】的商品（公开接口，前台用）
 * 每个商品同时带上其类型列表（variants），前台详情弹窗直接用
 * 分类/搜索过滤由前台完成
 * 带 5 分钟缓存（Cache API），管理员修改后自动失效
 */
import { json, cleanProduct, cleanVariant } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cacheUrl = new URL(request.url);
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  // 1. 尝试读缓存
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, cached);
  }

  // 2. 定时上下架检查：到了上架时间自动上架，到了下架时间自动下架
  // 注意：用户输入的是本地时间（UTC+8），用 datetime('now','+8 hours') 获取中国时间比较
  try {
    await env.DB.prepare(
      `UPDATE products SET is_online = 1, updated_at = datetime('now')
       WHERE is_online = 0 AND schedule_on IS NOT NULL AND schedule_on <= datetime('now', '+8 hours')`
    ).run();
    await env.DB.prepare(
      `UPDATE products SET is_online = 0, updated_at = datetime('now')
       WHERE is_online = 1 AND schedule_off IS NOT NULL AND schedule_off <= datetime('now', '+8 hours')`
    ).run();
  } catch (e) { /* 忽略定时上下架错误 */ }

  // 3. 查数据库
  const { results } = await env.DB.prepare(
    'SELECT * FROM products WHERE is_online = 1 AND is_hidden = 0 ORDER BY sort ASC, id DESC'
  ).all();

  // 3. 批量查类型
  const ids = results.map((p) => p.id);
  let variantsByProduct = {};
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const { results: vrows } = await env.DB.prepare(
      `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY sort ASC, id ASC`
    ).bind(...ids).all();
    for (const v of vrows) {
      if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
      variantsByProduct[v.product_id].push(cleanVariant(v));
    }
  }

  // 4. 组装
  const list = results.map((p) => {
    const item = cleanProduct(p);
    item.variants = variantsByProduct[p.id] || [];
    return item;
  });

  // 5. 写入缓存（5分钟，减少数据库查询）
  const response = new Response(JSON.stringify({ ok: true, list }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
