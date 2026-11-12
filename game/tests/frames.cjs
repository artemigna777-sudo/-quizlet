// Покадровая запись для роликов: node tests/frames.cjs <папка> <сценарий> (нужна сборка).
// Время игры идёт шагами по 1/30 с, поэтому видео плавное даже на медленной машине.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2];
const W = +(process.env.W || 720), H = +(process.env.H || 1280);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', '4319', '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.addInitScript(() => {
    localStorage.setItem('erased-town:quality', 'high');
    let now = 0; const q = [];
    performance.now = () => now; Date.now = () => 1.7e12 + now;
    window.requestAnimationFrame = (f) => { q.push(f); return q.length; };
    window.__step = (ms) => { now += ms; const fs = q.splice(0); fs.forEach((f) => f(now)); };
  });
  await p.goto('http://localhost:4319/');
  for (let i = 0; i < 400 && !(await p.evaluate(() => !!window.__game)); i++) { await p.evaluate(() => window.__step(16)); await p.waitForTimeout(20); }
  let n = 0;
  const step = async (k = 1, shoot = true) => { for (let i = 0; i < k; i++) { await p.evaluate(() => window.__step(1000 / 30)); if (shoot) await p.screenshot({ path: path.join(OUT, `f${String(n++).padStart(5, '0')}.png`) }); } };
  const g = (fn, arg) => p.evaluate(fn, arg);
  await p.click('#start').catch(() => g(() => window.__game.start()));
  await step(5, false);
  const plan = require(path.resolve(process.argv[3]));
  await plan({ p, g, step });
  await b.close(); srv.kill();
  console.log('кадров', n);
})();
