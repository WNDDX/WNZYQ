/**
 * 万能资源圈 公共 UI（加载标记 + 统一客服弹窗 + 统一提示弹窗）
 * 自定义滚动条已取消：恢复浏览器默认滚动条（用户要求）
 */
window.__uiCommonLoaded = true;

/* R213 P2③（质检 R212 + 队长拍板）：R211 时代的 __startViewTransition 包装已删——
   ViewTransitions 收敛后全站无任何调用（298 函数引用清点），startViewTransition 由调用方直用即可 */


/* ===== R34 全站统一 PWA Service Worker 注册（一处定义四页生效；原导航页/资源页各自的注册已收编于此） =====
 * 注册后每次打开都主动检查更新；新版 SW 接管（controllerchange）时自动刷新一次页面——
 * 配合 sw.js 的导航网络竞速策略，部署新版后访客刷新一次即拿到全新页面，不再先闪旧版。 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      try { reg.update(); } catch (e) {}
      var _swReloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (_swReloaded) return;
        _swReloaded = true;
        try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) {} // R248：编辑中时先落草稿再刷新
        window.location.reload();
      });
    }).catch(function () {});
  });
}

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
  // R14：排除范围扩大到所有弹窗容器内的视频（资源详情/预览/公告/分享/灯箱）——
  // 之前只排除客服弹窗自身，打开客服时把资源弹窗里的视频也 display:none 了，弹窗高度会塌陷
  var __KF_EXCLUDE_SEL = '.kf-box, .kf-mask, #kfFallback, .modal-mask, .ann-modal, .share-mask, .lightbox, .stat-modal';
  var __kfHiddenVideos = [];
  function __hideBgVideos(hide) {
    try {
      document.querySelectorAll('video').forEach(function (v) {
        if (v.closest(__KF_EXCLUDE_SEL)) return;
        if (hide) {
          if (!v.dataset.__kfHid) {
            v.dataset.__kfHid = '1';
            __kfHiddenVideos.push(v);
            try { v.pause(); } catch (e) {}
            v.style.visibility = 'hidden';
            v.style.display = 'none';
          }
        } else if (v.dataset.__kfHid) {
          v.dataset.__kfHid = '';
          v.style.visibility = '';
          v.style.display = '';
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
    m.addEventListener('click', function (e) { if (e.target === m) close(); }); /* R217：恢复点外关闭（R215 误删——老板原意只删下滑手势） */
    // R111：注册进 __modalKit——Esc 走暂存通道（纯展示弹窗=直接关）
    if (window.__modalKit) window.__modalKit.register(m, { discard: close, stash: close });
    document.getElementById('kfCloseX').addEventListener('click', close);
    document.getElementById('kfCloseBtn').addEventListener('click', close);
    document.getElementById('kfJumpBtn').addEventListener('click', function () {
      var u = this.getAttribute('data-url') || '';
      if (u) { try { window.open(u, '_blank'); } catch (e) {} }
    });
    window.closeContactModal = close;
  }

  // ===== R189 建议8：通用 preconnect 工具——任何客服/跳转链接打开弹窗前，先对其域名提前建连 =====
  // （DNS+TLS 握手在用户浏览期间悄悄完成，点「跳转」即达）。同域跳过、同 origin 只插一条。
  window.__kfPreconnect = function (url) {
    try {
      if (!url || !/^https?:\/\//.test(url)) return;
      var origin = new URL(url, location.href).origin;
      if (origin === location.origin) return;
      if (document.querySelector('link[data-pc-origin="' + origin + '"]')) return;
      var lk = document.createElement('link');
      lk.rel = 'preconnect'; lk.href = origin;
      lk.setAttribute('data-pc-origin', origin);
      document.head.appendChild(lk);
    } catch (e) {}
  };
  window.openContactModal = function (url, qrImg, tip, btnText) {
    window.__kfPreconnect(url); /* R189：弹窗打开即对目标域名提前建连，用户看二维码期间连接已就绪 */
    ensureKfModal();
    var img = document.getElementById('kfQrImg');
    if (img) {
      // R208（用户 09-19 00:23）：客服二维码旧图闪现根治——设置 src 前先隐藏，加载完成后再显示，杜绝首帧残留
      img.style.opacity = '0';
      img.classList.remove('kf-qr-in');
      img.onerror = function () { this.onerror = null; this.src = KF_QR_FAIL; if (this.classList) this.classList.add('media-fail'); };
      img.onload = function () { img.style.opacity = ''; void img.offsetWidth; img.classList.add('kf-qr-in'); };
      img.src = qrImg || '/assets/images/kefu.png?v=224';
      if (img.complete && img.naturalWidth) { img.style.opacity = ''; void img.offsetWidth; img.classList.add('kf-qr-in'); }
      // R45：客服二维码单击放大（真实图才可点，失败占位符不放大）
      if (window.__bindQrLightbox) window.__bindQrLightbox(img);
    }
    var tipEl = document.getElementById('kfTip');
    if (tipEl) tipEl.textContent = tip || '长按图片识别-添加人工客服';
    var btn = document.getElementById('kfJumpBtn');
    if (btn) {
      btn.style.display = btnText ? '' : 'none'; btn.textContent = btnText || '跳转-咨询在线客服'; btn.setAttribute('data-url', url || '');
    }
    var mask = document.getElementById('kfMask');
    if (!mask.classList.contains('open')) {
      mask.classList.add('open');
      __hideBgVideos(true);
      window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    }
  };

  // ===== R45：全站统一图片/视频放大灯箱 =====
  // 服务无页面级灯箱实现的场景（导航页二维码弹窗、全站客服二维码弹窗等）。
  // shop/admin 页面内有各自同款局部 openLightbox（函数声明遮蔽本全局属性，互不干扰；
  // 双指缩放/ESC 监听各自检查自己的遮罩，不重复生效）。样式走 ui-common.css 的 .lightbox（z-index 100000，
  // 高于客服 10001）。灯箱内是真实 <img>（非 CSS 背景）——微信/手机浏览器内长按识别二维码可用。
  var __lbMask = null, __lbScale = 1, __lbStartDist = 0;
  window.closeLightbox = function () {
    if (!__lbMask) return;
    try { __lbMask.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) {}
    __lbMask.classList.remove('open');
    // 不直接解锁：若底下还有弹窗（二维码弹窗/客服弹窗）开着，必须保持背景锁定
    if (window.syncBodyLock) window.syncBodyLock(); else (document.body.style.overflow = '');
  };
  window.openLightbox = function (src) {
    if (!src) return;
    if (!__lbMask) {
      __lbMask = document.createElement('div');
      __lbMask.className = 'lightbox';
      // R111：点图片本身不算「弹窗外」，只有点空白遮罩才关（与全站口径一致）；R217：恢复（R215 误删）
      __lbMask.onclick = function (e) { if (e.target === __lbMask) window.closeLightbox(); };
      document.body.appendChild(__lbMask);
      // R111：注册进统一弹窗栈，Esc 逐层路由（只关最上层）
      if (window.__modalKit) window.__modalKit.register(__lbMask, { discard: window.closeLightbox, stash: window.closeLightbox });
    }
    __lbMask.textContent = '';
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'modal-close-x'; x.textContent = '×';
    x.onclick = function (e) { e.stopPropagation(); window.closeLightbox(); };
    __lbMask.appendChild(x);
    var isVideo = /\.(mp4|webm|ogv|m3u8)(\?|#|$)/i.test(src) || /video|\.m3u8/i.test(src);
    var im = document.createElement(isVideo ? 'video' : 'img');
    im.src = src;
    if (isVideo) { im.controls = true; im.autoplay = true; im.playsInline = true; }
    im.style.cssText = 'max-width:92%;max-height:92%;object-fit:contain;border-radius:8px;transition:transform .05s linear;' + (isVideo ? 'width:92%;aspect-ratio:16/9;background:#000;' : '');
    __lbMask.appendChild(im);
    __lbScale = 1;
    window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    __lbMask.classList.add('open');
  };
  // 灯箱双指缩放（与 shop/admin 页面级实现同款：仅双指 touchmove 时接管，不影响单指长按识别）
  document.addEventListener('touchstart', function (e) {
    if (!__lbMask || !__lbMask.classList.contains('open')) return;
    if (e.touches.length === 2) __lbStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!__lbMask || !__lbMask.classList.contains('open')) return;
    if (e.touches.length === 2 && __lbStartDist > 0) {
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      __lbScale = Math.min(4, Math.max(1, __lbScale * (d / __lbStartDist)));
      var el = __lbMask.querySelector('img, video');
      if (el) el.style.transform = 'scale(' + __lbScale + ')';
      __lbStartDist = d;
      e.preventDefault();
    }
  }, { passive: false });
  document.addEventListener('touchend', function () { if (__lbMask && __lbMask.classList.contains('open')) __lbStartDist = 0; });
  document.addEventListener('dblclick', function (e) {
    if (!__lbMask || !__lbMask.classList.contains('open')) return;
    if (__lbMask.contains(e.target)) { __lbScale = 1; var el = __lbMask.querySelector('img, video'); if (el) el.style.transform = 'scale(1)'; }
  });
  // R111：Esc 关灯箱改由 __modalKit 统一路由（逐层：只关最上层弹窗），此处不再单独监听
  // 客服二维码单击放大（R45：与图片统一体验；加载失败占位符不放大——仅真实图可点）
  window.__bindQrLightbox = function (img) {
    if (!img || img.dataset.lbBound) return;
    img.dataset.lbBound = '1';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', function () {
      if (img.src && !img.src.startsWith('data:') && img.complete && img.naturalWidth) window.openLightbox(img.currentSrc || img.src);
    });
  };


  // ===== R50 基础 + R187：全站深色模式（纯自动跟随系统，无手动开关键——用户 09-17 14:52 拍板撤钮） =====
  // 变量体系在 ui-common.css（:root 亮色 / [data-theme=dark] 暗色），四页组件已全部接线；
  // 系统切深/浅色实时跟随；同步 <meta name="theme-color">（浏览器地址栏/状态栏底色跟着变）。
  var __mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  window.__applyTheme = function () {
    var dark = !!(__mq && __mq.matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var metas = document.querySelectorAll('meta[name="theme-color"]'); /* 各页本有 light/dark 双 media 版（跟随系统用）；跟随判定后全量同值——地址栏/状态栏与页面主题始终一致 */
    for (var k = 0; k < metas.length; k++) metas[k].setAttribute('content', dark ? '#14151f' : '#1E88E5');
  };
  window.__applyTheme();
  if (__mq) {
    if (__mq.addEventListener) __mq.addEventListener('change', function () { window.__applyTheme(); });
    else if (__mq.addListener) __mq.addListener(function () { window.__applyTheme(); });
  }

  // 公共媒体占位：加载前预留 16:9 高度防止弹窗先小后大；加载完成同一帧用真实宽高比接管（图片已在缓存，无等待撑开感）；失败交给感叹号兜底
  window.mediaStable = function (el, isVideo, keepRatio) {
    if (!el) return el;
    el.classList.add('m-loading');
    if (isVideo) el.classList.add('is-video');
    function applyRatio(w, h) {
      if (!keepRatio && w && h) { try { el.style.aspectRatio = (w / h); } catch (e) {} }
      el.classList.remove('m-loading', 'is-video');
      try { el.classList.add('img-in'); } catch (e) {} /* R183 条2：详情图入场动画（同二维码口径） */
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
  // 安全修复：标题与内容一律用 textContent 写入（不再拼进 innerHTML），
  // 即使内容来自接口返回或用户数据，也无法执行 HTML/脚本，杜绝 XSS
  window.showAlert = function (msg, title) {
    try {
      var mask = document.createElement('div');
      mask.className = 'modal-mask alert-mask open';
      mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.76);z-index:10060;display:flex;align-items:center;justify-content:center;padding:16px;';
      mask.innerHTML =
        '<div class="modal-box" style="background:#fff;border-radius:14px;width:100%;max-width:400px;padding:26px 22px;position:relative;text-align:center;max-height:84vh;overflow-y:auto;min-height:auto;">' +
          '<button type="button" class="modal-close-x" aria-label="关闭">×</button>' +
          '<div class="modal-title" style="font-size:20px;color:#222;margin-bottom:14px;letter-spacing:1.2px;padding:0 34px;text-align:center;"></div>' +
          '<div class="alert-body" style="font-size:15px;color:#555;line-height:1.7;word-break:break-word;overflow-wrap:anywhere;margin-bottom:20px;text-align:center;"></div>' +
          '<div style="display:flex;"><button type="button" class="alert-ok" style="flex:1;border:none;border-radius:8px;padding:11px 0;background:#1E88E5;color:#fff;font-size:16px;cursor:pointer;letter-spacing:1px;transition:transform 0.10s var(--ease-press), opacity 0.10s var(--ease-press);box-shadow:0 2px 6px rgba(30,136,229,0.25);-webkit-tap-highlight-color:transparent;">确定</button></div>' +
        '</div>';
      var titleEl = mask.querySelector('.modal-title');
      var bodyEl = mask.querySelector('.alert-body');
      if (titleEl) titleEl.textContent = (title == null || title === '') ? '提示' : String(title);
      if (bodyEl) bodyEl.textContent = String(msg == null ? '' : msg);
      document.body.appendChild(mask);
      var close = function () {
        if (close.__done) return; close.__done = true;
        /* R183 条8：提示弹窗关闭也走对称收缩（0.18s 后再移除节点；多次触发只执行一次） */
        try { mask.classList.add('mask-closing'); } catch (e0) {}
        setTimeout(function () {
          try { document.body.removeChild(mask); } catch (e) {}
          if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
        }, 200);
      };
      mask.addEventListener('click', function (e) { if (e.target === mask) close(); }); /* R217：恢复点外关闭（R215 误删） */
      var ok = mask.querySelector('.alert-ok');
      if (ok) ok.addEventListener('click', close);
      var x = mask.querySelector('.modal-close-x');
      if (x) x.addEventListener('click', close);
      window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    } catch (e) { /* 弹窗失败时回退系统 alert，保证提示不丢失 */ try { window.alert(msg); } catch (e2) {} }
  };

  // ===== R14 全站统一「分享链接」弹窗（复刻资源页分享本站弹窗观感：400px 白卡/标题/tip/链接/确定）=====
  // R254（老板 09-23 17:50）：tip 分色渲染——「资源名 · 后文」中资源名用站内链接蓝 #1565c0（与弹窗内链接、share-link 同色；
  // 站内 CSS 无该色变量定义，沿用同一硬编码值）、分隔「·」用黑色、其余文字保持灰 #888；tip 不含「 · 」时整体灰
  // （如无资源名的兜底纯灰字）。lastIndexOf 分割保证资源名内部即使含「 · 」也整段标蓝。
  function __renderShareTip(pEl, tip) {
    var s = tip || '资源链接已复制到剪贴板';
    pEl.textContent = '';
    var i = s.lastIndexOf(' · ');
    if (i < 0) { pEl.appendChild(document.createTextNode(s)); return; }
    var nEl = document.createElement('span');
    nEl.style.color = '#1565c0';
    nEl.textContent = s.slice(0, i);
    var dEl = document.createElement('span');
    dEl.style.color = '#000';
    dEl.textContent = ' · ';
    pEl.appendChild(nEl); pEl.appendChild(dEl);
    pEl.appendChild(document.createTextNode(s.slice(i + 3)));
  }
  // window.showShareLinkModal(title, url, tip)：标题、链接自动复制到剪贴板并展示；tip=灰色小字（R251：可带资源名；R254：分色）
  window.showShareLinkModal = function (title, url, tip) {
    // R79+R138：分享按键点击那一刻统一复制链接（异步 clipboard.writeText，零主线程阻塞）+ 即时 toast
    // 与资源页顶栏分享、资源卡片分享、预览分享、弹窗链接点击全部同链路同提示
    try { __shareCopy(url || ''); __shareToast('链接已复制到剪贴板'); } catch (e0) {}
    try {
      var mask = document.createElement('div');
      mask.className = 'share-mask';
      mask.setAttribute('role', 'dialog');
      mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.76);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
      mask.innerHTML =
        '<div class="share-box" style="background:#fff;border-radius:14px;position:relative;padding:26px 20px;width:100%;max-width:400px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);animation:modalIn 0.18s ease;">' +
          '<button class="modal-close-x" data-share-x type="button" aria-label="关闭" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:none;background:#f0f2f5;color:#666;font-size:19px;cursor:pointer;line-height:1;transition:transform 0.10s var(--ease-press), opacity 0.10s var(--ease-press);">×</button>' +
          '<div data-share-title style="font-size:18px;font-weight:600;color:#222;margin-bottom:10px;letter-spacing:1px;padding:0 34px;"></div>' +
          '<div data-share-tip style="font-size:13px;color:#888;margin-bottom:10px;">资源链接已复制到剪贴板</div>' +
          '<div data-share-url style="font-size:14px;color:#1565c0;word-break:break-all;overflow-wrap:anywhere;background:#f5f8fb;border-radius:8px;padding:10px 12px;margin-bottom:18px;line-height:1.5;"></div>' +
          '<button data-share-ok type="button" class="share-ok">确定</button>' +
        '</div>';
      var tEl = mask.querySelector('[data-share-title]');
      var uEl = mask.querySelector('[data-share-url]');
      var pEl = mask.querySelector('[data-share-tip]');
      if (tEl) tEl.textContent = title || '分享';
      if (pEl) __renderShareTip(pEl, tip); // R251：灰色小字支持带资源名；R254：分色——资源名蓝/圆点黑/其余灰
      if (uEl) uEl.textContent = url || '';
      // R22：蓝色链接本身可点击=再次复制并提示（复用页面级 toast，无 toast 时兜底一个轻提示条）
      if (uEl) {
        uEl.style.cursor = 'pointer';
        uEl.title = '点击复制链接';
        uEl.addEventListener('click', function () {
          try { __shareCopy(uEl.textContent || ''); } catch (e) {}
          if (uEl.classList) { uEl.classList.add('copy-ok-text'); setTimeout(function () { try { uEl.classList.remove('copy-ok-text'); } catch (e) {} }, 1500); } /* R217 条1：复制成功=链接文字变绿 1.5s（全站统一口径，与资源页顶栏分享一致） */
          __shareToast('链接已复制到剪贴板');
        });
        /* R217 条1：弹窗打开那一刻的自动复制同样给绿字反馈（所有走本弹窗的分享入口统一） */
        uEl.classList.add('copy-ok-text');
        setTimeout(function () { try { uEl.classList.remove('copy-ok-text'); } catch (e) {} }, 1500);
      }
      document.body.appendChild(mask);
      function close() {
        try { document.body.removeChild(mask); } catch (e) {}
        if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
      }
      mask.addEventListener('click', function (e) { if (e.target === mask) close(); }); /* R217：恢复点外关闭（R215 误删） */
      mask.querySelector('[data-share-x]').addEventListener('click', close);
      mask.querySelector('[data-share-ok]').addEventListener('click', close);
      // R111：注册进 __modalKit——Esc 走暂存通道（纯展示弹窗=直接关）
      if (window.__modalKit) window.__modalKit.register(mask, { discard: close, stash: close });
      // R79：复制已在函数入口（点击那一刻）同步完成，这里只负责弹窗与滚动锁
      window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    } catch (e) {}
  };
  function __fallbackCopyText(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(ta);
    // R79：移动端 webview 需先 focus 再 select，execCommand 才可靠
    // R138：focus 加 preventScroll——旧 focus() 在移动端会引发视口滚动/重排（点击分享卡一下的帮凶）
    try { ta.focus({ preventScroll: true }); } catch (e) { try { ta.focus(); } catch (e2) {} }
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }
  // R79：全站统一分享复制链路——所有分享按键点击那一刻与弹窗链接点击都走这一个函数
  // R138（用户 18:22 修复分享卡顿）：旧实现是「同步 execCommand + clipboard API 双保险」——
  // 每次点击都在手势内【同步】创建 textarea + focus + select + execCommand('copy')。
  // 移动端 execCommand 是出了名的主线程阻塞点（数百毫秒），focus 还会触发视口滚动/重排，
  // 叠加起来就是「点击分享卡一下、连点被吞、弹窗不消失（close 的 click 事件在阻塞窗口里
  // 被浏览器丢弃/合并）」——这不是动画问题，是同步长任务冻结主线程。
  // 现改为：优先 navigator.clipboard.writeText（https 部署环境全支持；在用户手势（点击）内
  // 发起即享有 transient activation 授权，写入成功率与 execCommand 等同甚至更高），异步执行
  // 零阻塞；仅在 clipboard API 不可用（旧 webview / 非安全上下文 http）时才退回 execCommand，
  // 且 fallback 的 focus 带 preventScroll。
  function __shareCopy(text) {
    text = (text == null) ? '' : String(text);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {
          // 写入被拒（罕见，如部分 webview 权限策略）：退回同步复制兜底
          try { __fallbackCopyText(text); } catch (e) {}
        });
        return true;
      }
    } catch (e) {}
    return __fallbackCopyText(text);
  }
  window.__shareCopyText = __shareCopy;
  // R22：分享链接复制提示——优先复用页面级 toast（资源页 showToast / 管理页 toast），都没有时兜底一个轻提示条
  function __shareToast(msg) {
    try {
      if (typeof window.showToast === 'function') { window.showToast(msg); return; }
      if (typeof window.toast === 'function') { window.toast(msg, 'success'); return; }
    } catch (e) {}
    // R83：兜底 toast 位置与全站统一 top:80px 居中（白底蓝字蓝边圆角20）
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);color:var(--blue1,#1E88E5);background:var(--toast-bg,rgba(255,255,255,0.92));border:1px solid var(--blue2,#64B5F6);border-radius:20px;padding:6px 16px;font-size:12px;line-height:18px;box-shadow:0 2px 8px rgba(0,0,0,0.1);z-index:100002;pointer-events:none;opacity:0;transition:opacity .2s ease;max-width:90%;text-align:center;'; /* R116：line-height 显式 18，单行总高恒 32px，与下拉刷新条逐像素一致 */
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { try { document.body.removeChild(t); } catch (e) {} }, 300); }, 2000);
  }

  // ===== 弹窗滚动锁：打开弹窗锁定背景滚动（PC overflow + 移动端拦截穿透），弹窗内部内容仍可正常滚动 =====
  var __touchLocked = false;
  function __blockTouch(e) {
    if (!e.target || !e.target.closest) return;
    var allow = e.target.closest('.modal-box,.kf-box,.share-box,.modal-inner,.rte-panel,.ann-box');
    if (!allow) e.preventDefault();
  }
  window.lockBodyScroll = function (lock) {
    if (lock) {
      // 同时锁 body 与 html：不同浏览器的主滚动容器归属不一致，双锁确保 PC 鼠标滚轮也让背景纹丝不动
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (!__touchLocked) { document.addEventListener('touchmove', __blockTouch, { passive: false }); __touchLocked = true; }
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (__touchLocked) { document.removeEventListener('touchmove', __blockTouch); __touchLocked = false; }
    }
  };
  var __prevModalOpen = false;
  window.syncBodyLock = function () {
    var open = !!document.querySelector('.modal-mask.open,.kf-mask.open,.share-mask.open,.lightbox-mask.open,.alert-mask.open,.lightbox.open');
    window.lockBodyScroll(open);
    // R167：只在弹窗开合状态真正「变迁」时隐藏 #uiTip——本函数由全文档 class/childList
    // 变化观察器防抖触发（连 uiTip 自身创建都会触发），无条件隐藏会把刚弹出的小框 30ms 后
    // 无端收掉；状态未变（仅普通 class 变化）时不动小框。
    if (open !== __prevModalOpen) { try { if (window.__hideUiTip) window.__hideUiTip(); } catch (e0) {} }
    __prevModalOpen = open;
  };
  // ===== 全站弹窗滚动锁自动同步（修复滚动穿透）=====
  // 此前只有公共组件（客服/提示弹窗）开窗时会锁背景，各页面自建弹窗（admin 的编辑/分类/公告/密码等 mask）
  // 直接 classList.add('open') 从不调锁——弹窗打开时滑动，背景跟着滚、弹窗内容反而不动（穿透）。
  // 现统一监听全文档 class 变化，防抖后按"当前是否有任何弹窗 open"自动上锁/解锁，任何页面任何弹窗都生效。
  try {
    var __lockT = 0;
    var __lockObserver = new MutationObserver(function () {
      clearTimeout(__lockT);
      __lockT = setTimeout(function () { window.syncBodyLock(); }, 30);
    });
    __lockObserver.observe(document.documentElement, { subtree: true, childList: true, attributeFilter: ['class'] });
  } catch (e) {}
  // 浏览器返回 / bfcache 恢复时强制刷新，防止从管理页返回商品页白屏
  window.addEventListener('pageshow', function (e) { if (e.persisted) { try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) {} window.location.reload(); } });

  // ===== R14 全站统一翻页组件（buildUniPager）：复用数据统计翻页的胶囊样式（.uni-pager，样式在 ui-common.css）=====
  // window.buildUniPager(container, { page, totalPages, total, unit, onPage })：
  //   page=当前页(1起) totalPages=总页数 total=总条数(可选) unit=单位文案(默认"条") onPage=点上一页/下一页/跳页后的回调
  // 交互要点（对应本轮反馈）：
  //   1) 结构（R35 两组，换行按组折行不拆散）：[上一页 | 页码信息 N / M（共X条）| 下一页] 一组，[跳页输入+跳转键] 一组
  //   2) 跳页输入框 clamp 到 [1, totalPages]；回车 = 点跳转
  //   3) 点击即时反馈：按钮无过渡延迟、渲染由调用方同步完成，不做平滑滚动（平滑滚动正是统计翻页"屏幕抖一下"的根因）
  //   4) 只有一页时组件整体隐藏（无翻页必要不占位）
  window.buildUniPager = function (container, opts) {
    if (!container) return;
    opts = opts || {};
    var page = opts.page || 1;
    var totalPages = opts.totalPages || 1;
    var onPage = typeof opts.onPage === 'function' ? opts.onPage : function () {};
    var unit = opts.unit || '条';
    var total = (typeof opts.total === 'number' && !isNaN(opts.total)) ? opts.total : null;

    container.className = 'uni-pager';
    container.innerHTML = '';

    /* R234：无翻页必要时也返回 no-op 句柄，调用方存句柄不必判 totalPages */
    if (totalPages <= 1) { container.style.display = 'none'; return { setPage: function () {} }; }
    container.style.display = '';

    var prev = document.createElement('button');
    prev.type = 'button'; prev.className = 'pg-btn'; prev.textContent = '上一页';
    var info = document.createElement('span');
    info.className = 'pg-info';
    var jump = document.createElement('span');
    jump.className = 'pg-jump';
    var input = document.createElement('input');
    input.type = 'number'; input.min = '1'; input.max = String(totalPages);
    input.setAttribute('inputmode', 'numeric'); input.setAttribute('aria-label', '跳转页码');
    var goBtn = document.createElement('button');
    goBtn.type = 'button'; goBtn.textContent = '跳转';
    var next = document.createElement('button');
    next.type = 'button'; next.className = 'pg-btn'; next.textContent = '下一页';

    jump.appendChild(input); jump.appendChild(goBtn);
    // R35：prev+info+next 包成一组（.pg-main），jump 自成一组——容器 flex-wrap 换行时按组整体折行，
    // 不会出现"上一页在上一行末尾、下一页被拆到下一行"的拆组错乱
    var main = document.createElement('span');
    main.className = 'pg-main';
    main.appendChild(prev); main.appendChild(info); main.appendChild(next);
    container.appendChild(main); container.appendChild(jump);

    function render() {
      prev.disabled = page <= 1;
      next.disabled = page >= totalPages;
      info.textContent = page + ' / ' + totalPages + (total !== null ? '（共' + total + unit + '）' : '');
      input.value = page;
      input.max = String(totalPages);
    }
    function go(p) {
      p = parseInt(p, 10);
      if (isNaN(p)) return;
      p = Math.min(Math.max(p, 1), totalPages);
      if (p === page) { input.value = page; return; }
      page = p; render(); onPage(page);
    }
    // 修复跳页失效：点击跳转键时浏览器事件顺序是 mousedown → input.blur → mouseup → click，
    // 旧的 blur 处理无条件把输入值重置回当前页码，click 读到的已是重置后的旧页码 → 点跳转没反应。
    // 现改为：mousedown 时先记住用户输入值，click 用记住的值；blur 只在输入无效（空/越界）时才重置。
    var pendingJump = null;
    prev.addEventListener('click', function () { go(page - 1); });
    next.addEventListener('click', function () { go(page + 1); });
    goBtn.addEventListener('mousedown', function () { pendingJump = input.value; });
    goBtn.addEventListener('click', function () { go(pendingJump !== null ? pendingJump : input.value); pendingJump = null; });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); pendingJump = null; go(input.value); } });
    input.addEventListener('blur', function () { var v = parseInt(input.value, 10); if (isNaN(v) || v < 1 || v > totalPages) input.value = page; });
    render();
    /* R234（用户 09-22 12:11 派单）：暴露更新句柄——无限滚动自动翻页后调用 setPage 同步组件内部状态
       （闭包 page / 跳页输入框 value / 「共X条」尾巴 / prev-next disabled 全部经 render() 刷新）。
       现有调用方（shop/admin）原本都不接返回值，改造不破坏兼容。 */
    return {
      setPage: function (p) {
        p = parseInt(p, 10);
        if (isNaN(p)) return;
        page = Math.min(Math.max(p, 1), totalPages);
        render();
      }
    };
  };
})();


