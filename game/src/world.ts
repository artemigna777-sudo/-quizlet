/**
 * Город 7×7 кварталов. В центре — двор (homes.ts), вокруг панельные многоэтажки, дальше хрущёвки, магазины, школа,
 * гаражи и парки, по краям — частный сектор с деревянными домами. День и ночь меняют небо, туман и свет.
 */
import * as THREE from 'three';
import { CFG, type Vec2 } from './config';
import { canvasTex, lambert } from './gfx';
import { rng, streetLines, type Box } from './logic';
import { daylight } from './survival';

export interface Lamp { x: number; z: number; lx: number; lz: number; head: THREE.Mesh; mode: 'on' | 'off' | 'flicker'; phase: number }
export interface World {
  scene: THREE.Scene;
  boxes: Box[];
  lamps: Lamp[];
  half: number;
  /** Места для припасов и засад — у гаражей, остановок, подъездов. */
  lootSites: Vec2[];
  nooks: Vec2[];
  /** Окно ближайшего дома зажигается, когда найдено воспоминание. */
  lightWindow(at: Vec2): void;
  setTime(tod: number): void;
  /** Тени от солнца и луны (режим «высокое качество»). */
  setShadows(on: boolean): void;
  update(t: number, cam: THREE.Vector3): void;
}
/** Кварталы, которые строят другие модули: двор и магазин. */
export const YARD = { x: 0, z: 0 };
export const SHOP = { x: CFG.pitch, z: 0 };

const PASTEL = ['#d9c58a', '#9fc0d6', '#d8a9a0', '#a9cfae', '#cfc7b8', '#b9a9d0', '#e0b98a'];
const WOOD = ['#8a5a36', '#4f7a56', '#4a6f96', '#b89a4a', '#8a3f38', '#6a6a72'];
const CARS = [0xb8322a, 0x2a5fa8, 0xd8d2c0, 0x3a7a4a, 0xd0a020, 0x6a6e78, 0x7a3a8a];
const hex = (c: string) => new THREE.Color(c);

