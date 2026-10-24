const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { spawn } = require('node:child_process');
const source = path.join(__dirname, 'Bright-Minds-Developer-Manual.html');
const outputDir = path.resolve(__dirname, '../../output/pdf');
const output = path.join(outputDir, 'Bright-Minds-Developer-Teaching-Manual.pdf');
const qa = path.join(__dirname, '.qa', 'pdf');
let server, socket, child;
let sequence = 0;
const pending = new Map();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function cdp(method, params = {}, timeout = 240000) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Timed out ' + method)); }, timeout);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(new Error(JSON.stringify(error))); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(qa, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bright-minds-pdf-'));
  server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(fs.readFileSync(source));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let debugPort;
  for (let i = 0; i < 100; i++) {
    const p = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(p)) { debugPort = Number(fs.readFileSync(p, 'utf8').split('\n')[0]); break; }
    await pause(100);
  }
  if (!debugPort) throw new Error('Headless browser did not start');
  const targets = await (await fetch('http://127.0.0.1:' + debugPort + '/json')).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const promise = pending.get(message.id);
    if (promise) { pending.delete(message.id); message.error ? promise.reject(message.error) : promise.resolve(message.result); }
  });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Page.navigate', { url: 'http://127.0.0.1:' + port });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('document.readyState === "complete" && !!document.querySelector("#file-reference")')) break;
    await pause(100);
  }
  const prepared = await evaluate(`(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelector('#clear').click();
    document.querySelectorAll('details.symbol').forEach(d => d.open = true);
    const first = document.querySelector('h2[id^="chapter-"]');
    const contents = document.createElement('section');
    contents.className = 'pdf-contents';
    contents.innerHTML = '<h2>Contents</h2><ol>' + Array.from(document.querySelectorAll('nav ol a')).map(a => '<li><a href="' + a.getAttribute('href') + '">' + a.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</a></li>').join('') + '</ol><p>The file reference contains every catalogued frontend and backend file, with fields, functions, API operations and implementation notes. Expandable source listings remain available in the companion HTML manual.</p>';
    first.before(contents);
    const cover = document.createElement('p');
    cover.className = 'pdf-cover-note';
    cover.textContent = '20 teaching chapters  |  414 file entries  |  React and TypeScript frontend  |  Spring Boot Java backend';
    contents.before(cover);
    // Keep the cover summary on the cover, ahead of the contents page.
    contents.before(cover);
    const style = document.createElement('style');
    style.textContent = '@media print { @page {size:A4; margin:18mm 16mm 20mm} body{font:10pt/1.5 Arial,sans-serif;color:#17212c} main,.paper{max-width:none} .pdf-contents{break-before:page;break-after:page}.pdf-contents h2{margin-top:0}.pdf-contents ol{list-style:none;padding:0}.pdf-contents li{margin:5pt 0;font-size:10pt}.pdf-cover-note{margin-top:44pt;font-size:11pt;line-height:1.8;max-width:145mm} h1{font-size:28pt;margin-top:30mm;max-width:165mm}h2{font-size:18pt;margin-top:22pt}h3{font-size:14pt}h4{font-size:11pt}table{font-size:8.5pt;table-layout:fixed;width:100%}th,td{padding:6pt;min-width:0;overflow-wrap:anywhere;word-break:normal}td code{font-size:8pt;line-height:1.4;overflow-wrap:anywhere}tr{break-inside:auto}thead{display:table-header-group}pre{font-size:8.5pt;overflow:visible;max-height:none}article.file{content-visibility:visible;contain-intrinsic-size:none;break-before:page;padding-top:10pt}details.symbol{display:block}details.symbol summary{font-size:10pt;list-style:none;break-after:avoid}details.symbol>table,details.symbol>.table-wrap{break-inside:auto}.source{display:none!important}.metadata{font-size:7.5pt}.catalog{display:none}.table-wrap{overflow:visible;margin:12pt 0}.flow span{font-size:9pt}a{color:#153c53;text-decoration:none} }';
    document.head.append(style);
    const compact = document.createElement('style');
    compact.textContent = '@media print { article.file{break-before:auto;margin-top:18pt;padding-top:12pt}article.file h3{break-after:avoid}.file ul{columns:2;column-gap:8mm;font-size:8.5pt;line-height:1.4}.file li{break-inside:avoid;margin-bottom:3pt}.file p{font-size:9pt;line-height:1.45}.symbol{margin:7pt 0;padding-bottom:7pt}.file h4{margin:15pt 0 8pt}.file h5{margin:12pt 0 6pt}td,th{padding:5pt}code{hyphens:none}.metadata{font-size:7.5pt!important} }';
    document.head.append(compact);
    document.querySelectorAll('table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.toLowerCase());
      let widths;
      if (headers.length === 3) {
        if (headers[0] === 'line') widths = headers[1].includes('query') ? [6,26,68] : [6,56,38];
        else if (headers[0].includes('step and')) widths = [10,52,38];
        else if (headers[0].includes('operation')) widths = [23,52,25];
        else if (headers[0].includes('field')) widths = [20,25,55];
        else if (headers[0].includes('declaration')) widths = [24,25,51];
        else if (headers[0].includes('token')) widths = [25,30,45];
        else if (headers[0].includes('starting line')) widths = [10,45,45];
        else widths = [25,30,45];
      } else if (headers.length === 2) widths = [30,70];
      if (widths) {
        const cols = document.createElement('colgroup');
        widths.forEach(width => { const col = document.createElement('col'); col.style.width=width+'%'; cols.append(col); });
        table.prepend(cols);
      }
    });
    return {files:document.querySelectorAll('article.file').length,walkthroughs:document.querySelectorAll('details.symbol[open]').length,contents:contents.querySelectorAll('a').length};
  })()`);
  console.log('Prepared PDF layout: ' + JSON.stringify(prepared));
  await cdp('Emulation.setEmulatedMedia', { media: 'print' });
  await evaluate('document.fonts.ready.then(() => true)');
  const result = await cdp('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font:8px Arial;color:#56616d;padding:0 16mm;display:flex;justify-content:space-between"><span>Bright Minds School Hub Developer Teaching Manual</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    generateTaggedPDF: true,
    generateDocumentOutline: true,
    transferMode: 'ReturnAsStream'
  });
  const fd = fs.openSync(output, 'w');
  try {
    while (true) {
      const chunk = await cdp('IO.read', { handle: result.stream, size: 1024 * 1024 });
      fs.writeSync(fd, chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : Buffer.from(chunk.data));
      if (chunk.eof) break;
    }
  } finally { fs.closeSync(fd); }
  await cdp('IO.close', { handle: result.stream });
  fs.writeFileSync(path.join(qa, 'export-metadata.json'), JSON.stringify({ prepared, bytes: fs.statSync(output).size, output }, null, 2));
  console.log('PDF saved: ' + output + ' (' + fs.statSync(output).size + ' bytes)');
  await cdp('Browser.close', {}, 3000).catch(() => {});
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { socket?.close(); child?.kill(); server?.close(); });
