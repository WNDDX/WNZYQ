/**
 * GET /api/admin/vitals?days=7 —— 真实访客性能（p75）
 *
 * 为什么用 p75 而不是平均值：
 *   平均值会被"网速快的那批人"拉低，看不出真实体感。Google 的 Core Web Vitals 一律用 p75：
 *   意思是「75% 的访客体验比这个数更好」。它描述的是"大多数人"，不是"平均人"。
 *
 * 判定线（Google 现行口径）：
 *   LCP ≤2500 好 / ≤4000 待改进 / >4000 差
 *   CLS ≤0.1  好 / ≤0.25 待改进 / >0.25 差
 *   INP ≤200  好 / ≤500  待改进 / >500  差
 *
 * 权限：sensitive.super（和前端报错同级——这是运维数据）
 * 保留：90 天，读取时顺手清理一次（节流到每天一次）
 */
import { json, requirePerm } from '../../_utils.js';

const KEEP_DAYS = 90;
const MAX_ROWS = 5000; /* 样本上限：几百条就足够看 p75，取太多没意义还费 CPU */

function p75(arr) {
  const a = arr.filter(x => x != null && x > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  return a[Math.min(a.length - 1, Math.floor(a.length * 0.75))];
}
const r1 = v => (v == null ? null : Math.round(v * 100) / 100);

function grade(metric, v) {
  if (v == null) return '';
  if (metric === 'lcp') return v <= 2500 ? 'good' : v <= 4000 ? 'mid' : 'bad';
  if (metric === 'cls') return v <= 0.1 ? 'good' : v <= 0.25 ? 'mid' : 'bad';
  if (metric === 'inp') return v <= 200 ? 'good' : v <= 500 ? 'mid' : 'bad';
  if (metric === 'ttfb') return v <= 800 ? 'good' : v <= 1800 ? 'mid' : 'bad';
  return '';
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requirePerm(env, request, 'sensitive.super');
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const days = [1, 7, 30].indexOf(parseInt(url.searchParams.get('days') || '7', 10)) >= 0
    ? parseInt(url.searchParams.get('days') || '7', 10) : 7;

  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS web_vitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      path TEXT NOT NULL DEFAULT '',
      lcp REAL NOT NULL DEFAULT 0, cls REAL NOT NULL DEFAULT 0, inp REAL NOT NULL DEFAULT 0,
      fcp REAL NOT NULL DEFAULT 0, ttfb REAL NOT NULL DEFAULT 0,
      vw INTEGER NOT NULL DEFAULT 0, conn TEXT NOT NULL DEFAULT '', ip_hash TEXT NOT NULL DEFAULT ''
    )`).run();
  } catch (e) {}

  /* 顺手清理超期数据（每天一次） */
  try {
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    const last = await env.DB.prepare("SELECT value FROM settings WHERE key = 'vitals_cleanup'").first();
    if (!last || last.value !== today) {
      await env.DB.prepare("DELETE FROM web_vitals WHERE created_at < datetime('now','-" + KEEP_DAYS + " day')").run();
      await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('vitals_cleanup', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(today).run();
    }
  } catch (e) {}

  const RANGE = days === 1
    ? "created_at >= datetime('now', '+8 hours', 'start of day', '-8 hours')"
    : "created_at >= datetime('now', '-" + days + " day')";

  try {
    const rows = await env.DB.prepare(
      'SELECT path, lcp, cls, inp, fcp, ttfb, vw FROM web_vitals WHERE ' + RANGE + ' ORDER BY id DESC LIMIT ' + MAX_ROWS
    ).all();

    const list = (rows && rows.results) || [];
    const total = list.length;

    const overall = {
      lcp: r1(p75(list.map(x => x.lcp))),
      cls: r1(p75(list.map(x => x.cls))),
      inp: r1(p75(list.map(x => x.inp))),
      fcp: r1(p75(list.map(x => x.fcp))),
      ttfb: r1(p75(list.map(x => x.ttfb)))
    };

    /* 达标率：有多少比例的样本落在「好」里 —— 比单个 p75 更能说明整体 */
    const goodRate = (metric, thres) => {
      const vals = list.map(x => x[metric]).filter(v => v > 0);
      if (!vals.length) return null;
      const ok = vals.filter(v => v <= thres).length;
      return Math.round((ok / vals.length) * 100);
    };

    /* 按页面分组：哪个页面最慢，一眼看出来 */
    const byPath = {};
    list.forEach(x => {
      const k = x.path || '/';
      (byPath[k] = byPath[k] || []).push(x);
    });
    const pages = Object.keys(byPath).map(k => {
      const arr = byPath[k];
      return {
        path: k,
        n: arr.length,
        lcp: r1(p75(arr.map(x => x.lcp))),
        cls: r1(p75(arr.map(x => x.cls))),
        inp: r1(p75(arr.map(x => x.inp))),
        ttfb: r1(p75(arr.map(x => x.ttfb))),
        mobile: Math.round((arr.filter(x => x.vw > 0 && x.vw < 768).length / arr.length) * 100)
      };
    }).sort((a, b) => b.n - a.n);

    /* 手机 vs 桌面：这两个群体的差距，往往比"优化前后"的差距还大 */
    const mob = list.filter(x => x.vw > 0 && x.vw < 768);
    const desk = list.filter(x => x.vw >= 768);
    const split = {
      mobile: { n: mob.length, lcp: r1(p75(mob.map(x => x.lcp))), cls: r1(p75(mob.map(x => x.cls))), inp: r1(p75(mob.map(x => x.inp))) },
      desktop: { n: desk.length, lcp: r1(p75(desk.map(x => x.lcp))), cls: r1(p75(desk.map(x => x.cls))), inp: r1(p75(desk.map(x => x.inp))) }
    };

    return json({
      ok: true, days, total,
      overall,
      grade: {
        lcp: grade('lcp', overall.lcp), cls: grade('cls', overall.cls),
        inp: grade('inp', overall.inp), ttfb: grade('ttfb', overall.ttfb)
      },
      good: {
        lcp: goodRate('lcp', 2500), cls: goodRate('cls', 0.1), inp: goodRate('inp', 200), ttfb: goodRate('ttfb', 800)
      },
      split,
      pages: pages.slice(0, 10)
    });
  } catch (e) {
    return json({ ok: true, total: 0, overall: {}, pages: [], msg: '读取失败' });
  }
}
