/**
 * Люди с анимацией (модели и движения Mixamo, см. CREDITS.md).
 * Исходные файлы превращены в лёгкие .glb (упрощённая сетка, уменьшенные текстуры) и лежат в public/people.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type Look = 'echo' | 'clown' | 'zoya' | 'josh';

export class Actor {
  readonly root = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private cur = '';
  constructor(model: THREE.Object3D, clips: readonly THREE.AnimationClip[]) {
    model.scale.setScalar(0.01); // Mixamo — в сантиметрах
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const c of clips) this.actions.set(c.name, this.mixer.clipAction(c));
  }
  /** Плавно перейти к движению. once — проиграть один раз и замереть в последней позе. */
  play(name: string, o: { once?: boolean; speed?: number; fade?: number } = {}) {
    const a = this.actions.get(name);
    if (!a || (this.cur === name && !o.once)) { if (a) a.timeScale = o.speed ?? 1; return; }
    const prev = this.actions.get(this.cur);
    a.reset();
    a.timeScale = o.speed ?? 1;
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = !!o.once;
    a.play();
    if (prev && prev !== a) a.crossFadeFrom(prev, o.fade ?? 0.2, false);
    this.cur = name;
  }
  get current() { return this.cur; }
  update(dt: number) { this.mixer.update(dt); }
}

export async function loadPeople(): Promise<(look: Look) => Actor> {
  const loader = new GLTFLoader();
  const url = (n: string) => new URL(`people/${n}.glb`, document.baseURI).href;
  const [echo, zoya, josh, clown] = await Promise.all(['echo', 'zoya', 'josh', 'whiteclown'].map((name) => loader.loadAsync(url(name))));
  const lambert = (scene: THREE.Object3D) => {
    const made = new Map<THREE.Material, THREE.Material>();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      const conv = (src: THREE.Material) => {
        let n = made.get(src);
        if (!n) {
          const s = src as THREE.MeshStandardMaterial;
          n = new THREE.MeshLambertMaterial({ map: s.map, color: s.map ? 0xffffff : s.color, alphaTest: s.transparent || s.alphaTest ? 0.4 : 0, side: s.side });
          made.set(src, n);
        }
        return n;
      };
      m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
    });
    return scene;
  };
  // У клоуна тот же скелет Mixamo, но другая высота таза.
  const hipScale = clown.scene.getObjectByName('mixamorigHips')!.position.y / echo.scene.getObjectByName('mixamorigHips')!.position.y;
  clown.animations = echo.animations.map((source) => {
    const clip = source.clone();
    for (const track of clip.tracks) {
      if (track.name !== 'mixamorigHips.position') continue;
      for (let i = 0; i < track.values.length; i++) track.values[i] *= hipScale;
    }
    return clip;
  });
  for (const { scene } of [echo, zoya, josh, clown]) lambert(scene);
  const people = { echo, zoya, josh, clown };
  return (look) => {
    const { scene, animations } = people[look];
    return new Actor(clone(scene), animations);
  };
}
