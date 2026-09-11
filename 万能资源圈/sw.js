/**
 * 万能资源圈 Service Worker
 * 缓存策略：
 *  - 页面导航（index/shop/admin/error）→ 网络优先：每次打开都拿最新版，
 *    后台改动前台立即生效；离线时才回退缓存（无缓存回退到错误页）。
 *  - JS / CSS（业务代码频繁改动）→ 网络优先：永远先取最新代码，网络失败才回退缓存，
 *    彻底避免“改了代码但页面一直用旧缓存 / 把错误页 HTML 当脚本缓存”的问题。
 *  - 图片等其他静态资源 → 缓存优先 + 后台静默更新：二次访问快，且不阻塞更新。
 *  - /api/ 一律不缓存，始终走网络。
 *  - 任何非 200、或内容类型为 HTML 的 /assets 响应一律不缓存（防止错误页伪装成脚本/样式）。
 */
const CACHE_NAME = 'wnzyq-v108'; // R80：全站 toast 统一为下拉刷新同款蓝胶囊 // R75：折线悬浮框（上期 N）右对齐 // R73：全系统保留统一 60 天（stats/sessions/login_attempts/浏览记录查询） // R72：stats 保留窗口 30→60 天（30天档对比上期有数据） // R71：统计卡内容垂直居中（两状态） // R70：两图高度统一+图例进灰底+开启态用tab淡蓝 // R69：对比键文字=对比上期/显示本期、开启态淡蓝 // R68：柱状图灰底统一+刻度贴柱区+对比键独立于时间档组 // R67：对比上期键复用应用键样式+文字切换（比对上期/只看本期） // R66：悬浮用「咨询客服」全称、柱状图加灰色网格与左侧数字刻度 // R65：对比上期开关按钮 // R64：图例逐系列×逐期单独描述 // R63：sitemap 加回 /error // R62：悬浮时间格式化 // R61：本期/上期图例移到图下方 // R60：环比小字全量百分比（上期0起算↑100%） // R59：恢复错误页404语义+图表悬浮具体数 // R58：环比小字改↑↓百分比、箭头跟随柱高、折线图加上期虚线 // R57b：错误页收录地址修正为 /error // R57：统计环比+收录扩四页 // R56：移除骨架屏 // R55：动态sitemap/robots
const STATIC_ASSETS = [
  './',
  './index.html',
  './shop.html',
  './admin.html',
  './error.html',
  './manifest.json',
  './favicon.ico',
  './assets/ui-common.css',
  './assets/ui-common.js',
  './assets/admin.css',
  './assets/admin.js',
  './assets/shop.css',
  './assets/shop.js',
  './assets/images/logo.png',
  './assets/images/kefu.png',
  './assets/images/qun.png',
  './assets/images/gzh.png'
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

  var url = req.url.split('?')[0];
  var isCode = /\.(js|css)($|\?)/.test(url);   // JS/CSS：网络优先

  // 页面导航：R34 网络竞速——有缓存时同时发起网络请求，网络在 400ms 内返回就直接给最新版页面
  // （修复：部署新版后访客刷新先看到旧版页面/旧图标、要再刷一次才更新的问题）；网络慢或失败时
  // 缓存秒回（保住手机跨页不白屏），网络完成后在后台写入缓存供下次使用。
  // 一致性保障：SW 版本升级时 activate 会清掉旧缓存，缓存里的 HTML 始终与当前 js/css 同代，不混搭。
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) event.waitUntil(putCache(req, res));
          return res;
        }).catch(function () { return null; });
        event.waitUntil(network); // 保持 worker 存活至网络请求完成，确保后台缓存更新可靠
        if (!cached) {            // 无缓存（首次访问/刚升级清空）：走网络，失败回错误页
          return network.then(function (res) {
            return res || caches.match('./error.html').then(function (e) { return e || Response.error(); });
          });
        }
        return new Promise(function (resolve) {   // 有缓存：与网络竞速
          var settled = false;
          var timer = setTimeout(function () {
            if (!settled) { settled = true; resolve(cached); }   // 超时：缓存秒回，网络继续后台更新
          }, 400);
          network.then(function (res) {
            if (settled) return;
            settled = true; clearTimeout(timer);
            resolve(res || cached);                // 网络够快：直接给最新版页面（不闪旧版）
          });
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

  // 其他静态资源（图片/图标等）：缓存优先 + 后台静默更新
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        event.waitUntil(
          fetch(req).then(function (res) {
            if (isCacheable(req, res)) return putCache(req, res);
          }).catch(function () {})
        );
        return cached;
      }
      return fetch(req).then(function (res) {
        if (isCacheable(req, res)) event.waitUntil(putCache(req, res));
        return res;
      }).catch(function () {
        return Response.error();
      });
    })
  );
});
