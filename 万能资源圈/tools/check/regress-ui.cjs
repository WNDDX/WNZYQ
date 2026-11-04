/* v534 四项界面实测：体检白卡 / 公告预览 / 链接测一下 / 导入历史 */
const { withBrowser, sleep } = require('./browser.cjs');
const { CDP } = require('./cdp-lib.cjs');
const { ensureLogin } = require('./auth.cjs');

const BASE = 'https://wnzyq.pages.dev';
const PORT = 9406;

(async () => {
  await withBrowser(async (port) => {
    const c = await CDP.attach(port);
    await c.init();
    await c.nav(BASE + '/admin', 2500);
    await c.eval(`(async()=>{const rs=await navigator.serviceWorker.getRegistrations();for(const r of rs)await r.unregister();if(window.caches){const ks=await caches.keys();for(const k of ks)await caches.delete(k);}return 1})()`).catch(() => {});
    await c.nav(BASE + '/admin', 3000);
    await ensureLogin(c, BASE);
    await sleep(1200);
    await c.eval(`(()=>{document.querySelector('.tab[data-tab="settings"]').click();return 1})()`);
    await sleep(1500);

    /* ---------- 1. 系统体检：白卡 ---------- */
    const tChk = Date.now();
    await c.click('#imgCheckBtn');
    let has = false;
    for (let i = 0; i < 40; i++) {
      has = await c.eval(`(()=>{const m=document.getElementById('sysCheckMask');return !!(m&&m.querySelector('.chk-sum'))})()`);
      if (has) break;
      await sleep(700);
    }
    console.log('体检结果已渲染：', has, '｜耗时', Math.round((Date.now() - tChk) / 1000) + 's');
    console.log('体检摘要：', await c.eval(`(()=>{const s=document.querySelector('#sysCheckMask .chk-sum');return s?s.innerText.replace(/\\n/g,' '):''})()`));
    console.log('分组数：', await c.eval(`document.querySelectorAll('#sysCheckMask .chk-sec').length`));
    console.log('深色残留（#0f2233 背景元素）：', await c.eval(`(()=>{let n=0;document.querySelectorAll('#sysCheckMask *').forEach(function(e){const b=getComputedStyle(e).backgroundColor;if(b==='rgb(15, 34, 51)')n++;});return n})()`));
    console.log('有问题的行有没有「去处理」：', await c.eval(`document.querySelectorAll('#sysCheckMask [data-goto-pid]').length`));
    await c.shot('v534-check-white');
    await c.eval(`(()=>{const m=document.getElementById('sysCheckMask');const x=m&&m.querySelector('[data-x]');if(x)x.click();return 1})()`);
    await sleep(500);

    /* ---------- 2. 公告预览 ---------- */
    await c.click('#openAnnBtn');
    await sleep(2200);
    const pvBtns = await c.eval(`document.querySelectorAll('#annList .ann-item .row-btn').length`);
    console.log('公告行按钮数：', pvBtns, '｜预览键数：', await c.eval(`Array.from(document.querySelectorAll('#annList .ann-item .row-btn')).filter(b=>b.textContent.trim()==='预览').length`));
    const clicked = await c.eval(`(()=>{const b=Array.from(document.querySelectorAll('#annList .ann-item .row-btn')).find(x=>x.textContent.trim()==='预览');if(!b)return 0;b.click();return 1})()`);
    console.log('点了预览：', clicked);
    await sleep(3500);
    const pv = await c.eval(`(()=>{const f=document.getElementById('annPvFrame');if(!f)return {frame:false};
      let inner={};
      try{const d=f.contentDocument;const m=d.getElementById('annModal');const b=d.getElementById('annBody');
        inner={open:!!(m&&m.classList.contains('open')),title:m?getComputedStyle(m).display:'',bodyLen:b?b.innerText.replace(/\s+/g,'').length:-1,tabs:d.querySelectorAll('#annTabs .ann-tab').length};}catch(e){inner={err:e.message}}
      return {frame:true,src:f.getAttribute('src'),inner:inner};})()`);
    console.log('公告预览 iframe：', JSON.stringify(pv));
    await c.shot('v534-ann-preview');
    await c.eval(`(()=>{const m=document.getElementById('annPvMask');const x=m&&m.querySelector('[data-x]');if(x)x.click();return 1})()`);
    await sleep(500);
    await c.eval(`(()=>{const m=document.getElementById('annMask');const x=m&&m.querySelector('.modal-close-x');if(x)x.click();return 1})()`);
    await sleep(600);

    /* ---------- 3. 设置信息「测一下」 ---------- */
    await c.click('#openInfoBtn');
    await sleep(900);
    await c.eval(`(()=>{const b=document.getElementById('infoFoldContact');if(b&&b.getAttribute('aria-expanded')!=='true')b.click();return 1})()`);
    await sleep(400);
    console.log('测一下键数：', await c.eval(`document.querySelectorAll('#infoMask [data-test]').length`));
    await c.eval(`(()=>{const i=document.getElementById('infoUrlContact');if(i){i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));}return 1})()`);
    await c.click('[data-test="infoUrlContact"]');
    await sleep(700);
    console.log('空链接点测一下的提示：', await c.eval(`(()=>{const t=document.querySelector('.toast,.wn-toast,[class*="toast"]');return t?t.innerText.slice(0,40):'(无)'})()`));
    await c.shot('v534-info-test');
    await c.eval(`(()=>{const m=document.getElementById('infoMask');m.classList.remove('open');return 1})()`);
    await sleep(400);

    /* ---------- 4. 导入历史 ---------- */
    await c.click('#batchImportBtn');
    await sleep(1000);
    console.log('导入历史区：', await c.eval(`(()=>{const h=document.getElementById('impHist');return h?h.innerText.replace(/\\n/g,' | ').slice(0,120):'(无)'})()`));
    await c.shot('v534-import-hist');
    await c.eval(`(()=>{const m=document.getElementById('importMask');const x=m&&m.querySelector('[data-x]');if(x)x.click();return 1})()`);
    await sleep(400);
    console.log('收尾遮罩数：', await c.eval(`document.querySelectorAll('.modal-mask.open').length`));
    console.log('控制台错误：', JSON.stringify((c.errors || []).filter(e => !/Failed to load resource/.test(e)).slice(0, 6)));
    process.exit(0);
  }, PORT);
})().catch(e => { console.error('测试脚本出错：', e.message); process.exit(1); });
