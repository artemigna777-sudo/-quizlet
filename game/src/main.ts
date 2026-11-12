/** Главный цикл: меню → игра → записка / воспоминание / стирание. Прогресс хранится на устройстве. */
import * as THREE from 'three';
import { Sound } from './audio';
import { Arms, Enemies, WEAPON } from './combat';
import { CFG, type Vec2 } from './config';
import { Dog } from './dog';
import { buildHomes, type Spot } from './homes';
import { Input } from './input';
import { stepErasure } from './logic';
import { animateMemories, buildMemories, type Memory } from './memories';
import { buildPlaces } from './places';
import { Player } from './player';
import { Shooter } from './shooter';
import { HOMES, canReveal, canTake, homeOf, itemOf, memId, revealed, yardGoal, type YardState } from './story';
import { SURV, advanceClock, clockText, daylight, drink, eat, grayOf, hurt, isNight, stepVitals, type Vitals } from './survival';
import { buildWorld } from './world';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type Mode = 'menu' | 'play' | 'card' | 'erased' | 'pause' | 'peek';
interface Save extends YardState { loot: string[]; food: number; water: number; ammo: number; axe: boolean; gun: boolean; vit: Vitals; tod: number }
const FRESH: Save = { found: [], taken: [], hold: null, loot: [], food: 0, water: 0, ammo: 0, axe: false, gun: false, vit: { hp: 100, food: 80, water: 75 }, tod: SURV.startTime };

function loadSave(): Save {
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const num = (v: unknown, d: number, max = 999) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(max, v)) : d);
  try {
    const v = JSON.parse(localStorage.getItem(CFG.saveKey) ?? '{}');
    const taken = strs(v.taken).filter((id) => itemOf(id));
    return {
      found: strs(v.found), taken, hold: typeof v.hold === 'string' && taken.includes(v.hold) ? v.hold : null, loot: strs(v.loot),
      food: num(v.food, 0, 99), water: num(v.water, 0, 99), ammo: num(v.ammo, 0), axe: v.axe === true, gun: v.gun === true,
      vit: { hp: Math.max(20, num(v.vit?.hp, 100, 100)), food: num(v.vit?.food, 80, 100), water: num(v.vit?.water, 75, 100) }, tod: num(v.tod, SURV.startTime, 0.9999),
    };
  } catch { return structuredClone(FRESH); }
}
function save(s: Save) { try { localStorage.setItem(CFG.saveKey, JSON.stringify(s)); } catch { /* приватный режим */ } }

