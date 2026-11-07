// Прототип «как может выглядеть игра»: 3D от первого лица в стиле PS1 (низкое разрешение, «дрожащие» вершины, туман).
// Кадр полностью задаётся временем t — window.renderAt(t), поэтому видео записывается кадр в кадр.
import * as THREE from './three.module.js';

const W = 360, H = 640;
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
document.getElementById('view').prepend(renderer.domElement);

const scene = new THREE.Scene();
const FOG = 0x161824;
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.Fog(FOG, 3, 36);
const camera = new THREE.PerspectiveCamera(70, W / H, 0.05, 80);
scene.add(camera);

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// PS1: вершины прилипают к сетке экрана.
function ps1(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec2 res = vec2(120.0, 213.0);
      gl_Position.xy = floor(gl_Position.xy / gl_Position.w * res + 0.5) / res * gl_Position.w;`);
  };
  return mat;
}
const lambert = (o) => ps1(new THREE.MeshLambertMaterial(o));
function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Свет: почти темно, фонарик.
scene.add(new THREE.HemisphereLight(0x5a6488, 0x141218, 1.6));
const moon = new THREE.DirectionalLight(0x8090c0, 1.1);
moon.position.set(-6, 12, 4);
scene.add(moon);
const flash = new THREE.SpotLight(0xfff1d6, 34, 26, 0.45, 0.55, 1.2);
camera.add(flash);
flash.position.set(0.25, -0.2, 0);
camera.add(flash.target);
flash.target.position.set(0, -0.4, -6);

// Дорога и тротуары.
const asphalt = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#1b1b20'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},255,${0.05 + rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 1, 1); }
  g.strokeStyle = '#0a0a0c'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(10, 0); g.lineTo(18, 20); g.lineTo(12, 40); g.lineTo(22, 64); g.stroke();
  g.fillStyle = '#6a6a5e'; g.fillRect(31, 4, 2, 22);
}, [1, 40]);
const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 200), lambert({ map: asphalt }));
road.rotation.x = -Math.PI / 2;
road.position.z = -80;
scene.add(road);
const curbTex = canvasTex(32, 32, (g) => { g.fillStyle = '#2a2a2e'; g.fillRect(0, 0, 32, 32); g.strokeStyle = '#1a1a1d'; g.strokeRect(0, 0, 32, 32); }, [2, 100]);
for (const x of [-5.5, 5.5]) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 200), lambert({ map: curbTex }));
  s.position.set(x, 0.07, -80);
  scene.add(s);
}

// Дома: фасады с окнами, часть выбита; одно окно горит.
function facadeTex(lit) {
  return canvasTex(64, 128, (g, w, h) => {
    const base = ['#2b2730', '#2e2a26', '#26292e', '#302a2a'][Math.floor(rnd() * 4)];
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      const x = 6 + c * 20, y = 8 + r * 24;
      const isLit = lit && r === 3 && c === 1;
      g.fillStyle = isLit ? '#ffc86a' : '#08080b';
      g.fillRect(x, y, 12, 14);
      if (!isLit && rnd() < 0.5) { g.strokeStyle = '#8a8f9c'; g.beginPath(); g.moveTo(x + 2, y + 3); g.lineTo(x + 7, y + 8); g.lineTo(x + 4, y + 13); g.stroke(); }
      if (!isLit && rnd() < 0.25) { g.fillStyle = '#3a2c1f'; g.fillRect(x, y + 5, 12, 2); g.fillRect(x, y + 9, 12, 2); }
    }
    g.fillStyle = '#121014'; g.fillRect(24, 112, 16, 16);
  });
}
const litHouse = { x: 7, z: -28 };
for (let i = 0; i < 12; i++) for (const side of [-1, 1]) {
  const lit = side === 1 && i === 4;
  const h = 6 + rnd() * 5;
  const mat = lambert({ map: facadeTex(lit) });
  if (lit) { mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = mat.map; mat.emissiveIntensity = 0.9; }
  const b = new THREE.Mesh(new THREE.BoxGeometry(6, h, 6.4), mat);
  b.position.set(side * 10, h / 2, -i * 7);
  b.rotation.y = side * Math.PI / 2;
  scene.add(b);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2, 4), lambert({ color: 0x18151a }));
  roof.position.set(side * 10, h + 1, -i * 7);
  roof.rotation.y = Math.PI / 4;
  scene.add(roof);
}
const litLight = new THREE.PointLight(0xffa64d, 14, 18, 1.3);
litLight.position.set(6.6, 6.5, -28);
scene.add(litLight);

// Фонари.
function lamp(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 6), lambert({ color: 0x111114 }));
  pole.position.y = 2.3;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.08), lambert({ color: 0x111114 }));
  arm.position.set(-Math.sign(x) * 0.5, 4.55, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.25), new THREE.MeshBasicMaterial({ color: 0xcfe2ff, fog: false }));
  head.position.set(-Math.sign(x) * 1.0, 4.45, 0);
  g.add(pole, arm, head);
  g.position.set(x, 0, z);
  scene.add(g);
  const light = new THREE.PointLight(0xbcd2ff, 16, 16, 1.2);
  light.position.set(x - Math.sign(x) * 1.0, 4.2, z);
  scene.add(light);
  return { head, light };
}
const lamps = [lamp(-4.2, -8), lamp(4.2, -18), lamp(-4.2, -32)];

// Стрелок: плащ, капюшон, противогаз с мутными красными стёклами, ружьё.
const shooter = new THREE.Group();
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
const e1 = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), eyeMat);
const e2 = e1.clone();
e1.position.set(-0.08, 1.88, 0.19);
e2.position.set(0.08, 1.88, 0.19);
const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.2), lambert({ color: 0x1d1a16 }));
gun.position.set(0.3, 1.2, 0.15);
gun.rotation.x = 0.9;
shooter.add(body, head, hood, mask, e1, e2, gun);
scene.add(shooter);

// Рука с надписью «УБЕЙ СТРЕЛКА» (почерк — шрифт Caveat, SIL OFL).
const handTex = canvasTex(256, 320, (g) => {
  g.clearRect(0, 0, 256, 320);
  g.fillStyle = '#c99a78';
  g.beginPath(); g.ellipse(128, 200, 92, 100, 0, 0, Math.PI * 2); g.fill();
  [[52, 120, 22, 80, -0.25], [96, 88, 22, 96, -0.08], [140, 84, 22, 98, 0.05], [182, 104, 21, 86, 0.2]].forEach(([x, y, rx, ry, a]) => { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill(); });
  g.beginPath(); g.ellipse(232, 220, 22, 60, 0.9, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#a77a5c'; g.lineWidth = 3;
  g.beginPath(); g.arc(128, 240, 70, 3.6, 5.6); g.stroke();
  g.fillStyle = '#1a2a6a';
  g.font = '700 54px Caveat';
  g.textAlign = 'center';
  g.save(); g.translate(128, 200); g.rotate(-0.08);
  g.fillText('УБЕЙ', 0, -12); g.fillText('СТРЕЛКА', 0, 40);
  g.restore();
});
handTex.wrapS = handTex.wrapT = THREE.ClampToEdgeWrapping;
handTex.repeat.set(1, 1);
const hand = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.52), new THREE.MeshBasicMaterial({ map: handTex, transparent: true, alphaTest: 0.5, color: 0xd8c4b0, fog: false }));
camera.add(hand);
const handLight = new THREE.PointLight(0xfff1d6, 1.2, 2);
camera.add(handLight);

// Пепел в воздухе.
const N = 260;
const ashGeo = new THREE.BufferGeometry();
const base = new Float32Array(N * 3);
for (let i = 0; i < N; i++) { base[i * 3] = (rnd() - 0.5) * 14; base[i * 3 + 1] = rnd() * 8; base[i * 3 + 2] = 4 - rnd() * 34; }
ashGeo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
scene.add(new THREE.Points(ashGeo, new THREE.PointsMaterial({ color: 0xb8b8c4, size: 0.05 })));

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, k) => a + (b - a) * k;

window.renderAt = (t) => {
  // Камера: смотрит на ладонь → опускает руку → идёт по улице.
  const walk = ease((t - 1.4) / 3.6);
  const z = lerp(3.5, -5.5, walk);
  const bob = t > 1.4 ? Math.sin(t * 8.5) * 0.035 : 0;
  camera.position.set(Math.sin(t * 0.7) * 0.15, 1.65 + bob, z);
  const look = ease((t - 0.9) / 0.8);
  camera.rotation.set(lerp(-0.55, 0.02, look) + (t > 1.4 ? Math.sin(t * 4.25) * 0.012 : 0), Math.sin(t * 0.6) * 0.05, Math.sin(t * 4.25) * 0.01);
  // Рука.
  const down = ease((t - 1.0) / 0.6);
  hand.position.set(0.02, lerp(-0.12, -0.75, down), -0.55);
  hand.rotation.set(lerp(-0.35, -1.0, down), 0, 0.15);
  hand.visible = down < 1;
  handLight.position.set(0, -0.1, -0.2);
  handLight.intensity = 1.6 * (1 - down);
  // Фонарик и горящее окно дышат.
  flash.intensity = 34 + Math.sin(t * 31) * 2;
  litLight.intensity = 14 + Math.sin(t * 5) * 2;
  // Мигающие фонари; фонарь 2 — где появляется Стрелок.
  const on = (k, pattern) => pattern.every(([a, b]) => !(t > a && t < b));
  const states = [on(0, [[2.2, 2.3], [2.4, 2.45]]), on(1, [[3.1, 3.18], [3.25, 3.35], [4.15, 4.6]]), on(2, [[1.5, 1.6]])];
  lamps.forEach((l, k) => { l.light.intensity = states[k] ? 16 : 0; l.head.material.color.set(states[k] ? 0xcfe2ff : 0x222428); });
  // Стрелок: появляется под фонарём, в темноте «перескакивает» ближе.
  const near = t > 4.6;
  shooter.visible = t > 3.2 && !(t > 4.15 && t < 4.6);
  shooter.position.set(near ? 1.0 : 2.4, 0, near ? -11 : -18.2);
  shooter.rotation.y = near ? 0.05 : -0.35;
  eyeMat.color.set(t > 3.2 ? 0xff2a2a : 0x000000);
  camera.fov = lerp(70, 58, ease((t - 4.6) / 0.4));
  camera.updateProjectionMatrix();
  // Пепел.
  const p = ashGeo.attributes.position.array;
  for (let i = 0; i < N; i++) {
    p[i * 3] = base[i * 3] + Math.sin(t * 0.8 + i) * 0.3;
    p[i * 3 + 1] = (((base[i * 3 + 1] - t * 0.5) % 8) + 8) % 8;
  }
  ashGeo.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
};

window.ready = true;
