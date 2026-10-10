/* v346 条1/12：后台按功能拆分 第5/5 段（由原 admin.js 物理切分；为支持拆分，已去掉最外层"圈屋"包裹，逻辑与拆分前一致） */
// ---------- R92 绑定设备管理（一机一码）----------
    // 打开绑定设备清单弹窗：复用 modal-mask 弹窗外壳 + 统计表样式（全系统统一观感）
    var _bindingsVariant = null;
    // R114（无感预载）：登录后随产品列表一起静默预载全部类型绑定数据，点「绑定 N」徽章
    // 弹窗即开即显；打开后仍后台刷新一次保最新（refreshBindings 成功会回写缓存）。
    var __bindingsCache = {};
    function __saveBindingsCache() { try { sessionStorage.setItem('wnzyq_admin_bindings', JSON.stringify(__bindingsCache)); } catch (e) { if (window.__silent) window.__silent(e); } }
    function __loadBindingsCache() { try { var b = JSON.parse(sessionStorage.getItem('wnzyq_admin_bindings') || '{}'); if (b && Object.keys(b).length) __bindingsCache = b; } catch (e) { if (window.__silent) window.__silent(e); } }
    function prefetchBindings() {
      api('admin/bindings?prefetch=1').then(function (res) {
        if (res && res.ok && res.map) { __bindingsCache = res.map; __saveBindingsCache(); }
      });
    }
    var _bindingsPage = 1; /* R223：合并平铺表当前页（弹窗内翻页不关弹窗） */
    function openBindings(v) {
      _bindingsVariant = v;
      _bindingsPage = 1; /* R223：每次打开回到第 1 页 */
      document.getElementById('bindingsTitle').textContent = '资源码详情（' + (v.name || '(未命名)') + '）';
      document.getElementById('bindingsMask').classList.add('open');
      /* R241：滚动位置按「弹窗 × 类型」独立（页码仍走 R223 每次回第 1 页，互不影响） */
      if (window.__modalScroll) __modalScroll.open(document.getElementById('bindingsMask'), v.id);
      var _hit = __bindingsCache[v.id];
      if (_hit) renderBindings(_hit); // 命中预载缓存：内容立即上屏，零等待
      else {
        /* R231 条28（用户 09-21 23:38）：加载态复用统计表 tr 骨架（renderStatSkeleton 同款灰线；bindings 表同为 .stat-table 7 列） */
        var _bTb = document.getElementById('bindingsRows');
        _bTb.innerHTML = '';
        var _bFrag = document.createDocumentFragment();
        for (var _bi = 0; _bi < 20; _bi++) {  // v302（用户 10-05 00:09）：骨架统一20条
          var _bTr = document.createElement('tr');
          _bTr.className = 'skel admin-skel';
          _bTr.setAttribute('aria-hidden', 'true');
          var _bCells = '';
          for (var _bc = 0; _bc < 7; _bc++) _bCells += '<td><span class="sk-line' + (_bc === 0 ? ' w70' : ' w95') + '"></span></td>';
          _bTr.innerHTML = _bCells;
          _bFrag.appendChild(_bTr);
        }
        _bTb.appendChild(_bFrag);
        // R289：缓存未命中时才后台刷新；命中预载缓存时零请求
        refreshBindings(v.id);
      }
    }
    /* R223（老板定稿·资源码与绑定合并平铺表）：一行 = 一台绑定设备，码三列（资源码/有效状态/发放时间）
       R224（老板 17:48）：状态+剩余有效两列合一——删「剩余有效」列，「状态」改名「有效状态」，
       内容三值：已绑定（绿 #2e7d32）/ 剩 N 天（蓝 #1e88e5）/ 已过期（灰 #999），不加粗。
       每行填满该设备所用码的信息；一码绑 N 台 = N 行同码相邻；未绑定的码（待用/过期）独占一行设备列显「—」；
       R221 上线前的存量老绑定查不到发码记录，码列显示「早期绑定」（灰小字，不留空白）。
       排序：发放时间倒序；老绑定行排最后（按绑定时间倒序）。每页 20 条，复用全站 buildUniPager。 */
    var _bindingsMerged = [];
    function __buildBindingsMerged(res) {
      var rows = res.list || [];
      var issues = res.issues || [];
      var byCode = {};
      issues.forEach(function (it) { byCode[String(it.code).toLowerCase()] = it; });
      var merged = [];
      // 码侧行（发放时间倒序，由后端排序保证）
      issues.forEach(function (it) {
        var bs = rows.filter(function (r) { return String(r.code || '').toLowerCase() === String(it.code).toLowerCase(); });
        if (!bs.length) { merged.push({ issue: it, binding: null }); return; }
        bs.forEach(function (b) { merged.push({ issue: it, binding: b }); });
      });
      // 老绑定（所用码不在发码记录里）→「早期绑定」行，排最后
      var legacy = rows.filter(function (r) { return !byCode[String(r.code || '').toLowerCase()]; });
      legacy.sort(function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); });
      legacy.forEach(function (b) { merged.push({ issue: null, binding: b }); });
      return merged;
    }
    function renderBindings(res) {
      var issues = res.issues || [];
      var summary = document.getElementById('bindingsSummary');
      // R223 汇总句：已绑（当前码）/上限 + 待用、已用、过期计数
      var _st = { wait: 0, used: 0, exp: 0 };
      issues.forEach(function (it) {
        if (it.status === '待用') _st.wait++;
        else if (it.status === '已用') _st.used++;
        else _st.exp++;
      });
      // R225（老板 18:13）：汇总句新文案 + 居中（HTML style 已加 text-align:center）；已用数不再单列（表内每行有状态）
      summary.textContent = '已绑定 ' + (res.cur_count || 0) + ' / 待绑定 ' + _st.wait + ' / 已过期 ' + _st.exp + ' / 资源码绑定上限 ' + res.limit;
      // R221 当前资源码展示行：点按键/码文本 = 复制旧码并发新码（复制即换码，60 天兑换窗口）
      var codeBox = document.getElementById('bindingsCode');
      var codeVal = document.getElementById('bindingsCodeVal');
      var codeCopy = document.getElementById('bindingsCodeCopy');
      if (res.code) {
        codeVal.textContent = res.code;
        codeVal.title = '点击复制并发新码';
        codeBox.style.display = 'flex';
        var _copyCode = function (ev) {
          if (ev && ev.target) ev.stopPropagation();
          if (!_bindingsVariant || !_bindingsVariant.id) {
            var ok0 = window.__shareCopyText ? window.__shareCopyText(res.code) : false;
            toast(ok0 ? '已复制' : '复制失败', ok0 ? 'success' : 'error');
            return;
          }
          /* R243 条7：发码键防连点统一（复用码面板 R231 写法） */
          if ((codeCopy && codeCopy.disabled) || (codeVal && codeVal.disabled) || window.__issueInFlight) return;
          if (codeCopy) { codeCopy.disabled = true; codeCopy.textContent = '发码中'; }
          if (codeVal) { codeVal.disabled = true; codeVal.textContent = '发码中'; }
          __issueCode(_bindingsVariant, function () {
            refreshBindings(_bindingsVariant.id);   // 换码后弹窗码值/绑定计数/发码记录同步刷新
            loadVariants(state.editingId);          // 编辑弹窗与资源列表里的码同步
          });
        };
        codeVal.onclick = _copyCode;
        codeCopy.onclick = _copyCode;
        if (codeCopy && codeCopy.textContent === '发码中') codeCopy.textContent = '复制并发新码';
      } else {
        codeBox.style.display = 'none';
      }
      _bindingsMerged = __buildBindingsMerged(res);
      renderBindingsPage();
    }
    /* R223：平铺表分页渲染（每页 20 条；翻页只刷表格不关弹窗） */
    function renderBindingsPage() {
      var PER = (window.WN_CONST && window.WN_CONST.ADMIN_PAGE_SIZE) || 20; // v346 条8：改读全站常量
      var total = _bindingsMerged.length;
      var totalPages = Math.max(1, Math.ceil(total / PER));
      if (_bindingsPage > totalPages) _bindingsPage = totalPages;
      if (_bindingsPage < 1) _bindingsPage = 1;
      var tbody = document.getElementById('bindingsRows');
      tbody.innerHTML = '';
      var pager = document.getElementById('bindingsPager');

      if (!total) {
        tbody.innerHTML = '<tr><td colspan="7">' + window.__adminEmpty('暂无资源码与绑定设备', '访客输入正确资源码后将自动绑定其设备') + '</td></tr>'; /* v356 条11：统一空态 */
        if (pager) pager.innerHTML = '';
        return;
      }
      var start = (_bindingsPage - 1) * PER;
      _bindingsMerged.slice(start, start + PER).forEach(function (m) {
        var tr = document.createElement('tr');
        var mk = function (txt) { var td = document.createElement('td'); td.textContent = txt; return td; };
        // ① 资源码：有发码记录显码（等宽字体）；老绑定查不到记录显「早期绑定」灰小字
        var tdCode = document.createElement('td');
        if (m.issue) {
          tdCode.style.cssText = 'font-family:monospace;letter-spacing:.5px;color:#1e88e5;cursor:pointer;';
          tdCode.textContent = m.issue.code;
          tdCode.title = '点击复制该资源码';
          tdCode.onclick = function (ev) {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            var _okc = window.__shareCopyText ? window.__shareCopyText(m.issue.code) : false;
            toast(_okc ? '已复制资源码 ' + m.issue.code : '复制失败', _okc ? 'success' : 'error');
          };
        } else {
          tdCode.style.cssText = 'color:var(--text-faint);font-size:12px;';
          tdCode.textContent = '早期绑定';
          tdCode.title = 'R221 复制即换码上线前的存量绑定，无发码记录';
        }
        tr.appendChild(tdCode);
        // ② 有效状态（R224 两列合一）：已绑定=绿 / 剩 N 天=蓝 / 已过期=灰，不加粗（老板点名）
        var tdStatus = document.createElement('td');
        var _spTxt = '', _spColor = '';
        if (m.binding) { _spTxt = '已绑定'; _spColor = 'var(--green-strong)'; }
        else if (m.issue && m.issue.status === '待用') { _spTxt = '剩 ' + m.issue.remaining_days + ' 天'; _spColor = '#1e88e5'; }
        else if (m.issue) { _spTxt = '已过期'; _spColor = '#999'; }
        if (_spTxt) {
          var sp = document.createElement('span');
          sp.style.color = _spColor;
          sp.textContent = _spTxt;
          tdStatus.appendChild(sp);
        } else { tdStatus.textContent = ''; }
        tr.appendChild(tdStatus);
        // ③ 发放时间
        tr.appendChild(mk(m.issue ? window.__utcToLocal(m.issue.issued_at) : ''));
        // ④⑤⑥ 设备 / 绑定时间 / 最近访问（R136 设备名合并 UA，R156 UTC→北京时间）
        /* v338 条193：时间列用 <time datetime> 语义标签（读屏与搜索引擎可读原始时间） */
        var mkTime = function (iso, txt) {
          var td = document.createElement('td');
          if (!txt) return td;
          var t = document.createElement('time');
          try { if (iso) t.setAttribute('datetime', String(iso)); } catch (e) { if (window.__silent) window.__silent(e); }
          t.textContent = txt;
          td.appendChild(t);
          return td;
        };
        tr.appendChild(mk(m.binding ? ((m.binding.device || '-') + (m.binding.ua ? ' · ' + m.binding.ua : '')) : ''));
        tr.appendChild(mkTime(m.binding ? m.binding.created_at : '', m.binding ? window.__utcToLocal(m.binding.created_at) : ''));
        tr.appendChild(mkTime(m.binding ? m.binding.last_access : '', m.binding ? window.__utcToLocal(m.binding.last_access) : ''));
        // ⑦ 操作：解绑（未绑定行显「—」）
        var tdOp = document.createElement('td');
        if (m.binding) {
          var unBtn = document.createElement('button');
          unBtn.className = 'row-btn danger';
          unBtn.textContent = '解绑';
          (function (bid) {
            unBtn.addEventListener('click', function () {
              showConfirm('解绑设备', '确定解绑该设备？解绑后此设备需重新输入资源码才能解锁（其它设备不受影响）。', function (closeConfirm) {
                api('admin/bindings/' + bid, { method: 'DELETE' }).then(function (res2) {
                  closeConfirm();
                  if (res2 && res2.ok) { toast('已解绑', 'success'); refreshBindings(_bindingsVariant && _bindingsVariant.id); loadVariants(state.editingId); }
                  else toast((res2 && res2.msg) || '解绑失败', 'error');
                }).catch(function () { closeConfirm(); toast('解绑失败，请重试', 'error'); });
              });
            });
          })(m.binding.id);
          tdOp.appendChild(unBtn);
        } else { tdOp.textContent = ''; }
        tr.appendChild(tdOp);
        tbody.appendChild(tr);
      });
      // 分页（复用全站 buildUniPager：胶囊 + 跳页；翻页不关弹窗）
      if (pager && window.buildUniPager) {
        window.buildUniPager(pager, {
          page: _bindingsPage,
          totalPages: totalPages,
          total: total,
          unit: '条',
          onPage: function (p) { _bindingsPage = p; renderBindingsPage(); }
        });
      }
    }

    // R114：后台刷新（预载缓存兜底 + 解绑/换码后保最新）；成功回写 __bindingsCache
    function refreshBindings(variantId) {
      api('admin/bindings?variant_id=' + variantId).then(function (res) {
        if (!res || !res.ok) {
          if (!__bindingsCache[variantId]) document.getElementById('bindingsRows').innerHTML = '<tr><td colspan="7" style="color:#999;">加载失败，网络开小差了</td></tr>';
          return;
        }
        __bindingsCache[variantId] = res;
        __saveBindingsCache();
        var _open = document.getElementById('bindingsMask').classList.contains('open');
        if (_open && _bindingsVariant && _bindingsVariant.id === variantId) renderBindings(res);
      });
    }

    function delVariant(id) {
      /* v330 条26：类型删除同样给 10 秒后悔时间（延迟真删，撤销零丢失） */
      var _snapV = (state.variants || []).slice();
      var _removedV = (state.variants || []).filter(function (x) { return x.id === id; })[0];
      var _rmIdx = _snapV.indexOf(_removedV);
      var _doLocalRemove = function () {
        state.variants = (state.variants || []).filter(function (x) { return x.id !== id; });
        var _dvp = (state.products || []).find(function (x) { return x.id === state.editingId; });
        if (_dvp) _dvp.variants = (state.variants || []).slice();
        var __vi = variantListEl.querySelector('.variant-item[data-vid="' + id + '"]');
        var __post7 = function () { renderVariants(); if (state.editingId) loadVariants(state.editingId); };
        if (__vi) { __vi.style.transition = 'opacity var(--dur-fast, .10s) ease'; __vi.style.opacity = '0'; setTimeout(__post7, 120); }
        else __post7();
      };
      var _restoreV = function () {
        state.variants = _snapV.slice();
        var _dvp2 = (state.products || []).find(function (x) { return x.id === state.editingId; });
        if (_dvp2) _dvp2.variants = (state.variants || []).slice();
        renderVariants();
      };
      _doLocalRemove();
      __undoable(
        '已删除类型「' + ((_removedV && _removedV.name) || '未命名') + '」',
        function () {
          if (!state.editingId) return; /* 未保存的新资源：类型只在本地，无需提交 */
          api('admin/variants/' + id, { method: 'DELETE' }).then(function (res) {
            if (res && res.ok) { if (state.editingId) loadVariants(state.editingId); }
            else { toast((res && res.msg) || '删除失败', 'error'); _restoreV(); }
          }).catch(function () { toast('删除失败，请重试', 'error'); _restoreV(); });
        },
        _restoreV
      );
      void _rmIdx; /* 保留索引备用（撤销按快照整体还原） */
    }

    variantCancel.addEventListener('click', function () { try { if (window.__fcSweepEdit) window.__fcSweepEdit(variantMask); } catch (e) {} /* v354：丢弃类型弹窗=这次传的没用上的文件追删 */ variantDraftPending = false; variantMask.classList.remove('open'); });
    variantMask.addEventListener('click', function (e) { if (e.target === variantMask) { variantDraftPending = true; variantMask.classList.remove('open'); } }); // R257（老板 09-23 19:08）：点外=暂存输入（variantDraftFor 保留，重开同类型自动恢复）；×/取消=丢弃

    function fmtDay(s) { var p = String(s || '').split('-'); return p.length >= 3 ? String(Number(p[2])) : s; } // R52：图表标签只显号数（用户要求去掉月份）
    // R62：悬浮提示的时间标签——小时数据（1天档）加「时」，日期数据显示「几月几日」
    function fmtPointLabel(day) {
      var s = String(day == null ? '' : day);
      if (s.indexOf('-') >= 0) { var p = s.split('-'); if (p.length >= 3) return Number(p[1]) + '月' + Number(p[2]) + '日'; return s; }
      var n = Number(s); return (isNaN(n) ? s : n) + '时';
    }

    // ---------- R59：折线图悬浮提示 ----------
    // 鼠标移到折线图任意位置：取最近数据点，画竖参考线 + 数值框（本期三指标具体数，有上期时括号并列上期值）
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var lineHover = { svg: null, attached: false, data: null, prev: null, hasPrev: false, stepX: 0, padL: 40, padT: 20, padB: 30, W: 800, H: 200 };
    function clearLineHover(svg) {
      var g = svg.querySelector('#lhGroup');
      if (g && g.parentNode) g.parentNode.removeChild(g);
    }
    function drawLineHover(svg, i) {
      clearLineHover(svg);
      var d = lineHover.data[i]; if (!d) return;
      var p = lineHover.prev;
      var g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('id', 'lhGroup');
      var px = lineHover.padL + i * lineHover.stepX;
      var yTop = lineHover.padT, yBot = lineHover.H - lineHover.padB;
      // 竖参考线（跟随最近数据点）
      var ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('x1', px); ln.setAttribute('x2', px);
      ln.setAttribute('y1', yTop); ln.setAttribute('y2', yBot);
      ln.setAttribute('stroke', '#c3ccd9'); ln.setAttribute('stroke-width', '1'); ln.setAttribute('stroke-dasharray', '3 3');
      g.appendChild(ln);
      // 数值框内容：点标签（R62：小时加「时」/日期显「几月几日」，居中）+ 三条指标（各用系列色）
      var lines = [{ text: fmtPointLabel(d.day), color: '#555', center: true }];
      [
        { name: '浏览', key: 'views', color: '#1E88E5' },
        { name: '咨询客服', key: 'contacts', color: '#ff9900' },
        { name: '解锁', key: 'resource_unlocks', color: '#4CAF50' }
      ].forEach(function (s) {
        // R75：本期值靠左、（上期 N）整体靠框右缘对齐——两列各自动右对齐成列，数字不随宽度漂移
        var txt = s.name + ': ' + (d[s.key] || 0);
        var prevTxt = (lineHover.hasPrev && p && p[i]) ? '（上期 ' + (p[i][s.key] || 0) + '）' : '';
        lines.push({ text: txt, color: s.color, right: prevTxt });
      });
      // 框位置：参考线右侧，右侧放不下翻到左侧
      // R145：框不随窄屏缩小（R135 口径）且两框全视口恒等——去掉 viewBox 高度封顶（它是窄屏折线框 75px<柱框 84px
      // 一高一低的根因），配合 admin.css #lineSvg overflow:visible，超出 viewBox 的部分照常渲染、不被裁剪
      var _rs = svg.getBoundingClientRect();
      var _k = (_rs && _rs.width) ? Math.max(1, 800 / _rs.width) : 1;
      var boxW = 150 * _k, boxH = (20 + lines.length * 16) * _k;
      var bx = px + 8 * _k;
      if (bx + boxW > lineHover.W - 10) bx = px - 8 * _k - boxW;
      if (bx < 4) bx = 4;
      var by = yTop + 2 * _k;
      var rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', bx); rect.setAttribute('y', by);
      rect.setAttribute('width', boxW); rect.setAttribute('height', boxH);
      rect.setAttribute('rx', 4 * _k);
      rect.setAttribute('fill', 'rgba(255,255,255,0.96)');
      rect.setAttribute('stroke', '#d8dee8');
      g.appendChild(rect);
      lines.forEach(function (l, li) {
        var t = document.createElementNS(SVG_NS, 'text');
        if (l.center) { // R62：时间行居中（框宽中点）
          t.setAttribute('x', bx + boxW / 2); t.setAttribute('text-anchor', 'middle');
        } else {
          t.setAttribute('x', bx + 8 * _k);
        }
        t.setAttribute('y', by + (18 + li * 16) * _k);
        t.setAttribute('font-size', String(11 * _k));
        t.setAttribute('fill', l.color);
        if (l.center) t.setAttribute('font-weight', '600');
        t.textContent = l.text;
        g.appendChild(t);
        // R75：该行的（上期 N）贴框右缘（text-anchor:end），与其它行右对齐成一列
        if (l.right) {
          var tr = document.createElementNS(SVG_NS, 'text');
          tr.setAttribute('x', bx + boxW - 8 * _k); tr.setAttribute('text-anchor', 'end');
          tr.setAttribute('y', by + (18 + li * 16) * _k);
          tr.setAttribute('font-size', String(11 * _k));
          tr.setAttribute('fill', l.color);
          tr.textContent = l.right;
          g.appendChild(tr);
        }
      });
      svg.appendChild(g);
    }
    function ensureLineHover(svg) {
      if (lineHover.svg === svg && lineHover.attached) return;
      lineHover.svg = svg; lineHover.attached = true;
      // svg 元素本身不重建（每轮只重设 innerHTML），监听挂一次即可
      svg.addEventListener('mousemove', function (evt) {
        if (!lineHover.data || !lineHover.data.length) return;
        var rect = svg.getBoundingClientRect();
        var scale = (rect.width || lineHover.W) / lineHover.W;
        var x = (evt.clientX - rect.left) / (scale || 1);
        var i = lineHover.stepX > 0 ? Math.round((x - lineHover.padL) / lineHover.stepX) : 0;
        if (i < 0) i = 0;
        if (i > lineHover.data.length - 1) i = lineHover.data.length - 1;
        drawLineHover(svg, i);
      });
      svg.addEventListener('mouseleave', function () { clearLineHover(svg); });
    }

    // ---------- 折线图渲染 ----------
    function renderLineChart(trend, prev) {
      var svg = document.getElementById('lineSvg');
      if (!svg || !trend || !trend.length) { svg.innerHTML = ''; return; }
      // R147（用户 00:50①）：轴文字恒定渲染 10px（两图统一取小口径，R145 的 13px 推翻）——
      // SVG 有 viewBox 缩放，字号按 800/渲染宽 反补偿，任何视口下渲染尺寸都等于柱图 .tg-num 的 CSS 10px
      var _ax = 10, _asr = svg.getBoundingClientRect(); if (_asr && _asr.width) _ax = +(10 * 800 / _asr.width).toFixed(2); /* R147（用户 00:50①）：轴数字取小口径 10px（R145 的 13 改 10）——SVG 有 viewBox 缩放，按 800/渲染宽 反补偿保证任何视口渲染恒 10px，与柱图 .tg-num 一致 */
      var W = 800, H = 200, padL = 40, padR = 20, padT = 20, padB = 30;
      try { svg.dataset.padT = padT; } catch (e0) { if (window.__silent) window.__silent(e0); } // R153（用户 19:00）：padT 供柱状图同步网格顶线距灰盒顶（两图「5」与上边界距离统一）
      var chartW = W - padL - padR, chartH = H - padT - padB;
      // R58：上期数据（折线图环比）——等长对齐才画；量纲同时计入上期，保证虚线不出顶
      var hasPrev = !!(prev && prev.length === trend.length);
      var maxVal = 1;
      trend.forEach(function (d) { maxVal = Math.max(maxVal, d.views, d.contacts, d.resource_unlocks || 0); });
      if (hasPrev) prev.forEach(function (d) { maxVal = Math.max(maxVal, d.views, d.contacts, d.resource_unlocks || 0); });
      maxVal = Math.ceil(maxVal / 5) * 5 || 5;
      var stepX = trend.length > 1 ? chartW / (trend.length - 1) : 0;

      function pt(i, val) {
        return { x: padL + i * stepX, y: padT + chartH - (val / maxVal) * chartH };
      }

      var html = '';
      // 网格线
      for (var g = 0; g <= 4; g++) {
        var gy = padT + (chartH / 4) * g;
        var gval = Math.round(maxVal - (maxVal / 4) * g);
        html += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#e8e8e8" stroke-width="1"/>';
        html += '<text x="' + (padL - 6) + '" y="' + (gy + 0.44 * _ax) + '" text-anchor="end" font-size="' + _ax + '" fill="#999">' + gval + '</text>'; /* R147（用户 00:59）：Y 轴数字与网格线的垂直关系向柱图看齐——数字顶恒在网格线上方 4.8px（柱图 .tg-num top:-5.8px 口径），原 gy+4 在不同缩放下忽近忽远 */
      }
      // X轴标签
      trend.forEach(function (d, i) {
        var px = pt(i, 0).x;
        var label = d.day ? fmtDay(d.day) : '';
        if (trend.length <= 10 || i % Math.ceil(trend.length / 8) === 0) {
          html += '<text x="' + px + '" y="' + (H - 8) + '" text-anchor="middle" font-size="' + _ax + '" fill="#999">' + label + '</text>';
        }
      });
      // R58：上期三条虚线（同色 35% 透明、dash 6 4）——画在实线前面，本期实线覆盖在上层；悬浮 title 显示上期值
      if (hasPrev) {
        var seriesPrev = [
          { key: 'views', color: '#1E88E5', name: '浏览' },
          { key: 'contacts', color: '#ff9900', name: '咨询客服' },
          { key: 'resource_unlocks', color: '#4CAF50', name: '资源码解锁' }
        ];
        seriesPrev.forEach(function (s) {
          var pPrev = '';
          prev.forEach(function (d, i) { var p = pt(i, d[s.key] || 0); pPrev += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
          html += '<path d="' + pPrev + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-dasharray="6 4" opacity="0.35" stroke-linejoin="round" stroke-linecap="round"><title>' + s.name + '(上期)</title></path>';
        });
        // R61：本期/上期说明移到图下方 line-legend（不再画在 SVG 右上角）
      }
      // 浏览折线
      var pathV = '';
      trend.forEach(function (d, i) { var p = pt(i, d.views); pathV += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
      html += '<path d="' + pathV + '" fill="none" stroke="#1E88E5" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      // 咨询客服折线
      var pathC = '';
      trend.forEach(function (d, i) { var p = pt(i, d.contacts); pathC += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
      html += '<path d="' + pathC + '" fill="none" stroke="#ff9900" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      // 资源码解锁折线
      var pathR = '';
      trend.forEach(function (d, i) { var p = pt(i, d.resource_unlocks || 0); pathR += (i === 0 ? 'M' : 'L') + p.x + ',' + p.y + ' '; });
      html += '<path d="' + pathR + '" fill="none" stroke="#4CAF50" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      // 数据点
      trend.forEach(function (d, i) {
        var pv = pt(i, d.views);
        var pc = pt(i, d.contacts);
        var pr = pt(i, d.resource_unlocks || 0);
        html += '<circle cx="' + pv.x + '" cy="' + pv.y + '" r="3.5" fill="#fff" stroke="#1E88E5" stroke-width="2"><title>浏览: ' + d.views + '</title></circle>';
        html += '<circle cx="' + pc.x + '" cy="' + pc.y + '" r="3.5" fill="#fff" stroke="#ff9900" stroke-width="2"><title>咨询客服: ' + d.contacts + '</title></circle>';
        html += '<circle cx="' + pr.x + '" cy="' + pr.y + '" r="3.5" fill="#fff" stroke="#4CAF50" stroke-width="2"><title>资源码解锁: ' + (d.resource_unlocks || 0) + '</title></circle>';
      });
      svg.innerHTML = html;
      // R59：记录本轮渲染数据/几何，并给 svg 挂悬浮提示（mousemove 最近点 → 参考线+数值框）
      lineHover.data = trend;
      lineHover.prev = hasPrev ? prev : null;
      lineHover.hasPrev = hasPrev;
      lineHover.stepX = stepX;
      ensureLineHover(svg);
      // R145：图表常在统计面板隐藏时首绘（登录后默认落在资源页即已画图）——此时渲染宽度为 0，
      // 轴字号走了回退值。注册重渲染入口：切到统计页（面板可见）与窗口 resize（防抖）时重画，字号按真实宽度补偿
      if (!window.__rlInit) {
        window.__rlInit = true;
        window.addEventListener('resize', function () {
          clearTimeout(window.__rlT);
          window.__rlT = setTimeout(function () { try { if (window.__rerenderLine) window.__rerenderLine(); } catch (e) { if (window.__silent) window.__silent(e); } }, 200);
        });
      }
      window.__rerenderLine = function () {
        if (!lineHover.data || !lineHover.data.length) return;
        try { renderLineChart(lineHover.data, lineHover.hasPrev ? lineHover.prev : null); } catch (e) { if (window.__silent) window.__silent(e); }
      };
    }


    // 多工作表导出（SpreadsheetML，.xls，Excel/WPS 可直接打开；不同结构的数据分开放不同工作表）
    function xlsEscape(v) {
      return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function downloadMultiSheetXLS(filename, sheets) {
      var xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>';
      xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
      // R221（老板点名）：所有单元格上下左右居中——统一样式 c，表头/数据单元格都挂 ss:StyleID="c"
      xml += '<Styles><Style ss:ID="c"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style></Styles>';
      var usedNames = {};
      sheets.forEach(function (sh) {
        var nm = String(sh.name || 'Sheet').replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31) || 'Sheet';
        var base = nm, k = 2; // ss:Name 防重名（SpreadsheetML 工作表名必须唯一）
        while (usedNames[nm]) { nm = base.slice(0, 28) + '_' + k; k++; }
        usedNames[nm] = 1;
        xml += '<Worksheet ss:Name="' + xlsEscape(nm) + '"><Table>';
        sh.rows.forEach(function (r) {
          xml += '<Row>';
          r.forEach(function (cell) {
            var isNum = typeof cell === 'number' && isFinite(cell);
            xml += '<Cell ss:StyleID="c"><Data ss:Type="' + (isNum ? 'Number' : 'String') + '">' + (isNum ? cell : xlsEscape(cell)) + '</Data></Cell>';
          });
          xml += '</Row>';
        });
        xml += '</Table></Worksheet>';
      });
      xml += '</Workbook>';
      var blob = new Blob(['﻿', xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // R221（老板点名）：文件名「时间-数据统计」（到分钟）；同一分钟内重复导出加序号防覆盖
    // R251（老板 09-23 15:20）：日期与时间分隔符改中文冒号「：」——「20260923：1520-数据统计.xls」（日期 8 位+时分 4 位），序号逻辑保留
    var __exportStampState = { min: '', seq: 0 };
    function __exportStamp() {
      var d = new Date(); function pd(n) { return String(n).padStart(2, '0'); }
      var min = window.__fmtDateTime(d, 'stamp').replace(/[-: ]/g, function (ch) { return ch === '：' ? '：' : (ch === '-' ? '' : ch === ' ' ? '：' : ch); }); /* v336 条16：消除全角冒号（Windows 非法文件名字符） */
      if (__exportStampState.min === min) { __exportStampState.seq++; } else { __exportStampState.min = min; __exportStampState.seq = 0; }
      return min + (__exportStampState.seq > 0 ? '(' + (__exportStampState.seq + 1) + ')' : '');
    }
    function __xl(v) { return v == null ? '' : String(v); }

    // 统一导出（R221 全面升级）：一个 Excel 8 个工作表，数据走 /api/admin/export 全量端点
    // （每日趋势/按资源统计不再限近 30 天；新增绑定设备明细 + 发码记录；含访问记录明细）
    function exportAllData() {
      var btn = document.getElementById('exportBtn');
      var btnOld = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; if (window.__btnBusy) window.__btnBusy(btn, '导出中'); else btn.textContent = '导出中'; }
      // v294（用户 10-04 02:14）：267 导出数据加进度提示
      toast('正在准备导出，请稍候…', 'info');
      var done = function () { if (btn) { btn.disabled = false; btn.textContent = btnOld || '导出数据统计'; } };
      api('admin/export').then(function (res) {
        if (!res || !res.ok) { toast((res && res.msg) || '导出失败：数据加载失败', 'error'); done(); return; }
        try {
          var L = window.__utcToLocal || function (t) { return t; };
          var sheets = [];
          // 1 资源清单
          var pRows = [['ID', '资源标题', '分类', '状态', '价格(元)', '浏览量', '咨询客服', '资源码解锁', '绑定设备', '简介', '客服链接', '排序', '创建时间']];
          (res.products || []).forEach(function (p) {
            pRows.push([p.id, __xl(p.title), __xl(p.cat), (p.is_online && !p.is_hidden) ? '显示' : '隐藏', Number(p.price) || 0, p.views || 0, p.contacts || 0, p.resource_unlocks || 0, p.bindings || 0, __xl(p.desc), __xl(p.contact_url), p.sort || 0, L(p.created_at)]);
          });
          sheets.push({ name: '资源清单', rows: pRows });
          // 2 资源类型
          var vRows = [['所属资源', '类型名称', '类型描述', '价格(元)', '当前资源码', '是否需要资源码', '是否隐藏', '绑定设备数', '排序']];
          (res.variants || []).forEach(function (v) {
            vRows.push([__xl(v.product_title), __xl(v.name), __xl(v.desc), Number(v.price) || 0, __xl(v.resource_code), v.resource_code ? '是' : (v.has_content ? '否(直接获取)' : '否'), v.is_hidden ? '是' : '否', v.bindings || 0, v.sort || 0]);
          });
          sheets.push({ name: '资源类型', rows: vRows });
          // 3 分类清单
          var cRows = [['ID', '分类名称', '层级', '所属一级', '排序', '是否隐藏', '资源数']];
          (res.categories || []).forEach(function (c) {
            cRows.push([c.id, __xl(c.name), __xl(c.level), __xl(c.parent), c.sort || 0, c.is_hidden ? '是' : '否', c.product_count || 0]);
          });
          sheets.push({ name: '分类清单', rows: cRows });
          // 4 绑定设备明细（R221 新增）
          var bRows = [['所属资源', '类型', '资源码', '绑定时间', '最近访问', '设备UA']];
          (res.bindings || []).forEach(function (b) {
            bRows.push([__xl(b.product_title), __xl(b.variant_name), __xl(b.code), L(b.created_at), L(b.last_access), __xl(b.ua)]);
          });
          sheets.push({ name: '绑定设备明细', rows: bRows });
          // 5 发码记录（R221 新增：码、发放时间、状态、剩余天数）
          var iRows = [['所属资源', '类型', '资源码', '发放时间', '状态', '剩余有效天数', '绑定时间']];
          (res.issues || []).forEach(function (it) {
            iRows.push([__xl(it.product_title), __xl(it.variant_name), __xl(it.code), L(it.issued_at), __xl(it.status), it.remaining_days || 0, it.bound_at ? L(it.bound_at) : '']);
          });
          sheets.push({ name: '发码记录', rows: iRows });
          // 6 每日趋势（全量保留天数，不再限近 30 天）
          var tRows = [['日期', '浏览量', '咨询客服', '资源码解锁']];
          (res.trend || []).forEach(function (d) { tRows.push([__xl(d.day), d.views || 0, d.contacts || 0, d.resource_unlocks || 0]); });
          sheets.push({ name: '每日趋势', rows: tRows });
          // 7 按资源统计（全量口径）
          var sRows = [['资源名称', '浏览量', '咨询客服', '资源码解锁', '绑定设备']];
          (res.byProduct || []).forEach(function (p) { sRows.push([__xl(p.title), p.views || 0, p.contacts || 0, p.resource_unlocks || 0, p.bindings || 0]); });
          sheets.push({ name: '按资源统计', rows: sRows });
          // 8 访问记录明细
          var rRows = [['时间', '访问类型', '资源', 'IP']];
          (res.recent || []).forEach(function (r) { rRows.push([L(r.created_at), __xl(r.type_text), __xl(r.product_title), __xl(r.ip)]); });
          sheets.push({ name: '访问记录', rows: rRows });
          downloadMultiSheetXLS(__exportStamp() + '-数据统计.xls', sheets);
          var cnt = res.counts || {};
          toast('导出成功（8 个工作表）：资源清单 ' + (cnt.products || 0) + '、资源类型 ' + (cnt.variants || 0) + '、分类清单 ' + (cnt.categories || 0) + '、绑定设备明细 ' + (cnt.bindings || 0) + '、发码记录 ' + (cnt.issues || 0) + '、每日趋势、按资源统计、访问记录 ' + (cnt.recent || 0) + ' 条', 'success');
        } catch (e) { toast('导出失败：' + e.message, 'error'); }
        done();
      }).catch(function () { toast('导出失败：网络错误', 'error'); done(); });
    }


    // ---------- 数据统计 ----------
    // R60：环比小字全量百分比（含资源码解锁卡）——上期为 0 且本期有量时按从零起算显示 ↑100%（不再显示「新增」）；
    // 悬浮 title 仍显示上期具体数（上期为 0 时 title 也能看出来）
    function fmtStatDelta(cur, prev) {
      if (prev === 0 && cur === 0) return { text: '0%', cls: 'flat' };
      if (prev === 0) return { text: '↑100%', cls: 'up' };
      var pct = Math.round((cur - prev) / prev * 100);
      if (pct === 0) return { text: '0%', cls: 'flat' };
      return { text: (pct > 0 ? '↑' : '↓') + Math.abs(pct) + '%', cls: pct > 0 ? 'up' : 'down' };
    }

    // R57：柱状图公共渲染——每列左右两组：本期实色柱 + 上期浅色半透明柱；列顶涨跌箭头（以浏览为主指标），
    // 悬浮显示本期/上期具体数字。loadStats 与 applyStatsDays 共用，避免两处分叉
    function renderTrendBars(trendData, prevData) {
      // v302（用户 10-05 00:09）：趋势图去骨架，无需清理
      var trendBox = document.getElementById('trendBars');
      trendBox.innerHTML = '';
      // R70：柱状图高度与折线图统一（以折线为准）——读折线 svg 实际渲染高同步容器与柱区（--barZone）
      // 初次渲染时统计面板可能尚未显示（svg 布局为瞬时小值），用 ResizeObserver 监听 svg 尺寸稳定/变化时再同步（含窗口缩放）
      var lineSvgEl = document.getElementById('lineSvg');
      var syncBarHeight = function (el, box) {
        var h2 = el ? el.getBoundingClientRect().height : 0;
        if (h2 >= 60) { /* R153：门槛 100→60——窄屏 SVG 渲染高 ~85px 被 100 拦住导致 barZone 不同步；隐藏面板时 SVG 高 0 仍被 60 拦住 */
          box.style.height = h2 + 'px';
          // R153（用户 19:00）：柱状图网格顶线距灰盒顶与折线图逐像素统一——
          // 折线网格顶线渲染位置 = line-chart 顶 + (padding-top 12) + padT*k（k=SVG渲染高/200，随视口变）；
          // 柱状 chart-box 上 padding 0、grid bottom:24 + height:barZone，网格顶距 trend-bars 顶 = h2-24-barZone，
          // 令其等于折线的 d → barZone = h2-24-d。量不到折线时兜底原 12px 口径
          var d = 12;
          try {
            var r2 = el.getBoundingClientRect();
            var lc = document.getElementById('lineChart');
            if (lc && r2.height) {
              var pt = parseFloat(el.dataset.padT); if (!(pt >= 0)) pt = 20;
              d = Math.max(0, (r2.top + pt * (r2.height / 200)) - lc.getBoundingClientRect().top);
            }
          } catch (e3) { if (window.__silent) window.__silent(e3); }
          // R162（用户 00:08）：柱图网格/柱底/X标签/Y数字全部按折线几何公式同步（k=SVG渲染高/200）——
          // 网格顶距 trend-bars 顶 = 20k（=量测 d 减 chart-box 上 padding 12）、网格跨度 = 150k（间距 37.5k 与折线逐像素一致）、
          // 柱底距底 = 30k、X 标签底距底 = 8k、Y 数字右缘距网格左缘 = 6k
          var k2 = h2 / 200;
          box.style.setProperty('--gridTop', Math.max(0, Math.round(d) - 12) + 'px');
          box.style.setProperty('--barZone', Math.max(30, Math.round(150 * k2)) + 'px');
          box.style.setProperty('--bLift', Math.max(6, Math.round(30 * k2)) + 'px');
          box.style.setProperty('--xLift', Math.max(2, Math.round(8 * k2)) + 'px');
          box.style.setProperty('--numGap', Math.max(2, Math.round(6 * k2)) + 'px');
          return true;
        }
        return false;
      };
      syncBarHeight(lineSvgEl, trendBox);
      if (lineSvgEl && !lineSvgEl.__barHObserved) {
        lineSvgEl.__barHObserved = true;
        if (window.ResizeObserver) {
          new ResizeObserver(function () {
            syncBarHeight(document.getElementById('lineSvg'), document.getElementById('trendBars'));
          }).observe(lineSvgEl);
        }
      }
      var hasPrev = !!(prevData && prevData.length === trendData.length);
      var maxVal = 1;
      trendData.forEach(function (d, i) {
        // R66：与折线图严格同口径——量纲同时计入 resource_unlocks 与上期数据，
        // 保证两图左侧网格刻度数值完全一致（用户要求严谨同步）
        maxVal = Math.max(maxVal, d.views || 0, d.contacts || 0, d.resource_unlocks || 0);
        if (hasPrev) { var p = prevData[i] || {}; maxVal = Math.max(maxVal, p.views || 0, p.contacts || 0, p.resource_unlocks || 0); }
      });
      // R66：maxVal 取整到 5 的倍数——与折线图同口径，两图网格刻度数值一致
      maxVal = Math.ceil(maxVal / 5) * 5 || 5;
      // R66：灰色网格线 + 左侧数字刻度（折线图同款：#e8e8e8 横线、#999 数字、4 格 5 条）
      var grid = document.createElement('div');
      grid.className = 'trend-grid';
      var gridHtml = '';
      for (var g = 0; g <= 4; g++) {
        var gPct = (100 / 4) * g;
        var gVal = Math.round((maxVal / 4) * g);
        gridHtml += '<div class="tg-line" style="bottom:' + gPct + '%"><span class="tg-num">' + gVal + '</span></div>';
      }
      grid.innerHTML = gridHtml;
      trendBox.appendChild(grid);
      var labelsEl = document.createElement('div');
      labelsEl.className = 'trend-labels'; // R162：X 标签独立层（bottom: var(--xLift)，与折线标签底同位）
      trendData.forEach(function (d, i) {
        var col = document.createElement('div');
        col.className = 'trend-col';
        var wrap = document.createElement('div');
        wrap.className = 'trend-bar-wrap';
        // R59：悬浮 title 同时给本期与上期的具体数（悬浮任一根柱都能看到对比）
        // R62：title 首行加时间——小时数据（1天档）「N时」、日期数据「几月几日」
        function mkGroup(data, ghost, other, timeLabel) {
          var g = document.createElement('div');
          g.className = 'trend-bar-group';
          var tHead = timeLabel ? (timeLabel + '\n') : '';
          // R65：对比上期关闭时 other 为 null——先安全取值再拼（原来 other.views 在判空前求值会崩）
          function tag(x) { var v = x || 0; return other ? ((ghost ? '（本期 ' : '（上期 ') + v + '）') : ''; }
          var barV = document.createElement('div');
          barV.className = 'trend-bar view' + (ghost ? ' ghost' : '');
          barV.style.height = ((data.views || 0) / maxVal * 100) + '%';
          barV.title = tHead + '浏览' + (ghost ? '(上期)' : '') + ': ' + (data.views || 0) + tag(other && other.views);
          var barC = document.createElement('div');
          barC.className = 'trend-bar contact' + (ghost ? ' ghost' : '');
          barC.style.height = ((data.contacts || 0) / maxVal * 100) + '%';
          barC.title = tHead + '咨询客服' + (ghost ? '(上期)' : '') + ': ' + (data.contacts || 0) + tag(other && other.contacts);
          // R78：柱状图补资源码解锁系列（跟折线图一样三系列）——绿色 #4CAF50，ghost 沿用 opacity .32
          var barR = document.createElement('div');
          barR.className = 'trend-bar resource' + (ghost ? ' ghost' : '');
          barR.style.height = ((data.resource_unlocks || 0) / maxVal * 100) + '%';
          barR.title = tHead + '资源码解锁' + (ghost ? '(上期)' : '') + ': ' + (data.resource_unlocks || 0) + tag(other && other.resource_unlocks);
          g.appendChild(barV);
          g.appendChild(barC);
          g.appendChild(barR);
          return g;
        }
        // R58：箭头放进本期组内第一个位置（浏览柱上方）——组是 column 底对齐，箭头自然贴柱顶、跟随柱高
        var timeLabel = fmtPointLabel(d.day);
        var curGroup = mkGroup(d, false, hasPrev ? (prevData[i] || null) : null, timeLabel);
        if (hasPrev) {
          // 涨跌箭头：以浏览为主指标，悬浮给出浏览/咨询客服两行的上期→本期
          var pv = prevData[i] || {};
          var dv = (d.views || 0) - (pv.views || 0);
          var dc = (d.contacts || 0) - (pv.contacts || 0);
          var ar = document.createElement('div');
          ar.className = 'trend-arrow ' + (dv > 0 ? 'up' : dv < 0 ? 'down' : 'flat');
          ar.textContent = dv > 0 ? '▲' : dv < 0 ? '▼' : '▬';
          ar.title = timeLabel + '\n浏览: ' + (pv.views || 0) + ' → ' + (d.views || 0) + '；咨询客服: ' + (pv.contacts || 0) + ' → ' + (d.contacts || 0) + (dc > 0 ? '（涨）' : dc < 0 ? '（降）' : '') + '；资源码解锁: ' + (pv.resource_unlocks || 0) + ' → ' + (d.resource_unlocks || 0);
          curGroup.insertBefore(ar, curGroup.firstChild);
        }
        wrap.appendChild(curGroup);
        if (hasPrev) wrap.appendChild(mkGroup(prevData[i] || {}, true, d, timeLabel));
        col.appendChild(wrap);
        trendBox.appendChild(col);
        // R162（用户 00:08）：X 标签移出列、进独立标签层——与折线 X 标签同 x（点对齐：padL+i*stepX 换百分比）、
        // 同间隔（折线 stepX 口径），不再按列中心分布导致两图数字间隔不一致
        var label = document.createElement('div');
        label.className = 'trend-label';
        label.textContent = (trendData.length <= 10 || i % Math.ceil(trendData.length / 8) === 0) ? (d.day ? fmtDay(d.day) : '') : '';
        var nD = trendData.length, stepXr = nD > 1 ? 740 / (nD - 1) : 0;
        label.style.left = ((40 + i * stepXr) / 800 * 100).toFixed(3) + '%';
        labelsEl.appendChild(label);
      });
      trendBox.appendChild(labelsEl);
      // R76：柱状图悬浮与折线图一模一样——竖虚线+数值框（时间居中+三指标行、本期左/（上期 N）右）
      ensureBarHover(trendBox, trendData, hasPrev ? prevData : null);
    }

    // ---------- 柱状图悬浮（R76：复刻折线图 drawLineHover 的交互与样式） ----------
    var barHover = { box: null, data: null, prev: null, attached: false };
    function clearBarHover() {
      var box = barHover.box;
      if (!box) return;
      var l = box.querySelector('.bar-hover-line'); if (l) l.remove();
      var b = box.querySelector('.bar-hover-box'); if (b) b.remove();
    }
    function drawBarHover(i) {
      var box = barHover.box; if (!box || !barHover.data || !barHover.data[i]) return;
      clearBarHover();
      var d = barHover.data[i]; var p = barHover.prev;
      // 列中心横坐标（等宽列，用各列实际 rect 取第 i 列）
      var cols = box.querySelectorAll('.trend-col');
      var col = cols[i]; if (!col) return;
      var br = box.getBoundingClientRect(), cr = col.getBoundingClientRect();
      var px = cr.left - br.left + cr.width / 2;
      // 竖参考线（折线图同款 #c3ccd9 虚线）
      var ln = document.createElement('div');
      ln.className = 'bar-hover-line';
      ln.style.left = px + 'px';
      box.appendChild(ln);
      // 数值框内容：时间行（R62 格式、居中）+ 三指标行（系列色、本期左/（上期 N）右——与折线悬浮完全一致）
      var series = [
        { name: '浏览', key: 'views', color: '#1E88E5' },
        { name: '咨询客服', key: 'contacts', color: '#ff9900' },
        { name: '解锁', key: 'resource_unlocks', color: '#4CAF50' }
      ];
      var html = '<div class="bhb-time">' + fmtPointLabel(d.day) + '</div>';
      series.forEach(function (s) {
        var prevTxt = (p && p[i]) ? '（上期 ' + (p[i][s.key] || 0) + '）' : '';
        html += '<div class="bhb-row"><span class="bhb-cur" style="color:' + s.color + '">' + s.name + ': ' + (d[s.key] || 0) + '</span>' +
                (prevTxt ? '<span class="bhb-prev" style="color:' + s.color + '">' + prevTxt + '</span>' : '') + '</div>';
      });
      var hb = document.createElement('div');
      hb.className = 'bar-hover-box';
      hb.innerHTML = html;
      // R115：两图悬浮框同步——折线 SVG 框随 viewBox 缩放（渲染尺寸 = 150×84 × scale、字号 11 × scale），
      // 柱状框读取折线 SVG 当前缩放比（--bhs）跟随缩放，两框在任何宽度下外框尺寸/字号完全一致
      var _ls = document.getElementById('lineSvg');
      var _sc = 1;
      if (_ls) { var _lw = _ls.getBoundingClientRect().width; if (_lw) _sc = _lw / 800; }
      // R135：悬浮框不随窄屏缩小——渲染尺寸最小保持基准 150×84/字号11（「取大的那个」口径，恢复之前的大框观感）
      if (_sc < 1) _sc = 1;
      try { hb.style.setProperty('--bhs', _sc); } catch (e) { if (window.__silent) window.__silent(e); }
      // 框位置：参考线右侧 8px，右侧放不下翻到左侧（折线悬浮同逻辑），并钳制在容器内
      var boxW = 150 * _sc;
      var bx = px + 8;
      if (bx + boxW > br.width - 2) bx = px - 8 - boxW;
      if (bx < 2) bx = 2;
      hb.style.left = bx + 'px';
      hb.style.top = 'calc(var(--gridTop, 20px) + 2px)'; // R162：与折线悬浮框顶同位（折线 by=yTop+2*_k 渲染 20k+2）
      box.appendChild(hb);
    }
    function ensureBarHover(box, data, prev) {
      barHover.box = box; barHover.data = data; barHover.prev = prev;
      if (barHover.attached) return;
      barHover.attached = true;
      box.addEventListener('mousemove', function (evt) {
        if (!barHover.data || !barHover.data.length) return;
        // 最近列：按鼠标 x 找最近的 .trend-col 中心
        var cols = box.querySelectorAll('.trend-col');
        if (!cols.length) return;
        var br = box.getBoundingClientRect();
        var mx = evt.clientX - br.left;
        var best = 0, bestD = Infinity;
        for (var k = 0; k < cols.length; k++) {
          var cr = cols[k].getBoundingClientRect();
          var c = cr.left - br.left + cr.width / 2;
          var dd = Math.abs(mx - c);
          if (dd < bestD) { bestD = dd; best = k; }
        }
        drawBarHover(best);
      });
      box.addEventListener('mouseleave', function () { clearBarHover(); });
    }

    // R65：统计卡片渲染（拆成函数，供 loadStats 与「对比上期」开关切换重渲染共用）
    function renderStatCards(ov, ovp) {
      // v302（用户 10-05 00:09）：每日数据去骨架，无需清理
      var cards = [
        { label: '资源总数', num: ov.products || 0 },
        { label: '显示资源', num: ov.online || 0 },
        { label: '隐藏资源', num: ov.hidden || 0 },
        { label: '总浏览', num: ov.views || 0, prev: ovp ? (ovp.views || 0) : null },
        { label: '咨询客服', num: ov.contacts || 0, prev: ovp ? (ovp.contacts || 0) : null },
        { label: '资源码解锁', num: ov.resource_unlocks || 0, prev: ovp ? (ovp.resource_unlocks || 0) : null },
      ];
      var cbox = document.getElementById('statCards');
      cbox.innerHTML = '';
      cards.forEach(function (c) {
        var d = document.createElement('div');
        d.className = 'stat-card';
        var n = document.createElement('div');
        n.className = 'num';
        n.textContent = '0'; /* R183 条10：数字滚动（0.6s ease-out；系统开了减少动效则直显终值） */
        (function (__t, __n) {
          if (!__t || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) { __n.textContent = __t; return; }
          var __t0 = null;
          requestAnimationFrame(function __step(ts) {
            if (__t0 === null) __t0 = ts;
            var __p = Math.min(1, (ts - __t0) / 600);
            __n.textContent = Math.round(__t * (1 - Math.pow(1 - __p, 3)));
            if (__p < 1) requestAnimationFrame(__step);
          });
        })(c.num, n);
        var l = document.createElement('div');
        l.className = 'label';
        l.textContent = c.label;
        d.appendChild(n);
        d.appendChild(l);
        // R57：涨跌小字（涨绿降红）——R65：仅「对比上期」开关开启时显示
        if (state.statsCmpPrev && c.prev !== null && c.prev !== undefined) {
          var delta = fmtStatDelta(c.num, c.prev);
          var dl = document.createElement('div');
          dl.className = 'delta ' + delta.cls;
          dl.textContent = delta.text;
          dl.title = '上期: ' + c.prev;
          d.appendChild(dl);
        }
        cbox.appendChild(d);
      });
    }

    // R176（用户 10:16）：统计切档极致响应——日期全链北京时间口径（旧 toISOString 取 UTC 日，
    // 北京 0-8 点差一天）；切档请求与后端 R168 的 +8hours 聚合同口径
    function __bjToday() { return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); }
    function __statsRangeDays(days) {
      var end = __bjToday();
      var ms = Date.parse(end + 'T00:00:00Z') - (days - 1) * 86400000;
      return { start: new Date(ms).toISOString().slice(0, 10), end: end };
    }
    // R176：全量趋势（30 天日线）单例预取——供 7/30 天档点击时本地即时切片重绘两图
    //（applyStatsDays 零等待）；一次会话只拉一次，与范围请求并行互不阻塞。
    // 旧实现把全量趋势挂在无参 loadStats 的响应上（start/end 一旦有值就永不填充），
    // 范围推导后无参调用也带参，必须改为独立预取。
    function __ensureTrendAll() {
      if (state.statsTrendAll && state.statsTrendAll.length) return;
      api('admin/stats').then(function (res) {
        if (res && res.ok && res.trend && res.trend.length) {
          state.statsTrendAll = res.trend;
          state.statsTrendAllPrev = res.trend_prev || [];
        }
      }).catch(function () {});
    }
    /* R238（用户 09-22 17:37 派单）：统计表标题随所选范围同步（自 loadStats 前段抽出，
       供 time-btn 缓存命中路径复用——点击瞬间标题先切，与请求路径完全一致） */
    function __updateStatTitles(startDate, endDate) {
      var _s0 = String(startDate || '').slice(0, 10), _e0 = String(endDate || '').slice(0, 10), _lbl;
      if (_s0 && _s0 === _e0) _lbl = '今天';
      else if (_s0 && _e0) {
        var _span = Math.round((Date.parse(_e0 + 'T00:00:00Z') - Date.parse(_s0 + 'T00:00:00Z')) / 86400000) + 1;
        _lbl = (_span === 7 || _span === 30) ? '近' + _span + '天' : (_s0 + ' ~ ' + _e0);
      }
      if (_lbl) {
        var _h3p = document.getElementById('statH3Product'); if (_h3p) _h3p.textContent = '资源明细（' + _lbl + '）';
        var _h3r = document.getElementById('statH3Recent'); if (_h3r) _h3r.textContent = '浏览记录（' + _lbl + '）';
      }
    }
    /* R238（用户 09-22 17:37 老板原话：「数据统计里面1、7、30天按键的数据应该都要加载好，
       不然我第一次点击1、7、30天按键都加载一次，这种看着观感和体验都不好」）：
       三档数据进统计页即并行预载（幂等，按天缓存），time-btn 点击命中缓存直接全套渲染秒切；
       预载失败静默降级回现行每点即拉，不报错不弹提示 */
    var __statsCache = {}; /* { days: { end: 'YYYY-MM-DD', res: {...} } } */
    function __prefetchStatsRanges() {
      [1, 7, 30].forEach(function (d) {
        var _end = __bjToday();
        var _c = __statsCache[d];
        if (_c && _c.end === _end) return; /* 本日该档已预载，幂等 */
        var _r = d === 1 ? { start: _end, end: _end } : __statsRangeDays(d);
        var _u = 'admin/stats?start_date=' + encodeURIComponent(_r.start) + '&end_date=' + encodeURIComponent(_r.end);
        api(_u).then(function (res) {
          if (res && res.ok) __statsCache[d] = { end: _end, res: res };
        }).catch(function () {}); /* 预载失败静默降级：time-btn 走原现场请求路径 */
      });
    }
    function loadStats(startDate, endDate, force, silent) { /* R238：silent=后台静默刷新（time-btn 命中缓存后的保新鲜刷新），三表比对局部更新 */
      // R176：无参调用一律按当前选中档推导范围（旧 R33 仅 1 天档特例，且旧短路
      // 「无参+已有全量趋势 → applyStatsDays 只重绘两图直接 return」正是 7/30 天档六卡片
      // 永不刷新的根因——切档按钮现在显式带范围+force，无参调用也按档推导，六卡随档同步）
      if (!startDate && !endDate) {
        var _r0 = __statsRangeDays(state.statsDays || 1);
        startDate = _r0.start; endDate = _r0.end;
      }
      __ensureTrendAll(); // R176：全量趋势并行预取（幂等），7/30 天档点击即可本地即时切片
      __prefetchStatsRanges(); /* R238：三档预载（幂等）——进统计页即把 1/7/30 天数据后台拿好，点哪个秒切哪个 */
      var url = 'admin/stats';
      var params = [];
      if (startDate) params.push('start_date=' + encodeURIComponent(startDate));
      if (endDate) params.push('end_date=' + encodeURIComponent(endDate));
      if (params.length) url += '?' + params.join('&');
      // R176（用户 10:16）：统计表标题随所选范围即时同步——R238 抽成 __updateStatTitles 供缓存命中路径复用
      __updateStatTitles(startDate, endDate);
      // R272：去掉加载圈——老板明确"马上去掉"，以本次原话为准，无条件不显示。
      // 骨架屏已承接加载态（统计卡骨架/三表骨架已有），加载观感不受影响。
      // R256：统计表骨架已内嵌在 admin.html，有则不复建
      /* R281：silent（切回窗口静默重拉 / R238 保新鲜刷新）不铺骨架——此时三表已渲染真行，
         清真行铺骨架会闪且 diff 没变的表会停留在骨架态；骨架只服务首载等待 */
      if (!silent) {
        var _stHasSkel = document.getElementById('statRows') && document.getElementById('statRows').querySelectorAll('.admin-skel').length > 0;
        if (!_stHasSkel) renderStatSkeleton();
        /* R230（老板 09-21 21:10）：统计三表首载铺 tr 骨架（每列一条灰线、数量=一页 20 条；数据到达同位置替换） */
        var _stb0 = document.getElementById('statRows');
        if (_stb0 && !_stb0.children.length) renderStatSkeleton();
      }
      return api(url).then(function (res) { if (silent) __silentApplyStats(res); else __applyStatsRes(res); });
    }
    /* R238：loadStats 响应渲染整体抽出——time-btn 命中预载缓存时走完全相同的渲染路径，
       与请求回来逐字节一致（六卡+两图+三表全套），保证「秒切」画面与等待加载后的画面无差别 */
    function __applyStatsRes(res) {
      // 数据统计表格顺序：资源明细 → 分类统计 → 浏览记录（幂等，仅首次生效）
        var _sec = document.getElementById('panel-stats');
        if (_sec) {
          var _ws = _sec.querySelectorAll('.stat-table-wrap');
          if (_ws.length >= 3 && _ws[0].querySelector('h3') && _ws[0].querySelector('h3').textContent.indexOf('分类') !== -1) {
            _sec.insertBefore(_ws[1], _ws[0]);
          }
        }
        if (!res.ok) { /* R230：接口异常收三表骨架，不卡灰 */
          __clearAdminSkel(document.getElementById('statRows')); __clearAdminSkel(document.getElementById('statCatRows')); __clearAdminSkel(document.getElementById('statRecentRows'));
          toast(res.msg || '加载失败，网络开小差了', 'error'); return; }
        window.__lastFetchTime = Date.now(); /* R281：成功拉取记录时间戳（切回窗口 60s 判定） */
        var ov = res.overview || {};
        // R57：环比——前三个是库存快照（不适用环比），只给后三个流量卡配涨跌小字；
        // R65：「对比上期」开关关闭时小字不显示（数据仍保存，开关重渲染）
        var ovp = res.overview_prev || null;
        state.statsOverview = ov; state.statsOverviewPrev = ovp;
        renderStatCards(ov, ovp);

        // 趋势图（按时间筛选）
        var allTrend = res.trend || [];
        var allTrendPrev = res.trend_prev || [];
        var days = state.statsDays || 7;
        var trendData, trendPrev;
        if (res.hourly && res.hourly.length) {
          // R29（优化项8）：单日范围（1天档/自定义同日）按小时粒度展示，统计页所有区块同口径（概览/明细/分类均来自同一范围请求）
          trendData = res.hourly.map(function (h) {
            return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks }; // R52：小时图标签去「时」字
          });
          // R57：1天档的上期=昨日同小时（同形状才能逐柱对比）
          trendPrev = (res.hourly_prev && res.hourly_prev.length === res.hourly.length) ? res.hourly_prev.map(function (h) {
            return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
          }) : null;
        } else {
          trendData = allTrend.slice(-days);
          trendPrev = allTrendPrev.length ? allTrendPrev.slice(-days) : null;
        }
        // 保存统计数据到 state，供导出与「对比上期」开关重渲染使用
        state.statsTrend = trendData;
        state.statsTrendPrev = trendPrev || null;
        state.statsByProduct = res.byProduct || [];
        // 折线图（R58：上期虚线；R65：仅开关开启时显示）
        renderLineChart(trendData, state.statsCmpPrev ? trendPrev : null);
        // 柱状图（R57：上期浅色对比柱与涨跌箭头；R65：仅开关开启时显示）
        renderTrendBars(trendData, state.statsCmpPrev ? trendPrev : null);

        // 三个统计表：全量数据（后端仅按 30 天范围过滤，不再截断条数）+ 前端分页（一页 20 条，全系统统一）
        state.statByProduct = res.byProduct || [];
        state.statByCategory = res.byCategory || [];
        state.statRecent = res.recent || [];
        renderStatTables();

        // 三个统计表（含最近浏览）已在上方统一交给 renderStatTables 渲染：全量数据 + 一页 20 条翻页
        // R272：加载圈已删除，无需再隐藏。
        __saveAdminState();
    }
    /* R238（用户 09-22 17:37 派单）：后台静默刷新专用渲染——六卡+两图照常重渲染（无全页动画），
       三表逐张与当前数据比对：没变的不碰（不销毁、错峰淡入不重放，R235 onlyKey 口径），
       变了的那张才局部重建。用于 time-btn 命中缓存后的保新鲜刷新，用户全程无感 */
    function __silentApplyStats(res) {
      if (!res || !res.ok) return;
      window.__lastFetchTime = Date.now(); /* R281：成功拉取记录时间戳（切回窗口 60s 判定） */
      var _ts = function (x) { try { return JSON.stringify(x || []); } catch (e) { return ''; } };
      if (_ts(res.byProduct) !== _ts(state.statByProduct)) { state.statByProduct = res.byProduct || []; renderStatTables('product'); }
      if (_ts(res.byCategory) !== _ts(state.statByCategory)) { state.statByCategory = res.byCategory || []; renderStatTables('cat'); }
      if (_ts(res.recent) !== _ts(state.statRecent)) { state.statRecent = res.recent || []; renderStatTables('recent'); }
      var ov = res.overview || {};
      state.statsOverview = ov; state.statsOverviewPrev = res.overview_prev || null;
      renderStatCards(ov, res.overview_prev || null);
      var allTrend = res.trend || [];
      var allTrendPrev = res.trend_prev || [];
      var days = state.statsDays || 7;
      var trendData, trendPrev;
      if (res.hourly && res.hourly.length) {
        trendData = res.hourly.map(function (h) {
          return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
        });
        trendPrev = (res.hourly_prev && res.hourly_prev.length === res.hourly.length) ? res.hourly_prev.map(function (h) {
          return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
        }) : null;
      } else {
        trendData = allTrend.slice(-days);
        trendPrev = allTrendPrev.length ? allTrendPrev.slice(-days) : null;
      }
      state.statsTrend = trendData;
      state.statsTrendPrev = trendPrev || null;
      state.statsByProduct = res.byProduct || [];
      renderLineChart(trendData, state.statsCmpPrev ? trendPrev : null);
      renderTrendBars(trendData, state.statsCmpPrev ? trendPrev : null);
      __saveAdminState();
      // R272：加载圈已删除，无需再隐藏。
    }

    /* v313：进页请求走轻量 dashboard（去掉重的 stats 子查询），timeout 30 秒防老板网络超时 */
    function loadAdminHome(silent) {
      var cachedVersion = '';
      try {
        var cache = sessionStorage.getItem('wnzyq_admin_data');
        if (cache) {
          var c = JSON.parse(cache);
          cachedVersion = c.version || '';
        }
      } catch (e) { if (window.__silent) window.__silent(e); }
      return api('admin/dashboard?v=' + encodeURIComponent(cachedVersion), { timeout: 30000 }).then(function (res) {
        if (res && res.unchanged === true) {
          window.__lastFetchTime = Date.now();
          // v317：数据未变，保持后端分页模式（翻页/搜索/筛选点到才拉）
          if (state._backendPaged === undefined) state._backendPaged = true;
          return;
        }
        if (!res || !res.ok) {
          if (!silent) toast('首页数据加载失败，请刷新重试', 'error');
          return;
        }
        // 解包产品
        if (res.products) {
          state.products = res.products.list || [];
          state.totalProducts = res.products.total || 0;
          state.totalProductPages = res.products.total_pages || 1;
          state.currentProductPage = res.products.page || 1;
          // v317（用户 10-05 18:40）：老板拍板规则1/2/3/4+优化2/3/4，首屏只拿第一页，翻页/搜索/筛选点到才拉+缓存秒出
          state._backendPaged = true;
        }
        // 解包分类
        if (res.categories) {
          state.categories = res.categories;
        }
        // 解包设置
        if (res.settings) {
          state.settings = res.settings;
        }
        // 解包统计（v313：dashboard 只返回轻量 overview，完整明细留给切 stats tab 时 loadStats 拉取）
        if (res.stats) {
          var sr = res.stats;
          state.statsOverview = sr.overview || {};
          state.statsOverviewPrev = sr.overview_prev || null;
          // v313：dashboard 有完整 stats 明细才覆盖（兼容老 home 接口），否则保留缓存/空值
          if (sr.trend && sr.trend.length) {
            state.statsTrendAll = sr.trend || [];
            state.statsTrendAllPrev = sr.trend_prev || [];
            state.statByProduct = sr.byProduct || [];
            state.statByCategory = sr.byCategory || [];
            state.statRecent = sr.recent || [];
            var days = state.statsDays || 7;
            var trendData, trendPrev;
            if (sr.hourly && sr.hourly.length) {
              trendData = sr.hourly.map(function (h) {
                return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
              });
              trendPrev = (sr.hourly_prev && sr.hourly_prev.length === sr.hourly.length) ? sr.hourly_prev.map(function (h) {
                return { day: String(Number(h.hour)), views: h.views, contacts: h.contacts, resource_unlocks: h.resource_unlocks };
              }) : null;
            } else {
              trendData = (sr.trend || []).slice(-days);
              trendPrev = (sr.trend_prev || []).length ? sr.trend_prev.slice(-days) : null;
            }
            state.statsTrend = trendData;
            state.statsTrendPrev = trendPrev || null;
            state.statsByProduct = sr.byProduct || [];
            renderStatCards(state.statsOverview, state.statsCmpPrev ? state.statsOverviewPrev : null);
            renderLineChart(trendData, state.statsCmpPrev ? trendPrev : null);
            renderTrendBars(trendData, state.statsCmpPrev ? trendPrev : null);
            renderStatTables();
          } else {
            // v313：轻量 dashboard 只渲染六卡概览，图表/三表等用户切到 stats tab 再拉
            renderStatCards(state.statsOverview, state.statsCmpPrev ? state.statsOverviewPrev : null);
          }
        }
        // 版本号
        state._homeVersion = res.version || '';
        __saveAdminState();
        // 渲染各面板
        renderProducts();
        renderCategories();
        refreshCatCnts();
        if (state.settings) {
          _safe(function () {
            document.getElementById('setContactUrl').value = state.settings.contact_url || '';
            document.getElementById('annMode').value = state.settings.announcement_mode || 'always';
            syncSelectDisplay(document.getElementById('annMode'));
          });
        }
        window.__lastFetchTime = Date.now();
        // v319（用户 10-05 22:15）：根因→首屏只拿「全部」第一页，切分类/筛选时现场拉取老板看到「点进去才加载」；
        // 修法→首屏成功后后台并行预加载各分类+常用筛选组合第一页到内存缓存，切分类/筛选直接秒出。
        __preloadAdminCategoryPages();
      }).catch(function (e) {
        // v313：失败收骨架走空态 + 明确提示，不让老板永远看灰框
        // v319（用户 10-05 22:15）：根因→登录后首屏网络失败弹「网络不佳」toast，老板首次加载本就慢、体验差；
        // 修法→有缓存时静默失败不弹 toast（骨架已收、缓存已渲染），只在无缓存且无数据时提示一次。
        window.__adminSkelP = false;
        __clearAdminSkel(document.getElementById('productList'));
        __clearAdminSkel(document.getElementById('catList'));
        var _em = document.getElementById('productEmpty');
        // v326（用户 10-06 15:18）：失败收骨架走空态时也按当前筛选条件出对应文案。
        if (_em) { _em.classList.add('show'); var _et = document.getElementById('productEmptyTitle'); if (_et) _et.textContent = __getAdminEmptyText(); }
        var _hasCache = __getAdminCache()._cacheFormat === 'v317' && (__getAdminCache().products || []).length;
        if (!silent && !_hasCache && !(state.products || []).length) {
          toast('网络不佳，请刷新重试', 'error');
        }
      });
    }

    // v319（用户 10-05 22:15）：根因→首屏只拿「全部」第一页，切分类/筛选时现场拉取老板看到「点进去才加载」；
    // 修法→后台并行预加载各分类+常用筛选组合第一页到内存缓存，切分类/筛选直接秒出。上限安全线>500条时跳过并报数。
    function __preloadAdminCategoryPages() {
      var cats = (state.categories || []).filter(function (c) { return !c.parent_id || Number(c.parent_id) === 0; });
      var totalItems = (state.products || []).length + cats.length;
      if (totalItems > 500) {
        try { console.log('[v319] admin 预加载跳过：产品+分类=' + totalItems + ' > 500 安全线'); } catch (e) { if (window.__silent) window.__silent(e); }
        return;
      }
      // 预加载各分类第一页（直接走 api，不动 DOM，避免触发 change 事件）
      cats.forEach(function (c) {
        if (Number(c.id) === 0) return;
        var _k = __adminProductCacheKey(1, '', String(c.id), '');
        if (__adminProductCache[_k]) return; // 已有缓存跳过
        var _qs = '?page=1&page_size=' + ADMIN_PAGE_SIZE + '&cid=' + encodeURIComponent(c.id);
        api('admin/products' + _qs).then(function (res) {
          if (res && res.ok) {
            __adminProductCache[_k] = {
              products: res.list || [],
              totalPages: res.total_pages || 1,
              total: res.total || 0,
              _backendPaged: true,
              timestamp: Date.now()
            };
          }
        }).catch(function () {});
      });
    }

    // ---------- 统计三面板：三角展开按键 + 翻页（一页 20 条，全系统统一，复用资源页翻页样式） ----------
    var STAT_PAGE_SIZE = (window.WN_CONST && window.WN_CONST.ADMIN_PAGE_SIZE) || 20; // v346 条8：改读全站常量
    var statPages = { product: 1, cat: 1, recent: 1 };
    // 展开按键：默认展示，点击隐藏内容（视觉复用资源页分类栏三角展开按键）
    [['statTglProduct', 'statBodyProduct'], ['statTglCat', 'statBodyCat'], ['statTglRecent', 'statBodyRecent']].forEach(function (pair) {
      var tglBtn = document.getElementById(pair[0]), tglBody = document.getElementById(pair[1]);
      if (!tglBtn || !tglBody) return;
      tglBtn.addEventListener('click', function () {
        var collapsed = tglBody.classList.toggle('collapsed');
        tglBtn.classList.toggle('open', !collapsed);
      });
    });
    /* R235（用户 09-22 12:33 派单）：加 onlyKey 参数——翻页回调只重绘被点的那张表，
       另外两张表元素不销毁、错峰淡入动画不重放（全屏跳动的根因）。
       无参调用（切日期档/切 tab 的 loadStats 路径）仍是三表全量刷新——数据真变了，全量合理。 */
    function renderStatTables(onlyKey) {
      /* v348 条34：统计表里的资源名/分类名先转义再拼进表格——
         原写法直接拼 innerHTML，名字里若夹带标签会被当成页面内容执行。 */
      function __escCell(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      var defs = [
        {
          key: 'product', tbodyId: 'statRows', pagerId: 'statPagerProduct', wrapId: 'statWrapProduct',
          list: state.statByProduct || [],
          row: function (r) {
            var tr = document.createElement('tr');
            var status = (r.is_online && !r.is_hidden) ? '显示' : '隐藏';
            tr.innerHTML = '<td>' + __escCell(r.title || '(无标题)') + '</td><td>' + status + '</td><td>' + (r.views || 0) + '</td><td>' + (r.contacts || 0) + '</td><td>' + (r.resource_unlocks || 0) + '</td><td>' + (r.bindings || 0) + '</td>';
            return tr;
          }
        },
        {
          key: 'cat', tbodyId: 'statCatRows', pagerId: 'statPagerCat', wrapId: 'statWrapCat',
          list: state.statByCategory || [],
          row: function (r) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + __escCell(r.name || '') + '</td><td>' + (r.product_count || 0) + '</td><td>' + (r.total_views || 0) + '</td>';
            return tr;
          }
        },
        {
          key: 'recent', tbodyId: 'statRecentRows', pagerId: 'statPagerRecent', wrapId: 'statWrapRecent',
          list: state.statRecent || [],
          row: function (r) {
            var tr = document.createElement('tr');
            var typeText = r.type === 'view' ? '浏览' : (r.type === 'contact' ? '咨询客服' : (r.type === 'resource_unlock' ? '资源码解锁' : r.type));
            tr.innerHTML = '<td>' + __escCell(window.__utcToLocal(r.created_at)) + '</td><td>' + __escCell(typeText) + '</td><td>' + __escCell(r.title || '') + '</td>'; /* R156：UTC→北京时间 */
            return tr;
          }
        }
      ];
      defs.forEach(function (d) {
        if (onlyKey && d.key !== onlyKey) return; /* R235：单表翻页只动这一张，其余不碰 */
        var tbody = document.getElementById(d.tbodyId);
        var pager = document.getElementById(d.pagerId);
        if (!tbody || !pager) return;
        /* R230：骨架检测（资源页同款）——tr 骨架同位置替换、真行不足收尾 */
        var __skels = tbody.querySelectorAll('.admin-skel'); var __reuse = __skels.length > 0;
        if (!__reuse) tbody.innerHTML = '';
        pager.innerHTML = '';
        var totalPages = Math.ceil(d.list.length / STAT_PAGE_SIZE) || 1;
        if (statPages[d.key] > totalPages) statPages[d.key] = totalPages;
        if (statPages[d.key] < 1) statPages[d.key] = 1;
        var start = (statPages[d.key] - 1) * STAT_PAGE_SIZE;
        var frag = document.createDocumentFragment();
        /* R230：真行错峰淡入（资源页同款 20ms/项 180ms 封顶）+ 骨架同位置替换、不足收尾 */
        d.list.slice(start, start + STAT_PAGE_SIZE).forEach(function (r, ri) { var tr = d.row(r); tr.classList.add('stagger-in'); tr.style.animationDelay = Math.min(ri * 20, 180) + 'ms'; frag.appendChild(tr); });
        if (__reuse) {
          var __kids = Array.prototype.slice.call(frag.children);
          var __k = 0;
          for (; __k < __kids.length && __k < __skels.length; __k++) { if (__skels[__k] && __skels[__k].parentNode) __skels[__k].parentNode.replaceChild(__kids[__k], __skels[__k]); }
          for (var __q = __k; __q < __skels.length; __q++) { if (__skels[__q] && __skels[__q].parentNode) __skels[__q].parentNode.removeChild(__skels[__q]); }
        }
        tbody.appendChild(frag);
        if (totalPages > 1) {
          // R14：翻页控件改走全站统一 .uni-pager 公共组件（本样式即源自这里，观感不变 + 新增跳页输入）
          // 翻页后不再调 scrollStatWrap 强制回滚——点翻页时表格本就在视口内，强制对齐块顶正是"屏幕滑一下"的来源
          if (window.buildUniPager) {
            window.buildUniPager(pager, {
              page: statPages[d.key],
              totalPages: totalPages,
              total: d.list.length,
              unit: '条',
              onPage: (function (key) {
                return function (p) { statPages[key] = p; renderStatTables(key); }; /* R235：只重绘本表 */
              })(d.key)
            });
          } else {
            var prev = document.createElement('button');
            prev.textContent = '上一页';
            prev.disabled = statPages[d.key] === 1;
            prev.onclick = (function (key, wrapId) {
              return function () {
                if (statPages[key] > 1) { statPages[key]--; renderStatTables(key); scrollStatWrap(wrapId); } /* R235 */
              };
            })(d.key, d.wrapId);
            var info = document.createElement('span');
            info.className = 'pg-info';
            info.textContent = statPages[d.key] + ' / ' + totalPages + '（共' + d.list.length + '条）';
            var next = document.createElement('button');
            next.textContent = '下一页';
            next.disabled = statPages[d.key] === totalPages;
            next.onclick = (function (key, wrapId) {
              return function () {
                if (statPages[key] < totalPages) { statPages[key]++; renderStatTables(key); scrollStatWrap(wrapId); } /* R235 */
              };
            })(d.key, d.wrapId);
            pager.appendChild(prev);
            pager.appendChild(info);
            pager.appendChild(next);
          }
        }
      });
    }
    // R14 修复：翻页后屏幕抖动/滑一下的根因 = 原先每次点上一页/下一页都 scrollIntoView({behavior:'smooth', block:'start'})
    // 强制把统计块平滑滚到视口顶部，视口就"滑一下"。现已彻底移除翻页后的强制回滚：
    // 点翻页时表格本就在视口内，保持视口纹丝不动。此函数保留仅供其他调用方兜底（当前无调用）。
    function scrollStatWrap(wrapId) {
      // no-op：翻页不再强制滚动（R14）
      return;
    }

    // 近7/30天切换：本地重绘图表，不发新请求（趋势数据已在初始化预加载，表格/总览为30天范围保持不变）
    function applyStatsDays() {
      if (!state.statsTrendAll || !state.statsTrendAll.length) { loadStats(); return; }
      var days = state.statsDays || 7;
      var trendData = state.statsTrendAll.slice(-days);
      // R57：上期趋势同样取末 N 天（与本期按索引对齐）
      var allPrev = state.statsTrendAllPrev || [];
      var trendPrev = allPrev.length ? allPrev.slice(-days) : null;
      state.statsTrend = trendData;
      state.statsTrendPrev = trendPrev || null;
      renderLineChart(trendData, state.statsCmpPrev ? trendPrev : null);
      renderTrendBars(trendData, state.statsCmpPrev ? trendPrev : null);
      /* R173（用户 00:28）：删掉切日期档时对 panel-stats 的 stats-fade-in 重触发（remove+强制回流+add）
         ——正是"切换日期全页面都闪一次"的直接根因（fade 动画整页重放）；切日期只重画图表，不再全页淡入 */
    }

    // ---------- 分类管理 ----------
    // 实时计算分类资源数（一级分类含全部二级子分类汇总），并同步更新已渲染的分类行文本（不整体重渲染，避免闪烁/丢选中状态）
    function refreshCatCnts() {
      var prods = state.products || [];
      var cats = state.categories || [];
      var direct = {};
      prods.forEach(function (p) { var cid = Number(p.cid); if (cid) direct[cid] = (direct[cid] || 0) + 1; });
      var hasProds = prods.length > 0;
      var byId = {};
      cats.forEach(function (c) { byId[Number(c.id)] = c; });
      cats.forEach(function (c) { var id = Number(c.id); c.cnt = hasProds ? (direct[id] || 0) : (Number(c.cnt) || 0); });
      cats.forEach(function (c) {
        if (Number(c.parent_id) === 0 && Number(c.id) !== 0) {
          var sum = c.cnt;
          cats.forEach(function (s) { if (Number(s.parent_id) === Number(c.id)) sum += (Number(s.cnt) || 0); });
          c.totalCnt = sum;
        } else { c.totalCnt = undefined; }
      });
      if (byId[0]) byId[0].cnt = hasProds ? prods.length : (Number(byId[0].cnt) || 0);
      var box = document.getElementById('catList');
      if (box) {
        box.querySelectorAll('.cat-row').forEach(function (row) {
          var rid = row.dataset.id; if (rid === undefined || rid === null) return;
          var ref = null;
          if (String(rid).charAt(0) === 'v') { ref = byId[Number(String(rid).slice(1))] || null; }
          else { ref = byId[Number(rid)] || null; }
          if (!ref) return;
          var cntEl = row.querySelector('.c-count');
          if (cntEl) cntEl.textContent = (ref.totalCnt !== undefined ? ref.totalCnt : (ref.cnt || 0)) + ' 件资源';
        });
      }
    }

    function loadCategories(silent) { if (window.__catLoading) { if (!silent) window.__catLoading.then(function () { renderCategories(state.categories); }); return window.__catLoading; } /* R281：silent=切回窗口静默重拉——不发重复请求、不弹 toast；diff 没变不重画 */
      /* R230（老板 09-21 21:10）：分类列表首载先铺骨架（分类无分页——按常显 8 行铺，真行不足收尾） */
      var _cbox0 = document.getElementById('catList');
      if (!silent && _cbox0 && !_cbox0.children.length) { window.__catSkelP = true; renderCatSkeleton(); }
      var _snapC = silent ? __adminCatSig(state.categories) : null;
      window.__catLoading = api('admin/categories').then(function (res) { window.__catLoading = null;
      // (分类请求已合并到上一行 window.__catLoading 的 then 回调，避免重复请求)
        // 修复：失败分支也要返回 res，让 loadProducts 等调用方能正确感知失败状态
        if (!res.ok) {
          if (!silent) { window.__catSkelP = false; __clearAdminSkel(_cbox0); toast(res.msg || '加载失败，网络开小差了', 'error'); } /* R281：静默失败不动画面不弹 toast */
          return res; }
        window.__lastFetchTime = Date.now(); /* R281：成功拉取记录时间戳 */
        var _ordered = orderCats((res.list || []).map(function (c) { return { id: Number(c.id), parent_id: Number(c.parent_id), name: c.name, sort: Number(c.sort) || 0, is_hidden: c.is_hidden, cnt: Number(c.cnt) || 0 }; }));
        if (silent && __adminCatSig(_ordered) === _snapC) return res; /* R281：数据没变——纹丝不动（不重画不重存） */
        state.categories = _ordered;
refreshCatCnts();
        window.__catSkelP = false;
        renderCategories(state.categories);
        __saveAdminState();
        return res;
      });
      // 修复（P0）：此前漏了 return，首次调用返回 undefined，loadProducts 的 (window.__catLoading || loadCategories()).then(...)
      // 直接抛 "Cannot read properties of undefined (reading 'then')"，导致资源列表/全选/分类筛选全部失效
      return window.__catLoading;
    }

    // 统一的层级排序：默认“全部”(id=0)在最前，随后每个一级分类紧跟其二级分类（同级按 sort）
    function orderCats(list) {
      var tops = list.filter(function (c) { return c.parent_id === 0; })
        .sort(function (a, b) { return (a.id === 0 ? -1 : b.id === 0 ? 1 : 0) || (a.sort || 0) - (b.sort || 0); });
      var out = [];
      tops.forEach(function (top) {
        out.push(top);
        if (top.id === 0) return;
        list.filter(function (c) { return c.parent_id === top.id; })
          .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); })
          .forEach(function (s) { out.push(s); });
      });
      // 异常：找不到父级的二级分类也补上
      list.forEach(function (c) {
        if (c.parent_id !== 0 && !out.find(function (x) { return x.id === c.id; })) out.push(c);
      });
      return out;
    }
    function renderCategories(list) {
      var box = document.getElementById('catList'); var _minH = box.offsetHeight; if (_minH > 0) box.style.minHeight = _minH + 'px';
      /* R230：骨架检测（资源页同款）——骨架行同位置替换、真行不足收尾；骨架期空数据不抢跑 */
      var __skels = box.querySelectorAll('.admin-skel'); var __reuse = __skels.length > 0;
      if (window.__catSkelP && !list.length) return;
      if (!__reuse) box.innerHTML = '';

      // 按层级分组：一级分类在前，每个一级分类下跟其二级分类
      var topLevel = list.filter(function (c) { return c.parent_id === 0; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      var ordered = [];
      topLevel.forEach(function (top) {
        ordered.push(top);
        // id=0 的"全部"是虚拟根分类，parent_id===0 表示一级分类而非"全部"的子级，
        // 跳过它，避免把所有一级分类重复当成其子分类（修复分类重复显示两个的 bug）
        if (top.id === 0) return;
        if (!ordered.some(function (x) { return x.virtual && Number(x.parent_id) === Number(top.id); }) && !list.some(function (c) { return Number(c.parent_id) === Number(top.id) && String(c.name || '').trim() === '全部'; })) { var _vt = list.find(function (x) { return Number(x.id) === Number(top.id); }); ordered.push({ id: 'v' + top.id, parent_id: top.id, name: '全部', sort: -1, virtual: true, cnt: (_vt ? (_vt.totalCnt !== undefined ? _vt.totalCnt : (_vt.cnt || 0)) : 0) }); } list.filter(function (c) { return c.parent_id === top.id; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }).forEach(function (sub) {
          ordered.push(sub);
        });
      });
      // 没有父级的（异常数据）也加上
      list.filter(function (c) { return c.parent_id !== 0 && !topLevel.find(function (t) { return t.id === c.parent_id; }); })
        .forEach(function (c) { ordered.push(c); });

      ordered.forEach(function (c, ci) {
        if (c.virtual) { var _vrow = document.createElement('div'); _vrow.className = 'cat-row cat-sub'; _vrow.dataset.id = c.id; _vrow.dataset.parentId = c.parent_id; // “全部”项不渲染选中框（固定项）
          var _vh=document.createElement('span');_vh.className='drag-handle';_vh.draggable=false;_vh.style.opacity='0.35';_vh.style.cursor='default';_vh.title='固定项不可拖动';_vh.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>'; /* R285 条19 */_vrow.appendChild(_vh); var _vp=document.createElement('span'); _vp.style.cssText='width:20px;flex-shrink:0;'; _vp.setAttribute('aria-hidden','true'); _vrow.appendChild(_vp); var _vnm = document.createElement('span'); _vnm.className = 'c-name'; _vnm.style.cssText = 'font-size:14px;color:#333;flex:1;text-align:left;white-space:nowrap;min-width:40px;'; _vnm.textContent = '全部'; _vrow.appendChild(_vnm); var _vmeta = document.createElement('div'); _vmeta.className = 'c-meta'; var _vph = document.createElement('span'); _vph.className = 'row-btn'; _vph.style.cssText = 'visibility:hidden;pointer-events:none;'; _vph.textContent = '固定'; _vmeta.appendChild(_vph); var _vs = document.createElement('span'); _vs.className = 'c-sort'; _vs.textContent = '排序:1'; _vmeta.appendChild(_vs); var _vcnt = document.createElement('span'); _vcnt.className = 'c-count'; _vcnt.textContent = (c.cnt || 0) + ' 件资源'; _vcnt.style.cssText = 'color:var(--gray-mid);cursor:pointer;'; _vcnt.title = '点击查看该分类下的资源'; _vcnt.addEventListener('click', function (e) { e.stopPropagation(); document.querySelector('.tab[data-tab="products"]').click(); initFilterCatPicker(); var _fc2 = document.getElementById('filterCat'); if (_fc2) { _fc2.value = c.parent_id; renderProducts(); } toast('已筛选分类：全部', 'success'); }); _vmeta.appendChild(_vcnt); var _vedit = document.createElement('button'); _vedit.className = 'row-btn'; _vedit.textContent = '编辑'; _vedit.style.cssText = 'visibility:hidden;pointer-events:none;'; var _vdel = document.createElement('button'); _vdel.className = 'row-btn danger'; _vdel.textContent = '删除'; _vdel.style.cssText = 'visibility:hidden;pointer-events:none;'; _vmeta.appendChild(_vedit); _vmeta.appendChild(_vdel); _vrow.appendChild(_vmeta); if (state.catExpanded[c.parent_id] === false) { _vrow.style.display = 'none'; }
          _vrow.classList.add('stagger-in'); _vrow.style.animationDelay = Math.min(ci * 20, 180) + 'ms'; /* R230：错峰淡入（资源页同款） */
          if (__reuse && __skels[ci]) __skels[ci].parentNode.replaceChild(_vrow, __skels[ci]); else box.appendChild(_vrow);
          return; }
        var row = document.createElement('div');
        row.className = 'cat-row';
        row.draggable = false;
        row.dataset.id = c.id; row.dataset.parentId = c.parent_id;
        if (Number(c.id) !== 0) { var handle = document.createElement('span'); handle.className = 'drag-handle'; handle.draggable = true; handle.title = '拖动排序'; handle.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>'; /* R285 条19：拖拽抓手换六点网格图标 */ row.appendChild(handle); }
        else { // 根"全部"(id=0) 固定项：用禁用手柄+固定槽位占位，保证名称列与一级分类严格对齐
          var _h0 = document.createElement('span'); _h0.className = 'drag-handle'; _h0.draggable = false; _h0.style.opacity = '0.35'; _h0.style.cursor = 'default'; _h0.title = '固定项不可拖动'; _h0.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg>'; row.appendChild(_h0);
          var _sp0 = document.createElement('span'); _sp0.style.cssText = 'width:56px;flex-shrink:0;'; _sp0.setAttribute('aria-hidden', 'true'); row.appendChild(_sp0);
        }
        var isTop = c.parent_id === 0;
        if (!isTop) row.classList.add('cat-sub'); // R22：二级行标记类（手机端缩进用类选择器，比内联属性匹配稳）

        // 拖拽事件（同级别内排序）
        row.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', c.id);
          this.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragend', function () {
          this.classList.remove('dragging');
          document.querySelectorAll('.cat-row').forEach(function (r) { r.classList.remove('drag-over'); });
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
          var targetId = c.id;
          if (draggedId === targetId) return;
          reorderCategories(draggedId, targetId);
        });

        // "全部"(id=0) 为固定保底分类，不提供选中框
        if (Number(c.id) !== 0) {
          if (String(c.name || '').trim() !== '全部') { var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'cat-check';
          cb.dataset.id = c.id;
          cb.style.cssText = 'width:20px;height:20px;cursor:pointer;flex-shrink:0;accent-color:var(--blue1);';
          cb.checked = !!state.catSelected[c.id]; cb.addEventListener('change', function () { state.catSelected[c.id] = this.checked; updateCatBatchBar(); });
          row.appendChild(cb); } else { var _cbp = document.createElement('span'); _cbp.style.cssText = 'width:20px;flex-shrink:0;'; _cbp.setAttribute('aria-hidden', 'true'); row.appendChild(_cbp); }
        }

        // R120：c-meta 包裹排序/资源数/状态/操作按钮——手机端两行网格第二行（与所有行同构，列严格对齐）
        var meta = document.createElement('div');
        meta.className = 'c-meta';

        var name = document.createElement('span');
        name.className = 'c-name';
        name.style.fontWeight = isTop ? '700' : '400';
        name.style.fontSize = isTop ? '16px' : '14px';
        name.style.color = isTop ? '#1a1a1a' : '#333';
        // R25：二级名称属性对齐分类筛选面板 .cp-item.cp-sub（weight 400 / size 14px / color #333，不再压灰）；缩进由类规则 .cat-row.cat-sub .c-name 统一控制
        name.textContent = c.name;

        // 一级分类展开/收起箭头
        if (isTop && c.id !== 0) {
          var toggleBtn = document.createElement('span');
          toggleBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;cursor:pointer;margin-right:4px;color:var(--blue1);transition:transform 0.15s ease;user-select:none;filter:drop-shadow(0 1px 2px rgba(30,136,229,0.3));';
          var hasChildren = list.some(function (sub) { return sub.parent_id === c.id; }) || ordered.some(function (x) { return x.virtual && Number(x.parent_id) === Number(c.id); });
          if (hasChildren) {
            toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:100%;height:100%;display:block"><path d="M7 10l5 5 5-5z"/></svg>';
            toggleBtn.style.transform = state.catExpanded[c.id] === false ? 'rotate(-90deg)' : 'rotate(0deg)';
            toggleBtn.title = state.catExpanded[c.id] === false ? '展开子分类' : '收起子分类';
          } else {
            toggleBtn.textContent = '•';
            toggleBtn.style.cursor = 'default';
            toggleBtn.style.color = '#ccc';
          }
          toggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!hasChildren) return;
            state.catExpanded[c.id] = state.catExpanded[c.id] === false ? true : false;
            var subRows = box.querySelectorAll('.cat-row[data-parent-id="' + c.id + '"]'); subRows.forEach(function (sr) { sr.style.display = state.catExpanded[c.id] ? '' : 'none'; }); toggleBtn.style.transform = state.catExpanded[c.id] === false ? 'rotate(-90deg)' : 'rotate(0deg)'; toggleBtn.title = state.catExpanded[c.id] === false ? '展开子分类' : '收起子分类';
          });
          row.appendChild(toggleBtn);
        }

        // 二级分类：如果父级分类收起，则隐藏
        if (!isTop) {
          var parentExpanded = state.catExpanded[c.parent_id] !== false;
          if (!parentExpanded) {
            row.style.display = 'none';
          }
        }

        // 级别标签
        var levelBadge = document.createElement('span');
        levelBadge.className = 'badge ' + (isTop ? 'on' : '');
        levelBadge.style.background = c.id === 0 ? '#fff3e0' : (isTop ? '#e3f2fd' : '#f5f5f5');
        levelBadge.style.color = c.id === 0 ? '#ef6c00' : (isTop ? '#1976d2' : '#999');
        levelBadge.textContent = ''; levelBadge.style.display = 'none';

        // R82：显示/隐藏切换改用与编辑同款的胶囊按钮（点击直接切换），不再用下拉框
        if (Number(c.id) !== 0) {
          var catStatusBtn = document.createElement('button');
          catStatusBtn.className = 'row-btn status-btn ' + (c.is_hidden ? 'status-hidden' : 'status-online');
          catStatusBtn.textContent = c.is_hidden ? '隐藏' : '显示';
          catStatusBtn.title = '点击切换为' + (c.is_hidden ? '显示' : '隐藏（资源页不显示）');
          catStatusBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (catStatusBtn.disabled) return;
            var nowHidden = !c.is_hidden; var prev = !!c.is_hidden; if (prev === nowHidden) return;
            catStatusBtn.disabled = true;
            c.is_hidden = nowHidden;
            this.textContent = nowHidden ? '隐藏' : '显示';
            this.classList.remove('status-online', 'status-hidden'); this.classList.add(nowHidden ? 'status-hidden' : 'status-online');
            this.title = '点击切换为' + (nowHidden ? '显示' : '隐藏（资源页不显示）');
            api('admin/categories/' + c.id, { method: 'PUT', body: JSON.stringify({ is_hidden: nowHidden }) }).then(function (res) {
              catStatusBtn.disabled = false;
              if (!res.ok) { c.is_hidden = prev; toast(res.msg || '更新失败', 'error'); } else { clearCache(); }
            }).catch(function () {
              catStatusBtn.disabled = false;
              toast('更新失败，请重试', 'error');
            });
          }); meta.appendChild(catStatusBtn);
        }

        var sort = document.createElement('span');
        sort.className = 'c-sort';
        sort.textContent = '排序:' + (ordered.filter(function (x) { return x.parent_id === c.parent_id; }).indexOf(c) + 1);

        var cnt = document.createElement('span');
        cnt.className = 'c-count';
        cnt.textContent = (c.totalCnt !== undefined ? c.totalCnt : (c.cnt || 0)) + ' 件资源';
        cnt.style.cursor = 'pointer';
        cnt.style.color = 'var(--gray-mid)';
        cnt.style.textDecoration = 'none';
        cnt.title = '点击查看该分类下的资源';
        cnt.addEventListener('click', function (e) {
          e.stopPropagation();
          // 切换到资源管理标签
          document.querySelector('.tab[data-tab="products"]').click();
          // 设置分类筛选
          initFilterCatPicker(); var filterCat = document.getElementById('filterCat');
          if (filterCat) {
            filterCat.value = c.id;
            renderProducts();
          }
          toast('已筛选分类：' + c.name, 'success');
        });

        row.appendChild(name);
        // 级别标签放到最前（复选框之后、展开箭头之前），一眼看出层级
        row.insertBefore(levelBadge, (typeof toggleBtn !== 'undefined' && toggleBtn) || (row.firstChild && row.firstChild.nextSibling && row.firstChild.nextSibling.nextSibling) || null);
        meta.appendChild(sort);
        meta.appendChild(cnt);

        if (Number(c.id) !== 0) {
          var editBtn = document.createElement('button');
          editBtn.className = 'row-btn';
          editBtn.textContent = '编辑';
          editBtn.addEventListener('click', function () { openCatEdit(c); });
          var delBtn = document.createElement('button');
          delBtn.className = 'row-btn danger';
          delBtn.textContent = '删除';
          delBtn.addEventListener('click', function () {
            /* v330 条26：分类删除同样给 10 秒后悔时间——先本地移除，10 秒后才真提交，撤销=原样还原 */
            var _catSnap = state.categories.slice();
            var _cidSnap = (state.products || []).map(function (p) { return p.cid; });
            var __removeLocal = function () {
              var _delIds = [Number(c.id)];
              state.categories.forEach(function (x) { if (Number(x.parent_id) === Number(c.id)) _delIds.push(Number(x.id)); });
              state.categories = state.categories.filter(function (x) { return _delIds.indexOf(Number(x.id)) === -1; });
              (state.products || []).forEach(function (p) { if (_delIds.indexOf(Number(p.cid)) !== -1) p.cid = 0; });
              return _delIds;
            };
            var _delIds0 = __removeLocal();
            try {
              document.querySelectorAll('#catList .cat-row').forEach(function (r) { if (_delIds0.indexOf(Number(r.dataset.id)) !== -1) { r.style.transition = 'opacity var(--dur-fast, .10s) ease'; r.style.opacity = '0'; } });
              setTimeout(function () { renderCategories(state.categories); refreshCatCnts(); renderProducts(); initFilterCatPicker(); }, 120);
            } catch (e0) { if (window.__silent) window.__silent(e0); }
            __undoable(
              '已删除分类「' + (c.name || '未命名') + '」',
              function () {
                api('admin/categories/' + c.id, { method: 'DELETE' }).then(function (res) {
                  if (res && res.ok) { clearCache(); silentSyncCategories(); }
                  else { toast((res && res.msg) || '删除失败', 'error'); __restoreCat(); }
                }).catch(function () { toast('删除失败，请重试', 'error'); __restoreCat(); });
              },
              function () { __restoreCat(); }
            );
            function __restoreCat() {
              state.categories = _catSnap.slice();
              (state.products || []).forEach(function (p, i) { if (_cidSnap[i] !== undefined) p.cid = _cidSnap[i]; });
              renderCategories(state.categories); refreshCatCnts(); renderProducts(); initFilterCatPicker();
            }
          });
          meta.appendChild(editBtn);
          meta.appendChild(delBtn);
        }
        else { // 根"全部"(id=0)：右侧用隐藏占位对齐状态框/按钮列（与虚拟"全部"行同一套占位方式，保证列对齐）
          var _ph0 = document.createElement('span'); _ph0.className = 'row-btn'; _ph0.style.cssText = 'visibility:hidden;pointer-events:none;'; _ph0.textContent = '固定'; _ph0.setAttribute('aria-hidden', 'true'); meta.appendChild(_ph0);
          var _pe0 = document.createElement('button'); _pe0.className = 'row-btn'; _pe0.textContent = '编辑'; _pe0.style.cssText = 'visibility:hidden;pointer-events:none;';
          var _pd0 = document.createElement('button'); _pd0.className = 'row-btn danger'; _pd0.textContent = '删除'; _pd0.style.cssText = 'visibility:hidden;pointer-events:none;';
          meta.appendChild(_pe0); meta.appendChild(_pd0);
        }

        row.appendChild(meta);
        row.classList.add('stagger-in'); row.style.animationDelay = Math.min(ci * 20, 180) + 'ms'; /* R230：错峰淡入（资源页同款 20ms/项 180ms 封顶） */
        if (__reuse && __skels[ci]) __skels[ci].parentNode.replaceChild(row, __skels[ci]); else box.appendChild(row);
        box.style.minHeight = '';
      });
      /* R230：真实条数少于骨架数时收尾移除多余骨架（资源页同款） */
      if (__reuse) { for (var __cj = ordered.length; __cj < __skels.length; __cj++) { if (__skels[__cj] && __skels[__cj].parentNode) __skels[__cj].parentNode.removeChild(__skels[__cj]); } }
    }

    setTimeout(function () { var _cb = document.getElementById('catList'); if (_cb) { _cb.classList.remove('prod-fade'); void _cb.offsetWidth; _cb.classList.add('prod-fade'); } }, 10);
    document.getElementById('addCatBtn').addEventListener('click', function () { openCatEdit(null); });    document.getElementById('catSelectAll').addEventListener('change', function () { var on = this.checked; document.querySelectorAll('.cat-check').forEach(function (cb) { cb.checked = on; state.catSelected[Number(cb.dataset.id)] = on; }); updateCatBatchBar(); });

    // ---------- 分类批量操作 ----------
    function updateCatBatchBar() {
      var checks = document.querySelectorAll('.cat-check:checked');
      var count = checks.length;
      var bar = document.getElementById('catBatchBar');
      document.getElementById('catBatchCount').textContent = count;      var allBox = document.getElementById('catSelectAll'); if (allBox) allBox.checked = count > 0 && count === document.querySelectorAll('.cat-check').length;
      bar.classList.toggle('show', count > 0);
    }
    // 批量隐藏
    document.getElementById('catBatchHide').addEventListener('click', function () {
      var ids = Array.from(document.querySelectorAll('.cat-check:checked')).map(function (cb) { return Number(cb.dataset.id); }).filter(function (id) { return !isNaN(id); });
      if (ids.length === 0) return;
      showConfirm('批量隐藏', '确定隐藏选中的 ' + ids.length + ' 个分类？隐藏后资源页不显示。', function (closeConfirm) { /* v336 条151：分类批量操作也在收口名单 */
        batchCatAction(ids, 'hide', closeConfirm);
      });
    });
    // 批量显示
    document.getElementById('catBatchShow').addEventListener('click', function () {
      var ids = Array.from(document.querySelectorAll('.cat-check:checked')).map(function (cb) { return Number(cb.dataset.id); }).filter(function (id) { return !isNaN(id); });
      if (ids.length === 0) return;
      showConfirm('批量显示', '确定显示选中的 ' + ids.length + ' 个分类？', function (closeConfirm) {
        batchCatAction(ids, 'show', closeConfirm);
      });
    });
    // 批量删除
    document.getElementById('catBatchDel').addEventListener('click', function () {
      var ids = Array.from(document.querySelectorAll('.cat-check:checked')).map(function (cb) { return Number(cb.dataset.id); }).filter(function (id) { return !isNaN(id); });
      if (ids.length === 0) return;
      showConfirm('批量删除', '确定删除选中的 ' + ids.length + ' 个分类？其下资源将归入"全部"，子分类也会一并删除，不可恢复。', function (closeConfirm) {
        batchCatAction(ids, 'delete', closeConfirm);
      });
    });
    // 取消选择
    document.getElementById('catBatchCancel').addEventListener('click', function () {
      document.querySelectorAll('.cat-check:checked').forEach(function (cb) { cb.checked = false; state.catSelected[Number(cb.dataset.id)] = false; });
      updateCatBatchBar();
    });
    // 执行批量操作
    function batchCatAction(ids, action, closeConfirm) {
      if (ids.indexOf(0) !== -1) { if (closeConfirm) closeConfirm(); toast('“全部”为保底根分类，不可隐藏/显示/删除', 'error'); return; }
      var targetIds = ids.slice();
      if (action === 'hide' || action === 'show') {
        ids.forEach(function (pid) {
          state.categories.forEach(function (c) {
            if (c.parent_id === pid && targetIds.indexOf(c.id) === -1) targetIds.push(c.id);
          });
        });
      }
      var done = 0, fail = 0;
      ids = targetIds; // 后续遍历/完成判定统一使用级联后的集合
      ids.forEach(function (id) {
        var req;
        if (action === 'hide') {
          req = api('admin/categories/' + id, { method: 'PUT', body: JSON.stringify({ is_hidden: true }) });
        } else if (action === 'show') {
          req = api('admin/categories/' + id, { method: 'PUT', body: JSON.stringify({ is_hidden: false }) });
        } else {
          req = api('admin/categories/' + id, { method: 'DELETE' });
        }
        req.then(function (res) {
          if (res.ok) done++; else fail++;
          if (done + fail === ids.length) {
            if (closeConfirm) closeConfirm();
            var actionName = action === 'hide' ? '隐藏' : (action === 'show' ? '显示' : '删除');
            toast('批量' + actionName + '完成：成功 ' + done + ' 项，失败 ' + fail + ' 项', fail > 0 ? 'error' : 'success');
            clearCache();
            // R178：本地即时生效（隐藏/显示/删除按级联集合），后台静默同步；
            // 原先 loadCategories()（+删除时 loadProducts()）全量重拉，慢网下要等网络往返
            var __after7 = function () {
              renderCategories(state.categories);
              refreshCatCnts();
              silentSyncCategories();
              if (action === 'delete') silentSyncProducts();
            };
            if (action === 'delete') {
              var _gone = ids.slice();
              state.categories.forEach(function (x) { if (ids.indexOf(Number(x.parent_id)) !== -1) _gone.push(Number(x.id)); });
              state.categories = state.categories.filter(function (x) { return _gone.indexOf(Number(x.id)) === -1; });
              (state.products || []).forEach(function (p) { if (_gone.indexOf(Number(p.cid)) !== -1) p.cid = 0; });
              /* R183 条7：批量删除分类塌缩动画（与单个删除同款） */
              var __n8 = 0;
              document.querySelectorAll('#catList .cat-row').forEach(function (r) { if (_gone.indexOf(Number(r.dataset.id)) !== -1) { __n8++; r.style.transition = 'opacity var(--dur-fast, .10s) ease'; r.style.opacity = '0'; } });
              renderProducts(); initFilterCatPicker();
              setTimeout(__after7, __n8 ? 120 : 0);
            } else {
              state.categories.forEach(function (x) { if (ids.indexOf(Number(x.id)) !== -1) x.is_hidden = (action === 'hide') ? 1 : 0; });
              __after7();
            }
      ;
          }
        }).catch(function () { fail++; if (done + fail === ids.length && closeConfirm) closeConfirm(); });
      });
    }

    function openCatEdit(c) {
      if (catDraftPending && catDraftFor === (c ? c.id : null)) { catDraftPending = false; catModalTitle.textContent = c ? '编辑分类' : '新增分类'; catMask.classList.add('open'); if (window.__modalScroll) __modalScroll.open(catMask, c ? c.id : 'new'); return; } // 遮罩关闭暂存：仅同一分类保留输入继续编辑
      state.catEditingId = c ? c.id : null;
      catDraftFor = c ? c.id : null; // R257：记录当前暂存归属（此前从未赋值，已有分类暂存后开「新增」会误恢复）
      catModalTitle.textContent = c ? '编辑分类' : '新增分类';
      catName.value = c ? (c.name || '') : '';
      catSort.value = c ? (c.sort || 0) : 0;
      catHidden.checked = c ? !!c.is_hidden : false;

      // 所属一级分类：自制级联选择器（只显示一级分类，排除自己，面板 fixed 不裁剪）
      try { var _cpp = document.getElementById('catParentPicker'), _cph = document.getElementById('catParentValue'), _cpd = document.getElementById('catParentDisplay'), _cppan = document.getElementById('catParentPanel'); if (_cpp && _cph && _cpd && _cppan) buildCatPicker(_cpp, _cph, _cpd, _cppan, (c && c.parent_id > 0) ? (Number(c.parent_id) || 0) : 0, { topOnly: true, excludeZero: true, }); } catch (e) { if (window.__silent) window.__silent(e); }
      // 设置级别
      var isChild = c && c.parent_id > 0;
      document.querySelector('input[name="catLevel"][value="0"]').checked = !isChild;
      document.querySelector('input[name="catLevel"][value="1"]').checked = isChild;
      catParentWrap.style.display = isChild ? 'block' : 'none';
      catMask.classList.add('open');
      /* R241：滚动位置按「弹窗 × 分类」独立 */
      if (window.__modalScroll) __modalScroll.open(catMask, c ? c.id : 'new');
    }

    // 级别切换：选二级时显示父级选择
    document.querySelectorAll('input[name="catLevel"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        catParentWrap.style.display = this.value === '1' ? 'block' : 'none';
        if (this.value === '1') { try { var _cpp2 = document.getElementById('catParentPicker'), _cph2 = document.getElementById('catParentValue'), _cpd2 = document.getElementById('catParentDisplay'), _cppan2 = document.getElementById('catParentPanel'); if (_cpp2 && _cph2 && _cpd2 && _cppan2) buildCatPicker(_cpp2, _cph2, _cpd2, _cppan2, 0, { topOnly: true, excludeZero: true, }); } catch (e) { if (window.__silent) window.__silent(e); } }
      });
    });

    // 分类拖拽排序（同级别内排序）
    var __reorderBusy = false;
    function reorderCategories(draggedId, targetId) {
      if (__reorderBusy) return;
      var list = state.categories.slice();
      var dragged = list.find(function (c) { return c.id === draggedId; });
      var target = list.find(function (c) { return c.id === targetId; });
      if (!dragged || !target) return;
      if (dragged.parent_id !== target.parent_id) { toast('只能在同级别分类内排序', 'error'); return; }
      var sameLevel = list.filter(function (c) { return c.parent_id === dragged.parent_id; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      var di = sameLevel.indexOf(dragged); var ti = sameLevel.indexOf(target); if (di < 0 || ti < 0) return;
      sameLevel.splice(di, 1); sameLevel.splice(ti > di ? ti - 1 : ti, 0, dragged);
      var changed = []; sameLevel.forEach(function (c, i) { if (Number(c.sort) !== i) { c.sort = i; changed.push(c); } });
      if (!changed.length) return;
      __reorderBusy = true;
      var seq = changed.map(function (c) { return api('admin/categories/' + c.id, { method: 'PUT', body: JSON.stringify({ sort: c.sort }) }); });
      Promise.all(seq).then(function (reses) {
        __reorderBusy = false;
        if (reses.every(function (r) { return r && r.ok; })) {
          toast('排序已更新', 'success'); clearCache();
          // R178：拖拽后本地已是目标顺序，静默同步替代 loadCategories() 全量重拉
          state.categories = orderCats(state.categories);
          renderCategories(state.categories);
          silentSyncCategories();
        }
        else toast('排序保存失败', 'error');
      }).catch(function () {
        __reorderBusy = false;
        toast('排序保存失败，请重试', 'error');
      });
    }

    var catSaving = false;
    var catDraftPending = false; // 分类弹窗：遮罩关闭暂存输入，取消/保存后丢弃
    var catDraftFor = null; // 暂存对应的分类 id（防止打开其他分类时误保留）
    catOk.addEventListener('click', function () {
      if (catSaving) return; // 防重复提交
      catSaving = true; // 立即锁定，防止快速双击
      catOk.disabled = true;
      catOk.style.opacity = '0.6';

      var name = catName.value.trim();
      var sort = Number(catSort.value) || 0;
      var isChild = document.querySelector('input[name="catLevel"]:checked').value === '1';
      var parentId = isChild ? Number(document.getElementById('catParentValue') ? document.getElementById('catParentValue').value : 0) || 0 : 0;
      var isHidden = catHidden.checked;
      if (!name) {
        toast('请填写分类名称', 'error');
        catSaving = false;
        catOk.disabled = false;
        catOk.style.opacity = '';
        return;
      }
      if (isChild && !parentId) {
        toast('请选择所属一级分类', 'error');
        catSaving = false;
        catOk.disabled = false;
        catOk.style.opacity = '';
        return;
      }
      var data = { name: name, sort: sort, parent_id: parentId, is_hidden: isHidden };
      // 修复：原先在请求发出前就提示"保存成功"并关闭弹窗，失败时造成"假成功"；提示与关窗移到成功分支
      var _catOkText = catOk.textContent;
      // R293（用户 09-30）：恢复「确定中」忙碌态——R292 撤掉，老板要求恢复并全系统排查补齐
      if (window.__btnBusy) window.__btnBusy(catOk, '确定中');
      var req = state.catEditingId
        ? api('admin/categories/' + state.catEditingId, { method: 'PUT', body: JSON.stringify(data) })
        : api('admin/categories', { method: 'POST', body: JSON.stringify(data) });

      req.then(function (res) {
        catSaving = false;
        if (res && res.ok) {
          catDraftPending = false; catMask.classList.remove('open');
          toast('分类已保存', 'success'); if (window.__haptic) window.__haptic(); /* R183 条12 */
          clearCache();
          // R178：本地即时更新分类面板（不等 loadCategories 重拉的网络往返）；
          // 编辑=合并字段重排，新增=后端返回 id 时本地插入（拿不到 id 才退回重拉）
          var _ce = state.catEditingId
            ? (state.categories || []).find(function (x) { return Number(x.id) === Number(state.catEditingId); })
            : null;
          if (_ce) {
            Object.assign(_ce, { name: name, sort: sort, parent_id: parentId, is_hidden: isHidden ? 1 : 0 });
            state.categories = orderCats(state.categories);
          } else if (res.id) {
            state.categories.push({ id: Number(res.id), name: name, sort: sort, parent_id: parentId, is_hidden: isHidden ? 1 : 0, cnt: 0 });
            state.categories = orderCats(state.categories);
          }
          if (_ce || res.id) {
            renderCategories(state.categories);
            refreshCatCnts();
            renderProducts(); // 资源行的分类名/筛选口径同步本地生效
            initFilterCatPicker();
            silentSyncCategories();
          } else {
            loadCategories();
          }
        } else {
          catSaving = false; catOk.disabled = false; catOk.style.opacity = ''; catOk.textContent = _catOkText;
          toast(res.msg || '保存失败', 'error');
        }
      }).catch(function () {
        catSaving = false; catOk.disabled = false; catOk.style.opacity = ''; catOk.textContent = _catOkText;
        toast('网络开小差了，请稍后再试', 'error'); // v294：087 网络提示统一
      });
    });

    catCancel.addEventListener('click', function () { catDraftPending = false; catMask.classList.remove('open'); });
    catMask.addEventListener('click', function (e) { if (e.target === catMask) { catDraftPending = true; catMask.classList.remove('open'); } }); // R257（老板 09-23 19:08）：点外=暂存输入（catDraftFor 保留，重开同分类自动恢复）；×/取消=丢弃

    // ---------- 平台设置：修改密码（弹窗形式） ----------
    var pwdMask = document.getElementById('pwdMask');
    // 点击"修改密码"按钮弹出弹窗
    document.getElementById('showPwdFormBtn').addEventListener('click', function () {
      // R111：不在打开时清空——×/取消=丢弃（清三框）；点外/Esc=暂存，重开自动回填
      pwdMask.classList.add('open');
    });
    // 点击"关闭"按钮关闭弹窗
    document.getElementById('cancelPwdBtn').addEventListener('click', function () {
      document.getElementById('oldPwd').value = ''; document.getElementById('newPwd').value = ''; document.getElementById('confirmPwd').value = ''; // 取消=丢弃输入
      pwdMask.classList.remove('open');
    });
    // 点击遮罩关闭弹窗
    pwdMask.addEventListener('click', function (e) {
      if (e.target === pwdMask) pwdMask.classList.remove('open'); // R217：恢复点外关闭（R215 误删）
    });
    // 确定修改密码
    document.getElementById('changePwdBtn').addEventListener('click', function () {
      if (this.disabled) return; /* R231 条26：防连点 */
      var oldPwd = document.getElementById('oldPwd').value;
      var newPwd = document.getElementById('newPwd').value;
      var confirmPwd = document.getElementById('confirmPwd').value;
      var __pwErr = function (id, msg) { /* v336 条153：错误写在出错框下方红字 1.5 秒+红框+聚焦 */
        var el = document.getElementById(id); if (!el) { toast(msg, 'error'); return; }
        el.style.borderColor = 'var(--red-strong)'; el.focus();
        var tip = document.createElement('div'); tip.textContent = msg; tip.style.cssText = 'color:var(--red-strong);font-size:12px;margin:4px 0 0;';
        el.parentNode.appendChild(tip);
        setTimeout(function () { tip.remove(); el.style.borderColor = ''; }, 1500);
      };
      if (!oldPwd) { __pwErr('oldPwd', '请填写原密码'); return; }
      if (!newPwd) { __pwErr('newPwd', '请填写新密码'); return; }
      if (!confirmPwd) { __pwErr('confirmPwd', '请再输一遍新密码'); return; }
      if (newPwd !== confirmPwd) { __pwErr('confirmPwd', '两次输入的新密码不一致'); return; }
      // v294（用户 10-04 02:14）：104 修改密码加二次确认
      /* v346 条19：改用全站统一确认弹窗（原浏览器原生 confirm 观感不一致） */
      var _cpBtn = this, _cpTxt = this.textContent;
      showConfirm('修改密码', '确定修改密码？修改后立即生效，请牢记新密码。', function () {
      _cpBtn.disabled = true; if (window.__btnBusy) window.__btnBusy(_cpBtn, '修改中'); /* R231 条26 */
      api('admin/password', { method: 'POST', body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }) })
        .then(function (res) {
          _cpBtn.disabled = false; _cpBtn.textContent = _cpTxt;
          if (res && res.ok) {
            toast('密码已修改', 'success');
            document.getElementById('oldPwd').value = ''; document.getElementById('newPwd').value = ''; document.getElementById('confirmPwd').value = ''; /* R231：成功后清空输入，重开弹窗无残留 */
            pwdMask.classList.remove('open');
          } else {
            toast(res.msg || '修改失败（原密码可能不正确）', 'error');
          }
        }).catch(function () {
          _cpBtn.disabled = false; _cpBtn.textContent = _cpTxt;
          toast('修改失败：网络错误', 'error');
        });
      }); /* v346 条19：统一确认弹窗回调结束 */
    });

    // ---------- 退出 ----------
    logoutBtn.addEventListener('click', function () {
      logoutBtn.classList.add('active'); // R39：确认弹窗打开期间变白（复用资源页顶栏分享键 .active 白底蓝字）
      showConfirm('退出登录', '确定要退出管理页吗？', function (closeConfirm) {
        closeConfirm();
        api('admin/logout', { method: 'POST' });
        showLogin();
      });
    });
    // R39：确认弹窗关闭后移除退出键白底（与弹窗开合同步；机制复用资源页 R20 顶栏分享/客服键的 observer+兜底轮询）
    (function () {
      function sync() {
        var cm = document.getElementById('confirmMask');
        if (!cm || !cm.classList.contains('open')) logoutBtn.classList.remove('active');
      }
      var mo = new MutationObserver(sync);
      var cm = document.getElementById('confirmMask');
      if (cm) mo.observe(cm, { attributes: true, attributeFilter: ['class'] });
      setInterval(sync, 800); // 兜底轮询：observer 意外失效时也能恢复
    })();

    // ---------- 资源搜索 ----------
    // R183 条17：清除搜索键（与前台 ✗ 同款；空态另有「清除搜索」按钮）
    /* R186 建议1：搜索历史下拉（值为空 focus 时显示，复用 tab 胶囊 + 灰圆小 ×）；
       本脚本先于 ui-common.js 加载，同步阶段组件未定义 → load 后兜底绑定 */
    (function () {
      var __bindSH = function () { window.bindSearchHist(document.querySelector('.tb-row2 .admin-search'), document.getElementById('adminSearch'), 'wnzyq_admin_search_hist'); };
      if (window.bindSearchHist) __bindSH(); else window.addEventListener('load', __bindSH);
    })();
    document.getElementById('adminSearchClear').addEventListener('click', function () {
      var inp = document.getElementById('adminSearch');
      inp.value = '';
      this.classList.remove('show');
      adminPage = 1;
      renderProducts();
      inp.focus();
    });

    // ---------- 表单字段清除红色边框 ----------
    bindFieldClear(fTitle);
    attachLiveCheck(fTitle, '请填写资源标题'); /* R193c ⑨（23:26 修正：只留红框）：标题必填实时校验（blur/输入空即红框） */
    bindFieldClear(fCid);
    /* R193c ⑨：分类实时校验——下拉面板开过又收起仍未选择（0/空）即红框提示；
       选择成功在 onProductCidChange 清红框，填上立即消 */
    (function () {
      var picker = document.getElementById('fCidPicker');
      var disp = document.getElementById('fCidDisplay');
      if (!picker || !disp || !fCid) return;
      var opened = false;
      var mo = new MutationObserver(function () {
        if (picker.classList.contains('open')) { opened = true; return; }
        // R209（用户 09-19 00:46）：根因→实时校验把 cid=0（「全部」）当未选；修法→放开 cid=0，只校验 undefined/null/空字符串
        if (opened) { opened = false; var _cv = fCid.value; if (_cv === '' || _cv === undefined || _cv === null) showFieldErr(disp, '请选择资源分类'); }
      });
      mo.observe(picker, { attributes: true, attributeFilter: ['class'] });
    })();
    bindFieldClear(fDesc);
    bindFieldClear(fImg);
    bindFieldClear(vName);
    bindFieldClear(vTitle);

    // ---------- 统计时间筛选 ----------
    // R65：「对比上期」开关（默认关闭只显示本期）——点击切换后重渲染卡片/折线/柱状与图例，不重新发请求
    state.statsCmpPrev = false;
    var _cmpBtn = document.getElementById('cmpPrevBtn');
    if (_cmpBtn) _cmpBtn.addEventListener('click', function () {
      state.statsCmpPrev = !state.statsCmpPrev;
      this.classList.toggle('cmp-on', state.statsCmpPrev);
      // R69：文字随状态切换——关闭态=对比上期（点击开启对比），开启态=显示本期（点击退回只看本期）；配色：蓝=应用键色、开启态淡蓝
      this.textContent = state.statsCmpPrev ? '显示本期' : '对比上期';
      var _ll = document.querySelector('.line-legend'); if (_ll) _ll.classList.toggle('show-prev', state.statsCmpPrev);
      var _tl = document.querySelector('.trend-legend'); if (_tl) _tl.classList.toggle('show-prev', state.statsCmpPrev);
      // 卡片小字
      if (state.statsOverview) renderStatCards(state.statsOverview, state.statsOverviewPrev || null);
      // 折线/柱状（数据已存 state，直接重渲染）
      if (state.statsTrend && state.statsTrend.length) {
        renderLineChart(state.statsTrend, state.statsCmpPrev ? state.statsTrendPrev : null);
        renderTrendBars(state.statsTrend, state.statsCmpPrev ? state.statsTrendPrev : null);
      }
    });
    document.querySelectorAll('.time-btn[data-days]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.time-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        state.statsDays = Number(this.dataset.days) || 7;
        document.getElementById('statStartDate').value = '';
        document.getElementById('statEndDate').value = '';
        /* R238（用户 09-22 17:37）：三档预载缓存命中——六卡+两图+三表走与请求回来完全相同的
           渲染路径立即切换（零网络等待、零转圈/骨架/整页淡入）；随后后台静默刷新该档保新鲜
          （__silentApplyStats：三表没变的不碰，变了才局部重建）。缓存未命中（预载失败/跨天）
           静默降级回下方原每点即拉路径 */
        var _d = state.statsDays;
        var _r = _d === 1 ? (function () { var _td = __bjToday(); return { start: _td, end: _td }; })() : __statsRangeDays(_d);
        var _c = __statsCache[_d];
        if (_c && _c.end === __bjToday() && _c.res && _c.res.ok) {
          __updateStatTitles(_r.start, _r.end);
          __applyStatsRes(_c.res);
          loadStats(_r.start, _r.end, 1, 1); /* 第 4 参 silent：后台静默刷新 */
          return;
        }
        if (state.statsDays === 1) {
          // R29（优化项8）：1天档请求当天单日数据（按小时展示）；R176：日期改北京时间口径
          var _td = __bjToday();
          loadStats(_td, _td, 1);
        } else {
          // R176（用户 10:16）：极致响应两段式——①趋势全量已在 state，先本地即时重绘两图
          //（点击瞬间图表就切到 7/30 天视图，零等待）；②同时发对应范围请求，回来后六卡片+
          // 两图+三表全部按新档刷新（旧 loadStats() 无参被短路只重绘两图，六卡永不更新）
          if (state.statsTrendAll && state.statsTrendAll.length) applyStatsDays();
          var _r7 = __statsRangeDays(state.statsDays);
          loadStats(_r7.start, _r7.end, 1);
        }
      });
    });
    // 自定义日期范围（最多只能查询最近30天，全系统统一）
    document.getElementById('statCustomBtn').addEventListener('click', function () {
      var s = document.getElementById('statStartDate').value;
      var e = document.getElementById('statEndDate').value;
      if (!s || !e) { toast('请选择开始和结束时间', 'error'); return; }
      if (s.slice(0, 10) > e.slice(0, 10)) { toast('开始时间不能晚于结束时间', 'error'); return; }
      // 计算30天前的日期（R176：北京时间口径，旧 UTC 在北京 0-8 点会误拦/放错一天）
      var maxStartMs = Date.parse(__bjToday() + 'T00:00:00Z') - 29 * 86400000;
      var maxStartStr = new Date(maxStartMs).toISOString().slice(0, 10);
      if (s.slice(0, 10) < maxStartStr) {
        toast('最多只能查询最近30天的数据，已自动调整开始时间', 'warn');
        document.getElementById('statStartDate').value = maxStartStr + ' 00:00';
        s = maxStartStr + ' 00:00';
      }
      document.querySelectorAll('.time-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      loadStats(s, e);
    });

    // ---------- 导出 CSV ----------
    document.getElementById('exportBtn').addEventListener('click', exportAllData);
    // 导出资源码解锁记录
    var exportResourceBtn = document.getElementById('exportResourceBtn');
    // 解锁记录已并入统一导出，无需单独按钮

    // ---------- 资源预览（贴近资源页：含类型切换、类型价格） ----------
    var previewCurVariant = 0;
    function fmtPrice(v) {
      var n = Number(v) || 0;
      return n > 0 ? (window.formatPrice ? window.formatPrice(n) : ('¥' + (n === Math.floor(n) ? n : n.toFixed(2)))) : ''; /* v336 条10 */
    }
    function renderPreviewVariant() {
      var variants = state.variants || [];
      var basePrice = Number(fPrice.value) || 0;
      var priceEl = document.getElementById('previewPrice');
      var detailEl = document.getElementById('previewVariantDetail');
      if (variants.length === 0) { priceEl.textContent = fmtPrice(basePrice); detailEl.innerHTML = ''; initPvResourceSection(null); return; }
      var v = variants[previewCurVariant] || variants[0];
      // 类型价格优先，否则用资源价格，免费不显示
      var vp = (Number(v.price) || 0) > 0 ? Number(v.price) : basePrice;
      priceEl.textContent = fmtPrice(vp);
      // R15：与资源页 renderVariantDetail 同款结构——类型标题行（名称+价格）+ 描述区
      detailEl.innerHTML = '';
      var header = document.createElement('div');
      header.className = 'variant-header';
      var vName = document.createElement('span');
      vName.className = 'variant-name';
      vName.textContent = (v.title && String(v.title).trim()) || v.name || ''; // R148：预览同前台口径，类型标题优先
      header.appendChild(vName);
      var vpText = fmtPrice(Number(v.price) || 0);
      if (vpText) {
        var vpEl = document.createElement('span');
        vpEl.className = 'variant-price';
        vpEl.textContent = vpText;
        header.appendChild(vpEl);
      }
      detailEl.appendChild(header);
      var d = document.createElement('div');
      d.className = 'v-desc';
      d.innerHTML = (v.desc && String(v.desc).trim()) ? v.desc : '暂无额外说明';
      detailEl.appendChild(d);
      bindLightbox(detailEl);
      initPvResourceSection(v); // R158：预览同步资源页——类型内容区下方渲染资源码解锁区
    }
    // ---------- R158（用户 22:42）：预览同步资源页「资源码解锁区」 ----------
    // 预览=所见即所得（客户在资源页看到什么，预览就渲染什么）。但解锁是「本地比对」：
    // 输入码与当前类型（state.variants[previewCurVariant]，含未保存的本地类型表单值）的 resourceCode 比对，
    // 命中即渲染 resourceContent——全程不调 /api/unlock、不写绑定记录、不消耗绑定名额、不触发绑满换码
    // （管理员/账号持有者的测试行为不更新线上资源码）。
    function pvShowContent(v) {
      var contentEl = document.getElementById('pvResourceContent');
      if (!contentEl) return;
      contentEl.innerHTML = (v && v.resourceContent && String(v.resourceContent).trim()) ? v.resourceContent : '<p>专属内容</p>';
      bindLightbox(contentEl);
      contentEl.style.display = 'block';
      contentEl.style.animation = 'none';
      void contentEl.offsetWidth;
      contentEl.style.animation = '';
    }
    function initPvResourceSection(v) {
      var sec = document.getElementById('pvResourceSection');
      if (!sec) return;
      var errEl = document.getElementById('pvResourceError');
      var contentEl = document.getElementById('pvResourceContent');
      var inputRow = document.getElementById('pvResourceInputRow');
      var inputEl = document.getElementById('pvResourceCodeInput');
      var titleEl = document.getElementById('pvResourceTitle');
      var hasCode = !!(v && v.resourceCode && String(v.resourceCode).trim());
      var hasContent = !!(v && v.resourceContent && String(v.resourceContent).trim());
      if (!hasContent) { sec.style.display = 'none'; return; } // 与资源页 initResourceCodeSection 同口径：无专属内容整个区域隐藏
      sec.style.display = 'block';
      errEl.style.display = 'none';
      contentEl.style.display = 'none';
      contentEl.innerHTML = '';
      inputEl.value = '';
      if (hasCode) {
        titleEl.textContent = '输入资源码获取专属内容';
        inputRow.style.display = 'flex';
      } else {
        // 无码类型：资源页由服务端直接下发专属内容；预览本地直接展示（测试行为，零网络、不写统计）
        titleEl.textContent = '获取专属内容';
        inputRow.style.display = 'none';
        pvShowContent(v);
      }
    }
    function pvVerifyCode() {
      var variants = state.variants || [];
      var v = variants[previewCurVariant] || variants[0];
      if (!v) return;
      var inputEl = document.getElementById('pvResourceCodeInput');
      var errEl = document.getElementById('pvResourceError');
      var input = String(inputEl.value || '').trim();
      if (!input) {
        errEl.textContent = '请输入资源码';
        errEl.style.display = 'block';
        return;
      }
      var code = String(v.resourceCode || '').trim(); // 本地比对（与线上验码同为大小写不敏感）
      if (code && input.toUpperCase() === code.toUpperCase()) {
        errEl.style.display = 'none';
        document.getElementById('pvResourceInputRow').style.display = 'none';
        pvShowContent(v);
      } else {
        errEl.textContent = '资源码错误，请重试';
        errEl.style.display = 'block';
      }
    }
    document.getElementById('previewProductBtn').addEventListener('click', function () {
      previewCurVariant = 0;
      // R256：清除预览弹窗骨架
      var _pvSkel = document.getElementById('previewSkeleton'); if (_pvSkel) _pvSkel.style.display = 'none';
      document.getElementById('previewTitle').textContent = fTitle.value || '(未填写标题)';
      document.getElementById('previewDesc').textContent = fDesc.value || '';
      var __pdHtml = serializeDetail() || ''; /* R147：预览同步还原 */
      var __pdEmpty = !__pdHtml.replace(/<(br|p|div)\b[^>]*>\s*<\/(br|p|div)>/gi, '').replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, ' ').replace(/<[^>]+>/g, '').trim();
      var __pdEl = document.getElementById('previewDetail');
      if (__pdEmpty) { __pdEl.innerHTML = ''; __pdEl.style.display = 'none'; } // R158：资源页口径——无详情整块隐藏（旧版显示「暂无详细描述」占位与资源页不同步）
      else { __pdEl.innerHTML = __pdHtml; __pdEl.style.display = ''; }
      // R256：预览弹窗封面轮播
      // R270（用户 09-27 17:30）：根因→预览弹窗旧单图分叉（cover.src 强制赋值 + display=block）
      // 与 renderCarousel 多图轮播冲突（轮播隐藏 fallback、旧代码又强制显示单图）
      // 修法→删掉旧分叉，预览弹窗封面完全走 renderCarousel（与资源页弹窗同源函数，老板要求「以资源页为标准、绑定同步」）
      var _pCovArr = window.__coverImages ? window.__coverImages() : (fImg.value.trim() ? [fImg.value.trim()] : []);
      renderCarousel(document.getElementById('previewCarousel'), document.getElementById('previewCcTrack'), document.getElementById('previewCcDots'), document.getElementById('previewCover'), _pCovArr);
      // R273：预览弹窗单图回退条件化——多图时 previewCover 由 renderCarousel 隐藏
      var pc = document.getElementById('previewCover');
      if (_pCovArr.length <= 1) {
        pc.style.cursor = 'zoom-in';
        pc.onclick = function () { if (pc.src) window.openLightbox(pc.src); };
      }
      // 渲染类型切换
      var wrap = document.getElementById('previewVariantWrap');
      var tabs = document.getElementById('previewVariantTabs');
      tabs.innerHTML = '';
      var variants = state.variants || [];
      if (variants.length >= 1) {
        wrap.style.display = 'block';
        variants.forEach(function (v, i) {
          var t = document.createElement('button');
          t.type = 'button';
          // R15：与资源页 .variant-tab 同款类样式（含 hover 浮起/选中态动画）
          t.className = 'variant-tab' + (i === 0 ? ' active' : '');
          t.textContent = v.name || ('类型' + (i + 1));
          if (v.name) t.title = v.name; // R160：截断显示不全时鼠标悬停查看全名
          t.addEventListener('click', function () {
            previewCurVariant = i;
            Array.prototype.forEach.call(tabs.children, function (c, j) {
              c.classList.toggle('active', j === i);
            });
            renderPreviewVariant();
          });
          tabs.appendChild(t);
        });
      } else {
        wrap.style.display = 'none';
      }
      renderPreviewVariant();
      bindLightbox(document.getElementById('previewDetail'));
      bindLightbox(document.getElementById('previewVariantDetail'));
      /* v327（用户要求）：预览弹窗引用块复制键与资源页共用同一公共实现（ui-common.bindQuoteCopyButtons）——
         资源页改什么预览就是什么，杜绝"一处改另一处忘改" */
      try { window.bindQuoteCopyButtons(document.getElementById('previewDetail')); } catch (e0) { if (window.__silent) window.__silent(e0); }
      try { window.bindQuoteCopyButtons(document.getElementById('previewVariantDetail')); } catch (e0) { if (window.__silent) window.__silent(e0); }
      document.getElementById('previewMask').classList.add('open');
      /* R241：滚动位置按「弹窗 × 预览对象」独立（对象=正在编辑的资源，与 editMask 同口径） */
      if (window.__modalScroll) __modalScroll.open(document.getElementById('previewMask'), state.editingId || 'new');
    });
    document.getElementById('previewCloseX').addEventListener('click', function () {
      __stopPreviewCarousel(); // R280 ③
      document.getElementById('previewMask').classList.remove('open');try{document.querySelectorAll('#previewMask video').forEach(function(v){v.pause()})}catch (e) { if (window.__silent) window.__silent(e); }
    });
    // ---------- R10 预览弹窗分享键：生成资源页分享链接并复制 ----------
    // R14：改为弹窗形式（复用 ui-common 公共分享链接弹窗，与资源页转发键同款观感）
    // 仅编辑已保存资源时可用（新增未保存没有资源 ID）；本地预览模式无部署地址，不生成链接
    document.getElementById('previewShareX').addEventListener('click', function () {
      var isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) { toast('本地预览模式，部署线上后可分享', 'error'); return; }
      if (!state.editingId) { toast('新增资源请先保存后再分享', 'error'); return; }
      var url = window.location.origin + '/shop?pid=' + state.editingId;
      var _pn = ''; try { var _pp = (state.products || []).find(function (x) { return Number(x.id) === Number(state.editingId); }); _pn = (_pp && _pp.title) || ''; } catch (e) { if (window.__silent) window.__silent(e); }
      if (window.showShareLinkModal) window.showShareLinkModal('分享资源链接', url, (_pn ? _pn + ' · ' : '') + '资源链接已复制到剪贴板'); // R251：新标题+带资源名灰字
      else { if (window.__shareCopyText) { try { window.__shareCopyText(url); } catch (e) { if (window.__silent) window.__silent(e); } } toast('链接已复制到剪贴板', 'success'); }
    });
    // R285 item 7：兜底弹窗已统一到 ui-common.js（window.openContactFallback / window.__kfFbClose）
    document.getElementById('previewContactBtn').addEventListener('click', function () {
      var url = '';
      var variants = state.variants || [];
      var cv = variants[previewCurVariant];
      if (cv && cv.contactUrl) url = cv.contactUrl;
      if (!url) url = fContactUrl.value.trim();
      var g = document.getElementById('setContactUrl');
      if (!url && g) url = g.value.trim();
      if (url) { if (window.openContactModal) { window.openContactModal(url, window.__kefuQrSrc(), null, '跳转-咨询在线客服'); } else { window.openContactFallback(url); } }
      else toast('暂未配置客服链接（资源/全局都没填）', 'warn');
    });
    document.querySelector('.preview-close-btn').addEventListener('click', function () {
      __stopPreviewCarousel(); // R280 ③
      document.getElementById('previewMask').classList.remove('open');try{document.querySelectorAll('#previewMask video').forEach(function(v){v.pause()})}catch (e) { if (window.__silent) window.__silent(e); }
    });

    // R256：封面轮播组件（admin 预览弹窗用）
    /* v333 整理：这段约 86 行的轮播实现与 shop.js 里那份逐字相同，已统一提取到
       ui-common.js 的 window.__renderCarousel（顺带修好了这里 img.src = escapeHtml(url) 的转义 bug）。
       这里保留转发，公共层万一没加载也不会整页崩。 */
    function renderCarousel(carouselEl, trackEl, dotsEl, fallbackImgEl, images) {
      if (window.__renderCarousel) { window.__renderCarousel(carouselEl, trackEl, dotsEl, fallbackImgEl, images, EXC_PLACEHOLDER); return; }
      if (!carouselEl || !trackEl) return;
      if (!images || images.length <= 1) {
        carouselEl.style.display = 'none';
        if (fallbackImgEl) { fallbackImgEl.style.display = ''; fallbackImgEl.src = images && images[0] ? images[0] : ''; }
        return;
      }
      carouselEl.style.display = '';
      if (fallbackImgEl) fallbackImgEl.style.display = 'none';
    }
    // R280 ③：预览弹窗三条关闭路径（×钮 / 底部关闭键 / 点遮罩）统一停轮播定时器
    function __stopPreviewCarousel() {
      var _ccCar = document.getElementById('previewCarousel');
      if (_ccCar && _ccCar.__ccPause) _ccCar.__ccPause();
    }
    document.getElementById('previewMask').addEventListener('click', function (e) {
      if (e.target === this) { __stopPreviewCarousel(); this.classList.remove('open'); try { this.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); } } // R217：恢复点外关闭（R215 误删）；R280 ③：点外关闭也停轮播定时器
    });

    // ---------- ESC 关闭弹窗 ----------
    document.addEventListener('keydown', function (e) {
      // R111：Esc 改由 __modalKit（ui-common.js）逐层路由——只关最上层并走该层「暂存」通道；
      // 旧的一刀切全关（绕过草稿暂存/密码保留/取消回调）已废除
      // Ctrl+S 保存资源
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        /* R183 条22：Ctrl+S 覆盖全部保存弹窗——哪个弹窗开着就保存哪个（确认删除类不绑，防 Ctrl+S 误触危险操作） */
        var __csMap = [['editMask','saveProductBtn'],['annMask','saveAnnBtn'],['contactMask','saveContactBtn'],['catMask','catOk'],['batchCatMask','batchCatOk'],['variantMask','variantOk'],['inputMask','inputOk']];
        for (var ci = 0; ci < __csMap.length; ci++) {
          var __mk = document.getElementById(__csMap[ci][0]);
          if (__mk && __mk.classList.contains('open')) {
            var __sb = document.getElementById(__csMap[ci][1]);
            if (__sb && !__sb.disabled) __sb.click();
            return;
          }
        }
        var saveBtn = document.getElementById('saveProductBtn');
        if (saveBtn && saveBtn.offsetParent !== null) saveBtn.click();
      }
      // R192 二⑧：富文本编辑器基本快捷键显式化——Ctrl+B 加粗 / Ctrl+I 斜体 / Ctrl+U 下划线
      // （contenteditable 原生多已支持，显式绑定兜底防个别浏览器/输入法吃键；仅编辑器聚焦时接管）
      if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].indexOf(e.key) !== -1) {
        var __ed = document.activeElement;
        if (__ed && (__ed.classList.contains('rte-editor') || (__ed.closest && __ed.closest('.rte-editor')))) {
          e.preventDefault();
          try { document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key], false, null); } catch (e2) { if (window.__silent) window.__silent(e2); }
        }
      }
      // Ctrl+Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // 撤销交由浏览器原生处理，不再自定义拦截
      }
      // Ctrl+Y 或 Ctrl+Shift+Z 重做
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        // 重做交由浏览器原生处理，不再自定义拦截
      }
    });

    // ---------- R243 条19②：命令面板抽提到 ui-common.js（window.__cpPanel 全站组件）----------
    // 面板 DOM/键控/样式/弹窗栈注册全部由公共组件提供，本页只传后台命令清单；
    // 行为与 R192 版完全一致：Ctrl+K 呼出、↑↓ 选择、Enter 执行、Esc 关闭、
    // 编辑类弹窗开着时不抢键、点外关闭。
    (function () {
      if (!window.__cpPanel) return;
      window.__cpPanel({
        placeholder: '请输入页面 / 操作 / 资源名', /* R285 条38：口径统一「动作+对象」 */
        busy: '.modal-mask.open, .kf-mask.open, .share-mask.open, .ann-mask.open',
        cmds: function () {
          var c = [
            { lab: '资源管理', tag: '页面', kw: '资源管理 资源 列表 products', run: function () { switchTab('products'); } },
            { lab: '分类管理', tag: '页面', kw: '分类管理 分类 categories', run: function () { switchTab('categories'); } },
            { lab: '数据统计', tag: '页面', kw: '数据统计 统计 数据 stats', run: function () { switchTab('stats'); } },
            { lab: '平台设置', tag: '页面', kw: '平台设置 设置 settings', run: function () { switchTab('settings'); } },
            { lab: '新增资源', tag: '操作', kw: '新增资源 新建 添加资源 add', run: function () { switchTab('products'); document.getElementById('addProductBtn').click(); } },
            { lab: '新增分类', tag: '操作', kw: '新增分类 新建分类 add', run: function () { switchTab('categories'); document.getElementById('addCatBtn').click(); } },
            { lab: '设置客服', tag: '操作', kw: '设置客服 客服 联系 contact', run: function () { switchTab('settings'); document.getElementById('openContactBtn').click(); } },
            { lab: '设置公告', tag: '操作', kw: '设置公告 公告 ann', run: function () { switchTab('settings'); document.getElementById('openAnnBtn').click(); } },
            { lab: '新增公告项', tag: '操作', kw: '新增公告项 公告 add', run: function () { switchTab('settings'); document.getElementById('addAnnBtn').click(); } },
            { lab: '修改密码', tag: '操作', kw: '修改密码 密码 pwd', run: function () { switchTab('settings'); document.getElementById('showPwdFormBtn').click(); } }
          ];
          (state.products || []).forEach(function (p) {
            c.push({ lab: '编辑：' + (p.title || '(无标题)'), tag: '资源', kw: '编辑 ' + (p.title || ''), run: function () { switchTab('products'); openEdit(p); } });
          });
          return c;
        }
      });
    })();

    // ---------- R111：弹窗三模式统一注册（×/取消=丢弃；点外/Esc=暂存） ----------
    // ui-common.js 在本文件之后加载，等 DOMContentLoaded 再注册（此时 kit 必已就绪）；
    // 各 handler 自行完成关窗；Esc 由 kit 逐层路由到最上层弹窗的「暂存」通道
    window.addEventListener('DOMContentLoaded', function () {
      var kit = window.__modalKit; if (!kit) return;
      var el = function (id) { return document.getElementById(id); };
      // 资源编辑：丢弃=清草稿；暂存=存草稿（重开自动回填；草稿为内存态，刷新即清）
      kit.register(el('editMask'), {
        discard: function () { try { clearDraft(); } catch (e) { if (window.__silent) window.__silent(e); } editMask.classList.remove('open'); },
        stash: function () { try { saveDraft(); } catch (e) { if (window.__silent) window.__silent(e); } editMask.classList.remove('open'); } // R257（老板 09-23 19:08）：Esc=暂存草稿（R145 丢弃口径废除）
      });
      // 类型编辑 / 分类编辑：丢弃=丢输入；暂存=保留同一条目输入
      kit.register(el('variantMask'), {
        discard: function () { variantDraftPending = false; variantDraftFor = null; variantMask.classList.remove('open'); },
        stash: function () { variantDraftPending = true; variantMask.classList.remove('open'); } // R257：Esc=暂存输入（重开同类型恢复）
      });
      kit.register(el('catMask'), {
        discard: function () { catDraftPending = false; catDraftFor = null; catMask.classList.remove('open'); },
        stash: function () { catDraftPending = true; catMask.classList.remove('open'); } // R257：Esc=暂存输入（重开同分类恢复）
      });
      // 公告设置：丢弃=恢复备份重载；暂存=保留当前编辑
      kit.register(el('annMask'), {
        discard: function () { try { window.__annDiscard(); } catch (e) { if (window.__silent) window.__silent(e); } },
        stash: function () { try { window.__annStash(); } catch (e) { if (window.__silent) window.__silent(e); } } // R257（老板 09-23 19:08）：Esc=暂存（选中项+内容+频率保留，重开恢复）——R145 丢弃口径废除
      });
      // 设置客服：丢弃=清输入；暂存=保留
      kit.register(el('contactMask'), {
        discard: function () { contactDraftPending = false; var _cu = el('contactUrlInput'); if (_cu) _cu.value = ''; el('contactMask').classList.remove('open'); },
        stash: function () { contactDraftPending = true; el('contactMask').classList.remove('open'); } // R257：Esc=暂存输入（不清，重开保留）
      });
      // 修改密码：统一三模式——丢弃=清三框；暂存=保留（刷新即清）
      kit.register(el('pwdMask'), {
        discard: function () { var _o = el('oldPwd'), _n = el('newPwd'), _c = el('confirmPwd'); if (_o) _o.value = ''; if (_n) _n.value = ''; if (_c) _c.value = ''; pwdMask.classList.remove('open'); },
        stash: function () { pwdMask.classList.remove('open'); } // R257（老板 09-23 19:08）：Esc=暂存（三框保留，重开接着填；R145 清三框口径废除）
      });
      // 确认框：四通道统一=取消语义（执行取消回调并清回调）
      var __confirmCancel = function () {
        el('confirmMask').classList.remove('open');
        if (confirmCancelCallback) { var cb = confirmCancelCallback; confirmCallback = null; confirmCancelCallback = null; cb(); }
        else { confirmCallback = null; confirmCancelCallback = null; }
      };
      kit.register(el('confirmMask'), { discard: __confirmCancel, stash: __confirmCancel });
      // 通用输入框：丢弃=清输入；暂存=保留输入（回调两种关闭都清）
      kit.register(el('inputMask'), {
        discard: function () { inputCallback = null; try { el('inputValue').value = ''; } catch (e) { if (window.__silent) window.__silent(e); } inputMask.classList.remove('open'); },
        stash: function () { inputCallback = null; inputMask.classList.remove('open'); }
      });
      // 绑定设备：纯展示，任何通道=直接关；R217：恢复点外关闭（R215 误删——老板原意只删下滑手势）
      var __bm = el('bindingsMask');
      if (__bm) __bm.addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });
      kit.register(__bm, { discard: function () { __bm.classList.remove('open'); }, stash: function () { __bm.classList.remove('open'); } });
      // 预览：直接关 + 暂停视频
      var __pm = el('previewMask');
      var __previewClose = function () { if (__pm) { __pm.classList.remove('open'); try { __pm.querySelectorAll('video').forEach(function (v) { v.pause(); }); } catch (e) { if (window.__silent) window.__silent(e); } } };
      kit.register(__pm, { discard: __previewClose, stash: __previewClose });
      // 批量改分类：直接关
      var __bc = el('batchCatMask');
      var __bcClose = function () { if (__bc) __bc.classList.remove('open'); };
      kit.register(__bc, { discard: __bcClose, stash: __bcClose });
    });

    // ---------- PWA Service Worker 注册：已收编至 ui-common.js 全站统一注册（R34） ----------

  
    // ---------- R249：管理页长按菜单（四类四项制） ----------
    (function () {
      var cm = window.__ctxMenu; if (!cm) return;
      function __cp(text, msg) {
        if (window.__shareCopyText && window.__shareCopyText(text)) { if (typeof toast === 'function') toast(msg, 'success'); var el = window.__ctxMenuLastHit; if (el && el.classList) { el.classList.add('copy-ok-text'); setTimeout(function(){ el.classList.remove('copy-ok-text'); }, 1500); } }
        else { if (typeof toast === 'function') toast('复制失败', 'error'); }
      }
      // R257：__saveImage 已合并到 ui-common.js
      function __makeAdminShareUrl(pid) {
        return window.location.origin + '/shop?pid=' + pid;
      }
      function __adminProdTitle(pid) { // R251：长按分享/二维码带资源真实名称
        try { var _p = (state.products || []).find(function (x) { return Number(x.id) === Number(pid); }); return (_p && _p.title) || ''; } catch (e) { return ''; }
      }
      function __shareAdminFn(pid) {
        return function () {
          var url = __makeAdminShareUrl(pid);
          var _pn = __adminProdTitle(pid);
          if (window.showShareLinkModal) window.showShareLinkModal('分享资源链接', url, (_pn ? _pn + ' · ' : '') + '资源链接已复制到剪贴板'); // R251：新标题+带资源名灰字
          else __cp(url, '链接已复制到剪贴板');
        };
      }
      function __saveQrAdminFn(pid) {
        return function () {
          /* v347：统一走公共层「存二维码」（生成带站名+资源名的图），与资源页同一份实现 */
          if (window.__savePosterPng) window.__savePosterPng(pid, null, __adminProdTitle(pid));
        };
      }
      function imgItemsAdmin(img) {
        var src = img.currentSrc || img.src || '';
        if (!src) return [];
        var pid = state && state.editingId ? state.editingId : null;
        var items = [
          { label: '保存图片', fn: function () { window.__saveImage(src); } },
          { label: '预览大图', fn: function () { if (window.openLightbox) window.openLightbox(src); } }
        ];
        if (pid) {
          items.push({ label: '分享资源', fn: __shareAdminFn(pid) });
          items.push({ label: '存二维码', fn: __saveQrAdminFn(pid) });
        }
        return items;
      }
      function textItemsAdmin(el) {
        var full = String(el.innerText || '').trim();
        var pid = state && state.editingId ? state.editingId : null;
        var items = [{ label: '复制选中', fn: function () {
          var sel = '';
          try { sel = String(window.getSelection ? window.getSelection() : ''); } catch (e) { if (window.__silent) window.__silent(e); }
          if (sel) __cp(sel, '选中内容已复制');
          else if (typeof toast === 'function') toast('先选中文字，再长按即可复制', 'info');
        } }];
        if (full) items.push({ label: '复制全文', fn: function () { __cp(full, '内容已复制'); } });
        if (pid) {
          items.push({ label: '分享资源', fn: __shareAdminFn(pid) });
          items.push({ label: '存二维码', fn: __saveQrAdminFn(pid) });
        }
        return items;
      }
      var productList = document.getElementById('productList');
      var editMask = document.getElementById('editMask');
      var previewMask = document.getElementById('previewMask');
      // 1. 管理页资源列表长按（复制标题 / 复制简介 / 分享资源 / 存二维码）
      if (productList) {
        cm.bind(productList, '.product-row', function (row) {
          var pid = Number(row.getAttribute('data-id') || 0);
          var p = (state.products || []).find(function (x) { return Number(x.id) === pid; });
          if (!p) return [];
          return [
            { label: '复制标题', fn: function () { __cp(p.title || '', '标题已复制'); } },
            { label: '复制简介', fn: function () { __cp(p.desc || '', '简介已复制'); } },
            { label: '分享资源', fn: __shareAdminFn(pid) },
            { label: '存二维码', fn: __saveQrAdminFn(pid) }
          ];
        });
      }
      // 2. 弹窗内图片长按（保存图片 / 预览大图 / 分享资源 / 存二维码）
      if (editMask) { cm.bind(editMask, 'img', imgItemsAdmin); }
      if (previewMask) { cm.bind(previewMask, 'img', imgItemsAdmin); }
      // 3. 弹窗内文字长按（复制选中 / 复制全文 / 分享资源 / 存二维码）
      //    R252（老板 09-23 15:22）：预览弹窗文字长按补绑定——与编辑弹窗同款四项（旧版只绑了 editMask，
      //    预览弹窗内长按文字无菜单；pid 依赖 state.editingId——预览必从编辑弹窗打开，已保存资源有值四项，
      //    新增未保存无 pid 按两项处理）
      if (editMask) {
        cm.bind(editMask, '.modal-box', function (el, e) {
          if (e && e.target && e.target.closest && e.target.closest('button, input, textarea, a, select, img, video')) return [];
          return textItemsAdmin(el);
        });
      }
      if (previewMask) {
        cm.bind(previewMask, '.modal-box', function (el, e) {
          if (e && e.target && e.target.closest && e.target.closest('button, input, textarea, a, select, img, video')) return [];
          return textItemsAdmin(el);
        });
      }
    })();

    // R243（用户 09-22 23:18）：条43 工具栏收起键首次呼吸引导（一次性，storage 记忆）
    (function () {
      try {
        if (!localStorage.getItem('wnzyq_rte_expand_guide')) {
          document.querySelectorAll('.rte-expand').forEach(function (btn) { btn.classList.add('breathe-once'); });
          localStorage.setItem('wnzyq_rte_expand_guide', '1');
          setTimeout(function () {
            document.querySelectorAll('.rte-expand').forEach(function (btn) { btn.classList.remove('breathe-once'); });
          }, 2500);
        }
      } catch (e) { if (window.__silent) window.__silent(e); }
    })();
    // R243（用户 09-22 23:18）：条24 初始禁用态同步
    __updateUndoRedo();

    (function () {
      var btn = document.getElementById('pvResourceCodeBtn');
      var inputEl = document.getElementById('pvResourceCodeInput');
      if (btn) btn.addEventListener('click', pvVerifyCode);
      if (inputEl) {
        inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') pvVerifyCode(); });
        // R158（用户 22:42）：输满 8 位自动解锁（资源码固定 8 位），不用点右侧「解锁」
        var __pvLast = '';
        inputEl.addEventListener('input', function () {
          var val = String(this.value || '').trim();
          if (val.length >= 8 && val !== __pvLast) { __pvLast = val; pvVerifyCode(); }
          else if (val.length < 8) { __pvLast = ''; }
        });
      }
    })();

    // ---------- 初始化 ----------

    /* v343 条56：后台滚动位置记忆——切到别的区再回到资源管理时，回到原来的滚动位置 */
    (function () {
      var KEY = 'wnzyq_admin_scroll_y';
      var t = null;
      window.addEventListener('scroll', function () {
        if (t) clearTimeout(t);
        t = setTimeout(function () { try { sessionStorage.setItem(KEY, String(window.scrollY || 0)); } catch (e) { if (window.__silent) window.__silent(e); } }, 200);
      }, { passive: true });
      document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('.tab, [class*=tab]') : null;
        if (!el) return;
        var txt = (el.textContent || '');
        if (/资源管理|资源/.test(txt)) {
          setTimeout(function () {
            try { var y = parseInt(sessionStorage.getItem(KEY) || '0', 10); if (y > 0) window.scrollTo(0, y); } catch (e2) { if (window.__silent) window.__silent(e2); }
          }, 400);
        }
      }, true);
    })();

    boot();

