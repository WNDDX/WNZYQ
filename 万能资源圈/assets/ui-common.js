/**
 * 万能资源圈 公共 UI（加载标记 + 统一客服弹窗 + 统一提示弹窗）
 * 自定义滚动条已取消：恢复浏览器默认滚动条（用户要求）
 */
window.__uiCommonLoaded = true;

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
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
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

  window.openContactModal = function (url, qrImg, tip, btnText) {
    ensureKfModal();
    var img = document.getElementById('kfQrImg');
    if (img) {
      // 二维码统一出场动画：每次打开都重放（先移除→重排→加载完成后播放），全站任何入口时序一致
      img.classList.remove('kf-qr-in');
      img.onerror = function () { this.onerror = null; this.src = KF_QR_FAIL; if (this.classList) this.classList.add('media-fail'); };
      img.onload = function () { void img.offsetWidth; img.classList.add('kf-qr-in'); };
      img.src = qrImg || '/assets/images/kefu.png';
      if (img.complete && img.naturalWidth) { void img.offsetWidth; img.classList.add('kf-qr-in'); }
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
      // R111：点图片本身不算「弹窗外」，只有点空白遮罩才关（与全站口径一致）
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


  // ===== R50：全站统一暗色模式触发（跟随系统，系统切换实时跟随） =====
  // 变量体系在 ui-common.css（:root 亮色 / [data-theme=dark] 暗色），四页组件已全部接线；
  // 亮色时显式设 data-theme="light"（无 CSS 覆盖，仅语义标记）。
  var __mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (__mq) {
    var __applyTheme = function () { document.documentElement.setAttribute('data-theme', __mq.matches ? 'dark' : 'light'); };
    __applyTheme();
    if (__mq.addEventListener) __mq.addEventListener('change', __applyTheme);
    else if (__mq.addListener) __mq.addListener(__applyTheme);
  }

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
          '<div style="display:flex;"><button type="button" class="alert-ok" style="flex:1;border:none;border-radius:8px;padding:11px 0;background:#1E88E5;color:#fff;font-size:16px;cursor:pointer;letter-spacing:1px;transition:all 0.10s ease;box-shadow:0 2px 6px rgba(30,136,229,0.25);-webkit-tap-highlight-color:transparent;">确定</button></div>' +
        '</div>';
      var titleEl = mask.querySelector('.modal-title');
      var bodyEl = mask.querySelector('.alert-body');
      if (titleEl) titleEl.textContent = (title == null || title === '') ? '提示' : String(title);
      if (bodyEl) bodyEl.textContent = String(msg == null ? '' : msg);
      document.body.appendChild(mask);
      var close = function () {
        try { document.body.removeChild(mask); } catch (e) {}
        if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
      };
      mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
      var ok = mask.querySelector('.alert-ok');
      if (ok) ok.addEventListener('click', close);
      var x = mask.querySelector('.modal-close-x');
      if (x) x.addEventListener('click', close);
      window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    } catch (e) { /* 弹窗失败时回退系统 alert，保证提示不丢失 */ try { window.alert(msg); } catch (e2) {} }
  };

  // ===== R14 全站统一「分享链接」弹窗（复刻资源页分享本站弹窗观感：400px 白卡/标题/tip/链接/确定）=====
  // window.showShareLinkModal(title, url)：标题、链接自动复制到剪贴板并展示
  window.showShareLinkModal = function (title, url) {
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
          '<button class="modal-close-x" data-share-x type="button" aria-label="关闭" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:none;background:#f0f2f5;color:#666;font-size:19px;cursor:pointer;line-height:1;transition:all 0.10s ease;">×</button>' +
          '<div data-share-title style="font-size:18px;font-weight:600;color:#222;margin-bottom:10px;letter-spacing:1px;padding:0 34px;"></div>' +
          '<div style="font-size:13px;color:#888;margin-bottom:10px;">资源链接已复制到剪贴板</div>' +
          '<div data-share-url style="font-size:14px;color:#1565c0;word-break:break-all;overflow-wrap:anywhere;background:#f5f8fb;border-radius:8px;padding:10px 12px;margin-bottom:18px;line-height:1.5;"></div>' +
          '<button data-share-ok type="button" class="share-ok">确定</button>' +
        '</div>';
      var tEl = mask.querySelector('[data-share-title]');
      var uEl = mask.querySelector('[data-share-url]');
      if (tEl) tEl.textContent = title || '分享';
      if (uEl) uEl.textContent = url || '';
      // R22：蓝色链接本身可点击=再次复制并提示（复用页面级 toast，无 toast 时兜底一个轻提示条）
      if (uEl) {
        uEl.style.cursor = 'pointer';
        uEl.title = '点击复制链接';
        uEl.addEventListener('click', function () {
          try { __shareCopy(uEl.textContent || ''); } catch (e) {}
          __shareToast('链接已复制到剪贴板');
        });
      }
      document.body.appendChild(mask);
      function close() {
        try { document.body.removeChild(mask); } catch (e) {}
        if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
      }
      mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
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
    t.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);color:var(--blue1,#1E88E5);background:rgba(255,255,255,0.92);border:1px solid var(--blue2,#64B5F6);border-radius:20px;padding:6px 16px;font-size:12px;line-height:18px;box-shadow:0 2px 8px rgba(0,0,0,0.1);z-index:100002;pointer-events:none;opacity:0;transition:opacity .2s ease;max-width:90%;text-align:center;'; /* R116：line-height 显式 18，单行总高恒 32px，与下拉刷新条逐像素一致 */
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
  window.addEventListener('pageshow', function (e) { if (e.persisted) { window.location.reload(); } });

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

    if (totalPages <= 1) { container.style.display = 'none'; return; }
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
  };
})();


