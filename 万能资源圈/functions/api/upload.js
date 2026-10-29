/**
 * POST /api/upload
 * 通用图片上传（管理页封面图等使用）
 * v301（用户 10-05 00:00）：补回缺失接口
 */
import { json, requireAuth } from '../_utils.js';

const ALLOWED_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

function isKVBucket(bucket) { return typeof bucket.getWithMetadata === 'function'; }

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const bucket = env.IMAGE_BUCKET;
  if (!bucket) {
    return json({ ok: false, msg: '图仓还没接上' }, 400);
  }

  let form;
  try { form = await request.formData(); } catch (e) {
    return json({ ok: false, msg: '上传格式不对' }, 400);
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ ok: false, msg: '没收到图片文件' }, 400);

  const type = String(file.type || '').toLowerCase();
  const ext = ALLOWED_TYPES[type];
  if (!ext) return json({ ok: false, msg: '只支持 png / jpg / webp / gif 图片' }, 400);

  const now = new Date();
  const key = 'images/' + now.getUTCFullYear() + '/' + String(now.getUTCMonth() + 1).padStart(2, '0') + '/' + crypto.randomUUID() + '.' + ext;

  if (isKVBucket(bucket)) {
    await bucket.put(key, await file.arrayBuffer(), { metadata: { contentType: type } });
  } else {
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
    });
  }

  return json({ ok: true, key, url: '/img/' + key });
}
