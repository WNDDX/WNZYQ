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
          if (n.nodeType === 1 && n.classList && n.classList.contains('ui-toast')) dressToast(n);
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
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !inp.value && i > 0) { inputs[i - 1].focus(); inputs[i - 1].value = ''; sync(); e.preventDefault(); }
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

  /* ---------- E5 深色模式开关（设置面板按钮 + 全站持久化） ---------- */
  function bindTheme() {
    var btn = document.getElementById('themeToggleBtn');
    function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
    function label() { if (btn) btn.textContent = isDark() ? '关闭' : '开启'; }
    label();
    if (!btn || btn.__wnTheme) return;
    btn.__wnTheme = 1;
    btn.addEventListener('click', function () {
      var root = document.documentElement;
      root.classList.add('wn-theme-anim');
      if (isDark()) { root.removeAttribute('data-theme'); try { localStorage.setItem('wn_theme', 'light'); } catch (e) {} }
      else { root.setAttribute('data-theme', 'dark'); try { localStorage.setItem('wn_theme', 'dark'); } catch (e) {} }
      setTimeout(function () { root.classList.remove('wn-theme-anim'); }, 420);
      label();
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    try { observeToasts(); } catch (e) {}
    try { observeUndo(); } catch (e) {}
    try { observeRedots(); } catch (e) {}
    try { observeLineSvg(); } catch (e) {}
    try { observeIndic(); } catch (e) {}
    try { wrapBtnSuccess(); } catch (e) {}
    try { bindTheme(); } catch (e) {}
    document.addEventListener('DOMContentLoaded', function () {
      try { observeLineSvg(); } catch (e) {}
      try { bindTheme(); } catch (e) {}
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
