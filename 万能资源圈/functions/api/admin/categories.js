/**
 * 管理后台分类接口（需登录）
 * GET  /api/admin/categories   → 全部分类列表（含隐藏），带每分类资源数 cnt
 * POST /api/admin/categories   → 新增分类，返回新 id
 * body: { name, sort, parent_id, is_hidden }
 *
 * 契约与前端 assets/admin.js 对齐：
 *  - 列表按 sort ASC, id ASC；id=0 为虚拟根分类「全部」，由建表默认数据写入
 *  - cnt = 该分类下全部资源数（含隐藏/下架，后台管理口径，与前端 refreshCatCnts 一致）
 */
import { json, requireAuth, requirePerm, ensureAdminUsers, readJSON } from '../../_utils.js';

export async function onRequestGet(context) {
  await ensureAdminUsers(env);
  const { env, request } = context;
  const auth = await requirePerm(env, request, 'cats.view');
  if (auth instanceof Response) return auth;

  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.sort, c.parent_id, c.is_hidden,
            (SELECT COUNT(*) FROM products p WHERE p.cid = c.id AND p.deleted_at IS NULL) AS cnt
     FROM categories c WHERE c.deleted_at IS NULL
     ORDER BY c.sort ASC, c.id ASC`
  ).all();

  // 「全部」(id=0) 的 cnt = 全部资源数（前端加载时未拉到资源列表前先用此值展示）
  let total = 0;
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE deleted_at IS NULL').first();
    total = row ? row.n : 0;
  } catch (e) { /* 计数失败按 0 兜底，不影响列表返回 */ }
  /* #116 范围锁：子账号的分类下拉只含授权分类（cnt 对未授权分类清零展示意义不大，直接不返回） */
  const myPerms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
  let list = (results || []).map((c) => {
    if (Number(c.id) === 0) c.cnt = total;
    return c;
  });
  if (auth.role !== 'super' && myPerms && myPerms.catsScope !== 'all') {
    const allowed = myPerms.catsScope || [];
    list = list.filter((c) => allowed.indexOf(Number(c.id)) !== -1 || Number(c.id) === 0);
  }

  return json({ ok: true, list: list });
}

export async function onRequestPost(context) {
  await ensureAdminUsers(env);
  const { env, request } = context;
  const auth = await requirePerm(env, request, 'cats.add');
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const name = String(b.name || '').trim();
  if (!name) return json({ ok: false, msg: '请填写分类名称' }, 400);

  // 二级分类必须挂在一个存在的一级分类下；一级分类 parent_id 固定 0
  const parentId = Number(b.parent_id) || 0;
  /* #116 复检修正：sub 挂二级分类时，上级一级必须在授权范围内（不许往别人的一级下挂） */
  if (parentId !== 0 && auth.role !== 'super') {
    const { catAllowed } = await import('../../_perms.js');
    if (!catAllowed(parentId, auth.role, typeof auth.perms === 'string' ? parsePerms(auth.perms) : null)) {
      return json({ ok: false, msg: '该功能未开放' }, 403);
    }
  }
  if (parentId !== 0) {
    const parent = await env.DB.prepare(
      'SELECT id, parent_id FROM categories WHERE id = ? AND deleted_at IS NULL'
    ).bind(parentId).first();
    if (!parent) return json({ ok: false, msg: '所属一级分类不存在' }, 400);
    // 只允许两级：父分类自身必须是一级
    if (Number(parent.parent_id) !== 0) return json({ ok: false, msg: '仅支持两级分类' }, 400);
  }

  const r = await env.DB.prepare(
    'INSERT INTO categories (name, sort, parent_id, is_hidden, created_by) VALUES (?,?,?,?,?)'
  )
    .bind(name, Number(b.sort) || 0, parentId, b.is_hidden ? 1 : 0, auth.username) /* #116：分类创建者 */
    .run();

  try { const { audit } = await import('../../_utils.js'); await audit(env, request, '新增分类', name); } catch (e) {}
  return json({ ok: true, id: r.meta.last_row_id });
}
