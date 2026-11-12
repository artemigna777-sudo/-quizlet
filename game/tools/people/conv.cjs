const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const JOBS = {
  echo: { model: 'b.fbx', tex: 1024, ratio: 0.3, clips: [['idle', 'anim/Breathing Idle.fbx'], ['stand', 'anim/Rifle Idle.fbx'], ['walk', 'anim/Walking.fbx', 1], ['stumble', 'anim/Zombie Stumbling.fbx', 1], ['run', 'anim/Zombie Run.fbx', 1], ['attack', 'anim/Standing Melee Attack Horizontal.fbx', 1], ['hit', 'anim/Zombie Reaction Hit.fbx', 1], ['die', 'anim/Dying.fbx'], ['scream', 'anim/Zombie Scream.fbx', 1]] },
  zoya: { model: 'a.fbx', tex: 512, ratio: 0.35, clips: [['idle', 'anim/Breathing Idle.fbx'], ['walk', 'anim/Walking 2.fbx', 1], ['hit', 'anim/Hit Reaction.fbx', 1]] },
};
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '4402'], { cwd: __dirname, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try { for (const [name, j] of Object.entries(JOBS)) {
    const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 200)); });
    await p.goto('http://localhost:4402/conv.html'); await p.waitForFunction(() => window.READY);
    const r = await p.evaluate(([m, c, t, q]) => window.convert(m, c, t, q), [j.model, j.clips, j.tex, j.ratio]);
    fs.writeFileSync(__dirname + `/${name}.glb`, Buffer.from(r.b64, 'base64'));
    console.log(name, (fs.statSync(__dirname + `/${name}.glb`).size / 1e6).toFixed(1) + ' МБ', r.clips.join(' '), '| треугольники:', r.stat.join(', '), r.prefix);
    await p.close();
  } } finally { await b.close(); srv.kill(); }
})();
