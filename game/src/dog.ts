/**
 * Пёс-напарник: идёт рядом с игроком, а когда чует воспоминание — ведёт к нему по улицам,
 * ждёт и лает, если игрок отстал. Рядом с псом город не может стереть игрока.
 */
import * as THREE from 'three';
import { CFG, type Vec2 } from './config';
import { lambert } from './gfx';
import { resolveCircle, streetPath, type Box } from './logic';

export type DogState = 'follow' | 'lead' | 'wait' | 'point';

export class Dog {
  readonly mesh = new THREE.Group();
  pos: Vec2 = { x: 19.6, z: 26.5 };
  state: DogState = 'follow';
  /** Лай в этом кадре (для звука и подсказки). */
  barked = false;
  private heading = Math.PI;
  private legs: THREE.Group[] = [];
  private tail = new THREE.Group();
  private head = new THREE.Group();
  private gait = 0;
  private barkT = 2;
  private path: Vec2[] = [];
  private pathT = 0;
  private stuckT = 0;

  constructor() {
    const fur = lambert({ color: 0x7a5232 }), belly = lambert({ color: 0xa8845a }), dark = lambert({ color: 0x3a2618 });
    const add = (to: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0, sc?: [number, number, number]) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z); mesh.rotation.set(rx, 0, rz);
      if (sc) mesh.scale.set(...sc);
      mesh.castShadow = true;
      to.add(mesh);
      return mesh;
    };
    const Q = Math.PI / 2;
    // Туловище: грудь шире, круп уже, светлое брюхо.
    add(this.mesh, new THREE.CapsuleGeometry(0.19, 0.5, 4, 10), fur, 0, 0.6, 0, Q);
    add(this.mesh, new THREE.SphereGeometry(0.23, 10, 8), fur, 0, 0.62, 0.27, 0, 0, [1, 1.05, 1.1]);
    add(this.mesh, new THREE.SphereGeometry(0.2, 10, 8), fur, 0, 0.6, -0.3);
    add(this.mesh, new THREE.CapsuleGeometry(0.13, 0.45, 3, 8), belly, 0, 0.5, 0.02, Q);
    add(this.mesh, new THREE.CylinderGeometry(0.11, 0.15, 0.3, 9), fur, 0, 0.76, 0.42, 0.75);
    // Ошейник с жетоном.
    add(this.mesh, new THREE.TorusGeometry(0.125, 0.022, 6, 12), lambert({ color: 0xa8281e }), 0, 0.76, 0.43, 0.75 + Q);
    add(this.mesh, new THREE.CylinderGeometry(0.03, 0.03, 0.01, 8), new THREE.MeshBasicMaterial({ color: 0xe0c060 }), 0, 0.66, 0.53, Q);
    // Голова.
    this.head.position.set(0, 0.9, 0.55);
    add(this.head, new THREE.SphereGeometry(0.155, 10, 8), fur, 0, 0, 0, 0, 0, [1, 0.95, 1.12]);
    add(this.head, new THREE.CylinderGeometry(0.06, 0.095, 0.22, 9), belly, 0, -0.05, 0.2, Q);
    add(this.head, new THREE.SphereGeometry(0.038, 8, 6), dark, 0, -0.03, 0.32);
    add(this.head, new THREE.BoxGeometry(0.1, 0.02, 0.14), dark, 0, -0.105, 0.2);
    for (const s of [-1, 1]) {
      add(this.head, new THREE.ConeGeometry(0.06, 0.15, 6), dark, s * 0.1, 0.15, -0.03, -0.15, -s * 0.35);
      add(this.head, new THREE.SphereGeometry(0.024, 6, 5), new THREE.MeshBasicMaterial({ color: 0x0c0806 }), s * 0.07, 0.035, 0.135);
    }
    add(this.head, new THREE.BoxGeometry(0.02, 0.17, 0.015), new THREE.MeshBasicMaterial({ color: 0xf0e0c8 }), 0.085, 0.03, 0.14, 0, 0.45);
    this.mesh.add(this.head);
    // Лапы: бедро, голень, стопа.
    for (const [x, z] of [[-0.12, 0.3], [0.12, 0.3], [-0.12, -0.32], [0.12, -0.32]]) {
      const g = new THREE.Group();
      g.position.set(x, 0.5, z);
      add(g, new THREE.CylinderGeometry(0.06, 0.048, 0.26, 8), fur, 0, -0.12, 0);
      add(g, new THREE.CylinderGeometry(0.042, 0.036, 0.22, 8), fur, 0, -0.34, 0.01);
      add(g, new THREE.SphereGeometry(0.055, 8, 6), dark, 0, -0.455, 0.03, 0, 0, [1, 0.6, 1.3]);
      this.legs.push(g);
      this.mesh.add(g);
    }
    // Хвост из трёх звеньев.
    this.tail.position.set(0, 0.68, -0.48);
    add(this.tail, new THREE.CylinderGeometry(0.03, 0.045, 0.18, 7), fur, 0, 0.05, -0.07, -0.9);
    add(this.tail, new THREE.CylinderGeometry(0.022, 0.03, 0.16, 7), fur, 0, 0.16, -0.17, -0.6);
    add(this.tail, new THREE.CylinderGeometry(0.012, 0.022, 0.12, 7), belly, 0, 0.27, -0.22, -0.3);
    this.mesh.add(this.tail);
  }

  /**
   * @param goal ближайшее ненайденное воспоминание (или null)
   * @param scent расстояние, с которого пёс его чует
   */
  update(dt: number, t: number, player: Vec2, playerFwd: Vec2, goal: Vec2 | null, scent: number, boxes: readonly Box[]) {
    this.barked = false;
    const dPlayer = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
    const dGoal = goal ? Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) : Infinity;
    const smells = goal !== null && Math.hypot(goal.x - player.x, goal.z - player.z) < scent;

    let target: Vec2 | null = null;
    let speed: number = CFG.dogSpeed;
    if (smells && goal) {
      if (dGoal < 1.6) this.state = 'point';
      else if (dPlayer > CFG.safe - 1.5) this.state = 'wait';
      else this.state = 'lead';
    } else this.state = 'follow';

    if (this.state === 'lead' && goal) target = this.route(dt, goal);
    else if (this.state === 'follow') {
      // Держится чуть сбоку и позади.
      const side = { x: -playerFwd.z, z: playerFwd.x };
      const want = { x: player.x - playerFwd.x * 1.3 + side.x * 1.1, z: player.z - playerFwd.z * 1.3 + side.z * 1.1 };
      const d = Math.hypot(want.x - this.pos.x, want.z - this.pos.z);
      if (d > 0.7) { target = dPlayer > 7 ? this.route(dt, player) : want; speed = Math.min(CFG.dogSpeed * (dPlayer > 5 ? 1.35 : 1), d * 2.6); }
    }

    let moved = 0;
    if (target) {
      const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const step = Math.min(d, speed * dt);
      const next = resolveCircle({ x: this.pos.x + (dx / d) * step, z: this.pos.z + (dz / d) * step }, CFG.dogRadius, boxes);
      moved = Math.hypot(next.x - this.pos.x, next.z - this.pos.z);
      this.pos = next;
      if (moved > 0.001) this.turn(Math.atan2(dx, dz), dt);
    } else {
      // Стоит: смотрит на игрока (ждёт) или на находку.
      const look = this.state === 'point' && goal ? goal : player;
      this.turn(Math.atan2(look.x - this.pos.x, look.z - this.pos.z), dt);
    }

    // Застрял или далеко отстал — догоняет рывком из-за спины игрока.
    this.stuckT = target && moved < 0.01 ? this.stuckT + dt : 0;
    if ((this.stuckT > 1.2 || dPlayer > 30) && this.state === 'follow') {
      this.pos = resolveCircle({ x: player.x - playerFwd.x * 2.5, z: player.z - playerFwd.z * 2.5 }, CFG.dogRadius, boxes);
      this.stuckT = 0;
    }

    // Лай: зовёт, когда ждёт или нашёл.
    this.barkT -= dt;
    if ((this.state === 'wait' || this.state === 'point') && this.barkT <= 0) { this.barked = true; this.barkT = this.state === 'point' ? 2.2 : 2.8; }

    // Анимация.
    this.gait += moved * 9;
    const sw = moved > 0.001 ? Math.sin(this.gait) * 0.7 : 0;
    this.legs[0].rotation.x = sw; this.legs[3].rotation.x = sw;
    this.legs[1].rotation.x = -sw; this.legs[2].rotation.x = -sw;
    this.tail.rotation.y = Math.sin(t * (this.state === 'follow' ? 9 : 16)) * 0.6;
    this.head.rotation.x = this.barked ? -0.5 : this.head.rotation.x * 0.85 + (moved > 0.001 ? Math.sin(this.gait * 2) * 0.03 : 0);
    this.mesh.position.set(this.pos.x, Math.abs(Math.sin(this.gait)) * 0.03, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }

  private turn(want: number, dt: number) {
    let d = want - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, dt * 10);
  }

  /** Следующая точка пути по улицам к цели. */
  private route(dt: number, goal: Vec2): Vec2 {
    this.pathT -= dt;
    if (this.pathT <= 0 || !this.path.length) { this.path = streetPath(this.pos, goal); this.pathT = 0.7; }
    while (this.path.length > 1 && Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) < 1.2) this.path.shift();
    return this.path[0] ?? goal;
  }

  /** Поставить рядом с точкой (после возрождения). */
  place(p: Vec2) { this.pos = { x: p.x + 1.2, z: p.z + 1.0 }; this.path = []; }
}
