/**
 * POST /api/admin/upload-image → 上传图片到自有图仓
 * 绑定名 IMAGE_BUCKET，两种桶都支持（自动识别，均绑到 Pages 的函数绑定里）：
 *   ① KV 命名空间（免费层 1GB 存储，无需绑卡——推荐）
 *   ② R2 存储桶（需绑卡验证；绑了也能用）
 * 需登录。图片通过本站路由 /img/<key> 访问（自家域名 + CDN 缓存，无需填任何公开地址）。
 * R32：改为免绑卡 KV 方案 + 自家路由直出，URL 为相对路径 /img/...
 */
import { json, requireAuth , putToBucket, recordUpload } from '../../_utils.js';

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

  /* R304 P18（用户 09-30 02:00「列表和管理页用小图」）：mode=thumb 存量补生成——
     管理页后台首次访问发现小图 404 时，前端 canvas 生成 webp 小图补传到原图同目录。
     base=原图 key（须匹配图仓图片正则），小图 key = 同目录 uuid_t.webp。 */
  const THUMB_BASE_RE = /^images\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i;
  if (String(form.get('mode') || '') === 'thumb') {
    const base = String(form.get('base') || '');
    if (!THUMB_BASE_RE.test(base)) return json({ ok: false, msg: 'base 不合法' }, 400);
    if (file.type !== 'image/webp') return json({ ok: false, msg: '小图只支持 webp' }, 400);
    if (file.size > 2 * 1024 * 1024) return json({ ok: false, msg: '小图超过 2MB' }, 400);
    const tkey = base.replace(/\.(png|jpe?g|webp|gif)$/i, '_t.webp');
    if (isKVBucket(bucket)) {
      await bucket.put(tkey, await file.arrayBuffer(), { metadata: { contentType: 'image/webp' } });
    } else {
      await bucket.put(tkey, file.stream(), {
        httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
      });
    }
    try { await recordUpload(env, tkey); } catch (e) {} /* v354：记台账（24h 保护期依据） */
    return json({ ok: true, key: tkey, url: '/img/' + tkey });
  }

  const type = String(file.type || '').toLowerCase();
  const ext = ALLOWED_TYPES[type];
  if (!ext) return json({ ok: false, msg: '只支持 png / jpg / webp / gif 图片' }, 400);
  /* R307 U6/U7（用户 09-30 拍板「全系统图片和视频都不做这种限制，取消检查」）：
     后端图片 10MB 硬性拒绝已移除。图片「超 10MB 先压缩」由前端 canvas 链处理
     （admin.js needCompress：非 PNG >1.5MB / PNG >8MB 自动压缩后再传），后端不再拦截。
     平台侧：KV 单值 25MB（Cloudflare 硬上限，代码无法解除）；R2 无限制。 */

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

  /* R304 P18：file2 = 前端 canvas 生成的小图（最大边 400px、webp、q0.8），随原图同一请求
     提交，存为同目录 uuid_t.webp；缺 file2（老前端/生成失败）不报错，小图缺失读取侧回退原图 */
  const file2 = form.get('file2');
  if (file2 && typeof file2 !== 'string' && file2.size > 0 && file2.size <= 2 * 1024 * 1024) {
    try {
      const tkey = key.replace(/\.(png|jpe?g|webp|gif)$/i, '_t.webp');
      if (isKVBucket(bucket)) {
        await bucket.put(tkey, await file2.arrayBuffer(), { metadata: { contentType: 'image/webp' } });
      } else {
        await bucket.put(tkey, file2.stream(), {
          httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
        });
      }
    } catch (e) { /* 小图写失败不阻塞原图 */ }
  }

  // R32：图片走自家路由 /img/<key>（相对路径，浏览器自动用当前域名），无需任何公开地址配置
  return json({ ok: true, key, url: '/img/' + key });
}
