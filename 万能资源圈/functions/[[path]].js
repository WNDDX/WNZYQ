/**
 * 兜底路由（catch-all）——全站错误兜底
 *
 * 处理所有未匹配到静态资源、也未匹配到具体 Function 的路径：
 *  - 站点根 "/" → 302 重定向到导航页 index（用重定向而非 rewrite，避免 URL 停留根级导致相对图片路径错乱）
 *  - 其它一切不存在的路径（/errorr、/abc、/随便乱输 等）→ 统一返回错误页 error.html（404）
 *
 * 说明：
 *  - Cloudflare Pages 静态资源优先于 Functions，真实文件（index/shop/admin/error 及 /万能资源圈/ 下资源）不会被拦截
 *  - /api/* 由 functions/api/ 目录下更具体的 Function 处理，不会被本 catch-all 接管
 *  - 本站页面部署在「万能资源圈」子目录下，抓取资源时优先子目录路径，找不到再回退根目录，兼容两种部署结构
 */
const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8' };

/** 统一返回错误页（HTTP 404） */
async function serveError(context) {
  try {
    const candidates = ['/error.html', '/万能资源圈/error.html'];
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

/** 站点根：302 重定向到导航页（必须用重定向而非 rewrite，否则 URL 停留在根级，页面内相对图片路径会全部加载失败） */
async function serveHome(context) {
  try {
    const candidates = ['/index', '/万能资源圈/index'];
    for (const u of candidates) {
      const res = await context.env.ASSETS.fetch(new URL(u + '.html', context.request.url));
      if (res && res.ok) {
        return new Response(null, { status: 302, headers: { location: u } });
      }
    }
  } catch (e) {
    /* 忽略，走错误页兜底 */
  }
  return serveError(context);
}

export async function onRequestGet(context) {
  const path = new URL(context.request.url).pathname;
  if (path === '/' || path === '') {
    return serveHome(context);
  }
  return serveError(context);
}

export async function onRequestPost(context) { return serveError(context); }
export async function onRequestPut(context) { return serveError(context); }
export async function onRequestPatch(context) { return serveError(context); }
export async function onRequestDelete(context) { return serveError(context); }
export async function onRequestHead(context) { return serveError(context); }
export async function onRequestOptions(context) { return new Response(null, { status: 204 }); }
