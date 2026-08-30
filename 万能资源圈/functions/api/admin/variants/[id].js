/**
 * 资源类型的更新/删除（需登录）
 * PUT    /api/admin/variants/:id   → 更新类型
 * DELETE /api/admin/variants/:id   → 删除类型
 */
import { json, requireAuth, readJSON } from '../../../_utils.js';

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少类型 id' }, 400);

  const b = await readJSON(request);
  const name = String(b.name || '').trim();
  if (!name) return json({ ok: false, msg: '请填写类型名称' }, 400);

  await env.DB.prepare(
    `UPDATE product_variants SET name=?, "desc"=?, img=?, video=?, contact_url=?, price=?, sort=?
     WHERE id=?`
  )
    .bind(
      name,
      String(b.desc || ''),
      String(b.img || ''),
      String(b.video || ''),
      String(b.contactUrl || ''),
      Number(b.price) || 0,
      Number(b.sort) || 0,
      id
    )
    .run();

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少类型 id' }, 400);

  await env.DB.prepare('DELETE FROM product_variants WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