/* ---------- R239（用户 09-22 派单）：全站公共「到底续滑翻页」机制（enableEdgeTurn）+ 页码提示浮层 ----------
   语义（老板拍板）：滑到列表最底部（滚不动）后再继续往上滑≈120px → 翻到下一页（单页替换不是追加）；
   翻页后回本页开头 + 屏幕中下方浮「第 N 页 / 共 M 页」胶囊提示 1.5s 消失；最后一页再滑不动浮「已经是最后一页了」；
   分页条按键（上一页/下一页/跳页）全部保留，两套并存。
   判定三通道统一进同一累计器（桌面滚轮与触屏同判定）：
   1) scroll：滚动位置真实变化（滚得动时的主通道）；
   2) wheel：贴底后页面滚不动、scroll 不再触发，滚轮事件照发（桌面主通道；deltaMode 行/页换算成像素）；
   3) touchstart/touchmove：贴底后触屏（含橡皮筋回弹）以手指位移为准（触屏主通道；手势期间 scroll 通道静默防重复累计）。
   判定规则：距底 ≤8px 才开始累计；朝底部方向累计、反向（回弹/上滑）清零；累计 >60px 触发；触发后 800ms 冷却锁防滚轮惯性连翻。 */
window.enableEdgeTurn = function (opts) {
  opts = opts || {};
  var scroller = opts.scroller || null; /* 传元素=容器内部滚动（如资源码弹窗）；不传=window 整页滚动 */
  var getPage = typeof opts.getPage === 'function' ? opts.getPage : function () { return 1; };
  var getTotalPages = typeof opts.getTotalPages === 'function' ? opts.getTotalPages : function () { return 1; };
  var onTurn = typeof opts.onTurn === 'function' ? opts.onTurn : function () {};
  var active = typeof opts.active === 'function' ? opts.active : function () { return true; }; /* 可选：非当前列表场景不判定 */
  var EDGE = 8, TRIGGER = 120, COOLDOWN = 800, TIP_MS = 1500;
  var locked = false, lockTimer = null;
  var acc = 0, touchActive = false, lastTouchY = null, lastY = null;

  function top() { return scroller ? scroller.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0); }
  /* R243 条31：滚动中布局读取每帧至多一次——bottomGap 原先每次 scroll/wheel/touchmove 事件都读
     scrollHeight/clientHeight/scrollTop（强制同步布局），高频事件一帧内可读多次；
     改为帧内缓存：本帧首次调用真实读取并缓存，同帧后续事件直接用缓存；
     requestAnimationFrame 末尾失效，下一帧重新读；翻页后 DOM 高度变化，立即失效 */
  var gapCache = null, gapRaf = 0;
  function invalidateGap() { gapCache = null; }
  function bottomGap() {
    if (gapCache === null) {
      if (scroller) gapCache = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      else { var de = document.documentElement; gapCache = de.scrollHeight - (window.innerHeight || de.clientHeight) - (window.scrollY || 0); }
      if (!gapRaf) gapRaf = requestAnimationFrame(function () { gapRaf = 0; invalidateGap(); });
    }
    return gapCache;
  }
  /* 页码提示浮层：屏幕中下方胶囊（样式在 ui-common.css .edge-turn-tip），1.5s 自动消失（连续触发重置计时） */
  var tipEl = null, tipTimer = null;
  function showTip(text) {
    if (!document.body) return;
    if (!tipEl || tipEl.parentNode !== document.body) {
      tipEl = document.createElement('div');
      tipEl.className = 'edge-turn-tip';
      document.body.appendChild(tipEl);
    }
    tipEl.textContent = text;
    tipEl.classList.add('show');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { if (tipEl) tipEl.classList.remove('show'); }, TIP_MS);
  }
  function reset() { acc = 0; }
  /* d>0=朝列表底部继续（滚轮向下/手指上滑/滚动条向下）；贴底前一律清零不累计；反向（回弹/上滑）清零 */
  var idleTimer = null;
  function accumulate(d) {
    if (locked || !active()) { reset(); return; }
    if (bottomGap() > EDGE) { reset(); return; }
    if (d > 0) acc += d; else if (d < 0) reset();
    /* 「继续滑」应为较连续的动作：输入间隔 >600ms 清零，跨手势残留不累计
       （避免贴底滑了 50px 没到 60、隔一会儿再滑一小下被误判为连续续滑） */
    clearTimeout(idleTimer);
    idleTimer = setTimeout(reset, 600);
    if (acc > TRIGGER) fire();
  }
  function fire() {
    var p = getPage(), tp = getTotalPages();
    reset();
    invalidateGap(); /* R243 条31：翻页 DOM 高度变化，帧缓存立即失效 */
    if (p >= tp) { showTip('已经是最后一页了'); return; } /* 最后一页再滑不动：只提示不翻页 */
    locked = true; /* 冷却锁：翻页回顶 + 滚轮/惯性余量期间不再判定，防一次手势连翻两页 */
    clearTimeout(lockTimer);
    lockTimer = setTimeout(function () { locked = false; }, COOLDOWN);
    showTip('第 ' + (p + 1) + ' 页 / 共 ' + tp + ' 页');
    onTurn(p + 1);
  }

  var el = scroller || window;
  var onScroll = function () {
    var y = top();
    if (lastY === null) { lastY = y; return; }
    var d = y - lastY; lastY = y;
    if (touchActive) return; /* 触屏手势期间以 touchmove 为准，同一次滑动不双通道重复累计 */
    accumulate(d);
  };
  var onWheel = function (e) {
    var k = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? Math.max(240, window.innerHeight || 640) : 1);
    accumulate(e.deltaY * k);
  };
  var onTouchStart = function (e) { touchActive = true; lastTouchY = (e.touches && e.touches[0]) ? e.touches[0].clientY : null; };
  var onTouchMove = function (e) {
    if (!touchActive || lastTouchY === null) return;
    var y = (e.touches && e.touches[0]) ? e.touches[0].clientY : null;
    if (y === null) return;
    var d = lastTouchY - y; /* 手指上滑（朝底部）为正 */
    lastTouchY = y;
    accumulate(d);
  };
  var onTouchEnd = function () { touchActive = false; lastTouchY = null; };

  el.addEventListener('scroll', onScroll, { passive: true });
  el.addEventListener('wheel', onWheel, { passive: true });
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: true });
  el.addEventListener('touchend', onTouchEnd, { passive: true });
  el.addEventListener('touchcancel', onTouchEnd, { passive: true });
  return {
    destroy: function () {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      clearTimeout(lockTimer); clearTimeout(tipTimer); clearTimeout(idleTimer);
      if (gapRaf) cancelAnimationFrame(gapRaf); /* R243 条31：销毁时清掉帧失效回调 */
      if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl);
    }
  };
};

