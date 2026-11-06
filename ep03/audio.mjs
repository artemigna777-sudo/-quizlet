/**
 * Синтез звука: музыка и эффекты (без чужих записей). 44,1 кГц, стерео, 16 бит.
 */
import { writeFileSync } from 'node:fs';

export function makeAudio(END, SR = 44100) {
  const N = Math.ceil(END * SR);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
  const mk = () => [new Float32Array(N), new Float32Array(N)];
  function add([L, R], t0, dur, fn, gain, pan = 0) {
    const i0 = Math.round(t0 * SR);
    const n = Math.round(dur * SR);
    for (let k = 0; k < n; k++) {
      const i = i0 + k;
      const v = fn(k / SR, k) * gain; // fn вызывается всегда — у генераторов с состоянием фаза не сбивается
      if (i < 0 || i >= N) continue;
      L[i] += v * (1 - Math.max(0, pan));
      R[i] += v * (1 + Math.min(0, pan));
    }
  }
  const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t);
  /** Генератор с плавающей частотой: osc(f) → следующий отсчёт (sin/saw/sq). */
  const osc = (kind = 'saw') => {
    let ph = 0;
    return (f) => {
      ph = (ph + f / SR) % 1;
      if (kind === 'sin') return Math.sin(2 * Math.PI * ph);
      if (kind === 'sq') return ph < 0.5 ? 1 : -1;
      return 2 * ph - 1;
    };
  };
  /** Однополюсный фильтр нижних частот. */
  const lp = (a) => { let y = 0; return (x) => (y += a * (x - y)); };
  function wav(path, [L, R]) {
    const buf = Buffer.alloc(44 + N * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
    buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36);
    buf.writeUInt32LE(N * 4, 40);
    for (let i = 0; i < N; i++) {
      buf.writeInt16LE(Math.round(Math.tanh(L[i]) * 32000), 44 + i * 4);
      buf.writeInt16LE(Math.round(Math.tanh(R[i]) * 32000), 46 + i * 4);
    }
    writeFileSync(path, buf);
  }
  return { N, SR, rnd, mk, add, env, sin, osc, lp, wav };
}

/** Музыка: 124 BPM, Am–F–C–G, бочка/клэп/хэт, бас, пэды, арпеджио. gain(t) — автоматизация громкости. */
export function music(au, END, { dropFrom, dropTo, gain }) {
  const { mk, add, env, sin, rnd } = au;
  const m = mk();
  const beat = 60 / 124;
  const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  for (let b = 0; b * beat < END - 0.3; b++) {
    const t = b * beat;
    const chord = CH[Math.floor(b / 4) % 4];
    const drop = t >= dropFrom && t < dropTo;
    add(m, t, 0.4, (x) => sin(50 + 90 * Math.exp(-x * 30), x) * env(x, 0.002, 0.12), drop ? 0.95 : 0.8);
    if (b % 2 === 1) add(m, t, 0.2, (x) => rnd() * env(x, 0.001, 0.05), 0.28, 0.1);
    add(m, t + beat / 2, 0.06, (x) => rnd() * env(x, 0.0005, 0.015), 0.13, -0.3);
    for (const h of [0, 0.5]) {
      const f = hz(chord[0] - 24);
      add(m, t + h * beat, beat * 0.45, (x) => (Math.sign(sin(f, x)) * 0.5 + sin(f, x)) * env(x, 0.005, 0.12), drop ? 0.32 : 0.24);
    }
    if (b % 4 === 0) chord.forEach((n, j) => add(m, t, beat * 4, (x) => (sin(hz(n), x) + 0.3 * sin(hz(n) * 2.003, x)) * Math.min(1, x / 0.3) * Math.min(1, (beat * 4 - x) / 0.3), 0.06, j - 1));
    for (let s = 0; s < 4; s++) {
      const n = chord[(b * 4 + s) % 3] + 12 + (s === 3 ? 12 : 0);
      add(m, t + (s * beat) / 4, beat / 4, (x) => (sin(hz(n), x) > 0 ? 1 : -1) * 0.5 * env(x, 0.002, 0.05), drop ? 0.07 : 0.045, s % 2 ? 0.4 : -0.4);
    }
  }
  add(m, dropFrom - 1.2, 1.2, (x) => rnd() * (x / 1.2) ** 2, 0.25);
  add(m, dropFrom, 1.5, (x) => sin(40, x) * env(x, 0.003, 0.4), 0.9);
  // Автоматизация громкости (плавно, без щелчков).
  const [L, R] = m;
  let g = gain(0);
  for (let i = 0; i < L.length; i++) {
    g += (gain(i / au.SR) - g) * 0.002;
    L[i] *= g;
    R[i] *= g;
  }
  return m;
}

