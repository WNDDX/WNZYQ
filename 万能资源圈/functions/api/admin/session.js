/**
 * GET /api/admin/session
 * 登录态恢复：读登录 Cookie 验会话，返回 { ok:true, username } 或 { ok:false }
 * v301（用户 10-05 00:00）：补回缺失接口，修复管理页登录态恢复 404
 */
import { json, getAuthAdmin, getCookie } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    const admin = await getAuthAdmin(env, request);
    if (admin && admin.username) {
      /* v534：老板打开后台也算"有人访问"——顺带把当天的自动采集跑掉（后台跑，不耽误这个请求） */
      try {
        const job = import('../../_autocollect.js').then(function (m) { return m.maybeAutoCollect(context); }).catch(function () {});
        if (context.waitUntil) context.waitUntil(job);
      } catch (eAC) {}
      /* v439 #116：返回身份与权限（前端按此隐藏无权功能/显示范围数据） */
      let perms = admin.perms || '{}';
      try { perms = typeof perms === 'string' ? JSON.parse(perms) : perms; } catch (e) { perms = {}; }
      /* v633：登录 Cookie 跟着「每次打开后台」续一天。
         服务端会话本来就会自动续（_utils.js 剩余不足 12h 时再续 24h），但浏览器那枚 Cookie 的
         Max-Age 是登录那一刻写死的 86400 秒——到点浏览器自己删掉，服务端活着也没用，
         第二天打开后台照样要重登。这里在验会话通过后重发一次同样的 Cookie，等于「只要还在用就不用重登」。
         不写库、不额外查询，只是一个响应头。 */
      const _tk = getCookie(request, 'wnzyq_token');
      const _renew = _tk ? { 'Set-Cookie': 'wnzyq_token=' + encodeURIComponent(_tk) + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400' } : null;
      return json({ ok: true, username: admin.username, role: admin.role || 'super', perms }, 200, _renew || undefined);
    }
    return json({ ok: false });
  } catch (e) {
    console.error('session check error:', e);
    return json({ ok: false });
  }
}
