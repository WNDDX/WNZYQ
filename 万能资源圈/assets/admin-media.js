function makeThumbBlob(blob, cb) {
if (!blob) { cb(null); return; }
try {
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
c.toBlob(function (tb) { cb(tb || null); }, 'image/webp', 0.8);
} catch (e) { URL.revokeObjectURL(objUrl); cb(null); }
};
im.onerror = function () { URL.revokeObjectURL(objUrl); cb(null); };
im.src = objUrl;
} catch (e) { cb(null); }
}
window.__uploadToBucket = function (file) { return new Promise(function (res) { uploadToBucket(file, function (url) { res(url); }); }); };
function uploadToBucket(file, cb, onProgress, task) {
if (!file) return;

var MAX_IMAGE_SIZE = 25 * 1024 * 1024;
if (file.size > MAX_IMAGE_SIZE) {
toast('该图片超过 25MB，暂不支持上传，请压缩后再试', 'error');
if (cb) cb(null, 'size');
return;
}
var isPng = file.type === 'image/png';
var sizeMB = file.size / 1048576;
var needCompress = (!isPng && sizeMB > 1.5) || sizeMB > 8;
var send = function (fd) {
var xhr = new XMLHttpRequest();
if (task) task.xhr = xhr;
if (onProgress) {
xhr.upload.addEventListener('progress', function (e) {
if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
});
}
xhr.onload = function () {
try {
var res = JSON.parse(xhr.responseText);
if (res && res.ok && res.url) cb(res.url, null, res.key);
else { toast((res && (res.msg || res.error)) || '上传失败', 'error'); if (cb) cb(null, (res && (res.msg || res.error)) || '上传失败'); }
} catch (e) { toast(window.T('upFail'), 'error'); if (cb) cb(null, '上传失败'); }
};
xhr.onerror = function () { window.__uploadXHR = null; toast(window.T('upFail'), 'error'); if (cb) cb(null, '上传失败'); };
xhr.onabort = function () { window.__uploadXHR = null; };
xhr.open('POST', '/api/admin/upload-image');
xhr.send(fd);
};
var go = function (blob) {
var fd = new FormData();
var name = file.name || ('upload.' + (String(file.type).split('/')[1] || 'png'));
fd.append('file', blob, name);

makeThumbBlob(blob, function (tb) {
if (tb) fd.append('file2', tb, (name.replace(/\.[^.]+$/, '') || 'upload') + '_t.webp');
send(fd);
});
};
if (!needCompress) { go(file); return; }

var img = new Image();
var objUrl = URL.createObjectURL(file);
img.onload = function () {
try {
var scale = isPng ? 1 : Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
var w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
var c = document.createElement('canvas');
c.width = w; c.height = h;
c.getContext('2d').drawImage(img, 0, 0, w, h);
URL.revokeObjectURL(objUrl);
c.toBlob(function (blob) {
if (blob && blob.size < file.size) go(blob); else go(file);
}, isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.85);
} catch (e) { URL.revokeObjectURL(objUrl); go(file); }
};
img.onerror = function () { URL.revokeObjectURL(objUrl); go(file); };
img.src = objUrl;
}

function uploadVideoToBucket(file, cb, opts) {
if (!file) return;
var MAX_VIDEO_SIZE = 25 * 1024 * 1024;
if (file.size > MAX_VIDEO_SIZE) {
toast('该视频超过 25MB，暂不支持上传，请压缩或剪辑后再试', 'error');
return;
}
var fd = new FormData();
fd.append('file', file, file.name || 'video.mp4');
var xhr = new XMLHttpRequest();
window.__uploadXHR = xhr;
if (opts && opts.task) opts.task.xhr = xhr;
if (opts && opts.onProgress) {
xhr.upload.addEventListener('progress', function (e) {
if (e.lengthComputable) opts.onProgress(Math.round(e.loaded / e.total * 100));
});
}
xhr.onload = function () {
window.__uploadXHR = null;
try {
var res = JSON.parse(xhr.responseText);
if (res && res.ok && res.url) cb(res.url, res.note);
else toast((res && (res.msg || res.error)) || '上传失败', 'error');
} catch (e) { toast(window.T('upFail'), 'error'); }
};
xhr.onerror = function () { window.__uploadXHR = null; toast(window.T('upFail'), 'error'); };
xhr.onabort = function () { window.__uploadXHR = null; };
xhr.open('POST', '/api/admin/upload-video');
xhr.send(fd);
}

function uploadFileToBucket(file, cb, onProgress, task) {
if (!file) return;
var MAX_FILE_SIZE = 25 * 1024 * 1024;
if (file.size > MAX_FILE_SIZE) { cb(null, 'size'); return; }
var fd = new FormData();
fd.append('file', file, file.name || 'file');
var xhr = new XMLHttpRequest();
if (task) task.xhr = xhr;
if (onProgress) {
xhr.upload.addEventListener('progress', function (e) {
if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
});
}
xhr.onload = function () {
try {
var res = JSON.parse(xhr.responseText);
if (res && res.ok && res.url) cb(res.url, null, res.key);
else cb(null, (res && (res.msg || res.error)) || '上传失败');
} catch (e) { cb(null, '上传失败'); }
};
xhr.onerror = function () { cb(null, '上传失败'); };
xhr.open('POST', '/api/admin/upload-file');
xhr.send(fd);
}

function fmtFileSize(b) {
if (!b || b < 0) return '0 B';
var units = ['B','KB','MB','GB'];
var i = 0;
while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
return (i === 0 ? b : b.toFixed(1)) + ' ' + units[i];
}

function genFileId() { return 'fc_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36); }


var FC_EXT_COLOR = {
pdf: '#e53935',
doc: '#1565c0', docx: '#1565c0', rtf: '#1565c0',
xls: '#2e7d32', xlsx: '#2e7d32', csv: '#2e7d32',
ppt: '#e07b00', pptx: '#e07b00',
png: '#8e44ad', jpg: '#8e44ad', jpeg: '#8e44ad', webp: '#8e44ad', gif: '#8e44ad', svg: '#8e44ad', bmp: '#8e44ad', ico: '#8e44ad',
mp4: '#c2185b', mov: '#c2185b', avi: '#c2185b', webm: '#c2185b', mkv: '#c2185b', flv: '#c2185b',
mp3: '#00838f', wav: '#00838f', flac: '#00838f', ogg: '#00838f', m4a: '#00838f', aac: '#00838f',
zip: '#5d4037', rar: '#5d4037', '7z': '#5d4037', tar: '#5d4037', gz: '#5d4037', bz2: '#5d4037', iso: '#5d4037',
txt: '#546e7a', md: '#546e7a', json: '#455a64', xml: '#455a64', html: '#455a64', htm: '#455a64', js: '#455a64', css: '#455a64',
exe: '#455a64', msi: '#455a64', apk: '#2e7d32', dmg: '#5d4037', torrent: '#455a64', psd: '#1565c0', ai: '#e07b00'
};
function fcFileIconSvg(name) {
var ext = (String(name || '').split('.').pop() || '').toLowerCase();
var color = FC_EXT_COLOR[ext] || '#5c8aef';
var label = ext ? ext.slice(0, 4).toUpperCase() : 'FILE';
return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="flex:none">' +
'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>' +
'<polyline points="14 2 14 8 20 8" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>' +
'<rect x="3.2" y="13" width="13.6" height="7.2" rx="1.4" fill="' + color + '"/>' +
'<text x="10" y="18.3" text-anchor="middle" font-size="4.6" font-weight="700" fill="#fff" font-family="Arial,sans-serif">' + label + '</text></svg>';
}
function fcFolderIconSvg() {
return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f4a261" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
}
function fcLinkIconSvg() {
return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
}

function fcArrowSvg() {
return '<svg class="fc-arrow-svg toggle-arrow" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" style="flex:none"><path d="M7 10l5 5 5-5z"/></svg>';
}

function fcXSvg() {
return '<svg class="wn-ico" width="14" height="14" aria-hidden="true"><use href="#wn-ico-x"/></svg>';
}

function fcUniqueName(name, taken) {
if (!taken.has(name)) return name;
var dot = name.lastIndexOf('.');
var base = dot > 0 ? name.slice(0, dot) : name;
var ext = dot > 0 ? name.slice(dot) : '';
var i = 1;
while (taken.has(base + '-' + i + ext)) i++;
return base + '-' + i + ext;
}
function fcCollectNames(listEl) {
var set = new Set();
if (!listEl) return set;
listEl.querySelectorAll(':scope > .file-folder-item > .fc-row-head > .fname, :scope > .file-folder-item > .fname').forEach(function (n) { set.add(n.textContent); });
return set;
}

function fcFolderStats(listEl) {
var n = 0, total = 0;
if (!listEl) return { n: 0, total: 0 };
listEl.querySelectorAll('.file-folder-item').forEach(function (row) {
if (row.classList.contains('is-folder')) return;
n++;
var s = row.getAttribute('data-size');
if (s) total += Number(s) || 0;
});
return { n: n, total: total };
}


(function () {
if (window.__upman) return;
var host = null;
var tasks = [];
function ensureHost() {
if (host) return host;
host = document.createElement('div');
host.className = 'upman-host';
host.setAttribute('aria-live', 'polite');
document.body.appendChild(host);
return host;
}
function run(file, kind, opts) {
opts = opts || {};
var MAXS = { file: 25 * 1024 * 1024, image: 25 * 1024 * 1024, video: 25 * 1024 * 1024 };
var box = ensureHost();
var row = document.createElement('div');
row.className = 'upman-row';
row.innerHTML =
'<div class="upman-ico">' + fcFileIconSvg(file && file.name) + '</div>' +
'<div class="upman-main">' +
'<div class="upman-name">' + escapeHtml((file && file.name) || '未命名') + '</div>' +
'<div class="upman-bar"><i></i></div>' +
'<div class="upman-state">上传中…</div>' +
'</div>' +
'<button type="button" class="upman-cancel" title="取消上传">' + fcXSvg() + '</button>';
box.appendChild(row);
var bar = row.querySelector('.upman-bar > i');
var state = row.querySelector('.upman-state');
var done = false;
var task = { xhr: null, retries: 0 };
tasks.push(task); if (tasks.length > 120) tasks.splice(0, tasks.length - 120);
function finish(cls, txt) {
done = true;
row.classList.add(cls);
if (state) state.textContent = txt;
var b = row.querySelector('.upman-cancel');
if (b) b.parentNode.removeChild(b);
var barWrap = row.querySelector('.upman-bar');
if (barWrap) barWrap.style.display = 'none';
setTimeout(function () {
row.classList.add('upman-out');
setTimeout(function () { if (row.parentNode) row.parentNode.removeChild(row); }, 350);
}, cls === 'upman-ok' ? 900 : 2600);
}
function start() {
row.classList.remove('upman-err');
if (state) state.textContent = '上传中…';
var onProgress = function (p) { if (bar) bar.style.width = Math.max(6, Math.min(100, p)) + '%'; };
var cb = function (url, err, key) {
if (done) return;
if (url) {
if (bar) bar.style.width = '100%';
finish('upman-ok', '上传完成');
if (opts.onDone) opts.onDone(url, key);
} else {
row.classList.add('upman-err');
var msg = err === 'size' ? '超过 25MB，没传上' : (err || '上传失败');
if (state) state.textContent = msg;

if (!row.querySelector('.upman-retry')) {
var r = document.createElement('button');
r.type = 'button'; r.className = 'upman-retry'; r.textContent = '重试';
r.addEventListener('click', function () { start(); });
row.insertBefore(r, row.querySelector('.upman-cancel'));
}
if (opts.onFail) opts.onFail(msg);
}
};
if (kind === 'image') uploadToBucket(file, function (url) { cb(url, url ? null : '上传失败'); }, onProgress, task);
else if (kind === 'video') uploadVideoToBucket(file, function (url, err) { cb(url, err); }, { onProgress: onProgress, task: task });
else uploadFileToBucket(file, cb, onProgress, task);
}
row.querySelector('.upman-cancel').addEventListener('click', function () {
if (done) return;
try { if (task.xhr && task.xhr.abort) task.xhr.abort(); } catch (e) {}
done = true;
if (row.parentNode) row.parentNode.removeChild(row);
if (opts.onCancel) opts.onCancel();
});
if (file && file.size > MAXS[kind] ) {

row.classList.add('upman-err');
if (state) state.textContent = '超过 25MB，没传上';
setTimeout(function () { if (row.parentNode) row.parentNode.removeChild(row); }, 2600);
if (opts.onFail) opts.onFail('size');
return null;
}
start();
return task;
}
window.__upman = { run: run };

window.__upmanAbortAll = function () {
for (var i = 0; i < tasks.length; i++) {
var t = tasks[i];
try { if (t && t.xhr && t.xhr.readyState !== 4 && t.xhr.abort) t.xhr.abort(); } catch (e) {}
}
tasks.length = 0;
};
})();


window.__fcSweepKeys = function (keys) {
try {
keys = (keys || []).filter(Boolean).slice(0, 200);
if (!keys.length) return;
fetch('/api/admin/cleanup-files', {
method: 'POST', credentials: 'include',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ keys: keys }), keepalive: true
}).catch(function () {});
} catch (e) { if (window.__silent) window.__silent(e); }
};
window.__fcSweepEdit = function (mask) {
try {
if (!mask) mask = document.getElementById('editMask');

try { if (window.__upmanAbortAll) window.__upmanAbortAll(); } catch (e) {}

var html = '';
try { html = mask ? mask.innerHTML : ''; } catch (e) {}
try {

if (mask) {
var __ios = mask.querySelectorAll('input, textarea');
for (var __i = 0; __i < __ios.length; __i++) html += '|' + (__ios[__i].value || '');
}
} catch (e) {}
try {
var _fi = document.getElementById('fImg');
try { var _fd = document.getElementById('fDetail'); html += '|' + ((_fd && _fd.innerHTML) || ''); } catch (e) {}
html += '|' + ((_fi && _fi.value) || '') + '|' + (window.__coverImages ? JSON.stringify(window.__coverImages()) : '');
} catch (e) {}
var seen = {}, m, RE = /(?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}(?:_t)?\.[a-zA-Z0-9]+/g;
while ((m = RE.exec(html))) seen[m[0]] = true;
window.__fcSweepKeys(Object.keys(seen));
} catch (e) { if (window.__silent) window.__silent(e); }
};

if (!window.__fcPagehideBound) {
window.__fcPagehideBound = true;
window.addEventListener('pagehide', function () {
try {

var __ids = ['editMask', 'variantMask', 'inputMask'];
for (var i = 0; i < __ids.length; i++) {
var em = document.getElementById(__ids[i]);
if (!em || !em.classList.contains('open')) continue;
var __busy = document.getElementById('saveProductBtn');
if (__ids[i] === 'editMask' && __busy && __busy.disabled) continue;
window.__fcSweepEdit(em);
}
var sa = document.getElementById('setAnnouncement');
if (sa && sa.innerHTML && /(?:images|videos|files)\//.test(sa.innerHTML)) {
var __ak = {}, __am, __are = /(?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}(?:_t)?\.[a-zA-Z0-9]+/g, __ah = sa.innerHTML;
while ((__am = __are.exec(__ah))) __ak[__am[0]] = true;
window.__fcSweepKeys(Object.keys(__ak));
}
} catch (e) {}
});
}


