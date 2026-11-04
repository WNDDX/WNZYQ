/**
 * POST /api/admin/clear-cache
 * 清除公开接口缓存（管理员修改数据后调用）
 * v301（用户 10-05 00:00）：补回缺失接口
 */
import { json, requirePerm, clearPublicCache } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context; await (await import('../../_utils.js')).ensureAdminUsers(env);
  const auth = await requirePerm(env, request, 'sensitive.super');
  if (auth instanceof Response) return auth;
  try {
    await clearPublicCache(request);
    return json({ ok: true });
  } catch (e) {
    console.error('clear cache error:', e);
    return json({ ok: false, msg: '清除缓存失败' });
  }
}
