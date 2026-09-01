/**
 * 万能资源圈 Service Worker
 * 缓存策略：
 *  - 页面导航（index/shop/admin/error）→ 网络优先：每次打开都拿最新版，
 *    后台改动前台立即生效；离线时才回退缓存（无缓存回退到错误页）。
 *  - 图片等静态资源 → 缓存优先 + 后台静默更新：二次访问快，且不阻塞更新。
 *  - /api/ 一律不缓存，始终走网络。
 */
const CACHE_NAME = 'wnzyq-v4';
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

// 激活：清理旧缓存，立即接管页面
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

// 请求拦截
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;            // 只处理 GET
  if (req.url.includes('/api/')) return;       // API 不缓存，走网络

  // 页面导航：网络优先，保证每次拿到最新代码
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          const clone = res.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); })
          );
        }
        return res;
      }).catch(function () {
        // 网络失败：回退本地缓存，缓存也没有则回退错误页
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./error.html');
        });
      })
    );
    return;
  }

  // 静态资源：缓存优先 + 后台静默更新
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
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
      return fetch(req).then(function (res) {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); })
        );
        return res;
      }).catch(function () {
        return Response.error();
      });
    })
  );
});
