/** Графика «как на PS1»: вершины прилипают к сетке экрана, текстуры без сглаживания, рисуются кодом. */
import * as THREE from 'three';

export function ps1<T extends THREE.Material>(mat: T): T {
  // Раньше вершины «прилипали» к грубой сетке экрана, как на PS1. На домах и окнах это давало рябь
  // (замечание Артёма 12.11.2026), поэтому эффект выключен: стиль держится на текстурах и низком разрешении.
  return mat;
}
export const lambert = (o: THREE.MeshLambertMaterialParameters) => ps1(new THREE.MeshLambertMaterial(o));

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat: [number, number] = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
