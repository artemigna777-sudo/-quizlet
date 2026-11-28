/** Один и тот же ритм слышен в доме и в записи диспетчерской. Время в миллисекундах. */
export const KNOCK_PATTERN = [0, .24, .92] as const;
export const KNOCK_WINDOWS = [[130, 435], [460, 1090]] as const;
export const TAP_TIMEOUT = 1450;
export const knockFits = (index: number, gap: number) => {
  const window = KNOCK_WINDOWS[index];
  return !!window && gap >= window[0] && gap <= window[1];
};

export const RADIO_CHANNEL = 12.6;
export const RADIO_LOCK_MS = 1150;
export const radioStrength = (channel: number) => Math.max(0, 1 - Math.abs(channel - RADIO_CHANNEL) / 2.4);
export const radioInTune = (channel: number) => Math.abs(channel - RADIO_CHANNEL) <= .21;

export const TAPE_ORDER = ['click', 'knock', 'voice'] as const;
export const tapeFits = (order: readonly (string | undefined)[]) => order.length === TAPE_ORDER.length && TAPE_ORDER.every((piece, i) => order[i] === piece);
