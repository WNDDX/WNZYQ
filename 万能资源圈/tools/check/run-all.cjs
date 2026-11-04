/* v538 全量自检：把散落的巡检脚本串成一条，跑完给一张总表
   用法（在有浏览器的机器上）：node tools/check/run-all.cjs
   会依次跑：设置页/组件一致性 → 无访问障碍(aria/id) → 三档宽度响应式 → 关键交互回归 */
const { execFileSync } = require('child_process');
const path = require('path');

const R = __dirname;
const items = [
  ['组件一致性（设置页/按钮/三角/折叠）', 'verify-settings.cjs'],
  ['无障碍与结构（重复id/无名按钮/小点击区/文案）', 'audit-a11y.cjs'],
  ['响应式（390/768/1024 × 4 页签 + 前台）', 'check-responsive.cjs'],
  ['关键交互回归（体检/公告预览/测一下/导入历史）', 'regress-ui.cjs']
];

let fail = 0;
for (const [name, file] of items) {
  console.log('\n========== ' + name + ' ==========');
  try {
    const out = execFileSync(process.execPath, [path.join(R, file)], { encoding: 'utf8', timeout: 180000 });
    console.log(out.trim());
  } catch (e) {
    fail++;
    console.log('（这一项没跑完：' + (e.message || '').split('\n')[0] + '）');
    if (e.stdout) console.log(String(e.stdout).trim());
  }
}
console.log('\n自检结束：' + (items.length - fail) + '/' + items.length + ' 项跑完');
console.log(fail ? '有 ' + fail + ' 项异常，看上面的输出' : '全部通过');
process.exit(fail ? 1 : 0);
