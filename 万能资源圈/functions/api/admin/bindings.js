/**
 * GET /api/admin/bindings?variant_id=xxx   绑定设备清单（需登录）
 * 响应: { ok, limit, count, list: [{ id, device, ua, created_at, last_access }] }
 *   device 显示为 token 前 12 位 + …（完整 token 不下发，避免被拿到后伪造设备）
 */
import { json, requireAuth, ensureBindingsTable, ensureVariantColumns, getSetting } from '../../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const variantId = Number(url.searchParams.get('variant_id') || 0);
  if (!variantId) return json({ ok: false, msg: '缺少 variant_id' }, 400);
  await ensureBindingsTable(env);
  // R106：确保 product_variants 有 bind_limit 列（老库自动补列）
  await ensureVariantColumns(env);

  // R106：绑定表查询防御——表异常时按空清单返回（弹窗提示"暂无绑定"），不再 500
  let results = [];
  try {
    const r = await env.DB.prepare(
      'SELECT id, device_token, ua, created_at, last_access FROM resource_bindings WHERE variant_id = ? ORDER BY id ASC'
    ).bind(variantId).all();
    results = r.results || [];
  } catch (e) { console.error('R106 绑定清单查询失败（按空降级）:', e && e.message); }

  const limitRaw = await getSetting(env, 'resource_bind_limit', '1');

  // R96：返回当前资源码 + 当前码周期的已绑数（绑满自动换码后管理员从这里拿最新码）
  // R106 防御：列补齐失败时降级去掉 bind_limit 重查（上限按全局设置兜底）
  let vRow = null;
  try {
    vRow = await env.DB.prepare('SELECT resource_code, bind_limit FROM product_variants WHERE id = ?').bind(variantId).first();
  } catch (e) {
    console.error('R106 类型上限查询失败（无 bind_limit 降级重查）:', e && e.message);
    vRow = await env.DB.prepare('SELECT resource_code FROM product_variants WHERE id = ?').bind(variantId).first();
  }
  const curCode = vRow ? String(vRow.resource_code || '').trim() : '';
  // R106：绑定设备上限挪进类型编辑表单——类型自身设置优先，未设置再按全局设置（默认 1）
  const vLimit = vRow ? parseInt(vRow.bind_limit, 10) : NaN;
  const limit = vLimit >= 1 ? vLimit : Math.max(1, parseInt(limitRaw, 10) || 1);
  let curCount = 0;
  if (curCode) {
    try {
      const c = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM resource_bindings WHERE variant_id = ? AND code = ?'
      ).bind(variantId, curCode).first();
      curCount = c ? c.n : 0;
    } catch (e) { /* 计数失败按 0 */ }
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
