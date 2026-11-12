/** Главный цикл: меню → игра → записка / воспоминание / стирание. Прогресс хранится на устройстве. */
import * as THREE from 'three';
import { Sound } from './audio';
import { Cine, type Shot } from './cine';
import { Arms, Enemies, WEAPON } from './combat';
import { CFG, type Vec2 } from './config';
import { Dog } from './dog';
import { buildHomes, type Spot } from './homes';
import { Input } from './input';
import { stepErasure } from './logic';
import { animateMemories, buildMemories, type Memory } from './memories';
import { buildPlaces } from './places';
import { loadPeople } from './people';
import { photoCanvas } from './photos';
import { Player } from './player';
import { Shooter } from './shooter';
import { HOMES, canReveal, canTake, homeOf, itemOf, memId, revealed, yardGoal, type YardState } from './story';
import { SURV, advanceClock, clockText, daylight, drink, eat, grayOf, hurt, isNight, stepVitals, type Vitals } from './survival';
import { AREA, buildWorld, inArea } from './world';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type Mode = 'menu' | 'play' | 'card' | 'erased' | 'pause' | 'peek' | 'cine';
interface Save extends YardState { loot: string[]; food: number; water: number; ammo: number; axe: boolean; gun: boolean; vit: Vitals; tod: number; parts: number; axeLvl: number; gunLvl: number; intro: boolean; nightSeen: boolean; free: boolean; met: boolean; zstage: number; nights: number }
const FRESH: Save = { found: [], taken: [], hold: null, loot: [], food: 0, water: 0, ammo: 0, axe: false, gun: false, vit: { hp: 100, food: 80, water: 75 }, tod: SURV.startTime, parts: 0, axeLvl: 0, gunLvl: 0, intro: false, nightSeen: false, free: false, met: false, zstage: 0, nights: 0 };

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
      parts: num(v.parts, 0, 99), axeLvl: num(v.axeLvl, 0, 1), gunLvl: num(v.gunLvl, 0, 1), intro: v.intro === true, nightSeen: v.nightSeen === true, free: v.free === true, met: v.met === true, zstage: num(v.zstage, 0, 4), nights: num(v.nights, 0, 99),
    };
  } catch { return structuredClone(FRESH); }
}
function save(s: Save) { try { localStorage.setItem(CFG.saveKey, JSON.stringify(s)); } catch { /* приватный режим */ } }