function buildFileCardHTML(data) {
var id = escapeHtml(data.id || genFileId());
var type = data.type || 'file';
if (type === 'file') {
var url = escapeHtml(data.url || '');
var size = fmtFileSize(data.size || 0);
var typeToggle = data.isLink ? '<button type="button" class="file-card-type-toggle" title="切换为文件夹链接" data-action="toggle-link-type">文</button>' : '';
return '<div class="file-card-wrap" data-file-id="' + id + '" data-file-type="file" contenteditable="false">' +
'<div class="file-card-header">' + (data.isLink ? fcLinkIconSvg() : fcFileIconSvg(data.name)) +
'<span class="file-card-name" data-action="rename" title="点一下改名">' + escapeHtml(data.name || '未命名') + '</span>' +
'<span class="file-card-size">' + size + '</span>' + typeToggle +
'<span class="fc-admin-only">' +
'<button type="button" class="fc-btn" data-action="copy-link" title="复制链接">复制</button>' +
'<button type="button" class="fc-btn" data-action="replace-file" title="替换文件">替换</button>' +
'</span>' +
'<button type="button" class="file-card-del fc-admin-only" title="删除" data-action="del-card">' + fcXSvg() + '</button></div>' +
'<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="display:none" data-dl></a></div>';
}
var isLink = !!data.isLink;
var typeToggle2 = isLink ? '<button type="button" class="file-card-type-toggle" title="切换为文件链接" data-action="toggle-link-type">夹</button>' : '';
var linkHidden = isLink ? '<a href="' + escapeHtml(data.url || '') + '" target="_blank" rel="noopener noreferrer" style="display:none" data-dl></a>' : '';
var inner = isLink ? '' : fcKidsHTML(data.items || [], 0);
return '<div class="file-card-wrap" data-file-id="' + id + '" data-file-type="folder" contenteditable="false">' +
'<div class="file-card-header" data-action="toggle-folder">' + (isLink ? fcLinkIconSvg() : fcFolderIconSvg()) +
'<span class="file-card-name" data-action="rename" title="点一下改名">' + escapeHtml(data.name || '未命名') + '</span>' + typeToggle2 +
'<button type="button" class="file-card-del fc-admin-only" title="删除" data-action="del-card">' + fcXSvg() + '</button>' +
'<span class="fc-arrow fc-arrow-static" title="展开/收起">' + fcArrowSvg() + '</span></div>' +
inner + linkHidden + '</div>';
}


function fcItemHTML(node, level) {
var isFolder = node.ftype === 'folder';
if (!isFolder) {
return '<div class="file-folder-item' + (node.oversize ? ' oversize' : '') + '" data-key="' + escapeHtml(node.key || '') + '" data-size="' + (node.size || 0) + '">' +
fcFileIconSvg(node.name) +
'<span class="fname">' + escapeHtml(node.name || '') + '</span>' +
'<span class="fsize">' + (node.oversize ? '超 25MB 没传上' : fmtFileSize(node.size || 0)) + '</span>' +
'<span class="fc-admin-only">' +
'<button type="button" class="fc-btn" data-action="copy-item" title="复制链接">复制</button>' +
'<button type="button" class="fc-btn" data-action="replace-item" title="替换文件">替换</button>' +
'</span>' +
'<button type="button" class="fremove fc-admin-only" title="删除" data-action="del-item">' + fcXSvg() + '</button></div>';
}
var kids = node.items || [];
var stats = fcStatsOf(kids);
var kidsHtml = '';
if (kids.length) {
for (var i = 0; i < kids.length; i++) kidsHtml += fcItemHTML(kids[i], level + 1);
} else {
kidsHtml = '<div class="fc-empty fc-admin-only">空文件夹，点右上「＋文件」放东西进来</div>';
}
return '<div class="file-folder-item is-folder" data-ftype="folder">' +
'<div class="fc-row-head">' + fcFolderIconSvg() +
'<span class="fname" data-action="rename" title="点一下改名">' + escapeHtml(node.name || '未命名') + '</span>' +
'<span class="fmeta">' + stats.n + ' 项' + (stats.total ? ' · ' + fmtFileSize(stats.total) : '') + '</span>' +
'<span class="fc-admin-only">' +
'<button type="button" class="fc-btn" data-action="add-file-here" title="往这个文件夹里加文件">＋文</button>' +
'<button type="button" class="fc-btn" data-action="add-folder-here" title="在这个文件夹里补个子文件夹">＋夹</button>' +
'</span>' +
'<button type="button" class="fremove fc-admin-only" title="删除" data-action="del-item">' + fcXSvg() + '</button>' +
'<button type="button" class="fc-arrow" data-action="toggle-kids" title="展开/收起">' + fcArrowSvg() + '</button>' +
'</div>' +
'<div class="file-folder-list fc-kids" style="display:none">' + kidsHtml +
'<div class="fc-actions fc-admin-only">' +
'<button type="button" class="fc-btn fc-btn-strong" data-action="add-file-here">新增文件</button>' +
'<button type="button" class="fc-btn fc-btn-strong" data-action="add-folder-here">补文件夹</button>' +
'</div>' +
'</div></div>';
}
function fcKidsHTML(items, level) {

var html = '<div class="file-folder-list" data-folder-list style="display:none">';
for (var i = 0; i < items.length; i++) {
var it = items[i] || {};
html += fcItemHTML({ ftype: it.ftype || (it.items ? 'folder' : 'file'), name: it.name, size: it.size, key: it.key, oversize: it.oversize, items: it.items }, level);
}
html += '<div class="fc-actions fc-admin-only">' +
'<button type="button" class="fc-btn fc-btn-strong" data-action="add-file-here">新增文件</button>' +
'<button type="button" class="fc-btn fc-btn-strong" data-action="add-folder-here">补文件夹</button>' +
'</div></div>';
return html;
}
function fcStatsOf(kids) {
var n = 0, total = 0;
function walk(arr) {
(arr || []).forEach(function (x) {
if (!x) return;
if (x.ftype === 'folder' || x.items) { walk(x.items); return; }
n++; total += Number(x.size) || 0;
});
}
walk(kids);
return { n: n, total: total };
}


function fcParseList(listEl) {
var items = [];
if (!listEl) return items;
Array.prototype.forEach.call(listEl.children, function (child) {
if (!child.classList || !child.classList.contains('file-folder-item')) return;
if (child.classList.contains('is-folder')) {
var kids = child.querySelector(':scope > .file-folder-list');
items.push({ ftype: 'folder', name: (child.querySelector(':scope > .fc-row-head > .fname') || {}).textContent || '未命名', items: fcParseList(kids) });
return;
}
items.push({
ftype: 'file',
name: child.querySelector('.fname') ? child.querySelector('.fname').textContent : '',
size: Number(child.getAttribute('data-size')) || 0,
key: child.getAttribute('data-key') || '',
oversize: child.classList.contains('oversize')
});
});
return items;
}
function parseFileCard(el) {
var id = el.getAttribute('data-file-id') || genFileId();
var type = el.getAttribute('data-file-type') || 'file';
var nameEl = el.querySelector('.file-card-name');
var name = nameEl ? nameEl.textContent : '未命名';
if (type === 'file') {
var a = el.querySelector('a[data-dl]');
return { id: id, type: 'file', name: name, url: a ? a.getAttribute('href') : '' };
}
var list = el.querySelector('[data-folder-list]');
if (list && list.querySelector('.file-folder-item.is-folder')) {
return { id: id, type: 'folder', name: name, items: fcParseList(list) };
}
var items = [];
if (list) {
list.querySelectorAll('.file-folder-item').forEach(function (row) {
if (row.classList.contains('is-folder')) return;
items.push({
ftype: 'file',
name: row.querySelector('.fname') ? row.querySelector('.fname').textContent : '',
size: Number(row.getAttribute('data-size')) || 0,
key: row.getAttribute('data-key') || '',
oversize: row.classList.contains('oversize')
});
});
}
return { id: id, type: 'folder', name: name, items: items };
}

function bindFileCardManagement(editor) {
if (!editor || editor.__fileBound) return;
editor.__fileBound = true;
editor.addEventListener('click', function (e) {
var target = e.target;
var card, row, list;

if (target.closest('[data-action="del-card"]')) {
card = target.closest('.file-card-wrap');
if (card) {

try {
var _ck = {}, _cm, _cre = /(?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}(?:_t)?\.[a-zA-Z0-9]+/g, _ch = card.outerHTML;
while ((_cm = _cre.exec(_ch))) _ck[_cm[0]] = true;
window.__fcSweepKeys(Object.keys(_ck));
} catch (e) {}
card.parentNode.removeChild(card);
}
e.preventDefault(); e.stopPropagation();
return;
}
if (target.closest('[data-action="copy-link"]')) {
card = target.closest('.file-card-wrap');
var a0 = card ? card.querySelector('a[data-dl]') : null;
var u0 = a0 ? a0.getAttribute('href') : '';
if (u0 && window.__shareCopyText) window.__shareCopyText(location.origin + u0, '') || window.__shareCopyText(u0, '');
if (u0) toast(window.T('copied'), 'success'); else toast('这个文件还没上传，没有链接可复制', 'info');
e.preventDefault(); e.stopPropagation();
return;
}
if (target.closest('[data-action="replace-file"]')) {
card = target.closest('.file-card-wrap');
fcPickAndReplace(card, null);
e.preventDefault(); e.stopPropagation();
return;
}
if (target.closest('[data-action="toggle-link-type"]')) {
card = target.closest('.file-card-wrap');
if (card) {
var curType = card.getAttribute('data-file-type') || 'file';
var newType = curType === 'file' ? 'folder' : 'file';
var nameSpan = card.querySelector('.file-card-name');
var header = card.querySelector('.file-card-header');
var toggleBtn = card.querySelector('[data-action="toggle-link-type"]');
var a = card.querySelector('a[data-dl]');
var url = a ? a.getAttribute('href') : '';
card.setAttribute('data-file-type', newType);
if (nameSpan) nameSpan.textContent = newType === 'folder' ? '文件夹链接' : '文件链接';
if (toggleBtn) {
toggleBtn.textContent = newType === 'folder' ? '夹' : '文';
toggleBtn.title = newType === 'folder' ? '切换为文件链接' : '切换为文件夹链接';
}
var svg = header ? header.querySelector('svg') : null;
if (svg) svg.outerHTML = fcLinkIconSvg();
if (header) {
if (newType === 'folder') header.setAttribute('data-action', 'toggle-folder');
else header.removeAttribute('data-action');
}
}
e.preventDefault(); e.stopPropagation();
return;
}
var nameEl = target.closest('[data-action="rename"]');
if (nameEl && !nameEl.querySelector('input')) {
fcStartRename(nameEl);
e.preventDefault(); e.stopPropagation();
return;
}
if (target.closest('[data-action="toggle-folder"]') || target.closest('[data-action="toggle-kids"]')) {
var head = target.closest('.file-card-header') || target.closest('.fc-row-head');
card = head ? head.closest('.file-card-wrap') : null;
var kids = head ? (head.closest('.file-folder-item') ? head.parentNode.querySelector(':scope > .file-folder-list') : card.querySelector('[data-folder-list]')) : null;
if (kids) fcToggleKids(head, kids);
e.preventDefault(); e.stopPropagation();
return;
}
if (target.closest('[data-action="del-item"]')) {
row = target.closest('.file-folder-item');
if (row) {

try {
var _rk = {}, _mm, _re = /(?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}(?:_t)?\.[a-zA-Z0-9]+/g, _rh = row.outerHTML;
while ((_mm = _re.exec(_rh))) _rk[_mm[0]] = true;
window.__fcSweepKeys(Object.keys(_rk));
} catch (e) {}
var _pl = row.parentNode; row.parentNode.removeChild(row); if (_pl && _pl.classList.contains('file-folder-list')) fcRefreshMeta(_pl);
}
e.preventDefault(); e.stopPropagation();
return;
}
if (target.closest('[data-action="copy-item"]')) {
row = target.closest('.file-folder-item');
var key = row ? (row.getAttribute('data-key') || '') : '';
if (key && window.__shareCopyText) window.__shareCopyText(location.origin + '/files/' + key, '');
if (key) toast(window.T('copied'), 'success'); else toast('这个文件还没上传，没有链接可复制', 'info');
e.preventDefault(); e.stopPropagation();
return;
}
if (target.closest('[data-action="replace-item"]')) {
row = target.closest('.file-folder-item');
if (row) fcPickAndReplace(null, row);
e.preventDefault(); e.stopPropagation();
return;
}
if (target.closest('[data-action="add-file-here"]')) {
var btn = target.closest('[data-action="add-file-here"]');
var head0 = btn.closest('.fc-row-head');
var list = head0 ? head0.parentNode.querySelector(':scope > .file-folder-list') : btn.closest('.file-folder-list');
if (list) fcAddFilesInto(list, editor);
e.preventDefault(); e.stopPropagation();
return;
}
if (target.closest('[data-action="add-folder-here"]')) {
var btn2 = target.closest('[data-action="add-folder-here"]');
var head1 = btn2.closest('.fc-row-head');
var list2 = head1 ? head1.parentNode.querySelector(':scope > .file-folder-list') : btn2.closest('.file-folder-list');
if (list2) fcAddFolderInto(list2);
e.preventDefault(); e.stopPropagation();
return;
}
});
editor.addEventListener('keydown', function (e) {
if (e.key !== 'Delete' && e.key !== 'Backspace') return;
var sel = window.getSelection();
if (!sel.rangeCount) return;
var node = sel.getRangeAt(0).commonAncestorContainer;
if (node.nodeType === 3) node = node.parentNode;
var card = node.closest ? node.closest('.file-card-wrap') : null;
if (card && card.parentNode) { card.parentNode.removeChild(card); e.preventDefault(); }
});


editor.addEventListener('dragover', function (e) {
if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return;
e.preventDefault();
editor.classList.add('fc-drop-hover');
});
editor.addEventListener('dragleave', function (e) {
if (e.target === editor) editor.classList.remove('fc-drop-hover');
});
editor.addEventListener('drop', function (e) {
if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
e.preventDefault();
editor.classList.remove('fc-drop-hover');

try {
var rng = document.caretRangeFromPoint
? document.caretRangeFromPoint(e.clientX, e.clientY)
: (document.caretPositionFromPoint
? (function () { var p = document.caretPositionFromPoint(e.clientX, e.clientY); var r = document.createRange(); r.setStart(p.offsetNode, p.offset); return r; })()
: null);
if (rng && window.__rte) { window.__rte.editor = editor; window.__rte.range = rng; }
} catch (err) {}

var hasEntry = false;
try {
for (var di = 0; di < e.dataTransfer.items.length; di++) {
if (e.dataTransfer.items[di].webkitGetAsEntry) { hasEntry = true; break; }
}
} catch (err2) {}
if (hasEntry) {
fcReadDropped(e.dataTransfer.items, function (files, folderName) {
if (files && files.length) processLocalFiles(files, editor, folderName);
else toast('文件夹里没有可上传的文件', 'info');
});
} else {
processLocalFiles(Array.prototype.slice.call(e.dataTransfer.files), editor, null);
}
});


editor.addEventListener('paste', function (e) {
var dt = e.clipboardData;
if (!dt || !dt.files || !dt.files.length) return;
e.preventDefault();
try {
var sel = window.getSelection();
if (sel && sel.rangeCount && window.__rte) { window.__rte.editor = editor; window.__rte.range = sel.getRangeAt(0).cloneRange(); }
} catch (err) {}
processLocalFiles(Array.prototype.slice.call(dt.files), editor, null);
});
}


