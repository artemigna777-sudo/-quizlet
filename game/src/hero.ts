import * as THREE from 'three';
import type { Vec2 } from './config';
import { canvasTex, lambert } from './gfx';
import { axeMesh, gunMesh } from './loot';

/** Камера игрока видит оружие и руки, режиссёрская — только фигуры в мире. */
export const FIRST_PERSON_LAYER = 1;
export const CINEMATIC_ACTOR_LAYER = 2;

const UP = new THREE.Vector3(0, 1, 0);

function wornCloth(base: string, fleck: string) {
  return lambert({ map: canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = fleck;
    for (let i = 0; i < 90; i++) g.fillRect((i * 13 + (i >> 3)) % w, (i * 19) % h, 1, 2 + i % 3);
    g.fillStyle = 'rgba(26,24,21,.32)'; g.fillRect(0, 0, 1, h);
  }) });
}

const part = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};

function skinAndClothes() {
  return {
    jacket: wornCloth('#625949', '#776d5a'), jeans: wornCloth('#393e46', '#4e535b'),
    leather: lambert({ color: 0x302c2a }), canvas: lambert({ color: 0x4d493c }), skin: lambert({ color: 0xab8067 }),
  };
}

export interface HeroMark { at: Vec2; toward: Vec2; carry?: boolean }

/** Временная фигура героя. Одежда совпадает между камерой игрока и сценками. */
export class HeroBody {
  readonly root = new THREE.Group();
  private upper = new THREE.Group();
  private legs: Array<{ hip: THREE.Group; knee: THREE.Group }> = [];
  private arms: THREE.Group[] = [];
  private axe = axeMesh();
  private gun = gunMesh();

  constructor() {
    const { jacket, jeans, leather, canvas, skin } = skinAndClothes();
    const torso = part(this.upper, new THREE.CylinderGeometry(0.225, 0.161, 0.51, 8), jacket, 0, 1.305, 0);
    torso.scale.z = 0.67;
    const coatHem = part(this.upper, new THREE.CylinderGeometry(0.169, 0.177, 0.12, 8), jacket, 0, 1.044, 0);
    coatHem.scale.z = 0.76;
    const shoulders = part(this.upper, new THREE.CapsuleGeometry(0.101, 0.252, 3, 8), jacket, 0, 1.48, 0);
    shoulders.rotation.z = Math.PI / 2; shoulders.scale.set(0.83, 0.92, 0.95);
    part(this.upper, new THREE.BoxGeometry(0.015, 0.41, 0.014), canvas, 0, 1.29, 0.146);
    for (const x of [-0.096, 0.096]) {
      const pocket = part(this.upper, new THREE.BoxGeometry(0.105, 0.106, 0.022), canvas, x, 1.25, 0.128);
      pocket.rotation.y = x > 0 ? 0.27 : -0.27;
    }
    part(this.upper, new THREE.CylinderGeometry(0.075, 0.093, 0.10, 8), leather, 0, 1.59, 0.009);
    const hood = part(this.upper, new THREE.SphereGeometry(0.128, 12, 9), jacket, 0, 1.695, -0.034);
    hood.scale.set(0.96, 1.23, 1.02);
    const face = part(this.upper, new THREE.SphereGeometry(0.09, 10, 8), skin, 0, 1.689, 0.068);
    face.scale.set(0.95, 1.26, 0.70);
    part(this.upper, new THREE.BoxGeometry(0.128, 0.028, 0.024), leather, 0, 1.741, 0.108);
    part(this.upper, new THREE.BoxGeometry(0.027, 0.043, 0.027), skin, 0, 1.685, 0.129);
    const pack = part(this.upper, new THREE.CapsuleGeometry(0.126, 0.184, 3, 8), canvas, 0, 1.325, -0.163);
    pack.scale.set(1.14, 0.95, 0.54);
    for (const x of [-0.129, 0.129]) {
      const strap = part(this.upper, new THREE.BoxGeometry(0.031, 0.36, 0.018), leather, x, 1.377, 0.143);
      strap.rotation.z = x * 0.7;
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * 0.225, 1.487, 0);
      this.arms.push(arm); this.upper.add(arm);
      part(arm, new THREE.CylinderGeometry(0.078, 0.058, 0.28, 8), jacket, side * 0.025, -0.112, 0);
      const lower = part(arm, new THREE.CylinderGeometry(0.054, 0.045, 0.24, 8), jacket, side * 0.049, -0.355, 0.026);
      lower.rotation.x = -0.16;
      const glove = part(arm, new THREE.CapsuleGeometry(0.038, 0.061, 3, 8), leather, side * 0.051, -0.511, 0.046);
      glove.scale.z = 0.67;

      const hip = new THREE.Group(), knee = new THREE.Group();
      hip.position.set(side * 0.099, 0.99, 0.01); knee.position.y = -0.414;
      const thigh = part(hip, new THREE.CylinderGeometry(0.113, 0.081, 0.435, 8), jeans, 0, -0.19, 0.012);
      thigh.scale.z = 0.93;
      part(knee, new THREE.CylinderGeometry(0.080, 0.059, 0.392, 8), jeans, 0, -0.178, 0.004);
      part(knee, new THREE.CylinderGeometry(0.066, 0.063, 0.115, 8), leather, 0, -0.421, 0.015);
      part(knee, new THREE.BoxGeometry(0.143, 0.116, 0.255), leather, 0, -0.516, 0.071);
      part(knee, new THREE.BoxGeometry(0.151, 0.034, 0.264), canvas, 0, -0.563, 0.072);
      hip.add(knee); this.root.add(hip); this.legs.push({ hip, knee });
    }
    this.axe.position.set(0.051, -0.56, 0.04); this.axe.rotation.z = Math.PI - 0.18;
    this.gun.position.set(0.051, -0.38, 0.10); this.gun.rotation.set(-1.4, 0, 0.13);
    this.arms[1].add(this.axe, this.gun);
    this.upper.traverse((o) => o.layers.set(CINEMATIC_ACTOR_LAYER));
    this.root.add(this.upper);
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  update(player: { pos: Vec2; yaw: number; pitch: number; floor: number; moving: boolean; stride: number }, t: number, cinematic: boolean, mark: HeroMark | undefined, weapon: 'none' | 'axe' | 'gun') {
    this.root.visible = cinematic ? !!mark : player.pitch < -0.4;
    if (!this.root.visible) return;
    this.root.rotation.y = mark ? Math.atan2(mark.toward.x - mark.at.x, mark.toward.z - mark.at.z) : player.yaw + Math.PI;
    this.root.position.set(mark?.at.x ?? player.pos.x + Math.sin(player.yaw) * 0.29,
      mark ? 0.025 : player.floor, mark?.at.z ?? player.pos.z + Math.cos(player.yaw) * 0.29);
    const walking = !cinematic && player.moving;
    this.legs.forEach(({ hip, knee }, index) => {
      const swing = walking ? Math.sin(player.stride * 3.46 + index * Math.PI) : 0;
      hip.rotation.x = swing * 0.43;
      knee.rotation.x = Math.max(0, -swing) * 0.55;
    });
    this.upper.rotation.z = cinematic ? Math.sin(t * 1.45) * 0.021 : 0;
    this.arms.forEach((arm, i) => { arm.rotation.x = 0.035 + Math.sin(t * 1.8 + i) * 0.045; });
    this.axe.visible = !!mark?.carry && weapon === 'axe';
    this.gun.visible = !!mark?.carry && weapon === 'gun';
  }
}

