var _bindingsVariant = null;
var __bindingsCache = {};
function __saveBindingsCache() { try { sessionStorage.setItem('wnzyq_admin_bindings', JSON.stringify(__bindingsCache)); } catch (e) { if (window.__silent) window.__silent(e); } }
function __loadBindingsCache() { try { var b = JSON.parse(sessionStorage.getItem('wnzyq_admin_bindings') || '{}'); if (b && Object.keys(b).length) __bindingsCache = b; } catch (e) { if (window.__silent) window.__silent(e); } }
function prefetchBindings() {
api('admin/bindings?prefetch=1').then(function (res) {
if (res && res.ok && res.map) { __bindingsCache = res.map; __saveBindingsCache(); }
});
}
var _bindingsPage = 1;
function openBindings(v) {
_bindingsVariant = v;
_bindingsPage = 1;
document.getElementById('bindingsTitle').textContent = '资源码详情（' + (v.name || '(未命名)') + '）';
document.getElementById('bindingsMask').classList.add('open');

if (window.__modalScroll) __modalScroll.open(document.getElementById('bindingsMask'), v.id);
var _hit = __bindingsCache[v.id];
if (_hit) renderBindings(_hit);
else {

var _bTb = document.getElementById('bindingsRows');
_bTb.innerHTML = '';
var _bFrag = document.createDocumentFragment();
for (var _bi = 0; _bi < 20; _bi++) {
var _bTr = document.createElement('tr');
_bTr.className = 'skel admin-skel';
_bTr.setAttribute('aria-hidden', 'true');
var _bCells = '';
for (var _bc = 0; _bc < 7; _bc++) _bCells += '<td><span class="sk-line' + (_bc === 0 ? ' w70' : ' w95') + '"></span></td>';
_bTr.innerHTML = _bCells;
_bFrag.appendChild(_bTr);
}
_bTb.appendChild(_bFrag);
refreshBindings(v.id);
}
}

var _bindingsMerged = [];
function __buildBindingsMerged(res) {
var rows = res.list || [];
var issues = res.issues || [];
var byCode = {};
issues.forEach(function (it) { byCode[String(it.code).toLowerCase()] = it; });
var merged = [];
issues.forEach(function (it) {
var bs = rows.filter(function (r) { return String(r.code || '').toLowerCase() === String(it.code).toLowerCase(); });
if (!bs.length) { merged.push({ issue: it, binding: null }); return; }
bs.forEach(function (b) { merged.push({ issue: it, binding: b }); });
});
var legacy = rows.filter(function (r) { return !byCode[String(r.code || '').toLowerCase()]; });
legacy.sort(function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); });
legacy.forEach(function (b) { merged.push({ issue: null, binding: b }); });
return merged;
}
function renderBindings(res) {
var issues = res.issues || [];
var summary = document.getElementById('bindingsSummary');
var _st = { wait: 0, used: 0, exp: 0 };
issues.forEach(function (it) {
if (it.status === '待用') _st.wait++;
else if (it.status === '已用') _st.used++;
else _st.exp++;
});
summary.textContent = '已绑定 ' + (res.cur_count || 0) + ' / 待绑定 ' + _st.wait + ' / 已过期 ' + _st.exp + ' / 资源码绑定上限 ' + res.limit;
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

if ((codeCopy && codeCopy.disabled) || (codeVal && codeVal.disabled) || window.__issueInFlight) return;
if (codeCopy) { codeCopy.disabled = true; codeCopy.textContent = '发码中'; }
if (codeVal) { codeVal.disabled = true; codeVal.textContent = '发码中'; }
__issueCode(_bindingsVariant, function () {
refreshBindings(_bindingsVariant.id);
loadVariants(state.editingId);
});
};
codeVal.onclick = _copyCode;
codeCopy.onclick = _copyCode;
if (codeCopy && codeCopy.textContent === '发码中') codeCopy.textContent = '复制并发新码';
} else {
codeBox.style.display = 'none';
}
_bindingsMerged = __buildBindingsMerged(res);
renderBindingsPage();
}

function renderBindingsPage() {
var PER = (window.WN_CONST && window.WN_CONST.ADMIN_PAGE_SIZE) || 20;
var total = _bindingsMerged.length;
var totalPages = Math.max(1, Math.ceil(total / PER));
if (_bindingsPage > totalPages) _bindingsPage = totalPages;
if (_bindingsPage < 1) _bindingsPage = 1;
var tbody = document.getElementById('bindingsRows');
tbody.innerHTML = '';
var pager = document.getElementById('bindingsPager');

if (!total) {
tbody.innerHTML = '<tr><td colspan="7">' + window.__adminEmpty('该类型暂无资源码与绑定设备', '访客输入正确资源码后将自动绑定其设备') + '</td></tr>';
if (pager) pager.innerHTML = '';
return;
}
var start = (_bindingsPage - 1) * PER;
_bindingsMerged.slice(start, start + PER).forEach(function (m) {
var tr = document.createElement('tr');
var mk = function (txt) { var td = document.createElement('td'); td.textContent = txt; return td; };
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
tdCode.style.cssText = 'color:var(--text-faint);font-size:12px;';
tdCode.textContent = '早期绑定';
tdCode.title = 'R221 复制即换码上线前的存量绑定，无发码记录';
}
tr.appendChild(tdCode);
var tdStatus = document.createElement('td');
var _spTxt = '', _spColor = '';
if (m.binding) { _spTxt = '已绑定'; _spColor = 'var(--green-strong)'; }
else if (m.issue && m.issue.status === '待用') { _spTxt = '剩 ' + m.issue.remaining_days + ' 天'; _spColor = '#1e88e5'; }
else if (m.issue) { _spTxt = '已过期'; _spColor = '#999'; }
if (_spTxt) {
var sp = document.createElement('span');
sp.style.color = _spColor;
sp.textContent = _spTxt;
tdStatus.appendChild(sp);
} else { tdStatus.textContent = ''; }
tr.appendChild(tdStatus);
tr.appendChild(mk(m.issue ? window.__utcToLocal(m.issue.issued_at) : ''));

var mkTime = function (iso, txt) {
var td = document.createElement('td');
if (!txt) return td;
var t = document.createElement('time');
try { if (iso) t.setAttribute('datetime', String(iso)); } catch (e) { if (window.__silent) window.__silent(e); }
t.textContent = txt;
td.appendChild(t);
return td;
};
tr.appendChild(mk(m.binding ? ((m.binding.device || '-') + (m.binding.ua ? ' · ' + m.binding.ua : '')) : ''));
tr.appendChild(mkTime(m.binding ? m.binding.created_at : '', m.binding ? window.__utcToLocal(m.binding.created_at) : ''));
tr.appendChild(mkTime(m.binding ? m.binding.last_access : '', m.binding ? window.__utcToLocal(m.binding.last_access) : ''));
var tdOp = document.createElement('td');
if (m.binding) {
var unBtn = document.createElement('button');
unBtn.className = 'row-btn danger';
unBtn.textContent = '解绑';
(function (bid) {
unBtn.addEventListener('click', function () {
showConfirm('解绑设备', '确定解绑该设备？解绑后此设备需重新输入资源码才能解锁（其它设备不受影响）。', function (closeConfirm) {
api('admin/bindings/' + bid, { method: 'DELETE' }).then(function (res2) {
closeConfirm();
if (res2 && res2.ok) { toast('已解绑', 'success'); refreshBindings(_bindingsVariant && _bindingsVariant.id); loadVariants(state.editingId); }
else toast((res2 && res2.msg) || '解绑失败', 'error');
}).catch(function () { closeConfirm(); toast('解绑失败，请重试', 'error'); });
});
});
})(m.binding.id);
tdOp.appendChild(unBtn);
} else { tdOp.textContent = ''; }
tr.appendChild(tdOp);
tbody.appendChild(tr);
});
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

function refreshBindings(variantId) {
api('admin/bindings?variant_id=' + variantId).then(function (res) {
if (!res || !res.ok) {
if (!__bindingsCache[variantId]) document.getElementById('bindingsRows').innerHTML = '<tr><td colspan="7" style="color:var(--text-faint);">网络没连上，稍后再试</td></tr>';
return;
}
__bindingsCache[variantId] = res;
__saveBindingsCache();
var _open = document.getElementById('bindingsMask').classList.contains('open');
if (_open && _bindingsVariant && _bindingsVariant.id === variantId) renderBindings(res);
});
}

function delVariant(id) {

var _snapV = (state.variants || []).slice();
var _removedV = (state.variants || []).filter(function (x) { return x.id === id; })[0];
var _rmIdx = _snapV.indexOf(_removedV);
var _doLocalRemove = function () {
state.variants = (state.variants || []).filter(function (x) { return x.id !== id; });
var _dvp = (state.products || []).find(function (x) { return x.id === state.editingId; });
if (_dvp) _dvp.variants = (state.variants || []).slice();
var __vi = variantListEl.querySelector('.variant-item[data-vid="' + id + '"]');

var __post7 = function () { renderVariants(); };
if (__vi) { __vi.style.transition = 'opacity var(--dur-fast, .10s) ease'; __vi.style.opacity = '0'; setTimeout(__post7, 120); }
else __post7();
};
var _restoreV = function () {
state.variants = _snapV.slice();
var _dvp2 = (state.products || []).find(function (x) { return x.id === state.editingId; });
if (_dvp2) _dvp2.variants = (state.variants || []).slice();
renderVariants();
};
_doLocalRemove();
__undoable(

'已删除类型「' + ((_removedV && _removedV.name) || '未命名') + '」· 10 秒后正式清除',
function () {
if (!state.editingId) return;
api('admin/variants/' + id, { method: 'DELETE' }).then(function (res) {
if (res && res.ok) { if (state.editingId) loadVariants(state.editingId); }
else { toast((res && res.msg) || '删除失败', 'error'); _restoreV(); }
}).catch(function () { toast(window.T('delFail'), 'error'); _restoreV(); });
},
_restoreV
);
void _rmIdx;
}

variantCancel.addEventListener('click', function () { try { if (window.__fcSweepEdit) window.__fcSweepEdit(variantMask); } catch (e) {} variantDraftPending = false; variantMask.classList.remove('open'); });
variantMask.addEventListener('click', function (e) { if (e.target === variantMask) { variantDraftPending = true; variantMask.classList.remove('open'); } });

