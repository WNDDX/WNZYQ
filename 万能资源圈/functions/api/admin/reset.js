/**
 * POST /api/admin/reset —— 清空测试数据（v545）
 *
 * 老板：要重新测一遍，先把系统里现有的测试资源/分类/统计清干净。
 *
 * 设计原则（怕误删生产数据）：
 *  ① 只有超级管理员能调（sensitive.super）；子账号即使有全部业务权限也调不动。
 *  ② 必须带 body.password === 当前超级管理员密码，密码不对不执行——防手滑、防误触。
 *     （老板 2026-11-19 裁定：原来是手打「清空」两个字，改成输超级管理员密码。）
 *  ③ 只清「业务数据」，**不动账号、不动店铺设置**；公告内容一并清空（属于内容）。
 *  ④ 执行前把每张表删了多少条写进操作日志，事后能查。
 *  ⑤ 图片/视频文件不在这里删——交给「设置 → 系统体检 → 全局清理孤儿文件」，避免这里删库、那里还留着引用。
 */
import { json, requirePerm, readJSON, verifyPassword, audit } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    await (await import('../../_utils.js')).ensureAdminUsers(env);
    /* v674（老板 11-19「权限全放开，但高危项要输管理员密码」）：
       ① 权限从 `sensitive.super` 改为 `danger.clear`——面板可勾、可分配给子账号；
       ② 但密码永远是「超级管理员密码」，不是子账号自己的密码。 */
    const auth = await requirePerm(env, request, 'danger.clear');
    if (auth instanceof Response) return auth;

    const body = await readJSON(request);
    const pwd = String((body && body.password) || '');
    if (!pwd) return json({ ok: false, msg: '请输入超级管理员密码' }, 400);

    /* 老板 2026-11-19：清空是不可逆操作，光敲两个字不够，要验证是本人。
       v674：密码验证对象固定为超级管理员（admins 表），不再按 auth.id 查——
       否则子账号拿到权限后，输自己的密码就能清空全站。 */
    const meRow = await env.DB.prepare('SELECT * FROM admins ORDER BY id LIMIT 1').first();
    if (!meRow) return json({ ok: false, msg: '超级管理员账号不存在' }, 404);
    const pv = await verifyPassword(pwd, meRow);
    if (!pv || !pv.ok) return json({ ok: false, msg: '超级管理员密码不正确' }, 400);

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

    /* 公告 + 客服（二维码、企微链接、群二维码、群链接）都在设置表里。
       v545b（老板：客服二维码也不用留）：这几项一并清空；只留店铺名、Logo、公告弹出频率这类外观配置。 */
    try {
      await env.DB.prepare(
        "UPDATE settings SET value = '' WHERE key IN ('announcement','announcements','contact_qr','contact_url','group_qr','group_url')"
      ).run();
      counts['公告与客服'] = 1;
    } catch (e) { counts['公告与客服'] = -1; }

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
