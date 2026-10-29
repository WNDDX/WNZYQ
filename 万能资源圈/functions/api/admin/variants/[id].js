/**
 * 资源类型的更新/删除（需登录）
 * PUT    /api/admin/variants/:id   → 更新类型
 * DELETE /api/admin/variants/:id   → 删除类型
 */
import { json, requireAuth, requirePerm, productScopeOk, readJSON, ensureVariantColumns, clearPublicCache, sweepDroppedKeys } from '../../../_utils.js';

/* #116 信息锁：掩码回写保护——前端回显的码是掩码 ●●●●，保存时保留库里的真码 */
export async function onRequestPut(context) {
  const { env, request, params } = context;
  const auth = await requirePerm(env, request, 'products.edit');
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少类型 id' }, 400);

  const b = await readJSON(request);
  const name = String(b.name || '').trim();
  if (!name) return json({ ok: false, msg: '请填写类型名称' }, 400);
  await ensureVariantColumns(env);

  /* #116 范围锁：经类型找资源校验 */
  const vrow = await env.DB.prepare('SELECT product_id FROM product_variants WHERE id = ?').bind(id).first();
  if (!vrow) return json({ ok: false, msg: '类型不存在' }, 404);
  const sc = await productScopeOk(env, auth, vrow.product_id);
  if (!sc.ok) return json({ ok: false, msg: '该功能未开放' }, 403);

  /* v354：改类型前记下旧内容——保存后把"旧有新无"的上传文件自动追删（后端核对全库引用，绝不误删） */
  let __oldVariant = '';
  let __oldCode = '';
  try {
    const __or = await env.DB.prepare('SELECT "desc",img,video,resource_content,resource_code FROM product_variants WHERE id = ?').bind(id).first();
    if (__or) { __oldVariant = [__or.desc, __or.img, __or.video, __or.resource_content].join('\n'); __oldCode = __or.resource_code || ''; }
  } catch (e) {}

  /* #116 信息锁：无权看码的人提交掩码 → 保留原码 */
  let outCode = String(b.resourceCode || '');
  if (outCode === '●●●●') outCode = __oldCode;

  // R106：绑定设备上限挪进类型表单（<1 或非法一律按 1）
  const bindLimit = Math.max(1, parseInt(b.bindLimit, 10) || 1);
  await env.DB.prepare(
    `UPDATE product_variants SET name=?, title=?, "desc"=?, img=?, video=?, contact_url=?, price=?, sort=?, resource_code=?, resource_content=?, is_hidden=?, bind_limit=?
     WHERE id=?`
  )
    .bind(
      name,
      String(b.title || '').trim(),
      String(b.desc || ''),
      String(b.img || ''),
      String(b.video || ''),
      String(b.contactUrl || ''),
      Number(b.price) || 0,
      Number(b.sort) || 0,
      outCode,
      String(b.resourceContent || ''),
      b.isHidden ? 1 : 0,
      bindLimit,
      id
    )
    .run();

  await clearPublicCache(request);
  try { await sweepDroppedKeys(env, __oldVariant, JSON.stringify({ d: b.desc, i: b.img, v: b.video, r: b.resourceContent })); } catch (e) {} /* v354 */
  try { const { audit } = await import('../../../_utils.js'); await audit(env, request, '编辑类型', String(b.name || '') || ('#' + id)); } catch (e) {}
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const auth = await requirePerm(env, request, 'products.del');
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少类型 id' }, 400);

  /* #116 范围锁 */
  const vrow = await env.DB.prepare('SELECT product_id FROM product_variants WHERE id = ?').bind(id).first();
  if (!vrow) return json({ ok: false, msg: '类型不存在' }, 404);
  const sc = await productScopeOk(env, auth, vrow.product_id);
  if (!sc.ok) return json({ ok: false, msg: '该功能未开放' }, 403);

  await env.DB.prepare('DELETE FROM product_variants WHERE id = ?').bind(id).run();
  try { const { audit } = await import('../../../_utils.js'); await audit(env, request, '删除类型', '#' + id); } catch (e) {}
  await clearPublicCache(request);
  return json({ ok: true });
}