// ---------- R233（用户 09-22 11:30 派单）：条13 补做——跨页跳转接入 View Transitions（全站四页） ----------
// 跨文档转场本体由 ui-common.css 的 @view-transition { navigation: auto }（R211）接管，JS 侧不再手动淡出干扰它。
// 三分支（渐进增强，老浏览器不坏）：
// 1) prefers-reduced-motion 用户 → 跳过动画直接跳（CSS 侧三伪元素动画也已关，R231 条13）；
// 2) 支持 document.startViewTransition → 用它包裹跳转（当前页截图交叠新页，平滑过渡）；
// 3) 老浏览器无该 API → 回退 R20 的 180ms 淡出方案（1.2s 兜底恢复 + bfcache pageshow 恢复，原逻辑保留）。
window.jumpTo = function (href) {
  if (!href) return;
  var reduced = false;
  try { reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  if (reduced) { window.location.href = href; return; }
  if (document.startViewTransition) {
    document.startViewTransition(function () { window.location.href = href; });
    return;
  }
  var b = document.body;
  if (!b) { window.location.href = href; return; }
  b.style.transition = 'opacity .18s ease';
  b.style.opacity = '0';
  setTimeout(function () { b.style.opacity = '1'; b.style.transition = ''; }, 1200);
  setTimeout(function () { window.location.href = href; }, 180);
};
window.addEventListener('pageshow', function (e) {
  if (e.persisted && document.body && document.body.style.opacity === '0') { document.body.style.opacity = '1'; document.body.style.transition = ''; }
});

/* ---------- R111：弹窗三模式统一关闭 kit（全站共用） ----------
   口径：×/取消 = 丢弃；点外 / Esc = 暂存草稿；确定/保存 = 保存数据。
   各页 register(mask, {discard, stash})（两个 fn 自行完成关窗）；kit 维护「打开栈」，
   Esc 只关最上面一层并走该层的暂存通道（admin 旧的一刀切全关已废除）。
   先行 Esc 处理器（如 admin 富文本放大态退出）置 e.__escPre = true 后本 kit 不再动作。 */
window.__modalKit = (function () {
  var stack = [];
  var reg = [];
  /* ===== R186 建议3：Android 返回键 / 浏览器返回手势 优先关最上层弹窗（不退出页面，全站）=====
     原理：弹窗打开 pushState 一条哨兵（URL 不变）；返回键触发 popstate 时关最上层（走 Esc 同款丢弃通道）；
     用户点 ×/确定等主动关闭时，自动 back 抵消那条哨兵，历史不留垃圾。
     __navSuppress：popstate 引起的关闭（历史已消耗，不再 back）；__navBack：主动关闭的 back 在途计数。
     __navLast=-1 基线：页面加载时已开的弹窗不算导航事件。 */
  /* ===== R214（老板线上实测反馈）：哨兵实账修复 =====
     根因：基线期打开的弹窗（老访客 localStorage 缓存公告在脚本同步期即弹开，早于首次 60ms tick）
     不 push 哨兵，但关闭时旧逻辑仍按「关了几个就 back 几次」抵消——抵消一条从未 push 过的哨兵，
     history.back() 直接把从导航页进来的访客弹回导航页（进资源页点任意按钮/遮罩关公告即触发）。
     修复：新增 __navSent「真实 push 过的哨兵数」实账——只有确实 push 过的哨兵才 back 抵消；
     基线期弹窗的关闭不再产生任何历史操作。v212 对照树同款复现，属 R186 设计遗留而非 R211/R213 回归。 */
  var __navLast = -1, __navSuppress = 0, __navBack = 0, __navT = 0, __navSent = 0;
  function __navTick() {
    var cur = stack.length;
    if (__navLast < 0) { __navLast = cur; return; }
    if (cur > __navLast) {
      for (var i = 0; i < cur - __navLast; i++) { try { history.pushState({ __modalNav: 1 }, '', location.href); } catch (e) {} }
      __navSent += cur - __navLast;
    } else if (cur < __navLast) {
      var drop = __navLast - cur;
      if (__navSuppress > 0) { /* popstate 关闭：浏览器返回键已消耗对应哨兵，同步实账 */
        var used = Math.min(drop, __navSuppress);
        __navSuppress -= used; __navSent = Math.max(0, __navSent - used); drop -= used;
      }
      var backs = Math.min(drop, __navSent); /* R214：只为真正 push 过的哨兵 back——基线期弹窗关闭不再误弹回上一页 */
      if (backs > 0) { __navBack += backs; __navSent -= backs; for (var j = 0; j < backs; j++) { try { history.back(); } catch (e) {} } }
    }
    __navLast = cur;
  }
  window.addEventListener('popstate', function () {
    if (__navBack > 0) { __navBack--; return; } /* 主动关闭弹窗的抵消 back，非返回键 */
    if (stack.length) { __navSuppress++; close(stack[stack.length - 1], 'stash'); } /* 返回键 = Esc 同款：关最上层（R257：与点外同为暂存口径） */
  });
  function entry(m) { for (var i = 0; i < reg.length; i++) if (reg[i].mask === m) return reg[i]; return null; }
  function sync(m) {
    var open = !!(m.classList && m.classList.contains('open'));
    var idx = stack.indexOf(m);
    if (open && idx < 0) stack.push(m);
    else if (!open && idx >= 0) stack.splice(idx, 1);
    clearTimeout(__navT); __navT = setTimeout(__navTick, 60); /* R186 建议3：开/关变化 → 防抖协调历史栈 */
  }
  function register(mask, handlers) {
    if (!mask || entry(mask)) return; // 幂等
    reg.push({ mask: mask, discard: handlers && handlers.discard, stash: handlers && handlers.stash });
    try { new MutationObserver(function () { sync(mask); }).observe(mask, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    sync(mask);
  }
  function close(mask, mode) {
    var h = entry(mask);
    if (!h) return;
    var fn = mode === 'discard' ? (h.discard || h.stash) : (h.stash || h.discard);
    try { if (fn) fn.call(mask, mask); } catch (err) { try { console.error(err); } catch (e2) {} }
    try { mask.classList.remove('open'); } catch (e) {}
    try { mask.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) {}
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || e.__escPre) return;
    if (!stack.length) return;
    e.preventDefault();
    close(stack[stack.length - 1], 'stash'); // R257（老板 09-23 19:08）：Esc/返回键=暂存（与点外关闭同口径，×/取消键=明确丢弃）——R147 全站 Esc 丢弃口径按老板「关了重开编辑状态应保留」反馈废除
  });
  /* R217 条8（老板 09-21）：R192 的「下滑手势关闭弹窗」整个删除——老板原意只保留点外关闭/×/Esc，
     上下滑关弹窗的手势（含电脑端同类拖拽关闭，全系统本就只有这一处 touch 手势实现）清干净。 */
  return { register: register, close: close, stack: stack };
})();

/* ===== R186 建议1：搜索历史（前后台搜索框通用组件）=====
   pushSearchHist(key, kw)：搜索执行时记录（去重置顶、最多 8 条、localStorage）；
   bindSearchHist(wrap, input, key)：搜索框 focus（值为空）时显示最近搜索下拉——
   词条按键复用 .tab 淡蓝胶囊家族（R185 用户拍板的搜索场景家族观感）；
   单条删除复用 R186 × 回退标准（灰圆、hover/点击变红），尾部「清空」一键全删。
   点词条 = 填入并派发 input 事件（复用两页现有搜索管线），Esc/失焦收起。 */
window.pushSearchHist = function (key, kw) {
  kw = (kw || '').trim(); if (!kw) return;
  try {
    var arr = JSON.parse(localStorage.getItem(key) || '[]');
    for (var i = 0; i < arr.length; i++) if (arr[i] === kw) { arr.splice(i, 1); break; }
    arr.unshift(kw);
    if (arr.length > 8) arr.length = 8;
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {}
};
window.bindSearchHist = function (wrap, input, key) {
  if (!wrap || !input || !window.__uiCommonLoaded) return;
  var box = document.createElement('div');
  box.className = 'search-hist';
  box.style.display = 'none';
  wrap.appendChild(box);
  function getArr() { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
  function setArr(a) { try { localStorage.setItem(key, JSON.stringify(a)); } catch (e) {} }
  function hide() { box.style.display = 'none'; }
  function render() {
    var arr = getArr();
    if (!arr.length) { hide(); return; }
    var html = '<div class="sh-head"><span class="sh-title">最近搜索</span><button type="button" class="sh-clear">清空</button></div><div class="sh-list">';
    for (var i = 0; i < arr.length; i++) {
      var w = String(arr[i]).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      html += '<span class="sh-item"><button type="button" class="sh-word" data-w="' + w + '">' + w + '</button><button type="button" class="sh-del" data-i="' + i + '" title="删除这条">×</button></span>';
    }
    html += '</div>';
    box.innerHTML = html;
    box.style.display = 'block';
  }
  function pick(w) {
    input.value = w;
    hide();
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  box.addEventListener('mousedown', function (e) { e.preventDefault(); }); /* 防止点击先触发 input blur 收起 */
  box.addEventListener('click', function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains('sh-word')) { pick(t.getAttribute('data-w') || t.textContent); return; }
    if (t.classList && t.classList.contains('sh-del')) {
      var arr = getArr(); var i = parseInt(t.getAttribute('data-i'), 10);
      if (!isNaN(i) && i >= 0 && i < arr.length) { arr.splice(i, 1); setArr(arr); }
      render(); return;
    }
    if (t.classList && t.classList.contains('sh-clear')) { setArr([]); hide(); return; }
  });
  input.addEventListener('focus', function () { if (!input.value) render(); });
  input.addEventListener('input', function () { if (input.value) hide(); else render(); });
  input.addEventListener('blur', function () { setTimeout(hide, 160); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
};

// ===== R119：图片占位符统一灰色线边框（全站兜底）=====
// 捕获阶段监听 IMG 加载失败（error 不冒泡但捕获可达），失败即加 .media-fail 灰边类；
// 与各页占位替换逻辑叠加（class 幂等，重复添加无害），换上占位图后边框保留，失败边界始终可见。
(function () {
  document.addEventListener('error', function (e) {
    try {
      var t = e.target;
      if (t && t.tagName === 'IMG' && !t.classList.contains('media-fail')) t.classList.add('media-fail');
    } catch (err) {}
  }, true);
})();


/* ===== R167（用户 20:27 定稿·全站版）：截断文字悬停/点按小框 #uiTip =====
   收编自 admin.js 的 R102/R105/R106/R165 实现（原「只做后台」口径由用户新指令推翻：全系统、电脑手机都生效）。
   电脑：mouseover 全局委托——文字实际被截断（scrollWidth/Height 超出）才弹，显示全的不弹；
   手机：click 白名单委托——点一下被截断的文本弹小框看全文，点别处关闭。
   白名单覆盖全站截断元素：后台表格单元格/分类名/类型名/产品标题/副标题 + 前台卡片标题/简介/店铺名/类型tab。
   命中元素若本身有点击行为（前台资源卡开详情、类型tab切换）不拦截——弹窗一开，
   syncBodyLock 重算滚动锁时顺带隐藏小框（见上），互不打架；tab 切换重渲染后元素脱离文档也会自动收起。
   样式在 ui-common.css #uiTip（四页共用，含暗色变量）。 */
(function () {
  if (window.__uiTipLoaded) return;
  window.__uiTipLoaded = true;
  var tip = null, cur = null;
  var __lastTxt = null, __lastW = 0, __lastH = 0, __showAt = 0; // R171：文本尺寸缓存 + 显示冷静期时间戳
  function getTip() {
    if (!tip) { tip = document.createElement('div'); tip.id = 'uiTip'; document.body.appendChild(tip); }
    return tip;
  }
  function clipped(el) { return el.scrollHeight - el.clientHeight > 1 || clippedX(el); }
  // R165：单行截断容器判定——scrollWidth 超宽但行高未超（水平省略号截断），
  // 区别于 R106 排除的限高滚动容器（垂直溢出误判）。网格卡片副标题 .p-sub 带子元素（分类/简介/金额），
  // leafText 判 false 旧逻辑弹不出，此分支让「展示不全有省略号」的容器也能点开看全文（复用 #uiTip 查看框）。
  // R179（用户 19:29）：有些省略号点击不显示——WebKit/iOS 内核对 text-overflow:ellipsis 的截断
  // 不计入 scrollWidth（scrollWidth==clientWidth），纯差值判定整类漏弹；补 Range 实测兜底：
  // Range 选中元素全部内容量布局宽，与 clientWidth 差 >1px 即真截断（Chromium 下与 scrollWidth 同值）。
  function clippedX(el) {
    if (el.scrollHeight - el.clientHeight > 1) return false; // 多行限高容器（R106 .form 类）不在水平截断职责内
    if (el.scrollWidth - el.clientWidth > 1) return true;
    if (el.clientWidth <= 0) return false;
    try {
      var rng = document.createRange(); rng.selectNodeContents(el);
      return rng.getBoundingClientRect().width - el.clientWidth > 1;
    } catch (e0) { return false; }
  }
  // R167：弹窗已打开时，弹窗外的元素不再弹小框——前台手机点被截断的资源卡标题会同时打开
  // 详情弹窗（card 的 click 先于 document 委托执行、class 已同步可见），此时小框弹了也会被
  // syncBodyLock 立刻收起等于闪一下；弹窗内的截断元素（如详情弹窗里的类型 tab）照常弹。
  function anyModalOpen() {
    return !!document.querySelector('.modal-mask.open,.kf-mask.open,.share-mask.open,.alert-mask.open,.lightbox.open,.ann-modal.open,.ann-box.open,.stat-modal.open');
  }
  function show(el) {
    var txt = (el.textContent || '').trim();
    if (!txt) return;
    if (anyModalOpen() && !el.closest('.modal-mask,.kf-mask,.share-mask,.alert-mask,.lightbox,.ann-modal,.ann-box,.stat-modal')) return;
    cur = el; __showAt = Date.now();
    var t = getTip();
    // R179（用户 19:29）：小框展示的文字与原文本一模一样（含颜色）——旧实现 textContent 纯文本+
    // 容器固定 color:var(--text)，富文本里的彩色字全被染黑不美观；改 innerHTML 克隆原元素内容，
    // 内联彩色 span 原样保留，无内联色的文字继续继承 #uiTip 默认色
    t.innerHTML = el.innerHTML;
    t.style.display = 'block';
    var r = el.getBoundingClientRect();
    // R171（用户 23:08）：同文本免二次测量——省一次强制回流，点截断文字不再卡顿
    var w, h;
    if (__lastTxt === txt) { w = __lastW; h = __lastH; }
    else {
      t.style.left = '0px'; t.style.top = '0px';
      w = t.offsetWidth; h = t.offsetHeight;
      __lastTxt = txt; __lastW = w; __lastH = h;
    }
    // R165/R167 右缘钳制口径（与后台分类下拉面板同款）：左右上下都钳在屏幕内，永不越出
    var x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    var y = r.bottom + 6;
    if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 6);
    t.style.left = x + 'px'; t.style.top = y + 'px';
    // R171（用户 23:08）：瞬消根治——命中元素被重渲染换掉（类型 tab 切换重建）时，
    // 先在白名单里找同文本的截断元素接替 cur（小框保留供阅读），找不到才收起；
    // 旧实现 350ms isConnected 检查直接 hide，正是「显示一瞬间就消失」的元凶
    setTimeout(function () {
      if (cur && !cur.isConnected) {
        var txt2 = (cur.textContent || '').trim(), found = null;
        try {
          document.querySelectorAll(PICKSEL).forEach(function (n) {
            if (!found && n.isConnected && ((n.textContent || '').trim()) === txt2 && (clipped(n) || clippedX(n))) found = n;
          });
        } catch (e1) {}
        if (found) { cur = found; return; }
        hide();
      }
    }, 350);
  }
  function hide() { __pendingEl = null; if (tip) tip.style.display = 'none'; cur = null; }
  // R173（用户 00:32）：show 的弹出延迟到下一帧（rAF）——点击/悬停处理器先同步返回，
  // 按键的按压反馈与动作在同一帧完成渲染，小框的测量+定位（含强制回流）不再阻塞点击主线程；
  // 连续划过/快速连点时只生效最后一次目标，天然去抖。hide() 会取消 pending（先点截断文字再立刻点空白处不会误弹）
  var __pendingEl = null;
  function __rAFshow(el) {
    __pendingEl = el;
    requestAnimationFrame(function () {
      if (__pendingEl !== el || !el.isConnected) return;
      __pendingEl = null;
      show(el);
    });
  }
  // R167：供 syncBodyLock 调用——任何弹窗开合时隐藏小框（前台点卡片标题：详情弹窗滑入瞬间小框消失）
  window.__hideUiTip = hide;
  var SKIP = 'input,textarea,select,button,a,.rte-editor,pre,code,canvas,svg,video,img,iframe';
  // R106 修复：只对「无子元素的文本叶子」弹小框——带子元素的容器（如限高滚动的 .form 表单）
  // 也会 scrollHeight 溢出被 clipped() 误判成"截断文本"，划过字段间隙就会把整个表单的文字全弹出来
  function leafText(el) { return el.children.length === 0 && (el.textContent || '').trim().length > 0; }
  // R167 全站白名单（桌面悬停与手机点按同源）：后台 + 前台截断元素统一一份
  // R179（用户 19:29）：补漏——.cpd-text（全站下拉选择框显示文本）、.cp-name（资源码下拉面板类型名，
  // R177 起截断省略号但不在名单点了没反应）、.v-price（类型行金额，R179 起手机档截断）之前点击不显示
  var PICKSEL = 'td, th, .c-name, .v-name, .p-title, .p-sub, .card-title, .card-desc, .shop-name, .variant-tab, .cpd-text, .cp-name, .v-price';
  // R171（用户 23:08）：mouseover/mouseout 只在真 hover 设备绑定——手机 tap 会先派发模拟
  // mouseover 再派发 click，同一 tap 双份 show（各含强制回流）即「点击卡卡的」主因之一
  var __hoverDev = window.matchMedia ? window.matchMedia('(hover: hover)').matches : true;
  if (__hoverDev) document.addEventListener('mouseover', function (ev) {
    var el = ev.target;
    if (!(el instanceof Element) || !el.closest) return;
    if (el.closest(SKIP)) return;
    if (leafText(el) && clipped(el)) { __rAFshow(el); return; }
    var box = el.closest(PICKSEL); // R165：带子元素的单行截断容器（网格卡片副标题等）悬停看全文
    if (box && clippedX(box)) { __rAFshow(box); return; }
    if (cur && !cur.contains(el)) hide();
  });
  // R173（用户 00:32「显示一瞬间就消失，手机端特别明显」）：补 mouseout 的 __hoverDev 门控——
  // R171 只给 mouseover 加了门控，mouseout 仍无条件绑定；真机手机 tap 后浏览器清理模拟 hover 状态时
  // 会派发合成 mouseout（relatedTarget=null），旧实现 if(!to) 直接 hide() 把刚弹的小框瞬间收走，
  // 这正是手机端"只显示一瞬间"的残留元凶（headless 合成 tap 不派发该事件，此前未抓到）
  document.addEventListener('mouseout', function (ev) {
    if (!__hoverDev) return;
    if (!cur) return;
    var to = ev.relatedTarget;
    if (!to || (to !== cur && !cur.contains(to))) hide();
  });
  // 手机：点一下被截断的信息文本弹小框（白名单，避开按钮/链接/码复制等点击行为）；点别处关闭
  document.addEventListener('click', function (ev) {
    var el = ev.target;
    if (!(el instanceof Element) || !el.closest) { hide(); return; }
    if (el.closest(SKIP)) { hide(); return; }
    var hit = el.closest(PICKSEL);
    // R106：手机点按同样只认文本叶子（容器误弹同上）；R165：单行截断容器（.p-sub 等）命中 clippedX 也弹
    // R173：__rAFshow 延迟一帧弹出——点截断按键时按键动作先完成（不卡），小框下一帧再弹
    if (hit && ((leafText(hit) && clipped(hit)) || clippedX(hit))) { __rAFshow(hit); return; }
    hide();
  });
  // R171：show 后 400ms 内忽略 scroll 收框——手机 tap 常伴随视口微滚动（地址栏/焦点重排），
  // 旧实现小框刚弹出就被 scroll capture hide 收走，即「只显示一瞬间」的另一个元凶
  window.addEventListener('scroll', function () { if (Date.now() - __showAt < 400) return; hide(); }, true);
  // R173：resize 同款 400ms 冷静期——手机地址栏收起/软键盘弹出都会派发 resize，旧实现立即收框，
  // 也是「显示一瞬间就消失」的组成路径；真实窗口变化超过冷静期照常收框
  window.addEventListener('resize', function () { if (Date.now() - __showAt < 400) return; hide(); });
})();

// ===== R183（用户 09-17 终极清单拍板）：全站公共小部件 =====
// 条12：触觉反馈——仅移动端（粗指针）复制/保存成功轻震 10ms；不支持的设备静默跳过
window.__haptic = function () {
  try {
    if (navigator.vibrate && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) navigator.vibrate(10);
  } catch (e) {}
};
// 条4：按钮忙碌态（文字 + 转圈图标；不动 disabled 防重与全屏遮罩——用户拍板「防重复点击，也代替全屏遮罩」不做）
window.__btnBusy = function (btn, text) {
  if (!btn) return;
  btn.textContent = text;
  var s = document.createElement('span');
  s.className = 'btn-spin';
  btn.insertBefore(s, btn.firstChild);
};
// 条11：复制成功反馈（键短暂变绿 1.2s + 手机轻震）
window.__copyOk = function (el) {
  if (!el) return;
  window.__haptic();
  try { el.classList.add('copy-ok'); } catch (e) {}
  setTimeout(function () { try { el.classList.remove('copy-ok'); } catch (e) {} }, 1500); /* R184 条11：1.2s→1.5s（用户拍板） */
};
// 条8：全站弹窗「从哪开、从哪关」对称收缩——观察所有弹窗遮罩的 class 变化：
// 任何路径移除 .open 的当帧，先补挂 .mask-closing（CSS 维持 display:flex 并播 --dur-close 160ms 收缩，R231 条10），200ms 后摘类收尾（留 40ms 缓冲防截断）；
// 收缩期间重新 add('open') 会自然触发生成新记录 → 撤掉收缩态、重放入场动画（无卡死窗口）
(function () {
  var MASK_SEL = '.modal-mask, .share-mask, .kf-mask, .lightbox';
  function hasOpen(cls) { return !!cls && (' ' + cls + ' ').indexOf(' open ') !== -1; }
  var mo = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      var el = m.target;
      if (!el || el.nodeType !== 1 || !el.classList) return;
      var oldCls = m.oldValue || '';
      if (oldCls.indexOf('mask-closing') !== -1) return; // 自己的收尾清理，忽略
      if (hasOpen(oldCls) && !hasOpen(el.className)) {
        if (!(el.matches && el.matches(MASK_SEL))) return;
        if (el.__mcTimer) { clearTimeout(el.__mcTimer); el.__mcTimer = null; }
        el.classList.add('mask-closing');
        el.__mcTimer = setTimeout(function () {
          el.__mcTimer = null;
          try { el.classList.remove('mask-closing'); } catch (e) {}
        }, 200);
      } else if (hasOpen(el.className) && el.classList.contains('mask-closing')) {
        // 关闭动画期间又重开：撤掉收缩态，恢复入场
        if (el.__mcTimer) { clearTimeout(el.__mcTimer); el.__mcTimer = null; }
        el.classList.remove('mask-closing');
      }
    });
  });
  mo.observe(document.documentElement, { subtree: true, attributeFilter: ['class'], attributeOldValue: true });
})();

