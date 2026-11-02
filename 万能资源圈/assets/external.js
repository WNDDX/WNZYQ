/* ===== v459 外部链接台账（后台「外部链接」页签）=====
   老板场景：在别家平台卖货，卖出的在对方平台结算 → 这里存「能直达那件商品的详情页」，
   只记标题 / 封面 / 描述（文字 + 图或视频链接），不取价格。
   取信息两条路：公开站服务端取（后续接入）；要登录的平台靠 Ctrl+V 粘贴（浏览器会带富文本 HTML，图不会丢）。
   状态四档 + 关键词判定在后端（已售出 / 已下架 / 链接失效 / 待核对 / 在售）。 */
(function () {
  'use strict';

  var S = { platforms: [], links: [], counts: {}, curPf: 0, q: '', status: '', me: null, loaded: false };
  var STATUS = {
    onsale: { t: '在售', c: 'ok' },
    sold: { t: '已售出', c: 'sold' },
    offdown: { t: '已下架', c: 'off' },
    broken: { t: '链接失效', c: 'bad' },
    check: { t: '待核对', c: 'warn' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function api(path, opt) {
    opt = opt || {};
    var o = { method: opt.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opt.body != null) {
      var body = opt.body;
      /* v459 热修：每次写操作带一个唯一 reqId —— Cloudflare 偶尔把同一次 POST 再跑一遍，
         没有幂等键就会一条变两条（实测过）。后端凭这个键去重。 */
      if (o.method === 'POST' && body && typeof body === 'object' && !body.reqId) {
        body.reqId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      }
      o.headers['Content-Type'] = 'application/json';
      o.body = JSON.stringify(body);
    }
    return fetch('/api/' + path, o).then(function (r) { return r.json(); });
  }
  function toast(msg, type) { if (window.showToast) window.showToast(msg, type || 'info'); }

  /* 时间显示：今天 09:12 / 3 天前 / 09-28 */
  function fmtWhen(s) {
    if (!s) return '未巡检';
    var t = new Date(String(s).replace(' ', 'T') + 'Z');
    if (isNaN(t.getTime())) t = new Date(String(s).replace(' ', 'T'));
    if (isNaN(t.getTime())) return String(s).slice(0, 16);
    var now = new Date(), d = Math.floor((now - t) / 86400000);
    var hh = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
    if (d <= 0) return '今天 ' + hh;
    if (d === 1) return '昨天 ' + hh;
    if (d < 30) return d + ' 天前';
    return ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  }
  function daysSince(s) {
    if (!s) return 999;
    var t = new Date(String(s).replace(' ', 'T') + 'Z');
    if (isNaN(t.getTime())) return 999;
    return Math.floor((new Date() - t) / 86400000);
  }
  function mediaList(l) {
    try { return JSON.parse(l.desc_media || '[]') || []; } catch (e) { return []; }
  }
  function descSummary(l) {
    var m = mediaList(l), img = 0, vid = 0;
    m.forEach(function (x) { if (x.t === 'video') vid++; else img++; });
    var bits = [];
    if (l.desc_text) bits.push('1 段文字');
    if (img) bits.push(img + ' 张图');
    if (vid) bits.push(vid + ' 个视频');
    return bits.length ? bits.join(' + ') : '还没有描述';
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var wrap = document.getElementById('extWrap');
    if (!wrap) return;

    var pfChips = S.platforms.map(function (p) {
      var on = Number(S.curPf) === Number(p.id);
      return '<button type="button" class="ext-chip' + (on ? ' on' : '') + '" data-pf="' + p.id + '">' +
        esc(p.name) + ' <i>' + (p.cnt || 0) + '</i></button>';
    }).join('');
    pfChips = '<button type="button" class="ext-chip' + (Number(S.curPf) === 0 ? ' on' : '') + '" data-pf="0">全部 <i>' + (S.counts.all || 0) + '</i></button>' + pfChips;

    var cur = null;
    S.platforms.forEach(function (p) { if (Number(p.id) === Number(S.curPf)) cur = p; });

    var noteCard = '';
    if (cur) {
      noteCard = '<div class="ext-note">' +
        '<div class="ext-note-hd"><b>' + esc(cur.name) + ' · 平台说明</b>' +
        '<button type="button" class="ext-linkbtn" data-pfedit="' + cur.id + '">编辑说明</button></div>' +
        (cur.note ? '<div class="ext-note-body">' + esc(cur.note).replace(/\n/g, '<br>') + '</div>'
          : '<div class="ext-note-body" style="color:var(--text-faint,#9aa9b8)">还没写说明。点「编辑说明」写一下怎么登录、去哪看订单、多久结算。</div>') +
        (cur.settle_note ? '<div class="ext-note-settle">结算：' + esc(cur.settle_note) + '</div>' : '') +
        '</div>';
    }

    var rows = S.links.map(function (l) {
      var st = STATUS[l.status] || STATUS.onsale;
      var old = daysSince(l.last_checked) >= 7;
      var cover = l.cover
        ? '<img class="ext-thumb" src="' + esc(l.cover) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'no-img\')">'
        : '';
      return '<div class="ext-row st-' + st.c + '" data-id="' + l.id + '">' +
        '<div class="ext-thumb-box">' + cover + '</div>' +
        '<div class="ext-main">' +
        '<div class="ext-title">' + (esc(l.title) || '<span style="color:#9aa9b8">（没取到标题）</span>') + '</div>' +
        '<div class="ext-desc">描述：' + descSummary(l) + (l.platform && !S.curPf ? ' · ' + esc(l.platform) : '') + '</div>' +
        (l.note ? '<div class="ext-note-line">' + esc(String(l.note).split('\n').slice(-1)[0]).slice(0, 90) + '</div>' : '') +
        (l.url_ok ? '' : '<div class="ext-warn">' + esc(l.url_msg || '') + '</div>') +
        '</div>' +
        '<div class="ext-side">' +
        '<div class="ext-badge ' + st.c + '">' + st.t + '</div>' +
        '<div class="ext-when' + (old ? ' old' : '') + '">' + fmtWhen(l.last_checked) + '</div>' +
        '<div class="ext-ops">' +
        '<button type="button" class="ext-btn" data-act="open" data-id="' + l.id + '">打开</button>' +
        '<button type="button" class="ext-btn" data-act="edit" data-id="' + l.id + '">更新</button>' +
        '<button type="button" class="ext-btn danger" data-act="del" data-id="' + l.id + '">删除</button>' +
        '</div></div></div>';
    }).join('');

    wrap.innerHTML =
      '<div class="ext-pfbar">' + pfChips +
      '<button type="button" class="ext-chip ghost" id="extAddPf">+ 加平台</button>' +
      '<button type="button" class="btn-blue btn-inline-pd" id="extAddLink" style="margin-left:auto">+ 登记链接</button></div>' +
      noteCard +
      '<div class="ext-toolbar">' +
      '<input id="extQ" class="ext-search" placeholder="搜标题 / 备注 / 链接" value="' + esc(S.q) + '">' +
      '<select id="extStatus" class="ext-sel">' +
      '<option value="">全部状态</option>' +
      ['onsale', 'sold', 'offdown', 'broken', 'check'].map(function (k) {
        return '<option value="' + k + '"' + (S.status === k ? ' selected' : '') + '>' + STATUS[k].t + '</option>';
      }).join('') + '</select></div>' +
      '<div class="ext-list">' + (rows || '<div class="ext-empty">还没有登记链接。点右上「+ 登记链接」，把商品页 Ctrl+A、Ctrl+C，粘到弹窗的框里就行。</div>') + '</div>';

    /* 事件 */
    wrap.querySelectorAll('[data-pf]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.curPf = Number(this.getAttribute('data-pf')) || 0;
        load();
      });
    });
    var addPf = wrap.querySelector('#extAddPf');
    if (addPf) addPf.addEventListener('click', function () { platformForm(null); });
    wrap.querySelectorAll('[data-pfedit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(this.getAttribute('data-pfedit'));
        var p = S.platforms.filter(function (x) { return Number(x.id) === id; })[0];
        platformForm(p || null);
      });
    });
    var addLink = wrap.querySelector('#extAddLink');
    if (addLink) addLink.addEventListener('click', function () { linkForm(null); });

    var qEl = wrap.querySelector('#extQ');
    var qt = 0;
    if (qEl) qEl.addEventListener('input', function () {
      var v = this.value;
      clearTimeout(qt);
      qt = setTimeout(function () { S.q = v; load(); }, 320);
    });
    var stEl = wrap.querySelector('#extStatus');
    if (stEl) stEl.addEventListener('change', function () { S.status = this.value; load(); });

    wrap.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(this.getAttribute('data-id'));
        var act = this.getAttribute('data-act');
        var l = S.links.filter(function (x) { return Number(x.id) === id; })[0];
        if (!l) return;
        if (act === 'open') {
          try { window.open(l.url, '_blank', 'noopener'); } catch (e) { location.href = l.url; }
          api('admin/external', { method: 'POST', body: { op: 'link.touch', id: id } }).then(function () { l.last_checked = new Date().toISOString(); });
        } else if (act === 'edit') linkForm(l);
        else if (act === 'del') {
          if (!confirm('删除「' + (l.title || '这条链接') + '」？')) return;
          api('admin/external', { method: 'POST', body: { op: 'link.del', id: id } }).then(function (r) {
            if (r && r.ok) { toast('已删除', 'success'); load(); }
            else toast((r && r.msg) || '删除失败', 'error');
          });
        }
      });
    });
  }

  /* ---------- 平台档案弹窗 ---------- */
  function platformForm(p) {
    var isEdit = !!(p && p.id);
    var m = document.createElement('div');
    m.className = 'modal-mask'; m.id = 'extPfMask';
    m.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" style="max-width:520px">' +
      '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">' + (isEdit ? '编辑平台：' + esc(p.name) : '添加平台') + '</h2>' +
      '<div class="form">' +
      '<label>平台名（必填）</label><input class="input" id="pfName" maxlength="40" value="' + esc(isEdit ? p.name : '') + '" placeholder="比如 闲鱼">' +
      '<label>域名（用来认链接，可留空）</label><input class="input" id="pfDomain" maxlength="80" value="' + esc(isEdit ? p.domain : '') + '" placeholder="比如 goofish.com">' +
      '<label>登录入口（可留空）</label><input class="input" id="pfLogin" maxlength="500" value="' + esc(isEdit ? p.login_url : '') + '" placeholder="https://...">' +
      '<label>我的说明（自己写，随时可改）</label><textarea class="input" id="pfNote" rows="4" maxlength="2000" placeholder="登录后到「我的xx → 我卖出的」核对；每月 1 号结算；链接要取详情页...">' + esc(isEdit ? p.note : '') + '</textarea>' +
      '<label>结算说明（可留空）</label><input class="input" id="pfSettle" maxlength="300" value="' + esc(isEdit ? p.settle_note : '') + '" placeholder="比如 每月 1 号，T+1 到账">' +
      '</div>' +
      '<div class="modal-footer"><button class="modal-inner-btn" id="pfSave">' + (isEdit ? '保存' : '添加') + '</button>' +
      (isEdit ? '<button class="modal-close" id="pfDel" style="color:#c62828">删除平台</button>' : '') +
      '<button class="modal-close" data-x="1">取消</button></div></div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('open'); });

    function close() { m.classList.remove('open'); setTimeout(function () { m.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180); }
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-x]')) close(); });

    m.querySelector('#pfSave').addEventListener('click', function () {
      var body = {
        op: 'platform.save',
        id: isEdit ? p.id : 0,
        name: m.querySelector('#pfName').value.trim(),
        domain: m.querySelector('#pfDomain').value.trim(),
        login_url: m.querySelector('#pfLogin').value.trim(),
        note: m.querySelector('#pfNote').value,
        settle_note: m.querySelector('#pfSettle').value.trim()
      };
      if (!body.name) { toast('平台名不能为空', 'error'); return; }
      var btn = this; btn.disabled = true; btn.textContent = '保存中…';
      api('admin/external', { method: 'POST', body: body }).then(function (r) {
        if (r && r.ok) { toast('已保存', 'success'); close(); load(true); }
        else { toast((r && r.msg) || '保存失败', 'error'); btn.disabled = false; btn.textContent = isEdit ? '保存' : '添加'; }
      });
    });
    var delBtn = m.querySelector('#pfDel');
    if (delBtn) delBtn.addEventListener('click', function () {
      if (!confirm('删除平台「' + p.name + '」？下面还有链接的话要先删链接。')) return;
      api('admin/external', { method: 'POST', body: { op: 'platform.del', id: p.id } }).then(function (r) {
        if (r && r.ok) { toast('已删除', 'success'); close(); S.curPf = 0; load(true); }
        else toast((r && r.msg) || '删除失败', 'error');
      });
    });
  }

  /* ---------- 状态关键词判定（与后端同一张表，顺序=优先级）----------
     老板拍板：已售出全靠页面文字判断。粘贴后本地先判一次，省得自己选状态。 */
  var KW = {
    sold: ['已售出', '已卖出', '已售完', '卖掉啦', '已经卖出', '宝贝已卖出', '此商品已售出', '交易成功', '交易完成', '已成交',
      '订单已完成', '买家已付款', '已拍下', '已被购买', '已抢光', '库存0', '库存 0', '剩余0件', '剩余 0 件'],
    deleted: ['商品不存在', '宝贝不存在', '商品已删除', '已删除', '该宝贝已被删除', '找不到该商品', '页面不存在',
      '已失效', '已过期', '该商品已失效', '商品已下架或删除'],
    offdown: ['已下架', '商品已下架', '已关闭', '已停止出售', '违规下架', '审核不通过', '已冻结', '暂不销售'],
    needlogin: ['请先登录', '请登录', '登录后查看', '需要登录', '安全验证', '滑动验证', '人机验证', '访问验证', '验证码'],
    onsale: ['立即购买', '马上抢', '加入购物车', '拍下', '立即下单', '剩余', '库存', '在售', '可购买']
  };
  var KW_ORDER = ['sold', 'deleted', 'offdown', 'needlogin', 'onsale'];
  function judgeLocal(text) {
    var t = String(text || '');
    if (!t) return null;
    for (var i = 0; i < KW_ORDER.length; i++) {
      var k = KW_ORDER[i], arr = KW[k];
      for (var j = 0; j < arr.length; j++) {
        if (t.indexOf(arr[j]) >= 0) {
          var st = k === 'deleted' ? 'offdown' : (k === 'needlogin' ? 'check' : k);
          return { status: st, hit: arr[j] };
        }
      }
    }
    return null;
  }

  /* ---------- 粘贴解析：从富文本 HTML 里取标题 / 封面 / 描述图或视频 ---------- */
  var BAD_IMG = /(icon|logo|avatar|sprite|placeholder|loading|blank|1x1|spacer|qrcode|qr_)/i;
  function absolutize(u, base) {
    u = String(u || '').trim();
    if (!u || /^data:/i.test(u) || /^javascript:/i.test(u)) return '';
    if (/^\/\//.test(u)) return 'https:' + u;
    if (/^https?:\/\//i.test(u)) return u;
    try { return new URL(u, base || location.origin).href; } catch (e) { return ''; }
  }
  function parsePaste(html, text, base) {
    var out = { title: '', cover: '', desc: '', media: [] };
    var imgs = [], vids = [];

    if (html) {
      try {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var t = (doc.querySelector('title') || {}).textContent || '';
        if (t) out.title = t.trim();
        doc.querySelectorAll('img').forEach(function (im) {
          var u = absolutize(im.getAttribute('src') || im.getAttribute('data-src') || im.getAttribute('data-original'), base);
          if (!u || BAD_IMG.test(u)) return;
          imgs.push(u);
        });
        doc.querySelectorAll('video, source').forEach(function (v) {
          var u = absolutize(v.getAttribute('src') || v.getAttribute('data-src'), base);
          if (u && /\.(mp4|m3u8|mov|webm)(\?|$)/i.test(u)) vids.push(u);
        });
        /* 描述文字：取正文文本里最长的一段 */
        var bodyText = (doc.body && doc.body.textContent || '').replace(/\s+/g, ' ').trim();
        if (bodyText) out.desc = bodyText.slice(0, 1500);
      } catch (e) { /* 解析失败就退到纯文本 */ }
    }
    if (!out.desc && text) out.desc = String(text).replace(/\s+/g, ' ').trim().slice(0, 1500);
    if (!out.title && text) {
      var first = String(text).split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s && s.length > 4; })[0] || '';
      if (first) out.title = first.slice(0, 80);
    }
    /* 纯文本里如果有孤立链接，也收进来当媒体（有些平台复制只带文字链接） */
    if (text) {
      var links = String(text).match(/https?:\/\/[^\s"'<>)]+/g) || [];
      links.forEach(function (u) {
        if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u)) imgs.push(u);
        else if (/\.(mp4|m3u8|webm)(\?|$)/i.test(u)) vids.push(u);
      });
    }
    /* 去重 + 限量 */
    var seen = {};
    imgs = imgs.filter(function (u) { if (seen[u]) return false; seen[u] = 1; return true; }).slice(0, 12);
    seen = {};
    vids = vids.filter(function (u) { if (seen[u]) return false; seen[u] = 1; return true; }).slice(0, 3);
    out.cover = imgs[0] || '';
    out.media = imgs.map(function (u) { return { t: 'image', u: u }; })
      .concat(vids.map(function (u) { return { t: 'video', u: u }; }));
    return out;
  }

  /* ---------- 登记 / 更新弹窗 ---------- */
  function linkForm(l) {
    var isEdit = !!(l && l.id);
    var cur = l || { platform_id: S.curPf, status: 'onsale', desc_media: '[]' };
    var media = mediaList(cur);

    var pfOpts = '<option value="0">（自动按域名认）</option>' + S.platforms.map(function (p) {
      return '<option value="' + p.id + '"' + (Number(cur.platform_id) === Number(p.id) ? ' selected' : '') + '>' + esc(p.name) + '</option>';
    }).join('');

    var m = document.createElement('div');
    m.className = 'modal-mask'; m.id = 'extLinkMask';
    m.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" style="max-width:600px">' +
      '<button class="modal-close-x" data-x="1" aria-label="关闭"><svg class="wn-ico" width="16" height="16"><use href="#wn-ico-x"/></svg></button>' +
      '<h2 class="modal-title">' + (isEdit ? '更新链接' : '登记链接') + '</h2>' +
      '<div class="form ext-form">' +
      '<div class="ext-paste-hint">把商品页 <b>Ctrl+A 全选 → Ctrl+C 复制</b>，然后点下面这个框按 <b>Ctrl+V</b>：标题、封面、描述里的图和视频会自动提出来。</div>' +
      '<textarea class="input ext-paste" id="lkPaste" rows="3" placeholder="在这里按 Ctrl+V 粘贴商品页内容…"></textarea>' +
      '<div class="ext-parsed" id="lkParsed"></div>' +
      '<label>所属平台</label><select class="input" id="lkPf">' + pfOpts + '</select>' +
      '<label>商品链接（必须能直达那件商品）</label><input class="input" id="lkUrl" maxlength="1200" value="' + esc(cur.url || '') + '" placeholder="https://...">' +
      '<div class="ext-urlwarn" id="lkUrlWarn"></div>' +
      '<label>备用链接（你的卖家后台该商品页，可留空）</label><input class="input" id="lkBackup" maxlength="1200" value="' + esc(cur.url_backup || '') + '">' +
      '<label>标题</label><input class="input" id="lkTitle" maxlength="300" value="' + esc(cur.title || '') + '">' +
      '<label>封面图（一个链接）</label><input class="input" id="lkCover" maxlength="1200" value="' + esc(cur.cover || '') + '">' +
      '<label>描述文字</label><textarea class="input" id="lkDesc" rows="3" maxlength="8000">' + esc(cur.desc_text || '') + '</textarea>' +
      '<label>描述里的图 / 视频（一行一个链接，按顺序）</label><textarea class="input" id="lkMedia" rows="3">' + esc(media.map(function (x) { return (x.t === 'video' ? '[视频] ' : '') + x.u; }).join('\n')) + '</textarea>' +
      '<label>状态</label><select class="input" id="lkStatus">' +
      ['onsale', 'sold', 'offdown', 'broken', 'check'].map(function (k) {
        return '<option value="' + k + '"' + (cur.status === k ? ' selected' : '') + '>' + STATUS[k].t + '</option>';
      }).join('') + '</select>' +
      '<label>备注（可留空，系统会自己追加巡检记录）</label><textarea class="input" id="lkNote" rows="2" maxlength="4000">' + esc(cur.note || '') + '</textarea>' +
      '</div>' +
      '<div class="modal-footer"><button class="modal-inner-btn" id="lkSave">' + (isEdit ? '保存' : '登记') + '</button>' +
      '<button class="modal-close" data-x="1">取消</button></div></div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('open'); });

    function close() { m.classList.remove('open'); setTimeout(function () { m.remove(); if (window.syncBodyLock) window.syncBodyLock(); }, 180); }
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-x]')) close(); });

    /* 粘贴 */
    var pasteEl = m.querySelector('#lkPaste');
    pasteEl.addEventListener('paste', function (e) {
      var cd = e.clipboardData || window.clipboardData;
      if (!cd) return;
      var html = cd.getData('text/html') || '';
      var text = cd.getData('text/plain') || '';
      if (!html && !text) return;
      e.preventDefault();
      var base = '';
      var urlEl = m.querySelector('#lkUrl');
      if (urlEl && urlEl.value) { try { base = new URL(urlEl.value).origin; } catch (er) {} }
      var got = parsePaste(html, text, base);
      if (got.title && !m.querySelector('#lkTitle').value) m.querySelector('#lkTitle').value = got.title;
      if (got.cover && !m.querySelector('#lkCover').value) m.querySelector('#lkCover').value = got.cover;
      if (got.desc && !m.querySelector('#lkDesc').value) m.querySelector('#lkDesc').value = got.desc;
      if (got.media.length && !m.querySelector('#lkMedia').value.trim()) {
        m.querySelector('#lkMedia').value = got.media.map(function (x) { return (x.t === 'video' ? '[视频] ' : '') + x.u; }).join('\n');
      }
      var stHit = judgeLocal(text + ' ' + (got.desc || '') + ' ' + got.title);
      if (stHit) {
        m.querySelector('#lkStatus').value = stHit.status;
        var lbl = (STATUS[stHit.status] || {}).t || stHit.status;
        m.querySelector('#lkParsed').innerHTML = '识别为「<b>' + lbl + '</b>」（命中「' + esc(stHit.hit) + '」）' +
          (got.media.length ? ' · 提取 ' + (got.cover ? '封面 1 张，' : '') + got.media.length + ' 个描述文件' : '');
      } else {
        m.querySelector('#lkParsed').innerHTML = got.media.length
          ? '已提取：' + (got.cover ? '封面 1 张' : '无封面') + '，描述 ' + got.media.length + ' 个文件（' + got.media.filter(function (x) { return x.t === 'image'; }).length + ' 图 / ' + got.media.filter(function (x) { return x.t === 'video'; }).length + ' 视频）'
          : '这段内容里没看出状态，也没找到图片。状态保持你选的那个。';
      }
    });

    /* 链接形态即时提示 */
    var urlEl = m.querySelector('#lkUrl');
    function checkShape() {
      var v = urlEl.value.trim(), tip = m.querySelector('#lkUrlWarn');
      if (!v) { tip.textContent = ''; return; }
      var bad = ['/list', '/search', '/category', '/index', '/home', '/shoplist'];
      var hasId = /[?&](id|goods_id|itemId|item_id)=/i.test(v);
      var hitBad = bad.some(function (b) { return v.toLowerCase().indexOf(b) > 0; }) && !hasId;
      var good = /(\/item|\/goods|\/product|\/detail|\/p\/)/i.test(v) || hasId;
      if (hitBad) { tip.textContent = '这看着是列表页/搜索页，不是商品详情页 —— 结算会对不上'; tip.className = 'ext-urlwarn bad'; }
      else if (!good) { tip.textContent = '看不出是商品详情页，确认一下地址栏那条是不是商品页'; tip.className = 'ext-urlwarn warn'; }
      else { tip.textContent = ''; tip.className = 'ext-urlwarn'; }
    }
    urlEl.addEventListener('input', checkShape);
    checkShape();

    m.querySelector('#lkSave').addEventListener('click', function () {
      var mediaLines = m.querySelector('#lkMedia').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var mediaArr = mediaLines.map(function (s) {
        var isVid = /^\[视频\]/.test(s);
        return { t: isVid ? 'video' : 'image', u: s.replace(/^\[视频\]\s*/, '') };
      }).filter(function (x) { return /^https?:\/\//i.test(x.u); });

      var body = {
        op: isEdit ? 'link.update' : 'link.add',
        id: isEdit ? l.id : 0,
        platform_id: Number(m.querySelector('#lkPf').value) || 0,
        url: m.querySelector('#lkUrl').value.trim(),
        url_backup: m.querySelector('#lkBackup').value.trim(),
        title: m.querySelector('#lkTitle').value.trim(),
        cover: m.querySelector('#lkCover').value.trim(),
        desc_text: m.querySelector('#lkDesc').value,
        desc_media: JSON.stringify(mediaArr),
        note: m.querySelector('#lkNote').value,
        status: m.querySelector('#lkStatus').value
      };
      if (!body.url) { toast('商品链接不能为空', 'error'); return; }
      var btn = this; btn.disabled = true; btn.textContent = '保存中…';
      api('admin/external', { method: 'POST', body: body }).then(function (r) {
        if (r && r.ok) {
          toast('已保存', 'success');
          close();
          if (r.url_warn) setTimeout(function () { toast(r.url_warn, 'info'); }, 300);
          load(true);
        } else {
          toast((r && r.msg) || '保存失败', 'error');
          btn.disabled = false; btn.textContent = isEdit ? '保存' : '登记';
        }
      });
    });
  }

  /* ---------- 取数 ---------- */
  function load(force) {
    if (S.loaded && !force && !S.q && !S.status) { render(); }
    var qs = [];
    if (S.curPf) qs.push('platform=' + S.curPf);
    if (S.status) qs.push('status=' + encodeURIComponent(S.status));
    if (S.q) qs.push('q=' + encodeURIComponent(S.q));
    return api('admin/external' + (qs.length ? '?' + qs.join('&') : '')).then(function (r) {
      if (!r || !r.ok) {
        var wrap = document.getElementById('extWrap');
        if (wrap) wrap.innerHTML = '<div class="ext-empty">' + esc((r && r.msg) || '加载失败，请刷新重试') + '</div>';
        return;
      }
      S.platforms = r.platforms || [];
      S.links = r.links || [];
      S.counts = r.counts || {};
      S.me = r.me || null;
      S.loaded = true;
      render();
    }).catch(function () {
      var wrap = document.getElementById('extWrap');
      if (wrap) wrap.innerHTML = '<div class="ext-empty">网络开小差了，请稍后再试</div>';
    });
  }

  function boot() {
    if (!document.getElementById('extWrap')) return;
    load(true);
  }
  window.__extBoot = boot;

  /* 点页签时启动（admin-1 的 switchTab 负责显示面板） */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('.tab[data-tab="external"]');
    if (t) setTimeout(boot, 60);
  });
})();
