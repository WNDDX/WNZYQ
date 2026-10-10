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
const CACHE_NAME = 'wnzyq-v347'; // v342（10-10 01:15 全量）：管理页预览弹窗修复(绑定弹窗漏闭合标签致预览被吞进隐藏容器)/资源码合并为钥匙图标按键/全站按键文字↔图标自适应/编辑器空按钮/封面缩略图/顶栏自适应/提示条位置 // v341（10-10 00:45 反馈第二批）：手机端顶栏自适应高度(根治重叠)/客服跳转键绿色/公众号讯关闭键宽度恢复/灯箱×纳入统一/编辑器滚动链放开/引用复制反馈加强/提示条跟随顶栏高度 // v340（用户 10-09 23:54 反馈）：①错误页按钮修复(补回jumpTo) ②导航三弹窗统一(客服并入同一组件/去保存二维码/底键恒定) ③×与分享键统一(淡底+图标→hover实色白图标) ④分享确定键恢复蓝 ⑤关闭叉/分享键挂到弹窗本体 ⑥详情秒开(<400ms) ⑦管理页搜索框去括号 ⑧管理页列表修复(野变量h→handle) ⑨趋势图滚动放开 ⑩提示条移到顶部80px ⑪橙色统一#F57C00 ⑫统计卡恒定+手机顶栏防重叠 // v339（用户 10-09 22:45 反馈）：修复条99/100 一刀切副作用——①文字关闭/确定钮（后台取消钮、分享确定、预览关闭等）被误压成32px红圆→改为保留原形状+红色系皮肤；②position:relative 覆盖关闭叉绝对定位→已去掉（弹窗关闭叉回到右上角） // v338（用户 10-09 21:19 复测后扫尾）：条40 列表瘦身+详情按需(id单拉)、条212 网址规范化canonical、条193 绑定表time语义标签、条69 平板档保护、条56/98/173 核实销项 // v337（用户 10-09 20:13 一次性扫尾）：defer/关键CSS内联/错误页精简/懒加载全覆盖/304/轻量总数接口/缓存瘦身/撤销独立通道/批量乐观UI/焦点圈闭/时间统一/上传合并/withAuth/常量集中/视觉令牌收尾 等 // v336（用户 10-09 18:34 批量下单）：圈屋隔离/占位图统一感叹号/价格统一/视觉令牌归并(蓝灰红绿圆角字号)/关闭键统一红色+44热区/遮罩毛玻璃+安全区+100dvh/统计卡折线图手机适配/hover触屏隔离/打印样式/无障碍批(aria-label·scope·skip-link·播报·光晕·对比度)/SEO(noindex·og对齐·结构化数据)/错误页出路/空态出口 等 // v335（用户 10-09 15:33）：小白版前后对比改造——①资源详情弹窗死循环修复（点卡片没反应→正常打开）；②进页加载失败三处静默出口收口+空态改「加载失败，网络开小差了+点我重试」；③公告空内容骨架挂死修复（没公告不再弹空框）；④导航页副标题间距放宽。 // v334（用户 10-09 05:20）：全站代码体检与整理（详见《代码清理与整改报告.html》）——修复 17 处 bug、删除冗余监听/重复实现、轮播与占位图收归公共层、后端安全加固。 // v330（用户 10-09 04:18）：30项交互优化第一批（数字等宽/输入框16px/SVG图标/危险色收敛/热区44px/Esc逐层/就地反馈/骨架比例/空态居中/长按动画/分类定位/卡片分层/工具栏一行/全系统按钮图标/换场变淡/就地重试/统计卡统一/乐观UI/10秒后悔/aria巡检/骨架自动生成/导航页副标题）。 // v329（用户 10-09 01:37）：①恢复导航/错误页四色按钮原大小配色+撤页脚；②命令面板加「搜索中…/搜索失败，请重试」状态小字；③引用复制反馈改文字变绿；④编辑器媒体×统一全站口径；⑤引用复制键抽公共层+预览弹窗绑定同步；⑥管理页分页「共N件」改真实总数；⑦管理页筛选复用资源页预加载逻辑，筛选秒出。
// v321（用户 10-05 23:38）：根因→老板要求弹窗精简3处；修法→①弹窗标题「插入文件或文件夹」→「插入文件」；②删除「文件链接/文件夹链接」手动切换，改为URL自动判断（网盘域名→文件夹卡/文件扩展名→文件卡/默认文件卡）；③编辑器内链接卡加管理员可见类型切换标识（判断错了可一键改）；④上传本地文件按键现状已支持文件+文件夹，无需改动。 // v319（用户 10-05 22:15）：根因→老板4问题（切分类加载/弹窗下拉穿透/登录网络提示/手机列表文字叠封面）；修法→①shop/admin 首屏后台拉齐各分类第一页，切分类直接渲染零等待；②弹窗打开时禁用整页 pull-to-refresh；③登录容错（缓存优先、超时15秒、真失败才弹一次toast）；④390px 列表模式加固 overflow/min-width 防文字溢入封面图。 // v317（用户 10-05 18:40）：根因→老板拍板规则1/2/3/4+优化2/3/4，首屏一趟拿第一页+分类+设置+统计，翻页/切分类/搜索点到才拉+缓存秒出，图片分级列表小图详情原图，第二次进页版本号 unchanged 不重拿；修法→①shop home.js / admin dashboard.js 恢复20条分页首屏只拿第一页；②shop.js fetchRemote / admin.js loadProducts 恢复后端分页+内存缓存秒出；③admin sessionStorage 加 _cacheFormat='v317' 防版本切换混用；④全系统?v=同步升317。// v316（用户 10-05 18:09）：根因→管理页翻页/搜索/筛选每次按页拉取，老板网络一趟2~11秒；修法→CACHE_NAME升v316，管理页dashboard改全量返回+本地分页，全系统?v=同步。// v315（用户 10-05 17:33）：根因→后端分页下每次切分类都发网络请求，老板网络一趟 2~11 秒，每个第一次看的分类都要等；修法→①后端 /api/shop/home 改全量返回（去掉 20 条分页限制），前端切分类/子分类/搜索/翻页全部本地过滤+本地分页切片，零网络零等待。②全站进度条（v312/v314 加的 2px 蓝条）全部删除——老板不要进度条，要「直接出来」的零等待体验。// v312（用户 10-05 15:21）：根因→后端分页下每次切分类都发网络请求，期间旧内容淡出成空白等待；修法→分类/搜索/翻页内存缓存——看过的组合(cid+subCid+kw+page)存内存，再切回来立即渲染零等待，后台静默刷新（stale-while-revalidate）。首次切到新分类/翻页时不淡出清空，保留旧内容+轻量进度条，数据回来再替换。// v311（用户 10-05 14:38）：老板拍板方案C→16处内部滚动区统一加 overscroll-behavior: contain，弹窗/列表/编辑器/表格等滑到头只在自己区域弹、不传到背后页面。 // v309（用户 10-05 13:29）：根因→卡片封面占位符初始CSS object-fit:cover 与 JS后置改写 contain 不一致，导致切换分类时先顶格后居中闪烁；修法→CSS首帧钉死占位符 contain + 全系统删除 JS objectFit='contain' 后置改写，确保初始态=终态。// v305（用户 10-05 02:26）：根因→fetch 默认 credentials 在某些浏览器/边缘环境中丢失 cookie，导致登录后 admin 接口全部 401 数据加载不出来；修法→全系统显式设置 credentials: 'include' + CORS 响应补 Access-Control-Allow-Credentials: true，确保 HttpOnly Cookie 会话链路必通。// v304（用户 10-05 00:09）：骨架屏统一20条+趋势/每日数据图去骨架+弹窗只允许层层关闭 // v302（用户 10-05 00:09）：骨架屏统一20条+趋势/每日数据图去骨架+弹窗只允许层层关闭 // v299（用户 10-04 23:11）：修复 api/shop/home.js 引用层级错误 // v295（用户 10-04 02:52）：分享描述统一+全页面补齐分享按钮和弹窗+logo版本同步 // v294（用户 10-04 02:14）：B功能批升级 // v293（用户 10-04 02:14）：版本升级→CACHE_NAME同步到v293 // R307（用户 09-30）：U5 失败立即停转+10s 自动关、U6/U7 全系统取消视频/图片上传大小限制（前端 30MB 预拦+后端 25/100MB 视频+10MB 图片拒绝全删，KV 25MB 为 Cloudflare 平台硬上限代码无法解除）、U8 统计日期固定北京时间+8、U9 密码 50 字上限、导出 10000 封顶取消、批量 500 上限取消、发码接口 5 条 issues 遗留清理。// R304（用户 09-30 02:00）：图片按页加载全系统 + 小图（缩略图）+ 图标缓存统一 365 天 + 图标版本号随版。// v287：R297 旋转圈视觉居中+间距方向修复。// v286：R295 忙碌态样式统一——全系统加载文案去「…」、__btnBusy 圈插文字后（appendChild）。// v285：R293 恢复「确定中」忙碌态+全系统排查补齐防连点保护。// v284：R292 一分钟节点回归——撤"确定中…"忙碌态+删切回/pageshow 非一分钟同步触发+编辑期间弹窗保护 // v283：R291 实时同步轮询首分钟盲区修复——初始基线用页面当前显示值 // v282：R289 数据加载架构重构——进页预载+页内零加载+实时同步→没变不重画（表格 DOM 节点引用不变）、有变化才重渲染；④loadStats silent 路径不铺骨架（R238 保新鲜刷新同修：静默清真行铺骨架会闪且没变的表会停留在骨架态）。与 shop.js R243 条32（visibilitychange/pageshow 60s 门）+ R276（快照 diff 没变不 renderAll）同一套口径。R279（老板 09-28「1.编辑资源封面图选中闪一下；2.封面占位符感叹号不居中；3.管理页顶栏logo/文字偏高+全系统按键高度统一」）：①admin.js selectCoverImage 不再走 renderCoverGallery 全量 innerHTML 重建（点选→所有缩略图 opacity:0→load→1 重走=老板看到的闪一下），改纯选中态：只在现有 .cg-item 上切 .active 类+同步链接输入框/预览，结构性操作（增删/重排/输入/上传）保留重建。②admin.css 弹窗占位图 16:9 撑高规则（height:auto!important+aspect-ratio:16/9+min-height:120px）误命中封面 72px 槽内 data:svg 占位图（实测 68×120 被裁下半截、感叹号偏上不完整），补 .modal-box .cover-gallery .cg-item img[src^=data:svg] 高特异性覆盖（height:100%/aspect-ratio:auto/min-height:0/contain），占位图槽内完整居中。③ui-common.css .view-btn height 40→38px（R182-4 作废）与顶栏咨询客服/分享 .tab 同一基准，列表/网格按键全系统统一 38px，一处改两页生效；shop 顶栏内容行由 40→38 后与 admin 顶栏（logo 38px）内容行等高，老板反馈的管理页 logo/文字偏高 1px（修前实测 admin cy=29 vs shop cy=30）随 ②③ 一并归零拉齐。

/* v336 条8：预缓存只留访客必需——admin.js/admin.css/qrcode 改为运行时按需入缓存（普通访客省约 700KB） */
const STATIC_ASSETS = [
  './',
  './index.html',
  './shop.html',
  './admin.html',
  './error.html',
  './manifest.json',
  './assets/ui-common.css',
  './assets/ui-common.js',
      '/config.js',
  '/favicon.ico',
  './assets/shop.css',
  './assets/shop.js',
    './assets/images/logo.png?v=330',
  './assets/images/kefu.png?v=330',
  './assets/images/qun.png?v=330',
  './assets/images/gzh.png?v=330'
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
