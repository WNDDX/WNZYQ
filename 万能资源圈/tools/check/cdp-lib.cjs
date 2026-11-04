/* 真人模拟测试：通过 Edge DevTools Protocol 驱动真实浏览器
 * 真实导航、真实鼠标点击、真实截图、真实收集控制台错误
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = []; this.logs = []; this.httpErrors = []; this.failedReq = []; }
  static async attach(port = 9333) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    /* 优先取真正的网页 target（http/https），避免拿到 background_page 之类不支持 Emulation 的目标 */
    const pages = list.filter(t => t.type === 'page');
    const page = pages.find(t => /^https?:/.test(t.url || '')) || pages[0] || list.find(t => t.type === 'page');
    if (!page) throw new Error('找不到 page target');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (ev) => c._onMessage(JSON.parse(ev.data));
    return c;
  }
  _onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      this.errors.push('[异常] ' + (d.exception?.description || d.text || '').split('\n')[0]);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      this.errors.push('[console.error] ' + msg.params.args.map(a => a.value ?? a.description ?? a.type).join(' ').slice(0, 200));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      const en = msg.params.entry;
      const loc = (en.url ? en.url : '(no-url)') + (en.lineNumber != null ? ':' + en.lineNumber : '');
      this.errors.push('[日志] ' + en.text.slice(0, 180) + '  @' + loc);
      /* CSP 违规单独归档，带来源定位 */
      if (/Content Security Policy|unsafe-eval|connect-src/.test(en.text)) {
        (this.cspLogs = this.cspLogs || []).push({ text: en.text.slice(0, 200), url: en.url || '', line: en.lineNumber, col: en.columnNumber, source: en.source });
      }
    }
    if (msg.method === 'Network.responseReceived') {
      const r = msg.params.response;
      if (r.status >= 400) this.httpErrors.push(r.status + '  ' + r.url.slice(0, 160));
    }
    if (msg.method === 'Network.loadingFailed') {
      this.failedReq.push((msg.params.errorText || '') + '  ' + (msg.params.requestId || ''));
    }
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('超时: ' + method)); } }, (method === 'Runtime.evaluate' ? 90000 : 25000));
    });
  }
  async init() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    await this.send('Network.enable');
  }
  async nav(url, wait = 2500) {
    await this.send('Page.navigate', { url });
    await sleep(wait);
    await this.waitReady();
  }
  async waitReady(timeout = 15000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const st = await this.eval('document.readyState');
      if (st === 'complete') return true;
      await sleep(300);
    }
    return false;
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval 异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async shot(name) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    const p = path.join(OUT, name + '.png');
    fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
    return p;
  }
  /* 真实鼠标点击：先取元素中心点，再派发 mousePressed/mouseReleased */
  async click(sel, label) {
    await this.eval(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(el)el.scrollIntoView({block:'center',inline:'center'});return 1})()`);
    await sleep(140);
    const rect = await this.eval(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return null;const r=el.getBoundingClientRect();if(r.width===0&&r.height===0)return null;return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
    if (!rect) throw new Error('未找到可点击元素: ' + sel + (label ? ' (' + label + ')' : ''));
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await sleep(60);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await sleep(500);
    return rect;
  }
  /* 真实键盘输入：先滚动到视口并聚焦，再 Ctrl+A 清空 + 逐字符按键（不依赖元素可点击） */
  async type(sel, text) {
    const ok = await this.eval(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return 0;el.scrollIntoView({block:'center'});el.focus();return 1})()`);
    if (!ok) throw new Error('输入框不存在: ' + sel);
    await sleep(180);
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
    await sleep(80);
    for (const ch of text) {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch });
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
      await sleep(22);
    }
    await sleep(60);
  }
  /* 等效输入法上屏：CDP 的 Input.insertText 会像输入法一样把整段文字插入焦点位置，
     中文/emoji 都能进（逐字符 keyDown 对非 ASCII 不生效，之前公告编辑器测不过就是这个原因）。 */
  async insertText(sel, text) {
    const ok = await this.eval(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return 0;el.scrollIntoView({block:'center'});el.focus();const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const g=getSelection();g.removeAllRanges();g.addRange(r);return 1})()`);
    if (!ok) throw new Error('元素不存在: ' + sel);
    await sleep(160);
    await this.send('Input.insertText', { text });
    await sleep(120);
  }
  /* 兜底：脚本赋值 + 手动派发 input/change（仅当键盘输入无效时使用） */
  async setValue(sel, text) {
    await this.eval(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return 0;el.focus();el.value=${JSON.stringify(text)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return 1})()`);
  }
  async viewport(w, h, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  }
}

module.exports = { CDP, sleep, OUT };
