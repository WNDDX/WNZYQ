/* v538 深色模式逐页检查：强制 prefers-color-scheme: dark，四个页签 + 前台各截一张 */
const { withBrowser, sleep } = require('./browser.cjs');
const { CDP } = require('./cdp-lib.cjs');
const { ensureLogin } = require('./auth.cjs');
const BASE = 'https://wnzyq.pages.dev';
const PORT = 9440;
(async () => {
  await withBrowser(async (port) => {
    const c = await CDP.attach(port);
    await c.init();
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await c.nav(BASE + '/admin', 3000);
    await ensureLogin(c, BASE);
    await sleep(1800);
    console.log('主题:', await c.eval(`document.documentElement.getAttribute('data-theme')`));
    for (const t of ['products', 'categories', 'stats', 'settings']) {
      await c.eval(`(()=>{const b=document.querySelector('.tab[data-tab="${t}"]');if(b)b.click();return 1})()`);
      await sleep(1600);
      await c.shot('dark-' + t);
    }
    /* 白底残留扫描：深色下不该有大块纯白 */
    const white = await c.eval(`(()=>{const bad=[];document.querySelectorAll('body *').forEach(e=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();
      if(r.width<60||r.height<32) return; if(s.backgroundColor==='rgb(255, 255, 255)'&&s.opacity!=='0') bad.push((e.className||e.tagName).toString().slice(0,24));});
      return Array.from(new Set(bad)).slice(0,8);})()`);
    console.log('深色下的白块:', JSON.stringify(white));
    await c.nav(BASE + '/shop', 2500); await sleep(1500);
    await c.shot('dark-shop');
    process.exit(0);
  }, PORT);
})().catch(e => { console.error('出错：', e.message); process.exit(1); });
