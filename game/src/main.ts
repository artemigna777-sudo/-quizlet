/** Главный цикл: меню → игра → находка / стирание. Прогресс (найденные воспоминания) хранится на устройстве. */
import * as THREE from 'three';
import { Sound } from './audio';
import { CFG, type Vec2 } from './config';
import { Dog } from './dog';
import { Input } from './input';
import { stepErasure } from './logic';
import { animateMemories, buildMemories, type Memory } from './memories';
import { Player } from './player';
import { Shooter } from './shooter';
import { buildWorld } from './world';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type Mode = 'menu' | 'play' | 'card' | 'erased' | 'pause';

function loadSave(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CFG.saveKey) ?? '{}');
    return Array.isArray(v.found) ? v.found.filter((x: unknown) => typeof x === 'string') : [];
  } catch { return []; }
}
function save(found: string[]) { try { localStorage.setItem(CFG.saveKey, JSON.stringify({ found })); } catch { /* приватный режим */ } }

async function boot() {
  // Шрифт для надписи на ладони должен загрузиться до рисования текстуры.
  await Promise.allSettled([document.fonts.load('700 54px Caveat'), document.fonts.load('20px Russo')]);

  const canvas = $<HTMLCanvasElement>('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  const world = buildWorld();
  const player = new Player();
  const dog = new Dog();
  const shooter = new Shooter();
  const input = new Input(canvas, $('stick'));
  const sound = new Sound();
  world.scene.add(player.camera, dog.mesh, shooter.mesh);
  document.body.classList.toggle('touch', input.touch);

  const START: Vec2 = { x: 18, z: 30 };
  let found = loadSave();
  let memories: Memory[] = buildMemories(world.scene, found);
  memories.filter((m) => m.found).forEach((m) => world.lightWindow(m.at));
  let mode: Mode = 'menu';
  let pressure = 0;
  let checkpoint: Vec2 = START;
  let playT = 0;
  let stepAt = 0;
  let warned = false;
  let near: Memory | null = null;
  let toastT = 0;

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    const k = Math.max(1, Math.min(w, h) / CFG.pixels);
    renderer.setSize(Math.round(w / k), Math.round(h / k), false);
    player.camera.aspect = w / h;
    player.camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  const show = (id: string, on: boolean) => $(id).classList.toggle('on', on);
  const toast = (text: string, sec = 4) => { const t = $('toast'); t.textContent = text; t.style.opacity = '1'; toastT = sec; };
  const hud = () => { $('memN').textContent = String(found.length); };
  const setMode = (m: Mode) => {
    mode = m;
    show('menu', m === 'menu'); show('card', m === 'card'); show('erased', m === 'erased'); show('pause', m === 'pause');
    if (m === 'play') input.lock(); else document.exitPointerLock?.();
  };
  hud();
  $('help').textContent = input.touch
    ? 'Левая половина экрана — идти, правая — смотреть. 🔦 фонарик, ✋ ладонь.'
    : 'WASD — идти, мышь — смотреть, Shift — бежать, F — фонарик, Q — ладонь, E — взять, Esc — пауза.';
  $('reset').style.display = found.length ? 'block' : 'none';

  const startGame = () => {
    sound.start();
    setMode('play');
    if (playT === 0) toast('Ты не помнишь, кто ты.', 3.5);
  };
  $('start').onclick = startGame;
  $('reset').onclick = () => { save([]); location.reload(); };
  $('resume').onclick = () => setMode('play');
  $('cardOk').onclick = () => {
    setMode('play');
    if (found.length === memories.length) toast('Это всё, что есть в первой версии. Продолжение — в следующих сериях.', 8);
  };
  $('again').onclick = () => {
    player.pos = { ...checkpoint };
    dog.place(checkpoint);
    pressure = 0;
    setMode('play');
  };
  $('bLight').onclick = () => input.press('KeyF');
  $('bAct').onclick = () => input.press('KeyE');
  const hand = $('bHand');
  hand.addEventListener('touchstart', (e) => { e.preventDefault(); input.hold('held:hand', true); }, { passive: false });
  hand.addEventListener('touchend', () => input.hold('held:hand', false));
  canvas.addEventListener('click', () => { if (mode === 'play') input.lock(); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && mode === 'play' && !input.touch) setMode('pause'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setMode('pause'); });

  const pick = (m: Memory) => {
    m.found = true;
    world.scene.remove(m.mesh);
    world.lightWindow(m.at);
    found = [...found, m.id];
    save(found);
    checkpoint = { ...m.at };
    hud();
    sound.pickup();
    $('cardTitle').textContent = m.title;
    $('cardText').textContent = m.text;
    setMode('card');
  };

  const clock = new THREE.Clock();
  let t = 0;
  const frame = () => {
    const dt = Math.min(0.05, clock.getDelta());
    t += dt;
    const look = input.frame();
    const playing = mode === 'play';
    if (playing) {
      playT += dt;
      if (input.hit('KeyF')) { player.flashlightOn = !player.flashlightOn; sound.click(); }
      player.update(dt, input, look, world.boxes, world.half, false);
      const goal = memories.filter((m) => !m.found).sort((a, b) => Math.hypot(a.at.x - player.pos.x, a.at.z - player.pos.z) - Math.hypot(b.at.x - player.pos.x, b.at.z - player.pos.z))[0] ?? null;
      dog.update(dt, t, player.pos, player.forward(), goal?.at ?? null, 70, world.boxes);
      if (dog.barked) sound.bark();
      shooter.update(dt, player.pos, player.forward(), world.lamps);
      if (shooter.appeared) sound.sting();
      if (player.stride - stepAt > (input.run ? 1.1 : 0.8)) { stepAt = player.stride; sound.step(); }

      // Стирание.
      const dDog = Math.hypot(dog.pos.x - player.pos.x, dog.pos.z - player.pos.z);
      pressure = stepErasure(pressure, dt, dDog);
      if (pressure > 0.2 && !warned) { warned = true; toast('Не отходи от пса: город стирает тех, кого никто не помнит.', 6); }
      if (pressure >= 1) { sound.erased(); setMode('erased'); }

      // Находка рядом.
      near = memories.find((m) => !m.found && Math.hypot(m.at.x - player.pos.x, m.at.z - player.pos.z) < 2.2) ?? null;
      if (near && input.hit('KeyE')) pick(near);

      // Подсказки начала.
      if (playT > 4 && playT - dt <= 4) toast(input.touch ? 'Зажми ✋ — посмотри на ладонь.' : 'Зажми Q — посмотри на ладонь.', 4.5);
      if (playT > 10 && playT - dt <= 10) toast('Пёс что-то чует. Иди за ним.', 5);
    } else {
      input.hit('KeyE'); input.hit('KeyF');
      near = null;
    }
    if (input.hit('Escape') && mode === 'play') setMode('pause');

    // Интерфейс.
    $('prompt').style.display = near && !input.touch ? 'block' : 'none';
    $('promptText').textContent = near ? `E — взять: ${near.title.toLowerCase()}` : '';
    $('bAct').style.display = near && input.touch ? 'flex' : 'none';
    const p = mode === 'erased' ? 1 : pressure;
    $('static').style.opacity = String(Math.pow(p, 1.3) * 0.9);
    canvas.style.filter = p > 0.01 ? `grayscale(${p.toFixed(2)}) brightness(${(1 - p * 0.25).toFixed(2)})` : '';
    $('erase').style.opacity = p > 0.03 ? '1' : '0';
    $('eraseBar').style.width = `${Math.round(p * 100)}%`;
    sound.setPressure(p);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = '0'; }

    animateMemories(memories, t);
    world.update(t, player.camera.position);
    renderer.render(world.scene, player.camera);
    requestAnimationFrame(frame);
  };
  // Первый кадр меню: камера смотрит вдоль улицы.
  player.update(0, input, { x: 0, y: 0 }, world.boxes, world.half, true);
  requestAnimationFrame(frame);

  // Для проверок и отладки.
  (window as unknown as Record<string, unknown>).__game = {
    player, dog, world, shooter,
    get mode() { return mode; }, get pressure() { return pressure; }, get found() { return found; },
    start: startGame,
  };
}

void boot();
