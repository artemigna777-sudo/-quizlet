/**
 * Ночные враги и оружие.
 * «Эхо» — копии Стрелка, которые город лепит по ночам: идут на звук шагов, в дома не заходят.
 * «Крикун» стоит неподвижно, пока на него не посветишь, — потом бросается.
 */
import * as THREE from 'three';
import { CFG, type Vec2 } from './config';
import { resolveCircle, streetLines, type Box } from './logic';
import { axeMesh, gunMesh } from './loot';
import type { Actor, Look } from './people';

export const WEAPON = { axeDmg: 40, axeRange: 2.4, axeCool: 0.6, gunDmg: 34, gunRange: 45, gunCool: 0.13 } as const;
type Kind = 'echo' | 'screamer';
interface Enemy { kind: Kind; mesh: THREE.Group; actor: Actor; scream: number; dead: boolean; pos: Vec2; hp: number; aware: boolean; cool: number; stun: number; dying: number; dir: number; turnT: number; rush: number; gait: number }
export interface Ctx { t: number; player: Vec2; fwd: Vec2; running: boolean; flash: boolean; night: boolean; indoors: boolean; dog: Vec2; boxes: readonly Box[]; nooks: readonly Vec2[]; area: Box | null; siege?: boolean }
export interface Tick { damage: number; screamed: boolean; near: boolean; died: Vec2[] }

/** Не загораживают ли стены отрезок (грубо, шагом полметра). */
export function blocked(a: Vec2, b: Vec2, boxes: readonly Box[]): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.5);
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    for (const q of boxes) if (x > q.minX && x < q.maxX && z > q.minZ && z < q.maxZ && q.maxX - q.minX > 0.6) return true;
  }
  return false;
}

export class Enemies {
  readonly list: Enemy[] = [];
  private spawnT = 6;
  private nights = 0;
  private wasNight = false;
  private usedNooks = new Set<number>();
  constructor(private scene: THREE.Scene, private make: (look: Look) => Actor) {}

  private add(kind: Kind, pos: Vec2) {
    const actor = this.make(kind === 'echo' ? 'echo' : 'pale');
    const g = actor.root;
    if (kind === 'screamer') g.scale.setScalar(1.14);
    g.position.set(pos.x, 0, pos.z);
    actor.play('idle');
    this.scene.add(g);
    this.list.push({ kind, mesh: g, actor, scream: 0, dead: false, pos: { ...pos }, hp: kind === 'echo' ? 100 : 60, aware: false, cool: 0.6, stun: 0, dying: 0, dir: Math.random() * 6.28, turnT: 0, rush: 0, gait: 0 });
  }
  clear() { for (const e of this.list) this.scene.remove(e.mesh); this.list.length = 0; this.usedNooks.clear(); }
  /** Для проверок. */
  spawn(kind: Kind, pos: Vec2) { this.add(kind, pos); }

