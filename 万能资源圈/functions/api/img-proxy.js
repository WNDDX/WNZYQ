/**
 * GET /api/img-proxy?u=<对方图片地址>  —— 图片代理（v587 用户 11-09「来点硬核的」）
 *
 * 为什么需要它：
 *   采集来的封面是对方站的原图（实测单张 887KB），前端 <img src="对方域名/..."> 有三个问题：
 *     ① 跨域：对方加 referrer 校验就裂图
 *     ② 缓存不可控：对方 CDN 的缓存头我们管不了，每次打开都可能重新下
 *     ③ 对方挂了 / 删图 → 我们的采集列表整片空白
 *
 * 这个函数做三件事：
 *   ① 服务端去取（带 Referer，绕过常见的防盗链）
 *   ② 校验真的是一张图（content-type 必须是 image/*，且 ≤ 5MB），不是图就拒
 *   ③ 回给浏览器时挂 30 天强缓存 + immutable，让 Cloudflare 边缘和浏览器都存住
 *
 * 为什么不做「转存」：图仓是 KV（1GB 免费额度），67 条 × 900KB 很快就撑满，
 * 而且转存要额外占写入次数。代理 + 边缘缓存等于「用 Cloudflare 的缓存当免费 CDN」，
 * 不占我们存储、不迁移数据、对方换图我们自动跟着变。
 *
 * 安全：这是个「只代理图片」的开放代理——非图片内容一律 415，
 * 超过 5MB 一律 413，避免被拿去当通用翻墙/图床。
 */
export async function onRequestGet(context) {
  const { request } = context;
  const u = new URL(request.url).searchParams.get('u') || '';

  if (!/^https?:\/\//i.test(u)) return new Response('bad url', { status: 400 });
  // 只允许常见图片扩展名（没有扩展名的图床地址放行，靠 content-type 兜底）
  const pathOnly = u.split('?')[0].toLowerCase();
  const hasExt = /\.(png|jpe?g|webp|gif|avif|bmp)$/.test(pathOnly);
  if (!hasExt && /\.(php|js|json|html?|exe|zip|rar|mp4|m3u8)$/.test(pathOnly)) {
    return new Response('not an image', { status: 415 });
  }

  let origin = '';
  try { origin = new URL(u).origin + '/'; } catch (e) { return new Response('bad url', { status: 400 }); }

  const cacheKey = new Request(request.url, request);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let upstream;
  try {
    upstream = await fetch(u, {
      headers: {
        // 多数图床只校验「来源是本站」，带上对方 origin 基本都能过
        'Referer': origin,
        'User-Agent': 'Mozilla/5.0 (compatible; wnzyq-imgproxy/1.0)',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });
  } catch (e) {
    return new Response('upstream failed', { status: 502 });
  }

  if (!upstream.ok) return new Response('upstream ' + upstream.status, { status: 502 });

  const ct = (upstream.headers.get('Content-Type') || '').toLowerCase();
  if (ct.indexOf('image/') !== 0) return new Response('not an image', { status: 415 });

  const len = Number(upstream.headers.get('Content-Length') || 0);
  if (len && len > 5 * 1024 * 1024) return new Response('too large', { status: 413 });

  const body = await upstream.arrayBuffer();
  if (body.byteLength > 5 * 1024 * 1024) return new Response('too large', { status: 413 });

  const res = new Response(body, {
    headers: {
      'Content-Type': ct,
      'Content-Length': String(body.byteLength),
      // 30 天强缓存：对方换图会换 URL（文件名带日期/编号），不换 URL 的极少
      'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Timing-Allow-Origin': '*',
    },
  });

  // 写进 Cloudflare 边缘缓存（下次同 URL 直接命中，不再回源）
  try { context.waitUntil(cache.put(cacheKey, res.clone())); } catch (e) {}

  return res;
}
