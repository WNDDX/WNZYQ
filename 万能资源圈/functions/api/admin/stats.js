/**
 * GET /api/admin/stats
 * 数据统计（需登录）：
 *   overview   → 资源总数 / 在售数 / 总浏览 / 总联系客服
 *   byProduct  → 每个资源的浏览 / 联系次数
 *   trend      → 最近 7 天浏览 / 联系趋势
 *   byCategory → 按分类统计资源数和浏览量
 *   recent     → 最近 20 条浏览记录
 */
import { json, requireAuth } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  // 日期范围参数
  const url = new URL(request.url);
  const startDate = url.searchParams.get('start_date') || '';
  const endDate = url.searchParams.get('end_date') || '';

  // 计算30天前的日期（最大可查范围）
  const maxStart = new Date();
  maxStart.setDate(maxStart.getDate() - 29);
  const maxStartStr = maxStart.toISOString().slice(0, 10);

  // 日期范围：自定义则用自定义，但开始日期不能早于30天前；否则默认近30天
  let dateFilter;
  let effectiveStart = maxStartStr;
  let effectiveEnd = new Date().toISOString().slice(0, 10);
  if (startDate && endDate) {
    // 如果开始日期早于30天前，强制限制为30天前
    effectiveStart = startDate > maxStartStr ? startDate : maxStartStr;
    effectiveEnd = endDate;
    dateFilter = ` AND date(created_at) >= '${effectiveStart}' AND date(created_at) <= '${effectiveEnd}'`;
  } else {
    dateFilter = ` AND created_at >= datetime('now', '-30 days')`;
  }

  // 1. 总览（资源总数不受时间限制，浏览/联系/资源码解锁受30天限制）
  const overview = {
    products: await count(env.DB, 'SELECT COUNT(*) AS n FROM products'),
    online: await count(env.DB, 'SELECT COUNT(*) AS n FROM products WHERE is_online = 1'),
    hidden: await count(env.DB, 'SELECT COUNT(*) AS n FROM products WHERE is_hidden = 1'),
    views: await count(env.DB, `SELECT COUNT(*) AS n FROM stats WHERE type = 'view'${dateFilter}`),
    contacts: await count(env.DB, `SELECT COUNT(*) AS n FROM stats WHERE type = 'contact'${dateFilter}`),
    resource_unlocks: await count(env.DB, `SELECT COUNT(*) AS n FROM stats WHERE type = 'resource_unlock'${dateFilter}`),
  };

  // 2. 按资源统计（仅统计30天内的数据）
  const { results: byProduct } = await env.DB.prepare(
    `SELECT p.id, p.title, p.is_online, p.is_hidden,
            COALESCE(SUM(CASE WHEN s.type='view' THEN 1 ELSE 0 END),0) AS views,
            COALESCE(SUM(CASE WHEN s.type='contact' THEN 1 ELSE 0 END),0) AS contacts,
            COALESCE(SUM(CASE WHEN s.type='resource_unlock' THEN 1 ELSE 0 END),0) AS resource_unlocks
     FROM products p
     LEFT JOIN stats s ON s.product_id = p.id${dateFilter}
     GROUP BY p.id
     ORDER BY views DESC, p.id DESC`
  ).all();

  // 3. 趋势（默认近30天，支持自定义日期范围）
  const trendSql = `SELECT date(created_at) AS day, type, COUNT(*) AS cnt
     FROM stats
     WHERE 1=1${dateFilter}
     GROUP BY day, type ORDER BY day ASC`;
  const { results: trendRows } = await env.DB.prepare(trendSql).all();
  // 补全日期范围（用限制后的日期，最多30天）
  const trend = [];
  const startD = new Date(effectiveStart);
  const endD = new Date(effectiveEnd);
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const dayRows = trendRows.filter((r) => r.day === day);
    trend.push({
      day,
      views: dayRows.find((r) => r.type === 'view')?.cnt || 0,
      contacts: dayRows.find((r) => r.type === 'contact')?.cnt || 0,
      resource_unlocks: dayRows.find((r) => r.type === 'resource_unlock')?.cnt || 0,
    });
  }

  // 4. 按分类统计
  const { results: byCategory } = await env.DB.prepare(
    `SELECT c.id, c.name,
            COUNT(p.id) AS product_count,
            COALESCE(SUM(s2.views),0) AS total_views
     FROM categories c
     LEFT JOIN products p ON p.cid = c.id
     LEFT JOIN (
       SELECT product_id, COUNT(*) AS views FROM stats WHERE type='view' GROUP BY product_id
     ) s2 ON s2.product_id = p.id
     GROUP BY c.id
     ORDER BY c.sort ASC, c.id ASC`
  ).all();

  // 5. 最近 20 条浏览记录
  const { results: recent } = await env.DB.prepare(
    `SELECT s.id, s.type, s.created_at, p.title, p.img
     FROM stats s
     LEFT JOIN products p ON p.id = s.product_id
     ORDER BY s.id DESC
     LIMIT 20`
  ).all();

  return new Response(JSON.stringify({
    ok: true,
    overview,
    byProduct: byProduct.map((r) => ({
      id: r.id, title: r.title, is_online: r.is_online, is_hidden: r.is_hidden,
      views: r.views, contacts: r.contacts, resource_unlocks: r.resource_unlocks,
    })),
    trend,
    byCategory,
    recent: recent.map((r) => ({
      id: r.id, type: r.type, created_at: r.created_at,
      title: r.title || '(已删除)', img: r.img || '',
    })),
  }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' },
  });
}

async function count(db, sql) {
  const r = await db.prepare(sql).first();
  return r ? r.n : 0;
}
