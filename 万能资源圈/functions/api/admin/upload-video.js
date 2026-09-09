/**
 * POST /api/admin/upload-video → 上传本地视频到自有存储（R36 新增）
 * 与 upload-image 同一套 IMAGE_BUCKET 绑定（KV 或 R2，自动识别）：
 *   ① KV 命名空间：单值上限 25MB → 视频限 25MB
 *   ② R2 存储桶：支持大文件 → 视频限 100MB
 * 需登录。视频通过本站路由 /img/<key> 访问（URL 为相对路径）。
 * 浏览器 <video> 原生支持 mp4 / webm；mov（iPhone 录像）在部分浏览器可能无法播放，会返回提示。
 */
import { json, requireAuth } from '../../_utils.js';

const ALLOWED_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

function isKVBucket(bucket) { return typeof bucket.getWithMetadata === 'function'; }

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const bucket = env.IMAGE_BUCKET;
  if (!bucket) {
    return json({ ok: false, msg: '图仓还没接上（两步即可，全程免费不用绑卡）：① Cloudflare 控制台 → 存储和数据库 → KV → 创建命名空间；② Pages 项目 → 设置 → 函数 → KV 命名空间绑定，变量名填 IMAGE_BUCKET，保存后重新部署，再回来上传' }, 400);
  }

  let form;
  try { form = await request.formData(); } catch (e) {
    return json({ ok: false, msg: '上传格式不对，请通过"上传本地视频"按钮选择视频文件' }, 400);
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ ok: false, msg: '没收到视频文件' }, 400);

  const type = String(file.type || '').toLowerCase();
  const ext = ALLOWED_TYPES[type];
  if (!ext) return json({ ok: false, msg: '只支持 mp4 / webm / mov 视频格式' }, 400);

  const limitMB = isKVBucket(bucket) ? 25 : 100;
  if (file.size > limitMB * 1024 * 1024) {
    return json({ ok: false, msg: '视频超过 ' + limitMB + 'MB 上限' + (isKVBucket(bucket) ? '（当前是 KV 图仓，单文件最多 25MB；更大的视频建议换绑 R2 桶或先用视频外链）' : '，请先压缩') }, 400);
  }

  const now = new Date();
  const key = 'videos/' + now.getUTCFullYear() + '/' + String(now.getUTCMonth() + 1).padStart(2, '0') + '/' + crypto.randomUUID() + '.' + ext;

  if (isKVBucket(bucket)) {
    await bucket.put(key, await file.arrayBuffer(), { metadata: { contentType: type } });
  } else {
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
    });
  }

  const note = ext === 'mov' ? '（提示：mov 在部分浏览器可能无法直接播放，建议转成 mp4 再上传）' : '';
  return json({ ok: true, key, url: '/img/' + key, note: note });
}
