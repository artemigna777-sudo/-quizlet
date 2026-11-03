/**
 * «Игру делают зрители», серия 1 — ролик-вступление для TikTok (1080×1920).
 *
 *   node build.mjs   → out/index.html (композиция HyperFrames), out/voice.wav, out/music.wav, out/sfx.wav
 *   sh render.sh     → mp4/ep01.mp4 (и mp4/ep01-bez-muzyki.mp4 — голос и звуки без музыки)
 *
 * Монтаж идёт по озвучке: паузы в каждой реплике находит ffmpeg, слова раскладываются по ним. Поменял
 * озвучку — пересобери, всё подстроится. Графика — моушн-дизайн кодом (HTML + SVG + GSAP), звук — синтез.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { effects, makeAudio, music } from './audio.mjs';
import { GENRE_CSS, THUMBS, TH, TILE, TW, horror, race, survival } from './genres.mjs';
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
const HOLD = { l8a: 0.4, l8b: 1.2, l8c: 0.45, l8d: 1.9 };
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
const SCENES = [['s1', ['l1']], ['s2', ['l2']], ['s3', ['l3']], ['s4', ['l4']], ['s5', ['l5']], ['s6', ['l6']], ['s7', ['l7']],
  ['s8', ['l8', 'l8a', 'l8b', 'l8c', 'l8d']], ['s9', ['l9']]];
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
const isAccent = (w) => ACCENT.some((a) => w.replace(/[.,!?:—…]/g, '') === a);
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
  warn: `<svg viewBox="0 0 120 110"><path d="M60 8 L114 102 L6 102 Z" fill="#ff3b3b" stroke="none"/><path d="M60 38 V70" stroke="#fff" stroke-width="12" stroke-linecap="round"/><circle cx="60" cy="86" r="7" fill="#fff"/></svg>`,
};

// ═══════════════ Сцены ═══════════════
const typed = (text, id) => [...text].map((ch, k) => `<span class="ch" id="${id}${k}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
const type = (id, text, t0, t1) => [...text].forEach((_, k) => A(`tl.set('#${id}${k}',{opacity:1},${f3(t0 + ((t1 - t0) * k) / text.length)});`));

// ── S1: «Привет!» → монитор: «сделай игру» → мелькают жанры → «С нуля» → нейросеть пускает импульсы в игру.
const S1 = (() => {
  const L = T.l1;
  const tS = at('l1', 'Сегодня', -0.05);
  const tD = at('l1', 'делать', -0.15);
  const tEnter = tD + 0.7;
  const tZ = at('l1', 'С нуля', -0.05);
  const tN = at('l1', 'с помощью', -0.05);
  const word = 'ПРИВЕТ!';
  const letters = [...word].map((ch, k) => `<span class="lt" id="lt${k}">${ch}</span>`).join('');
  [...word].forEach((_, k) => {
    const a = (k / word.length) * Math.PI * 2 + 0.6;
    A(`tl.fromTo('#lt${k}',{x:${Math.round(Math.cos(a) * 700)},y:${Math.round(Math.sin(a) * 600)},rotation:${k % 2 ? 160 : -160},scale:3,opacity:0},{x:0,y:0,rotation:${k % 2 ? 4 : -4},scale:1,opacity:1,duration:.38,ease:'back.out(1.6)'},${f3(0.02 + k * 0.035)});`);
  });
  A(`tl.to('.lt',{y:-26,duration:.12,yoyo:true,repeat:1,stagger:.04,ease:'power2.out'},0.5);`);
  A(`tl.fromTo('#crt',{scaleY:.004,opacity:1},{scaleY:1,opacity:0,duration:.22,ease:'power2.out'},0);`);
  sfx(0, 'zap');
  sfx(0.3, 'slam');
  A(`tl.fromTo('#wave',{scale:0,rotation:-30},{scale:1,rotation:0,duration:.3,ease:'back.out(2.5)'},0.3);`);
  A(`tl.to('#wave',{rotation:22,duration:.12,yoyo:true,repeat:5,ease:'sine.inOut',transformOrigin:'50% 90%'},0.55);`);
  A(`tl.fromTo('#burst',{scale:.2,opacity:.9},{scale:2.4,opacity:0,duration:.6,ease:'power2.out'},0.28);`);
  shake(0.32, 16);
  // Монитор.
  A(`tl.to('#hi,#wave',{scale:2.4,opacity:0,duration:.25,ease:'power2.in'},${f3(tS - 0.05)});`);
  A(`tl.fromTo('#mon',{scale:.3,rotation:-8,autoAlpha:0},{scale:1,rotation:0,autoAlpha:1,duration:.4,ease:'back.out(1.7)'},${f3(tS)});`);
  sfx(tS, 'whoosh');
  type('c1_', 'сделай игру', tD, tD + 0.6);
  sfx(tD, 'type', 8);
  A(`tl.fromTo('#cur1',{opacity:1},{opacity:0,duration:.2,repeat:9,yoyo:true,ease:'steps(1)'},${f3(tS)});`);
  A(`tl.fromTo('#enter',{scale:0,autoAlpha:0},{scale:1,autoAlpha:1,duration:.2,ease:'back.out(3)'},${f3(tEnter - 0.25)});`);
  A(`tl.to('#enter',{y:10,scale:.92,background:'#ff7a2e',color:'#111',duration:.06,yoyo:true,repeat:1},${f3(tEnter)});`);
  A(`tl.to('#enter',{autoAlpha:0,duration:.15},${f3(tEnter + 0.25)});`);
  sfx(tEnter, 'click');
  // Генерация: превью жанров мелькают с глитчем, полоса загрузки.
  A(`tl.to('#mline',{y:-20,opacity:.45,duration:.2},${f3(tEnter + 0.05)});`);
  A(`tl.fromTo('#gen',{autoAlpha:0},{autoAlpha:1,duration:.1},${f3(tEnter + 0.05)});`);
  A(`tl.fromTo('#gpb',{scaleX:0},{scaleX:1,duration:${f3(L.end - tEnter)},ease:'power1.inOut'},${f3(tEnter + 0.05)});`);
  const pct = counter('gpc', 100, tEnter + 0.05, L.end, 20, 'pct', '%');
  const flick = [];
  for (let t = tEnter + 0.08, k = 0; t < L.end + 0.1; t += k < 6 ? 0.14 : 0.22, k++) flick.push([t, k % 3]);
  flick.forEach(([t, k], i) => {
    A(`tl.set('.th',{opacity:0},${f3(t)});`);
    A(`tl.set('#th${k}',{opacity:1},${f3(t)});`);
    A(`tl.fromTo('#th${k}',{x:${i % 2 ? 24 : -24},scale:1.08,filter:'hue-rotate(90deg) contrast(1.6)'},{x:0,scale:1,filter:'hue-rotate(0deg) contrast(1)',duration:.1},${f3(t)});`);
    if (i % 2 === 0) sfx(t, 'tick');
  });
  // «С нуля».
  slam('#zero', tZ + 0.1, 2.6, 0.2);
  shake(tZ + 0.1, 18);
  sfx(tZ + 0.08, 'stamp');
  A(`tl.to('#zero',{scale:.6,autoAlpha:0,duration:.18},${f3(tN)});`);
  // Нейросеть: монитор уходит вниз, сверху сеть, импульсы летят в игру.
  A(`tl.to('#mon',{scale:.62,y:225,duration:.35,ease:'power3.inOut'},${f3(tN - 0.05)});`);
  A(`tl.fromTo('#nnet',{autoAlpha:0,scale:.85},{autoAlpha:1,scale:1,duration:.3,ease:'back.out(1.8)'},${f3(tN)});`);
  A(`tl.fromTo('.nnode',{attr:{r:12}},{attr:{r:20},duration:.18,yoyo:true,repeat:9,stagger:{each:.04,from:'random'}},${f3(tN + 0.1)});`);
  sfx(tN, 'zap');
  return { pct, tN };
})();

// Нейросеть (S1): узлы, связи, импульсы.
const NN = (() => {
  const layers = [[220, 380, 540, 700, 860].map((x) => [x, 410]), [160, 304, 448, 632, 776, 920].map((x) => [x, 540]), [220, 380, 540, 700, 860].map((x) => [x, 670])];
  const sink = [300, 420, 540, 660, 780].map((x) => [x, 880]);
  let edges = '';
  for (let l = 0; l < 2; l++) for (const a of layers[l]) for (const b of layers[l + 1]) edges += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
  layers[2].forEach((a, i) => { edges += `<line x1="${a[0]}" y1="${a[1]}" x2="${sink[i][0]}" y2="${sink[i][1]}" class="sk"/>`; });
  const nodes = layers.flat().map(([x, y]) => `<circle class="nnode" cx="${x}" cy="${y}" r="14"/>`).join('');
  let pulses = '';
  const t0 = S1.tN + 0.15;
  const t1 = SC[1].from;
  let ps = 3;
  const pr = () => (ps = (ps * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 16; i++) {
    const path = [layers[0][Math.floor(pr() * 5)], layers[1][Math.floor(pr() * 6)]];
    const k = Math.floor(pr() * 5);
    path.push(layers[2][k], sink[k]);
    pulses += `<i class="pulse" id="pl${i}" style="left:${path[0][0]}px;top:${path[0][1]}px"></i>`;
    const ts = t0 + (i % 8) * 0.07 + Math.floor(i / 8) * 0.45;
    if (ts > t1) continue;
    const kf = path.slice(1).map(([x, y]) => `{x:${x - path[0][0]},y:${y - path[0][1]},duration:.13,ease:'none'}`).join(',');
    A(`tl.set('#pl${i}',{x:0,y:0,opacity:1},${f3(ts)});`);
    A(`tl.to('#pl${i}',{keyframes:[${kf},{opacity:0,duration:.05}]},${f3(ts)});`);
  }
  return `<div id="nnet"><svg viewBox="0 0 1080 1920"><g class="edges">${edges}</g>${nodes}</svg>${pulses}</div>`;
})();

// ── S2: тревога «ПРАВИЛО №1» → барабан жанров → «ВЫ» и взрыв аватарок.
const REEL = ['ГОНКИ', 'ХОРРОР', 'ШУТЕР', 'RPG', 'ФЕРМА', 'КВЕСТ', 'ВЫЖИВАНИЕ', 'СТРАТЕГИЯ', 'ГОНКИ', 'ХОРРОР', 'ШУТЕР', 'RPG', 'ФЕРМА', 'КВЕСТ', 'ВЫЖИВАНИЕ', 'СТРАТЕГИЯ', '???'];
const S2 = (() => {
  const L = T.l2;
  const sc = scene('s2');
  A(`tl.fromTo('#tape0',{x:-1400},{x:0,duration:.3,ease:'power3.out'},${f3(sc.from + 0.05)});`);
  A(`tl.fromTo('#tape1',{x:1400},{x:0,duration:.3,ease:'power3.out'},${f3(sc.from + 0.1)});`);
  A(`tl.fromTo('.tape',{backgroundPosition:'0px 0px'},{backgroundPosition:'440px 0px',duration:${f3(sc.to - sc.from)},ease:'none'},${f3(sc.from)});`);
  slam('#alert', sc.from + 0.32, 2.2, 0.2);
  shake(sc.from + 0.32, 14);
  A(`tl.to('#alert',{borderColor:'#ffd23f',boxShadow:'0 0 80px rgba(255,59,59,.85)',duration:.14,yoyo:true,repeat:7},${f3(sc.from + 0.35)});`);
  A(`tl.to('#alert .ic',{rotation:12,duration:.07,yoyo:true,repeat:11},${f3(sc.from + 0.35)});`);
  A(`tl.fromTo('#redwash',{opacity:0},{opacity:.35,duration:.14,yoyo:true,repeat:5},${f3(sc.from + 0.3)});`);
  sfx(sc.from + 0.1, 'siren', 1.1);
  const tK = at('l2', 'какой', -0.1);
  const tY = at('l2', 'ВЫ', -0.05);
  A(`tl.to('#alert',{y:-205,scale:.6,duration:.3,ease:'power3.inOut'},${f3(tK)});`);
  A(`tl.to('#tape0',{x:1400,duration:.3,ease:'power3.in'},${f3(tK)});`);
  A(`tl.to('#tape1',{x:-1400,duration:.3,ease:'power3.in'},${f3(tK)});`);
  A(`tl.fromTo('#reel',{scale:.4,autoAlpha:0},{scale:1,autoAlpha:1,duration:.3,ease:'back.out(2)'},${f3(tK + 0.08)});`);
  const D = tY - 0.2 - (tK + 0.12);
  const n = REEL.length - 1;
  A(`tl.fromTo('#strip',{y:0,filter:'blur(6px)'},{y:${-n * 230},filter:'blur(0px)',duration:${f3(D)},ease:'power3.out'},${f3(tK + 0.12)});`);
  const ticks = [];
  for (let i = 1; i <= n; i++) ticks.push(tK + 0.12 + D * (1 - Math.cbrt(1 - i / n)));
  sfx(0, 'reel', ticks);
  // «ВЫ»: удар, аватарки разлетаются, конфетти.
  A(`tl.to('#reel,#alert',{scale:.5,autoAlpha:0,duration:.15},${f3(tY)});`);
  slam('#you', tY + 0.06, 5, 0.18);
  shake(tY + 0.06, 30);
  A(`tl.fromTo('#flash',{opacity:.6},{opacity:0,duration:.3,immediateRender:false},${f3(tY + 0.06)});`);
  sfx(tY + 0.04, 'slam');
  sfx(tY + 0.06, 'confetti');
  return { tY };
})();
const avatars = Array.from({ length: 12 }, (_, k) => {
  const a = (k / 12) * Math.PI * 2 - Math.PI / 2;
  const x = 540 + Math.cos(a) * 450 - 55;
  const y = 870 + Math.sin(a) * 280 - 55;
  if (Math.abs(Math.sin(a)) > 0.9) return '';
  A(`tl.fromTo('#av${k}',{x:${Math.round(485 - x)},y:${Math.round(815 - y)},scale:0,autoAlpha:0},{x:0,y:0,scale:1,autoAlpha:1,duration:.45,ease:'back.out(1.8)'},${f3(S2.tY + 0.08 + k * 0.015)});`);
  const hue = ['#ff7a2e', '#4fd1ff', '#3ecf6e', '#ffd23f', '#ff5c8a', '#a78bfa'][k % 6];
  return `<div class="av" id="av${k}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;border-color:${hue}"><div style="background:${hue}"></div><i style="background:${hue}"></i></div>`;
}).join('');
const conf2 = confetti('cfa', 540, 860, 36, S2.tY + 0.08);

// ── S3: карточки с «?» → прилетают комментарии.
const CARDS = [
  ['ЖАНР', 'гонки?!', 'Жанр', 90, 400, 430],
  ['ГЕРОЙ', 'кот-самурай', 'главный', 560, 400, 430],
  ['МИР', 'киберпанк', 'мир,', 90, 640, 430],
  ['МУЗЫКА', '8-бит', 'музыка', 560, 640, 430],
  ['КОНЦОВКА', 'чтоб я плакал', 'концовка', 90, 880, 900],
];
{
  CARDS.forEach(([, , word], k) => {
    const t = at('l3', word, -0.12);
    A(`tl.fromTo('#cd${k}',{scale:.3,rotation:${k % 2 ? 12 : -12},autoAlpha:0},{scale:1,rotation:0,autoAlpha:1,duration:.35,ease:'back.out(2.2)'},${f3(t)});`);
    sfx(t, 'pop');
    A(`tl.fromTo('#q${k}',{rotation:-20},{rotation:8,duration:.4,yoyo:true,repeat:7,ease:'sine.inOut'},${f3(t)});`);
  });
  const tZ = at('l3', 'всё', -0.05);
  CARDS.forEach((_, k) => {
    const t = tZ + k * 0.15;
    A(`tl.to('#q${k}',{autoAlpha:0,scale:.3,duration:.12},${f3(t)});`);
    A(`tl.fromTo('#an${k}',{scale:.2,y:200,autoAlpha:0,rotation:-6},{scale:1,y:0,autoAlpha:1,rotation:${k % 2 ? 3 : -3},duration:.35,ease:'back.out(2.2)'},${f3(t + 0.04)});`);
    A(`tl.to('#cd${k}',{borderColor:'#ff7a2e',duration:.1},${f3(t + 0.04)});`);
    sfx(t + 0.04, 'bubble');
  });
  pop('#votes', at('l3', 'прямо', -0.1), 0.6);
  // Поток комментариев снизу, как в эфире.
  const sc = scene('s3');
  for (let i = 0; i < 8; i++) {
    const t = sc.from + 0.3 + i * 0.45;
    A(`tl.set('#fc${i}',{y:0,opacity:0},${f3(t)});`);
    A(`tl.to('#fc${i}',{keyframes:[{y:-60,opacity:.8,duration:.3},{y:-420,opacity:0,duration:1.4,ease:'none'}]},${f3(t)});`);
  }
}
const FEED = ['давай хоррор', 'гонки!!!', 'ферма с котами', 'сделай шутер', 'ВЫЖИВАНИЕ', 'игру про ПДД 😅', 'RPG пж', 'хоррор в школе'];

// ── S4: Claude Code + дождь кода.
const TERM = [
  ['p', '&gt; делаем игру по решению зрителей'],
  ['o', '● Пишу game/index.html'],
  ['o', '● Пишу src/main.ts <em>+248</em>'],
  ['o', '● Пишу src/player.ts <em>+131</em>'],
  ['g', '✓ Игра собрана'],
];
const RAIN = (() => {
  const tok = ['const', 'let', 'if(', '=>', '{', '}', 'player', '.x', '+=', 'speed', 'draw()', 'enemy', 'score', '0x1F', 'jump', 'map[i]', 'return', 'new', 'Game', 'tick', 'fps', 'ai', '[]', '...'];
  let rs = 17;
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
  rise('#codeby', L.start + 0.05, -30);
  const tC = at('l4', 'Claude', -0.1);
  A(`tl.fromTo('#cc',{scale:.4,autoAlpha:0,letterSpacing:'40px'},{scale:1,autoAlpha:1,letterSpacing:'2px',duration:.45,ease:'expo.out'},${f3(tC)});`);
  sfx(tC, 'slam');
  shake(tC + 0.1, 10);
  const tO = at('l4', 'Opus', -0.15);
  pop('#opus', tO, 0.3);
  A(`tl.fromTo('#opus',{boxShadow:'0 0 0px #ff7a2e'},{boxShadow:'0 0 70px #ff7a2e',duration:.3,repeat:3,yoyo:true},${f3(tO + 0.3)});`);
  sfx(tO, 'ding');
  rise('#term2', at('l4', 'нейросеть', -0.2), 80);
  const t0 = at('l4', 'нейросеть');
  const t1 = L.end + 0.1;
  TERM.forEach((_, i) => {
    const t = t0 + ((t1 - t0) * i) / TERM.length;
    A(`tl.fromTo('#tl${i}',{x:-40,autoAlpha:0},{x:0,autoAlpha:1,duration:.2,ease:'power3.out'},${f3(t)});`);
    sfx(t, i === TERM.length - 1 ? 'ding' : 'type', 3);
  });
  A(`tl.fromTo('#pg',{scaleX:0},{scaleX:1,duration:${f3(t1 - t0)},ease:'power1.inOut'},${f3(t0)});`);
}

// ── S5: строки кода — у нейросети тысячи, у меня 0.
const S5 = (() => {
  const L = T.l5;
  rise('#mylines', L.start + 0.05, -30);
  A(`tl.fromTo('#duoA',{x:-500,autoAlpha:0},{x:0,autoAlpha:1,duration:.35,ease:'power3.out'},${f3(L.start + 0.1)});`);
  A(`tl.fromTo('#duoB',{x:500,autoAlpha:0},{x:0,autoAlpha:1,duration:.35,ease:'power3.out'},${f3(L.start + 0.18)});`);
  const t0 = at('l5', 'ни строчки', -0.2);
  const ai = counter('aiN', 12480, L.start + 0.2, t0 + 0.2, 22, 'ai');
  sfx(L.start + 0.2, 'type', 10);
  A(`tl.fromTo('#nol',{scale:3.5,autoAlpha:0,rotation:25},{scale:1,autoAlpha:1,rotation:0,duration:.25,ease:'power4.in'},${f3(t0)});`);
  shake(t0 + 0.25, 22);
  sfx(t0 + 0.23, 'slam');
  const tF = at('l5', 'Только', -0.15);
  for (let k = 0; k < 4; k++) {
    const t = tF + k * ((L.end - tF) / 4);
    pop(`#nd${k}`, t, 0.4);
    sfx(t, 'pop');
    if (k < 3) A(`tl.fromTo('#ar${k}',{scaleX:0},{scaleX:1,duration:.25,ease:'power2.out'},${f3(t + 0.15)});`);
  }
  return { ai };
})();

// ── S6: комментарии, лайки, победитель.
const COMMENTS = [
  ['@max_play', 'давай хоррор, будет жёстко', 2380, '#4fd1ff'],
  ['@lena.k', 'гонки на тракторах!!!', 3915, '#ff5c8a'],
  ['@dimon_08', 'выживание на острове', 1104, '#ffd23f'],
];
const s6t0 = at('l6', 'Побеждает');
const s6t1 = at('l6', 'лайков');
{
  const L = T.l6;
  A(`tl.fromTo('#rule1',{scale:.5,autoAlpha:0},{scale:1,autoAlpha:1,duration:.4,ease:'back.out(2)'},${f3(L.start + 0.05)});`);
  sfx(L.start + 0.05, 'slam');
  COMMENTS.forEach((_, k) => {
    const t = at('l6', 'один', -0.1) + k * 0.15;
    A(`tl.fromTo('#cm${k}',{x:${k % 2 ? 300 : -300},autoAlpha:0},{x:0,autoAlpha:1,duration:.35,ease:'power3.out'},${f3(t)});`);
    sfx(t, 'tick');
  });
  sfx(s6t0, 'likes');
  for (let i = 0; i < 14; i++) {
    const t = s6t0 + i * 0.09;
    A(`tl.fromTo('#ht${i}',{x:0,y:0,scale:.4,opacity:1},{x:${Math.round(Math.sin(i * 1.7) * 60)},y:-${260 + (i % 4) * 60},scale:1.2,opacity:0,duration:.9,ease:'power1.out'},${f3(t)});`);
  }
  A(`tl.to('#cm1',{y:-170,duration:.4,ease:'power3.inOut'},${f3(s6t1 - 0.25)});`);
  A(`tl.to('#cm0',{y:170,duration:.4,ease:'power3.inOut'},${f3(s6t1 - 0.25)});`);
  A(`tl.to('#cm1',{scale:1.06,borderColor:'#ff7a2e',boxShadow:'0 0 60px rgba(255,122,46,.6)',duration:.25},${f3(s6t1 + 0.1)});`);
  A(`tl.fromTo('#crown',{y:-80,autoAlpha:0,rotation:-30},{y:0,autoAlpha:1,rotation:-14,duration:.35,ease:'bounce.out'},${f3(s6t1 + 0.1)});`);
  A(`tl.fromTo('#win',{scale:2.4,autoAlpha:0},{scale:1,autoAlpha:1,duration:.22,ease:'power4.in'},${f3(s6t1 + 0.15)});`);
  sfx(s6t1 + 0.35, 'ding');
  shake(s6t1 + 0.37, 12);
}

// ── S7: игра по ПДД уже сделана.
{
  const L = T.l7;
  A(`tl.fromTo('#doubt',{scale:.6,autoAlpha:0},{scale:1,autoAlpha:1,duration:.35,ease:'back.out(2)'},${f3(L.start + 0.05)});`);
  A(`tl.to('#doubt',{rotation:-3,duration:.1,yoyo:true,repeat:5},${f3(L.start + 0.3)});`);
  const tP = at('l7', 'Так', -0.1);
  A(`tl.to('#doubt',{y:-30,scale:.8,rotation:0,duration:.35},${f3(tP)});`);
  A(`tl.fromTo('#phone',{y:900,rotation:12},{y:0,rotation:-4,duration:.55,ease:'back.out(1.3)'},${f3(tP)});`);
  sfx(tP, 'whoosh');
  A(`tl.fromTo('#phone .scr>img',{scale:1.3},{scale:1.05,duration:${f3(L.dur)},ease:'none'},${f3(tP)});`);
  for (let k = 0; k < 4; k++) {
    const t = at('l7', 'целую', -0.1) + k * 0.3;
    A(`tl.fromTo('#f${k}',{x:120,autoAlpha:0},{x:0,autoAlpha:1,duration:.3,ease:'back.out(1.8)'},${f3(t)});`);
    sfx(t, 'tick');
  }
  const tB = at('l7', 'Ссылка', -0.1);
  pop('#bio', tB, 0.5);
  A(`tl.to('#bio b',{x:12,y:-12,duration:.2,yoyo:true,repeat:5},${f3(tB + 0.3)});`);
  sfx(tB, 'ding');
}

// ── S8: выбор жанра; плитки 1–3 раскрываются на весь экран своей мини-сценой.
const G = (() => {
  const ctx = { A, sfx: (t, k, a) => sfx(t, k, a), stepper, shake };
  const nxt = (id) => T[id].start;
  const tm1 = { s: T.l8a.start - 0.1, z: at('l8a', 'гонки', 0.05), e: nxt('l8b') - 0.45, nitro: at('l8a', 'нитро', -0.05), drift: at('l8a', 'дрифт', -0.05), s300: at('l8a', '300', -0.05) };
  const tm2 = { s: T.l8b.start - 0.1, z: at('l8b', 'хоррор', 0.05), e: nxt('l8c') - 0.45, dark: at('l8b', 'темно'), quiet: at('l8b', 'тихо'), who: at('l8b', 'кто-то', -0.05), back: at('l8b', 'спиной', 0.15), jump: T.l8b.end + 0.3 };
  const tm3 = { s: T.l8c.start - 0.1, z: at('l8c', 'выживание', 0.2), e: nxt('l8d') - 0.4, island: at('l8c', 'остров'), fire: at('l8c', 'костёр', -0.05), night: at('l8c', 'ночь', -0.05), dawn: at('l8c', 'рассвета', -0.15) };
  const html = [race(ctx, tm1), horror(ctx, tm2), survival(ctx, tm3)];
  return { html, tms: [tm1, tm2, tm3] };
})();
const TILES = [['1', 'ГОНКИ', 'car', 'l8a'], ['2', 'ХОРРОР', 'ghost', 'l8b'], ['3', 'ВЫЖИВАНИЕ', 'fire', 'l8c'], ['4', 'СВОЁ', 'pencil', 'l8d']];
const tileOn = (k, t) => {
  A(`tl.to('#tile${k}',{scale:1.08,borderColor:'#ff7a2e',background:'rgba(255,122,46,.22)',duration:.15},${f3(t)});`);
  A(`tl.fromTo('#tile${k} .ic',{rotation:-12,y:0},{rotation:12,y:-10,duration:.12,yoyo:true,repeat:3},${f3(t)});`);
  sfx(t, 'pop');
};
const tileOff = (k, t) => A(`tl.to('#tile${k}',{scale:1,borderColor:'rgba(244,244,242,.25)',background:'rgba(255,255,255,.05)',duration:.2},${f3(t)});`);
{
  const L = T.l8;
  A(`tl.fromTo('#pollh',{scale:.5,autoAlpha:0},{scale:1,autoAlpha:1,duration:.4,ease:'back.out(2)'},${f3(L.start + 0.05)});`);
  sfx(L.start + 0.05, 'slam');
  TILES.forEach((_, k) => A(`tl.fromTo('#tile${k}',{scale:.3,rotation:${[-10, 10, 10, -10][k]},autoAlpha:0},{scale:1,rotation:0,autoAlpha:1,duration:.4,ease:'back.out(2)'},${f3(at('l8', 'жанр', -0.35) + k * 0.08)});`));
  TILES.forEach((_, k) => sfx(at('l8', 'жанр', -0.35) + k * 0.08, 'tick'));
  // Плитка 1–3: подсветка → зум на весь экран → обратно в плитку.
  G.tms.forEach((tm, k) => {
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
  // Плитка 4 «Своё» — без мини-сцены.
  tileOn(3, T.l8d.start - 0.1);
  A(`tl.to('#tile3 .ic',{rotation:-25,x:-20,duration:.15,yoyo:true,repeat:5},${f3(T.l8d.start + 0.2)});`);
  const tW = at('l8d', 'Пиши', -0.1);
  A(`tl.to('.tile',{scale:1.03,borderColor:'#ff7a2e',background:'rgba(255,122,46,.12)',duration:.25,stagger:.05},${f3(tW)});`);
  A(`tl.to('.tile',{scale:.97,duration:.3,yoyo:true,repeat:5,ease:'sine.inOut'},${f3(tW + 0.4)});`);
  const tC = T.l8d.end + 0.1;
  A(`tl.to('#caps',{autoAlpha:0,duration:.15},${f3(tC)});`);
  A(`tl.fromTo('#cta',{scale:.5,autoAlpha:0},{scale:1,autoAlpha:1,duration:.35,ease:'back.out(2)'},${f3(tC)});`);
  A(`tl.to('#cta span',{y:20,duration:.3,yoyo:true,repeat:5,ease:'sine.inOut'},${f3(tC + 0.3)});`);
  A(`tl.to('#caps',{autoAlpha:1,duration:.1},${f3(scene('s9').from)});`);
  sfx(tC, 'ding');
}

// ── S9: подписка.
const conf9 = (() => {
  const L = T.l9;
  A(`tl.fromTo('#title9',{scale:.6,autoAlpha:0},{scale:1,autoAlpha:1,duration:.4,ease:'back.out(2)'},${f3(L.start)});`);
  pop('#sub', L.start + 0.2, 0.5);
  A(`tl.to('#sub',{scale:1.05,duration:.25,yoyo:true,repeat:1,ease:'sine.inOut'},${f3(L.start + 0.5)});`);
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
const TRANS = { s2: 'glitch', s3: 'zoom', s4: 'slide', s5: 'glitch', s6: 'zoom', s7: 'slide', s8: 'glitch', s9: 'zoom' };
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
// Фон дышит в такт музыке.
for (let t = 0.0; t < END; t += 60 / 124) A(`tl.fromTo('#glow',{opacity:1},{opacity:.65,duration:.4,ease:'power2.out',immediateRender:false},${f3(t)});`);
// Субтитры.
caps.forEach((c, k) => {
  A(`tl.fromTo('#cap${k}',{autoAlpha:0,scale:.8,y:20},{autoAlpha:1,scale:1,y:0,duration:.12,ease:'back.out(2)'},${f3(c.from)});`);
  A(`tl.set('#cap${k}',{autoAlpha:0},${f3(c.to)});`);
});

// ═══════════════ HTML ═══════════════
const html = `
<div id="s1" class="scene">
  <div id="burst"></div>
  <div id="hi" class="mega">${(() => [...'ПРИВЕТ!'].map((ch, k) => `<span class="lt" id="lt${k}">${ch}</span>`).join(''))()}</div>
  <div id="wave">${ICON.wave}</div>
  ${NN}
  <div id="mon"><div class="scr">
    <div id="mline"><span class="pr">&gt;</span> ${typed('сделай игру', 'c1_')}<span class="cur" id="cur1"></span></div>
    <div id="thumbs">${THUMBS.map((t, k) => `<div class="th" id="th${k}">${t}</div>`).join('')}</div>
    <div id="gen"><b>ГЕНЕРАЦИЯ ИГРЫ</b>${S1.pct}<div class="gp"><div id="gpb"></div></div></div>
  </div></div>
  <div id="enter">ENTER ↵</div>
  <div id="zero" class="stamp">С НУЛЯ</div>
</div>

<div id="s2" class="scene">
  <div id="redwash"></div>
  <div class="tape" id="tape0"></div><div class="tape" id="tape1"></div>
  <div id="alert"><span class="ic">${ICON.warn}</span><div><small>ВНИМАНИЕ</small><b>ПРАВИЛО №1</b></div></div>
  <div id="reel"><div class="rl">ЖАНР</div><div class="rwin"><div id="strip">${REEL.map((g) => `<div>${g}</div>`).join('')}</div></div></div>
  ${avatars}
  <div id="you" class="you">ВЫ</div>
  ${conf2}
</div>

<div id="s3" class="scene">
  ${FEED.map((t, i) => `<div class="feed" id="fc${i}" style="left:${i % 2 ? 560 : 90}px;top:${1180 + (i % 3) * 20}px">${esc(t)}</div>`).join('')}
  ${CARDS.map(([lab, ans], k) => `<div class="card" id="cd${k}" style="left:${CARDS[k][3]}px;top:${CARDS[k][4]}px;width:${CARDS[k][5]}px">
    <div class="cl">${lab}</div><div class="q" id="q${k}">?</div><div class="ans" id="an${k}"><span class="ic">${ICON.chat}</span>${ans}</div></div>`).join('')}
  <div id="votes" class="label wide">РЕШАЮТ КОММЕНТАРИИ</div>
</div>

<div id="s4" class="scene">
  ${RAIN}
  <div id="codeby" class="label">КОД ПИШЕТ</div>
  <div id="cc" class="mega small">CLAUDE CODE</div>
  <div id="opus" class="pill">МОДЕЛЬ <b>OPUS 5.5</b></div>
  <div id="term2" class="term tall"><div class="bar"><i></i><i></i><i></i><span>claude</span></div>
    <div class="body">${TERM.map(([k, t], i) => `<div class="tl ${k}" id="tl${i}">${t}</div>`).join('')}<div class="prog"><div id="pg"></div></div></div></div>
</div>

<div id="s5" class="scene">
  <div id="mylines" class="label">СТРОК КОДА</div>
  <div class="duo" id="duoA"><b class="cy">НЕЙРОСЕТЬ</b>${S5.ai}</div>
  <div class="duo" id="duoB"><b>Я</b><div id="nol" class="zero">0</div></div>
  <div id="flow">
    ${[['chat', 'ВЫ'], ['me', 'Я'], ['ai', 'НЕЙРОСЕТЬ'], ['pad', 'ИГРА']].map(([ic, t], k) => `<div class="node" id="nd${k}"><span class="ic">${ICON[ic]}</span><b>${t}</b></div>${k < 3 ? `<div class="arr" id="ar${k}"></div>` : ''}`).join('')}
  </div>
</div>

<div id="s6" class="scene">
  <div id="rule1" class="big">1 СЕРИЯ = <span>1 ВЫБОР</span></div>
  ${COMMENTS.map(([n, t, c, hue], k) => `<div class="cm" id="cm${k}" style="top:${560 + k * 170}px">
    <div class="ava" style="background:${hue}"></div><div class="ctext"><b>${n}</b><span>${t}</span></div>
    <div class="likes"><span class="hrt">${ICON.heart}</span>${counter(`ct${k}`, c, s6t0, s6t1, 16, 'lk')}</div>
    ${k === 1 ? `<div class="crown" id="crown">${ICON.crown}</div><div class="win" id="win">ПОБЕДИТЕЛЬ</div>` : ''}</div>`).join('')}
  ${Array.from({ length: 14 }, (_, i) => `<span class="fh" id="ht${i}" style="top:${600 + (i % 3) * 170}px">${ICON.heart}</span>`).join('')}
</div>

<div id="s7" class="scene">
  <div id="doubt" class="big">ДУМАЕТЕ,<br>НЕ ВЫЙДЕТ?</div>
  <div id="phone"><div class="scr"><img src="crossroads.webp"><div class="app"><img src="icon-512.png"><b>Курьер ПДД</b></div></div></div>
  <div id="facts">
    <div class="fact" id="f0">уже сделано <b>нейросетью</b></div>
    <div class="fact" id="f1"><b>800</b> вопросов ПДД</div>
    <div class="fact" id="f2"><b>10</b> глав сюжета</div>
    <div class="fact" id="f3">экзамен <b>как в ГИБДД</b></div>
  </div>
  <div id="bio" class="pill">ССЫЛКА В ПРОФИЛЕ <b>↗</b></div>
</div>

<div id="s8" class="scene">
  <div id="pollh" class="big">ВЫБОР №1: <span>ЖАНР</span></div>
  ${TILES.map(([n, t, ic], k) => `<div class="tile" id="tile${k}" style="left:${TILE[k][0]}px;top:${TILE[k][1]}px">
    <div class="num">${n}</div><span class="ic">${ICON[ic]}</span><b>${t}</b></div>`).join('')}
  ${G.html.map((h, k) => `<div class="genre" id="g${k}"><div class="gin" id="g${k}in">${h}</div></div>`).join('')}
  <div id="cta" class="cta">ПИШИ ЦИФРУ<br>В КОММЕНТЫ <span>↓</span></div>
</div>

<div id="s9" class="scene">
  <div id="title9" class="big">ИГРУ ДЕЛАЮТ<br><span>ЗРИТЕЛИ</span></div>
  <div id="sub" class="sub"><div id="subA">+ ПОДПИСАТЬСЯ</div><div id="subB">✓ ТЫ В ДЕЛЕ</div></div>
  <div id="hand">${ICON.hand}</div>
  <div id="next" class="label wide">СЕРИЯ 2: ИГРА ПО ВАШЕМУ ВЫБОРУ</div>
  ${conf9}
</div>`;

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
#pollh{top:380px;font-size:96px;opacity:0;visibility:hidden}
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
`;

const page = `<!doctype html>
<html lang="ru" data-resolution="portrait">
<head><meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920"><title>Игру делают зрители — серия 1</title>
<script src="gsap.min.js"></script><style>${CSS}</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${END}" data-width="1080" data-height="1920">
  <div id="grid"></div><div id="glow"></div>
  <div id="stage">${html}</div>
  <div id="top"><div class="tag">ИГРУ ДЕЛАЮТ ЗРИТЕЛИ</div><div class="ep">СЕРИЯ 1</div></div>
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

// ═══════════════ Звук ═══════════════
const au = makeAudio(END);
const [z1, z2, z3] = G.tms;
const win = (t, a, b) => t >= a && t < b;
const mus = music(au, END, {
  dropFrom: scene('s8').from,
  dropTo: scene('s8').to,
  gain: (t) => (win(t, z2.z - 0.1, z2.e + 0.3) ? 0 : win(t, z3.z, z3.e + 0.3) ? 0.5 : win(t, z1.z, z1.e) ? 1.1 : 1),
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

writeFileSync(join(OUT, 'timeline.json'), JSON.stringify({
  END,
  lines: Object.values(T).map(({ id, start, dur, segs }) => ({ id, start: +start.toFixed(3), dur: +dur.toFixed(3), segs })),
  scenes: SC,
  genres: G.tms,
}, null, 1));
console.log(`out/index.html · ${END} с · ${caps.length} субтитров · ${sfxList.length} звуков`);
