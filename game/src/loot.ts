/** Припасы и оружие: как выглядят и как называются. Всё рисуется кодом. */
import * as THREE from 'three';
import { canvasTex, lambert } from './gfx';

export type LootKind = 'food' | 'water' | 'ammo' | 'axe' | 'gun' | 'parts';
export const LOOT_NAME: Record<LootKind, string> = { food: 'консервы', water: 'вода', ammo: 'патроны', axe: 'топор', gun: 'автомат', parts: 'детали' };
const basic = (color: number) => new THREE.MeshBasicMaterial({ color });
const part = (g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m; };

/** Топор и автомат — и на земле, и в руках. */
export function axeMesh(): THREE.Group {
  const g = new THREE.Group();
  const wood = lambert({ map: canvasTex(32, 64, (c) => {
    c.fillStyle = '#8b5c37'; c.fillRect(0, 0, 32, 64);
    for (let x = 0; x < 32; x += 2) {
      c.strokeStyle = x % 4 ? '#a57a4b' : '#593d27';
      c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x - 4, 24, x + 3, 41, x - 1, 64); c.stroke();
    }
  }) });
  const forged = lambert({ map: canvasTex(32, 32, (c) => {
    c.fillStyle = '#555359'; c.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 90; i++) {
      c.fillStyle = i % 3 ? '#686970' : '#775239';
      c.fillRect(i * 17 % 31, (i * 11 + (i >> 1)) % 31, 1 + i % 3, 1);
    }
  }) });
  const edge = lambert({ color: 0xb7c2c9 }), leather = lambert({ color: 0x433227 });
  const handle = new THREE.LatheGeometry([
    [.012, -.334], [.027, -.323], [.026, -.295], [.017, -.24], [.017, -.1],
    [.021, .05], [.018, .17], [.022, .255], [.019, .305], [.008, .319],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 10);
  const positions = handle.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    positions.setXYZ(i, positions.getX(i) - Math.sin((y + .33) * 6.2) * .022, y, positions.getZ(i) * .77);
  }
  handle.computeVertexNormals();
  part(g, handle, wood);
  const profile = new THREE.Shape();
  profile.moveTo(-.067, .205); profile.lineTo(-.066, .29); profile.lineTo(.06, .3);
  profile.quadraticCurveTo(.12, .31, .207, .342);
  profile.quadraticCurveTo(.239, .249, .187, .157);
  profile.quadraticCurveTo(.148, .177, .068, .197); profile.closePath();
  const head = new THREE.ExtrudeGeometry(profile, { depth: .030, bevelEnabled: true, bevelSegments: 1, bevelThickness: .006, bevelSize: .006, steps: 1, curveSegments: 5 });
  const uv = head.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 9);
  part(g, head, forged, 0, 0, -.015);
  const blade = new THREE.Shape();
  blade.moveTo(.207, .342); blade.quadraticCurveTo(.239, .249, .187, .157);
  blade.lineTo(.17, .166); blade.quadraticCurveTo(.211, .251, .192, .332); blade.closePath();
  part(g, new THREE.ExtrudeGeometry(blade, { depth: .037, bevelEnabled: false, curveSegments: 6 }), edge, 0, 0, -.0185);
  part(g, new THREE.BoxGeometry(.019, .018, .018), leather, .005, .308, 0);
  for (let y = -.256; y < -.13; y += .021) {
    const strip = part(g, new THREE.CylinderGeometry(.020, .020, .014, 9), leather, -Math.sin((y + .33) * 6.2) * .022, y, 0, .19);
    strip.scale.z = .83;
  }
  return g;
}
export function gunMesh(): THREE.Group {
  const g = new THREE.Group();
  const steel = lambert({ map: canvasTex(32, 32, (c) => {
    c.fillStyle = '#41444b'; c.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 70; i++) { c.fillStyle = i % 3 ? '#373a40' : '#666970'; c.fillRect(i * 17 % 31, i * 13 % 31, 1 + i % 5, 1); }
    c.fillStyle = '#747278'; c.fillRect(0, 0, 32, 1); c.fillRect(0, 31, 32, 1);
  }) });
  const wood = lambert({ map: canvasTex(32, 32, (c) => {
    c.fillStyle = '#8b5935'; c.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 16; i++) { c.strokeStyle = i % 2 ? '#a7784e' : '#5d3928'; c.beginPath(); c.moveTo(0, i * 2); c.bezierCurveTo(10, i * 2 - 5, 20, i * 2 + 4, 32, i * 2 - 1); c.stroke(); }
  }) });
  const dark = lambert({ color: 0x252831 }), edge = lambert({ color: 0x7d8086 });
  const q = Math.PI / 2;
  part(g, new THREE.BoxGeometry(0.058, 0.082, 0.36), steel, 0, 0.004, 0.045);
  part(g, new THREE.CylinderGeometry(0.029, 0.029, 0.29, 8), steel, 0, 0.035, 0.02, q);
  part(g, new THREE.CylinderGeometry(0.013, 0.013, 0.37, 8), steel, 0, 0.02, -0.315, q);
  part(g, new THREE.BoxGeometry(0.056, 0.058, 0.20), wood, 0, 0.005, -0.21);
  part(g, new THREE.BoxGeometry(0.04, 0.026, 0.15), wood, 0, 0.052, -0.19);
  part(g, new THREE.CylinderGeometry(0.018, 0.018, 0.047, 8), steel, 0, 0.02, -0.49, q);
  part(g, new THREE.CircleGeometry(0.012, 8), dark, 0, 0.02, -0.515, Math.PI);
  part(g, new THREE.BoxGeometry(0.028, 0.06, 0.035), steel, 0, 0.059, -0.43);
  part(g, new THREE.BoxGeometry(0.012, 0.028, 0.018), edge, 0, 0.088, -0.43);
  part(g, new THREE.BoxGeometry(0.041, 0.076, 0.245), wood, 0, -0.025, 0.325, -0.15);
  part(g, new THREE.BoxGeometry(0.046, 0.083, 0.018), steel, 0, -0.043, 0.444);
  for (let i = 0; i < 3; i++) {
    const piece = part(g, new THREE.BoxGeometry(0.043, 0.062, 0.079), steel, 0, -0.055 - i * 0.047, -0.056 - i * i * 0.009, 0.08 + i * 0.22);
    for (const side of [-1, 1]) part(g, new THREE.BoxGeometry(0.003, 0.024, 0.049), dark, side * 0.022, piece.position.y, piece.position.z, piece.rotation.x);
  }
  part(g, new THREE.BoxGeometry(0.037, 0.108, 0.047), wood, 0, -0.086, 0.137, -0.33);
  part(g, new THREE.BoxGeometry(0.012, 0.018, 0.083), dark, 0, -0.064, 0.082);
  part(g, new THREE.BoxGeometry(0.024, 0.014, 0.068), edge, 0.036, 0.017, 0.007);
  for (const z of [-0.072, 0.075, 0.182]) for (const x of [-0.029, 0.029]) part(g, new THREE.SphereGeometry(0.006, 6, 4), edge, x, 0.007, z);
  return g;
}
export function lootMesh(kind: LootKind): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'food') {
    for (const [x, z, c] of [[-0.06, 0, 0xb8322a], [0.07, 0.03, 0xd0a020]] as const) {
      part(g, new THREE.CylinderGeometry(0.055, 0.055, 0.09, 8), basic(0xb8bcc4), x, 0.045, z);
      part(g, new THREE.CylinderGeometry(0.057, 0.057, 0.05, 8), basic(c), x, 0.045, z);
    }
  } else if (kind === 'water') {
    part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), basic(0x4fa8e0), 0, 0.1, 0);
    part(g, new THREE.CylinderGeometry(0.02, 0.03, 0.06, 6), basic(0xe8e8f0), 0, 0.23, 0);
  } else if (kind === 'ammo') {
    part(g, new THREE.BoxGeometry(0.2, 0.1, 0.12), basic(0x5a6a3a), 0, 0.05, 0);
    part(g, new THREE.BoxGeometry(0.2, 0.02, 0.12), basic(0xc8b060), 0, 0.11, 0);
  } else if (kind === 'parts') {
    part(g, new THREE.CylinderGeometry(0.07, 0.07, 0.03, 8), basic(0xc8a040), 0, 0.02, 0);
    part(g, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8), basic(0x9aa0a8), 0.1, 0.02, 0.05);
    part(g, new THREE.BoxGeometry(0.03, 0.03, 0.16), basic(0x9aa0a8), -0.07, 0.02, 0.08);
  } else if (kind === 'axe') {
    const a = axeMesh(); a.scale.setScalar(1.3); a.position.y = 0.42; a.rotation.z = 0.5; g.add(a);
  } else {
    const a = gunMesh(); a.position.y = 0.12; a.rotation.y = 0.6; g.add(a);
  }
  return g;
}
