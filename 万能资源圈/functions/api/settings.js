/**
 * GET /api/settings
 * 公开接口：返回前台需要的平台设置（店名、logo、客服链接、公告、资源码绑定上限）
 * R92：改白名单过滤——只下发前台确实要用的键，未来新增敏感设置不会顺带泄露
 */
import { json, publicAnnouncements } from '../_utils.js';

/* v383：+ group_url（群聊跳转链接）+ contact_qr/group_qr/gzh_qr（三张二维码）——导航页三弹窗全量走设置值 */
const PUBLIC_KEYS = ['shop_name', 'shop_logo', 'contact_url', 'group_url', 'contact_qr', 'group_qr', 'gzh_qr', 'announcement', 'announcement_mode', 'announcements', 'resource_bind_limit'];

export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of results) {
    if (PUBLIC_KEYS.indexOf(r.key) !== -1) obj[r.key] = r.key === 'announcements' ? publicAnnouncements(r.value) : r.value; /* #68：软删公告不下发公开端 */
  }
  return json({ ok: true, settings: obj });
}
