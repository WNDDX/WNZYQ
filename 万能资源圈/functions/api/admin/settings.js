/**
 * GET  /api/admin/settings   → 获取全部平台设置（需登录）
 * PUT  /api/admin/settings   → 批量更新平台设置（需登录）
 * body (PUT): { shop_name, shop_logo, contact_url, ... }
 */
import { json, requireAuth, requirePerm, ensureAdminUsers, readJSON, sweepDroppedKeys } from '../../_utils.js';

// 允许设置的 key 白名单
/* v383：新增 group_url（交流群聊跳转链接）+ contact_qr/group_qr/gzh_qr（三张二维码图片），链接/图片全部后台可改 */
const ALLOWED_KEYS = ['shop_name', 'shop_logo', 'contact_url', 'group_url', 'contact_qr', 'group_qr', 'gzh_qr', 'announcement', 'announcement_mode', 'announcements', 'resource_bind_limit', 'sub_freeze'] /* R54：r2_public_base 已废弃删除（图片走 /img/ 路由，无需直连地址） */

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
  await ensureAdminUsers(env);
  const { env, request } = context;
  /* #116：平台设置仅超管；但子账号有公告权限时可保存公告相关键（功能锁落地） */
  const ANN_KEYS = ['announcement', 'announcement_mode', 'announcements'];
  const b = await readJSON(request);
  const bodyKeys = Object.keys(b || {});
  const onlyAnn = bodyKeys.length > 0 && bodyKeys.every(k => ANN_KEYS.indexOf(k) !== -1);
  const auth = onlyAnn ? await requirePerm(env, request, 'ann.edit') : await requirePerm(env, request, 'settings.write');
  if (auth instanceof Response) return auth;

  /* v354：保存前记下旧值——保存完成后把"旧有新无"的上传文件自动追删（后端核对全库引用，绝不误删） */
  let __oldSettings = '';
  try { const { results } = await env.DB.prepare('SELECT value FROM settings').all(); for (const r of (results || [])) __oldSettings += (r.value || '') + '\n'; } catch (e) {}

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

  try { await sweepDroppedKeys(env, __oldSettings, JSON.stringify(b)); } catch (e) {} /* v354：换掉的图/删掉的公告里的文件自动追删 */
  /* v439 #64：设置变更留痕（60 天自动清理覆盖） */
  try { const { audit } = await import('../_utils.js'); const keys = Object.keys(b).filter(function (k) { return ALLOWED_KEYS.indexOf(k) >= 0; }); await audit(env, request, '更新设置', keys.join('、')); } catch (e1) {}
  return json({ ok: true, msg: '设置已保存' });
}
