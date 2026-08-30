/**
 * GET /api/categories
 * 返回分类列表（公开接口，前台用），含两级分类结构，过滤隐藏分类
 * 带 5 分钟缓存
 */
import { json } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cacheKey = new Request(new URL(request.url).toString(), request);
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) return new Response(cached.body, cached);

  const { results } = await env.DB.prepare(
    'SELECT id, name, sort, parent_id, is_hidden FROM categories WHERE is_hidden = 0 ORDER BY sort ASC, id ASC'
  ).all();

  const response = new Response(JSON.stringify({ ok: true, list: results }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
