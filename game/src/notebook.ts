import { CFG, type Vec2 } from './config';
import { AREA } from './world';
import { streetLines, type Box } from './logic';

export interface MapLandmark {
  name: string;
  at: Vec2;
  door?: Vec2;
}

export interface NotebookState {
  player: Vec2;
  forward: Vec2;
  dog: Vec2;
  goal: Vec2 | null;
  free: boolean;
  district: boolean;
  footprints: readonly Box[];
  landmarks: readonly MapLandmark[];
}

const PAPER = '#eee4cb', INK = '#2c3434', RED = '#9d3f25';

/** Карта ориентирована на север. Один масштаб по обеим осям сохраняет форму кварталов. */
export function drawNotebook(canvas: HTMLCanvasElement, s: NotebookState) {
  const w = 900, h = 400, dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  const goal = s.goal ?? s.player;
  const dx = Math.abs(s.player.x - goal.x), dz = Math.abs(s.player.z - goal.z);
  const scale = s.district ? Math.min(6, 725 / Math.max(1, dx + 18), 290 / Math.max(1, dz + 16)) : 10.5;
  const center = s.district ? { x: (s.player.x + goal.x) / 2, z: (s.player.z + goal.z) / 2 } : s.player;
  const X = (x: number) => w / 2 + (x - center.x) * scale;
  const Z = (z: number) => h / 2 + (z - center.z) * scale;
  const inset = 23;
  const rect = ({ minX, maxX, minZ, maxZ }: Box) => [X(minX), Z(minZ), (maxX - minX) * scale, (maxZ - minZ) * scale] as const;
  g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
  g.save();
  g.beginPath(); g.rect(inset, inset, w - inset * 2, h - inset * 2); g.clip();
  g.strokeStyle = '#ded1b6'; g.lineWidth = 1;
  for (let x = (X(0) % scale) - scale; x < w; x += scale) {
    if (scale < 6) break;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
  }
  for (let y = (Z(0) % scale) - scale; y < h; y += scale) {
    if (scale < 6) break;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
  const roads = streetLines();
  for (const [stroke, width] of [['#b4a88e', CFG.street], ['#fbf1d9', CFG.street - .28]] as const) {
    g.strokeStyle = stroke;
    g.lineWidth = width * scale;
    g.beginPath();
    for (const k of roads) { g.moveTo(X(k), 0); g.lineTo(X(k), h); g.moveTo(0, Z(k)); g.lineTo(w, Z(k)); }
    g.stroke();
  }
  for (const b of s.footprints) {
    const r = rect(b);
    g.fillStyle = '#c1b49a'; g.fillRect(...r);
    g.strokeStyle = '#786e5b'; g.lineWidth = 1.4; g.strokeRect(...r);
  }

  if (!s.free) {
    const [x, y, width, height] = rect(AREA);
    g.fillStyle = 'rgba(108,101,93,.24)';
    g.beginPath(); g.rect(0, 0, w, h); g.rect(x, y, width, height); g.fill('evenodd');
    g.setLineDash([8, 5]); g.lineWidth = 2; g.strokeStyle = RED; g.strokeRect(x, y, width, height); g.setLineDash([]);
  }

  const names: { x: number; y: number; w: number; h: number }[] = [];
  const reserved = (x: number, y: number, r: number) => names.push({ x: x - r, y: y - r, w: r * 2, h: r * 2 });
  const playerX = X(s.player.x), playerY = Z(s.player.z);
  const goalX = X(goal.x), goalY = Z(goal.z);
  const dogX = X(s.dog.x), dogY = Z(s.dog.z);
  const dogDistant = Math.hypot(playerX - dogX, playerY - dogY) > 39;
  reserved(playerX, playerY, 23);
  if (s.goal) reserved(goalX, goalY, 22);
  if (dogDistant) reserved(dogX, dogY, 12);

  function drawLabel(p: Vec2, title: string) {
    const x = X(p.x), y = Z(p.z);
    if (x < inset || y < inset || x > w - inset || y > h - inset) return;
    g.font = '700 20px system-ui';
    const width = g.measureText(title).width + 12;
    for (const dy of [0, -32, 32, -59, 59]) {
      const label = { x: Math.max(inset + 2, Math.min(w - inset - width - 2, x - width / 2)), y: y + dy - 13, w: width, h: 26 };
      if (label.y < inset || label.y + label.h > h - inset || names.some((n) => label.x < n.x + n.w && label.x + label.w > n.x && label.y < n.y + n.h && label.y + label.h > n.y)) continue;
      g.fillStyle = '#f9eed5'; g.fillRect(label.x, label.y, label.w, label.h);
      g.fillStyle = INK; g.textBaseline = 'middle'; g.fillText(title, label.x + 6, label.y + 13);
      names.push(label);
      return;
    }
  }

  for (const mark of s.landmarks) {
    drawLabel(mark.at, mark.name);
    if (mark.door && scale >= 6) {
      const x = X(mark.door.x), y = Z(mark.door.z);
      g.fillStyle = PAPER; g.fillRect(x - 5, y - 5, 10, 10);
      g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x - 5, y - 5, 10, 10);
    }
  }
  function arrow(x: number, y: number, rotation: number, color: string, size: number) {
    g.save(); g.translate(x, y); g.rotate(rotation);
    g.beginPath(); g.moveTo(0, -size); g.lineTo(size * .7, size * .8);
    g.lineTo(0, size * .44); g.lineTo(-size * .7, size * .8); g.closePath();
    g.lineWidth = 4; g.strokeStyle = PAPER; g.stroke(); g.fillStyle = color; g.fill();
    g.restore();
  }

  if (s.goal) {
    const x = Math.max(inset + 19, Math.min(w - inset - 19, goalX));
    const y = Math.max(inset + 19, Math.min(h - inset - 19, goalY));
    if (x !== goalX || y !== goalY) arrow(x, y, Math.atan2(goalX - x, -(goalY - y)), RED, 16);
    else {
      g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fillStyle = '#fff0d4'; g.fill();
      g.lineWidth = 5; g.strokeStyle = RED; g.stroke();
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fillStyle = RED; g.fill();
    }
  }
  if (dogDistant) {
    g.beginPath(); g.arc(dogX, dogY, 8, 0, Math.PI * 2);
    g.fillStyle = '#704f35'; g.fill(); g.strokeStyle = PAPER; g.lineWidth = 3; g.stroke();
  }
  arrow(playerX, playerY, Math.atan2(s.forward.x, -s.forward.z), '#18464b', 19);
  g.restore();
  g.strokeStyle = '#9c8c6d'; g.lineWidth = 1.8;
  g.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  g.font = 'bold 19px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = PAPER; g.fillRect(w - 75, inset + 10, 34, 38);
  g.fillStyle = INK; g.fillText('↑ С', w - 58, inset + 30);
}
