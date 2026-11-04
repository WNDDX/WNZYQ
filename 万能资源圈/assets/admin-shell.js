document.addEventListener('click', function (e) {
var b = e.target && e.target.closest ? e.target.closest('#loginBtn') : null;
if (b && !window.__loginDirect && typeof doLogin === 'function') { try { doLogin(); } catch (err) { if (window.__silent) window.__silent(err); } }
});
document.addEventListener('keydown', function (e) {
if (e.key === 'Enter') { var ae = document.activeElement; if (ae && (ae.id === 'loginUser' || ae.id === 'loginPass') && !window.__loginDirect && typeof doLogin === 'function') { try { doLogin(); } catch (err) { if (window.__silent) window.__silent(err); } } }

if (e.key === 'Escape') {
var _open = document.querySelectorAll('.modal-mask.open');
if (!_open.length) return;
var _top = _open[_open.length - 1];
var _x = _top.querySelector('.modal-close-x[data-close], .modal-close[data-close]');
if (_x) { try { _x.click(); } catch (err) { if (window.__silent) window.__silent(err); } }
}
});

var RTE_SVG_MAX = '<svg class="rte-zoom-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
var RTE_SVG_MIN = '<svg class="rte-zoom-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>';
var PWD_EYE_OPEN_SVG = '<svg class="pwd-eye-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 5C7 5 2.73 8.11 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-3.04 0-5.5-2.46-5.5-5.5S8.96 6.5 12 6.5 17.5 8.96 17.5 12 15.04 17.5 12 17.5zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>';
var PWD_EYE_OFF_SVG = '<svg class="pwd-eye-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 5C7 5 2.73 8.11 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-3.04 0-5.5-2.46-5.5-5.5S8.96 6.5 12 6.5 17.5 8.96 17.5 12 15.04 17.5 12 17.5zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M4.47 3.06 20.94 19.53l-1.41 1.41L3.06 4.47z"/></svg>';


function sanitizeHTML(html) { return window.__sanitizeHTML ? window.__sanitizeHTML(html) : ""; }
var thumbOf = function (url) { return window.__thumbOf(url); };


function backfillCoverThumbs(list) {
try {
var seen = {};
try { (JSON.parse(localStorage.getItem('wnzyq_thumb_ok') || '[]') || []).forEach(function (u) { seen[u] = 1; }); } catch (e0) { if (window.__silent) window.__silent(e0); }
var urls = [];
(list || []).forEach(function (p) {
var u = String((p && p.img) || '');
if (/^\/img\/images\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i.test(u) && !seen[u] && urls.indexOf(u) < 0) urls.push(u);
});
if (!urls.length) return;
var markOk = function (u) {
try {
var arr = JSON.parse(localStorage.getItem('wnzyq_thumb_ok') || '[]') || [];
if (arr.indexOf(u) < 0) { arr.push(u); if (arr.length > 500) arr = arr.slice(-500); localStorage.setItem('wnzyq_thumb_ok', JSON.stringify(arr)); }
} catch (e0) { if (window.__silent) window.__silent(e0); }
};
urls.slice(0, 20).forEach(function (u) {
fetch(thumbOf(u), { method: 'HEAD', cache: 'no-store' }).then(function (r) {
if (r && r.ok) { markOk(u); return null; }
if (!r || r.status !== 404) return null;
return fetch(u, { cache: 'no-store' }).then(function (ir) { return (ir && ir.ok) ? ir.blob() : null; }).then(function (blob) {
if (!blob) return null;
return new Promise(function (resolve) {
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
c.toBlob(function (tb) { resolve(tb || null); }, 'image/webp', 0.8);
} catch (e1) { URL.revokeObjectURL(objUrl); resolve(null); }
};
im.onerror = function () { URL.revokeObjectURL(objUrl); resolve(null); };
im.src = objUrl;
});
}).then(function (tb) {
if (!tb) return null;
var fd = new FormData();
fd.append('mode', 'thumb');
fd.append('base', u.replace(/^\/img\//, ''));
fd.append('file', tb, 'thumb.webp');
return fetch('/api/admin/upload-image', { method: 'POST', body: fd, credentials: 'include' }).then(function (r2) {
if (r2 && r2.ok) markOk(u);
}).catch(function () {});
});
}).catch(function () {});
});
} catch (e) { if (window.__silent) window.__silent(e); }
}

function togglePwdVisibility() {
var pwd = document.getElementById('loginPass');
var btn = document.getElementById('pwdToggleBtn');
if (!pwd || !btn) return;
if (pwd.type === 'password') { pwd.type = 'text'; btn.innerHTML = PWD_EYE_OFF_SVG; btn.setAttribute('aria-label', '隐藏密码'); }
else { pwd.type = 'password'; btn.innerHTML = PWD_EYE_OPEN_SVG; btn.setAttribute('aria-label', '显示密码'); }
}

function toggleModalPwdVisibility(inputId, btnId) {
var pwd = document.getElementById(inputId);
var btn = document.getElementById(btnId);
if (!pwd || !btn) return;
if (pwd.type === 'password') { pwd.type = 'text'; btn.innerHTML = PWD_EYE_OFF_SVG; btn.setAttribute('aria-label', '隐藏密码'); }
else { pwd.type = 'password'; btn.innerHTML = PWD_EYE_OPEN_SVG; btn.setAttribute('aria-label', '显示密码'); }
}

window.__utcToLocal = function (ts) {
if (!ts || typeof ts !== 'string') return ts || '-';
var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(ts.trim());
if (!m) return ts;
var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + 8 * 3600 * 1000);
var p2 = function (n) { return String(n).padStart(2, '0'); };
return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds());
};

