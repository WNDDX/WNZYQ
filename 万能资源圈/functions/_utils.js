/**
 * 共享工具函数（被各个 API 引用）
 */

// 返回 JSON 响应（自动带 CORS 头）
export function json(data, status = 200, extraHeaders, request) {
  /* v336 条17：新增 request 透传——未来跨域部署时 CORS 凭据头能真正写进响应（当前全同源不受影响） */
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff', /* v346 条88：接口响应统一补防嗅探头（此前只有页面/静态有） */
      ...(request ? corsHeaders(request) : corsHeaders()),
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
    headers['Access-Control-Allow-Credentials'] = 'true'; // v305：允许浏览器携带 Cookie，确保会话链路不断
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
  /* #116 复检修正：子账号表 admin_users 的列名是 pwd_hash（admins 表是 password_hash）——
     此前子账号登录/改密时 stored 恒为空串，验证必然失败（多账号登录全挂的 P0）。两列名兼容。 */
  const stored = String(row.password_hash || row.pwd_hash || '');
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
    'SELECT s.admin_id AS id, s.utype, a.username, s.expires_at FROM sessions s LEFT JOIN admins a ON a.id = s.admin_id WHERE s.token = ?'
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
    /* v348 条28：会话自动续期——只要还在用就不踢下线。
       原先固定 +24h 到期即失效，后台开着放着到点就被强制登出；
       现在剩余不足一半（12 小时）时自动再续 24 小时，长时间不用才要求重新登录。 */
    const halfMs = 12 * 60 * 60 * 1000;
    if (exp.getTime() - now.getTime() < halfMs) {
      try {
        await env.DB.prepare("UPDATE sessions SET expires_at = datetime('now', '+24 hours') WHERE token = ?").bind(auth).run();
      } catch (e) { /* 续期失败不影响本次请求 */ }
    }
  }
  /* v439 #116：多账号——utype='u' 会话对应 admin_users 子账号；旧会话（utype 空）= admins 超管 */
  if (row.utype === 'u') {
    const u = await env.DB.prepare('SELECT id, username, role, perms, status, note FROM admin_users WHERE id = ?').bind(row.id).first();
    if (!u || !u.status) { /* 停用/删除的子账号会话立即失效 */
      try { await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(auth).run(); } catch (e) {}
      return null;
    }
    try { await env.DB.prepare("UPDATE admin_users SET last_seen = datetime('now') WHERE id = ?").bind(u.id).run(); } catch (e) {}
    return { id: row.id, utype: 'u', username: u.username, role: u.role || 'sub', perms: u.perms || '{}', note: u.note || '' };
  }
  try { await env.DB.prepare("UPDATE admins SET last_login = datetime('now') WHERE id = ?").bind(row.id).run(); } catch (e) {}
  return { id: row.id, utype: 'a', username: row.username, role: 'super', perms: '{}', note: '' };
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

/* ===== v439 #116 多账号：账号表迁移 + 权限门卫 ===== */

/* admin_users 表 + products.created_by + sessions.utype 迁移（幂等，每实例一次） */
var __auDone = false;
export async function ensureAdminUsers(env) {
  if (__auDone) return;
  __auDone = true;
  try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, pwd_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'sub', parent_id INTEGER NOT NULL DEFAULT 0, perms TEXT NOT NULL DEFAULT '{}', status INTEGER NOT NULL DEFAULT 1, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), last_seen TEXT)").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE sessions ADD COLUMN utype TEXT NOT NULL DEFAULT 'a'").run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE products ADD COLUMN created_by TEXT NOT NULL DEFAULT \'\'').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE categories ADD COLUMN created_by TEXT NOT NULL DEFAULT \'\'').run(); } catch (e) {} /* #116：分类创建者（只能改自己名下的分类） */
}

/* 权限门卫：requireAuth 之后调用。无权（含冻结中的子账号）→ 统一「该功能未开放」 */
export async function requirePerm(env, request, action) {
  const me = await requireAuth(env, request);
  if (me instanceof Response) return me;
  const { can, frozenDenied, DENY_MSG, parsePerms } = await import('./_perms.js');
  let freezeOn = false;
  if (me.role !== 'super') {
    try {
      const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'sub_freeze'").first();
      freezeOn = r && r.value === '1';
    } catch (e) {}
  }
  const perms = typeof me.perms === 'string' ? parsePerms(me.perms) : (me.perms || null);
  if (frozenDenied(me.role, freezeOn) || !can(action, me.role, perms)) {
    return json({ ok: false, msg: DENY_MSG }, 403);
  }
  return me;
}

