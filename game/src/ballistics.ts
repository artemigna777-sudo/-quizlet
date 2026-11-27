import * as THREE from 'three';
import { canvasTex } from './gfx';
import type { Box } from './logic';

type Pane = { mesh: THREE.Mesh; bounds: THREE.Box3; hits: number; open: boolean };
type Trail = { mesh: THREE.Mesh; start: THREE.Vector3; end: THREE.Vector3; age: number; duration: number };
type Shard = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number };

export class Ballistics {
  private panes: Pane[] = [];
  private trails: Trail[] = [];
  private shards: Shard[] = [];
  private trailGeo = new THREE.BoxGeometry(0.018, 1, 0.018);
  private trailMat = new THREE.MeshBasicMaterial({ color: 0xffcd78, fog: false });
  private shardGeo = new THREE.CircleGeometry(0.07, 3);
  private shardMat = new THREE.MeshBasicMaterial({ color: 0xbad5de, side: THREE.DoubleSide });
  private cracked = this.glassTexture(false);
  private broken = this.glassTexture(true);
  private bounds = new THREE.Box3();
  private point = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private delta = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {}

  private glassTexture(broken: boolean) {
    const map = canvasTex(48, 48, (g) => {
      g.fillStyle = '#263848'; g.fillRect(0, 0, 48, 48);
      g.strokeStyle = '#c6e3ea'; g.lineWidth = 1;
      for (const [x, y, a, b] of [[0, 5, 17, 18], [13, 0, 20, 15], [35, 0, 28, 15], [47, 13, 32, 19], [47, 43, 29, 29], [25, 48, 22, 33], [0, 33, 12, 27], [8, 48, 15, 31]]) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(a, b); g.lineTo(22, 23); g.stroke();
      }
      g.strokeRect(15, 15, 14, 15);
      g.fillStyle = broken ? '#090d13' : '#b3d3df';
      g.beginPath(); g.moveTo(16, 15); g.lineTo(23, 18); g.lineTo(31, 17); g.lineTo(28, 26); g.lineTo(25, 33); g.lineTo(17, 28); g.lineTo(12, 23); g.closePath(); g.fill();
    });
    return new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
  }

  register(mesh: THREE.Mesh, open = false) {
    mesh.updateWorldMatrix(true, false);
    this.panes.push({ mesh, open, bounds: new THREE.Box3().setFromObject(mesh).expandByScalar(0.004), hits: 0 });
  }

  trace(ray: THREE.Ray, range: number, boxes: readonly Box[]) {
    let distance = range;
    let pane: Pane | null = null;
    const end = ray.at(range, new THREE.Vector3());
    const minX = Math.min(ray.origin.x, end.x), maxX = Math.max(ray.origin.x, end.x);
    const minZ = Math.min(ray.origin.z, end.z), maxZ = Math.max(ray.origin.z, end.z);
    for (const b of boxes) {
      if (b.minX > maxX || b.maxX < minX || b.minZ > maxZ || b.maxZ < minZ) continue;
      this.bounds.min.set(b.minX, b.minY ?? 0, b.minZ);
      this.bounds.max.set(b.maxX, b.maxY ?? 2.9, b.maxZ);
      if (ray.intersectBox(this.bounds, this.point)) distance = Math.min(distance, ray.origin.distanceTo(this.point));
    }
    for (const p of this.panes) {
      if (p.hits >= 2 || !ray.intersectBox(p.bounds, this.point)) continue;
      const at = ray.origin.distanceTo(this.point);
      if (at <= distance) { distance = at; pane = p; }
    }
    return { distance, pane };
  }

  damage(pane: Pane, point: THREE.Vector3, direction: THREE.Vector3) {
    pane.hits++;
    if (pane.hits === 2 && pane.open) pane.mesh.visible = false;
    else pane.mesh.material = pane.hits === 1 ? this.cracked : this.broken;
    for (let i = 0; i < (pane.hits === 2 ? 10 : 4); i++) {
      if (this.shards.length >= 60) break;
      const mesh = new THREE.Mesh(this.shardGeo, this.shardMat);
      mesh.position.copy(point);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      mesh.scale.setScalar(0.4 + Math.random() * 0.8);
      this.scene.add(mesh);
      const velocity = direction.clone().multiplyScalar(0.6 + Math.random() * 1.8);
      velocity.add(new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2.5, Math.random() * 2 - 1));
      this.shards.push({ mesh, velocity, life: 0.5 + Math.random() * 0.5 });
    }
  }

  fire(start: THREE.Vector3, end: THREE.Vector3) {
    if (start.distanceToSquared(end) < 0.01) return;
    const mesh = new THREE.Mesh(this.trailGeo, this.trailMat);
    mesh.visible = false;
    this.scene.add(mesh);
    this.trails.push({ mesh, start, end, age: 0, duration: Math.max(0.065, start.distanceTo(end) / 135) });
  }

  update(dt: number) {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const { mesh, start, end, duration } = this.trails[i];
      const age = this.trails[i].age += dt;
      const front = Math.min(1, age / duration), back = Math.max(0, (age - 0.065) / duration);
      if (back >= 1) { mesh.removeFromParent(); this.trails.splice(i, 1); continue; }
      this.delta.subVectors(end, start);
      mesh.visible = true;
      mesh.position.copy(start).addScaledVector(this.delta, (front + back) / 2);
      mesh.scale.y = this.delta.length() * (front - back);
      mesh.quaternion.setFromUnitVectors(this.up, this.delta.normalize());
    }
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      if ((s.life -= dt) <= 0) { s.mesh.removeFromParent(); this.shards.splice(i, 1); continue; }
      s.mesh.position.addScaledVector(s.velocity, dt);
      s.velocity.y -= 9 * dt;
      s.mesh.rotation.x += dt * 9; s.mesh.rotation.z += dt * 12;
    }
  }
}
