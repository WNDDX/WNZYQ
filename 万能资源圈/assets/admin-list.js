window.__lastFetchTime = 0;

function __adminDataSig(list) {
return JSON.stringify((list || []).map(function (p) { var c = {}; for (var k in p) { if (k !== 'variants') c[k] = p[k]; } return c; }));
}
function __getAdminEmptyText() {
var __kw = (document.getElementById('adminSearch').value || '').trim();
var __fc = document.getElementById('filterCat').value;
var __fs = document.getElementById('filterStatus').value;
if (__kw) return '该搜索暂无资源';
if (__fc && __fc !== '0') return '该分类暂无资源';
if (__fs) return '该状态暂无资源';
return '该列表暂无资源';
}
function __adminCatSig(list) {
return JSON.stringify((list || []).map(function (c) { var o = {}; for (var k in c) { if (k !== 'cnt' && k !== 'totalCnt') o[k] = c[k]; } return o; }));
}

function __adminRowEqual(a, b) {
if (!a || !b) return false;
if (a.id !== b.id) return false;
return a.title === b.title && a.desc === b.desc && a.img === b.img && a.price === b.price &&
a.is_online === b.is_online && a.is_hidden === b.is_hidden && a.cid === b.cid && a.sort === b.sort;
}


function __clearSwitching() {
try {
var _pl2 = document.getElementById('productList');
if (_pl2) _pl2.classList.remove('is-switching');
var _pp2 = document.getElementById('adminPager');
if (_pp2) _pp2.classList.remove('is-switching');
} catch (e) { if (window.__silent) window.__silent(e); }
}

function loadProducts(silent) {


var kw = (document.getElementById('adminSearch').value || '').trim();
var filterCat = document.getElementById('filterCat').value;
var filterStatus = document.getElementById('filterStatus').value;
var _cacheKey = __adminProductCacheKey(adminPage, kw, filterCat, filterStatus);
var _cache = __adminProductCache[_cacheKey];
if (!silent && _cache) {
state.products = _cache.products || [];
state.totalPages = _cache.totalPages || 1;
state.total = _cache.total || 0;
state._backendPaged = _cache._backendPaged;
renderProducts();
initFilterCatPicker();
loadProducts(true).catch(function () {});
return Promise.resolve();
}
var _loading = __adminProductCacheLoading[_cacheKey];
if (_loading) return _loading;

var _plBox = document.getElementById('productList');
var _hasSkel = _plBox && _plBox.querySelectorAll('.admin-skel').length > 0;
if (!silent) {
if (!state.products.length && !_hasSkel) {
window.__adminSkelP = true; renderProductSkeleton();
} else if (_hasSkel) {
window.__adminSkelP = true;
} else if (state.products.length) {

var _pl = document.getElementById('productList');
if (_pl) _pl.classList.add('is-switching');
var _plPager = document.getElementById('adminPager');
if (_plPager) _plPager.classList.add('is-switching');
}
}
var _snapP = silent ? __adminDataSig(state.products) : null;
var ensureCat = state.categories.length
? Promise.resolve()
: (window.__catLoading || loadCategories()).then(function (res) {
if (res && res.ok) {

var _cl = (res.list || []);
if (_cl.length || !(state.categories || []).length) state.categories = _cl.map(function (c) { return { id: Number(c.id), parent_id: Number(c.parent_id), name: c.name, sort: Number(c.sort) || 0, is_hidden: c.is_hidden, cnt: Number(c.cnt) || 0 }; });
}
});
var qs = '?page=' + adminPage + '&page_size=' + ADMIN_PAGE_SIZE;
if (kw) qs += '&kw=' + encodeURIComponent(kw);
if (filterCat && filterCat !== '0') qs += '&cid=' + encodeURIComponent(filterCat);
if (filterStatus) qs += '&status=' + encodeURIComponent(filterStatus);
var _reqCacheKey = _cacheKey;
var _doFetch = function () {
return ensureCat.then(function () {
if (!silent) initFilterCatPicker();
return api('admin/products' + qs);
}).then(function (res) {
var curCacheKey = __adminProductCacheKey(adminPage, (document.getElementById('adminSearch').value || '').trim(), document.getElementById('filterCat').value, document.getElementById('filterStatus').value);
if (curCacheKey !== _reqCacheKey) return;
__clearSwitching();
try { window.__clearLoadRetry(document.getElementById('productList')); } catch (e0) { if (window.__silent) window.__silent(e0); }
if (!res.ok) {
if (silent) return;

window.__adminSkelP = false; __clearAdminSkel(document.getElementById('productList'));
var _em = document.getElementById('productEmpty');
if (_em && !(state.products || []).length) { _em.classList.add('show'); document.getElementById('productEmptyTitle').textContent = __getAdminEmptyText(); }

try {
var _plb = document.getElementById('productList');
if (_plb && !(state.products || []).length) {
window.__showLoadRetry(_plb.parentNode || _plb, function () {
__adminProductCache = {};
loadProducts();
});
}
} catch (e0) { if (window.__silent) window.__silent(e0); }
if (!(state.products || []).length) {
toast(res.msg || '网络没连上，稍后再试', 'error');
}
return; }
window.__lastFetchTime = Date.now();
var _newP = res.list || [];
if (silent && __adminDataSig(_newP) === _snapP) return;
if (silent) initFilterCatPicker();
window.__adminSkelP = false;
state.products = _newP;
if (res.total_pages !== undefined) {
state.totalPages = res.total_pages || 1;
state.total = res.total || 0;
state._backendPaged = true;
} else {
state._backendPaged = true;
if (res.total !== undefined) state.total = res.total || 0;
}
__adminProductCache[_reqCacheKey] = {
products: _newP,
totalPages: state.totalPages,
total: state.total,
_backendPaged: state._backendPaged,
timestamp: Date.now()
};
renderProducts();
if (!silent) backfillCoverThumbs(_newP);

if (!silent && adminPage === 1 && !kw && (!filterCat || filterCat === '0') && !filterStatus) __preloadAdminFilterCombos();
prefetchBindings();
var _vp = (state.products || []).map(function (p) {
if (!p.id || Array.isArray(p.variants)) return Promise.resolve();
return api('admin/variants?product_id=' + p.id).then(function (vr) {
if (vr && vr.ok) p.variants = vr.list || [];
}).catch(function () {});
});
Promise.all(_vp).then(function () { __saveAdminState(); });
__saveAdminState();
});
};
var _p = _doFetch();
if (!silent) __adminProductCacheLoading[_cacheKey] = _p;
_p.then(function () { delete __adminProductCacheLoading[_cacheKey]; })
.catch(function () {
delete __adminProductCacheLoading[_cacheKey]; __clearSwitching();

try {
if (!silent) {
window.__adminSkelP = false; __clearAdminSkel(document.getElementById('productList'));
var _em = document.getElementById('productEmpty');
if (_em && !(state.products || []).length) { _em.classList.add('show'); var _et = document.getElementById('productEmptyTitle'); if (_et) _et.textContent = __getAdminEmptyText(); }
var _plb = document.getElementById('productList');
if (_plb && !(state.products || []).length) {
window.__showLoadRetry(_plb.parentNode || _plb, function () { __adminProductCache = {}; loadProducts(); });
}
}
} catch (e0) { if (window.__silent) window.__silent(e0); }
});
return _p;
}

