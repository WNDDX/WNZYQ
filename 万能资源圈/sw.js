/**
 * 万能资源圈 Service Worker
 * 缓存策略：
 *  - 页面导航（index/shop/admin/error）→ 网络优先：每次打开都拿最新版，
 *    后台改动前台立即生效；离线时才回退缓存（无缓存回退到错误页）。
 *  - JS / CSS（业务代码频繁改动）→ 网络优先：永远先取最新代码，网络失败才回退缓存，
 *    彻底避免“改了代码但页面一直用旧缓存 / 把错误页 HTML 当脚本缓存”的问题。
 *  - 图片等其他静态资源 → R172 改网络优先 + 失败回缓存（更新后刷新立即见新图，不留旧图标残留）。
 *  - /api/ 一律不缓存，始终走网络。
 *  - 任何非 200、或内容类型为 HTML 的 /assets 响应一律不缓存（防止错误页伪装成脚本/样式）。
 */
const CACHE_NAME = 'wnzyq-v225'; // R225：v224→v225。资源码详情弹窗五项小改：汇总句居中+新文案（已绑定/待绑定/已过期/资源码绑定上限）、空单元格留空不显「—」、码列点击即复制该码（只复制不换码）、390 解绑按钮完整显示、「早期绑定」灰小字保留。上轮 R224：v223→v224。合并表两列合一——删「剩余有效」列，「状态」改名「有效状态」（已绑定绿/剩 N 天蓝/已过期灰，不加粗），表变 7 列。上轮 R223：v222→v223。资源码与绑定合并为一张平铺表（8 列、码信息每行填满、老绑定「早期绑定」、20 条/页分页、弹窗标题「资源码详情」、按键改「资源码」、码面板撤发码小字恢复原样）；上轮 R222=导出文件名杠统一。导出文件名日期时间之间的下划线统一为杠（20260921-1624-数据统计.xls）；上轮 R221=复制即换码+60天兑换窗口+数据导出全面升级。本轮=复制即换码+60天兑换窗口（大改动：code_issues 表、发码/验码/清理全链路）+数据导出全面升级（8 工作表、全居中、文件名「时间-数据统计」）；历史：R220=客服二维码文件名恢复老板标准名

const STATIC_ASSETS = [
  './',
  './index.html',
  './shop.html',
  './admin.html',
  './error.html',
  './manifest.json',
  './favicon.ico?v=224', // R171：带版本绕开浏览器 favicon 硬缓存（刷新闪旧图标根治）
  './assets/ui-common.css',
  './assets/ui-common.js',
  './assets/admin.css',
  './assets/admin.js',
  './assets/shop.css',
  './assets/shop.js',
  './assets/images/logo.png?v=224',
  './assets/images/kefu.png?v=224',
  './assets/images/qun.png?v=224',
  './assets/images/gzh.png?v=224'
];

// 安装：逐项缓存静态资源（单项失败不影响整体）
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(STATIC_ASSETS.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    })
  );
  self.skipWaiting();
});

// 激活：清理全部旧版本缓存，立即接管页面
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// 判断响应是否可缓存：必须 200，且 /assets 下的脚本/样式绝不允许是 HTML（防止缓存错误页）
function isCacheable(req, res) {
  if (!res || res.status !== 200 || res.type === 'opaque') return false;
  var url = (req.url || '').split('?')[0];
  if (/\/assets\//.test(url) || /\.(js|css)($|\?)/.test(url)) {
    var ct = res.headers.get('content-type') || '';
    if (/text\/html/i.test(ct)) return false;
  }
  return true;
}

function putCache(req, res) {
  var clone = res.clone();
  return caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); });
}

// 请求拦截
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;            // 只处理 GET
  if (req.url.includes('/api/')) return;       // API 不缓存，走网络

  // R137（用户 18:14）：跨域请求（外链图片/视频等）不由 SW 接管，直接放行给浏览器加载。
  // 根因：线上 _headers 的 CSP 对所有文件（含 sw.js 本身）生效，SW 里 fetch(跨域请求) 会被
  // SW 脚本自身的 connect-src 'self' 拦下 → 外链视频/图片 net::ERR_FAILED（此前"能看的视频
  // 只显示占位符"即此故）。放行后由页面 CSP 的 img-src/media-src（已允许 https:）直接管控，
  // 同时也不再缓存跨域 opaque 响应（本就不可读、徒增存储与陈旧问题）。
  try { if (new URL(req.url).origin !== self.location.origin) return; } catch (e) { return; }

  var url = req.url.split('?')[0];
  var isCode = /\.(js|css)($|\?)/.test(url);   // JS/CSS：网络优先

  // 一致性保障：SW 版本升级时 activate 会清掉旧缓存，缓存里的 HTML 始终与当前 js/css 同代，不混搭。
  // 页面导航：R215（老板 09-21 实测反馈：加载瞬间闪旧图标，历史复发）根治改版——
  // R34 的「网络竞速 400ms」在弱网/部署冷启动时会让旧缓存 HTML 先赢一帧：整页旧版渲染
  // （含旧 logo/旧图标），网络返回后再由后台更新缓存，下一次刷新才正常——即"旧图标闪现"的根因。
  // 改为严格网络优先：导航永远等网络最新版；仅网络彻底失败（离线）才回缓存秒回（不白屏）。
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) event.waitUntil(putCache(req, res));
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./error.html').then(function (e) { return e || Response.error(); });
        });
      })
    );
    return;
  }

  // JS / CSS：网络优先（代码更新立即生效），网络失败才回退缓存；错误响应绝不缓存
  if (isCode) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (isCacheable(req, res)) event.waitUntil(putCache(req, res));
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || Response.error();
        });
      })
    );
    return;
  }

  // R172（用户 00:26）：图片/图标等静态资源改「网络优先 + 失败/非200回缓存」——
  // 原「缓存优先 + 后台静默更新」在图片更新后：刷新时先返回缓存旧图（旧图标显示一瞬间），
  // 网络新图只写回缓存、要再刷一次才可见，即"图标残留"的根因之一。
  // 与 JS/CSS 同款策略：网络成功立即给新图（配合 _headers 图片改 no-cache 校验）；
  // 网络失败或非 200（部署中间态 404）回退缓存秒回，保住弱网/更新窗口期可用。
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && isCacheable(req, res)) event.waitUntil(putCache(req, res));
      if (res && res.status === 200) return res;
      return caches.match(req).then(function (cached) { return cached || res; });
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        return cached || Response.error();
      });
    })
  );
});
