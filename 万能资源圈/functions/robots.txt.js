/**
 * GET /robots.txt —— 爬虫规则（R55：改为动态生成，Sitemap 用请求 host 拼绝对地址）
 *
 * R57：按用户要求四个页面全部允许收录（含管理页），robots 不再 Disallow /admin；
 * /api/ 是数据接口不是页面，抓取无意义，保持禁抓。
 * Sitemap 行带绝对地址（协议要求），host 自动适配部署域名——所有引擎抓 robots.txt
 * 时即可顺着发现 sitemap，无需在robots 里写死域名、也无需逐家提交。
 */
export async function onRequest(context) {
  const origin = new URL(context.request.url).origin;
  const body =
    '# 万能资源圈 robots.txt\n' +
    '# 四个页面全部允许搜索引擎收录；/api/ 为数据接口，禁止抓取\n' +
    'User-agent: *\n' +
    'Disallow: /api/\n' +
    'Sitemap: ' + origin + '/sitemap.xml\n';
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400'
    }
  });
}
