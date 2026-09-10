/**
 * GET /sitemap.xml —— 站点地图（R55：标准 Sitemap 协议，全引擎通用）
 *
 * 动态生成：用请求的 host 拼绝对地址，任何部署域名（*.pages.dev / 自定义域名）自动适配，
 * 无需手工配置。Google / Bing / 百度 / 360 / 搜狗 / 神马等引擎均支持本协议。
 * 收录页面：导航页（站点门面）+ 资源页（内容主体）。
 * 不收录：admin（后台，robots 已禁）、error（错误页）、/api/*（接口无内容价值）。
 * 商品无独立 URL（详情是弹窗），故不逐条展开；页内内容变化由 lastmod 日期提示引擎重抓。
 */
export async function onRequest(context) {
  const origin = new URL(context.request.url).origin;
  const today = new Date().toISOString().slice(0, 10);
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url>\n' +
    '    <loc>' + origin + '/</loc>\n' +
    '    <lastmod>' + today + '</lastmod>\n' +
    '    <changefreq>daily</changefreq>\n' +
    '    <priority>1.0</priority>\n' +
    '  </url>\n' +
    '  <url>\n' +
    '    <loc>' + origin + '/shop</loc>\n' +
    '    <lastmod>' + today + '</lastmod>\n' +
    '    <changefreq>daily</changefreq>\n' +
    '    <priority>0.9</priority>\n' +
    '  </url>\n' +
    '</urlset>\n';
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=86400' // 引擎一天内可重复用，减少函数调用
    }
  });
}
