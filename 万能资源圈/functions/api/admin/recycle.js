/**
 * GET    /api/admin/recycle          → 回收站列表（软删除的资源/分类 + 已删除公告），顺带清理满 60 天的
 * POST   /api/admin/recycle          → { op: 'restore' | 'purge', kind: 'product' | 'category' | 'ann', id }
 * v439 #68：删除全部走软删除进回收站，保 60 天（复用 60 天自动清理口径：到期彻底清）
 */
import { json, requireAuth, requirePerm, ensureSoftDelete, audit, clearPublicCache, deleteBucketImages } from '../../_utils.js';
import { parsePerms, can, catScopeSQL } from '../../_perms.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requirePerm(env, request, 'products.view');
  if (auth instanceof Response) return auth;
  await ensureSoftDelete(env);
  const myPerms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
  const scope = catScopeSQL(auth.role, myPerms);

  /* 满 60 天的回收站条目彻底清除（资源联动清类型/统计/图仓文件；分类直接删；公告从 JSON 摘除） */
  try {
    const expired = await env.DB.prepare("SELECT id FROM products WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-60 days')").all();
    for (const r of (expired.results || [])) {
      const row = await env.DB.prepare('SELECT img, detail, detail_images, detail_videos FROM products WHERE id = ?').bind(r.id).first();
      await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(r.id).run();
      await env.DB.prepare('DELETE FROM product_variants WHERE product_id = ?').bind(r.id).run();
      await env.DB.prepare('DELETE FROM stats WHERE product_id = ?').bind(r.id).run();
      const sources = [];
      if (row) sources.push(row.img, row.detail, row.detail_images, row.detail_videos);
      if (sources.length) await deleteBucketImages(env, sources);
    }
    const expiredCats = await env.DB.prepare("SELECT id FROM categories WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-60 days')").all();
    for (const r of (expiredCats.results || [])) {
      await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(r.id).run();
    }
    /* 公告软删条目同口径：deletedAt 满 60 天物理摘除（公告存 JSON，无表可删） */
    const annRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'announcements'").first().catch(() => null);
    if (annRow && annRow.value) {
      let arr = [];
      try { arr = JSON.parse(annRow.value) || []; } catch (e) { arr = []; }
      const cut = Date.now() - 60 * 86400000;
      const kept = arr.filter(a => !(a && a.deleted && a.deletedAt && new Date(a.deletedAt).getTime() < cut));
      if (kept.length !== arr.length) {
        await env.DB.prepare("UPDATE settings SET value = ? WHERE key = 'announcements'").bind(JSON.stringify(kept)).run();
      }
    }
  } catch (e) { /* 清理失败不阻塞列表 */ }

  let prows;
  if (scope) {
    prows = (await env.DB.prepare("SELECT id, title, img, deleted_at FROM products WHERE deleted_at IS NOT NULL AND " + scope.clause + " ORDER BY deleted_at DESC").bind(...scope.ids).all()).results || [];
  } else {
    prows = (await env.DB.prepare("SELECT id, title, img, deleted_at FROM products WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").all()).results || [];
  }
  const { results: crows } = await env.DB.prepare("SELECT id, name, deleted_at FROM categories WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").all();

  /* 公告：settings.announcements JSON 里带 deleted 标记的条目 */
  let anns = [];
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'announcements'").first();
    if (row && row.value) {
      const arr = JSON.parse(row.value);
      anns = (arr || []).filter(a => a.deleted).map(a => ({ id: a.id, title: a.title, deleted_at: a.deletedAt || '' }));
    }
  } catch (e) {}

  return json({ ok: true, products: prows || [], categories: crows || [], announcements: anns });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;
  await ensureSoftDelete(env);

  const b = await request.json().catch(() => ({}));
  const op = String(b.op || '');
  const kind = String(b.kind || '');
  const id = Number(b.id) || 0;
  if (!op || !kind || (!id && kind !== 'ann')) return json({ ok: false, msg: '参数错误' }, 400);
  /* #116：恢复/彻底删除分别鉴权 + 范围锁 */
  {
    const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
    const need = op === 'restore' ? 'products.restore' : 'products.purge';
    if (!can(need, auth.role, perms)) return json({ ok: false, msg: '该功能未开放' }, 403);
    if (kind === 'product') {
      const row = await env.DB.prepare('SELECT cid FROM products WHERE id = ?').bind(id).first();
      if (row) {
        const scope = catScopeSQL(auth.role, perms);
        if (scope && scope.ids.indexOf(Number(row.cid)) === -1) return json({ ok: false, msg: '该功能未开放' }, 403);
      }
    }
    if (kind === 'category' && auth.role !== 'super') return json({ ok: false, msg: '该功能未开放' }, 403); /* 分类回收站仅超管 */
  }

  if (kind === 'product') {
    if (op === 'restore') {
      await env.DB.prepare('UPDATE products SET deleted_at = NULL WHERE id = ?').bind(id).run();
      await audit(env, request, '回收站恢复资源', '#' + id);
    } else if (op === 'purge') {
      const row = await env.DB.prepare('SELECT img, detail, detail_images, detail_videos FROM products WHERE id = ?').bind(id).first();
      await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM product_variants WHERE product_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM stats WHERE product_id = ?').bind(id).run();
      const sources = [];
      if (row) sources.push(row.img, row.detail, row.detail_images, row.detail_videos);
      if (sources.length) await deleteBucketImages(env, sources);
      await audit(env, request, '回收站彻底删除资源', '#' + id);
    }
  } else if (kind === 'category') {
    if (op === 'restore') {
      await env.DB.prepare('UPDATE categories SET deleted_at = NULL WHERE id = ?').bind(id).run();
      await audit(env, request, '回收站恢复分类', '#' + id);
    } else if (op === 'purge') {
      await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
      await audit(env, request, '回收站彻底删除分类', '#' + id);
    }
  } else if (kind === 'ann') {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'announcements'").first();
    if (row && row.value) {
      let arr = [];
      try { arr = JSON.parse(row.value) || []; } catch (e) { arr = []; }
      if (op === 'restore') {
        arr = arr.map(a => { if (String(a.id) === String(id)) { delete a.deleted; delete a.deletedAt; } return a; });
        await audit(env, request, '回收站恢复公告', '#' + id);
      } else if (op === 'purge') {
        arr = arr.filter(a => String(a.id) !== String(id));
        await audit(env, request, '回收站彻底删除公告', '#' + id);
      }
      await env.DB.prepare("UPDATE settings SET value = ? WHERE key = 'announcements'").bind(JSON.stringify(arr)).run();
    }
  }

  await clearPublicCache(request);
  return json({ ok: true });
}
