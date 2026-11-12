import { describe, expect, it } from 'vitest';
import { HOMES, ITEMS, canReveal, canTake, memId, revealed, yardGoal, type YardState } from '../src/story';

describe('двор', () => {
  it('цепочку вещей можно пройти до конца, и пёс всегда знает, куда вести', () => {
    let s: YardState = { found: [], taken: [], hold: null };
    const order: string[] = [];
    for (let step = 0; step < 20 && yardGoal(s); step++) {
      const item = ITEMS.find((i) => canTake(s, i))!;
      expect(item).toBeTruthy();
      expect(yardGoal(s)).toBe(item.from);
      s = { ...s, taken: [...s.taken, item.id], hold: item.id };
      expect(yardGoal(s)).toBe(item.owner);
      expect(canReveal(s, item.owner)).toBe(true);
      expect(HOMES.filter((h) => canReveal(s, h.id)).length).toBe(1);
      s = { ...s, found: [...s.found, memId(item.owner)], hold: null };
      order.push(item.owner);
    }
    expect(order).toEqual(['zoya', 'gena', 'tema', 'nina']);
    expect(HOMES.every((h) => revealed(s, h.id))).toBe(true);
    expect(yardGoal(s)).toBeNull();
  });
  it('вещь из стёртой комнаты взять нельзя, вторую вещь в руки — тоже', () => {
    const key = ITEMS.find((i) => i.id === 'key')!;
    expect(canTake({ found: [], taken: [], hold: null }, key)).toBe(false);
    expect(canTake({ found: [memId('zoya')], taken: ['bowl'], hold: null }, key)).toBe(true);
    expect(canTake({ found: [memId('zoya')], taken: ['bowl'], hold: 'bowl' }, key)).toBe(false);
  });
  it('у каждого дома есть записки в обеих комнатах, без повторов', () => {
    const ids = HOMES.flatMap((h) => h.notes.map((n) => n.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of HOMES) {
      expect(h.notes.filter((n) => n.room === 'A').length).toBeGreaterThanOrEqual(2);
      expect(h.notes.filter((n) => n.room === 'B').length).toBeGreaterThanOrEqual(1);
      expect(ITEMS.filter((i) => i.owner === h.id).length).toBe(1);
      expect(ITEMS.filter((i) => i.from === h.id).length).toBe(1);
    }
  });
  it('в текстах нет секретов сюжета и общих слов', () => {
    const all = [...HOMES.flatMap((h) => [h.memory.text, ...h.notes.map((n) => n.title + n.text)]), ...ITEMS.map((i) => i.text)].join(' ').toLowerCase();
    for (const w of ['стрелочник', 'петл', 'хлор', 'концовк', 'тьма', 'отчаян', 'бездн']) expect(all).not.toContain(w);
  });
});