  update(dt: number, c: Ctx): Tick {
    const out: Tick = { damage: 0, screamed: false, near: false, died: [] };
    if (c.night && !this.wasNight) { this.nights++; this.spawnT = 8; this.usedNooks.clear(); }
    this.wasNight = c.night;
    // Новые копии появляются на улицах в стороне от игрока.
    if (c.night && !c.indoors) {
      this.spawnT -= dt;
      const echoes = this.list.filter((e) => e.kind === 'echo' && !e.dying).length;
      if (this.spawnT <= 0 && echoes < (c.siege ? 5 : Math.min(6, 2 + this.nights))) {
        this.spawnT = c.siege ? 3 + Math.random() * 2.5 : 7 + Math.random() * 6;
        const lines = streetLines();
        const a = Math.random() * 6.28, d = 28 + Math.random() * 12;
        const p = { x: c.player.x + Math.sin(a) * d, z: c.player.z + Math.cos(a) * d };
        const snap = (v: number) => lines.reduce((m, l) => (Math.abs(l - v) < Math.abs(m - v) ? l : m));
        if (Math.random() < 0.5) p.x = snap(p.x) + (Math.random() - 0.5) * 3; else p.z = snap(p.z) + (Math.random() - 0.5) * 3;
        const lim = (CFG.blocks / 2) * CFG.pitch;
        const inA = !c.area || (p.x > c.area.minX + 2 && p.x < c.area.maxX - 2 && p.z > c.area.minZ + 2 && p.z < c.area.maxZ - 2);
        if (inA && Math.abs(p.x) < lim && Math.abs(p.z) < lim && Math.hypot(p.x - c.player.x, p.z - c.player.z) > 22) this.add('echo', resolveCircle(p, 0.4, c.boxes));
      }
      c.nooks.forEach((n, i) => {
        const d = Math.hypot(n.x - c.player.x, n.z - c.player.z);
        const ok = !c.area || (n.x > c.area.minX && n.x < c.area.maxX && n.z > c.area.minZ && n.z < c.area.maxZ);
        if (ok && !this.usedNooks.has(i) && d > 18 && d < 50 && this.list.filter((e) => e.kind === 'screamer').length < 2) { this.usedNooks.add(i); this.add('screamer', n); }
      });
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      const dx = c.player.x - e.pos.x, dz = c.player.z - e.pos.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (e.hp <= 0 && !e.dead && !e.dying) out.died.push({ ...e.pos });
      if (e.dying > 0 || e.hp <= 0 || !c.night || d > 80) {
        // Падает и уходит в асфальт, как будто его стёрли.
        if (!e.dead) { e.dead = true; e.dying = 0.001; e.actor.play('die', { once: true, speed: 2.2 }); }
        e.dying += dt;
        e.actor.update(dt);
        if (e.dying > 1.7) e.mesh.position.y = -(e.dying - 1.7) * 1.6;
        if (e.dying > 2.4) { this.scene.remove(e.mesh); this.list.splice(i, 1); }
        continue;
      }
      if (d < 16) out.near = true;
      e.stun = Math.max(0, e.stun - dt);
      e.cool = Math.max(0, e.cool - dt);
      let speed = 0, tx = dx / d, tz = dz / d;
      if (e.kind === 'echo') {
        const hears = d < 13 || (c.running && d < 30);
        if (c.siege) e.aware = true;
        else if (c.indoors && d > 3) e.aware = false; else if (hears && !blockedFar(e.pos, c.player, c.boxes, d)) e.aware = true;
        if (e.aware) speed = 3.6;
        else {
          e.turnT -= dt;
          if (e.turnT <= 0) { e.turnT = 3 + Math.random() * 4; e.dir = Math.random() * 6.28; }
          tx = Math.sin(e.dir); tz = Math.cos(e.dir); speed = 0.9;
        }
        // Пёс вцепляется в того, кто подошёл к нему вплотную.
        if (e.stun <= 0 && Math.hypot(c.dog.x - e.pos.x, c.dog.z - e.pos.z) < 1.8 && e.aware && Math.random() < dt * 0.8) e.stun = 1.6;
      } else {
        const lit = c.flash && d < 11 && (-dx * c.fwd.x - dz * c.fwd.z) / d > 0.82 && !blocked(e.pos, c.player, c.boxes);
        if (!e.aware && (lit || d < 3.2)) { e.aware = true; e.rush = 5.4; e.scream = 0.9; out.screamed = true; }
        e.scream = Math.max(0, e.scream - dt);
        if (e.aware) { e.rush -= dt; speed = e.scream > 0 ? 0 : 7.2; if (e.rush <= 0) e.dying = 0.001; }
      }
      if (e.stun > 0) speed = 0;
      if (d < 1.25 && e.aware) {
        speed = 0;
        if (e.cool <= 0 && e.stun <= 0) {
          if (e.kind === 'echo') { out.damage += 8; e.cool = 1.2; } else { out.damage += 30; e.dying = 0.001; }
        }
      }
      if (speed > 0) {
        const next = resolveCircle({ x: e.pos.x + tx * speed * dt, z: e.pos.z + tz * speed * dt }, 0.4, c.boxes);
        const moved = Math.hypot(next.x - e.pos.x, next.z - e.pos.z);
        if (moved < speed * dt * 0.3 && !e.aware) e.turnT = 0;
        e.gait += moved;
        e.pos = next;
      }
      const close = d < 1.25 && e.aware;
      if (e.scream > 0) e.actor.play('scream', { speed: 1.6 });
      else if (e.stun > 0) e.actor.play('hit', { speed: 1.5 });
      else if (close) e.actor.play('attack', { speed: 1.4 });
      else if (speed > 3) e.actor.play('run', { speed: speed > 6 ? 1.5 : 1 });
      else if (speed > 0) e.actor.play('walk', { speed: 0.75 });
      else e.actor.play('idle', { speed: e.kind === 'screamer' ? 0.15 : 1 });
      e.actor.update(dt);
      e.mesh.position.set(e.pos.x, 0, e.pos.z);
      e.mesh.rotation.y = Math.atan2(e.aware ? dx : tx, e.aware ? dz : tz);
      e.mesh.rotation.z = e.kind === 'screamer' && e.aware ? Math.sin(c.t * 40) * 0.08 : 0;
    }
    return out;
  }

