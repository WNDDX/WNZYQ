/**
 * GET    /api/admin/products/:id   → 单条资源详情（含类型，编辑回显用）
 * PUT    /api/admin/products/:id   → 更新资源（含显示/隐藏 is_online）
 * DELETE /api/admin/products/:id   → 删除资源（同时删其类型和统计）
 * 均需登录
 */
import { json, requireAuth, readJSON, cleanProduct, cleanVariant, clearPublicCache, ensureSoftDelete, audit } from '../../../_utils.js';

import { json, requireAuth, requirePerm, ensureAdminUsers, readJSON, cleanProduct, cleanVariant, clearPublicCache, ensureSoftDelete, audit } from '../../../_utils.js';
import { catAllowed, visibleCode, parsePerms } from '../../../_perms.js';

/* #116 范围锁：资源是否在当前身份的授权分类内 */
async function scopeOk(env, auth, cid) {
  if (auth.role === 'super') return true;
  const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
  return catAllowed(Number(cid) || 0, auth.role, perms);
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  await ensureAdminUsers(env);
  const auth = await requirePerm(env, request, 'products.view');
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少资源 id' }, 400);

  const row = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!row) return json({ ok: false, msg: '资源不存在' }, 404);
  if (!(await scopeOk(env, auth, row.cid))) return json({ ok: false, msg: '该功能未开放' }, 403);

  const { results: vrows } = await env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort ASC, id ASC'
  ).bind(id).all();

  const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
  const product = cleanProduct(row);
  product.variants = (vrows || []).map(v => {
    const cv = cleanVariant(v);
    cv.resourceCode = visibleCode(cv.resourceCode, auth.role, perms, row.created_by, auth.username, row.cid); /* #116 信息锁 */
    return cv;
  });
  return json({ ok: true, product });
}

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const auth = await requirePerm(env, request, 'products.edit');
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少资源 id' }, 400);

  const b = await readJSON(request);

  // v385 条11：部分更新模式——编辑弹窗内「专属咨询客服」行内保存只更新这两列（下方全量 UPDATE 会把缺失字段清空）
  if (b.partial === 'contact') {
    await env.DB.prepare("UPDATE products SET contact_url=?, contact_qr=?, updated_at=datetime('now') WHERE id=?")
      .bind(String(b.contactUrl || ''), String(b.contactQr || ''), id).run();
    await clearPublicCache(request);
    return json({ ok: true });
  }

  // v439 #79：超大图压缩替换/恢复原图——只动一个图片字段；替换前把原图记入 original_urls（JSON）供随时恢复
  if (b.partial === 'imgfield' || b.partial === 'imgrestore') {
    const field = String(b.field || '');
    if (!['img', 'cover_images', 'detail_images'].includes(field)) return json({ ok: false, msg: '字段不允许' }, 400);
    try { await env.DB.prepare('ALTER TABLE products ADD COLUMN original_urls TEXT').run(); } catch (e) {}
    const row = await env.DB.prepare('SELECT img, cover_images, detail_images, original_urls FROM products WHERE id = ? AND deleted_at IS NULL').bind(id).first();
    if (!row) return json({ ok: false, msg: '资源不存在' }, 404);
    let bak = {};
    try { bak = JSON.parse(row.original_urls || '{}') || {}; } catch (e) { bak = {}; }
    let newVal;
    if (b.partial === 'imgfield') {
      newVal = String(b.value || '');
      bak[field] = field === 'img' ? row.img : row[field]; /* 替换前留存原图 */
    } else {
      newVal = bak[field]; /* 恢复：取回原图 */
      if (!newVal) return json({ ok: false, msg: '没有可恢复的原图' }, 400);
      delete bak[field];
    }
    await env.DB.prepare(`UPDATE products SET ${field}=?, original_urls=?, updated_at=datetime('now') WHERE id=?`)
      .bind(newVal, JSON.stringify(bak), id).run();
    await clearPublicCache(request);
    await audit(env, request, b.partial === 'imgfield' ? '超大图压缩替换' : '恢复原图', '#' + id + ' ' + field);
    return json({ ok: true });
  }

  // v294（用户 10-04 02:14）：211 并发编辑乐观锁——读取当前 updated_at，与前端传来的比对
  const currentRow = await env.DB.prepare('SELECT updated_at, cid FROM products WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!currentRow) return json({ ok: false, msg: '资源不存在' }, 404);
  /* #116 范围锁：原分类必须在授权范围内；挪分类（cid 变化）需 moveCat 权限且新分类也授权 */
  const myPerms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
  if (!(await scopeOk(env, auth, currentRow.cid))) return json({ ok: false, msg: '该功能未开放' }, 403);
  const newCid = Number(b.cid) || 0;
  if (newCid && newCid !== Number(currentRow.cid)) {
    const { can } = await import('../../../_perms.js');
    if (!can('products.moveCat', auth.role, myPerms)) return json({ ok: false, msg: '该功能未开放' }, 403);
    if (!(await scopeOk(env, auth, newCid))) return json({ ok: false, msg: '该功能未开放' }, 403);
  }
  /* #116 功能锁细粒度：改价 / 上下架 单独校验（有变化且无权 → 拒） */
  {
    const { can } = await import('../../../_perms.js');
    const origRow = await env.DB.prepare('SELECT price, is_online, is_hidden FROM products WHERE id = ?').bind(id).first();
    if (origRow) {
      if (b.price !== undefined && Number(b.price) !== Number(origRow.price) && !can('products.price', auth.role, myPerms)) return json({ ok: false, msg: '该功能未开放' }, 403);
      const stChg = (b.is_online ? 1 : 0) !== Number(origRow.is_online) || (b.is_hidden ? 1 : 0) !== Number(origRow.is_hidden || 0);
      if (stChg && !can('products.online', auth.role, myPerms)) return json({ ok: false, msg: '该功能未开放' }, 403);
    }
  }
  const clientUpdatedAt = String(b.updated_at || '').trim();
  const dbUpdatedAt = String(currentRow.updated_at || '').trim();
  if (clientUpdatedAt && dbUpdatedAt && clientUpdatedAt !== dbUpdatedAt) {
    return json({ ok: false, msg: '该资源已被修改，请刷新后重试' }, 409);
  }

  // R270（用户 09-27 17:30）：根因→前端发 JSON 字符串，服务端只认数组 → cover_images 永远存 "[]"
  // 修法→兼容字符串/数组两种格式，先 parse 再过滤空串/非字符串项
  var ci = b.cover_images;
  if (typeof ci === 'string') { try { ci = JSON.parse(ci); } catch (e) { ci = []; } }
  if (!Array.isArray(ci)) ci = [];
  ci = ci.filter(function (u) { return typeof u === 'string' && u.trim(); });
  const coverImages = JSON.stringify(ci);

  const detailImages = JSON.stringify(Array.isArray(b.detailImages) ? b.detailImages : []);
  const detailVideos = JSON.stringify(Array.isArray(b.detailVideos) ? b.detailVideos : []);

  await env.DB.prepare(
    `UPDATE products SET cid=?, title=?, "desc"=?, detail=?, img=?,
       cover_images=?, detail_images=?, detail_videos=?, contact_url=?, contact_qr=?, price=?, is_online=?, is_hidden=?,
       schedule_on=?, schedule_off=?, sort=?,
       updated_at=datetime('now') WHERE id=?`
  )
    .bind(
      Number(b.cid) || 0,
      String(b.title || '').trim(),
      String(b.desc || ''),
      String(b.detail || ''),
      String(b.img || ''),
      coverImages,
      detailImages,
      detailVideos,
      String(b.contactUrl || ''),
      String(b.contactQr || ''), /* v385 条11：专属客服二维码 */
      Number(b.price) || 0,
      b.is_online ? 1 : 0,
      b.is_hidden ? 1 : 0,
      b.schedule_on ? String(b.schedule_on) : null,
      b.schedule_off ? String(b.schedule_off) : null,
      Number(b.sort) || 0,
      id
    )
    .run();

  await clearPublicCache(request);
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, request, params } = context;
  await ensureAdminUsers(env);
  const auth = await requirePerm(env, request, 'products.del');
  if (auth instanceof Response) return auth;

  const id = Number(params.id);
  if (!id) return json({ ok: false, msg: '缺少资源 id' }, 400);

  // R31-#7：删除资源前先取出图片字段，删除后联动清理图仓里的自有图片（外链图不归我们管，跳过）
  // R36：清理范围扩到详情视频 + 类型（desc/img/video/resource_code 之外的富文本字段）
  /* v439 #68：删除改软删除（进回收站保 60 天，到期由日清扫彻底清）——文件/类型/统计保留可恢复 */
  const row = await env.DB.prepare('SELECT title, cid FROM products WHERE id = ?').bind(id).first();
  if (row && !(await scopeOk(env, auth, row.cid))) return json({ ok: false, msg: '该功能未开放' }, 403);
  await env.DB.prepare("UPDATE products SET deleted_at = datetime('now') WHERE id = ?").bind(id).run();
  await audit(env, request, '删除资源（进回收站）', row ? row.title : ('#' + id));

  await clearPublicCache(request);
  return json({ ok: true });
}
