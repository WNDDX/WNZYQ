/**
 * v459 外部链接台账（老板：把别家平台的商品链接收进来，点一下直达登录后的商品页，能看标题/封面/描述）
 *
 * GET  /api/admin/external?platform=&status=&q=   → { ok, platforms, links, counts }
 * POST /api/admin/external  { op, ... }
 *   platform.save / platform.del                        （仅超管）
 *   link.add / link.update / link.del / link.check
 * DELETE /api/admin/external?id=                        → 软删进回收站语义
 *
 * 只取标题 / 封面 / 描述（文字 + 图或视频链接），**不取价格**。
 * 状态判定按关键词表（方案 v3 第四节）：已售出 > 已删除 > 已下架 > 需登录 > 在售 > 判不出。
 */
import { ensureAdminUsers, json, readJSON, requireAuth, requirePerm } from '../../_utils.js';
import { parsePerms } from '../../_perms.js';

/* ===== 建表（懒迁移，线上旧库直接跑） ===== */
async function ensureExternal(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS external_platforms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL DEFAULT '',
    login_url TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    settle_note TEXT NOT NULL DEFAULT '',
    fetch_mode TEXT NOT NULL DEFAULT 'paste',
    sort INTEGER NOT NULL DEFAULT 0,
    req_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS external_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_id INTEGER NOT NULL DEFAULT 0,
    platform TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    url_backup TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    cover TEXT NOT NULL DEFAULT '',
    desc_text TEXT NOT NULL DEFAULT '',
    desc_media TEXT NOT NULL DEFAULT '[]',
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'onsale',
    status_hit TEXT NOT NULL DEFAULT '',
    url_ok INTEGER NOT NULL DEFAULT 1,
    url_msg TEXT NOT NULL DEFAULT '',
    last_checked TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    req_id TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  )`).run();
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ext_links_pf ON external_links(platform_id)').run(); } catch (e) {}
  /* v459 热修：Cloudflare 会把「执行时间偏长」的 POST 再跑一遍，而 INSERT 不幂等 ——
     实测点一次保存，库里出现两条一模一样的记录（同一个请求、只发了 1 次 fetch）。
     给写操作加请求幂等键 reqId：同一 reqId 再来一次，直接返回上次那条，不再插。 */
  try { await env.DB.prepare("ALTER TABLE external_platforms ADD COLUMN req_id TEXT NOT NULL DEFAULT ''").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE external_links ADD COLUMN req_id TEXT NOT NULL DEFAULT ''").run(); } catch (e) {}
  try { await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_pf_req ON external_platforms(req_id) WHERE req_id <> ''").run(); } catch (e) {}
  try { await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_lk_req ON external_links(req_id) WHERE req_id <> ''").run(); } catch (e) {}
}

/* ===== 状态关键词表（方案 v3 第四节；顺序即优先级） ===== */
const KW = {
  sold: ['已售出', '已卖出', '已售完', '卖掉啦', '已经卖出', '宝贝已卖出', '此商品已售出', '交易成功', '交易完成', '已成交',
    '订单已完成', '买家已付款', '已拍下', '已被购买', '已抢光', '库存0', '库存 0', '剩余0件', '剩余 0 件'],
  deleted: ['商品不存在', '宝贝不存在', '商品已删除', '已删除', '该宝贝已被删除', '找不到该商品', '页面不存在',
    '已失效', '已过期', '该商品已失效', '商品已下架或删除'],
  offdown: ['已下架', '商品已下架', '已关闭', '已停止出售', '违规下架', '审核不通过', '已冻结', '暂不销售'],
  needlogin: ['请先登录', '请登录', '登录后查看', '需要登录', '安全验证', '滑动验证', '人机验证', '访问验证', '验证码'],
  onsale: ['立即购买', '马上抢', '加入购物车', '拍下', '立即下单', '剩余', '库存', '在售', '可购买']
};
const KW_ORDER = ['sold', 'deleted', 'offdown', 'needlogin', 'onsale'];
const KW_LABEL = { sold: '已售出', deleted: '已下架', offdown: '已下架', needlogin: '待核对', onsale: '在售' };

/* 返回 { status, hit, label }；status 为空=没看出状态（不改原状态） */
function judgeStatus(text) {
  const t = String(text || '');
  if (!t) return { status: '', hit: '', label: '' };
  for (const k of KW_ORDER) {
    for (const w of KW[k]) {
      if (t.indexOf(w) >= 0) {
        const st = k === 'deleted' ? 'offdown' : (k === 'needlogin' ? 'check' : k);
        return { status: st, hit: w, label: KW_LABEL[k] };
      }
    }
  }
  return { status: '', hit: '', label: '' };
}

/* ===== 链接形态：是不是「商品详情页」（只提示不拦，老板说判不准别卡他） ===== */
function urlShape(url) {
  const raw = String(url || '').trim();
  if (!raw) return { ok: 0, msg: '还没填商品链接' };
  let u;
  try { u = new URL(raw); } catch (e) { return { ok: 0, msg: '链接格式不对，要以 http 开头' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: 0, msg: '只支持 http / https 链接' };
  /* v463：实测号卡商城的商品页是 hash 路由 —— https://ck.nxqingxian.cn/shop#/pages/goods/index?goodsId=2163&promoCode=xxx
     pathname 只有 /shop，参数全在 # 后面，原来既读不到 goodsId、又被路径里的 /index 误判成列表页。
     现在：把 hash 一起纳入判断 + 认 goodsId/productId/skuId/itemId 这类驼峰参数 + 去掉 /index 这个危险黑名单
     （uni-app 的路由大量叫 pages/xxx/index，拿它当列表页特征会大面积误报）。 */
  const full = (u.pathname + '?' + u.searchParams.toString() + u.hash).toLowerCase();
  const hasId = /[?&#](?:goods|product|sku|item)?_?id=[^&\s]+/.test(full);
  if (hasId) return { ok: 1, msg: '' };   /* 带商品 id = 详情页，这个判断优先，后面不再猜 */
  const badPaths = ['/list', '/search', '/category', '/cate', '/shoplist', '/result'];
  for (const b of badPaths) {
    if (full.indexOf(b) >= 0) {
      return { ok: 0, msg: '这看着是列表页/搜索页，不是商品详情页，结算会对不上' };
    }
  }
  for (const g of ['/item', '/goods', '/product', '/detail', '/p/']) {
    if (full.indexOf(g) >= 0) return { ok: 1, msg: '' };
  }
  return { ok: 0, msg: '看不出是商品详情页，确认一下地址栏那条是不是商品页' };
}

/* 从域名猜平台名（只有平台档案里没匹配上时才用） */
function guessPlatform(host) {
  const h = String(host || '').toLowerCase();
  if (/goofish|2\.taobao/.test(h)) return '闲鱼';
  if (/taobao/.test(h)) return '淘宝';
  if (/tmall/.test(h)) return '天猫';
  if (/yangkeduo|pinduoduo/.test(h)) return '拼多多';
  if (/1688/.test(h)) return '1688';
  if (/xiaohongshu|xhs/.test(h)) return '小红书';
  if (/douyin/.test(h)) return '抖音';
  return '';
}

function normMedia(raw) {
  let arr = [];
  try { arr = JSON.parse(raw || '[]'); } catch (e) { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  return JSON.stringify(arr.slice(0, 40).map(x => ({
    t: (x && x.t === 'video') ? 'video' : 'image',
    u: String((x && x.u) || '').slice(0, 1200)
  })).filter(x => /^https?:\/\//i.test(x.u)));
}

/* ===== GET：平台档案 + 链接列表 ===== */
export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    await ensureAdminUsers(env);
    await ensureExternal(env);
    const auth = await requirePerm(env, request, 'external.view');
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const pf = Number(url.searchParams.get('platform') || 0) || 0;
    const status = String(url.searchParams.get('status') || '').slice(0, 12);
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 40);

    const pfRes = await env.DB.prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM external_links l WHERE l.platform_id = p.id AND l.deleted_at IS NULL) AS cnt
       FROM external_platforms p ORDER BY p.sort ASC, p.id ASC`
    ).all();

    let sql = `SELECT * FROM external_links WHERE deleted_at IS NULL`;
    const binds = [];
    if (pf) { sql += ' AND platform_id = ?' + (binds.length + 1); binds.push(pf); }
    if (status) { sql += ' AND status = ?' + (binds.length + 1); binds.push(status); }
    if (q) {
      const n = binds.length + 1;
      /* 三个独立编号各绑一次：D1 的 bind 是按位置走的，同一个 ?n 复用有风险 */
      sql += ` AND (title LIKE ?${n} OR note LIKE ?${n + 1} OR url LIKE ?${n + 2})`;
      binds.push('%' + q + '%', '%' + q + '%', '%' + q + '%');
    }
    /* 排序：优先失效/待核对，其次最久没巡检的 */
    sql += ` ORDER BY CASE status WHEN 'offdown' THEN 0 WHEN 'broken' THEN 0 WHEN 'check' THEN 1 ELSE 2 END ASC,
             COALESCE(last_checked, '1970-01-01') ASC, sort ASC, id DESC LIMIT 500`;

    const stmt = binds.length ? env.DB.prepare(sql).bind(...binds) : env.DB.prepare(sql);
    const { results } = await stmt.all();

    const perms = parsePerms(typeof auth.perms === 'string' ? auth.perms : JSON.stringify(auth.perms || {}));
    const isSuper = auth.role === 'super';

    /* 子账号：只给自己登记的（后续可扩到下级；先按最小权限来） */
    let links = results || [];
    if (!isSuper) links = links.filter(l => String(l.created_by) === String(auth.username));

    const counts = { all: links.length, onsale: 0, sold: 0, offdown: 0, broken: 0, check: 0 };
    links.forEach(l => { if (counts[l.status] != null) counts[l.status]++; });

    /* v462：导出 CSV（老板要拿出去对结算） */
    if (url.searchParams.get('format') === 'csv') {
      const permsOk = isSuper || !!(perms.external && perms.external.export);
      if (!permsOk) return json({ ok: false, msg: '该功能未开放' }, 403);
      const ST = { onsale: '在售', sold: '已售出', offdown: '已下架', broken: '链接失效', check: '待核对' };
      const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' / ') + '"';
      const head = ['平台', '标题', '状态', '商品链接', '备用链接', '封面图', '描述文字', '描述图或视频', '备注', '上次巡检', '登记时间', '登记人'];
      const lines = [head.map(cell).join(',')];
      links.forEach(l => {
        let media = '';
        try { media = (JSON.parse(l.desc_media || '[]') || []).map(x => (x.t === 'video' ? '[视频] ' : '') + x.u).join(' | '); } catch (e) { media = ''; }
        lines.push([l.platform, l.title, ST[l.status] || l.status, l.url, l.url_backup, l.cover, l.desc_text, media, l.note, l.last_checked, l.created_at, l.created_by].map(cell).join(','));
      });
      const csv = '\ufeff' + lines.join('\r\n');
      const fn = '外部链接-' + new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) + '.csv';
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="' + encodeURIComponent(fn) + '"; filename*=UTF-8\'\'' + encodeURIComponent(fn)
        }
      });
    }

    return json({
      ok: true,
      platforms: pfRes.results || [],
      links,
      counts,
      me: { username: auth.username, role: auth.role, perms }
    });
  } catch (e) {
    return json({ ok: false, msg: '读取失败：' + (e && e.message || '未知错误') }, 500);
  }
}

