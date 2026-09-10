/**
 * GET /robots.txt —— 爬虫规则（R55：改为动态生成，Sitemap 用请求 host 拼绝对地址）
 *
 * 规则沿用原静态版：后台与接口不收录。
 * Sitemap 行带绝对地址（协议要求），host 自动适配部署域名——所有引擎抓 robots.txt
 * 时即可顺着发现 sitemap，无需在robots 里写死域名、也无需逐家提交。
 */
export async function onRequest(context) {
  const origin = new URL(context.request.url).origin;
  const body =
    '# 万能资源圈 robots.txt\n' +
    '# 管理后台与 API 不参与搜索引擎收录\n' +
    'User-agent: *\n' +
    'Disallow: /admin\n' +
    'Disallow: /api/\n' +
    'Sitemap: ' + origin + '/sitemap.xml\n';
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400'
    }
  });
}
