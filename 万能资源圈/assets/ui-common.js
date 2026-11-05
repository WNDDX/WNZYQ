window.__COPY = window.__COPY || {
netFail: '网络没连上，稍后再试',
upFail: '上传失败，请重试',
delFail: '删除失败，请重试',
saveFail: '保存失败，请重试',
needRefresh: '页面需要刷新后再试',
saved: '已保存',
deleted: '已删除',
restored: '已恢复',
copied: '链接已复制',
loading: '正在读取…',
noData: '该列表暂无内容',
pickCatFirst: '请选择资源分类'
};

window.__frag = window.__frag || {

modalHead: function (title, aria) {
return '<button type="button" class="modal-close-x" aria-label="关闭" data-x="1">'
+ '<svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>'
+ '<h2 class="modal-title">' + (title || '') + '</h2>';
},

footer2: function (primaryId, primaryText, closeText) {
return '<div class="modal-footer"><button type="button" class="btn-blue btn-inline" id="' + primaryId + '">'
+ (primaryText || '确定') + '</button><button type="button" class="modal-close" data-x="1">'
+ (closeText || '关闭') + '</button></div>';
}
};

window.T = window.T || function (key, vars) {
var s = (window.__COPY && window.__COPY[key]) || key;
if (vars) Object.keys(vars).forEach(function (k) { s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); });
return s;
};



window.__silent = window.__silent || function (e, tag) {
try { if (/(?:^|[?&])debug=1/.test(location.search)) console.warn('[silent]' + (tag ? ' ' + tag : ''), e); } catch (x) {}

try { window.__errLog = window.__errLog || []; window.__errLog.push({ t: Date.now(), kind: 'silent', msg: String((e && e.message) || e).slice(0, 300) }); if (window.__errLog.length > 20) window.__errLog.shift(); } catch (x2) {}
};


window.WN_CONST = window.WN_CONST || { TIMEOUT: 10000, UNDO_MS: 10000, PAGE_SIZE: 20, ADMIN_PAGE_SIZE: 20, IMG_RETRIES: 3, CACHE_SCHEMA: 4 };


(function () {
try {
if (document.getElementById('wn-sprite')) return;
var host = document.body || document.documentElement;
if (!host) return;
var box = document.createElement('div');
box.id = 'wn-sprite';
box.setAttribute('aria-hidden', 'true');
box.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">'
+ '<symbol id="wn-ico-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></symbol>'
+ '<symbol id="wn-ico-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></symbol>'
+ '</svg>';
host.insertBefore(box, host.firstChild);
} catch (e) {}
})();

window.WNApi = (function () {
var inflight = new Map();
function buildUrl(path) {
if (/^https?:/i.test(path)) return path;
if (path.charAt(0) === '/') return path;
return '/api/' + path;
}
function request(path, opts) {
opts = opts || {};
var url = buildUrl(path);
var method = (opts.method || 'GET').toUpperCase();
var isGet = method === 'GET';
var cfg = window.WN_CONST || {};
var timeout = opts.timeout || cfg.TIMEOUT || 10000;
var fopts = { method: method, credentials: opts.credentials || 'include' };
var headers = opts.headers || {};
if (method !== 'GET' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
fopts.headers = headers;
if (opts.body) fopts.body = opts.body;
if (opts.cache) fopts.cache = opts.cache;
var key = url + '|' + (opts.body || '');
if (inflight.has(key)) return inflight.get(key);
function once(isRetry) {
return Promise.race([
fetch(url, fopts),
new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, timeout); })
]).then(function (r) {
if (opts.raw) return r;
var ct = r.headers.get('content-type') || '';
if (r.status >= 400 && ct.indexOf('application/json') === -1) {
return { ok: false, msg: window.T('netFail'), _status: r.status };
}
return r.json().then(function (d) {
if (d && typeof d === 'object') d._status = r.status;
if (r.status === 401 && opts.on401) { try { opts.on401(); } catch (e) { if (window.__silent) window.__silent(e); } }
return d;
}).catch(function () {
return r.status === 204 ? { ok: true, _status: 204 } : { ok: false, msg: window.T('netFail'), _status: r.status };
});
}).catch(function (e) {
if (isGet && !isRetry) return once(true);
if (opts.throwOnError) throw e;
var msg = (e && e.message === 'timeout') ? window.T('netFail') : window.T('netFail');
return { ok: false, msg: msg, _net: true };
});
}
var p = once(false).then(function (d) { inflight.delete(key); return d; }, function (e) { inflight.delete(key); throw e; });
inflight.set(key, p);
return p;
}
return { request: request };
})();

function escapeHtml(text) {
if (!text) return '';
return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;


window.__uiCommonLoaded = true;





if ('serviceWorker' in navigator) {
window.addEventListener('load', function () {
navigator.serviceWorker.register('/sw.js').then(function (reg) {
try { reg.update(); } catch (e) { if (window.__silent) window.__silent(e); }
var _swReloaded = false;
navigator.serviceWorker.addEventListener('controllerchange', function () {
if (_swReloaded) return;
_swReloaded = true;
try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }

try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
});
}).catch(function () {});
});
}