async function boot() {
  await Promise.allSettled([document.fonts.load('700 54px Caveat'), document.fonts.load('20px Russo')]);

  const canvas = $<HTMLCanvasElement>('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const world = buildWorld();
  const player = new Player();
  const dog = new Dog();
  const shooter = new Shooter();
  const input = new Input(canvas, $('stick'));
  const sound = new Sound();
  const arms = new Arms(player.camera);
  const cine = new Cine({ root: $('cine'), sub: $('cineSub'), title: $('cineTitle') }, (id) => sound.say(id));
  let enemies!: Enemies;
  let siege: { left: number } | null = null;
  world.scene.add(player.camera, dog.mesh, shooter.mesh);
  document.body.classList.toggle('touch', input.touch);
  player.camera.far = 130;
  player.camera.near = 0.1;

  const START: Vec2 = { x: 18, z: 20 };
  player.pos = { ...START };
  player.yaw = 0.35;
  dog.place({ x: START.x + 0.4, z: START.z - 2.2 });
  const noCine = (window as unknown as { __noCine?: boolean }).__noCine === true;
  let st = loadSave();
  let found = [...st.found];
  const startBtn = $<HTMLButtonElement>('start');
  const homes = await buildHomes(world.scene, world.boxes, (k) => { startBtn.textContent = `ЗАГРУЗКА ${Math.round(k * 100)}%`; });
  const places = await buildPlaces(world.scene, world.boxes, world.lootSites);
  // Люди: копии Стрелка, сам Стрелок и тётя Зоя.
  startBtn.textContent = 'ЗАГРУЗКА ЛЮДЕЙ…';
  const makePerson = await loadPeople();
  enemies = new Enemies(world.scene, makePerson);
  const shooterBody = makePerson('echo');
  shooterBody.play('stand');
  shooter.mesh.clear();
  shooter.mesh.add(shooterBody.root);
  for (const sx of [-0.035, 0.035]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2a2a, fog: false })); eye.position.set(sx, 1.665, 0.125); shooter.mesh.add(eye); }
  // Мурка: приходит к своей миске, когда комната Зои вернулась.
  const murka = new THREE.Group();
  {
    const fur = new THREE.MeshLambertMaterial({ color: 0x8a8a92 }), dark = new THREE.MeshLambertMaterial({ color: 0x55555e });
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, sc?: [number, number, number]) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; if (sc) o.scale.set(...sc); o.castShadow = true; murka.add(o); return o; };
    add(new THREE.CapsuleGeometry(0.075, 0.2, 3, 8), fur, 0, 0.14, 0, Math.PI / 2);
    add(new THREE.SphereGeometry(0.07, 8, 7), fur, 0, 0.2, 0.17);
    for (const s of [-1, 1]) { add(new THREE.ConeGeometry(0.025, 0.05, 4), dark, s * 0.04, 0.275, 0.16); add(new THREE.SphereGeometry(0.012, 5, 4), new THREE.MeshBasicMaterial({ color: 0xc8e060 }), s * 0.028, 0.21, 0.232); }
    for (const [x, z] of [[-0.05, 0.1], [0.05, 0.1], [-0.05, -0.1], [0.05, -0.1]]) add(new THREE.CylinderGeometry(0.018, 0.016, 0.1, 5), dark, x, 0.05, z);
    const tail = add(new THREE.CylinderGeometry(0.012, 0.02, 0.24, 5), dark, 0, 0.24, -0.2, -0.5);
    murka.userData.tail = tail;
  }
  murka.position.set(-10.3, 0.05, 12.05);
  murka.rotation.y = -0.6;
  murka.visible = false;
  world.scene.add(murka);
  const zoya = makePerson('zoya');
  zoya.play('idle');
  world.scene.add(zoya.root);
  world.boxes.push({ minX: -7.65, maxX: -7.15, minZ: 9.35, maxZ: 9.85 });
  const spots: Spot[] = [...homes.spots, ...places.spots, { id: 'talk:zoya', kind: 'talk', room: 'A', at: { x: -7.4, z: 9.6 }, title: 'Тётя Зоя', text: '', mesh: null }];
  startBtn.textContent = 'ИГРАТЬ';
  startBtn.disabled = false;
  HOMES.filter((h) => revealed(st, h.id)).forEach((h) => homes.reveal(h.id));
  st.taken.forEach((id) => homes.hideItem(id));
  spots.filter((s) => s.kind === 'loot' && st.loot.includes(s.id)).forEach((s) => { if (s.mesh) s.mesh.visible = false; });
  arms.hasAxe = st.axe; arms.hasGun = st.gun; arms.ammo = st.ammo;
  arms.cur = st.gun && st.ammo > 0 ? 'gun' : st.axe ? 'axe' : st.gun ? 'gun' : 'none';
  let saveT = 0;
  const commit = (next: Partial<Save>) => { st = { ...st, ...next, ammo: arms.ammo, axe: arms.hasAxe, gun: arms.hasGun }; found = [...st.found]; save(st); hud(); };
  const allMemories: Memory[] = buildMemories(world.scene, found);
  allMemories.filter((m) => m.found).forEach((m) => world.lightWindow(m.at));
  let memories: Memory[] = [];
  /** Первая глава идёт во дворе и вокруг него; после неё город открыт весь. */
  const applyChapter = () => {
    world.setBounds(!st.free);
    memories = allMemories.filter((m) => st.free || inArea(m.at));
    allMemories.forEach((m) => { m.mesh.visible = memories.includes(m); });
  };
  applyChapter();
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
  let edgeT = -99;
  let heartT = 0;
  let wasNight = false;
  let goalText = '';
  let photoSaid = false;
  let murkaSaid = false;

  // Качество: «высокое» — чётче и с тенями, «обычное» — для слабых телефонов. Игра сама понижает его, если тормозит.
  const QKEY = 'erased-town:quality';
  let chosen: string | null = null;
  try { chosen = localStorage.getItem(QKEY); } catch { /* приватный режим */ }
  let high = chosen !== 'low';
  let probeT = 0, probeN = 0;
  world.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m.material instanceof THREE.MeshBasicMaterial)) { m.castShadow = true; m.receiveShadow = true; }
  });
  const applyQuality = () => {
    world.setShadows(high);
    player.setShadows(high);
    $('quality').textContent = `КАЧЕСТВО: ${high ? 'ВЫСОКОЕ' : 'ОБЫЧНОЕ'}`;
    resize();
  };
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    const k = Math.max(1, Math.min(w, h) / (high ? 480 : CFG.pixels));
    renderer.setSize(Math.round(w / k), Math.round(h / k), false);
    cine.cam.aspect = w / h;
    cine.cam.updateProjectionMatrix();
    player.camera.aspect = w / h;
    player.camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  applyQuality();
  $('quality').onclick = () => { high = !high; chosen = high ? 'high' : 'low'; try { localStorage.setItem(QKEY, chosen); } catch { /* приватный режим */ } applyQuality(); };

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
    $('weapon').textContent = arms.cur === 'gun' ? `автомат${st.gunLvl ? '+' : ''} · ${arms.ammo}` : arms.cur === 'axe' ? `топор${st.axeLvl ? '+' : ''}` : 'без оружия';
    $('nParts').textContent = String(st.parts);
    document.body.classList.toggle('armed', arms.cur !== 'none');
    document.body.classList.toggle('two', arms.hasAxe && arms.hasGun);
    document.body.classList.toggle('bino', st.hold === 'bino');
  };
  const card = (title: string, text: string, kind: 'note' | 'memory', voice?: string, photo?: string) => {
    const img = $<HTMLImageElement>('cardImg');
    img.style.display = photo ? 'block' : 'none';
    if (photo) img.src = photoCanvas(photo).toDataURL('image/jpeg', 0.85);
    if (voice) sound.say(voice);
    $('cardKind').textContent = kind === 'memory' ? 'ВОСПОМИНАНИЕ' : '';
    $('cardTitle').textContent = title;
    $('cardText').textContent = text;
    $('card').classList.toggle('hand', kind === 'note');
    setMode('card');
  };
  const setMode = (m: Mode) => {
    mode = m;
    document.body.classList.toggle('cine', m === 'cine');
    show('menu', m === 'menu'); show('card', m === 'card'); show('erased', m === 'erased'); show('pause', m === 'pause');
    if (m === 'play') input.lock(); else if (m !== 'peek' && m !== 'cine') document.exitPointerLock?.();
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
    if (!st.intro && !noCine) { st.intro = true; input.lock(); playIntro(); return; }
    setMode('play');
    if (playT === 0) toast('Ты не помнишь, кто ты.', 3.5);
  };
  $('start').onclick = startGame;
  $('reset').onclick = () => { save(structuredClone(FRESH)); location.reload(); };
  $('resume').onclick = () => setMode('play');
  $('cardOk').onclick = () => {
    sound.say(null);
    setMode('play');
    if (!st.free && found.length >= memories.length + HOMES.length) toast('Во всех окнах двора горит свет. Зоя зовёт.', 7);
  };
  $('again').onclick = () => {
    player.pos = { ...checkpoint };
    dog.place(checkpoint);
    pressure = 0;
    enemies.clear();
    if (siege) siege.left = SIEGE;
    commit({ vit: { hp: siege ? 80 : 60, food: Math.max(st.vit.food, 35), water: Math.max(st.vit.water, 35) } });
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

  // ───────── Сценки ─────────
  const run = (shots: Shot[], after: () => void) => { setMode('cine'); cine.play(shots, () => { setMode('play'); after(); }); };
  const ZP: Vec2 = { x: -7.4, z: 9.6 }; // тётя Зоя стоит у себя на кухне
  const ZDOOR = homes.door('zoya');
  const zoyaHome = () => { zoya.root.position.set(ZP.x, 0.05, ZP.z); zoya.root.rotation.y = 0; };
  zoyaHome();
  const playIntro = () => {
    const s = START;
    dog.place({ x: s.x - 0.4, z: s.z - 2.4 });
    const d = dog.pos;
    run([
      { dur: 5, from: [s.x, 40, s.z + 2], to: [s.x - 1, 13, s.z + 3], look: [s.x - 6, 0, s.z - 16], lookTo: [s.x - 4, 0, s.z - 9], title: 'ГЛАВА 1 · ДВОР', text: 'Город, которого нет на картах.' },
      { dur: 4, from: [s.x, 0.25, s.z], to: [s.x, 0.5, s.z - 0.1], look: [s.x - 3, 4, s.z - 12], lookTo: [d.x, 0.8, d.z], voice: 'h_intro1', text: 'Асфальт. Холодно. Я не помню, как меня зовут.' },
      { dur: 4, from: [d.x + 0.9, 0.55, d.z + 1.5], to: [d.x + 0.5, 0.7, d.z + 1.1], look: [d.x, 0.75, d.z], voice: 'h_intro2', text: 'Пёс. На ошейнике — «Тузик». Он тянет меня за рукав. Что-то идёт.', on: () => sound.bark() },
      { dur: 4, from: [s.x - 2, 1.2, s.z - 5], to: [s.x - 1, 1.5, s.z - 3], look: [s.x, 4, AREA.maxZ], voice: 'h_wall', text: 'За спиной — стена помех. Там, где она прошла, ничего не остаётся.' },
      { dur: 3.5, from: [s.x, 0.9, s.z], to: [s.x, 1.6, s.z], look: [s.x - 2, 1.0, s.z - 5], lookTo: [s.x - 4, 1.5, s.z - 8], voice: 'h_intro3', text: 'На ладони что-то написано. Моим почерком.' },
    ], () => { commit({}); toast(input.touch ? 'Зажми ✋ — посмотри на ладонь.' : 'Зажми Q — посмотри на ладонь.', 5); playT = Math.max(playT, 5); });
  };
  const playNight = () => {
    const l = world.lamps.filter((v) => v.mode === 'on' && inArea({ x: v.lx, z: v.lz }, 3)).sort((a, b) => Math.abs(Math.hypot(a.lx - player.pos.x, a.lz - player.pos.z) - 20) - Math.abs(Math.hypot(b.lx - player.pos.x, b.lz - player.pos.z) - 20))[0];
    if (!l) { commit({}); return; }
    const e = player.pos, dx = l.lx - e.x, dz = l.lz - e.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    run([
      { dur: 3.5, from: [e.x, 1.7, e.z], to: [e.x + ux * 2, 1.9, e.z + uz * 2], look: [l.lx, 3, l.lz], voice: 'h_night1', text: 'Темнеет. Фонари зажглись сами.', on: () => { shooter.mesh.position.set(l.lx, 0, l.lz); shooter.mesh.rotation.y = Math.atan2(-ux, -uz); shooter.mesh.visible = true; } },
      { dur: 4.5, from: [l.lx - ux * 9 + uz * 2, 1.5, l.lz - uz * 9 - ux * 2], to: [l.lx - ux * 3.2 + uz, 1.6, l.lz - uz * 3.2 - ux], look: [l.lx, 1.5, l.lz], voice: 'h_night2', text: 'Под фонарём кто-то стоит. Тузик не лает. Он молчит.' },
      { dur: 3, from: [l.lx - ux * 3.2 + uz, 1.6, l.lz - uz * 3.2 - ux], look: [l.lx, 1.5, l.lz], voice: 'h_night3', text: 'Мигнуло. Никого.', on: () => { shooter.mesh.visible = false; sound.sting(); } },
    ], () => { nightTold = true; commit({}); toast('Ночь. Город лепит копии из тех, кого стёр.\nОни идут на звук шагов. В дома не заходят.\nВ доме, который вспомнили, ночь можно переждать.', 9); });
  };
  // Крупные планы Зои: камера стоит в дверях её кухни.
  const zShot = (voice: string, text: string, close = false): Shot => close
    ? { dur: 3, from: [ZP.x + 0.5, 1.58, ZP.z + 1.5], to: [ZP.x + 0.35, 1.58, ZP.z + 1.25], look: [ZP.x, 1.56, ZP.z], voice, text }
    : { dur: 3, from: [ZP.x + 0.9, 1.5, ZP.z + 3.4], to: [ZP.x + 0.7, 1.5, ZP.z + 2.6], look: [ZP.x, 1.35, ZP.z], voice, text };
  const HINTS = [
    'Зоя: «Миска Мурки — у Нины Сергеевны, в первом доме».',
    'Зоя: «Ключ — в жестянке из-под чая, в спальне. Гена жил в третьем».',
    'Зоя: «Бинокль Тёмкин остался у Гены в мастерской. Тёмка — из четвёртого».',
    'Зоя: «Метроном у Тёмки на кухне. Верни его Нине Сергеевне».',
    'Зоя: «У четвёртого дома что-то блестит. Глянь».',
  ];
  const allFound = () => found.length >= memories.length + HOMES.length;
  const SIEGE = 150;
  const talkZoya = () => {
    const stage = HOMES.filter((h) => revealed(st, h.id)).length;
    if (!st.met) {
      run([zShot('z_meet1', '— Стой, где стоишь! …Тузик? Тузик, это ты, что ли? Живой.'), zShot('z_meet2', '— А тебя я не знаю. Ты с ним пришёл? Ну, значит, не чужой. Тузик к чужим не идёт.', true),
        zShot('z_meet3', '— Мурка без своей миски не ест. Глянь у Нины Сергеевны, в первом доме. Принесёшь — поставь у той двери. Там была комната. Я не помню, какая.')],
      () => { commit({ met: true }); toast('Тузик тянет к первому дому.', 4); });
    } else if (allFound() && !st.free) {
      if (!arms.hasAxe) { sound.say('z_noaxe'); toast('Зоя: «С пустыми руками не выстоишь. Во дворе, в пне, топор торчит».', 6); return; }
      run([zShot('z_siege1', '— Свет в окнах. Четыре окна горят. Их теперь видно с любого конца города. Они придут на свет.', true),
        { dur: 4, from: [0, 1.7, 2], to: [0, 5, 6], look: [0, 3, -6], voice: 'z_siege2', text: '— Держи двор до рассвета. Я дверь подопру. Тузик, с ним иди!', on: () => { st.tod = 0; } }],
      () => { st.nightSeen = true; nightTold = true; siege = { left: SIEGE }; checkpoint = { ...ZDOOR }; enemies.clear(); commit({}); toast('Они идут на свет. Продержись до рассвета.', 6); });
    } else if (st.zstage < stage && stage >= 1) {
      const text = ['', '— Спальня. Я же в ней спала. Как можно забыть, что у тебя есть спальня? Там, в жестянке из-под чая, ключ от Гениного гаража. Отнеси.',
        '— Гена лодку строил. Одиннадцать лет пилил, весь двор не спал. Я ругалась. А сейчас бы послушала.',
        '— Тёмка. Мальчик из четвёртого. Я ему батарейки обещала. У него мама была. И ещё кто-то. Не помню кто.',
        '— Слышишь? Метроном. Это Нина Сергеевна уроки даёт. Давала.'][stage];
      run([zShot(`z_after${stage}`, text, stage % 2 === 0)], () => commit({ zstage: stage }));
    } else toast(allFound() ? 'Зоя: «Иди. Я тут».' : HINTS[Math.min(stage, 4)], 6);
  };
  const playEnding = () => {
    zoya.root.position.set(ZDOOR.x, 0.05, ZDOOR.z - 0.2);
    dog.place({ x: ZDOOR.x + 0.2, z: ZDOOR.z + 1.0 });
    const d = dog.pos, z = ZDOOR;
    run([
      { dur: 4, from: [z.x + 1, 1.7, z.z + 6], to: [z.x + 0.5, 1.6, z.z + 2.6], look: [z.x, 1.4, z.z - 0.2], voice: 'z_end1', text: '— Рассвело. Живые. Дай хоть посмотрю на тебя.' },
      { dur: 4, from: [z.x + 0.45, 1.6, z.z + 1.25], to: [z.x + 0.3, 1.6, z.z + 0.95], look: [z.x, 1.57, z.z - 0.2], voice: 'z_end2', text: '— Саша?.. Нет. Нет, Саши у нас не было. Или был?' },
      { dur: 3.5, from: [d.x + 1.2, 0.5, d.z + 1.2], to: [d.x + 0.8, 0.6, d.z + 0.8], look: [d.x, 0.75, d.z], voice: 'h_end', text: 'Саша. Кто такой Саша?', on: () => sound.bark() },
      { dur: 4, from: [48, 2.2, 15], to: [54, 1.7, 17], look: [AREA.maxX, 2.5, 18], text: 'Стена помех дрожит.' },
      { dur: 4.5, from: [54, 1.7, 17], to: [56.5, 1.7, 18], look: [70, 2, 18], title: 'КОНЕЦ ПЕРВОЙ ГЛАВЫ', text: 'И город отступает.', on: () => { st.free = true; applyChapter(); sound.pickup(); } },
    ], () => { zoyaHome(); player.pos = { x: ZDOOR.x, z: ZDOOR.z + 2 }; commit({ free: true }); hud(); toast('Город открыт. Вторая глава — в следующих сериях, а пока можно идти куда угодно.', 9); });
  };
  $('skip').onclick = () => cine.skip();

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
      if (s.kind === 'bed' && !(revealed(st, s.home!) && isNight(st.tod) && !siege)) continue;
      const dx = s.at.x - player.pos.x, dz = s.at.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bd && (d < 0.6 || (dx * f.x + dz * f.z) / d > 0.35)) { bd = d; best = s; }
    }
    return best;
  };
  const VERB: Record<string, string> = { bowl: 'поставить миску у порога', key: 'открыть ключом', bino: 'посмотреть в глазок через бинокль', metro: 'завести метроном' };
  const spotLabel = (s: Spot): string => {
    if (s.kind === 'note') return `${s.photo ? 'посмотреть' : 'прочитать'}: ${s.title.toLowerCase()}`;
    if (s.kind === 'loot') return `взять: ${s.title}`;
    if (s.kind === 'bed') return 'переждать ночь';
    if (s.kind === 'talk') return 'поговорить с Зоей';
    if (s.kind === 'bench') return 'верстак: улучшить оружие';
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
    card(h.memory.title, h.memory.text, 'memory', `m_${home}`);
  };
  const useSpot = (s: Spot) => {
    if (s.kind === 'note') { sound.click(); const first = !!s.photo && !photoSaid; if (first) photoSaid = true; card(s.title, s.text, 'note', first ? 'h_photo' : undefined, s.photo); return; }
    if (s.kind === 'talk') { talkZoya(); return; }
    if (s.kind === 'bed') {
      // В доме, который вспомнили, ночью безопасно: можно дождаться утра.
      enemies.clear();
      st.tod = 0.27;
      st.vit = { ...st.vit, food: Math.max(0, st.vit.food - 12), water: Math.max(0, st.vit.water - 15), hp: Math.min(100, st.vit.hp + 25) };
      checkpoint = { ...player.pos };
      flashT = 1;
      commit({});
      toast('Утро. Тузик всю ночь лежал у двери.', 5);
      return;
    }
    if (s.kind === 'bench') {
      const need = arms.hasAxe && !st.axeLvl ? 3 : arms.hasGun && !st.gunLvl ? 4 : 0;
      if (!need) { toast(arms.hasAxe || arms.hasGun ? 'Здесь больше нечего улучшать.' : 'Верстак Гены. Улучшать пока нечего — нужно оружие.', 4); return; }
      if (st.parts < need) { toast(`Не хватает деталей: нужно ${need}, есть ${st.parts}. Ищи в ящиках, гаражах и мастерских.`, 5); return; }
      const axe = arms.hasAxe && !st.axeLvl;
      commit(axe ? { parts: st.parts - need, axeLvl: 1 } : { parts: st.parts - need, gunLvl: 1 });
      sound.pickup();
      toast(axe ? 'Топор заточен и насажен заново: бьёт в полтора раза сильнее.' : 'Автомат вычищен и смазан: бьёт сильнее.', 5);
      return;
    }
    if (s.kind === 'loot') {
      if (s.mesh) s.mesh.visible = false;
      const k = s.loot!;
      const loot = [...st.loot, s.id];
      if (k === 'food') commit({ loot, food: st.food + 1 });
      else if (k === 'water') commit({ loot, water: st.water + 1 });
      else if (k === 'ammo') { arms.ammo += 15; commit({ loot }); }
      else if (k === 'parts') commit({ loot, parts: st.parts + 1 });
      else { arms.give(k); if (k === 'gun') arms.ammo += 30; commit({ loot }); }
      sound.click();
      if (k === 'axe') sound.say('h_axe');
      toast(k === 'axe' ? `Топор. ${input.touch ? 'Кнопка ⚔' : 'Левая кнопка мыши или пробел'} — ударить.`
        : k === 'gun' ? 'Автомат и 30 патронов. Патроны береги: копий по ночам много.'
          : k === 'ammo' ? 'Патроны: +15.' : k === 'parts' ? `Детали: ${st.parts}. Пригодятся на верстаке в мастерской.` : `В сумке: ${s.title}. ${input.touch ? 'Кнопки 🥫 и 💧' : 'Клавиши 1 и 2'} — поесть и попить.`, 5);
      return;
    }
    if (s.kind === 'item') {
      const it = itemOf(s.id)!;
      if (!canTake(st, it)) { toast('В руках уже есть вещь. Сначала верни её хозяину.', 4); return; }
      homes.hideItem(s.id);
      commit({ taken: [...st.taken, s.id], hold: s.id });
      sound.click();
      sound.say(`h_${s.id}`);
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
    const raw = clock.getDelta();
    const dt = Math.min(0.05, raw);
    t += dt;
    const look = input.frame();
    const portrait = input.touch && innerHeight > innerWidth;
    $('rotate').style.display = portrait ? 'flex' : 'none';
    const playing = mode === 'play' && !portrait;
    const night = isNight(st.tod);
    let zoom = false;
    if (playing) {
      playT += dt;
      // Первые секунды игры меряем скорость: если кадров мало — переходим на обычное качество.
      if (high && !chosen && probeN >= 0) {
        probeT += raw; probeN++;
        if (probeT > 5) { if (probeN / probeT < 26) { high = false; applyQuality(); toast('Качество понижено, чтобы игра шла плавно. Вернуть можно в паузе.', 5); } probeN = -1; }
      }
      st.tod = advanceClock(st.tod, dt);
      // Оборона двора: ночь стоит, пока не выйдет время.
      if (siege) {
        st.tod = 0;
        siege.left -= dt;
        if (siege.left <= 0) { siege = null; enemies.clear(); st.tod = 0.27; st.vit = { ...st.vit, hp: Math.max(st.vit.hp, 60) }; playEnding(); }
      }
      if (input.hit('KeyF')) { player.flashlightOn = !player.flashlightOn; sound.click(); }
      player.flashPower = 1 - daylight(st.tod) * 0.8;
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
      const yardHome = !st.met || (allFound() && !st.free) ? 'zoya' : yardGoal(st);
      let goal: Vec2 | null = yardHome ? homes.door(yardHome) : null;
      if (goal && Math.hypot(goal.x - player.pos.x, goal.z - player.pos.z) < 7) goal = null;
      else if (!yardHome) goal = memories.filter((m) => !m.found).sort((a, b) => Math.hypot(a.at.x - player.pos.x, a.at.z - player.pos.z) - Math.hypot(b.at.x - player.pos.x, b.at.z - player.pos.z))[0]?.at ?? null;
      dog.update(dt, t, player.pos, fwd, goal, 90, world.boxes);
      if (dog.barked) sound.bark();
      if (night && !siege) { shooter.update(dt, player.pos, fwd, world.lamps, Math.max(1, st.nights)); if (shooter.appeared) sound.sting(); } else shooter.mesh.visible = false;
      // Зоя поворачивается к тому, кто вошёл.
      const zd = Math.hypot(player.pos.x - zoya.root.position.x, player.pos.z - zoya.root.position.z);
      if (zd < 7) { const want = Math.atan2(player.pos.x - zoya.root.position.x, player.pos.z - zoya.root.position.z); let dy = want - zoya.root.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; zoya.root.rotation.y += dy * Math.min(1, dt * 3); }
      if (player.stride - stepAt > (input.run ? 1.1 : 0.8)) { stepAt = player.stride; sound.step(); }

      // Оружие.
      if (input.hit('KeyX')) { arms.swap(); sound.click(); hud(); }
      const ev = arms.update(dt, input.fire);
      if (ev === 'swing') { sound.swing(); if (enemies.hit(player.pos, fwd, WEAPON.axeRange, 0.5, WEAPON.axeDmg * (st.axeLvl ? 1.5 : 1), world.boxes)) sound.thud(); }
      else if (ev === 'shot') { sound.shot(); if (enemies.hit(player.pos, fwd, WEAPON.gunRange, 0.994, WEAPON.gunDmg * (st.gunLvl ? 1.5 : 1), world.boxes)) sound.thud(); hud(); }
      else if (ev === 'empty') { sound.dry(); if (arms.hasAxe) { arms.cur = 'axe'; hud(); } toast('Патроны кончились.', 2.5); }

      // Ночные копии.
      const tick = enemies.update(dt, { t, player: player.pos, fwd, running: input.run && player.moving, flash: player.flashlightOn, night, indoors, dog: dog.pos, boxes: world.boxes, nooks: world.nooks, area: st.free ? null : AREA, siege: !!siege });
      if (tick.damage) { st.vit = hurt(st.vit, tick.damage); hitT = 1; sound.pain(); }
      if (tick.screamed) sound.scream();
      if (night && !wasNight) st.nights++;
      wasNight = night;
      heartT -= dt;
      if (tick.near && heartT <= 0) { heartT = st.vit.hp < 40 ? 0.6 : 0.95; sound.heart(); }
      sound.setNight(night ? (tick.near ? 1 : 0.45) : 0);
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
      if (night && !st.nightSeen && !noCine) { st.nightSeen = true; playNight(); }
      else if (night && !nightTold) { nightTold = true; toast('Ночь. Город лепит копии из тех, кого стёр.\nОни идут на звук шагов. В дома не заходят.', 8); }
      if (!night) nightTold = false;

      // Стирание: ночью сильнее.
      const dDog = Math.hypot(dog.pos.x - player.pos.x, dog.pos.z - player.pos.z);
      pressure = stepErasure(pressure, dt * (night && dDog > CFG.safe ? 1.5 : 1), dDog);
      if (!st.free && !inArea(player.pos, 1.2) && inArea(player.pos, -1) && t - edgeT > 15) { edgeT = t; toast('Дальше стёрто. Пока двор не вспомнит своих, город не пустит.', 5); }
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
    // Цель — одной строкой сверху.
    const holdIt = st.hold ? itemOf(st.hold) : null, nextHome = yardGoal(st);
    const goalNow = st.free ? 'Город открыт. Вторая глава — скоро'
      : siege ? 'Продержись до рассвета'
        : !st.met ? 'Иди за Тузиком: во втором доме кто-то есть'
          : holdIt ? `Верни вещь хозяину: ${holdIt.name} → дом ${homeOf(holdIt.owner).num}`
            : nextHome ? `Найди вещь в доме ${homeOf(nextHome).num}`
              : allFound() ? (arms.hasAxe ? 'Поговори с Зоей' : 'Возьми топор в пне во дворе') : 'Осмотри двор: Тузик что-то чует';
    if (goalNow !== goalText) { goalText = goalNow; $('goal').textContent = goalNow; }
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
    $('clock').textContent = siege ? `☾ до рассвета ${Math.floor(Math.max(0, siege.left) / 60)}:${String(Math.floor(Math.max(0, siege.left) % 60)).padStart(2, '0')}` : `${daylight(st.tod) < 0.25 ? '☾' : '☀'} ${clockText(st.tod)}`;
    sound.setPressure(p);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = '0'; }

    animateMemories(memories, t);
    world.setTime(st.tod);
    world.update(t, cine.active ? cine.cam.position : player.camera.position);
    homes.update(t);
    murka.visible = revealed(st, 'zoya');
    if (murka.visible) {
      (murka.userData.tail as THREE.Mesh).rotation.z = Math.sin(t * 2.2) * 0.5;
      if (!murkaSaid && mode === 'play' && Math.hypot(player.pos.x - murka.position.x, player.pos.z - murka.position.z) < 3) { murkaSaid = true; sound.say('h_murka'); toast('Мурка ест из своей миски.', 4); }
    }
    cine.update(dt);
    zoya.update(dt);
    if (shooter.mesh.visible) shooterBody.update(dt);
    renderer.render(world.scene, cine.active ? cine.cam : player.camera);
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
    start: startGame, cine, playIntro, playNight, playEnding, talkZoya, zoya,
    get siege() { return siege; }, setSiegeLeft(v: number) { if (siege) siege.left = v; },
    setQuality(h: boolean) { high = h; applyQuality(); },
  };
}

void boot();
