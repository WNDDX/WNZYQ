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
    await ensureCollect(env);
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
        const mallUrl = String(b.mall_url || '').trim().slice(0, 600);
        const loginUrl = String(b.login_url || '').trim().slice(0, 500);
        const note = String(b.note || '').slice(0, 2000);
        const settle = String(b.settle_note || '').slice(0, 300);
        const mode = b.fetch_mode === 'server' ? 'server' : 'paste';
        const sort = Number(b.sort || 0) || 0;
        if (id) {
          try { await env.DB.prepare('UPDATE external_platforms SET name=?, domain=?, login_url=?, note=?, settle_note=?, fetch_mode=?, sort=?, mall_url=? WHERE id=?')
            .bind(name, domain, loginUrl, note, settle, mode, sort, mallUrl, id).run(); }
          catch (eU) { await env.DB.prepare('UPDATE external_platforms SET name=?, domain=?, login_url=?, note=?, settle_note=?, fetch_mode=?, sort=? WHERE id=?')
            .bind(name, domain, loginUrl, note, settle, mode, sort, id).run(); }
          return json({ ok: true, id });
        }
        try {
          const r = await env.DB.prepare('INSERT INTO external_platforms (name, domain, login_url, note, settle_note, fetch_mode, sort, req_id, mall_url) VALUES (?,?,?,?,?,?,?,?,?)')
            .bind(name, domain, loginUrl, note, settle, mode, sort, reqId, mallUrl).run();
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

    /* ---------- v470 采集：抓某平台的商城页 → 商品池 ---------- */
    if (op === 'collect' || op === 'find.one') {
      const authC = await requirePerm(env, request, 'external.fetch');
      if (authC instanceof Response) return authC;
      const isSuperC = auth0.role === 'super';

      if (op === 'find.one') {
        /* 粘一条商品链接来解析（抓不到列表的站用这个兜底） */
        const one = String(b.url || '').trim().slice(0, 1200);
        if (!/^https?:\/\//i.test(one)) return json({ ok: false, msg: '链接要以 http 开头' }, 400);
        const pg = await fetchPage(one, 15000);
        if (!pg.ok) return json({ ok: false, msg: '打不开这条链接（HTTP ' + pg.status + '）' }, 400);
        const title = (pg.text.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i) || [])[1] || '';
        const imgs = parseDetail(pg.text, one);
        if (!imgs.length && !title) return json({ ok: false, msg: '这条链接抓不到内容（可能是前端渲染的站）' }, 200);
        return json({ ok: true, title: plainText(title).slice(0, 80), cover: imgs[0] || '', media: imgs });
      }

      const pid = Number(b.platform_id || 0) || 0;
      const p = await env.DB.prepare('SELECT * FROM external_platforms WHERE id=?').bind(pid).first();
      if (!p) return json({ ok: false, msg: '先选一个平台' }, 400);
      const mall = String(b.url || p.mall_url || '').trim();
      if (!mall) return json({ ok: false, msg: '这个平台还没填「商城地址」' }, 400);
      if (!/^https?:\/\//i.test(mall)) return json({ ok: false, msg: '商城地址要以 http 开头' }, 400);

      let pg;
      try { pg = await fetchPage(mall, 15000); }
      catch (e) { return json({ ok: false, msg: '抓取超时或对方拒绝（' + (e && e.message || '') + '）' }, 200); }
      if (!pg.ok) return json({ ok: false, msg: '打不开这个商城（HTTP ' + pg.status + '）' }, 200);

      const list = parseGoodsList(pg.text, mall);
      if (!list.length) {
        return json({ ok: false, zero: true, msg: '这个平台抓不到商品 —— 多半是前端渲染的站（服务器只能拿到空壳）。可以用「粘链接解析」一条条来。' }, 200);
      }
      /* 去重入库（同平台 + 同标题 + 同封面 视为同一个） */
      let added = 0;
      const cap = Math.min(list.length, 60);
      for (let i = 0; i < cap; i++) {
        const g = list[i];
        try {
          const dup = await env.DB.prepare('SELECT id FROM external_goods WHERE platform_id=? AND title=? AND cover=?')
            .bind(pid, g.title, g.cover).first();
          if (dup) continue;
          await env.DB.prepare('INSERT INTO external_goods (platform_id, platform, src_url, title, cover, created_by) VALUES (?,?,?,?,?,?)')
            .bind(pid, p.name, g.link || '', g.title, g.cover, auth0.username).run();
          added++;
        } catch (eI) { /* 单条失败不影响整体 */ }
      }
      return json({ ok: true, found: list.length, added, saved: cap });
    }

    if (op === 'goods.list') {
      const authG = await requirePerm(env, request, 'external.view');
      if (authG instanceof Response) return authG;
      const pid = Number(b.platform_id || 0) || 0;
      const st = String(b.status || '').slice(0, 12);
      let q = 'SELECT * FROM external_goods WHERE 1=1';
      const binds = [];
      if (pid) { q += ' AND platform_id = ?' + (binds.length + 1); binds.push(pid); }
      if (st) { q += ' AND status = ?' + (binds.length + 1); binds.push(st); }
      if (auth0.role !== 'super') { q += ' AND created_by = ?' + (binds.length + 1); binds.push(auth0.username); }
      q += ' ORDER BY id DESC LIMIT 300';
      const stmt = binds.length ? env.DB.prepare(q).bind(...binds) : env.DB.prepare(q);
      const { results } = await stmt.all();
      return json({ ok: true, goods: results || [] });
    }

    if (op === 'goods.del') {
      const authD = await requirePerm(env, request, 'external.del');
      if (authD instanceof Response) return authD;
      const id = Number(b.id || 0) || 0;
      if (!id) return json({ ok: false, msg: '缺少 id' }, 400);
      await env.DB.prepare('DELETE FROM external_goods WHERE id=?').bind(id).run();
      return json({ ok: true });
    }

    if (op === 'goods.clear') {
      /* 一次清空某平台采集来的商品（逐条删太慢，实测 240 条要跑几分钟） */
      const authCl = await requirePerm(env, request, 'external.del');
      if (authCl instanceof Response) return authCl;
      const pid = Number(b.platform_id || 0) || 0;
      if (!pid) return json({ ok: false, msg: '缺少 platform_id' }, 400);
      const r = await env.DB.prepare('DELETE FROM external_goods WHERE platform_id=?').bind(pid).run();
      return json({ ok: true, deleted: (r.meta && r.meta.changes) || 0 });
    }

    if (op === 'goods.use') {
      const authU = await requirePerm(env, request, 'external.edit');
      if (authU instanceof Response) return authU;
      const id = Number(b.id || 0) || 0;
      const pitemId = Number(b.product_id || 0) || 0;
      if (!id) return json({ ok: false, msg: '缺少 id' }, 400);
      await env.DB.prepare("UPDATE external_goods SET status='used', used_product_id=? WHERE id=?").bind(pitemId, id).run();
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

/* ================= v470 采集（老板重新定义：从外站抓商品 → 商品池 → 他挑着上架） =================
   与上面的「台账」共存，但主入口改成：平台设置 → 外部商品采集 → 弹窗。
   只抓：标题 / 封面 / 详情长图。价格不抓（老板自己定价）。 */

async function ensureCollect(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS external_goods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_id INTEGER NOT NULL DEFAULT 0,
    platform TEXT NOT NULL DEFAULT '',
    src_url TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    cover TEXT NOT NULL DEFAULT '',
    detail_html TEXT NOT NULL DEFAULT '',
    detail_media TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'new',
    used_product_id INTEGER NOT NULL DEFAULT 0,
    collected_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL DEFAULT '',
    req_id TEXT NOT NULL DEFAULT ''
  )`).run();
  try { await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_goods_req ON external_goods(req_id) WHERE req_id <> ''").run(); } catch (e) {}
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ext_goods_pf ON external_goods(platform_id)').run(); } catch (e) {}
  /* 平台档案补两个字段（商城地址 / 后台地址），老的 domain/login_url 保留兼容 */
  try { await env.DB.prepare("ALTER TABLE external_platforms ADD COLUMN mall_url TEXT NOT NULL DEFAULT ''").run(); } catch (e) {}
}

const BAD_IMG = /(icon|logo|avatar|qrcode|qr_|sprite|placeholder|blank|loading|tabbar|banner|swiper|advert|\/static\/|\/assets\/)/i;

function absUrl(u, base) {
  u = String(u || '').trim();
  if (!u || /^data:/i.test(u)) return '';
  if (u.indexOf('//') === 0) return 'https:' + u;
  if (/^https?:\/\//i.test(u)) return u;
  try { return new URL(u, base).href; } catch (e) { return ''; }
}
function plainText(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

/* 通用解析：围绕「像商品的图」找上下文（标题 / 下单链接）。
   不依赖具体 class 名，所以能同时应付多种号卡模板。 */
function parseGoodsList(html, baseUrl) {
  const out = [], seen = {};
  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    const srcRaw = (tag.match(/(?:data-src|data-original|data-lazy-src|src)=["']([^"']+)["']/i) || [])[1];
    const src = absUrl(srcRaw, baseUrl);
    if (!src || BAD_IMG.test(src)) continue;
    const ctx = html.slice(Math.max(0, m.index - 400), m.index + 900);
    const texts = ctx.replace(/<[^>]+>/g, '\u0001').split('\u0001')
      .map(plainText).filter(t => t.length >= 4 && t.length <= 70 && /[\u4e00-\u9fa5]/.test(t));
    let title = texts.filter(t => /(卡|流量|套餐|通用|通话|月租)/.test(t))[0] || texts[0] || '';
    if (!title) continue;
    if (/^(下单|订购|购卡|充值|公告|须知|说明|客服|规则|提示|注意|首页|全部|移动|联通|电信|广电|搜索|登录|注册)$/.test(title)) continue;
    if (/(下单请|订购须知|购买须知|开卡须知|客服微信|友情提示|公告[:：])/.test(title)) continue;
    if (title.length < 6) continue;
    const hrefs = (ctx.match(/href=["']([^"']+)["']/gi) || []).map(x => absUrl(x.replace(/^href=["']|["']$/gi, ''), baseUrl))
      .filter(h => h && !/\.(css|js|png|jpe?g|webp|gif|svg)(\?|$)/i.test(h));
    const link = hrefs.filter(h => /(pid=|\/order\/|detail|goods\/|goodsId=|\/card\/)/i.test(h))[0] || '';
    const looksGoods = /(卡|流量|套餐|通用|通话|月租)/.test(title);
    if (!link && !looksGoods) continue;
    const key = (link || '') + '|' + title;
    if (seen[key]) continue;
    seen[key] = 1;
    out.push({ title: title.slice(0, 80), cover: src, link: link || '' });
    if (out.length >= 200) break;
  }
  return out;
}

async function fetchPage(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 12000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow'
    });
    const buf = await r.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(buf.slice(0, 600000));
    return { ok: r.ok, status: r.status, text: text };
  } finally { clearTimeout(timer); }
}

/* 从商品详情页抓长图（详情），拼成 html */
function parseDetail(html, baseUrl) {
  const imgs = [];
  const re = /<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const s = absUrl((m[0].match(/(?:data-src|data-original|src)=["']([^"']+)["']/i) || [])[1], baseUrl);
    if (!s || BAD_IMG.test(s)) continue;
    if (imgs.indexOf(s) >= 0) continue;
    imgs.push(s);
    if (imgs.length >= 20) break;
  }
  return imgs;
}
