/**
 * GET /api/shop/hot
 * 前台「热度排序」用的公开接口：返回每个显示中资源的浏览 / 咨询 / 解锁次数。
 *
 * 为什么单独开一个接口：
 *   - 这三次计数本来就在 stats 表里（后台「数据统计 → 资源明细」用的就是它），
 *     但只有 /api/admin/stats 这个管理员接口能拿到，前台排序拿不到。
 *   - 只在用户真的选了「热度类排序」时才会请求，正常访客零额外开销。
 *
 * 成本控制：
 *   - 只统计最近 30 天（更早的流量对"当前热度"没意义，也避免全表扫）；
 *   - 结果走 Cache API 缓存 300 秒，一个边缘节点 5 分钟只查一次 D1；
 *   - 查询失败一律返回空列表 + 200，前台自动退回「默认排序」，不弹错。
 */
import { json } from '../../_utils.js';

const DAYS = 30;
const CACHE_SECONDS = 300;

export async function onRequestGet(context) {
  const { request, env } = context;
  const cacheUrl = new URL(request.url);
  cacheUrl.search = ''; /* 缓存键不带随机参数 */
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) return new Response(cached.body, cached);

  let list = [];
  try {
    const rs = await env.DB.prepare(
      `SELECT p.id AS id,
              COALESCE(SUM(CASE WHEN s.type = 'view' THEN 1 ELSE 0 END), 0) AS views,
              COALESCE(SUM(CASE WHEN s.type = 'contact' THEN 1 ELSE 0 END), 0) AS contacts,
              COALESCE(SUM(CASE WHEN s.type = 'resource_unlock' THEN 1 ELSE 0 END), 0) AS unlocks
         FROM products p
         LEFT JOIN stats s
                ON s.product_id = p.id
               AND s.created_at >= datetime('now', '-${DAYS} days')
        WHERE p.deleted_at IS NULL AND p.is_online = 1 AND p.is_hidden = 0
        GROUP BY p.id`
    ).all();
    list = (rs && rs.results ? rs.results : []).map(function (r) {
      const views = Number(r.views) || 0;
      const contacts = Number(r.contacts) || 0;
      const unlocks = Number(r.unlocks) || 0;
      return {
        id: r.id,
        views: views,
        contacts: contacts,
        unlocks: unlocks,
        /* 热度分：解锁最贵（要验证码）、咨询次之、浏览最轻 */
        hot: views + contacts * 3 + unlocks * 5,
      };
    });
  } catch (e) {
    /* 统计表缺失 / D1 额度紧张 / 迁移未跑 —— 一律静默降级，不让前台报错 */
    list = [];
  }

  const response = json(
    { ok: true, days: DAYS, list: list },
    200,
    { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
    request
  );
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
