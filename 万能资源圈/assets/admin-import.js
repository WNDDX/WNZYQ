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

  /* 生成 SpreadsheetML 模板：资源/分类/公告 三表 + 选项表（下拉源） + 使用说明
     v436b（老板拍板）大改：①列名专业化不带括号描述 ②下拉=真 Excel 数据验证（分类/级别/显示状态全部选不用填）
     ③全部单元格居中（对齐数据统计导出）④每表首行冻结 ⑤文件名与统计导出同规格「年月日-时分-批量导入模板」 */
  function buildTemplate() {
    var opts = catOptions();
    var lv = ['一级分类', '二级分类'], st = ['显示', '隐藏'];
    var d2 = new Date(), pd = function (n) { return n < 10 ? '0' + n : '' + n; };
    var fname = '' + d2.getFullYear() + pd(d2.getMonth() + 1) + pd(d2.getDate()) + '-' + pd(d2.getHours()) + pd(d2.getMinutes()) + '-批量导入模板.xls';
    var nOpt = Math.max(opts.length, 1);
    var escR = function (r) { return '<Row>' + r.map(function (c) { return '<Cell ss:StyleID="c"><Data ss:Type="String">' + esc(c) + '</Data></Cell>'; }).join('') + '</Row>'; };
    var head = function (arr) { return '<Row>' + arr.map(function (h) { return '<Cell ss:StyleID="h"><Data ss:Type="String">' + esc(h) + '</Data></Cell>'; }).join('') + '</Row>'; };
    var freeze = '<x:WorksheetOptions xmlns:x="urn:schemas-microsoft-com:office:excel"><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>1</x:SplitHorizontal><x:TopRowBottomPane>1</x:TopRowBottomPane><x:ActivePane>2</x:ActivePane><x:Panes><x:Pane><x:Number>3</x:Number></x:Pane><x:Pane><x:Number>2</x:Number></x:Pane></x:Panes></x:WorksheetOptions>';
    var dv = function (formula) { return '<DataValidation ss:Type="List" ss:AllowBlank="yes"><x1:Formula1>' + esc(formula) + '</x1:Formula1></DataValidation>'; };
    var sheet = function (name, rows, validations) {
      return '<Worksheet ss:Name="' + esc(name) + '"><Table>' + rows.join('') + '</Table>' + validations + freeze + '</Worksheet>';
    };
    var optRows = [head(['分类选项', '分类级别选项', '显示状态选项'])]
      .concat(opts.map(function (n2, i) { return escR([n2, i === 0 ? lv[0] : '', i === 0 ? st[0] : '']); }))
      .concat([escR(['', lv[0], st[0]]), escR(['', lv[1], st[1]])]);
    var helpRows = [
      head(['批量导入使用说明']),
      escR(['1. 三张工作表（资源/分类/公告）各自独立导入，不留空的行才会导入，整行留空自动跳过。']),
      escR(['2. 带「选项」下拉的列：点击单元格会出现下拉箭头，直接选当前系统已有的值，不要手打。']),
      escR(['3. 导入顺序：先填好并导入「分类」表，再导入「资源」表（资源的所属分类从下拉里选，必须是已存在的分类）。']),
      escR(['4. 资源价格留空 = 免费；填数字 = 收费金额（单位：元）。']),
      escR(['5. 显示状态选「隐藏」的资源/分类/公告导入后不对外展示，可随时在后台改回显示。']),
      escR(['6. 资源码留空 = 该类型无资源码；填写则用户需凭码解锁。']),
      escR(['7. 上传本文件后系统先预览校验，错误行会标红提示原因，确认无误才入库。'])
    ];
    var xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>' +
      '<Workbook xmlns="' + NS + '" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x1="urn:schemas-microsoft-com:office:excel">' +
      '<Styles>' +
      '<Style ss:ID="h"><Font ss:Bold="1"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>' +
      '<Style ss:ID="c"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>' +
      '</Styles>' +
      sheet('资源', [head(['资源标题', '所属分类', '资源简介', '资源价格', '封面图片链接', '资源码', '显示状态']),
        '<Row>' + '<Cell ss:StyleID="c"></Cell>'.repeat(7) + '</Row>'],
        dv('选项!$A$2:$A$' + (nOpt + 1))) +
      sheet('分类', [head(['分类名称', '分类级别', '所属一级分类', '排序序号', '显示状态']),
        '<Row>' + '<Cell ss:StyleID="c"></Cell>'.repeat(5) + '</Row>'],
        dv('选项!$B$2:$B$3') + dv('选项!$A$2:$A$' + (nOpt + 1)) + dv('选项!$C$2:$C$3')) +
      sheet('公告', [head(['公告标题', '公告内容', '排序序号', '显示状态']),
        '<Row>' + '<Cell ss:StyleID="c"></Cell>'.repeat(4) + '</Row>'],
        dv('选项!$C$2:$C$3')) +
      sheet('选项', optRows, '') +
      sheet('使用说明', helpRows, '') +
      '</Workbook>';
    return { xml: xml, name: fname };
  }

  function download(name, content) { try { window.__tplName = name; } catch (e0) {} /* v437 探针可读文件名 */
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

  /* 入库：分类→资源→公告（v431b：api() 是 admin-1 闭包内函数拿不到，改原生 fetch 同源带会话）
     v439 #69：加 onLog 回调——每条导入完成立即上报（实时回显，不等全部结束） */
  function apiCall(path, opts) {
    opts = opts || {};
    return fetch('/api/' + path, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: opts.body })
      .then(function (r) { return r.json(); });
  }
  function doImport(data, onLog) {
    var seq = Promise.resolve();
    var log = [];
    var say = function (line) { log.push(line); if (onLog) try { onLog(line); } catch (e) {} };
    var catIdByName = {};
    ((window.state && state.categories) || []).forEach(function (c) { catIdByName[c.name] = c.id; });
    (data['分类'] || []).forEach(function (r) {
      if (!r[0]) return;
      seq = seq.then(function () {
        var pid = 0;
        if (r[2]) { pid = catIdByName[r[2]] || 0; if (!pid) { var _w = '分类「' + r[0] + '」：所属一级「' + r[2] + '」未找到，按一级导入'; log.push(_w); if (onLog) try { onLog(_w); } catch (e1) {} } }
        return apiCall('admin/categories', { method: 'POST', body: JSON.stringify({ name: r[0], parent_id: pid, sort: Number(r[3]) || 0, hidden: /隐藏/.test(r[4] || '') ? 1 : 0 }) });
      }).then(function (x) { if (x && x.ok) catIdByName[r[0]] = x.id; say('分类「' + r[0] + '」' + (x && x.ok ? '✓' : '失败')); }).catch(function () { say('分类「' + r[0] + '」失败'); });
    });
    (data['资源'] || []).forEach(function (r) {
      if (!r[0]) return;
      seq = seq.then(function () { return apiCall('admin/products', { method: 'POST', body: JSON.stringify({ title: r[0], desc: r[2] || '', price: Number(r[3]) || 0, img: r[4] || '', hidden: /隐藏/.test(r[6] || '') ? 1 : 0 }) }); }).then(function (x) {
        if (!(x && x.ok)) { say('资源「' + r[0] + '」失败'); return; }
        /* v440 复检修正：导入表「资源码」列不再静默丢弃——带码时自动建一个默认类型并写入码 */
        var code = String(r[5] || '').trim();
        if (!code) { say('资源「' + r[0] + '」✓'); return; }
        return apiCall('admin/variants', { method: 'POST', body: JSON.stringify({ productId: x.id, name: '默认类型', resourceCode: code }) }).then(function (y) {
          say('资源「' + r[0] + '」✓（含码）');
        }).catch(function () { say('资源「' + r[0] + '」✓（码写入失败，请手动补）'); });
      }).catch(function () { say('资源「' + r[0] + '」失败'); });
    });
    (data['公告'] || []).forEach(function (r) {
      if (!r[0]) return;
      seq = seq.then(function () { return apiCall('admin/settings', { method: 'POST', body: JSON.stringify({ annAdd: { title: r[0], content: r[1] || '', sort: Number(r[2]) || 0, hidden: /隐藏/.test(r[3] || '') ? 1 : 0 } }) }); }).then(function (x) { say('公告「' + r[0] + '」' + (x && x.ok ? '✓' : '失败')); }).catch(function () { say('公告「' + r[0] + '」失败'); });
    });
    return seq.then(function () { return log; });
  }

  /* 向导弹窗（复用 modal 骨架） */
  function openWizard() {
    var old = document.getElementById('importMask');
    if (old) old.remove();
    var mask = document.createElement('div');
    mask.className = 'modal-mask'; mask.id = 'importMask';
    mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="批量导入"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">批量导入</h2><div class="form" id="impBody">' +
      '<p style="font-size:13px;color:#5b7083;margin:0 0 10px">第 1 步：下载模板（分类列已带下拉，选就行）→ 填好 → 第 2 步上传 → 预览无误后导入。</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-blue btn-inline" id="impTpl" style="flex:1">下载模板</button>' +
      '<label class="btn-blue btn-inline" for="impFile" style="flex:1;display:flex;align-items:center;justify-content:center;cursor:pointer;margin:0">上传表格<input type="file" id="impFile" accept=".xls,.xml" style="display:none"></label></div>' +
      '<div id="impPrev" style="margin-top:10px"></div></div></div>';
    document.body.appendChild(mask);
    requestAnimationFrame(function () {
      mask.classList.add('open');
      try { var xb = mask.querySelector('[data-x]'); if (xb) xb.focus({ preventScroll: true }); } catch (eF) {} /* v439 #84 */
    });
    if (window.lockBodyScroll) window.lockBodyScroll(true);
    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); }
    });
    mask.querySelector('#impTpl').addEventListener('click', function () { var tpl = buildTemplate(); download(tpl.name, tpl.xml); if (window.showToast) window.showToast('模板已下载（分类/级别/显示状态均为下拉）', 'success'); });
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
            /* v439 #69：实时回显——每条导入完成立即上屏（成功绿/失败红），不等全部结束 */
            body.innerHTML = '<div id="impLive" style="background:#0f2233;color:#9fe3b8;border-radius:8px;padding:10px;font-size:12px;max-height:220px;overflow-y:auto"></div>';
            var live = body.querySelector('#impLive');
            var onLog = function (line) {
              var ln = document.createElement('div');
              var bad = /失败|错误/.test(line);
              ln.textContent = line;
              ln.style.color = bad ? '#ef9a9a' : '#9fe3b8';
              live.appendChild(ln);
              try { live.scrollTop = live.scrollHeight; } catch (e2) {}
            };
            doImport(pv, onLog).then(function (log) {
              var badN = log.filter(function (l) { return /失败|错误/.test(l); }).length;
              var sum = document.createElement('div');
              sum.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px solid #223a52;color:' + (badN ? '#ef9a9a' : '#9fe3b8') + ';font-weight:bold';
              sum.textContent = '导入完成：' + log.length + ' 条' + (badN ? '（失败 ' + badN + ' 条）' : '，全部成功');
              live.appendChild(sum);
              try { live.scrollTop = live.scrollHeight; } catch (e3) {}
              if (window.showToast) window.showToast(badN ? '导入完成，有失败项请看明细' : '导入完成', badN ? 'info' : 'success');
            });
          });
        } catch (e) { if (window.showToast) window.showToast('解析失败：' + e.message, 'error'); }
      };
      rd.readAsText(f, 'utf-8');
    });
  }

  /* ===== v438 系统体检（v439 增强）：①失效图片（缩略图+一键定位到资源编辑）
     ②重复图片引用 ③外链可达性检测 ④#115 环境检查（后端/SW/缓存/存储）⑤#79 超大图（>1MB，可压缩替换+可恢复）
     silent=true（#80 每日自动体检）：不弹窗不提示，只返回结果 ===== */
  function sysCheck(silent) {
    return new Promise(function (resolve) {
      var products = (window.state && state.products) || [];
      if (!products.length) { if (!silent && window.showToast) window.showToast('当前没有资源可检查', 'info'); resolve(null); return; }
      var imgs = [];
      products.forEach(function (p) {
        var pname = '「' + (p.title || ('资源#' + p.id)) + '」';
        var addImg = function (src, pos, field, idx) { if (src) imgs.push({ src: src, where: pname + pos, pid: p.id, field: field, idx: idx }); };
        addImg(p.img, '封面', 'img', -1);
        (p.coverImages || []).forEach(function (u, i) { addImg(u, '封面组', 'cover_images', i); });
        (p.detailImages || []).forEach(function (u, i) { addImg(u, '详情图', 'detail_images', i); });
      });
      /* 外链收集（资源详情 + 类型专属内容里的 http 链接） */
      var links = []; var linkKey = {};
      products.forEach(function (p) {
        var pname = '「' + (p.title || ('资源#' + p.id)) + '」';
        var htmls = [p.detail || ''];
        (p.variants || []).forEach(function (v) { if (v.resourceContent) htmls.push(v.resourceContent); });
        htmls.forEach(function (h) {
          try {
            var dv = document.createElement('div'); dv.innerHTML = h;
            Array.prototype.forEach.call(dv.querySelectorAll('a[href]'), function (a) {
              var href = a.getAttribute('href') || '';
              if (/^https?:\/\//i.test(href) && href.indexOf(location.host) < 0) {
                var k = href + '|' + p.id;
                if (!linkKey[k]) { linkKey[k] = 1; links.push({ href: href, where: pname }); }
              }
            });
          } catch (e0) { if (window.__silent) window.__silent(e0); }
        });
      });
      if (!imgs.length && !links.length) { if (!silent && window.showToast) window.showToast('当前没有可检查的图片和外链', 'info'); resolve(null); return; }
      if (!silent && window.showToast) window.showToast('系统体检中：图片 ' + imgs.length + ' 张 · 外链 ' + links.length + ' 条…', 'info');

      /* 图片按 URL 去重并发检测；引用关系统计重复；同趟 fetch 测体积（#79 超大图） */
      var refMap = {};
      imgs.forEach(function (it) { (refMap[it.src] = refMap[it.src] || []).push(it); });
      var testList = Object.keys(refMap).map(function (src) { return { src: src, refs: refMap[src] }; });
      var broken = [], oversize = [], done = 0, total = testList.length;
      /* v438b：双阶段齐活再渲染（图片+外链都回来才算完）；v439 #79：同源图 fetch 测大小 */
      var imgDone = new Promise(function (res) { window.__sysImgFinish = res; });
      var linkDone = Promise.all(links.map(function (L) {
        return Promise.race([
          fetch(L.href, { mode: 'no-cors', cache: 'no-store' }).then(function () { L.ok = true; }).catch(function () { L.ok = false; }),
          new Promise(function (res) { setTimeout(function () { L.ok = res(false) || L.ok === true; }, 6000); })
        ]);
      })).then(function () { return links; });
      var finish = function () {
        if (done < total) return;
        window.__sysImgFinish();
      };
      testList.forEach(function (it) {
        var im = new Image();
        var fin = function (ok) { done++; if (!ok) broken.push(it); finish(); };
        im.onload = function () { fin(true); };
        im.onerror = function () { fin(false); };
        setTimeout(function () { if (!im.complete) fin(false); }, 8000);
        im.src = it.src;
        /* #79 超大图：同源（/img/、相对路径）才 fetch 测体积，跨域拿不到就算了 */
        if (/^\/|^\./i.test(it.src) || it.src.indexOf(location.host) >= 0) {
          fetch(it.src, { cache: 'force-cache' }).then(function (r) { return r.blob(); }).then(function (bl) {
            it.size = bl.size; if (bl.size > 1024 * 1024) oversize.push(it); finish2();
          }).catch(function () { finish2(); });
        } else setTimeout(finish2, 0);
      });
      var done2 = 0;
      var finish2 = function () { done2++; };
      var sizeDone = new Promise(function (res) {
        var t = setInterval(function () { if (done2 >= total) { clearInterval(t); res(); } }, 120);
        setTimeout(function () { clearInterval(t); res(); }, 9000);
      });
      if (!total) finish();
      Promise.all([imgDone, linkDone, sizeDone]).then(function () {
        /* 重复引用：同 URL 被 2 处以上引用 */
        var dups = testList.filter(function (t) { return t.refs.length > 1; });
        /* #115 环境检查（并行四项） */
        var envJobs = [
          fetch('/api/health', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (h) {
            return { name: '后端连通', ok: !!(h && h.ok && h.ready), detail: (h && h.ready) ? '数据库就绪' : ((h && h.msg) || '未就绪（首次部署请先初始化）') };
          }).catch(function () { return { name: '后端连通', ok: false, detail: '接口不通' }; }),
          (navigator.serviceWorker ? navigator.serviceWorker.getRegistration() : Promise.resolve(null)).then(function (reg) {
            var swUrl = reg && reg.active ? reg.active.scriptURL : '';
            if (!swUrl) return { name: '离线缓存（SW）', ok: false, detail: '未注册' };
            return fetch(swUrl, { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
              var m = /wnzyq-v\d+/.exec(t);
              return { name: '离线缓存（SW）', ok: true, detail: '版本 ' + (m ? m[0] : '未知') };
            }).catch(function () { return { name: '离线缓存（SW）', ok: true, detail: '已注册（版本读取失败）' }; });
          }).catch(function () { return { name: '离线缓存（SW）', ok: false, detail: '浏览器不支持' }; }),
          (window.caches ? caches.keys() : Promise.resolve([])).then(function (keys) {
            return { name: '静态缓存', ok: true, detail: keys.length ? keys.join('、') : '暂无缓存' };
          }).catch(function () { return { name: '静态缓存', ok: false, detail: '不可用' }; }),
          Promise.resolve().then(function () {
            try { localStorage.setItem('__probe', '1'); localStorage.removeItem('__probe');
              return { name: '本地存储', ok: true, detail: 'localStorage / sessionStorage 可用' };
            } catch (e) { return { name: '本地存储', ok: false, detail: '被禁用（无痕模式可能影响登录保持）' }; }
          })
        ];
        Promise.all(envJobs).then(function (env) {
          var R0 = { totalImgs: imgs.length, testList: testList, broken: broken, dups: dups, links: links, oversize: oversize, env: env };
          /* #80：体检提醒标记——有问题记（信息中心提醒），复查正常清除 */
          try {
            var badN = sysAlertCount(R0);
            if (badN > 0) localStorage.setItem('wnzyq_syscheck_alert', JSON.stringify({ day: new Date().toDateString(), n: badN }));
            else localStorage.removeItem('wnzyq_syscheck_alert');
            if (window.__syscheckAlertChanged) window.__syscheckAlertChanged();
          } catch (eAl) {}
          if (silent) { resolve(R0); return; }
          renderSysResult(R0);
          resolve(R0);
        });
      });
    });
  }

  /* #80：体检问题计数（失效图+超大图+死链+环境异常）——提醒标记与信息中心条目共用 */
  function sysAlertCount(R0) {
    return (R0.broken || []).length + (R0.oversize || []).length + (R0.links || []).filter(function (L) { return L.ok === false; }).length + (R0.env || []).filter(function (e) { return !e.ok; }).length;
  }

  /* #79 压缩替换：canvas 压缩（PNG 保 PNG / 其余 JPEG 0.82，最大边 2000）→ 图仓 → 部分更新字段（原图可恢复） */
  function compressBlob(src) {
    return fetch(src, { cache: 'force-cache' }).then(function (r) { return r.blob(); }).then(function (bl) {
      return new Promise(function (res, rej) {
        var im = new Image();
        im.onload = function () {
          try {
            var mx = 2000, sc = Math.min(1, mx / Math.max(im.width, im.height));
            var cv = document.createElement('canvas'); cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
            var isPng = /png/i.test(bl.type);
            cv.toBlob(function (nb) { nb ? res(nb) : rej(new Error('压缩失败')); }, isPng ? 'image/png' : 'image/jpeg', 0.82);
          } catch (e) { rej(e); }
        };
        im.onerror = function () { rej(new Error('图片读取失败')); };
        im.src = src;
      });
    });
  }
  function replaceOversize(it, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '压缩中…'; }
    compressBlob(it.src).then(function (nb) {
      if (!window.__uploadToBucket) throw new Error('上传组件未就绪');
      var fname = 'c' + Date.now() + (/png/i.test(nb.type) ? '.png' : '.jpg');
      return window.__uploadToBucket(new File([nb], fname, { type: nb.type }));
    }).then(function (newUrl) {
      if (!newUrl) throw new Error('上传失败');
      /* 同 URL 的每处引用逐字段部分更新（原图由后端记入 original_urls 可恢复） */
      var seq = Promise.resolve();
      it.refs.forEach(function (ref) {
        seq = seq.then(function () {
          return fetch('/api/admin/products/' + ref.pid, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ partial: 'imgfield', field: ref.field, value: newUrl }) });
        });
      });
      return seq.then(function () { return newUrl; });
    }).then(function (newUrl) {
      it.replaced = newUrl;
      if (window.showToast) window.showToast('已压缩替换，原图已留存可恢复', 'success');
      /* 就地刷新该行状态 */
      var row = btn && btn.closest('[data-osidx]');
      if (row) renderOversizeRowState(row, it);
      if (btn) { btn.disabled = false; btn.textContent = '压缩替换'; }
    }).catch(function (e) {
      if (window.showToast) window.showToast('替换失败：' + (e.message || '未知错误'), 'error');
      if (btn) { btn.disabled = false; btn.textContent = '压缩替换'; }
    });
  }
  function restoreOversize(it, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '恢复中…'; }
    var seq = Promise.resolve();
    it.refs.forEach(function (ref) {
      seq = seq.then(function () {
        return fetch('/api/admin/products/' + ref.pid, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ partial: 'imgrestore', field: ref.field }) });
      });
    });
    seq.then(function () { it.replaced = null;
      if (window.showToast) window.showToast('已恢复原图', 'success');
      var row = btn && btn.closest('[data-osidx]');
      if (row) renderOversizeRowState(row, it);
      if (btn) { btn.disabled = false; btn.textContent = '压缩替换'; }
    }).catch(function () { if (window.showToast) window.showToast('恢复失败', 'error'); if (btn) { btn.disabled = false; btn.textContent = '恢复原图'; } });
  }
  function renderOversizeRowState(row, it) {
    var act = row.querySelector('[data-osact]');
    if (!act) return;
    if (it.replaced) {
      act.innerHTML = '<span style="color:#2e7d32;font-size:11px">✓ 已替换</span> <button type="button" class="btn-blue btn-inline-pd" data-osrestore="1">恢复原图</button>';
      var rb = act.querySelector('[data-osrestore]');
      rb.addEventListener('click', function () { restoreOversize(it, rb); });
    } else {
      act.innerHTML = '<button type="button" class="btn-blue btn-inline-pd" data-osrep="1">压缩替换</button>';
      var pb = act.querySelector('[data-osrep]');
      pb.addEventListener('click', function () { replaceOversize(it, pb); });
    }
  }
  /* 恢复历史：刷新体检时若上次替换过，从后端 original_urls 读不回前端状态——改为结果行打开时查一次（简化：本次会话内 it.replaced 记忆，跨会话点「压缩替换」重新替换原图也无损） */

  function renderSysResult(R0) {
    var old = document.getElementById('sysCheckMask'); if (old) old.remove();
    var brokenRows = R0.broken.map(function (it) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #223a52">' +
        '<span style="width:40px;height:40px;flex:none;background:#33202a;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#e57373;font-size:16px">✕</span>' +
        '<span style="flex:1;min-width:0"><b style="color:#ffcdd2">' + esc(it.refs[0].where) + '</b><br><span style="color:#8aa0b5;word-break:break-all;font-size:11px">' + esc(it.src) + '</span></span>' +
        '<button type="button" class="btn-blue btn-inline-pd" data-goto-pid="' + esc(String(it.refs[0].pid)) + '" style="flex:none">去处理</button></div>';
    }).join('');
    var dupRows = R0.dups.map(function (it) {
      var wheres = it.refs.map(function (r) { return r.where; }).join('、');
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #223a52">' +
        '<img src="' + esc(it.src) + '" style="width:40px;height:40px;flex:none;object-fit:cover;border-radius:4px" onerror="this.style.visibility=\'hidden\'">' +
        '<span style="flex:1;min-width:0"><b style="color:#ffe082">被 ' + it.refs.length + ' 处引用</b><br><span style="color:#8aa0b5;font-size:11px">' + esc(wheres) + '</span></span></div>';
    }).join('');
    var badLinks = R0.links.filter(function (L) { return L.ok === false; });
    var okLinks = R0.links.filter(function (L) { return L.ok === true; }).length;
    var linkRows = badLinks.map(function (L) {
      return '<div style="padding:6px 0;border-bottom:1px solid #223a52"><b style="color:#ffcdd2">' + esc(L.where) + '</b><br><span style="color:#8aa0b5;word-break:break-all;font-size:11px">' + esc(L.href) + '</span></div>';
    }).join('');
    /* #79 超大图分组（>1MB，可压缩替换+恢复原图） */
    var osRows = (R0.oversize || []).map(function (it, oi) {
      return '<div data-osidx="' + oi + '" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #223a52">' +
        '<img src="' + esc(it.src) + '" style="width:40px;height:40px;flex:none;object-fit:cover;border-radius:4px" onerror="this.style.visibility=\'hidden\'">' +
        '<span style="flex:1;min-width:0"><b style="color:#ffcc80">' + esc(it.refs[0].where) + '</b> <span style="color:#ffe082;font-size:11px">' + (it.size ? (it.size / 1024 / 1024).toFixed(2) + ' MB' : '') + '</span><br><span style="color:#8aa0b5;word-break:break-all;font-size:11px">' + esc(it.src) + '</span></span>' +
        '<span data-osact="1" style="flex:none"></span></div>';
    }).join('');
    var badEnv = (R0.env || []).filter(function (e) { return !e.ok; });
    var envRows = (R0.env || []).map(function (e) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #223a52;font-size:12px">' +
        '<span style="flex:none;color:' + (e.ok ? '#9fe3b8' : '#e57373') + '">' + (e.ok ? '✓' : '✕') + '</span>' +
        '<b style="flex:none;color:' + (e.ok ? '#c9e7d4' : '#ffcdd2') + '">' + esc(e.name) + '</b>' +
        '<span style="flex:1;min-width:0;color:#8aa0b5;text-align:right">' + esc(e.detail) + '</span></div>';
    }).join('');
    var sec = function (title, color, body, note) {
      if (!body) return '';
      return '<div style="margin-bottom:12px"><b style="color:' + color + ';font-size:13px">' + title + '</b>' + (note ? '<span style="font-size:11px;color:#8aa0b5;margin-left:8px">' + note + '</span>' : '') + '<div style="margin-top:4px">' + body + '</div></div>';
    };
    /* 环境检查分组（#115）：四项有一项不对也常驻展示 */
    var envSec = sec('⚙ 环境检查 ' + ((R0.env || []).length - badEnv.length) + '/' + (R0.env || []).length + ' 项正常', badEnv.length ? '#ef9a9a' : '#9fe3b8', envRows, '后端 / 离线缓存 / 静态缓存 / 本地存储');
    var body = envSec +
      sec('✕ 失效图片 ' + R0.broken.length + ' 张（点「去处理」直接打开对应资源编辑）', '#ef9a9a', brokenRows) +
      sec('⧉ 重复图片引用 ' + R0.dups.length + ' 组（同图多处使用，确认是否故意）', '#ffe082', dupRows) +
      sec('⚠ 疑似失效外链 ' + badLinks.length + ' 条（域名无法访问；跨域限制下仅测域名可达性，HTTP 状态码拿不到）', '#ef9a9a', linkRows) +
      sec('🖼 超大图片 ' + (R0.oversize || []).length + ' 张（超 1MB 拖慢加载；「压缩替换」自动压到 2000px 内，原图留存可随时恢复）', '#ffcc80', osRows, '跨域图片拿不到体积，不在检测范围');
    var hasIssue = R0.broken.length || R0.dups.length || badLinks.length || (R0.oversize || []).length || badEnv.length;
    if (!hasIssue) body = '<div style="text-align:center;padding:20px 0;color:#9fe3b8">全部正常 ✓ 图片 ' + R0.totalImgs + ' 张 · 外链 ' + okLinks + '/' + R0.links.length + ' 条可达 · 环境 ' + (R0.env || []).length + '/' + (R0.env || []).length + '</div>';
    var mask = document.createElement('div');
    mask.className = 'modal-mask'; mask.id = 'sysCheckMask';
    mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="系统体检结果"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">系统体检结果</h2>' +
      '<div style="font-size:12px;color:#8aa0b5;margin:0 0 10px">图片 ' + R0.totalImgs + ' 张（失效 ' + R0.broken.length + '）· 重复引用 ' + R0.dups.length + ' 组 · 外链 ' + R0.links.length + ' 条（疑似失效 ' + badLinks.length + '）· 超大图 ' + (R0.oversize || []).length + ' 张</div>' +
      '<div style="max-height:46vh;overflow-y:auto;background:#0f2233;border-radius:8px;padding:10px 12px;font-size:12px">' + body + '</div></div>';
    document.body.appendChild(mask);
    requestAnimationFrame(function () {
      mask.classList.add('open');
      try { var xb = mask.querySelector('[data-x]'); if (xb) xb.focus({ preventScroll: true }); } catch (eF) {} /* v439 #84：弹窗打开聚焦关闭键 */
    });
    /* #79 超大图行动作绑定（按 data-osidx 直接取对象） */
    Array.prototype.forEach.call(mask.querySelectorAll('[data-osidx]'), function (row) {
      var it = (R0.oversize || [])[Number(row.getAttribute('data-osidx'))];
      if (!it) return;
      renderOversizeRowState(row, it);
    });
    mask.addEventListener('click', function (e) {
      var go = e.target.closest && e.target.closest('[data-goto-pid]');
      if (go) { gotoEditProduct(go.getAttribute('data-goto-pid')); return; }
      if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); }, 200); }
    });
  }

  /* 定位：关体检弹窗 → 切资源管理 → 找到资源行高亮 → 打开编辑弹窗 */
  function gotoEditProduct(pid) {
    var mask = document.getElementById('sysCheckMask');
    if (mask) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); }, 200); }
    var tab = document.querySelector('.tab[data-tab="products"]'); if (tab) tab.click();
    setTimeout(function () {
      var row = document.querySelector('#productList [data-id="' + pid + '"]');
      if (!row) { if (window.showToast) window.showToast('该资源不在当前列表页（可能被筛选/翻页），请找到后编辑', 'info'); return; }
      try { row.scrollIntoView({ block: 'center' }); } catch (e1) {}
      row.style.boxShadow = '0 0 0 3px rgba(30,136,229,.55)'; row.style.transition = 'box-shadow .3s';
      setTimeout(function () { row.style.boxShadow = ''; }, 1600);
      var eb = null; Array.prototype.forEach.call(row.querySelectorAll('button'), function (b) { if (!eb && b.textContent.trim() === '编辑') eb = b; });
      if (eb) eb.click(); else if (window.showToast) window.showToast('已定位到资源行', 'success');
    }, 500);
  }


  /* ===== v439 #116 子账号管理（拍板 v3：三把锁/层级不限/绝对管理权） ===== */
  var USERS_ACTS = [
    ['products.view', '看资源'], ['products.add', '新增资源'], ['products.edit', '编辑资源'], ['products.price', '改价'],
    ['products.online', '上下架'], ['products.del', '删除（进回收站）'], ['products.restore', '恢复'], ['products.purge', '彻底删除'],
    ['products.moveCat', '挪分类'],
    ['cats.view', '看分类'], ['cats.add', '新增分类'], ['cats.edit', '改分类'], ['cats.del', '删分类'],
    ['ann.view', '看公告'], ['ann.add', '发公告'], ['ann.edit', '改公告'], ['ann.del', '删公告'],
    ['batch.import', '批量导入'], ['batch.price', '批量改价'], ['batch.online', '批量上下架'], ['batch.del', '批量删除'],
    ['data.stats', '看统计总量'], ['data.detail', '看逐条明细'], ['data.ip', '看访客 IP'], ['data.export', '数据导出'],
    ['info.view', '信息中心'], ['users', '管理下级账号'],
  ];
  function usersCall(method, body, done, fail) {
    fetch('/api/admin/users', { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json(); })
      .then(function (x) { if (x && x.ok) { if (done) done(x); } else { if (window.showToast) window.showToast((x && x.msg) || '操作失败', 'error'); if (fail) fail(x); } })
      .catch(function () { if (window.showToast) window.showToast('网络开小差了，请稍后再试', 'error'); if (fail) fail(); });
  }
  function openUsers() {
    var old = document.getElementById('usersMask'); if (old) old.remove();
    var mask = document.createElement('div');
    mask.className = 'modal-mask'; mask.id = 'usersMask';
    mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="子账号管理"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">子账号管理</h2><div class="form" id="usBody">' +
      '<div style="text-align:center;color:#8aa0b5;font-size:13px;padding:14px 0">加载中…</div></div></div>';
    document.body.appendChild(mask);
    requestAnimationFrame(function () {
      mask.classList.add('open');
      try { var xb = mask.querySelector('[data-x]'); if (xb) xb.focus({ preventScroll: true }); } catch (eF) {}
    });
    if (window.lockBodyScroll) window.lockBodyScroll(true);
    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); }
    });
    renderUsersList();
  }
  function renderUsersList() {
    var body = document.getElementById('usBody'); if (!body) return;
    fetch('/api/admin/users', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (x) {
      if (!x || !x.ok) { body.innerHTML = '<div style="text-align:center;color:#c62828;font-size:13px;padding:14px 0">' + esc((x && x.msg) || '加载失败') + '</div>'; return; }
      var me = x.me || {};
      window.__usList = x.list || [];
      var isSuper = me.role === 'super';
      var rows = (x.list || []).map(function (u) {
        var st = u.status ? '<span style="color:#2e7d32;font-size:11px">启用</span>' : '<span style="color:#c62828;font-size:11px">停用</span>';
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #eef2f6">' +
          '<span style="flex:1;min-width:0;font-size:13px"><b>' + esc(u.username) + '</b>' + (u.note ? ' <span style="color:#9aa9b8;font-size:11px">' + esc(u.note) + '</span>' : '') +
          '<br><span style="color:#9aa9b8;font-size:11px">' + st + ' · 最近活跃 ' + esc((u.lastSeen || '—').slice(0, 16)) + ' · 下级 ' + (u.subtreeCount || 0) + '</span></span>' +
          '<button type="button" class="btn-blue btn-inline-pd" data-ua="edit" data-id="' + u.id + '">编辑</button>' +
          '<button type="button" class="btn-blue btn-inline-pd" data-ua="pwd" data-id="' + u.id + '">改密</button>' +
          '<button type="button" class="btn-blue btn-inline-pd" data-ua="status" data-id="' + u.id + '" data-st="' + (u.status ? 0 : 1) + '">' + (u.status ? '停用' : '启用') + '</button>' +
          '<button type="button" class="btn-blue btn-inline-pd" data-ua="del" data-id="' + u.id + '" data-n="' + (u.childrenCount || 0) + '" data-nsub="' + (u.subtreeCount || 0) + '" style="color:#c62828;border-color:#c62828">删除</button></div>';
      }).join('');
      body.innerHTML =
        (isSuper ? '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#fff6e8;border:1px solid #f0c896;border-radius:10px;margin-bottom:10px;font-size:12px">' +
          '<span style="flex:1;color:#8a5a00"><b>应急冻结</b>：一键停用全部子账号（您自己不受影响）</span>' +
          '<button type="button" class="btn-blue btn-inline-pd" id="usFreeze">' + (window.__subFreeze ? '解除冻结' : '立即冻结') + '</button></div>' : '') +
        '<div style="margin-bottom:10px;text-align:right"><button type="button" class="btn-blue btn-inline-pd" id="usAdd">+ 新增子账号</button></div>' +
        (rows || '<div style="text-align:center;color:#8aa0b5;font-size:12px;padding:10px 0">还没有子账号</div>');
      var addBtn = body.querySelector('#usAdd');
      if (addBtn) addBtn.addEventListener('click', function () { usersForm(null); });
      var fz = body.querySelector('#usFreeze');
      if (fz) fz.addEventListener('click', function () {
        var on = !window.__subFreeze;
        if (window.showConfirm) {
          window.showConfirm(on ? '应急冻结' : '解除冻结', on ? '将立即停用全部子账号的登录与操作，确定？' : '将恢复全部子账号，确定？', function (cc) {
            cc();
            apiSettingsPut({ sub_freeze: on ? '1' : '0' }, function () { window.__subFreeze = on; renderUsersList(); if (window.showToast) window.showToast(on ? '已冻结全部子账号' : '已解除冻结', 'success'); });
          });
        } else { apiSettingsPut({ sub_freeze: on ? '1' : '0' }, function () { window.__subFreeze = on; renderUsersList(); }); }
      });
      body.querySelectorAll('[data-ua]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = Number(this.getAttribute('data-id'));
          var ua = this.getAttribute('data-ua');
          var list = (window.__usList || []);
          var u = list.filter(function (x) { return x.id === id; })[0] || {};
          if (ua === 'edit') usersForm(u);
          else if (ua === 'pwd') {
            var np = prompt('给「' + u.username + '」设置新密码（6-50 位）：');
            if (np != null && np.length >= 6) usersCall('PUT', { id: id, op: 'resetpwd', password: np }, function () { if (window.showToast) window.showToast('密码已重置，该账号已强制下线', 'success'); });
            else if (np !== null && window.showToast) window.showToast('密码至少 6 位', 'error');
          }
          else if (ua === 'status') usersCall('PUT', { id: id, op: 'status', status: Number(this.getAttribute('data-st')) }, function () { renderUsersList(); });
          else if (ua === 'del') {
            var n = Number(this.getAttribute('data-n')) || 0;
            if (window.showConfirm) {
              window.showConfirm('删除子账号', '删除「' + (u.username || '') + '」？' + (n > 0 ? '其 ' + n + ' 个直接下级账号将统一成为超级管理员的下级。' : '') + '该账号的留痕记录保留 60 天。', function (cc) {
                cc();
                usersCall('DELETE', null, function () { renderUsersList(); if (window.showToast) window.showToast('已删除', 'success'); });
              });
            } else usersCall('DELETE', null, function () { renderUsersList(); });
          }
        });
      });
      /* 冻结状态读取（一次） */
      if (isSuper && window.__subFreeze === undefined) {
        fetch('/api/admin/settings', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (sx) {
          try { window.__subFreeze = JSON.parse('{' + '"v":"' + String(((sx.settings || {}).sub_freeze || '0')).replace(/"/g, '') + '"}').v === '1'; } catch (e) { window.__subFreeze = false; }
          if (window.__subFreeze) renderUsersList();
        }).catch(function () {});
      }
    }).catch(function () { var b = document.getElementById('usBody'); if (b) b.innerHTML = '<div style="text-align:center;color:#c62828;font-size:13px;padding:14px 0">加载失败</div>'; });
  }
  function apiSettingsPut(data, done) {
    fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) })
      .then(function (r) { return r.json(); }).then(function (x) { if (x && x.ok) { if (done) done(x); } else if (window.showToast) window.showToast((x && x.msg) || '保存失败', 'error'); })
      .catch(function () { if (window.showToast) window.showToast('网络开小差了', 'error'); });
  }
  function usersForm(u) {
    var isEdit = !!(u && u.id);
    var perms = {};
    try { perms = (isEdit ? (typeof u.perms === 'string' ? JSON.parse(u.perms) : (u.perms || {})) : {}) || {}; } catch (e) { perms = {}; }
    var gval = function (grp, key) { try { return !!(perms[grp] || {})[key]; } catch (e) { return false; } };
    var catsScope = perms.catsScope === 'all' || !isEdit ? 'all' : (Array.isArray(perms.catsScope) ? perms.catsScope : 'all');
    var codeScope = perms.codeScope || 'own';
    var cats = (window.state && window.state.categories) || [];
    var mask = document.createElement('div');
    mask.className = 'modal-mask'; mask.id = 'usFormMask';
    var chk = function (act, lab, on) {
      var dot = String(act).indexOf('.');
      var grp = String(act).slice(0, dot), key = String(act).slice(dot + 1);
      return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;margin:3px 8px 3px 0;cursor:pointer"><input type="checkbox" data-pa="' + grp + '" data-pk="' + key + '"' + (on ? ' checked' : '') + '> ' + lab + '</label>';
    };
    var actsHtml = USERS_ACTS.map(function (a) {
      var on = isEdit ? gval(String(a[0]).slice(0, String(a[0]).indexOf('.')), String(a[0]).slice(String(a[0]).indexOf('.') + 1)) : (a[0] === 'products.view' || a[0] === 'info.view');
      return chk(a[0], a[1], on);
    }).join('');
    var catHtml = cats.map(function (c) {
      var on = Array.isArray(catsScope) ? catsScope.indexOf(c.id) !== -1 : false;
      return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;margin:3px 8px 3px 0;cursor:pointer"><input type="checkbox" data-cat="' + c.id + '"' + (on ? ' checked' : '') + '> ' + esc(c.name || ('分类#' + c.id)) + '</label>';
    }).join('');
    mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="子账号编辑"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">' + (isEdit ? '编辑子账号：' + esc(u.username) : '新增子账号') + '</h2><div class="form" id="usFormBody">' +
      (isEdit ? '' : '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px">用户名（2-20 位字母数字）</label><input id="ufUser" style="width:100%;margin-bottom:8px" maxlength="20">') +
      (isEdit ? '' : '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px">初始密码（6-50 位）</label><input id="ufPwd" type="password" style="width:100%;margin-bottom:8px" maxlength="50">') +
      '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px">备注（这是谁）</label><input id="ufNote" style="width:100%;margin-bottom:10px" maxlength="100" value="' + esc(isEdit ? (u.note || '') : '') + '">' +
      '<b style="display:block;font-size:13px;color:#666;margin-bottom:4px">① 功能权限（勾了才有）</b><div style="margin-bottom:10px">' + actsHtml + '</div>' +
      '<b style="display:block;font-size:13px;color:#666;margin-bottom:4px">② 数据范围（只能碰这些分类）</b>' +
      '<div style="margin-bottom:4px"><label style="font-size:12px;cursor:pointer"><input type="radio" name="ufScope" value="all"' + (catsScope === 'all' ? ' checked' : '') + '> 全部分类</label></div>' +
      '<div style="margin-bottom:4px"><label style="font-size:12px;cursor:pointer"><input type="radio" name="ufScope" value="pick"' + (catsScope !== 'all' ? ' checked' : '') + '> 指定分类（别的分类看不见也不能动）</label></div>' +
      '<div style="margin-bottom:10px">' + (catHtml || '<span style="color:#9aa9b8;font-size:11px">暂无分类可勾</span>') + '</div>' +
      '<b style="display:block;font-size:13px;color:#666;margin-bottom:4px">③ 资源码可见</b>' +
      '<div style="margin-bottom:10px;font-size:12px">' +
      '<label style="margin-right:10px;cursor:pointer"><input type="radio" name="ufCode" value="own"' + (codeScope === 'own' ? ' checked' : '') + '> 只看自己新增的</label>' +
      '<label style="margin-right:10px;cursor:pointer"><input type="radio" name="ufCode" value="scoped"' + (codeScope === 'scoped' ? ' checked' : '') + '> 范围内的都能看</label>' +
      '<label style="cursor:pointer"><input type="radio" name="ufCode" value="all"' + (codeScope === 'all' ? ' checked' : '') + '> 全部都能看</label></div>' +
      '<button type="button" class="btn-blue" id="ufSave" style="width:100%">' + (isEdit ? '保存修改' : '创建子账号') + '</button></div></div>';
    document.body.appendChild(mask);
    requestAnimationFrame(function () {
      mask.classList.add('open');
      try { var xb = mask.querySelector('[data-x]'); if (xb) xb.focus({ preventScroll: true }); } catch (eF) {}
    });
    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); }, 200); }
    });
    mask.querySelector('#ufSave').addEventListener('click', function () {
      var pv = {};
      mask.querySelectorAll('[data-pa]').forEach(function (c) { var g = c.getAttribute('data-pa'), k = c.getAttribute('data-pk'); pv[g] = pv[g] || {}; if (c.checked) pv[g][k] = 1; });
      var scopeMode = (mask.querySelector('input[name="ufScope"]:checked') || {}).value || 'all';
      var catIds = [];
      mask.querySelectorAll('[data-cat]').forEach(function (c) { if (c.checked) catIds.push(Number(c.getAttribute('data-cat'))); });
      pv.catsScope = scopeMode === 'all' ? 'all' : catIds;
      pv.codeScope = (mask.querySelector('input[name="ufCode"]:checked') || {}).value || 'own';
      var note = (mask.querySelector('#ufNote') || {}).value || '';
      var btn = this;
      btn.disabled = true; btn.textContent = '保存中…';
      if (isEdit) {
        usersCall('PUT', { id: u.id, op: 'update', perms: pv, note: note }, function () {
          if (window.showToast) window.showToast('已保存', 'success');
          mask.remove(); renderUsersList();
        }, function () { btn.disabled = false; btn.textContent = '保存修改'; });
      } else {
        var un = (mask.querySelector('#ufUser') || {}).value || '';
        var pw = (mask.querySelector('#ufPwd') || {}).value || '';
        usersCall('POST', { username: un, password: pw, note: note, perms: pv }, function () {
          if (window.showToast) window.showToast('子账号已创建', 'success');
          mask.remove(); renderUsersList();
        }, function () { btn.disabled = false; btn.textContent = '创建子账号'; });
      }
    });
  }

  /* ===== v439 #116 子账号管理入口（平台设置页注入组内） ===== */
  /* ===== v439 #68 回收站：软删的资源/分类/公告在此保留 60 天，可恢复/彻底删除 =====
     复用：modal 骨架、btn-blue 按钮族、showConfirm 二次确认、showToast；到期清理复用 60 天口径 */
  function fmtDelTime(t) {
    var s = String(t || '').replace('T', ' ').replace('Z', '');
    return s.length > 16 ? s.slice(0, 16) : (s || '—');
  }
  function recycleCall(op, kind, id, done) {
    fetch('/api/admin/recycle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ op: op, kind: kind, id: id }) })
      .then(function (r) { return r.json(); })
      .then(function (x) {
        if (x && x.ok) {
          if (kind === 'product' && op === 'restore' && window.__reloadAdminProducts) { try { window.__reloadAdminProducts(); } catch (e0) {} }
          if (window.showToast) window.showToast(op === 'restore' ? '已恢复' : '已彻底删除', 'success'); /* #68：入口名=数据缓存，弹窗内仍表述回收站概念 */
          if (done) done();
        } else if (window.showToast) window.showToast((x && x.msg) || '操作失败', 'error');
      })
      .catch(function () { if (window.showToast) window.showToast('网络开小差了，请稍后再试', 'error'); });
  }
  function openRecycle() {
    var old = document.getElementById('recycleMask'); if (old) old.remove();
    var mask = document.createElement('div');
    mask.className = 'modal-mask'; mask.id = 'recycleMask';
    mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="数据缓存"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">数据缓存</h2><div class="form" id="rcBody">' +
      '<p style="font-size:13px;color:#5b7083;margin:0 0 10px">删除的资源、分类、公告在这里保留 60 天，到期自动彻底清除。</p>' +
      '<div style="text-align:center;color:#8aa0b5;font-size:13px;padding:14px 0">加载中…</div></div></div>';
    document.body.appendChild(mask);
    requestAnimationFrame(function () {
      mask.classList.add('open');
      try { var xb = mask.querySelector('[data-x]'); if (xb) xb.focus({ preventScroll: true }); } catch (eF) {} /* v439 #84 */
    });
    if (window.lockBodyScroll) window.lockBodyScroll(true);
    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); }
    });
    fetch('/api/admin/recycle', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (x) {
      var body = mask.querySelector('#rcBody'); if (!body) return;
      if (!x || !x.ok) { body.innerHTML = '<div style="text-align:center;color:#c62828;font-size:13px;padding:14px 0">加载失败，请关掉重试</div>'; return; }
      var sec = function (title, rows) { return '<div style="margin-bottom:12px"><b style="display:block;font-size:13px;color:#666;margin-bottom:6px">' + title + '</b>' + (rows || '<div style="color:#8aa0b5;font-size:12px;padding:4px 0">暂无</div>') + '</div>'; };
      var row = function (kind, id, name, t) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #eef2f6">' +
          '<span style="flex:1;min-width:0;font-size:13px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '<span style="color:#9aa9b8;font-size:11px;margin-left:8px">' + fmtDelTime(t) + ' 删除</span></span>' +
          '<button type="button" class="btn-blue btn-inline-pd" data-rc="restore" data-kind="' + kind + '" data-id="' + esc(String(id)) + '">恢复</button>' +
          '<button type="button" class="btn-blue btn-inline-pd" data-rc="purge" data-kind="' + kind + '" data-id="' + esc(String(id)) + '" style="color:#c62828;border-color:#c62828">彻底删除</button></div>';
      };
      var ps = (x.products || []).map(function (p) { return row('product', p.id, p.title || ('资源#' + p.id), p.deleted_at); }).join('');
      var cs = (x.categories || []).map(function (c) { return row('category', c.id, c.name || ('分类#' + c.id), c.deleted_at); }).join('');
      var as = (x.announcements || []).map(function (a) { return row('ann', a.id, a.title || '公告', a.deleted_at); }).join('');
      var none = !ps && !cs && !as;
      body.innerHTML = '<p style="font-size:13px;color:#5b7083;margin:0 0 10px">删除的资源、分类、公告在这里保留 60 天，到期自动彻底清除。</p>' +
        (none ? '<div style="text-align:center;color:#2e7d32;font-size:13px;padding:20px 0">回收站是空的 ✓</div>'
          : sec('资源 ' + (x.products || []).length, ps) + sec('分类 ' + (x.categories || []).length, cs) + sec('公告 ' + (x.announcements || []).length, as));
      body.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-rc]'); if (!b) return;
        var op = b.getAttribute('data-rc'), kind = b.getAttribute('data-kind'), id = b.getAttribute('data-id');
        if (op === 'purge' && window.showConfirm) {
          window.showConfirm('彻底删除', '彻底删除后无法恢复，确定继续？', function (closeConfirm) { closeConfirm(); recycleCall(op, kind, id, function () { openRecycle(); }); });
        } else recycleCall(op, kind, id, function () { openRecycle(); });
      });
    }).catch(function () { var body = mask.querySelector('#rcBody'); if (body) body.innerHTML = '<div style="text-align:center;color:#c62828;font-size:13px;padding:14px 0">加载失败，请关掉重试</div>'; });
  }

  /* 平台设置页挂入口键（v434b：照「修改密码」组同款——独立白色卡片、各占一行、btn-inline-pd 自适应键宽，
     不再 flex 拉满半屏、不再游离在卡片外） */
  (function wait() {
    /* #116 复检修正：有批量导入权限者在资源页也放入口（子账号无设置页签，否则权限是摆设） */
    var tb = document.querySelector('.tb-group.g-add');
    if (tb && !document.getElementById('batchImportBtn2') && (!window.__permCan || window.__permCan('batch.import'))) {
      var b2 = document.createElement('button');
      b2.type = 'button'; b2.className = 'btn-blue'; b2.id = 'batchImportBtn2';
      b2.setAttribute('data-perm', 'batch.import');
      b2.textContent = '批量导入';
      tb.appendChild(b2);
      b2.addEventListener('click', openWizard);
    }
    var panel = document.getElementById('panel-settings');
    if (panel && !document.getElementById('batchImportBtn')) {
      var grp = document.createElement('div');
      grp.className = 'setting-group';
      var lblSt = 'display:block;font-size:13px;color:#666;margin-bottom:6px;';
      grp.innerHTML = '<label style="' + lblSt + '">批量导入</label>' +
        '<button type="button" class="btn-blue btn-inline-pd" id="batchImportBtn">批量导入</button>' +
        '<label style="' + lblSt + 'margin-top:14px;">图片体检</label>' +
        '<button type="button" class="btn-blue btn-inline-pd" id="imgCheckBtn">系统体检</button>' +
        '<label style="' + lblSt + 'margin-top:14px;">数据缓存</label>' +
        '<button type="button" class="btn-blue btn-inline-pd" id="recycleBtn">数据缓存</button>' +
        '<label style="' + lblSt + 'margin-top:14px;">子账号管理</label>' +
        '<button type="button" class="btn-blue btn-inline-pd" id="usersBtn" data-perm="users">子账号管理</button>';
      panel.appendChild(grp);
      grp.querySelector('#batchImportBtn').addEventListener('click', openWizard);
      grp.querySelector('#imgCheckBtn').addEventListener('click', function () { try { this.querySelector('.dot-badge') && this.querySelector('.dot-badge').remove(); } catch (eC) {} sysCheck(); });
      grp.querySelector('#recycleBtn').addEventListener('click', openRecycle);
      grp.querySelector('#usersBtn').addEventListener('click', openUsers);

      /* #80 每日自动体检（复检改版）：跨天首次进管理页，延时 8s 静默跑；发现问题不再挂按钮红点，
         改为写本地提醒标记 → 信息中心置顶提醒条（带「去查看」键跳转体检详情），复查正常或看过即清 */
      try {
        /* #116 复检修正：自动体检仅超管跑——子账号无体检入口也无权看全量结果，白耗资源+打扰 */
        if (!window.__me || window.__me.role === 'super') {
        var today = new Date().toDateString();
        if (localStorage.getItem('wnzyq_autocheck_day') !== today) {
          localStorage.setItem('wnzyq_autocheck_day', today);
          setTimeout(function () {
            sysCheck(true).then(function (R0) {
              if (!R0) return;
              var badN = R0.broken.length + R0.oversize.length + R0.links.filter(function (L) { return L.ok === false; }).length + R0.env.filter(function (e) { return !e.ok; }).length;
              if (badN > 0) {
                try { localStorage.setItem('wnzyq_syscheck_alert', JSON.stringify({ day: today, n: badN })); } catch (eW) {}
                if (window.__syscheckAlertChanged) window.__syscheckAlertChanged(); /* 通知信息中心刷新红点 */
              }
            }).catch(function () {});
          }, 8000);
        }
        } /* end super-only autocheck */
      } catch (eA) { if (window.__silent) window.__silent(eA); }
      return;
    }
    setTimeout(wait, 300);
  })();
})();
