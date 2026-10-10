/**
 * POST /api/admin/upload-file → 上传任意文件到自有仓（复用 IMAGE_BUCKET）
 * v320（用户 10-05 22:37）：文件与图片/视频共用同一存储体系（IMAGE_BUCKET），
 * 存到 files/ 目录，通过 /files/<key> 下载。单文件 25MB 前端已拦截，后端做兜底保险。
 */
import { json, requireAuth , putToBucket } from '../../_utils.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function isKVBucket(bucket) { return typeof bucket.getWithMetadata === 'function'; }

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const bucket = env.IMAGE_BUCKET;
  if (!bucket) {
    return json({ ok: false, msg: '存储未绑定（IMAGE_BUCKET），请检查 Cloudflare Pages 函数绑定设置' }, 400);
  }

  let form;
  try { form = await request.formData(); } catch (e) {
    return json({ ok: false, msg: '上传格式不对' }, 400);
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ ok: false, msg: '没收到文件' }, 400);

  if (file.size > MAX_FILE_SIZE) {
    return json({ ok: false, msg: '文件超过 25MB', error: 'size' }, 413);
  }

  const now = new Date();
  const extMatch = String(file.name || '').match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'bin';
  /* v348 条36：文件类型白名单——原先什么扩展名都能传，只看大小 25MB。
     现在只允许下面这些（与 files 路由 guessType 的映射一一对应，别处不会拿到不认识的类型）。 */
  const ALLOW = ['pdf','zip','rar','7z','tar','gz','doc','docx','xls','xlsx','ppt','pptx',
    'txt','md','json','csv','mp3','wav','ogg','flac','mp4','webm','avi','mov',
    'png','jpg','jpeg','webp','gif'];
  if (ALLOW.indexOf(ext) === -1) {
    return json({ ok: false, msg: '不支持的文件类型：.' + ext }, 400);
  }
  const key = 'files/' + now.getUTCFullYear() + '/' + String(now.getUTCMonth() + 1).padStart(2, '0') + '/' + crypto.randomUUID() + '.' + ext;

  if (isKVBucket(bucket)) {
    await bucket.put(key, await file.arrayBuffer(), { metadata: { contentType: file.type || 'application/octet-stream', filename: file.name || '' } });
  } else {
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream', cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { filename: file.name || '' },
    });
  }

  try { await recordUpload(env, key); } catch (e) {} /* v354：记台账 */
  return json({ ok: true, key, url: '/files/' + key });
}
