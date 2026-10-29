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
/* v339 条221：安全防护头——干净网址页面（/index、/shop）由本函数返回响应，而函数响应不经过
   _headers 文件（静态文件才走），导致这些防护此前从未在线上生效。现直接内置到每个响应：
   ①CSP 防注入/防外链脚本 ②防嵌套点击劫持 ③防 MIME 嗅探 ④引用来源隐私 ⑤强制 HTTPS 记忆 */
const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
};
const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache, must-revalidate', ...SECURITY_HEADERS };

// 已知页面：clean URL 名 → 实际文件名
// R63：error 恢复直达页面——/error 作为 sitemap 列出的正式地址返回 200（用户要求 sitemap 加 /error），
// /error.html 直接访问也兼容 200；除此之外的任何未知路径仍统一走 serveError 返回 404 + 错误页，
// 「全页面的报错都处理」语义不变（404 状态码 + 错误页内容兜底）。
const PAGES = { index: 'index.html', shop: 'shop.html', admin: 'admin.html', error: 'error.html', 'error.html': 'error.html' };

/** 统一返回错误页（HTTP 404） */
async function serveError(context) {
  try {
    const candidates = ['/error.html']; /* v336 条21：定死根目录部署 */
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
    '<meta charset="utf-8"><title>万能资源圈・错误</title><body style="text-align:center;padding-top:80px;font-family:sans-serif;color:#333;"><h2>页面访问异常</h2><p>抱歉！你访问的页面出现了问题</p><p>①地址有误　②页面已删除　③服务暂不可用</p><p><a href="/">返回导航</a></p></body>',
    { status: 404, headers: HTML_HEADERS }
  );
}

/** 站点根：302 重定向到导航页（必须用重定向而非 rewrite，否则 URL 停留在根级，页面内相对图片路径会全部加载失败） */
async function serveHome(context) {
  try {
    const candidates = ['/index']; /* v336 条21 */
    for (const u of candidates) {
      const res = await context.env.ASSETS.fetch(new URL(u + '.html', context.request.url));
      if (res && res.ok) {
        return new Response(null, { status: 302, headers: { location: u, ...SECURITY_HEADERS } });
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
    const candidates = ['/' + file]; /* v336 条21 */
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

/** 静态资源兜底：先查根部署路径，再查子目录同名资源；缺失时返回真正 404（正确 MIME，绝不返回 HTML，防止错误页被当 JS/CSS 解析）
 *  图片/字体/视频加长缓存（同 URL 全站复用浏览器缓存，跨页秒开；更新文件用新文件名即可强制生效） */
const LONG_CACHE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'woff', 'woff2', 'ttf'];
const VIDEO_CACHE_EXTS = ['mp4', 'webm', 'ogv'];
async function serveAsset(context, path) {
  const candidates = [path, '/万能资源圈' + path];
  for (const u of candidates) {
    try {
      const res = await context.env.ASSETS.fetch(new URL(u, context.request.url));
      if (res && res.ok) {
        const ext = (path.split('.').pop() || '').toLowerCase();
        const headers = new Headers(res.headers);
        Object.keys(SECURITY_HEADERS).forEach((k) => headers.set(k, SECURITY_HEADERS[k])); /* v339 条221：静态兜底响应同样带防护 */
        if (path.split('/').pop() === 'sw.js') {
          // Service Worker 绝不缓存：部署新 sw.js 后所有用户立即生效，杜绝旧 SW 缓存旧页面导致“改了没效果”
          headers.set('cache-control', 'no-cache, no-store, must-revalidate');
        } else if (ext === 'js' || ext === 'css') {
          /* v339 条222：JS/CSS 未带指纹，必须每次校验（no-cache），改完上传立即生效 */
          headers.set('cache-control', 'no-cache, must-revalidate');
        } else if (LONG_CACHE_EXTS.indexOf(ext) !== -1) {
          /* v346 条5：图片/字体长缓存对齐 _headers 的 365 天（原 7 天，与静态规则口径不一致） */
          headers.set('cache-control', 'public, max-age=31536000, immutable');
        } else if (VIDEO_CACHE_EXTS.indexOf(ext) !== -1) {
          // 视频：1 天缓存（文件大，减少重复下载）
          headers.set('cache-control', 'public, max-age=86400');
        }
        return new Response(res.body, { status: 200, headers });
      }
    } catch (e) {
      /* 继续尝试下一个候选路径 */
    }
  }
  const ext = (path.split('.').pop() || '').toLowerCase();
  const types = {
    js: 'application/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
    json: 'application/json; charset=utf-8', png: 'image/png', jpg: 'image/jpeg',
    jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon',
    webp: 'image/webp', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', mp4: 'video/mp4'
  };
  return new Response('Not Found: ' + path, {
    status: 404,
    headers: { 'content-type': types[ext] || 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export async function onRequestGet(context) {
  const path = new URL(context.request.url).pathname.replace(/\/+$/, '') || '/';
  if (path === '/') {
    return serveHome(context);
  }
  // 静态资源兜底（子目录部署兼容）：根级 /assets/* /images/* /favicon.ico /manifest.json /sw.js 等
  if (path.startsWith('/assets/') || path.startsWith('/images/') || path === '/favicon.ico' || path === '/manifest.json' || path === '/sw.js') {
    return serveAsset(context, path);
  }
  // config.js：存在则正常返回；缺失时返回空配置（页面自动用内置默认，杜绝 console 404 报错）
  if (path === '/config.js') {
    const res = await serveAsset(context, path);
    if (res.status === 404) {
      return new Response('window.SHOP_CONFIG = window.SHOP_CONFIG || {};', {
        status: 200,
        headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-cache' }
      });
    }
    return res;
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
