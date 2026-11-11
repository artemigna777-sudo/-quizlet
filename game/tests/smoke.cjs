// Проверка в браузере: node tests/smoke.cjs (нужна сборка: npm run build). Снимки — tests/shots/.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', '4317', '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const shot = async (p, name) => p.screenshot({ path: path.join(__dirname, 'shots', name + '.png') });
  try {
    // Компьютер.
    const p = await b.newPage({ viewport: { width: 960, height: 540 } });
    p.on('pageerror', (e) => errors.push('ERR ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push('CON ' + m.text()); });
    await p.goto('http://localhost:4317/');
    await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await shot(p, '1-menu');
    await p.click('#start');
    await p.waitForTimeout(600);
    await shot(p, '2-start');
    await p.keyboard.down('KeyQ');
    await p.waitForTimeout(700);
    await shot(p, '3-hand');
    await p.keyboard.up('KeyQ');
    await p.keyboard.down('KeyW');
    await p.waitForTimeout(6000);
    await shot(p, '4-walk');
    await p.waitForTimeout(6000);
    await p.keyboard.up('KeyW');
    const s1 = await p.evaluate(() => ({ pos: window.__game.player.pos, dog: window.__game.dog.pos, state: window.__game.dog.state, mode: window.__game.mode }));
    console.log('после ходьбы', JSON.stringify(s1));
    // К находке: встать рядом и взять.
    await p.evaluate(() => { const g = window.__game; g.player.pos = { x: 14.6, z: -8.5 }; g.dog.place({ x: 14.6, z: -8.5 }); g.player.yaw = 0.6; });
    await p.waitForTimeout(900);
    await shot(p, '5-memory');
    await p.keyboard.press('KeyE');
    await p.waitForTimeout(500);
    await shot(p, '6-card');
    console.log('найдено', await p.evaluate(() => window.__game.found));
    await p.click('#cardOk');
    // Стирание: пёс ведёт к следующей находке, а игрок уходит в сторону.
    await p.evaluate(() => { const g = window.__game; g.dog.place({ x: 18, z: 30 }); g.player.pos = { x: -18, z: 30 }; });
    await p.waitForTimeout(3500);
    await shot(p, '7-erasing');
    console.log('давление', await p.evaluate(() => window.__game.pressure.toFixed(2)), 'пёс', await p.evaluate(() => window.__game.dog.state));
    await p.waitForFunction(() => window.__game.mode === 'erased', null, { timeout: 30000 });
    await shot(p, '7b-erased');
    await p.click('#again');
    await p.waitForTimeout(400);
    console.log('после возрождения', await p.evaluate(() => JSON.stringify({ mode: window.__game.mode, p: window.__game.pressure, pos: window.__game.player.pos })));
    // Телефон.
    const m = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    m.on('pageerror', (e) => errors.push('MERR ' + e.message));
    await m.goto('http://localhost:4317/');
    await m.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await shot(m, '8-phone-menu');
    await m.tap('#start');
    await m.waitForTimeout(1500);
    await shot(m, '9-phone-play');
  } finally {
    console.log(errors.length ? errors.join('\n') : 'ошибок нет');
    await b.close();
    srv.kill();
  }
})();
