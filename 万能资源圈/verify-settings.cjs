/* v535 上线后验收：设置页行布局 / 手机 / 公告弹窗高度 / 体检耗时 / 导入弹窗 */
const { withBrowser, sleep } = require('./browser.cjs');
const { CDP } = require('./cdp-lib.cjs');
const { ensureLogin } = require('./auth.cjs');
const BASE = 'https://wnzyq.pages.dev';
const PORT = 9412;

(async () => {
  await withBrowser(async (port) => {
    const c = await CDP.attach(port);
    await c.init();
    await c.nav(BASE + '/admin', 2500);
    await c.eval(`(async()=>{const rs=await navigator.serviceWorker.getRegistrations();for(const r of rs)await r.unregister();if(window.caches){const ks=await caches.keys();for(const k of ks)await caches.delete(k);}return 1})()`).catch(() => {});
    await c.nav(BASE + '/admin', 3000);
    await ensureLogin(c, BASE);
    await sleep(1500);
    await c.eval(`(()=>{document.querySelector('.tab[data-tab="settings"]').click();return 1})()`);
    await sleep(1200);

    console.log('行布局：', await c.eval(`(()=>{const rs=Array.from(document.querySelectorAll('#panel-settings .setting-row'));
      const inline=rs.filter(r=>r.classList.contains('is-inline')).length;
      const h=rs.map(r=>Math.round(r.getBoundingClientRect().height));
      return '总行 '+rs.length+'，一行式 '+inline+'，各高 '+h.join(',');})()`));
    console.log('主键高度：', await c.eval(`Array.from(document.querySelectorAll('#panel-settings .btn-inline-pd')).map(b=>b.textContent.trim()+':'+Math.round(b.getBoundingClientRect().height)).join(' | ')`));
    console.log('小键高度：', await c.eval(`Array.from(document.querySelectorAll('#panel-settings .row-btn')).slice(0,4).map(b=>b.textContent.trim()+':'+Math.round(b.getBoundingClientRect().height)).join(' | ')`));
    await c.shot('v535-live-settings');

    await c.viewport(390, 844, true); await sleep(700);
    console.log('390 横向溢出：', await c.eval(`document.documentElement.scrollWidth > window.innerWidth + 1`));
    await c.shot('v535-live-settings-390');
    await c.viewport(1440, 900, false); await sleep(400);

    /* 体检耗时 */
    const t0 = Date.now();
    await c.click('#imgCheckBtn');
    let ok = false;
    for (let i = 0; i < 60; i++) { ok = await c.eval(`!!document.querySelector('#sysCheckMask .chk-sum')`); if (ok) break; await sleep(400); }
    console.log('体检出结果：', ok, '｜耗时', Math.round((Date.now() - t0) / 1000) + 's');
    console.log('CSP 报错数：', (c.errors || []).filter(e => /unsafe-eval/.test(e)).length);
    await c.shot('v535-live-check');
    await c.eval(`(()=>{const m=document.getElementById('sysCheckMask');const x=m&&m.querySelector('[data-x]');if(x)x.click();return 1})()`);
    await sleep(500);

    /* 导入弹窗 */
    await c.click('#batchImportBtn'); await sleep(900);
    console.log('导入弹窗有底部关闭键：', await c.eval(`!!document.querySelector('#importMask .modal-footer .modal-close')`));
    await c.shot('v535-live-import');
    await c.eval(`(()=>{const m=document.getElementById('importMask');m.classList.remove('open');return 1})()`);
    await sleep(400);

    /* 前台公告弹窗高度 */
    await c.nav(BASE + '/shop', 3000);
    await sleep(1500);
    console.log('公告弹窗高度：', await c.eval(`(()=>{const b=document.querySelector('#annModal .ann-box');if(!b)return 'no';const r=b.getBoundingClientRect();return Math.round(r.height)+'px（视口高 '+window.innerHeight+'）';})()`));
    await c.shot('v535-live-ann');

    console.log('收尾遮罩数：', await c.eval(`document.querySelectorAll('.modal-mask.open').length`));
    process.exit(0);
  }, PORT);
})().catch(e => { console.error('出错：', e.message); process.exit(1); });
