/**
 * POST /api/admin/global-cleanup —— 全局孤儿清理（v354，用户拍板：全系统一切没用上的上传文件都自动清）
 * 规则：列出存储仓全部文件 → 核对是否仍被任何内容引用（资源/类型/设置，公告也存在设置里）→ 没人用的删除。
 * 保护：①上传台账——24 小时内的新文件可能是编辑中途的，不删；台账之前的历史遗留（如拖拽 bug 期的黑户）直接删。
 * 节流：**只作用于真删**（真删成功后 60 秒内不重复）；预扫不参与、不读也不写任何状态。
 */
import { json, requirePerm, buildContentText, readJSON, audit } from '../../_utils.js';/* v680：去掉密码校验后 verifyPassword 不再使用，避免死导入 */

const GRACE_HOURS = 24;

export async function onRequestPost(context) {
  const { env, request } = context; await (await import('../../_utils.js')).ensureAdminUsers(env);
  const auth = await requirePerm(env, request, 'system.file');
  if (auth instanceof Response) return auth;
  /* v684（复查建议）：`system.file` 在 v677 已从权限面板删掉，正常授权路径给不出这颗权限；
     但老账号的 perms JSON 里如果残留 true，它仍然能调、而且现在不用密码。
     删文件不可逆，这里直接锁死只有超管能调。 */
  if (auth.role !== 'super') return json({ ok: false, msg: '该功能仅超级管理员可用' }, 403);

  /* v680（老板 11-21 明确）：「这些占用的数据不重要，都删除了说明不重要了，就不需要密码了，点击确认删除即可」。
     所以去掉 v674 的超管密码门槛，保留 system.file 权限（能进「清空测试数据」的人本来就只有超管）。
     但没有密码就意味着**更没有后悔药**，因此加了两道保护：
     ① 先 dryRun 预扫，把「能清几个、占多少空间」摆出来，让用户看着数字点确认；
     ② 真正删除前仍然核对引用（被任何内容引用的文件一律不删）+ 24 小时新上传保护期。 */
  const _b = await readJSON(request);
  const dryRun = !!(_b && _b.dryRun);

  const bucket = env.IMAGE_BUCKET;
  if (!bucket) return json({ ok: false, msg: '图片存储未配置' }, 400);

  /* 节流：**只作用于真删** —— 真删成功后 60 秒内不重复；预扫（dryRun）完全不进这块，不读也不写任何状态
     （老板要求「预扫零副作用」，这一步是那句要求的落点）。
     v684 修：原来节流不分 dryRun，预扫就把时间戳写了 → 紧随其后的「确认清理」必被 skip，
     「扫 → 删」两步流程永远删不掉（前端还显示「已清理 0 个」）。
     v684b 定：① 窗口 30 分钟 → **60 秒**（进后台自动调用早已删除，这里只为防连点；
                清满 100 个想再来一批，不该再等半小时）；
               ② 时间戳挪到「删完之后」写（见函数尾部），预扫 / 引用核对失败 / 中途被打断都不污染窗口。 */
  if (!dryRun) {
    try {
      const last = await env.DB.prepare("SELECT value FROM settings WHERE key = 'last_global_sweep'").first();
      if (last && last.value) {
        const ageMin = (Date.now() - Date.parse(String(last.value).replace(' ', 'T') + 'Z')) / 60000;
        if (isFinite(ageMin) && ageMin < 1) return json({ ok: true, skipped: true, deleted: 0, msg: '刚清理过，请稍等 1 分钟再试' });
      }
    } catch (e) {}
  }

  /* 列出存储仓文件（KV / R2 两种存储都兼容） */
  const isKV = typeof bucket.getWithMetadata === 'function';
  const RE = /^(?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}(?:_t)?\.[a-zA-Z0-9]+$/;
  const keys = [];
  const sizeOf = {}; /* dryRun 用：key → 字节数（KV 拿不到体积时为 undefined） */
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
        for (const o of (r.objects || [])) { keys.push(o.key); if (typeof o.size === 'number') sizeOf[o.key] = o.size; }
        if (!r.truncated || !r.cursor) break;
        cur = r.cursor;
      }
    }
  } catch (e) { return json({ ok: false, msg: '列出存储失败' }, 500); }

  const cand = keys.filter(function (k) { return RE.test(k); });
  if (!cand.length) return dryRun
    ? json({ ok: true, dryRun: true, scanned: 0, count: 0, bytes: 0, sample: [] })
    : json({ ok: true, scanned: 0, deleted: 0 });

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
    if (!dryRun && toDelete.length >= 100) break; /* 真实删除：单次最多 100 个，分次清完；预扫要报全量 */
  }

  if (dryRun) {
    let bytes = 0;
    for (const k of toDelete) { const b = sizeOf[k]; if (typeof b === 'number') bytes += b; }
    return json({ ok: true, dryRun: true, scanned: cand.length, count: toDelete.length, bytes: bytes, sample: toDelete.slice(0, 5) });
  }

  let deleted = 0;
  try {
    if (!isKV && toDelete.length) { await bucket.delete(toDelete); deleted = toDelete.length; }
    else { for (const k of toDelete) { try { await bucket.delete(k); deleted++; } catch (e) {} } }
  } catch (e) {}

  try { for (const k of toDelete) await env.DB.prepare('DELETE FROM uploads WHERE key = ?').bind(k).run(); } catch (e) {}
  /* v684b：时间戳挪到「删完之后」写，而且**只在真的删到东西时**才占用节流窗口。
     两层理由：① 预扫 / 引用核对失败 / 中途被打断都不该消耗配额；
               ② deleted === 0（一个都没删到，比如候选都被引用或全部删除失败）时如果也写，
                  用户 60 秒内再点就会被判「刚清理过」——明明什么都没发生却被限流，说不通。 */
  if (deleted > 0) {
    try {
      await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('last_global_sweep', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = datetime('now')").run();
    } catch (e) {}
  }
  /* v684：去掉密码后必须留痕——谁在什么时候删了多少个文件，事后要查得到 */
  try { await audit(env, request, '清理无用文件', '扫描 ' + cand.length + ' 个，删除 ' + deleted + ' 个'); } catch (e) {}
  return json({ ok: true, scanned: cand.length, deleted: deleted });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