async function boot() {
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
  const arms = new Arms(player.camera);
  const enemies = new Enemies(world.scene);
  world.scene.add(player.camera, dog.mesh, shooter.mesh);
  document.body.classList.toggle('touch', input.touch);
  player.camera.far = 130;
  player.camera.near = 0.1;

  const START: Vec2 = { x: 18, z: 30 };
  let st = loadSave();
  let found = [...st.found];
  const startBtn = $<HTMLButtonElement>('start');
  const homes = await buildHomes(world.scene, world.boxes, (k) => { startBtn.textContent = `ЗАГРУЗКА ${Math.round(k * 100)}%`; });
  const places = await buildPlaces(world.scene, world.boxes, world.lootSites);
  const spots: Spot[] = [...homes.spots, ...places.spots];
  startBtn.textContent = 'ИГРАТЬ';
  startBtn.disabled = false;
  HOMES.filter((h) => revealed(st, h.id)).forEach((h) => homes.reveal(h.id));
  st.taken.forEach((id) => homes.hideItem(id));
  spots.filter((s) => s.kind === 'loot' && st.loot.includes(s.id)).forEach((s) => { if (s.mesh) s.mesh.visible = false; });
  arms.hasAxe = st.axe; arms.hasGun = st.gun; arms.ammo = st.ammo;
  arms.cur = st.gun && st.ammo > 0 ? 'gun' : st.axe ? 'axe' : st.gun ? 'gun' : 'none';
  let saveT = 0;
  const commit = (next: Partial<Save>) => { st = { ...st, ...next, ammo: arms.ammo, axe: arms.hasAxe, gun: arms.hasGun }; found = [...st.found]; save(st); hud(); };
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
  let hitT = 0;
  let toastT = 0;
  let peek: { t: number; home: 'tema' } | null = null;
  let nightTold = false;
  let hungerTold = 0;
  let growlT = 0;
  let drops = 0;

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
    $('nFood').textContent = String(st.food);
    $('nWater').textContent = String(st.water);
    $('bEatN').textContent = String(st.food);
    $('bDrinkN').textContent = String(st.water);
    $('weapon').textContent = arms.cur === 'gun' ? `автомат · ${arms.ammo}` : arms.cur === 'axe' ? 'топор' : 'без оружия';
    document.body.classList.toggle('armed', arms.cur !== 'none');
    document.body.classList.toggle('two', arms.hasAxe && arms.hasGun);
    document.body.classList.toggle('bino', st.hold === 'bino');
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
    if (m === 'play') input.lock(); else if (m !== 'peek') document.exitPointerLock?.();
  };
  $('help').textContent = input.touch
    ? 'Слева — идти, справа — смотреть. Держи телефон горизонтально.'
    : 'WASD — идти, мышь — смотреть, Shift — бежать, F — фонарик, Q — ладонь, E — действие, ЛКМ или пробел — удар, X — сменить оружие, 1 — поесть, 2 — попить, Esc — пауза.';
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (input.touch && !standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) $('ios').style.display = 'block';
  $('reset').style.display = found.length || st.taken.length || st.loot.length ? 'block' : 'none';
  hud();

  const startGame = () => {
    sound.start();
    if (input.touch) { void document.documentElement.requestFullscreen?.().then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape')).catch(() => {}); }
    setMode('play');
    if (playT === 0) toast('Ты не помнишь, кто ты.', 3.5);
  };
  $('start').onclick = startGame;
  $('reset').onclick = () => { save(structuredClone(FRESH)); location.reload(); };
  $('resume').onclick = () => setMode('play');
  $('cardOk').onclick = () => {
    setMode('play');
    if (found.length === memories.length + HOMES.length) toast('Это всё, что есть в этой версии. Продолжение — в следующих сериях.', 8);
  };
  $('again').onclick = () => {
    player.pos = { ...checkpoint };
    dog.place(checkpoint);
    pressure = 0;
    enemies.clear();
    commit({ vit: { hp: 60, food: Math.max(st.vit.food, 35), water: Math.max(st.vit.water, 35) } });
    setMode('play');
  };
  $('bLight').onclick = () => input.press('KeyF');
  $('bAct').onclick = () => input.press('KeyE');
  $('bSwap').onclick = () => input.press('KeyX');
  $('bEat').onclick = () => input.press('Digit1');
  $('bDrink').onclick = () => input.press('Digit2');
  const holdBtn = (id: string, code: string) => {
    const b = $(id);
    b.addEventListener('touchstart', (e) => { e.preventDefault(); input.hold(code, true); }, { passive: false });
    b.addEventListener('touchend', () => input.hold(code, false));
    b.addEventListener('touchcancel', () => input.hold(code, false));
  };
  holdBtn('bHand', 'held:hand'); holdBtn('bFire', 'held:fire'); holdBtn('bBino', 'KeyV');
  canvas.addEventListener('click', () => { if (mode === 'play') input.lock(); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && mode === 'play' && !input.touch) setMode('pause'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setMode('pause'); });

  const die = (title: string, text: string) => { $('erasedTitle').textContent = title; $('erasedText').textContent = text; sound.erased(); setMode('erased'); };
  const pick = (m: Memory) => {
    m.found = true;
    world.scene.remove(m.mesh);
    world.lightWindow(m.at);
    commit({ found: [...st.found, m.id] });
    checkpoint = { ...m.at };
    sound.pickup();
    card(m.title, m.text, 'memory');
  };

  /** Что рядом и перед глазами: записка, вещь, припасы или стёртая дверь. */
  const spotNear = (): Spot | null => {
    const f = player.forward();
    let best: Spot | null = null, bd = 1.9;
    for (const s of spots) {
      if (s.home && s.room === 'B' && !revealed(st, s.home)) continue;
      if (s.kind === 'item' && st.taken.includes(s.id)) continue;
      if (s.kind === 'loot' && st.loot.includes(s.id)) continue;
      if (s.kind === 'gate' && revealed(st, s.home!)) continue;
      const dx = s.at.x - player.pos.x, dz = s.at.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bd && (d < 0.6 || (dx * f.x + dz * f.z) / d > 0.35)) { bd = d; best = s; }
    }
    return best;
  };
  const VERB: Record<string, string> = { bowl: 'поставить миску у порога', key: 'открыть ключом', bino: 'посмотреть в глазок через бинокль', metro: 'завести метроном' };
  const spotLabel = (s: Spot): string => {
    if (s.kind === 'note') return `прочитать: ${s.title.toLowerCase()}`;
    if (s.kind === 'loot') return `взять: ${s.title}`;
    if (s.kind === 'item') return st.hold ? 'руки заняты' : `взять: ${s.title}`;
    return canReveal(st, s.home!) ? VERB[st.hold!] ?? 'вернуть вещь' : 'стёртая комната';
  };
  const finishReveal = (home: Spot['home'] & string) => {
    const h = homeOf(home);
    homes.reveal(home);
    commit({ found: [...st.found, memId(home)], hold: null });
    checkpoint = { ...player.pos };
    flashT = 1;
    sound.pickup();
    card(h.memory.title, h.memory.text, 'memory');
  };
  const useSpot = (s: Spot) => {
    if (s.kind === 'note') { sound.click(); card(s.title, s.text, 'note'); return; }
    if (s.kind === 'loot') {
      if (s.mesh) s.mesh.visible = false;
      const k = s.loot!;
      const loot = [...st.loot, s.id];
      if (k === 'food') commit({ loot, food: st.food + 1 });
      else if (k === 'water') commit({ loot, water: st.water + 1 });
      else if (k === 'ammo') { arms.ammo += 15; commit({ loot }); }
      else { arms.give(k); if (k === 'gun') arms.ammo += 30; commit({ loot }); }
      sound.click();
      toast(k === 'axe' ? `Топор. ${input.touch ? 'Кнопка ⚔' : 'Левая кнопка мыши или пробел'} — ударить.`
        : k === 'gun' ? 'Автомат и 30 патронов. Патроны береги: копий по ночам много.'
          : k === 'ammo' ? 'Патроны: +15.' : `В сумке: ${s.title}. ${input.touch ? 'Кнопки 🥫 и 💧' : 'Клавиши 1 и 2'} — поесть и попить.`, 5);
      return;
    }
    if (s.kind === 'item') {
      const it = itemOf(s.id)!;
      if (!canTake(st, it)) { toast('В руках уже есть вещь. Сначала верни её хозяину.', 4); return; }
      homes.hideItem(s.id);
      commit({ taken: [...st.taken, s.id], hold: s.id });
      sound.click();
      toast(`${it.text}\nТузик нюхает её и тянет к двери.${s.id === 'bino' ? `\n${input.touch ? 'Кнопка 🔭' : 'Клавиша V'} — посмотреть в бинокль.` : ''}`, 7);
      return;
    }
    if (!canReveal(st, s.home!)) {
      toast(st.hold ? 'Эта вещь не отсюда. Комната не отзывается.' : 'Комнату стёрли. Здесь не хватает вещи, которую помнил хозяин.', 5);
      return;
    }
    if (st.hold === 'bino') {
      // Сквозь помехи в бинокль видно комнату такой, какой её помнил хозяин.
      player.yaw = Math.atan2(-(s.at.x - player.pos.x), -(s.at.z - player.pos.z));
      player.pitch = -0.05;
      homes.reveal(s.home!);
      peek = { t: 3, home: 'tema' };
      setMode('peek');
      sound.sting();
      return;
    }
    finishReveal(s.home!);
  };

  const clock = new THREE.Clock();
  let t = 0;
  const frame = () => {
    const dt = Math.min(0.05, clock.getDelta());
    t += dt;
    const look = input.frame();
    const portrait = input.touch && innerHeight > innerWidth;
    $('rotate').style.display = portrait ? 'flex' : 'none';
    const playing = mode === 'play' && !portrait;
    const night = isNight(st.tod);
    let zoom = false;
    if (playing) {
      playT += dt;
      st.tod = advanceClock(st.tod, dt);
      if (input.hit('KeyF')) { player.flashlightOn = !player.flashlightOn; sound.click(); }
      player.update(dt, input, look, world.boxes, world.half, false);
      const fwd = player.forward();
      const indoors = homes.inside(player.pos) !== null || places.inside(player.pos);

      // Голод и жажда.
      if (input.hit('Digit1')) { if (st.food > 0) { st.food--; st.vit = eat(st.vit); sound.gulp(); hud(); } else toast('Еды нет. Ищи в домах, в магазине и в ящиках на улицах.', 4); }
      if (input.hit('Digit2')) { if (st.water > 0) { st.water--; st.vit = drink(st.vit); sound.gulp(); hud(); } else toast('Воды нет. Ищи в домах, в магазине и в ящиках на улицах.', 4); }
      st.vit = stepVitals(st.vit, dt, input.run && player.moving);
      const low = st.vit.food <= 0 || st.vit.water <= 0 ? 2 : st.vit.food < 20 || st.vit.water < 20 ? 1 : 0;
      if (low > hungerTold) toast(low === 2 ? 'Сил больше нет: без еды и воды здоровье уходит.' : st.vit.water < 20 ? 'Хочется пить.' : 'Хочется есть.', 5);
      hungerTold = low;

      // Пёс ведёт по запаху: сначала двор (к двери нужного дома), потом находки на улицах.
      const yardHome = yardGoal(st);
      let goal: Vec2 | null = yardHome ? homes.door(yardHome) : null;
      if (goal && Math.hypot(goal.x - player.pos.x, goal.z - player.pos.z) < 7) goal = null;
      else if (!yardHome) goal = memories.filter((m) => !m.found).sort((a, b) => Math.hypot(a.at.x - player.pos.x, a.at.z - player.pos.z) - Math.hypot(b.at.x - player.pos.x, b.at.z - player.pos.z))[0]?.at ?? null;
      dog.update(dt, t, player.pos, fwd, goal, 90, world.boxes);
      if (dog.barked) sound.bark();
      if (night) { shooter.update(dt, player.pos, fwd, world.lamps); if (shooter.appeared) sound.sting(); } else shooter.mesh.visible = false;
      if (player.stride - stepAt > (input.run ? 1.1 : 0.8)) { stepAt = player.stride; sound.step(); }

      // Оружие.
      if (input.hit('KeyX')) { arms.swap(); sound.click(); hud(); }
      const ev = arms.update(dt, input.fire);
      if (ev === 'swing') { sound.swing(); if (enemies.hit(player.pos, fwd, WEAPON.axeRange, 0.5, WEAPON.axeDmg, world.boxes)) sound.thud(); }
      else if (ev === 'shot') { sound.shot(); if (enemies.hit(player.pos, fwd, WEAPON.gunRange, 0.994, WEAPON.gunDmg, world.boxes)) sound.thud(); hud(); }
      else if (ev === 'empty') { sound.dry(); if (arms.hasAxe) { arms.cur = 'axe'; hud(); } toast('Патроны кончились.', 2.5); }

      // Ночные копии.
      const tick = enemies.update(dt, { t, player: player.pos, fwd, running: input.run && player.moving, flash: player.flashlightOn, night, indoors, dog: dog.pos, boxes: world.boxes, nooks: world.nooks });
      if (tick.damage) { st.vit = hurt(st.vit, tick.damage); hitT = 1; sound.pain(); }
      if (tick.screamed) sound.scream();
      growlT -= dt;
      if (tick.near && growlT <= 0) { growlT = 5; sound.growl(); }
      for (const p of tick.died) {
        sound.dissolve();
        if (Math.random() < 0.45) {
          // Иногда от копии остаётся то, что было у человека, из которого её слепили.
          const kind = arms.hasGun && Math.random() < 0.5 ? 'ammo' : Math.random() < 0.5 ? 'food' : 'water';
          const s = places.drop(`drop:${++drops}`, kind, p);
          spots.push(s);
        }
      }
      if (night && !nightTold) { nightTold = true; toast('Ночь. Город лепит копии из тех, кого стёр.\nОни идут на звук шагов. В дома не заходят.', 8); }
      if (!night) nightTold = false;

      // Стирание: ночью сильнее.
      const dDog = Math.hypot(dog.pos.x - player.pos.x, dog.pos.z - player.pos.z);
      pressure = stepErasure(pressure, dt * (night && dDog > CFG.safe ? 1.5 : 1), dDog);
      if (pressure > 0.2 && !warned) { warned = true; toast('Не отходи от Тузика: город стирает тех, кого никто не помнит.', 6); }
      if (pressure >= 1) die('ТЕБЯ СТЁРЛИ', 'Рядом не было никого, кто тебя помнит. Держись ближе к Тузику.');
      else if (st.vit.hp <= 0) die('ТЕБЯ НЕ СТАЛО', tick.damage ? 'Копии не устают. Ночью лучше переждать в доме — или найти, чем отбиваться.' : 'Без еды и воды долго не протянуть. Ищи припасы в домах и в магазине.');

      near = memories.find((m) => !m.found && Math.hypot(m.at.x - player.pos.x, m.at.z - player.pos.z) < 2.2) ?? null;
      spot = near ? null : spotNear();
      if (input.hit('KeyE')) { if (near) pick(near); else if (spot) useSpot(spot); }
      zoom = st.hold === 'bino' && input.zoom;

      if (playT > 4 && playT - dt <= 4) toast(input.touch ? 'Зажми ✋ — посмотри на ладонь.' : 'Зажми Q — посмотри на ладонь.', 4.5);
      if (playT > 10 && playT - dt <= 10) toast('Тузик что-то чует. Иди за ним.', 5);
      saveT += dt;
      if (saveT > 5) { saveT = 0; commit({}); }
    } else {
      for (const k of ['KeyE', 'KeyF', 'KeyX', 'Digit1', 'Digit2']) input.hit(k);
      near = null;
      spot = null;
      if (mode === 'peek' && peek) {
        zoom = true;
        player.update(dt, input, { x: Math.sin(t * 1.3) * 0.6, y: Math.cos(t * 1.7) * 0.4 }, world.boxes, world.half, true);
        peek.t -= dt;
        if (peek.t <= 0) { const h = peek.home; peek = null; finishReveal(h); }
      }
    }
    if (input.hit('Escape') && mode === 'play') setMode('pause');

    // Интерфейс.
    const fov = zoom ? 20 : 70;
    if (Math.abs(player.camera.fov - fov) > 0.1) { player.camera.fov += (fov - player.camera.fov) * Math.min(1, dt * 14); player.camera.updateProjectionMatrix(); }
    $('binoMask').style.opacity = zoom ? '1' : '0';
    const label = near ? `взять: ${near.title.toLowerCase()}` : spot ? spotLabel(spot) : '';
    $('prompt').style.display = label ? 'block' : 'none';
    $('promptText').textContent = label ? (input.touch ? label : `E — ${label}`) : '';
    $('bAct').style.display = label && input.touch ? 'flex' : 'none';
    $('bAct').textContent = near || spot?.kind === 'item' || spot?.kind === 'loot' ? 'ВЗЯТЬ' : spot?.kind === 'note' ? 'ЧИТАТЬ' : 'ДВЕРЬ';
    if (flashT > 0) flashT = Math.max(0, flashT - dt * 1.2);
    $('flash').style.opacity = String(flashT);
    if (hitT > 0) hitT = Math.max(0, hitT - dt * 2);
    $('hit').style.opacity = String(hitT * 0.8);
    const p = mode === 'erased' ? 1 : pressure;
    const gray = Math.max(p, mode === 'erased' ? 1 : grayOf(st.vit.hp));
    $('static').style.opacity = String(Math.pow(p, 1.3) * 0.9);
    canvas.style.filter = gray > 0.01 ? `grayscale(${gray.toFixed(2)}) brightness(${(1 - gray * 0.25).toFixed(2)})` : '';
    $('vig').style.opacity = String(0.55 + gray * 0.45);
    $('erase').style.opacity = p > 0.03 ? '1' : '0';
    $('eraseBar').style.width = `${Math.round(p * 100)}%`;
    $('barFood').style.width = `${Math.round(st.vit.food)}%`;
    $('barWater').style.width = `${Math.round(st.vit.water)}%`;
    $('needs').classList.toggle('low', st.vit.food < 20 || st.vit.water < 20);
    $('clock').textContent = `${daylight(st.tod) < 0.25 ? '☾' : '☀'} ${clockText(st.tod)}`;
    sound.setPressure(p);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = '0'; }

    animateMemories(memories, t);
    world.setTime(st.tod);
    world.update(t, player.camera.position);
    homes.update(t);
    renderer.render(world.scene, player.camera);
    requestAnimationFrame(frame);
  };
  player.update(0, input, { x: 0, y: 0 }, world.boxes, world.half, true);
  arms.update(0, false);
  requestAnimationFrame(frame);

  // Для проверок и отладки.
  (window as unknown as Record<string, unknown>).__game = {
    player, dog, world, shooter, homes, enemies, arms,
    get mode() { return mode; }, get pressure() { return pressure; }, get found() { return found; },
    get st() { return st; }, get spot() { return spot; },
    setTime(v: number) { st.tod = v; }, setVit(v: Partial<Vitals>) { st.vit = { ...st.vit, ...v }; },
    start: startGame,
  };
}

void boot();
