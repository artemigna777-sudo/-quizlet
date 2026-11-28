import { CFG, type Vec2 } from './config';

export const WORKSHOP = { x: 2 * CFG.pitch, z: -CFG.pitch };
export const DEPOT = { x: 2 * CFG.pitch, z: 0 };
export const DISPATCH = { x: 2 * CFG.pitch, z: CFG.pitch };
export const SEASON_BLOCKS = [WORKSHOP, DEPOT, DISPATCH];
export const WORKSHOP_ENTRY = { x: 69, z: -32.5 };
export const DEPOT_ENTRY = { x: 67.5, z: 11.8 };
export const DISPATCH_ENTRY = { x: 72, z: 41 };

export type SeasonStep = 'arrival' | 'power' | 'clue' | 'bus' | 'office' | 'register' | 'relay' | 'call' | 'home' | 'complete';
export type PowerRoute = 'lamp' | 'radio';
export type SeasonDecision = 'addresses' | 'signal';
export interface SeasonProgress {
  step: SeasonStep;
  power: PowerRoute | null;
  decision: SeasonDecision | null;
}
export type SeasonEvent = 'work-order' | 'lamp' | 'radio' | 'lamp-log' | 'radio-log' | 'ticket' | 'dispatch-key' | 'ledger' | 'line-12' | 'addresses' | 'signal' | 'delivery';

type Stage = { next: Readonly<Partial<Record<SeasonEvent, SeasonStep>>>; title: string };
const STAGES: Record<SeasonStep, Stage> = {
  arrival: { next: { 'work-order': 'power' }, title: 'Глава 3 · Радиомастерская' },
  power: { next: { lamp: 'clue', radio: 'clue' }, title: 'Глава 3 · Радиомастерская' },
  clue: { next: { 'lamp-log': 'bus', 'radio-log': 'bus' }, title: 'Глава 3 · Радиомастерская' },
  bus: { next: { ticket: 'office' }, title: 'Глава 4 · Последний рейс' },
  office: { next: { 'dispatch-key': 'register' }, title: 'Глава 4 · Последний рейс' },
  register: { next: { ledger: 'relay' }, title: 'Глава 5 · Возвращение' },
  relay: { next: { 'line-12': 'call' }, title: 'Глава 5 · Возвращение' },
  call: { next: { addresses: 'home', signal: 'home' }, title: 'Глава 5 · Возвращение' },
  home: { next: { delivery: 'complete' }, title: 'Глава 5 · Возвращение' },
  complete: { next: {}, title: 'Сезон 2 пройден' },
};
const STEP_ORDER = Object.keys(STAGES);

export function readSeasonProgress(raw: unknown): SeasonProgress {
  const s = raw && typeof raw === 'object' ? raw as Partial<SeasonProgress> : {};
  const power = s.power === 'lamp' || s.power === 'radio' ? s.power : null;
  const decision = s.decision === 'addresses' || s.decision === 'signal' ? s.decision : null;
  const step = s.step && Object.hasOwn(STAGES, s.step) ? s.step : 'arrival';
  if ((step === 'home' || step === 'complete') && !decision) return { step: 'call', power, decision };
  if (step === 'clue' && !power) return { step: 'power', power, decision: null };
  return { step, power, decision: step === 'home' || step === 'complete' ? decision : null };
}

export function advanceSeason(p: SeasonProgress, event: SeasonEvent): SeasonProgress {
  const step = STAGES[p.step].next[event];
  if (!step || (event === 'lamp-log' && p.power !== 'lamp') || (event === 'radio-log' && p.power !== 'radio')) return p;
  return {
    step,
    power: event === 'lamp' || event === 'radio' ? event : p.power,
    decision: event === 'addresses' || event === 'signal' ? event : p.decision,
  };
}

export type SeasonSpot = 'order' | 'battery' | 'cabinet' | 'receiver' | 'ticket' | 'office' | 'ledger' | 'relay' | 'mic' | 'delivery';
export const SEASON_POINTS: Record<SeasonSpot, Vec2> = {
  order: { x: 66.15, z: -39.1 },
  battery: { x: 68.85, z: -42.3 },
  cabinet: { x: 77.85, z: -41.9 },
  receiver: { x: 67.4, z: -43.15 },
  ticket: { x: 68.0, z: -2.75 },
  office: { x: 77.75, z: -6.1 },
  ledger: { x: 69.4, z: 35.4 },
  relay: { x: 74.9, z: 30.15 },
  mic: { x: 76.6, z: 36.3 },
  delivery: { x: -8.0, z: 16.6 },
};
export function seasonTarget(s: SeasonProgress): SeasonSpot | null {
  switch (s.step) {
    case 'arrival': return 'order';
    case 'power': return 'battery';
    case 'clue': return s.power === 'lamp' ? 'cabinet' : 'receiver';
    case 'bus': return 'ticket';
    case 'office': return 'office';
    case 'register': return 'ledger';
    case 'relay': return 'relay';
    case 'call': return 'mic';
    case 'home': return 'delivery';
    case 'complete': return null;
  }
}

const ARCHIVE: Partial<Record<SeasonSpot, SeasonStep>> = {
  order: 'arrival', cabinet: 'clue', receiver: 'clue', ticket: 'bus', office: 'office', ledger: 'register',
};
export function canUseSeasonSpot(s: SeasonProgress, id: SeasonSpot): boolean {
  if (id === seasonTarget(s) || (id === 'delivery' && s.step === 'complete')) return true;
  const foundAt = ARCHIVE[id];
  if (!foundAt || (id === 'cabinet' && s.power !== 'lamp') || (id === 'receiver' && s.power !== 'radio')) return false;
  return STEP_ORDER.indexOf(foundAt) < STEP_ORDER.indexOf(s.step);
}

export const SPOT_ACTION: Record<SeasonSpot, string> = {
  order: 'прочитать заказ мастера',
  battery: 'подключить аккумулятор',
  cabinet: 'осмотреть освещённый шкаф',
  receiver: 'поймать сигнал на приёмнике',
  ticket: 'достать билет из-под сиденья',
  office: 'открыть ящик в конторе',
  ledger: 'прочитать журнал рейсов',
  relay: 'подключить линию',
  mic: 'выйти в эфир',
  delivery: 'вернуться к Зое',
};

export function seasonObjective(s: SeasonProgress): string {
  const target = seasonTarget(s);
  if (!target) return STAGES.complete.title;
  const goals: Record<SeasonSpot, string> = {
    order: 'найди мастерскую за прачечной',
    battery: 'реши, куда подать питание',
    cabinet: 'осмотри шкаф в подсобке',
    receiver: 'проверь приёмник на верстаке',
    ticket: 'найди в депо автобус № 12',
    office: 'пройди в контору через открывшуюся решётку',
    ledger: 'найди журнал в диспетчерской',
    relay: 'подключи нужную линию',
    mic: 'выбери, что передать в эфир',
    delivery: 'вернись к дому Зои',
  };
  return `${STAGES[s.step].title} · ${goals[target]}`;
}

export function seasonCheckpoint(s: SeasonProgress): Vec2 {
  if (s.step === 'home' || s.step === 'complete') return { x: -8, z: 18.2 };
  if (s.step === 'register' || s.step === 'relay' || s.step === 'call') return DISPATCH_ENTRY;
  if (s.step === 'bus' || s.step === 'office') return DEPOT_ENTRY;
  return WORKSHOP_ENTRY;
}