function fmtDay(s) { var p = String(s || '').split('-'); return p.length >= 3 ? String(Number(p[2])) : s; }
function fmtPointLabel(day) {
var s = String(day == null ? '' : day);
if (s.indexOf('-') >= 0) { var p = s.split('-'); if (p.length >= 3) return Number(p[1]) + '月' + Number(p[2]) + '日'; return s; }
var n = Number(s); return (isNaN(n) ? s : n) + '时';
}

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
var ln = document.createElementNS(SVG_NS, 'line');
ln.setAttribute('x1', px); ln.setAttribute('x2', px);
ln.setAttribute('y1', yTop); ln.setAttribute('y2', yBot);
ln.setAttribute('stroke', '#c3ccd9'); ln.setAttribute('stroke-width', '1'); ln.setAttribute('stroke-dasharray', '3 3');
g.appendChild(ln);
var lines = [{ text: fmtPointLabel(d.day), color: '#555', center: true }];
[
{ name: '浏览', key: 'views', color: '#1E88E5' },
{ name: '咨询客服', key: 'contacts', color: '#ff9900' },
{ name: '解锁', key: 'resource_unlocks', color: '#4CAF50' }
].forEach(function (s) {
var txt = s.name + ': ' + (d[s.key] || 0);
var prevTxt = (lineHover.hasPrev && p && p[i]) ? '（上期 ' + (p[i][s.key] || 0) + '）' : '';
lines.push({ text: txt, color: s.color, right: prevTxt });
});
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
if (l.center) {
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

function renderLineChart(trend, prev) {
var svg = document.getElementById('lineSvg');
if (!svg || !trend || !trend.length) { svg.innerHTML = ''; return; }
var _ax = 10, _asr = svg.getBoundingClientRect(); if (_asr && _asr.width) _ax = +(10 * 800 / _asr.width).toFixed(2);
var W = 800, H = 200, padL = 40, padR = 20, padT = 20, padB = 30;
try { svg.dataset.padT = padT; } catch (e0) { if (window.__silent) window.__silent(e0); }
var chartW = W - padL - padR, chartH = H - padT - padB;
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
for (var g = 0; g <= 4; g++) {
var gy = padT + (chartH / 4) * g;
var gval = Math.round(maxVal - (maxVal / 4) * g);
html += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="var(--border)" stroke-width="1"/>';
html += '<text x="' + (padL - 6) + '" y="' + (gy + 0.44 * _ax) + '" text-anchor="end" font-size="' + _ax + '" fill="var(--text-light)">' + gval + '</text>';
}
trend.forEach(function (d, i) {
var px = pt(i, 0).x;
var label = d.day ? fmtDay(d.day) : '';
if (trend.length <= 10 || i % Math.ceil(trend.length / 8) === 0) {
html += '<text x="' + px + '" y="' + (H - 8) + '" text-anchor="middle" font-size="' + _ax + '" fill="#999">' + label + '</text>';
}
});
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
}
var pathV = '';
trend.forEach(function (d, i) { var p = pt(i, d.views); pathV += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
html += '<path d="' + pathV + '" fill="none" stroke="#1E88E5" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
var pathC = '';
trend.forEach(function (d, i) { var p = pt(i, d.contacts); pathC += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
html += '<path d="' + pathC + '" fill="none" stroke="#ff9900" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
var pathR = '';
trend.forEach(function (d, i) { var p = pt(i, d.resource_unlocks || 0); pathR += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
html += '<path d="' + pathR + '" fill="none" stroke="#4CAF50" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
trend.forEach(function (d, i) {
var pv = pt(i, d.views);
var pc = pt(i, d.contacts);
var pr = pt(i, d.resource_unlocks || 0);
html += '<circle cx="' + pv.x + '" cy="' + pv.y + '" r="3.5" fill="#fff" stroke="#1E88E5" stroke-width="2"><title>浏览: ' + d.views + '</title></circle>';
html += '<circle cx="' + pc.x + '" cy="' + pc.y + '" r="3.5" fill="#fff" stroke="#ff9900" stroke-width="2"><title>咨询客服: ' + d.contacts + '</title></circle>';
html += '<circle cx="' + pr.x + '" cy="' + pr.y + '" r="3.5" fill="#fff" stroke="#4CAF50" stroke-width="2"><title>资源码解锁: ' + (d.resource_unlocks || 0) + '</title></circle>';
});
svg.innerHTML = html;
lineHover.data = trend;
lineHover.prev = hasPrev ? prev : null;
lineHover.hasPrev = hasPrev;
lineHover.stepX = stepX;
ensureLineHover(svg);
if (!window.__rlInit) {
window.__rlInit = true;
window.addEventListener('resize', function () {
clearTimeout(window.__rlT);
window.__rlT = setTimeout(function () { try { if (window.__rerenderLine) window.__rerenderLine(); } catch (e) { if (window.__silent) window.__silent(e); } }, 200);
});
}
window.__rerenderLine = function () {
if (!lineHover.data || !lineHover.data.length) return;
try { renderLineChart(lineHover.data, lineHover.hasPrev ? lineHover.prev : null); } catch (e) { if (window.__silent) window.__silent(e); }
};
}


function xlsEscape(v) {
return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function downloadMultiSheetXLS(filename, sheets) {
var xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>';
xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
xml += '<Styles><Style ss:ID="c"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style></Styles>';
var usedNames = {};
sheets.forEach(function (sh) {
var nm = String(sh.name || 'Sheet').replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31) || 'Sheet';
var base = nm, k = 2;
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

xml += '</Table><x:WorksheetOptions xmlns:x="urn:schemas-microsoft-com:office:excel"><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>1</x:SplitHorizontal><x:TopRowBottomPane>1</x:TopRowBottomPane><x:ActivePane>2</x:ActivePane><x:Panes><x:Pane><x:Number>3</x:Number></x:Pane><x:Pane><x:Number>2</x:Number></x:Pane></x:Panes></x:WorksheetOptions></Worksheet>';
});
xml += '</Workbook>';
var blob = new Blob(['﻿', xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
var url = URL.createObjectURL(blob);
var a = document.createElement('a');
a.href = url; a.download = filename;
document.body.appendChild(a); a.click(); document.body.removeChild(a);

setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

var __exportStampState = { min: '', seq: 0 };
function __exportStamp() {

var d = new Date(); function pd(n) { return String(n).padStart(2, '0'); }
var min = '' + d.getFullYear() + pd(d.getMonth() + 1) + pd(d.getDate()) + '-' + pd(d.getHours()) + pd(d.getMinutes());
if (__exportStampState.min === min) { __exportStampState.seq++; } else { __exportStampState.min = min; __exportStampState.seq = 0; }
return min + (__exportStampState.seq > 0 ? '(' + (__exportStampState.seq + 1) + ')' : '');
}
function __xl(v) { return v == null ? '' : String(v); }


window.__downloadXLS = downloadMultiSheetXLS;
window.__exportStamp = __exportStamp;

function exportAllData() {
var btn = document.getElementById('exportBtn');
var btnOld = btn ? btn.textContent : '';
if (btn) { btn.disabled = true; if (window.__btnBusy) window.__btnBusy(btn, '导出中'); else btn.textContent = '导出中'; }
toast('正在准备导出，请稍候…', 'info');

var _indet = document.createElement('div');
_indet.className = 'wn-indet';
_indet.style.cssText = 'margin-top:6px;max-width:300px;';
_indet.innerHTML = '<i></i>';
if (btn && btn.parentNode) btn.parentNode.appendChild(_indet);
var done = function () { if (btn) { btn.disabled = false; btn.textContent = btnOld || '导出数据统计'; } try { if (_indet.parentNode) _indet.parentNode.removeChild(_indet); } catch (e) { if (window.__silent) window.__silent(e); } };
api('admin/export').then(function (res) {
if (!res || !res.ok) { toast((res && res.msg) || '导出失败：数据加载失败', 'error'); done(); return; }
try {
var L = window.__utcToLocal || function (t) { return t; };
var sheets = [];

var pRows = [['资源标题', '所属分类', '资源简介', '资源详情', '资源价格', '封面图片链接', '排序', '显示状态', '定时显示时间', '定时隐藏时间', '专属客服链接', '专属客服二维码', 'ID', '浏览量', '咨询客服', '资源码解锁', '绑定设备数', '创建时间']];
(res.products || []).forEach(function (p) {
pRows.push([
__xl(p.title), __xl(p.cat), __xl(p.desc), __xl(p.detail_text || ''), Number(p.price) || 0,
__xl(p.cover || p.img || ''), p.sort || 0, (p.is_online && !p.is_hidden) ? '显示' : '隐藏',
__xl(p.schedule_on || ''), __xl(p.schedule_off || ''), __xl(p.contact_url || ''), __xl(p.contact_qr || ''),
p.id, p.views || 0, p.contacts || 0, p.resource_unlocks || 0, p.bindings || 0, L(p.created_at)
]);
});
sheets.push({ name: '资源清单', rows: pRows });
var vRows = [['所属资源', '类型名称', '类型描述', '价格(元)', '当前资源码', '是否需要资源码', '是否隐藏', '绑定设备数', '排序']];
(res.variants || []).forEach(function (v) {
vRows.push([__xl(v.product_title), __xl(v.name), __xl(v.desc), Number(v.price) || 0, __xl(v.resource_code), v.resource_code ? '是' : (v.has_content ? '否(直接获取)' : '否'), v.is_hidden ? '是' : '否', v.bindings || 0, v.sort || 0]);
});
sheets.push({ name: '资源类型', rows: vRows });
var cRows = [['ID', '分类名称', '层级', '所属一级', '排序', '是否隐藏', '资源数']];
(res.categories || []).forEach(function (c) {
cRows.push([c.id, __xl(c.name), __xl(c.level), __xl(c.parent), c.sort || 0, c.is_hidden ? '是' : '否', c.product_count || 0]);
});
sheets.push({ name: '分类清单', rows: cRows });
var bRows = [['所属资源', '类型', '资源码', '绑定时间', '最近访问', '设备UA']];
(res.bindings || []).forEach(function (b) {
bRows.push([__xl(b.product_title), __xl(b.variant_name), __xl(b.code), L(b.created_at), L(b.last_access), __xl(b.ua)]);
});
sheets.push({ name: '绑定设备明细', rows: bRows });
var iRows = [['所属资源', '类型', '资源码', '发放时间', '状态', '剩余有效天数', '绑定时间']];
(res.issues || []).forEach(function (it) {
iRows.push([__xl(it.product_title), __xl(it.variant_name), __xl(it.code), L(it.issued_at), __xl(it.status), it.remaining_days || 0, it.bound_at ? L(it.bound_at) : '']);
});
sheets.push({ name: '发码记录', rows: iRows });
var tRows = [['日期', '浏览量', '咨询客服', '资源码解锁']];
(res.trend || []).forEach(function (d) { tRows.push([__xl(d.day), d.views || 0, d.contacts || 0, d.resource_unlocks || 0]); });
sheets.push({ name: '每日趋势', rows: tRows });
var sRows = [['资源名称', '浏览量', '咨询客服', '资源码解锁', '绑定设备']];
(res.byProduct || []).forEach(function (p) { sRows.push([__xl(p.title), p.views || 0, p.contacts || 0, p.resource_unlocks || 0, p.bindings || 0]); });
sheets.push({ name: '按资源统计', rows: sRows });
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


function fmtStatDelta(cur, prev) {
if (prev === 0 && cur === 0) return { text: '0%', cls: 'flat' };
if (prev === 0) return { text: '↑100%', cls: 'up' };
var pct = Math.round((cur - prev) / prev * 100);
if (pct === 0) return { text: '0%', cls: 'flat' };
return { text: (pct > 0 ? '↑' : '↓') + Math.abs(pct) + '%', cls: pct > 0 ? 'up' : 'down' };
}



function renderDaySum(trend) {
var box = document.getElementById('daySum');
if (!box) return;
try {
var list = trend || window.state && window.state.statsTrend || [];

var isDay = function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.day || '')); };
if (!list.length || !list.some(isDay)) {
if (!window.__daySumP) {
window.__daySumP = 1;
api('admin/stats?days=2').then(function (r2) {
window.__daySumP = 0;
if (r2 && r2.trend) renderDaySum(r2.trend);
}).catch(function () { window.__daySumP = 0; });
}
box.hidden = true; return;
}
var bj = function (d) { return new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10); };
var yest = bj(new Date(Date.now() - 86400e3));
var idx = -1;
for (var i = 0; i < list.length; i++) { if (String(list[i].day) === yest) { idx = i; break; } }
if (idx < 0) { box.hidden = true; return; }
var y = list[idx], pv = idx > 0 ? list[idx - 1] : null;
var num = function (v) { return Number(v || 0); };
var F = function (v) { return window.__fmtNum ? window.__fmtNum(v) : String(v); };
var d = function (a, b) { if (!pv) return ''; var n = num(a) - num(b); return n === 0 ? '（持平）' : (n > 0 ? '（+' + n + '）' : '（' + n + '）'); };
box.hidden = false;
box.innerHTML = '<b>昨天 ' + yest.slice(5) + '</b>'
+ '<span>访问 <i>' + F(num(y.views)) + '</i>' + d(y.views, pv && pv.views) + '</span>'
+ '<span>咨询 <i>' + F(num(y.contacts)) + '</i>' + d(y.contacts, pv && pv.contacts) + '</span>'
+ '<span>内容查看 <i>' + F(num(y.resource_unlocks)) + '</i>' + d(y.resource_unlocks, pv && pv.resource_unlocks) + '</span>';
} catch (e) { box.hidden = true; }
}
window.__renderDaySum = renderDaySum;

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
n.textContent = '0';
(function (__t, __n) {
if (!__t || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) { __n.textContent = window.__fmtNum ? window.__fmtNum(__t) : String(__t); return; }
var __t0 = null;
requestAnimationFrame(function __step(ts) {
if (__t0 === null) __t0 = ts;
var __p = Math.min(1, (ts - __t0) / 600);
var _v = Math.round(__t * (1 - Math.pow(1 - __p, 3)));
__n.textContent = window.__fmtNum ? window.__fmtNum(_v) : String(_v);
if (__p < 1) requestAnimationFrame(__step);
});
})(c.num, n);
var l = document.createElement('div');
l.className = 'label';
l.textContent = c.label;
d.appendChild(n);
d.appendChild(l);
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

function __bjToday() { return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); }
function __statsRangeDays(days) {
var end = __bjToday();
var ms = Date.parse(end + 'T00:00:00Z') - (days - 1) * 86400000;
return { start: new Date(ms).toISOString().slice(0, 10), end: end };
}
function __ensureTrendAll() {
if (state.statsTrendAll && state.statsTrendAll.length) return;
api('admin/stats').then(function (res) {
if (res && res.ok && res.trend && res.trend.length) {
state.statsTrendAll = res.trend;
state.statsTrendAllPrev = res.trend_prev || [];
}
}).catch(function () {});
}

function __updateStatTitles(startDate, endDate) {
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
}

var __statsCache = {};
function __prefetchStatsRanges() {
[1, 7, 30].forEach(function (d) {
var _end = __bjToday();
var _c = __statsCache[d];
if (_c && _c.end === _end) return;
var _r = d === 1 ? { start: _end, end: _end } : __statsRangeDays(d);
var _u = 'admin/stats?start_date=' + encodeURIComponent(_r.start) + '&end_date=' + encodeURIComponent(_r.end);
api(_u).then(function (res) {
if (res && res.ok) __statsCache[d] = { end: _end, res: res };
}).catch(function () {});
});
}
function loadStats(startDate, endDate, force, silent) {
if (!startDate && !endDate) {
var _r0 = __statsRangeDays(state.statsDays || 1);
startDate = _r0.start; endDate = _r0.end;
}
__ensureTrendAll();
__prefetchStatsRanges();
var url = 'admin/stats';
var params = [];
if (startDate) params.push('start_date=' + encodeURIComponent(startDate));
if (endDate) params.push('end_date=' + encodeURIComponent(endDate));
if (params.length) url += '?' + params.join('&');
__updateStatTitles(startDate, endDate);

if (!silent) {
var _stHasSkel = document.getElementById('statRows') && document.getElementById('statRows').querySelectorAll('.admin-skel').length > 0;
if (!_stHasSkel) renderStatSkeleton();

var _stb0 = document.getElementById('statRows');
if (_stb0 && !_stb0.children.length) renderStatSkeleton();
}
return api(url).then(function (res) { if (silent) __silentApplyStats(res); else __applyStatsRes(res); });
}

function __applyStatsRes(res) {
var _sec = document.getElementById('panel-stats');
if (_sec) {
var _ws = _sec.querySelectorAll('.stat-table-wrap');
if (_ws.length >= 3 && _ws[0].querySelector('h3') && _ws[0].querySelector('h3').textContent.indexOf('分类') !== -1) {
_sec.insertBefore(_ws[1], _ws[0]);
}
}
if (!res.ok) {
__clearAdminSkel(document.getElementById('statRows')); __clearAdminSkel(document.getElementById('statCatRows')); __clearAdminSkel(document.getElementById('statRecentRows'));
toast(res.msg || '网络没连上，稍后再试', 'error'); return; }
window.__lastFetchTime = Date.now();
var ov = res.overview || {};
var ovp = res.overview_prev || null;
state.statsOverview = ov; state.statsOverviewPrev = ovp;
renderStatCards(ov, ovp);

var allTrend = res.trend || [];
var allTrendPrev = res.trend_prev || [];
var days = state.statsDays || 7;
var trendData, trendPrev;
if (res.hourly && res.hourly.length) {
trendData = res.hourly.map(function (h) {
return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
});
trendPrev = (res.hourly_prev && res.hourly_prev.length === res.hourly.length) ? res.hourly_prev.map(function (h) {
return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
}) : null;
} else {
trendData = allTrend.slice(-days);
trendPrev = allTrendPrev.length ? allTrendPrev.slice(-days) : null;
}
state.statsTrend = trendData;
try { renderDaySum(trendData); } catch (eDS) {}
state.statsTrendPrev = trendPrev || null;
state.statsByProduct = res.byProduct || [];
renderLineChart(trendData, state.statsCmpPrev ? trendPrev : null);



state.statByProduct = res.byProduct || [];
state.statByCategory = res.byCategory || [];
state.statRecent = res.recent || [];
renderStatTables();

__saveAdminState();
}

function __silentApplyStats(res) {
if (!res || !res.ok) return;
window.__lastFetchTime = Date.now();
var _ts = function (x) { try { return JSON.stringify(x || []); } catch (e) { return ''; } };
if (_ts(res.byProduct) !== _ts(state.statByProduct)) { state.statByProduct = res.byProduct || []; renderStatTables('product'); }
if (_ts(res.byCategory) !== _ts(state.statByCategory)) { state.statByCategory = res.byCategory || []; renderStatTables('cat'); }
if (_ts(res.recent) !== _ts(state.statRecent)) { state.statRecent = res.recent || []; renderStatTables('recent'); }
var ov = res.overview || {};
state.statsOverview = ov; state.statsOverviewPrev = res.overview_prev || null;
renderStatCards(ov, res.overview_prev || null);
var allTrend = res.trend || [];
var allTrendPrev = res.trend_prev || [];
var days = state.statsDays || 7;
var trendData, trendPrev;
if (res.hourly && res.hourly.length) {
trendData = res.hourly.map(function (h) {
return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
});
trendPrev = (res.hourly_prev && res.hourly_prev.length === res.hourly.length) ? res.hourly_prev.map(function (h) {
return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
}) : null;
} else {
trendData = allTrend.slice(-days);
trendPrev = allTrendPrev.length ? allTrendPrev.slice(-days) : null;
}
state.statsTrend = trendData;
state.statsTrendPrev = trendPrev || null;
state.statsByProduct = res.byProduct || [];
renderLineChart(trendData, state.statsCmpPrev ? trendPrev : null);

__saveAdminState();
}


function loadAdminHome(silent) {
var cachedVersion = '';
try {
var cache = sessionStorage.getItem('wnzyq_admin_data');
if (cache) {
var c = JSON.parse(cache);
cachedVersion = c.version || '';
}
} catch (e) { if (window.__silent) window.__silent(e); }
return api('admin/dashboard?v=' + encodeURIComponent(cachedVersion), { timeout: 30000 }).then(function (res) {
if (res && res.unchanged === true) {
window.__lastFetchTime = Date.now();
if (state._backendPaged === undefined) state._backendPaged = true;
return;
}
if (!res || !res.ok) {
if (!silent) toast(window.T('netFail'), 'error');
return;
}
if (res.products) {
state.products = res.products.list || [];
state.totalProducts = res.products.total || 0;
state.totalProductPages = res.products.total_pages || 1;
state.currentProductPage = res.products.page || 1;
state._backendPaged = true;
}
if (res.categories) {
state.categories = res.categories;
}
if (res.settings) {
state.settings = res.settings;
}
if (res.stats) {
var sr = res.stats;
state.statsOverview = sr.overview || {};
state.statsOverviewPrev = sr.overview_prev || null;
if (sr.trend && sr.trend.length) {
state.statsTrendAll = sr.trend || [];
state.statsTrendAllPrev = sr.trend_prev || [];
state.statByProduct = sr.byProduct || [];
state.statByCategory = sr.byCategory || [];
state.statRecent = sr.recent || [];
var days = state.statsDays || 7;
var trendData, trendPrev;
if (sr.hourly && sr.hourly.length) {
trendData = sr.hourly.map(function (h) {
return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
});
trendPrev = (sr.hourly_prev && sr.hourly_prev.length === sr.hourly.length) ? sr.hourly_prev.map(function (h) {
return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
}) : null;
} else {
trendData = (sr.trend || []).slice(-days);
trendPrev = (sr.trend_prev || []).length ? sr.trend_prev.slice(-days) : null;
}
state.statsTrend = trendData;
state.statsTrendPrev = trendPrev || null;
state.statsByProduct = sr.byProduct || [];
renderStatCards(state.statsOverview, state.statsCmpPrev ? state.statsOverviewPrev : null);
renderLineChart(trendData, state.statsCmpPrev ? trendPrev : null);

renderStatTables();
} else {
renderStatCards(state.statsOverview, state.statsCmpPrev ? state.statsOverviewPrev : null);
}
}
state._homeVersion = res.version || '';
__saveAdminState();
renderProducts();
renderCategories();
refreshCatCnts();
if (state.settings) {
_safe(function () { if (window.__infoApply) window.__infoApply(state.settings); document.getElementById('annMode').value = state.settings.announcement_mode || 'always'; syncSelectDisplay(document.getElementById('annMode')); if (window.__annModeHint) window.__annModeHint(); });
}
window.__lastFetchTime = Date.now();
__preloadAdminCategoryPages();
}).catch(function (e) {
window.__adminSkelP = false;
__clearAdminSkel(document.getElementById('productList'));
__clearAdminSkel(document.getElementById('catList'));
var _em = document.getElementById('productEmpty');
if (_em && !(state.products || []).length) { _em.classList.add('show'); var _et = document.getElementById('productEmptyTitle'); if (_et) _et.textContent = __getAdminEmptyText(); }
var _hasCache = __getAdminCache()._cacheFormat === 'v317' && (__getAdminCache().products || []).length;
if (!silent && !_hasCache && !(state.products || []).length) {
toast(window.T('netFail'), 'error');
}
});
}

function __preloadAdminCategoryPages() {
var cats = (state.categories || []).filter(function (c) { return !c.parent_id || Number(c.parent_id) === 0; });
var totalItems = (state.products || []).length + cats.length;
if (totalItems > 500) {

return;
}
cats.forEach(function (c) {
if (Number(c.id) === 0) return;
var _k = __adminProductCacheKey(1, '', String(c.id), '');
if (__adminProductCache[_k]) return;
var _qs = '?page=1&page_size=' + ADMIN_PAGE_SIZE + '&cid=' + encodeURIComponent(c.id);
api('admin/products' + _qs).then(function (res) {
if (res && res.ok) {
__adminProductCache[_k] = {
products: res.list || [],
totalPages: res.total_pages || 1,
total: res.total || 0,
_backendPaged: true,
timestamp: Date.now()
};
}
}).catch(function () {});
});
}

var STAT_PAGE_SIZE = (window.WN_CONST && window.WN_CONST.ADMIN_PAGE_SIZE) || 20;
var statPages = { product: 1, cat: 1, recent: 1 };
[['statTglProduct', 'statBodyProduct'], ['statTglCat', 'statBodyCat'], ['statTglRecent', 'statBodyRecent']].forEach(function (pair) {
var tglBtn = document.getElementById(pair[0]), tglBody = document.getElementById(pair[1]);
if (!tglBtn || !tglBody) return;
tglBtn.addEventListener('click', function () {
var collapsed = tglBody.classList.toggle('collapsed');
tglBtn.classList.toggle('open', !collapsed);
});
});

function renderStatTables(onlyKey) {


function __escCell(v) { return window.escapeHtml ? window.escapeHtml(v) : String(v == null ? '' : v); }

function F2(v) { var n = Number(v || 0); return window.__fmtNum ? window.__fmtNum(n) : String(n); }
var defs = [
{
key: 'product', tbodyId: 'statRows', pagerId: 'statPagerProduct', wrapId: 'statWrapProduct',
list: state.statByProduct || [],
row: function (r) {
var tr = document.createElement('tr');
var status = (r.is_online && !r.is_hidden) ? '显示' : '隐藏';
tr.innerHTML = '<td>' + __escCell(r.title || '(无标题)') + '</td><td>' + status + '</td><td>' + F2(r.views) + '</td><td>' + F2(r.contacts) + '</td><td>' + F2(r.resource_unlocks) + '</td><td>' + F2(r.bindings) + '</td>';
return tr;
}
},
{
key: 'cat', tbodyId: 'statCatRows', pagerId: 'statPagerCat', wrapId: 'statWrapCat',
list: state.statByCategory || [],
row: function (r) {
var tr = document.createElement('tr');
tr.innerHTML = '<td>' + __escCell(r.name || '') + '</td><td>' + F2(r.product_count) + '</td><td>' + F2(r.total_views) + '</td>';
return tr;
}
},
{
key: 'recent', tbodyId: 'statRecentRows', pagerId: 'statPagerRecent', wrapId: 'statWrapRecent',
list: state.statRecent || [],
row: function (r) {
var tr = document.createElement('tr');
var typeText = r.type === 'view' ? '浏览' : (r.type === 'contact' ? '咨询客服' : (r.type === 'resource_unlock' ? '资源码解锁' : r.type));
tr.innerHTML = '<td>' + __escCell(window.__utcToLocal(r.created_at)) + '</td><td>' + __escCell(typeText) + '</td><td>' + __escCell(r.title || '') + '</td>';
return tr;
}
}
];
defs.forEach(function (d) {
if (onlyKey && d.key !== onlyKey) return;
var tbody = document.getElementById(d.tbodyId);
var pager = document.getElementById(d.pagerId);
if (!tbody || !pager) return;

var __skels = tbody.querySelectorAll('.admin-skel'); var __reuse = __skels.length > 0;
if (!__reuse) tbody.innerHTML = '';
pager.innerHTML = '';
var totalPages = Math.ceil(d.list.length / STAT_PAGE_SIZE) || 1;
if (statPages[d.key] > totalPages) statPages[d.key] = totalPages;
if (statPages[d.key] < 1) statPages[d.key] = 1;
var start = (statPages[d.key] - 1) * STAT_PAGE_SIZE;
var frag = document.createDocumentFragment();

d.list.slice(start, start + STAT_PAGE_SIZE).forEach(function (r, ri) { var tr = d.row(r); tr.classList.add('stagger-in'); tr.style.animationDelay = Math.min(ri * 20, 180) + 'ms'; frag.appendChild(tr); });
if (__reuse) {
var __kids = Array.prototype.slice.call(frag.children);
var __k = 0;
for (; __k < __kids.length && __k < __skels.length; __k++) { if (__skels[__k] && __skels[__k].parentNode) __skels[__k].parentNode.replaceChild(__kids[__k], __skels[__k]); }
for (var __q = __k; __q < __skels.length; __q++) { if (__skels[__q] && __skels[__q].parentNode) __skels[__q].parentNode.removeChild(__skels[__q]); }
}
tbody.appendChild(frag);
if (totalPages > 1) {
if (window.buildUniPager) {
window.buildUniPager(pager, {
page: statPages[d.key],
totalPages: totalPages,
total: d.list.length,
unit: '条',
onPage: (function (key) {
return function (p) { statPages[key] = p; renderStatTables(key); };
})(d.key)
});
} else {
var prev = document.createElement('button');
prev.textContent = '上一页';
prev.disabled = statPages[d.key] === 1;
prev.onclick = (function (key, wrapId) {
return function () {
if (statPages[key] > 1) { statPages[key]--; renderStatTables(key); scrollStatWrap(wrapId); }
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
if (statPages[key] < totalPages) { statPages[key]++; renderStatTables(key); scrollStatWrap(wrapId); }
};
})(d.key, d.wrapId);
pager.appendChild(prev);
pager.appendChild(info);
pager.appendChild(next);
}
}
});
}
function scrollStatWrap(wrapId) {
return;
}

function applyStatsDays() {
if (!state.statsTrendAll || !state.statsTrendAll.length) { loadStats(); return; }
var days = state.statsDays || 7;
var trendData = state.statsTrendAll.slice(-days);
var allPrev = state.statsTrendAllPrev || [];
var trendPrev = allPrev.length ? allPrev.slice(-days) : null;
state.statsTrend = trendData;
state.statsTrendPrev = trendPrev || null;
renderLineChart(trendData, state.statsCmpPrev ? trendPrev : null);


}

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
if (cntEl) cntEl.textContent = (ref.totalCnt !== undefined ? ref.totalCnt : (ref.cnt || 0)) + ' 个资源';
});
}
}


window.loadCategories = loadCategories;

(function () {
var el = document.getElementById('catSearch');
if (!el) return;
var tmr = 0;
el.addEventListener('input', function () {
var v = this.value;
clearTimeout(tmr);
tmr = setTimeout(function () { window.__catQ = v; renderCategories(state.categories || []); }, 150);
});
el.addEventListener('search', function () { window.__catQ = this.value; renderCategories(state.categories || []); });
})();
function loadCategories(silent) { if (window.__catLoading) { if (!silent) window.__catLoading.then(function () { renderCategories(state.categories); }); return window.__catLoading; }

var _cbox0 = document.getElementById('catList');
if (!silent && _cbox0 && !_cbox0.children.length) { window.__catSkelP = true; renderCatSkeleton(); }
var _snapC = silent ? __adminCatSig(state.categories) : null;
window.__catLoading = api('admin/categories').then(function (res) { window.__catLoading = null;
if (!res.ok) {
if (!silent) { window.__catSkelP = false; __clearAdminSkel(_cbox0); toast(res.msg || '网络没连上，稍后再试', 'error'); }
return res; }
window.__lastFetchTime = Date.now();
var _ordered = orderCats((res.list || []).map(function (c) { return { id: Number(c.id), parent_id: Number(c.parent_id), name: c.name, sort: Number(c.sort) || 0, is_hidden: c.is_hidden, cnt: Number(c.cnt) || 0 }; }));
if (silent && __adminCatSig(_ordered) === _snapC) return res;
state.categories = _ordered;
refreshCatCnts();
window.__catSkelP = false;
renderCategories(state.categories);

try { if (typeof initFilterCatPicker === 'function') initFilterCatPicker(); } catch (eFC) { if (window.__silent) window.__silent(eFC); }
__saveAdminState();
return res;
});
return window.__catLoading;
}

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
list.forEach(function (c) {
if (c.parent_id !== 0 && !out.find(function (x) { return x.id === c.id; })) out.push(c);
});
return out;
}
function renderCategories(list) {

try {

var __catPanel = document.getElementById('panel-categories');
var __catVisible = __catPanel && __catPanel.style.display !== 'none';
if (__catVisible && !localStorage.getItem('wnzyq_cat_drag_tip')) {
localStorage.setItem('wnzyq_cat_drag_tip', '1');
setTimeout(function () { if (window.showToast) window.showToast('按住左边的六点可以拖动排序', 'info'); }, 600);
}
} catch (eT) {}
var box = document.getElementById('catList'); var _minH = box.offsetHeight; if (_minH > 0) box.style.minHeight = _minH + 'px';

var __q = String(window.__catQ || '').trim().toLowerCase();
if (__q) {
var __hit = {};
list.forEach(function (c) { if (String(c.name || '').toLowerCase().indexOf(__q) >= 0) __hit[c.id] = 1; });
list = list.filter(function (c) { return __hit[c.id] || __hit[c.parent_id]; });
if (!list.length) {
box.style.minHeight = '';
box.innerHTML = window.__adminEmpty ? window.__adminEmpty('该搜索暂无分类', '换个词试试，或清空搜索框看全部分类') : '该搜索暂无分类';
return;
}
}

var __skels = box.querySelectorAll('.admin-skel'); var __reuse = __skels.length > 0;
if (window.__catSkelP && !list.length) return;
if (!__reuse) box.innerHTML = '';

var topLevel = list.filter(function (c) { return c.parent_id === 0; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
var ordered = [];
topLevel.forEach(function (top) {
ordered.push(top);
if (top.id === 0) return;
if (!ordered.some(function (x) { return x.virtual && Number(x.parent_id) === Number(top.id); }) && !list.some(function (c) { return Number(c.parent_id) === Number(top.id) && String(c.name || '').trim() === '全部'; })) { var _vt = list.find(function (x) { return Number(x.id) === Number(top.id); }); ordered.push({ id: 'v' + top.id, parent_id: top.id, name: '全部', sort: -1, virtual: true, cnt: (_vt ? (_vt.totalCnt !== undefined ? _vt.totalCnt : (_vt.cnt || 0)) : 0) }); } list.filter(function (c) { return c.parent_id === top.id; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }).forEach(function (sub) {
ordered.push(sub);
});
});
list.filter(function (c) { return c.parent_id !== 0 && !topLevel.find(function (t) { return t.id === c.parent_id; }); })
.forEach(function (c) { ordered.push(c); });


var __pageRows = ordered, __catPager = null;
var __size = window.LIST_PAGE_SIZE || 20;
if (ordered.length > __size) {
var __groups = [], __cur = null;
ordered.forEach(function (c) {
if (c.parent_id === 0) { __cur = [c]; __groups.push(__cur); }
else if (__cur) __cur.push(c);
else { __cur = [c]; __groups.push(__cur); }
});
var __pages = [], __buf = [], __n = 0;
__groups.forEach(function (g) {
if (__n + g.length > __size && __buf.length) { __pages.push(__buf); __buf = []; __n = 0; }
__buf = __buf.concat(g); __n += g.length;
});
if (__buf.length) __pages.push(__buf);
window.__catPages = __pages;
var __p = Math.min(Math.max(1, parseInt(window.__catPage, 10) || 1), __pages.length);
window.__catPage = __p;
__pageRows = __pages[__p - 1];
__catPager = { page: __p, totalPages: __pages.length, total: ordered.length };

__reuse = false;
box.innerHTML = '';
} else { window.__catPages = null; window.__catPage = 1; }

__pageRows.forEach(function (c, ci) {
if (c.virtual) { var _vrow = document.createElement('div'); _vrow.className = 'cat-row cat-sub'; _vrow.dataset.id = c.id; _vrow.dataset.parentId = c.parent_id;
var _vh=document.createElement('span');_vh.className='drag-handle';_vh.draggable=false;_vh.classList.add('is-fixed');_vh.title='固定项不可拖动';_vh.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>'; _vrow.appendChild(_vh); var _vp=document.createElement('input'); _vp.type='checkbox'; _vp.disabled=true; _vp.className='cat-check is-fixed'; _vp.title='固定项不可选';_vp.setAttribute('aria-label','固定项不可选'); _vrow.appendChild(_vp); var _vts=document.createElement('span'); _vts.className='cat-spacer'; _vts.setAttribute('aria-hidden','true'); _vrow.appendChild(_vts); var _vnm = document.createElement('span'); _vnm.className = 'c-name is-virtual'; _vnm.textContent = '全部'; _vrow.appendChild(_vnm); var _vmeta = document.createElement('div'); _vmeta.className = 'c-meta'; var _vph = document.createElement('span'); _vph.className = 'row-btn'; _vph.className='row-btn is-slot'; _vph.textContent = '固定'; _vmeta.appendChild(_vph); var _vs = document.createElement('span'); _vs.className = 'c-sort'; _vs.textContent = '排序:1'; _vrow.appendChild(_vs); var _vcnt = document.createElement('span'); _vcnt.className = 'c-count'; _vcnt.textContent = (c.cnt || 0) + ' 个资源'; _vcnt.className='c-count is-muted'; _vcnt.title = '点击查看该分类下的资源'; _vcnt.addEventListener('click', function (e) { e.stopPropagation(); document.querySelector('.tab[data-tab="products"]').click(); initFilterCatPicker(); var _fc2 = document.getElementById('filterCat'); if (_fc2) { _fc2.value = c.parent_id; renderProducts(); } toast('已筛选分类：全部', 'success'); }); _vrow.appendChild(_vcnt); var _vedit = document.createElement('button'); _vedit.className = 'row-btn'; _vedit.textContent = '编辑'; _vedit.className='row-btn is-slot'; var _vdel = document.createElement('button'); _vdel.className = 'row-btn danger'; _vdel.textContent = '删除'; _vdel.className='row-btn danger is-slot'; _vmeta.appendChild(_vedit); _vmeta.appendChild(_vdel); _vrow.appendChild(_vmeta); if (state.catExpanded[c.parent_id] === false) { _vrow.style.display = 'none'; }
_vrow.classList.add('stagger-in'); _vrow.style.animationDelay = Math.min(ci * 20, 180) + 'ms';
if (__reuse && __skels[ci]) __skels[ci].parentNode.replaceChild(_vrow, __skels[ci]); else box.appendChild(_vrow);
return; }
var row = document.createElement('div');
row.className = 'cat-row';
row.draggable = false;
row.dataset.id = c.id; row.dataset.parentId = c.parent_id;
if (Number(c.id) !== 0) { var handle = document.createElement('span'); handle.className = 'drag-handle'; handle.draggable = true; handle.title = '拖动排序'; handle.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>'; row.appendChild(handle); }
else {
var _h0 = document.createElement('span'); _h0.className = 'drag-handle'; _h0.draggable = false; _h0.classList.add('is-fixed'); _h0.title = '固定项不可拖动'; _h0.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>'; row.appendChild(_h0);

var _cb0 = document.createElement('input'); _cb0.type = 'checkbox'; _cb0.disabled = true; _cb0.className = 'cat-check is-fixed';
_cb0.title = '固定项不可选';
_cb0.setAttribute('aria-label', '固定项不可选'); row.appendChild(_cb0);
var _ar0 = document.createElement('span'); _ar0.className = 'cat-spacer'; _ar0.setAttribute('aria-hidden', 'true'); row.appendChild(_ar0);
}
var isTop = c.parent_id === 0;
if (!isTop) row.classList.add('cat-sub');

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

if (Number(c.id) !== 0) {
if (String(c.name || '').trim() !== '全部') { var cb = document.createElement('input');
cb.type = 'checkbox';
cb.className = 'cat-check';
cb.dataset.id = c.id;
cb.style.cssText = 'width:20px;height:20px;cursor:pointer;flex-shrink:0;accent-color:var(--blue1);';
cb.checked = !!state.catSelected[c.id]; cb.addEventListener('change', function () { state.catSelected[c.id] = this.checked; updateCatBatchBar(); });
row.appendChild(cb); } else { var _cbp = document.createElement('span'); _cbp.style.cssText = 'width:20px;flex-shrink:0;'; _cbp.setAttribute('aria-hidden', 'true'); row.appendChild(_cbp); }
}

var meta = document.createElement('div');
meta.className = 'c-meta';

var name = document.createElement('span');
name.className = 'c-name';
name.style.fontWeight = isTop ? '700' : '400';
name.style.fontSize = isTop ? '16px' : '14px';
name.style.color = isTop ? 'var(--ink-strong, #1a1a1a)' : 'var(--ink-normal, #333)';
name.textContent = c.name;

if (isTop && c.id !== 0) {
var toggleBtn = document.createElement('span');
toggleBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;cursor:pointer;margin-right:4px;flex-shrink:0;color:var(--blue1);transition:transform 0.15s ease;user-select:none;filter:drop-shadow(0 1px 2px rgba(30,136,229,0.3));';
var hasChildren = list.some(function (sub) { return sub.parent_id === c.id; }) || ordered.some(function (x) { return x.virtual && Number(x.parent_id) === Number(c.id); });
if (hasChildren) {
toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:100%;height:100%;display:block"><path d="M7 10l5 5 5-5z"/></svg>';
toggleBtn.style.transform = state.catExpanded[c.id] === false ? 'rotate(-90deg)' : 'rotate(0deg)';
toggleBtn.title = state.catExpanded[c.id] === false ? '展开子分类' : '收起子分类';
} else {
toggleBtn.textContent = '•';
toggleBtn.style.cursor = 'default';
toggleBtn.style.color = 'var(--ink-disabled, #ccc)';
}
toggleBtn.addEventListener('click', function (e) {
e.stopPropagation();
if (!hasChildren) return;
state.catExpanded[c.id] = state.catExpanded[c.id] === false ? true : false;
var subRows = box.querySelectorAll('.cat-row[data-parent-id="' + c.id + '"]'); subRows.forEach(function (sr) { sr.style.display = state.catExpanded[c.id] ? '' : 'none'; }); toggleBtn.style.transform = state.catExpanded[c.id] === false ? 'rotate(-90deg)' : 'rotate(0deg)'; toggleBtn.title = state.catExpanded[c.id] === false ? '展开子分类' : '收起子分类';
});
row.appendChild(toggleBtn);
}

if (!isTop) {
var parentExpanded = state.catExpanded[c.parent_id] !== false;
if (!parentExpanded) {
row.style.display = 'none';
}

var _subPh = document.createElement('span');
_subPh.className = 'cat-sub-ph';
_subPh.style.flexShrink = '0';
_subPh.setAttribute('aria-hidden', 'true');
row.appendChild(_subPh);
}

var levelBadge = document.createElement('span');
levelBadge.className = 'badge ' + (isTop ? 'on' : '');
levelBadge.style.background = c.id === 0 ? '#fff3e0' : (isTop ? '#e3f2fd' : '#f5f5f5');
levelBadge.style.color = c.id === 0 ? '#ef6c00' : (isTop ? '#1976d2' : '#999');
levelBadge.textContent = ''; levelBadge.style.display = 'none';

if (Number(c.id) !== 0) {
var catStatusBtn = document.createElement('button');
catStatusBtn.className = 'row-btn status-btn ' + (c.is_hidden ? 'status-hidden' : 'status-online');
catStatusBtn.textContent = c.is_hidden ? '隐藏' : '显示';
catStatusBtn.title = '点击切换为' + (c.is_hidden ? '显示' : '隐藏（资源页不显示）');
if (window.__decorateBtn) window.__decorateBtn(catStatusBtn, c.is_hidden ? 'hide' : 'show', 2);
catStatusBtn.addEventListener('click', function (e) {
e.stopPropagation();
if (catStatusBtn.disabled) return;
var nowHidden = !c.is_hidden; var prev = !!c.is_hidden; if (prev === nowHidden) return;
catStatusBtn.disabled = true;
c.is_hidden = nowHidden;
var _slab = this.querySelector('.btn-lab'); if (_slab) _slab.textContent = nowHidden ? '隐藏' : '显示'; else this.textContent = nowHidden ? '隐藏' : '显示';
this.classList.remove('status-online', 'status-hidden'); this.classList.add(nowHidden ? 'status-hidden' : 'status-online');
this.title = '点击切换为' + (nowHidden ? '显示' : '隐藏（资源页不显示）');
api('admin/categories/' + c.id, { method: 'PUT', body: JSON.stringify({ is_hidden: nowHidden }) }).then(function (res) {
catStatusBtn.disabled = false;
if (!res.ok) { c.is_hidden = prev; toast(res.msg || '更新失败', 'error'); } else { clearCache(); }
}).catch(function () {
catStatusBtn.disabled = false;
toast('更新失败，请重试', 'error');
});
}); meta.appendChild(catStatusBtn);
}

var sort = document.createElement('span');
sort.className = 'c-sort';
sort.textContent = '排序:' + (ordered.filter(function (x) { return x.parent_id === c.parent_id; }).indexOf(c) + 1);

var cnt = document.createElement('span');
cnt.className = 'c-count';
cnt.textContent = (c.totalCnt !== undefined ? c.totalCnt : (c.cnt || 0)) + ' 个资源';
cnt.style.cursor = 'pointer';
cnt.style.color = 'var(--gray-mid)';
cnt.style.textDecoration = 'none';
cnt.title = '点击查看该分类下的资源';
cnt.addEventListener('click', function (e) {
e.stopPropagation();
document.querySelector('.tab[data-tab="products"]').click();
initFilterCatPicker(); var filterCat = document.getElementById('filterCat');
if (filterCat) {
filterCat.value = c.id;
renderProducts();
}
toast('已筛选分类：' + c.name, 'success');
});

row.appendChild(name);
row.insertBefore(levelBadge, (typeof toggleBtn !== 'undefined' && toggleBtn) || (row.firstChild && row.firstChild.nextSibling && row.firstChild.nextSibling.nextSibling) || null);
row.appendChild(sort);
row.appendChild(cnt);

if (Number(c.id) !== 0) {
var editBtn = document.createElement('button');
editBtn.className = 'row-btn';
editBtn.textContent = '编辑';
editBtn.title = '编辑';
if (window.__decorateBtn) window.__decorateBtn(editBtn, 'edit', 1);
editBtn.addEventListener('click', function () { openCatEdit(c); });
var delBtn = document.createElement('button');
delBtn.className = 'row-btn danger';
delBtn.textContent = '删除';
delBtn.title = '删除';
if (window.__decorateBtn) window.__decorateBtn(delBtn, 'del', 6);
delBtn.addEventListener('click', function () {

var _catSnap = state.categories.slice();
var _cidSnap = (state.products || []).map(function (p) { return p.cid; });
var __removeLocal = function () {
var _delIds = [Number(c.id)];
state.categories.forEach(function (x) { if (Number(x.parent_id) === Number(c.id)) _delIds.push(Number(x.id)); });
state.categories = state.categories.filter(function (x) { return _delIds.indexOf(Number(x.id)) === -1; });
(state.products || []).forEach(function (p) { if (_delIds.indexOf(Number(p.cid)) !== -1) p.cid = 0; });
return _delIds;
};
var _delIds0 = __removeLocal();
try {
document.querySelectorAll('#catList .cat-row').forEach(function (r) { if (_delIds0.indexOf(Number(r.dataset.id)) !== -1) { r.style.transition = 'opacity var(--dur-fast, .10s) ease'; r.style.opacity = '0'; } });
setTimeout(function () { renderCategories(state.categories); refreshCatCnts(); renderProducts(); initFilterCatPicker(); }, 120);
} catch (e0) { if (window.__silent) window.__silent(e0); }
__undoable(
'已删除分类「' + (c.name || '未命名') + '」· 回收站点可找回',
function () { silentSyncCategories(); },
function () {

var _seqC = Promise.resolve();
_delIds0.forEach(function (id) {
_seqC = _seqC.then(function () {
return api('admin/recycle', { method: 'POST', body: JSON.stringify({ op: 'restore', kind: 'category', id: id }) });
});
});
_seqC.then(function () {
__restoreCat(); clearCache(); silentSyncCategories();
toast('已恢复分类「' + (c.name || '未命名') + '」', 'success');
}).catch(function () { toast('恢复失败，请到「回收站点」手动恢复', 'error'); });
}
);

api('admin/categories/' + c.id, { method: 'DELETE' }).then(function (res) {
if (res && res.ok) { clearCache(); silentSyncCategories(); }
else { toast((res && res.msg) || '删除失败', 'error'); __restoreCat(); }
}).catch(function () { toast(window.T('delFail'), 'error'); __restoreCat(); });
function __restoreCat() {
state.categories = _catSnap.slice();
(state.products || []).forEach(function (p, i) { if (_cidSnap[i] !== undefined) p.cid = _cidSnap[i]; });
renderCategories(state.categories); refreshCatCnts(); renderProducts(); initFilterCatPicker();
}
});
meta.appendChild(editBtn);
meta.appendChild(delBtn);
}
else {
var _ph0 = document.createElement('span'); _ph0.className = 'row-btn'; _ph0.style.cssText = 'visibility:hidden;pointer-events:none;'; _ph0.textContent = '固定'; _ph0.setAttribute('aria-hidden', 'true'); meta.appendChild(_ph0);
var _pe0 = document.createElement('button'); _pe0.className = 'row-btn'; _pe0.textContent = '编辑'; _pe0.style.cssText = 'visibility:hidden;pointer-events:none;';
var _pd0 = document.createElement('button'); _pd0.className = 'row-btn danger'; _pd0.textContent = '删除'; _pd0.style.cssText = 'visibility:hidden;pointer-events:none;';
meta.appendChild(_pe0); meta.appendChild(_pd0);
}

row.appendChild(meta);
row.classList.add('stagger-in'); row.style.animationDelay = Math.min(ci * 20, 180) + 'ms';
if (__reuse && __skels[ci]) __skels[ci].parentNode.replaceChild(row, __skels[ci]); else box.appendChild(row);
box.style.minHeight = '';
});

if (__reuse) { for (var __cj = ordered.length; __cj < __skels.length; __cj++) { if (__skels[__cj] && __skels[__cj].parentNode) __skels[__cj].parentNode.removeChild(__skels[__cj]); } }

try {
{
box.querySelectorAll('.cat-row').forEach(function (row) {
if (row.querySelector('.cat-fold') || row.querySelector('.cat-check') === null) return;
var fold = document.createElement('button');
fold.type = 'button'; fold.className = 'cat-fold'; fold.title = '展开/收起操作'; fold.setAttribute('aria-label', '展开/收起操作');
fold.innerHTML = '<svg class="toggle-arrow" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>';
fold.addEventListener('click', function (e) { e.stopPropagation(); row.classList.toggle('cat-open'); });
row.appendChild(fold);
});
}
} catch (e) { if (window.__silent) window.__silent(e); }


if (__catPager) {
var __pb = document.createElement('div');
__pb.className = 'uni-pager';
__pb.id = 'catPager';
box.appendChild(__pb);
if (window.buildUniPager) {
window.buildUniPager(__pb, {
page: __catPager.page, totalPages: __catPager.totalPages, total: __catPager.total, unit: '个',
onPage: function (p6) { window.__catPage = p6; renderCategories(list); }
});
}
}
}

setTimeout(function () { var _cb = document.getElementById('catList'); if (_cb) { _cb.classList.remove('prod-fade'); void _cb.offsetWidth; _cb.classList.add('prod-fade'); } }, 10);
document.getElementById('addCatBtn').addEventListener('click', function () { openCatEdit(null); }); document.getElementById('catSelectAll').addEventListener('change', function () { var on = this.checked; document.querySelectorAll('.cat-check').forEach(function (cb) { cb.checked = on; state.catSelected[Number(cb.dataset.id)] = on; }); updateCatBatchBar(); });

function updateCatBatchBar() {
var checks = document.querySelectorAll('.cat-check:checked');
var count = checks.length;
var bar = document.getElementById('catBatchBar');
document.getElementById('catBatchCount').textContent = count; var allBox = document.getElementById('catSelectAll'); if (allBox) allBox.checked = count > 0 && count === document.querySelectorAll('.cat-check').length;
bar.classList.toggle('show', count > 0);
window.__setBatchBar(bar, count > 0);
}
document.getElementById('catBatchHide').addEventListener('click', function () {
var ids = Array.from(document.querySelectorAll('.cat-check:checked')).map(function (cb) { return Number(cb.dataset.id); }).filter(function (id) { return !isNaN(id); });
if (ids.length === 0) return;
showConfirm('批量隐藏', '确定隐藏选中的 ' + ids.length + ' 个分类？隐藏后资源页不显示。', function (closeConfirm) {
batchCatAction(ids, 'hide', closeConfirm);
});
});
document.getElementById('catBatchShow').addEventListener('click', function () {
var ids = Array.from(document.querySelectorAll('.cat-check:checked')).map(function (cb) { return Number(cb.dataset.id); }).filter(function (id) { return !isNaN(id); });
if (ids.length === 0) return;
showConfirm('批量显示', '确定显示选中的 ' + ids.length + ' 个分类？', function (closeConfirm) {
batchCatAction(ids, 'show', closeConfirm);
});
});
document.getElementById('catBatchDel').addEventListener('click', function () {
var ids = Array.from(document.querySelectorAll('.cat-check:checked')).map(function (cb) { return Number(cb.dataset.id); }).filter(function (id) { return !isNaN(id); });
if (ids.length === 0) return;
showConfirm('批量删除', '确定删除选中的 ' + ids.length + ' 个分类？其下资源将归入"全部"，子分类也会一并删除，不可恢复。', function (closeConfirm) {
batchCatAction(ids, 'delete', closeConfirm);
});
});
document.getElementById('catBatchCancel').addEventListener('click', function () {
document.querySelectorAll('.cat-check:checked').forEach(function (cb) { cb.checked = false; state.catSelected[Number(cb.dataset.id)] = false; });
updateCatBatchBar();
});
function batchCatAction(ids, action, closeConfirm) {
if (ids.indexOf(0) !== -1) { if (closeConfirm) closeConfirm(); toast('「全部」为保底根分类，不可隐藏/显示/删除', 'error'); return; }
var targetIds = ids.slice();
if (action === 'hide' || action === 'show') {
ids.forEach(function (pid) {
state.categories.forEach(function (c) {
if (c.parent_id === pid && targetIds.indexOf(c.id) === -1) targetIds.push(c.id);
});
});
}
var done = 0, fail = 0;
ids = targetIds;
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
if (closeConfirm) closeConfirm();
var actionName = action === 'hide' ? '隐藏' : (action === 'show' ? '显示' : '删除');
toast('批量' + actionName + '完成：成功 ' + done + ' 项，失败 ' + fail + ' 项', fail > 0 ? 'error' : 'success');
clearCache();
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
}).catch(function () { fail++; if (done + fail === ids.length && closeConfirm) closeConfirm(); });
});
}

function openCatEdit(c) {

try { var _ok = document.getElementById('catOk'); if (_ok) { _ok.disabled = false; _ok.style.opacity = ''; if (window.__btnIdle) window.__btnIdle(_ok); } } catch (e0) {}
if (catDraftPending && catDraftFor === (c ? c.id : null)) { catDraftPending = false; catModalTitle.textContent = c ? '编辑分类' : '新增分类'; catMask.classList.add('open'); if (window.__modalScroll) __modalScroll.open(catMask, c ? c.id : 'new'); return; }
state.catEditingId = c ? c.id : null;
catDraftFor = c ? c.id : null;
catModalTitle.textContent = c ? '编辑分类' : '新增分类';
catName.value = c ? (c.name || '') : '';
catSort.value = c ? (c.sort || 0) : 0;
catHidden.checked = c ? !!c.is_hidden : false;

try { var _cpp = document.getElementById('catParentPicker'), _cph = document.getElementById('catParentValue'), _cpd = document.getElementById('catParentDisplay'), _cppan = document.getElementById('catParentPanel'); if (_cpp && _cph && _cpd && _cppan) buildCatPicker(_cpp, _cph, _cpd, _cppan, (c && c.parent_id > 0) ? (Number(c.parent_id) || 0) : 0, { topOnly: true, excludeZero: true, }); } catch (e) { if (window.__silent) window.__silent(e); }
var isChild = c && c.parent_id > 0;
document.querySelector('input[name="catLevel"][value="0"]').checked = !isChild;
document.querySelector('input[name="catLevel"][value="1"]').checked = isChild;
catParentWrap.style.display = isChild ? 'block' : 'none';
catMask.classList.add('open');

if (window.__modalScroll) __modalScroll.open(catMask, c ? c.id : 'new');
}

document.querySelectorAll('input[name="catLevel"]').forEach(function (radio) {
radio.addEventListener('change', function () {
catParentWrap.style.display = this.value === '1' ? 'block' : 'none';
if (this.value === '1') { try { var _cpp2 = document.getElementById('catParentPicker'), _cph2 = document.getElementById('catParentValue'), _cpd2 = document.getElementById('catParentDisplay'), _cppan2 = document.getElementById('catParentPanel'); if (_cpp2 && _cph2 && _cpd2 && _cppan2) buildCatPicker(_cpp2, _cph2, _cpd2, _cppan2, 0, { topOnly: true, excludeZero: true, }); } catch (e) { if (window.__silent) window.__silent(e); } }
});
});

var __reorderBusy = false;
function reorderCategories(draggedId, targetId) {
if (__reorderBusy) return;
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
__reorderBusy = true;

var _clEl = document.getElementById('catList');
var _cflip = (window.__motion && __motion.flipSnap && _clEl) ? __motion.flipSnap(_clEl, '.cat-row') : null;
var seq = changed.map(function (c) { return api('admin/categories/' + c.id, { method: 'PUT', body: JSON.stringify({ sort: c.sort }) }); });
Promise.all(seq).then(function (reses) {
__reorderBusy = false;
if (reses.every(function (r) { return r && r.ok; })) {
toast('排序已更新', 'success'); clearCache();
state.categories = orderCats(state.categories);
renderCategories(state.categories);
try { if (_cflip) _cflip(); } catch (e4) { if (window.__silent) window.__silent(e4); }
silentSyncCategories();
}
else toast('排序没保存上：服务器拒绝了这次修改，刷新后再拖一次', 'error');
}).catch(function () {
__reorderBusy = false;
toast('排序没存上：网络没连上，稍后再试', 'error');
});
}

var catSaving = false;
var catDraftPending = false;
var catDraftFor = null;
catOk.addEventListener('click', function () {
if (catSaving) return;
catSaving = true;
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
toast('请选择所属分类', 'error');
catSaving = false;
catOk.disabled = false;
catOk.style.opacity = '';
return;
}
var data = { name: name, sort: sort, parent_id: parentId, is_hidden: isHidden };

var _dupCat = (state.categories || []).filter(function (c) {
return String(c.name || '').trim() === name
&& Number(c.parent_id || 0) === Number(parentId || 0)
&& Number(c.id) !== Number(state.catEditingId || 0);
});
if (_dupCat.length) {
toast('已经有叫「' + name + '」的分类了', 'error');
catSaving = false; catOk.disabled = false; catOk.style.opacity = '';
if (window.__btnIdle) window.__btnIdle(catOk);
return;
}
var _catOkText = catOk.textContent;
if (window.__btnBusy) window.__btnBusy(catOk, '确定中');
var req = state.catEditingId
? api('admin/categories/' + state.catEditingId, { method: 'PUT', body: JSON.stringify(data) })
: api('admin/categories', { method: 'POST', body: JSON.stringify(data) });

req.then(function (res) {
catSaving = false;
if (res && res.ok) {

catOk.disabled = false; catOk.style.opacity = ''; catOk.textContent = _catOkText;
if (window.__btnIdle) window.__btnIdle(catOk);
catDraftPending = false; catMask.classList.remove('open');
toast('分类已保存', 'success'); if (window.__haptic) window.__haptic();
clearCache();
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
renderProducts();
initFilterCatPicker();
silentSyncCategories();
} else {
loadCategories();
}
} else {
catSaving = false; catOk.disabled = false; catOk.style.opacity = ''; catOk.textContent = _catOkText;
toast(res.msg || '保存失败', 'error');
}
}).catch(function () {
catSaving = false; catOk.disabled = false; catOk.style.opacity = ''; catOk.textContent = _catOkText;
toast(window.T('netFail'), 'error');
});
});