function fcRefreshMeta(listEl) {
var ownerRow = listEl.closest ? listEl.closest('.file-folder-item.is-folder') : null;
if (!ownerRow) return;
var st = fcFolderStats(listEl);
var m = ownerRow.querySelector(':scope > .fc-row-head > .fmeta');
if (m) m.textContent = st.n + ' 项' + (st.total ? ' · ' + fmtFileSize(st.total) : '');
}

function fcExpandParents(node) {
var p = node.parentNode;
while (p && p !== document.body) {
if (p.classList && p.classList.contains('fc-kids') && p.style.display === 'none') {
p.style.display = 'block';
var owner = p.parentNode ? p.parentNode.querySelector(':scope > .fc-row-head') : null;
if (owner) fcSetArrow(owner, true);
}
p = p.parentNode;
}
}
function fcSetArrow(head, open) {
var arr = head ? head.querySelector('.fc-arrow-svg') : null;
if (arr) arr.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
}
function fcToggleKids(head, kids) {

var show = kids.style.display === 'none';
fcSetArrow(head, show);
if (show) {
kids.style.display = 'block';
kids.style.overflow = 'hidden';
kids.style.transition = 'none';
kids.style.maxHeight = '0px';
kids.style.opacity = '0';
void kids.offsetHeight;
kids.style.transition = 'max-height var(--dur-mid) var(--ease-out), opacity var(--dur-mid) var(--ease-out)';
kids.style.maxHeight = kids.scrollHeight + 'px';
kids.style.opacity = '1';
setTimeout(function () { kids.style.transition = ''; kids.style.maxHeight = 'none'; kids.style.overflow = ''; }, 240);
} else {
kids.style.overflow = 'hidden';
kids.style.maxHeight = kids.scrollHeight + 'px';
void kids.offsetHeight;
kids.style.transition = 'max-height var(--dur-mid) var(--ease-out), opacity var(--dur-mid) var(--ease-out)';
kids.style.maxHeight = '0px';
kids.style.opacity = '0';
setTimeout(function () { kids.style.display = 'none'; kids.style.transition = ''; kids.style.maxHeight = ''; kids.style.overflow = ''; kids.style.opacity = ''; }, 190);
}
}

function fcStartRename(nameEl) {
var oldName = nameEl.textContent;
var inp = document.createElement('input');
inp.type = 'text'; inp.value = oldName;
inp.className = 'file-card-rename';
nameEl.innerHTML = '';
nameEl.appendChild(inp);
try { inp.focus({ preventScroll: true }); } catch (e1) { inp.focus(); } inp.select();
var save = function () { nameEl.textContent = inp.value.trim() || oldName; };
inp.addEventListener('blur', save);
inp.addEventListener('keydown', function (ev) {
if (ev.key === 'Enter') { inp.blur(); }
if (ev.key === 'Escape') { inp.value = oldName; inp.blur(); }
});
}

function fcAddFilesInto(list, editor) {
var inp = document.createElement('input');
inp.type = 'file'; inp.multiple = true;
inp.addEventListener('change', function () {
var files = Array.prototype.slice.call(inp.files || []);
if (!files.length) return;
var taken = fcCollectNames(list);
var addBtn = list.querySelector(':scope > .fc-actions');
files.forEach(function (f) {
var finalName = fcUniqueName(f.name, taken);
taken.add(finalName);
var oversize = f.size > 25 * 1024 * 1024;
var row = document.createElement('div');
row.className = 'file-folder-item' + (oversize ? ' oversize' : '');
row.innerHTML = fcFileIconSvg(finalName) +
'<span class="fname">' + escapeHtml(finalName) + '</span>' +
'<span class="fsize">' + (oversize ? '超 25MB 没传上' : '上传中…') + '</span>' +
'<span class="fc-admin-only">' +
'<button type="button" class="fc-btn" data-action="copy-item" title="复制链接">复制</button>' +
'<button type="button" class="fc-btn" data-action="replace-item" title="替换文件">替换</button>' +
'</span>' +
'<button type="button" class="fremove fc-admin-only" title="删除" data-action="del-item">' + fcXSvg() + '</button>';
if (addBtn) list.insertBefore(row, addBtn); else list.appendChild(row);
fcRefreshMeta(list);
if (oversize) return;
window.__upman.run(f, 'file', {
onDone: function (url, key) {
row.setAttribute('data-key', key || '');
row.setAttribute('data-size', f.size);
var s = row.querySelector('.fsize');
if (s) s.textContent = fmtFileSize(f.size);
fcExpandParents(row);
fcRefreshMeta(list);
},
onFail: function () { row.classList.add('oversize'); }
});
});
});
inp.click();
}

function fcAddFolderInto(list) {
var taken = fcCollectNames(list);
var name = fcUniqueName('新建文件夹', taken);
taken.add(name);
var wrap = document.createElement('div');
wrap.className = 'file-folder-item is-folder';
wrap.setAttribute('data-ftype', 'folder');
wrap.innerHTML =
'<div class="fc-row-head">' + fcFolderIconSvg() +
'<span class="fname" data-action="rename" title="点一下改名">' + escapeHtml(name) + '</span>' +
'<span class="fmeta">0 项</span>' +
'<span class="fc-admin-only">' +
'<button type="button" class="fc-btn" data-action="add-file-here" title="往这个文件夹里加文件">＋文</button>' +
'<button type="button" class="fc-btn" data-action="add-folder-here" title="在这个文件夹里补个子文件夹">＋夹</button>' +
'</span>' +
'<button type="button" class="fremove fc-admin-only" title="删除" data-action="del-item">' + fcXSvg() + '</button>' +
'<button type="button" class="fc-arrow" data-action="toggle-kids" title="展开/收起">' + fcArrowSvg() + '</button>' +
'</div>' +
'<div class="file-folder-list fc-kids" style="display:none">' +
'<div class="fc-empty fc-admin-only">空文件夹，点右上「＋文件」放东西进来</div>' +
'<div class="fc-actions fc-admin-only">' +
'<button type="button" class="fc-btn fc-btn-strong" data-action="add-file-here">新增文件</button>' +
'<button type="button" class="fc-btn fc-btn-strong" data-action="add-folder-here">补文件夹</button>' +
'</div>' +
'</div>';
var addBtn = list.querySelector(':scope > .fc-actions');
if (addBtn) list.insertBefore(wrap, addBtn); else list.appendChild(wrap);
fcExpandParents(wrap);
var nameEl = wrap.querySelector('.fname');
if (nameEl) fcStartRename(nameEl);
}

function fcPickAndReplace(card, row) {
var inp = document.createElement('input');
inp.type = 'file';
inp.addEventListener('change', function () {
var f = inp.files && inp.files[0];
if (!f) return;
window.__upman.run(f, 'file', {
onDone: function (url, key) {
if (row) {

try { var _ok = row.getAttribute('data-key') || ''; if (_ok && _ok !== (key || '') && window.__fcSweepKeys) window.__fcSweepKeys([_ok]); } catch (e) {}
row.setAttribute('data-key', key || '');
row.setAttribute('data-size', f.size);
var s = row.querySelector('.fsize');
if (s) s.textContent = fmtFileSize(f.size);
row.classList.remove('oversize');
toast('文件已替换', 'success');
} else if (card) {

try { var _a0 = card.querySelector('a[data-dl]'); var _oh = _a0 ? (_a0.getAttribute('href') || '') : ''; var _om = _oh.match(/(?:images|videos|files)\/\d{4}\/\d{2}\/[0-9a-fA-F-]{36}(?:_t)?\.[a-zA-Z0-9]+/); if (_om && window.__fcSweepKeys) window.__fcSweepKeys([_om[0]]); } catch (e) {}
var a = card.querySelector('a[data-dl]');
if (a) a.setAttribute('href', url);
var sz = card.querySelector('.file-card-size');
if (sz) sz.textContent = fmtFileSize(f.size);
toast('文件已替换', 'success');
}
}
});
});
inp.click();
}


function fcReadDropped(dtItems, cb) {
var entries = [];
for (var i = 0; i < (dtItems ? dtItems.length : 0); i++) {
var it = dtItems[i];
if (it.kind === 'file') {
var ent = it.webkitGetAsEntry && it.webkitGetAsEntry();
if (ent) entries.push(ent);
}
}
if (!entries.length) return;
var files = [], folderName = null, pending = 0, finished = false;
function finish() {
if (finished) return;
finished = true;
files.sort(function (a, b) { return (a.__folderName || '').localeCompare(b.__folderName || '') || a.name.localeCompare(b.name); });
cb(files, folderName);
}
function release() { pending--; if (pending === 0) finish(); }
function walk(entry, parent) {
if (entry.isFile) {
pending++;
entry.file(function (f) {
try { if (parent) f.__folderName = parent; files.push(f); } catch (e) {}
release();
}, function () { release(); });
} else if (entry.isDirectory) {
pending++;
if (!parent) folderName = entry.name;
var reader = entry.createReader();
var readBatch = function () {
reader.readEntries(function (batch) {
if (!batch.length) { release(); return; }
batch.forEach(function (en) { walk(en, parent || entry.name); });
readBatch();
}, function () { release(); });
};
try { readBatch(); } catch (e) { release(); }
} else { pending++; release(); }
}
entries.forEach(function (en) { walk(en, null); });
if (pending === 0) finish();
}


function setupFileDialog(editor) {
if (!editor) return;

if (!window.__fileDropGuard) {
window.__fileDropGuard = true;
document.addEventListener('dragover', function (e) {
if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) e.preventDefault();
});
document.addEventListener('drop', function (e) {
if (!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1)) return;
e.preventDefault();
var t = e.target;
if (t && t.closest && t.closest('#inputMask')) return;
var inEditor = t && t.closest && t.closest('.rte-editor');
if (!inEditor) toast('请把文件拖到正文编辑框里再松手', 'info');
}, true);
}
window.__fileDropEditor = editor;
var mask = document.getElementById('inputMask');
if (mask && !mask.__wnFileDrop) {
mask.__wnFileDrop = 1;
var hasFiles = function (e) {
return !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1);
};
var setHot = function (on) {
var box = mask.querySelector('.modal-box');
if (box) box.classList.toggle('file-drop-hot', !!on);
};
mask.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); setHot(true); });
mask.addEventListener('dragover', function (e) {
if (!hasFiles(e)) return;
e.preventDefault(); e.stopPropagation();
try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {}
setHot(true);
});
mask.addEventListener('dragleave', function (e) {
if (!e.relatedTarget || !mask.contains(e.relatedTarget)) setHot(false);
});
mask.addEventListener('drop', function (e) {
if (!hasFiles(e)) return;
e.preventDefault(); e.stopPropagation();
setHot(false);
var ed = window.__fileDropEditor || editor;
var dt = e.dataTransfer;
var done = false;
function take(files, folderName) {
if (done) return;
done = true;
if (files && files.length) processLocalFiles(files, ed, folderName);
else toast('文件夹里没有可上传的文件', 'info');
}
var hasEntry = false;
try {
for (var di = 0; di < dt.items.length; di++) { if (dt.items[di].webkitGetAsEntry) { hasEntry = true; break; } }
} catch (err3) {}
if (hasEntry) {
fcReadDropped(dt.items, take);

setTimeout(function () {
if (done) return;
var fl = dt.files;
if (fl && fl.length) take(Array.prototype.slice.call(fl), null);
else take([], null);
}, 2000);
} else {
var fl2 = dt.files;
if (fl2 && fl2.length) take(Array.prototype.slice.call(fl2), null);
else take([], null);
}
});
}
showInput('插入文件',
'粘贴网络链接，或点「上传本地文件」选择文件；也可直接把文件/文件夹拖进本弹窗',
'https://...',
handleFileInsert(editor), '', 'file');
}

function processLocalFiles(files, editor, folderName) {
if (!files || !files.length) return;
window.closeInput && window.closeInput();
var items = Array.prototype.slice.call(files).map(function (f) {
return { file: f, name: f.name, size: f.size, oversize: f.size > 25 * 1024 * 1024 };
});
var pid = genFileId();

if (items.length === 1 && !folderName) {
var it = items[0];
rteInsert(editor, buildFileCardHTML({ id: pid, type: 'file', name: it.name, url: '', size: it.size }));
var card = editor.querySelector('[data-file-id="' + pid + '"]');
if (it.oversize) {
if (card) { card.classList.add('fc-failed'); var sz0 = card.querySelector('.file-card-size'); if (sz0) sz0.textContent = '超 25MB 没传上'; }
return;
}
window.__upman.run(it.file, 'file', {
onDone: function (url, key) {
if (!card) return;
var a = card.querySelector('a[data-dl]'); if (a) a.setAttribute('href', url);
var sz = card.querySelector('.file-card-size'); if (sz) sz.textContent = fmtFileSize(it.size);
toast('文件已插入', 'success');
},
onFail: function () { if (card) card.classList.add('fc-failed'); }
});
return;
}

var taken = new Set();
var kids = items.map(function (x) {
var nm = fcUniqueName(x.name, taken); taken.add(nm);
return { ftype: 'file', name: nm, size: x.size, key: '', oversize: x.oversize };
});
rteInsert(editor, buildFileCardHTML({ id: pid, type: 'folder', name: folderName || ('文件包 (' + items.length + ')'), items: kids }));
var fcard = editor.querySelector('[data-file-id="' + pid + '"]');
var rows = fcard ? fcard.querySelectorAll('.file-folder-item:not(.is-folder)') : [];
items.forEach(function (it, idx) {
var row = rows[idx];
if (!row) return;
if (it.oversize) return;
window.__upman.run(it.file, 'file', {
onDone: function (url, key) {
row.setAttribute('data-key', key || '');
row.setAttribute('data-size', it.size);
var s = row.querySelector('.fsize');
if (s) s.textContent = fmtFileSize(it.size);
fcExpandParents(row);
},
onFail: function (msg) {
row.classList.add('oversize');
var s2 = row.querySelector('.fsize');
if (s2) s2.textContent = msg === 'size' ? '超 25MB 没传上' : '上传失败';
}
});
});
}


function handleFileDrop(e, editor) {
var dt = e.dataTransfer;
if (!dt) return;
var items = dt.items;
if (!items || !items.length) {
var files = Array.from(dt.files || []);
processLocalFiles(files, editor, null);
return;
}
var entries = [];
for (var i = 0; i < items.length; i++) {
var entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
if (entry) entries.push(entry);
}
if (!entries.length) {
processLocalFiles(Array.from(dt.files || []), editor, null);
return;
}
var isFolder = entries.length === 1 && entries[0].isDirectory;
if (isFolder) {
readDirectoryEntry(entries[0], function (files, folderName) {
processLocalFiles(files, editor, folderName);
});
return;
}
var allFiles = [];
var pending = entries.length;
entries.forEach(function (entry) {
if (entry.isFile) {
entry.file(function (f) { allFiles.push(f); pending--; if (pending === 0) processLocalFiles(allFiles, editor, null); });
} else if (entry.isDirectory) {
readDirectoryEntry(entry, function (files) { allFiles = allFiles.concat(files); pending--; if (pending === 0) processLocalFiles(allFiles, editor, null); });
} else { pending--; if (pending === 0) processLocalFiles(allFiles, editor, null); }
});
}

