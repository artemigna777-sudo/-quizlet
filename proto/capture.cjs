// Запись прототипа кадр в кадр: node capture.cjs → frames/*.png (30 к/с, 5 с).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const dir = path.join(__dirname, 'frames');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => console.log('LOG', m.text()));
  const { createServer } = require('http');
  const srv = createServer((q, r) => {
    const f = path.join(__dirname, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
  }).listen(8765);
  await p.goto('http://localhost:8765/');
  await p.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  if (process.env.NOLBL) await p.addStyleTag({ content: '#lbl{display:none}' });
  const N = Number(process.env.FRAMES || 150);
  const only = process.env.AT ? process.env.AT.split(',').map(Number) : null;
  const times = only || Array.from({ length: N }, (_, i) => i / 30);
  for (let i = 0; i < times.length; i++) {
    await p.evaluate((t) => window.renderAt(t), times[i]);
    await p.screenshot({ path: path.join(dir, `${String(i).padStart(4, '0')}.png`) });
  }
  await b.close();
  srv.close();
  console.log('frames', times.length);
})();
