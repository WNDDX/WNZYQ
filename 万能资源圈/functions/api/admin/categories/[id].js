/**
 * 管理后台分类的更新/删除（需登录）
 * PUT    /api/admin/categories/:id   → 更新分类（支持部分字段：name/sort/parent_id/is_hidden 任一组合）
 * DELETE /api/admin/categories/:id   → 删除分类（子分类一并删除，其下资源归入「全部」cid=0）
 *
 * 契约与前端 assets/admin.js 对齐：
 *  - 单字段更新：{ is_hidden } 切换显示隐藏；{ sort } 拖拽排序保存
 *  - 完整保存：{ name, sort, parent_id, is_hidden }（编辑弹窗确定）
 */
import { audit, clearPublicCache, ensureAdminUsers, ensureSoftDelete, json, readJSON, requireAuth, requirePerm } from '../../../_utils.js';
import { parsePerms, catAllowed } from '../../../_perms.js';

/* #116：sub 只能改/删自己创建的分类（cats.edit/del），超管不限 */
async function catScopeOk(env, auth, catId, needEdit) {
  const row = await env.DB.prepare('SELECT id, created_by FROM categories WHERE id = ? AND deleted_at IS NULL').bind(Number(catId) || 0).first();
  if (!row) return { ok: false, missing: true };
  if (auth.role === 'super') return { ok: true, row };
  const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
  if (!catAllowed(Number(catId) || 0, auth.role, perms)) return { ok: false };
  if (row.created_by !== auth.username) return { ok: false }; /* 上级建的分类不能动 */
  return { ok: true, row };
}

// 允许更新的字段白名单（防止请求体传入非法字段名）
const ALLOWED_CAT_FIELDS = ['name', 'sort', 'parent_id', 'is_hidden'];

export async function onRequestPut(context) {
  const { env, request, params } = context;

  await ensureSoftDelete(env); /* v440：先迁移软删列（线上旧库无此列，缺它接口 500） */  await ensureAdminUsers(env);
  const auth = await requirePerm(env, request, 'cats.edit');
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少分类 id' }, 400); // 「全部」(id=0) 不可改
  const _sc = await catScopeOk(env, auth, id, true);
  if (!_sc.ok) return json({ ok: false, msg: '该功能未开放' }, 403);

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
      const parent = await env.DB.prepare('SELECT id, parent_id FROM categories WHERE id = ? AND deleted_at IS NULL').bind(parentId).first();
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
  try { const { audit } = await import('../../../_utils.js'); await audit(env, request, '修改分类', '#' + id); } catch (e) {}
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  try { /* v441b：错误自曝壳——线上 500 黑盒改为返回具体错误 */
  const { env, request, params } = context;

  await ensureSoftDelete(env); /* v440：先迁移软删列（线上旧库无此列，缺它接口 500） */  await ensureAdminUsers(env);
  const auth = await requirePerm(env, request, 'cats.del');
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少分类 id' }, 400); // 「全部」(id=0) 不可删
  const _sc = await catScopeOk(env, auth, id, false);
  if (!_sc.ok) return json({ ok: false, msg: '该功能未开放' }, 403);

  // 子分类 id 一并删除
  const { results: children } = await env.DB.prepare(
    'SELECT id FROM categories WHERE parent_id = ? AND deleted_at IS NULL'
  ).bind(id).all();
  const ids = [id, ...(children || []).map((c) => Number(c.id))];

  /* v439 #68：删除改软删除（进回收站保 60 天）——子分类一并进回收站；其下资源保持原分类归属（恢复即还原） */
  /* v441b 修复：原来这里又动态 import 了一次与头部静态 import 同名的 ensureSoftDelete——
     Cloudflare 打包时把同名符号改名成 ensureSoftDelete2 且声明被放到调用点之后 → TDZ「Cannot access before initialization」→ 删除分类一直 500。
     头部已静态引入 ensureSoftDelete/audit，直接用即可（全站已扫，仅此一处同名冲突）。 */
  const placeholders = ids.map(() => '?').join(',');
  await env.DB.prepare(
    `UPDATE categories SET deleted_at = datetime('now') WHERE id IN (${placeholders})`
  ).bind(...ids).run();
  await audit(env, request, '删除分类（进回收站）', ids.length + ' 个');

  await clearPublicCache(request);
  return json({ ok: true });
  } catch (eD) { return json({ ok: false, msg: '删除分类错误: ' + (eD && eD.message ? eD.message : String(eD)) }, 500); }
}
