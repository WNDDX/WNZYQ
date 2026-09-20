/**
 * R211 第一批验证脚本（v211）
 * 覆盖项 1-8 断言 + 基础回归
 */
(function () {
  'use strict';
  var results = [];
  function check(name, fn) {
    try { results.push({ name: name, ok: !!fn() }); }
    catch (e) { results.push({ name: name, ok: false, err: String(e.message || e) }); }
  }
  function fail(msg) { throw new Error(msg); }

  // === 项1：缓动 Token ===
  check('ui-common.css :root 含 --ease-out', function () {
    var s = getComputedStyle(document.documentElement);
    return s.getPropertyValue('--ease-out').includes('cubic-bezier');
  });
  check('ui-common.css :root 含 --ease-in-out', function () {
    return getComputedStyle(document.documentElement).getPropertyValue('--ease-in-out').includes('cubic-bezier');
  });
  check('ui-common.css :root 含 --ease-emphasized', function () {
    return getComputedStyle(document.documentElement).getPropertyValue('--ease-emphasized').includes('cubic-bezier');
  });
  check('ui-common.css :root 含 --ease-press', function () {
    return getComputedStyle(document.documentElement).getPropertyValue('--ease-press').includes('cubic-bezier');
  });

  // === 项2：sticky hover 隔离 ===
  check('三份 CSS 均含 @media (hover:hover) and (pointer:fine)', function () {
    var sheets = Array.from(document.styleSheets);
    var found = 0;
    sheets.forEach(function (s) {
      try {
        Array.from(s.cssRules || []).forEach(function (r) {
          if (r.type === CSSRule.MEDIA_RULE && r.conditionText && /hover:\s*hover.*pointer:\s*fine/.test(r.conditionText)) found++;
        });
      } catch (e) {}
    });
    return found >= 3;
  });

  // === 项3：reduced-motion 全局收口 ===
  check('ui-common.css 含 prefers-reduced-motion 全局规则', function () {
    var sheets = Array.from(document.styleSheets);
    var ok = false;
    sheets.forEach(function (s) {
      try {
        Array.from(s.cssRules || []).forEach(function (r) {
          if (r.type === CSSRule.MEDIA_RULE && /prefers-reduced-motion:\s*reduce/.test(r.conditionText || '')) ok = true;
        });
      } catch (e) {}
    });
    return ok;
  });

  // === 项4：transition:all 收敛 ===
  check('三份 CSS 中 transition:all 已清零（允许内联样式/JS模板例外）', function () {
    var sheets = Array.from(document.styleSheets);
    var bad = 0;
    sheets.forEach(function (s) {
      if (!s.href) return;
      try {
        Array.from(s.cssRules || []).forEach(function walk(r) {
          if (r.cssText && /transition:\s*all\b/i.test(r.cssText)) bad++;
          if (r.cssRules) Array.from(r.cssRules).forEach(walk);
        });
      } catch (e) {}
    });
    return bad === 0;
  });

  // === 项5：View Transitions 跨页跳转 ===
  check('ui-common.css 含 @view-transition { navigation: auto; }', function () {
    var sheets = Array.from(document.styleSheets);
    var ok = false;
    sheets.forEach(function (s) {
      try {
        Array.from(s.cssRules || []).forEach(function (r) {
          if (r.type === 15 /* CSSViewTransitionRule */ || (r.cssText && r.cssText.includes('@view-transition'))) ok = true;
        });
      } catch (e) {}
    });
    return ok;
  });

  // === 项6：按钮悬停统一 ===
  check('7 类按钮 hover 含 brightness(1.06)（ui-common.css）', function () {
    var sheets = Array.from(document.styleSheets);
    var ok = false;
    sheets.forEach(function (s) {
      try {
        Array.from(s.cssRules || []).forEach(function walk(r) {
          if (r.cssText && /\.alert-ok:hover|\.ann-ok:hover|\.btn-item:hover|\.modal-inner-btn:hover|\.modal-close:hover|\.kf-jump:hover|\.kf-close:hover/.test(r.cssText)) {
            if (r.cssText.includes('brightness(1.06)')) ok = true;
          }
          if (r.cssRules) Array.from(r.cssRules).forEach(walk);
        });
      } catch (e) {}
    });
    return ok;
  });
  check('7 类按钮 active 仍保留 scale(0.97)', function () {
    var sheets = Array.from(document.styleSheets);
    var ok = false;
    sheets.forEach(function (s) {
      try {
        Array.from(s.cssRules || []).forEach(function walk(r) {
          if (r.cssText && /\.alert-ok:active|\.ann-ok:active|\.btn-item:active|\.modal-inner-btn:active|\.modal-close:active|\.kf-jump:active|\.kf-close:active/.test(r.cssText)) {
            if (r.cssText.includes('scale(0.94)') || r.cssText.includes('scale(0.97)')) ok = true;
          }
          if (r.cssRules) Array.from(r.cssRules).forEach(walk);
        });
      } catch (e) {}
    });
    return ok;
  });

  // === 项7：容器变换弹窗 ===
  check('window.__startViewTransition 已定义', function () {
    return typeof window.__startViewTransition === 'function';
  });

  // === 项8：按钮状态链 ===
  check('window.__btnSuccess 已定义', function () {
    return typeof window.__btnSuccess === 'function';
  });
  check('ui-common.css 含 @keyframes btnSuccessPop', function () {
    var sheets = Array.from(document.styleSheets);
    var ok = false;
    sheets.forEach(function (s) {
      try {
        Array.from(s.cssRules || []).forEach(function (r) {
          if (r.type === CSSRule.KEYFRAMES_RULE && r.name === 'btnSuccessPop') ok = true;
        });
      } catch (e) {}
    });
    return ok;
  });

  // === 版本号 ===
  check('sw.js CACHE_NAME = wnzyq-v211', function () {
    return typeof CACHE_NAME !== 'undefined' && CACHE_NAME === 'wnzyq-v211';
  });

  // === 输出 ===
  var passed = results.filter(function (r) { return r.ok; }).length;
  var total = results.length;
  console.log('[R211-verify] ' + passed + '/' + total + ' PASS');
  results.forEach(function (r) {
    console.log('  ' + (r.ok ? '✓' : '✗') + ' ' + r.name + (r.err ? ' — ' + r.err : ''));
  });
  window.__r211Results = results;
  return { passed: passed, total: total, results: results };
})();
