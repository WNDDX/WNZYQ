
/* v343 条5：统一取数据通道——前台与后台共用同一份核心。
   统一负责：超时、GET 失败重试一次、带上登录凭证、非 JSON 错误兜底、
   同一请求在途去重、登录过期回调。页面只管拿结果，不再各写一套。 */
/* v346 条6：统一"静默失败"留痕——默认不打扰用户；地址加 ?debug=1 时在控制台可见，
   把历史上"被悄悄吞掉"的错误留出线索（此前大量 catch (e) { if (window.__silent) window.__silent(e); } 完全无声）。 */
window.__silent = window.__silent || function (e, tag) {
  try { if (/(?:^|[?&])debug=1/.test(location.search)) console.warn('[silent]' + (tag ? ' ' + tag : ''), e); } catch (x) {} /* 自身不再递归留痕 */
};

/* v346 条8：全站常量兜底——config.js 仅在 shop/index 引入，admin.html 不引 config.js；
   这里补一份同名常量，保证四页 WN_CONST 一致（后台读分页/超时不再各自硬编码）。 */
window.WN_CONST = window.WN_CONST || { TIMEOUT: 10000, UNDO_MS: 10000, PAGE_SIZE: 20, ADMIN_PAGE_SIZE: 20, IMG_RETRIES: 3, CACHE_SCHEMA: 4 };

/* v346 条17：图标符号库——常用图标在此定义一次，各处用 <use href="#wn-ico-x"> 引用（改一处全站生效） */
(function () {
  try {
    if (document.getElementById('wn-sprite')) return;
    var host = document.body || document.documentElement;
    if (!host) return;
    var box = document.createElement('div');
    box.id = 'wn-sprite';
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">'
      + '<symbol id="wn-ico-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></symbol>'
      + '</svg>';
    host.insertBefore(box, host.firstChild);
  } catch (e) {}
})();

window.WNApi = (function () {
  var inflight = new Map();
  function buildUrl(path) {
    if (/^https?:/i.test(path)) return path;
    if (path.charAt(0) === '/') return path;
    return '/api/' + path;
  }
  function request(path, opts) {
    opts = opts || {};
    var url = buildUrl(path);
    var method = (opts.method || 'GET').toUpperCase();
    var isGet = method === 'GET';
    var cfg = window.WN_CONST || {};
    var timeout = opts.timeout || cfg.TIMEOUT || 10000;
    var fopts = { method: method, credentials: opts.credentials || 'include' };
    var headers = opts.headers || {};
    if (method !== 'GET' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    fopts.headers = headers;
    if (opts.body) fopts.body = opts.body;
    if (opts.cache) fopts.cache = opts.cache;
    var key = url + '|' + (opts.body || '');
    if (inflight.has(key)) return inflight.get(key);
    function once(isRetry) {
      return Promise.race([
        fetch(url, fopts),
        new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, timeout); })
      ]).then(function (r) {
        if (opts.raw) return r;
        var ct = r.headers.get('content-type') || '';
        if (r.status >= 400 && ct.indexOf('application/json') === -1) {
          return { ok: false, msg: '网络开小差了，请稍后再试', _status: r.status };
        }
        return r.json().then(function (d) {
          if (d && typeof d === 'object') d._status = r.status;
          if (r.status === 401 && opts.on401) { try { opts.on401(); } catch (e) { if (window.__silent) window.__silent(e); } }
          return d;
        }).catch(function () {
          return r.status === 204 ? { ok: true, _status: 204 } : { ok: false, msg: '网络开小差了，请稍后再试', _status: r.status };
        });
      }).catch(function (e) {
        if (isGet && !isRetry) return once(true);
        if (opts.throwOnError) throw e;
        var msg = (e && e.message === 'timeout') ? '网络开小差了，请稍后再试' : '网络开小差了，请稍后再试';
        return { ok: false, msg: msg, _net: true };
      });
    }
    var p = once(false).then(function (d) { inflight.delete(key); return d; }, function (e) { inflight.delete(key); throw e; });
    inflight.set(key, p);
    return p;
  }
  return { request: request };
})();

// R256：HTML 属性转义（全站共享）
function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 万能资源圈 公共 UI（加载标记 + 统一客服弹窗 + 统一提示弹窗）
 * 自定义滚动条已取消：恢复浏览器默认滚动条（用户要求）
 */
window.__uiCommonLoaded = true;

/* R213 P2③（质检 R212 + 队长拍板）：R211 时代的 __startViewTransition 包装已删——
   ViewTransitions 收敛后全站无任何调用（298 函数引用清点），startViewTransition 由调用方直用即可 */


