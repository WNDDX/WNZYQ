/**
 * 兜底错误页处理（catch-all 路由）
 * 所有未匹配到静态资源、也未匹配到具体 Function 的路径（如 /errorr、/任意不存在页面），
 * 统一返回错误页 error.html（HTTP 状态码 404）。
 * 说明：Cloudflare Pages 静态资源优先于 Functions，所以 /、/index.html、/shop.html、
 *       /error.html 等真实文件不会被此 catch-all 拦截；/api/* 由 api/ 目录的 Function 处理。
 */
const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8' };

async function serveError(context) {
  try {
    // 优先取「万能资源圈」子目录下的错误页；若部署在仓库根目录则回退到 /error.html
    const candidates = ['/万能资源圈/error.html', '/error.html'];
    for (const u of candidates) {
      const res = await context.env.ASSETS.fetch(new URL(u, context.request.url));
      if (res && res.ok) {
        return new Response(res.body, { status: 404, headers: HTML_HEADERS });
      }
    }
  } catch (e) {
    /* 忽略，走内置兜底 */
  }
  return new Response(
    '<meta charset="utf-8"><title>错误</title><body style="text-align:center;padding-top:80px;font-family:sans-serif;color:#333;"><h2>页面不存在</h2><p><a href="/">返回导航</a></p></body>',
    { status: 404, headers: HTML_HEADERS }
  );
}

export async function onRequestGet(context) { return serveError(context); }
export async function onRequestPost(context) { return serveError(context); }
export async function onRequestPut(context) { return serveError(context); }
export async function onRequestPatch(context) { return serveError(context); }
export async function onRequestDelete(context) { return serveError(context); }
export async function onRequestHead(context) { return serveError(context); }
export async function onRequestOptions(context) { return new Response(null, { status: 204 }); }
