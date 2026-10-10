/**
 * POST /api/admin/cleanup-files
 * 自动清理没被引用的上传文件（v351 C2，用户拍板：不要手动清理入口，要自动删）
 * body: { keys: ['files/2026/10/uuid.pdf', 'images/2026/10/uuid_t.webp', ...] }
 * 安全：①需登录；②key 白名单校验；③删前逐个核对该 key 是否仍被任何资源/类型引用，被引用的一律保留；
 *     ④单次最多 200 个 key。
 */
import { json, requireAuth, readJSON } from '../../_utils.js';

const KEY_RE = /^(?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}\.[a-zA-Z0-9]+(?:_t)?$/;
const P_FIELDS = ['img', 'detail', 'detail_images', 'detail_videos', 'resource_content'];
const V_FIELDS = ['desc', 'img', 'video', 'resource_content'];

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const keys = Array.isArray(b.keys)
    ? b.keys.map(String).filter(function (k) { return KEY_RE.test(k); }).slice(0, 200)
    : [];
  if (!keys.length) return json({ ok: true, deleted: 0 });

  const bucket = env.IMAGE_BUCKET;
  if (!bucket) return json({ ok: false, msg: '存储未绑定（IMAGE_BUCKET）' }, 400);

  let deleted = 0;
  for (const key of keys) {
    /* 删前引用核对：任何资源/类型的任何字段里还出现这个 key，就坚决不删 */
    let used = true;
    try {
      const like = '%' + key + '%';
      const pSel = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM products WHERE ' + P_FIELDS.map(function (f) { return '"' + f + '" LIKE ?'; }).join(' OR ')
      ).bind.apply(null, [like, like, like, like, like]).first();
      const vSel = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM product_variants WHERE ' + V_FIELDS.map(function (f) { return '"' + f + '" LIKE ?'; }).join(' OR ')
      ).bind.apply(null, [like, like, like, like]).first();
      used = ((pSel && pSel.n) || 0) > 0 || ((vSel && vSel.n) || 0) > 0;
    } catch (e) { used = true; } /* 核对失败宁可保留，绝不误删 */
    if (used) continue;
    try { await bucket.delete(key); deleted++; } catch (e) { /* 单个失败不影响其余 */ }
  }
  return json({ ok: true, deleted: deleted });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