/* ===== R34 全站统一 PWA Service Worker 注册（一处定义四页生效；原导航页/资源页各自的注册已收编于此） =====
 * v307：新版 SW 接管（controllerchange）时不再强制刷新当前页面——改为温和提示，避免用户正操作时页面突然闪一下。
 * 下次用户自然打开页面时，SW 的导航网络竞速策略会确保拿到最新内容。 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      try { reg.update(); } catch (e) { if (window.__silent) window.__silent(e); }
      var _swReloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (_swReloaded) return;
        _swReloaded = true;
        try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); } // R248：编辑中时先落草稿
        // v307：不强制刷新，只提示用户有新版本——根治"放着放着自己刷一下"
        /* v345 条6：去掉「已更新到最新版本」这类高频提示（每次刷新都弹，很烦）——
           新版本依然会静默生效，不再打扰用户。 */
        try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
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
            try { v.pause(); } catch (e) { if (window.__silent) window.__silent(e); }
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
    } catch (e) { if (window.__silent) window.__silent(e); }
  }

  function ensureKfModal() {
    if (document.getElementById('kfMask')) return;
    var m = document.createElement('div');
    m.className = 'kf-mask';
    m.id = 'kfMask';
    m.setAttribute('role', 'dialog');
    m.innerHTML =
      '<div class="kf-box">' +
        '<button class="kf-x" id="kfCloseX" type="button" aria-label="关闭"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
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
      // v294（用户 10-04 02:14）：222 关闭弹窗时暂停所有视频
      try { document.querySelectorAll('video').forEach(function(v){ v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
      // 不直接解锁：若还有其他弹窗（如资源弹窗）开着，必须保持背景锁定
      if (window.syncBodyLock) window.syncBodyLock(); else (document.body.style.overflow = '');
    }
    m.addEventListener('click', function (e) { if (e.target === m) close(); }); /* R217：恢复点外关闭（R215 误删——老板原意只删下滑手势） */
    // R111：注册进 __modalKit——Esc 走暂存通道（纯展示弹窗=直接关）
    if (window.__modalKit) window.__modalKit.register(m, { discard: close, stash: close });
    document.getElementById('kfCloseX').addEventListener('click', close);
    document.getElementById('kfCloseBtn').addEventListener('click', close);
    document.getElementById('kfJumpBtn').addEventListener('click', function () {
      var u = this.getAttribute('data-url') || '';
      if (u) { try { window.open(u, '_blank'); } catch (e) { if (window.__silent) window.__silent(e); } }
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
    } catch (e) { if (window.__silent) window.__silent(e); }
  };
  window.openContactModal = function (url, qrImg, tip, btnText) {
    window.__kfPreconnect(url); /* R189：弹窗打开即对目标域名提前建连，用户看二维码期间连接已就绪 */
    ensureKfModal();
    var img = document.getElementById('kfQrImg');
    if (img) {
      // R208（用户 09-19 00:23）：客服二维码旧图闪现根治——设置 src 前先隐藏，加载完成后再显示，杜绝首帧残留
      // v301（用户 10-05 00:00）：修复 onload 不触发或 onerror 时二维码永远隐藏的 bug——无论成败都要恢复可见
      img.style.opacity = '0';
      img.classList.remove('kf-qr-in');
      img.onerror = function () {
        this.onerror = null;
        this.src = KF_QR_FAIL;
        if (this.classList) this.classList.add('media-fail');
        img.style.opacity = '';
      };
      img.onload = function () { img.style.opacity = ''; void img.offsetWidth; img.classList.add('kf-qr-in'); };
      img.src = qrImg || window.__kefuQrSrc();
      if (img.complete) {
        if (img.naturalWidth) { img.style.opacity = ''; void img.offsetWidth; img.classList.add('kf-qr-in'); }
        else { img.onerror(); }
      }
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

  // ===== R285：全站统一客服兜底弹窗（item 7）=====
  // ui-common.js 主弹窗加载失败时的兜底，一处定义全站生效
  window.__kfFbClose = function () {
    var m = document.getElementById('kfFallback');
    if (m) m.style.display = 'none';
    try { document.querySelectorAll('video').forEach(function (v) { if (v.dataset.__kfFbHid) { v.dataset.__kfFbHid = ''; v.style.visibility = ''; } }); } catch (e) { if (window.__silent) window.__silent(e); }
    if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
  };
  window.openContactFallback = function (url) {
    window.__kfPreconnect(url);
    var m = document.getElementById('kfFallback');
    if (!m) {
      m = document.createElement('div');
      m.id = 'kfFallback';
      m.className = 'kf-mask';
      m.setAttribute('role', 'dialog');
      m.innerHTML =
        '<div class="kf-box">' +
          '<button class="kf-x" type="button" aria-label="关闭" onclick="window.__kfFbClose()"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
          '<div class="kf-title">咨询客服</div>' +
          '<div class="kf-qr"><img id="kfFallbackImg" alt="客服二维码" /></div>' +
          '<div class="kf-tip">长按图片识别-添加人工客服</div>' +
          '<div class="kf-actions">' +
            '<button class="kf-jump" type="button" data-u="" onclick="var u=this.getAttribute(\'data-u\');if(u){window.open(u,\'_blank\');}">跳转-咨询在线客服</button>' +
            '<button class="kf-close" type="button" onclick="window.__kfFbClose()">关闭</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m) window.__kfFbClose(); });
      var im = document.getElementById('kfFallbackImg');
      if (im) im.onerror = function () { this.onerror = null; this.classList&&this.classList.add('media-fail'); this.src = KF_QR_FAIL; };
    }
    var jb = m.querySelector('button[data-u]');
    if (jb) jb.setAttribute('data-u', url || '');
    var im = document.getElementById('kfFallbackImg');
    if (im) { im.src = window.__kefuQrSrc(); }
    try { document.querySelectorAll('video').forEach(function (v) { if (!v.closest('#kfFallback, .kf-box, .kf-mask, .modal-mask, .ann-modal, .share-mask, .lightbox, .stat-modal')) { v.dataset.__kfFbHid = '1'; try { v.pause(); } catch (e) { if (window.__silent) window.__silent(e); } v.style.visibility = 'hidden'; } }); } catch (e) { if (window.__silent) window.__silent(e); }
    m.style.display = 'flex';
    if (window.lockBodyScroll) window.lockBodyScroll(true);
  };

  // ===== R45：全站统一图片/视频放大灯箱 =====
  // 服务无页面级灯箱实现的场景（导航页二维码弹窗、全站客服二维码弹窗等）。
  // R278（老板 09-27 23:5x「全系统点击放大图片或视频统一成同一套全屏大图」）：shop/admin 页面原有的
  // 同款局部 openLightbox 已退役删除，全站只剩这一套全局实现（window.openLightbox/bindLightbox），
  // 任何页面点任何图/视频弹出效果完全一致：width:min(90vw,1200px)/height:min(90vh,800px) 屏幕自适应
  // （R277 口径）、双指缩放、dblclick 复位、Esc 经 __modalKit 逐层路由关闭。
  // 样式走 ui-common.css 的 .lightbox（z-index 100000，高于客服 10001）。灯箱内是真实 <img>（非 CSS 背景）——
  // 微信/手机浏览器内长按识别二维码可用。
  var __lbMask = null, __lbScale = 1, __lbStartDist = 0;
  window.closeLightbox = function () {
    if (!__lbMask) return;
    try { __lbMask.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
    __lbMask.classList.remove('open');
    // 不直接解锁：若底下还有弹窗（二维码弹窗/客服弹窗）开着，必须保持背景锁定
    if (window.syncBodyLock) window.syncBodyLock(); else (document.body.style.overflow = '');
  };
  window.openLightbox = function (src, group) {
    if (!src) return;
    /* v281：全系统单一播放规则——打开灯箱前暂停页面全部已有 video（不含灯箱内新建的） */
    try { document.querySelectorAll('video').forEach(function (v) { if (!v.closest('.lightbox')) v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
    if (!__lbMask) {
      __lbMask = document.createElement('div');
      __lbMask.className = 'lightbox';
      // R111：点图片本身不算「弹窗外」，只有点空白遮罩才关（与全站口径一致）；R217：恢复（R215 误删）
      // v358：图片盒子改为按真实比例渲染（见 __lbShow）——原 object-fit:contain 的透明假盒子占满 90vw×90vh，
      //       点「图片外的空白」其实仍点在 img 元素里导致关不掉、要点很远才命中遮罩
      __lbMask.onclick = function (e) { if (e.target === __lbMask) window.closeLightbox(); };
      document.body.appendChild(__lbMask);
      // R111：注册进统一弹窗栈，Esc 逐层路由（只关最上层）
      if (window.__modalKit) window.__modalKit.register(__lbMask, { discard: window.closeLightbox, stash: window.closeLightbox });
      /* v359 条2：改用全站统一手势（一套逻辑）；__lbGroup 组内切换，到头自然弹回、无提示 */
      window.__bindSwipeSwitch(__lbMask, function (dir) {
        var g = window.__lbGroup; if (!g) return;
        var ni = g.idx + dir;
        if (ni < 0 || ni >= g.list.length) return; /* 到头：不动即自然弹回 */
        g.idx = ni; window.__lbShow(g.list[g.idx]);
      });
    }
    window.__lbGroup = (group && group.list && group.list.length > 1) ? { list: group.list.slice(), idx: Math.max(0, group.list.indexOf(src)) } : null;
    window.__lbShow = function (s) {
      __lbMask.querySelectorAll('img, video').forEach(function (n) { n.remove(); });
      var isVideo = /\.(mp4|webm|ogv|m3u8)(\?|#|$)/i.test(s) || /video|\.m3u8/i.test(s);
      var im = document.createElement(isVideo ? 'video' : 'img');
      // R266（用户 09-27 15:08）：灯箱图片加 onerror 兜底，杜绝坏链接裸闪破损图标。
      if (!isVideo) {
        im.onerror = function () { this.onerror = null; this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E'; if (this.classList) this.classList.add('media-fail'); };
        im.onload = function () {
          /* v358：按图片真实比例设定盒子尺寸——盒子=看得见的图，点「图片外」即点遮罩，立刻可关 */
          try {
            var vw = Math.min(window.innerWidth * 0.92, 1200), vh = Math.min(window.innerHeight * 0.92, 800);
            var r = Math.min(vw / (this.naturalWidth || 1), vh / (this.naturalHeight || 1));
            this.style.width = Math.max(80, Math.round((this.naturalWidth || 1) * r)) + 'px';
            this.style.height = Math.max(80, Math.round((this.naturalHeight || 1) * r)) + 'px';
          } catch (e0) { if (window.__silent) window.__silent(e0); }
        };
      }
      im.src = s;
      if (isVideo) { im.controls = true; im.autoplay = true; im.playsInline = true; }
      im.style.cssText = 'object-fit:contain;border-radius:8px;max-width:92vw;max-height:88vh;transition:transform .05s linear;' + (isVideo ? 'width:min(92vw,1200px);aspect-ratio:16/9;background:#000;' : '');
      __lbMask.appendChild(im);
      __lbScale = 1;
    };
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'modal-close-x'; x.innerHTML = '<svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg>'; /* R285 条17：× 文字符号换固定 SVG */
    x.onclick = function (e) { e.stopPropagation(); window.closeLightbox(); };
    __lbMask.appendChild(x);
    window.__lbShow(src);
    window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    __lbMask.classList.add('open');
  };
  // 灯箱双指缩放（与 shop/admin 页面级实现同款：仅双指 touchmove 时接管，不影响单指长按识别）
  document.addEventListener('touchstart', function (e) {
    if (window.__flipAnimating) return; /* R257：FLIP 飞位期间不判定双指缩放（手势隔离，从 shop.js 合并） */
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
    if (window.__flipAnimating) return; /* R257：FLIP 飞位期间不判定双击复位（手势隔离，从 shop.js 合并） */
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



  // R257：解析公告列表（兼容旧单条 announcement）——从 shop.js + admin.js 合并到公共版
  window.parseAnnouncements = function (settings, opts) {
    opts = opts || {};
    var arr = [];
    try { arr = JSON.parse(settings.announcements || '[]'); } catch (e) { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    if (!arr.length && settings.announcement) arr = [{ id: 0, title: '公告', content: String(settings.announcement || ''), hidden: 0, sort: 0, level: 1 }];
    if (opts.filterHidden) arr = arr.filter(function (a) { return !a.hidden; });
    /* v352：空公告不再过滤（老板 10-10 要求空公告项也要显示，点开显示「该公告暂无内容」占位） */
    if (opts.sortLevel) {
      arr.sort(function (a, b) { var la = a.level === 1 ? -1 : 0, lb = b.level === 1 ? -1 : 0; if (la !== lb) return la - lb; return (a.sort || 0) - (b.sort || 0); });
    } else {
      arr.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    }
    return arr;
  };

  // R257：长按保存图片——从 shop.js + admin.js 合并到公共版
  window.__saveImage = function (src) {
    try {
      fetch(src).then(function (r) { return r.blob(); }).then(function (blob) {
        var u = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = u;
        a.download = (String(src).split('/').pop() || 'image').split('?')[0] || 'image';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
        if (window.showToast) window.showToast('图片已保存', 'success');
      }).catch(function () {
        if (window.showToast) window.showToast('图片保存失败', 'error');
      });
    } catch (e) {
      if (window.showToast) window.showToast('图片保存失败', 'error');
    }
  };

  // R257：FLIP 视图切换通用函数——从 shop.js + admin.js 合并到公共版
  window.flipViewSwitch = function (containerId, view, opts) {
    var container = document.getElementById(containerId);
    var btnA = document.getElementById(opts.btnA);
    var btnB = document.getElementById(opts.btnB);
    var flipperKey = opts.flipperKey;
    if (!window.FlipAnimator || !container) { opts.fallbackFn(view); return; }
    var flipper = window[flipperKey];
    if (!flipper || flipper.container !== container) {
      flipper = new window.FlipAnimator(container);
      window[flipperKey] = flipper;
    }
    var animated = flipper.flip(function () {
      if (view === opts.viewA) {
        container.classList.add(opts.viewClass);
        if (btnA) btnA.classList.add('active');      // v325：修正——viewA 对应 btnA 选中（原写反了）
        if (btnB) btnB.classList.remove('active');   // v325：修正——btnB 未选中
      } else {
        container.classList.remove(opts.viewClass);
        if (btnA) btnA.classList.remove('active');   // v325：修正——btnA 未选中
        if (btnB) btnB.classList.add('active');      // v325：修正——btnB 选中
      }
      if (opts.storageKey) localStorage.setItem(opts.storageKey, view);
      if (opts.onChange) opts.onChange(view);
    }, { duration: 300, stagger: 20, maxStagger: 180 });
    if (!animated && opts.triggerAnim) opts.triggerAnim(container);
  };
  // ===== 主题策略（方案A定稿 2026-10-09）：全站恒定亮色，不再跟随系统深色 =====
  // 原 R50/R187 自动深色逻辑已按用户拍板移除（对应暗色 CSS 变量块同步清理）。
  // 只保留 theme-color 同步：地址栏/状态栏恒为主蓝 #1E88E5，与页面观感一致。
  window.__applyTheme = function () {
    document.documentElement.removeAttribute('data-theme');
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var k = 0; k < metas.length; k++) metas[k].setAttribute('content', '#1E88E5');
  };
  window.__applyTheme();

  // 公共媒体占位：加载前预留 16:9 高度防止弹窗先小后大；加载完成同一帧用真实宽高比接管（图片已在缓存，无等待撑开感）；失败交给感叹号兜底
  window.mediaStable = function (el, isVideo, keepRatio) {
    if (!el) return el;
    el.classList.add('m-loading');
    if (isVideo) el.classList.add('is-video');
    function applyRatio(w, h) {
      if (!keepRatio && w && h) { try { el.style.aspectRatio = (w / h); } catch (e) { if (window.__silent) window.__silent(e); } }
      el.classList.remove('m-loading', 'is-video');
      try { el.classList.add('img-in'); } catch (e) { if (window.__silent) window.__silent(e); } /* R183 条2：详情图入场动画（同二维码口径） */
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
      mask.style.cssText = 'position:fixed;inset:0;background:var(--overlay-modal, rgba(0,0,0,0.76));z-index:10060;display:flex;align-items:center;justify-content:center;padding:16px;';
      mask.innerHTML =
        '<div class="modal-box" style="background:#fff;border-radius:12px;width:100%;max-width:400px;padding:24px 22px;position:relative;text-align:center;max-height:min(88vh,88dvh);overflow-y:auto;min-height:auto;">' + /* v356 条1：12px/24px/88dvh 对齐全站弹窗档 */
          '<button type="button" class="modal-close-x" aria-label="关闭"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
          '<div class="modal-title" style="font-size:20px;color:#222;margin-bottom:14px;letter-spacing:1px;padding:0 32px;text-align:center;"></div>' + /* v356 条9：字距/边距对齐弹窗标题档 */
          '<div class="alert-body" style="font-size:15px;color:#555;line-height:1.7;word-break:break-word;overflow-wrap:anywhere;margin-bottom:20px;text-align:center;"></div>' +
          '<div style="display:flex;"><button type="button" class="alert-ok" style="flex:1;border:none;border-radius:10px;height:46px;padding:0;background:#1E88E5 /* v293（用户 10-04 02:14）：069alert-ok圆角8→10px→跟全站按钮统一 */;color:#fff;font-size:16px;font-weight:600;cursor:pointer;letter-spacing:1.2px;transition:transform var(--dur-fast) var(--ease-press), opacity var(--dur-fast) var(--ease-press);box-shadow:var(--shadow-blue); /* v293（用户 10-04 02:14）：044JS生成阴影收归5档→0 2px 6px rgba(30,136,229,0.25)改var(--shadow-blue) */ -webkit-tap-highlight-color:transparent;">确定</button></div>' +
        '</div>';
      var titleEl = mask.querySelector('.modal-title');
      var bodyEl = mask.querySelector('.alert-body');
      if (titleEl) titleEl.textContent = (title == null || title === '') ? '提示' : String(title);
      if (bodyEl) bodyEl.textContent = String(msg == null ? '' : msg);
      document.body.appendChild(mask);
      var close = function () {
        if (close.__done) return; close.__done = true;
        /* R183 条8：提示弹窗关闭也走对称收缩（0.18s 后再移除节点；多次触发只执行一次） */
        try { mask.classList.add('mask-closing'); } catch (e0) { if (window.__silent) window.__silent(e0); }
        setTimeout(function () {
          try { document.body.removeChild(mask); } catch (e) { if (window.__silent) window.__silent(e); }
          if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
        }, 200);
      };
      mask.addEventListener('click', function (e) { if (e.target === mask) close(); }); /* R217：恢复点外关闭（R215 误删） */
      var ok = mask.querySelector('.alert-ok');
      if (ok) ok.addEventListener('click', close);
      var x = mask.querySelector('.modal-close-x');
      if (x) x.addEventListener('click', close);
      window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    } catch (e) { /* 弹窗失败时回退系统 alert，保证提示不丢失 */ try { window.alert(msg); } catch (e2) { if (window.__silent) window.__silent(e2); } }
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
    try { __shareCopy(url || ''); __shareToast('链接已复制到剪贴板'); } catch (e0) { if (window.__silent) window.__silent(e0); }
    try {
      var mask = document.createElement('div');
      mask.className = 'share-mask';
      mask.setAttribute('role', 'dialog');
      mask.style.cssText = 'position:fixed;inset:0;background:var(--overlay-modal, rgba(0,0,0,0.76));z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
      mask.innerHTML =
        '<div class="share-box" style="background:#fff;border-radius:12px;position:relative;padding:24px 20px;width:100%;max-width:400px;text-align:center;box-shadow:var(--shadow-modal); /* v293（用户 10-04 02:14）：044JS生成阴影收归5档→0 10px 40px rgba(0,0,0,0.3)改var(--shadow-modal) */ animation:modalIn var(--dur-mid) var(--ease-out); /* v356 条2：12px/24px/统一时长缓动 */">' +
          '<button class="modal-close-x" data-share-x type="button" aria-label="关闭" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:none;background:var(--danger-bg,#fdecea);color:var(--red-strong,#c62828);font-size:19px; /* v356 条4：×键纳入全站红系 */cursor:pointer;line-height:1;transition:transform var(--dur-fast) var(--ease-press), opacity var(--dur-fast) var(--ease-press);"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
          '<div data-share-title style="font-size:20px;font-weight:600;color:#222;margin-bottom:10px;letter-spacing:1px;padding:0 34px;"></div>' + /* v356 条6：标题统一 20px */
          '<div data-share-tip style="font-size:13px;color:var(--gray-mid);margin-bottom:10px;">资源链接已复制到剪贴板</div>' +
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
          try { __shareCopy(uEl.textContent || ''); } catch (e) { if (window.__silent) window.__silent(e); }
          if (uEl.classList) { uEl.classList.add('copy-ok-text'); setTimeout(function () { try { uEl.classList.remove('copy-ok-text'); } catch (e) { if (window.__silent) window.__silent(e); } }, 1500); } /* R217 条1：复制成功=链接文字变绿 1.5s（全站统一口径，与资源页顶栏分享一致） */
          __shareToast('链接已复制到剪贴板');
        });
        /* R217 条1：弹窗打开那一刻的自动复制同样给绿字反馈（所有走本弹窗的分享入口统一） */
        uEl.classList.add('copy-ok-text');
        setTimeout(function () { try { uEl.classList.remove('copy-ok-text'); } catch (e) { if (window.__silent) window.__silent(e); } }, 1500);
      }
      document.body.appendChild(mask);
      function close() {
        try { document.body.removeChild(mask); } catch (e) { if (window.__silent) window.__silent(e); }
        if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
      }
      mask.addEventListener('click', function (e) { if (e.target === mask) close(); }); /* R217：恢复点外关闭（R215 误删） */
      mask.querySelector('[data-share-x]').addEventListener('click', close);
      mask.querySelector('[data-share-ok]').addEventListener('click', close);
      // R111：注册进 __modalKit——Esc 走暂存通道（纯展示弹窗=直接关）
      if (window.__modalKit) window.__modalKit.register(mask, { discard: close, stash: close });
      // R79：复制已在函数入口（点击那一刻）同步完成，这里只负责弹窗与滚动锁
      window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    } catch (e) { if (window.__silent) window.__silent(e); }
  };
  function __fallbackCopyText(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(ta);
    // R79：移动端 webview 需先 focus 再 select，execCommand 才可靠
    // R138：focus 加 preventScroll——旧 focus() 在移动端会引发视口滚动/重排（点击分享卡一下的帮凶）
    try { ta.focus({ preventScroll: true }); } catch (e) { try { ta.focus(); } catch (e2) { if (window.__silent) window.__silent(e2); } }
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { if (window.__silent) window.__silent(e); }
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
          try { __fallbackCopyText(text); } catch (e) { if (window.__silent) window.__silent(e); }
        });
        return true;
      }
    } catch (e) { if (window.__silent) window.__silent(e); }
    return __fallbackCopyText(text);
  }
  window.__shareCopyText = __shareCopy;
  // R22：分享链接复制提示——优先复用页面级 toast（资源页 showToast / 管理页 toast），都没有时兜底一个轻提示条
  function __shareToast(msg) {
    try {
      if (typeof window.showToast === 'function') { window.showToast(msg, 'info'); return; }
      if (typeof window.toast === 'function') { window.toast(msg, 'success'); return; }
    } catch (e) { if (window.__silent) window.__silent(e); }
    // R83：兜底 toast 位置与全站统一 top:80px 居中（白底蓝字蓝边圆角20）
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;top:' + ((typeof window.__toastTop === 'function') ? window.__toastTop() : 80) + 'px;left:50%;transform:translateX(-50%);color:var(--blue1,#1E88E5);background:var(--toast-bg,rgba(255,255,255,0.92));border:1px solid var(--blue2,#64B5F6);border-radius:999px; /* v293（用户 10-04 02:14）：071toast圆角20→999px→跟胶囊形统一 */padding:6px 16px;font-size:12px;line-height:18px;box-shadow:var(--shadow-pop,0 4px 16px rgba(0,0,0,0.14));z-index:100002;pointer-events:none;opacity:0;transition:opacity .2s ease;max-width:90%;text-align:center;'; /* R116：line-height 显式 18，单行总高恒 32px，与下拉刷新条逐像素一致 */
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { try { document.body.removeChild(t); } catch (e) { if (window.__silent) window.__silent(e); } }, 300); }, 2000);
  }

  // ===== 弹窗滚动锁：打开弹窗锁定背景滚动（PC overflow + 移动端拦截穿透），弹窗内部内容仍可正常滚动 =====
  // v307：全面加固——引用计数防嵌套弹窗误解锁、touchmove+wheel 双拦截、允许容器覆盖全站所有弹窗类型
  var __bodyLockCount = 0;
  /* v336 条138：白名单只作兜底——先判断触点是否在可滚区域，能滚一律放行 */
function __scrollableAncestor(el) {
  for (var p = el; p && p !== document.body; p = p.parentNode) {
    if (p.nodeType !== 1) continue;
    var st = getComputedStyle(p);
    if (/(auto|scroll)/.test(st.overflowY + st.overflowX) && (p.scrollHeight > p.clientHeight + 2 || p.scrollWidth > p.clientWidth + 2)) return true;
  }
  return false;
}
var __BLOCK_TOUCH_SEL = '.modal-box,.kf-box,.share-box,.modal-inner,.rte-panel,.ann-box,.lightbox,.cp-box,.qr-preview-box,.stat-modal,.picker-panel,.cat-picker-panel';
  function __blockTouch(e) {
    if (!e.target || !e.target.closest) return;
    var allow = e.target.closest(__BLOCK_TOUCH_SEL);
    if (!allow) e.preventDefault();
  }
  function __blockWheel(e) {
    if (!e.target || !e.target.closest) return;
    var allow = e.target.closest(__BLOCK_TOUCH_SEL);
    if (!allow) e.preventDefault();
  }
  // v307：lockBodyScroll 保留引用计数，确保嵌套弹窗（弹窗里再开弹窗）全部关闭后才恢复背景滚动
  var __bodyLockCount = 0;
  var __touchLocked = false, __wheelLocked = false;
  window.lockBodyScroll = function (lock) {
    if (lock) {
      __bodyLockCount++;
      if (__bodyLockCount === 1) {
        // 同时锁 body 与 html：不同浏览器的主滚动容器归属不一致，双锁确保 PC 鼠标滚轮也让背景纹丝不动
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        if (!__touchLocked) { document.addEventListener('touchmove', __blockTouch, { passive: false }); __touchLocked = true; }
        if (!__wheelLocked) { document.addEventListener('wheel', __blockWheel, { passive: false }); __wheelLocked = true; }
      }
    } else {
      __bodyLockCount = Math.max(0, __bodyLockCount - 1);
      if (__bodyLockCount === 0) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        if (__touchLocked) { document.removeEventListener('touchmove', __blockTouch); __touchLocked = false; }
        if (__wheelLocked) { document.removeEventListener('wheel', __blockWheel); __wheelLocked = false; }
      }
    }
  };
  var __prevModalOpen = false;
  window.syncBodyLock = function () {
    // v307：扩大选择器覆盖全部弹窗类型（admin 的公告/命令面板、shop 的二维码预览等）
    var open = !!document.querySelector('.modal-mask.open,.kf-mask.open,.share-mask.open,.lightbox-mask.open,.alert-mask.open,.lightbox.open,.cp-mask.open,.qr-preview-mask.open,.ann-mask.open,.stat-modal.open,.picker-panel.open,.cat-picker-panel.open');
    // v307：syncBodyLock 直接操作底层样式+事件，不经过 lockBodyScroll 引用计数——
    // syncBodyLock 是"根据当前 DOM 有多少弹窗开着"来强制同步状态，不是"增/减一次锁定"
    if (open !== __prevModalOpen) {
      if (open) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        if (!__touchLocked) { document.addEventListener('touchmove', __blockTouch, { passive: false }); __touchLocked = true; }
        if (!__wheelLocked) { document.addEventListener('wheel', __blockWheel, { passive: false }); __wheelLocked = true; }
      } else {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        if (__touchLocked) { document.removeEventListener('touchmove', __blockTouch); __touchLocked = false; }
        if (__wheelLocked) { document.removeEventListener('wheel', __blockWheel); __wheelLocked = false; }
        // 同步清空手动引用计数，避免手动路径和自动路径打架
        __bodyLockCount = 0;
      }
    }
    // R167：只在弹窗开合状态真正「变迁」时隐藏 #uiTip——本函数由全文档 class/childList
    // 变化观察器防抖触发（连 uiTip 自身创建都会触发），无条件隐藏会把刚弹出的小框 30ms 后
    // 无端收掉；状态未变（仅普通 class 变化）时不动小框。
    if (open !== __prevModalOpen) { try { if (window.__hideUiTip) window.__hideUiTip(); } catch (e0) { if (window.__silent) window.__silent(e0); } }
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
  } catch (e) { if (window.__silent) window.__silent(e); }
  // v307：浏览器返回 / bfcache 恢复时不再强制刷新——根治"切回来闪一下"。
  // 数据新鲜度由各页面自己的轮询/同步机制保证，恢复后只保存草稿即可。
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
    }
  });

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
    info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite'); /* v346 条72：翻页信息变化时读屏可播报 */
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


