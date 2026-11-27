import { describe, expect, it } from 'vitest';
import { APARTMENTS, apartmentHeight } from '../src/apartments';
import { Dog } from '../src/dog';
import { FACE_GLASS, facadeGlass } from '../src/facade';
import { HOUSE12, HOUSE12_ID, house12SpotVisible, house12Target, readHouse12Progress } from '../src/house12';
import { clearWalk, walkPath } from '../src/logic';

it('продолжает старое сохранение со стадии тетради и восстанавливает последующие стадии', () => {
  const readLedger = readHouse12Progress(2);
  expect(house12Target(readLedger)).toBe(HOUSE12_ID.tape);
  expect(house12SpotVisible(HOUSE12_ID.parcel, readLedger)).toBe(false);
  const tookTape = readHouse12Progress(3);
  expect(house12SpotVisible(HOUSE12_ID.tape, tookTape)).toBe(false);
  expect(house12Target(tookTape)).toBe(HOUSE12_ID.deck);
  expect(house12SpotVisible(HOUSE12_ID.parcel, readHouse12Progress(4))).toBe(true);
  expect(house12Target(readHouse12Progress(5))).toBe(HOUSE12_ID.pipe);
  expect(house12SpotVisible(HOUSE12_ID.pipe, readHouse12Progress(4))).toBe(false);
  expect(house12Target(readHouse12Progress(6))).toBeUndefined();
  expect(readHouse12Progress(undefined)).toBe(HOUSE12.street);
});

it('различает отдельные стёкла на повторяющихся фасадах, стену и приподнятое окно машины', () => {
  const facade = { box: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 }, height: 6, tilesX: 2, tilesZ: 2, rows: 2, tile: FACE_GLASS.brick };
  const y = (1 - 15 / 32) * 3;
  const before = facadeGlass(facade, { x: 1.5, y, z: 6 });
  expect(before?.key).toBe('2:0:0:0');
  expect(facadeGlass(facade, { x: 5.5, y, z: 6 })?.key).toBe('2:1:0:0');
  expect(facadeGlass(facade, { x: 6.5, y: y + 3, z: 0 })?.key).toBe('3:0:1:0');
  expect(facadeGlass(facade, { x: 1, y, z: 6 })).toBeNull();
  const carWindow = { ...facade, box: { ...facade.box, minY: 1 }, height: 0.66, tilesX: 1, tilesZ: 1, rows: 1, tile: FACE_GLASS.car };
  expect(facadeGlass(carWindow, { x: 4, y: 1.33, z: 6 })?.y).toBeCloseTo(1.33);
  expect(facadeGlass(carWindow, { x: 4, y: 0.7, z: 6 })).toBeNull();
});

describe('маршрут Тузика', () => {
  it('обходит забор и проходит через дверной проём с учётом ширины корпуса', () => {
    const from = { x: 0, z: -3 }, goal = { x: 3, z: 3 }, radius = 0.34;
    const boxes = [
      { minX: -8, maxX: 1.6, minZ: -0.1, maxZ: 0.14 },
      { minX: 2.8, maxX: 8, minZ: -0.1, maxZ: 0.14 },
      { minX: 2.4, maxX: 3.4, minZ: 0.8, maxZ: 1.55 },
    ];
    expect(clearWalk(from, goal, radius, boxes)).toBe(false);
    const route = walkPath(from, goal, radius, boxes);
    expect(route.at(-1)).toEqual(goal);
    expect(route.length).toBeGreaterThan(1);
    expect(route.every((next, i) => clearWalk(i ? route[i - 1] : from, next, radius, boxes))).toBe(true);
  });

  it('останавливается у находки внутри непроходимого предмета', () => {
    const goal = { x: 3, z: 0 }, from = { x: 0, z: 0 }, radius = 0.34;
    const boxes = [{ minX: 2.65, maxX: 3.25, minZ: -0.2, maxZ: 0.25 }];
    const end = walkPath(from, goal, radius, boxes).at(-1)!;
    expect(end).not.toEqual(goal);
    expect(clearWalk(end, end, radius, boxes)).toBe(true);
    expect(Math.hypot(end.x - goal.x, end.z - goal.z)).toBeLessThan(1);
  });

  it('доводит Тузика до цели за забором и возвращает его в поле зрения', () => {
    const dog = new Dog();
    const player = { x: 0, z: -1.7 }, forward = { x: 0, z: 1 }, goal = { x: 1.5, z: 2.3 };
    const fence = [{ minX: -2.5, maxX: 2.5, minZ: -0.07, maxZ: 0.07 }];
    dog.pos = { x: -1.5, z: -1.6 };
    for (let t = 0; t < 7; t += 0.03) dog.update(0.03, t, player, forward, goal, 12, fence);
    expect(dog.state).toBe('point');
    expect(dog.pos.z).toBeGreaterThan(0.4);

    dog.pos = { x: 0, z: -4 };
    for (let t = 0; t < 5; t += 0.03) dog.update(0.03, t, player, forward, null, 12, []);
    expect(dog.pos.z - player.z).toBeGreaterThan(1.6);
    expect(Math.abs(dog.pos.x - player.x)).toBeGreaterThan(0.6);
  });
});

it('высота на лестнице растёт до третьего этажа и возвращается на первый', () => {
  const y = (x: number, z: number, before: number) => apartmentHeight({ x: APARTMENTS.x + x, z: APARTMENTS.z + z }, before);
  const up = (before: number) => {
    let h = before;
    for (let z = 1.1; z >= -4.55; z -= 0.1) h = y(-1, z, h);
    h = y(1, -4.55, h);
    for (let z = -4.55; z <= 1.2; z += 0.1) h = y(1, z, h);
    return y(1, 3, h);
  };
  const down = (before: number) => {
    let h = before;
    for (let z = 1.1; z >= -4.55; z -= 0.1) h = y(1, z, h);
    h = y(-1, -4.55, h);
    for (let z = -4.55; z <= 1.2; z += 0.1) h = y(-1, z, h);
    return y(-1, 3, h);
  };
  expect(up(0)).toBe(3);
  expect(up(3)).toBe(6);
  expect(down(6)).toBe(3);
  expect(down(3)).toBe(0);
});