catCancel.addEventListener('click', function () { catDraftPending = false; catMask.classList.remove('open'); });
catMask.addEventListener('click', function (e) { if (e.target === catMask) { catDraftPending = true; catMask.classList.remove('open'); } });

var pwdMask = document.getElementById('pwdMask');
document.getElementById('showPwdFormBtn').addEventListener('click', function () {
pwdMask.classList.add('open');
});
document.getElementById('cancelPwdBtn').addEventListener('click', function () {
document.getElementById('oldPwd').value = ''; document.getElementById('newPwd').value = ''; document.getElementById('confirmPwd').value = '';
pwdMask.classList.remove('open');
});
pwdMask.addEventListener('click', function (e) {
if (e.target === pwdMask) pwdMask.classList.remove('open');
});
document.getElementById('changePwdBtn').addEventListener('click', function () {
if (this.disabled) return;
var oldPwd = document.getElementById('oldPwd').value;
var newPwd = document.getElementById('newPwd').value;
var confirmPwd = document.getElementById('confirmPwd').value;
var __pwErr = function (id, msg) {
var el = document.getElementById(id); if (!el) { toast(msg, 'error'); return; }
el.style.borderColor = 'var(--red-strong)'; try { el.focus({ preventScroll: true }); } catch (e1) { el.focus(); }
var tip = document.createElement('div'); tip.textContent = msg; tip.style.cssText = 'color:var(--red-strong);font-size:12px;margin:4px 0 0;';
el.parentNode.appendChild(tip);
setTimeout(function () { tip.remove(); el.style.borderColor = ''; }, 1500);
};
if (!oldPwd) { __pwErr('oldPwd', '请填写原密码'); return; }
if (!newPwd) { __pwErr('newPwd', '请填写新密码'); return; }
if (!confirmPwd) { __pwErr('confirmPwd', '请再输一遍新密码'); return; }
if (newPwd !== confirmPwd) { __pwErr('confirmPwd', '两次输入的新密码不一致'); return; }

var _cpBtn = this, _cpTxt = this.textContent;
showConfirm('修改密码', '确定修改密码？修改后立即生效，请牢记新密码。', function () {
_cpBtn.disabled = true; if (window.__btnBusy) window.__btnBusy(_cpBtn, '修改中');
api('admin/password', { method: 'POST', body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }) })
.then(function (res) {
_cpBtn.disabled = false; _cpBtn.textContent = _cpTxt;
if (res && res.ok) {
toast('密码已修改', 'success');
document.getElementById('oldPwd').value = ''; document.getElementById('newPwd').value = ''; document.getElementById('confirmPwd').value = '';
pwdMask.classList.remove('open');
} else {

var _msg = (res && res.msg) || '修改失败（原密码可能不正确）';
var _el = /原密码/.test(_msg) ? document.getElementById('oldPwd') : null;
if (_el) {
_el.style.borderColor = 'var(--red-strong)';
try { _el.focus({ preventScroll: true }); } catch (eF) { try { _el.focus(); } catch (eF2) {} }
var _tip = document.createElement('div');
_tip.className = 'pwd-err-tip';
_tip.textContent = _msg;
_tip.style.cssText = 'color:var(--red-strong);font-size:12px;margin:4px 0 0;';
_el.parentNode.appendChild(_tip);
setTimeout(function () { _tip.remove(); _el.style.borderColor = ''; }, 4000);
} else { toast(_msg, 'error'); }
}
}).catch(function () {
_cpBtn.disabled = false; _cpBtn.textContent = _cpTxt;
toast('修改失败：网络错误', 'error');
});
});
});

