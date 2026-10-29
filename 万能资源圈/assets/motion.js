/* ============================================================
   motion.js — v387 全站高级动效基建（唯一源）
   依赖：ui-common.js（uiToast/__followSwipe 等）可缺失——各助手独立可用
   提供：
     __motion.countUp(el, to, {from, dur, prefix, suffix})   A7 数字滚动
     __motion.shake(el)                                      C7 抖动
     __motion.confetti(x, y, n)                              H16 彩带（限频）
     __motion.cascade(container, {sel, step, cap})           A4 级联
     __motion.reveal(el)                                     A1 骨架交接
     __motion.otp(elInput, n)                                H4 分格码
     __motion.suggest(inputEl, getData, onPick)              H18 联想
     __motion.observeToasts()                                D2 打勾图标
     __motion.observeUndo()                                  C5 撤销条弹簧+倒计时环
     __motion.observeRedots()                                D5 红点弹出
     __motion.observeCascades(selectors)                     A4 自动级联
   全部自初始化（DOMContentLoaded 前后均可加载）。
   ============================================================ */
(function () {
  'use strict';
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- A7 数字滚动 ---------- */
  function countUp(el, to, opts) {
    if (!el) return;
    opts = opts || {};
    var from = (typeof opts.from === 'number') ? opts.from : 0;
    var dur = opts.dur || 900;
    var pre = opts.prefix || '', suf = opts.suffix || '';
    if (REDUCED) { el.textContent = pre + to + suf; return; }
    var t0 = null;
    function frame(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 4); /* easeOutQuart */
      el.textContent = pre + Math.round(from + (to - from) * e) + suf;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- C7 抖动 ---------- */
  function shake(el) {
    if (!el) return;
    el.classList.remove('wn-shake');
    void el.offsetWidth;
    el.classList.add('wn-shake');
    setTimeout(function () { el.classList.remove('wn-shake'); }, 480);
  }

  /* ---------- H16 彩带（同屏限频：3 秒最多一次） ---------- */
  var CF_COLORS = ['#F2B84B', '#EF6C6C', '#4CAF93', '#7E57C2', '#1E88E5', '#F57C00'];
  var cfLast = 0;
  function confetti(x, y, n) {
    if (REDUCED) return;
    var now = Date.now();
    if (now - cfLast < 3000) return;
    cfLast = now;
    n = n || 26;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i');
      p.className = 'wn-cfp';
      p.style.background = CF_COLORS[i % CF_COLORS.length];
      p.style.left = x + 'px'; p.style.top = y + 'px';
      document.body.appendChild(p);
      var ang = (-90 + (Math.random() * 120 - 60)) * Math.PI / 180;
      var v = 180 + Math.random() * 240;
      var dx = Math.cos(ang) * v, dy = Math.sin(ang) * v;
      var rot = (Math.random() * 540 - 270);
      var dur = 900 + Math.random() * 700;
      p.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: 'translate(' + dx * 0.7 + 'px,' + (dy * 0.7 + 120) + 'px) rotate(' + rot * 0.7 + 'deg)', opacity: 1, offset: 0.6 },
        { transform: 'translate(' + dx + 'px,' + (dy + 340) + 'px) rotate(' + rot + 'deg)', opacity: 0 }
      ], { duration: dur, easing: 'cubic-bezier(.2,.6,.3,1)' }).onfinish = (function (node) { return function () { node.remove(); }; })(p);
    }
  }

  /* ---------- A4 级联 ---------- */
  function cascade(container, opts) {
    if (!container || REDUCED) return;
    opts = opts || {};
    var sel = opts.sel || null;
    var step = opts.step || 28, cap = opts.cap || 12;
    var kids = sel ? container.querySelectorAll(sel) : container.children;
    for (var i = 0; i < kids.length && i < cap; i++) {
      var k = kids[i];
      k.classList.remove('wn-casc');
      k.style.setProperty('--casc-d', (i * step) + 'ms');
      void k.offsetWidth;
      k.classList.add('wn-casc');
    }
    /* cap 外的只做整体淡入不逐个延迟 */
    for (var j = cap; j < kids.length; j++) {
      kids[j].classList.remove('wn-casc');
      kids[j].style.setProperty('--casc-d', (cap * step) + 'ms');
      kids[j].classList.add('wn-casc');
    }
  }

  /* ---------- A1 骨架交接 ---------- */
  function reveal(el) {
    if (!el) return;
    el.classList.remove('wn-reveal');
    void el.offsetWidth;
    el.classList.add('wn-reveal');
    setTimeout(function () { el.classList.remove('wn-reveal'); }, 400);
  }

  /* ---------- D7 涟漪（全局委托） ---------- */
  var RIP_SEL = '.row-btn, .batch-btn, .cat-tag, .view-btn, .tab, .modal-footer button, .pager button';
  function rippleHost(el) { el.classList.add('wn-ripple-host'); }
  document.addEventListener('pointerdown', function (e) {
    if (REDUCED) return;
    var t = e.target.closest ? e.target.closest(RIP_SEL) : null;
    if (!t || t.disabled) return;
    var r = t.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    rippleHost(t);
    var ink = document.createElement('span');
    ink.className = 'wn-ripple-ink' + (t.classList.contains('status-btn') ? '' : '');
    var d = Math.max(r.width, r.height) * 2.2;
    ink.style.width = ink.style.height = d + 'px';
    ink.style.left = (e.clientX - r.left) + 'px';
    ink.style.top = (e.clientY - r.top) + 'px';
    t.appendChild(ink);
    requestAnimationFrame(function () { ink.classList.add('go'); });
    setTimeout(function () { ink.remove(); }, 600);
  }, { passive: true });

  /* ---------- D2 toast 打勾图标（MutationObserver，不动 uiToast 内部） ---------- */
  var TICO_OK = '<svg class="wn-tico ok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l3 3 5.5-6"/></svg>';
  var TICO_ERR = '<svg class="wn-tico err" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/></svg>';
  function dressToast(t) {
    if (t.dataset.wnDressed) return;
    t.dataset.wnDressed = '1';
    var isErr = t.classList.contains('error');
    var span = document.createElement('span');
    span.innerHTML = isErr ? TICO_ERR : TICO_OK;
    t.insertBefore(span.firstChild, t.firstChild);
    /* H16：发布成功撒彩带（限频 3 秒一次，toast 文案驱动，不动业务代码） */
    if (!isErr && /发布成功|已发布/.test(t.textContent || '')) {
      var r = t.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top, 30);
    }
  }
  function observeToasts() {
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('ui-toast')) {
            dressToast(n);
            /* v394-21：错误提示 → 抖最近聚焦过的输入框（全表单统一反馈） */
            try {
              if (n.classList.contains('error') && window.__wnLastField) {
                var f = window.__wnLastField;
                var g = f.closest('.setting-row,.edit-row,.modal-section,.info-item,.form-row,form') || f;
                g.classList.remove('wn-shake'); void g.offsetWidth; g.classList.add('wn-shake');
                setTimeout(function () { g.classList.remove('wn-shake'); }, 500);
              }
            } catch (e) {}
          }
        });
      });
    });
    mo.observe(document.body, { childList: true });
    /* 已存在的也补装 */
    document.querySelectorAll('.ui-toast').forEach(dressToast);
  }

  /* ---------- C5 撤销条：弹簧+倒计时环+末段提醒（不动 uiToast 逻辑，只装饰） ---------- */
  function dressUndo(t) {
    if (t.dataset.wnUndo) return;
    t.dataset.wnUndo = '1';
    t.classList.add('wn-undo');
    var ms = (window.WN_CONST && window.WN_CONST.UNDO_MS) || 10000;
    t.style.setProperty('--undo-ms', ms + 'ms');
    var btn = t.querySelector('.undo-btn');
    if (btn) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'wn-ring');
      svg.setAttribute('viewBox', '0 0 12 12');
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', '6'); c.setAttribute('cy', '6'); c.setAttribute('r', '5');
      svg.appendChild(c);
      btn.insertBefore(svg, btn.firstChild);
    }
    /* 末 2 秒轻晃提醒 */
    setTimeout(function () {
      if (t.parentNode) t.classList.add('wn-undo-last');
    }, Math.max(0, ms - 2000));
    /* 出场动画类（原 cleanup 直接 remove，这里监测不到——用退出观察兜底不强求） */
  }
  function observeUndo() {
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('ui-toast') && n.querySelector('.undo-btn')) dressUndo(n);
        });
      });
    });
    mo.observe(document.body, { childList: true });
  }

  /* ---------- D5 红点弹出（监听 hidden 属性切换） ---------- */
  function observeRedots() {
    document.querySelectorAll('.dot-badge').forEach(function (d) {
      if (d.__wnDot) return; d.__wnDot = 1;
      var wasHidden = d.hidden;
      var mo = new MutationObserver(function () {
        if (wasHidden && !d.hidden) { d.classList.remove('wn-pop-out'); d.classList.add('wn-pop-in'); setTimeout(function () { d.classList.remove('wn-pop-in'); }, 420); }
        else if (!wasHidden && d.hidden) { d.classList.add('wn-pop-out'); }
        wasHidden = d.hidden;
      });
      mo.observe(d, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  /* ---------- A4 自动级联（渲染容器监听） ---------- */
  function observeCascades(selectors) {
    (selectors || []).forEach(function (spec) {
      var host = document.querySelector(spec.el);
      if (!host || host.__wnCasc) return;
      host.__wnCasc = 1;
      var mo = new MutationObserver(function () {
        clearTimeout(host.__wnCascT);
        host.__wnCascT = setTimeout(function () {
          var cur = document.querySelector(spec.el);
          if (cur) cascade(cur, spec.opts || {});
        }, 60);
      });
      mo.observe(host, { childList: true });
    });
  }

  /* ---------- H4 分格资源码输入（8 位大写） ---------- */
  /* 用法：__motion.otp(容器el, 8)——容器内生成 8 个 input；真实值同步到 el.dataset.otpValue；
     调用方读 el.dataset.otpValue 提交（保持对旧单框的兼容：也支持传原 input 隐藏） */
  function otp(container, n) {
    if (!container) return null;
    n = n || 8;
    container.innerHTML = '';
    container.className += ' otp-row';
    var inputs = [];
    for (var i = 0; i < n; i++) {
      var inp = document.createElement('input');
      inp.type = 'text'; inp.maxLength = 1; inp.inputMode = 'text';
      /* v394-46：资源码=大写字母+数字（含英文），自动大写+关纠正；不设数字键盘 */
      inp.autocapitalize = 'characters'; inp.autocomplete = 'off'; inp.spellcheck = false;
      inp.setAttribute('aria-label', '资源码第' + (i + 1) + '位');
      inp.autocomplete = 'off'; inp.setAttribute('aria-label', '资源码第' + (i + 1) + '位');
      container.appendChild(inp); inputs.push(inp);
    }
    function sync() {
      var v = inputs.map(function (x) { return x.value || ''; }).join('');
      container.dataset.otpValue = v;
      inputs.forEach(function (x) { x.classList.toggle('filled', !!x.value); });
    }
    inputs.forEach(function (inp, i) {
      inp.addEventListener('input', function () {
        inp.value = inp.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-1);
        sync();
        if (inp.value && i < n - 1) inputs[i + 1].focus();
      });
      /* v395-3：聚焦即全选——maxLength=1 下点已填格再打字会被浏览器静默拒绝（错码重输必踩），
         全选后键入=直接替换（标准 OTP 手感），input 事件照常走上方现有处理，零新增分支 */
      inp.addEventListener('focus', function () {
        setTimeout(function () { try { inp.select(); } catch (e) {} }, 0);
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !inp.value && i > 0) {
          inputs[i - 1].focus(); inputs[i - 1].value = ''; sync();
          /* v395-3：退格清格必须补派 input 事件——原路径只改值+sync，镜像 input 与 400ms 巡查
             都不感知，巡查反把旧值铺回分格（清格被撤销、两侧打架）。补派后走既有 pushToInput('otp') 同步链 */
          try { inputs[i - 1].dispatchEvent(new Event('input', { bubbles: false })); } catch (e1) {}
          e.preventDefault();
        }
        else if (e.key === 'ArrowLeft' && i > 0) inputs[i - 1].focus();
        else if (e.key === 'ArrowRight' && i < n - 1) inputs[i + 1].focus();
      });
      inp.addEventListener('paste', function (e) {
        e.preventDefault();
        var txt = (e.clipboardData || window.clipboardData).getData('text') || '';
        txt = txt.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        for (var k = 0; k < n; k++) inputs[k].value = txt[k] || '';
        var last = Math.min(txt.length, n) - 1;
        if (last >= 0) inputs[last].focus();
        sync();
      });
    });
    container.__otpInputs = inputs;
    return container;
  }

  /* ---------- H18 搜索联想 ---------- */
  /* getData(keyword) -> [{label, sub, cat}]；onPick(item) */
  function suggest(inputEl, getData, onPick) {
    if (!inputEl) return;
    var pop = null, cur = -1, items = [];
    function close() { if (pop) { pop.remove(); pop = null; } cur = -1; }
    function build(list) {
      close();
      if (!list || !list.length) return;
      pop = document.createElement('div');
      pop.className = 'sugg-pop';
      list.forEach(function (it, i) {
        var row = document.createElement('div');
        row.className = 'sugg-it';
        row.innerHTML = '<i></i><span>' + String(it.label).replace(/</g, '&lt;') + (it.sub ? '<span style="color:var(--text-faint);font-size:11.5px;margin-left:6px">' + String(it.sub).replace(/</g, '&lt;') + '</span>' : '') + '</span>';
        row.addEventListener('pointerdown', function (e) { e.preventDefault(); close(); onPick && onPick(it); });
        pop.appendChild(row);
      });
      inputEl.parentNode.appendChild(pop);
      items = list;
    }
    inputEl.addEventListener('input', function () {
      var kw = inputEl.value.trim();
      if (kw.length < 1) { close(); return; }
      var list = getData(kw) || [];
      build(list.slice(0, 6));
    });
    inputEl.addEventListener('keydown', function (e) {
      if (!pop) return;
      var rows = pop.querySelectorAll('.sugg-it');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        cur = e.key === 'ArrowDown' ? Math.min(cur + 1, rows.length - 1) : Math.max(cur - 1, 0);
        rows.forEach(function (r, i) { r.classList.toggle('hot', i === cur); });
      } else if (e.key === 'Enter' && cur >= 0 && items[cur]) {
        e.preventDefault(); close(); onPick && onPick(items[cur]);
      } else if (e.key === 'Escape') close();
    });
    document.addEventListener('pointerdown', function (e) {
      if (pop && !pop.contains(e.target) && e.target !== inputEl) close();
    }, true);
  }

  /* ---------- I6 图片模糊渐显（全站所有 <img>）----------
     机制：①插入/首扫时给未加载完的图打 .wn-lqip（模糊）；
          ②document 捕获阶段接 load/error——加载完成转清晰，加载失败摘模糊防永久糊；
          ③已加载完（缓存命中）的图不打标，零开销 */
  function initLqip() {
    if (REDUCED || window.__wnLqip) return;
    window.__wnLqip = 1;
    var mark = function (img) {
      if (!img || img.tagName !== 'IMG' || img.__wnLqip) return;
      img.__wnLqip = 1;
      /* v394-42：全站图片懒加载 */
      try {
        if (!img.complete && !img.getAttribute('loading') && !/^data:/.test(img.getAttribute('src') || '')) {
          img.loading = 'lazy'; img.decoding = 'async';
        }
      } catch (e) {}
      try { if (img.complete && img.naturalWidth) return; } catch (e) {}
      img.classList.add('wn-lqip');
    };
    document.addEventListener('load', function (e) {
      var t = e.target;
      if (t && t.tagName === 'IMG' && t.classList.contains('wn-lqip')) {
        t.classList.add('wn-lqip-in');
        setTimeout(function () { t.classList.remove('wn-lqip', 'wn-lqip-in'); }, 450);
      }
    }, true);
    document.addEventListener('error', function (e) {
      var t = e.target;
      if (t && t.tagName === 'IMG') t.classList.remove('wn-lqip', 'wn-lqip-in');
    }, true);
    var scan = function (root) {
      if (root.tagName === 'IMG') mark(root);
      else if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll('img'), mark);
    };
    scan(document);
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1) scan(n);
        });
      });
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    /* v391 补：src 换图场景（占位图→真图，loadImg 主流程）——src 一变即重新计模糊 */
    var smo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        var t = m.target;
        if (!t || t.tagName !== 'IMG') return;
        t.__wnLqip = 0;
        try { if (t.complete && t.naturalWidth) return; } catch (e) {}
        t.classList.remove('wn-lqip-in');
        t.classList.add('wn-lqip');
      });
    });
    smo.observe(document.documentElement, { attributes: true, attributeFilter: ['src'], subtree: true });
  }

  /* ---------- F1 折线图描画（给 #lineSvg 新数据线打 pathLength=1，CSS 负责动画） ---------- */
  function observeLineSvg() {
    var svg = document.getElementById('lineSvg');
    if (!svg || svg.__wnLine) return;
    svg.__wnLine = 1;
    var dress = function (n) {
      if (n.tagName === 'path' && !n.hasAttribute('stroke-dasharray') && !n.hasAttribute('pathLength')) n.setAttribute('pathLength', '1');
    };
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, dress); });
    });
    mo.observe(svg, { childList: true });
    svg.querySelectorAll('path:not([stroke-dasharray])').forEach(dress);
  }

  /* ---------- B3 指示线落位弹簧：跟手时无过渡，松手后 .wn-settle（真实类名 .tabs-line/.cat-line） ---------- */
  var INDIC_SEL = '.tabs-line, .cat-line';
  function observeIndic() {
    document.addEventListener('touchstart', function () {
      document.querySelectorAll(INDIC_SEL + '.wn-settle').forEach(function (n) { n.classList.remove('wn-settle'); });
    }, { passive: true, capture: true });
    /* 松手提交结束（__fs-stage 移除）后补 settle 类 */
    var mo = new MutationObserver(function () {
      var stage = document.querySelector('.__fs-stage');
      if (!stage) {
        setTimeout(function () {
          document.querySelectorAll(INDIC_SEL).forEach(function (n) {
            n.classList.add('wn-settle');
            setTimeout(function () { n.classList.remove('wn-settle'); }, 450);
          });
        }, 60);
      }
    });
    mo.observe(document.body, { childList: true, subtree: false });
  }

  /* ---------- D3 按钮变形：__btnSuccess 前置转圈段（转圈→✓→恢复） ---------- */
  function wrapBtnSuccess() {
    if (!window.__btnSuccess || window.__btnSuccess.__wnMorph) return;
    var orig = window.__btnSuccess;
    var wrapped = function (btn, doneText) {
      if (!btn || REDUCED) return orig(btn, doneText);
      try {
        if (!btn.dataset.__btnOriginalHtml) {
          btn.dataset.__btnOriginal = btn.textContent || '';
          btn.dataset.__btnOriginalHtml = btn.innerHTML;
        }
        btn.disabled = true;
        btn.innerHTML = '<span class="wn-spin white"></span>';
        setTimeout(function () {
          btn.disabled = false;
          orig(btn, doneText);
        }, 380);
      } catch (e) { orig(btn, doneText); }
    };
    wrapped.__wnMorph = 1;
    window.__btnSuccess = wrapped;
  }

  /* ---------- E5 深色模式（v389-1：纯跟随设备系统，无开关无存储；系统切换时全站即时换装） ---------- */
  function bindTheme() {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    /* v392-3：浏览器地址栏/状态栏主题色跟随深浅色（四页唯一源，motion.js 全页加载） */
    function syncMeta() {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', document.documentElement.getAttribute('data-theme') === 'dark' ? '#0d1420' : '#1E88E5');
    }
    var apply = function () {
      var root = document.documentElement;
      root.classList.add('wn-theme-anim');
      if (mq.matches) root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      setTimeout(function () { root.classList.remove('wn-theme-anim'); }, 420);
      syncMeta();
    };
    if (!mq.__wnTheme) {
      mq.__wnTheme = 1;
      if (mq.addEventListener) mq.addEventListener('change', apply);
      else if (mq.addListener) mq.addListener(apply);
    }
    syncMeta();
  }

  /* ---------- v392-4：下拉刷新四页唯一源（手势+胶囊 UI 收归 motion.js） ----------
     各页只留配置：window.__pullRefresh = { guard?, refresh?(done) }，缺省整页重载。
     覆盖原 index/error 内联、shop DOM+静默刷新、admin 另一套类名——三套实现归一 */
  function bindPullRefresh(opts) {
    if (window.__wnPull) return;
    window.__wnPull = 1;
    opts = opts || {};
    var TH = 60;
    var tip = document.createElement('div');
    tip.className = 'pull-refresh';
    tip.innerHTML = '<span class="prt-text"><span class="prt-icon"></span><span class="prt-label">下拉刷新</span></span>';
    document.body.appendChild(tip);
    var sy = 0, sx = 0, pulling = false, dist = 0;
    function label(t) { var l = tip.querySelector('.prt-label'); if (l) l.textContent = t; }
    function blocked() {
      /* v319 口径统一：任一弹窗/灯箱打开时不触发（防滚动穿透） */
      return document.querySelector('.modal-mask.open, .ann-modal.open, .share-mask.open, .kf-mask.open, .lightbox.open') !== null;
    }
    document.addEventListener('touchstart', function (e) {
      if (opts.guard && opts.guard()) return;
      if ((window.scrollY || 0) <= 0 && !blocked()) { sy = e.touches[0].clientY; sx = e.touches[0].clientX; pulling = true; dist = 0; }
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - sy, dx = e.touches[0].clientX - sx;
      if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
        dist = Math.min(dy * 0.5, 80); /* R170：阻尼 0.5，上限 80 */
        var pill = tip.firstElementChild;
        pill.style.transition = 'none';
        pill.style.transform = 'translateY(' + (-48 + dist * 0.6) + 'px)';
        pill.style.opacity = dist > 0 ? String(Math.min(1, dist / 20)) : '0';
        label(dist > TH ? '释放立即刷新' : '下拉刷新');
      }
    }, { passive: true });
    document.addEventListener('touchend', function () {
      if (!pulling) return;
      pulling = false;
      var pill = tip.firstElementChild;
      pill.style.transition = ''; /* R170：恢复 CSS 回弹 */
      if (dist > TH) {
        pill.style.transform = 'translateY(0px)';
        label('正在刷新…');
        setTimeout(function () {
          function done() { pill.style.transform = 'translateY(-48px)'; pill.style.opacity = '0'; label('下拉刷新'); }
          if (typeof opts.refresh === 'function') { try { opts.refresh(done); return; } catch (e) { if (window.__silent) window.__silent(e); } }
          location.reload();
        }, 400);
      } else {
        pill.style.transform = 'translateY(-48px)'; pill.style.opacity = '0';
      }
      dist = 0;
    }, { passive: true });
  }

  /* ---------- v394-22：弹窗背景滚动锁（资源页有自带锁，这里兜管理/导航/错误三页） ---------- */
  function bindGlobalScrollLock() {
    if (window.__wnLockInit) return; window.__wnLockInit = 1;
    if (document.querySelector('script[src*="shop.js"]')) return; /* 资源页自带，避免双锁打架 */
    var n = 0;
    var apply = function () { document.body.style.overflow = n > 0 ? 'hidden' : ''; };
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        var t = m.target, open = t.classList && t.classList.contains('open');
        if (m.oldValue === null && open) n++;
        else if (m.oldValue !== null && !open && n > 0) n--;
      });
      apply();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true, attributeOldValue: true });
  }

  /* ---------- v394-51：全局兜底网（漏网失败入账本 __errLog，最近 20 条） ---------- */
  window.__errLog = window.__errLog || [];
  window.addEventListener('unhandledrejection', function (e) {
    try { window.__errLog.push({ t: Date.now(), kind: 'promise', msg: String((e.reason && (e.reason.message || e.reason)) || 'unknown').slice(0, 300) }); if (window.__errLog.length > 20) window.__errLog.shift(); } catch (x) {}
  });

  /* ---------- 启动 ---------- */
  function boot() {
    try { observeToasts(); } catch (e) {}
    try { observeUndo(); } catch (e) {}
    try { observeRedots(); } catch (e) {}
    try { observeLineSvg(); } catch (e) {}
    try { observeIndic(); } catch (e) {}
    try { wrapBtnSuccess(); } catch (e) {}
    try { bindTheme(); } catch (e) {}
    try { initLqip(); } catch (e) {}
    document.addEventListener('DOMContentLoaded', function () {
      try { observeLineSvg(); } catch (e) {}
      try { bindTheme(); } catch (e) {}
      try { initLqip(); } catch (e) {}
      try { if (window.__pullRefresh && !window.__wnPull) bindPullRefresh(window.__pullRefresh); } catch (e) {} /* v392-4：四页统一下拉刷新 */
      try { bindGlobalScrollLock(); } catch (e) {} /* v394-22 */
      document.addEventListener('focusin', function (e) {
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) window.__wnLastField = t;
      }, true); /* v394-21 */
    });
  }

  /* ---------- A2 FLIP 弹簧让位（拖拽排序用） ----------
     用法：var play = __motion.flipSnap(listEl, '.product-row', '[data-id]');
           ……重排/重渲染……
           play();  → 所有行从旧位置弹簧滑到新位置 */
  function flipSnap(listEl, rowSel, idSel) {
    if (!listEl || REDUCED) return function () {};
    rowSel = rowSel || '.product-row';
    var before = {};
    listEl.querySelectorAll(rowSel).forEach(function (r) {
      var id = idSel ? (r.getAttribute(idSel) || '') : (r.dataset.id || '');
      if (id) { var rc = r.getBoundingClientRect(); before[id] = { x: rc.left, y: rc.top }; }
    });
    return function () {
      listEl.querySelectorAll(rowSel).forEach(function (r) {
        var id = idSel ? (r.getAttribute(idSel) || '') : (r.dataset.id || '');
        var b = before[id];
        if (!b) return;
        var rc = r.getBoundingClientRect();
        var dx = b.x - rc.left, dy = b.y - rc.top;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        r.style.transition = 'none';
        r.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        r.style.willChange = 'transform';
        requestAnimationFrame(function () {
          r.style.transition = 'transform .34s cubic-bezier(.34,1.3,.64,1)';
          r.style.transform = 'translate(0,0)';
          setTimeout(function () { r.style.transition = ''; r.style.transform = ''; r.style.willChange = ''; }, 380);
        });
      });
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__motion = {
    countUp: countUp, shake: shake, confetti: confetti, cascade: cascade,
    reveal: reveal, otp: otp, suggest: suggest, observeToasts: observeToasts,
    observeUndo: observeUndo, observeRedots: observeRedots, observeCascades: observeCascades,
    flipSnap: flipSnap
  };
})();