// ---------- R233（用户 09-22 11:30 派单）：条13 补做——跨页跳转接入 View Transitions（全站四页） ----------
// 跨文档转场本体由 ui-common.css 的 @view-transition { navigation: auto }（R211）接管，JS 侧不再手动淡出干扰它。
// 三分支（渐进增强，老浏览器不坏）：
// 1) prefers-reduced-motion 用户 → 跳过动画直接跳（CSS 侧三伪元素动画也已关，R231 条13）；
// 2) 支持 document.startViewTransition → 用它包裹跳转（当前页截图交叠新页，平滑过渡）；
// 3) 老浏览器无该 API → 回退 R20 的 180ms 淡出方案（1.2s 兜底恢复 + bfcache pageshow 恢复，原逻辑保留）。
window.jumpTo = function (href) {
  if (!href) return;
  var reduced = false;
  try { reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { if (window.__silent) window.__silent(e); }
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
      for (var i = 0; i < cur - __navLast; i++) { try { history.pushState({ __modalNav: 1 }, '', location.href); } catch (e) { if (window.__silent) window.__silent(e); } }
      __navSent += cur - __navLast;
    } else if (cur < __navLast) {
      var drop = __navLast - cur;
      if (__navSuppress > 0) { /* popstate 关闭：浏览器返回键已消耗对应哨兵，同步实账 */
        var used = Math.min(drop, __navSuppress);
        __navSuppress -= used; __navSent = Math.max(0, __navSent - used); drop -= used;
      }
      var backs = Math.min(drop, __navSent); /* R214：只为真正 push 过的哨兵 back——基线期弹窗关闭不再误弹回上一页 */
      // v302（用户 10-05 00:09）：嵌套弹窗关闭时只减实账不走 history.back()，避免 popstate 连坐外层；只有关到最后一层才抵消哨兵
      if (backs > 0 && cur === 0) { __navBack += backs; __navSent -= backs; for (var j = 0; j < backs; j++) { try { history.back(); } catch (e) { if (window.__silent) window.__silent(e); } } }
      else if (backs > 0) { __navSent -= backs; }
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
    try { new MutationObserver(function () { sync(mask); }).observe(mask, { attributes: true, attributeFilter: ['class'] }); } catch (e) { if (window.__silent) window.__silent(e); }
    sync(mask);
  }
  function close(mask, mode) {
    var h = entry(mask);
    if (!h) return;
    var fn = mode === 'discard' ? (h.discard || h.stash) : (h.stash || h.discard);
    try { if (fn) fn.call(mask, mask); } catch (err) { if (window.__silent) window.__silent(err); }
    try { mask.classList.remove('open'); } catch (e) { if (window.__silent) window.__silent(e); }
    try { mask.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
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
  } catch (e) { if (window.__silent) window.__silent(e); }
};
window.bindSearchHist = function (wrap, input, key) {
  if (!wrap || !input || !window.__uiCommonLoaded) return;
  var box = document.createElement('div');
  box.className = 'search-hist';
  box.style.display = 'none';
  wrap.appendChild(box);
  function getArr() { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
  function setArr(a) { try { localStorage.setItem(key, JSON.stringify(a)); } catch (e) { if (window.__silent) window.__silent(e); } }
  function hide() { box.style.display = 'none'; }
  function render() {
    var arr = getArr();
    if (!arr.length) { hide(); return; }
    var html = '<div class="sh-head"><span class="sh-title">最近搜索</span><button type="button" class="sh-clear">清空</button></div><div class="sh-list">';
    for (var i = 0; i < arr.length; i++) {
      var w = String(arr[i]).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      html += '<span class="sh-item"><button type="button" class="sh-word" data-w="' + w + '">' + w + '</button><button type="button" class="sh-del" data-i="' + i + '" title="删除这条"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button></span>';
    }
    html += '</div>';
    box.innerHTML = html;
    box.style.display = 'block';
  }
  function pick(w) {
    input.value = w;
    hide();
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { if (window.__silent) window.__silent(e); }
  }
  box.addEventListener('mousedown', function (e) { e.preventDefault(); }); /* 防止点击先触发 input blur 收起 */
  box.addEventListener('click', function (e) {
    /* v333 修：原来直接拿 e.target 判断 class，点到按钮里的 SVG 图标时 target 是 <path>/<svg>，
       删除无效。改用 closest 向上找按钮本身。 */
    var raw = e.target;
    var t = (raw && raw.closest) ? raw.closest('.sh-word, .sh-del, .sh-clear') : raw;
    if (!t) return;
    if (t.classList.contains('sh-word')) { pick(t.getAttribute('data-w') || t.textContent); return; }
    if (t.classList.contains('sh-del')) {
      var arr = getArr(); var i = parseInt(t.getAttribute('data-i'), 10);
      if (!isNaN(i) && i >= 0 && i < arr.length) { arr.splice(i, 1); setArr(arr); }
      render(); return;
    }
    if (t.classList.contains('sh-clear')) { setArr([]); hide(); return; }
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
    } catch (err) { if (window.__silent) window.__silent(err); }
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
        } catch (e1) { if (window.__silent) window.__silent(e1); }
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
  } catch (e) { if (window.__silent) window.__silent(e); }
};
// 条4：按钮忙碌态（文字 + 转圈图标；不动 disabled 防重与全屏遮罩——用户拍板「防重复点击，也代替全屏遮罩」不做）
window.__btnBusy = function (btn, text) {
  if (!btn) return;
  /* v348 条15：只换「文字那一份」，不再整颗按钮清空——
     原写法 btn.textContent = text 会把按钮里的小图标一起抹掉，忙碌时按钮看着空一块。 */
  var lab = btn.querySelector('.btn-lab');
  if (lab) { lab.textContent = text; }
  else {
    var txt = null;
    for (var i = 0; i < btn.childNodes.length; i++) {
      var n = btn.childNodes[i];
      if (n.nodeType === 3 && String(n.nodeValue || '').trim()) { if (!txt) txt = n; else n.nodeValue = ''; }
    }
    if (txt) txt.nodeValue = text;
    else btn.insertBefore(document.createTextNode(text), btn.firstChild);
  }
  if (btn.querySelector('.btn-spin')) return;
  var s = document.createElement('span');
  s.className = 'btn-spin';
  btn.appendChild(s);
};
// 条11：复制成功反馈（键短暂变绿 1.2s + 手机轻震）
window.__copyOk = function (el) {
  if (!el) return;
  window.__haptic();
  try { el.classList.add('copy-ok'); } catch (e) { if (window.__silent) window.__silent(e); }
  setTimeout(function () { try { el.classList.remove('copy-ok'); } catch (e) { if (window.__silent) window.__silent(e); } }, 1500); /* R184 条11：1.2s→1.5s（用户拍板） */
};

/* ===== v327（用户要求）：引用块复制按键——全站唯一实现，资源页/管理页预览共用（绑定同步防两处漂移） =====
   给容器内所有 blockquote 顶部插入「复制」按钮；点击复制整块内容，
   成功后引用文字变绿 1.5s（.copy-ok-text，与分享链接同一反馈口径）。
   样式在 ui-common.css .quote-copy-btn 通用块。 */
window.__quoteCopyOk = function (q) {
  try {
    q.classList.add('copy-ok-text');
    setTimeout(function () { try { q.classList.remove('copy-ok-text'); } catch (e) { if (window.__silent) window.__silent(e); } }, 1500);
    /* v340 条2：反馈加强——复制按钮同步变「已复制」绿 1.5 秒，避免只在文字变绿时不易察觉 */
    var btn = q.querySelector('.quote-copy-btn');
    if (btn && !btn.dataset.okBusy) {
      btn.dataset.okBusy = '1';
      var old = btn.textContent;
      btn.textContent = '已复制';
      btn.classList.add('ok');
      setTimeout(function () {
        try { btn.textContent = old; btn.classList.remove('ok'); delete btn.dataset.okBusy; } catch (e) { if (window.__silent) window.__silent(e); }
      }, 1500);
    }
  } catch (e) { if (window.__silent) window.__silent(e); }
};
window.__fallbackCopyQuote = function (text, q) {
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
    if (q) window.__quoteCopyOk(q);
  } catch (e) { if (window.__silent) window.__silent(e); }
};
window.bindQuoteCopyButtons = function (container) {
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
            window.__quoteCopyOk(q); /* 复制成功=引用文字变绿（同分享链接口径），不再按钮变绿 */
          }).catch(function () {
            window.__fallbackCopyQuote(text, q);
          });
          ok = true;
        } catch (e) { if (window.__silent) window.__silent(e); }
      }
      if (!ok) window.__fallbackCopyQuote(text, q);
    });
    q.appendChild(btn);
  });
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
          try { el.classList.remove('mask-closing'); } catch (e) { if (window.__silent) window.__silent(e); }
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

