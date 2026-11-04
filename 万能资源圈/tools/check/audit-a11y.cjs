/* v537 三种人视角巡检：可用性 / 无障碍 / 一致性 的量化数据 */
const { withBrowser, sleep } = require('./browser.cjs');
const { CDP } = require('./cdp-lib.cjs');
const { ensureLogin } = require('./auth.cjs');
const BASE = 'https://wnzyq.pages.dev';
const PORT = 9434;

const PROBE = `(() => {
  const out = {};
  /* 1 重复 id */
  const ids = {}, dup = [];
  document.querySelectorAll('[id]').forEach(e => { if (ids[e.id]) dup.push(e.id); ids[e.id] = 1; });
  out.dupIds = dup.slice(0, 5);
  /* 2 无名字的图标按钮（无文字、无 aria-label、无 title） */
  out.nameless = Array.from(document.querySelectorAll('button')).filter(b => {
    const t = (b.textContent || '').trim();
    return !t && !b.getAttribute('aria-label') && !b.getAttribute('title');
  }).map(b => (b.className || b.id || 'button').toString().slice(0, 28)).slice(0, 8);
  /* 3 手机上过小的点击区（<36px） */
  out.smallTargets = Array.from(document.querySelectorAll('button, a, input[type=checkbox], [role=button]')).filter(e => {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    if (getComputedStyle(e).visibility === 'hidden') return false;
    return (r.width < 36 || r.height < 36);
  }).map(e => ((e.className || e.tagName) + '').slice(0, 22) + '@' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 8);
  /* 4 输入框没有 label 关联 */
  out.unlabeledInputs = Array.from(document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea')).filter(i => {
    if (i.getAttribute('aria-label') || i.getAttribute('placeholder') || i.getAttribute('title')) return false;
    const id = i.id;
    return !(id && document.querySelector('label[for="' + id + '"]')) && !i.closest('label');
  }).map(i => (i.id || i.className || i.type)).slice(0, 6);
  /* 5 文案里的英文全角混排/双标点 */
  out.textIssues = (document.body.innerText.match(/[，。；：][，。；：]|,,|\\.\\.(?!\\.)/g) || []).slice(0, 5);
  return out;
})()`;

(async () => {
  await withBrowser(async (port) => {
    const c = await CDP.attach(port);
    await c.init();
    await c.nav(BASE + '/admin', 3000);
    await ensureLogin(c, BASE);
    await sleep(1800);
    const pages = [['products', '资源管理'], ['categories', '分类管理'], ['stats', '数据统计'], ['settings', '平台设置']];
    for (const [tab, name] of pages) {
      await c.eval(`(()=>{const t=document.querySelector('.tab[data-tab="${tab}"]');if(t)t.click();return 1})()`);
      await sleep(1800);
      const r = await c.eval(PROBE);
      console.log('【' + name + '】', JSON.stringify(r));
    }
    await c.nav(BASE + '/shop', 2500); await sleep(1500);
    console.log('【前台】', JSON.stringify(await c.eval(PROBE)));
    await c.nav(BASE + '/', 2500); await sleep(1500);
    console.log('【导航页】', JSON.stringify(await c.eval(PROBE)));
    console.log('控制台错误:', (c.errors || []).filter(e => !/ServiceWorker|Failed to load resource/.test(e)).slice(0, 5).join(' | ') || '无');
    process.exit(0);
  }, PORT);
})().catch(e => { console.error('出错：', e.message); process.exit(1); });
