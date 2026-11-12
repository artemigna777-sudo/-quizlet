/** Места за пределами двора: магазин «Продукты», в который можно зайти, пост милиции и ящики с припасами на улицах. */
import * as THREE from 'three';
import type { Vec2 } from './config';
import { canvasTex, lambert } from './gfx';
import type { Spot } from './homes';
import { rng, type Box } from './logic';
import { LOOT_NAME, lootMesh, type LootKind } from './loot';
import { loadModel } from './models';
import { SHOP } from './world';

export const POST: Vec2 = { x: -57.5, z: -57.5 };

export async function buildPlaces(scene: THREE.Scene, boxes: Box[], lootSites: readonly Vec2[]): Promise<{ spots: Spot[]; inside(p: Vec2): boolean; drop(id: string, kind: LootKind, at: Vec2): Spot }> {
  const [shelf, table, crate, barrel, cash, rack, wet] = await Promise.all(['Shelf_01', 'painted_wooden_table', 'wooden_crate_02', 'barrel_03', 'CashRegister_01', 'steel_frame_shelves_01', 'WetFloorSign_01'].map(loadModel));
  const r = rng(555);
  const spots: Spot[] = [];
  const solid = (x0: number, z0: number, x1: number, z1: number) => boxes.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
  const loot = (id: string, kind: LootKind, x: number, y: number, z: number, at: Vec2 = { x, z }, name = LOOT_NAME[kind]) => {
    const m = lootMesh(kind);
    m.position.set(x, y, z);
    m.rotation.y = r() * 6;
    scene.add(m);
    spots.push({ id, kind: 'loot', room: 'A', at, title: name, text: '', mesh: m, loot: kind });
  };

  // ───────── Магазин ─────────
  const X0 = SHOP.x - 11, X1 = SHOP.x + 3, Z0 = -6, Z1 = 6, H = 3.4, F = 0.05;
  const wallMat = lambert({ map: canvasTex(32, 32, (g) => { g.fillStyle = '#e4dcc4'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#7fa890'; g.fillRect(0, 18, 32, 14); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 17, 32, 1); }, [6, 1]) });
  const wall = (x0: number, z0: number, x1: number, z1: number, y0 = 0, y1 = H, collide = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), wallMat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    scene.add(m);
    if (collide) solid(x0, z0, x1, z1);
  };
  wall(X0, Z0, X1, Z0 + 0.25); wall(X0, Z1 - 0.25, X1, Z1); wall(X1 - 0.25, Z0, X1, Z1);
  wall(X0, Z0, X0 + 0.25, -0.8); wall(X0, 0.8, X0 + 0.25, Z1); wall(X0, -0.8, X0 + 0.25, 0.8, 2.2, H, false);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshLambertMaterial({ map: canvasTex(16, 16, (g) => { g.fillStyle = '#c8c0a8'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#8a8474'; g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8); }, [10, 9]) }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((X0 + X1) / 2, F + 0.02, 0);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0 + 0.6, 0.3, Z1 - Z0 + 0.6), lambert({ color: 0x55565c }));
  ceil.position.set((X0 + X1) / 2, H + 0.15, 0);
  const signTex = canvasTex(128, 24, (g) => { g.fillStyle = '#b8322a'; g.fillRect(0, 0, 128, 24); g.fillStyle = '#fff'; g.font = '700 18px sans-serif'; g.textAlign = 'center'; g.fillText('ПРОДУКТЫ', 64, 18); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), lambert({ map: signTex }));
  sign.position.set(X0 - 0.03, 2.85, 0); sign.rotation.y = -Math.PI / 2;
  scene.add(floor, ceil, sign);
  const winMat = lambert({ color: 0x2c3f5c });
  for (const z of [-3.5, 3.5]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.4), winMat); w.position.set(X0 - 0.03, 1.5, z); w.rotation.y = -Math.PI / 2; scene.add(w); }
  const canMats = [0xb8322a, 0xd0a020, 0x3a7a4a, 0x2a5fa8, 0xc8c0b0].map((c) => lambert({ color: c }));
  const canGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 6);
  const putShelf = (x: number, z: number, rot: number) => {
    const o = shelf.root.clone();
    o.position.set(x, F, z); o.rotation.y = rot;
    for (const y of [0.07, 0.48, 0.88, 1.28, 1.68]) for (let i = 0; i < 7; i++) if (r() < 0.3) { const c = new THREE.Mesh(canGeo, canMats[Math.floor(r() * canMats.length)]); c.position.set(-0.38 + i * 0.125, y + 0.05, 0); o.add(c); }
    scene.add(o);
    solid(x - 0.5, z - 0.16, x + 0.5, z + 0.16);
  };
  for (let i = 0; i < 5; i++) { putShelf(X0 + 3.4 + i * 2.1, Z0 + 0.42, 0); putShelf(X0 + 3.4 + i * 2.1, Z1 - 0.42, Math.PI); }
  for (let i = 0; i < 4; i++) { putShelf(X0 + 6 + i * 1.05, 0.16, 0); putShelf(X0 + 6 + i * 1.05, -0.16, Math.PI); }
  const counter = table.root.clone();
  counter.position.set(X0 + 2.2, F, 3.4); counter.rotation.y = Math.PI / 2;
  scene.add(counter);
  solid(X0 + 1.6, 2.2, X0 + 2.8, 4.6);
  const till = cash.root.clone();
  till.position.set(X0 + 2.2, F + table.size.y, 3.0); till.rotation.y = Math.PI / 2;
  const sgn = wet.root.clone(); sgn.position.set(X0 + 2.6, F, -0.9); sgn.rotation.y = 0.4;
  scene.add(till, sgn);
  for (const z of [-4.2, -2.4]) { const k = rack.root.clone(); k.position.set(X1 - 0.6, F, z); k.rotation.y = -Math.PI / 2; scene.add(k); solid(X1 - 0.9, z - 0.55, X1 - 0.3, z + 0.55); }
  for (const [x, z] of [[X1 - 1.2, 2.5], [X1 - 1.4, -3.2]]) { const c = crate.root.clone(); c.position.set(x, F, z); c.rotation.y = r() * 3; scene.add(c); solid(x - 0.5, z - 0.5, x + 0.5, z + 0.5); }
  const b = barrel.root.clone(); b.position.set(X1 - 1.1, F, 4.6); scene.add(b); solid(X1 - 1.45, 4.25, X1 - 0.75, 4.95);
  ([['food', 3.4, 0.62, 'тушёнка'], ['food', 7.6, 1.02, 'сгущёнка'], ['water', 11.8, 0.62, 'минералка'], ['food', 9.7, 1.42, 'шпроты']] as const).forEach(([k, dx, y, n], i) => loot(`loot:shop:n${i}`, k, X0 + dx, F + y, Z0 + 0.42, { x: X0 + dx, z: Z0 + 1.0 }, n));
  ([['water', 5.5, 0.62, 'лимонад «Буратино»'], ['food', 9.7, 0.62, 'перловка с мясом'], ['water', 11.8, 1.02, 'вода 0,5']] as const).forEach(([k, dx, y, n], i) => loot(`loot:shop:s${i}`, k, X0 + dx, F + y, Z1 - 0.42, { x: X0 + dx, z: Z1 - 1.0 }, n));
  loot('loot:shop:c0', 'water', X0 + 8.1, F + 1.02, 0.16, { x: X0 + 8.1, z: 0.8 }, 'квас');
  loot('loot:shop:c1', 'food', X0 + 7.05, F + 0.62, -0.16, { x: X0 + 7.05, z: -0.8 }, 'горошек');
  const noteMat = new THREE.MeshBasicMaterial({ color: 0xc8c0aa });
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), noteMat);
  note.rotation.set(-Math.PI / 2, 0, 0.3); note.position.set(X0 + 2.2, F + 0.98, 3.8);
  scene.add(note);
  spots.push({ id: 'note:shop', kind: 'note', room: 'A', at: { x: X0 + 2.9, z: 3.8 }, title: 'Тетрадь под кассой', mesh: note,
    text: 'В долг:\nЗоя (2-й дом) — килька, 6 банок. Отдаст с пенсии.\nГена-лодочник — шурупы спрашивал. Сказала: у нас продукты.\nТёмина мама — хлеб, молоко. Записать на неё, не на мальчика.\n\nУчастковый оставил автомат у поста на углу, за гаражами, и не вернулся. Спросила, кто у нас участковый. Никто не вспомнил.' });

  // ───────── Пост милиции: здесь лежит автомат ─────────
  const post = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 2.6), lambert({ map: canvasTex(32, 32, (g) => { g.fillStyle = '#d8dce4'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#2a4f9a'; g.fillRect(0, 12, 32, 5); g.fillStyle = '#2c3f5c'; g.fillRect(8, 2, 16, 9); }) }));
  post.position.set(POST.x, 1.4, POST.z);
  scene.add(post);
  solid(POST.x - 1.3, POST.z - 1.3, POST.x + 1.3, POST.z + 1.3);
  const pc = crate.root.clone(); pc.scale.setScalar(0.7); pc.position.set(POST.x + 2.2, 0, POST.z + 0.2); scene.add(pc);
  loot('loot:gun', 'gun', POST.x + 2.2, 0.36, POST.z + 0.2);
  loot('loot:post-ammo', 'ammo', POST.x + 2.3, 0.02, POST.z + 1.2);

  // ───────── Ящики на улицах ─────────
  lootSites.forEach((s, i) => {
    const c = crate.root.clone();
    c.scale.setScalar(0.55); c.position.set(s.x, 0.05, s.z); c.rotation.y = r() * 3;
    scene.add(c);
    const k = r();
    loot(`loot:w:${i}`, k < 0.42 ? 'food' : k < 0.8 ? 'water' : 'ammo', s.x, 0.05 + 0.27, s.z);
  });

  return {
    spots,
    inside: (p) => p.x > X0 && p.x < X1 && p.z > Z0 && p.z < Z1,
    drop(id, kind, at) { loot(id, kind, at.x, 0.03, at.z); return spots.pop()!; },
  };
}
