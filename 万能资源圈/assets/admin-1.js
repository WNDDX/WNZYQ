/* v346 条1/12：后台按功能拆分 第1/5 段（由原 admin.js 物理切分；为支持拆分，已去掉最外层"圈屋"包裹，逻辑与拆分前一致） */
/* v336（条7）：变量圈屋开始 */
    /* ============================================
       管理页逻辑
       ============================================ */

    // ---------- 登录按钮事件委托兜底：即使下方任意脚本运行时出错，登录按钮依然可用 ----------
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('#loginBtn') : null;
      if (b && !window.__loginDirect && typeof doLogin === 'function') { try { doLogin(); } catch (err) { if (window.__silent) window.__silent(err); } }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var ae = document.activeElement; if (ae && (ae.id === 'loginUser' || ae.id === 'loginPass') && !window.__loginDirect && typeof doLogin === 'function') { try { doLogin(); } catch (err) { if (window.__silent) window.__silent(err); } } }
    });

    // R180（用户 09-16）：根因→密码输入框缺可见性切换；修法→追加眼睛图标按钮（R209 用户 09-19 00:34：登录框恢复 09-16 结构时一并恢复）
    // R209（用户 09-19 00:34）：根因→修法
    // R217 条3（老板 09-21）：两态黑白 SVG——旧实现点击后换成 🙈/👁 彩色 emoji（R215 只换了静态态），
    // 现在点击前后都是 stroke=currentColor 的黑白线条图标：开眼=显示密码、眼+斜线=隐藏密码
    // R231（用户 09-21 23:38）条9：rte 放大/还原按钮 ⛶/🗕 emoji 换全站统一 stroke 2px 线性 SVG（样式 .rte-zoom-ico 见 admin.css）
    var RTE_SVG_MAX = '<svg class="rte-zoom-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
    var RTE_SVG_MIN = '<svg class="rte-zoom-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>';
    var PWD_EYE_OPEN_SVG = '<svg class="pwd-eye-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 5C7 5 2.73 8.11 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-3.04 0-5.5-2.46-5.5-5.5S8.96 6.5 12 6.5 17.5 8.96 17.5 12 15.04 17.5 12 17.5zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>'; /* R285 条15：小眼睛统一实心画风（与下箭头实心三角一套体系） */
    var PWD_EYE_OFF_SVG = '<svg class="pwd-eye-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 5C7 5 2.73 8.11 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-3.04 0-5.5-2.46-5.5-5.5S8.96 6.5 12 6.5 17.5 8.96 17.5 12 15.04 17.5 12 17.5zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M4.47 3.06 20.94 19.53l-1.41 1.41L3.06 4.47z"/></svg>';
    /* R304 P18（用户 09-30 02:00 拍板「列表和管理页用小图」）：小图 URL 由原图派生——图仓图片
       （/img/images/…/uuid.ext）的固定小图为同目录 uuid_t.webp（上传封面时前端 canvas 生成、
       与原图同请求一起存储；后台 loadProducts 后自动给存量旧图补生成，见 backfillCoverThumbs）。
       外链图派生不出小图，原样返回，读取侧无差别处理。 */

    // v296（用户 10-04 02:44）：安全修复——把 shop.js 的 sanitizeHTML 复用到 admin.js
    // 富文本展示前过滤恶意代码（script/事件/javascript:协议/expression样式等）
    function sanitizeHTML(html) { return window.__sanitizeHTML ? window.__sanitizeHTML(html) : ""; } /* v336 条4：与前台同一套标准 */
    var thumbOf = function (url) { return window.__thumbOf(url); }; /* v356 条22：合并至公共层唯一源 */

    /* R304 P18（用户 09-30 02:00）：存量旧图自动补生成小图——管理页拉到列表后，对本页图仓封面
       逐张探测派生小图是否存在：HEAD 200 记 localStorage 下次跳过；404 → 下载原图 canvas 生成
       （最大边 400px、webp、质量 0.8）→ POST /api/admin/upload-image（mode=thumb）补传到同目录
       uuid_t.webp。全链路静默：任何失败不影响界面，下次访问再试；每次最多处理一页 20 张。 */
    function backfillCoverThumbs(list) {
      try {
        var seen = {};
        try { (JSON.parse(localStorage.getItem('wnzyq_thumb_ok') || '[]') || []).forEach(function (u) { seen[u] = 1; }); } catch (e0) { if (window.__silent) window.__silent(e0); }
        var urls = [];
        (list || []).forEach(function (p) {
          var u = String((p && p.img) || '');
          if (/^\/img\/images\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i.test(u) && !seen[u] && urls.indexOf(u) < 0) urls.push(u);
        });
        if (!urls.length) return;
        var markOk = function (u) {
          try {
            var arr = JSON.parse(localStorage.getItem('wnzyq_thumb_ok') || '[]') || [];
            if (arr.indexOf(u) < 0) { arr.push(u); if (arr.length > 500) arr = arr.slice(-500); localStorage.setItem('wnzyq_thumb_ok', JSON.stringify(arr)); }
          } catch (e0) { if (window.__silent) window.__silent(e0); }
        };
        urls.slice(0, 20).forEach(function (u) {
          fetch(thumbOf(u), { method: 'HEAD', cache: 'no-store' }).then(function (r) {
            if (r && r.ok) { markOk(u); return null; }
            if (!r || r.status !== 404) return null; /* 网络异常：下次进后台再试 */
            return fetch(u, { cache: 'no-store' }).then(function (ir) { return (ir && ir.ok) ? ir.blob() : null; }).then(function (blob) {
              if (!blob) return null;
              return new Promise(function (resolve) {
                var objUrl = URL.createObjectURL(blob);
                var im = new Image();
                im.onload = function () {
                  try {
                    var scale = Math.min(1, 400 / Math.max(im.naturalWidth || 1, im.naturalHeight || 1));
                    var w = Math.max(1, Math.round(im.naturalWidth * scale)), h = Math.max(1, Math.round(im.naturalHeight * scale));
                    var c = document.createElement('canvas');
                    c.width = w; c.height = h;
                    c.getContext('2d').drawImage(im, 0, 0, w, h);
                    URL.revokeObjectURL(objUrl);
                    c.toBlob(function (tb) { resolve(tb || null); }, 'image/webp', 0.8);
                  } catch (e1) { URL.revokeObjectURL(objUrl); resolve(null); }
                };
                im.onerror = function () { URL.revokeObjectURL(objUrl); resolve(null); };
                im.src = objUrl;
              });
            }).then(function (tb) {
              if (!tb) return null;
              var fd = new FormData();
              fd.append('mode', 'thumb');
              fd.append('base', u.replace(/^\/img\//, ''));
              fd.append('file', tb, 'thumb.webp');
              return fetch('/api/admin/upload-image', { method: 'POST', body: fd, credentials: 'include' }).then(function (r2) {
                if (r2 && r2.ok) markOk(u);
              }).catch(function () {});
            });
          }).catch(function () {});
        });
      } catch (e) { if (window.__silent) window.__silent(e); }
    }

    function togglePwdVisibility() {
      var pwd = document.getElementById('loginPass');
      var btn = document.getElementById('pwdToggleBtn');
      if (!pwd || !btn) return;
      if (pwd.type === 'password') { pwd.type = 'text'; btn.innerHTML = PWD_EYE_OFF_SVG; btn.setAttribute('aria-label', '隐藏密码'); }
      else { pwd.type = 'password'; btn.innerHTML = PWD_EYE_OPEN_SVG; btn.setAttribute('aria-label', '显示密码'); }
    }

    // v306（用户 10-05 02:24）：修改密码弹窗小眼睛复用登录页 SVG 图标
    function toggleModalPwdVisibility(inputId, btnId) {
      var pwd = document.getElementById(inputId);
      var btn = document.getElementById(btnId);
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
    var EXC_PLACEHOLDER = window.WN_MEDIA_FALLBACK; /* v349 条7：占位图统一取公共层一份（原先这里整段抄了一遍，改一处漏一处） */
    document.addEventListener('error', function (e) {
      var t = e.target;
      if (!t || !t.tagName) return;
      if (t.tagName === 'IMG' && !t.dataset.fh && !t.dataset.lf) { /* v345 条3：由页面自己接管的图片不抢 */
        t.dataset.fh = '1';
        t.src = EXC_PLACEHOLDER; if (t && t.classList) t.classList.add('media-fail');
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
            vd.innerHTML = '<svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg>'; /* R285 条17：× 文字符号换固定 SVG */
            vd.addEventListener('click', function (ev) {
              ev.preventDefault(); ev.stopPropagation();
              var card = vd.closest('.video-fallback');
              if (card) {
                var ed = card.closest('[contenteditable=\"true\"]');
                card.remove();
                if (ed) { try { ed.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) { if (window.__silent) window.__silent(e2); } }
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
    document.addEventListener('load', function (e) { var t = e.target; if (!t || !t.tagName || t.tagName !== 'IMG' || t.dataset.fh || t.dataset.lf) return; if (t.naturalWidth === 0 && String(t.getAttribute('src') || '').indexOf('data:') !== 0) { t.dataset.fh = '1'; t.src = EXC_PLACEHOLDER; if (t && t.classList) t.classList.add('media-fail'); t.style.display = 'block'; t.style.opacity = '1'; } }, true);
    document.querySelectorAll('img').forEach(function (im) { if (im.dataset.lf) return; if (im.complete && im.naturalWidth === 0 && im.getAttribute('src') && im.getAttribute('src').indexOf('data:') !== 0) { im.dataset.fh = '1'; im.src = EXC_PLACEHOLDER; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block'; } });

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
      try { if (!contactDraftPending && window.__plSet) document.getElementById('contactUrlInput').value = document.getElementById('setContactUrl').value || ''; } catch (e) { if (window.__silent) window.__silent(e); }
      try { contactDraftPending = false; } catch (e) { if (window.__silent) window.__silent(e); }
      try { document.getElementById('contactMask').classList.add('open'); } catch (e) { if (window.__silent) window.__silent(e); }
     if (!window.__plSet) {
        api('admin/settings').then(function (res) {
          try {
            if (res && res.ok && document.getElementById('contactMask').classList.contains('open') && !contactDraftPending) {
              var v = (res.settings || {}).contact_url || '';
              document.getElementById('contactUrlInput').value = v;
              document.getElementById('setContactUrl').value = v;
            }
          } catch (e) { if (window.__silent) window.__silent(e); }
        }).catch(function () {});
      }
    }
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('#openContactBtn, #addCatBtn, #addAnnBtn') : null;
      if (!btn) return;
      if (btn.id === 'openContactBtn') { try { if (!document.getElementById('contactMask').classList.contains('open')) openContactSetting(); } catch (e) { try { document.getElementById('contactMask').classList.add('open'); } catch (e2) { if (window.__silent) window.__silent(e2); } } }
      else if (btn.id === 'addCatBtn') { try { if (!document.getElementById('catMask').classList.contains('open')) openCatEdit(null); } catch (e) { try { document.getElementById('catMask').classList.add('open'); } catch (e2) { if (window.__silent) window.__silent(e2); } } }
      else if (btn.id === 'addAnnBtn') { try { addNewAnnouncement(); } catch (e) { if (window.__silent) window.__silent(e); } }
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
      inputValue.placeholder = placeholder || '请输入内容'; /* R285 条38：兜底口径「动作+对象」 */
      inputValue.value = defaultValue || '';
      inputCallback = callback;
      // R36：媒体插入统一弹窗——uploadKind('image'/'video') 时显示输入框右侧的本地上传按钮，
      // 网络地址与本地上传共用这一个输入框；弹窗关闭后按钮随 CSS 隐藏（#inputMask:not(.open)）
      // v320（用户 10-05 22:37）：uploadKind='file' 时启用文件弹窗分支
      var fileExtras = document.getElementById('fileInputExtras');
      if (uploadKind === 'file') {
        inputRow.classList.add('has-upload');
        inputUploadBtn.textContent = '上传本地文件';
        inputUploadBtn.dataset.kind = 'file';
        if (fileExtras) fileExtras.style.display = 'block';
      } else if (uploadKind) {
        inputRow.classList.add('has-upload');
        inputUploadBtn.textContent = uploadKind === 'video' ? '上传本地视频' : '上传本地图片';
        inputUploadBtn.dataset.kind = uploadKind;
        if (fileExtras) fileExtras.style.display = 'none';
      } else {
        inputRow.classList.remove('has-upload');
        if (fileExtras) fileExtras.style.display = 'none';
      }
      inputMask.classList.add('open');
      setTimeout(function () { inputValue.focus(); }, 100);
    }

    // R36：本地上传按钮——选文件 → 上传 → 链接填进输入框 → 自动确定插入
    inputUploadBtn.addEventListener('click', function () {
      var kind = inputUploadBtn.dataset.kind;
      // v328（用户 10-06 15:37）：文件上传分支——点按钮直接弹文件选择框（可多选），极简无二级菜单
      if (kind === 'file') {
        var inp = document.createElement('input');
        inp.type = 'file'; inp.multiple = true;
        inp.addEventListener('change', function () {
          var files = Array.from(inp.files || []);
          var editor = __rte.editor || document.getElementById('fDetail');
          processLocalFiles(files, editor, null);
        });
        inp.click();
        return;
      }
      var inp = document.createElement('input');
      inp.type = 'file';
      if (kind === 'video') inp.accept = 'video/mp4,video/webm,video/quicktime';
      else inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        var _origText = inputUploadBtn.textContent;
        inputUploadBtn.disabled = true;
        var cancelBtn = null;
        /* v351：原「取消键 + 百分比文字」由统一队列面板接管（面板自带取消 × 与失败重试） */
        var done = function (url, note) {
          inputUploadBtn.disabled = false;
          if (cancelBtn && cancelBtn.parentNode) cancelBtn.parentNode.removeChild(cancelBtn);
          // R307：size_limit 死分支已清（全系统上传大小限制均已取消，上传链不再产生该标记）
          if (url) {
            inputUploadBtn.textContent = '✓ 完成';
            inputUploadBtn.style.background = 'var(--green-strong)';
            setTimeout(function () { inputUploadBtn.textContent = _origText; inputUploadBtn.style.background = ''; }, 1200);
            inputValue.value = url;
            if (note) toast(note, 'info');
            inputOk.click(); // 上传完成自动确定（等于手填链接后点确定）
          } else {
            inputUploadBtn.textContent = _origText;
          }
        };
        /* v351 A1-A3：本地上传统一走队列面板——进度条（不显示百分比）/ 可取消 / 失败可重试；图片、视频、文件同一套 */
        window.__upman.run(f, kind === 'video' ? 'video' : 'file', {
          onDone: function (url) { done(url); },
          onFail: function () {
            inputUploadBtn.disabled = false;
            inputUploadBtn.textContent = _origText;
          },
          onCancel: function () {
            inputUploadBtn.disabled = false;
            inputUploadBtn.textContent = _origText;
          }
        });
      });
      inp.click();
    });

    var __inputBusy = false;
    function _resetInputBtn() {
      inputOk.disabled = false; inputOk.textContent = '确定';
      __inputBusy = false;
    }
    window.closeInput = function () {
      _resetInputBtn();
      inputMask.classList.remove('open');
    };
    inputOk.addEventListener('click', function () {
      if (__inputBusy) return;
      var val = inputValue.value;
      inputOk.disabled = true;
      if (window.__btnBusy) window.__btnBusy(inputOk, '处理中');
      __inputBusy = true;
      var _timer = setTimeout(function () { _resetInputBtn(); inputMask.classList.remove('open'); }, 10000);
      var _done = function () { clearTimeout(_timer); window.closeInput(); };
      if (inputCallback) { var cb = inputCallback; inputCallback = null; cb(val, _done); }
    });
    inputCancel.addEventListener('click', function () {
      if (__inputBusy) return;
      try { if (window.__fcSweepEdit) window.__fcSweepEdit(inputMask); } catch (e) {} /* v354：丢弃输入弹窗=这次传的没用上的文件追删（后端核对引用，绝不误删） */
      inputMask.classList.remove('open');
      inputCallback = null;
    });
    inputMask.addEventListener('click', function (e) {
      if (__inputBusy) return;
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
    /* v333 清理：这里原本取 id="vDesc"（页面里根本没有这个元素，真正的类型说明编辑器是 id="vDescEditor"），
       而且这个变量声明之后从来没被用过 —— 属于陈旧残留，直接删除。 */
    var vHidden = document.getElementById('vHidden');
    // 类型图片/视频已并入“类型描述”编辑器，不再单独设字段
    var vContactUrl = document.getElementById('vContactUrl');
    var vPrice = document.getElementById('vPrice');
    var vSort = document.getElementById('vSort');
    var variantOk = document.getElementById('variantOk');
    var variantCancel = document.getElementById('variantCancel');

    // v294（用户 10-04 02:14）：223 价格输入校验——只能数字和最多一个小数点，过滤非法字符
    function __sanitizePriceInput(el) {
      if (!el) return;
      el.addEventListener('input', function () {
        var v = this.value;
        var hasDot = false;
        var out = '';
        for (var i = 0; i < v.length; i++) {
          var ch = v.charAt(i);
          if (ch >= '0' && ch <= '9') { out += ch; }
          else if (ch === '.' && !hasDot) { out += ch; hasDot = true; }
        }
        if (v !== out) this.value = out;
      });
    }
    __sanitizePriceInput(fPrice);
    __sanitizePriceInput(vPrice);

    // 改密码弹窗

    // 占位图统一使用 EXC_PLACEHOLDER（见上方定义），IMG_PLACEHOLDER 保留兼容旧引用
    var IMG_PLACEHOLDER = EXC_PLACEHOLDER; // 兼容旧引用，统一人形剪影占位（v339 全站恢复）
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

    // R276：admin 页 sessionStorage 缓存（刷新秒显 + 后台 diff 更新）
    function __getAdminCache() {
      try { var c = JSON.parse(sessionStorage.getItem('wnzyq_admin_data') || '{}'); return c || {}; } catch (e) { return {}; }
    }
    function __setAdminCache(obj) {
      try { sessionStorage.setItem('wnzyq_admin_data', JSON.stringify(obj)); } catch (e) { if (window.__silent) window.__silent(e); }
    }
    function __saveAdminState() {
      __setAdminCache({
        products: state.products,
        categories: state.categories,
        settings: state.settings || {},
        statsOverview: state.statsOverview,
        statsOverviewPrev: state.statsOverviewPrev,
        statsTrend: state.statsTrend,
        statsTrendPrev: state.statsTrendPrev,
        statsDays: state.statsDays,
        statByProduct: state.statByProduct,
        statByCategory: state.statByCategory,
        statRecent: state.statRecent,
        version: state._homeVersion || '',
        _cacheFormat: 'sch' + String((window.WN_CONST && window.WN_CONST.CACHE_SCHEMA) || 4), // v346 条4：缓存格式标记改读全站常量（原硬编码 v317，与前台 CACHE_SCHEMA 两套并存）
        timestamp: Date.now()
      });
    }

    // ---------- toast 轻提示 ----------
    /* R231（用户 09-21 23:38）条11：跟资源页同款队列——抽公共到 ui-common.js window.uiToast
       （排队逐条展示，每条 2s + 0.3s 淡出），观感 .ui-toast 公共类带下落入场；
       原「新顶掉旧」单条模式废弃。error 红，success/info 走默认蓝 */
    function toast(msg, type) { window.uiToast(msg, type); }
    window.toast = toast;
    window.showToast = window.showToast || toast; /* v346 条1/14：公共层多处判断 window.showToast，后台此前只挂 toast → 提示静默失效；这里补挂同名，两边统一 */

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
    var __confirmBusy = false;
    function _resetConfirmBtn() {
      var okBtn = document.getElementById('confirmOk');
      okBtn.disabled = false; okBtn.textContent = '确定';
      __confirmBusy = false;
    }
    window.closeConfirm = function () {
      _resetConfirmBtn();
      document.getElementById('confirmMask').classList.remove('open');
    };
    // R307 U5（用户 09-30）：请求失败/超时那一刻立即停转——输入/确认弹窗的确定按钮立即复位，
    // 不再空转到 10 秒；失败提示由调用方既有逻辑先弹出来，弹窗本身保持 10 秒自动关
    // （比 8 秒请求超时晚 2 秒，让失败提示先弹、弹窗再关）
    window.__maskBusyReset = function () {
      try { if (__inputBusy) _resetInputBtn(); } catch (e) { if (window.__silent) window.__silent(e); }
      try { if (__confirmBusy) _resetConfirmBtn(); } catch (e) { if (window.__silent) window.__silent(e); }
    };
    document.getElementById('confirmOk').addEventListener('click', function () {
      if (__confirmBusy) return;
      var okBtn = document.getElementById('confirmOk');
      var _origText = okBtn.textContent;
      okBtn.disabled = true;
      if (window.__btnBusy) window.__btnBusy(okBtn, '处理中');
      __confirmBusy = true;
      var _timer = setTimeout(function () { _resetConfirmBtn(); document.getElementById('confirmMask').classList.remove('open'); }, 10000);
      var _done = function () { clearTimeout(_timer); window.closeConfirm(); };
      if (confirmCallback) { var cb = confirmCallback; confirmCallback = null; confirmCancelCallback = null; cb(_done); }
    });
    document.getElementById('confirmCancel').addEventListener('click', function () {
      if (__confirmBusy) return;
      document.getElementById('confirmMask').classList.remove('open');
      if (confirmCancelCallback) { var cb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; cb(); }
      else { confirmCallback = null; confirmCancelCallback = null; }
    });
    document.getElementById('confirmMask').addEventListener('click', function (e) {
      if (__confirmBusy) return;
      if (e.target === this) { // R217：恢复点外关闭（R215 误删）——点外=取消，与取消键同口径
        this.classList.remove('open');
        if (confirmCancelCallback) { var cb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; cb(); }
        else { confirmCallback = null; confirmCancelCallback = null; }
      }
    });

    // 滚动锁已取消（用户要求恢复自由滚动）：不再锁定页面滚动，弹窗/编辑器放大时页面仍可自由滚动
    (function () { window.__syncBodyLock = function () {}; window.__syncBodyLock(); })();
    (function () {
  function _r(){ document.querySelectorAll('.rte-editor.rte-large').forEach(function(e){ e.classList.remove('rte-large'); e.style.top=''; e.style.height=''; }); document.querySelectorAll('.rte-toolbar-large').forEach(function(e){ e.classList.remove('rte-toolbar-large'); }); document.querySelectorAll('.rte-zoom-on').forEach(function(e){ e.classList.remove('rte-zoom-on'); e.innerHTML=RTE_SVG_MAX; }); if(window.__rteRO&&window.__rteRO.disconnect){ try{ window.__rteRO.disconnect(); }catch (e) { if (window.__silent) window.__silent(e); } } } // R231 条9：emoji→SVG
  window.__resetRteAll=_r;
  // R144（用户 23:52）：放大态重置只挂在"编辑器宿主弹窗"关闭时——原实现对任意弹窗打开都重置，
  // 导致放大态下点插入图片/视频（inputMask 打开）编辑器就自动缩小；inputMask 层级本就高于放大态
  // （ui-common.css #inputMask z-index 6002 > rte-large 6000），插入操作全程保持放大
  ['editMask','variantMask','annMask'].forEach(function(id){
    var m = document.getElementById(id); if (!m) return;
    new MutationObserver(function(){ if (!m.classList.contains('open')) _r(); }).observe(m, { attributes: true, attributeFilter: ['class'] });
  });
})();
    // ========== R248：全系统「编辑中」检测 + localStorage 草稿保护（防自动刷新丢内容） ==========
    (function () {
      var DRAFT_KEY = 'wnzyq_editing_draft';
      // 检测当前是否有编辑中状态（弹窗打开且内容有改动）
      window.__isEditing = function () {
        if (document.getElementById('editMask') && document.getElementById('editMask').classList.contains('open')) return true;
        if (document.getElementById('variantMask') && document.getElementById('variantMask').classList.contains('open')) return true;
        if (document.getElementById('annMask') && document.getElementById('annMask').classList.contains('open')) return true;
        if (document.getElementById('contactMask') && document.getElementById('contactMask').classList.contains('open')) return true;
        return false;
      };
      // 保存所有编辑中内容到 localStorage（供刷新前调用）
      window.__saveEditingDraft = function () {
        try {
          var drafts = [];
          // 公告弹窗草稿
          if (document.getElementById('annMask') && document.getElementById('annMask').classList.contains('open')) {
            try { if (typeof flushAnnEdit === 'function') flushAnnEdit(); } catch (e) { if (window.__silent) window.__silent(e); }
            var _ac = stateAnn && stateAnn.curId ? stateAnn.list.find(function (x) { return x.id === stateAnn.curId; }) : null;
            drafts.push({ type: 'ann', curId: stateAnn ? stateAnn.curId : null, list: stateAnn ? JSON.parse(JSON.stringify(stateAnn.list)) : null, mode: document.getElementById('annMode') ? document.getElementById('annMode').value : null });
          }
          // 资源编辑弹窗草稿
          if (document.getElementById('editMask') && document.getElementById('editMask').classList.contains('open')) {
            try { if (typeof saveDraft === 'function') saveDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
            drafts.push({ type: 'edit', data: __editDrafts ? JSON.parse(JSON.stringify(__editDrafts)) : null });
          }
          // 类型编辑弹窗草稿（若未来需要可扩展）
          if (document.getElementById('variantMask') && document.getElementById('variantMask').classList.contains('open')) {
            /* v333 修：原取 id="vDesc"（不存在）→ _ve 恒为 null，类型弹窗的草稿保护等于没生效
               （写了一半的类型说明不会被暂存，刷新/误关即丢）。改成真正的编辑器 id。 */
            var _ve = document.getElementById('vDescEditor');
            drafts.push({ type: 'variant', id: (typeof state !== 'undefined' && state.editingVariantId) || null, name: document.getElementById('vName') ? document.getElementById('vName').value : '', title: document.getElementById('vTitle') ? document.getElementById('vTitle').value : '', desc: _ve ? _ve.innerHTML : '' });
          }
          // 客服弹窗草稿
          if (document.getElementById('contactMask') && document.getElementById('contactMask').classList.contains('open')) {
            drafts.push({ type: 'contact', url: document.getElementById('contactUrlInput') ? document.getElementById('contactUrlInput').value : '' });
          }
          if (drafts.length) localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), drafts: drafts }));
        } catch (e) { if (window.__silent) window.__silent(e); }
      };
      // 恢复草稿（页面加载后调用），返回是否恢复了内容
      window.__restoreEditingDraft = function () {
        try {
          var raw = localStorage.getItem(DRAFT_KEY); if (!raw) return false;
          var pkg = JSON.parse(raw); if (!pkg || !pkg.drafts || !pkg.drafts.length) return false;
          // v294（用户 10-04 02:14）：133 草稿30分钟过期
          if (pkg.savedAt && (Date.now() - pkg.savedAt) > 30 * 60 * 1000) {
            localStorage.removeItem(DRAFT_KEY); return false;
          }
          localStorage.removeItem(DRAFT_KEY);
          var restored = false;
          pkg.drafts.forEach(function (d) {
            if (d.type === 'ann' && typeof stateAnn !== 'undefined' && stateAnn && d.list) {
              stateAnn.list = d.list; stateAnn.loaded = true; stateAnn.curId = d.curId || null;
              stateAnn._draftRestored = true; // R248：标记列表来自草稿恢复，供 openAnnBtn 选中恢复项而非默认公告
              stateAnn._skipNextFlush = true; // R248：跳过恢复后首次 flush，防止 reload 后编辑器里的旧默认内容污染恢复数据
              if (d.mode && document.getElementById('annMode')) { document.getElementById('annMode').value = d.mode; try { syncSelectDisplay(document.getElementById('annMode')); } catch (e) { if (window.__silent) window.__silent(e); } }
              restored = true;
            }
            if (d.type === 'edit' && __editDrafts && d.data) {
              Object.keys(d.data).forEach(function (k) { __editDrafts[k] = d.data[k]; });
              restored = true;
            }
            if (d.type === 'variant' && d.id !== undefined) {
              // variant 草稿在弹窗打开时由 openVariantEdit 自行消费
              try { localStorage.setItem('wnzyq_variant_draft', JSON.stringify(d)); } catch (e) { if (window.__silent) window.__silent(e); }
              restored = true;
            }
            if (d.type === 'contact' && document.getElementById('contactUrlInput')) {
              document.getElementById('contactUrlInput').value = d.url || '';
              restored = true;
            }
          });
          if (restored) setTimeout(function () { try { toast('已恢复你编辑中的内容', 'info', 'info', 3000); } catch (e) { if (window.__silent) window.__silent(e); } }, 600);
          return restored;
        } catch (e) { try { localStorage.removeItem(DRAFT_KEY); } catch (e2) { if (window.__silent) window.__silent(e2); } return false; }
      };
      // 清理草稿键（保存成功后调用）
      window.__clearEditingDraft = function () {
        try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem('wnzyq_variant_draft'); } catch (e) { if (window.__silent) window.__silent(e); }
      };
    })();
    // 弹窗右上角×按钮统一关闭（事件委托）
    document.addEventListener('click', function (e) {
      var closeBtn = e.target.closest('.modal-close-x, .modal-close[data-close]');
      if (closeBtn && closeBtn.dataset.close) {
        var mask = document.getElementById(closeBtn.dataset.close);
        if (closeBtn.dataset.close === 'editMask') { try { clearDraft(); } catch (e) { if (window.__silent) window.__silent(e); } } // ×=取消：丢弃草稿
        if (closeBtn.dataset.close === 'catMask') { catDraftPending = false; catDraftFor = null; } // ×=取消：丢弃分类草稿
        if (closeBtn.dataset.close === 'variantMask') { variantDraftPending = false; variantDraftFor = null; } // ×=取消：丢弃类型草稿
        if (closeBtn.dataset.close === 'annMask') { try { window.__annDiscard(); } catch (e) { if (window.__silent) window.__silent(e); } } // ×=取消：R145 全量恢复（数据+编辑器+频率+列表），见 annDiscard
        if (closeBtn.dataset.close === 'contactMask') { contactDraftPending = false; var _cu=document.getElementById('contactUrlInput'); if(_cu)_cu.value=''; } // ×=取消：清空输入
        if (closeBtn.dataset.close === 'pwdMask') { var _o=document.getElementById('oldPwd'),_n=document.getElementById('newPwd'),_c=document.getElementById('confirmPwd'); if(_o)_o.value=''; if(_n)_n.value=''; if(_c)_c.value=''; } // ×=取消：清空密码框
        if (mask) {
          mask.classList.remove('open');
          // R111：输入弹窗×=丢弃——清输入+清回调
          if (closeBtn.dataset.close === 'inputMask') { if (__inputBusy) return; inputCallback = null; try { var _iv = document.getElementById('inputValue'); if (_iv) _iv.value = ''; } catch (e) { if (window.__silent) window.__silent(e); } }
          // R111：确认弹窗×=取消语义——执行取消回调（与点外/Esc 同口径）
          if (closeBtn.dataset.close === 'confirmMask') { if (__confirmBusy) return; if (confirmCancelCallback) { var _ccb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; _ccb(); } else { confirmCallback = null; confirmCancelCallback = null; } }
        }
      }
    });

    /* v333 清理：这段定时器原本被一字不差复制了两遍，两份都各自立即执行 —— 页面里同时跑着两条
       永不停止的 10 分钟定时链，登录满 23 小时后「登录即将过期」会连弹两次。现在只留这一条。 */
    // v294（用户 10-04 02:14）：131 登录23小时后提示即将过期
    (function checkSessionExp() {
      try {
        var lat = localStorage.getItem('wnzyq_login_at');
        if (lat) {
          var elapsed = Date.now() - Number(lat);
          var twentyThreeHours = 23 * 60 * 60 * 1000;
          var twentyFourHours = 24 * 60 * 60 * 1000;
          if (elapsed >= twentyThreeHours && elapsed < twentyFourHours) {
            toast('登录即将过期，请提前保存工作', 'warning');
          }
        }
      } catch (e) { if (window.__silent) window.__silent(e); }
      setTimeout(checkSessionExp, 10 * 60 * 1000); // 每10分钟检查一次
    })();
    // ---------- 通用请求（自动带 token，401 自动跳登录） ----------
    // 滚动锁已取消（用户要求恢复自由滚动）：即使 ui-common.js 未加载，也不再拦截 touchmove/wheel
    if (!window.lockBodyScroll) {
      window.lockBodyScroll = function (lock) {
        if (lock) { document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden'; }
        else { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; }
      };
      window.syncBodyLock = function () { window.lockBodyScroll(document.body.style.overflow === 'hidden'); };
    }
    var __apiInFlight = new Map();
    function api(path, opts) {
      opts = opts || {};
      /* v343 条5：后台取数据改走统一通道（与前台同一份核心），保留 15 秒超时与登录过期处理 */
      return window.WNApi.request('/api/' + path, {
        method: opts.method, body: opts.body, cache: opts.cache,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', timeout: opts.timeout || 15000,
        on401: function () {
          try {
            if (mainView && mainView.style.display !== 'none') {
              toast('登录已过期，请重新登录', 'error');
              setTimeout(function () { location.reload(); }, 1200);
            }
          } catch (e) { if (window.__silent) window.__silent(e); }
        }
      }).then(function (d) {
        if (d && d.ok === false && window.__maskBusyReset) { try { window.__maskBusyReset(); } catch (e) { if (window.__silent) window.__silent(e); } }
        return d;
      });
    }

    // 清除资源和分类的 API 缓存（管理员修改后调用，不阻塞主流程）
    function clearCache() {
      api('admin/clear-cache', { method: 'POST' }).catch(function () {});
      // v314（用户 10-05 15:59）：根因→后端清缓存后前端内存缓存仍保留旧数据，切换回来显示过期内容；修法→同步清前端内存缓存，下次切换立即走网络拿最新
      __adminProductCache = {};
      __adminProductCacheLoading = {};
    }

    // ---------- R221：复制即换码 ----------
    // 点复制 → 当前码记一条 issued（60 天兑换窗口起算）→ 立即出新码刷新面板
    // vObj：类型对象（含 id / resourceCode）；redraw：发码完成后的重绘回调（失败也调，用于恢复码键文本）
    function __issueCode(vObj, redraw) {
      if (!vObj || !vObj.id) { toast('参数错误：缺少资源类型', 'error'); if (redraw) { try { redraw(); } catch (e) { if (window.__silent) window.__silent(e); } } return; }
      if (window.__issueInFlight) return; /* R231 条26：同一时刻只允许一个发码请求在途（含编辑弹窗等全部调用点） */
      window.__issueInFlight = true;
      api('admin/issue-code', { method: 'POST', body: JSON.stringify({ variantId: vObj.id }) }).then(function (res) {
        window.__issueInFlight = false;
        if (res && res.ok) {
          var ok = window.__shareCopyText ? window.__shareCopyText(res.issuedCode) : false;
          vObj.resourceCode = res.code;
          // R307（用户 09-30）：发码接口不再返回 issues 遗留记录（弹窗表走 bindings 全量查询），此处不再同步
          // 同步缓存里的同 id 类型（资源列表 / 编辑弹窗共用一份数据）
          (state.products || []).forEach(function (p) {
            (p.variants || []).forEach(function (vv) { if (vv && vv.id === vObj.id) { vv.resourceCode = res.code; } });
          });
          (state.variants || []).forEach(function (vv) { if (vv && vv.id === vObj.id) { vv.resourceCode = res.code; } });
          // R227：资源管理页各产品行的码面板当场重绘（含已展开的）——发新码后页面上码的显示立即变新码，不用重新点开
          try {
            var _cps = document.querySelectorAll('.code-picker');
            for (var _i = 0; _i < _cps.length; _i++) {
              var _cp = _cps[_i];
              if (_cp.__renderCodePanel && _cp.__product && _cp.__product.variants) {
                try { _cp.__renderCodePanel(_cp.__product.variants); } catch (e0) { if (window.__silent) window.__silent(e0); }
              }
            }
          } catch (e1) { if (window.__silent) window.__silent(e1); }
          if (redraw) { try { redraw(); } catch (e) { if (window.__silent) window.__silent(e); } }
          toast(ok ? '新码已生成；旧码已复制，60 天内兑换有效（绑定后设备永久可用）'
                   : '新码已生成（复制旧码失败，请手动复制：' + res.issuedCode + '）', 'success');
        } else {
          if (redraw) { try { redraw(); } catch (e) { if (window.__silent) window.__silent(e); } }
          toast((res && res.msg) || '发码失败', 'error');
        }
      }).catch(function () {
        window.__issueInFlight = false;
        if (redraw) { try { redraw(); } catch (e) { if (window.__silent) window.__silent(e); } }
        toast('发码失败：网络错误', 'error');
      });
    }
    // 统计页筛选栏重排（独立函数，初始化时执行一次，不依赖 clearCache 调用时机）
    function initStatsFilterBar() { var _g = document.querySelector('#panel-stats .time-filter'); var _wrap = _g && _g.parentNode; var _card = document.getElementById('statCards'); if (_wrap && _card && _wrap.parentNode) { var _bar = document.createElement('div'); _bar.id = 'statsFilterBar'; _bar.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 14px;background:var(--card-bg,#fff);border-radius:10px; /* v293（用户 10-04 02:14）：054圆角统一→12px不在5档阶梯，改10px跟全站普通按钮/卡片统一 */ padding:12px 16px;box-shadow:var(--shadow-card);'; while (_wrap.firstChild) _bar.appendChild(_wrap.firstChild); _wrap.parentNode.removeChild(_wrap); _card.parentNode.insertBefore(_bar, _card.nextSibling); }
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
      backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 14l5-5 5 5z"/></svg>'; /* R285 条15：上箭头实心化（对齐下箭头实心画风） */
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
      // v319（用户 10-05 22:15）：根因→弹窗内下拉滚动穿透到 body 触发整页下拉刷新；修法→任一弹窗打开时不触发下拉刷新。
      function __anyModalOpenAdmin() {
        return document.querySelector('.modal-mask.open, .ann-modal.open, .share-mask.open, .kf-mask.open, .lightbox.open') !== null;
      }
      document.addEventListener('touchstart', function (e) {
        // R20：登录页也允许下拉刷新（原来只在 mainView 可见时启用，登录页拉不动）；未登录时刷新动作走整页 reload
        // v319：弹窗打开时禁止下拉刷新，防止滚动穿透。
        if ((window.scrollY || 0) <= 0 && !__anyModalOpenAdmin()) {
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
          pill.style.transform = 'translateY(0px)'; // R170：停在 80px 位显示「正在刷新」
          tip.querySelector('.prt').textContent = '正在刷新…';
          var loginVisible = document.getElementById('loginView') && document.getElementById('loginView').style.display !== 'none';
          if (loginVisible) { /* R20：登录页下拉刷新=整页重载（未登录无数据面板可刷新） */
            setTimeout(function () { location.reload(); }, 400);
            return;
          }
          try { if (typeof clearCache === 'function') clearCache(); } catch (e) { if (window.__silent) window.__silent(e); }
          var t = activeTab();
          // R289：用户主动下拉刷新——进入页面刷新模式，进度条可见
          if (window.__enterPageEntryMode) window.__enterPageEntryMode();
          var _refreshPromises = [];
          if (t === 'products' && typeof loadProducts === 'function') _refreshPromises.push(loadProducts().catch(function () {}));
          else if (t === 'stats' && typeof loadStats === 'function') _refreshPromises.push(loadStats(undefined, undefined, 1).catch(function () {}));
          else if (t === 'categories' && typeof loadCategories === 'function') _refreshPromises.push(loadCategories().catch(function () {}));
          else if (t === 'settings' && typeof loadSettings === 'function') _refreshPromises.push(loadSettings().catch(function () {}));
          Promise.all(_refreshPromises).then(function () {
            if (window.__exitPageEntryMode) window.__exitPageEntryMode();
          }).catch(function () {
            if (window.__exitPageEntryMode) window.__exitPageEntryMode();
          });
          setTimeout(function () { pill.style.transform = 'translateY(-48px)'; pill.style.opacity = '0'; tip.querySelector('.prt').textContent = '下拉刷新'; }, 400); // R170：完整滑回上方淡出 + 文案复位（避免下次下拉闪现「正在刷新」）
        } else {
          // 未达阈值：整体滑回上方淡出——R170：完整收回，不再裁切残缺
          pill.style.transform = 'translateY(-48px)';
          pill.style.opacity = '0';
        }
        dist = 0;
      }, { passive: true });
    })();

    // ---------- Tab 切换 ----------
    document.querySelectorAll('.tab').forEach(function (tab) {
      // R36：跳过没绑 data-tab 的按钮（防止误挂 .tab 类的按钮把 switchTab(undefined) 打成全空内容）
      if (!tab.dataset || !tab.dataset.tab) return;
      tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
    });

    function switchTab(name) {
      /* v358 S2：离开当前标签页时存滚动位置，进入新标签页恢复（所有状态内容原样回来） */
      try {
        var __cur = document.querySelector('.tab.active');
        if (__cur && __cur.dataset.tab) { window.__tabScroll = window.__tabScroll || {}; window.__tabScroll[__cur.dataset.tab] = window.scrollY || 0; }
      } catch (e) {}
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
      /* v358 S2：恢复该标签页离开时的滚动位置 */
      try { var __sv = (window.__tabScroll || {})[name]; if (typeof __sv === 'number' && __sv > 0) setTimeout(function () { try { window.scrollTo(0, __sv); } catch (e) {} }, 80); } catch (e) {}
      // v314（用户 10-05 15:59）：Tab切换立即出结果——首次加载数据，后续切回时已有数据秒显+后台静默刷新保最新。
      if (name === 'products') {
        if (!window.__plP) { window.__plP = 1; loadProducts(); }
        else { loadProducts(true).catch(function () {}); } // 切回后台静默刷新
      }
      // R173（用户 00:28）：回退 R171 的门控放宽——切 tab 只认 __plS 单条件（R170 口径）；
      // 放宽后每次切 tab 都重新拉数据+全页淡入，用户实测"更难看"
      /* v359 条2：后台滑切标签页改用全站统一手势（一套逻辑，到头自然弹回、无提示） */
      window.__bindSwipeSwitch(document, function (d) {
        var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[data-tab]'));
        if (!tabs.length) return;
        var cur = -1;
        tabs.forEach(function (t, i) { if (t.classList.contains('active')) cur = i; });
        var ni = cur + d;
        if (ni < 0 || ni >= tabs.length) return; /* 到头：不动即自然弹回 */
        switchTab(tabs[ni].dataset.tab);
      }, function () { return !document.querySelector('.modal-mask.open'); });
      if (name === 'stats') {
        if (!window.__plS) { window.__plS = 1; loadStats(); }
        else { loadStats(undefined, undefined, 1, 1).catch(function () {}); } // 切回后台静默刷新（silent=1）
      }
      if (name === 'stats') { try { if (window.__rerenderLine) window.__rerenderLine(); } catch (e) { if (window.__silent) window.__silent(e); } } // R145：面板可见后重画，轴字号按真实宽度补偿
      if (name === 'categories') {
        if (!window.__plC) { window.__plC = 1; loadCategories(); }
        else { loadCategories(true).catch(function () {}); } // 切回后台静默刷新
      }
      if (name === 'settings') { if (!window.__plSet) loadSettings(); }
    }

    // ---------- 平台设置 ----------
    function loadSettings() {
      return api('admin/settings').then(function (res) {
        if (!res.ok) { toast(res.msg || '加载失败，网络开小差了', 'error'); return; }
        var s = res.settings || {};
        window.__plSet = 1; document.getElementById('setContactUrl').value = s.contact_url || ''; if (document.getElementById('contactMask').classList.contains('open')) document.getElementById('contactUrlInput').value = s.contact_url || '';
        // 客服状态文字已按需求移除
        if (typeof stateAnn !== 'undefined' && stateAnn) {
          var _annMaskOpen = document.getElementById('annMask').classList.contains('open');
          if (!_annMaskOpen) document.getElementById('setAnnouncement').innerHTML = sanitizeHTML(s.announcement || ''); // v296（用户 10-04 02:44）：安全修复，过滤恶意代码
          // R248：公告弹窗打开时，保留当前编辑中的内容和选中项——禁止从服务器强制覆盖
          if (_annMaskOpen && typeof flushAnnEdit === 'function') flushAnnEdit();
          stateAnn.list = window.parseAnnouncements(s, { sortLevel: true });
          if (_annMaskOpen && stateAnn.curId) {
            // 若当前选中项仍存在于新列表，保持选中；否则回退到默认公告
            var _still = stateAnn.list.find(function (x) { return x.id === stateAnn.curId; });
            if (!_still) { var _dlx = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; if (_dlx) stateAnn.curId = _dlx.id; else stateAnn.curId = null; }
          }
          stateAnn.loaded = true;
          if (_annMaskOpen) { try { if (typeof renderAnnList === 'function') renderAnnList(); if (stateAnn.curId && typeof selectAnnItem === 'function') selectAnnItem(stateAnn.curId); else if (typeof clearAnnEdit === 'function') clearAnnEdit(); } catch (e) { if (window.__silent) window.__silent(e); } }
        } else {
          document.getElementById('setAnnouncement').innerHTML = sanitizeHTML(s.announcement || ''); // v296（用户 10-04 02:44）：安全修复，过滤恶意代码
        }

        document.getElementById('annMode').value = s.announcement_mode || 'always';
        syncSelectDisplay(document.getElementById('annMode')); // R166：同步自制下拉显示框
        // R135：记录已保存的显示频率——取消/×/关闭（丢弃）时据此恢复，不再保留未保存的选中值
        if (typeof stateAnn !== 'undefined' && stateAnn) stateAnn._modeSaved = s.announcement_mode || 'always';
        // R106：资源码绑定设备上限已挪到类型编辑表单（类型级），设置面板不再回填/保存该值
        state.settings = s;
        __saveAdminState();
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
      /* v330 条18：批量按钮补统一 SVG 图标（显示/隐藏/分类/价格/删除/取消） */
      var __ic = { online: 'show', offline: 'hide', changeCat: 'cat', changePrice: 'code', delete: 'del', clearSel: 'close' }[btn.dataset.action];
      if (__ic && window.__decorateBtn) window.__decorateBtn(btn, __ic, btn.dataset.pri || 5);
      btn.addEventListener('click', function () { batchAction(this.dataset.action); });
    });
    /* v330 条18：首屏与渲染后按可用宽度自适应（文字/图标） */
    setTimeout(function () { if (window.__btnFit) window.__btnFit(); }, 100);

    // ---------- 视图切换（列表/卡片） ----------
    var currentView = localStorage.getItem('wnzyq_admin_product_view') || 'list';

    function setView(view) {
      currentView = view;
      localStorage.setItem('wnzyq_admin_product_view', view);
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
    // R257：flipSetAdminView 已合并到 ui-common.js flipViewSwitch，薄封装调用
    function flipSetAdminView(view) {
      window.flipViewSwitch('productList', view, {
        btnA: 'viewCardBtn', btnB: 'viewListBtn',
        flipperKey: '__adminFlipper',
        viewClass: 'card-view', viewA: 'card',
        storageKey: 'wnzyq_admin_product_view',
        fallbackFn: setView,
        triggerAnim: triggerViewAnim,
        onChange: function (v) { currentView = v; }
      });
    }
    document.getElementById('viewListBtn').addEventListener('click', function () { flipSetAdminView('list'); });
    document.getElementById('viewCardBtn').addEventListener('click', function () { flipSetAdminView('card'); });
    // 初始化视图
    setView(currentView);
    try { initStatsFilterBar(); } catch (e) { if (window.__silent) window.__silent(e); }
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
      if (window.__btnBusy) window.__btnBusy(loginBtn, '登录中'); /* R183 条4：忙碌转圈 */
      api('admin/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })
        .then(function (res) {
          if (res && res.ok) {
            // R243 条39：登录成功记住用户名，下次自动回填
            try { localStorage.setItem('wnzyq_last_user', u); } catch (e) { if (window.__silent) window.__silent(e); }
            // R30-#4：令牌改由后端写入 HttpOnly Cookie（脚本读不到），前端不再保存 token
            // 修复：showMain 内部已统一调用 loadSettings（连同 stats/products/categories），
            // 这里不再单独调一次，避免同一接口登录后被请求两次
            if (window.__haptic) window.__haptic(); /* R183 条12：登录成功 */
            try { showMain(res.username); }
            catch (e) { setTimeout(function () { location.reload(); }, 300); }
          } else {
            // 失败路径只弹一个弹窗（此前 toast+showAlert+分支内 showAlert 会叠出两个弹窗，已修复去重）
            var _local = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            // v294（用户 10-04 02:14）：113 登录失败提示统一
            if (_local) { toast('网络开小差了，请稍后再试', 'error'); }
            else if (res._status === 429) { var waitMin = res && res.retryAfter ? Math.ceil(res.retryAfter / 60) : 10;
            toast('尝试次数过多，请 ' + waitMin + ' 分钟后再试', 'error'); } // v294：125 提示加等待时间 // v298（用户 10-04 20:30）：修复 v297 注释笔误致语法错误
            else { toast('登录失败：' + (res.msg || '网络开小差了，请稍后再试'), 'error'); }
          }
        })
        .finally(function () {
          loginBtn.disabled = false;
          loginBtn.textContent = '登录';
        });
    }
