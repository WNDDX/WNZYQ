/* ===== v470 外部商品采集（老板重新定义）=====
   入口：平台设置 →「外部商品采集」按键 → 弹窗。
   用途：把别家平台商城里的商品抓过来（标题 / 封面 / 详情长图），放进商品池；
        老板挑着点「上架」，预填进「新增资源」弹窗，他补价格和分类后保存。
   价格不抓（老板自己定价）。抓不到的站（前端渲染）→ 标「暂不支持」，可用粘链接解析兜底。 */
(function () {
  'use strict';

  var S = { platforms: [], goods: [], curPf: 0, tab: 'goods', sel: {}, mask: null, busy: false, hint: '' };

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
    return fetch('/api/' + path, o).then(function (r) { return r.json(); });
  }
  function toast(m, t) { if (window.showToast) window.showToast(m, t || 'info'); }
  function selCount() { return Object.keys(S.sel).filter(function (k) { return S.sel[k]; }).length; }

  /* ---------- 弹窗骨架 ---------- */
  function open() {
    if (S.mask) { S.mask.remove(); S.mask = null; }
    var m = document.createElement('div');
    m.className = 'modal-mask'; m.id = 'extcMask';
    m.innerHTML = '<div class="modal-box extc-box" role="dialog" aria-modal="true" style="max-width:780px">' +
      '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">外部商品采集</h2>' +
      '<div class="extc-bar">' +
      '<select id="extcPf" class="extc-sel"></select>' +
      '<button type="button" class="extc-btn" id="extcOpenPf">打开平台</button>' +
      '<button type="button" class="extc-btn primary" id="extcRun">采集</button>' +
      '<span class="extc-hint" id="extcHint"></span>' +
      '</div>' +
      '<div class="extc-tabs">' +
      '<button type="button" class="extc-tab on" data-tab="goods">采集商品 <i id="extcNGoods">0</i></button>' +
      '<button type="button" class="extc-tab" data-tab="pf">我的平台 <i id="extcNPf">0</i></button>' +
      '<button type="button" class="extc-link" id="extcAddPf">+ 添加平台</button>' +
      '</div>' +
      '<div class="extc-body" id="extcBody"></div>' +
      '<div class="modal-footer"><button class="modal-close" id="extcClose">关闭</button></div>' +
      '</div>';
    document.body.appendChild(m);
    S.mask = m;
    requestAnimationFrame(function () { m.classList.add('open'); });
    if (window.syncBodyLock) window.syncBodyLock();

    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.closest('[data-x]')) close();
    });
    m.querySelector('#extcClose').addEventListener('click', close);
    m.querySelector('#extcPf').addEventListener('change', function () {
      S.curPf = Number(this.value) || 0;
      S.sel = {};
      loadGoods();
    });
    m.querySelector('#extcOpenPf').addEventListener('click', openPlatform);
    m.querySelector('#extcRun').addEventListener('click', runCollect);
    m.querySelector('#extcAddPf').addEventListener('click', function () { platformForm(null); });
    Array.prototype.forEach.call(m.querySelectorAll('.extc-tab'), function (b) {
      b.addEventListener('click', function () {
        S.tab = b.getAttribute('data-tab');
        Array.prototype.forEach.call(m.querySelectorAll('.extc-tab'), function (x) { x.classList.toggle('on', x === b); });
        render();
      });
    });
    m.querySelector('#extcBody').addEventListener('click', onBodyClick);

    loadAll();
  }

  function close() {
    if (!S.mask) return;
    var m = S.mask;
    m.classList.remove('open');
    S.mask = null;
    setTimeout(function () { m.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180);
  }

  /* ---------- 取数 ---------- */
  function loadAll() {
    return Promise.all([
      api('admin/external').catch(function () { return { ok: false }; }),
      api('admin/external', { method: 'POST', body: { op: 'goods.list', platform_id: S.curPf } }).catch(function () { return { ok: false }; })
    ]).then(function (r) {
      if (r[0] && r[0].ok) {
        S.platforms = r[0].platforms || [];
        S.me = r[0].me || null;
        if (!S.platforms.length) { S.hint = '先点右上「+ 添加平台」，填平台名和商城地址'; }
      }
      if (r[1] && r[1].ok) S.goods = r[1].goods || [];
      render();
    });
  }
  function loadGoods() {
    return api('admin/external', { method: 'POST', body: { op: 'goods.list', platform_id: S.curPf } }).then(function (r) {
      if (r && r.ok) S.goods = r.goods || [];
      render();
    });
  }

  /* ---------- 渲染 ---------- */
  function render() {
    if (!S.mask) return;
    var m = S.mask;
    var pfSel = m.querySelector('#extcPf');
    if (pfSel) {
      pfSel.innerHTML = '<option value="0">全部平台</option>' + S.platforms.map(function (p) {
        return '<option value="' + p.id + '"' + (Number(S.curPf) === Number(p.id) ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('');
      pfSel.value = String(S.curPf);
    }
    var nG = m.querySelector('#extcNGoods'); if (nG) nG.textContent = S.goods.length;
    var nP = m.querySelector('#extcNPf'); if (nP) nP.textContent = S.platforms.length;
    var hint = m.querySelector('#extcHint');
    if (hint) hint.textContent = S.hint || '';

    var body = m.querySelector('#extcBody');
    if (S.tab === 'goods') body.innerHTML = renderGoods();
    else body.innerHTML = renderPlatforms();
  }

  function renderGoods() {
    if (!S.goods.length) {
      return '<div class="extc-empty">商品池是空的。<br>选一个平台点「采集」，把那边商城的商品抓过来；抓不到的平台可以用「粘链接解析」。</div>';
    }
    var n = selCount();
    var head = '<div class="extc-tools">' +
      '<span>共 ' + S.goods.length + ' 个' + (n ? ' · 已选 ' + n + ' 个' : '') + '</span>' +
      '<span class="extc-sp"></span>' +
      '<button type="button" class="extc-btn" data-act="selall">全选</button>' +
      (n ? '<button type="button" class="extc-btn danger" data-act="delbatch">删除选中</button>' : '') +
      '</div>';
    var cards = S.goods.map(function (g) {
      var on = !!S.sel[g.id];
      var used = g.status === 'used';
      return '<div class="extc-card' + (on ? ' on' : '') + '" data-id="' + g.id + '">' +
        '<div class="extc-thumb">' + (g.cover ? '<img src="' + esc(g.cover) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '') + '</div>' +
        '<div class="extc-t">' + esc(g.title) + '</div>' +
        '<div class="extc-m">' + esc(g.platform || '') + (used ? ' · <b style="color:#1b7f3b">已上架</b>' : '') + '</div>' +
        '<div class="extc-ops">' +
        '<button type="button" class="extc-mini' + (on ? ' on' : '') + '" data-act="pick">' + (on ? '已选' : '选') + '</button>' +
        '<button type="button" class="extc-mini primary" data-act="use">上架</button>' +
        '<button type="button" class="extc-mini danger" data-act="del">删</button>' +
        '</div></div>';
    }).join('');
    return head + '<div class="extc-grid">' + cards + '</div>';
  }

  function renderPlatforms() {
    if (!S.platforms.length) {
      return '<div class="extc-empty">还没有平台。点右上「+ 添加平台」，填平台名和商城地址（就是你在那边看商品的页面）。</div>';
    }
    var rows = S.platforms.map(function (p) {
      return '<div class="extc-prow">' +
        '<div class="extc-pmain"><b>' + esc(p.name) + '</b>' +
        '<span class="extc-plink">' + esc(p.mall_url || p.domain || '（没填商城地址）') + '</span></div>' +
        '<div class="extc-pops">' +
        '<button type="button" class="extc-mini" data-act="gopf">打开</button>' +
        '<button type="button" class="extc-mini" data-act="editpf">编辑</button>' +
        '<button type="button" class="extc-mini danger" data-act="delpf">删</button>' +
        '</div></div>';
    }).join('');
    return '<div class="extc-plist">' + rows + '</div>';
  }

  /* ---------- 交互 ---------- */
  function onBodyClick(e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    var card = b.closest('.extc-card');
    var id = card ? Number(card.getAttribute('data-id')) : 0;

    if (act === 'selall') {
      var allOn = S.goods.every(function (g) { return S.sel[g.id]; });
      S.goods.forEach(function (g) { S.sel[g.id] = allOn ? false : true; });
      render(); return;
    }
    if (act === 'pick') { S.sel[id] = !S.sel[id]; render(); return; }
    if (act === 'use') { useGoods(id); return; }
    if (act === 'del') {
      if (!confirm('从商品池删掉这条？（不影响对方平台）')) return;
      api('admin/external', { method: 'POST', body: { op: 'goods.del', id: id } }).then(function (r) {
        if (r && r.ok) { delete S.sel[id]; S.goods = S.goods.filter(function (g) { return Number(g.id) !== id; }); render(); }
        else toast((r && r.msg) || '删除失败', 'error');
      });
      return;
    }
    if (act === 'delbatch') {
      var ids = Object.keys(S.sel).filter(function (k) { return S.sel[k]; }).map(Number);
      if (!ids.length) return;
      if (!confirm('删掉选中的 ' + ids.length + ' 条？')) return;
      Promise.all(ids.map(function (x) { return api('admin/external', { method: 'POST', body: { op: 'goods.del', id: x } }); })).then(function () {
        S.goods = S.goods.filter(function (g) { return ids.indexOf(Number(g.id)) < 0; });
        S.sel = {}; render(); toast('已删除 ' + ids.length + ' 条', 'success');
      });
      return;
    }
    if (act === 'gopf') {
      var pid = Number(b.closest('.extc-prow') && b.closest('.extc-prow').querySelector('[data-pid]') ? 0 : 0);
      var row = b.closest('.extc-prow');
      var idx = Array.prototype.indexOf.call(row.parentNode.children, row);
      var p = S.platforms[idx];
      if (p) window.open(p.mall_url || p.login_url || ('https://' + (p.domain || '')), '_blank', 'noopener');
      return;
    }
    if (act === 'editpf') {
      var row2 = b.closest('.extc-prow');
      var idx2 = Array.prototype.indexOf.call(row2.parentNode.children, row2);
      platformForm(S.platforms[idx2]);
      return;
    }
    if (act === 'delpf') {
      var row3 = b.closest('.extc-prow');
      var idx3 = Array.prototype.indexOf.call(row3.parentNode.children, row3);
      var p3 = S.platforms[idx3];
      if (!p3) return;
      if (!confirm('删除平台「' + p3.name + '」？（已采集的商品不会删）')) return;
      api('admin/external', { method: 'POST', body: { op: 'platform.del', id: p3.id } }).then(function (r) {
        if (r && r.ok) { S.platforms = S.platforms.filter(function (x) { return Number(x.id) !== Number(p3.id); }); render(); toast('已删除', 'success'); }
        else toast((r && r.msg) || '删除失败', 'error');
      });
    }
  }

  /* 上架：抓详情长图 → 预填进「新增资源」弹窗 */
  function useGoods(id) {
    var g = S.goods.filter(function (x) { return Number(x.id) === id; })[0];
    if (!g) return;
    var go = function (detailHtml) {
      close();
      if (typeof window.__openEdit !== 'function') { toast('打不开新增资源，请刷新后台再试', 'error'); return; }
      window.__openEdit({
        title: g.title,
        desc: '',
        detail: detailHtml || '',
        img: g.cover || '',
        coverImages: g.cover ? [g.cover] : [],
        is_online: 1
      });
      api('admin/external', { method: 'POST', body: { op: 'goods.use', id: id, product_id: 0 } }).then(function () {
        S.goods.forEach(function (x) { if (Number(x.id) === id) x.status = 'used'; });
      });
      toast('已填好标题和封面，价格和分类你补一下再保存', 'info');
    };
    if (!g.src_url) { go(''); return; }
    toast('正在抓详情长图…', 'info');
    api('admin/external', { method: 'POST', body: { op: 'find.one', url: g.src_url } }).then(function (r) {
      var html = '';
      if (r && r.ok && r.media && r.media.length) {
        var others = r.media.filter(function (u) { return u !== g.cover; }).slice(0, 20);
        html = others.map(function (u) { return '<p><img src="' + u + '"></p>'; }).join('');
      }
      go(html);
    }).catch(function () { go(''); });
  }

  /* 采集 */
  function runCollect() {
    if (S.busy) return;
    var p = S.platforms.filter(function (x) { return Number(x.id) === Number(S.curPf); })[0];
    if (!p) { toast('先在左上选一个平台', 'error'); return; }
    if (!p.mall_url) { toast('这个平台还没填商城地址，点「我的平台 → 编辑」补一下', 'error'); return; }
    S.busy = true; S.hint = '正在采集…（最多 15 秒）'; render();
    var btn = S.mask && S.mask.querySelector('#extcRun');
    if (btn) { btn.disabled = true; btn.textContent = '采集中…'; }
    api('admin/external', { method: 'POST', body: { op: 'collect', platform_id: p.id } }).then(function (r) {
      S.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '采集'; }
      if (r && r.ok) {
        S.hint = '抓到 ' + r.found + ' 个，新入库 ' + r.added + ' 个';
        toast('采集完成：抓到 ' + r.found + ' 个商品', 'success');
        loadGoods();
      } else {
        S.hint = (r && r.msg) || '采集失败';
        toast(S.hint, r && r.zero ? 'info' : 'error');
        render();
      }
    }).catch(function () {
      S.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '采集'; }
      S.hint = '网络开小差了，再试一次'; render();
    });
  }

  function openPlatform() {
    var p = S.platforms.filter(function (x) { return Number(x.id) === Number(S.curPf); })[0];
    if (!p) { toast('先选一个平台', 'error'); return; }
    var u = p.login_url || p.mall_url || ('https://' + (p.domain || ''));
    if (u) window.open(u, '_blank', 'noopener');
  }

  /* ---------- 平台档案弹窗（说明用轻量富文本）---------- */
  function platformForm(p) {
    var isEdit = !!(p && p.id);
    var saveSel = S.tab; S.tab = saveSel;
    var m = document.createElement('div');
    m.className = 'modal-mask'; m.id = 'extcPfMask';
    m.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" style="max-width:560px">' +
      '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">' + (isEdit ? '编辑平台：' + esc(p.name) : '添加平台') + '</h2>' +
      '<div class="form extc-form">' +
      '<label>平台名（必填）</label><input class="input" id="epName" maxlength="40" value="' + esc(isEdit ? p.name : '') + '" placeholder="比如 五湖通信">' +
      '<label>商城地址（我抓这个页面上的商品）</label><input class="input" id="epMall" maxlength="600" value="' + esc(isEdit ? (p.mall_url || '') : '') + '" placeholder="https://... 就是你平时看商品列表那一页">' +
      '<div class="extc-formhint">填你在那边「看商品列表」的页面地址，我照着它抓商品。</div>' +
      '<label>后台地址（可选，「打开平台」跳这里）</label><input class="input" id="epAdmin" maxlength="600" value="' + esc(isEdit ? (p.login_url || '') : '') + '" placeholder="https://... 登录后台/看订单用；不填就跳商城">' +
      '<label>我的说明</label>' +
      '<div class="extc-rte-tools">' +
      '<button type="button" data-cmd="bold"><b>B</b></button>' +
      '<button type="button" data-cmd="italic"><i>I</i></button>' +
      '<button type="button" data-cmd="insertUnorderedList">• 列表</button>' +
      '<button type="button" data-cmd="createLink">链接</button>' +
      '<button type="button" data-cmd="removeFormat">清格式</button>' +
      '</div>' +
      '<div class="extc-rte" id="epNote" contenteditable="true" data-placeholder="例如：账号 138xxxx；价格在后台「商品管理」里改；每月 1 号结算…">' + (isEdit ? String(p.note || '') : '') + '</div>' +
      '</div>' +
      '<div class="modal-footer"><button class="modal-inner-btn" id="epSave">' + (isEdit ? '保存' : '添加') + '</button>' +
      '<button class="modal-close" data-x="1">取消</button></div></div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('open'); });

    function closePf() { m.classList.remove('open'); setTimeout(function () { m.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180); }
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-x]')) closePf(); });

    /* 轻量编辑器工具条 */
    Array.prototype.forEach.call(m.querySelectorAll('.extc-rte-tools [data-cmd]'), function (b) {
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () {
        var cmd = b.getAttribute('data-cmd');
        var editor = m.querySelector('#epNote');
        editor.focus();
        if (cmd === 'createLink') {
          var url = prompt('链接地址（https:// 开头）', 'https://');
          if (url && /^https?:/i.test(url)) document.execCommand('createLink', false, url);
        } else {
          document.execCommand(cmd, false, null);
        }
      });
    });
    /* 粘贴成纯文本，避免把外部样式带进来 */
    m.querySelector('#epNote').addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });

    m.querySelector('#epSave').addEventListener('click', function () {
      var body = {
        op: 'platform.save',
        id: isEdit ? p.id : 0,
        name: m.querySelector('#epName').value.trim(),
        mall_url: m.querySelector('#epMall').value.trim(),
        login_url: m.querySelector('#epAdmin').value.trim(),
        note: m.querySelector('#epNote').innerHTML.slice(0, 20000)
      };
      if (!body.name) { toast('平台名不能为空', 'error'); return; }
      var btn = this; btn.disabled = true; btn.textContent = '保存中…';
      api('admin/external', { method: 'POST', body: body }).then(function (r) {
        if (r && r.ok) {
          toast('已保存', 'success');
          /* v470b：保存成功先就地更新本地列表并重绘，不等 loadAll 回刷 ——
             实测「等回刷」时弹窗关得晚、下拉还是旧的，看着像没保存成功。 */
          if (isEdit) {
            S.platforms.forEach(function (x) {
              if (Number(x.id) === Number(p.id)) { x.name = body.name; x.note = body.note; x.mall_url = body.mall_url; x.login_url = body.login_url; }
            });
          } else if (r.id) {
            S.platforms.push({ id: r.id, name: body.name, mall_url: body.mall_url, login_url: body.login_url, note: body.note });
          }
          closePf();
          render();
          loadAll();
        } else {
          toast((r && r.msg) || '保存失败', 'error');
          btn.disabled = false; btn.textContent = isEdit ? '保存' : '添加';
        }
      }).catch(function () {
        toast('网络开小差了，再试一次', 'error');
        btn.disabled = false; btn.textContent = isEdit ? '保存' : '添加';
      });
    });
  }

  /* 入口 */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#openExtCollectBtn');
    if (b) { e.preventDefault(); open(); }
  });
  window.__extOpenCollect = open;
})();
