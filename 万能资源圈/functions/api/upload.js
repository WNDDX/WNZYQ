/**
 * POST /api/upload
 * 通用图片上传（管理页封面图等使用）
 * v301（用户 10-05 00:00）：补回缺失接口
 */
import { json, requireAuth, recordUpload } from '../_utils.js';

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
  if (!ext) return json({ ok: false, msg: '只支持常见图片格式' }, 400);

  const now = new Date();
  const key = 'images/' + now.getUTCFullYear() + '/' + String(now.getUTCMonth() + 1).padStart(2, '0') + '/' + crypto.randomUUID() + '.' + ext;

  if (isKVBucket(bucket)) {
    await bucket.put(key, await file.arrayBuffer(), { metadata: { contentType: type } });
  } else {
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
    });
  }
  /* v688（QA 实测 P1）：记上传台账，这是 `global-cleanup` 那条「24 小时内新上传的不删」的唯一依据。
     本接口是后台轮播图槽等处的上传入口（`assets/admin-media.js`），原来**连 recordUpload 都没 import**
     → 从这里传的图刚落地就进了「可删候选」，用户还没保存就可能被清掉。与 upload-file / upload-video 同口径补齐。
     v705（老板 11-27「失败当成功」专项第 3 条）：原来这里是 `try{…}catch(e){}` 直接吞掉。
     台账既然是那条保护的**唯一依据**，写失败还继续返回 ok:true，等于给用户一个「随时会被当孤儿清掉」的地址：
     他现在看到图正常，几小时后裂图，且没有任何线索可查。
     改成：台账写失败 → 先尽量把刚传的这张删掉 → 再让本次上传**返回失败**，让用户重试。
     取舍写清楚：宁可让用户重传一次，也不给他一个会被自动删掉的地址。 */
  try {
    await recordUpload(env, key);
  } catch (e) {
    console.error('[upload] 台账写入失败，已回滚本次上传：', key, (e && e.message) || e);
    try { await bucket.delete(key); } catch (e2) { /* 删不掉就留给 global-cleanup 按孤儿兜底 */ }
    return json({ ok: false, msg: '上传记录异常，请重试' }, 500);
  }

  return json({ ok: true, key, url: '/img/' + key });
}
