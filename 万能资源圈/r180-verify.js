/**
 * R180 Round 1 (P0) Verification Script
 * 运行: node r180-verify.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let pass = 0, fail = 0;
function ok(msg) { console.log('  ✓ ' + msg); pass++; }
function no(msg) { console.log('  ✗ ' + msg); fail++; }
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf-8'); }

console.log('\n========== R180 P0 Verification ==========\n');

// 1. sw.js CACHE_NAME bumped
console.log('[1] sw.js CACHE_NAME');
const sw = read('sw.js');
if (sw.includes("const CACHE_NAME = 'wnzyq-v182'")) ok("CACHE_NAME = 'wnzyq-v182'");
else no("CACHE_NAME not bumped to v182");
if (sw.includes('R180')) ok('R180 comment present');
else no('R180 comment missing');

// 2. ui-common.css Design Tokens
console.log('\n[2] ui-common.css Design Tokens');
const uc = read('assets/ui-common.css');
['--brand-primary', '--color-success', '--gray-100', '--bg-card', '--border-focus',
 '--space-2', '--radius-md', '--shadow-md', '--text-base', '--font-medium',
 '--leading-normal', '--duration-normal', '--ease-out', '--touch-target-min'].forEach(function(t) {
  if (uc.indexOf(t) !== -1) ok('Token ' + t);
  else no('Token missing: ' + t);
});

// 3. Touch targets ≥44px
console.log('\n[3] Touch targets ≥44px');
const shopCss = read('assets/shop.css');
const adminCss = read('assets/admin.css');

function hasPropAfter(css, selector, prop) {
  var idx = css.indexOf(selector);
  if (idx === -1) return false;
  var blockStart = css.indexOf('{', idx);
  var blockEnd = css.indexOf('}', blockStart);
  if (blockStart === -1 || blockEnd === -1) return false;
  return css.substring(blockStart, blockEnd).indexOf(prop) !== -1;
}

if (hasPropAfter(shopCss, '.search-input', 'height: 44px')) ok('shop.css search-input height 44px');
else no('shop.css search-input height not 44px');

if (hasPropAfter(shopCss, '.category-tag', 'min-height: 44px')) ok('shop.css category-tag min-height 44px');
else no('shop.css category-tag min-height not 44px');

if (hasPropAfter(shopCss, '.back-top', 'width: 44px')) ok('shop.css back-top 44px');
else no('shop.css back-top not 44px');

if (hasPropAfter(adminCss, '.admin-search input', 'height: 44px')) ok('admin.css admin-search input height 44px');
else no('admin.css admin-search input height not 44px');

if (hasPropAfter(adminCss, '.logout-btn', 'height: 44px')) ok('admin.css logout-btn height 44px');
else no('admin.css logout-btn height not 44px');

if (hasPropAfter(uc, '.tab', 'height: 44px')) ok('ui-common.css .tab height 44px');
else no('ui-common.css .tab height not 44px');

if (hasPropAfter(uc, '.view-btn', 'height: 44px')) ok('ui-common.css .view-btn height 44px');
else no('ui-common.css .view-btn height not 44px');

if (hasPropAfter(uc, '.pg-btn', 'min-height: 44px')) ok('ui-common.css .pg-btn min-height 44px');
else no('ui-common.css .pg-btn min-height not 44px');

// 4. shop.js UX P0-1 / P0-2 / P0-4
console.log('\n[4] shop.js UX P0-1 / P0-2 / P0-4');
const shopJs = read('assets/shop.js');
if (shopJs.includes('scrollLoading')) ok('P0-1: infinite scroll loading tip');
else no('P0-1: scrollLoading missing');
if (shopJs.includes('allLoaded')) ok('P0-1: allLoaded completion indicator');
else no('P0-1: allLoaded missing');
if (shopJs.includes('addEmptyActions')) ok('P0-2: addEmptyActions function');
else no('P0-2: addEmptyActions missing');
if (shopJs.includes('addEmptyActions(emptyTip)')) ok('P0-2: addEmptyActions called');
else no('P0-2: addEmptyActions not called');
if (shopJs.includes('resourceCodeInput.select()')) ok('P0-4: auto-select on verify failure');
else no('P0-4: auto-select missing');

// 5. admin.js UX P0-3 / P0-5 / P0-6 / P0-7 / P0-8
console.log('\n[5] admin.js UX P0-3 / P0-5 / P0-6 / P0-7 / P0-8');
const adminJs = read('assets/admin.js');
if (adminJs.includes("svg.addEventListener('touchstart'") && adminJs.includes("svg.addEventListener('touchmove'")) ok('P0-3: line chart touch events');
else no('P0-3: line chart touch events missing');
if (adminJs.includes('scrollIntoView') && adminJs.indexOf('fCidDisplay') < adminJs.indexOf('scrollIntoView')) ok('P0-5: scrollIntoView on validation failure');
else no('P0-5: scrollIntoView missing');
if (adminJs.includes("box.classList.add('loading')")) ok('P0-6: pagination loading state added');
else no('P0-6: pagination loading state missing');
if (adminJs.includes("box.classList.remove('loading')")) ok('P0-6: pagination loading state removed');
else no('P0-6: pagination loading state remove missing');
if (adminJs.includes('batchCount')) ok('P0-7: batchCount element referenced');
else no('P0-7: batchCount missing');
if (adminJs.includes("state.prodSelected = {}; document.querySelectorAll('.row-check').forEach(function (cb) { cb.checked = false; }); updateBatchBar();")) ok('P0-7: clear selection on batch success');
else no('P0-7: clear selection on batch success missing');
if (adminJs.includes("loginPass")) ok('P0-8: loginPass Enter submit');
else no('P0-8: loginPass Enter submit missing');
if (adminJs.includes('togglePwdVisibility')) ok('P0-8: password toggle function');
else no('P0-8: password toggle function missing');

// 6. admin.html password toggle button
console.log('\n[6] admin.html P0-8 password toggle');
const adminHtml = read('admin.html');
if (adminHtml.includes('pwdToggleBtn')) ok('admin.html: pwdToggleBtn button present');
else no('admin.html: pwdToggleBtn missing');
if (adminHtml.includes('togglePwdVisibility')) ok('admin.html: togglePwdVisibility onclick');
else no('admin.html: togglePwdVisibility onclick missing');

// 7. Tablet breakpoints in admin.css
console.log('\n[7] admin.css tablet breakpoints (601px-900px)');
const tabletMatches = (adminCss.match(/@media \(min-width: 601px\) and \(max-width: 900px\)/g) || []).length;
if (tabletMatches >= 6) ok('admin.css has ' + tabletMatches + ' tablet breakpoint blocks');
else no('admin.css tablet breakpoints insufficient: ' + tabletMatches);

// 8. shop.css tablet breakpoint
console.log('\n[8] shop.css tablet breakpoint');
if (shopCss.includes('@media (min-width: 601px) and (max-width: 900px)')) ok('shop.css tablet breakpoint present');
else no('shop.css tablet breakpoint missing');

// Summary
console.log('\n========== Summary ==========');
console.log('PASS: ' + pass);
console.log('FAIL: ' + fail);
console.log('TOTAL: ' + (pass + fail));
if (fail === 0) {
  console.log('\n✅ All P0 assertions passed!\n');
  process.exit(0);
} else {
  console.log('\n❌ ' + fail + ' assertion(s) failed.\n');
  process.exit(1);
}
