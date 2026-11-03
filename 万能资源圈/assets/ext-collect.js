/* ===== v490 资源采集（老板逐条要求重做）=====
   入口：平台设置 →「资源采集」
   1) 术语统一叫「资源」，不叫商品
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
    q: '', status: '', page: 1, pageSize: 24,
    runs: [], cats: []
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
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
    bar.classList.remove('rte-collapsed', 'rte-toolbar-large');
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
      var sel = pk.querySelector('select');
      var disp = pk.querySelector('.cat-picker-display');
      var panel = pk.querySelector('.cat-picker-panel');
      if (!sel || !disp) return;
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'cat-picker-panel';
        pk.appendChild(panel);
      }
      var txt = disp.querySelector('.cpd-text') || disp;
      panel.innerHTML = Array.prototype.map.call(sel.options, function (o) {
        return '<div class="cp-item" data-v="' + esc(o.value) + '">' + esc(o.textContent) + '</div>';
      }).join('');
      var cur = sel.options[sel.selectedIndex] || sel.options[0];
      if (cur) txt.textContent = cur.textContent;

      disp.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var open = !panel.classList.contains('open');
        panel.classList.toggle('open', open);
        pk.classList.toggle('open', open);
      });
      panel.addEventListener('click', function (e) {
        var it = e.target.closest ? e.target.closest('.cp-item') : null;
        if (!it) return;
        e.preventDefault(); e.stopPropagation();
        sel.value = it.getAttribute('data-v');
        txt.textContent = it.textContent;
        panel.classList.remove('open');
        pk.classList.remove('open');
        try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
        try { if (editor) editor.focus({ preventScroll: true }); } catch (e3) {}
      });
    });
    /* 点空白处收起所有面板 */
    setTimeout(function () {
      document.addEventListener('click', function () {
        Array.prototype.forEach.call(bar.querySelectorAll('.cat-picker-panel.open'), function (p) { p.classList.remove('open'); });
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
      '<select id="extcPf" class="extc-sel"></select>' +
      '<button type="button" class="extc-btn" id="extcOpenPf" title="打开这个平台">打开平台</button>' +
      '<button type="button" class="extc-btn primary" id="extcRun" title="按商城地址抓一批">采集</button>' +
      '<button type="button" class="extc-btn" id="extcPaste" title="粘一条链接，或粘整页内容">粘贴</button>' +
      '<span class="extc-hint" id="extcHint"></span>' +
      '</div>' +
      '<div class="extc-tabs">' +
      '<button type="button" class="extc-tab on" data-tab="goods">资源池 <i id="extcNGoods">0</i></button>' +
      '<button type="button" class="extc-tab" data-tab="pf">我的平台 <i id="extcNPf">0</i></button>' +
      '<button type="button" class="extc-tab" data-tab="runs">采集记录 <i id="extcNRuns">0</i></button>' +
      '<button type="button" class="extc-link" id="extcAddPf">+ 添加平台</button>' +
      '</div>' +
      '<div class="extc-body" id="extcBody"></div>' +
      '</div>';
    document.body.appendChild(m);
    S.mask = m;
    requestAnimationFrame(function () { m.classList.add('open'); });
    if (window.syncBodyLock) window.syncBodyLock();

    m.addEventListener('click', function (e) {
      if (e.target === m || (e.target.closest && e.target.closest('[data-x]'))) close();
    });
    m.querySelector('#extcPf').addEventListener('change', function () {
      S.curPf = Number(this.value) || 0;
      S.sel = {}; S.page = 1;
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
    var nG = m.querySelector('#extcNGoods'); if (nG) nG.textContent = S.goods.length;
    var nP = m.querySelector('#extcNPf'); if (nP) nP.textContent = S.platforms.length;
    var nR = m.querySelector('#extcNRuns'); if (nR) nR.textContent = S.runs.length;
    var hint = m.querySelector('#extcHint');
    if (hint) { hint.textContent = S.hint || ''; hint.title = S.hint || ''; }

    var body = m.querySelector('#extcBody');
    if (S.tab === 'goods') body.innerHTML = renderGoods();
    else if (S.tab === 'pf') body.innerHTML = renderPlatforms();
    else body.innerHTML = renderRuns();
  }

  function actsHtml(n) {
    return '<div class="extc-tools extc-acts">' +
      '<button type="button" class="extc-btn" data-act="selpage">选中本页</button>' +
      '<button type="button" class="extc-btn" data-act="selnone">清空选择</button>' +
      '<span class="extc-sp"></span>' +
      (n ? '<button type="button" class="extc-btn primary" data-act="batchuse">上架（' + n + '）</button>' : '') +
      (n ? '<button type="button" class="extc-btn danger" data-act="delbatch">删除选中</button>' : '') +
      '</div>';
  }
  function refreshSelUI() {
    if (!S.mask) return;
    var n = selIds().length;
    var cnt = S.mask.querySelector('.extc-cnt');
    if (cnt) cnt.innerHTML = filtered().length + ' 个' + (n ? ' · 已选 <b>' + n + '</b>' : '');
    var acts = S.mask.querySelector('.extc-acts');
    if (acts) acts.innerHTML = actsHtml(n);
  }

  function renderGoods() {
    var list = filtered();
    if (!S.goods.length) {
      return '<div class="extc-empty">资源池是空的。<br><br>' +
        '① 选一个平台点「采集」——填对商城地址能一次抓一批<br>' +
        '② 抓不到的点「粘贴」——粘链接或整页内容，一条条加</div>';
    }
    var n = selIds().length;
    var cur = S.platforms.filter(function (p) { return Number(p.id) === Number(S.curPf); })[0];
    var pfNote = cur && cur.note ? '<div class="extc-pfnote"><b>' + esc(cur.name) + ' 的说明</b><div class="extc-pfnote-b">' + cur.note + '</div></div>' : '';

    var head = '<div class="extc-tools">' +
      '<input id="extcQ" class="extc-search" type="search" autocomplete="off" placeholder="搜标题 / 平台 / 链接" value="' + esc(S.q) + '">' +
      '<select id="extcSt" class="extc-sel2">' +
      '<option value="">全部状态</option>' +
      '<option value="new"' + (S.status === 'new' ? ' selected' : '') + '>未上架</option>' +
      '<option value="used"' + (S.status === 'used' ? ' selected' : '') + '>已上架</option>' +
      '</select>' +
      '<span class="extc-cnt">' + list.length + ' 个' + (n ? ' · 已选 <b>' + n + '</b>' : '') + '</span>' +
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
        (g.cover ? '<img src="' + esc(g.cover) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add(\'noimg\');this.remove()">' : '<span class="extc-noimg">无图</span>') +
        (used ? '<span class="extc-used">已上架</span>' : '') +
        '<span class="extc-ck">' + (on ? '✓' : '') + '</span>' +
        '</div>' +
        '<div class="extc-t" title="' + esc(g.title) + '">' + esc(g.title) + '</div>' +
        '<div class="extc-m">' + esc(g.platform || '未归平台') + '</div>' +
        '<div class="extc-ops">' +
        '<button type="button" class="extc-mini primary" data-act="use">' + (used ? '再上架' : '上架') + '</button>' +
        '<button type="button" class="extc-mini" data-act="edit">改</button>' +
        '<button type="button" class="extc-mini" data-act="see">看</button>' +
        '<button type="button" class="extc-mini danger" data-act="del">删</button>' +
        '</div></div>';
    }).join('');

    var pager = pages > 1
      ? '<div class="extc-pager"><button type="button" class="extc-mini" data-act="prev"' + (S.page <= 1 ? ' disabled' : '') + '>上一页</button>' +
        '<span>' + S.page + ' / ' + pages + '</span>' +
        '<button type="button" class="extc-mini" data-act="next"' + (S.page >= pages ? ' disabled' : '') + '>下一页</button></div>'
      : '';

    return pfNote + head + actsHtml(n) + '<div class="extc-grid">' + cards + '</div>' + pager;
  }

  function renderPlatforms() {
    if (!S.platforms.length) {
      return '<div class="extc-empty">还没有平台。<br>点右上「+ 添加平台」，填平台名和商城地址（你在那边看资源列表的那一页）。</div>';
    }
    var rows = S.platforms.map(function (p) {
      var cnt = S.goods.filter(function (g) { return Number(g.platform_id) === Number(p.id); }).length;
      return '<div class="extc-prow" data-pid="' + p.id + '">' +
        '<div class="extc-pmain"><b>' + esc(p.name) + ' <i class="extc-cnt">' + cnt + ' 条资源</i></b>' +
        '<span class="extc-plink">' + esc(p.mall_url || '（没填商城地址，采集不了）') + '</span></div>' +
        '<div class="extc-pops">' +
        '<button type="button" class="extc-mini" data-act="runpf">采集</button>' +
        '<button type="button" class="extc-mini" data-act="gopf">打开</button>' +
        '<button type="button" class="extc-mini" data-act="editpf">改</button>' +
        '<button type="button" class="extc-mini danger" data-act="delpf">删</button>' +
        '</div></div>';
    }).join('');
    return '<div class="extc-plist">' + rows + '</div>';
  }

  function renderRuns() {
    if (!S.runs.length) {
      return '<div class="extc-empty">还没有采集记录。<br>点「采集」后，成功的、失败的都会记在这里；失败的能看到原因并重试。</div>';
    }
    return '<div class="extc-plist">' + S.runs.map(function (r, i) {
      var cls = r.ok ? 'ok' : 'bad';
      return '<div class="extc-prow" data-run="' + i + '">' +
        '<div class="extc-pmain"><b><span class="extc-badge ' + cls + '">' + (r.ok ? '成功' : '失败') + '</span> ' + esc(r.name) + '</b>' +
        '<span class="extc-plink">' + esc(r.at) + ' · ' + esc(r.msg) + '</span></div>' +
        '<div class="extc-pops">' +
        (r.ok ? '' : '<button type="button" class="extc-mini" data-act="retry" data-i="' + i + '">重试</button>') +
        (r.ok ? '<button type="button" class="extc-mini" data-act="seeRun" data-i="' + i + '">看资源</button>' : '') +
        '</div></div>';
    }).join('') + '</div>';
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
      if (!confirm('从资源池删掉这条？（不影响对方平台）')) return;
      api('admin/external', { method: 'POST', body: { op: 'goods.del', id: id } }).then(function (r) {
        if (r && r.ok) { delete S.sel[id]; S.goods = S.goods.filter(function (g) { return Number(g.id) !== id; }); render(); }
        else toast((r && r.msg) || '删除失败', 'error');
      });
      return;
    }
    if (act === 'delbatch') {
      var ids = selIds();
      if (!ids.length) return;
      if (!confirm('删掉选中的 ' + ids.length + ' 条？')) return;
      Promise.all(ids.map(function (x) { return api('admin/external', { method: 'POST', body: { op: 'goods.del', id: x } }); })).then(function () {
        S.goods = S.goods.filter(function (g) { return ids.indexOf(Number(g.id)) < 0; });
        S.sel = {}; render(); toast('已删除 ' + ids.length + ' 条', 'success');
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
        if (!confirm('删除平台「' + p.name + '」？（采来的资源会转成未归平台，不会丢）')) return;
        api('admin/external', { method: 'POST', body: { op: 'platform.del', id: p.id } }).then(function (r) {
          if (r && r.ok) {
            S.platforms = S.platforms.filter(function (x) { return Number(x.id) !== Number(p.id); });
            if (Number(S.curPf) === Number(p.id)) S.curPf = 0;
            loadGoods(); toast('已删除', 'success');
          } else toast((r && r.msg) || '删除失败', 'error');
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
    var p = S.platforms.filter(function (x) { return Number(x.id) === Number(S.curPf); })[0];
    if (!p) { toast('先在左上选一个平台', 'error'); return; }
    if (!p.mall_url) { toast('这个平台还没填商城地址，去「我的平台 → 改」补一下', 'error'); return; }
    S.busy = true; S.hint = '正在采集…（最多 20 秒）'; render();
    var btn = S.mask && S.mask.querySelector('#extcRun');
    if (btn) { btn.disabled = true; btn.textContent = '采集中…'; }
    api('admin/external', { method: 'POST', body: { op: 'collect', platform_id: p.id } }).then(function (r) {
      S.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '采集'; }
      if (r && r.ok) {
        S.hint = '抓到 ' + r.found + ' 条，新入库 ' + r.added + ' 条' + (r.dup ? '，已有 ' + r.dup + ' 条' : '') + (r.fixed_addr ? '（地址已自动换成 ' + r.fixed_addr + '）' : '');
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

  function openPlatform() {
    var p = S.platforms.filter(function (x) { return Number(x.id) === Number(S.curPf); })[0];
    if (!p) { toast('先选一个平台', 'error'); return; }
    var u = p.login_url || p.mall_url;
    if (!u) { toast('这个平台还没填地址', 'error'); return; }
    window.open(u, '_blank', 'noopener');
  }

  /* ================= 上架：关掉本弹窗 + 打开系统的「新增资源」 ================= */
  function goEdit(g, detailHtml) {
    var payload = {
      title: g.title || '',
      desc: '',
      detail: detailHtml || g.detail_html || '',
      img: g.cover || '',
      coverImages: g.cover ? [g.cover] : [],
      price: '',
      sort: 0,
      is_online: 1
    };
    close();
    setTimeout(function () {
      if (typeof window.__openEdit !== 'function') { toast('打不开新增资源，请刷新后台再试', 'error'); return; }
      window.__openEdit(payload);
      toast('已填好标题、封面和详情，补上分类和价格点确定就行', 'info');
    }, 220);
    api('admin/external', { method: 'POST', body: { op: 'goods.use', id: g.id, product_id: 0 } }).then(function () {
      S.goods.forEach(function (x) { if (Number(x.id) === Number(g.id)) x.status = 'used'; });
    });
  }

  function useGoods(id) {
    var g = S.goods.filter(function (x) { return Number(x.id) === id; })[0];
    if (!g) return;
    if (g.detail_html) { goEdit(g, g.detail_html); return; }
    if (!g.src_url) { goEdit(g, ''); return; }
    toast('正在抓这条的详情长图…', 'info');
    api('admin/external', { method: 'POST', body: { op: 'find.one', url: g.src_url } }).then(function (r) {
      var html = '';
      if (r && r.ok && r.media && r.media.length) {
        html = r.media.filter(function (u) { return u !== g.cover; }).slice(0, 20)
          .map(function (u) { return '<p><img src="' + u + '"></p>'; }).join('');
        api('admin/external', { method: 'POST', body: { op: 'goods.update', id: g.id, detail_html: html } });
        g.detail_html = html;
      }
      goEdit(g, html);
    });
  }

  function useBatch(ids) {
    ids = (ids || []).filter(Boolean);
    if (!ids.length) { toast('先选资源', 'error'); return; }
    if (ids.length > 1) toast('批量会一条条打开「新增资源」，先做第 1 条', 'info');
    var g = S.goods.filter(function (x) { return Number(x.id) === Number(ids[0]); })[0];
    if (g) useGoods(Number(g.id));
  }

  /* ================= 粘贴（两条路）================= */
  function pasteForm() {
    var pid = Number(S.curPf) || 0;
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
      '<input class="input" id="paUrl" placeholder="https://...">' +
      '<div class="extc-formhint">我去抓这一条的标题、封面和详情图。前端渲染的站抓不到时会提示改用「粘整页内容」。</div>' +
      '</div>' +
      '<div id="paRichBox" style="display:none">' +
      '<label>粘到这里</label>' +
      '<textarea class="input extc-pastearea" id="paRich" placeholder="在对方资源页按 Ctrl+A 全选、Ctrl+C 复制，然后点这里 Ctrl+V"></textarea>' +
      '<div class="extc-formhint">会从粘进来的内容里提标题和图片，小图标自动过滤。</div>' +
      '</div>' +
      '<div class="extc-formhint" id="paTip"></div>',
      '<button class="modal-inner-btn" id="paSave">加进资源池</button><button class="modal-close" data-x="1">关闭</button>');

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
      setTimeout(function () { if (btn.disabled) btn.textContent = '还在处理，请稍候…'; }, 6000);
      var pfId = Number(m.querySelector('#paPf').value) || 0;
      var tip = m.querySelector('#paTip');
      if (tab === 'link') {
        var url = m.querySelector('#paUrl').value.trim();
        if (!/^https?:\/\//i.test(url)) { toast('地址要以 http 开头', 'error'); return; }
        btn.disabled = true; btn.textContent = '抓取中…';
        tip.textContent = '正在抓这一条…';
        api('admin/external', { method: 'POST', body: { op: 'find.one', url: url } }).then(function (r) {
          btn.disabled = false; btn.textContent = '加进资源池';
          if (!r || !r.ok) { tip.textContent = (r && r.msg) || '抓不到'; return; }
          var media = (r.media || []).filter(function (u) { return u !== r.cover; });
          api('admin/external', { method: 'POST', body: { op: 'goods.add', platform_id: pfId, title: r.title, cover: r.cover, src_url: url, media: media } }).then(function (r2) {
            if (r2 && r2.ok) { toast(r2.dup ? '资源池里已经有了' : '已加进资源池', 'success'); closeM(m); loadGoods(); }
            else toast((r2 && r2.msg) || '保存失败', 'error');
          });
        });
      } else {
        var got2 = P.lastClip;
        if (!got2 || (!got2.title && !got2.media.length)) { tip.textContent = '先在上面的框里 Ctrl+V 粘一下内容'; return; }
        btn.disabled = true; btn.textContent = '保存中…';
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
    mkModal('extcSeeMask', '看资源', 'modal-wide',
      '<div class="extc-formhint"><b>' + esc(g.title) + '</b><br>' + esc(g.platform || '未归平台') +
      (g.src_url ? '<br><a href="' + esc(g.src_url) + '" target="_blank" rel="noopener">去原页面看</a>' : '') + '</div>' +
      '<div class="extc-seeimgs">' + (uniq.length
        ? uniq.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" referrerpolicy="no-referrer" loading="lazy" onerror="this.parentNode.remove()"></a>'; }).join('')
        : '<div class="extc-formhint">这条还没抓到详情图，上架时会去抓。</div>') + '</div>',
      '<button class="modal-close" data-x="1">关闭</button>');
  }

  function editForm(id) {
    var g = S.goods.filter(function (x) { return Number(x.id) === id; })[0];
    if (!g) return;
    var m = mkModal('extcEditMask', '改资源', '',
      '<label>标题</label><input class="input" id="edTitle" maxlength="90" value="' + esc(g.title || '') + '">' +
      '<label>封面图地址</label><input class="input" id="edCover" value="' + esc(g.cover || '') + '">' +
      (g.cover ? '<div class="extc-coverpreview"><img src="' + esc(g.cover) + '" referrerpolicy="no-referrer" onerror="this.remove()"></div>' : '') +
      '<label>原页面地址（上架时拿它抓详情图）</label><input class="input" id="edUrl" value="' + esc(g.src_url || '') + '">' +
      '<div class="extc-formhint">详情图不用手填：点「看」能预览，上架时会按原页面地址去抓。</div>',
      '<button class="modal-inner-btn" id="edSave">确定</button><button class="modal-close" data-x="1">关闭</button>');
    m.querySelector('#edSave').addEventListener('click', function () {
      var btn = this; btn.disabled = true; btn.textContent = '保存中…';
      api('admin/external', {
        method: 'POST',
        body: {
          op: 'goods.update', id: id,
          title: m.querySelector('#edTitle').value.trim(),
          cover: m.querySelector('#edCover').value.trim(),
          src_url: m.querySelector('#edUrl').value.trim()
        }
      }).then(function (r) {
        btn.disabled = false; btn.textContent = '确定';
        if (r && r.ok) {
          g.title = m.querySelector('#edTitle').value.trim();
          g.cover = m.querySelector('#edCover').value.trim();
          g.src_url = m.querySelector('#edUrl').value.trim();
          toast('已保存', 'success'); closeM(m); render();
        } else toast((r && r.msg) || '保存失败', 'error');
      });
    });
  }

  /* ================= 平台档案（编辑器复用系统）================= */
  function platformForm(p) {
    var isEdit = !!(p && p.id);
    var m = mkModal('extcPfMask', isEdit ? '改平台：' + esc(p.name) : '添加平台', '',
      '<label>平台名（必填）</label><input class="input" id="epName" maxlength="40" value="' + esc(isEdit ? p.name : '') + '" placeholder="比如 五湖通信">' +
      '<label>商城地址（我抓这个页面上的资源）</label><input class="input" id="epMall" maxlength="600" value="' + esc(isEdit ? (p.mall_url || '') : '') + '" placeholder="https://... 你在那边看资源列表那一页">' +
      '<div class="extc-formhint">填「资源列表」那一页，不要填登录页。填错也没关系：抓不到时我会自动试同域的其他列表页。</div>' +
      '<label>后台地址（可选，「打开平台」跳这里）</label><input class="input" id="epAdmin" maxlength="600" value="' + esc(isEdit ? (p.login_url || '') : '') + '" placeholder="https://... 登录后台用；不填就跳商城">' +
      '<label>我的说明</label>' +
      '<div id="epNoteHost"></div>' +
      '<div class="extc-formhint">写给自己看的：账号、结算规则、注意事项。支持加粗、颜色、表格、插图。</div>',
      '<button class="modal-inner-btn" id="epSave">' + (isEdit ? '确定' : '添加') + '</button><button class="modal-close" data-x="1">关闭</button>',
      function () {
        mountRte(m.querySelector('#epNoteHost'), 'epNote', isEdit ? String(p.note || '') : '', '100px');
      });

    m.querySelector('#epSave').addEventListener('click', function () {
      var ed = m.querySelector('#epNote');
      var body = {
        op: 'platform.save',
        id: isEdit ? p.id : 0,
        name: m.querySelector('#epName').value.trim(),
        mall_url: m.querySelector('#epMall').value.trim(),
        login_url: m.querySelector('#epAdmin').value.trim(),
        note: ed ? ed.innerHTML.slice(0, 20000) : ''
      };
      if (!body.name) { toast('平台名不能为空', 'error'); return; }
      var btn = this; btn.disabled = true; btn.textContent = '保存中…';
      api('admin/external', { method: 'POST', body: body }).then(function (r) {
        if (r && r.ok) {
          toast('已保存', 'success');
          if (isEdit) {
            S.platforms.forEach(function (x) {
              if (Number(x.id) === Number(p.id)) { x.name = body.name; x.note = body.note; x.mall_url = body.mall_url; x.login_url = body.login_url; }
            });
          } else if (r.id) {
            S.platforms.push({ id: r.id, name: body.name, mall_url: body.mall_url, login_url: body.login_url, note: body.note });
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
    requestAnimationFrame(function () { m.classList.add('open'); });
    if (window.syncBodyLock) window.syncBodyLock();
    m.addEventListener('click', function (e) { if (e.target === m || (e.target.closest && e.target.closest('[data-x]'))) closeM(m); });
    if (after) setTimeout(after, 30);
    return m;
  }
  function closeM(m) {
    if (!m) return;
    m.classList.remove('open');
    setTimeout(function () { m.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#openExtCollectBtn');
    if (b) { e.preventDefault(); open(); }
  });
  window.__extOpenCollect = open;
})();
