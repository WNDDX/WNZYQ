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
const CACHE_NAME = 'wnzyq-v172'; // R169（用户 22:28，R168-① 去重口径扩展）：埋点去重从 view 扩展到全部类型——view / contact / resource_unlock 统一按「同设备（IP）+同资源+同类型」1 小时窗口去重（同一设备同一点击 1 小时内只算一次），管理员剔除/北京时区口径不变，R166-⑤⑥ 维持不做 // R168（用户 21:21，R166 建议清单拍板）：数据统计口径三项落地——①总浏览去水：view 埋点按「同设备（IP）+同资源」1 小时窗口去重（不拆 PV/UV，就一个总浏览数）；②管理员自己浏览前台不计入（带管理会话 Cookie 的 /api/track 请求直接跳过）；③时区统一北京时间全系统口径——stats 聚合一律 date/strftime +8 hours 切日切时（一天为北京时间 0-24 点），默认近30天/单日小时档/环比上期同口径，R166 建议第5条（按日汇总表留历史）/第6条（面板口径说明）用户要求只解释不执行 // R167（用户 20:27）：#uiTip 截断文字悬停/点按小框收编至 ui-common.js 全站四页统一（电脑 mouseover 悬停/手机 click 白名单点按，白名单扩前台 .card-title/.card-desc/.shop-name/.variant-tab；定位带 8px 右缘钳制永不越屏；弹窗开合经 syncBodyLock 自动隐藏小框，tab 切换重渲染后脱离文档自动收起；样式移至 ui-common.css z-index 100002）——原 R102「只做后台」口径由用户新指令推翻 // R166：①下拉刷新胶囊改从手机物理顶部滑出——四端 .pull-refresh top 80→0（R161 只改了胶囊锚定容器顶，容器本身还在 top:80px，手机地址栏+80px 让胶囊落在屏幕中上部像"中间出现"；R108 与 toast 同位 80px 口径对本容器作废，toast 不动）②自制下拉显示框同步修复——makeSelectPicker 的 ref 原存 sel.dataset.spRef 会字符串化拿不回（annMode 取消/重开仍显示草稿选中项的根因），改 spRefs Map + syncSelectDisplay() 辅助，三处 annMode 程序化赋值（loadSettings/annDiscard/openAnnBtn）+三处编辑器字体/字号重置同步显示框 // R165：①编辑器媒体跨浏览器修复——contain:paint 裁剪越界绘制（部分内核滚动容器内视频/原生蓝层不裁剪→视频浮出弹窗、蓝层超弹窗、划到顶仍挡屏 1/3，同根因一并修复）+×/选中加 pointerdown 兜底（有些浏览器 touchend/click 合成事件被吞）+自绘选中框 outline（受 contain 裁剪不越界，序列化双保险剥离）②资源码下拉面板右缘钳制（手机长类型名把面板推出屏幕右边界）③uiTip 支持单行截断容器（网格卡片副标题带子元素旧逻辑弹不出，悬停/点按都能看全文）④按键拥挤收敛——桌面网格卡片 gap 12→8、小屏全系统行内小键 padding/字号收一档+按钮组可换行 // R164：回退 R163 的圆角三档（用户拍板不做了）——全站 border-radius 逐行还原 v165 原值（搜索框19/标签18/弹窗14/灰盒10 等全回原样），保留 R163 的按压统一 scale(0.94)（含 logo !important 修复 logoFadeIn forwards 遮蔽） // R163：按键按压动画全站统一 scale(0.94)（仅 :active；hover 0.97/入场动画不动，根因=admin.css 末尾组 0.92 赢过前组 0.94 的双组并存+散落 0.9/0.92/0.93/0.95 异值） // R162：统计两图几何全量统一——柱图网格顶/跨度/间距(37.5k)/柱底/X标签(点对齐+同间隔)/Y数字右缘/灰盒高度(12px上下padding)/悬浮框顶与悬浮竖线范围全部按折线公式同步（原R153只对齐了顶线，间距 45k-9≠37.5k 是灰线与数字间隔不一致的根因）；X标签移出列进独立层 // R160：前后台类型tab长名单行截断省略号+title悬停查看 // R161：下拉刷新胶囊改顶锚定（从手机顶部拉出，第一版口径，高度/阈值不动） // R159：①资源页网格卡片桌面标题取消42px双行预留、紧贴蓝色简介（与手机一致）；②全系统弹窗防裁剪统一——遮罩改 dvh 高度+flex-start 安全居中+overflow-y:auto（手机地址栏可见时 84vh 超可视区导致底部时间框/按钮排永远看不到的根因修复），form 加 8px 底部呼吸空间 // R157：绑满被拦文案升级为「该码绑定设备已满（上限 N 台），请联系客服。注意：换浏览器、无痕模式、清除缓存都会被识别为新设备」（用户指定文案）；R156：时间显示统一转北京时间（D1 datetime('now') 存 UTC，展示层 __utcToLocal 固定 UTC+8 换算）
// R155：复制资源全量化（title 原样/排序照抄/is_hidden 照抄/类型补 title 字段，仅 is_online=隐藏）+编辑器视频×浮层（此前视频无任何删除键）+移动端 tap 视频可选可删（touchend capture 委托，Chromium 移动端 video tap 不派发 click）+×改 rAF 每帧贴合宿主（滚动不再漂移）
// R154：公告保存后取消/×不再残留脏数据（保存即重建备份）+类型列表/码下拉面板金额·码键·绑定键·排序固定槽位跨行对齐（无金额/无码行空占位，窄屏放宽） // R153：统计两图网格顶线/Y轴数字距灰盒上边界距离统一（柱状 barZone 随折线实测同步） // R152：favicon 下条鲸鱼头朝左+肚皮朝上（rotate180）+高清沿用 // R151：图片/视频删除×内缩 12px 与全站弹窗关闭键同口径（完全陷入不出框） // R150：favicon 下条鲸鱼改头朝左（镜像回 R143 构图）+8x 超采样轻锐化更高清 // R147：统计两图数字10px取小+Y轴上边距统一0.44系数+绿键回退(pwd处保蓝)+前台弹窗点外/Esc=丢弃+编辑器视频可删(选中/退格/×键/序列化还原)+分类选择禁选一级'全部'虚拟行 // R146：favicon下方鲸鱼翻转回同向+已解锁内容本地缓存(重开弹窗即时显示)+admin三处金额展示(副标题/下拉面板/类型列表,橙#ff6b35)+下拉刷新展开动画恢复(R135回退) // R145：统计两图数字13px取大统一+悬浮框去封顶恒等+图例同高+全系统绿色清零(改密键/导航四彩/客服跳转键)+公告取消全量恢复+全弹窗关闭=丢弃四通道统一 // R144：编辑器视频兜底卡不可编辑+放大态不随插入操作缩小+资源码键蓝底白字(宽高不变)+无码/绑定键字体颜色对齐编辑键 // R143：favicon 双鲸鱼盘旋（撤销旋转恢复水平、紧贴轮廓、镜像双条、留白按宽高成正方形） // R141：favicon 再减1/3（画布占用63%）+manifest.json 补齐+双闭合标签/死代码清理+弹窗标题统一20px+材质蓝收敛到链接+btn-blue纯色合并 // R140：favicon 鲸鱼旋转 44° 对角占满画布（标签页图标调大）+回退 R138 顶栏 logo 40px（用户点名别动 logo） // R139：资源码下拉面板码/无码项改编辑弹窗类型列表同款 row-btn 按键（替换 R98 胶囊） // R138：分享复制去同步 execCommand（移动端点击卡顿/弹窗不消失根因）+回退 R134 箭头 path+顶栏鲸鱼 logo 调大 40px // R137：CSP 修外链视频图片 ERR_FAILED（SW 放行跨域）+admin 视频兜底卡+复制补全定时与绑定上限+时间选择器顺序+码按键统一 // R136：类型列表资源码/绑定/无码统一 row-btn 按键+绑定弹窗码行同款+设备名 uiTip // R135：悬浮框窄屏不缩小（取大的那个）+下拉刷新入场统一淡入+公告显示频率取消恢复 // R119 修订：视频兜底按键复用资源管理/分类管理行按钮（通栏居中版） // R118：登录/改密码/shop 提示统一 toast 胶囊+登录页灰字删除居中 // R117：R114 transition 回退+定时显示隐藏左右布局+柱悬浮行对齐 // R80：全站 toast 统一为下拉刷新同款蓝胶囊 // R75：折线悬浮框（上期 N）右对齐 // R73：全系统保留统一 60 天（stats/sessions/login_attempts/浏览记录查询） // R72：stats 保留窗口 30→60 天（30天档对比上期有数据） // R71：统计卡内容垂直居中（两状态） // R70：两图高度统一+图例进灰底+开启态用tab淡蓝 // R69：对比键文字=对比上期/显示本期、开启态淡蓝 // R68：柱状图灰底统一+刻度贴柱区+对比键独立于时间档组 // R67：对比上期键复用应用键样式+文字切换（比对上期/只看本期） // R66：悬浮用「咨询客服」全称、柱状图加灰色网格与左侧数字刻度 // R65：对比上期开关按钮 // R64：图例逐系列×逐期单独描述 // R63：sitemap 加回 /error // R62：悬浮时间格式化 // R61：本期/上期图例移到图下方 // R60：环比小字全量百分比（上期0起算↑100%） // R59：恢复错误页404语义+图表悬浮具体数 // R58：环比小字改↑↓百分比、箭头跟随柱高、折线图加上期虚线 // R57b：错误页收录地址修正为 /error // R57：统计环比+收录扩四页 // R56：移除骨架屏 // R55：动态sitemap/robots
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

  // R137（用户 18:14）：跨域请求（外链图片/视频等）不由 SW 接管，直接放行给浏览器加载。
  // 根因：线上 _headers 的 CSP 对所有文件（含 sw.js 本身）生效，SW 里 fetch(跨域请求) 会被
  // SW 脚本自身的 connect-src 'self' 拦下 → 外链视频/图片 net::ERR_FAILED（此前"能看的视频
  // 只显示占位符"即此故）。放行后由页面 CSP 的 img-src/media-src（已允许 https:）直接管控，
  // 同时也不再缓存跨域 opaque 响应（本就不可读、徒增存储与陈旧问题）。
  try { if (new URL(req.url).origin !== self.location.origin) return; } catch (e) { return; }

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