/* ===== R102→R167：截断文字悬停/点按小框 #uiTip 已收编至 ui-common.js（全站四页统一） =====
   本段原 R102/R105/R106/R165 的 admin 专属实现整体迁出，行为不变（悬停/点按、白名单、
   单行截断容器 clippedX 分支），白名单扩展前台截断元素（.card-title/.card-desc/.shop-name/.variant-tab），
   弹窗开合经 syncBodyLock 自动隐藏小框。样式在 ui-common.css #uiTip。 */

/* v336（条7）：变量圈屋——同 shop.js，全文件包进一层“屋子”。
   登录按钮等 HTML onclick 点名的函数在屋子末尾“挂牌对外”，功能不变。 */
window.doLogin = typeof doLogin !== 'undefined' ? doLogin : window.doLogin;
window.togglePwdVisibility = typeof togglePwdVisibility !== 'undefined' ? togglePwdVisibility : window.togglePwdVisibility;
window.toggleModalPwdVisibility = typeof toggleModalPwdVisibility !== 'undefined' ? toggleModalPwdVisibility : window.toggleModalPwdVisibility;
/* v336 条154：标题失焦即校验（提交时仍全量校验） */
(function () { var el = document.getElementById('editTitle'); if (el) el.addEventListener('blur', function () { try { validateField('title'); } catch (e) { if (window.__silent) window.__silent(e); } }); })();

