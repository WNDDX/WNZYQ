/**
 * POST /api/admin/password
 * 修改管理员密码（需登录），生成新盐
 * body: { oldPassword, newPassword }
 * #116 复检修正：子账号（sessions.utype='u'）此前也走 admins 表——id 撞号时会改到超管表里别人的密码行。
       现按会话类型分表：super → admins；子账号 → admin_users（并只清理自己的子账号会话）。
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
  if (newPassword.length < 6) return json({ ok: false, msg: '新密码至少 6 位' }, 400);
  if (newPassword.length > 64) return json({ ok: false, msg: '新密码最多 64 位' }, 400);

  const isSub = auth.utype === 'u';
  const table = isSub ? 'admin_users' : 'admins';
  const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(auth.id).first();
  if (!row) return json({ ok: false, msg: '账号不存在' }, 404);

  // 验证旧密码（R29：兼容旧 SHA256 与新 PBKDF2 格式）
  const v = await verifyPassword(oldPassword, row);
  if (!v.ok) return json({ ok: false, msg: '原密码错误' }, 401);

  // 新密码一律用 PBKDF2 多轮哈希
  const { salt: newSalt, hash: newHash } = await hashPasswordNew(newPassword);
  await env.DB.prepare(`UPDATE ${table} SET password_hash = ?, salt = ? WHERE id = ?`)
    .bind(newHash, newSalt, auth.id).run();

  /* v348 条32：改完密码把该账号其它设备的登录全部作废，只保留当前这台。
     #116：按会话类型限定——子账号只清 utype='u' 的会话，避免误删同 id 超管会话（反之亦然）。 */
  try {
    let curToken = '';
    const ck = request.headers.get('Cookie') || '';
    const m = ck.match(/(?:^|;\s*)wnzyq_token=([^;]*)/);
    if (m) curToken = decodeURIComponent(m[1] || '');
    const utypeFilter = isSub ? " AND utype = 'u'" : " AND (utype = 'a' OR utype IS NULL)";
    if (curToken) await env.DB.prepare(`DELETE FROM sessions WHERE admin_id = ? AND token <> ?${utypeFilter}`).bind(auth.id, curToken).run();
    else await env.DB.prepare(`DELETE FROM sessions WHERE admin_id = ?${utypeFilter}`).bind(auth.id).run();
  } catch (e) { /* 会话清理失败不影响改密结果 */ }

  return json({ ok: true, msg: '密码已修改，其它设备已退出登录' });
}
