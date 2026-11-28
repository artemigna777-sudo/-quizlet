/** Главный цикл: меню → игра → записка / воспоминание / стирание. Прогресс хранится на устройстве. */
import * as THREE from 'three';
import { buildApartments, APARTMENTS, ENTRANCE, TAPE_DECK, TAPE_DOOR, type ApartmentClimb } from './apartments';
import { Sound } from './audio';
import { Ballistics } from './ballistics';
import { Cine, type Shot } from './cine';
import { Arms, Enemies, WEAPON } from './combat';
import { CFG, type Vec2 } from './config';
import { Dog } from './dog';
import { canvasTex } from './gfx';
import { HeroBody } from './hero';
import { buildHomes, type Spot } from './homes';
import { HOUSE12, HOUSE12_ID, TAPE_LINE, house12Objective, house12SpotVisible, readHouse12Progress } from './house12';
import { Input } from './input';
import { clearWalk, stepErasure } from './logic';
import { animateMemories, buildMemories, type Memory } from './memories';
import { drawNotebook } from './notebook';
import { buildPlaces } from './places';
import { loadPeople } from './people';
import { photoCanvas } from './photos';
import { Player } from './player';
import { Shooter } from './shooter';
import { buildSeasonWorld } from './season2-world';
import { advanceSeason, canUseSeasonSpot, readSeasonProgress, WORKSHOP, WORKSHOP_ENTRY, DEPOT, DEPOT_ENTRY, DISPATCH, DISPATCH_ENTRY, seasonCheckpoint, seasonObjective, seasonTarget, SPOT_ACTION, SEASON_POINTS, type SeasonEvent, type SeasonProgress, type SeasonSpot } from './season2';
import { KNOCK_PATTERN, KNOCK_WINDOWS, TAP_TIMEOUT, knockFits, radioInTune, radioStrength, RADIO_LOCK_MS } from './signal';
import { HOMES, canReveal, canTake, homeOf, itemOf, memId, revealed, yardGoal, type YardState } from './story';
import { SURV, advanceClock, clockText, daylight, drink, eat, grayOf, hurt, isNight, stepVitals, type Vitals } from './survival';
import { VOICE_DUR } from './voicedur';
import { AREA, buildWorld, inArea } from './world';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const REPLAY_KEY = `${CFG.saveKey}:season2-replay`;
const replaying = new URLSearchParams(location.search).get('replay') === '2';
const saveKey = replaying ? REPLAY_KEY : CFG.saveKey;
type Mode = 'menu' | 'play' | 'card' | 'erased' | 'pause' | 'peek' | 'cine' | 'map' | 'climb';
interface Save extends YardState { loot: string[]; food: number; water: number; ammo: number; axe: boolean; gun: boolean; vit: Vitals; tod: number; parts: number; axeLvl: number; gunLvl: number; intro: boolean; nightSeen: boolean; free: boolean; met: boolean; zstage: number; nights: number; chapter2: number; season: SeasonProgress }
const FRESH: Save = { found: [], taken: [], hold: null, loot: [], food: 0, water: 0, ammo: 0, axe: false, gun: false, vit: { hp: 100, food: 80, water: 75 }, tod: SURV.startTime, parts: 0, axeLvl: 0, gunLvl: 0, intro: false, nightSeen: false, free: false, met: false, zstage: 0, nights: 0, chapter2: 0, season: readSeasonProgress(null) };

function loadSave(key = saveKey): Save {
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const num = (v: unknown, d: number, max = 999) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(max, v)) : d);
  try {
    const raw = localStorage.getItem(key);
    if (key === REPLAY_KEY && raw === null) {
      const original = loadSave(CFG.saveKey);
      if (original.free) return {
        ...original,
        chapter2: HOUSE12.entrance,
        season: readSeasonProgress(null),
        vit: { hp: Math.max(75, original.vit.hp), food: Math.max(65, original.vit.food), water: Math.max(65, original.vit.water) },
      };
    }
    const v = JSON.parse(raw ?? '{}');
    const taken = strs(v.taken).filter((id) => itemOf(id));
    return {
      found: strs(v.found), taken, hold: typeof v.hold === 'string' && taken.includes(v.hold) ? v.hold : null, loot: strs(v.loot),
      food: num(v.food, 0, 99), water: num(v.water, 0, 99), ammo: num(v.ammo, 0), axe: v.axe === true, gun: v.gun === true,
      vit: { hp: Math.max(20, num(v.vit?.hp, 100, 100)), food: num(v.vit?.food, 80, 100), water: num(v.vit?.water, 75, 100) }, tod: num(v.tod, SURV.startTime, 0.9999),
      parts: num(v.parts, 0, 99), axeLvl: num(v.axeLvl, 0, 1), gunLvl: num(v.gunLvl, 0, 1), intro: v.intro === true, nightSeen: v.nightSeen === true, free: v.free === true, met: v.met === true, zstage: num(v.zstage, 0, 4), nights: num(v.nights, 0, 99), chapter2: readHouse12Progress(v.chapter2), season: readSeasonProgress(v.season),
    };
  } catch { return structuredClone(FRESH); }
}
function save(s: Save) { try { localStorage.setItem(saveKey, JSON.stringify(s)); } catch { /* приватный режим */ } }