document.addEventListener('change', function (e) {
if (e.target.id === 'filterCat' || e.target.id === 'filterStatus') {
adminPage = 1;

try { localStorage.setItem('wnzyq_admin_filter', JSON.stringify({ c: document.getElementById('filterCat').value, s: document.getElementById('filterStatus').value })); } catch (e0) { if (window.__silent) window.__silent(e0); }
loadProducts();
}
});
document.addEventListener('input', function (e) {
if (e.target.id === 'adminSearch') {
clearTimeout(window.__adminSearchTimer);
window.__adminSearchTimer = setTimeout(function () {
try { window.__skelPhaseAdmin && window.__skelPhaseAdmin(); } catch (e) { if (window.__silent) window.__silent(e); }
adminPage = 1;
loadProducts();
var __sv = document.getElementById('adminSearch').value; if (__sv.trim()) window.pushSearchHist('wnzyq_admin_search_hist', __sv);
}, 300);
var __ac = document.getElementById('adminSearchClear');
if (__ac) __ac.classList.toggle('show', e.target.value.length > 0);
}
});

var __adminProductCache = {};
window.__reloadAdminProducts = function () { __adminProductCache = {}; loadProducts(true); };
var __adminProductCacheLoading = {};
function __adminProductCacheKey(page, kw, filterCat, filterStatus) {
return (page || 1) + ':' + (kw || '') + ':' + (filterCat || '0') + ':' + (filterStatus || '');
}


function __adminPreloadCombo(page, kw, cat, status) {
var key = __adminProductCacheKey(page, kw, cat, status);
if (__adminProductCache[key] || __adminProductCacheLoading[key]) return;
var qs = '?page=' + page + '&page_size=' + ADMIN_PAGE_SIZE;
if (kw) qs += '&kw=' + encodeURIComponent(kw);
if (cat && cat !== '0') qs += '&cid=' + encodeURIComponent(cat);
if (status) qs += '&status=' + encodeURIComponent(status);
var p = api('admin/products' + qs).then(function (res) {
if (!res || !res.ok) return;
__adminProductCache[key] = {
products: res.list || [],
totalPages: (res.total_pages !== undefined ? res.total_pages : 1) || 1,
total: res.total || 0,
_backendPaged: true,
timestamp: Date.now()
};
}).catch(function () {});
__adminProductCacheLoading[key] = p;
var _clr = function () { delete __adminProductCacheLoading[key]; };
p.then(_clr, _clr);
}
function __preloadAdminFilterCombos() {
try {
var cats = (state.categories || []).map(function (c) { return String(c.id); });
var totalItems = (state.products || []).length + cats.length;
if (totalItems > 500) return;
cats.forEach(function (cid2) { __adminPreloadCombo(1, '', cid2, ''); });
['online', 'hidden'].forEach(function (st) { __adminPreloadCombo(1, '', '0', st); });
} catch (e) { if (window.__silent) window.__silent(e); }
}

var adminPage = 1;
var __adminTurning = false;
var __pendingAdminOpts = null;
var __lastAdminSeq = 0;
var ADMIN_PAGE_SIZE = (window.WN_CONST && window.WN_CONST.ADMIN_PAGE_SIZE) || 20;

function __flushPendingAdmin() {
if (!__pendingAdminOpts) return;
var _opts = __pendingAdminOpts;
__pendingAdminOpts = null;
if (_opts.page) __adminTurnPage(_opts.page);
else if (_opts.reload) loadProducts();
}

var __adminTotalPages = 1;
function __adminTurnPage(p) {
if (p === adminPage || __adminTurning) {
if (__adminTurning && p !== adminPage) __pendingAdminOpts = { page: p };
return;
}
__adminTurning = true;
adminPage = p;
if (state._backendPaged) {
loadProducts().then(function () {
__adminTurning = false;
try {
var _pl2 = document.getElementById('productList');
if (_pl2) _pl2.scrollIntoView({ behavior: 'smooth', block: 'start' });
} catch (e) { if (window.__silent) window.__silent(e); }
__flushPendingAdmin();
}).catch(function () {
__adminTurning = false;
__flushPendingAdmin();
});
} else {
renderProducts();
__adminTurning = false;
try {
var _pl2 = document.getElementById('productList');
if (_pl2) _pl2.scrollIntoView({ behavior: 'smooth', block: 'start' });
} catch (e) { if (window.__silent) window.__silent(e); }
__flushPendingAdmin();
}
}



