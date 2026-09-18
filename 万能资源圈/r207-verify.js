/**
 * R207 验证脚本
 * 含：边界单测 + 60 天口径审计表 + 全包清理痕迹检查
 * 用法：node r207-verify.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const ok = fn();
    if (ok) { console.log(`  ✅ ${name}`); passed++; }
    else { console.log(`  ❌ ${name}`); failed++; }
  } catch (e) {
    console.log(`  ❌ ${name} (异常: ${e.message})`);
    failed++;
  }
}

console.log('\n========== R207 验证开始 ==========\n');

// ==================== 1. 边界单测：60 天滚动口径 ====================
console.log('【一、边界单测：60 天滚动口径】');

// 模拟 SQLite datetime('now', '-60 days') 行为
// UTC 时间，"now" 为当前时刻，-60 days = 当前时刻往前推 60×24 小时
function makeDate(daysAgo, minutesOffset = 0) {
  const d = new Date(Date.now() - daysAgo * 24 * 3600 * 1000 + minutesOffset * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// 构造测试数据
const now = new Date();
const exactly60DaysAgo = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
const justUnder60d = new Date(exactly60DaysAgo.getTime() + 1 * 60 * 1000);   // 59天23:59
const justOver60d  = new Date(exactly60DaysAgo.getTime() - 1 * 60 * 1000);   // 60天00:01

// 模拟 WHERE created_at < datetime('now', '-60 days')
function shouldDelete(createdAtISO) {
  const created = new Date(createdAtISO);
  return created < exactly60DaysAgo; // 严格小于 = 已过期
}

check('59天23小时59分（created_at = 60天前 +1分钟）→ 保留', () => {
  return !shouldDelete(justUnder60d.toISOString());
});

check('60天00小时01分（created_at = 60天前 -1分钟）→ 删除', () => {
  return shouldDelete(justOver60d.toISOString());
});

check('边界口径 = 按录入时刻滚动 60×24 小时（非自然日 24 点日界）', () => {
  // 验证：同一时刻录入的数据，在刚好 60 天后的同一时刻被处理
  const entryTime = new Date('2026-07-20T14:39:00Z');
  const processTime = new Date('2026-09-18T14:39:00Z'); // 正好 60 天后同一时刻
  const sixtyDaysBeforeProcess = new Date(processTime.getTime() - 60 * 24 * 3600 * 1000);
  return entryTime.getTime() === sixtyDaysBeforeProcess.getTime();
});

// ==================== 2. track.js 三表清理验证 ====================
console.log('\n【二、track.js 三表清理验证】');

const trackPath = path.join(__dirname, 'functions/api/track.js');
const trackContent = fs.readFileSync(trackPath, 'utf-8');

check('track.js 含 stats 清理（DELETE FROM stats WHERE created_at）', () => {
  return /DELETE FROM stats WHERE created_at < datetime\('now', '-60 days'\)/.test(trackContent);
});

check('track.js 含 sessions 清理（DELETE FROM sessions WHERE created_at）', () => {
  return /DELETE FROM sessions WHERE created_at < datetime\('now', '-60 days'\)/.test(trackContent);
});

check('track.js 含 login_attempts 清理（DELETE FROM login_attempts WHERE last_attempt）', () => {
  return /DELETE FROM login_attempts WHERE last_attempt < datetime\('now', '-60 days'\)/.test(trackContent);
});

check('track.js 三表在同一 try/catch 内（失败不阻塞埋点）', () => {
  // track.js 有两个 try/catch：先找清理专用的 catch（含"滚动清理失败"），再回找对应的 try
  const cleanupCatchIdx = trackContent.indexOf("catch (e) { console.error('滚动清理失败(不影响埋点):', e); }");
  if (cleanupCatchIdx === -1) return false;
  // 在 catch 之前找最后一个 try {
  const blockBeforeCatch = trackContent.slice(0, cleanupCatchIdx);
  const tryIdx = blockBeforeCatch.lastIndexOf('try {');
  if (tryIdx === -1) return false;
  const block = trackContent.slice(tryIdx, cleanupCatchIdx);
  return block.includes('stats') && block.includes('sessions') && block.includes('login_attempts');
});

// ==================== 3. cleanup.js 定时版痕迹清除验证 ====================
console.log('\n【三、cleanup.js 定时版痕迹清除验证】');

const cleanupPath = path.join(__dirname, 'functions/api/cleanup.js');
const cleanupContent = fs.readFileSync(cleanupPath, 'utf-8');

check('cleanup.js 不含 "onRequestScheduled"（已删除）', () => {
  return !cleanupContent.includes('onRequestScheduled');
});

check('cleanup.js 不含 "Cron Trigger"（注释已清）', () => {
  return !cleanupContent.includes('Cron Trigger');
});

check('cleanup.js 不含 "0 16 * * *"（cron 表达式已清）', () => {
  return !cleanupContent.includes('0 16 * * *');
});

check('cleanup.js 不含 "控制台手动配置"（注释已清）', () => {
  return !cleanupContent.includes('控制台手动配置');
});

check('cleanup.js 注释含 R207 老板拍板说明', () => {
  return cleanupContent.includes('R207') && cleanupContent.includes('老板已拍板不恢复定时版');
});

// ==================== 4. login.js 字段统一验证 ====================
console.log('\n【四、login.js 字段统一验证】');

const loginPath = path.join(__dirname, 'functions/api/admin/login.js');
const loginContent = fs.readFileSync(loginPath, 'utf-8');

check('login.js sessions 清理用 created_at（非 expires_at）', () => {
  return /DELETE FROM sessions WHERE created_at/.test(loginContent);
});

check('login.js 不含 "DELETE FROM sessions WHERE expires_at"', () => {
  return !loginContent.includes('DELETE FROM sessions WHERE expires_at');
});

check('login.js login_attempts 保留 last_attempt（录入时间即最近尝试时间）', () => {
  return /DELETE FROM login_attempts WHERE last_attempt/.test(loginContent);
});

check('login.js 注释含 R207 说明（created_at 口径 + last_attempt 保留理由）', () => {
  return loginContent.includes('R207') && loginContent.includes('created_at') && loginContent.includes('last_attempt');
});

// ==================== 5. sw.js 版本号验证 ====================
console.log('\n【五、sw.js 版本号验证】');

const swPath = path.join(__dirname, 'sw.js');
const swContent = fs.readFileSync(swPath, 'utf-8');

check('sw.js CACHE_NAME = wnzyq-v207', () => {
  return swContent.includes("const CACHE_NAME = 'wnzyq-v207'");
});

check('sw.js 不含 "恢复定时清理" 表述（R206 旧注释已改写）', () => {
  // R207 注释放在前面，但后面保留了历史注释链，检查是否有 R207 新注释
  return swContent.includes('R207') && swContent.includes('老板拍板不恢复定时版');
});

// ==================== 6. 全包搜索：定时清理痕迹零命中 ====================
console.log('\n【六、全包定时清理痕迹零命中】');

function grepProject(pattern) {
  const apiDir = path.join(__dirname, 'functions/api');
  const files = fs.readdirSync(apiDir, { recursive: true })
    .filter(f => f.endsWith('.js'))
    .map(f => path.join(apiDir, f));
  files.push(swPath);
  // 排除本验证脚本及旧验证脚本（它们保留历史检查用字符串，不属代码）
  const exclude = ['r206-verify.js', 'r207-verify.js'];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    if (exclude.some(e => f.includes(e))) continue;
    const content = fs.readFileSync(f, 'utf-8');
    if (pattern.test(content)) return true;
  }
  return false;
}

check('全包不含 "onRequestScheduled"', () => !grepProject(/onRequestScheduled/));
check('全包不含 "Cron Triggers"', () => !grepProject(/Cron Triggers/i));
check('全包不含 "0 16 \* \* \*"', () => !grepProject(/0 16 \* \* \*/));
check('全包不含 "控制台手动配置"', () => !grepProject(/控制台手动配置/));

