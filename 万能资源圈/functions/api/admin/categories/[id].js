/**
 * 分类管理（带 id），需登录
 * PUT    /api/admin/categories/:id    → 修改分类  body: { name, sort, parent_id, is_hidden }
 * DELETE /api/admin/categories/:id    → 删除分类（id=0"全部"不可删，同时删其子分类）
 */
import { json, requireAuth, readJSON } from '../../../_utils.js';

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  const b = await readJSON(request);
  const name = String(b.name || '').trim();
  if (!id || id === 0) return json({ ok: false, msg: '该分类不可修改' }, 400);
  if (!name) return json({ ok: false, msg: '请填写分类名称' }, 400);

  const parentId = Number(b.parent_id) || 0;
  if (parentId === id) return json({ ok: false, msg: '父分类不能是自己' }, 400);
  if (parentId > 0) {
    const parent = await env.DB.prepare('SELECT id, parent_id FROM categories WHERE id = ?').bind(parentId).first();
    if (!parent) return json({ ok: false, msg: '父分类不存在' }, 400);
    if (parent.parent_id !== 0) return json({ ok: false, msg: '只能选择一级分类作为父级' }, 400);
  }

  await env.DB.prepare('UPDATE categories SET name = ?, sort = ?, parent_id = ?, is_hidden = ? WHERE id = ?')
    .bind(name, Number(b.sort) || 0, parentId, b.is_hidden ? 1 : 0, id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id || id === 0) return json({ ok: false, msg: '"全部"分类不可删除' }, 400);

  const childIds = await env.DB.prepare('SELECT id FROM categories WHERE parent_id = ?').bind(id).all();
  const allIds = [id, ...childIds.results.map((c) => c.id)];
  const placeholders = allIds.map(() => '?').join(',');
  await env.DB.prepare(`UPDATE products SET cid = 0 WHERE cid IN (${placeholders})`).bind(...allIds).run();

  await env.DB.prepare('DELETE FROM categories WHERE parent_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
