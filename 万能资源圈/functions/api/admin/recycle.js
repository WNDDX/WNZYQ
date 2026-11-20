/**
 * GET    /api/admin/recycle          → 回收站列表（软删除的资源/分类 + 已删除公告），顺带清理满 60 天的
 * POST   /api/admin/recycle          → { op: 'restore' | 'purge', kind: 'product' | 'category' | 'ann', id }
 * v439 #68：删除全部走软删除进回收站，保 60 天（复用 60 天自动清理口径：到期彻底清）
 * v687（老板 11-21 04:10）：**彻底删除账号前，先把名下资源/分类归属转给超级管理员，再删账号**（顺序不能反，见 transferOwnedToSuper）
 */
import { json, requireAuth, requirePerm, ensureSoftDelete, ensureAdminUsers, audit, clearPublicCache, deleteBucketImages } from '../../_utils.js';
import { parsePerms, can, catScopeSQL } from '../../_perms.js';

/**
 * v687（老板 11-21 04:10 拍板）：「改成不会继承，那些资源都会到我超级管理员这里继承，资源状态不变」。
 * 彻底删除账号**之前**，把它名下的资源/分类归属转给超级管理员。
 *
 * 为什么必须「先转再删」：`products.created_by` / `categories.created_by` 存的是**用户名**（不是 id），
 * 账号一旦 DELETE 掉就再也查不到它叫过什么 → 顺序反了这批资源就永远查不出归属，成了"无主"。
 *
 * 只改 `created_by` 一个字段：**status / deleted_at / 价格 / 分类 一律不动**（老板明确「资源状态不变」）。
 * 转给超级管理员后，用同名新账号"继承"旧资源这件事天然不成立（`created_by` 已经不是那个用户名了），
 * 所以**不写任何继承逻辑**。
 *
 * @param {object} env Workers 环境（要 env.DB）
 * @param {string} username 即将被彻底删除的账号用户名
 * @returns {Promise<{to:string, products:number, categories:number}>} 转给了谁、转了几条
 */
