/**
 * POST /api/admin/reset —— 清空测试数据（v545）
 *
 * 老板：要重新测一遍，先把系统里现有的测试资源/分类/统计清干净。
 *
 * 设计原则（怕误删生产数据）：
 *  ① 只有超级管理员能调（sensitive.super）；子账号即使有全部业务权限也调不动。
 *  ② 必须带 body.confirm === '清空'，少一个字都不执行——防手滑、防误触。
 *  ③ 只清「业务数据」，**不动账号、不动店铺设置**；公告内容一并清空（属于内容）。
 *  ④ 执行前把每张表删了多少条写进操作日志，事后能查。
 *  ⑤ 图片/视频文件不在这里删——交给「设置 → 系统体检 → 全局清理孤儿文件」，避免这里删库、那里还留着引用。
 */
import { json, requirePerm, readJSON, audit } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    await (await import('../../_utils.js')).ensureAdminUsers(env);
    const auth = await requirePerm(env, request, 'sensitive.super');
    if (auth instanceof Response) return auth;

    const body = await readJSON(request);
    if (!body || String(body.confirm || '').trim() !== '清空') {
      return json({ ok: false, msg: '确认口令不对：请在输入框里原样打「清空」两个字' }, 400);
    }

    /* 按依赖顺序删：先明细，后主表 */
    const TABLES = [
      ['product_variants', '资源类型'],
      ['products', '资源'],
      ['categories', '分类'],
      ['stats', '访问统计'],
      ['resource_bindings', '设备绑定'],
      ['code_issues', '发码记录'],
      ['external_goods', '采集到的资源'],
      ['external_platforms', '采集平台'],
      ['audit_log', '操作日志'],
    ];

    const counts = {};
    for (const [t, label] of TABLES) {
      try {
        const r = await env.DB.prepare('DELETE FROM ' + t).run();
        counts[label] = (r && r.meta && typeof r.meta.changes === 'number') ? r.meta.changes : 0;
      } catch (e) {
        counts[label] = -1; /* -1 = 这张表不存在或删失败，不阻断其它表 */
      }
    }

    /* 公告在设置表里（announcements / announcement 两个键），清内容但保留店铺名、客服二维码等 */
    try {
      await env.DB.prepare("UPDATE settings SET value = '' WHERE key IN ('announcement', 'announcements')").run();
      counts['公告'] = 1;
    } catch (e) { counts['公告'] = -1; }

    /* 自增 id 归零，新数据从 1 开始（看着清爽，也便于比对测试结果） */
    for (const t of ['products', 'product_variants', 'categories', 'stats', 'external_goods', 'external_platforms']) {
      try { await env.DB.prepare("DELETE FROM sqlite_sequence WHERE name = ?").bind(t).run(); } catch (e) {}
    }

    try { await audit(env, request, '清空测试数据', JSON.stringify(counts)); } catch (e) {}

    /* 公开接口有缓存，清完要让前台立刻看到空 */
    try { await (await import('../../_utils.js')).clearPublicCache(request); } catch (e) {}

    return json({ ok: true, counts });
  } catch (e) {
    return json({ ok: false, msg: '清空失败：' + ((e && e.message) || '未知错误') }, 500);
  }
}
