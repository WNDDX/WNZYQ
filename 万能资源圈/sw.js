/**
 * 万能资源圈 Service Worker
 * 离线缓存静态资源，提升二次访问速度
 */
const CACHE_NAME = 'wnzyq-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './shop.html',
  './admin.html',
  './error.html',
  './manifest.json',
  './favicon.ico',
  './assets/images/logo.png',
  './assets/images/kefu.png',
  './assets/images/qun.png',
  './assets/images/gzh.png'
];

// 安装：缓存静态资源（单项失败不影响整体，使用逐项缓存避免 all-or-nothing）
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

// 激活：清理旧缓存
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：缓存优先，网络回退
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;            // 只缓存 GET
  if (req.url.includes('/api/')) return;      // API 不缓存，走网络

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        // 命中缓存先返回，后台静默更新（不阻塞用户操作）
        event.waitUntil(
          fetch(req).then(function (res) {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); });
            }
          }).catch(function () {})
        );
        return cached;
      }
      // 未命中走网络并缓存
      return fetch(req).then(function (res) {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); })
        );
        return res;
      }).catch(function () {
        // 导航类请求离线/异常时统一回退到错误页（而非导航页）
        if (req.mode === 'navigate') return caches.match('./error.html');
        return Response.error();
      });
    })
  );
});
