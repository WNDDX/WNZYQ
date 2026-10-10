/* v346 条1/12：后台按功能拆分 第4/5 段（由原 admin.js 物理切分；为支持拆分，已去掉最外层"圈屋"包裹，逻辑与拆分前一致） */
// ---------- R31（优化项7）：自有图仓上传 ----------
    // 选图 → 必要时压缩（png 保无损防二维码糊；jpg/webp 超 1.5MB 或图超 2000px 转 jpeg 0.85）→ 上传 → 回调返回链接
    // R304 P18（用户 09-30 02:00「上传封面时前端 canvas 自动生成小图」）：canvas 小图生成器——
    // 最大边 400px、webp、质量 0.8；失败回 null（调用方不阻塞原图上传）。全图仓上传入口（封面/
    // 图库/编辑器插图）统一走 uploadToBucket，图仓图片统一带小图。
    function makeThumbBlob(blob, cb) {
      if (!blob) { cb(null); return; }
      try {
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
            c.toBlob(function (tb) { cb(tb || null); }, 'image/webp', 0.8);
          } catch (e) { URL.revokeObjectURL(objUrl); cb(null); }
        };
        im.onerror = function () { URL.revokeObjectURL(objUrl); cb(null); };
        im.src = objUrl;
      } catch (e) { cb(null); }
    }
    function uploadToBucket(file, cb, onProgress, task) { /* v351：第4参 task=队列任务句柄（可取消） */
      if (!file) return;
      /* v349：图片上传原来没有大小上限（视频和文件都有 25MB 硬限），
         选一张几百 MB 的图会一直转到超时为止。现在与视频/文件同口径：25MB 秒拒。 */
      var MAX_IMAGE_SIZE = 25 * 1024 * 1024;
      if (file.size > MAX_IMAGE_SIZE) {
        toast('该图片超过 25MB，暂不支持上传，请压缩后再试', 'error');
        if (cb) cb(null, 'size');
        return;
      }
      var isPng = file.type === 'image/png';
      var sizeMB = file.size / 1048576;
      var needCompress = (!isPng && sizeMB > 1.5) || sizeMB > 8;
      var send = function (fd) {
        var xhr = new XMLHttpRequest();
        if (task) task.xhr = xhr; /* v351：把请求句柄交给队列，取消=abort */
        if (onProgress) {
          xhr.upload.addEventListener('progress', function (e) {
            if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
          });
        }
        xhr.onload = function () {
          try {
            var res = JSON.parse(xhr.responseText);
            if (res && res.ok && res.url) cb(res.url);
            else { toast((res && (res.msg || res.error)) || '上传失败', 'error'); if (cb) cb(null, (res && (res.msg || res.error)) || '上传失败'); }
          } catch (e) { toast('上传失败，请重试', 'error'); if (cb) cb(null, '上传失败'); }
        };
        xhr.onerror = function () { window.__uploadXHR = null; toast('上传失败，请重试', 'error'); if (cb) cb(null, '上传失败'); };
        xhr.onabort = function () { window.__uploadXHR = null; }; /* v349：中止时清句柄，避免误停下一次上传 */
        xhr.open('POST', '/api/admin/upload-image');
        xhr.send(fd);
      };
      var go = function (blob) {
        var fd = new FormData();
        var name = file.name || ('upload.' + (String(file.type).split('/')[1] || 'png'));
        fd.append('file', blob, name);
        /* R304 P18：小图随原图同一请求提交（file2 字段，后端存为同目录 uuid_t.webp）；
           生成失败不阻塞原图上传 */
        makeThumbBlob(blob, function (tb) {
          if (tb) fd.append('file2', tb, (name.replace(/\.[^.]+$/, '') || 'upload') + '_t.webp');
          send(fd);
        });
      };
      if (!needCompress) { go(file); return; }
      /* R243 条33：PNG 走严格无损——canvas 重编码保持 PNG 格式、不缩尺寸（scale=1 原尺寸 1:1 重绘）、
         不降质量（无 quality 参数），逐像素与原图一致；与 JPG 压缩并存（非 PNG 仍走缩到 2000px + jpeg 0.85）；
         超 8MB 触发口径照旧（needCompress 判定未动）；重编码反而更大时回传原文件（原逻辑保留） */
      var img = new Image();
      var objUrl = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var scale = isPng ? 1 : Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
          var w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(objUrl);
          c.toBlob(function (blob) {
            if (blob && blob.size < file.size) go(blob); else go(file);
          }, isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.85);
        } catch (e) { URL.revokeObjectURL(objUrl); go(file); }
      };
      img.onerror = function () { URL.revokeObjectURL(objUrl); go(file); };
      img.src = objUrl;
    }

    // R36：本地视频上传（与图片同一套自有存储）
    // R308：老板拍板视频硬限 25MB——选中瞬间秒拒，一个字节未传前弹提示
    function uploadVideoToBucket(file, cb, opts) {
      if (!file) return;
      var MAX_VIDEO_SIZE = 25 * 1024 * 1024;
      if (file.size > MAX_VIDEO_SIZE) {
        toast('该视频超过 25MB，暂不支持上传，请压缩或剪辑后再试', 'error');
        return;
      }
      var fd = new FormData();
      fd.append('file', file, file.name || 'video.mp4');
      var xhr = new XMLHttpRequest();
      window.__uploadXHR = xhr;
      if (opts && opts.task) opts.task.xhr = xhr; /* v351：队列任务句柄 */
      if (opts && opts.onProgress) {
        xhr.upload.addEventListener('progress', function (e) {
          if (e.lengthComputable) opts.onProgress(Math.round(e.loaded / e.total * 100));
        });
      }
      xhr.onload = function () {
        window.__uploadXHR = null;
        try {
          var res = JSON.parse(xhr.responseText);
          if (res && res.ok && res.url) cb(res.url, res.note);
          else toast((res && (res.msg || res.error)) || '上传失败', 'error');
        } catch (e) { toast('上传失败，请重试', 'error'); }
      };
      xhr.onerror = function () { window.__uploadXHR = null; toast('上传失败，请重试', 'error'); };
      xhr.onabort = function () { window.__uploadXHR = null; };
      xhr.open('POST', '/api/admin/upload-video');
      xhr.send(fd);
    }

    // v320（用户 10-05 22:37）：文件上传——复用 IMAGE_BUCKET 通道，存到 files/ 目录
    function uploadFileToBucket(file, cb, onProgress, task) { /* v351：第4参 task */
      if (!file) return;
      var MAX_FILE_SIZE = 25 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) { cb(null, 'size'); return; }
      var fd = new FormData();
      fd.append('file', file, file.name || 'file');
      var xhr = new XMLHttpRequest();
      if (task) task.xhr = xhr; /* v351：队列任务句柄 */
      if (onProgress) {
        xhr.upload.addEventListener('progress', function (e) {
          if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
        });
      }
      xhr.onload = function () {
        try {
          var res = JSON.parse(xhr.responseText);
          if (res && res.ok && res.url) cb(res.url, null, res.key);
          else cb(null, (res && (res.msg || res.error)) || '上传失败');
        } catch (e) { cb(null, '上传失败'); }
      };
      xhr.onerror = function () { cb(null, '上传失败'); };
      xhr.open('POST', '/api/admin/upload-file');
      xhr.send(fd);
    }

    // v320：格式化文件大小
    function fmtFileSize(b) {
      if (!b || b < 0) return '0 B';
      var units = ['B','KB','MB','GB'];
      var i = 0;
      while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
      return (i === 0 ? b : b.toFixed(1)) + ' ' + units[i];
    }

    // v320：生成唯一文件卡 ID
    function genFileId() { return 'fc_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36); }

    // v320：构建文件卡 HTML（单文件或文件夹）
    // data 结构：{ id, type:'file'|'folder', name, url?, items:[{name,size,url,key}], isLink? }
    /* ===== v351：文件类型图标（全面覆盖）=====
       文档/表格/演示/图片/视频/音频/压缩包/代码/安装包/镜像/文本/种子…都有专属色标，
       没列到的扩展名走默认蓝。 */
    var FC_EXT_COLOR = {
      pdf: '#e53935',
      doc: '#1565c0', docx: '#1565c0', rtf: '#1565c0',
      xls: '#2e7d32', xlsx: '#2e7d32', csv: '#2e7d32',
      ppt: '#e07b00', pptx: '#e07b00',
      png: '#8e44ad', jpg: '#8e44ad', jpeg: '#8e44ad', webp: '#8e44ad', gif: '#8e44ad', svg: '#8e44ad', bmp: '#8e44ad', ico: '#8e44ad',
      mp4: '#c2185b', mov: '#c2185b', avi: '#c2185b', webm: '#c2185b', mkv: '#c2185b', flv: '#c2185b',
      mp3: '#00838f', wav: '#00838f', flac: '#00838f', ogg: '#00838f', m4a: '#00838f', aac: '#00838f',
      zip: '#5d4037', rar: '#5d4037', '7z': '#5d4037', tar: '#5d4037', gz: '#5d4037', bz2: '#5d4037', iso: '#5d4037',
      txt: '#546e7a', md: '#546e7a', json: '#455a64', xml: '#455a64', html: '#455a64', htm: '#455a64', js: '#455a64', css: '#455a64',
      exe: '#455a64', msi: '#455a64', apk: '#2e7d32', dmg: '#5d4037', torrent: '#455a64', psd: '#1565c0', ai: '#e07b00'
    };
    function fcFileIconSvg(name) {
      var ext = (String(name || '').split('.').pop() || '').toLowerCase();
      var color = FC_EXT_COLOR[ext] || '#5c8aef';
      var label = ext ? ext.slice(0, 4).toUpperCase() : 'FILE';
      return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="flex:none">' +
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>' +
        '<polyline points="14 2 14 8 20 8" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>' +
        '<rect x="3.2" y="13" width="13.6" height="7.2" rx="1.4" fill="' + color + '"/>' +
        '<text x="10" y="18.3" text-anchor="middle" font-size="4.6" font-weight="700" fill="#fff" font-family="Arial,sans-serif">' + label + '</text></svg>';
    }
    function fcFolderIconSvg() {
      return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f4a261" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    }
    function fcLinkIconSvg() {
      return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    }
    /* 系统同款蓝色三角（与分类栏展开/收起同一颗） */
    function fcArrowSvg() {
      return '<svg class="fc-arrow-svg toggle-arrow" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" style="flex:none"><path d="M7 10l5 5 5-5z"/></svg>';
    }
    /* 系统同款红色 ×（与关闭键同一颗） */
    function fcXSvg() {
      return '<svg class="wn-ico" width="14" height="14" aria-hidden="true"><use href="#wn-ico-x"/></svg>';
    }
    /* v351 C3：同名自动改名——第一个重复的变「名称-1.后缀」，第二个变「名称-2.后缀」，绝不覆盖 */
    function fcUniqueName(name, taken) {
      if (!taken.has(name)) return name;
      var dot = name.lastIndexOf('.');
      var base = dot > 0 ? name.slice(0, dot) : name;
      var ext = dot > 0 ? name.slice(dot) : '';
      var i = 1;
      while (taken.has(base + '-' + i + ext)) i++;
      return base + '-' + i + ext;
    }
    function fcCollectNames(listEl) {
      var set = new Set();
      if (!listEl) return set;
      listEl.querySelectorAll(':scope > .file-folder-item > .fc-row-head > .fname, :scope > .file-folder-item > .fname').forEach(function (n) { set.add(n.textContent); });
      return set;
    }
    /* 文件夹统计：N 项 · 合计大小（递归） */
    function fcFolderStats(listEl) {
      var n = 0, total = 0;
      if (!listEl) return { n: 0, total: 0 };
      listEl.querySelectorAll('.file-folder-item').forEach(function (row) {
        if (row.classList.contains('is-folder')) return;
        n++;
        var s = row.getAttribute('data-size');
        if (s) total += Number(s) || 0;
      });
      return { n: n, total: total };
    }

    /* ===== v351：统一上传管理器（进度条 + 取消 + 重试，图片/视频/文件全走这里）=====
       用法：window.__upman.run(file, 'file'|'image'|'video', { onDone(url,key), onFail(msg), onCancel() })
       面板固定在右下角，每个文件一行：图标 + 名称 + 进度条（不显示百分比）+ 取消 ×，失败变「重试」。 */
    (function () {
      if (window.__upman) return;
      var host = null;
      function ensureHost() {
        if (host) return host;
        host = document.createElement('div');
        host.className = 'upman-host';
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
        return host;
      }
      function run(file, kind, opts) {
        opts = opts || {};
        var MAXS = { file: 25 * 1024 * 1024, image: 25 * 1024 * 1024, video: 25 * 1024 * 1024 };
        var box = ensureHost();
        var row = document.createElement('div');
        row.className = 'upman-row';
        row.innerHTML =
          '<div class="upman-ico">' + fcFileIconSvg(file && file.name) + '</div>' +
          '<div class="upman-main">' +
            '<div class="upman-name">' + escapeHtml((file && file.name) || '未命名') + '</div>' +
            '<div class="upman-bar"><i></i></div>' +
            '<div class="upman-state">上传中…</div>' +
          '</div>' +
          '<button type="button" class="upman-cancel" title="取消上传">' + fcXSvg() + '</button>';
        box.appendChild(row);
        var bar = row.querySelector('.upman-bar > i');
        var state = row.querySelector('.upman-state');
        var done = false;
        var task = { xhr: null, retries: 0 };
        function finish(cls, txt) {
          done = true;
          row.classList.add(cls);
          if (state) state.textContent = txt;
          var b = row.querySelector('.upman-cancel');
          if (b) b.parentNode.removeChild(b);
          var barWrap = row.querySelector('.upman-bar');
          if (barWrap) barWrap.style.display = 'none';
          setTimeout(function () {
            row.classList.add('upman-out');
            setTimeout(function () { if (row.parentNode) row.parentNode.removeChild(row); }, 350);
          }, cls === 'upman-ok' ? 900 : 2600);
        }
        function start() {
          row.classList.remove('upman-err');
          if (state) state.textContent = '上传中…';
          var onProgress = function (p) { if (bar) bar.style.width = Math.max(6, Math.min(100, p)) + '%'; };
          var cb = function (url, err, key) {
            if (done) return;
            if (url) {
              if (bar) bar.style.width = '100%';
              finish('upman-ok', '上传完成');
              if (opts.onDone) opts.onDone(url, key);
            } else {
              row.classList.add('upman-err');
              var msg = err === 'size' ? '超过 25MB，没传上' : (err || '上传失败');
              if (state) state.textContent = msg;
              /* A3：失败一键重试 */
              if (!row.querySelector('.upman-retry')) {
                var r = document.createElement('button');
                r.type = 'button'; r.className = 'upman-retry'; r.textContent = '重试';
                r.addEventListener('click', function () { start(); });
                row.insertBefore(r, row.querySelector('.upman-cancel'));
              }
              if (opts.onFail) opts.onFail(msg);
            }
          };
          if (kind === 'image') uploadToBucket(file, function (url) { cb(url, url ? null : '上传失败'); }, onProgress, task);
          else if (kind === 'video') uploadVideoToBucket(file, function (url, err) { cb(url, err); }, { onProgress: onProgress, task: task });
          else uploadFileToBucket(file, cb, onProgress, task);
        }
        row.querySelector('.upman-cancel').addEventListener('click', function () {
          if (done) return;
          try { if (task.xhr && task.xhr.abort) task.xhr.abort(); } catch (e) {}
          done = true;
          if (row.parentNode) row.parentNode.removeChild(row);
          if (opts.onCancel) opts.onCancel();
        });
        if (file && file.size > MAXS[kind] ) {
          /* A4：超大文件在这里就被拦下，面板里标红说明，不发起上传 */
          row.classList.add('upman-err');
          if (state) state.textContent = '超过 25MB，没传上';
          setTimeout(function () { if (row.parentNode) row.parentNode.removeChild(row); }, 2600);
          if (opts.onFail) opts.onFail('size');
          return null;
        }
        start();
        return task;
      }
      window.__upman = { run: run };
    })();

    /* ===== v351：文件/文件夹卡（支持多级嵌套 · 默认收起 · 管理员/客户端双形态）===== */
    function buildFileCardHTML(data) {
      var id = escapeHtml(data.id || genFileId());
      var type = data.type || 'file';
      if (type === 'file') {
        var url = escapeHtml(data.url || '');
        var size = fmtFileSize(data.size || 0);
        var typeToggle = data.isLink ? '<button type="button" class="file-card-type-toggle" title="切换为文件夹链接" data-action="toggle-link-type">文</button>' : '';
        return '<div class="file-card-wrap" data-file-id="' + id + '" data-file-type="file" contenteditable="false">' +
          '<div class="file-card-header">' + (data.isLink ? fcLinkIconSvg() : fcFileIconSvg(data.name)) +
          '<span class="file-card-name" data-action="rename" title="点一下改名">' + escapeHtml(data.name || '未命名') + '</span>' +
          '<span class="file-card-size">' + size + '</span>' + typeToggle +
          '<span class="fc-admin-only">' +
            '<button type="button" class="fc-btn" data-action="copy-link" title="复制链接">复制</button>' +
            '<button type="button" class="fc-btn" data-action="replace-file" title="替换文件">替换</button>' +
          '</span>' +
          '<button type="button" class="file-card-del fc-admin-only" title="删除" data-action="del-card">' + fcXSvg() + '</button></div>' +
          '<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="display:none" data-dl></a></div>';
      }
      // folder（链接型走旧形态；上传型走嵌套结构）
      var isLink = !!data.isLink;
      var typeToggle2 = isLink ? '<button type="button" class="file-card-type-toggle" title="切换为文件链接" data-action="toggle-link-type">夹</button>' : '';
      var linkHidden = isLink ? '<a href="' + escapeHtml(data.url || '') + '" target="_blank" rel="noopener noreferrer" style="display:none" data-dl></a>' : '';
      var inner = isLink ? '' : fcKidsHTML(data.items || [], 0);
      return '<div class="file-card-wrap" data-file-id="' + id + '" data-file-type="folder" contenteditable="false">' +
        '<div class="file-card-header" data-action="toggle-folder">' + (isLink ? fcLinkIconSvg() : fcFolderIconSvg()) +
        '<span class="file-card-name" data-action="rename" title="点一下改名">' + escapeHtml(data.name || '未命名') + '</span>' + typeToggle2 +
        '<button type="button" class="file-card-del fc-admin-only" title="删除" data-action="del-card">' + fcXSvg() + '</button></div>' +
        inner + linkHidden + '</div>';
    }

    /* 递归渲染一个条目（file 或 folder）；adminOnly 控制管理按键是否生成 */
    function fcItemHTML(node, level) {
      var isFolder = node.ftype === 'folder';
      if (!isFolder) {
        return '<div class="file-folder-item' + (node.oversize ? ' oversize' : '') + '" data-key="' + escapeHtml(node.key || '') + '" data-size="' + (node.size || 0) + '">' +
          fcFileIconSvg(node.name) +
          '<span class="fname">' + escapeHtml(node.name || '') + '</span>' +
          '<span class="fsize">' + (node.oversize ? '超 25MB 没传上' : fmtFileSize(node.size || 0)) + '</span>' +
          '<span class="fc-admin-only">' +
            '<button type="button" class="fc-btn" data-action="copy-item" title="复制链接">复制</button>' +
            '<button type="button" class="fc-btn" data-action="replace-item" title="替换文件">替换</button>' +
          '</span>' +
          '<button type="button" class="fremove fc-admin-only" title="删除" data-action="del-item">' + fcXSvg() + '</button></div>';
      }
      var kids = node.items || [];
      var stats = fcStatsOf(kids);
      var kidsHtml = '';
      if (kids.length) {
        for (var i = 0; i < kids.length; i++) kidsHtml += fcItemHTML(kids[i], level + 1);
      } else {
        kidsHtml = '<div class="fc-empty fc-admin-only">空文件夹，点右上「＋文件」放东西进来</div>';
      }
      return '<div class="file-folder-item is-folder" data-ftype="folder">' +
        '<div class="fc-row-head">' + fcFolderIconSvg() +
          '<span class="fname" data-action="rename" title="点一下改名">' + escapeHtml(node.name || '未命名') + '</span>' +
          '<span class="fmeta">' + stats.n + ' 项' + (stats.total ? ' · ' + fmtFileSize(stats.total) : '') + '</span>' +
          '<span class="fc-admin-only">' +
            '<button type="button" class="fc-btn" data-action="add-file-here" title="往这个文件夹里加文件">＋文件</button>' +
            '<button type="button" class="fc-btn" data-action="add-folder-here" title="在这个文件夹里补个子文件夹">＋夹</button>' +
          '</span>' +
          '<button type="button" class="fremove fc-admin-only" title="删除" data-action="del-item">' + fcXSvg() + '</button>' +
          '<button type="button" class="fc-arrow" data-action="toggle-kids" title="展开/收起">' + fcArrowSvg() + '</button>' +
        '</div>' +
        '<div class="file-folder-list fc-kids" style="display:none">' + kidsHtml +
          '<div class="fc-actions fc-admin-only">' +
            '<button type="button" class="fc-btn fc-btn-strong" data-action="add-file-here">新增文件</button>' +
            '<button type="button" class="fc-btn fc-btn-strong" data-action="add-folder-here">补文件夹</button>' +
          '</div>' +
        '</div></div>';
    }
    function fcKidsHTML(items, level) {
      /* v351：根列表默认收起（整卡只露标题行，与用户要求的「默认收起」一致） */
      var html = '<div class="file-folder-list" data-folder-list style="display:none">';
      for (var i = 0; i < items.length; i++) {
        var it = items[i] || {};
        html += fcItemHTML({ ftype: it.ftype || (it.items ? 'folder' : 'file'), name: it.name, size: it.size, key: it.key, oversize: it.oversize, items: it.items }, level);
      }
      html += '<div class="fc-actions fc-admin-only">' +
        '<button type="button" class="fc-btn fc-btn-strong" data-action="add-file-here">新增文件</button>' +
        '<button type="button" class="fc-btn fc-btn-strong" data-action="add-folder-here">补文件夹</button>' +
        '</div></div>';
      return html;
    }
    function fcStatsOf(kids) {
      var n = 0, total = 0;
      function walk(arr) {
        (arr || []).forEach(function (x) {
          if (!x) return;
          if (x.ftype === 'folder' || x.items) { walk(x.items); return; }
          n++; total += Number(x.size) || 0;
        });
      }
      walk(kids);
      return { n: n, total: total };
    }

    /* v351：从文件卡 DOM 反序列化（兼容旧版扁平结构 + 新版多级嵌套） */
    function fcParseList(listEl) {
      var items = [];
      if (!listEl) return items;
      Array.prototype.forEach.call(listEl.children, function (child) {
        if (!child.classList || !child.classList.contains('file-folder-item')) return;
        if (child.classList.contains('is-folder')) {
          var kids = child.querySelector(':scope > .file-folder-list');
          items.push({ ftype: 'folder', name: (child.querySelector(':scope > .fc-row-head > .fname') || {}).textContent || '未命名', items: fcParseList(kids) });
          return;
        }
        items.push({
          ftype: 'file',
          name: child.querySelector('.fname') ? child.querySelector('.fname').textContent : '',
          size: Number(child.getAttribute('data-size')) || 0,
          key: child.getAttribute('data-key') || '',
          oversize: child.classList.contains('oversize')
        });
      });
      return items;
    }
    function parseFileCard(el) {
      var id = el.getAttribute('data-file-id') || genFileId();
      var type = el.getAttribute('data-file-type') || 'file';
      var nameEl = el.querySelector('.file-card-name');
      var name = nameEl ? nameEl.textContent : '未命名';
      if (type === 'file') {
        var a = el.querySelector('a[data-dl]');
        return { id: id, type: 'file', name: name, url: a ? a.getAttribute('href') : '' };
      }
      var list = el.querySelector('[data-folder-list]');
      if (list && list.querySelector('.file-folder-item.is-folder')) {
        return { id: id, type: 'folder', name: name, items: fcParseList(list) };
      }
      var items = [];
      if (list) {
        list.querySelectorAll('.file-folder-item').forEach(function (row) {
          if (row.classList.contains('is-folder')) return;
          items.push({
            ftype: 'file',
            name: row.querySelector('.fname') ? row.querySelector('.fname').textContent : '',
            size: Number(row.getAttribute('data-size')) || 0,
            key: row.getAttribute('data-key') || '',
            oversize: row.classList.contains('oversize')
          });
        });
      }
      return { id: id, type: 'folder', name: name, items: items };
    }
    /* ===== v351：编辑器内文件卡管理（点击/改名/复制/替换/删除/展开收起/多级增删）===== */
    function bindFileCardManagement(editor) {
      if (!editor || editor.__fileBound) return;
      editor.__fileBound = true;
      editor.addEventListener('click', function (e) {
        var target = e.target;
        var card, row, list;

        // 删除整卡
        if (target.closest('[data-action="del-card"]')) {
          card = target.closest('.file-card-wrap');
          if (card) card.parentNode.removeChild(card);
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // 复制链接（整卡）
        if (target.closest('[data-action="copy-link"]')) {
          card = target.closest('.file-card-wrap');
          var a0 = card ? card.querySelector('a[data-dl]') : null;
          var u0 = a0 ? a0.getAttribute('href') : '';
          if (u0 && window.__shareCopyText) window.__shareCopyText(location.origin + u0, '') || window.__shareCopyText(u0, '');
          if (u0) toast('链接已复制', 'success'); else toast('这个文件还没上传，没有链接可复制', 'info');
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // 替换文件（整卡）
        if (target.closest('[data-action="replace-file"]')) {
          card = target.closest('.file-card-wrap');
          fcPickAndReplace(card, null);
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // 链接卡类型切换
        if (target.closest('[data-action="toggle-link-type"]')) {
          card = target.closest('.file-card-wrap');
          if (card) {
            var curType = card.getAttribute('data-file-type') || 'file';
            var newType = curType === 'file' ? 'folder' : 'file';
            var nameSpan = card.querySelector('.file-card-name');
            var header = card.querySelector('.file-card-header');
            var toggleBtn = card.querySelector('[data-action="toggle-link-type"]');
            var a = card.querySelector('a[data-dl]');
            var url = a ? a.getAttribute('href') : '';
            card.setAttribute('data-file-type', newType);
            if (nameSpan) nameSpan.textContent = newType === 'folder' ? '文件夹链接' : '文件链接';
            if (toggleBtn) {
              toggleBtn.textContent = newType === 'folder' ? '夹' : '文';
              toggleBtn.title = newType === 'folder' ? '切换为文件链接' : '切换为文件夹链接';
            }
            var svg = header ? header.querySelector('svg') : null;
            if (svg) svg.outerHTML = fcLinkIconSvg(); // 链接卡统一用链接图标
            if (header) {
              if (newType === 'folder') header.setAttribute('data-action', 'toggle-folder');
              else header.removeAttribute('data-action');
            }
          }
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // 改名（文件卡 / 文件夹卡 / 文件夹内文件与子文件夹都支持）
        var nameEl = target.closest('[data-action="rename"]');
        if (nameEl && !nameEl.querySelector('input')) {
          fcStartRename(nameEl);
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // 展开/收起（整卡 header 或 文件夹行右侧三角）
        if (target.closest('[data-action="toggle-folder"]') || target.closest('[data-action="toggle-kids"]')) {
          var head = target.closest('.file-card-header') || target.closest('.fc-row-head');
          card = head ? head.closest('.file-card-wrap') : null;
          var kids = head ? (head.closest('.file-folder-item') ? head.parentNode.querySelector(':scope > .file-folder-list') : card.querySelector('[data-folder-list]')) : null;
          if (kids) fcToggleKids(head, kids);
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // 删除文件夹内单个条目（文件或子文件夹）
        if (target.closest('[data-action="del-item"]')) {
          row = target.closest('.file-folder-item');
          if (row) { var _pl = row.parentNode; row.parentNode.removeChild(row); if (_pl && _pl.classList.contains('file-folder-list')) fcRefreshMeta(_pl); }
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // 复制链接（文件夹内文件行）
        if (target.closest('[data-action="copy-item"]')) {
          row = target.closest('.file-folder-item');
          var key = row ? (row.getAttribute('data-key') || '') : '';
          if (key && window.__shareCopyText) window.__shareCopyText(location.origin + '/files/' + key, '');
          if (key) toast('链接已复制', 'success'); else toast('这个文件还没上传，没有链接可复制', 'info');
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // 替换文件（文件夹内文件行）
        if (target.closest('[data-action="replace-item"]')) {
          row = target.closest('.file-folder-item');
          if (row) fcPickAndReplace(null, row);
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // 往指定文件夹加文件（「＋文件」/「新增文件」共用）
        // 目标：按钮在文件夹行标题上 → 该文件夹自己的子列表；按钮在底部操作条上 → 所在列表
        if (target.closest('[data-action="add-file-here"]')) {
          var btn = target.closest('[data-action="add-file-here"]');
          var head0 = btn.closest('.fc-row-head');
          var list = head0 ? head0.parentNode.querySelector(':scope > .file-folder-list') : btn.closest('.file-folder-list');
          if (list) fcAddFilesInto(list, editor);
          e.preventDefault(); e.stopPropagation();
          return;
        }
        // 在指定文件夹里补一个子文件夹（「＋夹」/「补文件夹」共用）
        if (target.closest('[data-action="add-folder-here"]')) {
          var btn2 = target.closest('[data-action="add-folder-here"]');
          var head1 = btn2.closest('.fc-row-head');
          var list2 = head1 ? head1.parentNode.querySelector(':scope > .file-folder-list') : btn2.closest('.file-folder-list');
          if (list2) fcAddFolderInto(list2);
          e.preventDefault(); e.stopPropagation();
          return;
        }
      });
      // 键盘 Delete 删整卡
      editor.addEventListener('keydown', function (e) {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        var sel = window.getSelection();
        if (!sel.rangeCount) return;
        var node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;
        var card = node.closest ? node.closest('.file-card-wrap') : null;
        if (card && card.parentNode) { card.parentNode.removeChild(card); e.preventDefault(); }
      });

      /* v351 B1：文件/文件夹直接拖进正文就传（拖到哪插到哪） */
      editor.addEventListener('dragover', function (e) {
        if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return;
        e.preventDefault();
        editor.classList.add('fc-drop-hover');
      });
      editor.addEventListener('dragleave', function (e) {
        if (e.target === editor) editor.classList.remove('fc-drop-hover');
      });
      editor.addEventListener('drop', function (e) {
        if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
        e.preventDefault();
        editor.classList.remove('fc-drop-hover');
        /* 把光标挪到落点上：插入位置=松手的位置，不再只会插到文末 */
        try {
          var rng = document.caretRangeFromPoint
            ? document.caretRangeFromPoint(e.clientX, e.clientY)
            : (document.caretPositionFromPoint
              ? (function () { var p = document.caretPositionFromPoint(e.clientX, e.clientY); var r = document.createRange(); r.setStart(p.offsetNode, p.offset); return r; })()
              : null);
          if (rng && window.__rte) { window.__rte.editor = editor; window.__rte.range = rng; }
        } catch (err) {}
        /* 支持文件夹 Entry 的浏览器走递归读取（保留文件夹名）；不支持的直接传文件列表 */
        var hasEntry = false;
        try {
          for (var di = 0; di < e.dataTransfer.items.length; di++) {
            if (e.dataTransfer.items[di].webkitGetAsEntry) { hasEntry = true; break; }
          }
        } catch (err2) {}
        if (hasEntry) {
          fcReadDropped(e.dataTransfer.items, function (files, folderName) {
            if (files && files.length) processLocalFiles(files, editor, folderName);
          });
        } else {
          processLocalFiles(Array.prototype.slice.call(e.dataTransfer.files), editor, null);
        }
      });

      /* v351 B2：截图/复制的文件直接 Ctrl+V 粘贴即传 */
      editor.addEventListener('paste', function (e) {
        var dt = e.clipboardData;
        if (!dt || !dt.files || !dt.files.length) return;
        e.preventDefault();
        try {
          var sel = window.getSelection();
          if (sel && sel.rangeCount && window.__rte) { window.__rte.editor = editor; window.__rte.range = sel.getRangeAt(0).cloneRange(); }
        } catch (err) {}
        processLocalFiles(Array.prototype.slice.call(dt.files), editor, null);
      });
    }

    /* v351：加/删文件后刷新所属文件夹的「N 项 · 合计大小」 */
    function fcRefreshMeta(listEl) {
      var ownerRow = listEl.closest ? listEl.closest('.file-folder-item.is-folder') : null;
      if (!ownerRow) return;
      var st = fcFolderStats(listEl);
      var m = ownerRow.querySelector(':scope > .fc-row-head > .fmeta');
      if (m) m.textContent = st.n + ' 项' + (st.total ? ' · ' + fmtFileSize(st.total) : '');
    }
    /* 展开某一行所在的父级链（上传完成后让新文件露出来） */
    function fcExpandParents(node) {
      var p = node.parentNode;
      while (p && p !== document.body) {
        if (p.classList && p.classList.contains('fc-kids') && p.style.display === 'none') {
          p.style.display = 'block';
          var owner = p.parentNode ? p.parentNode.querySelector(':scope > .fc-row-head') : null;
          if (owner) fcSetArrow(owner, true);
        }
        p = p.parentNode;
      }
    }
    function fcSetArrow(head, open) {
      var arr = head ? head.querySelector('.fc-arrow-svg') : null;
      if (arr) arr.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
    }
    function fcToggleKids(head, kids) {
      var show = kids.style.display === 'none';
      kids.style.display = show ? 'block' : 'none';
      fcSetArrow(head, show);
    }
    /* 点名字 → 原地变输入框，回车/失焦保存（文件和文件夹通用） */
    function fcStartRename(nameEl) {
      var oldName = nameEl.textContent;
      var inp = document.createElement('input');
      inp.type = 'text'; inp.value = oldName;
      inp.className = 'file-card-rename';
      nameEl.innerHTML = '';
      nameEl.appendChild(inp);
      inp.focus(); inp.select();
      var save = function () { nameEl.textContent = inp.value.trim() || oldName; };
      inp.addEventListener('blur', save);
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { inp.blur(); }
        if (ev.key === 'Escape') { inp.value = oldName; inp.blur(); }
      });
    }
    /* 往指定列表里加文件：同名自动 -1/-2，上传走统一队列（进度/取消/重试） */
    function fcAddFilesInto(list, editor) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.multiple = true;
      inp.addEventListener('change', function () {
        var files = Array.prototype.slice.call(inp.files || []);
        if (!files.length) return;
        var taken = fcCollectNames(list);
        var addBtn = list.querySelector(':scope > .fc-actions');
        files.forEach(function (f) {
          var finalName = fcUniqueName(f.name, taken);
          taken.add(finalName);
          var oversize = f.size > 25 * 1024 * 1024;
          var row = document.createElement('div');
          row.className = 'file-folder-item' + (oversize ? ' oversize' : '');
          row.innerHTML = fcFileIconSvg(finalName) +
            '<span class="fname">' + escapeHtml(finalName) + '</span>' +
            '<span class="fsize">' + (oversize ? '超 25MB 没传上' : '上传中…') + '</span>' +
            '<span class="fc-admin-only">' +
              '<button type="button" class="fc-btn" data-action="copy-item" title="复制链接">复制</button>' +
              '<button type="button" class="fc-btn" data-action="replace-item" title="替换文件">替换</button>' +
            '</span>' +
            '<button type="button" class="fremove fc-admin-only" title="删除" data-action="del-item">' + fcXSvg() + '</button>';
          if (addBtn) list.insertBefore(row, addBtn); else list.appendChild(row);
          fcRefreshMeta(list); /* v351：计数即时刷新 */
          if (oversize) return; /* A4：超大直接标红，不发起上传 */
          window.__upman.run(f, 'file', {
            onDone: function (url, key) {
              row.setAttribute('data-key', key || '');
              row.setAttribute('data-size', f.size);
              var s = row.querySelector('.fsize');
              if (s) s.textContent = fmtFileSize(f.size);
              fcExpandParents(row);
              fcRefreshMeta(list); /* v351：合计大小刷新 */
            },
            onFail: function () { row.classList.add('oversize'); }
          });
        });
      });
      inp.click();
    }
    /* 往指定列表里补一个空的子文件夹（默认收起），插进去直接改名 */
    function fcAddFolderInto(list) {
      var taken = fcCollectNames(list);
      var name = fcUniqueName('新建文件夹', taken);
      taken.add(name);
      var wrap = document.createElement('div');
      wrap.className = 'file-folder-item is-folder';
      wrap.setAttribute('data-ftype', 'folder');
      wrap.innerHTML =
        '<div class="fc-row-head">' + fcFolderIconSvg() +
          '<span class="fname" data-action="rename" title="点一下改名">' + escapeHtml(name) + '</span>' +
          '<span class="fmeta">0 项</span>' +
          '<span class="fc-admin-only">' +
            '<button type="button" class="fc-btn" data-action="add-file-here" title="往这个文件夹里加文件">＋文件</button>' +
            '<button type="button" class="fc-btn" data-action="add-folder-here" title="在这个文件夹里补个子文件夹">＋夹</button>' +
          '</span>' +
          '<button type="button" class="fremove fc-admin-only" title="删除" data-action="del-item">' + fcXSvg() + '</button>' +
          '<button type="button" class="fc-arrow" data-action="toggle-kids" title="展开/收起">' + fcArrowSvg() + '</button>' +
        '</div>' +
        '<div class="file-folder-list fc-kids" style="display:none">' +
          '<div class="fc-empty fc-admin-only">空文件夹，点右上「＋文件」放东西进来</div>' +
          '<div class="fc-actions fc-admin-only">' +
            '<button type="button" class="fc-btn fc-btn-strong" data-action="add-file-here">新增文件</button>' +
            '<button type="button" class="fc-btn fc-btn-strong" data-action="add-folder-here">补文件夹</button>' +
          '</div>' +
        '</div>';
      var addBtn = list.querySelector(':scope > .fc-actions');
      if (addBtn) list.insertBefore(wrap, addBtn); else list.appendChild(wrap);
      fcExpandParents(wrap);
      var nameEl = wrap.querySelector('.fname');
      if (nameEl) fcStartRename(nameEl);
    }
    /* 替换文件：整卡（data-dl 的 a）或文件夹内某一行 */
    function fcPickAndReplace(card, row) {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        window.__upman.run(f, 'file', {
          onDone: function (url, key) {
            if (row) {
              row.setAttribute('data-key', key || '');
              row.setAttribute('data-size', f.size);
              var s = row.querySelector('.fsize');
              if (s) s.textContent = fmtFileSize(f.size);
              row.classList.remove('oversize');
              toast('文件已替换', 'success');
            } else if (card) {
              var a = card.querySelector('a[data-dl]');
              if (a) a.setAttribute('href', url);
              var sz = card.querySelector('.file-card-size');
              if (sz) sz.textContent = fmtFileSize(f.size);
              toast('文件已替换', 'success');
            }
          }
        });
      });
      inp.click();
    }
    /* 递归读取拖拽进来的文件/文件夹（保留文件夹名） */
    function fcReadDropped(dtItems, cb) {
      var entries = [];
      for (var i = 0; i < (dtItems ? dtItems.length : 0); i++) {
        var it = dtItems[i];
        if (it.kind === 'file') {
          var ent = it.webkitGetAsEntry && it.webkitGetAsEntry();
          if (ent) entries.push(ent);
        }
      }
      if (!entries.length) return; /* 调用方自行回退到 dataTransfer.files */
      var files = [], folderName = null, pending = entries.length;
      function walk(entry, parent) {
        if (entry.isFile) {
          entry.file(function (f) { if (parent) f.__folderName = parent; files.push(f); settle(); }, settle);
        } else if (entry.isDirectory) {
          if (!parent) folderName = entry.name;
          var reader = entry.createReader();
          var readBatch = function () {
            reader.readEntries(function (batch) {
              if (!batch.length) return;
              batch.forEach(function (en) { walk(en, parent || entry.name); });
              readBatch();
            }, settle);
          };
          readBatch();
        } else settle();
      }
      function settle() { pending--; if (pending <= 0) { files.sort(function (a, b) { return (a.__folderName || '').localeCompare(b.__folderName || '') || a.name.localeCompare(b.name); }); cb(files, folderName); } }
      entries.forEach(function (en) { walk(en, null); });
    }


    // v328（用户 10-06 15:37）：文件弹窗主控——极简设计：一行说明+链接框+上传按钮，无虚线框无二级菜单
    function setupFileDialog(editor) {
      if (!editor) return;
      // 一次性绑定弹窗级拖拽（整个弹窗都是 drop 区）
      if (!window.__fileDialogBound) {
        window.__fileDialogBound = true;
        var mask = document.getElementById('inputMask');
        if (mask) {
          mask.addEventListener('dragover', function (e) { e.preventDefault(); });
          mask.addEventListener('drop', function (e) {
            e.preventDefault();
            handleFileDrop(e, editor);
          });
        }
      }
      showInput('插入文件',
        '粘贴网络链接，或点「上传本地文件」选择文件；也可直接拖文件/文件夹到弹窗',
        'https://...',
        handleFileInsert(editor), '', 'file');
    }

    // v351：处理本地文件列表——先插卡（即时反馈），上传统一走队列（进度条/取消/重试）
    // folderName 有值表示来自文件夹选择器；null 表示普通多文件（自动打包成文件夹卡）
    function processLocalFiles(files, editor, folderName) {
      if (!files || !files.length) return;
      window.closeInput && window.closeInput();
      var items = Array.prototype.slice.call(files).map(function (f) {
        return { file: f, name: f.name, size: f.size, oversize: f.size > 25 * 1024 * 1024 };
      });
      var pid = genFileId();
      /* 单文件 → 一张文件卡，先插"上传中"状态，传完原地补链接 */
      if (items.length === 1 && !folderName) {
        var it = items[0];
        rteInsert(editor, buildFileCardHTML({ id: pid, type: 'file', name: it.name, url: '', size: it.size }));
        var card = editor.querySelector('[data-file-id="' + pid + '"]');
        if (it.oversize) { /* A4：超大在队列面板里就标红说明，这里卡片同步打失败态 */
          if (card) { card.classList.add('fc-failed'); var sz0 = card.querySelector('.file-card-size'); if (sz0) sz0.textContent = '超 25MB 没传上'; }
          return;
        }
        window.__upman.run(it.file, 'file', {
          onDone: function (url, key) {
            if (!card) return;
            var a = card.querySelector('a[data-dl]'); if (a) a.setAttribute('href', url);
            var sz = card.querySelector('.file-card-size'); if (sz) sz.textContent = fmtFileSize(it.size);
            toast('文件已插入', 'success');
          },
          onFail: function () { if (card) card.classList.add('fc-failed'); }
        });
        return;
      }
      /* 多文件 / 文件夹 → 文件夹卡（默认收起，传完自动展开）；同名自动 -1/-2 */
      var taken = new Set();
      var kids = items.map(function (x) {
        var nm = fcUniqueName(x.name, taken); taken.add(nm);
        return { ftype: 'file', name: nm, size: x.size, key: '', oversize: x.oversize };
      });
      rteInsert(editor, buildFileCardHTML({ id: pid, type: 'folder', name: folderName || ('文件包 (' + items.length + ')'), items: kids }));
      var fcard = editor.querySelector('[data-file-id="' + pid + '"]');
      var rows = fcard ? fcard.querySelectorAll('.file-folder-item:not(.is-folder)') : [];
      items.forEach(function (it, idx) {
        var row = rows[idx];
        if (!row) return;
        if (it.oversize) return; /* 已在卡上标红 */
        window.__upman.run(it.file, 'file', {
          onDone: function (url, key) {
            row.setAttribute('data-key', key || '');
            row.setAttribute('data-size', it.size);
            var s = row.querySelector('.fsize');
            if (s) s.textContent = fmtFileSize(it.size);
            fcExpandParents(row);
          },
          onFail: function (msg) {
            row.classList.add('oversize');
            var s2 = row.querySelector('.fsize');
            if (s2) s2.textContent = msg === 'size' ? '超 25MB 没传上' : '上传失败';
          }
        });
      });
    }


    // v320：拖拽处理——webkitGetAsEntry 自动识别文件/文件夹
    function handleFileDrop(e, editor) {
      var dt = e.dataTransfer;
      if (!dt) return;
      var items = dt.items;
      if (!items || !items.length) {
        // fallback 到 files
        var files = Array.from(dt.files || []);
        processLocalFiles(files, editor, null);
        return;
      }
      // 优先用 DataTransferItemList 识别文件夹
      var entries = [];
      for (var i = 0; i < items.length; i++) {
        var entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      if (!entries.length) {
        processLocalFiles(Array.from(dt.files || []), editor, null);
        return;
      }
      // 判断是否为单个文件夹
      var isFolder = entries.length === 1 && entries[0].isDirectory;
      if (isFolder) {
        readDirectoryEntry(entries[0], function (files, folderName) {
          processLocalFiles(files, editor, folderName);
        });
        return;
      }
      // 混合拖拽（多个文件/文件夹）→ 全部平铺成文件列表，自动打包成文件夹卡
      var allFiles = [];
      var pending = entries.length;
      entries.forEach(function (entry) {
        if (entry.isFile) {
          entry.file(function (f) { allFiles.push(f); pending--; if (pending === 0) processLocalFiles(allFiles, editor, null); });
        } else if (entry.isDirectory) {
          readDirectoryEntry(entry, function (files) { allFiles = allFiles.concat(files); pending--; if (pending === 0) processLocalFiles(allFiles, editor, null); });
        } else { pending--; if (pending === 0) processLocalFiles(allFiles, editor, null); }
      });
    }

    // v320：递归读取目录条目（DirectoryEntry API）
    function readDirectoryEntry(dirEntry, cb) {
      var files = [];
      var reader = dirEntry.createReader();
      var folderName = dirEntry.name;
      function readBatch() {
        reader.readEntries(function (entries) {
          if (!entries.length) { cb(files, folderName); return; }
          var pending = entries.length;
          entries.forEach(function (entry) {
            if (entry.isFile) {
              entry.file(function (f) { files.push(f); pending--; if (pending === 0) readBatch(); });
            } else if (entry.isDirectory) {
              readDirectoryEntry(entry, function (subFiles) { files = files.concat(subFiles); pending--; if (pending === 0) readBatch(); });
            } else { pending--; if (pending === 0) readBatch(); }
          });
        }, function () { cb(files, folderName); });
      }
      readBatch();
    }

    // v321（用户 10-05 23:38）：自动判断链接类型——网盘域名→文件夹卡，文件扩展名→文件卡，默认文件卡
    function detectLinkType(url) {
      var u = (url || '').toLowerCase();
      // 常见网盘/分享域名清单（可维护）
      var folderDomains = [
        'pan.baidu.com',
        'alipan.com', 'aliyundrive.net', 'aliyundrive.com',
        'lanzou', 'lanzouw.com', 'lanzoux.com', 'lanzoui.com',
        '123pan.com', '123pan.cn',
        'pan.quark.cn', 'quark.cn',
        'cowtransfer.com',
        'wenshushu.cn',
        'cloud.189.cn',
        'pan.xunlei.com',
        'yun.139.com',
        'www.jianguoyun.com',
        'mega.nz',
        'drive.google.com',
        'onedrive.live.com',
        'sharepoint.com',
        'dropbox.com',
        'terabox.com',
        'mediafire.com',
        'megaup.net',
        'zippyshare.com',
        'uploadgig.com',
        'rapidgator.net',
        'nitroflare.com',
        'katfile.com',
        'scribd.com'
      ];
      var isFolder = false;
      for (var i = 0; i < folderDomains.length; i++) {
        if (u.indexOf(folderDomains[i]) !== -1) { isFolder = true; break; }
      }
      // 兜底： lanzou 系列子域名通配（lanzou[a-z]*.com）
      if (!isFolder && /lanzou[a-z]*\.com/.test(u)) isFolder = true;
      if (isFolder) return 'folder';
      // 常见文件扩展名
      var fileExts = /\.(pdf|zip|rar|7z|tar|gz|bz2|xz|mp4|mp3|avi|mkv|mov|wmv|flv|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|apk|exe|dmg|pkg|ipa|iso|img|torrent|csv|json|xml|html|htm|js|css|png|jpg|jpeg|gif|webp|svg|psd|ai|eps|woff|woff2|ttf|otf|eot|md|epub|mobi|azw3|fb2|djvu|chm|hlp|log|ini|cfg|conf|sql|py|java|c|cpp|h|hpp|cs|php|rb|go|rs|swift|kt|ts|jsx|tsx|vue|scss|less|sass|styl|coffee|lua|pl|sh|bat|cmd|ps1|vbs|wsf|reg|msi|msp|msm|mst|cab|dll|sys|drv|ocx|ax|tlb|olb|rll|mui|inf|cat|cer|crt|pfx|p12|pem|key|csr|crl|ocsp|tsa|sst|stl|spc|p7b|p7c|p7m|p7s|ps1xml|cdxml|xaml|baml|resx|resources|config|manifest|cfg|ini|inf|reg|cmd|bat|ps1|vbs|wsf|hta|msc|adp|ade|accdb|accdt|accdr|accdw|accde|mda|mde|adp|ade|dbf|db|mdb|sqlite|sqlite3|db3|s3db|sl3|nwdb|fdb|gdb|ib|myd|myi|frm|ibd|dbf|dbt|mdx|cdx|idx|ntx|db|sdf|mdb|accdb|odb|udl|dsn|qry|rqy|odc|udl|dac|dtsx|dbs|dbm|dbt|dbx|dbc|dbi|dbl|dbm|dbo|dbp|dbs|dbt|dbv|dbw|dbx|dby|dbz)$/i;
      if (fileExts.test(u)) return 'file';
      return 'file'; // 默认文件卡
    }

    // v321（用户 10-05 23:38）：文件弹窗——处理链接输入结果并插入编辑器（自动判断类型，无手动切换）
    function handleFileInsert(editor) {
      return function (val, done) {
        var url = (val || '').trim();
        if (!url) { if (done) done(); return; }
        var type = detectLinkType(url);
        var html = buildFileCardHTML({
          type: type,
          name: type === 'folder' ? '文件夹链接' : '文件链接',
          url: url,
          isLink: true,
          items: []
        });
        rteInsert(editor, html);
        toast('已插入', 'success');
        if (done) done();
      };
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
        var _origText = btn.textContent;
        btn.disabled = true;
        /* v351 A1-A3：封面图上传统一走队列面板（进度条/可取消/失败可重试） */
        window.__upman.run(inp.files && inp.files[0], 'image', {
          onDone: function (url) {
            btn.disabled = false;
            btn.textContent = '✓ 完成';
            btn.style.background = 'var(--green-strong)';
            setTimeout(function () { btn.textContent = _origText; btn.style.background = ''; }, 1200);
            fImg.value = url;
            if (typeof fImg.dispatchEvent === 'function') fImg.dispatchEvent(new Event('input'));
            toast('封面图已上传，链接已自动填入', 'success');
          },
          onFail: function () { btn.disabled = false; btn.textContent = _origText; },
          onCancel: function () { btn.disabled = false; btn.textContent = _origText; }
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

    // v320（用户 10-05 22:37）：插入文件或文件夹（详情编辑器）
    document.getElementById('detailRteFile').addEventListener('click', function () {
      setupFileDialog(__rte.editor || document.getElementById('fDetail'));
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

    // ========== R256：封面多图轮播 ==========
(function () {
  var coverGallery = document.getElementById('coverGallery');
  var fImgInput = document.getElementById('fImg');
  var fImgPreview = document.getElementById('fImgPreview');
  var coverImages = []; // 当前编辑的封面图列表
  var selectedCoverIdx = 0; // 当前选中的小图索引

  // R266（用户 09-27 15:08）：缩略图先隐藏占座（opacity:0），load 成功才显示，
  // error 直接换占位符，杜绝 innerHTML 直接塞 src 导致的裸闪破损图标。
  // R271（用户 09-27 17:30）：封面图拖拽排序 + 第一张永远是主图。
  function renderCoverGallery() {
    if (!coverGallery) return;
    coverGallery.innerHTML = '';
    coverImages.forEach(function (url, idx) {
      var item = document.createElement('div');
      item.className = 'cg-item' + (idx === selectedCoverIdx ? ' active' : '');
      item.dataset.idx = idx;
      var img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.style.opacity = '0';
      img.onload = function () { img.style.opacity = '1'; };
      img.onerror = function () {
        /* R304 P18：小图 404 先回退原图，不能空图；原图也失败才走占位符 */
        var _orig = escapeHtml(url);
        if (url && thumbOf(url) !== url && img.getAttribute('src') !== _orig) { img.src = _orig; return; }
        img.style.opacity = '1'; item.classList.add('media-fail'); img.src = EXC_PLACEHOLDER;
      };
      // R277：去掉编辑弹窗缩略图点击放大（老板要求保留右键预览大图即可，点击只保留选中行为）
      item.appendChild(img);
      if (url) { img.src = escapeHtml(thumbOf(url)); } else { img.style.opacity = '1'; item.classList.add('media-fail'); img.src = EXC_PLACEHOLDER; } /* R304 P18：编辑弹窗图库缩略图读小图 */
      if (idx === 0) {
        var mainBadge = document.createElement('span');
        mainBadge.className = 'cg-main';
        mainBadge.textContent = '封面图';
        item.appendChild(mainBadge);
      }
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'cg-del';
      delBtn.title = '删除';
      delBtn.dataset.idx = idx;
      delBtn.innerHTML = '<svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg>'; /* R285 条17：× 文字符号换固定 SVG */
      item.appendChild(delBtn);
      // 拖拽把手（桌面 HTML5 drag + 移动 touch 长按拖拽）
      var dragBtn = document.createElement('span');
      dragBtn.className = 'cg-drag';
      dragBtn.title = '拖动排序';
      dragBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>';
      dragBtn.draggable = true;
      item.appendChild(dragBtn);
      // 点击选图 / 删除
      item.addEventListener('click', function (e) {
        if (e.target.classList.contains('cg-del')) {
          e.stopPropagation();
          deleteCoverImage(parseInt(e.target.dataset.idx));
          return;
        }
        if (e.target.classList.contains('cg-drag')) return;
        selectCoverImage(idx);
      });
      // HTML5 桌面拖拽
      dragBtn.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', String(idx));
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      dragBtn.addEventListener('dragend', function () {
        item.classList.remove('dragging');
        document.querySelectorAll('.cg-item').forEach(function (el) { el.classList.remove('drag-over'); });
      });
      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', function () {
        item.classList.remove('drag-over');
      });
      item.addEventListener('drop', function (e) {
        e.preventDefault();
        item.classList.remove('drag-over');
        var fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        var toIdx = idx;
        if (isNaN(fromIdx) || fromIdx === toIdx) return;
        reorderCoverImages(fromIdx, toIdx);
      });
      // 移动 touch 长按拖拽
      bindCoverTouchDrag(item, dragBtn, idx);
      coverGallery.appendChild(item);
    });
    // + 添加占位框
    var addBtn = document.createElement('div');
    addBtn.className = 'cg-add';
    addBtn.textContent = '+';
    addBtn.title = '添加新图';
    addBtn.addEventListener('click', function () {
      // 点+ = 直接选中新图槽位，不弹窗
      selectedCoverIdx = coverImages.length;
      coverImages.push('');
      renderCoverGallery();
      updateFImgInput();
      fImgInput.focus();
    });
    coverGallery.appendChild(addBtn);
  }

  // R271：封面图数组重排，selectedCoverIdx 跟随同一张图
  function reorderCoverImages(fromIdx, toIdx) {
    if (fromIdx < 0 || fromIdx >= coverImages.length || toIdx < 0 || toIdx >= coverImages.length) return;
    var oldSel = selectedCoverIdx;
    var moved = coverImages.splice(fromIdx, 1)[0];
    coverImages.splice(toIdx > fromIdx ? toIdx : toIdx, 0, moved);
    // 选中态跟随移动：先算旧选中图的新位置
    if (oldSel === fromIdx) {
      selectedCoverIdx = toIdx > fromIdx ? toIdx : toIdx;
    } else if (fromIdx < toIdx) {
      if (oldSel > fromIdx && oldSel <= toIdx) selectedCoverIdx = oldSel - 1;
    } else {
      if (oldSel >= toIdx && oldSel < fromIdx) selectedCoverIdx = oldSel + 1;
    }
    renderCoverGallery();
    updateFImgInput();
    updateImgPreview();
  }

  // R271：移动 touch 长按拖拽封装
  function bindCoverTouchDrag(item, handle, idx) {
    var longTimer = null;
    var ghost = null;
    var startX = 0, startY = 0;
    var dragging = false;
    var moved = false;
    var startEl = null;
    var MOVE_THRESHOLD = 8;
    var LONG_PRESS_MS = 400;
    function clearTimer() { if (longTimer) { clearTimeout(longTimer); longTimer = null; } }
    function removeGhost() { if (ghost && ghost.parentNode) { ghost.parentNode.removeChild(ghost); } ghost = null; }
    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      var t = e.touches[0];
      startX = t.clientX; startY = t.clientY; moved = false; dragging = false; startEl = item;
      clearTimer();
      longTimer = setTimeout(function () {
        if (moved) return;
        dragging = true;
        item.classList.add('dragging');
        var rect = item.getBoundingClientRect();
        ghost = item.cloneNode(true);
        ghost.style.position = 'fixed';
        ghost.style.left = rect.left + 'px';
        ghost.style.top = rect.top + 'px';
        ghost.style.width = rect.width + 'px';
        ghost.style.height = rect.height + 'px';
        ghost.style.opacity = '0.85';
        ghost.style.zIndex = '99999';
        ghost.style.pointerEvents = 'none';
        ghost.classList.remove('dragging');
        document.body.appendChild(ghost);
      }, LONG_PRESS_MS);
    }
    function onTouchMove(e) {
      if (e.touches.length !== 1) { clearTimer(); return; }
      var t = e.touches[0];
      var dx = Math.abs(t.clientX - startX);
      var dy = Math.abs(t.clientY - startY);
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) moved = true;
      if (!dragging) return;
      e.preventDefault();
      if (ghost) {
        var rect = item.getBoundingClientRect();
        ghost.style.left = (t.clientX - rect.width / 2) + 'px';
        ghost.style.top = (t.clientY - rect.height / 2) + 'px';
      }
      // 高亮下方元素
      var el = document.elementFromPoint(t.clientX, t.clientY);
      var target = el ? el.closest('.cg-item') : null;
      document.querySelectorAll('.cg-item').forEach(function (c) { c.classList.remove('drag-over'); });
      if (target && target !== item) target.classList.add('drag-over');
    }
    function onTouchEnd(e) {
      clearTimer();
      if (!dragging) { removeGhost(); item.classList.remove('dragging'); return; }
      dragging = false;
      item.classList.remove('dragging');
      var changed = e.changedTouches[0];
      var el = document.elementFromPoint(changed.clientX, changed.clientY);
      var target = el ? el.closest('.cg-item') : null;
      document.querySelectorAll('.cg-item').forEach(function (c) { c.classList.remove('drag-over'); });
      removeGhost();
      if (target && target !== item) {
        var toIdx = parseInt(target.dataset.idx, 10);
        if (!isNaN(toIdx)) reorderCoverImages(idx, toIdx);
      }
    }
    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    handle.addEventListener('touchmove', onTouchMove, { passive: false });
    handle.addEventListener('touchend', onTouchEnd, { passive: true });
    handle.addEventListener('touchcancel', function () { clearTimer(); removeGhost(); item.classList.remove('dragging'); dragging = false; }, { passive: true });
  }

  // R279（老板 09-28 00:10）：点选缩略图不再整库重建——之前 selectCoverImage 也走
  // renderCoverGallery 全量 innerHTML 重建，每张缩略图 opacity:0→load→1 重走一遍 = 老板看到的"闪一下"。
  // 纯选中操作只切换 .active 类 + 同步链接输入框/预览；结构性变化（增删/重排/输入/上传）才需要重建。
  function selectCoverImage(idx) {
    selectedCoverIdx = idx;
    var items = coverGallery ? coverGallery.querySelectorAll('.cg-item') : [];
    items.forEach(function (el) {
      var i = parseInt(el.dataset.idx, 10);
      if (isNaN(i)) return;
      if (i === idx) el.classList.add('active'); else el.classList.remove('active');
    });
    updateFImgInput();
    updateImgPreview();
  }

  function deleteCoverImage(idx) {
    coverImages.splice(idx, 1);
    if (selectedCoverIdx >= coverImages.length) selectedCoverIdx = Math.max(0, coverImages.length - 1);
    if (coverImages.length === 0) selectedCoverIdx = 0;
    renderCoverGallery();
    updateFImgInput();
    updateImgPreview();
  }

  function updateFImgInput() {
    if (!fImgInput) return;
    var url = coverImages[selectedCoverIdx] || '';
    fImgInput.value = url;
    fImgInput.placeholder = selectedCoverIdx === 0 ? '请输入封面图链接' : '请输入图' + (selectedCoverIdx + 1) + '链接'; /* R285 条38：口径统一「动作+对象」 */
  }

  // R266（用户 09-27 15:08）：轮播图库的 updateImgPreview 复用共享 _safeSetPreview，
  // 消除与单图编辑路径的行为分叉，根治裸闪破损图标+alt「预览」。
  function updateImgPreview() {
    _safeSetPreview(document.getElementById('fImgPreview'), (coverImages[selectedCoverIdx] || '').trim(), { hideEmpty: true, noDebounce: true });
  }

  // 输入框实时同步到当前选中的图
  if (fImgInput) {
    fImgInput.addEventListener('input', function () {
      var url = fImgInput.value.trim();
      if (coverImages.length === 0) {
        coverImages.push(url);
        selectedCoverIdx = 0;
      } else {
        coverImages[selectedCoverIdx] = url;
      }
      renderCoverGallery();
      updateImgPreview();
    });
  }

  // 上传按钮：上传到当前选中的图槽位
  var fImgUploadBtn = document.getElementById('fImgUpload');
  if (fImgUploadBtn) {
    fImgUploadBtn.addEventListener('click', function () {
      // 复用现有图仓上传逻辑，但上传到当前选中的槽位
      __uploadToCoverSlot(selectedCoverIdx);
    });
  }

  function __uploadToCoverSlot(idx) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function () {
      var file = input.files[0];
      if (!file) return;
      var form = new FormData();
      form.append('file', file);
      toast('上传中', 'info');
      fetch('/api/upload', { method: 'POST', body: form, credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok && res.url) {
            if (coverImages.length === 0 || idx >= coverImages.length) {
              if (idx >= coverImages.length) coverImages.push(res.url);
              else coverImages[idx] = res.url;
            } else {
              coverImages[idx] = res.url;
            }
            selectedCoverIdx = idx;
            renderCoverGallery();
            updateFImgInput();
            updateImgPreview();
            toast('上传成功', 'success');
          } else {
            toast(res.msg || '上传失败', 'error');
          }
        })
        .catch(function () { toast('上传失败', 'error'); });
    };
    input.click();
  }

  // 暴露全局方法供 openEdit / save 等调用
  window.__coverImages = function () { return coverImages; };
  window.__setCoverImages = function (arr) {
    coverImages = (arr || []).slice();
    selectedCoverIdx = 0;
    renderCoverGallery();
    updateFImgInput();
    updateImgPreview();
  };
  window.__coverMainImage = function () { return coverImages[0] || ''; };
  window.__renderCoverGallery = renderCoverGallery;
})();

// ========== 平台公告富文本编辑器 ==========
    var annEditor = document.getElementById('setAnnouncement');
    bindFileCardManagement(annEditor); // v328：文件卡管理事件绑定（此前零调用导致死按钮）
    var annTitleInput = document.getElementById('annTitleInput');
    var annListEl = document.getElementById('annList');
    var annEditLabel = document.getElementById('annEditLabel');
    var annDraftPending = false;
    var stateAnn = { list: [], curId: null, loaded: false };
    // 初始隐藏设置页中的公告编辑器（由"设置公告"弹窗承载）
    (function () { var _tb = document.getElementById('announcementRteToolbar'); if (_tb) _tb.style.display = 'none'; if (annEditor) annEditor.style.display = 'none'; var _ct0 = document.querySelector('.rte-count[data-for="setAnnouncement"]'); if (_ct0) _ct0.style.display = 'none'; })(); /* R215 条1：计数条同藏 */
    // R257：parseAnnouncements 已合并到 ui-common.js
    // 把当前编辑中的标题/内容写回列表
    function flushAnnEdit() {
      if (stateAnn._skipNextFlush) { stateAnn._skipNextFlush = false; return; } // R248：草稿恢复后的首次 flush 跳过——reload 后编辑器仍是旧默认内容，不跳过会把恢复的数据污染掉
      if (stateAnn.curId) {
        var cur = stateAnn.list.find(function (x) { return x.id === stateAnn.curId; });
        if (cur) { if (annEditor) cur.content = window.__rteClean(annEditor); } // R158：统一剥离×浮层再入内容
      }
    }
    // 渲染公告项列表（拖拽排序）
    function renderAnnList() {
      // R256：清除公告列表骨架
      var _alBox = document.getElementById('annList'); if (_alBox) { var _als = _alBox.querySelectorAll('.ann-skel-item'); for (var i=0;i<_als.length;i++) _als[i].parentNode.removeChild(_als[i]); }
      var _ah = annListEl.offsetHeight; if (_ah > 0) annListEl.style.minHeight = _ah + 'px'; annListEl.innerHTML = ''; setTimeout(function () { if (annListEl) annListEl.style.minHeight = ''; }, 300);
      stateAnn.list.forEach(function (a, idx) {
        var item = document.createElement('div');
        item.className = 'ann-item' + (a.level === 1 ? ' primary' : '') + (a.id === stateAnn.curId ? ' ann-cur' : '');
        item.draggable = false; item.dataset.idx = idx; item.style.cursor = 'default';
        var handle = document.createElement('span');
        handle.className = 'drag-handle'; handle.draggable = a.level === 1 ? false : true; handle.style.opacity = a.level === 1 ? '0.35' : '1'; handle.title = a.level === 1 ? '默认公告不可拖动' : '拖动排序';
        handle.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>';
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
          showConfirm('删除公告', '确定删除公告「' + (a.title || '') + '」？', function (closeConfirm) {
            closeConfirm();
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
      try { if (stateAnn._backup) { stateAnn.list = JSON.parse(JSON.stringify(stateAnn._backup)); stateAnn._backup = null; } } catch (e) { if (window.__silent) window.__silent(e); }
      annDraftPending = false; stateAnn.loaded = false;
      stateAnn.curId = null; // 置空选中，杜绝后续 flushAnnEdit 把编辑器草稿写回已恢复列表
      stateAnn._draftRestored = false; // R248：取消即回到已保存状态，清除草稿恢复标记
      stateAnn._stashed = false; // R257：取消/×=丢弃，无「恢复」一说，清暂存标记
      try { document.getElementById('annMode').value = stateAnn._modeSaved || 'always'; syncSelectDisplay(document.getElementById('annMode')); } catch (e) { if (window.__silent) window.__silent(e); }
      var _dl = null;
      try { _dl = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; } catch (e) { if (window.__silent) window.__silent(e); }
      if (annEditor) annEditor.innerHTML = _dl ? (_dl.content || '') : '';
      if (annEditLabel) annEditLabel.textContent = _dl ? ('编辑公告：' + (_dl.title || '(未命名)')) : '编辑公告';
      try { renderAnnList(); } catch (e) { if (window.__silent) window.__silent(e); }
      try { document.getElementById('annMask').classList.remove('open'); } catch (e) { if (window.__silent) window.__silent(e); }
      try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); } // R248：取消/×关闭时清除草稿
    }
    window.__annDiscard = annDiscard;
    // R257（老板 09-23 19:08）：点弹窗外关闭=暂存当前编辑（选中项+内容+频率留在内存态），
    // 重新打开自动恢复到离开时的样子；×/取消仍=丢弃（annDiscard 全量恢复已保存状态）。
    // 与 R248 的 localStorage 刷新保护并存：那是防自动刷新，这是主动关窗暂存，两套互不干扰。
    function annStash() {
      try { flushAnnEdit(); } catch (e) { if (window.__silent) window.__silent(e); } // 内容写回 stateAnn.list[curId]，选中项 curId / 频率 annMode 的 DOM 值原样保留
      stateAnn._stashed = true; // 供下次打开时恢复草稿（R274 去掉提示，恢复逻辑保留）
      try { document.getElementById('annMask').classList.remove('open'); } catch (e) { if (window.__silent) window.__silent(e); }
    }
    window.__annStash = annStash;
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
      // R248：先尝试从 localStorage 草稿恢复（自动刷新保护）
      var _draftRestored = false;
      try { _draftRestored = window.__restoreEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
      if (_draftRestored && stateAnn.list && stateAnn.list.length) {
        try { renderAnnList(); if (stateAnn.curId) selectAnnItem(stateAnn.curId); else { var _dl0 = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; if (_dl0) selectAnnItem(_dl0.id); } } catch (e) { if (window.__silent) window.__silent(e); }
      } else if (stateAnn.loaded && stateAnn.list.length) {
        // R248：若公告列表来自草稿恢复（load 后 200ms 定时器已消费草稿，此处 _draftRestored 为 false），
        // 优先选中恢复前的编辑项 curId，而非固定选默认公告
        // R257：点外暂存后重开——选中项恢复到离开时编辑的那条（stateAnn.curId 保留在内存），
        // 内容已由 annStash flush 进 list，selectAnnItem 载入即回到离开时的样子
        try { renderAnnList(); var _sel0 = (stateAnn.curId && stateAnn.list.some(function (x) { return x.id === stateAnn.curId; })) ? stateAnn.curId : ((stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]).id); stateAnn._draftRestored = false; selectAnnItem(_sel0); } catch (e) { if (window.__silent) window.__silent(e); }
        if (stateAnn._stashed) { stateAnn._stashed = false; } // R274（用户 09-27 18:49）：去掉恢复提示，状态复位保留
      }
      if (!stateAnn.loaded) {
        api('admin/settings').then(function (res) {
          if (res && res.ok) {
            stateAnn.list = window.parseAnnouncements(res.settings || {}, { sortLevel: true }); if (!stateAnn.list.some(function (x) { return x.level === 1; })) stateAnn.list.unshift({ id: 'def', title: '公告', content: (res.settings || {}).announcement || '', hidden: 0, sort: 0, level: 1 }); stateAnn._backup = JSON.parse(JSON.stringify(stateAnn.list));
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
      // R293（用户 09-30）：恢复「确定中」忙碌态——R292 撤掉，老板要求恢复并全系统排查补齐
      annBtn.disabled = true;
      if (window.__btnBusy) window.__btnBusy(annBtn, '确定中');
      flushAnnEdit();
      var data = {
        announcement: '',
        announcement_mode: document.getElementById('annMode').value,
        announcements: JSON.stringify(stateAnn.list)
      };
      api('admin/settings', { method: 'PUT', body: JSON.stringify(data) }).then(function (res) {
        if (res && res.ok) {
          /* R231 条26：保存成功三段式——绿✓「已保存」400ms 后恢复（设置面板真实保存键） */
          try {
            annBtn.textContent = '✓ 已保存';
            annBtn.style.background = 'var(--green, #2e7d32)'; annBtn.style.borderColor = 'var(--green, #2e7d32)'; annBtn.style.color = '#fff';
            setTimeout(function () { annBtn.textContent = _annBtnText; annBtn.style.background = ''; annBtn.style.borderColor = ''; annBtn.style.color = ''; }, 400);
          } catch (e0) { if (window.__silent) window.__silent(e0); }
          /* v330 条8：公告保存按钮已就地打✓，不再重复弹提示条 */ if (window.__haptic) window.__haptic();
          stateAnn.loaded = true; annDraftPending = false;
          // R154: 保存成功后立即重建备份（原=null）——保存后再编辑、取消/×时 annDiscard 才有备份可恢复（重开瞬间及拉取失败时不再显示脏草稿）
          try { stateAnn._backup = JSON.parse(JSON.stringify(stateAnn.list)); } catch (e0) { stateAnn._backup = null; }
          stateAnn._modeSaved = document.getElementById('annMode').value; // R135：保存成功后同步已保存频率
          stateAnn._stashed = false; // R257：已保存=干净状态，重开不再提示「已恢复」
          try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); } // R248：保存成功后清除草稿
          document.getElementById('annMask').classList.remove('open');
        } else { annBtn.disabled = false; annBtn.textContent = _annBtnText; toast(res.msg || '保存失败', 'error'); }
      }).catch(function () {
        annBtn.disabled = false; annBtn.textContent = _annBtnText;
        toast('网络开小差了，请稍后再试', 'error'); // v294：087 网络提示统一
      });
    });
    // 取消公告（不保存，下次打开重新加载已保存状态）
    document.getElementById('cancelAnnBtn').addEventListener('click', function () {
      annDiscard(); // R145：取消=全量恢复（数据+编辑器+频率+列表）；R257：×/取消=丢弃（点外/Esc=暂存）
    });
    // 遮罩关闭：暂存当前编辑状态，下次打开可继续编辑
    document.getElementById('annMask').addEventListener('click', function (e) {
      // R257（老板 09-23 19:08）：点外关闭=暂存当前编辑（选中项+内容+频率保留），重开自动恢复到离开时的样子；
      // ×/取消=丢弃（annDiscard 全量恢复）——老板原场景即「点弹窗外关闭暂存才对」
      if (e.target === document.getElementById('annMask')) { window.__annStash(); }
    });

    // ---------- 全局客服链接（弹窗设置，与公告一致） ----------
    // 修复（P0）：var 声明原来被误写进上一行 // 注释里（整句被注释掉），contactDraftPending 未定义，
    // 首次点「设置客服」抛 ReferenceError，输入框赋值不执行 → 第一次进弹窗没链接；兜底代码隐式建了全局变量后才正常
    var contactDraftPending = false;
    document.getElementById('openContactBtn').addEventListener('click', function () {
      document.getElementById('contactMask').classList.add('open');
      if (contactDraftPending) { contactDraftPending = false; return; }
      var _ci = document.getElementById('contactUrlInput'); var _cs = document.getElementById('setContactUrl'); _ci.value = _cs.value || '';
      if (!_cs.value) { try { api('admin/settings').then(function (res) { if (res && res.ok) { var s = res.settings || {}; _cs.value = s.contact_url || ''; _ci.value = s.contact_url || ''; window.__plSet = 1; } }); } catch (e) { if (window.__silent) window.__silent(e); } }
    });
    document.getElementById('saveContactBtn').addEventListener('click', function () {
      // 修复：原先请求发出前就提示"已保存"并关闭弹窗，失败时造成"假成功"；提示与关窗移到请求成功后
      var cBtn = this;
      var _cBtnText = cBtn.textContent;
      // R293（用户 09-30）：恢复「确定中」忙碌态——R292 撤掉，老板要求恢复并全系统排查补齐
      cBtn.disabled = true;
      if (window.__btnBusy) window.__btnBusy(cBtn, '确定中');
      var v = document.getElementById('contactUrlInput').value.trim();
      document.getElementById('setContactUrl').value = v;
      var st = document.getElementById('contactStatus'); if (st) st.textContent = '';
      api('admin/settings', { method: 'PUT', body: JSON.stringify({ contact_url: v }) }).then(function (res) {
        if (res && res.ok) {
          /* R231 条26：保存成功三段式——绿✓「已保存」400ms 后恢复（设置面板真实保存键） */
          try {
            cBtn.textContent = '✓ 已保存';
            cBtn.style.background = 'var(--green, #2e7d32)'; cBtn.style.borderColor = 'var(--green, #2e7d32)'; cBtn.style.color = '#fff';
            setTimeout(function () { cBtn.textContent = _cBtnText; cBtn.style.background = ''; cBtn.style.borderColor = ''; cBtn.style.color = ''; }, 400);
          } catch (e0) { if (window.__silent) window.__silent(e0); }
          /* v330 条8：客服保存按钮已就地打✓，不再重复弹提示条 */
          // v294：213 广播通知其他标签页客服链接已更新
          try { localStorage.setItem('wnzyq_kf_url_updated', Date.now().toString()); } catch (e) { if (window.__silent) window.__silent(e); } if (window.__haptic) window.__haptic(); /* R183 条12 */
          try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); } // R248：清除 localStorage 草稿
          document.getElementById('contactMask').classList.remove('open');
        }
        else { cBtn.disabled = false; cBtn.textContent = _cBtnText; toast(res.msg || '保存失败', 'error'); }
      }).catch(function () {
        cBtn.disabled = false; cBtn.textContent = _cBtnText;
        toast('网络开小差了，请稍后再试', 'error'); // v294：087 网络提示统一
      });
    });
    document.getElementById('cancelContactBtn').addEventListener('click', function () { contactDraftPending = false; document.getElementById('contactUrlInput').value = ''; document.getElementById('contactMask').classList.remove('open'); });
    document.getElementById('contactMask').addEventListener('click', function (e) { if (e.target === document.getElementById('contactMask')) { contactDraftPending = true; document.getElementById('contactMask').classList.remove('open'); } }); // R257（老板 09-23 19:08）：点外=暂存输入（不清输入框，重开自动保留）；×/取消=丢弃清输入

    // 工具栏按钮点击执行命令
    document.querySelectorAll('#announcementRteToolbar .rte-btn[data-cmd]').forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
      btn.addEventListener('click', function () {
        var cmd = this.dataset.cmd;
        if (__rte.editor !== annEditor || !__rte.range) return; /* R217 条7：从未进入编辑器 → 不 focus、不执行（光标不跳输入框） */
        if (!(cmd === 'underline' && rteUnderlineLink(annEditor))) document.execCommand(cmd, false, null); /* R240：选区在链接内时下划线手动切换 <u> */
        rteFocusStay(annEditor); /* R240：preventScroll——点按键屏幕不离开光标 */
      });
    });

    // 下拉选择（字体、字号）
    document.querySelectorAll('#announcementRteToolbar .rte-select[data-cmd]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var cmd = this.dataset.cmd;
        var val = this.value;
        if (val && __rte.editor === annEditor && __rte.range) { /* R217 条7：有选区才执行，否则只重置下拉不抢焦点 */
          document.execCommand(cmd, false, val);
          rteFocusStay(annEditor); /* R240：preventScroll */
        }
        this.selectedIndex = 0;
        syncSelectDisplay(this); // R166：同步自制下拉显示框回到默认项
      });
    });

    // 插入超链接（一个弹窗两个输入框）
    document.getElementById('announcementRteLink').addEventListener('click', function () {
      showLinkDialog('', '', function (url, text) {
        var html = '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer"><u>' + text + '</u></a>'; /* R240：链接默认带下划线改<u>标记驱动，按键可加可删 */
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

    // v320（用户 10-05 22:37）：插入文件或文件夹
    document.getElementById('announcementRteFile').addEventListener('click', function () {
      setupFileDialog(__rte.editor || document.getElementById('setAnnouncement'));
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
          rteFocusStay(annEditor); /* R240：preventScroll */
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
      if (variantDraftPending && variantDraftFor === (v ? v.id : null)) { variantDraftPending = false; variantModalTitle.textContent = v ? '编辑类型' : '新增类型'; variantMask.classList.add('open'); if (window.__modalScroll) __modalScroll.open(variantMask, v ? v.id : 'new'); return; } // 遮罩关闭暂存：仅同一类型保留输入继续编辑（R257 补 add('open')——原分支只改标题不重开，暂存后点「新增类型」无反应）
      state.editingVariantId = v ? v.id : null;
      variantDraftFor = v ? v.id : null; // R257：记录当前暂存归属（此前从未赋值，已有类型暂存后开「新增」会误恢复）
      state._editVariantIdx = v ? state.variants.indexOf(v) : -1;
      variantModalTitle.textContent = v ? '编辑类型' : '新增类型';
      // R248：优先从 localStorage 恢复草稿（自动刷新保护）
      var _vd = null;
      try { _vd = JSON.parse(localStorage.getItem('wnzyq_variant_draft') || 'null'); if (_vd && _vd.type === 'variant') localStorage.removeItem('wnzyq_variant_draft'); } catch (e) { if (window.__silent) window.__silent(e); }
      if (_vd && _vd.type === 'variant' && _vd.id === (v ? v.id : null)) {
        vName.value = _vd.name || ''; vTitle.value = _vd.title || ''; document.getElementById('vDescEditor').innerHTML = _vd.desc || '';
      } else {
        vName.value = v ? (v.name || '') : '';
        vTitle.value = v ? (v.title || '') : ''; // R148：类型标题回填
        document.getElementById('vDescEditor').innerHTML = v ? (v.desc || '') : '';
      }
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
      /* R241：滚动位置按「弹窗 × 类型」独立 */
      if (window.__modalScroll) __modalScroll.open(variantMask, v ? v.id : 'new');
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
          '<button class="modal-close-x" data-link-close><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
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
          try { document.getElementById('linkDialogUrl').value = ''; document.getElementById('linkDialogText').value = ''; } catch (e) { if (window.__silent) window.__silent(e); }
          __linkStashOn = false;
          linkDialogMask.classList.remove('open');
        });
        linkDialogMask.querySelector('#linkDialogCancel').addEventListener('click', function () {
          try { document.getElementById('linkDialogUrl').value = ''; document.getElementById('linkDialogText').value = ''; } catch (e) { if (window.__silent) window.__silent(e); }
          __linkStashOn = false;
          linkDialogMask.classList.remove('open');
        });
        if (window.__modalKit) window.__modalKit.register(linkDialogMask, {
          discard: function () { try { document.getElementById('linkDialogUrl').value = ''; document.getElementById('linkDialogText').value = ''; } catch (e) { if (window.__silent) window.__silent(e); } __linkStashOn = false; linkDialogMask.classList.remove('open'); },
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
          if (!(this.dataset.cmd === 'underline' && rteUnderlineLink(editor))) document.execCommand(this.dataset.cmd, false, null); /* R240：选区在链接内时下划线手动切换 <u> */
          rteFocusStay(editor); /* R240：preventScroll——点按键屏幕不离开光标 */
        });
      });
      // 下拉选择
      document.querySelectorAll('#' + toolbarId + ' .rte-select[data-cmd]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          if (this.value && __rte.editor === editor && __rte.range) { /* R217 条7：有选区才执行，否则只重置下拉不抢焦点 */
            document.execCommand(this.dataset.cmd, false, this.value);
            rteFocusStay(editor); /* R240：preventScroll */
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
              rteFocusStay(editor); /* R240：preventScroll */
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
            var html = '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer"><u>' + text + '</u></a>'; /* R240（老板 09-22）：链接默认带下划线改为<u>标记驱动（前台 sanitizeHTML 放行 U 标签）——原先下划线由 CSS 画死，下划线按键加/删<u>看不出变化；改标记后默认带下划线、按键可加可删 */
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
      bindFileCardManagement(editor); // v328：文件卡管理事件绑定（此前零调用导致死按钮）
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
        try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); } // R248：清除 localStorage 草稿
        toast('类型已新增（保存资源后生效）', 'success');
        renderVariants();
        return;
      }
      // 修复：原先请求发出前就提示"保存成功"并关闭弹窗，失败时造成"假成功"；提示与关窗移到成功分支
      var _variantOkText = variantOk.textContent;
      // R293（用户 09-30）：恢复「确定中」忙碌态——R292 撤掉，老板要求恢复并全系统排查补齐
      variantOk.disabled = true;
      if (window.__btnBusy) window.__btnBusy(variantOk, '确定中');
      var req = state.editingVariantId
        ? api('admin/variants/' + state.editingVariantId, { method: 'PUT', body: JSON.stringify(data) })
        : api('admin/variants', { method: 'POST', body: JSON.stringify(data) });
      req.then(function (res) {
        if (res && res.ok) {
          variantDraftPending = false; variantMask.classList.remove('open');
          try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); } // R248：清除 localStorage 草稿
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
          variantOk.disabled = false; variantOk.textContent = _variantOkText;
          toast(res.msg || '保存失败', 'error');
        }
      }).catch(function () {
        variantOk.disabled = false; variantOk.textContent = _variantOkText;
        toast('网络开小差了，请稍后再试', 'error'); // v294：087 网络提示统一
      });
    });
