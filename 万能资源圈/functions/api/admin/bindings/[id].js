/**
 * DELETE /api/admin/bindings/:id   解绑一台设备（需登录）
 * 宽松模式下解绑不影响其它已绑定设备；被解绑的设备下次需重新验码（若码未换则旧码仍可重新绑定）
 * #116 复检修正：解绑是资源编辑动作——sub 需有编辑权且该绑定所属资源在授权范围内（此前任何登录者可解绑全站任意设备）
 */
import { json, requireAuth, ensureBindingsTable } from '../../../_utils.js';

export async function onRequestDelete(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;
  await ensureBindingsTable(env);

  const id = Number(context.params.id) || 0;
  if (!id) return json({ ok: false, msg: '参数错误' }, 400);

  /* #116：先查绑定所属资源 → 功能锁 + 范围锁（super 不限） */
  const b = await env.DB.prepare(
    'SELECT rb.variant_id, v.product_id, p.cid, p.deleted_at FROM resource_bindings rb JOIN product_variants v ON v.id = rb.variant_id JOIN products p ON p.id = v.product_id WHERE rb.id = ?'
  ).bind(id).first();
  if (!b || b.deleted_at) return json({ ok: false, msg: '该绑定记录不存在或已删除' }, 404);
  if (auth.role !== 'super') {
    const { parsePerms, can, catAllowed } = await import('../../../_perms.js');
    const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
    if (!can('products.edit', auth.role, perms)) return json({ ok: false, msg: '该功能未开放' }, 403);
    if (!catAllowed(Number(b.cid) || 0, auth.role, perms)) return json({ ok: false, msg: '该功能未开放' }, 403);
  }

  const r = await env.DB.prepare('DELETE FROM resource_bindings WHERE id = ?').bind(id).run();
  if (!r.meta || !r.meta.changes) return json({ ok: false, msg: '该绑定记录不存在或已删除' }, 404);
  try { const { audit } = await import('../../../_utils.js'); await audit(env, request, '解绑设备', '绑定#' + id); } catch (e) {}
  return json({ ok: true, msg: '已解绑' });
}