/** Библиотека эффектов: kinds[kind](t, arg). */
export function effects(au, fx) {
  const { add, env, sin, osc, lp, rnd } = au;
  const k = {
    whoosh: (t) => add(fx, t, 0.35, (x) => rnd() * Math.sin((Math.PI * x) / 0.35) ** 2, 0.3),
    slam: (t) => { add(fx, t, 0.5, (x) => sin(45 + 80 * Math.exp(-x * 25), x) * env(x, 0.002, 0.18), 1.0); add(fx, t, 0.25, (x) => rnd() * env(x, 0.001, 0.06), 0.4); },
    boom: (t) => { add(fx, t, 1.2, (x) => sin(38 + 70 * Math.exp(-x * 18), x) * env(x, 0.003, 0.35), 1.1); add(fx, t, 0.3, (x) => rnd() * env(x, 0.001, 0.07), 0.35); },
    stamp: (t) => { add(fx, t, 0.3, (x) => sin(70, x) * env(x, 0.001, 0.07), 0.9); add(fx, t, 0.15, (x) => rnd() * env(x, 0.001, 0.03), 0.5); },
    pop: (t) => add(fx, t, 0.15, (x) => sin(500 + 7200 * x, x) * env(x, 0.002, 0.04), 0.35),
    tick: (t) => add(fx, t, 0.06, (x) => sin(1800, x) * env(x, 0.001, 0.012), 0.25),
    bubble: (t) => add(fx, t, 0.18, (x) => sin(300 + 1200 * x, x) * env(x, 0.003, 0.05), 0.35),
    type: (t, n = 7) => { for (let i = 0; i < n; i++) add(fx, t + i * 0.08 + rnd() * 0.02, 0.03, (x) => rnd() * env(x, 0.0005, 0.006), 0.35, rnd() * 0.3); },
    ding: (t) => add(fx, t, 0.9, (x) => (sin(1318, x) + 0.5 * sin(1976, x)) * env(x, 0.003, 0.25), 0.22),
    click: (t) => add(fx, t, 0.05, (x) => rnd() * env(x, 0.0005, 0.008), 0.6),
    likes: (t) => { for (let i = 0; i < 10; i++) add(fx, t + i * 0.11, 0.08, (x) => sin(900 + i * 90, x) * env(x, 0.002, 0.02), 0.18, i % 2 ? 0.3 : -0.3); },
    zap: (t) => { add(fx, t, 0.22, (x) => sin(120 + 5000 * x * x, x) * env(x, 0.005, 0.1), 0.35); add(fx, t, 0.04, (x) => rnd(), 0.5); },
    glitch: (t) => { const o = osc('sq'); add(fx, t, 0.16, (x) => (o(200 + 1800 * Math.floor(x * 40 % 3)) * 0.5 + rnd() * 0.5) * (Math.floor(x * 60) % 2), 0.22); },
    siren: (t, d = 1.1) => { const o = osc('sq'); const f = lp(0.15); add(fx, t, d, (x) => f(o(Math.floor(x / 0.18) % 2 ? 770 : 960)) * Math.min(1, (d - x) / 0.15), 0.16); },
    confetti: (t) => { for (let i = 0; i < 14; i++) add(fx, t + i * 0.025, 0.12, (x) => sin(2400 + rnd() * 2400, x) * env(x, 0.001, 0.03), 0.07, rnd() * 0.8); k.pop(t); },
    reel: (t, times) => { for (const ti of times) add(fx, ti, 0.03, (x) => sin(2600, x) * env(x, 0.0005, 0.008), 0.3); },
    // Гонки
    engine: (t, d) => {
      const a = osc('saw'), b = osc('saw'), f = lp(0.08);
      add(fx, t, d, (x) => {
        const p = Math.min(1, x / d);
        const fr = 70 + 150 * p + 12 * Math.sin(x * 9);
        return Math.tanh(2.2 * f(a(fr) + 0.6 * b(fr * 2.01))) * Math.min(1, x / 0.25) * Math.min(1, (d - x) / 0.3);
      }, 0.22);
    },
    nitro: (t) => { const f = lp(0.3); add(fx, t, 0.9, (x) => f(rnd()) * env(x, 0.02, 0.35) * 3, 0.45); add(fx, t, 0.5, (x) => sin(60, x) * env(x, 0.003, 0.2), 0.7); },
    pass: (t) => { const a = osc('saw'); const f = lp(0.1); add(fx, t, 0.9, (x) => f(a(420 - 240 * x) + rnd() * 0.4) * Math.sin(Math.PI * Math.min(1, x / 0.9)) ** 2 * 2, 0.4, -0.2); },
    screech: (t) => add(fx, t, 0.7, (x) => (sin(1900 + 80 * Math.sin(x * 70), x) + 0.7 * sin(2350 + 60 * Math.sin(x * 53), x) + 0.4 * rnd()) * env(x, 0.02, 0.35), 0.13),
    // Хоррор
    drone: (t, d) => add(fx, t, d, (x) => (sin(55, x) + sin(58.3, x) + 0.4 * sin(110.7, x)) * Math.min(1, x / 0.6) * Math.min(1, (d - x) / 0.3), 0.18),
    flick: (t) => { for (let i = 0; i < 5; i++) add(fx, t + i * 0.055, 0.04, (x) => (sin(100, x) + rnd() * 0.6) * (Math.floor(x * 400) % 2), 0.22); },
    heart: (t) => { add(fx, t, 0.2, (x) => sin(48, x) * env(x, 0.004, 0.06), 1.0); add(fx, t + 0.2, 0.2, (x) => sin(44, x) * env(x, 0.004, 0.05), 0.7); },
    sting: (t) => add(fx, t, 1.4, (x) => (sin(1480, x) + sin(1567, x) + 0.6 * sin(2215, x)) * Math.min(1, x / 0.4) * Math.exp(-x / 0.9), 0.05),
    scream: (t) => {
      const a = osc('saw'), b = osc('saw');
      add(fx, t, 0.9, (x) => (a(950 - 520 * x + 70 * Math.sin(x * 44)) * 0.5 + b(1430 - 700 * x + 90 * Math.sin(x * 37)) * 0.4 + rnd() * 0.5) * env(x, 0.005, 0.32), 0.42);
      add(fx, t, 1.1, (x) => sin(34 + 60 * Math.exp(-x * 12), x) * env(x, 0.002, 0.4), 1.2);
    },
    // Выживание
    crackle: (t, d) => { const f = lp(0.04); add(fx, t, d, (x) => f(rnd()) * 1.5 * Math.min(1, x / 0.3), 0.12); for (let x = 0; x < d; x += 0.02 + Math.abs(rnd()) * 0.07) add(fx, t + x, 0.012, (y) => rnd() * env(y, 0.0003, 0.003), 0.18 + Math.abs(rnd()) * 0.3, rnd() * 0.5); },
    waves: (t, d) => { const f = lp(0.02); add(fx, t, d, (x) => f(rnd()) * (0.6 + 0.4 * Math.sin(x * 2.2)) * 2.5 * Math.min(1, x / 0.5), 0.14); },
    fireburst: (t) => { const f = lp(0.12); add(fx, t, 0.8, (x) => f(rnd()) * env(x, 0.02, 0.3) * 3, 0.4); },
    howl: (t) => {
      const make = (delay, g) => { const a = osc('sin'); add(fx, t + delay, 1.8, (x) => { const p = x / 1.8; const f = 360 + 330 * Math.sin(Math.PI * Math.min(1, p * 1.5)) * (p < 0.66 ? 1 : 1 - (p - 0.66) * 1.5) + 7 * Math.sin(x * 32); return (a(f) + 0.2 * a(f * 2)) * Math.sin(Math.PI * p) ** 0.6; }, g, 0.3); };
      make(0, 0.2); make(0.28, 0.07); make(0.55, 0.03);
    },
    ticks: (t, d) => { for (let x = 0; x < d; x += 0.22) add(fx, t + x, 0.04, (y) => sin(3000, y) * env(y, 0.0005, 0.01), 0.18); },
    // Серия 2: места
    creak: (t) => { const a = osc('saw'); add(fx, t, 0.45, (x) => a(140 + 90 * Math.sin(x * 9) + 40 * Math.sin(x * 61)) * (0.6 + 0.4 * Math.sin(x * 210)) * Math.sin(Math.PI * x / 0.45), 0.07, -0.4); },
    crickets: (t, d) => { for (let x = 0.2; x < d; x += 0.55 + Math.abs(rnd()) * 0.4) { const p = rnd() * 0.7; for (let i = 0; i < 3; i++) add(fx, t + x + i * 0.06, 0.04, (y) => sin(4300, y) * sin(60, y), 0.05, p); } },
    steps: (t, d) => { for (let x = 0, g = 0.42; x < d; x += g, g = Math.max(0.24, g * 0.95)) { add(fx, t + x, 0.18, (y) => (sin(70, y) + 0.5 * rnd()) * env(y, 0.002, 0.04), 0.5); add(fx, t + x + 0.12, 0.18, (y) => sin(70, y) * env(y, 0.002, 0.05), 0.15); } },
    buzz: (t, d) => add(fx, t, d, (x) => (sin(100, x) + 0.4 * sin(200, x) + 0.15 * rnd()) * Math.min(1, x / 0.3) * Math.min(1, (d - x) / 0.3), 0.05),
    train: (t, d) => { const f = lp(0.03); add(fx, t, d, (x) => (f(rnd()) * 3 + 0.4 * sin(45, x) + (Math.floor(x * 6) % 2 && x % (1 / 6) < 0.03 ? rnd() : 0)) * Math.exp(-x / (d * 0.45)), 0.45); },
    hum: (t, d) => add(fx, t, d, (x) => (sin(60, x) + 0.5 * sin(120.5, x)) * Math.min(1, x / 0.5) * Math.min(1, (d - x) / 0.3), 0.08),
    alarm: (t, d) => { const o = osc('sq'); const f = lp(0.2); add(fx, t, d, (x) => f(o(x % 0.6 < 0.3 ? 880 : 660)) * Math.min(1, (d - x) / 0.2), 0.1, 0.2); },
    breath: (t, d) => { const f = lp(0.05); add(fx, t, d, (x) => f(rnd()) * 3 * Math.max(0, Math.sin(x * Math.PI * 1.6)) ** 2, 0.18); },
    wind: (t, d) => { const f = lp(0.015); add(fx, t, d, (x) => f(rnd()) * 4 * (0.6 + 0.4 * Math.sin(x * 0.9)) * Math.min(1, x / 0.6) * Math.min(1, (d - x) / 0.4), 0.12); },
    glass: (t) => { for (let i = 0; i < 18; i++) add(fx, t + Math.abs(rnd()) * 0.35, 0.09, (y) => sin(2500 + Math.abs(rnd()) * 4000, y) * env(y, 0.0005, 0.03), 0.1, rnd() * 0.8); add(fx, t, 0.15, (y) => rnd() * env(y, 0.001, 0.04), 0.5); },
    sniff: (t) => { const f = lp(0.25); for (let i = 0; i < 4; i++) add(fx, t + i * 0.16, 0.1, (y) => f(rnd()) * Math.sin(Math.PI * y / 0.1), 0.35); },
    growl: (t) => { const o = osc('saw'); const f = lp(0.06); add(fx, t, 1.1, (x) => f(o(78 + 10 * Math.sin(x * 23) + 6 * rnd())) * 2.5 * Math.min(1, x / 0.15) * Math.min(1, (1.1 - x) / 0.2), 0.35); },
    beep: (t) => add(fx, t, 0.09, (x) => sin(1760, x) * env(x, 0.002, 0.03), 0.16, 0.3),
  };
  return k;
}
