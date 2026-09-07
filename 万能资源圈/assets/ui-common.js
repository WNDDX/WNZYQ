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

  // 背景视频显隐管理：原生 <video> 在移动端浏览器层级高于一切 DOM（即使 z-index 更大也盖不住），
  // 打开客服弹窗必须同时 暂停+隐藏 背景视频，关闭后恢复，否则视频会压在客服弹窗之上
  var __kfHiddenVideos = [];
  function __hideBgVideos(hide) {
    try {
      document.querySelectorAll('video').forEach(function (v) {
        if (v.closest('.kf-box')) return;
        if (hide) {
          if (!v.dataset.__kfHid) {
            v.dataset.__kfHid = '1';
            __kfHiddenVideos.push(v);
            try { v.pause(); } catch (e) {}
            v.style.visibility = 'hidden';
          }
        } else if (v.dataset.__kfHid) {
          v.dataset.__kfHid = '';
          v.style.visibility = '';
        }
      });
      if (!hide) __kfHiddenVideos = [];
    } catch (e) {}
  }

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
      __hideBgVideos(false);
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
      __hideBgVideos(true);
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

  // ===== 全站统一提示弹窗（标题 + 内容 + 底部单个"确定"键）：密码错误/操作失败/成功提示等一律走它，复用同一套弹窗样式 =====
  window.showAlert = function (msg, title) {
    try {
      var mask = document.createElement('div');
      mask.className = 'modal-mask alert-mask open';
      mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.76);z-index:10060;display:flex;align-items:center;justify-content:center;padding:16px;';
      mask.innerHTML =
        '<div class="modal-box" style="background:#fff;border-radius:14px;width:100%;max-width:400px;padding:26px 22px;position:relative;text-align:center;max-height:84vh;overflow-y:auto;">' +
          '<div class="modal-title" style="font-size:20px;color:#222;margin-bottom:14px;letter-spacing:1.2px;padding:0 34px;text-align:center;">' + (title || '提示') + '</div>' +
          '<div style="font-size:15px;color:#555;line-height:1.7;word-break:break-word;overflow-wrap:anywhere;margin-bottom:20px;text-align:center;">' + String(msg == null ? '' : msg) + '</div>' +
          '<div style="display:flex;"><button type="button" class="alert-ok" style="flex:1;border:none;border-radius:8px;padding:11px 0;background:#1E88E5;color:#fff;font-size:16px;cursor:pointer;letter-spacing:1px;">确定</button></div>' +
        '</div>';
      document.body.appendChild(mask);
      var close = function () {
        try { document.body.removeChild(mask); } catch (e) {}
        if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
      };
      mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
      var ok = mask.querySelector('.alert-ok');
      if (ok) ok.addEventListener('click', close);
      window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    } catch (e) { /* 弹窗失败时回退系统 alert，保证提示不丢失 */ try { window.alert(msg); } catch (e2) {} }
  };

  // ===== 滚动锁已取消（用户要求恢复自由滚动：不再锁定 body、不再拦截 touchmove/wheel） =====
  // lockBodyScroll / syncBodyLock 保留为空操作，所有调用点无需改动即可正常滚动
  window.lockBodyScroll = function () {};
  window.syncBodyLock = function () {};
  // 浏览器返回 / bfcache 恢复时强制刷新，防止从管理页返回商品页白屏
  window.addEventListener('pageshow', function (e) { if (e.persisted) { window.location.reload(); } });
})();
