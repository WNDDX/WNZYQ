/**
 * GET /api/settings
 * 公开接口：返回前台需要的平台设置（店名、logo、客服链接、公告、资源码绑定上限）
 * R92：改白名单过滤——只下发前台确实要用的键，未来新增敏感设置不会顺带泄露
 */
import { json, publicAnnouncements } from '../_utils.js';

/* v383：+ group_url（群聊跳转链接）+ contact_qr/group_qr/gzh_qr（三张二维码）——导航页三弹窗全量走设置值 */
const PUBLIC_KEYS = ['shop_name', 'shop_logo', 'contact_url', 'group_url', 'contact_qr', 'group_qr', 'gzh_qr', 'announcement', 'announcement_mode', 'announcements', 'resource_bind_limit'];

export async function onRequestGet(context) {
  const { env, request } = context;
  /* v633：边缘缓存 —— 用「时间分桶」而不是「固定键 + 主动清」。
     教训：先前做成固定键 /api/settings + 保存后 cache.delete()，实测删不掉
     （保存返回 ok、库里已是新值，公开接口却还是旧的，足足 65 秒才对），
     老板改完客服链接刷新看不到，会以为没保存。Cache API 的 delete 在这个环境不可靠，
     所以改成每 5 秒换一个键：桶号一变就是新键，天然「过期」，根本不需要清。
     代价：后台改完最多 5 秒前台才更新（刷新一下即可），换来的是 5 秒内所有访客共用一份，
     比原来「每个访客读一次 12 行 settings」省得多。 */
  const cache = caches.default;
  const origin = new URL(request.url).origin;
  const bucket = Math.floor(Date.now() / 5000);
  const cacheKey = new Request(new URL('/api/settings?b=' + bucket, origin).toString());
  try {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  } catch (e0) {}
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of results) {
    if (PUBLIC_KEYS.indexOf(r.key) !== -1) obj[r.key] = r.key === 'announcements' ? publicAnnouncements(r.value) : r.value; /* #68：软删公告不下发公开端 */
  }
  const response = json({ ok: true, settings: obj });
  /* v633：max-age=0 → 浏览器每次回源；s-maxage=5 → 只让边缘缓存 5 秒。
     这样后台改完最坏等 5 秒（刷新一下就好），而不是本机也存 5 秒、变成 10 秒。 */
  try { response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=5'); } catch (e1) {}
  try { if (context.waitUntil) context.waitUntil(cache.put(cacheKey, response.clone())); } catch (e2) {}
  return response;
}
