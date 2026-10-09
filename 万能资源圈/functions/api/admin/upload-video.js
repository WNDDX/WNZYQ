/**
 * POST /api/admin/upload-video → 上传本地视频到自有存储（R36 新增）
 * 与 upload-image 同一套 IMAGE_BUCKET 绑定（KV 或 R2，自动识别）：
 *   R307 起大小限制已按老板拍板全部取消；仅平台侧限制仍在——KV 单值 25MB（平台硬上限），R2 无限制。
 * 需登录。视频通过本站路由 /img/<key> 访问（URL 为相对路径）。
 * 浏览器 <video> 原生支持 mp4 / webm；mov（iPhone 录像）在部分浏览器可能无法播放，会返回提示。
 */
import { json, requireAuth , putToBucket } from '../../_utils.js';

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

  // R308：老板拍板视频硬限 25MB（KV 平台硬上限，前端已秒拒，后端双保险防绕过）
  const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
  if (file.size > MAX_VIDEO_SIZE) {
    return json({ ok: false, msg: '该视频超过 25MB，暂不支持上传，请压缩或剪辑后再试' }, 413);
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
