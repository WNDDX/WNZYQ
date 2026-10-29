/**
 * 资源类型管理（需登录）
 * GET  /api/admin/variants?product_id=xxx  → 某资源的类型列表
 * POST /api/admin/variants                   → 新增类型
 * body: { productId, name, desc, img, video, contactUrl, sort, resourceCode, resourceContent, isHidden }
 */
import { json, requireAuth, requirePerm, productScopeOk, readJSON, cleanVariant, ensureVariantColumns, ensureBindingsTable, ensureCodeIssuesTable } from '../../_utils.js';
import { visibleCode, parsePerms } from '../../_perms.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requirePerm(env, request, 'products.view');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const productId = Number(url.searchParams.get('product_id') || 0);
  if (!productId) return json({ ok: false, msg: '缺少 product_id' }, 400);
  await ensureVariantColumns(env);

  /* #116 范围锁 */
  const sc = await productScopeOk(env, auth, productId);
  if (!sc.ok) return json({ ok: false, msg: '该功能未开放' }, 403);

  const { results } = await env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort ASC, id ASC'
  ).bind(productId).all();

  // R92：顺带返回每类型的已绑定设备数（后台类型行的「绑定 N」徽章用）
  await ensureBindingsTable(env);
  // R106：绑定计数查询防御——表异常时按 0 处理，不再让整个类型列表 500
  let bindRows = [];
  try {
    const r = await env.DB.prepare(
      'SELECT variant_id, COUNT(*) AS n FROM resource_bindings WHERE product_id = ? GROUP BY variant_id'
    ).bind(productId).all();
    bindRows = r.results || [];
  } catch (e) { console.error('R106 绑定计数查询失败（按0兜底）:', e && e.message); }
  const bindMap = {};
  for (const r of bindRows) bindMap[r.variant_id] = r.n;

  await ensureCodeIssuesTable(env);
  const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
  const list = [];
  for (const v of results) {
    const item = Object.assign(cleanVariant(v), {
      bindings: bindMap[v.id] || 0,
    });
    item.resourceCode = visibleCode(item.resourceCode, auth.role, perms, sc.createdBy, auth.username, sc.cid); /* #116 信息锁 */
    list.push(item);
  }
  return json({ ok: true, list });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requirePerm(env, request, 'products.add');
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const productId = Number(b.productId) || 0;
  const name = String(b.name || '').trim();
  if (!productId) return json({ ok: false, msg: '缺少资源 id' }, 400);
  if (!name) return json({ ok: false, msg: '请填写类型名称' }, 400);
  await ensureVariantColumns(env);

  /* #116 范围锁 */
  const sc = await productScopeOk(env, auth, productId);
  if (!sc.ok) return json({ ok: false, msg: '该功能未开放' }, 403);

  // R106：绑定设备上限挪进类型表单（<1 或非法一律按 1）
  const bindLimit = Math.max(1, parseInt(b.bindLimit, 10) || 1);
  const r = await env.DB.prepare(
    `INSERT INTO product_variants (product_id, name, title, "desc", img, video, contact_url, price, sort, resource_code, resource_content, is_hidden, bind_limit)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      productId,
      name,
      String(b.title || '').trim(),
      String(b.desc || ''),
      String(b.img || ''),
      String(b.video || ''),
      String(b.contactUrl || ''),
      Number(b.price) || 0,
      Number(b.sort) || 0,
      String(b.resourceCode || ''),
      String(b.resourceContent || ''),
      b.isHidden ? 1 : 0,
      bindLimit
    )
    .run();

  return json({ ok: true, id: r.meta.last_row_id });
}