function readDirectoryEntry(dirEntry, cb) {
var files = [];
var reader = dirEntry.createReader();
var folderName = dirEntry.name;
function readBatch() {
reader.readEntries(function (entries) {
if (!entries.length) { cb(files, folderName); return; }
var pending = entries.length;
entries.forEach(function (entry) {
if (entry.isFile) {
entry.file(function (f) { files.push(f); pending--; if (pending === 0) readBatch(); });
} else if (entry.isDirectory) {
readDirectoryEntry(entry, function (subFiles) { files = files.concat(subFiles); pending--; if (pending === 0) readBatch(); });
} else { pending--; if (pending === 0) readBatch(); }
});
}, function () { cb(files, folderName); });
}
readBatch();
}

function detectLinkType(url) {
var u = (url || '').toLowerCase();
var folderDomains = [
'pan.baidu.com',
'alipan.com', 'aliyundrive.net', 'aliyundrive.com',
'lanzou', 'lanzouw.com', 'lanzoux.com', 'lanzoui.com',
'123pan.com', '123pan.cn',
'pan.quark.cn', 'quark.cn',
'cowtransfer.com',
'wenshushu.cn',
'cloud.189.cn',
'pan.xunlei.com',
'yun.139.com',
'www.jianguoyun.com',
'mega.nz',
'drive.google.com',
'onedrive.live.com',
'sharepoint.com',
'dropbox.com',
'terabox.com',
'mediafire.com',
'megaup.net',
'zippyshare.com',
'uploadgig.com',
'rapidgator.net',
'nitroflare.com',
'katfile.com',
'scribd.com'
];
var isFolder = false;
for (var i = 0; i < folderDomains.length; i++) {
if (u.indexOf(folderDomains[i]) !== -1) { isFolder = true; break; }
}
if (!isFolder && /lanzou[a-z]*\.com/.test(u)) isFolder = true;
if (isFolder) return 'folder';
var fileExts = /\.(pdf|zip|rar|7z|tar|gz|bz2|xz|mp4|mp3|avi|mkv|mov|wmv|flv|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|apk|exe|dmg|pkg|ipa|iso|img|torrent|csv|json|xml|html|htm|js|css|png|jpg|jpeg|gif|webp|svg|psd|ai|eps|woff|woff2|ttf|otf|eot|md|epub|mobi|azw3|fb2|djvu|chm|hlp|log|ini|cfg|conf|sql|py|java|c|cpp|h|hpp|cs|php|rb|go|rs|swift|kt|ts|jsx|tsx|vue|scss|less|sass|styl|coffee|lua|pl|sh|bat|cmd|ps1|vbs|wsf|reg|msi|msp|msm|mst|cab|dll|sys|drv|ocx|ax|tlb|olb|rll|mui|inf|cat|cer|crt|pfx|p12|pem|key|csr|crl|ocsp|tsa|sst|stl|spc|p7b|p7c|p7m|p7s|ps1xml|cdxml|xaml|baml|resx|resources|config|manifest|cfg|ini|inf|reg|cmd|bat|ps1|vbs|wsf|hta|msc|adp|ade|accdb|accdt|accdr|accdw|accde|mda|mde|adp|ade|dbf|db|mdb|sqlite|sqlite3|db3|s3db|sl3|nwdb|fdb|gdb|ib|myd|myi|frm|ibd|dbf|dbt|mdx|cdx|idx|ntx|db|sdf|mdb|accdb|odb|udl|dsn|qry|rqy|odc|udl|dac|dtsx|dbs|dbm|dbt|dbx|dbc|dbi|dbl|dbm|dbo|dbp|dbs|dbt|dbv|dbw|dbx|dby|dbz)$/i;
if (fileExts.test(u)) return 'file';
return 'file';
}

function handleFileInsert(editor) {
return function (val, done) {
var url = (val || '').trim();
if (!url) { if (done) done(); return; }
var type = detectLinkType(url);
var html = buildFileCardHTML({
type: type,
name: type === 'folder' ? '文件夹链接' : '文件链接',
url: url,
isLink: true,
items: []
});
rteInsert(editor, html);
toast('已插入', 'success');
if (done) done();
};
}

(function () {
var btn = document.getElementById('fImgUpload');
if (!btn) return;
var inp = document.createElement('input');
inp.type = 'file';
inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
inp.style.display = 'none';
document.body.appendChild(inp);
btn.addEventListener('click', function () { inp.value = ''; inp.click(); });
inp.addEventListener('change', function () {
var _origText = btn.textContent;
btn.disabled = true;

window.__upman.run(inp.files && inp.files[0], 'image', {
onDone: function (url) {
btn.disabled = false;
btn.textContent = '✓ 完成';
btn.style.background = 'var(--green-strong)';
setTimeout(function () { btn.textContent = _origText; btn.style.background = ''; }, 1200);
fImg.value = url;
if (typeof fImg.dispatchEvent === 'function') fImg.dispatchEvent(new Event('input'));
toast('封面图已上传，链接已自动填入', 'success');
},
onFail: function () { btn.disabled = false; btn.textContent = _origText; },
onCancel: function () { btn.disabled = false; btn.textContent = _origText; }
});
});
})();

function showMediaInput(kind, onInsert) {
var isVideo = kind === 'video';
showInput(isVideo ? '插入视频' : '插入图片',
isVideo ? '粘贴网络视频地址，或点右侧按钮从电脑上传本地视频' : '粘贴网络图片地址，或点右侧按钮从电脑上传本地图片',
isVideo ? 'https://.../xx.mp4' : 'https://...',
function (url) {
if (onInsert) onInsert(url);
if (isVideo && url) warnVideoCompat(url);
}, '', kind);
}

function warnVideoCompat(url) {
var m = (url || '').split('?')[0].toLowerCase().match(/\.([a-z0-9]+)$/);
var ext = m ? m[1] : '';
var risky = { mov: 1, avi: 1, wmv: 1, flv: 1, mkv: 1, m4v: 1, mpg: 1, mpeg: 1, ts: 1, '3gp': 1 };
if (risky[ext]) {
toast('已插入。注意：' + ext.toUpperCase() + ' 格式部分浏览器（Chrome/安卓）可能无法播放，建议转成 MP4 (H.264)', 'error');
}
}

