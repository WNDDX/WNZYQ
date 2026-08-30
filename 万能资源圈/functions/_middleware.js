/**
 * 中间件：为所有 API 统一处理 OPTIONS 预检 + 附加 CORS 头
 */
import { corsHeaders, handleOptions } from './_utils.js';

export async function onRequest(context) {
  // OPTIONS 预检直接返回
  if (context.request.method === 'OPTIONS') {
    return handleOptions();
  }
  // 继续执行真正的路由处理
  const response = await context.next();
  // 给响应附加 CORS 头
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}