logoutBtn.addEventListener('click', function () {
logoutBtn.classList.add('active');
showConfirm('退出登录', '确定要退出管理页吗？', function (closeConfirm) {
closeConfirm();
api('admin/logout', { method: 'POST' });
showLogin();
});
});
(function () {
function sync() {
var cm = document.getElementById('confirmMask');
if (!cm || !cm.classList.contains('open')) logoutBtn.classList.remove('active');
}
var mo = new MutationObserver(sync);
var cm = document.getElementById('confirmMask');
if (cm) mo.observe(cm, { attributes: true, attributeFilter: ['class'] });

})();


(function () {
var __bindSH = function () { window.bindSearchHist(document.querySelector('.tb-row2 .admin-search'), document.getElementById('adminSearch'), 'wnzyq_admin_search_hist'); };
if (window.bindSearchHist) __bindSH(); else window.addEventListener('load', __bindSH);
})();
document.getElementById('adminSearchClear').addEventListener('click', function () {
var inp = document.getElementById('adminSearch');
inp.value = '';
this.classList.remove('show');
adminPage = 1;
renderProducts();
try { inp.focus({ preventScroll: true }); } catch (e1) { inp.focus(); }
});

bindFieldClear(fTitle);
attachLiveCheck(fTitle, '请填写资源标题');
bindFieldClear(fCid);

