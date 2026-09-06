/**
 * 万能资源圈 公共 UI：统一浮起式滚动条
 * - 所有滚动容器（弹窗内容区/下拉面板/公告列表/富文本/时间弹窗/统计表）统一绑定
 * - 滚动时滚动条浮现（.sb-active），停止约 1 秒后自动淡化隐藏
 * - 初始扫描 + MutationObserver 自动绑定动态弹窗/列表，无需各页面重复写绑定逻辑
 */
(function () {
  'use strict';
  var HIDE_MS = 1000;
  var SEL = '.modal-box,.cat-picker-panel,.ann-list,.rte-editor,.dt-pop,.stat-table-wrap';
  var ACTIVE = 'sb-active';
  var timers = {};
  var uid = 0;

  function bind(el) {
    if (!el || el.__sbInit) return;
    el.__sbInit = true;
    el.__sbId = 'sb' + (++uid);
    el.classList.add('sb-fade');
    el.addEventListener('scroll', function () {
      el.classList.add(ACTIVE);
      var t = timers[el.__sbId];
      if (t) { clearTimeout(t); timers[el.__sbId] = null; }
      timers[el.__sbId] = setTimeout(function () {
        el.classList.remove(ACTIVE);
        timers[el.__sbId] = null;
      }, HIDE_MS);
    }, { passive: true });
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
        '<button class="kf-jump" id="kfJumpBtn" type="button">跳转-咨询在线客服</button>' +
        '<button class="kf-close" id="kfCloseBtn" type="button">关闭</button>' +
      '</div>';
    document.body.appendChild(m);
    function close() {
      m.classList.remove('open');
      document.body.style.overflow = '';
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
      img.onerror = function () { this.onerror = null; this.src = KF_QR_FAIL; };
      img.src = qrImg || 'assets/images/kefu.png';
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
      document.body.style.overflow = 'hidden';
    }
  };
})();
