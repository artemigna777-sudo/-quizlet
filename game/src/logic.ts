/**
 * Чистая логика без графики (покрыта тестами): генератор случайных чисел, столкновения, давление стирания,
 * поиск пути по сетке улиц.
 */
import { CFG, type Vec2 } from './config';

/** Детерминированный генератор: город всегда один и тот же. */
export function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export interface Box { minX: number; maxX: number; minZ: number; maxZ: number }

/** Вытолкнуть круг (x, z, r) из прямоугольников; возвращает исправленную точку. */
export function resolveCircle(p: Vec2, r: number, boxes: readonly Box[]): Vec2 {
  let { x, z } = p;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of boxes) {
      if (x < b.minX - r || x > b.maxX + r || z < b.minZ - r || z > b.maxZ + r) continue;
      const cx = Math.max(b.minX, Math.min(b.maxX, x));
      const cz = Math.max(b.minZ, Math.min(b.maxZ, z));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // Центр внутри прямоугольника: выходим через ближайшую сторону.
        const l = x - b.minX, rr = b.maxX - x, n = z - b.minZ, f = b.maxZ - z;
        const m = Math.min(l, rr, n, f);
        if (m === l) x = b.minX - r;
        else if (m === rr) x = b.maxX + r;
        else if (m === n) z = b.minZ - r;
        else z = b.maxZ + r;
      }
    }
  }
  return { x, z };
}

/** Давление стирания 0…1: растёт вдали от пса, быстро спадает рядом с ним. */
export function stepErasure(pressure: number, dt: number, distToDog: number): number {
  const far = distToDog > CFG.safe;
  // Чем дальше ушёл, тем быстрее стирает (до ×2.5).
  const k = far ? Math.min(2.5, 1 + (distToDog - CFG.safe) / 12) : 0;
  const next = far ? pressure + CFG.erasePerSec * k * dt : pressure - CFG.healPerSec * dt;
  return Math.max(0, Math.min(1, next));
}

// ───────── Сетка улиц ─────────
/** Оси улиц: между кварталами и по краям города. */
export function streetLines(): number[] {
  const out: number[] = [];
  const half = CFG.blocks / 2;
  for (let i = 0; i <= CFG.blocks; i++) out.push((i - half) * CFG.pitch);
  return out;
}
const LINES = streetLines();
const nearestLine = (v: number) => LINES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
const lineIndex = (v: number) => LINES.indexOf(nearestLine(v));
const onLine = (v: number) => Math.abs(v - nearestLine(v)) <= CFG.street / 2 + 0.5;

/** Узлы графа, к которым можно выйти из точки: концы отрезка улицы, на котором она стоит. */
function exits(p: Vec2): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const seg = (v: number): [number, number] => {
    let i = 0;
    while (i < LINES.length - 2 && v > LINES[i + 1]) i++;
    return [i, i + 1];
  };
  if (onLine(p.x)) { const [a, b] = seg(p.z); const i = lineIndex(p.x); out.push([i, a], [i, b]); }
  if (onLine(p.z)) { const [a, b] = seg(p.x); const j = lineIndex(p.z); out.push([a, j], [b, j]); }
  if (!out.length) out.push([lineIndex(p.x), lineIndex(p.z)]);
  return out;
}

/** Путь по улицам от from до to: список точек (перекрёстки и в конце сама цель). */
export function streetPath(from: Vec2, to: Vec2): Vec2[] {
  const sameStreet = (onLine(from.x) && onLine(to.x) && lineIndex(from.x) === lineIndex(to.x))
    || (onLine(from.z) && onLine(to.z) && lineIndex(from.z) === lineIndex(to.z));
  if (sameStreet) return [to];
  const n = LINES.length;
  const id = (i: number, j: number) => i * n + j;
  const pos = (k: number): Vec2 => ({ x: LINES[Math.floor(k / n)], z: LINES[k % n] });
  const dist = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  const goal = new Map(exits(to).map(([i, j]) => [id(i, j), dist(pos(id(i, j)), to)]));
  const best = new Map<number, number>();
  const prev = new Map<number, number>();
  const open: number[] = [];
  for (const [i, j] of exits(from)) { best.set(id(i, j), dist(from, pos(id(i, j)))); open.push(id(i, j)); }
  let end = -1;
  let endCost = Infinity;
  while (open.length) {
    open.sort((a, b) => best.get(a)! - best.get(b)!);
    const k = open.shift()!;
    const c = best.get(k)!;
    if (c >= endCost) break;
    if (goal.has(k) && c + goal.get(k)! < endCost) { endCost = c + goal.get(k)!; end = k; }
    const i = Math.floor(k / n), j = k % n;
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (a < 0 || b < 0 || a >= n || b >= n) continue;
      const nk = id(a, b);
      const nc = c + CFG.pitch;
      if (nc < (best.get(nk) ?? Infinity)) { best.set(nk, nc); prev.set(nk, k); if (!open.includes(nk)) open.push(nk); }
    }
  }
  if (end < 0) return [to];
  const nodes: Vec2[] = [];
  for (let k: number | undefined = end; k !== undefined; k = prev.get(k)) nodes.unshift(pos(k));
  return [...nodes, to];
}