/* ===== R184 条5：顶部网络进度条（全局 fetch 包装，四页统一）=====
   快请求（150ms 内完成）不显示——防闪烁噪音；慢请求显示顶部 2px 蓝条渐进推进（渐近 88% 封顶），
   完成后推满 100% 并 200ms 淡出。覆盖全站所有 fetch（含 shop/admin 各自的 api() 封装）。 */
(function () {
  if (window.__fetchBarInstalled) return;
  window.__fetchBarInstalled = true;
  var bar = null, active = 0, shown = false, showTimer = null, hideTimer = null, growTimer = null, w = 0;
  function ensure() {
    if (!bar) { bar = document.createElement('div'); bar.id = 'fetch-bar'; document.body.appendChild(bar); }
    return bar;
  }
  function start() {
    active++;
    if (active === 1 && !shown) {
      clearTimeout(showTimer);
      showTimer = setTimeout(function () {
        if (active <= 0) return;
        shown = true; w = 12;
        var b = ensure();
        b.style.transform = 'scaleX(0.12)'; b.style.opacity = '1'; /* R231 条2：width→scaleX */
        clearInterval(growTimer);
        growTimer = setInterval(function () {
          if (active <= 0 || w >= 86) return;
          w += (88 - w) * 0.08;
          if (bar) bar.style.transform = 'scaleX(' + (w / 100) + ')'; /* R231 条2 */
        }, 400);
      }, 150);
    }
  }
  function finish() {
    if (active > 0) active--;
    if (active === 0) {
      clearTimeout(showTimer);
      clearInterval(growTimer);
      if (shown) {
        var b = ensure();
        b.style.transform = 'scaleX(1)'; /* R231 条2 */
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
          b.style.opacity = '0';
          setTimeout(function () { if (active === 0 && bar) bar.style.transform = 'scaleX(0)'; }, 250); /* R231 条2 */
          shown = false;
        }, 180);
      }
    }
  }
  var _fetch = window.fetch.bind(window);
  window.fetch = function () {
    var p;
    try { p = _fetch.apply(window, arguments); } catch (e) { throw e; }
    if (!p || typeof p.then !== 'function') return p;
    start();
    return p.then(function (r) { finish(); return r; }, function (e) { finish(); throw e; });
  };
})();


