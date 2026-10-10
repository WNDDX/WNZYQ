/**
 * POST /api/admin/global-cleanup —— 全局孤儿清理（v354，用户拍板：全系统一切没用上的上传文件都自动清）
 * 规则：列出存储仓全部文件 → 核对是否仍被任何内容引用（资源/类型/设置，公告也存在设置里）→ 没人用的删除。
 * 保护：①上传台账——24 小时内的新文件可能是编辑中途的，不删；台账之前的历史遗留（如拖拽 bug 期的黑户）直接删。
 * 节流：30 分钟内重复调用直接跳过（settings 表记时间戳）。
 */
import { json, requireAuth, buildContentText } from '../../_utils.js';

const GRACE_HOURS = 24;

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const bucket = env.IMAGE_BUCKET;
  if (!bucket) return json({ ok: false, msg: '存储未绑定（IMAGE_BUCKET）' }, 400);

  /* 节流：30 分钟内扫过就跳过 */
  try {
    const last = await env.DB.prepare("SELECT value FROM settings WHERE key = 'last_global_sweep'").first();
    if (last && last.value) {
      const ageMin = (Date.now() - Date.parse(String(last.value).replace(' ', 'T') + 'Z')) / 60000;
      if (isFinite(ageMin) && ageMin < 30) return json({ ok: true, skipped: true });
    }
  } catch (e) {}
  try {
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('last_global_sweep', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = datetime('now')").run();
  } catch (e) {}

  /* 列出存储仓文件（KV / R2 两种存储都兼容） */
  const isKV = typeof bucket.getWithMetadata === 'function';
  const RE = /^(?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}(?:_t)?\.[a-zA-Z0-9]+$/;
  const keys = [];
  try {
    if (isKV) {
      let cur;
      for (let page = 0; page < 5; page++) {
        const r = await bucket.list({ cursor: cur, limit: 500 });
        for (const k of (r.keys || [])) keys.push(k.name);
        if (r.list_complete || !r.cursor) break;
        cur = r.cursor;
      }
    } else {
      let cur;
      for (let page = 0; page < 5; page++) {
        const r = await bucket.list({ cursor: cur, limit: 500 });
        for (const o of (r.objects || [])) keys.push(o.key);
        if (!r.truncated || !r.cursor) break;
        cur = r.cursor;
      }
    }
  } catch (e) { return json({ ok: false, msg: '列出存储失败' }, 500); }

  const cand = keys.filter(function (k) { return RE.test(k); });
  if (!cand.length) return json({ ok: true, scanned: 0, deleted: 0 });

  /* 台账（24 小时保护期） */
  const ledger = {};
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS uploads (key TEXT PRIMARY KEY, created_at TEXT NOT NULL)').run();
    for (let i = 0; i < cand.length; i += 80) {
      const batch = cand.slice(i, i + 80);
      const ph = batch.map(function () { return '?'; }).join(',');
      const { results } = await env.DB.prepare('SELECT key, created_at FROM uploads WHERE key IN (' + ph + ')').bind(...batch).all();
      for (const r of (results || [])) ledger[r.key] = r.created_at;
    }
  } catch (e) {}

  /* 引用核对：一次拉全库内容 */
  const text = await buildContentText(env);
  if (text === null) return json({ ok: false, msg: '引用核对失败，本次不动任何文件' }, 500);

  const toDelete = [];
  for (const key of cand) {
    if (text.indexOf(key) !== -1) continue; /* 仍被引用，坚决不删 */
    const created = ledger[key];
    if (created) {
      const ageH = (Date.now() - Date.parse(String(created).replace(' ', 'T') + 'Z')) / 3600000;
      if (isFinite(ageH) && ageH < GRACE_HOURS) continue; /* 新上传，可能正在编辑中 */
    }
    toDelete.push(key); /* 不在台账=历史遗留黑户；超 24h=被遗弃 */
    if (toDelete.length >= 100) break; /* 单次最多删 100 个，分次清完 */
  }

  let deleted = 0;
  try {
    if (!isKV && toDelete.length) { await bucket.delete(toDelete); deleted = toDelete.length; }
    else { for (const k of toDelete) { try { await bucket.delete(k); deleted++; } catch (e) {} } }
  } catch (e) {}

  try { for (const k of toDelete) await env.DB.prepare('DELETE FROM uploads WHERE key = ?').bind(k).run(); } catch (e) {}
  return json({ ok: true, scanned: cand.length, deleted: deleted });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
