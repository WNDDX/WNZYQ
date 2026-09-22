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
const CACHE_NAME = 'wnzyq-v238'; // R238（用户 09-22 17:37 派单）：数据统计 1/7/30 天三档数据预载，点击秒切无加载——admin.js 进 stats tab 即并行预载三档 admin/stats 按天幂等缓存（__statsCache/__prefetchStatsRanges，参考 R114 prefetchBindings 模式），time-btn 点击命中缓存走与请求回来完全相同的渲染路径（__applyStatsRes：六卡+两图+三表全套，零网络等待零转圈骨架整页淡入），随后后台静默刷新保新鲜（loadStats 第 4 参 silent → __silentApplyStats：三表 JSON 比对没变不碰、变了才 R235 onlyKey 口径局部重建）；预载失败静默降级回原每点即拉；自定义日期照旧现场请求（r238-static 全过、r238-verify 19/19：500ms 服务端延迟下点 7/30/1 天 80ms 内已切换零 loading 零整页动画、各档请求数恰为预载+静默各 1 次无多余、降级场景正常渲染零报错、R235 三表翻页不回归、390 手机秒切同过；r235 8/8、r236 7/7、r237 7/7、r234 9/9、r231c 复跑 29/29）。const CACHE_NAME = 'wnzyq-v237'; // R237（用户 09-22 13:10 派单）：修复资源页手动翻页/跳页被无限滚动自动加载拉回——翻页瞬间页面高度骤减、程序性回顶被误判为「滚到底」把刚翻的页瞬间接回（老板看到的「点了没反应」）。shop.js 加 __autoLoadPaused 模块级锁：onPage 回调（翻页/跳页共用入口）置锁，checkScroll 无限滚动分支先判锁——用户主动向下滚动（delta>2）才解锁并顺带判断加载，程序性回顶 delta 为负不会误解锁；「不按按键=下滑自动翻页、按了按键=干净跳到那一页、跳完再下滑自动接页恢复」两种模式互不打架（r237-verify 7/7：末页点上一页 1.5s 后稳定 4/5 单页 20 卡、跳页稳定 2/5、翻页后主动滚底恢复自动加载 3/5、纯下滑 4 次到 5/5 不回归、admin 翻页+跳页零影响；r234 9/9、r235 8/8、r231c 复跑 29/29）。const CACHE_NAME = 'wnzyq-v236'; // R236（用户 09-22 派单）：修复管理页编辑器工具栏字体/字号下拉文字不靠左——admin.css 中 .rte-toolbar .select-picker .cat-picker-display 的 R219 组合居中（justify-content:center + translate 3.5px）改为 flex-start 并删 translate，cpd-text 恢复 flex:1（文字贴左 padding、展开箭头贴右缘原位）；600px 媒体查询内补小屏 picker padding 0 6px 与按钮同档（桌面 10px 全局规则已同）；其他按钮的 R219 墨迹居中补偿不动（r236-static 12/12、r236-verify 7/7：双工具栏×1280/390 四组合文字 inset≤2px、pad 与按钮同档、fontVsBold=1px、箭头左右对称；选字体生效到编辑器内容；r231c 复跑 29/29）。const CACHE_NAME = 'wnzyq-v235'; // R235（用户 09-22 派单）：修复管理页数据统计翻页时三张统计表全部重绘导致画面跳动——admin.js renderStatTables 加 onlyKey 参数（翻页只重绘被点那张表，tbody+pager 重建照旧；其余表元素不销毁、动画不重放），onPage 与兜底 prev/next 回调均传 key；切日期档/切 tab 的 loadStats 无参全量刷新路径不变（r235-static 9/9、r235-verify 8/8：点资源表下一页 MutationObserver 记录 mut={prod:1,cat:0,recent:0}，另两表零变动、DOM 引用保持；反向点最近访问同理；商品列表/R234 句柄/R233 jumpTo 冒烟不回归）。const CACHE_NAME = 'wnzyq-v234'; // R234（用户 09-22 12:11 派单）：修复资源页下滑自动翻页后分页条状态不同步——buildUniPager 暴露 setPage 句柄（ui-common.js），shop.js 无限滚动分支删 R35 时代 .pg-info 手动改文本 workaround、改走句柄同步（页码/跳页输入框/「共X条」尾巴/prev-next disabled 四处全同步；r234-static 14/14、r234-verify 9/9、r231c 复跑 29/29、r233 静态全过）。const CACHE_NAME = 'wnzyq-v233'; // R233（用户 09-22 派单）：补做条13 页面跳转 View Transitions（经核查此前从未落地）——ui-common.js jumpTo 三分支重写（reduced 直接跳 / startViewTransition 转场 / 老浏览器回退 R20 180ms 淡出），index openResource、error 两按钮接入，6 跳转入口收口 jumpTo 单点（r233-static 19/19、r233-verify 14/14、r231c 复跑 29/29）。R232（用户 09-22 11:18）：条9 单条回退——导航页四按钮图标恢复 v230 实心填充风原文（老板验收不通过），

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
