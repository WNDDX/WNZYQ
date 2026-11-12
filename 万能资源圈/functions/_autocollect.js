/**
 * v534 顺带自动采集（老板 r14：定时不要配任何东西，要像系统自带的"清数据"那样自己跑）
 *
 * 做法与 track.js 里那套 60 天清理完全一致——不配环境变量、不配外部定时器、不依赖 GitHub Actions：
 *   · 每次有人访问（前台埋点 / 后台打开），先看一眼 settings 里的当天状态；
 *   · 当天还没采过，就把活交给 context.waitUntil() 在后台跑，页面照常返回，不卡人；
 *   · 一次只跑 15 秒，没采完的记下进度（auto_collect_state.idx），下一次访问接着采剩下的；
 *   · 全部采完写 done=true，当天之后再访问只多一条 SELECT，等于零成本。
 *
 * 复用：抓取/解析全部 import 自 admin/external.js（tryHaokaWeb / parseGoodsList / fetchPage），
 *       与手动采集是同一套实现，不复制解析逻辑，避免两套漂移（v496 教训）。
 */
import { ensureCollect, tryHaokaWeb, parseGoodsList, fetchPage } from './api/admin/external.js';

const CAP = 120;              /* 单平台单次最多入库条数 */
const BUDGET_MS = 15000;      /* 单次后台任务的时间预算（留余量给 CF 的 30 秒限） */
const LOCK_MS = 120000;       /* 正在跑的锁：2 分钟内不再起第二个 */
const STATE_KEY = 'auto_collect_state';
const LOCK_KEY = 'auto_collect_lock';
const LAST_KEY = 'auto_collect_last';
const FALLBACK_TITLE = '未命名资源';

/* 北京时间「今天」，与 stats.js / track.js 完全一致的固定 +8 写法 */
export function bjToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

async function readSetting(env, key) {
  try {
    const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
    return r && r.value != null ? String(r.value) : '';
  } catch (e) { return ''; }
}

async function writeSetting(env, key, value) {
  try {
    await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
      .bind(key, value, value).run();
  } catch (e) {}
}

export async function readState(env) {
  const raw = await readSetting(env, STATE_KEY);
  if (raw) {
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') {
        return { day: String(o.day || ''), idx: Number(o.idx) || 0, total: Number(o.total) || 0, done: !!o.done };
      }
    } catch (e) {}
  }
  return { day: '', idx: 0, total: 0, done: false };
}

async function lockFresh(env) {
  const raw = await readSetting(env, LOCK_KEY);
  if (!raw) return false;
  const t = Date.parse(String(raw).replace(' ', 'T') + 'Z');
  return isFinite(t) && (Date.now() - t) < LOCK_MS;
}

/* 采一个平台：接口优先 → 页面解析 → 入库（按标题去重）。与 cron/collect.js 原来那段一字不差 */
export async function collectOne(env, p) {
  const mall = String(p.mall_url || '').trim();
  if (!mall) return { id: p.id, name: p.name, ok: false, msg: '没填商城地址' };

  let list = [];
  let via = 'api';
  try {
    const apiHit = await tryHaokaWeb(mall);
    if (apiHit && apiHit.items && apiHit.items.length) list = apiHit.items;
  } catch (e) {}
  if (!list.length) {
    via = 'html';
    try {
      const pg = await fetchPage(mall, 12000, { retry: false });
      if (pg && pg.ok) list = parseGoodsList(pg.text, mall);
    } catch (e) {}
  }
  if (!list.length) {
    try { await env.DB.prepare("UPDATE external_platforms SET last_auto_at = datetime('now') WHERE id=?").bind(p.id).run(); } catch (e) {}
    return { id: p.id, name: p.name, ok: false, msg: '这次没抓到资源（对方改版或被拦）', found: 0 };
  }

  let added = 0, dup = 0;
  const capped = list.slice(0, CAP);
  for (const g of capped) {
    const title = String(g.title || '').trim().slice(0, 90) || FALLBACK_TITLE;
    let hit = null;
    try {
      hit = await env.DB.prepare('SELECT id FROM external_goods WHERE platform_id=? AND title=?').bind(p.id, title).first();
    } catch (e) {}
    if (hit) { dup++; continue; }
    const dHtml = (Array.isArray(g.detail) && g.detail.length)
      ? g.detail.map(function (u) { return '<p><img src="' + u + '"></p>'; }).join('')
      : '';
    try {
      await env.DB.prepare('INSERT INTO external_goods (platform_id, platform, src_url, title, cover, descr, buy_url, detail_html, detail_media, extra, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .bind(p.id, p.name, g.link || '', title, g.cover || '', g.desc || '', g.buy || g.link || '',
          dHtml, JSON.stringify(g.detail || []), g.extra || '', 'auto').run();
      added++;
    } catch (e) { /* 单条失败不拖垮整批 */ }
  }

  try { await env.DB.prepare("UPDATE external_platforms SET last_auto_at = datetime('now') WHERE id=?").bind(p.id).run(); } catch (e) {}
  return { id: p.id, name: p.name, ok: true, found: list.length, added, dup, via };
}

