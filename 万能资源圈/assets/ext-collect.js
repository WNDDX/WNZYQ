/* ===== v490 资源采集（老板逐条要求重做）=====
 入口：平台设置 →「资源采集」
 1) 术语统一叫「资源」（老板口径：平台里一律叫资源）
 2) 弹窗结构与系统其他弹窗一致（modal-box + modal-title + form + modal-footer），底部不再放关闭键
 3) 编辑器复用系统那一套（克隆运行时工具条，保留「字体 ▸」自制下拉外观，并补上事件）
 4) 上架 = 关掉本弹窗 + 打开系统的「新增资源」弹窗，标题/封面/详情已填好，你补分类和价格
 5) 去掉导入
 6) 采集抓不到时给准确原因，并自动试同域的常见列表页 */
(function () {
 'use strict';

 var S = {
 platforms: [], goods: [], curPf: 0, tab: 'goods', sel: {},
 mask: null, busy: false, hint: '',
 /* v540：老板要求所有长列表一页 20 条 */
 q: '', status: '', page: 1, pageSize: (window.LIST_PAGE_SIZE || 20),
 pfPage: 1, runsPage: 1,
 runs: [], cats: []
 };

 /* v545：同上，复用全站唯一转义实现，删掉本文件那份 */
 var esc = window.escapeHtml || function (s) {
 return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
 };
 function api(path, opt) {
 opt = opt || {};
 var o = { method: opt.method || 'GET', credentials: 'same-origin', headers: {} };
 if (opt.body != null) {
 var body = opt.body;
 if (o.method === 'POST' && body && typeof body === 'object' && !body.reqId) {
 body.reqId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
 }
 o.headers['Content-Type'] = 'application/json';
 o.body = JSON.stringify(body);
 }
 return fetch('/api/' + path, o)
 .then(function (r) { return r.json().catch(function () { return { ok: false, msg: '服务返回异常（HTTP ' + r.status + '），请重试' }; }); })
 .catch(function () { return { ok: false, msg: '网络超时或中断，请重试' }; });
 }
 function toast(m, t) { if (window.showToast) window.showToast(m, t || 'info'); }
 /* v534：库里时间一律 UTC，界面统一北京时间（与数据统计/操作日志同口径，固定 +8） */
 function bjShort(v) {
 var s = String(v == null ? '' : v); if (!s) return '';
 var d = new Date(s.replace(' ', 'T') + 'Z');
 if (isNaN(d.getTime())) return s.slice(5, 16);
 return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ');
 }
 /* v501：下拉一律用系统的自制下拉（.select-picker）——
 老板原话「比如下拉选择的组件，都不会复用吗，现在你又新做了，要复用啊」。
 makeSelectPicker 是 admin-edit.js 的全局函数：会插显示层、隐藏原生 select，并返回 {refresh}。 */
 function bindSelects(root) {
 if (!root) return;
 /* v518：走系统唯一入口（admin-3 暴露的 __upgradeSelects，幂等）；
 升级完再把每个 select 的显示层刷一次，保证程序化改值后显示框不会停在旧文字。 */
 try { if (window.__upgradeSelects) window.__upgradeSelects(root); } catch (e0) {}
 Array.prototype.forEach.call(root.querySelectorAll('select'), function (sel) {
 try { if (window.__syncSelectDisplay) window.__syncSelectDisplay(sel); } catch (e1) {}
 });
 }

 /* v496：空态统一走系统唯一源 __adminEmpty（插画 + 标题 + 说明），不再自写一行灰字 */
 function empty(title, hint) {
 if (window.__adminEmpty) return window.__adminEmpty(title, hint);
 return '<div class="extc-empty">' + esc(title) + (hint ? '<br>' + esc(hint) : '') + '</div>';
 }
 function selIds() { return Object.keys(S.sel).filter(function (k) { return S.sel[k]; }).map(Number); }
 function nowStr() {
 var d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; };
 return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
 }

 /* ================= 编辑器：复用系统那一套 =================
 克隆运行时已经渲染好的工具条（含「字体 ▸」这种自制下拉），再补两件事：
 ① bindRteBar 把格式按钮的事件挂上（系统那份只认 #detailRteToolbar，克隆的没有）
 ② bindPicker 让克隆的自制下拉能展开、能选 —— 选项事件同样不会被 cloneNode 复制 */
 function mountRte(host, editorId, initialHtml, minH) {
 if (!host) return null;
 var srcBar = document.getElementById('detailRteToolbar');
 if (!srcBar) {
 host.innerHTML = '<div class="rte-editor" id="' + editorId + '" contenteditable="true">' + (initialHtml || '') + '</div>';
 return host.querySelector('#' + editorId);
 }
 var bar = srcBar.cloneNode(true);
 bar.removeAttribute('id');
 /* v501：保留系统默认的 rte-collapsed（单行横滚 + 三角展开）——之前这里把收起类摘了，
 工具条永远多行、三角点了只剩「收起」，老板问「这三角到底干什么的」。现在和系统完全同款。 */
 bar.classList.remove('rte-toolbar-large');
 bar.classList.add('rte-toolbar');
 bar.setAttribute('data-editor', editorId);
 Array.prototype.forEach.call(bar.querySelectorAll('[data-editor]'), function (el) { el.setAttribute('data-editor', editorId); });
 Array.prototype.forEach.call(bar.querySelectorAll('[data-target]'), function (el) { el.setAttribute('data-target', editorId); });

 var ed = document.createElement('div');
 ed.className = 'rte-editor';
 ed.id = editorId;
 ed.contentEditable = 'true';
 ed.setAttribute('data-rte-host', '1');
 if (minH) ed.style.minHeight = minH;
 ed.innerHTML = initialHtml || '';
 host.innerHTML = '';
 host.appendChild(bar);
 host.appendChild(ed);

 try { if (window.__bindRteBar) window.__bindRteBar(bar, ed); } catch (eB) { if (window.__silent) window.__silent(eB); }
 bindPicker(bar, ed);
 return ed;
 }

 /* 克隆过来的自制下拉：显示层点开、选项点了要回写到 select 并派发 change */
 function bindPicker(bar, editor) {
 Array.prototype.forEach.call(bar.querySelectorAll('.select-picker'), function (pk) {
 /* v491：系统的结构是「holder(.select-picker) 插在原生 select 前面，select 留在原位并 display:none」
 —— select 是 holder 的**兄弟**，不在里面。上一版在容器内找 select 找不到就直接 return，
 于是字体/字号点开毫无反应。这里改成：先找自己，再找下一个兄弟，最后在父级里找。 */
 var sel = pk.querySelector('select');
 if (!sel) {
 var nx = pk.nextElementSibling;
 if (nx && nx.tagName === 'SELECT') sel = nx;
 else if (pk.parentNode) sel = pk.parentNode.querySelector('select');
 }
 var disp = pk.querySelector('.cat-picker-display');
 if (!sel || !disp) return;

 /* 面板自己重建并自己定位：系统的面板是丢到页面上的浮层，克隆带不过来，
 而且位置依赖它自己的算法。这里做成相对 holder 的绝对定位，样式沿用系统的 .cp-item。 */
 var panel = pk.querySelector('.cat-picker-panel');
 if (!panel) {
 panel = document.createElement('div');
 panel.className = 'cat-picker-panel';
 pk.appendChild(panel);
 }
 try { pk.style.position = 'relative'; } catch (e0) {}
 panel.style.cssText = 'position:absolute;left:0;top:100%;margin-top:4px;min-width:100%;width:auto;' +
 'max-height:220px;overflow-y:auto;z-index:60;display:none;background:var(--card-bg,#fff);' +
 'border:1px solid var(--border,#e3e9ef);border-radius:10px;box-shadow:0 8px 22px rgba(15,35,60,.14);padding:4px;';

 var txt = disp.querySelector('.cpd-text') || disp;
 panel.innerHTML = Array.prototype.map.call(sel.options, function (o) {
 return '<div class="cp-item" data-v="' + esc(o.value) + '">' + esc(o.textContent) + '</div>';
 }).join('');
 var cur = sel.options[sel.selectedIndex] || sel.options[0];
 if (cur) txt.textContent = cur.textContent;

 disp.addEventListener('click', function (e) {
 e.preventDefault(); e.stopPropagation();
 var willOpen = panel.style.display === 'none';
 /* 先把别的面板关掉 */
 Array.prototype.forEach.call(bar.querySelectorAll('.cat-picker-panel'), function (p2) {
 if (p2 !== panel) p2.style.display = 'none';
 });
 panel.style.display = willOpen ? 'block' : 'none';
 pk.classList.toggle('open', willOpen);
 });
 panel.addEventListener('click', function (e) {
 var it = e.target.closest ? e.target.closest('.cp-item') : null;
 if (!it) return;
 e.preventDefault(); e.stopPropagation();
 sel.value = it.getAttribute('data-v');
 txt.textContent = it.textContent;
 txt.classList.toggle('placeholder', !sel.value);
 panel.style.display = 'none';
 pk.classList.remove('open');
 try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
 try { if (editor) editor.focus({ preventScroll: true }); } catch (e3) {}
 });
 });
 /* 点别处收起面板 */
 setTimeout(function () {
 document.addEventListener('click', function (ev) {
 if (ev.target.closest && ev.target.closest('.select-picker')) return;
 Array.prototype.forEach.call(bar.querySelectorAll('.cat-picker-panel'), function (p) { p.style.display = 'none'; });
 Array.prototype.forEach.call(bar.querySelectorAll('.select-picker.open'), function (p) { p.classList.remove('open'); });
 });
 }, 0);
 }

 /* ================= 主弹窗 ================= */
 function open() {
 if (S.mask) close();
 S.cats = (window.state && window.state.categories) || [];
 var m = document.createElement('div');
 m.className = 'modal-mask'; m.id = 'extcMask';
 m.innerHTML = '<div class="modal-box extc-box" role="dialog" aria-modal="true">' +
 '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
 '<h2 class="modal-title">资源采集</h2>' +
 '<div class="extc-bar">' +
 '<select id="extcPf" class="extc-sel-input"></select>' +
 '<button type="button" class="btn-blue btn-inline" id="extcOpenPf" title="打开这个平台">打开平台</button>' +
 '<button type="button" class="btn-blue btn-inline" id="extcRun" title="按商城地址抓一批">采集</button>' +
 '<button type="button" class="btn-blue btn-inline" id="extcPaste" title="粘一条链接，或粘整页内容">粘贴</button>' +
 '<span class="extc-hint" id="extcHint"></span>' +
 '</div>' +
 '<div class="extc-tabs">' +
 '<button type="button" class="extc-tab on" data-tab="goods">采集到的资源 <i id="extcNGoods">0</i></button>' +
 '<button type="button" class="extc-tab" data-tab="pf">我的平台 <i id="extcNPf">0</i></button>' +
 '<button type="button" class="extc-tab" data-tab="runs">采集记录 <i id="extcNRuns2">0</i></button>' + /* v537（老板）：把合并掉的采集记录页签恢复回来 */

 '<button type="button" class="row-btn extc-addpf" id="extcAddPf" title="添加一个平台档案">添加平台</button>' +
 '</div>' +
 '<div class="batch-bar extc-batch" id="extcBatch"></div>' +
 '<div class="extc-body" id="extcBody"><div class="extc-loading">正在读取平台和已采集的资源</div></div>' +
 '</div>';
 document.body.appendChild(m);
 S.mask = m;
 requestAnimationFrame(function () { m.classList.add('open'); });
 bindSelects(m);
 if (window.syncBodyLock) window.syncBodyLock();

 m.addEventListener('click', function (e) {
 if (e.target === m || (e.target.closest && e.target.closest('[data-x]'))) close();
 });
 m.querySelector('#extcPf').addEventListener('change', function () {
 S.curPf = Number(this.value) || 0;
 S.sel = {}; S.page = 1; S.pfPage = 1; S.runsPage = 1;
 loadGoods();
 });
 m.querySelector('#extcOpenPf').addEventListener('click', openPlatform);
 m.querySelector('#extcRun').addEventListener('click', runCollect);
 m.querySelector('#extcPaste').addEventListener('click', pasteForm);
 m.querySelector('#extcAddPf').addEventListener('click', function () { platformForm(null); });
 Array.prototype.forEach.call(m.querySelectorAll('.extc-tab'), function (b) {
 b.addEventListener('click', function () {
 S.tab = b.getAttribute('data-tab');
 Array.prototype.forEach.call(m.querySelectorAll('.extc-tab'), function (x) { x.classList.toggle('on', x === b); });
 render();
 });
 });
 m.querySelector('#extcBody').addEventListener('click', onBodyClick);
 /* v588（实测真因）：批量条 #extcBatch 是 #extcBody 的**兄弟节点**，不在 body 里，
 挂在 body 上的 onBodyClick 永远收不到它的点击——「选中本页／批量删除／清未上架」全是死键。
 这里给批量条也挂同一套委托（按钮每次 updateBatch 会整体重绘，挂在容器上才不会被换掉）。 */
 m.querySelector('#extcBatch').addEventListener('click', onBodyClick);
 m.querySelector('#extcBody').addEventListener('input', onBodyInput);
 m.querySelector('#extcBody').addEventListener('change', onBodyInput);
 loadAll();
 }

 function close() {
 if (!S.mask) return;
 var m = S.mask;
 m.classList.remove('open');
 S.mask = null;
 setTimeout(function () { m.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180);
 }

 /* ================= 取数 ================= */
 function loadAll() {
 return Promise.all([
 api('admin/external').catch(function () { return { ok: false }; }),
 api('admin/external', { method: 'POST', body: { op: 'goods.list' } }).catch(function () { return { ok: false }; })
 ]).then(function (r) {
 if (r[0] && r[0].ok) {
 S.platforms = r[0].platforms || [];
 S.me = r[0].me || null;
 if (!S.platforms.length) S.hint = '先点右上「+ 添加平台」，填平台名和商城地址';
 else if (S.curPf && !S.platforms.some(function (p) { return Number(p.id) === Number(S.curPf); })) S.curPf = 0;
 }
 if (r[1] && r[1].ok) S.goods = r[1].goods || [];
 render();
 });
 }
 function loadGoods() {
 return api('admin/external', { method: 'POST', body: { op: 'goods.list' } }).then(function (r) {
 if (r && r.ok) S.goods = r.goods || [];
 render();
 });
 }

 function filtered() {
 var q = S.q.trim().toLowerCase();
 return S.goods.filter(function (g) {
 if (S.curPf && Number(g.platform_id) !== Number(S.curPf)) return false;
 if (S.status === 'new' && g.status === 'used') return false;
 if (S.status === 'used' && g.status !== 'used') return false;
 if (q) {
 var hay = (g.title || '') + ' ' + (g.platform || '') + ' ' + (g.src_url || '');
 if (hay.toLowerCase().indexOf(q) < 0) return false;
 }
 return true;
 });
 }

 /* ================= 渲染 ================= */
 function render() {
 if (!S.mask) return;
 var m = S.mask;
 var pfSel = m.querySelector('#extcPf');
 if (pfSel) {
 pfSel.innerHTML = '<option value="0">全部平台</option>' + S.platforms.map(function (p) {
 return '<option value="' + p.id + '">' + esc(p.name) + '</option>';
 }).join('');
 pfSel.value = String(S.curPf);
 }
 /* v546r（实测）：采集完列表已经 19 张卡，页签却一直写着 0。
 真因：页签按钮会被全站「图标+文字」机制包一层 .btn-lab，原来的 <i id="extcNGoods">
 在那一刻被丢掉，之后 render 就找不到计数元素、静默不更新。
 现在有 <i> 就改 <i>，没有（已被包装）就直接改页签文字里的数字。 */
 var __setTab = function (tab, label, n) {
 var btn = m.querySelector('.extc-tab[data-tab="' + tab + '"]');
 if (!btn) return;
 var i = btn.querySelector('i');
 if (i) { i.textContent = n; return; }
 var lab = btn.querySelector('.btn-lab');
 if (lab) lab.textContent = label + ' ' + n;
 else btn.textContent = label + ' ' + n;
 };
 __setTab('goods', '采集到的资源', S.goods.length);
 __setTab('pf', '我的平台', S.platforms.length);
 __setTab('runs', '采集记录', S.runs.length);
 var nR = m.querySelector('#extcNRuns'); if (nR) nR.textContent = S.runs.length;
 var hint = m.querySelector('#extcHint');
 if (hint) { hint.textContent = S.hint || ''; hint.title = S.hint || ''; }

 var body = m.querySelector('#extcBody');
 if (S.tab === 'goods') body.innerHTML = renderGoods();
 else if (S.tab === 'runs') body.innerHTML = renderRuns();
 else body.innerHTML = renderPlatforms();
 /* v587 用户 11-09（硬核项）：采集列表真正懒加载——
 原来 67 条采集记录一打开就把 67 张原图（单张 887KB）全拉一遍，列表空白好几秒。
 现在图先挂在 data-src 上，只有滚到视口附近（提前 200px）才设 src 去请求。
 首屏通常只请求 6~9 张，剩下的滚到才加载。后台工具不需要"整页全加载"那套口径。 */
 (function bindLazyThumbs() {
 var imgs = [].slice.call(document.querySelectorAll('#extcBody .extc-thumb img[data-src]'));
 if (!imgs.length) return;
 if (!('IntersectionObserver' in window)) {
 imgs.forEach(function (i) { i.src = i.getAttribute('data-src'); i.removeAttribute('data-src'); });
 return;
 }
 if (window.__extcThumbIO) { try { window.__extcThumbIO.disconnect(); } catch (eIO) {} }
 window.__extcThumbIO = new IntersectionObserver(function (entries) {
 entries.forEach(function (en) {
 if (!en.isIntersecting) return;
 var i = en.target;
 var u = i.getAttribute('data-src');
 if (u) { i.src = u; i.removeAttribute('data-src'); }
 try { window.__extcThumbIO.unobserve(i); } catch (eU) {}
 });
 }, { root: null, rootMargin: '200px 0px', threshold: 0.01 });
 imgs.forEach(function (i) { window.__extcThumbIO.observe(i); });
 })();

 bindSelects(body); /* v501：新渲染出来的下拉就地升级成系统控件 */
 bindSelects(m); /* 平台下拉的选中项也要跟着刷新 */
 /* v512：翻页用全站公共组件（带页码跳转），选中态用系统批量条 */
 /* v540：采集记录 / 平台两页也接上同一枚翻页条 */
 var _rp = body.querySelector('#extcRunsPager');
 if (_rp && window.buildUniPager) {
 window.buildUniPager(_rp, {
 page: S.runsPage, totalPages: Math.max(1, Math.ceil(S.runs.length / (window.LIST_PAGE_SIZE || 20))), total: S.runs.length, unit: '条',
 onPage: function (p3) { S.runsPage = p3; render(); }
 });
 }
 var _pp = body.querySelector('#extcPfPager');
 if (_pp && window.buildUniPager) {
 window.buildUniPager(_pp, {
 page: S.pfPage, totalPages: Math.max(1, Math.ceil(S.platforms.length / (window.LIST_PAGE_SIZE || 20))), total: S.platforms.length, unit: '个',
 onPage: function (p4) { S.pfPage = p4; render(); }
 });
 }
 var pagerEl = body.querySelector('#extcPager');
 if (pagerEl && window.buildUniPager) {
 var _t = filtered().length;
 window.buildUniPager(pagerEl, {
 page: S.page, totalPages: Math.max(1, Math.ceil(_t / S.pageSize)), total: _t, unit: '个',
 onPage: function (p2) { S.page = p2; render(); }
 });
 }
 updateBatch();
 }

 /* v494：把「选中本页/清空/批量上架」并进搜索那一行——原来单独占一行、右边一片空，看着松散 */
 /* v512：选中后的操作改用系统资源管理那套「顶部滑下批量条」（.batch-bar + __setBatchBar），
 不再是搜索行里挤几个小按钮。 */
 function updateBatch() {
 if (!S.mask) return;
 var bar = S.mask.querySelector('#extcBatch');
 if (!bar) return;
 var n = selIds().length;
 bar.innerHTML = '已选 <span class="batch-count">' + n + '</span> 个' +
 '<div class="batch-group">' +
 /* v587 用户 11-08（第 2 条「资源采集批量按键失效」）：这几个键原来带 data-pri 进了自适应体系，
 而 batchuse 的优先级最低（5），一旦这一行放不下就先把它收成纯图标——用户看到的就是「按钮没了」。
 批量条空间本来就够（只有 4 个键），不需要靠收缩省地方，统一 data-noico 让它永远显示文字。 */
 '<button type="button" class="batch-btn" data-act="batchuse" data-noico="1">上架选中</button>' +
 '<button type="button" class="batch-btn" data-act="selpage" data-noico="1">选中本页</button>' +
 '<button type="button" class="batch-btn danger" data-act="delbatch" data-noico="1">批量删除</button>' +
 /* v587 用户 11-09（第 7 条）：采集库只增不减——抓几次就几十上百条，重复的、没上架的堆在一起。
 加一个「清理未上架」：只删没上架过的，已上架的（线上有对应资源）一条都不动。 */
 '<button type="button" class="batch-btn" data-act="delunused" data-noico="1">清未上架</button>' +
 '<button type="button" class="batch-btn" data-act="selnone" data-noico="1">取消选中</button>' +
 '</div>';
 /* v512：按键统一走系统的「图标 + 文字，窄了自动收成图标」（__decorateBtn + __btnFit），
 和资源管理批量条同一套；不是自己画一排纯文字键 */
 try {
 /* v587：不再给批量条加图标——加了宽度多 20px，反而更容易挤；批量条纯文字最清楚 */
 
 } catch (eI) {}
 if (window.__setBatchBar) window.__setBatchBar(bar, n > 0);
 else bar.classList.toggle('show', n > 0);
 try { if (window.__btnFit) window.__btnFit(); } catch (eF) {}
 }
 function refreshSelUI() {
 if (!S.mask) return;
 var n = selIds().length;
 var cnt = S.mask.querySelector('.extc-cnt');
 if (cnt) cnt.innerHTML = filtered().length + ' 个' + (n ? '，已选 <b>' + n + '</b>' : '');
 updateBatch();
 }

 function renderGoods() {
 var list = filtered();
 if (!S.goods.length) {
 return empty('该列表暂无采集到的资源', '选一个平台点「采集」一次抓一批；抓不到的点「粘贴」，粘链接或整页内容一条条加');
 }
 /* v509：有数据但被搜索/状态筛空时，原来是整片空白（老板看到只会以为坏了） */
 if (!list.length) {
 return empty('没有符合条件的资源', '换个平台、清掉搜索词或把状态切回「全部」再试');
 }
 var n = selIds().length;
 var cur = S.platforms.filter(function (p) { return Number(p.id) === Number(S.curPf); })[0];
 /* v587 用户 11-08（第 14 条）：平台说明加三角展开收起，默认收起。
 三角复用全站 .toggle-arrow（收起朝右、展开朝下、同一档过渡），内容高度用真实 scrollHeight。 */
 var pfNote = cur && cur.note
 ? '<div class="extc-pfnote">'
 + '<div class="extc-pfnote-hd">'
 + '<b>' + esc(cur.name) + ' 的说明</b>'
 + '<button type="button" class="extc-note-fold" aria-expanded="false" aria-label="展开平台说明">'
 + '<svg class="toggle-arrow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>'
 + '</button>'
 + '</div>'
 + '<div class="extc-pfnote-b">' + cur.note + '</div>'
 + '</div>'
 : '';

 var head = '<div class="extc-tools">' +
 '<input id="extcQ" class="input extc-search" type="search" autocomplete="off" placeholder="搜索标题、平台或链接" value="' + esc(S.q) + '">' +
 '<select id="extcSt" class="extc-sel-input">' +
 '<option value="">全部状态</option>' +
 '<option value="new"' + (S.status === 'new' ? ' selected' : '') + '>未上架</option>' +
 '<option value="used"' + (S.status === 'used' ? ' selected' : '') + '>已上架</option>' +
 '</select>' +
 '<span class="extc-cnt">' + list.length + ' 个' + (n ? '，已选 <b>' + n + '</b>' : '') + '</span>' +
 '</div>';

 var total = list.length;
 var pages = Math.max(1, Math.ceil(total / S.pageSize));
 if (S.page > pages) S.page = pages;
 var slice = list.slice((S.page - 1) * S.pageSize, S.page * S.pageSize);

 var cards = slice.map(function (g) {
 var on = !!S.sel[g.id];
 var used = g.status === 'used';
 return '<div class="extc-card' + (on ? ' on' : '') + (used ? ' is-used' : '') + '" data-id="' + g.id + '">' +
 '<div class="extc-thumb" data-act="pick">' +
 (g.cover ? '<img data-src="' + esc('/api/img-proxy?u=' + encodeURIComponent(g.cover)) + '" alt="' + esc(g.title || '资源封面') + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add(\'noimg\');this.remove()">' : '<span class="extc-noimg">无图</span>') +
 (used ? '<span class="extc-used">已上架</span>' : '') +
 '<span class="extc-ck">' + (on ? '✓' : '') + '</span>' +
 '</div>' +
 '<div class="extc-t" title="' + esc(g.title) + '">' + esc(g.title) + '</div>' +
 /* v587（第 9 条）：连续两次采不到 → 标「对方已下架」。只是提示，不删数据；
 如果平台开了自动隐藏，对应的已上架资源也被藏起来了，这里一并说明。 */
 /* v608（老板 11-12 第 5 条）：判定太激进——注释写的是「连续两次采不到」，代码却 >=1，
 即一次网络抖动/对方风控就标成「对方已下架」，整列表都是红字。改成真的两次。 */
 (Number(g.missing || 0) >= 2
 ? '<div class="extc-gone">⚠ 对方已下架' + (Number(g.auto_hidden) ? '（本店已自动隐藏）' : '') + '</div>'
 : '') +
 '<div class="extc-m">' + esc(g.platform || '未归平台') + '</div>' +
 '<div class="extc-ops">' +
 '<button type="button" class="row-btn primary" data-act="use">' + (used ? '再上架' : '上架') + '</button>' +
 '<button type="button" class="row-btn" data-act="edit">编辑</button>' +
 '<button type="button" class="row-btn" data-act="see">查看</button>' +
 '<button type="button" class="row-btn danger" data-act="del">删除</button>' +
 '</div></div>';
 }).join('');

 /* v512：翻页交给全站公共 .uni-pager（资源管理/数据统计同款，带页码跳转），不再自己画一对按钮 */
 var pager = '<div class="uni-pager" id="extcPager"></div>';

 return pfNote + head + '<div class="extc-grid">' + cards + '</div>' + pager;
 }

 /* v538（老板：失败只说一句原文，不知道该干嘛）——按原文归成三类，给出下一步动作 */
 function reasonOf(msg) {
 var m = String(msg || '');
 if (/登录|登入|未登录|密码|账号/.test(m)) return { k: 'login', t: '需要登录', tip: '点「打开」登录一次再采' };
 if (/404|不存在|下架|已删除|失效|找不到/.test(m)) return { k: 'dead', t: '地址失效', tip: '去「我的平台 → 编辑」换商城地址' };
 if (/频率|频繁|限流|too many|429|稍后/.test(m)) return { k: 'limit', t: '被限流', tip: '过半小时再采一次' };
 if (/超时|timeout|网络|fetch|EOF/.test(m)) return { k: 'net', t: '网络不稳', tip: '换个时间再试' };
 return { k: 'other', t: '没采到', tip: '点这一行「打开」看看对方页面还在不在' };
 }
 window.__extcReason = reasonOf;

 /* v537：采集记录列表——时间 / 平台 / 结果 / 说明，四列等分、超长省略 */
 function renderRuns() {
 if (!S.runs.length) {
 return empty('该列表暂无采集记录', '点上面的「采集」，或者等每天自动采过之后，这里会记下每次的时间和结果');
 }
 /* v540：一页 20 条 + 翻页 */
 var st = window.__slicePage(S.runs, S.runsPage, window.LIST_PAGE_SIZE || 20);
 S.runsPage = st.page;
 return '<div class="extc-runs">' + st.items.map(function (r) {
 return '<div class="log-row">' +
 '<span class="log-t">' + esc(String(r.at || '')) + '</span>' +
 '<span class="log-w" title="' + esc(r.name || '') + '">' + esc(r.name || '') + '</span>' +
 '<span class="log-a ' + (r.ok ? 'is-ok' : 'is-bad') + '">' + (r.ok ? '成功' : (reasonOf(r.msg).t)) + '</span>' +
 '<span class="log-g" title="' + esc(r.msg || '') + '">' + esc(r.ok ? (r.msg || '') : reasonOf(r.msg).tip) + '</span>' +
 '</div>';
 }).join('') + '</div>' + window.pagerBox('extcRunsPager');
 }

 function renderPlatforms() {
 if (!S.platforms.length) {
 return empty('该列表暂无平台', '点右上「+ 添加平台」，填平台名和商城地址（你在那边看资源列表的那一页）');
 }
 /* v540：平台一多也要翻页，一页 20 条 */
 var stp = window.__slicePage(S.platforms, S.pfPage, window.LIST_PAGE_SIZE || 20);
 S.pfPage = stp.page;
 var rows = stp.items.map(function (p) {
 var cnt = S.goods.filter(function (g) { return Number(g.platform_id) === Number(p.id); }).length;
 /* v530：原「采集记录」页签合并到这里——每个平台下面直接显示它自己的上次结果 */
 var last = S.runs.filter(function (x) { return Number(x.pid) === Number(p.id); })[0];
 var meta = [];
 meta.push('<i class="extc-auto">每天自动</i>'); /* v537：全部平台都自动采 */
 if (p.last_auto_at) meta.push('<span>上次自动：' + esc(bjShort(p.last_auto_at)) + '</span>');
 if (last) {
 var _rs = last.ok ? null : reasonOf(last.msg);
 meta.push('<span class="' + (last.ok ? 'is-ok' : 'is-bad') + '">上次手动：' + esc(String(last.at).slice(5, 16))
 + (_rs ? '，' + _rs.t + '（' + _rs.tip + '）' : '，' + esc(String(last.msg || '').slice(0, 46))) + '</span>');
 }
 return '<div class="extc-prow" data-pid="' + p.id + '">' +
 '<div class="extc-pmain"><b>' + esc(p.name) + ' <i class="extc-cnt">' + cnt + ' 个资源</i></b>' +
 '<span class="extc-plink">' + esc(p.mall_url || '（没填商城地址，采集不了）') + '</span>' +
 (meta.length ? '<span class="extc-pmeta">' + meta.join('') + '</span>' : '') +
 '</div>' +
 '<div class="extc-pops">' +
 '<button type="button" class="row-btn" data-act="runpf">采集</button>' +
 '<button type="button" class="row-btn" data-act="gopf">打开</button>' +
 '<button type="button" class="row-btn" data-act="editpf">编辑</button>' +
 '<button type="button" class="row-btn danger" data-act="delpf">删除</button>' +
 '</div></div>';
 }).join('');
 return '<div class="extc-plist">' + rows + '</div>' + window.pagerBox('extcPfPager');
 }

 /* ================= 交互 ================= */
 function onBodyClick(e) {
 var b = e.target.closest ? e.target.closest('[data-act]') : null;
 if (!b) return;
 var act = b.getAttribute('data-act');
 var card = b.closest('.extc-card');
 var id = card ? Number(card.getAttribute('data-id')) : 0;

 if (act === 'pick') {
 S.sel[id] = !S.sel[id];
 var on = !!S.sel[id];
 if (card) {
 card.classList.toggle('on', on);
 var ck = card.querySelector('.extc-ck');
 if (ck) ck.textContent = on ? '✓' : '';
 }
 refreshSelUI();
 return;
 }
 if (act === 'selpage') {
 filtered().slice((S.page - 1) * S.pageSize, S.page * S.pageSize).forEach(function (g) { S.sel[g.id] = true; });
 render(); return;
 }
 if (act === 'selnone') { S.sel = {}; render(); return; }
 if (act === 'prev') { S.page = Math.max(1, S.page - 1); render(); return; }
 if (act === 'next') { S.page = S.page + 1; render(); return; }
 if (act === 'use') { useGoods(id); return; }
 if (act === 'batchuse') { useBatch(selIds()); return; }
 if (act === 'edit') { editForm(id); return; }
 if (act === 'see') { seeForm(id); return; }
 if (act === 'del') {
 /* v521：换系统的确认框（原生 confirm 样式与全站不一致，且会打断浏览器） */
 if (!window.showConfirm) { toast(window.T('needRefresh'), 'error'); return; }
 window.showConfirm('删除资源', '不影响对方平台', function (done) {
 done();
 api('admin/external', { method: 'POST', body: { op: 'goods.del', id: id } }).then(function (r) {
 if (r && r.ok) { delete S.sel[id]; S.goods = S.goods.filter(function (g) { return Number(g.id) !== id; }); render(); }
 else toast((r && r.msg) || '没删掉，请重试', 'error');
 });
 });
 return;
 }
 if (act === 'delbatch') {
 var ids = selIds();
 if (!ids.length) { toast('先勾选要删的资源', 'info'); return; }
 if (!window.showConfirm) { toast(window.T('needRefresh'), 'error'); return; }
 window.showConfirm('批量删除', '不影响对方平台', function (done) {
 done();
 Promise.all(ids.map(function (x) { return api('admin/external', { method: 'POST', body: { op: 'goods.del', id: x } }); })).then(function () {
 S.goods = S.goods.filter(function (g) { return ids.indexOf(Number(g.id)) < 0; });
 S.sel = {}; render(); toast('已删除 ' + ids.length + ' 条', 'success');
 });
 });
 return;
 }
 if (act === 'delunused') {
 var unused = (S.goods || []).filter(function (g) { return g.status !== 'used'; });
 if (!unused.length) { toast('没有可清理的资源', 'info'); return; }
 if (!window.showConfirm) { toast(window.T('needRefresh'), 'error'); return; }
 window.showConfirm('清未上架',
 '将删除 ' + unused.length + ' 条「还没上架」的采集记录。已上架的 ' + ((S.goods || []).length - unused.length) + ' 条不会动，对方平台也不受影响。',
 function (done) {
 done();
 var uids = unused.map(function (g) { return Number(g.id); });
 Promise.all(uids.map(function (x) { return api('admin/external', { method: 'POST', body: { op: 'goods.del', id: x } }); }))
 .then(function () {
 S.goods = (S.goods || []).filter(function (g) { return uids.indexOf(Number(g.id)) < 0; });
 S.sel = {}; render();
 toast('已清理 ' + uids.length + ' 条未上架记录', 'success');
 });
 });
 return;
 }
 if (act === 'gopf' || act === 'runpf' || act === 'editpf' || act === 'delpf') {
 var row = b.closest('.extc-prow');
 var pid = Number(row.getAttribute('data-pid'));
 var p = S.platforms.filter(function (x) { return Number(x.id) === pid; })[0];
 if (!p) return;
 if (act === 'gopf') {
 var u = p.login_url || p.mall_url;
 if (!u) { toast('这个平台还没填地址', 'error'); return; }
 window.open(u, '_blank', 'noopener');
 } else if (act === 'runpf') {
 S.curPf = pid; S.page = 1;
 var sel = S.mask.querySelector('#extcPf'); if (sel) sel.value = String(pid);
 runCollect();
 } else if (act === 'editpf') {
 platformForm(p);
 } else {
 if (!window.showConfirm) { toast(window.T('needRefresh'), 'error'); return; }
 window.showConfirm('删除平台', '采来的资源会转为未归平台，不会丢', function (done) {
 done();
 api('admin/external', { method: 'POST', body: { op: 'platform.del', id: p.id } }).then(function (r) {
 if (r && r.ok) {
 S.platforms = S.platforms.filter(function (x) { return Number(x.id) !== Number(p.id); });
 if (Number(S.curPf) === Number(p.id)) S.curPf = 0;
 loadGoods(); toast('已删除', 'success');
 } else toast((r && r.msg) || '没删掉，请重试', 'error');
 });
 });
 }
 return;
 }
 if (act === 'retry') {
 var run = S.runs[Number(b.getAttribute('data-i'))];
 if (run && run.pid) {
 S.curPf = Number(run.pid); S.page = 1;
 var sel2 = S.mask.querySelector('#extcPf'); if (sel2) sel2.value = String(run.pid);
 runCollect();
 }
 return;
 }
 if (act === 'seeRun') {
 S.tab = 'goods';
 Array.prototype.forEach.call(S.mask.querySelectorAll('.extc-tab'), function (x) { x.classList.toggle('on', x.getAttribute('data-tab') === 'goods'); });
 render(); return;
 }
 }

 function onBodyInput(e) {
 var t = e.target;
 if (!t || !t.id) return;
 if (t.id === 'extcQ') { S.q = t.value; S.page = 1; render(); restoreFocus('extcQ', t.value.length); }
 if (t.id === 'extcSt') { S.status = t.value; S.page = 1; render(); }
 }
 function restoreFocus(id, caret) {
 setTimeout(function () {
 var el = S.mask && S.mask.querySelector('#' + id);
 if (!el) return;
 el.focus();
 try { el.setSelectionRange(caret, caret); } catch (e) {}
 }, 0);
 }

 /* ================= 采集 ================= */
 function runCollect() {
 if (S.busy) return;
 /* v537（老板）：左上选的是「全部平台」时，就别再拦着让人去选——直接一个接一个全采 */
 if (!S.curPf) return collectAll();
 var p = S.platforms.filter(function (x) { return Number(x.id) === Number(S.curPf); })[0];
 if (!p) { toast('先在左上选一个平台', 'error'); return; }
 if (!p.mall_url) { toast('请先填平台地址', 'error'); return; }
 S.busy = true; S.hint = '正在采集（0 秒 / 最多 20 秒）'; render();
 /* v530：采集时显示真实等待秒数，不再是干等 */
 var __t0 = Date.now();
 var __tick = setInterval(function () {
 if (!S.busy) { clearInterval(__tick); return; }
 S.hint = '正在采集（' + Math.round((Date.now() - __t0) / 1000) + ' 秒 / 最多 20 秒）';
 var h = S.mask && S.mask.querySelector('#extcHint');
 if (h) h.textContent = S.hint;
 }, 1000);
 var btn = S.mask && S.mask.querySelector('#extcRun');
 if (btn) { btn.disabled = true; btn.textContent = '采集中'; }
 /* v541b：按老板 r24 要求回退「失败自动重试一次」，恢复单次采集 */
 api('admin/external', { method: 'POST', body: { op: 'collect', platform_id: p.id } }).then(function (r) {
 S.busy = false; clearInterval(__tick);
 if (btn) { btn.disabled = false; btn.textContent = '采集'; }
 if (r && r.ok) {
 S.hint = '抓到 ' + r.found + ' 条，新入库 ' + r.added + ' 条' + (r.dup ? '，已有 ' + r.dup + ' 条' : '')
 + (r.via === 'api' ? '（走商城接口，标题/封面/描述/详情/下单链接都拿到了）' : '（走页面解析）')
 + (r.fixed_addr ? '（地址已自动换成 ' + r.fixed_addr + '）' : '');
 S.runs.unshift({ at: nowStr(), pid: p.id, name: p.name, ok: true, msg: S.hint + (r.samples && r.samples.length ? '（例：' + r.samples.slice(0, 2).join('、') + '）' : '') });
 if (r.fixed_addr) p.mall_url = r.fixed_addr;
 toast('采集完成：新入库 ' + r.added + ' 条', 'success');
 loadGoods();
 } else {
 S.hint = (r && r.msg) || '采集失败';
 S.runs.unshift({ at: nowStr(), pid: p.id, name: p.name, ok: false, msg: S.hint + (r && r.tip ? '｜' + r.tip : '') });
 toast(S.hint, 'error');
 render();
 }
 });
 }

 /* v537：全部平台依次采集——串行跑，不并发，避免同时打对方站点被限流 */
 function collectAll() {
 var list = S.platforms.filter(function (x) { return String(x.mall_url || '').trim(); });
 if (!list.length) { toast('请先添加平台', 'error'); return; }
 S.busy = true;
 var btn = S.mask && S.mask.querySelector('#extcRun');
 if (btn) { btn.disabled = true; btn.textContent = '采集中'; }
 var i = 0, added = 0, fails = [];
 var step = function () {
 if (i >= list.length) {
 S.busy = false;
 if (btn) { btn.disabled = false; btn.textContent = '采集'; }
 S.hint = '全部采完：新增 ' + added + ' 条' + (fails.length ? '，' + fails.length + ' 个平台没采到' : '');
 var h0 = S.mask && S.mask.querySelector('#extcHint'); if (h0) h0.textContent = S.hint;
 toast(S.hint, fails.length ? 'error' : 'success');
 loadGoods();
 return;
 }
 var p = list[i]; i++;
 S.hint = '正在采集「' + p.name + '」（' + i + '/' + list.length + '）';
 var h = S.mask && S.mask.querySelector('#extcHint'); if (h) h.textContent = S.hint;
 api('admin/external', { method: 'POST', body: { op: 'collect', platform_id: p.id } }).then(function (r) {
 if (r && r.ok) {
 added += (r.added || 0);
 S.runs.unshift({ at: nowStr(), pid: p.id, name: p.name, ok: true, msg: '新增 ' + (r.added || 0) + ' 条' + (r.found ? '，抓到 ' + r.found + ' 条' : '') });
 } else {
 fails.push(p.name);
 S.runs.unshift({ at: nowStr(), pid: p.id, name: p.name, ok: false, msg: (r && r.msg) || '采集失败' });
 }
 setTimeout(step, 250);
 }).catch(function () {
 fails.push(p.name);
 S.runs.unshift({ at: nowStr(), pid: p.id, name: p.name, ok: false, msg: '网络没连上' });
 setTimeout(step, 250);
 });
 };
 step();
 }

 function openPlatform() {
 var p = S.platforms.filter(function (x) { return Number(x.id) === Number(S.curPf); })[0];
 if (!p) { toast('先选一个平台', 'error'); return; }
 var u = p.login_url || p.mall_url;
 if (!u) { toast('这个平台还没填地址', 'error'); return; }
 window.open(u, '_blank', 'noopener');
 }

 /* ================= 上架：关掉本弹窗 + 打开系统的「新增资源」 ================= */
 function goEdit(g, detailHtml) {
 /* v518（老板：「本来就没有专门的跳转按键，就放在详情里做成超链接」）：
 不再往「专属客服链接」塞下单地址（那是客服用的，塞进去访客点客服会莫名跳到别人商城）。
 改成在详情正文末尾追加一行超链接——访客看到的就是「点此前往原平台下单」，点开新窗口直达。 */
 var buy = String(g.buy_url || g.src_url || '').trim();
 var html = String(detailHtml || g.detail_html || '');
 var buyLine = '';
 if (buy) {
 var already = html.indexOf(buy) >= 0;
 /* v587 用户 11-08（第 11 条）：不要「点此前往原平台下单」这行字，直接把链接本身显示出来、可点。
 链接内容必须逐字照搬（规范 9.67：人为/来源信息一个字都不许改）。 */
 if (!already) buyLine = '<p><a href="' + buy + '" target="_blank" rel="noopener">' + buy + '</a></p>';
 }
 /* v547（老板：能采的都采，上架别再手填）：采到的价格、套餐资料全文都用上。
 价格原来硬编码空字符串，等于白采。 */
 var _ex = {};
 try { _ex = JSON.parse(g.extra || '{}') || {}; } catch (e0) { _ex = {}; }
 var _rawBlock = '';
 if (_ex.raw && String(_ex.raw).length > 20 && html.indexOf(String(_ex.raw).slice(0, 20)) < 0) {
 _rawBlock = '<h3>套餐资料</h3><p>' + String(_ex.raw).slice(0, 1500).replace(/</g, '&lt;') + '</p>';
 }
 var payload = {
 title: g.title || '',
 desc: (g.descr || _ex.raw || '').slice(0, 1000),
 detail: html + _rawBlock + buyLine,
 img: g.cover || '',
 coverImages: g.cover ? [g.cover] : [],
 price: _ex.price ? String(_ex.price) : '',
 sort: 0,
 is_online: 1
 };
 if (typeof window.__openEdit !== 'function') { toast('请刷新后台再试', 'error'); return; }
 /* v517：老板反馈「点上架之后所有窗口都关了」——
 原来先关采集窗、再延时开新增资源，中间任何一步失败就是「全关了」。
 改成：先开新增资源 → 确认 editMask 真的 open 了 → 才关采集窗；没开起来就保留采集窗并提示。 */
 try { window.__openEdit(payload); } catch (eOE) { toast('打不开新增资源：' + (eOE && eOE.message || '未知错误'), 'error'); return; }
 /* v587 用户 11-08（第 13 条：「点击资源上架后的弹窗关闭了后怎么连资源采集的弹窗的也关闭了」）：
 上架时关掉采集窗是设计（避免两个弹窗叠着），但关掉之后没有回路——
 关掉「新增资源」就彻底回到后台列表，想接着采下一条得重新点开采集。
 这里打一个「从采集来的」标记，新增资源关闭时若标记还在，就把采集窗恢复出来。 */
 window.__extReturnAfterEdit = true;
 setTimeout(function () {
 var em = document.getElementById('editMask');
 if (em && em.classList.contains('open')) {
 close();
 toast('补上分类和价格即可', 'info');
 } else {
 toast('再点一次试试', 'error');
 }
 }, 260);
 /* v517：**不再**在打开编辑窗时就标「已上架」——老板点了上架又取消，库里已经标成已上架了。
 改成挂一个待确认标记，等「新增资源」真的保存成功，再由 __extAfterProductSave 回写状态。 */
 window.__extPendingGoods = Number(g.id) || 0;
 }

 function useGoods(id) {
 var g = S.goods.filter(function (x) { return Number(x.id) === id; })[0];
 if (!g) return;
 if (g.detail_html) { goEdit(g, g.detail_html); return; }
 if (!g.src_url) { goEdit(g, ''); return; }
 toast('正在抓这条的详情长图', 'info');
 api('admin/external', { method: 'POST', body: { op: 'find.one', url: g.src_url } }).then(function (r) {
 var html = '';
 if (r && r.ok && r.media && r.media.length) {
 html = r.media.filter(function (u) { return u !== g.cover; }).slice(0, 20)
 .map(function (u) { return '<p><img src="' + u + '"></p>'; }).join('');
 /* v546p：顺手把原来空着的简介/下单链接补上——否则上架后这两格还是空的，老板还得回去手填 */
 var upd = { op: 'goods.update', id: g.id, detail_html: html };
 if (!g.descr && r.desc) { upd.descr = r.desc; g.descr = r.desc; }
 if (!g.buy_url && r.buy_url) { upd.buy_url = r.buy_url; g.buy_url = r.buy_url; }
 api('admin/external', { method: 'POST', body: upd });
 g.detail_html = html;
 }
 goEdit(g, html);
 });
 }

 function useBatch(ids) {
 ids = (ids || []).filter(Boolean);
 if (!ids.length) { toast('先选资源', 'error'); return; }
 if (ids.length > 1) toast('批量会逐条打开', 'info');
 var g = S.goods.filter(function (x) { return Number(x.id) === Number(ids[0]); })[0];
 if (g) useGoods(Number(g.id));
 }

 /* ================= 粘贴（两条路）================= */
 function pasteForm() {
 /* v546q：原来默认「（不归平台）」，同一链接反复粘会在池子里堆好几条；
 有平台时默认归到第一个平台，去重才生效。 */
 var pid = Number(S.curPf) || (S.platforms[0] ? Number(S.platforms[0].id) : 0);
 var pfOpts = '<option value="0">（不归平台）</option>' + S.platforms.map(function (p) {
 return '<option value="' + p.id + '"' + (Number(p.id) === pid ? ' selected' : '') + '>' + esc(p.name) + '</option>';
 }).join('');
 var m = mkModal('extcPasteMask', '粘贴添加资源', '',
 '<div class="extc-subtabs">' +
 '<button type="button" class="extc-subtab on" data-ptab="link">粘资源链接</button>' +
 '<button type="button" class="extc-subtab" data-ptab="rich">粘整页内容</button>' +
 '</div>' +
 '<label>归到哪个平台</label><select class="input" id="paPf">' + pfOpts + '</select>' +
 '<div id="paLinkBox">' +
 '<label>资源页地址（浏览器地址栏那条）</label>' +
 '<input class="input" id="paUrl" placeholder="https://">' +
 '<div class="extc-formhint">抓不到时可粘贴整页</div>' +
 '</div>' +
 '<div id="paRichBox" style="display:none">' +
 '<label>粘到这里</label>' +
 '<textarea class="input extc-pastearea" id="paRich" placeholder="在对方资源页按 Ctrl+A 全选、Ctrl+C 复制，然后点这里 Ctrl+V"></textarea>' +
 '<div class="extc-formhint">自动提取标题和图片</div>' +
 '</div>' +
 '<div class="extc-formhint" id="paTip"></div>',
 '<button class="modal-inner-btn" id="paSave">加进资源</button><button class="modal-close" data-x="1">关闭</button>');

 var tab = 'link';
 Array.prototype.forEach.call(m.querySelectorAll('[data-ptab]'), function (b) {
 b.addEventListener('click', function () {
 tab = b.getAttribute('data-ptab');
 Array.prototype.forEach.call(m.querySelectorAll('[data-ptab]'), function (x) { x.classList.toggle('on', x === b); });
 m.querySelector('#paLinkBox').style.display = tab === 'link' ? '' : 'none';
 m.querySelector('#paRichBox').style.display = tab === 'rich' ? '' : 'none';
 m.querySelector('#paTip').textContent = '';
 });
 });

 m.querySelector('#paUrl').addEventListener('input', function () {
 var u = this.value.trim();
 if (!/^https?:\/\//i.test(u)) return;
 var host = '';
 try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return; }
 var hit = S.platforms.filter(function (p) {
 var cand = (p.mall_url || '') + ' ' + (p.login_url || '');
 return cand && cand.indexOf(host) >= 0;
 })[0];
 if (hit) {
 m.querySelector('#paPf').value = String(hit.id);
 m.querySelector('#paTip').textContent = '已自动归到平台「' + hit.name + '」';
 }
 });

 m.querySelector('#paRich').addEventListener('paste', function (ev) {
 var cd = ev.clipboardData || window.clipboardData;
 if (!cd) return;
 var html = cd.getData('text/html') || '';
 var text = cd.getData('text/plain') || '';
 if (!html && !text) return;
 ev.preventDefault();
 m.querySelector('#paRich').value = text.slice(0, 4000);
 var got = extractFromHtml(html, text);
 P.lastClip = got;
 m.querySelector('#paTip').innerHTML = '提取到：标题「' + esc(got.title || '（没认出，可自己改）') + '」' +
 (got.media.length ? '，' + got.media.length + ' 张图（封面用第 1 张）' : '，没有图');
 });

 m.querySelector('#paSave').addEventListener('click', function () {
 var btn = this;
 setTimeout(function () { if (btn.disabled) btn.textContent = '还在处理，请稍候'; }, 6000);
 var pfId = Number(m.querySelector('#paPf').value) || 0;
 var tip = m.querySelector('#paTip');
 if (tab === 'link') {
 var url = m.querySelector('#paUrl').value.trim();
 if (!/^https?:\/\//i.test(url)) { toast('填完整网址', 'error'); return; }
 btn.disabled = true; btn.textContent = '抓取中';
 tip.textContent = '正在抓这一条';
 api('admin/external', { method: 'POST', body: { op: 'find.one', url: url } }).then(function (r) {
 btn.disabled = false; btn.textContent = '加进资源池';
 if (!r || !r.ok) { tip.textContent = (r && r.msg) || '抓不到'; return; }
 var media = (r.media || []).filter(function (u) { return u !== r.cover; });
 /* v546p：京东/淘宝这类站常返回「登录墙」页面，标题是站点名、一张图都没有。
 后端现在会带 weak 标记，这里先告诉老板，别存进去才发现是空的。 */
 if (r.weak) {
 tip.textContent = '只抓到标题（这条是登录墙或靠浏览器渲染的页面），简介和图片可能是空的。存进去后请核对，实在不行改用「粘贴」。';
 }
 /* v546p（实测）：原来只传标题/封面/图，抓到的「简介」和「下单链接」全丢了，
 池子里这两列永远空着。一并传过去。 */
 api('admin/external', { method: 'POST', body: { op: 'goods.add', platform_id: pfId, title: r.title, cover: r.cover, src_url: url, media: media, descr: r.desc || '', buy_url: r.buy_url || '' } }).then(function (r2) {
 if (r2 && r2.ok) { toast(r2.dup ? '资源池里已经有了' : '已加进资源池', 'success'); closeM(m); loadGoods(); }
 else toast((r2 && r2.msg) || '保存失败', 'error');
 });
 });
 } else {
 var got2 = P.lastClip;
 if (!got2 || (!got2.title && !got2.media.length)) { tip.textContent = '先在上面的框里 Ctrl+V 粘一下内容'; return; }
 btn.disabled = true; btn.textContent = '保存中';
 api('admin/external', { method: 'POST', body: { op: 'goods.add', platform_id: pfId, title: got2.title || '（未命名资源）', cover: got2.media[0] || '', src_url: '', media: got2.media.slice(1) } }).then(function (r2) {
 btn.disabled = false; btn.textContent = '加进资源池';
 if (r2 && r2.ok) { toast(r2.dup ? '资源池里已经有了' : '已加进资源池', 'success'); closeM(m); loadGoods(); }
 else toast((r2 && r2.msg) || '保存失败', 'error');
 });
 }
 });
 }
 var P = { lastClip: null };

 function extractFromHtml(html, text) {
 var media = [], title = '';
 if (html) {
 var box = document.createElement('div');
 box.innerHTML = html;
 Array.prototype.forEach.call(box.querySelectorAll('img'), function (im) {
 var u = im.getAttribute('data-src') || im.getAttribute('data-original') || im.getAttribute('src') || '';
 if (!/^https?:\/\//i.test(u)) return;
 if (/(icon|logo|avatar|qrcode|qr_|sprite|placeholder|blank|loading|tabbar)/i.test(u)) return;
 var w = parseInt(im.getAttribute('width') || '0', 10);
 var h = parseInt(im.getAttribute('height') || '0', 10);
 if ((w && w < 120) || (h && h < 120)) return;
 if (media.indexOf(u) < 0) media.push(u);
 });
 }
 var lines = String(text || '').split(/[\r\n]+/).map(function (s) { return s.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
 var GOODS = /(卡|WiFi|宽带|流量包|套餐|随身|物联)/, OP = /(联通|电信|移动|广电|5G|4G|三网)/;
 title = (lines.filter(function (l) { return l.length >= 5 && l.length <= 60 && GOODS.test(l) && (OP.test(l) || /\d/.test(l)); })[0]) || '';
 return { title: title.slice(0, 90), media: media.slice(0, 30) };
 }

 /* ================= 看 / 改 ================= */
 function seeForm(id) {
 var g = S.goods.filter(function (x) { return Number(x.id) === id; })[0];
 if (!g) return;
 var media = [];
 try { media = JSON.parse(g.detail_media || '[]') || []; } catch (e) { media = []; }
 var imgs = (g.detail_html || '').match(/<img[^>]+src=["']([^"']+)["']/gi) || [];
 var urls = imgs.map(function (t) { return (t.match(/src=["']([^"']+)["']/i) || [])[1]; }).filter(Boolean);
 var all = (g.cover ? [g.cover] : []).concat(urls, media);
 var uniq = [];
 all.forEach(function (u) { if (u && uniq.indexOf(u) < 0) uniq.push(u); });
 /* v590（老板 11-09 第 8 条）：重新分层——原来是「描述 / 一大坨 JSON / 裸链接」平铺，看着乱。
 现在固定几段，各段带小标题：概览头（标题+状态+平台）→ 描述 → 对方参数（键值表＋可折叠全文）→ 下单链接（带复制）→ 详情图（带张数）。 */
 (function () {
 var _ex = {};
 try { _ex = JSON.parse(g.extra || '{}') || {}; } catch (eX) { _ex = {}; }
 var _kv = Object.keys(_ex).filter(function (k) { return k !== 'raw' && _ex[k] !== '' && _ex[k] != null; });
 var _rawText = String(_ex.raw || '');
 var _buy = String(g.buy_url || g.src_url || '');
 var _badge = Number(g.missing || 0) >= 1
 ? '<span class="extc-badge bad">对方已下架</span>'
 : (g.status === 'used' ? '<span class="extc-badge ok">已上架</span>' : '<span class="extc-badge">未上架</span>');
 var _meta = [esc(g.platform || '未归平台'), g.collected_at ? ('采集于 ' + esc(String(g.collected_at))) : ''].filter(Boolean).join('，');
 var NAMES = { price: '价格', pid: '商品号（pid）', k: '店铺参数（k）', title: '原标题', shop: '店铺名', uid: '分销号（uid）' };
 var _kvHtml = _kv.map(function (k) {
 return '<div class="extc-kv-row"><span class="extc-kv-k">' + esc(NAMES[k] || k) + '</span><span class="extc-kv-v">' + esc(String(_ex[k]).slice(0, 400)) + '</span></div>';
 }).join('');
 var _see = '<div class="extc-see-head">' +
 '<div class="extc-see-title">' + esc(g.title) + '</div>' +
 '<div class="extc-see-sub">' + _badge + '<span class="extc-see-meta">' + _meta + '</span></div>' +
 '</div>' +
 (g.descr ? '<div class="extc-sec"><div class="extc-sec-h">描述</div><div class="extc-see-desc">' + esc(g.descr) + '</div></div>' : '') +
 ((_kvHtml || _rawText) ? '<div class="extc-sec"><div class="extc-sec-h">对方参数</div>' +
 (_kvHtml ? '<div class="extc-kv">' + _kvHtml + '</div>' : '') +
 (_rawText ? '<details class="extc-raw"><summary>套餐资料全文（' + _rawText.length + ' 字）</summary><div>' + esc(_rawText) + '</div></details>' : '') +
 '</div>' : '') +
 (_buy ? '<div class="extc-sec"><div class="extc-sec-h">下单链接</div><div class="extc-linkrow">' +
 '<a href="' + esc(_buy) + '" target="_blank" rel="noopener">' + esc(_buy) + '</a>' +
 '<button type="button" class="row-btn" data-copy="' + esc(_buy) + '">复制</button></div></div>' : '') +
 '<div class="extc-sec"><div class="extc-sec-h">详情图 <i class="extc-sec-n">' + uniq.length + ' 张</i></div><div class="extc-seeimgs">' + (uniq.length
 ? uniq.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" referrerpolicy="no-referrer" loading="lazy" onerror="this.parentNode.remove()"></a>'; }).join('')
 : (g.__fetching ? '<div class="extc-formhint">正在抓详情图</div>'
 : '<div class="extc-formhint">可再抓一次详情图</div>')) + '</div></div>';
 var mSee = mkModal('extcSeeMask', '查看资源', 'modal-wide', _see,
 (uniq.length <= 1 && g.src_url && !g.__fetching ? '<button class="modal-inner-btn" id="seeFetch">补抓详情</button>' : '') +
 '<button class="modal-close" data-x="1">关闭</button>');
 var cp = mSee.querySelector('[data-copy]');
 if (cp) cp.addEventListener('click', function () {
 var t = this.getAttribute('data-copy');
 try { navigator.clipboard.writeText(t); toast('链接已复制', 'success'); }
 catch (e) { try { var i = document.createElement('textarea'); i.value = t; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); toast('链接已复制', 'success'); } catch (e2) { toast('复制失败，手动选中吧', 'error'); } }
 });
 })();

 /* v517：老板「第一个资源有很多图，后面的只有封面」——采集时只自动补前 12 条，
 剩下的在这里按需补：点一下就把这条的详情图/描述/下单链接抓回来并入库，下次直接有。 */
 if (uniq.length <= 1 && g.src_url && !g.__fetching) {
 var btnF = document.getElementById('seeFetch');
 if (btnF) btnF.addEventListener('click', function () {
 var b = this; b.disabled = true; b.textContent = '抓取中';
 g.__fetching = true;
 api('admin/external', { method: 'POST', body: { op: 'find.one', url: g.src_url } }).then(function (r) {
 g.__fetching = false;
 if (!r || !r.ok) { toast((r && r.msg) || '没抓到，可能这站要登录', 'error'); if (b) { b.disabled = false; b.textContent = '补抓详情'; } return; }
 var media = (r.media || []).filter(function (u) { return u !== g.cover; }).slice(0, 20);
 var html = media.map(function (u) { return '<p><img src="' + u + '"></p>'; }).join('');
 g.detail_html = html || g.detail_html; g.detail_media = media;
 if (!g.descr && r.desc) g.descr = r.desc;
 if (!g.buy_url && r.buy_url) g.buy_url = r.buy_url;
 api('admin/external', { method: 'POST', body: { op: 'goods.update', id: g.id, detail_html: g.detail_html, descr: g.descr, buy_url: g.buy_url } });
 closeM(document.getElementById('extcSeeMask'));
 setTimeout(function () { seeForm(g.id); render(); }, 200);
 });
 });
 }
 }

 function editForm(id) {
 var g = S.goods.filter(function (x) { return Number(x.id) === id; })[0];
 if (!g) return;
 var m = mkModal('extcEditMask', '编辑资源', '',
 '<label>标题</label><input class="input" id="edTitle" maxlength="90" value="' + esc(g.title || '') + '">' +
 '<label>封面图地址</label><input class="input" id="edCover" value="' + esc(g.cover || '') + '">' +
 (g.cover ? '<div class="extc-coverpreview"><img src="' + esc(g.cover) + '" referrerpolicy="no-referrer" onerror="this.remove()"></div>' : '') +
 '<label>描述（上架时自动带进「简介」）</label><input class="input" id="edDescr" maxlength="300" value="' + esc(g.descr || '') + '">' +
 '<label>下单链接（上架时自动带进「跳转链接」）</label><input class="input" id="edBuy" value="' + esc(g.buy_url || '') + '">' +
 '<label>原页面地址（上架时拿它抓详情图）</label><input class="input" id="edUrl" value="' + esc(g.src_url || '') + '">' +
 '<div class="extc-formhint">上架时自动抓详情图</div>',
 '<button class="modal-inner-btn" id="edSave">确定</button><button class="modal-close" data-x="1">关闭</button>');
 m.querySelector('#edSave').addEventListener('click', function () {
 var btn = this; btn.disabled = true; btn.textContent = '保存中';
 api('admin/external', {
 method: 'POST',
 body: {
 op: 'goods.update', id: id,
 title: m.querySelector('#edTitle').value.trim(),
 cover: m.querySelector('#edCover').value.trim(),
 descr: m.querySelector('#edDescr').value.trim(),
 buy_url: m.querySelector('#edBuy').value.trim(),
 src_url: m.querySelector('#edUrl').value.trim()
 }
 }).then(function (r) {
 btn.disabled = false; btn.textContent = '确定';
 if (r && r.ok) {
 g.title = m.querySelector('#edTitle').value.trim();
 g.cover = m.querySelector('#edCover').value.trim();
 g.descr = m.querySelector('#edDescr').value.trim();
 g.buy_url = m.querySelector('#edBuy').value.trim();
 g.src_url = m.querySelector('#edUrl').value.trim();
 toast(window.T('saved'), 'success'); closeM(m); render();
 } else toast((r && r.msg) || '保存失败', 'error');
 });
 });
 }

 /* ================= 平台档案（编辑器复用系统）================= */
 function platformForm(p) {
 var isEdit = !!(p && p.id);
 var m = mkModal('extcPfMask', isEdit ? '编辑平台：' + esc(p.name) : '添加平台', '',
 '<label>平台名（必填）</label><input class="input" id="epName" maxlength="40" value="' + esc(isEdit ? p.name : '') + '" placeholder="比如 五湖通信">' +
 '<label>商城地址（对方后台里的「在线商城」那一条）</label><input class="input" id="epMall" maxlength="600" value="' + esc(isEdit ? (p.mall_url || '') : '') + '" placeholder="点「在线商城」复制的地址">' +
 '<div class="extc-formhint">只填<b>在线商城</b>那一行链接（资源从这里抓）。不要填「注册」「资料」那种地址；填错我也会自动试同域的列表页。</div>' +
 '<div class="extc-probe-row"><button type="button" class="row-btn" id="epProbe">试采地址</button><span class="extc-probe-tip" id="epProbeTip">不确定能不能采？先点这里试一下（不会入库）</span></div>' +
 '<label>登录地址（对方后台里的「手机登录」那一条）</label><input class="input" id="epAdmin" maxlength="600" value="' + esc(isEdit ? (p.login_url || '') : '') + '" placeholder="点「手机登录」复制的地址">' +
 '<div class="extc-formhint">只填<b>手机登录</b>那一行链接（点「打开平台」直接到登录页），不填就跳商城。</div>' +
 /* v587 用户 11-09：「我的平台的每项平台多一个选择是否开启自动采集和自动隐藏」
 v537 时老板说全平台必采、把开关去掉了；现在要按平台单独控制，加回来两个。 */
 '<label>自动采集 / 自动隐藏</label>' +
 '<div class="extc-sw-row">' +
 '<label class="extc-sw"><input type="checkbox" id="epAutoCollect"' + (!isEdit || Number(p.auto_collect) ? ' checked' : '') + '><i><b></b></i><span>每天自动采集</span></label>' +
 '<label class="extc-sw"><input type="checkbox" id="epAutoHide"' + (!isEdit || Number(p.auto_hide) ? ' checked' : '') + '><i><b></b></i><span>对方下架时自动隐藏本店资源</span></label>' +
 '</div>' +
 '<div class="extc-formhint">' +
 '对方下架时，本店同款自动隐藏</div>' +
 '<label>我的说明</label>' +
 '<div id="epNoteHost"></div>' +
 '<div class="extc-formhint">写给自己看的备注</div>',
 '<button class="modal-inner-btn" id="epSave">' + (isEdit ? '确定' : '添加') + '</button><button class="modal-close" data-x="1">关闭</button>',
 function () {
 mountRte(m.querySelector('#epNoteHost'), 'epNote', isEdit ? String(p.note || '') : '', '100px');
 });

 /* v592（老板 11-09 第 9 条）：先试采再建平台——只读探一次，不入库。 */
 (function () {
 var pb = m.querySelector('#epProbe'); if (!pb) return;
 pb.addEventListener('click', function () {
 var tip = m.querySelector('#epProbeTip');
 var u = m.querySelector('#epMall').value.trim();
 if (!/^https?:\/\//i.test(u)) { tip.textContent = '先在上面填好商城地址再试'; tip.className = 'extc-probe-tip is-bad'; return; }
 var old = pb.textContent; pb.disabled = true; pb.textContent = '试采中';
 tip.textContent = '正在试着抓一次'; tip.className = 'extc-probe-tip';
 api('admin/external', { method: 'POST', body: { op: 'probe', url: u } }).then(function (r) {
 pb.disabled = false; pb.textContent = old;
 if (r && r.ok && Number(r.count) > 0) {
 tip.textContent = '能采：这次拿到 ' + r.count + ' 条' + (r.via ? '（' + (r.via === 'api' ? '对方接口' : '页面解析') + '）' : '') + (r.samples && r.samples[0] ? '，比如「' + r.samples[0] + '」' : '');
 tip.className = 'extc-probe-tip is-ok';
 } else {
 tip.textContent = '采不到：' + ((r && r.msg) || '这个地址解析不出资源，换列表页地址，或用「粘贴」兜底');
 tip.className = 'extc-probe-tip is-bad';
 }
 }).catch(function () { pb.disabled = false; pb.textContent = old; tip.textContent = '试采失败，检查网络后重试'; tip.className = 'extc-probe-tip is-bad'; });
 });
 })();

 m.querySelector('#epSave').addEventListener('click', function () {
 var ed = m.querySelector('#epNote');
 var body = {
 op: 'platform.save',
 id: isEdit ? p.id : 0,
 name: m.querySelector('#epName').value.trim(),
 mall_url: m.querySelector('#epMall').value.trim(),
 login_url: m.querySelector('#epAdmin').value.trim(),
 auto_collect: m.querySelector('#epAutoCollect') && m.querySelector('#epAutoCollect').checked ? 1 : 0,
 auto_hide: m.querySelector('#epAutoHide') && m.querySelector('#epAutoHide').checked ? 1 : 0,
 note: ed ? ed.innerHTML.slice(0, 20000) : ''
 };
 if (!body.name) { toast('平台名不能为空', 'error'); return; }
 var btn = this; btn.disabled = true; btn.textContent = '保存中';
 api('admin/external', { method: 'POST', body: body }).then(function (r) {
 if (r && r.ok) {
 toast(window.T('saved'), 'success');
 if (isEdit) {
 S.platforms.forEach(function (x) {
 if (Number(x.id) === Number(p.id)) { x.name = body.name; x.note = body.note; x.mall_url = body.mall_url; x.login_url = body.login_url; x.auto_collect = body.auto_collect; x.auto_hide = body.auto_hide; }
 });
 } else if (r.id) {
 S.platforms.push({ id: r.id, name: body.name, mall_url: body.mall_url, login_url: body.login_url, note: body.note, auto_collect: body.auto_collect, auto_hide: body.auto_hide });
 S.curPf = r.id;
 }
 closeM(m);
 render();
 loadAll();
 } else {
 toast((r && r.msg) || '保存失败', 'error');
 btn.disabled = false; btn.textContent = isEdit ? '确定' : '添加';
 }
 });
 });
 }

 /* ================= 弹窗外壳：与系统其他弹窗完全同构 ================= */
 function mkModal(id, title, extraCls, bodyHtml, footHtml, after) {
 var old = document.getElementById(id); if (old) old.remove();
 var m = document.createElement('div');
 m.className = 'modal-mask'; m.id = id;
 m.innerHTML = '<div class="modal-box ' + (extraCls || '') + '" role="dialog" aria-modal="true">' +
 '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
 '<h2 class="modal-title">' + title + '</h2>' +
 '<div class="form">' + bodyHtml + '</div>' +
 '<div class="modal-footer">' + footHtml + '</div></div>';
 document.body.appendChild(m);
 /* v496：打开时必须走系统的滚动计数锁 + 聚焦关闭键（二.4 弹窗铁律，缺一条就会出现「弹窗后面页面还在滚」或键盘用户被困住） */
 if (window.lockBodyScroll) window.lockBodyScroll(true);
 else if (window.syncBodyLock) window.syncBodyLock();
 requestAnimationFrame(function () {
 m.classList.add('open');
 var x = m.querySelector('.modal-close-x');
 if (x) { try { x.focus({ preventScroll: true }); } catch (e0) {} }
 });
 m.addEventListener('click', function (e) { if (e.target === m || (e.target.closest && e.target.closest('[data-x]'))) closeM(m); });
 if (after) setTimeout(after, 30);
 return m;
 }
 function closeM(m) {
 if (!m) return;
 m.classList.remove('open');
 setTimeout(function () { m.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 200);
 }

 document.addEventListener('click', function (e) {
 var b = e.target.closest && e.target.closest('#openExtCollectBtn');
 if (b) { e.preventDefault(); open(); }
 });
 /* v517：新增资源「真的保存成功」后才回写采集状态——点了上架又取消，不会再无辜显示「已上架」 */
 window.__extAfterProductSave = function (productId) {
 var gid = Number(window.__extPendingGoods || 0);
 if (!gid) return;
 window.__extPendingGoods = 0;
 api('admin/external', { method: 'POST', body: { op: 'goods.use', id: gid, product_id: Number(productId) || 0 } }).then(function () {
 S.goods.forEach(function (x) { if (Number(x.id) === gid) { x.status = 'used'; x.used_product_id = Number(productId) || 0; } });
 if (S.mask) render();
 });
 };
 /* v587（第 14 条）：平台说明的三角展开/收起。用事件委托，弹窗内容重建也不失效。
 高度按真实内容算，收起回 0；三角旋转与内容高度同档过渡，和全站口径一致。 */
 document.addEventListener('click', function (e) {
 var btn = e.target.closest && e.target.closest('.extc-note-fold');
 if (!btn) return;
 e.preventDefault();
 var box = btn.closest('.extc-pfnote');
 if (!box) return;
 var on = box.classList.toggle('open');
 btn.setAttribute('aria-expanded', on ? 'true' : 'false');
 btn.setAttribute('aria-label', on ? '收起平台说明' : '展开平台说明');
 var body = box.querySelector('.extc-pfnote-b');
 if (body) body.style.maxHeight = on ? (body.scrollHeight + 8 + 'px') : '0px';
 });

 /* v587（第 13 条）：新增资源弹窗关闭时，如果这次编辑是从「上架」进来的，把采集窗恢复出来 */
 window.__extAfterEditClose = function () {
 if (!window.__extReturnAfterEdit) return;
 window.__extReturnAfterEdit = false;
 try { if (typeof window.__extOpenCollect === 'function') window.__extOpenCollect(); } catch (e) {}
 };

 window.__extOpenCollect = open;
})();
