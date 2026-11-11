/**
 * Фигура в противогазе вдали: иногда стоит под фонарём и исчезает, стоит подойти или фонарю мигнуть.
 * В этой версии она только пугает — правила встречи с ней появятся позже.
 */
import * as THREE from 'three';
import type { Vec2 } from './config';
import { lambert } from './gfx';
import type { Lamp } from './world';

export class Shooter {
  readonly mesh = new THREE.Group();
  /** Появился в этом кадре (для звука). */
  appeared = false;
  private timer = 14;
  private life = 0;

  constructor() {
    const coat = lambert({ color: 0x0c0c0e });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.5, 7), coat);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 6), coat);
    head.position.y = 1.85;
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.45, 7), coat);
    hood.position.y = 2.02;
    const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 6), lambert({ color: 0x2a2c26 }));
    mask.rotation.x = Math.PI / 2;
    mask.position.set(0, 1.76, 0.2);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, fog: false });
    const e1 = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), eyeMat), e2 = e1.clone();
    e1.position.set(-0.08, 1.88, 0.19);
    e2.position.set(0.08, 1.88, 0.19);
    this.mesh.add(body, head, hood, mask, e1, e2);
    this.mesh.visible = false;
  }

  update(dt: number, player: Vec2, fwd: Vec2, lamps: readonly Lamp[]) {
    this.appeared = false;
    if (this.mesh.visible) {
      this.life -= dt;
      const d = Math.hypot(this.mesh.position.x - player.x, this.mesh.position.z - player.z);
      this.mesh.rotation.y = Math.atan2(player.x - this.mesh.position.x, player.z - this.mesh.position.z);
      if (d < 15 || this.life <= 0) { this.mesh.visible = false; this.timer = 22 + Math.random() * 20; }
      return;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    // Фонарь впереди по ходу, на расстоянии 22–38 м.
    const ok = lamps.filter((l) => {
      const dx = l.lx - player.x, dz = l.lz - player.z;
      const d = Math.hypot(dx, dz);
      return l.mode !== 'off' && d > 22 && d < 38 && (dx * fwd.x + dz * fwd.z) / d > 0.6;
    });
    if (!ok.length) { this.timer = 3; return; }
    const l = ok[Math.floor(Math.random() * ok.length)];
    this.mesh.position.set(l.lx, 0, l.lz);
    this.mesh.visible = true;
    this.life = 6;
    this.appeared = true;
  }
}
