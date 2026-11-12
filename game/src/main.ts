/** Главный цикл: меню → игра → находка / стирание. Прогресс (найденные воспоминания) хранится на устройстве. */
import * as THREE from 'three';
import { Sound } from './audio';
import { CFG, type Vec2 } from './config';
import { Dog } from './dog';
import { buildHomes, type Spot } from './homes';
import { Input } from './input';
import { stepErasure } from './logic';
import { animateMemories, buildMemories, type Memory } from './memories';
import { Player } from './player';
import { Shooter } from './shooter';
import { HOMES, canReveal, canTake, homeOf, itemOf, memId, revealed, yardGoal, type YardState } from './story';
import { buildWorld } from './world';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type Mode = 'menu' | 'play' | 'card' | 'erased' | 'pause';

function loadSave(): YardState {
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  try {
    const v = JSON.parse(localStorage.getItem(CFG.saveKey) ?? '{}');
    const taken = strs(v.taken).filter((id) => itemOf(id));
    return { found: strs(v.found), taken, hold: typeof v.hold === 'string' && taken.includes(v.hold) ? v.hold : null };
  } catch { return { found: [], taken: [], hold: null }; }
}
function save(s: YardState) { try { localStorage.setItem(CFG.saveKey, JSON.stringify(s)); } catch { /* приватный режим */ } }

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
  let st = loadSave();
  let found = [...st.found];
  const startBtn = $<HTMLButtonElement>('start');
  const homes = await buildHomes(world.scene, world.boxes, (k) => { startBtn.textContent = `ЗАГРУЗКА ${Math.round(k * 100)}%`; });
  startBtn.textContent = 'ИГРАТЬ';
  startBtn.disabled = false;
  HOMES.filter((h) => revealed(st, h.id)).forEach((h) => homes.reveal(h.id));
  st.taken.forEach((id) => homes.hideItem(id));
  const commit = (next: YardState) => { st = next; found = [...st.found]; save(st); hud(); };
  let memories: Memory[] = buildMemories(world.scene, found);
  memories.filter((m) => m.found).forEach((m) => world.lightWindow(m.at));
  let mode: Mode = 'menu';
  let pressure = 0;
  let checkpoint: Vec2 = START;
  let playT = 0;
  let stepAt = 0;
  let warned = false;
  let near: Memory | null = null;
  let spot: Spot | null = null;
  let flashT = 0;
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
  const hud = () => {
    $('memN').textContent = String(found.length);
    $('memAll').textContent = String(memories.length + HOMES.length);
    const it = st.hold ? itemOf(st.hold) : null;
    $('hold').style.display = it ? 'block' : 'none';
    $('holdName').textContent = it?.name ?? '';
  };
  const card = (title: string, text: string, kind: 'note' | 'memory') => {
    $('cardKind').textContent = kind === 'memory' ? 'ВОСПОМИНАНИЕ' : '';
    $('cardTitle').textContent = title;
    $('cardText').textContent = text;
    $('card').classList.toggle('hand', kind === 'note');
    setMode('card');
  };
  const setMode = (m: Mode) => {
    mode = m;
    show('menu', m === 'menu'); show('card', m === 'card'); show('erased', m === 'erased'); show('pause', m === 'pause');
    if (m === 'play') input.lock(); else document.exitPointerLock?.();
  };
  $('help').textContent = input.touch
    ? 'Левая половина экрана — идти, правая — смотреть. 🔦 фонарик, ✋ ладонь.'
    : 'WASD — идти, мышь — смотреть, Shift — бежать, F — фонарик, Q — ладонь, E — взять, Esc — пауза.';
  $('reset').style.display = found.length || st.taken.length ? 'block' : 'none';
  hud();

  const startGame = () => {
    sound.start();
    setMode('play');
    if (playT === 0) toast('Ты не помнишь, кто ты.', 3.5);
  };
  $('start').onclick = startGame;
  $('reset').onclick = () => { save({ found: [], taken: [], hold: null }); location.reload(); };
  $('resume').onclick = () => setMode('play');
  $('cardOk').onclick = () => {
    setMode('play');
    if (found.length === memories.length + HOMES.length) toast('Это всё, что есть в первой версии. Продолжение — в следующих сериях.', 8);
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
    commit({ ...st, found: [...st.found, m.id] });
    checkpoint = { ...m.at };
    sound.pickup();
    card(m.title, m.text, 'memory');
  };

  /** Что рядом и перед глазами во дворе: записка, вещь или стёртая дверь. */
  const spotNear = (): Spot | null => {
    const f = player.forward();
    let best: Spot | null = null, bd = 1.9;
    for (const s of homes.spots) {
      if (s.room === 'B' && !revealed(st, s.home)) continue;
      if (s.kind === 'item' && st.taken.includes(s.id)) continue;
      if (s.kind === 'gate' && revealed(st, s.home)) continue;
      const dx = s.at.x - player.pos.x, dz = s.at.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bd && (d < 0.6 || (dx * f.x + dz * f.z) / d > 0.35)) { bd = d; best = s; }
    }
    return best;
  };
  const spotLabel = (s: Spot): string => {
    if (s.kind === 'note') return `прочитать: ${s.title.toLowerCase()}`;
    if (s.kind === 'item') return st.hold ? 'руки заняты' : `взять: ${s.title}`;
    return canReveal(st, s.home) ? `вернуть: ${itemOf(st.hold!)!.name}` : 'стёртая комната';
  };
  const useSpot = (s: Spot) => {
    if (s.kind === 'note') { sound.click(); card(s.title, s.text, 'note'); return; }
    if (s.kind === 'item') {
      const it = itemOf(s.id)!;
      if (!canTake(st, it)) { toast('В руках уже есть вещь. Сначала верни её хозяину.', 4); return; }
      homes.hideItem(s.id);
      commit({ ...st, taken: [...st.taken, s.id], hold: s.id });
      sound.click();
      toast(`${it.text}\nПёс нюхает её и тянет к двери.`, 7);
      return;
    }
    if (!canReveal(st, s.home)) {
      toast(st.hold ? 'Эта вещь не отсюда. Комната не отзывается.' : 'Комнату стёрли. Здесь не хватает вещи, которую помнил хозяин.', 5);
      return;
    }
    const h = homeOf(s.home);
    homes.reveal(s.home);
    commit({ ...st, found: [...st.found, memId(s.home)], hold: null });
    checkpoint = { ...player.pos };
    flashT = 1;
    sound.pickup();
    card(h.memory.title, h.memory.text, 'memory');
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
      // Пёс ведёт по запаху: сначала двор (к двери нужного дома), потом находки на улицах.
      const yardHome = yardGoal(st);
      let goal: Vec2 | null = yardHome ? homes.door(yardHome) : null;
      if (goal && Math.hypot(goal.x - player.pos.x, goal.z - player.pos.z) < 7) goal = null; // игрок уже у дома — пёс идёт рядом
      else if (!yardHome) goal = memories.filter((m) => !m.found).sort((a, b) => Math.hypot(a.at.x - player.pos.x, a.at.z - player.pos.z) - Math.hypot(b.at.x - player.pos.x, b.at.z - player.pos.z))[0]?.at ?? null;
      dog.update(dt, t, player.pos, player.forward(), goal, 70, world.boxes);
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
      spot = near ? null : spotNear();
      if (input.hit('KeyE')) { if (near) pick(near); else if (spot) useSpot(spot); }

      // Подсказки начала.
      if (playT > 4 && playT - dt <= 4) toast(input.touch ? 'Зажми ✋ — посмотри на ладонь.' : 'Зажми Q — посмотри на ладонь.', 4.5);
      if (playT > 10 && playT - dt <= 10) toast('Пёс что-то чует. Иди за ним.', 5);
    } else {
      input.hit('KeyE'); input.hit('KeyF');
      near = null;
      spot = null;
    }
    if (input.hit('Escape') && mode === 'play') setMode('pause');

    // Интерфейс.
    const label = near ? `взять: ${near.title.toLowerCase()}` : spot ? spotLabel(spot) : '';
    $('prompt').style.display = label ? 'block' : 'none';
    $('promptText').textContent = label ? (input.touch ? label : `E — ${label}`) : '';
    $('bAct').style.display = label && input.touch ? 'flex' : 'none';
    $('bAct').textContent = near || spot?.kind === 'item' ? 'ВЗЯТЬ' : spot?.kind === 'note' ? 'ЧИТАТЬ' : 'ДВЕРЬ';
    if (flashT > 0) flashT = Math.max(0, flashT - dt * 1.2);
    $('flash').style.opacity = String(flashT);
    const p = mode === 'erased' ? 1 : pressure;
    $('static').style.opacity = String(Math.pow(p, 1.3) * 0.9);
    canvas.style.filter = p > 0.01 ? `grayscale(${p.toFixed(2)}) brightness(${(1 - p * 0.25).toFixed(2)})` : '';
    $('erase').style.opacity = p > 0.03 ? '1' : '0';
    $('eraseBar').style.width = `${Math.round(p * 100)}%`;
    sound.setPressure(p);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = '0'; }

    animateMemories(memories, t);
    world.update(t, player.camera.position);
    homes.update(t);
    renderer.render(world.scene, player.camera);
    requestAnimationFrame(frame);
  };
  // Первый кадр меню: камера смотрит вдоль улицы.
  player.update(0, input, { x: 0, y: 0 }, world.boxes, world.half, true);
  requestAnimationFrame(frame);

  // Для проверок и отладки.
  (window as unknown as Record<string, unknown>).__game = {
    player, dog, world, shooter, homes,
    get st() { return st; }, get spot() { return spot; },
    get mode() { return mode; }, get pressure() { return pressure; }, get found() { return found; },
    start: startGame,
  };
}

void boot();
