/**
 * GET /files/<key> → 文件仓直出（v320）
 * 复用 /img/<key> 模式，从 IMAGE_BUCKET（KV 或 R2）读取文件并返回，
 * 带一年 immutable 缓存头 + Cloudflare 边缘缓存。
 */
const KEY_RE = /^files\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-zA-Z0-9]+$/;

function guessType(key) {
  const ext = (key.split('.').pop() || '').toLowerCase();
  const map = {
    pdf: 'application/pdf', zip: 'application/zip', rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed', tar: 'application/x-tar', gz: 'application/gzip',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', md: 'text/markdown', json: 'application/json', csv: 'text/csv',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
    mp4: 'video/mp4', webm: 'video/webm', avi: 'video/x-msvideo', mov: 'video/quicktime',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  };
  return map[ext] || 'application/octet-stream';
}

export async function onRequestGet(context) {
  const { env, request, params, waitUntil } = context;
  const key = (params.path || []).join('/');
  if (!KEY_RE.test(key)) return new Response('Not found', { status: 404 });

  const bucket = env.IMAGE_BUCKET;
  if (!bucket) return new Response('存储未绑定（IMAGE_BUCKET）', { status: 404 });

  let cached = null;
  try { cached = await caches.default.match(request); } catch (e) {}
  if (cached) return cached;

  let body, contentType, filename;
  if (typeof bucket.getWithMetadata === 'function') {
    const { value, metadata } = await bucket.getWithMetadata(key, 'arrayBuffer');
    if (!value) return new Response('Not found', { status: 404 });
    body = value;
    contentType = (metadata && metadata.contentType) || guessType(key);
    filename = (metadata && metadata.filename) || key.split('/').pop();
  } else {
    const obj = await bucket.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    body = obj.body;
    contentType = (obj.httpMetadata && obj.httpMetadata.contentType) || guessType(key);
    filename = (obj.customMetadata && obj.customMetadata.filename) || key.split('/').pop();
  }

  const res = new Response(body, {
    headers: {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff', /* v333：与 /img/ 路由同口径，禁止浏览器猜类型 */
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'attachment; filename="' + (filename || 'download') + '"',
    },
  });
  try { if (waitUntil) waitUntil(caches.default.put(request, res.clone())); } catch (e) {}
  return res;
}