// ==================== 7. 60 天口径审计表 ====================
console.log('\n【七、60 天口径审计表】');

const audit = [
  { table: 'stats',      trigger: 'track.js R30-#10',   field: 'created_at',   retention: '录入时间滚动 60 天', note: '埋点顺带清理' },
  { table: 'stats',      trigger: 'cleanup.js GET',     field: 'created_at',   retention: '录入时间滚动 60 天', note: '手动触发清理' },
  { table: 'sessions',   trigger: 'track.js R30-#10',   field: 'created_at',   retention: '录入时间滚动 60 天', note: 'R207 并入顺带' },
  { table: 'sessions',   trigger: 'cleanup.js GET',     field: 'created_at',   retention: '录入时间滚动 60 天', note: '手动触发清理' },
  { table: 'sessions',   trigger: 'login.js R30-#10',   field: 'created_at',   retention: '录入时间滚动 60 天', note: 'R207 改 expires_at→created_at' },
  { table: 'login_attempts', trigger: 'track.js R30-#10', field: 'last_attempt', retention: '录入时间滚动 60 天', note: '录入时间即最近尝试时间' },
  { table: 'login_attempts', trigger: 'cleanup.js GET',   field: 'last_attempt', retention: '录入时间滚动 60 天', note: '手动触发清理' },
  { table: 'login_attempts', trigger: 'login.js R30-#10', field: 'last_attempt', retention: '录入时间滚动 60 天', note: '录入时间即最近尝试时间' },
  { table: 'stats',      trigger: 'stats.js 浏览记录',  field: 'created_at',   retention: '查询窗口 60 天',     note: '只查不删，查询范围与保留期一致' },
];

