import * as THREE from 'three';
import type { Vec2 } from './config';
import { canvasTex, lambert } from './gfx';
import { axeMesh, gunMesh } from './loot';
import type { Actor } from './people';

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
  const jacket = wornCloth('#292a2b', '#383a3e');
  const skin = lambert({ color: 0xc99a78 });
  return { jacket, skin };
}

export interface HeroMark { at: Vec2; toward: Vec2; carry?: boolean }

/** Josh в сценках и в кадре от первого лица. */
export class HeroBody {
  readonly root: THREE.Group;
  private axe = axeMesh();
  private gun = gunMesh();

  constructor(private actor: Actor) {
    this.root = actor.root;
    this.root.visible = false;

    const hand = this.root.getObjectByName('mixamorigRightHand');
    if (!hand) throw new Error('Josh: правая кисть отсутствует в модели');
    const grip = new THREE.Group();
    grip.position.set(0.5, 8.5, -1.5);
    grip.scale.setScalar(100); // Скелет в сантиметрах, предметы в метрах.
    hand.add(grip);
    this.axe.position.x = 0.135;
    this.axe.rotation.z = -Math.PI / 2;
    this.gun.position.set(0, 0.145, 0.105);
    this.gun.rotation.x = Math.PI / 2;
    grip.add(this.axe, this.gun);

    // Из глаз героя можно увидеть его ноги. Остальная фигура видна со стороны.
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !/^Ch23_(Pants|Shoes)$/.test(o.name)) o.layers.set(CINEMATIC_ACTOR_LAYER);
    });
  }

  update(player: { pos: Vec2; yaw: number; pitch: number; floor: number; moving: boolean }, dt: number, cinematic: boolean, mark: HeroMark | undefined, weapon: 'none' | 'axe' | 'gun') {
    this.root.visible = cinematic ? !!mark : player.pitch < -0.4;
    if (!this.root.visible) return;
    this.root.rotation.y = mark ? Math.atan2(mark.toward.x - mark.at.x, mark.toward.z - mark.at.z) : player.yaw + Math.PI;
    this.root.position.set(mark?.at.x ?? player.pos.x + Math.sin(player.yaw) * 0.29,
      mark ? 0.025 : player.floor, mark?.at.z ?? player.pos.z + Math.cos(player.yaw) * 0.29);
    this.axe.visible = !!mark?.carry && weapon === 'axe';
    this.gun.visible = !!mark?.carry && weapon === 'gun';
    this.actor.play(!cinematic && player.moving ? 'walk' : 'idle');
    this.actor.update(dt);
  }
}

/** Рука привязана к точке хвата оружия, рукав — между хватом и краем камеры. */
export class WeaponGrip {
  readonly root = new THREE.Group();
  private hand = new THREE.Group();
  private sleeve: THREE.Mesh;
  private direction = new THREE.Vector3();

  constructor(clothes: ReturnType<typeof skinAndClothes>, side: 1 | -1) {
    const palm = part(this.hand, new THREE.CapsuleGeometry(0.04, 0.058, 3, 8), clothes.skin, side * 0.024, 0, 0.021);
    palm.rotation.x = Math.PI / 2; palm.scale.y = 0.78;
    for (let i = 0; i < 4; i++) {
      const finger = part(this.hand, new THREE.CapsuleGeometry(0.011, 0.038, 2, 6), clothes.skin, -side * 0.009, 0.025 - i * 0.019, 0.009);
      finger.rotation.z = Math.PI / 2;
    }
    const thumb = part(this.hand, new THREE.CapsuleGeometry(0.014, 0.035, 2, 6), clothes.skin, side * 0.023, 0.028, -0.020);
    thumb.rotation.z = side * 0.85;
    this.sleeve = part(this.root, new THREE.CylinderGeometry(0.047, 0.079, 1, 9), clothes.jacket, 0, 0, 0);
    this.root.add(this.hand);
  }

  follow(weapon: THREE.Object3D, local: THREE.Vector3, shoulder: THREE.Vector3) {
    weapon.updateMatrix();
    this.hand.position.copy(local).applyMatrix4(weapon.matrix);
    this.hand.quaternion.copy(weapon.quaternion);
    this.direction.subVectors(this.hand.position, shoulder);
    this.sleeve.scale.y = this.direction.length();
    this.sleeve.position.copy(this.hand.position).lerp(shoulder, 0.5);
    this.sleeve.quaternion.setFromUnitVectors(UP, this.direction.normalize());
  }
}

export function weaponGrips() {
  const clothes = skinAndClothes();
  return [new WeaponGrip(clothes, 1), new WeaponGrip(clothes, -1)] as const;
}
