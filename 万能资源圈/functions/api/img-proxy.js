/**
 * GET /api/img-proxy?u=<对方图片地址>[&w=<宽>][&q=<质量>]  —— 图片代理（v587 用户 11-09「来点硬核的」）
 *
 * 为什么需要它：
 *   采集来的封面是对方站的原图（实测单张 887KB），前端 <img src="对方域名/..."> 有三个问题：
 *     ① 跨域：对方加 referrer 校验就裂图
 *     ② 缓存不可控：对方 CDN 的缓存头我们管不了，每次打开都可能重新下
 *     ③ 对方挂了 / 删图 → 我们的采集列表整片空白
 *
 * 这个函数做四件事：
 *   ① 服务端去取（带 Referer，绕过常见的防盗链）
 *   ② 校验真的是一张图（content-type 必须是 image/*，且 ≤ 5MB），不是图就拒
 *   ③ 尽量让这张图「瘦下来」：命中已知图床的图片处理参数时，让图床按 q 重编码（v701，见下）
 *   ④ 回给浏览器时挂 30 天强缓存 + immutable，让 Cloudflare 边缘和浏览器都存住
 *
 * 为什么不做「转存」：图仓是 KV（1GB 免费额度），67 条 × 900KB 很快就撑满，
 * 而且转存要额外占写入次数。代理 + 边缘缓存等于「用 Cloudflare 的缓存当免费 CDN」，
 * 不占我们存储、不迁移数据、对方换图我们自动跟着变。
 *
 * 安全：这是个「只代理图片」的开放代理——非图片内容一律 415，
 * 超过 5MB 一律 413，避免被拿去当通用翻墙/图床。
 *
 * ── v701 瘦身（全系统验收「单文件 < 200KB」红在这条）─────────────────────────────
 * 症状：/shop 冷启动里唯一超过 200KB 的资源就是本路由，261KB
 *       （u=https://img95.699pic.com/photo/50464/9776.jpg_wh860.jpg，原图 860×573 / 267313B）。
 * 排查结论（三条都实测过，不是猜的）：
 *   ① 本路由原来**没有任何** quality/resize 参数，上游多少字节就吐多少字节 —— 确实没压缩；
 *   ② Cloudflare 的 `cf.image` / `/cdn-cgi/image/*` 在本域**不可用**
 *      （GET https://wnzyq.pages.dev/cdn-cgi/image/width=64/format=auto/... → 404），
 *      所以「在边缘重编码」这条路走不通，只能借图床自己的图片处理参数；
 *   ③ 该图床（699pic → assets.699pic.com）跑在**阿里云 OSS** 上，同一 URL 追加
 *      `?x-oss-process=image/quality,q_N` 即返回同尺寸重编码版本。实测：
 *        原图           267313B
 *        quality,q_90   235601B
 *        quality,q_85   164313B
 *        quality,q_82   158009B   ← 采用
 *        quality,q_80   155869B
 *        quality,q_75   148266B
 *      **尺寸不变**（仍 860×573，naturalWidth 不变，详情弹窗放大也不糊），只挤掉冗余码率。
 * 做法：按宿主白名单加参数，**绝不通用改写**——不认识的宿主原样透传
 *       （有些站把未知查询串直接判 404，乱加参数会把封面打裂）。
 *       缩图请求只要不是 200 / 不是 image/* / body 为空，立刻退回原图：宁可大，不能裂。
 * 调用方还可以自己传 w（想要更小尺寸时）：`?w=480&q=82` → 图床侧 resize。
 *   w 默认 0 = 不改尺寸（保底方案，画质零变化）；上限 2000，防止被拿去当免费缩图服务。
 */
import { rateLimit } from '../_utils.js'; /* v626 D2：公开接口挂 IP 级限流，防被当免费图床刷爆 */

/* 重编码默认质量：82 是「同尺寸下肉眼无差、码率掉三成」的常用拐点。
   卡片封面实际显示 96~320 CSS px（DPR2 最多 640），82 的 860px 版本绰绰有余。 */