/* ===== R193 二⑤⑦（用户 22:32 定稿）：长按小菜单（全站统一组件）=====
 * 触屏长按 500ms / 桌面右键呼出；条目白卡圆角、hover 灰底，颜色只用现有 Token，深色自动跟随。
 * window.__ctxMenu.show(x, y, [{label, fn}])  —— 坐标呼出
 * window.__ctxMenu.bind(root, selector, getItems) —— 容器委托绑定（root 内长按/右键 selector 命中元素）
 * shop 页用法见 shop.js R193 段：卡片/图片/文字三类绑定。 */
window.__ctxMenu = (function () {
  var menuEl = null;
  function ensure() {
    if (menuEl) return menuEl;
    menuEl = document.createElement('div');
    menuEl.className = 'ctx-menu';
    menuEl.setAttribute('role', 'menu');
    document.body.appendChild(menuEl);
    // 任意处按下/滚动即收起（菜单自身点击除外）
    document.addEventListener('touchstart', function (e) { if (!menuEl.contains(e.target)) hide(); }, { passive: true, capture: true });
    document.addEventListener('mousedown', function (e) { if (!menuEl.contains(e.target)) hide(); }, true);
    window.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('resize', hide, { passive: true });
    return menuEl;
  }
  function hide() { if (menuEl) menuEl.style.display = 'none'; }
  function show(x, y, items) {
    if (!items || !items.length) return;
    var m = ensure();
    m.innerHTML = '';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ctx-item';
      b.textContent = it.label;
      b.addEventListener('click', function (e) { e.stopPropagation(); hide(); try { it.fn(); } catch (err) {} });
      m.appendChild(b);
    });
    m.style.display = 'block';
    m.style.left = '0px';
    m.style.top = '0px';
    var r = m.getBoundingClientRect();
    var px = Math.min(Math.max(8, x), window.innerWidth - r.width - 8);
    var py = (y + r.height > window.innerHeight - 8) ? Math.max(8, window.innerHeight - r.height - 8) : y;
    m.style.left = px + 'px';
    m.style.top = py + 'px';
  }
  function bind(root, selector, getItems) {
    if (!root) return;
    var timer = null, sx = 0, sy = 0, lastHit = null;
    root.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { if (timer) { clearTimeout(timer); timer = null; } return; }
      var t = e.touches[0];
      var hit = e.target.closest ? e.target.closest(selector) : null;
      sx = t.clientX; sy = t.clientY; lastHit = hit;
      if (!hit) return;
      var cx = t.clientX, cy = t.clientY;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        show(cx, cy, getItems(hit, e));
      }, 500);
    }, { passive: true });
    root.addEventListener('touchmove', function (e) {
      if (!timer) return;
      var t = e.touches[0];
      if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) { clearTimeout(timer); timer = null; }
    }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (timer) { clearTimeout(timer); timer = null; return; }
      /* 菜单刚弹出的这次 touchend 吞掉，避免落点处再触发一次点击（比如打开详情弹窗） */
      if (menuEl && menuEl.style.display === 'block' && lastHit) { lastHit = null; try { e.preventDefault(); } catch (err) {} }
    }, { passive: false });
    root.addEventListener('touchcancel', function () { if (timer) { clearTimeout(timer); timer = null; } }, { passive: true });
    root.addEventListener('contextmenu', function (e) {
      var hit = e.target.closest ? e.target.closest(selector) : null;
      if (!hit) return;
      e.preventDefault();
      show(e.clientX, e.clientY, getItems(hit, e));
    });
  }
  return { show: show, hide: hide, bind: bind };
})();