function __clearAdminSkel(box) { if (!box) return; var _s = box.querySelectorAll('.admin-skel'); for (var i = 0; i < _s.length; i++) { if (_s[i].parentNode) _s[i].parentNode.removeChild(_s[i]); } }
function renderProductSkeleton(n) {
var box = document.getElementById('productList'); if (!box) return;
if (box.querySelectorAll('.admin-skel').length > 0) return;
var oldPager = document.getElementById('adminPager'); if (oldPager && oldPager.parentNode) oldPager.parentNode.removeChild(oldPager);
var empty = document.getElementById('productEmpty'); if (empty) empty.classList.remove('show');
box.style.minHeight = ''; box.innerHTML = '';
var frag = document.createDocumentFragment();
var cnt = n || ADMIN_PAGE_SIZE;
for (var i = 0; i < cnt; i++) {
var row = document.createElement('div');
row.className = 'product-row skel admin-skel';
row.setAttribute('aria-hidden', 'true');

var built = null;
try {
built = __buildProductRow({ id: '__skel__', title: '', desc: '', img: '', price: 0, is_online: 1, is_hidden: 0, cid: 0, sort: 0 }, 0, {}, '');
} catch (e0) { built = null; }
if (built) {
built.className = 'product-row skel admin-skel';
built.setAttribute('aria-hidden', 'true');
built.removeAttribute('data-id'); built.removeAttribute('data-idx');
try {
var pieces = built.querySelectorAll('.thumb, .p-title, .p-sub, .row-check, .row-btn, .drag-handle, .badge, .cat-picker-display');
for (var k = 0; k < pieces.length; k++) {
pieces[k].classList.add('sk-piece');
var txt = pieces[k].querySelectorAll('span, i, b');
for (var m = 0; m < txt.length; m++) txt[m].textContent = '';
}
} catch (e1) { if (window.__silent) window.__silent(e1); }
frag.appendChild(built);
} else {
row.innerHTML = '<span class="drag-handle sk-piece"></span><span class="row-check sk-piece"></span><div class="thumb sk-piece"></div><div class="info"><div class="p-title sk-piece"></div><div class="p-sub sk-piece"></div></div><div class="p-ops"><span class="row-btn sk-piece sk-code"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span><span class="row-btn sk-piece"></span></div>';
frag.appendChild(row);
}
}
box.appendChild(frag);
}
function renderCatSkeleton(n) {
var box = document.getElementById('catList'); if (!box) return;
if (box.querySelectorAll('.admin-skel').length > 0) return;
box.style.minHeight = ''; box.innerHTML = '';
var frag = document.createDocumentFragment();
for (var i = 0; i < (n || 20); i++) {
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
if (tb.querySelectorAll('.admin-skel').length > 0) return;
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

var __skels = box.querySelectorAll('.admin-skel'); var __reuse = __skels.length > 0;

var kw = (document.getElementById('adminSearch').value || '').trim().toLowerCase();
var filterCat = document.getElementById('filterCat').value;
var filterStatus = document.getElementById('filterStatus').value;
var list;
if (state._backendPaged) {
list = state.products;
} else {
list = state.products.filter(function (p) {
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
}

if (window.__adminSkelP && !list.length) { empty.classList.remove('show'); return; }
if (!__reuse) box.innerHTML = '';

empty.classList.toggle('show', !list.length);

var oldPager = document.getElementById('adminPager');
if (oldPager) oldPager.parentNode.removeChild(oldPager);

if (list.length === 0) {

if (__reuse) box.innerHTML = '';
document.getElementById('productEmptyTitle').textContent = __getAdminEmptyText();

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
adminPage = 1; loadProducts();
});
empty.appendChild(__cb);
}

var __fcv = document.getElementById('filterCat').value;
var __fsv = document.getElementById('filterStatus').value;
if (!__kw && (!__fcv || __fcv === '0') && !__fsv) {
var __add = document.createElement('button');
__add.type = 'button'; __add.className = 'empty-clear-btn'; __add.textContent = '前往添加资源';
__add.addEventListener('click', function () { var __b = document.getElementById('addProductBtn'); if (__b) __b.click(); });
empty.appendChild(__add);
}
updateBatchBar(); return;
}

var totalPages, pageList, start;
if (state._backendPaged) {
totalPages = state.totalPages || 1;
pageList = list;
start = 0;
} else {
totalPages = Math.ceil(list.length / ADMIN_PAGE_SIZE);
if (adminPage > totalPages) adminPage = totalPages;
start = (adminPage - 1) * ADMIN_PAGE_SIZE;
pageList = list.slice(start, start + ADMIN_PAGE_SIZE);
}
__adminTotalPages = totalPages;


function __buildProductRow(p, idx, catNameMap, searchKw) {
var row = document.createElement('div');
row.className = 'product-row';
row.classList.add('stagger-in'); row.style.animationDelay = Math.min(idx * 20, 180) + 'ms';
row.draggable = false;
row.dataset.id = p.id;
row.dataset.idx = idx;
var handle = document.createElement('span'); handle.className = 'drag-handle'; handle.tabIndex = 0; handle.setAttribute('role', 'button'); handle.setAttribute('aria-label', '拖动排序（也可用方向键）');
handle.addEventListener('keydown', function (ev) { if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); var row = handle.closest('[data-id]'); var sib = ev.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling; if (row && sib && row.parentNode) { row.parentNode.insertBefore(ev.key === 'ArrowUp' ? row : sib, ev.key === 'ArrowUp' ? sib : row); try { toast('已' + (ev.key === 'ArrowUp' ? '上移' : '下移') + '，记得保存顺序', 'success'); } catch (e) { if (window.__silent) window.__silent(e); } } } });; handle.draggable = true; handle.title = '拖动排序'; handle.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>'; row.appendChild(handle);

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

var cb = document.createElement('input');
cb.type = 'checkbox';
cb.className = 'row-check';
cb.dataset.id = p.id;