/** Рука привязана к точке хвата оружия, рукав — между хватом и краем камеры. */
export class WeaponGrip {
  readonly root = new THREE.Group();
  private glove = new THREE.Group();
  private sleeve: THREE.Mesh;
  private direction = new THREE.Vector3();

  constructor(clothes: ReturnType<typeof skinAndClothes>, side: 1 | -1) {
    const palm = part(this.glove, new THREE.CapsuleGeometry(0.04, 0.058, 3, 8), clothes.leather, side * 0.024, 0, 0.021);
    palm.rotation.x = Math.PI / 2; palm.scale.y = 0.78;
    for (let i = 0; i < 4; i++) {
      const finger = part(this.glove, new THREE.CapsuleGeometry(0.011, 0.038, 2, 6), clothes.leather, -side * 0.009, 0.025 - i * 0.019, 0.009);
      finger.rotation.z = Math.PI / 2;
    }
    const thumb = part(this.glove, new THREE.CapsuleGeometry(0.014, 0.035, 2, 6), clothes.canvas, side * 0.023, 0.028, -0.020);
    thumb.rotation.z = side * 0.85;
    this.sleeve = part(this.root, new THREE.CylinderGeometry(0.047, 0.079, 1, 9), clothes.jacket, 0, 0, 0);
    this.root.add(this.glove);
  }

  follow(weapon: THREE.Object3D, local: THREE.Vector3, shoulder: THREE.Vector3) {
    weapon.updateMatrix();
    this.glove.position.copy(local).applyMatrix4(weapon.matrix);
    this.glove.quaternion.copy(weapon.quaternion);
    this.direction.subVectors(this.glove.position, shoulder);
    this.sleeve.scale.y = this.direction.length();
    this.sleeve.position.copy(this.glove.position).lerp(shoulder, 0.5);
    this.sleeve.quaternion.setFromUnitVectors(UP, this.direction.normalize());
  }
}

export function weaponGrips() {
  const clothes = skinAndClothes();
  return [new WeaponGrip(clothes, 1), new WeaponGrip(clothes, -1)] as const;
}