/* ===== R205（用户 09-18 13:13 全系统整洁专项）：合并 shop.js/admin.js 三份重复逻辑到 ui-common.js 全局函数 ===== */
// 格式化价格（0=免费不显示，整数=¥N，小数=¥N.xx）
window.formatPrice = function (price) {
  var p = Number(price) || 0;
  if (p <= 0) return '';
  if (p === Math.floor(p)) return '¥' + p;
  return '¥' + p.toFixed(2);
};
// 灯箱绑定：为 root 内所有 img/video 添加单击放大
window.bindLightbox = function (root) {
  if (!root) return;
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
};
// 触发视图切换动画（重排触发 transition）
window.triggerViewAnim = function (el) { if (!el) return; el.classList.remove('view-switch-anim'); void el.offsetWidth; el.classList.add('view-switch-anim'); };

// R211（用户 09-19 17:10）：按钮状态链——转圈→✓→恢复
window.__btnSuccess = function(btn, doneText) {
  if (!btn) return;
  var originalText = btn.dataset.__btnOriginal || '';
  var originalHTML = btn.dataset.__btnOriginalHtml || '';
  if (!originalText && !originalHTML) {
    originalText = btn.textContent || '';
    btn.dataset.__btnOriginal = originalText;
    btn.dataset.__btnOriginalHtml = btn.innerHTML;
  }
  btn.innerHTML = '<span style="display:inline-block;transform:scale(0.6);animation:btnSuccessPop 120ms var(--ease-out, ease) forwards;">✓</span> ' + (doneText || '');
  btn.disabled = true;
  setTimeout(function() {
    btn.innerHTML = btn.dataset.__btnOriginalHtml || btn.dataset.__btnOriginal || '';
    btn.disabled = false;
    delete btn.dataset.__btnOriginal;
    delete btn.dataset.__btnOriginalHtml;
  }, 600);
};