cb.setAttribute('aria-label', '选择资源：' + String(p.title || '未命名').slice(0, 40));
cb.style.flexShrink = '0';
cb.style.width = '20px';
cb.style.height = '20px';
cb.style.cursor = 'pointer';
cb.style.accentColor = 'var(--blue1)';
cb.checked = !!state.prodSelected[p.id]; cb.addEventListener('change', function () { state.prodSelected[p.id] = this.checked; updateBatchBar(); });

var img = document.createElement('img');
img.className = 'thumb';
img.decoding = 'async';

img.alt = String(p.title || '资源封面').slice(0, 40);

var _origImg = p.img || '';
img.style.opacity = '0';
img.onload = function () { this.style.opacity = '1'; this.classList.add('img-in'); };
img.onerror = function () {

if (_origImg && this.getAttribute('src') !== _origImg) { this.src = _origImg; return; }
this.onerror = null; this.src = window.WN_MEDIA_FALLBACK; this.style.opacity = '1'; if (this && this.classList) this.classList.add('media-fail');
};
img.src = _origImg ? thumbOf(_origImg) : window.WN_MEDIA_FALLBACK;

var info = document.createElement('div');
info.className = 'info';
var t = document.createElement('div');
t.className = 'p-title';
var __kw = ((document.getElementById('adminSearch') || {}).value || '').trim();
if (__kw && p.title) {
var __esc = window.escapeHtml || function (x) { return String(x); };
var __lo = String(p.title).toLowerCase(), __k = __kw.toLowerCase(), __o = '', __i = 0, __h;
if (__k) { while ((__h = __lo.indexOf(__k, __i)) !== -1) { __o += __esc(p.title.slice(__i, __h)) + '<mark class="hl">' + __esc(p.title.slice(__h, __h + __k.length)) + '</mark>'; __i = __h + __k.length; } }
t.innerHTML = __o + __esc(p.title.slice(__i));
} else t.textContent = p.title || '(无标题)';
var s = document.createElement('div');
s.className = 'p-sub';

var _catTxt = String(catName[p.cid] || '').trim() || '未分类';
var _descTxt = String(p.desc || '').trim();
var _sc = document.createElement('span');
_sc.textContent = _catTxt;
var _sdot = document.createElement('span');
_sdot.className = 'p-dot';
_sdot.textContent = ' · ';
var _sd = document.createElement('span');
_sd.className = 'p-desc';
_sd.textContent = _descTxt;
s.appendChild(_sc);
if (_descTxt) { s.appendChild(_sdot); s.appendChild(_sd); }
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

if (p.updated_by || p.updated_at) {
var _ub = String(p.updatedBy || p.updated_by || '').trim();
var _ua = String(p.updated_at || '').trim();
var _ut = '';
if (_ua) {
try {
var _d = new Date(_ua.replace(' ', 'T') + 'Z');
if (!isNaN(_d.getTime())) { _d = new Date(_d.getTime() + 8 * 3600e3); _ut = _d.toISOString().slice(5, 16).replace('T', ' '); }
} catch (eT) { if (window.__silent) window.__silent(eT); }
}
var _ebTxt = (_ub ? _ub + ' ' : '') + _ut;
if (_ebTxt.trim()) {
if (s.childNodes.length) {
var _ebDot = document.createElement('span');
_ebDot.className = 'p-dot';
_ebDot.textContent = ' · ';
s.appendChild(_ebDot);
}
var _eb = document.createElement('span');
_eb.className = 'p-edit-by';
_eb.textContent = _ebTxt.trim();
_eb.title = '最后一次修改：' + (_ub || '未知账号') + ' ' + _ut;
s.appendChild(_eb);
}
}
info.appendChild(t);
info.appendChild(s);

var curStatus = (p.is_online && !p.is_hidden) ? 'online' : 'offline';
var statusBtn = document.createElement('button');
statusBtn.className = 'row-btn status-btn status-' + (curStatus === 'online' ? 'online' : 'hidden');
statusBtn.textContent = curStatus === 'online' ? '显示' : '隐藏';
statusBtn.setAttribute('data-perm', 'products.online');
statusBtn.title = '点击切换为' + (curStatus === 'online' ? '隐藏（资源页不显示）' : '显示');

if (window.__decorateBtn) window.__decorateBtn(statusBtn, curStatus === 'online' ? 'show' : 'hide', 2);
statusBtn.addEventListener('click', function (e) {
e.stopPropagation();
if (window.__catToggleBusy) return;
window.__catToggleBusy = true;
var next = (p.is_online && !p.is_hidden) ? 'offline' : 'online';
setProductStatus(p.id, next);
setTimeout(function () { window.__catToggleBusy = false; }, 800);
});


var ops = document.createElement('div');
ops.className = 'p-ops btn-fit-group';
var editBtn = document.createElement('button');
editBtn.className = 'row-btn';
editBtn.textContent = '编辑';
editBtn.setAttribute('data-perm', 'products.edit');
editBtn.title = '编辑';
if (window.__decorateBtn) window.__decorateBtn(editBtn, 'edit', 1);
editBtn.addEventListener('click', function () { openEdit(p); });
var copyBtn = document.createElement('button');
copyBtn.className = 'row-btn';
copyBtn.textContent = '复制';
copyBtn.setAttribute('data-perm', 'products.add');
copyBtn.title = '复制此资源为新资源';
if (window.__decorateBtn) window.__decorateBtn(copyBtn, 'copy', 3);
copyBtn.addEventListener('click', function () { copyProduct(p); });
var delBtn = document.createElement('button');
delBtn.className = 'row-btn danger';
delBtn.textContent = '删除';
delBtn.setAttribute('data-perm', 'products.del');
delBtn.title = '删除';
if (window.__decorateBtn) window.__decorateBtn(delBtn, 'del', 6);
delBtn.addEventListener('click', function () { delProduct(p.id); });
var codePicker = document.createElement('div');
codePicker.setAttribute('data-perm', 'info.view');
codePicker.className = 'select-picker code-picker';
var __cpid = 'cp-' + Math.random().toString(36).slice(2, 9);
codePicker.dataset.pickerId = __cpid;
var cpDisp = document.createElement('div');
cpDisp.className = 'cat-picker-display row-btn';
var cpTxt = document.createElement('span');
cpTxt.className = 'cpd-text';
cpTxt.textContent = '资源';
var cpArrow = document.createElement('span');
cpArrow.className = 'cpd-arrow';
cpArrow.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>';
cpDisp.appendChild(cpTxt); cpDisp.appendChild(cpArrow);
cpDisp.title = '资源码';
var cpPanel = document.createElement('div');
cpPanel.className = 'cat-picker-panel';
cpPanel.dataset.pickerId = __cpid;

