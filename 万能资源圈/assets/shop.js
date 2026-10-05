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
    var __pageCache = {};        // key='cid:subCid:kw:page'，value={products,categories,total,totalPages,page,_backendPaged,timestamp}
    var __pageCacheLoading = {}; // key同上，value=Promise（防重复请求）
    function __cacheKey(page, cid, subCid, kw) {
      return (cid || 0) + ':' + (subCid || 0) + ':' + (kw || '') + ':' + (page || 1);
    }
    function __showPageLoading() {
      var bar = document.getElementById('pageLoadingBar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'pageLoadingBar';
        bar.className = 'page-loading-bar';
        var wrap = productGrid.parentNode;
        if (wrap) wrap.insertBefore(bar, productGrid);
      }
      bar.style.display = 'block';
      bar.style.animation = 'none'; void bar.offsetWidth;
      bar.style.animation = '';
    }
    function __hidePageLoading() {
      var bar = document.getElementById('pageLoadingBar');
      if (bar) bar.style.display = 'none';
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
    var IMG_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E';

    // 滚动锁已取消（用户要求恢复自由滚动）：即使 ui-common.js 未加载，也不再拦截 touchmove/wheel
    if (!window.lockBodyScroll) {
      window.lockBodyScroll = function (lock) {
        if (lock) { document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden'; }
        else { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; }
      };
      window.syncBodyLock = function () { window.lockBodyScroll(document.body.style.overflow === 'hidden'); };
    }

    // logo 加载失败兜底：替换为感叹号占位（与全站一致）
    window.__logoFail = function (im) { try { im.onerror = null; im.src = IMG_PLACEHOLDER; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block'; im.style.opacity = '1'; if (im.parentNode) { im.parentNode.style.opacity = '1'; if (!im.parentNode.classList.contains('logo-enter')) im.parentNode.classList.add('logo-enter'); } } catch (e) {} };
    var __shopFetchInFlight = new Map();
    function __dedupFetch(url, opts) {
      var key = url + '|' + (opts && opts.body ? opts.body : '');
      if (__shopFetchInFlight.has(key)) return __shopFetchInFlight.get(key);
      // v305（用户 10-05 02:26）：根因→fetch 默认 credentials 在某些浏览器/边缘环境中 cookie 会丢失；
      // 修法→显式设置 credentials: 'include'，确保会话 Cookie 必被带上（全系统统一）。
      if (!opts) opts = {};
      opts.credentials = opts.credentials || 'include';
      // R308：GET 请求失败自动重试一次（立刻、不延时），只试一次
      var isGet = (!opts || !opts.method || opts.method === 'GET');
      var doFetch = function (isRetry) {
        return fetch(url, opts).then(function (r) { return r; }).catch(function (e) {
          if (isGet && !isRetry) return doFetch(true);
          throw e;
        });
      };
      var p = doFetch(false).then(function (r) { __shopFetchInFlight.delete(key); return r; }).catch(function (e) { __shopFetchInFlight.delete(key); throw e; });
      __shopFetchInFlight.set(key, p);
      return p;
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
      document.querySelectorAll('img').forEach(function (im) { if (im.complete && im.naturalWidth === 0 && im.getAttribute('src') && im.getAttribute('src').indexOf('data:') !== 0) { im.dataset.fh = '1'; im.src = IMG_PLACEHOLDER; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block'; } });
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
    function thumbOf(url) {
      var u = String(url || '');
      if (!/^\/img\/images\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i.test(u)) return u;
      return u.replace(/\.(png|jpe?g|webp|gif)$/i, '_t.webp');
    }

    function loadImg(img, src, fallbackSrc) { /* R304 P18：fallbackSrc=小图加载失败先回退的原图；不传（详情弹窗/轮播走原图）行为与原先完全一致 */
      if (img.getAttribute('src') === src && img.src && img.complete) { img.style.display = 'block'; img.style.opacity = '1'; return; }
      img.decoding = 'async'; /* R193c ⑩：异步解码——解码不占主线程，列表图多时滑动更跟手 */
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

  // v296（用户 10-04 03:01）：引用块置顶复制按键——给引用块插入复制按钮并绑定事件
  function bindQuoteCopyButtons(container) {
    if (!container) return;
    var quotes = container.querySelectorAll('blockquote');
    quotes.forEach(function (q) {
      if (q.querySelector('.quote-copy-btn')) return; // 已有按钮则跳过
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quote-copy-btn';
      btn.textContent = '复制';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var clone = q.cloneNode(true);
        var innerBtn = clone.querySelector('.quote-copy-btn');
        if (innerBtn) innerBtn.remove();
        var html = clone.innerHTML.trim();
        var text = clone.textContent.trim();
        // 优先用 Clipboard API 带格式复制
        var ok = false;
        if (navigator.clipboard && navigator.clipboard.write) {
          try {
            var blob = new Blob([html], { type: 'text/html' });
            var txtBlob = new Blob([text], { type: 'text/plain' });
            var item = new ClipboardItem({ 'text/html': blob, 'text/plain': txtBlob });
            navigator.clipboard.write([item]).then(function () {
              if (window.showToast) window.showToast('已复制');
              else if (window.__shareToast) window.__shareToast('已复制');
              __copyOk(btn);
            }).catch(function () {
              // 降级同步复制
              __fallbackCopy(text, btn);
            });
            ok = true;
          } catch (e) {}
        }
        if (!ok) __fallbackCopy(text, btn);
      });
      q.appendChild(btn);
    });
  }
  function __fallbackCopy(text, btn) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (window.showToast) window.showToast('已复制');
      else if (window.__shareToast) window.__shareToast('已复制');
      if (window.__copyOk) window.__copyOk(btn);
      else { try { btn.classList.add('copy-ok'); setTimeout(function () { btn.classList.remove('copy-ok'); }, 1500); } catch (e) {} }
    } catch (e) {}
  }

    function sanitizeHTML(html) {
      if (!html) return '';
      var allowed = { A:1, BR:1, P:1, STRONG:1, EM:1, B:1, I:1, U:1, S:1, SPAN:1, DIV:1, FONT:1,
        UL:1, OL:1, LI:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, BLOCKQUOTE:1, CODE:1, PRE:1, HR:1,
        IMG:1, VIDEO:1, SOURCE:1,
        TABLE:1, TBODY:1, THEAD:1, TR:1, TD:1, TH:1, INPUT:1 }; /* R194：后台编辑器新增表格，前台同步放行；R215 条4：复选框（type=checkbox）放行 */
      // 允许的属性
      var allowedAttrs = {
        A: ['href','target','rel','title'],
        IMG: ['src','alt','title','style','width','height'],
        VIDEO: ['src','controls','autoplay','loop','muted','poster','style','width','height'],
        SOURCE: ['src','type'],
        SPAN: ['style','color'],
        FONT: ['color','size','face'],
        DIV: ['style'],
        P: ['style'],
        H1: ['style'], H2: ['style'], H3: ['style'], H4: ['style'], H5: ['style'], H6: ['style'],
        LI: ['style'], UL: ['style'], OL: ['style'],
        BLOCKQUOTE: ['style'], CODE: ['style'], PRE: ['style'],
        TABLE: ['style','width'], TBODY: ['style'], THEAD: ['style'], TR: ['style'],
        TD: ['style','colspan','rowspan','width'], TH: ['style','colspan','rowspan','width'], /* R194 */
        INPUT: ['type','checked'] /* R215 条4：复选框只放行 type/checked */
      };
      try {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var els = doc.body.querySelectorAll('*');
        els.forEach(function (el) {
          var tag = el.tagName;
          if (!allowed[tag]) {
            var text = document.createTextNode(el.textContent);
            if (el.parentNode) el.parentNode.replaceChild(text, el);
            return;
          }
          // 只保留允许的属性，移除危险属性
          var tagAllowed = allowedAttrs[tag] || [];
          Array.from(el.attributes).forEach(function (attr) {
            var name = attr.name.toLowerCase();
            // 移除 on* 事件属性
            if (name.indexOf('on') === 0) { el.removeAttribute(attr.name); return; }
            // 检查 href/src 是否为危险协议
            if (name === 'href' || name === 'src') {
              var val = attr.value.toLowerCase().trim();
              if (val.indexOf('javascript:') === 0 || val.indexOf('data:') === 0 || val.indexOf('vbscript:') === 0) {
                el.removeAttribute(attr.name);
                return;
              }
            }
            // 检查 style 属性是否包含危险内容
            if (name === 'style') {
              var styleVal = attr.value.toLowerCase();
              if (styleVal.indexOf('expression') !== -1 || styleVal.indexOf('url(') !== -1) {
                el.removeAttribute(attr.name);
                return;
              }
            }
            // 如果不在允许的属性列表中，移除
            if (tagAllowed.indexOf(name) === -1 && name !== 'class') {
              el.removeAttribute(attr.name);
            }
          });
          // a 标签强制新窗口打开 + 安全 rel
          if (tag === 'A') {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }
          // 视频标签默认加上 controls
          if (tag === 'VIDEO' && !el.hasAttribute('controls')) {
            el.setAttribute('controls', '');
          }
        });
        return doc.body.innerHTML;
      } catch (e) {
        return '';
      }
    }

    // 数据统计：记录资源浏览/咨询客服/资源码解锁事件，发送到后端
    // 仅在使用远程 API 时记录，本地环境不记录
    function track(pid, type) {
      if (!usingRemote || !pid) return;
      try {
        fetch('/api/track', {
          method: 'POST',
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
      try { document.querySelectorAll('#annModal video').forEach(function (v) { v.pause(); }); } catch (e) {}
    }
    // 默认公告（一级公告）展示：选中"公告"标题，内容渲染到正文区
    function showAnnDefault() {
      var l = (window.DATA && DATA.announcements) || [];
      var d = l.find(function (x) { return x.level === 1; }) || l[0];
      if (!d) return;
      var bd = document.getElementById('annBody');
      if (bd) { var _c3 = sanitizeHTML(d.content || ''); bd.innerHTML = _c3 || '<div class="ann-empty"><div class="ann-empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" aria-hidden="true"><path d="M12 2 3 6.8v10.4L12 22l9-4.8V6.8L12 2zm7.5 5.3L12 10.9 4.5 7.3 12 3.3l7.5 4zM5 9l6.2 3.3v8.1L5 17.1V9zm8.8 11.4v-8.1L20 9v8.1l-6.2 3.3z"/></svg></div><div class="ann-empty-title">该公告暂无内容</div></div>'; bindMediaFail(bd); bindLightbox(bd);
      bindQuoteCopyButtons(bd); } // v303（用户 10-05 00:16）：公告空态复用搜索空态三件套（图标+同款字体），文字统一
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
                  bindQuoteCopyButtons(bd); // v303（用户 10-05 00:16）：公告空态复用搜索空态三件套（图标+同款字体），文字统一
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
      bindQuoteCopyButtons(body); } // v303（用户 10-05 00:16）：公告空态复用搜索空态三件套（图标+同款字体），文字统一
    }
    function renderAnnouncement() {
      try { var mask = document.getElementById('annModal');
      if (!mask) return;
      // R256：公告弹窗口径变更——老板 09-26 22:57 拍板：从"没加载好就不弹"改成"先弹骨架窗再填内容"；
      // 加载完发现完全没公告就自动关掉不弹（骨架窗只出现在加载期间）。覆盖 R108 口径。
      var _annSkel = document.getElementById('annSkeleton');
      // 数据未到位时：显示骨架弹窗
      if (!(DATA.announcements || []).length && !String(DATA.announcement || '').trim()) {
        if (!window.__annDataReady) {
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
      if (window.__annSilent) { window.__annSilent = false; return; } if (window.__annDismissed) return; if (window.__annShown || mask.classList.contains('open')) { if (mode === 'session') { try { if (!sessionStorage.getItem('wnzyq_ann_session')) sessionStorage.setItem('wnzyq_ann_session', '1'); } catch (e) {} } else if (mode === 'daily') { try { var _td = new Date().toDateString(); if (localStorage.getItem('wnzyq_ann_date') !== _td) localStorage.setItem('wnzyq_ann_date', _td); } catch (e) {} }
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
        } catch (e) {}
      } else if (mode === 'session') {
        try {
          if (sessionStorage.getItem('wnzyq_ann_session')) return;
          sessionStorage.setItem('wnzyq_ann_session', '1');
        } catch (e) {}
      }
      window.__annShown = true;
      renderAnnContent();
      mask.classList.add('open');
      setBodyLock(true); } catch (e) {}
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
          try { if (c.id) localStorage.setItem('__shopCategory', String(c.id)); else localStorage.removeItem('__shopCategory'); } catch(e) {}
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

    /* R239（用户 09-22 派单）：资源页从无限滚动追加改为单页替换（旧 checkScroll 距底 200px 追加分支整段退役）。
       翻页动作收口本函数单点：分页条按键（onPage）走本路径，
       R303：后端分页时翻页才拉对应页数据。
       v312（用户 10-05 15:21）：根因→翻页时旧内容淡出成空白等待；修法→有缓存立即出、无缓存保留旧内容+轻量进度条，数据回来再替换。 */
    function __turnToPage(p) {
      if (p === currentPage || __pageTurning) return;
      __pageTurning = true; /* R231 条19：翻页期间防重复 */
      currentPage = p;
      if (usingRemote && DATA._backendPaged) {
        fetchRemote({ page: p }).then(function () {
          renderProducts();
          __pageTurning = false;
          try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { try { window.scrollTo(0, 0); } catch (e2) {} }
        }).catch(function () {
          renderProducts();
          __pageTurning = false;
          try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { try { window.scrollTo(0, 0); } catch (e2) {} }
        });
      } else {
        renderProducts();
        __pageTurning = false;
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { try { window.scrollTo(0, 0); } catch (e2) {} }
      }
    }
    /* R243（用户 09-22 23:18）：条15 分类/搜索切换与翻页统一同款过渡
       R303：后端分页时分类/搜索切换重新拉取第1页。
       v312（用户 10-05 15:21）：根因→切分类时旧内容淡出成空白等待；修法→有缓存立即渲染零等待，无缓存保留旧内容+轻量进度条，数据回来再替换。 */
    function __fadeRenderProducts(cb) {
      if (__pageTurning) return;
      __pageTurning = true;
      if (cb) cb();
      if (usingRemote && DATA._backendPaged) {
        fetchRemote({
          page: currentPage,
          cid: currentCat,
          subCid: currentSubCat,
          kw: (searchInput.value || '').trim()
        }).then(function () {
          renderProducts();
          __pageTurning = false;
        }).catch(function () {
          renderProducts();
          __pageTurning = false;
        });
      } else {
        renderProducts();
        __pageTurning = false;
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
      card.className = 'product-card';
      card.setAttribute('data-pid', p.id || 0); /* R193 二⑤⑦：长按小菜单取资源用 */
      var img = document.createElement('img');
      img.className = 'card-img';
      img.decoding = 'async'; /* R193c ⑩：卡片图异步解码 */
      img.alt = p.title || '';
      /* R304 P14：去 lazy——当前页卡片图全部一起加载（老板 09-30 拍板全系统按页加载） */
      loadImg(img, thumbOf(p.img), p.img); /* R304 P18：列表卡片读小图、小图缺失回退原图；详情弹窗封面/轮播/详情图仍走原图 */
      var body = document.createElement('div');
      body.className = 'card-body';
      var title = document.createElement('div');
      title.className = 'card-title';
      var __kw = (searchInput && searchInput.value || '').trim();
      title.innerHTML = __kw ? hlTitle(p.title || '', __kw) : (p.title || ''); /* R192 二④：命中词淡绿高亮 */
      title.title = p.title || ''; // v294：194 标题过长悬停显示完整内容
      title.title = p.title || ''; // v294：194 标题过长悬停显示完整内容
      var desc = document.createElement('div');
      desc.className = 'card-desc';
      desc.textContent = p.desc || '';
      body.appendChild(title);
      body.appendChild(desc);
      card.appendChild(img);
      card.appendChild(body);
      card.addEventListener('click', function () { openModal(p); });
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
        emptyTitle.textContent = kw ? '该搜索暂无资源' : '该分类暂无资源';
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
        }
        return;
      }

      // R303：分页计算——后端已分页时直接用元数据，否则前端切片
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
        if (changed || frag.childNodes.length !== existingCards.length) {
          productGrid.appendChild(frag);
        }
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
        prev.style.cssText = 'padding:8px 16px;border:1px solid var(--blue2);background:var(--card-bg,#fff);color:var(--blue1);border-radius:20px;cursor:pointer;font-size:13px;';
        window.__setPagerDisabled(prev, currentPage === 1); // v297（用户 10-04 02:14）：C-242 翻页置灰走公共函数
        prev.onclick = function () { if (currentPage > 1) { currentPage--; renderProducts(); window.scrollTo({top:0,behavior:'smooth'}); } };
        pager.appendChild(prev);
        var info = document.createElement('span');
        info.textContent = currentPage + ' / ' + totalPages;
        info.style.cssText = 'color:var(--text-light);font-size:13px;';
        pager.appendChild(info);
        var next = document.createElement('button');
        next.textContent = '下一页';
        next.style.cssText = 'padding:8px 16px;border:1px solid var(--blue2);background:var(--card-bg,#fff);color:var(--blue1);border-radius:20px;cursor:pointer;font-size:13px;';
        window.__setPagerDisabled(next, currentPage === totalPages); // v297（用户 10-04 02:14）：C-242 翻页置灰走公共函数
        next.onclick = function () { if (currentPage < totalPages) { currentPage++; renderProducts(); window.scrollTo({top:0,behavior:'smooth'}); } };
        pager.appendChild(next);
      }
    }

    // R269（用户 09-27 15:14）：根因→R268 修复在 v265 打包时回退丢失，补 renderCarousel + coverImages 字段修正重做
    // ---------- 封面轮播组件 ----------
    var EXC_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E';
    function renderCarousel(carouselEl, trackEl, dotsEl, fallbackImgEl, images) {
      if (!carouselEl || !trackEl) return;
      if (carouselEl.__ccTimer) { clearInterval(carouselEl.__ccTimer); carouselEl.__ccTimer = null; }
      if (!images || images.length <= 1) {
        carouselEl.style.display = 'none';
        if (fallbackImgEl) {
          fallbackImgEl.style.display = '';
          fallbackImgEl.src = images && images[0] ? images[0] : '';
        }
        return;
      }
      carouselEl.style.display = '';
      if (fallbackImgEl) fallbackImgEl.style.display = 'none';
      // R280 ③：轮播状态挂元素（st）+ 事件监听只绑一次（__ccBound）——反复开关弹窗不再累积监听器/闭包
      var st = carouselEl.__ccState || (carouselEl.__ccState = { idx: 0, len: images.length });
      st.idx = 0; st.len = images.length;
      trackEl.innerHTML = '';
      images.forEach(function (url) {
        var slide = document.createElement('div');
        slide.className = 'cc-slide';
        // R266（用户 09-27 15:08）：轮播图先隐藏占座（opacity:0），load 成功才显示，
        // error 直接换占位符，杜绝 innerHTML 直接塞 src 导致的裸闪破损图标。
        var img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.style.opacity = '0';
        img.style.cursor = 'zoom-in';
        img.onload = function () { img.style.opacity = '1'; };
        img.onerror = function () { img.style.opacity = '1'; img.classList.add('media-fail'); img.src = EXC_PLACEHOLDER; };
        // R273：轮播图点击放大（拖动时抑制 click）
        img.addEventListener('click', function (e) {
          if (trackEl.__ccDragged) { trackEl.__ccDragged = false; return; }
          window.openLightbox(url);
        });
        slide.appendChild(img);
        img.src = escapeHtml(url);
        trackEl.appendChild(slide);
      });
      if (dotsEl) {
        dotsEl.innerHTML = '';
        images.forEach(function (_, i) {
          var dot = document.createElement('span');
          dot.className = 'cc-dot' + (i === 0 ? ' active' : '');
          dot.addEventListener('click', function () { goToSlide(i); });
          dotsEl.appendChild(dot);
        });
      }
      function goToSlide(idx) {
        st.idx = (idx + st.len) % st.len; // R280 ③：取模循环——自动/手动切到最后一张都回到第一张
        trackEl.style.transform = 'translateX(-' + (st.idx * 100) + '%)';
        if (dotsEl) {
          dotsEl.querySelectorAll('.cc-dot').forEach(function (d, i) { d.classList.toggle('active', i === st.idx); });
        }
        restartTimer(); // R280 ③：手动/自动任一切换后都从头计 3 秒
      }
      function pause() { if (carouselEl.__ccTimer) { clearInterval(carouselEl.__ccTimer); carouselEl.__ccTimer = null; } }
      function restartTimer() { pause(); carouselEl.__ccTimer = setInterval(function () { goToSlide(st.idx + 1); }, 3000); }
      carouselEl.__ccPause = pause; // R280 ③：弹窗关闭钩子用它停表（closeModal 必调），防后台鬼影换图
      if (!carouselEl.__ccBound) {
        carouselEl.__ccBound = true;
        carouselEl.addEventListener('mouseenter', function () { pause(); });
        carouselEl.addEventListener('mouseleave', function () { restartTimer(); });
        carouselEl.addEventListener('touchstart', function () { pause(); }, { passive: true });
        carouselEl.addEventListener('touchend', function () { restartTimer(); });
        trackEl.addEventListener('touchstart', function (e) { trackEl.__ccStartX = e.touches[0].clientX; trackEl.__ccDrag = true; trackEl.__ccDragged = false; trackEl.classList.add('dragging'); }, { passive: true });
        trackEl.addEventListener('touchmove', function (e) { if (!trackEl.__ccDrag) return; trackEl.__ccDragged = true; var dx = e.touches[0].clientX - trackEl.__ccStartX; trackEl.style.transform = 'translateX(calc(-' + (st.idx * 100) + '% + ' + dx + 'px))'; }, { passive: true });
        trackEl.addEventListener('touchend', function (e) {
          trackEl.__ccDrag = false; trackEl.classList.remove('dragging');
          var dx = (e.changedTouches[0] || e.touches[0]).clientX - trackEl.__ccStartX;
          if (dx < -40) goToSlide(st.idx + 1); // R280 ③：拖动也循环（老板「手动切换到最后可以循环回到第一个」）
          else if (dx > 40) goToSlide(st.idx - 1);
          else goToSlide(st.idx);
        });
        trackEl.addEventListener('mousedown', function (e) { trackEl.__ccStartX = e.clientX; trackEl.__ccDrag = true; trackEl.__ccDragged = false; trackEl.classList.add('dragging'); e.preventDefault(); });
        trackEl.addEventListener('mousemove', function (e) { if (!trackEl.__ccDrag) return; trackEl.__ccDragged = true; var dx = e.clientX - trackEl.__ccStartX; trackEl.style.transform = 'translateX(calc(-' + (st.idx * 100) + '% + ' + dx + 'px))'; });
        trackEl.addEventListener('mouseup', function (e) {
          trackEl.__ccDrag = false; trackEl.classList.remove('dragging');
          var dx = e.clientX - trackEl.__ccStartX;
          if (dx < -40) goToSlide(st.idx + 1);
          else if (dx > 40) goToSlide(st.idx - 1);
          else goToSlide(st.idx);
        });
        trackEl.addEventListener('mouseleave', function () { if (trackEl.__ccDrag) { trackEl.__ccDrag = false; trackEl.classList.remove('dragging'); goToSlide(st.idx); } });
      }
      restartTimer(); // R280 ③：弹窗打开即启动 3 秒自动轮播
    }

    // ---------- 详情弹窗 ----------
    function openModal(p) {
      // v294（用户 10-04 02:14）：207 弹窗打开时pushState，后退先关弹窗
      try { if (!window.location.search.includes('pid=')) history.pushState({modal:true}, '', window.location.pathname + '?pid=' + p.id); } catch(e) {}
      currentProduct = p;
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
          try { localStorage.removeItem('wnzyq_variant_draft'); } catch(e) {}
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
            try { ta = (JSON.parse(localStorage.getItem(a) || '{}').t) || 0; } catch (e) {}
            try { tb = (JSON.parse(localStorage.getItem(b) || '{}').t) || 0; } catch (e) {}
            return ta - tb;
          });
          for (var j = 0; j < keys.length - 49; j++) { try { localStorage.removeItem(keys[j]); } catch (e) {} }
        }
        localStorage.setItem(__unlockCacheKey(pid, vid), JSON.stringify({ t: Date.now(), c: content }));
      } catch (e) {}
    }
    function __readUnlockCache(pid, vid) {
      try {
        var raw = localStorage.getItem(__unlockCacheKey(pid, vid));
        if (!raw) return null;
        var d = JSON.parse(raw);
        // R286-61：已解锁设备免输码永久有效（不再检查7天过期）
        if (!d || !d.c) {
          try { localStorage.removeItem(__unlockCacheKey(pid, vid)); } catch (e) {}
          return null;
        }
        return d.c;
      } catch (e) { return null; }
    }
    // 请求服务端解锁：code 传空 = 自动检查（已绑定设备/无码类型直接拿内容）
    // R231 条16/17：deferMs = 绿✓三段式展示时长——期间延迟行淡出，之后再 150ms 淡出并与内容展开交叉
    var unlockBusy = false;
    // U3：解锁请求加 8 秒超时，超时提示「网络不佳，请重试」
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
          setTimeout(function () { reject(new Error('timeout')); }, 8000);
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
        // U3：超时提示「网络不佳，请重试」
        if (err && err.message === 'timeout') return { ok: false, msg: '网络不佳，请重试' };
        return { ok: false, msg: '网络不佳，请检查一下再试' }; // v294：087 网络提示统一
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
          if (window.openContactModal) { window.openContactModal(url, '/assets/images/kefu.png?v=314', null, '跳转-咨询在线客服'); } else { window.openContactFallback(url); }
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
      } catch (e) {}
      closeModal();
    }
    function closeModalDiscard() { __codeDraft = null; closeModal(); }

    // v294（用户 10-04 02:14）：207 浏览器后退先关弹窗
    window.addEventListener('popstate', function(e) {
      if (!e.state || !e.state.modal) { var m = document.getElementById('modalMask'); if (m && m.classList.contains('open')) closeModal(); }
    });
    // v294（用户 10-04 02:14）：207 浏览器后退先关弹窗
    window.addEventListener('popstate', function(e) {
      if (!e.state || !e.state.modal) { var m = document.getElementById('modalMask'); if (m && m.classList.contains('open')) closeModal(); }
    });
    function closeModal() { try { document.querySelectorAll('#modalBox video, #modalMedia video').forEach(function (v) { v.pause(); }); } catch (e) {}
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
      else { if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch (e) {} } showToast('链接已复制到剪贴板', 'success'); }
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
          } catch (e0) {}
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
            } catch (e0) {}
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
        try { if (self.value.trim()) localStorage.setItem('__shopSearch', self.value.trim()); else localStorage.removeItem('__shopSearch'); } catch(e) {}
        __fadeRenderProducts(function () {
          if (self.value.trim()) window.pushSearchHist('shopSearchHist', self.value); /* R186 建议1：搜索稳定 300ms 后记录 */
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
      var __bindSH = function () { window.bindSearchHist(document.querySelector('.search-box'), searchInput, 'shopSearchHist'); };
      if (window.bindSearchHist) __bindSH(); else window.addEventListener('load', __bindSH);
    })();

    /* R243 条19②：Ctrl+K 命令面板（入口仅键盘，页面零新增图标/按键）——
       前台命令 = 资源直达：搜到资源回车直接打开详情弹窗（openModal，与 ?pid= 分享链接同一通道）；
       面板本体由 ui-common.js __cpPanel 全站组件提供，本页只传命令源（load 后兜底，同搜索历史时序） */
    (function () {
      var __bindCP = function () {
        if (!window.__cpPanel) return;
        window.__cpPanel({
          placeholder: '请输入资源名', /* R285 条38：口径统一「动作+对象」（回车直达详情属功能说明，并入 help/title） */
          cmds: function () {
            var c = [];
            (DATA.products || []).forEach(function (p) {
              if (p.is_online !== true && p.is_online !== 1) return;
              if (p.is_hidden === true || p.is_hidden === 1) return;
              c.push({ lab: String(p.title || '(无标题)'), tag: '资源', kw: String(p.title || ''), run: function () { try { openModal(p); } catch (e) {} } });
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
      if (url) { if (window.openContactModal) { window.openContactModal(url, '/assets/images/kefu.png?v=314', null, '跳转-咨询在线客服'); } else { window.openContactFallback(url); } }
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
      setInterval(sync, 800); // 兜底轮询：observer 意外失效时也能恢复
    })();

    function openShare() {
      try {
        topShareBtn.classList.add('active'); // R20：弹窗打开期间白底
        var url = window.location.href;
        if (shareLinkText) shareLinkText.textContent = url;
        // R79：统一分享复制链路——与资源卡片分享/预览分享/弹窗链接点击同一套
        // （R138：clipboard.writeText 异步复制零阻塞），提示文案全站统一
        if (window.__shareCopyText) {
          try { window.__shareCopyText(url); } catch(e){}
        } else {
          try { fallbackCopy(url); } catch(e){}
        }
        // R209（用户 09-19 00:41）：根因→__copyOk 的 .copy-ok 给链接文字加整块绿底；修法→链接文字专用绿字反馈
        if (shareLinkText) { try { shareLinkText.classList.add('copy-ok-text'); setTimeout(function(){ try{ shareLinkText.classList.remove('copy-ok-text'); }catch(e){} }, 1500); } catch(e){} }
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
        if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch(e){} }
        else { try { fallbackCopy(url); } catch(e){} }
        // R209（用户 09-19 00:41）：根因→__copyOk 的 .copy-ok 给链接文字加整块绿底；修法→链接文字专用绿字反馈
        if (shareLinkText) { try { shareLinkText.classList.add('copy-ok-text'); setTimeout(function(){ try{ shareLinkText.classList.remove('copy-ok-text'); }catch(e){} }, 1500); } catch(e){} }
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
    function __setShopCache(key, obj) {
      try {
        var json = JSON.stringify(obj);
        if (localStorage.getItem(key) !== json) localStorage.setItem(key, json);
      } catch (e) {}
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
      } catch (e) {}
      window.__sharePid = sharePid;
      if (sharePid) { window.__annDismissed = true; window.__annShown = false; }
      var hasCache = false;
      var cachedVersion = '';
      // 先读 localStorage 缓存，秒开
      try {
        var cached = localStorage.getItem('wnzyq_shop_data');
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
      } catch (e) {}
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
        }).catch(function () {
          window.__shopEntryDone = true;
          if (window.__exitPageEntryMode) window.__exitPageEntryMode();
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
      return __dedupFetch('/api/shop/home?v=' + encodeURIComponent(cachedVersion) + ts, fetchOpts)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) {
          if (!res) return;
          if (res.unchanged === true) {
            window.__lastFetchTime = Date.now();
            return;
          }
          if (!res.ok) return;
          // 解包产品
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
        __pageCacheLoading[key] = Promise.all([
          withTimeout(__dedupFetch('/api/products' + qs + (ts ? ts.replace('?', '&') : ''), fetchOpts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), 8000),
          withTimeout(__dedupFetch('/api/categories' + ts, fetchOpts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), 8000),
          withTimeout(__dedupFetch('/api/settings' + ts, fetchOpts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), 8000)
        ]).then(function (res) {
          var _changed = false;
          if (res[0] && res[0].ok && res[1] && res[1].ok) {
            DATA.products = res[0].list || [];
            DATA.categories = res[1].list || [];
            usingRemote = true;
            if (res[0].total_pages !== undefined) {
              DATA.total = res[0].total || 0;
              DATA.totalPages = res[0].total_pages || 1;
              DATA.page = res[0].page || 1;
              DATA._backendPaged = true;
            } else {
              DATA._backendPaged = false;
            }
            __setShopCache('wnzyq_shop_data', { products: DATA.products, categories: DATA.categories });
            if (JSON.stringify(DATA.products) !== _oldProducts || JSON.stringify(DATA.categories) !== _oldCategories) _changed = true;
          }
          if (res[2] && res[2].ok) {
            var _newAnn = (res[2].settings || {}).announcement || '';
            var _newAnnMode = (res[2].settings || {}).announcement_mode || 'always';
            if (!_newAnn && !(res[2].settings || {}).announcements) {
              try { localStorage.removeItem('wnzyq_ann_date'); localStorage.removeItem('wnzyq_ann_session'); } catch(e) {}
            }
            DATA.announcement = _newAnn;
            DATA.announcementMode = _newAnnMode;
            DATA.announcements = window.parseAnnouncements(res[2].settings || {}, { filterHidden: true });
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
            } catch (e) {}
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
          return { changed: _changed, wasSkel: _wasSkel };
        }).catch(function (err) {
          if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
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

      // 无缓存或 force → 显示轻量进度条，等网络请求
      __showPageLoading();
      return doRealFetch().then(function () {
        __hidePageLoading();
      }).catch(function (err) {
        __hidePageLoading();
        throw err;
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
        try { openModal(p); } catch (e) {}
      } else if (fromRemote) {
        showToast('该资源已隐藏或不存在', 'error'); /* R118：与全站 toast 胶囊统一 */
      }
      try {
        var u = new URL(window.location.href);
        u.searchParams.delete('pid');
        window.history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : ''));
      } catch (e) {}
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
    document.addEventListener('touchstart', function (e) {
      if (window.__flipAnimating) return; /* R211 二批：FLIP 飞位期间不判定下拉刷新（手势隔离） */
      if (window.scrollY <= 0 && !modalMask.classList.contains('open')) {
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
        document.getElementById('pullRefreshText').textContent = '正在刷新';
        window.__annShown = false; window.__annDismissed = false;
        // 清除缓存，重新加载数据
        try { localStorage.removeItem('wnzyq_shop_data'); } catch (e) {}
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      setTimeout(function () { try { var grid = document.getElementById('productGrid'); if (grid && !grid.children.length && typeof initData === 'function') initData(); } catch (err) {} }, 60);
    }
    // v307：bfcache 恢复时不再强制刷新——根治"切回来闪一下"。公共脚本已同步修复，此处兜底也取消 reload。
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) {}
      }
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) return; __shopBackGuard(); });
    window.addEventListener('popstate', __shopBackGuard);
    var savedScroll = parseInt(localStorage.getItem(SCROLL_KEY) || '0', 10);
    if (savedScroll > 0) {
      setTimeout(function () { window.scrollTo(0, savedScroll); }, 100);
    }

    // ---------- 移动端下拉刷新 ----------
    var touchStartY = 0;
    var touchRefreshBar = null;
    document.addEventListener('touchstart', function (e) {
      if (false) {
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (window.scrollY <= 0 && touchStartY > 0) {
        var diff = e.touches[0].clientY - touchStartY;
        if (diff > 60 && !pullRefreshEl) {
          pullRefreshEl = document.createElement('div');
          pullRefreshEl.style.cssText = 'position:fixed;top:0;left:0;right:0;height:4px;background:var(--blue1);z-index:9999;animation:pullBar 1s ease infinite;';
          document.body.appendChild(pullRefreshEl);
        }
      }
    }, { passive: true });
    document.addEventListener('touchend', function () {
      if (false && pullRefreshEl) {
        pullRefreshEl.parentNode.removeChild(pullRefreshEl);
        pullRefreshEl = null;
        initData();
        showToast('已刷新', 'success');
      }
      touchStartY = 0;
    });

    // ---------- R193 二⑤⑦ + R249（老板 09-23 13:05 定稿）：长按小菜单全站标准化（四类四项制） ----------
    // 长按资源卡片：复制标题 / 复制简介 / 分享资源 / 存二维码
    // 长按图片：保存图片 / 预览大图 / 分享资源 / 存二维码
    // 长按文字（简介/详情）：复制选中 / 复制全文 / 分享资源 / 存二维码
    (function () {
      /* ===== 二维码生成（R249） ===== */
      function __makeQrUrl(pid) {
        return window.location.origin + window.location.pathname + '?pid=' + pid;
      }
      function __genQrPng(url, size, cb) {
        try {
          var QRCode = window.qrcode || window.QRCode;
          if (!QRCode) { cb && cb(null); return; }
          size = size || 300;
          var qr = QRCode(0, 'M');
          qr.addData(url);
          qr.make();
          var n = qr.getModuleCount();
          var cell = Math.floor(size / n);
          var realSize = cell * n;
          var canvas = document.createElement('canvas');
          canvas.width = realSize; canvas.height = realSize;
          var ctx = canvas.getContext('2d');
          // 白底
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, realSize, realSize);
          // 黑码
          ctx.fillStyle = '#000000';
          for (var r = 0; r < n; r++) {
            for (var c = 0; c < n; c++) {
              if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
            }
          }
          /* R251（老板 09-23 15:20）：二维码不再嵌 favicon 图标，纯白底黑码（原 R249 在中心嵌 32x32
             圆形遮罩+图标，遮了码点；去图标后整码可扫，无需遮罩保护） */
          cb && cb(canvas.toDataURL('image/png'));
        } catch (e) { cb && cb(null); }
      }
      window.__genQrPng = __genQrPng;
      // R251：文件名用资源真实名称（原名「资源N-二维码.png」），名称非法文件字符替换为 '-'，无名兜底回旧格式
      function __qrFileName(pid, name) {
        var base = (name || '').replace(/[\\\/:*?"<>|]/g, '-').trim();
        if (!base) base = '资源' + pid;
        return base + '-二维码.png';
      }
      function __saveQrPng(pid, onDone, name) {
        var url = __makeQrUrl(pid);
        __genQrPng(url, 300, function (dataUrl) {
          if (!dataUrl) { showToast('二维码生成失败', 'error'); onDone && onDone(null); return; }
          var a = document.createElement('a');
          a.href = dataUrl;
          a.download = __qrFileName(pid, name);
          document.body.appendChild(a); a.click(); a.remove();
          showToast('二维码已保存', 'success');
          onDone && onDone(dataUrl);
        });
      }
      window.__saveQrPng = __saveQrPng;
      /* 二维码预览弹窗（参考 showShareLinkModal 同款效果） */
      function __showQrPreview(dataUrl, pid, name) {
        try {
          var _pName = (name || '').trim() || ('资源' + pid); // R251：灰字/文件名带资源真实名称
          var mask = document.createElement('div');
          mask.className = 'share-mask qr-preview-mask';
          mask.setAttribute('role', 'dialog');
          mask.style.cssText = 'position:fixed;inset:0;background:var(--overlay-modal, rgba(0,0,0,0.76));z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
          mask.innerHTML =
            '<div class="share-box qr-preview-box" style="background:#fff;border-radius:14px;position:relative;padding:26px 20px;width:100%;max-width:400px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);animation:modalIn 0.18s ease;">' +
              '<button class="modal-close-x" data-qr-x type="button" aria-label="关闭" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:none;background:#f0f2f5;color:#666;font-size:19px;cursor:pointer;line-height:1;transition:transform 0.10s var(--ease-press), opacity 0.10s var(--ease-press);"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
              '<div style="font-size:18px;font-weight:600;color:#222;margin-bottom:10px;letter-spacing:1px;padding:0 34px;">分享资源二维码</div>' + // R251：标题改「分享资源二维码」
              '<div style="font-size:13px;color:#888;margin-bottom:14px;"><span style="color:#1565c0;">' + _pName + '</span><span style="color:#000;"> · </span>资源二维码已保存到设备</div>' + // R251：灰字带资源名；R254：分色——资源名站内链接蓝/圆点黑/其余保持灰
              '<div style="display:flex;justify-content:center;margin-bottom:18px;"><img id="qrPreviewImg" style="width:200px;height:200px;border:1px solid #eee;border-radius:8px;object-fit:contain;background:#fff;" alt="二维码"/></div>' +
              '<button data-qr-ok type="button" class="share-ok">确定</button>' + // R256（老板 09-23 19:04）：底部按键「再次保存」→「确定」，与分享链接弹窗确定键同款（同 class="share-ok"、无内联样式，去掉原 margin-bottom 内联）；首次保存已在 __saveQrPng 弹窗打开前完成，此处不再重复保存 // v298（用户 10-04 20:30）：修复 v297 注释笔误致语法错误
            '</div>';
          var img = mask.querySelector('#qrPreviewImg');
          if (img) img.src = dataUrl;
          document.body.appendChild(mask);
          function close() {
            try { document.body.removeChild(mask); } catch (e) {}
            if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
          }
          mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
          mask.querySelector('[data-qr-x]').addEventListener('click', close);
          mask.querySelector('[data-qr-ok]').addEventListener('click', close); // R256：点击「确定」关闭弹窗（保存已在打开前完成，不再重复保存）
          if (window.__modalKit) window.__modalKit.register(mask, { discard: close, stash: close });
          window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
        } catch (e) {}
      }
      window.__showQrPreview = __showQrPreview;

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
      function __saveQrFn(p) {
        return function () {
          __saveQrPng(p.id, function (dataUrl) {
            if (dataUrl) __showQrPreview(dataUrl, p.id, p.title);
          }, p.title);
        };
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
          try { sel = String(window.getSelection ? window.getSelection() : ''); } catch (e) {}
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
      if (e.key === '__kfUrlUpdated') {
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
    var currentView = localStorage.getItem('shop_view') || 'list';
    // R277：首帧即给骨架屏容器加正确模式类，避免静态骨架形状与当前模式不符（R255 静态骨架存在时 renderSkeleton 不执行）
    var _grid = document.getElementById('productGrid');
    if (_grid) _grid.classList.toggle('list-view', currentView === 'list');
    var __shopFlipper = null;

    function setShopView(view) {
      currentView = view;
      localStorage.setItem('shop_view', view);
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
        btnA: 'viewGridBtn', btnB: 'viewListBtn',
        flipperKey: '__shopFlipper',
        viewClass: 'list-view', viewA: 'list',
        storageKey: 'shop_view',
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
