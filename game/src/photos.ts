/** Фотографии жильцов: рисуются кодом, в сепии. Тех, кого город стёр, на снимке уже нет — вместо лица вытертое пятно. */
type Fig = { x: number; h: number; erased?: boolean; child?: boolean; gone?: boolean };
const SCENES: Record<string, { figs: Fig[]; prop?: 'piano' | 'boat' | 'bench' | 'none'; cat?: number }> = {
  nina: { prop: 'piano', figs: [{ x: 0.2, h: 0.62 }, { x: 0.42, h: 0.4, child: true, erased: true }, { x: 0.54, h: 0.36, child: true, erased: true }, { x: 0.66, h: 0.42, child: true, erased: true }, { x: 0.78, h: 0.38, child: true, erased: true }, { x: 0.9, h: 0.4, child: true }] },
  zoya: { prop: 'bench', cat: 0.36, figs: [{ x: 0.36, h: 0.56 }, { x: 0.64, h: 0.6, gone: true }] },
  gena: { prop: 'boat', figs: [{ x: 0.22, h: 0.62, erased: true }, { x: 0.8, h: 0.56 }] },
  tema: { prop: 'none', figs: [{ x: 0.42, h: 0.66, gone: true }, { x: 0.42, h: 0.3, child: true }, { x: 0.72, h: 0.56 }] },
};
const cache = new Map<string, HTMLCanvasElement>();

export function photoCanvas(key: string): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 320; c.height = 240;
  const g = c.getContext('2d')!, W = 320, H = 240, sc = SCENES[key] ?? SCENES.zoya;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#d8c8a0'); sky.addColorStop(0.62, '#c2ad82'); sky.addColorStop(0.63, '#8a7650'); sky.addColorStop(1, '#6e5c3c');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const ground = H * 0.82, ink = '#3a2c1c';
  g.fillStyle = ink;
  if (sc.prop === 'piano') { g.fillRect(8, ground - 78, 74, 78); g.fillStyle = '#e4d8b8'; g.fillRect(14, ground - 44, 62, 8); g.fillStyle = ink; }
  if (sc.prop === 'bench') { g.fillRect(70, ground - 34, 190, 7); g.fillRect(80, ground - 34, 6, 34); g.fillRect(244, ground - 34, 6, 34); g.fillRect(70, ground - 62, 190, 5); }
  if (sc.prop === 'boat') { g.strokeStyle = ink; g.lineWidth = 3; for (let i = 0; i < 7; i++) { const x = 96 + i * 18; g.beginPath(); g.moveTo(x, ground - 8); g.quadraticCurveTo(x + 9, ground - 58, x + 18, ground - 8); g.stroke(); } g.fillRect(90, ground - 10, 140, 5); }
  for (const f of sc.figs) {
    const x = f.x * W, h = f.h * H, top = (f.child && sc.figs.some((o) => o.gone && o.x === f.x) ? H * 0.2 : ground - h), r = f.child ? 11 : 14;
    if (f.gone) {
      // Человека на снимке нет: остался светлый след.
      g.fillStyle = 'rgba(232,220,190,.55)';
      g.beginPath(); g.ellipse(x, ground - h / 2, r * 1.5, h / 2, 0, 0, 7); g.fill();
      g.fillStyle = ink;
      if (key === 'zoya') { g.fillRect(x - 30, ground - 66, 22, 6); g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, ground - 40); g.quadraticCurveTo(x + 50, ground - 20, W, ground - 8); g.stroke(); }
      continue;
    }
    g.fillStyle = ink;
    g.beginPath(); g.arc(x, top + r, r, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x - r * 1.3, top + r * 2.1); g.lineTo(x + r * 1.3, top + r * 2.1); g.lineTo(x + r * 1.05, top + h); g.lineTo(x - r * 1.05, top + h); g.closePath(); g.fill();
    if (f.erased) {
      g.fillStyle = 'rgba(236,226,198,.92)';
      g.beginPath(); g.ellipse(x, top + r, r * 1.25, r * 1.15, 0.3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(190,176,140,.9)'; g.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x - r, top + r - 6 + i * 3); g.lineTo(x + r, top + r - 3 + i * 3); g.stroke(); }
    }
  }
  if (sc.cat) { const x = sc.cat * W + 4, y = ground - H * 0.3; g.fillStyle = '#7a705c'; g.beginPath(); g.ellipse(x, y, 13, 9, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x + 11, y - 7, 6, 0, 7); g.fill(); }
  // Зерно, царапины, белая рамка.
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 240},200,${Math.random() * 0.07})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  g.strokeStyle = 'rgba(240,232,210,.5)'; g.lineWidth = 1;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(Math.random() * W, 0); g.lineTo(Math.random() * W, H); g.stroke(); }
  g.strokeStyle = '#efe6cf'; g.lineWidth = 14; g.strokeRect(0, 0, W, H);
  cache.set(key, c);
  return c;
}
