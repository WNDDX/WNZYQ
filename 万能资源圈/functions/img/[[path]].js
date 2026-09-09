/**
 * GET /img/<key> → 图仓图片直出（R32）
 * 从 IMAGE_BUCKET（KV 命名空间或 R2 桶，自动识别）读取图片并返回，
 * 带一年 immutable 缓存头 + Cloudflare 边缘缓存（caches.default），访客基本不重复回源。
 * KV 免费层读额度 10 万次/天，配合边缘缓存对个人站绰绰有余。
 */
const KEY_RE = /^images\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif)$/;

function guessType(key) {
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

export async function onRequestGet(context) {
  const { env, request, params, waitUntil } = context;
  const key = (params.path || []).join('/');
  if (!KEY_RE.test(key)) return new Response('Not found', { status: 404 });

  const bucket = env.IMAGE_BUCKET;
  if (!bucket) return new Response('图仓未绑定（IMAGE_BUCKET）', { status: 404 });

  // 边缘缓存命中直接返回（不走桶，不耗 KV 读额度）
  let cached = null;
  try { cached = await caches.default.match(request); } catch (e) {}
  if (cached) return cached;

  let body, contentType;
  if (typeof bucket.getWithMetadata === 'function') {
    const { value, metadata } = await bucket.getWithMetadata(key, 'arrayBuffer');
    if (!value) return new Response('Not found', { status: 404 });
    body = value;
    contentType = (metadata && metadata.contentType) || guessType(key);
  } else {
    const obj = await bucket.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    body = obj.body;
    contentType = (obj.httpMetadata && obj.httpMetadata.contentType) || guessType(key);
  }

  const res = new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
  try { if (waitUntil) waitUntil(caches.default.put(request, res.clone())); } catch (e) {}
  return res;
}
