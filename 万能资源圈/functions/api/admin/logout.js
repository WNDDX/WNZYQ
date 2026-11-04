/**
 * POST /api/admin/logout
 * 退出登录：删除当前 token
 */
import { json, getCookie } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  // R30：优先从 HttpOnly Cookie 取令牌（兼容旧 Authorization 头）
  let auth = getCookie(request, 'wnzyq_token');
  if (!auth) auth = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (auth) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(auth).run();
  }
  // 清除浏览器里的 HttpOnly Cookie
  const clearCookie = 'wnzyq_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });
}
