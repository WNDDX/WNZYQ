/**
 * POST /api/error —— 前端报错上报（公开接口，访客页面出错时自动发）
 *
 * 为什么需要它：v570 建的门禁只在「我自己跑测试时」能抓 console 报错。
 * 真实访客用的是什么浏览器、点了什么、报了什么错，我这边一片空白——
 * 等老板来说"某个页面打不开"才知道，太晚。这个接口把线上错误收进库，后台可查。
 *
 * 设计取舍（都是有意的，别改成"通用日志接口"）：
 * ① 只收 4 类：js / promise / resource / custom。别的类型一律丢弃，防止被当垃圾桶。
 * ② 同一 msga+页面，30 分钟内合并计数（cnt+1），不无限膨胀——一个坏循环能刷出十万条。
 * ③ 单 IP 每分钟最多收 8 条新记录，超了直接 200 丢弃（不报错，前端是"发了不管"）。
 * ④ 长度全部截断：msg 300 / stack 2000 / page 300。防止有人拿它塞大文件。
 * ⑤ 不存完整 UA，只存前 200 字；不存明文 IP，存哈希前 16 位（够定位"同一台设备"，又不留 PII）。
 * ⑥ 失败一律返回 ok:true —— 前端是 sendBeacon，返回 500 只会让浏览器重试。
 */
import { json, readJSON } from '../_utils.js';

const KINDS = ['js', 'promise', 'resource', 'custom'];
const DEDUP_MIN = 30;      // 同一条错误 30 分钟内合并
const RATE_PER_MIN = 8;    // 单 IP 每分钟最多新增

function cut(s, n) { return String(s == null ? '' : s).slice(0, n); }

/* 轻量哈希：够做「同一台设备」的归类，不做安全用途 */
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
    const kind = KINDS.indexOf(body.kind) !== -1 ? body.kind : 'js';
    const msg = cut(body.msg, 300).trim();
    if (!msg) return json({ ok: true, skipped: 'empty' });

    const page = cut(body.page, 300);
    const stack = cut(body.stack, 2000);
    const ua = cut(request.headers.get('User-Agent'), 200);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const iph = hashIp(ip);

    /* 建表（幂等）：全新库第一次收到错误时自己建，不依赖 install */
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS client_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_at TEXT NOT NULL DEFAULT (datetime('now')),
      kind TEXT NOT NULL DEFAULT 'js',
      msg TEXT NOT NULL,
      stack TEXT NOT NULL DEFAULT '',
      page TEXT NOT NULL DEFAULT '',
      ua TEXT NOT NULL DEFAULT '',
      ip_hash TEXT NOT NULL DEFAULT '',
      cnt INTEGER NOT NULL DEFAULT 1
    )`).run();
    try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_client_errors_last ON client_errors(last_at)").run(); } catch (e) {}

    /* 限流：单 IP 每分钟最多新增 8 条（合并计数不算新增，不受限） */
    try {
      const recent = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM client_errors WHERE ip_hash = ? AND created_at >= datetime('now','-1 minute')"
      ).bind(iph).first();
      if (recent && Number(recent.n) >= RATE_PER_MIN) return json({ ok: true, skipped: 'rate' });
    } catch (e) {}

    /* 合并：同 IP + 同 kind + 同 msg + 同 page，30 分钟内只留一行、cnt+1 */
    try {
      const dup = await env.DB.prepare(
        "SELECT id, cnt FROM client_errors WHERE ip_hash = ? AND kind = ? AND msg = ? AND page = ? AND last_at >= datetime('now','-" + DEDUP_MIN + " minutes') ORDER BY id DESC LIMIT 1"
      ).bind(iph, kind, msg, page).first();
      if (dup) {
        await env.DB.prepare("UPDATE client_errors SET cnt = cnt + 1, last_at = datetime('now') WHERE id = ?").bind(dup.id).run();
        return json({ ok: true, merged: true });
      }
    } catch (e) {}

    await env.DB.prepare(
      'INSERT INTO client_errors (kind, msg, stack, page, ua, ip_hash) VALUES (?,?,?,?,?,?)'
    ).bind(kind, msg, stack, page, ua, iph).run();

    return json({ ok: true });
  } catch (e) {
    /* 上报失败绝不影响访客页面 */
    return json({ ok: true, skipped: 'err' });
  }
}

/* 浏览器预检（sendBeacon 用 POST + text/plain，一般不会触发，但兜一层） */
export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