(function () {
var picker = document.getElementById('fCidPicker');
var disp = document.getElementById('fCidDisplay');
if (!picker || !disp || !fCid) return;
var opened = false;
var mo = new MutationObserver(function () {
if (picker.classList.contains('open')) { opened = true; return; }
if (opened) { opened = false; var _cv = fCid.value; if (_cv === '' || _cv === undefined || _cv === null) showFieldErr(disp, '请选择资源分类'); }
});
mo.observe(picker, { attributes: true, attributeFilter: ['class'] });
})();
bindFieldClear(fDesc);
bindFieldClear(fImg);
bindFieldClear(vName);
bindFieldClear(vTitle);

state.statsCmpPrev = false;
var _cmpBtn = document.getElementById('cmpPrevBtn');
if (_cmpBtn) _cmpBtn.addEventListener('click', function () {
state.statsCmpPrev = !state.statsCmpPrev;
this.classList.toggle('cmp-on', state.statsCmpPrev);
this.textContent = state.statsCmpPrev ? '显示本期' : '对比上期';
var _ll = document.querySelector('.line-legend'); if (_ll) _ll.classList.toggle('show-prev', state.statsCmpPrev);
var _tl = document.querySelector('.trend-legend'); if (_tl) _tl.classList.toggle('show-prev', state.statsCmpPrev);
if (state.statsOverview) renderStatCards(state.statsOverview, state.statsOverviewPrev || null);

try {
if (state.statsCmpPrev) {
var _pv = state.statsOverviewPrev || {};
var _hasPrev = ['views', 'contacts', 'resource_unlocks'].some(function (k) { return Number(_pv[k] || 0) > 0; });
toast(_hasPrev ? '已开启对比：虚线是上期，卡片小字是涨跌' : '已开启对比，但上期这段时间没有数据（虚线贴在最下面）', 'success');
}
} catch (eC) { if (window.__silent) window.__silent(eC); }
if (state.statsTrend && state.statsTrend.length) {
renderLineChart(state.statsTrend, state.statsCmpPrev ? state.statsTrendPrev : null);

}
});
document.querySelectorAll('.time-btn[data-days]').forEach(function (btn) {
btn.addEventListener('click', function () {
document.querySelectorAll('.time-btn').forEach(function (b) { b.classList.remove('active'); });
this.classList.add('active');
state.statsDays = Number(this.dataset.days) || 7;
document.getElementById('statStartDate').value = '';
document.getElementById('statEndDate').value = '';

var _d = state.statsDays;
var _r = _d === 1 ? (function () { var _td = __bjToday(); return { start: _td, end: _td }; })() : __statsRangeDays(_d);
var _c = __statsCache[_d];
if (_c && _c.end === __bjToday() && _c.res && _c.res.ok) {
__updateStatTitles(_r.start, _r.end);
__applyStatsRes(_c.res);
loadStats(_r.start, _r.end, 1, 1);
return;
}
if (state.statsDays === 1) {
var _td = __bjToday();
loadStats(_td, _td, 1);
} else {
if (state.statsTrendAll && state.statsTrendAll.length) applyStatsDays();
var _r7 = __statsRangeDays(state.statsDays);
loadStats(_r7.start, _r7.end, 1);
}
});
});
document.getElementById('statCustomBtn').addEventListener('click', function () {
var s = document.getElementById('statStartDate').value;
var e = document.getElementById('statEndDate').value;
if (!s || !e) { toast('请选择开始和结束时间', 'error'); return; }
if (s.slice(0, 10) > e.slice(0, 10)) { toast('开始时间不能晚于结束时间', 'error'); return; }
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

document.getElementById('exportBtn').addEventListener('click', exportAllData);
var exportResourceBtn = document.getElementById('exportResourceBtn');

var previewCurVariant = 0;
function fmtPrice(v) {
var n = Number(v) || 0;
return n > 0 ? (window.formatPrice ? window.formatPrice(n) : ('¥' + (n === Math.floor(n) ? n : n.toFixed(2)))) : '';
}
function renderPreviewVariant() {
var variants = state.variants || [];
var basePrice = Number(fPrice.value) || 0;
var priceEl = document.getElementById('previewPrice');
var detailEl = document.getElementById('previewVariantDetail');
if (variants.length === 0) { priceEl.textContent = fmtPrice(basePrice); detailEl.innerHTML = ''; initPvResourceSection(null); return; }
var v = variants[previewCurVariant] || variants[0];
var vp = (Number(v.price) || 0) > 0 ? Number(v.price) : basePrice;
priceEl.textContent = fmtPrice(vp);
detailEl.innerHTML = '';
var header = document.createElement('div');
header.className = 'variant-header';
var vName = document.createElement('span');
vName.className = 'variant-name';
vName.textContent = (v.title && String(v.title).trim()) || v.name || '';
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
initPvResourceSection(v);
}
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
if (!hasContent) { sec.style.display = 'none'; return; }
sec.style.display = 'block';
errEl.style.display = 'none';
contentEl.style.display = 'none';
contentEl.innerHTML = '';
inputEl.value = '';
if (hasCode) {
titleEl.textContent = '获取专属内容';
inputRow.style.display = 'flex';
} else {
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
var code = String(v.resourceCode || '').trim();
if (code && input.toUpperCase() === code.toUpperCase()) {
errEl.style.display = 'none';
document.getElementById('pvResourceInputRow').style.display = 'none';
pvShowContent(v);
} else {
errEl.textContent = '资源码错误，请重试';
errEl.style.display = 'block';
}
}

function __pvCollect() {
var cover = [];
try { cover = (window.__coverImages ? window.__coverImages() : null) || []; } catch (e0) { cover = []; }
if (!cover.length) { var _i = (fImg.value || '').trim(); if (_i) cover = [_i]; }
var det = '';
try { det = serializeDetail() || ''; } catch (e1) { det = (fDetail && fDetail.innerHTML) || ''; }
return {
id: state.editingId || 0,
title: (fTitle.value || '').trim(),
desc: (fDesc.value || '').trim(),
price: Number(fPrice.value) || 0,
img: cover[0] || '',
coverImages: cover,
detail: det,
detailImages: [], detailVideos: [],
variants: (state.variants || []).map(function (v) {
return {
name: v.name || '', price: v.price || 0, desc: v.desc || '', sort: v.sort || 0,
hasCode: !!(v.resourceCode || '').trim()
};
})
};
}
function __pvSend() {
var fr = document.getElementById('previewFrame');
if (!fr || !fr.contentWindow) return;
try { fr.contentWindow.postMessage({ type: 'wnzyq-preview', product: __pvCollect() }, location.origin); } catch (e) {}
}
window.__pvSend = __pvSend;
function __openRealPreview() {
var mask = document.getElementById('previewMask');
var box = mask && mask.querySelector('.preview-box');
var fr = document.getElementById('previewFrame');
if (!mask || !box || !fr) return false;
box.classList.add('pv-real');
mask.classList.add('open');
if (!fr.dataset.started) {
fr.dataset.started = '1';

box.classList.add('pv-loading');
fr.addEventListener('load', function () { setTimeout(__pvSend, 150); });
fr.src = '/shop?preview=1';
} else {
__pvSend();
}
if (window.__modalScroll) { try { __modalScroll.open(mask, 'preview'); } catch (e2) {} }

if (!window.__pvLiveBound) {
window.__pvLiveBound = true;
var _t = 0;
var kick = function () {
if (!mask.classList.contains('open')) return;
clearTimeout(_t); _t = setTimeout(__pvSend, 250);
};
var em = document.getElementById('editMask');
if (em) { em.addEventListener('input', kick, true); em.addEventListener('change', kick, true); }
}
return true;
}
window.__openRealPreview = __openRealPreview;

window.addEventListener('message', function (ev) {
var d = ev.data || {};

if (d.type === 'wnzyq-preview-closed') {
var _pm = document.getElementById('previewMask');
if (_pm) { _pm.classList.remove('open'); try { _pm.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e5) {} }
return;
}
if (d.type !== 'wnzyq-preview-ready') return;
var m = document.getElementById('previewMask');
if (m && m.classList.contains('open')) {
__pvSend();
var _bx = m.querySelector('.preview-box');
if (_bx) _bx.classList.remove('pv-loading');
}
});

document.getElementById('previewProductBtn').addEventListener('click', function () {

if (window.__openRealPreview && window.__openRealPreview()) return;
previewCurVariant = 0;
var _pvSkel = document.getElementById('previewSkeleton'); if (_pvSkel) _pvSkel.style.display = 'none';
document.getElementById('previewTitle').textContent = fTitle.value || '(未填写标题)';
document.getElementById('previewDesc').textContent = fDesc.value || '';
var __pdHtml = serializeDetail() || '';
var __pdEmpty = !__pdHtml.replace(/<(br|p|div)\b[^>]*>\s*<\/(br|p|div)>/gi, '').replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, ' ').replace(/<[^>]+>/g, '').trim();
var __pdEl = document.getElementById('previewDetail');
if (__pdEmpty) { __pdEl.innerHTML = ''; __pdEl.style.display = 'none'; }
else { __pdEl.innerHTML = __pdHtml; __pdEl.style.display = ''; }
var _pCovArr = window.__coverImages ? window.__coverImages() : (fImg.value.trim() ? [fImg.value.trim()] : []);
renderCarousel(document.getElementById('previewCarousel'), document.getElementById('previewCcTrack'), document.getElementById('previewCcDots'), document.getElementById('previewCover'), _pCovArr);
var pc = document.getElementById('previewCover');
if (_pCovArr.length <= 1) {
pc.style.cursor = 'zoom-in';
pc.onclick = function () { if (pc.src) window.openLightbox(pc.src); };
}
var wrap = document.getElementById('previewVariantWrap');
var tabs = document.getElementById('previewVariantTabs');
tabs.innerHTML = '';
var variants = state.variants || [];
if (variants.length >= 1) {
wrap.style.display = 'block';
variants.forEach(function (v, i) {
var t = document.createElement('button');
t.type = 'button';
t.className = 'variant-tab' + (i === 0 ? ' active' : '');
t.textContent = v.name || ('类型' + (i + 1));
if (v.name) t.title = v.name;
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
bindLightbox(document.getElementById('previewDetail'));
bindLightbox(document.getElementById('previewVariantDetail'));

try { window.bindQuoteCopyButtons(document.getElementById('previewDetail')); } catch (e0) { if (window.__silent) window.__silent(e0); }
try { window.bindQuoteCopyButtons(document.getElementById('previewVariantDetail')); } catch (e0) { if (window.__silent) window.__silent(e0); }
document.getElementById('previewMask').classList.add('open');

if (window.__modalScroll) __modalScroll.open(document.getElementById('previewMask'), state.editingId || 'new');
});
document.getElementById('previewCloseX').addEventListener('click', function () {
__stopPreviewCarousel();
document.getElementById('previewMask').classList.remove('open');try{document.querySelectorAll('#previewMask video').forEach(function(v){v.pause()})}catch (e) { if (window.__silent) window.__silent(e); }
});
document.getElementById('previewShareX').addEventListener('click', function () {
var isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if (isLocal) { toast('本地预览模式，部署线上后可分享', 'error'); return; }
if (!state.editingId) { toast('新增资源请先保存后再分享', 'error'); return; }
var url = window.location.origin + '/shop?pid=' + state.editingId;
var _pn = ''; try { var _pp = (state.products || []).find(function (x) { return Number(x.id) === Number(state.editingId); }); _pn = (_pp && _pp.title) || ''; } catch (e) { if (window.__silent) window.__silent(e); }
if (window.showShareLinkModal) window.showShareLinkModal('分享资源链接', url, (_pn ? _pn + ' · ' : '') + '资源链接已复制');
else { if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch (e) { if (window.__silent) window.__silent(e); } } toast(window.T('copied'), 'success'); }
});
document.getElementById('previewContactBtn').addEventListener('click', function () {
var url = '';
var variants = state.variants || [];
var cv = variants[previewCurVariant];
if (cv && cv.contactUrl) url = cv.contactUrl;
if (!url) url = fContactUrl.value.trim();
if (!url && window.__infoContactUrl) url = window.__infoContactUrl;
if (url) { if (window.openContactModal) { window.openContactModal(url, window.__kefuQrSrc(), null, '跳转-咨询在线客服', { green: true }); } else { window.openContactFallback(url, { green: true }); } }
else toast('暂未配置客服链接（资源/全局都没填）', 'warn');
});
document.querySelector('.preview-close-btn').addEventListener('click', function () {
__stopPreviewCarousel();
document.getElementById('previewMask').classList.remove('open');try{document.querySelectorAll('#previewMask video').forEach(function(v){v.pause()})}catch (e) { if (window.__silent) window.__silent(e); }
});


function renderCarousel(carouselEl, trackEl, dotsEl, fallbackImgEl, images) {
if (window.__renderCarousel) { window.__renderCarousel(carouselEl, trackEl, dotsEl, fallbackImgEl, images, window.WN_MEDIA_FALLBACK); return; }
if (!carouselEl || !trackEl) return;
if (!images || images.length <= 1) {
carouselEl.style.display = 'none';
if (fallbackImgEl) { fallbackImgEl.style.display = ''; fallbackImgEl.src = images && images[0] ? images[0] : ''; }
return;
}
carouselEl.style.display = '';
if (fallbackImgEl) fallbackImgEl.style.display = 'none';
}
function __stopPreviewCarousel() {
var _ccCar = document.getElementById('previewCarousel');
if (_ccCar && _ccCar.__ccPause) _ccCar.__ccPause();
}
document.getElementById('previewMask').addEventListener('click', function (e) {
if (e.target === this) { __stopPreviewCarousel(); this.classList.remove('open'); try { this.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); } }
});

document.addEventListener('keydown', function (e) {
if ((e.ctrlKey || e.metaKey) && e.key === 's') {
e.preventDefault();

var __csMap = [['editMask','saveProductBtn'],['annMask','saveAnnBtn'],['catMask','catOk'],['batchCatMask','batchCatOk'],['variantMask','variantOk'],['inputMask','inputOk']];
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
if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].indexOf(e.key) !== -1) {
var __ed = document.activeElement;
if (__ed && (__ed.classList.contains('rte-editor') || (__ed.closest && __ed.closest('.rte-editor')))) {
e.preventDefault();
try { document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key], false, null); } catch (e2) { if (window.__silent) window.__silent(e2); }
}
}
if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
}
if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
}
});

