/**
 * POST /api/admin/upload-video → 上传本地视频到自有存储（R36 新增）
 * 与 upload-image 同一套 IMAGE_BUCKET 绑定（KV 或 R2，自动识别）：
 *   R307 起大小限制已按老板拍板全部取消；仅平台侧限制仍在——KV 单值 25MB（平台硬上限），R2 无限制。
 * 需登录。视频通过本站路由 /img/<key> 访问（URL 为相对路径）。
 * 浏览器 <video> 原生支持 mp4 / webm；mov（iPhone 录像）在部分浏览器可能无法播放，会返回提示。
 */
import { json, requireAuth , putToBucket, sniffMatchesType, rateLimit } from '../../_utils.js';

const ALLOWED_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

function isKVBucket(bucket) { return typeof bucket.getWithMetadata === 'function'; }

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  /* #116：上传是资源编辑的一部分——sub 需有新增或编辑权限（防无权者刷存储）；super 不限 */
  if (auth.role !== 'super') {
    const { parsePerms, can } = await import('../../_perms.js');
    const _pp = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
    if (!(can('products.edit', auth.role, _pp) || can('products.add', auth.role, _pp))) {
      return json({ ok: false, msg: '该功能未开放' }, 403);
    }
  }
  if (auth instanceof Response) return auth;
  /* v432 #39：上传写接口防刷（30 次/分钟） */
  if (!rateLimit(request, 'upload', 60)) return json({ ok: false, msg: '操作太频繁，请一分钟后再试' }, 429);

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
  if (!ext) return json({ ok: false, msg: '文件格式不支持，请上传网站支持的格式' }, 400);
  /* v432 #38：文件头魔数校验（防伪装） */
  if (!(await sniffMatchesType(file, type))) return json({ ok: false, msg: '文件内容与声明的格式不符，已被拒绝' }, 400);

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
  try { await recordUpload(env, key); } catch (e) {} /* v354：记台账 */
  return json({ ok: true, key, url: '/img/' + key, note: note });
}
