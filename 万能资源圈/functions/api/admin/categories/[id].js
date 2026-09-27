/**
 * 管理后台分类的更新/删除（需登录）
 * PUT    /api/admin/categories/:id   → 更新分类（支持部分字段：name/sort/parent_id/is_hidden 任一组合）
 * DELETE /api/admin/categories/:id   → 删除分类（子分类一并删除，其下资源归入「全部」cid=0）
 *
 * 契约与前端 assets/admin.js 对齐：
 *  - 单字段更新：{ is_hidden } 切换显示隐藏；{ sort } 拖拽排序保存
 *  - 完整保存：{ name, sort, parent_id, is_hidden }（编辑弹窗确定）
 */
import { json, requireAuth, readJSON, clearPublicCache } from '../../../_utils.js';

// 允许更新的字段白名单（防止请求体传入非法字段名）
const ALLOWED_CAT_FIELDS = ['name', 'sort', 'parent_id', 'is_hidden'];

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少分类 id' }, 400); // 「全部」(id=0) 不可改

  const b = await readJSON(request);
  const sets = [];
  const vals = [];

  // 只处理白名单内的字段
  if (b.name !== undefined && ALLOWED_CAT_FIELDS.includes('name')) {
    const name = String(b.name || '').trim();
    if (!name) return json({ ok: false, msg: '请填写分类名称' }, 400);
    sets.push('name=?'); vals.push(name);
  }
  if (b.sort !== undefined && ALLOWED_CAT_FIELDS.includes('sort')) { sets.push('sort=?'); vals.push(Number(b.sort) || 0); }
  if (b.parent_id !== undefined && ALLOWED_CAT_FIELDS.includes('parent_id')) {
    const parentId = Number(b.parent_id) || 0;
    if (parentId !== 0) {
      const parent = await env.DB.prepare('SELECT id, parent_id FROM categories WHERE id = ?').bind(parentId).first();
      if (!parent) return json({ ok: false, msg: '所属一级分类不存在' }, 400);
      if (Number(parent.parent_id) !== 0) return json({ ok: false, msg: '仅支持两级分类' }, 400);
      if (Number(parent.id) === id) return json({ ok: false, msg: '不能挂在自己的下面' }, 400);
    }
    sets.push('parent_id=?'); vals.push(parentId);
  }
  if (b.is_hidden !== undefined && ALLOWED_CAT_FIELDS.includes('is_hidden')) { sets.push('is_hidden=?'); vals.push(b.is_hidden ? 1 : 0); }

  if (!sets.length) return json({ ok: false, msg: '没有要更新的字段' }, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id=?`).bind(...vals).run();

  await clearPublicCache(request);
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少分类 id' }, 400); // 「全部」(id=0) 不可删

  // 子分类 id 一并删除
  const { results: children } = await env.DB.prepare(
    'SELECT id FROM categories WHERE parent_id = ?'
  ).bind(id).all();
  const ids = [id, ...(children || []).map((c) => Number(c.id))];

  // 其下资源归入「全部」(cid=0)，与前端确认弹窗文案「其下资源将归入全部」一致
  const placeholders = ids.map(() => '?').join(',');
  await env.DB.prepare(
    `UPDATE products SET cid = 0 WHERE cid IN (${placeholders})`
  ).bind(...ids).run();
  await env.DB.prepare(
    `DELETE FROM categories WHERE id IN (${placeholders})`
  ).bind(...ids).run();

  await clearPublicCache(request);
  return json({ ok: true });
}
