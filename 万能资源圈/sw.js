/**
 * 万能资源圈 Service Worker
 * 缓存策略：
 *  - 页面导航（index/shop/admin/error）→ 网络优先：每次打开都拿最新版，
 *    后台改动前台立即生效；离线时才回退缓存（无缓存回退到错误页）。
 *  - JS / CSS（业务代码频繁改动）→ 缓存优先 + 后台更新：缓存命中直接返回，不发网络请求；
 *    后台静默 fetch 更新缓存，确保 SW 版本升级时 activate 清旧缓存 + install 重新预缓存。
 *  - 图片等其他静态资源 → 缓存优先 + 后台更新（同 JS/CSS，减少弱网条件下的请求往返）。
 *  - /api/ 一律不缓存，始终走网络。
 *  - 任何非 200、或内容类型为 HTML 的 /assets 响应一律不缓存（防止错误页伪装成脚本/样式）。
 */
// R270（用户 09-27 17:30）：sw 缓存版本升级到 v267（封面图保存链路修复 + 预览弹窗轮播同步）。
// R280（老板 09-28 00:35「1.资源封面图不管是否轮播，固定展示框内宽或高取一维贴框、另一维按比例自适应；2.轮播切换小白点镶进图里不单独隔出；3.轮播 3 秒自动切换、切到最后循环回第一个」）：①shop.css/admin.css 封面固定展示框——单图封面（.modal-cover/.preview-cover）与轮播（.cover-carousel）同口径：框宽随弹窗内容宽（calc(100%-32px)、移动端 -24px）、框高定值 min(48vh,400px)，object-fit:contain 不裁不变形、一维贴框另一维按比例居中；占位/加载失败/加载中三态同尺寸（高特异性规则顶掉弹窗 16:9 占位通配），shop.js R258 按比例内联定型补丁与固定框冲突整体退役。②轮播小白点 .cc-dots 改 absolute 镶进展示框内底部居中（半透明黑胶囊底衬 rgba(0,0,0,.35)，任何图上都看得清），不再单独占布局空间。③轮播 3 秒自动切换循环收口——renderCarousel（shop/admin 同源两份）改元素级共享状态 st + 监听只绑一次（__ccBound，反复开关弹窗不再累积监听器），goToSlide 取模循环（自动/手动/拖动切到最后都回第一张）且任一切换后从头计 3 秒；弹窗关闭必停表——shop closeModal() 与 admin 预览三条关闭路径（×钮/底部关闭键/点遮罩）统一调 __ccPause/__stopPreviewCarousel，关了弹窗不再后台换图。
// R295（用户 09-30）：根因→全系统忙碌态样式统一：去省略号+旋转圈放到文字最后（v285→v286）。
// R298（用户 09-30）：根因→去掉每分钟后台对账+60天清理统一每天一次+缓存优先（v287→v288）。
// P2 选 B + P4 合并：完全去掉每分钟后台对账——全系统只在「进入页面或手动刷新」时拉数据。
// P16+P5：60 天清理统一每天一次——纯代码实现，不碰后台定时配置；跨天首访触发，先检查真有旧数据才删。
// P15：缓存优先——JS/CSS/图片一律缓存优先+后台更新，文件没变不重复下载。
// R303（用户 09-30）：P1/P7/P11 翻页按页拉取 + P13 列表 diff 更新 + U3 解锁超时（v288→v289）。
const CACHE_NAME = 'wnzyq-v388'; /* v388：缓存号升版；v387 动效系统（motion.css/js）入列；v384 前 changelog 已归档至 .workbuddy 对账文档 */
// v321 及更早版本改动记录已归档 .workbuddy/交互方案/ 与历次对账文档（本文件只保留运行所需代码）

/* v336 条8：预缓存只留访客必需——admin.js/admin.css/qrcode 改为运行时按需入缓存（普通访客省约 700KB） */
/* v349 调整：
   ① 去掉 './admin.html' —— 后台页面约 125KB，却被写进"访客必需"清单，
      等于每个访客第一次进站都要白下载一遍后台页面。后台本来就是运行时按需入缓存。
   ② 补上三个图标（192/512/苹果）——manifest 和四页都引用，之前没预缓存，
      断网或"装到桌面"时图标会裂。
   ③ 路径写法统一成 './'（原来 /config.js 与 /favicon.ico 用绝对路径，可能缓存成两份）。 */
const STATIC_ASSETS = [
  './index.html', /* v356 条24：去掉 './'——与 index.html 同一文件，原清单会拉两遍存两份 */
  './shop.html',
  './error.html',
  './manifest.json',
  './config.js',
  './favicon.ico',
  './assets/ui-common.css',
  './assets/ui-common.js',
  './assets/motion.css',
  './assets/motion.js',
  './assets/shop.css',
  './assets/shop.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/images/logo.png?v=330'
  /* v383：kefu/qun/gzh.png 三张二维码移出预缓存并删除文件——二维码改走后台「设置信息」（/img/ 动态地址，访客端按需加载） */
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

  // R298：JS / CSS / 图片 / 其它静态资源 → 缓存优先 + 后台更新
  // 缓存命中直接返回，不发网络请求；后台静默 fetch 并更新缓存。
  // SW 版本升级时 activate 清旧缓存 + install 重新预缓存，确保代码/图片更新必生效。
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (isCacheable(req, res)) event.waitUntil(putCache(req, res));
        return res;
      }).catch(function () { return cached || Response.error(); });
      return cached || network;
    })
  );
});