/* ===== R289：数据加载架构重构——进度条仅页面进入/刷新时可见，其余全部静默 =====
   规则1【进页预载】：进入页面或刷新时，一次性提前加载全部数据，此时显示顶部进度条
   规则2【页内零加载】：页内任何点击操作都不显示进度条，直接用已缓存数据
   规则3【提交有反馈】：保存/删除等提交操作由按钮自身转圈提示，不走顶部进度条
   __pageEntryMode：true=页面进入/刷新期（进度条可见），false=页内操作期（进度条静默）
   __MUTE_URLS：永久静音接口（统计上报、健康检查、清理、解锁、缓存清除、静默同步） */
(function () {
  if (window.__fetchBarInstalled) return;
  window.__fetchBarInstalled = true;
  window.__pageEntryMode = false; /* R289：页面进入模式开关 */
  /* v336 条158：老板拍板全站不要进度条——把“点亮”动作永久短路（代码保留，条从此不再出现） */
  window.__enterPageEntryMode = function () { window.__pageEntryMode = true; }; /* v346 条17：删除上一行空赋值（写完立即被覆盖，属死代码） */
  window.__exitPageEntryMode  = function () { window.__pageEntryMode = false; };
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
  /* R289：扩展静音名单——清除缓存和静默同步接口永远静音（伴随请求不弹进度条） */
  var __MUTE_URLS = /\/api\/track\b|\/api\/health\b|\/api\/cleanup\b|\/api\/unlock\b|\/api\/admin\/clear-cache\b|\/api\/admin\/products\?.*prefetch\b|\/api\/admin\/variants\?.*prefetch\b/;
  window.fetch = function () {
    var p;
    try { p = _fetch.apply(window, arguments); } catch (e) { throw e; }
    if (!p || typeof p.then !== 'function') return p;
    var url = '';
    try { url = (typeof arguments[0] === 'string') ? arguments[0] : (arguments[0] && arguments[0].url) || ''; } catch (e) { if (window.__silent) window.__silent(e); }
    var muted = __MUTE_URLS.test(url);
    /* R289：只有在页面进入/刷新模式下才显示进度条；页内所有操作（含提交）全部静默 */
    if (!muted && window.__pageEntryMode) start();
    return p.then(function (r) { if (!muted) finish(); return r; }, function (e) { if (!muted) finish(); throw e; });
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
      b.addEventListener('click', function (e) { e.stopPropagation(); hide(); try { it.fn(); } catch (err) { if (window.__silent) window.__silent(err); } });
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
    /* v330 条12：入场动画——从触点方向轻微放大浮现（160ms），transform-origin 落在手指位置一侧 */
    try {
      m.style.setProperty('--ctx-origin', (x > window.innerWidth - r.width - 40 ? 'right top' : 'left top'));
      m.classList.remove('ctx-anim'); void m.offsetWidth; m.classList.add('ctx-anim');
    } catch (e0) { if (window.__silent) window.__silent(e0); }
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
        window.__ctxMenuLastHit = hit;
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
      if (menuEl && menuEl.style.display === 'block' && lastHit) { lastHit = null; try { e.preventDefault(); } catch (err) { if (window.__silent) window.__silent(err); } }
    }, { passive: false });
    root.addEventListener('touchcancel', function () { if (timer) { clearTimeout(timer); timer = null; } }, { passive: true });
    root.addEventListener('contextmenu', function (e) {
      var hit = e.target.closest ? e.target.closest(selector) : null;
      if (!hit) return;
      e.preventDefault();
      window.__ctxMenuLastHit = hit;
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
/* ===== v359 条2：全站统一横滑切换手势（一套逻辑全站通用） =====
   阈值 60px / 横向位移须为纵向 2 倍以上 / 到头自然弹回、无任何提示。
   onSwipe(dir)：dir=1 左滑（下一个）、-1 右滑（上一个）。
   isActive()：可选，返回 false 时本次手势不响应（如弹窗开着时不响应页面级手势）。
   排除区（统一）：输入框/下拉/按钮/链接/视频/富文本/统计图表/轮播/文件卡——这些区域有自己的交互。 */
window.__swipeExclude = 'input, textarea, select, video, .rte-editor, .line-chart, .modal-nav-arrow, .cat-picker-panel, .modal-carousel, .file-folder-wrap, .lightbox';
window.__bindSwipeSwitch = function (el, onSwipe, isActive) {
  if (!el || !onSwipe) return;
  var sx = 0, sy = 0, on = false;
  el.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { on = false; return; }
    if (isActive && !isActive()) { on = false; return; }
    var t = e.target;
    if (window.__swipeExclude && t.closest && t.closest(window.__swipeExclude)) { on = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; on = true;
  }, { passive: true });
  el.addEventListener('touchend', function (e) {
    if (!on) return; on = false;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
    onSwipe(dx < 0 ? 1 : -1);
  }, { passive: true });
};

window.bindLightbox = function (root) {
  if (!root) return;
  root.querySelectorAll('img').forEach(function (im) {
    if (im.dataset.lb) return;
    im.dataset.lb = '1';
    im.style.cursor = 'zoom-in';
    im.addEventListener('click', function (ev) {
      ev.stopPropagation();
      /* v358 S3：把同容器内所有图收集成一组——灯箱内左右滑可切本组图/视频 */
      var srcs = Array.prototype.map.call(root.querySelectorAll('img'), function (x2) { return x2.currentSrc || x2.src; });
      window.openLightbox(im.currentSrc || im.src, { list: srcs });
    });
  });
  root.querySelectorAll('video').forEach(function (v) {
    if (v.dataset.lb) return;
    v.dataset.lb = '1';
    v.style.cursor = 'zoom-in';
    v.addEventListener('click', function (ev) { ev.stopPropagation(); v.pause(); window.openLightbox(v.currentSrc || v.src); });
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
  /* v336 条135/140：撤销条独立通道——不排队、出现那一刻才起算 10 秒、多条并存底部。
     根治“连删两条时第二条的撤销是假动作”（旧实现排队导致真删先于撤销按钮出现）。 */
  var __undoStack = []; /* v343 条53：连删多条时，撤销条纵向排开，互不遮挡 */
  function __relayoutUndo() {
    var base = __toastTop() + 8;
    __undoStack.forEach(function (x, i) { try { x.style.top = (base + i * 54) + 'px'; } catch (e) { if (window.__silent) window.__silent(e); } });
  }
  function showImmediate(it) {
    var t = document.createElement('div');
    t.className = 'ui-toast' + (it.t === 'error' ? ' error' : ''); t.setAttribute('role','status'); t.setAttribute('aria-live','polite');
    __undoStack.push(t); __relayoutUndo();
    var left = Math.round(((window.WN_CONST && window.WN_CONST.UNDO_MS) || 10000) / 1000), done = false; /* v343 条8：撤销秒数走常量 */
    var txt = document.createElement('span'); txt.textContent = it.m;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'undo-btn'; btn.textContent = '撤销（' + left + 's）';
    var timer = setInterval(function () {
      left--; if (left <= 0) { clearInterval(timer); btn.textContent = '撤销'; cleanup(); return; }
      btn.textContent = '撤销（' + left + 's）';
    }, 1000);
    function cleanup() {
      if (done) return; done = true;
      clearInterval(timer);
      try { if (t.parentNode) t.parentNode.removeChild(t); } catch (e) { if (window.__silent) window.__silent(e); }
      var ix = __undoStack.indexOf(t); if (ix > -1) __undoStack.splice(ix, 1);
      __relayoutUndo(); /* v343 条53：移除后其余自动上移 */
    }
    btn.addEventListener('click', function () {
      if (done) return;
      done = true; clearInterval(timer);
      try { it.undo(); } catch (e) { if (window.__silent) window.__silent(e); }
      try { window.uiToast('已撤销', 'success'); } catch (e) { if (window.__silent) window.__silent(e); }
      cleanup();
    });
    t.appendChild(txt); t.appendChild(btn);
    document.body.appendChild(t);
    setTimeout(cleanup, (((window.WN_CONST && window.WN_CONST.UNDO_MS) || 10000) + 500));
  }
  /* v341：提示条位置按「真实顶栏底部 + 12px」计算——顶栏在手机上会换成两行（约 100px），
     死写 80px 会压住第二行的标签栏（也是「资源管理被挡住、下划线看不见」的真因）。 */
  function __toastTop() {
    try {
      var tb = document.querySelector('.topbar');
      if (tb) {
        var b = tb.getBoundingClientRect().bottom;
        if (b > 0) return Math.round(b + 12);
      }
    } catch (e) { if (window.__silent) window.__silent(e); }
    return 80;
  }
  function next() {
    if (!q.length) { busy = false; return; }
    busy = true;
    var it = q.shift();
    var t = document.createElement('div');
    t.className = 'ui-toast' + (it.t === 'error' ? ' error' : ''); t.setAttribute('role','status'); t.setAttribute('aria-live','polite'); t.style.top = __toastTop() + 'px'; /* v341 */ /* v336 条184 */
    if (it.undo) { showImmediate(it); busy = false; next(); return; } /* 不再占用队列 */
    t.textContent = it.m;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('leaving'); }, 2000);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); next(); }, 2300);
  }
  return function (msg, type, undoFn) {
    if (undoFn) { showImmediate({ m: String(msg || ''), t: type || '', undo: undoFn }); return; } /* v336 条135：撤销独立显示 */
    q.push({ m: String(msg || ''), t: type || '', undo: null });
    if (!busy) next();
  };
})();

