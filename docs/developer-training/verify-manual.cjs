const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.join(__dirname, '.qa');
fs.mkdirSync(out, { recursive: true });
let socket;
let seq = 0;
const pending = new Map();
const events = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Timed out: ' + method)); }, 30000);
    pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function screenshot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(out, name), Buffer.from(r.data, 'base64'));
}
async function main() {
  const targets = await (await fetch('http://127.0.0.1:9337/json')).json();
  const target = targets.find(t => t.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const p = pending.get(m.id);
      if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
    } else events.push(m);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:8789/manual' });
  for (let n = 0; n < 40; n++) {
    if (await evaluate('document.readyState === "complete" && !!document.querySelector("#results") && typeof filter === "function"')) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  await evaluate(`document.documentElement.style.scrollBehavior='auto';`);
  const structure = await evaluate(`(() => {
    const ids = Array.from(document.querySelectorAll('[id]')).map(e=>e.id);
    const broken = Array.from(document.querySelectorAll('a[href^="#"]')).filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash);
    return {files:document.querySelectorAll('article.file').length, duplicateIds:ids.filter((id,i)=>ids.indexOf(id)!==i), brokenLinks:broken,
      bodyWidth:document.documentElement.scrollWidth, viewport:innerWidth, sourceListings:document.querySelectorAll('details.source').length,
      functionWalkthroughs:document.querySelectorAll('details.symbol').length,
      chapterCount:Array.from(document.querySelectorAll('h2[id]')).filter(e=>e.id.startsWith('chapter-')).length};
  })()`);
  assert.equal(structure.files, JSON.parse(fs.readFileSync(path.join(__dirname, 'coverage-manifest.json'), 'utf8')).stats.totalFiles);
  assert.equal(structure.chapterCount, 20);
  assert.deepEqual(structure.duplicateIds, []);
  assert.deepEqual(structure.brokenLinks, []);
  assert.ok(structure.bodyWidth <= structure.viewport + 2);
  await screenshot('01-desktop-introduction.png');
  const pupilRules = await evaluate(`(() => {const f=entries.find(e=>e.querySelector('h3').textContent.endsWith('/PupilController.java'));return Array.from(f.querySelectorAll('details.symbol')).map(d=>({name:d.querySelector('summary').textContent,text:d.textContent}));})()`);
  assert.ok(pupilRules.find(x=>/^create\s/.test(x.name)).text.includes("Effective rule @perm.has('pupils:create')"));
  assert.ok(pupilRules.find(x=>/^delete\s/.test(x.name)).text.includes('DELETE /api/pupils/{id}'));
  await evaluate(`document.querySelector('#chapter-13-worked-example-assessments-and-report-cards').scrollIntoView();`);
  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('02-worked-example.png');
  const filtered = await evaluate(`(() => {document.querySelector('#side').value='backend';document.querySelector('#category').value='Controllers';document.querySelector('#search').value='PupilController';filter();document.querySelector('#file-reference').scrollIntoView();return {shown:entries.filter(e=>!e.hidden).length,text:results.textContent};})()`);
  assert.equal(filtered.shown, 1);
  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('03-file-search.png');
  await evaluate(`(() => {const e=entries.find(e=>!e.hidden);e.scrollIntoView();return e.id;})()`);
  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('04-controller-reference.png');
  const sourceCheck = await evaluate(`(() => {const e=entries.find(e=>!e.hidden);const d=e.querySelector('details.source');d.open=true;d.scrollIntoView();return {lines:d.querySelectorAll('.source-line').length,first:d.querySelector('.source-line').textContent};})()`);
  assert.ok(sourceCheck.lines > 50);
  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('05-numbered-source.png');
  await evaluate(`document.querySelector('#clear').click();document.querySelector('#category').value='DTOs';filter();`);
  const dtoCount = await evaluate(`entries.filter(e=>!e.hidden).length`);
  assert.equal(dtoCount, 10);
  await evaluate(`document.querySelector('#search').value='no-matching-file-xyz';filter();`);
  assert.equal(await evaluate(`entries.filter(e=>!e.hidden).length`), 0);
  await evaluate(`document.querySelector('#clear').click();window.scrollTo({top:0,behavior:'instant'});`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise(resolve => setTimeout(resolve, 300));
  const mobile = await evaluate(`({width:document.documentElement.scrollWidth,viewport:innerWidth})`);
  assert.ok(mobile.width <= mobile.viewport + 2);
  await screenshot('06-mobile-introduction.png');
  await evaluate(`document.querySelector('#file-reference').scrollIntoView();`);
  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('07-mobile-search.png');
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  const print = await evaluate(`({navHidden:getComputedStyle(document.querySelector('nav')).display==='none', sourceHidden:getComputedStyle(document.querySelector('.source')).display==='none', toolsHidden:getComputedStyle(document.querySelector('.tools')).display==='none'})`);
  assert.ok(print.navHidden && print.sourceHidden && print.toolsHidden);
  await send('Emulation.setEmulatedMedia', { media: '' });
  const errors = events.filter(e=>e.method==='Runtime.exceptionThrown');
  assert.equal(errors.length, 0);
  const html = fs.readFileSync(path.join(__dirname, 'Bright-Minds-Developer-Manual.html'), 'utf8');
  // Compare local secret-shaped environment values without reporting their contents.
  let checkedSecrets = 0;
  for (const root of [path.resolve(__dirname, '../..'), path.resolve(__dirname, '../../../bright-minds-backend')]) {
    const env = path.join(root, '.env');
    if (!fs.existsSync(env)) continue;
    for (const line of fs.readFileSync(env, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m || !/SECRET|PASSWORD|TOKEN|PRIVATE|SERVICE_ROLE/i.test(m[1])) continue;
      const value = m[2].trim().replace(/^['"]|['"]$/g, '');
      if (value.length < 6) continue;
      checkedSecrets++;
      assert.ok(!html.includes(value), 'A local secret value appeared in HTML; variable name: ' + m[1]);
    }
  }
  const report = { checkedAt: new Date().toISOString(), structure, filtered, sourceCheck, dtoCount, mobile, print, backendPermissionAndPathChecks: true, browserErrors: errors.length, secretValuesChecked: checkedSecrets, screenshots: fs.readdirSync(out).filter(n=>n.endsWith('.png')) };
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  socket.close();
}
main().catch(error => { console.error(error); socket?.close(); process.exitCode = 1; });
