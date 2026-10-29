/**
 * GET /api/admin/session
 * 登录态恢复：读登录 Cookie 验会话，返回 { ok:true, username } 或 { ok:false }
 * v301（用户 10-05 00:00）：补回缺失接口，修复管理页登录态恢复 404
 */
import { json, getAuthAdmin } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    const admin = await getAuthAdmin(env, request);
    if (admin && admin.username) {
      /* v439 #116：返回身份与权限（前端按此隐藏无权功能/显示范围数据） */
      let perms = admin.perms || '{}';
      try { perms = typeof perms === 'string' ? JSON.parse(perms) : perms; } catch (e) { perms = {}; }
      return json({ ok: true, username: admin.username, role: admin.role || 'super', perms });
    }
    return json({ ok: false });
  } catch (e) {
    console.error('session check error:', e);
    return json({ ok: false });
  }
}
