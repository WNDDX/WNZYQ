/**
 * POST /api/admin/issue-code   发码（R221 复制即换码，需登录）
 * body: { variantId }
 *
 * 后台「资源码」复制键专用：一个动作完成——
 *   当前码记一条 issued（60 天兑换窗口从本次点按起算）
 *   → 立即生成防撞新码写回类型行（面板即时出新码）
 *   → 返回 { issuedCode:刚复制出去的旧码, code:面板新码, issues:最近发码记录 }
 * 前端拿到响应后把 issuedCode 复制进剪贴板（复制的就是刚发出的码）。
 */
import { json, requireAuth, readJSON, ensureCodeIssuesTable, ensureVariantColumns, issueCodeForVariant, recentIssues } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const variantId = Number(b.variantId) || 0;
  if (!variantId) return json({ ok: false, msg: '缺少类型 id' }, 400);

  await ensureVariantColumns(env);
  await ensureCodeIssuesTable(env);

  const r = await issueCodeForVariant(env, variantId);
  if (!r.ok) return json({ ok: false, msg: r.msg }, 400);

  return json({
    ok: true,
    issuedCode: r.issuedCode,
    code: r.code,
    issues: await recentIssues(env, variantId, 5),
  });
}
