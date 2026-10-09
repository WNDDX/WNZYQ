/**
 * POST /api/admin/issue-code   发码（R221 复制即换码，需登录）
 * body: { variantId }
 *
 * 后台「资源码」复制键专用：一个动作完成——
 *   当前码记一条 issued（60 天兑换窗口从本次点按起算）
 *   → 立即生成防撞新码写回类型行（面板即时出新码）
 *   → 返回 { issuedCode:刚复制出去的旧码, code:面板新码 }
 * 前端拿到响应后把 issuedCode 复制进剪贴板（复制的就是刚发出的码）。
 */
import { json, requireAuth, readJSON, ensureCodeIssuesTable, ensureVariantColumns, issueCodeForVariant } from '../../_utils.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (auth instanceof Response) return auth;

  const b = await readJSON(request);
  const variantId = Number(b.variantId) || 0;
  if (!variantId) return json({ ok: false, msg: '缺少类型 id' }, 400);

  await ensureVariantColumns(env);
  await ensureCodeIssuesTable(env);

  // v294（用户 10-04 02:14）：182 发码限流——同一类型 3 秒内不可重复发码，防连点多发
  const recent = await env.DB.prepare(
    "SELECT id FROM code_issues WHERE variant_id = ? AND issued_at >= datetime('now','-3 seconds') LIMIT 1"
  ).bind(variantId).first();
  if (recent) {
    return json({ ok: false, msg: '操作太频繁，请稍后再试' }, 429);
  }

  const r = await issueCodeForVariant(env, variantId);
  if (!r.ok) return json({ ok: false, msg: r.msg }, 400);

  // R307（用户 09-30）：发码接口不再返回 issues 最近发码记录（弹窗表数据来自 bindings 全量查询）
  return json({
    ok: true,
    issuedCode: r.issuedCode,
    code: r.code,
  });
}
