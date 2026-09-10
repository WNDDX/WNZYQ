/**
 * POST /api/track
 * 前台埋点（公开接口）：记录资源浏览 / 点击咨询客服
 * body: { product_id: 1, type: 'view' | 'contact' | 'resource_unlock' }
 * 前台用"发了就不管"方式调用，失败不影响页面
 */
import { json, readJSON } from '../_utils.js';

// 允许的埋点类型白名单：不认识的类型一律按 'view' 记录
const VALID_TRACK_TYPES = ['view', 'contact', 'resource_unlock'];

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await readJSON(request);
  const pid = Number(body.product_id);
  const type = VALID_TRACK_TYPES.indexOf(body.type) !== -1 ? body.type : 'view';
  if (!pid) return json({ ok: false, msg: '缺少 product_id' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || '';
  // R30-#10：统计流水属"只增不能自管"的数据——每次埋点顺带删掉 60 天前的旧记录，
  // R72：滚动窗口 30→60 天，保证 30 天档「对比上期」（31~60 天前那段）有真实数据（失败不影响埋点）
  try {
    await env.DB.prepare("DELETE FROM stats WHERE created_at < datetime('now', '-60 days')").run();
  } catch (e) { console.error('统计滚动清理失败(不影响埋点):', e); }
  await env.DB.prepare('INSERT INTO stats (product_id, type, ip) VALUES (?, ?, ?)')
    .bind(pid, type, ip)
    .run();

  return json({ ok: true });
}
