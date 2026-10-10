/* v346 条1/12：后台按功能拆分 第2/5 段（由原 admin.js 物理切分；为支持拆分，已去掉最外层"圈屋"包裹，逻辑与拆分前一致） */
// ---------- 资源管理 ----------
    /* R281（老板 09-28 21:27 拍板）：上次拉取时间戳——切回窗口 >60s 才静默重拉（与 shop R243 条32 / R276 同规则全站统一） */
    window.__lastFetchTime = 0;
    /* R281：数据签名——静默重拉的 diff 基准。剔除运行时字段 variants（首载 variants 预载写回 p 上、
       属本地缓存不属于服务端数据），其余字段全量比对：名称/价格/排序/上下架状态等老板会感知的字段全覆盖 */
    function __adminDataSig(list) {
      return JSON.stringify((list || []).map(function (p) { var c = {}; for (var k in p) { if (k !== 'variants') c[k] = p[k]; } return c; }));
    } /* R281：diff 剔除运行时缓存字段 variants（首载预载写回），其余全字段比对（名称/价格/排序/上下架状态都在内） */
    // v326（用户 10-06 15:18）：根因→管理页空态文案只认搜索词，分类/状态筛空时一律「暂无资源」，老板分不清是筛空还是真没数据；
    // 修法→按搜索/分类/状态/全空四档出对应文案，全系统统一「数据加载完成且筛空」才出立方+灰字，加载中绝不显示。
    function __getAdminEmptyText() {
      var __kw = (document.getElementById('adminSearch').value || '').trim();
      var __fc = document.getElementById('filterCat').value;
      var __fs = document.getElementById('filterStatus').value;
      if (__kw) return '该搜索暂无资源';
      if (__fc && __fc !== '0') return '该分类暂无资源';
      if (__fs) return '该状态暂无资源';
      return '暂无资源';
    }
    function __adminCatSig(list) {
      return JSON.stringify((list || []).map(function (c) { var o = {}; for (var k in c) { if (k !== 'cnt' && k !== 'totalCnt') o[k] = c[k]; } return o; }));
    } /* R281：分类 diff 剔除运行时衍生字段 cnt/totalCnt（refreshCatCnts 现场计算写回），服务端字段（id/name/sort/parent_id/is_hidden）没变即视为没变 */
    /* R303（P13）：管理页资源列表 diff 更新——两行间核心展示字段全等才视为同一行 */
    function __adminRowEqual(a, b) {
      if (!a || !b) return false;
      if (a.id !== b.id) return false;
      return a.title === b.title && a.desc === b.desc && a.img === b.img && a.price === b.price &&
             a.is_online === b.is_online && a.is_hidden === b.is_hidden && a.cid === b.cid && a.sort === b.sort;
    }

    /* v330 条20：换场态收尾（成功/失败都要收，避免列表一直半透明点不动） */
    function __clearSwitching() {
      try {
        var _pl2 = document.getElementById('productList');
        if (_pl2) _pl2.classList.remove('is-switching');
        var _pp2 = document.getElementById('adminPager');
        if (_pp2) _pp2.classList.remove('is-switching');
      } catch (e) { if (window.__silent) window.__silent(e); }
    }

    function loadProducts(silent) { /* R281：silent=切回窗口静默重拉——不铺骨架、不弹 toast；快照比对没变不重画 */
      /* v314（用户 10-05 15:59）：根因→管理页资源列表翻页/搜索/筛选每次走网络，旧内容淡出成空白等待；修法→内存缓存秒开+后台静默刷新（stale-while-revalidate）。看过的组合(page+kw+filterCat+filterStatus)存内存，再切回来立即渲染零等待。首次切到新组合不清空旧内容+轻量进度条，数据回来再替换。真失败toast提示+收骨架不留灰态。下拉刷新清缓存拿最新。 */
      /* v317（用户 10-05 18:40）：老板拍板规则1/2/3/4+优化2/3/4，首屏只拿第一页，翻页/搜索/筛选点到才拉+缓存秒出。 */
      var kw = (document.getElementById('adminSearch').value || '').trim();
      var filterCat = document.getElementById('filterCat').value;
      var filterStatus = document.getElementById('filterStatus').value;
      var _cacheKey = __adminProductCacheKey(adminPage, kw, filterCat, filterStatus);
      var _cache = __adminProductCache[_cacheKey];
      // silent 模式（后台静默刷新）不走缓存命中立即渲染路径
      if (!silent && _cache) {
        // 命中缓存：秒开——先渲染已有数据，零等待
        state.products = _cache.products || [];
        state.totalPages = _cache.totalPages || 1;
        state.total = _cache.total || 0;
        state._backendPaged = _cache._backendPaged;
        renderProducts();
        initFilterCatPicker();
        // 后台静默刷新（stale-while-revalidate）
        loadProducts(true).catch(function () {});
        return Promise.resolve();
      }
      // 防重复请求
      var _loading = __adminProductCacheLoading[_cacheKey];
      if (_loading) return _loading;
      /* R230：首次加载（列表空且无数据）先铺骨架——数量=一页 20 条、槽位尺寸与真行一致；
         CRUD 后的刷新已有数据在先，不铺（与资源页「骨架只铺数据在路上」同口径） */
      // R256：骨架已内嵌在 admin.html，有则不复建，避免闪两下/残影
      var _plBox = document.getElementById('productList');
      var _hasSkel = _plBox && _plBox.querySelectorAll('.admin-skel').length > 0;
      if (!silent) {
        if (!state.products.length && !_hasSkel) {
          window.__adminSkelP = true; renderProductSkeleton();
        } else if (_hasSkel) {
          window.__adminSkelP = true;
        } else if (state.products.length) {
          /* v330 条20：换场反馈——筛选/翻页切换时旧列表降到 60% 透明且不可点（明确"正在换"），数据回来自动恢复 */
          var _pl = document.getElementById('productList');
          if (_pl) _pl.classList.add('is-switching');
          var _plPager = document.getElementById('adminPager');
          if (_plPager) _plPager.classList.add('is-switching');
        }
      }
      var _snapP = silent ? __adminDataSig(state.products) : null;
      var ensureCat = state.categories.length
        ? Promise.resolve()
        : (window.__catLoading || loadCategories()).then(function (res) {
            if (res && res.ok) {
              state.categories = (res.list || []).map(function (c) { return { id: Number(c.id), parent_id: Number(c.parent_id), name: c.name, sort: Number(c.sort) || 0, is_hidden: c.is_hidden, cnt: Number(c.cnt) || 0 }; }); /* R281：加工口径与 loadCategories 完全一致（is_hidden 不再 || 0——undefined 口径统一，否则静默 diff 永不相等导致每次重画） */
            }
          });
      // R303：分页与筛选参数
      var qs = '?page=' + adminPage + '&page_size=' + ADMIN_PAGE_SIZE;
      if (kw) qs += '&kw=' + encodeURIComponent(kw);
      if (filterCat && filterCat !== '0') qs += '&cid=' + encodeURIComponent(filterCat);
      if (filterStatus) qs += '&status=' + encodeURIComponent(filterStatus);
      // v318（用户 10-05 22:06）：记录请求时的 cacheKey，响应回来后与当前条件比较，不一致则丢弃（防搜索词快速变化时旧响应覆盖新结果）。
      var _reqCacheKey = _cacheKey;
      var _doFetch = function () {
        return ensureCat.then(function () {
          // 分类筛选已改为级联选择器（与新增/编辑资源一致）；R281：silent 时不预重建（下拉 DOM 每次重建非幂等，数据有变才在成功回调里补建）
          if (!silent) initFilterCatPicker();
          return api('admin/products' + qs);
        }).then(function (res) {
          // v318（用户 10-05 22:06）：响应序号守卫——请求发出后搜索词/页码/筛选又变了，丢弃旧响应。
          var curCacheKey = __adminProductCacheKey(adminPage, (document.getElementById('adminSearch').value || '').trim(), document.getElementById('filterCat').value, document.getElementById('filterStatus').value);
          if (curCacheKey !== _reqCacheKey) return; /* 条件已变：响应丢弃（换场态由新请求自己收尾） */
          __clearSwitching(); /* v330 条20：换场态收尾（成功路径） */
          try { window.__clearLoadRetry(document.getElementById('productList')); } catch (e0) { if (window.__silent) window.__silent(e0); } /* v330 条21：数据回来收掉重试块 */
          if (!res.ok) {
            if (silent) return; /* R281：静默失败不动画面不弹 toast、不更新时间戳（下次切回再试） */
            /* R230：接口异常收骨架走空态，不卡灰（对齐资源页 fetchRemote 兜底） */
            window.__adminSkelP = false; __clearAdminSkel(document.getElementById('productList'));
            // v315（用户 10-05 17:33）：进度条全删
            var _em = document.getElementById('productEmpty');
            // v326（用户 10-06 15:18）：接口异常收骨架走空态时也按当前筛选条件出对应文案。
            if (_em) { _em.classList.add('show'); document.getElementById('productEmptyTitle').textContent = __getAdminEmptyText(); }
            /* v330 条21：真失败且列表空 → 就地给「重试」（不用手动刷新页面；旧数据还在时保持显示，不打扰） */
            try {
              var _plb = document.getElementById('productList');
              if (_plb && !(state.products || []).length) {
                window.__showLoadRetry(_plb.parentNode || _plb, function () {
                  __adminProductCache = {}; /* 清缓存重拉，避免拿到同样的失败态 */
                  loadProducts();
                });
              }
            } catch (e0) { if (window.__silent) window.__silent(e0); }
            // v319（用户 10-05 22:15）：根因→登录后/切分类时网络失败反复弹「加载失败」toast，老板网络本就慢、体验差；
            // 修法→已有数据时不弹 toast（保持现有列表显示），只在列表为空时才提示。
            if (!(state.products || []).length) {
              toast(res.msg || '加载失败，网络开小差了', 'error');
            }
            return; }
          window.__lastFetchTime = Date.now(); /* R281：成功拉取记录时间戳 */
          var _newP = res.list || [];
          if (silent && __adminDataSig(_newP) === _snapP) return; /* R281：数据没变——纹丝不动（不重画不预载不重存） */
          if (silent) initFilterCatPicker(); /* R281：有变才补建筛选器（分类选项同步） */
          window.__adminSkelP = false;
          // v315（用户 10-05 17:33）：进度条全删
          state.products = _newP;
          // v317：记录后端分页元数据（恢复后端分页，_backendPaged 始终 true）
          if (res.total_pages !== undefined) {
            state.totalPages = res.total_pages || 1;
            state.total = res.total || 0;
            state._backendPaged = true;
          } else {
            state._backendPaged = true;
            if (res.total !== undefined) state.total = res.total || 0; /* v327：无 total_pages 但有 total 时也同步，防止残留上一组合的旧总数 */
          }
          // v314：写入内存缓存
          __adminProductCache[_reqCacheKey] = {
            products: _newP,
            totalPages: state.totalPages,
            total: state.total,
            _backendPaged: state._backendPaged,
            timestamp: Date.now()
          };
          renderProducts();
          if (!silent) backfillCoverThumbs(_newP); /* R304 P18：非静默加载（首次/翻页/筛选）时静默补生成存量旧图小图 */
          /* v327：复用资源页逻辑——首屏（无搜索/无筛选的第一页）拉成功后，后台预取各分类/状态组合第一页，筛选秒出 */
          if (!silent && adminPage === 1 && !kw && (!filterCat || filterCat === '0') && !filterStatus) __preloadAdminFilterCombos();
          prefetchBindings(); // R114：随产品列表一起静默预载全部类型绑定数据，点「绑定 N」即开即显
          // R276：一次性拉齐——后台并行预载所有资源的类型（variants），点开编辑弹窗秒开
          var _vp = (state.products || []).map(function (p) {
            if (!p.id || Array.isArray(p.variants)) return Promise.resolve();
            return api('admin/variants?product_id=' + p.id).then(function (vr) {
              if (vr && vr.ok) p.variants = vr.list || [];
            }).catch(function () {});
          });
          Promise.all(_vp).then(function () { __saveAdminState(); });
          __saveAdminState();
        });
      };
      var _p = _doFetch();
      if (!silent) __adminProductCacheLoading[_cacheKey] = _p;
      _p.then(function () { delete __adminProductCacheLoading[_cacheKey]; })
        .catch(function () { delete __adminProductCacheLoading[_cacheKey]; __clearSwitching(); /* v330 条20：网络异常也要收掉换场态 */ });
      return _p;
    }

    // 筛选器事件
    document.addEventListener('change', function (e) {
      if (e.target.id === 'filterCat' || e.target.id === 'filterStatus') {
        adminPage = 1;
        /* R183 条21：筛选条件持久化（下次登录自动恢复） */
        try { localStorage.setItem('wnzyq_admin_filter', JSON.stringify({ c: document.getElementById('filterCat').value, s: document.getElementById('filterStatus').value })); } catch (e0) { if (window.__silent) window.__silent(e0); }
        // v317：翻页/搜索/筛选点到才拉，走 loadProducts（带内存缓存秒出）
        loadProducts();
      }
    });
    // R183 条13：后台搜索 300ms 防抖（与前台同步）；原先与下方直接监听双份渲染，一并收口成单一路由
    document.addEventListener('input', function (e) {
      if (e.target.id === 'adminSearch') {
        clearTimeout(window.__adminSearchTimer);
        window.__adminSearchTimer = setTimeout(function () {
          try { window.__skelPhaseAdmin && window.__skelPhaseAdmin(); } catch (e) { if (window.__silent) window.__silent(e); } /* v336 条150：新搜索词先铺骨架再拉数据 */
          adminPage = 1;
          // v317：翻页/搜索/筛选点到才拉，走 loadProducts（带内存缓存秒出）
          loadProducts();
          var __sv = document.getElementById('adminSearch').value; if (__sv.trim()) window.pushSearchHist('wnzyq_admin_search_hist', __sv);
        }, 300); /* R186 建议1：搜索稳定 300ms 后记录 */
        var __ac = document.getElementById('adminSearchClear');
        if (__ac) __ac.classList.toggle('show', e.target.value.length > 0);
      }
    });

    // v314（用户 10-05 15:59）：根因→管理页资源列表翻页/搜索/筛选每次走网络，旧内容淡出成空白等待；修法→内存缓存秒开+后台静默刷新（stale-while-revalidate）。看过的组合(page+kw+filterCat+filterStatus)存内存，再切回来立即渲染零等待。首次切到新组合不清空旧内容+轻量进度条，数据回来再替换。真失败toast提示+收骨架不留灰态。下拉刷新清缓存拿最新。
    // v315（用户 10-05 17:33）：进度条全删——老板不要进度条。
    var __adminProductCache = {};        // key='page:kw:filterCat:filterStatus'，value={products,total,totalPages,_backendPaged,timestamp}
    var __adminProductCacheLoading = {}; // key同上，value=Promise（防重复请求）
    function __adminProductCacheKey(page, kw, filterCat, filterStatus) {
      return (page || 1) + ':' + (kw || '') + ':' + (filterCat || '0') + ':' + (filterStatus || '');
    }

    /* v327（用户要求）：筛选后秒出——复用资源页切换分类的加载逻辑（v319 预加载同款）：
       首屏加载成功后，后台静默把「每个分类第一页」和「全部×在线/隐藏」两种状态组合
       预取进内存缓存，老板点筛选时命中缓存直接渲染，不再等网络。只做加载逻辑，显示逻辑不动。 */
    function __adminPreloadCombo(page, kw, cat, status) {
      var key = __adminProductCacheKey(page, kw, cat, status);
      if (__adminProductCache[key] || __adminProductCacheLoading[key]) return; // 已缓存/在途，跳过
      var qs = '?page=' + page + '&page_size=' + ADMIN_PAGE_SIZE;
      if (kw) qs += '&kw=' + encodeURIComponent(kw);
      if (cat && cat !== '0') qs += '&cid=' + encodeURIComponent(cat);
      if (status) qs += '&status=' + encodeURIComponent(status);
      var p = api('admin/products' + qs).then(function (res) {
        if (!res || !res.ok) return;
        __adminProductCache[key] = {
          products: res.list || [],
          totalPages: (res.total_pages !== undefined ? res.total_pages : 1) || 1,
          total: res.total || 0,
          _backendPaged: true,
          timestamp: Date.now()
        };
      }).catch(function () {}); /* 预载失败静默——真点筛选时照常现场拉取 */
      __adminProductCacheLoading[key] = p;
      var _clr = function () { delete __adminProductCacheLoading[key]; };
      p.then(_clr, _clr);
    }
    function __preloadAdminFilterCombos() {
      try {
        var cats = (state.categories || []).map(function (c) { return String(c.id); });
        var totalItems = (state.products || []).length + cats.length;
        if (totalItems > 500) return; /* 安全线，与资源页 __preloadCategoryFirstPages 同口径 */
        cats.forEach(function (cid2) { __adminPreloadCombo(1, '', cid2, ''); });
        ['online', 'hidden'].forEach(function (st) { __adminPreloadCombo(1, '', '0', st); });
      } catch (e) { if (window.__silent) window.__silent(e); }
    }

    var adminPage = 1;
    var __adminTurning = false; /* R231 条19：翻页淡出期间锁，防重复触发 */
    // v318（用户 10-05 22:06）：根因→翻页请求飞行期间 __adminTurning=true，点分页被丢弃；修法→记下 pending 意图，锁释放后补发。
    var __pendingAdminOpts = null;
    // v318（用户 10-05 22:06）：根因→搜索词快速变化时旧响应后回来覆盖新结果；修法→响应回来后比较请求时的条件与当前条件，不一致则丢弃。
    var __lastAdminSeq = 0;
    var ADMIN_PAGE_SIZE = (window.WN_CONST && window.WN_CONST.ADMIN_PAGE_SIZE) || 20; // v346 条8：改读全站常量（原硬编码 20）

    // v318（用户 10-05 22:06）：翻页锁期间被丢弃的意图，在锁释放后立刻补发。
    function __flushPendingAdmin() {
      if (!__pendingAdminOpts) return;
      var _opts = __pendingAdminOpts;
      __pendingAdminOpts = null;
      if (_opts.page) __adminTurnPage(_opts.page);
      else if (_opts.reload) loadProducts();
    }
    /* R239（用户 09-22 派单）：管理页资源列表接入全站「到底续滑翻页」——整页滚动贴底后继续滑≈60px 翻下一页。
       翻页动作收口 __adminTurnPage 单点：分页条按键（onPage）与到底续滑触发走完全同一条路径
       （R231 条19+23 原行为：旧内容 0.1s 淡出 → 重建单页 → 平滑滚回列表顶）；
       只在资源管理 tab 处于激活且没有弹窗打开时判定（active 守卫）。
       v318（用户 10-05 22:06）：被 __adminTurning 锁住时不直接丢弃，记下 pending，锁释放后补发。 */
    var __adminTotalPages = 1; /* renderProducts 每次渲染回写，供续滑翻页 getTotalPages 用 */
    function __adminTurnPage(p) {
      if (p === adminPage || __adminTurning) {
        if (__adminTurning && p !== adminPage) __pendingAdminOpts = { page: p };
        return;
      }
      __adminTurning = true; /* R231 条19：翻页期间防重复 */
      adminPage = p;
      // v314（用户 10-05 15:59）：翻页立即出结果——有缓存秒开（loadProducts 内自动走 __adminProductCache），
      // 无缓存保留旧内容+轻量进度条，数据回来再替换。去掉旧内容 0.1s 淡出动画。
      // R303：后端分页时翻页需重新拉取对应页数据；前端分页时本地重渲染
      if (state._backendPaged) {
        loadProducts().then(function () {
          __adminTurning = false;
          try {
            var _pl2 = document.getElementById('productList');
            if (_pl2) _pl2.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (e) { if (window.__silent) window.__silent(e); }
          __flushPendingAdmin();
        }).catch(function () {
          __adminTurning = false;
          __flushPendingAdmin();
        });
      } else {
        renderProducts();
        __adminTurning = false;
        try {
          var _pl2 = document.getElementById('productList');
          if (_pl2) _pl2.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) { if (window.__silent) window.__silent(e); }
        __flushPendingAdmin();
      }
    }
    // R146（用户 00:34）：admin 端价格格式化（与前台 shop.js formatPrice 同口径）
    // 0/空返回 ''（免费不显示），整数 ¥99，小数 ¥99.00


    /* ---------- R230（老板 09-21 21:10 拍板）：管理页骨架屏——资源页 R193 骨架全特征复用 ----------
       特征逐条对齐：①数量=每页条数（资源/统计表一页 20 条，分类无分页按常显 8 行铺、真行不足收尾）
       ②骨架行复用真实行类名（.product-row/.cat-row 及子件类）——槽位/尺寸/间距与真行严格一致，
       card-view 网格与手机两行网格布局规则自动沿用；③数据到达同位置替换成真行（不先清后铺、
       无整屏闪白），复用 .stagger-in 错峰淡入（20ms/项 180ms 封顶）；④真实条数少于骨架数时
       收尾移除多余骨架；⑤空数据/接口异常收骨架走空态，骨架期空态不抢跑；⑥微光灰条样式在
       ui-common.css 全站一份（商城 .card-skeleton 同源）；⑦aria-hidden + pointer-events:none
       + 暗色/减少动效适配随公共样式。仅网络等待期铺（翻页/筛选是本地重渲染，走错峰淡入——
       与资源页翻页真实行为同口径） */
    function __clearAdminSkel(box) { if (!box) return; var _s = box.querySelectorAll('.admin-skel'); for (var i = 0; i < _s.length; i++) { if (_s[i].parentNode) _s[i].parentNode.removeChild(_s[i]); } }
    function renderProductSkeleton(n) {
      var box = document.getElementById('productList'); if (!box) return;
      // R256：骨架已内嵌在 admin.html，有则不复建
      if (box.querySelectorAll('.admin-skel').length > 0) return;
      var oldPager = document.getElementById('adminPager'); if (oldPager && oldPager.parentNode) oldPager.parentNode.removeChild(oldPager);
      var empty = document.getElementById('productEmpty'); if (empty) empty.classList.remove('show');
      box.style.minHeight = ''; box.innerHTML = '';
      var frag = document.createDocumentFragment();
      var cnt = n || ADMIN_PAGE_SIZE;
      for (var i = 0; i < cnt; i++) {
        var row = document.createElement('div');
        row.className = 'product-row skel admin-skel';
        row.setAttribute('aria-hidden', 'true');
        /* v330 条29：骨架自动生成——直接拿真实行构建函数（__buildProductRow）造一条空数据行，
           再把它内部所有可占位元素标成 .sk-piece；以后改真行结构，骨架自动同步，不会再"改一处漏一处"。 */
        var built = null;
        try {
          built = __buildProductRow({ id: '__skel__', title: '', desc: '', img: '', price: 0, is_online: 1, is_hidden: 0, cid: 0, sort: 0 }, 0, {}, '');
        } catch (e0) { built = null; }
        if (built) {
          built.className = 'product-row skel admin-skel';
          built.setAttribute('aria-hidden', 'true');
          built.removeAttribute('data-id'); built.removeAttribute('data-idx');
          try {
            var pieces = built.querySelectorAll('.thumb, .p-title, .p-sub, .row-check, .row-btn, .drag-handle, .badge, .cat-picker-display');
            for (var k = 0; k < pieces.length; k++) {
              pieces[k].classList.add('sk-piece');
              var txt = pieces[k].querySelectorAll('span, i, b');
              for (var m = 0; m < txt.length; m++) txt[m].textContent = '';
            }
          } catch (e1) { if (window.__silent) window.__silent(e1); }
          frag.appendChild(built);
        } else {
          row.innerHTML = '<span class="drag-handle sk-piece"></span><span class="row-check sk-piece"></span><div class="thumb sk-piece"></div><div class="info"><div class="p-title sk-piece"></div><div class="p-sub sk-piece"></div></div><div class="p-ops"><span class="row-btn sk-piece sk-code"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span></div>';
          frag.appendChild(row);
        }
      }
      box.appendChild(frag);
    }
    function renderCatSkeleton(n) {
      var box = document.getElementById('catList'); if (!box) return;
      // R256：骨架已内嵌在 admin.html，有则不复建
      if (box.querySelectorAll('.admin-skel').length > 0) return;
      box.style.minHeight = ''; box.innerHTML = '';
      var frag = document.createDocumentFragment();
      for (var i = 0; i < (n || 20); i++) {  // v302（用户 10-05 00:09）：骨架统一20条
        var row = document.createElement('div');
        row.className = 'cat-row skel admin-skel';
        row.setAttribute('aria-hidden', 'true');
        row.innerHTML = '<span class="drag-handle sk-piece"></span><span class="row-check sk-piece"></span><span class="c-name sk-piece"></span><div class="c-meta"><span class="c-sort sk-piece"></span><span class="c-count sk-piece"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span></div>';
        frag.appendChild(row);
      }
      box.appendChild(frag);
    }
    function renderStatSkeleton() {
      var defs = [['statRows', 6], ['statCatRows', 3], ['statRecentRows', 3]];
      defs.forEach(function (d) {
        var tb = document.getElementById(d[0]); if (!tb) return;
        // R256：骨架已内嵌在 admin.html，有则不复建
        if (tb.querySelectorAll('.admin-skel').length > 0) return;
        tb.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = 0; i < STAT_PAGE_SIZE; i++) {
          var tr = document.createElement('tr');
          tr.className = 'skel admin-skel';
          tr.setAttribute('aria-hidden', 'true');
          var cells = '';
          for (var c = 0; c < d[1]; c++) cells += '<td><span class="sk-line' + (c === 0 ? ' w70' : ' w95') + '"></span></td>';
          tr.innerHTML = cells;
          frag.appendChild(tr);
        }
        tb.appendChild(frag);
      });
    }

    // v294（用户 10-04 02:14）：152 视图切换滚动位置记忆
