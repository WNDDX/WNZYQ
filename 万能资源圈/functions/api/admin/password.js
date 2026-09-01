/**
 * POST /api/admin/password
 * 修改管理员密码（需登录），生成新盐
 * body: { oldPassword, newPassword }
 */
import { json, requireAuth, readJSON, hashPasswordWithSalt, randomSalt } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const oldPassword = String(b.oldPassword || '');
  const newPassword = String(b.newPassword || '');

  if (!newPassword) return json({ ok: false, msg: '新密码不能为空' }, 400);

  const row = await env.DB.prepare('SELECT * FROM admins WHERE id = ?').bind(auth.id).first();
  if (!row) return json({ ok: false, msg: '管理员不存在' }, 404);

  // 验证旧密码（带盐）
  const oldSalt = row.salt || '';
  const oldHash = await hashPasswordWithSalt(oldPassword, oldSalt);
  if (oldHash !== row.password_hash) return json({ ok: false, msg: '原密码错误' }, 401);

  // 生成新盐和新哈希
  const newSalt = randomSalt();
  const newHash = await hashPasswordWithSalt(newPassword, newSalt);
  await env.DB.prepare('UPDATE admins SET password_hash = ?, salt = ? WHERE id = ?')
    .bind(newHash, newSalt, auth.id).run();

  return json({ ok: true, msg: '密码已修改' });
}
