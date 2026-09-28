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
// R270（用户 09-27 17:30）：sw 缓存版本升级到 v267（封面图保存链路修复 + 预览弹窗轮播同步）。
// R280（老板 09-28 00:35「1.资源封面图不管是否轮播，固定展示框内宽或高取一维贴框、另一维按比例自适应；2.轮播切换小白点镶进图里不单独隔出；3.轮播 3 秒自动切换、切到最后循环回第一个」）：①shop.css/admin.css 封面固定展示框——单图封面（.modal-cover/.preview-cover）与轮播（.cover-carousel）同口径：框宽随弹窗内容宽（calc(100%-32px)、移动端 -24px）、框高定值 min(48vh,400px)，object-fit:contain 不裁不变形、一维贴框另一维按比例居中；占位/加载失败/加载中三态同尺寸（高特异性规则顶掉弹窗 16:9 占位通配），shop.js R258 按比例内联定型补丁与固定框冲突整体退役。②轮播小白点 .cc-dots 改 absolute 镶进展示框内底部居中（半透明黑胶囊底衬 rgba(0,0,0,.35)，任何图上都看得清），不再单独占布局空间。③轮播 3 秒自动切换循环收口——renderCarousel（shop/admin 同源两份）改元素级共享状态 st + 监听只绑一次（__ccBound，反复开关弹窗不再累积监听器），goToSlide 取模循环（自动/手动/拖动切到最后都回第一张）且任一切换后从头计 3 秒；弹窗关闭必停表——shop closeModal() 与 admin 预览三条关闭路径（×钮/底部关闭键/点遮罩）统一调 __ccPause/__stopPreviewCarousel，关了弹窗不再后台换图。
const CACHE_NAME = 'wnzyq-v277'; // R279（老板 09-28「1.编辑资源封面图选中闪一下；2.封面占位符感叹号不居中；3.管理页顶栏logo/文字偏高+全系统按键高度统一」）：①admin.js selectCoverImage 不再走 renderCoverGallery 全量 innerHTML 重建（点选→所有缩略图 opacity:0→load→1 重走=老板看到的闪一下），改纯选中态：只在现有 .cg-item 上切 .active 类+同步链接输入框/预览，结构性操作（增删/重排/输入/上传）保留重建。②admin.css 弹窗占位图 16:9 撑高规则（height:auto!important+aspect-ratio:16/9+min-height:120px）误命中封面 72px 槽内 data:svg 占位图（实测 68×120 被裁下半截、感叹号偏上不完整），补 .modal-box .cover-gallery .cg-item img[src^=data:svg] 高特异性覆盖（height:100%/aspect-ratio:auto/min-height:0/contain），占位图槽内完整居中。③ui-common.css .view-btn height 40→38px（R182-4 作废）与顶栏咨询客服/分享 .tab 同一基准，列表/网格按键全系统统一 38px，一处改两页生效；shop 顶栏内容行由 40→38 后与 admin 顶栏（logo 38px）内容行等高，老板反馈的管理页 logo/文字偏高 1px（修前实测 admin cy=29 vs shop cy=30）随 ②③ 一并归零拉齐。

const STATIC_ASSETS = [
  './',
  './index.html',
  './shop.html',
  './admin.html',
  './error.html',
  './manifest.json',
  './assets/ui-common.css',
  './assets/ui-common.js',
  './assets/admin.css',
  './assets/admin.js',
  '/config.js',
  '/favicon.ico',
  './assets/shop.css',
  './assets/shop.js',
  './assets/qrcode.min.js',
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