try { if (window.__decorateBtn) window.__decorateBtn(cpDisp, 'key', 4); } catch (e) { if (window.__silent) window.__silent(e); }
codePicker.appendChild(cpDisp); codePicker.appendChild(cpPanel);
function renderCodePanel(variants) {
cpPanel.innerHTML = '';
if (!variants || !variants.length) {
cpPanel.innerHTML = window.__adminEmpty('该资源暂无类型', '先到「类型管理」新增类型');
return;
}
variants.forEach(function (v) {
var item = document.createElement('div');
item.className = 'cp-item';
var nm = document.createElement('span');
nm.className = 'cp-name';
nm.textContent = v.name || '(未命名)';
nm.style.cssText = 'font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;min-width:0;max-width:150px;';
nm.title = v.name || '(未命名)';
item.appendChild(nm);
var _vPriceText = formatPrice(v.price);
if (_vPriceText) {
var _vp = document.createElement('span');
_vp.className = 'cp-price';
_vp.textContent = _vPriceText;
item.appendChild(_vp);
} else {
var _vpp = document.createElement('span');
_vpp.className = 'price-slot-ph';
item.appendChild(_vpp);
}
if (v.resourceCode && v.resourceCode.trim()) {
var cd = document.createElement('button');
cd.type = 'button';
cd.className = 'row-btn code-slot';
cd.style.cssText = 'font-family:monospace;letter-spacing:1px;font-weight:600;background:var(--blue1);color:#fff;border-color:var(--blue1);';
cd.textContent = v.resourceCode;

try { if (window.__decorateBtn) window.__decorateBtn(cd, 'key', 5); } catch (e2) { if (window.__silent) window.__silent(e2); }
cd.title = v.resourceCode + '（点击复制并发新码）';
item.appendChild(cd);
(function (cvObj, cdEl) {

if (window.__me && window.__me.role !== 'super') {
cdEl.disabled = true;
cdEl.style.cursor = 'default';
cdEl.title = '仅超级管理员可发码';
return;
}

cdEl.addEventListener('click', function (ev) {
ev.stopPropagation();
if (cdEl.disabled || window.__issueInFlight) return;
cdEl.disabled = true; if (window.__btnBusy) window.__btnBusy(cdEl, '发码中'); else cdEl.textContent = '发码中';
__issueCode(cvObj, function () { renderCodePanel(variants); });
});
})(v, cd);
} else {
var nc = document.createElement('button');
nc.type = 'button';
nc.className = 'row-btn code-slot';
nc.style.cssText = 'color:var(--text-light);cursor:default;';
nc.textContent = '无资源码';
item.appendChild(nc);
item.style.cursor = 'default';
}
cpPanel.appendChild(item);
});
}
renderCodePanel(p.variants);
codePicker.__renderCodePanel = renderCodePanel;
codePicker.__product = p;
cpDisp.addEventListener('click', function () {
if (!p.variants) {
api('admin/variants?product_id=' + p.id).then(function (res) {
if (res && res.ok) {
p.variants = (res.list || []).slice();
var _pp = (state.products || []).find(function (x) { return x.id === p.id; });
if (_pp) _pp.variants = (res.list || []).slice();
renderCodePanel(p.variants);

if (!codePicker.classList.contains('open')) {
codePicker.classList.add('open');
var _cpPanel = document.querySelector('.cat-picker-panel[data-picker-id="' + codePicker.dataset.pickerId + '"]');
if (_cpPanel) { if (_cpPanel.parentNode !== document.body) document.body.appendChild(_cpPanel); _cpPanel.classList.add('open'); }
if (typeof positionCatPanel === 'function') positionCatPanel(codePicker);
}
}
});
} else {
renderCodePanel(p.variants);
}
});
ops.appendChild(codePicker);
ops.appendChild(copyBtn);
ops.appendChild(statusBtn);
ops.appendChild(editBtn);
ops.appendChild(delBtn);

row.appendChild(cb);
row.appendChild(img);
row.appendChild(info);
row.appendChild(ops);

return row;
}

var catName = {};
state.categories.forEach(function (c) { catName[c.id] = c.name; });

var diffMode = state._backendPaged && !__reuse && !window.__adminSkelP;
var existingMap = {};
if (diffMode) {
box.querySelectorAll('.product-row').forEach(function(r) {
if (r.dataset.id) existingMap[r.dataset.id] = r;
});
}

pageList.forEach(function (p, idx) {
var existing = diffMode ? existingMap[p.id] : null;
if (existing && existing.__pData && __adminRowEqual(existing.__pData, p)) {
existing.dataset.idx = idx;
delete existingMap[p.id];
return;
}
var row = __buildProductRow(p, idx, catName, kw);
row.__pData = p;
if (diffMode && existing) {
existing.parentNode.replaceChild(row, existing);
delete existingMap[p.id];
} else if (__reuse && __skels[idx]) {
__skels[idx].parentNode.replaceChild(row, __skels[idx]);
} else {
box.appendChild(row);
}
box.style.minHeight = '';
});
if (diffMode) {
for (var _eid in existingMap) {
var _er = existingMap[_eid];
if (_er && _er.parentNode) _er.parentNode.removeChild(_er);
}
}