/* #116 范围锁 helper：校验某资源是否在当前身份授权分类内，返回 { ok, cid, createdBy, product } */
export async function productScopeOk(env, auth, productId) {
  const row = await env.DB.prepare('SELECT id, cid, created_by, title FROM products WHERE id = ? AND deleted_at IS NULL').bind(Number(productId) || 0).first();
  if (!row) return { ok: false, missing: true };
  if (auth.role === 'super') return { ok: true, cid: row.cid, createdBy: row.created_by, product: row };
  const { parsePerms, catAllowed } = await import('./_perms.js');
  const perms = typeof auth.perms === 'string' ? parsePerms(auth.perms) : null;
  return { ok: catAllowed(Number(row.cid) || 0, auth.role, perms), cid: row.cid, createdBy: row.created_by, product: row };
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
    contactQr: p.contact_qr || '', // v385 条11：专属客服二维码（空=前台回退平台设置）
    price: p.price || 0,           // 价格（0=免费不显示）
    is_online: p.is_online,
    is_hidden: p.is_hidden || 0,   // 1=隐藏（前台不显示）
    schedule_on: p.schedule_on || '',    // 定时显示时间（空=不定时）
    schedule_off: p.schedule_off || '',  // 定时隐藏时间（空=不定时）
    sort: p.sort,
    created_by: p.created_by || '',        /* v439 #116：创建者用户名（码可见规则用） */
    updated_at: p.updated_at || '',       // v294：211 并发编辑乐观锁用
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
      if (!names.includes(col)) await env.DB.prepare("ALTER TABLE products ADD COLUMN " + ddl).run();
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
    await add('original_urls', "original_urls TEXT NOT NULL DEFAULT ''"); /* v440：#79 压缩恢复列（线上旧库缺） */
    await add('created_by', "created_by TEXT NOT NULL DEFAULT ''"); /* v440：#116 创建者列（线上旧库缺） */
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
      region       TEXT NOT NULL DEFAULT '', -- v386：访客省份（CF request.cf.region）
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

// R307（用户 09-30）：recentIssues 定义已删——发码接口不再返回 5 条遗留记录（弹窗表走 bindings 全量查询）

// 清除公开接口缓存（管理员修改数据后调用，不阻塞主流程）
// v333 修：Cache API 是按「完整 URL（含查询串）」做键的。原来只删不带参数的 '/api/products'，
//   而前台请求恒带 ?page=1&page_size=20 之类的查询串 → 那条缓存永远删不掉，只能干等 20 秒自然过期。
//   现在把前台实际用到的几种写法一起删掉。
export async function clearPublicCache(request) {
  try {
    const cache = caches.default;
    const origin = new URL(request.url).origin;
    const paths = [
      '/api/products',
      '/api/products?page=1&page_size=20',
      '/api/products?page_size=0',
      '/api/categories',
      '/api/settings',
      '/api/shop/home',
      '/api/stats/count' /* v348 条29：前台「一共多少资源」也一并清，改完立刻是新数字 */
    ];
    for (const p of paths) {
      try { await cache.delete(new Request(new URL(p, origin).toString())); } catch (e2) { /* 单条失败不影响其余 */ }
    }
  } catch (e) { /* 缓存清除失败不影响写操作 */ }
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

// ===== v336 条19：上传公共通道（图片/视频/文件三个接口共用一套“挑桶+写入”） =====
export async function putToBucket(env, filename, body, opts) {
  opts = opts || {};
  const primary = opts.video ? env.VIDEO_BUCKET || env.IMAGE_BUCKET : env.IMAGE_BUCKET;
  const fallback = opts.video ? env.IMAGE_BUCKET : env.VIDEO_BUCKET || env.IMAGE_BUCKET;
  try {
    if (primary) { await primary.put(filename, body); return { bucket: primary, used: 'primary' }; }
  } catch (e) { /* 主桶失败落备用桶 */ }
  if (fallback) { await fallback.put(filename, body); return { bucket: fallback, used: 'fallback' }; }
  throw new Error('未绑定存储桶');
}

// ===== v336 条36：鉴权样板唯一源——新接口写 export const onRequestPost = withAuth(async (...) => {...) 即自动带锁 =====
// v346 条2：修正参数顺序（requireAuth 的定义是 (env, request)，原写反，一旦启用即失效）
export function withAuth(handler) {
  return async function (context) {
    const gate = await requireAuth(context.env, context.request);
    if (gate) return gate; // 未登录：requireAuth 已返回 401 响应
    return handler(context);
  };
}

/* ===== v354：上传台账 + 全局孤儿清理（用户拍板：全系统一切没用上的上传文件都自动清） ===== */
/* 记台账：每个上传成功的文件记一笔（24 小时内的新文件受保护，防误删编辑中途的文件） */
export async function recordUpload(env, key) {
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS uploads (key TEXT PRIMARY KEY, created_at TEXT NOT NULL)').run();
    await env.DB.prepare("INSERT INTO uploads (key, created_at) VALUES (?, datetime('now')) ON CONFLICT(key) DO NOTHING").bind(key).run();
  } catch (e) { /* 台账失败不影响上传 */ }
}

/* 拉全量内容文本（资源 + 类型 + 设置——公告也存在 settings 里），用于引用核对 */
export async function buildContentText(env) {
  const parts = [];
  try {
    const { results } = await env.DB.prepare('SELECT "img","detail","detail_images","detail_videos","resource_content" FROM products').all();
    for (const r of (results || [])) parts.push(r.img, r.detail, r.detail_images, r.detail_videos, r.resource_content);
  } catch (e) { return null; }
  try {
    const { results } = await env.DB.prepare('SELECT "desc","img","video","resource_content" FROM product_variants').all();
    for (const r of (results || [])) parts.push(r.desc, r.img, r.video, r.resource_content);
  } catch (e) { return null; }
  try {
    const { results } = await env.DB.prepare('SELECT "value" FROM settings').all();
    for (const r of (results || [])) parts.push(r.value);
  } catch (e) { return null; }
  return parts.filter(Boolean).join('\n');
}

/* 引用核对：文件是否仍被任何内容引用。核对失败一律当作被引用（宁可保留，绝不误删） */
export async function isKeyReferenced(env, key) {
  try {
    const txt = await buildContentText(env);
    if (txt === null) return true;
    return txt.indexOf(key) !== -1;
  } catch (e) { return true; }
}

/* 保存自动追删：oldText 里有、newText 里没有的文件钥匙 → 逐个核对引用后删除 */
export async function sweepDroppedKeys(env, oldText, newText) {
  try {
    const re = /(?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}(?:_t)?\.[a-zA-Z0-9]+/g;
    const olds = new Set(String(oldText || '').match(re) || []);
    const news = new Set(String(newText || '').match(re) || []);
    const gone = Array.from(olds).filter(function (k) { return !news.has(k); }).slice(0, 200);
    if (!gone.length) return 0;
    const bucket = env.IMAGE_BUCKET;
    if (!bucket) return 0;
    let n = 0;
    for (const key of gone) {
      if (await isKeyReferenced(env, key)) continue;
      try { await bucket.delete(key); n++; } catch (e) {}
    }
    return n;
  } catch (e) { return 0; }
}

/* ===== v432（总账 #38/#39）：上传内容嗅探 + 接口防刷 ===== */

/* #38 文件头校验：读真实字节比对魔数，防伪装成图片/视频的坏文件（仅校验，不改存储逻辑） */
const MAGIC = {
  'image/png':  [[0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]],
  'image/jpeg': [[0xFF,0xD8,0xFF]],
  'image/gif':  [[0x47,0x49,0x46,0x38]],
  'image/webp': [[0x52,0x49,0x46,0x46]],
  'video/mp4':  [[0x66,0x74,0x79,0x70]],   /* ftyp 盒（偏移 4 起四字节含 ftyp） */
  'video/webm': [[0x1A,0x45,0xDF,0xA3]],
};
export async function sniffMatchesType(file, type) {
  try {
    const rules = MAGIC[type];
    if (!rules) return true; /* 未登记的类型（如 mov）沿用原白名单口径，不加拦 */
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    return rules.some(sig => sig.every((b, i) => head[i] === b));
  } catch (e) { return true; } /* 嗅探失败不拦（保原逻辑可用性） */
}

/* #39 接口防刷：每实例内存滑动窗口（写接口 30 次/分钟/令牌），超限 429。
   管理端点本身有登录门槛，这里只做高频滥用兜底；跨实例不强一致属可接受（防的是刷不是分布式攻击）。 */
const __rate = new Map();
export function rateLimit(request, tag, maxPerMin) {
  try {
    /* v440 复检修正：限流键改 IP 优先——原键取管理员 Cookie，子账号/访客全部挤进同一个 'anon' 共享桶
       （多个子账号同时上传互相挤占配额），且清 Cookie 即换桶。现按 CF 连接 IP 独立计数，语义与拍板一致。 */
    const ip = request.headers.get('CF-Connecting-IP') || (request.headers.get('X-Forwarded-For') || '').split(',')[0] || (getCookie(request, 'wnzyq_token') || getCookie(request, 'wnzyq_admin') || 'anon').slice(0, 16);
    const key = tag + ':' + ip;
    const now = Date.now();
    let arr = __rate.get(key);
    if (!arr) { arr = []; __rate.set(key, arr); }
    while (arr.length && now - arr[0] > 60000) arr.shift();
    if (arr.length >= (maxPerMin || 30)) return false;
    arr.push(now);
    if (__rate.size > 5000) __rate.clear(); /* 防内存膨胀 */
    return true;
  } catch (e) { return true; }
}

/* ===== v439（总账 #63/#64/#68）：软删除迁移 + 变更审计 + 登录记录 ===== */

/* 软删除列迁移（幂等，每实例一次；新装走 install.js 新建表已含列） */
var __sdDone = false;
export async function ensureSoftDelete(env) {
  if (__sdDone) return;
  __sdDone = true;
  try { await env.DB.prepare('ALTER TABLE products ADD COLUMN deleted_at TEXT').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE categories ADD COLUMN deleted_at TEXT').run(); } catch (e) {}
}

/* #64 数据变更留痕（audit_log 表，60 天自动清理覆盖） */
export async function audit(env, request, action, target) {
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT (datetime('now')), admin TEXT NOT NULL DEFAULT 'admin', action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '')").run();
    await env.DB.prepare("INSERT INTO audit_log (admin, action, target) VALUES ('admin', ?, ?)").bind(String(action || '').slice(0, 60), String(target || '').slice(0, 200)).run();
  } catch (e) { /* 审计失败不阻塞业务 */ }
}

