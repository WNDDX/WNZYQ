/**
 * 万能资源圈 Service Worker
 * 离线缓存静态资源，提升二次访问速度
 */
const CACHE_NAME = 'wnzyq-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './shop.html',
  './admin.html',
  './404.html',
  './manifest.json',
  './favicon.ico',
  './assets/images/logo.png',
  './assets/images/kefu.png',
  './assets/images/qun.png',
  './assets/images/gzh.png'
];

// 安装：缓存静态资源
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS).catch(function () {});
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
  // 只缓存 GET 请求
  if (req.method !== 'GET') return;
  // API 请求不缓存（走网络）
  if (req.url.includes('/api/')) return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      // 缓存命中，返回缓存，同时后台更新
      if (cached) {
        event.waitUntil(
          fetch(req).then(function (res) {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(function (cache) {
                cache.put(req, clone);
              });
            }
          }).catch(function () {})
        );
        return cached;
      }
      // 缓存未命中，走网络并缓存
      return fetch(req).then(function (res) {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, clone);
          })
        );
        return res;
      }).catch(function () {
        // 网络失败，返回离线页面
        return caches.match('./index.html');
      });
    })
  );
});
