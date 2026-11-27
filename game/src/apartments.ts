import * as THREE from 'three';
import type { Ballistics } from './ballistics';
import { CFG, type Vec2 } from './config';
import { canvasTex, lambert } from './gfx';
import type { Spot } from './homes';
import { HOUSE12, HOUSE12_ID, house12SpotVisible, house12Target } from './house12';
import type { Box } from './logic';
import { loadModel } from './models';

export const APARTMENTS: Vec2 = { x: CFG.pitch, z: -CFG.pitch };
export const ENTRANCE: Vec2 = { x: APARTMENTS.x, z: APARTMENTS.z + 6.9 };
const H = 3, STAIR_START = 1.1, STAIR_TURN = -3.5;
const LOCAL = (p: Vec2) => ({ x: p.x - APARTMENTS.x, z: p.z - APARTMENTS.z });
const AT = (x: number, z: number): Vec2 => ({ x: APARTMENTS.x + x, z: APARTMENTS.z + z });
export const TAPE_DECK = AT(3.44, 1.57);
export const TAPE_DOOR = AT(5.15, 0);

/** Высота на двух маршах с разворотом. Вне лестницы ходим по площадкам. */
export function apartmentHeight(p: Vec2, old: number) {
  const { x, z } = LOCAL(p);
  if (Math.abs(x) >= 9 || Math.abs(z) >= 6.2) return 0;
  if (Math.abs(x) >= 1.92 || z >= STAIR_START) return H * Math.round(old / H);
  const k = Math.min(1, (STAIR_START - z) / (STAIR_START - STAIR_TURN));
  const rise = H / 2 * (x < 0 ? k : 2 - k);
  return Math.max(0, Math.min(1, Math.round((old - rise) / H))) * H + rise;
}

