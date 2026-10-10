/* 版本号一处改、自动同步（v343 条3）
   用法：<node> scripts_sync_version.mjs
   VERSION 文件里 app= 是整站版本（离线缓存/文件名），img= 是图片版本。
   运行后自动写入：sw.js 的离线缓存版本、图片版本、config.js 的图片版本、各页面本地图片引用。
*/
import fs from 'node:fs';
const ver = Object.fromEntries(fs.readFileSync('VERSION', 'utf8').trim().split('\n').map(l => l.split('=').map(s => s.trim())));
const APP = ver.app, IMG = ver.img;
let changed = [];
let sw = fs.readFileSync('sw.js', 'utf8');
const sw2 = sw.replace(/const CACHE_NAME = 'wnzyq-v\d+';/, `const CACHE_NAME = 'wnzyq-v${APP}';`)
              /* v346 条21：sw.js 离线预缓存清单里的图片版本号也一并同步（原先只改 CACHE_NAME，换图后预缓存仍指旧号） */
              .replace(/(assets\/images\/[a-z]+\.png\?v=)v?\d+/g, `$1${IMG}`);
if (sw2 !== sw) { fs.writeFileSync('sw.js', sw2); changed.push('sw.js'); }
let cfg = fs.readFileSync('config.js', 'utf8');
const cfg2 = cfg.replace(/window\.IMG_VERSION = 'v\d+';/, `window.IMG_VERSION = 'v${IMG}';`);
if (cfg2 !== cfg) { fs.writeFileSync('config.js', cfg2); changed.push('config.js'); }
for (const f of ['index.html', 'shop.html', 'admin.html', 'error.html']) {
  let s = fs.readFileSync(f, 'utf8');
  /* v346 条3：修正匹配——图片 URL 实际写作 ?v=330（纯数字），原正则要求 ?v=v330 恒不命中，
     导致"自动同步"对四页 HTML 其实从未生效；改为 v? 可选，输出统一 ?v=数字。 */
  const s2 = s.replace(/(assets\/images\/[a-z]+\.png\?v=)v?\d+/g, `$1${IMG}`);
  if (s2 !== s) { fs.writeFileSync(f, s2); changed.push(f); }
}
console.log('已同步版本号 app=v' + APP + ' img=v' + IMG + ' →', changed.join(', ') || '（无需改动）');
