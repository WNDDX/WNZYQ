/**
 * GET /api/admin/bindings?variant_id=xxx   绑定设备清单（需登录）
 * 响应: { ok, limit, count, list: [{ id, device, ua, created_at, last_access }] }
 *   device 显示为 token 前 12 位 + …（完整 token 不下发，避免被拿到后伪造设备）
 */
import { json, requireAuth, ensureBindingsTable, getSetting } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const variantId = Number(url.searchParams.get('variant_id') || 0);
  if (!variantId) return json({ ok: false, msg: '缺少 variant_id' }, 400);
  await ensureBindingsTable(env);

  const { results } = await env.DB.prepare(
    'SELECT id, device_token, ua, created_at, last_access FROM resource_bindings WHERE variant_id = ? ORDER BY id ASC'
  ).bind(variantId).all();

  const limitRaw = await getSetting(env, 'resource_bind_limit', '1');
  const limit = Math.max(1, parseInt(limitRaw, 10) || 2);

  // R96：返回当前资源码 + 当前码周期的已绑数（绑满自动换码后管理员从这里拿最新码）
  const vRow = await env.DB.prepare('SELECT resource_code FROM product_variants WHERE id = ?').bind(variantId).first();
  const curCode = vRow ? String(vRow.resource_code || '').trim() : '';
  let curCount = 0;
  if (curCode) {
    const c = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM resource_bindings WHERE variant_id = ? AND code = ?'
    ).bind(variantId, curCode).first();
    curCount = c ? c.n : 0;
  }

  return json({
    ok: true,
    limit,
    code: curCode,
    cur_count: curCount,
    count: results.length,
    list: results.map((r) => ({
      id: r.id,
      device: String(r.device_token || '').slice(0, 12) + '…',
      ua: r.ua || '',
      created_at: r.created_at,
      last_access: r.last_access,
    })),
  });
}
