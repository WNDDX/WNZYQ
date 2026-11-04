const { sleep } = require('./cdp-lib.cjs');
async function ensureLogin(c, base) {
  const need = await c.eval(`(()=>{const v=document.getElementById('loginView');return !!(v && getComputedStyle(v).display!=='none')})()`);
  if (!need) return false;
  await c.type('#loginUser', process.env.ADMIN_USER || '1747358421');
  await c.type('#loginPass', process.env.ADMIN_PASS || 'myb775825825148');
  await c.click('#loginBtn');
  await sleep(4000);
  return true;
}
module.exports = { ensureLogin };