document.getElementById('detailRteImg').addEventListener('click', function () {
showMediaInput('image', function (url) {
if (!url) return;
url = url.trim();
var html = '<img src="' + url.replace(/"/g, '&quot;') + '" alt="" style="max-width:100%;border-radius:8px;" />';
rteInsert(__rte.editor || document.getElementById('fDetail'), html);
toast('图片已插入', 'success');
});
});

document.getElementById('detailRteVideo').addEventListener('click', function () {
showMediaInput('video', function (url) {
if (!url) return;
url = url.trim();
var html = '<video src="' + url.replace(/"/g, '&quot;') + '" controls style="max-width:100%;border-radius:8px;"></video>';
rteInsert(__rte.editor || document.getElementById('fDetail'), html);
toast('视频已插入', 'success');
});
});

document.getElementById('detailRteFile').addEventListener('click', function () {
setupFileDialog(__rte.editor || document.getElementById('fDetail'));
});

function updateRtePlaceholder() {
if (!rteEditor.innerHTML || rteEditor.innerHTML === '<br>' || rteEditor.innerHTML === '<p><br></p>') {
rteEditor.style.color = '#999';
} else {
rteEditor.style.color = '#333';
}
}
rteEditor.addEventListener('input', updateRtePlaceholder);
rteEditor.addEventListener('focus', updateRtePlaceholder);
rteEditor.addEventListener('blur', updateRtePlaceholder);

(function () {
var coverGallery = document.getElementById('coverGallery');
var fImgInput = document.getElementById('fImg');
var fImgPreview = document.getElementById('fImgPreview');
var coverImages = [];
var selectedCoverIdx = 0;

function renderCoverGallery() {
if (!coverGallery) return;
coverGallery.innerHTML = '';
coverImages.forEach(function (url, idx) {
var item = document.createElement('div');
item.className = 'cg-item' + (idx === selectedCoverIdx ? ' active' : '');
item.dataset.idx = idx;
var img = document.createElement('img');
img.alt = '封面图 ' + (idx + 1) + '（共 ' + coverImages.length + ' 张）';
img.decoding = 'async';
img.style.opacity = '0';
img.onload = function () { img.style.opacity = '1'; };
img.onerror = function () {

var _orig = escapeHtml(url);
if (url && thumbOf(url) !== url && img.getAttribute('src') !== _orig) { img.src = _orig; return; }
img.style.opacity = '1'; item.classList.add('media-fail'); img.src = window.WN_MEDIA_FALLBACK;
};
item.appendChild(img);
if (url) { img.src = escapeHtml(thumbOf(url)); } else { img.style.opacity = '1'; item.classList.add('media-fail'); img.src = window.WN_MEDIA_FALLBACK; }
if (idx === 0) {
var mainBadge = document.createElement('span');
mainBadge.className = 'cg-main';
mainBadge.textContent = '封面图';
item.appendChild(mainBadge);
}
var delBtn = document.createElement('button');
delBtn.type = 'button';
delBtn.className = 'cg-del';
delBtn.title = '删除';
delBtn.dataset.idx = idx;
delBtn.innerHTML = '<svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg>';
item.appendChild(delBtn);
var dragBtn = document.createElement('span');
dragBtn.className = 'cg-drag';
dragBtn.title = '拖动排序';
dragBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>';
dragBtn.draggable = true;
item.appendChild(dragBtn);
item.addEventListener('click', function (e) {
if (e.target.classList.contains('cg-del')) {
e.stopPropagation();
deleteCoverImage(parseInt(e.target.dataset.idx));
return;
}
if (e.target.classList.contains('cg-drag')) return;
selectCoverImage(idx);
});
dragBtn.addEventListener('dragstart', function (e) {
e.dataTransfer.setData('text/plain', String(idx));
item.classList.add('dragging');
e.dataTransfer.effectAllowed = 'move';
});
dragBtn.addEventListener('dragend', function () {
item.classList.remove('dragging');
document.querySelectorAll('.cg-item').forEach(function (el) { el.classList.remove('drag-over'); });
});
item.addEventListener('dragover', function (e) {
e.preventDefault();
e.dataTransfer.dropEffect = 'move';
item.classList.add('drag-over');
});
item.addEventListener('dragleave', function () {
item.classList.remove('drag-over');
});
item.addEventListener('drop', function (e) {
e.preventDefault();
item.classList.remove('drag-over');
var fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
var toIdx = idx;
if (isNaN(fromIdx) || fromIdx === toIdx) return;
reorderCoverImages(fromIdx, toIdx);
});
bindCoverTouchDrag(item, dragBtn, idx);
coverGallery.appendChild(item);
});
var addBtn = document.createElement('div');
addBtn.className = 'cg-add';
addBtn.textContent = '+';
addBtn.title = '添加新图';
addBtn.addEventListener('click', function () {
selectedCoverIdx = coverImages.length;
coverImages.push('');
renderCoverGallery();
updateFImgInput();
try { fImgInput.focus({ preventScroll: true }); } catch (e1) { fImgInput.focus(); }
});
coverGallery.appendChild(addBtn);
}

function reorderCoverImages(fromIdx, toIdx) {
if (fromIdx < 0 || fromIdx >= coverImages.length || toIdx < 0 || toIdx >= coverImages.length) return;
var oldSel = selectedCoverIdx;
var moved = coverImages.splice(fromIdx, 1)[0];
coverImages.splice(toIdx > fromIdx ? toIdx : toIdx, 0, moved);
if (oldSel === fromIdx) {
selectedCoverIdx = toIdx > fromIdx ? toIdx : toIdx;
} else if (fromIdx < toIdx) {
if (oldSel > fromIdx && oldSel <= toIdx) selectedCoverIdx = oldSel - 1;
} else {
if (oldSel >= toIdx && oldSel < fromIdx) selectedCoverIdx = oldSel + 1;
}
renderCoverGallery();
updateFImgInput();
updateImgPreview();
}

function bindCoverTouchDrag(item, handle, idx) {
var longTimer = null;
var ghost = null;
var startX = 0, startY = 0;
var dragging = false;
var moved = false;
var startEl = null;
var MOVE_THRESHOLD = 8;
var LONG_PRESS_MS = 400;
function clearTimer() { if (longTimer) { clearTimeout(longTimer); longTimer = null; } }
function removeGhost() { if (ghost && ghost.parentNode) { ghost.parentNode.removeChild(ghost); } ghost = null; }
function onTouchStart(e) {
if (e.touches.length !== 1) return;
var t = e.touches[0];
startX = t.clientX; startY = t.clientY; moved = false; dragging = false; startEl = item;
clearTimer();
longTimer = setTimeout(function () {
if (moved) return;
dragging = true;
item.classList.add('dragging');
var rect = item.getBoundingClientRect();
ghost = item.cloneNode(true);
ghost.style.position = 'fixed';
ghost.style.left = rect.left + 'px';
ghost.style.top = rect.top + 'px';
ghost.style.width = rect.width + 'px';
ghost.style.height = rect.height + 'px';
ghost.style.opacity = '0.85';
ghost.style.zIndex = '99999';
ghost.style.pointerEvents = 'none';
ghost.classList.remove('dragging');
document.body.appendChild(ghost);
}, LONG_PRESS_MS);
}
function onTouchMove(e) {
if (e.touches.length !== 1) { clearTimer(); return; }
var t = e.touches[0];
var dx = Math.abs(t.clientX - startX);
var dy = Math.abs(t.clientY - startY);
if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) moved = true;
if (!dragging) return;
e.preventDefault();
if (ghost) {
var rect = item.getBoundingClientRect();
ghost.style.left = (t.clientX - rect.width / 2) + 'px';
ghost.style.top = (t.clientY - rect.height / 2) + 'px';
}
var el = document.elementFromPoint(t.clientX, t.clientY);
var target = el ? el.closest('.cg-item') : null;
document.querySelectorAll('.cg-item').forEach(function (c) { c.classList.remove('drag-over'); });
if (target && target !== item) target.classList.add('drag-over');
}
function onTouchEnd(e) {
clearTimer();
if (!dragging) { removeGhost(); item.classList.remove('dragging'); return; }
dragging = false;
item.classList.remove('dragging');
var changed = e.changedTouches[0];
var el = document.elementFromPoint(changed.clientX, changed.clientY);
var target = el ? el.closest('.cg-item') : null;
document.querySelectorAll('.cg-item').forEach(function (c) { c.classList.remove('drag-over'); });
removeGhost();
if (target && target !== item) {
var toIdx = parseInt(target.dataset.idx, 10);
if (!isNaN(toIdx)) reorderCoverImages(idx, toIdx);
}
}
handle.addEventListener('touchstart', onTouchStart, { passive: true });
handle.addEventListener('touchmove', onTouchMove, { passive: false });
handle.addEventListener('touchend', onTouchEnd, { passive: true });
handle.addEventListener('touchcancel', function () { clearTimer(); removeGhost(); item.classList.remove('dragging'); dragging = false; }, { passive: true });
}

function selectCoverImage(idx) {
selectedCoverIdx = idx;
var items = coverGallery ? coverGallery.querySelectorAll('.cg-item') : [];
items.forEach(function (el) {
var i = parseInt(el.dataset.idx, 10);
if (isNaN(i)) return;
if (i === idx) el.classList.add('active'); else el.classList.remove('active');
});
updateFImgInput();
updateImgPreview();
}

function deleteCoverImage(idx) {
coverImages.splice(idx, 1);
if (selectedCoverIdx >= coverImages.length) selectedCoverIdx = Math.max(0, coverImages.length - 1);
if (coverImages.length === 0) selectedCoverIdx = 0;
renderCoverGallery();
updateFImgInput();
updateImgPreview();
}

function updateFImgInput() {
if (!fImgInput) return;
var url = coverImages[selectedCoverIdx] || '';
fImgInput.value = url;
fImgInput.placeholder = selectedCoverIdx === 0 ? '请输入封面图链接' : '请输入图' + (selectedCoverIdx + 1) + '链接';
}

function updateImgPreview() {
_safeSetPreview(document.getElementById('fImgPreview'), (coverImages[selectedCoverIdx] || '').trim(), { hideEmpty: true, noDebounce: true });
}

if (fImgInput) {
fImgInput.addEventListener('input', function () {
var url = fImgInput.value.trim();
if (coverImages.length === 0) {
coverImages.push(url);
selectedCoverIdx = 0;
} else {
coverImages[selectedCoverIdx] = url;
}
renderCoverGallery();
updateImgPreview();
});
}

var fImgUploadBtn = document.getElementById('fImgUpload');
if (fImgUploadBtn) {
fImgUploadBtn.addEventListener('click', function () {
__uploadToCoverSlot(selectedCoverIdx);
});
}

function __uploadToCoverSlot(idx) {
var input = document.createElement('input');
input.type = 'file';
input.accept = 'image/*';
input.onchange = function () {
var file = input.files[0];
if (!file) return;
var form = new FormData();
form.append('file', file);
toast('上传中', 'info');
fetch('/api/upload', { method: 'POST', body: form, credentials: 'include' })
.then(function (r) { return r.json(); })
.then(function (res) {
if (res && res.ok && res.url) {
if (coverImages.length === 0 || idx >= coverImages.length) {
if (idx >= coverImages.length) coverImages.push(res.url);
else coverImages[idx] = res.url;
} else {
coverImages[idx] = res.url;
}
selectedCoverIdx = idx;
renderCoverGallery();
updateFImgInput();
updateImgPreview();
toast('上传成功', 'success');
} else {
toast(res.msg || '上传失败', 'error');
}
})
.catch(function () { toast('图片没传上去：网络没连上或文件太大，换一张或稍后再试', 'error'); });
};
input.click();
}

window.__coverImages = function () { return coverImages; };
window.__setCoverImages = function (arr) {
coverImages = (arr || []).slice();
selectedCoverIdx = 0;
renderCoverGallery();
updateFImgInput();
updateImgPreview();
};
window.__coverMainImage = function () { return coverImages[0] || ''; };
window.__renderCoverGallery = renderCoverGallery;
})();

var annEditor = document.getElementById('setAnnouncement');
bindFileCardManagement(annEditor);
var annTitleInput = document.getElementById('annTitleInput');
var annListEl = document.getElementById('annList');
var annEditLabel = document.getElementById('annEditLabel');
var annDraftPending = false;
var stateAnn = { list: [], raw: [], curId: null, loaded: false };
(function () { var _tb = document.getElementById('announcementRteToolbar'); if (_tb) _tb.style.display = 'none'; if (annEditor) annEditor.style.display = 'none'; var _ct0 = document.querySelector('.rte-count[data-for="setAnnouncement"]'); if (_ct0) _ct0.style.display = 'none'; })();
function flushAnnEdit() {
if (stateAnn._skipNextFlush) { stateAnn._skipNextFlush = false; return; }
if (stateAnn.curId) {
var cur = stateAnn.list.find(function (x) { return x.id === stateAnn.curId; });
if (cur) { if (annEditor) cur.content = window.__rteClean(annEditor); }
}
}

function openAnnPreview() {
flushAnnEdit();
var old = document.getElementById('annPvMask'); if (old) old.remove();
var mask = document.createElement('div');
mask.className = 'modal-mask'; mask.id = 'annPvMask';
mask.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="公告预览" style="max-width:var(--modal-w-md)">' +
'<button type="button" class="modal-close-x" aria-label="关闭" data-x="1"><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
'<h2 class="modal-title">公告预览</h2>' +
'<div class="pv-ann-tip">这就是访客看到的样子（隐藏的公告不会显示，改完记得点保存）</div>' +
'<iframe class="pv-ann-frame" id="annPvFrame" title="公告预览"></iframe>' +
'<div class="modal-footer"><button type="button" class="modal-close" data-x="1">关闭</button></div></div>';
document.body.appendChild(mask);
requestAnimationFrame(function () { mask.classList.add('open'); });
if (window.syncBodyLock) window.syncBodyLock();
var close = function () {
mask.classList.remove('open');
setTimeout(function () { mask.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180);
};
mask.addEventListener('click', function (e) { if (e.target === mask || (e.target.closest && e.target.closest('[data-x]'))) close(); });
var fr = mask.querySelector('#annPvFrame');
var send = function () {
var list = (stateAnn.list || []).map(function (a) {
return { id: a.id, title: a.title || '', content: a.content || '', hidden: a.hidden || 0, sort: a.sort || 0, level: a.level || 2 };
});
try { fr.contentWindow.postMessage({ type: 'wnzyq-ann-preview', list: list }, location.origin); } catch (e) {}
};
fr.addEventListener('load', function () { setTimeout(send, 200); });
fr.src = '/shop?preview=ann';
var onReady = function (ev) {
if (!ev.data || ev.data.type !== 'wnzyq-ann-ready') return;
window.removeEventListener('message', onReady);
send();
};
window.addEventListener('message', onReady);
}

function renderAnnList() {
var _alBox = document.getElementById('annList'); if (_alBox) { var _als = _alBox.querySelectorAll('.ann-skel-item'); for (var i=0;i<_als.length;i++) _als[i].parentNode.removeChild(_als[i]); }

var __h0 = annListEl ? annListEl.offsetHeight : 0;
var _ah = __h0; if (_ah > 0) annListEl.style.minHeight = _ah + 'px'; annListEl.innerHTML = '';

var __annSize = window.LIST_PAGE_SIZE || 20;
var __annTotal = stateAnn.list.length;
var __annPages = Math.max(1, Math.ceil(__annTotal / __annSize));
var __annP = Math.min(Math.max(1, parseInt(window.__annPage, 10) || 1), __annPages);
window.__annPage = __annP;
var __annFrom = (__annP - 1) * __annSize;
stateAnn.list.slice(__annFrom, __annFrom + __annSize).forEach(function (a, __ai) {
var idx = __annFrom + __ai;
var item = document.createElement('div');
item.className = 'ann-item' + (a.level === 1 ? ' primary' : '') + (a.id === stateAnn.curId ? ' ann-cur' : '');
item.draggable = false; item.dataset.idx = idx; item.style.cursor = 'default';
var handle = document.createElement('span');
handle.className = 'drag-handle'; handle.draggable = a.level === 1 ? false : true; handle.style.opacity = a.level === 1 ? '0.35' : '1'; handle.title = a.level === 1 ? '默认公告不可拖动' : '拖动排序';
handle.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>';
var txt = document.createElement('input'); txt.type = 'text'; txt.className = 'ann-title-input'; txt.readOnly = a.level === 1;
txt.value = a.title || ''; txt.title = '点击修改公告项名字';
txt.addEventListener('click', function (e) { e.stopPropagation(); });
txt.addEventListener('input', function () { a.title = this.value; });
txt.addEventListener('change', function () { if (!this.value.trim()) { this.value = a.title = '(未命名公告)'; } if (annEditLabel) annEditLabel.textContent = '编辑公告：' + a.title; });
var sortEl = document.createElement('span'); sortEl.style.cssText = 'color:var(--text-faint);font-size:12px;min-width:40px;text-align:left;flex-shrink:0;'; sortEl.textContent = '排序:' + (idx + 1);
var annStatusBtn = document.createElement('button');
annStatusBtn.className = 'row-btn status-btn ' + (a.hidden ? 'status-hidden' : 'status-online');
annStatusBtn.textContent = a.hidden ? '隐藏' : '显示';
annStatusBtn.title = '点击切换为' + (a.hidden ? '显示' : '隐藏');
annStatusBtn.addEventListener('click', function (e) { e.stopPropagation(); a.hidden = a.hidden ? 0 : 1; var _lab = this.querySelector('.btn-lab'); if (_lab) _lab.textContent = a.hidden ? '隐藏' : '显示'; else this.textContent = a.hidden ? '隐藏' : '显示'; this.classList.remove('status-online', 'status-hidden'); this.classList.add(a.hidden ? 'status-hidden' : 'status-online'); this.title = '点击切换为' + (a.hidden ? '显示' : '隐藏'); });
if (window.__decorateBtn) window.__decorateBtn(annStatusBtn, a.hidden ? 'hide' : 'show', 2);
var pvBtn = document.createElement('button'); pvBtn.className = 'row-btn'; pvBtn.textContent = '预览'; pvBtn.title = '按访客看到的样式预览';
pvBtn.addEventListener('click', function (e) { e.stopPropagation(); openAnnPreview(); });
var delBtn = document.createElement('button'); delBtn.className = 'row-btn danger'; delBtn.textContent = '删除';
if (window.__decorateBtn) window.__decorateBtn(delBtn, 'del', 6);
delBtn.addEventListener('click', function (e) {
e.stopPropagation();
showConfirm('删除公告', '确定删除公告「' + (a.title || '') + '」？删除后进「回收站点」，保留 60 天，随时恢复。', function (closeConfirm) {
closeConfirm();

a.deleted = 1; a.deletedAt = new Date().toISOString();
stateAnn.list = stateAnn.list.filter(function (x) { return x.id !== a.id; });
if (stateAnn.curId === a.id) stateAnn.curId = null;
if (!stateAnn.curId && stateAnn.list.length) { renderAnnList(); selectAnnItem(stateAnn.list[0].id); }
else if (!stateAnn.list.length) clearAnnEdit();
else renderAnnList();
});
});
item.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.select-picker, .cat-picker, .cat-picker-panel, .cp-item, .cat-picker-display')) return; selectAnnItem(a.id); });
item.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', idx); this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
item.addEventListener('dragend', function () { this.classList.remove('dragging'); document.querySelectorAll('.ann-item').forEach(function (el) { el.classList.remove('drag-over'); }); });
item.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; this.classList.add('drag-over'); });
item.addEventListener('dragleave', function () { this.classList.remove('drag-over'); });
item.addEventListener('drop', function (e) {
e.preventDefault(); this.classList.remove('drag-over');
var fromIdx = Number(e.dataTransfer.getData('text/plain'));
var toIdx = idx;
if (fromIdx === toIdx || isNaN(fromIdx)) return;
if (toIdx === 0) toIdx = 1;
var _al = document.getElementById('annList') || item.parentNode;
var _flip = (window.__motion && __motion.flipSnap) ? __motion.flipSnap(_al, '.ann-item') : null;
var moved = stateAnn.list.splice(fromIdx, 1)[0];
stateAnn.list.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved);
stateAnn.list.forEach(function (v2, i) { v2.sort = i + 1; });
renderAnnList();
try { if (_flip) _flip(); } catch (e3) { if (window.__silent) window.__silent(e3); }
});

var _agMain = document.createElement('span'); _agMain.className = 'ann-group ann-main-group';
_agMain.appendChild(txt); _agMain.appendChild(sortEl);

var _agAct = document.createElement('span'); _agAct.className = 'ann-group ann-act-group c-meta';
_agAct.appendChild(annStatusBtn); _agAct.appendChild(pvBtn); _agAct.appendChild(delBtn);
item.appendChild(handle); item.appendChild(_agMain); item.appendChild(_agAct);

var fold = document.createElement('button');
fold.type = 'button'; fold.className = 'cat-fold'; fold.title = '展开/收起操作'; fold.setAttribute('aria-label', '展开/收起操作');
fold.innerHTML = '<svg class="toggle-arrow" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>';
fold.addEventListener('click', function (e) { e.stopPropagation(); item.classList.toggle('cat-open'); });
item.appendChild(fold);
annListEl.appendChild(item);
});

if (__annTotal > __annSize) {
var __apb = document.createElement('div');
__apb.className = 'uni-pager';
annListEl.appendChild(__apb);
if (window.buildUniPager) {
window.buildUniPager(__apb, {
page: __annP, totalPages: __annPages, total: __annTotal, unit: '条',
onPage: function (p7) { window.__annPage = p7; renderAnnList(); }
});
}
}