export async function listAutoPlatforms(env) {
  try {
    const r = await env.DB.prepare("SELECT id, name, mall_url FROM external_platforms WHERE COALESCE(mall_url,'')<>'' OR auto_collect=1 ORDER BY sort ASC, id ASC").all(); /* v537（老板）：录进去的平台每天全采，不再依赖每个平台的开关 */
    return (r && r.results) || [];
  } catch (e) { return []; }
}

/**
 * 真正干活：从 idx 开始采，最多跑 budget 毫秒，进度写回 state。
 * 返回 { day, done, idx, total, added, detail }
 */
export async function runAutoCollect(env, opt) {
  opt = opt || {};
  const budget = Number(opt.budget) > 0 ? Number(opt.budget) : BUDGET_MS;
  const day = bjToday();
  const prev = await readState(env);
  const startIdx = (prev.day === day) ? Math.max(0, Math.min(prev.idx || 0, 1e9)) : 0;

  await ensureCollect(env);
  const rows = await listAutoPlatforms(env);

  if (!rows.length) {
    await writeSetting(env, STATE_KEY, JSON.stringify({ day: day, idx: 0, total: 0, done: true }));
    return { day: day, done: true, idx: 0, total: 0, added: 0, detail: [] };
  }

  const from = Math.min(startIdx, rows.length);
  const t0 = Date.now();
  const detail = [];
  let i = from;
  while (i < rows.length) {
    /* 至少采一个，之后按预算收手，剩下的下次访问接着来 */
    if (i > from && Date.now() - t0 > budget) break;
    try { detail.push(await collectOne(env, rows[i])); }
    catch (e) { detail.push({ id: rows[i].id, name: rows[i].name, ok: false, msg: '采集出错：' + ((e && e.message) || '') }); }
    i++;
  }

  const added = detail.reduce(function (a, x) { return a + (x.added || 0); }, 0);
  const done = i >= rows.length;
  await writeSetting(env, STATE_KEY, JSON.stringify({ day: day, idx: i, total: rows.length, done: done }));

  /* 上次结果摘要（界面用）：只留必要字段，别把 detail 全塞进去 */
  try {
    const fails = detail.filter(function (x) { return !x.ok; }).map(function (x) { return String(x.name || '').slice(0, 20); });
    await writeSetting(env, LAST_KEY, JSON.stringify({
      at: new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '),
      platforms: detail.length, added: added, fails: fails.slice(0, 8)
    }));
  } catch (e) {}

  return { day: day, done: done, idx: i, total: rows.length, added: added, detail: detail };
}

/**
 * 便宜的门卫：给任何一次访问顺手挂上（前台埋点 / 后台打开都调）。
 * opt.force = true 时忽略"今天已完成"，立刻从头再采一遍（后台手动按钮用）。
 * 返回 { started, day, done, idx, total, added, detail } —— 用 waitUntil 时 started=true 但结果稍后才落库。
 */
export async function maybeAutoCollect(context, opt) {
  opt = opt || {};
  const env = context && context.env;
  const out = { started: false, day: bjToday(), done: false, idx: 0, total: 0, added: 0 };
  if (!env || !env.DB) return out;

  const day = out.day;
  const st = opt.force ? { day: '', idx: 0, total: 0, done: false } : await readState(env);

  /* 最常见路径：今天已经全采完 → 只多这一条 SELECT 就返回 */
  if (st.day === day && st.done) { out.done = true; out.idx = st.idx; out.total = st.total; return out; }

  if (!opt.force && await lockFresh(env)) { out.idx = st.idx; out.total = st.total; return out; }

  await writeSetting(env, LOCK_KEY, new Date().toISOString().slice(0, 19).replace('T', ' '));

  const job = async function () {
    try {
      const r = await runAutoCollect(env, { budget: opt.budget });
      out.done = r.done; out.idx = r.idx; out.total = r.total; out.added = r.added;
    } catch (e) {
      console.error('自动采集失败（不影响访问):', e && e.message);
    } finally {
      try { await writeSetting(env, LOCK_KEY, '1970-01-01 00:00:00'); } catch (e) {}
    }
  };

  /* 手动触发的调用方要结果 → 直接等；普通的顺手挂载 → 交给 waitUntil，页面不排队 */
  if (opt.wait) { await job(); out.started = true; return out; }
  if (context.waitUntil) { context.waitUntil(job()); out.started = true; return out; }
  await job(); out.started = true;
  return out;
}

/* 界面用：今天采没采、上次结果（给设置页「自动采集」弹窗读） */
export async function autoCollectStatus(env) {
  const day = bjToday();
  let st = { day: '', idx: 0, total: 0, done: false };
  try { st = await readState(env); } catch (e) {}
  let last = null;
  try {
    const raw = await readSetting(env, LAST_KEY);
    if (raw) last = JSON.parse(raw);
  } catch (e) {}
  let platforms = 0, autoOn = 0, lastAuto = '';
  try {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN auto_collect=1 THEN 1 ELSE 0 END) AS a, MAX(last_auto_at) AS t FROM external_platforms").first();
    if (r) { platforms = Number(r.n) || 0; autoOn = Number(r.a) || 0; lastAuto = String(r.t || ''); }
  } catch (e) {}
  return {
    day: day,
    todayDone: !!(st.day === day && st.done),
    progress: st.day === day ? { idx: st.idx, total: st.total } : { idx: 0, total: 0 },
    lastAutoAt: lastAuto,
    last: last,
    platforms: platforms,
    autoOn: autoOn
  };
}