(function () {
if (!window.__cpPanel) return;
window.__cpPanel({
placeholder: '请输入页面 / 操作 / 资源名',
busy: '.modal-mask.open, .kf-mask.open, .share-mask.open, .ann-mask.open',
cmds: function () {
var c = [
{ lab: '资源管理', tag: '页面', kw: '资源管理 资源 列表 products', run: function () { switchTab('products'); } },
{ lab: '分类管理', tag: '页面', kw: '分类管理 分类 categories', run: function () { switchTab('categories'); } },
{ lab: '数据统计', tag: '页面', kw: '数据统计 统计 数据 stats', run: function () { switchTab('stats'); } },
{ lab: '平台设置', tag: '页面', kw: '平台设置 设置 settings', run: function () { switchTab('settings'); } },
{ lab: '新增资源', tag: '操作', kw: '新增资源 新建 添加资源 add', run: function () { switchTab('products'); document.getElementById('addProductBtn').click(); } },
{ lab: '新增分类', tag: '操作', kw: '新增分类 新建分类 add', run: function () { switchTab('categories'); document.getElementById('addCatBtn').click(); } },
{ lab: '设置信息', tag: '操作', kw: '设置信息 客服 群聊 公众号 二维码 链接 contact', run: function () { switchTab('settings'); var b = document.getElementById('openInfoBtn'); if (b) b.click(); } },
{ lab: '设置公告', tag: '操作', kw: '设置公告 公告 ann', run: function () { switchTab('settings'); document.getElementById('openAnnBtn').click(); } },
{ lab: '新增公告项', tag: '操作', kw: '新增公告项 公告 add', run: function () { switchTab('settings'); document.getElementById('addAnnBtn').click(); } },
{ lab: '修改密码', tag: '操作', kw: '修改密码 密码 pwd', run: function () { switchTab('settings'); document.getElementById('showPwdFormBtn').click(); } }
];
(state.products || []).forEach(function (p) {
c.push({ lab: '编辑：' + (p.title || '(无标题)'), tag: '资源', kw: '编辑 ' + (p.title || ''), run: function () { switchTab('products'); openEdit(p); } });
});
return c;
}
});
})();