/* ---------- R211 二批（用户 09-20 老板点名「列表↔网格切换平滑飞过去」）：FLIP 动画器 ----------
   First-Last-Invert-Play：切换布局时卡片从旧位置平滑飞到新位置，而不是整容器淡入重播。
   规格（UI 设计师清单 7.1-7.5）：只动 transform（不动 width/height/top/left/margin）、错峰 20ms/项 180ms 封顶、
   单屏 ≤20 个元素（超出直接瞬移）、手势隔离（window.__flipAnimating 全局标记 + 容器 pointer-events:none）、
   动画结束清内联样式、prefers-reduced-motion / 老浏览器无 transform 直接切换无动画。
   注：内联 transform/transition 用 setProperty !important 对抗 .product-card 的 transition !important 既有规则。 */
window.FlipAnimator = function (container) {
  this.container = typeof container === 'string' ? document.querySelector(container) : container;
  this.isAnimating = false;
  this._gen = 0; // 动画代际标记：打断旧动画后，旧 rAF 回调凭此失活
};
// 立即结束当前动画（跳到终位）：快速连点时先落位上一次，再接续新一次切换，保证终态跟手
window.FlipAnimator.prototype.finish = function () {
  this._gen++;
  if (this._cleanupTimer) { clearTimeout(this._cleanupTimer); this._cleanupTimer = null; }
  if (this._animEls) {
    var els = this._animEls;
    for (var i = 0; i < els.length; i++) {
      var s = els[i].style;
      s.removeProperty('transition'); s.removeProperty('transition-delay');
      s.removeProperty('transform'); s.removeProperty('transform-origin');
    }
    this._animEls = null;
  }
  if (this.container) this.container.style.pointerEvents = '';
  this.isAnimating = false;
  window.__flipAnimating = false;
};
window.FlipAnimator.prototype.flip = function (mutateFn, options) {
  var self = this;
  var opts = options || {};
  var duration = opts.duration || 300;
  var easing = opts.easing || 'var(--ease-emphasized)';
  var stagger = (opts.stagger !== undefined) ? opts.stagger : 20;
  var maxStagger = (opts.maxStagger !== undefined) ? opts.maxStagger : 180;
  if (!this.container || typeof mutateFn !== 'function') return false;
  // 降级一：系统开了「减少动态效果」→ 直接切换，无动画
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { mutateFn(); return false; }
  // 降级二：老浏览器（Safari 15 以下）无 transform → 直接切换
  if (!('transform' in document.body.style)) { mutateFn(); return false; }
  // 防重入：动画进行中快速连点 → 立即结束上一次（跳到终位）再接续新切换，终态永远跟手
  if (this.isAnimating) this.finish();
  this.isAnimating = true;
  var gen = ++this._gen; // 本次动画的代际：finish() 会自增使旧 rAF 回调失活
  window.__flipAnimating = true; // 手势隔离全局标记：下拉刷新/弹窗滑动/双击缩放判定首行检查
  this.container.style.pointerEvents = 'none'; // 动画期间阻断列表上的点击/触摸（手势隔离主通道）
  // 1. First：记录前 20 个子元素当前位置（超出 20 个的直接瞬移）
  var children = Array.prototype.slice.call(this.container.children, 0, 20);
  var firstStates = children.map(function (el) {
    var r = el.getBoundingClientRect();
    return { el: el, x: r.left, y: r.top, w: r.width, h: r.height };
  });
  // 2. Last：执行 DOM 变更（切 class 改布局）
  mutateFn();
  // 3. Invert：按差值反向位移/缩放，瞬时定格在旧位置
  firstStates.forEach(function (st) {
    var r = st.el.getBoundingClientRect();
    var dx = st.x - r.left, dy = st.y - r.top;
    var dw = r.width ? st.w / r.width : 1, dh = r.height ? st.h / r.height : 1;
    if (!dx && !dy && dw === 1 && dh === 1) { st.skip = true; return; } // 位置没变的元素不参与动画
    var s = st.el.style;
    s.setProperty('transition', 'none', 'important');
    s.setProperty('transform', 'translate(' + dx + 'px,' + dy + 'px) scale(' + dw + ',' + dh + ')', 'important');
    s.setProperty('transform-origin', 'top left', 'important');
  });
  // 强制回流，确保 Invert 样式先落地
  void this.container.offsetHeight;
  // 4. Play：双 rAF 后清 transform，让元素从旧位过渡到新位（代际失守 = 动画已被打断，回调作废）
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (gen !== self._gen) return;
      firstStates.forEach(function (st, i) {
        if (st.skip) return;
        var delay = Math.min(i * stagger, maxStagger);
        var s = st.el.style;
        s.setProperty('transition', 'transform ' + duration + 'ms ' + easing, 'important');
        s.setProperty('transition-delay', delay + 'ms', 'important');
        s.removeProperty('transform');
      });
    });
  });
  // 5. 清理：动画+最大错峰+50ms 缓冲后还原全部内联样式，解除手势隔离（登记到实例供 finish() 打断）
  this._animEls = children;
  this._cleanupTimer = setTimeout(function () {
    firstStates.forEach(function (st) {
      st.el.style.removeProperty('transition');
      st.el.style.removeProperty('transition-delay');
      st.el.style.removeProperty('transform');
      st.el.style.removeProperty('transform-origin');
    });
    self.container.style.pointerEvents = '';
    self.isAnimating = false;
    window.__flipAnimating = false;
  }, duration + maxStagger + 50);
  return true;
};

/* R231（用户 09-21 23:38）条11：toast 公共队列——管理页与资源页同款（连续触发排队逐条展示，
   每条停留 2s + 0.3s 淡出，不再同位叠加/单条顶掉）。观感走 ui-common.css .ui-toast 公共类
   （R192 定稿：白底0.92+蓝字+圆角20），入场 uiToastDrop 240ms 带下落分量；
   语义色 type='error' 红，success/info 走默认蓝。reduced-motion 由全局兜底归零（瞬显）。 */