/* v346 条1/12：启动/初始化段（由第 1 段移来，确保此时全部函数已就绪） */
// ---------- 启动 ----------
    
// R286-59：管理页输入框长度限制双保险（HTML maxlength + JS截断，与前台解锁码同款口径）
(function() {
  var limits = {
    'fTitle': 100, 'fDesc': 200, 'fImg': 500, 'fContactUrl': 500,
    'catName': 50, 'setContactUrl': 500, 'contactUrlInput': 500,
    'loginUser': 50, 'loginPass': 50, 'adminSearch': 50,
    'oldPwd': 50, 'newPwd': 50, 'confirmPwd': 50
  };
  function bindLimit(id, max) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      if (this.value.length > max) this.value = this.value.slice(0, max);
    });
  }
  for (var k in limits) bindLimit(k, limits[k]);
})();

/* v340 条10：手机端顶栏两行时高度远超 64px——实测回写 --topbar-h */
    function __syncTopbarH() {
      try {
        var tb = document.querySelector('.topbar');
        if (!tb) return;
        document.documentElement.style.setProperty('--topbar-h', (tb.offsetHeight || 64) + 'px');
      } catch (e) { if (window.__silent) window.__silent(e); }
    }
    window.addEventListener('resize', __syncTopbarH);
    if (document.readyState !== 'loading') setTimeout(__syncTopbarH, 0); else document.addEventListener('DOMContentLoaded', __syncTopbarH);

