/**
 * 中间件：为所有 API 统一处理 OPTIONS 预检 + 附加 CORS 头 + 全局错误捕获
 */
import { corsHeaders, handleOptions, json } from './_utils.js';

export async function onRequest(context) {
  // OPTIONS 预检直接返回
  if (context.request.method === 'OPTIONS') {
    return handleOptions(context.request);
  }

  try {
    // 继续执行真正的路由处理
    const response = await context.next();
    // 给响应附加 CORS 头（仅同源放行，逻辑见 _utils.js corsHeaders）
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders(context.request)).forEach(([k, v]) => headers.set(k, v));
    return new Response(response.body, { status: response.status, headers });
  } catch (e) {
    // 全局错误捕获：错误细节只进服务端日志（console.error），对外返回通用提示，
    // 避免把数据库表名、SQL 片段等内部信息泄露给访问者
    console.error('API错误:', e);
    return json({ ok: false, msg: '服务器开小差了，请稍后再试' }, 500);
  }
}
