/**
 * 分类管理（需登录），支持两级分类（parent_id）和隐藏（is_hidden）
 * GET    /api/admin/categories        → 分类列表（含每个分类的资源数），按 sort 排序
 * POST   /api/admin/categories        → 新增分类  body: { name, sort, parent_id, is_hidden }
 * PUT    /api/admin/categories/:id    → 修改分类（见 categories/[id].js）
 * DELETE /api/admin/categories/:id    → 删除分类（见 categories/[id].js）
 */
import { json, requireAuth, readJSON } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.sort, c.parent_id, c.is_hidden, COUNT(p.id) AS cnt
     FROM categories c LEFT JOIN products p ON p.cid = c.id
     GROUP BY c.id ORDER BY c.sort ASC, c.id ASC`
  ).all();
  return json({ ok: true, list: results });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const name = String(b.name || '').trim();
  if (!name) return json({ ok: false, msg: '请填写分类名称' }, 400);

  const parentId = Number(b.parent_id) || 0;
  // 二级分类的父级必须存在且是一级分类
  if (parentId > 0) {
    const parent = await env.DB.prepare('SELECT id, parent_id FROM categories WHERE id = ?').bind(parentId).first();
    if (!parent) return json({ ok: false, msg: '父分类不存在' }, 400);
    if (parent.parent_id !== 0) return json({ ok: false, msg: '只能选择一级分类作为父级' }, 400);
  }

  const max = await env.DB.prepare('SELECT MAX(id) AS m FROM categories').first();
  const newId = (max && max.m) ? max.m + 1 : 1;
  await env.DB.prepare('INSERT INTO categories (id, name, sort, parent_id, is_hidden) VALUES (?, ?, ?, ?, ?)')
    .bind(newId, name, Number(b.sort) || 0, parentId, b.is_hidden ? 1 : 0).run();

  return json({ ok: true, id: newId });
}
