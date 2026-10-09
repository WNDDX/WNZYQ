/**
 * GET /api/products
 * 返回【显示中】的资源（公开接口，前台用）
 * 每个资源同时带上其类型列表（variants），前台详情弹窗直接用
 * R92：类型不再下发 resourceCode/resourceContent 明文，改发 hasCode/hasContent 标志；
 * 明文内容只在 /api/unlock 验证（或已绑定设备）后单发
 * 分类/搜索过滤由前台完成
 * R303（09-30）：支持分页按页拉取（page + page_size），兼容旧口径（不传参=返回全部）
 * 带 20 秒边缘缓存（Cache API），管理员修改后自动失效
 */
import { json, cleanProduct, cleanVariantPublic, ensureVariantColumns, ensureProductColumns } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const cacheUrl = new URL(request.url);
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  // 1. 尝试读缓存
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, cached);
  }

  // 2. 定时显示/隐藏检查：到了显示时间自动显示，到了隐藏时间自动隐藏
  try {
    const pre = await env.DB.prepare(
      `SELECT
         EXISTS(SELECT 1 FROM products WHERE is_online = 0 AND schedule_on IS NOT NULL AND schedule_on <= datetime('now', '+8 hours')) AS need_show,
         EXISTS(SELECT 1 FROM products WHERE is_online = 1 AND schedule_off IS NOT NULL AND schedule_off <= datetime('now', '+8 hours')) AS need_hide`
    ).first();
    if (pre && pre.need_show) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 1, is_hidden = 0, updated_at = datetime('now')
         WHERE is_online = 0 AND schedule_on IS NOT NULL AND schedule_on <= datetime('now', '+8 hours')`
      ).run();
    }
    if (pre && pre.need_hide) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 0, updated_at = datetime('now')
         WHERE is_online = 1 AND schedule_off IS NOT NULL AND schedule_off <= datetime('now', '+8 hours')`
      ).run();
    }
  } catch (e) { /* 忽略定时显示/隐藏错误 */ }

  await ensureProductColumns(env);
  await ensureVariantColumns(env);

  // R303：分页参数
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(0, Number(url.searchParams.get('page_size')) || 0));
  const cid = Number(url.searchParams.get('cid') || 0);
  const subCid = Number(url.searchParams.get('sub_cid') || 0);
  const kw = String(url.searchParams.get('kw') || '').trim().toLowerCase();
  /* v338 条40：列表瘦身——brief=1 时不下发详情大字段（detail/detailImages/detailVideos），
     打开详情弹窗时前台按 id 单拉完整数据；id 参数则直接返回单个完整资源 */
  const brief = url.searchParams.get('brief') === '1';
  const singleId = Number(url.searchParams.get('id') || 0);

  // 单品完整数据（详情弹窗按需拉取用）
  if (singleId > 0) {
    const r = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND is_online = 1 AND is_hidden = 0').bind(singleId).first();
    if (!r) return json({ ok: false, msg: '资源不存在或已下架' }, 404);
    const item = cleanProduct(r);
    const { results: vrows } = await env.DB.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort ASC, id ASC').bind(singleId).all();
    item.variants = (vrows || []).filter((v) => !v.is_hidden).map(cleanVariantPublic);
    const singleResp = new Response(JSON.stringify({ ok: true, product: item }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=20' },
    });
    return singleResp;
  }

  // 构建 WHERE 条件
  let where = 'WHERE is_online = 1 AND is_hidden = 0';
  const params = [];

  if (subCid > 0) {
    where += ' AND cid = ?';
    params.push(subCid);
  } else if (cid > 0) {
    // 一级分类：包含该分类及其所有子分类
    const subRes = await env.DB.prepare('SELECT id FROM categories WHERE parent_id = ?').bind(cid).all();
    const subIds = (subRes.results || []).map((r) => r.id);
    if (subIds.length > 0) {
      where += ' AND (cid = ? OR cid IN (' + subIds.map(() => '?').join(',') + '))';
      params.push(cid, ...subIds);
    } else {
      where += ' AND cid = ?';
      params.push(cid);
    }
  }

  if (kw) {
    where += ' AND (LOWER(title) LIKE ? OR LOWER("desc") LIKE ?)';
    params.push('%' + kw + '%', '%' + kw + '%');
  }

  // 3. 查数据库
  let results, total;
  if (pageSize === 0) {
    // 不分页：兼容旧口径
    const r = await env.DB.prepare('SELECT * FROM products ' + where + ' ORDER BY sort ASC, id DESC').bind(...params).all();
    results = r.results || [];
    total = results.length;
  } else {
    const countRes = await env.DB.prepare('SELECT COUNT(*) AS n FROM products ' + where).bind(...params).first();
    total = countRes ? countRes.n : 0;
    const offset = (page - 1) * pageSize;
    const r = await env.DB.prepare('SELECT * FROM products ' + where + ' ORDER BY sort ASC, id DESC LIMIT ? OFFSET ?').bind(...params, pageSize, offset).all();
    results = r.results || [];
  }

  // 3. 批量查类型
  const ids = results.map((p) => p.id);
  let variantsByProduct = {};
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const { results: vrows } = await env.DB.prepare(
      `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY sort ASC, id ASC`
    ).bind(...ids).all();
    for (const v of vrows) {
      if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
      if (v.is_hidden) continue;
      variantsByProduct[v.product_id].push(cleanVariantPublic(v));
    }
  }

  // 4. 组装
  const list = results.map((p) => {
    const item = cleanProduct(p);
    item.variants = variantsByProduct[p.id] || [];
    /* v338 条40：瘦身模式剥掉详情大字段（详情 HTML/详情多图/多视频往往占列表体积九成以上） */
    if (brief) { delete item.detail; delete item.detailImages; delete item.detailVideos; }
    return item;
  });

  // 5. 写入缓存（20 秒，兼顾性能与后台改动快速生效）
  const respBody = { ok: true, list };
  /* v336 条55：内容指纹——没变就只回 304，重复访问传输量从几十 KB 降到几十字节 */
  const etag = 'W/"' + (brief ? 'b.' : '') + total + '-' + list.length + '-' + (list[0] ? list[0].id : 0) + '"'; /* v336 条55 + v338 条40：指纹含瘦身标记 */

  if (request.headers.get('If-None-Match') === etag) {
    const notMod = new Response(null, { status: 304 });
    notMod.headers.set('ETag', etag);
    notMod.headers.set('Cache-Control', 'public, max-age=20');
    return notMod;
  }
  if (pageSize > 0) {
    respBody.total = total;
    respBody.page = page;
    respBody.page_size = pageSize;
    respBody.total_pages = Math.ceil(total / pageSize);
  }
  const response = new Response(JSON.stringify(respBody), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=20',
    },
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
