/**
 * GET /api/admin/export   数据导出全量数据通道（R221 数据导出全面升级，需登录）
 *
 * 老板 15:44 拍板：导出内容要全面——库里可导的、对老板有业务价值的都给；
 * 每日趋势 / 按资源统计不再限近 30 天，按库内实际保留的全量导（stats 滚动保留 60 天）。
 * 导出的数据集（前端按工作表渲染，见 admin.js exportAllData）：
 *   products  资源清单（含全量浏览/咨询/解锁/绑定计数）
 *   variants  资源类型（全部类型 + 所属资源）
 *   categories 分类清单（含资源数）
 *   bindings  绑定设备明细（resource_bindings 全量：所属资源/类型、码、绑定时间、最近访问、UA）
 *   issues    发码记录（code_issues 全量：码、发放时间、状态、剩余有效天数、绑定时间）
 *   trend     每日趋势（全量保留天数，北京时区切日，空档日期补 0）
 *   byProduct 按资源统计（全量口径，不限 30 天窗口）
 *   recent    访问记录明细（stats 全量，最近 10000 条封顶：时间/资源/类型/IP）
 * 纯技术表（admins / sessions / login_attempts）含敏感凭据，不导出。
 */
import { json, requireAuth, ensureBindingsTable, ensureCodeIssuesTable, ensureVariantColumns, ensureProductColumns } from '../../_utils.js';

