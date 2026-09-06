/**
 * POST /api/admin/logout
 * 退出登录：删除当前 token
 */
import { json } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (auth) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(auth).run();
  }
  return json({ ok: true });
}
