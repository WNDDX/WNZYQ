/**
 * POST /api/admin/batch
 * 批量操作资源（需登录）
 * body: { ids: [1,2,3], action: 'online'|'offline'|'hide'|'show'|'delete'|'changeCat'|'changePrice', cid?: number, price?: number }
 *   online      批量显示（资源页可见，同时清掉隐藏标记）
 *   offline     批量隐藏（资源页不显示）
 *   hide/show   旧版动作，保留兼容（前端现已统一走 online/offline 两态）
 *   delete      批量删除（同时删类型和统计）
 *   changeCat   批量改分类（需 cid）
 *   changePrice 批量改价格（需 price）
 */
import { json, requireAuth, requirePerm, productScopeOk, readJSON, deleteBucketImages } from '../../_utils.js';
import { parsePerms, can } from '../../_perms.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(Boolean) : [];
  const action = String(b.action || '');

  if (ids.length === 0) return json({ ok: false, msg: '请选择资源' }, 400);
  /* #116：批量动作逐项鉴权 + 范围锁（选中的资源必须全部在授权范围内） */
  const ACT = { online: 'batch.online', offline: 'batch.online', hide: 'batch.online', show: 'batch.online', delete: 'batch.del', changeCat: 'products.moveCat', changePrice: 'batch.price' };
  const need = ACT[action];
  if (need) {
    const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
    if (!can(need, auth.role, perms)) return json({ ok: false, msg: '该功能未开放' }, 403);
    for (const pid of ids) {
      const sc = await productScopeOk(env, auth, pid);
      if (!sc.ok) return json({ ok: false, msg: '该功能未开放' }, 403);
    }
    /* #116 范围锁：挪分类的目标分类也必须在授权范围内（防止把资源挪出自己范围/挪进别人的） */
    if (action === 'changeCat') {
      const { catAllowed } = await import('../../_perms.js');
      if (!catAllowed(Number(b.cid) || 0, auth.role, perms)) return json({ ok: false, msg: '该功能未开放' }, 403);
    }
  }
  // R307（用户 09-30）：单次批量操作最多 500 条的限制已取消，不再做条数限制；
  // 底层单次执行机制（placeholders + 事务）保持不变
  if (!['online', 'offline', 'hide', 'show', 'delete', 'changeCat', 'changePrice'].includes(action)) {
    return json({ ok: false, msg: '未知操作' }, 400);
  }

  /* v348 条30：不设条数上限（按老板要求），但一条 SQL 能带的变量有上限——
     一次塞几千个 id 会整批报错。现在按 200 条一批拆分执行，选多少都能稳稳做完。 */
  const CHUNK = 200;
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  const ph = (arr) => arr.map(() => '?').join(',');

  if (action === 'delete') {
    /* v439 复检修正：批量删除与单个删除口径统一——纯软删除进回收站（60 天），
       类型/资源码/统计/图片全部保留，恢复后资源完整可用（此前批删硬删了类型/统计/图仓，
       恢复出来是空壳）。到期彻底清除由 track.js 日清扫负责（届时才清图仓）。 */
    for (const c of chunks) {
      await env.DB.prepare(`UPDATE products SET deleted_at = datetime('now') WHERE id IN (${ph(c)})`).bind(...c).run();
    }
  } else if (action === 'changeCat') {
    const cid = Number(b.cid);
    if (isNaN(cid)) return json({ ok: false, msg: '请提供分类ID' }, 400);
    for (const c of chunks) {
      await env.DB.prepare(
        `UPDATE products SET cid = ?, updated_at = datetime('now') WHERE id IN (${ph(c)}) AND deleted_at IS NULL`
      ).bind(cid, ...c).run();
    }
  } else if (action === 'changePrice') {
    const price = Number(b.price);
    if (isNaN(price) || price < 0) return json({ ok: false, msg: '请提供有效价格' }, 400);
    for (const c of chunks) {
      await env.DB.prepare(
        `UPDATE products SET price = ?, updated_at = datetime('now') WHERE id IN (${ph(c)}) AND deleted_at IS NULL`
      ).bind(price, ...c).run();
    }
  } else if (action === 'online') {
    // 两态：显示 = is_online=1 且清掉 is_hidden（旧隐藏数据也能真正显示）
    for (const c of chunks) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 1, is_hidden = 0, updated_at = datetime('now') WHERE id IN (${ph(c)}) AND deleted_at IS NULL`
      ).bind(...c).run();
    }
  } else if (action === 'offline') {
    // 两态：隐藏 = is_online=0 且清掉 is_hidden
    for (const c of chunks) {
      await env.DB.prepare(
        `UPDATE products SET is_online = 0, is_hidden = 0, updated_at = datetime('now') WHERE id IN (${ph(c)}) AND deleted_at IS NULL`
      ).bind(...c).run();
    }
  } else {
    // hide/show：旧版动作兼容（前端已不再调用）
    const val = action === 'show' ? 1 : 0;
    for (const c of chunks) {
      await env.DB.prepare(
        `UPDATE products SET is_hidden = ?, updated_at = datetime('now') WHERE id IN (${ph(c)}) AND deleted_at IS NULL`
      ).bind(val, ...c).run();
    }
  }

  /* v440：批量动作留痕（#64 口径补全） */
  try {
    const LABEL = { online: '批量上架', offline: '批量下架', hide: '批量隐藏', show: '批量显示', delete: '批量删除（进回收站）', changeCat: '批量挪分类', changePrice: '批量改价' };
    const { audit } = await import('../../_utils.js');
    await audit(env, request, LABEL[action] || ('批量' + action), ids.length + ' 个资源' + (action === 'changeCat' ? (' → 分类#' + b.cid) : action === 'changePrice' ? (' → ' + b.price) : ''));
  } catch (e) {}
  return json({ ok: true, count: ids.length });
}