try {
var __h1 = annListEl.offsetHeight;
var __maskOpen = document.getElementById('annMask') && document.getElementById('annMask').classList.contains('open');
if (__maskOpen && __h1 !== __h0 && __h0 > 0) {
annListEl.style.overflow = 'hidden';
annListEl.style.maxHeight = __h0 + 'px';
void annListEl.offsetHeight;
annListEl.style.transition = 'max-height var(--dur-mid) var(--ease-out)';
annListEl.style.maxHeight = __h1 + 'px';
setTimeout(function () { annListEl.style.transition = ''; annListEl.style.maxHeight = ''; annListEl.style.overflow = ''; annListEl.style.minHeight = ''; }, 240);
} else if (annListEl) { annListEl.style.minHeight = ''; }
} catch (e9) { if (window.__silent) window.__silent(e9); }
}
function selectAnnItem(id) {
flushAnnEdit();
var a = stateAnn.list.find(function (x) { return x.id === id; });
if (!a) return;
stateAnn.curId = id;
if (annEditor) annEditor.innerHTML = a.content || '';
if (annEditLabel) annEditLabel.textContent = '编辑公告：' + (a.title || '(未命名)');
var _idxA = -1; for (var _ii = 0; _ii < stateAnn.list.length; _ii++) { if (stateAnn.list[_ii].id === id) { _idxA = _ii; break; } }
document.querySelectorAll('.ann-item').forEach(function (el) { el.classList.toggle('ann-cur', Number(el.dataset.idx) === _idxA); });
}
function clearAnnEdit() {
flushAnnEdit();
stateAnn.curId = null;
if (annEditor) annEditor.innerHTML = '';
if (annEditLabel) annEditLabel.textContent = '编辑公告';
renderAnnList();
}
function annDiscard() {
try { if (stateAnn._backup) { stateAnn.list = JSON.parse(JSON.stringify(stateAnn._backup)); stateAnn._backup = null; } } catch (e) { if (window.__silent) window.__silent(e); }
annDraftPending = false; stateAnn.loaded = false;
stateAnn.curId = null;
stateAnn._draftRestored = false;
stateAnn._stashed = false;
try { document.getElementById('annMode').value = stateAnn._modeSaved || 'always'; syncSelectDisplay(document.getElementById('annMode')); } catch (e) { if (window.__silent) window.__silent(e); }
var _dl = null;
try { _dl = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; } catch (e) { if (window.__silent) window.__silent(e); }
if (annEditor) annEditor.innerHTML = _dl ? (_dl.content || '') : '';
if (annEditLabel) annEditLabel.textContent = _dl ? ('编辑公告：' + (_dl.title || '(未命名)')) : '编辑公告';
try { renderAnnList(); } catch (e) { if (window.__silent) window.__silent(e); }
try { document.getElementById('annMask').classList.remove('open'); } catch (e) { if (window.__silent) window.__silent(e); }
try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
}
window.__annDiscard = annDiscard;
function annStash() {
try { flushAnnEdit(); } catch (e) { if (window.__silent) window.__silent(e); }
stateAnn._stashed = true;
try { document.getElementById('annMask').classList.remove('open'); } catch (e) { if (window.__silent) window.__silent(e); }
}
window.__annStash = annStash;
document.getElementById('openAnnBtn').addEventListener('click', function () {
var slot = document.getElementById('annEditorSlot');
if (slot && slot.querySelector('#setAnnouncement') === null) {
var _tb = document.getElementById('announcementRteToolbar');
if (_tb) { _tb.style.display = ''; slot.appendChild(_tb); }
if (annEditor) { annEditor.style.display = ''; slot.appendChild(annEditor); }

var _ct = document.querySelector('.rte-count[data-for="setAnnouncement"]');
if (_ct) { _ct.style.display = ''; slot.appendChild(_ct); }
}
document.getElementById('annMask').classList.add('open');
var _draftRestored = false;
try { _draftRestored = window.__restoreEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
if (_draftRestored && stateAnn.list && stateAnn.list.length) {
try { renderAnnList(); if (stateAnn.curId) selectAnnItem(stateAnn.curId); else { var _dl0 = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; if (_dl0) selectAnnItem(_dl0.id); } } catch (e) { if (window.__silent) window.__silent(e); }
} else if (stateAnn.loaded && stateAnn.list.length) {
try { renderAnnList(); var _sel0 = (stateAnn.curId && stateAnn.list.some(function (x) { return x.id === stateAnn.curId; })) ? stateAnn.curId : ((stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]).id); stateAnn._draftRestored = false; selectAnnItem(_sel0); } catch (e) { if (window.__silent) window.__silent(e); }
if (stateAnn._stashed) { stateAnn._stashed = false; }
}
if (!stateAnn.loaded) {
api('admin/settings').then(function (res) {
if (res && res.ok) {

stateAnn.raw = window.parseAnnouncements(res.settings || {}, { sortLevel: true });
stateAnn.list = stateAnn.raw.filter(function (x) { return !x.deleted; });
if (!stateAnn.list.some(function (x) { return x.level === 1; })) stateAnn.list.unshift({ id: 'def', title: '公告', content: (res.settings || {}).announcement || '', hidden: 0, sort: 0, level: 1 }); stateAnn._backup = JSON.parse(JSON.stringify(stateAnn.list));
stateAnn.loaded = true;
document.getElementById('annMode').value = (res.settings || {}).announcement_mode || 'always';
syncSelectDisplay(document.getElementById('annMode'));
if (window.__annModeHint) window.__annModeHint();
stateAnn._modeSaved = (res.settings || {}).announcement_mode || 'always';
if (stateAnn.list.length) { var _defAnn = stateAnn.list.find(function (x) { return x.level === 1; }) || stateAnn.list[0]; renderAnnList(); selectAnnItem(_defAnn.id); } else { renderAnnList(); clearAnnEdit(); }
}
}).catch(function () {});
}
});
function addNewAnnouncement() {
flushAnnEdit();
var a = { id: Date.now(), title: '新公告', content: '', hidden: 0, sort: stateAnn.list.length + 1, level: 2 };
stateAnn.list.push(a);
renderAnnList();
selectAnnItem(a.id);
}

function annModeHint() {
var sel = document.getElementById('annMode');
var box = document.getElementById('annModeHint');
if (!sel || !box) return;
var v = sel.value || 'always';
if (v === 'always') {
box.innerHTML = '现在选的是「每次进来都弹」：老客户一天进三次就被挡三次。' +
'<button type="button" class="row-btn ann-hint-btn" id="annToDaily">改成每天一次</button>';
} else if (v === 'daily') {
box.textContent = '现在选的是「每天只弹一次」：同一天第二次进来不再打扰；没看过的公告，资源页顶栏「公告」键上仍有红点。';
} else if (v === 'session') {
box.textContent = '现在选的是「一次浏览只弹一次」：刷新页面或重开浏览器会再弹一次。';
} else {
box.textContent = '现在选的是「不自动弹」：客户只能自己点资源页顶栏「公告」键查看。';
}
}
window.__annModeHint = annModeHint;
(function () {
var sel = document.getElementById('annMode'), box = document.getElementById('annModeHint');
if (!sel || !box) return;
sel.addEventListener('change', annModeHint);
box.addEventListener('click', function (e) {
if (!e.target.closest || !e.target.closest('#annToDaily')) return;
sel.value = 'daily';
if (window.syncSelectDisplay) window.syncSelectDisplay(sel);
annModeHint();

var sv = document.getElementById('saveAnnBtn');
if (sv) sv.click();
});
annModeHint();
})();

document.getElementById('saveAnnBtn').addEventListener('click', function () {
var annBtn = this;
var _annBtnText = annBtn.textContent;
annBtn.disabled = true;
if (window.__btnBusy) window.__btnBusy(annBtn, '确定中');
flushAnnEdit();

var _annOut = (stateAnn.raw || []).filter(function (x) { return x.deleted; }).concat(stateAnn.list);
var data = {
announcement: '',
announcement_mode: document.getElementById('annMode').value,
announcements: JSON.stringify(_annOut)
};
api('admin/settings', { method: 'PUT', body: JSON.stringify(data) }).then(function (res) {
if (res && res.ok) {

try {
annBtn.textContent = '✓ 已保存';
annBtn.style.background = 'var(--green, #2e7d32)'; annBtn.style.borderColor = 'var(--green, #2e7d32)'; annBtn.style.color = '#fff';
setTimeout(function () { annBtn.textContent = _annBtnText; annBtn.style.background = ''; annBtn.style.borderColor = ''; annBtn.style.color = ''; }, 400);
} catch (e0) { if (window.__silent) window.__silent(e0); }
if (window.__haptic) window.__haptic();
stateAnn.loaded = true; annDraftPending = false;
try { stateAnn._backup = JSON.parse(JSON.stringify(stateAnn.list)); } catch (e0) { stateAnn._backup = null; }
try { stateAnn.raw = JSON.parse(JSON.stringify(_annOut)); } catch (e0) {}
stateAnn._modeSaved = document.getElementById('annMode').value;
stateAnn._stashed = false;
try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }

annBtn.disabled = false;
if (window.__btnIdle) window.__btnIdle(annBtn); else { annBtn.textContent = _annBtnText; }
document.getElementById('annMask').classList.remove('open');
} else { annBtn.disabled = false; annBtn.textContent = _annBtnText; toast(res.msg || '保存失败', 'error'); }
}).catch(function () {
annBtn.disabled = false; annBtn.textContent = _annBtnText;
toast(window.T('netFail'), 'error');
});
});
document.getElementById('cancelAnnBtn').addEventListener('click', function () {
annDiscard();
});

document.getElementById('infoMask').addEventListener('click', function (e) {
if (e.target === document.getElementById('infoMask')) document.getElementById('infoMask').classList.remove('open');
});