/* v330 条18：全系统按钮「图标 + 文字」自适应——
   每个按钮挂 data-pri（数字越小优先级越高，1=最先保留文字），容器加 .btn-fit-group。
   空间不够时从优先级最低的开始收成纯图标（加 .ico-only），优先保证高优先级（如"编辑"）显示文字。
   调用：window.__btnFit()（页面渲染后 / 窗口 resize 时） */
window.__btnFit = function () {
  try {
    var groups = document.querySelectorAll('.btn-fit-group');
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g];
      /* v352 条10：先量宽度，量不到（面板隐藏/未布局=宽 0）就整组跳过、保持原状——
         原写法先把全部按钮恢复成文字、再发现量不到直接 continue，
         结果隐藏过的组一被扫到就全变文字且不再收回去（图标⇄文字来回跳、文字显示不全的根因） */
      var avail = grp.clientWidth;
      if (!avail) continue;
      var btns = Array.prototype.slice.call(grp.querySelectorAll('.btn-fit[data-pri]'));
      if (!btns.length) continue;
      btns.sort(function (a, b) { return (Number(a.dataset.pri) || 99) - (Number(b.dataset.pri) || 99); });
      /* 先全部恢复文字，再按优先级从低到高逐个收起，直到不溢出 */
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('ico-only');
      for (var j = btns.length - 1; j >= 0; j--) {
        if (grp.scrollWidth <= avail + 1) break;
        btns[j].classList.add('ico-only');
      }
      /* v345 条4 + v352 修：单按钮级截断检测——原来写在组循环外面、只会扫到最后一组，已移进各组 */
      for (var k = 0; k < btns.length; k++) {
        var bt = btns[k];
        if (bt.classList.contains('ico-only')) continue;
        var clipped = bt.scrollWidth > bt.clientWidth + 1;
        if (!clipped) {
          var lab = bt.querySelector('.btn-lab');
          if (lab && lab.scrollWidth > lab.clientWidth + 1) clipped = true;
        }
        if (clipped) bt.classList.add('ico-only');
      }
    }
  } catch (e) { if (window.__silent) window.__silent(e); }
};
window.addEventListener('resize', function () {
  clearTimeout(window.__btnFitTimer);
  window.__btnFitTimer = setTimeout(function () { window.__btnFit(); }, 150);
});


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
    } catch (e) { if (window.__silent) window.__silent(e); }
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
    scrollers(mask).forEach(function (el, i) { try { delete posMap[mk + '|' + key + '|' + i]; } catch (e) { if (window.__silent) window.__silent(e); } });
    if (lastKey[mk] === key) lastKey[mk] = null;
  }
  return { open: open, forget: forget };
})();

