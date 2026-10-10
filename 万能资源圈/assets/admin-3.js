/* v346 条1/12：后台按功能拆分 第3/5 段（由原 admin.js 物理切分；为支持拆分，已去掉最外层"圈屋"包裹，逻辑与拆分前一致） */
// ---------- 编辑 / 新增资源弹窗 ----------
    document.getElementById('addProductBtn').addEventListener('click', function () { openEdit(null); });

    function openEdit(p) {
      state.editingId = p ? p.id : null;
      state.editingProduct = p;
      editTitle.textContent = p ? '编辑资源' : '新增资源';
      // v294（用户 10-04 02:14）：271 编辑资源时刷新分类
      loadCategories(true);
      fillCidSelect(p ? p.cid : 0);
      fillProductForm(p);
      // 有草稿直接恢复，不弹确认框（R111 口径：×/取消=丢弃；点外/Esc=暂存草稿，下次打开自动恢复；
      // 草稿改内存存取——刷新即清，与其它弹窗的暂存口径统一）
      try {
        var dd = __editDrafts[p ? p.id : 'new'];
        if (dd) {
          fTitle.value = dd.title || ''; fDesc.value = dd.desc || ''; fDetail.innerHTML = sanitizeHTML(dd.detail || ''); // v296（用户 10-04 02:44）：安全修复，过滤恶意代码 fImg.value = dd.img || ''; fContactUrl.value = dd.contactUrl || ''; fPrice.value = dd.price || ''; fSort.value = dd.sort || 0; fOnline.checked = !!dd.online && !dd.hidden; fillCidSelect(dd.cid || 0);
          // R267（用户 09-27 15:13）：根因→草稿恢复不调 __setCoverImages，退出再进图库丢失未保存上传的图；修法→完整恢复图库/选中态/链接输入框。
          try { if (window.__setCoverImages) window.__setCoverImages(JSON.parse(dd.cover_images || '[]')); } catch(e) { if (window.__setCoverImages) window.__setCoverImages([]); }
        }
      } catch (e) { if (window.__silent) window.__silent(e); }
      updateImgPreview();
      editMask.classList.add('open');
      /* R241：滚动位置按「弹窗 × 对象」独立——切换资源不继承上一资源滚到的位置，同资源回来恢复原位 */
      if (window.__modalScroll) __modalScroll.open(editMask, p ? p.id : 'new');
      // R113：类型列表复用产品列表随接口已带回的 variants（进后台时已加载好，点开即显；
      // 原先点开弹窗才现场发请求等返回，是「点进去才加载、卡卡的」根因）。
      // 保存/删除/解绑等操作后仍走 loadVariants 刷新并回写缓存，保证下次打开也是最新。
      state.variants = (p && p.id && Array.isArray(p.variants)) ? p.variants.slice() : [];
      renderVariants();
      if (p && p.id && !Array.isArray(p.variants)) loadVariants(p.id); // 兜底：旧缓存无 variants 字段才现场拉
    }

    // 填充资源表单
    function fillProductForm(p) {
      fTitle.value = p ? (p.title || '') : '';
      /* R193c ⑨：程序赋值不触发 input——打开弹窗先清上一轮残留的实时校验红框 */
      clearFieldErr(fTitle);
      clearFieldErr(document.getElementById('fCidDisplay'));
      fDesc.value = p ? (p.desc || '') : '';
      fDetail.innerHTML = p ? sanitizeHTML(p.detail || '') : ''; // v296（用户 10-04 02:44）：安全修复，过滤恶意代码
      // R256：封面多图初始化
      var _covArr = p ? (p.coverImages || (p.img ? [p.img] : [])) : [];
      if (window.__setCoverImages) window.__setCoverImages(_covArr);
      else { fImg.value = p ? (p.img || '') : ''; }
      fContactUrl.value = p ? (p.contactUrl || '') : '';
      fPrice.value = p ? (p.price || '') : '';
      fSort.value = p ? (p.sort || 0) : 0;
      fOnline.checked = p ? !!(p.is_online && !p.is_hidden) : true;
      fScheduleOn.value = p ? (p.schedule_on || '') : '';
      fScheduleOff.value = p ? (p.schedule_off || '') : '';
      updateImgPreview(); // R15：表单填充后强制同步封面预览（程序赋值不触发 input 事件）
    }

    // 草稿保存：点遮罩关闭编辑弹窗时 saveDraft 落盘；自动保存定时器已随旧功能一并清除
    var draftTimer = null;
    function stopAutoSaveDraft() {
      if (draftTimer) { clearInterval(draftTimer); draftTimer = null; }
    }
    // R111：草稿改内存对象（用户定稿：所有页面草稿刷新页面就没）——不再落 localStorage；
    // 顺手清掉历史版本遗留的 product_draft_* 旧键
    var __editDrafts = {};
    try { for (var __lk = localStorage.length - 1; __lk >= 0; __lk--) { var __lkn = localStorage.key(__lk); if (__lkn && __lkn.indexOf('product_draft_') === 0) localStorage.removeItem(__lkn); } } catch (e) { if (window.__silent) window.__silent(e); }
    function saveDraft() {
      if (!editMask.classList.contains('open')) return;
      var draftData = {
        title: fTitle.value,
        desc: fDesc.value,
        detail: serializeDetail(), /* R147：兜底卡还原成 video */
        img: (window.__coverMainImage ? window.__coverMainImage() : fImg.value),
        cover_images: JSON.stringify(window.__coverImages ? window.__coverImages() : (fImg.value ? [fImg.value] : [])),
        contactUrl: fContactUrl.value,
        price: fPrice.value,
        sort: fSort.value,
        online: fOnline.checked,
        hidden: false,
        cid: fCid.value,
        savedAt: new Date().toISOString()
      };
      __editDrafts[state.editingId || 'new'] = draftData;
    }
    function clearDraft() {
      try { delete __editDrafts[state.editingId || 'new']; } catch (e) { if (window.__silent) window.__silent(e); }
      /* R241：草稿丢弃=放弃编辑，同步清该对象的弹窗滚动位置记忆（重开从顶开始） */
      try { if (window.__modalScroll) __modalScroll.forget(document.getElementById('editMask'), state.editingId || 'new'); } catch (e) { if (window.__silent) window.__silent(e); }
      stopAutoSaveDraft();
    }

    // 撤销/重做：交由浏览器原生（Ctrl+Z / Ctrl+Y）；原先自研的撤销栈无任何按钮调用，整块移除

    // 封面图实时预览
    // R15 加固：链接清空时同步清掉 src（杜绝任何残留显示路径）；换新链接时重置 fh 标记，
    // 保证新链接加载失败仍能换上感叹号占位（全局 error 委托只处理第一次失败）
    // R209（用户 09-19 00:31）：根因→输入无效地址时 onerror 反复触发+src 高频切换导致占位框抖动；
    // 修法→300ms 防抖 + 缓存已知坏地址，同地址不再重复触发加载-失败循环
    // R266（用户 09-27 15:08）：根因→admin.js 存在两个 updateImgPreview 行为分叉，
    // 旧路径（单图编辑）有 new Image() 试载保护，R256 新路径（轮播图库）直接 preview.src=url
    // 裸闪破损图标+alt「预览」。修法→提取共享安全加载函数 _safeSetPreview，两处复用消除分叉。
    var __imgPreviewTimer = null;
    var __lastBadUrl = null;
    function _safeSetPreview(preview, url, opts) {
      opts = opts || {};
      if (!preview) return;
      clearTimeout(__imgPreviewTimer);
      if (url) {
        if (preview.getAttribute('src') !== url) { preview.removeAttribute('src'); preview.classList.remove('media-fail'); }
        preview.classList.add('show'); // 槽先占座（灰底 120×120，图探测完成原位填充）
      } else if (opts.hideEmpty) {
        preview.style.display = 'none';
        preview.classList.remove('show');
        return;
      }
      var doLoad = function () {
        if (url) {
          if (url === __lastBadUrl) {
            preview.onerror = null; preview.dataset.fh = '1';
            preview.src = EXC_PLACEHOLDER; if (preview && preview.classList) preview.classList.add('media-fail');
            preview.classList.add('show');
            return;
          }
          /* R304 P18（用户 09-30 拍板）：管理页编辑弹窗预览读小图；小图 404（存量旧图还没补到）回退原图探测，原图也失败才占位符 */
          var _tUrl = thumbOf(url);
          var probe = new Image();
          probe.onload = function () {
            preview.onerror = null; delete preview.dataset.fh;
            preview.classList.remove('media-fail');
            preview.src = _tUrl;
            preview.classList.add('show');
          };
          probe.onerror = function () {
            if (_tUrl !== url) {
              var probe2 = new Image(); /* R304 P18：小图缺失 → 回退原图 */
              probe2.onload = function () {
                preview.onerror = null; delete preview.dataset.fh;
                preview.classList.remove('media-fail');
                preview.src = url;
                preview.classList.add('show');
              };
              probe2.onerror = function () {
                __lastBadUrl = url;
                preview.onerror = null; preview.dataset.fh = '1';
                preview.src = EXC_PLACEHOLDER; if (preview && preview.classList) preview.classList.add('media-fail');
                preview.classList.add('show');
              };
              probe2.src = url;
              return;
            }
            __lastBadUrl = url;
            preview.onerror = null; preview.dataset.fh = '1';
            preview.src = EXC_PLACEHOLDER; if (preview && preview.classList) preview.classList.add('media-fail');
            preview.classList.add('show');
          };
          probe.src = _tUrl;
        } else {
          preview.onerror = null; preview.dataset.fh = '1'; __lastBadUrl = null;
          preview.src = EXC_PLACEHOLDER; if (preview && preview.classList) preview.classList.add('media-fail');
          preview.classList.add('show');
        }
      };
      if (opts.noDebounce) { doLoad(); } else { __imgPreviewTimer = setTimeout(doLoad, 300); }
    }
    function updateImgPreview() {
      // R267（用户 09-27 15:13）：根因→外层旧版读 fImg.value 与图库状态脱节；修法→统一走图库语义，读当前选中槽位。
      var url = (window.__coverMainImage ? window.__coverMainImage() : fImg.value).trim();
      _safeSetPreview(document.getElementById('fImgPreview'), url, { hideEmpty: true, noDebounce: true });
    }
    fImg.addEventListener('input', updateImgPreview);

    // 构建级联分类选择器（一级可直接点选，点箭头展开二级）
    function buildCatPicker(pickerEl, hiddenInput, displayEl, panelEl, selected, opts) {
      opts = opts || {};
      var cats = (state.categories || []).filter(function (c) {
        if (opts.excludeZero && c.id === 0) return false;
        if (opts.topOnly) return c.id !== 0 && (!c.parent_id || c.parent_id === 0);
        return true;
      });
      var tops = cats.filter(function (c) { return c.id !== 0 && (!c.parent_id || c.parent_id === 0); })
        .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      panelEl.innerHTML = '';
      if (opts.showAll || opts.allowUncategorized) {
        var all = document.createElement('div');
        all.className = 'cp-item cp-all' + (Number(selected) === 0 ? ' selected' : '');
        all.innerHTML = '<span class="cp-name">' + (opts.allLabel || '全部') + '</span>';
        all.addEventListener('click', function () { pickCatValue(pickerEl, hiddenInput, displayEl, 0, opts.allLabel || '全部', !!opts.showAll); });
        panelEl.appendChild(all);
      }
      if (!tops.length) {
        var empty = document.createElement('div');
        empty.className = 'cp-empty';
        empty.innerHTML = window.__adminEmpty('暂无分类', '请先到「分类管理」添加分类'); /* v349 条9：统一空态 */
        panelEl.appendChild(empty);
      }
      tops.forEach(function (top) {
        var subs = cats.filter(function (c) { return c.parent_id === top.id; })
          .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
        var _hasAllV = !subs.some(function (s) { return String(s.name || '').trim() === '全部'; });
        var row = document.createElement('div');
        row.className = 'cp-item cp-top' + (Number(selected) === top.id ? ' selected' : '');
        var name = document.createElement('span');
        name.className = 'cp-name';
        name.textContent = top.name;
        row.appendChild(name);
        if (subs.length || _hasAllV) {
          var chev = document.createElement('span');
          chev.className = 'cp-chevron';
          chev.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>';
          chev.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var childBox = row.nextElementSibling;
            var expanded = childBox.classList.toggle('show');
            row.classList.toggle('cp-expanded', expanded);
          });
          row.appendChild(chev);
        }
        row.addEventListener('click', function () { pickCatValue(pickerEl, hiddenInput, displayEl, top.id, top.name); });
        panelEl.appendChild(row);
        var childBox = document.createElement('div');
        childBox.className = 'cp-children';
        // 一级分类下的"全部"（等价选中该一级全部子分类）；已有同名"全部"二级则不重复插入
        // R147（用户 01:07）：资源分类选择（编辑/批量移动）禁用该虚拟行——选它会把 cid 设为一级 id（伪分类）；
        // 筛选场景（filterCatPicker showAll）保留。一级行本身仍可直接点选（合法：一级可挂资源）。
        if (_hasAllV && !opts.noSubAll) { var _allr = document.createElement('div'); _allr.className = 'cp-item cp-sub' + (Number(selected) === top.id ? ' selected' : ''); var _alln = document.createElement('span'); _alln.className = 'cp-name'; _alln.textContent = '全部'; _allr.appendChild(_alln); _allr.addEventListener('click', (function (ti, tn) { return function () { pickCatValue(pickerEl, hiddenInput, displayEl, ti, tn); }; })(top.id, top.name)); childBox.appendChild(_allr); }
        subs.forEach(function (sub) {
          var srow = document.createElement('div');
          srow.className = 'cp-item cp-sub' + (Number(selected) === sub.id ? ' selected' : '');
          var sname = document.createElement('span');
          sname.className = 'cp-name';
          sname.textContent = sub.name;
          srow.appendChild(sname);
          srow.addEventListener('click', function () { pickCatValue(pickerEl, hiddenInput, displayEl, sub.id, sub.name); });
          childBox.appendChild(srow);
        });
        panelEl.appendChild(childBox);
      });
      var sel = Number(selected);
      var found = (state.categories || []).find(function (c) { return Number(c.id) === sel && !(opts.excludeZero && Number(c.id) === 0); });
      var txtEl = displayEl.querySelector('.cpd-text');
      if (sel === 0 && (opts.showAll || opts.allowUncategorized)) { txtEl.textContent = opts.allLabel || '全部（未分类）'; txtEl.classList.add('placeholder'); }
      else if (found) { txtEl.textContent = found.name; txtEl.classList.remove('placeholder'); }
      else { txtEl.textContent = opts.placeholder || '请选择分类'; txtEl.classList.add('placeholder'); }
      hiddenInput.value = sel || 0;
    }
    function pickCatValue(pickerEl, hiddenInput, displayEl, id, name, grey) {
      hiddenInput.value = id;
      var txtEl = displayEl.querySelector('.cpd-text');
      txtEl.textContent = name;
      txtEl.classList.toggle('placeholder', !!grey); /* R215 条2：筛选「全部」=未筛选，统一灰占位 */
      document.querySelectorAll('.cat-picker.open, .select-picker.open').forEach(function (p) { p.classList.remove('open'); });
      pickerEl.querySelectorAll('.cp-item.selected').forEach(function (el) { el.classList.remove('selected'); });
      if (!document.getElementById('batchCatMask').classList.contains('open') && !document.getElementById('catMask').classList.contains('open') && typeof onProductCidChange === 'function') onProductCidChange(id);
    }
    document.addEventListener('click', function (e) {
      var disp = e.target.closest ? e.target.closest('.cat-picker-display') : null;
      if (disp) {
        var picker = disp.closest('.cat-picker, .select-picker');
        var wasOpen = picker.classList.contains('open');
        document.querySelectorAll('.cat-picker.open, .select-picker.open').forEach(function (p) {
          p.classList.remove('open');
          var pp = p.querySelector('.cat-picker-panel');
          if (!pp && p.dataset.pickerId) pp = document.querySelector('.cat-picker-panel[data-picker-id="' + p.dataset.pickerId + '"]');
          if (pp) { if (pp.parentNode !== p) p.appendChild(pp); pp.classList.remove('open'); }
        });
        if (!wasOpen) {
          picker.classList.add('open');
          if (picker.classList.contains('select-picker')) {
            var pp = picker.querySelector('.cat-picker-panel');
            if (pp) { document.body.appendChild(pp); pp.classList.add('open'); }
          }
          positionCatPanel(picker);
        }
        return;
      }
      if (!(e.target.closest && (e.target.closest('.cat-picker') || e.target.closest('.select-picker')))) {
        document.querySelectorAll('.cat-picker.open, .select-picker.open').forEach(function (p) {
          p.classList.remove('open');
          var pp = p.querySelector('.cat-picker-panel');
          if (!pp && p.dataset.pickerId) pp = document.querySelector('.cat-picker-panel[data-picker-id="' + p.dataset.pickerId + '"]');
          if (pp) { if (pp.parentNode !== p) p.appendChild(pp); pp.classList.remove('open'); }
        });
      }
    });
    // 面板定位：fixed 跟随触发按钮，避免被弹窗/容器裁剪（分类与通用选择器共用）
    function positionCatPanel(picker) {
      var panel = picker.querySelector('.cat-picker-panel');
      if (!panel && picker.dataset.pickerId) {
        panel = document.querySelector('.cat-picker-panel[data-picker-id="' + picker.dataset.pickerId + '"]');
      }
      var disp = picker.querySelector('.cat-picker-display');
      if (!panel || !disp) return;
      var r = disp.getBoundingClientRect();
      var ph = Math.min(panel.scrollHeight || 240, 264);
      var left = Math.max(8, r.left);
      var top = r.bottom + 4;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 4);
      panel.style.top = top + 'px';
      // R146（用户 00:34）：码面板项=类型名+金额+码键，180px 装不下会把类型名挤成竖排换行——
      // 先按内容自然宽度测量，再取 max(触发键宽, 自然宽)，上限视口-16px 防溢出
      var w = Math.max(r.width, 180);
      if (picker.classList.contains('code-picker')) {
        var _prevW = panel.style.width;
        panel.style.width = 'auto';
        panel.style.maxWidth = 'none';
        var _nat = panel.scrollWidth || 0;
        panel.style.maxWidth = '';
        panel.style.width = _prevW;
        w = Math.max(w, _nat + 2);
        w = Math.min(w, (window.innerWidth || 390) - 16);
      }
      // R165（用户 19:07）：面板右缘钳制——手机上触发键靠屏幕右缘时，旧定位 left=触发键左缘，
      // 面板宽随内容涨（长类型名），left+w 会把面板整块推出屏幕右边界（名称/码键溢出屏幕看不见）。
      // 定宽后回算：left 夹进 [8, innerWidth-w-8]，面板永远完整落在屏幕内。
      left = Math.max(8, Math.min(left, (window.innerWidth || 390) - w - 8));
      panel.style.left = left + 'px';
      panel.style.width = w + 'px';
    }
    // 通用自制下拉选择器：把原生 select 替换为与分类选择器一致的美观选择框
    // 原 select 保留（隐藏）作为值载体，选择后派发 change 事件，原逻辑无需改动
    var spRefs = new Map(); // R166：select -> picker ref 映射（原先存 sel.dataset.spRef 会字符串化成 "[object Object]"，程序化改值后拿不回 ref，自制下拉显示框无法同步——annMode 取消后仍显示草稿的根因）
    function makeSelectPicker(sel) {
      if (!sel || sel.dataset.sp) return spRefs.get(sel);
      sel.dataset.sp = '1';
      var holder = document.createElement('div');
      holder.className = 'select-picker';
      var __spid = 'sp-' + Math.random().toString(36).slice(2,9);
      holder.dataset.pickerId = __spid;
      var disp = document.createElement('div');
      disp.className = 'cat-picker-display';
      var txt = document.createElement('span');
      txt.className = 'cpd-text' + (sel.value ? '' : ' placeholder');
      txt.textContent = sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '请选择';
      var arrow = document.createElement('span');
      arrow.className = 'cpd-arrow'; arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>';
      disp.appendChild(txt); disp.appendChild(arrow);
      var panel = document.createElement('div');
      panel.className = 'cat-picker-panel';
      panel.dataset.pickerId = __spid;
      function render() {
        panel.innerHTML = '';
        txt.textContent = sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '请选择';
        txt.classList.toggle('placeholder', !sel.value);
        Array.from(sel.options).forEach(function (o) {
          var it = document.createElement('div');
          it.className = 'cp-item' + (String(o.value) === String(sel.value) ? ' selected' : '');
          it.textContent = o.textContent;
          if (o.style && o.style.cssText) it.style.cssText = o.style.cssText; /* R194b：选项内联样式（字体各自体/字号各档）透传到自制下拉条目 */
          it.addEventListener('click', function () {
            sel.value = o.value;
            txt.textContent = o.textContent;
            txt.classList.remove('placeholder');
            holder.classList.remove('open');
            if (panel.parentNode !== holder) { holder.appendChild(panel); }
            panel.classList.remove('open');
            panel.querySelectorAll('.cp-item.selected').forEach(function (e) { e.classList.remove('selected'); });
            it.classList.add('selected');
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          });
          panel.appendChild(it);
        });
      }
      holder.appendChild(disp); holder.appendChild(panel);
      sel.parentNode.insertBefore(holder, sel);
      sel.style.display = 'none';
      render();
      var ref = { el: holder, refresh: render, sel: sel, panel: panel };
      spRefs.set(sel, ref);
      return ref;
    }
    // R166：程序化修改 select 的 value / selectedIndex 后，同步自制下拉显示框（文本/占位样式/选中项高亮）
    function syncSelectDisplay(sel) {
      var ref = spRefs.get(sel);
      if (ref && ref.refresh) ref.refresh();
    }
    // 统一升级页面里所有原生 select 为自制选择框（编辑器字体/字号、状态筛选、公告频率、分类父级等）
    function upgradeAllSelects() {
      document.querySelectorAll('select').forEach(function (sel) {
        makeSelectPicker(sel); // R18：状态筛选宽度交由 CSS 统一控制（.tb-row2 内两框同宽），不再 inline 指定
      });
    }
    upgradeAllSelects();

    function initFilterCatPicker() {
      var fp = document.getElementById('filterCatPicker');
      if (!fp) return;
      buildCatPicker(
        fp,
        document.getElementById('filterCat'),
        fp.querySelector('.cat-picker-display'),
        document.getElementById('filterCatPanel'),
        0,
        { excludeZero: false, showAll: true, allLabel: '全部分类', }
      );
      /* R183 条21：恢复记忆的筛选——首次启动从 localStorage 取值写入 select；每次重建后按 select 当前值同步下拉显示（防重渲染后显示回占位） */
      try {
        var __sc = document.getElementById('filterCat');
        var __ss = document.getElementById('filterStatus');
        if (!window.__filterRestored) {
          window.__filterRestored = true;
          var __f = JSON.parse(localStorage.getItem('wnzyq_admin_filter') || 'null');
          if (__f && (__f.c !== undefined && __f.c !== null && __f.c !== '')) { if (__sc) __sc.value = __f.c; }
          if (__f && __f.s) { if (__ss) __ss.value = __f.s; if (typeof syncSelectDisplay === 'function') syncSelectDisplay(__ss); }
        }
        var __sv = __sc ? String(__sc.value) : '';
        if (__sv && __sv !== '' && __sv !== '0') {
          var __cn = (state.categories || []).filter(function (x) { return String(x.id) === __sv; }).map(function (x) { return x.name; })[0] || '';
          if (__cn) {
            var __dt = fp.querySelector('.cat-picker-display .cpd-text');
            if (__dt) { __dt.textContent = __cn; __dt.classList.remove('placeholder'); }
            fp.querySelectorAll('.cp-item.selected').forEach(function (el) { el.classList.remove('selected'); });
          }
        } else if (__sv === '0') {
          var __dt0 = fp.querySelector('.cat-picker-display .cpd-text');
          if (__dt0) { __dt0.textContent = '全部分类'; __dt0.classList.add('placeholder'); } /* R215 条2：未筛选=灰占位 */
        }
      } catch (e0) { if (window.__silent) window.__silent(e0); }
    }
    function onProductCidChange(id) {
      var d = document.getElementById('fCidDisplay'); if (d) { d.style.borderColor = ''; d.style.boxShadow = ''; }
      clearFieldErr(d); /* R193c ⑨：清除实时校验红框 */
      // 若不在编辑弹窗中（即资源管理分类筛选场景），切换分类即时刷新列表
      var em = document.getElementById('editMask');
      if (em && !em.classList.contains('open')) { adminPage = 1; renderProducts(); }
    }

    function fillCidSelect(selected) {
      buildCatPicker(
        document.getElementById('fCidPicker'), fCid,
        document.getElementById('fCidDisplay'), document.getElementById('fCidPanel'),
        selected, { allowUncategorized: true, } /* R215 条5：恢复二级「全部」（=选该一级），一级「全部」保留 */
      );
    }

    saveProductBtn.addEventListener('click', saveProduct);
    editCancel.addEventListener('click', function () { try { if (window.__fcSweepEdit) window.__fcSweepEdit(editMask); } catch (e) {} editMask.classList.remove('open'); clearDraft(); }); /* v353：丢弃编辑=这次传的没用上的文件统一追删（后端核对引用，绝不误删） */
    editMask.addEventListener('click', function (e) { if (e.target === editMask) { saveDraft(); editMask.classList.remove('open'); } }); // R257（老板 09-23 19:08）：点外=暂存草稿（重开 openEdit 自动回填离开时内容）；×/取消=丢弃（clearDraft）。R111 原暂存语义恢复，R145 丢弃口径按老板最新反馈废除

    // ---------- 表单必填校验 ----------
    function validateField(input, msg) {
      if (!input || !input.value || !String(input.value).trim()) {
        input.style.borderColor = '#ff4444';
        input.style.boxShadow = '0 0 0 3px rgba(255,68,68,0.15)';
        toast(msg || '请填写必填项', 'error');
        input.focus();
        return false;
      }
      input.style.borderColor = '';
      input.style.boxShadow = '';
      return true;
    }
    // 输入时清除红色边框
    function bindFieldClear(input) {
      if (!input) return;
      input.addEventListener('input', function () {
        this.style.borderColor = '';
        this.style.boxShadow = '';
      });
      input.addEventListener('change', function () {
        this.style.borderColor = '';
        this.style.boxShadow = '';
      });
    }

    /* ---------- R193c ⑨（用户 23:10 拍板；23:26 修正：只留红框，去掉框下红字） ----------
       原先要等点「确定」保存时才发现必填错误 → 改成边填边提示：
       字段被触碰过（blur 或输入过）后值为空即红框，填上立即消；
       保存时 validateField 兜底不变（没碰过的字段照样拦）。红框规格与保存时一致。 */
    function showFieldErr(input, msg) {
      if (!input) return;
      input.style.borderColor = '#ff4444';
      input.style.boxShadow = '0 0 0 3px rgba(255,68,68,0.15)';
    }
    function clearFieldErr(input) {
      if (!input) return;
      input.style.borderColor = '';
      input.style.boxShadow = '';
      var err = input.parentNode ? input.parentNode.querySelector('.field-err[data-for="' + (input.id || '') + '"]') : null;
      if (err) err.remove(); /* 兼容清理：历史版本可能残留的红字节点一并移除 */
    }
    function attachLiveCheck(input, msg) {
      if (!input) return;
      var touched = false;
      input.addEventListener('blur', function () { touched = true; if (!String(input.value || '').trim()) showFieldErr(input, msg); });
      input.addEventListener('input', function () {
        if (String(input.value || '').trim()) clearFieldErr(input);
        else if (touched) showFieldErr(input, msg);
      });
    }

    var saving = false;
    // （catSaving 在分类管理区域声明）
    // R147（用户 00:56）：detail 序列化——编辑器里的视频兜底卡还原成原始 video 标签，
    // 保存/草稿/预览内容永远干净（前台加载失败会用自己的逻辑再渲染卡，无删除键）
    function serializeDetail() {
      var clone = fDetail.cloneNode(true);
      try { clone.querySelectorAll('.rte-img-del').forEach(function (d) { d.remove(); }); } catch (e0) { if (window.__silent) window.__silent(e0); } // R158：×浮层兜底剥离（关闭时已摘离编辑器，双保险）
      try { clone.querySelectorAll('.rte-media-sel').forEach(function (m) { m.classList.remove('rte-media-sel'); }); } catch (e1) { if (window.__silent) window.__silent(e1); } // R165：自绘选中框 class 兜底剥离（__hideImgDel 已清，双保险）
      var cards = clone.querySelectorAll('.video-fallback');
      cards.forEach(function (fb) {
        var vs = fb.getAttribute('data-vsrc');
        if (!vs) { var _a = fb.querySelector('.vf-link'); vs = _a ? _a.getAttribute('href') : ''; }
        if (vs) {
          var tmp = document.createElement('div');
          tmp.innerHTML = '<video src="' + String(vs).replace(/"/g, '&quot;') + '" controls style="max-width:100%;border-radius:8px;"></video>';
          fb.parentNode ? fb.parentNode.replaceChild(tmp.firstChild, fb) : fb.remove();
        } else { fb.remove(); }
      });
      return clone.innerHTML;
    }
    /* v346 条18：删除无引用的全局挂载 window.__serializeDetail（内部一律直接调 serializeDetail） */
    // R158（用户 22:35）：编辑器内容序列化统一入口——克隆后剥离 .rte-img-del 浮层（×关闭时已从编辑器摘除，此处双保险，
    // 防止「选中媒体→×正显示→程序化保存」路径把×写进内容）。类型说明/专属内容/公告三个编辑器统一走这里。
    window.__rteClean = function (el) {
      if (!el) return '';
      var c = el.cloneNode(true);
      try { c.querySelectorAll('.rte-img-del').forEach(function (d) { d.remove(); }); } catch (e0) { if (window.__silent) window.__silent(e0); }
      try { c.querySelectorAll('.rte-media-sel').forEach(function (m) { m.classList.remove('rte-media-sel'); }); } catch (e1) { if (window.__silent) window.__silent(e1); } // R165：自绘选中框 class 兜底剥离
      return c.innerHTML;
    };
    function saveProduct() {
      if (saving) return; // 防重复提交
      var data = {
        cid: Number(fCid.value) || 0,
        title: fTitle.value.trim(),
        desc: fDesc.value.trim(),
        detail: serializeDetail(), /* R147：兜底卡还原成 video */
        img: (window.__coverMainImage ? window.__coverMainImage() : (fImg.value ? fImg.value.trim() : '')),
        cover_images: JSON.stringify(window.__coverImages ? window.__coverImages() : (fImg.value ? [fImg.value] : [])),
        detailImages: [],
        detailVideos: [],
        contactUrl: fContactUrl.value.trim(),
        price: Number(fPrice.value) || 0,
        sort: Number(fSort.value) || 0,
        is_online: fOnline.checked,
        is_hidden: false,
        schedule_on: fScheduleOn.value || '',
        schedule_off: fScheduleOff.value || '',
        updated_at: (state.editingProduct && state.editingProduct.updated_at) || '' // v294：211 并发编辑乐观锁
      };
      if (!validateField(fTitle, '请填写资源标题')) return;
      // R209（用户 09-19 00:46）：根因→cid=0（「全部/未分类」）被 !data.cid 当成未选拦截；修法→cid=0 是合法选项，只拦 undefined/null
      if (data.cid === undefined || data.cid === null) { toast('请选择资源分类', 'error'); document.getElementById('fCidDisplay').style.borderColor = '#ff4444'; document.getElementById('fCidDisplay').style.boxShadow = '0 0 0 3px rgba(255,68,68,0.15)'; return; }

      saving = true;
      var isNewSave = !state.editingId; // 记录本次是否为新增（editingId 之后会被赋值）
      // R293（用户 09-30）：恢复「确定中」忙碌态——R292 撤掉，老板要求恢复并全系统排查补齐
      saveProductBtn.disabled = true;
      if (window.__btnBusy) window.__btnBusy(saveProductBtn, '确定中');

      // 修复：原先在请求发出前就提示"保存成功"并关闭弹窗——网络一旦失败，用户以为已保存，数据实际没写入。
      // 现在提示与关窗只在请求成功后发生（见下方 then 分支）。
      var req = state.editingId
        ? api('admin/products/' + state.editingId, { method: 'PUT', body: JSON.stringify(data) })
        : api('admin/products', { method: 'POST', body: JSON.stringify(data) });

      req.then(function (res) {
        saving = false;
        if (res && res.ok) {
          // 如果是新增，拿到新 id 后刷新类型列表（类型可能已在编辑时添加）
          if (!state.editingId && res.id) {
            state.editingId = res.id;
            // 提交新增前暂存的类型（顺序提交，保证排序）
            var pend = (state.variants || []).slice();
            (function next(i) {
              if (i >= pend.length) return;
              var vd = Object.assign({}, pend[i], { productId: res.id });
              api('admin/variants', { method: 'POST', body: JSON.stringify(vd) }).then(function () { next(i + 1); }).catch(function () { next(i + 1); });
            })(0);
          }
          // R178（用户 19:20 评论⑦扩展到全系统）：保存成功后本地立即更新资源列表——
          // 不再 loadProducts() 全量重拉（慢网下列表要等第二次网络往返才显示新数据）；
          // 本地合并/插入后立即渲染，600ms 后 silentSyncProducts 静默同步保证与服务器一致
          var _sp = (state.products || []).find(function (x) { return x.id === state.editingId; });
          if (_sp) {
            _sp.cid = data.cid; _sp.title = data.title; _sp.desc = data.desc; _sp.detail = data.detail;
            _sp.img = data.img; _sp.contactUrl = data.contactUrl; _sp.price = data.price;
            _sp.is_online = data.is_online ? 1 : 0; _sp.is_hidden = data.is_hidden ? 1 : 0;
            _sp.schedule_on = data.schedule_on || ''; _sp.schedule_off = data.schedule_off || ''; _sp.sort = data.sort;
            _sp.variants = (state.variants || []).slice(); // 类型本地已是最新（新增类型已串行提交）
            // R267（用户 09-27 15:13）：根因→保存后本地副本漏 coverImages，退出再进图库不显示刚上传的图；修法→补回。
            try { _sp.coverImages = JSON.parse(data.cover_images || '[]'); } catch(e) { _sp.coverImages = []; }
          } else if (res.id) {
            state.products.push({ id: res.id, cid: data.cid, title: data.title, desc: data.desc, detail: data.detail,
              img: data.img, detailImages: [], detailVideos: [], contactUrl: data.contactUrl, price: data.price,
              is_online: data.is_online ? 1 : 0, is_hidden: data.is_hidden ? 1 : 0,
              schedule_on: data.schedule_on || '', schedule_off: data.schedule_off || '', sort: data.sort,
              coverImages: (function(){ try { return JSON.parse(data.cover_images || '[]'); } catch(e){ return []; } })(),
              variants: (state.variants || []).slice() });
          }
          /* R211 二批（用户 09-20）：保存成功按钮状态链——转圈→✓（停留 400ms 让反馈可见）→收弹窗恢复；R183 条4 只有转圈无成功态 */
          if (window.__btnSuccess) window.__btnSuccess(saveProductBtn, '已保存');
          setTimeout(function () { editMask.classList.remove('open'); }, 400);
          if (isNewSave) { try { delete __editDrafts['new']; } catch (e) { if (window.__silent) window.__silent(e); } } // 新增成功必须清掉“新资源”草稿，避免下次新增带出旧内容
          clearDraft(); // 保存成功后清除草稿
          try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); } // R248：同时清 localStorage 草稿
          /* v330 条8：成功不再弹提示条——按钮已就地打✓「已保存」+ 列表对应行蓝光高亮，反馈就在视线里 */ if (window.__haptic) window.__haptic();
          clearCache();
          /* v351 C2：自动清理"旧版本有、新版本已不再引用"的文件——
             后端删前会再核对该 key 是否仍被任何资源/类型引用，被引用的一律保留，绝不误删 */
          try {
            var _oldP = (state.products || []).find(function (x) { return x.id === state.editingId; });
            var _oldText = _oldP ? ((_oldP.detail || '') + (_oldP.img || '') + (_oldP.detailImages || []).join('') + (_oldP.detailVideos || []).join('') + (_oldP.coverImages || []).join('') + ((_oldP.variants || []).map(function (v) { return v.desc || ''; }).join(''))) : '';
            var _newKeys = window.__collectFileKeys((data.detail || '') + (data.img || '') + (data.cover_images || ''));
            var _gone = window.__collectFileKeys(_oldText).filter(function (k) { return _newKeys.indexOf(k) === -1; });
            if (_gone.length && state.editingId) api('admin/cleanup-files', { method: 'POST', body: JSON.stringify({ keys: _gone }) }).catch(function () {});
          } catch (e) { if (window.__silent) window.__silent(e); }
          renderProducts();
          /* R231 条25（用户 09-21 23:38）：保存后列表新改行蓝光高亮 1s 渐隐——
             关弹窗后视线落回列表，刚改过的行有一眼可辨的确认反馈 */
          try {
            var _fr = document.querySelector('#productList [data-id="' + state.editingId + '"]');
            if (_fr) { _fr.classList.add('row-flash'); setTimeout(function () { _fr.classList.remove('row-flash'); }, 1600); } /* v336 条170：高亮提到 1.5 秒（用户拍板） */
          } catch (e) { if (window.__silent) window.__silent(e); }
          refreshCatCnts();
          silentSyncProducts();
        } else {
          saveProductBtn.disabled = false; saveProductBtn.textContent = '确定';
          toast(res.msg || '保存失败', 'error');
        }
      }).catch(function () {
        saving = false;
        saveProductBtn.disabled = false; saveProductBtn.textContent = '确定';
        toast('网络开小差了，请稍后再试', 'error'); // v294：087 网络提示统一
      });
    }

    // ---------- 资源类型管理 ----------
    function loadVariants(productId) {
      api('admin/variants?product_id=' + productId).then(function (res) {
        if (res && res.ok) {
          state.variants = res.list || [];
          // R113：回写产品列表缓存，下次打开编辑弹窗即显最新类型（不发请求）
          var _p = (state.products || []).find(function (x) { return x.id === productId; });
          if (_p) _p.variants = (res.list || []).slice();
          renderVariants();
        }
      });
    }

    function renderVariants() {
      variantListEl.innerHTML = '';
      if (!state.variants.length) {
        variantListEl.innerHTML = window.__adminEmpty('暂无类型', '点右上角「新增类型」添加，可拖拽排序'); /* v349 条9：统一空态 */
        return;
      }
      state.variants.forEach(function (v, idx) {
        var item = document.createElement('div');
        item.className = 'variant-item';
        item.draggable = false;
        item.dataset.idx = idx;
        if (v.id) item.dataset.vid = v.id; /* R183 条7：删除塌缩定位用 */
        item.style.cursor = 'default';

        // 拖拽手柄
        var handle = document.createElement('span');
        handle.className = 'drag-handle'; handle.draggable = true; handle.title = '拖动排序';
        handle.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>';

        var name = document.createElement('span');
        name.className = 'v-name';
        name.textContent = v.name || '(未命名)';
        if (v.isHidden) {
          var hideBadge = document.createElement('span');
          hideBadge.style.cssText = 'font-size:12px;color:#b26a00;background:#fff3e0;padding:2px 8px;border-radius:3px; /* v293（用户 10-04 02:14）：054圆角统一→4px不在5档阶梯(3/8/10/14/999)，改3px跟微装饰档统一 */ margin-left:8px;font-weight:600;';
          hideBadge.textContent = '隐藏';
          name.appendChild(hideBadge);
        }

        // 资源码/绑定/无码统一做成按键（R136 用户定稿）：全部复用全站 row-btn 按键样式——
        // 有码=码按键（点击复制）、绑定 N=独立按键（点击开绑定设备弹窗）、无码=同款按键（灰字）
        // 三种按键高度/圆角/按压反馈完全一致，天然对齐（无差异化）
        // R146（用户 00:34）：类型名称与资源码之间加金额（橙色，无金额不渲染）
        var _viPriceText = formatPrice(v.price);
        var _vipEl = null;
        if (_viPriceText) {
          var _vip = document.createElement('span');
          _vip.className = 'v-price';
          _vip.textContent = _viPriceText;
          _vipEl = _vip; /* R148（用户 01:26）：金额位置修正——不在创建时 append（会排到行最左），挪到 name 之后、码键之前 */
        }
        if (!_vipEl) { /* R154：无金额行保留金额槽位（空占位），¥/码键跨行对齐；视觉上仍不渲染金额段 */
          _vipEl = document.createElement('span');
          _vipEl.className = 'price-slot-ph';
        }

        var codeSpan = document.createElement('span');
        /* R175（用户 10:00）：加稳定类名——手机档 grid 列对齐挂 area 用 */
        codeSpan.className = 'v-code-group';
        codeSpan.style.cssText = 'display:inline-flex;align-items:center;gap:6px;flex-shrink:0;';
        if (v.resourceCode && v.resourceCode.trim()) {
          var codeBtn = document.createElement('button');
          codeBtn.type = 'button';
          codeBtn.className = 'row-btn code-slot'; /* R154：码键固定槽位，跨行对齐 */
          // R144（用户 23:57）：有码=蓝底白字（参考"显示"按键 .row-btn.status-online 的配色），宽高不变
          codeBtn.style.cssText = 'font-family:monospace;letter-spacing:1px;font-weight:600;background:var(--blue1);color:#fff;border-color:var(--blue1);';
          codeBtn.textContent = v.resourceCode;
          codeBtn.title = v.resourceCode + '（点击复制并发新码）'; /* R179：固定宽截断后悬停 title 看全码；R221：复制即换码 */
          (function (cvObj, cBtn) {
            cBtn.addEventListener('click', function (ev) {
              ev.preventDefault(); ev.stopPropagation();
              /* R221：复制即换码——旧码记 issued（60 天窗口起算）+ 立即出新码；无 id 的未保存类型退回普通复制 */
              if (!cvObj || !cvObj.id) {
                var ok0 = window.__shareCopyText ? window.__shareCopyText(cvObj ? cvObj.resourceCode : '') : false;
                toast(ok0 ? '已复制' : '复制失败', ok0 ? 'success' : 'error');
                return;
              }
              /* R243 条7：发码键防连点统一（复用码面板 R231 写法） */
              if (cBtn.disabled || window.__issueInFlight) return;
              cBtn.disabled = true;
              if (window.__btnBusy) window.__btnBusy(cBtn, '发码中'); else cBtn.textContent = '发码中';
              __issueCode(cvObj, function () { renderVariants(); });
            });
          })(v, codeBtn);
          codeSpan.appendChild(codeBtn);
        } else {
          var noCodeBtn = document.createElement('button');
          noCodeBtn.type = 'button';
          noCodeBtn.className = 'row-btn code-slot'; /* R154：无码键同槽位宽，跨行对齐 */
          // R144：无码键字体颜色参考编辑按键（var(--text-light)），原 text-faint 偏浅
          noCodeBtn.style.cssText = 'color:var(--text-light);cursor:default;';
          noCodeBtn.textContent = '无资源码';
          codeSpan.appendChild(noCodeBtn);
          var _bph = document.createElement('span'); /* R154：无码行保留绑定键槽位（空占位），列对齐 */
          _bph.className = 'bind-slot-ph';
          codeSpan.appendChild(_bph);
        }

        // R92：绑定设备徽章（一机一码·宽松模式）——只有配了资源码的类型才统计绑定，
        // 点击打开绑定设备管理弹窗（查看清单 / 解绑）
        if (v.resourceCode && v.resourceCode.trim()) {
          var bindSpan = document.createElement('button');
          var bindN = Number(v.bindings) || 0;
          bindSpan.type = 'button';
          bindSpan.className = 'row-btn bind-slot'; /* R154：绑定键固定槽位，跨行对齐 */
          bindSpan.textContent = '资源码'; /* R223：按键文案（老板定稿，纯文字不带数字） */
          bindSpan.title = '查看该类型的资源码与绑定设备';
          bindSpan.addEventListener('click', function () { openBindings(v); });
          codeSpan.appendChild(bindSpan);
        }

        var sort = document.createElement('span');
        sort.className = 'v-sort';
        sort.textContent = '排序:' + (idx + 1);

        var editBtn = document.createElement('button');
        /* R175：加稳定类名 v-edit-btn——手机档 grid area 用 */
        editBtn.className = 'row-btn v-edit-btn';
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', function () { openVariantEdit(v); });

        var delBtn = document.createElement('button');
        /* R175：加稳定类名 v-del-btn——手机档 grid area 用 */
        delBtn.className = 'row-btn danger v-del-btn';
        delBtn.textContent = '删除';
        delBtn.addEventListener('click', function () { state._delVariantRef = v; delVariant(v.id); });

        // 拖拽事件
        item.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', idx);
          item.style.opacity = '0.5';
        });
        item.addEventListener('dragend', function () {
          item.style.opacity = '1';
          document.querySelectorAll('.variant-item').forEach(function (el) { el.style.borderTop = ''; });
        });
        item.addEventListener('dragover', function (e) {
          e.preventDefault();
          item.style.borderTop = '2px solid var(--blue1)';
        });
        item.addEventListener('dragleave', function () {
          item.style.borderTop = '';
        });
        item.addEventListener('drop', function (e) {
          e.preventDefault();
          item.style.borderTop = '';
          var fromIdx = Number(e.dataTransfer.getData('text/plain'));
          var toIdx = idx;
          if (fromIdx === toIdx || isNaN(fromIdx)) return;
          var moved = state.variants.splice(fromIdx, 1)[0];
          state.variants.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved);
          // 重新分配 sort
          state.variants.forEach(function (v2, i) { v2.sort = i + 1; });
          renderVariants();
        });

        /* v357 条5：绑定分组——名称+金额+排序一组、码+绑定一组（原有）、编辑+删除一组；换行整组走不拆散 */
        var _gMain = document.createElement('span'); _gMain.className = 'v-group v-main-group';
        _gMain.appendChild(name); if (_vipEl) _gMain.appendChild(_vipEl); _gMain.appendChild(sort);
        var _gAct = document.createElement('span'); _gAct.className = 'v-group v-act-group';
        _gAct.appendChild(editBtn); _gAct.appendChild(delBtn);
        item.appendChild(handle);
        item.appendChild(_gMain);
        item.appendChild(codeSpan);
        item.appendChild(_gAct);
        variantListEl.appendChild(item);
      });
    }

    // ========== 富文本编辑器功能 ==========
    var rteEditor = document.getElementById('fDetail');
    /* v346 条1/12：拆分后本函数定义在后续文件；调用改为"立即或等页面就绪"，避免拆分导致的"未定义" */
    if (typeof bindFileCardManagement === 'function') bindFileCardManagement(rteEditor);
    else window.addEventListener('DOMContentLoaded', function () { try { bindFileCardManagement(rteEditor); } catch (e) {} });

    // ===== 富文本统一：记忆最后编辑的编辑器与选区，弹窗(链接/图片/视频)关闭后仍能插回原位置 =====
    var __rte = { editor: null, range: null };
    // R243（用户 09-22 23:18）：条24 撤销/重做空栈禁用态更新
    function __updateUndoRedo() {
      try {
        var canUndo = document.queryCommandEnabled('undo');
        var canRedo = document.queryCommandEnabled('redo');
        document.querySelectorAll('.rte-btn[data-cmd="undo"]').forEach(function (btn) { btn.classList.toggle('disabled', !canUndo); });
        document.querySelectorAll('.rte-btn[data-cmd="redo"]').forEach(function (btn) { btn.classList.toggle('disabled', !canRedo); });
      } catch (e) { if (window.__silent) window.__silent(e); }
    }
    var __origExecCommand = document.execCommand;
    document.execCommand = function () { var ret = __origExecCommand.apply(this, arguments); __updateUndoRedo(); return ret; }; /* R243（用户 09-22 23:18）：条24 execCommand 后同步禁用态 */
    document.addEventListener('selectionchange', function () {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var el = sel.anchorNode;
      while (el && !(el.classList && el.classList.contains('rte-editor'))) el = el.parentNode;
      if (el) { __rte.editor = el; try { __rte.range = sel.getRangeAt(0).cloneRange(); } catch (e) { if (window.__silent) window.__silent(e); } }
      __updateUndoRedo(); /* R243（用户 09-22 23:18）：条24 选区变化同步禁用态 */
    });
    document.addEventListener('mousedown', function (e) {
      var bar = e.target.closest ? e.target.closest('.rte-toolbar') : null;
      if (!bar) return;
      // 按下按钮/色板/下拉显示框时阻止默认失焦，保住编辑器选区（原生 select 不阻止，保证能展开）
      if (e.target.closest('.rte-btn, .rte-palette, .cat-picker-display') && !e.target.closest('select')) e.preventDefault();
      var edId = bar.getAttribute('data-editor'), sel = window.getSelection();
      var ed0 = edId ? document.getElementById(edId) : null, inside0 = false;
      if (ed0 && sel && sel.rangeCount) {
        var p0 = sel.anchorNode;
        while (p0 && p0 !== ed0) p0 = p0.parentNode;
        if (p0 === ed0) { inside0 = true; try { __rte.range = sel.getRangeAt(0).cloneRange(); } catch (e) { if (window.__silent) window.__silent(e); } }
      }
      // 关键：点哪个编辑器的工具栏，就锁定哪个编辑器；若光标不在其中，选区置空→插入时落到末尾，避免插到别的编辑器；下拉框不置空，保选区供后续 execCommand 应用
      if (ed0) { __rte.editor = ed0; if (!inside0 && !e.target.closest('.cat-picker-display, select')) __rte.range = null; }
    });
    function rteFocusEnd(editor) {
      var r = document.createRange(); r.selectNodeContents(editor); r.collapse(false);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    // R181（第5项）：格式刷采集/应用公共函数——detail/公告/通用三处编辑器的格式刷原本各复制一份，
    // 改动需同步三处易漏改，现合并为这一份（行为与原三份逐字一致）
    function rteReadBrushStyle() {
      return {
        fontName: document.queryCommandValue('fontName'),
        fontSize: document.queryCommandValue('fontSize'),
        foreColor: document.queryCommandValue('foreColor'),
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline')
      };
    }
    function rteApplyBrushStyle(st) {
      if (st.fontName) document.execCommand('fontName', false, st.fontName);
      if (st.fontSize) document.execCommand('fontSize', false, st.fontSize);
      if (st.foreColor) document.execCommand('foreColor', false, st.foreColor);
      if (st.bold) document.execCommand('bold', false, null);
      if (st.italic) document.execCommand('italic', false, null);
      if (st.underline) document.execCommand('underline', false, null);
    }
    function rteFocusStay(editor) { /* R240（老板 09-22 19:11）：编辑器按键执行命令后焦点要回到编辑器，但绝不带动滚动——原先 focus() 无 preventScroll，浏览器会把「编辑器顶部」滚进视口，长内容里光标在下半段时屏幕就离开输入光标的位置（老板反馈"点按键或点按键里面的内容屏幕会离开光标"）。全 RTE 的命令路径统一走这里 */
      if (!editor) return;
      try { editor.focus({ preventScroll: true }); } catch (e) { editor.focus(); }
    }
    /* R240（老板 09-22 19:15）：下划线按键对链接要可加可删——Chrome 对 <a> 内执行 execCommand('underline')
       会把链接默认样式误判为「已下划线」而不肯包 <u>，所以选区完整落在同一链接内时改为手动切换 <u>；
       返回 true 表示已处理（调用方不再走 execCommand），false 交回 execCommand 照旧 */
    function rteUnderlineLink(editor) {
      if (!editor) return false;
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
      var up = function (n) { return n ? (n.nodeType === 1 ? n : n.parentNode) : null; };
      var ae = up(sel.anchorNode), fe = up(sel.focusNode);
      if (!ae || !fe || typeof ae.closest !== 'function') return false;
      var a = ae.closest('a');
      if (!a || a !== fe.closest('a') || !editor.contains(a)) return false;
      var u = a.querySelector('u');
      if (u) {
        while (u.firstChild) a.insertBefore(u.firstChild, u);
        a.removeChild(u);
      } else {
        var r = sel.getRangeAt(0);
        var frag = r.extractContents();
        var nu = document.createElement('u');
        nu.appendChild(frag);
        r.insertNode(nu);
        try { sel.removeAllRanges(); var nr = document.createRange(); nr.selectNodeContents(nu); sel.addRange(nr); } catch (e0) { if (window.__silent) window.__silent(e0); }
      }
      return true;
    }
    function rteInsert(editor, html) {
      if (!editor) return;
      var __hadSel = __rte.editor === editor && __rte.range; /* R217 条7：用户曾在该编辑器内（有选区）才 focus */
      if (__hadSel) rteFocusStay(editor); /* R217 条7：从未进入该编辑器 → 不抢焦点（光标不跳进输入框），内容经 Range 兜底静默落到末尾；R240：preventScroll 屏幕不离光标 */
      var sel = window.getSelection(), okRange = false;
      if (__hadSel) {
        try { sel.removeAllRanges(); sel.addRange(__rte.range); okRange = true; } catch (e) { okRange = false; }
      }
      var inserted = false;
      if (__hadSel) {
        try {
          inserted = document.execCommand('insertHTML', false, html);
        } catch (e) { inserted = false; }
      }
      // execCommand 失效兜底：解析节点后用 Range 插到光标处或末尾
      if (!inserted) {
        try {
          var tmp = document.createElement('div'); tmp.innerHTML = html;
          var rng = okRange ? __rte.range : null;
          if (!rng) rteFocusEnd(editor), rng = window.getSelection().getRangeAt(0);
          while (tmp.firstChild) rng.insertNode(tmp.firstChild);
          rng.collapse(false);
        } catch (e2) { editor.innerHTML += html; }
      }
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      __rte.editor = editor;
      try { __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (e) { if (window.__silent) window.__silent(e); }
    }
    // ===== R147（用户 00:56）：编辑器视频无法删除修复 =====
    // 根因：Chromium contenteditable 中点击 <video>（尤其控制条区域）不会建立元素选区，
    // 随后 Backspace/Delete 只作用于文字/无效，视频删不掉（图片无此缺陷，原生可选中）。
    // 修法：点击编辑器内视频 → selection.selectNode(video) 原子选中，退格/删除键即可整段移除。
    // R155（用户 19:41）：移动端 tap 编辑器内视频无法选中——Chromium 移动端 video 的 tap 手势不派发 click，
    // R147 的 click 委托在手机上根本不触发。touchend（capture, passive:false）tap 落在 IMG/VIDEO 上时
    // preventDefault（阻止 tap 播放手势与合成 click 双触发）+ selectNode + 浮出×。
    // R165（用户 19:06）：pointerdown(touch) 兜底——部分浏览器内核（WebView/国产壳）tap 编辑器内媒体时
    // touchend/click 合成事件被吞。pointerdown 是触摸链第一个事件、必然派发。
    // 不 preventDefault：不拦播放手势与后续 touchend/click 委托（重复执行幂等——selectNode/加 class/浮×均可重入）。
    // R171：pointerdown 只记录 tap 基准；R179：双击才选中（判定在 pointerup/touchend/dblclick）。
    var __rtePd = null;
    // R179（用户 19:24）：媒体（图片/视频/兜底卡）双击才能选中——单击不再选中（太灵敏：
    // 光标/选区扫过、滑动路过都容易误触出编辑框）。桌面走 dblclick 委托；触屏双 tap 检测
    // 两次 tap 同一媒体、间隔 <400ms 才选中。__rteLastTap 记录上一次有效 tap 供双击判定。
    var __rteLastTap = null;
    function __rteSelect(pick) {
      try {
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNode(pick);
        sel.removeAllRanges(); sel.addRange(range);
      } catch (err) { if (window.__silent) window.__silent(err); }
      if (pick.tagName === 'IMG' || pick.tagName === 'VIDEO') {
        pick.classList.add('rte-media-sel'); // R165：自绘选中框（原生蓝层越界弹窗，outline 受 contain 裁剪不越界）
        __showImgDel(pick);
      } else __hideImgDel();
    }
    function __rteDbltap(t) {
      var now = Date.now();
      if (__rteLastTap && __rteLastTap.el === t && now - __rteLastTap.at < 400) {
        __rteLastTap = null;
        __rteSelect(t);
      } else {
        __rteLastTap = { el: t, at: now };
      }
    }
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      var t = e.target;
      if (!t || !(t instanceof Element)) return;
      if (t.classList && t.classList.contains('rte-img-del')) return;
      var ed = t.closest ? t.closest('[contenteditable="true"]') : null;
      if (!ed) return;
      if (t.tagName !== 'VIDEO' && t.tagName !== 'IMG') return;
      __rtePd = { t: t, x: e.clientX, y: e.clientY };
    }, { capture: true });
    // R179：触屏 pointerup——单 tap（位移 <10px）不再直接选中，只做双 tap 判定
    document.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'mouse') return;
      if (!__rtePd) return;
      var t = __rtePd.t, x0 = __rtePd.x, y0 = __rtePd.y; __rtePd = null;
      if (t !== e.target) return; // 手指移出媒体（滑动）不算 tap
      if (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10) return;
      __rteDbltap(t);
    }, { capture: true });
    document.addEventListener('touchend', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.classList && t.classList.contains('rte-img-del')) return; // 浮层删除键自身：放行合成 click 走删除
      var ed = t.closest ? t.closest('[contenteditable="true"]') : null;
      if (!ed) return;
      var pick = null;
      if (t.tagName === 'VIDEO' || t.tagName === 'IMG') pick = t;
      if (!pick) return;
      try { e.preventDefault(); } catch (err0) { if (window.__silent) window.__silent(err0); }
      // R179：仅当 pointerup 未消费 __rtePd（老内核吞 pointer 事件）时兜底做同样的双 tap 判定；
      // pointerup 正常触发的内核这里 __rtePd 已是 null，直接跳过不重复计数
      if (__rtePd) {
        var _ct = (e.changedTouches && e.changedTouches[0]) || null;
        var _pt = __rtePd.t, _px = __rtePd.x, _py = __rtePd.y; __rtePd = null;
        if (_ct && _pt === t && (Math.abs(_ct.clientX - _px) > 10 || Math.abs(_ct.clientY - _py) > 10)) return;
        __rteDbltap(t);
      }
    }, { capture: true, passive: false });
    // R179：桌面鼠标单击不再选中媒体——只保留"点编辑器外/点到非媒体收起浮层"的清理职责；
    // 媒体选中统一交给下方 dblclick 委托（触屏双 tap 的浏览器若也派发合成 dblclick，选中幂等无副作用）
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.classList && t.classList.contains('rte-img-del')) return; // R149：浮层删除键自身，其 click 已自处理
      var ed = t.closest ? t.closest('[contenteditable="true"]') : null;
      if (!ed) { __hideImgDel(); return; } // R149：点编辑器外收起图片删除浮层
      // 点到视频/图片/兜底卡本体：不再选中（等双击），也不收浮层（避免双击第二击把刚选中的收掉）
      var pick = null;
      if (t.tagName === 'VIDEO') pick = t;
      else if (t.tagName === 'IMG') pick = t;
      else {
        var fb = t.closest ? t.closest('.video-fallback') : null;
        if (fb && !t.closest('.vf-link')) pick = fb;
      }
      if (!pick) __hideImgDel(); // R149：选中对象变了（文字区域）→ 收起浮层
    });
    // R179（用户 19:24）：媒体双击选中（桌面主路径）——dblclick 到图片/视频原子选中出编辑框；
    // 兜底卡非链接区域同款；vf-link 链接区域双击仍走跳转不选中
    document.addEventListener('dblclick', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.classList && t.classList.contains('rte-img-del')) return;
      if (t.closest && t.closest('.vf-link')) return;
      var ed = t.closest ? t.closest('[contenteditable="true"]') : null;
      if (!ed) return;
      var pick = null;
      if (t.tagName === 'VIDEO') pick = t;
      else if (t.tagName === 'IMG') pick = t; // R149（用户 02:15）：图片同步视频的选中/删除机制
      else {
        var fb = t.closest ? t.closest('.video-fallback') : null;
        if (fb) pick = fb;
      }
      if (!pick) return;
      __rteSelect(pick);
    });
    // 退格/删除键兜底：光标紧邻编辑器内视频/兜底卡时（Chromium 对 contenteditable=false 块的原生退格不可靠），手动整块删除
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      var sel = window.getSelection();
      if (!sel || !sel.isCollapsed || !sel.rangeCount) return;
      try {
        var r = sel.getRangeAt(0);
        var node = r.startContainer;
        var host = node.nodeType === 1 ? node : node.parentElement;
        var ed = host && host.closest ? host.closest('[contenteditable="true"]') : null;
        if (!ed || !ed.contains(node)) return;
        var sib = null;
        if (e.key === 'Backspace') {
          if (node.nodeType === 3 && r.startOffset === 0) sib = node.previousSibling;
          else if (node.nodeType === 1) sib = r.startOffset > 0 ? node.childNodes[r.startOffset - 1] : null;
        } else {
          if (node.nodeType === 3 && r.startOffset === (node.textContent || '').length) sib = node.nextSibling;
          else if (node.nodeType === 1) sib = r.startOffset < node.childNodes.length ? node.childNodes[r.startOffset] : null;
        }
        if (!sib) return;
        var isV = sib.nodeType === 1 && (sib.tagName === 'VIDEO' || sib.tagName === 'IMG' || (sib.classList && sib.classList.contains('video-fallback'))); // R149：图片同步退格删除
        if (!isV) return;
        e.preventDefault();
        try { sib.remove(); } catch (err2) { if (window.__silent) window.__silent(err2); }
        ed.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (err) { if (window.__silent) window.__silent(err); }
    });
    // ===== R149（用户 02:15）：编辑器图片删除键——同步 R147 视频四件套 =====
    // 图片选中（click 原子选中）时在其右上角浮出「×」删除键；形态与视频卡 .vf-del / 全局弹窗
    // 右上角 ×（.modal-close-x）同一家族：圆形、右上角、悬停红底白×、按压缩放 0.94，尺寸按宿主适配。
    // 浮层挂 body（fixed 定位跟随图片），不进编辑器 DOM → 保存/草稿/预览内容零污染（serializeDetail 无需处理）。
    var __imgDelBtn = null, __imgDelTarget = null;
    // R158（用户 22:35）：×改挂编辑器本体（absolute 同坐标系）。旧方案「挂 body fixed + z-12000 + rAF 每帧追帧」三个毛病：
    // ① fixed 不受弹窗 overflow 裁剪——×能浮到遮罩外、滑动时甚至出屏幕；② rAF 追帧与浏览器合成帧不同步，滚动中×肉眼可见地抖动/漂移；
    // ③ z-index 12000 高于一切弹窗层，×会盖在二维码等弹窗外元素上。
    // 新方案：×作为 .rte-editor（自身即滚动容器，CSS 已加 position:relative）的 absolute 子元素——与媒体同坐标系同滚动，
    // 浏览器原生同步渲染（零抖动，真·「绑」在媒体上），并被编辑器 overflow 边界裁剪（永不出屏不出弹窗）。
    // 关闭时从编辑器摘除（btn.remove()），不残留进序列化内容；__rteClean/serializeDetail 仍兜底剥离（双保险）。
    function __placeImgDel() {
      if (!__imgDelBtn || !__imgDelTarget) return;
      var host = __imgDelBtn.parentNode;
      if (!__imgDelTarget.isConnected || !host || !host.contains(__imgDelTarget) || !__imgDelBtn.isConnected) { __hideImgDel(); return; } // 媒体被删/弹窗关闭/宿主更换 → 收起
      var hr = host.getBoundingClientRect();
      var tr = __imgDelTarget.getBoundingClientRect();
      // R151 口径保留：×完全陷入媒体内部（距上/右 12px 内缩）；小媒体放不下时按剩余半宽居中，保证不出框
      var ix = Math.min(12, Math.max(0, (tr.width - 22) / 2));
      var iy = Math.min(12, Math.max(0, (tr.height - 22) / 2));
      var wantL = tr.right - 22 - ix, wantT = tr.top + iy; // 视口坐标系期望位置
      __imgDelBtn.style.left = (wantL - hr.left) + 'px';
      __imgDelBtn.style.top = (wantT - hr.top) + 'px';
      // 一次性自校准：absolute 定位基准是 host 的 padding box，与 border-box rect 存在边框/内边距差——量按钮实际位置按回差修正
      var br = __imgDelBtn.getBoundingClientRect();
      if (br.width > 0 && (Math.abs(br.left - wantL) > 0.5 || Math.abs(br.top - wantT) > 0.5)) {
        __imgDelBtn.style.left = (parseFloat(__imgDelBtn.style.left) + (wantL - br.left)) + 'px';
        __imgDelBtn.style.top = (parseFloat(__imgDelBtn.style.top) + (wantT - br.top)) + 'px';
      }
    }
    function __showImgDel(img) {
      var host = img && img.closest ? img.closest('.rte-editor') : null;
      if (!host) { __hideImgDel(); return; } // 防御：找不到编辑器宿主（理论不可达）
      if (!__imgDelBtn) {
        __imgDelBtn = document.createElement('button');
        __imgDelBtn.type = 'button';
        __imgDelBtn.className = 'rte-img-del';
        __imgDelBtn.title = '删除这个媒体';
        __imgDelBtn.setAttribute('contenteditable', 'false');
        __imgDelBtn.innerHTML = '<svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg>'; /* R285 条17：× 文字符号换固定 SVG */
        __imgDelBtn.addEventListener('click', function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          var im = __imgDelTarget;
          __hideImgDel();
          if (im && im.isConnected) {
            var ed2 = im.closest('[contenteditable="true"]');
            im.remove();
            if (ed2) { try { ed2.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) { if (window.__silent) window.__silent(e2); } }
          }
        });
        // R165（用户 19:03）：×只要单击就能删除——部分内核点按后合成 click 不派发（点不动）。
        // pointerdown 先于一切合成事件必然到达，直接删除；preventDefault 阻后续合成事件防双触发
        // （即便仍派发，此时 __imgDelTarget 已清、媒体已 remove，click 侧无操作，天然幂等）。
        __imgDelBtn.addEventListener('pointerdown', function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          var im = __imgDelTarget;
          __hideImgDel();
          if (im && im.isConnected) {
            var ed2 = im.closest('[contenteditable="true"]');
            im.remove();
            if (ed2) { try { ed2.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) { if (window.__silent) window.__silent(e2); } }
          }
        });
      }
      if (__imgDelBtn.parentNode !== host) host.appendChild(__imgDelBtn); // 切编辑器/旧编辑器 DOM 被丢弃（弹窗关闭）后重新挂载
      __imgDelTarget = img;
      __imgDelBtn.style.display = 'flex'; /* v327：flex 使 × 图标居中（原 block+line-height 会歪） */
      __placeImgDel();
    }
    function __hideImgDel() {
      if (__imgDelBtn) {
        __imgDelBtn.style.display = 'none';
        try { __imgDelBtn.remove(); } catch (e1) { if (window.__silent) window.__silent(e1); } // 摘离编辑器：内容 DOM 始终干净
      }
      try { document.querySelectorAll('.rte-media-sel').forEach(function (m) { m.classList.remove('rte-media-sel'); }); } catch (e0) { if (window.__silent) window.__silent(e0); } // R165：收起自绘选中框
      __imgDelTarget = null;
    }
    window.__hideImgDel = __hideImgDel;
    // 选区变化：只有「原子选中目标图片」才保留浮层（拖蓝选文字/光标落别处 → 收起）
    document.addEventListener('selectionchange', function () {
      if (!__imgDelBtn || !__imgDelTarget || __imgDelBtn.style.display === 'none') return;
      var keep = false;
      try {
        var sel = window.getSelection();
        if (sel && sel.rangeCount === 1) {
          var r = sel.getRangeAt(0);
          // 注意：Range.selectNode(img) 的边界落在 img 的父节点（start/end 为父节点+索引），不是 img 自身
          var pn = __imgDelTarget.parentNode;
          if (!r.collapsed && r.startContainer === pn && r.endContainer === pn && (r.endOffset - r.startOffset) === 1 && pn.childNodes[r.startOffset] === __imgDelTarget) keep = true;
        }
      } catch (e) { if (window.__silent) window.__silent(e); }
      if (!keep) __hideImgDel(); else __placeImgDel();
    });
    // R158：×挂编辑器 absolute 同坐标系——滚动由浏览器原生同步，无需任何 scroll/rAF 跟随（R155 的 rAF 循环已随重构移除）。
