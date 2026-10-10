/**
 * POST /api/admin/cleanup-files
 * 自动清理没被引用的上传文件（v351 C2，用户拍板：不要手动清理入口，要自动删）
 * body: { keys: ['files/2026/10/uuid.pdf', 'images/2026/10/uuid_t.webp', ...] }
 * 安全：①需登录；②key 白名单校验；③删前逐个核对该 key 是否仍被任何资源/类型引用，被引用的一律保留；
 *     ④单次最多 200 个 key。
 */
import { json, requireAuth, readJSON, buildContentText } from '../../_utils.js';

const KEY_RE = /^(?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}(?:_t)?\.[a-zA-Z0-9]+$/;
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

  /* v354：引用核对升级——一次拉全库内容（资源+类型+设置，公告也在 settings 里），更快也更全 */
  const contentText = await buildContentText(env);
  let deleted = 0;
  for (const key of keys) {
    if (contentText === null) break; /* 核对失败宁可全保留，绝不误删 */
    if (contentText.indexOf(key) !== -1) continue; /* 仍被引用，坚决不删 */
    try { await bucket.delete(key); deleted++; } catch (e) { /* 单个失败不影响其余 */ }
  }
  return json({ ok: true, deleted: deleted });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
