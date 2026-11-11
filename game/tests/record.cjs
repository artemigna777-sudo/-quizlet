// Запись геймплея: node tests/record.cjs → tests/shots/gameplay.webm (нужна сборка).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', '4318', '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, recordVideo: { dir: path.join(__dirname, 'shots', 'video'), size: { width: 540, height: 960 } } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4318/');
  await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await p.waitForTimeout(1200);
  await p.click('#start');
  await p.waitForTimeout(1500);
  await p.keyboard.down('KeyQ'); await p.waitForTimeout(2200); await p.keyboard.up('KeyQ');
  await p.waitForTimeout(600);
  await p.keyboard.down('KeyW');
  for (let i = 0; i < 40; i++) { await p.evaluate((k) => { window.__game.player.yaw = Math.sin(k / 6) * 0.35; }, i); await p.waitForTimeout(200); }
  // Свернуть к находке.
  await p.evaluate(() => { const g = window.__game; g.player.pos = { x: 16.5, z: -4 }; g.player.yaw = 0.5; });
  await p.waitForTimeout(2600);
  await p.keyboard.up('KeyW');
  await p.evaluate(() => { const g = window.__game; g.player.pos = { x: 14.9, z: -8.6 }; g.player.yaw = 0.75; g.player.pitch = -0.25; });
  await p.waitForTimeout(1500);
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(3000);
  await ctx.close();
  await b.close();
  srv.kill();
  console.log('ok');
})();