var __lastScrollY = 0;
function saveScroll() { __lastScrollY = window.scrollY || window.pageYOffset || 0; }
function restoreScroll() { window.scrollTo(0, __lastScrollY || 0); }
function renderProducts() {
      if (window.__skipRenderOnce) { window.__skipRenderOnce = false; return; }
      refreshCatCnts();
      var box = document.getElementById('productList'); var _minH = box.offsetHeight; if (_minH > 0) box.style.minHeight = _minH + 'px';
      var empty = document.getElementById('productEmpty');
      /* R230：骨架检测先行（资源页 R193 同款口径）——列表里还铺着骨架行时同位置替换成真行；
         非骨架期照常清空重铺 */
      var __skels = box.querySelectorAll('.admin-skel'); var __reuse = __skels.length > 0;

      // R303：搜索过滤（后端分页时后端已过滤，前端跳过）
      var kw = (document.getElementById('adminSearch').value || '').trim().toLowerCase();
      var filterCat = document.getElementById('filterCat').value;
      var filterStatus = document.getElementById('filterStatus').value;
      var list;
      if (state._backendPaged) {
        list = state.products;
      } else {
        list = state.products.filter(function (p) {
          if (kw && String(p.title || '').toLowerCase().indexOf(kw) === -1
              && String(p.desc || '').toLowerCase().indexOf(kw) === -1) return false;
          if (filterCat && filterCat !== '0') {
            var catVal = Number(filterCat);
            var matched = String(p.cid) === filterCat;
            if (!matched) {
              var isTop = state.categories.some(function (c) { return Number(c.id) === catVal && (!c.parent_id || Number(c.parent_id) === 0); });
              if (isTop) {
                var subIds = state.categories.filter(function (c) { return Number(c.parent_id) === catVal; }).map(function (c) { return Number(c.id); });
                matched = subIds.indexOf(Number(p.cid)) !== -1;
              }
            }
            if (!matched) return false;
          }
          if (filterStatus === 'online' && (!p.is_online || p.is_hidden)) return false;
          if (filterStatus === 'hidden' && (p.is_online && !p.is_hidden)) return false;
          return true;
        });
      }
      /* R230：骨架期空态不抢跑（对齐资源页 renderProducts 口径）——数据在路上时保持灰行 */
      if (window.__adminSkelP && !list.length) { empty.classList.remove('show'); return; }
      if (!__reuse) box.innerHTML = '';
      /* R193（用户 22:32 拍板）：后台空态统一前台三件套（48px 固定SVG图标+标题+清除按钮；R285 条18 📦 已换 SVG），样式在 ui-common.css 全站同一份 */
      empty.classList.toggle('show', !list.length);

      // 移除旧分页
      var oldPager = document.getElementById('adminPager');
      if (oldPager) oldPager.parentNode.removeChild(oldPager);

      if (list.length === 0) {
        /* R230：数据已到但为空——先收掉骨架再走空态（对齐资源页） */
        if (__reuse) box.innerHTML = '';
        // v326（用户 10-06 15:18）：空态文案四档——搜索/分类/状态/全空，对应「该搜索/分类/状态暂无资源」/「暂无资源」。
        document.getElementById('productEmptyTitle').textContent = __getAdminEmptyText();
        /* R183 条17：搜索空态提供「清除搜索」按钮（与前台同步；非搜索空态不显示） */
        var __oe = empty.querySelector('.empty-clear-btn');
        if (__oe) __oe.parentNode.removeChild(__oe);
        var __kw = (document.getElementById('adminSearch').value || '').trim();
        if (__kw) {
          var __cb = document.createElement('button');
          __cb.type = 'button'; __cb.className = 'empty-clear-btn'; __cb.textContent = '清除搜索';
          __cb.addEventListener('click', function () {
            document.getElementById('adminSearch').value = '';
            var __a2 = document.getElementById('adminSearchClear');
            if (__a2) __a2.classList.remove('show');
            adminPage = 1; loadProducts();
          });
          empty.appendChild(__cb);
        }
        /* v346 条49：后台空态补「去添加资源」出口（此前后台空态只有灰字、无下一步按键，与前台不一致） */
        var __fcv = document.getElementById('filterCat').value;
        var __fsv = document.getElementById('filterStatus').value;
        if (!__kw && (!__fcv || __fcv === '0') && !__fsv) {
          var __add = document.createElement('button');
          __add.type = 'button'; __add.className = 'empty-clear-btn'; __add.textContent = '去添加资源';
          __add.addEventListener('click', function () { var __b = document.getElementById('addProductBtn'); if (__b) __b.click(); });
          empty.appendChild(__add);
        }
        updateBatchBar(); return;
      }

      // R303：分页（后端分页时元数据来自响应，前端跳过 slice）
      var totalPages, pageList, start;
      if (state._backendPaged) {
        totalPages = state.totalPages || 1;
        pageList = list;
        start = 0;
      } else {
        totalPages = Math.ceil(list.length / ADMIN_PAGE_SIZE);
        if (adminPage > totalPages) adminPage = totalPages;
        start = (adminPage - 1) * ADMIN_PAGE_SIZE;
        pageList = list.slice(start, start + ADMIN_PAGE_SIZE);
      }
      __adminTotalPages = totalPages; /* R239：回写总页数，供到底续滑翻页判定用 */

    /* R303（P13）：管理页资源行构建——提取为独立函数供 diff 复用 */
    function __buildProductRow(p, idx, catNameMap, searchKw) {
      var row = document.createElement('div');
      row.className = 'product-row';
      row.classList.add('stagger-in'); row.style.animationDelay = Math.min(idx * 20, 180) + 'ms'; /* R192 二②；R211 二批（用户 09-20）：错峰 30ms 递升改 20ms/项、180ms 封顶（与前台卡片同款） */
      row.draggable = false;
      row.dataset.id = p.id;
      row.dataset.idx = idx;
      var handle = document.createElement('span'); handle.className = 'drag-handle'; handle.tabIndex = 0; handle.setAttribute('role', 'button'); handle.setAttribute('aria-label', '拖动排序（也可用方向键）'); /* v336 条196 修复：原误写 h.* 致后台列表渲染崩溃 */
      handle.addEventListener('keydown', function (ev) { if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); var row = handle.closest('[data-id]'); var sib = ev.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling; if (row && sib && row.parentNode) { row.parentNode.insertBefore(ev.key === 'ArrowUp' ? row : sib, ev.key === 'ArrowUp' ? sib : row); try { toast('已' + (ev.key === 'ArrowUp' ? '上移' : '下移') + '，记得保存顺序', 'success'); } catch (e) { if (window.__silent) window.__silent(e); } } } });; handle.draggable = true; handle.title = '拖动排序'; handle.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>'; /* R285 条19：拖拽抓手换六点网格图标 */ row.appendChild(handle);

      // 拖拽事件
      row.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', p.id);
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', function () {
        this.classList.remove('dragging');
        document.querySelectorAll('.product-row').forEach(function (r) { r.classList.remove('drag-over'); });
      });
      row.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
      });
      row.addEventListener('dragleave', function () {
        this.classList.remove('drag-over');
      });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        var draggedId = Number(e.dataTransfer.getData('text/plain'));
        var targetId = p.id;
        if (draggedId === targetId) return;
        reorderProducts(draggedId, targetId);
      });

      // 复选框
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'row-check';
      cb.dataset.id = p.id;
      cb.style.flexShrink = '0';
      cb.style.width = '20px';
      cb.style.height = '20px';
      cb.style.cursor = 'pointer';
      cb.style.accentColor = 'var(--blue1)';
      cb.checked = !!state.prodSelected[p.id]; cb.addEventListener('change', function () { state.prodSelected[p.id] = this.checked; updateBatchBar(); });

      var img = document.createElement('img');
      img.className = 'thumb';
      img.decoding = 'async'; /* R193c ⑩：后台缩略图异步解码 */
      img.alt = '';
      /* R304 P14：去 lazy——当前页图片全部一起加载（老板 09-30 拍板「按我的思路做…只有翻页才加载翻页后的内容数据」，全系统按页加载） */
      var _origImg = p.img || '';
      img.style.opacity = '0';
      img.onload = function () { this.style.opacity = '1'; this.classList.add('img-in'); }; /* R183 条2：缩略图入场动画（同二维码口径） */
      img.onerror = function () {
        /* R304 P18：小图 404（存量旧图还没补到小图）先回退原图，不能空图；原图也失败才走占位符 */
        if (_origImg && this.getAttribute('src') !== _origImg) { this.src = _origImg; return; }
        this.onerror = null; this.src = EXC_PLACEHOLDER; this.style.opacity = '1'; if (this && this.classList) this.classList.add('media-fail');
      };
      img.src = _origImg ? thumbOf(_origImg) : EXC_PLACEHOLDER; /* R304 P18：管理页列表缩略图读小图 */

      var info = document.createElement('div');
      info.className = 'info';
      var t = document.createElement('div');
      t.className = 'p-title';
      var __kw = ((document.getElementById('adminSearch') || {}).value || '').trim();
      if (__kw && p.title) { /* R192 二④：搜索命中高亮（安全转义后包 mark.hl，与前台同款） */
        var __esc = function (x) { return String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
        var __lo = String(p.title).toLowerCase(), __k = __kw.toLowerCase(), __o = '', __i = 0, __h;
        if (__k) { while ((__h = __lo.indexOf(__k, __i)) !== -1) { __o += __esc(p.title.slice(__i, __h)) + '<mark class="hl">' + __esc(p.title.slice(__h, __h + __k.length)) + '</mark>'; __i = __h + __k.length; } }
        t.innerHTML = __o + __esc(p.title.slice(__i));
      } else t.textContent = p.title || '(无标题)';
      var s = document.createElement('div');
      s.className = 'p-sub';
      // R24：简介部分颜色复用资源页弹窗简介的蓝色（var(--blue1)），分类名保持灰色
      // R146（用户 00:34）：分隔点改黑色；简介后追加深色点+橙色金额（无金额整段不渲染）
      var _sc = document.createElement('span');
      _sc.textContent = (catName[p.cid] || '未分类');
      var _sdot = document.createElement('span');
      _sdot.className = 'p-dot';
      _sdot.textContent = ' · ';
      var _sd = document.createElement('span');
      _sd.className = 'p-desc';
      _sd.textContent = p.desc || '';
      s.appendChild(_sc);
      s.appendChild(_sdot);
      s.appendChild(_sd);
      var _pPriceText = formatPrice(p.price);
      if (_pPriceText) {
        var _pdot = document.createElement('span');
        _pdot.className = 'p-dot';
        _pdot.textContent = ' · ';
        var _pp = document.createElement('span');
        _pp.className = 'p-price';
        _pp.textContent = _pPriceText;
        s.appendChild(_pdot);
        s.appendChild(_pp);
      }
      info.appendChild(t);
      info.appendChild(s);

      // R82：显示/隐藏切换改用与编辑/复制/删除同款的胶囊按钮（点击直接切换），不再用下拉框
      var curStatus = (p.is_online && !p.is_hidden) ? 'online' : 'offline';
      var statusBtn = document.createElement('button');
      statusBtn.className = 'row-btn status-btn status-' + (curStatus === 'online' ? 'online' : 'hidden');
      statusBtn.textContent = curStatus === 'online' ? '显示' : '隐藏';
      statusBtn.title = '点击切换为' + (curStatus === 'online' ? '隐藏（资源页不显示）' : '显示');
      /* v330 条18：统一 SVG 图标 + 优先级（pri 越小越先保留文字；空间不够时从数字大的开始收成纯图标） */
      if (window.__decorateBtn) window.__decorateBtn(statusBtn, curStatus === 'online' ? 'show' : 'hide', 2);
      statusBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (window.__catToggleBusy) return; // v296（用户 10-04 02:14）：显示/隐藏切换防连点
        window.__catToggleBusy = true;
        var next = (p.is_online && !p.is_hidden) ? 'offline' : 'online';
        setProductStatus(p.id, next);
        setTimeout(function () { window.__catToggleBusy = false; }, 800); // 800ms 后解锁（与 productStatusBusy 同节奏）
      });


      var ops = document.createElement('div');
      ops.className = 'p-ops btn-fit-group'; /* v330 条18：按钮组——宽度不够时按 data-pri 收起文字 */
      var editBtn = document.createElement('button');
      editBtn.className = 'row-btn';
      editBtn.textContent = '编辑';
      if (window.__decorateBtn) window.__decorateBtn(editBtn, 'edit', 1); /* v330 条18：编辑优先级最高，空间不够也优先留文字 */
      editBtn.addEventListener('click', function () { openEdit(p); });
      var copyBtn = document.createElement('button');
      copyBtn.className = 'row-btn';
      copyBtn.textContent = '复制';
      copyBtn.title = '复制此资源为新资源';
      if (window.__decorateBtn) window.__decorateBtn(copyBtn, 'copy', 3); /* v330 条18 */
      copyBtn.addEventListener('click', function () { copyProduct(p); });
      var delBtn = document.createElement('button');
      delBtn.className = 'row-btn danger';
      delBtn.textContent = '删除';
      if (window.__decorateBtn) window.__decorateBtn(delBtn, 'del', 6); /* v330 条18：删除优先级最低，先收成纯图标 */
      delBtn.addEventListener('click', function () { delProduct(p.id); });
      // R126（用户定稿 15:21）：资源码改为下拉选项查看框（复用全站 select-picker 下拉组件，
      // 与显示/隐藏下拉同款结构）——点开展示该资源各类型的资源码（无码显示"无资源码"），点码即复制。
      // R139（用户定稿）：下拉内码/无码项按键化，与编辑弹窗类型列表 codeBtn/noCodeBtn 完全同款（row-btn）
      var codePicker = document.createElement('div');
      // R131（用户 16:14 定稿）：code-picker 钩子类用于容器布局对齐 .p-ops .row-btn（CSS 处理）
      codePicker.className = 'select-picker code-picker';
      // R255（老板 17:53「资源码选择框看不见」根因修复）：code-picker 与通用 makeSelectPicker 不同，
      // 此前从未挂 data-picker-id——R247 起 select-picker 面板打开时先被移到 document.body（脱离容器裁剪），
      // 再由 positionCatPanel 定位；但 positionCatPanel 内 picker.querySelector('.cat-picker-panel') 找不到
      // 已移走的面板，只能靠 data-picker-id fallback 找——code-picker 没挂 id 就两条路都断，面板
      // position:fixed 无 top/left 落在 body 末尾 hypothetical 位置（实测 390 端 top=982 整体在屏幕外），
      // 表现为「点了资源码下拉看不见」。挂上 id 后与 makeSelectPicker 同机制，定位/关闭/重复打开全链路接通。
      var __cpid = 'cp-' + Math.random().toString(36).slice(2, 9);
      codePicker.dataset.pickerId = __cpid;
      var cpDisp = document.createElement('div');
      // R131：display 挂 row-btn 类——视觉/按压反馈/各断点布局全部继承旁边按键，仅保留下拉开合
      cpDisp.className = 'cat-picker-display row-btn';
      var cpTxt = document.createElement('span');
      cpTxt.className = 'cpd-text';
      cpTxt.textContent = '资源码';
      var cpArrow = document.createElement('span');
      cpArrow.className = 'cpd-arrow';
      cpArrow.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>';
      cpDisp.appendChild(cpTxt); cpDisp.appendChild(cpArrow);
      var cpPanel = document.createElement('div');
      cpPanel.className = 'cat-picker-panel';
      cpPanel.dataset.pickerId = __cpid; /* R255：挂同一 id——positionCatPanel/文档点击关闭链按 data-picker-id 找到已移入 body 的本面板 */
      /* v341 条4/5：资源码控件统一成「图标+文字」，空间不够时自动只留钥匙图标（全站同一套 __btnFit 机制） */
      try { if (window.__decorateBtn) window.__decorateBtn(cpDisp, 'key', 4); } catch (e) { if (window.__silent) window.__silent(e); }
      codePicker.appendChild(cpDisp); codePicker.appendChild(cpPanel);
      function renderCodePanel(variants) {
        cpPanel.innerHTML = '';
        if (!variants || !variants.length) {
          cpPanel.innerHTML = window.__adminEmpty('暂无类型', '先到「类型管理」新增类型'); /* v349 条9：统一空态 */
          return;
        }
        variants.forEach(function (v) {
          var item = document.createElement('div');
          item.className = 'cp-item';
          var nm = document.createElement('span');
          nm.className = 'cp-name'; /* R179：挂类进 uiTip 白名单（资源码面板类型名 R177 起截断省略，此前不在名单点了没反应——「有些省略号点击不显示」漏网主角） */
          nm.textContent = v.name || '(未命名)';
          // R146：类型名不折行（面板窄于内容时截断省略，绝不竖排换行）
          // R177（用户 19:18）：类型名可显示宽度统一上限——原来 flex:1 1 auto 弹性吸收，
          // 长名称一串显示几十字、短名称只显示一点；统一 max-width:150px 截断，全面板口径一致
          nm.style.cssText = 'font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;min-width:0;max-width:150px;';
          nm.title = v.name || '(未命名)'; // 悬停原生提示看全名（超长被截断时）
          item.appendChild(nm);
          // R146（用户 00:34）：类型名与码键之间加各自金额（橙色，与资源页价格同色）
          var _vPriceText = formatPrice(v.price);
          if (_vPriceText) {
            var _vp = document.createElement('span');
            _vp.className = 'cp-price';
            _vp.textContent = _vPriceText;
            item.appendChild(_vp);
          } else { /* R154：无金额行保留金额槽位（空占位），¥/码键跨行对齐 */
            var _vpp = document.createElement('span');
            _vpp.className = 'price-slot-ph';
            item.appendChild(_vpp);
          }
          if (v.resourceCode && v.resourceCode.trim()) {
            // R139（用户定稿）：码按键与编辑弹窗类型列表 codeBtn 同款（row-btn+monospace+600+letter-spacing），
            // 替换 R98 浅蓝胶囊——字体样式统一用"编辑弹窗类型列表那套"；点按键复制并收起面板
            var cd = document.createElement('button');
            cd.type = 'button';
            cd.className = 'row-btn code-slot'; /* R154：码键固定槽位，跨行对齐 */
            // R144（用户 23:57）：有码=蓝底白字（参考"显示"按键配色），宽高不变
            cd.style.cssText = 'font-family:monospace;letter-spacing:1px;font-weight:600;background:var(--blue1);color:#fff;border-color:var(--blue1);';
            cd.textContent = v.resourceCode;
            /* v341 条4/5：码键在赋值文字之后再挂图标（先挂会被 textContent 覆盖），并参与「空间不够收成纯图标」 */
            try { if (window.__decorateBtn) window.__decorateBtn(cd, 'key', 5); } catch (e2) { if (window.__silent) window.__silent(e2); }
            cd.title = v.resourceCode + '（点击复制并发新码）'; /* R179：固定宽截断后悬停 title 看全码 */
            item.appendChild(cd);
            (function (cvObj, cdEl) {
              /* R221（老板 15:44 拍板·复制即换码）：点码键=发码——当前码复制给客户（60 天兑换窗口
                 从本次点按起算），面板立即出新码、下方发码记录即时更新，面板不再收起 */
              cdEl.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (cdEl.disabled || window.__issueInFlight) return; /* R231 条26：防连点（发码期间锁键） */
                cdEl.disabled = true; if (window.__btnBusy) window.__btnBusy(cdEl, '发码中'); else cdEl.textContent = '发码中';
                __issueCode(cvObj, function () { renderCodePanel(variants); });
              });
            })(v, cd);
          } else {
            // R139：无码按键与类型列表 noCodeBtn 同款（row-btn 灰字、无动作），同步替换灰胶囊
            var nc = document.createElement('button');
            nc.type = 'button';
            nc.className = 'row-btn code-slot'; /* R154：无码键同槽位宽，跨行对齐 */
            // R144：无码键字体颜色参考编辑按键（var(--text-light)）
            nc.style.cssText = 'color:var(--text-light);cursor:default;';
            nc.textContent = '无资源码';
            item.appendChild(nc);
            item.style.cursor = 'default';
          }
          cpPanel.appendChild(item);
        });
      }
      renderCodePanel(p.variants);
      // R227（老板 19:40「其他页面也要同步更新」）：面板重绘函数挂到 DOM 元素上——
      // 弹窗里发新码后 __issueCode 通过 querySelectorAll('.code-picker') 找到各面板当场重绘，码键立即变新码
      codePicker.__renderCodePanel = renderCodePanel;
      codePicker.__product = p;
      // 无 variants 缓存时首次打开拉取（复用 loadVariants 的回写口径）
      // R221：每次打开都用最新缓存即时重绘——发码后新码/发码记录即时可见（不再只画一次）
      cpDisp.addEventListener('click', function () {
        if (!p.variants) {
          api('admin/variants?product_id=' + p.id).then(function (res) {
            if (res && res.ok) {
              p.variants = (res.list || []).slice();
              var _pp = (state.products || []).find(function (x) { return x.id === p.id; });
              if (_pp) _pp.variants = (res.list || []).slice();
              renderCodePanel(p.variants);
            }
          });
        } else {
          renderCodePanel(p.variants);
        }
      });
      // R123（用户定稿 14:59）：复制换到显示前面——显示、编辑、删除三个连在一起（与分类管理按钮排布一致）
      ops.appendChild(codePicker);
      ops.appendChild(copyBtn);
      ops.appendChild(statusBtn);
      ops.appendChild(editBtn);
      ops.appendChild(delBtn);

      row.appendChild(cb);
      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(ops);
      /* R304（顺带修复 v289 存量 bug）：提取 __buildProductRow（R303）时把 R230 的骨架同位替换
         遗留在了函数尾部，而外层 forEach 也做一次同位替换——同一骨架被替换两次，第二次
         skel.parentNode 已为 null 抛 TypeError（被空 .catch 吞掉），管理页首屏只渲染出第 1 行
         +19 条骨架、无分页条（v289 原包探针实测复现）。本函数改为纯构建，插入统一由调用方
         forEach 的三分支（diff 替换/骨架替换/追加）处理。 */
      return row;
    }

      var catName = {};
      state.categories.forEach(function (c) { catName[c.id] = c.name; });

      // R303（P13）：diff 更新——后端分页、非骨架期、有现有行时只重建变化行
      var diffMode = state._backendPaged && !__reuse && !window.__adminSkelP;
      var existingMap = {};
      if (diffMode) {
        box.querySelectorAll('.product-row').forEach(function(r) {
          if (r.dataset.id) existingMap[r.dataset.id] = r;
        });
      }

      pageList.forEach(function (p, idx) {
        var existing = diffMode ? existingMap[p.id] : null;
        if (existing && existing.__pData && __adminRowEqual(existing.__pData, p)) {
          existing.dataset.idx = idx;
          delete existingMap[p.id];
          return;
        }
        var row = __buildProductRow(p, idx, catName, kw);
        row.__pData = p; /* R303（P13）：缓存数据供下次 diff 比对 */
        if (diffMode && existing) {
          existing.parentNode.replaceChild(row, existing);
          delete existingMap[p.id];
        } else if (__reuse && __skels[idx]) {
          __skels[idx].parentNode.replaceChild(row, __skels[idx]);
        } else {
          box.appendChild(row);
        }
        box.style.minHeight = '';
      });
      if (diffMode) {
        for (var _eid in existingMap) {
          var _er = existingMap[_eid];
          if (_er && _er.parentNode) _er.parentNode.removeChild(_er);
        }
      }
      /* R230：真实条数少于骨架数时收尾移除多余骨架（资源页同款） */
      if (__reuse) { for (var __sj = pageList.length; __sj < __skels.length; __sj++) { if (__skels[__sj] && __skels[__sj].parentNode) __skels[__sj].parentNode.removeChild(__skels[__sj]); } }

      // 渲染完成淡入，避免批量操作/筛选时内容闪动
      setTimeout(function () { var _b = document.getElementById('productList'); if (_b) { _b.classList.remove('prod-fade'); void _b.offsetWidth; _b.classList.add('prod-fade'); } }, 10);
      // 分页控件（R14：改用全站统一 .uni-pager 组件——数据统计同款胶囊样式 + 跳页输入）
      var pager = document.createElement('div');
      pager.id = 'adminPager';
      box.parentNode.insertBefore(pager, box.nextSibling);
      if (window.buildUniPager) {
        window.buildUniPager(pager, {
          page: adminPage,
          totalPages: totalPages,
          total: state._backendPaged ? (state.total || list.length) : list.length, /* v327：后端分页时用接口返回的真实总数（list.length 只是当前页条数，永远 ≤ 页容量，「共 N 件」一直显示不准） */
          unit: '件',
          /* R239：翻页动作收口 __adminTurnPage 单点——分页条按键（onPage）走本路径 */
          onPage: __adminTurnPage
        });
      } else if (totalPages > 1) {
        // 兜底：公共组件缺失时退回原方块样式（不应发生）
        var prev = document.createElement('button');
        prev.textContent = '上一页';
        prev.style.cssText = 'padding:6px 14px;border:1px solid var(--border,#ddd);background:var(--card-bg,#fff);color:var(--text,#222);border-radius:8px; /* v293（用户 10-04 02:14）：054圆角统一→6px不在5档阶梯，改8px跟全站最小档统一 */ cursor:pointer;font-size:13px;';
        window.__setPagerDisabled(prev, adminPage === 1); // v297（用户 10-04 02:14）：C-242 翻页置灰走公共函数
        prev.onclick = function () { if (adminPage > 1) { adminPage--; if (state._backendPaged) loadProducts(); else renderProducts(); } };
        pager.appendChild(prev);
        var info = document.createElement('span');
        info.textContent = adminPage + ' / ' + totalPages + '（共' + (state._backendPaged ? (state.total || list.length) : list.length) + '件）'; /* v327：同上——后端分页用真实总数 */
        info.style.cssText = 'color:var(--text-light,#666);font-size:13px;';
        pager.appendChild(info);
        var next = document.createElement('button');
        next.textContent = '下一页';
        next.style.cssText = 'padding:6px 14px;border:1px solid var(--border,#ddd);background:var(--card-bg,#fff);color:var(--text,#222);border-radius:8px; /* v293（用户 10-04 02:14）：054圆角统一→6px不在5档阶梯，改8px跟全站最小档统一 */ cursor:pointer;font-size:13px;';
        window.__setPagerDisabled(next, adminPage === totalPages); // v297（用户 10-04 02:14）：C-242 翻页置灰走公共函数
        next.onclick = function () { if (adminPage < totalPages) { adminPage++; if (state._backendPaged) loadProducts(); else renderProducts(); } };
        pager.appendChild(next);
      }

      updateBatchBar();
      if (window.__btnFit) window.__btnFit(); /* v330 条18：渲染后按可用宽度决定按钮显示文字还是纯图标 */
    }

    // ---------- 复制资源 ----------
    function copyProduct(p) {
      showConfirm('复制资源', '确定复制资源「' + (p.title || '未命名') + '」？将创建一个内容完全相同的新资源（仅状态为隐藏，其余字段含排序全部照复制）。', function (closeConfirm) {
        var newProduct = {
          cid: p.cid,
          // R155（用户 19:36）：复制=全量复制——title 原样（去掉「（副本）」后缀）、sort 保持原值（不再排到末尾）、
          // is_hidden 照抄；与原资源唯一差异=is_online 隐藏。
          title: p.title || '未命名',
          desc: p.desc || '',
          detail: p.detail || '',
          img: p.img || '',
          detailImages: p.detailImages || [],
          detailVideos: p.detailVideos || [],
          contactUrl: p.contactUrl || '',
          price: p.price || 0,
          // R137（用户 18:14）：复制补齐定时显示/隐藏时间——此前漏传，副本定时信息丢失
          schedule_on: p.schedule_on || null,
          schedule_off: p.schedule_off || null,
          variants: p.variants ? JSON.parse(JSON.stringify(p.variants)) : [],
        is_online: false,
        is_hidden: p.is_hidden ? 1 : 0,
        sort: p.sort || 0
      };
      api('admin/products', { method: 'POST', body: JSON.stringify(newProduct) }).then(function (res) {
        closeConfirm();
        if (res && res.ok) {
          var _vs = newProduct.variants || [], _chain = Promise.resolve(), _newId = res.id, _fail = 0;
          _vs.forEach(function (v) {
            _chain = _chain.then(function () {
              // R137（用户 18:14）：复制类型补齐 bindLimit（绑定上限）——此前漏传，复制后一律归 1
              return api('admin/variants', { method: 'POST', body: JSON.stringify({
                productId: _newId, name: v.name, title: v.title || '', desc: v.desc || '', img: v.img || '', video: v.video || '',
                contactUrl: v.contactUrl || '', price: v.price || 0, sort: v.sort || 0,
                resourceCode: v.resourceCode || '', resourceContent: v.resourceContent || '', isHidden: v.isHidden || 0,
                bindLimit: Math.max(1, parseInt(v.bindLimit, 10) || 1)
              }) }).then(function (r2) { if (!r2 || !r2.ok) _fail++; return r2; }).catch(function () { _fail++; });
            });
          });
          _chain.then(function () {
            clearCache();
            // R178：本地即时插入副本（隐藏状态），后台静默同步；不再 loadProducts() 全量重拉
            state.products.push({ id: _newId, cid: newProduct.cid, title: newProduct.title, desc: newProduct.desc || '',
              detail: newProduct.detail || '', img: newProduct.img || '',
              detailImages: (newProduct.detailImages || []).slice(), detailVideos: (newProduct.detailVideos || []).slice(),
              contactUrl: newProduct.contactUrl || '', price: newProduct.price || 0,
              is_online: 0, is_hidden: 1, schedule_on: newProduct.schedule_on || '', schedule_off: newProduct.schedule_off || '',
              sort: newProduct.sort || 0, variants: (_vs || []).map(function (v) { return Object.assign({}, v); }) });
            renderProducts(); refreshCatCnts(); silentSyncProducts();
            if (_fail) toast('资源已复制，但有 ' + _fail + ' 个类型复制失败，请检查新资源的类型列表', 'error');
          }).catch(function () { clearCache(); silentSyncProducts(); });
          toast('复制成功，新资源已创建（默认隐藏状态）', 'success');
        } else {
          toast(res.msg || '复制失败', 'error');
        }
      __inflight[action] = false; }).catch(function () { closeConfirm(); toast('复制失败，请重试', 'error'); });
      });
    }

    // ---------- 拖拽排序 ----------
    function reorderProducts(draggedId, targetId) {
      var fromIdx = state.products.findIndex(function (p) { return p.id === draggedId; });
      var toIdx = state.products.findIndex(function (p) { return p.id === targetId; });
      if (fromIdx === -1 || toIdx === -1) return;
      var item = state.products.splice(fromIdx, 1)[0];
      state.products.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, item);
      // v294（用户 10-04 02:14）：117 拖拽排序加保存中提示
      toast('正在保存排序…', 'info');
      // 重新分配 sort 值并批量更新
      var updates = state.products.map(function (p, i) {
        p.sort = i + 1;
        return api('admin/products/' + p.id, {
          method: 'PUT',
          body: JSON.stringify({
            cid: p.cid, title: p.title, desc: p.desc, detail: p.detail,
            img: p.img, detailImages: p.detailImages || [],
            detailVideos: p.detailVideos || [], contactUrl: p.contactUrl || '',
            price: p.price || 0, sort: p.sort, is_online: p.is_online,
            is_hidden: p.is_hidden || 0
          })
        }).catch(function () { return { ok: false }; });
      });
      Promise.all(updates).then(function (results) {
        var hasErr = results.some(function (r) { return !r || !r.ok; });
        if (hasErr) { toast('排序保存失败，请重试', 'error'); } // v294：088 拖拽排序失败提示
        else { /* v330 条8：排序已就地生效（列表即刻为新顺序），不再弹成功提示条 */ }
        renderProducts();
      });
    }

    // 更新批量操作栏状态
    function updateBatchBar() {
      var checks = document.querySelectorAll('.row-check:checked');
      var count = checks.length;
      var bar = document.getElementById('batchBar');
      var countEl = document.getElementById('batchCount');
      var selectAll = document.getElementById('selectAll');
      countEl.textContent = count;
      bar.classList.toggle('show', count > 0);
      try { window.__btnFit && window.__btnFit(); } catch (e) { if (window.__silent) window.__silent(e); } /* v336 条145：批量条显示后补跑按钮瘦身（显示前宽度为 0 会跳过） */
      var allChecks = document.querySelectorAll('.row-check');
      selectAll.checked = allChecks.length > 0 && count === allChecks.length;
    }

    // 批量操作
    var __batchBusy = false;
    var __inflight = {}; /* v336 条26：在途请求集合——同一动作未回来前再点直接忽略 */
    /* v349：防重标记必须在「所有出口」复位。
       原实现只在「复制」和「改分类成功」两处复位 —— 取消选中、批量显示、批量隐藏、批量改价格、
       批量删除 只要点过一次，标记就永久为 true，之后再点按钮完全静默无反应（连提示都没有），
       改分类弹窗点叉取消也会锁死。现统一：动作一旦派发（弹出确认框或发出请求）就立即解除防重。 */
    function __bDone(a) { __inflight[a] = false; }
    function batchAction(action) {
      // v294（用户 10-04 02:14）：114 批量操作按钮加忙碌态
      if (__batchBusy) return;
      if (__inflight[action]) return; __inflight[action] = true; /* v336 条26 */
      /* v336 条139：批量操作本地即时生效（点了立刻变），失败按快照回滚——与删除分支同一套口径 */
      var __preSnapshot = JSON.stringify(state.products || []);
      if (action === 'clearSel') { state.prodSelected = {}; document.querySelectorAll('.row-check').forEach(function (cb) { cb.checked = false; }); var _sa = document.getElementById('selectAll'); if (_sa) _sa.checked = false; updateBatchBar(); __bDone(action); return; } var ids = Array.from(document.querySelectorAll('.row-check:checked')).map(function (cb) { return Number(cb.dataset.id); });
      if (ids.length === 0) { __bDone(action); return; }
      var actionNames = { online: '批量显示', offline: '批量隐藏', delete: '批量删除', changeCat: '批量改分类', changePrice: '批量改价格' };
      var msgs = {
        online: '确定显示选中的 ' + ids.length + ' 个资源？',
        offline: '确定隐藏选中的 ' + ids.length + ' 个资源？隐藏后资源页不显示。',
        delete: '确定删除选中的 ' + ids.length + ' 个资源？其类型和统计数据也会一并删除，不可恢复。'
      };

      // 改分类：弹出分类下拉选择
      if (action === 'changeCat') {
        var select = document.getElementById('batchCatSelect');
        buildCatPicker(document.getElementById('batchCatPicker'), select,
          document.getElementById('batchCatDisplay'), document.getElementById('batchCatPanel'),
          Number(select.value) || 0, { allowUncategorized: true, }); /* R215 条5：批量移动同步恢复二级「全部」 */
        __bDone(action); /* v349：弹窗已打开即可解除防重（用户取消也不会锁死按钮） */
        document.getElementById('batchCatMask').classList.add('open'); if (!document.getElementById('batchCatMask')._bm) { document.getElementById('batchCatMask')._bm = 1; document.getElementById('batchCatMask').addEventListener('click', function (e) { if (e.target === this) { this.classList.remove('open'); try { this.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); } } }); } /* R217：恢复点外关闭（R215 误删） */
        // 确认按钮事件（只绑定一次）
        var okBtn = document.getElementById('batchCatOk');
        okBtn.onclick = function () {
          var newCid = Number(select.value);
          if (isNaN(newCid)) { toast('请选择分类', 'error'); return; }
          document.getElementById('batchCatMask').classList.remove('open');
          var _catText = document.querySelector('#batchCatDisplay .cpd-text').textContent;
          showConfirm('批量改分类', '确定将选中的 ' + ids.length + ' 个资源分类改为「' + _catText + '」？', function (closeConfirm) {
            api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: 'changeCat', cid: newCid }) }).then(function (res) {
              closeConfirm();
              if (res && res.ok) {
                toast('批量改分类完成：成功 ' + res.count + ' 项', 'success');
                /* v336 条139：本地已在请求前即时生效，此处只做后台静默对账 */ silentSyncProducts();
              }
              else toast(res.msg || '操作失败', 'error');
            __inflight[action] = false; }).catch(function () { closeConfirm(); __bDone(action); toast('网络开小差了，请稍后再试', 'error'); }); // v294：087 网络提示统一 // v298（用户 10-04 20:30）：修复 v297 注释笔误致语法错误 // v349：失败也要解除防重
          });
        };
        return;
      }

      // 改价格：弹出价格输入
      if (action === 'changePrice') {
        __bDone(action); /* v349：输入框已弹出即可解除防重（用户取消也不会锁死按钮） */
        showInput('批量改价格', '输入新价格（数字，0表示免费）', '请输入新价格', function (priceInput) {
          if (priceInput === null || priceInput === '') return;
          var newPrice = Number(priceInput);
          if (isNaN(newPrice) || newPrice < 0) { toast('请输入有效的价格', 'error'); return; }
          showConfirm('批量改价格', '确定将选中的 ' + ids.length + ' 个资源价格改为 ' + newPrice + '？', function (closeConfirm) {
            api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: 'changePrice', price: newPrice }) }).then(function (res) {
              closeConfirm();
              if (res && res.ok) {
                toast('批量改价格完成：成功 ' + res.count + ' 项', 'success');
                /* v336 条139：本地已在请求前即时生效 */ silentSyncProducts();
              }
              else toast(res.msg || '操作失败', 'error');
            }).catch(function () { closeConfirm(); __bDone(action); toast('网络开小差了，请稍后再试', 'error'); }); // v294：087 网络提示统一 // v298（用户 10-04 20:30）：修复 v297 注释笔误致语法错误 // v349：失败也要解除防重
          });
        });
        return;
      }

      /* v330 条26：批量删除统一走「延迟真删 + 10 秒后悔」——视觉立刻删，10 秒后才真提交，撤销=取消提交（零丢失）。
         ＞10 条额外保留一道确认框（量大不可逆，多一道保险）。 */
      if (action === 'delete') {
        var _runDelete = function () {
          var _snap = (state.products || []).slice();
          applyBatchLocal('delete', ids); renderProducts();
          __undoable(
            '已删除 ' + ids.length + ' 个资源',
            function () {
              api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: action }) }).then(function (res) {
                if (res && res.ok) { clearCache(); silentSyncProducts(); }
                else { toast((res && res.msg) || '批量删除失败', 'error'); state.products = _snap; renderProducts(); }
              }).catch(function () { toast('网络开小差了，请稍后再试', 'error'); state.products = _snap; renderProducts(); });
            },
            function () { state.products = _snap; renderProducts(); } /* 撤销：原样还原快照 */
          );
        };
        __bDone(action); /* v349：延迟删除已排程（撤销条接手），立即解除防重 */
        if (ids.length > 10) showConfirm(actionNames[action], msgs[action], function (closeConfirm) { closeConfirm(); _runDelete(); });
        else _runDelete();
        return;
      }

      showConfirm(actionNames[action], msgs[action], function (closeConfirm) {
        api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: action }) }).then(function (res) {
          closeConfirm();
          if (res && res.ok) {
            toast(actionNames[action] + '完成：成功 ' + res.count + ' 项', 'success');
            clearCache();
            // 性能修复（批量操作点确定后 1-2 秒才反应）：原先成功后调 loadProducts() 全量重拉接口
            // + 整表重渲染，网络往返期间界面毫无反馈；现改为本地即时更新 + 立即渲染（毫秒级），
            // 后台再静默同步一次，保证数据一致的同时操作反馈即时可见
            applyBatchLocal(action, ids); renderProducts(); silentSyncProducts();
          } else {
            toast(res.msg || '操作失败', 'error');
          }
        }).catch(function () { closeConfirm(); __bDone(action); toast('网络开小差了，请稍后再试', 'error'); }); // v294：087 网络提示统一 // v298（用户 10-04 20:30）：修复 v297 注释笔误致语法错误 // v349：失败也要解除防重
      });
    }

    // 批量更新资源字段（逐个调用 PUT API）
    // ---------- 性能：批量操作本地即时更新（乐观 UI）+ 后台静默同步 ----------
    function applyBatchLocal(action, ids, extra) {
      var idSet = {};
      ids.forEach(function (i) { idSet[Number(i)] = true; });
      if (action === 'delete') {
        state.products = state.products.filter(function (p) { return !idSet[p.id]; });
        state.prodSelected = {};
        document.querySelectorAll('.row-check').forEach(function (cb) { if (idSet[Number(cb.dataset.id)]) cb.checked = false; });
      } else {
        state.products.forEach(function (p) {
          if (!idSet[p.id]) return;
          if (action === 'online') { p.is_online = 1; p.is_hidden = 0; }
          else if (action === 'offline') { p.is_online = 0; p.is_hidden = 0; }
          else if (action === 'changeCat' && extra) p.cid = Number(extra.cid);
          else if (action === 'changePrice' && extra) p.price = Number(extra.price);
        });
      }
      try { refreshCatCnts(); } catch (e) { if (window.__silent) window.__silent(e); }
    }
    // 静默同步：不转圈、不打断当前操作，仅在后台拉一次最新数据校正本地状态（防多端编辑漂移）
    var __silentSyncT = 0;
    function silentSyncProducts() {
      clearTimeout(__silentSyncT);
      __silentSyncT = setTimeout(function () {
        /* v333 修：原来直接 api('admin/products') 不带任何参数 —— 后端「不传 page_size = 返回全部」，
           于是增删改之后 600ms，列表会突然从「第 3 页 20 条」变成「全部几百条」，而分页条还是旧页码。
           现改为带上与当前列表完全一致的页码/每页条数/搜索/筛选，并同步总数与页数。 */
        var _kw = (document.getElementById('adminSearch').value || '').trim();
        var _cat = document.getElementById('filterCat').value;
        var _st = document.getElementById('filterStatus').value;
        var _qs = '?page=' + adminPage + '&page_size=' + ADMIN_PAGE_SIZE;
        if (_kw) _qs += '&kw=' + encodeURIComponent(_kw);
        if (_cat && _cat !== '0') _qs += '&cid=' + encodeURIComponent(_cat);
        if (_st) _qs += '&status=' + encodeURIComponent(_st);
        api('admin/products' + _qs).then(function (res) {
          if (!res || !res.ok) return;
          state.products = res.list || [];
          if (res.total_pages !== undefined) {
            state.totalPages = res.total_pages || 1;
            state.total = res.total || 0;
            state._backendPaged = true;
            /* 静默同步拿到的就是当前这一份查询的最新结果 —— 顺手更新内存缓存，
               否则下次翻回来还会先渲染改动前的旧数据。 */
            try {
              var _k = __adminProductCacheKey(adminPage, _kw, _cat, _st);
              __adminProductCache[_k] = {
                products: state.products,
                totalPages: state.totalPages,
                total: state.total,
                _backendPaged: state._backendPaged,
                timestamp: Date.now()
              };
            } catch (e2) { if (window.__silent) window.__silent(e2); }
          }
          renderProducts();
        }).catch(function () {});
      }, 600);
    }

    // R178（用户 19:20 评论⑦扩展到全系统）：分类静默同步——本地即时更新后 600ms 防抖重拉一次，
    // 与服务器对账（loadCategories 本身无 loading 态，用户无感知）
    var __silentCatT = null;
    function silentSyncCategories() {
      clearTimeout(__silentCatT);
      __silentCatT = setTimeout(function () { loadCategories(); }, 600);
    }



    /* ===== v330 条26：全系统"后悔时间"统一 10 秒 =====
       范式：视觉上立刻删除（乐观删），10 秒后才真正提交；期间底部撤销条可一键复原。
       撤销 = 取消待提交（服务端还没删），零数据丢失；真删失败自动回滚并红字提示。 */
    var UNDO_MS = 10000;
    function __undoable(label, commitFn, undoFn) {
      var timer = setTimeout(function () { try { commitFn(); } catch (e) { if (window.__silent) window.__silent(e); } }, UNDO_MS);
      try {
        window.uiToast(label, 'success', function () {
          clearTimeout(timer);
          try { if (undoFn) undoFn(); } catch (e) { if (window.__silent) window.__silent(e); }
        });
      } catch (e) { clearTimeout(timer); try { commitFn(); } catch (e2) { if (window.__silent) window.__silent(e2); } } /* toast 异常：不留悬空，直接提交 */
    }

    function delProduct(id) {
      var p = (state.products || []).filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      var _idx = state.products.indexOf(p);
      var _delRow = document.querySelector('#productList [data-id="' + id + '"]');
      /* 乐观删：立刻移出列表 + 行淡出（点击即有反应，不再先弹确认框） */
      state.products = (state.products || []).filter(function (x) { return x.id !== id; });
      try { refreshCatCnts(); } catch (e) { if (window.__silent) window.__silent(e); }
      if (_delRow) { _delRow.style.transition = 'opacity 0.2s ease'; _delRow.style.opacity = '0'; }
      setTimeout(function () {
        if (_delRow && _delRow.parentNode) _delRow.parentNode.removeChild(_delRow);
        if (!document.querySelector('#productList .product-row')) renderProducts();
      }, 200);
      __undoable(
        '已删除「' + (p.title || '未命名') + '」',
        function () {
          api('admin/products/' + id, { method: 'DELETE' }).then(function (res) {
            if (res && res.ok) { clearCache(); silentSyncProducts(); }
            else {
              toast((res && res.msg) || '删除失败', 'error');
              var _cur = (state.products || []).slice(); _cur.splice(Math.min(_idx, _cur.length), 0, p);
              state.products = _cur; renderProducts(); /* 真删失败 → 回滚 */
            }
          }).catch(function () {
            toast('删除失败，请重试', 'error');
            var _cur2 = (state.products || []).slice(); _cur2.splice(Math.min(_idx, _cur2.length), 0, p);
            state.products = _cur2; renderProducts();
          });
        },
        function () {
          var _cur3 = (state.products || []).slice(); /* 撤销：服务端还没删，原样放回原位置即可 */
          _cur3.splice(Math.min(_idx, _cur3.length), 0, p);
          state.products = _cur3;
          try { refreshCatCnts(); } catch (e0) { if (window.__silent) window.__silent(e0); }
          renderProducts();
        }
      );
    }

    // 显示/隐藏直接切换：online=显示 / offline=隐藏（带完整数据，后端为全量更新）
    // 显示/隐藏直接切换：online=显示 / offline=隐藏（乐观更新：点击立即生效，管理页异步保存）
    var __productStatusBusy = false;
    function setProductStatus(id, status) {
      if (__productStatusBusy) return;
      var target = state.products.filter(function (p) { return p.id === id; })[0];
      if (!target) return;
      var cur = (target.is_online && !target.is_hidden) ? 'online' : 'offline';
      if (cur === status) return;
      __productStatusBusy = true;
      var prevOnline = target.is_online, prevHidden = target.is_hidden;
      // 立即在本地生效并重渲染，保证“点击即响应”（显示=资源页可见，隐藏=不可见）
      target.is_online = (status === 'online');
      target.is_hidden = false;
      window.__skipRenderOnce = true; var _sr = document.querySelector('#productList [data-id="' + id + '"]'); if (_sr) { var _sb = _sr.querySelector('.status-btn'); if (_sb) { _sb.textContent = status === 'online' ? '显示' : '隐藏'; _sb.classList.remove('status-online', 'status-hidden'); _sb.classList.add(status === 'online' ? 'status-online' : 'status-hidden'); _sb.title = '点击切换为' + (status === 'online' ? '隐藏（资源页不显示）' : '显示'); } }
      renderProducts();
      var data = {
        cid: target.cid, title: target.title, desc: target.desc, detail: target.detail,
        img: target.img, detailImages: target.detailImages || [],
        detailVideos: target.detailVideos || [], contactUrl: target.contactUrl || '',
        price: target.price || 0, sort: target.sort,
        schedule_on: target.schedule_on || '', schedule_off: target.schedule_off || '',
        is_online: target.is_online, is_hidden: target.is_hidden
      };
      api('admin/products/' + id, { method: 'PUT', body: JSON.stringify(data) }).then(function (res) {
        __productStatusBusy = false;
        /* v330 条8/25：状态已就地翻转（按钮立刻变"显示/隐藏"），不再重复弹成功提示条 */
        if (res && res.ok) { clearCache(); }
        else {
          // 失败回滚
          target.is_online = prevOnline; target.is_hidden = prevHidden; window.__skipRenderOnce = false;
          renderProducts();
          toast(res.msg || '操作失败，状态已回滚', 'error');
        }
      }).catch(function () {
        __productStatusBusy = false;
        /* v330 条25：网络异常同样回滚——乐观 UI 必须"要么成功、要么复原"，不留中间态 */
        target.is_online = prevOnline; target.is_hidden = prevHidden; window.__skipRenderOnce = false;
        renderProducts();
        toast('网络开小差了，请稍后再试', 'error'); // v294：087 网络提示统一
      });
    }
