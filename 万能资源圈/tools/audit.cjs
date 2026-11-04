/* v535 全站一致性审计（只读，不改任何文件）
   输出六类问题：①硬编码色值 ②越界字号 ③越界圆角 ④未被使用的 CSS 类 ⑤文案口径 ⑥重复选择器
   用法：node tools/audit.cjs */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return ''; } };
const walk = (dir, out = []) => {
  for (const n of fs.readdirSync(dir)) {
    if (n === '.workbuddy' || n === '.wrangler' || n === '.git' || n === 'node_modules') continue;
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out); else out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  }
  return out;
};

const files = walk(ROOT);
const cssFiles = files.filter(f => /^(assets|tools)\/.*\.css$/.test(f) || /\.css$/.test(f));
const jsFiles = files.filter(f => /\.js$/.test(f));
const htmlFiles = files.filter(f => /\.html$/.test(f));

const out = { hardColors: [], fontOutliers: [], radiusOutliers: [], unusedClass: [], terms: [], dupSelectors: [] };

/* ===== ① 硬编码色值（只看声明体，跳过 var() 兜底与行内注释） ===== */
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const COLOR_WHITELIST = new Set(['#fff', '#ffffff', '#000', '#000000']);
for (const f of cssFiles) {
  read(f).split('\n').forEach((line, i) => {
    if (/^\s*\/\*|\*\//.test(line)) return;
    /* 去掉 var(--x, #fff) 里的兜底值，只留真正写死的 */
    const stripped = line.replace(/var\([^()]*\)/g, 'var()');
    const m = stripped.match(HEX);
    if (!m) return;
    for (const c of m) {
      if (COLOR_WHITELIST.has(c.toLowerCase())) continue;
      out.hardColors.push({ file: f, line: i + 1, color: c, text: line.trim().slice(0, 90) });
    }
  });
}

/* ===== ② 越界字号：白名单 = 10/11/12/13/14/16/18/20/24/28/32/40/48 ===== */
const FS_OK = new Set([10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48]);
for (const f of cssFiles) {
  read(f).split('\n').forEach((line, i) => {
    const m = line.match(/font-size:\s*([\d.]+)px/g);
    if (!m) return;
    for (const one of m) {
      const v = parseFloat(one.split(':')[1]);
      if (!FS_OK.has(v)) out.fontOutliers.push({ file: f, line: i + 1, size: v, text: line.trim().slice(0, 80) });
    }
  });
}

/* ===== ③ 越界圆角：白名单 = 0/2/4/6/8/12/999（2 仅用于进度条类细线）===== */
const RD_OK = new Set([0, 2, 4, 6, 8, 12, 999]);
for (const f of cssFiles) {
  read(f).split('\n').forEach((line, i) => {
    const m = line.match(/border-radius:\s*([\d.]+)px/g);
    if (!m) return;
    for (const one of m) {
      const v = parseFloat(one.split(':')[1]);
      if (!RD_OK.has(v)) out.radiusOutliers.push({ file: f, line: i + 1, r: v, text: line.trim().slice(0, 80) });
    }
  });
}

/* ===== ④ 未被使用的 CSS 类（类名在 html/js 里完全没出现过） ===== */
const corpus = htmlFiles.map(f => read(f)).join('\n') + '\n' + jsFiles.map(f => read(f)).join('\n');
const classDefs = new Map();
for (const f of cssFiles) {
  const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /\.(-?[_a-zA-Z][\w-]*)/g;
  let m;
  while ((m = re.exec(css))) {
    const name = m[1];
    if (!classDefs.has(name)) classDefs.set(name, f);
  }
}
for (const [name, f] of classDefs) {
  if (name.length < 3) continue;
  if (new RegExp('[\\s"\'.]' + name + '[\\s"\'\\.:\\[{,)]').test(corpus)) continue;
  out.unusedClass.push({ cls: name, file: f });
}

/* ===== ⑤ 文案口径 ===== */
const TERMS = [
  { re: /商品/g, why: '禁用词：全系统叫「资源」' },
  { re: /[0-9]+\s*件资源/g, why: '单位应为「个资源」' },
  { re: /数据缓存/g, why: '建议统一叫「回收站」' },
  { re: /点确定|\bOK\b/g, why: '按钮文案统一「确定」' },
  { re: /正在加载|加载中/g, why: '统一「正在读取…」' },
];
for (const f of [...htmlFiles, ...jsFiles]) {
  const txt = read(f);
  txt.split('\n').forEach((line, i) => {
    if (/^\s*\/\*|^\s*\/\//.test(line)) return;
    for (const t of TERMS) {
      if (t.re.test(line)) out.terms.push({ file: f, line: i + 1, why: t.why, text: line.trim().slice(0, 90) });
    }
  });
}

/* ===== ⑥ 重复选择器（同一文件里同一选择器出现多次） ===== */
for (const f of cssFiles) {
  const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
  const seen = new Map();
  const re = /(^|\})\s*([^{}@]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[2].trim().replace(/\s+/g, ' ');
    if (!sel || sel.length > 80 || /^(\d+%)$/.test(sel)) continue;
    seen.set(sel, (seen.get(sel) || 0) + 1);
  }
  for (const [sel, n] of seen) if (n > 2) out.dupSelectors.push({ file: f, sel, times: n });
}

const sum = (a) => a.length;
console.log('=== v535 全站一致性审计 ===');
console.log('① 硬编码色值（非黑白）      ', sum(out.hardColors), '处');
console.log('② 越界字号                  ', sum(out.fontOutliers), '处');
console.log('③ 越界圆角                  ', sum(out.radiusOutliers), '处');
console.log('④ 疑似未使用的 CSS 类        ', sum(out.unusedClass), '个');
console.log('⑤ 文案口径问题              ', sum(out.terms), '处');
console.log('⑥ 同文件重复 >2 次的选择器   ', sum(out.dupSelectors), '组');
console.log('\n--- ② 越界字号明细 ---');
out.fontOutliers.slice(0, 20).forEach(x => console.log(`  ${x.file}:${x.line}  ${x.size}px  ${x.text}`));
console.log('\n--- ③ 越界圆角明细 ---');
out.radiusOutliers.slice(0, 20).forEach(x => console.log(`  ${x.file}:${x.line}  ${x.r}px  ${x.text}`));
console.log('\n--- ④ 未使用类（前 20）---');
out.unusedClass.slice(0, 20).forEach(x => console.log(`  .${x.cls}   (${x.file})`));
console.log('\n--- ⑤ 文案明细（前 20）---');
out.terms.slice(0, 20).forEach(x => console.log(`  ${x.file}:${x.line}  ${x.why}  ${x.text}`));
console.log('\n--- ⑥ 重复选择器（前 10）---');
out.dupSelectors.slice(0, 10).forEach(x => console.log(`  ${x.file}  ${x.sel} ×${x.times}`));

fs.writeFileSync(path.join(ROOT, 'tools/audit-report.json'), JSON.stringify(out, null, 1));
console.log('\n明细已写入 tools/audit-report.json');