/* #68 公告软删：公开端下发 announcements 时摘掉带 deleted 标记的条目（回收站可见，60 天后随清理摘除） */
export function publicAnnouncements(value) {
  try {
    var arr = JSON.parse(value);
    if (!Array.isArray(arr)) return value;
    return JSON.stringify(arr.filter(function (a) { return a && !a.deleted; }));
  } catch (e) { return value; }
}

/* #63 设备描述：UA → 人话（系统 · 浏览器 · 环境） */
export function describeDevice(ua) {
  ua = String(ua || '');
  var parts = [];
  var os = /Windows NT 10/.test(ua) ? 'Windows' : /Windows/.test(ua) ? 'Windows' : /Android ([\d.]+)/.exec(ua) ? ('Android ' + RegExp.$1) : /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  if (os) parts.push(os);
  var br = /Edg\/(\d+)/.exec(ua) ? ('Edge ' + RegExp.$1) : /MicroMessenger/.test(ua) ? '微信内' : /QQBrowser/.test(ua) ? 'QQ浏览器' : /Firefox\/(\d+)/.test(ua) ? ('Firefox ' + RegExp.$1) : /Chrome\/(\d+)/.test(ua) ? ('Chrome ' + RegExp.$1) : /Safari/.test(ua) ? 'Safari' : '';
  if (br) parts.push(br);
  if (/Mobile/.test(ua)) parts.push('手机');
  return parts.join(' · ') || '未知设备';
}

/* #63 登录记录（admin_logins 表，60 天自动清理覆盖） */
export async function recordAdminLogin(env, request) {
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_logins (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT (datetime('now')), device TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '', ua TEXT NOT NULL DEFAULT '')").run();
    var ua = request.headers.get('User-Agent') || '';
    var ip = request.headers.get('CF-Connecting-IP') || (request.headers.get('X-Forwarded-For') || '').split(',')[0] || '';
    await env.DB.prepare('INSERT INTO admin_logins (device, ip, ua) VALUES (?, ?, ?)').bind(describeDevice(ua), ip, String(ua).slice(0, 300)).run();
  } catch (e) { /* 记录失败不阻塞登录 */ }
}
