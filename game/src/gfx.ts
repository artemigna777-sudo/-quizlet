/** Графика «как на PS1»: вершины прилипают к сетке экрана, текстуры без сглаживания, рисуются кодом. */
import * as THREE from 'three';

/** Материал с «дрожащими» вершинами. */
export function ps1<T extends THREE.Material>(mat: T): T {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec2 snapRes = vec2(160.0, 120.0);
      gl_Position.xy = floor(gl_Position.xy / gl_Position.w * snapRes + 0.5) / snapRes * gl_Position.w;`);
  };
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
