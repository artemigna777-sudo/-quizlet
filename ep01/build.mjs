/**
 * «Игру делают зрители», серия 1 — ролик-вступление для TikTok (1080×1920).
 *
 *   node build.mjs        → out/index.html (композиция HyperFrames), out/voice.wav, out/music.wav, out/sfx.wav
 *   sh render.sh          → mp4/ep01.mp4 (и mp4/ep01-bez-muzyki.mp4 — только голос и звуки)
 *
 * Монтаж идёт по озвучке: время каждой сцены = длина её реплики (voice/<id>.mp3). Поменял озвучку —
 * пересобери, всё подстроится. Графика — моушн-дизайн кодом (HTML + SVG + GSAP), музыка и звуки синтезированы.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCENT, LINES } from './lines.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, 'out');
mkdirSync(OUT, { recursive: true });

// ───────────── Тайминг по озвучке ─────────────
const probe = (f) =>
  parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const GAP = 0.2;
const HOLD = { l8: 1.9 }; // пауза после реплики: зритель успевает выбрать цифру
let cursor = 0.3;
const T = {};
for (const line of LINES) {
  const d = probe(join(DIR, 'voice', `${line.id}.mp3`));
  T[line.id] = { ...line, start: cursor, dur: d };
  cursor += d + GAP + (HOLD[line.id] || 0);
}
const last = T[LINES.at(-1).id];
const END = +(last.start + last.dur + 1.7).toFixed(2);
/** Момент, когда диктор произносит `word` в реплике `id` (оценка по доле символов). */
const at = (id, word, shift = 0) => {
  const L = T[id];
  const i = L.show.indexOf(word);
  if (i < 0) throw new Error(`нет «${word}» в ${id}`);
  return +(L.start + L.dur * 0.03 + L.dur * 0.93 * (i / L.show.length) + shift).toFixed(3);
};
/** Сцена i идёт от начала своей реплики (чуть раньше) до начала следующей. */
const SC = LINES.map((l, i) => {
  const from = i === 0 ? 0 : T[l.id].start - 0.15;
  const to = i === LINES.length - 1 ? END : T[LINES[i + 1].id].start - 0.15;
  return { id: `s${i + 1}`, from: +from.toFixed(3), to: +to.toFixed(3) };
});

