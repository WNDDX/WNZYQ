/**
 * v439 #116 多管理员子账号管理（仅 super 或有 users 权限者）
 * GET    /api/admin/users          → 列表（含权限/状态/备注/最近登录/子树规模）
 * POST   /api/admin/users          → 创建 { username, password, note, perms, parentId }
 * PUT    /api/admin/users          → 编辑 { id, op: 'update'|'resetpwd'|'status'|'transfer'|'move', ... }
 * DELETE /api/admin/users?id=      → 删除（其下级账号统一上移成为超管下级）
 * 安全：授出权限必须是授者权限子集；防环；动作全部留痕
 */
import { json, readJSON, hashPasswordNew, requireAuth, ensureAdminUsers, audit } from '../../_utils.js';
import { parsePerms, superPerms, validateGrant, treeMoveOk } from '../../_perms.js';

/* #116 复检修正：范围锁勾一级分类自动含其下二级（否则二级资源看不到） */
async function expandCatsScope(env, ids) {
  if (!Array.isArray(ids) || !ids.length) return ids;
  const clean = ids.map(Number).filter(x => x > 0);
  if (!clean.length) return [];
  const ph = clean.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT id FROM categories WHERE deleted_at IS NULL AND (id IN (${ph}) OR parent_id IN (${ph}))`
  ).bind(...clean, ...clean).all();
  const set = new Set(clean);
  for (const r of (results || [])) set.add(Number(r.id));
  return Array.from(set);
}

/* 当前操作者权限对象（super 用 superPerms） */
function myPerms(me) {
  return me.role === 'super' ? superPerms() : parsePerms(me.perms);
}

/* 取自己的后代 id 集合（防环用） */
async function descendantIds(env, rootId) {
  const all = await env.DB.prepare('SELECT id, parent_id FROM admin_users').all();
  const byParent = {};
  for (const r of (all.results || [])) { (byParent[r.parent_id] = byParent[r.parent_id] || []).push(r.id); }
  const out = [];
  const walk = (id) => { (byParent[id] || []).forEach(cid => { out.push(cid); walk(cid); }); };
  walk(rootId);
  return out;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  await ensureAdminUsers(env);
  const me = await requireAuth(env, request);
  if (me instanceof Response) return me;
  const { can, parsePerms } = await import('../../_perms.js');
  const perms = typeof me.perms === 'string' ? parsePerms(me.perms) : null;
  if (!can('users', me.role, perms)) return json({ ok: false, msg: '该功能未开放' }, 403);
  /* super 看全部；sub 管理员看自己名下整棵树 */
  let rows;
  if (me.role === 'super') {
    rows = (await env.DB.prepare('SELECT id, username, role, parent_id, perms, status, note, created_at, last_seen FROM admin_users ORDER BY id ASC').all()).results || [];
  } else {
    const all = (await env.DB.prepare('SELECT id, username, role, parent_id, perms, status, note, created_at, last_seen FROM admin_users ORDER BY id ASC').all()).results || [];
    const mine = all.filter(r => r.id === me.id);
    const byParent = {};
    all.forEach(r => { (byParent[r.parent_id] = byParent[r.parent_id] || []).push(r); });
    const tree = [];
    const walk = id => (byParent[id] || []).forEach(r => { tree.push(r); walk(r.id); });
    walk(me.id);
    rows = mine.concat(tree);
  }
  const safe = rows.map(r => ({
    id: r.id, username: r.username, role: r.role, parentId: r.parent_id,
    perms: r.perms, status: r.status, note: r.note, createdAt: r.created_at, lastSeen: r.last_seen,
    subtreeCount: 0,
  }));
  /* 子树规模（列表展示用） */
  const byParent = {};
  safe.forEach(r => { (byParent[r.parentId] = byParent[r.parentId] || []).push(r); });
  const cnt = r => { let n = 0; (byParent[r.id] || []).forEach(c => { n += 1 + cnt(c); }); return n; };
  safe.forEach(r => { r.subtreeCount = cnt(r); });
  /* #116：直接下级数（删除确认文案口径——只有直接下级上移到超管） */
  safe.forEach(r => { r.childrenCount = (byParent[r.id] || []).length; });
  return json({ ok: true, list: safe, me: { id: me.id, username: me.username, role: me.role } });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  await ensureAdminUsers(env);
  const me = await requireAuth(env, request);
  if (me instanceof Response) return me;
  const { can, parsePerms } = await import('../../_perms.js');
  const myPermsObj = typeof me.perms === 'string' ? parsePerms(me.perms) : null;
  if (!can('users', me.role, myPermsObj)) return json({ ok: false, msg: '该功能未开放' }, 403);

  const b = await readJSON(request);
  const username = String(b.username || '').trim();
  const password = String(b.password || '');
  const note = String(b.note || '').slice(0, 100);
  const parentId = me.role === 'super' ? (Number(b.parentId) || 0) : me.id; /* 子管理员只能挂在自己名下 */
  if (!/^[A-Za-z0-9_\-]{2,20}$/.test(username)) return json({ ok: false, msg: '用户名 2-20 位，仅字母数字下划线横线' }, 400);
  if (password.length < 6 || password.length > 50) return json({ ok: false, msg: '密码 6-50 位' }, 400);

  const dup = await env.DB.prepare('SELECT id FROM admin_users WHERE username = ?').bind(username).first();
  const dupA = await env.DB.prepare('SELECT id FROM admins WHERE username = ?').bind(username).first();
  if (dup || dupA) return json({ ok: false, msg: '用户名已存在' }, 400);

  /* 权限子集校验（授出权限必须是自己的子集） */
  const grantorPerms = myPerms(me);
  const v = validateGrant(b.perms || {}, me.role, grantorPerms);
  if (!v.ok) return json({ ok: false, msg: '权限超出您的范围：' + v.violations.join('、') }, 400);
  /* 范围校验：parentId 必须是自己的下级树内账号或自己（防认错爹） */
  if (parentId !== 0 && me.role === 'super') {
    /* 超管可挂任意已有账号下 */
    const t = await env.DB.prepare('SELECT id FROM admin_users WHERE id = ?').bind(parentId).first();
    if (!t) return json({ ok: false, msg: '上级账号不存在' }, 400);
  }

  const { salt, hash } = await hashPasswordNew(password);
  try { if (b.perms && Array.isArray(b.perms.catsScope)) b.perms.catsScope = await expandCatsScope(env, b.perms.catsScope); } catch (e) { /* 展开失败按原勾选 */ }
  const permsJson = JSON.stringify(b.perms || {});
  const r = await env.DB.prepare('INSERT INTO admin_users (username, pwd_hash, salt, role, parent_id, perms, status, note) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
    .bind(username, hash, salt, 'sub', parentId, permsJson, note).run();
  await audit(env, request, '创建子账号', username + (note ? '（' + note + '）' : ''));
  return json({ ok: true, id: r.meta && r.meta.last_row_id });
}

export async function onRequestPut(context) {
  const { env, request } = context;
  await ensureAdminUsers(env);
  const me = await requireAuth(env, request);
  if (me instanceof Response) return me;
  const { can, parsePerms } = await import('../../_perms.js');
  const myPermsObj = typeof me.perms === 'string' ? parsePerms(me.perms) : null;
  if (!can('users', me.role, myPermsObj)) return json({ ok: false, msg: '该功能未开放' }, 403);

  const b = await readJSON(request);
  const id = Number(b.id) || 0;
  const op = String(b.op || 'update');
  if (!id) return json({ ok: false, msg: '缺少账号 id' }, 400);
  const target = await env.DB.prepare('SELECT id, username, role, parent_id, perms FROM admin_users WHERE id = ?').bind(id).first();
  if (!target) return json({ ok: false, msg: '账号不存在' }, 404);
  /* 权限边界：sub 管理员只能操作自己名下整棵树；super 全部 */
  if (me.role !== 'super') {
    const desc = await descendantIds(env, me.id);
    if (desc.indexOf(id) === -1) return json({ ok: false, msg: '该功能未开放' }, 403);
  }

  if (op === 'update') {
    const v = validateGrant(b.perms || {}, me.role, myPerms(me));
    if (!v.ok) return json({ ok: false, msg: '权限超出您的范围：' + v.violations.join('、') }, 400);
    const note = String(b.note != null ? b.note : '').slice(0, 100);
    /* #116 复检修正：范围勾选展开子分类（与创建口径一致） */
    try { if (b.perms && Array.isArray(b.perms.catsScope)) b.perms.catsScope = await expandCatsScope(env, b.perms.catsScope); } catch (e) { /* 展开失败按原勾选 */ }
    await env.DB.prepare('UPDATE admin_users SET perms = ?, note = ? WHERE id = ?')
      .bind(JSON.stringify(b.perms || {}), note, id).run();
    await audit(env, request, '修改子账号权限', target.username + (note ? '（' + note + '）' : ''));
    return json({ ok: true });
  }
  if (op === 'resetpwd') {
    /* 绝对管理权：super 改任何下级密码，不需要旧密码 */
    const password = String(b.password || '');
    if (password.length < 6 || password.length > 50) return json({ ok: false, msg: '密码 6-50 位' }, 400);
    const { salt, hash } = await hashPasswordNew(password);
    await env.DB.prepare('UPDATE admin_users SET pwd_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE admin_id = ? AND utype = ?').bind(id, 'u').run(); /* 改密即踢下线 */
    await audit(env, request, '重置子账号密码', target.username);
    return json({ ok: true });
  }
  if (op === 'status') {
    const status = Number(b.status) ? 1 : 0;
    await env.DB.prepare('UPDATE admin_users SET status = ? WHERE id = ?').bind(status, id).run();
    if (!status) await env.DB.prepare('DELETE FROM sessions WHERE admin_id = ? AND utype = ?').bind(id, 'u').run(); /* 停用即踢下线 */
    await audit(env, request, status ? '启用子账号' : '停用子账号', target.username);
    return json({ ok: true });
  }
  if (op === 'move') {
    /* 挪树：换上级。防环 + sub 只能挪自己树内 */
    const newParent = Number(b.newParentId) || 0;
    const desc = await descendantIds(env, id);
    if (!treeMoveOk(newParent, id, desc)) return json({ ok: false, msg: '不能把自己或自己的下级设为上级' }, 400);
    if (me.role !== 'super') {
      if (newParent !== 0 && newParent !== me.id) {
        const descMe = await descendantIds(env, me.id);
        if (descMe.indexOf(newParent) === -1) return json({ ok: false, msg: '只能挪到自己名下' }, 403);
      }
    } else if (newParent !== 0) {
      const t = await env.DB.prepare('SELECT id FROM admin_users WHERE id = ?').bind(newParent).first();
      if (!t) return json({ ok: false, msg: '上级账号不存在' }, 400);
    }
    await env.DB.prepare('UPDATE admin_users SET parent_id = ? WHERE id = ?').bind(newParent, id).run();
    await audit(env, request, '调整子账号上级', target.username + ' → ' + (newParent === 0 ? '超级管理员' : '#' + newParent));
    return json({ ok: true });
  }
  if (op === 'transfer') {
    /* 离职交接：把该账号（可选含子树）的资源与子树移交目标账号 */
    const toId = Number(b.toId) || 0;
    const to = await env.DB.prepare('SELECT id, username, role, status FROM admin_users WHERE id = ?').bind(toId).first();
    if (!to || !to.status) return json({ ok: false, msg: '接收账号不存在或已停用' }, 400);
    if (toId === id) return json({ ok: false, msg: '不能交接给自己' }, 400);
    const includeTree = !!b.includeTree;
    let ids = [id];
    if (includeTree) ids = [id].concat(await descendantIds(env, id));
    for (const uid of ids) {
      await env.DB.prepare('UPDATE products SET created_by = ? WHERE created_by = (SELECT username FROM admin_users WHERE id = ?)').bind(to.username, uid).run();
    }
    await audit(env, request, '子账号资源交接', target.username + ' → ' + to.username + (includeTree ? '（含子树 ' + ids.length + ' 个账号）' : ''));
    return json({ ok: true, moved: ids.length });
  }
  return json({ ok: false, msg: '未知操作' }, 400);
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  await ensureAdminUsers(env);
  const me = await requireAuth(env, request);
  if (me instanceof Response) return me;
  const { can, parsePerms } = await import('../../_perms.js');
  const myPermsObj = typeof me.perms === 'string' ? parsePerms(me.perms) : null;
  if (!can('users', me.role, myPermsObj)) return json({ ok: false, msg: '该功能未开放' }, 403);
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id')) || 0;
  if (!id) return json({ ok: false, msg: '缺少账号 id' }, 400);
  const target = await env.DB.prepare('SELECT id, username, role FROM admin_users WHERE id = ?').bind(id).first();
  if (!target) return json({ ok: false, msg: '账号不存在' }, 404);
  if (me.role !== 'super') {
    const desc = await descendantIds(env, me.id);
    if (desc.indexOf(id) === -1) return json({ ok: false, msg: '该功能未开放' }, 403);
  }
  /* 拍板规则：删除后其下级账号统一上移成为超级管理员（parent=0）的下级 */
  await env.DB.prepare('UPDATE admin_users SET parent_id = 0 WHERE parent_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE admin_id = ? AND utype = ?').bind(id, 'u').run();
  await env.DB.prepare('DELETE FROM admin_users WHERE id = ?').bind(id).run();
  await audit(env, request, '删除子账号', target.username + '（其下级已上移至超级管理员名下）');
  return json({ ok: true });
}
