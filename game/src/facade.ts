import type { Box } from './logic';

/** Прямоугольники стёкол в пикселях той же плитки, которой рисуется фасад. */
type Rect = readonly [left: number, top: number, right: number, bottom: number];
export type GlassTile = { width: number; height: number; panes: readonly Rect[] };
export interface Facade { box: Box; height: number; tilesX: number; tilesZ: number; rows: number; tile: GlassTile }

export const FACE_GLASS = {
  panel: { width: 64, height: 32, panes: [[10, 9, 15, 20], [17, 9, 22, 20], [40, 7, 56, 17]] },
  brick: { width: 32, height: 32, panes: [[10, 9, 15, 21], [17, 9, 22, 21]] },
  wood: { width: 64, height: 32, panes: [[10, 9, 16, 21], [40, 9, 46, 21]] },
  plaster: { width: 32, height: 32, panes: [[7, 9, 16, 24], [17, 9, 25, 24]] },
  car: { width: 16, height: 16, panes: [[0.5, 1, 15.5, 15]] },
  bus: { width: 64, height: 16, panes: [[3, 2, 11, 8], [13, 2, 21, 8], [23, 2, 31, 8], [33, 2, 41, 8], [43, 2, 51, 8], [53, 2, 61, 8]] },
} as const satisfies Record<string, GlassTile>;

/** UV боковых граней BoxGeometry. Возвращает геометрию только одного задетого стекла. */
export function facadeGlass(f: Facade, p: { x: number; y: number; z: number }) {
  const { box: b, tile, height, rows } = f;
  const baseY = b.minY ?? 0;
  const edges = [Math.abs(p.x - b.maxX), Math.abs(p.x - b.minX), Math.abs(p.z - b.maxZ), Math.abs(p.z - b.minZ)];
  const side = edges.indexOf(Math.min(...edges));
  if (edges[side] > 0.0001 || p.y <= baseY || p.y >= baseY + height) return null;
  const xWall = side < 2, forward = side === 1 || side === 2;
  const min = xWall ? b.minZ : b.minX, size = (xWall ? b.maxZ : b.maxX) - min;
  const repeat = xWall ? f.tilesZ : f.tilesX;
  const u = ((xWall ? p.z : p.x) - min) / size;
  const texX = (forward ? u : 1 - u) * repeat;
  const texY = (p.y - baseY) / height * rows;
  const col = Math.floor(texX), row = Math.floor(texY);
  const px = (texX - col) * tile.width, py = (1 - (texY - row)) * tile.height;
  const index = tile.panes.findIndex(([l, t, r, bot]) => px >= l && px < r && py >= t && py < bot);
  if (index < 0) return null;
  const [l, top, r, bottom] = tile.panes[index];
  const a = (col + l / tile.width) / repeat, end = Math.min(1, (col + r / tile.width) / repeat);
  const center = (a + end) / 2;
  const span = min + (forward ? center : 1 - center) * size;
  const normal = side % 2 === 0 ? 1 : -1;
  return {
    key: `${side}:${col}:${row}:${index}`, width: (end - a) * size, height: (bottom - top) / tile.height * height / rows,
    x: xWall ? p.x + normal * 0.014 : span, y: baseY + (row + 1 - (top + bottom) / (2 * tile.height)) * height / rows,
    z: xWall ? span : p.z + normal * 0.014, yaw: [Math.PI / 2, -Math.PI / 2, 0, Math.PI][side],
  };
}
