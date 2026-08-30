/**
 * POST /api/track
 * 前台埋点（公开接口）：记录商品浏览 / 点击联系客服
 * body: { product_id: 1, type: 'view' | 'contact' }
 * 前台用"发了就不管"方式调用，失败不影响页面
 */
import { json, readJSON } from '../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await readJSON(request);
  const pid = Number(body.product_id);
  const type = body.type === 'contact' ? 'contact' : 'view';
  if (!pid) return json({ ok: false, msg: '缺少 product_id' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || '';
  await env.DB.prepare('INSERT INTO stats (product_id, type, ip) VALUES (?, ?, ?)')
    .bind(pid, type, ip)
    .run();

  return json({ ok: true });
}