// v296（用户 10-04 02:14）：304 四页 warn 函数统一提取——部署检测用红色顶部警告条
// v333 修：原实现写在上面 IIFE 的 `return` 之后，永远执行不到 → 四页自检调用时报
//   "window.warn is not a function"，关键部署提示彻底失效。移到 IIFE 外，保证可用。
window.warn = function (t) {
  if (document.getElementById('__deployWarn')) return;
  var b = document.createElement('div');
  b.id = '__deployWarn';
  b.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:100200;background:var(--red-strong);color:#fff;font:14px/1.6 sans-serif;padding:10px 14px;text-align:center;box-shadow:var(--shadow-pop,0 4px 16px rgba(0,0,0,0.14))';
  b.textContent = t;
  if (document.body) document.body.appendChild(b);
  document.addEventListener('DOMContentLoaded', function () { if (!b.parentNode && document.body) document.body.appendChild(b); });
};

/* ===== R243 条19②：命令面板（Ctrl+K）全站组件 =====
   从 admin.js R192 后台命令面板 IIFE 抽提参数化——admin 页传页面/操作命令，
   前台页（index/shop/error）传资源直达命令（搜到资源直接打开详情）。
   入口仅键盘 Ctrl+K（桌面端），↑↓ 选择、Enter 执行、Esc 关闭（Esc 已注册进
   __modalKit，与全站弹窗栈路由一致）；面板本身是 DOM 弹层，页面不新增任何图标/按键。
   调用：window.__cpPanel({ placeholder, busy, cmds, status })
   - cmds: function () { return [{ lab, tag, kw, run }, ...] }（每次呼出实时求值）
   - status: function () { return 'loading' | 'error' | null }（可选）——数据源还在加载/加载失败时，
     搜索无结果时面板显示「搜索中…」/「搜索失败，请重试」小字，不再显示成空白（v327 用户要求）
   - busy: 编辑类弹窗开着时不抢键的选择器（默认全站弹窗家族）
   样式：ui-common.css .cp-mask 作用域块（与 admin.css 命令面板同值）。 */