(function () {
'use strict';

var KF_QR_FAIL_LIGHT = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E';
var KF_QR_FAIL_DARK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" fill="%232b3a4c"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%2355697f"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%2355697f"/%3E%3C/svg%3E';
function KF_QRF() { return document.documentElement.getAttribute('data-theme') === 'dark' ? KF_QR_FAIL_DARK : KF_QR_FAIL_LIGHT; }


var __KF_EXCLUDE_SEL = '.kf-box, .kf-mask, #kfFallback, .modal-mask, .ann-modal, .share-mask, .lightbox, .stat-modal';
var __kfHiddenVideos = [];
function __hideBgVideos(hide) {
try {
document.querySelectorAll('video').forEach(function (v) {
if (v.closest(__KF_EXCLUDE_SEL)) return;
if (hide) {
if (!v.dataset.__kfHid) {
v.dataset.__kfHid = '1';
__kfHiddenVideos.push(v);
try { v.pause(); } catch (e) { if (window.__silent) window.__silent(e); }
v.style.visibility = 'hidden';
v.style.display = 'none';
}
} else if (v.dataset.__kfHid) {
v.dataset.__kfHid = '';
v.style.visibility = '';
v.style.display = '';
}
});
if (!hide) __kfHiddenVideos = [];
} catch (e) { if (window.__silent) window.__silent(e); }
}

function ensureKfModal() {
if (document.getElementById('kfMask')) return;
var m = document.createElement('div');
m.className = 'kf-mask';
m.id = 'kfMask';
m.setAttribute('role', 'dialog');
m.innerHTML =
'<div class="kf-box">' +
'<button class="kf-x" id="kfCloseX" type="button" aria-label="关闭"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
'<div class="kf-title" id="kfTitle">咨询客服</div>' +
'<div class="kf-qr"><img id="kfQrImg" alt="二维码" /></div>' +
'<div class="kf-tip" id="kfTip">长按图片识别-添加人工客服</div>' +
'<div class="kf-actions">' +
'<button class="kf-jump" id="kfJumpBtn" type="button">跳转-咨询在线客服</button>' +
'<button class="kf-close" id="kfCloseBtn" type="button">关闭</button>' +
'</div>' +
'</div>';
document.body.appendChild(m);
function close() {
m.classList.remove('open');
__hideBgVideos(false);
try { document.querySelectorAll('video').forEach(function(v){ v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
if (window.syncBodyLock) window.syncBodyLock(); else (document.body.style.overflow = '');
}
m.addEventListener('click', function (e) { if (e.target === m) close(); });
if (window.__modalKit) window.__modalKit.register(m, { discard: close, stash: close });
document.getElementById('kfCloseX').addEventListener('click', close);
document.getElementById('kfCloseBtn').addEventListener('click', close);
document.getElementById('kfJumpBtn').addEventListener('click', function () {
var u = this.getAttribute('data-url') || '';
if (u) { try { window.open(u, '_blank'); } catch (e) { if (window.__silent) window.__silent(e); } }
});
window.closeContactModal = close;
}

window.__kfPreconnect = function (url) {
try {
if (!url || !/^https?:\/\//.test(url)) return;
var origin = new URL(url, location.href).origin;
if (origin === location.origin) return;
if (document.querySelector('link[data-pc-origin="' + origin + '"]')) return;
var lk = document.createElement('link');
lk.rel = 'preconnect'; lk.href = origin;
lk.setAttribute('data-pc-origin', origin);
document.head.appendChild(lk);
} catch (e) { if (window.__silent) window.__silent(e); }
};

window.openContactModal = function (url, qrImg, tip, btnText, opts) {
opts = opts || {};
window.__kfPreconnect(url);
ensureKfModal();
var _tEl = document.getElementById('kfTitle');
if (_tEl) _tEl.textContent = opts.title || '咨询客服';
var img = document.getElementById('kfQrImg');
if (img) {
img.style.opacity = '0';
img.classList.remove('kf-qr-in');
img.onerror = function () {
this.onerror = null;
this.src = KF_QRF();
if (this.classList) this.classList.add('media-fail');
img.style.opacity = '';
};
img.onload = function () { img.style.opacity = ''; void img.offsetWidth; img.classList.add('kf-qr-in'); };

var _qrSrc = qrImg || window.__kefuQrSrc();
if (_qrSrc) {
img.src = _qrSrc;
if (img.complete) {
if (img.naturalWidth) { img.style.opacity = ''; void img.offsetWidth; img.classList.add('kf-qr-in'); }
else { img.onerror(); }
}
} else { img.onerror(); }
if (window.__bindQrLightbox) window.__bindQrLightbox(img);
}
var tipEl = document.getElementById('kfTip');
if (tipEl) tipEl.textContent = tip || '长按图片识别-添加人工客服';
var btn = document.getElementById('kfJumpBtn');
if (btn) {
btn.style.display = btnText ? '' : 'none'; btn.textContent = btnText || '跳转-咨询在线客服'; btn.setAttribute('data-url', url || '');
btn.classList.toggle('kf-jump-green', !!(opts && opts.green));

}

var mask = document.getElementById('kfMask');
if (!mask.classList.contains('open')) {
mask.classList.add('open');
__hideBgVideos(true);
window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
}
};

window.__kfFbClose = function () {
var m = document.getElementById('kfFallback');
if (m) m.style.display = 'none';
try { document.querySelectorAll('video').forEach(function (v) { if (v.dataset.__kfFbHid) { v.dataset.__kfFbHid = ''; v.style.visibility = ''; } }); } catch (e) { if (window.__silent) window.__silent(e); }
if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
};
window.openContactFallback = function (url, opts) {
window.__kfPreconnect(url);
var m = document.getElementById('kfFallback');
if (!m) {
m = document.createElement('div');
m.id = 'kfFallback';
m.className = 'kf-mask';
m.setAttribute('role', 'dialog');
m.innerHTML =
'<div class="kf-box">' +
'<button class="kf-x" type="button" aria-label="关闭" onclick="window.__kfFbClose()"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
'<div class="kf-title">咨询客服</div>' +
'<div class="kf-qr"><img id="kfFallbackImg" alt="客服二维码" /></div>' +
'<div class="kf-tip">长按图片识别-添加人工客服</div>' +
'<div class="kf-actions">' +
'<button class="kf-jump" type="button" data-u="" onclick="var u=this.getAttribute(\'data-u\');if(u){window.open(u,\'_blank\');}">跳转-咨询在线客服</button>' +
'<button class="kf-close" type="button" onclick="window.__kfFbClose()">关闭</button>' +
'</div>' +
'</div>';
document.body.appendChild(m);
m.addEventListener('click', function (e) { if (e.target === m) window.__kfFbClose(); });
var fbBtn = m.querySelector('.kf-jump');
if (fbBtn) fbBtn.classList.toggle('kf-jump-green', !!(opts && opts.green));
var im = document.getElementById('kfFallbackImg');
if (im) im.onerror = function () { this.onerror = null; this.classList&&this.classList.add('media-fail'); this.src = KF_QRF(); };
}
var jb = m.querySelector('button[data-u]');
if (jb) jb.setAttribute('data-u', url || '');
var im = document.getElementById('kfFallbackImg');
if (im) { im.src = window.__kefuQrSrc() || KF_QRF(); }
try { document.querySelectorAll('video').forEach(function (v) { if (!v.closest('#kfFallback, .kf-box, .kf-mask, .modal-mask, .ann-modal, .share-mask, .lightbox, .stat-modal')) { v.dataset.__kfFbHid = '1'; try { v.pause(); } catch (e) { if (window.__silent) window.__silent(e); } v.style.visibility = 'hidden'; } }); } catch (e) { if (window.__silent) window.__silent(e); }
m.style.display = 'flex';
if (window.lockBodyScroll) window.lockBodyScroll(true);
};

var __lbMask = null, __lbScale = 1, __lbStartDist = 0;
window.closeLightbox = function () {
if (!__lbMask) return;
try { __lbMask.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
__lbMask.classList.remove('open');
if (window.syncBodyLock) window.syncBodyLock(); else (document.body.style.overflow = '');
};
window.openLightbox = function (src, group) {
if (!src) return;

try { document.querySelectorAll('video').forEach(function (v) { if (!v.closest('.lightbox')) v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
if (!__lbMask) {
__lbMask = document.createElement('div');
__lbMask.className = 'lightbox';
__lbMask.onclick = function (e) { if (e.target === __lbMask) window.closeLightbox(); };
document.body.appendChild(__lbMask);
if (window.__modalKit) window.__modalKit.register(__lbMask, { discard: window.closeLightbox, stash: window.closeLightbox });

window.__bindSwipeSwitch(__lbMask, function (dir) {
var g = window.__lbGroup; if (!g) return;
var ni = g.idx + dir;
if (ni < 0 || ni >= g.list.length) return;
g.idx = ni; window.__lbDir = dir; window.__lbShow(g.list[g.idx]);
});

__lbMask.__swipeOnMove = function (dx) {
var m = __lbMask.querySelector('img, video');
if (!m) return;
if (!dx) { m.style.transition = 'transform .18s var(--ease-out, ease)'; m.style.transform = ''; return; }
m.style.transition = 'none';
m.style.transform = 'translateX(' + dx + 'px)';
};
}
window.__lbGroup = (group && group.list && group.list.length > 1) ? { list: group.list.slice(), idx: Math.max(0, group.list.indexOf(src)) } : null;
window.__lbFlipFrom = (group && group.from && group.from.getBoundingClientRect) ? group.from : null;
window.__lbShow = function (s) {
__lbMask.querySelectorAll('img, video').forEach(function (n) { n.remove(); });
var isVideo = /\.(mp4|webm|ogv|m3u8)(\?|#|$)/i.test(s) || /video|\.m3u8/i.test(s);
var im = document.createElement(isVideo ? 'video' : 'img');
if (!isVideo) {
im.onerror = function () { this.onerror = null; this.src = (window.WN_MEDIA_FALLBACK || ''); if (this.classList) this.classList.add('media-fail'); };
im.onload = function () {

try {
var vw = window.innerWidth * 0.96, vh = window.innerHeight * 0.92;
var r = Math.min(vw / (this.naturalWidth || 1), vh / (this.naturalHeight || 1));
this.style.width = Math.max(80, Math.round((this.naturalWidth || 1) * r)) + 'px';
this.style.height = Math.max(80, Math.round((this.naturalHeight || 1) * r)) + 'px';
} catch (e0) { if (window.__silent) window.__silent(e0); }
};
}
im.src = s;

if (window.__lbFlipFrom) {
try {
var fr = window.__lbFlipFrom.getBoundingClientRect();
window.__lbFlipFrom = null;
if (fr.width > 10) {
requestAnimationFrame(function () {
var tr = im.getBoundingClientRect();
if (tr.width < 10) return;
im.style.transition = 'none';
im.style.transform = 'translate(' + (fr.left + fr.width / 2 - tr.left - tr.width / 2) + 'px,' + (fr.top + fr.height / 2 - tr.top - tr.height / 2) + 'px) scale(' + (fr.width / tr.width) + ',' + (fr.height / tr.height) + ')';
im.style.opacity = '0.6';
requestAnimationFrame(function () {
im.style.transition = 'transform .36s cubic-bezier(.34,1.2,.64,1), opacity .3s ease';
im.style.transform = 'none';
im.style.opacity = '';
setTimeout(function () { im.style.transition = ''; }, 420);
});
});
}
} catch (eFlip) { if (window.__silent) window.__silent(eFlip); }
}
if (isVideo) { im.controls = true; im.autoplay = true; im.playsInline = true; }
im.style.cssText = 'object-fit:contain;border-radius:8px;max-width:96vw;max-height:92vh;transition:transform .05s linear;' + (isVideo ? 'width:min(92vw,1200px);aspect-ratio:16/9;background:#000;' : '');

if (window.__lbDir) { im.style.animation = (window.__lbDir > 0 ? 'lbSlideNext' : 'lbSlidePrev') + ' .26s cubic-bezier(.3,0,.2,1)'; window.__lbDir = 0; }
__lbMask.appendChild(im);
if (window.__lbDir) { im.classList.add(window.__lbDir < 0 ? 'lb-sl-prev' : 'lb-sl-next'); window.__lbDir = 0; }
__lbScale = 1;
};
var x = document.createElement('button');
x.type = 'button'; x.className = 'modal-close-x'; x.innerHTML = '<svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg>';
x.onclick = function (e) { e.stopPropagation(); window.closeLightbox(); };
__lbMask.appendChild(x);
window.__lbShow(src);
window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
__lbMask.classList.add('open');
};
document.addEventListener('touchstart', function (e) {
if (window.__flipAnimating) return;
if (!__lbMask || !__lbMask.classList.contains('open')) return;
if (e.touches.length === 2) __lbStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
}, { passive: true });
document.addEventListener('touchmove', function (e) {
if (!__lbMask || !__lbMask.classList.contains('open')) return;
if (e.touches.length === 2 && __lbStartDist > 0) {
var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
__lbScale = Math.min(4, Math.max(1, __lbScale * (d / __lbStartDist)));
var el = __lbMask.querySelector('img, video');
if (el) el.style.transform = 'scale(' + __lbScale + ')';
__lbStartDist = d;
e.preventDefault();
}
}, { passive: false });
document.addEventListener('touchend', function () { if (__lbMask && __lbMask.classList.contains('open')) __lbStartDist = 0; });
document.addEventListener('dblclick', function (e) {
if (window.__flipAnimating) return;
if (!__lbMask || !__lbMask.classList.contains('open')) return;
if (__lbMask.contains(e.target)) { __lbScale = 1; var el = __lbMask.querySelector('img, video'); if (el) el.style.transform = 'scale(1)'; }
});
window.__bindQrLightbox = function (img) {
if (!img || img.dataset.lbBound) return;
img.dataset.lbBound = '1';
img.style.cursor = 'zoom-in';
img.addEventListener('click', function () {
if (img.src && !img.src.startsWith('data:') && img.complete && img.naturalWidth) window.openLightbox(img.currentSrc || img.src);
});
};



window.parseAnnouncements = function (settings, opts) {
opts = opts || {};
var arr = [];
try { arr = JSON.parse(settings.announcements || '[]'); } catch (e) { arr = []; }
if (!Array.isArray(arr)) arr = [];
if (!arr.length && settings.announcement) arr = [{ id: 0, title: '公告', content: String(settings.announcement || ''), hidden: 0, sort: 0, level: 1 }];
if (opts.filterHidden) arr = arr.filter(function (a) { return !a.hidden; });

if (opts.sortLevel) {
arr.sort(function (a, b) { var la = a.level === 1 ? -1 : 0, lb = b.level === 1 ? -1 : 0; if (la !== lb) return la - lb; return (a.sort || 0) - (b.sort || 0); });
} else {
arr.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
}
return arr;
};

window.__saveImage = function (src) {
try {
fetch(src).then(function (r) { return r.blob(); }).then(function (blob) {
var u = URL.createObjectURL(blob);
var a = document.createElement('a');
a.href = u;
a.download = (String(src).split('/').pop() || 'image').split('?')[0] || 'image';
document.body.appendChild(a); a.click(); a.remove();
setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
if (window.showToast) window.showToast('图片已保存', 'success');
}).catch(function () {
if (window.showToast) window.showToast('图片保存失败', 'error');
});
} catch (e) {
if (window.showToast) window.showToast('图片保存失败', 'error');
}
};

window.flipViewSwitch = function (containerId, view, opts) {
var container = document.getElementById(containerId);
var btnA = document.getElementById(opts.btnA);
var btnB = document.getElementById(opts.btnB);
var flipperKey = opts.flipperKey;
if (!window.FlipAnimator || !container) { opts.fallbackFn(view); return; }
var flipper = window[flipperKey];
if (!flipper || flipper.container !== container) {
flipper = new window.FlipAnimator(container);
window[flipperKey] = flipper;
}
var animated = flipper.flip(function () {
if (view === opts.viewA) {
container.classList.add(opts.viewClass);
if (btnA) btnA.classList.add('active');
if (btnB) btnB.classList.remove('active');
} else {
container.classList.remove(opts.viewClass);
if (btnA) btnA.classList.remove('active');
if (btnB) btnB.classList.add('active');
}
if (opts.storageKey) localStorage.setItem(opts.storageKey, view);
if (opts.onChange) opts.onChange(view);
}, { duration: 300, stagger: 20, maxStagger: 180 });
if (!animated && opts.triggerAnim) opts.triggerAnim(container);
};

window.mediaStable = function (el, isVideo, keepRatio) {
if (!el) return el;
el.classList.add('m-loading');
if (isVideo) el.classList.add('is-video');
function applyRatio(w, h) {
if (!keepRatio && w && h) { try { el.style.aspectRatio = (w / h); } catch (e) { if (window.__silent) window.__silent(e); } }
el.classList.remove('m-loading', 'is-video');
try { el.classList.add('img-in'); } catch (e) { if (window.__silent) window.__silent(e); }
}
if (isVideo) {
el.addEventListener('loadedmetadata', function () { applyRatio(el.videoWidth, el.videoHeight); }, { once: true });
} else {
if (el.complete && el.naturalWidth) applyRatio(el.naturalWidth, el.naturalHeight);
else el.addEventListener('load', function () { applyRatio(el.naturalWidth, el.naturalHeight); }, { once: true });
}
el.addEventListener('error', function () { el.classList.remove('m-loading', 'is-video'); }, { once: true });
return el;
};

window.showAlert = function (msg, title) {
try {
var mask = document.createElement('div');
mask.className = 'modal-mask alert-mask open';
mask.style.cssText = 'position:fixed;inset:0;background:var(--overlay-modal, rgba(0,0,0,0.76));z-index:10060;display:flex;align-items:center;justify-content:center;padding:16px;';
mask.innerHTML =
'<div class="modal-box" style="background:var(--card-bg);border-radius:12px;width:100%;max-width:var(--modal-w-xs);padding:24px 22px;position:relative;text-align:center;max-height:min(88vh,88dvh);overflow-y:auto;min-height:auto;">' +
'<button type="button" class="modal-close-x" aria-label="关闭"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
'<div class="modal-title" style="font-size:20px;color:var(--text);margin-bottom:14px;letter-spacing:1px;padding:0 32px;text-align:center;"></div>' +
'<div class="alert-body" style="font-size:14px;color:var(--text-light);line-height:1.7;word-break:break-word;overflow-wrap:anywhere;margin-bottom:20px;text-align:center;"></div>' +
'<div style="display:flex;"><button type="button" class="alert-ok" style="flex:1;border:none;border-radius:10px;height:46px;padding:0;background:var(--blue1);color:var(--text-on-brand);font-size:16px;font-weight:600;cursor:pointer;letter-spacing:1.2px;transition:transform var(--dur-fast) var(--ease-press), opacity var(--dur-fast) var(--ease-press);box-shadow:var(--shadow-blue); /* v293（用户 10-04 02:14）：044JS生成阴影收归5档→0 2px 6px rgba(30,136,229,0.25)改var(--shadow-blue) */ -webkit-tap-highlight-color:transparent;">确定</button></div>' +
'</div>';
var titleEl = mask.querySelector('.modal-title');
var bodyEl = mask.querySelector('.alert-body');
if (titleEl) titleEl.textContent = (title == null || title === '') ? '提示' : String(title);
if (bodyEl) bodyEl.textContent = String(msg == null ? '' : msg);
document.body.appendChild(mask);
var close = function () {
if (close.__done) return; close.__done = true;

try { mask.classList.add('mask-closing'); } catch (e0) { if (window.__silent) window.__silent(e0); }
setTimeout(function () {
try { document.body.removeChild(mask); } catch (e) { if (window.__silent) window.__silent(e); }
if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
}, 200);
};
mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
var ok = mask.querySelector('.alert-ok');
if (ok) ok.addEventListener('click', close);
var x = mask.querySelector('.modal-close-x');
if (x) x.addEventListener('click', close);
window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
} catch (e) {
try {
if (typeof window.showToast === 'function') { window.showToast(msg, 'info'); return; }
} catch (e2) { if (window.__silent) window.__silent(e2); }
try { console.warn('[提示] ' + msg); } catch (e3) {}
}
};

function __renderShareTip(pEl, tip) {
var s = tip || '资源链接已复制';
pEl.textContent = '';
var i = s.lastIndexOf(' · ');
if (i < 0) { pEl.appendChild(document.createTextNode(s)); return; }
var nEl = document.createElement('span');
nEl.style.color = '#1565c0';
nEl.textContent = s.slice(0, i);
var dEl = document.createElement('span');
dEl.style.color = '#000';
dEl.textContent = ' · ';
pEl.appendChild(nEl); pEl.appendChild(dEl);
pEl.appendChild(document.createTextNode(s.slice(i + 3)));
}
window.showShareLinkModal = function (title, url, tip) {
try { __shareCopy(url || ''); __shareToast(window.T('copied')); } catch (e0) { if (window.__silent) window.__silent(e0); }
try {
var mask = document.createElement('div');
mask.className = 'share-mask';
mask.setAttribute('role', 'dialog');
mask.style.cssText = 'position:fixed;inset:0;background:var(--overlay-modal, rgba(0,0,0,0.76));z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
mask.innerHTML =
'<div class="share-box" style="background:var(--card-bg);border-radius:12px;position:relative;padding:24px 20px;width:100%;max-width:var(--modal-w-xs);text-align:center;box-shadow:var(--shadow-modal); /* v293（用户 10-04 02:14）：044JS生成阴影收归5档→0 10px 40px rgba(0,0,0,0.3)改var(--shadow-modal) */ animation:modalIn var(--dur-mid) var(--ease-out); /* v356 条2：12px/24px/统一时长缓动 */">' +
'<button class="modal-close-x" data-share-x type="button" aria-label="关闭" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:none;background:var(--danger-bg,#fdecea);color:var(--red-strong,#c62828);font-size:16px; /* v356 条4：×键纳入全站红系 */cursor:pointer;line-height:1;transition:transform var(--dur-fast) var(--ease-press), opacity var(--dur-fast) var(--ease-press);"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
'<div data-share-title style="font-size:20px;font-weight:600;color:var(--text);margin-bottom:10px;letter-spacing:1px;padding:0 34px;"></div>' +
'<div data-share-tip style="font-size:13px;color:var(--gray-mid);margin-bottom:10px;">资源链接已复制</div>' +
'<div data-share-url style="font-size:14px;color:var(--blue1);word-break:break-all;overflow-wrap:anywhere;background:var(--gray-bg);border-radius:8px;padding:10px 12px;margin-bottom:18px;line-height:1.5;"></div>' +
'<button data-share-ok type="button" class="share-ok">确定</button>' +
'</div>';
var tEl = mask.querySelector('[data-share-title]');
var uEl = mask.querySelector('[data-share-url]');
var pEl = mask.querySelector('[data-share-tip]');
if (tEl) tEl.textContent = title || '分享';
if (pEl) __renderShareTip(pEl, tip);
if (uEl) uEl.textContent = url || '';
if (uEl) {
uEl.style.cursor = 'pointer';
uEl.title = '点击复制链接';
uEl.addEventListener('click', function () {
try { __shareCopy(uEl.textContent || ''); } catch (e) { if (window.__silent) window.__silent(e); }
if (uEl.classList) { uEl.classList.add('copy-ok-text'); setTimeout(function () { try { uEl.classList.remove('copy-ok-text'); } catch (e) { if (window.__silent) window.__silent(e); } }, 1500); }
__shareToast(window.T('copied'));
});

uEl.classList.add('copy-ok-text');
setTimeout(function () { try { uEl.classList.remove('copy-ok-text'); } catch (e) { if (window.__silent) window.__silent(e); } }, 1500);
}
document.body.appendChild(mask);
function close() {
try { document.body.removeChild(mask); } catch (e) { if (window.__silent) window.__silent(e); }
if (window.syncBodyLock) window.syncBodyLock(); else if (window.lockBodyScroll) window.lockBodyScroll(false);
}
mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
mask.querySelector('[data-share-x]').addEventListener('click', close);
mask.querySelector('[data-share-ok]').addEventListener('click', close);
if (window.__modalKit) window.__modalKit.register(mask, { discard: close, stash: close });
window.lockBodyScroll ? window.lockBodyScroll(true) : (document.body.style.overflow = 'hidden');
} catch (e) { if (window.__silent) window.__silent(e); }
};
function __fallbackCopyText(text) {
var ta = document.createElement('textarea');
ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
document.body.appendChild(ta);
try { ta.focus({ preventScroll: true }); } catch (e) { try { ta.focus(); } catch (e2) { if (window.__silent) window.__silent(e2); } }
ta.select();
var ok = false;
try { ok = document.execCommand('copy'); } catch (e) { if (window.__silent) window.__silent(e); }
document.body.removeChild(ta);
return ok;
}
function __shareCopy(text) {
text = (text == null) ? '' : String(text);
try {
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(text).catch(function () {
try { __fallbackCopyText(text); } catch (e) { if (window.__silent) window.__silent(e); }
});
return true;
}
} catch (e) { if (window.__silent) window.__silent(e); }
return __fallbackCopyText(text);
}
window.__shareCopyText = __shareCopy;
function __shareToast(msg) {
try {
if (typeof window.showToast === 'function') { window.showToast(msg, 'info'); return; }
if (typeof window.toast === 'function') { window.toast(msg, 'success'); return; }
} catch (e) { if (window.__silent) window.__silent(e); }
var t = document.createElement('div');
t.textContent = msg;
t.style.cssText = 'position:fixed;top:' + ((typeof window.__toastTop === 'function') ? window.__toastTop() : 80) + 'px;left:50%;transform:translateX(-50%);color:var(--blue1,#1E88E5);background:var(--toast-bg,rgba(255,255,255,0.92));border:1px solid var(--blue2,#64B5F6);border-radius:999px; /* v293（用户 10-04 02:14）：071toast圆角20→999px→跟胶囊形统一 */padding:6px 16px;font-size:12px;line-height:18px;box-shadow:var(--shadow-pop,0 4px 16px rgba(0,0,0,0.14));z-index:100002;pointer-events:none;opacity:0;transition:opacity .2s ease;max-width:90%;text-align:center;';
document.body.appendChild(t);
requestAnimationFrame(function () { t.style.opacity = '1'; });
setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { try { document.body.removeChild(t); } catch (e) { if (window.__silent) window.__silent(e); } }, 300); }, 2000);
}

var __bodyLockCount = 0;

function __scrollableAncestor(el) {
for (var p = el; p && p !== document.body; p = p.parentNode) {
if (p.nodeType !== 1) continue;
var st = getComputedStyle(p);
if (/(auto|scroll)/.test(st.overflowY + st.overflowX) && (p.scrollHeight > p.clientHeight + 2 || p.scrollWidth > p.clientWidth + 2)) return true;
}
return false;
}
var __BLOCK_TOUCH_SEL = '.modal-box,.kf-box,.share-box,.modal-inner,.rte-panel,.ann-box,.lightbox,.cp-box,.qr-preview-box,.stat-modal,.picker-panel,.cat-picker-panel';
function __blockTouch(e) {
if (!e.target || !e.target.closest) return;

if (e.target.closest(__BLOCK_TOUCH_SEL)) return;
if (__scrollableAncestor(e.target)) return;
e.preventDefault();
}
function __blockWheel(e) {

return;
}
var __bodyLockCount = 0;
var __touchLocked = false, __wheelLocked = false;
window.lockBodyScroll = function (lock) {
if (lock) {
__bodyLockCount++;
if (__bodyLockCount === 1) {
document.body.style.overflow = 'hidden';
document.documentElement.style.overflow = 'hidden';
if (!__touchLocked) { document.addEventListener('touchmove', __blockTouch, { passive: false }); __touchLocked = true; }
if (!__wheelLocked) { document.addEventListener('wheel', __blockWheel, { passive: false }); __wheelLocked = true; }
}
} else {
__bodyLockCount = Math.max(0, __bodyLockCount - 1);
if (__bodyLockCount === 0) {
document.body.style.overflow = '';
document.documentElement.style.overflow = '';
if (__touchLocked) { document.removeEventListener('touchmove', __blockTouch); __touchLocked = false; }
if (__wheelLocked) { document.removeEventListener('wheel', __blockWheel); __wheelLocked = false; }
}
}
};
var __prevModalOpen = false;
window.syncBodyLock = function () {
var open = !!document.querySelector('.modal-mask.open,.kf-mask.open,.share-mask.open,.lightbox-mask.open,.alert-mask.open,.lightbox.open,.cp-mask.open,.qr-preview-mask.open,.ann-mask.open,.stat-modal.open,.picker-panel.open,.cat-picker-panel.open');
if (open !== __prevModalOpen) {
if (open) {
document.body.style.overflow = 'hidden';
document.documentElement.style.overflow = 'hidden';
if (!__touchLocked) { document.addEventListener('touchmove', __blockTouch, { passive: false }); __touchLocked = true; }
if (!__wheelLocked) { document.addEventListener('wheel', __blockWheel, { passive: false }); __wheelLocked = true; }
} else {
document.body.style.overflow = '';
document.documentElement.style.overflow = '';
if (__touchLocked) { document.removeEventListener('touchmove', __blockTouch); __touchLocked = false; }
if (__wheelLocked) { document.removeEventListener('wheel', __blockWheel); __wheelLocked = false; }
__bodyLockCount = 0;
}
}
if (open !== __prevModalOpen) { try { if (window.__hideUiTip) window.__hideUiTip(); } catch (e0) { if (window.__silent) window.__silent(e0); } }
__prevModalOpen = open;
};
try {
var __lockT = 0;
var __lockObserver = new MutationObserver(function () {
clearTimeout(__lockT);
__lockT = setTimeout(function () { window.syncBodyLock(); }, 30);
});
__lockObserver.observe(document.documentElement, { subtree: true, childList: true, attributeFilter: ['class'] });
} catch (e) { if (window.__silent) window.__silent(e); }
window.addEventListener('pageshow', function (e) {
if (e.persisted) {
try { if (window.__saveEditingDraft) window.__saveEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
}
});

window.buildUniPager = function (container, opts) {
if (!container) return;
opts = opts || {};
var page = opts.page || 1;
var totalPages = opts.totalPages || 1;
var onPage = typeof opts.onPage === 'function' ? opts.onPage : function () {};
var unit = opts.unit || '条';
var total = (typeof opts.total === 'number' && !isNaN(opts.total)) ? opts.total : null;

container.className = 'uni-pager';
container.innerHTML = '';


if (totalPages <= 1) { container.style.display = 'none'; return { setPage: function () {} }; }
container.style.display = '';

var prev = document.createElement('button');
prev.type = 'button'; prev.className = 'pg-btn'; prev.textContent = '上一页';
var info = document.createElement('span');
info.className = 'pg-info';
info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite');
var jump = document.createElement('span');
jump.className = 'pg-jump';
var input = document.createElement('input');
input.type = 'number'; input.min = '1'; input.max = String(totalPages);
input.setAttribute('inputmode', 'numeric'); input.setAttribute('aria-label', '跳转页码');
var goBtn = document.createElement('button');
goBtn.type = 'button'; goBtn.textContent = '跳转';
var next = document.createElement('button');
next.type = 'button'; next.className = 'pg-btn'; next.textContent = '下一页';

jump.appendChild(input); jump.appendChild(goBtn);
var main = document.createElement('span');
main.className = 'pg-main';
main.appendChild(prev); main.appendChild(info); main.appendChild(next);
container.appendChild(main); container.appendChild(jump);

function render() {
prev.disabled = page <= 1;
next.disabled = page >= totalPages;
info.textContent = page + ' / ' + totalPages + (total !== null ? '（共' + total + unit + '）' : '');
input.value = page;
input.max = String(totalPages);
}
function go(p) {
p = parseInt(p, 10);
if (isNaN(p)) return;
p = Math.min(Math.max(p, 1), totalPages);
if (p === page) { input.value = page; return; }
page = p; render(); onPage(page);
}
var pendingJump = null;
prev.addEventListener('click', function () { go(page - 1); });
next.addEventListener('click', function () { go(page + 1); });
goBtn.addEventListener('mousedown', function () { pendingJump = input.value; });
goBtn.addEventListener('click', function () { go(pendingJump !== null ? pendingJump : input.value); pendingJump = null; });
input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); pendingJump = null; go(input.value); } });
input.addEventListener('blur', function () { var v = parseInt(input.value, 10); if (isNaN(v) || v < 1 || v > totalPages) input.value = page; });
render();

return {
setPage: function (p) {
p = parseInt(p, 10);
if (isNaN(p)) return;
page = Math.min(Math.max(p, 1), totalPages);
render();
}
};
};


window.LIST_PAGE_SIZE = (window.WN_CONST && window.WN_CONST.ADMIN_PAGE_SIZE) || 20;

window.__slicePage = function (list, page, size) {
var arr = list || [];
size = Math.max(1, size || window.LIST_PAGE_SIZE);
var total = arr.length;
var totalPages = Math.max(1, Math.ceil(total / size));
page = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);
return {
items: arr.slice((page - 1) * size, page * size),
page: page, totalPages: totalPages, total: total, size: size
};
};

window.makeListPager = function (opts) {
opts = opts || {};
var rows = opts.rows || [];
var size = Math.max(1, opts.size || window.LIST_PAGE_SIZE);
var cur = Math.max(1, parseInt(opts.page, 10) || 1);
var state = { page: cur, total: rows.length, totalPages: 1 };
function paint() {
var st = window.__slicePage(rows, state.page, size);
state.page = st.page; state.total = st.total; state.totalPages = st.totalPages;
if (typeof opts.render === 'function') opts.render(st.items, st);
if (opts.pager && window.buildUniPager) {
window.buildUniPager(opts.pager, {
page: st.page, totalPages: st.totalPages, total: st.total, unit: opts.unit || '条',
onPage: function (p) { state.page = p; paint(); }
});
}
return st;
}
if (opts.body) opts.body.innerHTML = '';
paint();
return {
state: state,
go: function (p) { state.page = p; paint(); },
setRows: function (r, keepPage) { rows = r || []; if (!keepPage) state.page = 1; paint(); },
refresh: paint
};
};


window.pagerBox = function (id) {
return '<div class="uni-pager" id="' + id + '"></div>';
};
})();


window.jumpTo = function (href) {
if (!href) return;
var reduced = false;
try { reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { if (window.__silent) window.__silent(e); }
if (reduced) { window.location.href = href; return; }
window.location.href = href;
};
window.addEventListener('pageshow', function (e) {
if (e.persisted && document.body && document.body.style.opacity === '0') { document.body.style.opacity = '1'; document.body.style.transition = ''; }
});


window.__modalKit = (function () {
var stack = [];
var reg = [];


var __navLast = -1, __navSuppress = 0, __navBack = 0, __navT = 0, __navSent = 0;
function __navTick() {
var cur = stack.length;
if (__navLast < 0) { __navLast = cur; return; }
if (cur > __navLast) {
for (var i = 0; i < cur - __navLast; i++) { try { history.pushState({ __modalNav: 1 }, '', location.href); } catch (e) { if (window.__silent) window.__silent(e); } }
__navSent += cur - __navLast;
} else if (cur < __navLast) {
var drop = __navLast - cur;
if (__navSuppress > 0) {
var used = Math.min(drop, __navSuppress);
__navSuppress -= used; __navSent = Math.max(0, __navSent - used); drop -= used;
}
var backs = Math.min(drop, __navSent);
if (backs > 0 && cur === 0) { __navBack += backs; __navSent -= backs; for (var j = 0; j < backs; j++) { try { history.back(); } catch (e) { if (window.__silent) window.__silent(e); } } }
else if (backs > 0) { __navSent -= backs; }
}
__navLast = cur;
}
window.addEventListener('popstate', function () {
if (__navBack > 0) { __navBack--; return; }
if (stack.length) { __navSuppress++; close(stack[stack.length - 1], 'stash'); }
});
function entry(m) { for (var i = 0; i < reg.length; i++) if (reg[i].mask === m) return reg[i]; return null; }
function sync(m) {
var open = !!(m.classList && m.classList.contains('open'));
var idx = stack.indexOf(m);
if (open && idx < 0) stack.push(m);
else if (!open && idx >= 0) stack.splice(idx, 1);

if (!open && window.__btnIdle) {
try {
m.querySelectorAll('.btn-spin').forEach(function (sp) {
var b = sp.closest && sp.closest('button');
if (b) window.__btnIdle(b);
});
} catch (e2) { if (window.__silent) window.__silent(e2); }
}
clearTimeout(__navT); __navT = setTimeout(__navTick, 60);
}
function register(mask, handlers) {
if (!mask || entry(mask)) return;
reg.push({ mask: mask, discard: handlers && handlers.discard, stash: handlers && handlers.stash });
try { new MutationObserver(function () { sync(mask); }).observe(mask, { attributes: true, attributeFilter: ['class'] }); } catch (e) { if (window.__silent) window.__silent(e); }
sync(mask);
}
function close(mask, mode) {
var h = entry(mask);
if (!h) return;
var fn = mode === 'discard' ? (h.discard || h.stash) : (h.stash || h.discard);
try { if (fn) fn.call(mask, mask); } catch (err) { if (window.__silent) window.__silent(err); }
try { mask.classList.remove('open'); } catch (e) { if (window.__silent) window.__silent(e); }
try { mask.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); }
}
document.addEventListener('keydown', function (e) {
if (e.key !== 'Escape' || e.__escPre) return;
if (!stack.length) return;
e.preventDefault();
close(stack[stack.length - 1], 'stash');
});

return { register: register, close: close, stack: stack };
})();


window.pushSearchHist = function (key, kw) {
kw = (kw || '').trim(); if (!kw) return;
try {
var arr = JSON.parse(localStorage.getItem(key) || '[]');
for (var i = 0; i < arr.length; i++) if (arr[i] === kw) { arr.splice(i, 1); break; }
arr.unshift(kw);
if (arr.length > 8) arr.length = 8;
localStorage.setItem(key, JSON.stringify(arr));
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.bindSearchHist = function (wrap, input, key) {
if (!wrap || !input || !window.__uiCommonLoaded) return;
var box = document.createElement('div');
box.className = 'search-hist';
box.style.display = 'none';
wrap.appendChild(box);
function getArr() { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
function setArr(a) { try { localStorage.setItem(key, JSON.stringify(a)); } catch (e) { if (window.__silent) window.__silent(e); } }
function hide() { box.style.display = 'none'; }
function render() {
var arr = getArr();
if (!arr.length) { hide(); return; }
var html = '<div class="sh-head"><span class="sh-title">最近搜索</span><button type="button" class="sh-clear">清空</button></div><div class="sh-list">';
for (var i = 0; i < arr.length; i++) {
var w = String(arr[i]).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
html += '<span class="sh-item"><button type="button" class="sh-word" data-w="' + w + '">' + w + '</button><button type="button" class="sh-del" data-i="' + i + '" title="删除这条"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button></span>';
}
html += '</div>';
box.innerHTML = html;
box.style.display = 'block';
}
function pick(w) {
input.value = w;
hide();
try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { if (window.__silent) window.__silent(e); }
}
box.addEventListener('mousedown', function (e) { e.preventDefault(); });
box.addEventListener('click', function (e) {

var raw = e.target;
var t = (raw && raw.closest) ? raw.closest('.sh-word, .sh-del, .sh-clear') : raw;
if (!t) return;
if (t.classList.contains('sh-word')) { pick(t.getAttribute('data-w') || t.textContent); return; }
if (t.classList.contains('sh-del')) {
var arr = getArr(); var i = parseInt(t.getAttribute('data-i'), 10);
if (!isNaN(i) && i >= 0 && i < arr.length) { arr.splice(i, 1); setArr(arr); }
render(); return;
}
if (t.classList.contains('sh-clear')) { setArr([]); hide(); return; }
});
input.addEventListener('focus', function () { if (!input.value) render(); });
input.addEventListener('input', function () { if (input.value) hide(); else render(); });
input.addEventListener('blur', function () { setTimeout(hide, 160); });
input.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
};

(function () {
document.addEventListener('error', function (e) {
try {
var t = e.target;
if (t && t.tagName === 'IMG' && !t.classList.contains('media-fail')) t.classList.add('media-fail');
} catch (err) { if (window.__silent) window.__silent(err); }
}, true);
})();



(function () {
if (window.__uiTipLoaded) return;
window.__uiTipLoaded = true;
var tip = null, cur = null;
var __lastTxt = null, __lastW = 0, __lastH = 0, __showAt = 0;
function getTip() {
if (!tip) { tip = document.createElement('div'); tip.id = 'uiTip'; document.body.appendChild(tip); }
return tip;
}
function clipped(el) { return el.scrollHeight - el.clientHeight > 1 || clippedX(el); }
function clippedX(el) {
if (el.scrollHeight - el.clientHeight > 1) return false;
if (el.scrollWidth - el.clientWidth > 1) return true;
if (el.clientWidth <= 0) return false;
try {
var rng = document.createRange(); rng.selectNodeContents(el);
return rng.getBoundingClientRect().width - el.clientWidth > 1;
} catch (e0) { return false; }
}
function anyModalOpen() {
return !!document.querySelector('.modal-mask.open,.kf-mask.open,.share-mask.open,.alert-mask.open,.lightbox.open,.ann-modal.open,.ann-box.open,.stat-modal.open');
}
function show(el) {
var txt = (el.textContent || '').trim();
if (!txt) return;
if (anyModalOpen() && !el.closest('.modal-mask,.kf-mask,.share-mask,.alert-mask,.lightbox,.ann-modal,.ann-box,.stat-modal')) return;
cur = el; __showAt = Date.now();
var t = getTip();
t.innerHTML = el.innerHTML;
t.style.display = 'block';
var r = el.getBoundingClientRect();
var w, h;
if (__lastTxt === txt) { w = __lastW; h = __lastH; }
else {
t.style.left = '0px'; t.style.top = '0px';
w = t.offsetWidth; h = t.offsetHeight;
__lastTxt = txt; __lastW = w; __lastH = h;
}
var x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
var y = r.bottom + 6;
if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 6);
t.style.left = x + 'px'; t.style.top = y + 'px';
setTimeout(function () {
if (cur && !cur.isConnected) {
var txt2 = (cur.textContent || '').trim(), found = null;
try {
document.querySelectorAll(PICKSEL).forEach(function (n) {
if (!found && n.isConnected && ((n.textContent || '').trim()) === txt2 && (clipped(n) || clippedX(n))) found = n;
});
} catch (e1) { if (window.__silent) window.__silent(e1); }
if (found) { cur = found; return; }
hide();
}
}, 350);
}
function hide() { __pendingEl = null; if (tip) tip.style.display = 'none'; cur = null; }
var __pendingEl = null;
function __rAFshow(el) {
__pendingEl = el;
requestAnimationFrame(function () {
if (__pendingEl !== el || !el.isConnected) return;
__pendingEl = null;
show(el);
});
}
window.__hideUiTip = hide;
var SKIP = 'input,textarea,select,button,a,.rte-editor,pre,code,canvas,svg,video,img,iframe';
function leafText(el) { return el.children.length === 0 && (el.textContent || '').trim().length > 0; }
function nearestClipped(el) {
for (var n = el, i = 0; n && n !== document.body && i < 5; n = n.parentElement, i++) {
if (!(n instanceof Element)) return null;
if (n.matches(SKIP)) return null;
var cs = getComputedStyle(n);
var isEllipsis = cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
if (!isEllipsis) continue;
if ((leafText(n) && clipped(n)) || clippedX(n)) return n;
}
return null;
}
var PICKSEL = 'td, th, .c-name, .v-name, .p-title, .p-sub, .card-title, .card-desc, .shop-name, .variant-tab, .cpd-text, .cp-name, .v-price';
var __hoverDev = window.matchMedia ? window.matchMedia('(hover: hover)').matches : true;
if (__hoverDev) document.addEventListener('mouseover', function (ev) {
var el = ev.target;
if (!(el instanceof Element) || !el.closest) return;
if (el.closest(SKIP)) return;
if (leafText(el) && clipped(el)) { __rAFshow(el); return; }
var box = nearestClipped(el) || el.closest(PICKSEL);
if (box && clippedX(box)) { __rAFshow(box); return; }
if (box && clipped(box)) { __rAFshow(box); return; }
if (cur && !cur.contains(el)) hide();
});
document.addEventListener('mouseout', function (ev) {
if (!__hoverDev) return;
if (!cur) return;
var to = ev.relatedTarget;
if (!to || (to !== cur && !cur.contains(to))) hide();
});
document.addEventListener('click', function (ev) {
var el = ev.target;
if (!(el instanceof Element) || !el.closest) { hide(); return; }
if (el.closest(SKIP)) { hide(); return; }
var hit = nearestClipped(el) || el.closest(PICKSEL);
if (hit && ((leafText(hit) && clipped(hit)) || clippedX(hit))) { __rAFshow(hit); return; }
hide();
});
window.addEventListener('scroll', function () { if (Date.now() - __showAt < 400) return; hide(); }, true);
window.addEventListener('resize', function () { if (Date.now() - __showAt < 400) return; hide(); });
})();

window.__haptic = function () {
try {
if (navigator.vibrate && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) navigator.vibrate(10);
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.__btnBusy = function (btn, text) {
if (!btn) return;

if (!btn.__busy) {
btn.__busy = 1;
btn.__busyOrig = (btn.querySelector('.btn-lab') || {}).textContent != null ? btn.querySelector('.btn-lab').textContent : null;
if (btn.__busyTimer) { clearTimeout(btn.__busyTimer); btn.__busyTimer = null; }
btn.__busyTimer = setTimeout(function () {
btn.__busyTimer = null;
if (btn.__busy) window.__btnIdle(btn);
}, 12000);
}


var lab = btn.querySelector('.btn-lab');
if (lab) { lab.textContent = text; }
else {
var txt = null;
for (var i = 0; i < btn.childNodes.length; i++) {
var n = btn.childNodes[i];
if (n.nodeType === 3 && String(n.nodeValue || '').trim()) { if (!txt) txt = n; else n.nodeValue = ''; }
}
if (txt) txt.nodeValue = text;
else btn.insertBefore(document.createTextNode(text), btn.firstChild);
}
btn.classList.add('is-busy');
btn.setAttribute('aria-busy', 'true');

};

window.__btnIdle = function (btn) {
if (!btn) return;
btn.__busy = 0;
if (btn.__busyTimer) { clearTimeout(btn.__busyTimer); btn.__busyTimer = null; }
btn.classList.remove('is-busy');
btn.removeAttribute('aria-busy');
var sp = btn.querySelector('.btn-spin');
if (sp && sp.parentNode) sp.parentNode.removeChild(sp);
if (btn.__busyOrig != null) {
var lab = btn.querySelector('.btn-lab');
if (lab) { lab.textContent = btn.__busyOrig; }
else {
var txt = null;
for (var i = 0; i < btn.childNodes.length; i++) {
var n = btn.childNodes[i];
if (n.nodeType === 3 && String(n.nodeValue || '').trim()) { if (!txt) txt = n; else n.nodeValue = ''; }
}
if (txt) txt.nodeValue = btn.__busyOrig;
}
btn.__busyOrig = null;
}
btn.disabled = false;
};
window.__copyOk = function (el) {
if (!el) return;
window.__haptic();
try { el.classList.add('copy-ok'); } catch (e) { if (window.__silent) window.__silent(e); }
setTimeout(function () { try { el.classList.remove('copy-ok'); } catch (e) { if (window.__silent) window.__silent(e); } }, 1500);
};


window.__quoteCopyOk = function (q) {
try {
q.classList.add('copy-ok-text');
setTimeout(function () { try { q.classList.remove('copy-ok-text'); } catch (e) { if (window.__silent) window.__silent(e); } }, 1500);

var btn = q.querySelector('.quote-copy-btn');
if (btn && !btn.dataset.okBusy) {
btn.dataset.okBusy = '1';
var old = btn.textContent;
btn.textContent = '已复制';
btn.classList.add('ok');
setTimeout(function () {
try { btn.textContent = old; btn.classList.remove('ok'); delete btn.dataset.okBusy; } catch (e) { if (window.__silent) window.__silent(e); }
}, 1500);
}
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.__fallbackCopyQuote = function (text, q) {
try {
var ta = document.createElement('textarea');
ta.value = text;
ta.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
document.body.appendChild(ta);
ta.select();
document.execCommand('copy');
document.body.removeChild(ta);
if (window.showToast) window.showToast('已复制');
else if (window.__shareToast) window.__shareToast('已复制');
if (q) window.__quoteCopyOk(q);
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.bindQuoteCopyButtons = function (container) {
if (!container) return;
var quotes = container.querySelectorAll('blockquote');
quotes.forEach(function (q) {
if (q.querySelector('.quote-copy-btn')) return;
var btn = document.createElement('button');
btn.type = 'button';
btn.className = 'quote-copy-btn';
btn.textContent = '复制';
btn.addEventListener('click', function (e) {
e.preventDefault();
e.stopPropagation();
var clone = q.cloneNode(true);
var innerBtn = clone.querySelector('.quote-copy-btn');
if (innerBtn) innerBtn.remove();
var html = clone.innerHTML.trim();
var text = clone.textContent.trim();
var ok = false;
if (navigator.clipboard && navigator.clipboard.write) {
try {
var blob = new Blob([html], { type: 'text/html' });
var txtBlob = new Blob([text], { type: 'text/plain' });
var item = new ClipboardItem({ 'text/html': blob, 'text/plain': txtBlob });
navigator.clipboard.write([item]).then(function () {
if (window.showToast) window.showToast('已复制');
else if (window.__shareToast) window.__shareToast('已复制');
window.__quoteCopyOk(q);
}).catch(function () {
window.__fallbackCopyQuote(text, q);
});
ok = true;
} catch (e) { if (window.__silent) window.__silent(e); }
}
if (!ok) window.__fallbackCopyQuote(text, q);
});
q.appendChild(btn);
});
};
(function () {
var MASK_SEL = '.modal-mask, .share-mask, .kf-mask, .lightbox';
function hasOpen(cls) { return !!cls && (' ' + cls + ' ').indexOf(' open ') !== -1; }
var mo = new MutationObserver(function (muts) {
muts.forEach(function (m) {
var el = m.target;
if (!el || el.nodeType !== 1 || !el.classList) return;
var oldCls = m.oldValue || '';
if (oldCls.indexOf('mask-closing') !== -1) return;
if (hasOpen(oldCls) && !hasOpen(el.className)) {
if (!(el.matches && el.matches(MASK_SEL))) return;
if (el.__mcTimer) { clearTimeout(el.__mcTimer); el.__mcTimer = null; }
el.classList.add('mask-closing');
el.__mcTimer = setTimeout(function () {
el.__mcTimer = null;
try { el.classList.remove('mask-closing'); } catch (e) { if (window.__silent) window.__silent(e); }
}, 200);
} else if (hasOpen(el.className) && el.classList.contains('mask-closing')) {
if (el.__mcTimer) { clearTimeout(el.__mcTimer); el.__mcTimer = null; }
el.classList.remove('mask-closing');
}
});
});
mo.observe(document.documentElement, { subtree: true, attributeFilter: ['class'], attributeOldValue: true });
})();


(function () {
if (window.__fetchBarInstalled) return;
window.__fetchBarInstalled = true;
window.__pageEntryMode = false;

window.__enterPageEntryMode = function () { window.__pageEntryMode = true; };
window.__exitPageEntryMode = function () { window.__pageEntryMode = false; };
var bar = null, active = 0, shown = false, showTimer = null, hideTimer = null, growTimer = null, w = 0;
function ensure() {
if (!bar) { bar = document.createElement('div'); bar.id = 'fetch-bar'; document.body.appendChild(bar); }
return bar;
}
function start() {
active++;
if (active === 1 && !shown) {
clearTimeout(showTimer);
showTimer = setTimeout(function () {
if (active <= 0) return;
shown = true; w = 12;
var b = ensure();
b.style.transform = 'scaleX(0.12)'; b.style.opacity = '1';
clearInterval(growTimer);
growTimer = setInterval(function () {
if (active <= 0 || w >= 86) return;
w += (88 - w) * 0.08;
if (bar) bar.style.transform = 'scaleX(' + (w / 100) + ')';
}, 400);
}, 150);
}
}
function finish() {
if (active > 0) active--;
if (active === 0) {
clearTimeout(showTimer);
clearInterval(growTimer);
if (shown) {
var b = ensure();
b.style.transform = 'scaleX(1)';
clearTimeout(hideTimer);
hideTimer = setTimeout(function () {
b.style.opacity = '0';
setTimeout(function () { if (active === 0 && bar) bar.style.transform = 'scaleX(0)'; }, 250);
shown = false;
}, 180);
}
}
}
var _fetch = window.fetch.bind(window);

var __MUTE_URLS = /\/api\/track\b|\/api\/health\b|\/api\/cleanup\b|\/api\/unlock\b|\/api\/admin\/clear-cache\b|\/api\/admin\/products\?.*prefetch\b|\/api\/admin\/variants\?.*prefetch\b/;
window.fetch = function () {
var p;
try { p = _fetch.apply(window, arguments); } catch (e) { throw e; }
if (!p || typeof p.then !== 'function') return p;
var url = '';
try { url = (typeof arguments[0] === 'string') ? arguments[0] : (arguments[0] && arguments[0].url) || ''; } catch (e) { if (window.__silent) window.__silent(e); }
var muted = __MUTE_URLS.test(url);

if (!muted && window.__pageEntryMode) start();
return p.then(function (r) { if (!muted) finish(); return r; }, function (e) { if (!muted) finish(); throw e; });
};
})();


window.__ctxMenu = (function () {
var menuEl = null;
function ensure() {
if (menuEl) return menuEl;
menuEl = document.createElement('div');
menuEl.className = 'ctx-menu';
menuEl.setAttribute('role', 'menu');
document.body.appendChild(menuEl);
document.addEventListener('touchstart', function (e) { if (!menuEl.contains(e.target)) hide(); }, { passive: true, capture: true });
document.addEventListener('mousedown', function (e) { if (!menuEl.contains(e.target)) hide(); }, true);
window.addEventListener('scroll', hide, { passive: true });
window.addEventListener('resize', hide, { passive: true });
return menuEl;
}
var dimEl = null;
function dimOf() {
if (dimEl) return dimEl;
dimEl = document.createElement('div');
dimEl.className = 'wn-ctx-dim';
document.body.appendChild(dimEl);
return dimEl;
}
function srcOf() { return window.__ctxMenuLastHit && window.__ctxMenuLastHit.nodeType === 1 ? window.__ctxMenuLastHit : null; }
function hide() {
if (menuEl) menuEl.style.display = 'none';

if (dimEl) dimEl.classList.remove('show');
var s = srcOf();
if (s) { s.classList.remove('lift', 'pressed', 'wn-ctx-src'); }
}
function show(x, y, items) {
if (!items || !items.length) return;
var m = ensure();
m.innerHTML = '';
items.forEach(function (it) {
var b = document.createElement('button');
b.type = 'button';
b.className = 'ctx-item';
b.textContent = it.label;
b.addEventListener('click', function (e) { e.stopPropagation(); hide(); try { it.fn(); } catch (err) { if (window.__silent) window.__silent(err); } });
m.appendChild(b);
});
m.style.display = 'block';
m.style.left = '0px';
m.style.top = '0px';
var r = m.getBoundingClientRect();
var px = Math.min(Math.max(8, x), window.innerWidth - r.width - 8);
var py = (y + r.height > window.innerHeight - 8) ? Math.max(8, window.innerHeight - r.height - 8) : y;
m.style.left = px + 'px';
m.style.top = py + 'px';

try {
m.style.setProperty('--ctx-origin', (x > window.innerWidth - r.width - 40 ? 'right top' : 'left top'));
m.classList.remove('ctx-anim'); void m.offsetWidth; m.classList.add('ctx-anim');
} catch (e0) { if (window.__silent) window.__silent(e0); }

try {
dimOf().classList.add('show');
var s = srcOf();
if (s) {
s.classList.add('wn-ctx-src', 'pressed');
setTimeout(function () { s.classList.remove('pressed'); s.classList.add('lift'); }, 90);
}
} catch (e1) { if (window.__silent) window.__silent(e1); }
}
function bind(root, selector, getItems) {
if (!root) return;
var timer = null, sx = 0, sy = 0, lastHit = null;
root.addEventListener('touchstart', function (e) {
if (e.touches.length !== 1) { if (timer) { clearTimeout(timer); timer = null; } return; }
var t = e.touches[0];
var hit = e.target.closest ? e.target.closest(selector) : null;
sx = t.clientX; sy = t.clientY; lastHit = hit;
if (!hit) return;
var cx = t.clientX, cy = t.clientY;
if (timer) clearTimeout(timer);
timer = setTimeout(function () {
timer = null;
window.__ctxMenuLastHit = hit;
show(cx, cy, getItems(hit, e));
}, 500);
}, { passive: true });
root.addEventListener('touchmove', function (e) {
if (!timer) return;
var t = e.touches[0];
if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) { clearTimeout(timer); timer = null; }
}, { passive: true });
root.addEventListener('touchend', function (e) {
if (timer) { clearTimeout(timer); timer = null; return; }

if (menuEl && menuEl.style.display === 'block' && lastHit) { lastHit = null; try { e.preventDefault(); } catch (err) { if (window.__silent) window.__silent(err); } }
}, { passive: false });
root.addEventListener('touchcancel', function () { if (timer) { clearTimeout(timer); timer = null; } }, { passive: true });
root.addEventListener('contextmenu', function (e) {
var hit = e.target.closest ? e.target.closest(selector) : null;
if (!hit) return;
e.preventDefault();
window.__ctxMenuLastHit = hit;
show(e.clientX, e.clientY, getItems(hit, e));
});
}
return { show: show, hide: hide, bind: bind };
})();


window.formatPrice = function (price) {
var p = Number(price) || 0;
if (p <= 0) return '';
if (p === Math.floor(p)) return '¥' + p;
return '¥' + p.toFixed(2);
};

window.__swipeExclude = 'input, textarea, select, video, .rte-editor, .line-chart, .modal-nav-arrow, .cat-picker-panel, .file-folder-wrap, .lightbox, .category-bar, .sub-category-bar, .recent-bar, .recent-bar-wrap, .recent-title, .tabs, .batch-bar, .tb-row2, .upman-host, .pager, .pg-jump, .ctx-menu, .dt-pop, .stat-table-wrap, .bind-table-wrap, .table-scroll' ;

window.__swipeHardExclude = 'input, textarea, select, video, .rte-editor, .file-folder-wrap, .cat-picker-panel, .ctx-menu, .dt-pop, .pg-jump, .modal-nav-arrow, .cover-carousel';
window.__bindSwipeSwitch = function (el, onSwipe, isActive) {
if (!el || !onSwipe) return;
var sx = 0, sy = 0, on = false;
el.addEventListener('touchstart', function (e) {
if (e.touches.length !== 1) { on = false; return; }
if (isActive && !isActive()) { on = false; return; }
var t = e.target;
if (!t || !t.closest) return;

if (window.__swipeHardExclude && t.closest(window.__swipeHardExclude)) { on = false; return; }
if (window.__swipeExclude) {
var sc = t.closest(window.__swipeExclude);
if (sc && sc.scrollWidth > sc.clientWidth + 1) { on = false; return; }
}
sx = e.touches[0].clientX; sy = e.touches[0].clientY; on = true;
}, { passive: true });
el.addEventListener('touchmove', function (e) {

if (!on || !e.touches.length) return;
var mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
if (Math.abs(my) > 24 && Math.abs(my) > Math.abs(mx)) { on = false; return; }

if (Math.abs(mx) >= 10 && Math.abs(mx) >= Math.abs(my) * 1.5) e.preventDefault();

if (el.__swipeOnMove && Math.abs(mx) >= 10 && Math.abs(mx) > Math.abs(my) * 1.5) { try { el.__swipeOnMove(mx); } catch (e0) { if (window.__silent) window.__silent(e0); } }
if (Math.abs(mx) >= 48 && Math.abs(mx) > Math.abs(my) * 1.5) { on = false; onSwipe(mx < 0 ? 1 : -1); }
}, { passive: false });
el.addEventListener('touchend', function (e) {
if (!on) return; on = false;
if (el.__swipeOnMove) { try { el.__swipeOnMove(0); } catch (e9) { if (window.__silent) window.__silent(e9); } }
var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
onSwipe(dx < 0 ? 1 : -1);
}, { passive: true });

var lsx = 0, lsy = 0, lon = false;
el.addEventListener('mousedown', function (e) {
if (e.button !== 0) { lon = false; return; }
if (isActive && !isActive()) { lon = false; return; }
var t = e.target;
if (!t || !t.closest) return;
if (window.__swipeHardExclude && t.closest(window.__swipeHardExclude)) { lon = false; return; }
lsx = e.clientX; lsy = e.clientY; lon = true;
try { document.body.style.userSelect = 'none'; } catch (e2) {}
}, { passive: true });
el.addEventListener('mousemove', function (e) {
if (!lon) return;
var mx = e.clientX - lsx, my = e.clientY - lsy;
if (Math.abs(my) > 24 && Math.abs(my) > Math.abs(mx)) { lon = false; if (el.__swipeOnMove) { try { el.__swipeOnMove(0); } catch (e9) {} } return; }

if (el.__swipeOnMove && Math.abs(mx) >= 10 && Math.abs(mx) > Math.abs(my) * 1.5) { try { el.__swipeOnMove(mx); } catch (e9) {} }
if (Math.abs(mx) >= 60 && Math.abs(mx) > Math.abs(my) * 2) { lon = false; onSwipe(mx < 0 ? 1 : -1); }
}, { passive: true });
el.addEventListener('mouseup', function () { if (lon && el.__swipeOnMove) { try { el.__swipeOnMove(0); } catch (e9) {} } }, { passive: true });
el.addEventListener('mouseup', function () { if (lon) { lon = false; try { document.body.style.userSelect = ''; } catch (e3) {} } }, { passive: true });
el.addEventListener('dragstart', function (e) { if (lon) e.preventDefault(); });
};


window.__followSwipe = function (opts) {
if (!opts || !opts.panel || !opts.commit) return;
var S = null, sx = 0, sy = 0, armed = false, S_saved = null;

document.addEventListener('click', function (e) {
if (!window.__fsJustSwiped) return;
e.preventDefault(); e.stopPropagation();
window.__fsJustSwiped = false;
}, true);
function bgOf(el) {
var n = el;
while (n && n.nodeType === 1) {
var bg = getComputedStyle(n).backgroundColor;
if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
n = n.parentNode;
}
return 'transparent';
}
function cleanup() {
if (!S) return;
try { document.body.style.userSelect = ''; } catch (e3) {}
try { if (opts.onEnd) opts.onEnd(); } catch (e) { if (window.__silent) window.__silent(e); }

try {
if (S.panel && S_saved) {
S.panel.style.cssText = S_saved.css;

var _sp = S_saved.parent, _sn = S_saved.next;
if (_sn && _sn.parentNode === _sp) _sp.insertBefore(S.panel, _sn); else _sp.appendChild(S.panel);
}
} catch (e) { if (window.__silent) window.__silent(e); }
try { if (S.stage && S.stage.parentNode) S.stage.parentNode.removeChild(S.stage); } catch (e) {}
S = null;
}
function startDrag(dir) {
var panel = opts.panel();
if (!panel || !panel.parentNode) return;
var r = panel.getBoundingClientRect();
if (r.width < 60 || r.height < 24) return;
try { document.body.style.userSelect = 'none'; } catch (e2) {}
var nb = opts.neighbor ? opts.neighbor(dir) : null;
var cs = getComputedStyle(panel);
var stage = document.createElement('div');
stage.className = '__fs-stage';
stage.style.cssText = 'position:fixed;z-index:98000;overflow:hidden;pointer-events:none;contain:layout paint;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;background:' + bgOf(panel) + ';border-radius:' + cs.borderRadius + ';';

S_saved = { parent: panel.parentNode, next: panel.nextSibling, css: panel.style.cssText };
panel.style.cssText += ';position:absolute;left:0;top:0;width:100%;margin:0;box-shadow:none;will-change:transform;';
var pA = panel;
var pB = null;

var track = document.createElement('div');
track.className = '__fs-track';
track.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;will-change:transform;backface-visibility:hidden;contain:layout style;pointer-events:none;';
stage.appendChild(track);
if (nb) {
pB = document.createElement('div');

pB.style.cssText = 'position:absolute;left:100%;top:0;width:100%;height:100%;background:' + bgOf(panel) + ';overflow:hidden;contain:paint;backface-visibility:hidden;';
track.appendChild(pB);
}
track.appendChild(panel);
document.body.appendChild(stage);
window.__fsJustSwiped = true;
clearTimeout(window.__fsSwipeClr); window.__fsSwipeClr = setTimeout(function () { window.__fsJustSwiped = false; }, 450);
S = { dir: dir, panel: panel, stage: stage, track: track, pA: pA, pB: pB, w: r.width, nb: nb, off: 0, vx: 0, lx: 0, lt: 0, t0: Date.now() };
if (nb && opts.fill) {

window.__swipeCommitting = true;

requestAnimationFrame(function () {
if (!S) return;
try { opts.fill(nb, dir, pB); } catch (e) { if (window.__silent) window.__silent(e); }
});
}
}
function apply(raw) {
if (!S) return;
S.off = raw;
var off = S.nb ? raw : raw * 0.3;

S.track.style.transform = 'translateX(' + off + 'px)';
if (opts.onProgress && S.nb) {
var prog = Math.max(0, Math.min(1, Math.abs(raw) / S.w));
try { opts.onProgress(prog, S.dir, S.nb); } catch (e) { if (window.__silent) window.__silent(e); }
}
}
function settle(target, cb) {
if (!S || S.settled) return;
S.settled = true;
var commiting = target !== 0;
if (!commiting) {

var t = 'transform .26s cubic-bezier(.34,1.3,.64,1)';
S.track.style.transition = t;
S.track.style.transform = 'translateX(0)';
setTimeout(function () { var d = S ? S.dir : 0; cleanup(); window.__swipeCommitting = false; try { if (window.__haptic && d) window.__haptic(); } catch (eH) {} if (cb) { window.__fsJustSwiped = false; cb(d); } }, 270);
return;
}

var _slide = 'transform .32s cubic-bezier(.3,0,.2,1)';
S.track.style.transition = _slide;
S.track.style.transform = 'translateX(' + (-S.dir * S.w) + 'px)';
setTimeout(function () {
var d = S ? S.dir : 0;

if (cb) { window.__fsJustSwiped = false; try { cb(d); } catch (e) { if (window.__silent) window.__silent(e); } }
requestAnimationFrame(function () { requestAnimationFrame(function () { cleanup(); }); });
}, 335);
}
document.addEventListener('touchstart', function (e) {
if (S) return;
if (e.touches.length !== 1) { armed = false; return; }
if (opts.isActive && !opts.isActive()) { armed = false; return; }
var t = e.target;
if (window.__swipeExclude && t.closest && t.closest(window.__swipeExclude)) { armed = false; return; }
sx = e.touches[0].clientX; sy = e.touches[0].clientY; armed = true;
}, { passive: true });
document.addEventListener('touchmove', function (e) {
if (!armed && !S) return;
if (!e.touches.length) return;
var x = e.touches[0].clientX, y = e.touches[0].clientY;
var dx = x - sx, dy = y - sy;
if (!S) {
if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) { armed = false; return; }

if (Math.abs(dx) >= 10 && Math.abs(dx) >= Math.abs(dy) * 1.5) e.preventDefault();

if (Math.abs(dx) >= 20 && Math.abs(dx) > Math.abs(dy) * 1.2) { armed = false; startDrag(dx < 0 ? 1 : -1); if (S) { S.lx = x; S.lt = Date.now(); apply(dx); } }
return;
}
e.preventDefault();
var now = Date.now();
if (now - S.lt > 0) S.vx = (x - S.lx) / (now - S.lt);
S.lx = x; S.lt = now;
apply(dx);
}, { passive: false });
document.addEventListener('touchend', function () {
if (!S) { armed = false; return; }

var _vAll = Math.abs(S.off) / Math.max(1, Date.now() - S.t0);
var commit = S.nb && ((Math.abs(S.off) > S.w * 0.2) || (S.off * S.dir < 0 && Math.abs(S.off) > 8 && (Math.abs(S.vx) > 0.4 || _vAll > 0.25)));
settle(commit ? -S.dir * S.w : 0, commit ? function (d) { opts.commit(d); } : null);
}, { passive: true });
document.addEventListener('touchcancel', function () {

if (!S) { armed = false; return; }
var commit = S.nb && ((Math.abs(S.off) > S.w * 0.25) || (Math.abs(S.vx) > 0.5 && S.off * S.dir < 0 && Math.abs(S.off) > 8));
settle(commit ? -S.dir * S.w : 0, commit ? function (d) { opts.commit(d); } : null);
armed = false;
}, { passive: true });

var mx0 = 0, my0 = 0, marmed = false, mdragging = false;
document.addEventListener('mousedown', function (e) {
if (e.button !== 0 || S) { marmed = false; return; }
if (opts.isActive && !opts.isActive()) { marmed = false; return; }
var t = e.target;
if (window.__swipeExclude && t.closest && t.closest(window.__swipeExclude)) { marmed = false; return; }
mx0 = e.clientX; my0 = e.clientY; marmed = true; mdragging = false;
}, { passive: true });
document.addEventListener('mousemove', function (e) {
if (mdragging && S) { e.preventDefault(); apply(e.clientX - mx0); return; }
if (!marmed) return;
var dx = e.clientX - mx0, dy = e.clientY - my0;
if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) { marmed = false; return; }
if (Math.abs(dx) >= 26 && Math.abs(dx) > Math.abs(dy) * 2) {
marmed = false; mdragging = true;
startDrag(dx < 0 ? 1 : -1);
if (S) apply(dx);
}
}, { passive: false });
document.addEventListener('mouseup', function () {
if (!mdragging) { marmed = false; return; }
mdragging = false; marmed = false;
if (!S) return;
var commit = S.nb && (Math.abs(S.off) > S.w * 0.25 || Math.abs(S.off) > 40);
settle(commit ? -S.dir * S.w : 0, commit ? function (d) { opts.commit(d); } : null);
}, { passive: true });
};

window.bindLightbox = function (root) {
if (!root) return;
root.querySelectorAll('img').forEach(function (im) {
if (im.dataset.lb) return;
im.dataset.lb = '1';
im.style.cursor = 'zoom-in';
im.addEventListener('click', function (ev) {
ev.stopPropagation();

var srcs = Array.prototype.map.call(root.querySelectorAll('img'), function (x2) { return x2.currentSrc || x2.src; });
window.openLightbox(im.currentSrc || im.src, { list: srcs, from: im });
});
});
root.querySelectorAll('video').forEach(function (v) {
if (v.dataset.lb) return;
v.dataset.lb = '1';
v.style.cursor = 'zoom-in';
v.addEventListener('click', function (ev) { ev.stopPropagation(); v.pause(); window.openLightbox(v.currentSrc || v.src); });
});
};
window.triggerViewAnim = function (el) { if (!el) return; el.classList.remove('view-switch-anim'); void el.offsetWidth; el.classList.add('view-switch-anim'); };

window.__btnSuccess = function(btn, doneText) {
if (!btn) return;
var originalText = btn.dataset.__btnOriginal || '';
var originalHTML = btn.dataset.__btnOriginalHtml || '';
if (!originalText && !originalHTML) {
originalText = btn.textContent || '';
btn.dataset.__btnOriginal = originalText;
btn.dataset.__btnOriginalHtml = btn.innerHTML;
}
btn.innerHTML = '<span style="display:inline-block;transform:scale(0.6);animation:btnSuccessPop 120ms var(--ease-out, ease) forwards;">✓</span> ' + (doneText || '');
btn.disabled = true;
setTimeout(function() {
btn.innerHTML = btn.dataset.__btnOriginalHtml || btn.dataset.__btnOriginal || '';
btn.disabled = false;
delete btn.dataset.__btnOriginal;
delete btn.dataset.__btnOriginalHtml;
}, 600);
};


window.FlipAnimator = function (container) {
this.container = typeof container === 'string' ? document.querySelector(container) : container;
this.isAnimating = false;
this._gen = 0;
};
window.FlipAnimator.prototype.finish = function () {
this._gen++;
if (this._cleanupTimer) { clearTimeout(this._cleanupTimer); this._cleanupTimer = null; }
if (this._animEls) {
var els = this._animEls;
for (var i = 0; i < els.length; i++) {
var s = els[i].style;
s.removeProperty('transition'); s.removeProperty('transition-delay');
s.removeProperty('transform'); s.removeProperty('transform-origin');
}
this._animEls = null;
}
if (this.container) this.container.style.pointerEvents = '';
this.isAnimating = false;
window.__flipAnimating = false;
};
window.FlipAnimator.prototype.flip = function (mutateFn, options) {
var self = this;
var opts = options || {};
var duration = opts.duration || 300;
var easing = opts.easing || 'var(--ease-emphasized)';
var stagger = (opts.stagger !== undefined) ? opts.stagger : 20;
var maxStagger = (opts.maxStagger !== undefined) ? opts.maxStagger : 180;
if (!this.container || typeof mutateFn !== 'function') return false;
if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { mutateFn(); return false; }
if (!('transform' in document.body.style)) { mutateFn(); return false; }
if (this.isAnimating) this.finish();
this.isAnimating = true;
var gen = ++this._gen;
window.__flipAnimating = true;
this.container.style.pointerEvents = 'none';
var children = Array.prototype.slice.call(this.container.children, 0, 20);
var firstStates = children.map(function (el) {
var r = el.getBoundingClientRect();
return { el: el, x: r.left, y: r.top, w: r.width, h: r.height };
});
mutateFn();
firstStates.forEach(function (st) {
var r = st.el.getBoundingClientRect();
var dx = st.x - r.left, dy = st.y - r.top;
var dw = r.width ? st.w / r.width : 1, dh = r.height ? st.h / r.height : 1;
if (!dx && !dy && dw === 1 && dh === 1) { st.skip = true; return; }
var s = st.el.style;
s.setProperty('transition', 'none', 'important');
s.setProperty('transform', 'translate(' + dx + 'px,' + dy + 'px) scale(' + dw + ',' + dh + ')', 'important');
s.setProperty('transform-origin', 'top left', 'important');
});
void this.container.offsetHeight;
requestAnimationFrame(function () {
requestAnimationFrame(function () {
if (gen !== self._gen) return;
firstStates.forEach(function (st, i) {
if (st.skip) return;
var delay = Math.min(i * stagger, maxStagger);
var s = st.el.style;
s.setProperty('transition', 'transform ' + duration + 'ms ' + easing, 'important');
s.setProperty('transition-delay', delay + 'ms', 'important');
s.removeProperty('transform');
});
});
});
this._animEls = children;
this._cleanupTimer = setTimeout(function () {
firstStates.forEach(function (st) {
st.el.style.removeProperty('transition');
st.el.style.removeProperty('transition-delay');
st.el.style.removeProperty('transform');
st.el.style.removeProperty('transform-origin');
});
self.container.style.pointerEvents = '';
self.isAnimating = false;
window.__flipAnimating = false;
}, duration + maxStagger + 50);
return true;
};


window.uiToast = (function () {
var q = [], busy = false;

var __undoStack = [];
function __relayoutUndo() {
var base = __toastTop() + 8;
__undoStack.forEach(function (x, i) { try { x.style.top = (base + i * 54) + 'px'; } catch (e) { if (window.__silent) window.__silent(e); } });
}
function showImmediate(it) {
var t = document.createElement('div');
t.className = 'ui-toast' + (it.t === 'error' ? ' error' : ''); t.setAttribute('role','status'); t.setAttribute('aria-live','polite');
__undoStack.push(t); __relayoutUndo();
var left = Math.round(((window.WN_CONST && window.WN_CONST.UNDO_MS) || 10000) / 1000), done = false;
var txt = document.createElement('span'); txt.textContent = it.m;
var btn = document.createElement('button');
btn.type = 'button'; btn.className = 'undo-btn'; btn.textContent = '撤销（' + left + 's）';

var __deadline = Date.now() + ((window.WN_CONST && window.WN_CONST.UNDO_MS) || 10000);
var timer = setInterval(function () {
left = Math.ceil((__deadline - Date.now()) / 1000);
if (left <= 0) { clearInterval(timer); btn.textContent = '撤销'; cleanup(); return; }
btn.textContent = '撤销（' + left + 's）';
}, 1000);
function cleanup() {

done = true;
clearInterval(timer);
try { if (t.parentNode) t.parentNode.removeChild(t); } catch (e) { if (window.__silent) window.__silent(e); }
var ix = __undoStack.indexOf(t); if (ix > -1) __undoStack.splice(ix, 1);
__relayoutUndo();
}
btn.addEventListener('click', function () {
if (done) return;
done = true; clearInterval(timer);
try { it.undo(); } catch (e) { if (window.__silent) window.__silent(e); }
try { window.uiToast('已撤销', 'success'); } catch (e) { if (window.__silent) window.__silent(e); }
cleanup();
});
t.appendChild(txt); t.appendChild(btn);
document.body.appendChild(t);
setTimeout(cleanup, (((window.WN_CONST && window.WN_CONST.UNDO_MS) || 10000) + 500));
}

function __toastTop() {
try {
var tb = document.querySelector('.topbar');
if (tb) {
var b = tb.getBoundingClientRect().bottom;
if (b > 0) return Math.round(b + 12);
}
} catch (e) { if (window.__silent) window.__silent(e); }
return 80;
}
function next() {
if (!q.length) { busy = false; return; }
busy = true;
var it = q.shift();
var t = document.createElement('div');
t.className = 'ui-toast' + (it.t === 'error' ? ' error' : ''); t.setAttribute('role','status'); t.setAttribute('aria-live','polite'); t.style.top = __toastTop() + 'px';
if (it.undo) { showImmediate(it); busy = false; next(); return; }
t.textContent = it.m;
document.body.appendChild(t);
setTimeout(function () { t.classList.add('leaving'); }, 2000);
setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); next(); }, 2300);
}
return function (msg, type, undoFn) {
if (undoFn) { showImmediate({ m: String(msg || ''), t: type || '', undo: undoFn }); return; }
q.push({ m: String(msg || ''), t: type || '', undo: null });
if (!busy) next();
};
})();



window.__wrapSelects = function (root) {

try {
if (typeof window.__upgradeSelects === 'function') return window.__upgradeSelects(root || document);
var scope = root || document;
var list = scope.querySelectorAll ? scope.querySelectorAll('select') : [];
for (var i = 0; i < list.length; i++) {
var sel = list[i];
if (sel.dataset && sel.dataset.sp) continue;
if (typeof window.makeSelectPicker === 'function') window.makeSelectPicker(sel);
}
} catch (e) {}
};

window.__btnFit = function () {
try {
var groups = document.querySelectorAll('.btn-fit-group, .batch-group');
for (var g = 0; g < groups.length; g++) {
var grp = groups[g];

var avail = grp.clientWidth;

if (!avail) {
if (!grp.__btnFitRO && window.ResizeObserver) {
grp.__btnFitRO = new ResizeObserver(function () {
clearTimeout(window.__btnFitTimer);
window.__btnFitTimer = setTimeout(function () { window.__btnFit(); }, 120);
});
grp.__btnFitRO.observe(grp);
}
continue;
}
var btns = Array.prototype.slice.call(grp.querySelectorAll('.btn-fit[data-pri]'));
if (!btns.length) continue;

if (!grp.__btnFitRO && window.ResizeObserver) {
grp.__btnFitRO = new ResizeObserver(function () {
clearTimeout(window.__btnFitTimer);
window.__btnFitTimer = setTimeout(function () { window.__btnFit(); }, 120);
});
grp.__btnFitRO.observe(grp);
}
btns.sort(function (a, b) { return (Number(a.dataset.pri) || 99) - (Number(b.dataset.pri) || 99); });

for (var i = 0; i < btns.length; i++) btns[i].classList.remove('ico-only');
for (var j = btns.length - 1; j >= 0; j--) {
if (grp.scrollWidth <= avail + 1) break;
btns[j].classList.add('ico-only');
}

for (var k = 0; k < btns.length; k++) {
var bt = btns[k];
if (bt.classList.contains('ico-only')) continue;
var clipped = bt.scrollWidth > bt.clientWidth + 1;
if (!clipped) {
var lab = bt.querySelector('.btn-lab');
if (lab && lab.scrollWidth > lab.clientWidth + 1) clipped = true;
}
if (clipped) bt.classList.add('ico-only');
}
}
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.addEventListener('resize', function () {
clearTimeout(window.__btnFitTimer);
window.__btnFitTimer = setTimeout(function () { window.__btnFit(); }, 150);
});



window.__modalScroll = (function () {
var lastKey = {};
var posMap = {};
function scrollers(mask) {
var list = [mask];
try {
var inl = mask.querySelectorAll('.modal-box, .form, .rte-editor, .preview-body, [id="bindingsScroll"]');
Array.prototype.forEach.call(inl, function (el) { if (list.indexOf(el) === -1) list.push(el); });
} catch (e) { if (window.__silent) window.__silent(e); }
return list;
}
function open(mask, objKey) {
if (!mask) return;
var mk = mask.id || '';
if (!mk) return;
if (objKey == null) { lastKey[mk] = null; return; }
var key = String(objKey);
var prev = lastKey[mk];
var scs = scrollers(mask);
if (prev != null && prev !== key) {

scs.forEach(function (el, i) { posMap[mk + '|' + prev + '|' + i] = el.scrollTop || 0; });
}
scs.forEach(function (el, i) {
var saved = (prev === key) ? (el.scrollTop || 0) : posMap[mk + '|' + key + '|' + i];
el.scrollTop = (saved != null) ? saved : 0;
});
lastKey[mk] = key;
}
function forget(mask, objKey) {
if (!mask) return;
var mk = mask.id || '';
if (!mk) return;
var key = (objKey == null) ? lastKey[mk] : String(objKey);
if (key == null) return;
scrollers(mask).forEach(function (el, i) { try { delete posMap[mk + '|' + key + '|' + i]; } catch (e) { if (window.__silent) window.__silent(e); } });
if (lastKey[mk] === key) lastKey[mk] = null;
}
return { open: open, forget: forget };
})();

window.warn = function (t) {
if (document.getElementById('__deployWarn')) return;
var b = document.createElement('div');
b.id = '__deployWarn';
b.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:100200;background:var(--red-strong);color:#fff;font:14px/1.6 sans-serif;padding:10px 14px;text-align:center;box-shadow:var(--shadow-pop,0 4px 16px rgba(0,0,0,0.14))';
b.textContent = t;
if (document.body) document.body.appendChild(b);
document.addEventListener('DOMContentLoaded', function () { if (!b.parentNode && document.body) document.body.appendChild(b); });
};


window.__cpPanel = function (opts) {
if (!window.__uiCommonLoaded) return;
if (window.__cpPanelInst) { window.__cpPanelInst.setCmds(opts && opts.cmds); return; }
opts = opts || {};
var getCmds = opts.cmds || function () { return []; };
var getStatus = opts.status || function () { return null; };
var busySel = opts.busy || '.modal-mask.open, .kf-mask.open, .share-mask.open, .ann-mask.open';

var mask = document.createElement('div');
mask.className = 'cp-mask'; mask.id = 'cpMask';
mask.innerHTML =
'<div class="cp-box" role="dialog" aria-label="命令面板">' +
'<input class="cp-input" id="cpInput" autocomplete="off" />' +
'<div class="cp-list" id="cpList"></div>' +
'</div>';
document.body.appendChild(mask);
var input = mask.querySelector('#cpInput'), listEl = mask.querySelector('#cpList');
var items = [], active = 0;

function cpClose() { mask.classList.remove('open'); input.value = ''; input.blur(); }
function cpRender() {
var kw = input.value.trim().toLowerCase();
var all = [];
try { all = getCmds() || []; } catch (e) { if (window.__silent) window.__silent(e); }
items = !kw ? all : all.filter(function (c) { return (c.lab + ' ' + c.kw).toLowerCase().indexOf(kw) !== -1; });
items = items.slice(0, 10); active = Math.min(active, Math.max(0, items.length - 1));
if (!items.length) {

var _st = getStatus();
if (_st === 'loading') { listEl.innerHTML = '<div class="cp-empty">搜索中…</div>'; return; }
if (_st === 'error') { listEl.innerHTML = '<div class="cp-empty">搜索失败，请重试</div>'; return; }
listEl.innerHTML = '<div class="cp-empty">没有匹配的命令</div>'; return;
}
listEl.innerHTML = '';
items.forEach(function (c, i) {
var it = document.createElement('div');
it.className = 'cp-item' + (i === active ? ' active' : '');
var lab = document.createElement('span'); lab.className = 'cp-lab'; lab.textContent = c.lab;
var tag = document.createElement('span'); tag.className = 'cp-tag'; tag.textContent = c.tag;
it.appendChild(lab); it.appendChild(tag);
it.addEventListener('mouseenter', function () { active = i; cpPaint(); });
it.addEventListener('click', function () { cpRun(i); });
listEl.appendChild(it);
});
}
function cpPaint() {
Array.prototype.forEach.call(listEl.querySelectorAll('.cp-item'), function (el, i) { el.classList.toggle('active', i === active); });
var cur = listEl.querySelectorAll('.cp-item')[active]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
}
function cpRun(i) { var c = items[i]; if (!c) return; cpClose(); try { c.run(); } catch (e) { if (window.__silent) window.__silent(e); } }

input.addEventListener('input', function () { active = 0; cpRender(); });
mask.addEventListener('click', function (e) { if (e.target === mask) cpClose(); });
input.addEventListener('keydown', function (e) {
if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { active = (active + 1) % items.length; cpPaint(); } }
else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { active = (active - 1 + items.length) % items.length; cpPaint(); } }
else if (e.key === 'Enter') { e.preventDefault(); cpRun(active); }
else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cpClose(); }
});
document.addEventListener('keydown', function (e) {
if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
e.preventDefault();
if (mask.classList.contains('open')) { cpClose(); return; }
if (busySel && document.querySelector(busySel)) return;
active = 0; cpRender(); mask.classList.add('open'); setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e1) { input.focus(); } }, 0);
}
});
var tryReg = function () {
if (window.__modalKit) { window.__modalKit.register(mask, { discard: cpClose, stash: cpClose }); return true; }
return false;
};
if (!tryReg()) {
var n = 0;
var t = setInterval(function () { if (tryReg() || ++n > 40) clearInterval(t); }, 50);
}
window.__cpPanelInst = { setCmds: function (fn) { if (fn) getCmds = fn; }, refresh: function () { if (mask.classList.contains('open')) cpRender(); } };
};


