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
const CACHE_NAME = 'wnzyq-v254'; // R257（老板 09-23 19:08）全系统编辑类弹窗「点弹窗外遮罩/Esc 关闭」改暂存未保存编辑、重开恢复到离开时样子并弹「已恢复未保存的编辑」轻提示；弹窗内 ×/取消/放弃键=明确丢弃不变；公告弹窗（annStash：flushAnnEdit 写回 stateAnn.list + curId/annMode 保留，重开 selectAnnItem 回选中+toast）、编辑弹窗（点外 saveDraft 走 __editDrafts 回填）、类型说明（variantDraftPending）、分类（catDraftPending）、客服（contactDraftPending，不清输入框）、密码（不清三框）、资源码弹窗（closeModalStash 复活 __codeDraft 草稿，重开同资源同类型回填）逐个接入 __modalKit stash 通道；纯展示/批量/一次性弹窗（preview/bindings/batchCat/input/confirm）不暂存；R248 页面刷新 localStorage 草稿保护逻辑一字未动，两套并存。 // R258（老板 09-23 19:11+截图）编辑资源弹窗封面图加载前靠左、简介等内容顶上来、加载完才居中撑开跳动——根因 .img-preview display:none 不占位、add .show 才插入流 120px 高度差；修法 updateImgPreview 同步阶段立即 add .show 灰底槽先占座（120×120 钉死尺寸 R171/R229 不变），图探测完成原位填充零跳动；已知坏地址分支同步补 EXC_PLACEHOLDER 失败占位防空灰槽；全系统图片加载排查（throttle 慢加载真机取证）：①admin 编辑弹窗封面预览=老板截图场景实锤（display:none→加载完挤下 126px），已按上修零跳动；②shop 详情封面弹窗 m-loading 16:9 槽（R215 条9）防住了首帧靠左但加载完仍有一次 16:9→真实比例收敛位移（实测 Δy=11px，老板「加载完才撑开位置挤下去」同类），本轮一并修：详情封面与列表卡片同图，点开时卡片已加载，同步读其内在比例把槽定型为与最终显示完全相同的宽高（shop.js loadImg 内 inline !important，双端 max-height 320/220 与 CSS 断点 600 对齐），加载完成零收敛，卡片图未就绪（弱网首开）退回 16:9 槽兜底；③列表 .card-img aspect-ratio 占位、二维码弹窗图 200×200 固定、lightbox 有容器占位——均本有占座无跳动未动。 // R256（老板 09-23 19:04）分享资源二维码弹窗底部按键「再次保存」→「确定」，与分享链接弹窗确定键同款（同 class=share-ok 无内联样式）；点击确定=关闭弹窗，首次保存已在弹窗打开前完成不变 //  // R255（老板 09-23 17:53+17:55）资源码下拉看不见修复+搜索框聚焦灰框去除：①管理页资源管理产品行「资源码」下拉（code-picker）老板反馈「点击后选择框看不见」——根因：code-picker 与通用 makeSelectPicker 不同，此前从未挂 data-picker-id，R247 起 select-picker 面板打开时先被移到 document.body（脱离容器裁剪）再由 positionCatPanel 定位，但 positionCatPanel 内 picker.querySelector 找不到已移走的面板、只能靠 data-picker-id fallback 找，code-picker 没挂 id 两条路都断，面板 position:fixed 无 top/left 落 body 末尾 hypothetical 位置（实测桌面 top=845 贴底、390 端 top=982 整体屏幕外）；修复：code-picker 创建时与面板同挂 data-picker-id（cp-随机串），定位/关闭/重复打开全链路与 makeSelectPicker 同机制接通，面板锚定触发键正下方（实测双端 in viewport）。②管理页+资源页搜索框（含 Ctrl+K 命令面板输入框）点击聚焦后的灰色描边去掉——部分内核（微信 webview 等）文本框点击即命中 :focus-visible，触发 ui-common.css 全站 :focus-visible 兜底 outline；修法：shop.css .search-input / admin.css .admin-search input / ui-common.css .cp-mask .cp-input 三处 :focus 与 :focus-visible 双态显式 outline:none（特异度 0-2-0 压过兜底 0-1-0），只动老板点名的搜索框，其他可交互元素无障碍焦点保留。全系统弹窗/浮层偏移排查：四页全部弹窗下拉浮层逐个双端真机过一遍（admin bindingsMask/editMask/variantMask/catMask/batchCatMask/previewMask/确认框/RTE 浮层下拉/code-picker/分类 makeSelectPicker 下拉、shop 详情/分享/二维码预览/客服/公告/长按菜单/搜索框、index 弹窗、lightbox、toast），位置偏移问题实锤仅 code-picker 一处（已修），其余均居中/锚定正常（r255-verify 双端清单+截图）。 // R254（老板 09-23 17:50）分享弹窗灰字分色：（老板 09-23 17:50）分享弹窗灰字分色：分享资源链接弹窗与分享资源二维码弹窗的灰字「资源名 · 后文」中，资源名改站内链接蓝 #1565c0（与弹窗内链接同色，站内无变量定义沿用同值）、中间分隔圆点「·」改黑色、其余文字保持灰 #888；两种弹窗的「（资源名） ·」与兜底「资源N」都生效，无资源名纯灰字保持整体灰；长按菜单、其他弹窗文字未动（实现：ui-common.js showShareLinkModal tip 分色渲染 + shop.js 二维码预览弹窗灰字分色 span，admin 经共用弹窗自动生效）。 // R252（老板 09-23 15:22）长按菜单补全：①资源页列表卡片封面图长按补齐「分享资源/存二维码」——从所在卡片 data-pid 查 DATA.products（与卡片菜单同款；旧实现传 currentProduct 详情弹窗变量，列表页为空 → 封面图长按只有 2 项，真 bug）②管理页预览弹窗文字长按补绑定（与编辑弹窗同款四项：复制选中/复制全文/分享资源/存二维码；旧版只绑 editMask，预览弹窗文字长按无菜单）；管理页编辑弹窗图/预览弹窗图实测本就 4 项（editingId 经编辑弹窗保持），详情弹窗图/文字也实测 4 项未动。 // R251（老板 09-23 15:20）五项小改动：①分享资源弹窗标题「分享资源」→「分享资源链接」、灰字带资源名「（资源名） · 资源链接已复制到剪贴板」（shop.js modalShareX/长按分享 + admin.js 预览分享/长按分享 + ui-common.js showShareLinkModal 加 tip 参数）②二维码预览弹窗标题→「分享资源二维码」、灰字「（资源名） · 资源二维码已保存到设备」③二维码去 favicon 图标纯白底黑码（__genQrPng 删中心图标+圆形遮罩整段）④保存文件名「资源N-二维码.png」→「（资源名）-二维码.png」（__qrFileName，非法文件字符替换'-'，无名兜底旧格式，再次保存同名）⑤数据统计导出文件名「YYYYMMDD-HHMM-数据统计.xls」→「YYYYMMDD：HHMM-数据统计.xls」（__exportStamp 分隔符改中文冒号，同分钟序号逻辑保留）。 // R250 最终合并轮：R247 编辑器三修 + R248 草稿机制 + R249 长按菜单全站标准化 + 二维码 // R244（用户 09-23 12:25）：解锁失败红字提示本身已含客服引导，R243 条17 加的灰色小字与红字重复且颜色不统一，整套移除（shop.html 元素、shop.css 规则、shop.js 三处引用全删），解锁失败只保留红色错误提示一行，颜色统一红色；服务端 unlock.js 文案一字未动。上一版 v242 R240+R241 合并版：R240 编辑器四修复（rteFocusStay 保焦点屏幕不离光标、RTE 浮层/下拉滚动锚定跟随+滚出自动收、放大工具栏居中去 transform 修 122px 偏移、链接下划线改 <u> 标记驱动按键可加可删）+ R241 弹窗滚动位置按「弹窗 × 对象」独立——切换资源/类型/分类不继承上一对象滚到的位置，同一对象重开恢复原位（打开点统一接管，ui-common.js __modalScroll 公共机制；admin editMask/variantMask/bindingsMask/previewMask/catMask + shop modalMask）。上一轮 R239：全系统统一「滑到底、继续滑、就翻页」——滑到列表最底部（滚不动）后再继续往上滑≈60px 翻到下一页（单页替换不是追加），翻页后回本页开头+屏幕中下方浮「第 N 页 / 共 M 页」胶囊提示 1.5s 消失，最后一页再滑不动浮「已经是最后一页了」，分页条按键两套并存；资源页从无限滚动追加改成单页替换（checkScroll 距底 200px 追加分支整段退役、R237 __autoLoadPaused 锁删除），三处接入：资源页（shop.js 整页滚动）、管理页资源列表（整页滚动）、资源码弹窗（弹窗内部滚动容器 #bindingsScroll）；公共机制 enableEdgeTurn 落 ui-common.js（scroll/wheel/touchmove 三通道统一累计、贴底 ≤8px 起算、>60px 触发、800ms 冷却锁防滚轮惯性连翻、反向回弹清零、桌面滚轮与触屏同判定），浮层样式 .edge-turn-tip 复用 uni-pager 胶囊体系；数据统计三张表不动（保持按键翻页）（r239-static 全过、r239-verify：三处续滑翻页+浮层+回顶、最后一页提示、冷却锁不连翻、触屏回弹不误触、按键/跳页照旧、搜索筛选回第 1 页、资源页翻页后单页 20 卡不累积、r238-verify 19/19 预载秒切不回归、r235/r236/r237/r234/r231c 回归全绿）。const CACHE_NAME = 'wnzyq-v238'; // R238（用户 09-22 17:37 派单）：数据统计 1/7/30 天三档数据预载，点击秒切无加载——admin.js 进 stats tab 即并行预载三档 admin/stats 按天幂等缓存（__statsCache/__prefetchStatsRanges，参考 R114 prefetchBindings 模式），time-btn 点击命中缓存走与请求回来完全相同的渲染路径（__applyStatsRes：六卡+两图+三表全套，零网络等待零转圈骨架整页淡入），随后后台静默刷新保新鲜（loadStats 第 4 参 silent → __silentApplyStats：三表 JSON 比对没变不碰、变了才 R235 onlyKey 口径局部重建）；预载失败静默降级回原每点即拉；自定义日期照旧现场请求（r238-static 全过、r238-verify 19/19：500ms 服务端延迟下点 7/30/1 天 80ms 内已切换零 loading 零整页动画、各档请求数恰为预载+静默各 1 次无多余、降级场景正常渲染零报错、R235 三表翻页不回归、390 手机秒切同过；r235 8/8、r236 7/7、r237 7/7、r234 9/9、r231c 复跑 29/29）。const CACHE_NAME = 'wnzyq-v237'; // R237（用户 09-22 13:10 派单）：修复资源页手动翻页/跳页被无限滚动自动加载拉回——翻页瞬间页面高度骤减、程序性回顶被误判为「滚到底」把刚翻的页瞬间接回（老板看到的「点了没反应」）。shop.js 加 __autoLoadPaused 模块级锁：onPage 回调（翻页/跳页共用入口）置锁，checkScroll 无限滚动分支先判锁——用户主动向下滚动（delta>2）才解锁并顺带判断加载，程序性回顶 delta 为负不会误解锁；「不按按键=下滑自动翻页、按了按键=干净跳到那一页、跳完再下滑自动接页恢复」两种模式互不打架（r237-verify 7/7：末页点上一页 1.5s 后稳定 4/5 单页 20 卡、跳页稳定 2/5、翻页后主动滚底恢复自动加载 3/5、纯下滑 4 次到 5/5 不回归、admin 翻页+跳页零影响；r234 9/9、r235 8/8、r231c 复跑 29/29）。const CACHE_NAME = 'wnzyq-v236'; // R236（用户 09-22 派单）：修复管理页编辑器工具栏字体/字号下拉文字不靠左——admin.css 中 .rte-toolbar .select-picker .cat-picker-display 的 R219 组合居中（justify-content:center + translate 3.5px）改为 flex-start 并删 translate，cpd-text 恢复 flex:1（文字贴左 padding、展开箭头贴右缘原位）；600px 媒体查询内补小屏 picker padding 0 6px 与按钮同档（桌面 10px 全局规则已同）；其他按钮的 R219 墨迹居中补偿不动（r236-static 12/12、r236-verify 7/7：双工具栏×1280/390 四组合文字 inset≤2px、pad 与按钮同档、fontVsBold=1px、箭头左右对称；选字体生效到编辑器内容；r231c 复跑 29/29）。const CACHE_NAME = 'wnzyq-v235'; // R235（用户 09-22 派单）：修复管理页数据统计翻页时三张统计表全部重绘导致画面跳动——admin.js renderStatTables 加 onlyKey 参数（翻页只重绘被点那张表，tbody+pager 重建照旧；其余表元素不销毁、动画不重放），onPage 与兜底 prev/next 回调均传 key；切日期档/切 tab 的 loadStats 无参全量刷新路径不变（r235-static 9/9、r235-verify 8/8：点资源表下一页 MutationObserver 记录 mut={prod:1,cat:0,recent:0}，另两表零变动、DOM 引用保持；反向点最近访问同理；商品列表/R234 句柄/R233 jumpTo 冒烟不回归）。const CACHE_NAME = 'wnzyq-v234'; // R234（用户 09-22 12:11 派单）：修复资源页下滑自动翻页后分页条状态不同步——buildUniPager 暴露 setPage 句柄（ui-common.js），shop.js 无限滚动分支删 R35 时代 .pg-info 手动改文本 workaround、改走句柄同步（页码/跳页输入框/「共X条」尾巴/prev-next disabled 四处全同步；r234-static 14/14、r234-verify 9/9、r231c 复跑 29/29、r233 静态全过）。const CACHE_NAME = 'wnzyq-v233'; // R233（用户 09-22 派单）：补做条13 页面跳转 View Transitions（经核查此前从未落地）——ui-common.js jumpTo 三分支重写（reduced 直接跳 / startViewTransition 转场 / 老浏览器回退 R20 180ms 淡出），index openResource、error 两按钮接入，6 跳转入口收口 jumpTo 单点（r233-static 19/19、r233-verify 14/14、r231c 复跑 29/29）。R232（用户 09-22 11:18）：条9 单条回退——导航页四按钮图标恢复 v230 实心填充风原文（老板验收不通过），

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
