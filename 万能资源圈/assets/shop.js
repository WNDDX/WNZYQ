(function(){
/* v336（条7）：变量圈屋开始 */
    /* ============================================
       资源页逻辑
       ============================================ */

    // ---------- DOM ----------
    var shopLogo = document.getElementById('shopLogo');
    var shopNameEl = document.getElementById('shopName');
    var searchInput = document.getElementById('searchInput');
    var categoryBar = document.getElementById('categoryBar');
    var productGrid = document.getElementById('productGrid');
    var emptyTip = document.getElementById('emptyTip');
    var topContactBtn = document.getElementById('topContact');
    var topShareBtn = document.getElementById('topShare');
    var shareMask = document.getElementById('shareMask');
    var shareLinkText = document.getElementById('shareLinkText');
    var shareClose = document.getElementById('shareClose');

    var modalMask = document.getElementById('modalMask');
    var modalCover = document.getElementById('modalCover');
    var modalTitle = document.getElementById('modalTitle');
    var modalPrice = document.getElementById('modalPrice');
    var modalDesc = document.getElementById('modalDesc');
    var modalDetail = document.getElementById('modalDetail');
    var modalMedia = document.getElementById('modalMedia');
    var variantTabs = document.getElementById('variantTabs');
    var variantDetail = document.getElementById('variantDetail');
    var btnContact = document.getElementById('btnContact');
    var btnCloseModal = document.getElementById('btnCloseModal');
    var modalCloseX = document.getElementById('modalCloseX');
    var modalShareX = document.getElementById('modalShareX');

    // ---------- 状态 ----------
    var DATA = { categories: [], products: [], announcement: '', announcementMode: 'always', announcements: [] };
    var currentCat = 0;
    var currentSubCat = 0;  // 当前选中的二级分类 id，0=该一级分类下全部
    var currentProduct = null;
    var currentVariant = null;
    var usingRemote = false;
    var catIsOverflow = false;    // 一级分类是否超出一行（渲染时判断一次）
    var subCatIsOverflow = false; // 二级分类是否超出一行（渲染时判断一次）
    var catExpanded = false;      // 一级分类是否展开（保存状态，重新渲染后恢复）
    var subCatExpanded = false;   // 二级分类是否展开（保存状态，重新渲染后恢复）

    // v312（用户 10-05 15:21）：根因→后端分页下每次切分类都发网络请求，期间旧内容淡出成空白等待；
    // 修法→分类/搜索/翻页内存缓存——看过的组合(cid+subCid+kw+page)存内存，再切回来立即渲染零等待，后台静默刷新（stale-while-revalidate）。
    // v315（用户 10-05 17:33）：进度条全删——老板不要进度条，要「直接出来」的零等待体验。
    var __pageCache = {};        // key='cid:subCid:kw:page'，value={products,categories,total,totalPages,page,_backendPaged,timestamp}
    var __pageCacheLoading = {};
    var __catsSettingsCached = false; /* v336 条53 */ // key同上，value=Promise（防重复请求）
    function __cacheKey(page, cid, subCid, kw) {
      return (cid || 0) + ':' + (subCid || 0) + ':' + (kw || '') + ':' + (page || 1);
    }

    // R246（用户 09-23 12:33）：分类指示条精确定位——用 getBoundingClientRect 取分数值，
    // width 直设 + transform: translateX/translateY 定位，动画仍走 transform 过渡（合成层不回流）。
    function updateCatIndicator(bar) {
      var ind = bar.querySelector('.cat-slide-ind');
      var act = bar.querySelector('.category-tag.active');
      if (!ind || !act) return;
      var barRect = bar.getBoundingClientRect();
      var actRect = act.getBoundingClientRect();
      ind.style.width = actRect.width + 'px';
      ind.style.transform = 'translateX(' + (actRect.left - barRect.left) + 'px) translateY(' + (actRect.bottom - barRect.top + 2) + 'px)';
    }

    // 弹窗滚动锁（计数器管理，多弹窗叠加时全部关闭才恢复，避免滚轮/滚动失效）
    var __bodyLockCount = 0;
    function setBodyLock(lock) {
      if (window.lockBodyScroll) {
        if (lock) window.lockBodyScroll(true);
        else if (window.syncBodyLock) window.syncBodyLock(); // 关闭时统一重算：还有其他弹窗开着则保持锁定
        else window.lockBodyScroll(false);
        return;
      }
      if (lock) { __bodyLockCount++; } else { __bodyLockCount = Math.max(0, __bodyLockCount - 1); }
      var _locked = __bodyLockCount > 0; document.body.style.overflow = _locked ? 'hidden' : '';
    }

    // 全局默认客服链接（config.js 里配置，没填则按钮隐藏）
    function getDefaultContact() {
      return (typeof SHOP_CONFIG !== 'undefined' && SHOP_CONFIG.defaultContactUrl) || '';
    }

    // ---------- 工具 ----------
    // 图片加载失败占位图（SVG data URL，灰色背景+图片图标）
    /* v336 条9：占位图统一为“感叹号”画风（与公共层一致），全站不再有两种画风 */
    var IMG_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" rx="3" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E';

    // 滚动锁已取消（用户要求恢复自由滚动）：即使 ui-common.js 未加载，也不再拦截 touchmove/wheel
    if (!window.lockBodyScroll) {
      window.lockBodyScroll = function (lock) {
        if (lock) { document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden'; }
        else { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; }
      };
      window.syncBodyLock = function () { window.lockBodyScroll(document.body.style.overflow === 'hidden'); };
    }

    // logo 加载失败兜底：替换为感叹号占位（与全站一致）
    /* v333 整理：原来这里又定义了一遍 window.__logoFail，把 ui-common.js 里的公共版盖掉
       （两份占位图还不一样）。现统一用公共版一份，logo 加载失败的兜底图全站一致
       （下面 121 行原本就调 window.__logoFail，无需改动）。 */
    var __shopFetchInFlight = new Map();
    function __dedupFetch(url, opts) {
      /* v343 条5：改走统一取数据通道（超时/重试/去重/凭证由公共层统一负责），这里保持“返回 Response”语义，调用点零改动 */
      opts = opts || {};
      opts.credentials = opts.credentials || 'include';
      var to = (window.WN_CONST && window.WN_CONST.TIMEOUT) || 10000;
      return window.WNApi.request(url, {
        method: opts.method, credentials: opts.credentials, headers: opts.headers,
        body: opts.body, cache: opts.cache, raw: true, timeout: to
      }).then(function (r) {
        if (r && r._net) throw new Error(r.msg || 'network'); /* 网络失败：抛出，交给调用方原有 catch 处理 */
        return r;
      });
    }
    (function () {
    var _sl = document.getElementById('shopLogo'); if (_sl && _sl.complete && _sl.naturalWidth === 0 && String(_sl.getAttribute('src')).indexOf('data:') !== 0) window.__logoFail(_sl); })();
    // 全局媒体加载失败兜底：任何 IMG/VIDEO 加载失败统一替换为感叹号占位（页面加载即注册，与导航页一致）
    if (!window.__mediaErrOnce) {
      window.__mediaErrOnce = 1;
      document.addEventListener('error', function (e) {
        var t = e.target;
        if (!t || !t.tagName || t.dataset.fh) return;
        if (t.tagName === 'IMG') {
          if (t.dataset.lf) return; /* v345 条3：卡片图由 loadImg 处理回退与占位，这里不插手，避免先闪占位符 */
          t.dataset.fh = '1';
          t.src = IMG_PLACEHOLDER; if (t && t.classList) t.classList.add('media-fail');
          t.style.display = 'block'; t.style.opacity = '1';
        } else if (t.tagName === 'VIDEO') {
          // R81：视频失败不再换感叹号死图，统一兜底卡（可点新窗口打开原链接）
          // R97：无地址不再渲染空卡，直接移除（灰字已全删，无链接卡没有内容）
          t.dataset.fh = '1';
          var _href0 = t.getAttribute('src') || t.currentSrc || '';
          var vf = makeVideoFallback(_href0);
          if (vf && t.parentNode) t.parentNode.replaceChild(vf, t);
          else if (t.parentNode) t.parentNode.removeChild(t);
        }
      }, true);
      document.querySelectorAll('img').forEach(function (im) { if (im.dataset.lf) return; /* v345 条3 */ if (im.complete && im.naturalWidth === 0 && im.getAttribute('src') && im.getAttribute('src').indexOf('data:') !== 0) { im.dataset.fh = '1'; im.src = IMG_PLACEHOLDER; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block'; } });
    }

    // 统一处理富文本内容里的图片/视频加载失败：替换为感叹号占位（全站统一风格，参考导航页）
    function bindMediaFail(root) {
      if (!root) return;
      var imgs = root.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) (function (im) {
        if (im.dataset.fh) return;
        im.addEventListener('error', function () {
          im.onerror = null;
          im.src = IMG_PLACEHOLDER; if (im && im.classList) im.classList.add('media-fail');
          im.style.display = 'block';
        });
        im.addEventListener('load', function () { if (!im.dataset.fh && im.naturalWidth === 0 && String(im.getAttribute('src') || '').indexOf('data:') !== 0) { im.dataset.fh = '1'; im.src = IMG_PLACEHOLDER; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block'; } });
        var _s = im.getAttribute('src') || '';
        if (!_s || _s.indexOf('data:') === 0 || (im.complete && im.naturalWidth === 0)) {
          im.dataset.fh = '1'; im.src = IMG_PLACEHOLDER; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block';
        }
      })(imgs[i]);
      var vids = root.querySelectorAll('video');
      for (var j = 0; j < vids.length; j++) (function (vd) {
        if (vd.dataset.fh) return;
        vd.addEventListener('error', function () {
          // R81：视频加载失败(多为格式/编码不兼容，如 .mov 在 Chrome/安卓上)不再换成感叹号死图，
          // 改为可操作兜底卡——新窗口打开链接，内容不丢失；R97：无链接直接移除（灰字已全删）
          var vf = makeVideoFallback(_vs || (vd.currentSrc || ''));
          if (vf && vd.parentNode) vd.parentNode.replaceChild(vf, vd);
          else if (vd.parentNode) vd.parentNode.removeChild(vd);
        });
        var _vs = vd.getAttribute('src') || '';
        if (!_vs && !vd.querySelector('source')) {
          // R97：无地址视频不再渲染空卡（灰字已全删，无链接卡没有内容），直接移除元素
          vd.dataset.fh = '1';
          if (vd.parentNode) vd.parentNode.removeChild(vd);
        }
      })(vids[j]);
    }

    // v320（用户 10-05 22:37）：客户端文件卡渲染——文件卡点击下载、文件夹卡展开+全部下载、链接文件夹卡打开跳转
    // v320（用户 10-05 22:37）：客户端文件卡渲染 ｜ v351 全面升级：
    // ①管理端控件（删除×/复制/替换/新增文件/补文件夹/类型切换）一律移除，客户绝对看不到
    // ②没传上去的文件（超限/失败）客户不显示
    // ③每个文件行有明确的「下载」键（客户自选下载哪个），文件夹整包「全部下载」保留
    // ④支持多级嵌套文件夹，每一层都能展开/收起（新内容默认收起）
    function bindFileCards(root) {
      if (!root) return;
      /* 管理端控件客户一律移除 */
      root.querySelectorAll('.fc-admin-only, .file-card-del, .file-card-type-toggle, .fremove, .fc-actions').forEach(function (n) {
        if (n.parentNode) n.parentNode.removeChild(n);
      });
      /* 没传上去的文件客户不显示 */
      root.querySelectorAll('.file-folder-item.oversize').forEach(function (row) {
        if (!row.getAttribute('data-key') && row.parentNode) row.parentNode.removeChild(row);
      });
      var fileCards = root.querySelectorAll('.file-card-wrap[data-file-type="file"]');
      fileCards.forEach(function (card) {
        var a = card.querySelector('a[data-dl]');
        if (!a) return;
        card.style.cursor = 'pointer';
        card.addEventListener('click', function (e) {
          if (e.target.closest('button, a, input')) return; /* v336 条162：链接/输入也不冒泡 */
          a.click();
        });
      });
      function fcBindRow(row) {
        var key = row.getAttribute('data-key');
        if (!key) return;
        row.style.cursor = 'pointer';
        row.addEventListener('click', function (e) {
          if (e.target.closest('button, a, input')) return; /* v336 条162 */
          triggerDownload('/files/' + key);
        });
        if (!row.querySelector('.fc-dl')) {
          var dl = document.createElement('button');
          dl.type = 'button'; dl.className = 'fc-dl'; dl.textContent = '下载';
          dl.addEventListener('click', function (e) { e.stopPropagation(); triggerDownload('/files/' + key); });
          row.appendChild(dl);
        }
      }
      /* 递归绑定一个文件夹列表里的所有层级 */
      function fcBindList(list) {
        Array.prototype.forEach.call(list.children, function (child) {
          if (!child.classList || !child.classList.contains('file-folder-item')) return;
          if (child.classList.contains('is-folder')) {
            var head = child.querySelector(':scope > .fc-row-head');
            var kids = child.querySelector(':scope > .file-folder-list');
            if (head && kids) {
              /* v351：展开/收起的蓝色三角由客户端注入（正文里的按键会被安全净化器剥掉，
                 与「全部下载」同一做法）；默认收起=三角朝右，与分类栏同款 */
              if (!head.querySelector('.fc-arrow')) {
                var ar = document.createElement('button');
                ar.type = 'button'; ar.className = 'fc-arrow'; ar.title = '展开/收起';
                ar.setAttribute('aria-label', '展开或收起此文件夹');
                ar.innerHTML = '<svg class="fc-arrow-svg toggle-arrow" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>';
                ar.addEventListener('click', function (e) {
                  e.stopPropagation();
                  var show = kids.style.display === 'none';
                  kids.style.display = show ? 'block' : 'none';
                  ar.querySelector('.fc-arrow-svg').style.transform = show ? 'rotate(0deg)' : 'rotate(-90deg)';
                });
                head.appendChild(ar);
              }
              head.style.cursor = 'pointer';
              head.addEventListener('click', function (e) {
                if (e.target.closest('button, a, input')) return;
                var show = kids.style.display === 'none';
                kids.style.display = show ? 'block' : 'none';
                var arr = head.querySelector('.fc-arrow-svg');
                if (arr) arr.style.transform = show ? 'rotate(0deg)' : 'rotate(-90deg)';
              });
            }
            if (kids) fcBindList(kids);
            return;
          }
          fcBindRow(child);
        });
      }
      var folderCards = root.querySelectorAll('.file-card-wrap[data-file-type="folder"]');
      folderCards.forEach(function (card) {
        var list = card.querySelector('[data-folder-list]');
        var header = card.querySelector('.file-card-header');
        if (list) {
          // 上传型文件夹卡：整卡标题行点击展开/收起
          if (header) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', function (e) {
              if (e.target.closest('button, a, input')) return; /* v336 条162：链接/输入也不冒泡 */
              var show = list.style.display === 'none';
              list.style.display = show ? 'block' : 'none';
              var arrow = header.querySelector('svg[style*="transition"], .fc-arrow-svg');
              if (arrow) arrow.style.transform = show ? 'rotate(180deg)' : '';
            });
          }
          fcBindList(list);
          // 全部下载按钮（不存在时才加）
          if (!card.querySelector('.file-folder-bulk')) {
            var bulk = document.createElement('div');
            bulk.className = 'file-folder-bulk';
            var bulkBtn = document.createElement('button');
            bulkBtn.type = 'button';
            bulkBtn.textContent = '全部下载';
            bulkBtn.addEventListener('click', function () {
              var keys = [];
              list.querySelectorAll('.file-folder-item:not(.is-folder)').forEach(function (row) {
                var k = row.getAttribute('data-key');
                if (k) keys.push(k);
              });
              keys.forEach(function (key, idx) {
                setTimeout(function () { triggerDownload('/files/' + key); }, idx * 300);
              });
            });
            bulk.appendChild(bulkBtn);
            list.appendChild(bulk);
          }
        } else {
          // 链接型文件夹卡：添加「打开」按钮
          if (!card.querySelector('.file-folder-open')) {
            var linkA = card.querySelector('a[data-dl]');
            var url = linkA ? linkA.getAttribute('href') : '';
            if (url) {
              var openWrap = document.createElement('div');
              openWrap.className = 'file-folder-open';
              var openBtn = document.createElement('a');
              openBtn.href = url;
              openBtn.target = '_blank';
              openBtn.rel = 'noopener noreferrer';
              openBtn.textContent = '打开';
              openWrap.appendChild(openBtn);
              card.appendChild(openWrap);
            }
          }
        }
      });
    }

    function triggerDownload(url) {
      var a = document.createElement('a');
      a.href = url;
      a.download = '';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // R81：视频加载失败/无地址的统一兜底卡（全站三处兜底逻辑共用）
    // R97 定稿（用户）：卡内灰字全部删除——只留按键
    // 「点击在新窗口播放视频」，flex column 纵横居中=按键天然上下左右居中；
    // 无链接（含无地址视频）不再渲染空卡，返回 null 由调用方直接移除元素（回 R91 口径）
    function makeVideoFallback(href) {
      var u = href && String(href).trim();
      if (!u) return null;
      var vf = document.createElement('div');
      vf.className = 'video-fallback';
      vf.setAttribute('contenteditable', 'false'); // R144：兜底卡是按键不是可编辑内容（与 admin.js 同步）
      var vl = document.createElement('a');
      vl.className = 'vf-link';
      vl.href = u;
      vl.target = '_blank';
      vl.rel = 'noopener';
      vl.textContent = '点击在新窗口播放视频';
      vf.appendChild(vl);
      return vf;
    }

    /* R304 P18（用户 09-30 02:00 拍板「列表和管理页用小图」）：小图 URL 由原图派生——图仓图片
       （/img/images/…/uuid.ext）的固定小图为同目录 uuid_t.webp（上传封面时前端 canvas 生成、
       与原图同请求一起存储；管理页后台首次访问会自动给存量旧图补生成）。外链图派生不出小图，
       原样返回，读取侧无差别处理。 */
    var thumbOf = function (url) { return window.__thumbOf(url); }; /* v356 条22：合并至公共层唯一源 */

    function loadImg(img, src, fallbackSrc) {
      img.dataset.lf = '1'; /* v345 条3：标记为“由 loadImg 接管”，全局兜底不再抢先换成占位符（避免闪一下） */ /* R304 P18：fallbackSrc=小图加载失败先回退的原图；不传（详情弹窗/轮播走原图）行为与原先完全一致 */
      if (img.getAttribute('src') === src && img.src && img.complete) { img.style.display = 'block'; img.style.opacity = '1'; return; }
      img.decoding = 'async'; img.loading = 'lazy'; /* v336 条48 */ /* R193c ⑩：异步解码——解码不占主线程，列表图多时滑动更跟手 */
      /* R304 P14（用户 09-30 02:00 拍板「按我的思路做，应用到全系统页面，只有翻页才加载翻页后的内容数据」）：
         整条 lazy 退役（R231 条5）——当前页图片全部一起加载，翻到下一页才加载下一页的图片；不做「滚动到附近才加载」 */
      img.onerror = function () {
        /* R304 P18：小图 404（存量旧图还没补到小图）先回退原图，不能空图；原图也失败才走占位符 */
        if (fallbackSrc && this.getAttribute('src') !== fallbackSrc) { this.src = fallbackSrc; return; }
        this.onerror = null; // 防止占位图也加载失败导致死循环
        this.src = IMG_PLACEHOLDER; if (this && this.classList) { this.classList.add('media-fail'); this.classList.remove('m-loading'); } this.style.opacity = '1';
        this.style.display = 'block';
      };
      img.onload = function () { this.style.display = 'block'; this.style.opacity = '1'; if (this.classList) this.classList.remove('m-loading'); this.classList.add('img-in'); }; /* R183 条2：图片入场动画（同二维码 kfQrIn 口径）；R215 条9：摘除居中加载槽 */
      if (img.classList && img.classList.contains('modal-cover')) img.classList.add('m-loading'); /* R215 条9：封面加载期固定 16:9 居中槽，首帧不再靠左 */
      img.style.opacity = '0'; img.src = src || IMG_PLACEHOLDER;
      /* R280（老板 09-28 00:35 ①）：封面改固定展示框（CSS 定宽高 + contain）——框尺寸恒定，
         加载前后布局天然零收敛，R258 按 16:9 加载槽比例内联定型的补丁（与固定框冲突）整体退役。 */
      // R93：封面缺省/加载失败回退感叹号占位（R91 文字版已被用户否决回退）
      if (!src) { img.src = IMG_PLACEHOLDER; if (img && img.classList) { img.classList.add('media-fail'); img.classList.remove('m-loading'); } img.style.display = 'block'; img.style.opacity = '1'; }
      /* R213 P2⑦（质检 R212）：R191 时代的旧媒体回退注释尸体已删（全局兜底已上移至脚本顶部统一注册） */
    }

    // 价格格式化：0 或空返回 ''（免费不显示），整数显示 ¥99，小数显示 ¥99.00

    // HTML 安全过滤：只允许安全标签和属性，移除 script/事件/javascript: 协议
    // 用于资源描述和类型描述，支持 <a href="...">超链接</a>、图片、视频

  // v296（用户 10-04 03:01）：引用块置顶复制按键
  // v327：实现抽到 ui-common.js（window.bindQuoteCopyButtons）——资源页与后台预览弹窗共用同一份，
  // 以后改复制交互只改公共层一处，资源页/预览自动同步（用户要求：预览效果时刻跟上改动）。
  // v335 修：这里原本留了一个同名的转发函数，而且写在了页面脚本的最外层——浏览器会把最外层的
  // 函数声明直接挂到 window 上，把公共层那份真实现覆盖掉，变成“自己调用自己”的死循环。
  // 点开资源详情时页面直接报错（Maximum call stack size exceeded），弹窗功能残缺。
  // 现在整段删掉，页面内直接用公共层那份（调用处写法不变，会自动找到公共实现）。

    function sanitizeHTML(html) { return window.__sanitizeHTML ? window.__sanitizeHTML(html) : ""; } /* v336 条4：转发公共安检 */

    // 数据统计：记录资源浏览/咨询客服/资源码解锁事件，发送到后端
    // 仅在使用远程 API 时记录，本地环境不记录
    function track(pid, type) {
      if (!usingRemote || !pid) return;
      try {
        fetch('/api/track', {
          method: 'POST',
          credentials: 'include', /* v346 条7：补登录凭证——后端靠 Cookie 判定"管理员自己访问不计入统计"，此前漏带导致管理员访问也被计入 */
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: pid, type: type })
        });
      } catch (e) { /* 忽略统计错误，不影响用户体验 */ }
    }

    // ---------- 渲染平台信息 ----------
    // 纯渲染：店铺名优先用线上设置（DATA.shopName，由 fetchRemote 统一拉取），
    // 其次 config.js 兜底。（修复：原先这里单独再请求一次 /api/settings，与 fetchRemote
    // 里的同一个接口重复——每次进页面 settings 被请求两次，浪费流量且两次结果可能不一致）
    function renderShopInfo() {
      var cfg = (typeof SHOP_CONFIG !== 'undefined') ? SHOP_CONFIG : null;
      var name = DATA.shopName || (cfg && cfg.shopName) || '';
      /* R19：默认品牌名（未自定义店铺名）时顶栏显示「万能资源圈・资源」（页面名称统一）；
         自定义过店铺名则尊重自定义值，浏览器标题保持 品牌/店铺名+「・资源」不重复拼接 */
      var isDefault = !name || name === '万能资源圈';
      shopNameEl.textContent = isDefault ? '万能资源圈・资源' : name;
      document.title = (isDefault ? '万能资源圈' : name) + '・资源';
      /* logo 已写死本地 assets/images/logo.png（与管理页同款，解析即加载），不再由 JS 覆盖，避免刷新闪动 */
      /* logo 由 HTML 直接加载显示，失败时全局感叹号占位兜底，JS 不再干预 */
    }

    // ---------- 渲染分类 ----------
    // ---------- 渲染分类（一级） ----------
    // 平台公告渲染（多公告项，管理页设置；为空则不显示）——弹窗形式，顶部小项切换
    // 公告弹窗统一关闭（× / 遮罩 / 确定复用同一逻辑）
    function closeAnnModal() {
      var m = document.getElementById('annModal'); if (m) m.classList.remove('open');
      if (window.setBodyLock) setBodyLock(false);
      window.__annShown = false; window.__annDismissed = true;
      // R256：关闭后重置骨架显示，下次打开时骨架先显示
      var _annSkel = document.getElementById('annSkeleton'); if (_annSkel) _annSkel.style.display = '';
      try { document.querySelectorAll('#annModal video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
    }
    // 默认公告（一级公告）展示：选中"公告"标题，内容渲染到正文区
    function showAnnDefault() {
      var l = DATA.announcements || []; /* v352 修：原读 window.DATA（从未赋值，恒 undefined）→ 点大标题永远静默返回；改用本模块的 DATA */
      var d = l.find(function (x) { return x.level === 1; }) || l[0];
      if (!d) return;
      var bd = document.getElementById('annBody');
      if (bd) { var _c3 = sanitizeHTML(d.content || ''); bd.innerHTML = _c3 || '<div class="ann-empty"><div class="ann-empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" aria-hidden="true"><path d="M12 2 3 6.8v10.4L12 22l9-4.8V6.8L12 2zm7.5 5.3L12 10.9 4.5 7.3 12 3.3l7.5 4zM5 9l6.2 3.3v8.1L5 17.1V9zm8.8 11.4v-8.1L20 9v8.1l-6.2 3.3z"/></svg></div><div class="ann-empty-title">该公告暂无内容</div></div>'; bindMediaFail(bd); bindLightbox(bd);
      bindQuoteCopyButtons(bd); bindFileCards(bd); } // v303 + v320
      var tt = document.getElementById('annTitleTab'); if (tt) tt.classList.add('active');
      document.querySelectorAll('#annTabs .ann-tab').forEach(function (x) { x.classList.remove('active'); });
    }
    // 公告内容渲染（tabs + 默认选中 + 默认内容）：抽出为独立函数，弹窗已打开而数据后到（首次访问先弹窗后接口返回）时也可刷新
    function renderAnnContent() {
      var list = DATA.announcements || [];
      if (!list.some(function (x) { return x.level === 1; })) list = [{ id: 'def', title: '公告', content: DATA.announcement || '', hidden: 0, sort: 0, level: 1 }].concat(list);
      // 渲染小项 tabs（仅多条时显示）
      var tabs = document.getElementById('annTabs');
      if (tabs) {
        tabs.innerHTML = '';
        var subs = list.filter(function (x) { return x.level !== 1; }); if (subs.length) {
          subs.forEach(function (a, i) {
            var t = document.createElement('button');
            t.type = 'button';
            t.className = 'ann-tab';
            t.textContent = a.title || '公告';
            t.addEventListener('click', function () { try {
              if (__annTransitioning) return; /* R243（用户 09-22 23:18）：条37 淡出期间防重复 */
              __annTransitioning = true;
              var ts = document.querySelectorAll('#annTabs .ann-tab');
              ts.forEach(function (x) { x.classList.remove('active'); }); var tt = document.getElementById('annTitleTab'); if (tt) tt.classList.remove('active');
              t.classList.add('active');
              var bd = document.getElementById('annBody');
              if (bd) {
                bd.classList.add('ann-body-fade-out'); /* R243（用户 09-22 23:18）：条37 旧内容淡出 */
                setTimeout(function () {
                  var _c2 = sanitizeHTML(a.content || ''); bd.innerHTML = _c2 || '<div class="ann-empty"><div class="ann-empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" aria-hidden="true"><path d="M12 2 3 6.8v10.4L12 22l9-4.8V6.8L12 2zm7.5 5.3L12 10.9 4.5 7.3 12 3.3l7.5 4zM5 9l6.2 3.3v8.1L5 17.1V9zm8.8 11.4v-8.1L20 9v8.1l-6.2 3.3z"/></svg></div><div class="ann-empty-title">该公告暂无内容</div></div>'; bindMediaFail(bd); bindLightbox(bd);
                  bindQuoteCopyButtons(bd); bindFileCards(bd); // v303 + v320
                  bd.classList.remove('ann-body-fade-out'); /* R243（用户 09-22 23:18）：条37 新内容淡入 */
                  __annTransitioning = false;
                }, 100);
              } else { __annTransitioning = false; }
            } catch (e) { __annTransitioning = false; }
            });
            tabs.appendChild(t);
          });
        }
      }
      // 默认显示第一条（一级公告）并选中"公告"标题
      var body = document.getElementById('annBody');
      var defAnn = list.find(function (x) { return x.level === 1; }) || list[0]; var tt = document.getElementById('annTitleTab'); if (tt) tt.classList.add('active'); if (body) { var _c = sanitizeHTML((defAnn && defAnn.content) || ''); body.innerHTML = _c || '<div class="ann-empty"><div class="ann-empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" aria-hidden="true"><path d="M12 2 3 6.8v10.4L12 22l9-4.8V6.8L12 2zm7.5 5.3L12 10.9 4.5 7.3 12 3.3l7.5 4zM5 9l6.2 3.3v8.1L5 17.1V9zm8.8 11.4v-8.1L20 9v8.1l-6.2 3.3z"/></svg></div><div class="ann-empty-title">该公告暂无内容</div></div>'; bindMediaFail(body); bindLightbox(body);
      bindQuoteCopyButtons(body); bindFileCards(body); } // v303 + v320
    }
    function renderAnnouncement() {
      try { var mask = document.getElementById('annModal');
      if (!mask) return;
      // R256：公告弹窗口径变更——老板 09-26 22:57 拍板：从"没加载好就不弹"改成"先弹骨架窗再填内容"；
      // 加载完发现完全没公告就自动关掉不弹（骨架窗只出现在加载期间）。覆盖 R108 口径。
      var _annSkel = document.getElementById('annSkeleton');
      // 数据未到位时：显示骨架弹窗
      if (!(DATA.announcements || []).length && !String(DATA.announcement || '').trim()) {
        /* v335 修：原来判断的标记（__annDataReady）在全部代码里只读不写、从来没人赋值，
           导致公告一旦为空，弹窗就永远停在灰条骨架上不消失（该关不关）。
           现改用“骨架期”标记——数据到达或加载失败的每个出口都会把它关掉，
           加载一结束就自动走“没内容→关弹窗”，不再挂死。 */
        if (window.__skelPhase) {
          // 还在加载中：显示骨架弹窗
          if (_annSkel) _annSkel.style.display = '';
          mask.classList.add('open');
          if (window.setBodyLock) setBodyLock(true);
          window.__annShown = true;
          return;
        }
        // 加载完确实没内容：关闭弹窗
        mask.classList.remove('open');
        if (_annSkel) _annSkel.style.display = 'none';
        return;
      }
      // 有数据：清除骨架，显示内容
      if (_annSkel) _annSkel.style.display = 'none';
      var mode = DATA.announcementMode || 'always';
      if (window.__annSilent) { window.__annSilent = false; return; } if (window.__annDismissed) return; if (window.__annShown || mask.classList.contains('open')) { if (mode === 'session') { try { if (!sessionStorage.getItem('wnzyq_ann_session')) sessionStorage.setItem('wnzyq_ann_session', '1'); } catch (e) { if (window.__silent) window.__silent(e); } } else if (mode === 'daily') { try { var _td = new Date().toDateString(); if (localStorage.getItem('wnzyq_ann_date') !== _td) localStorage.setItem('wnzyq_ann_date', _td); } catch (e) { if (window.__silent) window.__silent(e); } }
        // 修复（首次开屏）：弹窗已打开但此前数据未到（首访无缓存先弹空窗），接口返回后在此用最新数据刷新 tabs/默认选中/默认内容
        if (mask.classList.contains('open')) renderAnnContent();
        return; }
      var list = DATA.announcements || []; if (!list.some(function (x) { return x.level === 1; })) list = [{ id: 'def', title: '公告', content: DATA.announcement || '', hidden: 0, sort: 0, level: 1 }].concat(list);
      if (!list.length || mode === 'off') { mask.classList.remove('open'); return; }
      if (mode === 'daily') {
        try {
          var today = new Date().toDateString();
          if (localStorage.getItem('wnzyq_ann_date') === today) return;
          localStorage.setItem('wnzyq_ann_date', today);
        } catch (e) { if (window.__silent) window.__silent(e); }
      } else if (mode === 'session') {
        try {
          if (sessionStorage.getItem('wnzyq_ann_session')) return;
          sessionStorage.setItem('wnzyq_ann_session', '1');
        } catch (e) { if (window.__silent) window.__silent(e); }
      }
      window.__annShown = true;
      renderAnnContent();
      mask.classList.add('open');
      setBodyLock(true); } catch (e) { if (window.__silent) window.__silent(e); }
    }
    function renderCategories() {
      var cats = DATA.categories.slice();
      // 确保"全部"在最前面
      if (!cats.find(function (c) { return Number(c.id) === 0; })) {
        cats.unshift({ id: 0, name: '全部', parent_id: 0 });
      }
      // 只显示一级分类（parent_id=0 或没有 parent_id 字段的旧数据）
      var topCats = cats.filter(function (c) { return !c.parent_id || Number(c.parent_id) === 0; });

      categoryBar.innerHTML = '';
      topCats.forEach(function (c) {
        var tag = document.createElement('div');
        tag.className = 'category-tag' + (c.id === currentCat ? ' active' : '');
        tag.textContent = c.name;
        tag.addEventListener('click', function () {
          currentCat = c.id;
          currentSubCat = 0;  // 切换一级分类时重置二级
          currentPage = 1;
          // v294（用户 10-04 02:14）：249 分类筛选存localStorage
          try { if (c.id) localStorage.setItem('wnzyq_shop_category', String(c.id)); else localStorage.removeItem('wnzyq_shop_category'); } catch (e) { if (window.__silent) window.__silent(e); }
          renderCategories();
          __fadeRenderProducts(); /* R243（用户 09-22 23:18）：条15 分类切换统一翻页同款过渡 */
        });
        categoryBar.appendChild(tag);
      });

      // R246（用户 09-23 12:33）：滑动指示条精确定位——紧贴激活按键底缘正下方 2px，
      // 宽度严格一致；用 getBoundingClientRect 取分数值，transform 过渡定位（合成层不回流）。
      var ind = categoryBar.querySelector('.cat-slide-ind');
      var act = categoryBar.querySelector('.category-tag.active');
      if (!ind) {
        ind = document.createElement('div');
        ind.className = 'cat-slide-ind';
        ind.style.transition = 'none';
        categoryBar.appendChild(ind);
      }
      if (act) {
        ind.classList.remove('hidden');
        updateCatIndicator(categoryBar);
        if (ind.style.transition === 'none') {
          requestAnimationFrame(function () { ind.style.transition = ''; });
        }
        /* v330 条13：分类多到要横滑时，把当前分类自动滑到看得见的位置（不再藏在后面） */
        try {
          if (act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        } catch (e0) { if (window.__silent) window.__silent(e0); }
      } else {
        ind.classList.add('hidden');
      }

      // 渲染二级分类栏（选中一级分类且有子分类时显示）
      renderSubCategories();

      // 判断分类是否超出一行（只判断一次，保存状态，避免展开后判断错误导致收不回来）
      setTimeout(function () {
        catIsOverflow = categoryBar.scrollWidth > categoryBar.clientWidth + 5; if (!catIsOverflow) { catExpanded = false; categoryBar.classList.remove('expanded'); catToggle.classList.remove('open'); var ar = catToggle.querySelector('.toggle-arrow'); if (ar) ar.style.transform = 'rotate(-90deg)'; updateCatIndicator(categoryBar); return; }
        // 恢复之前的展开状态
        if (catExpanded) {
          categoryBar.classList.add('expanded');
          catToggle.classList.add('open');
          var arrow = catToggle.querySelector('.toggle-arrow');
          if (arrow) arrow.style.transform = 'rotate(0deg)';
        } else {
          categoryBar.classList.remove('expanded');
          catToggle.classList.remove('open');
          var arrow2 = catToggle.querySelector('.toggle-arrow');
          if (arrow2) arrow2.style.transform = 'rotate(-90deg)';
        }
        // R246（用户 09-23 12:33）：展开/收起状态恢复后指示条重新精确定位（可能换行）
        updateCatIndicator(categoryBar);
      }, 50);
    }

    // ---------- 渲染二级分类 ----------
    function renderSubCategories() {
      var subWrap = document.getElementById('subCatWrap');
      var subBar = document.getElementById('subCategoryBar');
      if (!subWrap || !subBar) return;

      // 选中"全部"或没有选中一级分类时不显示二级栏
      if (currentCat === 0) {
        subWrap.style.display = 'none';
        return;
      }

      // 找该一级分类下的所有二级分类
      var subCats = DATA.categories.filter(function (c) { return Number(c.parent_id) === currentCat; });
      if (subCats.length === 0) {
        subWrap.style.display = 'none';
        return;
      }

      subWrap.style.display = 'block';
      subBar.innerHTML = '';

      // "全部"选项
      var allTag = document.createElement('div');
      allTag.className = 'sub-category-tag' + (currentSubCat === 0 ? ' active' : '');
      allTag.textContent = '全部';
      allTag.addEventListener('click', function () {
        currentSubCat = 0;
        currentPage = 1;
        renderSubCategories();
        __fadeRenderProducts(); /* R243（用户 09-22 23:18）：条15 子分类切换统一翻页同款过渡 */
      });
      subBar.appendChild(allTag);

      // 各二级分类
      subCats.forEach(function (c) {
        var tag = document.createElement('div');
        tag.className = 'sub-category-tag' + (c.id === currentSubCat ? ' active' : '');
        tag.textContent = c.name;
        tag.addEventListener('click', function () {
          currentSubCat = c.id;
          currentPage = 1;
          renderSubCategories();
          __fadeRenderProducts(); /* R243（用户 09-22 23:18）：条15 子分类切换统一翻页同款过渡 */
        });
        subBar.appendChild(tag);
      });

      // R231（用户 09-21 23:38）条20：子分类切换淡入——重建内容后挂 re-in 播 0.15s（keyframes subCatIn 见 shop.css）
      subBar.classList.remove('re-in'); void subBar.offsetWidth; subBar.classList.add('re-in');

      // 判断二级分类是否超出一行（只判断一次，保存状态）
      setTimeout(function () {
        subCatIsOverflow = subBar.scrollWidth > subBar.clientWidth + 5;
        // 恢复之前的展开状态
        if (subCatExpanded) {
          subBar.classList.add('expanded');
          if (subCatToggle) {
            subCatToggle.classList.add('open');
            var arrow = subCatToggle.querySelector('.toggle-arrow');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
          }
        } else {
          subBar.classList.remove('expanded');
          if (subCatToggle) {
            subCatToggle.classList.remove('open');
            var arrow2 = subCatToggle.querySelector('.toggle-arrow');
            if (arrow2) arrow2.style.transform = 'rotate(-90deg)';
          }
        }
      }, 50);
    }

    // P13：比较两个产品对象的关键可见字段是否相同（diff 更新用）
    function __productKeyEqual(a, b) {
      if (!a || !b) return false;
      if (a.id !== b.id) return false;
      return a.title === b.title && a.desc === b.desc && a.img === b.img &&
             a.price === b.price && a.is_online === b.is_online &&
             a.is_hidden === b.is_hidden && a.cid === b.cid && a.sort === b.sort;
    }

    // ---------- 筛选资源（支持两级分类） ----------
    // R303：后端已过滤+分页时直接返回当前页数据；兼容旧缓存/本地数据走前端过滤
    function getFilteredProducts() {
      if (DATA._backendPaged) return DATA.products;
      var kw = searchInput.value.trim().toLowerCase();
      // 找出当前一级分类下的所有二级分类 id（用于一级分类筛选）
      var subCatIds = DATA.categories
        .filter(function (c) { return Number(c.parent_id) === currentCat; })
        .map(function (c) { return Number(c.id); });

      return DATA.products.filter(function (p) {
        if (p.is_online !== true && p.is_online !== 1) return false;
        if (p.is_hidden === true || p.is_hidden === 1) return false;
        // 分类筛选
        if (currentCat !== 0) {
          if (currentSubCat !== 0) {
            // 选中二级分类：只显示该二级分类下的资源
            if (Number(p.cid) !== currentSubCat) return false;
          } else {
            // 只选中一级分类：显示该一级分类及其所有子分类下的资源
            var cid = Number(p.cid);
            if (cid !== currentCat && subCatIds.indexOf(cid) === -1) return false;
          }
        }
        // R49：搜索范围完善——标题 + 描述都匹配（原仅匹配标题）
        if (kw && String(p.title || '').toLowerCase().indexOf(kw) === -1
            && String(p.desc || '').toLowerCase().indexOf(kw) === -1) return false;
        return true;
      });
    }

    // ---------- 渲染资源网格 ----------
    var currentPage = 1;
    var __uniPager = null; /* R234：统一分页条句柄（buildUniPager 返回的 setPage），无限滚动自动翻页后用它同步状态 */
    var __pageTurning = false; /* R231 条19：翻页淡出期间锁，防重复触发 */
    var __variantTransitioning = false; /* R243（用户 09-22 23:18）：条6 类型切换淡出期间锁 */
    var __annTransitioning = false; /* R243（用户 09-22 23:18）：条37 公告切换淡出期间锁 */
    var PAGE_SIZE = 20;
    // v318（用户 10-05 22:06）：根因→翻页/搜索请求飞行期间 __pageTurning=true，防抖新触发被直接丢弃，导致多字输入只搜到第一个字；修法→被锁住时记下最新搜索意图（pending），当前请求 settle 后立刻补发，保证最后一个输入的词一定搜。
    var __pendingSearchOpts = null;
    // v318（用户 10-05 22:06）：命令面板全量数据缓存——v317 首屏只拿第一页 20 条，命令面板用 DATA.products 只能搜到第一页；修法→后台单独拉 page_size=0 全量通道给命令面板用，不影响主列表。
    // v327：声明移至 __loadAllProductsForCmd 处（连同加载状态 __allCmdState）

    // v318（用户 10-05 22:06）：翻页/搜索锁期间被丢弃的意图，在锁释放后立刻补发——保证最后一个输入的词一定搜。
    function __flushPendingSearch() {
      if (!__pendingSearchOpts) return;
      var _opts = __pendingSearchOpts;
      __pendingSearchOpts = null;
      if (_opts.page) __turnToPage(_opts.page);
      else __fadeRenderProducts(_opts.cb);
    }
    /* R239（用户 09-22 派单）：资源页从无限滚动追加改为单页替换（旧 checkScroll 距底 200px 追加分支整段退役）。
       翻页动作收口本函数单点：分页条按键（onPage）走本路径，
       R303：后端分页时翻页才拉对应页数据。
       v312（用户 10-05 15:21）：根因→翻页时旧内容淡出成空白等待；修法→有缓存立即出、无缓存保留旧内容+轻量进度条，数据回来再替换。
       v318（用户 10-05 22:06）：被 __pageTurning 锁住时不直接丢弃，记下 pending，请求 settle 后补发。 */
    function __turnToPage(p) {
      if (p === currentPage || __pageTurning) {
        // v318（用户 10-05 22:06）：翻页锁期间点分页，记下最新页码意图，锁释放后补发
        if (__pageTurning && p !== currentPage) __pendingSearchOpts = { page: p };
        return;
      }
      __pageTurning = true; /* R231 条19：翻页期间防重复 */
      currentPage = p;
      if (usingRemote && DATA._backendPaged) {
        fetchRemote({ page: p }).then(function () {
          renderProducts();
          __pageTurning = false;
          try { window.scrollTo({ top: 0, behavior: 'auto' }) /* v336 条149：翻页瞬时回顶 */; } catch (e) { try { window.scrollTo(0, 0); } catch (e2) { if (window.__silent) window.__silent(e2); } }
          __flushPendingSearch();
        }).catch(function () {
          renderProducts();
          __pageTurning = false;
          try { window.scrollTo({ top: 0, behavior: 'auto' }) /* v336 条149：翻页瞬时回顶 */; } catch (e) { try { window.scrollTo(0, 0); } catch (e2) { if (window.__silent) window.__silent(e2); } }
          __flushPendingSearch();
        });
      } else {
        renderProducts();
        __pageTurning = false;
        try { window.scrollTo({ top: 0, behavior: 'auto' }) /* v336 条149：翻页瞬时回顶 */; } catch (e) { try { window.scrollTo(0, 0); } catch (e2) { if (window.__silent) window.__silent(e2); } }
        __flushPendingSearch();
      }
    }
    /* R243（用户 09-22 23:18）：条15 分类/搜索切换与翻页统一同款过渡
       R303：后端分页时分类/搜索切换重新拉取第1页。
       v312（用户 10-05 15:21）：根因→切分类时旧内容淡出成空白等待；修法→有缓存立即渲染零等待，无缓存保留旧内容+轻量进度条，数据回来再替换。
       v318（用户 10-05 22:06）：被 __pageTurning 锁住时不直接丢弃，记下 pending，请求 settle 后补发。 */
    function __fadeRenderProducts(cb) {
      if (__pageTurning) {
        __pendingSearchOpts = { cb: cb };
        return;
      }
      __pageTurning = true;
      if (cb) cb();
      if (usingRemote && DATA._backendPaged) {
        /* v330 条20：换场反馈——旧内容降到 60% 透明且不可点，明确告诉用户"正在换"，不再像卡住 */
        var _grid = document.getElementById('productGrid');
        var _oldPager = document.getElementById('pager');
        if (_grid) _grid.classList.add('is-switching');
        if (_oldPager) _oldPager.classList.add('is-switching');
        var _clearSwitch = function () {
          if (_grid) _grid.classList.remove('is-switching');
          if (_oldPager) _oldPager.classList.remove('is-switching');
        };
        fetchRemote({
          page: currentPage,
          cid: currentCat,
          subCid: currentSubCat,
          kw: (searchInput.value || '').trim()
        }).then(function () {
          _clearSwitch();
          renderProducts();
          __pageTurning = false;
          __flushPendingSearch();
        }).catch(function () {
          _clearSwitch();
          renderProducts();
          __pageTurning = false;
          __flushPendingSearch();
        });
      } else {
        renderProducts();
        __pageTurning = false;
        __flushPendingSearch();
      }
    }

    // R181（第8项）：资源卡片构造公共函数——分页渲染与无限滚动追加原本各复制一份，
    // 改卡片结构需同步两处易漏改，现合并为这一份（行为与原两份逐字一致）
    /* R192 二④：搜索命中高亮——安全转义后把命中片段包 <mark class="hl">（全站唯一绿淡化底，样式在 ui-common.css） */
    function hlTitle(text, kw) {
      var s = String(text || '');
      if (!kw) return s;
      var esc = function (x) { return x.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
      var lower = s.toLowerCase(), k = kw.toLowerCase(), out = '', i = 0, hit;
      if (!k) return s;
      while ((hit = lower.indexOf(k, i)) !== -1) {
        out += esc(s.slice(i, hit)) + '<mark class="hl">' + esc(s.slice(hit, hit + k.length)) + '</mark>';
        i = hit + k.length;
      }
      return out + esc(s.slice(i));
    }
    function buildProductCard(p) {
      var card = document.createElement('div');
      card.className = 'product-card'; card.setAttribute('role', 'button'); card.tabIndex = 0; /* v336 条176：键盘可打开详情 */
      card.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openModal(p); } });
      card.setAttribute('data-pid', p.id || 0); /* R193 二⑤⑦：长按小菜单取资源用 */
      var img = document.createElement('img');
      img.className = 'card-img';
      img.decoding = 'async'; img.loading = 'lazy'; /* v336 条48 */ /* R193c ⑩：卡片图异步解码 */
      img.alt = p.title || '';
      /* R304 P14：去 lazy——当前页卡片图全部一起加载（老板 09-30 拍板全系统按页加载） */
      var __thumb = thumbOf(p.img), __orig = p.img || '';
      /* v352 遗留3：无封面的资源直接上占位图（原先是空 src → 等报错再换占位图，
         每次渲染都"空白→占位"闪一下，切分类回来又闪）；有封面才走小图/回退逻辑 */
      if (!__orig) {
        img.src = window.WN_MEDIA_FALLBACK || EXC_PLACEHOLDER;
        img.classList.add('media-fail');
      } else {
        loadImg(img, __thumb, __orig); /* R304 P18：列表卡片读小图、小图缺失回退原图；详情弹窗封面/轮播/详情图仍走原图 */
      }
      /* v346 条14：多尺寸——小图给普通屏、原图给高清屏（2x）；手机/大屏各取所需，不再一律同一尺寸 */
      if (__thumb && __orig && __thumb !== __orig) { img.srcset = __thumb + ' 1x, ' + __orig + ' 2x'; img.sizes = '(max-width:600px) 50vw, (max-width:900px) 33vw, 20vw'; }
      var body = document.createElement('div');
      body.className = 'card-body';
      var title = document.createElement('div');
      title.className = 'card-title';
      var __kw = (searchInput && searchInput.value || '').trim();
      /* v348 条34：无搜索词时改用 textContent（原写法把资源标题原样塞进 innerHTML，
         标题里若夹带标签会被当成页面内容执行；hlTitle 分支本身已做转义与高亮，保持不变） */
      if (__kw) title.innerHTML = hlTitle(p.title || '', __kw); /* R192 二④：命中词淡绿高亮 */
      else title.textContent = p.title || '';
      title.title = p.title || ''; // v294：194 标题过长悬停显示完整内容（v343 条16：去掉重复写入）
      var desc = document.createElement('div');
      desc.className = 'card-desc';
      desc.textContent = p.desc || '';
      body.appendChild(title);
      body.appendChild(desc);
      /* v330 条14：卡片信息分层——第三层价格（橙色突出、固定底部行；免费不显示价格行） */
      var _pr = Number(p.price || 0);
      if (_pr > 0) {
        var prow = document.createElement('div');
        prow.className = 'card-price-row';
        var pEl = document.createElement('span');
        pEl.className = 'card-price';
        pEl.textContent = window.formatPrice ? window.formatPrice(_pr) : ('¥' + (String(_pr).indexOf('.') !== -1 ? _pr.toFixed(2) : _pr)); /* v336 条10：统一走公共价格格式 */
        prow.appendChild(pEl);
        body.appendChild(prow);
      }
      card.appendChild(img);
      card.appendChild(body);
      card.addEventListener('click', function () { if (Date.now() - (window.__ctxShownAt || 0) < 300) return; /* v336 条163：长按菜单刚弹出，忽略误触 */ openModal(p); });
      return card;
    }
    function renderProducts() {
      var list = getFilteredProducts();
      /* R193 二① 方案A：骨架期（数据在路上）列表不动——骨架已铺满一页，空态不该抢跑 */
      if (window.__skelPhase && !list.length) { emptyTip.classList.remove('show'); return; }
      var __skels = productGrid.querySelectorAll('.card-skeleton');
      var __reuse = __skels.length > 0; /* 数据首达：骨架逐条渐变成真卡（同位置替换+错峰淡入） */
      var __frag = null; if (!__reuse) { productGrid.innerHTML = ''; __frag = document.createDocumentFragment(); }
      emptyTip.classList.toggle('show', list.length === 0);

      // 移除旧分页
      var oldPager = document.getElementById('pager');
      if (oldPager) oldPager.parentNode.removeChild(oldPager);
      __uniPager = null; /* R234：旧分页已删，句柄随下方重建更新 */

      // 空状态（R124 用户定稿 15:06）：三分支统一只显示标题、副文案全删——
      // 搜索=「该搜索暂无资源」；分类/全部=「该分类暂无资源」
      if (list.length === 0) {
        if (__reuse) productGrid.innerHTML = ''; /* R193 方案A：骨架期结束无数据，清骨架走空态 */
        var emptyTitle = document.getElementById('emptyTitle');
        var kw = searchInput.value.trim();
        /* v335：加载失败时不再假装“没有资源”——直接说明是加载失败，并给一个大大的重试按钮，
           提示出现在屏幕正中（第一眼就能看到），点一下就重新加载。 */
        if (window.__loadFailed && !kw) {
          emptyTitle.textContent = '加载失败，网络开小差了';
          var __rb = emptyTip.querySelector('.empty-clear-btn');
          if (__rb) __rb.parentNode.removeChild(__rb);
          var __retry = document.createElement('button');
          __retry.type = 'button'; __retry.className = 'empty-clear-btn'; __retry.textContent = '重试';
          __retry.addEventListener('click', function () {
            window.__loadFailed = false;
            window.__skelPhase = true;
            renderSkeleton();
            fetchRemote({ page: 1, cid: currentCat, subCid: currentSubCat, kw: '', force: true })
              .then(function () { renderAll(); })
              .catch(function () { /* v336 条137：重试自己失败也不静默——回到失败提示+重试按钮，不再挂死 */ window.__loadFailed = true; window.__skelPhase = false; productGrid.innerHTML = ''; renderAll(); });
          });
          emptyTip.appendChild(__retry);
          return;
        }
        emptyTitle.textContent = kw ? '该搜索暂无资源' : '该分类暂无资源';
        /* v336 条168：分类空态给“查看全部资源”出口（不再让客人以为站点没货） */
        if (!kw) {
          var __all = document.createElement('button');
          __all.type = 'button'; __all.className = 'empty-clear-btn'; __all.textContent = '查看全部资源';
          __all.addEventListener('click', function () {
            currentCat = 0; currentSubCat = 0; currentPage = 1;
            renderCategories(); fetchRemote({ page: 1, cid: 0, subCid: 0, kw: '' }).then(function(){ renderAll(); }).catch(function(){});
          });
          emptyTip.appendChild(__all);
        }
        /* R183 条17：搜索空态提供「清除搜索」按钮（清词重看全部分类；非搜索空态不显示） */
        var __ob = emptyTip.querySelector('.empty-clear-btn');
        if (__ob) __ob.parentNode.removeChild(__ob);
        if (kw) {
          var __clr = document.createElement('button');
          __clr.type = 'button'; __clr.className = 'empty-clear-btn'; __clr.textContent = '清除搜索';
          __clr.addEventListener('click', function () {
            searchInput.value = '';
            searchClear.classList.remove('show');
            currentPage = 1;
            renderProducts();
          });
          emptyTip.appendChild(__clr);
          /* v346 条63：搜不到时给替代建议（不再只有一颗按钮、无任何引导） */
          var __tip2 = document.createElement('div');
          __tip2.className = 'empty-desc';
          __tip2.textContent = '没找到？换个关键词，或浏览全部资源';
          emptyTip.appendChild(__tip2);
        }
        /* v343 条44：非搜索的“空分类”也给一个下一步按钮——一键回到全部资源 */
        if (!kw && (currentCat || currentSubCat)) {
          var __all2 = document.createElement('button');
          __all2.type = 'button'; __all2.className = 'empty-clear-btn'; __all2.textContent = '查看全部资源';
          __all2.addEventListener('click', function () {
            currentCat = 0; currentSubCat = 0; currentPage = 1;
            renderCategories();
            fetchRemote({ page: 1, cid: 0, subCid: 0, kw: '' }).then(function () { renderAll(); }).catch(function () {});
          });
          emptyTip.appendChild(__all2);
        }
        return;
      }

      // R303：分页计算——后端已分页时直接用元数据，否则前端切片
      window.__loadFailed = false; /* v335：能渲染出数据就说明加载已恢复，撤掉“加载失败”标记 */
      var totalPages = DATA._backendPaged ? (DATA.totalPages || 1) : Math.ceil(list.length / PAGE_SIZE);
      if (currentPage > totalPages) currentPage = totalPages || 1;
      var start = (currentPage - 1) * PAGE_SIZE;
      var pageList = DATA._backendPaged ? list : list.slice(start, start + PAGE_SIZE);

      // P13 diff：非骨架期、后端分页、有现有卡片、非空态时只更新变化行
      var existingCards = productGrid.querySelectorAll('.product-card[data-pid]');
      var canDiff = !window.__skelPhase && DATA._backendPaged && existingCards.length > 0 &&
                    productGrid.querySelectorAll('.card-skeleton').length === 0 && pageList.length > 0;
      if (canDiff) {
        var existing = {};
        existingCards.forEach(function(c) { existing[c.dataset.pid] = c; });
        var changed = false;
        var frag = document.createDocumentFragment();
        pageList.forEach(function(p, i) {
          var card = existing[p.id];
          if (card && __productKeyEqual(p, card.__pData)) {
            delete existing[p.id];
            frag.appendChild(card);
          } else {
            changed = true;
            if (card) { card.remove(); delete existing[p.id]; }
            card = buildProductCard(p);
            card.classList.add('stagger-in');
            card.style.animationDelay = Math.min(i * 20, 180) + 'ms';
            frag.appendChild(card);
          }
          card.__pData = p;
        });
        for (var id in existing) { existing[id].remove(); changed = true; }
        /* v333 修：原写法是 if (changed || 条数不同) 才 productGrid.appendChild(frag)，
           但卡片早就被 appendChild(frag) 从 productGrid 挪走了 —— 数据没变、条数也没变时
           （最常见：后台静默刷新同一页）判断为 false，卡片再也放不回来，整个列表变空白。
           改为无条件放回，只保留 stagger 动画给真正新增的卡片。 */
        productGrid.appendChild(frag);
        // 更新分页控件（总数可能变了）
        var oldPager = document.getElementById('pager');
        if (oldPager) oldPager.parentNode.removeChild(oldPager);
        __uniPager = null;
        if (totalPages > 1) {
          var pager = document.createElement('div');
          pager.id = 'pager';
          productGrid.parentNode.insertBefore(pager, productGrid.nextSibling);
          if (window.buildUniPager) {
            __uniPager = window.buildUniPager(pager, {
              page: currentPage,
              totalPages: totalPages,
              total: DATA._backendPaged ? (DATA.total || 0) : list.length,
              onPage: __turnToPage
            });
          }
        }
        return;
      }

      // DocumentFragment 批量插入；R193 二① 方案A：骨架位上逐条替换真卡（同位置渐变成真卡）
      var frag = document.createDocumentFragment();
      pageList.forEach(function (p, i) {
        var card = buildProductCard(p);
        card.classList.add('stagger-in'); /* R192 二②；R211 二批（用户 09-20）：错峰 30ms 递升改 20ms/项、180ms 封顶（长列表尾部不再越等越久） */
        card.style.animationDelay = Math.min(i * 20, 180) + 'ms';
        if (__reuse && __skels[i]) __skels[i].parentNode.replaceChild(card, __skels[i]);
        else frag.appendChild(card);
      });
      productGrid.appendChild(frag);
      /* 真实条数少于骨架数：多余骨架收尾移除（真条数>骨架数时新增卡已在上方 append） */
      if (__reuse) { for (var j = pageList.length; j < __skels.length; j++) { if (__skels[j].parentNode) __skels[j].parentNode.removeChild(__skels[j]); } }

      // 分页控件（R14：改用全站统一 .uni-pager 公共组件——与数据统计翻页同款胶囊样式 + 跳页输入；
      // 翻页后回顶改瞬时滚动，原先平滑滚动叠加图片加载会显得"卡一下"）
      var pager = document.createElement('div');
      pager.id = 'pager';
      productGrid.parentNode.insertBefore(pager, productGrid.nextSibling);
      if (window.buildUniPager) {
        __uniPager = window.buildUniPager(pager, { /* R234：接住 setPage 句柄，自动翻页后同步分页条状态 */
          page: currentPage,
          totalPages: totalPages,
          total: DATA._backendPaged ? (DATA.total || 0) : list.length,
          /* R239：翻页动作收口 __turnToPage 单点——分页条按键（onPage）走本路径 */
          onPage: __turnToPage
        });
      } else if (totalPages > 1) {
        // 兜底：公共组件缺失时退回原内联胶囊样式（不应发生）
        var prev = document.createElement('button');
        prev.textContent = '上一页';
        prev.style.cssText = 'padding:8px 16px;border:1px solid var(--blue2);background:var(--card-bg,#fff);color:var(--blue1);border-radius:999px;cursor:pointer;font-size:13px;';
        window.__setPagerDisabled(prev, currentPage === 1); // v297（用户 10-04 02:14）：C-242 翻页置灰走公共函数
        prev.onclick = function () { if (currentPage > 1) { currentPage--; renderProducts(); window.scrollTo({top:0,behavior:'smooth'}); } };
        pager.appendChild(prev);
        var info = document.createElement('span');
        info.textContent = currentPage + ' / ' + totalPages;
        info.style.cssText = 'color:var(--text-light);font-size:13px;';
        pager.appendChild(info);
        var next = document.createElement('button');
        next.textContent = '下一页';
        next.style.cssText = 'padding:8px 16px;border:1px solid var(--blue2);background:var(--card-bg,#fff);color:var(--blue1);border-radius:999px;cursor:pointer;font-size:13px;';
        window.__setPagerDisabled(next, currentPage === totalPages); // v297（用户 10-04 02:14）：C-242 翻页置灰走公共函数
        next.onclick = function () { if (currentPage < totalPages) { currentPage++; renderProducts(); window.scrollTo({top:0,behavior:'smooth'}); } };
        pager.appendChild(next);
      }
      if (window.__btnFit) window.__btnFit(); /* v330 条18：渲染后按可用宽度决定按钮显示文字还是纯图标 */
      try { __renderRecent(); } catch (e) { if (window.__silent) window.__silent(e); } /* v346 条60：渲染后刷新「最近看过」一行 */
    }

    // R269（用户 09-27 15:14）：根因→R268 修复在 v265 打包时回退丢失，补 renderCarousel + coverImages 字段修正重做
    // ---------- 封面轮播组件 ----------
    var EXC_PLACEHOLDER = window.WN_MEDIA_FALLBACK; /* v349 条7：占位图统一取公共层一份（原先这里整段抄了一遍，改一处漏一处） */
    /* v333 整理：这段约 86 行的轮播实现与 admin.js 里那份逐字相同，已统一提取到
       ui-common.js 的 window.__renderCarousel（以后只改那一处，前后台自动同步）。
       这里保留转发，公共层万一没加载也不会整页崩。 */
    function renderCarousel(carouselEl, trackEl, dotsEl, fallbackImgEl, images) {
      if (window.__renderCarousel) { window.__renderCarousel(carouselEl, trackEl, dotsEl, fallbackImgEl, images, EXC_PLACEHOLDER); return; }
      if (!carouselEl || !trackEl) return;
      if (!images || images.length <= 1) {
        carouselEl.style.display = 'none';
        if (fallbackImgEl) { fallbackImgEl.style.display = ''; fallbackImgEl.src = images && images[0] ? images[0] : ''; }
        return;
      }
      carouselEl.style.display = '';
      if (fallbackImgEl) fallbackImgEl.style.display = 'none';
      var _img0 = document.createElement('img');
      _img0.src = images[0] || '';
      if (fallbackImgEl) fallbackImgEl.src = images[0] || '';
    }

    // ---------- 详情弹窗 ----------
    /* v347：最近浏览——本地记住最近打开的资源（不限条数），列表上方给一行快捷入口；
       形态与分类栏一致：左右滑动 + 右侧三角展开/收起；位置在两个分类栏之下、资源列表之上 */
    function __pushRecent(id) {
      try {
        if (!id) return;
        var arr = JSON.parse(localStorage.getItem('wnzyq_recent') || '[]');
        arr = arr.filter(function (x) { return x !== id; });
        arr.unshift(id);
        localStorage.setItem('wnzyq_recent', JSON.stringify(arr));
      } catch (e) { if (window.__silent) window.__silent(e); }
    }
    function __renderRecent() {
      try {
        var grid = document.getElementById('productGrid');
        if (!grid || !grid.parentNode) return;
        var ids = JSON.parse(localStorage.getItem('wnzyq_recent') || '[]');
        var list = (DATA && DATA.products) || [];
        var items = ids.map(function (id) { for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === id) return list[i]; } return null; }).filter(Boolean);
        var oldWrap = document.getElementById('recentBarWrap');
        var wasExpanded = false;
        if (oldWrap) {
          var ob = oldWrap.querySelector('.recent-bar');
          wasExpanded = !!(ob && ob.classList.contains('expanded'));
          if (oldWrap.parentNode) oldWrap.parentNode.removeChild(oldWrap);
        }
        if (!items.length) return;
        var wrap = document.createElement('div'); wrap.id = 'recentBarWrap'; wrap.className = 'recent-bar-wrap';
        var bar = document.createElement('div'); bar.id = 'recentBar'; bar.className = 'recent-bar';
        var t = document.createElement('span'); t.className = 'recent-title'; t.textContent = '最近看过'; bar.appendChild(t);
        items.forEach(function (p) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'recent-chip';
          b.textContent = p.title || p.name || '资源'; b.title = p.title || '';
          b.addEventListener('click', function () { openModal(p); });
          bar.appendChild(b);
        });
        var tg = document.createElement('button'); tg.type = 'button'; tg.className = 'recent-toggle'; tg.id = 'recentToggle';
        tg.title = '展开/收起'; tg.setAttribute('aria-label', '展开或收起最近看过');
        tg.innerHTML = '<svg aria-hidden="true" class="toggle-arrow" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>';
        wrap.appendChild(bar); wrap.appendChild(tg);
        grid.parentNode.insertBefore(wrap, grid);
        var overflow = bar.scrollWidth > bar.clientWidth + 5;
        if (wasExpanded) { bar.classList.add('expanded'); tg.classList.add('open'); }
        if (!overflow) tg.style.display = 'none';
        tg.addEventListener('click', function () {
          var open = bar.classList.toggle('expanded');
          tg.classList.toggle('open', open);
        });
      } catch (e) { if (window.__silent) window.__silent(e); }
    }

    function openModal(p) {
      /* v338 条40：列表瘦身模式——列表数据不带详情大字段（'detail' 键整个不存在）。
         打开弹窗时先按 id 单拉完整数据再展示，拉失败则按无详情降级，绝不开天窗。 */
      if (p && !('detail' in p)) {
        /* v340 条6：秒开——不再等接口回来才开弹窗（此前点卡片要等约 1 秒）。
           先用列表已有数据立刻打开，详情大字段回来后再就地补进详情区。 */
        var __pid = p.id;
        p.detail = '';
        openModal(p);
        __dedupFetch('/api/products?id=' + encodeURIComponent(__pid), { cache: 'no-cache', credentials: 'include' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (res) {
            var full = (res && res.ok && res.product) ? res.product : null;
            if (!full) return;
            (DATA.products || []).forEach(function (x, i) { if (x && x.id === full.id) DATA.products[i] = full; });
            /* 弹窗仍停在这条资源上才补内容，避免补错窗口 */
            if (!currentProduct || currentProduct.id !== __pid) return;
            if (!document.getElementById('modalMask') || !document.getElementById('modalMask').classList.contains('open')) return;
            currentProduct.detail = full.detail || '';
            if (full.detail) {
              modalDetail.innerHTML = sanitizeHTML(full.detail);
              bindQuoteCopyButtons(modalDetail);
              bindMediaFail(modalDetail); bindLightbox(modalDetail); bindFileCards(modalDetail);
              modalDetail.style.display = 'block';
            }
            var _imgs = full.detailImages || [];
            if (_imgs.length) {
              currentProduct.detailImages = _imgs;
              _imgs.forEach(function (url) {
                if (!url) return;
                var im = document.createElement('img');
                im.decoding = 'async'; im.alt = ''; im.style.cursor = 'zoom-in'; im.style.opacity = '0';
                im.className = 'm-loading';
                im.onload = function () { this.classList.remove('m-loading'); this.style.opacity = '1'; };
                im.onerror = function () { this.onerror = null; this.src = IMG_PLACEHOLDER; if (this.classList) this.classList.add('media-fail'); this.classList.remove('m-loading'); this.style.opacity = '1'; };
                im.src = url;
                im.addEventListener('click', function () { window.openLightbox(url); });
                if (window.mediaStable) window.mediaStable(im);
                modalMedia.appendChild(im);
              });
            }
          })
          .catch(function () {});
        return;
      }
      // v294（用户 10-04 02:14）：207 弹窗打开时pushState，后退先关弹窗
      try { if (!window.location.search.includes('pid=')) history.pushState({modal:true}, '', window.location.pathname + '?pid=' + p.id); } catch (e) { if (window.__silent) window.__silent(e); }
      currentProduct = p;
      try { __pushRecent(p.id); } catch (e) { if (window.__silent) window.__silent(e); }
      try { __renderRecent(); } catch (e) { if (window.__silent) window.__silent(e); }
      currentVariant = null;
      track(p.id, 'view');

      // R256：清除详情弹窗骨架
      var _mdSkel = document.getElementById('modalSkeleton'); if (_mdSkel) _mdSkel.style.display = 'none';
      // R256：详情弹窗封面轮播
      var _covArr = Array.isArray(p.coverImages) ? p.coverImages : (p.img ? [p.img] : []);
      renderCarousel(document.getElementById('modalCarousel'), document.getElementById('modalCcTrack'), document.getElementById('modalCcDots'), modalCover, _covArr);
      // R273：单图回退条件化——多图时 modalCover 由 renderCarousel 隐藏，不再被 loadImg 翻回来
      var _mainImg = _covArr[0] || p.img || '';
      if (_covArr.length <= 1) {
        loadImg(modalCover, _mainImg);
        modalCover.style.cursor = 'zoom-in';
        modalCover.onclick = function () { if (_mainImg) window.openLightbox(_mainImg); };
      }
      modalTitle.textContent = p.title || '';
      modalTitle.title = p.title || ''; // v294：196 弹窗标题悬停显示完整内容
      modalDesc.textContent = p.desc || '';

      // 详细描述（支持 HTML 超链接，如 <a href="https://...">点击查看</a>）
      if (p.detail && p.detail.trim()) {
        modalDetail.innerHTML = sanitizeHTML(p.detail);
        bindQuoteCopyButtons(modalDetail); // v296（用户 10-04 03:01）：引用块加复制按钮
        bindMediaFail(modalDetail); bindLightbox(modalDetail);
        bindFileCards(modalDetail); // v320（用户 10-05 22:37）：客户端文件卡渲染
        modalDetail.style.display = 'block';
      } else {
        modalDetail.style.display = 'none';
      }

      // 详情多图 + 多视频
      modalMedia.innerHTML = '';
      var images = p.detailImages || [];
      var videos = p.detailVideos || [];
      images.forEach(function (url) {
        if (!url) return;
        var im = document.createElement('img');
        im.decoding = 'async'; /* R193c ⑩ */
        im.alt = '';
        im.style.cursor = 'zoom-in';
        im.style.opacity = '0';
        im.className = 'm-loading'; /* v309:加载前CSS占位，尺寸恒定*/
        im.onload = function () { this.classList.remove('m-loading'); this.style.opacity = '1'; };
        im.onerror = function () { this.onerror = null; this.src = IMG_PLACEHOLDER; if (this && this.classList) this.classList.add('media-fail'); this.classList.remove('m-loading'); this.style.opacity = '1'; this.style.display = 'block'; };
        im.src = url;
        im.addEventListener('click', function () { window.openLightbox(url); });
        if (window.mediaStable) window.mediaStable(im);
        modalMedia.appendChild(im);
      });
      videos.forEach(function (url) {
        if (!url) return;
        var v = document.createElement('video');
        v.src = url;
        v.controls = true;
        v.playsInline = true;
        v.style.background = '#000'; /* v309:视频加载前黑底占位，不塌陷*/
        /* R278（老板 09-27）：详情视频补点击放大 → 全屏大图（与同区图片的显式 handler 同款；
         * 原实现只有 controls、无任何放大绑定——「全系统点击放大视频」缺口。不为 modalMedia 整体
         * bindLightbox，避免与上方图片的显式 handler 双绑定。 */
        v.style.cursor = 'zoom-in';
        v.addEventListener('click', function () { v.pause(); window.openLightbox(url); });
        if (window.mediaStable) window.mediaStable(v, true);
        modalMedia.appendChild(v);
      });

      bindMediaFail(modalMedia);

      // 资源类型（按 sort 字段从小到大排序）
      var variants = (p.variants || []).slice().sort(function (a, b) {
        return (a.sort || 0) - (b.sort || 0);
      });
      if (variants.length > 0) {
        variantTabs.style.display = 'flex';
        variantTabs.innerHTML = '';
        // R112：默认优先选中草稿暂存的类型（点外/Esc 关闭后重开接着刚才的），无草稿选第一个
        var __draftIdx = 0;
        if (__codeDraft && __codeDraft.pid === p.id) {
          variants.forEach(function (v, di) { if (v.id === __codeDraft.vid) __draftIdx = di; });
        }
        variants.forEach(function (v, idx) {
          var tab = document.createElement('div');
          tab.className = 'variant-tab' + (idx === __draftIdx ? ' active' : '');
          tab.textContent = v.name || '类型' + (idx + 1);
          if (v.name) tab.title = v.name; // R160：截断显示不全时鼠标悬停查看全名
          tab.addEventListener('click', function () {
            if (__variantTransitioning) return; /* R243（用户 09-22 23:18）：条6 淡出期间防重复 */
            __variantTransitioning = true;
            currentVariant = v;
            variantTabs.querySelectorAll('.variant-tab').forEach(function (t, i) {
              t.classList.toggle('active', i === idx);
            });
            variantDetail.classList.add('variant-fade-out'); /* R243（用户 09-22 23:18）：条6 旧内容淡出 */
            setTimeout(function () {
              renderVariantDetail();
              updatePrice();
              updateContactBtn();
              initResourceCodeSection(); // 切换类型时重置资源码区域
              __tryRefillCode(); // R112：切到草稿暂存的类型时回填资源码
              variantDetail.classList.remove('variant-fade-out'); /* R243（用户 09-22 23:18）：条6 新内容淡入 */
              modalPrice.classList.add('price-flash'); /* R243（用户 09-22 23:18）：条6 价格闪一下 */
              modalPrice.offsetHeight; /* R243（用户 09-22 23:18）：条6 强制回流 */
              modalPrice.classList.remove('price-flash');
              __variantTransitioning = false;
            }, 100);
          });
          variantTabs.appendChild(tab);
        });
        // 默认选中草稿类型（无草稿=第一个），显示其价格和详情
        currentVariant = variants[__draftIdx];
        // v294（用户 10-04 02:14）：161 处理上次暂存类型已被删除的情况
        if (!currentVariant && variants.length) {
          currentVariant = variants[0];
          try { localStorage.removeItem('wnzyq_variant_draft'); } catch (e) { if (window.__silent) window.__silent(e); }
        }
        if (!currentVariant) {
          if (window.showToast) window.showToast('该资源的类型已被删除', 'error');
          closeModal(); return;
        }
        renderVariantDetail();
      } else {
        variantTabs.style.display = 'none';
        variantDetail.style.display = 'none';
        currentVariant = null;
      }

      updatePrice();
      updateContactBtn();

      // 资源码区域初始化（基于当前选中的类型，没有类型则用资源级资源码）
      initResourceCodeSection();
      __tryRefillCode(); // R112：点外/Esc 暂存的资源码自动回填

      modalMask.classList.add('open');
      /* R241（用户 09-22 19:19）：滚动位置按「弹窗 × 资源」独立——切换资源不继承上一资源
         滚到的位置，同一资源回来恢复原位 */
      if (window.__modalScroll) __modalScroll.open(modalMask, p.id);
      setBodyLock(true);
    }

    // 获取当前应使用的资源码（优先类型级，其次资源级）
    // 获取当前类型的资源码（只在类型里配置，没有类型或类型没配置则不显示资源码）
    // R92 一机一码：公开接口不再下发资源码/专属内容明文，改给 hasCode/hasContent 标志；
    // 明文内容由 /api/unlock 服务端验证（或已绑定设备直接放行）后单发。
    // 兼容旧 localStorage 缓存里残留的明文字段——有则派生标志。
    function variantHasCode() {
      if (!currentVariant) return false;
      if (currentVariant.hasCode) return true;
      return !!(currentVariant.resourceCode && String(currentVariant.resourceCode).trim());
    }
    function variantHasContent() {
      if (!currentVariant) return false;
      if (currentVariant.hasContent) return true;
      return !!(currentVariant.resourceContent && String(currentVariant.resourceContent).trim());
    }
    // R146（用户 00:25）：已解锁内容本地缓存（7 天）——重开弹窗立即渲染专属内容，
    // 不再等 /api/unlock 返回（已绑定设备每次都要"加载一下"观感差）；后台仍静默刷新覆盖缓存
    var UNLOCK_CACHE_TTL = Infinity; // R286-61：已解锁设备免输码永久有效（不再设7天限制）
    function __unlockCacheKey(pid, vid) { return 'wnzyq_unlock_' + pid + '_' + vid; }
    function __saveUnlockCache(pid, vid, content) {
      if (!pid || !vid || !content) return;
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('wnzyq_unlock_') === 0) keys.push(k);
        }
        if (keys.length >= 50) {
          keys.sort(function (a, b) {
            var ta = 0, tb = 0;
            try { ta = (JSON.parse(localStorage.getItem(a) || '{}').t) || 0; } catch (e) { if (window.__silent) window.__silent(e); }
            try { tb = (JSON.parse(localStorage.getItem(b) || '{}').t) || 0; } catch (e) { if (window.__silent) window.__silent(e); }
            return ta - tb;
          });
          for (var j = 0; j < keys.length - 49; j++) { try { localStorage.removeItem(keys[j]); } catch (e) { if (window.__silent) window.__silent(e); } }
        }
        localStorage.setItem(__unlockCacheKey(pid, vid), JSON.stringify({ t: Date.now(), c: content }));
      } catch (e) { if (window.__silent) window.__silent(e); }
    }
    function __readUnlockCache(pid, vid) {
      try {
        var raw = localStorage.getItem(__unlockCacheKey(pid, vid));
        if (!raw) return null;
        var d = JSON.parse(raw);
        // R286-61：已解锁设备免输码永久有效（不再检查7天过期）
        if (!d || !d.c) {
          try { localStorage.removeItem(__unlockCacheKey(pid, vid)); } catch (e) { if (window.__silent) window.__silent(e); }
          return null;
        }
        return d.c;
      } catch (e) { return null; }
    }
    // 请求服务端解锁：code 传空 = 自动检查（已绑定设备/无码类型直接拿内容）
    // R231 条16/17：deferMs = 绿✓三段式展示时长——期间延迟行淡出，之后再 150ms 淡出并与内容展开交叉
    var unlockBusy = false;
    // U3：解锁请求加 8 秒超时，超时提示「网络开小差了，请稍后再试」
    function requestResourceUnlock(code, deferMs) {
      if (!currentProduct || !currentVariant || unlockBusy) return Promise.resolve(null);
      var pid = currentProduct.id, vid = currentVariant.id;
      unlockBusy = true;
      return Promise.race([
        __dedupFetch('/api/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: pid, variantId: vid, code: code || '' })
        }).then(function (r) { return r.json(); }),
        new Promise(function (_, reject) {
          setTimeout(function () { reject(new Error('timeout')); }, 10000) /* v336 条11：与后台统一 10 秒 */;
        })
      ]).then(function (res) {
        unlockBusy = false;
        // 弹窗已切换/关闭时丢弃过期响应
        if (!currentProduct || !currentVariant || currentProduct.id !== pid || currentVariant.id !== vid) return null;
        if (res && res.ok && res.content) {
          __saveUnlockCache(pid, vid, res.content); // R146：解锁成功写缓存（重开弹窗即时渲染）
          var resourceContent = document.getElementById('resourceContent');
          if (resourceContent && resourceContent.style.display === 'none') {
            /* R231 条17（用户 09-21 23:38）：输入行/直接查看行 150ms 淡出（原瞬消），
               与内容 fadeInUp 展开交叉；deferMs>0 时先等绿✓（条16）展示完再收尾 */
            var _fadeRows = function () {
              var rows = [document.getElementById('resourceCodeInputRow'), document.getElementById('resourceDirectRow')];
              rows.forEach(function (r) {
                if (!r || r.style.display === 'none') return;
                r.style.transition = 'opacity 0.15s ease';
                r.style.opacity = '0';
                setTimeout(function () { r.style.display = 'none'; r.style.opacity = ''; r.style.transition = ''; }, 150);
              });
              unlockResourceContent(res.content);
            };
            if (deferMs) setTimeout(_fadeRows, deferMs); else _fadeRows();
          }
        }
        // 失败时静默返回（提示由 verifyResourceCode / 直接获取键按场景处理）
        return res;
      }).catch(function (err) {
        unlockBusy = false;
        // U3：超时提示「网络开小差了，请稍后再试」
        if (err && err.message === 'timeout') return { ok: false, msg: '网络开小差了，请稍后再试' };
        return { ok: false, msg: '网络开小差了，请稍后再试' }; // v294：087 网络提示统一
      });
    }
    // 初始化/重置专属内容解锁区域
    // 逻辑：有 resourceContent 才显示区域；有 resourceCode 则输入解锁，无 resourceCode 则直接查看
    function initResourceCodeSection() {
      var resourceSection = document.getElementById('resourceCodeSection');
      var resourceInputRow = document.getElementById('resourceCodeInputRow');
      var resourceDirectRow = document.getElementById('resourceDirectRow');
      var resourceTitle = document.getElementById('resourceCodeTitle');
      var resourceInput = document.getElementById('resourceCodeInput');
      var resourceError = document.getElementById('resourceCodeError');
      var resourceContent = document.getElementById('resourceContent');
      var hasCode = variantHasCode();
      var hasContent = variantHasContent();

      if (!hasContent) {
        // 没有配置专属内容，隐藏整个区域
        resourceSection.style.display = 'none';
        return;
      }

      // 有专属内容，显示区域
      resourceSection.style.display = 'block';
      resourceError.style.display = 'none';
      resourceContent.style.display = 'none';
      resourceContent.innerHTML = '';

      // R146（用户 00:25）：已解锁过（本地缓存命中）→ 立即显示专属内容，不等接口
      var _cached = (currentProduct && currentVariant) ? __readUnlockCache(currentProduct.id, currentVariant.id) : null;

      if (_cached) {
        resourceTitle.textContent = '获取专属内容'; // v296（用户 10-04 02:14）：313 标题统一 // v296（用户 10-04 02:14）：313 资源码区域标题统一，不再随 hasCode 变化
        resourceInputRow.style.display = 'none';
        resourceDirectRow.style.display = 'none';
        // v294（用户 10-04 02:14）：091 已绑定设备查看也加淡入动画
        var rc = document.getElementById('resourceContent');
        if (rc) { rc.style.opacity = '0'; rc.style.transition = 'opacity 0.3s ease'; }
        unlockResourceContent(_cached, true); // true=缓存渲染不重复统计
        if (rc) setTimeout(function(){ rc.style.opacity = '1'; }, 50);
      } else if (hasCode) {
        // 有资源码：显示输入框+解锁按钮
        resourceTitle.textContent = '获取专属内容'; // v296（用户 10-04 02:14）：313 标题统一 // v296（用户 10-04 02:14）：313 标题统一
        resourceInputRow.style.display = 'flex';
        resourceDirectRow.style.display = 'none';
        resourceInput.value = '';
      } else {
        // 无资源码：显示直接获取按钮
        resourceTitle.textContent = '获取专属内容'; // v296（用户 10-04 02:14）：313 标题统一
        resourceInputRow.style.display = 'none';
        resourceDirectRow.style.display = 'block';
      }

      // R92 宽松模式通行证体验：打开弹窗即静默检查一次——
      // 已绑定设备（或无码类型）直接拿到内容并展示，老访客无需再输一遍码
      // R146：缓存已命中时本次请求只作后台校验/刷新（内容已在展示，接口返回不重复渲染）
      if (!_cached) requestResourceUnlock('');
    }

    // 通用：显示专属内容并统计（服务端验证成功 / 已绑定设备 / 直接查看 都走这里）
    // R92：内容由 /api/unlock 服务端返回传入，前台不再持有明文
    function unlockResourceContent(content, noTrack) {
      var resourceContent = document.getElementById('resourceContent');
      resourceContent.innerHTML = sanitizeHTML(content || '<p>专属内容</p>');
      bindMediaFail(resourceContent); bindLightbox(resourceContent);
      resourceContent.style.display = 'block';
      // 触发动画重播
      resourceContent.style.animation = 'none';
      void resourceContent.offsetWidth;
      resourceContent.style.animation = '';
      // 统计解锁（记录资源ID和类型ID，30天内有效）；R146：缓存命中渲染不重复上报
      if (!noTrack) {
        var variantId = currentVariant ? currentVariant.id : 0;
        track(currentProduct.id, 'resource_unlock', {variant_id: variantId});
      }
    }

    function renderVariantDetail() {
      if (!currentVariant) { variantDetail.style.display = 'none'; return; }
      variantDetail.innerHTML = '';
      var hasContent = false;

      // 类型标题行：类型标题（R148：新增字段，空=回退类型名称）+ 价格（有价格才显示）
      var header = document.createElement('div');
      header.className = 'variant-header';
      var vName = document.createElement('span');
      vName.className = 'variant-name';
      vName.textContent = (currentVariant.title && String(currentVariant.title).trim()) || currentVariant.name || '';
      header.appendChild(vName);
      var vPriceText = formatPrice(currentVariant.price);
      if (vPriceText) {
        var vp = document.createElement('span');
        vp.className = 'variant-price';
        vp.textContent = vPriceText;
        header.appendChild(vp);
      }
      variantDetail.appendChild(header);
      hasContent = true;

      // 类型描述（支持 HTML 超链接）
      if (currentVariant.desc && currentVariant.desc.trim()) {
        var d = document.createElement('div');
        d.className = 'v-desc';
        d.innerHTML = sanitizeHTML(currentVariant.desc);
        bindMediaFail(d); bindLightbox(d);
        variantDetail.appendChild(d);
        hasContent = true;
      }
      if (currentVariant.img) {
        var im = document.createElement('img');
        im.decoding = 'async'; /* R193c ⑩ */
        // R266（用户 09-27 15:08）：onerror 必须在 src 赋值前注册，杜绝注册前即失败导致的裸闪破损图标。
        im.onerror = function () {
          this.onerror = null;
          this.src = IMG_PLACEHOLDER; if (this && this.classList) this.classList.add('media-fail'); this.style.display = 'block';
        };
        im.src = currentVariant.img;
        im.alt = '';
        im.style.cursor = 'zoom-in';
        im.addEventListener('click', function () { window.openLightbox(currentVariant.img); });
        variantDetail.appendChild(im);
        hasContent = true;
      }
      if (currentVariant.video) {
        var v = document.createElement('video');
        v.src = currentVariant.video;
        v.controls = true;
        v.playsInline = true;
        variantDetail.appendChild(v);
        hasContent = true;
      }
      bindMediaFail(variantDetail); bindLightbox(variantDetail);
      variantDetail.style.display = hasContent ? 'block' : 'none';
      if (hasContent) {
        variantDetail.style.animation = 'none';
        variantDetail.offsetHeight;
        variantDetail.style.animation = 'fadeInUp 0.20s var(--ease-out, ease)'; /* R231 条15（老板修正）：0.18s→0.20s */
      }
    }

    // 价格显示：选中类型→类型价格；无类型资源→资源价格；多类型未选择→不显示
    function updatePrice() {
      var price = 0;
      if (currentVariant) {
        // 已选中类型，显示该类型价格
        price = Number(currentVariant.price) || 0;
      } else {
        // 未选中类型：只有无类型资源才显示资源价格，多类型未选择时不显示
        var variantCount = (currentProduct && currentProduct.variants) ? currentProduct.variants.length : 0;
        if (variantCount === 0 && currentProduct) {
          price = Number(currentProduct.price) || 0;
        }
      }
      var text = formatPrice(price);
      if (text) {
        modalPrice.textContent = text;
        modalPrice.style.display = '';
      } else {
        modalPrice.style.display = 'none';
      }
    }

    // R285 item 7：兜底弹窗已统一到 ui-common.js（window.openContactFallback / window.__kfFbClose）

    // 咨询客服按钮：优先类型链接 → 资源链接 → 全局默认
    function updateContactBtn() {
      // 咨询客服按钮为纯文字（图标已按要求删除）
      var url = '';
      if (currentVariant && currentVariant.contactUrl) url = currentVariant.contactUrl;
      else if (currentProduct && currentProduct.contactUrl) url = currentProduct.contactUrl;
      else url = window._globalContact || getDefaultContact();

      if (url) {
        btnContact.style.display = '';
        btnContact.onclick = function () {
          track(currentProduct ? currentProduct.id : null, 'contact');
          // R13：补传跳转键文案（同顶栏，恢复被漏参数隐藏的跳转键）
          if (window.openContactModal) { window.openContactModal(url, window.__kefuQrSrc(), null, '跳转-咨询在线客服'); } else { window.openContactFallback(url); }
        };
      } else {
        btnContact.style.display = ''; btnContact.onclick = function () { showToast('暂未设置客服链接', 'info'); }; // R213 P1-1（质检 R212）：原误写未定义的 toast()，客服链接清空场景必抛 ReferenceError
      }
    }

    // ---------- R112：资源码草稿（三模式统一——点外/Esc=暂存，重开自动回填；×/关闭=丢弃） ----------
    // 草稿为内存级（刷新即清，与全站弹窗草稿口径一致），按 资源id+类型id 匹配才回填
    var __codeDraft = null;
    function __tryRefillCode() {
      if (!__codeDraft || !currentProduct || __codeDraft.pid !== currentProduct.id) return;
      var vid = currentVariant ? currentVariant.id : null;
      if (__codeDraft.vid !== vid) return;
      var ri = document.getElementById('resourceCodeInput');
      if (ri && __codeDraft.code) ri.value = __codeDraft.code;
    }
    /* R213 P2④（质检 R212 + 队长拍板）：R112 版 closeModalStash 曾被 R147 连保存逻辑一并删除（__codeDraft 从此无人写入、
       R112 的重开回填 __tryRefillCode 成死代码）。R257（老板 09-23 19:08「关了重开编辑状态应保留，全系统排查」）恢复暂存通道：
       点外/Esc=暂存（存 资源id+类型id+已输入码，重开同资源同类型自动回填，779 行 openModal 的 __tryRefillCode 链路复活）；×/关闭键=丢弃 */
    function closeModalStash() {
      try {
        var ri = document.getElementById('resourceCodeInput');
        if (ri && ri.value && currentProduct) __codeDraft = { pid: currentProduct.id, vid: currentVariant ? currentVariant.id : null, code: ri.value };
        else __codeDraft = null; // 没输入内容不暂存，避免空草稿覆盖
      } catch (e) { if (window.__silent) window.__silent(e); }
      closeModal();
    }
    function closeModalDiscard() { __codeDraft = null; closeModal(); }

    // v294（用户 10-04 02:14）：207 浏览器后退先关弹窗
    // v333 清理：原来一模一样注册了两遍，后退时 closeModal 被调两次。删掉重复的一份。
    window.addEventListener('popstate', function(e) {
      if (!e.state || !e.state.modal) { var m = document.getElementById('modalMask'); if (m && m.classList.contains('open')) closeModal(); }
    });
    function closeModal() { try { document.querySelectorAll('#modalBox video, #modalMedia video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
      // R280 ③：关弹窗必停轮播定时器——防「关了弹窗后台还在换图」的鬼影残留
      var _ccCar = document.getElementById('modalCarousel');
      if (_ccCar && _ccCar.__ccPause) _ccCar.__ccPause();
      modalMask.classList.remove('open');
      setBodyLock(false);
      currentProduct = null;
      currentVariant = null;
      // 重置专属内容区域状态
      var resourceInput = document.getElementById('resourceCodeInput');
      if (resourceInput) resourceInput.value = '';
      var resourceError = document.getElementById('resourceCodeError');
      if (resourceError) resourceError.style.display = 'none';
      var resourceContent = document.getElementById('resourceContent');
      if (resourceContent) { resourceContent.style.display = 'none'; resourceContent.innerHTML = ''; }
      var resourceInputRow = document.getElementById('resourceCodeInputRow');
      if (resourceInputRow) resourceInputRow.style.display = 'flex';
      var resourceDirectRow = document.getElementById('resourceDirectRow');
      if (resourceDirectRow) resourceDirectRow.style.display = 'none';
    }

    // ---------- 移动端手势：弹窗内左右滑动切换资源类型 ----------
    var modalBox = document.getElementById('modalBox');
    var touchStartX = 0;
    var touchStartY = 0;
    var touchStartTime = 0;
    if (modalBox) {
      modalBox.addEventListener('touchstart', function (e) {
        if (window.__flipAnimating) { touchStartX = 0; touchStartY = 0; touchStartTime = 0; return; } /* R211 二批：FLIP 飞位期间不判定滑动切类型（手势隔离，起点清零防误判） */
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }, { passive: true });
      modalBox.addEventListener('touchend', function (e) {
        var touchEndX = e.changedTouches[0].clientX;
        var touchEndY = e.changedTouches[0].clientY;
        var deltaX = touchEndX - touchStartX;
        var deltaY = touchEndY - touchStartY;
        var deltaTime = Date.now() - touchStartTime;
        // 只响应水平滑动（水平位移大于垂直位移，且滑动距离超过50px，时间小于500ms）
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50 && deltaTime < 500) {
          var tabs = document.querySelectorAll('.variant-tab');
          if (tabs.length <= 1) return;
          var activeIdx = 0;
          tabs.forEach(function (t, i) { if (t.classList.contains('active')) activeIdx = i; });
          if (deltaX < 0 && activeIdx < tabs.length - 1) {
            // 向左滑，切换到下一个类型
            tabs[activeIdx + 1].click();
          } else if (deltaX > 0 && activeIdx > 0) {
            // 向右滑，切换到上一个类型
            tabs[activeIdx - 1].click();
          }
        }
      }, { passive: true });
    }

    btnCloseModal.addEventListener('click', closeModalDiscard); // R112：×/关闭=丢弃草稿
    modalCloseX.addEventListener('click', closeModalDiscard); // R112：×/关闭=丢弃草稿
    modalMask.addEventListener('click', function (e) {
      if (e.target === modalMask) closeModalStash(); // R257（老板 09-23 19:08）：点外=暂存资源码草稿（重开同资源同类型回填）；×/关闭=丢弃；R217 恢复的历史保留
    });

    // ---------- R10 资源分享（弹窗左上角转发键） ----------
    // R14：点击改为弹窗形式（复用 ui-common 公共分享链接弹窗，观感与顶栏「分享本站」一致：标题+链接+确定），
    // 弹窗内部自动复制链接到剪贴板
    modalShareX.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!currentProduct || !currentProduct.id) { showToast('该资源暂不能分享', 'info'); return; }
      var url = window.location.origin + window.location.pathname + '?pid=' + currentProduct.id;
      if (window.showShareLinkModal) window.showShareLinkModal('分享资源链接', url, (currentProduct.title || '') + ' · 资源链接已复制到剪贴板'); // R251：新标题+带资源名灰字
      else { if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch (e) { if (window.__silent) window.__silent(e); } } showToast('链接已复制到剪贴板', 'success'); }
    });

    // ---------- 资源码验证 ----------
    var resourceCodeBtn = document.getElementById('resourceCodeBtn');
    var resourceCodeInput = document.getElementById('resourceCodeInput');
    var resourceCodeError = document.getElementById('resourceCodeError');
    var resourceContent = document.getElementById('resourceContent');
    var resourceCodeInputRow = document.getElementById('resourceCodeInputRow');

    function verifyResourceCode() {
      if (!currentProduct || !currentVariant) return;
      if (!variantHasCode()) return; // 当前类型没有配置资源码
      var input = resourceCodeInput.value.trim();
      if (!input) {
        resourceCodeError.textContent = '请输入资源码';
        resourceCodeError.style.display = 'block';
        return; // R244（用户 09-23 12:25）：解锁失败红字已含客服引导，灰色小字重复且颜色不统一，整套移除，只保留红色错误一行
      }
      // R92：验证移到服务端（大小写不敏感由服务端比对），前台不再持有明文码；
      // 码正确且未超绑定上限 → 绑定本设备并返回专属内容；已绑定设备直接放行
      var btn = document.getElementById('resourceCodeBtn');
      var btnText = btn.textContent;
      btn.disabled = true; if (window.__btnBusy) window.__btnBusy(btn, '解锁中'); /* R183 条4：忙碌转圈 */
      requestResourceUnlock(input, 400).then(function (res) { /* R231 条16：绿✓展示 400ms 后收尾（老板口径） */
        btn.disabled = false; btn.textContent = btnText;
        if (res === null) return; // 过期响应（弹窗已切换），不提示
        if (res && res.ok && res.content) {
          if (window.__haptic) window.__haptic(); /* R183 条12：解锁成功触觉反馈（仅手机） */
          /* R231 条16（用户 09-21 23:38，400ms 老板口径）：三段式收场——「解锁中」→ 绿✓「已解锁」
             → 400ms 后输入行随内容展开淡出（条17 衔接）；按钮状态在隐藏行内恢复，无脏状态残留 */
          try {
            btn.textContent = '✓ 解锁成功'; // v296（用户 10-04 02:14）：312 解锁成功文案统一
            btn.style.background = 'var(--green, #2e7d32)';
            btn.style.borderColor = 'var(--green, #2e7d32)';
            btn.style.color = '#fff';
            setTimeout(function () {
              btn.textContent = btnText; btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = '';
            }, 400);
          } catch (e0) { if (window.__silent) window.__silent(e0); }
          resourceCodeError.style.display = 'none'; // R244（用户 09-23 12:25）：解锁失败红字已含客服引导，灰色小字重复且颜色不统一，整套移除，只保留红色错误一行
        } else {
          // v294（用户 10-04 02:14）：081 输错码统一弹胶囊提示（老板批注：统一用弹胶囊）
          resourceCodeError.style.display = 'none';
          if (window.showToast) window.showToast((res && res.msg) || '资源码错误，请重试', 'error');
          resourceCodeInput.style.borderColor = '#ff4444';
          setTimeout(function () { resourceCodeInput.style.borderColor = ''; }, 1500);
        }
      });
    }
    resourceCodeBtn.addEventListener('click', verifyResourceCode);
    resourceCodeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') verifyResourceCode();
    });
    // R158（用户 22:42）：输满 8 位自动解锁——资源码固定 8 位（R96 生成口径），输够 8 位即提交，
    // 不用再点右侧「解锁」键；改错重输（值变化）会重新自动提交，删回 8 位以下重置。
    var __lastAutoCode = '';
    /* R231 条18（用户 09-21 23:38）：输满 8 位自动提交加 300ms 防抖——粘贴瞬间直接发请求会被
       中文输入法/粘贴器切成多次 input 事件，连续触发验证；稳定 300ms 后才真正提交 */
    var __autoCodeTimer = null;
    // v294（用户 10-04 02:14）：191 资源码输入净化——过滤换行/空格/特殊字符，只留字母数字
    resourceCodeInput.addEventListener('input', function () {
      // R243 条21：粘贴/输入超 8 位只留前 8 位（maxlength 兜底，双保险；截断后照常走 R158 自动解锁判定）
      var cleaned = this.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
      if (this.value !== cleaned) this.value = cleaned;
      var val = String(this.value || '').trim();
      if (val.length < 8) { __lastAutoCode = ''; clearTimeout(__autoCodeTimer); return; }
      if (val === __lastAutoCode) return;
      clearTimeout(__autoCodeTimer);
      __autoCodeTimer = setTimeout(function () {
        var v = String(resourceCodeInput.value || '').trim();
        if (v.length >= 8 && v !== __lastAutoCode) { __lastAutoCode = v; verifyResourceCode(); }
      }, 300);
    });
    // 手机端键盘适配：输入框获得焦点时，确保不被软键盘遮挡
    resourceCodeInput.addEventListener('focus', function () {
      var input = this;
      // 延迟等待软键盘弹出，然后滚动到输入框可见位置
      setTimeout(function () {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });

    // 无资源码时：直接查看按钮，点击向服务端请求专属内容（R92：内容不再随公开接口下发）
    var resourceDirectBtn = document.getElementById('resourceDirectBtn');
    var resourceDirectRow = document.getElementById('resourceDirectRow');
    if (resourceDirectBtn) {
      resourceDirectBtn.addEventListener('click', function () {
        var btn = this;
        var btnText = btn.textContent;
        if (btn.disabled) return;
        btn.disabled = true; if (window.__btnBusy) window.__btnBusy(btn, '获取中'); else btn.textContent = '获取中';
        requestResourceUnlock('', 400).then(function (res) { /* R231 条16：同三段式（400ms 后行淡出+内容展开） */
          btn.disabled = false; btn.textContent = btnText;
          if (res === null) return;
          if (res && res.ok && res.content) {
            /* R231 条16：绿✓「已获取」三段式；行隐藏由 requestResourceUnlock 统一 150ms 淡出（条17） */
            try {
              btn.textContent = '✓ 已获取';
              btn.style.background = 'var(--green, #2e7d32)';
              btn.style.borderColor = 'var(--green, #2e7d32)';
              btn.style.color = '#fff';
              setTimeout(function () {
                btn.textContent = btnText; btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = '';
              }, 400);
            } catch (e0) { if (window.__silent) window.__silent(e0); }
          } else {
            resourceCodeError.textContent = (res && res.msg) || '获取失败';
            resourceCodeError.style.display = 'block';
          }
        });
      });
    }

    // ---------- 搜索（300ms 防抖） ----------
    var searchClear = document.getElementById('searchClear');
    var searchTimer = null;
    // v294（用户 10-04 02:14）：172 搜索框回车立即触发搜索
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { clearTimeout(searchTimer); currentPage = 1; __fadeRenderProducts(); }
    });
    searchInput.addEventListener('input', function () {
      searchClear.classList.toggle('show', this.value.length > 0);
      clearTimeout(searchTimer);
      var self = this;
      searchTimer = setTimeout(function () {
        currentPage = 1;
        // v294（用户 10-04 02:14）：214 搜索关键词存localStorage
        try { if (self.value.trim()) localStorage.setItem('wnzyq_shop_search', self.value.trim()); else localStorage.removeItem('wnzyq_shop_search'); } catch (e) { if (window.__silent) window.__silent(e); }
        __fadeRenderProducts(function () {
          if (self.value.trim()) window.pushSearchHist('wnzyq_shop_search_hist', self.value); /* R186 建议1：搜索稳定 300ms 后记录 */
        }); /* R243（用户 09-22 23:18）：条15 搜索切换统一翻页同款过渡 */
      }, 300);
    });
    searchClear.addEventListener('click', function () {
      searchInput.value = '';
      this.classList.remove('show');
      __fadeRenderProducts(); /* R243（用户 09-22 23:18）：条15 搜索清空统一翻页同款过渡 */
      searchInput.focus();
    });
    /* R186 建议1：搜索历史下拉（值为空 focus 时显示，复用 tab 胶囊 + 灰圆小 ×）；
       本脚本先于 ui-common.js 加载，同步阶段组件未定义 → load 后兜底绑定 */
    (function () {
      var __bindSH = function () { window.bindSearchHist(document.querySelector('.search-box'), searchInput, 'wnzyq_shop_search_hist'); };
      if (window.bindSearchHist) __bindSH(); else window.addEventListener('load', __bindSH);
    })();

    /* R243 条19②：Ctrl+K 命令面板（入口仅键盘，页面零新增图标/按键）——
       前台命令 = 资源直达：搜到资源回车直接打开详情弹窗（openModal，与 ?pid= 分享链接同一通道）；
       面板本体由 ui-common.js __cpPanel 全站组件提供，本页只传命令源（load 后兜底，同搜索历史时序）
       v318（用户 10-05 22:06）：命令面板数据源改用 __allProductsForCmd（后台拉取的全量数据），搜得到非第一页资源；若全量还没回来，先用 DATA.products 兜底。 */
    (function () {
      var __bindCP = function () {
        if (!window.__cpPanel) return;
        window.__cpPanel({
          placeholder: '请输入资源名', /* R285 条38：口径统一「动作+对象」（回车直达详情属功能说明，并入 help/title） */
          status: function () { return __allCmdState === 'ready' ? null : __allCmdState; }, /* v327：全量数据没回来=loading，失败=error，面板显示对应状态小字 */
          cmds: function () {
            var c = [];
            var _src = __allProductsForCmd || DATA.products || [];
            _src.forEach(function (p) {
              if (p.is_online !== true && p.is_online !== 1) return;
              if (p.is_hidden === true || p.is_hidden === 1) return;
              c.push({ lab: String(p.title || '(无标题)'), tag: '资源', kw: String(p.title || ''), run: function () { try { openModal(p); } catch (e) { if (window.__silent) window.__silent(e); } } });
            });
            return c;
          }
        });
      };
      if (window.__cpPanel) __bindCP(); else window.addEventListener('load', __bindCP);
    })();

    // ---------- R183 条18：桌面端「/」直达搜索框；Esc 清空搜索（弹窗全关时） ----------
    document.addEventListener('keydown', function (e) {
      var __anyOpen = document.querySelector('.modal-mask.open, .share-mask.open, .kf-mask.open, .lightbox.open');
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (__anyOpen) return;
        if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) return; /* 仅桌面（细指针） */
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === 'Escape' && !__anyOpen) {
        if (document.activeElement === searchInput) {
          if (searchInput.value) {
            searchInput.value = '';
            searchClear.classList.remove('show');
            currentPage = 1;
            renderProducts();
          } else searchInput.blur();
        }
      }
    });

    // ---------- Toast 轻提示 ----------
    /* R231（用户 09-21 23:38）条11：队列抽公共到 ui-common.js window.uiToast——观感改走 .ui-toast
       公共类（白底0.92+蓝字+圆角20 规格不变），入场带下落分量（uiToastDrop 240ms）；错误红语义不变 */
    function showToast(msg, type) { window.uiToast(msg, type); }
    window.toast = showToast;

    // ---------- 顶栏：咨询客服 ----------
    topContactBtn.addEventListener('click', function () {
      var url = window._globalContact || getDefaultContact();
      // R20：点击后按钮保持激活白底（与管理页退出一致：弹窗未关闭期间按键呈白色），弹窗关闭后自动恢复
      topContactBtn.classList.add('active');
      // R13：补传第 4 参（跳转键文案）——引入公共客服弹窗时漏传导致跳转键被隐藏，旧版本来有，恢复
      if (url) { if (window.openContactModal) { window.openContactModal(url, window.__kefuQrSrc(), null, '跳转-咨询在线客服'); } else { window.openContactFallback(url); } }
      else showToast('暂未设置客服链接', 'info');
    });

    // ---------- 顶栏：分享本页（点击即复制链接 + 弹窗提示） ----------
    topShareBtn.addEventListener('click', openShare);

    // R20：客服/分享弹窗全部关闭后，移除顶栏两键的激活白底（与弹窗开合状态同步）
    (function () {
      function anyModalOpen() {
        var kf = document.getElementById('kfMask');
        var sh = document.getElementById('shareMask');
        return (kf && kf.classList.contains('open')) || (sh && sh.classList.contains('open'));
      }
      function sync() {
        if (!anyModalOpen()) { topContactBtn.classList.remove('active'); topShareBtn.classList.remove('active'); }
      }
      var mo = new MutationObserver(sync);
      function observe() {
        var kf = document.getElementById('kfMask');
        var sh = document.getElementById('shareMask');
        if (kf) mo.observe(kf, { attributes: true, attributeFilter: ['class'] });
        if (sh) mo.observe(sh, { attributes: true, attributeFilter: ['class'] });
      }
      observe();
      // 客服弹窗是首次点击才动态创建的，创建后再挂一次监听
      var _okf = document.getElementById('openContactModal');
      if (window.openContactModal) {
        var _orig = window.openContactModal;
        window.openContactModal = function (a, b, c, d) { var r = _orig.call(this, a, b, c, d); observe(); return r; };
      }
      setInterval(sync, 800) /* v336 条60：保留兜底但由 observer 触发后自停——见下方清除 */; // 兜底轮询：observer 意外失效时也能恢复
    })();

    function openShare() {
      try {
        topShareBtn.classList.add('active'); // R20：弹窗打开期间白底
        var url = window.location.href;
        if (shareLinkText) shareLinkText.textContent = url;
        // R79：统一分享复制链路——与资源卡片分享/预览分享/弹窗链接点击同一套
        // （R138：clipboard.writeText 异步复制零阻塞），提示文案全站统一
        if (window.__shareCopyText) {
          try { window.__shareCopyText(url); } catch (e) { if (window.__silent) window.__silent(e); }
        } else {
          try { fallbackCopy(url); } catch (e) { if (window.__silent) window.__silent(e); }
        }
        // R209（用户 09-19 00:41）：根因→__copyOk 的 .copy-ok 给链接文字加整块绿底；修法→链接文字专用绿字反馈
        if (shareLinkText) { try { shareLinkText.classList.add('copy-ok-text'); setTimeout(function(){ try{ shareLinkText.classList.remove('copy-ok-text'); }catch (e) { if (window.__silent) window.__silent(e); } }, 1500); } catch (e) { if (window.__silent) window.__silent(e); } }
        showToast('链接已复制到剪贴板', 'success');
        if (shareMask) { shareMask.classList.add('open'); setBodyLock(true); }
      } catch (e) {

        if (shareMask) { shareMask.classList.add('open'); setBodyLock(true); }
      }
    }

    function closeShare() {
      shareMask.classList.remove('open'); setBodyLock(false);
    }

    shareClose.addEventListener('click', closeShare);
    // R22：弹窗里的蓝色链接点击=再次复制并提示（与资源分享弹窗行为一致）
    if (shareLinkText) {
      shareLinkText.style.cursor = 'pointer';
      shareLinkText.title = '点击复制链接';
      shareLinkText.addEventListener('click', function () {
        var url = shareLinkText.textContent || '';
        if (!url) return;
        // R79+R138：统一走公共复制链路（异步 clipboard API），文案统一
        if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch (e) { if (window.__silent) window.__silent(e); } }
        else { try { fallbackCopy(url); } catch (e) { if (window.__silent) window.__silent(e); } }
        // R209（用户 09-19 00:41）：根因→__copyOk 的 .copy-ok 给链接文字加整块绿底；修法→链接文字专用绿字反馈
        if (shareLinkText) { try { shareLinkText.classList.add('copy-ok-text'); setTimeout(function(){ try{ shareLinkText.classList.remove('copy-ok-text'); }catch (e) { if (window.__silent) window.__silent(e); } }, 1500); } catch (e) { if (window.__silent) window.__silent(e); } }
        showToast('链接已复制到剪贴板', 'success');
      });
    }

    shareMask.addEventListener('click', function (e) {
      if (e.target === shareMask) closeShare(); // R217：恢复点外关闭（R215 误删）
    });

    function fallbackCopy(url) {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* 弹窗里仍可手动选中复制 */ }
      if (ta.parentNode) ta.parentNode.removeChild(ta);
    }

    // R243 条35：localStorage 写入前先比对，内容变了才写（减少写入次数、延长存储寿命）
    var __cacheTimer = null, __cachePending = null;
    function __setShopCache(key, obj) {
      /* v343 条4：写入时带上“格式版本号”，格式变了旧数据自动作废（不再出现升级后错乱） */
      try { if (obj && typeof obj === 'object') obj.__schema = (window.WN_CONST && window.WN_CONST.CACHE_SCHEMA) || 4; } catch (e) { if (window.__silent) window.__silent(e); }
      try {
        /* v333 修：原来整份覆盖——切分类/搜索/翻页时用「只有 products + categories 两个字段」的对象
           把首屏那份完整缓存（含公告、店铺名、版本号 _homeVersion）冲掉，导致每次进页面都被当成
           没有版本号的旧缓存（全量重传）+ 公告丢失。改为与旧缓存合并写入。 */
        var merged = obj || {};
        var old = localStorage.getItem(key);
        if (old) {
          try {
            var prev = JSON.parse(old);
            if (prev && typeof prev === 'object') {
              for (var k in prev) { if (!(k in merged)) merged[k] = prev[k]; }
            }
          } catch (e2) { if (window.__silent) window.__silent(e2); }
        }
        var json = JSON.stringify(merged);
        /* v343 条19：写本地暂存做 400ms 节流合并，避免频繁读写卡顿 */
        __cachePending = { key: key, json: json };
        if (__cacheTimer) clearTimeout(__cacheTimer);
        __cacheTimer = setTimeout(function () {
          try { var pd = __cachePending; if (pd && localStorage.getItem(pd.key) !== pd.json) localStorage.setItem(pd.key, pd.json); } catch (e) { if (window.__silent) window.__silent(e); }
        }, 400);
      } catch (e) { if (window.__silent) window.__silent(e); }
    }

    // ---------- 数据加载：本地秒开 + 后端异步升级 ----------
    function loadFallback() {
      var cfg = (typeof SHOP_CONFIG !== 'undefined') ? SHOP_CONFIG : null;
      DATA.categories = cfg && cfg.categories ? cfg.categories.map(function (c) {
        return { id: c.id, name: c.name, parent_id: c.parent_id || 0, is_hidden: c.is_hidden || 0 };
      }) : [{ id: 0, name: '全部', parent_id: 0 }];
      DATA.products = cfg && cfg.productList ? cfg.productList.map(function (p) {
        return {
          id: p.id, cid: p.cid, title: p.title, desc: p.desc, detail: p.detail,
          img: p.img, detailImages: p.detailImages || [], detailVideos: p.detailVideos || [],
          contactUrl: p.contactUrl || '', price: p.price || 0,
          variants: (p.variants || []).map(function (v) {
            return {
              id: v.id, name: v.name, desc: v.desc, img: v.img, video: v.video,
              contactUrl: v.contactUrl || '', price: v.price || 0, sort: v.sort || 0,
              // R92：只保留标志不存明文（旧 config 兜底数据里若有码也一并派生标志）
              hasCode: !!(v.hasCode || (v.resourceCode && String(v.resourceCode).trim())),
              hasContent: !!(v.hasContent || (v.resourceContent && String(v.resourceContent).trim()))
            };
          }),
          is_online: p.is_online, is_hidden: p.is_hidden || 0
        };
      }) : [];
    }

    function renderAll() {
      renderShopInfo();
      renderAnnouncement();
      renderCategories();
      renderProducts();
    }

    // R257：parseAnnouncements 已合并到 ui-common.js

    // ---------- R193 二① 方案A（用户 22:32 拍板）：骨架屏 ----------
    // 骨架数量 = PAGE_SIZE（与每页真实条数一致）；数据到达后逐条渐变成真卡（30ms 错峰淡入），不先空后闪
    function renderSkeleton() {
      productGrid.innerHTML = '';
      emptyTip.classList.remove('show');
      // R273：骨架屏跟随当前显示模式（网格/列表）
      productGrid.classList.toggle('list-view', currentView === 'list');
      var frag = document.createDocumentFragment();
      for (var i = 0; i < PAGE_SIZE; i++) {
        var sk = document.createElement('div');
        sk.className = 'product-card card-skeleton';
        sk.setAttribute('aria-hidden', 'true');
        sk.innerHTML = '<div class="sk-img"></div><div class="card-body"><div class="sk-line w70"></div><div class="sk-line w95"></div></div>';
        frag.appendChild(sk);
      }
      productGrid.appendChild(frag);
    }

    /* R289：进页预载标志——true 表示正在执行页面首次加载（进度条可见），false 表示页内操作期 */
    window.__shopEntryDone = false;
    function initData() {
      // R10 分享链接：检查 ?pid=参数——带 pid 进入时跳过公告自动弹出（用户意图是直达该资源），
      // 数据加载完成后自动打开对应资源弹窗；资源不存在/已隐藏时公共弹窗提示
      var sharePid = null;
      try {
        var _pidRaw = new URLSearchParams(window.location.search).get('pid');
        if (_pidRaw && /^\d+$/.test(_pidRaw)) sharePid = Number(_pidRaw);
      } catch (e) { if (window.__silent) window.__silent(e); }
      window.__sharePid = sharePid;
      if (sharePid) { window.__annDismissed = true; window.__annShown = false; }
      var hasCache = false;
      var cachedVersion = '';
      // 先读 localStorage 缓存，秒开
      try {
        var cached = localStorage.getItem('wnzyq_shop_data');
        /* v343 条4：读取校验格式版本号，不一致直接当没有缓存 */
        try { if (cached) { var _cs = JSON.parse(cached); if (_cs && _cs.__schema !== ((window.WN_CONST && window.WN_CONST.CACHE_SCHEMA) || 4)) cached = null; } } catch (e) { cached = null; }
        if (cached) {
          var c = JSON.parse(cached);
          if (c.products && c.categories) {
            // R92：旧缓存可能存有资源码/专属内容明文（现在明文只走服务端解锁接口）——
            // 派生标志后删明文字段，并写回缓存，升级后老访客本地也立即干净
            DATA.products = (c.products || []).map(function (p) {
              (p.variants || []).forEach(function (v) {
                if (v.hasCode === undefined) v.hasCode = !!(v.resourceCode && String(v.resourceCode).trim());
                if (v.hasContent === undefined) v.hasContent = !!(v.resourceContent && String(v.resourceContent).trim());
                delete v.resourceCode; delete v.resourceContent;
              });
              return p;
            });
            c.products = DATA.products;
            __setShopCache('wnzyq_shop_data', c);
            DATA.categories = c.categories;
            if (c.announcement !== undefined) DATA.announcement = c.announcement;
            if (c.announcement_mode !== undefined) DATA.announcementMode = c.announcement_mode;
            if (Array.isArray(c.announcements)) DATA.announcements = c.announcements;
            if (c.shop_name) DATA.shopName = c.shop_name;
            cachedVersion = c._homeVersion || '';
            usingRemote = true;
            hasCache = true;
          }
        }
      } catch (e) { if (window.__silent) window.__silent(e); }
      // 没有缓存时：本地环境（file://）走 config.js 兜底；线上首访铺骨架屏（R193 二① 方案A / R255 内嵌 HTML），数据到达逐条渐变替换
      if (!hasCache) {
        if (window.location.protocol === 'file:') {
          loadFallback();
        } else {
          window.__skelPhase = true;
          // R255：骨架已内嵌在 shop.html，有则不复建，避免闪两下/残影
          var hasSkel = productGrid.querySelectorAll('.card-skeleton').length > 0;
          if (!hasSkel) renderSkeleton();
        }
      }
      renderAll();
      // file:// 协议直接打开 HTML 时不发起 API 请求（无后端）；localhost/wrangler dev 正常走 API
      var isFile = window.location.protocol === 'file:';
      if (!isFile) {
        // R308：进页请求合一——只发一次 /api/shop/home，带版本号缓存
        if (window.__enterPageEntryMode) window.__enterPageEntryMode();
        loadShopHome({ cachedVersion: cachedVersion }).then(function () {
          window.__shopEntryDone = true;
          if (window.__exitPageEntryMode) window.__exitPageEntryMode();
          // v319（用户 10-05 22:15）：根因→首屏只拿「全部」第一页，切分类时现场拉取老板看到「点进去才加载」；
          // 修法→首屏成功后后台并行预加载各分类第一页（每分类20条）到内存缓存，切分类直接秒出。
          __preloadCategoryFirstPages();
        }).catch(function () {
          window.__shopEntryDone = true;
          if (window.__exitPageEntryMode) window.__exitPageEntryMode();
          __failFinish(); /* v335：网络错误不再静默，显示加载失败+重试 */
        });
      } else {
        window.__shopEntryDone = true;
      }
    }

    // R308：进页请求合一 + 数据没变不重传 + 优先缓存
    function loadShopHome(opts) {
      opts = opts || {};
      var cachedVersion = opts.cachedVersion || '';
      var fetchOpts = opts.force ? { cache: 'no-store' } : { cache: 'no-cache' };
      var ts = opts.force ? ('&_t=' + Date.now()) : '';
      /* v335 修：原版三个失败出口（请求挂了/返回不是正常数据/接口说失败）全是“静默返回”——
         骨架标记永远不关、公告弹窗永远挂着灰条、列表永远转圈，用户什么都等不到。
         现在统一走“失败收尾”：关骨架、立失败标记，让页面显示「加载失败 + 点我重试」。 */
      function __failFinish() {
        window.__loadFailed = true;
        if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
        renderAll();
      }
      return __dedupFetch('/api/shop/home?v=' + encodeURIComponent(cachedVersion) + ts, fetchOpts)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) {
          if (!res) { __failFinish(); return; }
          if (res.unchanged === true) {
            window.__lastFetchTime = Date.now();
            return;
          }
          if (!res.ok) { __failFinish(); return; }
          // 解包产品
          // v317（用户 10-05 18:40）：老板拍板规则1/2/3/4+优化2/3/4，首屏只拿第一页，翻页/切分类/搜索点到才拉+缓存秒出
          if (res.products) {
            DATA.products = res.products.list || [];
            DATA.total = res.products.total || 0;
            DATA.totalPages = res.products.total_pages || 1;
            DATA.page = res.products.page || 1;
            DATA._backendPaged = true;
          }
          // 解包分类
          if (res.categories) {
            DATA.categories = res.categories;
          }
          // 解包设置
          if (res.settings) {
            DATA.announcement = res.settings.announcement || '';
            DATA.announcementMode = res.settings.announcement_mode || 'always';
            DATA.announcements = window.parseAnnouncements(res.settings, { filterHidden: true });
            if (res.settings.shop_name) DATA.shopName = res.settings.shop_name;
            window._globalContact = res.settings.contact_url || getDefaultContact();
            if (window.__kfPreconnect) window.__kfPreconnect(window._globalContact);
          }
          // 更新缓存（带版本号）
          __setShopCache('wnzyq_shop_data', {
            products: DATA.products,
            categories: DATA.categories,
            announcement: DATA.announcement,
            announcement_mode: DATA.announcementMode,
            announcements: DATA.announcements,
            shop_name: DATA.shopName,
            _homeVersion: res.version || ''
          });
          usingRemote = true;
          window.__lastFetchTime = Date.now();
          // 骨架期结束或数据有变才渲染
          var _wasSkel = !!window.__skelPhase;
          if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
          renderAll();
          checkSharePid(true);
        }).catch(function () {
          if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
          renderAll();
          checkSharePid(false);
        });
    }

    // R243 条32：上次拉取时间戳（visibilitychange 60s 缓存判定用）
    window.__lastFetchTime = 0;
    // v312（用户 10-05 15:21）：根因→后端分页下每次切分类都发网络请求，期间旧内容淡出成空白等待；
    // 修法→分类/搜索/翻页内存缓存——看过的组合(cid+subCid+kw+page)存内存，再切回来立即渲染零等待，后台静默刷新（stale-while-revalidate）。
    function fetchRemote(opts) {
      opts = opts || {};
      var page = Math.max(1, opts.page || 1);
      var pageSize = opts.pageSize || PAGE_SIZE;
      var cid = opts.cid !== undefined ? opts.cid : currentCat;
      var subCid = opts.subCid !== undefined ? opts.subCid : currentSubCat;
      var kw = opts.kw !== undefined ? opts.kw : (searchInput.value || '').trim();
      var key = __cacheKey(page, cid, subCid, kw);
      var cached = __pageCache[key];

      // 内部：执行真实网络请求，把数据写到 DATA 和 localStorage
      function doRealFetch() {
        if (__pageCacheLoading[key]) return __pageCacheLoading[key];
        var fetchOpts = opts.force ? { cache: 'no-store' } : { cache: 'no-cache' };
        var ts = opts.force ? ('?_t=' + Date.now()) : '';
        var qs = '?page=' + page + '&page_size=' + pageSize;
        /* v338 条40：列表瘦身——详情大字段不随列表下发，打开详情时按 id 单拉（详情弹窗自动补拉） */
        qs += '&brief=1';
        /* v336 条53：分类与设置几乎不变——本会话第二次起只拉资源本身，请求数从 3 降到 1 */
        var _onlyProducts = __catsSettingsCached;
        if (cid > 0) qs += '&cid=' + cid;
        if (subCid > 0) qs += '&sub_cid=' + subCid;
        if (kw) qs += '&kw=' + encodeURIComponent(kw);
        function withTimeout(p, ms) {
          return Promise.race([p, new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); })]);
        }
        var _oldProducts = JSON.stringify(DATA.products || []);
        var _oldCategories = JSON.stringify(DATA.categories || []);
        var _oldAnn = DATA.announcement;
        var _oldAnnMode = DATA.announcementMode;
        var _oldShopName = DATA.shopName;
        /* v343 条18：分类与设置极少变化——内存记 60 秒，切分类/翻页时不再重复拉（3 请求 → 1 请求） */
        var __mc = window.__shopMetaCache || (window.__shopMetaCache = { cats: null, sets: null, t: 0 });
        var __metaFresh = !!opts.force || !__mc.cats || (Date.now() - (__mc.t || 0) > 60000);
        function __metaFetch(url, key) {
          if (!__metaFresh && __mc[key]) {
            return Promise.resolve(key === 'cats' ? { ok: true, list: __mc.cats } : { ok: true, settings: __mc.sets });
          }
          return withTimeout(__dedupFetch(url + ts, fetchOpts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), 10000);
        }
        __pageCacheLoading[key] = Promise.all([
          withTimeout(__dedupFetch('/api/products' + qs + (ts ? ts.replace('?', '&') : ''), fetchOpts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), 10000) /* v336 条11：与后台统一 10 秒 */,
          __metaFetch('/api/categories', 'cats'),
          __metaFetch('/api/settings', 'sets')
        ]).then(function (res) {
          var _changed = false;
          if (res[0] && res[0].ok && res[1] && res[1].ok) {
            DATA.products = res[0].list || [];
            DATA.categories = res[1].list || []; try { __mc.cats = DATA.categories; __mc.t = Date.now(); } catch (e) { if (window.__silent) window.__silent(e); }
            usingRemote = true;
            // v317（用户 10-05 18:40）：恢复后端分页，fetchRemote 走真实网络请求，_backendPaged=true
            if (res[0].total_pages !== undefined) {
              DATA.total = res[0].total || 0;
              DATA.totalPages = res[0].total_pages || 1;
              DATA.page = res[0].page || 1;
              DATA._backendPaged = true;
            } else {
              DATA._backendPaged = true;
            }
            __setShopCache('wnzyq_shop_data', { products: DATA.products, categories: DATA.categories });
            if (JSON.stringify(DATA.products) !== _oldProducts || JSON.stringify(DATA.categories) !== _oldCategories) _changed = true;
          }
          if (res[2] && res[2].ok) {
            var _newAnn = (res[2].settings || {}).announcement || '';
            var _newAnnMode = (res[2].settings || {}).announcement_mode || 'always';
            if (!_newAnn && !(res[2].settings || {}).announcements) {
              try { localStorage.removeItem('wnzyq_ann_date'); localStorage.removeItem('wnzyq_ann_session'); } catch (e) { if (window.__silent) window.__silent(e); }
            }
            DATA.announcement = _newAnn;
            DATA.announcementMode = _newAnnMode;
            DATA.announcements = window.parseAnnouncements(res[2].settings || {}, { filterHidden: true });
            try { __mc.sets = res[2].settings || {}; __mc.t = Date.now(); } catch (e) { if (window.__silent) window.__silent(e); }
            if ((res[2].settings || {}).shop_name) { DATA.shopName = res[2].settings.shop_name; }
            window._globalContact = (res[2].settings || {}).contact_url || getDefaultContact();
            if (window.__kfPreconnect) window.__kfPreconnect(window._globalContact);
            try {
              var cacheData = JSON.parse(localStorage.getItem('wnzyq_shop_data') || '{}');
              cacheData.announcement = DATA.announcement;
              cacheData.announcement_mode = DATA.announcementMode;
              cacheData.announcements = DATA.announcements;
              if (DATA.shopName) cacheData.shop_name = DATA.shopName;
              __setShopCache('wnzyq_shop_data', cacheData);
            } catch (e) { if (window.__silent) window.__silent(e); }
            if (DATA.announcement !== _oldAnn || DATA.announcementMode !== _oldAnnMode || DATA.shopName !== _oldShopName) _changed = true;
          }
          var _wasSkel = !!window.__skelPhase;
          if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
          window.__lastFetchTime = Date.now();
          // 写内存缓存
          __pageCache[key] = {
            products: DATA.products, categories: DATA.categories,
            total: DATA.total, totalPages: DATA.totalPages, page: DATA.page, _backendPaged: DATA._backendPaged,
            announcement: DATA.announcement, announcementMode: DATA.announcementMode,
            announcements: DATA.announcements, shopName: DATA.shopName,
            _globalContact: window._globalContact,
            _changed: _changed, _wasSkel: _wasSkel
          };
          // v318（用户 10-05 22:06）：主列表数据回来后，后台静默拉命令面板全量数据（只执行一次，不影响主列表）。
          /* v336 条42：改为首次按 Ctrl+K 才拉全量，进页不再拉 */ void 0; /* __loadAllProductsForCmd(); */
          return { changed: _changed, wasSkel: _wasSkel };
        }).catch(function (err) {
          if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
          /* v330 条21：真失败且列表空 → 就地给「重试」按钮（不再只弹提示、不用手动刷新页面）
             v335 改：原来的重试提示挂在整页骨架的末尾（两屏开外），第一屏全是灰条、
             用户根本看不到重试入口。现改为设置“加载失败”标记，空态区直接显示
             「加载失败，请点按钮重试」大按钮（见 renderProducts 空态分支），一眼可见。 */
          window.__loadFailed = true;
          throw err;
        });
        return __pageCacheLoading[key];
      }

      // v312：有缓存且非 force → 立即用缓存数据写 DATA 并 resolve，同时后台静默刷新（stale-while-revalidate）
      if (cached && !opts.force) {
        DATA.products = cached.products;
        DATA.categories = cached.categories;
        DATA.total = cached.total;
        DATA.totalPages = cached.totalPages;
        DATA.page = cached.page;
        DATA._backendPaged = cached._backendPaged;
        DATA.announcement = cached.announcement;
        DATA.announcementMode = cached.announcementMode;
        DATA.announcements = cached.announcements;
        if (cached.shopName) DATA.shopName = cached.shopName;
        if (cached._globalContact) window._globalContact = cached._globalContact;
        usingRemote = true;
        // 后台静默刷新：回来后如果当前显示的还是同一个 key，且数据有变，才重渲染
        doRealFetch().then(function (res) {
          var curKey = __cacheKey(currentPage, currentCat, currentSubCat, (searchInput.value || '').trim());
          if (curKey === key && res.changed) { renderAll(); }
        }).catch(function () {});
        return Promise.resolve();
      }

      // v315（用户 10-05 17:33）：进度条全删——老板不要进度条
      return doRealFetch();
    }

    // v318（用户 10-05 22:06）：命令面板走 page_size=0 全量通道，后台静默拉取，不影响主列表分页。
    // v327（用户要求）：补加载状态——命令面板搜索时数据没回来显示「搜索中…」、失败显示「搜索失败，请重试」，不再白屏。
    var __allProductsForCmd = null;
    var __allCmdState = 'loading'; /* loading=还在拉全量 | ready=就绪 | error=拉取失败 */
    function __cmdNotify() { try { if (window.__cpPanelInst && window.__cpPanelInst.refresh) window.__cpPanelInst.refresh(); } catch (e) { if (window.__silent) window.__silent(e); } }
    function __loadAllProductsForCmd() {
      if (__allProductsForCmd) return; // 只拉一次
      __dedupFetch('/api/products?page_size=0&brief=1', { cache: 'no-cache', credentials: 'include' }).then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (res) {
        if (res && res.ok && res.list) {
          __allProductsForCmd = (res.list || []).filter(function (p) {
            return (p.is_online === true || p.is_online === 1) && (p.is_hidden !== true && p.is_hidden !== 1);
          });
          __allCmdState = 'ready';
        } else {
          __allCmdState = 'error';
        }
        __cmdNotify(); /* 面板开着时数据到了/失败了，立即重画状态小字 */
      }).catch(function () { __allCmdState = 'error'; __cmdNotify(); });
    }

    // v319（用户 10-05 22:15）：根因→首屏只拿「全部」第一页，切分类时现场拉取老板看到「点进去才加载」；
    // 修法→首屏成功后后台并行预加载各分类第一页到内存缓存，切分类直接秒出。上限安全线：产品+分类总数>500条时只预加载前8个分类并报数。
    function __preloadCategoryFirstPages() {
      /* v336 条41：等浏览器空闲再预载、只预载前 3 个分类——首屏后不再一口气连发十几个请求 */
      var _cats = (DATA.categories || []).filter(function (c) { return (c.parent_id || 0) === 0 && !c.is_hidden; }).slice(0, 3);
      var _run = function () { __preloadReal(_cats); };
      if (window.requestIdleCallback) requestIdleCallback(_run, { timeout: 4000 }); else setTimeout(_run, 2500);
    }
    function __preloadReal(_cats) {
      var cats = (DATA.categories || []).filter(function (c) { return !c.parent_id || Number(c.parent_id) === 0; });
      var totalItems = (DATA.products || []).length + cats.length;
      if (totalItems > 500) {
        try { console.log('[v319] 预加载跳过：产品+分类=' + totalItems + ' > 500 安全线'); } catch (e) { if (window.__silent) window.__silent(e); }
        return;
      }
      cats.forEach(function (c) {
        if (Number(c.id) === 0) return; // 「全部」已在首屏加载
        // 只预加载第一页，后台静默执行，不阻塞、不弹错误
        fetchRemote({ page: 1, cid: c.id, subCid: 0, kw: '' }).catch(function () {});
      });
    }

    // ---------- R10 分享链接落地：?pid= 自动打开资源弹窗 ----------
    // fromRemote=true 表示数据来自远端接口（可信），查不到资源时提示"该资源已隐藏或不存在"；
    // fromRemote=false（网络异常、只有本地缓存）查不到时静默处理，避免缓存过期误报失效。
    // 处理成功后清理 URL 中的 pid 参数，避免刷新/分享造成重复弹窗。
    var __pidHandled = false;
    function checkSharePid(fromRemote) {
      if (__pidHandled) return;
      var pid = window.__sharePid;
      if (!pid) return;
      __pidHandled = true;
      var p = (DATA.products || []).find(function (x) { return Number(x.id) === pid; });
      if (p) {
        try { openModal(p); } catch (e) { if (window.__silent) window.__silent(e); }
      } else if (fromRemote) {
        /* v349：首屏只拉前 20 条，排在第 21 位以后的资源在本地列表里根本不存在，
           会被误判成「该资源已隐藏或不存在」——资源其实好好的。
           现在先按 id 单拉一次确认，真的查不到/已隐藏才报错。 */
        var __fail = function () { showToast('该资源已隐藏或不存在', 'error'); /* R118：与全站 toast 胶囊统一 */ };
        __dedupFetch('/api/products?id=' + encodeURIComponent(pid), { cache: 'no-cache', credentials: 'include' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (res) {
            var full = (res && res.ok && res.product) ? res.product : null;
            if (full && !full.is_hidden) {
              if (!(DATA.products || []).some(function (x) { return Number(x.id) === Number(full.id); })) DATA.products.push(full);
              try { openModal(full); } catch (e) { if (window.__silent) window.__silent(e); }
            } else __fail();
          }).catch(__fail);
      }
      try {
        var u = new URL(window.location.href);
        u.searchParams.delete('pid');
        window.history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : ''));
      } catch (e) { if (window.__silent) window.__silent(e); }
      window.__sharePid = null;
    }

    // ---------- 顶栏高度自适应 ----------
    function updateTopbarHeight() {
      var h = document.querySelector('.topbar').offsetHeight;
      document.documentElement.style.setProperty('--topbar-h', h + 'px');
    }
    window.addEventListener('resize', updateTopbarHeight);
    window.addEventListener('resize', function () {
      // R246（用户 09-23 12:33）：窗口变化后指示条重新精确定位（getBoundingClientRect + transform 过渡）
      var bar = document.getElementById('categoryBar');
      if (bar) updateCatIndicator(bar);
    });
    // R292（用户 09-29）：一分钟是唯一同步节点，切回不触发检查

    // ---------- 下拉刷新（手机端页面顶部下拉刷新数据） ----------
    var pullRefreshEl = document.getElementById('pullRefresh');
    var topbarEl = document.querySelector('.topbar'); // 提前定义，供下拉刷新使用
    var pullStartY = 0;
    var pullStartX = 0;
    var isPulling = false;
    var pullDistance = 0;
    var PULL_THRESHOLD = 60; // 下拉超过60px触发刷新
    // v319（用户 10-05 22:15）：根因→弹窗内下拉滚动穿透到 body 触发整页下拉刷新；
    // 修法→下拉刷新前检查所有弹窗类型，任一弹窗打开时不触发。
    function __anyModalOpen() {
      return document.querySelector('.modal-mask.open, .ann-modal.open, .share-mask.open, .kf-mask.open, .lightbox.open') !== null;
    }
    document.addEventListener('touchstart', function (e) {
      if (window.__flipAnimating) return; /* R211 二批：FLIP 飞位期间不判定下拉刷新（手势隔离） */
      if (window.scrollY <= 0 && !__anyModalOpen()) {
        pullStartY = e.touches[0].clientY;
        pullStartX = e.touches[0].clientX;
        isPulling = true;
        pullDistance = 0;
        // 下拉开始时隐藏顶部栏，避免蓝色背景重叠遮挡
        // 顶栏改在 touchmove 确认是下拉动作后才隐藏，避免轻点即隐藏导致点不中 logo/搜索
      }
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!isPulling) return;
      var deltaY = e.touches[0].clientY - pullStartY;
      var deltaX = e.touches[0].clientX - pullStartX;
      // 只响应垂直下拉（垂直位移大于水平位移）
      if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
        pullDistance = Math.min(deltaY * 0.5, 80); // 阻尼效果，最大80px
        // 顶栏常驻：下拉刷新不再隐藏顶栏
        // R170（用户 22:52）：胶囊完整平移跟手（关 transition 防滞后），从 -48px 随手指滑到 0px（=top:80px 位），
        // 替代原"容器高度裁切展开"——划回时胶囊会从下往上被裁掉（残缺消失），平移永不残缺
        var pill = pullRefreshEl.firstElementChild;
        pill.style.transition = 'none';
        pill.style.transform = 'translateY(' + (-48 + pullDistance * 0.6) + 'px)';
        pill.style.opacity = pullDistance > 0 ? String(Math.min(1, pullDistance / 20)) : '0';
        document.getElementById('pullRefreshText').textContent = pullDistance > PULL_THRESHOLD ? '释放立即刷新' : '下拉刷新';
      }
    }, { passive: true });
    document.addEventListener('touchend', function () {
      if (!isPulling) return;
      isPulling = false;
      var pill = pullRefreshEl.firstElementChild;
      pill.style.transition = ''; // R170：恢复 CSS 回弹动画
      if (pullDistance > PULL_THRESHOLD) {
        // 触发刷新
        pill.style.transform = 'translateY(0px)'; // R170：停在 80px 位显示「正在刷新」
        document.getElementById('pullRefreshText').textContent = '正在刷新…';
        window.__annShown = false; window.__annDismissed = false;
        // 清除缓存，重新加载数据
        try { localStorage.removeItem('wnzyq_shop_data'); } catch (e) { if (window.__silent) window.__silent(e); }
        // v312（用户 10-05 15:21）：下拉刷新同时清除内存缓存，确保强制重新拉取
        __pageCache = {}; __pageCacheLoading = {};
        setTimeout(function () {
          if (window.location.protocol === 'file:') {
            loadFallback();
          } else {
            // R308：手动下拉刷新 = 绕过缓存强制重拉，走聚合端点
            loadShopHome({ force: true });
          }
          renderAll();
          pill.style.transform = 'translateY(-48px)'; // R170：完整滑回上方淡出
          pill.style.opacity = '0';
          document.getElementById('pullRefreshText').textContent = '下拉刷新'; // R170：文案复位，避免下次下拉闪现「正在刷新」
          // 刷新结束后显示顶部栏
          if (topbarEl) { topbarEl.style.transition = ''; topbarEl.classList.remove('hidden'); }
        }, 400);
      } else {
        // 未达到阈值，收回——R170：整体滑回上方淡出（完整收回，不再裁切残缺）
        pill.style.transform = 'translateY(-48px)';
        pill.style.opacity = '0';
        // 收回后显示顶部栏
        if (topbarEl) { topbarEl.style.transition = ''; topbarEl.classList.remove('hidden'); }
      }
      pullDistance = 0;
    }, { passive: true });

    // ---------- 回到顶部按钮 + 顶栏自动隐藏（向下滑动隐藏，向上滑动显示，停止滑动保持状态） ----------
    var backTopBtn = document.getElementById('backTop');
    var lastScrollY = 0;
    var scrollTimer = null;
    function checkScroll() {
      var currentY = window.scrollY || document.documentElement.scrollTop || 0;
      var delta = currentY - lastScrollY;
      // 回到顶部按钮
      if (currentY > 400) {
        backTopBtn.classList.add('show');
      } else {
        backTopBtn.classList.remove('show');
      }
      // 顶栏自动隐藏：向下滑动隐藏，向上滑动显示，停止滑动保持当前状态
      // 注意：只做视觉隐藏（transform），不改变 --topbar-h，避免页面高度变化导致抖动
      if (false && delta > 2 && currentY > 120) { // 顶栏常驻：已取消下滑隐藏
        // 向下滑动（超过2px阈值，避免微小抖动）
        topbarEl.classList.add('hidden');
      } else if (delta < -2) {
        // 向上滑动
        if (topbarEl.style.transition === 'none') topbarEl.style.transition = '';
        topbarEl.classList.remove('hidden');
      }
      // delta 在 -2 到 2 之间（停止滑动或微小抖动），保持当前状态，不做处理
      lastScrollY = currentY;

      /* R239（用户 09-22 派单）：无限滚动分支整段退役——资源页从「距底 200px 自动追加下一页」
         改为单页替换；本函数只剩回到顶部按钮与顶栏隐藏两个职责 */
    }
    /* R231 条6：滚动改 rAF ticking（照管理页成熟模式）——原写法每次 scroll 事件同步读 scrollHeight，
       图片加载期布局频繁变化时同步读布局会掉帧；现在一帧最多执行一次，停止滚动 200ms 后最终检查（兜底）不变 */
    var __skTicking = false;
    window.addEventListener('scroll', function () {
      if (!__skTicking) { __skTicking = true; requestAnimationFrame(function () { checkScroll(); __skTicking = false; }); }
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(checkScroll, 200);
    }, { passive: true });
    checkScroll(); // 初始检查
    backTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'auto' }) /* v336 条149：翻页瞬时回顶 */;
    });

    // ---------- 分类栏展开/收起 ----------
    var catToggle = document.getElementById('catToggle');
    var categoryBar = document.getElementById('categoryBar');
    catToggle.addEventListener('click', function () {
      // 不管分类是否超出一行，都切换展开/收回状态
      var _overflow = categoryBar.scrollWidth > categoryBar.clientWidth + 2;
      catExpanded = _overflow ? !catExpanded : false;
      categoryBar.classList.toggle('expanded', catExpanded);
      this.classList.toggle('open', catExpanded);
      if (!_overflow) { var _ar = this.querySelector('.toggle-arrow'); if (_ar) { _ar.style.transform = 'rotate(0deg)'; setTimeout(function () { if (!catExpanded && _ar) _ar.style.transform = 'rotate(-90deg)'; }, 280); } }
      // 用JS直接控制箭头方向，避免CSS transition卡住的bug
      // 展开时箭头向下（rotate 0deg），收回时箭头向左（rotate -90deg）
      var arrow = this.querySelector('.toggle-arrow');
      if (arrow) {
        arrow.style.transform = (!_overflow && !catExpanded) ? 'rotate(0deg)' : (catExpanded ? 'rotate(0deg)' : 'rotate(-90deg)');
      }
      // R246（用户 09-23 12:33）：展开/收起后指示条重新精确定位（布局变化后可能换行）
      setTimeout(function () { updateCatIndicator(categoryBar); }, 50);
    });

    // 二级分类展开/收起
    var subCatToggle = document.getElementById('subCatToggle');
    var subCategoryBar = document.getElementById('subCategoryBar');
    if (subCatToggle && subCategoryBar) {
      subCatToggle.addEventListener('click', function () {
        // 不管分类是否超出一行，都切换展开/收回状态
        var _subOverflow = subCategoryBar.scrollWidth > subCategoryBar.clientWidth + 2;
        subCatExpanded = _subOverflow ? !subCatExpanded : false;
        subCategoryBar.classList.toggle('expanded', subCatExpanded);
        this.classList.toggle('open', subCatExpanded);
        var arrow = this.querySelector('.toggle-arrow');
        if (arrow) {
          if (!_subOverflow && !subCatExpanded) { arrow.style.transform = 'rotate(0deg)'; var _sar = arrow; setTimeout(function () { if (!subCatExpanded && _sar) _sar.style.transform = 'rotate(-90deg)'; }, 280); }
          else arrow.style.transform = subCatExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
      });
    }

    // ---------- ESC 关闭弹窗 ----------
    // R111：Esc 统一走 __modalKit（ui-common.js）逐层关闭——只关最上层并走该层「暂存」通道；
    // 旧的「一次 Esc 同时关资源弹窗+灯箱」handler 已删；灯箱在 openLightbox 创建时注册
    window.addEventListener('DOMContentLoaded', function () {
      var kit = window.__modalKit; if (!kit) return;
      // R112：资源详情弹窗——×=丢弃资源码草稿；点外/Esc=暂存（重开自动回填）；公告/分享纯展示直接关（客服 kfMask 在 ui-common 创建处注册）
      kit.register(modalMask, { discard: closeModalDiscard, stash: closeModalStash }); // R257（老板 09-23 19:08）：Esc=暂存资源码草稿（R147 丢弃口径废除）
      var __am = document.getElementById('annModal');
      if (__am) {
        kit.register(__am, { discard: closeAnnModal, stash: closeAnnModal });
        // R271（用户 09-27 17:30）：补公告弹窗点外关闭（遗漏）
        __am.addEventListener('click', function (e) { if (e.target === __am) closeAnnModal(); });
      }
      kit.register(shareMask, { discard: closeShare, stash: closeShare });
    });

    // ---------- PWA Service Worker 注册：已收编至 ui-common.js 全站统一注册（R34） ----------

    // ---------- 滚动位置记忆 ----------
    var SCROLL_KEY = 'wnzyq_shop_scroll';
    window.addEventListener('beforeunload', function () {
      localStorage.setItem(SCROLL_KEY, window.scrollY);
    });
    // 浏览器返回/回退兜底：bfcache 由 ui-common.js 强制 reload；popstate 与非 persisted pageshow 时，列表为空则重新初始化，杜绝白屏
    function __shopBackGuard() {
      setTimeout(function () { try { var grid = document.getElementById('productGrid'); if (grid && !grid.children.length && typeof initData === 'function') initData(); } catch (err) { if (window.__silent) window.__silent(err); } }, 60);
    }
    // v307：bfcache 恢复时不再强制刷新——根治"切回来闪一下"。公共脚本已同步修复，此处兜底也取消 reload。
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
      }
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) return; __shopBackGuard(); });
    window.addEventListener('popstate', __shopBackGuard);
    var savedScroll = parseInt(localStorage.getItem(SCROLL_KEY) || '0', 10);
    if (savedScroll > 0) {
      setTimeout(function () { window.scrollTo(0, savedScroll); }, 100);
    }

    /* v333 清理：此处原有一整套「旧版下拉刷新」实现，主体是 if (false) { touchStartY = ... }
       —— 永远不可达，却注册了 touchstart/touchmove/touchend 三个全局监听（每次手指移动都空跑一遍），
       并重复 var touchStartY 覆盖上方手势用的起点值。项目真正生效的下拉刷新在上方（initPullRefresh 区域），
       这里整段删除，不影响任何功能。 */

    // ---------- R193 二⑤⑦ + R249（老板 09-23 13:05 定稿）：长按小菜单全站标准化（四类四项制） ----------
    // 长按资源卡片：复制标题 / 复制简介 / 分享资源 / 存二维码
    // 长按图片：保存图片 / 预览大图 / 分享资源 / 存二维码
    // 长按文字（简介/详情）：复制选中 / 复制全文 / 分享资源 / 存二维码
    (function () {
      /* v347：二维码/海报生成已上移到 ui-common.js 全站共享（window.__savePosterPng），此处不再重复实现 */

      function setup() {
      var cm = window.__ctxMenu; if (!cm) return;
      function __cp(text, msg) {
        if (window.__shareCopyText && window.__shareCopyText(text)) { showToast(msg, 'success'); var el = window.__ctxMenuLastHit; if (el && el.classList) { el.classList.add('copy-ok-text'); setTimeout(function(){ el.classList.remove('copy-ok-text'); }, 1500); } }
        else { showToast('复制失败', 'error'); }
      }
      // R257：__saveImage 已合并到 ui-common.js
      function __shareProdFn(p) {
        return function () {
          var url = window.location.origin + window.location.pathname + '?pid=' + p.id;
          if (window.showShareLinkModal) window.showShareLinkModal('分享资源链接', url, (p.title || '') + ' · 资源链接已复制到剪贴板'); // R251：新标题+带资源名灰字
          else __cp(url, '链接已复制到剪贴板');
        };
      }
      /* v347：存二维码——统一走公共层 window.__savePosterPng（生成带站名+资源名的图） */
      function __saveQrFn(p) {
        return function () { if (window.__savePosterPng) window.__savePosterPng(p.id, null, p.title); };
      }
      function imgItems(img, p) {
        var src = img.currentSrc || img.src || '';
        if (!src) return [];
        var items = [
          { label: '保存图片', fn: function () { window.__saveImage(src); } },
          { label: '预览大图', fn: function () { window.openLightbox(src); } }
        ];
        if (p) {
          items.push({ label: '分享资源', fn: __shareProdFn(p) });
          items.push({ label: '存二维码', fn: __saveQrFn(p) });
        }
        return items;
      }
      function textItems(el, p) {
        var full = String(el.innerText || '').trim();
        var items = [{ label: '复制选中', fn: function () {
          var sel = '';
          try { sel = String(window.getSelection ? window.getSelection() : ''); } catch (e) { if (window.__silent) window.__silent(e); }
          if (sel) __cp(sel, '选中内容已复制');
          else showToast('先选中文字，再长按即可复制', 'info');
        } }];
        if (full) items.push({ label: '复制全文', fn: function () { __cp(full, '内容已复制'); } });
        if (p) {
          items.push({ label: '分享资源', fn: __shareProdFn(p) });
          items.push({ label: '存二维码', fn: __saveQrFn(p) });
        }
        return items;
      }
      // 1. 资源卡片（复制标题 / 复制简介 / 分享资源 / 存二维码）
      cm.bind(productGrid, '.product-card:not(.card-skeleton)', function (card) {
        var pid = Number(card.getAttribute('data-pid') || 0);
        var p = (DATA.products || []).find(function (x) { return Number(x.id) === pid; });
        if (!p) return [];
        return [
          { label: '复制标题', fn: function () { __cp(p.title || '', '标题已复制'); } },
          { label: '复制简介', fn: function () { __cp(p.desc || '', '简介已复制'); } },
          { label: '分享资源', fn: __shareProdFn(p) },
          { label: '存二维码', fn: __saveQrFn(p) }
        ];
      });
      // 2. 图片：卡片图 + 详情弹窗内所有图（封面/变体图/富文本插图）
      // R252（老板 09-23 15:22）：列表页卡片封面图长按补齐「分享资源/存二维码」——从所在卡片 data-pid 查资源，
      // 与卡片菜单同款逻辑（旧实现传 currentProduct——那是详情弹窗变量，列表页为空 → 封面图长按只有 2 项；
      // 详情弹窗内照旧走 currentProduct）
      cm.bind(productGrid, 'img.card-img', function (img) {
        var _card = img.closest ? img.closest('.product-card') : null;
        var _pid = Number((_card && _card.getAttribute('data-pid')) || 0);
        var p = (DATA.products || []).find(function (x) { return Number(x.id) === _pid; }) || currentProduct;
        return imgItems(img, p);
      });
      cm.bind(modalMask, 'img', function (img) { return imgItems(img, currentProduct); });
      // 3. 文字（简介/详情弹窗正文）：复制选中 / 复制全文 / 分享资源 / 存二维码
      //    卡片上的标题/简介不再单独绑文字菜单——卡片菜单已含「复制标题/复制简介」，避免同一按点两个菜单打架；
      //    「长按文字」指详情弹窗内的简介/详情正文（排除按钮输入等控件）
      cm.bind(modalMask, '.modal-wrap', function (el, e) {
        if (e && e.target && e.target.closest && e.target.closest('button, input, textarea, a, select, img, video')) return [];
        return textItems(el, currentProduct);
      });
      }
      /* 双保险：若组件尚未就绪（脚本顺序异常），DOMContentLoaded 再试一次 */
      if (window.__ctxMenu) setup(); else window.addEventListener('DOMContentLoaded', setup);
    })();

    // 统一绑定：区域内所有图片/视频点击放大（富文本描述/类型描述/专属内容等复用）


    // ---------- 初始化 ----------
    renderShopInfo();
    updateTopbarHeight();
    initData();

    // v294（用户 10-04 02:14）：213 广播通知其他标签页客服链接已更新
    window.addEventListener('storage', function (e) {
      if (e.key === 'wnzyq_kf_url_updated') {
        // 重新拉取 settings 更新客服链接
        __dedupFetch('/api/settings?_t=' + Date.now())
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (res) {
            if (res && res.settings && res.settings.contact_url !== undefined) {
              window._globalContact = res.settings.contact_url || getDefaultContact();
              if (window.__kfPreconnect) window.__kfPreconnect(window._globalContact);
              updateContactBtn();
            }
          }).catch(function () {});
      }
    });

    // 视图切换（网格/列表）；R211 二批（用户 09-20 老板点名）：FLIP 平滑飞位——按钮点击路径走 FlipAnimator，
    // 卡片从旧位置飞到新位置；初始化恢复视图不触发动画；FLIP 不可用/系统减少动效时回退原容器切换动画
    var currentView = localStorage.getItem('wnzyq_shop_view') || 'list';
    // R277：首帧即给骨架屏容器加正确模式类，避免静态骨架形状与当前模式不符（R255 静态骨架存在时 renderSkeleton 不执行）
    var _grid = document.getElementById('productGrid');
    if (_grid) _grid.classList.toggle('list-view', currentView === 'list');
    var __shopFlipper = null;

    function setShopView(view) {
      currentView = view;
      localStorage.setItem('wnzyq_shop_view', view);
      var grid = document.getElementById('productGrid');
      var gridBtn = document.getElementById('viewGridBtn');
      var listBtn = document.getElementById('viewListBtn');
      if (view === 'list') {
        grid.classList.add('list-view');
        triggerViewAnim(grid);
        gridBtn.classList.remove('active');
        listBtn.classList.add('active');
      } else {
        grid.classList.remove('list-view');
        triggerViewAnim(grid);
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
      }
      // R273：切换视图时若骨架在显示中，同步重绘为新模式骨架
      var hasSkel = grid.querySelectorAll('.card-skeleton').length > 0;
      if (hasSkel) renderSkeleton();
    }

    // R257：flipSetShopView 已合并到 ui-common.js flipViewSwitch，薄封装调用
    function flipSetShopView(view) {
      window.flipViewSwitch('productGrid', view, {
        btnA: 'viewListBtn', btnB: 'viewGridBtn', // v325：解除交叉——btnA 配 viewA（list）自然配对
        flipperKey: '__shopFlipper',
        viewClass: 'list-view', viewA: 'list',
        storageKey: 'wnzyq_shop_view',
        fallbackFn: setShopView,
        triggerAnim: triggerViewAnim,
        onChange: function (v) {
          currentView = v;
          // R273：FLIP 切换后若骨架仍在，同步重绘
          var hasSkel = productGrid.querySelectorAll('.card-skeleton').length > 0;
          if (hasSkel) renderSkeleton();
        }
      });
    }

    document.getElementById('viewGridBtn').addEventListener('click', function () { flipSetShopView('grid'); });
    document.getElementById('viewListBtn').addEventListener('click', function () { flipSetShopView('list'); });
    setShopView(currentView); // 初始化：恢复上次视图（不走 FLIP，页面加载不播飞位动画）

    // 强制确保页面可见（防止动画异常导致body opacity为0）
    setTimeout(function () { document.body.style.opacity = '1'; }, 500);

    // ---- 图片/视频放大查看器（点击放大、双指缩放） ----
    // 图片/视频放大查看器已由上方 openLightbox/bindLightbox 统一提供（动态创建），此处无重复实现

    // 弹窗内图片/视频点击放大已由上方 bindLightbox 统一绑定

/* v336（条7）：变量圈屋——全文件包进一层“屋子”，不再有上万个变量裸露在最外层
   （以前浏览器还会把页面元素 id 自动变成同名的全局变量，存在撞车风险）。
   HTML 按钮的 onclick 里直接点名的函数，在屋子末尾统一“挂牌对外”，功能不变。 */
window.closeModal = typeof closeModal !== 'undefined' ? closeModal : window.closeModal;
window.closeShare = typeof closeShare !== 'undefined' ? closeShare : window.closeShare;
window.closeAnnModal = typeof closeAnnModal !== 'undefined' ? closeAnnModal : window.closeAnnModal;
window.showAnnDefault = typeof showAnnDefault !== 'undefined' ? showAnnDefault : window.showAnnDefault;
window.loadImg = typeof loadImg !== 'undefined' ? loadImg : window.loadImg;
})();