window.__imgVer = function () {
try { return String(window.IMG_VERSION || '330').replace(/^v/, ''); } catch (e) { return '330'; }
};

window.__kefuQrSrc = function () { return window.__contactQr || ''; };



(function () {
function syncImgVersion() {
try {
var v = window.IMG_VERSION;
if (!v) return;
v = String(v).replace(/^v/, '');
var imgs = document.querySelectorAll('img[src*="/assets/images/"]');
for (var i = 0; i < imgs.length; i++) {
var im = imgs[i];
var src = im.getAttribute('src') || '';
if (src.indexOf('?v=' + v) !== -1) continue;
var base = src.split('?')[0];
im.setAttribute('src', base + '?v=' + v);
}
} catch (e) { if (window.__silent) window.__silent(e); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncImgVersion);
else syncImgVersion();
})();


(function () {
function runA11y() {
try {
var bs = document.querySelectorAll('button, [role="button"], a[title]');
for (var i = 0; i < bs.length; i++) {
var b = bs[i];
if (b.getAttribute('aria-label')) continue;
var t = b.getAttribute('title');
if (!t) continue;
b.setAttribute('aria-label', t);
}
} catch (e) { if (window.__silent) window.__silent(e); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runA11y);
else runA11y();

var __n = 0;
var __t = setInterval(function () { runA11y(); if (++__n > 10) clearInterval(__t); }, 800);
})();


window.__showLoadRetry = function (container, retryFn) {
try {
if (!container) return;
var old = container.querySelector('.load-retry');
if (old) old.parentNode.removeChild(old);
var box = document.createElement('div');
box.className = 'load-retry';
var t = document.createElement('div');
t.textContent = '网络没连上，稍后再试';
var b = document.createElement('button');
b.type = 'button'; b.className = 'lr-btn'; b.textContent = '重试';
b.addEventListener('click', function () {
if (b.disabled) return;
b.disabled = true; b.textContent = '重试中…';
try { window.__clearLoadRetry(container); } catch (e) { if (window.__silent) window.__silent(e); }
try { if (retryFn) retryFn(); } catch (e2) { if (window.__silent) window.__silent(e2); }
});
box.appendChild(t); box.appendChild(b);
container.appendChild(box);
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.__clearLoadRetry = function (container) {
try {
if (!container) return;
var el = container.querySelector('.load-retry');
if (el && el.parentNode) el.parentNode.removeChild(el);
} catch (e) { if (window.__silent) window.__silent(e); }
};


window.__renderCarousel = function (carouselEl, trackEl, dotsEl, fallbackImgEl, images, ph) {
if (!carouselEl || !trackEl) return;
if (carouselEl.__ccTimer) { clearInterval(carouselEl.__ccTimer); carouselEl.__ccTimer = null; }
if (!images || images.length <= 1) {
carouselEl.style.display = 'none';
if (fallbackImgEl) {
fallbackImgEl.style.display = '';
fallbackImgEl.src = images && images[0] ? images[0] : '';
}
return;
}
carouselEl.style.display = '';
if (fallbackImgEl) fallbackImgEl.style.display = 'none';
var st = carouselEl.__ccState || (carouselEl.__ccState = { idx: 0, len: images.length });
st.idx = 0; st.len = images.length;
trackEl.innerHTML = '';
images.forEach(function (url, i) {
var slide = document.createElement('div');
slide.className = 'cc-slide';
var img = document.createElement('img');
img.alt = '封面图 ' + (i + 1);
img.decoding = 'async';
if (i === 0) img.className = 'cover-enter';
img.style.opacity = '0';
img.style.cursor = 'zoom-in';
img.onload = function () { img.style.opacity = '1'; };
img.onerror = function () { img.style.opacity = '1'; img.classList.add('media-fail'); img.src = ph || window.__IMG_PLACEHOLDER || ''; };
img.addEventListener('click', function () {
if (trackEl.__ccDragged) { trackEl.__ccDragged = false; return; }

if (window.openLightbox) window.openLightbox(url, { list: images.slice(), from: img });
});
slide.appendChild(img);
img.src = url;
trackEl.appendChild(slide);
});
if (dotsEl) {
dotsEl.innerHTML = '';
images.forEach(function (_, i) {
var dot = document.createElement('span');
dot.className = 'cc-dot' + (i === 0 ? ' active' : '');
dot.addEventListener('click', function () { goToSlide(i); });
dotsEl.appendChild(dot);
});
}
function goToSlide(idx) {
st.idx = (idx + st.len) % st.len;

trackEl.style.transition = 'transform .32s cubic-bezier(.34,1.3,.64,1)';
trackEl.style.transform = 'translateX(-' + (st.idx * 100) + '%)';
clearTimeout(trackEl.__ccTrT);
trackEl.__ccTrT = setTimeout(function () { trackEl.style.transition = ''; }, 340);
}

var __sx = 0, __dx = 0, __drag = false;
trackEl.style.touchAction = 'pan-y';
carouselEl.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) return; __sx = e.touches[0].clientX; __dx = 0; __drag = true; trackEl.style.transition = 'none'; }, { passive: true });
carouselEl.addEventListener('touchmove', function (e) { if (!__drag || !e.touches.length) return; __dx = e.touches[0].clientX - __sx; trackEl.style.transform = 'translateX(calc(-' + (st.idx * 100) + '% + ' + __dx + 'px))'; }, { passive: true });
carouselEl.addEventListener('touchend', function () {
if (!__drag) return; __drag = false;
var _th = (carouselEl.offsetWidth || 320) * 0.18;
if (__dx < -_th && st.idx < images.length - 1) st.idx++;
else if (__dx > _th && st.idx > 0) st.idx--;
trackEl.style.transition = 'transform .32s cubic-bezier(.34,1.3,.64,1)';
trackEl.style.transform = 'translateX(-' + (st.idx * 100) + '%)';
clearTimeout(trackEl.__ccTrT); trackEl.__ccTrT = setTimeout(function () { trackEl.style.transition = ''; }, 340);
if (dotsEl) dotsEl.querySelectorAll('.cc-dot').forEach(function (d, i) { d.classList.toggle('active', i === st.idx); });
__dx = 0;
});
if (dotsEl) dotsEl.querySelectorAll('.cc-dot').forEach(function (d, i) { d.classList.toggle('active', i === st.idx); });
restartTimer();
function pause() { if (carouselEl.__ccTimer) { clearInterval(carouselEl.__ccTimer); carouselEl.__ccTimer = null; } }
function restartTimer() { pause(); carouselEl.__ccTimer = setInterval(function () { goToSlide(st.idx + 1); }, 3000); }
carouselEl.__ccPause = pause;
if (!carouselEl.__ccBound) {
carouselEl.__ccBound = true;
carouselEl.addEventListener('mouseenter', function () { pause(); });
carouselEl.addEventListener('mouseleave', function () { restartTimer(); });
carouselEl.addEventListener('touchstart', function () { pause(); }, { passive: true });
carouselEl.addEventListener('touchend', function () { restartTimer(); });
trackEl.addEventListener('touchstart', function (e) { trackEl.__ccStartX = e.touches[0].clientX; trackEl.__ccDrag = true; trackEl.__ccDragged = false; trackEl.classList.add('dragging'); }, { passive: true });
trackEl.addEventListener('touchmove', function (e) { if (!trackEl.__ccDrag) return; trackEl.__ccDragged = true; var dx = e.touches[0].clientX - trackEl.__ccStartX; trackEl.style.transform = 'translateX(calc(-' + (st.idx * 100) + '% + ' + dx + 'px))'; }, { passive: true });
trackEl.addEventListener('touchend', function (e) {
trackEl.__ccDrag = false; trackEl.classList.remove('dragging');
var dx = (e.changedTouches[0] || e.touches[0]).clientX - trackEl.__ccStartX;
if (dx < -40) goToSlide(st.idx + 1);
else if (dx > 40) goToSlide(st.idx - 1);
else goToSlide(st.idx);
});
trackEl.addEventListener('mousedown', function (e) { trackEl.__ccStartX = e.clientX; trackEl.__ccDrag = true; trackEl.__ccDragged = false; trackEl.classList.add('dragging'); e.preventDefault(); });
trackEl.addEventListener('mousemove', function (e) { if (!trackEl.__ccDrag) return; trackEl.__ccDragged = true; var dx = e.clientX - trackEl.__ccStartX; trackEl.style.transform = 'translateX(calc(-' + (st.idx * 100) + '% + ' + dx + 'px))'; });
trackEl.addEventListener('mouseup', function (e) {
trackEl.__ccDrag = false; trackEl.classList.remove('dragging');
var dx = e.clientX - trackEl.__ccStartX;
if (dx < -40) goToSlide(st.idx + 1);
else if (dx > 40) goToSlide(st.idx - 1);
else goToSlide(st.idx);
});
trackEl.addEventListener('mouseleave', function () { if (trackEl.__ccDrag) { trackEl.__ccDrag = false; trackEl.classList.remove('dragging'); goToSlide(st.idx); } });
}
restartTimer();
};




var __PH_LIGHT_80 = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 24 24%22%3E%3Crect width=%2224%22 height=%2224%22 rx=%223%22 fill=%22%23f5f5f5%22/%3E%3Cpath d=%22M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z%22 fill=%22%23c3ccd6%22/%3E%3Ccircle cx=%2212%22 cy=%2217.5%22 r=%221.7%22 fill=%22%23c3ccd6%22/%3E%3C/svg%3E';;
var __PH_DARK_80 = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 24 24%22%3E%3Crect width=%2224%22 height=%2224%22 rx=%223%22 fill=%22%232b3a4c%22/%3E%3Cpath d=%22M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z%22 fill=%22%2355697f%22/%3E%3Ccircle cx=%2212%22 cy=%2217.5%22 r=%221.7%22 fill=%22%2355697f%22/%3E%3C/svg%3E';
Object.defineProperty(window, '__IMG_PLACEHOLDER', { configurable: true, get: function () {
try { return document.documentElement.getAttribute('data-theme') === 'dark' ? __PH_DARK_80 : __PH_LIGHT_80; } catch (e) { return __PH_LIGHT_80; }
} });
window.__logoFail = function (im) {
try {
im.onerror = null;
im.src = (window.__IMG_PLACEHOLDER || ''); if (im && im.classList) im.classList.add('media-fail'); im.style.display = 'block'; im.style.opacity = '1'; if (im.parentNode) { im.parentNode.style.opacity = '1'; if (!im.parentNode.classList.contains('logo-enter')) im.parentNode.classList.add('logo-enter'); } } catch (e) { if (window.__silent) window.__silent(e); } };


window.__setPagerDisabled = function (btn, disabled) { btn.disabled = disabled; btn.style.opacity = disabled ? '0.4' : ''; };


window.__btnIcon = function (name) {
var P = {
edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/><path d="M14.5 5.5l4 4"/>',
copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h8"/>',
hide: '<path d="M3 3l18 18"/><path d="M10.6 5.2A7.5 7.5 0 0112 5c5 0 9 7 9 7a15 15 0 01-2.3 3"/><path d="M6.3 6.4A15 15 0 003 12s4 7 9 7a7.4 7.4 0 003.2-.7"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
show: '<path d="M3 12s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z"/><circle cx="12" cy="12" r="3"/>',
del: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
code: '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/>',

key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3"/><path d="M17 6l3 3"/>',
bind: '<path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 016 6l-1 1"/><path d="M13 18l-1 1a4 4 0 01-6-6l1-1"/>',
add: '<path d="M12 5v14"/><path d="M5 12h14"/>',
save: '<path d="M5 4h11l3 3v13H5z"/><path d="M9 4v5h6V4"/><path d="M8 20v-6h8v6"/>',
close: '<path d="M6 6l12 12M18 6L6 18"/>',
share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
service: '<path d="M4 13a8 8 0 018-8 8 8 0 018 8v1a3 3 0 01-3 3H7a3 3 0 01-3-3z"/><path d="M9 13h.01M12 13h.01M15 13h.01"/>',
export: '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 21h16"/>',
cat: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="15" width="7" height="5" rx="1.5"/><rect x="14" y="15" width="7" height="5" rx="1.5"/>',
refresh: '<path d="M20 12a8 8 0 10-3 6.2"/><path d="M20 6v6h-6"/>',
check: '<path d="M4 12l5 5L20 6"/>',
up: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
stats: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',

price: '<circle cx="12" cy="12" r="9"/><path d="M8.5 7.5L12 12l3.5-4.5"/><path d="M12 12v5"/><path d="M9 13.5h6M9 16h6"/>',

logout: '<path d="M9 4h7a2 2 0 012 2v12a2 2 0 01-2 2H9"/><path d="M13 12H3"/><path d="M6 9l-3 3 3 3"/>',
search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
down: '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 21h14"/>',
list: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',
gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/>'
};
var d = P[name];
if (!d) return '';
return '<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
};

window.__autoDecorate = function (root) {
try {
var scope = root || document;
var MAP = [
[/确定|保存|提交/, 'save'], [/退出/, 'logout'], [/取消|关闭|返回/, 'close'], [/删除/, 'del'], [/编辑/, 'edit'],
[/复制/, 'copy'], [/显示|查看|预览/, 'show'], [/隐藏/, 'hide'], [/新增|添加/, 'add'],
[/重试|刷新|换一?张/, 'refresh'], [/导出/, 'export'], [/上传/, 'up'], [/下载/, 'down'],
[/改分类|分类/, 'cat'], [/改价格|价格/, 'price'],
[/搜索/, 'search'], [/分享|发送/, 'share'], [/客服|咨询/, 'service'], [/登录/, 'check'], [/全选/, 'check'],

[/采集|抓取|自动|定时/, 'refresh'], [/打开|前往|访问/, 'show'], [/粘贴|录入/, 'add'], [/上架|发布/, 'up'],
[/缓存|回收|恢复/, 'refresh'], [/信息|账号|权限/, 'gear'], [/密码/, 'key'], [/密码/, 'key'], [/公告|通知/, 'share'], [/日志|记录/, 'list'], [/体检|检查/, 'check'],
[/恢复|还原/, 'refresh'], [/清空|清除/, 'close'], [/批量/, 'list'], [/统计|报表/, 'stats'],
[/设置|配置/, 'gear'], [/排序/, 'list'], [/测试|测一下/, 'check'], [/移动|分类/, 'cat']
];
var skip = '.btn-fit, .view-btn, .rte-btn, .rte-expand, .cat-fold, .search-clear, .modal-close-x, .fc-arrow, [data-noico]';
var btns = scope.querySelectorAll('button, .btn-blue, .batch-btn');
for (var i = 0; i < btns.length; i++) {
var b = btns[i];

if (b.querySelector('svg')) continue;
if (b.matches(skip) || b.closest('.ctx-menu, .rte-toolbar') || b.querySelector('.btn-ico')) continue;
var t = (b.textContent || '').trim();
if (!t) continue;
for (var k = 0; k < MAP.length; k++) {
if (MAP[k][0].test(t)) {
var pr = /确定|保存|编辑|显示/.test(t) ? 1 : (/删除|取消|关闭/.test(t) ? 6 : 3);
window.__decorateBtn(b, MAP[k][1], pr);
break;
}
}
}
} catch (e) { if (window.__silent) window.__silent(e); }
};

window.__autoDecorateTabs = function () {
try {
var M = { products: 'list', categories: 'cat', stats: 'stats', settings: 'gear' };
document.querySelectorAll('.tab[data-tab]').forEach(function (t) {
var ic = M[t.dataset.tab];
if (ic && window.__decorateBtn) window.__decorateBtn(t, ic, 2);
});
} catch (e) { if (window.__silent) window.__silent(e); }
};

window.__markFitGroups = function () {
try {
var SEL = '.setting-row.is-inline, .modal-footer, .extc-pops, .extc-bar, .logs-tools, .info-panel-btns, .batch-group, .tbl-opbar, .usf-body .pm-actions';
var list = document.querySelectorAll(SEL);
for (var i = 0; i < list.length; i++) list[i].classList.add('btn-fit-group');
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.__refreshIcons = function () {
try { window.__autoDecorate(); window.__markFitGroups(); if (window.__btnFit) window.__btnFit(); } catch (e) { if (window.__silent) window.__silent(e); }
};
window.addEventListener('DOMContentLoaded', function () {
setTimeout(function () { window.__refreshIcons(); window.__autoDecorateTabs(); }, 60);

var n = 0;
var t = setInterval(function () { window.__refreshIcons(); if (++n > 16) clearInterval(t); }, 1200);
window.addEventListener('resize', function () { clearTimeout(window.__icoT); window.__icoT = setTimeout(window.__refreshIcons, 200); });
document.addEventListener('click', function () { clearTimeout(window.__icoT); window.__icoT = setTimeout(window.__refreshIcons, 300); }, true);
});


window.__setBatchBar = function (bar, on) {
if (!bar) return;
if (on) {
bar.classList.add('show');
bar.style.maxHeight = bar.scrollHeight + 'px';
bar.style.marginBottom = '12px';
} else {
bar.style.maxHeight = '0px';
bar.style.marginBottom = '0px';
bar.classList.remove('show');
}
};


window.__decorateBtn = function (btn, iconName, pri) {
if (!btn || !window.__btnIcon) return btn;
try {
if (btn.querySelector('.btn-ico')) return btn;
var svg = window.__btnIcon(iconName);
if (!svg) return btn;
var lab = btn.querySelector('.btn-lab');
if (!lab) {
lab = document.createElement('span');
lab.className = 'btn-lab';
lab.textContent = btn.textContent;
btn.textContent = '';
btn.appendChild(lab);
}
btn.insertAdjacentHTML('afterbegin', svg);
btn.classList.add('btn-fit');

if (pri && !btn.hasAttribute('data-pri')) btn.setAttribute('data-pri', String(pri));
} catch (e) { if (window.__silent) window.__silent(e); }
return btn;
};


window.__sanitizeCore = function (html) {
if (!html) return '';
var allowed = { A:1, BR:1, P:1, STRONG:1, EM:1, B:1, I:1, U:1, S:1, SPAN:1, DIV:1, FONT:1,
UL:1, OL:1, LI:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, BLOCKQUOTE:1, CODE:1, PRE:1, HR:1,
IMG:1, VIDEO:1, SOURCE:1,
TABLE:1, TBODY:1, THEAD:1, TR:1, TD:1, TH:1, INPUT:1,
SVG:1, PATH:1, POLYLINE:1, LINE:1, POLYGON:1, RECT:1, CIRCLE:1, ELLIPSE:1, G:1, DEFS:1, USE:1, TEXT:1 };
var allowedAttrs = {
A: ['href','target','rel','title','data-dl'],
IMG: ['src','alt','title','style','width','height'],
VIDEO: ['src','controls','autoplay','loop','muted','poster','style','width','height'],
SOURCE: ['src','type'],
SPAN: ['style','color','data-action'],
FONT: ['color','size','face'],
DIV: ['style','data-file-id','data-file-type','data-action','data-folder-list','data-key','data-size','data-ftype'],
P: ['style'],
H1: ['style'], H2: ['style'], H3: ['style'], H4: ['style'], H5: ['style'], H6: ['style'],
LI: ['style'], UL: ['style'], OL: ['style'],
BLOCKQUOTE: ['style'], CODE: ['style'], PRE: ['style'],
TABLE: ['style','width'], TBODY: ['style'], THEAD: ['style'], TR: ['style'],
TD: ['style','colspan','rowspan','width'], TH: ['style','colspan','rowspan','width'],
INPUT: ['type','checked'],
BUTTON: ['type','title','data-action'],
SVG: ['viewBox','width','height','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','style'],
PATH: ['d'],
POLYLINE: ['points'],
LINE: ['x1','y1','x2','y2'],
POLYGON: ['points'],
RECT: ['x','y','width','height','rx','ry'],
CIRCLE: ['cx','cy','r'],
ELLIPSE: ['cx','cy','rx','ry'],
G: ['transform'],
USE: ['href','xlink:href'],
TEXT: ['x','y','dx','dy']
};
try {
var doc = new DOMParser().parseFromString(html, 'text/html');
var els = doc.body.querySelectorAll('*');
els.forEach(function (el) {
var tag = el.tagName.toUpperCase();
if (!allowed[tag]) {

if (tag === 'BUTTON') { if (el.parentNode) el.parentNode.removeChild(el); return; }
var text = document.createTextNode(el.textContent);
if (el.parentNode) el.parentNode.replaceChild(text, el);
return;
}
var tagAllowed = allowedAttrs[tag] || allowedAttrs[el.tagName] || [];
Array.from(el.attributes).forEach(function (attr) {
var name = attr.name.toLowerCase();
if (name.indexOf('on') === 0) { el.removeAttribute(attr.name); return; }
if (name === 'href' || name === 'src') {
var val = attr.value.toLowerCase().trim();
if (val.indexOf('javascript:') === 0 || val.indexOf('data:') === 0 || val.indexOf('vbscript:') === 0) {
el.removeAttribute(attr.name);
return;
}
}
if (name === 'style') {
var styleVal = attr.value.toLowerCase();
if (styleVal.indexOf('expression') !== -1 || styleVal.indexOf('url(') !== -1) {
el.removeAttribute(attr.name);
return;
}
}
if (tagAllowed.indexOf(name) === -1 && name !== 'class') {
el.removeAttribute(attr.name);
}
});
if (tag === 'A') {
el.setAttribute('target', '_blank');
el.setAttribute('rel', 'noopener noreferrer');
}
if (tag === 'VIDEO' && !el.hasAttribute('controls')) {
el.setAttribute('controls', '');
}
});
return doc.body.innerHTML;
} catch (e) {
return '';
}
};


window.__fmtDateTime = function (input, kind) {
try {
var d = (input instanceof Date) ? input : new Date(Number(input) || input);
if (isNaN(d.getTime())) return '';
var p = function (x) { return String(x).padStart(2, '0'); };
var date = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
var time = p(d.getHours()) + ':' + p(d.getMinutes());
if (kind === 'date') return date;
if (kind === 'time') return time;
return date + ' ' + time;
} catch (e) { return ''; }
};

(function () {

document.addEventListener('focusin', function (e) {
var opens = document.querySelectorAll('.modal-mask.open, .share-mask.open, .kf-mask.open');
if (!opens.length) return;
var open = opens[opens.length - 1];
if (!open.contains(e.target)) {
var f = open.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
if (f) { try { f.focus({ preventScroll: true }); } catch (err) { try { f.focus(); } catch (err2) { if (window.__silent) window.__silent(err2); } } }
}
}, true);
})();



var __PH_LIGHT_24 = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" rx="3" fill="%23f5f5f5"/%3E%3Cpath d="M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z" fill="%23c3ccd6"/%3E%3Ccircle cx="12" cy="17.5" r="1.7" fill="%23c3ccd6"/%3E%3C/svg%3E';;
var __PH_DARK_24 = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Crect width=%2224%22 height=%2224%22 rx=%223%22 fill=%22%232b3a4c%22/%3E%3Cpath d=%22M12 3.5 C 9.4 3.5, 8.3 5.6, 8.3 8.4 C 8.3 11.2, 9.6 13.1, 11 13.6 C 11.6 13.8, 12.4 13.8, 13 13.6 C 14.4 13.1, 15.7 11.2, 15.7 8.4 C 15.7 5.6, 14.6 3.5, 12 3.5 Z%22 fill=%22%2355697f%22/%3E%3Ccircle cx=%2212%22 cy=%2217.5%22 r=%221.7%22 fill=%22%2355697f%22/%3E%3C/svg%3E';

window.__fmtNum = function (v) {
var n = Number(v);
if (!isFinite(n)) return String(v == null ? '' : v);
var neg = n < 0; n = Math.abs(n);
var s = (Math.round(n * 100) / 100).toString();
var p = s.split('.');
p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
return (neg ? '-' : '') + p.join('.');
};

Object.defineProperty(window, 'WN_MEDIA_FALLBACK', { configurable: true, get: function () {
try { return document.documentElement.getAttribute('data-theme') === 'dark' ? __PH_DARK_24 : __PH_LIGHT_24; } catch (e) { return __PH_LIGHT_24; }
} });


(function () {
function syncPlaceholders() {
var dark = document.documentElement.getAttribute('data-theme') === 'dark';
var map = {};
var l24 = dark ? __PH_DARK_24 : __PH_LIGHT_24;
var l80 = dark ? __PH_DARK_80 : __PH_LIGHT_80;
map[__PH_LIGHT_24] = l24; map[__PH_DARK_24] = l24;
map[__PH_LIGHT_80] = l80; map[__PH_DARK_80] = l80;
var imgs = document.querySelectorAll('img[src^="data:image/svg+xml"]');
for (var i = 0; i < imgs.length; i++) {
var s = imgs[i].getAttribute('src') || '';
var to = map[s];
if (to && to !== s) imgs[i].setAttribute('src', to);
}
}
window.__wnSyncPlaceholders = syncPlaceholders;
try {
var mq = window.matchMedia('(prefers-color-scheme: dark)');
var on = function () { setTimeout(syncPlaceholders, 30); setTimeout(syncPlaceholders, 380); };
if (mq.addEventListener) mq.addEventListener('change', on);
else if (mq.addListener) mq.addListener(on);
} catch (e) { if (window.__silent) window.__silent(e); }
})();


window.__adminEmpty = function (title, hint) {
return '<div style="text-align:center;padding:26px 12px;">'
+ '<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="opacity:.45;margin-bottom:8px;color:var(--text-faint,#999);display:inline-block;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>'
+ '<div style="font-size:13px;font-weight:600;color:var(--text-light,#666);">' + String(title || '该栏目暂无内容') + '</div>'
+ (hint ? '<div style="font-size:12px;color:var(--text-faint,#999);margin-top:4px;">' + String(hint) + '</div>' : '')
+ '</div>';
};


window.__collectFileKeys = function (text) {
var out = [], seen = new Set();
var re = /\/(?:files|img)\/((?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}\.[a-zA-Z0-9]+(?:_t)?)/g;
String(text || '').replace(re, function (m, key) {
if (!seen.has(key)) { seen.add(key); out.push(key); }
return m;
});
return out;
};


window.__thumbOf = function (url) {
var u = String(url || '');
if (!/^\/img\/images\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i.test(u)) return u;
return u.replace(/\.(png|jpe?g|webp|gif)$/i, '_t.webp');
};


window.__sanitizeHTML = function (html) {

return window.__sanitizeCore(html);
};


document.addEventListener('keydown', function (e) {
if (e.key !== 'Tab') return;
var masks = document.querySelectorAll('.modal-mask.open, .share-mask.open, .kf-mask.open, .qrcode-mask.open, .lightbox.open');
if (!masks.length) return;
var box = masks[masks.length - 1];
var f = box.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
f = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null; });
if (!f.length) return;
var first = f[0], last = f[f.length - 1];
if (e.shiftKey && document.activeElement === first) { e.preventDefault(); try { last.focus({ preventScroll: true }); } catch (e1) { last.focus(); } }
else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); try { first.focus({ preventScroll: true }); } catch (e1) { first.focus(); } }
});


