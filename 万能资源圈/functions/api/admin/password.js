/**
 * POST /api/admin/password
 * 修改管理员密码（需登录），生成新盐
 * body: { oldPassword, newPassword }
 */
import { json, requireAuth, readJSON, verifyPassword, hashPasswordNew } from '../../_utils.js';

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

  // 验证旧密码（R29：兼容旧 SHA256 与新 PBKDF2 格式）
  const v = await verifyPassword(oldPassword, row);
  if (!v.ok) return json({ ok: false, msg: '原密码错误' }, 401);

  // 新密码一律用 PBKDF2 多轮哈希
  const { salt: newSalt, hash: newHash } = await hashPasswordNew(newPassword);
  await env.DB.prepare('UPDATE admins SET password_hash = ?, salt = ? WHERE id = ?')
    .bind(newHash, newSalt, auth.id).run();

  return json({ ok: true, msg: '密码已修改' });
}
