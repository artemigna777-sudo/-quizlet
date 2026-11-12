/**
 * Двор в центральном квартале: четыре дома, в которые можно зайти. В каждом — жилая комната с записками и
 * дальняя комната, которую город стёр. Она возвращается, когда принесёшь к её двери вещь хозяина.
 */
import * as THREE from 'three';
import type { Vec2 } from './config';
import { canvasTex, lambert } from './gfx';
import type { Box } from './logic';
import { LOOT_NAME, lootMesh, type LootKind } from './loot';
import { loadModel, type Proto } from './models';
import { HOMES, ITEMS, type HomeId, type Room } from './story';

export interface Spot {
  id: string; kind: 'note' | 'item' | 'gate' | 'loot'; home?: HomeId; room: Room; at: Vec2;
  title: string; text: string; mesh: THREE.Object3D | null; loot?: LootKind;
}
export interface Homes {
  spots: Spot[];
  /** Точка перед входной дверью — туда ведёт пёс. */
  door(home: HomeId): Vec2;
  reveal(home: HomeId): void;
  hideItem(id: string): void;
  /** В каком доме стоит точка (null — на улице). */
  inside(p: Vec2): HomeId | null;
  update(t: number): void;
}

const FLOOR = 0.14;
const H = 2.9;
const SITE: Record<HomeId, { x: number; z: number; s: 1 | -1; wall: string; tint: number; out: number }> = {
  nina: { x: 8, z: 8, s: 1, wall: '#b0a878', tint: 0x8a7f5a, out: 0xe6d28a },
  zoya: { x: -8, z: 8, s: 1, wall: '#8fae92', tint: 0x6f8a70, out: 0xa8d0a0 },
  gena: { x: -8, z: -8, s: -1, wall: '#a098b8', tint: 0x77708a, out: 0xe0a898 },
  tema: { x: 8, z: -8, s: -1, wall: '#88a4c8', tint: 0x6a85a8, out: 0x9cc0e0 },
};
const MODELS = ['Shelf_01', 'wooden_table_02', 'painted_wooden_nightstand', 'painted_wooden_shelves', 'painted_wooden_table', 'painted_wooden_bench',
  'painted_wooden_stool', 'painted_wooden_chair_01', 'painted_wooden_cabinet_02', 'dining_table', 'Television_01', 'vintage_day_bed', 'sofa_02',
  'wall_clock', 'hanging_picture_frame_01', 'standing_picture_frame_01', 'russian_food_cans_01', 'cassette_player', 'SchoolDesk_01', 'football',
  'rubber_duck_toy', 'handsaw_wood', 'cross_pein_hammer', 'barrel_03', 'old_tyre', 'trashbag', 'ceramic_vase_01', 'plastic_monobloc_chair_01',
  'standing_chalkboard_01', 'life_jacket', 'painted_wooden_cabinet', 'wooden_crate_02'] as const;
type ModelId = (typeof MODELS)[number];
const Q = Math.PI / 2;

