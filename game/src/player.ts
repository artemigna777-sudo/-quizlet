/** Игрок: камера от первого лица, ходьба со столкновениями, фонарик, ладонь с надписью. */
import * as THREE from 'three';
import { CFG, type Vec2 } from './config';
import { canvasTex } from './gfx';
import type { Input } from './input';
import { resolveCircle, type Box } from './logic';

export class Player {
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 90);
  pos: Vec2 = { x: 18, z: 30 };
  yaw = 0; // 0 — смотрит в −Z
  pitch = 0;
  flashlightOn = true;
  /** Сколько прошёл (для шагов и покачивания). */
  stride = 0;
  moving = false;
  private flash = new THREE.SpotLight(0xfff1d6, 34, 26, 0.45, 0.55, 1.2);
  private hand: THREE.Mesh;
  private handK = 0;
  private bob = 0;

  constructor() {
    this.camera.rotation.order = 'YXZ';
    this.camera.add(this.flash);
    this.flash.position.set(0.25, -0.2, 0);
    this.camera.add(this.flash.target);
    this.flash.target.position.set(0, -0.4, -6);
    const tex = canvasTex(256, 320, (g) => {
      g.clearRect(0, 0, 256, 320);
      g.fillStyle = '#c99a78';
      g.beginPath(); g.ellipse(128, 200, 92, 100, 0, 0, Math.PI * 2); g.fill();
      ([[52, 120, 22, 80, -0.25], [96, 88, 22, 96, -0.08], [140, 84, 22, 98, 0.05], [182, 104, 21, 86, 0.2]] as const).forEach(([x, y, rx, ry, a]) => { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill(); });
      g.beginPath(); g.ellipse(232, 220, 22, 60, 0.9, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#a77a5c'; g.lineWidth = 3;
      g.beginPath(); g.arc(128, 240, 70, 3.6, 5.6); g.stroke();
      g.fillStyle = '#1a2a6a';
      g.font = '700 54px Caveat, cursive';
      g.textAlign = 'center';
      g.save(); g.translate(128, 200); g.rotate(-0.08);
      g.fillText('УБЕЙ', 0, -12); g.fillText('СТРЕЛКА', 0, 40);
      g.restore();
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    this.hand = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.52), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, color: 0xd8c4b0, fog: false }));
    this.camera.add(this.hand);
    this.hand.visible = false;
  }

  /** Тень от фонарика (режим «высокое качество»). */
  setShadows(on: boolean) { this.flash.castShadow = on; this.flash.shadow.mapSize.set(512, 512); this.flash.shadow.bias = -0.002; this.flash.shadow.camera.near = 0.3; }

  /** Направление взгляда по земле. */
  forward(): Vec2 { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }

  update(dt: number, input: Input, look: { x: number; y: number }, boxes: readonly Box[], half: number, frozen: boolean) {
    this.yaw -= look.x * 0.0023;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - look.y * 0.0023));
    const f = this.forward();
    const r = { x: -f.z, z: f.x };
    const speed = frozen ? 0 : input.run ? CFG.run : CFG.walk;
    const vx = (f.x * input.moveZ + r.x * input.moveX) * speed;
    const vz = (f.z * input.moveZ + r.z * input.moveX) * speed;
    const before = this.pos;
    const lim = half + 3;
    const next = resolveCircle({ x: Math.max(-lim, Math.min(lim, before.x + vx * dt)), z: Math.max(-lim, Math.min(lim, before.z + vz * dt)) }, CFG.radius, boxes);
    const moved = Math.hypot(next.x - before.x, next.z - before.z);
    this.pos = next;
    this.moving = moved > 0.002;
    this.stride += moved;
    this.bob += ((this.moving ? Math.sin(this.stride * 3.4) * 0.045 : 0) - this.bob) * Math.min(1, dt * 12);

    // Ладонь: поднять и посмотреть вниз.
    this.handK += ((input.hand ? 1 : 0) - this.handK) * Math.min(1, dt * 9);
    this.hand.visible = this.handK > 0.02;
    this.hand.position.set(0.02, -0.75 + 0.63 * this.handK, -0.55);
    this.hand.rotation.set(-1.0 + 0.65 * this.handK, 0, 0.15);

    this.camera.position.set(this.pos.x, CFG.eye + this.bob, this.pos.z);
    this.camera.rotation.set(this.pitch - 0.25 * this.handK, this.yaw, 0);
    this.flash.intensity = this.flashlightOn ? 34 : 0;
  }
}