/* ===== POST：平台与链接的增改删、状态判定 ===== */
export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    await ensureAdminUsers(env);
    await ensureExternal(env);
    const auth0 = await requireAuth(env, request);
    if (auth0 instanceof Response) return auth0;
    const b = await readJSON(request);
    const op = String(b.op || '');
    const isSuper = auth0.role === 'super';

    /* --- 平台档案：只有超管能加/删/改 --- */
    if (op.indexOf('platform.') === 0) {
      const auth = await requirePerm(env, request, 'external.view');
      if (auth instanceof Response) return auth;
      if (!isSuper) return json({ ok: false, msg: '只有总管能维护平台档案' }, 403);

      if (op === 'platform.save') {
        const id = Number(b.id || 0) || 0;
        const reqId = String(b.reqId || '').slice(0, 60);
        if (!id && reqId) {
          const dup = await env.DB.prepare('SELECT id FROM external_platforms WHERE req_id = ?').bind(reqId).first();
          if (dup) return json({ ok: true, id: dup.id, dup: true });
        }
        const name = String(b.name || '').trim().slice(0, 40);
        if (!name) return json({ ok: false, msg: '平台名不能为空' }, 400);
        const domain = String(b.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 80);
        const loginUrl = String(b.login_url || '').trim().slice(0, 500);
        const note = String(b.note || '').slice(0, 2000);
        const settle = String(b.settle_note || '').slice(0, 300);
        const mode = b.fetch_mode === 'server' ? 'server' : 'paste';
        const sort = Number(b.sort || 0) || 0;
        if (id) {
          await env.DB.prepare('UPDATE external_platforms SET name=?, domain=?, login_url=?, note=?, settle_note=?, fetch_mode=?, sort=? WHERE id=?')
            .bind(name, domain, loginUrl, note, settle, mode, sort, id).run();
          return json({ ok: true, id });
        }
        try {
          const r = await env.DB.prepare('INSERT INTO external_platforms (name, domain, login_url, note, settle_note, fetch_mode, sort, req_id) VALUES (?,?,?,?,?,?,?,?)')
            .bind(name, domain, loginUrl, note, settle, mode, sort, reqId).run();
          return json({ ok: true, id: (r.meta && r.meta.last_row_id) || 0 });
        } catch (eIns) {
          /* 唯一索引撞了 = 同一个请求重放，把已有那条还回去 */
          if (reqId) {
            const dup2 = await env.DB.prepare('SELECT id FROM external_platforms WHERE req_id = ?').bind(reqId).first();
            if (dup2) return json({ ok: true, id: dup2.id, dup: true });
          }
          throw eIns;
        }
      }
      if (op === 'platform.del') {
        const id = Number(b.id || 0) || 0;
        if (!id) return json({ ok: false, msg: '缺少平台 id' }, 400);
        const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM external_links WHERE platform_id=? AND deleted_at IS NULL').bind(id).first();
        if (used && used.n > 0) return json({ ok: false, msg: '这个平台下还有 ' + used.n + ' 条链接，先删链接再删平台' }, 400);
        await env.DB.prepare('DELETE FROM external_platforms WHERE id=?').bind(id).run();
        return json({ ok: true });
      }
      return json({ ok: false, msg: '未知操作：' + op }, 400);
    }

    /* --- 链接：按 op 校验权限 --- */
    const needPerm = op === 'link.add' ? 'external.add' : (op === 'link.del' ? 'external.del' : (op === 'link.touch' ? 'external.view' : 'external.edit'));
    const auth = await requirePerm(env, request, needPerm);
    if (auth instanceof Response) return auth;

    if (op === 'link.add' || op === 'link.update') {
      const id = Number(b.id || 0) || 0;
      const platformId = Number(b.platform_id || 0) || 0;
      const rawUrl = String(b.url || '').trim().slice(0, 1200);
      if (!rawUrl) return json({ ok: false, msg: '商品链接不能为空' }, 400);
      if (!/^https?:\/\//i.test(rawUrl)) return json({ ok: false, msg: '链接要以 http 或 https 开头' }, 400);
      let host = '';
      try { host = new URL(rawUrl).host; } catch (e) { return json({ ok: false, msg: '链接格式不对' }, 400); }

      let platformName = String(b.platform || '').trim().slice(0, 40);
      if (!platformName && platformId) {
        const p = await env.DB.prepare('SELECT name FROM external_platforms WHERE id=?').bind(platformId).first();
        if (p) platformName = p.name;
      }
      if (!platformName) platformName = guessPlatform(host) || host;

      const shape = urlShape(rawUrl);
      const payload = [
        platformId,
        platformName,
        rawUrl,
        String(b.url_backup || '').trim().slice(0, 1200),
        String(b.title || '').trim().slice(0, 300),
        String(b.cover || '').trim().slice(0, 1200),
        String(b.desc_text || '').slice(0, 8000),
        normMedia(b.desc_media),
        String(b.note || '').slice(0, 4000),
        String(b.status || 'onsale').slice(0, 12) || 'onsale',
        shape.ok ? 1 : 0,
        shape.msg || ''
      ];

      if (id) {
        const old = await env.DB.prepare('SELECT id, created_by FROM external_links WHERE id=? AND deleted_at IS NULL').bind(id).first();
        if (!old) return json({ ok: false, msg: '这条链接不在了' }, 404);
        if (!isSuper && String(old.created_by) !== String(auth.username)) return json({ ok: false, msg: '只能改自己登记的' }, 403);
        await env.DB.prepare(`UPDATE external_links SET platform_id=?, platform=?, url=?, url_backup=?, title=?, cover=?,
          desc_text=?, desc_media=?, note=?, status=?, url_ok=?, url_msg=? WHERE id=?`).bind(...payload, id).run();
        return json({ ok: true, id, url_warn: shape.ok ? '' : shape.msg });
      }

      const reqId = String(b.reqId || '').slice(0, 60);
      if (reqId) {
        const dup = await env.DB.prepare('SELECT id FROM external_links WHERE req_id = ?').bind(reqId).first();
        if (dup) return json({ ok: true, id: dup.id, dup: true, url_warn: shape.ok ? '' : shape.msg });
      }
      try {
        const r = await env.DB.prepare(`INSERT INTO external_links
          (platform_id, platform, url, url_backup, title, cover, desc_text, desc_media, note, status, url_ok, url_msg, created_by, last_checked, req_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'), ?)`).bind(...payload, auth.username, reqId).run();
        return json({ ok: true, id: (r.meta && r.meta.last_row_id) || 0, url_warn: shape.ok ? '' : shape.msg });
      } catch (eIns) {
        if (reqId) {
          const dup2 = await env.DB.prepare('SELECT id FROM external_links WHERE req_id = ?').bind(reqId).first();
          if (dup2) return json({ ok: true, id: dup2.id, dup: true, url_warn: shape.ok ? '' : shape.msg });
        }
        throw eIns;
      }
    }

    if (op === 'link.del') {
      const id = Number(b.id || 0) || 0;
      if (!id) return json({ ok: false, msg: '缺少 id' }, 400);
      const old = await env.DB.prepare('SELECT id, created_by FROM external_links WHERE id=? AND deleted_at IS NULL').bind(id).first();
      if (!old) return json({ ok: true });
      if (!isSuper && String(old.created_by) !== String(auth.username)) return json({ ok: false, msg: '只能删自己登记的' }, 403);
      await env.DB.prepare("UPDATE external_links SET deleted_at = datetime('now') WHERE id=?").bind(id).run();
      return json({ ok: true });
    }

    /* 点「打开」= 我看过了：只刷新巡检时间，不改状态（判断要真看到页面内容才做） */
    if (op === 'link.touch') {
      const id = Number(b.id || 0) || 0;
      if (!id) return json({ ok: false, msg: '缺少 id' }, 400);
      await env.DB.prepare("UPDATE external_links SET last_checked = datetime('now') WHERE id=? AND deleted_at IS NULL").bind(id).run();
      return json({ ok: true });
    }

    /* 状态判定：前端把粘贴到的文字/巡检文本交上来，后端按关键词表判并写备注 */
    if (op === 'link.check') {
      const id = Number(b.id || 0) || 0;
      if (!id) return json({ ok: false, msg: '缺少 id' }, 400);
      const text = String(b.text || '').slice(0, 20000);
      const j = judgeStatus(text);
      const when = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
      const row = await env.DB.prepare('SELECT note, status, status_hit FROM external_links WHERE id=? AND deleted_at IS NULL').bind(id).first();
      if (!row) return json({ ok: false, msg: '这条链接不在了' }, 404);
      let noteLine;
      if (j.status) noteLine = when + ' 巡检：命中「' + j.hit + '」→ ' + j.label;
      else noteLine = when + ' 巡检：这次没看出状态（保持原样）';
      const newNote = ((row.note || '') + '\n' + noteLine).trim().slice(-4000);
      const newStatus = j.status || row.status || 'check';
      await env.DB.prepare("UPDATE external_links SET status=?, status_hit=?, note=?, last_checked=datetime('now') WHERE id=?")
        .bind(newStatus, j.hit || (row.status_hit || ''), newNote, id).run();
      return json({ ok: true, status: newStatus, hit: j.hit, label: j.label, note: noteLine });
    }

    return json({ ok: false, msg: '未知操作：' + op }, 400);
  } catch (e) {
    return json({ ok: false, msg: '操作失败：' + (e && e.message || '未知错误') }, 500);
  }
}

/* ===== DELETE：等同于 link.del（软删） ===== */
export async function onRequestDelete(context) {
  const { env, request } = context;
  try {
    await ensureAdminUsers(env);
    await ensureExternal(env);
    const auth = await requirePerm(env, request, 'external.del');
    if (auth instanceof Response) return auth;
    const id = Number(new URL(request.url).searchParams.get('id') || 0) || 0;
    if (!id) return json({ ok: false, msg: '缺少 id' }, 400);
    const old = await env.DB.prepare('SELECT id, created_by FROM external_links WHERE id=? AND deleted_at IS NULL').bind(id).first();
    if (!old) return json({ ok: true });
    if (auth.role !== 'super' && String(old.created_by) !== String(auth.username)) return json({ ok: false, msg: '只能删自己登记的' }, 403);
    await env.DB.prepare("UPDATE external_links SET deleted_at = datetime('now') WHERE id=?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, msg: '删除失败：' + (e && e.message || '未知错误') }, 500);
  }
}
