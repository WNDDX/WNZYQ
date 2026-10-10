// v336 条52：导航页资源总数专用轻接口（替代拉整页 products，只回一个数字）
import { json } from '../../_utils.js';
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE is_online = 1 AND is_hidden = 0').first();
    const res = json({ ok: true, total: (r && r.n) || 0 });
    /* v348 条29：原 60 秒太长（后台改完前台最多要等一分钟才更新）→ 缩到 10 秒并要求回源确认 */
    res.headers.set('Cache-Control', 'public, max-age=10, must-revalidate');
    return res;
  } catch (e) {
    return json({ ok: false, total: 0, msg: '统计失败' }, 200); /* v346 条85：错误体补 msg，与全站统一 */
  }
}
