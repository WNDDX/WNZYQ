document.getElementById('addProductBtn').addEventListener('click', function () { openEdit(null); });

function openEdit(p) {
state.editingId = p ? p.id : null;
state.editingProduct = p;
editTitle.textContent = p ? '编辑资源' : '新增资源';

try { if (typeof loadCategories === 'function') loadCategories(true); } catch (eLC) {}
fillCidSelect(p ? p.cid : 0);
fillProductForm(p);
try {
var dd = __editDrafts[p ? p.id : 'new'];
if (dd) {

window.__linkify = function (html) {
try {
var doc = new DOMParser().parseFromString('<div id="__lw">' + html + '</div>', 'text/html');
var root = doc.getElementById('__lw');
if (!root) return html;
var walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
var nodes = [];
while (walker.nextNode()) nodes.push(walker.currentNode);
nodes.forEach(function (n) {
var p = n.parentNode;
if (p && p.tagName === 'A') return;
var v = n.nodeValue || '';
if (v.indexOf('http') < 0) return;
var parts = v.split(/(https?:\/\/[^\s<>"'，。；）】\]]+)/g);
if (parts.length < 2) return;
var frag = doc.createDocumentFragment();
parts.forEach(function (t) {
if (!t) return;
if (/^https?:\/\//.test(t)) {
var a = doc.createElement('a');
a.setAttribute('href', t);
a.setAttribute('target', '_blank');
a.setAttribute('rel', 'noopener');
a.textContent = t;
frag.appendChild(a);
} else {
frag.appendChild(doc.createTextNode(t));
}
});
p.replaceChild(frag, n);
});
return root.innerHTML;
} catch (e) { return html; }
};

fTitle.value = dd.title || ''; fDesc.value = dd.desc || ''; fDetail.innerHTML = window.__linkify(sanitizeHTML(dd.detail || ''));
try { if (window.__setCoverImages) window.__setCoverImages(JSON.parse(dd.cover_images || '[]')); } catch(e) { if (window.__setCoverImages) window.__setCoverImages([]); }
}
} catch (e) { if (window.__silent) window.__silent(e); }
updateImgPreview();
editMask.classList.add('open');

if (window.__modalScroll) __modalScroll.open(editMask, p ? p.id : 'new');
state.variants = (p && p.id && Array.isArray(p.variants)) ? p.variants.slice() : [];
renderVariants();
if (p && p.id && !Array.isArray(p.variants)) loadVariants(p.id);
}


try { window.__openEdit = openEdit; } catch (eOE) {}

function fillProductForm(p) {
fTitle.value = p ? (p.title || '') : '';

clearFieldErr(fTitle);
clearFieldErr(document.getElementById('fCidDisplay'));
fDesc.value = p ? (p.desc || '') : '';
fDetail.innerHTML = p ? window.__linkify(sanitizeHTML(p.detail || '')) : '';
var _covArr = p ? (p.coverImages || (p.img ? [p.img] : [])) : [];
if (window.__setCoverImages) window.__setCoverImages(_covArr);
else { fImg.value = p ? (p.img || '') : ''; }
fContactUrl.value = p ? (p.contactUrl || '') : '';
fContactQr.value = p ? (p.contactQr || '') : '';
__edContactRefresh();
fPrice.value = p ? (p.price || '') : '';
fSort.value = p ? (p.sort || 0) : 0;
fOnline.checked = p ? !!(p.is_online && !p.is_hidden) : true;
fScheduleOn.value = p ? (p.schedule_on || '') : '';
fScheduleOff.value = p ? (p.schedule_off || '') : '';
updateImgPreview();
}

var draftTimer = null;
function stopAutoSaveDraft() {
if (draftTimer) { clearInterval(draftTimer); draftTimer = null; }
}
var __editDrafts = {};
try { for (var __lk = localStorage.length - 1; __lk >= 0; __lk--) { var __lkn = localStorage.key(__lk); if (__lkn && __lkn.indexOf('product_draft_') === 0) localStorage.removeItem(__lkn); } } catch (e) { if (window.__silent) window.__silent(e); }
function saveDraft() {
if (!editMask.classList.contains('open')) return;
var draftData = {
title: fTitle.value,
desc: fDesc.value,
detail: serializeDetail(),
img: (window.__coverMainImage ? window.__coverMainImage() : fImg.value),
cover_images: JSON.stringify(window.__coverImages ? window.__coverImages() : (fImg.value ? [fImg.value] : [])),
contactUrl: fContactUrl.value,
contactQr: fContactQr.value,
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
try { delete __editDrafts[state.editingId || 'new']; } catch (e) { if (window.__silent) window.__silent(e); }

try { if (window.__modalScroll) __modalScroll.forget(document.getElementById('editMask'), state.editingId || 'new'); } catch (e) { if (window.__silent) window.__silent(e); }
stopAutoSaveDraft();
}


var __imgPreviewTimer = null;
var __lastBadUrl = null;
function _safeSetPreview(preview, url, opts) {
opts = opts || {};
if (!preview) return;
clearTimeout(__imgPreviewTimer);
if (url) {
if (preview.getAttribute('src') !== url) { preview.removeAttribute('src'); preview.classList.remove('media-fail'); }
preview.classList.add('show');
} else if (opts.hideEmpty) {
preview.style.display = 'none';
preview.classList.remove('show');
return;
}
var doLoad = function () {
if (url) {
if (url === __lastBadUrl) {
preview.onerror = null; preview.dataset.fh = '1';
preview.src = window.WN_MEDIA_FALLBACK; if (preview && preview.classList) preview.classList.add('media-fail');
preview.classList.add('show');
return;
}

var _tUrl = thumbOf(url);
var probe = new Image();
probe.onload = function () {
preview.onerror = null; delete preview.dataset.fh;
preview.classList.remove('media-fail');
preview.src = _tUrl;
preview.classList.add('show');
};
probe.onerror = function () {
if (_tUrl !== url) {
var probe2 = new Image();
probe2.onload = function () {
preview.onerror = null; delete preview.dataset.fh;
preview.classList.remove('media-fail');
preview.src = url;
preview.classList.add('show');
};
probe2.onerror = function () {
__lastBadUrl = url;
preview.onerror = null; preview.dataset.fh = '1';
preview.src = window.WN_MEDIA_FALLBACK; if (preview && preview.classList) preview.classList.add('media-fail');
preview.classList.add('show');
};
probe2.src = url;
return;
}
__lastBadUrl = url;
preview.onerror = null; preview.dataset.fh = '1';
preview.src = window.WN_MEDIA_FALLBACK; if (preview && preview.classList) preview.classList.add('media-fail');
preview.classList.add('show');
};
probe.src = _tUrl;
} else {
preview.onerror = null; preview.dataset.fh = '1'; __lastBadUrl = null;
preview.src = window.WN_MEDIA_FALLBACK; if (preview && preview.classList) preview.classList.add('media-fail');
preview.classList.add('show');
}
};
if (opts.noDebounce) { doLoad(); } else { __imgPreviewTimer = setTimeout(doLoad, 300); }
}
function updateImgPreview() {
var url = (window.__coverMainImage ? window.__coverMainImage() : fImg.value).trim();
_safeSetPreview(document.getElementById('fImgPreview'), url, { hideEmpty: true, noDebounce: true });
}
fImg.addEventListener('input', updateImgPreview);

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
empty.innerHTML = window.__adminEmpty('该站点暂无分类', '请先到「分类管理」添加分类');
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


if (expanded) {
childBox.style.maxHeight = '0px';
void childBox.offsetHeight;
childBox.style.maxHeight = childBox.scrollHeight + 'px';
} else {
childBox.style.maxHeight = '0px';
}


if (expanded) {
setTimeout(function () {
try { if (pickerEl.classList.contains('open')) positionCatPanel(pickerEl); } catch (ePC2) { if (window.__silent) window.__silent(ePC2); }
}, 300);
} else {
try { positionCatPanel(pickerEl); } catch (ePC) { if (window.__silent) window.__silent(ePC); }
}
});
row.appendChild(chev);
}
row.addEventListener('click', function () { pickCatValue(pickerEl, hiddenInput, displayEl, top.id, top.name); });
panelEl.appendChild(row);
var childBox = document.createElement('div');
childBox.className = 'cp-children';
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
else { txtEl.textContent = opts.placeholder || '请选择资源分类'; txtEl.classList.add('placeholder'); }
hiddenInput.value = sel || 0;
}
function pickCatValue(pickerEl, hiddenInput, displayEl, id, name, grey) {
hiddenInput.value = id;
var txtEl = displayEl.querySelector('.cpd-text');
txtEl.textContent = name;
txtEl.classList.toggle('placeholder', !!grey);
document.querySelectorAll('.cat-picker.open, .select-picker.open').forEach(function (p) {
p.classList.remove('open');

var pp = p.querySelector('.cat-picker-panel');
if (!pp && p.dataset.pickerId) pp = document.querySelector('.cat-picker-panel[data-picker-id="' + p.dataset.pickerId + '"]');
if (pp) { if (pp.parentNode !== p) p.appendChild(pp); pp.classList.remove('open'); }
});
pickerEl.querySelectorAll('.cp-item.selected').forEach(function (el) { el.classList.remove('selected'); });
if (!document.getElementById('batchCatMask').classList.contains('open') && !document.getElementById('catMask').classList.contains('open') && typeof onProductCidChange === 'function') onProductCidChange(id);
}
document.addEventListener('click', function (e) {
var disp = e.target.closest ? e.target.closest('.cat-picker-display') : null;
if (disp) {
var picker = disp.closest('.cat-picker, .select-picker');
var wasOpen = picker.classList.contains('open');
document.querySelectorAll('.cat-picker.open, .select-picker.open').forEach(function (p) {
p.classList.remove('open');
var pp = p.querySelector('.cat-picker-panel');
if (!pp && p.dataset.pickerId) pp = document.querySelector('.cat-picker-panel[data-picker-id="' + p.dataset.pickerId + '"]');
if (pp) { if (pp.parentNode !== p) p.appendChild(pp); pp.classList.remove('open'); }
});
if (!wasOpen) {
picker.classList.add('open');

var pp = picker.querySelector('.cat-picker-panel');
if (!pp && picker.dataset.pickerId) pp = document.querySelector('.cat-picker-panel[data-picker-id="' + picker.dataset.pickerId + '"]');
if (pp) {

if (!pp.querySelector('.cp-item')) {
try {
if (picker.id === 'filterCatPicker' && typeof initFilterCatPicker === 'function') initFilterCatPicker();
else {
var _sib = picker.nextElementSibling;
if (_sib && _sib.tagName === 'SELECT') { var _ref = spRefs.get(_sib); if (_ref && _ref.refresh) _ref.refresh(); }
}
} catch (eLR) { if (window.__silent) window.__silent(eLR); }
pp = picker.querySelector('.cat-picker-panel') || pp;
}

if (!pp.querySelector('.cp-item')) { picker.classList.remove('open'); pp.classList.remove('open'); return; }

if (pp.parentNode !== document.body) document.body.appendChild(pp);
pp.classList.add('open');
}
positionCatPanel(picker);

requestAnimationFrame(function () { requestAnimationFrame(function () { if (picker.classList.contains('open')) positionCatPanel(picker); }); });
setTimeout(function () { if (picker.classList.contains('open')) positionCatPanel(picker); }, 320);
}
return;
}
if (!(e.target.closest && (e.target.closest('.cat-picker') || e.target.closest('.select-picker')))) {
document.querySelectorAll('.cat-picker.open, .select-picker.open').forEach(function (p) {
p.classList.remove('open');
var pp = p.querySelector('.cat-picker-panel');
if (!pp && p.dataset.pickerId) pp = document.querySelector('.cat-picker-panel[data-picker-id="' + p.dataset.pickerId + '"]');
if (pp) { if (pp.parentNode !== p) p.appendChild(pp); pp.classList.remove('open'); }
});
}
});
function positionCatPanel(picker) {
var panel = picker.querySelector('.cat-picker-panel');
if (!panel && picker.dataset.pickerId) {
panel = document.querySelector('.cat-picker-panel[data-picker-id="' + picker.dataset.pickerId + '"]');
}
var disp = picker.querySelector('.cat-picker-display');
if (!panel || !disp) return;
var r = disp.getBoundingClientRect();

var mb = picker.closest ? picker.closest('.modal-box') : null;
var mbr = mb ? mb.getBoundingClientRect() : null;
var limTop = mbr ? Math.max(8, mbr.top + 8) : 8;
var limBot = mbr ? Math.min((window.innerHeight || 900) - 8, mbr.bottom - 8) : (window.innerHeight || 900) - 8;
var want = panel.scrollHeight || 240;
var spaceBelow = limBot - (r.bottom + 4);
var spaceAbove = (r.top - 4) - limTop;
var top, maxH;
if (spaceBelow >= want || spaceBelow >= spaceAbove) {
top = r.bottom + 4;
maxH = Math.max(96, Math.min(want, spaceBelow));
} else {
maxH = Math.max(96, Math.min(want, spaceAbove));
top = Math.max(limTop, r.top - 4 - maxH);
}
panel.style.maxHeight = maxH + 'px';
panel.style.top = top + 'px';

try {
var _selItem = panel.querySelector('.cp-item.selected');
if (_selItem) {
var _pr = panel.getBoundingClientRect(), _sr = _selItem.getBoundingClientRect();
if (_sr.top < _pr.top + 4 || _sr.bottom > _pr.bottom - 4) {
panel.scrollTop = _selItem.offsetTop - Math.max(0, (panel.clientHeight - _selItem.offsetHeight) / 2);
}
}
} catch (eSel) { if (window.__silent) window.__silent(eSel); }

var left = r.left;
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
left = Math.max(8, Math.min(left, (window.innerWidth || 390) - w - 8));
panel.style.left = left + 'px';
panel.style.width = w + 'px';
}
var spRefs = new Map();
function makeSelectPicker(sel) {
if (!sel || sel.dataset.sp) return spRefs.get(sel);
sel.dataset.sp = '1';
var holder = document.createElement('div');
holder.className = 'select-picker';
var __spid = 'sp-' + Math.random().toString(36).slice(2,9);
holder.dataset.pickerId = __spid;
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
panel.dataset.pickerId = __spid;
function render() {
panel.innerHTML = '';
txt.textContent = sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '请选择';
txt.classList.toggle('placeholder', !sel.value);
Array.from(sel.options).forEach(function (o) {
var it = document.createElement('div');
it.className = 'cp-item' + (String(o.value) === String(sel.value) ? ' selected' : '');
it.textContent = o.textContent;
if (o.style && o.style.cssText) it.style.cssText = o.style.cssText;
it.addEventListener('click', function () {
sel.value = o.value;
txt.textContent = o.textContent;
txt.classList.remove('placeholder');
holder.classList.remove('open');
if (panel.parentNode !== holder) { holder.appendChild(panel); }
panel.classList.remove('open');
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
var ref = { el: holder, refresh: render, sel: sel, panel: panel };
spRefs.set(sel, ref);
return ref;
}
function syncSelectDisplay(sel) {
var ref = spRefs.get(sel);
if (ref && ref.refresh) ref.refresh();
}
function upgradeAllSelects() {
document.querySelectorAll('select').forEach(function (sel) {
makeSelectPicker(sel);
});
}
upgradeAllSelects();

window.makeSelectPicker = makeSelectPicker;
window.__syncSelectDisplay = syncSelectDisplay;
window.syncSelectDisplay = syncSelectDisplay;

window.__upgradeSelects = function (root) {
var scope = root || document;
var list = [];
try { list = scope.querySelectorAll('select'); } catch (e) { return 0; }
var n = 0;
for (var i = 0; i < list.length; i++) {
var sel = list[i];
if (sel.dataset && sel.dataset.sp) continue;
try { makeSelectPicker(sel); n++; } catch (e2) {}
}
return n;
};

document.querySelectorAll('.cat-picker').forEach(function (pk) {
if (pk.dataset.pickerId) return;
var pp = pk.querySelector('.cat-picker-panel');
if (!pp) return;
var _id = 'cp-' + Math.random().toString(36).slice(2, 9);
pk.dataset.pickerId = _id;
pp.dataset.pickerId = _id;
});

function initFilterCatPicker() {
var fp = document.getElementById('filterCatPicker');
if (!fp) return;
buildCatPicker(
fp,
document.getElementById('filterCat'),
fp.querySelector('.cat-picker-display'),
document.getElementById('filterCatPanel'),
0,
{ excludeZero: false, showAll: true, allLabel: '全部分类', }
);

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
if (__dt0) { __dt0.textContent = '全部分类'; __dt0.classList.add('placeholder'); }
}
} catch (e0) { if (window.__silent) window.__silent(e0); }
}
function onProductCidChange(id) {
var d = document.getElementById('fCidDisplay'); if (d) { d.style.borderColor = ''; d.style.boxShadow = ''; }
clearFieldErr(d);
var em = document.getElementById('editMask');
if (em && !em.classList.contains('open')) {
adminPage = 1;

if (window.__reloadAdminProducts) window.__reloadAdminProducts(); else renderProducts();
}
}

function fillCidSelect(selected) {
buildCatPicker(
document.getElementById('fCidPicker'), fCid,
document.getElementById('fCidDisplay'), document.getElementById('fCidPanel'),
selected, { allowUncategorized: true, }
);
}

saveProductBtn.addEventListener('click', saveProduct);
editCancel.addEventListener('click', function () { try { if (window.__fcSweepEdit) window.__fcSweepEdit(editMask); } catch (e) {} editMask.classList.remove('open'); clearDraft(); try { if (window.__extAfterEditClose) window.__extAfterEditClose(); } catch (eRC) {} });
editMask.addEventListener('click', function (e) { if (e.target === editMask) { saveDraft(); editMask.classList.remove('open'); try { if (window.__extAfterEditClose) window.__extAfterEditClose(); } catch (eRC) {} } });

function validateField(input, msg) {
if (!input || !input.value || !String(input.value).trim()) {
input.style.borderColor = '#ff4444';
input.style.boxShadow = '0 0 0 3px rgba(255,68,68,0.15)';
toast(msg || '请填写必填项', 'error');
try { input.focus({ preventScroll: true }); } catch (e1) { input.focus(); }
return false;
}
input.style.borderColor = '';
input.style.boxShadow = '';
return true;
}
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
if (err) err.remove();
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
function serializeDetail() {
var clone = fDetail.cloneNode(true);
try { clone.querySelectorAll('.rte-img-del').forEach(function (d) { d.remove(); }); } catch (e0) { if (window.__silent) window.__silent(e0); }
try { clone.querySelectorAll('.rte-media-sel').forEach(function (m) { m.classList.remove('rte-media-sel'); }); } catch (e1) { if (window.__silent) window.__silent(e1); }
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

window.__rteClean = function (el) {
if (!el) return '';
var c = el.cloneNode(true);
try { c.querySelectorAll('.rte-img-del').forEach(function (d) { d.remove(); }); } catch (e0) { if (window.__silent) window.__silent(e0); }
try { c.querySelectorAll('.rte-media-sel').forEach(function (m) { m.classList.remove('rte-media-sel'); }); } catch (e1) { if (window.__silent) window.__silent(e1); }
return c.innerHTML;
};
function saveProduct() {
if (saving) return;
var data = {
cid: Number(fCid.value) || 0,
title: fTitle.value.trim(),
desc: fDesc.value.trim(),
detail: serializeDetail(),
img: (window.__coverMainImage ? window.__coverMainImage() : (fImg.value ? fImg.value.trim() : '')),
cover_images: JSON.stringify(window.__coverImages ? window.__coverImages() : (fImg.value ? [fImg.value] : [])),
detailImages: [],
detailVideos: [],
contactUrl: fContactUrl.value.trim(),
contactQr: fContactQr.value.trim(),
price: Number(fPrice.value) || 0,
sort: Number(fSort.value) || 0,
is_online: fOnline.checked,
is_hidden: false,
schedule_on: fScheduleOn.value || '',
schedule_off: fScheduleOff.value || '',
updated_at: (state.editingProduct && state.editingProduct.updated_at) || ''
};
if (!validateField(fTitle, '请填写资源标题')) return;
if (data.cid === undefined || data.cid === null) { toast('请选择资源分类', 'error'); document.getElementById('fCidDisplay').style.borderColor = '#ff4444'; document.getElementById('fCidDisplay').style.boxShadow = '0 0 0 3px rgba(255,68,68,0.15)'; return; }

if (!Number(data.cid)) {
setTimeout(function () {
try { window.showToast('这条没选分类，只会出现在资源页「全部」里，分类里找不到——建议补一个分类', 'info'); } catch (e) {}
}, 900);
}


try {
if (!window.__dupConfirmed) {
var _dup = (state.products || []).filter(function (p) {
return String(p.title || '').trim() === data.title && Number(p.id) !== Number(state.editingId || 0);
});
if (_dup.length && window.showConfirm) {
window.showConfirm('标题重复', '已经有一条同名资源「' + data.title + '」，确定还要再存一条吗？', function (closeConfirm) {
closeConfirm();
window.__dupConfirmed = true;
try { saveProduct(); } finally { setTimeout(function () { window.__dupConfirmed = false; }, 1200); }
});
return;
}
}
} catch (eD) { if (window.__silent) window.__silent(eD); }

saving = true;
var isNewSave = !state.editingId;
saveProductBtn.disabled = true;
if (window.__btnBusy) window.__btnBusy(saveProductBtn, '确定中');

var req = state.editingId
? api('admin/products/' + state.editingId, { method: 'PUT', body: JSON.stringify(data) })
: api('admin/products', { method: 'POST', body: JSON.stringify(data) });

req.then(function (res) {
saving = false;
if (res && res.ok) {
if (!state.editingId && res.id) {
state.editingId = res.id;
var pend = (state.variants || []).slice();
(function next(i) {
if (i >= pend.length) return;
var vd = Object.assign({}, pend[i], { productId: res.id });
api('admin/variants', { method: 'POST', body: JSON.stringify(vd) }).then(function () { next(i + 1); }).catch(function () { next(i + 1); });
})(0);
}
var _sp = (state.products || []).find(function (x) { return x.id === state.editingId; });
if (_sp) {
_sp.cid = data.cid; _sp.title = data.title; _sp.desc = data.desc; _sp.detail = data.detail;
_sp.img = data.img; _sp.contactUrl = data.contactUrl; _sp.contactQr = data.contactQr || ''; _sp.price = data.price;
_sp.is_online = data.is_online ? 1 : 0; _sp.is_hidden = data.is_hidden ? 1 : 0;
_sp.schedule_on = data.schedule_on || ''; _sp.schedule_off = data.schedule_off || ''; _sp.sort = data.sort;
_sp.variants = (state.variants || []).slice();
try { _sp.coverImages = JSON.parse(data.cover_images || '[]'); } catch(e) { _sp.coverImages = []; }
} else if (res.id) {
state.products.push({ id: res.id, cid: data.cid, title: data.title, desc: data.desc, detail: data.detail,
img: data.img, detailImages: [], detailVideos: [], contactUrl: data.contactUrl, contactQr: data.contactQr || '', price: data.price,
is_online: data.is_online ? 1 : 0, is_hidden: data.is_hidden ? 1 : 0,
schedule_on: data.schedule_on || '', schedule_off: data.schedule_off || '', sort: data.sort,
coverImages: (function(){ try { return JSON.parse(data.cover_images || '[]'); } catch(e){ return []; } })(),
variants: (state.variants || []).slice() });
}

if (window.__btnSuccess) window.__btnSuccess(saveProductBtn, window.T('saved'));
setTimeout(function () { editMask.classList.remove('open'); try { if (window.__extAfterEditClose) window.__extAfterEditClose(); } catch (eRC) {} }, 400);
if (isNewSave) { try { delete __editDrafts['new']; } catch (e) { if (window.__silent) window.__silent(e); } }
clearDraft();
try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }

try { if (window.__extAfterProductSave) window.__extAfterProductSave(res.id || state.editingId); } catch (eES) {}
if (window.__haptic) window.__haptic();
clearCache();

try {
var _oldP = (state.products || []).find(function (x) { return x.id === state.editingId; });
var _oldText = _oldP ? ((_oldP.detail || '') + (_oldP.img || '') + (_oldP.detailImages || []).join('') + (_oldP.detailVideos || []).join('') + (_oldP.coverImages || []).join('') + ((_oldP.variants || []).map(function (v) { return v.desc || ''; }).join(''))) : '';
var _newKeys = window.__collectFileKeys((data.detail || '') + (data.img || '') + (data.cover_images || ''));
var _gone = window.__collectFileKeys(_oldText).filter(function (k) { return _newKeys.indexOf(k) === -1; });
if (_gone.length && state.editingId) api('admin/cleanup-files', { method: 'POST', body: JSON.stringify({ keys: _gone }) }).catch(function () {});
} catch (e) { if (window.__silent) window.__silent(e); }
renderProducts();

try {
var _fr = document.querySelector('#productList [data-id="' + state.editingId + '"]');
if (_fr) { _fr.classList.add('row-flash'); setTimeout(function () { _fr.classList.remove('row-flash'); }, 1600); }
} catch (e) { if (window.__silent) window.__silent(e); }
refreshCatCnts();
silentSyncProducts();
} else {
saveProductBtn.disabled = false; saveProductBtn.textContent = '确定';
toast(res.msg || '保存失败', 'error');
}
}).catch(function () {
saving = false;
saveProductBtn.disabled = false; saveProductBtn.textContent = '确定';
toast(window.T('netFail'), 'error');
});
}

function loadVariants(productId) {
api('admin/variants?product_id=' + productId).then(function (res) {
if (res && res.ok) {
state.variants = res.list || [];
var _p = (state.products || []).find(function (x) { return x.id === productId; });
if (_p) _p.variants = (res.list || []).slice();
renderVariants();
}
});
}

function renderVariants() {
variantListEl.innerHTML = '';
if (!state.variants.length) {

variantListEl.innerHTML = '';
return;
}
state.variants.forEach(function (v, idx) {
var item = document.createElement('div');
item.className = 'variant-item';
item.draggable = false;
item.dataset.idx = idx;
if (v.id) item.dataset.vid = v.id;
item.style.cursor = 'default';

var handle = document.createElement('span');
handle.className = 'drag-handle'; handle.draggable = true; handle.title = '拖动排序';
handle.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>';

var name = document.createElement('span');
name.className = 'v-name';
name.textContent = v.name || '(未命名)';
if (v.isHidden) {
var hideBadge = document.createElement('span');
hideBadge.style.cssText = 'font-size:12px;color:#b26a00;background:#fff3e0;padding:2px 8px;border-radius:3px; /* v293（用户 10-04 02:14）：054圆角统一→4px不在5档阶梯(3/8/10/14/999)，改3px跟微装饰档统一 */ margin-left:8px;font-weight:600;';
hideBadge.textContent = '隐藏';
name.appendChild(hideBadge);
}

var _viPriceText = formatPrice(v.price);
var _vipEl = null;
if (_viPriceText) {
var _vip = document.createElement('span');
_vip.className = 'v-price';
_vip.textContent = _viPriceText;
_vipEl = _vip;
}
if (!_vipEl) {
_vipEl = document.createElement('span');
_vipEl.className = 'price-slot-ph';
}

var codeSpan = document.createElement('span');

codeSpan.className = 'v-code-group';
codeSpan.style.cssText = 'display:inline-flex;align-items:center;gap:6px;flex-shrink:0;';
if (v.resourceCode && v.resourceCode.trim()) {
var codeBtn = document.createElement('button');
codeBtn.type = 'button';
codeBtn.className = 'row-btn code-slot';
codeBtn.style.cssText = 'font-family:monospace;letter-spacing:1px;font-weight:600;background:var(--blue1);color:#fff;border-color:var(--blue1);';
codeBtn.textContent = v.resourceCode;
codeBtn.title = v.resourceCode + '（点击复制并发新码）';
(function (cvObj, cBtn) {

if (window.__me && window.__me.role !== 'super') {
cBtn.disabled = true;
cBtn.style.cursor = 'default';
cBtn.title = '仅超级管理员可发码';
return;
}
cBtn.addEventListener('click', function (ev) {
ev.preventDefault(); ev.stopPropagation();

if (!cvObj || !cvObj.id) {
var ok0 = window.__shareCopyText ? window.__shareCopyText(cvObj ? cvObj.resourceCode : '') : false;
toast(ok0 ? '已复制' : '复制失败', ok0 ? 'success' : 'error');
return;
}

if (cBtn.disabled || window.__issueInFlight) return;
cBtn.disabled = true;
if (window.__btnBusy) window.__btnBusy(cBtn, '发码中'); else cBtn.textContent = '发码中';
__issueCode(cvObj, function () { renderVariants(); });
});
})(v, codeBtn);
codeSpan.appendChild(codeBtn);
} else {
var noCodeBtn = document.createElement('button');
noCodeBtn.type = 'button';
noCodeBtn.className = 'row-btn code-slot';
noCodeBtn.style.cssText = 'color:var(--text-light);cursor:default;';
noCodeBtn.textContent = '无资源码';
codeSpan.appendChild(noCodeBtn);
var _bph = document.createElement('span');
_bph.className = 'bind-slot-ph';
}

if (v.resourceCode && v.resourceCode.trim()) {
var bindSpan = document.createElement('button');
var bindN = Number(v.bindings) || 0;
bindSpan.type = 'button';
bindSpan.className = 'row-btn bind-slot';
bindSpan.textContent = '资源码';
if (window.__decorateBtn) window.__decorateBtn(bindSpan, 'key', 4);
bindSpan.title = '查看该类型的资源码与绑定设备';
bindSpan.addEventListener('click', function () { openBindings(v); });
}

var sort = document.createElement('span');
sort.className = 'v-sort';
sort.textContent = '排序:' + (idx + 1);

var editBtn = document.createElement('button');

editBtn.className = 'row-btn v-edit-btn';
editBtn.textContent = '编辑';
if (window.__decorateBtn) window.__decorateBtn(editBtn, 'edit', 1);
editBtn.addEventListener('click', function () { openVariantEdit(v); });

var delBtn = document.createElement('button');

delBtn.className = 'row-btn danger v-del-btn';
delBtn.textContent = '删除';
if (window.__decorateBtn) window.__decorateBtn(delBtn, 'del', 6);
delBtn.addEventListener('click', function () { state._delVariantRef = v; delVariant(v.id); });

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

var _vl = document.getElementById('variantList') || item.parentNode;
var _flip = (window.__motion && __motion.flipSnap) ? __motion.flipSnap(_vl, '.variant-item') : null;
var moved = state.variants.splice(fromIdx, 1)[0];
state.variants.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved);
state.variants.forEach(function (v2, i) { v2.sort = i + 1; });
renderVariants();
try { if (_flip) _flip(); } catch (e2) { if (window.__silent) window.__silent(e2); }
});


var _gMain = document.createElement('span'); _gMain.className = 'v-group v-main-group';
_gMain.appendChild(name); if (_vipEl) _gMain.appendChild(_vipEl); _gMain.appendChild(sort);
var _gAct = document.createElement('span'); _gAct.className = 'v-group v-act-group';
if (typeof bindSpan !== 'undefined' && bindSpan && bindSpan.parentNode == null) _gAct.appendChild(bindSpan);
else if (typeof _bph !== 'undefined' && _bph && !_bph.parentNode) _gAct.appendChild(_bph);
_gAct.appendChild(editBtn); _gAct.appendChild(delBtn);
item.appendChild(handle);
item.appendChild(_gMain);
item.appendChild(codeSpan);
item.appendChild(_gAct);
variantListEl.appendChild(item);
});
}