export function buildWorld(): World {
  const r = rng(20261112);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CFG.fog);
  const fog = (scene.fog = new THREE.Fog(CFG.fog, 3, 38));
  const hemi = new THREE.HemisphereLight(0x5a6488, 0x141218, 0.6);
  const sun = new THREE.DirectionalLight(0x8090c0, 0.4);
  scene.add(hemi, sun, sun.target);
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 140;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.06;
  const sunDir = new THREE.Vector3(-6, 12, 4).normalize();

  const half = (CFG.blocks / 2) * CFG.pitch;
  const span = half * 2 + 40;
  const boxes: Box[] = [];
  const lootSites: Vec2[] = [];
  const nooks: Vec2[] = [];
  const houses: Array<{ box: Box; h: number }> = [];
  const grain = (g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${r() * a})`; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2, 2); } };
  const solid = (x: number, z: number, w: number, d: number) => { const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }; boxes.push(b); return b; };

  // ───────── Земля и разметка ─────────
  const asphalt = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#4c4d54'; g.fillRect(0, 0, w, h);
    grain(g, w, h, 500, 0.22);
    g.strokeStyle = '#2a2a2e';
    g.beginPath(); g.moveTo(10, 0); g.lineTo(18, 20); g.lineTo(12, 40); g.lineTo(22, 64); g.stroke();
  }, [span / 4, span / 4]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(span, span, 48, 48), new THREE.MeshLambertMaterial({ map: asphalt }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const dashV: number[] = [];
  const quad = (x0: number, z0: number, x1: number, z1: number) => dashV.push(x0, 0, z0, x0, 0, z1, x1, 0, z1, x0, 0, z0, x1, 0, z1, x1, 0, z0);
  const firstC = -((CFG.blocks - 1) / 2) * CFG.pitch;
  for (const v of streetLines()) for (let b = 0; b < CFG.blocks; b++) for (let k = -2; k <= 2; k++) {
    const c = firstC + b * CFG.pitch + k * 5.2;
    quad(v - 0.16, c - 1.3, v + 0.16, c + 1.3);
    quad(c - 1.3, v - 0.16, c + 1.3, v + 0.16);
  }
  const dashGeo = new THREE.BufferGeometry();
  dashGeo.setAttribute('position', new THREE.Float32BufferAttribute(dashV, 3));
  dashGeo.computeVertexNormals();
  const dashes = new THREE.Mesh(dashGeo, new THREE.MeshLambertMaterial({ color: 0xd8d8c8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  dashes.position.y = 0.045;
  scene.add(dashes);

  // ───────── Текстуры домов ─────────
  /** Панель: два пролёта, окно и балкон. */
  const panelTex = (base: string, rx: number, ry: number) => canvasTex(64, 32, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    grain(g, w, h, 90, 0.1);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(0.5, 0.5, 31, 31); g.strokeRect(32.5, 0.5, 31, 31);
    g.fillStyle = '#e8e4d8'; g.fillRect(8, 7, 16, 15);
    g.fillStyle = '#2c3f5c'; g.fillRect(10, 9, 5, 11); g.fillRect(17, 9, 5, 11);
    g.fillStyle = '#e8e4d8'; g.fillRect(38, 5, 20, 14);
    g.fillStyle = '#2c3f5c'; g.fillRect(40, 7, 16, 10);
    g.fillStyle = pick(['#7a8a96', '#a05a4a', '#5a7a6a', '#8a8068']); g.fillRect(36, 19, 24, 9);
    g.strokeStyle = 'rgba(0,0,0,.3)'; for (let x = 38; x < 60; x += 4) { g.beginPath(); g.moveTo(x, 19); g.lineTo(x, 28); g.stroke(); }
  }, [rx, ry]);
  const brickTex = (rx: number, ry: number) => canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = pick(['#a0563e', '#b06a48', '#8f5a4a']); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.25)';
    for (let y = 0; y < h; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 4) % 2 ? 0 : 4; x < w; x += 8) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 4); g.stroke(); } }
    g.fillStyle = '#efe9da'; g.fillRect(8, 7, 16, 16);
    g.fillStyle = '#2c3f5c'; g.fillRect(10, 9, 5, 12); g.fillRect(17, 9, 5, 12);
  }, [rx, ry]);
  const woodTex = (base: string) => canvasTex(64, 32, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.3)'; for (let y = 0; y < h; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    grain(g, w, h, 80, 0.15);
    for (const x of [10, 40]) { g.fillStyle = '#f0ece0'; g.fillRect(x - 2, 6, 18, 17); g.fillStyle = '#2c3f5c'; g.fillRect(x, 9, 6, 12); g.fillRect(x + 8, 9, 6, 12); g.fillStyle = '#f0ece0'; g.fillRect(x - 3, 4, 20, 2); }
  });
  const plasterTex = (base: string, rx: number, ry: number) => canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    grain(g, w, h, 60, 0.12);
    g.fillStyle = '#f0ece0'; g.fillRect(5, 6, 22, 19);
    g.fillStyle = '#34496a'; g.fillRect(7, 8, 8, 15); g.fillRect(17, 8, 8, 15);
  }, [rx, ry]);
  const roofFlat = lambert({ color: 0x3a3a40 });
  const roofCol = [0x7a3a30, 0x4a5560, 0x5a6a4a, 0x6a4a3a].map((c) => lambert({ color: c }));
  const grassMat = new THREE.MeshLambertMaterial({ map: canvasTex(32, 32, (g, w, h) => { g.fillStyle = '#56733f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.fillStyle = r() < 0.5 ? '#48652f' : '#6a8a4a'; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 2); } }, [10, 10]) });
  const slabMat = new THREE.MeshLambertMaterial({ map: canvasTex(32, 32, (g) => { g.fillStyle = '#7c7c80'; g.fillRect(0, 0, 32, 32); g.strokeStyle = '#5a5a5e'; g.strokeRect(0, 0, 32, 32); }, [8, 8]) });
  const dark = lambert({ color: 0x1c1c20 });
  const metal = lambert({ color: 0x5a5e66 });

  /** Коробка дома с разными текстурами на длинных и коротких стенах. */
  const building = (x: number, z: number, w: number, d: number, h: number, tex: (rx: number, ry: number) => THREE.Texture, bay: number, floorH: number, roof: THREE.Material = roofFlat) => {
    const fl = Math.round(h / floorH);
    const mx = lambert({ map: tex(Math.max(1, Math.round(d / bay)), fl) }), mz = lambert({ map: tex(Math.max(1, Math.round(w / bay)), fl) });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, roof, roof, mz, mz]);
    m.position.set(x, h / 2, z);
    scene.add(m);
    houses.push({ box: solid(x, z, w, d), h });
    return m;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, collide = false) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
    if (collide) solid(x, z, w, d);
    return m;
  };
  /** Двускатная крыша: конёк вдоль X. */
  const gable = (w: number, d: number, rh: number) => {
    const a = w / 2, b = d / 2;
    const v = [
      -a, 0, b, a, 0, b, a, rh, 0, -a, 0, b, a, rh, 0, -a, rh, 0,
      a, 0, -b, -a, 0, -b, -a, rh, 0, a, 0, -b, -a, rh, 0, a, rh, 0,
      -a, 0, -b, -a, 0, b, -a, rh, 0, a, 0, b, a, 0, -b, a, rh, 0,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.computeVertexNormals();
    return geo;
  };
  const crownMats = [0x4f7a3a, 0x7a8a3a, 0xb8862a, 0xa85a2a, 0x5a8a4a].map((c) => lambert({ color: c }));
  const trunkMat = lambert({ color: 0x4a3a2c });
  const tree = (x: number, z: number) => {
    const h = 2.2 + r() * 1.6;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h, 5), trunkMat);
    t.position.set(x, h / 2, z);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + r() * 0.9, 0), pick(crownMats));
    c.position.set(x, h + 0.9, z);
    c.rotation.y = r() * 3;
    scene.add(t, c);
    solid(x, z, 0.3, 0.3);
  };
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8);
  const glass = lambert({ color: 0x2a3a50 });
  const car = (x: number, z: number, alongX: boolean) => {
    const g = new THREE.Group();
    const paint = lambert({ color: pick(CARS) });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 1.75), paint);
    body.position.y = 0.7;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.6), glass);
    cab.position.set(-0.2, 1.33, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.08, 1.65), paint);
    top.position.set(-0.2, 1.66, 0);
    g.add(body, cab, top);
    for (const [wx, wz] of [[1.35, 0.85], [1.35, -0.85], [-1.35, 0.85], [-1.35, -0.85]]) { const wh = new THREE.Mesh(wheelGeo, dark); wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.32, wz); g.add(wh); }
    g.position.set(x, 0, z);
    if (!alongX) g.rotation.y = Math.PI / 2;
    if (r() < 0.5) g.rotation.y += Math.PI;
    scene.add(g);
    if (alongX) solid(x, z, 4.2, 1.75); else solid(x, z, 1.75, 4.2);
  };
  const benchMat = lambert({ color: 0x8a6a3a });
  const bench = (x: number, z: number, alongX: boolean) => {
    box(x, 0.5, z, alongX ? 1.6 : 0.45, 0.08, alongX ? 0.45 : 1.6, benchMat, true);
    box(x, 0.3, z, alongX ? 1.4 : 0.1, 0.4, alongX ? 0.1 : 1.4, dark);
  };
  const sign = (text: string, x: number, y: number, z: number, ry: number, w: number, bg: string) => {
    const tex = canvasTex(128, 24, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 128, 24); g.fillStyle = '#fff'; g.font = '700 17px sans-serif'; g.textAlign = 'center'; g.fillText(text, 64, 18); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.19), lambert({ map: tex }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  const fenceMat = lambert({ color: 0x7a6a52 });

  // ───────── Кварталы ─────────
  const inner = CFG.pitch - CFG.street;
  const mid = (CFG.blocks - 1) / 2;
  const first = -mid * CFG.pitch;
  for (let bx = 0; bx < CFG.blocks; bx++) for (let bz = 0; bz < CFG.blocks; bz++) {
    const cx = first + bx * CFG.pitch, cz = first + bz * CFG.pitch;
    const ring = Math.max(Math.abs(bx - mid), Math.abs(bz - mid));
    const green = ring === 3;
    const kind = cx === YARD.x && cz === YARD.z ? 'yard' : cx === SHOP.x && cz === SHOP.z ? 'shop'
      : ring === 1 ? 'panel' : ring === 3 ? 'village' : pick(['five', 'five', 'shops', 'garages', 'park', 'school', 'panel'] as const);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(inner, 0.05, inner), green || kind === 'park' ? grassMat : slabMat);
    slab.position.set(cx, 0.025, cz);
    scene.add(slab);
    const flip = r() < 0.5;
    const P = (lx: number, lz: number): [number, number] => (flip ? [cx + lz, cz + lx] : [cx + lx, cz + lz]);
    const S = (w: number, d: number): [number, number] => (flip ? [d, w] : [w, d]);
    if (kind === 'panel') {
      for (const s of [-1, 1]) {
        const [x, z] = P(0, s * 7.6), [w, d] = S(24, 8.6);
        const floors = r() < 0.45 ? 9 : 5;
        const base = pick(PASTEL);
        building(x, z, w, d, floors * 3, (rx, ry) => panelTex(base, rx / 2, ry), 3, 3);
        for (const e of [-7, 7]) { const [ex, ez] = P(e, s * 2.9); box(ex, 1.3, ez, flip ? 0.9 : 2, 2.6, flip ? 2 : 0.9, dark); box(ex, 2.7, ez, flip ? 1.6 : 2.6, 0.12, flip ? 2.6 : 1.6, metal); }
      }
      const [tx, tz] = P(-10, 0); tree(tx, tz);
      const [ux, uz] = P(10, 0.5); tree(ux, uz);
      const [bx2, bz2] = P(0, 0); bench(bx2, bz2, !flip);
      lootSites.push({ x: P(3, 0)[0], z: P(3, 0)[1] });
      nooks.push({ x: P(-5, 0)[0], z: P(-5, 0)[1] });
    } else if (kind === 'five') {
      const [x, z] = P(0, -8), [w, d] = S(24, 8);
      building(x, z, w, d, 15, brickTex, 3, 3);
      const [x2, z2] = P(-8.5, 4.5), [w2, d2] = S(8, 14);
      building(x2, z2, w2, d2, 15, brickTex, 3, 3);
      for (const [lx, lz] of [[3, 2], [9, 8], [2, 10]]) { const [tx, tz] = P(lx, lz); tree(tx, tz); }
      const [qx, qz] = P(6, 5); bench(qx, qz, flip);
      // Качели.
      const [sx, sz] = P(7, 9.5);
      box(sx, 1.9, sz, 2.2, 0.1, 0.1, metal); box(sx - 1.1, 0.95, sz, 0.1, 1.9, 0.1, metal, true); box(sx + 1.1, 0.95, sz, 0.1, 1.9, 0.1, metal, true);
      box(sx, 0.55, sz, 0.5, 0.06, 0.25, lambert({ color: 0xb8322a }));
      lootSites.push({ x: P(4, 4)[0], z: P(4, 4)[1] });
      nooks.push({ x: P(-1, 3)[0], z: P(-1, 3)[1] });
    } else if (kind === 'shops') {
      const [x, z] = P(0, -6.5), [w, d] = S(22, 9);
      const base = pick(['#c9c2b0', '#b8c4c8', '#d0b8a0']);
      building(x, z, w, d, 4.2, (rx, ry) => plasterTex(base, rx, ry), 4, 4.2);
      const names: Array<[string, string]> = [['АПТЕКА', '#2f8a4a'], ['ХОЗТОВАРЫ', '#8a5a2a'], ['ПОЧТА', '#2a4f9a'], ['ХЛЕБ', '#b8862a'], ['ОДЕЖДА', '#8a2a5a']];
      for (const e of [-7, 0, 7]) { const [n, bg] = pick(names); const [sx, sz] = P(e, -1.95); sign(n, sx, 3.5, sz, flip ? Math.PI / 2 : 0, 5, bg); }
      for (const e of [-8, -3, 4]) if (r() < 0.75) { const [px, pz] = P(e, 7); car(px, pz, flip); }
      lootSites.push({ x: P(-7, -1.2)[0], z: P(-7, -1.2)[1] }, { x: P(7, -1.2)[0], z: P(7, -1.2)[1] });
    } else if (kind === 'school') {
      const [x, z] = P(0, -4), [w, d] = S(22, 12);
      building(x, z, w, d, 10.5, (rx, ry) => plasterTex('#d8c070', rx, ry), 3.5, 3.5);
      const [sx, sz] = P(0, 2.05); sign('ШКОЛА № 3', sx, 3.6, sz, flip ? Math.PI / 2 : 0, 5, '#7a2a2a');
      const [fx, fz] = P(8, 6); box(fx, 3, fz, 0.08, 6, 0.08, metal, true);
      for (const [lx, lz] of [[-10, 8], [-4, 10], [10, 10]]) { const [tx, tz] = P(lx, lz); tree(tx, tz); }
      const [qx, qz] = P(2, 9); bench(qx, qz, !flip);
      lootSites.push({ x: P(-3, 3)[0], z: P(-3, 3)[1] });
      nooks.push({ x: P(5, 4)[0], z: P(5, 4)[1] });
    } else if (kind === 'garages') {
      for (const s of [-1, 1]) {
        const doorTex = canvasTex(32, 16, (g) => { g.fillStyle = '#7a7a78'; g.fillRect(0, 0, 32, 16); g.fillStyle = pick(['#3a6a8a', '#8a3a2a', '#4a7a4a', '#8a7a3a', '#5a5a62']); g.fillRect(3, 2, 26, 14); g.strokeStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.moveTo(16, 2); g.lineTo(16, 16); g.stroke(); grain(g, 32, 16, 30, 0.2); }, [6, 1]);
        const wallM = lambert({ color: 0x7a7a78 }), doorM = lambert({ map: doorTex });
        const [x, z] = P(0, s * 9), [w, d] = S(22, 6);
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.7, d), flip ? [doorM, doorM, roofFlat, roofFlat, wallM, wallM] : [wallM, wallM, roofFlat, roofFlat, doorM, doorM]);
        m.position.set(x, 1.35, z);
        scene.add(m);
        houses.push({ box: solid(x, z, w, d), h: 2.7 });
      }
      if (r() < 0.7) { const [px, pz] = P(-4, 0.5); car(px, pz, !flip); }
      lootSites.push({ x: P(6, 0)[0], z: P(6, 0)[1] }, { x: P(-9, 2)[0], z: P(-9, 2)[1] });
      nooks.push({ x: P(10, -1)[0], z: P(10, -1)[1] });
    } else if (kind === 'park') {
      for (let i = 0; i < 9; i++) tree(cx + (r() - 0.5) * 22, cz + (r() - 0.5) * 22);
      bench(cx - 3, cz, false); bench(cx + 3, cz, false);
      box(cx, 0.25, cz + 6, 3, 0.3, 3, lambert({ color: 0xc8b070 }));
      lootSites.push({ x: cx, z: cz - 5 });
      nooks.push({ x: cx + 6, z: cz + 6 });
    } else if (kind === 'village') {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const w = 6.4 + r() * 1.4, d = 5.4 + r() * 1.2, h = 3 + r() * 0.5;
        const x = cx + sx * (6.6 + r()), z = cz + sz * (6.6 + r());
        const mat = lambert({ map: woodTex(pick(WOOD)) });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, h / 2, z);
        const roof = new THREE.Mesh(gable(w + 0.8, d + 0.8, 1.9), pick(roofCol));
        roof.position.set(x, h, z);
        scene.add(m, roof);
        houses.push({ box: solid(x, z, w, d), h });
        box(x + sx * 0.5, 0.2, z - sz * (d / 2 + 0.4), 1.4, 0.3, 0.8, benchMat); // крыльцо
        if (r() < 0.6) box(x - sx * (w / 2 + 0.9), 0.5, z, 1.2, 1, 2.2, lambert({ color: 0x6a5a48 }), true); // поленница
      }
      for (let i = 0; i < 3; i++) tree(cx + (r() - 0.5) * 6, cz + (r() - 0.5) * 22);
      // Забор по краю с проходами посередине сторон.
      for (const s of [-1, 1]) for (const e of [-1, 1]) {
        box(cx + e * 8, 0.6, cz + s * 12.7, 9.6, 1.1, 0.1, fenceMat, true);
        box(cx + s * 12.7, 0.6, cz + e * 8, 0.1, 1.1, 9.6, fenceMat, true);
      }
      lootSites.push({ x: cx + 1.5, z: cz + (r() < 0.5 ? -3 : 3) });
      if (r() < 0.5) nooks.push({ x: cx - 1, z: cz });
    } else if (kind === 'shop') {
      for (const lz of [-9, -5.5, 6, 9.5]) if (r() < 0.8) car(cx + 7 + r() * 2, cz + lz, true);
      tree(cx - 10, cz - 10); tree(cx - 10, cz + 10);
    }
  }

  // ───────── Улицы: машины, остановки, урны ─────────
  const lines = streetLines();
  for (let i = 0; i < lines.length; i++) for (let b = 0; b < CFG.blocks; b++) {
    const c = first + b * CFG.pitch;
    for (const alongX of [false, true]) {
      if (r() < 0.45) { const off = (r() < 0.5 ? -1 : 1) * 3.7, pos = c + (r() - 0.5) * 14; if (alongX) car(pos, lines[i] + off, true); else car(lines[i] + off, pos, false); }
      if (r() < 0.16 && i > 0 && i < lines.length - 1) {
        // Остановка.
        const pos = c + 8, side = r() < 0.5 ? -1 : 1, a = lines[i] + side * 4.55;
        const stop = lambert({ color: 0x3a6a9a });
        if (alongX) { box(pos, 1.25, a, 3, 2.5, 0.1, stop, true); box(pos, 2.55, a - side * 0.6, 3.2, 0.1, 1.4, metal); bench(pos, a - side * 0.5, true); lootSites.push({ x: pos + 2.2, z: a - side * 0.6 }); }
        else { box(a, 1.25, pos, 0.1, 2.5, 3, stop, true); box(a - side * 0.6, 2.55, pos, 1.4, 0.1, 3.2, metal); bench(a - side * 0.5, pos, false); lootSites.push({ x: a - side * 0.6, z: pos + 2.2 }); }
      }
    }
  }

  // ───────── Фонари ─────────
  const lamps: Lamp[] = [];
  const poleMat = lambert({ color: 0x2a2a30 });
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.6, 6);
  const armGeo = new THREE.BoxGeometry(1.1, 0.08, 0.08);
  const headGeo = new THREE.BoxGeometry(0.35, 0.12, 0.25);
  const addLamp = (x: number, z: number, dx: number, dz: number) => {
    if (Math.abs(z) < 3 && x > 20 && x < 25) return; // не загораживать вход в магазин
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.3, z);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(x + dx * 0.5, 4.55, z + dz * 0.5);
    if (dz) arm.rotation.y = Math.PI / 2;
    const head = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xcfe2ff }));
    head.position.set(x + dx, 4.45, z + dz);
    if (dz) head.rotation.y = Math.PI / 2;
    scene.add(pole, arm, head);
    const k = r();
    lamps.push({ x, z, lx: x + dx, lz: z + dz, head, mode: k < 0.3 ? 'off' : k < 0.55 ? 'flicker' : 'on', phase: r() * 10 });
    solid(x, z, 0.24, 0.24);
  };
  for (let i = 0; i < lines.length; i++) for (let b = 0; b < CFG.blocks; b++) {
    const c = first + b * CFG.pitch;
    const side = (i + b) % 2 ? 1 : -1;
    if ((i > 0 && i < lines.length - 1) || side === (i === 0 ? 1 : -1)) {
      addLamp(lines[i] + side * 4.5, c, -side, 0);
      addLamp(c, lines[i] + side * 4.5, 0, -side);
    }
  }
  const pool = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xbcd2ff, 0, 16, 1.2); scene.add(l); return l; });

  // ───────── Небо ─────────
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xe8e3d2, fog: false }));
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }));
  scene.add(moon, sunBall);
  const N = 320;
  const base = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { base[i * 3] = (r() - 0.5) * 24; base[i * 3 + 1] = r() * 9; base[i * 3 + 2] = (r() - 0.5) * 24; }
  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
  const ashMat = new THREE.PointsMaterial({ color: 0xb8b8c4, size: 0.05, transparent: true });
  const ash = new THREE.Points(ashGeo, ashMat);
  ash.frustumCulled = false;
  scene.add(ash);

  // Граница города: стена помех — дальше всё стёрто.
  const wallTex = canvasTex(64, 64, (g, w, h) => {
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const v = Math.floor(r() * 90); g.fillStyle = `rgb(${v},${v},${v + 10})`; g.fillRect(x, y, 2, 2); }
  }, [40, 6]);
  const wallMat = new THREE.MeshBasicMaterial({ map: wallTex, transparent: true, opacity: 0.85, fog: false, side: THREE.DoubleSide });
  const edge = half + 6;
  for (const [x, z, ry] of [[0, -edge, 0], [0, edge, 0], [-edge, 0, Math.PI / 2], [edge, 0, Math.PI / 2]] as const) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(edge * 2, 34), wallMat);
    wall.position.set(x, 17, z);
    wall.rotation.y = ry;
    scene.add(wall);
  }

  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffc86a });
  const lightWindow = (at: Vec2) => {
    let best = houses[0], bd = Infinity;
    for (const hs of houses) {
      const cx = Math.max(hs.box.minX, Math.min(hs.box.maxX, at.x)), cz = Math.max(hs.box.minZ, Math.min(hs.box.maxZ, at.z));
      const d = (cx - at.x) ** 2 + (cz - at.z) ** 2;
      if (d < bd) { bd = d; best = hs; }
    }
    const b = best.box;
    const cx = Math.max(b.minX + 1.5, Math.min(b.maxX - 1.5, at.x)), cz = Math.max(b.minZ + 1.5, Math.min(b.maxZ - 1.5, at.z));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.6), windowMat);
    const y = Math.min(best.h - 1.2, 3.2);
    if (at.x < b.minX) { win.position.set(b.minX - 0.03, y, cz); win.rotation.y = -Math.PI / 2; }
    else if (at.x > b.maxX) { win.position.set(b.maxX + 0.03, y, cz); win.rotation.y = Math.PI / 2; }
    else if (at.z < b.minZ) { win.position.set(cx, y, b.minZ - 0.03); win.rotation.y = Math.PI; }
    else win.position.set(cx, y, b.maxZ + 0.03);
    scene.add(win);
  };

  // ───────── День и ночь ─────────
  const skyN = hex('#0d0f18'), skyD = hex('#9cc3e6'), skyDusk = hex('#d98a5a');
  const hemiN = hex('#5a6488'), hemiD = hex('#ffffff'), gndN = hex('#141218'), gndD = hex('#7a7468');
  const sunN = hex('#8090c0'), sunD = hex('#fff0d8');
  let day = 0;
  const sky = new THREE.Color();
  const setTime = (tod: number) => {
    day = daylight(tod);
    const dusk = Math.max(0, 1 - Math.abs(day - 0.35) / 0.3) * 0.55;
    sky.copy(skyN).lerp(skyD, day).lerp(skyDusk, dusk);
    (scene.background as THREE.Color).copy(sky);
    fog.color.copy(sky);
    fog.near = 3 + day * 12;
    fog.far = 38 + day * 72;
    hemi.color.copy(hemiN).lerp(hemiD, day);
    hemi.groundColor.copy(gndN).lerp(gndD, day);
    hemi.intensity = 0.6 + day * 1.5;
    sun.color.copy(sunN).lerp(sunD, day);
    sun.intensity = 0.4 + day * 1.5;
    const a = (tod - 0.25) * Math.PI * 2;
    if (day > 0.2) sunDir.set(Math.cos(a) * 10, Math.max(3.5, Math.sin(a) * 12), 5).normalize(); else sunDir.set(-6, 12, 4).normalize();
    sunBall.userData.a = a;
    ashMat.opacity = 1 - day * 0.8;
  };
  setTime(0);

  const update = (t: number, cam: THREE.Vector3) => {
    sun.target.position.set(Math.round(cam.x), 0, Math.round(cam.z));
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 70);
    const night = day < 0.3;
    const lit: Array<{ l: Lamp; d: number }> = [];
    for (const l of lamps) {
      const on = night && (l.mode === 'on' || (l.mode === 'flicker' && Math.sin(t * 7 + l.phase) + Math.sin(t * 23 + l.phase * 3) > -0.6));
      (l.head.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xcfe2ff : 0x3a3c42);
      if (on) lit.push({ l, d: (l.lx - cam.x) ** 2 + (l.lz - cam.z) ** 2 });
    }
    lit.sort((a, b) => a.d - b.d);
    pool.forEach((p, i) => {
      const it = lit[i];
      if (it && it.d < 45 * 45) { p.position.set(it.l.lx, 4.2, it.l.lz); p.intensity = 15; } else p.intensity = 0;
    });
    const a = (sunBall.userData.a as number) ?? 0;
    sunBall.position.set(cam.x + Math.cos(a) * 70, Math.sin(a) * 60, cam.z - 40);
    sunBall.visible = Math.sin(a) > -0.05;
    moon.position.set(cam.x - Math.cos(a) * 60, -Math.sin(a) * 55, cam.z - 60);
    moon.visible = Math.sin(a) < 0.1;
    const p = ashGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      p[i * 3] = cam.x + ((((base[i * 3] + Math.sin(t * 0.8 + i) * 0.3 - cam.x) % 24) + 36) % 24) - 12;
      p[i * 3 + 1] = (((base[i * 3 + 1] - t * 0.5) % 9) + 9) % 9;
      p[i * 3 + 2] = cam.z + ((((base[i * 3 + 2] - cam.z) % 24) + 36) % 24) - 12;
    }
    ashGeo.attributes.position.needsUpdate = true;
    wallTex.offset.set(Math.floor(t * 12) * 0.13, Math.floor(t * 12) * 0.31);
  };

  return { scene, boxes, lamps, half, lootSites, nooks, lightWindow, setTime, setShadows: (on) => { sun.castShadow = on; }, update };
}
