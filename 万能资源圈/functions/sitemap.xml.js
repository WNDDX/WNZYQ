/**
 * /sitemap.xml —— 动态生成（v587 用户 11-09 第 4 条）
 *
 * 为什么改成动态：
 *   原来是一份静态 sitemap.xml，只写了首页和资源页两条，lastmod 还停在 2026-10-10。
 *   现在库里有 19 条资源、9 个分类，搜索引擎一条都看不到——等于没做 SEO。
 *
 * 产出：
 *   /            首页（导航）
 *   /shop        资源列表
 *   /shop?cid=N  每个可见分类
 *   /shop?pid=N  每条在线且未隐藏的资源（带 lastmod）
 *
 * 注意：本文件接管 /sitemap.xml，根目录那份静态 sitemap.xml 必须删掉——
 * Cloudflare Pages 静态资源优先于 Functions，留着它这个文件永远不会被执行。
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const origin = new URL(request.url).origin;

  let products = [], cats = [];
  try {
    const r1 = await env.DB.prepare(
      "SELECT id, updated_at FROM products WHERE is_online = 1 AND COALESCE(is_hidden,0) = 0 AND deleted_at IS NULL ORDER BY id DESC LIMIT 2000"
    ).all();
    products = r1.results || [];
  } catch (e) { products = []; }
  try {
    const r2 = await env.DB.prepare(
      "SELECT id FROM categories WHERE COALESCE(is_hidden,0) = 0 ORDER BY id ASC LIMIT 500"
    ).all();
    cats = r2.results || [];
  } catch (e) { cats = []; }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isoDay = (v) => {
    const t = String(v || '').trim();
    if (!t) return new Date().toISOString().slice(0, 10);
    const d = new Date(t.replace(' ', 'T') + (t.length <= 10 ? 'T00:00:00' : ''));
    return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
  };

  const urls = [];
  urls.push(`  <url><loc>${origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`);
  urls.push(`  <url><loc>${origin}/shop</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`);

  for (const c of cats) {
    urls.push(`  <url><loc>${esc(origin + '/shop?cid=' + encodeURIComponent(c.id))}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  }
  for (const p of products) {
    urls.push(`  <url><loc>${esc(origin + '/shop?pid=' + encodeURIComponent(p.id))}</loc><lastmod>${isoDay(p.updated_at)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') + '\n</urlset>\n';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=3600',
    },
  });
}
