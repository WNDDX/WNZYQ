/**
 * POST /api/vitals —— 真实访客性能数据（RUM，公开接口）
 *
 * 为什么需要它：
 *   到现在为止所有性能结论都是「我这台机器上的」：FCP 272ms 很好听，
 *   但真实访客是 3G 手机还是光纤、有没有低端安卓，一条数据都没有。
 *   行业里公认的分界线就在这里——实验室数据只能证明"不慢"，只有现场数据（p75）能证明"用户不觉得慢"。
 *
 * 收什么（只收这七个数，别的全丢）：
 *   lcp 最大内容绘制 / cls 布局偏移 / inp 交互延迟 / fcp 首次绘制 / ttfb 首字节
 *   vw 视口宽（用来区分手机和桌面）/ conn 网络类型
 *
 * 五条铁律（与 /api/error 同款，别改成"通用遥测接口"）：
 *   ① 字段白名单 + 数值范围校验：超出物理可能的值直接丢（LCP 负值、CLS 999 这种）
 *   ② 单 IP 每分钟最多 30 条（正常访客一页一条，30 条足够；超了说明在刷）
 *   ③ 所有字符串截断（path 200）
 *   ④ 失败一律返回 200 —— 前端是 sendBeacon，返 500 只会让它重试
 *   ⑤ 不存明文 IP，只存哈希前 16 位（够判"同一台设备"，又不留 PII）
 *
 * 保留：90 天（在 admin 查询里顺手清理，不额外开定时任务）。
 */
import { json, readJSON } from '../_utils.js';

const RATE_PER_MIN = 30;
const MAX_LCP = 120000, MAX_CLS = 10, MAX_INP = 120000, MAX_TTFB = 120000, MAX_FCP = 120000;

function cut(s, n) { return String(s == null ? '' : s).slice(0, n); }
/* 数值校验：非数字/负数/超出物理上限 → 0（0 表示"没测到"，统计时会被排除） */
function num(v, max) {
  const n = Number(v);
  if (!isFinite(n) || n < 0 || n > max) return 0;
  return Math.round(n * 1000) / 1000;
}

function hashIp(ip) {
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  const s = String(ip || 'unknown');
  for (let i = 0; i < s.length; i++) {
    h1 = ((h1 ^ s.charCodeAt(i)) * 0x01000193) >>> 0;
    h2 = ((h2 + s.charCodeAt(i) * 31) ^ (h1 >>> 7)) >>> 0;
  }
  return (h1.toString(16) + h2.toString(16)).slice(0, 16);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const body = await readJSON(request);

    const lcp = num(body.lcp, MAX_LCP);
    const cls = num(body.cls, MAX_CLS);
    const inp = num(body.inp, MAX_INP);
    const fcp = num(body.fcp, MAX_FCP);
    const ttfb = num(body.ttfb, MAX_TTFB);
    /* 一个都没测到就别入库了（有些浏览器禁了 PerformanceObserver） */
    if (!lcp && !cls && !inp && !fcp && !ttfb) return json({ ok: true, skipped: 'empty' });

    const path = cut(body.path, 200) || '/';
    const vw = Math.min(4000, Math.max(0, parseInt(body.vw, 10) || 0));
    const conn = cut(body.conn, 20);
    const iph = hashIp(request.headers.get('CF-Connecting-IP') || 'unknown');

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS web_vitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      path TEXT NOT NULL DEFAULT '',
      lcp REAL NOT NULL DEFAULT 0,
      cls REAL NOT NULL DEFAULT 0,
      inp REAL NOT NULL DEFAULT 0,
      fcp REAL NOT NULL DEFAULT 0,
      ttfb REAL NOT NULL DEFAULT 0,
      vw INTEGER NOT NULL DEFAULT 0,
      conn TEXT NOT NULL DEFAULT '',
      ip_hash TEXT NOT NULL DEFAULT ''
    )`).run();
    try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_vitals_at ON web_vitals(created_at)").run(); } catch (e) {}

    /* 限流：单 IP 每分钟最多 30 条 */
    try {
      const recent = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM web_vitals WHERE ip_hash = ? AND created_at >= datetime('now','-1 minute')"
      ).bind(iph).first();
      if (recent && Number(recent.n) >= RATE_PER_MIN) return json({ ok: true, skipped: 'rate' });
    } catch (e) {}

    await env.DB.prepare(
      'INSERT INTO web_vitals (path, lcp, cls, inp, fcp, ttfb, vw, conn, ip_hash) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(path, lcp, cls, inp, fcp, ttfb, vw, conn, iph).run();

    return json({ ok: true });
  } catch (e) {
    return json({ ok: true, skipped: 'err' });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
