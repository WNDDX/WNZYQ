/**
 * GET  /api/admin/settings   → 获取全部平台设置（需登录）
 * PUT  /api/admin/settings   → 批量更新平台设置（需登录）
 * body (PUT): { shop_name, shop_logo, contact_url, ... }
 */
import { json, requireAuth, readJSON } from '../../_utils.js';

// 允许设置的 key 白名单
const ALLOWED_KEYS = ['shop_name', 'shop_logo', 'contact_url', 'announcement', 'announcement_mode', 'announcements'];

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of results) obj[r.key] = r.value;
  return json({ ok: true, settings: obj });
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);

  for (const key of ALLOWED_KEYS) {
    if (key in b) {
      const val = String(b[key] || '');
      const existing = await env.DB.prepare('SELECT key FROM settings WHERE key = ?').bind(key).first();
      if (existing) {
        await env.DB.prepare('UPDATE settings SET value = ? WHERE key = ?').bind(val, key).run();
      } else {
        await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind(key, val).run();
      }
    }
  }

  return json({ ok: true, msg: '设置已保存' });
}
