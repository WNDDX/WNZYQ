/**
 * 万能资源圈 公共 UI（加载标记 + 统一客服弹窗 + 统一提示弹窗）
 * 自定义滚动条已取消：恢复浏览器默认滚动条（用户要求）
 */
window.__uiCommonLoaded = true;

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
      btn.style.display = btnText ? '' : 'none'; btn.textContent = btnText || '跳转-咨询在线客服'; btn.setAttribute('data-url', url || '');
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
    try {
      var mask = document.createElement('div');
      mask.className = 'share-mask';
      mask.setAttribute('role', 'dialog');
      mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.76);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
      mask.innerHTML =
        '<div class="share-box" style="background:#fff;border-radius:14px;position:relative;padding:26px 20px;width:100%;max-width:400px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);animation:modalIn 0.25s ease;">' +
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
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(uEl.textContent || '').catch(function () { try { __fallbackCopyText(uEl.textContent || ''); } catch (e) {} });
            } else { __fallbackCopyText(uEl.textContent || ''); }
          } catch (e) {}
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
      // 复制（clipboard 优先 + textarea 兜底，链路与顶栏分享一致）
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url || '').catch(function () { try { __fallbackCopyText(url || ''); } catch (e) {} });
        } else { __fallbackCopyText(url || ''); }
      } catch (e) {}
      window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
    } catch (e) {}
  };
  function __fallbackCopyText(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
  // R22：分享链接复制提示——优先复用页面级 toast（资源页 showToast / 管理页 toast），都没有时兜底一个轻提示条
  function __shareToast(msg) {
    try {
      if (typeof window.showToast === 'function') { window.showToast(msg); return; }
      if (typeof window.toast === 'function') { window.toast(msg, 'success'); return; }
    } catch (e) {}
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);background:rgba(0,0,0,0.78);color:#fff;font-size:14px;padding:10px 18px;border-radius:8px;z-index:100000;pointer-events:none;opacity:0;transition:opacity .2s ease;max-width:86vw;box-sizing:border-box;';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { try { document.body.removeChild(t); } catch (e) {} }, 250); }, 2000);
  }

  // ===== 弹窗滚动锁：打开弹窗锁定背景滚动（PC overflow + 移动端拦截穿透），弹窗内部内容仍可正常滚动 =====
  var __touchLocked = false;
  function __blockTouch(e) {
    if (!e.target || !e.target.closest) return;
    var allow = e.target.closest('.modal-box,.kf-box,.share-box,.modal-inner,.lightbox-box,.lb-box,.rte-panel,.ann-box');
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
  window.syncBodyLock = function () {
    var open = document.querySelector('.modal-mask.open,.kf-mask.open,.share-mask.open,.lightbox-mask.open,.alert-mask.open,.confirm-mask.open,.lightbox.open');
    window.lockBodyScroll(!!open);
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
  //   1) 结构：上一页 | 页码信息 N / M（共X条）| 跳页输入+跳转键 | 下一页
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
    container.appendChild(prev); container.appendChild(info); container.appendChild(jump); container.appendChild(next);

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
