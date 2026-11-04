/* v536 死样式清理：删掉「选择器里的类名全都没人用」的规则
   用法：node tools/prune-css.cjs          只统计，不改文件
        node tools/prune-css.cjs --write  真的删并写回
   保护：@keyframes / @font-face / :root / html / body 等无类选择器一律不动；
        选择器里只要还有一个在用的类或 id，整条保留。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const DEAD = new Set(require('./dead-classes.json'));

const CSS_FILES = ['assets/admin.css', 'assets/shop.css', 'assets/ui-common.css', 'assets/motion.css'];

/* 读一段 CSS，按花括号切成顶层节点 */
function splitNodes(css) {
  const nodes = [];
  let i = 0, start = 0, depth = 0, inComment = false, inStr = null;
  while (i < css.length) {
    const ch = css[i], nx = css[i + 1];
    if (inComment) { if (ch === '*' && nx === '/') { inComment = false; i += 2; continue; } i++; continue; }
    if (inStr) { if (ch === '\\') { i += 2; continue; } if (ch === inStr) inStr = null; i++; continue; }
    if (ch === '/' && nx === '*') { inComment = true; i += 2; continue; }
    if (ch === '"' || ch === "'") { inStr = ch; i++; continue; }
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0) { nodes.push(css.slice(start, i + 1)); start = i + 1; }
      i++; continue;
    }
    if (depth === 0 && (ch === ';' || ch === '}')) { i++; continue; }
    i++;
  }
  if (start < css.length) nodes.push(css.slice(start));
  return nodes;
}

function classesOf(sel) {
  const out = [];
  const re = /\.(-?[_a-zA-Z][\w-]*)/g;
  let m; while ((m = re.exec(sel))) out.push(m[1]);
  return out;
}

function isDeadRule(selector) {
  const cls = classesOf(selector);
  if (!cls.length) return false;                      /* 纯标签选择器不动 */
  if (/#[\w-]+/.test(selector)) return false;         /* 带 id 的不动 */
  return cls.every(c => DEAD.has(c));
}

let removedRules = 0, removedBytes = 0;

function processBlock(css, file) {
  const nodes = splitNodes(css);
  const keep = [];
  for (const node of nodes) {
    const trimmed = node.trim();
    if (!trimmed) { keep.push(node); continue; }
    if (/^@(media|supports)/.test(trimmed)) {
      const open = node.indexOf('{');
      const head = node.slice(0, open + 1);
      const body = node.slice(open + 1, node.lastIndexOf('}'));
      const inner = processBlock(body, file);
      if (!inner.trim()) { removedBytes += node.length; continue; }   /* 里面全删光，外层也删 */
      keep.push(head + inner + '}');
      continue;
    }
    if (/^@/.test(trimmed)) { keep.push(node); continue; }            /* @keyframes 等原样保留 */
    const open = node.indexOf('{');
    if (open < 0) { keep.push(node); continue; }
    const sel = node.slice(0, open);
    if (isDeadRule(sel)) { removedRules++; removedBytes += node.length; continue; }
    /* 选择器列表（逗号分隔）里，只去掉「这一段全是死类」的那几段，剩下的原样保留 */
    if (sel.indexOf(',') !== -1) {
      const parts = sel.split(',');
      const alive = parts.filter(function (one) { return !isDeadRule(one); });
      if (alive.length && alive.length < parts.length) {
        removedRules += (parts.length - alive.length);
        keep.push(alive.join(',') + node.slice(open));
        continue;
      }
    }
    keep.push(node);
  }
  return keep.join('');
}

for (const rel of CSS_FILES) {
  const p = path.join(ROOT, rel);
  const src = fs.readFileSync(p, 'utf8');
  const out = processBlock(src, rel);
  const before = Buffer.byteLength(src), after = Buffer.byteLength(out);
  console.log(rel.padEnd(24), (before / 1024).toFixed(1) + 'KB →', (after / 1024).toFixed(1) + 'KB', '省', ((before - after) / 1024).toFixed(1) + 'KB');
  if (WRITE) fs.writeFileSync(p, out);
}
console.log('\n删除规则数:', removedRules, '｜合计省下', (removedBytes / 1024).toFixed(1), 'KB', WRITE ? '（已写回）' : '（试运行，加 --write 才真删）');