document.getElementById('infoMask').addEventListener('click', function (e) {
var b = e.target.closest && e.target.closest('[data-test]');
if (!b) return;
e.stopPropagation();
var inp = document.getElementById(b.getAttribute('data-test'));
var u = inp ? String(inp.value || '').trim() : '';
if (!u) { if (window.showToast) window.showToast('这条链接还是空的，先填再测', 'info'); return; }
if (!/^https?:\/\//i.test(u)) { if (window.showToast) window.showToast('链接要以 http:// 或 https:// 开头', 'error'); return; }
var w = window.open(u, '_blank', 'noopener');
if (!w && window.showToast) window.showToast('浏览器拦了新窗口，允许弹出后再点一次', 'info');
});
document.getElementById('annMask').addEventListener('click', function (e) {
if (e.target === document.getElementById('annMask')) { window.__annStash(); }
});

var __infoCfg = {
contact: { qrKey: 'contact_qr', urlKey: 'contact_url', defUrl: 'https://work.weixin.qq.com/kfid/kfc39748ad948e8b691' },
group: { qrKey: 'group_qr', urlKey: 'group_url', defUrl: 'https://work.weixin.qq.com/gm/8036a2badd7daab25b1764b62c3bff9a' },
gzh: { qrKey: 'gzh_qr', urlKey: null, defUrl: '' }
};
window.__infoSettings = { contact_qr: '', group_qr: '', gzh_qr: '', contact_url: '', group_url: '' };
var __infoCap = function (k) { return k === 'gzh' ? 'Gzh' : k.charAt(0).toUpperCase() + k.slice(1); };
var __infoPending = { contact: '', group: '', gzh: '' };
window.__infoApply = function (s) {
s = s || {};
Object.keys(__infoCfg).forEach(function (k) {
var c = __infoCfg[k];
var qr = s[c.qrKey] !== undefined ? (s[c.qrKey] || '') : (window.__infoSettings[c.qrKey] || '');
window.__infoSettings[c.qrKey] = qr;
if (k === 'contact') window.__contactQr = qr;
if (k === 'group') window.__groupQr = qr;
if (k === 'gzh') window.__gzhQr = qr;
if (c.urlKey) {
var uv = s[c.urlKey] !== undefined ? (s[c.urlKey] || '') : (window.__infoSettings[c.urlKey] || '');
window.__infoSettings[c.urlKey] = uv;
if (k === 'contact') window.__infoContactUrl = uv || c.defUrl;
var it = document.getElementById('infoItem' + __infoCap(k));
if (!it || !it.classList.contains('open')) {
var inp = document.getElementById('infoUrl' + __infoCap(k));

if (inp && document.activeElement !== inp) inp.value = uv || c.defUrl;
}
}
var it2 = document.getElementById('infoItem' + __infoCap(k));
if (!it2 || !it2.classList.contains('open')) __infoPending[k] = qr;
__infoRefreshPanel(k);
});
};
function __infoRefreshPanel(k) {
var C = __infoCap(k);
var qr = __infoPending[k] || '';
var img = document.getElementById('infoQrImg' + C);
var del = document.getElementById('infoQrDel' + C);
var add = document.getElementById('infoQrAdd' + C);
if (img) {
var _tip = document.getElementById('infoQrTip' + C);
if (qr) { img.src = qr; img.style.display = ''; if (_tip) _tip.remove(); }
else { img.removeAttribute('src'); img.style.display = 'none'; if (!_tip && img.parentNode) { _tip = document.createElement('div'); _tip.id = 'infoQrTip' + C; _tip.style.cssText = 'font-size:12px;color:var(--text-light);padding:10px 0;line-height:1.7'; _tip.textContent = '该行暂无二维码——点上方「上传二维码」添加，访客长按图片即可识别'; img.parentNode.appendChild(_tip); } }
}
if (del) del.style.display = qr ? '' : 'none';
if (add) add.style.display = qr ? 'none' : '';
}

function __infoPreview(k) {
var c = __infoCfg[k], C = __infoCap(k);
var meta = {
contact: { title: '咨询客服', tip: '长按图片识别-添加人工客服', btn: '跳转-咨询在线客服', green: true },
group: { title: '交流群聊', tip: '长按图片识别-加入交流群聊', btn: '跳转-加入交流群聊' },
gzh: { title: '公众号讯', tip: '长按图片识别-关注公众号讯', btn: '' }
}[k];
var qr = __infoPending[k] || (window.__infoSettings[c.qrKey] || '');
var jumpUrl = '';
if (c.urlKey) {
var inp = document.getElementById('infoUrl' + C);
jumpUrl = ((inp && inp.value) || '').trim() || (window.__infoSettings[c.urlKey] || '') || c.defUrl;
}
if (window.openContactModal) {
window.openContactModal(jumpUrl, qr, meta.tip, jumpUrl && meta.btn ? meta.btn : '', { title: meta.title, green: !!meta.green });
if (window.__haptic) window.__haptic();
}
}
(function __infoInit() {

try {
var __keyGlow = function (keyId, maskId) {
var k = document.getElementById(keyId), m = document.getElementById(maskId);
if (!k || !m) return;
new MutationObserver(function () { k.classList.toggle('active', m.classList.contains('open')); }).observe(m, { attributes: true, attributeFilter: ['class'] });
};
__keyGlow('topInfoBtn', 'infoCtMask');
__keyGlow('openInfoBtn', 'infoMask');
__keyGlow('openAnnBtn', 'annMask');
} catch (e) { if (window.__silent) window.__silent(e); }

var edContact = document.getElementById('edContactBtn');
if (edContact) edContact.addEventListener('click', function () { __infoPreview('contact'); });

var open = document.getElementById('openInfoBtn');
if (open) open.addEventListener('click', function () {
var mk = document.getElementById('infoMask');
if (mk && !mk.classList.contains('open')) mk.classList.add('open');
if (window.__haptic) window.__haptic();
});
['contact', 'group', 'gzh'].forEach(function (k) {
var c = __infoCfg[k], C = __infoCap(k);
var toggle = function () {
var it = document.getElementById('infoItem' + C);
var willOpen = it ? !it.classList.contains('open') : false;
if (it) it.classList.toggle('open', willOpen);
var fold = document.getElementById('infoFold' + C);
if (fold) fold.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
if (willOpen) { __infoRefreshPanel(k);

setTimeout(function () {
try {
var itc = document.getElementById('infoItem' + C);
if (!itc || !itc.classList.contains('open')) return;
var body = itc.querySelector('.info-cfg') || itc.lastElementChild;
if (body && body.offsetHeight < 28) { itc.classList.remove('open'); if (fold) fold.setAttribute('aria-expanded', 'false'); if (window.showToast) window.showToast('该行暂无可配置内容', 'info'); }
} catch (e2) { if (window.__silent) window.__silent(e2); }
}, 80);
}
if (willOpen) {
var ni = document.getElementById('infoNet' + C);
if (ni && document.activeElement !== ni) ni.value = __infoPending[k] || (window.__infoSettings[c.qrKey] || '');
}
if (window.__haptic) window.__haptic();
};
var fold = document.getElementById('infoFold' + C);
if (fold) fold.addEventListener('click', toggle);
var col = document.getElementById('infoCollapse' + C);

var add = document.getElementById('infoQrAdd' + C);
var fi = document.getElementById('infoQrFile' + C);
if (add && fi) {
add.addEventListener('click', function () { fi.click(); });
fi.addEventListener('change', function () {
var f = this.files && this.files[0]; this.value = '';
if (!f) return;
toast('正在上传二维码…', 'info');
uploadToBucket(f, function (url) {
if (!url) return;
__infoPending[k] = url;
__infoRefreshPanel(k);
toast('二维码已就绪，点「保存」后生效', 'info');
if (window.__haptic) window.__haptic();
});
});
}
var del = document.getElementById('infoQrDel' + C);
if (del) del.addEventListener('click', function () {
__infoPending[k] = '';
__infoRefreshPanel(k);
});

var net = document.getElementById('infoNet' + C);
if (net) {
net.addEventListener('change', function () {
var v = (net.value || '').trim();
if (v && !/^https?:\/\//i.test(v)) { toast('网络地址需以 http(s):// 开头', 'error'); return; }
__infoPending[k] = v;
__infoRefreshPanel(k);
if (v) { toast('网络图已就绪，点「保存」后生效', 'info'); if (window.__haptic) window.__haptic(); }
});
}

var pvBtn = document.getElementById('infoBtn' + C);
if (pvBtn) pvBtn.addEventListener('click', function () { __infoPreview(k); });

function __infoSaveRow(after) {
var body = {}; body[c.qrKey] = __infoPending[k] || '';
if (c.urlKey) {
var inp = document.getElementById('infoUrl' + C);
body[c.urlKey] = (inp ? inp.value : '').trim();

if (body[c.urlKey] && !/^https?:\/\//i.test(body[c.urlKey])) {
toast('跳转链接要以 http:// 或 https:// 开头', 'error');
var _bad = document.getElementById('infoUrl' + C); if (_bad) { try { _bad.focus(); } catch (eF) {} }
return;
}
}
var b = col, _t = b.textContent;
b.disabled = true; if (window.__btnBusy) window.__btnBusy(b, '保存中');
api('admin/settings', { method: 'PUT', body: JSON.stringify(body) }).then(function (res) {
b.disabled = false; b.textContent = _t;
if (res && res.ok) {
var s2 = {}; Object.keys(body).forEach(function (kk) { s2[kk] = body[kk]; });
window.__infoSettings[c.qrKey] = body[c.qrKey]; __infoPending[k] = body[c.qrKey];
if (c.urlKey) window.__infoSettings[c.urlKey] = body[c.urlKey];
window.__infoApply(s2);
try { localStorage.setItem('wnzyq_kf_url_updated', Date.now().toString()); } catch (e) { if (window.__silent) window.__silent(e); }
if (window.__haptic) window.__haptic();
if (window.showToast) window.showToast(window.T('saved'), 'success');
if (after) after();
}
else { toast((res && res.msg) || '保存失败', 'error'); }
}).catch(function () { b.disabled = false; b.textContent = _t; toast(window.T('netFail'), 'error'); });
}

var sv = document.getElementById('infoSave' + C);
if (sv) sv.addEventListener('click', function () { __infoSaveRow(); });
if (col) col.addEventListener('click', function () { toggle(); });
});
})();

document.querySelectorAll('#announcementRteToolbar .rte-btn[data-cmd]').forEach(function (btn) {
btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
btn.addEventListener('click', function () {
var cmd = this.dataset.cmd;
if (__rte.editor !== annEditor || !__rte.range) return;
if (!(cmd === 'underline' && rteUnderlineLink(annEditor))) document.execCommand(cmd, false, null);
rteFocusStay(annEditor);
});
});

document.querySelectorAll('#announcementRteToolbar .rte-select[data-cmd]').forEach(function (sel) {
sel.addEventListener('change', function () {
var cmd = this.dataset.cmd;
var val = this.value;
if (val && __rte.editor === annEditor && __rte.range) {

try { rteFocusStay(annEditor); } catch (eF) {}
try { var _ps = window.getSelection(); _ps.removeAllRanges(); _ps.addRange(__rte.range); } catch (eR) {}
document.execCommand(cmd, false, val);
try { __rte.editor = annEditor; __rte.range = window.getSelection().getRangeAt(0).cloneRange(); } catch (eC) {}
rteFocusStay(annEditor);
}
this.selectedIndex = 0;
syncSelectDisplay(this);
});
});

document.getElementById('announcementRteLink').addEventListener('click', function () {
showLinkDialog('', '', function (url, text) {
var html = '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer"><u>' + text + '</u></a>';
rteInsert(__rte.editor, html);
toast('超链接已插入', 'success');
});
});

document.getElementById('announcementRteImg').addEventListener('click', function () {
showMediaInput('image', function (url) {
if (!url) return;
url = url.trim();
var html = '<img src="' + url.replace(/"/g, '&quot;') + '" alt="图片" style="max-width:100%;border-radius:8px;" />';
rteInsert(__rte.editor || document.getElementById('setAnnouncement'), html);
toast('图片已插入', 'success');
});
});

document.getElementById('announcementRteVideo').addEventListener('click', function () {
showMediaInput('video', function (url) {
if (!url) return;
url = url.trim();
var html = '<video src="' + url.replace(/"/g, '&quot;') + '" controls style="max-width:100%;border-radius:8px;"></video>';
rteInsert(__rte.editor || document.getElementById('setAnnouncement'), html);
toast('视频已插入', 'success');
});
});

document.getElementById('announcementRteFile').addEventListener('click', function () {
setupFileDialog(__rte.editor || document.getElementById('setAnnouncement'));
});

var annBrushStyle = null;
document.getElementById('announcementFormatBrush').addEventListener('mousedown', function (e) { e.preventDefault(); });
document.getElementById('announcementFormatBrush').addEventListener('click', function () {
var brushBtn = this;
if (!annBrushStyle) {
var sel = window.getSelection();
if (sel.rangeCount > 0 && !sel.isCollapsed) {
annBrushStyle = rteReadBrushStyle();
brushBtn.classList.add('active');
toast('格式已复制，选中其他内容后再次点击格式刷应用', 'success');
} else {
toast('请先选中要复制格式的内容', 'error');
}
} else {
var sel2 = window.getSelection();
if (sel2.rangeCount > 0 && !sel2.isCollapsed) {
rteApplyBrushStyle(annBrushStyle);
rteFocusStay(annEditor);
toast('格式已应用', 'success');
} else {
toast('请先选中要应用格式的内容', 'error');
}
annBrushStyle = null;
brushBtn.classList.remove('active');
}
});

function updateAnnPlaceholder() {
if (!annEditor.innerHTML || annEditor.innerHTML === '<br>' || annEditor.innerHTML === '<p><br></p>') {
annEditor.style.color = '#999';
} else {
annEditor.style.color = '#333';
}
}
annEditor.addEventListener('input', updateAnnPlaceholder);
annEditor.addEventListener('focus', function () { __rte.editor = annEditor; updateAnnPlaceholder(); });
annEditor.addEventListener('blur', updateAnnPlaceholder);

var variantDraftPending = false;
var variantDraftFor = null;
addVariantBtn.addEventListener('click', function () {
if (!state.editingId) {
openVariantEdit(null);
return;
}
openVariantEdit(null);
});

function openVariantEdit(v) {
if (variantDraftPending && variantDraftFor === (v ? v.id : null)) { variantDraftPending = false; variantModalTitle.textContent = v ? '编辑类型' : '新增类型'; variantMask.classList.add('open'); if (window.__modalScroll) __modalScroll.open(variantMask, v ? v.id : 'new'); return; }
state.editingVariantId = v ? v.id : null;
variantDraftFor = v ? v.id : null;
state._editVariantIdx = v ? state.variants.indexOf(v) : -1;
variantModalTitle.textContent = v ? '编辑类型' : '新增类型';
var _vd = null;
try { _vd = JSON.parse(localStorage.getItem('wnzyq_variant_draft') || 'null'); if (_vd && _vd.type === 'variant') localStorage.removeItem('wnzyq_variant_draft'); } catch (e) { if (window.__silent) window.__silent(e); }
if (_vd && _vd.type === 'variant' && _vd.id === (v ? v.id : null)) {
vName.value = _vd.name || ''; vTitle.value = _vd.title || ''; document.getElementById('vDescEditor').innerHTML = _vd.desc || '';
} else {
vName.value = v ? (v.name || '') : '';
vTitle.value = v ? (v.title || '') : '';
document.getElementById('vDescEditor').innerHTML = v ? (v.desc || '') : '';
}
vHidden.checked = v ? !!v.isHidden : false;
vContactUrl.value = v ? (v.contactUrl || '') : '';
vPrice.value = v ? (v.price || '') : '';
vSort.value = v ? (v.sort || 0) : 0;
vResourceCode.value = v ? (v.resourceCode || '') : '';
var _vbl = document.getElementById('vBindLimit');
_vbl.value = v && v.bindLimit ? v.bindLimit : 1;
document.getElementById('vContentEditor').innerHTML = v ? (v.resourceContent || '') : '';
variantMask.classList.add('open');

if (window.__modalScroll) __modalScroll.open(variantMask, v ? v.id : 'new');
}

var linkDialogMask = null; var __linkStashOn = false;
function showLinkDialog(defaultUrl, defaultText, callback) {
if (!linkDialogMask) {
linkDialogMask = document.createElement('div');
linkDialogMask.className = 'modal-mask';
linkDialogMask.id = 'linkDialogMask';
linkDialogMask.innerHTML = '<div class="modal-box">' +
'<button class="modal-close-x" data-link-close><svg class="wn-ico" width="16" height="16" aria-hidden="true"><use href="#wn-ico-x"/></svg></button>' +
'<h2 class="modal-title">插入超链接</h2>' +
'<div class="form">' +
'<label>链接地址</label><input id="linkDialogUrl" />' +
'<label>显示文字 </label><input id="linkDialogText" />' +
'</div>' +
'<div class="modal-footer">' +
'<button class="modal-inner-btn" id="linkDialogOk">确定</button>' +
'<button class="modal-close" id="linkDialogCancel">关闭</button>' +
'</div></div>';
document.body.appendChild(linkDialogMask);
linkDialogMask.querySelector('[data-link-close]').addEventListener('click', function () {
try { document.getElementById('linkDialogUrl').value = ''; document.getElementById('linkDialogText').value = ''; } catch (e) { if (window.__silent) window.__silent(e); }
__linkStashOn = false;
linkDialogMask.classList.remove('open');
});
linkDialogMask.querySelector('#linkDialogCancel').addEventListener('click', function () {
try { document.getElementById('linkDialogUrl').value = ''; document.getElementById('linkDialogText').value = ''; } catch (e) { if (window.__silent) window.__silent(e); }
__linkStashOn = false;
linkDialogMask.classList.remove('open');
});
if (window.__modalKit) window.__modalKit.register(linkDialogMask, {
discard: function () { try { document.getElementById('linkDialogUrl').value = ''; document.getElementById('linkDialogText').value = ''; } catch (e) { if (window.__silent) window.__silent(e); } __linkStashOn = false; linkDialogMask.classList.remove('open'); },
stash: function () { __linkStashOn = true; linkDialogMask.classList.remove('open'); }
});
linkDialogMask.addEventListener('click', function (e) {
if (e.target === linkDialogMask) { __linkStashOn = true; linkDialogMask.classList.remove('open'); }
});
}
if (!__linkStashOn) {
document.getElementById('linkDialogUrl').value = defaultUrl || '';
document.getElementById('linkDialogText').value = defaultText || '';
}
linkDialogMask.classList.add('open');
var okBtn = document.getElementById('linkDialogOk');
okBtn.onclick = function () {
var url = document.getElementById('linkDialogUrl').value.trim();
var text = document.getElementById('linkDialogText').value.trim();
if (!url) { toast('请输入链接地址', 'error'); return; }
if (!text) text = url;
linkDialogMask.classList.remove('open');
__linkStashOn = false;
if (callback) callback(url, text);
};
}

function initVariantRte(toolbarId, editorId, linkBtnId, imgBtnId, videoBtnId, formatBrushBtnId) {
var editor = document.getElementById(editorId);
var formatBrushStyle = null;

document.querySelectorAll('#' + toolbarId + ' .rte-btn[data-cmd]').forEach(function (btn) {
btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
btn.addEventListener('click', function () {
if (__rte.editor !== editor || !__rte.range) return;
if (!(this.dataset.cmd === 'underline' && rteUnderlineLink(editor))) document.execCommand(this.dataset.cmd, false, null);
rteFocusStay(editor);
});
});
document.querySelectorAll('#' + toolbarId + ' .rte-select[data-cmd]').forEach(function (sel) {
sel.addEventListener('change', function () {
if (this.value && __rte.editor === editor && __rte.range) {
document.execCommand(this.dataset.cmd, false, this.value);
rteFocusStay(editor);
}
this.selectedIndex = 0;
syncSelectDisplay(this);
});
});
if (formatBrushBtnId) {
var brushBtn = document.getElementById(formatBrushBtnId);
brushBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
brushBtn.addEventListener('click', function () {
if (!formatBrushStyle) {
var sel = window.getSelection();
if (sel.rangeCount > 0 && !sel.isCollapsed) {
formatBrushStyle = rteReadBrushStyle();
brushBtn.classList.add('active');
toast('格式已复制，选中其他内容后再次点击格式刷应用', 'success');
} else {
toast('请先选中要复制格式的内容', 'error');
}
} else {
var sel2 = window.getSelection();
if (sel2.rangeCount > 0 && !sel2.isCollapsed) {
rteApplyBrushStyle(formatBrushStyle);
rteFocusStay(editor);
toast('格式已应用', 'success');
} else {
toast('请先选中要应用格式的内容', 'error');
}
formatBrushStyle = null;
brushBtn.classList.remove('active');
}
});
}
if (linkBtnId) {
document.getElementById(linkBtnId).addEventListener('click', function () {
showLinkDialog('', '', function (url, text) {
var html = '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer"><u>' + text + '</u></a>';
rteInsert(__rte.editor, html);
toast('超链接已插入', 'success');
});
});
}
if (imgBtnId) {
document.getElementById(imgBtnId).addEventListener('click', function () {
showMediaInput('image', function (url) {
if (!url) return;
url = url.trim();
var html = '<img src="' + url.replace(/"/g, '&quot;') + '" alt="图片" style="max-width:100%;border-radius:8px;" />';
rteInsert(__rte.editor || editor, html);
toast('图片已插入', 'success');
});
});
}
if (videoBtnId) {
document.getElementById(videoBtnId).addEventListener('click', function () {
showMediaInput('video', function (url) {
if (!url) return;
url = url.trim();
var html = '<video src="' + url.replace(/"/g, '&quot;') + '" controls style="max-width:100%;border-radius:8px;"></video>';
rteInsert(__rte.editor || editor, html);
toast('视频已插入', 'success');
});
});
}
bindFileCardManagement(editor);
}
initVariantRte('vDescRteToolbar', 'vDescEditor', 'vDescRteLink', 'vDescRteImg', 'vDescRteVideo', 'vDescFormatBrush');
initVariantRte('vContentRteToolbar', 'vContentEditor', 'vContentRteLink', 'vContentRteImg', 'vContentRteVideo', 'vContentFormatBrush');
['fDetail', 'vDescEditor', 'vContentEditor'].forEach(function (id) { var _e = document.getElementById(id); if (_e) _e.addEventListener('focus', function () { __rte.editor = _e; }); });

variantOk.addEventListener('click', function () {
if (!validateField(vName, '请填写类型名称')) return;
var name = vName.value.trim();
var isLocalVariant = !state.editingId;
var data = {
productId: state.editingId,
name: name,
title: vTitle.value.trim(),
desc: window.__rteClean(document.getElementById('vDescEditor')),
img: '',
video: '',
isHidden: vHidden.checked,
contactUrl: vContactUrl.value.trim(),
price: Number(vPrice.value) || 0,
sort: Number(vSort.value) || 0,
resourceCode: vResourceCode.value.trim(),
resourceContent: window.__rteClean(document.getElementById('vContentEditor')),
bindLimit: Math.max(1, parseInt(document.getElementById('vBindLimit').value, 10) || 1)
};
if (isLocalVariant) {
var _li = (typeof state._editVariantIdx === 'number') ? state._editVariantIdx : -1;
if (_li >= 0 && state.variants[_li]) { Object.assign(state.variants[_li], data); } else { state.variants.push(data); }
state.variants.forEach(function (vv, i) { vv.sort = i + 1; });
variantDraftPending = false; variantMask.classList.remove('open');
try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
toast('类型已新增（保存资源后生效）', 'success');
renderVariants();
return;
}
var _variantOkText = variantOk.textContent;
variantOk.disabled = true;
if (window.__btnBusy) window.__btnBusy(variantOk, '确定中');
var req = state.editingVariantId
? api('admin/variants/' + state.editingVariantId, { method: 'PUT', body: JSON.stringify(data) })
: api('admin/variants', { method: 'POST', body: JSON.stringify(data) });
req.then(function (res) {
if (res && res.ok) {
variantDraftPending = false; variantMask.classList.remove('open');
try { window.__clearEditingDraft(); } catch (e) { if (window.__silent) window.__silent(e); }
toast('类型已保存', 'success'); if (window.__haptic) window.__haptic();
if (state.editingVariantId) {
var _uv = (state.variants || []).find(function (x) { return x.id === state.editingVariantId; });
if (_uv) Object.assign(_uv, data);
} else if (res.id) {
(state.variants = state.variants || []).push(Object.assign({ id: res.id, bindings: 0 }, data));
}
var _uvp = (state.products || []).find(function (x) { return x.id === state.editingId; });
if (_uvp) _uvp.variants = (state.variants || []).slice();
renderVariants();
loadVariants(state.editingId);
} else {
variantOk.disabled = false; variantOk.textContent = _variantOkText;
toast(res.msg || '保存失败', 'error');
}
}).catch(function () {
variantOk.disabled = false; variantOk.textContent = _variantOkText;
toast(window.T('netFail'), 'error');
});
});


(function () {

var LS_KEY = 'wnzyq_admin_last_seen';
function lsGet() {
try {
var v = localStorage.getItem(LS_KEY);
if (v) return v;
var oldV = localStorage.getItem('admin_last_seen');
if (oldV) { localStorage.setItem(LS_KEY, oldV); localStorage.removeItem('admin_last_seen'); }
return oldV;
} catch (e) { if (window.__silent) window.__silent(e); return null; }
}
var mask = document.getElementById('infoCtMask');
if (!mask) return;
var btn = document.getElementById('topInfoBtn');
var dot = document.getElementById('infoDot');
var fmtTime = function (utc) {
try {
var d = new Date(String(utc).replace(' ', 'T').replace(/(\.\d+)?$/, '') + (String(utc).indexOf('Z') === -1 && String(utc).indexOf('+') === -1 ? 'Z' : ''));
if (isNaN(d.getTime())) return String(utc).slice(5, 16);
var p = function (n) { return n < 10 ? '0' + n : n; };
return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
} catch (e) { return String(utc).slice(5, 16); }
};
var maskIP = function (ip) {
var s = String(ip || '');
if (s.indexOf('设备') === 0) return s;
var m = s.split('.');
return m.length === 4 ? m[0] + '.' + m[1] + '.*.*' : s;
};

var REGION_CN = { Beijing: '北京', Tianjin: '天津', Hebei: '河北', Shanxi: '山西', 'Inner Mongolia': '内蒙古', Liaoning: '辽宁', Jilin: '吉林', Heilongjiang: '黑龙江', Shanghai: '上海', Jiangsu: '江苏', Zhejiang: '浙江', Anhui: '安徽', Fujian: '福建', Jiangxi: '江西', Shandong: '山东', Henan: '河南', Hubei: '湖北', Hunan: '湖南', Guangdong: '广东', Guangxi: '广西', Hainan: '海南', Chongqing: '重庆', Sichuan: '四川', Guizhou: '贵州', Yunnan: '云南', Tibet: '西藏', Shaanxi: '陕西', Gansu: '甘肃', Qinghai: '青海', Ningxia: '宁夏', Xinjiang: '新疆', 'Hong Kong': '中国香港', Macau: '中国澳门', Taiwan: '中国台湾' };
var regionLabel = function (r) { return REGION_CN[r] || ''; };
var WHAT = { view: '浏览资源', contact: '咨询客服', resource_unlock: '查看内容', bind: '资源解锁', login: '设备登录', audit: '系统操作', ann_read: '公告阅读' };

function sysAlertEntry() {
try {
var a = JSON.parse(localStorage.getItem('wnzyq_syscheck_alert') || 'null');
if (!a || !a.n) return '';
return '<div id="ctSysAlert" style="margin:0 0 10px;padding:9px 11px;background:#fff6e8;border:1px solid #f0c896;border-radius:10px;display:flex;align-items:center;gap:8px;font-size:12px">' +
'<span style="flex:1;color:#8a5a00;line-height:1.6"><b>⚠ 系统体检发现 ' + a.n + ' 个问题</b><br><span style="font-size:11px;color:#a07b2a">可能含失效图片 / 失效外链 / 超大图片 / 环境异常</span></span>' +
'<button type="button" class="btn-blue btn-inline-pd" id="ctSysAlertGo" style="flex:none">去查看</button></div>';
} catch (e) { return ''; }
}
function bindSysAlertGo() {
var go = document.getElementById('ctSysAlertGo');
if (!go || go.dataset.bound) return;
go.dataset.bound = '1';
go.addEventListener('click', function () {
try { localStorage.removeItem('wnzyq_syscheck_alert'); } catch (e) {}
mask.classList.remove('open');
if (dot) dot.hidden = true;
var tab = document.querySelector('.tab[data-tab="settings"]');
if (tab) tab.click();
setTimeout(function () { var icb = document.getElementById('imgCheckBtn'); if (icb) icb.click(); }, 600);
});
}

function fmtNum(n) { return n > 999 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n); }
function render(d) {

var _m = window.__motion;
function setDelta(id, n) {
var el = document.getElementById(id);
if (!el) return;
if (_m && n <= 999) _m.countUp(el, n, { prefix: '+', dur: 700 });
else el.textContent = '+' + fmtNum(n);
}
setDelta('ctDBind', d.delta.bind);
setDelta('ctDContact', d.delta.contact);
setDelta('ctDUnlock', d.delta.unlock);
setDelta('ctDView', d.delta.view);

var _now = new Date();
var _hhmm = ('0' + _now.getHours()).slice(-2) + ':' + ('0' + _now.getMinutes()).slice(-2);
document.getElementById('ctSince').textContent = '数据截至 ' + _hhmm + '（每次打开自动同步）· 上方四格 = 较上次查看（' + fmtTime(d.lastSeen) + '）新增 ·「今日概览」= 今天 0 点起 · 下方明细 = 最近 24 小时（带蓝点的是上次查看后新增）';
document.getElementById('ctToday').textContent = '今日概览：访问 ' + d.today.view + ' · 咨询 ' + d.today.contact + ' · 查看内容 ' + d.today.unlock + ' · 绑定 ' + d.today.bind;
var list = document.getElementById('ctList');
var _alert = sysAlertEntry();

var _oldAlert = document.getElementById('ctSysAlert');
if (_oldAlert) _oldAlert.remove();
if (_alert) { list.insertAdjacentHTML('beforebegin', _alert); _alert = ''; }

var filterBar = document.getElementById('ctFilterBar');
if (!filterBar) {
filterBar = document.createElement('div');
filterBar.id = 'ctFilterBar';
filterBar.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 8px';
filterBar.__adjustCols = function () { var whoEmpty = !(window.__ctWhoOpts && Object.keys(window.__ctWhoOpts).length > 1); this.style.gridTemplateColumns = whoEmpty ? '1fr' : '1fr 1fr'; var w = this.querySelector('#ctWhoSel'); if (w) w.closest('div').style.display = whoEmpty ? 'none' : ''; };
filterBar.innerHTML = '<div style="min-width:0"><select id="ctWhoSel" style="width:100%;box-sizing:border-box;font-size:12px;padding:4px 6px;border:1px solid #dfe7ef;border-radius:6px"></select></div><div style="min-width:0"><select id="ctTypeSel" style="width:100%;box-sizing:border-box;font-size:12px;padding:4px 6px;border:1px solid #dfe7ef;border-radius:6px"></select></div>';
list.parentNode.insertBefore(filterBar, list);
var TYPE_OPTS = [['', '全部类型'], ['view', '浏览资源'], ['contact', '咨询客服'], ['resource_unlock', '查看内容'], ['bind', '资源解锁'], ['login', '设备登录'], ['audit', '系统操作']];
var tSel0 = filterBar.querySelector('#ctTypeSel');
tSel0.innerHTML = TYPE_OPTS.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
tSel0.value = window.__ctType || '';
tSel0.addEventListener('change', function () {
window.__ctType = this.value;
var d3 = window.__lastInfo; if (d3) render(d3);
});
filterBar.querySelector('#ctWhoSel').addEventListener('change', function () {
window.__ctWho = this.value;
fetchInfo(function (d2) { render(d2); }, window.__ctWho || undefined);
});
try { if (typeof makeSelectPicker === 'function') { makeSelectPicker(filterBar.querySelector('#ctWhoSel')); makeSelectPicker(filterBar.querySelector('#ctTypeSel')); } } catch (eM) {}
}

var _whoOpts = { '': '全部动态' };
(d.__ctRaw || d.recent || []).forEach(function (r) { if (r.type === 'audit' && r.who && r.who !== 'admin') _whoOpts[r.who] = 1; });
var _whoSel = filterBar.querySelector('#ctWhoSel');
window.__ctWhoOpts = _whoOpts;
try { filterBar.__adjustCols(); } catch (eAC) {}

var _curWho = _whoSel.value;
_whoSel.innerHTML = Object.keys(_whoOpts).map(function (w) { return '<option value="' + w + '">' + (w || '全部动态') + '</option>'; }).join('');
_whoSel.value = (_curWho && _whoOpts[_curWho]) ? _curWho : '';
try {
if (typeof makeSelectPicker === 'function') { var _rw = makeSelectPicker(_whoSel); if (_rw && _rw.refresh) _rw.refresh(); }
else if (typeof syncSelectDisplay === 'function') syncSelectDisplay(_whoSel);
} catch (eW) { if (window.__silent) window.__silent(eW); }
var _tSel = filterBar.querySelector('#ctTypeSel');
if (_tSel && _tSel.dataset.sp) { try { if (typeof syncSelectDisplay === 'function') syncSelectDisplay(_tSel); } catch (eS2) {} }

if (!d.__ctRaw) d.__ctRaw = (d.recent || []).slice();
var _recentAll = d.__ctRaw;
d.recent = window.__ctType ? _recentAll.filter(function (r) { return r.type === window.__ctType; }) : _recentAll;
window.__lastInfo = d;
if (!(d.recent || []).length) {

var _allZero = !(d.delta && (d.delta.view || d.delta.contact || d.delta.unlock || d.delta.bind));
list.innerHTML = _alert + window.__adminEmpty('最近 24 小时暂无动态',
_allZero ? '说明：您自己在前台资源页的浏览/解锁不计入统计（管理身份自动排除）；数字只来自真实访客。' : '');
bindSysAlertGo();
return;
}
var html = d.recent.map(function (r, ri) {
var tp = fmtTime(r.at).split(' ');
var rl = regionLabel(r.region);
var who = maskIP(r.who);
var target = r.title + (r.extra ? ' · ' + r.extra : '');

var _d = ' style="--casc-d:' + (Math.min(ri, 12) * 40) + 'ms"';

return '<div class="ct-row wn-tl' + (r.unread ? ' ct-unread' : '') + '"' + _d + '>' + (r.unread ? '<span class="ct-dot" aria-label="未读"></span>' : '') + '<span class="ct-time"><i>' + tp[0] + '</i><i>' + (tp[1] || '') + '</i></span><span class="ct-who">' +
(rl ? rl + ' ' : '') + String(who).replace(/</g, '&lt;') + '</span><span class="ct-what">' + (WHAT[r.type] || r.type) +
'</span><span class="ct-target">' + String(target).replace(/</g, '&lt;') + '</span></div>';
}).join('');
list.innerHTML = _alert + html;
bindSysAlertGo();
}
function fetchInfo(cb, who) {
var last = '';
try { last = localStorage.getItem(LS_KEY) || ''; } catch (e) { if (window.__silent) window.__silent(e); }
var qs = [];
if (last) qs.push('last=' + encodeURIComponent(last));
if (who) qs.push('who=' + encodeURIComponent(who));
api('admin/info' + (qs.length ? '?' + qs.join('&') : ''), { method: 'GET' }).then(function (res) {
if (res && res.ok) cb(res);
}).catch(function () { if (window.__silent) window.__silent(new Error('info')); });
}

function markSeen() {
try { localStorage.setItem(LS_KEY, new Date().toISOString().slice(0, 19).replace('T', ' ')); } catch (e) { if (window.__silent) window.__silent(e); }

var _al = false;
try { var a = JSON.parse(localStorage.getItem('wnzyq_syscheck_alert') || 'null'); _al = !!(a && a.n); } catch (e) {}
if (dot) dot.hidden = !_al;
}

function checkDot() {
var mv = document.getElementById('mainView');
if (!mv || getComputedStyle(mv).display === 'none') { setTimeout(checkDot, 1200); return; }
fetchInfo(function (d) {
var _al = false;
try { var a = JSON.parse(localStorage.getItem('wnzyq_syscheck_alert') || 'null'); _al = !!(a && a.n); } catch (e) {}

var _unread = (d.recent || []).filter(function (r) { return r && r.unread; }).length;
if (dot) dot.hidden = !(_unread > 0 || _al);
});
}
window.__syscheckAlertChanged = function () { checkDot(); };
setTimeout(checkDot, 1500);

setInterval(function () { try { checkDot(); } catch (e) {} }, 60000);
try { window.addEventListener('focus', function () { try { checkDot(); } catch (e) {} }); } catch (e) {}
if (btn) btn.addEventListener('click', function () {
mask.classList.add('open');
if (window.__haptic) window.__haptic();

var _list0 = document.getElementById('ctList');
if (_list0) _list0.innerHTML = '<div class="sk-line" style="height:34px;border-radius:8px;margin-bottom:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' +
'<div class="sk-line" style="height:34px;border-radius:8px;margin-bottom:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>' +
'<div class="sk-line" style="height:34px;border-radius:8px;background:linear-gradient(90deg,var(--bg-light,#f5f7fa) 55%,var(--sk-hi,#e8eaef) 75%,var(--bg-light,#f5f7fa) 95%);background-size:200% 100%;animation:skShimmer 1.6s linear infinite"></div>';
fetchInfo(function (d) { render(d); }, window.__ctWho || undefined);
});
var fold = document.getElementById('ctFold');
var item = document.getElementById('ctDetailItem');
if (fold && item) fold.addEventListener('click', function () {
var willOpen = !item.classList.contains('open');
item.classList.toggle('open', willOpen);
fold.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
if (window.__haptic) window.__haptic();
});
var go = document.getElementById('ctGoStats');
if (go) go.addEventListener('click', function () {
markSeen();
mask.classList.remove('open');
var t = document.querySelector('.tab[data-tab="stats"]');
if (t) t.click();
});
var close = document.getElementById('ctClose');
if (close) close.addEventListener('click', function () { markSeen(); mask.classList.remove('open'); });
mask.addEventListener('click', function (e) { if (e.target === mask) { markSeen(); mask.classList.remove('open'); } });
})();