const DEFAULT_QUALITY = 82;
/* 默认不改尺寸（0）。这样 naturalWidth 与原图一致，不存在「放大了才发现糊」的风险。 */
const DEFAULT_WIDTH = 0;
const MAX_WIDTH = 2000;
const MAX_BYTES = 5 * 1024 * 1024;
/* 缓存键版本号。改了「回什么字节」的逻辑就要进位——否则边缘上 30 天的老缓存会继续吐
   261KB 的旧版本，改了半天线上还是原样（这个坑不写在这儿下次一定踩）。 */
const CACHE_VERSION = '701';

/* 已知图床的「同 URL 加参数即缩图」规则表。
   加新宿主的前提：亲手 curl 过「加参数后尺寸/字节确实变小、且不是 404」，并把数据写进注释。 */
const SHRINK_RULES = [
  {
    name: '阿里云 OSS（摄图网 699pic 的图仓，含 img95.699pic.com → assets.699pic.com）',
    test: /(^|\.)699pic\.com$/i,
    param: 'x-oss-process',
    /* w > 0 时同时 resize（等比），否则只重编码 —— 只有 quality 才会「尺寸不变、字节变小」 */
    build: (w, q) => (w > 0 ? `image/resize,w_${w}/quality,q_${q}` : `image/quality,q_${q}`),
  },
];

