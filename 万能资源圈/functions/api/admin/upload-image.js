/**
 * POST /api/admin/upload-image → 上传图片到自有图仓
 * 绑定名 IMAGE_BUCKET，两种桶都支持（自动识别，均绑到 Pages 的函数绑定里）：
 *   ① KV 命名空间（免费层 1GB 存储，无需绑卡——推荐）
 *   ② R2 存储桶（需绑卡验证；绑了也能用）
 * 需登录。图片通过本站路由 /img/<key> 访问（自家域名 + CDN 缓存，无需填任何公开地址）。
 * R32：改为免绑卡 KV 方案 + 自家路由直出，URL 为相对路径 /img/...
 */
import { json, requireAuth } from '../../_utils.js';

const ALLOWED_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

// KV 命名空间特有 getWithMetadata；R2 桶没有
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
    return json({ ok: false, msg: '上传格式不对，请通过"上传图片"按钮选择图片文件' }, 400);
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ ok: false, msg: '没收到图片文件' }, 400);

  const type = String(file.type || '').toLowerCase();
  const ext = ALLOWED_TYPES[type];
  if (!ext) return json({ ok: false, msg: '只支持 png / jpg / webp / gif 图片' }, 400);
  if (file.size > 10 * 1024 * 1024) return json({ ok: false, msg: '图片超过 10MB，请先压缩或换小图' }, 400);

  const now = new Date();
  const key = 'images/' + now.getUTCFullYear() + '/' + String(now.getUTCMonth() + 1).padStart(2, '0') + '/' + crypto.randomUUID() + '.' + ext;

  if (isKVBucket(bucket)) {
    // KV：内容 + contentType 存 metadata（读的时候取回）
    await bucket.put(key, await file.arrayBuffer(), { metadata: { contentType: type } });
  } else {
    // R2：流式写入 + HTTP 元数据
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
    });
  }

  // R32：图片走自家路由 /img/<key>（相对路径，浏览器自动用当前域名），无需任何公开地址配置
  return json({ ok: true, key, url: '/img/' + key });
}