// ───────────── Субтитры ─────────────
function chunks(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];
  let cur = [];
  for (const w of words) {
    if (w === '—') { cur.push(w); continue; }
    const len = cur.join(' ').length + w.length;
    if (cur.length && (cur.filter((x) => x !== '—').length >= 3 || len > 17)) { out.push(cur); cur = []; }
    cur.push(w);
    if (/[.!?:]$/.test(w)) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const isAccent = (w) => ACCENT.some((a) => w.replace(/[.,!?:—]/g, '') === a);
const caps = [];
for (const line of LINES) {
  const L = T[line.id];
  const parts = chunks(line.show);
  const total = parts.reduce((s, p) => s + p.join(' ').length + 1, 0);
  let acc = 0;
  parts.forEach((p, k) => {
    const len = p.join(' ').length + 1;
    const from = L.start + L.dur * 0.02 + (L.dur * 0.95 * acc) / total;
    acc += len;
    const to = k === parts.length - 1 ? L.start + L.dur + 0.12 : L.start + L.dur * 0.02 + (L.dur * 0.95 * acc) / total;
    caps.push({ html: p.map((w) => (isAccent(w) ? `<b>${esc(w)}</b>` : esc(w))).join(' '), from, to });
  });
}

// ───────────── Значки (SVG, линии как в прошлых роликах) ─────────────
const ICON = {
  car: `<svg viewBox="0 0 200 120"><path d="M20 82 L28 52 Q34 40 48 40 L120 40 Q132 40 142 50 L162 64 Q182 68 184 82 L184 92 L20 92 Z" fill="none"/><path d="M58 44 L58 64 L136 64 L118 46"/><circle cx="56" cy="94" r="16" fill="#0e0f13"/><circle cx="148" cy="94" r="16" fill="#0e0f13"/><path d="M0 70 h-0" /></svg>`,
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
};

// ───────────── Счётчики без колбэков: значения заранее, кадр показывает нужное ─────────────
const js = [];
function counter(id, to, t0, t1, steps = 16) {
  const vals = Array.from({ length: steps + 1 }, (_, k) => Math.round(to * Math.pow(k / steps, 0.7)));
  const fmt = (v) => v.toLocaleString('ru-RU').replace(/ /g, ' ');
  const html = vals.map((v, k) => `<span class="cv" id="${id}_${k}">${fmt(v)}</span>`).join('');
  vals.forEach((_, k) => {
    const t = t0 + ((t1 - t0) * k) / steps;
    js.push(`tl.set('#${id}_${k}',{opacity:1},${t.toFixed(3)});`);
    if (k > 0) js.push(`tl.set('#${id}_${k - 1}',{opacity:0},${t.toFixed(3)});`);
  });
  return `<span class="cnt">${html}</span>`;
}

// ───────────── Сцены ─────────────
const typed = (text, id) =>
  [...text].map((ch, k) => `<span class="ch" id="${id}${k}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
const type = (id, text, t0, t1) =>
  [...text].forEach((_, k) => js.push(`tl.set('#${id}${k}',{opacity:1},${(t0 + ((t1 - t0) * k) / text.length).toFixed(3)});`));

const avatars = Array.from({ length: 12 }, (_, k) => {
  const a = (k / 12) * Math.PI * 2 - Math.PI / 2;
  const x = 540 + Math.cos(a) * 450 - 55;
  const y = 890 + Math.sin(a) * 250 - 55;
  if (Math.abs(Math.sin(a)) > 0.9) return '';
  const hue = ['#ff7a2e', '#4fd1ff', '#3ecf6e', '#ffd23f', '#ff5c8a', '#a78bfa'][k % 6];
  return `<div class="av" id="av${k}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;border-color:${hue}"><div style="background:${hue}"></div><i style="background:${hue}"></i></div>`;
}).join('');

const CARDS = [
  ['ЖАНР', 'гонки?!', 'Жанр', 90, 400, 430],
  ['ГЕРОЙ', 'кот-самурай', 'главный', 560, 400, 430],
  ['МИР', 'киберпанк', 'мир,', 90, 640, 430],
  ['МУЗЫКА', '8-бит', 'музыка', 560, 640, 430],
  ['КОНЦОВКА', 'чтоб я плакал', 'концовка', 90, 880, 900],
];
const TILES = [
  ['1', 'ГОНКИ', 'car', '1 —'],
  ['2', 'ХОРРОР', 'ghost', '2 —'],
  ['3', 'ВЫЖИВАНИЕ', 'fire', '3 —'],
  ['4', 'СВОЁ', 'pencil', '4 —'],
];
const COMMENTS = [
  ['@max_play', 'давай хоррор, будет жёстко', 2380, '#4fd1ff'],
  ['@lena.k', 'гонки на тракторах!!!', 3915, '#ff5c8a'],
  ['@dimon_08', 'выживание на острове', 1104, '#ffd23f'],
];
const TERM = [
  ['p', '&gt; делаем игру по решению зрителей'],
  ['o', '● Пишу game/index.html'],
  ['o', '● Пишу src/main.ts <em>+248</em>'],
  ['o', '● Пишу src/player.ts <em>+131</em>'],
  ['g', '✓ Игра собрана'],
];

const s6t0 = at('l6', 'Побеждает');
const s6t1 = at('l6', 'лайков');
const html = `
<div id="s1" class="scene">
  <div id="hi" class="mega">ПРИВЕТ!</div>
  <div id="term1" class="term"><div class="bar"><i></i><i></i><i></i><span>новый проект</span></div>
    <div class="body"><span class="pr">&gt;</span> ${typed('сделай игру', 'c1_')}<span class="cur" id="cur1"></span></div></div>
  <div id="zero" class="stamp">С НУЛЯ</div>
  <div id="nn" class="chip cyan"><span class="ic">${ICON.ai}</span>НЕЙРОСЕТЬ</div>
</div>

<div id="s2" class="scene">
  <div id="rule" class="label">ОДНО ПРАВИЛО</div>
  <div id="decide" class="big">КАКОЙ БУДЕТ ИГРА —<br>РЕШАЕТЕ</div>
  ${avatars}
  <div id="you" class="you">ВЫ</div>
</div>

<div id="s3" class="scene">
  ${CARDS.map(([lab, ans], k) => `<div class="card" id="cd${k}" style="left:${CARDS[k][3]}px;top:${CARDS[k][4]}px;width:${CARDS[k][5]}px">
    <div class="cl">${lab}</div><div class="q" id="q${k}">?</div><div class="ans" id="an${k}"><span class="ic">${ICON.chat}</span>${ans}</div></div>`).join('')}
  <div id="votes" class="label wide">РЕШАЮТ КОММЕНТАРИИ</div>
</div>

<div id="s4" class="scene">
  <div id="codeby" class="label">КОД ПИШЕТ</div>
  <div id="cc" class="mega small">CLAUDE CODE</div>
  <div id="opus" class="pill">МОДЕЛЬ <b>OPUS 5.5</b></div>
  <div id="term2" class="term tall"><div class="bar"><i></i><i></i><i></i><span>claude</span></div>
    <div class="body">${TERM.map(([k, t], i) => `<div class="tl ${k}" id="tl${i}">${t}</div>`).join('')}<div class="prog"><div id="pg"></div></div></div></div>
</div>

<div id="s5" class="scene">
  <div id="mylines" class="label">МОИХ СТРОК КОДА</div>
  <div id="nol" class="zero">0</div>
  <div id="flow">
    ${[['chat', 'ВЫ'], ['me', 'Я'], ['ai', 'НЕЙРОСЕТЬ'], ['pad', 'ИГРА']].map(([ic, t], k) => `<div class="node" id="nd${k}"><span class="ic">${ICON[ic]}</span><b>${t}</b></div>${k < 3 ? `<div class="arr" id="ar${k}"></div>` : ''}`).join('')}
  </div>
</div>

<div id="s6" class="scene">
  <div id="rule1" class="big">1 СЕРИЯ = <span>1 ВЫБОР</span></div>
  ${COMMENTS.map(([n, t, c, hue], k) => `<div class="cm" id="cm${k}" style="top:${560 + k * 170}px">
    <div class="ava" style="background:${hue}"></div><div class="ctext"><b>${n}</b><span>${t}</span></div>
    <div class="likes"><span class="hrt">${ICON.heart}</span>${counter(`ct${k}`, c, s6t0, s6t1)}</div>
    ${k === 1 ? `<div class="crown" id="crown">${ICON.crown}</div><div class="win" id="win">ПОБЕДИТЕЛЬ</div>` : ''}</div>`).join('')}
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
  ${TILES.map(([n, t, ic], k) => `<div class="tile" id="tile${k}" style="left:${k % 2 ? 560 : 90}px;top:${k < 2 ? 520 : 870}px">
    <div class="num">${n}</div><span class="ic">${ICON[ic]}</span><b>${t}</b></div>`).join('')}
  <div id="cta" class="cta">ПИШИ ЦИФРУ<br>В КОММЕНТЫ <span>↓</span></div>
</div>

<div id="s9" class="scene">
  <div id="title9" class="big">ИГРУ ДЕЛАЮТ<br><span>ЗРИТЕЛИ</span></div>
  <div id="sub" class="sub"><div id="subA">+ ПОДПИСАТЬСЯ</div><div id="subB">✓ ТЫ В ДЕЛЕ</div></div>
  <div id="hand">${ICON.hand}</div>
  <div id="next" class="label wide">СЕРИЯ 2: ИГРА ПО ВАШЕМУ ВЫБОРУ</div>
</div>`;

// ───────────── Анимация ─────────────
const sfx = []; // [время, звук]
const A = (s) => js.push(s);
// Сцены: появление снизу, уход вверх; свист на склейке.
SC.forEach(({ id, from, to }, i) => {
  A(`tl.set('#${id}',{autoAlpha:1},${from});`);
  if (i > 0) {
    A(`tl.fromTo('#${id}',{y:90,scale:.96},{y:0,scale:1,duration:.32,ease:'power3.out'},${from});`);
    A(`tl.fromTo('#flash',{opacity:.35},{opacity:0,duration:.25,immediateRender:false},${from});`);
    sfx.push([from - 0.08, 'whoosh']);
  }
  A(`tl.to('#${id}',{autoAlpha:0,y:-60,duration:.15,ease:'power1.in'},${(to - 0.15).toFixed(3)});`);
});
const shake = (t, p = 18) =>
  A(`tl.to('#stage',{keyframes:[{x:-${p},y:${p / 2},duration:.04},{x:${p},y:-${p / 2},duration:.04},{x:-${p / 2},y:0,duration:.04},{x:0,y:0,duration:.05}]},${t});`);
const pop = (sel, t, from = 0.3, ease = 'back.out(2)') =>
  A(`tl.fromTo('${sel}',{scale:${from},autoAlpha:0},{scale:1,autoAlpha:1,duration:.35,ease:'${ease}'},${t});`);
const rise = (sel, t, y = 50) =>
  A(`tl.fromTo('${sel}',{y:${y},autoAlpha:0},{y:0,autoAlpha:1,duration:.3,ease:'power3.out'},${t});`);

// Общий фон, шапка, прогресс.
A(`tl.fromTo('#grid',{backgroundPosition:'0px 0px'},{backgroundPosition:'0px 900px',duration:${END},ease:'none'},0);`);
A(`tl.fromTo('#pbar',{scaleX:0},{scaleX:1,duration:${END},ease:'none'},0);`);
rise('#top', 0.1, -40);

// S1
{
  const t0 = 0.05;
  A(`tl.fromTo('#hi',{scale:.2,rotation:-12,autoAlpha:0},{scale:1,rotation:-4,autoAlpha:1,duration:.45,ease:'back.out(2.5)'},${t0});`);
  sfx.push([t0, 'slam']);
  const tS = at('l1', 'Сегодня');
  A(`tl.to('#hi',{y:-170,scale:.62,rotation:0,duration:.4,ease:'power3.inOut'},${tS});`);
  rise('#term1', tS + 0.1, 80);
  const tD = at('l1', 'делать', -0.1);
  type('c1_', 'сделай игру', tD, tD + 0.75);
  sfx.push([tD, 'type']);
  A(`tl.fromTo('#cur1',{opacity:1},{opacity:0,duration:.25,repeat:30,yoyo:true,ease:'steps(1)'},${tS});`);
  const tZ = at('l1', 'С нуля');
  A(`tl.fromTo('#zero',{scale:2.6,autoAlpha:0,rotation:-20},{scale:1,autoAlpha:1,rotation:-9,duration:.28,ease:'power4.in'},${tZ - 0.12});`);
  shake(tZ + 0.16, 14);
  sfx.push([tZ + 0.14, 'stamp']);
  const tN = at('l1', 'нейросети', -0.1);
  pop('#nn', tN);
  A(`tl.fromTo('#nn',{boxShadow:'0 0 0px #4fd1ff'},{boxShadow:'0 0 60px #4fd1ff',duration:.4,repeat:3,yoyo:true},${tN + 0.3});`);
  sfx.push([tN, 'pop']);
}
// S2
{
  const L = T.l2;
  rise('#rule', L.start + 0.05, -40);
  sfx.push([L.start + 0.05, 'pop']);
  rise('#decide', at('l2', 'какой', -0.1));
  for (const k of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]) {
    const t = at('l2', 'какой') + k * 0.1;
    pop(`#av${k}`, t, 0);
    if (k % 3 === 0) sfx.push([t, 'tick']);
  }
  const tY = at('l2', 'ВЫ', -0.18);
  A(`tl.fromTo('#you',{scale:4,autoAlpha:0},{scale:1,autoAlpha:1,duration:.22,ease:'power4.in'},${tY});`);
  shake(tY + 0.22, 26);
  sfx.push([tY + 0.2, 'slam']);
  A(`tl.to('.av',{scale:1.15,duration:.12,yoyo:true,repeat:1},${tY + 0.22});`);
}
// S3
{
  CARDS.forEach(([, , word], k) => {
    const t = at('l3', word, -0.12);
    pop(`#cd${k}`, t, 0.4);
    sfx.push([t, 'pop']);
    A(`tl.fromTo('#q${k}',{rotation:-20},{rotation:8,duration:.5,yoyo:true,repeat:5,ease:'sine.inOut'},${t});`);
  });
  const tZ = at('l3', 'всё', -0.05);
  CARDS.forEach((_, k) => {
    const t = tZ + k * 0.17;
    A(`tl.to('#q${k}',{autoAlpha:0,scale:.3,duration:.15},${t});`);
    A(`tl.fromTo('#an${k}',{scale:.2,autoAlpha:0,rotation:-6},{scale:1,autoAlpha:1,rotation:${k % 2 ? 3 : -3},duration:.35,ease:'back.out(2.4)'},${t + 0.05});`);
    sfx.push([t + 0.05, 'bubble']);
  });
  pop('#votes', at('l3', 'прямо', -0.1), 0.6);
}
// S4
{
  const L = T.l4;
  rise('#codeby', L.start + 0.05, -30);
  const tC = at('l4', 'Claude', -0.1);
  A(`tl.fromTo('#cc',{scale:.4,autoAlpha:0,letterSpacing:'40px'},{scale:1,autoAlpha:1,letterSpacing:'2px',duration:.45,ease:'expo.out'},${tC});`);
  sfx.push([tC, 'slam']);
  const tO = at('l4', 'Opus', -0.15);
  pop('#opus', tO, 0.3);
  A(`tl.fromTo('#opus',{boxShadow:'0 0 0px #ff7a2e'},{boxShadow:'0 0 70px #ff7a2e',duration:.35,repeat:3,yoyo:true},${tO + 0.3});`);
  sfx.push([tO, 'ding']);
  rise('#term2', at('l4', 'нейросеть', -0.2), 80);
  const t0 = at('l4', 'нейросеть');
  const t1 = L.start + L.dur + 0.1;
  TERM.forEach((_, i) => {
    const t = t0 + ((t1 - t0) * i) / TERM.length;
    rise(`#tl${i}`, t, 16);
    sfx.push([t, i === TERM.length - 1 ? 'ding' : 'type']);
  });
  A(`tl.fromTo('#pg',{scaleX:0},{scaleX:1,duration:${(t1 - t0).toFixed(3)},ease:'power1.inOut'},${t0});`);
}
// S5
{
  const L = T.l5;
  rise('#mylines', L.start + 0.05, -30);
  const t0 = at('l5', 'ни строчки', -0.2);
  A(`tl.fromTo('#nol',{scale:3.5,autoAlpha:0,rotation:25},{scale:1,autoAlpha:1,rotation:0,duration:.25,ease:'power4.in'},${t0});`);
  shake(t0 + 0.25, 22);
  sfx.push([t0 + 0.23, 'slam']);
  const tF = at('l5', 'Только', -0.15);
  for (let k = 0; k < 4; k++) {
    const t = tF + k * ((L.start + L.dur - tF) / 4);
    pop(`#nd${k}`, t, 0.4);
    sfx.push([t, 'pop']);
    if (k < 3) A(`tl.fromTo('#ar${k}',{scaleX:0},{scaleX:1,duration:.25,ease:'power2.out'},${t + 0.15});`);
  }
}
// S6
{
  const L = T.l6;
  A(`tl.fromTo('#rule1',{scale:.5,autoAlpha:0},{scale:1,autoAlpha:1,duration:.4,ease:'back.out(2)'},${L.start + 0.05});`);
  sfx.push([L.start + 0.05, 'slam']);
  COMMENTS.forEach((_, k) => {
    const t = at('l6', 'один', -0.1) + k * 0.15;
    A(`tl.fromTo('#cm${k}',{x:${k % 2 ? 300 : -300},autoAlpha:0},{x:0,autoAlpha:1,duration:.35,ease:'power3.out'},${t});`);
    sfx.push([t, 'tick']);
  });
  sfx.push([s6t0, 'likes']);
  // Победитель поднимается наверх.
  A(`tl.to('#cm1',{y:-170,duration:.4,ease:'power3.inOut'},${s6t1 - 0.25});`);
  A(`tl.to('#cm0',{y:170,duration:.4,ease:'power3.inOut'},${s6t1 - 0.25});`);
  A(`tl.to('#cm1',{scale:1.06,borderColor:'#ff7a2e',boxShadow:'0 0 60px rgba(255,122,46,.6)',duration:.25},${s6t1 + 0.1});`);
  A(`tl.fromTo('#crown',{y:-80,autoAlpha:0,rotation:-30},{y:0,autoAlpha:1,rotation:-14,duration:.35,ease:'bounce.out'},${s6t1 + 0.1});`);
  A(`tl.fromTo('#win',{scale:2.4,autoAlpha:0},{scale:1,autoAlpha:1,duration:.22,ease:'power4.in'},${s6t1 + 0.15});`);
  sfx.push([s6t1 + 0.35, 'ding']);
  shake(s6t1 + 0.37, 12);
}
// S7
{
  const L = T.l7;
  A(`tl.fromTo('#doubt',{scale:.6,autoAlpha:0},{scale:1,autoAlpha:1,duration:.35,ease:'back.out(2)'},${L.start + 0.05});`);
  const tP = at('l7', 'Так', -0.1);
  A(`tl.to('#doubt',{y:-30,scale:.8,duration:.35},${tP});`);
  A(`tl.fromTo('#phone',{y:900,rotation:12},{y:0,rotation:-4,duration:.55,ease:'back.out(1.3)'},${tP});`);
  sfx.push([tP, 'whoosh']);
  A(`tl.fromTo('#phone img:first-child',{scale:1.25},{scale:1.05,duration:${L.dur},ease:'none'},${tP});`);
  for (let k = 0; k < 4; k++) {
    const t = at('l7', 'целую', -0.1) + k * 0.33;
    rise(`#f${k}`, t, 30);
    A(`tl.fromTo('#f${k}',{x:80},{x:0,duration:.3,ease:'power3.out'},${t});`);
    sfx.push([t, 'tick']);
  }
  const tB = at('l7', 'Ссылка', -0.1);
  pop('#bio', tB, 0.5);
  A(`tl.to('#bio b',{x:12,y:-12,duration:.25,yoyo:true,repeat:5},${tB + 0.3});`);
  sfx.push([tB, 'ding']);
}
// S8
{
  const L = T.l8;
  A(`tl.fromTo('#pollh',{scale:.5,autoAlpha:0},{scale:1,autoAlpha:1,duration:.4,ease:'back.out(2)'},${L.start + 0.05});`);
  sfx.push([L.start + 0.05, 'slam']);
  TILES.forEach((_, k) => pop(`#tile${k}`, at('l8', 'жанр', -0.25) + k * 0.08, 0.5));
  TILES.forEach(([, , , word], k) => {
    const t = at('l8', word, -0.12);
    A(`tl.to('#tile${k}',{scale:1.07,borderColor:'#ff7a2e',background:'rgba(255,122,46,.22)',duration:.15},${t});`);
    A(`tl.fromTo('#tile${k} .ic',{rotation:-12,y:0},{rotation:12,y:-10,duration:.16,yoyo:true,repeat:3},${t});`);
    sfx.push([t, 'pop']);
    if (k < 3) A(`tl.to('#tile${k}',{scale:1,borderColor:'rgba(244,244,242,.25)',background:'rgba(255,255,255,.05)',duration:.2},${at('l8', TILES[k + 1][3], -0.12)});`);
  });
  const tW = at('l8', 'Пиши', -0.1);
  A(`tl.to('.tile',{scale:1.03,borderColor:'#ff7a2e',background:'rgba(255,122,46,.12)',duration:.25,stagger:.05},${tW});`);
  A(`tl.to('.tile',{scale:.98,duration:.3,yoyo:true,repeat:5,ease:'sine.inOut'},${tW + 0.4});`);
  const tC = L.start + L.dur + 0.1;
  A(`tl.to('#caps',{autoAlpha:0,duration:.15},${tC});`);
  A(`tl.fromTo('#cta',{scale:.5,autoAlpha:0},{scale:1,autoAlpha:1,duration:.35,ease:'back.out(2)'},${tC});`);
  A(`tl.to('#cta span',{y:20,duration:.3,yoyo:true,repeat:5,ease:'sine.inOut'},${tC + 0.3});`);
  A(`tl.to('#caps',{autoAlpha:1,duration:.1},${SC[8].from});`);
  sfx.push([tC, 'ding']);
}
// S9
{
  const L = T.l9;
  A(`tl.fromTo('#title9',{scale:.6,autoAlpha:0},{scale:1,autoAlpha:1,duration:.4,ease:'back.out(2)'},${L.start});`);
  pop('#sub', L.start + 0.2, 0.5);
  const tT = L.start + Math.min(0.9, L.dur * 0.5);
  A(`tl.fromTo('#hand',{x:420,y:420,rotation:20,autoAlpha:0},{x:0,y:0,rotation:0,autoAlpha:1,duration:.45,ease:'power3.out'},${tT - 0.45});`);
  A(`tl.to('#hand',{scale:.85,duration:.08,yoyo:true,repeat:1},${tT});`);
  A(`tl.to('#sub',{scale:.92,duration:.08,yoyo:true,repeat:1},${tT});`);
  A(`tl.set('#subA',{autoAlpha:0},${tT + 0.08});`);
  A(`tl.set('#subB',{autoAlpha:1},${tT + 0.08});`);
  A(`tl.to('#sub',{background:'#3ecf6e',duration:.1},${tT + 0.08});`);
  A(`tl.to('#hand',{x:300,y:500,autoAlpha:0,duration:.5,ease:'power2.in'},${tT + 0.5});`);
  sfx.push([tT + 0.05, 'click'], [tT + 0.12, 'ding']);
  rise('#next', tT + 0.4, 30);
  A(`tl.to('#root',{opacity:0,duration:.4},${END - 0.4});`);
}
// Субтитры.
caps.forEach((c, k) => {
  A(`tl.fromTo('#cap${k}',{autoAlpha:0,scale:.8,y:20},{autoAlpha:1,scale:1,y:0,duration:.12,ease:'back.out(2)'},${c.from.toFixed(3)});`);
  A(`tl.set('#cap${k}',{autoAlpha:0},${c.to.toFixed(3)});`);
});