try { if (window.__applyPermUI) window.__applyPermUI(); } catch (eP) { if (window.__silent) window.__silent(eP); }

if (__reuse) { for (var __sj = pageList.length; __sj < __skels.length; __sj++) { if (__skels[__sj] && __skels[__sj].parentNode) __skels[__sj].parentNode.removeChild(__skels[__sj]); } }

setTimeout(function () { var _b = document.getElementById('productList'); if (_b) { _b.classList.remove('prod-fade'); void _b.offsetWidth; _b.classList.add('prod-fade'); } }, 10);
var pager = document.createElement('div');
pager.id = 'adminPager';
box.parentNode.insertBefore(pager, box.nextSibling);
if (window.buildUniPager) {
window.buildUniPager(pager, {
page: adminPage,
totalPages: totalPages,
total: state._backendPaged ? (state.total || list.length) : list.length,
unit: '个',

onPage: __adminTurnPage
});
} else if (totalPages > 1) {
var prev = document.createElement('button');
prev.textContent = '上一页';
prev.style.cssText = 'padding:6px 14px;border:1px solid var(--border,#ddd);background:var(--card-bg,#fff);color:var(--text,#222);border-radius:8px; /* v293（用户 10-04 02:14）：054圆角统一→6px不在5档阶梯，改8px跟全站最小档统一 */ cursor:pointer;font-size: 14px;';
window.__setPagerDisabled(prev, adminPage === 1);
prev.onclick = function () { if (adminPage > 1) { adminPage--; if (state._backendPaged) loadProducts(); else renderProducts(); } };
pager.appendChild(prev);
var info = document.createElement('span');
info.textContent = adminPage + ' / ' + totalPages + '（共' + (state._backendPaged ? (state.total || list.length) : list.length) + '件）';
info.style.cssText = 'color:var(--text-light,#666);font-size: 14px;';
pager.appendChild(info);
var next = document.createElement('button');
next.textContent = '下一页';
next.style.cssText = 'padding:6px 14px;border:1px solid var(--border,#ddd);background:var(--card-bg,#fff);color:var(--text,#222);border-radius:8px; /* v293（用户 10-04 02:14）：054圆角统一→6px不在5档阶梯，改8px跟全站最小档统一 */ cursor:pointer;font-size: 14px;';
window.__setPagerDisabled(next, adminPage === totalPages);
next.onclick = function () { if (adminPage < totalPages) { adminPage++; if (state._backendPaged) loadProducts(); else renderProducts(); } };
pager.appendChild(next);
}

updateBatchBar();
if (window.__btnFit) { window.__btnFit(); setTimeout(function () { try { window.__btnFit(); } catch (e) { if (window.__silent) window.__silent(e); } }, 130); }
}

function copyProduct(p) {
showConfirm('复制资源', '确定复制资源「' + (p.title || '未命名') + '」？将创建一个内容完全相同的新资源（仅状态为隐藏，其余字段含排序全部照复制）。', function (closeConfirm) {
var newProduct = {
cid: p.cid,
title: p.title || '未命名',
desc: p.desc || '',
detail: p.detail || '',
img: p.img || '',
detailImages: p.detailImages || [],
detailVideos: p.detailVideos || [],
contactUrl: p.contactUrl || '',
price: p.price || 0,
schedule_on: p.schedule_on || null,
schedule_off: p.schedule_off || null,
variants: p.variants ? JSON.parse(JSON.stringify(p.variants)) : [],
is_online: false,
is_hidden: p.is_hidden ? 1 : 0,
sort: p.sort || 0
};
api('admin/products', { method: 'POST', body: JSON.stringify(newProduct) }).then(function (res) {
closeConfirm();
if (res && res.ok) {
var _vs = newProduct.variants || [], _chain = Promise.resolve(), _newId = res.id, _fail = 0;
_vs.forEach(function (v) {
_chain = _chain.then(function () {
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
__inflight[action] = false; }).catch(function () { closeConfirm(); toast('复制失败，请重试', 'error'); });
});
}

function reorderProducts(draggedId, targetId) {
var fromIdx = state.products.findIndex(function (p) { return p.id === draggedId; });
var toIdx = state.products.findIndex(function (p) { return p.id === targetId; });
if (fromIdx === -1 || toIdx === -1) return;

var _listEl = document.getElementById('productList');
var _flip = (window.__motion && __motion.flipSnap && _listEl) ? __motion.flipSnap(_listEl, '.product-row') : null;
var item = state.products.splice(fromIdx, 1)[0];
state.products.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, item);
toast('正在保存排序…', 'info');
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
}).catch(function () { return { ok: false }; });
});
Promise.all(updates).then(function (results) {
var hasErr = results.some(function (r) { return !r || !r.ok; });
if (hasErr) { toast('排序保存失败，请重试', 'error'); }
else { }
renderProducts();
try { if (_flip) _flip(); } catch (e) { if (window.__silent) window.__silent(e); }
});
}

function updateBatchBar() {
var checks = document.querySelectorAll('.row-check:checked');
var count = checks.length;
var bar = document.getElementById('batchBar');
var countEl = document.getElementById('batchCount');
var selectAll = document.getElementById('selectAll');
countEl.textContent = count;
window.__setBatchBar(bar, count > 0);
try { window.__btnFit && window.__btnFit(); } catch (e) { if (window.__silent) window.__silent(e); }
var allChecks = document.querySelectorAll('.row-check');
selectAll.checked = allChecks.length > 0 && count === allChecks.length;
}

var __batchBusy = false;
var __inflight = {};