(function () {
function __toast(msg, type) {
try { if (typeof window.uiToast === 'function') window.uiToast(msg, type); else if (typeof window.showToast === 'function') window.showToast(msg, type); } catch (e) { if (window.__silent) window.__silent(e); }
}

function __makeQrUrl(pid) {
var path = /shop/i.test(window.location.pathname) ? window.location.pathname : '/shop';
return window.location.origin + path + '?pid=' + pid;
}
function __genQrPng(url, size, cb) {
try {
var QRCode = window.qrcode || window.QRCode;
if (!QRCode) { cb && cb(null); return; }
size = size || 300;
var qr = QRCode(0, 'M');
qr.addData(url);
qr.make();
var n = qr.getModuleCount();
var cell = Math.floor(size / n);
var realSize = cell * n;
var canvas = document.createElement('canvas');
canvas.width = realSize; canvas.height = realSize;
var ctx = canvas.getContext('2d');
ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, realSize, realSize);
ctx.fillStyle = '#000000';
for (var r = 0; r < n; r++) { for (var c = 0; c < n; c++) { if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell); } }
cb && cb(canvas.toDataURL('image/png'));
} catch (e) { cb && cb(null); }
}
window.__genQrPng = __genQrPng;
function __qrFileName(pid, name) {
var base = (name || '').replace(/[\\\/:*?"<>|]/g, '-').trim();
if (!base) base = '资源' + pid;
return base + '-二维码.png';
}

window.__savePosterPng = function (pid, onDone, name) {
var url = __makeQrUrl(pid);
__genQrPng(url, 300, function (qrUrl) {
if (!qrUrl) { __toast('二维码生成失败', 'error'); onDone && onDone(null); return; }
try {
var W = 420, H = 580;
var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
var g = cv.getContext('2d');
g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
g.fillStyle = '#1E88E5'; g.fillRect(0, 0, W, 84);
g.textAlign = 'center'; g.textBaseline = 'middle';
g.fillStyle = '#ffffff';
g.font = '600 24px system-ui, "Microsoft YaHei", sans-serif';
g.fillText((window.SHOP_CONFIG && window.SHOP_CONFIG.shopName) || '万能资源圈', W / 2, 42);
var _t = String(name || '').trim() || ('资源' + pid);
if (_t.length > 16) _t = _t.slice(0, 16) + '…';
g.fillStyle = '#222';
g.font = '600 19px system-ui, "Microsoft YaHei", sans-serif';
g.fillText(_t, W / 2, 132);
var qs = 280;
var img = new Image();
img.onload = function () {
try {
g.drawImage(img, (W - qs) / 2, 172, qs, qs);
g.fillStyle = '#999';
g.font = '15px system-ui, "Microsoft YaHei", sans-serif';
g.fillText('长按识别二维码 · 查看资源', W / 2, 172 + qs + 48);
var dataUrl = cv.toDataURL('image/png');
var a = document.createElement('a');
a.href = dataUrl; a.download = __qrFileName(pid, name);
document.body.appendChild(a); a.click(); a.remove();
__toast('二维码已保存', 'success');
onDone && onDone(dataUrl);
} catch (e) { __toast('二维码生成失败', 'error'); onDone && onDone(null); }
};
img.onerror = function () { __toast('二维码生成失败', 'error'); onDone && onDone(null); };
img.src = qrUrl;
} catch (e) { __toast('二维码生成失败', 'error'); onDone && onDone(null); }
});
};
})();


document.addEventListener('click', function (e) {
try { if (e.target.closest && e.target.closest('.view-toggle, .view-btn, .tab, .tab-btn, [data-tab]')) setTimeout(function () { try { window.__btnFit && window.__btnFit(); } catch (err) {} }, 90); } catch (err) {}
}, true);

(function () {
if (!window.visualViewport) return;
var vv = window.visualViewport;
var root = document.documentElement;
function apply() {
var kb = (window.innerHeight - vv.height) > 140;
root.classList.toggle('kb-open', kb);
root.style.setProperty('--vvh', Math.round(vv.height) + 'px');
}
try { vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply); } catch (e) {}
apply();
})();
