/**
 * GET /api/health
 * 健康检查：返回系统就绪状态（配合 install 自动初始化）
 * v301（用户 10-05 00:00）：补回缺失接口，修复管理页进页 404
 */
import { json } from '../_utils.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    // 检查数据库绑定是否生效
    if (!env.DB) {
      return json({ ok: true, ready: false, msg: '数据库绑定未生效' });
    }
    // 检查核心表是否已创建（以 products 表是否存在为标志）
    const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").first();
    const ready = !!tables;
    return json({ ok: true, ready });
  } catch (e) {
    console.error('health check error:', e);
    return json({ ok: true, ready: false, msg: '检查失败' });
  }
}