function boot() {
      // 本地环境（file:// 或 localhost）不发起 API 请求，避免 404 报错
      var isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocal) {
        // 静默检测并自动初始化，失败不显示错误（避免500报错影响用户体验）
        api('health').then(function (h) {
          if (h && h.ok && !h.ready) {
            api('install', { method: 'POST' }).catch(function () {});
          }
        }).catch(function () {});
      }
      // R30-#4：登录态改由 HttpOnly Cookie 携带
      if (!isLocal) {
        api('admin/session').then(function (s) {
          if (s.ok) showMain(s.username);
          else { showLogin(); }
        });
      } else {
        showLogin();
      }
    }

    function showLogin() {
      loginView.style.display = 'flex'; mainView.style.display = 'none';
      // R243 条39：自动回填上次成功登录的用户名
      try {
        var lastUser = localStorage.getItem('wnzyq_last_user');
        if (lastUser && loginUser && !loginUser.value) { loginUser.value = lastUser; if (loginPass) loginPass.focus(); }
      } catch (e) { if (window.__silent) window.__silent(e); }
    }

    function showMain(username) {
      /* v354：全局孤儿清理自动触发——进后台立刻扫一次，之后每 30 分钟一次；后端节流+24h 保护期兜底 */
      try {
        var __gc = function () { try { fetch('/api/admin/global-cleanup', { method: 'POST', credentials: 'include' }).catch(function () {}); } catch (e) {} };
        __gc();
        if (!window.__gcTimer) window.__gcTimer = setInterval(__gc, 30 * 60 * 1000);
      } catch (e) {}
      loginView.style.display = 'none';
      mainView.style.display = 'block';
      // v294（用户 10-04 02:14）：131 记录登录时间，23小时后提示即将过期
      try { localStorage.setItem('wnzyq_login_at', String(Date.now())); } catch (e) { if (window.__silent) window.__silent(e); }
      // R292（用户 09-29）：一分钟是唯一同步节点，切回不触发检查
      window.__adminBackBound = 1; // 标记已初始化（避免重复绑定）
      // R248：页面加载后尝试恢复编辑草稿（自动刷新保护）
      try { setTimeout(function () { if (window.__restoreEditingDraft) window.__restoreEditingDraft(); }, 200); } catch (e) { if (window.__silent) window.__silent(e); }
      function _safe(fn) { try { fn(); } catch (e) { /* R213 P2⑤：调试日志已删（隔离逻辑保留） */ } }
      // v313：dashboard 只返回轻量 stats overview，不标记 stats 已完整加载——切到 stats tab 时自动触发 loadStats 拉取明细
      window.__plC = 1; window.__plP = 1;
      // R276：先读 sessionStorage 缓存，刷新时秒显上一次内容
      var _cache = __getAdminCache();
      var _hasCache = _cache._cacheFormat === ('sch' + String((window.WN_CONST && window.WN_CONST.CACHE_SCHEMA) || 4)) && _cache.products && _cache.products.length && _cache.timestamp && (Date.now() - _cache.timestamp < 600000);
      if (_hasCache) {
        state.products = _cache.products || [];
        state.categories = _cache.categories || [];
        state.settings = _cache.settings || {};
        state.statsOverview = _cache.statsOverview;
        state.statsOverviewPrev = _cache.statsOverviewPrev;
        state.statsTrend = _cache.statsTrend;
        state.statsTrendPrev = _cache.statsTrendPrev;
        state.statsDays = _cache.statsDays || 1;
        state.statByProduct = _cache.statByProduct;
        state.statByCategory = _cache.statByCategory;
        state.statRecent = _cache.statRecent;
        // v317：缓存恢复后标记为后端分页模式（首屏只拿第一页，翻页/搜索/筛选点到才拉）
        state._backendPaged = true;
        // 恢复 __statsCache，切日期时秒开
        var _sd = state.statsDays || 1;
        __statsCache[_sd] = { end: __bjToday(), res: { ok: true, overview: state.statsOverview, overview_prev: state.statsOverviewPrev, trend: state.statsTrend, trend_prev: state.statsTrendPrev, byProduct: state.statByProduct, byCategory: state.statByCategory, recent: state.statRecent } };
        // R276：恢复 bindingsCache，点开码与绑定弹窗秒开
        __loadBindingsCache();
        // 有缓存：秒显上一次内容
        _safe(function () { renderProducts(); });
        _safe(function () { renderCategories(state.categories); });
        _safe(function () { if (state.statsOverview) { __updateStatTitles(); renderStatCards(state.statsOverview, state.statsOverviewPrev); renderLineChart(state.statsTrend, state.statsCmpPrev ? state.statsTrendPrev : null); renderTrendBars(state.statsTrend, state.statsCmpPrev ? state.statsTrendPrev : null); renderStatTables(); } });
        _safe(function () { if (state.settings) { document.getElementById('setContactUrl').value = state.settings.contact_url || ''; document.getElementById('annMode').value = state.settings.announcement_mode || 'always'; syncSelectDisplay(document.getElementById('annMode')); } });
      }
      // R308：进页请求合一——只发一次 /api/admin/home，带版本号缓存
      window.__adminEntryDone = false;
      if (window.__enterPageEntryMode) window.__enterPageEntryMode();
      loadAdminHome(_hasCache ? 1 : 0).then(function () {
        window.__adminEntryDone = true;
        if (window.__exitPageEntryMode) window.__exitPageEntryMode();
      }).catch(function () {
        window.__adminEntryDone = true;
        if (window.__exitPageEntryMode) window.__exitPageEntryMode();
      });
      try { switchTab('products'); } catch (e) { /* R213 P2⑤：调试日志已删 */ }
    }
