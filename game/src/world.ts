/** Город: кварталы с домами, улицы, фонари, луна, пепел, стена помех на границе. */
import * as THREE from 'three';
import { CFG, type Vec2 } from './config';
import { canvasTex, lambert } from './gfx';
import { rng, streetLines, type Box } from './logic';

export interface Lamp { x: number; z: number; lx: number; lz: number; head: THREE.Mesh; mode: 'on' | 'off' | 'flicker'; phase: number }
export interface World {
  scene: THREE.Scene;
  boxes: Box[];
  lamps: Lamp[];
  half: number;
  /** Окно ближайшего дома зажигается, когда найдено воспоминание. */
  lightWindow(at: Vec2): void;
  update(t: number, cam: THREE.Vector3): void;
}

function facadeTex(r: () => number) {
  return canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = ['#2b2730', '#2e2a26', '#26292e', '#302a2a', '#2a2e2a'][Math.floor(r() * 5)];
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.25})`; g.fillRect(r() * w, r() * h, 2, 2); }
    for (let row = 0; row < 5; row++) for (let c = 0; c < 3; c++) {
      const x = 6 + c * 20, y = 8 + row * 24;
      g.fillStyle = '#08080b';
      g.fillRect(x, y, 12, 14);
      if (r() < 0.5) { g.strokeStyle = '#8a8f9c'; g.beginPath(); g.moveTo(x + 2, y + 3); g.lineTo(x + 7, y + 8); g.lineTo(x + 4, y + 13); g.stroke(); }
      if (r() < 0.25) { g.fillStyle = '#3a2c1f'; g.fillRect(x, y + 5, 12, 2); g.fillRect(x, y + 9, 12, 2); }
    }
    g.fillStyle = '#121014';
    g.fillRect(24, 110, 16, 18);
  });
}

export function buildWorld(): World {
  const r = rng(20261111);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CFG.fog);
  scene.fog = new THREE.Fog(CFG.fog, 3, 38);
  scene.add(new THREE.HemisphereLight(0x5a6488, 0x141218, 1.5));
  const moonLight = new THREE.DirectionalLight(0x8090c0, 1.0);
  moonLight.position.set(-6, 12, 4);
  scene.add(moonLight);

  const half = (CFG.blocks / 2) * CFG.pitch;
  const span = half * 2 + 40;

  // Асфальт.
  const asphalt = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#1b1b20';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},255,${0.04 + r() * 0.05})`; g.fillRect(r() * w, r() * h, 1, 1); }
    g.strokeStyle = '#0a0a0c';
    g.beginPath(); g.moveTo(10, 0); g.lineTo(18, 20); g.lineTo(12, 40); g.lineTo(22, 64); g.stroke();
  }, [span / 4, span / 4]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(span, span), lambert({ map: asphalt }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Разметка: пунктир по осям улиц.
  const dashTex = canvasTex(8, 32, (g) => { g.clearRect(0, 0, 8, 32); g.fillStyle = '#77776a'; g.fillRect(2, 2, 4, 14); }, [1, (half * 2) / 6]);
  const dashMat = new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, alphaTest: 0.5, fog: true });
  for (const v of streetLines()) {
    for (const along of ['z', 'x'] as const) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35, half * 2), dashMat);
      m.rotation.x = -Math.PI / 2;
      if (along === 'z') m.position.set(v, 0.02, 0);
      else { m.rotation.z = Math.PI / 2; m.position.set(0, 0.02, v); }
      scene.add(m);
    }
  }

  // Кварталы: плита тротуара и четыре дома.
  const boxes: Box[] = [];
  const slabTex = canvasTex(32, 32, (g) => { g.fillStyle = '#2a2a2e'; g.fillRect(0, 0, 32, 32); g.strokeStyle = '#1a1a1d'; g.strokeRect(0, 0, 32, 32); }, [8, 8]);
  const slabMat = lambert({ map: slabTex });
  const roofMat = lambert({ color: 0x18151a });
  const facades = Array.from({ length: 6 }, () => lambert({ map: facadeTex(r) }));
  const inner = CFG.pitch - CFG.street;
  const first = -((CFG.blocks - 1) / 2) * CFG.pitch;
  const houses: Array<{ box: Box; h: number }> = [];
  for (let bx = 0; bx < CFG.blocks; bx++) for (let bz = 0; bz < CFG.blocks; bz++) {
    const cx = first + bx * CFG.pitch, cz = first + bz * CFG.pitch;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(inner, 0.14, inner), slabMat);
    slab.position.set(cx, 0.07, cz);
    scene.add(slab);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = 9 + r() * 2.2, d = 9 + r() * 2.2, h = 5.5 + r() * 5.5;
      const x = cx + sx * 6.6, z = cz + sz * 6.6;
      const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facades[Math.floor(r() * facades.length)]);
      house.position.set(x, h / 2, z);
      scene.add(house);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 1.8, 4), roofMat);
      roof.position.set(x, h + 0.9, z);
      roof.rotation.y = Math.PI / 4;
      scene.add(roof);
      const box = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
      boxes.push(box);
      houses.push({ box, h });
    }
  }

  // Фонари: у середины каждого квартала, вдоль улиц.
  const lamps: Lamp[] = [];
  const poleMat = lambert({ color: 0x111114 });
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.6, 6);
  const armGeo = new THREE.BoxGeometry(1.1, 0.08, 0.08);
  const headGeo = new THREE.BoxGeometry(0.35, 0.12, 0.25);
  const addLamp = (x: number, z: number, dx: number, dz: number) => {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.3, z);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(x + dx * 0.5, 4.55, z + dz * 0.5);
    if (dz) arm.rotation.y = Math.PI / 2;
    const head = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xcfe2ff, fog: false }));
    head.position.set(x + dx, 4.45, z + dz);
    if (dz) head.rotation.y = Math.PI / 2;
    scene.add(pole, arm, head);
    const k = r();
    lamps.push({ x, z, lx: x + dx, lz: z + dz, head, mode: k < 0.3 ? 'off' : k < 0.55 ? 'flicker' : 'on', phase: r() * 10 });
    boxes.push({ minX: x - 0.12, maxX: x + 0.12, minZ: z - 0.12, maxZ: z + 0.12 });
  };
  const lines = streetLines();
  for (let i = 0; i < lines.length; i++) for (let b = 0; b < CFG.blocks; b++) {
    const c = first + b * CFG.pitch;
    const side = (i + b) % 2 ? 1 : -1;
    if (i > 0 && i < lines.length - 1 || side === (i === 0 ? 1 : -1)) {
      addLamp(lines[i] + side * 4.5, c, -side, 0);
      addLamp(c, lines[i] + side * 4.5, 0, -side);
    }
  }
  const pool = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xbcd2ff, 0, 16, 1.2); scene.add(l); return l; });

  // Луна и пепел следуют за камерой.
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xe8e3d2, fog: false }));
  scene.add(moon);
  const N = 320;
  const base = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { base[i * 3] = (r() - 0.5) * 24; base[i * 3 + 1] = r() * 9; base[i * 3 + 2] = (r() - 0.5) * 24; }
  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
  const ash = new THREE.Points(ashGeo, new THREE.PointsMaterial({ color: 0xb8b8c4, size: 0.05 }));
  ash.frustumCulled = false;
  scene.add(ash);

  // Граница города: стена помех — дальше всё стёрто.
  const wallTex = canvasTex(64, 64, (g, w, h) => {
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const v = Math.floor(r() * 90); g.fillStyle = `rgb(${v},${v},${v + 10})`; g.fillRect(x, y, 2, 2); }
  }, [40, 6]);
  const wallMat = new THREE.MeshBasicMaterial({ map: wallTex, transparent: true, opacity: 0.85, fog: false, side: THREE.DoubleSide });
  const edge = half + 6;
  for (const [x, z, ry] of [[0, -edge, 0], [0, edge, 0], [-edge, 0, Math.PI / 2], [edge, 0, Math.PI / 2]] as const) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(edge * 2, 30), wallMat);
    wall.position.set(x, 15, z);
    wall.rotation.y = ry;
    scene.add(wall);
  }

  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffc86a, fog: true });
  const lightWindow = (at: Vec2) => {
    // Ближайший дом и его стена, обращённая к точке.
    let best = houses[0], bd = Infinity;
    for (const hs of houses) {
      const cx = Math.max(hs.box.minX, Math.min(hs.box.maxX, at.x)), cz = Math.max(hs.box.minZ, Math.min(hs.box.maxZ, at.z));
      const d = (cx - at.x) ** 2 + (cz - at.z) ** 2;
      if (d < bd) { bd = d; best = hs; }
    }
    const b = best.box;
    const cx = Math.max(b.minX + 1.5, Math.min(b.maxX - 1.5, at.x)), cz = Math.max(b.minZ + 1.5, Math.min(b.maxZ - 1.5, at.z));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.6), windowMat);
    const y = Math.min(best.h - 1.5, 3.2);
    if (at.x < b.minX) { win.position.set(b.minX - 0.03, y, cz); win.rotation.y = -Math.PI / 2; }
    else if (at.x > b.maxX) { win.position.set(b.maxX + 0.03, y, cz); win.rotation.y = Math.PI / 2; }
    else if (at.z < b.minZ) { win.position.set(cx, y, b.minZ - 0.03); win.rotation.y = Math.PI; }
    else win.position.set(cx, y, b.maxZ + 0.03);
    scene.add(win);
    const glow = new THREE.PointLight(0xffa64d, 10, 14, 1.3);
    glow.position.copy(win.position).add(new THREE.Vector3(Math.sign(at.x - cx) * 1.2 || 0, 0, Math.sign(at.z - cz) * 1.2 || 0));
    scene.add(glow);
  };

  const update = (t: number, cam: THREE.Vector3) => {
    // Мигание фонарей и три ближайших горящих — с настоящим светом.
    const lit: Array<{ l: Lamp; d: number }> = [];
    for (const l of lamps) {
      const on = l.mode === 'on' || (l.mode === 'flicker' && Math.sin(t * 7 + l.phase) + Math.sin(t * 23 + l.phase * 3) > -0.6);
      (l.head.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xcfe2ff : 0x222428);
      if (on) lit.push({ l, d: (l.lx - cam.x) ** 2 + (l.lz - cam.z) ** 2 });
    }
    lit.sort((a, b) => a.d - b.d);
    pool.forEach((p, i) => {
      const it = lit[i];
      if (it && it.d < 45 * 45) { p.position.set(it.l.lx, 4.2, it.l.lz); p.intensity = 15; } else p.intensity = 0;
    });
    moon.position.set(cam.x - 30, 34, cam.z - 60);
    const p = ashGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      p[i * 3] = cam.x + ((((base[i * 3] + Math.sin(t * 0.8 + i) * 0.3 - cam.x) % 24) + 36) % 24) - 12;
      p[i * 3 + 1] = (((base[i * 3 + 1] - t * 0.5) % 9) + 9) % 9;
      p[i * 3 + 2] = cam.z + ((((base[i * 3 + 2] - cam.z) % 24) + 36) % 24) - 12;
    }
    ashGeo.attributes.position.needsUpdate = true;
    wallTex.offset.set(Math.floor(t * 12) * 0.13, Math.floor(t * 12) * 0.31);
  };

  return { scene, boxes, lamps, half, lightWindow, update };
}