/** 取整数参数并夹到合法区间；非法值一律回落到默认值。 */
function intParam(raw, fallback, min, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/**
 * 给「已知图床」拼出缩图 URL。
 * @param {string} rawUrl 上游原图地址
 * @param {number} w 目标宽度，0 表示不改尺寸
 * @param {number} q 目标质量 1~100
 * @returns {string} 缩图地址；空字符串表示「这家图床不认识 / 上游自己带过参数」→ 走原图
 */
function shrinkUrl(rawUrl, w, q) {
  let u;
  try { u = new URL(rawUrl); } catch (e) { return ''; }
  for (const rule of SHRINK_RULES) {
    if (!rule.test.test(u.hostname)) continue;
    /* 上游已经自己带了处理参数 → 尊重对方的设定，不再叠加（叠加会互相覆盖，行为不可预期） */
    if (u.searchParams.has(rule.param)) return '';
    const value = rule.build(w, q);
    if (!value) return '';
    u.searchParams.set(rule.param, value);
    return u.toString();
  }
  return '';
}

/** 统一的回源请求：带上防盗链用的 Referer 与常见的图片 Accept。 */
async function fetchUpstream(target, origin) {
  return fetch(target, {
    headers: {
      // 多数图床只校验「来源是本站」，带上对方 origin 基本都能过
      'Referer': origin,
      'User-Agent': 'Mozilla/5.0 (compatible; wnzyq-imgproxy/1.0)',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  });
}

/**
 * 取一张「可用的图片」：先试缩图地址，失败（非 2xx / 非图片 / 空 body / 超 5MB）就退回原图。
 * @returns {Promise<{ct: string, body: ArrayBuffer}|null>} null 表示彻底拿不到
 */
async function grabImage(candidates, origin) {
  for (const target of candidates) {
    if (!target) continue;
    let upstream;
    try {
      upstream = await fetchUpstream(target, origin);
    } catch (e) {
      continue; /* 这家不通，换下一个候选 */
    }
    if (!upstream.ok) continue;

    const ct = (upstream.headers.get('Content-Type') || '').toLowerCase();
    if (ct.indexOf('image/') !== 0) continue;

    const declared = Number(upstream.headers.get('Content-Length') || 0);
    if (declared && declared > MAX_BYTES) continue;

    let body;
    try {
      body = await upstream.arrayBuffer();
    } catch (e) {
      continue;
    }
    if (!body || body.byteLength === 0) continue;
    if (body.byteLength > MAX_BYTES) continue;
    return { ct: ct, body: body };
  }
  return null;
}

export async function onRequestGet(context) {
  const { request } = context;
  const sp = new URL(request.url).searchParams;
  const u = sp.get('u') || '';

  if (!/^https?:\/\//i.test(u)) return new Response('bad url', { status: 400 });
  // 只允许常见图片扩展名（没有扩展名的图床地址放行，靠 content-type 兜底）
  const pathOnly = u.split('?')[0].toLowerCase();
  const hasExt = /\.(png|jpe?g|webp|gif|avif|bmp)$/.test(pathOnly);
  if (!hasExt && /\.(php|js|json|html?|exe|zip|rar|mp4|m3u8)$/.test(pathOnly)) {
    return new Response('not an image', { status: 415 });
  }

  let origin = '';
  try { origin = new URL(u).origin + '/'; } catch (e) { return new Response('bad url', { status: 400 }); }

  /* v701：请求 URL 里带了 w/q 就按它来（默认 q=82、w=0 不改尺寸）。
     cacheKey 用的就是这个带 w/q 的 request.url，所以不同 q/w 各自缓存，不会串。 */
  const wantW = intParam(sp.get('w'), DEFAULT_WIDTH, 0, MAX_WIDTH);
  const wantQ = intParam(sp.get('q'), DEFAULT_QUALITY, 1, 100);

  /* 缓存键：原始请求 URL（已含调用方的 w/q）+ 版本号。
     加版本号是为了让旧版本写进去的条目立刻失效，不用等 30 天过期。 */
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.set('_cv', CACHE_VERSION);
  const cacheKey = new Request(keyUrl.toString(), request);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  /* v626 D2（老板 11-13）：公开接口挂 IP 级限流——60 次/分钟/IP，超限直接 429（与 unlock.js 同一套 rateLimit）。
     放在缓存命中之后：30 天强缓存的命中不占配额，只有真正回源的请求计数，
     避免首页一屏十来张代理图把访客自己的配额刷满（那会把正常访客的图打成空白）。 */
  if (!rateLimit(request, 'imgprox', 60)) return new Response('', { status: 429 });

  /* 动图（gif）与矢量图（svg）不参与重编码：gif 重编码会掉帧，svg 本来就是文本、且能带脚本。
     pathOnly 没有扩展名（图床自定义地址）时也不冒险，走原图。 */
  const skipShrink = /\.(gif|svg)$/i.test(pathOnly) || !hasExt;
  const shrunk = skipShrink ? '' : shrinkUrl(u, wantW, wantQ);

  /* 先缩图、后原图：缩图那一步任何异常都只是白跑一次请求，不影响最终能不能出图。 */
  const got = await grabImage(shrunk ? [shrunk, u] : [u], origin);
  if (!got) return new Response('upstream failed', { status: 502 });

  const res = new Response(got.body, {
    headers: {
      'Content-Type': got.ct,
      'Content-Length': String(got.body.byteLength),
      // 30 天强缓存：对方换图会换 URL（文件名带日期/编号），不换 URL 的极少
      'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Timing-Allow-Origin': '*',
      /* v633 安全补丁：`image/*` 里包含 `image/svg+xml`，而 SVG 是可以内嵌 <script> 的。
         照片类格式（png/jpg/webp/gif/avif/bmp）不存在这个问题，SVG 必须单独上锁：
         加一个 CSP sandbox，万一有人把这个代理地址直接发给访客点开（顶层导航），
         里面就算藏了脚本也执行不了，等于在我们域名下开了一个不能跑脚本的沙箱。
         放在 <img> 里加载的 SVG 本来就不执行脚本，所以这条不影响正常封面显示。 */
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });

  // 写进 Cloudflare 边缘缓存（下次同 URL 直接命中，不再回源）
  try { context.waitUntil(cache.put(cacheKey, res.clone())); } catch (e) {}

  return res;
}
