/**
 * POST /api/admin/global-cleanup —— 全局孤儿清理（v354，用户拍板：全系统一切没用上的上传文件都自动清）
 * 规则：列出存储仓全部文件 → 核对是否仍被任何内容引用（资源/类型/设置，公告也存在设置里）→ 没人用的删除。
 * 保护：①上传台账——24 小时内的新文件可能是编辑中途的，不删；台账之前的历史遗留（如拖拽 bug 期的黑户）直接删。
 * 节流：两套，互不干扰 ——
 *   ① **真删**：60 秒（存 `settings.last_global_sweep`，跨 isolate 有效）；
 *   ② **预扫（dryRun）**：5 秒**进程内**（模块级时间戳，不写库 —— 老板要求「预扫零副作用」，见 __dryRunAt）。
 * 返回体：两个分支都带 `remain`（= 本次扫出的候选总数 − 本次删除数），前端据此判断「还有更多」，
 *         不再用 `deleted >= 100` 猜（v687 修的「已知不精确」）。
 *
 * ⚠⚠ **`uploads` 台账是「24 小时保护」的唯一依据，任何新增的上传入口都必须调 `recordUpload(env, key)`**（`_utils.js` 导出）。
 *    判断逻辑就在下面：`const created = ledger[key]; if (created && ageH < 24) continue;` —— **台账里没有这个 key ＝ 立刻可删**，
 *    不管它是 1 秒前刚上传的。漏记一次＝那条上传通道完全没有保护（v688 之前 `upload-image.js` 的主图/小图、`upload.js` 就是漏的，
 *    QA 实测「上传 24 秒后就被清掉」）。小图（`_t.webp`）、缩略图、任何独立 key 都要各自记一笔。
 *    记台账必须放在 `put` **成功之后**、并用 try/catch 包住（台账失败不能导致上传失败）。
 */
import { json, requirePerm, buildContentText, readJSON, audit } from '../../_utils.js';/* v680：去掉密码校验后 verifyPassword 不再使用，避免死导入 */

const GRACE_HOURS = 24;
/* v687：单次真删上限（原来是写在候选收集循环里的 `toDelete.length >= 100` → break）。
   挪到「删除那一步」做切片，原因见函数里 remain 的注释：只有扫完全部候选，才答得出「还剩多少个」。 */
const DELETE_MAX = 100;

/* v687（补「预扫没有节流」这笔欠账）：dryRun 的**进程内**节流状态。
   为什么需要它：预扫是整条链路里最重的一步——列最多 2500 个 key + 分批查 `uploads` + `buildContentText` 拉全库文本，
   而它偏偏是免费的、可被反复触发的（前端在请求期间会 disable 那颗键，但重开弹窗 / 脚本能绕过）→ 白烧 D1 日读额度。
   为什么是进程内变量而不是写库：往 `settings` 写时间戳就等于「预扫有副作用」，直接违反老板 11-21 那条
   「预扫零副作用」，也会把 v684 修过的「预扫把真删的节流窗口吃掉」那个坑重新挖开。
   ⇒ 只活在当前 isolate 的内存里。**代价：isolate 重启/换实例后时间戳归零、节流失效**，
     这是刻意接受的可接受代价——它只负责挡住「手抖连点 / 重开弹窗立刻再点」，不承担配额管控职责。 */
const DRY_RUN_MIN_MS = 5000;
let __dryRunAt = 0;        /* 上一次预扫开始的时间戳（0 = 本 isolate 还没预扫过） */
let __dryRunCache = null;  /* 上一次预扫的完整返回体；5 秒内重复调用直接复用它（带上 throttled:true） */

