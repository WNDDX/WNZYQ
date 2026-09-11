/**
 * POST /api/unlock   公开接口：资源码验证 + 专属内容解锁（R92 一机一码·宽松模式）
 * body: { productId, variantId, code }
 *
 * 设计（与 R90 方案一致）：
 *   码 = 入场券，只管"第一次"——验证资源码成功后把当前设备绑定到该类型；
 *   绑定 = 通行证，管"以后每一次"——已绑定的设备不再验码，直接返回专属内容。
 *   宽松模式：管理员改码只废旧码的入场资格，已绑定设备不受影响、照常解锁。
 * R96 绑满自动换码：绑定计数按"当前码"周期算（resource_bindings.code 记录绑定时的码）；
 *   当前码绑到上限后系统自动随机换新码——旧码作废、已绑定设备照常解锁，
 *   管理员从后台"绑定设备"弹窗拿最新码发给下一个访客，无需手动改码。
 *
 * 设备凭据：HttpOnly Cookie wnzyq_device（服务端随机 32 字节 hex，首次访问时种下，
 * JS 不可见、不被 XSS 读取，与登录会话 wnzyq_token 同一套思路）。
 *
 * 响应：
 *   { ok: true, content, bound }        解锁成功（bound=本次是否新绑定）
 *   { ok: false, need_code: true }      有码且未绑定、请求未携带码（前台显示输入框）
 *   { ok: false, msg: '...' }           验证失败 / 超上限 / 资源不存在等
 *
 * 统计：resource_unlock 埋点仍由前台在内容渲染成功后统一上报（口径不变），本接口不写 stats。
 */
import { json, readJSON, corsHeaders, randomToken, ensureBindingsTable, getSetting } from '../_utils.js';

// 设备 Cookie 名与有效期（10 年，等效永久设备标识）
const DEVICE_COOKIE = 'wnzyq_device';

// R96：随机生成新资源码——8 位大写（验证不区分大小写）
// R98（用户定稿）：不做 0/O/1/I/L 易混淆字符限制，全字符集随机
function genCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

// R96：把类型的资源码换成随机新码（绑满自动换码 / 超额兜底共用）
async function autoRotateCode(env, variantId) {
  const newCode = genCode();
  await env.DB.prepare('UPDATE product_variants SET resource_code = ? WHERE id = ?').bind(newCode, variantId).run();
  return newCode;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const b = await readJSON(request);
  const productId = Number(b.productId) || 0;
  const variantId = Number(b.variantId) || 0;
  const code = String(b.code || '').trim();
  if (!productId || !variantId) {
    return json({ ok: false, msg: '参数错误' }, 400);
  }

  await ensureBindingsTable(env);

  // 1. 查类型 + 校验资源在线显示（下架/隐藏的类型不可解锁）
  const v = await env.DB.prepare(
    `SELECT v.id, v.product_id, v.resource_code, v.resource_content,
            p.is_online, p.is_hidden
     FROM product_variants v JOIN products p ON p.id = v.product_id
     WHERE v.id = ? AND v.product_id = ?`
  ).bind(variantId, productId).first();
  if (!v || !v.is_online || v.is_hidden) {
    return json({ ok: false, msg: '资源不存在或已下架' }, 404);
  }

  const hasCode = !!(v.resource_code && String(v.resource_code).trim());
  const content = String(v.resource_content || '');

  // 2. 设备凭据：读 Cookie，没有则生成并种下（本次请求即生效）
  let extraHeaders = {};
  let device = '';
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const kv = part.trim().split('=');
    if (kv[0] === DEVICE_COOKIE) device = decodeURIComponent(kv.slice(1).join('=') || '');
  }
  if (!device) {
    device = randomToken();
    extraHeaders['Set-Cookie'] = DEVICE_COOKIE + '=' + device + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=315360000';
  }

  // 3. 无码类型：内容直接返回（前台"立即获取"键场景）
  if (!hasCode) {
    if (!content.trim()) return json({ ok: false, msg: '该资源未设置专属内容' }, 400);
    return json({ ok: true, content, bound: false }, 200, extraHeaders);
  }

  // 4. 有码：先查通行证——已绑定设备直接放行（宽松模式，不验码、换码不影响）
  const boundRow = await env.DB.prepare(
    'SELECT id FROM resource_bindings WHERE variant_id = ? AND device_token = ?'
  ).bind(variantId, device).first();
  if (boundRow) {
    // 顺手更新最近访问时间（供后台绑定清单展示）
    try {
      await env.DB.prepare('UPDATE resource_bindings SET last_access = datetime(\'now\') WHERE id = ?').bind(boundRow.id).run();
    } catch (e) { /* 更新失败不影响解锁 */ }
    return json({ ok: true, content, bound: true }, 200, extraHeaders);
  }

  // 5. 未绑定：验码（不区分大小写，沿用前台既有验证口径）
  if (!code) {
    return json({ ok: false, need_code: true }, 200, extraHeaders);
  }
  const correct = String(v.resource_code).trim().toLowerCase();
  if (code.toLowerCase() !== correct) {
    return json({ ok: false, msg: '资源码错误，请检查后重试' }, 200, extraHeaders);
  }

  // 6. 码正确：检查"当前码"周期的绑定上限（R96 按码计数；后台可调，默认 1 台）
  const limitRaw = await getSetting(env, 'resource_bind_limit', '1');
  const limit = Math.max(1, parseInt(limitRaw, 10) || 2);
  const curCode = String(v.resource_code).trim();
  const cnt = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM resource_bindings WHERE variant_id = ? AND code = ?'
  ).bind(variantId, curCode).first();
  if (cnt && cnt.n >= limit) {
    // 兜底场景（如后台调小上限后当前码已超额）：自动换码开新一轮，本次仍拒绝
    try { await autoRotateCode(env, variantId); } catch (e) { /* 换码失败不影响提示 */ }
    return json({ ok: false, msg: '绑定已达上限（' + limit + '台），请联系客服' }, 200, extraHeaders);
  }

  // 7. 绑定本设备（记录当时的码）并返回内容
  const ua = (request.headers.get('User-Agent') || '').slice(0, 200);
  await env.DB.prepare(
    'INSERT INTO resource_bindings (variant_id, product_id, device_token, ua, code) VALUES (?, ?, ?, ?, ?)'
  ).bind(variantId, productId, device, ua, curCode).run();

  // 8. R96 绑满自动换码：本台绑定后当前码周期达到上限 → 系统随机换新码
  //    （旧码入场资格作废、已绑定设备照常解锁；管理员从后台拿最新码给下一个访客）
  if ((cnt ? cnt.n : 0) + 1 >= limit) {
    try { await autoRotateCode(env, variantId); } catch (e) { /* 换码失败不影响本次解锁 */ }
  }
  return json({ ok: true, content, bound: true }, 200, extraHeaders);
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request) });
}