async function boot() {
  await Promise.allSettled([document.fonts.load('700 54px Caveat'), document.fonts.load('20px Russo')]);

  const canvas = $<HTMLCanvasElement>('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: matchMedia('(pointer: coarse)').matches ? 'low-power' : 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const world = buildWorld();
  const player = new Player();
  const dog = new Dog();
  const shooter = new Shooter();
  const input = new Input(canvas, $('stick'));
  const sound = new Sound();
  const ballistics = new Ballistics(world.scene, world.facades);
  const arms = new Arms(player.camera);
  const cine = new Cine({ root: $('cine'), sub: $('cineSub'), title: $('cineTitle') }, (id, onEnd) => sound.say(id, onEnd));
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
  const seasonActive = () => st.free && st.chapter2 === HOUSE12.answered;
  const spawn = seasonActive() ? seasonCheckpoint(st.season) : st.free && st.chapter2 >= HOUSE12.entrance ? ENTRANCE : START;
  if (spawn !== START) {
    player.pos = { ...spawn }; player.yaw = 0;
    dog.place({ x: spawn.x - 0.35, z: spawn.z + 0.8 }, world.boxes);
  }
  let found = [...st.found];
  const startBtn = $<HTMLButtonElement>('start');
  const [homes, makePerson] = await Promise.all([
    buildHomes(world.scene, world.boxes, ballistics, (k) => { startBtn.textContent = `ЗАГРУЗКА ${Math.round(k * 100)}%`; }),
    loadPeople(),
  ]);
  const [apartments, seasonWorld] = await Promise.all([
    buildApartments(world.scene, world.boxes, ballistics),
    buildSeasonWorld(world.scene, world.boxes, ballistics),
  ]);
  apartments.setProgress(st.chapter2);
  seasonWorld.setProgress(st.season);
  const places = await buildPlaces(world.scene, world.boxes, world.lootSites, ballistics);
  const hero = new HeroBody(makePerson('josh'));
  world.scene.add(hero.root);
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
  murka.scale.setScalar(1.6);
  murka.position.set(-10.3, 0.05, 12.05);
  murka.rotation.y = -0.6;
  murka.visible = false;
  world.scene.add(murka);
  const zoya = makePerson('zoya');
  zoya.play('idle');
  world.scene.add(zoya.root);
  world.boxes.push({ minX: -7.65, maxX: -7.15, minZ: 9.35, maxZ: 9.85 });
  const spots: Spot[] = [...homes.spots, ...places.spots, ...apartments.spots, ...seasonWorld.spots, { id: 'talk:zoya', kind: 'talk', room: 'A', at: { x: -7.4, z: 9.6 }, title: 'Тётя Зоя', text: '', mesh: null }];
  startBtn.textContent = st.intro || st.free ? 'ПРОДОЛЖИТЬ' : 'ИГРАТЬ';
  startBtn.disabled = false;
  HOMES.filter((h) => revealed(st, h.id)).forEach((h) => homes.reveal(h.id));
  st.taken.forEach((id) => homes.hideItem(id));
  spots.filter((s) => s.kind === 'loot' && st.loot.includes(s.id)).forEach((s) => { if (s.mesh) s.mesh.visible = false; });
  arms.hasAxe = st.axe; arms.hasGun = st.gun; arms.ammo = st.ammo;
  arms.cur = st.gun && st.ammo > 0 ? 'gun' : st.axe ? 'axe' : st.gun ? 'gun' : 'none';
  let saveT = 0;
  const commit = (next: Partial<Save>) => { st = { ...st, ...next, ammo: arms.ammo, axe: arms.hasAxe, gun: arms.hasGun }; found = [...st.found]; save(st); hud(); };
  const allMemories: Memory[] = buildMemories(world.scene, found);
  const lightMemoryWindow = (at: Vec2) => ballistics.register(world.lightWindow(at));
  allMemories.filter((m) => m.found).forEach((m) => lightMemoryWindow(m.at));
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
  let checkpoint: Vec2 = spawn;
  let playT = 0;
  let stepAt = 0;
  let warned = false;
  let near: Memory | null = null;
  let spot: Spot | null = null;
  let climbTarget: ApartmentClimb | null = null;
  let climbing: { target: ApartmentClimb; from: Vec2; floor: number; elapsed: number } | null = null;
  let flashT = 0;
  let hitT = 0;
  let toastT = 0;
  let peek: { t: number; home: 'tema' } | null = null;
  let nightTold = false;
  let hungerTold = 0;
  let growlT = 0;
  let loudT = 0;
  let depotScared = false;
  let drops = 0;
  let edgeT = -99;
  let heartT = 0;
  let wasNight = false;
  let goalText = '';
  let photoSaid = false;
  let murkaSaid = false;
  let currentGoal: Vec2 | null = null;

  // Качество: «высокое» — чётче и с тенями, «обычное» — для слабых телефонов. Игра сама понижает его, если тормозит.
  const QKEY = 'erased-town:quality';
  let chosen: string | null = null;
  try { chosen = localStorage.getItem(QKEY); } catch { /* приватный режим */ }
  let high = chosen === 'high' || (!input.touch && chosen !== 'low');
  let probeT = 0, probeN = 0;
  world.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m.material instanceof THREE.MeshBasicMaterial)) { m.castShadow = true; m.receiveShadow = true; }
  });
  const applyQuality = () => {
    renderer.shadowMap.enabled = high;
    world.setShadows(high);
    world.setBudget(!high);
    player.setShadows(high);
    $('quality').textContent = `КАЧЕСТВО: ${high ? 'ВЫСОКОЕ' : 'ОБЫЧНОЕ'}`;
    resize();
  };
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    const k = Math.max(1, Math.min(w, h) / (high ? 480 : input.touch ? 235 : CFG.pixels));
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
    const held = it?.name ?? (st.chapter2 === HOUSE12.tape ? 'Кассета' : '');
    $('hold').style.display = held ? 'block' : 'none';
    $('holdName').textContent = held;
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
  let knockAttempt: { taps: number[]; done: () => void } | null = null;
  let tuning: { entered: number | null; done: () => void } | null = null;
  const closeInstruments = () => {
    if (tuning) sound.radio(null);
    knockAttempt = null;
    tuning = null;
    $('knocker').hidden = true;
    $('tuner').hidden = true;
    $('cardOk').textContent = 'ДАЛЬШЕ';
  };
  const card = (title: string, text: string, kind: 'note' | 'memory', voice?: string, photo?: string) => {
    closeInstruments();
    $('seasonChoices').hidden = true;
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
    show('menu', m === 'menu'); show('card', m === 'card'); show('erased', m === 'erased'); show('pause', m === 'pause'); show('map', m === 'map');
    if (m === 'play') input.lock(); else if (m !== 'peek' && m !== 'cine' && m !== 'climb') document.exitPointerLock?.();
  };
  $('help').textContent = input.touch
    ? 'Слева — идти, справа — смотреть. Держи телефон горизонтально.'
    : 'WASD — идти, мышь — смотреть, Shift — бежать, M — блокнот, F — фонарик, Q — ладонь, E — действие, ЛКМ или пробел — удар, X — сменить оружие, 1 — поесть, 2 — попить, Esc — пауза.';
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (input.touch && !standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) $('ios').style.display = 'block';
  $('reset').style.display = found.length || st.taken.length || st.loot.length ? 'block' : 'none';
  $('replayLabel').hidden = !replaying;
  $('replaySeason').hidden = !replaying && !st.free;
  $('replaySeason').textContent = replaying ? 'Основное сохранение' : 'Переиграть сезон 2';
  $('replaySeason').onclick = () => {
    const next = new URL(location.href);
    if (replaying) next.searchParams.delete('replay'); else next.searchParams.set('replay', '2');
    location.assign(next.href);
  };
  hud();

  const startGame = () => {
    sound.start();
    sound.preloadVoices(input.touch ? ['h_intro1', 'h_intro2', 'h_wall'] : Object.keys(VOICE_DUR));
    if (input.touch) { void document.documentElement.requestFullscreen?.().then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape')).catch(() => {}); }
    if (!st.intro && !st.free && !noCine) { st.intro = true; input.lock(); playIntro(); return; }
    setMode('play');
    if (playT === 0) toast(seasonActive() ? seasonObjective(st.season) : spawn === ENTRANCE ? 'Ты снова у дома 12.' : 'Ты не помнишь, кто ты.', 3.5);
  };
  $('start').onclick = startGame;
  if (replaying) $('reset').textContent = 'Начать повтор заново';
  $('reset').onclick = () => {
    if (replaying) {
      try { localStorage.removeItem(REPLAY_KEY); } catch { /* приватный режим */ }
    } else save(structuredClone(FRESH));
    location.reload();
  };
  $('resume').onclick = () => setMode('play');
  $('returnMenu').onclick = () => {
    commit({});
    startBtn.textContent = 'ПРОДОЛЖИТЬ';
    $('replaySeason').hidden = !replaying && !st.free;
    setMode('menu');
  };
  $('cardOk').onclick = () => {
    closeInstruments();
    sound.say(null);
    setMode('play');
    if (!st.free && found.length >= memories.length + HOMES.length) toast('Во всех окнах двора горит свет. Зоя зовёт.', 7);
  };
  $('again').onclick = () => {
    player.pos = { ...checkpoint };
    player.floor = 0;
    dog.floor = 0;
    dog.place(checkpoint);
    pressure = 0;
    enemies.clear();
    if (siege) siege.left = SIEGE;
    commit({ vit: { hp: siege ? 80 : 60, food: Math.max(st.vit.food, 35), water: Math.max(st.vit.water, 35) } });
    setMode('play');
  };
  $('bLight').onclick = () => input.press('KeyF');
  $('bAct').onclick = () => input.press('KeyE');
  let mapDistrict = false;
  const yardHomes = HOMES.map((home) => {
    const door = homes.door(home.id);
    const z = Math.sign(door.z) * 8;
    return {
      name: `Дом ${home.num}`, door, at: { x: door.x, z },
      box: { minX: door.x - 5, maxX: door.x + 5, minZ: z - 5, maxZ: z + 5 },
    };
  });
  const mapFootprints = [...world.footprints, ...seasonWorld.footprints, ...yardHomes.map((h) => h.box),
    { minX: APARTMENTS.x - 9, maxX: APARTMENTS.x + 9, minZ: APARTMENTS.z - 6, maxZ: APARTMENTS.z + 6 }];
  const drawMap = () => {
    const landmarks = [...yardHomes];
    const other = st.free ? [
      { name: 'Дом 12', at: APARTMENTS, door: ENTRANCE },
      { name: 'Мастерская', at: WORKSHOP, door: WORKSHOP_ENTRY },
      { name: 'Депо', at: DEPOT, door: DEPOT_ENTRY },
      { name: 'Диспетчерская', at: DISPATCH, door: DISPATCH_ENTRY },
    ] : [];
    const target = seasonActive() ? seasonTarget(st.season) : null;
    const goal = target ? SEASON_POINTS[target] : st.free && !seasonActive()
      ? (apartments.target(st.chapter2)?.at ?? currentGoal)
      : currentGoal;
    drawNotebook($<HTMLCanvasElement>('mapCanvas'), {
      player: player.pos, forward: player.forward(), dog: dog.pos, goal, free: st.free,
      district: mapDistrict, footprints: mapFootprints, landmarks: [...landmarks, ...other],
    });
    $('mapScale').textContent = mapDistrict ? 'Приблизить' : 'Показать путь';
    $('mapGoal').textContent = seasonActive() ? seasonObjective(st.season) : goalText;
  };
  const openMap = () => {
    mapDistrict = false;
    setMode('map');
    drawMap();
  };
  $('mapScale').onclick = () => { mapDistrict = !mapDistrict; drawMap(); };
  $('bMap').onclick = openMap;
  $('mapOk').onclick = () => setMode('play');
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
  const persistOnExit = () => {
    if (mode !== 'menu') save({ ...st, ammo: arms.ammo, axe: arms.hasAxe, gun: arms.hasGun });
  };
  addEventListener('pagehide', persistOnExit);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { if (tuning) readDial(); return; }
    persistOnExit();
    if (knockAttempt) knockAttempt.taps.length = 0;
    if (tuning) { tuning.entered = null; sound.radio(null); }
    if (mode === 'play') setMode('pause');
  });
  document.addEventListener('pointerdown', () => { if (mode !== 'menu') sound.start(); });

  // ───────── Сценки ─────────
  const run = (shots: Shot[], after: () => void) => { setMode('cine'); cine.play(shots, () => { setMode('play'); after(); }); };
  const updateHouse12 = (step: number) => {
    checkpoint = step === HOUSE12.answered ? seasonCheckpoint(st.season) : ENTRANCE;
    apartments.setProgress(step);
    commit({ chapter2: step });
  };
  const playTape = () => {
    const { x, z } = TAPE_DECK, door = TAPE_DOOR;
    run([
      { dur: 2.5, from: [x + 0.95, 7.45, z + 0.85], to: [x + 0.65, 7.12, z + 0.55], look: [x, 6.85, z], title: 'МАГНИТОФОН № 2619', text: 'На записи — три удара. За стеной кто-то повторяет первые два.', on: () => { sound.cassette(); sound.knock([0.26, 0.5, 1.18], true); sound.knock([0, 0.24], true, 1.7); } },
      { dur: 6.5, from: [x + 0.65, 7.12, z + 0.55], look: [x, 6.85, z], title: 'ГОЛОС НА КАССЕТЕ', text: TAPE_LINE, voice: 's2_tape' },
      { dur: 2.0, from: [door.x, 7.60, door.z + 2.15], to: [door.x, 7.60, door.z + 0.75], look: [door.x, 7.2, door.z - 1.4], on: () => { updateHouse12(HOUSE12.room); sound.knock([0.05], true); } },
    ], () => toast('Комната вернулась. На столике возле окна остался конверт.', 5));
  };
  const openKnocker = (title: string, description: string, done: () => void) => {
    card(title, description, 'memory');
    knockAttempt = { taps: [], done };
    $('knocker').hidden = false;
    $('knockInfo').textContent = 'Первый удар запускает шкалу.';
    $('cardOk').textContent = 'ОТОЙТИ';
  };
  $('knockTap').onclick = () => {
    const attempt = knockAttempt;
    if (!attempt || mode !== 'card') return;
    sound.knock([0]);
    const now = performance.now(), count = attempt.taps.length;
    if (count && !knockFits(count - 1, now - attempt.taps[count - 1])) {
      attempt.taps.length = 0;
      $('knockInfo').textContent = 'Ритм сбился. Начни с первого удара.';
      return;
    }
    attempt.taps.push(now);
    if (attempt.taps.length === 3) { attempt.done(); return; }
    $('knockInfo').textContent = count ? '2 из 3. Теперь выдержи паузу.' : '1 из 3. Следующий удар — быстро.';
  };
  $('knockDemo').onclick = () => {
    if (!knockAttempt) return;
    knockAttempt.taps.length = 0;
    $('knockInfo').textContent = 'Слушай два быстрых удара и третий после паузы.';
    sound.knock(KNOCK_PATTERN, true);
  };
  const openTuner = (done: () => void) => {
    card('Приёмник', 'Поворачивай ручку. Когда шум стихнет, удерживай частоту, пока не проявится голос.', 'memory');
    sound.cassette();
    const dial = $<HTMLInputElement>('radioDial');
    dial.value = '10';
    tuning = { entered: null, done };
    $('tuner').hidden = false;
    $('cardOk').textContent = 'ОТОЙТИ';
    readDial();
  };
  const readDial = () => {
    if (!tuning) return;
    const channel = Number($<HTMLInputElement>('radioDial').value);
    $('radioFreq').textContent = channel.toFixed(1).replace('.', ',');
    if (radioInTune(channel)) tuning.entered ??= performance.now();
    else tuning.entered = null;
    const strength = radioStrength(channel), percent = Math.round(strength * 100);
    sound.radio(strength);
    $('radioMeter').style.setProperty('--level', `${percent}%`);
    $('radioMeter').setAttribute('aria-valuenow', String(percent));
    $('radioInfo').textContent = tuning.entered !== null ? 'Есть голос. Удерживай частоту.' : strength > .1 ? 'Слышны обрывки слов.' : 'Только шум.';
  };
  $('radioDial').oninput = readDial;
  const updateInstruments = (now: number) => {
    if (knockAttempt) {
      const taps = knockAttempt.taps;
      const meter = $('knockMeter');
      const band = KNOCK_WINDOWS[taps.length - 1];
      const gap = band ? now - taps[taps.length - 1] : 0;
      meter.style.setProperty('--level', `${Math.min(1, gap / TAP_TIMEOUT) * 100}%`);
      meter.style.setProperty('--band-start', `${band ? band[0] / TAP_TIMEOUT * 100 : 0}%`);
      meter.style.setProperty('--band-width', `${band ? (band[1] - band[0]) / TAP_TIMEOUT * 100 : 0}%`);
      if (band && gap > TAP_TIMEOUT) {
        taps.length = 0;
        $('knockInfo').textContent = 'Труба стихла. Попробуй снова.';
      }
    }
    if (tuning?.entered != null && now - tuning.entered >= RADIO_LOCK_MS) tuning.done();
  };
  const ZP: Vec2 = { x: -7.4, z: 9.6 }; // тётя Зоя стоит у себя на кухне
  const ZDOOR = homes.door('zoya');
  const porchBoots = new THREE.Group();
  const bootLeather = new THREE.MeshLambertMaterial({ color: 0x43392e });
  const bootSole = new THREE.MeshLambertMaterial({ color: 0x29261f });
  for (const [x, size] of [[-.66, 1], [.47, .72]]) {
    for (const side of [-1, 1]) {
      const boot = new THREE.Group();
      boot.position.set(x + side * .105 * size, .035, .46);
      boot.rotation.y = side * .12;
      boot.scale.setScalar(size);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(.13, .034, .28), bootSole);
      const toe = new THREE.Mesh(new THREE.BoxGeometry(.123, .084, .26), bootLeather);
      toe.position.y = .043;
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(.113, .16, .137), bootLeather);
      shaft.position.set(0, .116, -.052);
      boot.add(sole, toe, shaft);
      porchBoots.add(boot);
    }
  }
  porchBoots.position.set(ZDOOR.x, 0, ZDOOR.z);
  porchBoots.visible = seasonActive() && st.season.step === 'complete';
  world.scene.add(porchBoots);
  const addressList = new THREE.Mesh(new THREE.PlaneGeometry(.26, .36), new THREE.MeshLambertMaterial({ map: canvasTex(64, 88, (g) => {
    g.fillStyle = '#d7c399'; g.fillRect(0, 0, 64, 88);
    g.fillStyle = '#735644'; g.fillRect(24, 2, 17, 6);
    g.font = '10px monospace';
    ['12 - 6', '19 - 3', '26 - 4', '44 - 2'].forEach((n, i) => g.fillText(n, 8, 22 + 16 * i));
    g.fillStyle = '#667850'; g.fillText('✓', 47, 22); g.fillText('✓', 47, 54);
  }) }));
  // Указатель на двери появляется после развязки только при публичной передаче.
  addressList.position.set(-1.25, 1.45, -.14);
  addressList.visible = st.season.decision === 'addresses';
  porchBoots.add(addressList);
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
  const kitchenHero = { at: { x: -8.32, z: 11.60 }, toward: ZP };
  // Общий план показывает собеседников, крупный оставляет в кадре лицо Зои.
  const zShot = (voice: string, text: string, close = false): Shot => close
    ? { dur: 3, from: [ZP.x + 0.5, 1.58, ZP.z + 1.5], to: [ZP.x + 0.35, 1.58, ZP.z + 1.25], look: [ZP.x, 1.56, ZP.z], voice, text }
    : { dur: 3, from: [ZP.x + 1.55, 1.56, ZP.z + 2.81], to: [ZP.x + 1.32, 1.55, ZP.z + 2.62], look: [ZP.x - 0.34, 0.88, ZP.z + 0.93], voice, text,
      hero: kitchenHero, on: () => { zoya.root.rotation.y = Math.atan2(kitchenHero.at.x - ZP.x, kitchenHero.at.z - ZP.z); } };
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
    const porchHero = { at: { x: z.x - 0.77, z: z.z + 1.78 }, toward: { x: z.x, z: z.z - 0.2 }, carry: true };
    zoya.root.rotation.y = Math.atan2(porchHero.at.x - z.x, porchHero.at.z - z.z + 0.2);
    run([
      { dur: 4, from: [z.x + 2.54, 1.58, z.z + 5.5], to: [z.x + 1.86, 1.46, z.z + 4.56], look: [z.x - 0.38, 1.02, z.z + 0.62], hero: porchHero, voice: 'z_end1', text: '— Рассвело. Живые. Дай хоть посмотрю на тебя.' },
      { dur: 4, from: [z.x + 0.45, 1.6, z.z + 1.25], to: [z.x + 0.3, 1.6, z.z + 0.95], look: [z.x, 1.57, z.z - 0.2], voice: 'z_end2', text: '— Саша?.. Нет. Нет, Саши у нас не было. Или был?' },
      { dur: 3.5, from: [d.x + 1.2, 0.5, d.z + 1.2], to: [d.x + 0.8, 0.6, d.z + 0.8], look: [d.x, 0.75, d.z], voice: 'h_end', text: 'Саша. Кто такой Саша?', on: () => sound.bark() },
      { dur: 4, from: [48, 2.2, 15], to: [54, 1.7, 17], look: [AREA.maxX, 2.5, 18], text: 'Стена помех дрожит.' },
      { dur: 4.5, from: [54, 1.7, 17], to: [56.5, 1.7, 18], look: [70, 2, 18], title: 'КОНЕЦ ПЕРВОЙ ГЛАВЫ', text: 'И город отступает.', on: () => { st.free = true; applyChapter(); sound.pickup(); } },
    ], () => { zoyaHome(); player.pos = { x: ZDOOR.x, z: ZDOOR.z + 2 }; commit({ free: true }); toast('Глава 2. Тузик тянет к дому 12. Открой блокнот, чтобы свериться с картой.', 8); });
  };
  $('skip').onclick = () => cine.skip();

  const die = (title: string, text: string) => { $('erasedTitle').textContent = title; $('erasedText').textContent = text; sound.erased(); setMode('erased'); };
  const pick = (m: Memory) => {
    m.found = true;
    world.scene.remove(m.mesh);
    lightMemoryWindow(m.at);
    commit({ found: [...st.found, m.id] });
    checkpoint = { ...m.at };
    sound.pickup();
    card(m.title, m.text, 'memory');
  };

  const chooseSeason = (title: string, text: string, options: readonly (readonly [label: string, event: SeasonEvent | null, response: string])[]) => {
    card(title, text, 'memory');
    const list = $('seasonChoices');
    list.replaceChildren();
    list.hidden = false;
    for (const [label, event, response] of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.onclick = () => {
        if (mode !== 'card' || list.hidden) return;
        sound.click();
        if (event === 'addresses' || event === 'signal') {
          openKnocker('Микрофон', 'Линия открыта. Передай семейный ритм в эфир.', () => {
            if (changeSeason(event)) card(title, response, 'memory');
          });
        } else if (event && changeSeason(event)) {
          card(title, response, 'memory', event === 'line-12' ? 's2_line' : undefined);
        } else {
          $('cardText').textContent = response;
          if (event === null && label === 'Линия 3') sound.say('s2_duplicate');
        }
      };
      list.append(button);
    }
  };
  function changeSeason(event: SeasonEvent) {
    const next = advanceSeason(st.season, event);
    if (next === st.season) return false;
    seasonWorld.setProgress(next);
    porchBoots.visible = next.step === 'complete';
    addressList.visible = next.decision === 'addresses';
    checkpoint = seasonCheckpoint(next);
    commit({ season: next });
    return true;
  }
  const finishSeason = () => {
    const sentAddresses = st.season.decision === 'addresses';
    const close = () => card('Сезон 2 пройден', sentAddresses
      ? 'Костя вернулся домой. На двери Зои висит список адресов. У двух номеров стоят галочки. На обороте кто-то вписал адрес радиомастерской. Почерк Лиды. Она говорит, что листа даже не видела.'
      : 'Костя вернулся домой. Зоя оставила дверь приоткрытой и поставила у батареи лишнюю пару тапок. Лида унесла батарейки из приёмника. Когда она закрыла калитку, из динамика донёсся один удар.', 'memory');
    if (st.season.step === 'complete') { close(); return; }
    changeSeason('delivery');
    st.tod = .31;
    commit({});
    const p = SEASON_POINTS.delivery;
    run([
      { dur: 3.9, from: [ZDOOR.x + 2.65, 1.62, ZDOOR.z + 5.65], to: [ZDOOR.x + 1.55, 1.6, ZDOOR.z + 4.78],
        look: [ZDOOR.x - .34, 1.20, ZDOOR.z + .8], title: 'ВО ДВОРЕ СНОВА УТРО',
        hero: { at: p, toward: ZDOOR }, text: 'На крыльце сохнут две пары ботинок. На маленьких ещё не высохла глина из депо.',
        on: () => { zoya.root.position.set(ZDOOR.x, .05, ZDOOR.z - .2); zoya.root.rotation.y = Math.atan2(p.x - ZDOOR.x, p.z - ZDOOR.z + .2); sound.knock([.35, .58, 1.26], true); } },
      { dur: 5.1, from: [ZDOOR.x + .56, 1.68, ZDOOR.z + 1.38], to: [ZDOOR.x + .32, 1.62, ZDOOR.z + 1.14],
        look: [ZDOOR.x, 1.53, ZDOOR.z - .2], voice: 'z_end1', text: 'Зоя: «Рассвело. Живые. Дай хоть посмотрю на тебя».' },
      { dur: 5.2, from: [ZDOOR.x + 1.62, 1.22, ZDOOR.z + 3.1], to: [ZDOOR.x + .94, 1.15, ZDOOR.z + 2.65],
        look: [ZDOOR.x + .35, .52, ZDOOR.z + .42], voice: 's2_home',
        text: 'Лида по рации: «Костя нашёлся. Он спрашивает, выйдет ли Тузик к нему утром. Скажи ему, что выйдет».' },
    ], () => { zoyaHome(); close(); });
  };
  const useSeason = (id: SeasonSpot) => {
    const progress = st.season;
    if (!canUseSeasonSpot(progress, id)) return;
    switch (id) {
      case 'order':
        changeSeason('work-order');
        card('Квитанция из мастерской', 'Лида. Заказ № 2619. «Сначала домой, за Костей. Если двор уже пустой — ждать в автобусе». Время приёма — 07:40. Ниже расписался Костя. В 07:40 Лида ещё ждала его у школы. Она дважды подчеркнула время.', 'note');
        break;
      case 'battery':
        chooseSeason('Один аккумулятор', 'Один провод идёт к лампе над шкафом, другой — к старому приёмнику. Мастер оставил подсказки для обоих случаев.', [
          ['Подать питание на лампу', 'lamp', 'За стеной щёлкнула лампа. В подсобке теперь видно открытый шкаф.'],
          ['Включить приёмник', 'radio', 'Из динамика пошли помехи. На шкале дрогнула стрелка — этот приёмник ещё ловит эфир.'],
        ]);
        break;
      case 'cabinet':
        changeSeason('lamp-log');
        card('Два талона на один голос', '«На первой записи мальчик стучит, на второй мать отвечает. Лента шла одновременно». Под катушками талон водителя. «Автобус № 12 в депо. Сумку Лиды оставил у третьего сиденья». На ленте — след от собачьего зуба.', 'note');
        break;
      case 'receiver': {
        const listen = () => {
          changeSeason('radio-log');
          sound.cassette();
          card('Запись с приёмника', 'Лида: «Это Лида. Если ты на двенадцатой, не называй адрес. Я слышу наш стук, но никто ещё не подошёл к трубе».\n\nНа кожухе приёмника приклеен талон: «Автобус 12. Депо. Сумка у третьего сиденья».', 'memory', 's2_web');
        };
        if (progress.step === 'clue') openTuner(listen);
        else listen();
        break;
      }
      case 'ticket':
        if (changeSeason('ticket')) {
          sound.pickup();
          card('Билет № 12', 'На билете двое взрослых. Поверх второго слова детской рукой написано «КОСТЯ». В окне напротив отражается пассажир, хотя сиденье пустое. Тузик смотрит вперёд, на кабину. За решёткой конторы падает засов.', 'note');
        } else {
          card('Билет № 12', 'Билет на двоих проездом через дом № 12. В графе «багаж» водитель пририсовал собачью лапу.', 'note');
        }
        break;
      case 'office':
        changeSeason('dispatch-key');
        card('Контора депо', 'Утренние рейсы перечёркнуты. У последнего стоит отметка «круг через дом 12». Рядом с ключом от диспетчерской записка: «Если пассажиры потеряются, зови по той же линии, что номер рейса».', 'note');
        break;
      case 'ledger':
        changeSeason('ledger');
        card('Журнал рейсов', 'У Лиды два билета, а в списке только её имя. «Костя, дом 12» вписано её рукой. На соседней странице тот же почерк. Там перечислены чужие квартиры. Всё зачёркнуто, кроме пометки «Последний рейс — линия 12».', 'note');
        break;
      case 'relay':
        chooseSeason('Коммутатор', 'На панели три гнезда. В журнале указана линия, по которой диспетчер вызывал пассажиров последнего рейса.', [
          ['Линия 3', null, 'Диспетчерская. Назовите, пожалуйста, ваш адрес. Я уже знаю вашу улицу.'],
          ['Линия 12', 'line-12', 'Лида: «Сначала я услышала собственный голос. Он называл квартиру за квартирой. Я не успела сказать Косте, чтобы он молчал. Дай ему наш стук. Только стук».'],
          ['Линия 26', null, 'В динамике только ветер. Номер заказа мастера и номер линии — разные числа.'],
        ]);
        break;
      case 'mic':
        chooseSeason('Микрофон', 'Костя ждёт условного стука. В журнале ещё есть адреса других жильцов. Микрофон ловит каждый звук. Что передать?', [
          ['Дать стук и прочитать адреса', 'addresses', 'Костя ответил первым. Потом в эфире отозвался ещё один голос и переспросил свой номер дома. Зоя ждёт во дворе.'],
          ['Дать условный стук для семьи', 'signal', 'Костя повторил стук. Лида ответила: «Я у двери. Можешь открывать». Возвращайся во двор к Зое.'],
        ]);
        break;
      case 'delivery':
        finishSeason();
        break;
    }
  };

  /** Что рядом и перед глазами: записка, вещь, припасы или стёртая дверь. */
  const spotNear = (): Spot | null => {
    const f = player.forward();
    const nextSeasonSpot = seasonActive() ? seasonTarget(st.season) : null;
    let best: Spot | null = null, bd = 1.9;
    for (const s of spots) {
      if (Math.abs((s.elevation ?? 0) - player.floor) > 0.42) continue;
      const house12Spot = s.id.startsWith('chapter2:');
      const workshopSpot = s.id.startsWith('workshop:');
      if (house12Spot && (!st.free || !house12SpotVisible(s.id, st.chapter2))) continue;
      if (workshopSpot && !seasonActive()) continue;
      const seasonSpot = s.kind === 'season';
      if (seasonSpot && (!seasonActive() || !canUseSeasonSpot(st.season, s.id as SeasonSpot))) continue;
      if (s.home && s.room === 'B' && !revealed(st, s.home)) continue;
      if (s.kind === 'item' && st.taken.includes(s.id)) continue;
      if (s.kind === 'loot' && st.loot.includes(s.id)) continue;
      if (s.kind === 'gate' && revealed(st, s.home!)) continue;
      if (s.kind === 'bed' && !(revealed(st, s.home!) && isNight(st.tod) && !siege)) continue;
      const dx = s.at.x - player.pos.x, dz = s.at.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      const primary = s.id === nextSeasonSpot;
      if (d < (primary ? 1.9 : bd) && (d < 0.6 || (dx * f.x + dz * f.z) / d > 0.35)) {
        if (house12Spot || seasonSpot || workshopSpot) {
          // Стол, на котором лежит предмет, не мешает взять его. Стены и стёртая дверь перекрывают взаимодействие.
          const sight = apartments.collision(player.pos, player.floor).filter((b) => s.at.x < b.minX || s.at.x > b.maxX || s.at.z < b.minZ || s.at.z > b.maxZ);
          if (!clearWalk(player.pos, s.at, 0, sight)) continue;
        }
        // Текущая цель важнее соседней улики, которую уже прочитали.
        if (primary) return s;
        bd = d; best = s;
      }
    }
    return best;
  };
  const canPetDog = () => {
    const fwd = player.forward();
    const dx = dog.pos.x - player.pos.x, dz = dog.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    return Math.abs(dog.floor - player.floor) < 0.65 && d < 2.75 && (d < 0.7 || dx * fwd.x + dz * fwd.z > d * 0.45)
      && clearWalk(player.pos, dog.pos, 0, apartments.collision(player.pos, player.floor));
  };
  const VERB: Record<string, string> = { bowl: 'поставить миску у порога', key: 'открыть ключом', bino: 'посмотреть в глазок через бинокль', metro: 'завести метроном' };
  const spotLabel = (s: Spot): string => {
    if (s.kind === 'season') return s.id === 'delivery' && st.season.step === 'complete' ? 'прочитать запись о втором сезоне' : SPOT_ACTION[s.id as SeasonSpot];
    if (s.kind === 'note') return `${s.photo ? 'посмотреть' : 'прочитать'}: ${s.title.toLowerCase()}`;
    if (s.kind === 'tape') return 'взять кассету';
    if (s.kind === 'deck') return st.chapter2 === HOUSE12.tape ? 'вставить кассету' : 'осмотреть магнитофон';
    if (s.kind === 'pipe') return 'подойти к трубе и постучать';
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
    if (s.kind === 'season') { useSeason(s.id as SeasonSpot); return; }
    if (s.id === 'workshop:tape') {
      sound.cassette();
      card(s.title, s.text, 'memory', 's2_duplicate');
      return;
    }
    if (s.kind === 'note') {
      sound.click();
      if (s.id === HOUSE12_ID.ledger && st.chapter2 < HOUSE12.ledger) updateHouse12(HOUSE12.ledger);
      if (s.id === HOUSE12_ID.parcel && st.chapter2 === HOUSE12.room) { updateHouse12(HOUSE12.parcel); sound.pickup(); }
      const first = !!s.photo && !photoSaid;
      if (first) photoSaid = true;
      card(s.title, s.text, 'note', first ? 'h_photo' : undefined, s.photo);
      return;
    }
    if (s.kind === 'tape') {
      updateHouse12(HOUSE12.tape);
      sound.pickup();
      toast('Кассета в пакете с номером 2619. Магнитофон остался в шестой квартире.', 5);
      return;
    }
    if (s.kind === 'deck') {
      if (st.chapter2 === HOUSE12.tape) playTape();
      else if (st.chapter2 >= HOUSE12.room) card('Вкладыш из кассеты', TAPE_LINE, 'note');
      else toast('На корпусе нацарапано «2619». Внутри пусто. Кассету оставили у кровати в третьей квартире.', 6);
      return;
    }
    if (s.kind === 'pipe') {
      if (st.chapter2 === HOUSE12.answered) {
        card('Адрес радиомастерской', 'Вход со двора, за прачечной. Костя сказал, что мастер знает, где их дверь.', 'note');
      } else {
        openKnocker('Труба отопления', 'У трубы остался рисунок из конверта. Две чёрточки рядом, третья отдельно. Костя ждёт ответа.', () => {
          sound.knock(KNOCK_PATTERN, true, .55);
          updateHouse12(HOUSE12.answered);
          card('Костя ответил', 'Из трубы: «Мама у мастера. Он знает, где наша дверь. Вход со двора, за прачечной». Тузик смотрит в окно. В стекле кто-то уже поднял руку для ответа.', 'memory');
        });
      }
      return;
    }
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
  let nextFrameAt = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (document.hidden) { clock.getDelta(); nextFrameAt = 0; return; }
    const portrait = input.touch && innerHeight > innerWidth;
    if (!portrait && mode === 'card') updateInstruments(now);
    const activeView = !portrait && (mode === 'play' || mode === 'cine' || mode === 'peek' || mode === 'climb');
    const interval = activeView ? (input.touch ? 1000 / 30 : 0) : 1000 / 12;
    if (interval > 0 && now + 0.8 < nextFrameAt) return;
    nextFrameAt = interval > 0 && now - nextFrameAt < interval ? nextFrameAt + interval : now + interval;
    const raw = clock.getDelta();
    const dt = Math.min(0.05, raw);
    t += dt;
    const look = input.frame();
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
      player.update(dt, input, look, apartments.collision(player.pos, player.floor), world.half, false, apartments.height);
      const fwd = player.forward();
      const inApartments = apartments.inside(player.pos);
      const indoors = inApartments || homes.inside(player.pos) !== null || places.inside(player.pos) || seasonWorld.inside(player.pos);
      if (st.free && st.chapter2 === HOUSE12.street && Math.hypot(player.pos.x - ENTRANCE.x, player.pos.z - ENTRANCE.z) < 3.6) {
        updateHouse12(HOUSE12.entrance);
        if (!noCine) run([
          { dur: 4.2, from: [ENTRANCE.x + 1.3, 1.55, ENTRANCE.z + 4], to: [ENTRANCE.x + 0.2, 1.55, ENTRANCE.z + 1], look: [ENTRANCE.x, 1.45, ENTRANCE.z - 0.9], title: 'ГЛАВА 2. ДОМ 12', text: 'Из подъезда стучат. Тузик завилял хвостом, как будто узнал кого-то.', on: () => sound.knock([0.3, 0.54], true) },
        ], () => toast('У ящиков записка. Тузика тут уже знали.', 6));
      }

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
      const nextSeasonSpot = seasonActive() ? seasonTarget(st.season) : null;
      if (seasonActive()) goal = nextSeasonSpot ? SEASON_POINTS[nextSeasonSpot] : null;
      else if (st.free) goal = inApartments ? null : ENTRANCE;
      else if (goal && homes.inside(player.pos) === yardHome) goal = null;
      else if (!yardHome) goal = memories.filter((m) => !m.found).sort((a, b) => Math.hypot(a.at.x - player.pos.x, a.at.z - player.pos.z) - Math.hypot(b.at.x - player.pos.x, b.at.z - player.pos.z))[0]?.at ?? null;
      currentGoal = goal;
      if (inApartments && !apartments.onStairs(player.pos) && Math.abs(player.floor - dog.floor) > 2) {
        dog.floor = player.floor;
        const colliders = apartments.collision(player.pos, player.floor);
        const ahead = { x: player.pos.x + fwd.x, z: player.pos.z + fwd.z };
        dog.place(clearWalk(player.pos, ahead, CFG.dogRadius, colliders) ? ahead : player.pos, colliders);
      }
      const target = st.free && inApartments ? apartments.target(st.chapter2) : undefined;
      const guideFloor = target?.elevation ?? 0;
      const localGoal = target && Math.abs(player.floor - guideFloor) < 0.2 && Math.abs(dog.floor - guideFloor) < 0.2 ? target.at : null;
      dog.update(dt, t, player.pos, fwd, inApartments ? localGoal : goal, 90, apartments.collision(dog.pos, dog.floor));
      dog.floor = apartments.height(dog.pos, dog.floor);
      if (dog.barked) sound.bark(Math.hypot(dog.pos.x - player.pos.x, dog.pos.z - player.pos.z));
      if (night && !siege) { shooter.update(dt, player.pos, fwd, world.lamps, Math.max(1, st.nights)); if (shooter.appeared) sound.sting(); } else shooter.mesh.visible = false;
      // Зоя поворачивается к тому, кто вошёл.
      const zd = Math.hypot(player.pos.x - zoya.root.position.x, player.pos.z - zoya.root.position.z);
      if (zd < 7) { const want = Math.atan2(player.pos.x - zoya.root.position.x, player.pos.z - zoya.root.position.z); let dy = want - zoya.root.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; zoya.root.rotation.y += dy * Math.min(1, dt * 3); }
      if (player.stride - stepAt > (input.run ? 1.1 : 0.8)) { stepAt = player.stride; sound.step(); }

      // Оружие.
      const tenseSeason = seasonActive() && st.season.step !== 'complete';
      loudT = Math.max(0, loudT - dt);
      if (input.hit('KeyX')) { arms.swap(); sound.click(); hud(); }
      const ev = arms.update(dt, input.fire);
      if (ev === 'swing' || ev === 'shot') {
        const melee = ev === 'swing';
        if (melee) sound.swing(); else { sound.shot(); loudT = 2; }
        const dir = player.camera.getWorldDirection(new THREE.Vector3());
        const ray = new THREE.Ray(player.camera.position, dir);
        const range = melee ? WEAPON.axeRange : WEAPON.gunRange;
        const wall = ballistics.trace(ray, range, [...world.boxes, ...places.bulletBoxes, ...apartments.bulletBoxes]);
        const hit = melee
          ? player.floor < .5 && enemies.hit(player.pos, fwd, wall.pane ? wall.distance : range, .5, WEAPON.axeDmg * (st.axeLvl ? 1.5 : 1), world.boxes, tenseSeason) ? 0 : null
          : enemies.shoot(ray, wall.distance, WEAPON.gunDmg * (st.gunLvl ? 1.5 : 1));
        const end = ray.at(hit ?? wall.distance, new THREE.Vector3());
        if (!melee) ballistics.fire(arms.muzzle(), end);
        if (hit !== null) sound.thud();
        else if (wall.pane) { ballistics.damage(wall.pane, end, dir); sound.glass(); loudT = Math.max(loudT, .8); }
        hud();
      }
      else if (ev === 'empty') { sound.dry(); if (arms.hasAxe) { arms.cur = 'axe'; hud(); } toast('Патроны кончились.', 2.5); }

      // Ночные копии.
      if (!depotScared && tenseSeason && st.season.step === 'office' && Math.hypot(player.pos.x - SEASON_POINTS.ticket.x, player.pos.z - SEASON_POINTS.ticket.z) < 2.3) {
        depotScared = true;
        enemies.startle({ x: DEPOT.x - 4, z: DEPOT.z - 7.36 });
        sound.scream();
      }
      const tick = player.floor > 0.5 ? { damage: 0, screamed: false, near: false, died: [] } : enemies.update(dt, { t, player: player.pos, fwd, running: input.run && player.moving, flash: player.flashlightOn, night, indoors, dog: dog.pos, boxes: world.boxes, nooks: world.nooks, area: st.free ? null : AREA, siege: !!siege, season: tenseSeason, loud: tenseSeason && loudT > 0 });
      if (tick.damage) { st.vit = hurt(st.vit, tick.damage); hitT = 1; sound.pain(); }
      if (tick.screamed) sound.scream();
      if (night && !wasNight) st.nights++;
      wasNight = night;
      heartT -= dt;
      if (tick.near && heartT <= 0) { heartT = st.vit.hp < 40 ? 0.6 : 0.95; sound.heart(); }
      sound.setNight(tick.near ? 1 : night ? .45 : 0);
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
      if (night && !st.nightSeen && !noCine && !cine.active) { st.nightSeen = true; playNight(); }
      else if (night && !nightTold) { nightTold = true; toast('Ночь. Город лепит копии из тех, кого стёр.\nОни идут на звук шагов. В дома не заходят.', 8); }
      if (!night) nightTold = false;

      // Стирание: ночью сильнее.
      const dDog = Math.hypot(dog.pos.x - player.pos.x, dog.pos.z - player.pos.z);
      pressure = stepErasure(pressure, dt * (night && dDog > CFG.safe ? 1.5 : 1), dDog);
      if (!st.free && !inArea(player.pos, 1.2) && inArea(player.pos, -1) && t - edgeT > 15) { edgeT = t; toast('Дальше стёрто. Пока двор не вспомнит своих, город не пустит.', 5); }
      if (pressure > 0.2 && !warned) { warned = true; toast('Не отходи от Тузика: город стирает тех, кого никто не помнит.', 6); }
      if (pressure >= 1) die('ТЕБЯ СТЁРЛИ', 'Рядом не было никого, кто тебя помнит. Держись ближе к Тузику.');
      else if (st.vit.hp <= 0) die('ТЕБЯ НЕ СТАЛО', tick.damage ? 'Копии не устают. Ночью лучше переждать в доме — или найти, чем отбиваться.' : 'Без еды и воды долго не протянуть. Ищи припасы в домах и в магазине.');

      near = player.floor > 0.5 ? null : memories.find((m) => !m.found && Math.hypot(m.at.x - player.pos.x, m.at.z - player.pos.z) < 2.2) ?? null;
      spot = spotNear();
      climbTarget = st.free ? apartments.traverse(player.pos, player.floor, fwd) : null;
      if (spot?.kind === 'season') near = null;
      else if (near) spot = null;
      if (input.hit('KeyE') && mode === 'play' && !cine.active) {
        if (near) pick(near);
        else if (climbTarget) {
          climbing = { target: climbTarget, from: { ...player.pos }, floor: player.floor, elapsed: 0 };
          sound.step();
          setMode('climb');
        }
        else if (spot) useSpot(spot);
        else if (canPetDog()) { dog.pet(); toast('Ты гладишь Тузика. Он на секунду забывает бояться города.', 3); }
      }
      zoom = st.hold === 'bino' && input.zoom;

      if (!st.free && playT > 4 && playT - dt <= 4) toast(input.touch ? 'Зажми ✋ — посмотри на ладонь.' : 'Зажми Q — посмотри на ладонь.', 4.5);
      if (!st.free && playT > 10 && playT - dt <= 10) toast('Тузик что-то чует. Иди за ним.', 5);
      saveT += dt;
      if (saveT > 5) { saveT = 0; commit({}); }
    } else {
      for (const k of ['KeyE', 'KeyF', 'KeyX', 'Digit1', 'Digit2']) input.hit(k);
      near = null;
      spot = null;
      climbTarget = null;
      if (mode === 'climb' && climbing) {
        const { target, from, floor } = climbing;
        climbing.elapsed += raw;
        const k = Math.min(1, climbing.elapsed / (target.kind === 'ladder' ? 1.18 : .72));
        const ease = k * k * (3 - 2 * k);
        const sideways = target.kind === 'ladder' ? Math.max(0, (k - .3) / .7) : ease;
        player.pos = { x: THREE.MathUtils.lerp(from.x, target.to.x, sideways), z: THREE.MathUtils.lerp(from.z, target.to.z, sideways) };
        player.floor = THREE.MathUtils.lerp(floor, target.floor, ease) + (target.kind === 'window' ? Math.sin(k * Math.PI) * .48 : 0);
        player.update(0, input, look, [], world.half, true);
        if (k >= 1) {
          // Тузик остаётся рядом с лестничным пролётом, пока игрок на балконе.
          if (target.floor === 0 && dog.floor > .5) {
            dog.floor = 0;
            dog.place(target.to, world.boxes);
          }
          climbing = null;
          sound.step();
          setMode('play');
        }
      }
      if (mode === 'peek' && peek) {
        zoom = true;
        player.update(dt, input, { x: Math.sin(t * 1.3) * 0.6, y: Math.cos(t * 1.7) * 0.4 }, world.boxes, world.half, true);
        peek.t -= dt;
        if (peek.t <= 0) { const h = peek.home; peek = null; finishReveal(h); }
      }
    }
    if (input.hit('KeyM')) { if (mode === 'play') openMap(); else if (mode === 'map') setMode('play'); }
    if (input.hit('Escape') && mode === 'play') setMode('pause');

    // Интерфейс.
    const fov = zoom ? 20 : 70;
    if (Math.abs(player.camera.fov - fov) > 0.1) { player.camera.fov += (fov - player.camera.fov) * Math.min(1, dt * 14); player.camera.updateProjectionMatrix(); }
    // Цель — одной строкой сверху.
    const holdIt = st.hold ? itemOf(st.hold) : null, nextHome = yardGoal(st);
    const goalNow = seasonActive() ? seasonObjective(st.season) : st.free ? house12Objective(st.chapter2, apartments.inside(player.pos))
      : siege ? 'Продержись до рассвета'
        : !st.met ? 'Иди за Тузиком: во втором доме кто-то есть'
          : holdIt ? `Верни вещь хозяину: ${holdIt.name} → дом ${homeOf(holdIt.owner).num}`
            : nextHome ? `Найди вещь в доме ${homeOf(nextHome).num}`
              : allFound() ? (arms.hasAxe ? 'Поговори с Зоей' : 'Возьми топор в пне во дворе') : 'Осмотри двор: Тузик что-то чует';
    if (goalNow !== goalText) { goalText = goalNow; $('goal').textContent = goalNow; }
    $('binoMask').style.opacity = zoom ? '1' : '0';
    const nearDog = mode === 'play' && !near && !spot && !climbTarget && canPetDog();
    const label = mode !== 'play' ? '' : near ? `взять: ${near.title.toLowerCase()}` : climbTarget?.label ?? (spot ? spotLabel(spot) : nearDog ? 'погладить Тузика' : '');
    $('prompt').style.display = label ? 'block' : 'none';
    $('promptText').textContent = label ? (input.touch ? label : `E — ${label}`) : '';
    $('bAct').style.display = label && input.touch ? 'flex' : 'none';
    $('bAct').textContent = climbTarget ? 'ЛЕЗТЬ' : nearDog ? 'ГЛАДИТЬ' : near || spot?.kind === 'item' || spot?.kind === 'loot' || spot?.kind === 'tape' ? 'ВЗЯТЬ' : spot?.kind === 'note' ? 'ЧИТАТЬ' : spot?.kind === 'deck' ? 'ПЛЁНКА' : spot?.kind === 'pipe' ? 'СТУК' : spot?.kind === 'season' ? 'ДЕЙСТВИЕ' : 'ДВЕРЬ';
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
    cine.update(raw);
    const cameraPosition = cine.active ? cine.cam.position : player.camera.position;
    world.update(t, cameraPosition);
    seasonWorld.update(cameraPosition, high);
    homes.update(t);
    apartments.update(t, cameraPosition, high);
    ballistics.update(dt);
    murka.visible = revealed(st, 'zoya');
    if (murka.visible) {
      (murka.userData.tail as THREE.Mesh).rotation.z = Math.sin(t * 2.2) * 0.5;
      if (!murkaSaid && mode === 'play' && Math.hypot(player.pos.x - murka.position.x, player.pos.z - murka.position.z) < 3) { murkaSaid = true; sound.say('h_murka'); toast('Мурка ест из своей миски.', 4); }
    }
    hero.update(player, dt, cine.active, cine.heroMark, arms.cur);
    arms.show(!cine.active && (mode === 'play' || mode === 'peek') && !player.readingPalm);
    player.showFlash(!cine.active);
    zoya.update(dt);
    if (shooter.mesh.visible) shooterBody.update(dt);
    renderer.render(world.scene, cine.active ? cine.cam : player.camera);
  };
  player.update(0, input, { x: 0, y: 0 }, world.boxes, world.half, true);
  arms.update(0, false);
  requestAnimationFrame(frame);

  // Для проверок и отладки.
  (window as unknown as Record<string, unknown>).__game = {
    player, hero, dog, world, shooter, homes, enemies, arms, apartments, ballistics, seasonWorld,
    get mode() { return mode; }, get pressure() { return pressure; }, get found() { return found; },
    get st() { return st; }, get spot() { return spot; },
    setTime(v: number) { st.tod = v; }, setVit(v: Partial<Vitals>) { st.vit = { ...st.vit, ...v }; },
    start: startGame, cine, playIntro, playNight, playEnding, talkZoya, zoya,
    openMap,
    get siege() { return siege; }, setSiegeLeft(v: number) { if (siege) siege.left = v; },
    setQuality(h: boolean) { high = h; applyQuality(); },
  };
}

void boot();
