/** Воспоминания: светящиеся находки у домов. Тексты нарочно обрывочные — сюжет раскрывается в самой игре. */
import * as THREE from 'three';
import type { Vec2 } from './config';
import { canvasTex } from './gfx';

export interface Memory { id: string; at: Vec2; title: string; text: string; mesh: THREE.Group; found: boolean }

const DATA: Array<Omit<Memory, 'mesh' | 'found'>> = [
  { id: 'photo', at: { x: 13.6, z: -10 }, title: 'Фотография', text: 'Двор, скамейка, чья-то рука держит поводок. Лица не видно — его будто стёрли. На обороте твоим почерком: «не забывай».' },
  { id: 'drawing', at: { x: -40, z: 49.6 }, title: 'Детский рисунок', text: 'Дом, человек и собака. У собаки — полоска у глаза. У человека нет лица, только подпись снизу, которую уже не прочитать.' },
  { id: 'key', at: { x: 60, z: -49.6 }, title: 'Ключ с биркой', text: 'На бирке стёрто всё, кроме времени: 3:33. Пёс обнюхал ключ и тихо заскулил.' },
];

export function buildMemories(scene: THREE.Scene, found: readonly string[]): Memory[] {
  const tex = canvasTex(32, 40, (g) => {
    g.fillStyle = '#efe6cf'; g.fillRect(0, 0, 32, 40);
    g.fillStyle = '#5a6a72'; g.fillRect(3, 3, 26, 26);
    g.fillStyle = '#1a1c20'; g.beginPath(); g.arc(12, 14, 4, 0, 7); g.arc(21, 15, 3.4, 0, 7); g.fill();
    g.fillRect(6, 20, 12, 9); g.fillRect(17, 21, 9, 8);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false });
  return DATA.map((d) => {
    const mesh = new THREE.Group();
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.45), mat);
    const light = new THREE.PointLight(0xffd9a0, 3, 6, 1.5);
    mesh.add(card, light);
    mesh.position.set(d.at.x, 0.9, d.at.z);
    const m: Memory = { ...d, mesh, found: found.includes(d.id) };
    if (!m.found) scene.add(mesh);
    return m;
  });
}

export function animateMemories(list: readonly Memory[], t: number) {
  for (const m of list) if (!m.found) { m.mesh.rotation.y = t * 1.6; m.mesh.position.y = 0.9 + Math.sin(t * 2.2) * 0.08; }
}