// ───────────── Страница ─────────────
const font = (name, file, w = '400') => {
  const b64 = readFileSync(join(DIR, 'assets', 'fonts', file)).toString('base64');
  return `@font-face{font-family:'${name}';font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
};
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
#glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 38%,rgba(255,122,46,.20),transparent 55%),radial-gradient(circle at 80% 90%,rgba(79,209,255,.10),transparent 50%)}
#flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:50}
#stage{position:absolute;inset:0}
.scene{position:absolute;inset:0;visibility:hidden;opacity:0}
#top{position:absolute;top:220px;left:80px;right:80px;display:flex;justify-content:space-between;align-items:center;z-index:20}
#top .tag{font-weight:900;font-size:34px;letter-spacing:2px;padding:14px 26px;border:3px solid var(--o);border-radius:999px;color:var(--o);background:rgba(14,15,19,.8)}
#top .ep{font-family:Russo;font-size:38px;padding:12px 26px;background:var(--o);color:#111;border-radius:16px}
#ptrack{position:absolute;top:322px;left:80px;right:80px;height:8px;background:rgba(255,255,255,.1);border-radius:8px;z-index:20}
#pbar{height:100%;background:var(--o);border-radius:8px;transform-origin:0 50%}
.ic svg{width:100%;height:100%;stroke:currentColor;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;fill:none;overflow:visible}
.mega{position:absolute;left:0;right:0;text-align:center;font-family:Russo;font-size:210px;top:440px;color:var(--fg);text-shadow:0 12px 0 var(--o)}
.mega.small{font-size:132px;top:470px;text-shadow:0 8px 0 var(--o)}
.big{position:absolute;left:60px;right:60px;text-align:center;font-family:Russo;font-size:92px;line-height:1.05;top:400px}
.big span{color:var(--o)}
.label{position:absolute;left:50%;transform:translateX(-50%);top:400px;font-weight:900;font-size:44px;letter-spacing:6px;padding:14px 34px;border-radius:999px;background:rgba(255,255,255,.08);border:3px solid rgba(255,255,255,.2);white-space:nowrap}
.label.wide{top:1120px;font-size:38px;letter-spacing:3px;color:var(--o);border-color:var(--o)}
.term{position:absolute;left:90px;width:900px;top:690px;background:#16181e;border:3px solid #2b2e37;border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.term .bar{height:64px;background:#1f222a;display:flex;align-items:center;gap:14px;padding:0 26px}
.term .bar i{width:20px;height:20px;border-radius:50%;background:#ff5f57}.term .bar i:nth-child(2){background:#febc2e}.term .bar i:nth-child(3){background:#28c840}
.term .bar span{margin-left:20px;font-family:Mono;color:var(--dim);font-size:30px}
.term .body{padding:36px 40px;font-family:Mono;font-size:62px;color:var(--fg)}
.term .pr{color:var(--o)}
.ch{opacity:0}
.cur{display:inline-block;width:32px;height:62px;background:var(--o);vertical-align:-8px;margin-left:6px}
.stamp{position:absolute;top:925px;left:0;right:0;margin:auto;width:520px;text-align:center;font-family:Russo;font-size:110px;color:var(--o);border:12px solid var(--o);border-radius:24px;padding:6px 0;opacity:0}
.chip{position:absolute;top:880px;left:50%;margin-left:-250px;width:500px;display:flex;align-items:center;justify-content:center;gap:18px;font-weight:900;font-size:48px;letter-spacing:3px;padding:20px 0;border-radius:999px;opacity:0}
.chip.cyan{color:var(--c);border:4px solid var(--c);background:rgba(79,209,255,.08);top:1110px}
.chip .ic{width:64px;height:60px;display:inline-block}
.av{position:absolute;width:110px;height:110px;border-radius:50%;border:6px solid;overflow:hidden;background:#1a1c22;opacity:0}
.av div{position:absolute;width:44px;height:44px;border-radius:50%;left:27px;top:16px}
.av i{position:absolute;width:84px;height:60px;border-radius:42px 42px 0 0;left:7px;top:68px}
.you{position:absolute;left:0;right:0;top:700px;text-align:center;font-family:Russo;font-size:360px;line-height:1;color:var(--o);text-shadow:0 0 80px rgba(255,122,46,.6);opacity:0}
#decide{top:470px;font-size:78px}
#rule{top:370px}
.card{position:absolute;height:210px;border-radius:30px;background:rgba(255,255,255,.05);border:4px solid rgba(244,244,242,.25);opacity:0}
.card .cl{position:absolute;left:30px;top:22px;font-weight:900;font-size:38px;letter-spacing:4px;color:var(--dim)}
.card .q{position:absolute;right:40px;top:30px;font-family:Russo;font-size:150px;line-height:1;color:var(--o)}
.card .ans{position:absolute;left:30px;right:24px;bottom:28px;display:flex;align-items:center;gap:14px;font-weight:900;font-size:40px;color:#111;background:var(--fg);border-radius:22px;padding:12px 20px;opacity:0;white-space:nowrap}
.card .ans .ic{width:56px;height:52px;flex:none;color:var(--o)}
.pill{position:absolute;left:50%;transform:translateX(-50%);top:640px;white-space:nowrap;font-weight:800;font-size:52px;letter-spacing:2px;padding:16px 40px;border-radius:999px;border:4px solid var(--o);background:rgba(255,122,46,.12)}
.pill b{color:var(--o);font-weight:900}
#opus{top:640px;opacity:0}
.term.tall{top:780px}
.term.tall .body{font-size:38px;padding:30px 34px;line-height:1.55}
.tl{opacity:0;white-space:nowrap}.tl.p{color:var(--fg)}.tl.o{color:var(--dim)}.tl.g{color:var(--g);font-weight:700}.tl em{font-style:normal;color:var(--g)}
.prog{margin-top:18px;height:14px;background:#2b2e37;border-radius:8px;overflow:hidden}#pg{height:100%;background:var(--o);transform-origin:0 50%}
.zero{position:absolute;left:0;right:0;top:470px;text-align:center;font-family:Russo;font-size:440px;line-height:1;color:var(--g);text-shadow:0 0 90px rgba(62,207,110,.5);opacity:0}
#flow{position:absolute;top:960px;left:40px;right:40px;display:flex;align-items:center;justify-content:center}
.node{width:200px;height:200px;border-radius:30px;border:4px solid rgba(244,244,242,.3);background:rgba(255,255,255,.05);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;opacity:0}
.node .ic{width:96px;height:88px;color:var(--fg)}
.node b{font-size:30px;font-weight:900;letter-spacing:1px}
#nd0 .ic{color:var(--o)}#nd2 .ic{color:var(--c)}#nd3 .ic{color:var(--g)}
.arr{width:40px;height:8px;background:var(--o);transform-origin:0 50%;position:relative}
.arr:after{content:'';position:absolute;right:-8px;top:-10px;border-left:18px solid var(--o);border-top:14px solid transparent;border-bottom:14px solid transparent}
#rule1{top:390px;font-size:88px}
.cm{position:absolute;left:90px;width:900px;height:150px;border-radius:30px;background:#181a20;border:4px solid #2b2e37;display:flex;align-items:center;padding:0 30px;gap:24px;opacity:0}
.ava{width:86px;height:86px;border-radius:50%;flex:none}
.ctext{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}
.ctext b{font-size:30px;color:var(--dim)}
.ctext span{font-size:38px;font-weight:800;white-space:nowrap}
.likes{display:flex;flex-direction:column;align-items:center;gap:4px;width:130px;flex:none}
.hrt{width:52px;height:46px;color:#ff4d6d;display:block}
.hrt svg{width:100%;height:100%}
.cnt{position:relative;display:block;width:130px;height:40px}
.cv{position:absolute;left:0;right:0;text-align:center;font-weight:900;font-size:34px;opacity:0}
.crown{position:absolute;left:8px;top:-52px;width:90px;height:64px;color:#ffd23f;opacity:0}
.crown svg{width:100%;height:100%}
.win{position:absolute;right:150px;top:-30px;background:var(--o);color:#111;font-family:Russo;font-size:34px;padding:6px 18px;border-radius:12px;transform:rotate(4deg);opacity:0}
#doubt{top:380px;font-size:86px}
#phone{position:absolute;left:80px;top:600px;width:400px;height:600px;border-radius:56px;border:14px solid #2b2e37;background:#000;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 0 4px #444 inset}
#phone .scr{position:absolute;inset:0;overflow:hidden}
#phone .scr>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#phone .app{position:absolute;left:0;right:0;bottom:0;padding:26px 20px 30px;background:linear-gradient(transparent,rgba(0,0,0,.9) 40%);display:flex;align-items:center;gap:16px}
#phone .app img{width:76px;height:76px;border-radius:18px}
#phone .app b{font-family:Russo;font-size:40px}
#facts{position:absolute;left:520px;top:640px;width:430px;display:flex;flex-direction:column;gap:22px}
.fact{font-size:36px;font-weight:700;padding:20px 24px;border-radius:22px;background:rgba(255,255,255,.06);border-left:8px solid var(--o);opacity:0}
.fact b{color:var(--o);font-weight:900}
#bio{top:1110px;transform:none;left:520px;font-size:32px;padding:14px 24px;opacity:0}
#bio b{display:inline-block}
#pollh{top:380px;font-size:96px}
.tile{position:absolute;width:430px;height:320px;border-radius:36px;border:5px solid rgba(244,244,242,.25);background:rgba(255,255,255,.05);opacity:0}
.tile .num{position:absolute;left:30px;top:16px;font-family:Russo;font-size:130px;line-height:1;color:var(--o)}
.tile .ic{position:absolute;right:30px;top:40px;width:190px;height:150px;color:var(--fg)}
.tile b{position:absolute;left:32px;bottom:26px;font-family:Russo;font-size:48px}
.cta{position:absolute;left:0;right:0;top:1250px;text-align:center;font-family:Russo;font-size:90px;line-height:1.05;color:var(--fg);text-shadow:0 8px 0 var(--o);opacity:0}
.cta span{display:inline-block;color:var(--o);text-shadow:none}
#title9{top:400px;font-size:110px}
.sub{position:absolute;left:140px;width:800px;top:720px;height:200px;border-radius:999px;background:#ff2d55;box-shadow:0 30px 80px rgba(255,45,85,.45);opacity:0}
.sub div{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Russo;font-size:76px;color:#fff}
#subB{opacity:0;visibility:hidden}
#hand{position:absolute;left:560px;top:820px;width:200px;height:250px;opacity:0;z-index:5}
#hand svg{width:100%;height:100%}
#next{top:1010px}
#caps{position:absolute;left:60px;right:60px;top:1250px;height:300px;z-index:30}
.cap{position:absolute;left:0;right:0;top:0;text-align:center;font-weight:900;font-size:78px;line-height:1.08;color:#fff;-webkit-text-stroke:16px #000;paint-order:stroke fill;opacity:0;visibility:hidden}
.cap b{color:var(--o);font-weight:900}
`;

const page = `<!doctype html>
<html lang="ru" data-resolution="portrait">
<head><meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920"><title>Игру делают зрители — серия 1</title>
<script src="gsap.min.js"></script><style>${CSS}</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${END}" data-width="1080" data-height="1920">
  <div id="grid"></div><div id="glow"></div>
  <div id="top"><div class="tag">ИГРУ ДЕЛАЮТ ЗРИТЕЛИ</div><div class="ep">СЕРИЯ 1</div></div>
  <div id="ptrack"><div id="pbar"></div></div>
  <div id="stage">${html}</div>
  <div id="caps">${caps.map((c, k) => `<div class="cap" id="cap${k}">${c.html}</div>`).join('')}</div>
  <div id="flash"></div>
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

// ───────────── Звук: голос, музыка, эффекты ─────────────
const SR = 44100;
const N = Math.ceil(END * SR);
function wav(path, L, R) {
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36);
  buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(Math.tanh(L[i]) * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(Math.tanh(R[i]) * 32767))), 46 + i * 4);
  }
  writeFileSync(path, buf);
}
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
function mk() { return [new Float32Array(N), new Float32Array(N)]; }
function add([L, R], t0, dur, fn, gain, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  for (let k = 0; k < n; k++) {
    const i = i0 + k;
    if (i < 0 || i >= N) continue;
    const v = fn(k / SR) * gain;
    L[i] += v * (1 - Math.max(0, pan));
    R[i] += v * (1 + Math.min(0, pan));
  }
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const sin = (f, t) => Math.sin(2 * Math.PI * f * t);

// Музыка: 124 удара в минуту, минор, бочка/хэт/клэп, бас, аккорды-пэды, арпеджио. На «выборе» (S8) — дроп.
const music = mk();
const BPM = 124;
const beat = 60 / BPM;
const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const dropFrom = SC[7].from;
const dropTo = SC[7].to;
for (let b = 0; b * beat < END - 0.3; b++) {
  const t = b * beat;
  const bar = Math.floor(b / 4);
  const chord = CH[bar % 4];
  const inDrop = t >= dropFrom && t < dropTo;
  const intro = t < 1.0;
  // бочка
  if (!intro) add(music, t, 0.4, (x) => sin(50 + 90 * Math.exp(-x * 30), x) * env(x, 0.002, 0.12), inDrop ? 0.95 : 0.8);
  // клэп на 2 и 4
  if (b % 2 === 1 && !intro) add(music, t, 0.2, (x) => rnd() * env(x, 0.001, 0.05), 0.28, 0.1);
  // хэт на слабые доли
  add(music, t + beat / 2, 0.06, (x) => rnd() * env(x, 0.0005, 0.015) * (rnd() > 0 ? 1 : -1), 0.13, -0.3);
  // бас: восьмые
  for (const h of [0, 0.5]) {
    const f = hz(chord[0] - 24);
    add(music, t + h * beat, beat * 0.45, (x) => (Math.sign(sin(f, x)) * 0.5 + sin(f, x)) * env(x, 0.005, 0.12), inDrop ? 0.32 : 0.24);
  }
  // пэд на сильную долю такта
  if (b % 4 === 0) {
    chord.forEach((m, j) => add(music, t, beat * 4, (x) => (sin(hz(m), x) + 0.3 * sin(hz(m) * 2.003, x)) * Math.min(1, x / 0.3) * Math.min(1, (beat * 4 - x) / 0.3), 0.06, j - 1));
  }
  // арпеджио шестнадцатыми
  for (let s = 0; s < 4; s++) {
    const m = chord[(b * 4 + s) % 3] + 12 + (s === 3 ? 12 : 0);
    add(music, t + (s * beat) / 4, beat / 4, (x) => (sin(hz(m), x) > 0 ? 1 : -1) * 0.5 * env(x, 0.002, 0.05), inDrop ? 0.07 : 0.045, s % 2 ? 0.4 : -0.4);
  }
}
// Подъём перед дропом и удар.
add(music, dropFrom - 1.2, 1.2, (x) => rnd() * (x / 1.2) ** 2, 0.25);
add(music, dropFrom, 1.5, (x) => sin(40, x) * env(x, 0.003, 0.4), 0.9);

// Эффекты.
const fx = mk();
const SFX = {
  whoosh: (t) => add(fx, t, 0.35, (x) => rnd() * Math.sin(Math.PI * x / 0.35) ** 2 * (0.5 + 0.5 * sin(3 + x * 30, x)), 0.32),
  slam: (t) => { add(fx, t, 0.5, (x) => sin(45 + 80 * Math.exp(-x * 25), x) * env(x, 0.002, 0.18), 1.0); add(fx, t, 0.25, (x) => rnd() * env(x, 0.001, 0.06), 0.4); },
  stamp: (t) => { add(fx, t, 0.3, (x) => sin(70, x) * env(x, 0.001, 0.07), 0.9); add(fx, t, 0.15, (x) => rnd() * env(x, 0.001, 0.03), 0.5); },
  pop: (t) => add(fx, t, 0.15, (x) => sin(500 + 900 * x * 8, x) * env(x, 0.002, 0.04), 0.35),
  tick: (t) => add(fx, t, 0.06, (x) => sin(1800, x) * env(x, 0.001, 0.012), 0.25),
  bubble: (t) => add(fx, t, 0.18, (x) => sin(300 + 1200 * x, x) * env(x, 0.003, 0.05), 0.35),
  type: (t) => { for (let k = 0; k < 7; k++) add(fx, t + k * 0.09 + rnd() * 0.02, 0.03, (x) => rnd() * env(x, 0.0005, 0.006), 0.35, rnd() * 0.3); },
  ding: (t) => { add(fx, t, 0.9, (x) => (sin(1318, x) + 0.5 * sin(1976, x)) * env(x, 0.003, 0.25), 0.22); },
  click: (t) => add(fx, t, 0.05, (x) => rnd() * env(x, 0.0005, 0.008), 0.6),
  likes: (t) => { for (let k = 0; k < 10; k++) add(fx, t + k * 0.11, 0.08, (x) => sin(900 + k * 90, x) * env(x, 0.002, 0.02), 0.18, k % 2 ? 0.3 : -0.3); },
};
for (const [t, kind] of sfx) SFX[kind](t);

wav(join(OUT, 'music.wav'), ...music);
wav(join(OUT, 'sfx.wav'), ...fx);

// Голос: реплики по своим местам в одну дорожку.
const vin = LINES.flatMap((l) => ['-i', join(DIR, 'voice', `${l.id}.mp3`)]);
const delays = LINES.map((l, i) => `[${i}:a]aresample=44100,pan=stereo|c0=c0|c1=c0,adelay=${Math.round(T[l.id].start * 1000)}:all=1[v${i}]`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...vin, '-filter_complex',
  `${delays.join(';')};${LINES.map((_, i) => `[v${i}]`).join('')}amix=inputs=${LINES.length}:normalize=0,apad,atrim=0:${END}[a]`,
  '-map', '[a]', join(OUT, 'voice.wav')]);

writeFileSync(join(OUT, 'timeline.json'), JSON.stringify({ END, lines: Object.values(T).map(({ id, start, dur }) => ({ id, start, dur })), scenes: SC }, null, 1));
console.log(`out/index.html · ${END} с · ${caps.length} субтитров · ${sfx.length} звуков`);
