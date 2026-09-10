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
const CACHE_NAME = 'wnzyq-v56'; // R46：导航页四按钮回退组合居中（图标+文字整组居中），图标/文字调大（桌面 44px/30px、手机 34px/22px） // R45：二维码单击放大复用全站灯箱（导航页弹窗二维码+全站客服二维码；真实img放大后长按识别仍可用） // R44：导航页四按钮居中标准改为「文字居中」——grid 1fr/auto/1fr 三列，文字列严格居中，图标贴文字左侧（非绝对定位） // R43：封面图改内在比例自适应（width/height auto + max宽/高限制）——竖图按最大高缩、横图按最大宽缩，圆角裁在真实图片内容上（旧 16:9 固定框+contain 时圆角只裁背景色、视觉无圆角）；资源页与预览弹窗同步 // R42：全站图/视频统一"不超框+圆角"收尾 // R35：翻页组件两组不拆散（连带修复无限滚动误清组盒按钮）；导航页按钮回退组合居中；手机网格卡片操作按钮裁剪修复
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
