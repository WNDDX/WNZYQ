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
import { json, requireAuth, readJSON } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.sort, c.parent_id, c.is_hidden,
            (SELECT COUNT(*) FROM products p WHERE p.cid = c.id) AS cnt
     FROM categories c
     ORDER BY c.sort ASC, c.id ASC`
  ).all();

  // 「全部」(id=0) 的 cnt = 全部资源数（前端加载时未拉到资源列表前先用此值展示）
  let total = 0;
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first();
    total = row ? row.n : 0;
  } catch (e) { /* 计数失败按 0 兜底，不影响列表返回 */ }
  const list = (results || []).map((c) => {
    if (Number(c.id) === 0) c.cnt = total;
    return c;
  });

  return json({ ok: true, list: list });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const name = String(b.name || '').trim();
  if (!name) return json({ ok: false, msg: '请填写分类名称' }, 400);

  // 二级分类必须挂在一个存在的一级分类下；一级分类 parent_id 固定 0
  const parentId = Number(b.parent_id) || 0;
  if (parentId !== 0) {
    const parent = await env.DB.prepare(
      'SELECT id, parent_id FROM categories WHERE id = ?'
    ).bind(parentId).first();
    if (!parent) return json({ ok: false, msg: '所属一级分类不存在' }, 400);
    // 只允许两级：父分类自身必须是一级
    if (Number(parent.parent_id) !== 0) return json({ ok: false, msg: '仅支持两级分类' }, 400);
  }

  const r = await env.DB.prepare(
    'INSERT INTO categories (name, sort, parent_id, is_hidden) VALUES (?,?,?,?)'
  )
    .bind(name, Number(b.sort) || 0, parentId, b.is_hidden ? 1 : 0)
    .run();

  return json({ ok: true, id: r.meta.last_row_id });
}