document.addEventListener('click', function (e) {
      var z = e.target.closest ? e.target.closest('.rte-zoom') : null;
      if (!z) return;
      var ed = document.getElementById(z.getAttribute('data-editor'));
      if (!ed) return;
      var big = ed.classList.toggle('rte-large'); var tb = ed.previousElementSibling; if (tb && tb.classList && tb.classList.contains('rte-toolbar')) { if (big) tb.classList.add('rte-toolbar-large'); else tb.classList.remove('rte-toolbar-large'); }
      if (!big) { ed.style.top = ''; ed.style.height = ''; } /* R176（用户 10:11）：还原时清放大态内联 top/height——旧版残留 top:115px 在 relative 态把编辑器视觉下移盖住下方类型区（盖住/挤到其他东西的根因） */
      z.classList.toggle('rte-zoom-on', big);
      z.innerHTML = big ? RTE_SVG_MIN : RTE_SVG_MAX; window.__syncBodyLock && window.__syncBodyLock(); // R231 条9：emoji→SVG
      if (big) {
        ed.focus();
        // 正文起点跟随工具栏底部，避免工具栏换行时遮挡内容开头
        (function () { var _tb = ed.previousElementSibling; if (_tb && _tb.classList && _tb.classList.contains('rte-toolbar')) { var _f = function () { if (!ed.classList.contains('rte-large')) return; var _b = _tb.getBoundingClientRect().bottom + 0; ed.style.top = _b + 'px'; ed.style.height = 'calc(100vh - ' + (_b + 12) + 'px)'; ed.style.height = 'calc(100dvh - ' + (_b + 12) + 'px)'; }; /* R176：二段赋值 dvh 优先（手机地址栏/软键盘收窄可视区），不支持的内核第二句被忽略自动回退 100vh */ _f(); if (window.__rteRO) window.__rteRO.disconnect(); try { window.__rteRO = new ResizeObserver(_f); window.__rteRO.observe(_tb); } catch (e) { if (window.__silent) window.__silent(e); } } })();
        // 放大态正文起点跟随工具栏底部（退出放大用工具栏"还原"或 Esc）
        setTimeout(function(){ var _le=document.querySelector('.rte-editor.rte-large'); if(_le){ var _tb2=_le.previousElementSibling; if(_tb2&&_tb2.classList&&_tb2.classList.contains('rte-toolbar')){ var _b2=_tb2.getBoundingClientRect().bottom+0; _le.style.top=_b2+'px'; _le.style.height='calc(100vh - '+(_b2+12)+'px)'; _le.style.height='calc(100dvh - '+(_b2+12)+'px)'; } } }, 80);
      }
    });
    // R176（用户 10:14）：工具栏展开键；R179b（用户 20:20）：默认收起——
    // HTML 初始挂 rte-collapsed（单行横滚），点击摘类展开成多行全显（桌面手机同款），再点还原
    document.addEventListener('click', function (e) {
      var x = e.target.closest ? e.target.closest('.rte-expand') : null;
      if (!x) return;
      var tb = x.closest('.rte-toolbar');
      if (!tb) return;
      var collapsed = tb.classList.toggle('rte-collapsed');
      x.title = collapsed ? '展开工具栏' : '收起工具栏';
      // 放大态下展开/收起改变工具栏高度，编辑器 top 需跟随；ResizeObserver(_f) 会自动重算，这里兜底补一次
      setTimeout(function () {
        var ed = document.querySelector('.rte-editor.rte-large');
        if (ed && ed.previousElementSibling === tb) {
          var _b = tb.getBoundingClientRect().bottom + 0;
          ed.style.top = _b + 'px';
          ed.style.height = 'calc(100vh - ' + (_b + 12) + 'px)';
          ed.style.height = 'calc(100dvh - ' + (_b + 12) + 'px)';
        }
      }, 30);
    });
    // Esc 退出放大编辑（不影响其它弹窗的 Esc 关闭）
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var bigEd = document.querySelector('.rte-editor.rte-large');
        if (bigEd) {
          e.__escPre = true; // R111：本次 Esc 只退出富文本放大态，__modalKit 不再关弹窗
          bigEd.classList.remove('rte-large'); bigEd.style.top = ''; bigEd.style.height = ''; var _tb = bigEd.previousElementSibling; if (_tb && _tb.classList && _tb.classList.contains('rte-toolbar-large')) _tb.classList.remove('rte-toolbar-large');
          document.querySelectorAll('.rte-zoom.rte-zoom-on').forEach(function (b) { b.classList.remove('rte-zoom-on'); b.innerHTML = RTE_SVG_MAX; }); window.__syncBodyLock && window.__syncBodyLock(); // R231 条9：emoji→SVG
          var _ex = document.getElementById('rteExitZoom'); if (_ex) _ex.style.display = 'none';
        }
      }
    });

    // 工具栏按钮点击执行命令
    document.querySelectorAll('#detailRteToolbar .rte-btn[data-cmd]').forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); }); // 防止失去焦点
      btn.addEventListener('click', function () {
        var cmd = this.dataset.cmd;
        if (__rte.editor !== rteEditor || !__rte.range) return; /* R217 条7：从未进入编辑器 → 不 focus、不执行（光标不跳输入框） */
        if (!(cmd === 'underline' && rteUnderlineLink(rteEditor))) document.execCommand(cmd, false, null); /* R240：选区在链接内时下划线手动切换 <u>（Chrome 对 <a> 误判已下划线加不回），其余命令照旧 */
        rteFocusStay(rteEditor); /* R240：preventScroll——点按键屏幕不离开光标 */
        updateRteActive();
      });
    });

    // 下拉选择（字体、字号）
    document.querySelectorAll('#detailRteToolbar .rte-select[data-cmd]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var cmd = this.dataset.cmd;
        var val = this.value;
        if (val && __rte.editor === rteEditor && __rte.range) { /* R217 条7：有选区才执行，否则只重置下拉不抢焦点 */
          document.execCommand(cmd, false, val);
          rteFocusStay(rteEditor); /* R240：preventScroll——选字体/字号屏幕不离开光标 */
        }
        this.selectedIndex = 0; // 重置选择
        syncSelectDisplay(this); // R166：同步自制下拉显示框回到默认项
      });
    });

    // 预设色板：点色块即应用（全局委托，四个编辑器统一使用）
    document.addEventListener('click', function (e) {
      var sw = e.target.closest ? e.target.closest('.palette-swatch') : null;
      if (!sw) return;
      var pal = sw.closest('.rte-palette');
      if (!pal) return;
      var editor = document.getElementById(pal.getAttribute('data-editor'));
      if (!editor) return;
      if (__rte.editor !== editor || !__rte.range) return; /* R217 条7：从未进入该编辑器 → 不 focus、不执行（光标不跳输入框） */
      rteFocusStay(editor);
      if (__rte.editor === editor && __rte.range) { try { var _ps = window.getSelection(); _ps.removeAllRanges(); _ps.addRange(__rte.range); } catch (e) { if (window.__silent) window.__silent(e); } }
      document.execCommand(pal.getAttribute('data-cmd'), false, sw.getAttribute('data-color'));
      try { __rte.editor = editor; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (e) { if (window.__silent) window.__silent(e); }
      rteFocusStay(editor);
    });

    /* ---------- R194 第一批（用户 00:02 拍板开工）：60 色面板 + 表格全套（四编辑器共用，全局一处实现） ---------- */
    var RTE60_COLORS = (function () {
      /* 10 色系（灰红橙黄绿青蓝紫粉棕）× 6 档深浅，用户拍板「全部颜色都要有一点」。
         行=色系、列=深→浅；网格渲染时转置为 列=色系、行=深→浅。 */
      var rows = [
        ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff'], // 灰
        ['#7f0000', '#b71c1c', '#e53935', '#ef5350', '#f28b82', '#ffcdd2'], // 红
        ['#bf360c', '#d84315', '#f4511e', '#ff7043', '#ffb74d', '#ffe0b2'], // 橙
        ['#827717', '#9e9d24', '#c0ca33', '#fdd835', '#ffeb3b', '#fff59d'], // 黄
        ['#1b5e20', '#2e7d32', '#43a047', '#66bb6a', '#a5d6a7', '#c8e6c9'], // 绿
        ['#006064', '#00838f', '#0097a7', '#26c6da', '#80deea', '#e0f7fa'], // 青
        ['#0d47a1', '#1565c0', '#1e88e5', '#42a5f5', '#90caf9', '#bbdefb'], // 蓝
        ['#4a148c', '#6a1b9a', '#8e24aa', '#ab47bc', '#ce93d8', '#e1bee7'], // 紫
        ['#880e4f', '#ad1457', '#c2185b', '#ec407a', '#f48fb1', '#f8bbd0'], // 粉
        ['#3e2723', '#4e342e', '#6d4c41', '#8d6e63', '#bcaaa4', '#d7ccc8']  // 棕
      ];
      var cells = [];
      for (var c = 0; c < 6; c++) for (var r = 0; r < 10; r++) cells.push(rows[r][c]);
      return cells; // 顺序即网格顺序：第 c 行（深→浅档位）× 10 色系
    })();

    var RTE_POP = null; // 当前打开的浮层（颜色面板 / 表格选择器），全局唯一
    function rteClosePop() { if (RTE_POP) { RTE_POP.remove(); RTE_POP = null; } }
    function rtePlacePop(pop, anchor) {
      pop.__anchor = anchor; /* R240：记下触发键——滚动/缩放时浮层实时贴回按键旁（见下方 R240 锚定跟随机制） */
      document.body.appendChild(pop);
      var r = anchor.getBoundingClientRect();
      var pw = pop.offsetWidth, ph = pop.offsetHeight;
      var left = r.left + r.width / 2 - pw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
      var top = r.bottom + 6;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    }
    /* R240（老板 09-22 19:15）：浮层锚定跟随——原先 RTE 浮层（60色板/表情/表格）与字体字号下拉面板
       都只在上翻开的一瞬间定位一次；之后用户滑动弹窗，触发键跟着内容滚走，浮层却滞留原地，
       老板反馈"我滑动弹窗，这选择框怎么会跟随我的滑动呢，它应该固定在表情按键旁才对，检查其他按键
       是否也有这种情况，都要统一修复"。修法：打开期间监听全系统滚动（弹窗内滚/编辑器内滚/窗口滚，
       capture 捕获非冒泡的 scroll）与 resize，rAF 节流后统一把所有打开中的浮层/面板按触发键
       当前位置重新贴位（固定在按键旁）；触发键滚出可视区域（含被滚动容器裁剪）即自动收起。 */
    (function () {
      function __rteAnchorVisible(el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
        var p = el.parentNode;
        while (p && p !== document.body) { /* 沿祖先找可滚/裁剪容器，矩形不相交即已被裁出视野 */
          if (p.nodeType === 1) {
            var ov = ''; try { ov = getComputedStyle(p).overflowY; } catch (e0) { if (window.__silent) window.__silent(e0); }
            if ((ov === 'auto' || ov === 'scroll' || ov === 'hidden') && p.scrollHeight > p.clientHeight + 1) {
              var pr = p.getBoundingClientRect();
              if (r.top >= pr.bottom || r.bottom <= pr.top || r.right <= pr.left || r.left >= pr.right) return false;
            }
          }
          p = p.parentNode;
        }
        return true;
      }
      var __raf = 0;
      function __repos() {
        __raf = 0;
        try {
          if (RTE_POP && RTE_POP.__anchor) {
            if (__rteAnchorVisible(RTE_POP.__anchor)) rtePlacePop(RTE_POP, RTE_POP.__anchor);
            else rteClosePop();
          }
          document.querySelectorAll('.select-picker.open, .cat-picker.open').forEach(function (pk) {
            var disp = pk.querySelector('.cat-picker-display');
            if (!disp) return;
            if (__rteAnchorVisible(disp)) positionCatPanel(pk);
            else {
              pk.classList.remove('open');
              var pp = pk.querySelector('.cat-picker-panel');
              if (!pp && pk.dataset.pickerId) pp = document.querySelector('.cat-picker-panel[data-picker-id="' + pk.dataset.pickerId + '"]');
              if (pp) { if (pp.parentNode !== pk) pk.appendChild(pp); pp.classList.remove('open'); }
            }
          });
        } catch (e) { if (window.__silent) window.__silent(e); }
      }
      window.addEventListener('scroll', function () { if (!__raf) __raf = requestAnimationFrame(__repos); }, true);
      window.addEventListener('resize', function () { if (!__raf) __raf = requestAnimationFrame(__repos); });
    })();
    function rteApplyCmd(editor, cmd, val) {
      /* R217 条7（老板 09-21）：点工具栏按钮不应把光标跳进输入框。根因→旧实现开头无条件
         editor.focus()，用户从未点进编辑器时点按钮也会把光标强制跳进编辑区开头。
         修法→只有「用户曾在该编辑器内建立过选区」（__rte.editor 对得上且有 range，由
         selectionchange 在点进编辑器时记录）才恢复选区执行；否则直接不执行、不 focus。 */
      if (__rte.editor !== editor || !__rte.range) return;
      rteFocusStay(editor); /* R240：preventScroll——点浮层里的内容（表情/颜色/表格/引用）屏幕不离开光标 */
      try { var ps = window.getSelection(); ps.removeAllRanges(); ps.addRange(__rte.range); } catch (e) { if (window.__silent) window.__silent(e); }
      document.execCommand(cmd, false, val);
      try { __rte.editor = editor; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (e) { if (window.__silent) window.__silent(e); }
    }

    /* 60 色面板：点工具栏颜色键弹出（复用资源码下拉同款白卡 .rte-pop） */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.rte-color-btn') : null;
      if (!btn) return;
      e.preventDefault();
      if (RTE_POP && RTE_POP.getAttribute('data-for') === btn.getAttribute('data-editor') + ':' + btn.getAttribute('data-color-cmd')) { rteClosePop(); return; }
      rteClosePop();
      var editor = document.getElementById(btn.getAttribute('data-editor'));
      if (!editor) return;
      var cmd = btn.getAttribute('data-color-cmd');
      var pop = document.createElement('div');
      pop.className = 'rte-pop color-pop';
      pop.setAttribute('data-for', btn.getAttribute('data-editor') + ':' + cmd);
      var head = document.createElement('div');
      head.className = 'rte-pop-head';
      head.innerHTML = '<span class="rte-pop-title">' + (cmd === 'foreColor' ? '文字颜色' : '背景颜色') + '</span>';
      var clr = document.createElement('button');
      clr.type = 'button'; clr.className = 'rte-pop-clear'; clr.textContent = '清除颜色';
      clr.addEventListener('click', function () {
        rteApplyCmd(editor, cmd, cmd === 'foreColor' ? '#333333' : 'transparent');
        rteClosePop();
      });
      head.appendChild(clr);
      pop.appendChild(head);
      var grid = document.createElement('div');
      grid.className = 'color-pop-grid';
      RTE60_COLORS.forEach(function (color) {
        var cell = document.createElement('div');
        cell.className = 'color-pop-cell';
        cell.style.background = color;
        cell.setAttribute('data-color', color);
        if (color === '#ffffff') cell.style.borderColor = 'var(--border)'; /* R285 条45：格子边框接颜色本子 */
        cell.title = color;
        cell.addEventListener('click', function () {
          rteApplyCmd(editor, cmd, color);
          rteClosePop();
        });
        grid.appendChild(cell);
      });
      pop.appendChild(grid);
      RTE_POP = pop;
      rtePlacePop(pop, btn);
      pop.offsetHeight; /* R243（用户 09-22 23:18）：条11 强制回流触发过渡 */
      pop.style.opacity = ''; /* R243（用户 09-22 23:18）：条11 淡入 */
      pop.style.transform = ''; /* R243（用户 09-22 23:18）：条11 归位 */
    });

    /* ---------- 表格全套：插入选择器 / 操作条 7 键 / 合并拆分 / 行列增删 / 列宽拖拽 ---------- */
    /* 网格映射：把含 colspan/rowspan 的表展开成 grid[r][c]=td，所有行列运算统一走它 */
    function rteTblGrid(table) {
      /* 把含 colspan/rowspan 的表展开成 grid[r][c]=td，所有行列运算统一走它 */
      var rows = table.rows, grid = [];
      var maxC = 0;
      for (var r = 0; r < rows.length; r++) {
        var idx = 0;
        for (var c = 0; c < rows[r].cells.length; c++) {
          var td = rows[r].cells[c], cs2 = td.colSpan || 1, rs2 = td.rowSpan || 1;
          while (idx < maxC && grid[r] && grid[r][idx]) idx++;
          for (var rr = r; rr < r + rs2; rr++) {
            if (!grid[rr]) grid[rr] = [];
            for (var cc = idx; cc < idx + cs2; cc++) grid[rr][cc] = td;
          }
          idx += cs2;
        }
        maxC = Math.max(maxC, (grid[r] || []).length); /* 修复：keys 取的是最大索引会少 1，length 才是列数 */
      }
      return { grid: grid, rows: rows.length, cols: Math.max(maxC, 0), table: table };
    }
    function rteTblAt(editor) { // 光标所在 td / 所在 table
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) return null;
      var node = sel.getRangeAt(0).startContainer;
      var el = node.nodeType === 1 ? node : node.parentNode;
      var td = el && el.closest ? el.closest('td,th') : null;
      if (td && editor.contains(td)) {
        var table = td.closest('table');
        if (table && editor.contains(table)) return { td: td, table: table };
      }
      return null;
    }

    /* 插入选择器：6×6 hover 网格 + 自定义行列输入（R209 用户 09-19 00:30：需求→实现） */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.rte-table-btn') : null;
      if (!btn) return;
      e.preventDefault();
      rteClosePop();
      var editor = document.getElementById(btn.getAttribute('data-editor'));
      if (!editor) return;
      var pop = document.createElement('div');
      pop.className = 'rte-pop';
      pop.setAttribute('data-for', 'tblgrid:' + btn.getAttribute('data-editor'));
      var grid = document.createElement('div');
      grid.className = 'tbl-grid-pop';
      var tip = document.createElement('div');
      tip.className = 'tbl-grid-tip'; tip.textContent = '1 × 1';
      for (var r = 1; r <= 6; r++) for (var c = 1; c <= 6; c++) {
        (function (r, c) {
          var cell = document.createElement('div');
          cell.className = 'tbl-grid-cell';
          cell.addEventListener('mouseenter', function () {
            Array.prototype.forEach.call(grid.children, function (el) {
              var er = +el.getAttribute('data-r'), ec = +el.getAttribute('data-c');
              el.classList.toggle('hl', er <= r && ec <= c);
            });
            tip.textContent = r + ' 行 × ' + c + ' 列';
          });
          cell.addEventListener('click', function () {
            var html = '<table><tbody>';
            for (var i = 0; i < r; i++) { html += '<tr>'; for (var j = 0; j < c; j++) html += '<td><br></td>'; html += '</tr>'; }
            html += '</tbody></table><p><br></p>';
            rteApplyCmd(editor, 'insertHTML', html);
            rteClosePop();
          });
          cell.setAttribute('data-r', r); cell.setAttribute('data-c', c);
          grid.appendChild(cell);
        })(r, c);
      }
      pop.appendChild(grid); pop.appendChild(tip);
      // R209（用户 09-19 00:30）：自定义行列输入
      var customRow = document.createElement('div');
      customRow.className = 'tbl-custom-row';
      var rowLabel = document.createElement('span');
      rowLabel.textContent = '行';
      var rowInp = document.createElement('input');
      rowInp.type = 'number'; rowInp.min = '1'; rowInp.max = '50'; rowInp.value = '1'; /* R229（用户 09-21 19:51）：行列默认 1×1（原 3） */
      rowInp.className = 'tbl-custom-input';
      rowInp.setAttribute('aria-label', '行数');
      var colLabel = document.createElement('span');
      colLabel.textContent = '列';
      var colInp = document.createElement('input');
      colInp.type = 'number'; colInp.min = '1'; colInp.max = '50'; colInp.value = '1'; /* R229：同上 */
      colInp.className = 'tbl-custom-input';
      colInp.setAttribute('aria-label', '列数');
      var okBtn = document.createElement('button');
      okBtn.type = 'button'; okBtn.className = 'tbl-custom-btn';
      okBtn.textContent = '确定';
      okBtn.addEventListener('click', function () {
        var rows = parseInt(rowInp.value, 10) || 0;
        var cols = parseInt(colInp.value, 10) || 0;
        if (rows < 1 || rows > 50 || cols < 1 || cols > 50) {
          toast('行数和列数请在 1-50 之间', 'error');
          return;
        }
        var html = '<table><tbody>';
        for (var i = 0; i < rows; i++) { html += '<tr>'; for (var j = 0; j < cols; j++) html += '<td><br></td>'; html += '</tr>'; }
        html += '</tbody></table><p><br></p>';
        rteApplyCmd(editor, 'insertHTML', html);
        rteClosePop();
      });
      customRow.appendChild(rowLabel); customRow.appendChild(rowInp);
      customRow.appendChild(colLabel); customRow.appendChild(colInp);
      customRow.appendChild(okBtn);
      pop.appendChild(customRow);
      RTE_POP = pop;
      rtePlacePop(pop, btn);
    });

    /* 操作条：光标进表即浮现，7 键 = 加行/删行/加列/删列/合并/拆分/删表（用户 23:46 拍板） */
    var TBL_OPBAR = null;
    function rteCloseOpbar() { if (TBL_OPBAR) { TBL_OPBAR.remove(); TBL_OPBAR = null; } }
    function rteShowOpbar(editor, table) {
      rteCloseOpbar();
      var bar = document.createElement('div');
      bar.className = 'tbl-opbar';
      var ops = [
        ['加行', rteTblAddRow], ['删行', rteTblDelRow], ['加列', rteTblAddCol], ['删列', rteTblDelCol],
        ['合并', rteTblMerge], ['拆分', rteTblSplit], ['删表', rteTblDelTable, 'tbl-op-danger']
      ];
      ops.forEach(function (op) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = op[0];
        if (op[2]) b.className = op[2];
        b.addEventListener('mousedown', function (ev) { ev.preventDefault(); }); // 保住编辑区选区/光标
        b.addEventListener('click', function () { op[1](editor); });
        bar.appendChild(b);
      });
      document.body.appendChild(bar);
      var rect = table.getBoundingClientRect();
      var top = rect.top - bar.offsetHeight - 6;
      if (top < 8) top = Math.min(rect.bottom + 6, window.innerHeight - bar.offsetHeight - 8);
      var left = Math.max(8, Math.min(rect.left, window.innerWidth - bar.offsetWidth - 8));
      bar.style.top = top + 'px'; bar.style.left = left + 'px';
      TBL_OPBAR = bar;
    }
    /* 选区在编辑器表格内变化时：定位操作条 + 跨格选中给高亮 */
    function rteTblSelectionChange() {
      var openEditors = document.querySelectorAll('.rte-editor');
      var found = null;
      for (var i = 0; i < openEditors.length; i++) {
        var at = rteTblAt(openEditors[i]);
        if (at) { found = { editor: openEditors[i], at: at }; break; }
      }
      document.querySelectorAll('.tbl-cell-sel').forEach(function (el) { el.classList.remove('tbl-cell-sel'); });
      if (!found) { rteCloseOpbar(); return; }
      rteShowOpbar(found.editor, found.at.table);
      // 跨格选中（合并预览）：同一表内被选区覆盖的 td 高亮
      var sel = window.getSelection();
      if (sel && sel.rangeCount && !sel.isCollapsed) {
        var range = sel.getRangeAt(0);
        var tds = found.at.table.querySelectorAll('td,th');
        Array.prototype.forEach.call(tds, function (td) {
          try { if (range.intersectsNode(td)) td.classList.add('tbl-cell-sel'); } catch (e) { if (window.__silent) window.__silent(e); }
        });
      }
    }
    document.addEventListener('selectionchange', rteTblSelectionChange);
    window.addEventListener('scroll', function () { rteCloseOpbar(); }, true);
    document.addEventListener('click', function (e) {
      if (TBL_OPBAR && !TBL_OPBAR.contains(e.target) && !e.target.closest('.rte-editor')) rteCloseOpbar();
    });

    /* —— 行列运算（全部基于 grid 映射，处理 colspan/rowspan 基础正确性） —— */
    function rteTblAddRow(editor) {
      var at = rteTblAt(editor); if (!at) return;
      var g = rteTblGrid(at.table); var td = at.td;
      // 光标格起始行
      var r0 = 0; outer: for (var r = 0; r < g.rows; r++) { if (g.grid[r] && g.grid[r].indexOf(td) !== -1) { r0 = r; break outer; } }
      var newRow = at.table.insertRow(r0 + 1);
      for (var c = 0; c < g.cols; c++) {
        var above = g.grid[r0] ? g.grid[r0][c] : null; // 参考行格
        // 若该列被更上方行的 rowspan 跨入新行位置，跳过（由原格继续覆盖）
        var covered = false;
        if (g.grid[r0 + 1] && g.grid[r0 + 1][c] && g.grid[r0 + 1][c] !== undefined) {
          var cov = g.grid[r0 + 1][c];
          var covRow = -1;
          for (var rr = 0; rr <= r0; rr++) if (g.grid[rr] && g.grid[rr][c] === cov) { covRow = rr; break; }
          if (covRow !== -1 && covRow !== r0 + 1) covered = true;
        }
        if (covered) continue;
        var nc = newRow.insertCell(-1);
        nc.colSpan = above && above.colSpan > 1 ? above.colSpan : 1;
        nc.innerHTML = '<br>';
      }
    }
    function rteTblDelRow(editor) {
      var at = rteTblAt(editor); if (!at) return;
      var g = rteTblGrid(at.table); var td = at.td;
      var r0 = 0; outer: for (var r = 0; r < g.rows; r++) { if (g.grid[r] && g.grid[r].indexOf(td) !== -1) { r0 = r; break outer; } }
      // 本行涉及的 unique 单元格：起始行<r0 的（跨入）rowspan--；起始行==r0 的整格删除
      var seen = {};
      for (var c = 0; c < g.cols; c++) {
        var cell = g.grid[r0] ? g.grid[r0][c] : null;
        if (!cell || seen[cell._rteId]) continue;
        var id = cell._rteId || (cell._rteId = 'c' + Math.random());
        seen[id] = 1;
        var startRow = -1;
        for (var rr = 0; rr < r0; rr++) { if (g.grid[rr] && g.grid[rr][c] === cell) { startRow = rr; break; } }
        if (startRow !== -1 && startRow < r0) {
          if ((cell.rowSpan || 1) > 1) cell.rowSpan = (cell.rowSpan || 1) - 1; else cell.parentNode.removeChild(cell);
        } else if (startRow === -1 || startRow === r0) {
          // 起始行即本行（含跨多行）：整格删除
          cell.parentNode && cell.parentNode.removeChild(cell);
        }
      }
      // 移除可能残留的空行
      for (var i = at.table.rows.length - 1; i >= 0; i--) {
        if (!at.table.rows[i].cells.length) at.table.deleteRow(i);
      }
      if (!at.table.rows.length) { at.table.parentNode && at.table.parentNode.removeChild(at.table); rteCloseOpbar(); }
    }
    function rteTblAddCol(editor) {
      var at = rteTblAt(editor); if (!at) return;
      var g = rteTblGrid(at.table); var td = at.td;
      var c0 = 0;
      for (var r = 0; r < g.rows; r++) if (g.grid[r] && g.grid[r].indexOf(td) !== -1) { c0 = g.grid[r].indexOf(td); break; }
      var newC = c0 + (td.colSpan || 1); // 新列插在光标格右侧
      for (var r2 = 0; r2 < g.rows; r2++) {
        var row = at.table.rows[r2]; if (!row) continue;
        var cover = g.grid[r2] ? g.grid[r2][newC] : null; // 该行 newC 位置的格
        if (cover) {
          // cover 在该行的起始列（第一次出现的 index）
          var startC = -1;
          for (var k = 0; k < newC; k++) if (g.grid[r2][k] === cover) { startC = k; break; }
          if (startC !== -1 && startC < newC && (cover.colSpan || 1) > 1) {
            cover.colSpan = (cover.colSpan || 1) + 1; // 横向合并格覆盖到新列 → 直接扩
            continue;
          }
          // cover 起始于 newC（普通格）→ 在它前面插入空格
          var insertIdx = Array.prototype.indexOf.call(row.cells, cover);
          var nc = insertIdx >= 0 ? row.insertCell(insertIdx) : row.insertCell(-1);
          nc.innerHTML = '<br>';
        } else {
          // 该行 newC 无格（被上方 rowspan 跨入的合并格竖向覆盖或行尾）→ 行尾补空格
          var nc2 = row.insertCell(-1);
          nc2.innerHTML = '<br>';
        }
      }
    }
    function rteTblDelCol(editor) {
      var at = rteTblAt(editor); if (!at) return;
      var g = rteTblGrid(at.table); var td = at.td;
      var c0 = 0;
      for (var r = 0; r < g.rows; r++) if (g.grid[r] && g.grid[r].indexOf(td) !== -1) { c0 = g.grid[r].indexOf(td); break; }
      var seen = {};
      for (var r2 = 0; r2 < g.rows; r2++) {
        var cell = g.grid[r2] ? g.grid[r2][c0] : null;
        if (!cell) continue;
        var id = cell._rteId || (cell._rteId = 'c' + Math.random());
        if (seen[id]) continue;
        seen[id] = 1;
        if ((cell.colSpan || 1) > 1) cell.colSpan = (cell.colSpan || 1) - 1;
        else cell.parentNode && cell.parentNode.removeChild(cell);
      }
      if (!at.table.rows.length || !at.table.rows[0].cells.length) { at.table.parentNode && at.table.parentNode.removeChild(at.table); rteCloseOpbar(); }
    }
    /* 合并：选区覆盖的矩形区域并一格（仅无合并基础上精确；文字按行拼接保留） */
    function rteTblMerge(editor) {
      var at = rteTblAt(editor); if (!at) return;
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      // 锚点格/焦点格 = 拖选对角（支持反向拖），矩形 = 两格在 grid 上的坐标范围
      function cellOf(node) {
        var el = node && (node.nodeType === 1 ? node : node.parentNode);
        var td = el && el.closest ? el.closest('td,th') : null;
        return (td && at.table.contains(td)) ? td : null;
      }
      var aTd = cellOf(sel.anchorNode), fTd = cellOf(sel.focusNode);
      if (!aTd || !fTd) { toast('请先在表格里拖选要合并的多个单元格', 'info'); return; }
      var g = rteTblGrid(at.table);
      function posOf(td) {
        for (var r = 0; r < g.rows; r++) if (g.grid[r]) {
          var ci = g.grid[r].indexOf(td);
          if (ci !== -1) return { r: r, c: ci };
        }
        return null;
      }
      var pa = posOf(aTd), pf = posOf(fTd);
      if (!pa || !pf) return;
      var rmin = Math.min(pa.r, pf.r), rmax = Math.max(pa.r, pf.r);
      var cmin = Math.min(pa.c, pf.c), cmax = Math.max(pa.c, pf.c);
      // 收集矩形内全部格；若某格自身跨度越出矩形，扩边到完全包含（防半格合并破表）
      var picked = [], guard = 0, changed = true;
      while (changed && guard++ < 4) {
        changed = false; picked = [];
        for (var r = rmin; r <= rmax; r++) for (var c = cmin; c <= cmax; c++) {
          var td = g.grid[r] ? g.grid[r][c] : null;
          if (!td || picked.indexOf(td) !== -1) continue;
          picked.push(td);
          var span = { r0: 1e9, r1: -1, c0: 1e9, c1: -1 };
          for (var rr = 0; rr < g.rows; rr++) if (g.grid[rr]) {
            var cc = g.grid[rr].indexOf(td);
            if (cc !== -1) { span.r0 = Math.min(span.r0, rr); span.r1 = Math.max(span.r1, rr); span.c0 = Math.min(span.c0, cc); span.c1 = Math.max(span.c1, cc); }
          }
          if (span.r0 < rmin) { rmin = span.r0; changed = true; }
          if (span.r1 > rmax) { rmax = span.r1; changed = true; }
          if (span.c0 < cmin) { cmin = span.c0; changed = true; }
          if (span.c1 > cmax) { cmax = span.c1; changed = true; }
        }
      }
      if (picked.length < 2) { toast('请先在表格里拖选要合并的多个单元格', 'info'); return; }
      // 内容按行拼接，全并进矩形左上格
      var first = g.grid[rmin][cmin];
      var parts = [];
      for (var r2 = rmin; r2 <= rmax; r2++) {
        var line = [], seenRow = [];
        for (var c2 = cmin; c2 <= cmax; c2++) {
          var t2 = g.grid[r2] ? g.grid[r2][c2] : null;
          if (!t2 || seenRow.indexOf(t2) !== -1) continue;
          seenRow.push(t2);
          var txt = t2.innerHTML.replace(/<br\s*\/?>(\s*<br\s*\/?>)*/g, '').trim();
          if (txt) line.push(txt);
        }
        if (line.length) parts.push(line.join(' '));
      }
      first.innerHTML = parts.join('<br>') || '<br>';
      first.colSpan = cmax - cmin + 1; first.rowSpan = rmax - rmin + 1;
      picked.forEach(function (td) { if (td !== first && td.parentNode) td.parentNode.removeChild(td); });
      sel.removeAllRanges();
      var nr = document.createRange(); nr.selectNodeContents(first); nr.collapse(true);
      sel.addRange(nr);
    }
    /* 拆分：光标所在格 colspan/rowspan 还原成独立空格，原内容留在第一格 */
    function rteTblSplit(editor) {
      var at = rteTblAt(editor); if (!at) return;
      var td = at.td, cs = td.colSpan || 1, rs = td.rowSpan || 1;
      if (cs === 1 && rs === 1) { toast('当前单元格没有合并过，无需拆分', 'info'); return; }
      var g = rteTblGrid(at.table);
      var r0 = 0, c0 = 0;
      outer2: for (var r = 0; r < g.rows; r++) { if (g.grid[r]) { var ci = g.grid[r].indexOf(td); if (ci !== -1) { r0 = r; c0 = ci; break outer2; } } }
      td.colSpan = 1; td.rowSpan = 1;
      for (var rr = 0; rr < rs; rr++) for (var cc = 0; cc < cs; cc++) {
        if (rr === 0 && cc === 0) continue;
        var row = at.table.rows[r0 + rr] || at.table.rows[at.table.rows.length - 1];
        if (!row) continue;
        var refTd = g.grid[r0 + rr] ? g.grid[r0 + rr][c0 + cs] : null;
        var insertIdx = refTd ? Array.prototype.indexOf.call(row.cells, refTd) : -1;
        var nc = insertIdx >= 0 ? row.insertCell(insertIdx) : row.insertCell(-1);
        nc.innerHTML = '<br>';
      }
      // 修正可能缺行的极端情况
      while (at.table.rows.length < g.rows + rs - 1) at.table.insertRow(-1);
    }
    function rteTblDelTable(editor) {
      var at = rteTblAt(editor); if (!at) return;
      /* R231 条27（老板修正）：原生 confirm 换全站统一确认弹窗；正文只写「确定删除整个表格？」，不写撤销提示 */
      showConfirm('删除表格', '确定删除整个表格？', function (closeConfirm) {
        closeConfirm();
        at.table.parentNode && at.table.parentNode.removeChild(at.table);
        rteCloseOpbar();
      });
    }

    /* 列宽拖拽：td 右边缘 6px 热区，拖动落 width 到该列全部格 */
    (function () {
      var resizing = null;
      document.addEventListener('mousemove', function (e) {
        if (resizing) {
          var w = Math.max(40, e.clientX - resizing.startX + resizing.startW);
          resizing.tds.forEach(function (td) { td.style.width = w + 'px'; });
          e.preventDefault();
          return;
        }
        var el = e.target;
        if (el && el.closest && (el.tagName === 'TD' || el.tagName === 'TH') && el.closest('.rte-editor')) {
          var rect = el.getBoundingClientRect();
          if (rect.width && e.clientX > rect.right - 6 && e.clientX < rect.right + 4) el.style.cursor = 'col-resize';
          else el.style.cursor = '';
        }
      });
      document.addEventListener('mousedown', function (e) {
        var el = e.target;
        if (!el || !el.closest || !el.closest('.rte-editor') || (el.tagName !== 'TD' && el.tagName !== 'TH')) return;
        var rect = el.getBoundingClientRect();
        if (!(rect.width && e.clientX > rect.right - 6 && e.clientX < rect.right + 4)) return;
        var table = el.closest('table');
        var g = rteTblGrid(table);
        var c0 = 0, found = false;
        for (var r = 0; r < g.rows && !found; r++) { if (g.grid[r]) { var ci = g.grid[r].indexOf(el); if (ci !== -1) { c0 = ci; found = true; } } }
        if (!found) return;
        var tds = [];
        for (var r2 = 0; r2 < g.rows; r2++) { var t = g.grid[r2] ? g.grid[r2][c0] : null; if (t && tds.indexOf(t) === -1) tds.push(t); }
        resizing = { tds: tds, startX: e.clientX, startW: rect.width };
        table.classList.add('rte-col-resizing');
        e.preventDefault();
      });
      document.addEventListener('mouseup', function () {
        if (resizing) {
          resizing.tds[0] && resizing.tds[0].closest('table').classList.remove('rte-col-resizing');
          resizing = null;
        }
      });
    })();
    /* 点击浮层外收起（颜色面板/表格选择器共用） */
    document.addEventListener('mousedown', function (e) {
      if (RTE_POP && !RTE_POP.contains(e.target) && !e.target.closest('.rte-color-btn') && !e.target.closest('.rte-table-btn') && !e.target.closest('.rte-emoji-btn')) rteClosePop();
    }, true);

    /* ---------- R194 第二批（用户 00:37 拍板）：表情面板 6 类×60 + 引用块 + 复选框 + 撤销重做 + 字数统计 + 粘贴清理 ---------- */
    /* 表情库：6 类各 60 个（笑脸/手势/动物自然/食物/活动物品/符号庆祝） */
    var RTE_EMOJIS = {
      '笑脸': ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','😗','😙','😚','🙂','🤗','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','🙃','🤑','🤡','🤥','🤭','🤫','🤮','🥵','🥶','🥴','😵','🤯','🥳','🥺','😢','😭','😤','😠'],
      '手势': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🤳','🫱','🫲','🫳','🫴','🫰','👀','👁','👂','👃','👅','👤','👥','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','💃','🕺','👯','🫂'],
      '动物自然': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦗','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐘','🦒','🦘','🦏','🦛','🐫','🦙','🦥','🦦'],
      '食物': ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🌮','🌯','🥙','🧆','🍜','🍝','🍣','🍱','🍛','🍙','🍚'],
      '活动物品': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏','🥊','🥋','🎽','⛳','⛸️','🎣','🤿','🎿','🛷','🥌','🎯','🪀','🪁','🎮','🕹️','🎲','🧩','🧸','🪆','🖼️','🎨','🧵','🪡','🧶','🎫','🏆','🥇','🥈','🥉','🏅','🎖️','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','📱','💻','⌨️'],
      '符号庆祝': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','✨','⭐','🌟','💫','⚡️','🔥','💥','💯','🎉','🎊','🎈','🎁','🥂','🍻','🍾','🎂','🍰','🧁','👑','🔔','🎵','🎶','💤','💬','💭','🗯️','♠️','♥️','♦️','♣️','🔶','🔷','🔹','🔺','🔻','⭕','❌','❗','❓','✅','🚀'],
    };
    /* 新增浮层类按钮：mousedown 阻止抢焦点，保住编辑器选区（与既有 data-cmd 按钮同口径） */
    document.addEventListener('mousedown', function (e) {
      if (e.target.closest && e.target.closest('.rte-emoji-btn,.rte-quote-btn,.rte-check-btn')) e.preventDefault();
    }, true);

    /* 表情面板：点表情键弹出（复用 .rte-pop 白卡 + 分类 tab + 60 格网格；点击插入不收起，可连续插入） */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.rte-emoji-btn') : null;
      if (!btn) return;
      e.preventDefault();
      var editor = document.getElementById(btn.getAttribute('data-editor'));
      if (!editor) return;
      var forKey = btn.getAttribute('data-editor') + ':emoji';
      if (RTE_POP && RTE_POP.getAttribute('data-for') === forKey) { rteClosePop(); return; }
      rteClosePop();
      var cats = Object.keys(RTE_EMOJIS);
      var pop = document.createElement('div');
      pop.className = 'rte-pop emoji-pop';
      pop.setAttribute('data-for', forKey);
      pop.style.opacity = '0'; /* R243（用户 09-22 23:18）：条11 初始透明 */
      pop.style.transform = 'translateY(4px)'; /* R243（用户 09-22 23:18）：条11 初始下移 4px */
      var tabs = document.createElement('div');
      tabs.className = 'emoji-tabs';
      var grid = document.createElement('div');
      grid.className = 'emoji-pop-grid';
      function renderCat(cat) {
        grid.innerHTML = '';
        RTE_EMOJIS[cat].forEach(function (em) {
          var cell = document.createElement('div');
          cell.className = 'emoji-cell';
          cell.textContent = em;
          cell.title = em;
          cell.addEventListener('click', function () {
            rteApplyCmd(editor, 'insertHTML', em);
            rteClosePop();
          });
          grid.appendChild(cell);
        });
      }
      cats.forEach(function (cat, i) {
        var tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'emoji-tab' + (i === 0 ? ' active' : '');
        tab.textContent = cat;
        tab.addEventListener('click', function () {
          tabs.querySelectorAll('.emoji-tab').forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          renderCat(cat);
        });
        tabs.appendChild(tab);
      });
      renderCat(cats[0]);
      pop.appendChild(tabs);
      pop.appendChild(grid);
      RTE_POP = pop;
      rtePlacePop(pop, btn);
      pop.offsetHeight; /* R243（用户 09-22 23:18）：条11 强制回流触发过渡 */
      pop.style.opacity = ''; /* R243（用户 09-22 23:18）：条11 淡入 */
      pop.style.transform = ''; /* R243（用户 09-22 23:18）：条11 归位 */
    });

    /* 引用块：formatBlock 切换 blockquote/p（再点一次取消引用） */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.rte-quote-btn') : null;
      if (!btn) return;
      e.preventDefault();
      var editor = document.getElementById(btn.getAttribute('data-editor'));
      if (!editor) return;
      if (__rte.editor !== editor || !__rte.range) return; /* R217 条7：从未进入该编辑器 → 不 focus、不执行（光标不跳输入框） */
      rteFocusStay(editor); /* R240：preventScroll */
      if (__rte.editor === editor && __rte.range) { try { var ps = window.getSelection(); ps.removeAllRanges(); ps.addRange(__rte.range); } catch (err) { if (window.__silent) window.__silent(err); } }
      var sel = window.getSelection();
      var bq = null;
      if (sel && sel.rangeCount) {
        var n = sel.getRangeAt(0).startContainer;
        var el = n.nodeType === 1 ? n : n.parentNode;
        bq = el && el.closest ? el.closest('blockquote') : null;
        if (bq && !editor.contains(bq)) bq = null;
      }
      document.execCommand('formatBlock', false, bq ? 'p' : 'blockquote');
      try { __rte.editor = editor; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (err) { if (window.__silent) window.__silent(err); }
      rteFocusStay(editor); /* R240：preventScroll */
    });

    /* R215 条4（老板 09-21）：复选框改为真 <input type=checkbox>——此前插入 '☐ ' 纯字符，
       又小又点不了；真 input 与文字同高（CSS 1em）、可点击勾选，前台 sanitizeHTML 已放行 INPUT */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.rte-check-btn') : null;
      if (!btn) return;
      e.preventDefault();
      var editor = document.getElementById(btn.getAttribute('data-editor'));
      if (!editor) return;
      rteApplyCmd(editor, 'insertHTML', '<input type="checkbox" class="rte-check">');
    });

    /* 字数统计：四处编辑器下方计数条，MutationObserver 驱动（输入/工具栏改动都刷新） */
    // R209（用户 09-19 00:50）：根因→setAnnouncement 编辑器被隐藏但其计数器未同步隐藏，成孤儿浮在设置页；
    // 修法→rteCountUpdate 里判断编辑器不可见则同步隐藏计数器，可见则恢复显示
    function rteCountUpdate(ed) {
      var c = document.querySelector('.rte-count[data-for="' + ed.id + '"]');
      if (!c) return;
      if (ed.style.display === 'none' || (ed.offsetParent === null && getComputedStyle(ed).display === 'none')) {
        c.style.display = 'none';
        return;
      }
      c.style.display = '';
      c.textContent = '已输入 ' + ed.textContent.replace(/\s/g, '').length + ' 字';
    }
    document.querySelectorAll('.rte-editor').forEach(function (ed) {
      rteCountUpdate(ed);
      new MutationObserver(function () { rteCountUpdate(ed); }).observe(ed, { childList: true, subtree: true, characterData: true });
    });

    /* 粘贴自动清理：编辑器内粘贴一律只留纯文字（用户拍板「什么都不留直接清除格式」） */
    document.addEventListener('paste', function (e) {
      var t = e.target;
      if (!t || !t.closest || !t.closest('.rte-editor')) return;
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
      if (text) document.execCommand('insertText', false, text);
    });

    // 更新工具栏按钮激活状态
    function updateRteActive() {
      document.querySelectorAll('#detailRteToolbar .rte-btn[data-cmd]').forEach(function (btn) {
        var cmd = btn.dataset.cmd;
        try {
          if (document.queryCommandState(cmd)) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        } catch (e) { if (window.__silent) window.__silent(e); }
      });
    }
    rteEditor.addEventListener('keyup', updateRteActive);
    rteEditor.addEventListener('mouseup', updateRteActive);

    // 插入超链接（一个弹窗两个输入框）
    document.getElementById('detailRteLink').addEventListener('click', function () {
      showLinkDialog('', '', function (url, text) {
        var html = '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer"><u>' + text + '</u></a>'; /* R240（老板 09-22）：链接默认带下划线改为<u>标记驱动（前台 sanitizeHTML 放行 U 标签）——原先下划线由 CSS 画死，下划线按键加/删<u>看不出变化；改标记后默认带下划线、按键可加可删 */
        rteInsert(__rte.editor, html);
        toast('超链接已插入', 'success');
      });
    });

    // 格式刷
    var detailBrushStyle = null;
    document.getElementById('detailFormatBrush').addEventListener('mousedown', function (e) { e.preventDefault(); });
    document.getElementById('detailFormatBrush').addEventListener('click', function () {
      var brushBtn = this;
      if (!detailBrushStyle) {
        var sel = window.getSelection();
        if (sel.rangeCount > 0 && !sel.isCollapsed) {
          detailBrushStyle = rteReadBrushStyle();
          brushBtn.classList.add('active');
          toast('格式已复制，选中其他内容后再次点击格式刷应用', 'success');
        } else {
          toast('请先选中要复制格式的内容', 'error');
        }
      } else {
        var sel2 = window.getSelection();
        if (sel2.rangeCount > 0 && !sel2.isCollapsed) {
          rteApplyBrushStyle(detailBrushStyle);
          rteFocusStay(rteEditor); /* R240：preventScroll */
          toast('格式已应用', 'success');
        } else {
          toast('请先选中要应用格式的内容', 'error');
        }
        detailBrushStyle = null;
        brushBtn.classList.remove('active');
      }
    });