// 访问记录明细单表上限（防极端量级把浏览器导出卡死；正常 60 天去重数据远低于此）
const RECENT_LIMIT = 10000;

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  await ensureProductColumns(env);
  await ensureVariantColumns(env);
  await ensureBindingsTable(env);
  await ensureCodeIssuesTable(env);
  const DB = env.DB;

  const [
    productsRes, variantsRes, categoriesRes, bindingsRes, issuesRes,
    trendRes, byProductRes, recentRes, recentTotalRes,
  ] = await Promise.all([
    DB.prepare(
      `SELECT p.id, p.cid, p.title, p."desc", p.contact_url, p.price, p.is_online, p.is_hidden, p.sort, p.created_at,
              COALESCE((SELECT COUNT(*) FROM stats s WHERE s.product_id = p.id AND s.type='view'),0) AS views,
              COALESCE((SELECT COUNT(*) FROM stats s WHERE s.product_id = p.id AND s.type='contact'),0) AS contacts,
              COALESCE((SELECT COUNT(*) FROM stats s WHERE s.product_id = p.id AND s.type='resource_unlock'),0) AS resource_unlocks,
              COALESCE((SELECT COUNT(*) FROM resource_bindings rb WHERE rb.product_id = p.id),0) AS bindings
       FROM products p
       ORDER BY p.sort ASC, p.id DESC`
    ).all(),
    DB.prepare(
      `SELECT v.id, v.product_id, p.title AS product_title, v.name, v.title AS vtitle, v."desc", v.price,
              v.resource_code, v.resource_content, v.is_hidden, v.sort,
              COALESCE((SELECT COUNT(*) FROM resource_bindings rb WHERE rb.variant_id = v.id),0) AS bindings
       FROM product_variants v LEFT JOIN products p ON p.id = v.product_id
       ORDER BY v.product_id ASC, v.sort ASC, v.id ASC`
    ).all(),
    DB.prepare(
      `SELECT c.id, c.name, c.parent_id, c.sort, c.is_hidden,
              (SELECT COUNT(*) FROM products p WHERE p.cid = c.id) AS product_count
       FROM categories c
       ORDER BY c.sort ASC, c.id ASC`
    ).all(),
    DB.prepare(
      `SELECT rb.id, p.title AS product_title, v.name AS variant_name, rb.code, rb.created_at, rb.last_access, rb.ua
       FROM resource_bindings rb
       LEFT JOIN product_variants v ON v.id = rb.variant_id
       LEFT JOIN products p ON p.id = rb.product_id
       ORDER BY rb.id ASC`
    ).all(),
    DB.prepare(
      `SELECT ci.id, p.title AS product_title, v.name AS variant_name, ci.code, ci.issued_at, ci.status, ci.bound_at
       FROM code_issues ci
       LEFT JOIN product_variants v ON v.id = ci.variant_id
       LEFT JOIN products p ON p.id = ci.product_id
       ORDER BY ci.id ASC`
    ).all(),
    // 每日趋势：全量保留天数（不限 30 天），北京时区切日
    DB.prepare(
      `SELECT date(created_at, '+8 hours') AS day, type, COUNT(*) AS cnt
       FROM stats
       GROUP BY day, type ORDER BY day ASC`
    ).all(),
    // 按资源统计：全量口径
    DB.prepare(
      `SELECT p.id, p.title,
              COALESCE(SUM(CASE WHEN s.type='view' THEN 1 ELSE 0 END),0) AS views,
              COALESCE(SUM(CASE WHEN s.type='contact' THEN 1 ELSE 0 END),0) AS contacts,
              COALESCE(SUM(CASE WHEN s.type='resource_unlock' THEN 1 ELSE 0 END),0) AS resource_unlocks,
              COALESCE((SELECT COUNT(*) FROM resource_bindings rb WHERE rb.product_id = p.id),0) AS bindings
       FROM products p
       LEFT JOIN stats s ON s.product_id = p.id
       GROUP BY p.id
       ORDER BY views DESC, p.id DESC`
    ).all(),
    DB.prepare(
      `SELECT s.created_at, s.type, s.ip, p.title AS product_title
       FROM stats s LEFT JOIN products p ON p.id = s.product_id
       ORDER BY s.id DESC LIMIT ?`
    ).bind(RECENT_LIMIT).all(),
    DB.prepare('SELECT COUNT(*) AS n FROM stats').first(),
  ]);

  // 分类名映射（一级/二级路径展示用）
  const catRows = categoriesRes.results || [];
  const catName = {};
  catRows.forEach((c) => { catName[c.id] = c.name; });

  // 每日趋势：空档日期补 0（从首条数据日到今天，北京口径）
  const trendRows = trendRes.results || [];
  const trend = [];
  if (trendRows.length) {
    const byDay = {};
    trendRows.forEach((r) => {
      if (!byDay[r.day]) byDay[r.day] = { views: 0, contacts: 0, resource_unlocks: 0 };
      const key = r.type === 'view' ? 'views' : r.type === 'contact' ? 'contacts' : 'resource_unlocks';
      byDay[r.day][key] = r.cnt;
    });
    const days = Object.keys(byDay).sort();
    const d = new Date(days[0] + 'T00:00:00Z');
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    for (; d.toISOString().slice(0, 10) <= today; d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().slice(0, 10);
      const row = byDay[day] || { views: 0, contacts: 0, resource_unlocks: 0 };
      trend.push({ day, views: row.views, contacts: row.contacts, resource_unlocks: row.resource_unlocks });
      if (day === today) break;
    }
  }

  // 发码记录：状态文案与剩余天数（口径与 unlock.js 的 60 天窗口一致）
  const nowMs = Date.now();
  const issues = (issuesRes.results || []).map((r) => {
    let ageDays = 60;
    try {
      const t = new Date(String(r.issued_at).replace(' ', 'T') + 'Z').getTime();
      ageDays = Math.max(0, Math.floor((nowMs - t) / 86400000));
    } catch (e) { /* 解析失败按满窗计 */ }
    let statusText = '待用';
    if (r.status === 'bound') statusText = '已用';
    else if (ageDays >= 60) statusText = '已过期';
    return {
      product_title: r.product_title || '(已删除)',
      variant_name: r.variant_name || '(已删除)',
      code: r.code,
      issued_at: r.issued_at,
      status: statusText,
      remaining_days: Math.max(0, 60 - ageDays),
      bound_at: r.bound_at || '',
    };
  });

  const TYPE_TEXT = { view: '浏览', contact: '咨询客服', resource_unlock: '资源码解锁' };

  return json({
    ok: true,
    generated_at: new Date().toISOString(),
    products: (productsRes.results || []).map((p) => ({
      id: p.id,
      title: p.title || '',
      cat: p.cid === 0 ? '全部' : (catName[p.cid] || '未分类'),
      is_online: p.is_online,
      is_hidden: p.is_hidden,
      price: p.price || 0,
      views: p.views,
      contacts: p.contacts,
      resource_unlocks: p.resource_unlocks,
      bindings: p.bindings,
      desc: p.desc || '',
      contact_url: p.contact_url || '',
      sort: p.sort || 0,
      created_at: p.created_at,
    })),
    variants: (variantsRes.results || []).map((v) => ({
      product_title: v.product_title || '(已删除)',
      name: v.name || '',
      vtitle: v.vtitle || '',
      desc: v.desc || '',
      price: v.price || 0,
      resource_code: v.resource_code || '',
      has_content: !!(v.resource_content && String(v.resource_content).trim()),
      is_hidden: v.is_hidden || 0,
      sort: v.sort || 0,
      bindings: v.bindings,
    })),
    categories: catRows.map((c) => ({
      id: c.id,
      name: c.name || '',
      level: c.id === 0 ? '固定' : (c.parent_id ? '二级' : '一级'),
      parent: c.parent_id ? (catName[c.parent_id] || '') : '—',
      sort: c.sort || 0,
      is_hidden: c.is_hidden ? 1 : 0,
      product_count: c.product_count || 0,
    })),
    bindings: (bindingsRes.results || []).map((b) => ({
      product_title: b.product_title || '(已删除)',
      variant_name: b.variant_name || '(已删除)',
      code: b.code || '',
      created_at: b.created_at,
      last_access: b.last_access,
      ua: b.ua || '',
    })),
    issues,
    trend,
    byProduct: (byProductRes.results || []).map((p) => ({
      title: p.title || '',
      views: p.views,
      contacts: p.contacts,
      resource_unlocks: p.resource_unlocks,
      bindings: p.bindings,
    })),
    recent: (recentRes.results || []).map((r) => ({
      created_at: r.created_at,
      type_text: TYPE_TEXT[r.type] || r.type,
      product_title: r.product_title || '(已删除)',
      ip: r.ip || '',
    })),
    counts: {
      products: (productsRes.results || []).length,
      variants: (variantsRes.results || []).length,
      categories: catRows.length,
      bindings: (bindingsRes.results || []).length,
      issues: issues.length,
      trend: trend.length,
      byProduct: (byProductRes.results || []).length,
      recent: (recentRes.results || []).length,
      recent_total: recentTotalRes ? recentTotalRes.n : 0,
      recent_limit: RECENT_LIMIT,
    },
  });
}
