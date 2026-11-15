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
  /* v633：加 60 秒边缘缓存。
     原来这个接口一个缓存头都没有——前台每次打开页面都要把 settings 表 12 行读一遍，
     访客越多读得越多，纯属白烧 D1 读额度。缓存键固定成 /api/settings（不带参数），
     避免 ?t= 之类每次新键导致永远不命中。
     代价是后台改完最多 60 秒前台才更新——所以 admin/settings.js 写完之后会主动清这一条，
     正常操作（改客服链接/发公告）依然是刷一下就生效。 */
  const cache = caches.default;
  /* v633（实测根因：后台保存后 60 秒内前台还是旧值，老板以为没改上）——
     put/match 的键原来写的是 new Request(url, request)，把原请求的 Cookie/UA 等头一起带进了键；
     而清缓存 clearPublicCache 删的是「裸 URL」的键，两个键对不上，于是永远删不掉。
     这里改成裸 URL 键，与 clearPublicCache 完全一致。 */
  const cacheKey = new Request(new URL('/api/settings', new URL(request.url).origin).toString());
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
  try { response.headers.set('Cache-Control', 'public, max-age=60'); } catch (e1) {}
  try { if (context.waitUntil) context.waitUntil(cache.put(cacheKey, response.clone())); } catch (e2) {}
  return response;
}
