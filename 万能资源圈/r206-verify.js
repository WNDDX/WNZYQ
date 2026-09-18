/**
 * R206 验证脚本（用户 09-18 13:51）
 * 22 套核心回归检查
 * 注：r163 起 9 FAIL 为既定噪音（需运行环境/浏览器/D1 绑定等），本脚本仅做静态检查
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const checks = [];
let pass = 0, fail = 0;

function check(name, fn) {
  try {
    const ok = fn();
    checks.push({ name, ok, detail: ok ? 'PASS' : 'FAIL' });
    ok ? pass++ : fail++;
  } catch (e) {
    checks.push({ name, ok: false, detail: 'ERROR: ' + e.message });
    fail++;
  }
}

function read(f) {
  return fs.readFileSync(path.join(ROOT, f), 'utf-8');
}

function exists(f) {
  return fs.existsSync(path.join(ROOT, f));
}

function grepFiles(pattern) {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(js|html|css|toml|json|md)$/.test(entry) && !entry.includes('r206-verify')) {
        const content = fs.readFileSync(full, 'utf-8');
        if (pattern.test(content)) {
          results.push(full.replace(ROOT + '/', ''));
        }
      }
    }
  }
  walk(ROOT);
  return results;
}

// ===== 22 套检查 =====

// 1. CACHE_NAME 已升至 v206
check('CACHE_NAME = wnzyq-v206', () => {
  const content = read('sw.js');
  return content.includes("const CACHE_NAME = 'wnzyq-v206'");
});

// 2. 无 "3:17" 残留
check('无 "3:17" 残留（含注释）', () => {
  const files = grepFiles(/3:17/);
  // 允许 sw.js 的 R206 注释中提及（属于说明性引用，非配置残留）
  const realHits = files.filter(f => !f.endsWith('sw.js'));
  return realHits.length === 0;
});

// 3. 无 "凌晨3" 残留
check('无 "凌晨3" 残留（含注释）', () => {
  const files = grepFiles(/凌晨3/);
  return files.length === 0;
});

// 4. 无 "17 3 * * *" cron 表达式残留
check('无 "17 3 * * *" cron 残留', () => {
  const files = grepFiles(/17\s+3\s+\*\s+\*\s+\*/);
  return files.length === 0;
});

// 5. cleanup.js 含 R206 注释
check('cleanup.js 含 R206 定时入口注释', () => {
  const content = read('functions/api/cleanup.js');
  return content.includes('R206（用户 09-18 13:51 拍板）');
});

// 6. cleanup.js 注明 cron 表达式 0 16 * * *
check('cleanup.js 注明 UTC cron 表达式 0 16 * * *', () => {
  const content = read('functions/api/cleanup.js');
  return content.includes('0 16 * * *');
});

// 7. cleanup.js 注明北京时间 24:00
check('cleanup.js 注明北京时间 24:00', () => {
  const content = read('functions/api/cleanup.js');
  return content.includes('北京时间 24:00') || content.includes('北京时间每天 24:00');
});

// 8. cleanup.js 注明控制台配置路径
check('cleanup.js 注明 Cloudflare 控制台配置路径', () => {
  const content = read('functions/api/cleanup.js');
  return content.includes('Cloudflare 控制台') && content.includes('Triggers');
});

// 9. stats.js 含北京时区口径注释
check('stats.js 含「一天为北京时间 0:00-24:00」注释', () => {
  const content = read('functions/api/admin/stats.js');
  return content.includes('一天为北京时间 0:00-24:00');
});

// 10. stats.js 使用 date(x, "+8 hours") 切日
check('stats.js 使用 date(x, "+8 hours") 北京切日', () => {
  const content = read('functions/api/admin/stats.js');
  const matches = content.match(/date\([^)]+,\s*['"]\+8 hours['"]\)/g);
  return matches && matches.length >= 4;
});

// 11. track.js 含北京时区注释
check('track.js 含北京时区口径注释', () => {
  const content = read('functions/api/track.js');
  return content.includes('时区统一北京时间');
});

// 12. products.js 使用 datetime("now", "+8 hours") 处理定时上下架
check('products.js 用 +8 hours 处理定时上下架', () => {
  const content = read('functions/api/products.js');
  return content.includes("datetime('now', '+8 hours')");
});

// 13. 无 wrangler.toml（R204 已删，禁止回加）
check('无 wrangler.toml（禁止回加）', () => {
  return !exists('wrangler.toml');
});

// 14. onRequestScheduled 处理函数存在
check('cleanup.js onRequestScheduled 函数存在', () => {
  const content = read('functions/api/cleanup.js');
  return content.includes('export async function onRequestScheduled');
});

// 15. onRequestGet 清理接口存在
check('cleanup.js onRequestGet 清理接口存在', () => {
  const content = read('functions/api/cleanup.js');
  return content.includes('export async function onRequestGet');
});

// 16. 核心 HTML 文件齐全
check('核心 HTML 文件齐全（index/shop/admin/error）', () => {
  return exists('index.html') && exists('shop.html') && exists('admin.html') && exists('error.html');
});

// 17. 核心 JS 文件齐全
check('核心 JS 文件齐全（shop.js/admin.js/ui-common.js）', () => {
  return exists('assets/shop.js') && exists('assets/admin.js') && exists('assets/ui-common.js');
});

// 18. 核心函数文件齐全
check('functions 核心接口齐全', () => {
  return exists('functions/api/cleanup.js') && exists('functions/api/track.js')
    && exists('functions/api/admin/stats.js') && exists('functions/api/admin/login.js')
    && exists('functions/api/products.js');
});

// 19. 60 天保留策略一致（cleanup + track + login 三处）
check('60 天保留策略三处一致', () => {
  const c = read('functions/api/cleanup.js');
  const t = read('functions/api/track.js');
  const l = read('functions/api/admin/login.js');
  const pattern = /datetime\('now',\s*'-60 days'\)/g;
  return (c.match(pattern) || []).length >= 3
    && (t.match(pattern) || []).length >= 1
    && (l.match(pattern) || []).length >= 1;
});

// 20. 文件总数核对（R205 基准 46，R206 新增 r206-verify.js 验证脚本 = 47）
check('文件总数 = 47（R205 的 46 + r206-verify.js）', () => {
  let count = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else {
        count++;
      }
    }
  }
  walk(ROOT);
  return count === 47;
});

// 21. sw.js 含 R206 全系统时间口径确认注释
check('sw.js 含 R206 全系统时间口径确认注释', () => {
  const content = read('sw.js');
  return content.includes('全系统时间口径确认');
});

// 22. 顶层目录名正确（打包检查）
check('顶层目录名 = 万能资源圈', () => {
  return path.basename(ROOT) === '万能资源圈';
});

// ===== 输出报告 =====
console.log('========================================');
console.log('R206 验证报告（用户 09-18 13:51）');
console.log('========================================');
for (const c of checks) {
  const icon = c.ok ? '✓' : '✗';
  console.log(`${icon} ${c.name}`);
  if (!c.ok) console.log(`   → ${c.detail}`);
}
console.log('----------------------------------------');
console.log(`总计: ${checks.length} 项 | 通过: ${pass} | 失败: ${fail}`);
console.log('========================================');
process.exit(fail > 0 ? 1 : 0);
