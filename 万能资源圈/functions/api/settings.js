/**
 * GET /api/settings
 * 公开接口：返回店铺基本设置（店名、logo、客服链接）
 * 前台用，无需登录
 */
import { json } from '../_utils.js';

export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of results) obj[r.key] = r.value;
  return json({ ok: true, settings: obj });
}
