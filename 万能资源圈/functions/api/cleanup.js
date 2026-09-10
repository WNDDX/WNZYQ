/**
 * GET /api/cleanup
 * 定期清理旧数据（由 Cron Trigger 每天触发，或手动调用）
 * 清理内容：
 *   1. stats 表：只保留最近 60 天（R72：为 30 天档环比对比保留上期数据）
 *   2. sessions 表：删除 60 天前的会话（R73 统一）
 *   3. login_attempts 表：删除 60 天前的记录（R73 统一）
 * 全系统统一保留 60 天（R73 用户定稿）：stats / sessions / login_attempts 一律 60 天
 * 需要 header: x-cleanup-token = 环境变量 CLEANUP_TOKEN
 * 安全策略：设置了 CLEANUP_TOKEN 就必须带对 token；
 * 未设置 CLEANUP_TOKEN 时仅允许本地调试（localhost/127.0.0.1）调用，
 * 公网一律拒绝，防止陌生人直接清空统计数据
 */
import { json } from '../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;

  // Token 校验（如果设置了环境变量）
  const expectedToken = env.CLEANUP_TOKEN || '';
  if (expectedToken) {
    const token = request.headers.get('x-cleanup-token') || '';
    if (token !== expectedToken) {
      return json({ ok: false, msg: '未授权' }, 401);
    }
  } else {
    const host = new URL(request.url).hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return json({ ok: false, msg: '未设置 CLEANUP_TOKEN，公网调用已禁用。请在 Cloudflare Pages 环境变量里设置 CLEANUP_TOKEN 后再使用定时清理' }, 401);
    }
  }

  const results = {};

  try {
    // 1. 清理 stats：保留最近 60 天（R72：30→60，让 30 天档「对比上期」有完整上期数据）
    const r1 = await env.DB.prepare(
      `DELETE FROM stats WHERE created_at < datetime('now', '-60 days')`
    ).run();
    results.stats_deleted = r1.meta.changes || 0;

    // 2. 清理 sessions：只保留最近 60 天（R73：全系统统一 60 天保留；含未过期的，过期的也删）
    const r2 = await env.DB.prepare(
      `DELETE FROM sessions WHERE created_at < datetime('now', '-60 days')`
    ).run();
    results.sessions_deleted = r2.meta.changes || 0;

    // 3. 清理 login_attempts：只保留最近 60 天（R73 统一；锁定判断用 locked_until 分钟级时间戳不受影响）
    const r3 = await env.DB.prepare(
      `DELETE FROM login_attempts WHERE last_attempt < datetime('now', '-60 days')`
    ).run();
    results.login_attempts_deleted = r3.meta.changes || 0;

    // 4. R36：图仓孤儿清理——列出存储里全部自有图片/视频，没有任何资源/类型引用的就删掉
    //    （编辑时换图、上传后取消保存等都会留下孤儿；删除资源时已即时清理，这里是兜底）
    //    KV 命名空间 list() 与 R2 list() 返回结构不同，分别兼容；单次最多处理 500 个防超时
    try {
      if (env.IMAGE_BUCKET) {
        const bucket = env.IMAGE_BUCKET;
        const isKV = typeof bucket.getWithMetadata === 'function';
        const allKeys = [];
        for (const prefix of ['images/', 'videos/']) {
          let cursor = null;
          for (let page = 0; page < 5; page++) { // 每个前缀最多翻 5 页
            const res = cursor ? await bucket.list({ prefix, cursor }) : await bucket.list({ prefix });
            const items = isKV ? (res.keys || []).map((k) => k.name) : (res.objects || []).map((o) => o.key);
            allKeys.push(...items);
            const done = isKV ? res.list_complete : !res.truncated;
            if (done || !res.cursor) break;
            cursor = res.cursor;
          }
        }
        if (allKeys.length) {
          const mediaRe = /^(?:images|videos)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(?:png|jpg|jpeg|webp|gif|mp4|webm|mov)$/;
          const valid = allKeys.filter((k) => mediaRe.test(k)).slice(0, 500);
          const orphans = [];
          for (const key of valid) {
            const like = '%' + key + '%';
            const usedBy = await env.DB.prepare(
              `SELECT (SELECT COUNT(*) FROM products WHERE img LIKE ? OR detail LIKE ? OR detail_images LIKE ? OR detail_videos LIKE ?)
                    + (SELECT COUNT(*) FROM product_variants WHERE "desc" LIKE ? OR img LIKE ? OR video LIKE ? OR resource_content LIKE ?) AS n`
            ).bind(like, like, like, like, like, like, like, like).first();
            if (!usedBy || usedBy.n === 0) orphans.push(key);
          }
          if (orphans.length) await Promise.all(orphans.map((k) => env.IMAGE_BUCKET.delete(k)));
          results.orphan_media_scanned = valid.length;
          results.orphan_media_deleted = orphans.length;
        }
      }
    } catch (e) {
      console.error('R36 图仓孤儿清理失败(不影响其它清理):', e);
      results.orphan_media_error = e.message;
    }

    // 5. 统计当前各表行数（用于监控）
    const counts = {};
    for (const table of ['products', 'categories', 'stats', 'sessions', 'login_attempts']) {
      try {
        const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first();
        counts[table] = r ? r.n : 0;
      } catch (e) {
        counts[table] = -1;
      }
    }
    results.current_counts = counts;

    return json({ ok: true, msg: '清理完成', results });
  } catch (err) {
    return json({ ok: false, msg: '清理失败: ' + err.message }, 500);
  }
}