function __bDone(a) { __inflight[a] = false; }
function batchAction(action) {
if (__batchBusy) return;
if (__inflight[action]) return; __inflight[action] = true;

var __preSnapshot = JSON.stringify(state.products || []);
if (action === 'clearSel') { state.prodSelected = {}; document.querySelectorAll('.row-check').forEach(function (cb) { cb.checked = false; }); var _sa = document.getElementById('selectAll'); if (_sa) _sa.checked = false; updateBatchBar(); __bDone(action); return; } var ids = Array.from(document.querySelectorAll('.row-check:checked')).map(function (cb) { return Number(cb.dataset.id); });
if (ids.length === 0) { __bDone(action); return; }
var actionNames = { online: '批量显示', offline: '批量隐藏', delete: '批量删除', changeCat: '批量改分类', changePrice: '批量改价格' };
var msgs = {
online: '确定显示选中的 ' + ids.length + ' 个资源？',
offline: '确定隐藏选中的 ' + ids.length + ' 个资源？隐藏后资源页不显示。',
delete: '确定删除选中的 ' + ids.length + ' 个资源？其类型和统计数据也会一并删除；删除后进「回收站点」保留 60 天，可恢复。'
};

if (action === 'changeCat') {
var select = document.getElementById('batchCatSelect');
buildCatPicker(document.getElementById('batchCatPicker'), select,
document.getElementById('batchCatDisplay'), document.getElementById('batchCatPanel'),
Number(select.value) || 0, { allowUncategorized: true, });
__bDone(action);
document.getElementById('batchCatMask').classList.add('open'); if (!document.getElementById('batchCatMask')._bm) { document.getElementById('batchCatMask')._bm = 1; document.getElementById('batchCatMask').addEventListener('click', function (e) { if (e.target === this) { this.classList.remove('open'); try { this.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); } } }); }
var okBtn = document.getElementById('batchCatOk');
okBtn.onclick = function () {
var newCid = Number(select.value);
if (isNaN(newCid)) { toast('请选择资源分类', 'error'); return; }
document.getElementById('batchCatMask').classList.remove('open');
var _catText = document.querySelector('#batchCatDisplay .cpd-text').textContent;
showConfirm('批量改分类', '确定将选中的 ' + ids.length + ' 个资源分类改为「' + _catText + '」？', function (closeConfirm) {
api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: 'changeCat', cid: newCid }) }).then(function (res) {
closeConfirm();
if (res && res.ok) {
toast('批量改分类完成：成功 ' + res.count + ' 项', 'success');
silentSyncProducts();
}
else toast(res.msg || '操作失败', 'error');
__inflight[action] = false; }).catch(function () { closeConfirm(); __bDone(action); toast(window.T('netFail'), 'error'); });
});
};
return;
}

if (action === 'changePrice') {
__bDone(action);
showInput('批量改价格', '输入新价格（数字，0表示免费）', '请输入新价格', function (priceInput) {
if (priceInput === null || priceInput === '') return;
var newPrice = Number(priceInput);
if (isNaN(newPrice) || newPrice < 0) { toast('请输入有效的价格', 'error'); return; }
showConfirm('批量改价格', '确定将选中的 ' + ids.length + ' 个资源价格改为 ' + newPrice + '？', function (closeConfirm) {
api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: 'changePrice', price: newPrice }) }).then(function (res) {
closeConfirm();
if (res && res.ok) {
toast('批量改价格完成：成功 ' + res.count + ' 项', 'success');
silentSyncProducts();
}
else toast(res.msg || '操作失败', 'error');
}).catch(function () { closeConfirm(); __bDone(action); toast(window.T('netFail'), 'error'); });
});
});
return;
}


if (action === 'delete') {
var _runDelete = function () {
var _snap = (state.products || []).slice();
applyBatchLocal('delete', ids); renderProducts();
api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: action }) }).then(function (res) {
if (res && res.ok) {
clearCache();
__undoable(
'已删除 ' + ids.length + ' 个资源 · 回收站点可找回',
function () { silentSyncProducts(); },
function () {
var _seq = Promise.resolve();
ids.forEach(function (id) {
_seq = _seq.then(function () {
return api('admin/recycle', { method: 'POST', body: JSON.stringify({ op: 'restore', kind: 'product', id: id }) });
});
});
_seq.then(function () {
clearCache();
toast('已恢复 ' + ids.length + ' 个资源', 'success');
silentSyncProducts();
}).catch(function () {
toast('恢复失败，请到「回收站点」手动恢复', 'error');
silentSyncProducts();
});
}
);
silentSyncProducts();
} else {
toast((res && res.msg) || '批量删除失败', 'error');
state.products = _snap; renderProducts();
}
}).catch(function () {
toast(window.T('netFail'), 'error');
state.products = _snap; renderProducts();
});
};
__bDone(action);
if (ids.length > 10) showConfirm(actionNames[action], msgs[action], function (closeConfirm) { closeConfirm(); _runDelete(); });
else _runDelete();
return;
}

showConfirm(actionNames[action], msgs[action], function (closeConfirm) {
api('admin/batch', { method: 'POST', body: JSON.stringify({ ids: ids, action: action }) }).then(function (res) {
closeConfirm();
if (res && res.ok) {
toast(actionNames[action] + '完成：成功 ' + res.count + ' 项', 'success');
clearCache();
applyBatchLocal(action, ids); renderProducts(); silentSyncProducts();
} else {
toast(res.msg || '操作失败', 'error');
}
}).catch(function () { closeConfirm(); __bDone(action); toast(window.T('netFail'), 'error'); });
});
}

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
try { refreshCatCnts(); } catch (e) { if (window.__silent) window.__silent(e); }
}
var __silentSyncT = 0;
function silentSyncProducts() {
clearTimeout(__silentSyncT);
__silentSyncT = setTimeout(function () {

var _kw = (document.getElementById('adminSearch').value || '').trim();
var _cat = document.getElementById('filterCat').value;
var _st = document.getElementById('filterStatus').value;
var _qs = '?page=' + adminPage + '&page_size=' + ADMIN_PAGE_SIZE;
if (_kw) _qs += '&kw=' + encodeURIComponent(_kw);
if (_cat && _cat !== '0') _qs += '&cid=' + encodeURIComponent(_cat);
if (_st) _qs += '&status=' + encodeURIComponent(_st);
api('admin/products' + _qs).then(function (res) {
if (!res || !res.ok) return;
state.products = res.list || [];
if (res.total_pages !== undefined) {
state.totalPages = res.total_pages || 1;
state.total = res.total || 0;
state._backendPaged = true;

try {
var _k = __adminProductCacheKey(adminPage, _kw, _cat, _st);
__adminProductCache[_k] = {
products: state.products,
totalPages: state.totalPages,
total: state.total,
_backendPaged: state._backendPaged,
timestamp: Date.now()
};
} catch (e2) { if (window.__silent) window.__silent(e2); }
}
renderProducts();
}).catch(function () {});
}, 600);
}

