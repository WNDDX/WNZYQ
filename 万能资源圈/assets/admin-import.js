(function () {
'use strict';
var NS = 'urn:schemas-microsoft-com:office:spreadsheet';

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }


function catOptions() {
var cats = (window.state && state.categories) || [];
return cats.map(function (c) { return c.name; });
}




var __crcT = (function () { var t = [], n, k, c; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); } t[n] = c >>> 0; } return t; })();
function __crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) { c = __crcT[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); } return (c ^ 0xFFFFFFFF) >>> 0; }
function __u16(n) { return [n & 255, (n >>> 8) & 255]; }
function __u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }


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


function __sheetXml(cfg) {
var hdr = cfg.headerRows == null ? 1 : cfg.headerRows;
var cols = '';
if (cfg.widths && cfg.widths.length) {
cols = '<cols>' + cfg.widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
}
var rowsXml = cfg.rows.map(function (r, ri) {
var cells = r.map(function (v, ci) {
var ref = __colName(ci) + (ri + 1);
var st = ri < hdr ? 1 : 2;
if (v === '' || v == null) return '<c r="' + ref + '" s="' + st + '"/>';
return '<c r="' + ref + '" s="' + st + '" t="inlineStr"><is><t xml:space="preserve">' + esc(String(v)) + '</t></is></c>';
}).join('');
return '<row r="' + (ri + 1) + '"' + (ri < hdr ? ' ht="26" customHeight="1"' : '') + '>' + cells + '</row>';
}).join('');
var dv = '';
if (cfg.dv && cfg.dv.length) {
dv = '<dataValidations count="' + cfg.dv.length + '">' + cfg.dv.map(function (d) {

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


window.__parseAnySheet = function (buf) {
return parseXlsx(buf, true).then(function (book) {

var best = null;
Object.keys(book || {}).forEach(function (name) {
var rs = book[name] || [];
if (!rs.length) return;
if (!best || rs.length > best.rows.length) best = { name: name, rows: rs };
});
if (!best) return [];
var rows = best.rows.filter(function (r) { return r && r.join('').trim(); });
if (!rows.length) return [];

var hi = -1;
for (var i = 0; i < Math.min(6, rows.length); i++) {
var line = rows[i].join('|');

if (/标题|名称|商品|产品|套餐/.test(line) && /图|链接|地址|url|备注|价格|id/i.test(line)) { hi = i; break; }
if (/标题|名称/.test(line) && rows[i].filter(Boolean).length >= 2) { hi = i; break; }
}
if (hi < 0) hi = 0;
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
try { window.__lastSheet = { sheet: best.name, head: head, iT: iT, iC: iC, iU: iU, hi: hi, sample: out.slice(0, 3) }; } catch (e0) {}
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


function buildTemplate() {
var opts = catOptions().filter(Boolean);
if (!opts.length) opts = ['（请先到后台分类管理新增分类）'];
var lastOpt = opts.length + 1;
var CAT_DV = '分类选项';
var LV_DV = '分类级别选项';
var ST_DV = '显示状态选项';
var OPT_NAMES = [
{ name: '分类选项', ref: '选项!$A$2:$A$' + lastOpt },
{ name: '分类级别选项', ref: '选项!$B$2:$B$3' },
{ name: '显示状态选项', ref: '选项!$C$2:$C$3' },
{ name: '时间选项', ref: '选项!$D$2:$D$9' }
];
var ROWSN = 30;
var d2 = new Date(), pd = function (n) { return n < 10 ? '0' + n : '' + n; };
var fname = '' + d2.getFullYear() + pd(d2.getMonth() + 1) + pd(d2.getDate()) + '-' + pd(d2.getHours()) + pd(d2.getMinutes()) + '-导入模板.xlsx';


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
function download(name, content) { try { window.__tplName = name; } catch (e0) {}
var blob = new Blob(['\ufeff' + content], { type: 'application/vnd.ms-excel;charset=utf-8' });
var a = document.createElement('a');
a.href = URL.createObjectURL(blob); a.download = name;
document.body.appendChild(a); a.click(); a.remove();
setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
}


function parseWorkbook(text) {
var doc = new DOMParser().parseFromString(text, 'text/xml');
var out = {};
Array.prototype.forEach.call(doc.getElementsByTagName('Worksheet'), function (ws) {
var name = ws.getAttribute('ss:Name') || ws.getAttribute('name') || '';
var rows = [];
var table = ws.getElementsByTagName('Table')[0];
if (!table) { out[name] = rows; return; }
Array.prototype.forEach.call(table.getElementsByTagName('Row'), function (row, ri) {
if (ri === 0) return;
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


function preview(data) {
var lines = [];
var cats = catOptions();
var res = data['资源'] || [], cat = data['分类'] || [], ann = data['公告'] || [], vars = data['类型'] || [];
var bad = 0;
res.forEach(function (r, i) { if (!r[0]) { bad++; lines.push('资源第' + (i + 2) + '行：缺标题，跳过'); } else if (r[1] && cats.indexOf(r[1]) < 0) { bad++; lines.push('资源第' + (i + 2) + '行：分类「' + r[1] + '」不存在，请先导分类'); } });
cat.forEach(function (r, i) { if (!r[0]) { bad++; lines.push('分类第' + (i + 2) + '行：缺名称，跳过'); } });
ann.forEach(function (r, i) { if (!r[0]) { bad++; lines.push('公告第' + (i + 2) + '行：缺标题，跳过'); } });
vars.forEach(function (r, i) { if (!r[0] || !r[1]) { bad++; lines.push('类型第' + (i + 2) + '行：缺所属资源标题或类型名称，跳过'); } });
lines.unshift('校验完成：资源 ' + res.length + ' 条 / 类型 ' + vars.length + ' 条 / 分类 ' + cat.length + ' 条 / 公告 ' + ann.length + ' 条' + (bad ? '；问题 ' + bad + ' 条' : '，全部可导入'));
return { lines: lines, bad: bad, '资源': res, '类型': vars, '分类': cat, '公告': ann };
}


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

(data['类型'] || []).forEach(function (r) {
if (!r[0] || !r[1]) return;
seq = seq.then(function () {
var pid = prodIdByName[r[0]];
if (!pid) { say('类型「' + r[1] + '」：资源「' + r[0] + '」未在本次导入中创建，跳过'); return Promise.resolve(null); }

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
'<p class="imp-lead">第 1 步：下载模板 → 填好 → 第 2 步上传 → 预览无误后导入。建议顺序：先导「分类」→ 再导「资源」→ 最后导「类型」。</p>' +
'<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-blue btn-inline" id="impTpl" style="flex:1">下载模板</button>' +
'<button class="btn-blue btn-inline" id="impUploadBtn" style="flex:1">上传表格</button><input type="file" id="impFile" accept=".xlsx,.xls,.xml" style="display:none"></div>' +
'<div id="impPrev" style="margin-top:10px"></div>' +
'<div class="imp-hist" id="impHist"></div></div>' +
'<div class="modal-footer"><button type="button" class="modal-close" data-x="1">关闭</button></div></div>';
document.body.appendChild(mask);
renderImpHist(mask.querySelector('#impHist'));
requestAnimationFrame(function () {
mask.classList.add('open');
try { var xb = mask.querySelector('[data-x]'); if (xb) xb.focus({ preventScroll: true }); } catch (eF) {}
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
mask.querySelector('#impUploadBtn').addEventListener('click', function () { mask.querySelector('#impFile').click(); });
mask.querySelector('#impFile').addEventListener('change', function () {
var f = this.files && this.files[0]; if (!f) return;
var fname = String(f.name || '');
var rd = new FileReader();
rd.onload = function () {

var buf = rd.result, isZip = false;
try { var head = new Uint8Array(buf, 0, 4); isZip = head[0] === 0x50 && head[1] === 0x4B; } catch (eH) { isZip = false; }
var doneParse = function (data) {
var pv = preview(data);
var body = mask.querySelector('#impPrev');
var total = (pv['资源'] || []).length + (pv['类型'] || []).length + (pv['分类'] || []).length + (pv['公告'] || []).length;
body.innerHTML = '<div class="imp-log">' + esc(pv.lines.join('\n')) + '</div>' +
'<button class="btn-blue" id="impGo" style="width:100%"' + (total ? '' : ' disabled') + '>确认导入</button>';
body.querySelector('#impGo').addEventListener('click', function () {
this.disabled = true; this.textContent = '导入中…';

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


function sysCheck(silent) {
return new Promise(function (resolve) {
var products = (window.state && state.products) || [];
if (!products.length) { if (!silent && window.showToast) window.showToast('当前没有资源可检查', 'info'); resolve(null); return; }

var _shell = null;
if (!silent) {
var _old = document.getElementById('sysCheckMask'); if (_old) _old.remove();
_shell = document.createElement('div');
_shell.className = 'modal-mask'; _shell.id = 'sysCheckMask';
_shell.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="系统体检"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
'<h2 class="modal-title">系统体检</h2>' +
'<div style="font-size:13px;color:var(--text-light);margin:0 0 12px">正在逐张检查图片、逐条探测外链，最长约半分钟，请稍候…</div>' +
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
addImg(p.img, '封面', 'img', -1);
(p.coverImages || []).forEach(function (u, i) { addImg(u, '封面组', 'cover_images', i); });
(p.detailImages || []).forEach(function (u, i) { addImg(u, '详情图', 'detail_images', i); });
});

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
if (!imgs.length && !links.length) { var _eS = document.getElementById('sysCheckMask'); if (_eS) _eS.remove(); if (!silent && window.showToast) window.showToast('当前没有可检查的图片和外链', 'info'); resolve(null); return; }
if (!silent && window.showToast) window.showToast('系统体检中：图片 ' + imgs.length + ' 张 · 外链 ' + links.length + ' 条…', 'info');


var refMap = {};
imgs.forEach(function (it) { (refMap[it.src] = refMap[it.src] || []).push(it); });
var testList = Object.keys(refMap).map(function (src) { return { src: src, refs: refMap[src] }; });
var broken = [], oversize = [], done = 0, total = testList.length;

var imgDone = new Promise(function (res) { window.__sysImgFinish = res; });

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

var done2 = 0;
var finish2 = function () { done2++; };
testList.forEach(function (it) {
var im = new Image();
var fin = function (ok) { done++; if (!ok) broken.push(it); finish(); };
im.onload = function () { fin(true); };
im.onerror = function () { fin(false); };
setTimeout(function () { if (!im.complete) fin(false); }, 8000);
im.src = it.src;

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

var dups = testList.filter(function (t) { return t.refs.length > 1; });

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


function sysAlertCount(R0) {
return (R0.broken || []).length + (R0.oversize || []).length + (R0.links || []).filter(function (L) { return L.ok === false; }).length + (R0.env || []).filter(function (e) { return !e.ok; }).length;
}


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


function renderSysResult(R0) {
var old = document.getElementById('sysCheckMask'); if (old) old.remove();
var brokenRows = R0.broken.map(function (it) {
return '<div class="chk-row">' +
'<span class="chk-thumb chk-thumb-bad">✕</span>' +
'<span class="chk-main"><b>' + esc(it.refs[0].where) + '</b><span class="chk-sub">' + esc(it.src) + '</span></span>' +
'<button type="button" class="btn-blue btn-inline-pd" data-goto-pid="' + esc(String(it.refs[0].pid)) + '">去处理</button></div>';
});
var dupRows = R0.dups.map(function (it) {
var wheres = it.refs.map(function (r) { return r.where; }).join('、');
return '<div class="chk-row">' +
'<img class="chk-thumb" src="' + esc(it.src) + '" alt="">' +
'<span class="chk-main"><b>被 ' + it.refs.length + ' 处引用</b><span class="chk-sub">' + esc(wheres) + '</span></span></div>';
});
var badLinks = R0.links.filter(function (L) { return L.ok === false; });
var okLinks = R0.links.filter(function (L) { return L.ok === true; }).length;
var uncheckedLinks = (R0.links || []).filter(function (L) { return L.ok === null; }).length;
var linkRows = badLinks.map(function (L) {
return '<div class="chk-row">' +
'<span class="chk-thumb chk-thumb-bad">⚠</span>' +
'<span class="chk-main"><b>' + esc(L.where) + '</b><span class="chk-sub">' + esc(L.href) + '</span></span>' +
(L.pid ? '<button type="button" class="btn-blue btn-inline-pd" data-goto-pid="' + esc(String(L.pid)) + '">去处理</button>' : '') + '</div>';
});

var osRows = (R0.oversize || []).map(function (it, oi) {
return '<div class="chk-row" data-osidx="' + oi + '">' +
'<img class="chk-thumb" src="' + esc(it.src) + '" alt="">' +
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
if (!hasIssue) body = '<div class="chk-empty">全部正常 ✓ 图片 ' + R0.totalImgs + ' 张 · 外链 ' + okLinks + '/' + R0.links.length + ' 条可达 · 环境 ' + (R0.env || []).length + '/' + (R0.env || []).length + '</div>';

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

var _wasClosed = document.getElementById('sysCheckMask');
_wasClosed = !!(_wasClosed && _wasClosed.dataset.userClosed === '1');
if (_wasClosed) { document.getElementById('sysCheckMask').remove(); resolve(R0); return; }
mask.className = 'modal-mask'; mask.id = 'sysCheckMask';
mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="系统体检" style="max-width:var(--modal-w-xl)"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
'<h2 class="modal-title">系统体检</h2>' +
'<div class="chk-sum">' + chips + '</div>' +
'<div class="chk-scroll">' + body + '</div>' +
'<div class="modal-footer"><button type="button" class="modal-close" data-x="1">关闭</button></div></div>';
document.body.appendChild(mask);
requestAnimationFrame(function () {
mask.classList.add('open');
try { var xb = mask.querySelector('[data-x]'); if (xb) xb.focus({ preventScroll: true }); } catch (eF) {}
});

var __chkPage = {};
var bindOsRows = function () {
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

Array.prototype.forEach.call(holder.querySelectorAll('img.chk-thumb'), function (im) {
im.addEventListener('error', function () { this.style.visibility = 'hidden'; });
});
};
['env', 'broken', 'dups', 'links', 'os'].forEach(paintChk);

mask.addEventListener('click', function (e) {
var go = e.target.closest && e.target.closest('[data-goto-pid]');
if (go) { gotoEditProduct(go.getAttribute('data-goto-pid')); return; }
if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); }
});
}


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

function openResetPwd(u, onOk) {
var old = document.getElementById('usPwdMask'); if (old) old.remove();
var mask = document.createElement('div');
mask.className = 'modal-mask'; mask.id = 'usPwdMask';
mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="重置密码"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
'<h2 class="modal-title">重置密码：' + esc(u.username || '') + '</h2><div class="form">' +
'<label style="display:block;font-size:13px;color:var(--text-light);margin-bottom:4px">新密码（6-50 位）</label>' +
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
function usersCall(method, body, done, fail, urlOverride) { fetch(urlOverride || '/api/admin/users', { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined })
.then(function (r) { return r.json(); })
.then(function (x) { if (x && x.ok) { if (done) done(x); } else { if (window.showToast) window.showToast((x && x.msg) || '操作失败', 'error'); if (fail) fail(x); } })
.catch(function () { if (window.showToast) window.showToast(window.T('netFail'), 'error'); if (fail) fail(); });
}

function usAsk(title, msg, opts, onOk) {
opts = opts || {};
var old = document.getElementById('usAskMask'); if (old) old.remove();
var m = document.createElement('div');
m.className = 'modal-mask'; m.id = 'usAskMask';
m.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" style="max-width:var(--modal-w-xs)">'
+ '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>'
+ '<h2 class="modal-title">' + esc(title) + '</h2>'
+ '<p style="font-size:13px;color:var(--text-light);margin:0 0 10px;line-height:1.6">' + msg + '</p>'
+ (opts.input ? '<input class="input w-full-mb10" id="usAskInput" type="' + (opts.inputType || 'text') + '"  maxlength="' + (opts.maxlength || 50) + '" placeholder="' + esc(opts.placeholder || '') + '">' : '')
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

try { if (window.loadCategories) window.loadCategories(true); } catch (e) {}
var old = document.getElementById('usersMask'); if (old) old.remove();
var mask = document.createElement('div');
mask.className = 'modal-mask'; mask.id = 'usersMask';
mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="账号管理"><button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
'<h2 class="modal-title">账号管理</h2><div class="form" id="usBody">' +
'<div style="padding:10px 0">' + '<div class="sk-line" style="height:34px;border-radius:8px;margin-bottom:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '<div class="sk-line" style="height:34px;border-radius:8px;margin-bottom:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '<div class="sk-line" style="height:34px;border-radius:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '</div></div></div>' ;
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
+ '<div class="u-tree">' + rows + '</div>'
+ (__usTotal > __usSize ? '<div class="uni-pager" id="usPager"></div>' : '');

(function () {
var pg = document.getElementById('usPager');
if (pg && window.buildUniPager) {
window.buildUniPager(pg, {
page: __usPage, totalPages: __usPages, total: __usTotal, unit: '个',
onPage: function (p8) { window.__usPage = p8; renderUsersList(); }
});
}
})();

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
body.innerHTML = '<div class="imp-err">网络开小差了，请稍后再试</div>';
});
}


var PM_GROUPS = [
{ t: '资源', k: 'products', items: [['view', '看资源'], ['add', '新增资源'], ['edit', '编辑资源'], ['price', '改价格'], ['online', '上下架'], ['del', '删除资源'], ['restore', '恢复回收站'], ['purge', '彻底删除'], ['moveCat', '挪分类']] },
{ t: '分类', k: 'cats', items: [['view', '看分类'], ['add', '新增分类'], ['edit', '改分类'], ['del', '删分类']] },
{ t: '公告', k: 'ann', items: [['view', '看公告'], ['add', '发公告'], ['edit', '改公告'], ['del', '删公告']] },
{ t: '批量操作', k: 'batch', items: [['import', '批量导入'], ['price', '批量改价'], ['online', '批量上下架'], ['del', '批量删除']] },
{ t: '数据', k: 'data', items: [['stats', '看总量'], ['detail', '看逐条明细'], ['ip', '看访客 IP'], ['export', '导出数据']] },

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


secHtml += '<div class="pm-sec"><div class="pm-sec-hd"><b>其它</b></div><div class="pm-grid">'
+ '<label class="pm-chk"><input type="checkbox" data-pa="info" data-pk="view"' + (isEdit ? (gval('info', 'view') ? ' checked' : '') : ' checked') + '><span>信息中心</span></label>'
+ '<label class="pm-chk"><input type="checkbox" data-pa="users" data-pk="_"' + (isEdit && perms.users ? ' checked' : '') + '><span>管理下级账号</span></label>'
+ '</div></div>';


var catHtml = (function () {
if (!cats.length) return '<span class="pm-hint">暂无分类可勾</span>';
var isOn = function (c) { return Array.isArray(catsScope) ? catsScope.indexOf(Number(c.id)) !== -1 : false; };
var tops = cats.filter(function (c) { return !Number(c.parent_id || 0); });
var kidsOf = function (id) { return cats.filter(function (c) { return Number(c.parent_id || 0) === Number(id); }); };
if (!tops.length) tops = cats.slice();
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


setTimeout(function () { try { if (window.__wrapSelects) window.__wrapSelects(mask); } catch (e) {} }, 30);
mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="子账号编辑" style="max-width:var(--modal-w-lg)">'
+ '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>'
+ '<h2 class="modal-title" style="margin-bottom:10px">' + (isEdit ? '编辑账号：' + esc(u.username) : '新增账号') + '</h2>'
+ '<div class="form usf-body" id="usFormBody">'
+ (isEdit ? '' : '<label class="pm-hint pm-hint-block">用户名（2-20 位字母数字）</label><input class="input" id="ufUser" style="width:100%;margin-bottom:8px" maxlength="20">')
+ (isEdit ? '' : '<label class="pm-hint pm-hint-block">初始密码（6-50 位）</label><input class="input" id="ufPwd" type="password" style="width:100%;margin-bottom:8px" maxlength="50">')
+ '<label class="pm-hint pm-hint-block">备注（这个人是谁 / 负责什么）</label><input class="input w-full-mb10" id="ufNote"  maxlength="100" value="' + esc(isEdit ? (u.note || '') : '') + '">'
+ (me.role === 'super' ? '<label class="pm-hint pm-hint-block">上级账号（决定跟谁是一组）</label><select class="input w-full-mb10" id="ufParent" >' + parentOpts + '</select>' : '')
+ tplHtml + secHtml + scopeHtml + annHtml + codeHtml
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

mask.querySelectorAll('[data-all]').forEach(function (b) {
b.addEventListener('click', function () {
var grp = this.getAttribute('data-all');
var boxes = [].slice.call(mask.querySelectorAll('[data-pa="' + grp + '"]'));
var allOn = boxes.every(function (c) { return c.checked; });
boxes.forEach(function (c) { c.checked = !allOn; });
});
});


fetch('/api/admin/settings', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (x) {
var st = (x && x.settings) || {};
var arr = [];
try { arr = JSON.parse(st.announcements || '[]') || []; } catch (e) { arr = []; }
var box = mask.querySelector('#ufAnnChips'); if (!box) return;
if (!arr.length) { box.innerHTML = '<span class="pm-hint">该列表暂无公告，可先到「设置公告」发一条</span>'; return; }
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
if (window.showToast) window.showToast(op === 'restore' ? '已恢复' : '已删除', 'success');
if (done) done();
} else if (window.showToast) window.showToast((x && x.msg) || '操作失败', 'error');
})
.catch(function () { if (window.showToast) window.showToast(window.T('netFail'), 'error'); });
}
function openRecycle() {
var old = document.getElementById('recycleMask'); if (old) old.remove();
var mask = document.createElement('div');
mask.className = 'modal-mask'; mask.id = 'recycleMask';
mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="数据缓存">' +
(window.__frag ? window.__frag.modalHead('数据缓存') : '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button><h2 class="modal-title">数据缓存</h2>') +
'<div class="rc-tools"><label class="rc-all"><input type="checkbox" id="rcAll" aria-label="全选"> 全选</label><input class="input" id="rcQ" type="search" autocomplete="off" placeholder="搜资源 / 分类 / 公告的名字"></div>' +

'<div class="batch-bar" id="rcBar"><span class="batch-count-label">已选 <b id="rcCount">0</b> 项</span>' +
'<div class="batch-group"><button type="button" class="batch-btn" id="rcRestoreAll">恢复选中</button>' +
'<button type="button" class="batch-btn danger" id="rcPurgeAll">彻底删除</button>' +
'<button type="button" class="batch-btn" id="rcClearSel">取消选中</button></div></div>' +
'<div class="form" id="rcBody">' +
'<p class="imp-lead">删除的资源、分类、公告在这里保留 60 天，到期自动彻底清除。</p>' +
'<div style="padding:10px 0">' + '<div class="sk-line" style="height:34px;border-radius:8px;margin-bottom:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '<div class="sk-line" style="height:34px;border-radius:8px;margin-bottom:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '<div class="sk-line" style="height:34px;border-radius:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' + '</div></div></div>' ;
document.body.appendChild(mask);
requestAnimationFrame(function () {
mask.classList.add('open');
try { var xb = mask.querySelector('[data-x]'); if (xb) xb.focus({ preventScroll: true }); } catch (eF) {}
});
if (window.lockBodyScroll) window.lockBodyScroll(true);
mask.addEventListener('click', function (e) {
if (e.target === mask || e.target.closest('[data-x]')) { mask.classList.remove('open'); setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200); }
});

var RC = { items: [], q: '', onlyExpiring: false, page: 1, render: null, ready: false };
var _rcQ = mask.querySelector('#rcQ');
if (_rcQ) _rcQ.addEventListener('input', function () {
RC.q = String(this.value || '').trim();
RC.page = 1;
if (RC.render) RC.render();
});
fetch('/api/admin/recycle', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (x) {
var body = mask.querySelector('#rcBody'); if (!body) return;
if (!x || !x.ok) { body.innerHTML = '<div class="imp-err">加载失败，请关掉重试</div>'; return; }

var _kindName = { product: '资源', category: '分类', ann: '公告' };

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
var lead = '<p class="imp-lead">删除的资源、分类、公告在这里保留 60 天，到期自动彻底清除。</p>';
if (!RC.items.length) {
bodyEl.innerHTML = lead + (window.__adminEmpty ? window.__adminEmpty('该回收站暂无内容', '删掉的资源、分类、公告会在这里保留 60 天，随时可以恢复') : '该回收站暂无内容');
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

if (typeof _syncSel === 'function') _syncSel();
};
RC.render();


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
window.showConfirm('删除', '删除后无法恢复（这条记录会被永久清掉），确定继续？', function (closeConfirm) { closeConfirm(); recycleCall(op, kind, id, function () { openRecycle(); }); });
} else recycleCall(op, kind, id, function () { openRecycle(); });
});
}).catch(function () { var body = mask.querySelector('#rcBody'); if (body) body.innerHTML = '<div class="imp-err">加载失败，请关掉重试</div>'; });
}


function openCronHelp() {
var old = document.getElementById('cronHelpMask'); if (old) old.remove();
var mask = document.createElement('div');
mask.className = 'modal-mask'; mask.id = 'cronHelpMask';
mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="自动采集">' +
'<button type="button" class="modal-close-x" aria-label="关闭" data-x="1"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
'<div class="modal-title">自动采集</div>' +
'<p class="imp-lead">你录进去的平台，系统<b>每天自动全采一遍</b>，不用手动点，也不用配任何东西——和系统自带的「清理 60 天前数据」是同一个机制。</p>' +
'<div class="cron-step"><b>1</b><span>每天第一次有人打开站点（前台或后台都算），系统就在后台把所有勾了「每天自动」的平台采一遍，页面不会变慢。</span></div>' +
'<div class="cron-step"><b>2</b><span>一次最多跑 15 秒左右；平台多的，这次没采完的下次访问自动接着采，不会漏。</span></div>' +
'<div class="cron-step"><b>3</b><span>同一个平台一天只自动采一次，重复的按标题自动跳过，不会把库塞满。</span></div>' +
'<div class="cron-step"><b>4</b><span>只抓列表信息（标题 / 封面 / 描述 / 下单链接）；详情长图仍然在你点「查看 / 上架」时按需补。</span></div>' +
'<div class="cron-status" id="cronStatus">正在读取今天的采集状态…</div>' +
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
line.push('<div class="cs-row"><span>上次自动</span><b>' + st.last.at + ' · ' + extra + '</b></div>');
} else if (st.lastAutoAt) {

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
btn.disabled = true; btn.textContent = '正在采…';
if (host) host.innerHTML = '<span class="cs-bad">正在采，平台多的要十几秒，别关窗口…</span>';
fetch('/api/cron/collect', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
.then(function (r) { return r.json(); })
.then(function (r) {
btn.disabled = false; btn.textContent = '再采一次';
if (window.showToast) window.showToast(r && r.ok ? ('采完了，新增 ' + ((r && r.added) || 0) + ' 个资源') : ((r && r.msg) || '采集失败'), r && r.ok ? 'success' : 'error');
load();
})
.catch(function () { btn.disabled = false; btn.textContent = '现在采一次'; if (window.showToast) window.showToast('网络中断，没采成', 'error'); load(); });
});
}


function openLogs() {
var old = document.getElementById('logsMask'); if (old) old.remove();
var mask = document.createElement('div');
mask.className = 'modal-mask'; mask.id = 'logsMask';
mask.innerHTML = '<div class="modal-box modal-wide" role="dialog" aria-modal="true" aria-label="操作日志">' +
(window.__frag ? window.__frag.modalHead('操作日志') : '<button type="button" class="modal-close-x" aria-label="关闭" data-x="1"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button><div class="modal-title">操作日志</div>') +
'<p class="imp-lead">记录谁在什么时候改了什么，保留 60 天。只记「改动类」动作（新增 / 编辑 / 删除 / 批量操作 / 登录），浏览不计。</p>' +

'<div class="logs-range" id="logsRange">' +
'<span class="logs-range-t">时间范围</span>' +
'<button type="button" class="logs-rbtn" data-days="1">今天</button>' +
'<button type="button" class="logs-rbtn on" data-days="7">近 7 天</button>' +
'<button type="button" class="logs-rbtn" data-days="30">近 30 天</button>' +
'</div>' +
'<div class="logs-daily" id="logsDaily"><div class="logs-d-empty">正在统计…</div></div>' +
'<div class="logs-tools">' +
'<input class="input" id="logsQ" type="search" autocomplete="off" placeholder="搜动作或对象，比如 删除 / 分类 / 资源">' +
'<button type="button" class="btn-blue btn-inline" id="logsGo">搜索</button>' +
'</div>' +
'<div class="logs-body" id="logsBody"><div class="extc-loading">正在读取…</div></div>' +
'<div class="uni-pager" id="logsPager"></div>' +
'<div class="modal-footer"><button type="button" class="modal-close" data-x="1">关闭</button></div>' +
'</div>';
document.body.appendChild(mask);
requestAnimationFrame(function () { mask.classList.add('open'); });
if (window.syncBodyLock) window.syncBodyLock();

var close = function () {
mask.classList.remove('open');
setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180);
};
mask.addEventListener('click', function (e) { if (e.target === mask || (e.target.closest && e.target.closest('[data-x]'))) close(); });

var page = 1, q = '', days = 7, who = '';
var RANGE_TXT = { 1: '今天', 7: '近 7 天', 30: '近 30 天' };
function bjTime(v) {
var d = new Date(String(v || '').replace(' ', 'T') + 'Z');
if (isNaN(d.getTime())) return String(v || '');
return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}


function paintSum(sm) {
var box = mask.querySelector('#logsDaily');
if (!box) return;
sm = sm || {};
var people = sm.people || [], acts = sm.actions || [], byDay = sm.byDay || [];
if (!sm.total) {
box.innerHTML = '<div class="logs-d-empty">' + RANGE_TXT[days] + '没有操作记录</div>';
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
var ah = acts.map(function (a) { return '<span class="logs-act">' + esc(a.action || '') + ' <b>' + a.n + '</b></span>'; }).join('');
var dh = byDay.slice(0, 10).map(function (x) { return '<span class="logs-day">' + esc(String(x.day || '').slice(5)) + ' <b>' + x.n + '</b></span>'; }).join('');
box.innerHTML =
'<div class="logs-d-head"><b>' + RANGE_TXT[days] + '操作日报</b>' +
'<span>共 ' + sm.total + ' 条 · ' + people.length + ' 人参与</span>' +
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
: (who ? '该账号在这段时间没有操作记录' : '该列表暂无操作记录。改一次设置或删一条资源，这里就会出现。')) + '</div>';
} else {
body.innerHTML = list.map(function (r) {
return '<div class="log-row" data-who="' + esc(r.who || 'admin') + '">' +
'<span class="log-t">' + esc(bjTime(r.at)) + '</span>' +
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
}

function load() {
var body = mask.querySelector('#logsBody');
body.innerHTML = '<div class="extc-loading">正在读取…</div>';

fetch('/api/admin/logs?page=' + page + '&size=20&days=' + days
+ '&q=' + encodeURIComponent(q) + '&who=' + encodeURIComponent(who),
{ credentials: 'same-origin', cache: 'no-cache' })
.then(function (r) { return r.json(); })
.then(function (d) { if (!d || !d.ok) throw new Error((d && d.msg) || '读取失败'); paint(d); })
.catch(function (e) { body.innerHTML = '<div class="imp-err">' + esc(e.message || '读取失败，请重试') + '</div>'; });
}


var rangeEl = mask.querySelector('#logsRange');
if (rangeEl) rangeEl.addEventListener('click', function (e) {
var b = e.target.closest && e.target.closest('.logs-rbtn'); if (!b) return;
days = Number(b.getAttribute('data-days')) || 7;
page = 1;
mask.querySelectorAll('.logs-rbtn').forEach(function (x) { x.classList.toggle('on', x === b); });
load();
});

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
load();
}


(function wait() {

var panel = document.getElementById('panel-settings');
if (panel && !document.getElementById('batchImportBtn')) {


var btnHtml = function (id, lab, extra) {
return '<button type="button" class="row-btn" id="' + id + '"' + (extra || '') + '>' + lab + '</button>';
};
var row = function (lab, btnStr) { return '<div class="setting-row is-inline"><label>' + lab + '</label>' + btnStr + '</div>'; };
var mkGroup = function (title, rowsHtml) {
var g = document.createElement('div');
g.className = 'setting-group';
g.innerHTML = '<h3>' + title + '</h3>' + rowsHtml;
panel.appendChild(g);
return g;
};
mkGroup('内容管理', row('批量导入（Excel 一次导多条）', btnHtml('batchImportBtn', '批量导入', '', 1))
+ row('数据缓存（删除的内容保留 60 天）', btnHtml('recycleBtn', '数据缓存'))
+ row('每天自动采集（录进去的平台全部自动采）', btnHtml('cronBtn', '自动采集')));
panel.querySelector('#cronBtn').addEventListener('click', function () { openCronHelp(); });
mkGroup('系统维护', row('系统体检（图片/外链/环境检查）', btnHtml('imgCheckBtn', '系统体检', '', 1)));
var accGrp = mkGroup('账号与安全', row('子账号权限与冻结', btnHtml('usersBtn', '账号管理', ' data-perm="users"', 1))
+ row('谁改了什么（保留 60 天）', btnHtml('logsBtn', '操作日志', ' data-perm="users"')));
var grp = accGrp;

try {
var pwdGrp = document.getElementById('pwdGroup');
if (pwdGrp) { pwdGrp.className = ''; pwdGrp.style.marginTop = '6px'; accGrp.appendChild(pwdGrp); }
} catch (eP) { if (window.__silent) window.__silent(eP); }
panel.querySelector('#batchImportBtn').addEventListener('click', openWizard);
panel.querySelector('#imgCheckBtn').addEventListener('click', function () { try { this.querySelector('.dot-badge') && this.querySelector('.dot-badge').remove(); } catch (eC) {} sysCheck(); });
panel.querySelector('#recycleBtn').addEventListener('click', openRecycle);
panel.querySelector('#usersBtn').addEventListener('click', openUsers);
var _lgBtn = panel.querySelector('#logsBtn');
if (_lgBtn) _lgBtn.addEventListener('click', function () { openLogs(); });


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


try {

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
if (window.__syscheckAlertChanged) window.__syscheckAlertChanged();
}
}).catch(function () {});
}, 8000);
}
}
} catch (eA) { if (window.__silent) window.__silent(eA); }
return;
}
setTimeout(wait, 300);
})();
})();
