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
import { ensureAdminUsers, json, readJSON, requireAuth, requirePerm, audit } from '../../_utils.js';
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
  try { u = new URL(raw); } catch (e) { return { ok: 0, msg: '填完整网址' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: 0, msg: '只支持网页链接' };
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
      return { ok: 0, msg: '请打开具体商品页' };
    }
  }
  for (const g of ['/item', '/goods', '/product', '/detail', '/p/']) {
    if (full.indexOf(g) >= 0) return { ok: 1, msg: '' };
  }
  return { ok: 0, msg: '请确认是商品页' };
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
    await ensureSchema(env);
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
    await ensureSchema(env);
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
        const autoC = b.auto_collect ? 1 : 0;   /* v530：每天 0 点自动采一次 */
        if (id) {
          try { await env.DB.prepare('UPDATE external_platforms SET name=?, domain=?, login_url=?, note=?, settle_note=?, fetch_mode=?, sort=?, mall_url=?, auto_collect=? WHERE id=?')
            .bind(name, domain, loginUrl, note, settle, mode, sort, mallUrl, autoC, id).run(); }
          catch (eU) { await env.DB.prepare('UPDATE external_platforms SET name=?, domain=?, login_url=?, note=?, settle_note=?, fetch_mode=?, sort=?, auto_collect=? WHERE id=?')
            .bind(name, domain, loginUrl, note, settle, mode, sort, autoC, id).run(); }
          try { await audit(env, request, '修改采集平台', name + (autoC ? '（开启每天自动采集）' : '')); } catch (eA) {}
          return json({ ok: true, id });
        }
        try {
          const r = await env.DB.prepare('INSERT INTO external_platforms (name, domain, login_url, note, settle_note, fetch_mode, sort, req_id, mall_url, auto_collect) VALUES (?,?,?,?,?,?,?,?,?,?)')
            .bind(name, domain, loginUrl, note, settle, mode, sort, reqId, mallUrl, autoC).run();
          try { await audit(env, request, '新增采集平台', name + (autoC ? '（开启每天自动采集）' : '')); } catch (eA2) {}
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
        try { await audit(env, request, '删除采集平台', '#' + id); } catch (eA3) {}
        /* v476：删平台时，它采来的商品会变成「孤儿」——platform_id 指向不存在的平台，
           界面上按平台筛永远看不到，等于悄悄占着库。改成置为「未归平台」（0），
           商品还在、在「全部平台」里能看到，不会误删老板辛苦采的货。 */
        let orphan = 0;
        try {
          const r0 = await env.DB.prepare('UPDATE external_goods SET platform_id=0 WHERE platform_id=?').bind(id).run();
          orphan = (r0.meta && r0.meta.changes) || 0;
        } catch (e) {}
        return json({ ok: true, orphan: orphan });
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
      if (!/^https?:\/\//i.test(rawUrl)) return json({ ok: false, msg: '填完整网址' }, 400);
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

    /* ---------- v591：只探不写（老板 11-09 第 9 条）----------
       给「这个地址到底能不能采」和平台横评用：拉一次页面、走同一套解析，只返回条数和样例，
       一条都不入库。这样测十个八个平台不会污染采集库。 */
    if (op === 'probe') {
      const authP = await requirePerm(env, request, 'external.fetch');
      if (authP instanceof Response) return authP;
      const one = String(b.url || '').trim().slice(0, 1200);
      if (!/^https?:\/\//i.test(one)) return json({ ok: false, msg: '填完整网址' }, 400);
      const out = { ok: true, url: one, via: '', count: 0, samples: [], bytes: 0 };
      let ha = null;
      try { ha = await tryHaokaWeb(one); } catch (eH) {}
      if (ha && ha.items && ha.items.length) {
        out.via = 'api'; out.count = ha.items.length;
        out.samples = ha.items.slice(0, 5).map(function (x) { return x.title; });
        return json(out);
      }
      const pg = await fetchPage(one, 15000);
      out.bytes = (pg.text || '').length;
      if (!pg.ok) return json({ ok: false, msg: '打不开（HTTP ' + pg.status + '）', url: one, bytes: out.bytes }, 200);
      const list = parseGoodsList(pg.text, one);
      out.via = 'html'; out.count = list.length;
      out.gone = list.filter(function (x) { return x.gone; }).length;
      out.samples = list.slice(0, 5).map(function (x) { return x.title; });
      return json(out);
    }

    /* ---------- v470 采集：抓某平台的商城页 → 商品池 ---------- */
    if (op === 'collect' || op === 'find.one') {
      const authC = await requirePerm(env, request, 'external.fetch');
      if (authC instanceof Response) return authC;
      const isSuperC = auth0.role === 'super';

      if (op === 'find.one') {
        /* 粘一条商品链接来解析（抓不到列表的站用这个兜底） */
        const one = String(b.url || '').trim().slice(0, 1200);
        if (!/^https?:\/\//i.test(one)) return json({ ok: false, msg: '填完整网址' }, 400);
        const pg = await fetchPage(one, 15000);
        if (!pg.ok) return json({ ok: false, msg: '打不开这条链接（HTTP ' + pg.status + '）' }, 400);
        let title = plainText((pg.text.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i) || [])[1] || '');
        /* 有些站 title 是「加载中」或站点名，退一步用正文里像商品的标题 */
        if (!title || title.length < 5 || /^(加载中|首页|商城|号卡|登录)$/.test(title)) {
          const cand = parseGoodsList(pg.text, one);
          if (cand.length) title = cand[0].title;
        }
        const imgs = parseDetail(pg.text, one);
        const desc = plainText((pg.text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,300})["']/i) || [])[1] || '');
        if (!imgs.length && !title) {
          return json({ ok: false, shell: pg.text.length < 3000, msg: pg.text.length < 3000
            ? '这条链接的页面是个空壳（前端渲染的站，服务器拿不到内容）。改用「粘整页内容」那条路。'
            : '这条链接能打开，但页面里找不到商品图，可能是别的东西在挡（登录/验证）。' }, 200);
        }
        /* v501：顺便把这件资源的下单链接找出来（详情页里像「立即下单/立即领取」的链接）
           v546p（实测京东）：原正则只管关键词，结果把 360buyimg 的图片地址当成「下单链接」了——
           老板点进去是一张图。这里排掉图片/静态资源/图床域名，找不到就退回原链接。 */
        const isAssetUrl = function (u) {
          if (/\.(png|jpe?g|webp|gif|svg|ico|css|js|woff2?)(\?|#|$)/i.test(u)) return true;
          /* v546q（实测京东）：360buyimg / alicdn / qpic 这类图床域名不带路径，
             上一条规则认不出来，结果「下单链接」存成了图床根地址。这里按域名关键词再排一次。 */
          return /\/\/([\w-]+\.)*(360buyimg|alicdn|bdimg|qpic|hdslb|xiaohongshu|byteimg|sinaimg|zhimg|doubanio)\b/i.test(u)
            || /\/\/(img|image|img\d|pic|pics|static|cdn|oss|res)[\w.-]*\./i.test(u);
        };
        /* v587 用户 11-08（第 11 条：「下单链接都不对啊」）真根因：
           原来只要 href 里出现 buy|order|goods|pid 就算候选，然后**取第一个**，找不到就退回商品页原链接。
           于是「商品详情页」被当成「下单页」存了下来——用户点进去看到的不是下单。
           现在按「像不像下单页」打分排序，分数最高者胜：
             带 /order/ 路径  +10（下单页的典型路径）
             带 uid= 参数     +6（分销/下单页几乎必带 uid）
             带 pid= 参数     +6（商品 id，下单页必带）
             buy|pay 关键词   +4
           全部为 0 分（没有一个是下单特征）时才退回原链接，并在字段上留痕，便于排查。 */
        const buyCand = (pg.text.match(/href=["']([^"']*(?:buy|order|goods|goodsId=|pid=|uid=)[^"']*)["']/gi) || [])
          .map(function (x) { return absUrl(x.replace(/^href=["']|["']$/gi, ''), one); })
          .filter(function (u) { return u && !isAssetUrl(u); })
          .map(function (u) {
            var sc = 0;
            if (/\/order(\/|\?|$)/i.test(u)) sc += 10;
            if (/[?&]uid=/i.test(u)) sc += 6;
            if (/[?&]pid=/i.test(u)) sc += 6;
            if (/buy|pay|cart/i.test(u)) sc += 4;
            return { u: u, sc: sc };
          })
          .sort(function (a2, b2) { return b2.sc - a2.sc; });
        let buyHref = (buyCand[0] && buyCand[0].sc > 0) ? buyCand[0].u : one;
        /* v587 用户 11-08（第 4 条：「我要的是下单链接，不是商品详情链接；下单那个链接也会有商品信息」）：
           有些平台的下单页是 JS 拼的，HTML 里抓不到（实测夏沐号卡页面 20 个 href 里一个 order 都没有）。
           它们的下单链接有固定形状，按域名内置规则直接拼：
             kk.sviphk.cn/order/index?uid={k}&pid={pid}
               {k}   = 原链接里的 k 参数（= 分销 uid）
               {pid} = 商品页上的 pid（在 onclick="openPopup('good?pid=1954')" 里）
           参数全部取自原链接和原页面，原链接一个字都不改。 */
        const BUY_PATTERNS = {
          'kk.sviphk.cn': 'https://kk.sviphk.cn/order/index?uid={k}&pid={pid}'
        };
        try {
          const _host = new URL(one).hostname.toLowerCase();
          const _rule = BUY_PATTERNS[_host];
          if (_rule) {
            const _uu = new URL(one);
            const _kk = _uu.searchParams.get('k') || _uu.searchParams.get('uid') || '';
            const _pm = pg.text.match(/[?&]pid=(\d+)/i) || pg.text.match(/pid["']?\s*[:=]\s*["']?(\d+)/i);
            const _pp = _pm ? _pm[1] : '';
            if (_kk && _pp) {
              buyHref = _rule.replace(/\{k\}/g, _kk).replace(/\{pid\}/g, _pp);
            }
          }
        } catch (eRule) {}
        /* v597（老板 11-10 第 7 条「平台5的采集链接也是错的」）：号卡图文站（/article/good?pid=&k=）
           的下单页固定是 {origin}/order/index?uid={k}&pid={pid}。原来只给 kk.sviphk.cn 写死了一个域名，
           换一家（如 55555.wang）就把「商品详情页」当订单页存，点进去根本不是下单。
           现在改成通用规则：只要链接里同时有 k/uid 与 pid，就按这个形状拼；已经指向 /order/ 的不动。 */
        try {
          const _au = new URL(one);
          if (!/\/order(\/|\?|$)/i.test(buyHref)) {
            const _k2 = _au.searchParams.get('k') || _au.searchParams.get('uid') || '';
            let _pid2 = _au.searchParams.get('pid') || '';
            if (!_pid2) { const m2 = pg.text.match(/[?&]pid=(\d+)/i); if (m2) _pid2 = m2[1]; }
            if (_k2 && _pid2) buyHref = _au.origin + '/order/index?uid=' + encodeURIComponent(_k2) + '&pid=' + encodeURIComponent(_pid2);
          }
        } catch (eArt) {}
        /* v587（第 11 条）：平台配了下单链接模板时，按模板拼——比"猜 href"可靠得多。
           参数只从「原链接」和「原页面」里取，原链接 itself 一个字符都不改。 */
        try {
          const _pf = await env.DB.prepare('SELECT buy_pattern FROM external_platforms WHERE domain=? OR mall_url LIKE ?')
            .bind(new URL(one).hostname, '%' + new URL(one).hostname + '%').first();
          const _tpl = (_pf && String(_pf.buy_pattern || '').trim()) || '';
          if (_tpl) {
            const _u = new URL(one);
            const _k = _u.searchParams.get('k') || _u.searchParams.get('uid') || '';
            const _pidM = pg.text.match(/[?&]pid=(\d+)/i) || pg.text.match(/["']pid["']\s*[:=]\s*["']?(\d+)/i);
            const _pid = _pidM ? _pidM[1] : '';
            let _built = _tpl.replace(/\{k\}/g, _k).replace(/\{pid\}/g, _pid).replace(/\{url\}/g, one);
            if (_k || _pid) buyHref = _built;   /* 模板里用到的参数至少要有一个有着落才采用 */
          }
        } catch (eTpl) {}
        /* v546p：京东/淘宝这类站，服务端拿到的常常是「登录墙 / 站点首页」而不是商品本身——
           标题是站点名、一张商品图都没有。这种别报成功，说清楚，让老板换「粘贴」。 */
        const weak = (!imgs.length) && (!desc || desc.length < 40);
        /* v547（实测拼多多/闲鱼/微博/1688）：抓到的是「验证页 / 站点首页 / 已下架页」，
           标题长这样：Sina Visitor System、闲鱼 - 闲不住？上闲鱼、阿里巴巴-1688商品无法查看或已下架、
           拼多多。这些还被判成成功，入库就是垃圾。现在一律判失败并说清楚。 */
        /* v561（36 个平台横评实测）：两类"假成功"必须拦下——
           ① 链接本身就是站点首页（京东首页 / Shopify 官网 / 有赞官网），采到的标题是站点名、没有商品；
           ② 标题是「站点名 + 副标题」的落地页（京东全球版-、博客园-开发者的网上家园、rednote-）。
           判首页用 URL 路径最稳（根路径一定是首页）；判落地页用"站点名开头 + 分隔符"。 */
        const SITE_RE = '拼多多|闲鱼|淘宝网?|淘寶|天猫|天貓|京东|微博|小红书|rednote|抖音|快手|阿里巴巴|1688|唯品会|苏宁|当当|shopify|博客园|花瓣|站酷|游民星空|小鹅通|有赞|豆瓣|知乎';
        let _path = '/';
        try { _path = new URL(one).pathname || '/'; } catch (e0) {}
        const isSiteRoot = (_path === '/' || _path === '' || /^\/(index|home)\.(html?|php|aspx?)$/i.test(_path));
        if (isSiteRoot) {
          return json({ ok: false, home: true, msg: '请点进具体商品再复制' }, 200);
        }
        const junkTitle = /(Sina Visitor System|访客系统|安全验证|滑动验证|人机验证|访问验证|验证码|无法查看|已下架|商品不存在|宝贝不存在|页面不存在|创作你的创作)/i.test(title)
          || new RegExp('^(' + SITE_RE + ')\s*(?:[-－|｜:：,，]|\s|$)', 'i').test(String(title).trim());
        if (junkTitle) {
          return json({ ok: false, junk: true, msg: '抓不到，请粘贴整页' }, 200);
        }
        if (!imgs.length && (!desc || desc.length < 40)) {
          return json({ ok: false, weak: true, msg: '只抓到标题，请粘贴整页' }, 200);
        }
        return json({ ok: true, title: title.slice(0, 90), cover: imgs[0] || '', media: imgs, desc: desc.slice(0, 1000), buy_url: buyHref, weak: weak });
      }

      const pid = Number(b.platform_id || 0) || 0;
      const p = await env.DB.prepare('SELECT * FROM external_platforms WHERE id=?').bind(pid).first();
      if (!p) return json({ ok: false, msg: '先选一个平台' }, 400);
      const mall = String(b.url || p.mall_url || '').trim();
      if (!mall) return json({ ok: false, msg: '这个平台还没填「商城地址」' }, 400);
      if (!/^https?:\/\//i.test(mall)) return json({ ok: false, msg: '商城填完整网址' }, 400);

      let pg;
      try { pg = await fetchPage(mall, 15000); }
      catch (e) { return json({ ok: false, msg: '抓取超时，请稍后再试' }, 200); }
      if (!pg.ok) {
        return json({ ok: false, msg: pg.status >= 500
          ? '对方站点拒绝了服务器抓取（HTTP ' + pg.status + '）——这类站常按机房 IP 拦，只能开浏览器点「打开平台」看，或用「粘贴」'
          : (pg.status === 0 ? '连不上这个商城（超时或被直接断开）——换「打开平台」用浏览器看，或用「粘贴」' : '打不开这个商城（HTTP ' + pg.status + '）') }, 200);
      }

      /* v501：先走商站接口（uni-app 那类站 HTML 里永远是 0 条），不行再解析 HTML，最后同域探测 */
      let list = [];
      let via = 'html';
      const apiHit = await tryHaokaWeb(mall);
      if (apiHit && apiHit.items.length) { list = apiHit.items; via = 'api'; }
      if (!list.length) { list = parseGoodsList(pg.text, mall); }

      /* v546u（实测 47 个真实号卡平台）：这个行业几乎都是同一套模板站——
         首页 /index?k=xxx 只出 1~4 条甚至 0 条，真正的商品列表在 /article/goods 上。
         实测 ek.haokaya.com 首页 1 条、同站 /article/goods 19 条；
         ka.hkw10000.cn 首页 4 条、列表页 18 条。
         原来只在「一条都没抓到」时才探同域，抓到 1~4 条的站就被判成「能用」，其实是残的。
         现在少于 5 条就探一遍，探到更多就用探到的。 */
      let fixedAddr = '';
      if (list.length < 5) {
        try {
          const u0 = new URL(mall);
          const cands = ['/article/goods', '/article/goods/', '/goods', '/shop', '/goodslist', '/product', '/list'];
          /* v546y（实测）：老板粘的是「我店铺」的地址 /index?k=店铺码，探测真列表页时
             原来拼成 origin + /article/goods，把 k= 店铺码丢了——采回来的商品全成了平台默认店的，
             佣金算别人。这里把原链接的 query 一起带过去。 */
          for (const c of cands) {
            if (u0.pathname === c) continue;
            const cand = u0.origin + c + (u0.search || '');
            let pg2;
            try { pg2 = await fetchPage(cand, 8000, { retry: false }); } catch (e) { continue; }
            if (!pg2.ok) continue;
            const api2 = await tryHaokaWeb(cand);
            if (api2 && api2.items.length > list.length) { list = api2.items; via = 'api'; fixedAddr = cand; break; }
            const l2 = parseGoodsList(pg2.text, cand);
            if (l2.length > list.length && l2.length >= 3) { list = l2; fixedAddr = cand; break; }
          }
        } catch (e) {}
      }

      /* v501：HTML 路子只有列表信息，详情图/下单链接/描述都在详情页里。
         老板要「上架后别再手填」，所以这里趁采集就把详情补齐——只补前 12 条（控制请求数，
         Workers 单次请求有子请求上限），剩下的点「上架」时再按需抓。 */
      if (via !== 'api') {
        /* v546m：原来只补前 12 条，19 条的站会有 7 条没详情／没简介／点不进去。
           Cloudflare 单次请求子请求上限 50，补 20 条 + 列表 1 条仍在安全线内。 */
        const need = list.filter(function (x) { return x.link && !x.detail; }).slice(0, 20);
        for (let i = 0; i < need.length; i += 4) {
          const batch = need.slice(i, i + 4);
          await Promise.all(batch.map(async function (g) {
            try {
              const dp = await fetchPage(g.link, 6000, { retry: false });
              if (!dp.ok) return;
              const imgs = parseDetail(dp.text, g.link).filter(function (u) { return u !== g.cover; }).slice(0, 20);
              g.detail = imgs;
              const d = plainText((dp.text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,300})["']/i) || [])[1] || '') ||
                plainText((dp.text.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{0,300})["']/i) || [])[1] || '');
              if (!g.desc && d) g.desc = d;
              /* v546m：号卡站详情页多半没有 meta description，老板要「信息全一点」——
                 退一步取正文纯文本（先剥脚本/样式，避免把代码当简介）。 */
              if (!g.desc) {
                const bodyTxt = plainText(dp.text
                  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                  .replace(/<head[\s\S]*?<\/head>/gi, ' '));
                /* v546m：直接截正文，抓到的常是站点名/导航（实测「五湖通信号卡系统|」）。
                   改成按句切开，只留像套餐说明的句子（含流量/套餐/通话/元/G/月租这类词）。 */
                const cand = String(bodyTxt || '').split(/[。|｜\n\r,，、；;]+/)
                  .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
                  .filter(function (s) { return s.length >= 6 && s.length <= 300; })
                  .filter(function (s) { return /(流量|套餐|通话|月租|首月|元|G\b|国内|分钟|发货|激活|归属)/.test(s); });
                /* v547（老板：能采的都采）：原来只留 4 句共 200 字，号卡详情页里的
                   「套餐归属 / 配送方式 / 开卡方式 / 首充渠道 / 年龄限制 / 套餐合约 / 禁发区域 / 结算规则」
                   基本都被截掉。现在留 8 句、每句 120 字、总 900 字。 */
                if (cand.length) g.desc = cand.slice(0, 8).map(function (s) { return s.slice(0, 120); }).join('；').slice(0, 900);
                /* v547（老板：能采的都采）：详情页里的价格和正文原来全丢了。
                   这里把「XX元」抓成价格、正文全文塞进 extra，上架时能直接用。 */
                try {
                  const ex = {};
                  const priceM = /(?:月租|套餐|售价)?\s*(\d{1,4}(?:\.\d{1,2})?)\s*元/.exec(String(g.title || '') + ' ' + String(bodyTxt || ''));
                  if (priceM) ex.price = Number(priceM[1]);
                  const fullTxt = plainText(dp.text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
                  if (fullTxt) ex.raw = fullTxt.slice(0, 3000);
                  if (Object.keys(ex).length) g.extra = JSON.stringify(ex);
                } catch (eEx) {}
              }
              if (!g.buy) g.buy = g.link;
            } catch (e) {}
          }));
        }
      }
      /* v546u：同域探测已提前到解析完之后（少于 5 条就试），这里只留失败判定。 */
      if (!list.length) {
        const shell = pg.text.length < 4000 || /<!-- 商品将通过JS动态加载|id="productList"\s*>\s*</i.test(pg.text);
        return json({
          ok: false, zero: true, shell: shell,
          bytes: pg.text.length,
          msg: shell
            ? '这个地址是首页壳（资源要靠浏览器里的 JS 才加载出来，服务端抓不到），同域的常见列表页也没探到。两个办法：①去对方平台翻到真正的资源列表页，把那条地址换上再采集 ②用「粘贴」一条条加'
            : '页面能打开（' + pg.text.length + ' 字节），但这种排版我没见过，解析不出。用「粘贴」兜底，或把商城地址发我，我针对它调规则。',
          tip: !haokaCodes(mall).length
            ? '这个地址不带渠道码（店铺首页）：把它换成分享出来的 /s/xxxx 那种链接再采，接口就能出数据'
            : (shell ? '首页壳 → 换列表页地址或用粘贴' : '排版没见过 → 用粘贴兜底')
        }, 200);
      }
      /* v546w（老板：采到的商品必须是我店铺的，不是平台公共商品）：
         这些模板站的商品详情链接本身不带店铺标识——列表页带 k=xxx（我的店），
         详情页却是 article/good?pid=5873，客户点「去下单」就落到平台默认店，佣金算别人的。
         这里把来源店铺的专属参数（k / shop_id / mall_id / agent_id / promoCode / userCode）
         原样补到每条商品链接上，商品链接自己已经带的不重复加。 */
      try {
        const ownKeys = ['k', 'shop_id', 'mall_id', 'agent_id', 'promoCode', 'userCode'];
        /* v546y：店铺参数优先从老板粘的原始链接里读（mall），探测后的地址可能只剩列表路径。 */
        const grab = function (u) {
          try { const o = new URL(u); const r = {}; ownKeys.forEach(function (k) { const v = o.searchParams.get(k); if (v) r[k] = v; }); return r; } catch (e) { return {}; }
        };
        const ownMap = Object.assign({}, grab(fixedAddr || ''), grab(mall || ''));
        const ownPairs = ownKeys.filter(function (k) { return ownMap[k]; })
          .map(function (k) { return k + '=' + encodeURIComponent(ownMap[k]); });
        if (ownPairs.length) {
          list.forEach(function (g) {
            if (!g.link) return;
            try {
              const gu = new URL(g.link);
              const miss = ownPairs.filter(function (p) { return !gu.searchParams.has(p.split('=')[0]); });
              const q = (g.link.indexOf('?') >= 0 ? '&' : '?') + miss.join('&');
              if (miss.length) g.link = g.link + q;
              /* v547：客户点「去下单」用的是 buy_url，原来它没跟着补码——必须一起带。 */
              if (g.buy && !/[?&](k|promocode|shop_id|mall_id|agent_id|usercode)=/i.test(g.buy)) {
                g.buy = g.buy + ((g.buy.indexOf('?') >= 0 ? '&' : '?') + miss.join('&'));
              }
            } catch (eL) {}
          });
        }
      } catch (eOwn) {}
      let _ownN = 0;
      try { _ownN = (function () { const u = new URL(fixedAddr || mall); return ['k','shop_id','mall_id','agent_id','promoCode','userCode'].filter(function (k) { return u.searchParams.get(k); }).length; })(); } catch (e) {}
      const _ownList = list.filter(function (g) { return /[?&](k|promoCode|shop_id|mall_id|agent_id)=/i.test(g.link || ''); }).length;

      /* 入库：同平台 + 同标题 视为同一个（封面可能变） */
      let added = 0, dup = 0;
      const cap = Math.min(list.length, 120);
      for (let i = 0; i < cap; i++) {
        const g = list[i];
        try {
          const hit = await env.DB.prepare('SELECT id FROM external_goods WHERE platform_id=? AND title=?')
            .bind(pid, g.title).first();
          if (hit) {
            if (g.gone) { /* v590（第 6 条）：对方页面自己标了「已下架/售罄/失效」——按采不到处理 */
              try { await env.DB.prepare('UPDATE external_goods SET missing = missing + 1 WHERE id=?').bind(hit.id).run(); } catch (eG) {}
              continue;
            }
            /* v587 用户 11-08（第 3 条「我再次点击采集如果有更新的话就要更新啊，我看怎么没变化」）：
               原来命中就只 dup++ 跳过，对方改了封面/价格/详情，我们这边永远是第一次采到的老样子。
               现在按「以对方平台实时信息为主」覆盖：封面、描述、下单链接、详情图文、附加参数全部刷新。
               标题不动——标题是用户可能手动改过的，也是最容易误伤的一项。 */
            dup++;
            const _dHtmlOld = (g.detail && g.detail.length)
              ? g.detail.map(function (u) { return '<p><img src="' + u + '"></p>'; }).join('')
              : '';
            try {
              await env.DB.prepare(
                "UPDATE external_goods SET last_seen_at=datetime('now'), missing=0, cover=?, descr=?, buy_url=?, detail_html=?, detail_media=?, extra=? WHERE id=?"
              ).bind(
                g.cover || '', g.desc || '', g.buy || g.link || '',
                _dHtmlOld, JSON.stringify(g.detail || []), g.extra || '', hit.id
              ).run();
            } catch (eUP) {
              try { await env.DB.prepare("UPDATE external_goods SET last_seen_at=datetime('now'), missing=0 WHERE id=?").bind(hit.id).run(); } catch (eUP2) {}
            }
            continue;
          }
          const dHtml = (g.detail && g.detail.length)
            ? g.detail.map(function (u) { return '<p><img src="' + u + '"></p>'; }).join('')
            : '';
          if (g.gone) continue; /* v590（第 6 条）：新采到的这条页面自己写着已下架，不入库 */
          await env.DB.prepare('INSERT INTO external_goods (platform_id, platform, src_url, title, cover, descr, buy_url, detail_html, detail_media, extra, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
            .bind(pid, p.name, g.link || '', g.title, g.cover, g.desc || '', g.buy || g.link || '', dHtml,
              JSON.stringify(g.detail || []), g.extra || '', auth0.username).run();
          added++;
        } catch (eI) { /* 单条失败不影响整体 */ }
      }
      /* v495/v501：探到真列表页就写回平台档案——下次不用重探，平台上显示的也是能抓的那个地址 */
      if (fixedAddr) {
        try { await env.DB.prepare('UPDATE external_platforms SET mall_url=? WHERE id=?').bind(fixedAddr, pid).run(); } catch (e) {}
      }
      /* ===== v587 用户 11-08（第 9 条）：采完做一次盘点 =====
         「以对方平台实时信息为主」——这次没采到的，说明对方那边可能没了。
         判定口径：
           ① 只盘「采到过的」（last_seen_at 非空），老数据第一次采之前不算缺失，避免误报
           ② 最后一次见到早于 5 分钟前 → missing + 1（5 分钟是给同一次采集留的余量）
           ③ **1 次缺失就认定「对方已下架」**（用户 2026-11-09 明确要求：宁可误报也别漏报，宁可我们这边先藏起来）
           ④ 平台开了 auto_hide 且这条已经上架过 → 把我们这边的资源也自动藏起来
        不清空、不删除：数据还在，只是标记 + 隐藏，对方恢复后下次采集会自动恢复。 */
      let _missMarked = 0, _autoHidden = 0;
      /* v590（老板 11-09 第 6 条）：分页保护——很多平台一页 20 条、要翻页才全。
         只抓到第一页就按「没出现＝下架」判定，会把第 2 页起的所有商品误判成下架。
         规则：这个平台原本有 ≥8 条在架，而这次采到的条数不到原来的 6 成 → 认为没抓全，本轮不判定。 */
      let _partial = false;
      try {
        const _alive = await env.DB.prepare("SELECT COUNT(*) AS n FROM external_goods WHERE platform_id=? AND missing=0 AND last_seen_at<>''").bind(pid).first();
        const _n0 = (_alive && Number(_alive.n)) || 0;
        if (_n0 >= 8 && list.length < Math.ceil(_n0 * 0.6)) _partial = true;
      } catch (ePA) {}
      try {
        if (_partial) throw { __skip: 1 };
        const _upd = await env.DB.prepare(
          /* v591（老板 11-09 第 6 条「很多下架了，你还有数据的」）：
             原来这条判据要求 `last_seen_at <> ''`——也就是「从没被采集确认过」的条目**永远不参与判定**。
             实测平台 1 有 3 条正是这种（当初手工/导入进来的，last_seen_at 为空），对方页面早没了，
             我们这边永远显示在架。现在把空值也纳入：本次采到的条目已被刷新成当前时间，
             剩下的空值/旧时间就说明「这次确实没见到」→ 记一次缺失。 */
          "UPDATE external_goods SET missing = missing + 1 WHERE platform_id = ? AND (last_seen_at = '' OR last_seen_at < datetime('now', '-5 minutes')) AND missing < 99"
        ).bind(pid).run();
        _missMarked = (_upd && _upd.meta && _upd.meta.changes) || 0;
        /* 上次见到过、这次又见到 → 恢复：清零缺失，并把系统自动藏的资源放出来 */
        try {
          const _back = await env.DB.prepare(
            "SELECT id, used_product_id FROM external_goods WHERE platform_id = ? AND missing = 0 AND auto_hidden = 1"
          ).bind(pid).all();
          for (const g of (_back.results || [])) {
            if (g.used_product_id) {
              try { await env.DB.prepare('UPDATE products SET is_hidden = 0 WHERE id = ?').bind(g.used_product_id).run(); } catch (eB1) {}
            }
            try { await env.DB.prepare('UPDATE external_goods SET auto_hidden = 0 WHERE id = ?').bind(g.id).run(); } catch (eB2) {}
          }
        } catch (eBack) {}
        if (p && Number(p.auto_hide)) {
          const _bad = await env.DB.prepare(
            "SELECT id, used_product_id FROM external_goods WHERE platform_id = ? AND missing >= 1 AND used_product_id > 0 AND auto_hidden = 0"
          ).bind(pid).all();
          for (const g of (_bad.results || [])) {
            try { await env.DB.prepare('UPDATE products SET is_hidden = 1 WHERE id = ?').bind(g.used_product_id).run(); } catch (eH1) {}
            try { await env.DB.prepare('UPDATE external_goods SET auto_hidden = 1 WHERE id = ?').bind(g.id).run(); } catch (eH2) {}
            _autoHidden++;
          }
        }
      } catch (eAudit) {}

      return json({
        ok: true, found: list.length, added, dup, saved: cap, bytes: pg.text.length,
        missing_marked: _missMarked, auto_hidden: _autoHidden, partial: _partial,
        via: via, fixed_addr: fixedAddr, own_params: _ownN, own_links: _ownList,
        samples: list.slice(0, 5).map(function (x) { return x.title; })
      });
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

    /* 粘一条 / 手动加一条进池（find.one 抓到的东西落库） */
    if (op === 'goods.add') {
      const authA = await requirePerm(env, request, 'external.add');
      if (authA instanceof Response) return authA;
      const title = String(b.title || '').trim().slice(0, 90);
      if (!title) return json({ ok: false, msg: '标题不能为空' }, 400);
      const pid = Number(b.platform_id || 0) || 0;
      let pfName = '';
      if (pid) {
        const pf = await env.DB.prepare('SELECT name FROM external_platforms WHERE id=?').bind(pid).first();
        pfName = (pf && pf.name) || '';
      }
      const cover = String(b.cover || '').trim().slice(0, 800);
      const srcUrl = String(b.src_url || '').trim().slice(0, 1200);
      const media = Array.isArray(b.media) ? b.media.slice(0, 30).map(function (u) { return String(u).slice(0, 800); }) : [];
      const detailHtml = String(b.detail_html || '').slice(0, 60000)
        || media.map(function (u) { return '<p><img src="' + u + '"></p>'; }).join('');
      const reqId2 = String(b.reqId || '').slice(0, 60);
      if (reqId2) {
        const dup0 = await env.DB.prepare('SELECT id FROM external_goods WHERE req_id=?').bind(reqId2).first();
        if (dup0) return json({ ok: true, id: dup0.id, dup: true });
      }
      /* v546q（实测）：不选平台时 pid=0，原来直接跳过去重判断，
         同一条链接反复「粘贴→保存」就会在池子里堆成好几条。没平台就按 标题+来源链接 去重。 */
      const dup1 = pid
        ? await env.DB.prepare('SELECT id FROM external_goods WHERE platform_id=? AND title=?').bind(pid, title).first()
        : await env.DB.prepare('SELECT id FROM external_goods WHERE title=? AND src_url=?').bind(title, srcUrl).first();
      if (dup1) return json({ ok: true, id: dup1.id, dup: true, msg: '商品池里已经有了' });
      const descrAdd = String(b.descr || '').slice(0, 1200);
      const buyAdd = String(b.buy_url || '').slice(0, 1200);
      try {
        const r = await env.DB.prepare('INSERT INTO external_goods (platform_id, platform, src_url, title, cover, descr, buy_url, detail_html, detail_media, created_by, req_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
          .bind(pid, pfName, srcUrl, title, cover, descrAdd, buyAdd || srcUrl, detailHtml, JSON.stringify(media), auth0.username, reqId2).run();
        return json({ ok: true, id: (r.meta && r.meta.last_row_id) || 0 });
      } catch (eAdd) {
        return json({ ok: false, msg: '存不进去：' + (eAdd && eAdd.message || '') }, 500);
      }
    }

    /* 改池里的东西（标题 / 封面 / 详情图） */
    if (op === 'goods.update') {
      const authUp = await requirePerm(env, request, 'external.edit');
      if (authUp instanceof Response) return authUp;
      const id = Number(b.id || 0) || 0;
      if (!id) return json({ ok: false, msg: '缺少 id' }, 400);
      const sets = [], binds = [];
      if (b.title != null) { sets.push('title=?'); binds.push(String(b.title).trim().slice(0, 90)); }
      if (b.cover != null) { sets.push('cover=?'); binds.push(String(b.cover).trim().slice(0, 800)); }
      if (b.src_url != null) { sets.push('src_url=?'); binds.push(String(b.src_url).trim().slice(0, 1200)); }
      if (b.detail_html != null) { sets.push('detail_html=?'); binds.push(String(b.detail_html).slice(0, 60000)); }
      if (b.descr != null) { sets.push('descr=?'); binds.push(String(b.descr).slice(0, 1200)); }
      if (b.buy_url != null) { sets.push('buy_url=?'); binds.push(String(b.buy_url).slice(0, 1200)); }
      if (Array.isArray(b.media)) {
        sets.push('detail_media=?');
        binds.push(JSON.stringify(b.media.slice(0, 30).map(function (u) { return String(u).slice(0, 800); })));
      }
      if (!sets.length) return json({ ok: false, msg: '没有要改的字段' }, 400);
      binds.push(id);
      await env.DB.prepare('UPDATE external_goods SET ' + sets.join(', ') + ' WHERE id=?').bind(...binds).run();
      return json({ ok: true });
    }

    /* 批量导入（从别家后台导出的商品列表 / 粘贴多行） */
    if (op === 'goods.import') {
      const authIm = await requirePerm(env, request, 'external.add');
      if (authIm instanceof Response) return authIm;
      const pid = Number(b.platform_id || 0) || 0;
      let pfName = String(b.platform || '').slice(0, 40);
      if (pid) {
        const pf = await env.DB.prepare('SELECT name FROM external_platforms WHERE id=?').bind(pid).first();
        pfName = (pf && pf.name) || pfName;
      }
      const rows = Array.isArray(b.rows) ? b.rows.slice(0, 500) : [];
      if (!rows.length) return json({ ok: false, msg: '没有可导入的行' }, 400);
      let added = 0, dup = 0, bad = 0;
      for (const r0 of rows) {
        const title = String((r0 && r0.title) || '').trim().slice(0, 90);
        if (!title) { bad++; continue; }
        const cover = String((r0 && r0.cover) || '').trim().slice(0, 800);
        const srcUrl = String((r0 && r0.src_url) || '').trim().slice(0, 1200);
        try {
          const hit = pid
            ? await env.DB.prepare('SELECT * FROM external_goods WHERE platform_id=? AND title=?').bind(pid, title).first()
            : await env.DB.prepare("SELECT * FROM external_goods WHERE title=? AND platform='' ").bind(title).first();
          if (hit) {
            dup++;
            /* v482：重复导入时不要直接跳过——之前可能是没带封面/链接导进去的，
               这次带了就补上（原来「已存在就跳过」，导致重新导入也补不全，实测踩到）。 */
            try {
              const nCover = (cover && !hit.cover) ? cover : hit.cover;
              const nUrl = (srcUrl && !hit.src_url) ? srcUrl : hit.src_url;
              const nPid = (!hit.platform_id && pid) ? pid : hit.platform_id;
              if (nCover !== hit.cover || nUrl !== hit.src_url || nPid !== hit.platform_id) {
                await env.DB.prepare('UPDATE external_goods SET cover=?, src_url=?, platform_id=?, platform=CASE WHEN platform=\'\' THEN ? ELSE platform END WHERE id=?')
                  .bind(nCover, nUrl, nPid, pfName, hit.id).run();
              }
            } catch (eU) {}
            continue;
          }
          await env.DB.prepare('INSERT INTO external_goods (platform_id, platform, src_url, title, cover, created_by) VALUES (?,?,?,?,?,?)')
            .bind(pid, pfName, srcUrl, title, cover, auth0.username).run();
          added++;
        } catch (e) { bad++; }
      }
      return json({ ok: true, added, dup, bad, total: rows.length });
    }

    if (op === 'goods.del') {
      const authD = await requirePerm(env, request, 'external.del');
      if (authD instanceof Response) return authD;
      const id = Number(b.id || 0) || 0;
      if (!id) return json({ ok: false, msg: '缺少 id' }, 400);
      await env.DB.prepare('DELETE FROM external_goods WHERE id=?').bind(id).run();
      try { await audit(env, request, '删除采集资源', '#' + id); } catch (eA4) {}
      return json({ ok: true });
    }

    if (op === 'goods.clear') {
      /* 一次清空某平台采集来的商品（逐条删太慢，实测 240 条要跑几分钟） */
      const authCl = await requirePerm(env, request, 'external.del');
      if (authCl instanceof Response) return authCl;
      /* all=true 清空整个商品池；platform_id=0 清「未归平台」的那批 */
      if (b.all) {
        const r0 = await env.DB.prepare('DELETE FROM external_goods').run();
        return json({ ok: true, deleted: (r0.meta && r0.meta.changes) || 0 });
      }
      const pid = Number(b.platform_id || 0) || 0;
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

export async function ensureCollect(env) {
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
  /* v530：定时采集——每个平台可单独开关；last_auto_at 记录上次自动采的时间 */
  try { await env.DB.prepare('ALTER TABLE external_platforms ADD COLUMN auto_collect INTEGER NOT NULL DEFAULT 0').run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE external_platforms ADD COLUMN last_auto_at TEXT NOT NULL DEFAULT ''").run(); } catch (e) {}
  /* v587 用户 11-08（第 9 条）：「以对方平台实时信息为主」
     · last_seen_at  最后一次在对方平台「还看得到」的时间——用来判断谁消失了
     · missing       连续采不到的轮次。1 次可能是网络抖动，连续 2 次才认定下架
     · auto_hidden   是否被系统自动隐藏（用于恢复时区分「人手动藏的」和「系统藏的」）
     · auto_hide     平台级开关：采到对方下架时，是否自动把我们也藏起来 */
  try { await env.DB.prepare("ALTER TABLE external_goods ADD COLUMN last_seen_at TEXT NOT NULL DEFAULT ''").run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE external_goods ADD COLUMN missing INTEGER NOT NULL DEFAULT 0').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE external_goods ADD COLUMN auto_hidden INTEGER NOT NULL DEFAULT 0').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE external_platforms ADD COLUMN auto_hide INTEGER NOT NULL DEFAULT 1').run(); } catch (e) {}
  /* v587 用户 11-08（第 11 条）：下单链接模板。
     很多平台的下单页是 JS 动态拼的，服务端抓 HTML 抓不到那条链接（实测夏沐号卡：页面里只有
     onclick="openPopup('good?pid=1954')"，没有任何 order href）。
     但它们有规律：https://kk.sviphk.cn/order/index?uid={k}&pid={pid}
       {k}   = 你给我的那条链接里的 k 参数（= 分销 uid）
       {pid} = 页面里商品的 pid
     所以让平台自己配一条模板，采集时按模板拼——参数全部**取自原链接和原页面**，不改原链接一个字符。 */
  try { await env.DB.prepare("ALTER TABLE external_platforms ADD COLUMN buy_pattern TEXT NOT NULL DEFAULT ''").run(); } catch (e) {}
  /* v501：老板要「描述」和「下单链接」——原来只有标题/封面/详情图，上架后还得自己补 */
  try { await env.DB.prepare("ALTER TABLE external_goods ADD COLUMN descr TEXT NOT NULL DEFAULT ''").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE external_goods ADD COLUMN buy_url TEXT NOT NULL DEFAULT ''").run(); } catch (e) {}
  /* v512：接口给的其它有用字段（月租/流量/通话/归属/标签）存下来，上架填不进去的至少能看 */
  try { await env.DB.prepare("ALTER TABLE external_goods ADD COLUMN extra TEXT NOT NULL DEFAULT ''").run(); } catch (e) {}
}

/* ===== v473 解析器（真实数据驱动：上一版 77 个站只命中 21 个，其中 5 个标题是脏的）=====
   改三处：
   ① 标签剥离改成「引号安全」—— <a aria-label="查看XX卡"> 这种属性里带 > 的，旧正则会在 > 处切断，
      把 aria-label="查看电信苏酥卡 当正文（实测 vip.777haoka.cn），还会留下 "pan> 竣工即可交付"。
   ② 图片过滤不再整体排除 /static/ 与 /assets/ —— 很多站的商品图就在那里，只排图标特征。
   ③ 标题判定收紧：必须像商品（含 卡/WiFi/宽带/流量包/套餐，且带运营商或数字），
      滤掉「通用收集信息」「中国移动 · 查单」这类噪声。 */
function isBadImg(u) {
  if (!u) return true;
  if (!/^https?:/i.test(u)) return true;
  if (/\.svg(\?|$)/i.test(u)) return true;
  if (/(icon|logo|avatar|qrcode|qr_|sprite|placeholder|blank|loading|tabbar|banner|swiper|advert|arrow|close|share)/i.test(u)) return true;
  if (/(\/static\/|\/assets\/)/i.test(u) && !/(upload|attachment|goods|cover|product|card)/i.test(u)) return true;
  return false;
}
/* v474：建表/改表原本每次请求都跑一遍（十几个 CREATE / ALTER），实测页面里一次 POST 要 4~6 秒，
   按钮转圈半天像卡死。表结构不会变，改成每个 isolate 只跑一次，后续请求直接跳过。 */
let __SCHEMA_OK = false;
async function ensureSchema(env) {
  if (__SCHEMA_OK) return;
  await ensureAdminUsers(env);
  await ensureExternal(env);
  await ensureCollect(env);
  __SCHEMA_OK = true;
}

const BAD_IMG = { test: function (u) { return isBadImg(u); } }; /* 老调用点兼容 */

function absUrl(u, base) {
  u = String(u || '').trim();
  if (!u || /^data:/i.test(u)) return '';
  if (u.indexOf('//') === 0) return 'https:' + u;
  if (/^https?:\/\//i.test(u)) return u;
  try { return new URL(u, base).href; } catch (e) { return ''; }
}
/* 引号安全的标签剥离：属性值里的 > 不会提前截断标签 */
function stripTags(s) {
  return String(s || '').replace(/<[^<>]*(?:(?:"[^"]*"|'[^']*')[^<>]*)*>/g, '\u0001');
}
function decodeEnt(s) {
  return String(s || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(Number(d)); });
}
export function plainText(s) {
  return decodeEnt(String(s || '').replace(/<[^<>]*(?:(?:"[^"]*"|'[^']*')[^<>]*)*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

const NOISE = /(查单|收集信息|订单查询|客服|登录|注册|公告|须知|说明|规则|提示|注意|首页|全部商品|搜索|分享|下载|返回顶部|关于我们|资讯|新闻|攻略|百科|教程)/;
const GOODS_WORD = /(卡|WiFi|WIFI|wifi|宽带|流量包|套餐|随身|物联)/;
const OP_WORD = /(联通|电信|移动|广电|5G|4G|三网|虚拟)/;
function looksLikeGoods(t) {
  if (!t || t.length < 5 || t.length > 90) return false;
  if (!/[\u4e00-\u9fa5]/.test(t)) return false;
  /* v546v（实测 172hk.com.cn / m.wywlhk.cn）：页面里的广告链接、导航碎片被当成商品存进去，
     标题长这样：`172 号卡资讯, rget="_blank" title="飞利猫随身`、`z-link" href="https://`。
     带 HTML 属性、引号、网址的一律不是商品名。 */
  if (/[=<>]/.test(t)) return false;
  if (/(href|target|_blank|src|class|title)\s*=/i.test(t)) return false;
  if (/https?:\/\//i.test(t)) return false;
  if (NOISE.test(t)) return false;
  if (!GOODS_WORD.test(t)) return false;
  return OP_WORD.test(t) || /\d/.test(t);
}

/* 通用解析：围绕「像商品的图」在其上下文里找标题与下单链接。
   不依赖 class 名，所以多套号卡模板共用一套规则。 */
export function parseGoodsList(html, baseUrl) {
  const out = [], seen = {};
  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    const srcRaw = (tag.match(/(?:data-src|data-original|data-lazy-src|data-echo|src)=["']([^"']+)["']/i) || [])[1];
    const src = absUrl(srcRaw, baseUrl);
    if (isBadImg(src)) continue;
    const ctx = html.slice(Math.max(0, m.index - 600), m.index + 1400);
    const parts = stripTags(ctx).split('\u0001').map(plainText).filter(Boolean);
    const title = parts.filter(looksLikeGoods)[0] || '';
    if (!title) continue;
    const hrefs = (ctx.match(/href=["']([^"']+)["']/gi) || [])
      .map(x => absUrl(x.replace(/^href=["']|["']$/gi, ''), baseUrl))
      .filter(h => h && !/\.(css|js|png|jpe?g|webp|gif|svg)(\?|$)/i.test(h));
    /* v546m（实测 55555.wang 只有 2/19 条拿到链接）：很多站的商品卡根本不是 <a href>，
       而是 onclick="openPopup('good?pid=5873')" / location.href='...' 这种 JS 跳转。
       原来只认 href，于是 17 条只剩标题封面、点不进去也补不了详情。
       这里把 onclick 里的跳转地址也捞出来，跟 href 一起参与筛选。 */
    const clickRe = /(?:openPopup|openUrl|openWin|window\.open|location\.assign)\s*\(\s*['"]([^'"]{2,300})['"]|location\.href\s*=\s*['"]([^'"]{2,300})['"]/gi;
    let cm;
    const clickHrefs = [];
    while ((cm = clickRe.exec(ctx))) {
      const cu = absUrl(cm[1] || cm[2], baseUrl);
      if (cu && hrefs.indexOf(cu) < 0) hrefs.push(cu);
      if (cu && clickHrefs.indexOf(cu) < 0) clickHrefs.push(cu);
    }
    /* v546m：分页/筛选链接里也带 goods，会被误认成商品链接（实测 55555.wang 全抓成 ?page=1）。
       这些一律不当商品链接；onclick 里的跳转才是真正的商品页，优先取它。 */
    const isPager = (h) => /[?&](page|p|pageno|pn)=\d/i.test(h) || /[?&](yys|status|value|keyword|kw|q|sort)=/i.test(h);
    const hitGoods = (h) => !isPager(h) && /(pid=|\/order|detail|goods|goodsId=|\/card\/|\/buy)/i.test(h);
    const link = clickHrefs.filter(hitGoods)[0] || hrefs.filter(hitGoods)[0] || '';
    /* 有下单链接的算高置信；没链接但标题同时含「商品词 + 运营商」也留（不少站用 JS 跳转，href 拿不到） */
    if (!link && !(GOODS_WORD.test(title) && OP_WORD.test(title))) continue;
    /* 同站同标题只留一条：同一张商品图常在页面里出现两次（列表 + 推荐位），
       用 link|title 去重挡不住（无链接时 key 相同但 title 相同却各占一条）——实测「联通陕西山暮卡」重复出现。 */
    const key = title.replace(/\s+/g, '');
    if (seen[key]) { if (!seen[key].link && link) seen[key].link = link; continue; }
    /* v587 用户 11-08（第 4 条）：这里原来只产出 link（商品详情页），没有 buy——入库时 g.buy 为空就退回 link，
       于是「下单链接」永远等于「商品页链接」。现在每条商品单独算下单链接：
       从它自己的 pid + 原链接里的 k，按平台规则拼出来（参数全部取自原页面和原链接）。 */
    let _buy = '';
    try {
      /* v597（老板 11-10 第 7 条「平台5的采集链接也是错的」）：
         原来这里把下单链接硬编码成 kk.sviphk.cn 一家，别的图文站（55555.wang 等）直接把
         「商品详情页」当订单页存。现在只要拿到 pid 且有 k/uid，就按通用形状拼：
         {origin}/order/index?uid={k}&pid={pid}；拼不出来才退回 link。 */
      const _u0 = new URL(baseUrl);
      const _pidM0 = (link || '').match(/[?&]pid=(\d+)/i) || (ctx.match(/[?&]pid=(\d+)/i) || []);
      const _pid0 = _pidM0 ? _pidM0[1] : '';
      const _k0 = _u0.searchParams.get('k') || _u0.searchParams.get('uid') || '';
      if (_pid0 && _k0) {
        _buy = _u0.origin + '/order/index?uid=' + encodeURIComponent(_k0) + '&pid=' + encodeURIComponent(_pid0);
      }
    } catch (eBuy) {}
    /* v597（老板 11-10 第 7 条「下架了你还能采集到？现在采集的数据都显示已下架」）：
       原来拿「商品图周边一整块上下文」去测下架词，隔壁商品/筛选栏上有个「已下架」，
       这一条就被标成下架——于是整页商品全变「对方已下架」。
       现在只认「标题里写着已下架/售罄/失效」的，页面其它位置的字不再牵连。 */
    const GONE_RE = /已下架|已售罄|售罄|已抢光|已抢完|暂停销售|已失效|已删除|活动结束|该商品不存在|商品已过期/i;
    const _gone = GONE_RE.test(title) ? 1 : 0;
    const rec = { title: title.slice(0, 90), cover: src, link: link || '', buy: _buy, pid: '', gone: _gone };
    seen[key] = rec;
    out.push(rec);
    if (out.length >= 200) break;
  }
  /* v591（老板 11-09 第 9 条）：图文路径抓不到 / 抓太少时，再补一轮「按商品链接抓」——
     很多发卡站、独立商城的列表卡是纯 `<a>文字</a>`，没有商品图，图文规则一条都命中不了。 */
  if (out.length < 3) {
    try {
      parseGoodsByLinks(html, baseUrl).forEach(function (r) {
        const k2 = String(r.title || '').replace(/\s+/g, '');
        if (!k2) return;
        if (out.some(function (x) { return String(x.title || '').replace(/\s+/g, '') === k2; })) return;
        out.push(r);
      });
    } catch (eL) {}
  }
  return out;
}

/* v591：「按链接抓」——从商品类 <a> 里取标题/封面/链接。
   只认商品形态的地址（product/goods/item/detail/buy/pid=/id=数字），
   并且要求整页至少 3 个，避免把导航、页脚当商品。 */
export function parseGoodsByLinks(html, baseUrl) {
  const out = [], seen = {};
  const A_RE = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,500}?)<\/a>/gi;
  const NAV = /^(首页|全部|更多|上一页|下一页|登录|注册|购物车|我的|订单|搜索|分类|关于|联系我们|帮助|公告|店铺首页|会员|充值|退出|返回|查看全部)$/;
  let m;
  while ((m = A_RE.exec(html))) {
    const href = absUrl(m[1], baseUrl);
    if (!href || !/^https?:/i.test(href)) continue;
    if (!/(\/product|\/products|\/goods|\/item|\/detail|\/buy|\/p\/|\/sku|pid=|goodsId=|[?&]id=\d+)/i.test(href)) continue;
    const inner = m[2];
    const parts = stripTags(inner).split('\u0001').map(plainText).filter(Boolean);
    let title = parts.filter(function (t) { return t.length >= 2 && t.length <= 60 && !NAV.test(t); })[0] || '';
    if (!title) {
      const alt = (inner.match(/alt=["']([^"']{2,60})["']/i) || [])[1] || '';
      title = String(alt).trim();
    }
    if (!title) continue;
    const img = (inner.match(/<img[^>]*(?:data-src|data-original|data-lazy-src|src)=["']([^"']+)["']/i) || [])[1] || '';
    if (seen[href]) continue;
    seen[href] = 1;
    out.push({ title: title.slice(0, 90), cover: absUrl(img, baseUrl), link: href, buy: href, pid: '', gone: 0 });
    if (out.length >= 200) break;
  }
  return out.length >= 3 ? out : [];
}

/* ================= v501 商站接口适配器（老板：「很多平台都采集不到」） =================
   老板给的平台清单里，一大半是同一家的 uni-app 商城：页面只有 1KB 壳，商品全靠浏览器里的 JS 拉，
   服务端解析 HTML 永远是 0 条。这类站其实有公开接口：
     GET {origin}/api/shop/goodsList?promoCode={渠道码}
   返回里 标题(name)/封面(tips)/详情图(details)/描述(des) 全都齐（实测 hk.usim.vip、app.kaziyou.cn、hk5.kyaowang.cn）。
   渠道码 = 分享链接 /s/{code} 的最后一段，或地址里的 promoCode / id 参数。
   接口优先、HTML 其次、同域探测兜底 —— 三条路都不通才报失败，并说清原因。 */
const UA_DEFAULT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

function haokaCodes(u) {
  const out = [];
  const add = function (v) { v = String(v || '').trim(); if (v && out.indexOf(v) < 0) out.push(v); };
  try {
    const o = new URL(u);
    /* v546w（老板：要采的是「我店铺」的商品，不是我店铺以外平台的公共商品）：
       这类商城的专属链接是 hash 路由，店铺标识写在 # 后面——
       例：https://my.86hk.vip/#/pages/micro_store/index?agent_id=791fa38f1ffd60e1
       原来只读 pathname 和 search，hash 里的 mall_id / agent_id 完全读不到，
       于是这类站一律被判成「空壳」。现在先把 hash 里的参数也捞出来。 */
    let hashQ = '';
    if (o.hash && o.hash.indexOf('?') >= 0) hashQ = o.hash.slice(o.hash.indexOf('?') + 1);
    try {
      const hp = new URLSearchParams(hashQ);
      ['mall_id', 'mallId', 'agent_id', 'agentId', 'shop_id', 'shopId', 'promoCode', 'promocode', 'code', 'userCode', 'id']
        .forEach(function (k) { add(hp.get(k)); });
    } catch (eH) {}
    const segs = o.pathname.split('/').filter(Boolean);
    const last = segs[segs.length - 1] || '';
    if (last && !/^(shop|index|h5|web|login|s|r|m|product)$/i.test(last)) add(last);
    /* v591（老板 11-09 第 9 条，多平台实测补齐）：hash 路由里的段也要当渠道码候选——
       实测飞利猫是 #/index/0e99ec3bec8eec3d/1，真正的店铺码是中间那段 16 位十六进制，
       按 pathname 只能拿到 "1"（拿 "1" 去问接口当然要不到东西）。 */
    try {
      const hs = String(o.hash || '').replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
      hs.forEach(function (seg) {
        if (/^[A-Za-z0-9_-]{10,64}$/.test(seg) && !/^\d+$/.test(seg)) add(seg);
      });
    } catch (eHS) {}
    ['promoCode', 'promocode', 'code', 'id', 'agent_id', 'mall_id', 'userCode', 'shop_id'].forEach(function (k) {
      add(o.searchParams.get(k));
    });
  } catch (e) {}
  return out;
}

export async function tryHaokaWeb(mall) {
  const codes = haokaCodes(mall);
  if (!codes.length) return null;
  let origin = '';
  try { origin = new URL(mall).origin; } catch (e) { return null; }
  for (const c of codes) {
    let j;
    try {
      const r = await fetch(origin + '/api/shop/goodsList?promoCode=' + encodeURIComponent(c), {
        headers: { 'User-Agent': UA_DEFAULT, 'Accept': 'application/json' }
      });
      if (!/json/i.test(r.headers.get('content-type') || '')) continue;
      j = await r.json();
    } catch (e) { continue; }
    if (!j || j.code !== 0 || !j.data || !Array.isArray(j.data.list)) continue;
    const items = j.data.list.map(function (g) {
      const id = g.id;
      /* v597（老板 11-10 第 7 条）：老板给了标准形态 —— https://sznxwl.com/shop#/pages/goods/index?promoCode=fK9OCsg6&goodsId=2189
         原来拼的是 {origin}/#/pages/goods/index?id={id}&promoCode={code}：少了 /shop 挂载路径、参数名是 id 不是 goodsId、顺序也反了，
         点进去是空页 —— 这就是「采集链接不是我想要的」的根因。 */
      const buy = origin + '/shop#/pages/goods/index?promoCode=' + encodeURIComponent(c) + '&goodsId=' + encodeURIComponent(id);
      const imgs = (Array.isArray(g.details) ? g.details : []).filter(Boolean).slice(0, 20);
      /* v512：能拿到的都拿——月租/优惠价/通用流量/定向流量/通话/结算方式/归属/标签，
         上架时填不进去的字段放进「更多信息」，老板要看的时候不用再跑回对方平台 */
      const tags = (Array.isArray(g.tagsSelect) ? g.tagsSelect : []).map(function (t) { return String(t && t.label || ''); }).filter(Boolean).slice(0, 8);
      const ex = {
        月租: g.monthFee || '', 优惠价：g.favourMonthFee || '', 通用流量：g.commonFlow || '',
        定向流量: g.fixedFlow || '', 通话：g.callDuration || '', 归属：g.numberRegionName || g.provinceCode || '',
        结算方式: g.settleMode === 2 ? '秒返' : (g.settleMode === 1 ? '月返' : ''), 标签: tags
      };
      const exTxt = Object.keys(ex).map(function (k) {
        const v = ex[k];
        return (Array.isArray(v) ? v.join('、') : v) ? k + '：' + (Array.isArray(v) ? v.join('、') : v) : '';
      }).filter(Boolean).join('；');
      return {
        title: String(g.name || '').slice(0, 90),
        cover: String(g.tips || imgs[0] || ''),
        desc: String(g.des || '').slice(0, 300) || exTxt.slice(0, 300),
        detail: imgs,
        link: buy,
        buy: buy,
        extra: exTxt.slice(0, 600)
      };
    }).filter(function (x) { return x.title && x.title.length >= 3; });
    if (items.length) return { items: items, code: c, origin: origin };
  }
  return null;
}

/* v511：抓取策略修正——v510 的「失败就再等 18 秒重试」直接把整次请求拖过函数时限，
   结果三个站从「超时」变成「HTTP 0」（连状态都没拿到）。现在改成：
   ① 只有「服务器明确回了 4xx/5xx」才换桌面 UA 再试一次（这种重试几十毫秒就回来）
   ② 超时/网络异常一律不重试（重试只会更慢）
   ③ 两次的等待都压在 12 秒以内，整次采集不会超过函数时限 */
export async function fetchPage(url, timeoutMs, opt) {
  opt = opt || {};
  const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
  const UA_DESK = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
  const base = Math.min(timeoutMs || 12000, 12000);

  async function once(ua, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, ms);
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Upgrade-Insecure-Requests': '1'
        },
        redirect: 'follow'
      });
      const buf = await r.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(buf.slice(0, 600000));
      return { ok: r.ok, status: r.status, text: text, aborted: false };
    } catch (e) {
      return { ok: false, status: 0, text: '', aborted: true };
    } finally { clearTimeout(timer); }
  }

  const first = await once(UA_MOBILE, base);
  if (first.ok || first.aborted || opt.retry === false) return first;
  /* 只有对方明确给了状态码才换桌面头重试（多半是被 UA/头掐掉，换头就过） */
  const second = await once(UA_DESK, 8000);
  return second.ok ? second : (second.status ? second : first);
}

/* 从商品详情页抓长图（详情） */
export function parseDetail(html, baseUrl) {
  const imgs = [];
  const re = /<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const s = absUrl((m[0].match(/(?:data-src|data-original|data-lazy-src|data-echo|src)=["']([^"']+)["']/i) || [])[1], baseUrl);
    if (isBadImg(s)) continue;
    if (imgs.indexOf(s) >= 0) continue;
    imgs.push(s);
    if (imgs.length >= 24) break;
  }
  return imgs;
}
