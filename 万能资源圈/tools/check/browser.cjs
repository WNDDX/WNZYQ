/* 启动 Edge 无头 → 等调试端口 → 回调测试 → 收进程（生命周期由脚本自己管） */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withBrowser(fn, port = 9333) {
  /* v448：profile 路径必须纯 ASCII —— 含中文时 Edge 会忽略 --user-data-dir，
     回落到用户的真实浏览器配置（带扩展/带登录态），导致测试环境不干净
     （曾把扩展的 eval 报错误判为网站问题）。 */
  const base = 'C:\\wnzyq-edge-tmp';
  try { fs.mkdirSync(base, { recursive: true }); } catch (e) {}
  const profile = path.join(base, 'p' + port);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}

  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-dev-shm-usage', '--disable-extensions', '--mute-audio',
    '--remote-debugging-port=' + port, '--remote-allow-origins=*',
    '--user-data-dir=' + profile, '--window-size=1440,900',
    'about:blank'
  ];
  const proc = spawn(EDGE, args, { stdio: 'ignore', windowsHide: true });

  let ok = false;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) { const j = await r.json(); console.log('浏览器就绪：' + j.Browser); ok = true; break; }
    } catch (e) {}
    if (proc.exitCode !== null) break;
  }
  if (!ok) { try { proc.kill(); } catch (e) {} throw new Error('浏览器起不来（端口 ' + port + '）'); }

  try { return await fn(port); }
  finally { try { proc.kill('SIGKILL'); } catch (e) {} await sleep(500); }
}

module.exports = { withBrowser, sleep };
