/**
 * «Игру делают зрители», серия 6 — ролик-вступление для TikTok (1080×1920).
 *
 *   node build.mjs   → out/index.html (композиция HyperFrames), out/voice.wav, out/music.wav, out/sfx.wav
 *   sh render.sh     → mp4/ep06.mp4 (и mp4/ep06-bez-muzyki.mp4 — голос и звуки без музыки)
 *
 * Монтаж идёт по озвучке: паузы в каждой реплике находит ffmpeg, слова раскладываются по ним. Поменял
 * озвучку — пересобери, всё подстроится. Графика — моушн-дизайн кодом (HTML + SVG + GSAP), звук — синтез.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { effects, makeAudio, music } from './audio.mjs';
import { GENRE_CSS, TH, TILE, TW } from './genres.mjs';
import { THUMBS3, TOWN_CSS } from './town.mjs';
import { KEEP_CSS, dogkeep, erasing, light, photos } from './keep.mjs';
import { ACCENT, LINES } from './lines.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, 'out');
mkdirSync(OUT, { recursive: true });

// ═══════════════ Тайминг по озвучке ═══════════════
const probe = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
/** Отрезки речи между паузами. */
function speech(file, dur) {
  const log = spawnSync('ffmpeg', ['-i', file, '-af', 'silencedetect=n=-35dB:d=0.1', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const st = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const en = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const segs = [];
  let cur = 0;
  st.forEach((a, i) => { if (a - cur > 0.08) segs.push([cur, a]); cur = Math.max(cur, en[i] ?? dur); });
  if (dur - cur > 0.08) segs.push([cur, dur]);
  return segs;
}
/** Фразы текста, разделённые знаками, после которых диктор делает паузу. */
function phrases(text) {
  const out = [];
  const re = /[^:,.!?…]+(?:[:,.!?…]+(?=\s|$))?\s*/g;
  let m;
  while ((m = re.exec(text))) if (m[0].trim()) out.push([m.index, m.index + m[0].length]);
  return out;
}
const GAP = 0.18;
const HOLD = { l3: 0.3, l5a: 0.7, l5b: 0.6, l5c: 0.7, l5d: 1.9 };
let cursor = 0.3;
const T = {};
for (const line of LINES) {
  const f = join(DIR, 'voice', `${line.id}.mp3`);
  const d = probe(f);
  T[line.id] = { ...line, start: cursor, dur: d, end: cursor + d, segs: speech(f, d), ph: phrases(line.show) };
  cursor += d + GAP + (HOLD[line.id] || 0);
}
const lastLine = T[LINES.at(-1).id];
const END = +(lastLine.end + 1.7).toFixed(2);
/** Время символа №idx реплики: внутри своей фразы, если число фраз совпало с числом отрезков речи. */
function tAt(L, idx) {
  if (L.ph.length === L.segs.length) {
    let k = L.ph.findIndex(([, b]) => idx < b);
    if (k < 0) k = L.ph.length - 1;
    const [a, b] = L.ph[k];
    const [s, e] = L.segs[k];
    return L.start + s + (e - s) * Math.min(1, Math.max(0, (idx - a) / (b - a)));
  }
  const s = L.segs[0]?.[0] ?? 0;
  const e = L.segs.at(-1)?.[1] ?? L.dur;
  return L.start + s + ((e - s) * idx) / L.show.length;
}
const at = (id, word, shift = 0) => {
  const i = T[id].show.indexOf(word);
  if (i < 0) throw new Error(`нет «${word}» в ${id}`);
  return +(tAt(T[id], i) + shift).toFixed(3);
};
const SCENES = [['s1', ['l1']], ['s2', ['l2']], ['s3', ['l3']], ['s4', ['l4']], ['s5', ['l5', 'l5a', 'l5b', 'l5c', 'l5d']], ['s6', ['l6']], ['s7', ['l7']]];
const SC = SCENES.map(([id, ls], i) => ({
  id,
  from: i === 0 ? 0 : +(T[ls[0]].start - 0.15).toFixed(3),
  to: i === SCENES.length - 1 ? END : +(T[SCENES[i + 1][1][0]].start - 0.15).toFixed(3),
}));
const scene = (id) => SC.find((s) => s.id === id);

// ═══════════════ Субтитры ═══════════════
function chunks(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];
  let cur = [];
  for (const w of words) {
    if (w === '—') { cur.push(w); continue; }
    const len = cur.join(' ').length + w.length;
    if (cur.length && (cur.filter((x) => x !== '—').length >= 3 || len > 17)) { out.push(cur); cur = []; }
    cur.push(w);
    if (/[.!?:…]$/.test(w)) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const isAccent = (w) => ACCENT.some((a) => w.replace(/[.,!?:—…«»"]/g, '') === a);
const caps = [];
for (const line of LINES) {
  const L = T[line.id];
  let pos = 0;
  const parts = chunks(line.show).map((p) => {
    const i = line.show.indexOf(p[0], pos);
    pos = i + p.join(' ').length;
    return { p, i };
  });
  parts.forEach(({ p, i }, k) => {
    const from = tAt(L, i) - 0.04;
    const to = k === parts.length - 1 ? L.end + 0.12 : tAt(L, parts[k + 1].i) - 0.04;
    caps.push({ html: p.map((w) => (isAccent(w) ? `<b>${esc(w)}</b>` : esc(w))).join(' '), from, to });
  });
}

// ═══════════════ Помощники анимации ═══════════════
const js = [];
const sfxList = [];
const A = (s) => js.push(s);
const sfx = (t, kind, arg) => sfxList.push([t, kind, arg]);
const f3 = (v) => (+v).toFixed(3);
const shake = (t, p = 18) =>
  A(`tl.to('#stage',{keyframes:[{x:-${p},y:${p / 2},duration:.04},{x:${p},y:-${p / 2},duration:.04},{x:-${p / 2},y:${p / 3},duration:.04},{x:${p / 3},y:0,duration:.04},{x:0,y:0,duration:.05}]},${f3(t)});`);
const pop = (sel, t, from = 0.3, ease = 'back.out(2)') =>
  A(`tl.fromTo('${sel}',{scale:${from},autoAlpha:0},{scale:1,autoAlpha:1,duration:.35,ease:'${ease}'},${f3(t)});`);
const rise = (sel, t, y = 50) => A(`tl.fromTo('${sel}',{y:${y},autoAlpha:0},{y:0,autoAlpha:1,duration:.3,ease:'power3.out'},${f3(t)});`);
const slam = (sel, t, from = 3, d = 0.22) => A(`tl.fromTo('${sel}',{scale:${from},autoAlpha:0},{scale:1,autoAlpha:1,duration:${d},ease:'power4.in'},${f3(t - d)});`);
/** Значения заранее, кадр показывает нужное (без колбэков — перемотка HyperFrames кадр в кадр). */
function stepper(id, items, cls = '') {
  items.forEach(({ t }, k) => {
    A(`tl.set('#${id}_${k}',{opacity:1},${f3(t)});`);
    if (k > 0) A(`tl.set('#${id}_${k - 1}',{opacity:0},${f3(t)});`);
  });
  return `<span class="stp ${cls}">${items.map(({ text }, k) => `<span class="sv" id="${id}_${k}">${text}</span>`).join('')}</span>`;
}
const fmt = (v) => v.toLocaleString('ru-RU').replace(/\s/g, ' ');
function counter(id, to, t0, t1, steps = 16, cls = '', suffix = '') {
  const items = Array.from({ length: steps + 1 }, (_, k) => ({ t: t0 + ((t1 - t0) * k) / steps, text: fmt(Math.round(to * Math.pow(k / steps, 0.7))) + suffix }));
  return stepper(id, items, cls);
}
let cseed = 99;
const crnd = () => (cseed = (cseed * 16807) % 2147483647) / 2147483647;
/** Конфетти из точки. */
function confetti(id, cx, cy, n, t) {
  const cols = ['#ff7a2e', '#4fd1ff', '#3ecf6e', '#ffd23f', '#ff5c8a', '#a78bfa', '#ffffff'];
  let html = '';
  for (let i = 0; i < n; i++) {
    const a = crnd() * Math.PI * 2;
    const r = 250 + crnd() * 450;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r * 0.8 - 200;
    html += `<i class="cf" id="${id}${i}" style="left:${cx}px;top:${cy}px;background:${cols[i % cols.length]};width:${12 + Math.round(crnd() * 10)}px;height:${18 + Math.round(crnd() * 14)}px"></i>`;
    A(`tl.set('#${id}${i}',{x:0,y:0,rotation:0,opacity:1},${f3(t)});`);
    A(`tl.to('#${id}${i}',{keyframes:[{x:${dx.toFixed(0)},y:${dy.toFixed(0)},rotation:${Math.round(crnd() * 720 - 360)},duration:.55,ease:'power3.out'},{y:${(dy + 650).toFixed(0)},rotation:${Math.round(crnd() * 1080 - 540)},opacity:0,duration:1.3,ease:'power1.in'}]},${f3(t)});`);
  }
  return html;
}
/** Глитч: сдвиг и искажение сцены, цветные полосы. */
let gseed = 5;
const grnd = () => (gseed = (gseed * 16807) % 2147483647) / 2147483647;
function glitch(t, power = 1) {
  A(`tl.to('#stage',{keyframes:[{x:${-34 * power},skewX:${10 * power},filter:'hue-rotate(80deg) saturate(2.5)',duration:.04},{x:${26 * power},skewX:${-7 * power},filter:'hue-rotate(-60deg) saturate(2)',duration:.04},{x:${-10 * power},skewX:3,duration:.03},{x:0,skewX:0,filter:'hue-rotate(0deg) saturate(1)',duration:.04}]},${f3(t)});`);
  for (let i = 0; i < 6; i++) {
    const ti = t + grnd() * 0.12;
    A(`tl.set('#gb${i}',{opacity:.85,top:${Math.round(300 + grnd() * 1100)},height:${Math.round(8 + grnd() * 50)},x:${Math.round(grnd() * 200 - 100)}},${f3(ti)});`);
    A(`tl.set('#gb${i}',{opacity:0},${f3(ti + 0.04 + grnd() * 0.05)});`);
  }
  sfx(t, 'glitch');
}

// ═══════════════ Значки ═══════════════
const ICON = {
  car: `<svg viewBox="0 0 200 120"><path d="M20 82 L28 52 Q34 40 48 40 L120 40 Q132 40 142 50 L162 64 Q182 68 184 82 L184 92 L20 92 Z" fill="none"/><path d="M58 44 L58 64 L136 64 L118 46"/><circle cx="56" cy="94" r="16" fill="#0e0f13"/><circle cx="148" cy="94" r="16" fill="#0e0f13"/></svg>`,
  ghost: `<svg viewBox="0 0 140 160"><path d="M20 150 L20 70 Q20 20 70 20 Q120 20 120 70 L120 150 L103 134 L87 150 L70 134 L53 150 L37 134 Z" fill="none"/><circle cx="52" cy="72" r="9" fill="currentColor"/><circle cx="88" cy="72" r="9" fill="currentColor"/><ellipse cx="70" cy="104" rx="10" ry="13"/></svg>`,
  fire: `<svg viewBox="0 0 160 160"><path d="M80 18 Q104 52 98 72 Q112 62 112 46 Q138 76 128 106 Q118 132 80 132 Q42 132 32 106 Q24 80 46 58 Q48 76 60 82 Q52 50 80 18 Z" fill="none"/><path d="M80 80 Q94 98 90 110 Q86 122 80 122 Q70 122 68 110 Q66 98 80 80Z" fill="none"/><path d="M22 150 L138 136 M22 136 L138 150"/></svg>`,
  pencil: `<svg viewBox="0 0 160 160"><path d="M30 130 L40 98 L112 26 Q120 18 128 26 L134 32 Q142 40 134 48 L62 120 Z" fill="none"/><path d="M100 38 L122 60 M40 98 L62 120"/><path d="M30 130 L50 125"/></svg>`,
  chat: `<svg viewBox="0 0 120 110"><path d="M14 20 Q14 10 24 10 L96 10 Q106 10 106 20 L106 66 Q106 76 96 76 L50 76 L28 98 L32 76 L24 76 Q14 76 14 66 Z" fill="none"/><path d="M36 36 h48 M36 52 h32"/></svg>`,
  me: `<svg viewBox="0 0 120 110"><circle cx="60" cy="38" r="22" fill="none"/><path d="M20 102 Q22 66 60 66 Q98 66 100 102" fill="none"/></svg>`,
  ai: `<svg viewBox="0 0 120 110"><rect x="22" y="28" width="76" height="62" rx="16" fill="none"/><path d="M60 28 V12"/><circle cx="60" cy="10" r="5" fill="currentColor"/><circle cx="45" cy="56" r="7" fill="currentColor"/><circle cx="75" cy="56" r="7" fill="currentColor"/><path d="M46 74 h28 M14 50 v20 M106 50 v20"/></svg>`,
  pad: `<svg viewBox="0 0 140 100"><path d="M30 20 L110 20 Q132 20 134 46 L136 70 Q138 92 118 88 L96 70 L44 70 L22 88 Q2 92 4 70 L6 46 Q8 20 30 20 Z" fill="none"/><path d="M36 36 v24 M24 48 h24"/><circle cx="98" cy="40" r="6" fill="currentColor"/><circle cx="110" cy="54" r="6" fill="currentColor"/></svg>`,
  heart: `<svg viewBox="0 0 40 36"><path d="M20 34 L4 18 Q-2 10 4 4 Q12 -2 20 8 Q28 -2 36 4 Q42 10 36 18 Z" fill="currentColor" stroke="none"/></svg>`,
  crown: `<svg viewBox="0 0 100 70"><path d="M8 62 L4 16 L30 38 L50 6 L70 38 L96 16 L92 62 Z" fill="currentColor" stroke="none"/></svg>`,
  hand: `<svg viewBox="0 0 120 150"><path d="M44 74 L44 18 Q44 6 54 6 Q64 6 64 18 L64 62 L64 52 Q64 42 74 42 Q84 42 84 52 L84 64 Q84 56 93 56 Q102 56 102 66 L102 76 Q102 70 110 70 Q118 70 118 80 L118 104 Q118 140 84 144 L62 144 Q42 142 30 120 L10 88 Q4 78 14 74 Q22 70 30 80 Z" fill="#f4f4f2" stroke="#0e0f13" stroke-width="6"/></svg>`,
  wave: `<svg viewBox="0 0 170 210"><path d="M40 126 L40 64 Q40 50 53 50 Q66 50 66 64 L66 108 L66 36 Q66 22 79 22 Q92 22 92 36 L92 104 L92 30 Q92 16 105 16 Q118 16 118 30 L118 108 L118 52 Q118 38 131 38 Q144 38 144 52 L144 136 Q144 196 90 200 Q52 202 34 168 L12 122 Q6 106 19 101 Q32 96 40 112 Z" fill="#ffd23f" stroke="#0e0f13" stroke-width="7" stroke-linejoin="round"/></svg>`,
  tent: `<svg viewBox="0 0 160 140"><path d="M10 128 L80 18 L150 128Z" fill="none"/><path d="M80 18 L80 128 M60 128 L80 84 L100 128"/><path d="M2 128 H158"/></svg>`,
  train: `<svg viewBox="0 0 140 160"><rect x="20" y="10" width="100" height="120" rx="24" fill="none"/><rect x="36" y="30" width="68" height="40" rx="8" fill="none"/><circle cx="46" cy="100" r="8" fill="currentColor"/><circle cx="94" cy="100" r="8" fill="currentColor"/><path d="M40 130 L22 154 M100 130 L118 154"/></svg>`,
  rocket: `<svg viewBox="0 0 140 170"><path d="M70 8 Q110 40 104 112 L36 112 Q30 40 70 8Z" fill="none"/><circle cx="70" cy="58" r="14" fill="none"/><path d="M36 90 L14 130 L38 120 M104 90 L126 130 L102 120"/><path d="M54 116 Q70 160 86 116" fill="none"/></svg>`,
  box: `<svg viewBox="0 0 160 150"><path d="M20 46 L80 16 L140 46 L140 116 L80 146 L20 116Z" fill="none"/><path d="M20 46 L80 76 L140 46 M80 76 V146 M50 31 L110 61"/></svg>`,
  cam: `<svg viewBox="0 0 170 130"><rect x="10" y="30" width="110" height="80" rx="16" fill="none"/><path d="M120 58 L160 36 V104 L120 82Z" fill="none"/><circle cx="36" cy="18" r="3" fill="currentColor"/><circle cx="34" cy="54" r="9" fill="#ff4d6d" stroke="none"/></svg>`,
  paw: `<svg viewBox="0 0 150 150"><ellipse cx="75" cy="102" rx="34" ry="28" fill="none"/><ellipse cx="34" cy="64" rx="12" ry="16" fill="none"/><ellipse cx="60" cy="38" rx="12" ry="17" fill="none"/><ellipse cx="92" cy="38" rx="12" ry="17" fill="none"/><ellipse cx="117" cy="64" rx="12" ry="16" fill="none"/></svg>`,
  mirror: `<svg viewBox="0 0 140 170"><path d="M20 160 V70 Q20 10 70 10 Q120 10 120 70 V160Z" fill="none"/><path d="M50 60 L64 80 L56 100 M80 40 L74 70 L92 86"/><path d="M8 160 H132"/></svg>`,
  gasmask: `<svg viewBox="0 0 160 160"><path d="M30 60 Q80 20 130 60 L126 110 Q80 150 34 110Z" fill="none"/><circle cx="56" cy="74" r="16" fill="none"/><circle cx="104" cy="74" r="16" fill="none"/><rect x="62" y="110" width="36" height="34" rx="8" fill="none"/></svg>`,
  eye: `<svg viewBox="0 0 170 120"><path d="M10 60 Q85 -10 160 60 Q85 130 10 60Z" fill="none"/><circle cx="85" cy="60" r="22" fill="currentColor"/></svg>`,
  door: `<svg viewBox="0 0 150 170"><path d="M20 160 V12 H100 V160" fill="none"/><path d="M100 12 L136 30 V150 L100 160Z" fill="none"/><circle cx="88" cy="90" r="6" fill="currentColor"/><path d="M6 160 H146"/></svg>`,
  eraser: `<svg viewBox="0 0 170 150"><path d="M20 100 L80 30 L150 90 L100 140 L50 140Z" fill="none"/><path d="M48 66 L118 126"/><path d="M10 140 H160" stroke-dasharray="10 10"/></svg>`,
  lock: `<svg viewBox="0 0 120 140"><rect x="16" y="60" width="88" height="72" rx="12" fill="currentColor" stroke="none"/><path d="M34 60 V40 Q34 12 60 12 Q86 12 86 40 V60" fill="none"/><circle cx="60" cy="94" r="10" fill="#111" stroke="none"/></svg>`,
  bulb: `<svg viewBox="0 0 140 170"><path d="M70 12 Q120 12 120 64 Q120 92 96 112 L96 132 L44 132 L44 112 Q20 92 20 64 Q20 12 70 12Z" fill="none"/><path d="M48 150 H92 M56 166 H84 M70 40 V70"/></svg>`,
  photo: `<svg viewBox="0 0 170 150"><rect x="14" y="14" width="142" height="122" rx="6" fill="none"/><circle cx="62" cy="60" r="14" fill="none"/><path d="M30 120 Q62 74 94 120 M90 120 Q118 90 146 120"/></svg>`,
  warn: `<svg viewBox="0 0 120 110"><path d="M60 8 L114 102 L6 102 Z" fill="#ff3b3b" stroke="none"/><path d="M60 38 V70" stroke="#fff" stroke-width="12" stroke-linecap="round"/><circle cx="60" cy="86" r="7" fill="#fff"/></svg>`,
};

// ═══════════════ Сцены серии 2 ═══════════════
const typed = (text, id) => [...text].map((ch, k) => `<span class="ch" id="${id}${k}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
const type = (id, text, t0, t1) => [...text].forEach((_, k) => A(`tl.set('#${id}${k}',{opacity:1},${f3(t0 + ((t1 - t0) * k) / text.length)});`));

const FP = [[230, 430], [860, 470], [200, 1270], [880, 1230], [540, 400], [170, 860], [910, 880], [560, 1330]];
// ── S1: «Привет!» + штамп «СЕРИЯ 2» → монитор «загрузка сохранения» → комментарии затягивает в игру.
const FEED1 = ['3', 'город стирает!', '3', '333', 'жуть', '1', 'жду игру', '3'];
const THUMBS4 = ['pf0.png', 'pf1.png', 'pf2.png'].map((f) => `<img src="${f}" style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated">`).concat([THUMBS3[0]]);
const S1 = (() => {
  const L = T.l1;
  const tS = at('l1', 'Продолжаем', -0.05);
  const tD = at('l1', 'делать', -0.1);
  const tEnter = tD + 0.62;
  const tC = at('l1', 'по вашим', -0.1);
  const word = 'ПРИВЕТ!';
  [...word].forEach((_, k) => {
    A(`tl.fromTo('#lt${k}',{y:${k % 2 ? 700 : -700},rotation:${k % 2 ? 90 : -90},scale:2.4,opacity:0},{y:0,rotation:${k % 2 ? 4 : -4},scale:1,opacity:1,duration:.34,ease:'back.out(1.7)'},${f3(0.02 + k * 0.03)});`);
  });
  A(`tl.to('.lt',{y:-26,duration:.1,yoyo:true,repeat:1,stagger:.035,ease:'power2.out'},0.42);`);
  A(`tl.fromTo('#crt',{scaleY:.004,opacity:1},{scaleY:1,opacity:0,duration:.18,ease:'power2.out'},0);`);
  sfx(0, 'zap');
  sfx(0.24, 'slam');
  A(`tl.fromTo('#burst',{scale:.2,opacity:.9},{scale:2.4,opacity:0,duration:.6,ease:'power2.out'},0.24);`);
  shake(0.26, 16);
  slam('#ep2', 0.62, 3, 0.18);
  shake(0.62, 14);
  sfx(0.6, 'stamp');
  // Монитор: «продолжаем игру».
  A(`tl.to('#hi,#ep2',{scale:2.4,opacity:0,duration:.22,ease:'power2.in'},${f3(tS - 0.05)});`);
  A(`tl.fromTo('#mon',{scale:.3,rotation:8,autoAlpha:0},{scale:1,rotation:0,autoAlpha:1,duration:.35,ease:'back.out(1.7)'},${f3(tS)});`);
  sfx(tS, 'whoosh');
  type('c1_', 'продолжаем игру', tD, tD + 0.5);
  sfx(tD, 'type', 7);
  A(`tl.fromTo('#cur1',{opacity:1},{opacity:0,duration:.2,repeat:9,yoyo:true,ease:'steps(1)'},${f3(tS)});`);
  A(`tl.to('#mline',{y:-20,opacity:.45,duration:.2},${f3(tEnter)});`);
  A(`tl.fromTo('#gen',{autoAlpha:0},{autoAlpha:1,duration:.1},${f3(tEnter)});`);
  A(`tl.fromTo('#gpb',{scaleX:0},{scaleX:1,duration:${f3(L.end - tEnter)},ease:'power1.inOut'},${f3(tEnter)});`);
  sfx(tEnter, 'click');
  const pct = counter('gpc', 100, tEnter, L.end, 16, 'pct', '%');
  let i = 0;
  for (let t = tEnter + 0.04; t < L.end + 0.1; t += 0.17, i++) {
    const k = i % 4;
    A(`tl.set('.th',{opacity:0},${f3(t)});`);
    A(`tl.set('#th${k}',{opacity:1},${f3(t)});`);
    A(`tl.fromTo('#th${k}',{x:${i % 2 ? 24 : -24},scale:1.08,filter:'hue-rotate(90deg) contrast(1.6)'},{x:0,scale:1,filter:'hue-rotate(0deg) contrast(1)',duration:.1},${f3(t)});`);
    if (i % 2 === 0) sfx(t, 'tick');
  }
  // Комментарии слетаются в монитор.
  FEED1.forEach((_, k) => {
    const t = tC + k * 0.09;
    A(`tl.set('#fd${k}',{opacity:1,x:0,y:0,scale:1},${f3(t)});`);
    A(`tl.to('#fd${k}',{x:${540 - FP[k][0]},y:${840 - FP[k][1]},scale:.1,opacity:0,duration:.4,ease:'power3.in'},${f3(t + 0.08)});`);
    sfx(t + 0.45, 'pop');
  });
  A(`tl.to('#mon',{boxShadow:'0 40px 100px rgba(0,0,0,.7),0 0 120px rgba(255,122,46,.9)',scale:1.05,duration:.15,yoyo:true,repeat:5},${f3(tC + 0.45)});`);
  return { pct };
})();

// ── S2: итоги серии 5 — большинство выбрало «3»: город сам стирает людей.
const OLD = [['1', 'ПОЕЗД', 'train'], ['2', 'ВСЕ УШЛИ', 'door'], ['3', 'СТИРАЕТ', 'eraser'], ['4', 'СВОЁ', 'pencil']];
const ONES = [[80, 830], [480, 760], [60, 1200], [500, 1220], [300, 1240], [460, 1000], [880, 1230], [700, 1240]];
{
  const L = T.l2;
  A(`tl.fromTo('#rh',{scale:.5,autoAlpha:0},{scale:1,autoAlpha:1,duration:.35,ease:'back.out(2)'},${f3(L.start)});`);
  sfx(L.start, 'slam');
  OLD.forEach((_, k) => {
    A(`tl.fromTo('#ot${k}',{scale:.3,rotation:${[-10, 10, 10, -10][k]},autoAlpha:0},{scale:1,rotation:0,autoAlpha:1,duration:.35,ease:'back.out(2)'},${f3(L.start + 0.12 + k * 0.06)});`);
    sfx(L.start + 0.12 + k * 0.06, 'tick');
  });
  const tW = at('l2', 'Большинство', -0.1);
  A(`tl.to('.ot',{opacity:.3,scale:.94,duration:.2},${f3(tW)});`);
  A(`tl.to('#ot2',{opacity:1,scale:1.12,borderColor:'#ff7a2e',background:'rgba(255,122,46,.25)',boxShadow:'0 0 80px rgba(255,122,46,.7)',duration:.25,ease:'back.out(3)'},${f3(tW)});`);
  A(`tl.fromTo('#owcrown',{y:-80,autoAlpha:0,rotation:-30},{y:0,autoAlpha:1,rotation:-12,duration:.35,ease:'bounce.out'},${f3(tW + 0.1)});`);
  ONES.forEach((_, k) => {
    const t = tW + 0.1 + k * 0.07;
    A(`tl.fromTo('#one${k}',{scale:0,rotation:${k % 2 ? 20 : -20},autoAlpha:0},{scale:1,rotation:${k % 2 ? 6 : -6},autoAlpha:1,duration:.25,ease:'back.out(3)'},${f3(t)});`);
    sfx(t, 'pop');
  });
  const tY = at('l2', 'город сам', -0.15);
  A(`tl.to('.one',{autoAlpha:0,scale:.5,duration:.15},${f3(tY)});`);
  A(`tl.fromTo('#itsyou',{scale:3,autoAlpha:0},{scale:1,autoAlpha:1,duration:.2,ease:'power4.in'},${f3(tY)});`);
  glitch(tY + 0.2, 0.6);
  shake(tY + 0.2, 22);
  sfx(tY + 0.18, 'slam');
  sfx(tY + 0.2, 'confetti');
}
const conf2 = confetti('cfa', 300, 1000, 30, at('l2', 'город сам', 0.1));

// ── S3: стирание приходит за тобой — звуки, цвета, ты.
const ERASE = (() => {
  const sc = scene('s3');
  const L = T.l3;
  const tm = { s: sc.from, e: sc.to, sounds: L.start + 2.9, colors: L.start + 3.75, you: L.start + 5.0 };
  return { html: erasing({ A, sfx: (t, k, a) => sfx(t, k, a), stepper, shake }, tm), tm };
})();

// ── S4: план игры, код пишет Claude Code, решаете — ВЫ.
const PLAN = [
  ['p', '&gt; план игры v0.5'],
  ['g', '✓ город сам стирает людей'],
  ['o', '● ночью: звук → цвет → ты'],
  ['g', '✓ концовки: 3 · засекречено'],
  ['q', '? что защищает от стирания — решаете вы'],
];
const RAIN = (() => {
  const tok = ['const', 'let', 'if(', '=>', '{', '}', 'player', 'memory--', 'shooter===player', 'night', 'ending[0]', 'ending[1]', 'ending[2]', 'secret', 'dog.follow()', 'return', 'new', 'Town', 'tick', 'fog', 'ai', '[]', 'THREE'];
  let rs = 37;
  const r = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const sc = scene('s4');
  return Array.from({ length: 12 }, (_, i) => {
    const words = Array.from({ length: 34 }, () => tok[Math.floor(r() * tok.length)]).join('<br>');
    A(`tl.fromTo('#rain${i}',{y:${-1400 - Math.round(r() * 500)}},{y:${200 + Math.round(r() * 300)},duration:${f3(sc.to - sc.from + 0.4)},ease:'none'},${f3(sc.from - 0.2)});`);
    return `<div class="rain" id="rain${i}" style="left:${20 + i * 90}px">${words}</div>`;
  }).join('');
})();
{
  const L = T.l4;
  rise('#codeby', L.start + 0.02, -30);
  const tC = at('l4', 'Claude', -0.12);
  A(`tl.fromTo('#cc',{scale:.4,autoAlpha:0,letterSpacing:'40px'},{scale:1,autoAlpha:1,letterSpacing:'2px',duration:.4,ease:'expo.out'},${f3(tC)});`);
  sfx(tC, 'slam');
  shake(tC + 0.1, 10);
  rise('#term2', L.start + 0.1, 80);
  PLAN.forEach((_, i) => {
    const t = L.start + 0.25 + i * ((L.dur - 0.6) / PLAN.length);
    A(`tl.fromTo('#tl${i}',{x:-40,autoAlpha:0},{x:0,autoAlpha:1,duration:.2,ease:'power3.out'},${f3(t)});`);
    sfx(t, i === PLAN.length - 1 ? 'ding' : 'type', 3);
  });
  A(`tl.to('#tl4',{opacity:.25,duration:.15,yoyo:true,repeat:7,ease:'steps(1)'},${f3(L.end - 0.4)});`);
  const tY = at('l4', 'ВЫ', -0.05);
  slam('#you4', tY + 0.08, 5, 0.18);
  shake(tY + 0.08, 28);
  A(`tl.fromTo('#flash',{opacity:.5},{opacity:0,duration:.3,immediateRender:false},${f3(tY + 0.08)});`);
  sfx(tY + 0.06, 'slam');
}

// ── S5: выбор №2 — место; плитки 1–3 раскрываются мини-сценой.
const P = (() => {
  const ctx = { A, sfx: (t, k, a) => sfx(t, k, a), stepper, shake };
  const nxt = (id) => T[id].start;
  const tm1 = { s: T.l5a.start - 0.1, z: at('l5a', 'свет', 0.05), e: nxt('l5b') - 0.45, blink: at('l5a', 'не видит', -0.15) };
  const tm2 = { s: T.l5b.start - 0.1, z: at('l5b', 'воспоминания', 0.05), e: nxt('l5c') - 0.45, photo: at('l5b', 'фотография', -0.3), real: at('l5b', 'держит', -0.05) };
  const tm3 = { s: T.l5c.start - 0.1, z: T.l5c.start + 0.45, e: nxt('l5d') - 0.45, erase: T.l5c.start + 1.0, remember: T.l5c.start + 2.15 };
  return { html: [light(ctx, tm1), photos(ctx, tm2), dogkeep(ctx, tm3)], tms: [tm1, tm2, tm3] };
})();
const TILES = [['1', 'СВЕТ', 'bulb', 'l5a'], ['2', 'ФОТО', 'photo', 'l5b'], ['3', 'ПЁС', 'paw', 'l5c'], ['4', 'СВОЁ', 'pencil', 'l5d']];
const tileOn = (k, t) => {
  A(`tl.to('#tile${k}',{scale:1.08,borderColor:'#ff7a2e',background:'rgba(255,122,46,.22)',duration:.15},${f3(t)});`);
  A(`tl.fromTo('#tile${k} .ic',{rotation:-12,y:0},{rotation:12,y:-10,duration:.12,yoyo:true,repeat:3},${f3(t)});`);
  sfx(t, 'pop');
};
const tileOff = (k, t) => A(`tl.to('#tile${k}',{scale:1,borderColor:'rgba(244,244,242,.25)',background:'rgba(255,255,255,.05)',duration:.2},${f3(t)});`);
{
  const L = T.l5;
  A(`tl.fromTo('#pollh',{scale:.5,autoAlpha:0},{scale:1,autoAlpha:1,duration:.4,ease:'back.out(2)'},${f3(L.start + 0.05)});`);
  sfx(L.start + 0.05, 'slam');
  const tg = at('l5', 'что', -0.2);
  TILES.forEach((_, k) => {
    A(`tl.fromTo('#tile${k}',{scale:.3,rotation:${[-10, 10, 10, -10][k]},autoAlpha:0},{scale:1,rotation:0,autoAlpha:1,duration:.4,ease:'back.out(2)'},${f3(tg + k * 0.08)});`);
    sfx(tg + k * 0.08, 'tick');
  });
  P.tms.forEach((tm, k) => {
    const [Lf, Tp] = TILE[k];
    const ins = `inset(${Tp}px ${1080 - Lf - TW}px ${1920 - Tp - TH}px ${Lf}px round 36px)`;
    const full = 'inset(0px 0px 0px 0px round 0px)';
    const org = `${Lf + TW / 2}px ${Tp + TH / 2}px`;
    tileOn(k, T[TILES[k][3]].start - 0.1);
    A(`tl.set('#g${k}',{autoAlpha:1},${f3(tm.z - 0.01)});`);
    A(`tl.fromTo('#g${k}',{clipPath:'${ins}'},{clipPath:'${full}',duration:.45,ease:'power3.inOut'},${f3(tm.z)});`);
    A(`tl.fromTo('#g${k}in',{scale:.42,transformOrigin:'${org}'},{scale:1,transformOrigin:'${org}',duration:.45,ease:'power3.inOut'},${f3(tm.z)});`);
    A(`tl.fromTo('#pollh',{autoAlpha:1},{autoAlpha:0,duration:.2,immediateRender:false},${f3(tm.z + 0.25)});`);
    sfx(tm.z - 0.05, 'whoosh');
    A(`tl.to('#g${k}',{clipPath:'${ins}',duration:.35,ease:'power3.in'},${f3(tm.e)});`);
    A(`tl.to('#g${k}in',{scale:.42,duration:.35,ease:'power3.in'},${f3(tm.e)});`);
    A(`tl.set('#g${k}',{autoAlpha:0},${f3(tm.e + 0.36)});`);
    A(`tl.to('#pollh',{autoAlpha:1,duration:.2},${f3(tm.e + 0.2)});`);
    sfx(tm.e, 'whoosh');
    tileOff(k, tm.e + 0.4);
  });
  tileOn(3, T.l5d.start - 0.1);
  A(`tl.to('#tile3 .ic',{rotation:-25,x:-20,duration:.15,yoyo:true,repeat:5},${f3(T.l5d.start + 0.2)});`);
  const tW = at('l5d', 'Пиши', -0.1);
  A(`tl.to('.tile',{scale:1.03,borderColor:'#ff7a2e',background:'rgba(255,122,46,.12)',duration:.25,stagger:.05},${f3(tW)});`);
  A(`tl.to('.tile',{scale:.97,duration:.3,yoyo:true,repeat:5,ease:'sine.inOut'},${f3(tW + 0.4)});`);
  const tC = T.l5d.end + 0.1;
  A(`tl.to('#caps',{autoAlpha:0,duration:.15},${f3(tC)});`);
  A(`tl.fromTo('#cta',{scale:.5,autoAlpha:0},{scale:1,autoAlpha:1,duration:.35,ease:'back.out(2)'},${f3(tC)});`);
  A(`tl.to('#cta span',{y:20,duration:.3,yoyo:true,repeat:5,ease:'sine.inOut'},${f3(tC + 0.3)});`);
  A(`tl.to('#caps',{autoAlpha:1,duration:.1},${f3(scene('s6').from)});`);
  sfx(tC, 'ding');
}

// ── S6: пока ждёте — «Курьер ПДД».
{
  const L = T.l6;
  A(`tl.fromTo('#wait',{scale:.6,autoAlpha:0},{scale:1,autoAlpha:1,duration:.35,ease:'back.out(2)'},${f3(L.start + 0.02)});`);
  const tP = at('l6', 'моя', -0.15);
  A(`tl.to('#wait',{y:-20,scale:.85,duration:.3},${f3(tP)});`);
  A(`tl.fromTo('#phone',{y:900,rotation:12},{y:0,rotation:-4,duration:.55,ease:'back.out(1.3)'},${f3(tP)});`);
  A(`tl.fromTo('#phone .scr>img',{scale:1.3},{scale:1.05,duration:${f3(L.end - tP)},ease:'none'},${f3(tP)});`);
  sfx(tP, 'whoosh');
  const tK = at('l6', 'Курьер', -0.1);
  A(`tl.fromTo('#phone .app b',{scale:2,color:'#ff7a2e'},{scale:1,color:'#f4f4f2',duration:.4,ease:'back.out(2)'},${f3(tK)});`);
  shake(tK + 0.1, 10);
  sfx(tK, 'slam');
  [['нейросетью', 0], ['800', 1], ['экзамен', 2]].forEach(([w, k]) => {
    const t = at('l6', w, -0.15);
    A(`tl.fromTo('#f${k}',{x:120,autoAlpha:0},{x:0,autoAlpha:1,duration:.3,ease:'back.out(1.8)'},${f3(t)});`);
    sfx(t, 'tick');
  });
  const tB = at('l6', 'Ссылка', -0.1);
  pop('#bio', tB, 0.5);
  A(`tl.to('#bio b',{x:12,y:-12,duration:.2,yoyo:true,repeat:5},${f3(tB + 0.3)});`);
  sfx(tB, 'ding');
}

// ── S7: подписка.
const conf9 = (() => {
  const L = T.l7;
  A(`tl.fromTo('#title9',{scale:.6,autoAlpha:0},{scale:1,autoAlpha:1,duration:.4,ease:'back.out(2)'},${f3(L.start)});`);
  pop('#sub', L.start + 0.2, 0.5);
  const tT = L.start + Math.min(0.9, L.dur * 0.5);
  A(`tl.fromTo('#hand',{x:420,y:420,rotation:20,autoAlpha:0},{x:0,y:0,rotation:0,autoAlpha:1,duration:.45,ease:'power3.out'},${f3(tT - 0.45)});`);
  A(`tl.to('#hand',{scale:.85,duration:.08,yoyo:true,repeat:1},${f3(tT)});`);
  A(`tl.to('#sub',{scale:.92,duration:.08,yoyo:true,repeat:1},${f3(tT)});`);
  A(`tl.set('#subA',{autoAlpha:0},${f3(tT + 0.08)});`);
  A(`tl.set('#subB',{autoAlpha:1},${f3(tT + 0.08)});`);
  A(`tl.to('#sub',{background:'#3ecf6e',boxShadow:'0 30px 80px rgba(62,207,110,.5)',duration:.1},${f3(tT + 0.08)});`);
  A(`tl.to('#hand',{x:300,y:500,autoAlpha:0,duration:.5,ease:'power2.in'},${f3(tT + 0.5)});`);
  sfx(tT + 0.05, 'click');
  sfx(tT + 0.12, 'confetti');
  sfx(tT + 0.12, 'ding');
  rise('#next', tT + 0.4, 30);
  A(`tl.to('#root',{opacity:0,duration:.4},${f3(END - 0.4)});`);
  return confetti('cfb', 540, 820, 40, tT + 0.1);
})();

// ═══════════════ Склейки сцен ═══════════════
const TRANS = { s2: 'zoom', s3: 'glitch', s4: 'slide', s5: 'glitch', s6: 'zoom', s7: 'zoom' };
SC.forEach(({ id, from, to }, i) => {
  A(`tl.set('#${id}',{autoAlpha:1},${f3(from)});`);
  if (i > 0) {
    const kind = TRANS[id];
    if (kind === 'zoom') A(`tl.fromTo('#${id}',{scale:1.35,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power3.out',immediateRender:false},${f3(from)});`);
    else if (kind === 'glitch') glitch(from, 1);
    else A(`tl.fromTo('#${id}',{y:110,scale:.96},{y:0,scale:1,duration:.32,ease:'power3.out',immediateRender:false},${f3(from)});`);
    if (kind !== 'glitch') {
      A(`tl.fromTo('#flash',{opacity:.3},{opacity:0,duration:.22,immediateRender:false},${f3(from)});`);
      sfx(from - 0.08, 'whoosh');
    }
  }
  A(`tl.to('#${id}',{autoAlpha:0,duration:.12,ease:'power1.in'},${f3(to - 0.12)});`);
});
A(`tl.fromTo('#grid',{backgroundPosition:'0px 0px'},{backgroundPosition:'0px 900px',duration:${END},ease:'none'},0);`);
A(`tl.fromTo('#pbar',{scaleX:0},{scaleX:1,duration:${END},ease:'none'},0);`);
A(`tl.fromTo('#top',{y:-40,autoAlpha:0},{y:0,autoAlpha:1,duration:.3},0.15);`);
for (let t = 0.0; t < END; t += 60 / 124) A(`tl.fromTo('#glow',{opacity:1},{opacity:.65,duration:.4,ease:'power2.out',immediateRender:false},${f3(t)});`);
caps.forEach((c, k) => {
  A(`tl.fromTo('#cap${k}',{autoAlpha:0,scale:.8,y:20},{autoAlpha:1,scale:1,y:0,duration:.12,ease:'back.out(2)'},${f3(c.from)});`);
  A(`tl.set('#cap${k}',{autoAlpha:0},${f3(c.to)});`);
});

// ═══════════════ HTML ═══════════════
const html = `
<div id="s1" class="scene">
  <div id="burst"></div>
  <div id="hi" class="mega">${[...'ПРИВЕТ!'].map((ch, k) => `<span class="lt" id="lt${k}">${ch}</span>`).join('')}</div>
  <div id="ep2" class="stamp ep">СЕРИЯ 6</div>
  <div id="mon"><div class="scr">
    <div id="mline"><span class="pr">&gt;</span> ${typed('продолжаем игру', 'c1_')}<span class="cur" id="cur1"></span></div>
    <div id="thumbs">${THUMBS4.map((t, k) => `<div class="th" id="th${k}">${t}</div>`).join('')}</div>
    <div id="gen"><b>ЗАГРУЗКА СОХРАНЕНИЯ</b>${S1.pct}<div class="gp"><div id="gpb"></div></div></div>
  </div></div>
  ${FEED1.map((t, k) => `<div class="feed fd" id="fd${k}" style="left:${FP[k][0] - 130}px;top:${FP[k][1] - 30}px">${esc(t)}</div>`).join('')}
</div>

<div id="s2" class="scene">
  <div id="rh" class="big">СЕРИЯ 5: <span>ПОЧЕМУ?</span></div>
  ${OLD.map(([n, t, ic], k) => `<div class="tile ot" id="ot${k}" style="left:${TILE[k][0]}px;top:${TILE[k][1]}px">
    <div class="num">${n}</div><span class="ic">${ICON[ic]}</span><b>${t}</b>${k === 2 ? `<div class="crown" id="owcrown">${ICON.crown}</div>` : ''}</div>`).join('')}
  ${ONES.map(([x, y], k) => `<div class="four one" id="one${k}" style="left:${x}px;top:${y}px">3</div>`).join('')}
  <div id="itsyou">ГОРОД СТИРАЕТ ЛЮДЕЙ</div>
  ${conf2}
</div>

<div id="s3" class="scene">
  <div class="genre" style="visibility:inherit"><div class="gin">${ERASE.html}</div></div>
</div>

<div id="s4" class="scene">
  ${RAIN}
  <div id="codeby" class="label">КОД ПИШЕТ</div>
  <div id="cc" class="mega small">CLAUDE CODE</div>
  <div id="term2" class="term tall"><div class="bar"><i></i><i></i><i></i><span>claude</span></div>
    <div class="body">${PLAN.map(([k, t], i) => `<div class="tl ${k}" id="tl${i}">${t}</div>`).join('')}</div></div>
  <div id="you4" class="you">ВЫ</div>
</div>

<div id="s5" class="scene">
  <div id="pollh" class="big">ВЫБОР №6: <span>ЗАЩИТА</span></div>
  ${TILES.map(([n, t, ic], k) => `<div class="tile" id="tile${k}" style="left:${TILE[k][0]}px;top:${TILE[k][1]}px">
    <div class="num">${n}</div><span class="ic">${ICON[ic]}</span><b>${t}</b></div>`).join('')}
  ${P.html.map((h, k) => `<div class="genre" id="g${k}"><div class="gin" id="g${k}in">${h}</div></div>`).join('')}
  <div id="cta" class="cta">ПИШИ ЦИФРУ<br>В КОММЕНТЫ <span>↓</span></div>
</div>

<div id="s6" class="scene">
  <div id="wait" class="big">ПОКА ЖДЁТЕ —<br><span>МОЯ ПРОШЛАЯ ИГРА</span></div>
  <div id="phone"><div class="scr"><img src="crossroads.webp"><div class="app"><img src="icon-512.png"><b>Курьер ПДД</b></div></div></div>
  <div id="facts">
    <div class="fact" id="f0">сделана <b>нейросетью</b></div>
    <div class="fact" id="f1"><b>800</b> вопросов ПДД</div>
    <div class="fact" id="f2">экзамен <b>как в ГИБДД</b></div>
  </div>
  <div id="bio" class="pill">ССЫЛКА В ПРОФИЛЕ <b>↗</b></div>
</div>

<div id="s7" class="scene">
  <div id="title9" class="big">ИГРУ ДЕЛАЮТ<br><span>ЗРИТЕЛИ</span></div>
  <div id="sub" class="sub"><div id="subA">+ ПОДПИСАТЬСЯ</div><div id="subB">✓ ТЫ В ДЕЛЕ</div></div>
  <div id="hand">${ICON.hand}</div>
  <div id="next" class="label wide">СЕРИЯ 7: СНОВА ВАШ ВЫБОР</div>
  ${conf9}
</div>`;

const EXTRA_CSS = `
.stamp.ep{top:690px;width:520px;font-size:100px}
.fd{z-index:6}
.ot{transform-origin:50% 50%}
.crown{position:absolute;left:20px;top:-62px;width:110px;height:78px;color:#ffd23f;opacity:0;visibility:hidden}
.four{position:absolute;width:100px;height:80px;border-radius:24px 24px 24px 4px;background:#f4f4f2;color:#111;font-family:Russo;font-size:58px;line-height:80px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;visibility:hidden;z-index:6}
#bigheart{position:absolute;left:390px;top:720px;width:300px;height:270px;color:#ff4d6d;opacity:0;visibility:hidden;z-index:6;filter:drop-shadow(0 0 40px rgba(255,77,109,.7))}
#bigheart svg{width:100%;height:100%}
#twt{font-size:110px;color:#e8e3d2;text-shadow:0 8px 0 #2a2030,0 0 40px rgba(255,200,120,.35)}
#itsyou{position:absolute;left:0;right:0;margin:auto;top:1140px;width:940px;text-align:center;padding:18px 0;border-radius:24px;background:var(--o);color:#111;font-family:Russo;font-size:62px;transform:rotate(-3deg);box-shadow:0 20px 60px rgba(0,0,0,.6);opacity:0;visibility:hidden;z-index:8}
#owcrown{left:120px;top:-62px}
.one{background:var(--o);color:#111}
#qcm{position:absolute;left:90px;top:620px;width:900px;display:flex;align-items:center;gap:24px;padding:28px 34px;border-radius:34px;background:#f4f4f2;color:#111;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 6px var(--o);opacity:0;visibility:hidden;z-index:6}
#qcm>.ic{width:110px;height:100px;color:var(--o);flex:none}
#qcm small{display:flex;align-items:center;gap:10px;font-weight:900;font-size:28px;letter-spacing:3px;color:#8c5a2e}
#qcm small .hrt{width:40px;height:36px;display:inline-block}
#qcm b{display:block;font-weight:900;font-size:58px;line-height:1.08}
.endc{position:absolute;top:700px;width:300px;height:420px;border-radius:30px;border:5px solid var(--o);background:linear-gradient(#20160f,#0e0f13);text-align:center;perspective:800px;opacity:0;visibility:hidden}
.endc .ic{display:block;margin:50px auto 20px;width:110px;height:128px;color:var(--o)}
.endc b{display:block;font-family:Russo;font-size:38px}
.endc i{display:block;margin-top:12px;font-style:normal;font-family:Russo;font-size:72px;color:var(--o)}
#onlyg{position:absolute;left:0;right:0;margin:auto;top:1060px;width:820px;text-align:center;padding:14px 0;font-family:Russo;font-size:84px;color:#ff3b3b;border:12px solid #ff3b3b;border-radius:24px;background:rgba(14,15,19,.85);opacity:0;visibility:hidden;z-index:7}
#pv{position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover}
#pvrec{position:absolute;left:70px;top:350px;font-family:Mono;font-size:34px;color:#ff4d4d;text-shadow:0 0 10px #000;z-index:3}
#pvlab{position:absolute;left:0;right:0;top:420px;text-align:center;font-family:Russo;font-size:96px;line-height:1.05;color:#fff;text-shadow:0 8px 0 #000,0 0 30px rgba(0,0,0,.8);opacity:0;visibility:hidden;z-index:3}
#pvlab span{color:var(--o)}
.three{background:#4fd1ff;color:#08131a}
#dogb{position:absolute;left:0;right:0;margin:auto;top:1140px;width:900px;text-align:center;padding:20px 0;border-radius:999px;background:rgba(10,30,40,.92);border:5px solid #4fd1ff;font-family:Russo;font-size:46px;color:#9ff6ff;box-shadow:0 0 60px rgba(79,209,255,.5);opacity:0;visibility:hidden;z-index:8}
#rh{top:380px;font-size:92px;opacity:0;visibility:hidden}
#winc{position:absolute;left:100px;top:720px;width:880px;display:flex;align-items:center;gap:24px;padding:26px 34px;border-radius:34px;background:#f4f4f2;color:#111;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 6px var(--o);opacity:0;visibility:hidden;z-index:8}
#winc .ic{width:110px;height:100px;color:var(--o);flex:none}
#winc small{display:block;font-weight:900;font-size:30px;letter-spacing:5px;color:#8c5a2e}
#winc b{display:block;font-weight:900;font-size:52px;line-height:1.08}
#winc em{display:inline-block;font-style:normal;color:var(--o)}
#mix .gtitle{display:none}
#mix #svhud{top:610px}
.mixt{position:absolute;left:0;right:0;top:350px;text-align:center;font-family:Russo;font-size:120px;line-height:1;color:#ffd23f;text-shadow:0 8px 0 #7a3a00,0 0 40px rgba(255,140,40,.6);opacity:0;visibility:hidden;z-index:7}
.mixt.red{top:470px;color:#ff2a3a;text-shadow:5px 0 #00e5ff,-5px 0 #ff0040,0 0 50px rgba(255,0,40,.8)}
#mxdark{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 60%,rgba(0,0,0,0) 15%,rgba(10,0,0,.92) 70%);opacity:0;z-index:5}
#mxfig{position:absolute;left:770px;top:780px;width:150px;height:390px;opacity:0;visibility:hidden;z-index:6;transform-origin:50% 100%}
.needs{position:absolute;left:0;right:0;top:470px;display:flex;justify-content:center;gap:16px;z-index:7}
.need{padding:12px 24px;border-radius:999px;background:rgba(0,0,0,.65);border:3px solid #ffd23f;font-weight:900;font-size:36px;color:#ffd23f;opacity:0;visibility:hidden}
.tl.q{color:var(--o);font-weight:700}
#you4{top:560px;z-index:6}
#wait{top:380px;font-size:76px;opacity:0;visibility:hidden}
#wait span{font-size:68px}
#facts{top:690px}
`;

// ═══════════════ CSS ═══════════════
const font = (name, file, w = '400') => `@font-face{font-family:'${name}';font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(join(DIR, 'assets', 'fonts', file)).toString('base64')}) format('woff2');}`;
const fonts = readdirSync(join(DIR, 'assets', 'fonts'));
const ff = (prefix) => fonts.filter((f) => f.startsWith(prefix));
const CSS = `
${ff('montserrat').map((f) => font('Montserrat', f, '100 900')).join('\n')}
${ff('russo').map((f) => font('Russo', f)).join('\n')}
${ff('pt-mono').map((f) => font('Mono', f)).join('\n')}
:root{--o:#ff7a2e;--g:#3ecf6e;--c:#4fd1ff;--bg:#0e0f13;--fg:#f4f4f2;--dim:#8c8f97}
*{box-sizing:border-box}
body{margin:0;background:#000}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:var(--bg);font-family:Montserrat,sans-serif;color:var(--fg)}
#grid{position:absolute;inset:-100px;background-image:linear-gradient(rgba(255,255,255,.045) 2px,transparent 2px),linear-gradient(90deg,rgba(255,255,255,.045) 2px,transparent 2px);background-size:90px 90px;transform:perspective(900px) rotateX(18deg)}
#glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 38%,rgba(255,122,46,.22),transparent 55%),radial-gradient(circle at 80% 90%,rgba(79,209,255,.10),transparent 50%)}
#flash,#gflash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:50}
#crt{position:absolute;inset:0;background:#fff;z-index:60;opacity:0;transform-origin:50% 50%}
#stage{position:absolute;inset:0}
.gbars i{position:absolute;left:0;right:0;opacity:0;z-index:55;mix-blend-mode:screen}
.gbars i:nth-child(odd){background:rgba(79,209,255,.75)}.gbars i:nth-child(even){background:rgba(255,45,117,.75)}
.scene{position:absolute;inset:0;visibility:hidden;opacity:0}
#top{position:absolute;top:220px;left:80px;right:80px;display:flex;justify-content:space-between;align-items:center;z-index:20}
#top .tag{font-weight:900;font-size:34px;letter-spacing:2px;padding:14px 26px;border:3px solid var(--o);border-radius:999px;color:var(--o);background:rgba(14,15,19,.85)}
#top .ep{font-family:Russo;font-size:38px;padding:12px 26px;background:var(--o);color:#111;border-radius:16px}
#ptrack{position:absolute;top:322px;left:80px;right:80px;height:8px;background:rgba(255,255,255,.1);border-radius:8px;z-index:20}
#pbar{height:100%;background:var(--o);border-radius:8px;transform-origin:0 50%}
.ic svg{width:100%;height:100%;stroke:currentColor;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;fill:none;overflow:visible}
.mega{position:absolute;left:0;right:0;text-align:center;font-family:Russo;font-size:210px;top:440px;color:var(--fg);text-shadow:0 12px 0 var(--o);white-space:nowrap}
.mega.small{font-size:132px;top:470px;text-shadow:0 8px 0 var(--o)}
.lt{display:inline-block}
#burst{position:absolute;left:140px;top:150px;width:800px;height:800px;border-radius:50%;border:30px solid var(--o);opacity:0}
#wave{position:absolute;left:800px;top:690px;width:200px;height:250px;transform-origin:50% 90%}
#wave svg{width:100%;height:100%}
.big{position:absolute;left:60px;right:60px;text-align:center;font-family:Russo;font-size:92px;line-height:1.05;top:400px}
.big span{color:var(--o)}
.label{position:absolute;left:50%;transform:translateX(-50%);top:400px;font-weight:900;font-size:44px;letter-spacing:6px;padding:14px 34px;border-radius:999px;background:rgba(14,15,19,.75);border:3px solid rgba(255,255,255,.2);white-space:nowrap}
.label.wide{top:1120px;font-size:38px;letter-spacing:3px;color:var(--o);border-color:var(--o)}
#mon{position:absolute;left:90px;top:560px;width:900px;height:560px;border-radius:34px;background:#1f222a;border:4px solid #3a3e4a;box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 60px rgba(255,122,46,.25);opacity:0;visibility:hidden}
#mon .scr{position:absolute;inset:22px;border-radius:20px;background:#08090c;overflow:hidden}
#mline{position:absolute;left:30px;top:22px;font-family:Mono;font-size:54px;color:var(--fg);white-space:nowrap}
#mline .pr{color:var(--o)}
.ch{opacity:0}
.cur{display:inline-block;width:28px;height:54px;background:var(--o);vertical-align:-8px;margin-left:6px}
#thumbs{position:absolute;left:0;right:0;top:0;bottom:0}
.th{position:absolute;inset:0;opacity:0}
.th svg{width:100%;height:100%}
#gen{position:absolute;left:24px;right:24px;bottom:20px;padding:14px 20px;border-radius:16px;background:rgba(0,0,0,.72);opacity:0;visibility:hidden}
#gen b{font-weight:900;font-size:30px;letter-spacing:3px;color:var(--c)}
.stp{position:relative;display:block}
.stp .sv{position:absolute;left:0;right:0;top:0;opacity:0;white-space:nowrap}
.stp.pct{position:absolute;right:20px;top:12px;width:120px;height:40px}.stp.pct .sv{text-align:right;font-family:Mono;font-size:34px;color:#fff}
.gp{margin-top:12px;height:14px;background:#2b2e37;border-radius:8px;overflow:hidden}#gpb{height:100%;background:linear-gradient(90deg,var(--c),var(--o));transform-origin:0 50%}
#enter{position:absolute;left:390px;top:1150px;width:300px;padding:20px 0;text-align:center;border-radius:20px;background:#2b2e37;border:4px solid #555;box-shadow:0 10px 0 #111;font-family:Russo;font-size:48px;color:#fff;opacity:0;visibility:hidden}
.stamp{position:absolute;top:760px;left:0;right:0;margin:auto;width:560px;text-align:center;font-family:Russo;font-size:120px;color:var(--o);background:rgba(14,15,19,.85);border:12px solid var(--o);border-radius:24px;padding:6px 0;opacity:0;visibility:hidden;transform:rotate(-8deg);z-index:5}
#nnet{position:absolute;inset:0;opacity:0;visibility:hidden}
#nnet svg{position:absolute;inset:0;width:1080px;height:1920px}
#nnet .edges line{stroke:rgba(79,209,255,.35);stroke-width:3}#nnet .edges line.sk{stroke:rgba(79,209,255,.6);stroke-dasharray:10 10}
.nnode{fill:#0e0f13;stroke:var(--c);stroke-width:6}
.pulse{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#fff;box-shadow:0 0 20px 8px var(--c);opacity:0}
#redwash{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(255,40,40,.0) 30%,rgba(255,40,40,.7));opacity:0}
.tape{position:absolute;left:-160px;width:1400px;height:96px;background:repeating-linear-gradient(-45deg,#ffd23f 0 44px,#111 44px 88px);box-shadow:0 10px 30px rgba(0,0,0,.5)}
#tape0{top:400px;transform:rotate(-5deg)}#tape1{top:1130px;transform:rotate(4deg)}
#alert{position:absolute;left:100px;top:600px;width:880px;height:270px;border-radius:34px;border:8px solid #ff3b3b;background:rgba(40,8,10,.92);display:flex;align-items:center;gap:30px;padding:0 40px;opacity:0;visibility:hidden}
#alert .ic{width:170px;height:156px;flex:none}
#alert small{display:block;font-weight:900;font-size:40px;letter-spacing:8px;color:#ff6b6b}
#alert b{display:block;font-family:Russo;font-size:86px;line-height:1.05;white-space:nowrap}
#reel{position:absolute;left:120px;top:610px;width:840px;opacity:0;visibility:hidden}
#reel .rl{text-align:center;font-weight:900;font-size:36px;letter-spacing:10px;color:var(--o);margin-bottom:12px}
#reel .rwin{height:230px;border-radius:30px;border:6px solid var(--o);background:#08090c;overflow:hidden;box-shadow:0 0 60px rgba(255,122,46,.4),inset 0 30px 40px rgba(0,0,0,.8),inset 0 -30px 40px rgba(0,0,0,.8)}
#strip div{height:230px;line-height:230px;text-align:center;font-family:Russo;font-size:104px;white-space:nowrap}
#strip div:last-child{color:var(--o)}
.av{position:absolute;width:110px;height:110px;border-radius:50%;border:6px solid;overflow:hidden;background:#1a1c22;opacity:0;visibility:hidden}
.av div{position:absolute;width:44px;height:44px;border-radius:50%;left:27px;top:16px}
.av i{position:absolute;width:84px;height:60px;border-radius:42px 42px 0 0;left:7px;top:68px}
.you{position:absolute;left:0;right:0;top:640px;text-align:center;font-family:Russo;font-size:400px;line-height:1;color:var(--o);text-shadow:0 0 90px rgba(255,122,46,.7),0 14px 0 #7a2a00;opacity:0;visibility:hidden}
.cf{position:absolute;opacity:0;border-radius:3px;z-index:7}
.card{position:absolute;height:210px;border-radius:30px;background:rgba(20,22,28,.92);border:4px solid rgba(244,244,242,.25);opacity:0;visibility:hidden}
.card .cl{position:absolute;left:30px;top:22px;font-weight:900;font-size:38px;letter-spacing:4px;color:var(--dim)}
.card .q{position:absolute;right:40px;top:30px;font-family:Russo;font-size:150px;line-height:1;color:var(--o)}
.card .ans{position:absolute;left:30px;right:24px;bottom:28px;display:flex;align-items:center;gap:14px;font-weight:900;font-size:40px;color:#111;background:var(--fg);border-radius:22px;padding:12px 20px;opacity:0;visibility:hidden;white-space:nowrap}
.card .ans .ic{width:56px;height:52px;flex:none;color:var(--o)}
.feed{position:absolute;padding:10px 22px;border-radius:999px;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.2);font-weight:800;font-size:30px;white-space:nowrap;opacity:0}
.pill{position:absolute;left:50%;transform:translateX(-50%);top:640px;white-space:nowrap;font-weight:800;font-size:52px;letter-spacing:2px;padding:16px 40px;border-radius:999px;border:4px solid var(--o);background:rgba(40,20,10,.85)}
.pill b{color:var(--o);font-weight:900}
#opus{opacity:0;visibility:hidden}
.rain{position:absolute;top:0;font-family:Mono;font-size:28px;line-height:44px;color:rgba(79,209,255,.22);white-space:nowrap}
.term{position:absolute;left:90px;width:900px;background:#16181e;border:3px solid #2b2e37;border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.term .bar{height:64px;background:#1f222a;display:flex;align-items:center;gap:14px;padding:0 26px}
.term .bar i{width:20px;height:20px;border-radius:50%;background:#ff5f57}.term .bar i:nth-child(2){background:#febc2e}.term .bar i:nth-child(3){background:#28c840}
.term .bar span{margin-left:20px;font-family:Mono;color:var(--dim);font-size:30px}
.term.tall{top:780px;opacity:0;visibility:hidden}
.term.tall .body{font-family:Mono;font-size:38px;padding:30px 34px;line-height:1.55}
.tl{opacity:0;white-space:nowrap}.tl.p{color:var(--fg)}.tl.o{color:var(--dim)}.tl.g{color:var(--g);font-weight:700}.tl em{font-style:normal;color:var(--g)}
.prog{margin-top:18px;height:14px;background:#2b2e37;border-radius:8px;overflow:hidden}#pg{height:100%;background:var(--o);transform-origin:0 50%}
#mylines{top:380px}
.duo{position:absolute;top:480px;width:430px;height:440px;border-radius:36px;border:4px solid rgba(244,244,242,.2);background:rgba(20,22,28,.9);text-align:center;opacity:0;visibility:hidden}
#duoA{left:90px;border-color:rgba(79,209,255,.6)}#duoB{left:560px;border-color:rgba(62,207,110,.6)}
.duo>b{display:block;margin-top:30px;font-weight:900;font-size:40px;letter-spacing:4px}
.duo>b.cy{color:var(--c)}
.stp.ai{position:absolute;left:0;right:0;top:170px;height:140px}.stp.ai .sv{text-align:center;font-family:Russo;font-size:96px;color:var(--c);text-shadow:0 0 40px rgba(79,209,255,.5)}
.zero{position:absolute;left:0;right:0;top:90px;text-align:center;font-family:Russo;font-size:300px;line-height:1;color:var(--g);text-shadow:0 0 90px rgba(62,207,110,.5);opacity:0;visibility:hidden}
#flow{position:absolute;top:960px;left:40px;right:40px;display:flex;align-items:center;justify-content:center}
.node{width:200px;height:200px;border-radius:30px;border:4px solid rgba(244,244,242,.3);background:rgba(20,22,28,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;opacity:0;visibility:hidden}
.node .ic{width:96px;height:88px;color:var(--fg)}
.node b{font-size:30px;font-weight:900;letter-spacing:1px}
#nd0 .ic{color:var(--o)}#nd2 .ic{color:var(--c)}#nd3 .ic{color:var(--g)}
.arr{width:40px;height:8px;background:var(--o);transform-origin:0 50%;position:relative}
.arr:after{content:'';position:absolute;right:-8px;top:-10px;border-left:18px solid var(--o);border-top:14px solid transparent;border-bottom:14px solid transparent}
#rule1{top:390px;font-size:88px;opacity:0;visibility:hidden}
.cm{position:absolute;left:90px;width:900px;height:150px;border-radius:30px;background:#181a20;border:4px solid #2b2e37;display:flex;align-items:center;padding:0 30px;gap:24px;opacity:0;visibility:hidden}
.ava{width:86px;height:86px;border-radius:50%;flex:none}
.ctext{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}
.ctext b{font-size:30px;color:var(--dim)}
.ctext span{font-size:38px;font-weight:800;white-space:nowrap}
.likes{display:flex;flex-direction:column;align-items:center;gap:4px;width:130px;flex:none}
.hrt{width:52px;height:46px;color:#ff4d6d;display:block}
.hrt svg,.fh svg{width:100%;height:100%}
.stp.lk{width:130px;height:40px}.stp.lk .sv{text-align:center;font-weight:900;font-size:34px}
.fh{position:absolute;left:880px;width:44px;height:40px;color:#ff4d6d;opacity:0;z-index:3}
.crown{position:absolute;left:8px;top:-52px;width:90px;height:64px;color:#ffd23f;opacity:0;visibility:hidden}
.crown svg{width:100%;height:100%}
.win{position:absolute;right:150px;top:-30px;background:var(--o);color:#111;font-family:Russo;font-size:34px;padding:6px 18px;border-radius:12px;transform:rotate(4deg);opacity:0;visibility:hidden}
#doubt{top:380px;font-size:86px;opacity:0;visibility:hidden}
#phone{position:absolute;left:80px;top:600px;width:400px;height:600px;border-radius:56px;border:14px solid #2b2e37;background:#000;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 0 4px #444 inset}
#phone .scr{position:absolute;inset:0;overflow:hidden}
#phone .scr>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#phone .app{position:absolute;left:0;right:0;bottom:0;padding:26px 20px 30px;background:linear-gradient(transparent,rgba(0,0,0,.9) 40%);display:flex;align-items:center;gap:16px}
#phone .app img{width:76px;height:76px;border-radius:18px}
#phone .app b{font-family:Russo;font-size:40px}
#facts{position:absolute;left:520px;top:640px;width:430px;display:flex;flex-direction:column;gap:22px}
.fact{font-size:36px;font-weight:700;padding:20px 24px;border-radius:22px;background:rgba(20,22,28,.9);border-left:8px solid var(--o);opacity:0;visibility:hidden}
.fact b{color:var(--o);font-weight:900}
#bio{top:1110px;transform:none;left:520px;font-size:32px;padding:14px 24px;opacity:0;visibility:hidden}
#bio b{display:inline-block}
#pollh{top:380px;font-size:80px;opacity:0;visibility:hidden}
.tile{position:absolute;width:430px;height:320px;border-radius:36px;border:5px solid rgba(244,244,242,.25);background:rgba(255,255,255,.05);opacity:0;visibility:hidden}
.tile .num{position:absolute;left:30px;top:16px;font-family:Russo;font-size:130px;line-height:1;color:var(--o)}
.tile .ic{position:absolute;right:30px;top:40px;width:190px;height:150px;color:var(--fg)}
.tile b{position:absolute;left:32px;bottom:26px;font-family:Russo;font-size:48px}
.cta{position:absolute;left:0;right:0;top:1250px;text-align:center;font-family:Russo;font-size:90px;line-height:1.05;color:var(--fg);text-shadow:0 8px 0 var(--o);opacity:0;visibility:hidden;z-index:8}
.cta span{display:inline-block;color:var(--o);text-shadow:none}
#title9{top:400px;font-size:110px;opacity:0;visibility:hidden}
.sub{position:absolute;left:140px;width:800px;top:720px;height:200px;border-radius:999px;background:#ff2d55;box-shadow:0 30px 80px rgba(255,45,85,.45);opacity:0;visibility:hidden}
.sub div{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Russo;font-size:76px;color:#fff}
#subB{opacity:0;visibility:hidden}
#hand{position:absolute;left:560px;top:820px;width:200px;height:250px;opacity:0;visibility:hidden;z-index:5}
#hand svg{width:100%;height:100%}
#next{top:1010px;opacity:0;visibility:hidden}
#caps{position:absolute;left:60px;right:60px;top:1250px;height:300px;z-index:30}
.cap{position:absolute;left:0;right:0;top:0;text-align:center;font-weight:900;font-size:78px;line-height:1.08;color:#fff;-webkit-text-stroke:16px #000;paint-order:stroke fill;opacity:0;visibility:hidden}
.cap b{color:var(--o);font-weight:900}
${GENRE_CSS}
${TOWN_CSS}
${KEEP_CSS}
${EXTRA_CSS}
`;

const page = `<!doctype html>
<html lang="ru" data-resolution="portrait">
<head><meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920"><title>Игру делают зрители — серия 6</title>
<script src="gsap.min.js"></script><style>${CSS}</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${END}" data-width="1080" data-height="1920">
  <div id="grid"></div><div id="glow"></div>
  <div id="stage">${html}</div>
  <div id="top"><div class="tag">ИГРУ ДЕЛАЮТ ЗРИТЕЛИ</div><div class="ep">СЕРИЯ 6</div></div>
  <div id="ptrack"><div id="pbar"></div></div>
  <div id="caps">${caps.map((c, k) => `<div class="cap" id="cap${k}">${c.html}</div>`).join('')}</div>
  <div class="gbars">${Array.from({ length: 6 }, (_, i) => `<i id="gb${i}"></i>`).join('')}</div>
  <div id="flash"></div><div id="gflash"></div><div id="crt"></div>
</div>
<script>
const tl = gsap.timeline({ paused: true });
${js.join('\n')}
tl.set({}, {}, ${END});
window.__timelines = window.__timelines || {};
window.__timelines['main'] = tl;
tl.seek(0);
</script>
</body></html>`;
writeFileSync(join(OUT, 'index.html'), page);
for (const f of ['gsap.min.js', 'crossroads.webp', 'icon-512.png']) copyFileSync(join(DIR, 'assets', f), join(OUT, f));
for (const f of ['proto4.mp4', 'pf0.png', 'pf1.png', 'pf2.png']) copyFileSync(join(DIR, 'assets', 'clips', f), join(OUT, f));

// ═══════════════ Звук ═══════════════
const au = makeAudio(END);
const [p1, p2, p3] = P.tms;
const win = (t, a, b) => t >= a && t < b;
const mus = music(au, END, {
  dropFrom: scene('s5').from,
  dropTo: scene('s5').to,
  gain: (t) => (win(t, ERASE.tm.sounds, scene('s3').to) ? 0 : win(t, scene('s3').from, ERASE.tm.sounds) ? 0.5 : win(t, p1.z, p1.e + 0.3) ? 0.45 : win(t, p2.z, p2.e + 0.3) ? 0.35 : win(t, p3.z, p3.e + 0.3) ? 0.3 : 1),
});
const fx = au.mk();
const kinds = effects(au, fx);
for (const [t, kind, arg] of sfxList) {
  if (!kinds[kind]) throw new Error(`нет звука ${kind}`);
  kinds[kind](t, arg);
}
au.wav(join(OUT, 'music.wav'), mus);
au.wav(join(OUT, 'sfx.wav'), fx);
const vin = LINES.flatMap((l) => ['-i', join(DIR, 'voice', `${l.id}.mp3`)]);
const delays = LINES.map((l, i) => `[${i}:a]aresample=44100,pan=stereo|c0=c0|c1=c0,adelay=${Math.round(T[l.id].start * 1000)}:all=1[v${i}]`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...vin, '-filter_complex',
  `${delays.join(';')};${LINES.map((_, i) => `[v${i}]`).join('')}amix=inputs=${LINES.length}:normalize=0,apad,atrim=0:${END}[a]`,
  '-map', '[a]', join(OUT, 'voice.wav')]);
writeFileSync(join(OUT, 'timeline.json'), JSON.stringify({ END, lines: Object.values(T).map(({ id, start, dur, segs }) => ({ id, start: +start.toFixed(3), dur: +dur.toFixed(3), segs })), scenes: SC, places: P.tms }, null, 1));
console.log(`out/index.html · ${END} с · ${caps.length} субтитров · ${sfxList.length} звуков`);
