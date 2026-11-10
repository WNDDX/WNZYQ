(function(){
var shopLogo = document.getElementById('shopLogo');
var shopNameEl = document.getElementById('shopName');
var searchInput = document.getElementById('searchInput');
var categoryBar = document.getElementById('categoryBar');
var productGrid = document.getElementById('productGrid');
var emptyTip = document.getElementById('emptyTip');
var topContactBtn = document.getElementById('topContact');
var topShareBtn = document.getElementById('topShare');
var shareMask = document.getElementById('shareMask');
var shareLinkText = document.getElementById('shareLinkText');
var shareClose = document.getElementById('shareClose');
var modalMask = document.getElementById('modalMask');
var modalCover = document.getElementById('modalCover');
var modalTitle = document.getElementById('modalTitle');
var modalPrice = document.getElementById('modalPrice');
var modalDesc = document.getElementById('modalDesc');
var modalDetail = document.getElementById('modalDetail');
var modalMedia = document.getElementById('modalMedia');
var variantTabs = document.getElementById('variantTabs');
var variantDetail = document.getElementById('variantDetail');
var btnContact = document.getElementById('btnContact');
var btnCloseModal = document.getElementById('btnCloseModal');
var modalCloseX = document.getElementById('modalCloseX');
var modalShareX = document.getElementById('modalShareX');
var DATA = { categories: [], products: [], announcement: '', announcementMode: 'always', announcements: [] };
var currentCat = 0;
var currentSubCat = 0;
var currentProduct = null;
var currentVariant = null;
var usingRemote = false;
var catIsOverflow = false;
var subCatIsOverflow = false;
var catExpanded = false;
var subCatExpanded = false;
var __pageCache = {};
var __pageCacheLoading = {};
var __catsSettingsCached = false;
function __cacheKey(page, cid, subCid, kw) {
return (cid || 0) + ':' + (subCid || 0) + ':' + (kw || '') + ':' + (page || 1);
}
var __bodyLockCount = 0;
function setBodyLock(lock) {
if (window.lockBodyScroll) {
if (lock) window.lockBodyScroll(true);
else if (window.syncBodyLock) window.syncBodyLock();
else window.lockBodyScroll(false);
return;
}
if (lock) { __bodyLockCount++; } else { __bodyLockCount = Math.max(0, __bodyLockCount - 1); }
var _locked = __bodyLockCount > 0; document.body.style.overflow = _locked ? 'hidden' : '';
}
function getDefaultContact() {
return (typeof SHOP_CONFIG !== 'undefined' && SHOP_CONFIG.defaultContactUrl) || '';
}
if (!window.lockBodyScroll) {
window.lockBodyScroll = function (lock) {
if (lock) { document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden'; }
else { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; }
};
window.syncBodyLock = function () { window.lockBodyScroll(document.body.style.overflow === 'hidden'); };
}
var __shopFetchInFlight = new Map();
function __dedupFetch(url, opts) {
opts = opts || {};
opts.credentials = opts.credentials || 'include';
var to = (window.WN_CONST && window.WN_CONST.TIMEOUT) || 10000;
return window.WNApi.request(url, {
method: opts.method, credentials: opts.credentials, headers: opts.headers,
body: opts.body, cache: opts.cache, raw: true, timeout: to
}).then(function (r) {
if (r && r._net) throw new Error(r.msg || 'network');
return r;
});
}
(function () {
var _sl = document.getElementById('shopLogo'); if (_sl && _sl.complete && _sl.naturalWidth === 0 && String(_sl.getAttribute('src')).indexOf('data:') !== 0) window.__logoFail(_sl); })();
if (!window.__mediaErrOnce) {
window.__mediaErrOnce = 1;
document.addEventListener('error', function (e) {
var t = e.target;
if (!t || !t.tagName || t.dataset.fh) return;
if (t.tagName === 'IMG') {
if (t.dataset.lf) return;
t.dataset.fh = '1';
t.src = window.WN_MEDIA_FALLBACK; if (t && t.classList) t.classList.add('media-fail');
t.style.display = 'block'; t.style.opacity = '1';
} else if (t.tagName === 'VIDEO') {
t.dataset.fh = '1';
var _href0 = t.getAttribute('src') || t.currentSrc || '';
var vf = makeVideoFallback(_href0);
if (vf && t.parentNode) t.parentNode.replaceChild(vf, t);
else if (t.parentNode) t.parentNode.removeChild(t);
}
}, true);
document.querySelectorAll('img').forEach(function (im) { if (im.dataset.lf) return; if (im.complete && im.naturalWidth === 0 && im.getAttribute('src') && im.getAttribute('src').indexOf('data:') !== 0) { im.dataset.fh = '1'; im.src = window.WN_MEDIA_FALLBACK; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block'; } });
}
function bindMediaFail(root) {
if (!root) return;
var imgs = root.querySelectorAll('img');
for (var i = 0; i < imgs.length; i++) (function (im) {
if (im.dataset.fh) return;
im.addEventListener('error', function () {
im.onerror = null;
im.src = window.WN_MEDIA_FALLBACK; if (im && im.classList) im.classList.add('media-fail');
im.style.display = 'block';
});
im.addEventListener('load', function () { if (!im.dataset.fh && im.naturalWidth === 0 && String(im.getAttribute('src') || '').indexOf('data:') !== 0) { im.dataset.fh = '1'; im.src = window.WN_MEDIA_FALLBACK; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block'; } });
var _s = im.getAttribute('src') || '';
if (!_s || _s.indexOf('data:') === 0 || (im.complete && im.naturalWidth === 0)) {
im.dataset.fh = '1'; im.src = window.WN_MEDIA_FALLBACK; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block';
}
})(imgs[i]);
var vids = root.querySelectorAll('video');
for (var j = 0; j < vids.length; j++) (function (vd) {
if (vd.dataset.fh) return;
vd.addEventListener('error', function () {
var vf = makeVideoFallback(_vs || (vd.currentSrc || ''));
if (vf && vd.parentNode) vd.parentNode.replaceChild(vf, vd);
else if (vd.parentNode) vd.parentNode.removeChild(vd);
});
var _vs = vd.getAttribute('src') || '';
if (!_vs && !vd.querySelector('source')) {
vd.dataset.fh = '1';
if (vd.parentNode) vd.parentNode.removeChild(vd);
}
})(vids[j]);
}
function bindFileCards(root) {
if (!root) return;
root.querySelectorAll('.fc-admin-only, .file-card-del, .file-card-type-toggle, .fremove, .fc-actions').forEach(function (n) {
if (n.parentNode) n.parentNode.removeChild(n);
});
root.querySelectorAll('.file-folder-item.oversize').forEach(function (row) {
if (!row.getAttribute('data-key') && row.parentNode) row.parentNode.removeChild(row);
});
var fileCards = root.querySelectorAll('.file-card-wrap[data-file-type="file"]');
fileCards.forEach(function (card) {
var a = card.querySelector('a[data-dl]');
if (!a) return;
});
function fcBindRow(row) {
var key = row.getAttribute('data-key');
if (!key) return;
var __existingDl = row.querySelector('.fc-dl');
var __existingSize = row.querySelector('.fsize');
if (!row.querySelector('.fc-row-meta')) {
var meta = document.createElement('span');
meta.className = 'fc-row-meta';
if (__existingSize) meta.appendChild(__existingSize);
if (!__existingDl) {
var dl = document.createElement('button');
dl.type = 'button'; dl.className = 'fc-dl'; dl.textContent = '下载';
dl.addEventListener('click', function (e) { e.stopPropagation(); triggerDownload('/files/' + key); });
meta.appendChild(dl);
} else {
meta.appendChild(__existingDl);
}
row.appendChild(meta);
}
}
function fcBindList(list) {
Array.prototype.forEach.call(list.children, function (child) {
if (!child.classList || !child.classList.contains('file-folder-item')) return;
if (child.classList.contains('is-folder')) {
var head = child.querySelector(':scope > .fc-row-head');
var kids = child.querySelector(':scope > .file-folder-list');
if (head && kids) {
if (!head.querySelector('.fc-arrow')) {
var ar = document.createElement('button');
ar.type = 'button'; ar.className = 'fc-arrow'; ar.title = '展开/收起';
ar.setAttribute('aria-label', '展开或收起此文件夹');
ar.innerHTML = '<svg class="fc-arrow-svg toggle-arrow" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>';
ar.addEventListener('click', function (e) {
e.stopPropagation();
var show = kids.style.display === 'none';
kids.style.display = show ? 'block' : 'none';
ar.querySelector('.fc-arrow-svg').style.transform = show ? 'rotate(0deg)' : 'rotate(-90deg)';
});
head.appendChild(ar);
}
head.style.cursor = 'pointer';
head.addEventListener('click', function (e) {
if (e.target.closest('button, a, input')) return;
var show = kids.style.display === 'none';
kids.style.display = show ? 'block' : 'none';
var arr = head.querySelector('.fc-arrow-svg');
if (arr) arr.style.transform = show ? 'rotate(0deg)' : 'rotate(-90deg)';
});
}
if (kids) fcBindList(kids);
return;
}
fcBindRow(child);
});
}
var folderCards = root.querySelectorAll('.file-card-wrap[data-file-type="folder"]');
folderCards.forEach(function (card) {
var list = card.querySelector('[data-folder-list]');
var header = card.querySelector('.file-card-header');
if (list) {
if (list.style.display !== 'block') list.style.display = 'none';
if (header) {
var __fcArrowHolder = header.querySelector('.fc-arrow, .fc-arrow-static');
if (__fcArrowHolder && !__fcArrowHolder.querySelector('svg')) {
__fcArrowHolder.innerHTML = '<svg class="fc-arrow-svg toggle-arrow" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>';
}
var __fcArrow = header.querySelector('.fc-arrow-svg, .toggle-arrow, svg');
if (__fcArrow) __fcArrow.style.transform = 'rotate(-90deg)';
header.style.cursor = 'pointer';
header.addEventListener('click', function (e) {
if (e.target.closest('button, a, input')) return;
var show = list.style.display === 'none';
list.style.display = show ? 'block' : 'none';
var arrow = header.querySelector('.fc-arrow-svg, .toggle-arrow, svg');
if (arrow) arrow.style.transform = show ? 'rotate(0deg)' : 'rotate(-90deg)';
});
}
fcBindList(list);
if (header && !header.querySelector('.fc-head-meta')) {
var __fcKeys = function () {
var ks = [];
list.querySelectorAll('.file-folder-item:not(.is-folder)').forEach(function (row) {
var k = row.getAttribute('data-key');
if (k) ks.push(k);
});
return ks;
};
var __fcTotal = 0;
list.querySelectorAll('.file-folder-item:not(.is-folder)[data-size]').forEach(function (row) {
var n = Number(row.getAttribute('data-size')); if (n > 0) __fcTotal += n;
});
var __fmtSize = function (n) { if (!(n > 0)) return ''; if (n >= 1073741824) return (n / 1073741824).toFixed(1) + 'GB'; if (n >= 1048576) return (n / 1048576).toFixed(1) + 'MB'; if (n >= 1024) return Math.round(n / 1024) + 'KB'; return n + 'B'; };
var meta = document.createElement('span'); meta.className = 'fc-head-meta';
if (__fcTotal > 0) { var sz = document.createElement('span'); sz.className = 'fsize'; sz.textContent = __fmtSize(__fcTotal); meta.appendChild(sz); }
var dlAll = document.createElement('button'); dlAll.type = 'button'; dlAll.className = 'fc-dl'; dlAll.textContent = '下载';
dlAll.title = '下载本文件夹全部文件';
dlAll.addEventListener('click', function (e) {
e.stopPropagation();
var ks = __fcKeys();
ks.forEach(function (key, idx) { setTimeout(function () { triggerDownload('/files/' + key); }, idx * 300); });
});
meta.appendChild(dlAll);
var __arrowHolder = header.querySelector('.fc-arrow');
if (__arrowHolder) header.insertBefore(meta, __arrowHolder); else header.appendChild(meta);
}
} else {
if (!card.querySelector('.file-folder-open')) {
var linkA = card.querySelector('a[data-dl]');
var url = linkA ? linkA.getAttribute('href') : '';
if (url) {
var openWrap = document.createElement('div');
openWrap.className = 'file-folder-open';
var openBtn = document.createElement('a');
openBtn.href = url;
openBtn.target = '_blank';
openBtn.rel = 'noopener noreferrer';
openBtn.textContent = '打开';
openWrap.appendChild(openBtn);
card.appendChild(openWrap);
}
}
}
});
}
function triggerDownload(url) {
var a = document.createElement('a');
a.href = url;
a.download = '';
a.style.display = 'none';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
}
function makeVideoFallback(href) {
var u = href && String(href).trim();
if (!u) return null;
var vf = document.createElement('div');
vf.className = 'video-fallback';
vf.setAttribute('contenteditable', 'false');
var vl = document.createElement('a');
vl.className = 'vf-link';
vl.href = u;
vl.target = '_blank';
vl.rel = 'noopener';
vl.textContent = '点击在新窗口播放视频';
vf.appendChild(vl);
return vf;
}
var thumbOf = function (url) { return window.__thumbOf(url); };
function loadImg(img, src, fallbackSrc) {
img.dataset.lf = '1';
if (!src) {
try { img.onerror = null; img.onload = null; } catch (e0) { if (window.__silent) window.__silent(e0); }
img.src = window.WN_MEDIA_FALLBACK;
if (img.classList) { img.classList.add('media-fail'); img.classList.remove('m-loading', 'img-in'); }
img.style.display = 'block'; img.style.opacity = '1';
return;
}
if (img.getAttribute('src') === src && img.src && img.complete) { img.style.display = 'block'; img.style.opacity = '1'; return; }
img.decoding = 'async'; img.loading = 'lazy';
img.onerror = function () {
if (fallbackSrc && this.getAttribute('src') !== fallbackSrc) { this.src = fallbackSrc; return; }
this.onerror = null;
this.src = window.WN_MEDIA_FALLBACK; if (this && this.classList) { this.classList.add('media-fail'); this.classList.remove('m-loading'); } this.style.opacity = '1';
this.style.display = 'block';
};
img.onload = function () { this.style.display = 'block'; this.style.opacity = '1'; if (this.classList) this.classList.remove('m-loading'); if (!window.__swipeCommitting && !window.__fastNav) this.classList.add('img-in'); };
if (img.classList && img.classList.contains('modal-cover')) img.classList.add('m-loading');
img.style.opacity = '0'; img.src = src || window.WN_MEDIA_FALLBACK;
if (!src) { img.src = window.WN_MEDIA_FALLBACK; if (img && img.classList) { img.classList.add('media-fail'); img.classList.remove('m-loading'); } img.style.display = 'block'; img.style.opacity = '1'; }
}
function sanitizeHTML(html) { return window.__sanitizeHTML ? window.__sanitizeHTML(html) : ""; }
function track(pid, type) {
if (window.__pvMode) return;
if (!usingRemote || !pid) return;
try {
fetch('/api/track', {
method: 'POST',
credentials: 'include',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ product_id: pid, type: type })
});
} catch (e) { }
}
(function () {
window.__ogDynamic = function (p) {
try {
if (!p) return;
var set = function (sel, val) { var m = document.querySelector(sel); if (m && val) m.setAttribute('content', val); };
set('meta[property="og:title"]', (p.title || '') + ' · 万能资源圈');
set('meta[name="description"]', p.desc || '');
set('meta[property="og:description"]', p.desc || '');
var cover = p.img || (p.coverImages && p.coverImages[0]) || '';
if (cover) { set('meta[property="og:image"]', cover); set('meta[name="twitter:image"]', cover); }
} catch (e0) { if (window.__silent) window.__silent(e0); }
};
var ob = document.createElement('div');
ob.className = 'offline-banner';
ob.textContent = '当前离线，正在显示缓存内容';
ob.style.cssText = 'display:none;position:sticky;top:0;z-index:120;background:#c62828;color:#fff;text-align:center;font-size:12px;padding:5px 8px;';
document.body.insertBefore(ob, document.body.firstChild);
var syncNet = function () { ob.style.display = navigator.onLine ? 'none' : 'block'; };
window.addEventListener('online', syncNet); window.addEventListener('offline', syncNet); syncNet();
var __a2dPrompt = null;
var __a2dShownThisVisit = false;
var __a2dQualified = false;
function a2dInstalled() {
try { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; } catch (e0) { return false; }
}
function tryA2D() {
if (!__a2dQualified || __a2dShownThisVisit || !__a2dPrompt || a2dInstalled() || document.getElementById('a2dToast')) return;
try { if (localStorage.getItem('wnzyq_a2d_ok') || localStorage.getItem('wnzyq_a2d_never')) return; } catch (eA) {}
__a2dShownThisVisit = true;
var t = document.createElement('div');
t.className = 'ui-toast'; t.id = 'a2dToast';
t.style.pointerEvents = 'auto';
t.style.cursor = 'pointer';
t.style.gap = '10px';
var main = document.createElement('span');
main.textContent = '添加到桌面-点击可直达';
var never = document.createElement('span');
never.textContent = '不再提示';
never.style.cssText = 'color:var(--text-light);font-size: 12px;text-decoration:underline;flex:none';
t.appendChild(main); t.appendChild(never);
t.setAttribute('role', 'button'); t.setAttribute('tabindex', '0');
var gone = false;
var dismiss = function () {
if (gone) return; gone = true;
try { t.classList.add('leaving'); } catch (e1) {}
setTimeout(function () { try { t.parentNode.removeChild(t); } catch (e2) {} }, 300);
};
var go = function () {
dismiss();
try { __a2dPrompt.prompt(); } catch (e3) { if (window.__silent) window.__silent(e3); }
__a2dPrompt = null;
};
var neverFn = function (e) {
if (e) { e.stopPropagation(); e.preventDefault(); }
try { localStorage.setItem('wnzyq_a2d_never', '1'); } catch (e7) {}
dismiss();
};
main.addEventListener('click', go);
t.addEventListener('click', function (e) { if (e.target === t) go(); });
never.addEventListener('click', neverFn);
t.addEventListener('keydown', function (e4) { if (e4.key === 'Enter' || e4.key === ' ') { e4.preventDefault(); go(); } });
document.body.appendChild(t);
if (window.__haptic) window.__haptic();
setTimeout(dismiss, 6000);
}
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); __a2dPrompt = e; tryA2D(); });
window.addEventListener('appinstalled', function () { __a2dPrompt = null; try { localStorage.setItem('wnzyq_a2d_ok', '1'); } catch (e5) {} });
(function a2dVisit() {
try {
if (a2dInstalled()) return;
try { if (localStorage.getItem('wnzyq_a2d_never')) return; } catch (eN) {}
if (localStorage.getItem('wnzyq_a2d_ok') && !a2dInstalled()) localStorage.removeItem('wnzyq_a2d_ok');
if (localStorage.getItem('wnzyq_a2d_ok')) return;
var v = parseInt(localStorage.getItem('wnzyq_visits') || '0', 10) || 0;
v += 1;
localStorage.setItem('wnzyq_visits', String(v));
if (v % 10 !== 0) return;
__a2dQualified = true;
tryA2D();
} catch (e6) { if (window.__silent) window.__silent(e6); }
})();
})();
function renderShopInfo() {
var cfg = (typeof SHOP_CONFIG !== 'undefined') ? SHOP_CONFIG : null;
var name = DATA.shopName || (cfg && cfg.shopName) || '';
var isDefault = !name || name === '万能资源圈';
shopNameEl.textContent = isDefault ? '万能资源圈・资源' : name;
document.title = (isDefault ? '万能资源圈' : name) + '・资源';
}
function closeAnnModal() {
var m = document.getElementById('annModal'); if (m) m.classList.remove('open');
if (window.setBodyLock) setBodyLock(false);
window.__annShown = false; window.__annDismissed = true;
var _annSkel = document.getElementById('annSkeleton'); if (_annSkel) _annSkel.style.display = '';
try { document.querySelectorAll('#annModal video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
}
window.openAnnModal = function () {
var m = document.getElementById('annModal'); if (!m) return;
try {
m.classList.add('open');
if (window.setBodyLock) setBodyLock(true);
window.__annShown = true;
renderAnnContent();
showAnnDefault();
if (window.__annMarkActiveRead) window.__annMarkActiveRead();
} catch (e) { if (window.__silent) window.__silent(e); }
if (window.__haptic) window.__haptic();
};
function showAnnDefault() {
try { var _amOpen = (document.getElementById('annModal') || {}).classList && document.getElementById('annModal').classList.contains('open'); var _def = (DATA.announcements || []).find(function (x) { return x.level === 1; }) || (DATA.announcements || [])[0]; if (_amOpen && _def && window.__annMarkRead) window.__annMarkRead(_def.id); } catch (e0) { if (window.__silent) window.__silent(e0); }
var l = DATA.announcements || [];
var d = l.find(function (x) { return x.level === 1; }) || l[0];
if (!d) return;
try { var _tt = document.getElementById('annTitleTab'); if (_tt) { _tt.dataset.annId = String(d.id); if (window.__annUnread) window.__annUnread(); } } catch (e0) { if (window.__silent) window.__silent(e0); }
var bd = document.getElementById('annBody');
if (bd) { var _c3 = sanitizeHTML(d.content || ''); bd.innerHTML = _c3 || '<div class="ann-empty"><div class="ann-empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" aria-hidden="true"><path d="M12 2 3 6.8v10.4L12 22l9-4.8V6.8L12 2zm7.5 5.3L12 10.9 4.5 7.3 12 3.3l7.5 4zM5 9l6.2 3.3v8.1L5 17.1V9zm8.8 11.4v-8.1L20 9v8.1l-6.2 3.3z"/></svg></div><div class="ann-empty-title">该公告暂无内容</div></div>'; bindMediaFail(bd); bindLightbox(bd);
bindQuoteCopyButtons(bd); bindFileCards(bd); }
var tt = document.getElementById('annTitleTab'); if (tt) tt.classList.add('active');
document.querySelectorAll('#annTabs .ann-tab').forEach(function (x) { x.classList.remove('active'); });
}
function renderAnnContent() {
clearTimeout(window.__annSkelT);
var _annSkel = document.getElementById('annSkeleton'); if (_annSkel) _annSkel.style.display = 'none';
var list = DATA.announcements || [];
var _annReal = list.filter(__annHasContent);
if (_annReal.length) list = _annReal;
if (!list.some(function (x) { return x.level === 1; })) {
var _defA = { id: 'def', title: '公告', content: DATA.announcement || '', hidden: 0, sort: 0, level: 1 };
if (__annHasContent(_defA)) list = [_defA].concat(list);
}
var tabs = document.getElementById('annTabs');
if (tabs) {
tabs.innerHTML = '';
var subs = list.filter(function (x) { return x.level !== 1; }); if (subs.length) {
subs.forEach(function (a, i) {
var t = document.createElement('button');
t.type = 'button';
t.className = 'ann-tab';
t.setAttribute('data-noico', '1');
t.textContent = a.title || '公告';
t.dataset.annId = String(a.id);
var _ad = document.createElement('i'); _ad.className = 'dot-badge'; _ad.hidden = true; t.appendChild(_ad);
t.addEventListener('click', function () { try {
if (window.__annMarkRead) window.__annMarkRead(a.id);
if (__annTransitioning) return;
__annTransitioning = true;
var ts = document.querySelectorAll('#annTabs .ann-tab');
ts.forEach(function (x) { x.classList.remove('active'); }); var tt = document.getElementById('annTitleTab'); if (tt) tt.classList.remove('active');
t.classList.add('active');
var bd = document.getElementById('annBody');
if (bd) {
bd.classList.add('ann-body-fade-out');
setTimeout(function () {
var _c2 = sanitizeHTML(a.content || ''); bd.innerHTML = _c2 || '<div class="ann-empty"><div class="ann-empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" aria-hidden="true"><path d="M12 2 3 6.8v10.4L12 22l9-4.8V6.8L12 2zm7.5 5.3L12 10.9 4.5 7.3 12 3.3l7.5 4zM5 9l6.2 3.3v8.1L5 17.1V9zm8.8 11.4v-8.1L20 9v8.1l-6.2 3.3z"/></svg></div><div class="ann-empty-title">该公告暂无内容</div></div>'; bindMediaFail(bd); bindLightbox(bd);
bindQuoteCopyButtons(bd); bindFileCards(bd);
bd.classList.remove('ann-body-fade-out');
__annTransitioning = false;
}, 100);
} else { __annTransitioning = false; }
} catch (e) { __annTransitioning = false; }
});
tabs.appendChild(t);
});
}
}
var body = document.getElementById('annBody');
var defAnn = list.find(function (x) { return x.level === 1; }) || list[0]; var tt = document.getElementById('annTitleTab');
if (tt && defAnn) { tt.dataset.annId = String(defAnn.id); if (window.__annUnread) window.__annUnread(); }
if (tt) tt.classList.add('active'); if (body) { var _c = sanitizeHTML((defAnn && defAnn.content) || ''); body.innerHTML = _c || '<div class="ann-empty"><div class="ann-empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" aria-hidden="true"><path d="M12 2 3 6.8v10.4L12 22l9-4.8V6.8L12 2zm7.5 5.3L12 10.9 4.5 7.3 12 3.3l7.5 4zM5 9l6.2 3.3v8.1L5 17.1V9zm8.8 11.4v-8.1L20 9v8.1l-6.2 3.3z"/></svg></div><div class="ann-empty-title">该公告暂无内容</div></div>'; bindMediaFail(body); bindLightbox(body);
bindQuoteCopyButtons(body); bindFileCards(body); }
}
function __annHasContent(a) {
if (!a || a.hidden) return false;
var html = String(a.content || '');
var text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, '');
if (text) return true;
var srcs = html.match(/src\s*=\s*["']([^"']*)["']/gi) || [];
for (var i = 0; i < srcs.length; i++) {
if (!/data:image\/svg\+xml/i.test(srcs[i])) return true;
}
return false;
}
function renderAnnouncement() {
try { var mask = document.getElementById('annModal');
if (!mask) return;
if (window.__annReady && mask.classList.contains('open')) return;
var _annSkel = document.getElementById('annSkeleton');
if (!(DATA.announcements || []).length && !String(DATA.announcement || '').trim()) {
if (window.__skelPhase) {
if (_annSkel) _annSkel.style.display = 'none';
mask.classList.remove('open');
return;
}
mask.classList.remove('open');
if (_annSkel) _annSkel.style.display = 'none';
return;
}
if (_annSkel) _annSkel.style.display = 'none';
window.__annReady = true;
var mode = DATA.announcementMode || 'always';
if (window.__pvMode) { if (!window.__annPvShown) mask.classList.remove('open'); if (_annSkel) _annSkel.style.display = 'none'; return; }
if (mode === 'off') { mask.classList.remove('open'); if (_annSkel) _annSkel.style.display = 'none'; return; }
var _annAll = DATA.announcements || [];
if (!_annAll.some(function (x) { return x.level === 1; })) {
var _defB = { id: 'def', title: '公告', content: DATA.announcement || '', hidden: 0, sort: 0, level: 1 };
if (__annHasContent(_defB)) _annAll = [_defB].concat(_annAll);
}
_annAll = _annAll.filter(__annHasContent);
if (!_annAll.length) { mask.classList.remove('open'); if (_annSkel) _annSkel.style.display = 'none'; return; }
if (window.__annSilent) { window.__annSilent = false; return; } if (window.__annDismissed) return; if (window.__annShown || mask.classList.contains('open')) { if (mode === 'session') { try { if (!sessionStorage.getItem('wnzyq_ann_session')) sessionStorage.setItem('wnzyq_ann_session', '1'); } catch (e) { if (window.__silent) window.__silent(e); } } else if (mode === 'daily') { try { var _td = new Date().toDateString(); if (localStorage.getItem('wnzyq_ann_date') !== _td) localStorage.setItem('wnzyq_ann_date', _td); } catch (e) { if (window.__silent) window.__silent(e); } }
if (mask.classList.contains('open')) renderAnnContent();
return; }
var list = _annAll;
if (!list.length || mode === 'off') { mask.classList.remove('open'); return; }
if (mode === 'daily') {
try {
var today = new Date().toDateString();
if (localStorage.getItem('wnzyq_ann_date') === today) return;
localStorage.setItem('wnzyq_ann_date', today);
} catch (e) { if (window.__silent) window.__silent(e); }
} else if (mode === 'session') {
try {
if (sessionStorage.getItem('wnzyq_ann_session')) return;
sessionStorage.setItem('wnzyq_ann_session', '1');
} catch (e) { if (window.__silent) window.__silent(e); }
}
window.__annShown = true;
mask.classList.add('open');
setBodyLock(true);
try {
renderAnnContent();
if (window.__annMarkActiveRead) window.__annMarkActiveRead();
} catch (e0) { if (window.__silent) window.__silent(e0); }
} catch (e) { if (window.__silent) window.__silent(e); }
}
function __announceList(name) {
setTimeout(function () {
try {
var n = document.querySelectorAll('.product-card[data-pid]').length;
if (window.__srSay) window.__srSay((name || '') + '，' + n + ' 个资源');
} catch (e0) { if (window.__silent) window.__silent(e0); }
}, 700);
}
function renderCategories() {
var cats = DATA.categories.slice();
if (!cats.length && !window.__shopEntryDone && !window.__loadFailed && window.location.protocol !== 'file:') return;
if (!cats.find(function (c) { return Number(c.id) === 0; })) {
cats.unshift({ id: 0, name: '全部', parent_id: 0 });
}
var topCats = cats.filter(function (c) { return !c.parent_id || Number(c.parent_id) === 0; });
categoryBar.innerHTML = '';
topCats.forEach(function (c) {
var tag = document.createElement('div');
tag.className = 'category-tag' + (c.id === currentCat ? ' active' : '');
tag.textContent = c.name;
tag.setAttribute('role', 'button');
tag.tabIndex = 0;
tag.setAttribute('aria-pressed', c.id === currentCat ? 'true' : 'false');
tag.addEventListener('click', function () {
currentCat = c.id;
currentSubCat = 0;
currentPage = 1;
try { if (c.id) localStorage.setItem('wnzyq_shop_category', String(c.id)); else localStorage.removeItem('wnzyq_shop_category'); } catch (e) { if (window.__silent) window.__silent(e); }
renderCategories();
__announceList(c.name);
__fadeRenderProducts();
});
categoryBar.appendChild(tag);
});
var act = categoryBar.querySelector('.category-tag.active');
if (act) {
try {
if (act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
} catch (e0) { if (window.__silent) window.__silent(e0); }
}
renderSubCategories();
setTimeout(function () {
catIsOverflow = categoryBar.scrollWidth > categoryBar.clientWidth + 5; if (!catIsOverflow) { catExpanded = false; categoryBar.classList.remove('expanded'); catToggle.classList.remove('open'); var ar = catToggle.querySelector('.toggle-arrow'); if (ar) ar.style.transform = 'rotate(-90deg)'; if (window.__fsCatLineUpdate) window.__fsCatLineUpdate(false); return; }
if (catExpanded) {
categoryBar.classList.add('expanded');
catToggle.classList.add('open');
var arrow = catToggle.querySelector('.toggle-arrow');
if (arrow) arrow.style.transform = 'rotate(0deg)';
} else {
categoryBar.classList.remove('expanded');
catToggle.classList.remove('open');
var arrow2 = catToggle.querySelector('.toggle-arrow');
if (arrow2) arrow2.style.transform = 'rotate(-90deg)';
}
if (window.__fsCatLineUpdate) window.__fsCatLineUpdate(false);
try {
var actNow = categoryBar.querySelector('.category-tag.active');
if (actNow) {
var isExp = categoryBar.classList.contains('expanded');
actNow.scrollIntoView({ block: 'nearest', inline: isExp ? 'nearest' : 'center', behavior: 'smooth' });
}
} catch (eAct) { if (window.__silent) window.__silent(eAct); }
}, 50);
}
function renderSubCategories() {
var subWrap = document.getElementById('subCatWrap');
var subBar = document.getElementById('subCategoryBar');
if (!subWrap || !subBar) return;
if (currentCat === 0) {
subWrap.style.display = 'none';
return;
}
var subCats = DATA.categories.filter(function (c) { return Number(c.parent_id) === currentCat; });
if (subCats.length === 0) {
subWrap.style.display = 'none';
return;
}
subWrap.style.display = 'block';
subBar.innerHTML = '';
var allTag = document.createElement('div');
allTag.className = 'sub-category-tag' + (currentSubCat === 0 ? ' active' : '');
allTag.textContent = '全部';
allTag.setAttribute('role', 'button');
allTag.tabIndex = 0;
allTag.setAttribute('aria-pressed', currentSubCat === 0 ? 'true' : 'false');
allTag.addEventListener('click', function () {
currentSubCat = 0;
currentPage = 1;
renderSubCategories();
__announceList('全部');
__fadeRenderProducts();
});
subBar.appendChild(allTag);
subCats.forEach(function (c) {
var tag = document.createElement('div');
tag.className = 'sub-category-tag' + (c.id === currentSubCat ? ' active' : '');
tag.textContent = c.name;
tag.setAttribute('role', 'button');
tag.tabIndex = 0;
tag.setAttribute('aria-pressed', c.id === currentSubCat ? 'true' : 'false');
tag.addEventListener('click', function () {
currentSubCat = c.id;
currentPage = 1;
renderSubCategories();
__announceList(c.name);
__fadeRenderProducts();
});
subBar.appendChild(tag);
});
subBar.classList.remove('re-in'); void subBar.offsetWidth; subBar.classList.add('re-in');
setTimeout(function () {
subCatIsOverflow = subBar.scrollWidth > subBar.clientWidth + 5;
if (subCatExpanded) {
subBar.classList.add('expanded');
if (subCatToggle) {
subCatToggle.classList.add('open');
var arrow = subCatToggle.querySelector('.toggle-arrow');
if (arrow) arrow.style.transform = 'rotate(0deg)';
}
} else {
subBar.classList.remove('expanded');
if (subCatToggle) {
subCatToggle.classList.remove('open');
var arrow2 = subCatToggle.querySelector('.toggle-arrow');
if (arrow2) arrow2.style.transform = 'rotate(-90deg)';
}
}
try {
var sAct = subBar.querySelector('.sub-category-tag.active');
if (sAct) {
var sExp = subBar.classList.contains('expanded');
sAct.scrollIntoView({ block: 'nearest', inline: sExp ? 'nearest' : 'center', behavior: 'smooth' });
}
} catch (eSAct) { if (window.__silent) window.__silent(eSAct); }
}, 50);
}
function __productKeyEqual(a, b) {
if (!a || !b) return false;
if (a.id !== b.id) return false;
return a.title === b.title && a.desc === b.desc && a.img === b.img &&
a.price === b.price && a.is_online === b.is_online &&
a.is_hidden === b.is_hidden && a.cid === b.cid && a.sort === b.sort;
}
function getFilteredProducts() {
if (DATA._backendPaged) return DATA.products;
var kw = searchInput.value.trim().toLowerCase();
var subCatIds = DATA.categories
.filter(function (c) { return Number(c.parent_id) === currentCat; })
.map(function (c) { return Number(c.id); });
return DATA.products.filter(function (p) {
if (p.is_online !== true && p.is_online !== 1) return false;
if (p.is_hidden === true || p.is_hidden === 1) return false;
if (currentCat !== 0) {
if (currentSubCat !== 0) {
if (Number(p.cid) !== currentSubCat) return false;
} else {
var cid = Number(p.cid);
if (cid !== currentCat && subCatIds.indexOf(cid) === -1) return false;
}
}
if (kw) {
var hit = String(p.title || '').toLowerCase().indexOf(kw) !== -1
|| String(p.desc || '').toLowerCase().indexOf(kw) !== -1;
if (!hit) {
var t = String(p.title || '');
hit = __smartMatch(kw, t);
if (!hit) hit = __smartMatch(kw, String(p.desc || '').slice(0, 60));
}
if (!hit) return false;
}
return true;
});
}
var __PY_ANCHORS = '阿八嚓搭蛾发噶哈击喀垃呣拿哦啪期然撒塌挖希压匝';
var __pyCache = {};
function __pyInitial(ch) {
if (!/[\u4e00-\u9fa5]/.test(ch)) return ch.toLowerCase();
if (__pyCache[ch]) return __pyCache[ch];
var lo = 0, hi = __PY_ANCHORS.length - 1, r = 'z';
while (lo <= hi) {
var mid = (lo + hi) >> 1;
if (ch.localeCompare(__PY_ANCHORS[mid], 'zh-CN') >= 0) { r = __PY_INITIALS[mid]; lo = mid + 1; }
else { hi = mid - 1; }
}
__pyCache[ch] = r;
return r;
}
var __PY_INITIALS = 'abcdefghjklmnopqrstwxyz';
function __titleInitials(t) {
var out = '';
for (var i = 0; i < t.length && out.length < 24; i++) out += __pyInitial(t[i]);
return out;
}
function __fuzzy(kw, text) {
var i = 0;
for (var j = 0; j < text.length && i < kw.length; j++) { if (text[j] === kw[i]) i++; }
return i >= kw.length;
}
function __smartMatch(kw, text) {
if (!text) return false;
var ini = __titleInitials(text);
if (ini.indexOf(kw) !== -1) return true;
if (text.toLowerCase().indexOf(kw) !== -1) return true;
if (kw.length >= 2 && __fuzzy(kw, ini)) return true;
return false;
}
var currentPage = 1;
var __uniPager = null;
var __pageTurning = false;
var __variantTransitioning = false;
var __annTransitioning = false;
var PAGE_SIZE = 20;
var __pendingSearchOpts = null;
function __flushPendingSearch() {
if (!__pendingSearchOpts) return;
var _opts = __pendingSearchOpts;
__pendingSearchOpts = null;
if (_opts.page) __turnToPage(_opts.page);
else __fadeRenderProducts(_opts.cb);
}
function __turnToPage(p) {
if (p === currentPage || __pageTurning) {
if (__pageTurning && p !== currentPage) __pendingSearchOpts = { page: p };
return;
}
__pageTurning = true;
currentPage = p;
if (usingRemote && DATA._backendPaged) {
fetchRemote({ page: p }).then(function (res) {
if (res && res.stale) { __pageTurning = false; return; }
renderProducts();
__pageTurning = false;
try { window.scrollTo({ top: 0, behavior: 'auto' }) ; } catch (e) { try { window.scrollTo(0, 0); } catch (e2) { if (window.__silent) window.__silent(e2); } }
__flushPendingSearch();
}).catch(function () {
renderProducts();
setTimeout(function () { window.__fastNav = false; }, 800);
__pageTurning = false;
try { window.scrollTo({ top: 0, behavior: 'auto' }) ; } catch (e) { try { window.scrollTo(0, 0); } catch (e2) { if (window.__silent) window.__silent(e2); } }
__flushPendingSearch();
});
} else {
renderProducts();
setTimeout(function () { window.__fastNav = false; }, 800);
__pageTurning = false;
try { window.scrollTo({ top: 0, behavior: 'auto' }) ; } catch (e) { try { window.scrollTo(0, 0); } catch (e2) { if (window.__silent) window.__silent(e2); } }
__flushPendingSearch();
}
}
function __fadeRenderProducts(cb) {
if (__pageTurning) {
__pendingSearchOpts = { cb: cb };
return;
}
__pageTurning = true;
if (cb) cb();
var _hit = false;
try {
var _k0 = __cacheKey(currentPage, currentCat, currentSubCat, (searchInput.value || '').trim());
_hit = !!(__pageCache[_k0] && __pageCache[_k0].products);
} catch (e0) { if (window.__silent) window.__silent(e0); }
window.__fastNav = _hit;
if (usingRemote && DATA._backendPaged) {
var _grid = document.getElementById('productGrid');
var _oldPager = document.getElementById('pager');
if (_grid && !_hit) _grid.classList.add('is-switching');
if (_oldPager && !_hit) _oldPager.classList.add('is-switching');
var _clearSwitch = function () {
if (_grid) _grid.classList.remove('is-switching');
if (_oldPager) _oldPager.classList.remove('is-switching');
};
fetchRemote({
page: currentPage,
cid: currentCat,
subCid: currentSubCat,
kw: (searchInput.value || '').trim()
}).then(function (res) {
_clearSwitch();
setTimeout(function () { window.__fastNav = false; }, 800);
if (!(res && res.stale)) renderProducts();
var _pg = document.getElementById('productGrid');
if (_pg && window.__barDir) { _pg.classList.remove('swap-next', 'swap-prev'); void _pg.offsetWidth; _pg.classList.add(window.__barDir < 0 ? 'swap-prev' : 'swap-next'); setTimeout(function () { _pg.classList.remove('swap-next', 'swap-prev'); }, 300); window.__barDir = 0; }
__pageTurning = false;
__flushPendingSearch();
}).catch(function () {
_clearSwitch();
renderProducts();
__pageTurning = false;
__flushPendingSearch();
});
} else {
renderProducts();
__pageTurning = false;
__flushPendingSearch();
}
}
function hlTitle(text, kw) {
var s = String(text || '');
if (!kw) return s;
var esc = window.escapeHtml || function (x) { return String(x); };
var lower = s.toLowerCase(), k = kw.toLowerCase(), out = '', i = 0, hit;
if (!k) return s;
while ((hit = lower.indexOf(k, i)) !== -1) {
out += esc(s.slice(i, hit)) + '<mark class="hl">' + esc(s.slice(hit, hit + k.length)) + '</mark>';
i = hit + k.length;
}
return out + esc(s.slice(i));
}
function buildProductCard(p) {
var card = document.createElement('div');
card.className = 'product-card'; card.setAttribute('role', 'button'); card.tabIndex = 0;
card.setAttribute('aria-label', String(p.title || '').trim() + '，' + Number(p.price || 0) + ' 元');
card.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openModal(p); } });
card.setAttribute('data-pid', p.id || 0);
var img = document.createElement('img');
img.className = 'card-img';
img.decoding = 'async'; img.loading = 'lazy';
img.alt = p.title || '';
var __thumb = thumbOf(p.img), __orig = p.img || '';
if (!__orig) {
img.src = window.WN_MEDIA_FALLBACK;
img.classList.add('media-fail');
} else {
loadImg(img, __thumb, __orig);
}
if (__thumb && __orig && __thumb !== __orig && (window.devicePixelRatio || 1) > 1.2) { img.srcset = __thumb + ' 1x, ' + __orig + ' 2x'; img.sizes = '(max-width:600px) 50vw, (max-width:900px) 33vw, 20vw'; }
var body = document.createElement('div');
body.className = 'card-body';
var title = document.createElement('div');
title.className = 'card-title';
var __kw = (searchInput && searchInput.value || '').trim();
if (__kw) title.innerHTML = hlTitle(p.title || '', __kw);
else title.textContent = p.title || '';
title.title = p.title || '';
var desc = document.createElement('div');
desc.className = 'card-desc';
desc.textContent = p.desc || '';
body.appendChild(title);
body.appendChild(desc);
var _meta = document.createElement('div');
_meta.className = 'card-meta';
var _vN = (p.variants || []).length;
var _cName = '';
try { (DATA.categories || []).forEach(function (c) { if (Number(c.id) === Number(p.cid)) _cName = c.name || ''; }); } catch (eC) {}
var _metaParts = [];
if (_vN > 0) _metaParts.push(_vN + ' 个类型');
if (_cName) _metaParts.push(_cName);
_meta.textContent = _metaParts.join(' · ');
body.appendChild(_meta);
var _pr = Number(p.price || 0);
if (_pr > 0) {
var prow = document.createElement('div');
prow.className = 'card-price-row';
var pEl = document.createElement('span');
pEl.className = 'card-price';
pEl.textContent = window.formatPrice ? window.formatPrice(_pr) : ('¥' + (String(_pr).indexOf('.') !== -1 ? _pr.toFixed(2) : _pr));
prow.appendChild(pEl);
body.appendChild(prow);
}
card.appendChild(img);
card.appendChild(body);
card.addEventListener('click', function () { if (Date.now() - (window.__ctxShownAt || 0) < 300) return; openModal(p); });
return card;
}
window.__buildProductCard = buildProductCard;
window.__shopEnsurePager = function () {
try {
if (window.__skelPhase || window.__loadFailed) return;
if ((DATA.totalPages || 1) > 1 && !document.getElementById('pager') && (getFilteredProducts() || []).length) renderProducts();
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.addEventListener('pageshow', function () { setTimeout(window.__shopEnsurePager, 250); });
document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(window.__shopEnsurePager, 250); });
setTimeout(function () {
try {
if (!window.__shopPainted && (DATA.products || []).length && !window.__skelPhase && !document.querySelector('#productGrid .product-card')) renderAll();
} catch (e) { if (window.__silent) window.__silent(e); }
}, 2500);
function renderProducts() {
var list = getFilteredProducts();
window.__visibleIds = list.map(function (p) { return p.id; });
if (window.__skelPhase && !list.length) { emptyTip.classList.remove('show'); return; }
emptyTip.classList.toggle('show', list.length === 0);
productGrid.classList.toggle('grid-empty', list.length === 0);
var oldPager = document.getElementById('pager');
if (oldPager) oldPager.parentNode.removeChild(oldPager);
__uniPager = null;
if (list.length === 0) {
productGrid.innerHTML = '';
var emptyTitle = document.getElementById('emptyTitle');
var kw = searchInput.value.trim();
emptyTip.querySelectorAll('.empty-clear-btn, .empty-desc').forEach(function (n) { n.parentNode.removeChild(n); });
if (window.__loadFailed && !kw) {
emptyTitle.textContent = '网络没连上，稍后再试';
var __retry = document.createElement('button');
__retry.type = 'button'; __retry.className = 'empty-clear-btn'; __retry.textContent = '重试';
__retry.addEventListener('click', function () {
window.__loadFailed = false;
window.__skelPhase = true;
renderSkeleton();
fetchRemote({ page: 1, cid: currentCat, subCid: currentSubCat, kw: '', force: true })
.then(function () { renderAll(); })
.catch(function () { window.__loadFailed = true; window.__skelPhase = false; productGrid.innerHTML = ''; renderAll(); });
});
emptyTip.appendChild(__retry);
return;
}
var _curCatName = '';
if (kw && Number(currentCat)) {
var _cc = (DATA.categories || []).filter(function (x) { return Number(x.id) === Number(currentCat); })[0];
_curCatName = _cc ? String(_cc.name || '') : '';
}
emptyTitle.textContent = kw
? (_curCatName ? '「' + _curCatName + '」里没有「' + kw + '」' : '该搜索暂无资源')
: '该分类暂无资源';
if (!kw) {
var __all = document.createElement('button');
__all.type = 'button'; __all.className = 'empty-clear-btn'; __all.textContent = '查看全部资源';
__all.addEventListener('click', function () {
currentCat = 0; currentSubCat = 0; currentPage = 1;
renderCategories(); fetchRemote({ page: 1, cid: 0, subCid: 0, kw: '' }).then(function(){ renderAll(); }).catch(function(){});
});
emptyTip.appendChild(__all);
}
if (kw) {
var __clr = document.createElement('button');
__clr.type = 'button'; __clr.className = 'empty-clear-btn'; __clr.textContent = '清除搜索';
__clr.addEventListener('click', function () {
searchInput.value = '';
searchClear.classList.remove('show');
currentPage = 1;
renderProducts();
});
emptyTip.appendChild(__clr);
if (_curCatName) {
var __allSearch = document.createElement('button');
__allSearch.type = 'button'; __allSearch.className = 'empty-clear-btn';
__allSearch.textContent = '在全部资源里搜';
__allSearch.addEventListener('click', function () {
var _kw = searchInput.value.trim();
currentCat = 0; currentSubCat = 0; currentPage = 1;
renderCategories();
fetchRemote({ page: 1, cid: 0, subCid: 0, kw: _kw }).then(function () { renderAll(); }).catch(function () {});
});
emptyTip.appendChild(__allSearch);
}
var __tip2 = document.createElement('div');
__tip2.className = 'empty-desc';
__tip2.textContent = _curCatName
? '搜索只在当前分类里进行。要么换个词，要么点上面的「在全部资源里搜」'
: '没找到？换个关键词，或浏览全部资源';
emptyTip.appendChild(__tip2);
}
return;
}
window.__loadFailed = false;
var totalPages = DATA._backendPaged ? (DATA.totalPages || 1) : Math.ceil(list.length / PAGE_SIZE);
if (currentPage > totalPages) currentPage = totalPages || 1;
var start = (currentPage - 1) * PAGE_SIZE;
var pageList = DATA._backendPaged ? list : list.slice(start, start + PAGE_SIZE);
var existingCards = productGrid.querySelectorAll('.product-card[data-pid]');
var canDiff = !window.__skelPhase && DATA._backendPaged && existingCards.length > 0 &&
productGrid.querySelectorAll('.card-skeleton').length === 0 && pageList.length > 0;
if (canDiff) {
var existing = {};
existingCards.forEach(function(c) { existing[c.dataset.pid] = c; });
var changed = false;
var frag = document.createDocumentFragment();
pageList.forEach(function(p, i) {
var card = existing[p.id];
if (card && __productKeyEqual(p, card.__pData)) {
delete existing[p.id];
frag.appendChild(card);
} else {
changed = true;
if (card) { card.remove(); delete existing[p.id]; }
card = buildProductCard(p);
if (!window.__swipeCommitting) {
card.classList.add('stagger-in');
card.style.animationDelay = Math.min(i * 20, 180) + 'ms';
}
frag.appendChild(card);
}
card.__pData = p;
});
for (var id in existing) { existing[id].remove(); changed = true; }
productGrid.appendChild(frag);
var oldPager = document.getElementById('pager');
if (oldPager) oldPager.parentNode.removeChild(oldPager);
__uniPager = null;
if (totalPages > 1) {
var pager = document.createElement('div');
pager.id = 'pager';
productGrid.parentNode.insertBefore(pager, productGrid.nextSibling);
if (window.buildUniPager) {
__uniPager = window.buildUniPager(pager, {
page: currentPage,
totalPages: totalPages,
total: DATA._backendPaged ? (DATA.total || 0) : list.length,
unit: '个',
onPage: __turnToPage
});
}
}
return;
}
var frag = document.createDocumentFragment();
pageList.forEach(function (p, i) {
var card = buildProductCard(p);
if (!window.__shopPainted && !window.__swipeCommitting && !window.__fastNav) {
card.classList.add('stagger-in');
card.style.animationDelay = Math.min(i * 20, 180) + 'ms';
}
frag.appendChild(card);
});
productGrid.replaceChildren(frag);
window.__shopPainted = true;
clearTimeout(window.__idlePfT);
window.__idlePfT = setTimeout(function () {
try {
[1, -1].forEach(function (d) {
var nb = window.__catSeqTarget && window.__catSeqTarget(d);
if (!nb || nb.type === 'all') return;
window.__peekCat(nb.type === 'top' ? nb.id : nb.parent, nb.type === 'sub' ? nb.id : 0).then(function (list) {
(list || []).slice(0, 6).forEach(function (p2) {
var src = p2 && (p2.img || (p2.coverImages && p2.coverImages[0]));
if (!src || src.indexOf('data:') === 0) return;
var im = new Image(); im.src = src;
});
});
});
} catch (e) { if (window.__silent) window.__silent(e); }
}, 500);
var pager = document.createElement('div');
pager.id = 'pager';
productGrid.parentNode.insertBefore(pager, productGrid.nextSibling);
if (window.buildUniPager) {
__uniPager = window.buildUniPager(pager, {
page: currentPage,
totalPages: totalPages,
total: DATA._backendPaged ? (DATA.total || 0) : list.length,
onPage: __turnToPage
});
} else if (totalPages > 1) {
var prev = document.createElement('button');
prev.textContent = '上一页';
prev.style.cssText = 'padding:8px 16px;border:1px solid var(--blue2);background:var(--card-bg,#fff);color:var(--blue1);border-radius:999px;cursor:pointer;font-size: 14px;';
window.__setPagerDisabled(prev, currentPage === 1);
prev.onclick = function () { if (currentPage > 1) { currentPage--; renderProducts(); window.scrollTo({top:0,behavior:'smooth'}); } };
pager.appendChild(prev);
var info = document.createElement('span');
info.textContent = currentPage + ' / ' + totalPages;
info.style.cssText = 'color:var(--text-light);font-size: 14px;';
pager.appendChild(info);
var next = document.createElement('button');
next.textContent = '下一页';
next.style.cssText = 'padding:8px 16px;border:1px solid var(--blue2);background:var(--card-bg,#fff);color:var(--blue1);border-radius:999px;cursor:pointer;font-size: 14px;';
window.__setPagerDisabled(next, currentPage === totalPages);
next.onclick = function () { if (currentPage < totalPages) { currentPage++; renderProducts(); window.scrollTo({top:0,behavior:'smooth'}); } };
pager.appendChild(next);
}
if (window.__btnFit) { window.__btnFit(); setTimeout(function () { try { window.__btnFit(); } catch (e) { if (window.__silent) window.__silent(e); } }, 130); }
try { __renderRecent(); } catch (e) { if (window.__silent) window.__silent(e); }
}
function renderCarousel(carouselEl, trackEl, dotsEl, fallbackImgEl, images) {
if (window.__renderCarousel) { window.__renderCarousel(carouselEl, trackEl, dotsEl, fallbackImgEl, images, window.WN_MEDIA_FALLBACK); }
}
function __pushRecent(id) {
try {
if (!id) return;
var arr = JSON.parse(localStorage.getItem('wnzyq_recent') || '[]');
arr = arr.filter(function (x) { return x !== id; });
arr.unshift(id);
localStorage.setItem('wnzyq_recent', JSON.stringify(arr));
} catch (e) { if (window.__silent) window.__silent(e); }
}
function __renderRecent() {
try {
var grid = document.getElementById('productGrid');
if (!grid || !grid.parentNode) return;
var ids = JSON.parse(localStorage.getItem('wnzyq_recent') || '[]');
var list = (DATA && DATA.products) || [];
var items = ids.map(function (id) { for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === id) return list[i]; } return null; }).filter(Boolean);
var oldWrap = document.getElementById('recentBarWrap');
var wasExpanded = false;
if (oldWrap) {
var ob = oldWrap.querySelector('.recent-bar');
wasExpanded = !!(ob && ob.classList.contains('expanded'));
if (oldWrap.parentNode) oldWrap.parentNode.removeChild(oldWrap);
}
if (!items.length) return;
var wrap = document.createElement('div'); wrap.id = 'recentBarWrap'; wrap.className = 'recent-bar-wrap';
var bar = document.createElement('div'); bar.id = 'recentBar'; bar.className = 'recent-bar';
var t = document.createElement('span'); t.className = 'recent-title'; t.textContent = '最近浏览'; bar.appendChild(t);
items.forEach(function (p) {
var b = document.createElement('button'); b.type = 'button'; b.className = 'recent-chip';
var _rt = String(p.title || p.name || '资源');
if (_rt.length > 8) {
var _cut = _rt.slice(0, 8);
if (/[【（(\[]$/.test(_cut)) _cut = _cut.slice(0, -1);
b.textContent = _cut + '…';
} else b.textContent = _rt;
b.title = p.title || '';
b.addEventListener('click', function () { openModal(p); });
bar.appendChild(b);
});
var tg = document.createElement('button'); tg.type = 'button'; tg.className = 'recent-toggle'; tg.id = 'recentToggle';
tg.title = '展开/收起'; tg.setAttribute('aria-label', '展开或收起最近浏览');
tg.innerHTML = '<svg aria-hidden="true" class="toggle-arrow" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>';
wrap.appendChild(bar); wrap.appendChild(tg);
grid.parentNode.insertBefore(wrap, grid);
var overflow = bar.scrollWidth > bar.clientWidth + 5;
if (wasExpanded) { bar.classList.add('expanded'); tg.classList.add('open'); }
if (!overflow) tg.style.display = 'none';
tg.addEventListener('click', function () {
var open = bar.classList.toggle('expanded');
tg.classList.toggle('open', open);
try {
if (open) { bar.style.maxHeight = bar.scrollHeight + 'px'; setTimeout(function () { if (bar.classList.contains('expanded')) bar.style.maxHeight = 'none'; }, 200); }
else {
var _chip = bar.querySelector('.recent-chip, .recent-title');
var _line = (_chip ? _chip.offsetHeight : 26) + 8;
bar.style.maxHeight = bar.scrollHeight + 'px'; void bar.offsetHeight; bar.style.maxHeight = _line + 'px';
}
} catch (e) { if (window.__silent) window.__silent(e); }
});
} catch (e) { if (window.__silent) window.__silent(e); }
}
var __modalReturnFocus = null;
function openModal(p) {
if (p && !('detail' in p)) {
var __pid = p.id;
p.detail = '';
openModal(p);
__dedupFetch('/api/products?id=' + encodeURIComponent(__pid), { cache: 'no-cache', credentials: 'include' })
.then(function (r) { return r.ok ? r.json() : null; })
.then(function (res) {
var full = (res && res.ok && res.product) ? res.product : null;
if (!full) return;
(DATA.products || []).forEach(function (x, i) { if (x && x.id === full.id) DATA.products[i] = full; });
if (!currentProduct || currentProduct.id !== __pid) return;
if (!document.getElementById('modalMask') || !document.getElementById('modalMask').classList.contains('open')) return;
currentProduct.detail = full.detail || '';
if (full.detail) {
modalDetail.innerHTML = sanitizeHTML(full.detail);
bindQuoteCopyButtons(modalDetail);
bindMediaFail(modalDetail); bindLightbox(modalDetail); bindFileCards(modalDetail);
modalDetail.style.display = 'block';
}
var _imgs = full.detailImages || [];
if (_imgs.length) {
currentProduct.detailImages = _imgs;
_imgs.forEach(function (url) {
if (!url) return;
var im = document.createElement('img');
im.decoding = 'async'; im.alt = '资源详情图'; im.style.cursor = 'zoom-in'; im.style.opacity = '0';
im.loading = 'lazy';
im.className = 'm-loading';
im.onload = function () { this.classList.remove('m-loading'); this.style.opacity = '1'; };
im.onerror = function () { this.onerror = null; this.src = window.WN_MEDIA_FALLBACK; if (this.classList) this.classList.add('media-fail'); this.classList.remove('m-loading'); this.style.opacity = '1'; };
im.src = url;
im.addEventListener('click', function () { window.openLightbox(url); });
if (window.mediaStable) window.mediaStable(im);
modalMedia.appendChild(im);
});
}
})
.catch(function () {});
return;
}
currentProduct = p;
try { if (window.__ogDynamic) window.__ogDynamic(p); } catch (e) { if (window.__silent) window.__silent(e); }
try { if (!window.__pvMode) __pushRecent(p.id); } catch (e) { if (window.__silent) window.__silent(e); }
try { __renderRecent(); } catch (e) { if (window.__silent) window.__silent(e); }
currentVariant = null;
track(p.id, 'view');
try {
var _ids = window.__visibleIds || [];
var _mi = _ids.indexOf(Number(p.id));
window.__modalSeq = { ids: _ids, i: _mi };
var _mm = document.getElementById('modalMask');
} catch (e0) { if (window.__silent) window.__silent(e0); }
var _mdSkel = document.getElementById('modalSkeleton'); if (_mdSkel) _mdSkel.style.display = 'none';
var _covArr = Array.isArray(p.coverImages) ? p.coverImages : (p.img ? [p.img] : []);
renderCarousel(document.getElementById('modalCarousel'), document.getElementById('modalCcTrack'), document.getElementById('modalCcDots'), modalCover, _covArr);
var _mainImg = _covArr[0] || p.img || '';
try { modalCover.alt = (p.title ? p.title + ' 封面图' : '资源封面图'); } catch (eAlt) {}
if (_covArr.length <= 1) {
loadImg(modalCover, _mainImg);
modalCover.style.cursor = 'zoom-in';
modalCover.classList.remove('cover-enter'); void modalCover.offsetWidth; modalCover.classList.add('cover-enter');
modalCover.onclick = function () { if (_mainImg) window.openLightbox(_mainImg, { list: _covArr.slice(), from: modalCover }); };
}
modalTitle.textContent = p.title || '';
modalTitle.title = p.title || '';
modalDesc.textContent = p.desc || '';
if (p.detail && p.detail.trim()) {
modalDetail.innerHTML = sanitizeHTML(p.detail);
bindQuoteCopyButtons(modalDetail);
bindMediaFail(modalDetail); bindLightbox(modalDetail);
bindFileCards(modalDetail);
modalDetail.style.display = 'block';
} else {
modalDetail.style.display = 'none';
}
modalMedia.innerHTML = '';
var images = p.detailImages || [];
var videos = p.detailVideos || [];
images.forEach(function (url) {
if (!url) return;
var im = document.createElement('img');
im.decoding = 'async';
im.alt = '资源详情图';
im.style.cursor = 'zoom-in';
im.style.opacity = '0';
im.loading = 'lazy';
im.className = 'm-loading';
im.onload = function () { this.classList.remove('m-loading'); this.style.opacity = '1'; };
im.onerror = function () { this.onerror = null; this.src = window.WN_MEDIA_FALLBACK; if (this && this.classList) this.classList.add('media-fail'); this.classList.remove('m-loading'); this.style.opacity = '1'; this.style.display = 'block'; };
im.src = url;
im.addEventListener('click', function () {
var srcs = Array.prototype.map.call(modalMedia.querySelectorAll('img, video'), function (x) { return x.currentSrc || x.src; });
window.openLightbox(url, { list: srcs });
});
if (window.mediaStable) window.mediaStable(im);
modalMedia.appendChild(im);
});
videos.forEach(function (url) {
if (!url) return;
var v = document.createElement('video');
v.src = url;
v.controls = true;
v.playsInline = true;
v.style.background = '#000';
v.style.cursor = 'zoom-in';
v.addEventListener('click', function () {
v.pause();
var srcs2 = Array.prototype.map.call(modalMedia.querySelectorAll('img, video'), function (x) { return x.currentSrc || x.src; });
window.openLightbox(url, { list: srcs2 });
});
if (window.mediaStable) window.mediaStable(v, true);
modalMedia.appendChild(v);
});
bindMediaFail(modalMedia);
var variants = (p.variants || []).slice().sort(function (a, b) {
return (a.sort || 0) - (b.sort || 0);
});
if (variants.length > 0) {
variantTabs.style.display = 'flex';
variantTabs.innerHTML = '';
var __draftIdx = 0;
if (__codeDraft && __codeDraft.pid === p.id) {
variants.forEach(function (v, di) { if (v.id === __codeDraft.vid) __draftIdx = di; });
}
variants.forEach(function (v, idx) {
var tab = document.createElement('div');
tab.className = 'variant-tab' + (idx === __draftIdx ? ' active' : '');
tab.textContent = v.name || '类型' + (idx + 1);
if (v.name) tab.title = v.name;
tab.addEventListener('click', function () {
if (__variantTransitioning) return;
__variantTransitioning = true;
currentVariant = v;
variantTabs.querySelectorAll('.variant-tab').forEach(function (t, i) {
t.classList.toggle('active', i === idx);
});
var __dir = 'sl-next';
variantTabs.querySelectorAll('.variant-tab').forEach(function (t, i) { if (t.classList.contains('active') && i !== idx) __dir = idx > i ? 'sl-next' : 'sl-prev'; });
setTimeout(function () {
renderVariantDetail();
updatePrice();
updateContactBtn();
initResourceCodeSection();
__tryRefillCode();
variantDetail.classList.remove('sl-next', 'sl-prev'); void variantDetail.offsetHeight;
variantDetail.classList.add(__dir);
modalPrice.classList.add('price-flash');
modalPrice.offsetHeight;
modalPrice.classList.remove('price-flash');
__variantTransitioning = false;
}, 100);
});
variantTabs.appendChild(tab);
});
currentVariant = variants[__draftIdx];
if (!currentVariant && variants.length) {
currentVariant = variants[0];
try { localStorage.removeItem('wnzyq_variant_draft'); } catch (e) { if (window.__silent) window.__silent(e); }
}
if (!currentVariant) {
if (window.showToast) window.showToast('该资源的类型已被删除', 'error');
closeModal(); return;
}
renderVariantDetail();
} else {
variantTabs.style.display = 'none';
variantDetail.style.display = 'none';
currentVariant = null;
}
updatePrice();
updateContactBtn();
initResourceCodeSection();
__tryRefillCode();
modalMask.classList.add('open');
try {
__modalReturnFocus = document.activeElement;
var _mb = document.getElementById('modalBox');
if (_mb) { if (!_mb.hasAttribute('tabindex')) _mb.setAttribute('tabindex', '-1'); _mb.focus({ preventScroll: true }); }
} catch (eF) { if (window.__silent) window.__silent(eF); }
if (window.__modalScroll) __modalScroll.open(modalMask, p.id);
setBodyLock(true);
}
function variantHasCode() {
if (!currentVariant) return false;
if (currentVariant.hasCode) return true;
return !!(currentVariant.resourceCode && String(currentVariant.resourceCode).trim());
}
function variantHasContent() {
if (!currentVariant) return false;
if (currentVariant.hasContent) return true;
return !!(currentVariant.resourceContent && String(currentVariant.resourceContent).trim());
}
var UNLOCK_CACHE_TTL = Infinity;
function __unlockCacheKey(pid, vid) { return 'wnzyq_unlock_' + pid + '_' + vid; }
function __saveUnlockCache(pid, vid, content) {
if (!pid || !vid || !content) return;
try {
var keys = [];
for (var i = 0; i < localStorage.length; i++) {
var k = localStorage.key(i);
if (k && k.indexOf('wnzyq_unlock_') === 0) keys.push(k);
}
if (keys.length >= 50) {
keys.sort(function (a, b) {
var ta = 0, tb = 0;
try { ta = (JSON.parse(localStorage.getItem(a) || '{}').t) || 0; } catch (e) { if (window.__silent) window.__silent(e); }
try { tb = (JSON.parse(localStorage.getItem(b) || '{}').t) || 0; } catch (e) { if (window.__silent) window.__silent(e); }
return ta - tb;
});
for (var j = 0; j < keys.length - 49; j++) { try { localStorage.removeItem(keys[j]); } catch (e) { if (window.__silent) window.__silent(e); } }
}
localStorage.setItem(__unlockCacheKey(pid, vid), JSON.stringify({ t: Date.now(), c: content }));
} catch (e) { if (window.__silent) window.__silent(e); }
}
function __readUnlockCache(pid, vid) {
try {
var raw = localStorage.getItem(__unlockCacheKey(pid, vid));
if (!raw) return null;
var d = JSON.parse(raw);
if (!d || !d.c) {
try { localStorage.removeItem(__unlockCacheKey(pid, vid)); } catch (e) { if (window.__silent) window.__silent(e); }
return null;
}
return d.c;
} catch (e) { return null; }
}
var unlockBusy = false;
function requestResourceUnlock(code, deferMs) {
if (!currentProduct || !currentVariant || unlockBusy) return Promise.resolve(null);
var pid = currentProduct.id, vid = currentVariant.id;
unlockBusy = true;
return Promise.race([
__dedupFetch('/api/unlock', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ productId: pid, variantId: vid, code: code || '' })
}).then(function (r) { return r.json(); }),
new Promise(function (_, reject) {
setTimeout(function () { reject(new Error('timeout')); }, 10000) ;
})
]).then(function (res) {
unlockBusy = false;
if (!currentProduct || !currentVariant || currentProduct.id !== pid || currentVariant.id !== vid) return null;
if (res && res.ok && res.content) {
__saveUnlockCache(pid, vid, res.content);
var resourceContent = document.getElementById('resourceContent');
if (resourceContent && resourceContent.style.display === 'none') {
var _fadeRows = function () {
var rows = [document.getElementById('resourceCodeInputRow'), document.getElementById('resourceDirectRow')];
rows.forEach(function (r) {
if (!r || r.style.display === 'none') return;
r.style.transition = 'opacity 0.15s ease';
r.style.opacity = '0';
setTimeout(function () { r.style.display = 'none'; r.style.opacity = ''; r.style.transition = ''; }, 150);
});
unlockResourceContent(res.content);
};
if (deferMs) setTimeout(_fadeRows, deferMs); else _fadeRows();
}
}
return res;
}).catch(function (err) {
unlockBusy = false;
if (err && err.message === 'timeout') return { ok: false, msg: window.T('netFail') };
return { ok: false, msg: window.T('netFail') };
});
}
function initResourceCodeSection() {
var resourceSection = document.getElementById('resourceCodeSection');
var resourceInputRow = document.getElementById('resourceCodeInputRow');
var resourceDirectRow = document.getElementById('resourceDirectRow');
var resourceTitle = document.getElementById('resourceCodeTitle');
var resourceInput = document.getElementById('resourceCodeInput');
var resourceError = document.getElementById('resourceCodeError');
var resourceContent = document.getElementById('resourceContent');
var hasCode = variantHasCode();
var hasContent = variantHasContent();
if (!hasContent) {
resourceSection.style.display = 'none';
return;
}
resourceSection.style.display = 'block';
resourceError.style.display = 'none';
resourceContent.style.display = 'none';
resourceContent.innerHTML = '';
var _cached = (currentProduct && currentVariant) ? __readUnlockCache(currentProduct.id, currentVariant.id) : null;
if (hasCode) {
resourceTitle.textContent = '获取专属内容';
resourceInputRow.style.display = 'flex';
resourceDirectRow.style.display = 'none';
resourceInput.value = '';
if (_cached) resourceInput.placeholder = '本设备已解锁过，直接点解锁即可';
} else {
resourceTitle.textContent = '获取专属内容';
resourceInputRow.style.display = 'none';
resourceDirectRow.style.display = 'block';
}
}
function unlockResourceContent(content, noTrack) {
var resourceContent = document.getElementById('resourceContent');
resourceContent.innerHTML = sanitizeHTML(content || '<p>专属内容</p>');
bindMediaFail(resourceContent); bindLightbox(resourceContent);
resourceContent.style.display = 'block';
resourceContent.style.animation = 'none';
void resourceContent.offsetWidth;
resourceContent.style.animation = '';
if (!noTrack) {
var variantId = currentVariant ? currentVariant.id : 0;
track(currentProduct.id, 'resource_unlock', {variant_id: variantId});
}
}
function renderVariantDetail() {
if (!currentVariant) { variantDetail.style.display = 'none'; return; }
variantDetail.innerHTML = '';
var hasContent = false;
var header = document.createElement('div');
header.className = 'variant-header';
var vName = document.createElement('span');
vName.className = 'variant-name';
vName.textContent = (currentVariant.title && String(currentVariant.title).trim()) || currentVariant.name || '';
header.appendChild(vName);
var vPriceText = formatPrice(currentVariant.price);
if (vPriceText) {
var vp = document.createElement('span');
vp.className = 'variant-price';
vp.textContent = vPriceText;
header.appendChild(vp);
}
variantDetail.appendChild(header);
hasContent = true;
if (currentVariant.desc && currentVariant.desc.trim()) {
var d = document.createElement('div');
d.className = 'v-desc';
d.innerHTML = sanitizeHTML(currentVariant.desc);
bindMediaFail(d); bindLightbox(d);
variantDetail.appendChild(d);
hasContent = true;
}
if (currentVariant.img) {
var im = document.createElement('img');
im.decoding = 'async';
im.onerror = function () {
this.onerror = null;
this.src = window.WN_MEDIA_FALLBACK; if (this && this.classList) this.classList.add('media-fail'); this.style.display = 'block';
};
im.src = currentVariant.img;
im.alt = '资源详情图';
im.style.cursor = 'zoom-in';
im.addEventListener('click', function () { window.openLightbox(currentVariant.img); });
variantDetail.appendChild(im);
hasContent = true;
}
if (currentVariant.video) {
var v = document.createElement('video');
v.src = currentVariant.video;
v.controls = true;
v.playsInline = true;
variantDetail.appendChild(v);
hasContent = true;
}
bindMediaFail(variantDetail); bindLightbox(variantDetail);
variantDetail.style.display = hasContent ? 'block' : 'none';
if (hasContent) {
variantDetail.style.animation = 'none';
variantDetail.offsetHeight;
variantDetail.style.animation = 'fadeInUp 0.20s var(--ease-out, ease)';
}
}
function updatePrice() {
var price = 0;
if (currentVariant) {
price = Number(currentVariant.price) || 0;
} else {
var variantCount = (currentProduct && currentProduct.variants) ? currentProduct.variants.length : 0;
if (variantCount === 0 && currentProduct) {
price = Number(currentProduct.price) || 0;
}
}
var text = formatPrice(price);
if (text) {
modalPrice.textContent = text;
modalPrice.style.display = '';
} else {
modalPrice.style.display = 'none';
}
}
function updateContactBtn() {
var url = '';
if (currentVariant && currentVariant.contactUrl) url = currentVariant.contactUrl;
else if (currentProduct && currentProduct.contactUrl) url = currentProduct.contactUrl;
else url = window._globalContact || getDefaultContact();
if (url) {
btnContact.style.display = '';
btnContact.onclick = function () {
track(currentProduct ? currentProduct.id : null, 'contact');
var _qr = (currentVariant && currentVariant.contactQr) || (currentProduct && currentProduct.contactQr) || window.__kefuQrSrc();
if (window.openContactModal) { window.openContactModal(url, _qr, null, '跳转-咨询在线客服', { green: true }); } else { window.openContactFallback(url, { green: true }); }
};
} else {
btnContact.style.display = ''; btnContact.onclick = function () { showToast('暂未设置客服链接', 'info'); };
}
}
var __codeDraft = null;
function __tryRefillCode() {
if (!__codeDraft || !currentProduct || __codeDraft.pid !== currentProduct.id) return;
var vid = currentVariant ? currentVariant.id : null;
if (__codeDraft.vid !== vid) return;
var ri = document.getElementById('resourceCodeInput');
if (ri && __codeDraft.code) ri.value = __codeDraft.code;
}
function closeModalStash() {
try {
var ri = document.getElementById('resourceCodeInput');
if (ri && ri.value && currentProduct) __codeDraft = { pid: currentProduct.id, vid: currentVariant ? currentVariant.id : null, code: ri.value };
else __codeDraft = null;
} catch (e) { if (window.__silent) window.__silent(e); }
closeModal();
}
function closeModalDiscard() { __codeDraft = null; closeModal(); }
window.__modalGo = function (d) {
var s = window.__modalSeq; if (!s || !s.ids.length) return;
var ni = s.i + d;
if (ni < 0 || ni >= s.ids.length) return;
var np = (DATA.products || []).find(function (x) { return Number(x.id) === Number(s.ids[ni]); });
if (np) {
s.i = ni;
var _mb = document.getElementById('modalBox');
if (_mb) { _mb.classList.remove('modal-swap', 'sl-next', 'sl-prev'); void _mb.offsetWidth; _mb.classList.add(d < 0 ? 'sl-prev' : 'sl-next'); }
openModal(np);
}
};
(function () {
var _mm = document.getElementById('modalMask');
if (_mm) window.__bindSwipeSwitch(_mm, function (d) { window.__modalGo(d); });
})();
window.__catSeqTarget = function (d) {
var cats = (DATA.categories || []).filter(function (c) { return Number(c.id) > 0 && (!c.parent_id || Number(c.parent_id) === 0); });
var tops = cats.slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
var seq = [{ type: 'all' }];
tops.forEach(function (top) {
seq.push({ type: 'top', id: Number(top.id) });
(DATA.categories || []).filter(function (c) { return Number(c.parent_id) === Number(top.id); }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }).forEach(function (sub) { seq.push({ type: 'sub', id: Number(sub.id), parent: Number(top.id) }); });
});
var curTop = Number(currentCat || 0), curSub = Number(currentSubCat || 0);
var cur = -1;
seq.forEach(function (s, i) {
if (s.type === 'all') { if (curTop === 0 && !curSub) cur = i; }
else if (s.type === 'sub' ? (s.id === curSub && s.parent === curTop) : (s.type === 'top' && s.id === curTop && !curSub)) cur = i;
});
var ni = cur + d;
if (cur === -1) ni = (d > 0 ? 0 : seq.length - 1);
if (ni < 0 || ni >= seq.length) return null;
var tgt = seq[ni];
var _nameOf = function (id) { var c = (DATA.categories || []).find(function (x) { return Number(x.id) === Number(id); }); return c ? (c.name || '') : ''; };
return { type: tgt.type, id: tgt.id, parent: tgt.parent, name: tgt.type === 'all' ? '全部' : (tgt.type === 'sub' ? (_nameOf(tgt.parent) + '·' + _nameOf(tgt.id)) : _nameOf(tgt.id)) };
};
window.__swipeCatGo = function (d) {
var tgt = window.__catSeqTarget(d);
if (!tgt) return;
window.__swipeCommitting = true;
clearTimeout(window.__swipeCommittingTimer);
window.__swipeCommittingTimer = setTimeout(function () { window.__swipeCommitting = false; }, 600);
if (tgt.type === 'all') {
var allTag = Array.prototype.find.call(document.querySelectorAll('.category-tag'), function (t) { return (t.textContent || '').trim() === '全部'; });
if (allTag) allTag.click();
} else if (tgt.type === 'top') {
var tg = Array.prototype.find.call(document.querySelectorAll('.category-tag'), function (t) { return (t.textContent || '').trim() === (DATA.categories.find(function (c) { return Number(c.id) === tgt.id; }) || {}).name; });
if (tg) tg.click();
} else {
currentCat = Number(tgt.parent);
currentSubCat = Number(tgt.id);
currentPage = 1;
try { localStorage.setItem('wnzyq_shop_category', String(currentCat)); } catch (e) { if (window.__silent) window.__silent(e); }
renderCategories();
renderSubCategories();
__fadeRenderProducts();
}
};
window.__peekCat = function (cid, subCid) {
var key = __cacheKey(1, cid, subCid, '');
if (__pageCache[key] && __pageCache[key].products) return Promise.resolve(__pageCache[key].products);
if (__pageCacheLoading[key]) return __pageCacheLoading[key].then(function () { return (__pageCache[key] && __pageCache[key].products) || []; }).catch(function () { return []; });
var qs = '/api/products?page=1&page_size=' + PAGE_SIZE + '&brief=1';
if (cid > 0) qs += '&cid=' + cid;
if (subCid > 0) qs += '&sub_cid=' + subCid;
return __dedupFetch(qs, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (res) {
var list = (res && res.list) || [];
if (res && res.ok) {
__pageCache[key] = { products: list, categories: DATA.categories, total: res.total || list.length, totalPages: res.total_pages || Math.max(1, Math.ceil(list.length / PAGE_SIZE)), page: 1, _backendPaged: true,
announcement: DATA.announcement, announcementMode: DATA.announcementMode, announcements: DATA.announcements, shopName: DATA.shopName, _globalContact: window._globalContact, _changed: false, _wasSkel: false };
}
return list;
}).catch(function () { return []; });
};
try {
var _ta = document.getElementById('topAnn'); var _am = document.getElementById('annModal');
try {
var ANN_READ_KEY = 'wnzyq_ann_read3';
window.__annFp = function (a) {
var src = String((a && a.id) || '') + '|' + String((a && a.title) || '') + '|' + String((a && a.content) || '') + '|' + String((a && a.level) || 2);
var h = 5381;
for (var i = 0; i < src.length; i++) { h = ((h * 33) ^ src.charCodeAt(i)) >>> 0; }
return String((a && a.id) || '') + '@' + h.toString(36);
};
window.__annReadList = function () { try { return JSON.parse(localStorage.getItem(ANN_READ_KEY) || '[]') || []; } catch (e0) { return []; } };
window.__annById = function (id) {
var idS = String(id), list = DATA.announcements || [];
for (var i = 0; i < list.length; i++) { if (String(list[i] && list[i].id) === idS) return list[i]; }
return null;
};
window.__annIsRead = function (id) {
var a = window.__annById(id);
if (!a) return true;
if (window.__annReadList().indexOf(window.__annFp(a)) >= 0) return true;
if (window.__annReadList().length) return false;
var idS = String(id);
try { if ((JSON.parse(localStorage.getItem('wnzyq_ann_read') || '[]') || []).indexOf(idS) >= 0) return false; } catch (e0) {}
var seen = parseInt(localStorage.getItem('wnzyq_ann_seen') || '0', 10) || 0;
var v = parseInt(idS) || 0;
return seen > 0 && v > 0 && v <= seen;
};
window.__annMarkRead = function (id, silent) {
try {
var a = window.__annById(id); if (!a) return;
var fp = window.__annFp(a); var rl = window.__annReadList();
if (rl.indexOf(fp) < 0) { rl.push(fp); if (rl.length > 200) rl = rl.slice(-200); localStorage.setItem(ANN_READ_KEY, JSON.stringify(rl)); }
} catch (e0) { if (window.__silent) window.__silent(e0); }
try { var num = parseInt(id) || 0; if (!silent && num > 0 && typeof track === 'function' && usingRemote) track(num, 'ann_read'); } catch (e1) { if (window.__silent) window.__silent(e1); }
if (window.__annUnread) window.__annUnread();
};
window.__annMarkAllRead = function () {
var list = DATA.announcements || [];
try {
var rl = window.__annReadList();
list.forEach(function (a) { if (!a) return; var fp = window.__annFp(a); if (rl.indexOf(fp) < 0) rl.push(fp); });
if (rl.length > 200) rl = rl.slice(-200);
localStorage.setItem(ANN_READ_KEY, JSON.stringify(rl));
} catch (e0) { if (window.__silent) window.__silent(e0); }
if (window.__annUnread) window.__annUnread();
};
window.__annMarkActiveRead = function () {
try {
var act = document.querySelector('#annTabs .ann-tab.active');
var id = act && act.dataset ? act.dataset.annId : '';
if (!id) { var tt = document.getElementById('annTitleTab'); id = tt && tt.dataset ? tt.dataset.annId : ''; }
if (id && window.__annMarkRead) window.__annMarkRead(id, true);
} catch (e0) { if (window.__silent) window.__silent(e0); }
};
window.__annUnread = function () {
var btn = document.getElementById('topAnn');
var list = DATA.announcements || [];
var anyUnread = list.some(function (a) { return a && !window.__annIsRead(a.id); });
if (btn) {
var badge = document.getElementById('annDot') || btn.querySelector('.dot-badge');
if (badge) { badge.hidden = !anyUnread; if (anyUnread) { badge.classList.remove('wn-pop-out'); badge.classList.add('wn-pop-in'); } }
}
document.querySelectorAll('#annTabs .ann-tab').forEach(function (t) {
var id = t.dataset && t.dataset.annId; var d = t.querySelector('.dot-badge');
if (d && id) d.hidden = window.__annIsRead(id);
});
var tt = document.getElementById('annTitleTab');
if (tt) { var tid = tt.dataset.annId; var td = tt.querySelector('.dot-badge'); if (td && tid) td.hidden = window.__annIsRead(tid); }
};
} catch (e5) { if (window.__silent) window.__silent(e5); }
if (_ta && _am && window.MutationObserver) new MutationObserver(function () { _ta.classList.toggle('active', _am.classList.contains('open')); }).observe(_am, { attributes: true, attributeFilter: ['class'] });
} catch (e) { if (window.__silent) window.__silent(e); }
window.__fsCatLineUpdate = function (anim) {
var bar = document.querySelector('.category-bar');
if (!bar) return;
var act = bar.querySelector('.category-tag.active');
var line = window.__fsCatLine;
if (!line || !line.parentNode) { line = document.createElement('div'); line.className = 'cat-line'; bar.appendChild(line); window.__fsCatLine = line; }
if (!act) { line.style.opacity = '0'; return; }
line.style.transition = anim ? 'left .2s var(--ease-out, ease), width .2s var(--ease-out, ease)' : 'none';
line.style.left = act.offsetLeft + 'px';
line.style.width = act.offsetWidth + 'px';
line.style.opacity = '1';
};
window.__fsCatLineTo = function (fromEl, toEl, p) {
var line = window.__fsCatLine;
if (!line || !fromEl || !toEl) return;
line.style.transition = 'none';
var aL = fromEl.offsetLeft, bL = toEl.offsetLeft;
var aW = fromEl.offsetWidth, bW = toEl.offsetWidth;
line.style.left = (aL + (bL - aL) * p) + 'px';
line.style.width = (aW + (bW - aW) * p) + 'px';
line.style.opacity = '1';
};
try {
var __catBar = document.querySelector('.category-bar');
if (__catBar && window.MutationObserver) new MutationObserver(function () { window.__fsCatLineUpdate(false); }).observe(__catBar, { childList: true, subtree: true });
__catBar.addEventListener('click', function () { setTimeout(function () { window.__fsCatLineUpdate(true); }, 60); });
window.addEventListener('resize', function () { window.__fsCatLineUpdate(false); });
} catch (e) { if (window.__silent) window.__silent(e); }
window.__followSwipe({
panel: function () { return document.getElementById('productGrid'); },
neighbor: function (dir) { return window.__catSeqTarget(dir); },
fill: function (nb, dir, panelB) {
var _curGrid = document.getElementById('productGrid');
panelB.className = (_curGrid && _curGrid.className) || 'product-grid';
panelB.replaceChildren();
for (var _si = 0; _si < 8; _si++) {
var _sc = document.createElement('div');
_sc.className = 'card-skeleton';
_sc.innerHTML = '<div class="card-body"><div class="sk-img"></div><div class="sk-line w70"></div><div class="sk-line w95"></div></div>';
panelB.appendChild(_sc);
}
window.__peekCat(nb.type === 'top' ? nb.id : (nb.type === 'sub' ? nb.parent : 0), nb.type === 'sub' ? nb.id : 0).then(function (list) {
if (!panelB.isConnected) return;
var _frag = document.createDocumentFragment();
(list || []).slice(0, 8).forEach(function (p) { try { _frag.appendChild(window.__buildProductCard(p)); } catch (e) { if (window.__silent) window.__silent(e); } });
if (_frag.children.length) panelB.replaceChildren(_frag);
});
},
onProgress: function (p, dir, nb) {
var bar = document.querySelector('.category-bar');
var from = bar && bar.querySelector('.category-tag.active');
var to = null;
if (nb.type === 'all') to = bar && Array.prototype.find.call(bar.querySelectorAll('.category-tag'), function (t) { return (t.textContent || '').trim() === '全部'; });
else if (nb.type === 'top') { var c = (DATA.categories || []).find(function (x) { return Number(x.id) === Number(nb.id); }); to = bar && Array.prototype.find.call(bar.querySelectorAll('.category-tag'), function (t) { return c && (t.textContent || '').trim() === c.name; }); }
else if (nb.type === 'sub') { var pc = (DATA.categories || []).find(function (x) { return Number(x.id) === Number(nb.parent); }); to = bar && Array.prototype.find.call(bar.querySelectorAll('.category-tag'), function (t) { return pc && (t.textContent || '').trim() === pc.name; }); }
if (from && to && to !== from) window.__fsCatLineTo(from, to, p);
},
onEnd: function () { window.__fsCatLineUpdate(true); },
commit: function (dir) { window.__swipeCatGo(dir); },
isActive: function () {
var m = document.getElementById('modalMask');
return !(m && m.classList.contains('open')) && !window.__flipAnimating;
}
});
window.addEventListener('popstate', function(e) {
if (!e.state || !e.state.modal) { var m = document.getElementById('modalMask'); if (m && m.classList.contains('open')) closeModal(); }
});
function closeModal() { try { document.querySelectorAll('#modalBox video, #modalMedia video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
var _ccCar = document.getElementById('modalCarousel');
if (_ccCar && _ccCar.__ccPause) _ccCar.__ccPause();
modalMask.classList.remove('open');
setBodyLock(false);
try { if (__modalReturnFocus && __modalReturnFocus.focus) __modalReturnFocus.focus({ preventScroll: true }); } catch (eR) { if (window.__silent) window.__silent(eR); }
__modalReturnFocus = null;
currentProduct = null;
currentVariant = null;
var resourceInput = document.getElementById('resourceCodeInput');
if (resourceInput) resourceInput.value = '';
var resourceError = document.getElementById('resourceCodeError');
if (resourceError) resourceError.style.display = 'none';
var resourceContent = document.getElementById('resourceContent');
if (resourceContent) { resourceContent.style.display = 'none'; resourceContent.innerHTML = ''; }
var resourceInputRow = document.getElementById('resourceCodeInputRow');
if (resourceInputRow) resourceInputRow.style.display = 'flex';
var resourceDirectRow = document.getElementById('resourceDirectRow');
if (resourceDirectRow) resourceDirectRow.style.display = 'none';
}
var modalBox = document.getElementById('modalBox');
var touchStartX = 0;
var touchStartY = 0;
var touchStartTime = 0;
if (modalBox) {
modalBox.addEventListener('touchstart', function (e) {
if (window.__flipAnimating) { touchStartX = 0; touchStartY = 0; touchStartTime = 0; return; }
touchStartX = e.touches[0].clientX;
touchStartY = e.touches[0].clientY;
touchStartTime = Date.now();
}, { passive: true });
modalBox.addEventListener('touchend', function (e) {
var touchEndX = e.changedTouches[0].clientX;
var touchEndY = e.changedTouches[0].clientY;
var deltaX = touchEndX - touchStartX;
var deltaY = touchEndY - touchStartY;
var deltaTime = Date.now() - touchStartTime;
if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50 && deltaTime < 500) {
var tabs = document.querySelectorAll('.variant-tab');
if (tabs.length <= 1) return;
var activeIdx = 0;
tabs.forEach(function (t, i) { if (t.classList.contains('active')) activeIdx = i; });
if (deltaX < 0 && activeIdx < tabs.length - 1) {
tabs[activeIdx + 1].click();
} else if (deltaX > 0 && activeIdx > 0) {
tabs[activeIdx - 1].click();
}
}
}, { passive: true });
}
btnCloseModal.addEventListener('click', closeModalDiscard);
modalCloseX.addEventListener('click', closeModalDiscard);
modalMask.addEventListener('click', function (e) {
if (e.target === modalMask) closeModalStash();
});
modalShareX.addEventListener('click', function (e) {
e.stopPropagation();
if (!currentProduct || !currentProduct.id) { showToast('该资源暂不能分享', 'info'); return; }
var url = window.location.origin + window.location.pathname + '?pid=' + currentProduct.id;
if (window.showShareLinkModal) window.showShareLinkModal('分享资源链接', url, (currentProduct.title || '') + ' · 资源链接已复制');
else { if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch (e) { if (window.__silent) window.__silent(e); } } showToast(window.T('copied'), 'success'); }
});
var resourceCodeBtn = document.getElementById('resourceCodeBtn');
var resourceCodeInput = document.getElementById('resourceCodeInput');
var resourceCodeError = document.getElementById('resourceCodeError');
var resourceContent = document.getElementById('resourceContent');
var resourceCodeInputRow = document.getElementById('resourceCodeInputRow');
function verifyResourceCode() {
if (!currentProduct || !currentVariant) return;
if (!variantHasCode()) return;
var input = resourceCodeInput.value.trim();
if (!input) {
var _ck = __readUnlockCache(currentProduct.id, currentVariant.id);
if (!_ck) {
resourceCodeError.textContent = '请输入资源码';
resourceCodeError.style.display = 'block';
return;
}
}
var btn = document.getElementById('resourceCodeBtn');
var btnText = btn.textContent;
btn.disabled = true; if (window.__btnBusy) window.__btnBusy(btn, '解锁中');
requestResourceUnlock(input, 400).then(function (res) {
btn.disabled = false; btn.textContent = btnText;
if (res === null) return;
if (res && res.ok && res.content) {
if (window.__haptic) window.__haptic();
try {
btn.textContent = '✓ 解锁成功';
btn.style.background = 'var(--green, #2e7d32)';
btn.style.borderColor = 'var(--green, #2e7d32)';
btn.style.color = '#fff';
setTimeout(function () {
btn.textContent = btnText; btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = '';
}, 400);
} catch (e0) { if (window.__silent) window.__silent(e0); }
resourceCodeError.style.display = 'none';
} else {
resourceCodeError.style.display = 'none';
if (window.showToast) window.showToast((res && res.msg) || '资源码错误，请重试', 'error');
var __otpBox = document.getElementById('resourceCodeOtp');
var __otpCells = __otpBox ? __otpBox.querySelectorAll('input') : [];
Array.prototype.forEach.call(__otpCells, function (b) { b.style.borderColor = '#ff4444'; });
resourceCodeInput.style.borderColor = '#ff4444';
setTimeout(function () {
resourceCodeInput.style.borderColor = '';
Array.prototype.forEach.call(__otpCells, function (b) { b.style.borderColor = ''; });
}, 1500);
}
});
}
resourceCodeBtn.addEventListener('click', verifyResourceCode);
resourceCodeInput.addEventListener('keydown', function (e) {
if (e.key === 'Enter') verifyResourceCode();
});
var __lastAutoCode = '';
var __autoCodeTimer = null;
resourceCodeInput.addEventListener('input', function () {
var cleaned = this.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
if (this.value !== cleaned) this.value = cleaned;
var val = String(this.value || '').trim();
if (val.length < 8) { __lastAutoCode = ''; clearTimeout(__autoCodeTimer); return; }
if (val === __lastAutoCode) return;
clearTimeout(__autoCodeTimer);
__autoCodeTimer = setTimeout(function () {
var v = String(resourceCodeInput.value || '').trim();
if (v.length >= 8 && v !== __lastAutoCode) { __lastAutoCode = v; verifyResourceCode(); }
}, 300);
});
resourceCodeInput.addEventListener('focus', function () {
var input = this;
setTimeout(function () {
input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}, 300);
});
var resourceDirectBtn = document.getElementById('resourceDirectBtn');
var resourceDirectRow = document.getElementById('resourceDirectRow');
if (resourceDirectBtn) {
resourceDirectBtn.addEventListener('click', function () {
var btn = this;
var btnText = btn.textContent;
if (btn.disabled) return;
btn.disabled = true; if (window.__btnBusy) window.__btnBusy(btn, '获取中'); else btn.textContent = '获取中';
requestResourceUnlock('', 400).then(function (res) {
btn.disabled = false; btn.textContent = btnText;
if (res === null) return;
if (res && res.ok && res.content) {
try {
btn.textContent = '✓ 已获取';
btn.style.background = 'var(--green, #2e7d32)';
btn.style.borderColor = 'var(--green, #2e7d32)';
btn.style.color = '#fff';
setTimeout(function () {
btn.textContent = btnText; btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = '';
}, 400);
} catch (e0) { if (window.__silent) window.__silent(e0); }
} else {
resourceCodeError.textContent = (res && res.msg) || '获取失败';
resourceCodeError.style.display = 'block';
}
});
});
}
var searchClear = document.getElementById('searchClear');
var searchTimer = null;
var __searchNow = function () {
clearTimeout(searchTimer);
currentPage = 1;
__pageTurning = false;
__pendingSearchOpts = null;
__fadeRenderProducts();
};
searchInput.addEventListener('keydown', function (e) {
if (e.key === 'Enter') { e.preventDefault(); __searchNow(); }
});
searchInput.addEventListener('input', function () {
searchClear.classList.toggle('show', this.value.length > 0);
clearTimeout(searchTimer);
var self = this;
searchTimer = setTimeout(function () {
currentPage = 1;
try { if (self.value.trim()) localStorage.setItem('wnzyq_shop_search', self.value.trim()); else localStorage.removeItem('wnzyq_shop_search'); } catch (e) { if (window.__silent) window.__silent(e); }
__fadeRenderProducts(function () {
if (self.value.trim()) window.pushSearchHist('wnzyq_shop_search_hist', self.value);
});
}, 300);
});
searchClear.addEventListener('click', function () {
searchInput.value = '';
this.classList.remove('show');
__fadeRenderProducts();
try { searchInput.focus({ preventScroll: true }); } catch (e1) { searchInput.focus(); }
});
(function () {
var __bindSH = function () { window.bindSearchHist(document.querySelector('.search-box'), searchInput, 'wnzyq_shop_search_hist'); };
if (window.bindSearchHist) __bindSH(); else window.addEventListener('load', __bindSH);
})();
(function () {
var __bindCP = function () {
if (!window.__cpPanel) return;
window.__cpPanel({
placeholder: '请输入资源名',
status: function () { return __allCmdState === 'ready' ? null : __allCmdState; },
cmds: function () {
var c = [];
var _src = __allProductsForCmd || DATA.products || [];
_src.forEach(function (p) {
if (p.is_online !== true && p.is_online !== 1) return;
if (p.is_hidden === true || p.is_hidden === 1) return;
c.push({ lab: String(p.title || '(无标题)'), tag: '资源', kw: String(p.title || ''), run: function () { try { openModal(p); } catch (e) { if (window.__silent) window.__silent(e); } } });
});
return c;
}
});
};
if (window.__cpPanel) __bindCP(); else window.addEventListener('load', __bindCP);
})();
document.addEventListener('keydown', function (e) {
var __anyOpen = document.querySelector('.modal-mask.open, .share-mask.open, .kf-mask.open, .lightbox.open');
if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
var t = e.target;
if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
if (__anyOpen) return;
if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) return;
e.preventDefault();
try { searchInput.focus({ preventScroll: true }); } catch (e1) { searchInput.focus(); }
} else if (e.key === 'Escape' && !__anyOpen) {
if (document.activeElement === searchInput) {
if (searchInput.value) {
searchInput.value = '';
searchClear.classList.remove('show');
currentPage = 1;
renderProducts();
} else searchInput.blur();
}
}
});
function showToast(msg, type) { window.uiToast(msg, type); }
window.showToast = showToast;
window.toast = showToast;
topContactBtn.addEventListener('click', function () {
var url = window._globalContact || getDefaultContact();
topContactBtn.classList.add('active');
if (url) { if (window.openContactModal) { window.openContactModal(url, window.__kefuQrSrc(), null, '跳转-咨询在线客服', { green: true }); } else { window.openContactFallback(url, { green: true }); } }
else showToast('暂未设置客服链接', 'info');
});
topShareBtn.addEventListener('click', openShare);
var topAnnBtn = document.getElementById('topAnn');
if (topAnnBtn) topAnnBtn.addEventListener('click', function () { if (window.openAnnModal) window.openAnnModal(); });
if (topAnnBtn && window.__annUnread) {
window.__annUnread();
document.addEventListener('click', function (e) {
if (e.target.closest && e.target.closest('#topAnn')) { try { if (window.__annUnread) window.__annUnread(); } catch (e0) {} }
});
}
(function () {
function anyModalOpen() {
var kf = document.getElementById('kfMask');
var sh = document.getElementById('shareMask');
return (kf && kf.classList.contains('open')) || (sh && sh.classList.contains('open'));
}
function sync() {
if (!anyModalOpen()) { topContactBtn.classList.remove('active'); topShareBtn.classList.remove('active'); }
}
var mo = new MutationObserver(sync);
function observe() {
var kf = document.getElementById('kfMask');
var sh = document.getElementById('shareMask');
if (kf) mo.observe(kf, { attributes: true, attributeFilter: ['class'] });
if (sh) mo.observe(sh, { attributes: true, attributeFilter: ['class'] });
}
observe();
if (window.openContactModal) {
var _orig = window.openContactModal;
window.openContactModal = function () { var r = _orig.apply(this, arguments); observe(); return r; };
}
})();
function openShare() {
try {
topShareBtn.classList.add('active');
var url = window.location.href;
if (shareLinkText) shareLinkText.textContent = url;
if (window.__shareCopyText) {
try { window.__shareCopyText(url); } catch (e) { if (window.__silent) window.__silent(e); }
} else {
try { fallbackCopy(url); } catch (e) { if (window.__silent) window.__silent(e); }
}
if (shareLinkText) { try { shareLinkText.classList.add('copy-ok-text'); setTimeout(function(){ try{ shareLinkText.classList.remove('copy-ok-text'); }catch (e) { if (window.__silent) window.__silent(e); } }, 1500); } catch (e) { if (window.__silent) window.__silent(e); } }
showToast(window.T('copied'), 'success');
if (shareMask) { shareMask.classList.add('open'); setBodyLock(true); }
} catch (e) {
if (shareMask) { shareMask.classList.add('open'); setBodyLock(true); }
}
}
function closeShare() {
shareMask.classList.remove('open'); setBodyLock(false);
}
shareClose.addEventListener('click', closeShare);
if (shareLinkText) {
shareLinkText.style.cursor = 'pointer';
shareLinkText.title = '点击复制链接';
shareLinkText.addEventListener('click', function () {
var url = shareLinkText.textContent || '';
if (!url) return;
if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch (e) { if (window.__silent) window.__silent(e); } }
else { try { fallbackCopy(url); } catch (e) { if (window.__silent) window.__silent(e); } }
if (shareLinkText) { try { shareLinkText.classList.add('copy-ok-text'); setTimeout(function(){ try{ shareLinkText.classList.remove('copy-ok-text'); }catch (e) { if (window.__silent) window.__silent(e); } }, 1500); } catch (e) { if (window.__silent) window.__silent(e); } }
showToast(window.T('copied'), 'success');
});
}
shareMask.addEventListener('click', function (e) {
if (e.target === shareMask) closeShare();
});
function fallbackCopy(url) {
var ta = document.createElement('textarea');
ta.value = url;
ta.style.position = 'fixed';
ta.style.opacity = '0';
document.body.appendChild(ta);
ta.select();
try { document.execCommand('copy'); } catch (e) { }
if (ta.parentNode) ta.parentNode.removeChild(ta);
}
var __cacheTimer = null, __cachePending = null;
function __setShopCache(key, obj) {
try { if (obj && typeof obj === 'object') obj.__schema = (window.WN_CONST && window.WN_CONST.CACHE_SCHEMA) || 4; } catch (e) { if (window.__silent) window.__silent(e); }
try {
var merged = obj || {};
var old = localStorage.getItem(key);
if (old) {
try {
var prev = JSON.parse(old);
if (prev && typeof prev === 'object') {
for (var k in prev) { if (!(k in merged)) merged[k] = prev[k]; }
}
} catch (e2) { if (window.__silent) window.__silent(e2); }
}
var json = JSON.stringify(merged);
__cachePending = { key: key, json: json };
if (__cacheTimer) clearTimeout(__cacheTimer);
__cacheTimer = setTimeout(function () {
try { var pd = __cachePending; if (pd && localStorage.getItem(pd.key) !== pd.json) localStorage.setItem(pd.key, pd.json); } catch (e) { if (window.__silent) window.__silent(e); }
}, 400);
} catch (e) { if (window.__silent) window.__silent(e); }
}
function loadFallback() {
var cfg = (typeof SHOP_CONFIG !== 'undefined') ? SHOP_CONFIG : null;
DATA.categories = cfg && cfg.categories ? cfg.categories.map(function (c) {
return { id: c.id, name: c.name, parent_id: c.parent_id || 0, is_hidden: c.is_hidden || 0 };
}) : [{ id: 0, name: '全部', parent_id: 0 }];
DATA.products = cfg && cfg.productList ? cfg.productList.map(function (p) {
return {
id: p.id, cid: p.cid, title: p.title, desc: p.desc, detail: p.detail,
img: p.img, detailImages: p.detailImages || [], detailVideos: p.detailVideos || [],
contactUrl: p.contactUrl || '', price: p.price || 0,
variants: (p.variants || []).map(function (v) {
return {
id: v.id, name: v.name, desc: v.desc, img: v.img, video: v.video,
contactUrl: v.contactUrl || '', price: v.price || 0, sort: v.sort || 0,
hasCode: !!(v.hasCode || (v.resourceCode && String(v.resourceCode).trim())),
hasContent: !!(v.hasContent || (v.resourceContent && String(v.resourceContent).trim()))
};
}),
is_online: p.is_online, is_hidden: p.is_hidden || 0
};
}) : [];
}
var __PV = /[?&]preview=1(?:&|$)/.test(location.search);
window.__pvMode = __PV;
if (__PV) {
try { document.documentElement.classList.add('shop-preview'); } catch (e0) {}
var __pvProduct = null;
window.addEventListener('message', function (ev) {
var d = ev.data || {};
if (d.type !== 'wnzyq-preview') return;
var p = d.product || {};
p.id = Number(p.id) || 900000001;
p.detail = String(p.detail || '');
p.desc = String(p.desc || '');
p.title = String(p.title || '');
p.img = String(p.img || '');
p.coverImages = (Array.isArray(p.coverImages) && p.coverImages.length) ? p.coverImages : (p.img ? [p.img] : []);
p.detailImages = Array.isArray(p.detailImages) ? p.detailImages : [];
p.detailVideos = Array.isArray(p.detailVideos) ? p.detailVideos : [];
p.variants = Array.isArray(p.variants) ? p.variants : [];
p.price = Number(p.price) || 0;
__pvProduct = p;
try { openModal(p); } catch (e1) {}
});
try {
var _pvMask = document.getElementById('modalMask');
if (_pvMask && window.MutationObserver) {
new MutationObserver(function () {
if (!_pvMask.classList.contains('open')) {
try { parent.postMessage({ type: 'wnzyq-preview-closed' }, '*'); } catch (e3) {}
}
}).observe(_pvMask, { attributes: true, attributeFilter: ['class'] });
}
} catch (e4) {}
try { parent.postMessage({ type: 'wnzyq-preview-ready' }, '*'); } catch (e2) {}
}
var __ANNPV = /[?&]preview=ann(?:&|$)/.test(location.search);
if (__ANNPV) {
try { document.documentElement.classList.add('shop-ann-preview'); } catch (e0) {}
window.__pvMode = true;
window.addEventListener('message', function (ev) {
var d = ev.data || {};
if (d.type !== 'wnzyq-ann-preview') return;
DATA.announcements = (Array.isArray(d.list) ? d.list : []).map(function (a) {
return {
id: a.id, title: String(a.title || ''), content: String(a.content || ''),
hidden: Number(a.hidden) || 0, sort: Number(a.sort) || 0, level: Number(a.level) || 2
};
});
window.__annPvShown = true;
try { window.openAnnModal(); } catch (e1) {}
});
try { parent.postMessage({ type: 'wnzyq-ann-ready' }, '*'); } catch (e2) {}
}
function renderAll() {
renderShopInfo();
renderAnnouncement();
renderCategories();
renderProducts();
}
function renderSkeleton() {
productGrid.innerHTML = '';
emptyTip.classList.remove('show');
productGrid.classList.toggle('list-view', currentView === 'list');
var frag = document.createDocumentFragment();
for (var i = 0; i < PAGE_SIZE; i++) {
var sk = document.createElement('div');
sk.className = 'product-card card-skeleton';
sk.setAttribute('aria-hidden', 'true');
sk.innerHTML = '<div class="sk-img"></div><div class="card-body"><div class="sk-line w70"></div><div class="sk-line w95"></div></div>';
frag.appendChild(sk);
}
productGrid.appendChild(frag);
}
window.__shopEntryDone = false;
function initData() {
var sharePid = null;
try {
var _pidRaw = new URLSearchParams(window.location.search).get('pid');
if (_pidRaw && /^\d+$/.test(_pidRaw)) sharePid = Number(_pidRaw);
} catch (e) { if (window.__silent) window.__silent(e); }
window.__sharePid = sharePid;
if (sharePid) { window.__annDismissed = true; window.__annShown = false; }
var hasCache = false;
var cachedVersion = '';
try {
var cached = localStorage.getItem('wnzyq_shop_data');
try { if (cached) { var _cs = JSON.parse(cached); if (_cs && _cs.__schema !== ((window.WN_CONST && window.WN_CONST.CACHE_SCHEMA) || 4)) cached = null; } } catch (e) { cached = null; }
if (cached) {
var c = JSON.parse(cached);
if (c.products && c.products.length && c.categories) {
DATA.products = (c.products || []).map(function (p) {
(p.variants || []).forEach(function (v) {
if (v.hasCode === undefined) v.hasCode = !!(v.resourceCode && String(v.resourceCode).trim());
if (v.hasContent === undefined) v.hasContent = !!(v.resourceContent && String(v.resourceContent).trim());
delete v.resourceCode; delete v.resourceContent;
});
return p;
});
c.products = DATA.products;
__setShopCache('wnzyq_shop_data', c);
DATA.categories = c.categories;
if (c.announcement !== undefined) DATA.announcement = c.announcement;
if (c.announcement_mode !== undefined) DATA.announcementMode = c.announcement_mode;
if (Array.isArray(c.announcements)) { DATA.announcements = c.announcements;
try { var mx = 0; c.announcements.forEach(function (a) { var v = parseInt(a && a.id) || 0; if (v > mx) mx = v; }); window.__annMaxId = mx; if (window.__annUnread) window.__annUnread(); } catch (e9) { if (window.__silent) window.__silent(e9); }
}
if (c.shop_name) DATA.shopName = c.shop_name;
cachedVersion = c._homeVersion || '';
usingRemote = true;
hasCache = true;
}
}
} catch (e) { if (window.__silent) window.__silent(e); }
if (!hasCache) {
if (window.location.protocol === 'file:') {
loadFallback();
} else {
window.__skelPhase = true;
var hasSkel = productGrid.querySelectorAll('.card-skeleton').length > 0;
if (!hasSkel) renderSkeleton();
}
}
renderAll();
var isFile = window.location.protocol === 'file:';
if (!isFile) {
if (window.__enterPageEntryMode) window.__enterPageEntryMode();
loadShopHome({ cachedVersion: cachedVersion }).then(function () {
window.__shopEntryDone = true;
if (window.__exitPageEntryMode) window.__exitPageEntryMode();
__preloadCategoryFirstPages();
}).catch(function () {
window.__shopEntryDone = true;
if (window.__exitPageEntryMode) window.__exitPageEntryMode();
__failFinish();
});
} else {
window.__shopEntryDone = true;
}
}
function loadShopHome(opts) {
opts = opts || {};
var cachedVersion = opts.cachedVersion || '';
var fetchOpts = opts.force ? { cache: 'no-store' } : { cache: 'no-cache' };
var ts = opts.force ? ('&_t=' + Date.now()) : '';
function __failFinish() {
window.__loadFailed = true;
if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
renderAll();
}
return __dedupFetch('/api/shop/home?v=' + encodeURIComponent(cachedVersion) + ts, fetchOpts)
.then(function (r) { return r.ok ? r.json() : null; })
.then(function (res) {
if (!res) { __failFinish(); return; }
if (res.unchanged === true) {
window.__lastFetchTime = Date.now();
if (!window.__shopPainted && !(DATA.products || []).length && !opts.force) {
return loadShopHome({ force: true });
}
return;
}
if (!res.ok) { __failFinish(); return; }
if (res.products) {
DATA.products = res.products.list || [];
DATA.total = res.products.total || 0;
DATA.totalPages = res.products.total_pages || 1;
DATA.page = res.products.page || 1;
DATA._backendPaged = true;
}
if (res.categories) {
DATA.categories = res.categories;
}
if (res.settings) {
DATA.announcement = res.settings.announcement || '';
DATA.announcementMode = res.settings.announcement_mode || 'always';
DATA.announcements = window.parseAnnouncements(res.settings, { filterHidden: true });
try { var mx = 0; (DATA.announcements || []).forEach(function (a) { var v = parseInt(a && a.id) || 0; if (v > mx) mx = v; }); window.__annMaxId = mx; if (window.__annUnread) window.__annUnread(); } catch (e9) { if (window.__silent) window.__silent(e9); }
if (res.settings.shop_name) DATA.shopName = res.settings.shop_name;
window._globalContact = res.settings.contact_url || getDefaultContact();
window.__contactQr = res.settings.contact_qr || ''; window.__groupQr = res.settings.group_qr || ''; window.__gzhQr = res.settings.gzh_qr || '';
if (window.__kfPreconnect) window.__kfPreconnect(window._globalContact);
}
__setShopCache('wnzyq_shop_data', {
products: DATA.products,
categories: DATA.categories,
announcement: DATA.announcement,
announcement_mode: DATA.announcementMode,
announcements: DATA.announcements,
shop_name: DATA.shopName,
_contactQr: window.__contactQr || '', _groupQr: window.__groupQr || '', _gzhQr: window.__gzhQr || '',
_homeVersion: res.version || ''
});
usingRemote = true;
window.__lastFetchTime = Date.now();
var _wasSkel = !!window.__skelPhase;
if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
renderAll();
checkSharePid(true);
}).catch(function () {
if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
if (!(DATA.products || []).length) __failFinish(); else renderAll();
checkSharePid(false);
});
}
window.__lastFetchTime = 0;
function fetchRemote(opts) {
opts = opts || {};
var page = Math.max(1, opts.page || 1);
var pageSize = opts.pageSize || PAGE_SIZE;
var cid = opts.cid !== undefined ? opts.cid : currentCat;
var subCid = opts.subCid !== undefined ? opts.subCid : currentSubCat;
var kw = opts.kw !== undefined ? opts.kw : (searchInput.value || '').trim();
var key = __cacheKey(page, cid, subCid, kw);
var cached = __pageCache[key];
function doRealFetch() {
if (__pageCacheLoading[key]) return __pageCacheLoading[key];
var fetchOpts = opts.force ? { cache: 'no-store' } : { cache: 'no-cache' };
var ts = opts.force ? ('?_t=' + Date.now()) : '';
var qs = '?page=' + page + '&page_size=' + pageSize;
qs += '&brief=1';
var _onlyProducts = __catsSettingsCached;
if (cid > 0) qs += '&cid=' + cid;
if (subCid > 0) qs += '&sub_cid=' + subCid;
if (kw) qs += '&kw=' + encodeURIComponent(kw);
function withTimeout(p, ms) {
return Promise.race([p, new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); })]);
}
var _oldProducts = JSON.stringify(DATA.products || []);
var _oldCategories = JSON.stringify(DATA.categories || []);
var _oldAnn = DATA.announcement;
var _oldAnnMode = DATA.announcementMode;
var _oldShopName = DATA.shopName;
var __mc = window.__shopMetaCache || (window.__shopMetaCache = { cats: null, sets: null, t: 0 });
var __metaFresh = !!opts.force || !__mc.cats || (Date.now() - (__mc.t || 0) > 60000);
function __metaFetch(url, key) {
if (!__metaFresh && __mc[key]) {
return Promise.resolve(key === 'cats' ? { ok: true, list: __mc.cats } : { ok: true, settings: __mc.sets });
}
return withTimeout(__dedupFetch(url + ts, fetchOpts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), 10000);
}
__pageCacheLoading[key] = Promise.all([
withTimeout(__dedupFetch('/api/products' + qs + (ts ? ts.replace('?', '&') : ''), fetchOpts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), 10000) ,
__metaFetch('/api/categories', 'cats'),
__metaFetch('/api/settings', 'sets')
]).then(function (res) {
var _stale = __cacheKey(currentPage, currentCat, currentSubCat, (searchInput.value || '').trim()) !== key && !!window.__shopPainted;
var _changed = false;
if (_stale) {
if (window.__skelPhase) { window.__skelPhase = false; }
try {
__pageCache[key] = {
products: (res[0] && res[0].list) || [], categories: (res[1] && res[1].list) || DATA.categories,
total: (res[0] && res[0].total) || 0, totalPages: (res[0] && res[0].total_pages) || 1, page: (res[0] && res[0].page) || 1, _backendPaged: true,
announcement: DATA.announcement, announcementMode: DATA.announcementMode,
announcements: DATA.announcements, shopName: DATA.shopName,
_globalContact: window._globalContact, _changed: false, _wasSkel: false
};
} catch (e) { if (window.__silent) window.__silent(e); }
return { changed: false, wasSkel: false, stale: true };
}
if (res[0] && res[0].ok && res[1] && res[1].ok) {
var _suspicious = currentPage === 1 && !(res[0].list || []).length && (res[0].total || 0) > 0 && (DATA.products || []).length > 0;
if (_suspicious) { if (window.showToast) window.showToast('数据加载异常，已保留当前内容', 'error'); return { changed: false, wasSkel: false }; }
DATA.products = res[0].list || [];
var _cl = res[1].list || [];
if (_cl.length || !(DATA.categories || []).length) { DATA.categories = _cl; try { __mc.cats = DATA.categories; __mc.t = Date.now(); } catch (e) { if (window.__silent) window.__silent(e); } }
usingRemote = true;
if (res[0].total_pages !== undefined) {
DATA.total = res[0].total || 0;
DATA.totalPages = res[0].total_pages || 1;
DATA.page = res[0].page || 1;
DATA._backendPaged = true;
} else {
DATA._backendPaged = true;
}
__setShopCache('wnzyq_shop_data', { products: DATA.products, categories: DATA.categories });
if (JSON.stringify(DATA.products) !== _oldProducts || JSON.stringify(DATA.categories) !== _oldCategories) _changed = true;
}
if (res[2] && res[2].ok) {
var _newAnn = (res[2].settings || {}).announcement || '';
var _newAnnMode = (res[2].settings || {}).announcement_mode || 'always';
if (!_newAnn && !(res[2].settings || {}).announcements) {
try { localStorage.removeItem('wnzyq_ann_date'); localStorage.removeItem('wnzyq_ann_session'); } catch (e) { if (window.__silent) window.__silent(e); }
}
DATA.announcement = _newAnn;
DATA.announcementMode = _newAnnMode;
DATA.announcements = window.parseAnnouncements(res[2].settings || {}, { filterHidden: true });
try { var mx = 0; (DATA.announcements || []).forEach(function (a) { var v = parseInt(a && a.id) || 0; if (v > mx) mx = v; }); window.__annMaxId = mx; if (window.__annUnread) window.__annUnread(); } catch (e9) { if (window.__silent) window.__silent(e9); }
try { __mc.sets = res[2].settings || {}; __mc.t = Date.now(); } catch (e) { if (window.__silent) window.__silent(e); }
if ((res[2].settings || {}).shop_name) { DATA.shopName = res[2].settings.shop_name; }
window._globalContact = (res[2].settings || {}).contact_url || getDefaultContact();
window.__contactQr = (res[2].settings || {}).contact_qr || ''; window.__groupQr = (res[2].settings || {}).group_qr || ''; window.__gzhQr = (res[2].settings || {}).gzh_qr || '';
if (window.__kfPreconnect) window.__kfPreconnect(window._globalContact);
try {
var cacheData = JSON.parse(localStorage.getItem('wnzyq_shop_data') || '{}');
cacheData.announcement = DATA.announcement;
cacheData.announcement_mode = DATA.announcementMode;
cacheData.announcements = DATA.announcements;
if (DATA.shopName) cacheData.shop_name = DATA.shopName;
__setShopCache('wnzyq_shop_data', cacheData);
} catch (e) { if (window.__silent) window.__silent(e); }
if (DATA.announcement !== _oldAnn || DATA.announcementMode !== _oldAnnMode || DATA.shopName !== _oldShopName) _changed = true;
}
var _wasSkel = !!window.__skelPhase;
if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
window.__lastFetchTime = Date.now();
__pageCache[key] = {
products: DATA.products, categories: DATA.categories,
total: DATA.total, totalPages: DATA.totalPages, page: DATA.page, _backendPaged: DATA._backendPaged,
announcement: DATA.announcement, announcementMode: DATA.announcementMode,
announcements: DATA.announcements, shopName: DATA.shopName,
_globalContact: window._globalContact,
_changed: _changed, _wasSkel: _wasSkel
};
void 0;
return { changed: _changed, wasSkel: _wasSkel };
}).catch(function (err) {
if (window.__skelPhase) { window.__skelPhase = false; if (!DATA.products.length) loadFallback(); }
if (__cacheKey(currentPage, currentCat, currentSubCat, (searchInput.value || '').trim()) === key) window.__loadFailed = true;
throw err;
});
return __pageCacheLoading[key];
}
if (cached && !opts.force) {
DATA.products = cached.products;
DATA.categories = cached.categories;
DATA.total = cached.total;
DATA.totalPages = cached.totalPages;
DATA.page = cached.page;
DATA._backendPaged = cached._backendPaged;
DATA.announcement = cached.announcement;
DATA.announcementMode = cached.announcementMode;
DATA.announcements = cached.announcements;
if (cached.shopName) DATA.shopName = cached.shopName;
if (cached._globalContact) window._globalContact = cached._globalContact;
if (cached._contactQr !== undefined) { window.__contactQr = cached._contactQr || ''; window.__groupQr = cached._groupQr || ''; window.__gzhQr = cached._gzhQr || ''; }
usingRemote = true;
doRealFetch().then(function (res) {
var curKey = __cacheKey(currentPage, currentCat, currentSubCat, (searchInput.value || '').trim());
if (curKey === key && res.changed) { renderAll(); }
}).catch(function () {});
return Promise.resolve();
}
return doRealFetch();
}
var __allProductsForCmd = null;
var __allCmdState = 'loading';
function __cmdNotify() { try { if (window.__cpPanelInst && window.__cpPanelInst.refresh) window.__cpPanelInst.refresh(); } catch (e) { if (window.__silent) window.__silent(e); } }
function __loadAllProductsForCmd() {
if (__allProductsForCmd) return;
__dedupFetch('/api/products?page_size=0&brief=1', { cache: 'no-cache', credentials: 'include' }).then(function (r) {
return r.ok ? r.json() : null;
}).then(function (res) {
if (res && res.ok && res.list) {
__allProductsForCmd = (res.list || []).filter(function (p) {
return (p.is_online === true || p.is_online === 1) && (p.is_hidden !== true && p.is_hidden !== 1);
});
__allCmdState = 'ready';
} else {
__allCmdState = 'error';
}
__cmdNotify();
}).catch(function () { __allCmdState = 'error'; __cmdNotify(); });
}
function __preloadCategoryFirstPages() {
var _cats = (DATA.categories || []).filter(function (c) { return (c.parent_id || 0) === 0 && !c.is_hidden; }).slice(0, 3);
var _run = function () { __preloadReal(_cats); };
if (window.requestIdleCallback) requestIdleCallback(_run, { timeout: 4000 }); else setTimeout(_run, 2500);
}
function __preloadReal(_cats) {
var cats = (Array.isArray(_cats) && _cats.length)
? _cats
: (DATA.categories || []).filter(function (c) { return !c.parent_id || Number(c.parent_id) === 0; });
var totalItems = (DATA.products || []).length + cats.length;
if (totalItems > 500) {
return;
}
cats.forEach(function (c) {
if (Number(c.id) === 0) return;
fetchRemote({ page: 1, cid: c.id, subCid: 0, kw: '' }).catch(function () {});
});
}
var __pidHandled = false;
function checkSharePid(fromRemote) {
if (__pidHandled) return;
var pid = window.__sharePid;
if (!pid) return;
__pidHandled = true;
var p = (DATA.products || []).find(function (x) { return Number(x.id) === pid; });
if (p) {
try { openModal(p); } catch (e) { if (window.__silent) window.__silent(e); }
} else {
var __fail = function () { showToast('这条资源的链接已失效（可能已删除或已下架）', 'error'); };
if (!fromRemote) {
if ((DATA.products || []).length) __fail();
} else {
__dedupFetch('/api/products?id=' + encodeURIComponent(pid), { cache: 'no-cache', credentials: 'include' })
.then(function (r) { return r.ok ? r.json() : null; })
.then(function (res) {
var full = (res && res.ok && res.product) ? res.product : null;
if (full && !full.is_hidden) {
if (!(DATA.products || []).some(function (x) { return Number(x.id) === Number(full.id); })) DATA.products.push(full);
try { openModal(full); } catch (e) { if (window.__silent) window.__silent(e); }
} else __fail();
}).catch(__fail);
}
}
try {
var u = new URL(window.location.href);
u.searchParams.delete('pid');
window.history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : ''));
} catch (e) { if (window.__silent) window.__silent(e); }
window.__sharePid = null;
}
function updateTopbarHeight() {
var h = document.querySelector('.topbar').offsetHeight;
document.documentElement.style.setProperty('--topbar-h', h + 'px');
}
window.addEventListener('resize', updateTopbarHeight);
window.addEventListener('resize', function () {
});
var topbarEl = document.querySelector('.topbar');
window.__pullRefresh = {
guard: function () { return !!window.__flipAnimating; },
refresh: function (done) {
window.__annShown = false; window.__annDismissed = false;
try { localStorage.removeItem('wnzyq_shop_data'); } catch (e) { if (window.__silent) window.__silent(e); }
__pageCache = {}; __pageCacheLoading = {};
if (window.location.protocol === 'file:') loadFallback();
else loadShopHome({ force: true });
renderAll();
if (done) done();
}
};
var backTopBtn = document.getElementById('backTop');
var lastScrollY = 0;
var scrollTimer = null;
function checkScroll() {
var currentY = window.scrollY || document.documentElement.scrollTop || 0;
var delta = currentY - lastScrollY;
if (currentY > 400) {
backTopBtn.classList.add('show');
} else {
backTopBtn.classList.remove('show');
}
if (false && delta > 2 && currentY > 120) {
topbarEl.classList.add('hidden');
} else if (delta < -2) {
if (topbarEl.style.transition === 'none') topbarEl.style.transition = '';
topbarEl.classList.remove('hidden');
}
lastScrollY = currentY;
}
var __skTicking = false;
window.addEventListener('scroll', function () {
if (!__skTicking) { __skTicking = true; requestAnimationFrame(function () { checkScroll(); __skTicking = false; }); }
clearTimeout(scrollTimer);
scrollTimer = setTimeout(checkScroll, 200);
}, { passive: true });
checkScroll();
backTopBtn.addEventListener('click', function () {
window.scrollTo({ top: 0, behavior: 'smooth' });
});
var catToggle = document.getElementById('catToggle');
var categoryBar = document.getElementById('categoryBar');
catToggle.addEventListener('click', function () {
var _overflow = categoryBar.scrollWidth > categoryBar.clientWidth + 2;
catExpanded = _overflow ? !catExpanded : false;
categoryBar.classList.toggle('expanded', catExpanded);
try { categoryBar.style.maxHeight = catExpanded ? (categoryBar.scrollHeight + 16) + 'px' : '56px'; } catch (eMH) {}
this.classList.toggle('open', catExpanded);
if (!_overflow) { var _ar = this.querySelector('.toggle-arrow'); if (_ar) { _ar.style.transform = 'rotate(0deg)'; setTimeout(function () { if (!catExpanded && _ar) _ar.style.transform = 'rotate(-90deg)'; }, 280); } }
var arrow = this.querySelector('.toggle-arrow');
if (arrow) {
arrow.style.transform = (!_overflow && !catExpanded) ? 'rotate(0deg)' : (catExpanded ? 'rotate(0deg)' : 'rotate(-90deg)');
}
setTimeout(function () { if (window.__fsCatLineUpdate) window.__fsCatLineUpdate(false); }, 50);
});
var subCatToggle = document.getElementById('subCatToggle');
var subCategoryBar = document.getElementById('subCategoryBar');
if (subCatToggle && subCategoryBar) {
subCatToggle.addEventListener('click', function () {
var _subOverflow = subCategoryBar.scrollWidth > subCategoryBar.clientWidth + 2;
subCatExpanded = _subOverflow ? !subCatExpanded : false;
subCategoryBar.classList.toggle('expanded', subCatExpanded);
try { subCategoryBar.style.maxHeight = subCatExpanded ? (subCategoryBar.scrollHeight + 12) + 'px' : '36px'; } catch (eMH2) {}
this.classList.toggle('open', subCatExpanded);
var arrow = this.querySelector('.toggle-arrow');
if (arrow) {
if (!_subOverflow && !subCatExpanded) { arrow.style.transform = 'rotate(0deg)'; var _sar = arrow; setTimeout(function () { if (!subCatExpanded && _sar) _sar.style.transform = 'rotate(-90deg)'; }, 280); }
else arrow.style.transform = subCatExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
}
});
}
window.addEventListener('DOMContentLoaded', function () {
var kit = window.__modalKit; if (!kit) return;
kit.register(modalMask, { discard: closeModalDiscard, stash: closeModalStash });
var __am = document.getElementById('annModal');
if (__am) {
kit.register(__am, { discard: closeAnnModal, stash: closeAnnModal });
__am.addEventListener('click', function (e) { if (e.target === __am) closeAnnModal(); });
}
kit.register(shareMask, { discard: closeShare, stash: closeShare });
});
var SCROLL_KEY = 'wnzyq_shop_scroll';
window.addEventListener('beforeunload', function () {
localStorage.setItem(SCROLL_KEY, window.scrollY);
});
function __shopBackGuard() {
setTimeout(function () { try { var grid = document.getElementById('productGrid'); if (grid && !grid.children.length && typeof initData === 'function') initData(); } catch (err) { if (window.__silent) window.__silent(err); } }, 60);
}
window.addEventListener('pageshow', function (e) {
if (e.persisted) {
try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
}
});
window.addEventListener('pageshow', function (e) { if (e.persisted) return; __shopBackGuard(); });
window.addEventListener('popstate', __shopBackGuard);
var savedScroll = parseInt(localStorage.getItem(SCROLL_KEY) || '0', 10);
if (savedScroll > 0) {
setTimeout(function () { window.scrollTo(0, savedScroll); }, 100);
}
(function () {
function setup() {
var cm = window.__ctxMenu; if (!cm) return;
function __cp(text, msg) {
if (window.__shareCopyText && window.__shareCopyText(text)) { showToast(msg, 'success'); var el = window.__ctxMenuLastHit; if (el && el.classList) { el.classList.add('copy-ok-text'); setTimeout(function(){ el.classList.remove('copy-ok-text'); }, 1500); } }
else { showToast('复制失败', 'error'); }
}
function __shareProdFn(p) {
return function () {
var url = window.location.origin + window.location.pathname + '?pid=' + p.id;
if (window.showShareLinkModal) window.showShareLinkModal('分享资源链接', url, (p.title || '') + ' · 资源链接已复制');
else __cp(url, window.T('copied'));
};
}
function __saveQrFn(p) {
return function () { if (window.__savePosterPng) window.__savePosterPng(p.id, null, p.title); };
}
function imgItems(img, p) {
var src = img.currentSrc || img.src || '';
if (!src) return [];
var items = [
{ label: '保存图片', fn: function () { window.__saveImage(src); } },
{ label: '预览大图', fn: function () { window.openLightbox(src); } }
];
if (p) {
items.push({ label: '分享资源', fn: __shareProdFn(p) });
items.push({ label: '存二维码', fn: __saveQrFn(p) });
}
return items;
}
function textItems(el, p) {
var full = String(el.innerText || '').trim();
var items = [{ label: '复制选中', fn: function () {
var sel = '';
try { sel = String(window.getSelection ? window.getSelection() : ''); } catch (e) { if (window.__silent) window.__silent(e); }
if (sel) __cp(sel, '选中内容已复制');
else showToast('先选中文字，再长按即可复制', 'info');
} }];
if (full) items.push({ label: '复制全文', fn: function () { __cp(full, '内容已复制'); } });
if (p) {
items.push({ label: '分享资源', fn: __shareProdFn(p) });
items.push({ label: '存二维码', fn: __saveQrFn(p) });
}
return items;
}
cm.bind(productGrid, '.product-card:not(.card-skeleton)', function (card) {
var pid = Number(card.getAttribute('data-pid') || 0);
var p = (DATA.products || []).find(function (x) { return Number(x.id) === pid; });
if (!p) return [];
return [
{ label: '复制标题', fn: function () { __cp(p.title || '', '标题已复制'); } },
{ label: '复制简介', fn: function () { __cp(p.desc || '', '简介已复制'); } },
{ label: '分享资源', fn: __shareProdFn(p) },
{ label: '存二维码', fn: __saveQrFn(p) }
];
});
cm.bind(productGrid, 'img.card-img', function (img) {
var _card = img.closest ? img.closest('.product-card') : null;
var _pid = Number((_card && _card.getAttribute('data-pid')) || 0);
var p = (DATA.products || []).find(function (x) { return Number(x.id) === _pid; }) || currentProduct;
return imgItems(img, p);
});
cm.bind(modalMask, 'img', function (img) { return imgItems(img, currentProduct); });
cm.bind(modalMask, '.modal-wrap', function (el, e) {
if (e && e.target && e.target.closest && e.target.closest('button, input, textarea, a, select, img, video')) return [];
return textItems(el, currentProduct);
});
}
if (window.__ctxMenu) setup(); else window.addEventListener('DOMContentLoaded', setup);
})();
renderShopInfo();
updateTopbarHeight();
initData();
window.addEventListener('storage', function (e) {
if (e.key === 'wnzyq_kf_url_updated') {
__dedupFetch('/api/settings?_t=' + Date.now())
.then(function (r) { return r.ok ? r.json() : null; })
.then(function (res) {
if (res && res.settings && res.settings.contact_url !== undefined) {
window._globalContact = res.settings.contact_url || getDefaultContact();
window.__contactQr = res.settings.contact_qr || ''; window.__groupQr = res.settings.group_qr || ''; window.__gzhQr = res.settings.gzh_qr || '';
if (window.__kfPreconnect) window.__kfPreconnect(window._globalContact);
updateContactBtn();
}
}).catch(function () {});
}
});
var currentView = localStorage.getItem('wnzyq_shop_view') || 'list';
var _grid = document.getElementById('productGrid');
if (_grid) _grid.classList.toggle('list-view', currentView === 'list');
var __shopFlipper = null;
function setShopView(view) {
currentView = view;
localStorage.setItem('wnzyq_shop_view', view);
var grid = document.getElementById('productGrid');
var gridBtn = document.getElementById('viewGridBtn');
var listBtn = document.getElementById('viewListBtn');
if (view === 'list') {
grid.classList.add('list-view');
triggerViewAnim(grid);
gridBtn.classList.remove('active');
listBtn.classList.add('active');
} else {
grid.classList.remove('list-view');
triggerViewAnim(grid);
gridBtn.classList.add('active');
listBtn.classList.remove('active');
}
var hasSkel = grid.querySelectorAll('.card-skeleton').length > 0;
if (hasSkel) renderSkeleton();
}
function flipSetShopView(view) {
window.flipViewSwitch('productGrid', view, {
btnA: 'viewListBtn', btnB: 'viewGridBtn',
flipperKey: '__shopFlipper',
viewClass: 'list-view', viewA: 'list',
storageKey: 'wnzyq_shop_view',
fallbackFn: setShopView,
triggerAnim: triggerViewAnim,
onChange: function (v) {
currentView = v;
var hasSkel = productGrid.querySelectorAll('.card-skeleton').length > 0;
if (hasSkel) renderSkeleton();
}
});
}
document.getElementById('viewGridBtn').addEventListener('click', function () { flipSetShopView('grid'); });
document.getElementById('viewListBtn').addEventListener('click', function () { flipSetShopView('list'); });
setShopView(currentView);
setTimeout(function () { document.body.style.opacity = '1'; }, 500);
window.closeModal = typeof closeModal !== 'undefined' ? closeModal : window.closeModal;
window.closeShare = typeof closeShare !== 'undefined' ? closeShare : window.closeShare;
window.closeAnnModal = typeof closeAnnModal !== 'undefined' ? closeAnnModal : window.closeAnnModal;
window.showAnnDefault = typeof showAnnDefault !== 'undefined' ? showAnnDefault : window.showAnnDefault;
window.loadImg = typeof loadImg !== 'undefined' ? loadImg : window.loadImg;
window.__shopGetData = typeof DATA !== 'undefined' ? function () { return DATA; } : null;
})();
(function () {
function bindBar(bar, getTags) {
if (!bar || bar.__edgeSw) return; bar.__edgeSw = 1;
bar.addEventListener('keydown', function (e) {
var key = e.key;
var isAct = key === 'Enter' || key === ' ' || key === 'Spacebar';
var isMove = key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End';
if (!isAct && !isMove) return;
var tags = (getTags() || []).filter(function (t) { return t && t.offsetParent !== null; });
if (!tags.length) return;
var i = tags.indexOf(document.activeElement);
if (i < 0) return;
if (isAct) {
e.preventDefault();
tags[i].click();
var act0 = bar.querySelector('.active');
if (act0 && document.activeElement !== act0) { try { act0.focus(); } catch (e0) { if (window.__silent) window.__silent(e0); } }
return;
}
e.preventDefault();
var ni = key === 'Home' ? 0 : key === 'End' ? tags.length - 1 : i + (key === 'ArrowRight' ? 1 : -1);
if (ni < 0 || ni >= tags.length) return;
tags[ni].focus();
});
var sx = 0, sy = 0;
bar.addEventListener('touchstart', function (e) { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
bar.addEventListener('touchend', function (e) {
var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
var atEnd = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 4;
var atStart = bar.scrollLeft <= 4;
if (dx < 0 && !atEnd) return;
if (dx > 0 && !atStart) return;
var tags = getTags(); if (!tags.length) return;
var cur = -1; tags.forEach(function (t, i) { if (t.classList.contains('active')) cur = i; });
var ni = cur + (dx < 0 ? 1 : -1);
if (ni < 0 || ni >= tags.length) return;
window.__barDir = dx < 0 ? 1 : -1;
tags[ni].click();
}, { passive: true });
try {
var __keyGlow = function (keyId, maskSel) {
var k = document.getElementById(keyId), m = document.querySelector(maskSel);
if (!k || !m) return;
new MutationObserver(function () { k.classList.toggle('active', m.classList.contains('open')); }).observe(m, { attributes: true, attributeFilter: ['class'] });
};
__keyGlow('topContact', '.kf-mask');
__keyGlow('topShare', '.share-mask');
} catch (e) { if (window.__silent) window.__silent(e); }
}
function bind() {
var top = document.querySelector('.category-bar'); if (top) bindBar(top, function () { return [...document.querySelectorAll('.category-bar .category-tag')]; });
var sub = document.querySelector('.sub-category-bar'); if (sub) bindBar(sub, function () { return [...document.querySelectorAll('.sub-category-bar .sub-category-tag')]; });
}
if (document.readyState !== 'loading') bind(); else document.addEventListener('DOMContentLoaded', bind);
})();
(function () {
var M = window.__motion;
if (!M) return;
function bootCasc() {
var g = document.getElementById('productGrid');
if (g && !g.__wnCasc) {
g.__wnCasc = 1;
var mo = new MutationObserver(function () {
clearTimeout(g.__wnCascT);
g.__wnCascT = setTimeout(function () { M.cascade(document.getElementById('productGrid'), { step: 26, cap: 12 }); }, 60);
});
mo.observe(g, { childList: true });
}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootCasc); else bootCasc();
(function () {
var input = document.getElementById('resourceCodeInput');
var row = document.getElementById('resourceCodeInputRow');
if (!input || !row || row.__wnOtp) return;
row.__wnOtp = 1;
var box = document.createElement('div');
box.id = 'resourceCodeOtp';
input.parentNode.insertBefore(box, input);
input.style.display = 'none';
M.otp(box, 8);
var boxes = box.__otpInputs || [];
function pushToInput(src) {
var v = (src === 'otp') ? (box.dataset.otpValue || '') : (input.value || '');
if (src === 'otp') {
if (input.value !== v) {
input.value = v;
try { input.dispatchEvent(new Event('input', { bubbles: false })); } catch (e) {}
}
} else if (v !== box.dataset.otpValue) {
for (var i = 0; i < boxes.length; i++) boxes[i].value = v[i] || '';
box.dataset.otpValue = v;
boxes.forEach(function (b) { b.classList.toggle('filled', !!b.value); });
}
}
boxes.forEach(function (b) { b.addEventListener('input', function () { pushToInput('otp'); }); });
(function () {
var mask = document.getElementById('modalMask');
if (!mask) return;
var t = null;
new MutationObserver(function () {
var open = mask.classList.contains('open');
if (open && !t) { pushToInput('input'); t = setInterval(function () { pushToInput('input'); }, 400); }
else if (!open && t) { clearInterval(t); t = null; }
}).observe(mask, { attributes: true, attributeFilter: ['class'] });
})();
var errEl = document.getElementById('resourceCodeError');
function doShake() { M.shake(box); }
if (errEl) {
var eo = new MutationObserver(function () { if (errEl.style.display !== 'none' && errEl.style.display !== '') doShake(); });
eo.observe(errEl, { attributes: true, attributeFilter: ['style'] });
}
document.addEventListener('pointerdown', function () {}, true);
var toastMo = new MutationObserver(function (muts) {
muts.forEach(function (m) {
Array.prototype.forEach.call(m.addedNodes, function (n) {
if (n.nodeType === 1 && n.classList && n.classList.contains('ui-toast') && /资源码/.test(n.textContent || '')) doShake();
});
});
});
toastMo.observe(document.body, { childList: true });
})();
(function () {
var si = document.getElementById('searchInput');
if (!si || si.__wnSugg) return;
si.__wnSugg = 1;
function getData(kw) {
kw = kw.toLowerCase();
var out = [];
try {
var src = window.__shopGetData ? (__shopGetData().products || []) : [];
src.forEach(function (p) {
var t = p.title || '';
if (out.length >= 6) return;
if (t.toLowerCase().indexOf(kw) > -1) {
var price = window.formatPrice ? formatPrice(p.price) : '';
out.push({ label: t, sub: price || (p.desc || '').slice(0, 18) });
}
});
} catch (e) {}
return out;
}
M.suggest(si, getData, function (it) {
si.value = it.label;
try { si.dispatchEvent(new Event('input', { bubbles: false })); } catch (e) {}
});
try { Object.defineProperty(window, '__shopAllProducts', { get: function () { return (typeof DATA !== 'undefined' && DATA.products) || []; }, configurable: true }); } catch (e) {}
})();
(function () {
var lastFrom = null;
document.addEventListener('click', function (e) {
var card = e.target.closest ? e.target.closest('.product-card, #productList .product-row') : null;
if (!card) { lastFrom = null; return; }
var img = card.querySelector('img');
if (!img) { lastFrom = null; return; }
var r = img.getBoundingClientRect();
if (r.width < 10) { lastFrom = null; return; }
lastFrom = { x: r.left, y: r.top, w: r.width, h: r.height };
}, true);
var mask = document.getElementById('modalMask');
if (!mask || mask.__wnFlip) return;
mask.__wnFlip = 1;
var mo = new MutationObserver(function () {
if (!mask.classList.contains('open') || !lastFrom) return;
var from = lastFrom; lastFrom = null;
var tries = 0;
(function tryFlip() {
var cover = document.getElementById('modalCover');
var car = document.getElementById('modalCarousel');
var target = (cover && cover.style.display !== 'none' && cover.offsetWidth > 20) ? cover
: (car && car.style.display !== 'none' ? car.querySelector('img') : null);
if (!target && tries++ < 12) { setTimeout(tryFlip, 50); return; }
if (!target) return;
var tr = target.getBoundingClientRect();
if (tr.width < 10) return;
var sx = from.w / tr.width, sy = from.h / tr.height;
var dx = (from.x + from.w / 2) - (tr.left + tr.width / 2);
var dy = (from.y + from.h / 2) - (tr.top + tr.height / 2);
if (Math.abs(dx) > window.innerWidth * 2 || !isFinite(dx)) return;
target.style.transition = 'none';
target.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
target.style.opacity = '0.6';
target.style.zIndex = '3';
requestAnimationFrame(function () {
target.style.transition = 'transform .36s cubic-bezier(.34,1.2,.64,1), opacity .3s ease';
target.style.transform = 'none';
target.style.opacity = '';
setTimeout(function () { target.style.transition = ''; target.style.zIndex = ''; }, 400);
});
})();
});
mo.observe(mask, { attributes: true, attributeFilter: ['class'] });
})();
})();
(function () {
var tabs = document.getElementById('annTabs');
var fold = document.getElementById('annTabsFold');
var body = document.getElementById('annBody');
if (!tabs || !fold) return;
function syncFold() {
var prev = tabs.style.maxHeight;
tabs.style.maxHeight = 'none';
var full = tabs.scrollHeight;
tabs.style.maxHeight = prev;
var need = full > 40;
fold.hidden = !need;
if (!need) { tabs.classList.remove('is-open'); fold.classList.remove('open'); }
}
fold.addEventListener('click', function () {
var open = tabs.classList.toggle('is-open');
fold.classList.toggle('open', open);
fold.setAttribute('aria-expanded', open ? 'true' : 'false');
if (open) syncFold();
});
if (window.MutationObserver) {
try { new MutationObserver(syncFold).observe(tabs, { childList: true }); } catch (e) {}
}
syncFold();
function syncCenter() {
if (!body) return;
var hasBlock = !!body.querySelector('img,video,table,ul,ol,iframe');
body.classList.toggle('is-center', !hasBlock);
}
if (body && window.MutationObserver) {
try { new MutationObserver(syncCenter).observe(body, { childList: true }); } catch (e) {}
}
syncCenter();
})();