window.addEventListener('DOMContentLoaded', function () {
var kit = window.__modalKit; if (!kit) return;
var el = function (id) { return document.getElementById(id); };
kit.register(el('editMask'), {
discard: function () { try { clearDraft(); } catch (e) { if (window.__silent) window.__silent(e); } editMask.classList.remove('open'); },
stash: function () { try { saveDraft(); } catch (e) { if (window.__silent) window.__silent(e); } editMask.classList.remove('open'); }
});
kit.register(el('variantMask'), {
discard: function () { variantDraftPending = false; variantDraftFor = null; variantMask.classList.remove('open'); },
stash: function () { variantDraftPending = true; variantMask.classList.remove('open'); }
});
kit.register(el('catMask'), {
discard: function () { catDraftPending = false; catDraftFor = null; catMask.classList.remove('open'); },
stash: function () { catDraftPending = true; catMask.classList.remove('open'); }
});
kit.register(el('annMask'), {
discard: function () { try { window.__annDiscard(); } catch (e) { if (window.__silent) window.__silent(e); } },
stash: function () { try { window.__annStash(); } catch (e) { if (window.__silent) window.__silent(e); } }
});
kit.register(el('infoMask'), {
discard: function () { var _im = el('infoMask'); if (_im) _im.classList.remove('open'); },
stash: function () { var _im = el('infoMask'); if (_im) _im.classList.remove('open'); }
});
kit.register(el('pwdMask'), {
discard: function () { var _o = el('oldPwd'), _n = el('newPwd'), _c = el('confirmPwd'); if (_o) _o.value = ''; if (_n) _n.value = ''; if (_c) _c.value = ''; pwdMask.classList.remove('open'); },
stash: function () { pwdMask.classList.remove('open'); }
});
var __confirmCancel = function () {
el('confirmMask').classList.remove('open');
if (confirmCancelCallback) { var cb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; cb(); }
else { confirmCallback = null; confirmCancelCallback = null; }
};
kit.register(el('confirmMask'), { discard: __confirmCancel, stash: __confirmCancel });
kit.register(el('inputMask'), {
discard: function () { inputCallback = null; try { el('inputValue').value = ''; } catch (e) { if (window.__silent) window.__silent(e); } inputMask.classList.remove('open'); },
stash: function () { inputCallback = null; inputMask.classList.remove('open'); }
});
var __bm = el('bindingsMask');
if (__bm) __bm.addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });
kit.register(__bm, { discard: function () { __bm.classList.remove('open'); }, stash: function () { __bm.classList.remove('open'); } });
var __pm = el('previewMask');
var __previewClose = function () { if (__pm) { __pm.classList.remove('open'); try { __pm.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); } } };
kit.register(__pm, { discard: __previewClose, stash: __previewClose });
var __bc = el('batchCatMask');
var __bcClose = function () { if (__bc) __bc.classList.remove('open'); };
kit.register(__bc, { discard: __bcClose, stash: __bcClose });
});



