/**
 * DELETE /api/admin/bindings/:id   解绑一台设备（需登录）
 * 宽松模式下解绑不影响其它已绑定设备；被解绑的设备下次需重新验码（若码未换则旧码仍可重新绑定）
 */
import { json, requireAuth, ensureBindingsTable } from '../../../_utils.js';

export async function onRequestDelete(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;
  await ensureBindingsTable(env);

  const id = Number(context.params.id) || 0;
  if (!id) return json({ ok: false, msg: '参数错误' }, 400);

  const r = await env.DB.prepare('DELETE FROM resource_bindings WHERE id = ?').bind(id).run();
  if (!r.meta || !r.meta.changes) return json({ ok: false, msg: '该绑定记录不存在或已删除' }, 404);
  return json({ ok: true, msg: '已解绑' });
}
