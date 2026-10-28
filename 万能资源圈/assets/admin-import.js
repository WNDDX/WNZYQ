/* ===== v431 批量导入（平台设置 · 智能表格）=====
   复用：SpreadsheetML 多工作表格式（与统计导出同源）、现有弹窗骨架、现有 api() 入库接口。
   流程：下载模板（自动带下拉）→ 上传 → 预览纠错 → 确认导入 → 可撤销提示。 */
(function () {
  'use strict';
  var NS = 'urn:schemas-microsoft-com:office:spreadsheet';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* 由现有分类生成「选项」表数据（下拉源） */
  function catOptions() {
    var cats = (window.state && state.categories) || [];
    return cats.map(function (c) { return c.name; });
  }

  /* 生成 SpreadsheetML 模板：资源/分类/公告 三表 + 选项表（下拉源） */
  function buildTemplate() {
    var opts = catOptions();
    var optRows = opts.map(function (n) { return '<Row><Cell><Data ss:Type="String">' + esc(n) + '</Data></Cell></Row>'; }).join('');
    var dv = function (col, cnt) {
      if (!opts.length) return '';
      return '<DataValidation ss:Type="List" ss:AllowBlank="yes"><x1:Formula1>选项!$A$1:$A$' + Math.max(cnt, 1) + '</x1:Formula1></DataValidation>';
    };
    var head = function (arr) { return '<Row>' + arr.map(function (h) { return '<Cell ss:StyleID="h"><Data ss:Type="String">' + esc(h) + '</Data></Cell>'; }).join('') + '</Row>'; };
    var sheet = function (name, rows, validations) {
      return '<Worksheet ss:Name="' + esc(name) + '"><Table>' + rows.join('') + '</Table>' +
        (validations ? '<x:WorksheetOptions xmlns:x="urn:schemas-microsoft-com:office:excel">' + validations + '</x:WorksheetOptions>' : '') + '</Worksheet>';
    };
    var xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>' +
      '<Workbook xmlns="' + NS + '" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      '<Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>' +
      sheet('资源', [head(['标题(必填)', '分类(下拉)', '简介', '价格(留空=免费)', '封面图链接', '资源码', '是否隐藏(下拉)']),
        '<Row>' + '<Cell></Cell>'.repeat(7) + '</Row>'], '') +
      sheet('分类', [head(['分类名称(必填)', '级别(下拉:一级/二级)', '所属一级分类(下拉)', '排序', '是否隐藏(下拉)']),
        '<Row>' + '<Cell></Cell>'.repeat(5) + '</Row>'],
        dv('B', opts.length) + dv('C', opts.length) + dv('E', 2)) +
      sheet('公告', [head(['标题(必填)', '内容文字', '排序', '是否隐藏(下拉)']),
        '<Row>' + '<Cell></Cell>'.repeat(4) + '</Row>'], dv('D', 2)) +
      sheet('选项', [head(['分类选项（勿改）']) + optRows], '') +
      '</Workbook>';
    return xml;
  }

  function download(name, content) {
    var blob = new Blob(['\ufeff' + content], { type: 'application/vnd.ms-excel;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }

  /* 解析上传的 SpreadsheetML/HTML 表格 → {资源:[...],分类:[...],公告:[...]} */
  function parseWorkbook(text) {
    var doc = new DOMParser().parseFromString(text, 'text/xml');
    var out = {};
    Array.prototype.forEach.call(doc.getElementsByTagName('Worksheet'), function (ws) {
      var name = ws.getAttribute('ss:Name') || ws.getAttribute('name') || '';
      var rows = [];
      var table = ws.getElementsByTagName('Table')[0];
      if (!table) { out[name] = rows; return; }
      Array.prototype.forEach.call(table.getElementsByTagName('Row'), function (row, ri) {
        if (ri === 0) return; /* 首行表头 */
        var cells = [];
        Array.prototype.forEach.call(row.getElementsByTagName('Cell'), function (c) {
          var d = c.getElementsByTagName('Data')[0];
          cells.push(d ? (d.textContent || '').trim() : '');
        });
        if (cells.some(function (x) { return x; })) rows.push(cells);
      });
      out[name] = rows;
    });
    return out;
  }

  /* 预览：校验并统计 */
  function preview(data) {
    var lines = [];
    var cats = catOptions();
    var res = data['资源'] || [], cat = data['分类'] || [], ann = data['公告'] || [];
    var bad = 0;
    res.forEach(function (r, i) { if (!r[0]) { bad++; lines.push('资源第' + (i + 2) + '行：缺标题，跳过'); } else if (r[1] && cats.indexOf(r[1]) < 0) { bad++; lines.push('资源第' + (i + 2) + '行：分类「' + r[1] + '」不存在，请先导分类'); } });
    cat.forEach(function (r, i) { if (!r[0]) { bad++; lines.push('分类第' + (i + 2) + '行：缺名称，跳过'); } });
    ann.forEach(function (r, i) { if (!r[0]) { bad++; lines.push('公告第' + (i + 2) + '行：缺标题，跳过'); } });
    lines.unshift('校验完成：资源 ' + res.length + ' 条 / 分类 ' + cat.length + ' 条 / 公告 ' + ann.length + ' 条' + (bad ? '；问题 ' + bad + ' 条' : '，全部可导入'));
    return { lines: lines, bad: bad, '资源': res, '分类': cat, '公告': ann }; /* v431b：键名与 doImport 对齐 */
  }

  /* 入库：分类→资源→公告（v431b：api() 是 admin-1 闭包内函数拿不到，改原生 fetch 同源带会话） */
  function apiCall(path, opts) {
    opts = opts || {};
    return fetch('/api/' + path, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: opts.body })
      .then(function (r) { return r.json(); });
  }
  function doImport(data) {
    var seq = Promise.resolve();
    var log = [];
    var catIdByName = {};
    ((window.state && state.categories) || []).forEach(function (c) { catIdByName[c.name] = c.id; });
    (data['分类'] || []).forEach(function (r) {
      if (!r[0]) return;
      seq = seq.then(function () {
        var pid = 0;
        if (r[2]) { pid = catIdByName[r[2]] || 0; if (!pid) log.push('分类「' + r[0] + '」：所属一级「' + r[2] + '」未找到，按一级导入'); }
        return apiCall('admin/categories', { method: 'POST', body: JSON.stringify({ name: r[0], parent_id: pid, sort: Number(r[3]) || 0, hidden: /隐藏/.test(r[4] || '') ? 1 : 0 }) });
      }).then(function (x) { if (x && x.ok) catIdByName[r[0]] = x.id; log.push('分类「' + r[0] + '」' + (x && x.ok ? '✓' : '失败')); }).catch(function () { log.push('分类「' + r[0] + '」失败'); });
    });
    (data['资源'] || []).forEach(function (r) {
      if (!r[0]) return;
      seq = seq.then(function () { return apiCall('admin/products', { method: 'POST', body: JSON.stringify({ title: r[0], desc: r[2] || '', price: Number(r[3]) || 0, img: r[4] || '', code: r[5] || '', hidden: /隐藏/.test(r[6] || '') ? 1 : 0 }) }); }).then(function (x) { log.push('资源「' + r[0] + '」' + (x && x.ok ? '✓' : '失败')); }).catch(function () { log.push('资源「' + r[0] + '」失败'); });
    });
    (data['公告'] || []).forEach(function (r) {
      if (!r[0]) return;
      seq = seq.then(function () { return apiCall('admin/settings', { method: 'POST', body: JSON.stringify({ annAdd: { title: r[0], content: r[1] || '', sort: Number(r[2]) || 0, hidden: /隐藏/.test(r[3] || '') ? 1 : 0 } }) }); }).then(function (x) { log.push('公告「' + r[0] + '」' + (x && x.ok ? '✓' : '失败')); }).catch(function () { log.push('公告「' + r[0] + '」失败'); });
    });
    return seq.then(function () { return log; });
  }

  /* 向导弹窗（复用 modal 骨架） */
  function openWizard() {
    var old = document.getElementById('importMask');
    if (old) old.remove();
    var mask = document.createElement('div');
    mask.className = 'modal-mask'; mask.id = 'importMask';
    mask.innerHTML = '<div class="modal-box"><button class="modal-close-x" data-x="1"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">批量导入</h2><div class="form" id="impBody">' +
      '<p style="font-size:13px;color:#5b7083;margin:0 0 10px">第 1 步：下载模板（分类列已带下拉，选就行）→ 填好 → 第 2 步上传 → 预览无误后导入。</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-blue" id="impTpl" style="flex:1">下载模板</button>' +
      '<label class="btn-blue" style="flex:1;text-align:center;cursor:pointer">上传表格<input type="file" id="impFile" accept=".xls,.xml" style="display:none"></label></div>' +
      '<div id="impPrev" style="margin-top:10px"></div></div></div>';
    document.body.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('open'); });
    if (window.lockBodyScroll) window.lockBodyScroll(true);
    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); }
    });
    mask.querySelector('#impTpl').addEventListener('click', function () { download('批量导入模板.xls', buildTemplate()); if (window.showToast) window.showToast('模板已下载（含分类下拉）', 'success'); });
    mask.querySelector('#impFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var pv = preview(parseWorkbook(String(rd.result)));
          var body = mask.querySelector('#impPrev');
          var total = (pv['资源'] || []).length + (pv['分类'] || []).length + (pv['公告'] || []).length; /* v431c：键名与 preview 返回值对齐（旧 pv.res 未同步=预览空白的真凶） */
          body.innerHTML = '<div class="probe" style="background:#0f2233;color:#9fe3b8;border-radius:8px;padding:10px;font-size:12px;white-space:pre-wrap">' + esc(pv.lines.join('\n')) + '</div>' +
            '<button class="btn-blue" id="impGo" style="width:100%"' + (total ? '' : ' disabled') + '>确认导入</button>';
          body.querySelector('#impGo').addEventListener('click', function () {
            this.disabled = true; this.textContent = '导入中…';
            doImport(pv, null).then(function (log) {
              body.innerHTML = '<div class="probe" style="background:#0f2233;color:#9fe3b8;border-radius:8px;padding:10px;font-size:12px;white-space:pre-wrap;max-height:220px;overflow-y:auto">' + esc(log.join('\n')) + '</div>';
              if (window.showToast) window.showToast('导入完成', 'success');
            });
          });
        } catch (e) { if (window.showToast) window.showToast('解析失败：' + e.message, 'error'); }
      };
      rd.readAsText(f, 'utf-8');
    });
  }

  /* ===== v432 #40：图片体检——巡检所有资源引用的图片，失效列清单（按需触发） ===== */
  function imgCheck() {
    var list = [];
    var seen = {};
    var push = function (src, where) {
      if (!src || seen[src]) return; seen[src] = 1;
      list.push({ src: src, where: where });
    };
    ((window.state && state.products) || []).forEach(function (p) {
      push(p.img, '「' + (p.title || p.id) + '」封面');
      (p.coverImages || []).forEach(function (u) { push(u, '「' + (p.title || p.id) + '」封面组'); });
      (p.detailImages || []).forEach(function (u) { push(u, '「' + (p.title || p.id) + '」详情图'); });
    });
    if (!list.length) { if (window.showToast) window.showToast('当前没有可检查的图片', 'info'); return; }
    if (window.showToast) window.showToast('正在检查 ' + list.length + ' 张图片…', 'info');
    var broken = [], done = 0;
    list.forEach(function (it) {
      var im = new Image();
      var fin = function (ok) {
        done++;
        if (!ok) broken.push(it.where + '：' + it.src);
        if (done === list.length) {
          var msg = broken.length ? '发现 ' + broken.length + ' 张失效图：\n' + broken.join('\n') : '全部 ' + list.length + ' 张图片正常 ✓';
          try {
            var mask = document.createElement('div');
            mask.className = 'modal-mask'; mask.id = 'imgCheckMask';
            mask.innerHTML = '<div class="modal-box"><button class="modal-close-x" data-x="1"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button><h2 class="modal-title">图片体检结果</h2><div class="probe" style="background:#0f2233;color:' + (broken.length ? '#ffb4a2' : '#9fe3b8') + ';border-radius:8px;padding:10px;font-size:12px;white-space:pre-wrap;max-height:300px;overflow-y:auto">' + esc(msg) + '</div></div>';
            document.body.appendChild(mask);
            requestAnimationFrame(function () { mask.classList.add('open'); });
            mask.addEventListener('click', function (e) { if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); }, 200); } });
          } catch (e2) { if (window.showToast) window.showToast(msg, broken.length ? 'error' : 'success'); }
        }
      };
      im.onload = function () { fin(true); };
      im.onerror = function () { fin(false); };
      setTimeout(function () { if (!im.complete) fin(false); }, 8000);
      im.src = it.src;
    });
  }

  /* 平台设置页挂入口键 */
  (function wait() {
    var row = document.querySelector('#panel-settings .setting-row');
    if (row && !document.getElementById('batchImportBtn')) {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn-blue btn-inline-pd'; btn.id = 'batchImportBtn'; btn.textContent = '批量导入';
      btn.addEventListener('click', openWizard);
      row.appendChild(btn);
      /* v432 #40：图片体检键（同一行） */
      var chk = document.createElement('button');
      chk.type = 'button'; chk.className = 'btn-blue btn-inline-pd'; chk.id = 'imgCheckBtn'; chk.textContent = '图片体检';
      chk.addEventListener('click', imgCheck);
      row.appendChild(chk);
      return;
    }
    setTimeout(wait, 300);
  })();
})();
