/**
 * v530 定时采集（老板：每个平台可设「每天 0 点自动采一次」）
 *
 * 调用：GET /api/cron/collect?key=<CRON_KEY>        （或 header x-cron-key）
 *       GET /api/cron/collect?key=...&force=1        强制再跑一次（调试用）
 *
 * 为什么需要外部定时器：Cloudflare Pages Functions 只在「有请求」时运行，
 * 不支持 Workers 那种 cron trigger。所以真正的「0 点」由外部定时器触发（GitHub Actions 或任意 cron 服务），
 * 这个端点只负责「收到调用就把所有开了自动采集的平台采一遍」。
 *
 * 幂等：settings.cron_last_day 记北京时间日期，同一天重复调用直接跳过（除非 force=1）。
 * 复用：采集能力全部 import 自 admin/external.js（tryHaokaWeb / parseGoodsList / fetchPage），
 *       不复制解析逻辑，避免两套实现漂移。
 */
import { json, ensureAdminUsers } from '../../_utils.js';
import { ensureCollect, tryHaokaWeb, parseGoodsList, fetchPage } from '../admin/external.js';

const CAP = 120;                       /* 单平台单次最多入库条数 */
const UA_FALLBACK_TITLE = '未命名资源';

/* 北京时间「今天」 */
function bjToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/* 采一个平台：接口优先 → 页面解析 → 入库（按标题去重） */
async function collectOne(env, p) {
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
    await env.DB.prepare("UPDATE external_platforms SET last_auto_at = datetime('now') WHERE id=?").bind(p.id).run();
    return { id: p.id, name: p.name, ok: false, msg: '这次没抓到资源（对方改版或被拦）', found: 0 };
  }

  let added = 0, dup = 0;
  const capped = list.slice(0, CAP);
  for (const g of capped) {
    const title = String(g.title || '').trim().slice(0, 90) || UA_FALLBACK_TITLE;
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
          dHtml, JSON.stringify(g.detail || []), g.extra || '', 'cron').run();
      added++;
    } catch (e) { /* 单条失败不拖垮整批 */ }
  }

  await env.DB.prepare("UPDATE external_platforms SET last_auto_at = datetime('now') WHERE id=?").bind(p.id).run();
  return { id: p.id, name: p.name, ok: true, found: list.length, added, dup, via };
}

async function handle(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  const expect = String(env.CRON_KEY || '');
  if (!expect) {
    return json({ ok: false, msg: '还没配置 CRON_KEY：请到 Cloudflare Pages 的环境变量里加一个 CRON_KEY，再用同样的值配到定时器里' }, 503);
  }
  const key = url.searchParams.get('key') || request.headers.get('x-cron-key') || '';
  if (key !== expect) return json({ ok: false, msg: '密钥不对' }, 403);

  await ensureAdminUsers(env);
  await ensureCollect(env);

  const force = url.searchParams.get('force') === '1';
  const day = bjToday();
  try {
    const last = await env.DB.prepare("SELECT value FROM settings WHERE key='cron_last_day'").first();
    if (!force && last && String(last.value) === day) {
      return json({ ok: true, skipped: true, day, msg: '今天已经自动采过了' });
    }
  } catch (e) {}

  let plats = { results: [] };
  try {
    plats = await env.DB.prepare('SELECT id, name, mall_url FROM external_platforms WHERE auto_collect=1 ORDER BY sort ASC, id ASC').all();
  } catch (e) { /* 老库还没有 auto_collect 列 */ }

  const rows = (plats && plats.results) || [];
  if (!rows.length) {
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('cron_last_day', ?) ON CONFLICT(key) DO UPDATE SET value=?").bind(day, day).run().catch(function () {});
    return json({ ok: true, day, platforms: 0, msg: '没有开启自动采集的平台' });
  }

  const out = [];
  for (const p of rows) {
    try { out.push(await collectOne(env, p)); }
    catch (e) { out.push({ id: p.id, name: p.name, ok: false, msg: '采集出错：' + (e && e.message || '') }); }
  }

  const added = out.reduce(function (a, x) { return a + (x.added || 0); }, 0);
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('cron_last_day', ?) ON CONFLICT(key) DO UPDATE SET value=?").bind(day, day).run().catch(function () {});

  return json({ ok: true, day, platforms: out.length, added, detail: out });
}

export async function onRequestGet(context) { return handle(context); }
export async function onRequestPost(context) { return handle(context); }