// ---------- R20：跨页跳转公共函数（淡出 + 兜底恢复 + bfcache 恢复） ----------
// 原 4 处 inline 跳转淡出（导航页→资源页 / 资源页→管理页 / 管理登录卡→资源页 / 管理顶栏→资源页）收口到这里：
// 1) 180ms 淡出后跳转；2) 网络慢导致导航迟迟未完成时 1.2s 后恢复可见，避免页面长时间全透明像白屏；
// 3) 手机返回键从 bfcache 恢复本页时，若 body 还停留在淡出透明态，立即恢复不透明白屏。
window.jumpTo = function (href) {
  var b = document.body;
  if (!b || !href) return;
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
  function entry(m) { for (var i = 0; i < reg.length; i++) if (reg[i].mask === m) return reg[i]; return null; }
  function sync(m) {
    var open = !!(m.classList && m.classList.contains('open'));
    var idx = stack.indexOf(m);
    if (open && idx < 0) stack.push(m);
    else if (!open && idx >= 0) stack.splice(idx, 1);
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
    close(stack[stack.length - 1], 'discard'); // R147：Esc=丢弃（全站弹窗统一：取消/点外/Esc=丢弃未保存修改）
  });
  return { register: register, close: close, stack: stack };
})();

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
  function clipped(el) { return el.scrollWidth - el.clientWidth > 1 || el.scrollHeight - el.clientHeight > 1; }
  // R165：单行截断容器判定——scrollWidth 超宽但行高未超（水平省略号截断），
  // 区别于 R106 排除的限高滚动容器（垂直溢出误判）。网格卡片副标题 .p-sub 带子元素（分类/简介/金额），
  // leafText 判 false 旧逻辑弹不出，此分支让「展示不全有省略号」的容器也能点开看全文（复用 #uiTip 查看框）。
  function clippedX(el) { return el.scrollWidth - el.clientWidth > 1 && el.scrollHeight - el.clientHeight <= 1; }
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
    t.textContent = txt;
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
  var PICKSEL = 'td, th, .c-name, .v-name, .p-title, .p-sub, .card-title, .card-desc, .shop-name, .variant-tab';
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
