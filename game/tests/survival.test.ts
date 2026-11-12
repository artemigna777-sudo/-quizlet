import { describe, expect, it } from 'vitest';
import { SURV, advanceClock, clockText, daylight, drink, eat, grayOf, hurt, isNight, stepVitals } from '../src/survival';

describe('выживание', () => {
  it('еда и вода убывают, вода — быстрее, бег — быстрее шага', () => {
    const a = stepVitals({ hp: 100, food: 100, water: 100 }, 60, false);
    const b = stepVitals({ hp: 100, food: 100, water: 100 }, 60, true);
    expect(a.food).toBeLessThan(100);
    expect(a.water).toBeLessThan(a.food);
    expect(b.food).toBeLessThan(a.food);
  });
  it('без еды и воды здоровье уходит, но не мгновенно; сытый — лечится', () => {
    let v = { hp: 100, food: 0, water: 0 };
    let t = 0;
    while (v.hp > 0 && t < 600) { v = stepVitals(v, 1, false); t++; }
    expect(t).toBeGreaterThan(30);
    expect(t).toBeLessThan(120);
    expect(stepVitals({ hp: 50, food: 80, water: 80 }, 10, false).hp).toBeGreaterThan(50);
    expect(stepVitals({ hp: 50, food: 20, water: 80 }, 10, false).hp).toBe(50);
  });
  it('припасы и урон не выходят за 0…100', () => {
    expect(eat({ hp: 1, food: 90, water: 0 }).food).toBe(100);
    expect(drink({ hp: 1, food: 0, water: 10 }).water).toBe(10 + SURV.drink);
    expect(hurt({ hp: 10, food: 0, water: 0 }, 50).hp).toBe(0);
  });
  it('сутки: день длиннее ночи, время идёт по кругу', () => {
    let t = 0.25, sec = 0;
    while (t >= 0.25 && t < 0.75) { t = advanceClock(t, 1); sec++; }
    expect(Math.abs(sec - SURV.dayLen)).toBeLessThan(3);
    let n = 0;
    while (!(t >= 0.25 && t < 0.75)) { t = advanceClock(t, 1); n++; }
    expect(Math.abs(n - SURV.nightLen)).toBeLessThan(3);
  });
  it('свет и часы', () => {
    expect(daylight(0.5)).toBe(1);
    expect(daylight(0)).toBe(0);
    expect(isNight(0.9)).toBe(true);
    expect(isNight(SURV.startTime)).toBe(false);
    expect(clockText(0.5)).toBe('12:00');
    expect(clockText(0)).toBe('00:00');
  });
  it('экран сереет только при малом здоровье', () => {
    expect(grayOf(100)).toBe(0);
    expect(grayOf(70)).toBe(0);
    expect(grayOf(35)).toBeGreaterThan(0.3);
    expect(grayOf(0)).toBeGreaterThan(0.9);
  });
});
