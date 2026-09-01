/**
 * POST /api/admin/clear-cache
 * 清除资源和分类的 API 缓存（管理员修改资源/分类后调用）
 * 需要管理员登录
 */
import { json, requireAuth } from '../../_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  // 鉴权
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const cache = caches.default;
  const baseUrl = new URL(request.url).origin;

  // 清除资源和分类的缓存（这些接口不接受查询参数，缓存 key 是固定 URL）
  const keys = [
    `${baseUrl}/api/products`,
    `${baseUrl}/api/categories`,
  ];

  let cleared = 0;
  for (const key of keys) {
    const deleted = await cache.delete(new Request(key));
    if (deleted) cleared++;
  }

  return json({ ok: true, cleared, message: `已清除 ${cleared} 个缓存` });
}
