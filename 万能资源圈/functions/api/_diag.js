/**
 * 临时诊断口（用完即删）
 * 目的：数据库查询全挂时，把 D1 的真实报错原文吐出来，避免只能看到「检查失败」这种废话。
 * 访问需带 k 参数，值为下面的常量；不带或不对一律 404。
 */
const K = 'diag-7f3a91c2e5';

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  if (url.searchParams.get('k') !== K) {
    return new Response('Not Found', { status: 404 });
  }
  const out = { binding: !!env.DB, dbname: env.DB && env.DB.databaseName ? env.DB.databaseName : null, steps: [] };
  const run = async (label, sql) => {
    try {
      const r = await env.DB.prepare(sql).all();
      out.steps.push({ label, ok: true, rows: (r.results || []).length });
    } catch (e) {
      out.steps.push({ label, ok: false, err: String(e && e.message || e).slice(0, 300) });
    }
  };
  if (env.DB) {
    await run('select1', 'SELECT 1 AS a');
    await run('tables', "SELECT name FROM sqlite_master WHERE type='table' LIMIT 30");
    await run('count_products', 'SELECT COUNT(*) AS c FROM products');
    await run('count_errors', 'SELECT COUNT(*) AS c FROM error_logs');
    await run('select_settings', 'SELECT key FROM settings LIMIT 3');
  }
  return new Response(JSON.stringify(out, null, 1), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
