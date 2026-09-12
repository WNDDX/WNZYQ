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
      window.lockBodyScroll = function () {};
      window.syncBodyLock = function () {};
    }

    // logo 加载失败兜底：替换为感叹号占位（与全站一致）
    window.__logoFail = function (im) { try { im.onerror = null; im.src = IMG_PLACEHOLDER; im.style.objectFit = 'contain'; im.style.display = 'block'; im.style.opacity = '1'; if (im.parentNode) { im.parentNode.style.opacity = '1'; if (!im.parentNode.classList.contains('logo-enter')) im.parentNode.classList.add('logo-enter'); } } catch (e) {} };
    (function () { var _sl = document.getElementById('shopLogo'); if (_sl && _sl.complete && _sl.naturalWidth === 0 && String(_sl.getAttribute('src')).indexOf('data:') !== 0) window.__logoFail(_sl); })();
    // 全局媒体加载失败兜底：任何 IMG/VIDEO 加载失败统一替换为感叹号占位（页面加载即注册，与导航页一致）
    if (!window.__mediaErrOnce) {
      window.__mediaErrOnce = 1;
      document.addEventListener('error', function (e) {
        var t = e.target;
        if (!t || !t.tagName || t.dataset.fh) return;
        if (t.tagName === 'IMG') {
          t.dataset.fh = '1';
          t.src = IMG_PLACEHOLDER;
          t.style.objectFit = 'contain';
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
      document.querySelectorAll('img').forEach(function (im) { if (im.complete && im.naturalWidth === 0 && im.getAttribute('src') && im.getAttribute('src').indexOf('data:') !== 0) { im.dataset.fh = '1'; im.src = IMG_PLACEHOLDER; im.style.objectFit = 'contain'; im.style.display = 'block'; } });
    }

    // 统一处理富文本内容里的图片/视频加载失败：替换为感叹号占位（全站统一风格，参考导航页）
    function bindMediaFail(root) {
      if (!root) return;
      var imgs = root.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) (function (im) {
        if (im.dataset.fh) return;
        im.addEventListener('error', function () {
          im.onerror = null;
          im.src = IMG_PLACEHOLDER;
          im.style.objectFit = 'contain';
          im.style.display = 'block';
        });
        im.addEventListener('load', function () { if (!im.dataset.fh && im.naturalWidth === 0 && String(im.getAttribute('src') || '').indexOf('data:') !== 0) { im.dataset.fh = '1'; im.src = IMG_PLACEHOLDER; im.style.objectFit = 'contain'; im.style.display = 'block'; } });
        var _s = im.getAttribute('src') || '';
        if (!_s || _s.indexOf('data:') === 0 || (im.complete && im.naturalWidth === 0)) {
          im.dataset.fh = '1'; im.src = IMG_PLACEHOLDER; im.style.objectFit = 'contain'; im.style.display = 'block';
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
      var vl = document.createElement('a');
      vl.className = 'vf-link';
      vl.href = u;
      vl.target = '_blank';
      vl.rel = 'noopener';
      vl.textContent = '点击在新窗口播放视频';
      vf.appendChild(vl);
      return vf;
    }

    function loadImg(img, src) {
      if (img.getAttribute('src') === src && img.src && img.complete) { img.style.display = 'block'; img.style.opacity = '1'; return; }
      img.onerror = function () {
        this.onerror = null; // 防止占位图也加载失败导致死循环
        this.src = IMG_PLACEHOLDER; this.style.opacity = '1';
        this.style.display = 'block';
        this.style.objectFit = 'contain';
      };
      img.onload = function () { this.style.display = 'block'; this.style.opacity = '1'; };
      img.style.opacity = '0'; img.src = src || IMG_PLACEHOLDER;
      // R93：封面缺省/加载失败回退感叹号占位（R91 文字版已被用户否决回退）
      if (!src) { img.src = IMG_PLACEHOLDER; img.style.display = 'block'; img.style.opacity = '1'; img.style.objectFit = 'contain'; }

    /* 全局媒体兜底已上移至脚本顶部统一注册（见 loadImg 上方），此处旧实现不再执行
    document.addEventListener('error', function (e) {
      var t = e.target;
      if (!t || !t.tagName || t.dataset.fh) return;
      if (t.tagName === 'IMG') {
        t.dataset.fh = '1';
        t.src = IMG_PLACEHOLDER;
        t.style.objectFit = 'contain';
        t.style.display = 'block';
      } else if (t.tagName === 'VIDEO') {
        // R81：视频失败不再换感叹号死图，统一兜底卡（可点新窗口打开原链接）
        t.dataset.fh = '1';
        var vf = makeVideoFallback(t.getAttribute('src') || t.currentSrc || '');
        if (t.parentNode) t.parentNode.replaceChild(vf, t);
      }
    }, true); } */
    }

    // 价格格式化：0 或空返回 ''（免费不显示），整数显示 ¥99，小数显示 ¥99.00
    function formatPrice(price) {
      var p = Number(price) || 0;
      if (p <= 0) return '';
      if (p === Math.floor(p)) return '¥' + p;
      return '¥' + p.toFixed(2);
    }

    // HTML 安全过滤：只允许安全标签和属性，移除 script/事件/javascript: 协议
    // 用于资源描述和类型描述，支持 <a href="...">超链接</a>、图片、视频
    function sanitizeHTML(html) {
      if (!html) return '';
      var allowed = { A:1, BR:1, P:1, STRONG:1, EM:1, B:1, I:1, U:1, S:1, SPAN:1, DIV:1, FONT:1,
        UL:1, OL:1, LI:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, BLOCKQUOTE:1, CODE:1, PRE:1, HR:1,
        IMG:1, VIDEO:1, SOURCE:1 };
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
        BLOCKQUOTE: ['style'], CODE: ['style'], PRE: ['style']
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
      try { document.querySelectorAll('#annModal video').forEach(function (v) { v.pause(); }); } catch (e) {}
    }
    // 默认公告（一级公告）展示：选中"公告"标题，内容渲染到正文区
    function showAnnDefault() {
      var l = (window.DATA && DATA.announcements) || [];
      var d = l.find(function (x) { return x.level === 1; }) || l[0];
      if (!d) return;
      var bd = document.getElementById('annBody');
      if (bd) { var _c3 = sanitizeHTML(d.content || ''); bd.innerHTML = _c3 || '<div class="ann-empty">该公告暂无内容，请在管理页设置</div>'; bindMediaFail(bd); bindLightbox(bd); }
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
              var ts = document.querySelectorAll('#annTabs .ann-tab');
              ts.forEach(function (x) { x.classList.remove('active'); }); var tt = document.getElementById('annTitleTab'); if (tt) tt.classList.remove('active');
              t.classList.add('active');
              var bd = document.getElementById('annBody');
              if (bd) { var _c2 = sanitizeHTML(a.content || ''); bd.innerHTML = _c2 || '<div class="ann-empty">该公告暂无内容</div>'; bindMediaFail(bd); bindLightbox(bd); } } catch (e) { console.error('公告切换错误:', e); }
            });
            tabs.appendChild(t);
          });
        }
      }
      // 默认显示第一条（一级公告）并选中"公告"标题
      var body = document.getElementById('annBody');
      var defAnn = list.find(function (x) { return x.level === 1; }) || list[0]; var tt = document.getElementById('annTitleTab'); if (tt) tt.classList.add('active'); if (body) { var _c = sanitizeHTML((defAnn && defAnn.content) || ''); body.innerHTML = _c || '<div class="ann-empty">该公告暂无内容，请在管理页设置</div>'; bindMediaFail(body); bindLightbox(body); }
    }
    function renderAnnouncement() {
      try { var mask = document.getElementById('annModal');
      if (!mask) return;
      // R108：首访无缓存且接口未返回时不弹空公告窗（此前先弹"暂无内容"再闪一次刷新）——
      // 数据到位后 renderAll 会再次走到这里，弹窗出现即完整内容
      if (!(DATA.announcements || []).length && !String(DATA.announcement || '').trim()) { mask.classList.remove('open'); return; }
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
      setBodyLock(true); } catch (e) { console.error('公告渲染错误:', e); }
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
          renderCategories();
          renderProducts();
        });
        categoryBar.appendChild(tag);
      });

      // 渲染二级分类栏（选中一级分类且有子分类时显示）
      renderSubCategories();

      // 判断分类是否超出一行（只判断一次，保存状态，避免展开后判断错误导致收不回来）
      setTimeout(function () {
        catIsOverflow = categoryBar.scrollWidth > categoryBar.clientWidth + 5; if (!catIsOverflow) { catExpanded = false; categoryBar.classList.remove('expanded'); catToggle.classList.remove('open'); var ar = catToggle.querySelector('.toggle-arrow'); if (ar) ar.style.transform = 'rotate(-90deg)'; return; }
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
        renderProducts();
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
          renderProducts();
        });
        subBar.appendChild(tag);
      });

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

    // ---------- 筛选资源（支持两级分类） ----------
    function getFilteredProducts() {
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
    var PAGE_SIZE = 20;

    function renderProducts() {
      var list = getFilteredProducts();
      productGrid.innerHTML = '';
      emptyTip.classList.toggle('show', list.length === 0);

      // 移除旧分页
      var oldPager = document.getElementById('pager');
      if (oldPager) oldPager.parentNode.removeChild(oldPager);

      // 空状态：根据不同场景显示不同提示
      if (list.length === 0) {
        var emptyTitle = document.getElementById('emptyTitle');
        var emptyDesc = document.getElementById('emptyDesc');
        var kw = searchInput.value.trim();
        if (kw) {
          emptyTitle.textContent = '没有找到相关资源';
          emptyDesc.textContent = '换个关键词试试，或浏览其他分类';
        } else if (currentCat !== 0) {
          emptyTitle.textContent = '该分类暂无资源';
          emptyDesc.textContent = '看看其他分类吧，更多精彩等你发现';
        } else {
          emptyTitle.textContent = '暂无资源';
          emptyDesc.textContent = '平台正在上新中，敬请期待';
        }
        return;
      }

      // 分页计算
      var totalPages = Math.ceil(list.length / PAGE_SIZE);
      if (currentPage > totalPages) currentPage = totalPages;
      var start = (currentPage - 1) * PAGE_SIZE;
      var pageList = list.slice(start, start + PAGE_SIZE);

      // DocumentFragment 批量插入
      var frag = document.createDocumentFragment();
      pageList.forEach(function (p) {
        var card = document.createElement('div');
        card.className = 'product-card';

        var img = document.createElement('img');
        img.className = 'card-img';
        img.alt = p.title || '';
        img.loading = 'lazy';
        loadImg(img, p.img);

        var body = document.createElement('div');
        body.className = 'card-body';
        var title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = p.title || '';
        var desc = document.createElement('div');
        desc.className = 'card-desc';
        desc.textContent = p.desc || '';
        body.appendChild(title);
        body.appendChild(desc);

        card.appendChild(img);
        card.appendChild(body);
        card.addEventListener('click', function () { openModal(p); });
        frag.appendChild(card);
      });
      productGrid.appendChild(frag);

      // 分页控件（R14：改用全站统一 .uni-pager 公共组件——与数据统计翻页同款胶囊样式 + 跳页输入；
      // 翻页后回顶改瞬时滚动，原先平滑滚动叠加图片加载会显得"卡一下"）
      var pager = document.createElement('div');
      pager.id = 'pager';
      productGrid.parentNode.insertBefore(pager, productGrid.nextSibling);
      if (window.buildUniPager) {
        window.buildUniPager(pager, {
          page: currentPage,
          totalPages: totalPages,
          total: list.length,
          onPage: function (p) { currentPage = p; renderProducts(); try { window.scrollTo(0, 0); } catch (e) {} }
        });
      } else if (totalPages > 1) {
        // 兜底：公共组件缺失时退回原内联胶囊样式（不应发生）
        var prev = document.createElement('button');
        prev.textContent = '上一页';
        prev.style.cssText = 'padding:8px 16px;border:1px solid var(--blue2);background:#fff;color:var(--blue1);border-radius:20px;cursor:pointer;font-size:13px;';
        prev.disabled = currentPage === 1;
        if (prev.disabled) prev.style.opacity = '0.4';
        prev.onclick = function () { if (currentPage > 1) { currentPage--; renderProducts(); window.scrollTo({top:0,behavior:'smooth'}); } };
        pager.appendChild(prev);
        var info = document.createElement('span');
        info.textContent = currentPage + ' / ' + totalPages;
        info.style.cssText = 'color:var(--text-light);font-size:13px;';
        pager.appendChild(info);
        var next = document.createElement('button');
        next.textContent = '下一页';
        next.style.cssText = 'padding:8px 16px;border:1px solid var(--blue2);background:#fff;color:var(--blue1);border-radius:20px;cursor:pointer;font-size:13px;';
        next.disabled = currentPage === totalPages;
        if (next.disabled) next.style.opacity = '0.4';
        next.onclick = function () { if (currentPage < totalPages) { currentPage++; renderProducts(); window.scrollTo({top:0,behavior:'smooth'}); } };
        pager.appendChild(next);
      }
    }

    // ---------- 详情弹窗 ----------
    function openModal(p) {
      currentProduct = p;
      currentVariant = null;
      track(p.id, 'view');

      loadImg(modalCover, p.img);
      modalCover.style.cursor = 'zoom-in';
      modalCover.onclick = function () { if (p.img) openLightbox(p.img); };
      modalTitle.textContent = p.title || '';
      modalDesc.textContent = p.desc || '';

      // 详细描述（支持 HTML 超链接，如 <a href="https://...">点击查看</a>）
      if (p.detail && p.detail.trim()) {
        modalDetail.innerHTML = sanitizeHTML(p.detail);
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
        im.src = url;
        im.alt = '';
        im.style.cursor = 'zoom-in';
        im.addEventListener('click', function () { openLightbox(url); });
        if (window.mediaStable) window.mediaStable(im);
        modalMedia.appendChild(im);
      });
      videos.forEach(function (url) {
        if (!url) return;
        var v = document.createElement('video');
        v.src = url;
        v.controls = true;
        v.playsInline = true;
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
        variants.forEach(function (v, idx) {
          var tab = document.createElement('div');
          tab.className = 'variant-tab' + (idx === 0 ? ' active' : '');
          tab.textContent = v.name || '类型' + (idx + 1);
          tab.addEventListener('click', function () {
            currentVariant = v;
            variantTabs.querySelectorAll('.variant-tab').forEach(function (t, i) {
              t.classList.toggle('active', i === idx);
            });
            renderVariantDetail();
            updatePrice();
            updateContactBtn();
            initResourceCodeSection(); // 切换类型时重置资源码区域
          });
          variantTabs.appendChild(tab);
        });
        // 默认选中第一个类型，显示其价格和详情
        currentVariant = variants[0];
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

      modalMask.classList.add('open');
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
    // 请求服务端解锁：code 传空 = 自动检查（已绑定设备/无码类型直接拿内容）
    var unlockBusy = false;
    function requestResourceUnlock(code) {
      if (!currentProduct || !currentVariant || unlockBusy) return Promise.resolve(null);
      var pid = currentProduct.id, vid = currentVariant.id;
      unlockBusy = true;
      return fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: pid, variantId: vid, code: code || '' })
      }).then(function (r) { return r.json(); }).catch(function () {
        return { ok: false, msg: '网络异常，请稍后重试' };
      }).then(function (res) {
        unlockBusy = false;
        // 弹窗已切换/关闭时丢弃过期响应
        if (!currentProduct || !currentVariant || currentProduct.id !== pid || currentVariant.id !== vid) return null;
        if (res && res.ok && res.content) {
          var resourceContent = document.getElementById('resourceContent');
          if (resourceContent && resourceContent.style.display === 'none') {
            var inputRow = document.getElementById('resourceCodeInputRow');
            if (inputRow) inputRow.style.display = 'none';
            var directRow = document.getElementById('resourceDirectRow');
            if (directRow) directRow.style.display = 'none';
            unlockResourceContent(res.content);
          }
        }
        // 失败时静默返回（提示由 verifyResourceCode / 直接获取键按场景处理）
        return res;
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

      if (hasCode) {
        // 有资源码：显示输入框+解锁按钮
        resourceTitle.textContent = '输入资源码获取专属内容';
        resourceInputRow.style.display = 'flex';
        resourceDirectRow.style.display = 'none';
        resourceInput.value = '';
      } else {
        // 无资源码：显示直接获取按钮
        resourceTitle.textContent = '获取专属内容';
        resourceInputRow.style.display = 'none';
        resourceDirectRow.style.display = 'block';
      }

      // R92 宽松模式通行证体验：打开弹窗即静默检查一次——
      // 已绑定设备（或无码类型）直接拿到内容并展示，老访客无需再输一遍码
      requestResourceUnlock('');
    }

    // 通用：显示专属内容并统计（服务端验证成功 / 已绑定设备 / 直接查看 都走这里）
    // R92：内容由 /api/unlock 服务端返回传入，前台不再持有明文
    function unlockResourceContent(content) {
      var resourceContent = document.getElementById('resourceContent');
      resourceContent.innerHTML = sanitizeHTML(content || '<p>专属内容</p>');
      bindMediaFail(resourceContent); bindLightbox(resourceContent);
      resourceContent.style.display = 'block';
      // 触发动画重播
      resourceContent.style.animation = 'none';
      void resourceContent.offsetWidth;
      resourceContent.style.animation = '';
      // 统计解锁（记录资源ID和类型ID，30天内有效）
      var variantId = currentVariant ? currentVariant.id : 0;
      track(currentProduct.id, 'resource_unlock', {variant_id: variantId});
    }

    function renderVariantDetail() {
      if (!currentVariant) { variantDetail.style.display = 'none'; return; }
      variantDetail.innerHTML = '';
      var hasContent = false;

      // 类型标题行：类型名 + 价格（有价格才显示）
      var header = document.createElement('div');
      header.className = 'variant-header';
      var vName = document.createElement('span');
      vName.className = 'variant-name';
      vName.textContent = currentVariant.name || '';
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
        im.src = currentVariant.img;
        im.alt = '';
        im.style.cursor = 'zoom-in';
        im.addEventListener('click', function () { openLightbox(currentVariant.img); });
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
        variantDetail.style.animation = 'fadeInUp 0.18s ease';
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

    // 咨询客服兜底弹窗：ui-common.js 加载失败时使用（样式对齐导航页，杜绝直达链接）
    // 关闭兜底客服：恢复背景视频显示并隐藏弹窗（与公共客服弹窗行为一致）
    window.__kfFbClose = function () {
      var m = document.getElementById('kfFallback');
      if (m) m.style.display = 'none';
      try { document.querySelectorAll('video').forEach(function (v) { if (v.dataset.__kfFbHid) { v.dataset.__kfFbHid = ''; v.style.visibility = ''; } }); } catch (e) {}
      if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
    };
    function openContactFallback(url) {
      var m = document.getElementById('kfFallback');
      if (!m) {
        m = document.createElement('div');
        m.id = 'kfFallback';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.76);z-index:9999;display:none;align-items:center;justify-content:center;padding:16px;';
        m.innerHTML = '<div style="background:#fff;border-radius:14px;padding:26px 22px;max-width:480px;width:100%;text-align:center;position:relative;">' +
          '<button type="button" aria-label="关闭" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:none;background:#f0f2f5;color:#666;font-size:19px;cursor:pointer;line-height:1;" onclick="window.__kfFbClose()">×</button>' +
          '<div style="font-size:22px;color:#222;margin-bottom:16px;letter-spacing:1.3px;padding:0 34px;">咨询客服</div>' +
          '<div style="width:250px;height:250px;max-width:100%;border:1px solid #eee;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border-radius:6px;"><img id="kfFallbackImg" src="/assets/images/kefu.png" alt="客服二维码" style="max-width:100%;max-height:100%;object-fit:contain;display:block;"></div>' +
          '<div style="font-size:16px;color:#666;margin-bottom:16px;letter-spacing:0.9px;">长按图片识别-添加人工客服</div>' +
          '<button type="button" data-u="" style="width:80%;border:none;border-radius:8px;padding:11px 32px;background:#01C000;color:#fff;font-size:18px;cursor:pointer;letter-spacing:0.9px;margin-bottom:14px;" onclick="var u=this.getAttribute(\'data-u\');if(u){window.open(u,\'_blank\');}">跳转-咨询在线客服</button>' +
          '<button type="button" style="background:#ff4444;color:#fff;border:none;padding:11px 32px;border-radius:8px;font-size:18px;cursor:pointer;letter-spacing:0.9px;" onclick="window.__kfFbClose()">关闭</button>' +
          '</div>';
        document.body.appendChild(m);
        m.addEventListener('click', function (e) { if (e.target === m) window.__kfFbClose(); });
        var im = document.getElementById('kfFallbackImg');
        if (im) im.onerror = function () { this.onerror = null; this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E'; };
      }
      var jb = m.querySelector('button[data-u]');
      if (jb) jb.setAttribute('data-u', url || '');
      // 打开客服：隐藏并暂停背景视频（原生视频层级高于一切，仅暂停仍会盖住弹窗）
      // R14：排除范围与 ui-common.js 主实现同步扩大——弹窗容器内（资源详情/预览/公告/分享/灯箱）的视频不隐藏，
      // 否则点客服会把资源弹窗里的视频藏掉、弹窗高度塌陷
      try { document.querySelectorAll('video').forEach(function (v) { if (!v.closest('#kfFallback, .kf-box, .kf-mask, .modal-mask, .ann-modal, .share-mask, .lightbox, .stat-modal')) { v.dataset.__kfFbHid = '1'; try { v.pause(); } catch (e) {} v.style.visibility = 'hidden'; } }); } catch (e) {}
      m.style.display = 'flex';
      if (window.lockBodyScroll) window.lockBodyScroll(true);
    }

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
          if (window.openContactModal) { window.openContactModal(url, '/assets/images/kefu.png', null, '跳转-咨询在线客服'); } else { openContactFallback(url); }
        };
      } else {
        btnContact.style.display = ''; btnContact.onclick = function () { toast('暂未设置客服链接'); };
      }
    }

    function closeModal() { try { document.querySelectorAll('#modalBox video, #modalMedia video').forEach(function (v) { v.pause(); }); } catch (e) {}
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

    btnCloseModal.addEventListener('click', closeModal);
    modalCloseX.addEventListener('click', closeModal);
    modalMask.addEventListener('click', function (e) {
      if (e.target === modalMask) closeModal();
    });

    // ---------- R10 资源分享（弹窗左上角转发键） ----------
    // R14：点击改为弹窗形式（复用 ui-common 公共分享链接弹窗，观感与顶栏「分享本站」一致：标题+链接+确定），
    // 弹窗内部自动复制链接到剪贴板
    modalShareX.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!currentProduct || !currentProduct.id) { showToast('该资源暂不能分享'); return; }
      var url = window.location.origin + window.location.pathname + '?pid=' + currentProduct.id;
      if (window.showShareLinkModal) window.showShareLinkModal('分享资源', url);
      else { if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch (e) {} } showToast('链接已复制到剪贴板'); }
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
        return;
      }
      // R92：验证移到服务端（大小写不敏感由服务端比对），前台不再持有明文码；
      // 码正确且未超绑定上限 → 绑定本设备并返回专属内容；已绑定设备直接放行
      var btn = document.getElementById('resourceCodeBtn');
      var btnText = btn.textContent;
      btn.disabled = true; btn.textContent = '解锁中…';
      requestResourceUnlock(input).then(function (res) {
        btn.disabled = false; btn.textContent = btnText;
        if (res === null) return; // 过期响应（弹窗已切换），不提示
        if (res && res.ok && res.content) {
          // 内容已由 requestResourceUnlock 统一渲染并隐藏输入行
          resourceCodeError.style.display = 'none';
        } else {
          // 验证失败（资源码错误 / 绑定设备数超上限），提示语由服务端下发
          resourceCodeError.textContent = (res && res.msg) || '资源码错误，请检查后重试';
          resourceCodeError.style.display = 'block';
          resourceCodeInput.style.borderColor = '#ff4444';
          setTimeout(function () { resourceCodeInput.style.borderColor = ''; }, 1500);
        }
      });
    }
    resourceCodeBtn.addEventListener('click', verifyResourceCode);
    resourceCodeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') verifyResourceCode();
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
        btn.disabled = true; btn.textContent = '获取中…';
        requestResourceUnlock('').then(function (res) {
          btn.disabled = false; btn.textContent = btnText;
          if (res === null) return;
          if (res && res.ok && res.content) {
            resourceDirectRow.style.display = 'none';
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
    searchInput.addEventListener('input', function () {
      searchClear.classList.toggle('show', this.value.length > 0);
      clearTimeout(searchTimer);
      var self = this;
      searchTimer = setTimeout(function () {
        currentPage = 1;
        renderProducts();
      }, 300);
    });
    searchClear.addEventListener('click', function () {
      searchInput.value = '';
      this.classList.remove('show');
      renderProducts();
      searchInput.focus();
    });

    // ---------- Toast 轻提示 ----------
    function showToast(msg) {
      // R80：全站 toast 统一规格——与下拉刷新提示胶囊一字不差（白底0.92+蓝1字+蓝2边+圆角20+同投影）
      // R83：位置统一 top:80px（四页同位），淡入0.2s→停留2s→淡出0.3s；转圈图标仅下拉刷新保留
      var t = document.createElement('div');
      t.textContent = msg;
      t.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);color:var(--blue1,#1E88E5);background:rgba(255,255,255,0.92);border:1px solid var(--blue2,#64B5F6);border-radius:20px;padding:6px 16px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);z-index:100002;pointer-events:none;max-width:90%;text-align:center;opacity:0;transition:opacity 0.2s ease;';
      document.body.appendChild(t);
      requestAnimationFrame(function () { t.style.opacity = '1'; });
      setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s ease'; }, 2000);
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2300);
    }

    // ---------- 顶栏：咨询客服 ----------
    (function () { var svg = topContactBtn && topContactBtn.querySelector('svg'); if (svg) { svg.setAttribute('fill', 'currentColor'); svg.removeAttribute('stroke'); svg.removeAttribute('stroke-width'); svg.removeAttribute('stroke-linecap'); svg.removeAttribute('stroke-linejoin'); var p = svg.querySelector('path'); if (p) p.setAttribute('d', 'M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-2.036 2.87c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.983.97-.983zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.983.969-.983z'); svg.style.width = '15px'; svg.style.height = '15px'; } })();
    topContactBtn.addEventListener('click', function () {
      var url = window._globalContact || getDefaultContact();
      // R20：点击后按钮保持激活白底（与管理页退出一致：弹窗未关闭期间按键呈白色），弹窗关闭后自动恢复
      topContactBtn.classList.add('active');
      // R13：补传第 4 参（跳转键文案）——引入公共客服弹窗时漏传导致跳转键被隐藏，旧版本来有，恢复
      if (url) { if (window.openContactModal) { window.openContactModal(url, '/assets/images/kefu.png', null, '跳转-咨询在线客服'); } else { openContactFallback(url); } }
      else showToast('暂未设置客服链接');
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
        // （同步 execCommand 手势内执行 + clipboard API 双保险），提示文案全站统一
        if (window.__shareCopyText) {
          try { window.__shareCopyText(url); } catch(e){}
        } else {
          try { fallbackCopy(url); } catch(e){}
        }
        showToast('链接已复制到剪贴板');
        if (shareMask) { shareMask.classList.add('open'); setBodyLock(true); }
      } catch (e) {
        console.error('分享失败:', e);
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
        // R79：统一走公共复制链路（同步 execCommand + clipboard API 双保险），文案统一
        if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch(e){} }
        else { try { fallbackCopy(url); } catch(e){} }
        showToast('链接已复制到剪贴板');
      });
    }
    shareMask.addEventListener('click', function (e) {
      if (e.target === shareMask) closeShare();
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

    // 解析公告列表（兼容旧单条 announcement；过滤隐藏、按 sort 排序）
    function parseAnnouncements(settings) {
      var arr = [];
      try { arr = JSON.parse(settings.announcements || '[]'); } catch (e) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      if (!arr.length && settings.announcement) arr = [{ id: 0, title: '公告', content: String(settings.announcement || ''), hidden: 0, sort: 0, level: 1 }];
      arr = arr.filter(function (a) { return !a.hidden; });
      arr.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      return arr;
    }

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
            try { localStorage.setItem('wnzyq_shop_data', JSON.stringify(c)); } catch (e2) {}
            DATA.categories = c.categories;
            if (c.announcement !== undefined) DATA.announcement = c.announcement;
            if (c.announcement_mode !== undefined) DATA.announcementMode = c.announcement_mode;
            if (Array.isArray(c.announcements)) DATA.announcements = c.announcements;
            if (c.shop_name) DATA.shopName = c.shop_name;
            usingRemote = true;
            hasCache = true;
          }
        }
      } catch (e) {}
      // 没有缓存时才用 config.js 兜底
      if (!hasCache) loadFallback();
      renderAll();
      // 本地环境（file:// 或 localhost）不发起 API 请求，避免 404 报错
      var isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocal) {
        fetchRemote();
      }
    }

    function fetchRemote() {
      function withTimeout(p, ms) {
        return Promise.race([
          p,
          new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); }),
        ]);
      }
      Promise.all([
        withTimeout(fetch('/api/products', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), 4000),
        withTimeout(fetch('/api/categories', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), 4000),
        withTimeout(fetch('/api/settings', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), 4000)
      ]).then(function (res) {
        if (res[0] && res[0].ok && res[1] && res[1].ok) {
          DATA.products = res[0].list || [];
          DATA.categories = res[1].list || [];
          usingRemote = true;
          // 存 localStorage 缓存
          try {
            localStorage.setItem('wnzyq_shop_data', JSON.stringify({ products: DATA.products, categories: DATA.categories }));
          } catch (e) {}
        }
        if (res[2] && res[2].ok) {
          DATA.announcement = (res[2].settings || {}).announcement || '';
          DATA.announcementMode = (res[2].settings || {}).announcement_mode || 'always';
          DATA.announcements = parseAnnouncements(res[2].settings || {});
          // 店铺名与全局客服链接：统一在这一次 settings 请求里更新（不再另发请求）
          if ((res[2].settings || {}).shop_name) { DATA.shopName = res[2].settings.shop_name; }
          window._globalContact = (res[2].settings || {}).contact_url || getDefaultContact();
          try {
            var cacheData = JSON.parse(localStorage.getItem('wnzyq_shop_data') || '{}');
            cacheData.announcement = DATA.announcement;
            cacheData.announcement_mode = DATA.announcementMode;
            cacheData.announcements = DATA.announcements;
            if (DATA.shopName) cacheData.shop_name = DATA.shopName;
            localStorage.setItem('wnzyq_shop_data', JSON.stringify(cacheData));
          } catch (e) {}
        }
        // 无论成功失败，都渲染一次（显示资源或空状态）
        renderAll();
        // R10 分享链接：远端数据已到，处理 ?pid= 自动打开资源弹窗（此数据源可信，查不到则提示失效）
        checkSharePid(true);
      }).catch(function () {
        // 请求异常时也渲染一次（显示本地数据或空状态）
        renderAll();
        // R10 分享链接：网络失败时基于缓存尽力打开（缓存查不到不提示失效——可能是缓存过期误报）
        checkSharePid(false);
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
        if (window.showAlert) window.showAlert('该资源已隐藏或不存在');
        else showToast('该资源已隐藏或不存在');
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
    // 页面重新可见 / 从其他页面切回时，静默拉取最新数据（管理页改动更快同步，不闪烁）
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && typeof usingRemote !== 'undefined' && usingRemote) { fetchRemote(); }
    });
    window.addEventListener('pageshow', function () {
      var isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocal) { fetchRemote(); }
    });

    // ---------- 下拉刷新（手机端页面顶部下拉刷新数据） ----------
    var pullRefreshEl = document.getElementById('pullRefresh');
    var topbarEl = document.querySelector('.topbar'); // 提前定义，供下拉刷新使用
    var pullStartY = 0;
    var pullStartX = 0;
    var isPulling = false;
    var pullDistance = 0;
    var PULL_THRESHOLD = 60; // 下拉超过60px触发刷新
    document.addEventListener('touchstart', function (e) {
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
        pullRefreshEl.style.height = pullDistance + 'px';
        pullRefreshEl.classList.add('show');
        document.getElementById('pullRefreshText').textContent = pullDistance > PULL_THRESHOLD ? '释放立即刷新' : '下拉刷新';
      }
    }, { passive: true });
    document.addEventListener('touchend', function () {
      if (!isPulling) return;
      isPulling = false;
      if (pullDistance > PULL_THRESHOLD) {
        // 触发刷新
        pullRefreshEl.style.height = '28px';
        document.getElementById('pullRefreshText').textContent = '正在刷新…';
        window.__annShown = false; window.__annDismissed = false;
        // 清除缓存，重新加载数据
        try { localStorage.removeItem('wnzyq_shop_data'); } catch (e) {}
        setTimeout(function () {
          if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            loadFallback();
          } else {
            fetchRemote();
          }
          renderAll();
          pullRefreshEl.classList.remove('show');
          pullRefreshEl.style.height = '0';
          // 刷新结束后显示顶部栏
          if (topbarEl) { topbarEl.style.transition = ''; topbarEl.classList.remove('hidden'); }
        }, 400);
      } else {
        // 未达到阈值，收回
        pullRefreshEl.classList.remove('show');
        pullRefreshEl.style.height = '0';
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

      // 无限滚动：滚动到距离底部 200px 时自动加载下一页
      var scrollBottom = window.innerHeight + currentY;
      var pageHeight = document.documentElement.scrollHeight;
      if (pageHeight - scrollBottom < 200 && !window.__loadingNextPage) {
        var list = getFilteredProducts();
        var totalPages = Math.ceil(list.length / PAGE_SIZE);
        if (currentPage < totalPages) {
          window.__loadingNextPage = true;
          currentPage++;
          // 追加下一页资源，不重新渲染全部
          var start = (currentPage - 1) * PAGE_SIZE;
          var pageList = list.slice(start, start + PAGE_SIZE);
          var frag = document.createDocumentFragment();
          pageList.forEach(function (p) {
            var card = document.createElement('div');
            card.className = 'product-card';
            var img = document.createElement('img');
            img.className = 'card-img';
            img.alt = p.title || '';
            img.loading = 'lazy';
            loadImg(img, p.img);
            var body = document.createElement('div');
            body.className = 'card-body';
            var title = document.createElement('div');
            title.className = 'card-title';
            title.textContent = p.title || '';
            var desc = document.createElement('div');
            desc.className = 'card-desc';
            desc.textContent = p.desc || '';
            body.appendChild(title);
            body.appendChild(desc);
            card.appendChild(img);
            card.appendChild(body);
            card.addEventListener('click', function () { openModal(p); });
            frag.appendChild(card);
          });
          productGrid.appendChild(frag);
          // 更新分页控件的当前页
          var pagerInfo = document.querySelector('#pager .pg-info'); // R35：pg-main 组盒后不能再取第一个 span（会命中组盒、textContent 清空整组按钮），改精确取 .pg-info
          if (pagerInfo) pagerInfo.textContent = currentPage + ' / ' + totalPages;
          setTimeout(function () { window.__loadingNextPage = false; }, 300);
        }
      }
    }
    // scroll事件触发时立即检查，停止滚动200ms后做一次最终检查（兜底）
    window.addEventListener('scroll', function () {
      checkScroll();
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
      // 资源详情 / 公告 / 分享 / 客服：纯展示，四通道=直接关（客服 kfMask 在 ui-common 创建处注册）
      kit.register(modalMask, { discard: closeModal, stash: closeModal });
      var __am = document.getElementById('annModal'); if (__am) kit.register(__am, { discard: closeAnnModal, stash: closeAnnModal });
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
    // 内联兜底：公共脚本未加载时 bfcache 恢复也会强制刷新（返回/前进页面状态混乱导致白屏的唯一根治）
    window.addEventListener('pageshow', function (e) { if (e.persisted) { window.location.reload(); } });
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
        showToast('已刷新');
      }
      touchStartY = 0;
    });

    // ---------- 图片灯箱 ----------
    var lightboxMask = null;
    function openLightbox(src) {
      if (!lightboxMask) {
        lightboxMask = document.createElement('div');
        lightboxMask.className = 'lightbox';
        // R111：点图片本身不算「弹窗外」，只有点空白遮罩才关（与全站口径一致）
        lightboxMask.onclick = function (e) { if (e.target === lightboxMask) closeLightbox(); };
        document.body.appendChild(lightboxMask);
        if (window.__modalKit) window.__modalKit.register(lightboxMask, { discard: closeLightbox, stash: closeLightbox });
      }
      lightboxMask.textContent = ''; var _lbx = document.createElement('button'); _lbx.type = 'button'; _lbx.className = 'modal-close-x'; _lbx.textContent = '×'; _lbx.onclick = closeLightbox; lightboxMask.appendChild(_lbx);
      var isVideo = /\.(mp4|webm|ogv|m3u8)(\?|#|$)/i.test(src) || /video|\.m3u8/i.test(src); var _lbImg = document.createElement(isVideo ? 'video' : 'img');
      _lbImg.src = src; if (isVideo) { _lbImg.controls = true; _lbImg.autoplay = true; _lbImg.playsInline = true; }
      /* R21：灯箱视频同样固定 16:9 占位（黑底 contain），未加载/加载完成尺寸一致，不从小变大跳动 */
      _lbImg.style.cssText = 'max-width:92%;max-height:92%;object-fit:contain;border-radius:8px;transition:transform .05s linear;' + (isVideo ? 'width:92%;aspect-ratio:16/9;background:#000;' : '');
      lightboxMask.appendChild(_lbImg); setBodyLock(true);
      lightboxMask.style.display = 'flex';
      lightboxMask.classList.add('open');
    }
    function closeLightbox() { try { if (lightboxMask) lightboxMask.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) {}
      if (lightboxMask) {
        lightboxMask.style.display = 'none';
        lightboxMask.classList.remove('open');
        setBodyLock(false);
      }
    }

    // 灯箱双指缩放（事件委托：lightbox 打开时双指放大看细节，双击复位）
    (function () {
      var scale = 1, startDist = 0;
      document.addEventListener('touchstart', function (e) {
        if (!lightboxMask || !lightboxMask.classList.contains('open')) return;
        if (e.touches.length === 2) startDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }, { passive: true });
      document.addEventListener('touchmove', function (e) {
        if (!lightboxMask || !lightboxMask.classList.contains('open')) return;
        if (e.touches.length === 2 && startDist > 0) {
          var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          scale = Math.min(4, Math.max(1, scale * (d / startDist)));
          var el = lightboxMask.querySelector('img, video');
          if (el) el.style.transform = 'scale(' + scale + ')';
          startDist = d;
          e.preventDefault();
        }
      }, { passive: false });
      document.addEventListener('touchend', function () { startDist = 0; });
      document.addEventListener('dblclick', function (e) {
        if (!lightboxMask || !lightboxMask.classList.contains('open')) return;
        if (lightboxMask.contains(e.target)) { scale = 1; var el = lightboxMask.querySelector('img, video'); if (el) el.style.transform = 'scale(1)'; }
      });
    })();
    // 统一绑定：区域内所有图片/视频点击放大（富文本描述/类型描述/专属内容等复用）
    function bindLightbox(root) {
      if (!root) return;
      // 动态内容每次重新绑定（img 用 dataset.lb 去重）
      root.querySelectorAll('img').forEach(function (im) {
        if (im.dataset.lb) return;
        im.dataset.lb = '1';
        im.style.cursor = 'zoom-in';
        im.addEventListener('click', function (ev) { ev.stopPropagation(); openLightbox(im.currentSrc || im.src); });
      });
      root.querySelectorAll('video').forEach(function (v) {
        if (v.dataset.lb) return;
        v.dataset.lb = '1';
        v.style.cursor = 'zoom-in';
        v.addEventListener('click', function (ev) { ev.stopPropagation(); openLightbox(v.currentSrc || v.src); });
      });
    }

    // ---------- 初始化 ----------
    renderShopInfo();
    updateTopbarHeight();
    initData();

    // 视图切换（网格/列表）
    var currentView = localStorage.getItem('shop_view') || 'list';
    function triggerViewAnim(el) { if (!el) return; el.classList.remove('view-switch-anim'); void el.offsetWidth; el.classList.add('view-switch-anim'); }
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
    }
    document.getElementById('viewGridBtn').addEventListener('click', function () { setShopView('grid'); });
    document.getElementById('viewListBtn').addEventListener('click', function () { setShopView('list'); });
    setShopView(currentView);

    // 强制确保页面可见（防止动画异常导致body opacity为0）
    setTimeout(function () { document.body.style.opacity = '1'; }, 500);

    // ---- 图片/视频放大查看器（点击放大、双指缩放） ----
    // 图片/视频放大查看器已由上方 openLightbox/bindLightbox 统一提供（动态创建），此处无重复实现

    // 弹窗内图片/视频点击放大已由上方 bindLightbox 统一绑定
