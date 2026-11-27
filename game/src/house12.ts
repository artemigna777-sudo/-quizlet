export const HOUSE12 = { street: 0, entrance: 1, ledger: 2, tape: 3, room: 4, parcel: 5, answered: 6 } as const;

export const HOUSE12_ID = {
  ledger: 'chapter2:ledger', tape: 'chapter2:tape', deck: 'chapter2:deck', parcel: 'chapter2:parcel', pipe: 'chapter2:pipe',
} as const;

export const TAPE_LINE = 'Вера, если Костя опять постучит, скажи, что я дома. Я же обещала. Два быстрых, пауза, потом ещё раз. Так он знает, что это я.';

export const PIPE_REPLIES = [
  { label: 'Три стука подряд', taps: [0, 0.24, 0.48], matches: false },
  { label: 'Два стука, пауза, ещё один', taps: [0, 0.24, 0.92], matches: true },
  { label: 'Один стук, пауза, ещё два', taps: [0, 0.63, 0.87], matches: false },
] as const;

export function readHouse12Progress(saved: unknown): number {
  if (typeof saved !== 'number' || !Number.isFinite(saved)) return HOUSE12.street;
  return Math.max(HOUSE12.street, Math.min(HOUSE12.answered, Math.floor(saved)));
}

export function house12Objective(step: number, indoors: boolean): string {
  if (step === HOUSE12.answered) return 'Дом 12 · получен адрес радиомастерской';
  if (!indoors) return 'Глава 2 · найди дом 12 по блокноту';
  if (step === HOUSE12.tape) return 'Дом 12 · отнеси кассету в квартиру 6, этаж 3';
  if (step === HOUSE12.ledger) return 'Дом 12 · найди кассету в квартире 3, этаж 2';
  if (step === HOUSE12.room) return 'Дом 12 · осмотри дальнюю комнату квартиры 6';
  if (step === HOUSE12.parcel) return 'Дом 12 · ответь Косте через трубу в квартире 6';
  return 'Дом 12 · найди тетрадь в квартире 6, этаж 3';
}

export function house12Target(step: number): string | undefined {
  if (step < HOUSE12.ledger) return HOUSE12_ID.ledger;
  if (step === HOUSE12.ledger) return HOUSE12_ID.tape;
  if (step === HOUSE12.tape) return HOUSE12_ID.deck;
  if (step === HOUSE12.room) return HOUSE12_ID.parcel;
  if (step === HOUSE12.parcel) return HOUSE12_ID.pipe;
}

export function house12SpotVisible(id: string, step: number): boolean {
  if (id === HOUSE12_ID.tape) return step < HOUSE12.tape;
  if (id === HOUSE12_ID.parcel) return step >= HOUSE12.room;
  if (id === HOUSE12_ID.pipe) return step >= HOUSE12.parcel;
  return true;
}
