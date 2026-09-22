    /* ============================================
       管理页逻辑
       ============================================ */

    // ---------- 登录按钮事件委托兜底：即使下方任意脚本运行时出错，登录按钮依然可用 ----------
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('#loginBtn') : null;
      if (b && !window.__loginDirect && typeof doLogin === 'function') { try { doLogin(); } catch (err) {} }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var ae = document.activeElement; if (ae && (ae.id === 'loginUser' || ae.id === 'loginPass') && !window.__loginDirect && typeof doLogin === 'function') { try { doLogin(); } catch (err) {} } }
    });

    // R180（用户 09-16）：根因→密码输入框缺可见性切换；修法→追加眼睛图标按钮（R209 用户 09-19 00:34：登录框恢复 09-16 结构时一并恢复）
    // R209（用户 09-19 00:34）：根因→修法
    // R217 条3（老板 09-21）：两态黑白 SVG——旧实现点击后换成 🙈/👁 彩色 emoji（R215 只换了静态态），
    // 现在点击前后都是 stroke=currentColor 的黑白线条图标：开眼=显示密码、眼+斜线=隐藏密码
    // R231（用户 09-21 23:38）条9：rte 放大/还原按钮 ⛶/🗕 emoji 换全站统一 stroke 2px 线性 SVG（样式 .rte-zoom-ico 见 admin.css）
    var RTE_SVG_MAX = '<svg class="rte-zoom-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
    var RTE_SVG_MIN = '<svg class="rte-zoom-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>';
    var PWD_EYE_OPEN_SVG = '<svg class="pwd-eye-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    var PWD_EYE_OFF_SVG = '<svg class="pwd-eye-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="20" y2="20"/></svg>';
    function togglePwdVisibility() {
      var pwd = document.getElementById('loginPass');
      var btn = document.getElementById('pwdToggleBtn');
      if (!pwd || !btn) return;
      if (pwd.type === 'password') { pwd.type = 'text'; btn.innerHTML = PWD_EYE_OFF_SVG; btn.setAttribute('aria-label', '隐藏密码'); }
      else { pwd.type = 'password'; btn.innerHTML = PWD_EYE_OPEN_SVG; btn.setAttribute('aria-label', '显示密码'); }
    }

    // ---------- R156（用户 20:30）：时间显示统一转北京时间 ----------
    // 根因：D1 的 datetime('now') 存的是 UTC，绑定设备弹窗/统计最近动直接原样展示，
    // 比北京时间早 8 小时（用户 20:18 绑定却显示 12:18）。
    // 修法：展示层统一按 UTC+8 换算（固定偏移，不依赖浏览器时区），历史行也是 UTC 口径，全量一致。
    window.__utcToLocal = function (ts) {
      if (!ts || typeof ts !== 'string') return ts || '-';
      var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(ts.trim());
      if (!m) return ts;
      var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + 8 * 3600 * 1000);
      var p2 = function (n) { return String(n).padStart(2, '0'); };
      return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds());
    };
    // ---------- 全站统一：图片/视频加载失败 → 感叹号占位（与其它页面一致） ----------
    var EXC_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E';
    document.addEventListener('error', function (e) {
      var t = e.target;
      if (!t || !t.tagName) return;
      if (t.tagName === 'IMG' && !t.dataset.fh) {
        t.dataset.fh = '1';
        t.src = EXC_PLACEHOLDER; if (t && t.classList) t.classList.add('media-fail');
        t.style.objectFit = 'contain';
        t.style.display = 'block'; t.style.opacity = '1';
      } else if (t.tagName === 'VIDEO' && !t.dataset.fh) {
        t.dataset.fh = '1';
        // R137（用户 18:14）：视频失败用视频兜底卡（点击新窗口打开原链接），与前台 makeVideoFallback 同款；
        // 不再替换成图片感叹号占位——视频失败该是视频失败的占位样式。无地址视频直接移除（与前台 R91 口径一致）
        var _vu = t.getAttribute('src') || t.currentSrc || '';
        var _inRte = !!(t.closest && t.closest('[contenteditable=\"true\"]'));
        if (_vu) {
          var vf = document.createElement('div');
          vf.className = 'video-fallback';
          // R144（用户 23:50）：兜底卡是按键不是可编辑内容——落在富文本编辑器（contenteditable）内时
          // 必须整体锁定不可编辑，点击就是"新窗口播放"按键行为；全系统两处生成点同步（shop.js 同款）
          vf.setAttribute('contenteditable', 'false');
          // R147（用户 00:56）：编辑器内的卡必须可删除（否则坏视频卡删不掉）——
          // 记录原始地址 data-vsrc（保存时还原成 video 标签，内容不被卡污染）+ 卡右上角加删除键
          if (_inRte) vf.setAttribute('data-vsrc', _vu);
          var vl = document.createElement('a');
          vl.className = 'vf-link';
          vl.href = _vu; vl.target = '_blank'; vl.rel = 'noopener';
          vl.textContent = '点击在新窗口播放视频';
          vf.appendChild(vl);
          if (_inRte) {
            var vd = document.createElement('button');
            vd.type = 'button'; vd.className = 'vf-del'; vd.title = '删除这个视频';
            vd.setAttribute('contenteditable', 'false');
            vd.textContent = '×';
            vd.addEventListener('click', function (ev) {
              ev.preventDefault(); ev.stopPropagation();
              var card = vd.closest('.video-fallback');
              if (card) {
                var ed = card.closest('[contenteditable=\"true\"]');
                card.remove();
                if (ed) { try { ed.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {} }
              }
            });
            vf.appendChild(vd);
          }
          if (t.parentNode) t.parentNode.replaceChild(vf, t);
        } else if (t.parentNode) {
          t.parentNode.removeChild(t);
        }
      }
    }, true);
    document.addEventListener('load', function (e) { var t = e.target; if (!t || !t.tagName || t.tagName !== 'IMG' || t.dataset.fh) return; if (t.naturalWidth === 0 && String(t.getAttribute('src') || '').indexOf('data:') !== 0) { t.dataset.fh = '1'; t.src = EXC_PLACEHOLDER; if (t && t.classList) t.classList.add('media-fail'); t.style.objectFit = 'contain'; t.style.display = 'block'; t.style.opacity = '1'; } }, true);
    document.querySelectorAll('img').forEach(function (im) { if (im.complete && im.naturalWidth === 0 && im.getAttribute('src') && im.getAttribute('src').indexOf('data:') !== 0) { im.dataset.fh = '1'; im.src = EXC_PLACEHOLDER; if (im && im.classList) im.classList.add('media-fail'); im.style.objectFit = 'contain'; im.style.display = 'block'; } });

    // ---------- DOM ----------
    var loginView = document.getElementById('loginView');
    var mainView  = document.getElementById('mainView');
    var loginUser = document.getElementById('loginUser');
    var loginPass = document.getElementById('loginPass');
    var loginBtn  = document.getElementById('loginBtn');
    var logoutBtn = document.getElementById('logoutBtn');

    // 资源编辑弹窗
    var editMask = document.getElementById('editMask');
    var editTitle = document.getElementById('editTitle');
    var fTitle = document.getElementById('fTitle');
    var fCid   = document.getElementById('fCid');
    var fDesc  = document.getElementById('fDesc');
    var fDetail = document.getElementById('fDetail');
    var fImg   = document.getElementById('fImg');
    var fContactUrl = document.getElementById('fContactUrl');
    var fPrice = document.getElementById('fPrice');
    var fSort  = document.getElementById('fSort');
    var fOnline = document.getElementById('fOnline');
    var saveProductBtn = document.getElementById('saveProductBtn');
    var editCancel = document.getElementById('editCancel');
    var addVariantBtn = document.getElementById('addVariantBtn');
    var variantListEl = document.getElementById('variantList');

    // 分类编辑弹窗
    var catMask = document.getElementById('catMask');
    var catModalTitle = document.getElementById('catModalTitle');
    var catName = document.getElementById('catName');
    var catSort = document.getElementById('catSort');
    var catParentWrap = document.getElementById('catParentWrap');
    var catHidden = document.getElementById('catHidden');
    var catOk = document.getElementById('catOk');
    var catCancel = document.getElementById('catCancel');    var catDraftPending = false, catDraftFor = null;
    // ===== 关键按钮事件委托兜底：确保「新增分类 / 设置客服」任何情况下都能打开对应弹窗 =====
    function openContactSetting() {
      // 首开修复（与公告弹窗同模式）：先立即打开弹窗；settings 已加载过则同步填值，
      // 未加载过（登录后没进过"平台设置"就首次点开）则后台拉取 admin/settings 回填——
      // 原先取值的 setContactUrl 只有切到设置页才会被 loadSettings 填充，导致首次进弹窗没链接
      try { if (!contactDraftPending && window.__plSet) document.getElementById('contactUrlInput').value = document.getElementById('setContactUrl').value || ''; } catch (e) {}
      try { contactDraftPending = false; } catch (e) {}
      try { document.getElementById('contactMask').classList.add('open'); } catch (e) {}
     if (!window.__plSet) {
        api('admin/settings').then(function (res) {
          try {
            if (res && res.ok && document.getElementById('contactMask').classList.contains('open') && !contactDraftPending) {
              var v = (res.settings || {}).contact_url || '';
              document.getElementById('contactUrlInput').value = v;
              document.getElementById('setContactUrl').value = v;
            }
          } catch (e) {}
        }).catch(function () {});
      }
    }
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('#openContactBtn, #addCatBtn, #addAnnBtn') : null;
      if (!btn) return;
      if (btn.id === 'openContactBtn') { try { if (!document.getElementById('contactMask').classList.contains('open')) openContactSetting(); } catch (e) { try { document.getElementById('contactMask').classList.add('open'); } catch (e2) {} } }
      else if (btn.id === 'addCatBtn') { try { if (!document.getElementById('catMask').classList.contains('open')) openCatEdit(null); } catch (e) { try { document.getElementById('catMask').classList.add('open'); } catch (e2) {} } }
      else if (btn.id === 'addAnnBtn') { try { addNewAnnouncement(); } catch (e) {} }
    });

    // 通用输入弹窗
    var inputMask = document.getElementById('inputMask');
    var inputTitle = document.getElementById('inputTitle');
    var inputTip = document.getElementById('inputTip');
    var inputValue = document.getElementById('inputValue');
    var inputOk = document.getElementById('inputOk');
    var inputCancel = document.getElementById('inputCancel');
    var inputCallback = null;

    function showInput(title, tip, placeholder, callback, defaultValue, uploadKind) {
      inputTitle.textContent = title || '请输入';
      inputTip.innerHTML = tip || '';
      inputValue.placeholder = placeholder || '请输入…';
      inputValue.value = defaultValue || '';
      inputCallback = callback;
      // R36：媒体插入统一弹窗——uploadKind('image'/'video') 时显示输入框右侧的本地上传按钮，
      // 网络地址与本地上传共用这一个输入框；弹窗关闭后按钮随 CSS 隐藏（#inputMask:not(.open)）
      if (uploadKind) {
        inputRow.classList.add('has-upload');
        inputUploadBtn.textContent = uploadKind === 'video' ? '上传本地视频' : '上传本地图片';
        inputUploadBtn.dataset.kind = uploadKind;
      } else {
        inputRow.classList.remove('has-upload');
      }
      inputMask.classList.add('open');
      setTimeout(function () { inputValue.focus(); }, 100);
    }

    // R36：本地上传按钮——选文件 → 上传 → 链接填进输入框 → 自动确定插入
    inputUploadBtn.addEventListener('click', function () {
      var kind = inputUploadBtn.dataset.kind;
      var inp = document.createElement('input');
      inp.type = 'file';
      if (kind === 'video') inp.accept = 'video/mp4,video/webm,video/quicktime';
      else inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        var done = function (url, note) {
          inputValue.value = url;
          if (note) toast(note, 'info');
          inputOk.click(); // 上传完成自动确定（等于手填链接后点确定）
        };
        if (kind === 'video') uploadVideoToBucket(f, done);
        else uploadToBucket(f, done);
      });
      inp.click();
    });

    inputOk.addEventListener('click', function () {
      var val = inputValue.value;
      inputMask.classList.remove('open');
      if (inputCallback) { var cb = inputCallback; inputCallback = null; cb(val); }
    });
    inputCancel.addEventListener('click', function () {
      inputMask.classList.remove('open');
      inputCallback = null;
    });
    inputMask.addEventListener('click', function (e) {
      if (e.target === this) { this.classList.remove('open'); inputCallback = null; } // R217：恢复点外关闭（R215 误删）
    });
    inputValue.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') inputOk.click();
    });

    // 类型编辑弹窗
    var variantMask = document.getElementById('variantMask');
    var variantModalTitle = document.getElementById('variantModalTitle');
    var vName = document.getElementById('vName');
    var vTitle = document.getElementById('vTitle'); // R148：类型标题（前台类型信息栏第一行，空=回退名称）
    var vDesc = document.getElementById('vDesc');
    var vHidden = document.getElementById('vHidden');
    // 类型图片/视频已并入“类型描述”编辑器，不再单独设字段
    var vContactUrl = document.getElementById('vContactUrl');
    var vPrice = document.getElementById('vPrice');
    var vSort = document.getElementById('vSort');
    var variantOk = document.getElementById('variantOk');
    var variantCancel = document.getElementById('variantCancel');

    // 改密码弹窗
    var TOKEN_KEY = 'wnzyq_token';
    // 占位图统一使用 EXC_PLACEHOLDER（见上方定义），IMG_PLACEHOLDER 保留兼容旧引用
    var IMG_PLACEHOLDER = EXC_PLACEHOLDER; // 兼容旧引用，统一感叹号占位
    var state = {
      categories: [],
      products: [],
      editingId: null,
      editingProduct: null,
      variants: [],          // 当前编辑资源的类型列表
      editingVariantId: null,
      catEditingId: null,
      statsDays: 1,          // R33：统计默认选 1 天档（用户要求）；最大可查30天
      catExpanded: {}, prodSelected: {}, catSelected: {},       // 分类展开/收起状态 + 资源/分类勾选（切换标签后保留）
    };

    // ---------- toast 轻提示 ----------
    /* R231（用户 09-21 23:38）条11：跟资源页同款队列——抽公共到 ui-common.js window.uiToast
       （排队逐条展示，每条 2s + 0.3s 淡出），观感 .ui-toast 公共类带下落入场；
       原「新顶掉旧」单条模式废弃。error 红，success/info 走默认蓝 */
    function toast(msg, type) { window.uiToast(msg, type); }

    // ---------- 通用确认弹窗 ----------
    var confirmCallback = null;
    var confirmCancelCallback = null;
    function showConfirm(title, msg, callback, cancelCallback) {
      document.getElementById('confirmTitle').textContent = title || '确认操作';
      document.getElementById('confirmMsg').textContent = msg || '';
      confirmCallback = callback;
      confirmCancelCallback = cancelCallback || null;
      document.getElementById('confirmMask').classList.add('open');
    }
    document.getElementById('confirmOk').addEventListener('click', function () {
      // 修复：原先在确认按钮点下、接口还没调用时就提示"操作成功"——删除等操作失败时会误报成功。
      // 现在只关闭确认框并执行回调，成功/失败提示由各操作自己的接口结果给出。
      document.getElementById('confirmMask').classList.remove('open');
      if (confirmCallback) { var cb = confirmCallback; confirmCallback = null; confirmCancelCallback = null; cb(); }
    });
    document.getElementById('confirmCancel').addEventListener('click', function () {
      document.getElementById('confirmMask').classList.remove('open');
      if (confirmCancelCallback) { var cb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; cb(); }
      else { confirmCallback = null; confirmCancelCallback = null; }
    });
    document.getElementById('confirmMask').addEventListener('click', function (e) {
      if (e.target === this) { // R217：恢复点外关闭（R215 误删）——点外=取消，与取消键同口径
        this.classList.remove('open');
        if (confirmCancelCallback) { var cb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; cb(); }
        else { confirmCallback = null; confirmCancelCallback = null; }
      }
    });

    // 滚动锁已取消（用户要求恢复自由滚动）：不再锁定页面滚动，弹窗/编辑器放大时页面仍可自由滚动
    (function () { window.__syncBodyLock = function () {}; window.__syncBodyLock(); })();
    (function () {
  function _r(){ document.querySelectorAll('.rte-editor.rte-large').forEach(function(e){ e.classList.remove('rte-large'); e.style.top=''; e.style.height=''; }); document.querySelectorAll('.rte-toolbar-large').forEach(function(e){ e.classList.remove('rte-toolbar-large'); }); document.querySelectorAll('.rte-zoom-on').forEach(function(e){ e.classList.remove('rte-zoom-on'); e.innerHTML=RTE_SVG_MAX; }); if(window.__rteRO&&window.__rteRO.disconnect){ try{ window.__rteRO.disconnect(); }catch(e){} } } // R231 条9：emoji→SVG
  window.__resetRteAll=_r;
  // R144（用户 23:52）：放大态重置只挂在"编辑器宿主弹窗"关闭时——原实现对任意弹窗打开都重置，
  // 导致放大态下点插入图片/视频（inputMask 打开）编辑器就自动缩小；inputMask 层级本就高于放大态
  // （ui-common.css #inputMask z-index 6002 > rte-large 6000），插入操作全程保持放大
  ['editMask','variantMask','annMask'].forEach(function(id){
    var m = document.getElementById(id); if (!m) return;
    new MutationObserver(function(){ if (!m.classList.contains('open')) _r(); }).observe(m, { attributes: true, attributeFilter: ['class'] });
  });
})();
    // 弹窗右上角×按钮统一关闭（事件委托）
    document.addEventListener('click', function (e) {
      var closeBtn = e.target.closest('.modal-close-x, .modal-close[data-close]');
      if (closeBtn && closeBtn.dataset.close) {
        var mask = document.getElementById(closeBtn.dataset.close);
        if (closeBtn.dataset.close === 'editMask') { try { clearDraft(); } catch (e) {} } // ×=取消：丢弃草稿
        if (closeBtn.dataset.close === 'catMask') { catDraftPending = false; catDraftFor = null; } // ×=取消：丢弃分类草稿
        if (closeBtn.dataset.close === 'variantMask') { variantDraftPending = false; variantDraftFor = null; } // ×=取消：丢弃类型草稿
        if (closeBtn.dataset.close === 'annMask') { try { window.__annDiscard(); } catch (e) {} } // ×=取消：R145 全量恢复（数据+编辑器+频率+列表），见 annDiscard
        if (closeBtn.dataset.close === 'contactMask') { contactDraftPending = false; var _cu=document.getElementById('contactUrlInput'); if(_cu)_cu.value=''; } // ×=取消：清空输入
        if (closeBtn.dataset.close === 'pwdMask') { var _o=document.getElementById('oldPwd'),_n=document.getElementById('newPwd'),_c=document.getElementById('confirmPwd'); if(_o)_o.value=''; if(_n)_n.value=''; if(_c)_c.value=''; } // ×=取消：清空密码框
        if (mask) {
          mask.classList.remove('open');
          // R111：输入弹窗×=丢弃——清输入+清回调
          if (closeBtn.dataset.close === 'inputMask') { inputCallback = null; try { var _iv = document.getElementById('inputValue'); if (_iv) _iv.value = ''; } catch (e) {} }
          // R111：确认弹窗×=取消语义——执行取消回调（与点外/Esc 同口径）
          if (closeBtn.dataset.close === 'confirmMask') { if (confirmCancelCallback) { var _ccb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; _ccb(); } else { confirmCallback = null; confirmCancelCallback = null; } }
        }
      }
    });

    // ---------- 通用请求（自动带 token，401 自动跳登录） ----------
    // 滚动锁已取消（用户要求恢复自由滚动）：即使 ui-common.js 未加载，也不再拦截 touchmove/wheel
    if (!window.lockBodyScroll) {
      window.lockBodyScroll = function () {};
      window.syncBodyLock = function () {};
    }
    function api(path, opts) {
      opts = opts || {};
      opts.headers = opts.headers || {};
      opts.headers['Content-Type'] = 'application/json';
      var token = localStorage.getItem(TOKEN_KEY);
      if (token) opts.headers['Authorization'] = 'Bearer ' + token;
      // 修复：移除调试 console.log——原先会把每个接口的响应内容（含统计、公告等业务数据）
      // 打进任何访客的浏览器控制台，既是信息泄露也是性能噪音
      return fetch('/api/' + path, opts).then(function (r) {
        return r.json().then(function (d) {
          d._status = r.status;
          if (r.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            if (mainView.style.display !== 'none') {
              toast('登录已过期，请重新登录', 'error');
              setTimeout(function () { location.reload(); }, 1200);
            }
          }
          return d;
        }).catch(function () {
          return { ok: false, msg: '服务器错误(' + r.status + ')', _status: r.status };
        });
      }).catch(function () {
        return { ok: false, msg: '无法连接后端（请确认已部署到 Cloudflare）' };
      });
    }

    // 清除资源和分类的 API 缓存（管理员修改后调用，不阻塞主流程）
    function clearCache() {
      api('admin/clear-cache', { method: 'POST' }).catch(function () {});
    }

    // ---------- R221：复制即换码 ----------
    // 点复制 → 当前码记一条 issued（60 天兑换窗口起算）→ 立即出新码刷新面板
    // vObj：类型对象（含 id / resourceCode / issues）；redraw：发码完成后的重绘回调（失败也调，用于恢复码键文本）
    function __issueCode(vObj, redraw) {
      if (!vObj || !vObj.id) { toast('参数错误：缺少资源类型', 'error'); if (redraw) { try { redraw(); } catch (e) {} } return; }
      if (window.__issueInFlight) return; /* R231 条26：同一时刻只允许一个发码请求在途（含编辑弹窗等全部调用点） */
      window.__issueInFlight = true;
      api('admin/issue-code', { method: 'POST', body: JSON.stringify({ variantId: vObj.id }) }).then(function (res) {
        window.__issueInFlight = false;
        if (res && res.ok) {
          var ok = window.__shareCopyText ? window.__shareCopyText(res.issuedCode) : false;
          vObj.resourceCode = res.code;
          vObj.issues = res.issues || [];
          // 同步缓存里的同 id 类型（资源列表 / 编辑弹窗共用一份数据）
          (state.products || []).forEach(function (p) {
            (p.variants || []).forEach(function (vv) { if (vv && vv.id === vObj.id) { vv.resourceCode = res.code; vv.issues = res.issues || []; } });
          });
          (state.variants || []).forEach(function (vv) { if (vv && vv.id === vObj.id) { vv.resourceCode = res.code; vv.issues = res.issues || []; } });
          // R227：资源管理页各产品行的码面板当场重绘（含已展开的）——发新码后页面上码的显示立即变新码，不用重新点开
          try {
            var _cps = document.querySelectorAll('.code-picker');
            for (var _i = 0; _i < _cps.length; _i++) {
              var _cp = _cps[_i];
              if (_cp.__renderCodePanel && _cp.__product && _cp.__product.variants) {
                try { _cp.__renderCodePanel(_cp.__product.variants); } catch (e0) {}
              }
            }
          } catch (e1) { }
          if (redraw) { try { redraw(); } catch (e) {} }
          toast(ok ? '新码已生成；旧码已复制，60 天内兑换有效（绑定后设备永久可用）'
                   : '新码已生成（复制旧码失败，请手动复制：' + res.issuedCode + '）', 'success');
        } else {
          if (redraw) { try { redraw(); } catch (e) {} }
          toast((res && res.msg) || '发码失败', 'error');
        }
      }).catch(function () {
        window.__issueInFlight = false;
        if (redraw) { try { redraw(); } catch (e) {} }
        toast('发码失败：网络错误', 'error');
      });
    }
    // 统计页筛选栏重排（独立函数，初始化时执行一次，不依赖 clearCache 调用时机）
    function initStatsFilterBar() { var _g = document.querySelector('#panel-stats .time-filter'); var _wrap = _g && _g.parentNode; var _card = document.getElementById('statCards'); if (_wrap && _card && _wrap.parentNode) { var _bar = document.createElement('div'); _bar.id = 'statsFilterBar'; _bar.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 14px;background:var(--card-bg,#fff);border-radius:12px;padding:12px 16px;box-shadow:var(--shadow-card);'; while (_wrap.firstChild) _bar.appendChild(_wrap.firstChild); _wrap.parentNode.removeChild(_wrap); _card.parentNode.insertBefore(_bar, _card.nextSibling); }
    }

    // ---------- 统一时间选择弹窗（点击输入框弹出；今天/此刻 + 清除 + 确定） ----------
    var dtTarget = null;
    (function initDateTimePicker() {
      var pop = document.createElement('div');
      pop.className = 'dt-pop';
      pop.id = 'dtPop';
      pop.innerHTML =
        '<div class="dt-row">' +
          '<input type="date" id="dtDate" />' +
          '<input type="time" id="dtTime" value="00:00" />' +
        '</div>' +
        '<div class="dt-btns">' +
          '<button type="button" class="dt-now" id="dtNow">当前</button>' +
          '<button type="button" class="dt-ok" id="dtOk">确定</button>' +
          '<button type="button" id="dtClear">清除</button>' +
        '</div>';
      document.body.appendChild(pop);
      var dInput = pop.querySelector('#dtDate');
      var tInput = pop.querySelector('#dtTime');
      function pad(n) { return String(n).padStart(2, '0'); }
      function nowParts() {
        var d = new Date();
        return { date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), time: pad(d.getHours()) + ':' + pad(d.getMinutes()) };
      }
      function openPicker(field) {
        dtTarget = field;
        var isDateOnly = field.getAttribute('data-dt') === 'date';
        tInput.style.display = isDateOnly ? 'none' : '';
        var cur = field.value || '';
        if (cur) {
          dInput.value = cur.slice(0, 10);
          if (!isDateOnly) tInput.value = (cur.slice(11, 16) || '00:00');
        } else {
          var n = nowParts(); dInput.value = n.date; tInput.value = isDateOnly ? '00:00' : n.time;
        }
        var r = field.getBoundingClientRect();
        pop.classList.add('open');
        var pw = 268, ph = pop.offsetHeight || 130;
        var left = Math.min(r.left, window.innerWidth - pw - 8);
        var top = r.bottom + 6;
        if (top + ph > window.innerHeight) top = r.top - ph - 6; // 下方放不下则翻到上方
        pop.style.left = Math.max(8, left) + 'px';
        pop.style.top = Math.max(8, top) + 'px';
      }
      function closePicker() { pop.classList.remove('open'); dtTarget = null; }
      function commit() {
        if (!dtTarget) return;
        var isDateOnly = dtTarget.getAttribute('data-dt') === 'date';
        var val = dInput.value || '';
        if (val && !isDateOnly) val += ' ' + (tInput.value || '00:00'); // 用空格与 SQLite datetime('now') 格式一致，保证定时比较正确
        dtTarget.value = val;
        dtTarget.dispatchEvent(new Event('input', { bubbles: true }));
        dtTarget.dispatchEvent(new Event('change', { bubbles: true }));
        closePicker();
      }
      // 点击输入框打开（事件委托，动态生成也生效）
      document.addEventListener('click', function (e) {
        var field = e.target.closest ? e.target.closest('.dt-field') : null;
        if (field) { e.preventDefault(); openPicker(field); return; }
        if (!e.target.closest('#dtPop')) closePicker();
      });
      pop.querySelector('#dtNow').addEventListener('click', function () {
        var n = nowParts(); dInput.value = n.date;
        if (dtTarget && dtTarget.getAttribute('data-dt') !== 'date') tInput.value = n.time;
      });
      pop.querySelector('#dtClear').addEventListener('click', function () {
        if (dtTarget) { dtTarget.value = ''; dtTarget.dispatchEvent(new Event('change', { bubbles: true })); }
        closePicker();
      });
      pop.querySelector('#dtOk').addEventListener('click', commit);
      window.addEventListener('resize', closePicker);
      document.addEventListener('focusin', function (e) { var f = e.target && e.target.closest ? e.target.closest('.dt-field') : null; if (f) openPicker(f); });
    })();

    // ---------- 顶栏滚动显隐 + 回到顶部（与资源页统一，rAF 节流，零卡顿） ----------
    (function () {
      var nav = document.querySelector('#mainView .topbar');
      var lastY = window.scrollY || 0, ticking = false;
      function onScroll() {
        var y = window.scrollY || 0;
          if (nav) nav.classList.remove('nav-hidden'); // 顶栏常驻：取消下滑隐藏
        if (backBtn) backBtn.classList.toggle('show', y > 320);
        lastY = y; ticking = false;
      }
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
      }, { passive: true });
      // 回到顶部按钮（统一风格，半透明、箭头居中）
      var backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'back-top';
      backBtn.setAttribute('aria-label', '回到顶部');
      backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg>';
      backBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
      document.body.appendChild(backBtn);
    })();

    // ---------- 全页面下拉刷新（与资源页统一，仅手机触摸，顶部下拉，无蓝块） ----------
    (function () {
      var tip = document.createElement('div');
      tip.className = 'pull-refresh';
      tip.innerHTML = '<span class="pull-refresh-text"><span class="pull-refresh-icon"></span><span class="prt">下拉刷新</span></span>';
      document.body.appendChild(tip);
      var sy = 0, sx = 0, pulling = false, dist = 0, TH = 60;
      function activeTab() { var t = document.querySelector('.tab.active'); return t ? t.dataset.tab : 'products'; }
      document.addEventListener('touchstart', function (e) {
        // R20：登录页也允许下拉刷新（原来只在 mainView 可见时启用，登录页拉不动）；未登录时刷新动作走整页 reload
        if ((window.scrollY || 0) <= 0) {
          sy = e.touches[0].clientY; sx = e.touches[0].clientX; pulling = true; dist = 0;
        }
      }, { passive: true });
      document.addEventListener('touchmove', function (e) {
        if (!pulling) return;
        var dy = e.touches[0].clientY - sy, dx = e.touches[0].clientX - sx;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
          // R170（用户 22:52）：胶囊完整平移跟手（关 transition 防滞后），从 -48px 随手指滑到 0px（=top:80px 位），
          // 替代原"容器高度裁切展开"——划回时胶囊会从下往上被裁掉（残缺消失），平移永不残缺
          dist = Math.min(dy * 0.5, 80);
          var pill = tip.firstElementChild;
          pill.style.transition = 'none';
          pill.style.transform = 'translateY(' + (-48 + dist * 0.6) + 'px)';
          pill.style.opacity = dist > 0 ? String(Math.min(1, dist / 20)) : '0';
          tip.querySelector('.prt').textContent = dist > TH ? '释放立即刷新' : '下拉刷新';
        }
      }, { passive: true });
      document.addEventListener('touchend', function () {
        if (!pulling) return; pulling = false;
        var pill = tip.firstElementChild;
        pill.style.transition = ''; // R170：恢复 CSS 回弹动画
        if (dist > TH) {
          pill.style.transform = 'translateY(0px)'; // R170：停在 80px 位显示「正在刷新…」
          tip.querySelector('.prt').textContent = '正在刷新…';
          var loginVisible = document.getElementById('loginView') && document.getElementById('loginView').style.display !== 'none';
          if (loginVisible) { /* R20：登录页下拉刷新=整页重载（未登录无数据面板可刷新） */
            setTimeout(function () { location.reload(); }, 400);
            return;
          }
          try { if (typeof clearCache === 'function') clearCache(); } catch (e) {}
          var t = activeTab();
          if (t === 'products' && typeof loadProducts === 'function') loadProducts();
          else if (t === 'stats' && typeof loadStats === 'function') loadStats(undefined, undefined, 1);
          else if (t === 'categories' && typeof loadCategories === 'function') loadCategories();
          else if (t === 'settings' && typeof loadSettings === 'function') loadSettings();
          setTimeout(function () { pill.style.transform = 'translateY(-48px)'; pill.style.opacity = '0'; tip.querySelector('.prt').textContent = '下拉刷新'; }, 400); // R170：完整滑回上方淡出 + 文案复位（避免下次下拉闪现「正在刷新…」）
        } else {
          // 未达阈值：整体滑回上方淡出——R170：完整收回，不再裁切残缺
          pill.style.transform = 'translateY(-48px)';
          pill.style.opacity = '0';
        }
        dist = 0;
      }, { passive: true });
    })();

    // ---------- 启动 ----------
    function boot() {
      // 本地环境（file:// 或 localhost）不发起 API 请求，避免 404 报错
      var isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocal) {
        // 静默检测并自动初始化，失败不显示错误（避免500报错影响用户体验）
        api('health').then(function (h) {
          if (h && h.ok && !h.ready) {
            api('install', { method: 'POST' }).catch(function () {});
          }
        }).catch(function () {});
      }
      // R30-#4：登录态改由 HttpOnly Cookie 携带（无 token 也要查会话）；旧 localStorage token 仅作 24h 过渡兼容
      var token = localStorage.getItem(TOKEN_KEY);
      if (!isLocal) {
        api('admin/session').then(function (s) {
          if (s.ok) showMain(s.username);
          else { localStorage.removeItem(TOKEN_KEY); showLogin(); }
        });
      } else {
        showLogin();
      }
    }

    function showLogin() { loginView.style.display = 'flex'; mainView.style.display = 'none'; }

    function showMain(username) {
      loginView.style.display = 'none';
      mainView.style.display = 'block';
      function _safe(fn) { try { fn(); } catch (e) { /* R213 P2⑤：调试日志已删（隔离逻辑保留） */ } }
      window.__plS = 1; window.__plC = 1; window.__plP = 1;
      // 修复：移除重复的 loadCategories 调用（原先同一接口被请求两次，浪费请求且可能返回不一致）
      _safe(loadStats);
      _safe(loadSettings);
      _safe(loadProducts);
      _safe(loadCategories);
      try { switchTab('products'); } catch (e) { /* R213 P2⑤：调试日志已删 */ }
    }

    // ---------- Tab 切换 ----------
    document.querySelectorAll('.tab').forEach(function (tab) {
      // R36：跳过没绑 data-tab 的按钮（防止误挂 .tab 类的按钮把 switchTab(undefined) 打成全空内容）
      if (!tab.dataset || !tab.dataset.tab) return;
      tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
    });

    function switchTab(name) {
      document.querySelectorAll('.tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.tab === name);
      });
      document.getElementById('panel-products').style.display = name === 'products' ? '' : 'none';
      document.getElementById('panel-stats').style.display = name === 'stats' ? '' : 'none';
      document.getElementById('panel-categories').style.display = name === 'categories' ? '' : 'none';
      document.getElementById('panel-settings').style.display = name === 'settings' ? '' : 'none';
      /* R231 条21（用户 09-21 23:38）：切 tab 面板 0.18s 淡入上移——纯视觉层，
         R173 口径不变：只认 __plS 等单条件、不重新拉数据 */
      var __pv = document.getElementById('panel-' + name);
      if (__pv) { __pv.classList.remove('panel-in'); void __pv.offsetWidth; __pv.classList.add('panel-in'); }
      if (name === 'products' && !window.__plP) { window.__plP = 1; loadProducts(); }
      // R173（用户 00:28）：回退 R171 的门控放宽——切 tab 只认 __plS 单条件（R170 口径）；
      // 放宽后每次切 tab 都重新拉数据+全页淡入，用户实测"更难看"
      if (name === 'stats' && !window.__plS) { window.__plS = 1; loadStats(); }
      if (name === 'stats') { try { if (window.__rerenderLine) window.__rerenderLine(); } catch (e) {} } // R145：面板可见后重画，轴字号按真实宽度补偿
      if (name === 'categories' && !window.__plC) { window.__plC = 1; loadCategories(); }
      if (name === 'settings') { if (!window.__plSet) loadSettings(); }
    }

    // ---------- 平台设置 ----------
    function loadSettings() {
      api('admin/settings').then(function (res) {
        if (!res.ok) { toast(res.msg || '加载失败', 'error'); return; }
        var s = res.settings || {};
        window.__plSet = 1; document.getElementById('setContactUrl').value = s.contact_url || ''; if (document.getElementById('contactMask').classList.contains('open')) document.getElementById('contactUrlInput').value = s.contact_url || '';
        // 客服状态文字已按需求移除
        document.getElementById('setAnnouncement').innerHTML = s.announcement || '';
        if (typeof stateAnn !== 'undefined' && stateAnn) { stateAnn.list = parseAnnouncements(s); stateAnn.loaded = true; if (document.getElementById('annMask').classList.contains('open')) { try { if (typeof renderAnnList === 'function') renderAnnList(); var _dlx = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; if (_dlx && typeof selectAnnItem === 'function') selectAnnItem(_dlx.id); else if (typeof clearAnnEdit === 'function') clearAnnEdit(); } catch (e) {} } }
        
        document.getElementById('annMode').value = s.announcement_mode || 'always';
        syncSelectDisplay(document.getElementById('annMode')); // R166：同步自制下拉显示框
        // R135：记录已保存的显示频率——取消/×/关闭（丢弃）时据此恢复，不再保留未保存的选中值
        if (typeof stateAnn !== 'undefined' && stateAnn) stateAnn._modeSaved = s.announcement_mode || 'always';
        // R106：资源码绑定设备上限已挪到类型编辑表单（类型级），设置面板不再回填/保存该值
      });
    }

    // R231 条26：设置面板全局保存按钮已随 R106 移除——真实保存键为公告弹窗 saveAnnBtn /
    // 客服弹窗 saveContactBtn，防连点 + 绿✓三段式在这两处实现（原 saveSettingsBtn 挂载为无目标死代码，本批删除）

    // R106：绑定设备上限已挪到类型编辑表单（原全局保存按钮已随 admin.html 一并移除）


    // ---------- 批量操作 / 全选 ----------
    document.getElementById('selectAll').addEventListener('change', function () {
      var checked = this.checked;
      document.querySelectorAll('.row-check').forEach(function (cb) { cb.checked = checked; state.prodSelected[Number(cb.dataset.id)] = checked; });
      updateBatchBar();
    });
    document.querySelectorAll('.batch-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { batchAction(this.dataset.action); });
    });

    // ---------- 视图切换（列表/卡片） ----------
    var currentView = localStorage.getItem('admin_product_view') || 'list';

    function setView(view) {
      currentView = view;
      localStorage.setItem('admin_product_view', view);
      var listBtn = document.getElementById('viewListBtn');
      var cardBtn = document.getElementById('viewCardBtn');
      var productList = document.getElementById('productList');
      if (view === 'card') {
        listBtn.classList.remove('active');
        cardBtn.classList.add('active');
        productList.classList.add('card-view');
        triggerViewAnim(productList);
      } else {
        listBtn.classList.add('active');
        cardBtn.classList.remove('active');
        productList.classList.remove('card-view');
        triggerViewAnim(productList);
      }
    }
    /* R215 条8（老板 09-21）：管理页视图切换接入共用 FlipAnimator（ui-common.js，与资源页同款飞位）；
       FLIP 不可用/系统减少动效时降级回旧容器切换动画 */
    var __adminFlipper = null;
    function flipSetAdminView(view) {
      var productList = document.getElementById('productList');
      var listBtn = document.getElementById('viewListBtn');
      var cardBtn = document.getElementById('viewCardBtn');
      if (!window.FlipAnimator || !productList) { setView(view); return; }
      if (!__adminFlipper || __adminFlipper.container !== productList) __adminFlipper = new window.FlipAnimator(productList);
      var animated = __adminFlipper.flip(function () {
        currentView = view;
        localStorage.setItem('admin_product_view', view);
        if (view === 'card') { productList.classList.add('card-view'); listBtn.classList.remove('active'); cardBtn.classList.add('active'); }
        else { productList.classList.remove('card-view'); listBtn.classList.add('active'); cardBtn.classList.remove('active'); }
      }, { duration: 300, stagger: 20, maxStagger: 180 });
      if (!animated) setView(view); // 降级：FLIP 未接管时走旧容器切换动画
    }
    document.getElementById('viewListBtn').addEventListener('click', function () { flipSetAdminView('list'); });
    document.getElementById('viewCardBtn').addEventListener('click', function () { flipSetAdminView('card'); });
    // 初始化视图
    setView(currentView);
    try { initStatsFilterBar(); } catch (e) {}
    // 调整统计表格顺序：资源明细 → 分类统计 → 浏览记录
    (function () {
      var cRows = document.getElementById('statCatRows');
      var dRows = document.getElementById('statRows');
      if (cRows && dRows) {
        var cw = cRows.closest('.stat-table-wrap');
        var dw = dRows.closest('.stat-table-wrap');
        if (cw && dw && cw.parentNode && dw.parentNode === cw.parentNode && dw.nextElementSibling === cw) {
          cw.parentNode.insertBefore(dw, cw);
        }
      }
    })();

    // ---------- 登录 ----------
    window.__loginDirect = true; window.doLogin = doLogin;
    loginPass.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

    function doLogin() {
      if (loginBtn.disabled) return; // 防重复提交：onclick+addEventListener 双绑只执行一次
      var u = loginUser.value.trim();
      var p = loginPass.value;
      if (!u || !p) { toast('请输入账号和密码', 'error'); return; } /* R118：登录提示统一 toast 胶囊（top:80/32px） */
      loginBtn.disabled = true;
      if (window.__btnBusy) window.__btnBusy(loginBtn, '登录中…'); /* R183 条4：忙碌转圈 */
      api('admin/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })
        .then(function (res) {
          if (res && res.ok) {
            // R30-#4：令牌改由后端写入 HttpOnly Cookie（脚本读不到），前端不再保存 token
            // 修复：showMain 内部已统一调用 loadSettings（连同 stats/products/categories），
            // 这里不再单独调一次，避免同一接口登录后被请求两次
            if (window.__haptic) window.__haptic(); /* R183 条12：登录成功 */
            try { showMain(res.username); }
            catch (e) { setTimeout(function () { location.reload(); }, 300); }
          } else {
            // 失败路径只弹一个弹窗（此前 toast+showAlert+分支内 showAlert 会叠出两个弹窗，已修复去重）
            var _local = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (_local) { toast('本地预览模式：无后端接口，请部署线上或运行 wrangler dev', 'error'); }
            else if (res._status === 429) { toast(res.msg || '尝试次数过多，请稍后再试', 'error'); }
            else { toast('登录失败：' + (res.msg || ('HTTP ' + (res._status || '网络错误'))), 'error'); }
          }
        })
        .finally(function () {
          loginBtn.disabled = false;
          loginBtn.textContent = '登 录';
        });
    }

    // ---------- 资源管理 ----------
    function loadProducts() {
      /* R230：首次加载（列表空且无数据）先铺骨架——数量=一页 20 条、槽位尺寸与真行一致；
         CRUD 后的刷新已有数据在先，不铺（与资源页「骨架只铺数据在路上」同口径） */
      if (!state.products.length && !document.getElementById('productList').children.length) {
        window.__adminSkelP = true; renderProductSkeleton();
      }
      var ensureCat = state.categories.length
        ? Promise.resolve()
        : (window.__catLoading || loadCategories()).then(function (res) {
            if (res && res.ok) {
              state.categories = (res.list || []).map(function (c) { return { id: c.id, name: c.name, parent_id: c.parent_id || 0, sort: c.sort || 0, is_hidden: c.is_hidden || 0, cnt: c.cnt || 0 }; });
            }
          });
      ensureCat.then(function () {
        // 分类筛选已改为级联选择器（与新增/编辑资源一致）
        initFilterCatPicker();
        return api('admin/products');
      }).then(function (res) {
        if (!res.ok) { /* R230：接口异常收骨架走空态，不卡灰（对齐资源页 fetchRemote 兜底） */
          window.__adminSkelP = false; __clearAdminSkel(document.getElementById('productList'));
          var _em = document.getElementById('productEmpty');
          if (_em) { _em.classList.add('show'); document.getElementById('productEmptyTitle').textContent = '暂无资源'; }
          toast(res.msg || '加载失败', 'error'); return; }
        window.__adminSkelP = false;
        state.products = res.list || [];
        renderProducts();
        prefetchBindings(); // R114：随产品列表一起静默预载全部类型绑定数据，点「绑定 N」即开即显
      });
    }

    // 筛选器事件
    document.addEventListener('change', function (e) {
      if (e.target.id === 'filterCat' || e.target.id === 'filterStatus') {
        adminPage = 1;
        /* R183 条21：筛选条件持久化（下次登录自动恢复） */
        try { localStorage.setItem('wnzyq_admin_filter', JSON.stringify({ c: document.getElementById('filterCat').value, s: document.getElementById('filterStatus').value })); } catch (e0) {}
        renderProducts();
      }
    });
    // R183 条13：后台搜索 300ms 防抖（与前台同步）；原先与下方直接监听双份渲染，一并收口成单一路由
    document.addEventListener('input', function (e) {
      if (e.target.id === 'adminSearch') {
        clearTimeout(window.__adminSearchTimer);
        window.__adminSearchTimer = setTimeout(function () { adminPage = 1; renderProducts(); var __sv = document.getElementById('adminSearch').value; if (__sv.trim()) window.pushSearchHist('adminSearchHist', __sv); }, 300); /* R186 建议1：搜索稳定 300ms 后记录 */
        var __ac = document.getElementById('adminSearchClear');
        if (__ac) __ac.classList.toggle('show', e.target.value.length > 0);
      }
    });

    var adminPage = 1;
    var __adminTurning = false; /* R231 条19：翻页淡出期间锁，防重复触发 */
    var ADMIN_PAGE_SIZE = 20; // 全系统统一：一页 20 条（与资源页/统计面板一致），配合翻页控件使用

    // R146（用户 00:34）：admin 端价格格式化（与前台 shop.js formatPrice 同口径）
    // 0/空返回 ''（免费不显示），整数 ¥99，小数 ¥99.00


    /* ---------- R230（老板 09-21 21:10 拍板）：管理页骨架屏——资源页 R193 骨架全特征复用 ----------
       特征逐条对齐：①数量=每页条数（资源/统计表一页 20 条，分类无分页按常显 8 行铺、真行不足收尾）
       ②骨架行复用真实行类名（.product-row/.cat-row 及子件类）——槽位/尺寸/间距与真行严格一致，
       card-view 网格与手机两行网格布局规则自动沿用；③数据到达同位置替换成真行（不先清后铺、
       无整屏闪白），复用 .stagger-in 错峰淡入（20ms/项 180ms 封顶）；④真实条数少于骨架数时
       收尾移除多余骨架；⑤空数据/接口异常收骨架走空态，骨架期空态不抢跑；⑥微光灰条样式在
       ui-common.css 全站一份（商城 .card-skeleton 同源）；⑦aria-hidden + pointer-events:none
       + 暗色/减少动效适配随公共样式。仅网络等待期铺（翻页/筛选是本地重渲染，走错峰淡入——
       与资源页翻页真实行为同口径） */
    function __clearAdminSkel(box) { if (!box) return; var _s = box.querySelectorAll('.admin-skel'); for (var i = 0; i < _s.length; i++) { if (_s[i].parentNode) _s[i].parentNode.removeChild(_s[i]); } }
    function renderProductSkeleton(n) {
      var box = document.getElementById('productList'); if (!box) return;
      var oldPager = document.getElementById('adminPager'); if (oldPager && oldPager.parentNode) oldPager.parentNode.removeChild(oldPager);
      var empty = document.getElementById('productEmpty'); if (empty) empty.classList.remove('show');
      box.style.minHeight = ''; box.innerHTML = '';
      var frag = document.createDocumentFragment();
      for (var i = 0; i < (n || ADMIN_PAGE_SIZE); i++) {
        var row = document.createElement('div');
        row.className = 'product-row skel admin-skel';
        row.setAttribute('aria-hidden', 'true');
        row.innerHTML = '<span class="drag-handle sk-piece"></span><span class="row-check sk-piece"></span><div class="thumb sk-piece"></div><div class="info"><div class="p-title sk-piece"></div><div class="p-sub sk-piece"></div></div><div class="p-ops"><span class="row-btn sk-piece sk-code"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span></div>';
        frag.appendChild(row);
      }
      box.appendChild(frag);
    }
    function renderCatSkeleton(n) {
      var box = document.getElementById('catList'); if (!box) return;
      box.style.minHeight = ''; box.innerHTML = '';
      var frag = document.createDocumentFragment();
      for (var i = 0; i < (n || 8); i++) {
        var row = document.createElement('div');
        row.className = 'cat-row skel admin-skel';
        row.setAttribute('aria-hidden', 'true');
        row.innerHTML = '<span class="drag-handle sk-piece"></span><span class="row-check sk-piece"></span><span class="c-name sk-piece"></span><div class="c-meta"><span class="c-sort sk-piece"></span><span class="c-count sk-piece"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span></div>';
        frag.appendChild(row);
      }
      box.appendChild(frag);
    }
    function renderStatSkeleton() {
      var defs = [['statRows', 6], ['statCatRows', 3], ['statRecentRows', 3]];
      defs.forEach(function (d) {
        var tb = document.getElementById(d[0]); if (!tb) return;
        tb.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = 0; i < STAT_PAGE_SIZE; i++) {
          var tr = document.createElement('tr');
          tr.className = 'skel admin-skel';
          tr.setAttribute('aria-hidden', 'true');
          var cells = '';
          for (var c = 0; c < d[1]; c++) cells += '<td><span class="sk-line' + (c === 0 ? ' w70' : ' w95') + '"></span></td>';
          tr.innerHTML = cells;
          frag.appendChild(tr);
        }
        tb.appendChild(frag);
      });
    }

    function renderProducts() {
      if (window.__skipRenderOnce) { window.__skipRenderOnce = false; return; }
      refreshCatCnts();
      var box = document.getElementById('productList'); var _minH = box.offsetHeight; if (_minH > 0) box.style.minHeight = _minH + 'px';
      var empty = document.getElementById('productEmpty');
      /* R230：骨架检测先行（资源页 R193 同款口径）——列表里还铺着骨架行时同位置替换成真行；
         非骨架期照常清空重铺 */
      var __skels = box.querySelectorAll('.admin-skel'); var __reuse = __skels.length > 0;

      // 搜索过滤
      var kw = (document.getElementById('adminSearch').value || '').trim().toLowerCase();
      var filterCat = document.getElementById('filterCat').value;
      var filterStatus = document.getElementById('filterStatus').value;
      var list = state.products.filter(function (p) {
        if (kw && String(p.title || '').toLowerCase().indexOf(kw) === -1
            && String(p.desc || '').toLowerCase().indexOf(kw) === -1) return false;
        if (filterCat && filterCat !== '0') {
          var catVal = Number(filterCat);
          var matched = String(p.cid) === filterCat;
          if (!matched) {
            var isTop = state.categories.some(function (c) { return Number(c.id) === catVal && (!c.parent_id || Number(c.parent_id) === 0); });
            if (isTop) {
              var subIds = state.categories.filter(function (c) { return Number(c.parent_id) === catVal; }).map(function (c) { return Number(c.id); });
              matched = subIds.indexOf(Number(p.cid)) !== -1;
            }
          }
          if (!matched) return false;
        }
        if (filterStatus === 'online' && (!p.is_online || p.is_hidden)) return false;
        if (filterStatus === 'hidden' && (p.is_online && !p.is_hidden)) return false;
        return true;
      });
      /* R230：骨架期空态不抢跑（对齐资源页 renderProducts 口径）——数据在路上时保持灰行 */
      if (window.__adminSkelP && !list.length) { empty.classList.remove('show'); return; }
      if (!__reuse) box.innerHTML = '';
      /* R193（用户 22:32 拍板）：后台空态统一前台三件套（📦48px+标题+清除按钮），样式在 ui-common.css 全站同一份 */
      empty.classList.toggle('show', !list.length);

      // 移除旧分页
      var oldPager = document.getElementById('adminPager');
      if (oldPager) oldPager.parentNode.removeChild(oldPager);

      if (list.length === 0) {
        /* R230：数据已到但为空——先收掉骨架再走空态（对齐资源页） */
        if (__reuse) box.innerHTML = '';
        /* R193：标题文案对齐前台口径——有搜索词=「该搜索暂无资源」+清除按钮；否则=「暂无资源」 */
        document.getElementById('productEmptyTitle').textContent = (document.getElementById('adminSearch').value || '').trim() ? '该搜索暂无资源' : '暂无资源';
        /* R183 条17：搜索空态提供「清除搜索」按钮（与前台同步；非搜索空态不显示） */
        var __oe = empty.querySelector('.empty-clear-btn');
        if (__oe) __oe.parentNode.removeChild(__oe);
        var __kw = (document.getElementById('adminSearch').value || '').trim();
        if (__kw) {
          var __cb = document.createElement('button');
          __cb.type = 'button'; __cb.className = 'empty-clear-btn'; __cb.textContent = '清除搜索';
          __cb.addEventListener('click', function () {
            document.getElementById('adminSearch').value = '';
            var __a2 = document.getElementById('adminSearchClear');
            if (__a2) __a2.classList.remove('show');
            adminPage = 1; renderProducts();
          });
          empty.appendChild(__cb);
        }
        updateBatchBar(); return;
      }

      // 分页
      var totalPages = Math.ceil(list.length / ADMIN_PAGE_SIZE);
      if (adminPage > totalPages) adminPage = totalPages;
      var start = (adminPage - 1) * ADMIN_PAGE_SIZE;
      var pageList = list.slice(start, start + ADMIN_PAGE_SIZE);

      var catName = {};
      state.categories.forEach(function (c) { catName[c.id] = c.name; });

      pageList.forEach(function (p, idx) {
        var row = document.createElement('div');
        row.className = 'product-row';
        row.classList.add('stagger-in'); row.style.animationDelay = Math.min(idx * 20, 180) + 'ms'; /* R192 二②；R211 二批（用户 09-20）：错峰 30ms 递升改 20ms/项、180ms 封顶（与前台卡片同款） */
        row.draggable = false;
        row.dataset.id = p.id;
        row.dataset.idx = idx;
        var handle = document.createElement('span'); handle.className = 'drag-handle'; handle.draggable = true; handle.title = '拖动排序'; handle.innerHTML = '⋮⋮'; row.appendChild(handle);

        // 拖拽事件
        row.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', p.id);
          this.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragend', function () {
          this.classList.remove('dragging');
          document.querySelectorAll('.product-row').forEach(function (r) { r.classList.remove('drag-over'); });
        });
        row.addEventListener('dragover', function (e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          this.classList.add('drag-over');
        });
        row.addEventListener('dragleave', function () {
          this.classList.remove('drag-over');
        });
        row.addEventListener('drop', function (e) {
          e.preventDefault();
          this.classList.remove('drag-over');
          var draggedId = Number(e.dataTransfer.getData('text/plain'));
          var targetId = p.id;
          if (draggedId === targetId) return;
          reorderProducts(draggedId, targetId);
        });

        // 复选框
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'row-check';
        cb.dataset.id = p.id;
        cb.style.flexShrink = '0';
        cb.style.width = '20px';
        cb.style.height = '20px';
        cb.style.cursor = 'pointer';
        cb.style.accentColor = 'var(--blue1)';
        cb.checked = !!state.prodSelected[p.id]; cb.addEventListener('change', function () { state.prodSelected[p.id] = this.checked; updateBatchBar(); });

        var img = document.createElement('img');
        img.className = 'thumb';
        img.decoding = 'async'; /* R193c ⑩：后台缩略图异步解码 */
        img.alt = '';
        img.loading = 'lazy';
        img.src = p.img || EXC_PLACEHOLDER;
        img.style.opacity = '0';
        img.onload = function () { this.style.opacity = '1'; this.classList.add('img-in'); }; /* R183 条2：缩略图入场动画（同二维码口径） */
        img.onerror = function () {
          this.onerror = null; this.src = EXC_PLACEHOLDER; this.style.opacity = '1'; if (this && this.classList) this.classList.add('media-fail');
        };

        var info = document.createElement('div');
        info.className = 'info';
        var t = document.createElement('div');
        t.className = 'p-title';
        var __kw = ((document.getElementById('adminSearch') || {}).value || '').trim();
        if (__kw && p.title) { /* R192 二④：搜索命中高亮（安全转义后包 mark.hl，与前台同款） */
          var __esc = function (x) { return String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
          var __lo = String(p.title).toLowerCase(), __k = __kw.toLowerCase(), __o = '', __i = 0, __h;
          if (__k) { while ((__h = __lo.indexOf(__k, __i)) !== -1) { __o += __esc(p.title.slice(__i, __h)) + '<mark class="hl">' + __esc(p.title.slice(__h, __h + __k.length)) + '</mark>'; __i = __h + __k.length; } }
          t.innerHTML = __o + __esc(p.title.slice(__i));
        } else t.textContent = p.title || '(无标题)';
        var s = document.createElement('div');
        s.className = 'p-sub';
        // R24：简介部分颜色复用资源页弹窗简介的蓝色（var(--blue1)），分类名保持灰色
        // R146（用户 00:34）：分隔点改黑色；简介后追加深色点+橙色金额（无金额整段不渲染）
        var _sc = document.createElement('span');
        _sc.textContent = (catName[p.cid] || '未分类');
        var _sdot = document.createElement('span');
        _sdot.className = 'p-dot';
        _sdot.textContent = ' · ';
        var _sd = document.createElement('span');
        _sd.className = 'p-desc';
        _sd.textContent = p.desc || '';
        s.appendChild(_sc);
        s.appendChild(_sdot);
        s.appendChild(_sd);
        var _pPriceText = formatPrice(p.price);
        if (_pPriceText) {
          var _pdot = document.createElement('span');
          _pdot.className = 'p-dot';
          _pdot.textContent = ' · ';
          var _pp = document.createElement('span');
          _pp.className = 'p-price';
          _pp.textContent = _pPriceText;
          s.appendChild(_pdot);
          s.appendChild(_pp);
        }
        info.appendChild(t);
        info.appendChild(s);

        // R82：显示/隐藏切换改用与编辑/复制/删除同款的胶囊按钮（点击直接切换），不再用下拉框
        var curStatus = (p.is_online && !p.is_hidden) ? 'online' : 'offline';
        var statusBtn = document.createElement('button');
        statusBtn.className = 'row-btn status-btn status-' + (curStatus === 'online' ? 'online' : 'hidden');
        statusBtn.textContent = curStatus === 'online' ? '显示' : '隐藏';
        statusBtn.title = '点击切换为' + (curStatus === 'online' ? '隐藏（资源页不显示）' : '显示');
        statusBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var next = (p.is_online && !p.is_hidden) ? 'offline' : 'online';
          setProductStatus(p.id, next);
        });


        var ops = document.createElement('div');
        ops.className = 'p-ops';
        var editBtn = document.createElement('button');
        editBtn.className = 'row-btn';
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', function () { openEdit(p); });
        var copyBtn = document.createElement('button');
        copyBtn.className = 'row-btn';
        copyBtn.textContent = '复制';
        copyBtn.title = '复制此资源为新资源';
        copyBtn.addEventListener('click', function () { copyProduct(p); });
        var delBtn = document.createElement('button');
        delBtn.className = 'row-btn danger';
        delBtn.textContent = '删除';
        delBtn.addEventListener('click', function () { delProduct(p.id); });
        // R126（用户定稿 15:21）：资源码改为下拉选项查看框（复用全站 select-picker 下拉组件，
        // 与显示/隐藏下拉同款结构）——点开展示该资源各类型的资源码（无码显示"无资源码"），点码即复制。
        // R139（用户定稿）：下拉内码/无码项按键化，与编辑弹窗类型列表 codeBtn/noCodeBtn 完全同款（row-btn）
        var codePicker = document.createElement('div');
        // R131（用户 16:14 定稿）：code-picker 钩子类用于容器布局对齐 .p-ops .row-btn（CSS 处理）
        codePicker.className = 'select-picker code-picker';
        var cpDisp = document.createElement('div');
        // R131：display 挂 row-btn 类——视觉/按压反馈/各断点布局全部继承旁边按键，仅保留下拉开合
        cpDisp.className = 'cat-picker-display row-btn';
        var cpTxt = document.createElement('span');
        cpTxt.className = 'cpd-text';
        cpTxt.textContent = '资源码';
        var cpArrow = document.createElement('span');
        cpArrow.className = 'cpd-arrow';
        cpArrow.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>';
        cpDisp.appendChild(cpTxt); cpDisp.appendChild(cpArrow);
        var cpPanel = document.createElement('div');
        cpPanel.className = 'cat-picker-panel';
        codePicker.appendChild(cpDisp); codePicker.appendChild(cpPanel);
        function renderCodePanel(variants) {
          cpPanel.innerHTML = '';
          if (!variants || !variants.length) {
            cpPanel.innerHTML = '<div style="color:#bbb;font-size:12px;padding:8px 10px">暂无类型</div>';
            return;
          }
          variants.forEach(function (v) {
            var item = document.createElement('div');
            item.className = 'cp-item';
            var nm = document.createElement('span');
            nm.className = 'cp-name'; /* R179：挂类进 uiTip 白名单（资源码面板类型名 R177 起截断省略，此前不在名单点了没反应——「有些省略号点击不显示」漏网主角） */
            nm.textContent = v.name || '(未命名)';
            // R146：类型名不折行（面板窄于内容时截断省略，绝不竖排换行）
            // R177（用户 19:18）：类型名可显示宽度统一上限——原来 flex:1 1 auto 弹性吸收，
            // 长名称一串显示几十字、短名称只显示一点；统一 max-width:150px 截断，全面板口径一致
            nm.style.cssText = 'font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;min-width:0;max-width:150px;';
            nm.title = v.name || '(未命名)'; // 悬停原生提示看全名（超长被截断时）
            item.appendChild(nm);
            // R146（用户 00:34）：类型名与码键之间加各自金额（橙色，与资源页价格同色）
            var _vPriceText = formatPrice(v.price);
            if (_vPriceText) {
              var _vp = document.createElement('span');
              _vp.className = 'cp-price';
              _vp.textContent = _vPriceText;
              item.appendChild(_vp);
            } else { /* R154：无金额行保留金额槽位（空占位），¥/码键跨行对齐 */
              var _vpp = document.createElement('span');
              _vpp.className = 'price-slot-ph';
              item.appendChild(_vpp);
            }
            if (v.resourceCode && v.resourceCode.trim()) {
              // R139（用户定稿）：码按键与编辑弹窗类型列表 codeBtn 同款（row-btn+monospace+600+letter-spacing），
              // 替换 R98 浅蓝胶囊——字体样式统一用"编辑弹窗类型列表那套"；点按键复制并收起面板
              var cd = document.createElement('button');
              cd.type = 'button';
              cd.className = 'row-btn code-slot'; /* R154：码键固定槽位，跨行对齐 */
              // R144（用户 23:57）：有码=蓝底白字（参考"显示"按键配色），宽高不变
              cd.style.cssText = 'font-family:monospace;letter-spacing:1px;font-weight:600;background:var(--blue1);color:#fff;border-color:var(--blue1);';
              cd.textContent = v.resourceCode;
              cd.title = v.resourceCode + '（点击复制并发新码）'; /* R179：固定宽截断后悬停 title 看全码 */
              item.appendChild(cd);
              (function (cvObj, cdEl) {
                /* R221（老板 15:44 拍板·复制即换码）：点码键=发码——当前码复制给客户（60 天兑换窗口
                   从本次点按起算），面板立即出新码、下方发码记录即时更新，面板不再收起 */
                cdEl.addEventListener('click', function (ev) {
                  ev.stopPropagation();
                  if (cdEl.disabled || window.__issueInFlight) return; /* R231 条26：防连点（发码期间锁键） */
                  cdEl.disabled = true;
                  cdEl.textContent = '发码中…';
                  __issueCode(cvObj, function () { renderCodePanel(variants); });
                });
              })(v, cd);
            } else {
              // R139：无码按键与类型列表 noCodeBtn 同款（row-btn 灰字、无动作），同步替换灰胶囊
              var nc = document.createElement('button');
              nc.type = 'button';
              nc.className = 'row-btn code-slot'; /* R154：无码键同槽位宽，跨行对齐 */
              // R144：无码键字体颜色参考编辑按键（var(--text-light)）
              nc.style.cssText = 'color:var(--text-light);cursor:default;';
              nc.textContent = '无资源码';
              item.appendChild(nc);
              item.style.cursor = 'default';
            }
            cpPanel.appendChild(item);
          });
        }
        renderCodePanel(p.variants);
        // R227（老板 19:40「其他页面也要同步更新」）：面板重绘函数挂到 DOM 元素上——
        // 弹窗里发新码后 __issueCode 通过 querySelectorAll('.code-picker') 找到各面板当场重绘，码键立即变新码
        codePicker.__renderCodePanel = renderCodePanel;
        codePicker.__product = p;
        // 无 variants 缓存时首次打开拉取（复用 loadVariants 的回写口径）
        // R221：每次打开都用最新缓存即时重绘——发码后新码/发码记录即时可见（不再只画一次）
        cpDisp.addEventListener('click', function () {
          if (!p.variants) {
            api('admin/variants?product_id=' + p.id).then(function (res) {
              if (res && res.ok) {
                p.variants = (res.list || []).slice();
                var _pp = (state.products || []).find(function (x) { return x.id === p.id; });
                if (_pp) _pp.variants = (res.list || []).slice();
                renderCodePanel(p.variants);
              }
            });
          } else {
            renderCodePanel(p.variants);
          }
        });
        // R123（用户定稿 14:59）：复制换到显示前面——显示、编辑、删除三个连在一起（与分类管理按钮排布一致）
        ops.appendChild(codePicker);
        ops.appendChild(copyBtn);
        ops.appendChild(statusBtn);
        ops.appendChild(editBtn);
        ops.appendChild(delBtn);

        row.appendChild(cb);
        row.appendChild(img);
        row.appendChild(info);
        row.appendChild(ops);
        /* R230：骨架期同位置逐条替换成真行（资源页同款，配 .stagger-in 错峰淡入） */
        if (__reuse && __skels[idx]) __skels[idx].parentNode.replaceChild(row, __skels[idx]);
        else box.appendChild(row);
        box.style.minHeight = '';
      });
      /* R230：真实条数少于骨架数时收尾移除多余骨架（资源页同款） */
      if (__reuse) { for (var __sj = pageList.length; __sj < __skels.length; __sj++) { if (__skels[__sj] && __skels[__sj].parentNode) __skels[__sj].parentNode.removeChild(__skels[__sj]); } }

      // 渲染完成淡入，避免批量操作/筛选时内容闪动
      setTimeout(function () { var _b = document.getElementById('productList'); if (_b) { _b.classList.remove('prod-fade'); void _b.offsetWidth; _b.classList.add('prod-fade'); } }, 10);
      // 分页控件（R14：改用全站统一 .uni-pager 组件——数据统计同款胶囊样式 + 跳页输入）
      var pager = document.createElement('div');
      pager.id = 'adminPager';
      box.parentNode.insertBefore(pager, box.nextSibling);
      if (window.buildUniPager) {
        window.buildUniPager(pager, {
          page: adminPage,
          totalPages: totalPages,
          total: list.length,
          unit: '件',
          onPage: function (p) {
            if (p === adminPage || __adminTurning) return;
            __adminTurning = true; /* R231 条19：淡出期间防重复翻页 */
            /* R231 条19+23（用户 09-21 23:38）：旧内容 0.1s 淡出再重建 + 平滑滚回列表顶 */
            var _pl = document.getElementById('productList');
            if (_pl) { _pl.style.transition = 'opacity 0.1s ease'; _pl.style.opacity = '0'; }
            setTimeout(function () {
              adminPage = p; renderProducts();
              if (_pl) _pl.style.opacity = '';
              __adminTurning = false;
              try {
                var _pl2 = document.getElementById('productList');
                if (_pl2) _pl2.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } catch (e) {}
            }, 100);
          }
        });
      } else if (totalPages > 1) {
        // 兜底：公共组件缺失时退回原方块样式（不应发生）
        var prev = document.createElement('button');
        prev.textContent = '上一页';
        prev.style.cssText = 'padding:6px 14px;border:1px solid var(--border,#ddd);background:var(--card-bg,#fff);color:var(--text,#222);border-radius:6px;cursor:pointer;font-size:13px;';
        prev.disabled = adminPage === 1;
        if (prev.disabled) prev.style.opacity = '0.4';
        prev.onclick = function () { if (adminPage > 1) { adminPage--; renderProducts(); } };
        pager.appendChild(prev);
        var info = document.createElement('span');
        info.textContent = adminPage + ' / ' + totalPages + '（共' + list.length + '件）';
        info.style.cssText = 'color:var(--text-light,#666);font-size:13px;';
        pager.appendChild(info);
        var next = document.createElement('button');
        next.textContent = '下一页';
        next.style.cssText = 'padding:6px 14px;border:1px solid var(--border,#ddd);background:var(--card-bg,#fff);color:var(--text,#222);border-radius:6px;cursor:pointer;font-size:13px;';
        next.disabled = adminPage === totalPages;
        if (next.disabled) next.style.opacity = '0.4';
        next.onclick = function () { if (adminPage < totalPages) { adminPage++; renderProducts(); } };
        pager.appendChild(next);
      }

      updateBatchBar();
    }

    // ---------- 复制资源 ----------
    function copyProduct(p) {
      showConfirm('复制资源', '确定复制资源「' + (p.title || '未命名') + '」？将创建一个内容完全相同的新资源（仅状态为隐藏，其余字段含排序全部照复制）。', function () {
        var newProduct = {
          cid: p.cid,
          // R155（用户 19:36）：复制=全量复制——title 原样（去掉「（副本）」后缀）、sort 保持原值（不再排到末尾）、
          // is_hidden 照抄；与原资源唯一差异=is_online 隐藏。
          title: p.title || '未命名',
          desc: p.desc || '',
          detail: p.detail || '',
          img: p.img || '',
          detailImages: p.detailImages || [],
          detailVideos: p.detailVideos || [],
          contactUrl: p.contactUrl || '',
          price: p.price || 0,
          // R137（用户 18:14）：复制补齐定时显示/隐藏时间——此前漏传，副本定时信息丢失
          schedule_on: p.schedule_on || null,
          schedule_off: p.schedule_off || null,
          variants: p.variants ? JSON.parse(JSON.stringify(p.variants)) : [],
        is_online: false,
        is_hidden: p.is_hidden ? 1 : 0,
        sort: p.sort || 0
      };
      api('admin/products', { method: 'POST', body: JSON.stringify(newProduct) }).then(function (res) {
        if (res && res.ok) {
          var _vs = newProduct.variants || [], _chain = Promise.resolve(), _newId = res.id, _fail = 0;
          _vs.forEach(function (v) {
            _chain = _chain.then(function () {
              // R137（用户 18:14）：复制类型补齐 bindLimit（绑定上限）——此前漏传，复制后一律归 1
              return api('admin/variants', { method: 'POST', body: JSON.stringify({
                productId: _newId, name: v.name, title: v.title || '', desc: v.desc || '', img: v.img || '', video: v.video || '',
                contactUrl: v.contactUrl || '', price: v.price || 0, sort: v.sort || 0,
                resourceCode: v.resourceCode || '', resourceContent: v.resourceContent || '', isHidden: v.isHidden || 0,
                bindLimit: Math.max(1, parseInt(v.bindLimit, 10) || 1)
              }) }).then(function (r2) { if (!r2 || !r2.ok) _fail++; return r2; }).catch(function () { _fail++; });
            });
          });
          _chain.then(function () {
            clearCache();
            // R178：本地即时插入副本（隐藏状态），后台静默同步；不再 loadProducts() 全量重拉
            state.products.push({ id: _newId, cid: newProduct.cid, title: newProduct.title, desc: newProduct.desc || '',
              detail: newProduct.detail || '', img: newProduct.img || '',
              detailImages: (newProduct.detailImages || []).slice(), detailVideos: (newProduct.detailVideos || []).slice(),
              contactUrl: newProduct.contactUrl || '', price: newProduct.price || 0,
              is_online: 0, is_hidden: 1, schedule_on: newProduct.schedule_on || '', schedule_off: newProduct.schedule_off || '',
              sort: newProduct.sort || 0, variants: (_vs || []).map(function (v) { return Object.assign({}, v); }) });
            renderProducts(); refreshCatCnts(); silentSyncProducts();
            if (_fail) toast('资源已复制，但有 ' + _fail + ' 个类型复制失败，请检查新资源的类型列表', 'error');
          }).catch(function () { clearCache(); silentSyncProducts(); });
          toast('复制成功，新资源已创建（默认隐藏状态）', 'success');
        } else {
          toast(res.msg || '复制失败', 'error');
        }
      });
      });
    }

    // ---------- 拖拽排序 ----------
    function reorderProducts(draggedId, targetId) {
      var fromIdx = state.products.findIndex(function (p) { return p.id === draggedId; });
      var toIdx = state.products.findIndex(function (p) { return p.id === targetId; });
      if (fromIdx === -1 || toIdx === -1) return;
      var item = state.products.splice(fromIdx, 1)[0];
      state.products.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, item);
      // 重新分配 sort 值并批量更新
      var updates = state.products.map(function (p, i) {
        p.sort = i + 1;
        return api('admin/products/' + p.id, {
          method: 'PUT',
          body: JSON.stringify({
            cid: p.cid, title: p.title, desc: p.desc, detail: p.detail,
            img: p.img, detailImages: p.detailImages || [],
            detailVideos: p.detailVideos || [], contactUrl: p.contactUrl || '',
            price: p.price || 0, sort: p.sort, is_online: p.is_online,
            is_hidden: p.is_hidden || 0
          })
        }).catch(function () {});
      });
      Promise.all(updates).then(function () {
        toast('排序已更新', 'success');
        renderProducts();
      });
    }

    // 更新批量操作栏状态
    function updateBatchBar() {
      var checks = document.querySelectorAll('.row-check:checked');
      var count = checks.length;
      var bar = document.getElementById('batchBar');
      var countEl = document.getElementById('batchCount');
      var selectAll = document.getElementById('selectAll');
      countEl.textContent = count;
      bar.classList.toggle('show', count > 0);
      var allChecks = document.querySelectorAll('.row-check');
      selectAll.checked = allChecks.length > 0 && count === allChecks.length;
    }

    // 批量操作
    function batchAction(action) {
      if (action === 'clearSel') { state.prodSelected = {}; document.querySelectorAll('.row-check').forEach(function (cb) { cb.checked = false; }); var _sa = document.getElementById('selectAll'); if (_sa) _sa.checked = false; updateBatchBar(); return; } var ids = Array.from(document.querySelectorAll('.row-check:checked')).map(function (cb) { return Number(cb.dataset.id); });
      if (ids.length === 0) return;
      var actionNames = { online: '批量显示', offline: '批量隐藏', delete: '批量删除', changeCat: '批量改分类', changePrice: '批量改价格' };
      var msgs = {
        online: '确定显示选中的 ' + ids.length + ' 个资源？',
        offline: '确定隐藏选中的 ' + ids.length + ' 个资源？隐藏后资源页不显示。',
        delete: '确定删除选中的 ' + ids.length + ' 个资源？其类型和统计数据也会一并删除，不可恢复。'
      };

      // 改分类：弹出分类下拉选择
      if (action === 'changeCat') {
        var select = document.getElementById('batchCatSelect');
        buildCatPicker(document.getElementById('batchCatPicker'), select,
          document.getElementById('batchCatDisplay'), document.getElementById('batchCatPanel'),
          Number(select.value) || 0, { allowUncategorized: true, placeholder: '请选择目标分类' }); /* R215 条5：批量移动同步恢复二级「全部」 */
        document.getElementById('batchCatMask').classList.add('open'); if (!document.getElementById('batchCatMask')._bm) { document.getElementById('batchCatMask')._bm = 1; document.getElementById('batchCatMask').addEventListener('click', function (e) { if (e.target === this) { this.classList.remove('open'); try { this.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) {} } }); } /* R217：恢复点外关闭（R215 误删） */
        // 确认按钮事件（只绑定一次）
        var okBtn = document.getElementById('batchCatOk');
        okBtn.onclick = function () {
          var newCid = Number(select.value);
          if (isNaN(newCid)) { toast('请选择分类', 'error'); return; }
          document.getElementById('batchCatMask').classList.remove('open');
          var _catText = document.querySelector('#batchCatDisplay .cpd-text').textContent;
          showConfirm('批量改分类', '确定将选中的 ' + ids.length + ' 个资源分类改为「' + _catText + '」？', function () {
            api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: 'changeCat', cid: newCid }) }).then(function (res) {
              if (res && res.ok) {
                toast('批量改分类完成：成功 ' + res.count + ' 项', 'success');
                // 性能：本地即时改 cid 并重渲染（毫秒级反馈），后台静默同步一次保证数据一致
                applyBatchLocal('changeCat', ids, { cid: newCid }); renderProducts(); silentSyncProducts();
              }
              else toast(res.msg || '操作失败', 'error');
            });
          });
        };
        return;
      }

      // 改价格：弹出价格输入
      if (action === 'changePrice') {
        showInput('批量改价格', '输入新价格（数字，0表示免费）', '请输入新价格', function (priceInput) {
          if (priceInput === null || priceInput === '') return;
          var newPrice = Number(priceInput);
          if (isNaN(newPrice) || newPrice < 0) { toast('请输入有效的价格', 'error'); return; }
          showConfirm('批量改价格', '确定将选中的 ' + ids.length + ' 个资源价格改为 ' + newPrice + '？', function () {
            api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: 'changePrice', price: newPrice }) }).then(function (res) {
              if (res && res.ok) {
                toast('批量改价格完成：成功 ' + res.count + ' 项', 'success');
                applyBatchLocal('changePrice', ids, { price: newPrice }); renderProducts(); silentSyncProducts();
              }
              else toast(res.msg || '操作失败', 'error');
            });
          });
        });
        return;
      }

      showConfirm(actionNames[action], msgs[action], function () {
        api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: action }) }).then(function (res) {
          if (res && res.ok) {
            toast(actionNames[action] + '完成：成功 ' + res.count + ' 项', 'success');
            clearCache();
            // 性能修复（批量操作点确定后 1-2 秒才反应）：原先成功后调 loadProducts() 全量重拉接口
            // + 整表重渲染，网络往返期间界面毫无反馈；现改为本地即时更新 + 立即渲染（毫秒级），
            // 后台再静默同步一次，保证数据一致的同时操作反馈即时可见
            applyBatchLocal(action, ids); renderProducts(); silentSyncProducts();
          } else {
            toast(res.msg || '操作失败', 'error');
          }
        });
      });
    }

    // 批量更新资源字段（逐个调用 PUT API）
    // ---------- 性能：批量操作本地即时更新（乐观 UI）+ 后台静默同步 ----------
    function applyBatchLocal(action, ids, extra) {
      var idSet = {};
      ids.forEach(function (i) { idSet[Number(i)] = true; });
      if (action === 'delete') {
        state.products = state.products.filter(function (p) { return !idSet[p.id]; });
        state.prodSelected = {};
        document.querySelectorAll('.row-check').forEach(function (cb) { if (idSet[Number(cb.dataset.id)]) cb.checked = false; });
      } else {
        state.products.forEach(function (p) {
          if (!idSet[p.id]) return;
          if (action === 'online') { p.is_online = 1; p.is_hidden = 0; }
          else if (action === 'offline') { p.is_online = 0; p.is_hidden = 0; }
          else if (action === 'changeCat' && extra) p.cid = Number(extra.cid);
          else if (action === 'changePrice' && extra) p.price = Number(extra.price);
        });
      }
      try { refreshCatCnts(); } catch (e) {}
    }
    // 静默同步：不转圈、不打断当前操作，仅在后台拉一次最新数据校正本地状态（防多端编辑漂移）
    var __silentSyncT = 0;
    function silentSyncProducts() {
      clearTimeout(__silentSyncT);
      __silentSyncT = setTimeout(function () {
        api('admin/products').then(function (res) {
          if (res && res.ok) { state.products = res.list || []; renderProducts(); }
        }).catch(function () {});
      }, 600);
    }

    // R178（用户 19:20 评论⑦扩展到全系统）：分类静默同步——本地即时更新后 600ms 防抖重拉一次，
    // 与服务器对账（loadCategories 本身无 loading 态，用户无感知）
    var __silentCatT = null;
    function silentSyncCategories() {
      clearTimeout(__silentCatT);
      __silentCatT = setTimeout(function () { loadCategories(); }, 600);
    }



    function delProduct(id) {
      /* R184 条19：撤销删除回退（用户 09-17 12:12 拍板）——恢复「确认后立即真删」，
         R183 的延迟真删+撤销 toast/keepalive 兜底整段移除；保留本地塌缩动画与静默同步范式 */
      showConfirm('删除资源', '确定删除该资源？其类型和统计数据也会一并删除。', function () {
        api('admin/products/' + id, { method: 'DELETE' }).then(function (res) {
          if (res && res.ok) {
            state.products = (state.products || []).filter(function (p) { return p.id !== id; });
            refreshCatCnts();
            var _r2 = document.querySelector('#productList [data-id="' + id + '"]');
            if (_r2) {
              /* R231 条24：删除行淡出 120ms→0.2s（收起感更稳；_minH 防跳已在 R183 就位） */
              _r2.style.transition = 'opacity 0.2s ease';
              _r2.style.opacity = '0';
              setTimeout(function () {
                if (_r2.parentNode) _r2.parentNode.removeChild(_r2);
                if (!document.querySelector('#productList .product-row')) renderProducts();
              }, 200);
            } else renderProducts();
            toast('资源已删除', 'success');
            clearCache(); silentSyncProducts();
          } else {
            toast((res && res.msg) || '删除失败', 'error');
          }
        });
      });
    }

    // 显示/隐藏直接切换：online=显示 / offline=隐藏（带完整数据，后端为全量更新）
    // 显示/隐藏直接切换：online=显示 / offline=隐藏（乐观更新：点击立即生效，管理页异步保存）
    function setProductStatus(id, status) {
      var target = state.products.filter(function (p) { return p.id === id; })[0];
      if (!target) return;
      var cur = (target.is_online && !target.is_hidden) ? 'online' : 'offline';
      if (cur === status) return;
      var prevOnline = target.is_online, prevHidden = target.is_hidden;
      // 立即在本地生效并重渲染，保证“点击即响应”（显示=资源页可见，隐藏=不可见）
      target.is_online = (status === 'online');
      target.is_hidden = false;
      window.__skipRenderOnce = true; var _sr = document.querySelector('#productList [data-id="' + id + '"]'); if (_sr) { var _sb = _sr.querySelector('.status-btn'); if (_sb) { _sb.textContent = status === 'online' ? '显示' : '隐藏'; _sb.classList.remove('status-online', 'status-hidden'); _sb.classList.add(status === 'online' ? 'status-online' : 'status-hidden'); _sb.title = '点击切换为' + (status === 'online' ? '隐藏（资源页不显示）' : '显示'); } }
      renderProducts();
      var data = {
        cid: target.cid, title: target.title, desc: target.desc, detail: target.detail,
        img: target.img, detailImages: target.detailImages || [],
        detailVideos: target.detailVideos || [], contactUrl: target.contactUrl || '',
        price: target.price || 0, sort: target.sort,
        schedule_on: target.schedule_on || '', schedule_off: target.schedule_off || '',
        is_online: target.is_online, is_hidden: target.is_hidden
      };
      api('admin/products/' + id, { method: 'PUT', body: JSON.stringify(data) }).then(function (res) {
        if (res && res.ok) { clearCache(); }
        else {
          // 失败回滚
          target.is_online = prevOnline; target.is_hidden = prevHidden; window.__skipRenderOnce = false;
          renderProducts();
          toast(res.msg || '操作失败，状态已回滚', 'error');
        }
      });
    }

    // ---------- 编辑 / 新增资源弹窗 ----------
    document.getElementById('addProductBtn').addEventListener('click', function () { openEdit(null); });

    function openEdit(p) {
      state.editingId = p ? p.id : null;
      state.editingProduct = p;
      editTitle.textContent = p ? '编辑资源' : '新增资源';
      fillCidSelect(p ? p.cid : 0);
      fillProductForm(p);
      // 有草稿直接恢复，不弹确认框（R111 口径：×/取消=丢弃；点外/Esc=暂存草稿，下次打开自动恢复；
      // 草稿改内存存取——刷新即清，与其它弹窗的暂存口径统一）
      try {
        var dd = __editDrafts[p ? p.id : 'new'];
        if (dd) {
          fTitle.value = dd.title || ''; fDesc.value = dd.desc || ''; fDetail.innerHTML = dd.detail || ''; fImg.value = dd.img || ''; fContactUrl.value = dd.contactUrl || ''; fPrice.value = dd.price || ''; fSort.value = dd.sort || 0; fOnline.checked = !!dd.online && !dd.hidden; fillCidSelect(dd.cid || 0);
        }
      } catch (e) {}
      updateImgPreview();
      editMask.classList.add('open');
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
      fDetail.innerHTML = p ? (p.detail || '') : '';
      fImg.value = p ? (p.img || '') : '';
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
    try { for (var __lk = localStorage.length - 1; __lk >= 0; __lk--) { var __lkn = localStorage.key(__lk); if (__lkn && __lkn.indexOf('product_draft_') === 0) localStorage.removeItem(__lkn); } } catch (e) {}
    function saveDraft() {
      if (!editMask.classList.contains('open')) return;
      var draftData = {
        title: fTitle.value,
        desc: fDesc.value,
        detail: serializeDetail(), /* R147：兜底卡还原成 video */
        img: fImg.value,
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
      try { delete __editDrafts[state.editingId || 'new']; } catch (e) {}
      stopAutoSaveDraft();
    }

    // 撤销/重做：交由浏览器原生（Ctrl+Z / Ctrl+Y）；原先自研的撤销栈无任何按钮调用，整块移除

    // 封面图实时预览
    // R15 加固：链接清空时同步清掉 src（杜绝任何残留显示路径）；换新链接时重置 fh 标记，
    // 保证新链接加载失败仍能换上感叹号占位（全局 error 委托只处理第一次失败）
    // R209（用户 09-19 00:31）：根因→输入无效地址时 onerror 反复触发+src 高频切换导致占位框抖动；
    // 修法→300ms 防抖 + 缓存已知坏地址，同地址不再重复触发加载-失败循环
    var __imgPreviewTimer = null;
    var __lastBadUrl = null;
    function updateImgPreview() {
      var preview = document.getElementById('fImgPreview');
      if (!preview) return;
      var url = fImg.value.trim();
      clearTimeout(__imgPreviewTimer);
      __imgPreviewTimer = setTimeout(function () {
        if (url) {
          if (url === __lastBadUrl) {
            preview.classList.add('show');
            return;
          }
          /* R215 条3（老板 09-21）：预加载成功才换图。旧逻辑直接把预览 src 切到未知链接，
             会经历「真图被清掉→浏览器破图占位→onerror→换感叹号」中间态（占位框轻微跳动 /
             破图图标一闪的根因）。改为后台 new Image() 试载：成功才换真图；失败原地换感叹号，
             全程 120×120 固定槽 + contain，框内尺寸纹丝不动。 */
          var probe = new Image();
          probe.onload = function () {
            preview.onerror = null; delete preview.dataset.fh;
            preview.classList.remove('media-fail');
            preview.src = url;
            preview.classList.add('show');
          };
          probe.onerror = function () {
            __lastBadUrl = url;
            preview.onerror = null; preview.dataset.fh = '1';
            preview.src = EXC_PLACEHOLDER; if (preview && preview.classList) preview.classList.add('media-fail');
            preview.classList.add('show');
          };
          probe.src = url;
        } else {
          preview.onerror = null; preview.dataset.fh = '1'; __lastBadUrl = null;
          preview.src = EXC_PLACEHOLDER; if (preview && preview.classList) preview.classList.add('media-fail');
          preview.classList.add('show');
        }
      }, 300);
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
        empty.textContent = '暂无分类，请先到分类管理添加';
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
        document.querySelectorAll('.cat-picker.open, .select-picker.open').forEach(function (p) { p.classList.remove('open'); });
        if (!wasOpen) { picker.classList.add('open'); positionCatPanel(picker); }
        return;
      }
      if (!(e.target.closest && (e.target.closest('.cat-picker') || e.target.closest('.select-picker')))) {
        document.querySelectorAll('.cat-picker.open, .select-picker.open').forEach(function (p) { p.classList.remove('open'); });
      }
    });
    // 面板定位：fixed 跟随触发按钮，避免被弹窗/容器裁剪（分类与通用选择器共用）
    function positionCatPanel(picker) {
      var panel = picker.querySelector('.cat-picker-panel');
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
      var ref = { el: holder, refresh: render, sel: sel };
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
        { excludeZero: false, showAll: true, allLabel: '全部分类', placeholder: '全部分类' }
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
      } catch (e0) {}
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
        selected, { allowUncategorized: true, placeholder: '请选择分类' } /* R215 条5：恢复二级「全部」（=选该一级），一级「全部」保留 */
      );
    }

    saveProductBtn.addEventListener('click', saveProduct);
    editCancel.addEventListener('click', function () { editMask.classList.remove('open'); clearDraft(); });
    editMask.addEventListener('click', function (e) { if (e.target === editMask) { clearDraft(); editMask.classList.remove('open'); } }); // R145：点外=取消（丢草稿，与×/取消键同口径）；R217：恢复（R215 误删）

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
      try { clone.querySelectorAll('.rte-img-del').forEach(function (d) { d.remove(); }); } catch (e0) {} // R158：×浮层兜底剥离（关闭时已摘离编辑器，双保险）
      try { clone.querySelectorAll('.rte-media-sel').forEach(function (m) { m.classList.remove('rte-media-sel'); }); } catch (e1) {} // R165：自绘选中框 class 兜底剥离（__hideImgDel 已清，双保险）
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
    window.__serializeDetail = serializeDetail;
    // R158（用户 22:35）：编辑器内容序列化统一入口——克隆后剥离 .rte-img-del 浮层（×关闭时已从编辑器摘除，此处双保险，
    // 防止「选中媒体→×正显示→程序化保存」路径把×写进内容）。类型说明/专属内容/公告三个编辑器统一走这里。
    window.__rteClean = function (el) {
      if (!el) return '';
      var c = el.cloneNode(true);
      try { c.querySelectorAll('.rte-img-del').forEach(function (d) { d.remove(); }); } catch (e0) {}
      try { c.querySelectorAll('.rte-media-sel').forEach(function (m) { m.classList.remove('rte-media-sel'); }); } catch (e1) {} // R165：自绘选中框 class 兜底剥离
      return c.innerHTML;
    };
    function saveProduct() {
      if (saving) return; // 防重复提交
      var data = {
        cid: Number(fCid.value) || 0,
        title: fTitle.value.trim(),
        desc: fDesc.value.trim(),
        detail: serializeDetail(), /* R147：兜底卡还原成 video */
        img: fImg.value.trim(),
        detailImages: [],
        detailVideos: [],
        contactUrl: fContactUrl.value.trim(),
        price: Number(fPrice.value) || 0,
        sort: Number(fSort.value) || 0,
        is_online: fOnline.checked,
        is_hidden: false,
        schedule_on: fScheduleOn.value || '',
        schedule_off: fScheduleOff.value || ''
      };
      if (!validateField(fTitle, '请填写资源标题')) return;
      // R209（用户 09-19 00:46）：根因→cid=0（「全部/未分类」）被 !data.cid 当成未选拦截；修法→cid=0 是合法选项，只拦 undefined/null
      if (data.cid === undefined || data.cid === null) { toast('请选择资源分类', 'error'); document.getElementById('fCidDisplay').style.borderColor = '#ff4444'; document.getElementById('fCidDisplay').style.boxShadow = '0 0 0 3px rgba(255,68,68,0.15)'; return; }

      saving = true;
      var isNewSave = !state.editingId; // 记录本次是否为新增（editingId 之后会被赋值）
      saveProductBtn.disabled = true;
      saveProductBtn.style.opacity = '0.6';
      var _saveBtnText = saveProductBtn.textContent;
      if (window.__btnBusy) window.__btnBusy(saveProductBtn, '确定中…'); /* R183 条4：忙碌转圈 */

      // 修复：原先在请求发出前就提示"保存成功"并关闭弹窗——网络一旦失败，用户以为已保存，数据实际没写入。
      // 现在提示与关窗只在请求成功后发生（见下方 then 分支）。
      var req = state.editingId
        ? api('admin/products/' + state.editingId, { method: 'PUT', body: JSON.stringify(data) })
        : api('admin/products', { method: 'POST', body: JSON.stringify(data) });

      req.then(function (res) {
        saving = false;
        saveProductBtn.disabled = false;
        saveProductBtn.style.opacity = '';
        saveProductBtn.textContent = _saveBtnText;
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
          } else if (res.id) {
            state.products.push({ id: res.id, cid: data.cid, title: data.title, desc: data.desc, detail: data.detail,
              img: data.img, detailImages: [], detailVideos: [], contactUrl: data.contactUrl, price: data.price,
              is_online: data.is_online ? 1 : 0, is_hidden: data.is_hidden ? 1 : 0,
              schedule_on: data.schedule_on || '', schedule_off: data.schedule_off || '', sort: data.sort,
              variants: (state.variants || []).slice() });
          }
          /* R211 二批（用户 09-20）：保存成功按钮状态链——转圈→✓（停留 400ms 让反馈可见）→收弹窗恢复；R183 条4 只有转圈无成功态 */
          if (window.__btnSuccess) window.__btnSuccess(saveProductBtn, '已保存');
          setTimeout(function () { editMask.classList.remove('open'); }, 400);
          if (isNewSave) { try { delete __editDrafts['new']; } catch (e) {} } // 新增成功必须清掉“新资源”草稿，避免下次新增带出旧内容
          clearDraft(); // 保存成功后清除草稿
          toast('资源已保存', 'success'); if (window.__haptic) window.__haptic(); /* R183 条12 */
          clearCache();
          renderProducts();
          /* R231 条25（用户 09-21 23:38）：保存后列表新改行蓝光高亮 1s 渐隐——
             关弹窗后视线落回列表，刚改过的行有一眼可辨的确认反馈 */
          try {
            var _fr = document.querySelector('#productList [data-id="' + state.editingId + '"]');
            if (_fr) { _fr.classList.add('row-flash'); setTimeout(function () { _fr.classList.remove('row-flash'); }, 1100); }
          } catch (e) {}
          refreshCatCnts();
          silentSyncProducts();
        } else {
          toast(res.msg || '保存失败', 'error');
        }
      }).catch(function () {
        saving = false;
        saveProductBtn.disabled = false;
        saveProductBtn.style.opacity = '';
        saveProductBtn.textContent = _saveBtnText;
        toast('保存失败，请重试', 'error');
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
        variantListEl.innerHTML = '<div style="color:#bbb;font-size:12px;padding:8px 0">暂无类型，点右上角"新增类型"（可拖拽排序）</div>';
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
        handle.textContent = '⋮⋮';

        var name = document.createElement('span');
        name.className = 'v-name';
        name.textContent = v.name || '(未命名)';
        if (v.isHidden) {
          var hideBadge = document.createElement('span');
          hideBadge.style.cssText = 'font-size:12px;color:#b26a00;background:#fff3e0;padding:2px 8px;border-radius:4px;margin-left:8px;font-weight:600;';
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
          (function (cvObj) {
            codeBtn.addEventListener('click', function (ev) {
              ev.preventDefault(); ev.stopPropagation();
              /* R221：复制即换码——旧码记 issued（60 天窗口起算）+ 立即出新码；无 id 的未保存类型退回普通复制 */
              if (!cvObj || !cvObj.id) {
                var ok0 = window.__shareCopyText ? window.__shareCopyText(cvObj ? cvObj.resourceCode : '') : false;
                toast(ok0 ? '已复制' : '复制失败', ok0 ? 'success' : 'error');
                return;
              }
              codeBtn.textContent = '发码中…';
              __issueCode(cvObj, function () { renderVariants(); });
            });
          })(v);
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

        item.appendChild(handle);
        item.appendChild(name);
        if (_vipEl) item.appendChild(_vipEl); /* R148：金额在类型名称与资源码中间 */
        item.appendChild(codeSpan);
        item.appendChild(sort);
        item.appendChild(editBtn);
        item.appendChild(delBtn);
        variantListEl.appendChild(item);
      });
    }

    // ========== 富文本编辑器功能 ==========
    var rteEditor = document.getElementById('fDetail');

    // ===== 富文本统一：记忆最后编辑的编辑器与选区，弹窗(链接/图片/视频)关闭后仍能插回原位置 =====
    var __rte = { editor: null, range: null };
    document.addEventListener('selectionchange', function () {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var el = sel.anchorNode;
      while (el && !(el.classList && el.classList.contains('rte-editor'))) el = el.parentNode;
      if (el) { __rte.editor = el; try { __rte.range = sel.getRangeAt(0).cloneRange(); } catch (e) {} }
    });
    document.addEventListener('mousedown', function (e) {
      var bar = e.target.closest ? e.target.closest('.rte-toolbar') : null;
      if (!bar) return;
      // 按下按钮/色板时阻止默认失焦，保住编辑器选区（下拉框不阻止，保证能展开）
      if (e.target.closest('.rte-btn, .rte-palette') && !e.target.closest('select')) e.preventDefault();
      var edId = bar.getAttribute('data-editor'), sel = window.getSelection();
      var ed0 = edId ? document.getElementById(edId) : null, inside0 = false;
      if (ed0 && sel && sel.rangeCount) {
        var p0 = sel.anchorNode;
        while (p0 && p0 !== ed0) p0 = p0.parentNode;
        if (p0 === ed0) { inside0 = true; try { __rte.range = sel.getRangeAt(0).cloneRange(); } catch (e) {} }
      }
      // 关键：点哪个编辑器的工具栏，就锁定哪个编辑器；若光标不在其中，选区置空→插入时落到末尾，避免插到别的编辑器
      if (ed0) { __rte.editor = ed0; if (!inside0) __rte.range = null; }
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
    function rteInsert(editor, html) {
      if (!editor) return;
      var __hadSel = __rte.editor === editor && __rte.range; /* R217 条7：用户曾在该编辑器内（有选区）才 focus */
      if (__hadSel) editor.focus(); /* R217 条7：从未进入该编辑器 → 不抢焦点（光标不跳进输入框），内容经 Range 兜底静默落到末尾 */
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
      try { __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (e) {}
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
      } catch (err) {}
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
      try { e.preventDefault(); } catch (err0) {}
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
        try { sib.remove(); } catch (err2) {}
        ed.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (err) {}
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
        __imgDelBtn.textContent = '×';
        __imgDelBtn.addEventListener('click', function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          var im = __imgDelTarget;
          __hideImgDel();
          if (im && im.isConnected) {
            var ed2 = im.closest('[contenteditable="true"]');
            im.remove();
            if (ed2) { try { ed2.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {} }
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
            if (ed2) { try { ed2.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {} }
          }
        });
      }
      if (__imgDelBtn.parentNode !== host) host.appendChild(__imgDelBtn); // 切编辑器/旧编辑器 DOM 被丢弃（弹窗关闭）后重新挂载
      __imgDelTarget = img;
      __imgDelBtn.style.display = 'block';
      __placeImgDel();
    }
    function __hideImgDel() {
      if (__imgDelBtn) {
        __imgDelBtn.style.display = 'none';
        try { __imgDelBtn.remove(); } catch (e1) {} // 摘离编辑器：内容 DOM 始终干净
      }
      try { document.querySelectorAll('.rte-media-sel').forEach(function (m) { m.classList.remove('rte-media-sel'); }); } catch (e0) {} // R165：收起自绘选中框
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
      } catch (e) {}
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
        (function () { var _tb = ed.previousElementSibling; if (_tb && _tb.classList && _tb.classList.contains('rte-toolbar')) { var _f = function () { if (!ed.classList.contains('rte-large')) return; var _b = _tb.getBoundingClientRect().bottom + 0; ed.style.top = _b + 'px'; ed.style.height = 'calc(100vh - ' + (_b + 12) + 'px)'; ed.style.height = 'calc(100dvh - ' + (_b + 12) + 'px)'; }; /* R176：二段赋值 dvh 优先（手机地址栏/软键盘收窄可视区），不支持的内核第二句被忽略自动回退 100vh */ _f(); if (window.__rteRO) window.__rteRO.disconnect(); try { window.__rteRO = new ResizeObserver(_f); window.__rteRO.observe(_tb); } catch (e) {} } })();
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
        document.execCommand(cmd, false, null);
        rteEditor.focus();
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
          rteEditor.focus();
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
      editor.focus();
      if (__rte.editor === editor && __rte.range) { try { var _ps = window.getSelection(); _ps.removeAllRanges(); _ps.addRange(__rte.range); } catch (e) {} }
      document.execCommand(pal.getAttribute('data-cmd'), false, sw.getAttribute('data-color'));
      try { __rte.editor = editor; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (e) {}
      editor.focus();
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
      document.body.appendChild(pop);
      var r = anchor.getBoundingClientRect();
      var pw = pop.offsetWidth, ph = pop.offsetHeight;
      var left = r.left + r.width / 2 - pw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
      var top = r.bottom + 6;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    }
    function rteApplyCmd(editor, cmd, val) {
      /* R217 条7（老板 09-21）：点工具栏按钮不应把光标跳进输入框。根因→旧实现开头无条件
         editor.focus()，用户从未点进编辑器时点按钮也会把光标强制跳进编辑区开头。
         修法→只有「用户曾在该编辑器内建立过选区」（__rte.editor 对得上且有 range，由
         selectionchange 在点进编辑器时记录）才恢复选区执行；否则直接不执行、不 focus。 */
      if (__rte.editor !== editor || !__rte.range) return;
      editor.focus();
      try { var ps = window.getSelection(); ps.removeAllRanges(); ps.addRange(__rte.range); } catch (e) {}
      document.execCommand(cmd, false, val);
      try { __rte.editor = editor; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (e) {}
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
        if (color === '#ffffff') cell.style.borderColor = '#ccc';
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
          try { if (range.intersectsNode(td)) td.classList.add('tbl-cell-sel'); } catch (e) {}
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
      if (!aTd || !fTd) { toast('请先在表格里拖选要合并的多个单元格'); return; }
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
      if (picked.length < 2) { toast('请先在表格里拖选要合并的多个单元格'); return; }
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
      if (cs === 1 && rs === 1) { toast('当前单元格没有合并过，无需拆分'); return; }
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
      showConfirm('删除表格', '确定删除整个表格？', function () {
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
    });

    /* 引用块：formatBlock 切换 blockquote/p（再点一次取消引用） */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.rte-quote-btn') : null;
      if (!btn) return;
      e.preventDefault();
      var editor = document.getElementById(btn.getAttribute('data-editor'));
      if (!editor) return;
      if (__rte.editor !== editor || !__rte.range) return; /* R217 条7：从未进入该编辑器 → 不 focus、不执行（光标不跳输入框） */
      editor.focus();
      if (__rte.editor === editor && __rte.range) { try { var ps = window.getSelection(); ps.removeAllRanges(); ps.addRange(__rte.range); } catch (err) {} }
      var sel = window.getSelection();
      var bq = null;
      if (sel && sel.rangeCount) {
        var n = sel.getRangeAt(0).startContainer;
        var el = n.nodeType === 1 ? n : n.parentNode;
        bq = el && el.closest ? el.closest('blockquote') : null;
        if (bq && !editor.contains(bq)) bq = null;
      }
      document.execCommand('formatBlock', false, bq ? 'p' : 'blockquote');
      try { __rte.editor = editor; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (err) {}
      editor.focus();
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
        } catch (e) {}
      });
    }
    rteEditor.addEventListener('keyup', updateRteActive);
    rteEditor.addEventListener('mouseup', updateRteActive);

    // 插入超链接（一个弹窗两个输入框）
    document.getElementById('detailRteLink').addEventListener('click', function () {
      showLinkDialog('', '', function (url, text) {
        var html = '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank">' + text + '</a>';
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
          rteEditor.focus();
          toast('格式已应用', 'success');
        } else {
          toast('请先选中要应用格式的内容', 'error');
        }
        detailBrushStyle = null;
        brushBtn.classList.remove('active');
      }
    });

    // ---------- R31（优化项7）：自有图仓上传 ----------
    // 选图 → 必要时压缩（png 保无损防二维码糊；jpg/webp 超 1.5MB 或图超 2000px 转 jpeg 0.85）→ 上传 → 回调返回链接
    function uploadToBucket(file, cb) {
      if (!file) return;
      var isPng = file.type === 'image/png';
      var sizeMB = file.size / 1048576;
      var needCompress = (!isPng && sizeMB > 1.5) || sizeMB > 8;
      var go = function (blob) {
        var fd = new FormData();
        var name = file.name || ('upload.' + (String(file.type).split('/')[1] || 'png'));
        fd.append('file', blob, name);
        toast('正在上传图片…', 'info');
        // 注意：不能用 api()（它强制 JSON 头会破坏文件上传），直接 fetch 走 multipart
        fetch('/api/admin/upload-image', { method: 'POST', body: fd })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (res && res.ok && res.url) cb(res.url);
            else toast((res && (res.msg || res.error)) || '上传失败', 'error');
          })
          .catch(function () { toast('上传失败，请稍后重试', 'error'); });
      };
      if (!needCompress) { go(file); return; }
      var img = new Image();
      var objUrl = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
          var w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(objUrl);
          c.toBlob(function (blob) {
            if (blob && blob.size < file.size) go(blob); else go(file);
          }, 'image/jpeg', 0.85);
        } catch (e) { URL.revokeObjectURL(objUrl); go(file); }
      };
      img.onerror = function () { URL.revokeObjectURL(objUrl); go(file); };
      img.src = objUrl;
    }

    // R36：本地视频上传（与图片同一套自有存储；KV 单文件 25MB / R2 100MB，上限由后端校验）
    function uploadVideoToBucket(file, cb) {
      if (!file) return;
      var fd = new FormData();
      fd.append('file', file, file.name || 'video.mp4');
      toast('正在上传视频，大文件可能要等一会儿…', 'info');
      fetch('/api/admin/upload-video', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok && res.url) cb(res.url, res.note);
          else toast((res && (res.msg || res.error)) || '上传失败', 'error');
        })
        .catch(function () { toast('上传失败，请稍后重试', 'error'); });
    }

    // 封面图「上传本地图片」按钮
    (function () {
      var btn = document.getElementById('fImgUpload');
      if (!btn) return;
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
      inp.style.display = 'none';
      document.body.appendChild(inp);
      btn.addEventListener('click', function () { inp.value = ''; inp.click(); });
      inp.addEventListener('change', function () {
        uploadToBucket(inp.files && inp.files[0], function (url) {
          fImg.value = url;
          if (typeof fImg.dispatchEvent === 'function') fImg.dispatchEvent(new Event('input'));
          toast('封面图已上传，链接已自动填入', 'success');
        });
      });
    })();

    // R36：插入图片/视频统一弹窗（网络地址 + 右侧本地上传按钮共用一个输入框）
    function showMediaInput(kind, onInsert) {
      var isVideo = kind === 'video';
      showInput(isVideo ? '插入视频' : '插入图片',
        isVideo ? '粘贴网络视频地址，或点右侧按钮从电脑上传本地视频' : '粘贴网络图片地址，或点右侧按钮从电脑上传本地图片',
        isVideo ? 'https://.../xx.mp4' : 'https://...',
        function (url) {
          // R81：视频插入统一过这里做格式兼容预警（粘贴/上传全覆盖）；
          // 预警放在 onInsert 之后弹，避免被「视频已插入」提示反向覆盖
          // （R86：R83 的源头硬拦截方案已按用户要求回退）
          if (onInsert) onInsert(url);
          if (isVideo && url) warnVideoCompat(url);
        }, '', kind);
    }

    // R81：.mov/.avi/.wmv/.flv/.mkv 等格式在 Chrome/安卓/部分浏览器无法播放（线上感叹号占位问题的根因之一），
    // 插入时立即提醒管理员转 MP4 (H.264)
    // （R86：R83 曾升级为源头硬拦截 gateVideoInsert，已按用户要求回退为预警方案）
    function warnVideoCompat(url) {
      var m = (url || '').split('?')[0].toLowerCase().match(/\.([a-z0-9]+)$/);
      var ext = m ? m[1] : '';
      var risky = { mov: 1, avi: 1, wmv: 1, flv: 1, mkv: 1, m4v: 1, mpg: 1, mpeg: 1, ts: 1, '3gp': 1 };
      if (risky[ext]) {
        toast('已插入。注意：' + ext.toUpperCase() + ' 格式部分浏览器（Chrome/安卓）可能无法播放，建议转成 MP4 (H.264)', 'error');
      }
    }

    document.getElementById('detailRteImg').addEventListener('click', function () {
      showMediaInput('image', function (url) {
        if (!url) return;
        url = url.trim();
        var html = '<img src="' + url.replace(/"/g, '&quot;') + '" alt="" style="max-width:100%;border-radius:8px;" />';
        rteInsert(__rte.editor || document.getElementById('fDetail'), html);
        toast('图片已插入', 'success');
      });
    });

    document.getElementById('detailRteVideo').addEventListener('click', function () {
      showMediaInput('video', function (url) {
        if (!url) return;
        url = url.trim();
        var html = '<video src="' + url.replace(/"/g, '&quot;') + '" controls style="max-width:100%;border-radius:8px;"></video>';
        rteInsert(__rte.editor || document.getElementById('fDetail'), html);
        toast('视频已插入', 'success');
      });
    });

    // 占位符显示/隐藏
    function updateRtePlaceholder() {
      if (!rteEditor.innerHTML || rteEditor.innerHTML === '<br>' || rteEditor.innerHTML === '<p><br></p>') {
        rteEditor.style.color = '#999';
      } else {
        rteEditor.style.color = '#333';
      }
    }
    rteEditor.addEventListener('input', updateRtePlaceholder);
    rteEditor.addEventListener('focus', updateRtePlaceholder);
    rteEditor.addEventListener('blur', updateRtePlaceholder);

    // ========== 平台公告富文本编辑器 ==========
    var annEditor = document.getElementById('setAnnouncement');
    var annTitleInput = document.getElementById('annTitleInput');
    var annListEl = document.getElementById('annList');
    var annEditLabel = document.getElementById('annEditLabel');
    var annDraftPending = false;
    var stateAnn = { list: [], curId: null, loaded: false };
    // 初始隐藏设置页中的公告编辑器（由"设置公告"弹窗承载）
    (function () { var _tb = document.getElementById('announcementRteToolbar'); if (_tb) _tb.style.display = 'none'; if (annEditor) annEditor.style.display = 'none'; var _ct0 = document.querySelector('.rte-count[data-for="setAnnouncement"]'); if (_ct0) _ct0.style.display = 'none'; })(); /* R215 条1：计数条同藏 */
    // 解析公告列表（兼容旧单条 announcement）
    function parseAnnouncements(settings) {
      var arr = [];
      try { arr = JSON.parse(settings.announcements || '[]'); } catch (e) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      if (!arr.length && settings.announcement) arr = [{ id: 0, title: '公告', content: String(settings.announcement || ''), hidden: 0, sort: 0, level: 1 }];
      arr.sort(function (a, b) { var la = a.level === 1 ? -1 : 0, lb = b.level === 1 ? -1 : 0; if (la !== lb) return la - lb; return (a.sort || 0) - (b.sort || 0); });
      return arr;
    }
    // 把当前编辑中的标题/内容写回列表
    function flushAnnEdit() {
      if (stateAnn.curId) {
        var cur = stateAnn.list.find(function (x) { return x.id === stateAnn.curId; });
        if (cur) { if (annEditor) cur.content = window.__rteClean(annEditor); } // R158：统一剥离×浮层再入内容
      }
    }
    // 渲染公告项列表（拖拽排序）
    function renderAnnList() {
      var _ah = annListEl.offsetHeight; if (_ah > 0) annListEl.style.minHeight = _ah + 'px'; annListEl.innerHTML = ''; setTimeout(function () { if (annListEl) annListEl.style.minHeight = ''; }, 300);
      stateAnn.list.forEach(function (a, idx) {
        var item = document.createElement('div');
        item.className = 'ann-item' + (a.level === 1 ? ' primary' : '') + (a.id === stateAnn.curId ? ' ann-cur' : '');
        item.draggable = false; item.dataset.idx = idx; item.style.cursor = 'default';
        var handle = document.createElement('span');
        handle.className = 'drag-handle'; handle.draggable = a.level === 1 ? false : true; handle.style.opacity = a.level === 1 ? '0.35' : '1'; handle.title = a.level === 1 ? '默认公告不可拖动' : '拖动排序';
        handle.textContent = '⋮⋮';
        var txt = document.createElement('input'); txt.type = 'text'; txt.className = 'ann-title-input'; txt.readOnly = a.level === 1;
        txt.value = a.title || ''; txt.title = '点击修改公告项名字';
        txt.addEventListener('click', function (e) { e.stopPropagation(); });
        txt.addEventListener('input', function () { a.title = this.value; });
        txt.addEventListener('change', function () { if (!this.value.trim()) { this.value = a.title = '(未命名公告)'; } if (annEditLabel) annEditLabel.textContent = '编辑公告：' + a.title; });
        // 公告隐藏状态由下方状态下拉框直接切换
        var sortEl = document.createElement('span'); sortEl.style.cssText = 'color:#999;font-size:12px;min-width:56px;text-align:left;flex-shrink:0;'; sortEl.textContent = '排序:' + (idx + 1);
        // R82：显示/隐藏切换改用与编辑同款的胶囊按钮（点击直接切换），不再用下拉框
        var annStatusBtn = document.createElement('button');
        annStatusBtn.className = 'row-btn status-btn ' + (a.hidden ? 'status-hidden' : 'status-online');
        annStatusBtn.textContent = a.hidden ? '隐藏' : '显示';
        annStatusBtn.title = '点击切换为' + (a.hidden ? '显示' : '隐藏');
        annStatusBtn.addEventListener('click', function (e) { e.stopPropagation(); a.hidden = a.hidden ? 0 : 1; this.textContent = a.hidden ? '隐藏' : '显示'; this.classList.remove('status-online', 'status-hidden'); this.classList.add(a.hidden ? 'status-hidden' : 'status-online'); this.title = '点击切换为' + (a.hidden ? '显示' : '隐藏'); });
        // 点击公告项整行即可选中编辑（无需单独编辑按钮）
        var delBtn = document.createElement('button'); delBtn.className = 'row-btn danger'; delBtn.textContent = '删除';
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          showConfirm('删除公告', '确定删除公告「' + (a.title || '') + '」？', function () {
            stateAnn.list = stateAnn.list.filter(function (x) { return x.id !== a.id; });
            if (stateAnn.curId === a.id) stateAnn.curId = null;
            if (!stateAnn.curId && stateAnn.list.length) { renderAnnList(); selectAnnItem(stateAnn.list[0].id); }
            else if (!stateAnn.list.length) clearAnnEdit();
            else renderAnnList();
          });
        });
        item.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.select-picker, .cat-picker, .cat-picker-panel, .cp-item, .cat-picker-display')) return; selectAnnItem(a.id); });
        item.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', idx); this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
        item.addEventListener('dragend', function () { this.classList.remove('dragging'); document.querySelectorAll('.ann-item').forEach(function (el) { el.classList.remove('drag-over'); }); });
        item.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; this.classList.add('drag-over'); });
        item.addEventListener('dragleave', function () { this.classList.remove('drag-over'); });
        item.addEventListener('drop', function (e) {
          e.preventDefault(); this.classList.remove('drag-over');
          var fromIdx = Number(e.dataTransfer.getData('text/plain'));
          var toIdx = idx;
          if (fromIdx === toIdx || isNaN(fromIdx)) return;
          if (toIdx === 0) toIdx = 1; var moved = stateAnn.list.splice(fromIdx, 1)[0];
          stateAnn.list.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved);
          stateAnn.list.forEach(function (v2, i) { v2.sort = i + 1; });
          renderAnnList();
        });
        item.appendChild(handle); item.appendChild(txt); item.appendChild(sortEl); item.appendChild(annStatusBtn); item.appendChild(delBtn);
        annListEl.appendChild(item);
      });
    }
    // 选中并加载某条公告到编辑区
    function selectAnnItem(id) {
      flushAnnEdit();
      var a = stateAnn.list.find(function (x) { return x.id === id; });
      if (!a) return;
      stateAnn.curId = id;
      if (annEditor) annEditor.innerHTML = a.content || '';
      if (annEditLabel) annEditLabel.textContent = '编辑公告：' + (a.title || '(未命名)');
      var _idxA = -1; for (var _ii = 0; _ii < stateAnn.list.length; _ii++) { if (stateAnn.list[_ii].id === id) { _idxA = _ii; break; } }
      document.querySelectorAll('.ann-item').forEach(function (el) { el.classList.toggle('ann-cur', Number(el.dataset.idx) === _idxA); });
    }
    // 清空编辑区
    function clearAnnEdit() {
      flushAnnEdit();
      stateAnn.curId = null;
      if (annEditor) annEditor.innerHTML = '';
      if (annEditLabel) annEditLabel.textContent = '编辑公告';
      renderAnnList();
    }
    // R145：公告弹窗「取消」全量恢复——不止恢复数据层（R135 只恢复了 list+annMode，编辑器 DOM
    // 仍是草稿，重开瞬间/拉取失败时草稿可见，且 flushAnnEdit 会把草稿写回已恢复列表污染备份）。
    // 现在：备份列表 + 编辑器内容 + 显示频率 + 列表渲染 + 选中态 一次性全部回到已保存状态
    function annDiscard() {
      try { if (stateAnn._backup) { stateAnn.list = JSON.parse(JSON.stringify(stateAnn._backup)); stateAnn._backup = null; } } catch (e) {}
      annDraftPending = false; stateAnn.loaded = false;
      stateAnn.curId = null; // 置空选中，杜绝后续 flushAnnEdit 把编辑器草稿写回已恢复列表
      try { document.getElementById('annMode').value = stateAnn._modeSaved || 'always'; syncSelectDisplay(document.getElementById('annMode')); } catch (e) {}
      var _dl = null;
      try { _dl = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; } catch (e) {}
      if (annEditor) annEditor.innerHTML = _dl ? (_dl.content || '') : '';
      if (annEditLabel) annEditLabel.textContent = _dl ? ('编辑公告：' + (_dl.title || '(未命名)')) : '编辑公告';
      try { renderAnnList(); } catch (e) {}
      try { document.getElementById('annMask').classList.remove('open'); } catch (e) {}
    }
    window.__annDiscard = annDiscard;
    // 打开公告设置弹窗：把公告编辑器移入弹窗，并从服务器拉取最新公告
    document.getElementById('openAnnBtn').addEventListener('click', function () {
      var slot = document.getElementById('annEditorSlot');
      if (slot && slot.querySelector('#setAnnouncement') === null) {
        var _tb = document.getElementById('announcementRteToolbar');
        if (_tb) { _tb.style.display = ''; slot.appendChild(_tb); }
        if (annEditor) { annEditor.style.display = ''; slot.appendChild(annEditor); }
        /* R215 条1：字数计数条随编辑器一起搬进弹窗（此前留在设置页成「已输入 0 字」孤儿文案） */
        var _ct = document.querySelector('.rte-count[data-for="setAnnouncement"]');
        if (_ct) { _ct.style.display = ''; slot.appendChild(_ct); }
      }
      // 先立即打开弹窗，再后台拉取最新数据（避免网络延迟导致弹窗迟迟不出现）
      document.getElementById('annMask').classList.add('open');
      if (stateAnn.loaded && stateAnn.list.length) { try { renderAnnList(); var _dl0 = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; selectAnnItem(_dl0.id); } catch (e) {} } if (!stateAnn.loaded) {
        api('admin/settings').then(function (res) {
          if (res && res.ok) {
            stateAnn.list = parseAnnouncements(res.settings || {}); if (!stateAnn.list.some(function (x) { return x.level === 1; })) stateAnn.list.unshift({ id: 'def', title: '公告', content: (res.settings || {}).announcement || '', hidden: 0, sort: 0, level: 1 }); stateAnn._backup = JSON.parse(JSON.stringify(stateAnn.list));
            stateAnn.loaded = true;
            document.getElementById('annMode').value = (res.settings || {}).announcement_mode || 'always';
            syncSelectDisplay(document.getElementById('annMode')); // R166：同步自制下拉显示框
            stateAnn._modeSaved = (res.settings || {}).announcement_mode || 'always'; // R135：记录已保存频率供丢弃恢复
            if (stateAnn.list.length) { var _defAnn = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; renderAnnList(); selectAnnItem(_defAnn.id); } else { renderAnnList(); clearAnnEdit(); }
          }
        }).catch(function () {});
      }
    });
    // 添加公告（由事件委托统一调用，保证按钮始终可用）
    function addNewAnnouncement() {
      flushAnnEdit();
      var a = { id: Date.now(), title: '新公告', content: '', hidden: 0, sort: stateAnn.list.length + 1, level: 2 };
      stateAnn.list.push(a);
      renderAnnList();
      selectAnnItem(a.id);
    }
    // 确定保存公告
    // 修复：原先请求发出前就提示"公告已保存"并关闭弹窗，失败时造成"假成功"；提示与关窗移到请求成功后
    document.getElementById('saveAnnBtn').addEventListener('click', function () {
      var annBtn = this;
      var _annBtnText = annBtn.textContent;
      annBtn.disabled = true;
      if (window.__btnBusy) window.__btnBusy(annBtn, '确定中…'); /* R183 条4：忙碌转圈 */
      flushAnnEdit();
      var data = {
        announcement: '',
        announcement_mode: document.getElementById('annMode').value,
        announcements: JSON.stringify(stateAnn.list)
      };
      api('admin/settings', { method: 'PUT', body: JSON.stringify(data) }).then(function (res) {
        annBtn.disabled = false;
        annBtn.textContent = _annBtnText;
        if (res && res.ok) {
          /* R231 条26：保存成功三段式——绿✓「已保存」400ms 后恢复（设置面板真实保存键） */
          try {
            annBtn.textContent = '✓ 已保存';
            annBtn.style.background = 'var(--green, #2e7d32)'; annBtn.style.borderColor = 'var(--green, #2e7d32)'; annBtn.style.color = '#fff';
            setTimeout(function () { annBtn.textContent = _annBtnText; annBtn.style.background = ''; annBtn.style.borderColor = ''; annBtn.style.color = ''; }, 400);
          } catch (e0) {}
          toast('公告已保存', 'success'); if (window.__haptic) window.__haptic(); /* R183 条12 */
          stateAnn.loaded = true; annDraftPending = false;
          // R154: 保存成功后立即重建备份（原=null）——保存后再编辑、取消/×时 annDiscard 才有备份可恢复（重开瞬间及拉取失败时不再显示脏草稿）
          try { stateAnn._backup = JSON.parse(JSON.stringify(stateAnn.list)); } catch (e0) { stateAnn._backup = null; }
          stateAnn._modeSaved = document.getElementById('annMode').value; // R135：保存成功后同步已保存频率
          document.getElementById('annMask').classList.remove('open');
        } else toast(res.msg || '保存失败', 'error');
      }).catch(function () {
        annBtn.disabled = false;
        annBtn.textContent = _annBtnText;
        toast('保存失败，请重试', 'error');
      });
    });
    // 取消公告（不保存，下次打开重新加载已保存状态）
    document.getElementById('cancelAnnBtn').addEventListener('click', function () {
      annDiscard(); // R145：取消=全量恢复（数据+编辑器+频率+列表），与×/点外/Esc 同口径
    });
    // 遮罩关闭：暂存当前编辑状态，下次打开可继续编辑
    document.getElementById('annMask').addEventListener('click', function (e) {
      // R145：点外关闭=取消（丢弃未保存修改）——旧「暂存草稿」语义被用户否决（重开仍见未保存频率/内容）；R217：恢复（R215 误删）
      if (e.target === document.getElementById('annMask')) { annDiscard(); }
    });

    // ---------- 全局客服链接（弹窗设置，与公告一致） ----------
    // 修复（P0）：var 声明原来被误写进上一行 // 注释里（整句被注释掉），contactDraftPending 未定义，
    // 首次点「设置客服」抛 ReferenceError，输入框赋值不执行 → 第一次进弹窗没链接；兜底代码隐式建了全局变量后才正常
    var contactDraftPending = false;
    document.getElementById('openContactBtn').addEventListener('click', function () {
      document.getElementById('contactMask').classList.add('open');
      if (contactDraftPending) { contactDraftPending = false; return; }
      var _ci = document.getElementById('contactUrlInput'); var _cs = document.getElementById('setContactUrl'); _ci.value = _cs.value || '';
      if (!_cs.value) { try { api('admin/settings').then(function (res) { if (res && res.ok) { var s = res.settings || {}; _cs.value = s.contact_url || ''; _ci.value = s.contact_url || ''; window.__plSet = 1; } }); } catch (e) {} }
    });
    document.getElementById('saveContactBtn').addEventListener('click', function () {
      // 修复：原先请求发出前就提示"已保存"并关闭弹窗，失败时造成"假成功"；提示与关窗移到请求成功后
      var cBtn = this;
      var _cBtnText = cBtn.textContent;
      cBtn.disabled = true;
      if (window.__btnBusy) window.__btnBusy(cBtn, '确定中…'); /* R183 条4：忙碌转圈 */
      var v = document.getElementById('contactUrlInput').value.trim();
      document.getElementById('setContactUrl').value = v;
      var st = document.getElementById('contactStatus'); if (st) st.textContent = '';
      api('admin/settings', { method: 'PUT', body: JSON.stringify({ contact_url: v }) }).then(function (res) {
        cBtn.disabled = false;
        cBtn.textContent = _cBtnText;
        if (res && res.ok) {
          /* R231 条26：保存成功三段式——绿✓「已保存」400ms 后恢复（设置面板真实保存键） */
          try {
            cBtn.textContent = '✓ 已保存';
            cBtn.style.background = 'var(--green, #2e7d32)'; cBtn.style.borderColor = 'var(--green, #2e7d32)'; cBtn.style.color = '#fff';
            setTimeout(function () { cBtn.textContent = _cBtnText; cBtn.style.background = ''; cBtn.style.borderColor = ''; cBtn.style.color = ''; }, 400);
          } catch (e0) {}
          toast('客服链接已保存', 'success'); if (window.__haptic) window.__haptic(); /* R183 条12 */ document.getElementById('contactMask').classList.remove('open');
        }
        else toast(res.msg || '保存失败', 'error');
      }).catch(function () {
        cBtn.disabled = false;
        cBtn.textContent = _cBtnText;
        toast('保存失败，请重试', 'error');
      });
    });
    document.getElementById('cancelContactBtn').addEventListener('click', function () { contactDraftPending = false; document.getElementById('contactUrlInput').value = ''; document.getElementById('contactMask').classList.remove('open'); });
    document.getElementById('contactMask').addEventListener('click', function (e) { if (e.target === document.getElementById('contactMask')) { contactDraftPending = false; var _cu = document.getElementById('contactUrlInput'); if (_cu) _cu.value = ''; document.getElementById('contactMask').classList.remove('open'); } }); // R145：点外=取消（清输入，与×/取消键同口径）；R217：恢复（R215 误删）

    // 工具栏按钮点击执行命令
    document.querySelectorAll('#announcementRteToolbar .rte-btn[data-cmd]').forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
      btn.addEventListener('click', function () {
        var cmd = this.dataset.cmd;
        if (__rte.editor !== annEditor || !__rte.range) return; /* R217 条7：从未进入编辑器 → 不 focus、不执行（光标不跳输入框） */
        document.execCommand(cmd, false, null);
        annEditor.focus();
      });
    });

    // 下拉选择（字体、字号）
    document.querySelectorAll('#announcementRteToolbar .rte-select[data-cmd]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var cmd = this.dataset.cmd;
        var val = this.value;
        if (val && __rte.editor === annEditor && __rte.range) { /* R217 条7：有选区才执行，否则只重置下拉不抢焦点 */
          document.execCommand(cmd, false, val);
          annEditor.focus();
        }
        this.selectedIndex = 0;
        syncSelectDisplay(this); // R166：同步自制下拉显示框回到默认项
      });
    });

    // 插入超链接（一个弹窗两个输入框）
    document.getElementById('announcementRteLink').addEventListener('click', function () {
      showLinkDialog('', '', function (url, text) {
        var html = '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank">' + text + '</a>';
        rteInsert(__rte.editor, html);
        toast('超链接已插入', 'success');
      });
    });

    // 插入图片
    document.getElementById('announcementRteImg').addEventListener('click', function () {
      showMediaInput('image', function (url) {
        if (!url) return;
        url = url.trim();
        var html = '<img src="' + url.replace(/"/g, '&quot;') + '" alt="图片" style="max-width:100%;border-radius:8px;" />';
        rteInsert(__rte.editor || document.getElementById('setAnnouncement'), html);
        toast('图片已插入', 'success');
      });
    });

    // 插入视频
    document.getElementById('announcementRteVideo').addEventListener('click', function () {
      showMediaInput('video', function (url) {
        if (!url) return;
        url = url.trim();
        var html = '<video src="' + url.replace(/"/g, '&quot;') + '" controls style="max-width:100%;border-radius:8px;"></video>';
        rteInsert(__rte.editor || document.getElementById('setAnnouncement'), html);
        toast('视频已插入', 'success');
      });
    });

    // 格式刷
    var annBrushStyle = null;
    document.getElementById('announcementFormatBrush').addEventListener('mousedown', function (e) { e.preventDefault(); });
    document.getElementById('announcementFormatBrush').addEventListener('click', function () {
      var brushBtn = this;
      if (!annBrushStyle) {
        var sel = window.getSelection();
        if (sel.rangeCount > 0 && !sel.isCollapsed) {
          annBrushStyle = rteReadBrushStyle();
          brushBtn.classList.add('active');
          toast('格式已复制，选中其他内容后再次点击格式刷应用', 'success');
        } else {
          toast('请先选中要复制格式的内容', 'error');
        }
      } else {
        var sel2 = window.getSelection();
        if (sel2.rangeCount > 0 && !sel2.isCollapsed) {
          rteApplyBrushStyle(annBrushStyle);
          annEditor.focus();
          toast('格式已应用', 'success');
        } else {
          toast('请先选中要应用格式的内容', 'error');
        }
        annBrushStyle = null;
        brushBtn.classList.remove('active');
      }
    });

    // 占位符显示/隐藏
    function updateAnnPlaceholder() {
      if (!annEditor.innerHTML || annEditor.innerHTML === '<br>' || annEditor.innerHTML === '<p><br></p>') {
        annEditor.style.color = '#999';
      } else {
        annEditor.style.color = '#333';
      }
    }
    annEditor.addEventListener('input', updateAnnPlaceholder);
    annEditor.addEventListener('focus', function () { __rte.editor = annEditor; updateAnnPlaceholder(); });
    annEditor.addEventListener('blur', updateAnnPlaceholder);

    var variantDraftPending = false; // 类型弹窗：遮罩关闭暂存输入
    var variantDraftFor = null; // 暂存对应的类型 id（防止打开其他类型时误保留）
    addVariantBtn.addEventListener('click', function () {
      if (!state.editingId) {
      openVariantEdit(null); // 类型可随时添加，无需先保存资源；未保存时暂存本地列表，保存资源时一并提交
        return;
      }
      openVariantEdit(null);
    });

    function openVariantEdit(v) {
      if (variantDraftPending && variantDraftFor === (v ? v.id : null)) { variantDraftPending = false; variantModalTitle.textContent = v ? '编辑类型' : '新增类型'; return; } // 遮罩关闭暂存：仅同一类型保留输入继续编辑
      state.editingVariantId = v ? v.id : null;
      state._editVariantIdx = v ? state.variants.indexOf(v) : -1;
      variantModalTitle.textContent = v ? '编辑类型' : '新增类型';
      vName.value = v ? (v.name || '') : '';
      vTitle.value = v ? (v.title || '') : ''; // R148：类型标题回填
      document.getElementById('vDescEditor').innerHTML = v ? (v.desc || '') : '';
      vHidden.checked = v ? !!v.isHidden : false;
      // 类型图片/视频已并入类型描述编辑器
      vContactUrl.value = v ? (v.contactUrl || '') : '';
      vPrice.value = v ? (v.price || '') : '';
      vSort.value = v ? (v.sort || 0) : 0;
      vResourceCode.value = v ? (v.resourceCode || '') : '';
      // R106：绑定设备上限挪进类型表单（未单独设置=1，与后台默认口径一致）
      var _vbl = document.getElementById('vBindLimit');
      _vbl.value = v && v.bindLimit ? v.bindLimit : 1;
      document.getElementById('vContentEditor').innerHTML = v ? (v.resourceContent || '') : '';
      variantMask.classList.add('open');
    }

    // 通用超链接弹窗（一个弹窗两个输入框）
    var linkDialogMask = null; var __linkStashOn = false; // R111：链接弹窗暂存标记
    function showLinkDialog(defaultUrl, defaultText, callback) {
      // 创建弹窗
      if (!linkDialogMask) {
        linkDialogMask = document.createElement('div');
        linkDialogMask.className = 'modal-mask';
        linkDialogMask.id = 'linkDialogMask';
        linkDialogMask.innerHTML = '<div class="modal-box">' +
          '<button class="modal-close-x" data-link-close>×</button>' +
          '<h2 class="modal-title">插入超链接</h2>' +
          '<div class="form">' +
          '<label>链接地址</label><input id="linkDialogUrl" />' +
          '<label>显示文字 <span class="label-hint">不填则显示链接地址</span></label><input id="linkDialogText" />' +
          '</div>' +
          '<div class="modal-footer">' +
          '<button class="modal-inner-btn" id="linkDialogOk">确定</button>' +
          '<button class="modal-close" id="linkDialogCancel">关闭</button>' +
          '</div></div>';
        document.body.appendChild(linkDialogMask);
        // R111：×/关闭=丢弃（清两个输入）；点外/Esc=暂存（保留输入，下次打开接着填）
        linkDialogMask.querySelector('[data-link-close]').addEventListener('click', function () {
          try { document.getElementById('linkDialogUrl').value = ''; document.getElementById('linkDialogText').value = ''; } catch (e) {}
          __linkStashOn = false;
          linkDialogMask.classList.remove('open');
        });
        linkDialogMask.querySelector('#linkDialogCancel').addEventListener('click', function () {
          try { document.getElementById('linkDialogUrl').value = ''; document.getElementById('linkDialogText').value = ''; } catch (e) {}
          __linkStashOn = false;
          linkDialogMask.classList.remove('open');
        });
        if (window.__modalKit) window.__modalKit.register(linkDialogMask, {
          discard: function () { try { document.getElementById('linkDialogUrl').value = ''; document.getElementById('linkDialogText').value = ''; } catch (e) {} __linkStashOn = false; linkDialogMask.classList.remove('open'); },
          stash: function () { __linkStashOn = true; linkDialogMask.classList.remove('open'); }
        });
        linkDialogMask.addEventListener('click', function (e) {
          if (e.target === linkDialogMask) { __linkStashOn = true; linkDialogMask.classList.remove('open'); } // R217：恢复点外=暂存（R215 误删）
        });
      }
      // R111：暂存草稿优先回填（点外/Esc 关闭后重开接着填）；无暂存才填默认值
      if (!__linkStashOn) {
        document.getElementById('linkDialogUrl').value = defaultUrl || '';
        document.getElementById('linkDialogText').value = defaultText || '';
      }
      linkDialogMask.classList.add('open');
      // 确定按钮
      var okBtn = document.getElementById('linkDialogOk');
      okBtn.onclick = function () {
        var url = document.getElementById('linkDialogUrl').value.trim();
        var text = document.getElementById('linkDialogText').value.trim();
        if (!url) { toast('请输入链接地址', 'error'); return; }
        if (!text) text = url;
        linkDialogMask.classList.remove('open');
        __linkStashOn = false; // 确定即保存，草稿标记清除
        if (callback) callback(url, text);
      };
    }

    // 类型描述富文本编辑器
    function initVariantRte(toolbarId, editorId, linkBtnId, imgBtnId, videoBtnId, formatBrushBtnId) {
      var editor = document.getElementById(editorId);
      var formatBrushStyle = null; // 格式刷保存的样式

      // 工具栏按钮
      document.querySelectorAll('#' + toolbarId + ' .rte-btn[data-cmd]').forEach(function (btn) {
        btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
        btn.addEventListener('click', function () {
          if (__rte.editor !== editor || !__rte.range) return; /* R217 条7：从未进入编辑器 → 不 focus、不执行（光标不跳输入框） */
          document.execCommand(this.dataset.cmd, false, null);
          editor.focus();
        });
      });
      // 下拉选择
      document.querySelectorAll('#' + toolbarId + ' .rte-select[data-cmd]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          if (this.value && __rte.editor === editor && __rte.range) { /* R217 条7：有选区才执行，否则只重置下拉不抢焦点 */
            document.execCommand(this.dataset.cmd, false, this.value);
            editor.focus();
          }
          this.selectedIndex = 0;
          syncSelectDisplay(this); // R166：同步自制下拉显示框回到默认项
        });
      });
      // 格式刷
      if (formatBrushBtnId) {
        var brushBtn = document.getElementById(formatBrushBtnId);
        brushBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
        brushBtn.addEventListener('click', function () {
          if (!formatBrushStyle) {
            // 第一次点击：复制样式
            var sel = window.getSelection();
            if (sel.rangeCount > 0 && !sel.isCollapsed) {
              formatBrushStyle = rteReadBrushStyle();
              brushBtn.classList.add('active');
              toast('格式已复制，选中其他内容后再次点击格式刷应用', 'success');
            } else {
              toast('请先选中要复制格式的内容', 'error');
            }
          } else {
            // 第二次点击：应用样式
            var sel2 = window.getSelection();
            if (sel2.rangeCount > 0 && !sel2.isCollapsed) {
              rteApplyBrushStyle(formatBrushStyle);
              editor.focus();
              toast('格式已应用', 'success');
            } else {
              toast('请先选中要应用格式的内容', 'error');
            }
            formatBrushStyle = null;
            brushBtn.classList.remove('active');
          }
        });
      }
      // 插入链接（一个弹窗两个输入框）
      if (linkBtnId) {
        document.getElementById(linkBtnId).addEventListener('click', function () {
          showLinkDialog('', '', function (url, text) {
            var html = '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank">' + text + '</a>';
            rteInsert(__rte.editor, html);
            toast('超链接已插入', 'success');
          });
        });
      }
      // 插入图片（R36：网络地址 + 本地上传共用弹窗）
      if (imgBtnId) {
        document.getElementById(imgBtnId).addEventListener('click', function () {
          showMediaInput('image', function (url) {
            if (!url) return;
            url = url.trim();
            var html = '<img src="' + url.replace(/"/g, '&quot;') + '" alt="图片" style="max-width:100%;border-radius:8px;" />';
            rteInsert(__rte.editor || editor, html);
            toast('图片已插入', 'success');
          });
        });
      }
      // 插入视频（R36：网络地址 + 本地上传共用弹窗）
      if (videoBtnId) {
        document.getElementById(videoBtnId).addEventListener('click', function () {
          showMediaInput('video', function (url) {
            if (!url) return;
            url = url.trim();
            var html = '<video src="' + url.replace(/"/g, '&quot;') + '" controls style="max-width:100%;border-radius:8px;"></video>';
            rteInsert(__rte.editor || editor, html);
            toast('视频已插入', 'success');
          });
        });
      }
    }
    // 初始化类型描述和资源码专属内容的富文本编辑器
    initVariantRte('vDescRteToolbar', 'vDescEditor', 'vDescRteLink', 'vDescRteImg', 'vDescRteVideo', 'vDescFormatBrush');
    initVariantRte('vContentRteToolbar', 'vContentEditor', 'vContentRteLink', 'vContentRteImg', 'vContentRteVideo', 'vContentFormatBrush');
    // 类型编辑器 focus 时锁定当前编辑器（保证链接/图片/视频/颜色插入目标正确）
    ['fDetail', 'vDescEditor', 'vContentEditor'].forEach(function (id) { var _e = document.getElementById(id); if (_e) _e.addEventListener('focus', function () { __rte.editor = _e; }); });

    variantOk.addEventListener('click', function () {
      if (!validateField(vName, '请填写类型名称')) return;
      var name = vName.value.trim();
      var isLocalVariant = !state.editingId;
      var data = {
        productId: state.editingId,
        name: name,
        title: vTitle.value.trim(), // R148：类型标题随类型一起保存
        desc: window.__rteClean(document.getElementById('vDescEditor')),
        img: '',
        video: '',
        isHidden: vHidden.checked,
        // 图片/视频已并入 desc 编辑器
        contactUrl: vContactUrl.value.trim(),
        price: Number(vPrice.value) || 0,
        sort: Number(vSort.value) || 0,
        resourceCode: vResourceCode.value.trim(),
        resourceContent: window.__rteClean(document.getElementById('vContentEditor')),
        // R106：绑定设备上限（<1 或非法一律按 1；不封顶，可填任意大）
        bindLimit: Math.max(1, parseInt(document.getElementById('vBindLimit').value, 10) || 1)
      };
      if (isLocalVariant) {
        var _li = (typeof state._editVariantIdx === 'number') ? state._editVariantIdx : -1;
        if (_li >= 0 && state.variants[_li]) { Object.assign(state.variants[_li], data); } else { state.variants.push(data); }
        state.variants.forEach(function (vv, i) { vv.sort = i + 1; });
        variantDraftPending = false; variantMask.classList.remove('open');
        toast('类型已新增（保存资源后生效）', 'success');
        renderVariants();
        return;
      }
      // 修复：原先请求发出前就提示"保存成功"并关闭弹窗，失败时造成"假成功"；提示与关窗移到成功分支
      var _variantOkText = variantOk.textContent;
      variantOk.disabled = true;
      if (window.__btnBusy) window.__btnBusy(variantOk, '确定中…'); /* R183 条4：忙碌转圈 */
      var req = state.editingVariantId
        ? api('admin/variants/' + state.editingVariantId, { method: 'PUT', body: JSON.stringify(data) })
        : api('admin/variants', { method: 'POST', body: JSON.stringify(data) });
      req.then(function (res) {
        variantOk.disabled = false;
        variantOk.textContent = _variantOkText;
        if (res && res.ok) {
          variantDraftPending = false; variantMask.classList.remove('open');
          toast('类型已保存', 'success'); if (window.__haptic) window.__haptic(); /* R183 条12 */
          // R178：本地即时更新类型列表（不等 loadVariants 重拉的网络往返），loadVariants 降级为后台静默同步
          if (state.editingVariantId) {
            var _uv = (state.variants || []).find(function (x) { return x.id === state.editingVariantId; });
            if (_uv) Object.assign(_uv, data);
          } else if (res.id) {
            (state.variants = state.variants || []).push(Object.assign({ id: res.id, bindings: 0 }, data));
          }
          var _uvp = (state.products || []).find(function (x) { return x.id === state.editingId; });
          if (_uvp) _uvp.variants = (state.variants || []).slice();
          renderVariants();
          loadVariants(state.editingId);
        } else {
          toast(res.msg || '保存失败', 'error');
        }
      }).catch(function () {
        variantOk.disabled = false;
        variantOk.textContent = _variantOkText;
        toast('保存失败，请重试', 'error');
      });
    });

    // ---------- R92 绑定设备管理（一机一码）----------
    // 打开绑定设备清单弹窗：复用 modal-mask 弹窗外壳 + 统计表样式（全系统统一观感）
    var _bindingsVariant = null;
    // R114（无感预载）：登录后随产品列表一起静默预载全部类型绑定数据，点「绑定 N」徽章
    // 弹窗即开即显；打开后仍后台刷新一次保最新（refreshBindings 成功会回写缓存）。
    var __bindingsCache = {};
    function prefetchBindings() {
      api('admin/bindings?prefetch=1').then(function (res) {
        if (res && res.ok && res.map) __bindingsCache = res.map;
      });
    }
    var _bindingsPage = 1; /* R223：合并平铺表当前页（弹窗内翻页不关弹窗） */
    function openBindings(v) {
      _bindingsVariant = v;
      _bindingsPage = 1; /* R223：每次打开回到第 1 页 */
      document.getElementById('bindingsTitle').textContent = '资源码详情（' + (v.name || '(未命名)') + '）';
      document.getElementById('bindingsMask').classList.add('open');
      var _hit = __bindingsCache[v.id];
      if (_hit) renderBindings(_hit); // 命中预载缓存：内容立即上屏，零等待
      else {
        /* R231 条28（用户 09-21 23:38）：加载态复用统计表 tr 骨架（renderStatSkeleton 同款灰线；bindings 表同为 .stat-table 7 列） */
        var _bTb = document.getElementById('bindingsRows');
        _bTb.innerHTML = '';
        var _bFrag = document.createDocumentFragment();
        for (var _bi = 0; _bi < 8; _bi++) {
          var _bTr = document.createElement('tr');
          _bTr.className = 'skel admin-skel';
          _bTr.setAttribute('aria-hidden', 'true');
          var _bCells = '';
          for (var _bc = 0; _bc < 7; _bc++) _bCells += '<td><span class="sk-line' + (_bc === 0 ? ' w70' : ' w95') + '"></span></td>';
          _bTr.innerHTML = _bCells;
          _bFrag.appendChild(_bTr);
        }
        _bTb.appendChild(_bFrag);
      }
      refreshBindings(v.id); // 后台刷新（预载缓存兜底 + 解绑等操作后保最新）
    }
    /* R223（老板定稿·资源码与绑定合并平铺表）：一行 = 一台绑定设备，码三列（资源码/有效状态/发放时间）
       R224（老板 17:48）：状态+剩余有效两列合一——删「剩余有效」列，「状态」改名「有效状态」，
       内容三值：已绑定（绿 #2e7d32）/ 剩 N 天（蓝 #1e88e5）/ 已过期（灰 #999），不加粗。
       每行填满该设备所用码的信息；一码绑 N 台 = N 行同码相邻；未绑定的码（待用/过期）独占一行设备列显「—」；
       R221 上线前的存量老绑定查不到发码记录，码列显示「早期绑定」（灰小字，不留空白）。
       排序：发放时间倒序；老绑定行排最后（按绑定时间倒序）。每页 20 条，复用全站 buildUniPager。 */
    var _bindingsMerged = [];
    function __buildBindingsMerged(res) {
      var rows = res.list || [];
      var issues = res.issues || [];
      var byCode = {};
      issues.forEach(function (it) { byCode[String(it.code).toLowerCase()] = it; });
      var merged = [];
      // 码侧行（发放时间倒序，由后端排序保证）
      issues.forEach(function (it) {
        var bs = rows.filter(function (r) { return String(r.code || '').toLowerCase() === String(it.code).toLowerCase(); });
        if (!bs.length) { merged.push({ issue: it, binding: null }); return; }
        bs.forEach(function (b) { merged.push({ issue: it, binding: b }); });
      });
      // 老绑定（所用码不在发码记录里）→「早期绑定」行，排最后
      var legacy = rows.filter(function (r) { return !byCode[String(r.code || '').toLowerCase()]; });
      legacy.sort(function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); });
      legacy.forEach(function (b) { merged.push({ issue: null, binding: b }); });
      return merged;
    }
    function renderBindings(res) {
      var issues = res.issues || [];
      var summary = document.getElementById('bindingsSummary');
      // R223 汇总句：已绑（当前码）/上限 + 待用、已用、过期计数
      var _st = { wait: 0, used: 0, exp: 0 };
      issues.forEach(function (it) {
        if (it.status === '待用') _st.wait++;
        else if (it.status === '已用') _st.used++;
        else _st.exp++;
      });
      // R225（老板 18:13）：汇总句新文案 + 居中（HTML style 已加 text-align:center）；已用数不再单列（表内每行有状态）
      summary.textContent = '已绑定 ' + (res.cur_count || 0) + ' / 待绑定 ' + _st.wait + ' / 已过期 ' + _st.exp + ' / 资源码绑定上限 ' + res.limit;
      // R221 当前资源码展示行：点按键/码文本 = 复制旧码并发新码（复制即换码，60 天兑换窗口）
      var codeBox = document.getElementById('bindingsCode');
      var codeVal = document.getElementById('bindingsCodeVal');
      var codeCopy = document.getElementById('bindingsCodeCopy');
      if (res.code) {
        codeVal.textContent = res.code;
        codeVal.title = '点击复制并发新码';
        codeBox.style.display = 'flex';
        var _copyCode = function (ev) {
          if (ev && ev.target) ev.stopPropagation();
          if (!_bindingsVariant || !_bindingsVariant.id) {
            var ok0 = window.__shareCopyText ? window.__shareCopyText(res.code) : false;
            toast(ok0 ? '已复制' : '复制失败', ok0 ? 'success' : 'error');
            return;
          }
          if (codeCopy) {
            codeCopy.textContent = '发码中…';
            setTimeout(function () { /* 兜底：刷新链路异常时恢复按键文案，避免卡在「发码中…」 */
              if (codeCopy.textContent === '发码中…') codeCopy.textContent = '复制并发新码';
            }, 3000);
          }
          __issueCode(_bindingsVariant, function () {
            refreshBindings(_bindingsVariant.id);   // 换码后弹窗码值/绑定计数/发码记录同步刷新
            loadVariants(state.editingId);          // 编辑弹窗与资源列表里的码同步
          });
        };
        codeVal.onclick = _copyCode;
        codeCopy.onclick = _copyCode;
        if (codeCopy && codeCopy.textContent === '发码中…') codeCopy.textContent = '复制并发新码';
      } else {
        codeBox.style.display = 'none';
      }
      _bindingsMerged = __buildBindingsMerged(res);
      renderBindingsPage();
    }
    /* R223：平铺表分页渲染（每页 20 条；翻页只刷表格不关弹窗） */
    function renderBindingsPage() {
      var PER = 20;
      var total = _bindingsMerged.length;
      var totalPages = Math.max(1, Math.ceil(total / PER));
      if (_bindingsPage > totalPages) _bindingsPage = totalPages;
      if (_bindingsPage < 1) _bindingsPage = 1;
      var tbody = document.getElementById('bindingsRows');
      tbody.innerHTML = '';
      var pager = document.getElementById('bindingsPager');
      if (!total) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#999;">暂无资源码与绑定设备，访客输入正确资源码后将自动绑定其设备</td></tr>';
        if (pager) pager.innerHTML = '';
        return;
      }
      var start = (_bindingsPage - 1) * PER;
      _bindingsMerged.slice(start, start + PER).forEach(function (m) {
        var tr = document.createElement('tr');
        var mk = function (txt) { var td = document.createElement('td'); td.textContent = txt; return td; };
        // ① 资源码：有发码记录显码（等宽字体）；老绑定查不到记录显「早期绑定」灰小字
        var tdCode = document.createElement('td');
        if (m.issue) {
          tdCode.style.cssText = 'font-family:monospace;letter-spacing:.5px;color:#1e88e5;cursor:pointer;';
          tdCode.textContent = m.issue.code;
          tdCode.title = '点击复制该资源码';
          tdCode.onclick = function (ev) {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            var _okc = window.__shareCopyText ? window.__shareCopyText(m.issue.code) : false;
            toast(_okc ? '已复制资源码 ' + m.issue.code : '复制失败', _okc ? 'success' : 'error');
          };
        } else {
          tdCode.style.cssText = 'color:#aaa;font-size:12px;';
          tdCode.textContent = '早期绑定';
          tdCode.title = 'R221 复制即换码上线前的存量绑定，无发码记录';
        }
        tr.appendChild(tdCode);
        // ② 有效状态（R224 两列合一）：已绑定=绿 / 剩 N 天=蓝 / 已过期=灰，不加粗（老板点名）
        var tdStatus = document.createElement('td');
        var _spTxt = '', _spColor = '';
        if (m.binding) { _spTxt = '已绑定'; _spColor = '#2e7d32'; }
        else if (m.issue && m.issue.status === '待用') { _spTxt = '剩 ' + m.issue.remaining_days + ' 天'; _spColor = '#1e88e5'; }
        else if (m.issue) { _spTxt = '已过期'; _spColor = '#999'; }
        if (_spTxt) {
          var sp = document.createElement('span');
          sp.style.color = _spColor;
          sp.textContent = _spTxt;
          tdStatus.appendChild(sp);
        } else { tdStatus.textContent = ''; }
        tr.appendChild(tdStatus);
        // ③ 发放时间
        tr.appendChild(mk(m.issue ? window.__utcToLocal(m.issue.issued_at) : ''));
        // ④⑤⑥ 设备 / 绑定时间 / 最近访问（R136 设备名合并 UA，R156 UTC→北京时间）
        tr.appendChild(mk(m.binding ? ((m.binding.device || '-') + (m.binding.ua ? ' · ' + m.binding.ua : '')) : ''));
        tr.appendChild(mk(m.binding ? window.__utcToLocal(m.binding.created_at) : ''));
        tr.appendChild(mk(m.binding ? window.__utcToLocal(m.binding.last_access) : ''));
        // ⑦ 操作：解绑（未绑定行显「—」）
        var tdOp = document.createElement('td');
        if (m.binding) {
          var unBtn = document.createElement('button');
          unBtn.className = 'row-btn danger';
          unBtn.textContent = '解绑';
          (function (bid) {
            unBtn.addEventListener('click', function () {
              showConfirm('解绑设备', '确定解绑该设备？解绑后此设备需重新输入资源码才能解锁（其它设备不受影响）。', function () {
                api('admin/bindings/' + bid, { method: 'DELETE' }).then(function (res2) {
                  if (res2 && res2.ok) { toast('已解绑', 'success'); refreshBindings(_bindingsVariant && _bindingsVariant.id); loadVariants(state.editingId); }
                  else toast((res2 && res2.msg) || '解绑失败', 'error');
                });
              });
            });
          })(m.binding.id);
          tdOp.appendChild(unBtn);
        } else { tdOp.textContent = ''; }
        tr.appendChild(tdOp);
        tbody.appendChild(tr);
      });
      // 分页（复用全站 buildUniPager：胶囊 + 跳页；翻页不关弹窗）
      if (pager && window.buildUniPager) {
        window.buildUniPager(pager, {
          page: _bindingsPage,
          totalPages: totalPages,
          total: total,
          unit: '条',
          onPage: function (p) { _bindingsPage = p; renderBindingsPage(); }
        });
      }
    }

    // R114：后台刷新（预载缓存兜底 + 解绑/换码后保最新）；成功回写 __bindingsCache
    function refreshBindings(variantId) {
      api('admin/bindings?variant_id=' + variantId).then(function (res) {
        if (!res || !res.ok) {
          if (!__bindingsCache[variantId]) document.getElementById('bindingsRows').innerHTML = '<tr><td colspan="7" style="color:#999;">加载失败</td></tr>';
          return;
        }
        __bindingsCache[variantId] = res;
        var _open = document.getElementById('bindingsMask').classList.contains('open');
        if (_open && _bindingsVariant && _bindingsVariant.id === variantId) renderBindings(res);
      });
    }

    function delVariant(id) {
      showConfirm('删除类型', '确定删除该类型？', function () {
        if (!state.editingId) { var di = state.variants.indexOf(state._delVariantRef); if (di >= 0) state.variants.splice(di, 1); renderVariants(); toast('已删除', 'success'); return; }
        api('admin/variants/' + id, { method: 'DELETE' }).then(function (res) {
          if (res && res.ok) {
            toast('已删除', 'success');
            // R178：本地即时移除（不等重拉网络往返），loadVariants 后台静默同步
            state.variants = (state.variants || []).filter(function (x) { return x.id !== id; });
            /* R183 条7：码删除塌缩动画（120ms 淡出后重渲染） */
            var __vi = variantListEl.querySelector('.variant-item[data-vid="' + id + '"]');
            var __post7 = function () {
              var _dvp = (state.products || []).find(function (x) { return x.id === state.editingId; });
              if (_dvp) _dvp.variants = (state.variants || []).slice();
              renderVariants();
              loadVariants(state.editingId);
            };
            if (__vi) { __vi.style.transition = 'opacity var(--dur-fast, .10s) ease'; __vi.style.opacity = '0'; setTimeout(__post7, 120); }
            else __post7();
          }
          else toast(res.msg || '删除失败', 'error');
        });
      });
    }

    variantCancel.addEventListener('click', function () { variantDraftPending = false; variantMask.classList.remove('open'); });
    variantMask.addEventListener('click', function (e) { if (e.target === variantMask) { variantDraftPending = false; variantDraftFor = null; variantMask.classList.remove('open'); } }); // R145：点外=取消（丢输入）；R217：恢复（R215 误删）

    function fmtDay(s) { var p = String(s || '').split('-'); return p.length >= 3 ? String(Number(p[2])) : s; } // R52：图表标签只显号数（用户要求去掉月份）
    // R62：悬浮提示的时间标签——小时数据（1天档）加「时」，日期数据显示「几月几日」
    function fmtPointLabel(day) {
      var s = String(day == null ? '' : day);
      if (s.indexOf('-') >= 0) { var p = s.split('-'); if (p.length >= 3) return Number(p[1]) + '月' + Number(p[2]) + '日'; return s; }
      var n = Number(s); return (isNaN(n) ? s : n) + '时';
    }

    // ---------- R59：折线图悬浮提示 ----------
    // 鼠标移到折线图任意位置：取最近数据点，画竖参考线 + 数值框（本期三指标具体数，有上期时括号并列上期值）
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var lineHover = { svg: null, attached: false, data: null, prev: null, hasPrev: false, stepX: 0, padL: 40, padT: 20, padB: 30, W: 800, H: 200 };
    function clearLineHover(svg) {
      var g = svg.querySelector('#lhGroup');
      if (g && g.parentNode) g.parentNode.removeChild(g);
    }
    function drawLineHover(svg, i) {
      clearLineHover(svg);
      var d = lineHover.data[i]; if (!d) return;
      var p = lineHover.prev;
      var g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('id', 'lhGroup');
      var px = lineHover.padL + i * lineHover.stepX;
      var yTop = lineHover.padT, yBot = lineHover.H - lineHover.padB;
      // 竖参考线（跟随最近数据点）
      var ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('x1', px); ln.setAttribute('x2', px);
      ln.setAttribute('y1', yTop); ln.setAttribute('y2', yBot);
      ln.setAttribute('stroke', '#c3ccd9'); ln.setAttribute('stroke-width', '1'); ln.setAttribute('stroke-dasharray', '3 3');
      g.appendChild(ln);
      // 数值框内容：点标签（R62：小时加「时」/日期显「几月几日」，居中）+ 三条指标（各用系列色）
      var lines = [{ text: fmtPointLabel(d.day), color: '#555', center: true }];
      [
        { name: '浏览', key: 'views', color: '#1E88E5' },
        { name: '咨询客服', key: 'contacts', color: '#ff9900' },
        { name: '解锁', key: 'resource_unlocks', color: '#4CAF50' }
      ].forEach(function (s) {
        // R75：本期值靠左、（上期 N）整体靠框右缘对齐——两列各自动右对齐成列，数字不随宽度漂移
        var txt = s.name + ': ' + (d[s.key] || 0);
        var prevTxt = (lineHover.hasPrev && p && p[i]) ? '（上期 ' + (p[i][s.key] || 0) + '）' : '';
        lines.push({ text: txt, color: s.color, right: prevTxt });
      });
      // 框位置：参考线右侧，右侧放不下翻到左侧
      // R145：框不随窄屏缩小（R135 口径）且两框全视口恒等——去掉 viewBox 高度封顶（它是窄屏折线框 75px<柱框 84px
      // 一高一低的根因），配合 admin.css #lineSvg overflow:visible，超出 viewBox 的部分照常渲染、不被裁剪
      var _rs = svg.getBoundingClientRect();
      var _k = (_rs && _rs.width) ? Math.max(1, 800 / _rs.width) : 1;
      var boxW = 150 * _k, boxH = (20 + lines.length * 16) * _k;
      var bx = px + 8 * _k;
      if (bx + boxW > lineHover.W - 10) bx = px - 8 * _k - boxW;
      if (bx < 4) bx = 4;
      var by = yTop + 2 * _k;
      var rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', bx); rect.setAttribute('y', by);
      rect.setAttribute('width', boxW); rect.setAttribute('height', boxH);
      rect.setAttribute('rx', 4 * _k);
      rect.setAttribute('fill', 'rgba(255,255,255,0.96)');
      rect.setAttribute('stroke', '#d8dee8');
      g.appendChild(rect);
      lines.forEach(function (l, li) {
        var t = document.createElementNS(SVG_NS, 'text');
        if (l.center) { // R62：时间行居中（框宽中点）
          t.setAttribute('x', bx + boxW / 2); t.setAttribute('text-anchor', 'middle');
        } else {
          t.setAttribute('x', bx + 8 * _k);
        }
        t.setAttribute('y', by + (18 + li * 16) * _k);
        t.setAttribute('font-size', String(11 * _k));
        t.setAttribute('fill', l.color);
        if (l.center) t.setAttribute('font-weight', '600');
        t.textContent = l.text;
        g.appendChild(t);
        // R75：该行的（上期 N）贴框右缘（text-anchor:end），与其它行右对齐成一列
        if (l.right) {
          var tr = document.createElementNS(SVG_NS, 'text');
          tr.setAttribute('x', bx + boxW - 8 * _k); tr.setAttribute('text-anchor', 'end');
          tr.setAttribute('y', by + (18 + li * 16) * _k);
          tr.setAttribute('font-size', String(11 * _k));
          tr.setAttribute('fill', l.color);
          tr.textContent = l.right;
          g.appendChild(tr);
        }
      });
      svg.appendChild(g);
    }
    function ensureLineHover(svg) {
      if (lineHover.svg === svg && lineHover.attached) return;
      lineHover.svg = svg; lineHover.attached = true;
      // svg 元素本身不重建（每轮只重设 innerHTML），监听挂一次即可
      svg.addEventListener('mousemove', function (evt) {
        if (!lineHover.data || !lineHover.data.length) return;
        var rect = svg.getBoundingClientRect();
        var scale = (rect.width || lineHover.W) / lineHover.W;
        var x = (evt.clientX - rect.left) / (scale || 1);
        var i = lineHover.stepX > 0 ? Math.round((x - lineHover.padL) / lineHover.stepX) : 0;
        if (i < 0) i = 0;
        if (i > lineHover.data.length - 1) i = lineHover.data.length - 1;
        drawLineHover(svg, i);
      });
      svg.addEventListener('mouseleave', function () { clearLineHover(svg); });
    }

    // ---------- 折线图渲染 ----------
    function renderLineChart(trend, prev) {
      var svg = document.getElementById('lineSvg');
      if (!svg || !trend || !trend.length) { svg.innerHTML = ''; return; }
      // R147（用户 00:50①）：轴文字恒定渲染 10px（两图统一取小口径，R145 的 13px 推翻）——
      // SVG 有 viewBox 缩放，字号按 800/渲染宽 反补偿，任何视口下渲染尺寸都等于柱图 .tg-num 的 CSS 10px
      var _ax = 10, _asr = svg.getBoundingClientRect(); if (_asr && _asr.width) _ax = +(10 * 800 / _asr.width).toFixed(2); /* R147（用户 00:50①）：轴数字取小口径 10px（R145 的 13 改 10）——SVG 有 viewBox 缩放，按 800/渲染宽 反补偿保证任何视口渲染恒 10px，与柱图 .tg-num 一致 */
      var W = 800, H = 200, padL = 40, padR = 20, padT = 20, padB = 30;
      try { svg.dataset.padT = padT; } catch (e0) {} // R153（用户 19:00）：padT 供柱状图同步网格顶线距灰盒顶（两图「5」与上边界距离统一）
      var chartW = W - padL - padR, chartH = H - padT - padB;
      // R58：上期数据（折线图环比）——等长对齐才画；量纲同时计入上期，保证虚线不出顶
      var hasPrev = !!(prev && prev.length === trend.length);
      var maxVal = 1;
      trend.forEach(function (d) { maxVal = Math.max(maxVal, d.views, d.contacts, d.resource_unlocks || 0); });
      if (hasPrev) prev.forEach(function (d) { maxVal = Math.max(maxVal, d.views, d.contacts, d.resource_unlocks || 0); });
      maxVal = Math.ceil(maxVal / 5) * 5 || 5;
      var stepX = trend.length > 1 ? chartW / (trend.length - 1) : 0;

      function pt(i, val) {
        return { x: padL + i * stepX, y: padT + chartH - (val / maxVal) * chartH };
      }

      var html = '';
      // 网格线
      for (var g = 0; g <= 4; g++) {
        var gy = padT + (chartH / 4) * g;
        var gval = Math.round(maxVal - (maxVal / 4) * g);
        html += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#e8e8e8" stroke-width="1"/>';
        html += '<text x="' + (padL - 6) + '" y="' + (gy + 0.44 * _ax) + '" text-anchor="end" font-size="' + _ax + '" fill="#999">' + gval + '</text>'; /* R147（用户 00:59）：Y 轴数字与网格线的垂直关系向柱图看齐——数字顶恒在网格线上方 4.8px（柱图 .tg-num top:-5.8px 口径），原 gy+4 在不同缩放下忽近忽远 */
      }
      // X轴标签
      trend.forEach(function (d, i) {
        var px = pt(i, 0).x;
        var label = d.day ? fmtDay(d.day) : '';
        if (trend.length <= 10 || i % Math.ceil(trend.length / 8) === 0) {
          html += '<text x="' + px + '" y="' + (H - 8) + '" text-anchor="middle" font-size="' + _ax + '" fill="#999">' + label + '</text>';
        }
      });
      // R58：上期三条虚线（同色 35% 透明、dash 6 4）——画在实线前面，本期实线覆盖在上层；悬浮 title 显示上期值
      if (hasPrev) {
        var seriesPrev = [
          { key: 'views', color: '#1E88E5', name: '浏览' },
          { key: 'contacts', color: '#ff9900', name: '咨询客服' },
          { key: 'resource_unlocks', color: '#4CAF50', name: '资源码解锁' }
        ];
        seriesPrev.forEach(function (s) {
          var pPrev = '';
          prev.forEach(function (d, i) { var p = pt(i, d[s.key] || 0); pPrev += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
          html += '<path d="' + pPrev + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-dasharray="6 4" opacity="0.35" stroke-linejoin="round" stroke-linecap="round"><title>' + s.name + '(上期)</title></path>';
        });
        // R61：本期/上期说明移到图下方 line-legend（不再画在 SVG 右上角）
      }
      // 浏览折线
      var pathV = '';
      trend.forEach(function (d, i) { var p = pt(i, d.views); pathV += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
      html += '<path d="' + pathV + '" fill="none" stroke="#1E88E5" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      // 咨询客服折线
      var pathC = '';
      trend.forEach(function (d, i) { var p = pt(i, d.contacts); pathC += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
      html += '<path d="' + pathC + '" fill="none" stroke="#ff9900" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      // 资源码解锁折线
      var pathR = '';
      trend.forEach(function (d, i) { var p = pt(i, d.resource_unlocks || 0); pathR += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
      html += '<path d="' + pathR + '" fill="none" stroke="#4CAF50" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      // 数据点
      trend.forEach(function (d, i) {
        var pv = pt(i, d.views);
        var pc = pt(i, d.contacts);
        var pr = pt(i, d.resource_unlocks || 0);
        html += '<circle cx="' + pv.x + '" cy="' + pv.y + '" r="3.5" fill="#fff" stroke="#1E88E5" stroke-width="2"><title>浏览: ' + d.views + '</title></circle>';
        html += '<circle cx="' + pc.x + '" cy="' + pc.y + '" r="3.5" fill="#fff" stroke="#ff9900" stroke-width="2"><title>咨询客服: ' + d.contacts + '</title></circle>';
        html += '<circle cx="' + pr.x + '" cy="' + pr.y + '" r="3.5" fill="#fff" stroke="#4CAF50" stroke-width="2"><title>资源码解锁: ' + (d.resource_unlocks || 0) + '</title></circle>';
      });
      svg.innerHTML = html;
      // R59：记录本轮渲染数据/几何，并给 svg 挂悬浮提示（mousemove 最近点 → 参考线+数值框）
      lineHover.data = trend;
      lineHover.prev = hasPrev ? prev : null;
      lineHover.hasPrev = hasPrev;
      lineHover.stepX = stepX;
      ensureLineHover(svg);
      // R145：图表常在统计面板隐藏时首绘（登录后默认落在资源页即已画图）——此时渲染宽度为 0，
      // 轴字号走了回退值。注册重渲染入口：切到统计页（面板可见）与窗口 resize（防抖）时重画，字号按真实宽度补偿
      if (!window.__rlInit) {
        window.__rlInit = true;
        window.addEventListener('resize', function () {
          clearTimeout(window.__rlT);
          window.__rlT = setTimeout(function () { try { if (window.__rerenderLine) window.__rerenderLine(); } catch (e) {} }, 200);
        });
      }
      window.__rerenderLine = function () {
        if (!lineHover.data || !lineHover.data.length) return;
        try { renderLineChart(lineHover.data, lineHover.hasPrev ? lineHover.prev : null); } catch (e) {}
      };
    }


    // 多工作表导出（SpreadsheetML，.xls，Excel/WPS 可直接打开；不同结构的数据分开放不同工作表）
    function xlsEscape(v) {
      return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function downloadMultiSheetXLS(filename, sheets) {
      var xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>';
      xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
      // R221（老板点名）：所有单元格上下左右居中——统一样式 c，表头/数据单元格都挂 ss:StyleID="c"
      xml += '<Styles><Style ss:ID="c"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style></Styles>';
      var usedNames = {};
      sheets.forEach(function (sh) {
        var nm = String(sh.name || 'Sheet').replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31) || 'Sheet';
        var base = nm, k = 2; // ss:Name 防重名（SpreadsheetML 工作表名必须唯一）
        while (usedNames[nm]) { nm = base.slice(0, 28) + '_' + k; k++; }
        usedNames[nm] = 1;
        xml += '<Worksheet ss:Name="' + xlsEscape(nm) + '"><Table>';
        sh.rows.forEach(function (r) {
          xml += '<Row>';
          r.forEach(function (cell) {
            var isNum = typeof cell === 'number' && isFinite(cell);
            xml += '<Cell ss:StyleID="c"><Data ss:Type="' + (isNum ? 'Number' : 'String') + '">' + (isNum ? cell : xlsEscape(cell)) + '</Data></Cell>';
          });
          xml += '</Row>';
        });
        xml += '</Table></Worksheet>';
      });
      xml += '</Workbook>';
      var blob = new Blob(['﻿', xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // R221（老板点名）：文件名「时间-数据统计」（到分钟）；同一分钟内重复导出加序号防覆盖
    var __exportStampState = { min: '', seq: 0 };
    function __exportStamp() {
      var d = new Date(); function pd(n) { return String(n).padStart(2, '0'); }
      var min = d.getFullYear() + pd(d.getMonth() + 1) + pd(d.getDate()) + '-' + pd(d.getHours()) + pd(d.getMinutes());
      if (__exportStampState.min === min) { __exportStampState.seq++; } else { __exportStampState.min = min; __exportStampState.seq = 0; }
      return min + (__exportStampState.seq > 0 ? '(' + (__exportStampState.seq + 1) + ')' : '');
    }
    function __xl(v) { return v == null ? '' : String(v); }

    // 统一导出（R221 全面升级）：一个 Excel 8 个工作表，数据走 /api/admin/export 全量端点
    // （每日趋势/按资源统计不再限近 30 天；新增绑定设备明细 + 发码记录；含访问记录明细）
    function exportAllData() {
      var btn = document.getElementById('exportBtn');
      var btnOld = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '导出中…'; }
      var done = function () { if (btn) { btn.disabled = false; btn.textContent = btnOld || '导出数据统计'; } };
      api('admin/export').then(function (res) {
        if (!res || !res.ok) { toast((res && res.msg) || '导出失败：数据加载失败', 'error'); done(); return; }
        try {
          var L = window.__utcToLocal || function (t) { return t; };
          var sheets = [];
          // 1 资源清单
          var pRows = [['ID', '资源标题', '分类', '状态', '价格(元)', '浏览量', '咨询客服', '资源码解锁', '绑定设备', '简介', '客服链接', '排序', '创建时间']];
          (res.products || []).forEach(function (p) {
            pRows.push([p.id, __xl(p.title), __xl(p.cat), (p.is_online && !p.is_hidden) ? '显示' : '隐藏', Number(p.price) || 0, p.views || 0, p.contacts || 0, p.resource_unlocks || 0, p.bindings || 0, __xl(p.desc), __xl(p.contact_url), p.sort || 0, L(p.created_at)]);
          });
          sheets.push({ name: '资源清单', rows: pRows });
          // 2 资源类型
          var vRows = [['所属资源', '类型名称', '类型描述', '价格(元)', '当前资源码', '是否需要资源码', '是否隐藏', '绑定设备数', '排序']];
          (res.variants || []).forEach(function (v) {
            vRows.push([__xl(v.product_title), __xl(v.name), __xl(v.desc), Number(v.price) || 0, __xl(v.resource_code), v.resource_code ? '是' : (v.has_content ? '否(直接获取)' : '否'), v.is_hidden ? '是' : '否', v.bindings || 0, v.sort || 0]);
          });
          sheets.push({ name: '资源类型', rows: vRows });
          // 3 分类清单
          var cRows = [['ID', '分类名称', '层级', '所属一级', '排序', '是否隐藏', '资源数']];
          (res.categories || []).forEach(function (c) {
            cRows.push([c.id, __xl(c.name), __xl(c.level), __xl(c.parent), c.sort || 0, c.is_hidden ? '是' : '否', c.product_count || 0]);
          });
          sheets.push({ name: '分类清单', rows: cRows });
          // 4 绑定设备明细（R221 新增）
          var bRows = [['所属资源', '类型', '资源码', '绑定时间', '最近访问', '设备UA']];
          (res.bindings || []).forEach(function (b) {
            bRows.push([__xl(b.product_title), __xl(b.variant_name), __xl(b.code), L(b.created_at), L(b.last_access), __xl(b.ua)]);
          });
          sheets.push({ name: '绑定设备明细', rows: bRows });
          // 5 发码记录（R221 新增：码、发放时间、状态、剩余天数）
          var iRows = [['所属资源', '类型', '资源码', '发放时间', '状态', '剩余有效天数', '绑定时间']];
          (res.issues || []).forEach(function (it) {
            iRows.push([__xl(it.product_title), __xl(it.variant_name), __xl(it.code), L(it.issued_at), __xl(it.status), it.remaining_days || 0, it.bound_at ? L(it.bound_at) : '']);
          });
          sheets.push({ name: '发码记录', rows: iRows });
          // 6 每日趋势（全量保留天数，不再限近 30 天）
          var tRows = [['日期', '浏览量', '咨询客服', '资源码解锁']];
          (res.trend || []).forEach(function (d) { tRows.push([__xl(d.day), d.views || 0, d.contacts || 0, d.resource_unlocks || 0]); });
          sheets.push({ name: '每日趋势', rows: tRows });
          // 7 按资源统计（全量口径）
          var sRows = [['资源名称', '浏览量', '咨询客服', '资源码解锁', '绑定设备']];
          (res.byProduct || []).forEach(function (p) { sRows.push([__xl(p.title), p.views || 0, p.contacts || 0, p.resource_unlocks || 0, p.bindings || 0]); });
          sheets.push({ name: '按资源统计', rows: sRows });
          // 8 访问记录明细
          var rRows = [['时间', '访问类型', '资源', 'IP']];
          (res.recent || []).forEach(function (r) { rRows.push([L(r.created_at), __xl(r.type_text), __xl(r.product_title), __xl(r.ip)]); });
          sheets.push({ name: '访问记录', rows: rRows });
          downloadMultiSheetXLS(__exportStamp() + '-数据统计.xls', sheets);
          var cnt = res.counts || {};
          toast('导出成功（8 个工作表）：资源清单 ' + (cnt.products || 0) + '、资源类型 ' + (cnt.variants || 0) + '、分类清单 ' + (cnt.categories || 0) + '、绑定设备明细 ' + (cnt.bindings || 0) + '、发码记录 ' + (cnt.issues || 0) + '、每日趋势、按资源统计、访问记录 ' + (cnt.recent || 0) + ' 条', 'success');
        } catch (e) { toast('导出失败：' + e.message, 'error'); }
        done();
      }).catch(function () { toast('导出失败：网络错误', 'error'); done(); });
    }


    // ---------- 数据统计 ----------
    // R60：环比小字全量百分比（含资源码解锁卡）——上期为 0 且本期有量时按从零起算显示 ↑100%（不再显示「新增」）；
    // 悬浮 title 仍显示上期具体数（上期为 0 时 title 也能看出来）
    function fmtStatDelta(cur, prev) {
      if (prev === 0 && cur === 0) return { text: '0%', cls: 'flat' };
      if (prev === 0) return { text: '↑100%', cls: 'up' };
      var pct = Math.round((cur - prev) / prev * 100);
      if (pct === 0) return { text: '0%', cls: 'flat' };
      return { text: (pct > 0 ? '↑' : '↓') + Math.abs(pct) + '%', cls: pct > 0 ? 'up' : 'down' };
    }

    // R57：柱状图公共渲染——每列左右两组：本期实色柱 + 上期浅色半透明柱；列顶涨跌箭头（以浏览为主指标），
    // 悬浮显示本期/上期具体数字。loadStats 与 applyStatsDays 共用，避免两处分叉
    function renderTrendBars(trendData, prevData) {
      var trendBox = document.getElementById('trendBars');
      trendBox.innerHTML = '';
      // R70：柱状图高度与折线图统一（以折线为准）——读折线 svg 实际渲染高同步容器与柱区（--barZone）
      // 初次渲染时统计面板可能尚未显示（svg 布局为瞬时小值），用 ResizeObserver 监听 svg 尺寸稳定/变化时再同步（含窗口缩放）
      var lineSvgEl = document.getElementById('lineSvg');
      var syncBarHeight = function (el, box) {
        var h2 = el ? el.getBoundingClientRect().height : 0;
        if (h2 >= 60) { /* R153：门槛 100→60——窄屏 SVG 渲染高 ~85px 被 100 拦住导致 barZone 不同步；隐藏面板时 SVG 高 0 仍被 60 拦住 */
          box.style.height = h2 + 'px';
          // R153（用户 19:00）：柱状图网格顶线距灰盒顶与折线图逐像素统一——
          // 折线网格顶线渲染位置 = line-chart 顶 + (padding-top 12) + padT*k（k=SVG渲染高/200，随视口变）；
          // 柱状 chart-box 上 padding 0、grid bottom:24 + height:barZone，网格顶距 trend-bars 顶 = h2-24-barZone，
          // 令其等于折线的 d → barZone = h2-24-d。量不到折线时兜底原 12px 口径
          var d = 12;
          try {
            var r2 = el.getBoundingClientRect();
            var lc = document.getElementById('lineChart');
            if (lc && r2.height) {
              var pt = parseFloat(el.dataset.padT); if (!(pt >= 0)) pt = 20;
              d = Math.max(0, (r2.top + pt * (r2.height / 200)) - lc.getBoundingClientRect().top);
            }
          } catch (e3) {}
          // R162（用户 00:08）：柱图网格/柱底/X标签/Y数字全部按折线几何公式同步（k=SVG渲染高/200）——
          // 网格顶距 trend-bars 顶 = 20k（=量测 d 减 chart-box 上 padding 12）、网格跨度 = 150k（间距 37.5k 与折线逐像素一致）、
          // 柱底距底 = 30k、X 标签底距底 = 8k、Y 数字右缘距网格左缘 = 6k
          var k2 = h2 / 200;
          box.style.setProperty('--gridTop', Math.max(0, Math.round(d) - 12) + 'px');
          box.style.setProperty('--barZone', Math.max(30, Math.round(150 * k2)) + 'px');
          box.style.setProperty('--bLift', Math.max(6, Math.round(30 * k2)) + 'px');
          box.style.setProperty('--xLift', Math.max(2, Math.round(8 * k2)) + 'px');
          box.style.setProperty('--numGap', Math.max(2, Math.round(6 * k2)) + 'px');
          return true;
        }
        return false;
      };
      syncBarHeight(lineSvgEl, trendBox);
      if (lineSvgEl && !lineSvgEl.__barHObserved) {
        lineSvgEl.__barHObserved = true;
        if (window.ResizeObserver) {
          new ResizeObserver(function () {
            syncBarHeight(document.getElementById('lineSvg'), document.getElementById('trendBars'));
          }).observe(lineSvgEl);
        }
      }
      var hasPrev = !!(prevData && prevData.length === trendData.length);
      var maxVal = 1;
      trendData.forEach(function (d, i) {
        // R66：与折线图严格同口径——量纲同时计入 resource_unlocks 与上期数据，
        // 保证两图左侧网格刻度数值完全一致（用户要求严谨同步）
        maxVal = Math.max(maxVal, d.views || 0, d.contacts || 0, d.resource_unlocks || 0);
        if (hasPrev) { var p = prevData[i] || {}; maxVal = Math.max(maxVal, p.views || 0, p.contacts || 0, p.resource_unlocks || 0); }
      });
      // R66：maxVal 取整到 5 的倍数——与折线图同口径，两图网格刻度数值一致
      maxVal = Math.ceil(maxVal / 5) * 5 || 5;
      // R66：灰色网格线 + 左侧数字刻度（折线图同款：#e8e8e8 横线、#999 数字、4 格 5 条）
      var grid = document.createElement('div');
      grid.className = 'trend-grid';
      var gridHtml = '';
      for (var g = 0; g <= 4; g++) {
        var gPct = (100 / 4) * g;
        var gVal = Math.round((maxVal / 4) * g);
        gridHtml += '<div class="tg-line" style="bottom:' + gPct + '%"><span class="tg-num">' + gVal + '</span></div>';
      }
      grid.innerHTML = gridHtml;
      trendBox.appendChild(grid);
      var labelsEl = document.createElement('div');
      labelsEl.className = 'trend-labels'; // R162：X 标签独立层（bottom: var(--xLift)，与折线标签底同位）
      trendData.forEach(function (d, i) {
        var col = document.createElement('div');
        col.className = 'trend-col';
        var wrap = document.createElement('div');
        wrap.className = 'trend-bar-wrap';
        // R59：悬浮 title 同时给本期与上期的具体数（悬浮任一根柱都能看到对比）
        // R62：title 首行加时间——小时数据（1天档）「N时」、日期数据「几月几日」
        function mkGroup(data, ghost, other, timeLabel) {
          var g = document.createElement('div');
          g.className = 'trend-bar-group';
          var tHead = timeLabel ? (timeLabel + '\n') : '';
          // R65：对比上期关闭时 other 为 null——先安全取值再拼（原来 other.views 在判空前求值会崩）
          function tag(x) { var v = x || 0; return other ? ((ghost ? '（本期 ' : '（上期 ') + v + '）') : ''; }
          var barV = document.createElement('div');
          barV.className = 'trend-bar view' + (ghost ? ' ghost' : '');
          barV.style.height = ((data.views || 0) / maxVal * 100) + '%';
          barV.title = tHead + '浏览' + (ghost ? '(上期)' : '') + ': ' + (data.views || 0) + tag(other && other.views);
          var barC = document.createElement('div');
          barC.className = 'trend-bar contact' + (ghost ? ' ghost' : '');
          barC.style.height = ((data.contacts || 0) / maxVal * 100) + '%';
          barC.title = tHead + '咨询客服' + (ghost ? '(上期)' : '') + ': ' + (data.contacts || 0) + tag(other && other.contacts);
          // R78：柱状图补资源码解锁系列（跟折线图一样三系列）——绿色 #4CAF50，ghost 沿用 opacity .32
          var barR = document.createElement('div');
          barR.className = 'trend-bar resource' + (ghost ? ' ghost' : '');
          barR.style.height = ((data.resource_unlocks || 0) / maxVal * 100) + '%';
          barR.title = tHead + '资源码解锁' + (ghost ? '(上期)' : '') + ': ' + (data.resource_unlocks || 0) + tag(other && other.resource_unlocks);
          g.appendChild(barV);
          g.appendChild(barC);
          g.appendChild(barR);
          return g;
        }
        // R58：箭头放进本期组内第一个位置（浏览柱上方）——组是 column 底对齐，箭头自然贴柱顶、跟随柱高
        var timeLabel = fmtPointLabel(d.day);
        var curGroup = mkGroup(d, false, hasPrev ? (prevData[i] || null) : null, timeLabel);
        if (hasPrev) {
          // 涨跌箭头：以浏览为主指标，悬浮给出浏览/咨询客服两行的上期→本期
          var pv = prevData[i] || {};
          var dv = (d.views || 0) - (pv.views || 0);
          var dc = (d.contacts || 0) - (pv.contacts || 0);
          var ar = document.createElement('div');
          ar.className = 'trend-arrow ' + (dv > 0 ? 'up' : dv < 0 ? 'down' : 'flat');
          ar.textContent = dv > 0 ? '▲' : dv < 0 ? '▼' : '▬';
          ar.title = timeLabel + '\n浏览: ' + (pv.views || 0) + ' → ' + (d.views || 0) + '；咨询客服: ' + (pv.contacts || 0) + ' → ' + (d.contacts || 0) + (dc > 0 ? '（涨）' : dc < 0 ? '（降）' : '') + '；资源码解锁: ' + (pv.resource_unlocks || 0) + ' → ' + (d.resource_unlocks || 0);
          curGroup.insertBefore(ar, curGroup.firstChild);
        }
        wrap.appendChild(curGroup);
        if (hasPrev) wrap.appendChild(mkGroup(prevData[i] || {}, true, d, timeLabel));
        col.appendChild(wrap);
        trendBox.appendChild(col);
        // R162（用户 00:08）：X 标签移出列、进独立标签层——与折线 X 标签同 x（点对齐：padL+i*stepX 换百分比）、
        // 同间隔（折线 stepX 口径），不再按列中心分布导致两图数字间隔不一致
        var label = document.createElement('div');
        label.className = 'trend-label';
        label.textContent = (trendData.length <= 10 || i % Math.ceil(trendData.length / 8) === 0) ? (d.day ? fmtDay(d.day) : '') : '';
        var nD = trendData.length, stepXr = nD > 1 ? 740 / (nD - 1) : 0;
        label.style.left = ((40 + i * stepXr) / 800 * 100).toFixed(3) + '%';
        labelsEl.appendChild(label);
      });
      trendBox.appendChild(labelsEl);
      // R76：柱状图悬浮与折线图一模一样——竖虚线+数值框（时间居中+三指标行、本期左/（上期 N）右）
      ensureBarHover(trendBox, trendData, hasPrev ? prevData : null);
    }

    // ---------- 柱状图悬浮（R76：复刻折线图 drawLineHover 的交互与样式） ----------
    var barHover = { box: null, data: null, prev: null, attached: false };
    function clearBarHover() {
      var box = barHover.box;
      if (!box) return;
      var l = box.querySelector('.bar-hover-line'); if (l) l.remove();
      var b = box.querySelector('.bar-hover-box'); if (b) b.remove();
    }
    function drawBarHover(i) {
      var box = barHover.box; if (!box || !barHover.data || !barHover.data[i]) return;
      clearBarHover();
      var d = barHover.data[i]; var p = barHover.prev;
      // 列中心横坐标（等宽列，用各列实际 rect 取第 i 列）
      var cols = box.querySelectorAll('.trend-col');
      var col = cols[i]; if (!col) return;
      var br = box.getBoundingClientRect(), cr = col.getBoundingClientRect();
      var px = cr.left - br.left + cr.width / 2;
      // 竖参考线（折线图同款 #c3ccd9 虚线）
      var ln = document.createElement('div');
      ln.className = 'bar-hover-line';
      ln.style.left = px + 'px';
      box.appendChild(ln);
      // 数值框内容：时间行（R62 格式、居中）+ 三指标行（系列色、本期左/（上期 N）右——与折线悬浮完全一致）
      var series = [
        { name: '浏览', key: 'views', color: '#1E88E5' },
        { name: '咨询客服', key: 'contacts', color: '#ff9900' },
        { name: '解锁', key: 'resource_unlocks', color: '#4CAF50' }
      ];
      var html = '<div class="bhb-time">' + fmtPointLabel(d.day) + '</div>';
      series.forEach(function (s) {
        var prevTxt = (p && p[i]) ? '（上期 ' + (p[i][s.key] || 0) + '）' : '';
        html += '<div class="bhb-row"><span class="bhb-cur" style="color:' + s.color + '">' + s.name + ': ' + (d[s.key] || 0) + '</span>' +
                (prevTxt ? '<span class="bhb-prev" style="color:' + s.color + '">' + prevTxt + '</span>' : '') + '</div>';
      });
      var hb = document.createElement('div');
      hb.className = 'bar-hover-box';
      hb.innerHTML = html;
      // R115：两图悬浮框同步——折线 SVG 框随 viewBox 缩放（渲染尺寸 = 150×84 × scale、字号 11 × scale），
      // 柱状框读取折线 SVG 当前缩放比（--bhs）跟随缩放，两框在任何宽度下外框尺寸/字号完全一致
      var _ls = document.getElementById('lineSvg');
      var _sc = 1;
      if (_ls) { var _lw = _ls.getBoundingClientRect().width; if (_lw) _sc = _lw / 800; }
      // R135：悬浮框不随窄屏缩小——渲染尺寸最小保持基准 150×84/字号11（「取大的那个」口径，恢复之前的大框观感）
      if (_sc < 1) _sc = 1;
      try { hb.style.setProperty('--bhs', _sc); } catch (e) {}
      // 框位置：参考线右侧 8px，右侧放不下翻到左侧（折线悬浮同逻辑），并钳制在容器内
      var boxW = 150 * _sc;
      var bx = px + 8;
      if (bx + boxW > br.width - 2) bx = px - 8 - boxW;
      if (bx < 2) bx = 2;
      hb.style.left = bx + 'px';
      hb.style.top = 'calc(var(--gridTop, 20px) + 2px)'; // R162：与折线悬浮框顶同位（折线 by=yTop+2*_k 渲染 20k+2）
      box.appendChild(hb);
    }
    function ensureBarHover(box, data, prev) {
      barHover.box = box; barHover.data = data; barHover.prev = prev;
      if (barHover.attached) return;
      barHover.attached = true;
      box.addEventListener('mousemove', function (evt) {
        if (!barHover.data || !barHover.data.length) return;
        // 最近列：按鼠标 x 找最近的 .trend-col 中心
        var cols = box.querySelectorAll('.trend-col');
        if (!cols.length) return;
        var br = box.getBoundingClientRect();
        var mx = evt.clientX - br.left;
        var best = 0, bestD = Infinity;
        for (var k = 0; k < cols.length; k++) {
          var cr = cols[k].getBoundingClientRect();
          var c = cr.left - br.left + cr.width / 2;
          var dd = Math.abs(mx - c);
          if (dd < bestD) { bestD = dd; best = k; }
        }
        drawBarHover(best);
      });
      box.addEventListener('mouseleave', function () { clearBarHover(); });
    }

    // R65：统计卡片渲染（拆成函数，供 loadStats 与「对比上期」开关切换重渲染共用）
    function renderStatCards(ov, ovp) {
      var cards = [
        { label: '资源总数', num: ov.products || 0 },
        { label: '显示资源', num: ov.online || 0 },
        { label: '隐藏资源', num: ov.hidden || 0 },
        { label: '总浏览', num: ov.views || 0, prev: ovp ? (ovp.views || 0) : null },
        { label: '咨询客服', num: ov.contacts || 0, prev: ovp ? (ovp.contacts || 0) : null },
        { label: '资源码解锁', num: ov.resource_unlocks || 0, prev: ovp ? (ovp.resource_unlocks || 0) : null },
      ];
      var cbox = document.getElementById('statCards');
      cbox.innerHTML = '';
      cards.forEach(function (c) {
        var d = document.createElement('div');
        d.className = 'stat-card';
        var n = document.createElement('div');
        n.className = 'num';
        n.textContent = '0'; /* R183 条10：数字滚动（0.6s ease-out；系统开了减少动效则直显终值） */
        (function (__t, __n) {
          if (!__t || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) { __n.textContent = __t; return; }
          var __t0 = null;
          requestAnimationFrame(function __step(ts) {
            if (__t0 === null) __t0 = ts;
            var __p = Math.min(1, (ts - __t0) / 600);
            __n.textContent = Math.round(__t * (1 - Math.pow(1 - __p, 3)));
            if (__p < 1) requestAnimationFrame(__step);
          });
        })(c.num, n);
        var l = document.createElement('div');
        l.className = 'label';
        l.textContent = c.label;
        d.appendChild(n);
        d.appendChild(l);
        // R57：涨跌小字（涨绿降红）——R65：仅「对比上期」开关开启时显示
        if (state.statsCmpPrev && c.prev !== null && c.prev !== undefined) {
          var delta = fmtStatDelta(c.num, c.prev);
          var dl = document.createElement('div');
          dl.className = 'delta ' + delta.cls;
          dl.textContent = delta.text;
          dl.title = '上期: ' + c.prev;
          d.appendChild(dl);
        }
        cbox.appendChild(d);
      });
    }

    // R176（用户 10:16）：统计切档极致响应——日期全链北京时间口径（旧 toISOString 取 UTC 日，
    // 北京 0-8 点差一天）；切档请求与后端 R168 的 +8hours 聚合同口径
    function __bjToday() { return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); }
    function __statsRangeDays(days) {
      var end = __bjToday();
      var ms = Date.parse(end + 'T00:00:00Z') - (days - 1) * 86400000;
      return { start: new Date(ms).toISOString().slice(0, 10), end: end };
    }
    // R176：全量趋势（30 天日线）单例预取——供 7/30 天档点击时本地即时切片重绘两图
    //（applyStatsDays 零等待）；一次会话只拉一次，与范围请求并行互不阻塞。
    // 旧实现把全量趋势挂在无参 loadStats 的响应上（start/end 一旦有值就永不填充），
    // 范围推导后无参调用也带参，必须改为独立预取。
    function __ensureTrendAll() {
      if (state.statsTrendAll && state.statsTrendAll.length) return;
      api('admin/stats').then(function (res) {
        if (res && res.ok && res.trend && res.trend.length) {
          state.statsTrendAll = res.trend;
          state.statsTrendAllPrev = res.trend_prev || [];
        }
      }).catch(function () {});
    }
    function loadStats(startDate, endDate, force) {
      // R176：无参调用一律按当前选中档推导范围（旧 R33 仅 1 天档特例，且旧短路
      // 「无参+已有全量趋势 → applyStatsDays 只重绘两图直接 return」正是 7/30 天档六卡片
      // 永不刷新的根因——切档按钮现在显式带范围+force，无参调用也按档推导，六卡随档同步）
      if (!startDate && !endDate) {
        var _r0 = __statsRangeDays(state.statsDays || 1);
        startDate = _r0.start; endDate = _r0.end;
      }
      __ensureTrendAll(); // R176：全量趋势并行预取（幂等），7/30 天档点击即可本地即时切片
      var url = 'admin/stats';
      var params = [];
      if (startDate) params.push('start_date=' + encodeURIComponent(startDate));
      if (endDate) params.push('end_date=' + encodeURIComponent(endDate));
      if (params.length) url += '?' + params.join('&');
      // R176（用户 10:16）：统计表标题随所选范围即时同步（旧静态"（30天内）"文案与切档后
      // 六卡/图表数据口径不符，切 1/7 天仍写 30 天）；请求发出前就更新，点击即见
      var _s0 = String(startDate || '').slice(0, 10), _e0 = String(endDate || '').slice(0, 10), _lbl;
      if (_s0 && _s0 === _e0) _lbl = '今天';
      else if (_s0 && _e0) {
        var _span = Math.round((Date.parse(_e0 + 'T00:00:00Z') - Date.parse(_s0 + 'T00:00:00Z')) / 86400000) + 1;
        _lbl = (_span === 7 || _span === 30) ? '近' + _span + '天' : (_s0 + ' ~ ' + _e0);
      }
      if (_lbl) {
        var _h3p = document.getElementById('statH3Product'); if (_h3p) _h3p.textContent = '资源明细（' + _lbl + '）';
        var _h3r = document.getElementById('statH3Recent'); if (_h3r) _h3r.textContent = '浏览记录（' + _lbl + '）';
      }
      // R173（用户 00:28）：回退 R171 的"请求一发就转圈"——改回 R170 条件口径（统计卡未渲染过才显示转圈）；
      // 无条件转圈让每次切日期/切 tab 都闪转圈+淡入，用户实测"全页面都闪一次，更难看"
      var _sl0 = document.getElementById('statsLoading'); if (_sl0 && !(document.getElementById('statCards') || { children: [] }).children.length) _sl0.style.display = 'flex';
      /* R230（老板 09-21 21:10）：统计三表首载铺 tr 骨架（每列一条灰线、数量=一页 20 条；数据到达同位置替换） */
      var _stb0 = document.getElementById('statRows');
      if (_stb0 && !_stb0.children.length) renderStatSkeleton();
      api(url).then(function (res) {
        // 数据统计表格顺序：资源明细 → 分类统计 → 浏览记录（幂等，仅首次生效）
        var _sec = document.getElementById('panel-stats');
        if (_sec) {
          var _ws = _sec.querySelectorAll('.stat-table-wrap');
          if (_ws.length >= 3 && _ws[0].querySelector('h3') && _ws[0].querySelector('h3').textContent.indexOf('分类') !== -1) {
            _sec.insertBefore(_ws[1], _ws[0]);
          }
        }
        if (!res.ok) { /* R230：接口异常收三表骨架，不卡灰 */
          __clearAdminSkel(document.getElementById('statRows')); __clearAdminSkel(document.getElementById('statCatRows')); __clearAdminSkel(document.getElementById('statRecentRows'));
          toast(res.msg || '加载失败', 'error'); return; }
        var ov = res.overview || {};
        // R57：环比——前三个是库存快照（不适用环比），只给后三个流量卡配涨跌小字；
        // R65：「对比上期」开关关闭时小字不显示（数据仍保存，开关重渲染）
        var ovp = res.overview_prev || null;
        state.statsOverview = ov; state.statsOverviewPrev = ovp;
        renderStatCards(ov, ovp);

        // 趋势图（按时间筛选）
        var allTrend = res.trend || [];
        var allTrendPrev = res.trend_prev || [];
        var days = state.statsDays || 7;
        var trendData, trendPrev;
        if (res.hourly && res.hourly.length) {
          // R29（优化项8）：单日范围（1天档/自定义同日）按小时粒度展示，统计页所有区块同口径（概览/明细/分类均来自同一范围请求）
          trendData = res.hourly.map(function (h) {
            return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks }; // R52：小时图标签去「时」字
          });
          // R57：1天档的上期=昨日同小时（同形状才能逐柱对比）
          trendPrev = (res.hourly_prev && res.hourly_prev.length === res.hourly.length) ? res.hourly_prev.map(function (h) {
            return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
          }) : null;
        } else {
          trendData = allTrend.slice(-days);
          trendPrev = allTrendPrev.length ? allTrendPrev.slice(-days) : null;
        }
        // 保存统计数据到 state，供导出与「对比上期」开关重渲染使用
        state.statsTrend = trendData;
        state.statsTrendPrev = trendPrev || null;
        state.statsByProduct = res.byProduct || [];
        // 折线图（R58：上期虚线；R65：仅开关开启时显示）
        renderLineChart(trendData, state.statsCmpPrev ? trendPrev : null);
        // 柱状图（R57：上期浅色对比柱与涨跌箭头；R65：仅开关开启时显示）
        renderTrendBars(trendData, state.statsCmpPrev ? trendPrev : null);

        // 三个统计表：全量数据（后端仅按 30 天范围过滤，不再截断条数）+ 前端分页（一页 20 条，全系统统一）
        state.statByProduct = res.byProduct || [];
        state.statByCategory = res.byCategory || [];
        state.statRecent = res.recent || [];
        renderStatTables();

        // 三个统计表（含最近浏览）已在上方统一交给 renderStatTables 渲染：全量数据 + 一页 20 条翻页
        // 修复：加载完成后才隐藏转圈动画并触发淡入——原先这行写在函数外、页面解析时就执行了一次，
        // 导致首次进统计页时"加载中…"转圈永远不消失
        var _slH = document.getElementById('statsLoading'); if (_slH) _slH.style.display = 'none';
        // R173（用户 00:28）：删掉加载完成后的 stats-fade-in 全页重放（remove+强制回流+add）——
        // 切日期档/切 tab 都会走 loadStats（R29 起每次切档重新拉数），这里的重放正是
        // 「切换日期全页面都闪一次」的直接根因；数据直接替换渲染，不再全页淡入
      });
    }

    // ---------- 统计三面板：三角展开按键 + 翻页（一页 20 条，全系统统一，复用资源页翻页样式） ----------
    var STAT_PAGE_SIZE = 20;
    var statPages = { product: 1, cat: 1, recent: 1 };
    // 展开按键：默认展示，点击隐藏内容（视觉复用资源页分类栏三角展开按键）
    [['statTglProduct', 'statBodyProduct'], ['statTglCat', 'statBodyCat'], ['statTglRecent', 'statBodyRecent']].forEach(function (pair) {
      var tglBtn = document.getElementById(pair[0]), tglBody = document.getElementById(pair[1]);
      if (!tglBtn || !tglBody) return;
      tglBtn.addEventListener('click', function () {
        var collapsed = tglBody.classList.toggle('collapsed');
        tglBtn.classList.toggle('open', !collapsed);
      });
    });
    /* R235（用户 09-22 12:33 派单）：加 onlyKey 参数——翻页回调只重绘被点的那张表，
       另外两张表元素不销毁、错峰淡入动画不重放（全屏跳动的根因）。
       无参调用（切日期档/切 tab 的 loadStats 路径）仍是三表全量刷新——数据真变了，全量合理。 */
    function renderStatTables(onlyKey) {
      var defs = [
        {
          key: 'product', tbodyId: 'statRows', pagerId: 'statPagerProduct', wrapId: 'statWrapProduct',
          list: state.statByProduct || [],
          row: function (r) {
            var tr = document.createElement('tr');
            var status = (r.is_online && !r.is_hidden) ? '显示' : '隐藏';
            tr.innerHTML = '<td>' + (r.title || '(无标题)') + '</td><td>' + status + '</td><td>' + (r.views || 0) + '</td><td>' + (r.contacts || 0) + '</td><td>' + (r.resource_unlocks || 0) + '</td><td>' + (r.bindings || 0) + '</td>';
            return tr;
          }
        },
        {
          key: 'cat', tbodyId: 'statCatRows', pagerId: 'statPagerCat', wrapId: 'statWrapCat',
          list: state.statByCategory || [],
          row: function (r) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (r.name || '') + '</td><td>' + (r.product_count || 0) + '</td><td>' + (r.total_views || 0) + '</td>';
            return tr;
          }
        },
        {
          key: 'recent', tbodyId: 'statRecentRows', pagerId: 'statPagerRecent', wrapId: 'statWrapRecent',
          list: state.statRecent || [],
          row: function (r) {
            var tr = document.createElement('tr');
            var typeText = r.type === 'view' ? '浏览' : (r.type === 'contact' ? '咨询客服' : (r.type === 'resource_unlock' ? '资源码解锁' : r.type));
            tr.innerHTML = '<td>' + window.__utcToLocal(r.created_at) + '</td><td>' + typeText + '</td><td>' + (r.title || '') + '</td>'; /* R156：UTC→北京时间 */
            return tr;
          }
        }
      ];
      defs.forEach(function (d) {
        if (onlyKey && d.key !== onlyKey) return; /* R235：单表翻页只动这一张，其余不碰 */
        var tbody = document.getElementById(d.tbodyId);
        var pager = document.getElementById(d.pagerId);
        if (!tbody || !pager) return;
        /* R230：骨架检测（资源页同款）——tr 骨架同位置替换、真行不足收尾 */
        var __skels = tbody.querySelectorAll('.admin-skel'); var __reuse = __skels.length > 0;
        if (!__reuse) tbody.innerHTML = '';
        pager.innerHTML = '';
        var totalPages = Math.ceil(d.list.length / STAT_PAGE_SIZE) || 1;
        if (statPages[d.key] > totalPages) statPages[d.key] = totalPages;
        if (statPages[d.key] < 1) statPages[d.key] = 1;
        var start = (statPages[d.key] - 1) * STAT_PAGE_SIZE;
        var frag = document.createDocumentFragment();
        /* R230：真行错峰淡入（资源页同款 20ms/项 180ms 封顶）+ 骨架同位置替换、不足收尾 */
        d.list.slice(start, start + STAT_PAGE_SIZE).forEach(function (r, ri) { var tr = d.row(r); tr.classList.add('stagger-in'); tr.style.animationDelay = Math.min(ri * 20, 180) + 'ms'; frag.appendChild(tr); });
        if (__reuse) {
          var __kids = Array.prototype.slice.call(frag.children);
          var __k = 0;
          for (; __k < __kids.length && __k < __skels.length; __k++) { if (__skels[__k] && __skels[__k].parentNode) __skels[__k].parentNode.replaceChild(__kids[__k], __skels[__k]); }
          for (var __q = __k; __q < __skels.length; __q++) { if (__skels[__q] && __skels[__q].parentNode) __skels[__q].parentNode.removeChild(__skels[__q]); }
        }
        tbody.appendChild(frag);
        if (totalPages > 1) {
          // R14：翻页控件改走全站统一 .uni-pager 公共组件（本样式即源自这里，观感不变 + 新增跳页输入）
          // 翻页后不再调 scrollStatWrap 强制回滚——点翻页时表格本就在视口内，强制对齐块顶正是"屏幕滑一下"的来源
          if (window.buildUniPager) {
            window.buildUniPager(pager, {
              page: statPages[d.key],
              totalPages: totalPages,
              total: d.list.length,
              unit: '条',
              onPage: (function (key) {
                return function (p) { statPages[key] = p; renderStatTables(key); }; /* R235：只重绘本表 */
              })(d.key)
            });
          } else {
            var prev = document.createElement('button');
            prev.textContent = '上一页';
            prev.disabled = statPages[d.key] === 1;
            prev.onclick = (function (key, wrapId) {
              return function () {
                if (statPages[key] > 1) { statPages[key]--; renderStatTables(key); scrollStatWrap(wrapId); } /* R235 */
              };
            })(d.key, d.wrapId);
            var info = document.createElement('span');
            info.className = 'pg-info';
            info.textContent = statPages[d.key] + ' / ' + totalPages + '（共' + d.list.length + '条）';
            var next = document.createElement('button');
            next.textContent = '下一页';
            next.disabled = statPages[d.key] === totalPages;
            next.onclick = (function (key, wrapId) {
              return function () {
                if (statPages[key] < totalPages) { statPages[key]++; renderStatTables(key); scrollStatWrap(wrapId); } /* R235 */
              };
            })(d.key, d.wrapId);
            pager.appendChild(prev);
            pager.appendChild(info);
            pager.appendChild(next);
          }
        }
      });
    }
    // R14 修复：翻页后屏幕抖动/滑一下的根因 = 原先每次点上一页/下一页都 scrollIntoView({behavior:'smooth', block:'start'})
    // 强制把统计块平滑滚到视口顶部，视口就"滑一下"。现已彻底移除翻页后的强制回滚：
    // 点翻页时表格本就在视口内，保持视口纹丝不动。此函数保留仅供其他调用方兜底（当前无调用）。
    function scrollStatWrap(wrapId) {
      // no-op：翻页不再强制滚动（R14）
      return;
    }

    // 近7/30天切换：本地重绘图表，不发新请求（趋势数据已在初始化预加载，表格/总览为30天范围保持不变）
    function applyStatsDays() {
      if (!state.statsTrendAll || !state.statsTrendAll.length) { loadStats(); return; }
      var days = state.statsDays || 7;
      var trendData = state.statsTrendAll.slice(-days);
      // R57：上期趋势同样取末 N 天（与本期按索引对齐）
      var allPrev = state.statsTrendAllPrev || [];
      var trendPrev = allPrev.length ? allPrev.slice(-days) : null;
      state.statsTrend = trendData;
      state.statsTrendPrev = trendPrev || null;
      renderLineChart(trendData, state.statsCmpPrev ? trendPrev : null);
      renderTrendBars(trendData, state.statsCmpPrev ? trendPrev : null);
      /* R173（用户 00:28）：删掉切日期档时对 panel-stats 的 stats-fade-in 重触发（remove+强制回流+add）
         ——正是"切换日期全页面都闪一次"的直接根因（fade 动画整页重放）；切日期只重画图表，不再全页淡入 */
    }

    // ---------- 分类管理 ----------
    // 实时计算分类资源数（一级分类含全部二级子分类汇总），并同步更新已渲染的分类行文本（不整体重渲染，避免闪烁/丢选中状态）
    function refreshCatCnts() {
      var prods = state.products || [];
      var cats = state.categories || [];
      var direct = {};
      prods.forEach(function (p) { var cid = Number(p.cid); if (cid) direct[cid] = (direct[cid] || 0) + 1; });
      var hasProds = prods.length > 0;
      var byId = {};
      cats.forEach(function (c) { byId[Number(c.id)] = c; });
      cats.forEach(function (c) { var id = Number(c.id); c.cnt = hasProds ? (direct[id] || 0) : (Number(c.cnt) || 0); });
      cats.forEach(function (c) {
        if (Number(c.parent_id) === 0 && Number(c.id) !== 0) {
          var sum = c.cnt;
          cats.forEach(function (s) { if (Number(s.parent_id) === Number(c.id)) sum += (Number(s.cnt) || 0); });
          c.totalCnt = sum;
        } else { c.totalCnt = undefined; }
      });
      if (byId[0]) byId[0].cnt = hasProds ? prods.length : (Number(byId[0].cnt) || 0);
      var box = document.getElementById('catList');
      if (box) {
        box.querySelectorAll('.cat-row').forEach(function (row) {
          var rid = row.dataset.id; if (rid === undefined || rid === null) return;
          var ref = null;
          if (String(rid).charAt(0) === 'v') { ref = byId[Number(String(rid).slice(1))] || null; }
          else { ref = byId[Number(rid)] || null; }
          if (!ref) return;
          var cntEl = row.querySelector('.c-count');
          if (cntEl) cntEl.textContent = (ref.totalCnt !== undefined ? ref.totalCnt : (ref.cnt || 0)) + ' 件资源';
        });
      }
    }

    function loadCategories() { if (window.__catLoading) { window.__catLoading.then(function () { renderCategories(state.categories); }); return window.__catLoading; }
      /* R230（老板 09-21 21:10）：分类列表首载先铺骨架（分类无分页——按常显 8 行铺，真行不足收尾） */
      var _cbox0 = document.getElementById('catList');
      if (_cbox0 && !_cbox0.children.length) { window.__catSkelP = true; renderCatSkeleton(); }
      window.__catLoading = api('admin/categories').then(function (res) { window.__catLoading = null;
      // (分类请求已合并到上一行 window.__catLoading 的 then 回调，避免重复请求)
        // 修复：失败分支也要返回 res，让 loadProducts 等调用方能正确感知失败状态
        if (!res.ok) { window.__catSkelP = false; __clearAdminSkel(_cbox0); toast(res.msg || '加载失败', 'error'); return res; }
        state.categories = orderCats((res.list || []).map(function (c) { return { id: Number(c.id), parent_id: Number(c.parent_id), name: c.name, sort: Number(c.sort) || 0, is_hidden: c.is_hidden, cnt: Number(c.cnt) || 0 }; }));
refreshCatCnts();
        window.__catSkelP = false;
        renderCategories(state.categories); return res;
      });
      // 修复（P0）：此前漏了 return，首次调用返回 undefined，loadProducts 的 (window.__catLoading || loadCategories()).then(...)
      // 直接抛 "Cannot read properties of undefined (reading 'then')"，导致资源列表/全选/分类筛选全部失效
      return window.__catLoading;
    }

    // 统一的层级排序：默认“全部”(id=0)在最前，随后每个一级分类紧跟其二级分类（同级按 sort）
    function orderCats(list) {
      var tops = list.filter(function (c) { return c.parent_id === 0; })
        .sort(function (a, b) { return (a.id === 0 ? -1 : b.id === 0 ? 1 : 0) || (a.sort || 0) - (b.sort || 0); });
      var out = [];
      tops.forEach(function (top) {
        out.push(top);
        if (top.id === 0) return;
        list.filter(function (c) { return c.parent_id === top.id; })
          .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); })
          .forEach(function (s) { out.push(s); });
      });
      // 异常：找不到父级的二级分类也补上
      list.forEach(function (c) {
        if (c.parent_id !== 0 && !out.find(function (x) { return x.id === c.id; })) out.push(c);
      });
      return out;
    }
    function renderCategories(list) {
      var box = document.getElementById('catList'); var _minH = box.offsetHeight; if (_minH > 0) box.style.minHeight = _minH + 'px';
      /* R230：骨架检测（资源页同款）——骨架行同位置替换、真行不足收尾；骨架期空数据不抢跑 */
      var __skels = box.querySelectorAll('.admin-skel'); var __reuse = __skels.length > 0;
      if (window.__catSkelP && !list.length) return;
      if (!__reuse) box.innerHTML = '';

      // 按层级分组：一级分类在前，每个一级分类下跟其二级分类
      var topLevel = list.filter(function (c) { return c.parent_id === 0; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      var ordered = [];
      topLevel.forEach(function (top) {
        ordered.push(top);
        // id=0 的"全部"是虚拟根分类，parent_id===0 表示一级分类而非"全部"的子级，
        // 跳过它，避免把所有一级分类重复当成其子分类（修复分类重复显示两个的 bug）
        if (top.id === 0) return;
        if (!ordered.some(function (x) { return x.virtual && Number(x.parent_id) === Number(top.id); }) && !list.some(function (c) { return Number(c.parent_id) === Number(top.id) && String(c.name || '').trim() === '全部'; })) { var _vt = list.find(function (x) { return Number(x.id) === Number(top.id); }); ordered.push({ id: 'v' + top.id, parent_id: top.id, name: '全部', sort: -1, virtual: true, cnt: (_vt ? (_vt.totalCnt !== undefined ? _vt.totalCnt : (_vt.cnt || 0)) : 0) }); } list.filter(function (c) { return c.parent_id === top.id; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }).forEach(function (sub) {
          ordered.push(sub);
        });
      });
      // 没有父级的（异常数据）也加上
      list.filter(function (c) { return c.parent_id !== 0 && !topLevel.find(function (t) { return t.id === c.parent_id; }); })
        .forEach(function (c) { ordered.push(c); });

      ordered.forEach(function (c, ci) {
        if (c.virtual) { var _vrow = document.createElement('div'); _vrow.className = 'cat-row cat-sub'; _vrow.dataset.id = c.id; _vrow.dataset.parentId = c.parent_id; // “全部”项不渲染选中框（固定项）
          var _vh=document.createElement('span');_vh.className='drag-handle';_vh.draggable=false;_vh.style.opacity='0.35';_vh.style.cursor='default';_vh.title='固定项不可拖动';_vh.textContent='⋮⋮';_vrow.appendChild(_vh); var _vp=document.createElement('span'); _vp.style.cssText='width:20px;flex-shrink:0;'; _vp.setAttribute('aria-hidden','true'); _vrow.appendChild(_vp); var _vnm = document.createElement('span'); _vnm.className = 'c-name'; _vnm.style.cssText = 'font-size:14px;color:#333;flex:1;text-align:left;white-space:nowrap;min-width:40px;'; _vnm.textContent = '全部'; _vrow.appendChild(_vnm); var _vmeta = document.createElement('div'); _vmeta.className = 'c-meta'; var _vph = document.createElement('span'); _vph.className = 'row-btn'; _vph.style.cssText = 'visibility:hidden;pointer-events:none;'; _vph.textContent = '固定'; _vmeta.appendChild(_vph); var _vs = document.createElement('span'); _vs.className = 'c-sort'; _vs.textContent = '排序:1'; _vmeta.appendChild(_vs); var _vcnt = document.createElement('span'); _vcnt.className = 'c-count'; _vcnt.textContent = (c.cnt || 0) + ' 件资源'; _vcnt.style.cssText = 'color:#888;cursor:pointer;'; _vcnt.title = '点击查看该分类下的资源'; _vcnt.addEventListener('click', function (e) { e.stopPropagation(); document.querySelector('.tab[data-tab="products"]').click(); initFilterCatPicker(); var _fc2 = document.getElementById('filterCat'); if (_fc2) { _fc2.value = c.parent_id; renderProducts(); } toast('已筛选分类：全部', 'success'); }); _vmeta.appendChild(_vcnt); var _vedit = document.createElement('button'); _vedit.className = 'row-btn'; _vedit.textContent = '编辑'; _vedit.style.cssText = 'visibility:hidden;pointer-events:none;'; var _vdel = document.createElement('button'); _vdel.className = 'row-btn danger'; _vdel.textContent = '删除'; _vdel.style.cssText = 'visibility:hidden;pointer-events:none;'; _vmeta.appendChild(_vedit); _vmeta.appendChild(_vdel); _vrow.appendChild(_vmeta); if (state.catExpanded[c.parent_id] === false) { _vrow.style.display = 'none'; }
          _vrow.classList.add('stagger-in'); _vrow.style.animationDelay = Math.min(ci * 20, 180) + 'ms'; /* R230：错峰淡入（资源页同款） */
          if (__reuse && __skels[ci]) __skels[ci].parentNode.replaceChild(_vrow, __skels[ci]); else box.appendChild(_vrow);
          return; }
        var row = document.createElement('div');
        row.className = 'cat-row';
        row.draggable = false;
        row.dataset.id = c.id; row.dataset.parentId = c.parent_id;
        if (Number(c.id) !== 0) { var handle = document.createElement('span'); handle.className = 'drag-handle'; handle.draggable = true; handle.title = '拖动排序'; handle.innerHTML = '⋮⋮'; row.appendChild(handle); }
        else { // 根"全部"(id=0) 固定项：用禁用手柄+固定槽位占位，保证名称列与一级分类严格对齐
          var _h0 = document.createElement('span'); _h0.className = 'drag-handle'; _h0.draggable = false; _h0.style.opacity = '0.35'; _h0.style.cursor = 'default'; _h0.title = '固定项不可拖动'; _h0.textContent = '⋮⋮'; row.appendChild(_h0);
          var _sp0 = document.createElement('span'); _sp0.style.cssText = 'width:56px;flex-shrink:0;'; _sp0.setAttribute('aria-hidden', 'true'); row.appendChild(_sp0);
        }
        var isTop = c.parent_id === 0;
        if (!isTop) row.classList.add('cat-sub'); // R22：二级行标记类（手机端缩进用类选择器，比内联属性匹配稳）

        // 拖拽事件（同级别内排序）
        row.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', c.id);
          this.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragend', function () {
          this.classList.remove('dragging');
          document.querySelectorAll('.cat-row').forEach(function (r) { r.classList.remove('drag-over'); });
        });
        row.addEventListener('dragover', function (e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          this.classList.add('drag-over');
        });
        row.addEventListener('dragleave', function () {
          this.classList.remove('drag-over');
        });
        row.addEventListener('drop', function (e) {
          e.preventDefault();
          this.classList.remove('drag-over');
          var draggedId = Number(e.dataTransfer.getData('text/plain'));
          var targetId = c.id;
          if (draggedId === targetId) return;
          reorderCategories(draggedId, targetId);
        });

        // "全部"(id=0) 为固定保底分类，不提供选中框
        if (Number(c.id) !== 0) {
          if (String(c.name || '').trim() !== '全部') { var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'cat-check';
          cb.dataset.id = c.id;
          cb.style.cssText = 'width:20px;height:20px;cursor:pointer;flex-shrink:0;accent-color:var(--blue1);';
          cb.checked = !!state.catSelected[c.id]; cb.addEventListener('change', function () { state.catSelected[c.id] = this.checked; updateCatBatchBar(); });
          row.appendChild(cb); } else { var _cbp = document.createElement('span'); _cbp.style.cssText = 'width:20px;flex-shrink:0;'; _cbp.setAttribute('aria-hidden', 'true'); row.appendChild(_cbp); }
        }

        // R120：c-meta 包裹排序/资源数/状态/操作按钮——手机端两行网格第二行（与所有行同构，列严格对齐）
        var meta = document.createElement('div');
        meta.className = 'c-meta';

        var name = document.createElement('span');
        name.className = 'c-name';
        name.style.fontWeight = isTop ? '700' : '400';
        name.style.fontSize = isTop ? '16px' : '14px';
        name.style.color = isTop ? '#1a1a1a' : '#333';
        // R25：二级名称属性对齐分类筛选面板 .cp-item.cp-sub（weight 400 / size 14px / color #333，不再压灰）；缩进由类规则 .cat-row.cat-sub .c-name 统一控制
        name.textContent = c.name;

        // 一级分类展开/收起箭头
        if (isTop && c.id !== 0) {
          var toggleBtn = document.createElement('span');
          toggleBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;cursor:pointer;margin-right:4px;color:var(--blue1);transition:transform 0.15s ease;user-select:none;filter:drop-shadow(0 1px 2px rgba(30,136,229,0.3));';
          var hasChildren = list.some(function (sub) { return sub.parent_id === c.id; }) || ordered.some(function (x) { return x.virtual && Number(x.parent_id) === Number(c.id); });
          if (hasChildren) {
            toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:100%;height:100%;display:block"><path d="M7 10l5 5 5-5z"/></svg>';
            toggleBtn.style.transform = state.catExpanded[c.id] === false ? 'rotate(-90deg)' : 'rotate(0deg)';
            toggleBtn.title = state.catExpanded[c.id] === false ? '展开子分类' : '收起子分类';
          } else {
            toggleBtn.textContent = '•';
            toggleBtn.style.cursor = 'default';
            toggleBtn.style.color = '#ccc';
          }
          toggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!hasChildren) return;
            state.catExpanded[c.id] = state.catExpanded[c.id] === false ? true : false;
            var subRows = box.querySelectorAll('.cat-row[data-parent-id="' + c.id + '"]'); subRows.forEach(function (sr) { sr.style.display = state.catExpanded[c.id] ? '' : 'none'; }); toggleBtn.style.transform = state.catExpanded[c.id] === false ? 'rotate(-90deg)' : 'rotate(0deg)'; toggleBtn.title = state.catExpanded[c.id] === false ? '展开子分类' : '收起子分类';
          });
          row.appendChild(toggleBtn);
        }

        // 二级分类：如果父级分类收起，则隐藏
        if (!isTop) {
          var parentExpanded = state.catExpanded[c.parent_id] !== false;
          if (!parentExpanded) {
            row.style.display = 'none';
          }
        }

        // 级别标签
        var levelBadge = document.createElement('span');
        levelBadge.className = 'badge ' + (isTop ? 'on' : '');
        levelBadge.style.background = c.id === 0 ? '#fff3e0' : (isTop ? '#e3f2fd' : '#f5f5f5');
        levelBadge.style.color = c.id === 0 ? '#ef6c00' : (isTop ? '#1976d2' : '#999');
        levelBadge.textContent = ''; levelBadge.style.display = 'none';

        // R82：显示/隐藏切换改用与编辑同款的胶囊按钮（点击直接切换），不再用下拉框
        if (Number(c.id) !== 0) {
          var catStatusBtn = document.createElement('button');
          catStatusBtn.className = 'row-btn status-btn ' + (c.is_hidden ? 'status-hidden' : 'status-online');
          catStatusBtn.textContent = c.is_hidden ? '隐藏' : '显示';
          catStatusBtn.title = '点击切换为' + (c.is_hidden ? '显示' : '隐藏（资源页不显示）');
          catStatusBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var nowHidden = !c.is_hidden; var prev = !!c.is_hidden; if (prev === nowHidden) return;
            c.is_hidden = nowHidden;
            this.textContent = nowHidden ? '隐藏' : '显示';
            this.classList.remove('status-online', 'status-hidden'); this.classList.add(nowHidden ? 'status-hidden' : 'status-online');
            this.title = '点击切换为' + (nowHidden ? '显示' : '隐藏（资源页不显示）');
            api('admin/categories/' + c.id, { method: 'PUT', body: JSON.stringify({ is_hidden: nowHidden }) }).then(function (res) { if (!res.ok) { c.is_hidden = prev; toast(res.msg || '更新失败', 'error'); } else { clearCache(); } });
          }); meta.appendChild(catStatusBtn);
        }

        var sort = document.createElement('span');
        sort.className = 'c-sort';
        sort.textContent = '排序:' + (ordered.filter(function (x) { return x.parent_id === c.parent_id; }).indexOf(c) + 1);

        var cnt = document.createElement('span');
        cnt.className = 'c-count';
        cnt.textContent = (c.totalCnt !== undefined ? c.totalCnt : (c.cnt || 0)) + ' 件资源';
        cnt.style.cursor = 'pointer';
        cnt.style.color = '#888';
        cnt.style.textDecoration = 'none';
        cnt.title = '点击查看该分类下的资源';
        cnt.addEventListener('click', function (e) {
          e.stopPropagation();
          // 切换到资源管理标签
          document.querySelector('.tab[data-tab="products"]').click();
          // 设置分类筛选
          initFilterCatPicker(); var filterCat = document.getElementById('filterCat');
          if (filterCat) {
            filterCat.value = c.id;
            renderProducts();
          }
          toast('已筛选分类：' + c.name, 'success');
        });

        row.appendChild(name);
        // 级别标签放到最前（复选框之后、展开箭头之前），一眼看出层级
        row.insertBefore(levelBadge, (typeof toggleBtn !== 'undefined' && toggleBtn) || (row.firstChild && row.firstChild.nextSibling && row.firstChild.nextSibling.nextSibling) || null);
        meta.appendChild(sort);
        meta.appendChild(cnt);

        if (Number(c.id) !== 0) {
          var editBtn = document.createElement('button');
          editBtn.className = 'row-btn';
          editBtn.textContent = '编辑';
          editBtn.addEventListener('click', function () { openCatEdit(c); });
          var delBtn = document.createElement('button');
          delBtn.className = 'row-btn danger';
          delBtn.textContent = '删除';
          delBtn.addEventListener('click', function () {
            showConfirm('删除分类', '删除该分类？其下资源将归入"全部"，子分类也会一并删除。', function () {
              api('admin/categories/' + c.id, { method: 'DELETE' }).then(function (res) {
                if (res && res.ok) {
                  toast('已删除', 'success'); clearCache();
                  // R178：本地即时删除（子分类一并清、其下资源归入"全部"），后台静默同步；
                  // 原先 loadCategories()+loadProducts() 两次全量重拉，慢网下要等两个网络往返
                  var _delIds = [Number(c.id)];
                  state.categories.forEach(function (x) { if (Number(x.parent_id) === Number(c.id)) _delIds.push(Number(x.id)); });
                  state.categories = state.categories.filter(function (x) { return _delIds.indexOf(Number(x.id)) === -1; });
                  (state.products || []).forEach(function (p) { if (_delIds.indexOf(Number(p.cid)) !== -1) p.cid = 0; });
                  /* R183 条7：分类删除塌缩动画（命中的行 120ms 淡出后重渲染，与资源删除同款） */
                  var __n7 = 0;
                  document.querySelectorAll('#catList .cat-row').forEach(function (r) { if (_delIds.indexOf(Number(r.dataset.id)) !== -1) { __n7++; r.style.transition = 'opacity var(--dur-fast, .10s) ease'; r.style.opacity = '0'; } });
                  setTimeout(function () {
                    renderCategories(state.categories);
                    refreshCatCnts(); renderProducts(); initFilterCatPicker();
                    silentSyncCategories(); silentSyncProducts();
                  }, __n7 ? 120 : 0);
                }
                else toast(res.msg || '删除失败', 'error');
              });
            });
          });
          meta.appendChild(editBtn);
          meta.appendChild(delBtn);
        }
        else { // 根"全部"(id=0)：右侧用隐藏占位对齐状态框/按钮列（与虚拟"全部"行同一套占位方式，保证列对齐）
          var _ph0 = document.createElement('span'); _ph0.className = 'row-btn'; _ph0.style.cssText = 'visibility:hidden;pointer-events:none;'; _ph0.textContent = '固定'; _ph0.setAttribute('aria-hidden', 'true'); meta.appendChild(_ph0);
          var _pe0 = document.createElement('button'); _pe0.className = 'row-btn'; _pe0.textContent = '编辑'; _pe0.style.cssText = 'visibility:hidden;pointer-events:none;';
          var _pd0 = document.createElement('button'); _pd0.className = 'row-btn danger'; _pd0.textContent = '删除'; _pd0.style.cssText = 'visibility:hidden;pointer-events:none;';
          meta.appendChild(_pe0); meta.appendChild(_pd0);
        }

        row.appendChild(meta);
        row.classList.add('stagger-in'); row.style.animationDelay = Math.min(ci * 20, 180) + 'ms'; /* R230：错峰淡入（资源页同款 20ms/项 180ms 封顶） */
        if (__reuse && __skels[ci]) __skels[ci].parentNode.replaceChild(row, __skels[ci]); else box.appendChild(row);
        box.style.minHeight = '';
      });
      /* R230：真实条数少于骨架数时收尾移除多余骨架（资源页同款） */
      if (__reuse) { for (var __cj = ordered.length; __cj < __skels.length; __cj++) { if (__skels[__cj] && __skels[__cj].parentNode) __skels[__cj].parentNode.removeChild(__skels[__cj]); } }
    }

    setTimeout(function () { var _cb = document.getElementById('catList'); if (_cb) { _cb.classList.remove('prod-fade'); void _cb.offsetWidth; _cb.classList.add('prod-fade'); } }, 10);
    document.getElementById('addCatBtn').addEventListener('click', function () { openCatEdit(null); });    document.getElementById('catSelectAll').addEventListener('change', function () { var on = this.checked; document.querySelectorAll('.cat-check').forEach(function (cb) { cb.checked = on; state.catSelected[Number(cb.dataset.id)] = on; }); updateCatBatchBar(); });

    // ---------- 分类批量操作 ----------
    function updateCatBatchBar() {
      var checks = document.querySelectorAll('.cat-check:checked');
      var count = checks.length;
      var bar = document.getElementById('catBatchBar');
      document.getElementById('catBatchCount').textContent = count;      var allBox = document.getElementById('catSelectAll'); if (allBox) allBox.checked = count > 0 && count === document.querySelectorAll('.cat-check').length;
      bar.classList.toggle('show', count > 0);
    }
    // 批量隐藏
    document.getElementById('catBatchHide').addEventListener('click', function () {
      var ids = Array.from(document.querySelectorAll('.cat-check:checked')).map(function (cb) { return Number(cb.dataset.id); }).filter(function (id) { return !isNaN(id); });
      if (ids.length === 0) return;
      showConfirm('批量隐藏', '确定隐藏选中的 ' + ids.length + ' 个分类？隐藏后资源页不显示。', function () {
        batchCatAction(ids, 'hide');
      });
    });
    // 批量显示
    document.getElementById('catBatchShow').addEventListener('click', function () {
      var ids = Array.from(document.querySelectorAll('.cat-check:checked')).map(function (cb) { return Number(cb.dataset.id); }).filter(function (id) { return !isNaN(id); });
      if (ids.length === 0) return;
      showConfirm('批量显示', '确定显示选中的 ' + ids.length + ' 个分类？', function () {
        batchCatAction(ids, 'show');
      });
    });
    // 批量删除
    document.getElementById('catBatchDel').addEventListener('click', function () {
      var ids = Array.from(document.querySelectorAll('.cat-check:checked')).map(function (cb) { return Number(cb.dataset.id); }).filter(function (id) { return !isNaN(id); });
      if (ids.length === 0) return;
      showConfirm('批量删除', '确定删除选中的 ' + ids.length + ' 个分类？其下资源将归入"全部"，子分类也会一并删除，不可恢复。', function () {
        batchCatAction(ids, 'delete');
      });
    });
    // 取消选择
    document.getElementById('catBatchCancel').addEventListener('click', function () {
      document.querySelectorAll('.cat-check:checked').forEach(function (cb) { cb.checked = false; state.catSelected[Number(cb.dataset.id)] = false; });
      updateCatBatchBar();
    });
    // 执行批量操作
    function batchCatAction(ids, action) {
      if (ids.indexOf(0) !== -1) { toast('“全部”为保底根分类，不可隐藏/显示/删除', 'error'); return; }
      var targetIds = ids.slice();
      if (action === 'hide' || action === 'show') {
        ids.forEach(function (pid) {
          state.categories.forEach(function (c) {
            if (c.parent_id === pid && targetIds.indexOf(c.id) === -1) targetIds.push(c.id);
          });
        });
      }
      var done = 0, fail = 0;
      ids = targetIds; // 后续遍历/完成判定统一使用级联后的集合
      ids.forEach(function (id) {
        var req;
        if (action === 'hide') {
          req = api('admin/categories/' + id, { method: 'PUT', body: JSON.stringify({ is_hidden: true }) });
        } else if (action === 'show') {
          req = api('admin/categories/' + id, { method: 'PUT', body: JSON.stringify({ is_hidden: false }) });
        } else {
          req = api('admin/categories/' + id, { method: 'DELETE' });
        }
        req.then(function (res) {
          if (res.ok) done++; else fail++;
          if (done + fail === ids.length) {
            var actionName = action === 'hide' ? '隐藏' : (action === 'show' ? '显示' : '删除');
            toast('批量' + actionName + '完成：成功 ' + done + ' 项，失败 ' + fail + ' 项', fail > 0 ? 'error' : 'success');
            clearCache();
            // R178：本地即时生效（隐藏/显示/删除按级联集合），后台静默同步；
            // 原先 loadCategories()（+删除时 loadProducts()）全量重拉，慢网下要等网络往返
            var __after7 = function () {
              renderCategories(state.categories);
              refreshCatCnts();
              silentSyncCategories();
              if (action === 'delete') silentSyncProducts();
            };
            if (action === 'delete') {
              var _gone = ids.slice();
              state.categories.forEach(function (x) { if (ids.indexOf(Number(x.parent_id)) !== -1) _gone.push(Number(x.id)); });
              state.categories = state.categories.filter(function (x) { return _gone.indexOf(Number(x.id)) === -1; });
              (state.products || []).forEach(function (p) { if (_gone.indexOf(Number(p.cid)) !== -1) p.cid = 0; });
              /* R183 条7：批量删除分类塌缩动画（与单个删除同款） */
              var __n8 = 0;
              document.querySelectorAll('#catList .cat-row').forEach(function (r) { if (_gone.indexOf(Number(r.dataset.id)) !== -1) { __n8++; r.style.transition = 'opacity var(--dur-fast, .10s) ease'; r.style.opacity = '0'; } });
              renderProducts(); initFilterCatPicker();
              setTimeout(__after7, __n8 ? 120 : 0);
            } else {
              state.categories.forEach(function (x) { if (ids.indexOf(Number(x.id)) !== -1) x.is_hidden = (action === 'hide') ? 1 : 0; });
              __after7();
            }
      ;
          }
        });
      });
    }

    function openCatEdit(c) {
      if (catDraftPending && catDraftFor === (c ? c.id : null)) { catDraftPending = false; catModalTitle.textContent = c ? '编辑分类' : '新增分类'; catMask.classList.add('open'); return; } // 遮罩关闭暂存：仅同一分类保留输入继续编辑
      state.catEditingId = c ? c.id : null;
      catModalTitle.textContent = c ? '编辑分类' : '新增分类';
      catName.value = c ? (c.name || '') : '';
      catSort.value = c ? (c.sort || 0) : 0;
      catHidden.checked = c ? !!c.is_hidden : false;

      // 所属一级分类：自制级联选择器（只显示一级分类，排除自己，面板 fixed 不裁剪）
      try { var _cpp = document.getElementById('catParentPicker'), _cph = document.getElementById('catParentValue'), _cpd = document.getElementById('catParentDisplay'), _cppan = document.getElementById('catParentPanel'); if (_cpp && _cph && _cpd && _cppan) buildCatPicker(_cpp, _cph, _cpd, _cppan, (c && c.parent_id > 0) ? (Number(c.parent_id) || 0) : 0, { topOnly: true, excludeZero: true, placeholder: '请选择所属一级分类' }); } catch (e) {}
      // 设置级别
      var isChild = c && c.parent_id > 0;
      document.querySelector('input[name="catLevel"][value="0"]').checked = !isChild;
      document.querySelector('input[name="catLevel"][value="1"]').checked = isChild;
      catParentWrap.style.display = isChild ? 'block' : 'none';
      catMask.classList.add('open');
    }

    // 级别切换：选二级时显示父级选择
    document.querySelectorAll('input[name="catLevel"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        catParentWrap.style.display = this.value === '1' ? 'block' : 'none';
        if (this.value === '1') { try { var _cpp2 = document.getElementById('catParentPicker'), _cph2 = document.getElementById('catParentValue'), _cpd2 = document.getElementById('catParentDisplay'), _cppan2 = document.getElementById('catParentPanel'); if (_cpp2 && _cph2 && _cpd2 && _cppan2) buildCatPicker(_cpp2, _cph2, _cpd2, _cppan2, 0, { topOnly: true, excludeZero: true, placeholder: '请选择所属一级分类' }); } catch (e) {} }
      });
    });

    // 分类拖拽排序（同级别内排序）
    function reorderCategories(draggedId, targetId) {
      var list = state.categories.slice();
      var dragged = list.find(function (c) { return c.id === draggedId; });
      var target = list.find(function (c) { return c.id === targetId; });
      if (!dragged || !target) return;
      if (dragged.parent_id !== target.parent_id) { toast('只能在同级别分类内排序', 'error'); return; }
      var sameLevel = list.filter(function (c) { return c.parent_id === dragged.parent_id; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      var di = sameLevel.indexOf(dragged); var ti = sameLevel.indexOf(target); if (di < 0 || ti < 0) return;
      sameLevel.splice(di, 1); sameLevel.splice(ti > di ? ti - 1 : ti, 0, dragged);
      var changed = []; sameLevel.forEach(function (c, i) { if (Number(c.sort) !== i) { c.sort = i; changed.push(c); } });
      if (!changed.length) return;
      var seq = changed.map(function (c) { return api('admin/categories/' + c.id, { method: 'PUT', body: JSON.stringify({ sort: c.sort }) }); });
      Promise.all(seq).then(function (reses) {
        if (reses.every(function (r) { return r && r.ok; })) {
          toast('排序已更新', 'success'); clearCache();
          // R178：拖拽后本地已是目标顺序，静默同步替代 loadCategories() 全量重拉
          state.categories = orderCats(state.categories);
          renderCategories(state.categories);
          silentSyncCategories();
        }
        else toast('排序保存失败', 'error');
      });
    }

    var catSaving = false;
    var catDraftPending = false; // 分类弹窗：遮罩关闭暂存输入，取消/保存后丢弃
    var catDraftFor = null; // 暂存对应的分类 id（防止打开其他分类时误保留）
    catOk.addEventListener('click', function () {
      if (catSaving) return; // 防重复提交
      catSaving = true; // 立即锁定，防止快速双击
      catOk.disabled = true;
      catOk.style.opacity = '0.6';

      var name = catName.value.trim();
      var sort = Number(catSort.value) || 0;
      var isChild = document.querySelector('input[name="catLevel"]:checked').value === '1';
      var parentId = isChild ? Number(document.getElementById('catParentValue') ? document.getElementById('catParentValue').value : 0) || 0 : 0;
      var isHidden = catHidden.checked;
      if (!name) {
        toast('请填写分类名称', 'error');
        catSaving = false;
        catOk.disabled = false;
        catOk.style.opacity = '';
        return;
      }
      if (isChild && !parentId) {
        toast('请选择所属一级分类', 'error');
        catSaving = false;
        catOk.disabled = false;
        catOk.style.opacity = '';
        return;
      }
      var data = { name: name, sort: sort, parent_id: parentId, is_hidden: isHidden };
      // 修复：原先在请求发出前就提示"保存成功"并关闭弹窗，失败时造成"假成功"；提示与关窗移到成功分支
      var _catOkText = catOk.textContent;
      if (window.__btnBusy) window.__btnBusy(catOk, '确定中…'); /* R183 条4：忙碌转圈 */
      var req = state.catEditingId
        ? api('admin/categories/' + state.catEditingId, { method: 'PUT', body: JSON.stringify(data) })
        : api('admin/categories', { method: 'POST', body: JSON.stringify(data) });

      req.then(function (res) {
        catSaving = false;
        catOk.disabled = false;
        catOk.style.opacity = '';
        catOk.textContent = _catOkText;
        if (res && res.ok) {
          catDraftPending = false; catMask.classList.remove('open');
          toast('分类已保存', 'success'); if (window.__haptic) window.__haptic(); /* R183 条12 */
          clearCache();
          // R178：本地即时更新分类面板（不等 loadCategories 重拉的网络往返）；
          // 编辑=合并字段重排，新增=后端返回 id 时本地插入（拿不到 id 才退回重拉）
          var _ce = state.catEditingId
            ? (state.categories || []).find(function (x) { return Number(x.id) === Number(state.catEditingId); })
            : null;
          if (_ce) {
            Object.assign(_ce, { name: name, sort: sort, parent_id: parentId, is_hidden: isHidden ? 1 : 0 });
            state.categories = orderCats(state.categories);
          } else if (res.id) {
            state.categories.push({ id: Number(res.id), name: name, sort: sort, parent_id: parentId, is_hidden: isHidden ? 1 : 0, cnt: 0 });
            state.categories = orderCats(state.categories);
          }
          if (_ce || res.id) {
            renderCategories(state.categories);
            refreshCatCnts();
            renderProducts(); // 资源行的分类名/筛选口径同步本地生效
            initFilterCatPicker();
            silentSyncCategories();
          } else {
            loadCategories();
          }
        } else {
          toast(res.msg || '保存失败', 'error');
        }
      }).catch(function () {
        catSaving = false;
        catOk.disabled = false;
        catOk.style.opacity = '';
        catOk.textContent = _catOkText;
        toast('保存失败，请重试', 'error');
      });
    });

    catCancel.addEventListener('click', function () { catDraftPending = false; catMask.classList.remove('open'); });
    catMask.addEventListener('click', function (e) { if (e.target === catMask) { catDraftPending = false; catDraftFor = null; catMask.classList.remove('open'); } }); // R145：点外=取消（丢输入）；R217：恢复（R215 误删）

    // ---------- 平台设置：修改密码（弹窗形式） ----------
    var pwdMask = document.getElementById('pwdMask');
    // 点击"修改密码"按钮弹出弹窗
    document.getElementById('showPwdFormBtn').addEventListener('click', function () {
      // R111：不在打开时清空——×/取消=丢弃（清三框）；点外/Esc=暂存，重开自动回填
      pwdMask.classList.add('open');
    });
    // 点击"关闭"按钮关闭弹窗
    document.getElementById('cancelPwdBtn').addEventListener('click', function () {
      document.getElementById('oldPwd').value = ''; document.getElementById('newPwd').value = ''; document.getElementById('confirmPwd').value = ''; // 取消=丢弃输入
      pwdMask.classList.remove('open');
    });
    // 点击遮罩关闭弹窗
    pwdMask.addEventListener('click', function (e) {
      if (e.target === pwdMask) pwdMask.classList.remove('open'); // R217：恢复点外关闭（R215 误删）
    });
    // 确定修改密码
    document.getElementById('changePwdBtn').addEventListener('click', function () {
      if (this.disabled) return; /* R231 条26：防连点 */
      var oldPwd = document.getElementById('oldPwd').value;
      var newPwd = document.getElementById('newPwd').value;
      var confirmPwd = document.getElementById('confirmPwd').value;
      if (!oldPwd || !newPwd || !confirmPwd) { toast('请填写完整密码信息', 'error'); return; }
      if (newPwd !== confirmPwd) { toast('两次输入的新密码不一致', 'error'); return; }
      var _cpBtn = this, _cpTxt = this.textContent;
      _cpBtn.disabled = true; if (window.__btnBusy) window.__btnBusy(_cpBtn, '修改中…'); /* R231 条26 */
      api('admin/password', { method: 'POST', body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }) })
        .then(function (res) {
          _cpBtn.disabled = false; _cpBtn.textContent = _cpTxt;
          if (res && res.ok) {
            toast('密码已修改', 'success');
            document.getElementById('oldPwd').value = ''; document.getElementById('newPwd').value = ''; document.getElementById('confirmPwd').value = ''; /* R231：成功后清空输入，重开弹窗无残留 */
            pwdMask.classList.remove('open');
          } else {
            toast(res.msg || '修改失败（原密码可能不正确）', 'error');
          }
        }).catch(function () {
          _cpBtn.disabled = false; _cpBtn.textContent = _cpTxt;
          toast('修改失败：网络错误', 'error');
        });
    });

    // ---------- 退出 ----------
    logoutBtn.addEventListener('click', function () {
      logoutBtn.classList.add('active'); // R39：确认弹窗打开期间变白（复用资源页顶栏分享键 .active 白底蓝字）
      showConfirm('退出登录', '确定要退出管理页吗？', function () {
        api('admin/logout', { method: 'POST' });
        localStorage.removeItem(TOKEN_KEY);
        showLogin();
      });
    });
    // R39：确认弹窗关闭后移除退出键白底（与弹窗开合同步；机制复用资源页 R20 顶栏分享/客服键的 observer+兜底轮询）
    (function () {
      function sync() {
        var cm = document.getElementById('confirmMask');
        if (!cm || !cm.classList.contains('open')) logoutBtn.classList.remove('active');
      }
      var mo = new MutationObserver(sync);
      var cm = document.getElementById('confirmMask');
      if (cm) mo.observe(cm, { attributes: true, attributeFilter: ['class'] });
      setInterval(sync, 800); // 兜底轮询：observer 意外失效时也能恢复
    })();

    // ---------- 资源搜索 ----------
    // R183 条17：清除搜索键（与前台 ✗ 同款；空态另有「清除搜索」按钮）
    /* R186 建议1：搜索历史下拉（值为空 focus 时显示，复用 tab 胶囊 + 灰圆小 ×）；
       本脚本先于 ui-common.js 加载，同步阶段组件未定义 → load 后兜底绑定 */
    (function () {
      var __bindSH = function () { window.bindSearchHist(document.querySelector('.tb-row2 .admin-search'), document.getElementById('adminSearch'), 'adminSearchHist'); };
      if (window.bindSearchHist) __bindSH(); else window.addEventListener('load', __bindSH);
    })();
    document.getElementById('adminSearchClear').addEventListener('click', function () {
      var inp = document.getElementById('adminSearch');
      inp.value = '';
      this.classList.remove('show');
      adminPage = 1;
      renderProducts();
      inp.focus();
    });

    // ---------- 表单字段清除红色边框 ----------
    bindFieldClear(fTitle);
    attachLiveCheck(fTitle, '请填写资源标题'); /* R193c ⑨（23:26 修正：只留红框）：标题必填实时校验（blur/输入空即红框） */
    bindFieldClear(fCid);
    /* R193c ⑨：分类实时校验——下拉面板开过又收起仍未选择（0/空）即红框提示；
       选择成功在 onProductCidChange 清红框，填上立即消 */
    (function () {
      var picker = document.getElementById('fCidPicker');
      var disp = document.getElementById('fCidDisplay');
      if (!picker || !disp || !fCid) return;
      var opened = false;
      var mo = new MutationObserver(function () {
        if (picker.classList.contains('open')) { opened = true; return; }
        // R209（用户 09-19 00:46）：根因→实时校验把 cid=0（「全部」）当未选；修法→放开 cid=0，只校验 undefined/null/空字符串
        if (opened) { opened = false; var _cv = fCid.value; if (_cv === '' || _cv === undefined || _cv === null) showFieldErr(disp, '请选择资源分类'); }
      });
      mo.observe(picker, { attributes: true, attributeFilter: ['class'] });
    })();
    bindFieldClear(fDesc);
    bindFieldClear(fImg);
    bindFieldClear(vName);
    bindFieldClear(vTitle);

    // ---------- 统计时间筛选 ----------
    // R65：「对比上期」开关（默认关闭只显示本期）——点击切换后重渲染卡片/折线/柱状与图例，不重新发请求
    state.statsCmpPrev = false;
    var _cmpBtn = document.getElementById('cmpPrevBtn');
    if (_cmpBtn) _cmpBtn.addEventListener('click', function () {
      state.statsCmpPrev = !state.statsCmpPrev;
      this.classList.toggle('cmp-on', state.statsCmpPrev);
      // R69：文字随状态切换——关闭态=对比上期（点击开启对比），开启态=显示本期（点击退回只看本期）；配色：蓝=应用键色、开启态淡蓝
      this.textContent = state.statsCmpPrev ? '显示本期' : '对比上期';
      var _ll = document.querySelector('.line-legend'); if (_ll) _ll.classList.toggle('show-prev', state.statsCmpPrev);
      var _tl = document.querySelector('.trend-legend'); if (_tl) _tl.classList.toggle('show-prev', state.statsCmpPrev);
      // 卡片小字
      if (state.statsOverview) renderStatCards(state.statsOverview, state.statsOverviewPrev || null);
      // 折线/柱状（数据已存 state，直接重渲染）
      if (state.statsTrend && state.statsTrend.length) {
        renderLineChart(state.statsTrend, state.statsCmpPrev ? state.statsTrendPrev : null);
        renderTrendBars(state.statsTrend, state.statsCmpPrev ? state.statsTrendPrev : null);
      }
    });
    document.querySelectorAll('.time-btn[data-days]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.time-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        state.statsDays = Number(this.dataset.days) || 7;
        document.getElementById('statStartDate').value = '';
        document.getElementById('statEndDate').value = '';
        if (state.statsDays === 1) {
          // R29（优化项8）：1天档请求当天单日数据（按小时展示）；R176：日期改北京时间口径
          var _td = __bjToday();
          loadStats(_td, _td, 1);
        } else {
          // R176（用户 10:16）：极致响应两段式——①趋势全量已在 state，先本地即时重绘两图
          //（点击瞬间图表就切到 7/30 天视图，零等待）；②同时发对应范围请求，回来后六卡片+
          // 两图+三表全部按新档刷新（旧 loadStats() 无参被短路只重绘两图，六卡永不更新）
          if (state.statsTrendAll && state.statsTrendAll.length) applyStatsDays();
          var _r7 = __statsRangeDays(state.statsDays);
          loadStats(_r7.start, _r7.end, 1);
        }
      });
    });
    // 自定义日期范围（最多只能查询最近30天，全系统统一）
    document.getElementById('statCustomBtn').addEventListener('click', function () {
      var s = document.getElementById('statStartDate').value;
      var e = document.getElementById('statEndDate').value;
      if (!s || !e) { toast('请选择开始和结束时间', 'error'); return; }
      if (s.slice(0, 10) > e.slice(0, 10)) { toast('开始时间不能晚于结束时间', 'error'); return; }
      // 计算30天前的日期（R176：北京时间口径，旧 UTC 在北京 0-8 点会误拦/放错一天）
      var maxStartMs = Date.parse(__bjToday() + 'T00:00:00Z') - 29 * 86400000;
      var maxStartStr = new Date(maxStartMs).toISOString().slice(0, 10);
      if (s.slice(0, 10) < maxStartStr) {
        toast('最多只能查询最近30天的数据，已自动调整开始时间', 'warn');
        document.getElementById('statStartDate').value = maxStartStr + ' 00:00';
        s = maxStartStr + ' 00:00';
      }
      document.querySelectorAll('.time-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      loadStats(s, e);
    });

    // ---------- 导出 CSV ----------
    document.getElementById('exportBtn').addEventListener('click', exportAllData);
    // 导出资源码解锁记录
    var exportResourceBtn = document.getElementById('exportResourceBtn');
    // 解锁记录已并入统一导出，无需单独按钮

    // ---------- 资源预览（贴近资源页：含类型切换、类型价格） ----------
    var previewCurVariant = 0;
    // ---------- 媒体放大灯箱（与资源页统一：图片/视频点击放大、双指缩放） ----------
    var _lbMask = null;
    function openLightbox(src) {
      if (!_lbMask) {
        _lbMask = document.createElement('div');
        _lbMask.className = 'lightbox';
        _lbMask.onclick = closeLightbox;
        document.body.appendChild(_lbMask);
      }
      _lbMask.textContent = ''; var _lbx = document.createElement('button'); _lbx.type = 'button'; _lbx.className = 'modal-close-x'; _lbx.textContent = '×'; _lbx.onclick = closeLightbox; _lbMask.appendChild(_lbx);
      var isVideo = /\.(mp4|webm|ogv|m3u8)(\?|#|$)/i.test(src) || /video|\.m3u8/i.test(src);
      var m = document.createElement(isVideo ? 'video' : 'img');
      m.src = src;
      if (isVideo) { m.controls = true; m.autoplay = true; m.playsInline = true; }
      /* R21：灯箱视频固定 16:9 占位（黑底 contain），未加载/加载完成尺寸一致，不从小变大跳动 */
      m.style.cssText = 'max-width:92%;max-height:92%;object-fit:contain;border-radius:8px;transition:transform .05s linear;' + (isVideo ? 'width:92%;aspect-ratio:16/9;background:#000;' : '');
      _lbMask.appendChild(m);
      _lbMask.style.display = 'flex';
      _lbMask.classList.add('open');
      if (window.__modalKit) window.__modalKit.register(_lbMask, { discard: closeLightbox, stash: closeLightbox }); /* R186 建议3：进统一弹窗栈——Esc/返回键逐层关闭 */
    }
    function closeLightbox() { if (_lbMask) { try { _lbMask.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) {} _lbMask.style.display = 'none'; _lbMask.classList.remove('open'); } }
    (function () {
      var scale = 1, startDist = 0;
      document.addEventListener('touchstart', function (e) {
        if (!_lbMask || !_lbMask.classList.contains('open')) return;
        if (e.touches.length === 2) startDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }, { passive: true });
      document.addEventListener('touchmove', function (e) {
        if (!_lbMask || !_lbMask.classList.contains('open')) return;
        if (e.touches.length === 2 && startDist > 0) {
          var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          scale = Math.min(4, Math.max(1, scale * (d / startDist)));
          var el = _lbMask.querySelector('img, video');
          if (el) el.style.transform = 'scale(' + scale + ')';
          startDist = d;
          e.preventDefault();
        }
      }, { passive: false });
      document.addEventListener('touchend', function () { startDist = 0; });
      document.addEventListener('dblclick', function (e) {
        if (!_lbMask || !_lbMask.classList.contains('open')) return;
        if (_lbMask.contains(e.target)) { scale = 1; var el = _lbMask.querySelector('img, video'); if (el) el.style.transform = 'scale(1)'; }
      });
    })();

    function fmtPrice(v) {
      var n = Number(v) || 0;
      return n > 0 ? '¥' + (n === Math.floor(n) ? n : n.toFixed(2)) : '';
    }
    function renderPreviewVariant() {
      var variants = state.variants || [];
      var basePrice = Number(fPrice.value) || 0;
      var priceEl = document.getElementById('previewPrice');
      var detailEl = document.getElementById('previewVariantDetail');
      if (variants.length === 0) { priceEl.textContent = fmtPrice(basePrice); detailEl.innerHTML = ''; initPvResourceSection(null); return; }
      var v = variants[previewCurVariant] || variants[0];
      // 类型价格优先，否则用资源价格，免费不显示
      var vp = (Number(v.price) || 0) > 0 ? Number(v.price) : basePrice;
      priceEl.textContent = fmtPrice(vp);
      // R15：与资源页 renderVariantDetail 同款结构——类型标题行（名称+价格）+ 描述区
      detailEl.innerHTML = '';
      var header = document.createElement('div');
      header.className = 'variant-header';
      var vName = document.createElement('span');
      vName.className = 'variant-name';
      vName.textContent = (v.title && String(v.title).trim()) || v.name || ''; // R148：预览同前台口径，类型标题优先
      header.appendChild(vName);
      var vpText = fmtPrice(Number(v.price) || 0);
      if (vpText) {
        var vpEl = document.createElement('span');
        vpEl.className = 'variant-price';
        vpEl.textContent = vpText;
        header.appendChild(vpEl);
      }
      detailEl.appendChild(header);
      var d = document.createElement('div');
      d.className = 'v-desc';
      d.innerHTML = (v.desc && String(v.desc).trim()) ? v.desc : '该类型暂无额外说明';
      detailEl.appendChild(d);
      bindLightbox(detailEl);
      initPvResourceSection(v); // R158：预览同步资源页——类型内容区下方渲染资源码解锁区
    }
    // ---------- R158（用户 22:42）：预览同步资源页「资源码解锁区」 ----------
    // 预览=所见即所得（客户在资源页看到什么，预览就渲染什么）。但解锁是「本地比对」：
    // 输入码与当前类型（state.variants[previewCurVariant]，含未保存的本地类型表单值）的 resourceCode 比对，
    // 命中即渲染 resourceContent——全程不调 /api/unlock、不写绑定记录、不消耗绑定名额、不触发绑满换码
    // （管理员/账号持有者的测试行为不更新线上资源码）。
    function pvShowContent(v) {
      var contentEl = document.getElementById('pvResourceContent');
      if (!contentEl) return;
      contentEl.innerHTML = (v && v.resourceContent && String(v.resourceContent).trim()) ? v.resourceContent : '<p>专属内容</p>';
      bindLightbox(contentEl);
      contentEl.style.display = 'block';
      contentEl.style.animation = 'none';
      void contentEl.offsetWidth;
      contentEl.style.animation = '';
    }
    function initPvResourceSection(v) {
      var sec = document.getElementById('pvResourceSection');
      if (!sec) return;
      var errEl = document.getElementById('pvResourceError');
      var contentEl = document.getElementById('pvResourceContent');
      var inputRow = document.getElementById('pvResourceInputRow');
      var inputEl = document.getElementById('pvResourceCodeInput');
      var titleEl = document.getElementById('pvResourceTitle');
      var hasCode = !!(v && v.resourceCode && String(v.resourceCode).trim());
      var hasContent = !!(v && v.resourceContent && String(v.resourceContent).trim());
      if (!hasContent) { sec.style.display = 'none'; return; } // 与资源页 initResourceCodeSection 同口径：无专属内容整个区域隐藏
      sec.style.display = 'block';
      errEl.style.display = 'none';
      contentEl.style.display = 'none';
      contentEl.innerHTML = '';
      inputEl.value = '';
      if (hasCode) {
        titleEl.textContent = '输入资源码获取专属内容';
        inputRow.style.display = 'flex';
      } else {
        // 无码类型：资源页由服务端直接下发专属内容；预览本地直接展示（测试行为，零网络、不写统计）
        titleEl.textContent = '获取专属内容';
        inputRow.style.display = 'none';
        pvShowContent(v);
      }
    }
    function pvVerifyCode() {
      var variants = state.variants || [];
      var v = variants[previewCurVariant] || variants[0];
      if (!v) return;
      var inputEl = document.getElementById('pvResourceCodeInput');
      var errEl = document.getElementById('pvResourceError');
      var input = String(inputEl.value || '').trim();
      if (!input) {
        errEl.textContent = '请输入资源码';
        errEl.style.display = 'block';
        return;
      }
      var code = String(v.resourceCode || '').trim(); // 本地比对（与线上验码同为大小写不敏感）
      if (code && input.toUpperCase() === code.toUpperCase()) {
        errEl.style.display = 'none';
        document.getElementById('pvResourceInputRow').style.display = 'none';
        pvShowContent(v);
      } else {
        errEl.textContent = '资源码错误，请检查后重试';
        errEl.style.display = 'block';
        inputEl.style.borderColor = '#ff4444';
        setTimeout(function () { inputEl.style.borderColor = ''; }, 1500);
      }
    }
    (function () {
      var btn = document.getElementById('pvResourceCodeBtn');
      var inputEl = document.getElementById('pvResourceCodeInput');
      if (btn) btn.addEventListener('click', pvVerifyCode);
      if (inputEl) {
        inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') pvVerifyCode(); });
        // R158（用户 22:42）：输满 8 位自动解锁（资源码固定 8 位），不用点右侧「解锁」
        var __pvLast = '';
        inputEl.addEventListener('input', function () {
          var val = String(this.value || '').trim();
          if (val.length >= 8 && val !== __pvLast) { __pvLast = val; pvVerifyCode(); }
          else if (val.length < 8) { __pvLast = ''; }
        });
      }
    })();
    document.getElementById('previewProductBtn').addEventListener('click', function () {
      previewCurVariant = 0;
      document.getElementById('previewTitle').textContent = fTitle.value || '(未填写标题)';
      document.getElementById('previewDesc').textContent = fDesc.value || '';
      var __pdHtml = serializeDetail() || ''; /* R147：预览同步还原 */
      var __pdEmpty = !__pdHtml.replace(/<(br|p|div)\b[^>]*>\s*<\/(br|p|div)>/gi, '').replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, ' ').replace(/<[^>]+>/g, '').trim();
      var __pdEl = document.getElementById('previewDetail');
      if (__pdEmpty) { __pdEl.innerHTML = ''; __pdEl.style.display = 'none'; } // R158：资源页口径——无详情整块隐藏（旧版显示「暂无详细描述」占位与资源页不同步）
      else { __pdEl.innerHTML = __pdHtml; __pdEl.style.display = ''; }
      var cover = document.getElementById('previewCover');
      if (fImg.value.trim()) {
        cover.src = fImg.value.trim();
        // R173（用户 00:27）：预览封面假链接兜底——旧版加载失败显示 2px 破图（mediaStable 只清加载态不换图），
        // 与编辑表单/资源页口径统一：失败换感叹号占位符（居中显示，不再跳位置）
        cover.onerror = function () { this.onerror = null; this.src = EXC_PLACEHOLDER; if (this && this.classList) this.classList.add('media-fail'); };
        if (window.mediaStable) window.mediaStable(cover, false, true);
        cover.style.display = 'block';
      } else {
        cover.style.display = 'none';
      }
      // 渲染类型切换
      var wrap = document.getElementById('previewVariantWrap');
      var tabs = document.getElementById('previewVariantTabs');
      tabs.innerHTML = '';
      var variants = state.variants || [];
      if (variants.length >= 1) {
        wrap.style.display = 'block';
        variants.forEach(function (v, i) {
          var t = document.createElement('button');
          t.type = 'button';
          // R15：与资源页 .variant-tab 同款类样式（含 hover 浮起/选中态动画）
          t.className = 'variant-tab' + (i === 0 ? ' active' : '');
          t.textContent = v.name || ('类型' + (i + 1));
          if (v.name) t.title = v.name; // R160：截断显示不全时鼠标悬停查看全名
          t.addEventListener('click', function () {
            previewCurVariant = i;
            Array.prototype.forEach.call(tabs.children, function (c, j) {
              c.classList.toggle('active', j === i);
            });
            renderPreviewVariant();
          });
          tabs.appendChild(t);
        });
      } else {
        wrap.style.display = 'none';
      }
      renderPreviewVariant();
      var pc = document.getElementById('previewCover');
      pc.style.cursor = 'zoom-in';
      pc.onclick = function () { if (pc.src) openLightbox(pc.src); };
      bindLightbox(document.getElementById('previewDetail'));
      bindLightbox(document.getElementById('previewVariantDetail'));
      document.getElementById('previewMask').classList.add('open');
    });
    document.getElementById('previewCloseX').addEventListener('click', function () {
      document.getElementById('previewMask').classList.remove('open');try{document.querySelectorAll('#previewMask video').forEach(function(v){v.pause()})}catch(e){}
    });
    // ---------- R10 预览弹窗分享键：生成资源页分享链接并复制 ----------
    // R14：改为弹窗形式（复用 ui-common 公共分享链接弹窗，与资源页转发键同款观感）
    // 仅编辑已保存资源时可用（新增未保存没有资源 ID）；本地预览模式无部署地址，不生成链接
    document.getElementById('previewShareX').addEventListener('click', function () {
      var isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) { toast('本地预览模式，部署线上后可分享', 'error'); return; }
      if (!state.editingId) { toast('新增资源请先保存后再分享', 'error'); return; }
      var url = window.location.origin + '/shop?pid=' + state.editingId;
      if (window.showShareLinkModal) window.showShareLinkModal('分享资源', url);
      else { if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch (e) {} } toast('链接已复制到剪贴板', 'success'); }
    });
    // 咨询客服兜底弹窗：ui-common.js 加载失败时使用（样式对齐导航页，杜绝直达链接）
    // 关闭兜底客服：恢复背景视频显示并隐藏弹窗（与公共客服弹窗行为一致）
    window.__kfFbClose = function () {
      var m = document.getElementById('kfFallback');
      if (m) m.style.display = 'none';
      try { document.querySelectorAll('video').forEach(function (v) { if (v.dataset.__kfFbHid) { v.dataset.__kfFbHid = ''; v.style.visibility = ''; } }); } catch (e) {}
      if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
    };
    function openContactFallback(url) {
      var m = document.getElementById('kfFallback');
      if (!m) {
        m = document.createElement('div');
        m.id = 'kfFallback';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.76);z-index:9999;display:none;align-items:center;justify-content:center;padding:16px;';
        m.innerHTML = '<div style="background:var(--card-bg,#fff);border-radius:14px;padding:26px 22px;max-width:480px;width:100%;text-align:center;position:relative;">' +
          '<button type="button" aria-label="关闭" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:none;background:#f0f2f5;color:#666;font-size:19px;cursor:pointer;line-height:1;" onclick="window.__kfFbClose()">×</button>' +
          '<div style="font-size:22px;color:#222;margin-bottom:16px;letter-spacing:1.3px;padding:0 34px;">咨询客服</div>' +
          '<div style="width:250px;height:250px;max-width:100%;border:1px solid #eee;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border-radius:6px;"><img id="kfFallbackImg" src="/assets/images/kefu.png?v=224" alt="客服二维码" style="max-width:100%;max-height:100%;object-fit:contain;display:block;"></div>' +
          '<div style="font-size:16px;color:#666;margin-bottom:16px;letter-spacing:0.9px;">长按图片识别-添加人工客服</div>' +
          '<button type="button" data-u="" style="width:80%;border:none;border-radius:8px;padding:11px 32px;background:#01C000;color:#fff;font-size:18px;cursor:pointer;letter-spacing:0.9px;margin-bottom:14px;" onclick="var u=this.getAttribute(\'data-u\');if(u){window.open(u,\'_blank\');}">跳转-咨询在线客服</button>' +
          '<button type="button" style="background:#ff4444;color:#fff;border:none;padding:11px 32px;border-radius:8px;font-size:18px;cursor:pointer;letter-spacing:0.9px;" onclick="window.__kfFbClose()">关闭</button>' +
          '</div>';
        document.body.appendChild(m);
        m.addEventListener('click', function (e) { if (e.target === m) window.__kfFbClose(); }); /* R217：恢复点外关闭（R215 误删） */
        var im = document.getElementById('kfFallbackImg');
        if (im) im.onerror = function () { this.onerror = null; this.classList&&this.classList.add('media-fail'); this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E'; };
      }
      var jb = m.querySelector('button[data-u]');
      if (jb) jb.setAttribute('data-u', url || '');
      // 打开客服：隐藏并暂停背景视频（原生视频层级高于一切，仅暂停仍会盖住弹窗）
      // R14：同 ui-common 修复，排除所有弹窗容器内视频（预览弹窗里的视频不再被隐藏导致弹窗塌陷）
      try { document.querySelectorAll('video').forEach(function (v) { if (!v.closest('#kfFallback, .kf-mask, .modal-mask, .ann-modal, .share-mask, .lightbox')) { v.dataset.__kfFbHid = '1'; try { v.pause(); } catch (e) {} v.style.visibility = 'hidden'; } }); } catch (e) {}
      m.style.display = 'flex';
      if (window.lockBodyScroll) window.lockBodyScroll(true);
    }

    // 预览里的“咨询客服”可直接点击，验证跳转是否正确（优先当前类型客服链接，其次资源，再全局）
    document.getElementById('previewContactBtn').addEventListener('click', function () {
      var url = '';
      var variants = state.variants || [];
      var cv = variants[previewCurVariant];
      if (cv && cv.contactUrl) url = cv.contactUrl;
      if (!url) url = fContactUrl.value.trim();
      var g = document.getElementById('setContactUrl');
      if (!url && g) url = g.value.trim();
      if (url) { if (window.openContactModal) { window.openContactModal(url, '/assets/images/kefu.png?v=224', null, '跳转-咨询在线客服'); } else { openContactFallback(url); } }
      else toast('暂未配置客服链接（资源/全局都没填）', 'warn');
    });
    document.querySelector('.preview-close-btn').addEventListener('click', function () {
      document.getElementById('previewMask').classList.remove('open');try{document.querySelectorAll('#previewMask video').forEach(function(v){v.pause()})}catch(e){}
    });
    document.getElementById('previewMask').addEventListener('click', function (e) {
      if (e.target === this) { this.classList.remove('open'); try { this.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) {} } // R217：恢复点外关闭（R215 误删）
    });

    // ---------- ESC 关闭弹窗 ----------
    document.addEventListener('keydown', function (e) {
      // R111：Esc 改由 __modalKit（ui-common.js）逐层路由——只关最上层并走该层「暂存」通道；
      // 旧的一刀切全关（绕过草稿暂存/密码保留/取消回调）已废除
      // Ctrl+S 保存资源
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        /* R183 条22：Ctrl+S 覆盖全部保存弹窗——哪个弹窗开着就保存哪个（确认删除类不绑，防 Ctrl+S 误触危险操作） */
        var __csMap = [['editMask','saveProductBtn'],['annMask','saveAnnBtn'],['contactMask','saveContactBtn'],['catMask','catOk'],['batchCatMask','batchCatOk'],['variantMask','variantOk'],['inputMask','inputOk']];
        for (var ci = 0; ci < __csMap.length; ci++) {
          var __mk = document.getElementById(__csMap[ci][0]);
          if (__mk && __mk.classList.contains('open')) {
            var __sb = document.getElementById(__csMap[ci][1]);
            if (__sb && !__sb.disabled) __sb.click();
            return;
          }
        }
        var saveBtn = document.getElementById('saveProductBtn');
        if (saveBtn && saveBtn.offsetParent !== null) saveBtn.click();
      }
      // R192 二⑧：富文本编辑器基本快捷键显式化——Ctrl+B 加粗 / Ctrl+I 斜体 / Ctrl+U 下划线
      // （contenteditable 原生多已支持，显式绑定兜底防个别浏览器/输入法吃键；仅编辑器聚焦时接管）
      if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].indexOf(e.key) !== -1) {
        var __ed = document.activeElement;
        if (__ed && (__ed.classList.contains('rte-editor') || (__ed.closest && __ed.closest('.rte-editor')))) {
          e.preventDefault();
          try { document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key], false, null); } catch (e2) {}
        }
      }
      // Ctrl+Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // 撤销交由浏览器原生处理，不再自定义拦截
      }
      // Ctrl+Y 或 Ctrl+Shift+Z 重做
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        // 重做交由浏览器原生处理，不再自定义拦截
      }
    });

    // ---------- R192 二⑧：后台命令面板（Ctrl+K）----------
    // 桌面端任意界面 Ctrl+K 呼出：页面导航 / 常用操作 / 资源直达（输资源名回车直接开编辑弹窗）。
    // ↑↓ 选择、Enter 执行、Esc 关闭（已注册进 __modalKit，Esc 路由与全站弹窗一致）；
    // 任一编辑类弹窗开着时不抢键（防半开状态下乱切页面）。
    (function () {
      var mask = document.createElement('div');
      mask.className = 'cp-mask'; mask.id = 'cpMask';
      mask.innerHTML =
        '<div class="cp-box" role="dialog" aria-label="命令面板">' +
          '<input class="cp-input" id="cpInput" placeholder="搜索：页面 / 操作 / 资源名…" autocomplete="off" />' +
          '<div class="cp-list" id="cpList"></div>' +
        '</div>';
      document.body.appendChild(mask);
      var input = mask.querySelector('#cpInput'), listEl = mask.querySelector('#cpList');
      var items = [], active = 0;

      function __cpClose() { mask.classList.remove('open'); input.value = ''; input.blur(); }
      function __cpCmds() {
        var c = [
          { lab: '资源管理', tag: '页面', kw: '资源管理 资源 列表 products', run: function () { switchTab('products'); } },
          { lab: '分类管理', tag: '页面', kw: '分类管理 分类 categories', run: function () { switchTab('categories'); } },
          { lab: '数据统计', tag: '页面', kw: '数据统计 统计 数据 stats', run: function () { switchTab('stats'); } },
          { lab: '平台设置', tag: '页面', kw: '平台设置 设置 settings', run: function () { switchTab('settings'); } },
          { lab: '新增资源', tag: '操作', kw: '新增资源 新建 添加资源 add', run: function () { switchTab('products'); document.getElementById('addProductBtn').click(); } },
          { lab: '新增分类', tag: '操作', kw: '新增分类 新建分类 add', run: function () { switchTab('categories'); document.getElementById('addCatBtn').click(); } },
          { lab: '设置客服', tag: '操作', kw: '设置客服 客服 联系 contact', run: function () { switchTab('settings'); document.getElementById('openContactBtn').click(); } },
          { lab: '设置公告', tag: '操作', kw: '设置公告 公告 ann', run: function () { switchTab('settings'); document.getElementById('openAnnBtn').click(); } },
          { lab: '新增公告项', tag: '操作', kw: '新增公告项 公告 add', run: function () { switchTab('settings'); document.getElementById('addAnnBtn').click(); } },
          { lab: '修改密码', tag: '操作', kw: '修改密码 密码 pwd', run: function () { switchTab('settings'); document.getElementById('showPwdFormBtn').click(); } }
        ];
        (state.products || []).forEach(function (p) {
          c.push({ lab: '编辑：' + (p.title || '(无标题)'), tag: '资源', kw: '编辑 ' + (p.title || ''), run: function () { switchTab('products'); openEdit(p); } });
        });
        return c;
      }
      function __cpRender() {
        var kw = input.value.trim().toLowerCase();
        var all = __cpCmds();
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
          it.addEventListener('mouseenter', function () { active = i; __cpPaint(); });
          it.addEventListener('click', function () { __cpRun(i); });
          listEl.appendChild(it);
        });
      }
      function __cpPaint() {
        Array.prototype.forEach.call(listEl.querySelectorAll('.cp-item'), function (el, i) { el.classList.toggle('active', i === active); });
        var cur = listEl.querySelectorAll('.cp-item')[active]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
      }
      function __cpRun(i) { var c = items[i]; if (!c) return; __cpClose(); try { c.run(); } catch (e) { try { console.error(e); } catch (e2) {} } }

      input.addEventListener('input', function () { active = 0; __cpRender(); });
      mask.addEventListener('click', function (e) { if (e.target === mask) __cpClose(); }); /* R217：恢复点外关闭（R215 误删） */
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { active = (active + 1) % items.length; __cpPaint(); } }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { active = (active - 1 + items.length) % items.length; __cpPaint(); } }
        else if (e.key === 'Enter') { e.preventDefault(); __cpRun(active); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); __cpClose(); }
      });
      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          if (mask.classList.contains('open')) { __cpClose(); return; }
          if (document.querySelector('.modal-mask.open, .kf-mask.open, .share-mask.open, .ann-mask.open')) return;
          active = 0; __cpRender(); mask.classList.add('open'); setTimeout(function () { input.focus(); }, 0);
        }
      });
      window.addEventListener('DOMContentLoaded', function () {
        if (window.__modalKit) window.__modalKit.register(mask, { discard: __cpClose, stash: __cpClose });
      });
    })();

    // ---------- R111：弹窗三模式统一注册（×/取消=丢弃；点外/Esc=暂存） ----------
    // ui-common.js 在本文件之后加载，等 DOMContentLoaded 再注册（此时 kit 必已就绪）；
    // 各 handler 自行完成关窗；Esc 由 kit 逐层路由到最上层弹窗的「暂存」通道
    window.addEventListener('DOMContentLoaded', function () {
      var kit = window.__modalKit; if (!kit) return;
      var el = function (id) { return document.getElementById(id); };
      // 资源编辑：丢弃=清草稿；暂存=存草稿（重开自动回填；草稿为内存态，刷新即清）
      kit.register(el('editMask'), {
        discard: function () { try { clearDraft(); } catch (e) {} editMask.classList.remove('open'); },
        stash: function () { try { clearDraft(); } catch (e) {} editMask.classList.remove('open'); } // R145：Esc=丢弃
      });
      // 类型编辑 / 分类编辑：丢弃=丢输入；暂存=保留同一条目输入
      kit.register(el('variantMask'), {
        discard: function () { variantDraftPending = false; variantDraftFor = null; variantMask.classList.remove('open'); },
        stash: function () { variantDraftPending = false; variantDraftFor = null; variantMask.classList.remove('open'); } // R145：Esc=丢弃
      });
      kit.register(el('catMask'), {
        discard: function () { catDraftPending = false; catDraftFor = null; catMask.classList.remove('open'); },
        stash: function () { catDraftPending = false; catDraftFor = null; catMask.classList.remove('open'); } // R145：Esc=丢弃
      });
      // 公告设置：丢弃=恢复备份重载；暂存=保留当前编辑
      kit.register(el('annMask'), {
        discard: function () { try { window.__annDiscard(); } catch (e) {} },
        stash: function () { try { window.__annDiscard(); } catch (e) {} } // R145：Esc=丢弃（原暂存语义废除）
      });
      // 设置客服：丢弃=清输入；暂存=保留
      kit.register(el('contactMask'), {
        discard: function () { contactDraftPending = false; var _cu = el('contactUrlInput'); if (_cu) _cu.value = ''; el('contactMask').classList.remove('open'); },
        stash: function () { contactDraftPending = false; var _cu2 = el('contactUrlInput'); if (_cu2) _cu2.value = ''; el('contactMask').classList.remove('open'); } // R145：Esc=丢弃
      });
      // 修改密码：统一三模式——丢弃=清三框；暂存=保留（刷新即清）
      kit.register(el('pwdMask'), {
        discard: function () { var _o = el('oldPwd'), _n = el('newPwd'), _c = el('confirmPwd'); if (_o) _o.value = ''; if (_n) _n.value = ''; if (_c) _c.value = ''; pwdMask.classList.remove('open'); },
        stash: function () { var _o = el('oldPwd'), _n = el('newPwd'), _c = el('confirmPwd'); if (_o) _o.value = ''; if (_n) _n.value = ''; if (_c) _c.value = ''; pwdMask.classList.remove('open'); } // R145：Esc=丢弃（清三框，与×同口径）
      });
      // 确认框：四通道统一=取消语义（执行取消回调并清回调）
      var __confirmCancel = function () {
        el('confirmMask').classList.remove('open');
        if (confirmCancelCallback) { var cb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; cb(); }
        else { confirmCallback = null; confirmCancelCallback = null; }
      };
      kit.register(el('confirmMask'), { discard: __confirmCancel, stash: __confirmCancel });
      // 通用输入框：丢弃=清输入；暂存=保留输入（回调两种关闭都清）
      kit.register(el('inputMask'), {
        discard: function () { inputCallback = null; try { el('inputValue').value = ''; } catch (e) {} inputMask.classList.remove('open'); },
        stash: function () { inputCallback = null; inputMask.classList.remove('open'); }
      });
      // 绑定设备：纯展示，任何通道=直接关；R217：恢复点外关闭（R215 误删——老板原意只删下滑手势）
      var __bm = el('bindingsMask');
      if (__bm) __bm.addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });
      kit.register(__bm, { discard: function () { __bm.classList.remove('open'); }, stash: function () { __bm.classList.remove('open'); } });
      // 预览：直接关 + 暂停视频
      var __pm = el('previewMask');
      var __previewClose = function () { if (__pm) { __pm.classList.remove('open'); try { __pm.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) {} } };
      kit.register(__pm, { discard: __previewClose, stash: __previewClose });
      // 批量改分类：直接关
      var __bc = el('batchCatMask');
      var __bcClose = function () { if (__bc) __bc.classList.remove('open'); };
      kit.register(__bc, { discard: __bcClose, stash: __bcClose });
    });

    // ---------- PWA Service Worker 注册：已收编至 ui-common.js 全站统一注册（R34） ----------

  
    // ---------- 初始化 ----------
    boot();

/* ===== R102→R167：截断文字悬停/点按小框 #uiTip 已收编至 ui-common.js（全站四页统一） =====
   本段原 R102/R105/R106/R165 的 admin 专属实现整体迁出，行为不变（悬停/点按、白名单、
   单行截断容器 clippedX 分支），白名单扩展前台截断元素（.card-title/.card-desc/.shop-name/.variant-tab），
   弹窗开合经 syncBodyLock 自动隐藏小框。样式在 ui-common.css #uiTip。 */
