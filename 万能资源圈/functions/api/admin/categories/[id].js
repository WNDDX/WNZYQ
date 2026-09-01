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
  if (!id || id === 0) return json({ ok: false, msg: '该分类不可修改' }, 400);

  // 获取当前分类信息
  const current = await env.DB.prepare('SELECT name, sort, parent_id, is_hidden FROM categories WHERE id = ?').bind(id).first();
  if (!current) return json({ ok: false, msg: '分类不存在' }, 404);

  // 如果提供了 name 就用新的，否则用原来的
  const name = b.name !== undefined ? String(b.name).trim() : current.name;
  if (!name) return json({ ok: false, msg: '请填写分类名称' }, 400);

  const sort = b.sort !== undefined ? Number(b.sort) : current.sort;
  const parentId = b.parent_id !== undefined ? Number(b.parent_id) || 0 : current.parent_id;
  const isHidden = b.is_hidden !== undefined ? (b.is_hidden ? 1 : 0) : current.is_hidden;

  if (parentId === id) return json({ ok: false, msg: '父分类不能是自己' }, 400);
  if (parentId > 0) {
    const parent = await env.DB.prepare('SELECT id, parent_id FROM categories WHERE id = ?').bind(parentId).first();
    if (!parent) return json({ ok: false, msg: '父分类不存在' }, 400);
    if (parent.parent_id !== 0) return json({ ok: false, msg: '只能选择一级分类作为父级' }, 400);
  }

  await env.DB.prepare('UPDATE categories SET name = ?, sort = ?, parent_id = ?, is_hidden = ? WHERE id = ?')
    .bind(name, sort || 0, parentId, isHidden, id).run();
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
