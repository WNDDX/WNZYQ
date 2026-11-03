/* 全站规范自检（不需要懂代码，双击 检查.cmd 即可）
   目的：把「同一功能好几套写法」这类问题在部署前就拦住。
   规则来自 HANDOVER.md 的《组件白名单 / 禁用清单》。任何一条不过，退出码 1。 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = dir ? dir + '/' + name : name;
    const st = fs.statSync(path.join(ROOT, rel));
    if (st.isDirectory()) { if (!/^(node_modules|\.git|\.workbuddy|tools)$/.test(name)) walk(rel); }
    else files.push(rel);
  }
})('');

const jsFiles = files.filter(f => /^assets\/.*\.js$/.test(f) && !/qrcode\.min\.js$/.test(f));
const pageFiles = files.filter(f => /^[^/]+\.html$/.test(f));
const cssFiles = files.filter(f => /^assets\/.*\.css$/.test(f));

const problems = [];
const warn = [];
const add = (list, file, line, msg) => list.push({ file, line, msg });

/* 1) 语法：所有 JS 必须能解析 */
for (const f of jsFiles.concat(['functions/[[path]].js'])) {
  if (!exists(f)) continue;
  try { execSync('node --check "' + path.join(ROOT, f) + '"', { stdio: 'pipe' }); }
  catch (e) { add(problems, f, 0, '语法错误，文件无法解析'); }
}

/* 2) 禁用：浏览器原生弹窗（会打断操作、样式不统一） */
for (const f of jsFiles) {
  read(f).split('\n').forEach((ln, i) => {
    if (/(^|[^.\w])alert\s*\(/.test(ln) && !/__silent|console/.test(ln)) add(problems, f, i + 1, '用了原生 alert（应为 showToast）');
    if (/(^|[^.\w])confirm\s*\(/.test(ln) && !/showConfirm/.test(ln)) add(problems, f, i + 1, '用了原生 confirm（应为 showConfirm）');
    if (/(^|[^.\w])prompt\s*\(/.test(ln)) add(problems, f, i + 1, '用了原生 prompt（应为 inputMask）');
  });
}

/* 3) 禁用：绕开统一入口直接调下拉组件（历史坑：函数没暴露、静默跳过） */
for (const f of jsFiles) {
  if (f === 'assets/admin-3.js' || f === 'assets/ui-common.js') continue; /* 定义处与兜底转发不在此列 */
  read(f).split('\n').forEach((ln, i) => {
    if (/window\.makeSelectPicker\s*\(/.test(ln)) add(warn, f, i + 1, '直接调 makeSelectPicker，建议走 window.__upgradeSelects');
  });
}

/* 4) 禁用：UI 文案里的「商品/产品」（老板口径：一切叫资源） */
for (const f of jsFiles.concat(pageFiles)) {
  if (f.indexOf('全系统一致性审查报告') >= 0) continue; /* 审查报告本身会引用原话 */
  read(f).split('\n').forEach((ln, i) => {
    if (/^\s*(\/\/|\/\*|\*)/.test(ln)) return;            // 整行注释不管
    var code = ln.split('//')[0];                          // 行尾注释也剥掉（说明文字里出现不算违规）
    if (!code.trim()) return;
    if (/\/.*商品.*\//.test(code)) return;                 // 正则里当关键词用（识别对方表头）不算文案
    if (/商品|产品/.test(code) && !/class|id=|data-|var |function |import/.test(code)) add(warn, f, i + 1, '界面文案出现「商品/产品」，应统一为「资源」');
  });
}

/* 5) 禁用：单字按钮（删/改/看）——老板明确要求用整词 */
for (const f of jsFiles.concat(pageFiles)) {
  read(f).split('\n').forEach((ln, i) => {
    if (ln.indexOf('>删</button>') >= 0 || ln.indexOf('>改</button>') >= 0 || ln.indexOf('>看</button>') >= 0) add(problems, f, i + 1, '单字按钮，应写「删除/编辑/查看」');
  });
}

/* 6) CSS：引用了但没定义的颜色/尺寸令牌（会导致样式静默失效） */
{
  const css = cssFiles.map(f => read(f)).join('\n');
  const defs = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
  /* 只统计「没有兜底值」的引用：var(--x) 而不是 var(--x, fallback)——后者缺定义也不会出问题 */
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)\s*\)/gi)].map(m => m[1]));
  for (const v of used) if (!defs.has(v)) add(problems, 'assets/*.css', 0, '令牌 ' + v + ' 被引用但没有定义');
  const braces = (css.replace(/\/\*[\s\S]*?\*\//g, '').match(/{/g) || []).length
    - (css.replace(/\/\*[\s\S]*?\*\//g, '').match(/}/g) || []).length;
  if (braces !== 0) add(problems, 'assets/*.css', 0, '大括号不配平（多 ' + braces + ' 个）');
}

/* 7) 页面必须引用的公共文件是否都在 */
for (const p of ['ui-common.css', 'ui-common.js']) {
  if (!exists('assets/' + p)) add(problems, 'assets/' + p, 0, '公共文件缺失');
}

/* 输出 */
const ok = problems.length === 0;
console.log('=== 全站规范自检 ===');
console.log('检查文件：' + (jsFiles.length + cssFiles.length + pageFiles.length) + ' 个\n');
if (problems.length) {
  console.log('必须修（' + problems.length + '）：');
  problems.slice(0, 60).forEach(p => console.log('  ' + p.file + (p.line ? ':' + p.line : '') + '  ' + p.msg));
  if (problems.length > 60) console.log('  …还有 ' + (problems.length - 60) + ' 条');
} else console.log('必须修：无');
if (warn.length) {
  console.log('\n建议改（' + warn.length + '）：');
  warn.slice(0, 30).forEach(p => console.log('  ' + p.file + (p.line ? ':' + p.line : '') + '  ' + p.msg));
  if (warn.length > 30) console.log('  …还有 ' + (warn.length - 30) + ' 条');
} else console.log('\n建议改：无');
console.log('\n' + (ok ? '结论：通过，可以部署。' : '结论：有 ' + problems.length + ' 项必须先修。'));
process.exit(ok ? 0 : 1);
