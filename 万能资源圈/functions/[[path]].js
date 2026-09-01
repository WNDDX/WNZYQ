/**
 * 兜底路由（catch-all）——全站 clean URL 路由 + 错误兜底
 *
 * 职责（按顺序）：
 *  1. 站点根 "/"            → 302 重定向到导航页（index）
 *  2. 已知页面名             → 路由到对应页面（index / shop / admin，兼容根部署与子目录部署）
 *  3. 其它一切不存在的路径     → 统一返回错误页 error.html（404）
 *
 * 说明：
 *  - Cloudflare Pages 静态资源优先于 Functions：页面若在站点根，/index 等会直接命中静态文件，
 *    不会走到本 catch-all；本文件只兜住"没有静态资源命中的路径"。
 *  - 页面若部署在 /万能资源圈/ 子目录，/index 等无静态资源命中，则本文件负责抓到子目录里的
 *    真实页面返回，保证 clean URL（不带 .html、不带子目录前缀）始终可用。
 *  - /api/* 由 functions/api/ 目录下更具体的 Function 处理，不会被本 catch-all 接管。
 */
const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8' };

// 已知页面：clean URL 名 → 实际文件名
const PAGES = { index: 'index.html', shop: 'shop.html', admin: 'admin.html' };

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

/** 路由到已知页面（兼容根部署与子目录部署） */
async function servePage(context, file) {
  try {
    const candidates = ['/' + file, '/万能资源圈/' + file];
    for (const u of candidates) {
      const res = await context.env.ASSETS.fetch(new URL(u, context.request.url));
      if (res && res.ok) {
        return new Response(res.body, { status: 200, headers: HTML_HEADERS });
      }
    }
  } catch (e) {
    /* 忽略，走错误页兜底 */
  }
  return serveError(context);
}

export async function onRequestGet(context) {
  const path = new URL(context.request.url).pathname.replace(/\/+$/, '') || '/';
  if (path === '/') {
    return serveHome(context);
  }
  const name = path.split('/').pop(); // 取最后一段作为页面名
  if (PAGES[name]) {
    return servePage(context, PAGES[name]);
  }
  return serveError(context);
}

export async function onRequestPost(context) { return serveError(context); }
export async function onRequestPut(context) { return serveError(context); }
export async function onRequestPatch(context) { return serveError(context); }
export async function onRequestDelete(context) { return serveError(context); }
export async function onRequestHead(context) { return serveError(context); }
export async function onRequestOptions(context) { return new Response(null, { status: 204 }); }
