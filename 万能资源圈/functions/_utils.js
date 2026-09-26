/**
 * 共享工具函数（被各个 API 引用）
 */

// 返回 JSON 响应（自动带 CORS 头）
export function json(data, status = 200, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...(extraHeaders || {}),
    },
  });
}

// 解析请求 Cookie 中的指定字段（R30：登录令牌迁移到 HttpOnly Cookie）
export function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const kv = part.trim().split('=');
    if (kv[0] === name) return decodeURIComponent(kv.slice(1).join('=') || '');
  }
  return '';
}

// CORS 头：只放行同源（站点页面与 API 部署在同一个 Cloudflare Pages 域名下，全是同源请求）。
// 修复：原先无条件返回 Access-Control-Allow-Origin: * —— 任何第三方网页都能在用户浏览器里
// 读取本站接口返回的数据。现在仅当请求方 Origin 与站点自身同源（或本地调试 localhost）时才回显。
export function corsHeaders(request) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  let origin = '';
  let selfOrigin = '';
  try {
    if (request) {
      origin = (request.headers && request.headers.get('Origin')) || '';
      selfOrigin = new URL(request.url).origin;
    }
  } catch (e) { /* 解析失败按无 Origin 处理 */ }
  if (origin && (origin === selfOrigin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

// OPTIONS 预检请求处理
export function handleOptions(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// 读取请求 JSON 体（失败返回空对象）
export async function readJSON(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

// SHA-256 哈希（用于密码存储，不存明文）
export async function hashPassword(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 带盐哈希：SHA-256(salt + password)（旧格式，仅用于兼容验证，不再用于新写入）
export async function hashPasswordWithSalt(password, salt) {
  return hashPassword(salt + password);
}

// ===== PBKDF2 多轮哈希（R29/优化项2：防拖库后显卡暴力破解） =====
// 旧格式单轮 SHA-256 一次运算即得哈希，数据库被拖走后可用 GPU 每秒试数十亿次；
// PBKDF2 故意重复运算 60000 轮，单次验证约 10ms，暴力试密码速度被拖慢数万倍。
// 实测本地单核 60000 迭代 ≈10ms，登录属低频操作，代价可接受。
export const PBKDF2_ITERATIONS = 60000;

// PBKDF2-SHA256(password, salt, iterations) → 256bit hex
export async function pbkdf2Hash(password, salt, iterations) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: iterations },
    key, 256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 生成新格式哈希。存储格式：pbkdf2$<iterations>$<salt_hex>$<hash_hex>（参数自包含，便于将来调迭代数）
export async function hashPasswordNew(password) {
  const salt = randomSalt();
  const hash = await pbkdf2Hash(password, salt, PBKDF2_ITERATIONS);
  return { salt, hash: 'pbkdf2$' + PBKDF2_ITERATIONS + '$' + salt + '$' + hash };
}

// 统一密码验证（兼容新旧格式）：row = { password_hash, salt }
// 返回 { ok, needUpgrade }：needUpgrade=true 表示命中旧格式且密码正确，调用方应顺手升级重哈希
export async function verifyPassword(password, row) {
  const stored = String(row.password_hash || '');
  if (stored.startsWith('pbkdf2$')) {
    const parts = stored.split('$');
    const iter = parseInt(parts[1], 10) || PBKDF2_ITERATIONS;
    const salt = parts[2] || '';
    const expect = parts[3] || '';
    const hash = await pbkdf2Hash(password, salt, iter);
    return { ok: hash === expect, needUpgrade: false };
  }
  // 旧格式：SHA-256(salt + password)
  const old = await hashPasswordWithSalt(password, String(row.salt || ''));
  const ok = old === stored;
  return { ok, needUpgrade: ok };
}

// 旧格式密码验证通过后升级为 PBKDF2（用户无感知，老密码照用）
export async function upgradePasswordHash(env, adminId, password) {
  const { salt, hash } = await hashPasswordNew(password);
  await env.DB.prepare('UPDATE admins SET password_hash = ?, salt = ? WHERE id = ?')
    .bind(hash, salt, adminId).run();
}

// 生成随机盐（32 字节 hex）
export function randomSalt() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 生成随机登录 token（32 字节 hex）
export function randomToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 解析请求里的 Bearer token 并返回管理员信息；未登录或已过期返回 null
export async function getAuthAdmin(env, request) {
  // R30：令牌优先从 HttpOnly Cookie 读取（JS 脚本不可见，防窃取）；
  // 同时兼容旧版 Authorization 头（老会话 24 小时内自然过期后统一走 Cookie）
  let auth = getCookie(request, 'wnzyq_token');
  if (!auth) auth = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!auth) return null;
  const row = await env.DB.prepare(
    'SELECT s.admin_id AS id, a.username, s.expires_at FROM sessions s LEFT JOIN admins a ON a.id = s.admin_id WHERE s.token = ?'
  )
    .bind(auth)
    .first();
  if (!row) return null;
  // 检查会话是否过期（expires_at 为 UTC 时间字符串）
  if (row.expires_at) {
    const now = new Date();
    const exp = new Date(row.expires_at.replace(' ', 'T') + 'Z');
    if (now >= exp) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(auth).run();
      return null;
    }
  }
  return row;
}

// 管理接口鉴权：返回管理员对象；未登录返回 401 Response（调用方需判断 instanceof Response）
export async function requireAuth(env, request) {
  // CSRF 防护：检查 Origin/Referer 是否同源（有则必须同源，无则放行）
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  if (origin && !origin.startsWith(url.origin)) {
    return json({ ok: false, msg: '非法请求来源' }, 403);
  }
  if (!origin && referer && !referer.startsWith(url.origin)) {
    return json({ ok: false, msg: '非法请求来源' }, 403);
  }

  const admin = await getAuthAdmin(env, request);
  if (!admin) return json({ ok: false, msg: '未登录或登录已过期' }, 401);
  return admin;
}

// 把数据库行转成前台友好字段（snake_case → camelCase）
export function cleanProduct(p) {
  let coverImages = [];
  let detailImages = [];
  let detailVideos = [];
  try { coverImages = JSON.parse(p.cover_images || '[]'); } catch (e) { coverImages = []; }
  try { detailImages = JSON.parse(p.detail_images || '[]'); } catch (e) { detailImages = []; }
  try { detailVideos = JSON.parse(p.detail_videos || '[]'); } catch (e) { detailVideos = []; }
  return {
    id: p.id,
    cid: p.cid,
    title: p.title,
    desc: p.desc,
    detail: p.detail,
    img: p.img,
    coverImages: coverImages,     // 封面轮播图（网络 URL 数组）
    detailImages: detailImages,   // 详情多图（网络 URL 数组）
    detailVideos: detailVideos,   // 详情多视频（网络 URL 数组）
    contactUrl: p.contact_url,    // 咨询客服链接
    price: p.price || 0,           // 价格（0=免费不显示）
    is_online: p.is_online,
    is_hidden: p.is_hidden || 0,   // 1=隐藏（前台不显示）
    schedule_on: p.schedule_on || '',    // 定时显示时间（空=不定时）
    schedule_off: p.schedule_off || '',  // 定时隐藏时间（空=不定时）
    sort: p.sort,
  };
}

// 幂等确保 product_variants 拥有 资源码/专属内容/隐藏 字段（已部署库自动迁移，无需手动初始化）
let _variantColsEnsured = false;
export async function ensureVariantColumns(env) {
  if (_variantColsEnsured) return;
  try {
    const cols = await env.DB.prepare("PRAGMA table_info(product_variants)").all();
    const names = cols.results.map((c) => c.name);
    if (!names.includes('title')) await env.DB.prepare("ALTER TABLE product_variants ADD COLUMN title TEXT NOT NULL DEFAULT ''").run(); // R148：类型标题（老库自动补列）
    if (!names.includes('resource_code')) await env.DB.prepare("ALTER TABLE product_variants ADD COLUMN resource_code TEXT NOT NULL DEFAULT ''").run();
    if (!names.includes('resource_content')) await env.DB.prepare("ALTER TABLE product_variants ADD COLUMN resource_content TEXT NOT NULL DEFAULT ''").run();
    if (!names.includes('is_hidden')) await env.DB.prepare("ALTER TABLE product_variants ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0").run();
    // R106：绑定设备上限挪到类型编辑表单——老库补 bind_limit 列（NULL=未单独设置，按全局设置兜底）
    if (!names.includes('bind_limit')) await env.DB.prepare("ALTER TABLE product_variants ADD COLUMN bind_limit INTEGER").run();
    _variantColsEnsured = true;
  } catch (e) { /* 表尚未创建时忽略，install 会按新结构建表 */ }
}

// 幂等确保 products 拥有后加字段（已部署旧库自动补列，避免新增/编辑报 500）
let _productColsEnsured = false;
export async function ensureProductColumns(env) {
  if (_productColsEnsured) return;
  try {
    const cols = await env.DB.prepare("PRAGMA table_info(products)").all();
    const names = cols.results.map((c) => c.name);
    const add = async (col, ddl) => {
      if (!names.includes(col)) await env.DB.exec("ALTER TABLE products ADD COLUMN " + ddl);
    };
    await add('cover_images', "cover_images TEXT NOT NULL DEFAULT '[]'");
    await add('detail_images', "detail_images TEXT NOT NULL DEFAULT '[]'");
    await add('detail_videos', "detail_videos TEXT NOT NULL DEFAULT '[]'");
    await add('price', "price REAL NOT NULL DEFAULT 0");
    await add('is_hidden', "is_hidden INTEGER NOT NULL DEFAULT 0");
    await add('schedule_on', "schedule_on TEXT");
    await add('schedule_off', "schedule_off TEXT");
    await add('sort', "sort INTEGER NOT NULL DEFAULT 0");
    await add('updated_at', "updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
    _productColsEnsured = true;
  } catch (e) { /* 表尚未创建时忽略，install 会按新结构建表 */ }
}

// R92：公开版类型字段——资源码与专属内容只保存在服务端，公开接口一律剥离明文，
// 只下发 hasCode / hasContent 两个布尔标志（前台据此决定显示输入框还是直接获取键）；
// 明文仅通过 /api/unlock 验证成功后单发。管理端接口继续用 cleanVariant 拿全量。
export function cleanVariantPublic(v) {
  return {
    id: v.id,
    productId: v.product_id,
    name: v.name,
    title: v.title || '',  // R148：类型标题（前台展示用，空=回退名称）
    desc: v.desc,
    img: v.img,
    video: v.video,
    contactUrl: v.contact_url,
    price: v.price || 0,
    sort: v.sort,
    hasCode: !!(v.resource_code && String(v.resource_code).trim()),
    hasContent: !!(v.resource_content && String(v.resource_content).trim()),
    isHidden: v.is_hidden || 0,
  };
}

// 把数据库行转成资源类型字段
export function cleanVariant(v) {
  return {
    id: v.id,
    productId: v.product_id,
    name: v.name,
    title: v.title || '',            // R148：类型标题（前台选中类型信息栏第一行黑字，空=回退名称）
    desc: v.desc,
    img: v.img,
    video: v.video,
    contactUrl: v.contact_url,
    price: v.price || 0,            // 类型价格（0=不显示，用资源价格）
    sort: v.sort,
    resourceCode: v.resource_code || '',
    resourceContent: v.resource_content || '',
    isHidden: v.is_hidden || 0,
    bindLimit: v.bind_limit || 0,   // R106：类型级绑定上限（0/未设置=按全局设置兜底）
  };
}

// R92：一机一码·设备绑定表（幂等创建，已部署库无需重跑 install 自动建表）
// 一行 = 某设备（device_token）绑定了某类型（variant_id）；宽松模式下绑定记录永久有效，
// 换码只废旧码的入场资格，不触碰已有绑定（已绑定设备照常解锁）。
let _bindingsEnsured = false;
export async function ensureBindingsTable(env) {
  if (_bindingsEnsured) return;
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS resource_bindings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id   INTEGER NOT NULL,
      product_id   INTEGER NOT NULL,
      device_token TEXT NOT NULL,
      ua           TEXT NOT NULL DEFAULT '',
      code         TEXT NOT NULL DEFAULT '',
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      last_access  TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run();
    // R106：exec() 在线上 D1 不稳定且失败会被下方 catch 静默吞掉，导致后续 SELECT 报"表不存在"直接 500；
    // 改为 prepare().run() 逐条执行（与全站 SELECT/INSERT 同一通道，可靠性一致）
    await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_bindings_variant_device ON resource_bindings(variant_id, device_token)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bindings_variant ON resource_bindings(variant_id)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bindings_product ON resource_bindings(product_id)').run();
    // R96：老表补 code 列（记录绑定时的资源码，"绑满自动换码"按码周期计数）；列已存在时报错忽略
    try { await env.DB.prepare("ALTER TABLE resource_bindings ADD COLUMN code TEXT NOT NULL DEFAULT ''").run(); } catch (e) { /* 已有该列 */ }
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bindings_variant_code ON resource_bindings(variant_id, code)').run();
    _bindingsEnsured = true;
  } catch (e) { console.error('R106 ensureBindingsTable 失败（调用方按无绑定数据兜底）:', e && e.message); /* 建表失败时调用方按无绑定数据兜底 */ }
}

// R221（老板 15:44 拍板·复制即换码 + 60 天兑换窗口）：随机资源码——8 位大写（验证不区分大小写）；
// R98 口径沿用：全字符集随机，不做 0/O/1/I/L 易混淆限制
export function genResourceCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

// R221：发码记录表（幂等自愈建表，沿用 ensureBindingsTable 模式）——
// 一行 = 某类型（variant_id）在某时刻（issued_at）发出的一个资源码：
//   status='issued' 待用（60 天窗口内可兑换）；'bound' 已用（至少一台设备已凭此码绑定）。
// 「已过期」不落库状态，由展示层按 issued_at 距今超 60 天动态判定；
// 超 60 天仍未绑定的 issued 行由 track.js 访问顺带清理删除（R204 教训：纯代码滚动清理，不用 Cron）。
let _codeIssuesEnsured = false;
export async function ensureCodeIssuesTable(env) {
  if (_codeIssuesEnsured) return;
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS code_issues (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL DEFAULT 0,
      code       TEXT NOT NULL,
      issued_at  TEXT NOT NULL DEFAULT (datetime('now')),
      status     TEXT NOT NULL DEFAULT 'issued',
      bound_at   TEXT
    )`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_code_issues_variant_status ON code_issues(variant_id, status)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_code_issues_variant_issued ON code_issues(variant_id, issued_at)').run();
    _codeIssuesEnsured = true;
  } catch (e) { console.error('R221 ensureCodeIssuesTable 失败（调用方按无发码记录兜底）:', e && e.message); }
}

// R221：码字符串可用性检查——不与该类型当前 resource_code 相同、不在该类型仍存于表的发码记录里（含未清理的过期行）。
// 过期行被 track.js 清理删除后即不占位 → 该码字符串可被再次生成（过期码回收复用，保证永远有码可发）。
export async function codeAvailable(env, variantId, code) {
  try {
    const cur = await env.DB.prepare('SELECT resource_code FROM product_variants WHERE id = ?').bind(variantId).first();
    if (cur && String(cur.resource_code || '').trim() === code) return false;
    const hit = await env.DB.prepare('SELECT id FROM code_issues WHERE variant_id = ? AND code = ? LIMIT 1').bind(variantId, code).first();
    return !hit;
  } catch (e) { return true; }
}

// R221：生成防撞新码——随机生成并避开该类型所有仍占位的码字符串（当前码 + 表内全部发码记录）；
// 连续 64 次撞车（36^8 空间下理论不可达）则放行最后一个候选，保证永远有码可发
async function genAvailableCode(env, variantId) {
  let cand = '';
  for (let i = 0; i < 64; i++) {
    cand = genResourceCode();
    if (await codeAvailable(env, variantId, cand)) return cand;
  }
  return cand;
}

// R221：发码核心（复制即换码）——后台点「复制」时调用：
//   ① 当前码记一条 issued（issued_at=now；已有未过期同码记录则不重复记，兼容迁移种子/同分钟重复点按）
//   ② 生成防撞新码写回类型行（面板立即可见新码，下一个客户用新码）
//   返回 { ok, msg } 或 { ok:true, issuedCode:刚发出的码, code:面板新码 }
export async function issueCodeForVariant(env, variantId) {
  const v = await env.DB.prepare('SELECT id, product_id, resource_code FROM product_variants WHERE id = ?').bind(variantId).first();
  if (!v) return { ok: false, msg: '类型不存在' };
  const oldCode = String(v.resource_code || '').trim();
  if (!oldCode) return { ok: false, msg: '该类型未设置资源码，请先在类型编辑里设置' };
  await ensureCodeIssuesTable(env);
  const active = await env.DB.prepare(
    "SELECT id FROM code_issues WHERE variant_id = ? AND code = ? AND status = 'issued' AND issued_at >= datetime('now','-60 days') LIMIT 1"
  ).bind(variantId, oldCode).first();
  if (!active) {
    await env.DB.prepare('INSERT INTO code_issues (variant_id, product_id, code) VALUES (?, ?, ?)').bind(variantId, v.product_id || 0, oldCode).run();
  }
  const newCode = await genAvailableCode(env, variantId);
  await env.DB.prepare('UPDATE product_variants SET resource_code = ? WHERE id = ?').bind(newCode, variantId).run();
  return { ok: true, issuedCode: oldCode, code: newCode };
}

// R221：某类型最近发码记录（后台码面板展示：码 / 发放时间 / 剩余有效天数 / 状态）。
// 剩余天数与「已过期」状态在此计算（60 天窗口的展示口径与 unlock.js 验证口径一致）。
export async function recentIssues(env, variantId, limit = 5) {
  try {
    const r = await env.DB.prepare(
      'SELECT code, issued_at, status, bound_at FROM code_issues WHERE variant_id = ? ORDER BY id DESC LIMIT ?'
    ).bind(variantId, limit).all();
    return (r.results || []).map((row) => {
      let ageDays = 60;
      try {
        const t = new Date(String(row.issued_at).replace(' ', 'T') + 'Z').getTime();
        ageDays = Math.floor((Date.now() - t) / 86400000);
        if (ageDays < 0) ageDays = 0;
      } catch (e) { /* 时间解析失败按满窗计 */ }
      let statusText = '待用';
      if (row.status === 'bound') statusText = '已用';
      else if (ageDays >= 60) statusText = '已过期';
      return { code: row.code, issued_at: row.issued_at, remaining_days: Math.max(0, 60 - ageDays), status: statusText };
    });
  } catch (e) { return []; }
}

// R92：读取平台设置（settings 键值表），失败/未设置返回默认值
export async function getSetting(env, key, fallback) {
  try {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
    return row && row.value !== '' ? row.value : fallback;
  } catch (e) {
    return fallback;
  }
}

// ============ R31（优化项7）：自有图仓（R2 绑定 IMAGE_BUCKET）============
// 从任意文本（单个 URL / HTML / JSON 数组字符串）里提取属于图仓的图片 key 并删除。
// 调用场景：删除资源 / 批量删除时联动清理图仓图片（删图失败不阻塞删资源）。
// R36：① 同时清理 videos/（本地视频）；② 引用保护——先查剩余资源/类型是否还在用这个 key
// （复制出来的资源会共用同一张图），被引用的跳过不删，避免别的资源变裂图；
// ③ 纳入 detail_videos 与 product_variants 的 desc/img/video/resource_content 字段（由调用方传入）。
export async function deleteBucketImages(env, sources) {
  try {
    if (!env.IMAGE_BUCKET || !Array.isArray(sources) || !sources.length) return;
    /* R54：图仓直连地址——图片统一走 /img/ 自家路由（mediaPathRe 匹配任意域名），不再查直连地址，顺带省一次 DB 查询 */
    const base = '';
    const keys = new Set();
    // R32：图片统一走自家路由 /img/images/...（相对路径或任意域名的绝对 URL）；
    // R36：新增本地视频 /img/videos/...；兼容旧 R2 公开地址（base 前缀）。
    const mediaPathRe = /(?:https?:\/\/[^\s"'<>)]+)?\/img\/((?:images|videos)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(?:png|jpg|jpeg|webp|gif|mp4|webm|mov))/g;
    for (const src of sources) {
      if (!src) continue;
      const text = String(src);
      let m;
      mediaPathRe.lastIndex = 0;
      while ((m = mediaPathRe.exec(text)) !== null) keys.add(m[1].split('?')[0]);
    }
    /* R213 P2②（质检 R212）：R54 废弃的 baseRe 恒空死分支已删 */
    if (!keys.size) return;
    // R36 引用保护：调用方在 DB 记录已删完之后调用本函数，此时库里还引用该 key 的
    // 一定是别的资源/类型（比如"2（副本）"共用同一张封面），这些不能删。
    const kept = [];
    const toDelete = [];
    for (const key of keys) {
      const like = '%' + key + '%';
      const usedBy = await env.DB.prepare(
        `SELECT (SELECT COUNT(*) FROM products WHERE img LIKE ? OR detail LIKE ? OR detail_images LIKE ? OR detail_videos LIKE ?)
              + (SELECT COUNT(*) FROM product_variants WHERE "desc" LIKE ? OR img LIKE ? OR video LIKE ? OR resource_content LIKE ?) AS n`
      ).bind(like, like, like, like, like, like, like, like).first();
      if (usedBy && usedBy.n > 0) { kept.push(key); continue; }
      toDelete.push(key);
    }
    if (toDelete.length) await Promise.all(toDelete.map((k) => env.IMAGE_BUCKET.delete(k)));
    /* R213 P2⑤（质检 R212 + 队长拍板）：R36 图仓清理 console.log 已删（质检报告曾建议保留为运维日志，按「调试残留全删」口径执行，如需留痕改 console.error 再议） */
  } catch (e) {
    console.error('R36 图仓媒体清理失败(不影响资源删除):', e);
  }
}
