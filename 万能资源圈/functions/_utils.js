/**
 * 共享工具函数（被各个 API 引用）
 */

// 返回 JSON 响应（自动带 CORS 头）
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  });
}

// CORS 头（宽松允许跨域，便于本地调试；鉴权靠 token）
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// OPTIONS 预检请求处理
export function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
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

// 带盐哈希：SHA-256(salt + password)
export async function hashPasswordWithSalt(password, salt) {
  return hashPassword(salt + password);
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
  const auth = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
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
  let detailImages = [];
  let detailVideos = [];
  try { detailImages = JSON.parse(p.detail_images || '[]'); } catch (e) { detailImages = []; }
  try { detailVideos = JSON.parse(p.detail_videos || '[]'); } catch (e) { detailVideos = []; }
  return {
    id: p.id,
    cid: p.cid,
    title: p.title,
    desc: p.desc,
    detail: p.detail,
    img: p.img,
    detailImages: detailImages,   // 详情多图（网络 URL 数组）
    detailVideos: detailVideos,   // 详情多视频（网络 URL 数组）
    contactUrl: p.contact_url,    // 联系客服链接
    price: p.price || 0,           // 价格（0=免费不显示）
    is_online: p.is_online,
    is_hidden: p.is_hidden || 0,   // 1=隐藏（前台不显示）
    schedule_on: p.schedule_on || '',    // 定时上架时间（空=不定时）
    schedule_off: p.schedule_off || '',  // 定时下架时间（空=不定时）
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
    if (!names.includes('resource_code')) await env.DB.exec("ALTER TABLE product_variants ADD COLUMN resource_code TEXT NOT NULL DEFAULT ''");
    if (!names.includes('resource_content')) await env.DB.exec("ALTER TABLE product_variants ADD COLUMN resource_content TEXT NOT NULL DEFAULT ''");
    if (!names.includes('is_hidden')) await env.DB.exec("ALTER TABLE product_variants ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0");
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

// 把数据库行转成资源类型字段
export function cleanVariant(v) {
  return {
    id: v.id,
    productId: v.product_id,
    name: v.name,
    desc: v.desc,
    img: v.img,
    video: v.video,
    contactUrl: v.contact_url,
    price: v.price || 0,            // 类型价格（0=不显示，用资源价格）
    sort: v.sort,
    resourceCode: v.resource_code || '',
    resourceContent: v.resource_content || '',
    isHidden: v.is_hidden || 0,
  };
}