window.uiToast = (function () {
  var q = [], busy = false;
  function next() {
    if (!q.length) { busy = false; return; }
    busy = true;
    var it = q.shift();
    var t = document.createElement('div');
    t.className = 'ui-toast' + (it.t === 'error' ? ' error' : '');
    t.textContent = it.m;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('leaving'); }, 2000);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); next(); }, 2300);
  }
  return function (msg, type) {
    q.push({ m: String(msg || ''), t: type || '' });
    if (!busy) next();
  };
})();


/* R241（用户 09-22 19:19）：弹窗滚动位置按「弹窗 × 对象」独立记忆。
   症状：对象 A 的弹窗滚到中间后关闭，打开对象 B 的同类弹窗时停在上一个对象滚到的位置。
   根因：同类型弹窗共用同一套 DOM（mask + .form 等滚动容器），关闭只 remove('open')，
   滚动容器 scrollTop 原样残留，下一个对象打开时直接继承。
   修法：在带对象弹窗的打开点统一接管——
   - 切换到不同对象：先把残留位置记到上一对象名下，再恢复本对象的记忆（无记忆回顶）；
   - 同一对象重开：残留即最新位置，保持不动（既有认可行为不变）；
   - 无对象弹窗（不传 objKey）：不接管，维持原行为（重开停在原位=单例弹窗的原位置恢复）。
   滚动容器白名单：mask 自身 + .modal-box（弹窗盒，preview/shop 详情实际滚动通道）+ .form（admin 表单）
   + .rte-editor（富文本）+ .preview-body + #bindingsScroll——多容器都记都恢复，各滚各的互不影响。
   保存动作放在「下一次打开」而非「关闭」时：DOM 只此一套，关闭态无人滚动它，
   行为与「关闭即保存」完全等价，且不必逐一触碰全站 20+ 个关闭出口（点外/Esc/×/提交）。
   对象 key 与 R111 草稿同口径（编辑弹窗丢弃草稿时调 forget 同步清位置，重开从头开始）。 */
window.__modalScroll = (function () {
  var lastKey = {}; /* maskId -> 上次打开的对象 key（null/未记录 = 不接管或首开） */
  var posMap = {}; /* 'maskId|objKey|容器序号' -> scrollTop，每个对象每套容器各记各的 */
  function scrollers(mask) {
    var list = [mask];
    try {
      var inl = mask.querySelectorAll('.modal-box, .form, .rte-editor, .preview-body, [id="bindingsScroll"]');
      Array.prototype.forEach.call(inl, function (el) { if (list.indexOf(el) === -1) list.push(el); });
    } catch (e) {}
    return list;
  }
  function open(mask, objKey) {
    if (!mask) return;
    var mk = mask.id || '';
    if (!mk) return;
    if (objKey == null) { lastKey[mk] = null; return; } /* 无对象弹窗：不接管 */
    var key = String(objKey);
    var prev = lastKey[mk];
    var scs = scrollers(mask);
    if (prev != null && prev !== key) {
      /* 对象切换：当前残留位置属于上一对象，先记到它名下 */
      scs.forEach(function (el, i) { posMap[mk + '|' + prev + '|' + i] = el.scrollTop || 0; });
    }
    scs.forEach(function (el, i) {
      var saved = (prev === key) ? (el.scrollTop || 0) : posMap[mk + '|' + key + '|' + i];
      el.scrollTop = (saved != null) ? saved : 0; /* 同对象沿用残留；切换对象查记忆，无记忆回顶 */
    });
    lastKey[mk] = key;
  }
  function forget(mask, objKey) { /* 丢弃草稿（R111 ×/取消/保存成功）时同步清该对象的位置记忆 */
    if (!mask) return;
    var mk = mask.id || '';
    if (!mk) return;
    var key = (objKey == null) ? lastKey[mk] : String(objKey);
    if (key == null) return;
    scrollers(mask).forEach(function (el, i) { try { delete posMap[mk + '|' + key + '|' + i]; } catch (e) {} });
    if (lastKey[mk] === key) lastKey[mk] = null;
  }
  return { open: open, forget: forget };
})();

/* R243 条28：长内容回顶按钮（内容超两屏后浮出，全系统统一） */
(function () {
  var btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '&#8593;'; // ↑
  btn.title = '回到顶部';
  btn.setAttribute('aria-label', '回到顶部');
  document.body.appendChild(btn);

  function getActiveScroller() {
    // 优先看当前打开的弹窗里的可滚容器
    var openMask = document.querySelector('.modal-mask.open, .share-mask.open, .kf-mask.open, .lightbox.open');
    if (openMask) {
      var box = openMask.querySelector('.modal-box, .share-box, .kf-box, .lightbox-img');
      if (box && (box.scrollHeight > box.clientHeight * 2)) return box;
    }
    // 再看 window（shop/admin 主页面）
    var de = document.documentElement;
    if ((de.scrollHeight || document.body.scrollHeight) > (window.innerHeight || de.clientHeight) * 2) {
      return window;
    }
    return null;
  }

  function sync() {
    // R243 条28（用户 09-22 23:18）：无操作 class 写也会触发 MutationObserver（Chrome 对未变化的 remove/toggle 同样产生变更记录），观察全 body 的观察器回调再调 sync 会死循环卡死页面 → 写前判等，状态没变就不写。
    var sc = getActiveScroller();
    var has = btn.classList.contains('show');
    if (!sc) { if (has) btn.classList.remove('show'); return; }
    var st = (sc === window) ? (window.scrollY || document.documentElement.scrollTop || 0) : sc.scrollTop;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var want = st > vh * 2;
    if (has !== want) btn.classList.toggle('show', want);
  }

  btn.addEventListener('click', function () {
    var sc = getActiveScroller();
    if (!sc) return;
    if (sc === window) { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else { sc.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  window.addEventListener('scroll', sync, true); // capture  phase  to catch modal scrolls
  // 弹窗开/关时重新判定
  var mo = new MutationObserver(sync);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  setInterval(sync, 800); // 兜底轮询
})();


/* ===== R243 条19②：命令面板（Ctrl+K）全站组件 =====
   从 admin.js R192 后台命令面板 IIFE 抽提参数化——admin 页传页面/操作命令，
   前台页（index/shop/error）传资源直达命令（搜到资源直接打开详情）。
   入口仅键盘 Ctrl+K（桌面端），↑↓ 选择、Enter 执行、Esc 关闭（Esc 已注册进
   __modalKit，与全站弹窗栈路由一致）；面板本身是 DOM 弹层，页面不新增任何图标/按键。
   调用：window.__cpPanel({ placeholder, busy, cmds })
   - cmds: function () { return [{ lab, tag, kw, run }, ...] }（每次呼出实时求值）
   - busy: 编辑类弹窗开着时不抢键的选择器（默认全站弹窗家族）
   样式：ui-common.css .cp-mask 作用域块（与 admin.css 命令面板同值）。 */
window.__cpPanel = function (opts) {
  if (!window.__uiCommonLoaded) return;
  if (window.__cpPanelInst) { window.__cpPanelInst.setCmds(opts && opts.cmds); return; } /* 单实例：重复调用只换命令源 */
  opts = opts || {};
  var getCmds = opts.cmds || function () { return []; };
  var busySel = opts.busy || '.modal-mask.open, .kf-mask.open, .share-mask.open, .ann-mask.open';

  var mask = document.createElement('div');
  mask.className = 'cp-mask'; mask.id = 'cpMask';
  mask.innerHTML =
    '<div class="cp-box" role="dialog" aria-label="命令面板">' +
      '<input class="cp-input" id="cpInput" placeholder="' + (opts.placeholder || '搜索：页面 / 操作 / 资源名…') + '" autocomplete="off" />' +
      '<div class="cp-list" id="cpList"></div>' +
    '</div>';
  document.body.appendChild(mask);
  var input = mask.querySelector('#cpInput'), listEl = mask.querySelector('#cpList');
  var items = [], active = 0;

  function cpClose() { mask.classList.remove('open'); input.value = ''; input.blur(); }
  function cpRender() {
    var kw = input.value.trim().toLowerCase();
    var all = [];
    try { all = getCmds() || []; } catch (e) {}
    items = !kw ? all : all.filter(function (c) { return (c.lab + ' ' + c.kw).toLowerCase().indexOf(kw) !== -1; });
    items = items.slice(0, 10); active = Math.min(active, Math.max(0, items.length - 1));
    if (!items.length) { listEl.innerHTML = '<div class="cp-empty">没有匹配的命令</div>'; return; }
    listEl.innerHTML = '';
    items.forEach(function (c, i) {
      var it = document.createElement('div');
      it.className = 'cp-item' + (i === active ? ' active' : '');
      var lab = document.createElement('span'); lab.className = 'cp-lab'; lab.textContent = c.lab;
      var tag = document.createElement('span'); tag.className = 'cp-tag'; tag.textContent = c.tag;
      it.appendChild(lab); it.appendChild(tag);
      it.addEventListener('mouseenter', function () { active = i; cpPaint(); });
      it.addEventListener('click', function () { cpRun(i); });
      listEl.appendChild(it);
    });
  }
  function cpPaint() {
    Array.prototype.forEach.call(listEl.querySelectorAll('.cp-item'), function (el, i) { el.classList.toggle('active', i === active); });
    var cur = listEl.querySelectorAll('.cp-item')[active]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function cpRun(i) { var c = items[i]; if (!c) return; cpClose(); try { c.run(); } catch (e) { try { console.error(e); } catch (e2) {} } }

  input.addEventListener('input', function () { active = 0; cpRender(); });
  mask.addEventListener('click', function (e) { if (e.target === mask) cpClose(); }); /* R217：点外关闭 */
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { active = (active + 1) % items.length; cpPaint(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { active = (active - 1 + items.length) % items.length; cpPaint(); } }
    else if (e.key === 'Enter') { e.preventDefault(); cpRun(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cpClose(); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (mask.classList.contains('open')) { cpClose(); return; }
      if (busySel && document.querySelector(busySel)) return; /* 任一编辑类弹窗开着时不抢键 */
      active = 0; cpRender(); mask.classList.add('open'); setTimeout(function () { input.focus(); }, 0);
    }
  });
  var tryReg = function () {
    if (window.__modalKit) { window.__modalKit.register(mask, { discard: cpClose, stash: cpClose }); return true; }
    return false;
  };
  if (!tryReg()) {
    var n = 0;
    var t = setInterval(function () { if (tryReg() || ++n > 40) clearInterval(t); }, 50); /* 最多重试 2 秒 */
  }
  window.__cpPanelInst = { setCmds: function (fn) { if (fn) getCmds = fn; } };
};
