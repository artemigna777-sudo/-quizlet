import type { Vec2 } from './config';
import { ENTRANCE } from './apartments';
import { AREA } from './world';

export interface NotebookState {
  player: Vec2;
  dog: Vec2;
  goal: Vec2 | null;
  free: boolean;
}

/** Рисует найденный зрителями блокнот: схема неточная и обновляется от руки. */
export function drawNotebook(canvas: HTMLCanvasElement, s: NotebookState) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = 820, h = 520;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  g.fillStyle = '#e8ddbd';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(68,82,92,.13)';
  g.lineWidth = 1;
  for (let x = 20; x < w; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 16; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = 'rgba(105,62,42,.22)';
  g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2 - 7, h); g.stroke();

  const half = 126;
  const project = (p: Vec2) => ({ x: w / 2 + (p.x / half) * 360, y: h / 2 + (p.z / half) * 220 });
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#665e53';
  g.lineWidth = 8;
  for (let n = -3; n <= 4; n++) {
    const k = n * 36 - 18;
    const a = project({ x: k, z: -half }), b = project({ x: k, z: half });
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x + Math.sin(n) * 3, b.y); g.stroke();
    const c = project({ x: -half, z: k }), d = project({ x: half, z: k });
    g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(d.x, d.y + Math.cos(n) * 2); g.stroke();
  }

  if (!s.free) {
    const a = project({ x: AREA.minX, z: AREA.minZ }), b = project({ x: AREA.maxX, z: AREA.maxZ });
    g.save();
    g.strokeStyle = 'rgba(45,43,42,.55)';
    g.lineWidth = 3;
    for (let x = 18; x < w; x += 18) {
      if (x > a.x && x < b.x) continue;
      g.beginPath(); g.moveTo(x, 20); g.lineTo(x - 70, h - 20); g.stroke();
    }
    g.strokeStyle = '#aa4a35';
    g.lineWidth = 5;
    g.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    g.font = '700 22px Caveat, cursive';
    g.fillStyle = '#963c2e';
    g.fillText('дальше всё стёрто', Math.max(28, a.x - 190), Math.max(42, a.y - 15));
    g.restore();
  }

  const mark = (p: Vec2, color: string, r: number, label: string) => {
    const q = project(p);
    g.fillStyle = color;
    g.beginPath(); g.arc(q.x, q.y, r, 0, Math.PI * 2); g.fill();
    g.font = '700 21px Caveat, cursive';
    g.fillText(label, q.x + r + 6, q.y - r - 2);
  };
  if (s.free) mark(ENTRANCE, '#963c2e', 7, 'дом 12');
  if (s.goal && s.goal !== ENTRANCE) mark(s.goal, '#d45b32', 8, 'сюда ведёт Тузик');
  mark(s.dog, '#82532d', 7, 'Тузик');
  mark(s.player, '#20252b', 8, 'я');
  g.fillStyle = '#34302b';
  g.font = '700 29px Caveat, cursive';
  g.fillText('ГОРОД — что удалось запомнить', 28, 42);
  g.font = '700 18px Caveat, cursive';
  g.fillText('M — закрыть блокнот', 30, h - 22);
}
