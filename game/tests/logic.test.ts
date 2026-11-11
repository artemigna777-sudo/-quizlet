import { describe, expect, it } from 'vitest';
import { CFG } from '../src/config';
import { resolveCircle, rng, stepErasure, streetLines, streetPath } from '../src/logic';

describe('столкновения', () => {
  const box = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
  it('выталкивает круг из стены', () => {
    const p = resolveCircle({ x: -0.1, z: 5 }, 0.35, [box]);
    expect(p.x).toBeCloseTo(-0.35);
    expect(p.z).toBeCloseTo(5);
  });
  it('выталкивает из середины дома наружу', () => {
    const p = resolveCircle({ x: 1, z: 5 }, 0.35, [box]);
    expect(p.x).toBeLessThanOrEqual(-0.35);
  });
  it('не трогает круг в стороне', () => {
    expect(resolveCircle({ x: -3, z: -3 }, 0.35, [box])).toEqual({ x: -3, z: -3 });
  });
});

describe('стирание', () => {
  it('рядом с псом давление спадает, вдали — растёт', () => {
    expect(stepErasure(0.5, 1, 2)).toBeLessThan(0.5);
    expect(stepErasure(0.5, 1, CFG.safe + 5)).toBeGreaterThan(0.5);
  });
  it('остаётся в пределах 0…1', () => {
    expect(stepErasure(0, 10, 1)).toBe(0);
    expect(stepErasure(0.99, 100, 100)).toBe(1);
  });
  it('стереть успевает не раньше чем за 4 секунды и не позже чем за 15', () => {
    let p = 0, t = 0;
    while (p < 1 && t < 60) { p = stepErasure(p, 0.05, CFG.safe + 10); t += 0.05; }
    expect(t).toBeGreaterThan(4);
    expect(t).toBeLessThan(15);
  });
});

describe('улицы', () => {
  it('оси улиц идут между кварталами и по краям', () => {
    const l = streetLines();
    expect(l.length).toBe(CFG.blocks + 1);
    expect(l[1] - l[0]).toBe(CFG.pitch);
  });
  it('путь по одной улице — прямо к цели', () => {
    expect(streetPath({ x: 18, z: 30 }, { x: 14, z: -10 })).toEqual([{ x: 14, z: -10 }]);
  });
  it('путь через перекрёстки идёт только по улицам', () => {
    const l = streetLines();
    const path = streetPath({ x: 18, z: 30 }, { x: -40, z: 49.6 });
    expect(path.at(-1)).toEqual({ x: -40, z: 49.6 });
    expect(path.length).toBeGreaterThan(1);
    let prev = { x: 18, z: 30 };
    for (const p of path.slice(0, -1)) {
      expect(l).toContain(p.x);
      expect(l).toContain(p.z);
      // каждый шаг идёт вдоль одной оси
      expect(Math.abs(p.x - prev.x) < 6 || Math.abs(p.z - prev.z) < 6).toBe(true);
      prev = p;
    }
  });
  it('генератор детерминирован', () => {
    const a = rng(5), b = rng(5);
    expect(a()).toBe(b());
  });
});