export async function buildApartments(scene: THREE.Scene, worldBoxes: Box[], ballistics: Ballistics) {
  const ids = ['dining_table', 'painted_wooden_chair_01', 'painted_wooden_cabinet', 'vintage_day_bed', 'side_table_01', 'Sofa_01', 'boombox', 'pot_enamel_01', 'electric_stove', 'wooden_bookshelf_worn', 'throw_pillows_01', 'hanging_picture_frame_01', 'wall_clock', 'potted_plant_04'] as const;
  const models = new Map(await Promise.all(ids.map(async (id) => [id, await loadModel(id)] as const)));
  const root = new THREE.Group();
  root.position.set(APARTMENTS.x, 0, APARTMENTS.z);
  scene.add(root);
  const makePattern = (base: string, marks: string, repeat: [number, number], kind: 'brick' | 'hall' | 'wood') => lambert({ map: canvasTex(48, 32, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    c.fillStyle = marks;
    if (kind === 'brick') for (let y = 1; y < h; y += 8) { c.fillRect(0, y, w, 1); for (let x = -12 + (y % 16 === 1 ? 0 : 8); x < w; x += 16) c.fillRect(x, y, 1, 8); }
    if (kind === 'hall') { c.fillRect(0, 19, w, 14); c.fillStyle = '#b8ab8f'; c.fillRect(0, 18, w, 1); }
    if (kind === 'wood') for (let y = 0; y < h; y += 5) { c.fillRect(0, y, w, 1); c.fillRect(y * 7 % w, y, 1, 5); }
    c.fillStyle = 'rgba(15,14,12,.18)';
    for (let i = 0; i < 100; i++) c.fillRect(i * 37 % w, (i * 17 + (i >> 3)) % h, i % 3 + 1, 1);
  }, repeat) });
  const brick = makePattern('#a48b74', '#66534b', [3, 1], 'brick');
  const hall = makePattern('#bcb5a0', '#55706a', [2, 1], 'hall');
  const hallFloor = makePattern('#7b7a72', '#5d5d56', [4, 4], 'wood');
  const parquet = makePattern('#805f42', '#533d32', [5, 5], 'wood');
  const papers = ['#99876a', '#a5a58a', '#998b97', '#8c9c8f', '#b4a084', '#8e8f9e'].map((c) => makePattern(c, '#888477', [3, 1], 'wood'));
  const concrete = lambert({ color: 0x727377 }), metal = lambert({ color: 0x374343 });
  const trim = lambert({ color: 0xc7bba5 }), door = lambert({ color: 0x604433 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xd1b984 });
  const glass = new THREE.MeshBasicMaterial({ color: 0x597584, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  const regions: Box[][] = [[], [], []];
  const solids: Box[] = [];
  const stairRail: Box[] = [];
  const stops: Box[][] = [[], [], []];
  const spots: Spot[] = [];
  const backRoom = new THREE.Group();
  root.add(backRoom);
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material | THREE.Material[]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.receiveShadow = true; root.add(mesh);
    return mesh;
  };
  const collider = (x: number, y: number, z: number, w: number, h: number, d: number): Box => ({ minX: APARTMENTS.x + x - w / 2, maxX: APARTMENTS.x + x + w / 2, minZ: APARTMENTS.z + z - d / 2, maxZ: APARTMENTS.z + z + d / 2, minY: y - h / 2, maxY: y + h / 2 });
  const surface = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], floor?: number) => {
    const mesh = box(x, y, z, w, h, d, mat);
    const b = collider(x, y, z, w, h, d);
    solids.push(b);
    if (floor !== undefined) regions[floor].push(b);
    return mesh;
  };
  const label = (text: string, x: number, y: number, z: number, ry = 0, width = 0.57) => {
    const map = canvasTex(128, 32, (c) => {
      c.fillStyle = '#37484f'; c.fillRect(0, 0, 128, 32); c.strokeStyle = '#a29b81'; c.strokeRect(1, 1, 126, 30);
      c.font = 'bold 19px monospace'; c.fillStyle = '#ece0bb'; c.textAlign = 'center'; c.fillText(text, 64, 23);
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map }));
    mesh.position.set(x, y, z); mesh.rotation.y = ry; root.add(mesh);
  };
  const put = (id: typeof ids[number], x: number, y: number, z: number, floor: number, rot = 0, scale = 1) => {
    const model = models.get(id)!;
    const mesh = model.root.clone(); mesh.position.set(x, y, z); mesh.rotation.y = rot; mesh.scale.setScalar(scale); root.add(mesh);
    const { x: w, z: d, y: h } = model.size;
    if (h * scale > 0.33 && y - floor * H < 0.2) {
      const b = collider(x, y + h * scale / 2, z, scale * (Math.abs(Math.cos(rot) * w) + Math.abs(Math.sin(rot) * d)), h * scale, scale * (Math.abs(Math.sin(rot) * w) + Math.abs(Math.cos(rot) * d)));
      regions[floor].push(b); solids.push(b);
    }
    return mesh;
  };
  const note = (id: string, f: number, x: number, y: number, z: number, title: string, text: string, rx = -Math.PI / 2) => {
    const map = canvasTex(20, 24, (c) => { c.fillStyle = '#e5d8b5'; c.fillRect(0, 0, 20, 24); c.fillStyle = '#526076'; for (let i = 4; i < 22; i += 3) c.fillRect(3, i, 13 - i % 5, 1); });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.31), new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    mesh.position.set(x, f * H + y, z); mesh.rotation.x = rx; root.add(mesh);
    spots.push({ id, kind: 'note', room: 'A', at: AT(x, z), elevation: f * H, title, text, mesh });
    return mesh;
  };
  const windowWall = (y: number, z: number, x: number, f: number, mat: THREE.Material) => {
    const exterior = z > 0 ? [mat, mat, mat, mat, brick, mat] : [mat, mat, mat, mat, mat, brick];
    surface(x, y + 0.55, z, 2, 1.1, 0.24, exterior);
    surface(x, y + 2.68, z, 2, 0.64, 0.24, exterior);
    // Коллизия для ног, а трасса выстрела проходит через реальный проём.
    regions[f].push(collider(x, y + 0.5, z, 2, 1, 0.24));
    for (const s of [-1, 1]) {
      surface(x + s * 0.96, y + 1.72, z, 0.08, 1.25, 0.23, trim);
      surface(x, y + 1.72 + s * 0.6, z, 1.9, 0.065, 0.25, trim);
    }
    surface(x, y + 1.72, z, 0.055, 1.2, 0.2, trim);
    for (const s of [-1, 1]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.91, 1.13), glass);
      pane.position.set(x + s * 0.48, y + 1.72, z); root.add(pane); ballistics.register(pane, true);
    }
  };

  for (let f = 0; f < 3; f++) {
    const y = f * H;
    surface(0, y - 0.085, 3.55, 4, 0.17, 4.9, hallFloor);
    if (f === 0) surface(0, -0.085, -2.45, 4, 0.17, 7.1, hallFloor);
    for (const s of [-1, 1]) {
      const paper = papers[f * 2 + (s > 0 ? 1 : 0)];
      surface(s * 5.5, y - 0.09, 0, 7, 0.18, 12, parquet);
      surface(s * 8.9, y + 1.5, 0, 0.24, 3, 12, [s > 0 ? brick : paper, s < 0 ? brick : paper, brick, brick, brick, brick], f);
      surface(s * 2, y + 1.5, -1.5, 0.19, 3, 9, [s > 0 ? paper : hall, s < 0 ? paper : hall, hall, hall, hall, hall], f);
      surface(s * 2, y + 1.5, 5.15, 0.19, 3, 1.7, hall, f);
      surface(s * 2, y + 2.57, 3.65, 0.19, 0.86, 1.32, hall);
      surface(s * 2.15, y + 1.05, 4.68, 0.09, 2.1, 0.83, door, f);
      label(`КВ. ${f * 2 + (s < 0 ? 1 : 2)}`, s * 1.88, y + 1.48, 4.72, -s * Math.PI / 2);
      // Между прихожей и дальней комнатой оставлен внутренний дверной проём.
      surface(s * 3.25, y + 1.5, 0, 2.5, 3, 0.13, paper, f);
      surface(s * 7.4, y + 1.5, 0, 3.2, 3, 0.13, paper, f);
      surface(s * 5.15, y + 2.65, 0, 1.3, 0.7, 0.13, paper);
      for (const z of [-5.88, 5.88]) {
        windowWall(y, z, s * 6.1, f, paper);
        surface(s * 3.55, y + 1.5, z, 3.1, 3, 0.24, brick, f);
        surface(s * 8.05, y + 1.5, z, 1.9, 3, 0.24, brick, f);
      }
      const variant = f * 2 + (s > 0 ? 1 : 0);
      put('painted_wooden_cabinet', s * 8.35, y, 4.7, f, -s * Math.PI / 2);
      const bed = put(variant % 3 === 0 ? 'Sofa_01' : 'vintage_day_bed', s * 8.19, y, -3.25, f, -s * Math.PI / 2);
      put(variant % 2 ? 'electric_stove' : 'dining_table', s * 6.5, y, 3.5, f, Math.PI / 2);
      put(variant % 2 ? 'potted_plant_04' : 'pot_enamel_01', s * 6.5, y + (variant % 2 ? 0.90 : 0.8), 3.48, f, s, 0.8);
      put(variant % 3 === 1 ? 'painted_wooden_chair_01' : 'side_table_01', s * 7.55, y, 2.4, f, s * 0.45);
      const shelf = put(variant % 2 ? 'wooden_bookshelf_worn' : 'side_table_01', s * 3.0, y, -4.95, f);
      if (variant % 2 === 0) put('boombox', s * 3.0, y + models.get('side_table_01')!.size.y, -4.95, f, 0.2, 0.78);
      const pillows = put('throw_pillows_01', s * 8.19, y + 0.5, -3.65, f, Math.PI / 2, 0.7);
      const wallItem = put(variant % 2 ? 'wall_clock' : 'hanging_picture_frame_01', s * 8.74, y + 1.54, -2.1, f, -s * Math.PI / 2);
      if (f === 2 && s === 1) backRoom.add(bed, shelf, pillows, wallItem);
      box(s * 5, y + 2.86, 2.8, 0.76, 0.05, 0.32, lamp);
    }
    surface(0, y + 1.5, -5.88, 4, 3, 0.24, brick, f);
    if (f === 0) {
      for (const s of [-1, 1]) surface(s * 1.4, y + 1.5, 5.88, 1.2, 3, 0.24, brick, f);
      surface(0, 2.62, 5.88, 1.6, 0.76, 0.24, brick);
    } else surface(0, y + 1.5, 5.88, 4, 3, 0.24, brick, f);
    label(`${f + 1} ЭТАЖ`, 0, y + 1.62, 5.73, Math.PI, 1);
    box(0, y + 2.84, 3.65, 0.86, 0.06, 0.34, lamp);
  }
  surface(0, 9.12, 0, 18.35, 0.24, 12.32, concrete);
  surface(0, 0.02, 6.36, 2.6, 0.11, 1.05, concrete);
  label('ДОМ 12', 0, 2.64, 6.03, 0, 1.9);
  label('ЛЕСТНИЦА ↑', -0.9, 1.52, -2.96, 0, 1.15);
  for (let floor = 0; floor < 2; floor++) {
    const base = floor * H;
    const width = 1.81, count = 10, step = (STAIR_START - STAIR_TURN) / count;
    for (let i = 0; i < count; i++) {
      const z = STAIR_START - (i + 0.5) * step;
      surface(-0.98, base + H * (i + 1) / (2 * count) - 0.105, z, width, 0.21, step + 0.015, concrete);
      surface(0.98, base + H * (2 * count - i) / (2 * count) - 0.105, z, width, 0.21, step + 0.015, concrete);
    }
    surface(0, base + H / 2 - 0.09, -4.69, 3.82, 0.18, 2.39, concrete);
    for (const s of [-1, 1]) {
      const rail = box(0, base + (s < 0 ? 0.75 : 2.25) + 0.86, (STAIR_START + STAIR_TURN) / 2, 0.10, 0.12, 4.84, metal);
      rail.rotation.x = s < 0 ? 0.315 : -0.315;
    }
  }
  for (let i = 0; i < 3; i++) {
    box(0, 0.85 + H * i, -1.14, 0.13, 0.08, 4.5, metal);
    for (let z = -3.28; z < 1.05; z += 0.48) {
      const k = (STAIR_START - z) / (STAIR_START - STAIR_TURN);
      if (i < 2) {
        box(-0.025, i * H + k * 1.5 + 0.43, z, 0.04, 0.9, 0.04, metal);
        box(0.025, (i + 1) * H - k * 1.5 + 0.43, z, 0.04, 0.9, 0.04, metal);
      }
    }
  }
  stairRail.push(collider(0, 4.5, -1.18, 0.12, 9, 4.57));
  stops[0].push(collider(0.99, 0.5, STAIR_START - 0.1, 1.88, 1, 0.2));
  stops[2].push(collider(-0.99, 6.5, STAIR_START - 0.1, 1.88, 1, 0.2));
  for (const [x, y] of [[0.99, 0], [-0.99, 6]]) {
    box(x, y + 0.48, STAIR_START - 0.1, 1.9, 0.9, 0.12, metal);
  }

  for (let i = 0; i < 2; i++) box(-1.45 + i * 0.65, 1.36, 5.69, 0.59, 0.64, 0.18, metal);
  note('chapter2:notice', 0, -1.28, 1.38, 5.58, 'Записка на почтовых ящиках', 'Лида, ключ больше не прячем под ковриком. Почтальон им открывает подъезд, а потом дверь хлопает до ночи. Показания счётчика оставь на третьем, в шестой квартире. — Вера', 0);
  note('chapter2:receipt', 0, -6.5, models.get('dining_table')!.size.y + 0.016, 3.4, 'Квитанция за март', 'Кв. 1. Оплачено 18 марта. На обороте: «Вера, у вас девятка на счётчике заедает. У меня такая же. В квитанцию пишу ту цифру, которую слышно».' );
  const tableHeight = models.get('side_table_01')!.size.y;
  note('chapter2:repair', 1, -3.00, tableHeight + 0.015, -4.95, 'Талон из радиомастерской', 'Магнитофон № 2619. В графе «неисправность» написано: «Пишет поверх чистой ленты даже без батареек». Вера забрала аппарат наверх, а кассету так и оставили на тумбочке у кровати.');
  note(HOUSE12_ID.ledger, 2, 6.52, models.get('electric_stove')!.size.y + 0.016, 3.18, 'Тетрадь из шестой квартиры', 'Кв. 6. Вторник, 6:40. Вода — 0021. Газ — перекрыт. Ключ вернуть Лиде.\nВ графе «Кто снял показания» за меня расписалась соседка из первой. Её подпись я узнала. На бумаге она была сухая, а на пальцах остались чернила.\n\nНа полях: «Кассета осталась в третьей квартире, у кровати. Вернуть сюда, в аппарат № 2619».');

  const tape = new THREE.Group();
  const tapeX = -6.8, tapeZ = -4.72;
  put('side_table_01', tapeX, H, tapeZ, 1);
  tape.position.set(tapeX, H + tableHeight + 0.018, tapeZ);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.033, 0.105), lambert({ color: 0x2a272b }));
  const sticker = new THREE.Mesh(new THREE.BoxGeometry(0.144, 0.002, 0.068), new THREE.MeshBasicMaterial({ color: 0xd6b58a }));
  sticker.position.y = 0.019;
  tape.add(shell, sticker);
  for (const x of [-0.039, 0.039]) {
    const reel = new THREE.Mesh(new THREE.CircleGeometry(0.013, 8), new THREE.MeshBasicMaterial({ color: 0x3f3430 }));
    reel.rotation.x = -Math.PI / 2; reel.position.set(x, 0.021, 0);
    tape.add(reel);
  }
  root.add(tape);
  spots.push({ id: HOUSE12_ID.tape, kind: 'tape', room: 'A', at: AT(tapeX, tapeZ), elevation: H, title: 'Кассета', text: '', mesh: tape });

  const deckX = TAPE_DECK.x - APARTMENTS.x, deckZ = TAPE_DECK.z - APARTMENTS.z;
  put('side_table_01', deckX, 2 * H, deckZ, 2);
  const deck = put('boombox', deckX, 2 * H + tableHeight, deckZ, 2, 0.35, 0.83);
  spots.push({ id: HOUSE12_ID.deck, kind: 'deck', room: 'A', at: TAPE_DECK, elevation: 2 * H, title: 'Магнитофон № 2619', text: '', mesh: deck });

  const interference = canvasTex(24, 64, (c, w, h) => {
    c.fillStyle = '#252630'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 3) {
      const shade = 36 + (y * 67 + x * 11 + (y ^ x) * 19) % 95;
      c.fillStyle = `rgb(${shade}, ${shade}, ${shade + 15})`; c.fillRect(x, y, 3, 1);
    }
  }, [1, 2]);
  const gateMat = new THREE.MeshBasicMaterial({ map: interference, side: THREE.DoubleSide });
  const gate = box(5.15, 2 * H + 1.16, 0, 1.32, 2.32, 0.15, gateMat);
  for (const x of [4.46, 5.84]) box(x, 2 * H + 1.14, 0.08, 0.1, 2.28, 0.14, trim);
  box(5.15, 2 * H + 2.27, 0.08, 1.48, 0.13, 0.14, trim);
  backRoom.add(box(5.79, 2 * H + 1.08, -0.55, 0.08, 2.15, 1.08, door));
  backRoom.add(box(5.73, 2 * H + 1.05, -0.97, 0.1, 0.045, 0.1, metal));
  const gateBox = collider(5.15, 2 * H + 1.16, 0, 1.32, 2.32, 0.15);
  solids.push(gateBox);
  regions[2].push(gateBox);
  const backTableX = 4.1, backTableZ = -4.89;
  backRoom.add(put('side_table_01', backTableX, 2 * H, backTableZ, 2));
  backRoom.add(note(HOUSE12_ID.parcel, 2, backTableX, tableHeight + 0.019, backTableZ, 'Письмо для первой квартиры', 'Получатель: Лидия Корнеева, дом 12, кв. 1. На обороте Вера написала: «Почтальон уже дважды вернул конверт. Говорит, на первом этаже нет такой двери».\n\nПод штемпелем шариковой ручкой: «Если опять не принесут — отнеси в радиомастерскую. Там договорились оставить письма».'));
  const backLamp = new THREE.PointLight(0xdcb56d, 14, 5, 1.5);
  backLamp.position.set(5.2, 2 * H + 2.58, -2.8);
  backRoom.add(backLamp);

  worldBoxes.push(...regions[0], ...stairRail, ...stops[0]);
  const bulletBoxes = [...solids];
  const inside = (p: Vec2) => { const { x, z } = LOCAL(p); return Math.abs(x) < 9 && Math.abs(z) < 6; };
  const onStairs = (p: Vec2) => { const { x, z } = LOCAL(p); return Math.abs(x) < 1.93 && z < STAIR_START && z > -6; };
  const layers = regions.map((r, i) => [...r, ...stairRail, ...stops[i]]);
  const setProgress = (step: number) => {
    const restored = step >= HOUSE12.room;
    tape.visible = house12SpotVisible(HOUSE12_ID.tape, step);
    backRoom.visible = restored;
    gate.visible = !restored;
    for (const boxes of [layers[2], bulletBoxes]) {
      const i = boxes.indexOf(gateBox);
      if (restored && i !== -1) boxes.splice(i, 1);
      if (!restored && i === -1) boxes.push(gateBox);
    }
  };
  setProgress(HOUSE12.street);
  return {
    spots, bulletBoxes, inside, onStairs, setProgress,
    target(step: number) { return spots.find((s) => s.id === house12Target(step)); },
    update(t: number) { if (gate.visible) interference.offset.y = (Math.floor(t * 12) * 0.13) % 1; },
    collision(p: Vec2, height: number) { return inside(p) && height > 0.03 ? layers[Math.round(height / H)] : worldBoxes; },
    height: apartmentHeight,
  };
}
