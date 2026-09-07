/**
 * 万能资源圈 公共 UI：统一浮起式滚动条
 * - 所有滚动容器（弹窗内容区/下拉面板/公告列表/富文本/时间弹窗/统计表）统一绑定
 * - 滚动时滚动条浮现（.sb-active），停止约 1 秒后自动淡化隐藏
 * - 初始扫描 + MutationObserver 自动绑定动态弹窗/列表，无需各页面重复写绑定逻辑
 */
window.__uiCommonLoaded = true;
(function () {
  'use strict';
  var HIDE_MS = 1000;
  var SEL = '.modal-box,.cat-picker-panel,.ann-list,.ann-body,.kf-box,.rte-editor,.dt-pop,.stat-table-wrap';
  var ACTIVE = 'sb-active';
  var timers = {};
  var uid = 0;

  function bind(el) {
    if (!el || el.__sbInit) return;
    el.__sbInit = true;
    el.__sbId = 'sb' + (++uid);
    // 浮起指示条：注入为容器子元素（absolute 不占布局），scrollTop 补偿定位使其视觉固定在容器右缘
    var bar = document.createElement('div');
    bar.className = 'sb-bar';
    el.appendChild(bar);
    function upd() {
      var h = el.clientHeight, sh = el.scrollHeight;
      if (!sh || sh <= h + 1) { bar.style.display = 'none'; return; }
      bar.style.display = '';
      var ratio = h / sh;
      var th = Math.max(20, h * ratio);
      bar.style.height = th + 'px';
      var maxMap = h - th;
      bar.style.top = ((sh - h) ? (el.scrollTop / (sh - h)) * maxMap : 0) + el.scrollTop + 'px';
    }
    upd();
    el.addEventListener('scroll', function () {
      upd();
      bar.classList.add(ACTIVE);
      var t = timers[el.__sbId];
      if (t) { clearTimeout(t); timers[el.__sbId] = null; }
      timers[el.__sbId] = setTimeout(function () {
        bar.classList.remove(ACTIVE);
        timers[el.__sbId] = null;
      }, HIDE_MS);
    }, { passive: true });
    window.addEventListener('resize', upd);
  }

  function scan(root) {
    var list = (root || document).querySelectorAll(SEL);
    for (var i = 0; i < list.length; i++) bind(list[i]);
  }

  scan(document);

  // 动态生成的弹窗/列表：MutationObserver 兜底自动绑定
  if (window.MutationObserver) {
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (!n || n.nodeType !== 1) continue;
          if (n.matches && n.matches(SEL)) bind(n);
          if (n.querySelectorAll) scan(n);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('load', function () { scan(document); });
})();

/* ===== 全站统一「咨询客服」弹窗（对齐导航页，一处定义全站生效） =====
 * window.openContactModal(url, qrImg, tip, btnText)
 *  - url:     客服跳转链接（优先类型→资源→全局默认，由各页面传入）
 *  - qrImg:   客服二维码图片，默认 assets/images/kefu.png
 *  - tip:     提示文字，默认「长按图片识别-添加人工客服」
 *  - btnText: 跳转按钮文字，默认「跳转-咨询在线客服」
 */
(function () {
  'use strict';
  var KF_QR_FAIL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E';

  function ensureKfModal() {
    if (document.getElementById('kfMask')) return;
    var m = document.createElement('div');
    m.className = 'kf-mask';
    m.id = 'kfMask';
    m.setAttribute('role', 'dialog');
    m.innerHTML =
      '<div class="kf-box">' +
        '<button class="kf-x" id="kfCloseX" type="button" aria-label="关闭">×</button>' +
        '<div class="kf-title">咨询客服</div>' +
        '<div class="kf-qr"><img id="kfQrImg" alt="客服二维码" /></div>' +
        '<div class="kf-tip" id="kfTip">长按图片识别-添加人工客服</div>' +
        '<div class="kf-actions">' +
        '<button class="kf-jump" id="kfJumpBtn" type="button">跳转-咨询在线客服</button>' +
        '<button class="kf-close" id="kfCloseBtn" type="button">关闭</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    function close() {
      m.classList.remove('open');
      // 不直接解锁：若还有其他弹窗（如商品弹窗）开着，必须保持背景锁定
      if (window.syncBodyLock) window.syncBodyLock(); else (document.body.style.overflow = '');
    }
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.getElementById('kfCloseX').addEventListener('click', close);
    document.getElementById('kfCloseBtn').addEventListener('click', close);
    document.getElementById('kfJumpBtn').addEventListener('click', function () {
      var u = this.getAttribute('data-url') || '';
      if (u) { try { window.open(u, '_blank'); } catch (e) {} }
    });
    window.closeContactModal = close;
  }

  window.openContactModal = function (url, qrImg, tip, btnText) {
    ensureKfModal();
    var img = document.getElementById('kfQrImg');
    if (img) {
      // 二维码统一出场动画：每次打开都重放（先移除→重排→加载完成后播放），全站任何入口时序一致
      img.classList.remove('kf-qr-in');
      img.onerror = function () { this.onerror = null; this.src = KF_QR_FAIL; };
      img.onload = function () { void img.offsetWidth; img.classList.add('kf-qr-in'); };
      img.src = qrImg || '/assets/images/kefu.png';
      if (img.complete && img.naturalWidth) { void img.offsetWidth; img.classList.add('kf-qr-in'); }
    }
    var tipEl = document.getElementById('kfTip');
    if (tipEl) tipEl.textContent = tip || '长按图片识别-添加人工客服';
    var btn = document.getElementById('kfJumpBtn');
    if (btn) {
      btn.textContent = btnText || '跳转-咨询在线客服';
      btn.setAttribute('data-url', url || '');
    }
    var mask = document.getElementById('kfMask');
    if (!mask.classList.contains('open')) {
      mask.classList.add('open');
      try { document.querySelectorAll('video').forEach(function (v) { if (!v.closest('.kf-box')) { try { v.pause(); } catch (e) {} } }); } catch (e) {}
      window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    }
  };

  // 公共媒体占位：加载前预留 16:9 高度防止弹窗先小后大；加载完成同一帧用真实宽高比接管（图片已在缓存，无等待撑开感）；失败交给感叹号兜底
  window.mediaStable = function (el, isVideo, keepRatio) {
    if (!el) return el;
    el.classList.add('m-loading');
    if (isVideo) el.classList.add('is-video');
    function applyRatio(w, h) {
      if (!keepRatio && w && h) { try { el.style.aspectRatio = (w / h); } catch (e) {} }
      el.classList.remove('m-loading', 'is-video');
    }
    if (isVideo) {
      el.addEventListener('loadedmetadata', function () { applyRatio(el.videoWidth, el.videoHeight); }, { once: true });
    } else {
      if (el.complete && el.naturalWidth) applyRatio(el.naturalWidth, el.naturalHeight);
      else el.addEventListener('load', function () { applyRatio(el.naturalWidth, el.naturalHeight); }, { once: true });
    }
    el.addEventListener('error', function () { el.classList.remove('m-loading', 'is-video'); }, { once: true });
    return el;
  };

  // ===== 全站统一滚动穿透锁定（弹窗打开锁背景、关闭恢复；幂等，手机端 touchmove 拦截） =====
  var __SB_SCROLL_SEL = '.modal-box,.ann-box,.kf-box,.share-box,.lb-box,.rte-editor,.dt-pop,.stat-table-wrap,.cat-picker-panel,.ann-list,.ann-body,.modal-scroll,.scroll-area,.modal-media,.lb-media';
  var __sbBlockHandler = function (e) {
    var t = e.target;
    var sc = t && t.closest ? t.closest(__SB_SCROLL_SEL) : null;
    if (sc) {
      // 弹窗内可滚动容器：中间区域放行；已到顶继续下拉 / 已到底继续上推时锁住，杜绝边界处链式穿透到背景
      var dy = 0;
      if (e.touches && e.touches[0]) {
        if (sc.__sbLastY != null) dy = e.touches[0].clientY - sc.__sbLastY;
        sc.__sbLastY = e.touches[0].clientY;
      }
      var atTop = sc.scrollTop <= 0;
      var atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
      if (dy > 0 && atTop) { if (e.cancelable !== false) e.preventDefault(); return; }
      if (dy < 0 && atBottom) { if (e.cancelable !== false) e.preventDefault(); return; }
      if (sc.scrollHeight > sc.clientHeight + 1) return;
    }
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return; // 输入框/编辑器放行
    if (e.cancelable === false) return;
    e.preventDefault();
  };
  window.lockBodyScroll = function (lock) {
    if (lock) {
      try { document.querySelectorAll(__SB_SCROLL_SEL).forEach(function (el) { el.__sbLastY = null; }); } catch (e) {}
      document.body.style.overflow = 'hidden';
      document.addEventListener('touchmove', __sbBlockHandler, { passive: false });
      document.addEventListener('wheel', __sbBlockHandler, { passive: false });
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('touchmove', __sbBlockHandler);
      document.removeEventListener('wheel', __sbBlockHandler);
    }
  };
  // 弹窗开关自动锁定背景滚动（MutationObserver 监听 .open，一处代码全站生效：商品/公告/分享/客服/放大预览/管理后台全部弹窗）
  var __SB_MASK_SEL = '.modal-mask.open, .kf-mask.open, .lb.open, .lightbox.open, .share-mask.open, .confirm-mask.open';
  // 统一重算背景锁：还有任意弹窗开着就保持锁定，全部关闭才解锁（多弹窗叠加、任意顺序关闭都正确，幂等）
  window.syncBodyLock = function () {
    var anyOpen = document.querySelector(__SB_MASK_SEL);
    window.lockBodyScroll(!!anyOpen);
  };
  (function () {
    var _opened = false;
    function _sync() {
      var anyOpen = document.querySelector(__SB_MASK_SEL);
      if (anyOpen && !_opened) { _opened = true; window.lockBodyScroll(true); }
      else if (!anyOpen && _opened) { _opened = false; window.lockBodyScroll(false); }
    }
    try {
      var _obs = new MutationObserver(_sync);
      _obs.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    } catch (e) {}
    document.addEventListener('DOMContentLoaded', _sync);
    window.addEventListener('pageshow', _sync);
  })();
  // 浏览器返回 / bfcache 恢复时强制刷新，防止从管理页返回商品页白屏
  window.addEventListener('pageshow', function (e) { if (e.persisted) { window.location.reload(); } });
})();
