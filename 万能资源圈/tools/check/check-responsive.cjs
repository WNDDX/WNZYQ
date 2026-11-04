/* v536 响应式体检：三个宽度 × 五个页面，查横向溢出与超宽元素 */
const { withBrowser, sleep } = require('./browser.cjs');
const { CDP } = require('./cdp-lib.cjs');
const { ensureLogin } = require('./auth.cjs');
const BASE = 'https://wnzyq.pages.dev';
const PORT = 9418;

const OVER = `(() => {
  const vw = window.innerWidth;
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1.5 && getComputedStyle(el).position !== 'fixed') {
      const s = (el.className || el.tagName).toString().slice(0, 40);
      bad.push(s + '@' + Math.round(r.right));
    }
  });
  return { scroll: document.documentElement.scrollWidth, vw, over: bad.slice(0, 6) };
})()`;

(async () => {
  await withBrowser(async (port) => {
    const c = await CDP.attach(port);
    await c.init();
    await c.nav(BASE + '/admin', 3000);
    await ensureLogin(c, BASE);
    await sleep(1500);
    for (const w of [390, 768, 1024]) {
      await c.viewport(w, 844, w < 700);
      await sleep(600);
      for (const tab of ['products', 'categories', 'stats', 'settings']) {
        await c.eval(`(()=>{const t=document.querySelector('.tab[data-tab="${tab}"]');if(t)t.click();return 1})()`);
        await sleep(1400);
        const r = await c.eval(OVER);
        const flag = r.scroll > r.vw + 1 ? '溢出!' : 'ok';
        console.log(`${w}px ${tab.padEnd(11)} ${flag}  ${r.over.length ? r.over.join(' ') : ''}`);
      }
    }
    await c.viewport(390, 844, true); await sleep(500);
    await c.nav(BASE + '/shop', 2500); await sleep(1200);
    const s = await c.eval(OVER);
    console.log('390px shop       ' + (s.scroll > s.vw + 1 ? '溢出!' : 'ok') + '  ' + s.over.join(' '));
    process.exit(0);
  }, PORT);
})().catch(e => { console.error('出错：', e.message); process.exit(1); });
