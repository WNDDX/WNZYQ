/**
 * 资源类型的更新/删除（需登录）
 * PUT    /api/admin/variants/:id   → 更新类型
 * DELETE /api/admin/variants/:id   → 删除类型
 */
import { json, requireAuth, readJSON, ensureVariantColumns, clearPublicCache, sweepDroppedKeys } from '../../../_utils.js';

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少类型 id' }, 400);

  const b = await readJSON(request);
  const name = String(b.name || '').trim();
  if (!name) return json({ ok: false, msg: '请填写类型名称' }, 400);
  await ensureVariantColumns(env);

  /* v354：改类型前记下旧内容——保存后把"旧有新无"的上传文件自动追删（后端核对全库引用，绝不误删） */
  let __oldVariant = '';
  try {
    const __or = await env.DB.prepare('SELECT "desc",img,video,resource_content FROM product_variants WHERE id = ?').bind(id).first();
    if (__or) __oldVariant = [__or.desc, __or.img, __or.video, __or.resource_content].join('\n');
  } catch (e) {}

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
      String(b.resourceCode || ''),
      String(b.resourceContent || ''),
      b.isHidden ? 1 : 0,
      bindLimit,
      id
    )
    .run();

  await clearPublicCache(request);
  try { await sweepDroppedKeys(env, __oldVariant, JSON.stringify({ d: b.desc, i: b.img, v: b.video, r: b.resourceContent })); } catch (e) {} /* v354 */
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少类型 id' }, 400);

  await env.DB.prepare('DELETE FROM product_variants WHERE id = ?').bind(id).run();
  await clearPublicCache(request);
  return json({ ok: true });
}
