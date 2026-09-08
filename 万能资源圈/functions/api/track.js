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
  await env.DB.prepare('INSERT INTO stats (product_id, type, ip) VALUES (?, ?, ?)')
    .bind(pid, type, ip)
    .run();

  return json({ ok: true });
}
