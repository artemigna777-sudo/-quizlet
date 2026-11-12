/** Выживание без графики (покрыто тестами): часы суток, здоровье, голод, жажда. */
export interface Vitals { hp: number; food: number; water: number }

export const SURV = {
  /** Сколько секунд длится светлая и тёмная половина суток. */
  dayLen: 720,
  nightLen: 420,
  /** Еды хватает на 25 минут, воды — на 16 (сутки идут 19 минут). Бег тратит в полтора раза быстрее. */
  foodPerSec: 100 / 1500,
  waterPerSec: 100 / 960,
  /** Без еды или воды здоровье уходит; когда сыт — понемногу возвращается. */
  starve: 1.1,
  regen: 0.7,
  regenFrom: 35,
  /** Что дают припасы. */
  eat: 45,
  drink: 55,
  startTime: 0.36,
} as const;

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function stepVitals(v: Vitals, dt: number, running: boolean): Vitals {
  const k = running ? 1.5 : 1;
  const food = clamp(v.food - SURV.foodPerSec * k * dt);
  const water = clamp(v.water - SURV.waterPerSec * k * dt);
  let hp = v.hp;
  if (food <= 0) hp -= SURV.starve * dt;
  if (water <= 0) hp -= SURV.starve * dt;
  if (food > SURV.regenFrom && water > SURV.regenFrom) hp += SURV.regen * dt;
  return { hp: clamp(hp), food, water };
}
export const eat = (v: Vitals): Vitals => ({ ...v, food: clamp(v.food + SURV.eat) });
export const drink = (v: Vitals): Vitals => ({ ...v, water: clamp(v.water + SURV.drink) });
export const hurt = (v: Vitals, dmg: number): Vitals => ({ ...v, hp: clamp(v.hp - dmg) });

/** Время суток 0…1: 0 — полночь, 0.5 — полдень. День (0.25…0.75) идёт медленнее ночи. */
export function advanceClock(t: number, dt: number): number {
  const day = t >= 0.25 && t < 0.75;
  return (t + dt / (2 * (day ? SURV.dayLen : SURV.nightLen))) % 1;
}
/** Свет дня 0…1 с плавными сумерками. */
export function daylight(t: number): number {
  const k = (Math.cos((t - 0.5) * Math.PI * 2) + 0.12) / 0.5;
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
}
export const isNight = (t: number) => daylight(t) < 0.25;
export function clockText(t: number): string {
  const m = Math.floor(t * 24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor((m % 60) / 10) * 10).padStart(2, '0')}`;
}
/** Насколько посерел экран: до 70 здоровья — ничего, у нуля — почти весь. */
export const grayOf = (hp: number) => Math.max(0, Math.min(1, (70 - hp) / 70)) * 0.92;
