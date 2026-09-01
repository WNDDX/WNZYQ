/**
 * GET /api/health
 * 检查系统是否已初始化（管理后台据此决定是否显示"初始化系统"按钮）
 */
import { json } from '../_utils.js';

export async function onRequestGet(context) {
  const { env } = context;
  let ready = false;
  let hasAdmin = false;
  try {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM admins').first();
    ready = true;
    hasAdmin = !!(r && r.n > 0);
  } catch (e) {
    // 表还不存在 = 未初始化
    ready = false;
  }
  return json({ ok: true, ready, hasAdmin });
}
