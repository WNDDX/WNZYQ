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
import { cleanProduct, cleanVariantPublic, ensureProductColumns, ensureSoftDelete, ensureThumbOk, ensureVariantColumns, json } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  await ensureSoftDelete(env); /* v440：先迁移软删列（线上旧库无此列，缺它接口 500） */

  /* v631Y（老板 21:16「有备无患」）：缓存键只保留参数白名单。
     原来键 = 完整 URL，于是 `?x=随机数` 每次都是新键 → 缓存永远不命中、每次都真打 D1，
     等于给"拿脚本刷接口烧额度"开了个后门（顺带还能把边缘缓存塞满垃圾条目）。
     现在只按真正影响结果的参数生成键；带 `_t=` 的（前端强刷）不读也不写缓存。 */
  /* 注意：本函数后面（分页参数处）已经声明了 const url，这里不能重名，用 _cu */
  const _cu = new URL(request.url);
  const KEEP = ['page', 'page_size', 'cid', 'sub_cid', 'kw', 'brief', 'id']; /* id = 单条详情，漏了会和列表键撞车 */
  const normUrl = new URL(_cu.origin + _cu.pathname);
  KEEP.forEach(function (k) { if (_cu.searchParams.has(k)) normUrl.searchParams.set(k, _cu.searchParams.get(k)); });
  const cacheKey = new Request(normUrl.toString()); /* v633：去掉 request——带 Cookie/UA 的键与 clearPublicCache 删的裸 URL 键对不上，永远删不掉，后台改完前台迟迟不更新 */
  const cache = caches.default;
  const bypassCache = _cu.searchParams.has('_t');

  // 1. 尝试读缓存
  if (!bypassCache) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const hit = new Response(cached.body, cached);
      hit.headers.set('X-Pub-Cache', 'hit');
      return hit;
    }
  }

  /* 2. 定时显示/隐藏检查 + 列迁移（v339 条225：两件互不依赖的事并行做，减少一次串行来回）
     v633 修：定时时间由 <input type="datetime-local"> 传来，存进去是 "2026-11-09T08:01"（带 T），
     而比较用的是 datetime('now','+8 hours') 生成的 "2026-11-09 08:01:00"（带空格）。
     SQLite 按字符串比大小，第 10 位 'T'(84) 永远大于 ' '(32)，于是「同一天内」的定时永远不会触发，
     要等到第二天 0 点才生效——等于定时下架晚一整天。统一用 datetime(replace(x,'T',' ')) 归一化后再比，
     历史数据不用迁移。 */
  const [pre] = await Promise.all([
    env.DB.prepare(
      `SELECT
         EXISTS(SELECT 1 FROM products WHERE is_online = 0 AND schedule_on IS NOT NULL AND datetime(replace(schedule_on,'T',' ')) <= datetime('now', '+8 hours') AND deleted_at IS NULL) AS need_show,
         EXISTS(SELECT 1 FROM products WHERE is_online = 1 AND schedule_off IS NOT NULL AND datetime(replace(schedule_off,'T',' ')) <= datetime('now', '+8 hours') AND deleted_at IS NULL) AS need_hide`
    ).first().catch(() => null),
    (async () => { await ensureProductColumns(env); await ensureVariantColumns(env); })().catch(() => {}),
  ]);
  try {
    if (pre && pre.need_show) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 1, is_hidden = 0, updated_at = datetime('now')
         WHERE is_online = 0 AND schedule_on IS NOT NULL AND datetime(replace(schedule_on,'T',' ')) <= datetime('now', '+8 hours') AND deleted_at IS NULL` /* v440：定时上线不碰数据缓存中的资源 */
      ).run();
    }
    if (pre && pre.need_hide) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 0, updated_at = datetime('now')
         WHERE is_online = 1 AND schedule_off IS NOT NULL AND datetime(replace(schedule_off,'T',' ')) <= datetime('now', '+8 hours') AND deleted_at IS NULL`
      ).run();
    }
  } catch (e) { /* 忽略定时显示/隐藏错误 */ }

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
    const r = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND is_online = 1 AND is_hidden = 0 AND deleted_at IS NULL').bind(singleId).first(); /* v440：软删（数据缓存中）资源前台不可见 */
    if (!r) return json({ ok: false, msg: '资源不存在或已下架' }, 404);
    await ensureThumbOk(env, [r]); /* v692：小图判据（NULL 行现场探一次并落库） */
    const item = cleanProduct(r);
    const { results: vrows } = await env.DB.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort ASC, id ASC').bind(singleId).all();
    item.variants = (vrows || []).filter((v) => !v.is_hidden).map(cleanVariantPublic);
    const singleResp = new Response(JSON.stringify({ ok: true, product: item }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=20' },
    });
    return singleResp;
  }

  // 构建 WHERE 条件
  let where = 'WHERE is_online = 1 AND is_hidden = 0 AND deleted_at IS NULL'; /* v440：软删过滤 */
  const params = [];

  if (subCid > 0) {
    where += ' AND cid = ?';
    params.push(subCid);
  } else if (cid > 0) {
    // 一级分类：包含该分类及其所有子分类
    /* v633：子分类查询补 deleted_at / is_hidden 过滤。
       原来只按 parent_id 取，删掉的子分类仍算进来——于是「手机号卡」下会冒出
       属于已删分类「联通」的资源，而分类条里根本没有「联通」这个入口，等于凭空多出几条。 */
    const subRes = await env.DB.prepare(
      'SELECT id FROM categories WHERE parent_id = ? AND deleted_at IS NULL AND COALESCE(is_hidden,0) = 0'
    ).bind(cid).all();
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
    /* v631W：原来写成 LOWER(title) LIKE ?，对每一行都要跑一次 LOWER，纯粹浪费（LIKE 默认已对 ASCII 不敏感，中文无大小写）。 */
    /* v633：多关键词——空格分隔的每个词都要命中（AND），与前台 getFilteredProducts 同一口径；
       最多取 5 个词，防止有人拼一长串空格把 SQL 撑爆。单词时与原来完全一致。 */
    const words = kw.split(/\s+/).filter(function (w) { return w; }).slice(0, 5);
    const useWords = words.length > 1 ? words : [kw];
    for (const w of useWords) {
      where += ' AND (title LIKE ? OR "desc" LIKE ?)';
      params.push('%' + w + '%', '%' + w + '%');
    }
  }

  // 3. 查库（v339 条225：总数与列表并行，省一次串行来回）
  let results, total;
  const offset = (page - 1) * pageSize;
  let countP, listP;
  if (pageSize === 0) {
    // 不分页：兼容旧口径
    countP = Promise.resolve(null);
    /* v631W：排序档会走 page_size=0 拉全量来做前端排序。资源多了这里就是几 MB 一次。
       加 1000 条硬上限当安全阀（现在 21 条，行为完全不变），超过时前端仍能排序，只是不再无限拉。 */
    listP = env.DB.prepare('SELECT * FROM products ' + where + ' ORDER BY sort ASC, id DESC LIMIT 1000').bind(...params).all();
  } else {
    countP = env.DB.prepare('SELECT COUNT(*) AS n FROM products ' + where).bind(...params).first();
    listP = env.DB.prepare('SELECT * FROM products ' + where + ' ORDER BY sort ASC, id DESC LIMIT ? OFFSET ?').bind(...params, pageSize, offset).all();
  }
  const [countRes2, listRes] = await Promise.all([countP, listP]);
  total = pageSize === 0 ? (listRes.results || []).length : (countRes2 ? countRes2.n : 0);
  results = listRes.results || [];

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
  /* v692：先把「有没有小图」补探测齐（只对 thumb_ok 还是 NULL 的行动手，稳态零 I/O） */
  await ensureThumbOk(env, results);
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
  /* v692 备注（不改行为）：这个指纹**只在 304 分支里被写进响应头**，200 响应并不带 ETag，
     所以浏览器根本不会存 If-None-Match —— 304 这条路径实际上一直是死的。
     本次要保证的「thumb 字段不滞留」由 Cache-Control: max-age=20 兜住（最多 20 秒），
     因此不在这里顺手打开 ETag：指纹里没有 updated_at/title，一旦真的开始 304，
     改个标题就会长期发旧内容。要开就是另一件事，得先把指纹补齐。 */

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
      'X-Pub-Cache': 'miss',
    },
  });
  if (!bypassCache) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
