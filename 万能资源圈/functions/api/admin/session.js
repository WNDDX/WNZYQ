/**
 * GET /api/admin/session
 * 校验当前登录态是否有效（管理后台启动时调用）
 */
import { json, getAuthAdmin } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const admin = await getAuthAdmin(env, request);
  if (!admin) return json({ ok: false, msg: '未登录' }, 401);
  return json({ ok: true, username: admin.username });
}