export async function buildHomes(scene: THREE.Scene, boxes: Box[], progress: (k: number) => void = () => {}): Promise<Homes> {
  const protos = new Map<ModelId, Proto>();
  let done = 0;
  await Promise.all(MODELS.map(async (id) => { protos.set(id, await loadModel(id)); progress(++done / MODELS.length); }));

  // ───────── Материалы ─────────
  const noise = (g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
  const paperMat = (base: string) => lambert({ map: canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.07)';
    for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, h - 4, w, 4);
    noise(g, w, h, 60, 0.18);
  }, [5, 1]) });
  const outTex = canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a8a49c';
    for (let y = 0; y < h; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); } }
    noise(g, w, h, 80, 0.12);
  }, [5, 1.5]);
  const floorMat = lambert({ map: canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = '#4a3a2a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2c2218';
    for (let x = 0; x < w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.beginPath(); g.moveTo(0, 11); g.lineTo(8, 11); g.moveTo(8, 25); g.lineTo(16, 25); g.moveTo(16, 6); g.lineTo(24, 6); g.moveTo(24, 19); g.lineTo(32, 19); g.stroke();
    noise(g, w, h, 70, 0.2);
  }, [5, 5]) });
  const ceilMat = lambert({ color: 0x2a2a2e });
  const upperTex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#dcd8d0'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 200, 0.1);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { g.fillStyle = '#f4f0e6'; g.fillRect(5 + c * 20, 6 + r * 30, 16, 20); g.fillStyle = '#2c3f5c'; g.fillRect(7 + c * 20, 8 + r * 30, 5, 16); g.fillRect(14 + c * 20, 8 + r * 30, 5, 16); }
  });
  const roofMat = lambert({ color: 0x6a3a30 });
  const woodMat = lambert({ map: canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = '#7a5a36'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4a3520';
    for (let y = 0; y < h; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    noise(g, w, h, 60, 0.2);
  }, [4, 2]), side: THREE.DoubleSide });
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x3c3f4a });
  const staticTex = canvasTex(32, 64, (g, w, h) => {
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const v = 40 + Math.floor(Math.random() * 150); g.fillStyle = `rgb(${v},${v},${v + 12})`; g.fillRect(x, y, 2, 2); }
  });
  const staticMat = new THREE.MeshBasicMaterial({ map: staticTex, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  const noteTex = canvasTex(16, 22, (g, w, h) => {
    g.fillStyle = '#e9dfc4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a4f7a';
    for (let y = 3; y < h - 2; y += 3) g.fillRect(2, y, 6 + ((y * 7) % 7), 1);
  });
  const noteMat = new THREE.MeshBasicMaterial({ map: noteTex, side: THREE.DoubleSide, color: 0xc8c0aa });
  const windowMat = new THREE.MeshBasicMaterial({ map: canvasTex(16, 20, (g, w, h) => {
    g.fillStyle = '#d8d2c4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#141a2c'; g.fillRect(2, 2, 5, 16); g.fillRect(9, 2, 5, 16);
    g.fillStyle = '#2a3350'; g.fillRect(2, 2, 5, 5); g.fillRect(9, 2, 5, 5);
  }), color: 0x9a9a9a });
  const basic = (color: number) => new THREE.MeshBasicMaterial({ color });
  let seed = 77;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bookMats = [0x8a3a30, 0x2f5a7a, 0x4a6a3a, 0xb89a4a, 0x5a3a6a, 0xc8c0a8, 0x3a3a44].map((c) => lambert({ color: c }));
  const cupMats = [0xe8e4d8, 0x7aa0c0, 0xc86a4a].map((c) => lambert({ color: c }));

  const spots: Spot[] = [];
  const doors = new Map<HomeId, Vec2>();
  const gates = new Map<HomeId, { mesh: THREE.Mesh; box: Box; B: THREE.Group; lamp: THREE.PointLight; saved: Map<THREE.Mesh, THREE.Material | THREE.Material[]> }>();
  const itemMeshes = new Map<string, THREE.Object3D>();

  for (const def of HOMES) {
    const site = SITE[def.id];
    const s = site.s;
    const g = new THREE.Group();
    g.position.set(site.x, 0, site.z);
    g.rotation.y = s > 0 ? 0 : Math.PI;
    scene.add(g);
    const A = new THREE.Group(), B = new THREE.Group();
    g.add(A, B);
    const W = (x: number, z: number): Vec2 => ({ x: site.x + s * x, z: site.z + s * z });
    const solid = (x0: number, z0: number, x1: number, z1: number): Box => {
      const a = W(x0, z0), b = W(x1, z1);
      const box = { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
      boxes.push(box);
      return box;
    };
    const inMat = paperMat(site.wall);
    const outMat = lambert({ map: outTex, color: site.out });
    const upperMat = lambert({ map: upperTex, color: site.out });
    /** Стена: inside — номер грани коробки, которая смотрит в комнату (0 +x, 1 −x, 4 +z, 5 −z), −1 — перегородка. */
    const wall = (x0: number, z0: number, x1: number, z1: number, inside: number, y0 = 0, y1 = H, collide = true) => {
      const mats = [0, 1, 2, 3, 4, 5].map((i) => (inside < 0 || i === inside ? inMat : outMat));
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mats);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      g.add(m);
      if (collide) solid(x0, z0, x1, z1);
    };
    wall(-5, -5, 5, -4.75, 4);
    wall(-5, -4.75, -4.75, 4.75, 0);
    wall(4.75, -4.75, 5, 4.75, 1);
    wall(-5, 4.75, -0.6, 5, 5);
    wall(0.6, 4.75, 5, 5, 5);
    wall(-0.6, 4.75, 0.6, 5, 5, 2.1, H, false);
    wall(-4.75, -0.6, 1.5, -0.4, -1);
    wall(2.7, -0.6, 4.75, -0.4, -1);
    wall(1.5, -0.6, 2.7, -0.4, -1, 2.1, H, false);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 9.5), floorMat);
    floor.rotation.x = -Q; floor.position.y = FLOOR + 0.01;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 9.5), ceilMat);
    ceil.rotation.x = Q; ceil.position.y = H;
    const hh = [6, 9, 6, 12][def.num - 1];
    const upper = new THREE.Mesh(new THREE.BoxGeometry(10, hh - H, 10), upperMat);
    upper.position.y = (hh + H) / 2 + 0.01;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, def.num % 2 ? 2.6 : 1.4, 4), roofMat);
    roof.position.y = hh + 0.9; roof.rotation.y = Math.PI / 4;
    g.add(floor, ceil, upper, roof);
    // Ковры и лампы под потолком.
    const rugMat = lambert({ map: canvasTex(24, 16, (c, w, h) => {
      c.fillStyle = '#' + site.tint.toString(16).padStart(6, '0'); c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.strokeRect(1.5, 1.5, w - 3, h - 3); c.strokeRect(4.5, 4.5, w - 9, h - 9);
      c.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 7; x < w - 6; x += 4) c.fillRect(x, 7, 2, 2);
    }) });
    const shadeMat = lambert({ color: 0x8a6a4a, side: THREE.DoubleSide });
    for (const [x, z, w, d] of [[0.3, 2.3, 3.2, 2.1], [-0.6, -1.5, 2.4, 1.4]]) {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), rugMat);
      rug.rotation.x = -Q; rug.position.set(x, FLOOR + 0.02, z);
      const cord = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.45, 0.02), ceilMat);
      cord.position.set(x, H - 0.22, z);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.24, 6, 1, true), shadeMat);
      shade.position.set(x, H - 0.5, z);
      g.add(rug, cord, shade);
    }
    // Открытая дверь, номер дома, окна.
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.05, 0.06), lambert({ color: site.tint }));
    leaf.position.set(-0.6 - 0.5, 1.03, 5.45); leaf.rotation.y = 0.9;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ color: 0xb8b8b8, map: canvasTex(32, 32, (c) => {
      c.fillStyle = '#1c2a4a'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#fff'; c.font = '700 24px sans-serif'; c.textAlign = 'center'; c.fillText(String(def.num), 16, 25);
    }) }));
    plate.position.set(1.1, 1.9, 5.02);
    g.add(leaf, plate);
    const win = (x: number, z: number, ry: number, room: THREE.Group) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.4), windowMat); m.position.set(x, 1.55, z); m.rotation.y = ry; room.add(m); };
    win(-4.74, 2.4, Q, A); win(3.0, 4.74, Math.PI, A); win(-2.2, -4.74, 0, B);
    doors.set(def.id, W(0, 6.4));

    // ───────── Мебель и вещи ─────────
    /** Книги на полках, посуда на столах: мебель не стоит пустой. */
    const clutter = (obj: THREE.Object3D, id: ModelId) => {
      const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; obj.add(m); };
      const shelf = (w: number, ys: number[]) => {
        for (const y of ys) {
          let x = -w / 2 + rnd() * 0.1;
          while (x < w / 2 - 0.06) {
            if (rnd() < 0.18) { x += 0.06 + rnd() * 0.12; continue; }
            const t = 0.025 + rnd() * 0.03, h = 0.17 + rnd() * 0.09;
            add(new THREE.BoxGeometry(t, h, 0.14), bookMats[Math.floor(rnd() * bookMats.length)], x + t / 2, y + h / 2, 0, rnd() < 0.1 ? 0.25 : 0);
            x += t + 0.004;
          }
        }
      };
      if (id === 'Shelf_01') shelf(0.86, [0.07, 0.48, 0.88, 1.28, 1.68]);
      else if (id === 'painted_wooden_shelves') shelf(0.4, [0.06, 0.42, 0.78]);
      else if (id === 'wooden_table_02' || id === 'dining_table' || id === 'painted_wooden_table') {
        const p = protos.get(id)!;
        const top = p.size.y + 0.005, w = p.size.x * 0.4, d = p.size.z * 0.3;
        for (let i = 0; i < 3; i++) {
          const x = (rnd() - 0.5) * 2 * w, z = (rnd() - 0.5) * 2 * d;
          if (rnd() < 0.5) add(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 7), cupMats[Math.floor(rnd() * cupMats.length)], x, top + 0.04, z);
          else if (rnd() < 0.6) add(new THREE.CylinderGeometry(0.1, 0.07, 0.015, 9), cupMats[0], x, top + 0.008, z);
          else add(new THREE.BoxGeometry(0.16, 0.03, 0.22), bookMats[Math.floor(rnd() * bookMats.length)], x, top + 0.015, z);
        }
      } else if (id === 'painted_wooden_nightstand' || id === 'SchoolDesk_01') add(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 7), cupMats[1], 0.1, protos.get(id)!.size.y * (id === 'SchoolDesk_01' ? 0.86 : 1) + 0.04, 0.05);
    };
    const loot = (kind: LootKind, name: string, room: Room, x: number, z: number, y: number) => {
      const m = lootMesh(kind);
      m.position.set(x, FLOOR + y, z);
      (room === 'A' ? A : B).add(m);
      spots.push({ id: `loot:${def.id}:${spots.length}`, kind: 'loot', home: def.id, room, at: W(x, z), title: name, text: '', mesh: m, loot: kind });
    };
    const put = (room: THREE.Group, id: ModelId, x: number, z: number, rot = 0, o: { y?: number; s?: number; solid?: boolean; rx?: number; rz?: number } = {}) => {
      const p = protos.get(id)!;
      const k = o.s ?? 1;
      const obj = p.root.clone();
      obj.scale.setScalar(k);
      obj.position.set(x, FLOOR + (o.y ?? 0), z);
      obj.rotation.set(o.rx ?? 0, rot, o.rz ?? 0);
      room.add(obj);
      clutter(obj, id);
      if (o.solid ?? (!o.y && p.size.y * k > 0.45)) {
        const turned = Math.abs(Math.sin(rot)) > 0.7;
        const w = (turned ? p.size.z : p.size.x) * k / 2 - 0.04, d = (turned ? p.size.x : p.size.z) * k / 2 - 0.04;
        solid(x - w, z - d, x + w, z + d);
      }
      return obj;
    };
    const prim = (room: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, FLOOR + y, z); room.add(m); return m; };
    const note = (id: string, x: number, z: number, y: number, wallRot?: number) => {
      const n = def.notes.find((v) => v.id === id)!;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), noteMat);
      m.position.set(x, FLOOR + y, z);
      if (wallRot === undefined) m.rotation.set(-Q, 0, 0.3); else m.rotation.y = wallRot;
      (n.room === 'A' ? A : B).add(m);
      spots.push({ id, kind: 'note', home: def.id, room: n.room, at: W(x, z), title: n.title, text: n.text, mesh: m });
    };
    const item = (id: string, mesh: THREE.Object3D, x: number, z: number) => {
      const it = ITEMS.find((v) => v.id === id)!;
      itemMeshes.set(id, mesh);
      spots.push({ id, kind: 'item', home: def.id, room: it.room, at: W(x, z), title: it.name, text: it.text, mesh });
    };
    const bowl = (room: THREE.Group, x: number, z: number, y = 0.02, color = 0x9aa3ad) => prim(room, new THREE.CylinderGeometry(0.13, 0.09, 0.07, 8), basic(color), x, y + 0.035, z);

    if (def.id === 'nina') {
      put(A, 'sofa_02', -4.2, 1.2, Q);
      put(A, 'wooden_table_02', 4.2, 2.6, -Q);
      put(A, 'painted_wooden_chair_01', 3.4, 2.6, Q);
      put(A, 'ceramic_vase_01', 4.3, 3.0, 0, { y: 0.8 });
      put(A, 'Shelf_01', -2.6, -0.2, 0);
      put(A, 'wall_clock', 0, -0.37, 0, { y: 1.9 });
      put(A, 'standing_chalkboard_01', -3.5, 3.7, 2.4);
      put(A, 'hanging_picture_frame_01', 4.72, 0.6, -Q, { y: 1.3 });
      note('n-sept', -3.25, 3.42, 1.05, 2.4 - Math.PI);
      note('n-nov', 4.15, 2.3, 0.82);
      note('n-zoya', 1.2, 4.72, 1.4, Math.PI);
      item('bowl', bowl(A, -2.6, 2.2), -2.6, 2.2);
      loot('food', 'печенье «Юбилейное»', 'A', 4.0, 2.9, 0.82);
      loot('water', 'графин с водой', 'B', -3.2, -2.5, 0.78);
      // Музыкальная комната.
      const piano = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.15, 0.55), lambert({ color: 0x1c1410 }));
      body.position.y = 0.575;
      const keys = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.24), lambert({ map: canvasTex(32, 4, (c) => { c.fillStyle = '#e8e2d0'; c.fillRect(0, 0, 32, 4); c.fillStyle = '#111'; for (let x = 1; x < 32; x += 2) if (x % 14 !== 5 && x % 14 !== 13) c.fillRect(x, 0, 1, 2); }) }));
      keys.position.set(0, 0.72, 0.38);
      piano.add(body, keys);
      piano.position.set(0, FLOOR, -4.4);
      B.add(piano);
      solid(-0.75, -4.7, 0.75, -3.9);
      put(B, 'painted_wooden_stool', 0, -3.5);
      put(B, 'SchoolDesk_01', -3.2, -2.6, Q);
      put(B, 'vintage_day_bed', 4.25, -2.7, -Q);
      put(B, 'hanging_picture_frame_01', 2.4, -4.72, 0, { y: 1.3 });
      put(B, 'painted_wooden_shelves', -4.5, -4.3, Q);
      note('n-last', -0.45, -4.4, 1.17);
    } else if (def.id === 'zoya') {
      put(A, 'dining_table', -3.6, 2.0, Q);
      put(A, 'plastic_monobloc_chair_01', -2.4, 2.0, -Q);
      put(A, 'painted_wooden_stool', -3.6, 0.1);
      put(A, 'painted_wooden_cabinet', 4.35, 1.8, -Q);
      put(A, 'painted_wooden_nightstand', 4.35, 3.6, -Q);
      put(A, 'Television_01', 4.3, 3.6, -Q, { y: 0.66 });
      put(A, 'trashbag', 3.9, -0.1 + 0.2);
      for (let i = 0; i < 5; i++) put(A, 'russian_food_cans_01', -3.9 + (i % 3) * 0.16, 2.6 + Math.floor(i / 3) * 0.16, i, { y: 0.88, s: 2.2 });
      // Четыре миски у порога — по числу кошек; своей нет только у Мурки.
      [0x7a8a6a, 0x8a6a5a, 0x6a7a8a].forEach((c, i) => bowl(A, -1.6 - i * 0.45, 4.3, 0.02, c));
      put(A, 'wall_clock', -1.5, -0.37, 0, { y: 1.9 });
      note('z-book', -3.5, 1.6, 0.9);
      loot('food', 'килька в томате', 'A', -3.3, 2.9, 0.9);
      loot('water', 'бидон с водой', 'A', 3.6, 0.6, 0);
      loot('food', 'банка варенья', 'B', -1.4, -4.25, 0.5);
      note('z-list', 3.98, 1.5, 1.25, -Q);
      note('z-gena', 3.98, 2.1, 0.95, -Q);
      put(B, 'vintage_day_bed', -4.25, -2.6, Q);
      put(B, 'painted_wooden_nightstand', -4.35, -1.2, Q);
      put(B, 'standing_picture_frame_01', -4.35, -1.1, Q, { y: 0.66 });
      put(B, 'painted_wooden_cabinet_02', 3.6, -4.35, 0, { s: 0.9 });
      put(B, 'painted_wooden_shelves', 0, -4.5, 0);
      put(B, 'painted_wooden_chair_01', -1.4, -4.3, 0);
      note('z-last', -4.3, -1.4, 0.68);
      const tin = prim(B, new THREE.CylinderGeometry(0.09, 0.09, 0.16, 8), basic(0xb04a3a), 0, 1.13 + 0.08, -4.5);
      item('key', tin, 0, -4.2);
    } else if (def.id === 'gena') {
      put(A, 'sofa_02', -4.2, 2.0, Q);
      put(A, 'painted_wooden_table', 3.2, 3.4, 0);
      put(A, 'painted_wooden_chair_01', 2.4, 2.5, Math.PI);
      put(A, 'painted_wooden_chair_01', 3.8, 2.5, Math.PI);
      put(A, 'wooden_table_02', 4.3, 0.5, -Q);
      put(A, 'Television_01', 4.3, 0.5, -Q, { y: 0.8 });
      put(A, 'Shelf_01', -2.4, -0.2, 0);
      put(A, 'wooden_crate_02', -4.2, 4.1, Q, { s: 0.7 });
      put(A, 'hanging_picture_frame_01', -4.72, 2.0, Q, { y: 1.5 });
      note('g-bills', -4.2, 4.1, 0.36);
      loot('food', 'тушёнка', 'A', 3.9, 3.6, 0.98);
      loot('water', 'канистра воды', 'B', -4.3, -2.2, 0);
      note('g-luda', 2.9, 3.3, 0.98);
      note('g-song', -4.1, 1.6, 0.5);
      // Мастерская: лодка занимает почти всю комнату.
      const boat = new THREE.Group();
      const plank = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); boat.add(m); };
      plank(4.2, 0.08, 1.05, 0, 0, 0);
      for (const k of [-1, 1]) {
        plank(4.2, 0.6, 0.06, 0, 0.27, k * 0.72, k * 0.45);
        plank(1.35, 0.6, 0.06, 2.62, 0.27, k * 0.42, k * 0.45, -k * 0.62);
      }
      plank(0.06, 0.55, 1.6, -2.1, 0.27, 0);
      for (const x of [-1.4, -0.4, 0.6, 1.6]) plank(0.07, 0.07, 1.75, x, 0.5, 0);
      boat.position.set(-1.2, FLOOR + 0.44, -3.0);
      B.add(boat);
      put(B, 'wooden_crate_02', -2.6, -3.0, 0, { s: 0.8, solid: false });
      put(B, 'wooden_crate_02', 0.4, -3.0, 0, { s: 0.8, solid: false });
      solid(-3.5, -3.95, 1.5, -2.05);
      put(B, 'barrel_03', -4.3, -1.2);
      put(B, 'old_tyre', -4.5, -4.2, 0.4, { y: 0, rx: 0, solid: false });
      put(B, 'wooden_table_02', 4.3, -1.6, -Q);
      put(B, 'handsaw_wood', 4.3, -1.3, 0.5, { y: 0.84, rz: Q });
      put(B, 'cross_pein_hammer', 4.2, -1.9, 1, { y: 0.82, rx: Q });
      put(B, 'life_jacket', 3.0, -4.66, 0, { y: 0.9 });
      put(B, 'life_jacket', 3.9, -4.66, 0, { y: 0.9 });
      put(B, 'painted_wooden_stool', 2.6, -3.4);
      note('g-reply', 0.2, -2.12, 0.8, 0);
      note('g-vests', 3.45, -4.7, 1.2, 0);
      const bino = new THREE.Group();
      for (const dx of [-0.045, 0.045]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 8), basic(0x2a2c30)); t.rotation.x = Q; t.position.x = dx; bino.add(t); }
      bino.position.set(4.25, FLOOR + 0.86, -1.6);
      B.add(bino);
      item('bino', bino, 4.0, -1.6);
    } else {
      put(A, 'SchoolDesk_01', -4.2, 3.4, Q);
      put(A, 'cassette_player', -4.3, 3.5, 0.4, { y: 0.78, s: 1.6 });
      put(A, 'painted_wooden_shelves', -4.5, 1.2, Q);
      put(A, 'rubber_duck_toy', -4.5, 1.2, Q, { y: 1.13, s: 0.6 });
      put(A, 'football', -1.6, 3.9, 1);
      put(A, 'vintage_day_bed', 4.25, 1.8, -Q);
      put(A, 'painted_wooden_bench', -2.4, -0.1, 0);
      put(A, 'hanging_picture_frame_01', -0.4, -0.38, 0, { y: 1.4 });
      note('t-spy', -4.15, 3.1, 0.8);
      loot('food', 'сухарики', 'A', 3.3, 1.2, 0.02);
      loot('water', 'банка компота', 'B', -4.0, -4.3, 1.2);
      note('t-mom', -2.4, 0.0, 0.5);
      note('t-marks', 1.42, -0.37, 1.3, 0);
      const cuts = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.9), new THREE.MeshBasicMaterial({ map: canvasTex(4, 36, (c) => { c.clearRect(0, 0, 4, 36); c.fillStyle = '#d8d0b8'; for (const y of [0, 22, 27, 32]) c.fillRect(0, y, 4, 1); }), transparent: true, alphaTest: 0.5 }));
      cuts.position.set(1.42, FLOOR + 1.36, -0.385);
      A.add(cuts);
      // Кухня с тремя тарелками.
      put(B, 'dining_table', 0, -3.0, 0);
      put(B, 'painted_wooden_chair_01', -0.6, -1.95, Math.PI);
      put(B, 'painted_wooden_chair_01', 0.6, -1.95, Math.PI);
      put(B, 'plastic_monobloc_chair_01', 0, -4.1, 0);
      for (const [x, z] of [[-0.6, -2.65], [0.6, -2.65], [0, -3.4]]) prim(B, new THREE.CylinderGeometry(0.13, 0.09, 0.02, 10), basic(0xd8d4c8), x, 0.89, z);
      put(B, 'painted_wooden_cabinet', -4.0, -4.35, 0);
      put(B, 'wall_clock', 2.4, -4.72, 0, { y: 1.9 });
      put(B, 'Shelf_01', 4.6, -2.6, -Q);
      note('t-essay', -0.1, -2.85, 0.9);
      note('t-x', -4.0, -3.95, 1.58 - 0.38);
      const metro = prim(B, new THREE.ConeGeometry(0.1, 0.26, 4), basic(0x8a5a2a), 0.75, 0.88 + 0.13, -3.2);
      item('metro', metro, 0.75, -3.2);
    }

    // Стёртая комната: серые силуэты и помехи в дверном проёме.
    const saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    B.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { saved.set(m, m.material); m.material = ghostMat; } });
    spots.filter((v) => v.home === def.id && v.room === 'B' && v.mesh).forEach((v) => { v.mesh!.visible = false; });
    const gate = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.1), staticMat);
    gate.position.set(2.1, 1.05, -0.5);
    g.add(gate);
    const lamp = new THREE.PointLight(0xffb060, 0, 10, 1.2);
    lamp.position.set(0, 2.3, -2.7);
    g.add(lamp);
    gates.set(def.id, { mesh: gate, box: solid(1.5, -0.6, 2.7, -0.4), B, lamp, saved });
    spots.push({ id: `gate:${def.id}`, kind: 'gate', home: def.id, room: 'A', at: W(2.1, -0.2), title: 'Стёртая комната', text: '', mesh: null });
  }

  // Двор между домами.
  const yard = (id: ModelId, x: number, z: number, rot = 0, isSolid = true) => {
    const p = protos.get(id)!;
    const o = p.root.clone();
    o.position.set(x, FLOOR, z); o.rotation.y = rot;
    scene.add(o);
    if (isSolid) { const t = Math.abs(Math.sin(rot)) > 0.7; const w = (t ? p.size.z : p.size.x) / 2, d = (t ? p.size.x : p.size.z) / 2; boxes.push({ minX: x - w, maxX: x + w, minZ: z - d, maxZ: z + d }); }
  };
  yard('painted_wooden_bench', 0, -2.3, 0);
  yard('painted_wooden_bench', -2.3, 0.4, Q);
  yard('barrel_03', 2.3, 2.3);
  yard('trashbag', 2.2, -2.2, 1, false);
  yard('trashbag', 1.6, -2.5, 2, false);
  yard('old_tyre', -2.2, 2.4, 0.3, false);
  yard('plastic_monobloc_chair_01', 1.2, 1.0, 2.2);
  yard('wooden_crate_02', -1.9, -2.4, 0.2, false);
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.5, 8), lambert({ color: 0x6a4a30 }));
  stump.position.set(0.4, FLOOR + 0.25, 2.7);
  scene.add(stump);
  boxes.push({ minX: 0.1, maxX: 0.7, minZ: 2.4, maxZ: 3.0 });
  const axe = lootMesh('axe');
  axe.position.set(0.4, FLOOR + 0.42, 2.7);
  scene.add(axe);
  spots.push({ id: 'loot:axe', kind: 'loot', room: 'A', at: { x: 0.4, z: 2.7 }, title: LOOT_NAME.axe, text: '', mesh: axe, loot: 'axe' });

  return {
    spots,
    door: (home) => doors.get(home)!,
    reveal(home) {
      const gt = gates.get(home)!;
      if (!gt.mesh.parent) return;
      gt.mesh.parent.remove(gt.mesh);
      const i = boxes.indexOf(gt.box);
      if (i >= 0) boxes.splice(i, 1);
      gt.saved.forEach((mat, mesh) => { mesh.material = mat; });
      gt.lamp.intensity = 9;
      spots.filter((v) => v.home === home && v.room === 'B' && v.mesh).forEach((v) => { v.mesh!.visible = true; });
    },
    hideItem(id) { const m = itemMeshes.get(id); if (m) m.visible = false; },
    inside(p) { for (const h of HOMES) { const c = SITE[h.id]; if (Math.abs(p.x - c.x) < 5 && Math.abs(p.z - c.z) < 5) return h.id; } return null; },
    update(t) { staticTex.offset.set(Math.floor(t * 14) * 0.17, Math.floor(t * 14) * 0.29); },
  };
}