document.addEventListener('error', function (e) {
var t = e.target;
if (!t || !t.tagName) return;
if (t.tagName === 'IMG' && !t.dataset.fh && !t.dataset.lf) {
t.dataset.fh = '1';
t.src = window.WN_MEDIA_FALLBACK; if (t && t.classList) t.classList.add('media-fail');
t.style.display = 'block'; t.style.opacity = '1';
} else if (t.tagName === 'VIDEO' && !t.dataset.fh) {
t.dataset.fh = '1';
var _vu = t.getAttribute('src') || t.currentSrc || '';
var _inRte = !!(t.closest && t.closest('[contenteditable=\"true\"]'));
if (_vu) {
var vf = document.createElement('div');
vf.className = 'video-fallback';
vf.setAttribute('contenteditable', 'false');
if (_inRte) vf.setAttribute('data-vsrc', _vu);
var vl = document.createElement('a');
vl.className = 'vf-link';
vl.href = _vu; vl.target = '_blank'; vl.rel = 'noopener';
vl.textContent = '点击在新窗口播放视频';
vf.appendChild(vl);
if (_inRte) {
var vd = document.createElement('button');
vd.type = 'button'; vd.className = 'vf-del'; vd.title = '删除这个视频';
vd.setAttribute('contenteditable', 'false');
vd.innerHTML = '<svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg>';
vd.addEventListener('click', function (ev) {
ev.preventDefault(); ev.stopPropagation();
var card = vd.closest('.video-fallback');
if (card) {
var ed = card.closest('[contenteditable=\"true\"]');
card.remove();
if (ed) { try { ed.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) { if (window.__silent) window.__silent(e2); } }
}
});
vf.appendChild(vd);
}
if (t.parentNode) t.parentNode.replaceChild(vf, t);
} else if (t.parentNode) {
t.parentNode.removeChild(t);
}
}
}, true);
document.addEventListener('load', function (e) { var t = e.target; if (!t || !t.tagName || t.tagName !== 'IMG' || t.dataset.fh || t.dataset.lf) return; if (t.naturalWidth === 0 && String(t.getAttribute('src') || '').indexOf('data:') !== 0) { t.dataset.fh = '1'; t.src = window.WN_MEDIA_FALLBACK; if (t && t.classList) t.classList.add('media-fail'); t.style.display = 'block'; t.style.opacity = '1'; } }, true);
document.querySelectorAll('img').forEach(function (im) { if (im.dataset.lf) return; if (im.complete && im.naturalWidth === 0 && im.getAttribute('src') && im.getAttribute('src').indexOf('data:') !== 0) { im.dataset.fh = '1'; im.src = window.WN_MEDIA_FALLBACK; if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block'; } });

window.__adminLoggedIn = false;
var loginView = document.getElementById('loginView');
var mainView = document.getElementById('mainView');
var loginUser = document.getElementById('loginUser');
var loginPass = document.getElementById('loginPass');
var loginBtn = document.getElementById('loginBtn');
var logoutBtn = document.getElementById('logoutBtn');

var editMask = document.getElementById('editMask');
var editTitle = document.getElementById('editTitle');
var fTitle = document.getElementById('fTitle');
var fCid = document.getElementById('fCid');
var fDesc = document.getElementById('fDesc');
var fDetail = document.getElementById('fDetail');
var fImg = document.getElementById('fImg');
var fContactUrl = document.getElementById('fContactUrl');
var fPrice = document.getElementById('fPrice');
var fSort = document.getElementById('fSort');
var fOnline = document.getElementById('fOnline');
var saveProductBtn = document.getElementById('saveProductBtn');
var editCancel = document.getElementById('editCancel');
var addVariantBtn = document.getElementById('addVariantBtn');
var variantListEl = document.getElementById('variantList');

var catMask = document.getElementById('catMask');
var catModalTitle = document.getElementById('catModalTitle');
var catName = document.getElementById('catName');
var catSort = document.getElementById('catSort');
var catParentWrap = document.getElementById('catParentWrap');
var catHidden = document.getElementById('catHidden');
var catOk = document.getElementById('catOk');
var catCancel = document.getElementById('catCancel'); var catDraftPending = false, catDraftFor = null;
document.addEventListener('click', function (e) {
var btn = e.target.closest ? e.target.closest('#addCatBtn, #addAnnBtn') : null;
if (!btn) return;
if (btn.id === 'addCatBtn') { try { if (!document.getElementById('catMask').classList.contains('open')) openCatEdit(null); } catch (e) { try { document.getElementById('catMask').classList.add('open'); } catch (e2) { if (window.__silent) window.__silent(e2); } } }
else if (btn.id === 'addAnnBtn') { try { addNewAnnouncement(); } catch (e) { if (window.__silent) window.__silent(e); } }
});

var inputMask = document.getElementById('inputMask');
var inputTitle = document.getElementById('inputTitle');
var inputTip = document.getElementById('inputTip');
var inputValue = document.getElementById('inputValue');
var inputOk = document.getElementById('inputOk');
var inputCancel = document.getElementById('inputCancel');
var inputCallback = null;

function showInput(title, tip, placeholder, callback, defaultValue, uploadKind) {

try {
if (window.__adminLoggedIn !== true) { if (window.__silent) window.__silent(new Error('guard:login')); return { close: function () {} }; }
} catch (e) {}
inputTitle.textContent = title || '请输入';
inputTip.innerHTML = tip || '';
inputValue.placeholder = placeholder || '请输入内容';
inputValue.value = defaultValue || '';
inputCallback = callback;
var fileExtras = document.getElementById('fileInputExtras');
if (uploadKind === 'file') {
inputRow.classList.add('has-upload');
inputUploadBtn.textContent = '上传本地文件';
inputUploadBtn.dataset.kind = 'file';
if (fileExtras) fileExtras.style.display = 'block';
} else if (uploadKind) {
inputRow.classList.add('has-upload');
inputUploadBtn.textContent = uploadKind === 'video' ? '上传本地视频' : '上传本地图片';
inputUploadBtn.dataset.kind = uploadKind;
if (fileExtras) fileExtras.style.display = 'none';
} else {
inputRow.classList.remove('has-upload');
if (fileExtras) fileExtras.style.display = 'none';
}
inputMask.classList.add('open');
setTimeout(function () { inputValue.focus(); }, 100);
}

inputUploadBtn.addEventListener('click', function () {
var kind = inputUploadBtn.dataset.kind;
if (kind === 'file') {
var inp = document.createElement('input');
inp.type = 'file'; inp.multiple = true;
inp.addEventListener('change', function () {
var files = Array.from(inp.files || []);
var editor = __rte.editor || document.getElementById('fDetail');
processLocalFiles(files, editor, null);
});
inp.click();
return;
}
var inp = document.createElement('input');
inp.type = 'file';
if (kind === 'video') inp.accept = 'video/mp4,video/webm,video/quicktime';
else inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
inp.addEventListener('change', function () {
var f = inp.files && inp.files[0];
if (!f) return;
var _origText = inputUploadBtn.textContent;
inputUploadBtn.disabled = true;
var cancelBtn = null;

var done = function (url, note) {
inputUploadBtn.disabled = false;
if (cancelBtn && cancelBtn.parentNode) cancelBtn.parentNode.removeChild(cancelBtn);
if (url) {
inputUploadBtn.textContent = '✓ 完成';
inputUploadBtn.style.background = 'var(--green-strong)';
setTimeout(function () { inputUploadBtn.textContent = _origText; inputUploadBtn.style.background = ''; }, 1200);
inputValue.value = url;
if (note) toast(note, 'info');
inputOk.click();
} else {
inputUploadBtn.textContent = _origText;
}
};

window.__upman.run(f, kind === 'video' ? 'video' : 'file', {
onDone: function (url) { done(url); },
onFail: function () {
inputUploadBtn.disabled = false;
inputUploadBtn.textContent = _origText;
},
onCancel: function () {
inputUploadBtn.disabled = false;
inputUploadBtn.textContent = _origText;
}
});
});
inp.click();
});

var __inputBusy = false;
function _resetInputBtn() {
inputOk.disabled = false; inputOk.textContent = '确定';
__inputBusy = false;
}
window.closeInput = function () {
_resetInputBtn();
inputMask.classList.remove('open');
};
inputOk.addEventListener('click', function () {
if (__inputBusy) return;
var val = inputValue.value;
inputOk.disabled = true;
if (window.__btnBusy) window.__btnBusy(inputOk, '处理中');
__inputBusy = true;
var _timer = setTimeout(function () { _resetInputBtn(); inputMask.classList.remove('open'); }, 10000);
var _done = function () { clearTimeout(_timer); window.closeInput(); };
if (inputCallback) { var cb = inputCallback; inputCallback = null; cb(val, _done); }
});
inputCancel.addEventListener('click', function () {
if (__inputBusy) return;
try { if (window.__fcSweepEdit) window.__fcSweepEdit(inputMask); } catch (e) {}
inputMask.classList.remove('open');
inputCallback = null;
});
inputMask.addEventListener('click', function (e) {
if (__inputBusy) return;
if (e.target === this) { this.classList.remove('open'); inputCallback = null; }
});
inputValue.addEventListener('keydown', function (e) {
if (e.key === 'Enter') inputOk.click();
});

var variantMask = document.getElementById('variantMask');
var variantModalTitle = document.getElementById('variantModalTitle');
var vName = document.getElementById('vName');
var vTitle = document.getElementById('vTitle');

var vHidden = document.getElementById('vHidden');
var vContactUrl = document.getElementById('vContactUrl');
var vPrice = document.getElementById('vPrice');
var vSort = document.getElementById('vSort');
var variantOk = document.getElementById('variantOk');
var variantCancel = document.getElementById('variantCancel');

function __sanitizePriceInput(el) {
if (!el) return;
el.addEventListener('input', function () {
var v = this.value;
var hasDot = false;
var out = '';
for (var i = 0; i < v.length; i++) {
var ch = v.charAt(i);
if (ch >= '0' && ch <= '9') { out += ch; }
else if (ch === '.' && !hasDot) { out += ch; hasDot = true; }
}
if (v !== out) this.value = out;
});
}
__sanitizePriceInput(fPrice);
__sanitizePriceInput(vPrice);


var IMG_PLACEHOLDER = null;
var state = {
categories: [],
products: [],
editingId: null,
editingProduct: null,
variants: [],
editingVariantId: null,
catEditingId: null,
statsDays: 1,
catExpanded: {}, prodSelected: {}, catSelected: {},
};

function __getAdminCache() {
try { var c = JSON.parse(sessionStorage.getItem('wnzyq_admin_data') || '{}'); return c || {}; } catch (e) { return {}; }
}
function __setAdminCache(obj) {
try { sessionStorage.setItem('wnzyq_admin_data', JSON.stringify(obj)); } catch (e) { if (window.__silent) window.__silent(e); }
}
function __saveAdminState() {
__setAdminCache({
products: state.products,
categories: state.categories,
settings: state.settings || {},
statsOverview: state.statsOverview,
statsOverviewPrev: state.statsOverviewPrev,
statsTrend: state.statsTrend,
statsTrendPrev: state.statsTrendPrev,
statsDays: state.statsDays,
statByProduct: state.statByProduct,
statByCategory: state.statByCategory,
statRecent: state.statRecent,
version: state._homeVersion || '',
_cacheFormat: 'sch' + String((window.WN_CONST && window.WN_CONST.CACHE_SCHEMA) || 4),
timestamp: Date.now()
});
}


function toast(msg, type) { window.uiToast(msg, type); }
window.toast = toast;
window.showToast = window.showToast || toast;

var confirmCallback = null;
var confirmCancelCallback = null;

window.showConfirm = showConfirm;
function showConfirm(title, msg, callback, cancelCallback) {
document.getElementById('confirmTitle').textContent = title || '确认操作';
document.getElementById('confirmMsg').textContent = msg || '';
confirmCallback = callback;
confirmCancelCallback = cancelCallback || null;
try { if (window.__adminLoggedIn !== true) { if (window.__silent) window.__silent(new Error('guard:login')); return; } } catch (e0) {}
document.getElementById('confirmMask').classList.add('open');
}
var __confirmBusy = false;
function _resetConfirmBtn() {
var okBtn = document.getElementById('confirmOk');
okBtn.disabled = false; okBtn.textContent = '确定';
__confirmBusy = false;
}
window.closeConfirm = function () {
_resetConfirmBtn();
document.getElementById('confirmMask').classList.remove('open');
};
window.__maskBusyReset = function () {
try { if (__inputBusy) _resetInputBtn(); } catch (e) { if (window.__silent) window.__silent(e); }
try { if (__confirmBusy) _resetConfirmBtn(); } catch (e) { if (window.__silent) window.__silent(e); }
};
document.getElementById('confirmOk').addEventListener('click', function () {
if (__confirmBusy) return;
var okBtn = document.getElementById('confirmOk');
var _origText = okBtn.textContent;
okBtn.disabled = true;
if (window.__btnBusy) window.__btnBusy(okBtn, '处理中');
__confirmBusy = true;
var _timer = setTimeout(function () { _resetConfirmBtn(); document.getElementById('confirmMask').classList.remove('open'); }, 10000);
var _done = function () { clearTimeout(_timer); window.closeConfirm(); };
if (confirmCallback) { var cb = confirmCallback; confirmCallback = null; confirmCancelCallback = null; cb(_done); }
});
document.getElementById('confirmCancel').addEventListener('click', function () {
if (__confirmBusy) return;
document.getElementById('confirmMask').classList.remove('open');
if (confirmCancelCallback) { var cb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; cb(); }
else { confirmCallback = null; confirmCancelCallback = null; }
});
document.getElementById('confirmMask').addEventListener('click', function (e) {
if (__confirmBusy) return;
if (e.target === this) {
this.classList.remove('open');
if (confirmCancelCallback) { var cb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; cb(); }
else { confirmCallback = null; confirmCancelCallback = null; }
}
});

(function () { window.__syncBodyLock = function () {}; window.__syncBodyLock(); })();
(function () {
function _r(){ document.querySelectorAll('.rte-editor.rte-large').forEach(function(e){ e.classList.remove('rte-large'); e.style.top=''; e.style.height=''; }); document.querySelectorAll('.rte-toolbar-large').forEach(function(e){ e.classList.remove('rte-toolbar-large'); }); document.querySelectorAll('.rte-zoom-on').forEach(function(e){ e.classList.remove('rte-zoom-on'); e.innerHTML=RTE_SVG_MAX; }); document.body.classList.remove('rte-zooming'); if(window.__rteRO&&window.__rteRO.disconnect){ try{ window.__rteRO.disconnect(); }catch (e) { if (window.__silent) window.__silent(e); } } }
window.__resetRteAll=_r;
['editMask','variantMask','annMask'].forEach(function(id){
var m = document.getElementById(id); if (!m) return;
new MutationObserver(function(){ if (!m.classList.contains('open')) _r(); }).observe(m, { attributes: true, attributeFilter: ['class'] });
});
})();
(function () {
var DRAFT_KEY = 'wnzyq_editing_draft';
window.__isEditing = function () {
if (document.getElementById('editMask') && document.getElementById('editMask').classList.contains('open')) return true;
if (document.getElementById('variantMask') && document.getElementById('variantMask').classList.contains('open')) return true;
if (document.getElementById('annMask') && document.getElementById('annMask').classList.contains('open')) return true;
return false;
};
window.__saveEditingDraft = function () {
try {
var drafts = [];
if (document.getElementById('annMask') && document.getElementById('annMask').classList.contains('open')) {
try { if (typeof flushAnnEdit === 'function') flushAnnEdit(); } catch (e) { if (window.__silent) window.__silent(e); }
var _ac = stateAnn && stateAnn.curId ? stateAnn.list.find(function (x) { return x.id === stateAnn.curId; }) : null;
drafts.push({ type: 'ann', curId: stateAnn ? stateAnn.curId : null, list: stateAnn ? JSON.parse(JSON.stringify(stateAnn.list)) : null, mode: document.getElementById('annMode') ? document.getElementById('annMode').value : null });
}
if (document.getElementById('editMask') && document.getElementById('editMask').classList.contains('open')) {
try { if (typeof saveDraft === 'function') saveDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
drafts.push({ type: 'edit', data: __editDrafts ? JSON.parse(JSON.stringify(__editDrafts)) : null });
}
if (document.getElementById('variantMask') && document.getElementById('variantMask').classList.contains('open')) {

var _ve = document.getElementById('vDescEditor');
drafts.push({ type: 'variant', id: (typeof state !== 'undefined' && state.editingVariantId) || null, name: document.getElementById('vName') ? document.getElementById('vName').value : '', title: document.getElementById('vTitle') ? document.getElementById('vTitle').value : '', desc: _ve ? _ve.innerHTML : '' });
}

if (drafts.length) localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), drafts: drafts }));
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.__restoreEditingDraft = function () {
try {
var raw = localStorage.getItem(DRAFT_KEY); if (!raw) return false;
var pkg = JSON.parse(raw); if (!pkg || !pkg.drafts || !pkg.drafts.length) return false;
if (pkg.savedAt && (Date.now() - pkg.savedAt) > 30 * 60 * 1000) {
localStorage.removeItem(DRAFT_KEY); return false;
}
localStorage.removeItem(DRAFT_KEY);
var restored = false;
pkg.drafts.forEach(function (d) {
if (d.type === 'ann' && typeof stateAnn !== 'undefined' && stateAnn && d.list) {
stateAnn.list = d.list; stateAnn.loaded = true; stateAnn.curId = d.curId || null;
stateAnn._draftRestored = true;
stateAnn._skipNextFlush = true;
if (d.mode && document.getElementById('annMode')) { document.getElementById('annMode').value = d.mode; try { syncSelectDisplay(document.getElementById('annMode')); } catch (e) { if (window.__silent) window.__silent(e); } }
restored = true;
}
if (d.type === 'edit' && __editDrafts && d.data) {
Object.keys(d.data).forEach(function (k) { __editDrafts[k] = d.data[k]; });
restored = true;
}
if (d.type === 'variant' && d.id !== undefined) {
try { localStorage.setItem('wnzyq_variant_draft', JSON.stringify(d)); } catch (e) { if (window.__silent) window.__silent(e); }
restored = true;
}

});
if (restored) setTimeout(function () { try { toast('已恢复你编辑中的内容', 'info', 'info', 3000); } catch (e) { if (window.__silent) window.__silent(e); } }, 600);
return restored;
} catch (e) { try { localStorage.removeItem(DRAFT_KEY); } catch (e2) { if (window.__silent) window.__silent(e2); } return false; }
};
window.__clearEditingDraft = function () {
try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem('wnzyq_variant_draft'); } catch (e) { if (window.__silent) window.__silent(e); }
};
})();
document.addEventListener('click', function (e) {
var closeBtn = e.target.closest('.modal-close-x, .modal-close[data-close]');
if (closeBtn && closeBtn.dataset.close) {
var mask = document.getElementById(closeBtn.dataset.close);
if (closeBtn.dataset.close === 'editMask') { try { clearDraft(); } catch (e) { if (window.__silent) window.__silent(e); } }
if (closeBtn.dataset.close === 'catMask') { catDraftPending = false; catDraftFor = null; }
if (closeBtn.dataset.close === 'variantMask') { variantDraftPending = false; variantDraftFor = null; }
if (closeBtn.dataset.close === 'annMask') { try { window.__annDiscard(); } catch (e) { if (window.__silent) window.__silent(e); } }

if (closeBtn.dataset.close === 'pwdMask') { var _o=document.getElementById('oldPwd'),_n=document.getElementById('newPwd'),_c=document.getElementById('confirmPwd'); if(_o)_o.value=''; if(_n)_n.value=''; if(_c)_c.value=''; }
if (mask) {
mask.classList.remove('open');
if (closeBtn.dataset.close === 'inputMask') { if (__inputBusy) return; inputCallback = null; try { var _iv = document.getElementById('inputValue'); if (_iv) _iv.value = ''; } catch (e) { if (window.__silent) window.__silent(e); } }
if (closeBtn.dataset.close === 'confirmMask') { if (__confirmBusy) return; if (confirmCancelCallback) { var _ccb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; _ccb(); } else { confirmCallback = null; confirmCancelCallback = null; } }
}
}
});


(function checkSessionExp() {
try {
var lat = localStorage.getItem('wnzyq_login_at');
if (lat) {
var elapsed = Date.now() - Number(lat);
var twentyThreeHours = 23 * 60 * 60 * 1000;
var twentyFourHours = 24 * 60 * 60 * 1000;
if (elapsed >= twentyThreeHours && elapsed < twentyFourHours) {
toast('登录即将过期，请提前保存工作', 'warning');
}
}
} catch (e) { if (window.__silent) window.__silent(e); }
setTimeout(checkSessionExp, 10 * 60 * 1000);
})();
if (!window.lockBodyScroll) {
window.lockBodyScroll = function (lock) {
if (lock) { document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden'; }
else { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; }
};
window.syncBodyLock = function () { window.lockBodyScroll(document.body.style.overflow === 'hidden'); };
}
var __apiInFlight = new Map();
function api(path, opts) {
opts = opts || {};

return window.WNApi.request('/api/' + path, {
method: opts.method, body: opts.body, cache: opts.cache,
headers: { 'Content-Type': 'application/json' },
credentials: 'include', timeout: opts.timeout || 15000,
on401: function () {
try {
if (mainView && mainView.style.display !== 'none') {
toast('登录已过期，请重新登录', 'error');
setTimeout(function () { location.reload(); }, 1200);
}
} catch (e) { if (window.__silent) window.__silent(e); }
}
}).then(function (d) {
if (d && d.ok === false && window.__maskBusyReset) { try { window.__maskBusyReset(); } catch (e) { if (window.__silent) window.__silent(e); } }
return d;
});
}

function clearCache() {
api('admin/clear-cache', { method: 'POST' }).catch(function () {});
__adminProductCache = {};
__adminProductCacheLoading = {};
}

function __issueCode(vObj, redraw) {
if (!vObj || !vObj.id) { toast('参数错误：缺少资源类型', 'error'); if (redraw) { try { redraw(); } catch (e) { if (window.__silent) window.__silent(e); } } return; }
if (window.__issueInFlight) return;
window.__issueInFlight = true;
api('admin/issue-code', { method: 'POST', body: JSON.stringify({ variantId: vObj.id }) }).then(function (res) {
window.__issueInFlight = false;
if (res && res.ok) {
var ok = window.__shareCopyText ? window.__shareCopyText(res.issuedCode) : false;
vObj.resourceCode = res.code;
(state.products || []).forEach(function (p) {
(p.variants || []).forEach(function (vv) { if (vv && vv.id === vObj.id) { vv.resourceCode = res.code; } });
});
(state.variants || []).forEach(function (vv) { if (vv && vv.id === vObj.id) { vv.resourceCode = res.code; } });
try {
var _cps = document.querySelectorAll('.code-picker');
for (var _i = 0; _i < _cps.length; _i++) {
var _cp = _cps[_i];
if (_cp.__renderCodePanel && _cp.__product && _cp.__product.variants) {
try { _cp.__renderCodePanel(_cp.__product.variants); } catch (e0) { if (window.__silent) window.__silent(e0); }
}
}
} catch (e1) { if (window.__silent) window.__silent(e1); }
if (redraw) { try { redraw(); } catch (e) { if (window.__silent) window.__silent(e); } }
toast(ok ? '新码已生成；旧码已复制，60 天内兑换有效（绑定后设备永久可用）'
: '新码已生成（复制旧码失败，请手动复制：' + res.issuedCode + '）', 'success');
} else {
if (redraw) { try { redraw(); } catch (e) { if (window.__silent) window.__silent(e); } }
toast((res && res.msg) || '发码失败', 'error');
}
}).catch(function () {
window.__issueInFlight = false;
if (redraw) { try { redraw(); } catch (e) { if (window.__silent) window.__silent(e); } }
toast('发码失败：网络错误', 'error');
});
}
function initStatsFilterBar() { var _g = document.querySelector('#panel-stats .time-filter'); var _wrap = _g && _g.parentNode; var _card = document.getElementById('statCards'); if (_wrap && _card && _wrap.parentNode) { var _bar = document.createElement('div'); _bar.id = 'statsFilterBar'; _bar.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 14px;background:var(--card-bg,#fff);border-radius:10px; /* v293（用户 10-04 02:14）：054圆角统一→12px不在5档阶梯，改10px跟全站普通按钮/卡片统一 */ padding:12px 16px;box-shadow:var(--shadow-card);'; while (_wrap.firstChild) _bar.appendChild(_wrap.firstChild); _wrap.parentNode.removeChild(_wrap); _card.parentNode.insertBefore(_bar, _card.nextSibling); }
}

var dtTarget = null;
(function initDateTimePicker() {
var pop = document.createElement('div');
pop.className = 'dt-pop';
pop.id = 'dtPop';
pop.innerHTML =
'<div class="dt-row">' +
'<input type="date" id="dtDate" />' +
'<input type="time" id="dtTime" value="00:00" />' +
'</div>' +
'<div class="dt-btns">' +
'<button type="button" class="dt-now" id="dtNow">当前</button>' +
'<button type="button" class="dt-ok" id="dtOk">确定</button>' +
'<button type="button" id="dtClear">清除</button>' +
'</div>';
document.body.appendChild(pop);
var dInput = pop.querySelector('#dtDate');
var tInput = pop.querySelector('#dtTime');
function pad(n) { return String(n).padStart(2, '0'); }
function nowParts() {
var d = new Date();
return { date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), time: pad(d.getHours()) + ':' + pad(d.getMinutes()) };
}
function openPicker(field) {
dtTarget = field;
var isDateOnly = field.getAttribute('data-dt') === 'date';
tInput.style.display = isDateOnly ? 'none' : '';
var cur = field.value || '';
if (cur) {
dInput.value = cur.slice(0, 10);
if (!isDateOnly) tInput.value = (cur.slice(11, 16) || '00:00');
} else {
var n = nowParts(); dInput.value = n.date; tInput.value = isDateOnly ? '00:00' : n.time;
}
var r = field.getBoundingClientRect();
pop.classList.add('open');
var pw = pop.offsetWidth || 300, ph = pop.offsetHeight || 130;

function __vv() { var v = window.visualViewport; return v ? { w: Math.round(v.width), h: Math.round(v.height), t: Math.round(v.offsetTop), l: Math.round(v.offsetLeft) } : { w: window.innerWidth, h: window.innerHeight, t: 0, l: 0 }; }
var vv = __vv();
var left = Math.min(r.left, vv.l + vv.w - pw - 8);
var top = r.bottom + 6;
if (top + ph > vv.t + vv.h) top = r.top - ph - 6;
left = Math.min(Math.max(left, vv.l + 8), vv.l + vv.w - pw - 8);
top = Math.min(Math.max(top, vv.t + 8), vv.t + vv.h - ph - 8);
pop.style.left = left + 'px';
pop.style.top = top + 'px';
if (!pop.__vvBound) {
pop.__vvBound = true;
var __re = function () { if (pop.classList.contains('open') && dtTarget && dtTarget.isConnected) openPicker(dtTarget); };
window.addEventListener('resize', __re);
if (window.visualViewport) window.visualViewport.addEventListener('resize', __re);
window.addEventListener('scroll', __re, true);
}

requestAnimationFrame(function () { requestAnimationFrame(function () { if (pop.classList.contains('open') && dtTarget && dtTarget.isConnected) openPicker(dtTarget); }); });
setTimeout(function () { if (pop.classList.contains('open') && dtTarget && dtTarget.isConnected) openPicker(dtTarget); }, 320);
}
function closePicker() { pop.classList.remove('open'); dtTarget = null; }
function commit() {
if (!dtTarget) return;
var isDateOnly = dtTarget.getAttribute('data-dt') === 'date';
var val = dInput.value || '';
if (val && !isDateOnly) val += ' ' + (tInput.value || '00:00');
dtTarget.value = val;
dtTarget.dispatchEvent(new Event('input', { bubbles: true }));
dtTarget.dispatchEvent(new Event('change', { bubbles: true }));
closePicker();
}
document.addEventListener('click', function (e) {
var field = e.target.closest ? e.target.closest('.dt-field') : null;
if (field) { e.preventDefault(); openPicker(field); return; }
if (!e.target.closest('#dtPop')) closePicker();
});
pop.querySelector('#dtNow').addEventListener('click', function () {
var n = nowParts(); dInput.value = n.date;
if (dtTarget && dtTarget.getAttribute('data-dt') !== 'date') tInput.value = n.time;
});
pop.querySelector('#dtClear').addEventListener('click', function () {
if (dtTarget) { dtTarget.value = ''; dtTarget.dispatchEvent(new Event('change', { bubbles: true })); }
closePicker();
});
pop.querySelector('#dtOk').addEventListener('click', commit);
window.addEventListener('resize', closePicker);
document.addEventListener('focusin', function (e) { var f = e.target && e.target.closest ? e.target.closest('.dt-field') : null; if (f) openPicker(f); });
})();

(function () {
var nav = document.querySelector('#mainView .topbar');
var lastY = window.scrollY || 0, ticking = false;
function onScroll() {
var y = window.scrollY || 0;
if (nav) nav.classList.remove('nav-hidden');
if (backBtn) backBtn.classList.toggle('show', y > 320);
lastY = y; ticking = false;
}
window.addEventListener('scroll', function () {
if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
var backBtn = document.createElement('button');
backBtn.type = 'button';
backBtn.className = 'back-top';
backBtn.setAttribute('aria-label', '回到顶部');
backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 14l5-5 5 5z"/></svg>';
backBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
document.body.appendChild(backBtn);
})();

window.__pullRefresh = {
refresh: function (done) {
var loginVisible = document.getElementById('loginView') && document.getElementById('loginView').style.display !== 'none';
if (loginVisible) {
setTimeout(function () { location.reload(); }, 400); return;
}
try { if (typeof clearCache === 'function') clearCache(); } catch (e) { if (window.__silent) window.__silent(e); }
var t = (function () { var x = document.querySelector('.tab.active'); return x ? x.dataset.tab : 'products'; })();

if (window.__enterPageEntryMode) window.__enterPageEntryMode();
var _rp = [];
if (t === 'products' && typeof loadProducts === 'function') _rp.push(loadProducts().catch(function () {}));
else if (t === 'stats' && typeof loadStats === 'function') _rp.push(loadStats(undefined, undefined, 1).catch(function () {}));
else if (t === 'categories' && typeof loadCategories === 'function') _rp.push(loadCategories().catch(function () {}));
else if (t === 'settings' && typeof loadSettings === 'function') _rp.push(loadSettings().catch(function () {}));
Promise.all(_rp).then(function () {
if (window.__exitPageEntryMode) window.__exitPageEntryMode();
if (done) done();
}).catch(function () {
if (window.__exitPageEntryMode) window.__exitPageEntryMode();
if (done) done();
});
}
};

document.querySelectorAll('.tab').forEach(function (tab) {
if (!tab.dataset || !tab.dataset.tab) return;
tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
});

function switchTab(name) {

try { document.querySelectorAll('.tab[data-tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === name)); }); } catch (e) { if (window.__silent) window.__silent(e); }

try {
var __cur = document.querySelector('.tab.active');
if (__cur && __cur.dataset.tab) { window.__tabScroll = window.__tabScroll || {}; window.__tabScroll[__cur.dataset.tab] = window.scrollY || 0; }
} catch (e) {}

try {
if (window.__catSkelHTML == null) {
var _cs = document.getElementById('catList');
var _cr = _cs && _cs.querySelector('.cat-row.admin-skel');
window.__catSkelHTML = _cr ? _cr.outerHTML : '';
}
} catch (e) { if (window.__silent) window.__silent(e); }
document.querySelectorAll('.tab').forEach(function (t) {
t.classList.toggle('active', t.dataset.tab === name);
});
document.getElementById('panel-products').style.display = name === 'products' ? '' : 'none';
document.getElementById('panel-stats').style.display = name === 'stats' ? '' : 'none';
document.getElementById('panel-categories').style.display = name === 'categories' ? '' : 'none';
document.getElementById('panel-settings').style.display = name === 'settings' ? '' : 'none';

var __pv = document.getElementById('panel-' + name);

try { if (window.__fsTabLineUpdate) window.__fsTabLineUpdate(true); } catch (e) {}

try {
var __sv = (window.__tabScroll || {})[name];
window.scrollTo(0, (typeof __sv === 'number' && __sv > 0) ? __sv : 0);
} catch (e) {}
if (name === 'products') {
if (!window.__plP) { window.__plP = 1; loadProducts(); }
else { loadProducts(true).catch(function () {}); }
}
if (name === 'stats') {
if (!window.__plS) { window.__plS = 1; loadStats(); }
else { loadStats(undefined, undefined, 1, 1).catch(function () {}); }
}
if (name === 'stats') { try { if (window.__rerenderLine) window.__rerenderLine(); } catch (e) { if (window.__silent) window.__silent(e); } }
if (name === 'categories') {

try {
var _cb0 = document.getElementById('catList');
if (_cb0 && !_cb0.querySelector('.cat-row:not(.admin-skel)') && !_cb0.querySelector('.admin-skel')) {
if (window.__catSkelHTML == null) window.__catSkelHTML = '';
if (window.__catSkelHTML) _cb0.innerHTML = window.__catSkelHTML.repeat(8);
}
} catch (e) { if (window.__silent) window.__silent(e); }
if (!window.__plC) { window.__plC = 1; loadCategories(); }
else { loadCategories(true).catch(function () {}); }
}
if (name === 'settings') { if (!window.__plSet) loadSettings(); }
}



window.__fsTabLineUpdate = function (anim) {
var tabs = document.querySelector('.tabs');
if (!tabs) return;
var act = tabs.querySelector('.tab.active');
var line = window.__fsTabLine;
if (!line || !line.parentNode) { line = document.createElement('div'); line.className = 'tabs-line'; tabs.appendChild(line); window.__fsTabLine = line; }
if (!act) { line.style.opacity = '0'; return; }
line.style.transition = anim ? 'left .2s var(--ease-out, ease), width .2s var(--ease-out, ease)' : 'none';
line.style.left = act.offsetLeft + 'px';
line.style.width = act.offsetWidth + 'px';
line.style.opacity = '1';
};
window.__fsTabLineTo = function (fromEl, toEl, p) {
var line = window.__fsTabLine;
if (!line || !fromEl || !toEl) return;
line.style.transition = 'none';
line.style.left = (fromEl.offsetLeft + (toEl.offsetLeft - fromEl.offsetLeft) * p) + 'px';
line.style.width = (fromEl.offsetWidth + (toEl.offsetWidth - fromEl.offsetWidth) * p) + 'px';
line.style.opacity = '1';
};
try {
window.__fsTabLineUpdate(false);
window.addEventListener('resize', function () { window.__fsTabLineUpdate(false); });
} catch (e) { if (window.__silent) window.__silent(e); }
window.__followSwipe({
panel: function () {
var t = document.querySelector('.tab.active');
var n = t && t.dataset.tab;
return n ? document.getElementById('panel-' + n) : null;
},
neighbor: function (dir) {
var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[data-tab]'));
if (!tabs.length) return null;
var cur = -1;
tabs.forEach(function (t, i) { if (t.classList.contains('active')) cur = i; });
var ni = (cur === -1) ? (dir > 0 ? 0 : tabs.length - 1) : cur + dir;
if (ni < 0 || ni >= tabs.length) return null;
return { name: tabs[ni].dataset.tab };
},
fill: function (nb, dir, panelB) {
var el = document.getElementById('panel-' + nb.name);
if (!el) return;
var c = el.cloneNode(true);
c.style.display = '';
panelB.appendChild(c);
},
onProgress: function (p, dir, nb) {
var tabs = document.querySelector('.tabs');
var from = tabs && tabs.querySelector('.tab.active');
var to = tabs && tabs.querySelector('.tab[data-tab="' + nb.name + '"]');
if (from && to && to !== from) window.__fsTabLineTo(from, to, p);
},
onEnd: function () { window.__fsTabLineUpdate(true); },
commit: function (dir) {
var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[data-tab]'));
var cur = -1;
tabs.forEach(function (t, i) { if (t.classList.contains('active')) cur = i; });
var ni = cur + dir;
if (ni < 0 || ni >= tabs.length) return;
switchTab(tabs[ni].dataset.tab);
},
isActive: function () { return !document.querySelector('.modal-mask.open'); }
});

function loadSettings() {
return api('admin/settings').then(function (res) {
if (!res.ok) { toast(res.msg || '加载失败，网络开小差了', 'error'); return; }
var s = res.settings || {};
window.__plSet = 1; if (window.__infoApply) window.__infoApply(s);
if (typeof stateAnn !== 'undefined' && stateAnn) {
var _annMaskOpen = document.getElementById('annMask').classList.contains('open');
if (!_annMaskOpen) document.getElementById('setAnnouncement').innerHTML = sanitizeHTML(s.announcement || '');
if (_annMaskOpen && typeof flushAnnEdit === 'function') flushAnnEdit();

stateAnn.raw = window.parseAnnouncements(s, { sortLevel: true });
stateAnn.list = stateAnn.raw.filter(function (x) { return !x.deleted; });
if (_annMaskOpen && stateAnn.curId) {
var _still = stateAnn.list.find(function (x) { return x.id === stateAnn.curId; });
if (!_still) { var _dlx = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; if (_dlx) stateAnn.curId = _dlx.id; else stateAnn.curId = null; }
}
stateAnn.loaded = true;
if (_annMaskOpen) { try { if (typeof renderAnnList === 'function') renderAnnList(); if (stateAnn.curId && typeof selectAnnItem === 'function') selectAnnItem(stateAnn.curId); else if (typeof clearAnnEdit === 'function') clearAnnEdit(); } catch (e) { if (window.__silent) window.__silent(e); } }
} else {
document.getElementById('setAnnouncement').innerHTML = sanitizeHTML(s.announcement || '');
}

document.getElementById('annMode').value = s.announcement_mode || 'always';
if (window.__annModeHint) setTimeout(window.__annModeHint, 0);
syncSelectDisplay(document.getElementById('annMode'));
if (typeof stateAnn !== 'undefined' && stateAnn) stateAnn._modeSaved = s.announcement_mode || 'always';
state.settings = s;
__saveAdminState();
});
}




document.getElementById('selectAll').addEventListener('change', function () {
var checked = this.checked;
document.querySelectorAll('.row-check').forEach(function (cb) { cb.checked = checked; state.prodSelected[Number(cb.dataset.id)] = checked; });
updateBatchBar();
});
document.querySelectorAll('.batch-btn').forEach(function (btn) {

var __ic = { online: 'show', offline: 'hide', changeCat: 'cat', changePrice: 'code', delete: 'del', clearSel: 'close' }[btn.dataset.action];
if (__ic && window.__decorateBtn) window.__decorateBtn(btn, __ic, btn.dataset.pri || 5);
btn.addEventListener('click', function () { batchAction(this.dataset.action); });
});

setTimeout(function () { if (window.__btnFit) window.__btnFit(); }, 100);

var currentView = localStorage.getItem('wnzyq_admin_product_view') || 'list';

function setView(view) {
currentView = view;
localStorage.setItem('wnzyq_admin_product_view', view);
var listBtn = document.getElementById('viewListBtn');
var cardBtn = document.getElementById('viewCardBtn');
var productList = document.getElementById('productList');
if (view === 'card') {
listBtn.classList.remove('active');
cardBtn.classList.add('active');
productList.classList.add('card-view');
triggerViewAnim(productList);
} else {
listBtn.classList.add('active');
cardBtn.classList.remove('active');
productList.classList.remove('card-view');
triggerViewAnim(productList);
}
}

var __adminFlipper = null;
function flipSetAdminView(view) {
window.flipViewSwitch('productList', view, {
btnA: 'viewCardBtn', btnB: 'viewListBtn',
flipperKey: '__adminFlipper',
viewClass: 'card-view', viewA: 'card',
storageKey: 'wnzyq_admin_product_view',
fallbackFn: setView,
triggerAnim: triggerViewAnim,
onChange: function (v) { currentView = v; }
});
}
document.getElementById('viewListBtn').addEventListener('click', function () { flipSetAdminView('list'); });
document.getElementById('viewCardBtn').addEventListener('click', function () { flipSetAdminView('card'); });
setView(currentView);
try { initStatsFilterBar(); } catch (e) { if (window.__silent) window.__silent(e); }
(function () {
var cRows = document.getElementById('statCatRows');
var dRows = document.getElementById('statRows');
if (cRows && dRows) {
var cw = cRows.closest('.stat-table-wrap');
var dw = dRows.closest('.stat-table-wrap');
if (cw && dw && cw.parentNode && dw.parentNode === cw.parentNode && dw.nextElementSibling === cw) {
cw.parentNode.insertBefore(dw, cw);
}
}
})();

window.__loginDirect = true; window.doLogin = doLogin;
loginPass.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

function doLogin() {
if (loginBtn.disabled) return;
var u = loginUser.value.trim();
var p = loginPass.value;
if (!u || !p) { toast('请输入账号和密码', 'error'); return; }
loginBtn.disabled = true;
if (window.__btnBusy) window.__btnBusy(loginBtn, '登录中');
api('admin/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })
.then(function (res) {
if (res && res.ok) {
try { localStorage.setItem('wnzyq_last_user', u); } catch (e) { if (window.__silent) window.__silent(e); }
if (window.__haptic) window.__haptic();
try { showMain(res.username); window.__applyMe(res.username); }
catch (e) { setTimeout(function () { location.reload(); }, 300); }
} else {
var _local = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if (_local) { toast(window.T('netFail'), 'error'); }
else if (res._status === 429) { var waitMin = res && res.retryAfter ? Math.ceil(res.retryAfter / 60) : 10;
toast('尝试次数过多，请 ' + waitMin + ' 分钟后再试', 'error'); }
else { toast('登录失败：' + (res.msg || window.T('netFail')), 'error'); }
}
})
.finally(function () {
loginBtn.disabled = false;
loginBtn.textContent = '登录';
});
}

window.__applyMe = function (username) {
try {
api('admin/session').then(function (s) {
if (!s || !s.ok) return;
window.__me = { username: s.username || username, role: s.role || 'super', perms: s.perms || {} };
try { window.__applyPermUI(); } catch (e2) { if (window.__silent) window.__silent(e2); }
}).catch(function () {});
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.__permCan = function (action) {
var me = window.__me;
if (!me) return true;
if (me.role === 'super') return true;
var p = me.perms || {};
if (action === 'users') return !!p.users;
var dot = String(action).indexOf('.');
if (dot < 0) return false;
var g = p[String(action).slice(0, dot)];
return !!(g && g[String(action).slice(dot + 1)]);
};
window.__denyMsg = '该功能未开放';
window.__applyPermUI = function () {
var me = window.__me; if (!me) return;
var tabs = document.querySelectorAll('.tab[data-tab]');
var map = { products: 'products.view', categories: 'cats.view', stats: 'data.stats' };
var hasSettings = me.role === 'super';
tabs.forEach(function (t) {
var name = t.getAttribute('data-tab');
if (name === 'settings') { t.style.display = hasSettings ? '' : 'none'; return; }
var act = map[name];
if (act) t.style.display = window.__permCan(act) ? '' : 'none';
});

Array.prototype.forEach.call(document.querySelectorAll('[data-perm]'), function (el) {
var allowed = window.__permCan(el.getAttribute('data-perm'));
if (!allowed) {
if (el.style.display !== 'none') { el.setAttribute('data-perm-hid', el.style.display || ''); el.style.display = 'none'; }
} else if (el.hasAttribute('data-perm-hid')) {
el.style.display = el.getAttribute('data-perm-hid');
el.removeAttribute('data-perm-hid');
}
});

var active = document.querySelector('.tab.active');
if (active && active.style.display === 'none') {
var first = document.querySelector('.tab[data-tab]:not([style*="none"])');
if (first) first.click();
}
};

document.addEventListener('click', function (e) {
var el = e.target.closest && e.target.closest('[data-perm]');
if (!el) return;
if (window.__permCan(el.getAttribute('data-perm'))) return;
e.stopPropagation(); e.preventDefault();
if (window.showToast) window.showToast(window.__denyMsg || '该功能未开放', 'info');
}, true);


document.addEventListener('keydown', function (e) {
try {
var tag = (e.target.tagName || '').toLowerCase();
if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
if (e.ctrlKey || e.altKey || e.metaKey) return;
var onProducts = document.querySelector('.tab[data-tab="products"]') && document.querySelector('#panel-products') && document.getElementById('panel-products').style.display !== 'none';
if (!onProducts) return;
if (e.key === 'n' || e.key === 'N') { var ab = document.querySelector('.tb-row2 .g-add button, #addBtn'); if (ab) { ab.click(); e.preventDefault(); } }
if (e.key === '/') { var sb = document.getElementById('adminSearch'); if (sb) { sb.focus(); e.preventDefault(); } }
} catch (e6) { if (window.__silent) window.__silent(e6); }
});

(function () {
var ft = document.getElementById('fTitle');
if (!ft) return;
ft.addEventListener('change', function () {
try {
var v = (ft.value || '').trim();
if (!v || !window.state || !window.state.products) return;
var dup = window.state.products.some(function (x) { return x && (x.title || '').trim() === v; });
if (dup && window.showToast) window.showToast('已存在同名资源，请确认是否重复添加', 'info');
} catch (e0) { if (window.__silent) window.__silent(e0); }
});
})();