window.__cpPanel = function (opts) {
  if (!window.__uiCommonLoaded) return;
  if (window.__cpPanelInst) { window.__cpPanelInst.setCmds(opts && opts.cmds); return; } /* 单实例：重复调用只换命令源 */
  opts = opts || {};
  var getCmds = opts.cmds || function () { return []; };
  var getStatus = opts.status || function () { return null; }; /* v327：数据源加载状态（loading/error/null） */
  var busySel = opts.busy || '.modal-mask.open, .kf-mask.open, .share-mask.open, .ann-mask.open';

  var mask = document.createElement('div');
  mask.className = 'cp-mask'; mask.id = 'cpMask';
  mask.innerHTML =
    '<div class="cp-box" role="dialog" aria-label="命令面板">' +
      '<input class="cp-input" id="cpInput" autocomplete="off" />' +
      '<div class="cp-list" id="cpList"></div>' +
    '</div>';
  document.body.appendChild(mask);
  var input = mask.querySelector('#cpInput'), listEl = mask.querySelector('#cpList');
  var items = [], active = 0;

  function cpClose() { mask.classList.remove('open'); input.value = ''; input.blur(); }
  function cpRender() {
    var kw = input.value.trim().toLowerCase();
    var all = [];
    try { all = getCmds() || []; } catch (e) { if (window.__silent) window.__silent(e); }
    items = !kw ? all : all.filter(function (c) { return (c.lab + ' ' + c.kw).toLowerCase().indexOf(kw) !== -1; });
    items = items.slice(0, 10); active = Math.min(active, Math.max(0, items.length - 1));
    if (!items.length) {
      /* v327：数据源还在加载/加载失败时给出状态小字（用户要求：搜索不白屏）；
         「搜索中…」在没输入关键词时也显示——面板刚打开全量数据没回来，列表同样会空 */
      var _st = getStatus();
      if (_st === 'loading') { listEl.innerHTML = '<div class="cp-empty">搜索中…</div>'; return; }
      if (_st === 'error') { listEl.innerHTML = '<div class="cp-empty">搜索失败，请重试</div>'; return; }
      listEl.innerHTML = '<div class="cp-empty">没有匹配的命令</div>'; return;
    }
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
  function cpRun(i) { var c = items[i]; if (!c) return; cpClose(); try { c.run(); } catch (e) { if (window.__silent) window.__silent(e); } }

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
  window.__cpPanelInst = { setCmds: function (fn) { if (fn) getCmds = fn; }, refresh: function () { if (mask.classList.contains('open')) cpRender(); } }; /* v327：refresh——数据源异步就绪后通知面板重画（面板开着才重画） */
};

/* v349：图片版本号与客服二维码唯一来源。
   原先客服弹窗里的二维码写死 ?v=325（其余图片已统一 v330），换客服码后弹窗里仍是旧图；
   且 /assets/images/ 的版本号统一脚本只在页面加载时跑一次，动态赋值的二维码根本没被同步。 */
window.__imgVer = function () {
  try { return String(window.IMG_VERSION || '330').replace(/^v/, ''); } catch (e) { return '330'; }
};
window.__kefuQrSrc = function () { return '/assets/images/kefu.png?v=' + window.__imgVer(); };

/* v293（用户 10-04 02:14）：063Logo错误处理统一→提取公共函数，四页共用 */
/* v330 条29：图片版本号集中生效——扫描站内 /assets/images/ 图片，
   与 config.js 的 window.IMG_VERSION 不一致时自动改写为最新号（换图只改一处常量，四页不再手改）。 */
(function () {
  function syncImgVersion() {
    try {
      var v = window.IMG_VERSION;
      if (!v) return;
      v = String(v).replace(/^v/, ''); /* v333 修：config.js 里写成 'v330'，拼接会得到 ?v=v330（与页面写的 ?v=330 不一致，同一个图被缓存成两份、换图不生效）→ 统一按纯数字拼接 */
      var imgs = document.querySelectorAll('img[src*="/assets/images/"]');
      for (var i = 0; i < imgs.length; i++) {
        var im = imgs[i];
        var src = im.getAttribute('src') || '';
        if (src.indexOf('?v=' + v) !== -1) continue;
        var base = src.split('?')[0];
        im.setAttribute('src', base + '?v=' + v);
      }
    } catch (e) { if (window.__silent) window.__silent(e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncImgVersion);
  else syncImgVersion();
})();

/* v330 条28：无障碍补全——
   ① 有 title 但没 aria-label 的按钮自动补齐（读屏软件才知道念什么）；
   ② 纯图标按钮（无可见文字）必须有名字，没有就取 title；
   ③ 键盘焦点环统一（已有 :focus-visible，此处兜底无文字按钮的最小点击区）。 */
(function () {
  function runA11y() {
    try {
      var bs = document.querySelectorAll('button, [role="button"], a[title]');
      for (var i = 0; i < bs.length; i++) {
        var b = bs[i];
        if (b.getAttribute('aria-label')) continue;
        var t = b.getAttribute('title');
        if (!t) continue;
        b.setAttribute('aria-label', t);
      }
    } catch (e) { if (window.__silent) window.__silent(e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runA11y);
  else runA11y();
  /* 动态生成的按钮（列表行/弹窗）也补：每 800ms 巡检一次，最多 10 次，覆盖渲染完成 */
  var __n = 0;
  var __t = setInterval(function () { runA11y(); if (++__n > 10) clearInterval(__t); }, 800);
})();

/* v330 条21：加载失败就地重试——不再只弹一句提示让用户干瞪眼/手动刷新。
   window.__showLoadRetry(container, retryFn)：在容器里渲染「加载失败 + 重试按钮」；
   window.__clearLoadRetry(container)：数据回来时清掉。 */
window.__showLoadRetry = function (container, retryFn) {
  try {
    if (!container) return;
    var old = container.querySelector('.load-retry');
    if (old) old.parentNode.removeChild(old);
    var box = document.createElement('div');
    box.className = 'load-retry';
    var t = document.createElement('div');
    t.textContent = '加载失败，网络开小差了'; /* v336 条156：文案与空态一致 */
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'lr-btn'; b.textContent = '重试';
    b.addEventListener('click', function () {
      if (b.disabled) return; /* v336 条157：防连点 */
      b.disabled = true; b.textContent = '重试中…';
      try { window.__clearLoadRetry(container); } catch (e) { if (window.__silent) window.__silent(e); }
      try { if (retryFn) retryFn(); } catch (e2) { if (window.__silent) window.__silent(e2); }
    });
    box.appendChild(t); box.appendChild(b);
    container.appendChild(box);
  } catch (e) { if (window.__silent) window.__silent(e); }
};
window.__clearLoadRetry = function (container) {
  try {
    if (!container) return;
    var el = container.querySelector('.load-retry');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  } catch (e) { if (window.__silent) window.__silent(e); }
};

/* ===== v333 整理：封面轮播组件收归公共层 =====
   原来 shop.js 与 admin.js 各自持有一份逐字相同的 renderCarousel（约 86 行 ×2），
   改一处必漏另一处（这次就正好：两处都误用 escapeHtml 处理图片地址，先修了 shop 那份，
   admin 那份还是坏的）。现把这唯一一份实现放在公共层，两页都调它，以后只改这里。
   参数：window.__renderCarousel(轮播容器, 轨道, 小圆点容器, 单图兜底 img, 图片数组, 占位图)
   行为与原来完全一致：3 秒自动轮播、拖动/点击切换、取模循环、鼠标悬停暂停、
   关闭时必须调 __ccPause 停表（防止关了弹窗后台还在换图）。 */
window.__renderCarousel = function (carouselEl, trackEl, dotsEl, fallbackImgEl, images, ph) {
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
  var st = carouselEl.__ccState || (carouselEl.__ccState = { idx: 0, len: images.length });
  st.idx = 0; st.len = images.length;
  trackEl.innerHTML = '';
  images.forEach(function (url) {
    var slide = document.createElement('div');
    slide.className = 'cc-slide';
    var img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.style.opacity = '0';
    img.style.cursor = 'zoom-in';
    img.onload = function () { img.style.opacity = '1'; };
    img.onerror = function () { img.style.opacity = '1'; img.classList.add('media-fail'); img.src = ph || window.__IMG_PLACEHOLDER || ''; };
    img.addEventListener('click', function () {
      if (trackEl.__ccDragged) { trackEl.__ccDragged = false; return; }
      if (window.openLightbox) window.openLightbox(url);
    });
    slide.appendChild(img);
    img.src = url; /* v333 修：不能用 escapeHtml —— & 会被转义导致带参数的封面图加载失败 */
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
    st.idx = (idx + st.len) % st.len;
    trackEl.style.transform = 'translateX(-' + (st.idx * 100) + '%)';
    if (dotsEl) dotsEl.querySelectorAll('.cc-dot').forEach(function (d, i) { d.classList.toggle('active', i === st.idx); });
    restartTimer();
  }
  function pause() { if (carouselEl.__ccTimer) { clearInterval(carouselEl.__ccTimer); carouselEl.__ccTimer = null; } }
  function restartTimer() { pause(); carouselEl.__ccTimer = setInterval(function () { goToSlide(st.idx + 1); }, 3000); }
  carouselEl.__ccPause = pause;
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
      if (dx < -40) goToSlide(st.idx + 1);
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
  restartTimer();
};

/* v333 修：原 data URI 里 <text> 的闭合标签被误写成 </t>，且标签内没有任何字符 —— logo 加载失败时只能看到一块灰方块，没有提示。
   现改为闭合正确的 </text> 并在中间放一个「!」，全站（含轮播占位的老板要求口径）共用同一个占位图常量。 */
/* v336 条9：全站占位图唯一源（感叹号画风） */
window.__IMG_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 24 24%22%3E%3Crect width=%2224%22 height=%2224%22 rx=%223%22 fill=%22%23f5f5f5%22/%3E%3Cpath d=%22M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z%22 fill=%22%23c3ccd6%22/%3E%3Ccircle cx=%2212%22 cy=%2217.5%22 r=%221.7%22 fill=%22%23c3ccd6%22/%3E%3C/svg%3E';
window.__logoFail = function (im) {
  try {
    im.onerror = null;
    im.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 24 24%22%3E%3Crect width=%2224%22 height=%2224%22 rx=%223%22 fill=%22%23f5f5f5%22/%3E%3Cpath d=%22M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z%22 fill=%22%23c3ccd6%22/%3E%3Ccircle cx=%2212%22 cy=%2217.5%22 r=%221.7%22 fill=%22%23c3ccd6%22/%3E%3C/svg%3E'; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block'; im.style.opacity = '1'; if (im.parentNode) { im.parentNode.style.opacity = '1'; if (!im.parentNode.classList.contains('logo-enter')) im.parentNode.classList.add('logo-enter'); } } catch (e) { if (window.__silent) window.__silent(e); } };

/* v297（用户 10-04 02:14）：C-242 翻页按钮置灰逻辑提取到公共函数，前后台共用 */
window.__setPagerDisabled = function (btn, disabled) { btn.disabled = disabled; btn.style.opacity = disabled ? '0.4' : ''; };

/* ===== v330 条18：全系统按钮图标库（一处定义，四页复用）=====
   口径：24 视框、线稿 stroke=2、圆头圆角（与全站 × 图标同一套语言）。
   用法：window.__btnIcon('edit') 返回 <svg class="btn-ico">…</svg> 字符串。 */
window.__btnIcon = function (name) {
  var P = {
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/><path d="M14.5 5.5l4 4"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h8"/>',
    hide: '<path d="M3 3l18 18"/><path d="M10.6 5.2A7.5 7.5 0 0112 5c5 0 9 7 9 7a15 15 0 01-2.3 3"/><path d="M6.3 6.4A15 15 0 003 12s4 7 9 7a7.4 7.4 0 003.2-.7"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
    show: '<path d="M3 12s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z"/><circle cx="12" cy="12" r="3"/>',
    del: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
    code: '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/>',
    /* v341 条4：资源码专用钥匙图标（形如钥匙：圆环+齿） */
    key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3"/><path d="M17 6l3 3"/>',
    bind: '<path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 016 6l-1 1"/><path d="M13 18l-1 1a4 4 0 01-6-6l1-1"/>',
    add: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M9 4v5h6V4"/><path d="M8 20v-6h8v6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    service: '<path d="M4 13a8 8 0 018-8 8 8 0 018 8v1a3 3 0 01-3 3H7a3 3 0 01-3-3z"/><path d="M9 13h.01M12 13h.01M15 13h.01"/>',
    export: '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 21h16"/>',
    cat: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="15" width="7" height="5" rx="1.5"/><rect x="14" y="15" width="7" height="5" rx="1.5"/>',
    refresh: '<path d="M20 12a8 8 0 10-3 6.2"/><path d="M20 6v6h-6"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    up: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
    stats: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>'
  };
  var d = P[name];
  if (!d) return '';
  return '<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
};
/* 给已有按钮补图标（保留原文字）：window.__decorateBtn(btn, iconName, pri) */
window.__decorateBtn = function (btn, iconName, pri) {
  if (!btn || !window.__btnIcon) return btn;
  try {
    if (btn.querySelector('.btn-ico')) return btn; /* 已有图标不重复加 */
    var svg = window.__btnIcon(iconName);
    if (!svg) return btn;
    var lab = btn.querySelector('.btn-lab');
    if (!lab) {
      lab = document.createElement('span');
      lab.className = 'btn-lab';
      lab.textContent = btn.textContent;
      btn.textContent = '';
      btn.appendChild(lab);
    }
    btn.insertAdjacentHTML('afterbegin', svg);
    btn.classList.add('btn-fit');
    if (pri) btn.setAttribute('data-pri', String(pri));
  } catch (e) { if (window.__silent) window.__silent(e); }
  return btn;
};

/* ===== v336 条4：内容安检唯一源（取自资源页版并集白名单；资源页与后台都转发到这里，标准全站一致） ===== */
window.__sanitizeCore = function (html) {
  if (!html) return '';
  // v320（用户 10-05 22:37）：放行文件卡相关标签（SVG 细线条图标）
  var allowed = { A:1, BR:1, P:1, STRONG:1, EM:1, B:1, I:1, U:1, S:1, SPAN:1, DIV:1, FONT:1,
    UL:1, OL:1, LI:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, BLOCKQUOTE:1, CODE:1, PRE:1, HR:1,
    IMG:1, VIDEO:1, SOURCE:1,
    TABLE:1, TBODY:1, THEAD:1, TR:1, TD:1, TH:1, INPUT:1,
    SVG:1, PATH:1, POLYLINE:1, LINE:1, POLYGON:1, RECT:1, CIRCLE:1, ELLIPSE:1, G:1, DEFS:1, USE:1, TEXT:1 }; /* R194 + v320 */
  // 允许的属性
  // v320（用户 10-05 22:37）：放行文件卡 data-* 属性 + SVG 绘制属性
  var allowedAttrs = {
    A: ['href','target','rel','title','data-dl'],
    IMG: ['src','alt','title','style','width','height'],
    VIDEO: ['src','controls','autoplay','loop','muted','poster','style','width','height'],
    SOURCE: ['src','type'],
    SPAN: ['style','color','data-action'],
    FONT: ['color','size','face'],
    DIV: ['style','data-file-id','data-file-type','data-action','data-folder-list','data-key','data-size','data-ftype'], /* v351：文件行的 data-key/size/ftype 放行（客户下载依赖；data 属性本身无行为） */
    P: ['style'],
    H1: ['style'], H2: ['style'], H3: ['style'], H4: ['style'], H5: ['style'], H6: ['style'],
    LI: ['style'], UL: ['style'], OL: ['style'],
    BLOCKQUOTE: ['style'], CODE: ['style'], PRE: ['style'],
    TABLE: ['style','width'], TBODY: ['style'], THEAD: ['style'], TR: ['style'],
    TD: ['style','colspan','rowspan','width'], TH: ['style','colspan','rowspan','width'], /* R194 */
    INPUT: ['type','checked'], /* R215 条4：复选框只放行 type/checked */
    BUTTON: ['type','title','data-action'],
    SVG: ['viewBox','width','height','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','style'],
    PATH: ['d'],
    POLYLINE: ['points'],
    LINE: ['x1','y1','x2','y2'],
    POLYGON: ['points'],
    RECT: ['x','y','width','height','rx','ry'],
    CIRCLE: ['cx','cy','r'],
    ELLIPSE: ['cx','cy','rx','ry'],
    G: ['transform'],
    USE: ['href','xlink:href'],
    TEXT: ['x','y','dx','dy']
  };
  try {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var els = doc.body.querySelectorAll('*');
    els.forEach(function (el) {
      var tag = el.tagName.toUpperCase();
      if (!allowed[tag]) {
        /* v351：BUTTON 整个移除（不转文字）——正文里的按键是文件卡的管理端控件
           （删除×/复制/替换等），剥成文字会在客户页留下一排孤立 ×；正文编辑器也
           没有任何入口能插入按键，整删不影响正常内容 */
        if (tag === 'BUTTON') { if (el.parentNode) el.parentNode.removeChild(el); return; }
        var text = document.createTextNode(el.textContent);
        if (el.parentNode) el.parentNode.replaceChild(text, el);
        return;
      }
      // 只保留允许的属性，移除危险属性
      var tagAllowed = allowedAttrs[tag] || allowedAttrs[el.tagName] || [];
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
};

/* ===== v336 条16：全站唯一时间格式化（北京时间，date="2026-01-02"、time="15:04"、stamp="2026-01-02 15:04"） ===== */
window.__fmtDateTime = function (input, kind) {
  try {
    var d = (input instanceof Date) ? input : new Date(Number(input) || input);
    if (isNaN(d.getTime())) return '';
    var p = function (x) { return String(x).padStart(2, '0'); };
    var date = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    var time = p(d.getHours()) + ':' + p(d.getMinutes());
    if (kind === 'date') return date;
    if (kind === 'time') return time;
    return date + ' ' + time;
  } catch (e) { return ''; }
};

(function () {
  /* v336 条180：焦点圈闭实现——监听 Tab，焦点在弹窗外时拉回弹窗 */
  var lastTrigger = null;
  document.addEventListener('focusin', function (e) {
    var open = document.querySelector('.modal-mask.open, .share-mask.open, .kf-mask.open');
    if (!open) return;
    if (!open.contains(e.target)) {
      var f = open.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (f) { try { f.focus(); } catch (err) { if (window.__silent) window.__silent(err); } }
    }
  }, true);
})();

/* v349 条7：图片加载失败的占位图——全站唯一一份（原先资源页/管理页/公共层各抄一份，改一处漏两处） */
window.WN_MEDIA_FALLBACK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" rx="3" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E';

/* v349 条9：后台「空空的列表」统一小空态（图标＋标题＋提示）——
   原先后台各处空态是一行干巴巴的小字，和前台带插画的空态不是一个画风。 */
window.__adminEmpty = function (title, hint) {
  return '<div style="text-align:center;padding:26px 12px;">'
    + '<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="opacity:.45;margin-bottom:8px;color:var(--text-faint,#999);display:inline-block;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>'
    + '<div style="font-size:13px;font-weight:600;color:var(--text-light,#666);">' + String(title || '暂无内容') + '</div>'
    + (hint ? '<div style="font-size:12px;color:var(--text-faint,#999);margin-top:4px;">' + String(hint) + '</div>' : '')
    + '</div>';
};

/* v351 C2：收集一段富文本里引用到的全部存储文件 key（/img/ 与 /files/ 两种前缀）——
   保存资源时新旧对比，"只在旧版本出现"的文件交后端复核后自动删除，不留垃圾 */
window.__collectFileKeys = function (text) {
  var out = [], seen = new Set();
  var re = /\/(?:files|img)\/((?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}\.[a-zA-Z0-9]+(?:_t)?)/g;
  String(text || '').replace(re, function (m, key) {
    if (!seen.has(key)) { seen.add(key); out.push(key); }
    return m;
  });
  return out;
};

/* v356 条22：缩略图地址换算唯一源（原资源页/管理页各抄一份） */
window.__thumbOf = function (url) {
  var u = String(url || '');
  if (!/^\/img\/images\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i.test(u)) return u;
  return u.replace(/\.(png|jpe?g|webp|gif)$/i, '_t.webp');
};

/* v336 条208：安检包装——内容被大幅剥离时给管理员一次轻提示（不再无声吞掉） */
window.__sanitizeHTML = function (html) {
  /* v352 遗留6：去掉"已自动移除部分不支持的内容"提示——详情/公告里带文件卡时这句每次进页都弹，烦；
     净化本身照常静默执行（内容安全性不受影响） */
  return window.__sanitizeCore(html);
};

/* v343 条66：弹窗打开时把键盘范围“圈住”——Tab 只在弹窗内循环，不会跑到背后被遮住的按钮上（防误操作） */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Tab') return;
  var masks = document.querySelectorAll('.modal-mask.open, .share-mask.open, .kf-mask.open, .qrcode-mask.open, .lightbox.open');
  if (!masks.length) return;
  var box = masks[masks.length - 1];
  var f = box.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  f = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null; });
  if (!f.length) return;
  var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* v347：二维码生成——全站共享一份（资源页 + 管理页长按菜单统一「存二维码」） */
(function () {
  function __toast(msg, type) {
    try { if (typeof window.uiToast === 'function') window.uiToast(msg, type); else if (typeof window.showToast === 'function') window.showToast(msg, type); } catch (e) { if (window.__silent) window.__silent(e); }
  }
  /* 生成指向资源页的分享地址：在资源页沿用当前路径，在后台等其他页统一指向 /shop */
  function __makeQrUrl(pid) {
    var path = /shop/i.test(window.location.pathname) ? window.location.pathname : '/shop';
    return window.location.origin + path + '?pid=' + pid;
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
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, realSize, realSize);
      ctx.fillStyle = '#000000';
      for (var r = 0; r < n; r++) { for (var c = 0; c < n; c++) { if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell); } }
      cb && cb(canvas.toDataURL('image/png'));
    } catch (e) { cb && cb(null); }
  }
  window.__genQrPng = __genQrPng;
  function __qrFileName(pid, name) {
    var base = (name || '').replace(/[\\\/:*?"<>|]/g, '-').trim();
    if (!base) base = '资源' + pid;
    return base + '-二维码.png';
  }
  /* 存二维码：把二维码做成一张「站名 + 资源名」的竖版图，直接可发朋友圈 */
  window.__savePosterPng = function (pid, onDone, name) {
    var url = __makeQrUrl(pid);
    __genQrPng(url, 300, function (qrUrl) {
      if (!qrUrl) { __toast('二维码生成失败', 'error'); onDone && onDone(null); return; }
      try {
        var W = 420, H = 580;
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        var g = cv.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#1E88E5'; g.fillRect(0, 0, W, 84);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#ffffff';
        g.font = '600 24px system-ui, "Microsoft YaHei", sans-serif';
        g.fillText((window.SHOP_CONFIG && window.SHOP_CONFIG.shopName) || '万能资源圈', W / 2, 42);
        var _t = String(name || '').trim() || ('资源' + pid);
        if (_t.length > 16) _t = _t.slice(0, 16) + '…';
        g.fillStyle = '#222';
        g.font = '600 19px system-ui, "Microsoft YaHei", sans-serif';
        g.fillText(_t, W / 2, 132);
        var qs = 280;
        var img = new Image();
        img.onload = function () {
          try {
            g.drawImage(img, (W - qs) / 2, 172, qs, qs);
            g.fillStyle = '#999';
            g.font = '15px system-ui, "Microsoft YaHei", sans-serif';
            g.fillText('长按识别二维码 · 查看资源', W / 2, 172 + qs + 48);
            var dataUrl = cv.toDataURL('image/png');
            var a = document.createElement('a');
            a.href = dataUrl; a.download = __qrFileName(pid, name);
            document.body.appendChild(a); a.click(); a.remove();
            __toast('二维码已保存', 'success');
            onDone && onDone(dataUrl);
          } catch (e) { __toast('二维码生成失败', 'error'); onDone && onDone(null); }
        };
        img.onerror = function () { __toast('二维码生成失败', 'error'); onDone && onDone(null); };
        img.src = qrUrl;
      } catch (e) { __toast('二维码生成失败', 'error'); onDone && onDone(null); }
    });
  };
})();