var rteEditor = document.getElementById('fDetail');

if (typeof bindFileCardManagement === 'function') bindFileCardManagement(rteEditor);
else window.addEventListener('DOMContentLoaded', function () { try { bindFileCardManagement(rteEditor); } catch (e) {} });

var __rte = { editor: null, range: null };
function __updateUndoRedo() {
try {
var canUndo = document.queryCommandEnabled('undo');
var canRedo = document.queryCommandEnabled('redo');
document.querySelectorAll('.rte-btn[data-cmd="undo"]').forEach(function (btn) { btn.classList.toggle('disabled', !canUndo); });
document.querySelectorAll('.rte-btn[data-cmd="redo"]').forEach(function (btn) { btn.classList.toggle('disabled', !canRedo); });
} catch (e) { if (window.__silent) window.__silent(e); }
}
var __origExecCommand = document.execCommand;
document.execCommand = function () { var ret = __origExecCommand.apply(this, arguments); __updateUndoRedo(); return ret; };
document.addEventListener('selectionchange', function () {
var sel = window.getSelection();
if (!sel || sel.rangeCount === 0) return;
var el = sel.anchorNode;
while (el && !(el.classList && el.classList.contains('rte-editor'))) el = el.parentNode;
if (el) { __rte.editor = el; try { __rte.range = sel.getRangeAt(0).cloneRange(); } catch (e) { if (window.__silent) window.__silent(e); } }
__updateUndoRedo();
});
document.addEventListener('mousedown', function (e) {
var bar = e.target.closest ? e.target.closest('.rte-toolbar') : null;
if (!bar) return;
if (e.target.closest('.rte-btn, .rte-palette, .cat-picker-display') && !e.target.closest('select')) e.preventDefault();
var edId = bar.getAttribute('data-editor'), sel = window.getSelection();
var ed0 = edId ? document.getElementById(edId) : null, inside0 = false;
if (ed0 && sel && sel.rangeCount) {
var p0 = sel.anchorNode;
while (p0 && p0 !== ed0) p0 = p0.parentNode;
if (p0 === ed0) { inside0 = true; try { __rte.range = sel.getRangeAt(0).cloneRange(); } catch (e) { if (window.__silent) window.__silent(e); } }
}
if (ed0) { __rte.editor = ed0; if (!inside0 && !e.target.closest('.cat-picker-display, select')) __rte.range = null; }
});
function rteFocusEnd(editor) {
var r = document.createRange(); r.selectNodeContents(editor); r.collapse(false);
var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
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
function rteFocusStay(editor) {
if (!editor) return;
try { editor.focus({ preventScroll: true }); } catch (e) { editor.focus(); }
}

function rteUnderlineLink(editor) {
if (!editor) return false;
var sel = window.getSelection();
if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
var up = function (n) { return n ? (n.nodeType === 1 ? n : n.parentNode) : null; };
var ae = up(sel.anchorNode), fe = up(sel.focusNode);
if (!ae || !fe || typeof ae.closest !== 'function') return false;
var a = ae.closest('a');
if (!a || a !== fe.closest('a') || !editor.contains(a)) return false;
var u = a.querySelector('u');
if (u) {
while (u.firstChild) a.insertBefore(u.firstChild, u);
a.removeChild(u);
} else {
var r = sel.getRangeAt(0);
var frag = r.extractContents();
var nu = document.createElement('u');
nu.appendChild(frag);
r.insertNode(nu);
try { sel.removeAllRanges(); var nr = document.createRange(); nr.selectNodeContents(nu); sel.addRange(nr); } catch (e0) { if (window.__silent) window.__silent(e0); }
}
return true;
}
function rteInsert(editor, html) {
if (!editor) return;
var __hadSel = __rte.editor === editor && __rte.range;
if (__hadSel) rteFocusStay(editor);
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
try { __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (e) { if (window.__silent) window.__silent(e); }
}
var __rtePd = null;
var __rteLastTap = null;
function __rteSelect(pick) {
try {
var sel = window.getSelection();
var range = document.createRange();
range.selectNode(pick);
sel.removeAllRanges(); sel.addRange(range);
} catch (err) { if (window.__silent) window.__silent(err); }
if (pick.tagName === 'IMG' || pick.tagName === 'VIDEO') {
pick.classList.add('rte-media-sel');
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
document.addEventListener('pointerup', function (e) {
if (e.pointerType === 'mouse') return;
if (!__rtePd) return;
var t = __rtePd.t, x0 = __rtePd.x, y0 = __rtePd.y; __rtePd = null;
if (t !== e.target) return;
if (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10) return;
__rteDbltap(t);
}, { capture: true });
document.addEventListener('touchend', function (e) {
var t = e.target;
if (!t) return;
if (t.classList && t.classList.contains('rte-img-del')) return;
var ed = t.closest ? t.closest('[contenteditable="true"]') : null;
if (!ed) return;
var pick = null;
if (t.tagName === 'VIDEO' || t.tagName === 'IMG') pick = t;
if (!pick) return;
try { e.preventDefault(); } catch (err0) { if (window.__silent) window.__silent(err0); }
if (__rtePd) {
var _ct = (e.changedTouches && e.changedTouches[0]) || null;
var _pt = __rtePd.t, _px = __rtePd.x, _py = __rtePd.y; __rtePd = null;
if (_ct && _pt === t && (Math.abs(_ct.clientX - _px) > 10 || Math.abs(_ct.clientY - _py) > 10)) return;
__rteDbltap(t);
}
}, { capture: true, passive: false });
document.addEventListener('click', function (e) {
var t = e.target;
if (!t) return;
if (t.classList && t.classList.contains('rte-img-del')) return;
var ed = t.closest ? t.closest('[contenteditable="true"]') : null;
if (!ed) { __hideImgDel(); return; }
var pick = null;
if (t.tagName === 'VIDEO') pick = t;
else if (t.tagName === 'IMG') pick = t;
else {
var fb = t.closest ? t.closest('.video-fallback') : null;
if (fb && !t.closest('.vf-link')) pick = fb;
}
if (!pick) __hideImgDel();
});
document.addEventListener('dblclick', function (e) {
var t = e.target;
if (!t) return;
if (t.classList && t.classList.contains('rte-img-del')) return;
if (t.closest && t.closest('.vf-link')) return;
var ed = t.closest ? t.closest('[contenteditable="true"]') : null;
if (!ed) return;
var pick = null;
if (t.tagName === 'VIDEO') pick = t;
else if (t.tagName === 'IMG') pick = t;
else {
var fb = t.closest ? t.closest('.video-fallback') : null;
if (fb) pick = fb;
}
if (!pick) return;
__rteSelect(pick);
});
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
var isV = sib.nodeType === 1 && (sib.tagName === 'VIDEO' || sib.tagName === 'IMG' || (sib.classList && sib.classList.contains('video-fallback')));
if (!isV) return;
e.preventDefault();
try { sib.remove(); } catch (err2) { if (window.__silent) window.__silent(err2); }
ed.dispatchEvent(new Event('input', { bubbles: true }));
} catch (err) { if (window.__silent) window.__silent(err); }
});
var __imgDelBtn = null, __imgDelTarget = null;
function __placeImgDel() {
if (!__imgDelBtn || !__imgDelTarget) return;
var host = __imgDelBtn.parentNode;
if (!__imgDelTarget.isConnected || !host || !host.contains(__imgDelTarget) || !__imgDelBtn.isConnected) { __hideImgDel(); return; }
var hr = host.getBoundingClientRect();
var tr = __imgDelTarget.getBoundingClientRect();
var ix = Math.min(12, Math.max(0, (tr.width - 22) / 2));
var iy = Math.min(12, Math.max(0, (tr.height - 22) / 2));
var wantL = tr.right - 22 - ix, wantT = tr.top + iy;
__imgDelBtn.style.left = (wantL - hr.left) + 'px';
__imgDelBtn.style.top = (wantT - hr.top) + 'px';
var br = __imgDelBtn.getBoundingClientRect();
if (br.width > 0 && (Math.abs(br.left - wantL) > 0.5 || Math.abs(br.top - wantT) > 0.5)) {
__imgDelBtn.style.left = (parseFloat(__imgDelBtn.style.left) + (wantL - br.left)) + 'px';
__imgDelBtn.style.top = (parseFloat(__imgDelBtn.style.top) + (wantT - br.top)) + 'px';
}
}
function __showImgDel(img) {
var host = img && img.closest ? img.closest('.rte-editor') : null;
if (!host) { __hideImgDel(); return; }
if (!__imgDelBtn) {
__imgDelBtn = document.createElement('button');
__imgDelBtn.type = 'button';
__imgDelBtn.className = 'rte-img-del';
__imgDelBtn.title = '删除这个媒体';
__imgDelBtn.setAttribute('contenteditable', 'false');
__imgDelBtn.innerHTML = '<svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg>';
__imgDelBtn.addEventListener('click', function (ev) {
ev.preventDefault(); ev.stopPropagation();
var im = __imgDelTarget;
__hideImgDel();
if (im && im.isConnected) {
var ed2 = im.closest('[contenteditable="true"]');
im.remove();
if (ed2) { try { ed2.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) { if (window.__silent) window.__silent(e2); } }
}
});
__imgDelBtn.addEventListener('pointerdown', function (ev) {
ev.preventDefault(); ev.stopPropagation();
var im = __imgDelTarget;
__hideImgDel();
if (im && im.isConnected) {
var ed2 = im.closest('[contenteditable="true"]');
im.remove();
if (ed2) { try { ed2.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) { if (window.__silent) window.__silent(e2); } }
}
});
}
if (__imgDelBtn.parentNode !== host) host.appendChild(__imgDelBtn);
__imgDelTarget = img;
__imgDelBtn.style.display = 'flex';
__placeImgDel();
}
function __hideImgDel() {
if (__imgDelBtn) {
__imgDelBtn.style.display = 'none';
try { __imgDelBtn.remove(); } catch (e1) { if (window.__silent) window.__silent(e1); }
}
try { document.querySelectorAll('.rte-media-sel').forEach(function (m) { m.classList.remove('rte-media-sel'); }); } catch (e0) { if (window.__silent) window.__silent(e0); }
__imgDelTarget = null;
}
window.__hideImgDel = __hideImgDel;
document.addEventListener('selectionchange', function () {
if (!__imgDelBtn || !__imgDelTarget || __imgDelBtn.style.display === 'none') return;
var keep = false;
try {
var sel = window.getSelection();
if (sel && sel.rangeCount === 1) {
var r = sel.getRangeAt(0);
var pn = __imgDelTarget.parentNode;
if (!r.collapsed && r.startContainer === pn && r.endContainer === pn && (r.endOffset - r.startOffset) === 1 && pn.childNodes[r.startOffset] === __imgDelTarget) keep = true;
}
} catch (e) { if (window.__silent) window.__silent(e); }
if (!keep) __hideImgDel(); else __placeImgDel();
});
document.addEventListener('click', function (e) {
var z = e.target.closest ? e.target.closest('.rte-zoom') : null;
if (!z) return;
var ed = document.getElementById(z.getAttribute('data-editor'));
if (!ed) return;
var big = ed.classList.toggle('rte-large'); var tb = ed.previousElementSibling; if (tb && tb.classList && tb.classList.contains('rte-toolbar')) { if (big) tb.classList.add('rte-toolbar-large'); else tb.classList.remove('rte-toolbar-large'); }
if (!big) { ed.style.top = ''; ed.style.height = ''; }
z.classList.toggle('rte-zoom-on', big);
z.innerHTML = big ? RTE_SVG_MIN : RTE_SVG_MAX; window.__syncBodyLock && window.__syncBodyLock();

document.body.classList.toggle('rte-zooming', ed.classList.contains('rte-large'));
if (big) {
try { ed.focus({ preventScroll: true }); } catch (e1) { ed.focus(); }
(function () { var _tb = ed.previousElementSibling; if (_tb && _tb.classList && _tb.classList.contains('rte-toolbar')) { var _f = function () { if (!ed.classList.contains('rte-large')) return; var _b = _tb.getBoundingClientRect().bottom + 0; ed.style.top = _b + 'px'; ed.style.height = 'calc(100vh - ' + (_b + 12) + 'px)'; ed.style.height = 'calc(100dvh - ' + (_b + 12) + 'px)'; }; _f(); if (window.__rteRO) window.__rteRO.disconnect(); try { window.__rteRO = new ResizeObserver(_f); window.__rteRO.observe(_tb); } catch (e) { if (window.__silent) window.__silent(e); } } })();
setTimeout(function(){ var _le=document.querySelector('.rte-editor.rte-large'); if(_le){ var _tb2=_le.previousElementSibling; if(_tb2&&_tb2.classList&&_tb2.classList.contains('rte-toolbar')){ var _b2=_tb2.getBoundingClientRect().bottom+0; _le.style.top=_b2+'px'; _le.style.height='calc(100vh - '+(_b2+12)+'px)'; _le.style.height='calc(100dvh - '+(_b2+12)+'px)'; } } }, 80);
}
});
document.addEventListener('click', function (e) {
var x = e.target.closest ? e.target.closest('.rte-expand') : null;
if (!x) return;
var tb = x.closest('.rte-toolbar');
if (!tb) return;

try {
var __h0 = tb.scrollHeight;
var collapsed = tb.classList.toggle('rte-collapsed');
var __h1 = tb.scrollHeight;
tb.style.overflow = 'hidden';
tb.style.maxHeight = __h0 + 'px'; tb.style.opacity = '1';
void tb.offsetHeight;
tb.style.transition = 'max-height var(--dur-mid) var(--ease-out), opacity var(--dur-mid) var(--ease-out)';
tb.style.maxHeight = __h1 + 'px';
setTimeout(function () { tb.style.transition = ''; tb.style.maxHeight = ''; tb.style.overflow = ''; }, 230);
} catch (e0) { if (window.__silent) window.__silent(e0); }
x.title = collapsed ? '展开工具栏' : '收起工具栏';
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
document.addEventListener('keydown', function (e) {
if (e.key === 'Escape') {
var bigEd = document.querySelector('.rte-editor.rte-large');
if (bigEd) {
e.__escPre = true;
bigEd.classList.remove('rte-large'); bigEd.style.top = ''; bigEd.style.height = ''; var _tb = bigEd.previousElementSibling; if (_tb && _tb.classList && _tb.classList.contains('rte-toolbar-large')) _tb.classList.remove('rte-toolbar-large');
document.querySelectorAll('.rte-zoom.rte-zoom-on').forEach(function (b) { b.classList.remove('rte-zoom-on'); b.innerHTML = RTE_SVG_MAX; }); window.__syncBodyLock && window.__syncBodyLock();
var _ex = document.getElementById('rteExitZoom'); if (_ex) _ex.style.display = 'none';
document.body.classList.remove('rte-zooming');
}
}
});


function bindRteBar(barEl, editorEl) {
if (!barEl || !editorEl) return;
Array.prototype.forEach.call(barEl.querySelectorAll('.rte-btn[data-cmd]'), function (btn) {
if (btn.__wnRteBound) return;
btn.__wnRteBound = 1;
btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
btn.addEventListener('click', function () {
var cmd = this.dataset.cmd;
if (__rte.editor !== editorEl || !__rte.range) return;
if (!(cmd === 'underline' && rteUnderlineLink(editorEl))) document.execCommand(cmd, false, null);
rteFocusStay(editorEl);
updateRteActive();
});
});
Array.prototype.forEach.call(barEl.querySelectorAll('.rte-select[data-cmd]'), function (sel) {
if (sel.__wnRteBound) return;
sel.__wnRteBound = 1;
sel.addEventListener('change', function () {
var cmd = this.dataset.cmd;
var val = this.value;
if (val && __rte.editor === editorEl && __rte.range) {

try { rteFocusStay(editorEl); } catch (eF) {}
try { var _ps = window.getSelection(); _ps.removeAllRanges(); _ps.addRange(__rte.range); } catch (eR) {}
document.execCommand(cmd, false, val);
try { __rte.editor = editorEl; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (eC) {}
rteFocusStay(editorEl);
}
this.selectedIndex = 0;
try { syncSelectDisplay(this); } catch (e) {}
});
});
}
window.__bindRteBar = bindRteBar;
bindRteBar(document.getElementById('detailRteToolbar'), rteEditor);

document.addEventListener('click', function (e) {
var sw = e.target.closest ? e.target.closest('.palette-swatch') : null;
if (!sw) return;
var pal = sw.closest('.rte-palette');
if (!pal) return;
var editor = document.getElementById(pal.getAttribute('data-editor'));
if (!editor) return;
if (__rte.editor !== editor || !__rte.range) return;
rteFocusStay(editor);
if (__rte.editor === editor && __rte.range) { try { var _ps = window.getSelection(); _ps.removeAllRanges(); _ps.addRange(__rte.range); } catch (e) { if (window.__silent) window.__silent(e); } }
document.execCommand(pal.getAttribute('data-cmd'), false, sw.getAttribute('data-color'));
try { __rte.editor = editor; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (e) { if (window.__silent) window.__silent(e); }
rteFocusStay(editor);
});


var RTE60_COLORS = (function () {

var rows = [
['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff'],
['#7f0000', '#b71c1c', '#e53935', '#ef5350', '#f28b82', '#ffcdd2'],
['#bf360c', '#d84315', '#f4511e', '#ff7043', '#ffb74d', '#ffe0b2'],
['#827717', '#9e9d24', '#c0ca33', '#fdd835', '#ffeb3b', '#fff59d'],
['#1b5e20', '#2e7d32', '#43a047', '#66bb6a', '#a5d6a7', '#c8e6c9'],
['#006064', '#00838f', '#0097a7', '#26c6da', '#80deea', '#e0f7fa'],
['#0d47a1', '#1565c0', '#1e88e5', '#42a5f5', '#90caf9', '#bbdefb'],
['#4a148c', '#6a1b9a', '#8e24aa', '#ab47bc', '#ce93d8', '#e1bee7'],
['#880e4f', '#ad1457', '#c2185b', '#ec407a', '#f48fb1', '#f8bbd0'],
['#3e2723', '#4e342e', '#6d4c41', '#8d6e63', '#bcaaa4', '#d7ccc8']
];
var cells = [];
for (var c = 0; c < 6; c++) for (var r = 0; r < 10; r++) cells.push(rows[r][c]);
return cells;
})();

var RTE_POP = null;
function rteClosePop() { if (RTE_POP) { RTE_POP.remove(); RTE_POP = null; } }
function rtePlacePop(pop, anchor) {
pop.__anchor = anchor;
document.body.appendChild(pop);
var r = anchor.getBoundingClientRect();
var pw = pop.offsetWidth, ph = pop.offsetHeight;
var left = r.left + r.width / 2 - pw / 2;
left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
var top = r.bottom + 6;
if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
pop.style.left = left + 'px'; pop.style.top = top + 'px';
}

(function () {
function __rteAnchorVisible(el) {
var r = el.getBoundingClientRect();
if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
var p = el.parentNode;
while (p && p !== document.body) {
if (p.nodeType === 1) {
var ov = ''; try { ov = getComputedStyle(p).overflowY; } catch (e0) { if (window.__silent) window.__silent(e0); }
if ((ov === 'auto' || ov === 'scroll' || ov === 'hidden') && p.scrollHeight > p.clientHeight + 1) {
var pr = p.getBoundingClientRect();
if (r.top >= pr.bottom || r.bottom <= pr.top || r.right <= pr.left || r.left >= pr.right) return false;
}
}
p = p.parentNode;
}
return true;
}
var __raf = 0;
function __repos() {
__raf = 0;
try {
if (RTE_POP && RTE_POP.__anchor) {
if (__rteAnchorVisible(RTE_POP.__anchor)) rtePlacePop(RTE_POP, RTE_POP.__anchor);
else rteClosePop();
}
document.querySelectorAll('.select-picker.open, .cat-picker.open').forEach(function (pk) {
var disp = pk.querySelector('.cat-picker-display');
if (!disp) return;
if (__rteAnchorVisible(disp)) positionCatPanel(pk);
else {
pk.classList.remove('open');
var pp = pk.querySelector('.cat-picker-panel');
if (!pp && pk.dataset.pickerId) pp = document.querySelector('.cat-picker-panel[data-picker-id="' + pk.dataset.pickerId + '"]');
if (pp) { if (pp.parentNode !== pk) pk.appendChild(pp); pp.classList.remove('open'); }
}
});
} catch (e) { if (window.__silent) window.__silent(e); }
}
window.addEventListener('scroll', function () { if (!__raf) __raf = requestAnimationFrame(__repos); }, true);
window.addEventListener('resize', function () { if (!__raf) __raf = requestAnimationFrame(__repos); });
})();
function rteApplyCmd(editor, cmd, val) {

if (__rte.editor !== editor || !__rte.range) return;
rteFocusStay(editor);
try { var ps = window.getSelection(); ps.removeAllRanges(); ps.addRange(__rte.range); } catch (e) { if (window.__silent) window.__silent(e); }
document.execCommand(cmd, false, val);
try { __rte.editor = editor; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (e) { if (window.__silent) window.__silent(e); }
}


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
if (color === '#ffffff') cell.style.borderColor = 'var(--border)';
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
pop.offsetHeight;
pop.style.opacity = '';
pop.style.transform = '';
});



function rteTblGrid(table) {

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
maxC = Math.max(maxC, (grid[r] || []).length);
}
return { grid: grid, rows: rows.length, cols: Math.max(maxC, 0), table: table };
}
function rteTblAt(editor) {
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
var customRow = document.createElement('div');
customRow.className = 'tbl-custom-row';
var rowLabel = document.createElement('span');
rowLabel.textContent = '行';
var rowInp = document.createElement('input');
rowInp.type = 'number'; rowInp.min = '1'; rowInp.max = '50'; rowInp.value = '1';
rowInp.className = 'tbl-custom-input';
rowInp.setAttribute('aria-label', '行数');
var colLabel = document.createElement('span');
colLabel.textContent = '列';
var colInp = document.createElement('input');
colInp.type = 'number'; colInp.min = '1'; colInp.max = '50'; colInp.value = '1';
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
b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
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
var sel = window.getSelection();
if (sel && sel.rangeCount && !sel.isCollapsed) {
var range = sel.getRangeAt(0);
var tds = found.at.table.querySelectorAll('td,th');
Array.prototype.forEach.call(tds, function (td) {
try { if (range.intersectsNode(td)) td.classList.add('tbl-cell-sel'); } catch (e) { if (window.__silent) window.__silent(e); }
});
}
}
document.addEventListener('selectionchange', rteTblSelectionChange);
window.addEventListener('scroll', function () { rteCloseOpbar(); }, true);
document.addEventListener('click', function (e) {
if (TBL_OPBAR && !TBL_OPBAR.contains(e.target) && !e.target.closest('.rte-editor')) rteCloseOpbar();
});


function rteTblAddRow(editor) {
var at = rteTblAt(editor); if (!at) return;
var g = rteTblGrid(at.table); var td = at.td;
var r0 = 0; outer: for (var r = 0; r < g.rows; r++) { if (g.grid[r] && g.grid[r].indexOf(td) !== -1) { r0 = r; break outer; } }
var newRow = at.table.insertRow(r0 + 1);
for (var c = 0; c < g.cols; c++) {
var above = g.grid[r0] ? g.grid[r0][c] : null;
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
cell.parentNode && cell.parentNode.removeChild(cell);
}
}
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
var newC = c0 + (td.colSpan || 1);
for (var r2 = 0; r2 < g.rows; r2++) {
var row = at.table.rows[r2]; if (!row) continue;
var cover = g.grid[r2] ? g.grid[r2][newC] : null;
if (cover) {
var startC = -1;
for (var k = 0; k < newC; k++) if (g.grid[r2][k] === cover) { startC = k; break; }
if (startC !== -1 && startC < newC && (cover.colSpan || 1) > 1) {
cover.colSpan = (cover.colSpan || 1) + 1;
continue;
}
var insertIdx = Array.prototype.indexOf.call(row.cells, cover);
var nc = insertIdx >= 0 ? row.insertCell(insertIdx) : row.insertCell(-1);
nc.innerHTML = '<br>';
} else {
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

function rteTblMerge(editor) {
var at = rteTblAt(editor); if (!at) return;
var sel = window.getSelection();
if (!sel || !sel.rangeCount) return;
function cellOf(node) {
var el = node && (node.nodeType === 1 ? node : node.parentNode);
var td = el && el.closest ? el.closest('td,th') : null;
return (td && at.table.contains(td)) ? td : null;
}
var aTd = cellOf(sel.anchorNode), fTd = cellOf(sel.focusNode);
if (!aTd || !fTd) { toast('请先在表格里拖选要合并的多个单元格', 'info'); return; }
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
if (picked.length < 2) { toast('请先在表格里拖选要合并的多个单元格', 'info'); return; }
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

function rteTblSplit(editor) {
var at = rteTblAt(editor); if (!at) return;
var td = at.td, cs = td.colSpan || 1, rs = td.rowSpan || 1;
if (cs === 1 && rs === 1) { toast('当前单元格没有合并过，无需拆分', 'info'); return; }
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
while (at.table.rows.length < g.rows + rs - 1) at.table.insertRow(-1);
}
function rteTblDelTable(editor) {
var at = rteTblAt(editor); if (!at) return;

showConfirm('删除表格', '确定删除整个表格？', function (closeConfirm) {
closeConfirm();
at.table.parentNode && at.table.parentNode.removeChild(at.table);
rteCloseOpbar();
});
}


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

document.addEventListener('mousedown', function (e) {
if (RTE_POP && !RTE_POP.contains(e.target) && !e.target.closest('.rte-color-btn') && !e.target.closest('.rte-table-btn') && !e.target.closest('.rte-emoji-btn')) rteClosePop();
}, true);



var RTE_EMOJIS = {
'笑脸': ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','😗','😙','😚','🙂','🤗','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','🙃','🤑','🤡','🤥','🤭','🤫','🤮','🥵','🥶','🥴','😵','🤯','🥳','🥺','😢','😭','😤','😠'],
'手势': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🤳','🫱','🫲','🫳','🫴','🫰','👀','👁','👂','👃','👅','👤','👥','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','💃','🕺','👯','🫂'],
'动物自然': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦗','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐘','🦒','🦘','🦏','🦛','🐫','🦙','🦥','🦦'],
'食物': ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🌮','🌯','🥙','🧆','🍜','🍝','🍣','🍱','🍛','🍙','🍚'],
'活动物品': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏','🥊','🥋','🎽','⛳','⛸️','🎣','🤿','🎿','🛷','🥌','🎯','🪀','🪁','🎮','🕹️','🎲','🧩','🧸','🪆','🖼️','🎨','🧵','🪡','🧶','🎫','🏆','🥇','🥈','🥉','🏅','🎖️','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','📱','💻','⌨️'],
'符号庆祝': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','✨','⭐','🌟','💫','⚡️','🔥','💥','💯','🎉','🎊','🎈','🎁','🥂','🍻','🍾','🎂','🍰','🧁','👑','🔔','🎵','🎶','💤','💬','💭','🗯️','♠️','♥️','♦️','♣️','🔶','🔷','🔹','🔺','🔻','⭕','❌','❗','❓','✅','🚀'],
};

document.addEventListener('mousedown', function (e) {
if (e.target.closest && e.target.closest('.rte-emoji-btn,.rte-quote-btn,.rte-check-btn')) e.preventDefault();
}, true);


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
pop.style.opacity = '0';
pop.style.transform = 'translateY(4px)';
var tabs = document.createElement('div');
tabs.className = 'emoji-tabs';
var grid = document.createElement('div');
grid.className = 'emoji-pop-grid';
var curCat = cats[0];
function renderCat(cat, animDir) {
curCat = cat;
grid.innerHTML = '';
RTE_EMOJIS[cat].forEach(function (em) {
var cell = document.createElement('div');
cell.className = 'emoji-cell';
cell.textContent = em;
cell.title = em;
cell.addEventListener('click', function () {
rteApplyCmd(editor, 'insertHTML', em);
rteClosePop();
});
grid.appendChild(cell);
});

if (animDir) { grid.classList.remove('emoji-slide-next', 'emoji-slide-prev'); void grid.offsetWidth; grid.classList.add(animDir > 0 ? 'emoji-slide-next' : 'emoji-slide-prev'); }
}
function switchTo(ni, animDir) {
if (ni < 0 || ni >= cats.length || cats[ni] === curCat) return;
tabs.querySelectorAll('.emoji-tab').forEach(function (t, i) { t.classList.toggle('active', i === ni); });
renderCat(cats[ni], animDir);
}
cats.forEach(function (cat, i) {
var tab = document.createElement('button');
tab.type = 'button';
tab.className = 'emoji-tab' + (i === 0 ? ' active' : '');
tab.textContent = cat;
tab.addEventListener('click', function () {
switchTo(i, i > cats.indexOf(curCat) ? 1 : -1);
});
tabs.appendChild(tab);
});
renderCat(cats[0]);
pop.appendChild(tabs);
pop.appendChild(grid);

window.__bindSwipeSwitch(pop, function (dir) {
var idx = cats.indexOf(curCat);
var ni = idx + dir;
if (ni < 0 || ni >= cats.length) return;
window.__emojiJustSwiped = true;
setTimeout(function () { window.__emojiJustSwiped = false; }, 400);
switchTo(ni, dir);
});
pop.__swipeOnMove = function (dx) { try { grid.style.transform = dx ? 'translateX(' + Math.round(dx * 0.3) + 'px)' : ''; } catch (e0) { if (window.__silent) window.__silent(e0); } };
pop.addEventListener('click', function (e) { if (window.__emojiJustSwiped) { e.preventDefault(); e.stopPropagation(); } }, true);
RTE_POP = pop;
rtePlacePop(pop, btn);
pop.offsetHeight;
pop.style.opacity = '';
pop.style.transform = '';
});


document.addEventListener('click', function (e) {
var btn = e.target.closest ? e.target.closest('.rte-quote-btn') : null;
if (!btn) return;
e.preventDefault();
var editor = document.getElementById(btn.getAttribute('data-editor'));
if (!editor) return;
if (__rte.editor !== editor || !__rte.range) return;
rteFocusStay(editor);
if (__rte.editor === editor && __rte.range) { try { var ps = window.getSelection(); ps.removeAllRanges(); ps.addRange(__rte.range); } catch (err) { if (window.__silent) window.__silent(err); } }
var sel = window.getSelection();
var bq = null;
if (sel && sel.rangeCount) {
var n = sel.getRangeAt(0).startContainer;
var el = n.nodeType === 1 ? n : n.parentNode;
bq = el && el.closest ? el.closest('blockquote') : null;
if (bq && !editor.contains(bq)) bq = null;
}
document.execCommand('formatBlock', false, bq ? 'p' : 'blockquote');
try { __rte.editor = editor; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (err) { if (window.__silent) window.__silent(err); }
rteFocusStay(editor);
});


document.addEventListener('click', function (e) {
var btn = e.target.closest ? e.target.closest('.rte-check-btn') : null;
if (!btn) return;
e.preventDefault();
var editor = document.getElementById(btn.getAttribute('data-editor'));
if (!editor) return;
rteApplyCmd(editor, 'insertHTML', '<input type="checkbox" class="rte-check">');
});


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


document.addEventListener('paste', function (e) {
var t = e.target;
if (!t || !t.closest || !t.closest('.rte-editor')) return;
e.preventDefault();
var text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
if (text) document.execCommand('insertText', false, text);
});

function updateRteActive() {

var _ae = (window.__rte && window.__rte.editor) || rteEditor;
var _aid = (_ae && _ae.id) || 'fDetail';
document.querySelectorAll('.rte-toolbar[data-editor="' + _aid + '"] .rte-btn[data-cmd]').forEach(function (btn) {
var cmd = btn.dataset.cmd;
try {
if (document.queryCommandState(cmd)) {
btn.classList.add('active');
} else {
btn.classList.remove('active');
}
} catch (e) { if (window.__silent) window.__silent(e); }
});
}
rteEditor.addEventListener('keyup', updateRteActive);
rteEditor.addEventListener('mouseup', updateRteActive);

document.getElementById('detailRteLink').addEventListener('click', function () {
showLinkDialog('', '', function (url, text) {
var html = '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer"><u>' + text + '</u></a>';
rteInsert(__rte.editor, html);
toast('超链接已插入', 'success');
});
});

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
rteFocusStay(rteEditor);
toast('格式已应用', 'success');
} else {
toast('请先选中要应用格式的内容', 'error');
}
detailBrushStyle = null;
brushBtn.classList.remove('active');
}
});


(function () {
var item = document.getElementById('edContactItem');
if (!item) return;
var fold = document.getElementById('edContactFold');
var col = document.getElementById('edContactCollapse');
var add = document.getElementById('edContactQrAdd');
var fi = document.getElementById('edContactQrFile');
var del = document.getElementById('edContactQrDel');
var net = document.getElementById('edContactNet');
function __edContactRefresh() {
var qr = (document.getElementById('fContactQr').value || '').trim();
var img = document.getElementById('edContactQrImg');
var d = document.getElementById('edContactQrDel');
var a = document.getElementById('edContactQrAdd');
if (qr) { img.src = qr; img.style.display = ''; } else { img.removeAttribute('src'); img.style.display = 'none'; }
if (d) d.style.display = qr ? '' : 'none';
if (a) a.style.display = qr ? 'none' : '';
}
window.__edContactRefresh = __edContactRefresh;
var toggle = function () {
var willOpen = !item.classList.contains('open');
item.classList.toggle('open', willOpen);
fold.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
if (willOpen) {
__edContactRefresh();
if (document.activeElement !== net) net.value = (document.getElementById('fContactQr').value || '').trim();
}
if (window.__haptic) window.__haptic();
};
if (fold) fold.addEventListener('click', toggle);

if (add && fi) {
add.addEventListener('click', function () { fi.click(); });
fi.addEventListener('change', function () {
var f = this.files && this.files[0]; this.value = '';
if (!f) return;
toast('正在上传二维码…', 'info');
uploadToBucket(f, function (url) {
if (!url) return;
document.getElementById('fContactQr').value = url;
__edContactRefresh();
toast('二维码已就绪，点下面的「确定」生效', 'info');
if (window.__haptic) window.__haptic();
});
});
}
if (del) del.addEventListener('click', function () {
document.getElementById('fContactQr').value = '';
__edContactRefresh();
});
if (net) net.addEventListener('change', function () {
var v = (net.value || '').trim();
if (v && !/^https?:\/\//i.test(v)) { toast('网络地址需以 http(s):// 开头', 'error'); return; }
document.getElementById('fContactQr').value = v;
__edContactRefresh();
if (v) { toast('网络图已就绪，点下面的「确定」生效', 'info'); if (window.__haptic) window.__haptic(); }
});

function __edContactSaveNow(after) {
var pid = window.state && window.state.editingId;
if (!pid) { toast('请先点「确定」保存资源，再单独更新客服信息', 'info'); return false; }
var b = col, _t = b.textContent;
b.disabled = true; if (window.__btnBusy) window.__btnBusy(b, '保存中');
api('admin/products/' + pid, { method: 'PUT', body: JSON.stringify({
partial: 'contact',
contactQr: (document.getElementById('fContactQr').value || '').trim(),
contactUrl: (document.getElementById('fContactUrl').value || '').trim()
}) }).then(function (res) {
b.disabled = false; b.textContent = _t;
if (res && res.ok) {
var _sp = (state.products || []).find(function (x) { return x.id === pid; });
if (_sp) { _sp.contactQr = (document.getElementById('fContactQr').value || '').trim(); _sp.contactUrl = (document.getElementById('fContactUrl').value || '').trim(); }
if (window.__haptic) window.__haptic();
if (window.showToast) window.showToast(window.T('saved'), 'success');
if (after) after();
}
else { toast((res && res.msg) || '保存失败', 'error'); }
}).catch(function () { b.disabled = false; b.textContent = _t; toast(window.T('netFail'), 'error'); });
return true;
}

if (col) col.addEventListener('click', function () { toggle(); });
})();


(function () {
function ensurePickable() {
document.querySelectorAll('.cat-picker-display').forEach(function (d) {
if (!d.hasAttribute('tabindex')) {
d.setAttribute('tabindex', '0');
d.setAttribute('role', 'button');
}
});
document.querySelectorAll('.cp-item').forEach(function (it) {
if (!it.hasAttribute('tabindex')) it.setAttribute('tabindex', '0');
if (!it.hasAttribute('role')) it.setAttribute('role', 'option');
if (it.classList.contains('selected')) it.setAttribute('aria-selected', 'true');
});
}

document.addEventListener('keydown', function (e) {
if (e.key === 'Tab') { try { ensurePickable(); } catch (e0) { if (window.__silent) window.__silent(e0); } }
}, true);


function __bootPickable() { try { ensurePickable(); } catch (e0) { if (window.__silent) window.__silent(e0); } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(__bootPickable, 800); });
else setTimeout(__bootPickable, 800);

try {
var __pkTimer = null;
new MutationObserver(function () {
if (__pkTimer) return;
__pkTimer = setTimeout(function () { __pkTimer = null; __bootPickable(); }, 200);
}).observe(document.body || document.documentElement, { childList: true, subtree: true });
} catch (e0) {}

document.addEventListener('keydown', function (e) {
var t = e.target;
if (!t || !t.closest) return;
var isAct = e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar';
var disp = t.closest('.cat-picker-display');
var item = t.closest('.cp-item');
if (isAct && (disp || item)) {
e.preventDefault();
var wasItem = !!item;
(disp || item).click();

if (disp && !wasItem) {
setTimeout(function () {

var openPk = document.querySelector('.cat-picker.open, .select-picker.open');
var box = (openPk && openPk.querySelector('.cat-picker-panel')) || document.querySelector('.cat-picker-panel.open');
if (!box) {
var pk = disp.closest ? disp.closest('.cat-picker, .select-picker') : null;
var pid = pk && pk.dataset.pickerId;
if (pid) box = document.querySelector('.cat-picker-panel[data-picker-id="' + pid + '"]');
}
if (!box) return;
var items = Array.prototype.filter.call(box.querySelectorAll('.cp-item'), function (x) { return x.offsetParent !== null; });
if (!items.length) items = Array.prototype.slice.call(box.querySelectorAll('.cp-item'));
if (!items.length) return;
var f = items[0];

if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '0');
try { f.focus(); } catch (e0) {}
}, 130);
}
return;
}
if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {

var ae = document.activeElement;
var it2 = ae && ae.closest ? ae.closest('.cp-item') : null;
if (!it2) return;
var box = it2.closest('.cat-picker-panel');
if (!box) return;

var list = Array.prototype.filter.call(box.querySelectorAll('.cp-item'), function (x) { return x.getClientRects().length > 0; });
var i = list.indexOf(it2);
if (i < 0) return;
e.preventDefault();
var ni = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : i + (e.key === 'ArrowDown' ? 1 : -1);
if (ni < 0 || ni >= list.length) return;
var nx = list[ni];
if (!nx.hasAttribute('tabindex')) nx.setAttribute('tabindex', '0');
nx.focus();
}
});
})();
