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
    await p.addInitScript(() => { localStorage.setItem('erased-town:quality', 'low'); window.__noCine = true; });
    p.on('pageerror', (e) => errors.push('ERR ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push('CON ' + m.text()); });
    await p.goto('http://localhost:4317/');
    await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
    await shot(p, '1-menu');
    await p.click('#start');
    await p.evaluate(() => window.__game.setTime(0.95));
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
    // Двор: дом Нины — записка, миска; дом бабы Зои — вернуть миску, комната проявляется.
    const at = async (x, z, yaw, pitch = -0.25) => { await p.evaluate(([x, z, yaw, pitch]) => { const g = window.__game; g.player.pos = { x, z }; g.dog.place({ x, z }); g.player.yaw = yaw; g.player.pitch = pitch; }, [x, z, yaw, pitch]); await p.waitForTimeout(700); };
    await at(8, 16.5, 0, 0); await shot(p, '10-house-outside');
    await at(8, 12.2, 0.5, -0.1); await shot(p, '11-nina-room');
    await at(5.4, 9.2, Math.PI, -0.9);
    console.log('рядом', await p.evaluate(() => window.__game.spot && window.__game.spot.id));
    await shot(p, '12-bowl');
    await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
    console.log('в руках', await p.evaluate(() => window.__game.st.hold));
    await at(11.4, 9.5, -1.57, -0.5);
    console.log('рядом', await p.evaluate(() => window.__game.spot && window.__game.spot.id));
    await p.keyboard.press('KeyE'); await p.waitForTimeout(400); await shot(p, '13-note');
    await p.click('#cardOk');
    await at(-5.9, 9.4, 0, -0.05); await shot(p, '14-zoya-gate');
    console.log('рядом', await p.evaluate(() => window.__game.spot && window.__game.spot.id));
    await at(-5.9, 8.6, 0, -0.05);
    await p.keyboard.press('KeyE'); await p.waitForTimeout(500); await shot(p, '15-reveal-card');
    await p.click('#cardOk');
    console.log('после проявления', await p.evaluate(() => JSON.stringify(window.__game.st)));
    await at(-5.9, 6.6, 0.9, -0.15); await shot(p, '16-zoya-bedroom');
    await at(-8, 12, 0.8, -0.2); await shot(p, '17-zoya-kitchen');
    // Остальные дома — проявляем сразу, чтобы посмотреть комнаты.
    await p.evaluate(() => ['gena', 'tema', 'nina'].forEach((h) => window.__game.homes.reveal(h)));
    await at(-8, -12.3, Math.PI + 0.6, -0.15); await shot(p, '18-gena-room');
    await at(-10.2, -7.0, Math.PI + 0.9, -0.2); await shot(p, '19-gena-boat');
    await at(0, 4.5, 0, -0.2); await shot(p, '23-yard');
    // Сценки, Тузик и дома снаружи.
    await p.evaluate(() => { window.__game.setQuality(true); window.__game.setTime(0.4); window.__game.playIntro(); });
    await p.waitForTimeout(2500); await shot(p, '70-intro-1');
    await p.waitForTimeout(4500); await shot(p, '72-intro-3');
    await p.evaluate(() => window.__game.cine.skip());
    await p.evaluate(() => { window.__game.setTime(0.95); window.__game.player.pos = { x: 18, z: 8 }; window.__game.playNight(); });
    await p.waitForTimeout(6000); await shot(p, '73-night-scene');
    await p.evaluate(() => { window.__game.cine.skip(); window.__game.enemies.clear(); window.__game.setTime(0.4); });
    await at(0, 19.5, 0.35, -0.05); await shot(p, '74-houses-front');
    await at(10.5, 16, 0.5, 0.25); await shot(p, '75-house-close');
    await p.evaluate(() => { const g = window.__game; g.player.pos = { x: 18, z: 14 }; g.dog.pos = { x: 17.2, z: 12.6 }; g.player.yaw = 0.52; g.player.pitch = -0.45; });
    await p.waitForTimeout(300); await shot(p, '76-tuzik');
    // Тётя Зоя: встреча с голосом.
    await at(-7.0, 12.6, 0.15, -0.05); await shot(p, '80-zoya');
    await p.evaluate(() => window.__game.talkZoya());
    await p.waitForTimeout(3500); await shot(p, '81-zoya-talk');
    await p.evaluate(() => window.__game.cine.skip());
    console.log('познакомились', await p.evaluate(() => window.__game.st.met));
    // Копии крупным планом.
    await p.evaluate(() => { const g = window.__game; g.setTime(0.99); g.enemies.clear(); g.player.pos = { x: 18, z: 10 }; g.dog.place({ x: 19, z: 12 }); g.player.yaw = 0; g.player.pitch = 0; g.enemies.spawn('echo', { x: 17.3, z: 6.5 }); g.enemies.spawn('echo', { x: 19.2, z: 4.5 }); g.enemies.spawn('screamer', { x: 18.2, z: 2.5 }); });
    await p.waitForTimeout(900); await shot(p, '82-echo-close');
    await p.evaluate(() => { window.__game.enemies.clear(); window.__game.setTime(0.4); window.__game.setVit({ hp: 100 }); });
    // Высокое качество: тени.
    await p.evaluate(() => { window.__game.setQuality(true); window.__game.setTime(0.42); });
    await at(8, 12.2, 0.5, -0.1); await p.waitForTimeout(1500); await shot(p, '50-hq-nina');
    await at(-8, 12, 0.8, -0.2); await shot(p, '52-hq-zoya-kitchen');
    await p.evaluate(() => ['gena', 'tema', 'nina'].forEach((h) => window.__game.homes.reveal(h)));
    await at(-10.2, -7.0, Math.PI - 0.9, -0.2); await shot(p, '55-hq-gena-workshop');
    await at(0, 18, 0, 0.05); await shot(p, '59-hq-yard');
    await at(18, 30, 0, 0); await shot(p, '60-hq-street');
    await p.evaluate(() => { window.__game.setTime(0.95); });
    await at(8, 12.2, 0.5, -0.1); await shot(p, '61-hq-night-room');
    await p.evaluate(() => window.__game.setQuality(false));
    // Город днём: районы.
    await p.evaluate(() => window.__game.setTime(0.5));
    await at(18, 30, 0, 0); await shot(p, '30-day-street');
    await at(0, 18, 0, 0.05); await shot(p, '36-day-yard-houses');
    await at(21, 0, -1.57, 0); await shot(p, '37-shop-outside');
    await at(26.5, 0, -1.57, -0.1); await shot(p, '38-shop-inside');
    await at(-53, -55, 1.2, -0.2); await shot(p, '39-post');
    await at(8, 12.2, 0.5, -0.1); await shot(p, '40-day-room');
    // Припасы и топор.
    await at(0.4, 4.0, 0, -0.5);
    console.log('рядом', await p.evaluate(() => window.__game.spot && window.__game.spot.id));
    await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
    await p.evaluate(() => window.__game.setVit({ food: 10, water: 10 }));
    await at(-10.3, 10.9, Math.PI / 2, -0.4);
    console.log('рядом', await p.evaluate(() => window.__game.spot && window.__game.spot.id));
    await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
    await p.keyboard.press('Digit1'); await p.waitForTimeout(300);
    console.log('сумка и сытость', await p.evaluate(() => JSON.stringify({ food: window.__game.st.food, vit: window.__game.st.vit, w: window.__game.arms.cur })));
    // Ночь: копии и крикун.
    await p.evaluate(() => window.__game.setTime(0.95));
    await at(18, 40, 0, 0);
    await p.evaluate(() => { const g = window.__game; g.enemies.spawn('echo', { x: 18, z: 33 }); g.enemies.spawn('echo', { x: 16, z: 30 }); g.enemies.spawn('screamer', { x: 20.5, z: 31 }); });
    await p.waitForTimeout(1800); await shot(p, '41-night-enemies');
    await p.waitForTimeout(2500);
    console.log('здоровье после атаки', await p.evaluate(() => Math.round(window.__game.st.vit.hp)), 'врагов', await p.evaluate(() => window.__game.enemies.list.length));
    await p.keyboard.down('Space'); await p.waitForTimeout(5000); await p.keyboard.up('Space');
    await shot(p, '42-night-fight');
    console.log('после боя: врагов', await p.evaluate(() => window.__game.enemies.list.length), 'здоровье', await p.evaluate(() => Math.round(window.__game.st.vit.hp)));
    await p.evaluate(() => { window.__game.enemies.clear(); window.__game.setTime(0.5); window.__game.setVit({ hp: 100, food: 90, water: 90 }); });
    // Стирание: пёс ведёт к следующей находке, а игрок уходит в сторону.
    await p.evaluate(() => { const g = window.__game; g.dog.place({ x: 18, z: 30 }); g.player.pos = { x: -18, z: 30 }; });
    await p.waitForTimeout(3500);
    await shot(p, '7-erasing');
    console.log('давление', await p.evaluate(() => window.__game.pressure.toFixed(2)), 'пёс', await p.evaluate(() => window.__game.dog.state));
    await p.waitForFunction(() => window.__game.mode === 'erased', null, { timeout: 40000 });
    await shot(p, '7b-erased');
    await p.click('#again');
    await p.waitForTimeout(400);
    console.log('после возрождения', await p.evaluate(() => JSON.stringify({ mode: window.__game.mode, p: window.__game.pressure, pos: window.__game.player.pos })));
    // Конец главы: все воспоминания найдены → разговор с Зоей → оборона двора → финал.
    const e = await b.newPage({ viewport: { width: 960, height: 540 } });
    e.on('pageerror', (er) => errors.push('EERR ' + er.message));
    await e.addInitScript(() => {
      localStorage.setItem('erased-town:quality', 'low');
      localStorage.setItem('erased-town:save:v1', JSON.stringify({ found: ['photo', 'home:nina', 'home:zoya', 'home:gena', 'home:tema'], taken: ['bowl', 'key', 'bino', 'metro'], hold: null, loot: ['loot:axe'], axe: true, intro: true, nightSeen: true, met: true, zstage: 4, tod: 0.4, vit: { hp: 100, food: 90, water: 90 } }));
    });
    await e.goto('http://localhost:4317/');
    await e.waitForFunction(() => window.__game, null, { timeout: 90000 });
    await e.click('#start');
    await e.evaluate(() => window.__game.talkZoya());
    await e.waitForTimeout(2500); await shot(e, '90-siege-talk');
    await e.evaluate(() => window.__game.cine.skip());
    await e.waitForFunction(() => window.__game.siege, null, { timeout: 10000 });
    await e.evaluate(() => { const g = window.__game; g.player.pos = { x: -8, z: 16.5 }; g.dog.place({ x: -8, z: 16.5 }); g.player.yaw = 0; });
    await e.waitForTimeout(9000); await shot(e, '91-siege');
    console.log('осада: врагов', await e.evaluate(() => window.__game.enemies.list.length), 'осталось', await e.evaluate(() => Math.round(window.__game.siege.left)));
    await e.evaluate(() => window.__game.setSiegeLeft(0.5));
    await e.waitForFunction(() => window.__game.cine.active, null, { timeout: 20000 });
    await e.waitForTimeout(3000); await shot(e, '92-ending');
    await e.evaluate(() => window.__game.cine.skip());
    console.log('после финала', await e.evaluate(() => JSON.stringify({ free: window.__game.st.free, mode: window.__game.mode, siege: !!window.__game.siege })));
    await e.close();
    // Телефон.
    const m = await b.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
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