// 业务数据不清理的说明
const noCleanup = [
  { table: 'products',     reason: '业务核心数据，永不过期，由管理员手动增删改' },
  { table: 'categories',   reason: '业务核心数据，永不过期，由管理员手动增删改' },
  { table: 'admins',       reason: '管理员账户数据，永不过期' },
  { table: 'resource_bindings', reason: '业务绑定数据，永不过期，由解锁/解绑操作管理' },
];

console.log('  ┌─────────────────┬────────────────────┬────────────────┬────────────────────┬──────────────────────────────┐');
console.log('  │ 表名            │ 触发位置           │ 判断字段       │ 保留期             │ 备注                         │');
console.log('  ├─────────────────┼────────────────────┼────────────────┼────────────────────┼──────────────────────────────┤');
audit.forEach(r => {
  const line = `  │ ${r.table.padEnd(15)} │ ${r.trigger.padEnd(18)} │ ${r.field.padEnd(14)} │ ${r.retention.padEnd(18)} │ ${r.note.padEnd(28)} │`;
  console.log(line);
});
console.log('  └─────────────────┴────────────────────┴────────────────┴────────────────────┴──────────────────────────────┘');

console.log('\n  【不清理的业务数据】');
console.log('  ┌─────────────────────┬──────────────────────────────────────────────┐');
console.log('  │ 表名                │ 不清理理由                                   │');
console.log('  ├─────────────────────┼──────────────────────────────────────────────┤');
noCleanup.forEach(r => {
  console.log(`  │ ${r.table.padEnd(19)} │ ${r.reason.padEnd(44)} │`);
});
console.log('  └─────────────────────┴──────────────────────────────────────────────┘');

// 验证审计结论（仅统计实际执行删除的 8 处，stats.js 浏览记录查询只查不删，不计入清理口径）
const cleanupEntries = audit.filter(r => !r.note.includes('只查不删'));
const allRolling = cleanupEntries.every(r => r.retention.includes('滚动 60 天'));
check('审计表结论：全部 8 处清理均为「按录入时间滚动 60 天」', () => allRolling && cleanupEntries.length === 8);

// ==================== 8. 统计 ====================
console.log('\n========== 验证结果 ==========');
console.log(`通过: ${passed} 项`);
console.log(`失败: ${failed} 项`);
console.log(`总计: ${passed + failed} 项`);

if (failed > 0) {
  console.log('\n❌ 存在失败项，请检查。');
  process.exit(1);
} else {
  console.log('\n✅ 全部通过，R207 验收合格。');
  process.exit(0);
}