var __silentCatT = null;
function silentSyncCategories() {
clearTimeout(__silentCatT);
__silentCatT = setTimeout(function () { loadCategories(); }, 600);
}




var UNDO_MS = 10000;
function __undoable(label, commitFn, undoFn) {
var timer = setTimeout(function () { try { commitFn(); } catch (e) { if (window.__silent) window.__silent(e); } }, UNDO_MS);
try {
window.uiToast(label, 'success', function () {
clearTimeout(timer);
try { if (undoFn) undoFn(); } catch (e) { if (window.__silent) window.__silent(e); }
});
} catch (e) { clearTimeout(timer); try { commitFn(); } catch (e2) { if (window.__silent) window.__silent(e2); } }
}

function delProduct(id) {
var p = (state.products || []).filter(function (x) { return x.id === id; })[0];
if (!p) return;
var _idx = state.products.indexOf(p);
var _delRow = document.querySelector('#productList [data-id="' + id + '"]');

state.products = (state.products || []).filter(function (x) { return x.id !== id; });
try { refreshCatCnts(); } catch (e) { if (window.__silent) window.__silent(e); }
if (_delRow) { _delRow.style.transition = 'opacity 0.2s ease'; _delRow.style.opacity = '0'; }
setTimeout(function () {
if (_delRow && _delRow.parentNode) _delRow.parentNode.removeChild(_delRow);
if (!document.querySelector('#productList .product-row')) renderProducts();
}, 200);

api('admin/products/' + id, { method: 'DELETE' }).then(function (res) {
if (res && res.ok) {
clearCache();
__undoable(
'已删除「' + (p.title || '未命名') + '」· 回收站点可找回',
function () { silentSyncProducts(); },
function () {
api('admin/recycle', { method: 'POST', body: JSON.stringify({ op: 'restore', kind: 'product', id: id }) })
.then(function (r2) {
if (r2 && r2.ok) {
var _cur3 = (state.products || []).slice();
_cur3.splice(Math.min(_idx, _cur3.length), 0, p);
state.products = _cur3;
try { refreshCatCnts(); } catch (e0) { if (window.__silent) window.__silent(e0); }
renderProducts(); clearCache();
toast('已恢复「' + (p.title || '未命名') + '」', 'success');
} else {
toast((r2 && r2.msg) || '恢复失败，请到「回收站点」手动恢复', 'error');
}
})
.catch(function () { toast('恢复失败，请到「回收站点」手动恢复', 'error'); });
}
);
} else {
toast((res && res.msg) || '删除失败', 'error');
var _cur = (state.products || []).slice(); _cur.splice(Math.min(_idx, _cur.length), 0, p);
state.products = _cur; renderProducts();
}
}).catch(function () {
toast(window.T('delFail'), 'error');
var _cur2 = (state.products || []).slice(); _cur2.splice(Math.min(_idx, _cur2.length), 0, p);
state.products = _cur2; renderProducts();
});
}

var __productStatusBusy = false;
function setProductStatus(id, status) {
if (__productStatusBusy) return;
var target = state.products.filter(function (p) { return p.id === id; })[0];
if (!target) return;
var cur = (target.is_online && !target.is_hidden) ? 'online' : 'offline';
if (cur === status) return;
__productStatusBusy = true;
var prevOnline = target.is_online, prevHidden = target.is_hidden;
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
__productStatusBusy = false;

if (res && res.ok) { clearCache(); }
else {
target.is_online = prevOnline; target.is_hidden = prevHidden; window.__skipRenderOnce = false;
renderProducts();
toast(res.msg || '操作失败，状态已回滚', 'error');
}
}).catch(function () {
__productStatusBusy = false;

target.is_online = prevOnline; target.is_hidden = prevHidden; window.__skipRenderOnce = false;
renderProducts();
toast(window.T('netFail'), 'error');
});
}


(function () {
var ids = ['adminSearch', 'filterCat', 'filterStatus'];
var save = function () {
try {
var st = {};
ids.forEach(function (id) { var el = document.getElementById(id); if (el) st[id] = el.value; });
sessionStorage.setItem('wnzyq_filter_mem', JSON.stringify(st));
} catch (e0) { if (window.__silent) window.__silent(e0); }
};
ids.forEach(function (id) {
var el = document.getElementById(id);
if (!el) return;
el.addEventListener('change', save);
if (id === 'adminSearch') el.addEventListener('input', save);
});

try {
var st = JSON.parse(sessionStorage.getItem('wnzyq_filter_mem') || '{}');
var changed = false;
ids.forEach(function (id) { if (st[id] !== undefined && document.getElementById(id)) { document.getElementById(id).value = st[id]; changed = true; } });
if (changed && (st.filterCat || st.filterStatus || st.adminSearch)) {
try { if (document.getElementById('adminSearch')) document.getElementById('adminSearch').dispatchEvent(new Event('input', { bubbles: true })); } catch (e1) {}
}
} catch (e2) { if (window.__silent) window.__silent(e2); }
})();