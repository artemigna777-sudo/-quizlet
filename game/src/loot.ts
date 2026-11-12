/** Припасы и оружие: как выглядят и как называются. Всё рисуется кодом. */
import * as THREE from 'three';
import { lambert } from './gfx';

export type LootKind = 'food' | 'water' | 'ammo' | 'axe' | 'gun' | 'parts';
export const LOOT_NAME: Record<LootKind, string> = { food: 'консервы', water: 'вода', ammo: 'патроны', axe: 'топор', gun: 'автомат', parts: 'детали' };
const basic = (color: number) => new THREE.MeshBasicMaterial({ color });
const part = (g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m; };

/** Топор и автомат — и на земле, и в руках. */
export function axeMesh(): THREE.Group {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(0.035, 0.62, 0.035), lambert({ color: 0x8a6a3a }));
  part(g, new THREE.BoxGeometry(0.16, 0.12, 0.03), lambert({ color: 0x9aa0a8 }), 0.07, 0.25, 0);
  return g;
}
export function gunMesh(): THREE.Group {
  const g = new THREE.Group();
  const steel = lambert({ color: 0x2a2c30 }), wood = lambert({ color: 0x7a5230 });
  part(g, new THREE.BoxGeometry(0.05, 0.07, 0.42), steel);
  part(g, new THREE.BoxGeometry(0.025, 0.025, 0.28), steel, 0, 0.01, -0.34);
  part(g, new THREE.BoxGeometry(0.04, 0.06, 0.24), wood, 0, -0.02, 0.32);
  part(g, new THREE.BoxGeometry(0.035, 0.16, 0.06), steel, 0, -0.1, -0.05, 0.3);
  part(g, new THREE.BoxGeometry(0.035, 0.1, 0.04), wood, 0, -0.08, 0.14, -0.3);
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
