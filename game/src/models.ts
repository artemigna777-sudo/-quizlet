/** Готовые модели (Poly Haven, CC0 — см. CREDITS.md): загрузка, кэш и материалы «под PS1». */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ps1 } from './gfx';

export interface Proto { root: THREE.Group; size: THREE.Vector3 }
const cache = new Map<string, Promise<Proto>>();
const loader = new GLTFLoader();

export function loadModel(id: string): Promise<Proto> {
  let p = cache.get(id);
  if (!p) {
    p = loader.loadAsync(new URL(`models/${id}/model.gltf`, document.baseURI).href).then((gltf) => {
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const map = src.map ?? null;
        if (map) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; }
        mesh.material = ps1(new THREE.MeshLambertMaterial({ map, color: map ? 0xffffff : src.color, side: src.side, transparent: src.transparent, alphaTest: src.transparent ? 0.5 : 0 }));
      });
      // Ставим на пол и центрируем: модель стоит в (0, 0, 0) своей группы.
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const c = box.getCenter(new THREE.Vector3());
      gltf.scene.position.set(-c.x, -box.min.y, -c.z);
      const root = new THREE.Group();
      root.add(gltf.scene);
      return { root, size: box.getSize(new THREE.Vector3()) };
    });
    cache.set(id, p);
  }
  return p;
}
