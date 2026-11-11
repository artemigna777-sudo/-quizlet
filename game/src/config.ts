/** Общие настройки игры. Расстояния — в метрах, время — в секундах. */
export const CFG = {
  title: 'СТЁРТЫЙ ГОРОД',
  saveKey: 'erased-town:save:v1',
  /** Город: кварталы BLOCKS×BLOCKS, шаг сетки и ширина улицы. */
  blocks: 5,
  pitch: 36,
  street: 10,
  fog: 0x161824,
  /** Игрок. */
  eye: 1.65,
  radius: 0.35,
  walk: 3.2,
  run: 5.6,
  /** Пёс. */
  dogSpeed: 4.6,
  dogRadius: 0.3,
  /** Стирание: дальше safe метров от пса давление растёт, ближе — спадает. */
  safe: 8,
  erasePerSec: 0.085,
  healPerSec: 0.45,
  /** Короткая сторона кадра в «пикселях PS1». */
  pixels: 270,
} as const;

export type Vec2 = { x: number; z: number };