async function transferOwnedToSuper(env, username) {
  const name = String(username || '').trim();
  const out = { to: '', products: 0, categories: 0 };
  if (!name) return out;
  /* 超级管理员在 `admins` 表里，不在 `admin_users`（子账号表）—— 取 id 最小的那条，与全站其它「超级管理员是谁」口径一致 */
  try {
    const r = await env.DB.prepare('SELECT username FROM admins ORDER BY id LIMIT 1').first();
    out.to = r && r.username ? String(r.username) : '';
  } catch (e) { out.to = ''; }
  /* 取不到超级管理员（比如 admins 表是空的）就跳过：宁可不转，也不能把归属改成空串——那等于制造新的无主资源 */
  if (!out.to || out.to === name) return out;
  try {
    const r1 = await env.DB.prepare('UPDATE products SET created_by = ? WHERE created_by = ?').bind(out.to, name).run();
    out.products = Number(r1 && r1.meta && r1.meta.changes) || 0;
  } catch (e) { console.error('彻底删除账号-转资源归属失败:', e && e.message); }
  try {
    const r2 = await env.DB.prepare('UPDATE categories SET created_by = ? WHERE created_by = ?').bind(out.to, name).run();
    out.categories = Number(r2 && r2.meta && r2.meta.changes) || 0;
  } catch (e) { console.error('彻底删除账号-转分类归属失败:', e && e.message); }
  return out;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  /* v676（老板：权限放开、授予时把关）：回收站列表改判 danger.recycle（原来是 products.view，
     等于「能看资源就能看回收站」）。恢复/彻底删仍走各自的 products.restore / products.purge。 */
  const auth = await requirePerm(env, request, 'danger.recycle');
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
    /* v684（复查 #5）：账号也必须 60 天到期清理，否则「保留 60 天」只是半句承诺，账号永远占在回收站里。
       track.js 的每日清单里没有 admin_users（grep = 0），所以放在这里保证一打开回收站就清。 */
    try {
      const expiredAcc = await env.DB.prepare("SELECT id, username FROM admin_users WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-60 days') AND role <> 'super'").all();
      for (const a of (expiredAcc.results || [])) {
        /* v687（老板 11-21 04:10）：到期自动彻底删除也必须**先转归属、再上移下级、最后删账号**，
           否则这些老账号名下的资源会因为「用户名查不到了」永远无主。顺序与手动彻底删除完全一致。 */
        await transferOwnedToSuper(env, a.username);
        await env.DB.prepare('UPDATE admin_users SET parent_id = 0 WHERE parent_id = ?').bind(a.id).run();
        await env.DB.prepare('DELETE FROM sessions WHERE admin_id = ? AND utype = ?').bind(a.id, 'u').run();
        await env.DB.prepare('DELETE FROM admin_users WHERE id = ?').bind(a.id).run();
      }
    } catch (e) { /* 迁移/清理失败不阻塞列表 */ }
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

  /* v680（老板 11-21：删账号要能回收）：账号也进回收站。
     只有超级管理员看得到——账号是权限体系本身，子账号不该看到「有哪些账号被删过」。 */
  let arows = [];
  if (auth.role === 'super') {
    try {
      await env.DB.prepare("ALTER TABLE admin_users ADD COLUMN deleted_at TEXT").run();
    } catch (e) {}
    try {
      /* v687（老板 11-21 04:10）：顺带带上「这个账号名下有多少资源」——
         前端「彻底删除账号」的确认框要说清「这 N 个资源会转到超级管理员名下」。
         `created_by` 存的是用户名，所以按 username 相关子查询计数（回收站里的资源也算，因为它同样会被转走）。 */
      arows = (await env.DB.prepare("SELECT u.id, u.username, u.role, u.deleted_at, (SELECT COUNT(*) FROM products WHERE created_by = u.username) AS product_count FROM admin_users u WHERE u.deleted_at IS NOT NULL ORDER BY u.deleted_at DESC").all()).results || [];
    } catch (e) { arows = []; }
  }

  return json({ ok: true, products: prows || [], categories: crows || [], announcements: anns, accounts: arows });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;
  await ensureSoftDelete(env);
  /* v687：`admin_users` 的列迁移（`deleted_at` / `status_before`）统一走 ensureAdminUsers。
     这里必须显式调一次——本文件的 GET/POST 都不经过 users.js，而「只被回收站点访问过的 isolate」
     如果缺这一列，下面恢复账号的 UPDATE 会 `no such column: status_before` → 恢复直接 500。
     （v684 就因为只在一个入口建列，线上踩过「子账号整个后台 500 且报错指不到真因」。） */
  await ensureAdminUsers(env);

  const b = await request.json().catch(() => ({}));
  const op = String(b.op || '');
  const kind = String(b.kind || '');
  const id = Number(b.id) || 0;
  if (!op || !kind || (!id && kind !== 'ann')) return json({ ok: false, msg: '参数错误' }, 400);
  /* v684（复查 #13）：原来 op/kind 拼错会一路走到 `{ok:true}`，界面显示"成功"其实什么都没做。加白名单。 */
  if (['restore', 'purge'].indexOf(op) === -1) return json({ ok: false, msg: '参数错误' }, 400);
  if (['product', 'category', 'ann', 'account'].indexOf(kind) === -1) return json({ ok: false, msg: '参数错误' }, 400);
  /* #116：恢复/彻底删除分别鉴权 + 范围锁 */
  {
    const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
    /* v684（复查 #11）：账号的恢复/彻底删语义上属于账号管理，不该借用 products.* 的键 */
    const need = (kind === 'account')
      ? 'account.del'
      : (op === 'restore' ? 'products.restore' : 'products.purge');
    if (!can(need, auth.role, perms)) return json({ ok: false, msg: '该功能未开放' }, 403);
    if (kind === 'product') {
      const row = await env.DB.prepare('SELECT cid FROM products WHERE id = ?').bind(id).first();
      if (row) {
        const scope = catScopeSQL(auth.role, perms);
        if (scope && scope.ids.indexOf(Number(row.cid)) === -1) return json({ ok: false, msg: '该功能未开放' }, 403);
      }
    }
    if (kind === 'category' && auth.role !== 'super') return json({ ok: false, msg: '该功能未开放' }, 403); /* 分类回收站仅超级管理员 */
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
      /* v633：补删派生数据——原来只清了 products/variants/stats，
         绑定设备（resource_bindings）和发码记录（code_issues）留成永远查不到资源的孤儿行：
         后台绑定清单里出现"标题为空"的设备、发码台账里挂着已不存在的资源，而且白占表空间。
         track.js 的 60 天自动清理本来就会删这两张，手动"彻底删除"必须同一口径。 */
      try { await env.DB.prepare('DELETE FROM resource_bindings WHERE product_id = ?').bind(id).run(); } catch (e1) { console.error('彻底删除-清绑定失败:', e1 && e1.message); }
      try { await env.DB.prepare('DELETE FROM code_issues WHERE product_id = ?').bind(id).run(); } catch (e2) { console.error('彻底删除-清发码失败:', e2 && e2.message); }
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
  } else if (kind === 'account') {
    /* v680：账号回收站——只有超级管理员能恢复/彻底删；超级管理员自己的账号不允许从这里动。 */
    if (auth.role !== 'super') return json({ ok: false, msg: '该功能未开放' }, 403);
    const t = await env.DB.prepare('SELECT id, username, role, deleted_at FROM admin_users WHERE id = ?').bind(id).first();
    if (!t) return json({ ok: false, msg: '账号不存在' }, 404);
    if (t.role === 'super') return json({ ok: false, msg: '超级管理员账号不能从这里删除或恢复' }, 403);
    if (op === 'restore') {
      if (!t.deleted_at) return json({ ok: false, msg: '该账号不在回收站里' }, 400);
      /* 用户名可能已被新账号占用（删了又建同名），恢复前先查重 */
      const dup = await env.DB.prepare('SELECT id FROM admin_users WHERE username = ? AND deleted_at IS NULL AND id <> ?').bind(t.username, id).first();
      if (dup) return json({ ok: false, msg: '已有同名账号在使用，无法恢复（可改名或彻底删除旧账号）' }, 400);
      /* v687：恢复要**还原删除前的冻结状态**，不能一律 `status = 1`。
         原来是先冻结（status=0）、再删除，恢复后写 1 → 账号变成可用，把「冻结」这个安全动作悄悄抹掉了。
         现在写 `COALESCE(status_before, 1)`：
           · `status_before` 有值（v687 之后被软删的账号）→ 用它，冻结的恢复后仍是冻结；
           · `status_before` 为 NULL → **兜底 1**。为什么兜底 1 而不是 0：这一列上线**之前**就被删的老账号没有这个值，
             而当时软删的语义是「status 置 0 只是为了停用登录，不代表用户被冻结过」——
             老数据里根本无从区分「冻结后删」和「直接删」，兜底 0 会把正常运行的老账号全变成冻结、超级管理员还得逐个解冻；
             兜底 1 等价于**旧行为**（恢复＝可用），既不误伤老数据，也不丢新数据的冻结语义。
         顺手把 `status_before` 清 NULL：避免下一次真删时（万一同行读不到 status 的旧值）残留上次的旧状态。 */
      await env.DB.prepare("UPDATE admin_users SET deleted_at = NULL, status = COALESCE(status_before, 1), status_before = NULL WHERE id = ?").bind(id).run();
      await audit(env, request, '回收站恢复账号', t.username);
    } else if (op === 'purge') {
      /* v684（复查阻断 #3）：原来不校验 deleted_at —— 拿一个「活跃账号」的 id 直接 POST 就能物理删掉它，
         删完它的下级 parent_id 指向不存在的行：列表里查不到、却照样能登录，成了幽灵账号。 */
      if (!t.deleted_at) return json({ ok: false, msg: '该账号不在回收站里，不能从回收站点彻底删除' }, 400);
      /* v687（老板 11-21 04:10）：**先转归属、再上移下级、最后删账号** —— 这个顺序是主控指定的硬要求。
         理由：资源/分类的 `created_by` 存的是用户名，账号一旦 DELETE 就查不到名字了，转不出去；
         所以「转」必须发生在「删」之前，一步都不能后置。只改 `created_by`，
         `status` / `deleted_at` / 价格 / 分类 / 上下架一律不动（老板：「资源状态不变」）。
         转给超级管理员后「同名新账号继承旧资源」也就不成立了（`created_by` 已不是那个用户名），**不写任何继承逻辑**。 */
      const moved = await transferOwnedToSuper(env, t.username);
      /* 再把下级上移，别留指向不存在行的 parent_id */
      await env.DB.prepare('UPDATE admin_users SET parent_id = 0 WHERE parent_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM sessions WHERE admin_id = ? AND utype = ?').bind(id, 'u').run().catch(() => {});
      await env.DB.prepare('DELETE FROM admin_users WHERE id = ?').bind(id).run();
      await audit(env, request, '回收站彻底删除账号',
        t.username + (moved.to ? '（名下资源 ' + moved.products + ' 个、分类 ' + moved.categories + ' 个已转给「' + moved.to + '」）' : '（未找到超级管理员账号，资源归属未转移）'));
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
