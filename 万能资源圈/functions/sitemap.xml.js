/**
 * GET /sitemap.xml —— 站点地图（R55：标准 Sitemap 协议，全引擎通用）
 *
 * 动态生成：用请求的 host 拼绝对地址，任何部署域名（*.pages.dev / 自定义域名）自动适配，
 * 无需手工配置。Google / Bing / 百度 / 360 / 搜狗 / 神马等引擎均支持本协议。
 * 收录页面：导航页（站点门面）+ 资源页（内容主体）。
 * 不收录：error（错误页，404 语义）、/api/*（接口无内容价值）。admin 已按用户要求放开收录。
 * 商品无独立 URL（详情是弹窗），故不逐条展开；页内内容变化由 lastmod 日期提示引擎重抓。
 */
export async function onRequest(context) {
  const origin = new URL(context.request.url).origin;
  const today = new Date().toISOString().slice(0, 10);
  // R63：收录三个内容页 + 错误页 + 根入口（/、/index、/shop、/admin、/error）；
  // / → 302 → /index，两个地址都列出，引擎自行归一；资源详情是弹窗无独立 URL，不单列。
  // /error 由 [[path]].js 的 PAGES 映射返回 200（可收录）；其它未知路径仍 404+错误页，报错兜底不变。
  const page = (loc, priority, freq) =>
    '  <url>\n    <loc>' + origin + loc + '</loc>\n    <lastmod>' + today + '</lastmod>\n    <changefreq>' + freq + '</changefreq>\n    <priority>' + priority + '</priority>\n  </url>\n';
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    page('/', '1.0', 'daily') +
    page('/index', '0.9', 'daily') +
    page('/shop', '0.9', 'daily') +
    page('/admin', '0.5', 'weekly') +
    page('/error', '0.3', 'yearly') +
    '</urlset>\n';
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}