export async function onRequestPost(context) {
  const { env, request } = context; await (await import('../../_utils.js')).ensureAdminUsers(env);
  const auth = await requirePerm(env, request, 'system.file');
  if (auth instanceof Response) return auth;
  /* v684（复查建议）：`system.file` 在 v677 已从权限面板删掉，正常授权路径给不出这颗权限；
     但老账号的 perms JSON 里如果残留 true，它仍然能调、而且现在不用密码。
     删文件不可逆，这里直接锁死只有超级管理员能调。 */
  if (auth.role !== 'super') return json({ ok: false, msg: '该功能仅超级管理员可用' }, 403);

  /* v680（老板 11-21 明确）：「这些占用的数据不重要，都删除了说明不重要了，就不需要密码了，点击确认删除即可」。
     所以去掉 v674 的超级管理员密码门槛，保留 system.file 权限（能进「清空测试数据」的人本来就只有超级管理员）。
     但没有密码就意味着**更没有后悔药**，因此加了两道保护：
     ① 先 dryRun 预扫，把「能清几个、占多少空间」摆出来，让用户看着数字点确认；
     ② 真正删除前仍然核对引用（被任何内容引用的文件一律不删）+ 24 小时新上传保护期。 */
  const _b = await readJSON(request);
  const dryRun = !!(_b && _b.dryRun);

  const bucket = env.IMAGE_BUCKET;
  if (!bucket) return json({ ok: false, msg: '图片存储未配置' }, 400);

  /* v687：预扫的 5 秒进程内节流（时间戳是模块级变量，不读也不写数据库，见文件头 __dryRunAt 那一段）。
     命中时：上一次有结果就**原样复用**（附 throttled:true 告诉前端「这是复用，不是重新扫的」），
     上一次还在跑（并发请求，缓存还没写）就给一个安全占位。两种情况前端都按「静默忽略」处理，不弹错。 */
  if (dryRun) {
    if (__dryRunAt && (Date.now() - __dryRunAt) < DRY_RUN_MIN_MS) {
      return json(__dryRunCache
        ? Object.assign({}, __dryRunCache, { throttled: true })
        : { ok: true, dryRun: true, throttled: true, scanned: 0, count: 0, remain: 0, bytes: 0, sample: [], msg: '刚扫描过，5 秒内不重复扫描' });
    }
    /* 先占时间戳再干活：并发的第二笔请求走上面的分支，不会同时跑两份重活 */
    __dryRunAt = Date.now();
  }

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
  } catch (e) { __dryRunAt = 0; return json({ ok: false, msg: '列出存储失败' }, 500); }

  const cand = keys.filter(function (k) { return RE.test(k); });
  if (!cand.length) {
    /* v687：空结果也算一次有效预扫 —— 进缓存，5 秒内重复点直接复用，不再白跑一遍「列仓 + 拉全库文本」 */
    if (dryRun) {
      const empty = { ok: true, dryRun: true, scanned: 0, count: 0, remain: 0, bytes: 0, sample: [] };
      __dryRunCache = empty;
      return json(empty);
    }
    return json({ ok: true, scanned: 0, deleted: 0, remain: 0 });
  }

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
  /* v687：核对失败时把预扫节流的时间戳清零 —— 这一次什么都没扫成，不该让用户 5 秒内重试被节流挡住 */
  if (text === null) { __dryRunAt = 0; return json({ ok: false, msg: '引用核对失败，本次不动任何文件' }, 500); }

  const toDelete = [];
  for (const key of cand) {
    if (text.indexOf(key) !== -1) continue; /* 仍被引用，坚决不删 */
    const created = ledger[key];
    if (created) {
      const ageH = (Date.now() - Date.parse(String(created).replace(' ', 'T') + 'Z')) / 3600000;
      if (isFinite(ageH) && ageH < GRACE_HOURS) continue; /* 新上传，可能正在编辑中 */
    }
    toDelete.push(key); /* 不在台账=历史遗留黑户；超 24h=被遗弃 */
    /* v687：**不再在这里 break**。原来这句 `if (!dryRun && toDelete.length >= 100) break;` 让真删只能收集到 100 个，
       `toDelete.length` 于是不等于「本次扫出的候选总数」—— remain 就没法如实回答「还剩多少个」。
       现在候选一律收全（跟预扫同一套循环，成本一样），「单次最多删 100 个」的限制挪到下面删除那一步切片。 */
  }

  if (dryRun) {
    let bytes = 0;
    for (const k of toDelete) { const b = sizeOf[k]; if (typeof b === 'number') bytes += b; }
    /* v687：契约统一 —— 预扫也带 `remain`（= 候选总数，因为一个都没删），前端不用再来回分辨分支语义 */
    const payload = { ok: true, dryRun: true, scanned: cand.length, count: toDelete.length, remain: toDelete.length, bytes: bytes, sample: toDelete.slice(0, 5) };
    __dryRunCache = payload; /* 给 5 秒进程内节流复用（见文件头 __dryRunAt） */
    return json(payload);
  }

  /* v687：单次真删上限在这一步生效 —— 只动前 100 个，`toDelete` 里剩下的留给下一次点击 */
  const batch = toDelete.slice(0, DELETE_MAX);
  let deleted = 0;
  try {
    if (!isKV && batch.length) { await bucket.delete(batch); deleted = batch.length; }
    else { for (const k of batch) { try { await bucket.delete(k); deleted++; } catch (e) {} } }
  } catch (e) {}

  try { for (const k of batch) await env.DB.prepare('DELETE FROM uploads WHERE key = ?').bind(k).run(); } catch (e) {}
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
  /* v687：`remain` = 本次扫出的候选总数 − 本次实际删除数。
     有了它前端不用再猜「还有更多」：
       · 恰好只剩 100 个、一次清完 → remain = 0 → 不再误报「还有更多」（这就是规范里那条「已知不精确」）；
       · 有 120 个、这次删 100 个 → remain = 20 → 如实说「还有 20 个，可再点一次继续清理」；
       · 有 100 个但删失败了 3 个 → remain = 3 → 也说得出口。
     ⚠ 要成立的前提是 `toDelete` 收集的是**全部**候选（所以上面取消了 100 个处的 break），否则 remain 恒 0，这句话等于死代码。 */
  const remain = Math.max(0, toDelete.length - deleted);
  return json({ ok: true, scanned: cand.length, deleted: deleted, remain: remain });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
