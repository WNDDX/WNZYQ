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

  /* 生成 SpreadsheetML 模板：分类/资源/类型/公告 四表 + 选项表（下拉源）
     v443 条5（老板拍板）：①信息要全面——资源带定时显示/隐藏时间列，新增「类型」表（类型名/价格/资源码/状态）；
     ②分类列恢复下拉选择（选项表=现有分类自动生成，不用手打）；③「使用说明」表不恢复（v442 已拍板去除）。 */
  /* ===== v456：真 .xlsx 生成与解析（纯 JS，不引第三方库）=====
     老板拍板：模板里的「所属分类 / 显示状态 / 分类级别」必须是**单元格下拉**，点一下出小箭头直接选，不用手打。
     老的 .xls（SpreadsheetML 2003）那种写法 Excel/WPS 里下拉箭头根本出不来（只有 Data 类型，没有 validation），
     所以这里改成生成标准 OOXML .xlsx：手写一份不压缩(store)的 zip，里面放 worksheet + dataValidations。
     上传时同一个文件也要能读回来 —— 用户用 Excel/WPS 存过之后是压缩包，故解析器同时支持 store 与 deflate。 */

  var __crcT = (function () { var t = [], n, k, c; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); } t[n] = c >>> 0; } return t; })();
  function __crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) { c = __crcT[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); } return (c ^ 0xFFFFFFFF) >>> 0; }
  function __u16(n) { return [n & 255, (n >>> 8) & 255]; }
  function __u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }

  /* 组装 zip（stored，不压缩：xlsx 体积小，省掉压缩库，任何解压器都认） */
  function __zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0, i;
    for (i = 0; i < files.length; i++) {
      var f = files[i], nb = enc.encode(f.name), crc = __crc32(f.data), sz = f.data.length;
      var lh = [].concat(__u32(0x04034b50), __u16(20), __u16(0x0800), __u16(0), __u16(0x5000), __u16(0x5D62),
        __u32(crc), __u32(sz), __u32(sz), __u16(nb.length), __u16(0));
      parts.push(new Uint8Array(lh), nb, f.data);
      central.push({ name: nb, crc: crc, size: sz, off: offset });
      offset += lh.length + nb.length + sz;
    }
    var cd = [], cdSize = 0;
    for (i = 0; i < central.length; i++) {
      var c = central[i];
      var h = [].concat(__u32(0x02014b50), __u16(20), __u16(20), __u16(0x0800), __u16(0), __u16(0x5000), __u16(0x5D62),
        __u32(c.crc), __u32(c.size), __u32(c.size), __u16(c.name.length), __u16(0), __u16(0), __u16(0), __u16(0), __u32(0), __u32(c.off));
      cd.push(new Uint8Array(h), c.name);
      cdSize += h.length + c.name.length;
    }
    var eocd = new Uint8Array([].concat(__u32(0x06054b50), __u16(0), __u16(0), __u16(files.length), __u16(files.length), __u32(cdSize), __u32(offset), __u16(0)));
    var total = offset + cdSize + eocd.length, out = new Uint8Array(total), pos = 0;
    parts.concat(cd, [eocd]).forEach(function (b) { out.set(b, pos); pos += b.length; });
    return out;
  }

  function __colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  var __XLSX_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  var __REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  /* 单表 XML：rows 为二维数组（首行=表头），dv 为下拉定义数组 */
  function __sheetXml(cfg) {
    var hdr = cfg.headerRows == null ? 1 : cfg.headerRows;
    var cols = '';
    if (cfg.widths && cfg.widths.length) {
      cols = '<cols>' + cfg.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    }
    var rowsXml = cfg.rows.map(function (r, ri) {
      var cells = r.map(function (v, ci) {
        var ref = __colName(ci) + (ri + 1);
        var st = ri < hdr ? 1 : 2;   /* 1=表头（粗体+浅蓝底） 2=数据区（细边框） */
        if (v === '' || v == null) return '<c r="' + ref + '" s="' + st + '"/>';
        return '<c r="' + ref + '" s="' + st + '" t="inlineStr"><is><t xml:space="preserve">' + esc(String(v)) + '</t></is></c>';
      }).join('');
      return '<row r="' + (ri + 1) + '"' + (ri < hdr ? ' ht="26" customHeight="1"' : '') + '>' + cells + '</row>';
    }).join('');
    var dv = '';
    if (cfg.dv && cfg.dv.length) {
      dv = '<dataValidations count="' + cfg.dv.length + '">' + cfg.dv.map(function (d) {
        return '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"' +
          (d.prompt ? ' promptTitle="' + esc(d.promptTitle || '填写提示') + '" prompt="' + esc(d.prompt) + '"' : '') +
          ' errorTitle="只能选列表里的值" error="' + esc(d.err || '请点单元格右侧的小三角，从列表里选；不要自己输入。') + '"' +
          ' sqref="' + d.sqref + '"><formula1>' + esc(d.formula) + '</formula1></dataValidation>';
      }).join('') + '</dataValidations>';
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="' + __XLSX_NS + '">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + hdr + '" topLeftCell="A' + (hdr + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="20"/>' + cols +
      '<sheetData>' + rowsXml + '</sheetData>' + dv +
      '</worksheet>';
  }

  var __STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="' + __XLSX_NS + '">' +
    '<fonts count="2"><font><sz val="11"/><name val="等线"/></font><font><b/><sz val="11"/><color rgb="FF1B3A57"/><name val="等线"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF3FD"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFD6E4F0"/></left><right style="thin"><color rgb="FFD6E4F0"/></right><top style="thin"><color rgb="FFD6E4F0"/></top><bottom style="thin"><color rgb="FFD6E4F0"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  /* sheets: [{name, rows, widths, dv}] → Uint8Array */
  function __buildXlsx(sheets) {
    var enc = new TextEncoder();
    var files = [];
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (sh, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
      '</Types>';
    files.push({ name: '[Content_Types].xml', data: enc.encode(ct) });
    files.push({ name: '_rels/.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="' + __REL_NS + '/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>') });

    /* v523（老板：模板里还是点不出下拉）——原来 dataValidation 直接写「选项!$A$2:$A$31」跨表区域，
       这个写法在 Excel 里能用、在不少 WPS 版本里会静默失效（下拉箭头不出现）。改成「定义名称」引用，
       Excel 与 WPS 都认，这是兼容性最好的做法。 */
    var allNames = [];
    sheets.forEach(function (sh) { (sh.names || []).forEach(function (n) { allNames.push(n); }); });
    var defNames = allNames.length
      ? '<definedNames>' + allNames.map(function (n) { return '<definedName name="' + esc(n.name) + '">' + esc(n.ref) + '</definedName>'; }).join('') + '</definedNames>'
      : '';
    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="' + __XLSX_NS + '" xmlns:r="' + __REL_NS + '"><sheets>' +
      sheets.map(function (sh, i) { return '<sheet name="' + esc(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
      '</sheets>' + defNames + '</workbook>';
    files.push({ name: 'xl/workbook.xml', data: enc.encode(wb) });

    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (sh, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="' + __REL_NS + '/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="' + __REL_NS + '/styles" Target="styles.xml"/>' +
      '</Relationships>';
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: enc.encode(rels) });
    files.push({ name: 'xl/styles.xml', data: enc.encode(__STYLES) });

    sheets.forEach(function (sh, i) {
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: enc.encode(__sheetXml(sh)) });
    });
    return __zip(files);
  }

  /* ---- 读取：zip 目录 + store/deflate 解压 ---- */
  function __unzip(buf) {
    var dv = new DataView(buf), eocd = -1, i;
    for (i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('这不是标准的 xlsx 文件');
    var cnt = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    var out = {}, p = cdOff;
    for (i = 0; i < cnt; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true),
        nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true),
        clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      var name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nlen));
      var lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
      out[name] = { method: method, data: new Uint8Array(buf, lho + 30 + lnlen + lelen, csize) };
      p += 46 + nlen + elen + clen;
    }
    return out;
  }

  function __readPart(files, name) {
    var f = files[name];
    if (!f) return Promise.resolve('');
    if (f.method === 0) return Promise.resolve(new TextDecoder('utf-8').decode(f.data));
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('当前浏览器不支持解压，请把这文件另存为 .xls 再导入'));
    var st = new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(st).arrayBuffer().then(function (ab) { return new TextDecoder('utf-8').decode(ab); });
  }

  function __colIdx(ref) {
    var m = String(ref || '').match(/^([A-Z]+)/); if (!m) return 0;
    var s = m[1], n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }

  /* 一张表 → 二维数组（去掉表头行与全空行，与老 .xls 解析口径一致） */
  /* v480：加 keepHeader —— 原实现无条件砍掉第一行（当表头处理），
     外部采集要靠表头认出「封面/链接」是哪一列，砍了就只能瞎猜，实测封面和链接全丢。 */
  function __rowsFromSheet(xml, shared, keepHeader) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var rs = doc.getElementsByTagName('row'), rows = [];
    for (var i = 0; i < rs.length; i++) {
      var cs = rs[i].getElementsByTagName('c'), cells = [];
      for (var j = 0; j < cs.length; j++) {
        var c = cs[j], col = __colIdx(c.getAttribute('r')), t = c.getAttribute('t'), v = '';
        if (t === 'inlineStr') { var is = c.getElementsByTagName('t')[0]; v = is ? is.textContent : ''; }
        else if (t === 's') { var vv = c.getElementsByTagName('v')[0]; v = vv ? (shared[+vv.textContent] || '') : ''; }
        else { var v2 = c.getElementsByTagName('v')[0]; v = v2 ? v2.textContent : ''; }
        while (cells.length < col) cells.push('');
        cells[col] = String(v == null ? '' : v).trim();
      }
      rows.push(cells);
    }
    var out = rows.filter(function (r) { return r.some(function (x) { return x; }); });
    return keepHeader ? out : out.slice(1);
  }

  /* v473：资源采集要复用这套 xlsx 解析（老板从别家后台导出的资源表；表头仍可能是对方写的「商品/产品」）。
     入口：把任意一张有数据的表读成 [{title, cover, src_url}]，前端自己认列。 */
  window.__parseAnySheet = function (buf) {
    return parseXlsx(buf, true).then(function (book) {
      /* v479：parseXlsx 返回的是「表名 → 行数组」的对象，不是数组——
         原来按数组遍历，一上传 xlsx 就报 (sheets||[]).forEach is not a function（实测踩到）。 */
      var best = null;
      Object.keys(book || {}).forEach(function (name) {
        var rs = book[name] || [];
        if (!rs.length) return;
        if (!best || rs.length > best.rows.length) best = { name: name, rows: rs };
      });
      if (!best) return [];
      var rows = best.rows.filter(function (r) { return r && r.join('').trim(); });
      if (!rows.length) return [];
      /* 找表头行（前 5 行里挑含「标题/名称/商品/产品」的那行） */
      var hi = -1;
      for (var i = 0; i < Math.min(6, rows.length); i++) {
        var line = rows[i].join('|');
        /* 表头特征：一行里同时出现「名称/标题」类和「图/链接」类，或就是很短的列名行 */
        if (/标题|名称|商品|产品|套餐/.test(line) && /图|链接|地址|url|备注|价格|id/i.test(line)) { hi = i; break; }
        if (/标题|名称/.test(line) && rows[i].filter(Boolean).length >= 2) { hi = i; break; }
      }
      if (hi < 0) hi = 0;   /* 没认出表头：按第一行是数据、0/1/2 的位置猜 */
      var head = (rows[hi] || []).map(function (x) { return String(x == null ? '' : x).trim(); });
      var idx = function (re) {
        for (var k = 0; k < head.length; k++) { if (re.test(head[k])) return k; }
        return -1;
      };
      var iT = idx(/标题|名称|商品|产品|套餐/);
      var iC = idx(/封面|图片|主图|缩略/);
      var iU = idx(/链接|地址|url|网址/i);
      var hasHead = (iT >= 0 || iC >= 0 || iU >= 0);
      var start = hasHead ? hi + 1 : hi;
      if (iT < 0) iT = 0;
      /* 没认出列名时按「值长什么样」兜底：图片后缀的当封面，其余 http 的当链接 */
      var sniff = function (r) {
        var c = '', u = '';
        for (var k = 0; k < r.length; k++) {
          var v = String(r[k] == null ? '' : r[k]).trim();
          if (!/^https?:/i.test(v)) continue;
          if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(v)) { if (!c) c = v; }
          else if (!u) u = v;
        }
        return { c: c, u: u };
      };
      var out = [];
      for (var r = start; r < rows.length; r++) {
        var row = rows[r] || [];
        var title = String(row[iT] == null ? '' : row[iT]).trim();
        if (!title || title.length < 2) continue;
        var cover = iC >= 0 ? String(row[iC] == null ? '' : row[iC]).trim() : '';
        var url = iU >= 0 ? String(row[iU] == null ? '' : row[iU]).trim() : '';
        if (!/^https?:/i.test(cover)) cover = '';
        if (!/^https?:/i.test(url)) url = '';
        if (!cover || !url) { var sn = sniff(row); if (!cover) cover = sn.c; if (!url) url = sn.u; }
        if (!cover && !url) { var sn2 = sniff(row); cover = sn2.c; url = sn2.u; }
        out.push({ title: title.slice(0, 90), cover: cover, src_url: url });
        if (out.length >= 500) break;
      }
      try { window.__lastSheet = { sheet: best.name, head: head, iT: iT, iC: iC, iU: iU, hi: hi, sample: out.slice(0, 3) }; } catch (e0) {} /* 排查用 */
      return out;
    });
  };

  function parseXlsx(buf, keepHeader) {
    var files;
    try { files = __unzip(buf); } catch (e) { return Promise.reject(e); }
    return Promise.all([__readPart(files, 'xl/workbook.xml'), __readPart(files, 'xl/_rels/workbook.xml.rels'), __readPart(files, 'xl/sharedStrings.xml')]).then(function (a) {
      var wb = a[0], rels = a[1], sst = a[2];
      var shared = [], m2, siRe = /<si>([\s\S]*?)<\/si>/g;
      while ((m2 = siRe.exec(sst))) {
        var ts = m2[1].match(/<t[^>]*>[\s\S]*?<\/t>/g) || [];
        shared.push(ts.map(function (x) { return x.replace(/<[^>]+>/g, ''); }).join(''));
      }
      /* v456：rels 的属性顺序不固定（openpyxl 写的是 Type/Target/Id，Excel 写的是 Id/Type/Target），
         原来用一条正则卡死「Id 必须在 Target 前面」，遇到 WPS/openpyxl 存的文件就一张表都匹配不到 → 导入 0 条。
         改成逐个关系标签整段取，再分别抓 Id / Target，与顺序无关。 */
      var relMap = {}, rm, relRe = /<Relationship\b[^>]*\/?>/g;
      while ((rm = relRe.exec(rels))) {
        var rtag = rm[0];
        var rid2 = (rtag.match(/\bId="([^"]*)"/) || [])[1] || '';
        var rtg = (rtag.match(/\bTarget="([^"]*)"/) || [])[1] || '';
        if (rid2) relMap[rid2] = rtg;
      }
      var sheets = [], sm, sRe = /<sheet\b[^>]*\/?>/g;
      while ((sm = sRe.exec(wb))) {
        var tag = sm[0];
        var nm = (tag.match(/name="([^"]*)"/) || [])[1] || '';
        var rid = (tag.match(/r:id="([^"]+)"/) || [])[1] || '';
        sheets.push({ name: nm, target: relMap[rid] || '' });
      }
      return Promise.all(sheets.map(function (sh) {
        var t = sh.target; if (!t) return Promise.resolve(null);
        /* 路径归一：/xl/worksheets/x.xml、worksheets/x.xml、../worksheets/x.xml 都落到 xl/worksheets/x.xml */
        var path = t.charAt(0) === '/' ? t.slice(1)
          : (t.indexOf('worksheets/') >= 0 ? ('xl/' + t.slice(t.indexOf('worksheets/'))) : ('xl/' + t.replace(/^\.\//, '')));
        return __readPart(files, path).then(function (xml) { return { name: sh.name, rows: xml ? __rowsFromSheet(xml, shared, keepHeader) : [] }; });
      })).then(function (list) {
        var out = {};
        list.forEach(function (x) { if (x) out[x.name] = x.rows; });
        return out;
      });
    });
  }

  /* 生成 .xlsx 模板：资源 / 类型 / 分类 / 公告 + 选项（下拉源）
     v456：改成真 xlsx（老 .xls 那种下拉箭头出不来）。列序＝后台「新增资源」窗口的填写顺序。
     下拉列：所属分类、显示状态、分类级别 —— 只能选，不能自己乱写。 */
  function buildTemplate() {
    var opts = catOptions().filter(Boolean);
    if (!opts.length) opts = ['（请先到后台分类管理新增分类）'];
    var lastOpt = opts.length + 1;              /* 选项表 A2..A(lastOpt) */
    var CAT_DV = '分类选项';
    var LV_DV = '分类级别选项';
    var ST_DV = '显示状态选项';
    var OPT_NAMES = [
      { name: '分类选项', ref: '选项!$A$2:$A$' + lastOpt },
      { name: '分类级别选项', ref: '选项!$B$2:$B$3' },
      { name: '显示状态选项', ref: '选项!$C$2:$C$3' }
    ];
    var ROWSN = 30;                              /* 预留 30 行空白（带边框 + 下拉） */
    var d2 = new Date(), pd = function (n) { return n < 10 ? '0' + n : '' + n; };
    var fname = '' + d2.getFullYear() + pd(d2.getMonth() + 1) + pd(d2.getDate()) + '-' + pd(d2.getHours()) + pd(d2.getMinutes()) + '-导入模板.xlsx';

    /* 每张表：表头 + 30 行空行（空行只给样式，让用户看得见格子） */
    var mk = function (heads) {
      var rows = [heads];
      for (var r = 0; r < ROWSN; r++) { var e = []; for (var c = 0; c < heads.length; c++) e.push(''); rows.push(e); }
      return rows;
    };

    var resHeads = ['资源标题', '所属分类', '资源简介', '资源详情', '资源价格', '封面图片链接', '排序', '显示状态', '定时显示时间', '定时隐藏时间', '专属客服链接', '专属客服二维码'];
    var varHeads = ['所属资源标题', '类型名称', '类型价格', '类型简介', '资源码', '解锁后内容', '绑定上限', '显示状态', '排序'];
    var catHeads = ['分类名称', '分类级别', '所属一级分类', '排序序号', '显示状态'];
    var annHeads = ['公告标题', '公告内容', '排序序号', '显示状态'];
    var optHeads = ['分类选项', '分类级别选项', '显示状态选项', '时间格式示例'];

    var optRows = [optHeads];
    for (var i = 0; i < Math.max(opts.length, 2); i++) {
      optRows.push([opts[i] || '', i === 0 ? '一级分类' : (i === 1 ? '二级分类' : ''), i === 0 ? '显示' : (i === 1 ? '隐藏' : ''), i === 0 ? '2026-11-02 09:00' : '']);
    }

    var sheets = [
      { name: '资源', rows: mk(resHeads), widths: [26, 18, 30, 40, 12, 30, 8, 12, 18, 18, 30, 30], dv: [
        { sqref: 'B2:B' + (ROWSN + 1), formula: CAT_DV, promptTitle: '所属分类', prompt: '点右边小三角选已有分类；没有就先到后台分类管理里加一个。' },
        { sqref: 'H2:H' + (ROWSN + 1), formula: ST_DV, promptTitle: '显示状态', prompt: '选“显示”= 前台立刻能看到；选“隐藏”= 前台不显示。' }
      ] },
      { name: '类型', rows: mk(varHeads), widths: [26, 18, 12, 30, 24, 40, 12, 12, 8], dv: [
        { sqref: 'H2:H' + (ROWSN + 1), formula: ST_DV, promptTitle: '显示状态', prompt: '选“显示”或“隐藏”。' }
      ] },
      { name: '分类', rows: mk(catHeads), widths: [22, 14, 22, 12, 12], dv: [
        { sqref: 'B2:B' + (ROWSN + 1), formula: LV_DV, promptTitle: '分类级别', prompt: '只有“一级分类 / 二级分类”两种。' },
        { sqref: 'C2:C' + (ROWSN + 1), formula: CAT_DV, promptTitle: '所属一级分类', prompt: '二级分类才填；从列表里选一个已有的一级分类。' },
        { sqref: 'E2:E' + (ROWSN + 1), formula: ST_DV, promptTitle: '显示状态', prompt: '选“显示”或“隐藏”。' }
      ] },
      { name: '公告', rows: mk(annHeads), widths: [26, 50, 12, 12], dv: [
        { sqref: 'D2:D' + (ROWSN + 1), formula: ST_DV, promptTitle: '显示状态', prompt: '选“显示”或“隐藏”。' }
      ] },
      { name: '选项', rows: optRows, widths: [24, 16, 16, 22], dv: [], names: OPT_NAMES }
    ];

    return { blob: new Blob([__buildXlsx(sheets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name: fname, xml: '' };
  }

  function downloadBlob(name, blob) {
    try { window.__tplName = name; } catch (e0) {}
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
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
    var res = data['资源'] || [], cat = data['分类'] || [], ann = data['公告'] || [], vars = data['类型'] || []; /* v443 条5：类型表纳入预览校验 */
    var bad = 0;
    res.forEach(function (r, i) { if (!r[0]) { bad++; lines.push('资源第' + (i + 2) + '行：缺标题，跳过'); } else if (r[1] && cats.indexOf(r[1]) < 0) { bad++; lines.push('资源第' + (i + 2) + '行：分类「' + r[1] + '」不存在，请先导分类'); } });
    cat.forEach(function (r, i) { if (!r[0]) { bad++; lines.push('分类第' + (i + 2) + '行：缺名称，跳过'); } });
    ann.forEach(function (r, i) { if (!r[0]) { bad++; lines.push('公告第' + (i + 2) + '行：缺标题，跳过'); } });
    vars.forEach(function (r, i) { if (!r[0] || !r[1]) { bad++; lines.push('类型第' + (i + 2) + '行：缺所属资源标题或类型名称，跳过'); } }); /* v443 条5 */
    lines.unshift('校验完成：资源 ' + res.length + ' 条 / 类型 ' + vars.length + ' 条 / 分类 ' + cat.length + ' 条 / 公告 ' + ann.length + ' 条' + (bad ? '；问题 ' + bad + ' 条' : '，全部可导入'));
    return { lines: lines, bad: bad, '资源': res, '类型': vars, '分类': cat, '公告': ann }; /* v431b：键名与 doImport 对齐；v443 条5：补类型键（漏了=类型表数据到 doImport 时变空=类型永不导入） */
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
    var prodIdByName = {};
    (data['资源'] || []).forEach(function (r) {
      if (!r[0]) return;
      /* v454：列序对齐模板新列（标题/分类/简介/详情/价格/封面/排序/显示/定时显/定时隐/客服链接/客服二维码） */
      seq = seq.then(function () { return apiCall('admin/products', { method: 'POST', body: JSON.stringify({
        title: r[0], cid: catIdByName[r[1]] || 0, desc: r[2] || '', detail: r[3] || '',
        price: Number(r[4]) || 0, img: r[5] || '', sort: Number(r[6]) || 0,
        is_online: /隐藏/.test(r[7] || '') ? 0 : 1, is_hidden: /隐藏/.test(r[7] || '') ? 1 : 0,
        schedule_on: (r[8] || '').trim() || undefined, schedule_off: (r[9] || '').trim() || undefined,
        contactUrl: (r[10] || '').trim() || '', contactQr: (r[11] || '').trim() || ''
      }) }); }).then(function (x) {
        if (!(x && x.ok)) { say('资源「' + r[0] + '」失败' + (x && x.msg ? '：' + x.msg : '')); return; }
        prodIdByName[r[0]] = x.id;
        say('资源「' + r[0] + '」✓');
      }).catch(function () { say('资源「' + r[0] + '」失败'); });
    });
    /* v443 条5：类型表导入——所属资源标题（对应资源表标题）/类型名称/类型价格/资源码/显示状态 */
    (data['类型'] || []).forEach(function (r) {
      if (!r[0] || !r[1]) return;
      seq = seq.then(function () {
        var pid = prodIdByName[r[0]];
        if (!pid) { say('类型「' + r[1] + '」：资源「' + r[0] + '」未在本次导入中创建，跳过'); return Promise.resolve(null); }
        /* v454：类型列补齐（所属资源/名称/价格/简介/资源码/解锁后内容/绑定上限/显示/排序） */
        return apiCall('admin/variants', { method: 'POST', body: JSON.stringify({
          productId: pid, name: r[1], price: Number(r[2]) || 0, desc: r[3] || '',
          resourceCode: String(r[4] || '').trim() === '●●●●' ? '' : String(r[4] || '').trim(),
          resourceContent: r[5] || '', bindLimit: Number(r[6]) || 1,
          isHidden: /隐藏/.test(r[7] || '') ? 1 : 0, sort: Number(r[8]) || 0
        }) });
      }).then(function (x) { if (x === null) return; say('类型「' + r[1] + '」' + (x && x.ok ? '✓' : '失败')); }).catch(function () { say('类型「' + r[1] + '」失败'); });
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
      '<p style="font-size:13px;color:#5b7083;margin:0 0 10px">第 1 步：下载模板 → 填好 → 第 2 步上传 → 预览无误后导入。建议顺序：先导「分类」→ 再导「资源」→ 最后导「类型」。</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-blue btn-inline" id="impTpl" style="flex:1">下载模板</button>' +
      '<button class="btn-blue btn-inline" id="impUploadBtn" style="flex:1">上传表格</button><input type="file" id="impFile" accept=".xlsx,.xls,.xml" style="display:none"></div>' +
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
    mask.querySelector('#impTpl').addEventListener('click', function () {
      var tpl = buildTemplate();
      downloadBlob(tpl.name, tpl.blob);
      if (window.showToast) window.showToast('模板已下载（.xlsx：资源/类型/分类/公告 四张填写表 + 一张「选项」下拉源表，分类与显示状态点单元格右侧小三角直接选）', 'success');
    });
    mask.querySelector('#impUploadBtn').addEventListener('click', function () { mask.querySelector('#impFile').click(); }); /* v443 条5：上传键改 button 与下载键完全同款（原 label 结构渲染发灰） */
    mask.querySelector('#impFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        /* v456：先看文件头——zip(PK) 走 xlsx 解析，其余按老 SpreadsheetML/HTML 表格解析 */
        var buf = rd.result, isZip = false;
        try { var head = new Uint8Array(buf, 0, 4); isZip = head[0] === 0x50 && head[1] === 0x4B; } catch (eH) { isZip = false; }
        var doneParse = function (data) {
          var pv = preview(data);
          var body = mask.querySelector('#impPrev');
          var total = (pv['资源'] || []).length + (pv['类型'] || []).length + (pv['分类'] || []).length + (pv['公告'] || []).length; /* v431c：键名与 preview 返回值对齐（旧 pv.res 未同步=预览空白的真凶） */
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
        };
        if (isZip) {
          parseXlsx(buf).then(doneParse).catch(function (e) { if (window.showToast) window.showToast('解析失败：' + e.message, 'error'); });
        } else {
          try { doneParse(parseWorkbook(new TextDecoder('utf-8').decode(buf))); }
          catch (e) { if (window.showToast) window.showToast('解析失败：' + e.message, 'error'); }
        }
      };
      rd.readAsArrayBuffer(f);
    });
  }

  /* ===== v438 系统体检（v439 增强）：①失效图片（缩略图+一键定位到资源编辑）
     ②重复图片引用 ③外链可达性检测 ④#115 环境检查（后端/SW/缓存/存储）⑤#79 超大图（>1MB，可压缩替换+可恢复）
     silent=true（#80 每日自动体检）：不弹窗不提示，只返回结果 ===== */
  function sysCheck(silent) {
    return new Promise(function (resolve) {
      var products = (window.state && state.products) || [];
      if (!products.length) { if (!silent && window.showToast) window.showToast('当前没有资源可检查', 'info'); resolve(null); return; }
      /* v442 条3（老板反馈：点体检不马上出弹窗很卡）：点击后立刻弹出「体检中」弹窗（骨架+进度文案），
         探测完成后由下方结果渲染处自动替换同一弹窗内容。中途关闭（_userClosed）则结束后不再打扰。 */
      var _shell = null;
      if (!silent) {
        var _old = document.getElementById('sysCheckMask'); if (_old) _old.remove();
        _shell = document.createElement('div');
        _shell.className = 'modal-mask'; _shell.id = 'sysCheckMask';
        _shell.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="系统体检"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
          '<h2 class="modal-title">系统体检</h2>' +
          '<div style="font-size:13px;color:#5b7083;margin:0 0 12px">正在逐张检查图片、逐条探测外链，最长约半分钟，请稍候…</div>' +
          '<div style="background:#0f2233;border-radius:8px;padding:10px 12px;font-size:12px">' +
          '<div class="sk-line" style="height:14px;width:70%;border-radius:6px;margin-bottom:8px;background:linear-gradient(90deg,#1a3350 55%,#24466b 75%,#1a3350 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' +
          '<div class="sk-line" style="height:14px;width:50%;border-radius:6px;margin-bottom:8px;background:linear-gradient(90deg,#1a3350 55%,#24466b 75%,#1a3350 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' +
          '<div class="sk-line" style="height:14px;width:62%;border-radius:6px;background:linear-gradient(90deg,#1a3350 55%,#24466b 75%,#1a3350 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div></div></div>';
        document.body.appendChild(_shell);
        requestAnimationFrame(function () { _shell.classList.add('open'); });
        _shell.addEventListener('click', function (e) {
          if (e.target === _shell || e.target.closest('[data-x]')) { _shell.dataset.userClosed = '1'; _shell.classList.remove('open'); setTimeout(function () { _shell.remove(); }, 200); }
        });
      }
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
      if (!imgs.length && !links.length) { var _eS = document.getElementById('sysCheckMask'); if (_eS) _eS.remove(); if (!silent && window.showToast) window.showToast('当前没有可检查的图片和外链', 'info'); resolve(null); return; } /* v442：早退先撤「体检中」弹窗 */
      if (!silent && window.showToast) window.showToast('系统体检中：图片 ' + imgs.length + ' 张 · 外链 ' + links.length + ' 条…', 'info');

      /* 图片按 URL 去重并发检测；引用关系统计重复；同趟 fetch 测体积（#79 超大图） */
      var refMap = {};
      imgs.forEach(function (it) { (refMap[it.src] = refMap[it.src] || []).push(it); });
      var testList = Object.keys(refMap).map(function (src) { return { src: src, refs: refMap[src] }; });
      var broken = [], oversize = [], done = 0, total = testList.length;
      /* v438b：双阶段齐活再渲染（图片+外链都回来才算完）；v439 #79：同源图 fetch 测大小 */
      var imgDone = new Promise(function (res) { window.__sysImgFinish = res; });
      /* v448 修复「外链检测必然误报」：CSP 的 connect-src 只允许 'self'，原来对每条外链发
         fetch(no-cors) 在线上必被安全策略拦截 —— 结果①控制台刷 CSP 违规 ②所有外链一律被标
         「疑似失效」（误报），体检结论不可信。现改为：
           · 图片类外链（扩展名可判）→ 用 Image 探测（img-src 允许 https:，不受 connect-src 限制）；
           · 网页类外链 → 不发起任何请求，标为「未检测」(ok=null)，不参与失效统计。
         渲染端原本就用 L.ok === false / === true 严格判断，null 天然被排除，无需改动下游。 */
      var linkDone = Promise.all(links.map(function (L) {
        return new Promise(function (res) {
          var href = String(L.href || '');
          if (/\.(png|jpe?g|gif|webp|svg|ico|bmp)(\?|#|$)/i.test(href)) {
            var imL = new Image(), settled = false;
            var done2 = function (v) { if (settled) return; settled = true; L.ok = v; res(L); };
            imL.onload = function () { done2(true); };
            imL.onerror = function () { done2(false); };
            setTimeout(function () { done2(null); }, 6000);
            imL.src = href;
          } else {
            L.ok = null; L.unchecked = true; res(L);
          }
        });
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
    var uncheckedLinks = (R0.links || []).filter(function (L) { return L.ok === null; }).length; /* v448：网页类外链受 CSP 限制无法自动检测，需人工核对 */
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
    /* v442 条3：用户中途关掉了「体检中」弹窗 → 结果不再弹窗打扰（仍照常 resolve 供自动体检用） */
    var _wasClosed = document.getElementById('sysCheckMask');
    _wasClosed = !!(_wasClosed && _wasClosed.dataset.userClosed === '1');
    if (_wasClosed) { document.getElementById('sysCheckMask').remove(); resolve(R0); return; }
    mask.className = 'modal-mask'; mask.id = 'sysCheckMask';
    mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="系统体检"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">系统体检</h2>' +
      '<div style="font-size:12px;color:#8aa0b5;margin:0 0 10px">图片 ' + R0.totalImgs + ' 张（失效 ' + R0.broken.length + '）· 重复引用 ' + R0.dups.length + ' 组 · 外链 ' + R0.links.length + ' 条（疑似失效 ' + badLinks.length + (uncheckedLinks ? '，<b style="color:#e0b25a">' + uncheckedLinks + ' 条为网页链接需人工核对</b>' : '') + '）· 超大图 ' + (R0.oversize || []).length + ' 张</div>' +
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
      if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); }
    });
  }

  /* 定位：关体检弹窗 → 切资源管理 → 找到资源行高亮 → 打开编辑弹窗 */
  function gotoEditProduct(pid) {
    var mask = document.getElementById('sysCheckMask');
    if (mask) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); }
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
  /* v442 条7：重置子账号密码——页面内小弹窗（替代原生 prompt，杜绝「验证卡死」） */
  function openResetPwd(u, onOk) {
    var old = document.getElementById('usPwdMask'); if (old) old.remove();
    var mask = document.createElement('div');
    mask.className = 'modal-mask'; mask.id = 'usPwdMask';
    mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="重置密码"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">重置密码：' + esc(u.username || '') + '</h2><div class="form">' +
      '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px">新密码（6-50 位）</label>' +
      '<input id="usPwdInput" type="text" maxlength="50" style="width:100%;margin-bottom:10px" autocomplete="off">' +
      '<button type="button" class="btn-blue" id="usPwdGo" style="width:100%">确认重置</button></div></div>';
    document.body.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('open'); try { mask.querySelector('#usPwdInput').focus({ preventScroll: true }); } catch (eF) {} });
    var close = function () { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); };
    mask.addEventListener('click', function (e) { if (e.target === mask || e.target.closest('[data-x]')) close(); });
    mask.querySelector('#usPwdGo').addEventListener('click', function () {
      var np = (mask.querySelector('#usPwdInput').value || '').trim();
      if (np.length < 6) { if (window.showToast) window.showToast('密码至少 6 位', 'error'); return; }
      onOk(np); close();
    });
    mask.querySelector('#usPwdInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') mask.querySelector('#usPwdGo').click(); });
  }
  function usersCall(method, body, done, fail, urlOverride) {    fetch(urlOverride || '/api/admin/users', { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined }) /* v443 条6：删除等需带 id 查询串的场景用 urlOverride */
      .then(function (r) { return r.json(); })
      .then(function (x) { if (x && x.ok) { if (done) done(x); } else { if (window.showToast) window.showToast((x && x.msg) || '操作失败', 'error'); if (fail) fail(x); } })
      .catch(function () { if (window.showToast) window.showToast('网络开小差了，请稍后再试', 'error'); if (fail) fail(); });
  }
  /* v454：账号操作的小弹窗（改密/冻结/删除共用）——样式与全站弹窗一致，不再用浏览器原生 prompt */
  function usAsk(title, msg, opts, onOk) {
    opts = opts || {};
    var old = document.getElementById('usAskMask'); if (old) old.remove();
    var m = document.createElement('div');
    m.className = 'modal-mask'; m.id = 'usAskMask';
    m.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" style="max-width:360px">'
      + '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>'
      + '<h2 class="modal-title">' + esc(title) + '</h2>'
      + '<p style="font-size:13px;color:var(--text-light);margin:0 0 10px;line-height:1.6">' + msg + '</p>'
      + (opts.input ? '<input class="input" id="usAskInput" type="' + (opts.inputType || 'text') + '" style="width:100%;margin-bottom:10px" maxlength="' + (opts.maxlength || 50) + '" placeholder="' + esc(opts.placeholder || '') + '">' : '')
      + '<div class="modal-footer"><button class="modal-inner-btn" id="usAskOk">' + esc(opts.okText || '确定') + '</button><button class="modal-close" data-x="1">取消</button></div></div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('open'); var i = m.querySelector('#usAskInput'); if (i) { try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } } });
    function close() { m.classList.remove('open'); setTimeout(function () { m.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180); }
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-x]')) close(); });
    m.querySelector('#usAskOk').addEventListener('click', function () {
      var v = m.querySelector('#usAskInput') ? m.querySelector('#usAskInput').value : '';
      if (opts.input && !String(v).trim()) { if (window.showToast) window.showToast('请填写内容', 'error'); return; }
      var btn = this; btn.disabled = true; btn.textContent = '处理中…';
      onOk(String(v).trim(), function () { close(); }, function () { btn.disabled = false; btn.textContent = opts.okText || '确定'; });
    });
  }
  function usersPwd(u) {
    usAsk('修改密码', '给「' + esc(u.username) + '」设置新密码（6-50 位）。', { input: true, inputType: 'password', placeholder: '新密码', okText: '保存' }, function (v, done, fail) {
      if (v.length < 6) { if (window.showToast) window.showToast('密码至少 6 位', 'error'); fail(); return; }
      usersCall('PUT', { id: u.id, op: 'resetpwd', password: v }, function () { if (window.showToast) window.showToast('密码已更新', 'success'); done(); }, fail);
    });
  }
  function usersStatus(u, st) {
    usAsk(st ? '解冻账号' : '冻结账号', (st ? '解冻后「' : '冻结后「') + esc(u.username) + (st ? '」可以重新登录。' : '」将无法登录（已有数据保留）。'), { okText: st ? '解冻' : '冻结' }, function (v, done, fail) {
      usersCall('PUT', { id: u.id, op: 'status', status: st }, function () { if (window.showToast) window.showToast(st ? '已解冻' : '已冻结', 'success'); done(); renderUsersList(); }, fail);
    });
  }
  function usersDel(u, children, subtree) {
    var warn = (subtree > 0)
      ? '该账号下有 <b>' + subtree + '</b> 个下级账号，删除后这些账号会一并失效（数据保留，可在「数据缓存」找回）。'
      : '删除后该账号立即无法登录，其新增的内容按分类范围保留。';
    usAsk('删除账号', '确认删除「' + esc(u.username) + '」？<br>' + warn, { okText: '删除' }, function (v, done, fail) {
      usersCall('DELETE', null, function () { if (window.showToast) window.showToast('账号已删除', 'success'); done(); renderUsersList(); }, fail, '/api/admin/users?id=' + u.id);
    });
  }

  function openUsers() {
    /* v512：进账号管理前先静默刷一次分类——否则刚新增的分类在「分类范围」里看不到，
       老板会以为新增没生效（实测：不刷就一直是登录那一刻的分类表） */
    try { if (window.loadCategories) window.loadCategories(true); } catch (e) {}
    var old = document.getElementById('usersMask'); if (old) old.remove();
    var mask = document.createElement('div');
    mask.className = 'modal-mask'; mask.id = 'usersMask';
    mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="账号管理"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">账号管理</h2><div class="form" id="usBody">' +
      '<div style="padding:10px 0">' + '<div class="sk-line" style="height:34px;border-radius:8px;margin-bottom:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '<div class="sk-line" style="height:34px;border-radius:8px;margin-bottom:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '<div class="sk-line" style="height:34px;border-radius:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '</div></div></div>' /* v443 条13：加载统一为全站骨架 */;
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
      var me = x.me || {}; window.__usMe = me; window.__usList = x.list || [];
      var isSuper = me.role === 'super';
      var list = window.__usList;
      if (!list.length) { body.innerHTML = '<div style="text-align:center;color:#8aa0b5;font-size:12px;padding:14px 0">还没有子账号</div>'; return; }
      /* v454：按 parentId 铺成树（同分类管理：展开/收起、缩进表示层级） */
      var byParent = {};
      list.forEach(function (u) { var pid = Number(u.parentId || 0); (byParent[pid] = byParent[pid] || []).push(u); });
      var order = [], seen = {};
      (function walk(pid, depth) {
        (byParent[pid] || []).forEach(function (u) {
          if (seen[u.id]) return; seen[u.id] = 1;
          order.push({ u: u, depth: depth });
          walk(u.id, depth + 1);
        });
      })(0, 0);
      list.forEach(function (u) { if (!seen[u.id]) { seen[u.id] = 1; order.push({ u: u, depth: 0 }); } });
      window.__usCollapsed = window.__usCollapsed || {};
      var rows = order.map(function (it) {
        var u = it.u, hasKids = (byParent[u.id] || []).length > 0;
        var collapsed = !!window.__usCollapsed[u.id];
        var isMe = u.username === me.username;
        var canManage = isSuper || Number(u.parentId) === Number(me.id);
        var ops = canManage && !isMe ? '<button type="button" class="row-btn" data-ua="edit" data-id="' + u.id + '">编辑</button>'
          + '<button type="button" class="row-btn" data-ua="pwd" data-id="' + u.id + '">改密</button>'
          + '<button type="button" class="row-btn" data-ua="status" data-id="' + u.id + '" data-st="' + (u.status ? 0 : 1) + '">' + (u.status ? '冻结' : '解冻') + '</button>'
          + '<button type="button" class="row-btn danger" data-ua="del" data-id="' + u.id + '" data-n="' + (u.childrenCount || 0) + '" data-nsub="' + (u.subtreeCount || 0) + '">删除</button>' : '';
        return '<div class="u-row" data-uid="' + u.id + '" data-pid="' + Number(u.parentId || 0) + '" data-depth="' + it.depth + '">'
          + '<button type="button" class="u-fold' + (hasKids ? '' : ' is-leaf') + (collapsed ? ' collapsed' : '') + '" data-fold="' + u.id + '" aria-label="展开或收起下级"><svg class="toggle-arrow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg></button>'
          + '<span class="u-name" style="margin-left:' + (it.depth * 18) + 'px"><b>' + esc(u.username) + '</b>' + (isMe ? ' <span style="color:var(--blue1);font-size:11px">（我）</span>' : '')
          + '<span class="u-sub">' + (u.note ? esc(u.note) + ' · ' : '') + (u.status ? '启用' : '已停用') + (hasKids ? ' · 下级 ' + (u.subtreeCount || 0) + ' 个' : ' · 无下级') + ' · 最近活跃 ' + esc(String(u.lastSeen || '—').slice(0, 16)) + '</span></span>'
          + '<span class="u-ops">' + ops + '</span></div>';
      }).join('');
      body.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        + '<button type="button" class="btn-blue btn-inline-pd" id="usAdd">新增账号</button>'
        + '<span class="pm-hint" style="margin:0">可展开三角查看下级；子账号只能挂在自己名下，权限只能在你拥有的范围内再缩小</span></div>'
        + '<div class="u-tree">' + rows + '</div>';

      function applyFold() {
        var hidden = {};
        body.querySelectorAll('.u-row').forEach(function (r) {
          var pid = Number(r.getAttribute('data-pid') || 0);
          if (hidden[pid]) { r.style.display = 'none'; hidden[Number(r.getAttribute('data-uid'))] = 1; }
          else { r.style.display = ''; }
        });
      }
      body.querySelectorAll('[data-fold]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = Number(this.getAttribute('data-fold'));
          window.__usCollapsed[id] = !window.__usCollapsed[id];
          this.classList.toggle('collapsed', !!window.__usCollapsed[id]);
          applyFold();
        });
      });
      applyFold();

      var addBtn = body.querySelector('#usAdd');
      if (addBtn) addBtn.addEventListener('click', function () { usersForm(null); });
      body.querySelectorAll('[data-ua]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = Number(this.getAttribute('data-id'));
          var ua = this.getAttribute('data-ua');
          var list2 = (window.__usList || []);
          var u = list2.filter(function (x) { return x.id === id; })[0] || {};
          if (ua === 'edit') usersForm(u);
          else if (ua === 'pwd') usersPwd(u);
          else if (ua === 'status') usersStatus(u, Number(this.getAttribute('data-st')));
          else if (ua === 'del') usersDel(u, Number(this.getAttribute('data-n') || 0), Number(this.getAttribute('data-nsub') || 0));
        });
      });
    }).catch(function () {
      body.innerHTML = '<div style="text-align:center;color:#c62828;font-size:13px;padding:14px 0">网络开小差了，请稍后再试</div>';
    });
  }

  /* v454：权限分组（老板要求写全、排整齐）——顺序＝资源→分类→公告→批量→数据→其它 */
  var PM_GROUPS = [
    { t: '资源', k: 'products', items: [['view', '看资源'], ['add', '新增资源'], ['edit', '编辑资源'], ['price', '改价格'], ['online', '上下架'], ['del', '删除资源'], ['restore', '恢复回收站'], ['purge', '彻底删除'], ['moveCat', '挪分类']] },
    { t: '分类', k: 'cats', items: [['view', '看分类'], ['add', '新增分类'], ['edit', '改分类'], ['del', '删分类']] },
    { t: '公告', k: 'ann', items: [['view', '看公告'], ['add', '发公告'], ['edit', '改公告'], ['del', '删公告']] },
    { t: '批量操作', k: 'batch', items: [['import', '批量导入'], ['price', '批量改价'], ['online', '批量上下架'], ['del', '批量删除']] },
    { t: '数据', k: 'data', items: [['stats', '看总量'], ['detail', '看逐条明细'], ['ip', '看访客 IP'], ['export', '导出数据']] },
    /* v496：外部链接台账 →「资源采集」（v470 起模块已改名重建，权限文案还停在旧台账口径，统一过来） */
    { t: '资源采集', k: 'external', items: [['view', '打开资源采集'], ['add', '加平台/粘一条'], ['edit', '改资源/改平台'], ['del', '删资源/删平台'], ['fetch', '采集/上架'], ['export', '导出']] }
  ];
  function usersForm(u) {
    var isEdit = !!(u && u.id);
    var perms = {};
    try { perms = (isEdit ? (typeof u.perms === 'string' ? JSON.parse(u.perms) : (u.perms || {})) : {}) || {}; } catch (e) { perms = {}; }
    var gval = function (grp, key) { try { return !!(perms[grp] || {})[key]; } catch (e) { return false; } };
    var catsScope = (perms.catsScope === 'all' || !isEdit) ? 'all' : (Array.isArray(perms.catsScope) ? perms.catsScope : 'all');
    var codeScope = perms.codeScope || 'own';
    var annScope = perms.annScope || 'all';
    var cats = (window.state && window.state.categories) || [];
    var me = window.__usMe || {};
    var mask = document.createElement('div');
    mask.className = 'modal-mask'; mask.id = 'usFormMask';

    var secHtml = PM_GROUPS.map(function (g) {
      var chks = g.items.map(function (it) {
        var on = isEdit ? gval(g.k, it[0]) : (g.k === 'products' && (it[0] === 'view')) || (g.k === 'cats' && it[0] === 'view') || (g.k === 'ann' && it[0] === 'view');
        return '<label class="pm-chk"><input type="checkbox" data-pa="' + g.k + '" data-pk="' + it[0] + '"' + (on ? ' checked' : '') + '><span>' + it[1] + '</span></label>';
      }).join('');
      return '<div class="pm-sec" data-sec="' + g.k + '"><div class="pm-sec-hd"><b>' + g.t + '</b>'
        + '<button type="button" class="pm-all" data-all="' + g.k + '">全选 / 清空</button></div>'
        + '<div class="pm-grid">' + chks + '</div></div>';
    }).join('');

    /* 其它：信息中心 + 管理下级账号 */
    secHtml += '<div class="pm-sec"><div class="pm-sec-hd"><b>其它</b></div><div class="pm-grid">'
      + '<label class="pm-chk"><input type="checkbox" data-pa="info" data-pk="view"' + (isEdit ? (gval('info', 'view') ? ' checked' : '') : ' checked') + '><span>信息中心</span></label>'
      + '<label class="pm-chk"><input type="checkbox" data-pa="users" data-pk="_"' + (isEdit && perms.users ? ' checked' : '') + '><span>管理下级账号</span></label>'
      + '</div></div>';

    /* v517（老板：一二级分类要有层次感）：原来是一排扁平的胶囊，只靠「└」区分父子。
       现在改成一棵树：一级一行（粗体），它的子分类缩进挂在下面，带竖线。 */
    var catHtml = (function () {
      if (!cats.length) return '<span class="pm-hint">暂无分类可勾</span>';
      var isOn = function (c) { return Array.isArray(catsScope) ? catsScope.indexOf(Number(c.id)) !== -1 : false; };
      var tops = cats.filter(function (c) { return !Number(c.parent_id || 0); });
      var kidsOf = function (id) { return cats.filter(function (c) { return Number(c.parent_id || 0) === Number(id); }); };
      if (!tops.length) tops = cats.slice();  /* 全是子分类的极端情况兜底 */
      return '<div class="pm-cattree">' + tops.map(function (t) {
        var kids = kidsOf(t.id);
        return '<div class="pm-catnode">' +
          '<label class="pm-catrow' + (kids.length ? ' has-kids' : '') + '">' +
            '<input type="checkbox" data-cat="' + t.id + '"' + (isOn(t) ? ' checked' : '') + '>' +
            '<span class="pm-catname">' + esc(t.name || ('分类#' + t.id)) + '</span>' +
            (kids.length ? '<i class="pm-catcnt">' + kids.length + ' 个子分类</i>' : '') +
          '</label>' +
          (kids.length ? '<div class="pm-catkids">' + kids.map(function (k) {
            return '<label class="pm-catrow is-kid"><input type="checkbox" data-cat="' + k.id + '"' + (isOn(k) ? ' checked' : '') + '><span class="pm-catname">' + esc(k.name || ('分类#' + k.id)) + '</span></label>';
          }).join('') + '</div>' : '') +
        '</div>';
      }).join('') + '</div>';
    })();

    var scopeHtml = '<div class="pm-sec"><div class="pm-sec-hd"><b>数据范围（能碰哪些分类）</b></div>'
      + '<div class="pm-grid" style="grid-template-columns:1fr">'
      + '<label class="pm-chk"><input type="radio" name="ufScope" value="all"' + (catsScope === 'all' ? ' checked' : '') + '><span>全部分类（勾这个就不用往下选）</span></label>'
      + '<label class="pm-chk"><input type="radio" name="ufScope" value="pick"' + (catsScope !== 'all' ? ' checked' : '') + '><span>只给下面勾选的分类（别的分类看不见也动不了）</span></label>'
      + '</div><div class="pm-chips" id="ufCatChips">' + catHtml + '</div></div>';

    var codeHtml = '<div class="pm-sec"><div class="pm-sec-hd"><b>资源码可见</b></div><div class="pm-grid" style="grid-template-columns:1fr">'
      + '<label class="pm-chk"><input type="radio" name="ufCode" value="own"' + (codeScope === 'own' ? ' checked' : '') + '><span>只看自己新增的</span></label>'
      + '<label class="pm-chk"><input type="radio" name="ufCode" value="scoped"' + (codeScope === 'scoped' ? ' checked' : '') + '><span>范围内资源的都能看</span></label>'
      + '<label class="pm-chk"><input type="radio" name="ufCode" value="all"' + (codeScope === 'all' ? ' checked' : '') + '><span>全部都能看</span></label>'
      + '</div></div>';

    /* 公告范围：只让改指定公告（相当于分类范围的公告版） */
    var annHtml = '<div class="pm-sec" id="ufAnnSec"><div class="pm-sec-hd"><b>公告范围（能改哪些公告）</b></div>'
      + '<div class="pm-grid" style="grid-template-columns:1fr">'
      + '<label class="pm-chk"><input type="radio" name="ufAnn" value="all"' + (annScope === 'all' ? ' checked' : '') + '><span>全部公告</span></label>'
      + '<label class="pm-chk"><input type="radio" name="ufAnn" value="pick"' + (annScope !== 'all' ? ' checked' : '') + '><span>只能改下面勾选的公告</span></label>'
      + '</div><div class="pm-chips" id="ufAnnChips"><span class="pm-hint">读取公告列表…</span></div></div>';

    var parentOpts = '<option value="0">（我自己这一级）</option>';
    if (me.role === 'super') {
      (window.__usList || []).forEach(function (x) {
        if (isEdit && x.id === u.id) return;
        parentOpts += '<option value="' + x.id + '"' + (isEdit && Number(u.parentId) === x.id ? ' selected' : '') + '>' + esc(x.username) + (x.note ? '（' + esc(x.note) + '）' : '') + '</option>';
      });
    }

    /* v517：这个弹窗里还有动态生成的 <select>（上级账号），建完必须补一次系统下拉包装，
       否则又出现一个「原生长条下拉」，跟别处不一致 */
    setTimeout(function () { try { if (window.__wrapSelects) window.__wrapSelects(mask); } catch (e) {} }, 30);
    mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="子账号编辑" style="max-width:560px">'
      + '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>'
      + '<h2 class="modal-title" style="margin-bottom:10px">' + (isEdit ? '编辑账号：' + esc(u.username) : '新增账号') + '</h2>'
      + '<div class="form usf-body" id="usFormBody">'
      + (isEdit ? '' : '<label class="pm-hint" style="display:block;margin-bottom:4px">用户名（2-20 位字母数字）</label><input class="input" id="ufUser" style="width:100%;margin-bottom:8px" maxlength="20">')
      + (isEdit ? '' : '<label class="pm-hint" style="display:block;margin-bottom:4px">初始密码（6-50 位）</label><input class="input" id="ufPwd" type="password" style="width:100%;margin-bottom:8px" maxlength="50">')
      + '<label class="pm-hint" style="display:block;margin-bottom:4px">备注（这个人是谁 / 负责什么）</label><input class="input" id="ufNote" style="width:100%;margin-bottom:10px" maxlength="100" value="' + esc(isEdit ? (u.note || '') : '') + '">'
      + (me.role === 'super' ? '<label class="pm-hint" style="display:block;margin-bottom:4px">上级账号（决定跟谁是一组）</label><select class="input" id="ufParent" style="width:100%;margin-bottom:10px">' + parentOpts + '</select>' : '')
      + secHtml + scopeHtml + annHtml + codeHtml
      + '</div>'
      + '<div class="modal-footer"><button type="button" class="modal-inner-btn" id="ufSave">' + (isEdit ? '保存修改' : '创建账号') + '</button><button type="button" class="modal-close" data-x="1">关闭</button></div></div>';

    document.body.appendChild(mask);
    requestAnimationFrame(function () {
      mask.classList.add('open');
      try { var xb = mask.querySelector('[data-x]'); if (xb) xb.focus({ preventScroll: true }); } catch (eF) {}
    });
    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); }
    });
    /* 分组全选/清空 */
    mask.querySelectorAll('[data-all]').forEach(function (b) {
      b.addEventListener('click', function () {
        var grp = this.getAttribute('data-all');
        var boxes = [].slice.call(mask.querySelectorAll('[data-pa="' + grp + '"]'));
        var allOn = boxes.every(function (c) { return c.checked; });
        boxes.forEach(function (c) { c.checked = !allOn; });
      });
    });

    /* 公告列表（scope 用） */
    fetch('/api/admin/settings', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (x) {
      var st = (x && x.settings) || {};
      var arr = [];
      try { arr = JSON.parse(st.announcements || '[]') || []; } catch (e) { arr = []; }
      var box = mask.querySelector('#ufAnnChips'); if (!box) return;
      if (!arr.length) { box.innerHTML = '<span class="pm-hint">还没有公告，可先到「设置公告」发一条</span>'; return; }
      box.innerHTML = arr.map(function (a, i) {
        var id = String(a.id || ('a' + i));
        var on = annScope !== 'all' && Array.isArray(annScope) && annScope.indexOf(id) !== -1;
        return '<label class="pm-chip"><input type="checkbox" data-ann="' + esc(id) + '"' + (on ? ' checked' : '') + '><span>' + esc(String(a.title || '未命名公告').slice(0, 14)) + '</span></label>';
      }).join('');
    }).catch(function () {
      var box = mask.querySelector('#ufAnnChips'); if (box) box.innerHTML = '<span class="pm-hint">公告列表读取失败，可稍后重试</span>';
    });

    mask.querySelector('#ufSave').addEventListener('click', function () {
      var pv = {};
      mask.querySelectorAll('[data-pa]').forEach(function (c) {
        var g = c.getAttribute('data-pa'), k = c.getAttribute('data-pk');
        if (!c.checked) return;
        if (g === 'users') { pv.users = 1; return; }
        pv[g] = pv[g] || {}; pv[g][k] = 1;
      });
      var scopeMode = (mask.querySelector('input[name="ufScope"]:checked') || {}).value || 'all';
      var catIds = [];
      mask.querySelectorAll('[data-cat]').forEach(function (c) { if (c.checked) catIds.push(Number(c.getAttribute('data-cat'))); });
      pv.catsScope = scopeMode === 'all' ? 'all' : catIds;
      var annMode = (mask.querySelector('input[name="ufAnn"]:checked') || {}).value || 'all';
      var annIds = [];
      mask.querySelectorAll('[data-ann]').forEach(function (c) { if (c.checked) annIds.push(c.getAttribute('data-ann')); });
      pv.annScope = annMode === 'all' ? 'all' : annIds;
      pv.codeScope = (mask.querySelector('input[name="ufCode"]:checked') || {}).value || 'own';
      var note = (mask.querySelector('#ufNote') || {}).value || '';
      var btn = this;
      btn.disabled = true; btn.textContent = '保存中…';
      var restore = function () { btn.disabled = false; btn.textContent = isEdit ? '保存修改' : '创建账号'; };
      if (isEdit) {
        usersCall('PUT', { id: u.id, op: 'update', perms: pv, note: note }, function () {
          if (window.showToast) window.showToast('已保存', 'success');
          mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); renderUsersList();
        }, restore);
      } else {
        var un = (mask.querySelector('#ufUser') || {}).value || '';
        var pw = (mask.querySelector('#ufPwd') || {}).value || '';
        var psel = mask.querySelector('#ufParent');
        usersCall('POST', { username: un, password: pw, note: note, perms: pv, parentId: psel ? Number(psel.value) || 0 : 0 }, function () {
          if (window.showToast) window.showToast('账号已创建', 'success');
          mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); renderUsersList();
        }, restore);
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
          if (window.showToast) window.showToast(op === 'restore' ? '已恢复' : '已删除', 'success'); /* v512：文案统一两字 */
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
      '<div style="padding:10px 0">' + '<div class="sk-line" style="height:34px;border-radius:8px;margin-bottom:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '<div class="sk-line" style="height:34px;border-radius:8px;margin-bottom:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '<div class="sk-line" style="height:34px;border-radius:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '</div></div></div>' /* v443 条13：加载统一为全站骨架 */;
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
      var sec = function (title, rows) { return '<div style="margin-bottom:12px"><b style="display:block;font-size:13px;color:var(--text-light);margin-bottom:6px">' + title + '</b>' + (rows || '<div style="color:var(--text-faint);font-size:12px;padding:4px 0">这一项没有内容</div>') + '</div>'; };
      var row = function (kind, id, name, t) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #eef2f6">' +
          '<span style="flex:1;min-width:0;font-size:13px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '<span style="color:#9aa9b8;font-size:11px;margin-left:8px">' + fmtDelTime(t) + ' 删除</span></span>' +
          /* v512（老板：这里删除是四个字，跟别处不一样）：按键统一为系统行内键 .row-btn / .row-btn.danger，
             文案统一两字「删除」；「删了不能恢复」这层意思放到确认框里说，不用四个字吓人 */
          '<button type="button" class="row-btn" data-rc="restore" data-kind="' + kind + '" data-id="' + esc(String(id)) + '">恢复</button>' +
          '<button type="button" class="row-btn danger" data-rc="purge" data-kind="' + kind + '" data-id="' + esc(String(id)) + '">删除</button></div>';
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
          window.showConfirm('删除', '删除后无法恢复（这条记录会被永久清掉），确定继续？', function (closeConfirm) { closeConfirm(); recycleCall(op, kind, id, function () { openRecycle(); }); });
        } else recycleCall(op, kind, id, function () { openRecycle(); });
      });
    }).catch(function () { var body = mask.querySelector('#rcBody'); if (body) body.innerHTML = '<div style="text-align:center;color:#c62828;font-size:13px;padding:14px 0">加载失败，请关掉重试</div>'; });
  }

  /* 平台设置页挂入口键（v434b：照「修改密码」组同款——独立白色卡片、各占一行、btn-inline-pd 自适应键宽，
     不再 flex 拉满半屏、不再游离在卡片外） */
  (function wait() {
    /* v441：资源页批量导入入口按老板拍板撤除（导入只留平台设置页入口） */
    var panel = document.getElementById('panel-settings');
    if (panel && !document.getElementById('batchImportBtn')) {
      /* v443 条15（老板反馈：模块要分开，像基本设置那样独立卡片不粘连）：
         三组各自独立 setting-group 白卡；「账号与安全」卡内末尾挪入修改密码组 */
      var btnHtml = function (id, lab, extra) { return '<button type="button" class="btn-blue btn-inline-pd" id="' + id + '"' + (extra || '') + '>' + lab + '</button>'; };
      var row = function (lab, btnStr) { return '<div class="setting-row"><label>' + lab + '</label>' + btnStr + '</div>'; };
      var mkGroup = function (title, rowsHtml) {
        var g = document.createElement('div');
        g.className = 'setting-group';
        g.innerHTML = '<h3>' + title + '</h3>' + rowsHtml;
        panel.appendChild(g);
        return g;
      };
      mkGroup('内容管理', row('批量导入', btnHtml('batchImportBtn', '批量导入')) + row('数据缓存（删除的内容保留 60 天）', btnHtml('recycleBtn', '数据缓存')));
      mkGroup('系统维护', row('系统体检（图片/外链/环境检查）', btnHtml('imgCheckBtn', '系统体检')));
      var accGrp = mkGroup('账号与安全', row('子账号权限与冻结', btnHtml('usersBtn', '账号管理', ' data-perm="users"')));
      var grp = accGrp;
      /* 把静态「修改密码」组挪进「账号与安全」组最末（保证修改密码永远在最下面）；
         原组自带 setting-group 白卡样式，挪进组内会双层嵌套 → 降级为普通块 */
      try {
        var pwdGrp = document.getElementById('pwdGroup');
        if (pwdGrp) { pwdGrp.className = ''; pwdGrp.style.marginTop = '6px'; accGrp.appendChild(pwdGrp); }
      } catch (eP) { if (window.__silent) window.__silent(eP); }
      panel.querySelector('#batchImportBtn').addEventListener('click', openWizard);
      panel.querySelector('#imgCheckBtn').addEventListener('click', function () { try { this.querySelector('.dot-badge') && this.querySelector('.dot-badge').remove(); } catch (eC) {} sysCheck(); });
      panel.querySelector('#recycleBtn').addEventListener('click', openRecycle);
      panel.querySelector('#usersBtn').addEventListener('click', openUsers);

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