(function () {
var cm = window.__ctxMenu; if (!cm) return;
function __cp(text, msg) {
if (window.__shareCopyText && window.__shareCopyText(text)) { if (typeof toast === 'function') toast(msg, 'success'); var el = window.__ctxMenuLastHit; if (el && el.classList) { el.classList.add('copy-ok-text'); setTimeout(function(){ el.classList.remove('copy-ok-text'); }, 1500); } }
else { if (typeof toast === 'function') toast('复制失败', 'error'); }
}
function __makeAdminShareUrl(pid) {
return window.location.origin + '/shop?pid=' + pid;
}
function __adminProdTitle(pid) {
try { var _p = (state.products || []).find(function (x) { return Number(x.id) === Number(pid); }); return (_p && _p.title) || ''; } catch (e) { return ''; }
}
function __shareAdminFn(pid) {
return function () {
var url = __makeAdminShareUrl(pid);
var _pn = __adminProdTitle(pid);
if (window.showShareLinkModal) window.showShareLinkModal('分享资源链接', url, (_pn ? _pn + ' · ' : '') + '资源链接已复制');
else __cp(url, window.T('copied'));
};
}
function __saveQrAdminFn(pid) {
return function () {

if (window.__savePosterPng) window.__savePosterPng(pid, null, __adminProdTitle(pid));
};
}
function imgItemsAdmin(img) {
var src = img.currentSrc || img.src || '';
if (!src) return [];
var pid = state && state.editingId ? state.editingId : null;
var items = [
{ label: '保存图片', fn: function () { window.__saveImage(src); } },
{ label: '预览大图', fn: function () { if (window.openLightbox) window.openLightbox(src); } }
];
if (pid) {
items.push({ label: '分享资源', fn: __shareAdminFn(pid) });
items.push({ label: '存二维码', fn: __saveQrAdminFn(pid) });
}
return items;
}
function textItemsAdmin(el) {
var full = String(el.innerText || '').trim();
var pid = state && state.editingId ? state.editingId : null;
var items = [{ label: '复制选中', fn: function () {
var sel = '';
try { sel = String(window.getSelection ? window.getSelection() : ''); } catch (e) { if (window.__silent) window.__silent(e); }
if (sel) __cp(sel, '选中内容已复制');
else if (typeof toast === 'function') toast('先选中文字，再长按即可复制', 'info');
} }];
if (full) items.push({ label: '复制全文', fn: function () { __cp(full, '内容已复制'); } });
if (pid) {
items.push({ label: '分享资源', fn: __shareAdminFn(pid) });
items.push({ label: '存二维码', fn: __saveQrAdminFn(pid) });
}
return items;
}
var productList = document.getElementById('productList');
var editMask = document.getElementById('editMask');
var previewMask = document.getElementById('previewMask');
if (productList) {
cm.bind(productList, '.product-row', function (row) {
var pid = Number(row.getAttribute('data-id') || 0);
var p = (state.products || []).find(function (x) { return Number(x.id) === pid; });
if (!p) return [];
return [
{ label: '复制标题', fn: function () { __cp(p.title || '', '标题已复制'); } },
{ label: '复制简介', fn: function () { __cp(p.desc || '', '简介已复制'); } },
{ label: '分享资源', fn: __shareAdminFn(pid) },
{ label: '存二维码', fn: __saveQrAdminFn(pid) }
];
});
}
if (editMask) { cm.bind(editMask, 'img', imgItemsAdmin); }
if (previewMask) { cm.bind(previewMask, 'img', imgItemsAdmin); }
if (editMask) {
cm.bind(editMask, '.modal-box', function (el, e) {
if (e && e.target && e.target.closest && e.target.closest('button, input, textarea, a, select, img, video')) return [];
return textItemsAdmin(el);
});
}
if (previewMask) {
cm.bind(previewMask, '.modal-box', function (el, e) {
if (e && e.target && e.target.closest && e.target.closest('button, input, textarea, a, select, img, video')) return [];
return textItemsAdmin(el);
});
}
})();

(function () {
try {
if (!localStorage.getItem('wnzyq_rte_expand_guide')) {
document.querySelectorAll('.rte-expand').forEach(function (btn) { btn.classList.add('breathe-once'); });
localStorage.setItem('wnzyq_rte_expand_guide', '1');
setTimeout(function () {
document.querySelectorAll('.rte-expand').forEach(function (btn) { btn.classList.remove('breathe-once'); });
}, 2500);
}
} catch (e) { if (window.__silent) window.__silent(e); }
})();
__updateUndoRedo();

(function () {
var btn = document.getElementById('pvResourceCodeBtn');
var inputEl = document.getElementById('pvResourceCodeInput');
if (btn) btn.addEventListener('click', pvVerifyCode);
if (inputEl) {
inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') pvVerifyCode(); });
var __pvLast = '';
inputEl.addEventListener('input', function () {
var val = String(this.value || '').trim();
if (val.length >= 8 && val !== __pvLast) { __pvLast = val; pvVerifyCode(); }
else if (val.length < 8) { __pvLast = ''; }
});
}
})();



(function () {
var KEY = 'wnzyq_admin_scroll_y';
var t = null;
window.addEventListener('scroll', function () {
if (t) clearTimeout(t);
t = setTimeout(function () { try { sessionStorage.setItem(KEY, String(window.scrollY || 0)); } catch (e) { if (window.__silent) window.__silent(e); } }, 200);
}, { passive: true });
document.addEventListener('click', function (e) {
var el = e.target && e.target.closest ? e.target.closest('.tab, [class*=tab]') : null;
if (!el) return;
var txt = (el.textContent || '');
if (/资源管理|资源/.test(txt)) {
setTimeout(function () {
try { var y = parseInt(sessionStorage.getItem(KEY) || '0', 10); if (y > 0) window.scrollTo(0, y); } catch (e2) { if (window.__silent) window.__silent(e2); }
}, 400);
}
}, true);
})();

boot();




window.doLogin = typeof doLogin !== 'undefined' ? doLogin : window.doLogin;
window.togglePwdVisibility = typeof togglePwdVisibility !== 'undefined' ? togglePwdVisibility : window.togglePwdVisibility;
window.toggleModalPwdVisibility = typeof toggleModalPwdVisibility !== 'undefined' ? toggleModalPwdVisibility : window.toggleModalPwdVisibility;

(function () { var el = document.getElementById('editTitle'); if (el) el.addEventListener('blur', function () { try { validateField('title'); } catch (e) { if (window.__silent) window.__silent(e); } }); })();



(function() {
var limits = {
'fTitle': 100, 'fDesc': 200, 'fImg': 500, 'fContactUrl': 500,
'catName': 50, 'infoUrlContact': 500, 'infoUrlGroup': 500,
'loginUser': 50, 'loginPass': 50, 'adminSearch': 50,
'oldPwd': 50, 'newPwd': 50, 'confirmPwd': 50
};
function bindLimit(id, max) {
var el = document.getElementById(id);
if (!el) return;
el.addEventListener('input', function() {
if (this.value.length > max) this.value = this.value.slice(0, max);
});
}
for (var k in limits) bindLimit(k, limits[k]);
})();


function __syncTopbarH() {
try {
var tb = document.querySelector('.topbar');
if (!tb) return;
document.documentElement.style.setProperty('--topbar-h', (tb.offsetHeight || 64) + 'px');
} catch (e) { if (window.__silent) window.__silent(e); }
}
window.addEventListener('resize', __syncTopbarH);
if (document.readyState !== 'loading') setTimeout(__syncTopbarH, 0); else document.addEventListener('DOMContentLoaded', __syncTopbarH);

function boot() {
var isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if (!isLocal) {
api('health').then(function (h) {
if (h && h.ok && !h.ready) {
api('install', { method: 'POST' }).catch(function () {});
}
}).catch(function () {});
}
if (!isLocal) {
api('admin/session').then(function (s) {
if (s.ok) { showMain(s.username); if (window.__applyMe) window.__applyMe(s.username); }
else { showLogin(); }
});
} else {
showLogin();
}
}

function showLogin() {
window.__adminLoggedIn = false;
loginView.style.display = 'flex'; mainView.style.display = 'none';
try {
var lastUser = localStorage.getItem('wnzyq_last_user');
if (lastUser && loginUser && !loginUser.value) { loginUser.value = lastUser; if (loginPass) { try { loginPass.focus({ preventScroll: true }); } catch (e1) { loginPass.focus(); } } }
} catch (e) { if (window.__silent) window.__silent(e); }
}

function showMain(username) {

try {
var __gc = function () { try { fetch('/api/admin/global-cleanup', { method: 'POST', credentials: 'include' }).catch(function () {}); } catch (e) {} };
__gc();
if (!window.__gcTimer) window.__gcTimer = setInterval(__gc, 30 * 60 * 1000);
} catch (e) {}
window.__adminLoggedIn = true;
loginView.style.display = 'none';
mainView.style.display = 'block';
try { localStorage.setItem('wnzyq_login_at', String(Date.now())); } catch (e) { if (window.__silent) window.__silent(e); }
window.__adminBackBound = 1;
try { setTimeout(function () { if (window.__restoreEditingDraft) window.__restoreEditingDraft(); }, 200); } catch (e) { if (window.__silent) window.__silent(e); }
function _safe(fn) { try { fn(); } catch (e) { } }
window.__plC = 1; window.__plP = 1;
var _cache = __getAdminCache();
var _hasCache = _cache._cacheFormat === ('sch' + String((window.WN_CONST && window.WN_CONST.CACHE_SCHEMA) || 4)) && _cache.products && _cache.products.length && _cache.timestamp && (Date.now() - _cache.timestamp < 600000);
if (_hasCache) {
state.products = _cache.products || [];
state.categories = _cache.categories || [];
state.settings = _cache.settings || {};
state.statsOverview = _cache.statsOverview;
state.statsOverviewPrev = _cache.statsOverviewPrev;
state.statsTrend = _cache.statsTrend;
state.statsTrendPrev = _cache.statsTrendPrev;
state.statsDays = _cache.statsDays || 1;
state.statByProduct = _cache.statByProduct;
state.statByCategory = _cache.statByCategory;
state.statRecent = _cache.statRecent;
state._backendPaged = true;
var _sd = state.statsDays || 1;
__statsCache[_sd] = { end: __bjToday(), res: { ok: true, overview: state.statsOverview, overview_prev: state.statsOverviewPrev, trend: state.statsTrend, trend_prev: state.statsTrendPrev, byProduct: state.statByProduct, byCategory: state.statByCategory, recent: state.statRecent } };
__loadBindingsCache();
_safe(function () { renderProducts(); });
_safe(function () { renderCategories(state.categories); });
_safe(function () { if (state.statsOverview) { __updateStatTitles(); renderStatCards(state.statsOverview, state.statsOverviewPrev); renderLineChart(state.statsTrend, state.statsCmpPrev ? state.statsTrendPrev : null);renderStatTables(); } });
_safe(function () { if (state.settings) { if (window.__infoApply) window.__infoApply(state.settings); document.getElementById('annMode').value = state.settings.announcement_mode || 'always'; syncSelectDisplay(document.getElementById('annMode')); if (window.__annModeHint) window.__annModeHint(); } });
}
window.__adminEntryDone = false;
if (window.__enterPageEntryMode) window.__enterPageEntryMode();
loadAdminHome(_hasCache ? 1 : 0).then(function () {
window.__adminEntryDone = true;
if (window.__exitPageEntryMode) window.__exitPageEntryMode();
}).catch(function () {
window.__adminEntryDone = true;
if (window.__exitPageEntryMode) window.__exitPageEntryMode();
});
try { switchTab('products'); } catch (e) { }
}