  /** Удар или выстрел: ближайший враг в конусе перед игроком. */
  hit(player: Vec2, fwd: Vec2, range: number, cone: number, dmg: number, boxes: readonly Box[]): boolean {
    let best: Enemy | null = null, bd = range;
    for (const e of this.list) {
      if (e.dying) continue;
      const dx = e.pos.x - player.x, dz = e.pos.z - player.z;
      const d = Math.hypot(dx, dz);
      // Вблизи конус шире: в упор не промахнуться.
      const need = Math.min(cone, 1 - 0.45 / Math.max(0.5, d) ** 2 * 0.5);
      if (d < bd && (dx * fwd.x + dz * fwd.z) / (d || 1) > Math.min(cone, need) && !blocked(player, e.pos, boxes)) { bd = d; best = e; }
    }
    if (!best) return false;
    best.hp -= dmg;
    best.aware = true;
    if (best.kind === 'screamer' && best.rush <= 0) best.rush = 4.5;
    best.stun = Math.max(best.stun, 0.35);
    const k = 0.7 / (bd || 1);
    best.pos = resolveCircle({ x: best.pos.x + (best.pos.x - player.x) * k, z: best.pos.z + (best.pos.z - player.z) * k }, 0.4, boxes);
    return true;
  }
}
const blockedFar = (a: Vec2, b: Vec2, boxes: readonly Box[], d: number) => d > 13 && blocked(a, b, boxes);

export type WeaponId = 'none' | 'axe' | 'gun';
/** Оружие в руках: топор и автомат, видны перед камерой. */
export class Arms {
  hasAxe = false;
  hasGun = false;
  ammo = 0;
  cur: WeaponId = 'none';
  private axe = axeMesh();
  private gun = gunMesh();
  private flash = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xffe08a, fog: false }));
  private cool = 0;
  private anim = 0;

  constructor(camera: THREE.Camera) {
    this.axe.scale.setScalar(1.1);
    this.gun.add(this.flash);
    this.flash.position.set(0, 0.02, -0.52);
    camera.add(this.axe, this.gun);
  }
  give(w: 'axe' | 'gun') { if (w === 'axe') this.hasAxe = true; else this.hasGun = true; this.cur = w; }
  swap() {
    const have: WeaponId[] = [...(this.hasAxe ? ['axe' as const] : []), ...(this.hasGun ? ['gun' as const] : [])];
    if (have.length) this.cur = have[(have.indexOf(this.cur) + 1) % have.length];
  }
  /** Раз в кадр. Возвращает, что произошло: взмах, выстрел или пустой магазин. */
  update(dt: number, fire: boolean): 'swing' | 'shot' | 'empty' | null {
    this.cool = Math.max(0, this.cool - dt);
    this.anim = Math.max(0, this.anim - dt);
    let ev: 'swing' | 'shot' | 'empty' | null = null;
    if (fire && this.cool <= 0) {
      if (this.cur === 'axe') { this.cool = WEAPON.axeCool; this.anim = 0.3; ev = 'swing'; }
      else if (this.cur === 'gun') {
        if (this.ammo > 0) { this.ammo--; this.cool = WEAPON.gunCool; this.anim = 0.07; ev = 'shot'; }
        else { this.cool = 0.4; ev = 'empty'; }
      }
    }
    this.axe.visible = this.cur === 'axe';
    this.gun.visible = this.cur === 'gun';
    const k = this.cur === 'axe' ? Math.sin((1 - this.anim / 0.3) * Math.PI) * (this.anim > 0 ? 1 : 0) : 0;
    this.axe.position.set(0.3 - k * 0.2, -0.28 - k * 0.1, -0.5 - k * 0.15);
    this.axe.rotation.set(0.25 - k * 1.5, 0, -0.25 + k * 0.5);
    const kick = this.cur === 'gun' && this.anim > 0 ? 1 : 0;
    this.gun.position.set(0.2, -0.2 + kick * 0.01, -0.42 + kick * 0.04);
    this.gun.rotation.set(kick * 0.05, 0.04, 0);
    this.flash.visible = kick > 0;
    this.flash.rotation.z = Math.random() * 3;
    return ev;
  }
}
