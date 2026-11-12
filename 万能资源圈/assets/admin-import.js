/* ===== v431 批量导入（平台设置，智能表格）=====
 复用：SpreadsheetML 多工作表格式（与统计导出同源）、现有弹窗骨架、现有 api() 入库接口。
 流程：下载模板（自动带下拉）→ 上传 → 预览纠错 → 确认导入 → 可撤销提示。 */
(function () {
 'use strict';
 var NS = 'urn:schemas-microsoft-com:office:spreadsheet';

 /* v545：转义统一复用 ui-common 的 escapeHtml（全站唯一实现，连引号一起转），本地不再各写一份 */
 var esc = window.escapeHtml || function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };

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
 var st = ri < hdr ? 1 : 2; /* 1=表头（粗体+浅蓝底） 2=数据区（细边框） */
 if (v === '' || v == null) return '<c r="' + ref + '" s="' + st + '"/>';
 return '<c r="' + ref + '" s="' + st + '" t="inlineStr"><is><t xml:space="preserve">' + esc(String(v)) + '</t></is></c>';
 }).join('');
 return '<row r="' + (ri + 1) + '"' + (ri < hdr ? ' ht="26" customHeight="1"' : '') + '>' + cells + '</row>';
 }).join('');
 var dv = '';
 if (cfg.dv && cfg.dv.length) {
 dv = '<dataValidations count="' + cfg.dv.length + '">' + cfg.dv.map(function (d) {
 /* v537（老板）：模板里不要那些一弹出就挡半屏的说明气泡了——只留下拉本身，填错才提示 */
 return '<dataValidation type="list" allowBlank="1" showInputMessage="0" showErrorMessage="1"' +
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
 sheets.map(function (sh, i) { return '<sheet name="' + esc(sh.name) + '" sheetId="' + (i + 1) + '"' + (sh.hidden ? ' state="hidden"' : '') + ' r:id="rId' + (i + 1) + '"/>'; }).join('') +
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
 if (hi < 0) hi = 0; /* 没认出表头：按第一行是数据、0/1/2 的位置猜 */
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
 var lastOpt = opts.length + 1; /* 选项表 A2..A(lastOpt) */
 var CAT_DV = '分类选项';
 var LV_DV = '分类级别选项';
 var ST_DV = '显示状态选项';
 var OPT_NAMES = [
 { name: '分类选项', ref: '选项!$A$2:$A$' + lastOpt },
 { name: '分类级别选项', ref: '选项!$B$2:$B$3' },
 { name: '显示状态选项', ref: '选项!$C$2:$C$3' },
 { name: '时间选项', ref: '选项!$D$2:$D$9' } /* v537：两个"定时时间"列也改成下拉选，不用手打 */
 ];
 var ROWSN = 30; /* 预留 30 行空白（带边框 + 下拉） */
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
 var optHeads = ['分类选项', '分类级别选项', '显示状态选项', '时间选项'];

 /* v537：定时时间给 8 个常用时间点（按下载当天算），下拉直接选；要别的点仍可手打 */
 var _dtNow = new Date();
 var _dtStr = function (dayOffset, hh) {
 var x = new Date(_dtNow.getTime() + dayOffset * 86400000);
 return x.getFullYear() + '-' + pd(x.getMonth() + 1) + '-' + pd(x.getDate()) + ' ' + pd(hh) + ':00';
 };
 var DT_OPTS = [_dtStr(0, 9), _dtStr(0, 18), _dtStr(1, 9), _dtStr(1, 18), _dtStr(2, 9), _dtStr(3, 9), _dtStr(7, 9), _dtStr(7, 18)];

 var optRows = [optHeads];
 for (var i = 0; i < Math.max(opts.length, DT_OPTS.length, 2); i++) {
 optRows.push([opts[i] || '', i === 0 ? '一级分类' : (i === 1 ? '二级分类' : ''), i === 0 ? '显示' : (i === 1 ? '隐藏' : ''), DT_OPTS[i] || '']);
 }

 var sheets = [
 { name: '资源', rows: mk(resHeads), widths: [26, 18, 30, 40, 12, 30, 8, 12, 18, 18, 30, 30], dv: [
 { sqref: 'B2:B' + (ROWSN + 1), formula: CAT_DV },
 { sqref: 'H2:H' + (ROWSN + 1), formula: ST_DV },
 { sqref: 'I2:I' + (ROWSN + 1), formula: '时间选项' },
 { sqref: 'J2:J' + (ROWSN + 1), formula: '时间选项' }
 ] },
 { name: '类型', rows: mk(varHeads), widths: [26, 18, 12, 30, 24, 40, 12, 12, 8], dv: [
 { sqref: 'H2:H' + (ROWSN + 1), formula: ST_DV }
 ] },
 { name: '分类', rows: mk(catHeads), widths: [22, 14, 22, 12, 12], dv: [
 { sqref: 'B2:B' + (ROWSN + 1), formula: LV_DV },
 { sqref: 'C2:C' + (ROWSN + 1), formula: CAT_DV },
 { sqref: 'E2:E' + (ROWSN + 1), formula: ST_DV }
 ] },
 { name: '公告', rows: mk(annHeads), widths: [26, 50, 12, 12], dv: [
 { sqref: 'D2:D' + (ROWSN + 1), formula: ST_DV }
 ] },
 /* v530：选项表设为隐藏工作表——它只是下拉源，用户填表时看不到，下拉照常能用 */
 { name: '选项', rows: optRows, widths: [24, 16, 16, 22], dv: [], names: OPT_NAMES, hidden: true }
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
 vars.forEach(function (r, i) { if (!r[0] || !r[1]) { bad++; lines.push('类型第' + (i + 2) + '行：缺所属资源标题或类型名称，跳过'); } }); 
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
 /* ===== v534：导入历史（老板：导入完只弹一次 toast，关掉就查不到上次导了几条、哪条失败）=====
 存 localStorage，保留最近 10 次；只记时间/文件名/成功条数/失败原因摘要，不存内容。 */
 var IMP_HIST_KEY = 'wnzyq_import_hist';
 function impHistRead() {
 try { var a = JSON.parse(localStorage.getItem(IMP_HIST_KEY) || '[]'); return Array.isArray(a) ? a : []; }
 catch (e) { return []; }
 }
 function impHistPush(rec) {
 try {
 var a = impHistRead(); a.unshift(rec); a = a.slice(0, 10);
 localStorage.setItem(IMP_HIST_KEY, JSON.stringify(a));
 } catch (e) {}
 }
 function bjNow() {
 return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ');
 }
 function renderImpHist(host) {
 if (!host) return;
 var a = impHistRead();
 var h = '<div class="imp-hist-h">导入历史（最近 10 次，只记在这台电脑上）</div>';
 if (!a.length) {
 h += '<div class="imp-hist-empty">该列表暂无导入记录。导一次之后，这里会显示时间、文件名、成功几条、哪条失败。</div>';
 } else {
 h += a.map(function (r) {
 var bad = Number(r.bad) || 0;
 return '<div class="imp-hist-row"><span class="t">' + esc(r.at || '') + '</span>' +
 '<span class="f" title="' + esc(r.file || '') + '">' + esc(r.file || '（未记文件名）') + '</span>' +
 '<span class="r ' + (bad ? 'is-bad' : 'is-ok') + '">' + (bad ? (r.ok || 0) + ' 成功 / ' + bad + ' 失败' : (r.ok || 0) + ' 条全成功') + '</span></div>' +
 (bad && r.note ? '<div class="imp-hist-note">' + esc(r.note) + '</div>' : '');
 }).join('');
 }
 host.innerHTML = h;
 }

 function openWizard() {
 var old = document.getElementById('importMask');
 if (old) old.remove();
 var mask = document.createElement('div');
 mask.className = 'modal-mask'; mask.id = 'importMask';
 mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="批量导入"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
 '<h2 class="modal-title">批量导入</h2><div class="form" id="impBody">' +
 '<p class="imp-lead">先导分类，再导资源</p>' +
 '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-blue btn-inline" id="impTpl" style="flex:1">下载模板</button>' +
 '<button class="btn-blue btn-inline" id="impUploadBtn" style="flex:1">上传表格</button><input type="file" id="impFile" accept=".xlsx,.xls,.xml" style="display:none"></div>' +
 '<div id="impPrev" style="margin-top:10px"></div>' +
 '<div class="imp-hist" id="impHist"></div></div>' +
 '<div class="modal-footer"><button type="button" class="modal-close" data-x="1">关闭</button></div></div>';
 document.body.appendChild(mask);
 renderImpHist(mask.querySelector('#impHist'));
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
 if (window.showToast) window.showToast('模板已下载', 'success');
 });
 mask.querySelector('#impUploadBtn').addEventListener('click', function () { mask.querySelector('#impFile').click(); }); /* v443 条5：上传键改 button 与下载键完全同款（原 label 结构渲染发灰） */
 mask.querySelector('#impFile').addEventListener('change', function () {
 var f = this.files && this.files[0]; if (!f) return;
 var fname = String(f.name || '');
 var rd = new FileReader();
 rd.onload = function () {
 /* v456：先看文件头——zip(PK) 走 xlsx 解析，其余按老 SpreadsheetML/HTML 表格解析 */
 var buf = rd.result, isZip = false;
 try { var head = new Uint8Array(buf, 0, 4); isZip = head[0] === 0x50 && head[1] === 0x4B; } catch (eH) { isZip = false; }
 var doneParse = function (data) {
 var pv = preview(data);
 var body = mask.querySelector('#impPrev');
 var total = (pv['资源'] || []).length + (pv['类型'] || []).length + (pv['分类'] || []).length + (pv['公告'] || []).length; /* v431c：键名与 preview 返回值对齐（旧 pv.res 未同步=预览空白的真凶） */
 body.innerHTML = '<div class="imp-log">' + esc(pv.lines.join('\n')) + '</div>' +
 '<button class="btn-blue" id="impGo" style="width:100%"' + (total ? '' : ' disabled') + '>确认导入</button>';
 body.querySelector('#impGo').addEventListener('click', function () {
 this.disabled = true; this.textContent = '导入中';
 /* v439 #69：实时回显——每条导入完成立即上屏（成功绿/失败红），不等全部结束 */
 body.innerHTML = '<div id="impLive" class="imp-log imp-log-live"></div>';
 var live = body.querySelector('#impLive');
 var onLog = function (line) {
 var ln = document.createElement('div');
 var bad = /失败|错误/.test(line);
 ln.textContent = line;
 ln.className = bad ? 'is-bad' : 'is-ok';
 live.appendChild(ln);
 try { live.scrollTop = live.scrollHeight; } catch (e2) {}
 };
 doImport(pv, onLog).then(function (log) {
 var badN = log.filter(function (l) { return /失败|错误/.test(l); }).length;
 var sum = document.createElement('div');
 sum.className = 'imp-log-sum ' + (badN ? 'is-bad' : 'is-ok');
 sum.textContent = '导入完成：' + log.length + ' 条' + (badN ? '（失败 ' + badN + ' 条）' : '，全部成功');
 live.appendChild(sum);
 try { live.scrollTop = live.scrollHeight; } catch (e3) {}
 /* v534：记一条导入历史（时间 / 文件 / 成功数 / 失败摘要），下次打开弹窗能回看 */
 impHistPush({
 at: bjNow(), file: fname, total: log.length,
 ok: log.length - badN, bad: badN,
 note: badN ? (log.filter(function (l) { return /失败|错误/.test(l); })[0] || '').slice(0, 80) : ''
 });
 renderImpHist(mask.querySelector('#impHist'));
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
 '<div style="font-size: 14px;color:var(--text-light);margin:0 0 12px">正在检查图片和外链，最长约半分钟</div>' +
 /* v546h（老板反馈：体检约 30 秒只有骨架、不知道进行到哪）：加真实进度条，随检测逐张推进 */
 '<div style="margin:0 0 14px"><div style="height:6px;border-radius:99px;background:var(--border,#e6ecf5);overflow:hidden"><i id="chkProgFill" style="display:block;height:100%;width:0;border-radius:99px;background:var(--blue1,#1976D2);transition:width .25s ease"></i></div>' +
 '<div id="chkProgTxt" style="font-size:12px;color:var(--text-light);margin-top:6px">正在准备检查清单</div></div>' +
 '<div class="chk-scroll"><div class="chk-skel">' +
 '<div class="sk-line" style="height:14px;width:70%"></div>' +
 '<div class="sk-line" style="height:14px;width:50%"></div>' +
 '<div class="sk-line" style="height:14px;width:62%"></div></div></div></div>';
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
 /* v551 条5（老板：「系统体检里同图判定是不是有问题，实际上不同图」）：
 原逻辑把「封面 p.img」和「封面组第一张 cover_images[0]」各登记一次——
 这两者在资源页渲染的是同一张图（封面组第一张就是封面），URL 必然相同，
 于是每一个资源都会被判成「同图重复引用 2 处」，全是误报。
 现在封面组第一张若与封面同址就跳过，只登记一次；真正不同的图才参与重复判定。 */
 var _cov = p.img || '';
 addImg(_cov, '封面', 'img', -1);
 (p.coverImages || []).forEach(function (u, i) {
 if (!u) return;
 if (u === _cov) return; /* 与封面同址=同一张图，同一位置，不重复登记 */
 addImg(u, '封面组', 'cover_images', i);
 });
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
 if (!linkKey[k]) { linkKey[k] = 1; links.push({ href: href, where: pname, pid: p.id }); }
 }
 });
 } catch (e0) { if (window.__silent) window.__silent(e0); }
 });
 });
 if (!imgs.length && !links.length) { var _eS = document.getElementById('sysCheckMask'); if (_eS) _eS.remove(); if (!silent && window.showToast) window.showToast('没有可检查的内容', 'info'); resolve(null); return; } /* v442：早退先撤「体检中」弹窗 */
 if (!silent && window.showToast) window.showToast('系统体检中：图片 ' + imgs.length + ' 张，外链 ' + links.length + ' 条', 'info');

 /* 图片按 URL 去重并发检测；引用关系统计重复；同趟 fetch 测体积（#79 超大图） */
 var refMap = {};
 imgs.forEach(function (it) { (refMap[it.src] = refMap[it.src] || []).push(it); });
 var testList = Object.keys(refMap).map(function (src) { return { src: src, refs: refMap[src] }; });
 var broken = [], oversize = [], done = 0, total = testList.length;
 /* v546h：真实进度条——图片与各条外链各自回一个就往前走一格，老板能看见卡在哪一步 */
 var _pgFill = document.getElementById('chkProgFill');
 var _pgTxt = document.getElementById('chkProgTxt');
 var _linkCnt = 0, _pTotal = total + links.length, _pLast = -1;
 function __tickProg(stage) {
 if (!_pgFill) return;
 var d = done + _linkCnt;
 var pct = _pTotal ? Math.round(d / _pTotal * 100) : 100;
 if (pct === _pLast && !stage) return;
 _pLast = pct;
 try { _pgFill.style.width = (stage ? 96 : pct) + '%'; } catch (eP) {}
 if (_pgTxt) _pgTxt.textContent = stage || ('正在检查：图片 ' + done + ' / ' + total + ' 张，外链 ' + _linkCnt + ' / ' + links.length + ' 条（' + pct + '%）');
 }
 __tickProg();
 /* v438b：双阶段齐活再渲染（图片+外链都回来才算完）；v439 #79：同源图 fetch 测大小 */
 var imgDone = new Promise(function (res) { window.__sysImgFinish = res; });
 /* v448 修复「外链检测必然误报」：CSP 的 connect-src 只允许 'self'，原来对每条外链发
 fetch(no-cors) 在线上必被安全策略拦截 —— 结果①控制台刷 CSP 违规 ②所有外链一律被标
 「疑似失效」（误报），体检结论不可信。现改为：
，图片类外链（扩展名可判）→ 用 Image 探测（img-src 允许 https:，不受 connect-src 限制）；
，网页类外链 → 不发起任何请求，标为「未检测」(ok=null)，不参与失效统计。
 渲染端原本就用 L.ok === false / === true 严格判断，null 天然被排除，无需改动下游。 */
 var linkDone = Promise.all(links.map(function (L) {
 return new Promise(function (res) {
 var href = String(L.href || '');
 if (/\.(png|jpe?g|gif|webp|svg|ico|bmp)(\?|#|$)/i.test(href)) {
 var imL = new Image(), settled = false;
 var done2 = function (v) { if (settled) return; settled = true; L.ok = v; _linkCnt++; __tickProg(); res(L); };
 imL.onload = function () { done2(true); };
 imL.onerror = function () { done2(false); };
 setTimeout(function () { done2(null); }, 6000);
 imL.src = href;
 } else {
 L.ok = null; L.unchecked = true; _linkCnt++; __tickProg(); res(L);
 }
 });
 })).then(function () { return links; });
 var finish = function () {
 if (done < total) return;
 window.__sysImgFinish();
 };
 /* v534（事故 #61）：done2/finish2 必须在循环之前声明——原来写在 forEach 之后，
 var 提升让循环里的 finish2 还是 undefined，跨域图走 else 分支时就成了 setTimeout(undefined, 0)，
 浏览器把它当字符串去执行（CSP 拦下并刷控制台），同时计数永远不 +1，
 导致 sizeDone 每次都要等满 9 秒超时（体检「点完要转圈很久」的真因之一）。 */
 var done2 = 0;
 var finish2 = function () { done2++; };
 testList.forEach(function (it) {
 var im = new Image();
 var fin = function (ok) { done++; if (!ok) broken.push(it); __tickProg(); finish(); };
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
 var sizeDone = new Promise(function (res) {
 var t = setInterval(function () { if (done2 >= total) { clearInterval(t); res(); } }, 120);
 setTimeout(function () { clearInterval(t); res(); }, 9000);
 });
 if (!total) finish();
 Promise.all([imgDone, linkDone, sizeDone]).then(function () {
 __tickProg('图片和外链已查完，正在核对运行环境');
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
 if (btn) { btn.disabled = true; btn.textContent = '压缩中'; }
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
 if (window.showToast) window.showToast('已换成压缩图', 'success');
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
 if (btn) { btn.disabled = true; btn.textContent = '恢复中'; }
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
 act.innerHTML = '<span style="color:#2e7d32;font-size: 12px">✓ 已替换</span> <button type="button" class="btn-blue btn-inline-pd" data-osrestore="1">恢复原图</button>';
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
 /* v614d：这里原来先无条件 remove 掉「体检中」弹窗，后面才去读它判断“用户关没关”——
 元素都没了，判断永远是“没关”，于是点了关闭结果弹窗又冒回来（journey-admin 的间歇性失败）。
 先在移除前把状态记下来。 */
 var _prev = document.getElementById('sysCheckMask');
 window.__chkClosedEarly = !!(_prev && (_prev.dataset.userClosed === '1' || !_prev.classList.contains('open')));
 if (_prev) _prev.remove();
 var brokenRows = R0.broken.map(function (it) {
 return '<div class="chk-row">' +
 '<span class="chk-thumb chk-thumb-bad">✕</span>' +
 '<span class="chk-main"><b>' + esc(it.refs[0].where) + '</b><span class="chk-sub">' + esc(it.src) + '</span></span>' +
 '<button type="button" class="btn-blue btn-inline-pd" data-goto-pid="' + esc(String(it.refs[0].pid)) + '">去处理</button></div>';
 });
 var dupRows = R0.dups.map(function (it) {
 var wheres = it.refs.map(function (r) { return r.where; }).join('、');
 return '<div class="chk-row">' +
 '<img class="chk-thumb" src="' + esc(it.src) + '" alt="重复引用的图片">' +
 '<span class="chk-main"><b>被 ' + it.refs.length + ' 处引用</b><span class="chk-sub">' + esc(wheres) + '</span></span></div>';
 });
 var badLinks = R0.links.filter(function (L) { return L.ok === false; });
 var okLinks = R0.links.filter(function (L) { return L.ok === true; }).length;
 var uncheckedLinks = (R0.links || []).filter(function (L) { return L.ok === null; }).length; /* v448：网页类外链受 CSP 限制无法自动检测，需人工核对 */
 var linkRows = badLinks.map(function (L) {
 return '<div class="chk-row">' +
 '<span class="chk-thumb chk-thumb-bad">⚠</span>' +
 '<span class="chk-main"><b>' + esc(L.where) + '</b><span class="chk-sub">' + esc(L.href) + '</span></span>' +
 (L.pid ? '<button type="button" class="btn-blue btn-inline-pd" data-goto-pid="' + esc(String(L.pid)) + '">去处理</button>' : '') + '</div>';
 });
 /* #79 超大图分组（>1MB，可压缩替换+恢复原图） */
 var osRows = (R0.oversize || []).map(function (it, oi) {
 return '<div class="chk-row" data-osidx="' + oi + '">' +
 '<img class="chk-thumb" src="' + esc(it.src) + '" alt="超大图片">' +
 '<span class="chk-main"><b>' + esc(it.refs[0].where) + ' <span class="chk-size">' + (it.size ? (it.size / 1024 / 1024).toFixed(2) + ' MB' : '') + '</span></b><span class="chk-sub">' + esc(it.src) + '</span></span>' +
 '<span class="chk-act" data-osact="1"></span>' +
 '<button type="button" class="row-btn" data-goto-pid="' + esc(String(it.refs[0].pid)) + '">去处理</button></div>';
 });
 var badEnv = (R0.env || []).filter(function (e) { return !e.ok; });
 var envRows = (R0.env || []).map(function (e) {
 return '<div class="chk-row">' +
 '<span class="chk-thumb ' + (e.ok ? 'chk-thumb-ok' : 'chk-thumb-bad') + '">' + (e.ok ? '✓' : '✕') + '</span>' +
 '<span class="chk-main"><b>' + esc(e.name) + '</b><span class="chk-sub">' + esc(e.detail) + '</span></span></div>';
 });
 /* v540：每个分组一页 20 条（体检结果可能上千条，原来一次性铺开会很卡） */
 var CHK_DATA = { env: envRows, broken: brokenRows, dups: dupRows, links: linkRows, os: osRows };
 var sec = function (title, tone, key, arr, note, count) {
 if (!arr || !arr.length) return '';
 return '<div class="chk-sec"><div class="chk-sec-h ' + tone + '"><span>' + title + '</span>' +
 (note ? '<span class="chk-note">' + note + '</span>' : '') +
 (count != null ? '<span class="chk-n">' + count + '</span>' : '') + '</div>' +
 '<div class="chk-sec-b" data-chk="' + key + '"></div></div>';
 };
 var body = sec('环境检查', badEnv.length ? 'is-bad' : 'is-ok', 'env', envRows, '后端 / 离线缓存 / 静态缓存 / 本地存储',
 ((R0.env || []).length - badEnv.length) + '/' + (R0.env || []).length + ' 正常') +
 sec('失效图片', 'is-bad', 'broken', brokenRows, '点「去处理」直接打开对应资源编辑', R0.broken.length + ' 张') +
 sec('重复图片引用', 'is-warn', 'dups', dupRows, '同图多处使用，确认是否故意', R0.dups.length + ' 组') +
 sec('疑似失效外链', 'is-bad', 'links', linkRows, '跨域限制下只测图片类外链，网页链接需人工核对', badLinks.length + ' 条') +
 sec('超大图片', 'is-warn', 'os', osRows, '超 1MB 拖慢加载；压缩替换后原图留存可恢复', (R0.oversize || []).length + ' 张');
 var hasIssue = R0.broken.length || R0.dups.length || badLinks.length || (R0.oversize || []).length || badEnv.length;
 if (!hasIssue) body = '<div class="chk-empty">全部正常 ✓ 图片 ' + R0.totalImgs + ' 张，外链 ' + okLinks + '/' + R0.links.length + ' 条可达，环境 ' + (R0.env || []).length + '/' + (R0.env || []).length + '</div>';
 /* v534：顶部摘要改成一行小签（原来是灰字长句，挤成一团看不清哪个数是要紧的） */
 var chip = function (n, label, tone) {
 return '<span class="chk-chip' + (tone ? ' ' + tone : '') + '">' + label + ' <b>' + n + '</b></span>';
 };
 var chips = chip(R0.totalImgs, '图片', '') +
 chip(R0.broken.length, '失效', R0.broken.length ? 'is-bad' : '') +
 chip(R0.dups.length, '重复', R0.dups.length ? 'is-warn' : '') +
 chip(badLinks.length, '失效外链', badLinks.length ? 'is-bad' : '') +
 (uncheckedLinks ? chip(uncheckedLinks, '待人工核对', 'is-warn') : '') +
 chip((R0.oversize || []).length, '超大图', (R0.oversize || []).length ? 'is-warn' : '');
 var mask = document.createElement('div');
 /* v442 条3：用户中途关掉了「体检中」弹窗 → 结果不再弹窗打扰（仍照常 resolve 供自动体检用） */
 var _prevMask = document.getElementById('sysCheckMask');
 /* v614c：判“用户已经关了”要三种情况都算：显式点过 ×（userClosed）、
 或者弹窗已经不在 DOM、或者已经不含 open 类。原来只看 userClosed，
 结果“程序化把 open 拿掉”的关闭方式（以及遮罩被别处收起）会让结果弹窗又冒回来。 */
 var _wasClosed = !!window.__chkClosedEarly || !!(_prevMask && (_prevMask.dataset.userClosed === '1' || !_prevMask.classList.contains('open')));
 window.__chkClosedEarly = false;
 if (_wasClosed) { document.getElementById('sysCheckMask').remove(); resolve(R0); return; }
 mask.className = 'modal-mask'; mask.id = 'sysCheckMask';
 mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="系统体检" style="max-width:var(--modal-w-xl)"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
 '<h2 class="modal-title">系统体检</h2>' +
 '<div class="chk-sum">' + chips + '</div>' +
 '<div class="chk-scroll">' + body + '</div></div>'; /* v608（老板 11-12 第 14 条）：系统体检底部不要关闭键，头部 × 已够 */
 document.body.appendChild(mask);
 requestAnimationFrame(function () {
 mask.classList.add('open');
 try { var xb = mask.querySelector('[data-x]'); if (xb) xb.focus({ preventScroll: true }); } catch (eF) {} /* v439 #84：弹窗打开聚焦关闭键 */
 });
 /* v540：分组渲染 + 每段一页 20 条（体检结果可能上千条） */
 var __chkPage = {};
 var bindOsRows = function () { /* #79 超大图行动作绑定（按 data-osidx 直接取对象） */
 Array.prototype.forEach.call(mask.querySelectorAll('[data-osidx]'), function (row) {
 var it = (R0.oversize || [])[Number(row.getAttribute('data-osidx'))];
 if (!it) return;
 renderOversizeRowState(row, it);
 });
 };
 var paintChk = function (key) {
 var holder = mask.querySelector('[data-chk="' + key + '"]');
 if (!holder) return;
 var st = window.__slicePage(CHK_DATA[key] || [], __chkPage[key] || 1, window.LIST_PAGE_SIZE || 20);
 __chkPage[key] = st.page;
 holder.innerHTML = st.items.join('') + (st.totalPages > 1 ? '<div class="uni-pager" data-chkpg="' + key + '"></div>' : '');
 var pg = holder.querySelector('[data-chkpg]');
 if (pg && window.buildUniPager) {
 window.buildUniPager(pg, {
 page: st.page, totalPages: st.totalPages, total: st.total, unit: '项',
 onPage: function (p9) { __chkPage[key] = p9; paintChk(key); }
 });
 }
 if (key === 'os') bindOsRows();
 /* 缩略图加载失败就藏起来（复用到每一页） */
 Array.prototype.forEach.call(holder.querySelectorAll('img.chk-thumb'), function (im) {
 im.addEventListener('error', function () { this.style.visibility = 'hidden'; });
 });
 };
 ['env', 'broken', 'dups', 'links', 'os'].forEach(paintChk);
 /* v534：缩略图 onerror 已改成 addEventListener（内联写法被 CSP 拦下）；v540 起并入 paintChk 每页生效 */
 mask.addEventListener('click', function (e) {
 var go = e.target.closest && e.target.closest('[data-goto-pid]');
 if (go) { gotoEditProduct(go.getAttribute('data-goto-pid')); return; }
 if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); }
 });
 }

 /* 定位：关体检弹窗 → 切资源管理 → 找到资源行高亮 → 打开编辑弹窗 */
 function gotoEditProduct(pid) {
 /* v590（老板 11-09 第 11 条）：点「去处理」不许跳走（原来会关掉体检窗、切到资源页、再翻列表点编辑），
 就地在这层弹窗上打开这条资源的编辑弹窗——关掉编辑回到体检，位置一点不丢。 */
 if (!pid) return;
 if (typeof window.__openEdit !== 'function') { if (window.showToast) window.showToast('稍等一下再点', 'error'); return; }
 fetch('/api/admin/products/' + encodeURIComponent(pid), { credentials: 'include' })
 .then(function (r) { return r.json(); })
 .then(function (j) {
 if (!j || !j.ok || !j.product) { if (window.showToast) window.showToast((j && j.msg) || '这条资源取不到（可能已删除）', 'error'); return; }
 window.__openEdit(j.product);
 /* v591：编辑弹窗在 DOM 里靠前，体检窗是后插进 body 的，同 z-index 时会盖在编辑窗上面——
 实测点「去处理」编辑窗打开了却看不见。这里把它提到 body 末尾，保证叠在体检上面。 */
 try {
 var em = document.getElementById('editMask');
 if (em && em.parentNode) em.parentNode.appendChild(em);
 } catch (eR) {}
 })
 .catch(function () { if (window.showToast) window.showToast('打开失败，请重试', 'error'); });
 }


 /* ===== v439 #116 子账号管理（拍板 v3：三把锁/层级不限/绝对管理权） ===== */
 /* v442 条7：重置子账号密码——页面内小弹窗（替代原生 prompt，杜绝「验证卡死」） */
 function openResetPwd(u, onOk) {
 var old = document.getElementById('usPwdMask'); if (old) old.remove();
 var mask = document.createElement('div');
 mask.className = 'modal-mask'; mask.id = 'usPwdMask';
 mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="重置密码"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
 '<h2 class="modal-title">重置密码：' + esc(u.username || '') + '</h2><div class="form">' +
 '<label style="display:block;font-size: 14px;color:var(--text-light);margin-bottom:4px">新密码（6-50 位）</label>' +
 '<input id="usPwdInput" type="text" maxlength="50" class="input w-full-mb10" autocomplete="off">' +
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
 function usersCall(method, body, done, fail, urlOverride) { fetch(urlOverride || '/api/admin/users', { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined }) /* v443 条6：删除等需带 id 查询串的场景用 urlOverride */
 .then(function (r) { return r.json(); })
 .then(function (x) { if (x && x.ok) { if (done) done(x); } else { if (window.showToast) window.showToast((x && x.msg) || '操作失败', 'error'); if (fail) fail(x); } })
 .catch(function () { if (window.showToast) window.showToast(window.T('netFail'), 'error'); if (fail) fail(); });
 }
 /* v454：账号操作的小弹窗（改密/冻结/删除共用）——样式与全站弹窗一致，不再用浏览器原生 prompt */
 function usAsk(title, msg, opts, onOk) {
 opts = opts || {};
 var old = document.getElementById('usAskMask'); if (old) old.remove();
 var m = document.createElement('div');
 m.className = 'modal-mask'; m.id = 'usAskMask';
 m.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" style="max-width:var(--modal-w-xs)">'
 + '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>'
 + '<h2 class="modal-title">' + esc(title) + '</h2>'
 + '<p style="font-size: 14px;color:var(--text-light);margin:0 0 10px;line-height:1.6">' + msg + '</p>'
 + (opts.input ? '<input class="input w-full-mb10" id="usAskInput" type="' + (opts.inputType || 'text') + '" maxlength="' + (opts.maxlength || 50) + '" placeholder="' + esc(opts.placeholder || '') + '">' : '')
 + '<div class="modal-footer"><button class="modal-inner-btn" id="usAskOk">' + esc(opts.okText || '确定') + '</button><button class="modal-close" data-x="1">关闭</button></div></div>';
 document.body.appendChild(m);
 requestAnimationFrame(function () { m.classList.add('open'); var i = m.querySelector('#usAskInput'); if (i) { try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } } });
 function close() { m.classList.remove('open'); setTimeout(function () { m.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180); }
 m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-x]')) close(); });
 m.querySelector('#usAskOk').addEventListener('click', function () {
 var v = m.querySelector('#usAskInput') ? m.querySelector('#usAskInput').value : '';
 if (opts.input && !String(v).trim()) { if (window.showToast) window.showToast('请填写内容', 'error'); return; }
 var btn = this; btn.disabled = true; btn.textContent = '处理中'; /* v554：回退，恢复换字 */
 onOk(String(v).trim(), function () { close(); }, function () { btn.disabled = false; btn.textContent = opts.okText || '确定'; });
 });
 }
 function usersPwd(u) {
 usAsk('修改密码', '给「' + esc(u.username) + '」设置新密码（6-50 位）。', { input: true, inputType: 'password', placeholder: '新密码', okText: '确定' }, function (v, done, fail) {
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
 ? '该账号下有 <b>' + subtree + '</b> 个下级账号，删除后这些账号会一并失效（数据保留，可在「回收站点」找回）。'
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
 if (!x || !x.ok) { body.innerHTML = '<div class="imp-err">' + esc((x && x.msg) || '加载失败') + '</div>'; return; }
 var me = x.me || {}; window.__usMe = me; window.__usList = x.list || [];
 var isSuper = me.role === 'super';
 var list = window.__usList;
 if (!list.length) { body.innerHTML = (window.__adminEmpty ? window.__adminEmpty('该列表暂无子账号', '上面填账号密码就能加一个，可以只给他看的范围') : '该列表暂无子账号'); return; }
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
 /* v540：一页 20 条；同分类一样按"顶层账号 + 它的下级"整组分页，不把上下级拆开 */
 var __usPage = 1, __usPages = 1, __usTotal = order.length;
 var __usSize = window.LIST_PAGE_SIZE || 20;
 var __shown = order;
 if (order.length > __usSize) {
 var __ug = [], __uc = null;
 order.forEach(function (it) {
 if (it.depth === 0) { __uc = [it]; __ug.push(__uc); }
 else if (__uc) __uc.push(it);
 else { __uc = [it]; __ug.push(__uc); }
 });
 var __ups = [], __ub = [], __un = 0;
 __ug.forEach(function (g) {
 if (__un + g.length > __usSize && __ub.length) { __ups.push(__ub); __ub = []; __un = 0; }
 __ub = __ub.concat(g); __un += g.length;
 });
 if (__ub.length) __ups.push(__ub);
 __usPages = __ups.length;
 __usPage = Math.min(Math.max(1, parseInt(window.__usPage, 10) || 1), __usPages);
 window.__usPage = __usPage;
 __shown = __ups[__usPage - 1];
 } else { window.__usPage = 1; }
 var rows = __shown.map(function (it) {
 var u = it.u, hasKids = (byParent[u.id] || []).length > 0;
 /* v595：有下级的账号默认收起（undefined 视为收起），点了才展开 */
 var collapsed = hasKids ? (window.__usCollapsed[u.id] !== false) : false;
 var isMe = u.username === me.username;
 var canManage = isSuper || Number(u.parentId) === Number(me.id);
 var ops = canManage && !isMe ? '<button type="button" class="row-btn" data-ua="edit" data-id="' + u.id + '">编辑</button>'
 + '<button type="button" class="row-btn" data-ua="pwd" data-id="' + u.id + '">改密</button>'
 + '<button type="button" class="row-btn" data-ua="status" data-id="' + u.id + '" data-st="' + (u.status ? 0 : 1) + '">' + (u.status ? '冻结' : '解冻') + '</button>'
 + '<button type="button" class="row-btn danger" data-ua="del" data-id="' + u.id + '" data-n="' + (u.childrenCount || 0) + '" data-nsub="' + (u.subtreeCount || 0) + '">删除</button>' : '';
 var foldHtml = '<button type="button" class="u-fold' + (hasKids ? '' : ' is-leaf') + (collapsed ? ' collapsed' : '') + '" data-fold="' + u.id + '" aria-label="展开或收起下级"><svg class="toggle-arrow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg></button>'; /* v595：三角移到行尾（老板：标签最右侧） */
 return '<div class="u-row" data-uid="' + u.id + '" data-pid="' + Number(u.parentId || 0) + '" data-depth="' + it.depth + '">'
 + '<span class="u-name" style="margin-left:' + (it.depth * 18) + 'px"><b>' + esc(u.username) + '</b>' + (isMe ? ' <span style="color:var(--blue1);font-size: 12px">（我）</span>' : '')
 + '<span class="u-tags-box is-clipped" data-tagbox="' + u.id + '">'
 + '<span class="u-tags">'
 + '<span class="u-tag u-tag-role">' + (u.role === 'super' ? '超级管理员' : (Number(u.parentId || 0) ? '子账号' : '管理员')) + '</span>'
 + '<span class="u-tag">' + (u.status ? '启用' : '已停用') + '</span>'
 + '<span class="u-tag">' + (hasKids ? '下级 ' + (u.subtreeCount || 0) + ' 个' : '无下级') + '</span>'
 + '<span class="u-tag">最近活跃 ' + esc(String(u.lastSeen || '—').slice(0, 16)) + '</span>'
 + (u.note ? '<span class="u-tag u-tag-note">' + esc(u.note) + '</span>' : '')
 + '</span>'
 + '<button type="button" class="u-tagfold" data-tagfold="' + u.id + '" aria-label="展开或收起标签" aria-expanded="false"><svg class="toggle-arrow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg></button>'
 + '</span></span>'
 + '<span class="u-ops">' + ops + '</span>' + foldHtml + '</div>';
 }).join('');
 body.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
 + '<button type="button" class="btn-blue btn-inline-pd" id="usAdd">新增账号</button>'
 + '<span class="pm-hint" style="margin:0">可展开三角查看下级；子账号只能挂在自己名下，权限只能在你拥有的范围内再缩小</span></div>'
 + '<div class="u-tree">' + rows + '</div>'
 + (__usTotal > __usSize ? '<div class="uni-pager" id="usPager"></div>' : '');
 /* v540：账号多了一页 20 条 */
 (function () {
 var pg = document.getElementById('usPager');
 if (pg && window.buildUniPager) {
 window.buildUniPager(pg, {
 page: __usPage, totalPages: __usPages, total: __usTotal, unit: '个',
 onPage: function (p8) { window.__usPage = p8; renderUsersList(); }
 });
 }
 })();

 /* v595（老板 11-10 第 6 条「无法点三角收起下级」）：
 旧实现里 hidden 表是空的、也从来没读 __usCollapsed —— 等于永远没有东西被收起，三角点了白点。
 现在沿祖先链判断：只要任一祖先是收起的，本行就隐藏。 */
 function applyFold() {
 var byId = {};
 body.querySelectorAll('.u-row').forEach(function (r) { byId[r.getAttribute('data-uid')] = r; });
 body.querySelectorAll('.u-row').forEach(function (r) {
 var pid = Number(r.getAttribute('data-pid') || 0);
 var hide = false, guard = 0;
 while (pid && guard++ < 30) {
 if (window.__usCollapsed[pid] !== false) { hide = true; break; }
 var pr = byId[pid]; if (!pr) break;
 pid = Number(pr.getAttribute('data-pid') || 0);
 }
 /* v597（老板 11-10 第 5 条）：原来是 display:none 硬切，一点动效都没有。
 现在先挂 .is-folding 做淡出+收高，180ms 后再真正 display:none；展开反向。 */
 if (hide) {
 if (r.style.display !== 'none' && !r.classList.contains('is-folding')) {
 r.classList.add('is-folding');
 setTimeout(function () {
 if (r.classList.contains('is-folding') && r.getAttribute('data-hide') === '1') r.style.display = 'none';
 }, 180);
 }
 r.setAttribute('data-hide', '1');
 } else {
 r.setAttribute('data-hide', '0');
 if (r.style.display === 'none') {
 r.style.display = '';
 void r.offsetHeight;
 setTimeout(function () { r.classList.remove('is-folding'); }, 20);
 } else {
 r.classList.remove('is-folding');
 }
 }
 });
 }
 body.querySelectorAll('[data-fold]').forEach(function (b) {
 b.addEventListener('click', function () {
 var id = Number(this.getAttribute('data-fold'));
 var wasCollapsed = window.__usCollapsed[id] !== false;
 window.__usCollapsed[id] = !wasCollapsed;
 this.classList.toggle('collapsed', !wasCollapsed);
 this.setAttribute('aria-expanded', wasCollapsed ? 'true' : 'false');
 /* v608（老板 11-12 第 6 条）：这里原来只改 window.__usCollapsed 和类名，**没有重算行显示**——
 所以点下去什么都不会发生。补一次 applyFold()（它负责按祖先链隐藏/显示子行 + 淡出动画）。 */
 applyFold();
 });
 });
 applyFold();
 /* v596（老板 11-10 第 6 条）：标签只有一行时不需要三角——量真实高度，装得下就收起三角 */
 body.querySelectorAll('.u-tags-box').forEach(function (bx) {
 var tg = bx.querySelector('.u-tags');
 if (tg && tg.scrollHeight <= 24) {
 bx.classList.remove('is-clipped');
 var f0 = bx.querySelector('.u-tagfold');
 if (f0) f0.classList.add('is-leaf');
 }
 });

 /* v596（老板 11-10 第 6 条）：标签折叠——第一行最右侧的三角，默认收起，点开看全部标签。
 复用系统 .toggle-arrow（同一个动画出口），只是外壳是 .u-tagfold。 */
 body.querySelectorAll('[data-tagfold]').forEach(function (b) {
 b.addEventListener('click', function (ev) {
 ev.stopPropagation();
 var box = this.parentNode;
 var clipped = box.classList.toggle('is-clipped');
 this.classList.toggle('open', !clipped);
 this.setAttribute('aria-expanded', clipped ? 'false' : 'true');
 });
 });

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
 body.innerHTML = '<div class="imp-err">网络没连上，稍后再试</div>';
 });
 }

 /* v454：权限分组（老板要求写全、排整齐）
 v598（老板 11-10 第 11 条）：文案一律用系统里已有的叫法——分组名对齐顶部菜单
 （资源管理 / 分类管理 / 数据统计 / 平台设置），条目一律"动词+名词"，
 不再自造「看资源 / 挪分类 / 信息中心」这种词。 */
 var PM_GROUPS = [
 { t: '资源管理', k: 'products', items: [['view', '查看资源'], ['add', '新增资源'], ['edit', '编辑资源'], ['price', '修改价格'], ['online', '上架下架'], ['del', '删除资源'], ['restore', '恢复回收站'], ['purge', '彻底删除'], ['moveCat', '移动分类'], ['code', '资源码与发码'], ['bind', '绑定设备'], ['copy', '复制资源']] },
 { t: '分类管理', k: 'cats', items: [['view', '查看分类'], ['add', '新增分类'], ['edit', '编辑分类'], ['del', '删除分类'], ['sort', '拖动排序']] },
 { t: '公告', k: 'ann', items: [['view', '查看公告'], ['add', '发布公告'], ['edit', '编辑公告'], ['del', '删除公告'], ['preview', '预览公告'], ['hide', '显示与隐藏']] },
 { t: '批量操作', k: 'batch', items: [['import', '批量导入'], ['price', '批量改价'], ['online', '批量上下架'], ['del', '批量删除']] },
 { t: '数据统计', k: 'data', items: [['stats', '查看总量'], ['detail', '查看明细'], ['ip', '查看访客IP'], ['export', '导出数据']] },
 { t: '资源采集', k: 'external', items: [['view', '打开采集'], ['add', '添加平台'], ['edit', '编辑资源与平台'], ['del', '删除资源与平台'], ['fetch', '采集与上架'], ['probe', '试采地址'], ['platform', '平台设置'], ['auto', '自动采集开关'], ['autohide', '自动隐藏下架'], ['export', '导出采集']] },
 { t: '账号管理', k: 'account', items: [['view', '查看账号'], ['add', '新增账号'], ['edit', '编辑账号与权限'], ['pwd', '重置密码'], ['status', '停用与启用'], ['sub', '管理下级'], ['del', '删除账号']] },
 { t: '系统维护', k: 'system', items: [['logs', '操作日志'], ['check', '系统体检'], ['vitals', '性能实测'], ['err', '前端报错'], ['cache', '清理缓存'], ['file', '清理无用文件']] },
 { t: '备份与恢复', k: 'danger', items: [['backup', '导出备份'], ['restore', '导入恢复'], ['recycle', '回收站'], ['clear', '清空测试数据']] },
 { t: '平台设置', k: 'settings', items: [['view', '查看设置'], ['edit', '店铺信息'], ['contact', '客服与二维码'], ['ann', '公告设置'], ['style', '页面风格'], ['logo', '店铺名与Logo'], ['mode', '公告显示方式'], ['bindlimit', '设备绑定上限']] }
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

 /* 其它：信息 + 管理下级账号（v600：文案跟顶栏按钮一致，叫「信息」） */
 secHtml += '<div class="pm-sec"><div class="pm-sec-hd"><b>其它</b></div><div class="pm-grid">'
 + '<label class="pm-chk"><input type="checkbox" data-pa="info" data-pk="view"' + (isEdit ? (gval('info', 'view') ? ' checked' : '') : ' checked') + '><span>信息</span></label>'
 + '<label class="pm-chk"><input type="checkbox" data-pa="users" data-pk="_"' + (isEdit && perms.users ? ' checked' : '') + '><span>管理下级账号</span></label>'
 + '</div></div>';

 /* v517（老板：一二级分类要有层次感）：原来是一排扁平的胶囊，只靠「└」区分父子。
 现在改成一棵树：一级一行（粗体），它的子分类缩进挂在下面，带竖线。 */
 var catHtml = (function () {
 if (!cats.length) return '<span class="pm-hint">还没有分类</span>';
 var isOn = function (c) { return Array.isArray(catsScope) ? catsScope.indexOf(Number(c.id)) !== -1 : false; };
 var tops = cats.filter(function (c) { return !Number(c.parent_id || 0); });
 var kidsOf = function (id) { return cats.filter(function (c) { return Number(c.parent_id || 0) === Number(id); }); };
 if (!tops.length) tops = cats.slice(); /* 全是子分类的极端情况兜底 */
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

 /* v537（老板）：去掉「快速套用」三键——按需自己勾就行，不要这排小抄 */
 var tplHtml = '';

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
 + '</div><div class="pm-chips" id="ufAnnChips"><span class="pm-hint">正在读取公告</span></div></div>';

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
 mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="子账号编辑" style="max-width:var(--modal-w-lg)">' /* v537（老板：分类框只占弹窗三分之一、太小气）——账号弹窗 520→680 */
 + '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>'
 + '<h2 class="modal-title" style="margin-bottom:10px">' + (isEdit ? '编辑账号：' + esc(u.username) : '新增账号') + '</h2>'
 + '<div class="form usf-body" id="usFormBody">' /* v537：账号表单里权限有二十多项 + 分类树，520px 太挤，容器上挂 modal-wide */
 + (isEdit ? '' : '<label class="pm-hint pm-hint-block">2 到 20 位字母数字</label><input class="input" id="ufUser" style="width:100%;margin-bottom:8px" maxlength="20">')
 + (isEdit ? '' : '<label class="pm-hint pm-hint-block">6 到 50 位</label><input class="input" id="ufPwd" type="password" style="width:100%;margin-bottom:8px" maxlength="50">')
 + '<label class="pm-hint pm-hint-block">备注用途</label><input class="input w-full-mb10" id="ufNote" maxlength="100" value="' + esc(isEdit ? (u.note || '') : '') + '">'
 + (me.role === 'super' ? '<label class="pm-hint pm-hint-block">上级账号</label><select class="input w-full-mb10" id="ufParent" >' + parentOpts + '</select>' : '')
 + tplHtml + secHtml + scopeHtml + annHtml + codeHtml
 + '</div>'
 + '<div class="modal-footer"><button type="button" class="modal-inner-btn" id="ufSave">' + (isEdit ? '确定' : '创建账号') + '</button><button type="button" class="modal-close" data-x="1">关闭</button></div></div>';

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
 /* v608（老板 11-12 第 7 条）：系统默认公告优先级最高，永远排最前；
 其余按原有顺序不动（稳定排序），别因为一个排序把人工排好的顺序打乱。 */
 arr = arr.map(function (a2, i2) { return { a: a2, i: i2 }; }).sort(function (x, y) {
 var dx = (Number(x.a.id) === 0 || x.a.isDefault || String(x.a.title || '').trim() === '公告') ? 0 : 1;
 var dy = (Number(y.a.id) === 0 || y.a.isDefault || String(y.a.title || '').trim() === '公告') ? 0 : 1;
 return dx - dy || x.i - y.i;
 }).map(function (o) { return o.a; });
 var box = mask.querySelector('#ufAnnChips'); if (!box) return;
 if (!arr.length) { box.innerHTML = '<span class="pm-hint">暂无公告</span>'; return; }
 box.innerHTML = arr.map(function (a, i) {
 var id = String(a.id || ('a' + i));
 var on = annScope !== 'all' && Array.isArray(annScope) && annScope.indexOf(id) !== -1;
 return '<label class="pm-chip"><input type="checkbox" data-ann="' + esc(id) + '"' + (on ? ' checked' : '') + '><span>' + esc(String(a.title || '未命名公告').slice(0, 14)) + '</span></label>';
 }).join('');
 }).catch(function () {
 var box = mask.querySelector('#ufAnnChips'); if (box) box.innerHTML = '<span class="pm-hint">公告读取失败</span>';
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
 btn.disabled = true; btn.textContent = '保存中'; /* v554：回退，恢复换字 */
 var restore = function () { btn.disabled = false; btn.textContent = isEdit ? '确定' : '创建账号'; };
 if (isEdit) {
 usersCall('PUT', { id: u.id, op: 'update', perms: pv, note: note }, function () {
 if (window.showToast) window.showToast(window.T('saved'), 'success');
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
 .catch(function () { if (window.showToast) window.showToast(window.T('netFail'), 'error'); });
 }
 function openRecycle() {
 var old = document.getElementById('recycleMask'); if (old) old.remove();
 var mask = document.createElement('div');
 mask.className = 'modal-mask'; mask.id = 'recycleMask';
 mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="回收站点">' +
 (window.__frag ? window.__frag.modalHead('回收站点') : '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button><h2 class="modal-title">回收站点</h2>') +
 '<div class="rc-tools"><label class="rc-all"><input type="checkbox" id="rcAll" aria-label="全选"> 全选</label><input class="input" id="rcQ" type="search" autocomplete="off" placeholder="搜索资源、分类或公告的名称"></div>' +
 /* v538（老板：回收站要能批量恢复、批量删除）——复用全站批量条组件，不新造样式 */
 '<div class="batch-bar" id="rcBar"><span class="batch-count-label">已选 <b id="rcCount">0</b> 项</span>' +
 '<div class="batch-group"><button type="button" class="batch-btn" id="rcRestoreAll">恢复选中</button>' +
 '<button type="button" class="batch-btn danger" id="rcPurgeAll">彻底删除</button>' +
 '<button type="button" class="batch-btn" id="rcClearSel">取消选中</button></div></div>' +
 '<div class="form" id="rcBody">' +
 '<p class="imp-lead">保留 60 天，到期清除</p>' +
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
 /* v540：回收站改成「数据驱动」——搜索和翻页都作用在同一份数据上，
 不再靠隐藏行（隐藏行会让"共几条"和翻页对不上） */
 var RC = { items: [], q: '', onlyExpiring: false, page: 1, render: null, ready: false };
 var _rcQ = mask.querySelector('#rcQ');
 if (_rcQ) _rcQ.addEventListener('input', function () {
 RC.q = String(this.value || '').trim();
 RC.page = 1;
 if (RC.render) RC.render();
 });
 fetch('/api/admin/recycle', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (x) {
 var body = mask.querySelector('#rcBody'); if (!body) return;
 if (!x || !x.ok) { body.innerHTML = '<div class="imp-err">服务器忙，稍后再试</div>'; return; }
 /* ===== v540 回收站：一页 20 条 + 7 天内到期提醒 ===== */
 var _kindName = { product: '资源', category: '分类', ann: '公告' };
 /* 还剩几天彻底删除（保留 60 天，deleted_at 存的是 UTC） */
 var _daysLeft = function (t) {
 var d = new Date(String(t || '').replace('T', ' ').replace('Z', '').replace(' ', 'T') + 'Z');
 if (isNaN(d.getTime())) return 99;
 return Math.max(0, Math.ceil(60 - (Date.now() - d.getTime()) / 86400000));
 };
 RC.items = [];
 (x.products || []).forEach(function (p) { RC.items.push({ kind: 'product', id: p.id, name: p.title || ('资源#' + p.id), t: p.deleted_at }); });
 (x.categories || []).forEach(function (c) { RC.items.push({ kind: 'category', id: c.id, name: c.name || ('分类#' + c.id), t: c.deleted_at }); });
 (x.announcements || []).forEach(function (a) { RC.items.push({ kind: 'ann', id: a.id, name: a.title || '公告', t: a.deleted_at }); });
 RC.ready = true;

 var _rowHtml = function (it) {
 var left = _daysLeft(it.t);
 return '<div class="rc-row">' +
 '<input type="checkbox" class="rc-ck" data-kind="' + it.kind + '" data-id="' + esc(String(it.id)) + '" aria-label="选中" style="width:16px;height:16px;flex:0 0 16px;margin:0;accent-color:var(--blue1);cursor:pointer">' +
 '<span class="rc-name">' + esc(it.name) + '<span class="rc-meta">' + fmtDelTime(it.t) + ' 删除' +
 (left <= 7 ? '<i class="rc-warn">还剩 ' + left + ' 天</i>' : '') + '</span></span>' +
 '<button type="button" class="row-btn" data-rc="restore" data-kind="' + it.kind + '" data-id="' + esc(String(it.id)) + '">恢复</button>' +
 '<button type="button" class="row-btn danger" data-rc="purge" data-kind="' + it.kind + '" data-id="' + esc(String(it.id)) + '">删除</button></div>';
 };

 RC.render = function () {
 var bodyEl = mask.querySelector('#rcBody'); if (!bodyEl) return;
 var lead = '<p class="imp-lead">保留 60 天，到期清除</p>';
 if (!RC.items.length) {
 bodyEl.innerHTML = lead + (window.__adminEmpty ? window.__adminEmpty('该回收站点暂无内容', '删掉的资源、分类、公告会在这里保留 60 天，随时可以恢复') : '该回收站点暂无内容');
 return;
 }
 var q = RC.q.toLowerCase();
 var soonN = RC.items.filter(function (it) { return _daysLeft(it.t) <= 7; }).length;
 var list = RC.items.filter(function (it) {
 if (RC.onlyExpiring && _daysLeft(it.t) > 7) return false;
 return !q || String(it.name).toLowerCase().indexOf(q) >= 0;
 });
 var notice = soonN
 ? '<div class="rc-soon"><span>有 <b>' + soonN + '</b> 项将在 7 天内彻底删除，到期就找不回来了</span>' +
 '<button type="button" class="row-btn" id="rcSoonBtn">' + (RC.onlyExpiring ? '看全部' : '只看这些') + '</button></div>'
 : '';
 if (!list.length) {
 bodyEl.innerHTML = lead + notice + '<div class="extc-loading">' + (q ? '该搜索暂无内容，换个词试试' : '该条件暂无内容') + '</div>';
 var _sb0 = bodyEl.querySelector('#rcSoonBtn');
 if (_sb0) _sb0.addEventListener('click', function () { RC.onlyExpiring = !RC.onlyExpiring; RC.page = 1; RC.render(); });
 return;
 }
 var st = window.__slicePage(list, RC.page, window.LIST_PAGE_SIZE || 20);
 RC.page = st.page;
 var secHtml = '';
 ['product', 'category', 'ann'].forEach(function (k) {
 var rows = st.items.filter(function (it) { return it.kind === k; });
 if (!rows.length) return;
 var totalK = list.filter(function (it) { return it.kind === k; }).length;
 secHtml += '<div class="rc-sec"><b class="rc-sec-h">' + _kindName[k] + ' ' + totalK + '</b>' + rows.map(_rowHtml).join('') + '</div>';
 });
 bodyEl.innerHTML = lead + notice + secHtml + window.pagerBox('rcPager');
 var _sb = bodyEl.querySelector('#rcSoonBtn');
 if (_sb) _sb.addEventListener('click', function () { RC.onlyExpiring = !RC.onlyExpiring; RC.page = 1; RC.render(); });
 var pgEl = bodyEl.querySelector('#rcPager');
 if (pgEl && window.buildUniPager) {
 window.buildUniPager(pgEl, {
 page: st.page, totalPages: st.totalPages, total: st.total, unit: '项',
 onPage: function (p5) { RC.page = p5; RC.render(); }
 });
 }
 /* 首次渲染时 _syncSel 还没赋值（它定义在后面），只做有则调用 */
 if (typeof _syncSel === 'function') _syncSel();
 };
 RC.render();

 /* v538：批量勾选 —— 计数、批量条显隐、全选联动（v540：列表重绘后由 RC.render 末尾再调一次） */
 var _bar = mask.querySelector('#rcBar');
 var _cnt = mask.querySelector('#rcCount');
 var _allBox = mask.querySelector('#rcAll');
 var _syncSel = function () {
 var cks = body.querySelectorAll('.rc-ck');
 var on = 0;
 cks.forEach(function (c) { if (c.checked) on++; });
 if (_cnt) _cnt.textContent = on;
 if (_bar) { _bar.classList.toggle('show', on > 0); _bar.style.maxHeight = on > 0 ? '80px' : '0px'; }
 if (_allBox) _allBox.checked = on > 0 && on === cks.length;
 };
 body.addEventListener('change', function (e) {
 if (e.target && e.target.classList && e.target.classList.contains('rc-ck')) _syncSel();
 });
 if (_allBox) _allBox.addEventListener('change', function () {
 var on = this.checked;
 body.querySelectorAll('.rc-ck').forEach(function (c) { c.checked = on; });
 _syncSel();
 });
 _syncSel();
 var _clearSel = function () { body.querySelectorAll('.rc-ck').forEach(function (c) { c.checked = false; }); _syncSel(); };
 var _cs = mask.querySelector('#rcClearSel'); if (_cs) _cs.addEventListener('click', _clearSel);
 var _picked = function () { return Array.prototype.slice.call(body.querySelectorAll('.rc-ck')).filter(function (c) { return c.checked; }); };
 /* 批量跑：一条条来，失败也继续，最后给一句总数 */
 var _runBatch = function (op, label) {
 var list = _picked();
 if (!list.length) return;
 if (op === 'purge' && window.showConfirm) {
 window.showConfirm('彻底删除', '选中的 ' + list.length + ' 项会被永久清掉，恢复不了，确定继续？', function (closeConfirm) {
 closeConfirm(); _doBatch(op, list, label);
 });
 } else _doBatch(op, list, label);
 };
 var _doBatch = function (op, list, label) {
 var okN = 0, failN = 0;
 var step = function (i) {
 if (i >= list.length) {
 if (window.showToast) window.showToast(label + '：成功 ' + okN + ' 项' + (failN ? '，失败 ' + failN + ' 项' : ''), failN ? 'error' : 'success');
 openRecycle();
 return;
 }
 var c = list[i];
 fetch('/api/admin/recycle', {
 method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
 body: JSON.stringify({ op: op, kind: c.getAttribute('data-kind'), id: c.getAttribute('data-id') })
 }).then(function (r) { return r.json(); }).then(function (x) {
 if (x && x.ok) okN++; else failN++;
 }).catch(function () { failN++; }).then(function () { step(i + 1); });
 };
 step(0);
 };
 _syncSel();
 var _ra = mask.querySelector('#rcRestoreAll'); if (_ra) _ra.addEventListener('click', function () { _runBatch('restore', '恢复'); });
 var _pa = mask.querySelector('#rcPurgeAll'); if (_pa) _pa.addEventListener('click', function () { _runBatch('purge', '彻底删除'); });

 body.addEventListener('click', function (e) {
 var b = e.target.closest && e.target.closest('[data-rc]'); if (!b) return;
 var op = b.getAttribute('data-rc'), kind = b.getAttribute('data-kind'), id = b.getAttribute('data-id');
 if (op === 'purge' && window.showConfirm) {
 window.showConfirm('删除', '删除后无法恢复，确定继续吗', function (closeConfirm) { closeConfirm(); recycleCall(op, kind, id, function () { openRecycle(); }); });
 } else recycleCall(op, kind, id, function () { openRecycle(); });
 });
 }).catch(function () { var body = mask.querySelector('#rcBody'); if (body) body.innerHTML = '<div class="imp-err">服务器忙，稍后再试</div>'; });
 }

 /* ================= v534 自动采集 =================
 老板 r14：「定时不用做这些设置啊，就想我们系统自带清除一些数据那个机制一样啊」
 所以界面上不再出现 CRON_KEY / GitHub / 定时器这些词——机制与 track.js 的 60 天清理完全相同：
 每天第一次有人访问，后台顺手把活干完。这个弹窗只负责解释 + 给你看今天的进度 + 手动催一次。 */
 function openCronHelp() {
 var old = document.getElementById('cronHelpMask'); if (old) old.remove();
 var mask = document.createElement('div');
 mask.className = 'modal-mask'; mask.id = 'cronHelpMask';
 mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="自动采集">' +
 '<button type="button" class="modal-close-x" aria-label="关闭" data-x="1"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
 '<div class="modal-title">自动采集</div>' +
 '<p class="imp-lead">你录的平台<b>每天自动全采一遍</b>，不用手动点，也不用配任何东西——和系统自带的「清理 60 天前数据」是同一个机制。</p>' +
 '<div class="cron-step"><b>1</b><span>每天第一次有人打开站点（前台或后台都算），系统就在后台把所有勾了「每天自动」的平台采一遍，页面不会变慢。</span></div>' +
 '<div class="cron-step"><b>2</b><span>一次最多跑 15 秒左右；平台多的，这次没采完的下次访问自动接着采，不会漏。</span></div>' +
 '<div class="cron-step"><b>3</b><span>同一个平台一天只自动采一次，重复的按标题自动跳过，不会把库塞满。</span></div>' +
 '<div class="cron-step"><b>4</b><span>只抓列表信息（标题 / 封面 / 描述 / 下单链接）；详情长图仍然在你点「查看 / 上架」时按需补。</span></div>' +
 '<div class="cron-status" id="cronStatus">正在读取今天的采集状态</div>' +
 '<div class="modal-footer"><button type="button" class="btn-blue btn-inline-pd" id="cronRunNow">现在采一次</button>' +
 '<button type="button" class="modal-close" data-x="1">关闭</button></div>' +
 '</div>';
 document.body.appendChild(mask);
 requestAnimationFrame(function () { mask.classList.add('open'); });
 if (window.syncBodyLock) window.syncBodyLock();
 var close = function () { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180); };
 mask.addEventListener('click', function (e) { if (e.target === mask || (e.target.closest && e.target.closest('[data-x]'))) close(); });

 var host = mask.querySelector('#cronStatus');
 var paint = function (st) {
 if (!host) return;
 if (!st) { host.innerHTML = '<span class="cs-bad">状态读取失败，关掉重开试试</span>'; return; }
 var line = [];
 line.push('<div class="cs-row"><span>会自动采的平台</span><b>' + (st.total || st.autoOn || 0) + ' 个</b></div>');
 line.push('<div class="cs-row"><span>今天</span><b class="' + (st.todayDone ? 'cs-ok' : '') + '">' +
 (st.todayDone ? '已自动采完' : '还没采（下次有人访问就会跑）') + '</b></div>');
 if (st.progress && st.progress.total) {
 line.push('<div class="cs-row"><span>今天进度</span><b>' + (st.progress.idx || 0) + ' / ' + st.progress.total + '</b></div>');
 }
 if (st.last && st.last.at) {
 var extra = '新增 ' + (st.last.added || 0) + ' 个资源';
 if (st.last.fails && st.last.fails.length) extra += '，' + st.last.fails.length + ' 个没抓到（' + st.last.fails.join('、') + '）';
 line.push('<div class="cs-row"><span>上次自动</span><b>' + st.last.at + '，' + extra + '</b></div>');
 } else if (st.lastAutoAt) {
 /* v534：库里是 UTC，这里换算成北京时间再显示 */
 var dT = new Date(String(st.lastAutoAt).replace(' ', 'T') + 'Z');
 var txt = isNaN(dT.getTime()) ? String(st.lastAutoAt).slice(5, 16)
 : new Date(dT.getTime() + 8 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ');
 line.push('<div class="cs-row"><span>上次自动</span><b>' + txt + '</b></div>');
 }
 host.innerHTML = line.join('');
 };

 var load = function () {
 fetch('/api/cron/collect?op=status', { credentials: 'same-origin' })
 .then(function (r) { return r.json(); })
 .then(function (r) { paint(r && r.ok ? r.status : null); })
 .catch(function () { paint(null); });
 };
 load();

 var btn = mask.querySelector('#cronRunNow');
 btn.addEventListener('click', function () {
 btn.disabled = true; btn.textContent = '正在采';
 if (host) host.innerHTML = '<span class="cs-bad">正在采，平台多的要十几秒</span>';
 fetch('/api/cron/collect', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
 .then(function (r) { return r.json(); })
 .then(function (r) {
 btn.disabled = false; btn.textContent = '再采一次';
 if (window.showToast) window.showToast(r && r.ok ? ('采完了，新增 ' + ((r && r.added) || 0) + ' 个资源') : ((r && r.msg) || '采集失败'), r && r.ok ? 'success' : 'error');
 load();
 })
 .catch(function () { btn.disabled = false; btn.textContent = '现在采一次'; if (window.showToast) window.showToast('网络没连上，没采成', 'error'); load(); });
 });
 }

 /* ================= v530 操作日志（复用已有 audit_log 表，不新建数据） =================
 老板要「谁在什么时候改了设置/删了资源，保留 60 天，多人共用时必需」。
 数据本来就在写（_utils.js 的 audit()，20 多个业务动作），这次只做两件事：
 ① 把操作者从写死的 admin 改成真实账号 ② 加这个查询界面。 */
 /* ================= v571 前端报错（访客真实遇到的错，自动收上来） =================
 为什么有这块：以前只有「我跑测试时」能看见报错。访客用什么浏览器、点了哪里、报了什么，
 全靠老板转述。现在前端出错会自动 POST /api/error 存库，这里按时间范围 / 出错页面看。
 风格完全复用操作日志那套（时间范围 + 搜索 + 列表 + 分页），不新造一套。 */
 /* ==================== v585：性能实测（真实访客 RUM） ====================
 数据来自访客浏览器自己上报的 Core Web Vitals，按 p75 看。
 为什么不用平均值：平均值会被"网速快的那批人"拉低，看不出真实体感；
 p75 的意思是"75% 的访客比这个数更好"，这才是 Google 判定的口径。 */
 function openVitals() {
 var old = document.getElementById('vitalsMask'); if (old) old.remove();
 var mask = document.createElement('div');
 mask.className = 'modal-mask'; mask.id = 'vitalsMask';
 mask.innerHTML = '<div class="modal-box modal-wide" role="dialog" aria-modal="true" aria-label="性能实测">' +
 '<button type="button" class="modal-close-x" aria-label="关闭" data-x="1"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
 '<div class="modal-title">性能实测（真实访客）</div>' +
 '<p class="imp-lead">访客浏览器上报 <b>p75</b> 看——意思是「75% 的访客比这个数更好」，比平均值更接近真实体感。' +
 '判定线：LCP ≤2500ms 良好、CLS ≤0.1 良好、INP ≤200ms 良好。新接口，要有人访问过才会有数据。</p>' +
 '<div class="logs-range" id="vitalsRange">' +
 '<span class="logs-range-t">时间范围</span>' +
 '<button type="button" class="logs-rbtn on" data-days="1">1天</button>' +
 '<button type="button" class="logs-rbtn" data-days="7">7天</button>' +
 '<button type="button" class="logs-rbtn" data-days="30">30天</button>' +
 '</div>' +
 '<div class="logs-body" id="vitalsBody"><div class="extc-loading">正在读取</div></div>' + /* v608：性能实测底部不要关闭键 */
 '</div>';
 document.body.appendChild(mask);
 requestAnimationFrame(function () { mask.classList.add('open'); });
 if (window.syncBodyLock) window.syncBodyLock();

 var close = function () {
 mask.classList.remove('open');
 setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180);
 };
 mask.addEventListener('click', function (e) {
 if (e.target === mask || (e.target.closest && e.target.closest('[data-x]'))) close();
 });
 document.addEventListener('keydown', function esc(e) {
 if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
 });

 var body = mask.querySelector('#vitalsBody');
 var _color = function (k) {
 return k === 'good' ? 'var(--ok-ink,#2e7d32)' : k === 'mid' ? 'var(--warn-ink,#b26a00)' : k === 'bad' ? 'var(--bad-ink,#c62828)' : 'var(--text-light,#666)';
 };
 var _word = function (k) { return k === 'good' ? '良好' : k === 'mid' ? '待改进' : k === 'bad' ? '较差' : ''; };
 function card(label, val, unit, k, rate) {
 var v = (val == null || val === 0) ? '—' : val;
 return '<div style="flex:1 1 132px;background:var(--bg-light,#f5f7fa);border-radius:10px;padding:10px 12px;min-width:0">' +
 '<div style="font-size:12px;color:var(--text-light,#666);margin-bottom:2px">' + label + '</div>' +
 '<div style="font-size:24px;font-weight:700;line-height:1.2">' + v + '<span style="font-size:12px;font-weight:400">' + (v === '—' ? '' : unit) + '</span></div>' +
 '<div style="font-size:12px;margin-top:2px"><span style="color:' + _color(k) + '">' + (_word(k) || '无数据') + '</span>' +
 (rate == null ? '' : '<span style="color:var(--text-light,#666)">，达标 ' + rate + '%</span>') + '</div>' +
 '</div>';
 }

 function paint(d) {
 if (!d || !d.total) {
 body.innerHTML = '<div class="logs-d-empty">这段时间还没有访客数据。' +
 '接口已就位（/api/vitals），访客离开页面时自动上报；过一两天再看就有数了。</div>';
 return;
 }
 var o = d.overall || {}, g = d.grade || {}, good = d.good || {};
 var html = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 14px">' +
 card('LCP 最大内容绘制', o.lcp, ' ms', g.lcp, good.lcp) +
 card('CLS 布局偏移', o.cls, '', g.cls, good.cls) +
 card('INP 交互延迟', o.inp, ' ms', g.inp, good.inp) +
 card('TTFB 首字节', o.ttfb, ' ms', g.ttfb, good.ttfb) +
 '</div>';

 html += '<div class="vt-sec">样本 ' + d.total + ' 次；手机端 vs 桌面端</div>'; /* v596：与表格单元格同一左边线，去掉贴边 */
 var sp = d.split || {};
 var rows = [['手机（<768px）', sp.mobile], ['桌面', sp.desktop]];
 html += '<table class="vitals-table" style="margin-bottom:16px">' +
 '<tr style="color:var(--text-light,#666);font-size:12px"><th style="text-align:left;font-weight:400">设备</th>' +
 '<th style="text-align:right;font-weight:400">样本</th><th style="text-align:right;font-weight:400">LCP</th>' +
 '<th style="text-align:right;font-weight:400">CLS</th><th style="text-align:right;font-weight:400">INP</th></tr>';
 rows.forEach(function (r) {
 var m = r[1] || {};
 html += '<tr style="border-top:1px solid var(--border-soft,#eef2f7)"><td>' + r[0] + '</td>' +
 '<td style="text-align:right">' + (m.n || 0) + '</td>' +
 '<td style="text-align:right">' + (m.lcp == null ? '—' : m.lcp) + '</td>' +
 '<td style="text-align:right">' + (m.cls == null ? '—' : m.cls) + '</td>' +
 '<td style="text-align:right">' + (m.inp == null ? '—' : m.inp) + '</td></tr>';
 });
 html += '</table>';

 if ((d.pages || []).length) {
 html += '<div class="vt-sec">按页面（样本多的排前面）</div>'; /* v596：同上 */
 html += '<table class="vitals-table">' +
 '<tr style="color:var(--text-light,#666);font-size:12px"><th style="text-align:left;font-weight:400">页面</th>' +
 '<th style="text-align:right;font-weight:400">样本</th><th style="text-align:right;font-weight:400">LCP</th>' +
 '<th style="text-align:right;font-weight:400">CLS</th><th style="text-align:right;font-weight:400">TTFB</th></tr>';
 d.pages.forEach(function (p) {
 html += '<tr style="border-top:1px solid var(--border-soft,#eef2f7)"><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.path +
 (p.test ? ' <span style="color:var(--text-light,#666);font-size:12px">测试</span>' : '') + '</td>' +
 '<td style="text-align:right">' + p.n + '</td>' +
 '<td style="text-align:right">' + (p.lcp == null ? '—' : p.lcp) + '</td>' +
 '<td style="text-align:right">' + (p.cls == null ? '—' : p.cls) + '</td>' +
 '<td style="text-align:right">' + (p.ttfb == null ? '—' : p.ttfb) + '</td></tr>';
 });
 html += '</table>';
 }
 body.innerHTML = html;
 }

 function load(days) {
 body.innerHTML = '<div class="extc-loading">正在读取</div>';
 fetch('/api/admin/vitals?days=' + days, { credentials: 'same-origin' })
 .then(function (r) { return r.json(); })
 .then(function (d) { paint(d); })
 .catch(function () { body.innerHTML = '<div class="logs-d-empty">读取失败，请稍后再试。</div>'; });
 }

 mask.querySelector('#vitalsRange').addEventListener('click', function (e) {
 var b = e.target.closest && e.target.closest('.logs-rbtn');
 if (!b) return;
 mask.querySelectorAll('#vitalsRange .logs-rbtn').forEach(function (x) { x.classList.remove('on'); });
 b.classList.add('on');
 load(b.getAttribute('data-days'));
 });

 load(7);
 }

 function openErrs() {
 var old = document.getElementById('errMask'); if (old) old.remove();
 var mask = document.createElement('div');
 mask.className = 'modal-mask'; mask.id = 'errMask';
 mask.innerHTML = '<div class="modal-box modal-wide" role="dialog" aria-modal="true" aria-label="前端报错">' +
 (window.__frag ? window.__frag.modalHead('前端报错') : '<button type="button" class="modal-close-x" aria-label="关闭" data-x="1"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button><div class="modal-title">前端报错</div>') +
 '<p class="imp-lead"><b>这里为空代表线上一直没出错</b>；有记录说明真的有人在某个页面撞上了，按「次数」从多到少看。</p>' +
 '<div class="logs-range" id="errRange">' +
 '<span class="logs-range-t">时间范围</span>' +
 '<button type="button" class="logs-rbtn on" data-days="1">1天</button>' +
 '<button type="button" class="logs-rbtn" data-days="7">7天</button>' +
 '<button type="button" class="logs-rbtn" data-days="30">30天</button>' +
 '<button type="button" class="row-btn" id="errClear" style="margin-left:auto">清空记录</button>' +
 '</div>' +
 '<div class="logs-daily" id="errSum"><div class="logs-d-empty">正在读取</div></div>' +
 '<div class="logs-tools">' +
 '<input class="input" id="errQ" type="search" autocomplete="off" placeholder="搜索报错内容或页面，比如 TypeError">' +
 '<button type="button" class="btn-blue btn-inline" id="errGo">搜索</button>' +
 '</div>' +
 '<div class="logs-body" id="errBody"><div class="extc-loading">正在读取</div></div>' +
 '<div class="uni-pager" id="errPager"></div>' + /* v608：前端报错底部不要关闭键 */
 '</div>';
 document.body.appendChild(mask);
 requestAnimationFrame(function () { mask.classList.add('open'); });
 if (window.syncBodyLock) window.syncBodyLock();

 var close = function () {
 mask.classList.remove('open');
 setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180);
 };
 mask.addEventListener('click', function (e) { if (e.target === mask || (e.target.closest && e.target.closest('[data-x]'))) close(); });

 var days = 1, page = 1, q = '';
 function bjTime(v) {
 var d = new Date(String(v || '').replace(' ', 'T') + 'Z');
 if (isNaN(d.getTime())) return String(v || '');
 return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
 }
 var KIND_TXT = { js: '脚本错', promise: '异步错', resource: '加载失败', custom: '业务错' };

 function paintSum(d) {
 var box = mask.querySelector('#errSum');
 if (!box) return;
 var byPage = d.byPage || [];
 if (!d.total) {
 box.innerHTML = '<div class="logs-d-empty">这段时间没有前端报错，说明线上是干净的 ✓</div>';
 return;
 }
 var maxH = 1;
 byPage.forEach(function (x) { if ((x.hits || 0) > maxH) maxH = x.hits; });
 var ph = byPage.map(function (x) {
 var w = Math.max(4, Math.round((x.hits / maxH) * 100));
 return '<span class="log-who" title="' + esc(x.page || '') + '">' +
 '<span class="lw-n">' + esc(String(x.page || '/').slice(0, 26)) + '</span>' +
 '<span class="lw-bar"><i style="width:' + w + '%"></i></span>' +
 '<b>' + x.hits + '</b></span>';
 }).join('');
 box.innerHTML =
 '<div class="logs-d-head"><b>报错概览</b>' +
 '<span>共 ' + d.hits + ' 次，' + d.total + ' 种，' + d.devices + ' 台设备</span>' +
 '</div>' +
 (ph ? '<div class="logs-d-people">' + ph + '</div>' : '');
 }

 function paint(d) {
 var body = mask.querySelector('#errBody');
 var list = d.list || [];
 if (!list.length) {
 body.innerHTML = '<div class="logs-d-empty">没有记录</div>';
 mask.querySelector('#errPager').innerHTML = '';
 return;
 }
 body.innerHTML = list.map(function (x) {
 var stack = String(x.stack || '').trim();
 return '<div class="err-row">' +
 '<div class="err-top">' +
 '<span class="err-kind k-' + esc(x.kind || 'js') + '">' + esc(KIND_TXT[x.kind] || x.kind || '脚本错') + '</span>' +
 '<span class="err-msg">' + esc(x.msg || '') + '</span>' +
 (Number(x.cnt) > 1 ? '<span class="err-cnt">×' + x.cnt + '</span>' : '') +
 '</div>' +
 '<div class="err-meta">' +
 '<span>' + esc(bjTime(x.last_at)) + '</span>' +
 '<span class="err-page">' + esc(x.page || '/') + '</span>' +
 (x.ua ? '<span class="err-ua" title="' + esc(x.ua) + '">' + esc(String(x.ua).slice(0, 46)) + '</span>' : '') +
 '</div>' +
 (stack ? '<details class="err-stack"><summary>看调用栈</summary><pre>' + esc(stack) + '</pre></details>' : '') +
 '</div>';
 }).join('');
 /* 分页 */
 var total = Number(d.total) || 0, size = Number(d.size) || 20;
 var pages = Math.max(1, Math.ceil(total / size));
 /* v587 用户 11-07（「你说的翻页组件统一？」）：这里原来是手写的一对 row-btn，
 容器虽然叫 uni-pager，里面却是自己画的按钮 + uni-pager-info，跟全站 buildUniPager 的胶囊翻页根本不是一套。
 统一走公共组件，unit 用「种」保持原语义。 */
 var _errPager = mask.querySelector('#errPager');
 if (window.buildUniPager) {
 window.buildUniPager(_errPager, {
 page: page, totalPages: pages, total: total, unit: '种',
 onPage: function (p) { page = p; load(); }
 });
 } else { _errPager.innerHTML = ''; }
 }

 function load() {
 fetch('/api/admin/errors?days=' + days + '&page=' + page + '&q=' + encodeURIComponent(q), { credentials: 'include' })
 .then(function (r) { return r.json(); })
 .then(function (d) {
 if (!d || !d.ok) { mask.querySelector('#errBody').innerHTML = '<div class="logs-d-empty">读取失败（可能没权限）</div>'; return; }
 paintSum(d); paint(d);
 })
 .catch(function () { mask.querySelector('#errBody').innerHTML = '<div class="logs-d-empty">网络异常，读取失败</div>'; });
 }

 mask.querySelector('#errRange').addEventListener('click', function (e) {
 var b = e.target.closest('.logs-rbtn'); if (!b) return;
 mask.querySelectorAll('#errRange .logs-rbtn').forEach(function (x) { x.classList.toggle('on', x === b); });
 days = Number(b.getAttribute('data-days')) || 7; page = 1; load();
 });
 mask.querySelector('#errGo').addEventListener('click', function () {
 q = String(mask.querySelector('#errQ').value || '').trim(); page = 1; load();
 });
 mask.querySelector('#errQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); mask.querySelector('#errGo').click(); } });
 mask.querySelector('#errPager').addEventListener('click', function (e) {
 var b = e.target.closest('[data-pg]'); if (!b || b.disabled) return;
 page = Math.max(1, Number(b.getAttribute('data-pg')) || 1); load();
 });
 mask.querySelector('#errClear').addEventListener('click', function () {
 var btn = this;
 var go = function () {
 btn.disabled = true;
 fetch('/api/admin/errors', { method: 'DELETE', credentials: 'include' })
 .then(function (r) { return r.json(); })
 .then(function (d) {
 btn.disabled = false;
 toast(d && d.ok ? '已清空' : '清空失败', d && d.ok ? 'success' : 'error');
 page = 1; load();
 })
 .catch(function () { btn.disabled = false; toast('网络异常', 'error'); });
 };
 if (window.showConfirm) window.showConfirm('清空全部前端报错记录？清空后无法恢复。', go, null, '清空', '取消', true);
 else go();
 });
 load();
 }

 function openLogs() {
 var old = document.getElementById('logsMask'); if (old) old.remove();
 var mask = document.createElement('div');
 mask.className = 'modal-mask'; mask.id = 'logsMask';
 mask.innerHTML = '<div class="modal-box modal-wide" role="dialog" aria-modal="true" aria-label="操作日志">' +
 (window.__frag ? window.__frag.modalHead('操作日志') : '<button type="button" class="modal-close-x" aria-label="关闭" data-x="1"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button><div class="modal-title">操作日志</div>') +
 '<p class="imp-lead"></p>' +
 /* v540（老板：日报改成 1 天 / 7 天 / 30 天）——范围同时作用于上面日报和下面明细 */
 '<div class="logs-range" id="logsRange">' +
 '<span class="logs-range-t">时间范围</span>' +
 '<button type="button" class="logs-rbtn on" data-days="1">1天</button>' +
 '<button type="button" class="logs-rbtn" data-days="7">7天</button>' +
 '<button type="button" class="logs-rbtn" data-days="30">30天</button>' +
 /* v543：导出当前范围的全部记录（不是当前这一页），复用全站那份 XLS 导出器 */
 '<button type="button" class="row-btn logs-exp" id="logsExport">导出 Excel</button>' +
 '</div>' +
 '<div class="logs-daily" id="logsDaily"><div class="logs-d-empty">正在统计</div></div>' +
 '<div class="logs-tools">' +
 '<input class="input" id="logsQ" type="search" autocomplete="off" placeholder="搜索动作或对象，比如 删除、分类、资源">' +
 '<button type="button" class="btn-blue btn-inline" id="logsGo">搜索</button>' +
 '</div>' +
 /* 提示说明的是「下面这张表」，所以贴表格上方；放底部会跟「关闭」挤在一行，
 而且弹窗底部只有一个按键时它是撑满整行的（等分规则），插东西进去会破坏那个布局。 */
 '<div class="log-tip">点开看全文</div>' +
 '<div class="logs-body" id="logsBody"><div class="extc-loading">正在读取</div></div>' +
 '<div class="uni-pager" id="logsPager"></div>' + /* v608：操作日志底部不要关闭键 */
 '</div>';
 document.body.appendChild(mask);
 requestAnimationFrame(function () { mask.classList.add('open'); });
 if (window.syncBodyLock) window.syncBodyLock();

 var close = function () {
 mask.classList.remove('open');
 setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180);
 };
 mask.addEventListener('click', function (e) { if (e.target === mask || (e.target.closest && e.target.closest('[data-x]'))) close(); });

 /* ---------- v602，点行展开看全文 ----------
 背景：390px 下四列被压到 74/80/71/67px，对象列真实内容 122px，
 永远显示成「5（开启每天自动采」。手机上没有 hover，title 也没用。
 做法：整行当按钮（role=button + tabindex），点一下在行下方铺一块完整信息，
 再点收起；同屏只留一条展开（列表本来就密，展开多条要来回滚）。
 为什么不用换行：规范 9.120 明令列表行不换行，行高会从 32 变成 48，扫读变慢。 */
 function closeLogRow(r) {
 r.classList.remove('is-open');
 r.setAttribute('aria-expanded', 'false');
 var n = r.nextElementSibling;
 if (n && n.classList && n.classList.contains('log-more')) n.remove();
 }
 function toggleLogRow(r) {
 var wasOpen = r.classList.contains('is-open');
 Array.prototype.forEach.call(mask.querySelectorAll('#logsBody .log-row.is-open'), closeLogRow);
 if (wasOpen) return;
 r.classList.add('is-open');
 r.setAttribute('aria-expanded', 'true');
 /* 时间取「带年份」那份：≤560px 时 .log-t-full 是 display:none，
 但这里要的是完整信息，不能拿父节点 textContent（会把长短两份拼起来）。 */
 var full = r.querySelector('.log-t-full');
 var t = full || r.querySelector('.log-t') || {};
 var w = r.querySelector('.log-w') || {}, a = r.querySelector('.log-a') || {}, g = r.querySelector('.log-g') || {};
 var more = document.createElement('div');
 more.className = 'log-more';
 more.innerHTML =
 '<div class="lm-r"><span class="lm-k">时间</span>' + esc((t.textContent || '').trim()) + '</div>' +
 '<div class="lm-r"><span class="lm-k">账号</span>' + esc((w.textContent || '').trim()) + '</div>' +
 '<div class="lm-r"><span class="lm-k">做了什么</span>' + esc((a.textContent || '').trim()) + '</div>' +
 '<div class="lm-r"><span class="lm-k">对象</span>' + esc((g.textContent || '').trim()) + '</div>';
 r.parentNode.insertBefore(more, r.nextSibling);
 }
 mask.querySelector('#logsBody').addEventListener('click', function (e) {
 var r = e.target.closest ? e.target.closest('.log-row') : null;
 if (r) toggleLogRow(r);
 });
 mask.querySelector('#logsBody').addEventListener('keydown', function (e) {
 if (e.key !== 'Enter' && e.key !== ' ') return;
 var r = e.target.closest ? e.target.closest('.log-row') : null;
 if (!r) return;
 e.preventDefault(); toggleLogRow(r);
 });

 var page = 1, q = '', days = 1, who = '';
 /* v590（老板 11-09 第 15 条）：做什么 / 按天两类标签也做成可点的筛选，和账号标签一致——
 原来只有账号能点，另外两类是死标签。这里就地按本页过滤，不打断时间范围。 */
 var actF = '', dayF = '', lastSum = null;
 function paintWithSum(sm) { paintSum(sm); }
 function applyRowFilter() {
 var rows = mask.querySelectorAll('#logsBody .log-row');
 var shown = 0;
 rows.forEach(function (r) {
 var a = (r.querySelector('.log-a') || {}).textContent || '';
 var t = (r.querySelector('.log-t') || {}).textContent || '';
 var ok = (!actF || a.replace(/\s+/g, '') === String(actF).replace(/\s+/g, '')) && (!dayF || t.indexOf(dayF) >= 0);
 if (!ok && r.classList.contains('is-open')) closeLogRow(r); /* v602：被筛掉的行走开就一起收起，别留下孤零零的展开块 */
 r.style.display = ok ? '' : 'none';
 if (ok) shown++;
 });
 var body = mask.querySelector('#logsBody'); if (!body) return;
 var emp = body.querySelector('#logsFilterEmpty');
 if (!shown && rows.length) {
 if (!emp) { emp = document.createElement('div'); emp.id = 'logsFilterEmpty'; emp.className = 'logs-d-empty'; body.appendChild(emp); }
 emp.textContent = '本页没有「' + (actF || dayF) + '」的记录，翻页或换时间范围再试';
 } else if (emp) emp.remove();
 }
 var RANGE_TXT = { 1: '1天', 7: '7天', 30: '30天' }; /* v543b：与数据统计页同一套叫法（1天/7天/30天），不再「今天/近 7 天/近 30 天」各说各的 */
 function bjTime(v) {
 var d = new Date(String(v || '').replace(' ', 'T') + 'Z');
 if (isNaN(d.getTime())) return String(v || '');
 return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
 }

 /* v540：员工操作日报——按人 / 按动作 / 按天，服务端汇总（点数再多也只回几百字节） */
 function paintSum(sm) {
 var box = mask.querySelector('#logsDaily');
 if (!box) return;
 sm = sm || {};
 lastSum = sm || {};
 var people = sm.people || [], acts = sm.actions || [], byDay = sm.byDay || [];
 if (!sm.total) {
 box.innerHTML = '<div class="logs-d-empty">' + RANGE_TXT[days] + '内没有操作记录</div>';
 return;
 }
 var maxP = 1;
 people.forEach(function (p) { if ((p.n || 0) > maxP) maxP = p.n; });
 var ph = people.map(function (p) {
 var w = Math.max(4, Math.round((p.n / maxP) * 100));
 return '<button type="button" class="log-who' + (who === p.who ? ' on' : '') + '" data-who="' + esc(p.who || 'admin') + '" title="只看这个账号">' +
 '<span class="lw-n">' + esc(p.who || 'admin') + '</span>' +
 '<span class="lw-bar"><i style="width:' + w + '%"></i></span>' +
 '<b>' + p.n + '</b></button>';
 }).join('');
 var ah = acts.map(function (a) { return '<button type="button" class="logs-act' + (actF === a.action ? ' on' : '') + '" data-actf="' + esc(a.action || '') + '">' + esc(a.action || '') + ' <b>' + a.n + '</b></button>'; }).join('');
 var dh = byDay.slice(0, 10).map(function (x) { var _d = String(x.day || '').slice(5); return '<button type="button" class="logs-day' + (dayF === _d ? ' on' : '') + '" data-dayf="' + esc(_d) + '">' + esc(_d) + ' <b>' + x.n + '</b></button>'; }).join('');
 box.innerHTML =
 '<div class="logs-d-head"><b>操作日报，' + RANGE_TXT[days] + '</b>' +
 '<span>共 ' + sm.total + ' 条，' + people.length + ' 人参与</span>' +
 (who ? '<button type="button" class="row-btn" id="logsWhoClear">只看「' + esc(who) + '」×</button>' : '') +
 '</div>' +
 (people.length ? '<div class="logs-d-people">' + ph + '</div>' : '') +
 (acts.length ? '<div class="logs-d-line"><span class="ldl-t">做什么</span>' + ah + '</div>' : '') +
 (byDay.length ? '<div class="logs-d-line"><span class="ldl-t">按天</span>' + dh + '</div>' : '');
 }

 function paint(d) {
 var body = mask.querySelector('#logsBody');
 var list = (d && d.list) || [];
 if (!list.length) {
 body.innerHTML = '<div class="extc-loading">' + (q ? '该搜索暂无记录，换个词试试'
 : (who ? '该账号在这段时间没有操作记录' : '该列表暂无操作记录。改一次设置或删一个资源，这里就会出现。')) + '</div>';
 } else {
 /* v602：窄屏四列挤到 67px，对象列 122px 的内容被省略号切掉（规范 11.6 第 1 条）。
 现在整行可点/可聚焦，点开在行下方就地铺一条完整信息（时间/账号/做了什么/对象）。 */
 body.innerHTML = '<div class="log-head" aria-hidden="true"><span>时间</span><span>账号</span><span>做了什么</span><span>对象</span></div>' + list.map(function (r) {
 return '<div class="log-row" data-who="' + esc(r.who || 'admin') + '" role="button" tabindex="0" aria-expanded="false">' +
 '<span class="log-t"><i class="log-t-full">' + esc(bjTime(r.at)) + '</i><i class="log-t-short">' + esc(String(bjTime(r.at)).replace(/^\d{4}-/, '')) + '</i></span>' +
 '<span class="log-w">' + esc(r.who || 'admin') + '</span>' +
 '<span class="log-a">' + esc(r.action || '') + '</span>' +
 '<span class="log-g" title="' + esc(r.target || '') + '">' + esc(r.target || '') + '</span>' +
 '</div>';
 }).join('');
 }
 var pager = mask.querySelector('#logsPager');
 if (pager && window.buildUniPager) {
 window.buildUniPager(pager, {
 page: (d && d.page) || 1,
 totalPages: Math.max(1, Math.ceil(((d && d.total) || 0) / ((d && d.size) || 20))),
 total: (d && d.total) || 0, unit: '条',
 onPage: function (p2) { page = p2; load(); }
 });
 }
 paintSum(d && d.summary);
 applyRowFilter();
 }

 /* v590（第 15 条）：账号标签之外，「做什么 / 按天」也做成可点筛选（就地过滤本页，不动时间范围） */
 var _daily = mask.querySelector('#logsDaily');
 if (_daily) _daily.addEventListener('click', function (e) {
 var a1 = e.target.closest && e.target.closest('[data-actf]');
 if (a1) { var v1 = a1.getAttribute('data-actf'); actF = (actF === v1) ? '' : v1; paintSum(lastSum || {}); applyRowFilter(); return; }
 var a2 = e.target.closest && e.target.closest('[data-dayf]');
 if (a2) { var v2 = a2.getAttribute('data-dayf'); dayF = (dayF === v2) ? '' : v2; paintSum(lastSum || {}); applyRowFilter(); }
 });

 function load() {
 var body = mask.querySelector('#logsBody');
 body.innerHTML = '<div class="extc-loading">正在读取</div>';
 /* v540：一页 20 条 + 时间范围 + 按人筛选 */
 fetch('/api/admin/logs?page=' + page + '&size=20&days=' + days
 + '&q=' + encodeURIComponent(q) + '&who=' + encodeURIComponent(who),
 { credentials: 'same-origin', cache: 'no-cache' })
 .then(function (r) { return r.json(); })
 .then(function (d) { if (!d || !d.ok) throw new Error((d && d.msg) || '读取失败'); paint(d); })
 .catch(function (e) { body.innerHTML = '<div class="imp-err">' + esc(e.message || '读取失败，请重试') + '</div>'; });
 }

 /* 时间范围切换 */
 var rangeEl = mask.querySelector('#logsRange');
 if (rangeEl) rangeEl.addEventListener('click', function (e) {
 var b = e.target.closest && e.target.closest('.logs-rbtn'); if (!b) return;
 days = Number(b.getAttribute('data-days')) || 7;
 page = 1;
 mask.querySelectorAll('.logs-rbtn').forEach(function (x) { x.classList.toggle('on', x === b); });
 load();
 });
 /* 日报里点某个账号 = 只看这个人（服务端筛，翻页也准） */
 mask.addEventListener('click', function (e) {
 var w = e.target.closest && e.target.closest('.log-who'); if (!w) return;
 var name = w.getAttribute('data-who');
 who = (who === name) ? '' : name;
 page = 1; load();
 });
 mask.addEventListener('click', function (e) {
 if (e.target.closest && e.target.closest('#logsWhoClear')) { who = ''; page = 1; load(); }
 });

 mask.querySelector('#logsGo').addEventListener('click', function () { q = mask.querySelector('#logsQ').value.trim(); page = 1; load(); });
 mask.querySelector('#logsQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') { q = this.value.trim(); page = 1; load(); } });

 /* v543（清单第 20 条）：日志导出 Excel
 老板原话：月底核账、给员工做考核，现在只能一页页翻。
 做法：按当前「时间范围 + 搜索词 + 只看某个账号」拉全量（size=0），
 用系统已有的那份导出器（window.__downloadXLS）生成，不另写一套格式；
 导出的是整段范围，不是眼前这 20 条，导完在 toast 里报条数。 */
 var expBtn = mask.querySelector('#logsExport');
 if (expBtn) expBtn.addEventListener('click', function () {
 if (typeof window.__downloadXLS !== 'function' || typeof window.__exportStamp !== 'function') {
 if (window.showToast) window.showToast('请刷新页面再导出', 'error');
 return;
 }
 var oldTxt = expBtn.textContent;
 expBtn.disabled = true; expBtn.textContent = '导出中';
 var back = function () { expBtn.disabled = false; expBtn.textContent = oldTxt; };
 fetch('/api/admin/logs?page=1&size=0&days=' + days
 + '&q=' + encodeURIComponent(q) + '&who=' + encodeURIComponent(who),
 { credentials: 'same-origin', cache: 'no-cache' })
 .then(function (r) { return r.json(); })
 .then(function (d) {
 if (!d || !d.ok) throw new Error((d && d.msg) || '读取失败');
 var rows = [['时间', '账号', '做了什么', '对象']];
 (d.list || []).forEach(function (r) { rows.push([bjTime(r.at), r.who || 'admin', r.action || '', r.target || '']); });
 window.__downloadXLS('操作日志-' + RANGE_TXT[days] + '-' + window.__exportStamp() + '.xls',
 [{ name: '操作日志', rows: rows }]);
 back();
 if (window.showToast) window.showToast(d.truncated
 ? '日志太多，只导出了最近 ' + (rows.length - 1) + ' 条；更早的请把时间范围改小再导'
 : '已导出 ' + (rows.length - 1) + ' 条（' + RANGE_TXT[days] + (who ? '・' + who : '') + '）', d.truncated ? 'info' : 'success');
 })
 .catch(function (e) { back(); if (window.showToast) window.showToast('导出失败：' + (e.message || '请重试'), 'error'); });
 });
 load();
 }

 /* ================= v545：清空测试数据 =================
 老板要重测一遍，先把测试资源清干净。这条是破坏性操作，所以按最保守的做法来：
 ① 只有超级管理员看得到这颗键、接口也只认超级管理员；
 ② 必须手打「清空」两个字才能点确认；
 ③ 只删业务数据，账号/密码/店铺名/客服二维码全留着；
 ④ 弹窗里先给「导出备份」，删错了还能对着找。 */
 function openReset() {
 var old = document.getElementById('resetMask'); if (old) old.remove();
 var mask = document.createElement('div');
 mask.className = 'modal-mask'; mask.id = 'resetMask';
 mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="清空测试数据">' +
 (window.__frag ? window.__frag.modalHead('清空测试数据') : '<button type="button" class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button><h2 class="modal-title">清空测试数据</h2>') +
 '<p class="imp-lead"><b>会删掉的：</b>资源、资源类型、分类、访问统计、设备绑定、发码记录、采集到的资源与平台、操作日志、公告内容。<br>' +
 '<b>会留住的：</b>管理员账号和密码、店铺名、客服二维码、页面风格设置。</p>' +
 '<p class="imp-lead">删了就找不回，先备份</p>' +
 '<div class="logs-tools"><button type="button" class="row-btn" id="rsBackup">导出备份（Excel）</button></div>' +
 '<label for="rsConfirm">确认请原样输入「清空」两个字</label>' +
 '<input class="input" id="rsConfirm" type="text" autocomplete="off" placeholder="清空" aria-label="输入清空二字以确认">' +
 '<div class="modal-footer"><button type="button" class="modal-inner-btn" id="rsGo" disabled>确认清空</button>' +
 '<button type="button" class="modal-close" data-x="1">关闭</button></div>' +
 '</div>';
 document.body.appendChild(mask);
 requestAnimationFrame(function () { mask.classList.add('open'); });
 if (window.syncBodyLock) window.syncBodyLock();

 var close = function () {
 mask.classList.remove('open');
 setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180);
 };
 mask.addEventListener('click', function (e) { if (e.target === mask || (e.target.closest && e.target.closest('[data-x]'))) close(); });

 var inp = mask.querySelector('#rsConfirm');
 var go = mask.querySelector('#rsGo');
 inp.addEventListener('input', function () { go.disabled = String(inp.value).trim() !== '清空'; });

 mask.querySelector('#rsBackup').addEventListener('click', function () {
 var eb = document.getElementById('exportBtn');
 if (eb) { eb.click(); if (window.showToast) window.showToast('导出中，稍后确认清空', 'info'); }
 else if (window.showToast) window.showToast('请到统计页导出', 'error');
 });

 go.addEventListener('click', function () {
 if (String(inp.value).trim() !== '清空') return;
 go.disabled = true; var t0 = go.textContent; go.textContent = '正在清空';
 fetch('/api/admin/reset', {
 method: 'POST', credentials: 'same-origin',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ confirm: '清空' })
 }).then(function (r) { return r.json(); }).then(function (d) {
 go.disabled = false; go.textContent = t0;
 if (!d || !d.ok) { if (window.showToast) window.showToast((d && d.msg) || '清空失败', 'error'); return; }
 close();
 if (window.showToast) window.showToast('已清空，正在刷新', 'success');
 /* v545b：清空后后台列表原来不刷新（实测删完还挂着 19 行旧数据），因为各处都有内存缓存。
 数据整体换了，最稳的是整页重载——比逐个清缓存可靠，也不会漏掉统计/分类的缓存。 */
 setTimeout(function () { try { location.reload(); } catch (e0) { if (window.__silent) window.__silent(e0); } }, 500);
 }).catch(function () {
 go.disabled = false; go.textContent = t0;
 if (window.showToast) window.showToast('网络没连上，没清成', 'error');
 });
 });
 }

 /* 平台设置页挂入口键（v434b：照「修改密码」组同款——独立白色卡片、各占一行、btn-inline-pd 自适应键宽，
 不再 flex 拉满半屏、不再游离在卡片外） */
 (function wait() {
 /* v441：资源页批量导入入口按老板拍板撤除（导入只留平台设置页入口） */
 var panel = document.getElementById('panel-settings');
 if (panel && !document.getElementById('batchImportBtn')) {
 /* v443 条15（老板反馈：模块要分开，像基本设置那样独立卡片不粘连）：
 三组各自独立 setting-group 白卡；「账号安全」卡内末尾挪入修改密码组 */
 /* v537（老板）：一列里"第一颗蓝、后面白"看着像两套东西——整列统一成行内键，只靠位置和文字区分。 */
 /* v587 用户 11-08（第 3 条：「系统体检点击后依然会显示图标」）真根因：
 __autoDecorate 里有一条规则 [/体检|检查/, 'check']，把「系统体检」匹配上了，
 于是给它塞了 ✓ 图标 + btn-fit 类，把它拉进 __btnFit 自适应体系；
 96px 的宽度装不下「图标 + 4 个字」（实测要 106px），判定溢出 → 收成纯图标。
 设置面板这一列全是「说明 + 按钮」的行式布局，压根不需要图标——
 统一打 data-noico，让 __autoDecorate 整列跳过。 */
 var btnHtml = function (id, lab, extra) {
 return '<button type="button" class="row-btn" id="' + id + '" data-noico="1"' + (extra || '') + '>' + lab + '</button>';
 };
 var row = function (lab, btnStr) { return '<div class="setting-row is-inline"><label>' + lab + '</label>' + btnStr + '</div>'; };
 var mkGroup = function (title, rowsHtml) {
 var g = document.createElement('div');
 g.className = 'setting-group';
 g.innerHTML = '<h3>' + title + '</h3>' + rowsHtml;
 panel.appendChild(g);
 return g;
 };
 mkGroup('内容管理',
 row('资源采集（从别家平台抓资源，挑着上架）', btnHtml('openExtCollectBtn', '资源采集', ' data-perm="external.view"')) /* v587：从「基本设置」移进来——采集属于内容管理 */
 + row('批量导入（Excel 一次导多条）', btnHtml('batchImportBtn', '批量导入', '', 1))
 + row('回收站点（删除的内容保留 60 天）', btnHtml('recycleBtn', '回收站点'))
 ); /* v587 用户 11-08：去掉「自动采集」入口——采集本来就是自动的，摆个按钮反而让人以为要手动点 */
 /* v587：cronBtn 已移除，监听一并去掉（保留 openCronHelp 函数供别处复用） */
 mkGroup('系统维护',
 row('系统体检（图片/外链/环境检查）', btnHtml('imgCheckBtn', '系统体检', '', 1))
 + row('前端报错（访客页面出错会自动记下来）', btnHtml('errLogBtn', '前端报错', ' data-perm="sensitive.super"'))
 + row('性能实测（真实访客的加载速度 p75）', btnHtml('vitalsBtn', '性能实测', ' data-perm="sensitive.super"'))
 + row('清空测试数据（重新开始测试时用）', btnHtml('resetBtn', '清空数据', ' data-perm="sensitive.super"')));
 var accGrp = mkGroup('账号安全', row('子账号权限与冻结', btnHtml('usersBtn', '账号管理', ' data-perm="users"', 1))
 + row('谁改了什么（保留 60 天）', btnHtml('logsBtn', '操作日志', ' data-perm="users"')));
 var grp = accGrp;
 /* 把静态「修改密码」组挪进「账号安全」组最末（保证修改密码永远在最下面）；
 原组自带 setting-group 白卡样式，挪进组内会双层嵌套 → 降级为普通块 */
 try {
 var pwdGrp = document.getElementById('pwdGroup');
 if (pwdGrp) { pwdGrp.className = ''; pwdGrp.style.marginTop = '6px'; accGrp.appendChild(pwdGrp); }
 } catch (eP) { if (window.__silent) window.__silent(eP); }
 panel.querySelector('#batchImportBtn').addEventListener('click', openWizard);
 panel.querySelector('#resetBtn').addEventListener('click', function () { openReset(); });
 panel.querySelector('#imgCheckBtn').addEventListener('click', function () { try { this.querySelector('.dot-badge') && this.querySelector('.dot-badge').remove(); } catch (eC) {} sysCheck(); });
 var _errBtn = panel.querySelector('#errLogBtn');
 if (_errBtn) _errBtn.addEventListener('click', function () { openErrs(); });
 var _vBtn = panel.querySelector('#vitalsBtn');
 if (_vBtn) _vBtn.addEventListener('click', function () { openVitals(); });
 panel.querySelector('#recycleBtn').addEventListener('click', openRecycle);
 panel.querySelector('#usersBtn').addEventListener('click', openUsers);
 var _lgBtn = panel.querySelector('#logsBtn');
 if (_lgBtn) _lgBtn.addEventListener('click', function () { openLogs(); });

 /* v530：设置页导航 + 折叠
 —— 原来 8 件事竖排，账号管理在 y≈896（视口 900），几乎要滚到底才看见。 */
 try {
 var groups = [].slice.call(panel.querySelectorAll('.setting-group'));
 if (groups.length) {
 var nav = document.createElement('div');
 nav.className = 'set-nav';
 nav.innerHTML = groups.map(function (g, i) {
 var t = (g.querySelector('h3') || {}).textContent || ('第' + (i + 1) + '组');
 g.setAttribute('data-set-group', String(i));
 return '<button type="button" data-goto="' + i + '">' + t.replace(/（.*?）/g, '') + '</button>';
 }).join('');
 panel.insertBefore(nav, panel.firstChild);
 nav.addEventListener('click', function (e) {
 var b = e.target.closest('[data-goto]'); if (!b) return;
 var g = groups[Number(b.getAttribute('data-goto'))];
 if (!g) return;
 g.classList.remove('collapsed');
 g.scrollIntoView({ behavior: 'smooth', block: 'start' });
 [].forEach.call(nav.children, function (x) { x.classList.toggle('on', x === b); });
 });
 /* 点组标题折叠/展开；默认全展开，只记状态不强制收。
 v537（老板）：三角换成全站那枚 20px 蓝色箭头（与「资源明细」折叠键同款），
 折叠动效用与「资源明细」相同的 grid 轨道过渡，开合两个方向都有动画。 */
 groups.forEach(function (g) {
 var h = g.querySelector('h3');
 if (!h) return;
 if (!h.querySelector('.set-caret')) {
 var sp = document.createElement('span');
 sp.className = 'set-caret';
 sp.setAttribute('aria-hidden', 'true');
 sp.innerHTML = '<svg class="toggle-arrow" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>';
 h.appendChild(sp);
 }
 if (!g.querySelector('.set-body')) {
 var body = document.createElement('div');
 body.className = 'set-body';
 var inner = document.createElement('div');
 inner.className = 'set-body-inner';
 var kids = [].slice.call(g.children).filter(function (c) { return c !== h; });
 kids.forEach(function (c) { inner.appendChild(c); });
 body.appendChild(inner);
 g.appendChild(body);
 }
 h.addEventListener('click', function () { g.classList.toggle('collapsed'); });
 });
 }
 } catch (eNav) {}

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
