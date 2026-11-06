/**
 * Серия 3: заброшенный город (S3) и выбор героя — курьер, блогер, пёс (мини-сцены на весь экран), превью для монитора.
 * Устроено как genres.mjs: (ctx, tm) → HTML, анимации и звуки уходят в таймлайн через ctx.
 */

let seed = 90313;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n0 = (v) => Math.round(v);
const f1 = (v) => v.toFixed(1);
const reps = (from, to, period) => Math.max(1, Math.ceil((to - from) / period) + 2);

// ═══════════ Улица заброшенного города (общий фон) ═══════════
const VX = 540, VY = 860;
/** Фасад в перспективе: левая или правая сторона, от масштаба s0 (ближе) до s1 (дальше), высота H. */
function facade(side, s0, s1, H, lit, pre, k) {
  const dir = side === 'l' ? -1 : 1;
  const x = (s) => VX + dir * 620 * s;
  const g = (s) => VY + 640 * s;
  const P = (s, f) => [x(s), g(s) - H * s * f]; // f — доля высоты
  const pts = [P(s0, 0), P(s0, 1), P(s1, 1), P(s1, 0)];
  const poly = (a) => a.map((p) => p.map(f1).join(',')).join(' ');
  const col = ['#15131a', '#18161d', '#131118', '#1a1720'][k % 4];
  let html = `<polygon points="${poly(pts)}" fill="${col}" stroke="#2a2630" stroke-width="3"/>`;
  // Окна: решётка 3×N по фасаду (билинейно).
  const cols = 3;
  const rows = Math.max(2, Math.round(H / 260));
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const u0 = (c + 0.25) / cols, u1 = (c + 0.75) / cols;
    const v0 = (r + 0.3) / rows, v1 = (r + 0.75) / rows;
    const sA = lerp(s0, s1, u0), sB = lerp(s0, s1, u1);
    const q = [P(sA, 1 - v1), P(sA, 1 - v0), P(sB, 1 - v0), P(sB, 1 - v1)];
    const isLit = lit && c === 1 && r === rows - 1;
    const broken = !isLit && rnd() < 0.45;
    if (isLit) html += `<polygon id="${pre}lit" points="${poly(q)}" fill="#ffcf7a"/>`;
    else html += `<polygon points="${poly(q)}" fill="#07060a" stroke="#2c2832" stroke-width="2"/>`;
    if (broken) {
      const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2;
      const w = Math.abs(q[2][0] - q[0][0]) * 0.5, h = Math.abs(q[1][1] - q[0][1]) * 0.5;
      html += `<path d="M${f1(cx - w)} ${f1(cy - h * 0.2)} L${f1(cx - w * 0.2)} ${f1(cy)} L${f1(cx - w * 0.6)} ${f1(cy + h)} M${f1(cx + w * 0.3)} ${f1(cy - h)} L${f1(cx)} ${f1(cy + h * 0.1)} L${f1(cx + w)} ${f1(cy + h * 0.4)}" stroke="#7a7f8c" stroke-width="2" fill="none" opacity=".7"/>`;
    }
  }
  return html;
}
/** Вся улица: небо, луна, дома с двух сторон, дорога, фонарь, провода с воронами, туман. pre — префикс id. */
export function street(pre) {
  const sk = Array.from({ length: 30 }, () => `<i style="left:${n0(rnd() * 1080)}px;top:${n0(330 + rnd() * 380)}px"></i>`).join('');
  const L = [[1, 0.62, 1300], [0.62, 0.42, 1500], [0.42, 0.3, 1200], [0.3, 0.2, 1600], [0.2, 0.12, 1250]];
  const R = [[1, 0.66, 1400], [0.66, 0.45, 1150], [0.45, 0.32, 1500], [0.32, 0.21, 1300], [0.21, 0.12, 1550]];
  const houses = L.map(([a, b, h], k) => facade('l', a, b, h, false, pre, k)).join('') + R.map(([a, b, h], k) => facade('r', a, b, h, k === 3, pre, k + 1)).join('');
  const crows = [[300, 600], [350, 594], [640, 585], [700, 590], [760, 596]].map(([x, y], k) => `<path class="${pre}crow" id="${pre}cr${k}" d="M${x - 14} ${y - 10} Q${x - 6} ${y - 2} ${x} ${y - 4} Q${x + 6} ${y - 2} ${x + 14} ${y - 10} Q${x + 4} ${y + 4} ${x} ${y + 6} Q${x - 4} ${y + 4} ${x - 14} ${y - 10}Z" fill="#000"/>`).join('');
  return `
<div class="tw-sky"></div><div class="tw-stars">${sk}</div><div class="tw-moon"></div><div class="tw-cloud" id="${pre}cl"></div>
<svg class="tw-svg" viewBox="0 0 1080 1920">
 <path d="M0 610 Q540 650 1080 600" stroke="#111" stroke-width="3" fill="none"/>${crows}
 <rect y="1490" width="1080" height="430" fill="#0f0e12"/><polygon points="-500,1920 1580,1920 560,860 520,860" fill="#121115"/>
 <g stroke="#3a3540" stroke-width="5" opacity=".55"><path d="M540 880 L540 900 M540 960 L540 1000 M540 1080 L540 1150 M540 1260 L540 1360"/></g>
 <path d="M300 1500 L360 1380 L340 1300 L410 1220 M760 1500 L700 1420 L720 1330" stroke="#050506" stroke-width="5" fill="none"/>
 ${houses}
 <g><rect x="150" y="760" width="14" height="760" fill="#0a090c"/><path d="M157 770 Q170 720 240 730" stroke="#0a090c" stroke-width="12" fill="none"/><rect x="226" y="728" width="44" height="18" rx="6" fill="#1c1b20"/>
  <circle id="${pre}lamp" cx="248" cy="752" r="14" fill="#cfe2ff" opacity=".9"/></g>
</svg>
<div class="tw-lampglow" id="${pre}lg"></div>
<div class="tw-paper" id="${pre}pp"></div>
<div class="tw-fog" id="${pre}fg"></div>`;
}
/** Общее «оживление» улицы: туман, мигающий фонарь, облака, вороны, бумага. */
function streetLife(c, pre, s, end) {
  const { A, sfx } = c;
  A(`tl.fromTo('#${pre}fg',{x:0},{x:-700,duration:8,ease:'none'},${s});`);
  A(`tl.fromTo('#${pre}cl',{x:-200},{x:300,duration:9,ease:'none'},${s});`);
  A(`tl.to('#${pre}lamp,#${pre}lg',{keyframes:[{opacity:.1,duration:.05},{opacity:1,duration:.06},{opacity:.2,duration:.05},{opacity:.9,duration:.12},{opacity:0,duration:.3},{opacity:.9,duration:.05}],repeat:${reps(s, end, 1.4)},repeatDelay:.8},${s});`);
  A(`tl.fromTo('#${pre}pp',{x:-200,y:0,rotation:0},{x:1300,y:-120,rotation:900,duration:3.2,ease:'power1.in'},${s + 0.3});`);
  A(`tl.to('.${pre}crow',{y:-3,duration:.3,yoyo:true,repeat:${reps(s, end, 0.3)},stagger:.1},${s});`);
  sfx(s, 'wind', end - s);
}

// ═══════════ S3: заброшенный город ═══════════
export function town(c, tm) {
  const { A, sfx, shake } = c;
  const { s, e } = tm;
  const html = `<div id="twcam">${street('t')}<div id="twlitglow"></div><svg id="twfig" viewBox="0 0 60 90"><path d="M30 10 a9 9 0 1 0 .1 0 M20 28 Q30 24 40 28 L42 90 L18 90Z" fill="#1a0f05"/></svg></div>`;
  streetLife(c, 't', s, e + 0.5);
  A(`tl.fromTo('#twcam',{scale:1.25,y:120},{scale:1,y:0,duration:1.4,ease:'power2.out'},${s});`);
  // Выбитые окна: звон стекла и вспышка.
  A(`tl.fromTo('#gflash',{opacity:.35,background:'#cfe2ff'},{opacity:0,duration:.25,immediateRender:false},${tm.glass});`);
  shake(tm.glass, 10);
  sfx(tm.glass, 'glass');
  // Свет в одном доме: камера наезжает на окно.
  A(`tl.fromTo('#tlit',{fill:'#ffcf7a'},{fill:'#ffe9b0',duration:.2,yoyo:true,repeat:7},${tm.light - 0.2});`);
  A(`tl.fromTo('#twlitglow',{opacity:0,scale:.6},{opacity:1,scale:1,duration:.4},${tm.light - 0.2});`);
  A(`tl.to('#twcam',{scale:2.3,duration:${f1(e - tm.light + 0.4)},ease:'power2.in',transformOrigin:'700px 870px'},${tm.light});`);
  A(`tl.fromTo('#twfig',{opacity:0,x:-8},{opacity:.95,x:8,duration:.6},${tm.light + 0.3});`);
  sfx(tm.light, 'sting');
  return html;
}

// ═══════════ Курьер: адрес, которого нет на карте ═══════════
export function courier(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const end = e + 0.5;
  let roads = '';
  for (let i = 0; i < 9; i++) roads += `<line x1="${-40 + i * 70}" y1="0" x2="${-40 + i * 70 + 60}" y2="760" class="rd"/>`;
  for (let i = 0; i < 12; i++) roads += `<line x1="0" y1="${30 + i * 68}" x2="440" y2="${i * 68 - 10}" class="rd"/>`;
  const html = `
<div id="cocam">${street('c')}</div>
<svg id="coman" viewBox="0 0 200 420"><g fill="#0b0a0e" stroke="#ff7a2e" stroke-width="3" stroke-opacity=".6"><circle cx="100" cy="50" r="30"/><path d="M62 92 Q100 80 138 92 L146 260 L128 410 L108 410 L102 280 L98 280 L92 410 L72 410 L54 260Z"/>
 <rect x="120" y="150" width="76" height="70" rx="6" fill="#6a4426" stroke="#ffb066"/></g><path d="M126 186 H190 M158 150 V220" stroke="#3a2412" stroke-width="5"/></svg>
<div id="cophone"><div class="cscr">
 <div class="chead"><b>Доставка №13</b><span>ул. Тихая, 13</span></div>
 <div class="cmap" id="comap"><svg viewBox="0 0 440 760">${roads}<path id="corte" d="M60 700 L120 560 L260 520 L300 360 L380 250" stroke="#ff7a2e" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="12 12"/></svg>
  <i id="cocar"></i><div id="copin"><b></b></div></div>
 <div class="cbad" id="cobad">АДРЕС НЕ НАЙДЕН</div><div class="cgps" id="cogps">GPS: нет сигнала</div>
</div></div>
<div class="gtitle cour" id="cotitle"><span>КУРЬЕР</span></div>`;
  streetLife(c, 'c', s, end);
  A(`tl.fromTo('#cotitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.fromTo('#cophone',{y:500,rotation:8},{y:0,rotation:-3,duration:.5,ease:'back.out(1.4)'},${z + 0.1});`);
  A(`tl.fromTo('#coman',{x:-260,opacity:0},{x:0,opacity:1,duration:.6,ease:'power2.out'},${z + 0.1});`);
  A(`tl.fromTo('#corte',{strokeDashoffset:0},{strokeDashoffset:-240,duration:2,ease:'none',repeat:3},${s});`);
  A(`tl.fromTo('#cocar',{x:0,y:0},{keyframes:[{x:60,y:-140,duration:.4},{x:200,y:-180,duration:.4},{x:240,y:-340,duration:.4},{x:320,y:-450,duration:.4}]},${z + 0.2});`);
  A(`tl.fromTo('#copin',{scale:1},{scale:1.25,duration:.25,yoyo:true,repeat:${reps(s, end, 0.25)}},${s});`);
  sfx(tm.addr, 'ding');
  // Адреса нет на карте: улицы гаснут, глитч, красная плашка.
  const t = tm.nomap;
  A(`tl.to('#comap .rd',{opacity:0,duration:.05,stagger:{each:.02,from:'random'}},${t});`);
  A(`tl.to('#corte',{opacity:0,duration:.1},${t + 0.25});`);
  A(`tl.to('#comap',{keyframes:[{x:-14,filter:'hue-rotate(90deg)',duration:.05},{x:12,duration:.05},{x:0,filter:'hue-rotate(0deg)',duration:.05}],repeat:3},${t});`);
  A(`tl.fromTo('#cobad',{scale:2.2,opacity:0},{scale:1,opacity:1,duration:.2,ease:'power4.in'},${t + 0.15});`);
  A(`tl.fromTo('#cogps',{opacity:0},{opacity:1,duration:.1,yoyo:true,repeat:7},${t + 0.3});`);
  A(`tl.to('#clit,#clamp,#clg',{opacity:0,duration:.05},${t + 0.2});`);
  shake(t + 0.3, 18);
  sfx(t, 'glitch');
  sfx(t + 0.15, 'stamp');
  return html;
}

// ═══════════ Блогер: стрим из заброшки, «СЗАДИ!» ═══════════
const CHAT = [['kirill_88', 'о, заброшка'], ['masha.k', 'жуть 😨'], ['bot_vasya', 'иди в ту дверь'], ['lena', 'чё за звук??'], ['den4ik', 'там кто-то есть']];
export function blogger(c, tm) {
  const { A, sfx, stepper, shake } = c;
  const { s, z, e } = tm;
  const end = e + 0.5;
  const viewers = [];
  for (let k = 0; k <= 14; k++) viewers.push({ t: s + k * 0.22, text: (1024 + k * k * 11).toLocaleString('ru-RU').replace(/\s/g, ' ') });
  const vw = stepper('blv', viewers, 'vw');
  let wall = '';
  for (let x = 0; x < 1080; x += 60) wall += `<rect x="${x}" y="300" width="30" height="1000" fill="#1d1a16" opacity="${(0.4 + rnd() * 0.5).toFixed(2)}"/>`;
  const html = `
<div id="blroom"><svg viewBox="0 0 1080 1920" class="tw-svg"><rect width="1080" height="1920" fill="#14120f"/>${wall}
 <path d="M200 520 Q230 600 210 700 L250 640Z M820 460 Q790 560 840 640 L800 560Z" fill="#0c0b09"/>
 <polygon points="0,1300 1080,1300 1080,1920 0,1920" fill="#0d0c0a"/>
 <rect x="290" y="640" width="290" height="660" fill="#030303" stroke="#2c261f" stroke-width="14"/>
 <path d="M580 650 L700 610 L700 1340 L580 1300Z" fill="#241f19"/>
 <path d="M120 1380 L260 1350 L230 1420Z M760 1420 L900 1380 L860 1460Z" fill="#26211a"/></svg>
 <svg id="blfig" viewBox="0 0 200 520"><path d="M100 20 a32 32 0 1 0 0.1 0 M62 96 Q100 82 138 96 L150 300 L132 510 L114 510 L104 330 L96 330 L86 510 L68 510 L50 300 Z M62 104 L30 360 M138 104 L170 360" fill="#000" stroke="#000" stroke-width="16" stroke-linejoin="round"/><circle cx="88" cy="50" r="7" fill="#fff"/><circle cx="112" cy="50" r="7" fill="#fff"/></svg>
 <div id="bllight"></div></div>
<div id="blframe"><i></i><i></i><i></i><i></i></div>
<div id="bllive"><b>● LIVE</b><span>👁</span>${vw}</div>
<div id="blcam"><svg viewBox="0 0 200 200"><rect width="200" height="200" fill="#2a2620"/><circle cx="100" cy="92" r="44" fill="#e0b48a"/><path d="M56 80 Q100 20 144 80" fill="#3a2414"/><circle cx="84" cy="94" r="5" id="ble1"/><circle cx="116" cy="94" r="5" id="ble2"/><path id="blmouth" d="M86 118 Q100 126 114 118" stroke="#000" stroke-width="4" fill="none"/><path d="M40 200 Q100 130 160 200Z" fill="#2c4a6a"/><path d="M52 92 Q52 40 100 40 Q148 40 148 92" stroke="#111" stroke-width="10" fill="none"/></svg></div>
<div id="blchat">${CHAT.map(([n, t], k) => `<p id="blc${k}"><b>${n}</b> ${t}</p>`).join('')}${Array.from({ length: 7 }, (_, k) => `<p class="spam" id="bls${k}"><b>user${n0(1000 + rnd() * 8999)}</b> СЗАДИ!!!</p>`).join('')}</div>
<div id="blnoise"></div>
<div class="gtitle blog" id="bltitle"><span>БЛОГЕР</span></div>`;
  A(`tl.fromTo('#bltitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.fromTo('#bllight',{x:-160,y:40},{x:160,y:-30,duration:1.1,yoyo:true,repeat:${reps(s, end, 1.1)},ease:'sine.inOut'},${s});`);
  A(`tl.to('#bllive b',{opacity:.3,duration:.4,yoyo:true,repeat:${reps(s, end, 0.4)},ease:'steps(1)'},${s});`);
  A(`tl.fromTo('#blroom',{x:-6,y:4},{x:6,y:-4,duration:.4,yoyo:true,repeat:${reps(s, end, 0.4)},ease:'sine.inOut'},${s});`);
  CHAT.forEach((_, k) => { const t = tm.stream - 0.2 + k * 0.33; A(`tl.fromTo('#blc${k}',{x:60,opacity:0},{x:0,opacity:1,duration:.2},${t});`); sfx(t, 'tick'); });
  sfx(s, 'drone', end - s);
  // «СЗАДИ!»: чат взрывается, в двери фигура, помехи, блогер в шоке.
  const t = tm.behind;
  A(`tl.fromTo('#blfig',{opacity:0,scale:.9},{keyframes:[{opacity:1,duration:.05},{opacity:0,duration:.05},{opacity:1,duration:.05}]},${t - 0.5});`);
  for (let k = 0; k < 7; k++) { A(`tl.fromTo('#bls${k}',{scale:1.6,opacity:0},{scale:1,opacity:1,duration:.12,ease:'back.out(3)'},${t - 0.35 + k * 0.08});`); sfx(t - 0.35 + k * 0.08, 'pop'); }
  A(`tl.to('#blc0,#blc1,#blc2',{opacity:0,duration:.1},${t - 0.35});`);
  A(`tl.to('#blmouth',{attr:{d:'M88 116 Q100 140 112 116 Z'},fill:'#000',duration:.1},${t});`);
  A(`tl.to('#ble1,#ble2',{attr:{r:9},duration:.1},${t});`);
  A(`tl.fromTo('#blnoise',{opacity:0},{keyframes:[{opacity:.7,duration:.05},{opacity:.1,duration:.05},{opacity:.6,duration:.05},{opacity:0,duration:.1}],repeat:2},${t + 0.1});`);
  A(`tl.to('#blfig',{scale:1.7,y:180,duration:.25,ease:'power4.in'},${t + 0.35});`);
  shake(t + 0.6, 30);
  sfx(t + 0.1, 'glitch');
  sfx(t + 0.55, 'scream');
  return html;
}

// ═══════════ Пёс: чует то, чего не видят люди ═══════════
export function dog(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const end = e + 0.5;
  const prints = Array.from({ length: 7 }, (_, k) => `<i class="dgp" id="dgp${k}" style="left:${n0(520 + k * 40 + (k % 2) * 30)}px;top:${n0(1440 - k * 85)}px;transform:scale(${(1 - k * 0.09).toFixed(2)})"></i>`).join('');
  const sniff = Array.from({ length: 8 }, (_, k) => `<i class="dgs" id="dgs${k}"></i>`).join('');
  const html = `
<div id="dgcam">${street('d')}</div>
<div id="dgvis"></div>
<div id="dgghost">${prints}<svg id="dgspirit" viewBox="0 0 200 520"><path d="M100 30 a34 34 0 1 0 .1 0 M58 110 Q100 92 142 110 L160 470 Q100 520 40 470Z" fill="rgba(140,240,255,.35)" stroke="#9ff6ff" stroke-width="4"/><circle cx="86" cy="62" r="7" fill="#e8ffff"/><circle cx="114" cy="62" r="7" fill="#e8ffff"/></svg></div>
<svg id="dgdog" viewBox="0 0 520 340"><g fill="#0b0a0d" stroke="#ff7a2e" stroke-width="3" stroke-opacity=".7">
 <g id="dgtail"><path d="M80 150 Q30 110 40 60 Q60 110 96 140Z"/></g>
 <path d="M80 140 Q100 110 200 112 L330 110 Q360 100 380 80 L392 40 L410 76 L430 44 L440 92 Q480 110 498 140 Q500 160 470 164 L430 160 Q400 170 384 190 L370 230 L360 320 L340 320 L344 236 L250 240 L230 320 L210 320 L214 240 Q170 240 140 232 L120 320 L100 320 L104 228 Q80 200 80 140Z"/></g>
 <circle cx="452" cy="112" r="6" fill="#ffd23f"/></svg>
<div id="dgsn">${sniff}</div>
<div class="gtitle dogt" id="dgtitle"><span>ПЁС</span></div>`;
  streetLife(c, 'd', s, end);
  A(`tl.fromTo('#dgtitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.fromTo('#dgtail',{rotation:-14},{rotation:16,duration:.14,yoyo:true,repeat:${reps(s, end, 0.14)},svgOrigin:'90 145'},${s});`);
  A(`tl.fromTo('#dgdog',{y:0},{y:-6,duration:.25,yoyo:true,repeat:${reps(s, end, 0.25)}},${s});`);
  // Нюхает: частицы от носа.
  for (let k = 0; k < 8; k++) A(`tl.fromTo('#dgs${k}',{x:0,y:0,opacity:.9,scale:.5},{x:${n0(60 + rnd() * 80)},y:${n0(-30 - rnd() * 60)},opacity:0,scale:1.5,duration:.6,repeat:${reps(s, end, 0.9)},repeatDelay:.3},${(s + k * 0.11).toFixed(3)});`);
  sfx(tm.sniff, 'sniff');
  // Собачье зрение: город сереет, проступают светящиеся следы и призрак.
  const t = tm.sense;
  A(`tl.to('#dgcam',{filter:'grayscale(1) brightness(.55) contrast(1.3)',duration:.3},${t});`);
  A(`tl.fromTo('#dgvis',{opacity:0},{opacity:1,duration:.3},${t});`);
  A(`tl.fromTo('#dgghost',{opacity:0},{opacity:1,duration:.1},${t + 0.1});`);
  for (let k = 0; k < 7; k++) A(`tl.fromTo('#dgp${k}',{opacity:0},{opacity:1,duration:.15},${(t + 0.15 + k * 0.08).toFixed(3)});`);
  A(`tl.fromTo('#dgspirit',{opacity:0,y:20},{opacity:1,y:0,duration:.4},${t + 0.5});`);
  A(`tl.to('#dgspirit',{opacity:.4,duration:.12,yoyo:true,repeat:7},${t + 0.9});`);
  A(`tl.to('#dgtail',{rotation:-30,duration:.2,svgOrigin:'90 145'},${t});`);
  shake(t + 0.1, 12);
  sfx(t, 'growl');
  sfx(t + 0.4, 'sting');
  return html;
}

export const TOWN_CSS = `
.tw-sky{position:absolute;left:0;right:0;top:0;height:1000px;background:linear-gradient(#06050b 0%,#141020 55%,#241c2a 100%)}
.tw-stars i{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:.6}
.tw-moon{position:absolute;left:600px;top:420px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 40% 38%,#f2eee0,#b9b3a0 75%);box-shadow:0 0 80px 26px rgba(220,215,200,.18)}
.tw-cloud{position:absolute;left:400px;top:440px;width:520px;height:90px;border-radius:50%;background:radial-gradient(ellipse,rgba(60,52,70,.95),rgba(60,52,70,0) 70%)}
.tw-svg{position:absolute;left:0;top:0;width:1080px;height:1920px}
.tw-lampglow{position:absolute;left:150px;top:650px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(200,225,255,.45),rgba(200,225,255,0) 65%)}
.tw-paper{position:absolute;left:0;top:1360px;width:60px;height:44px;background:#cfc8b6;border-radius:4px;opacity:.85}
.tw-fog{position:absolute;left:-300px;top:1250px;width:2400px;height:300px;background:radial-gradient(ellipse at 30% 50%,rgba(150,140,170,.22),rgba(150,140,170,0) 60%),radial-gradient(ellipse at 75% 50%,rgba(150,140,170,.18),rgba(150,140,170,0) 55%)}
#twcam,#cocam,#dgcam{position:absolute;inset:0;transform-origin:50% 50%}
#twlitglow{position:absolute;left:600px;top:780px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,110,.6),rgba(255,200,110,0) 65%);opacity:0}
#twfig{position:absolute;left:692px;top:858px;width:16px;height:24px;opacity:0}
.gtitle.cour span{color:#ffb066;text-shadow:0 0 30px rgba(255,122,46,.6),7px 7px 0 #5a2a0a}
.gtitle.blog span{color:#ff4d6d;text-shadow:0 0 30px rgba(255,40,80,.6),7px 7px 0 #3a0010}
.gtitle.dogt span{color:#9ff6ff;text-shadow:0 0 34px rgba(79,209,255,.8),7px 7px 0 #0a3a4a}
/* курьер */
#coman{position:absolute;left:30px;top:880px;width:200px;height:420px;opacity:0}
#cophone{position:absolute;left:330px;top:560px;width:480px;height:680px;border-radius:56px;border:14px solid #1f222a;background:#000;box-shadow:0 40px 100px rgba(0,0,0,.8),0 0 60px rgba(255,122,46,.25);overflow:hidden;z-index:3}
#cophone .cscr{position:absolute;inset:0;background:#0e1118}
.chead{position:absolute;left:0;right:0;top:0;padding:20px 26px;background:#181c26;z-index:2}
.chead b{display:block;font-weight:900;font-size:30px;color:#fff}.chead span{font-size:26px;color:#ff9a4d;font-weight:700}
.cmap{position:absolute;left:12px;right:12px;top:110px;bottom:12px;border-radius:24px;overflow:hidden;background:#141925}
.cmap svg{position:absolute;left:0;top:0;width:428px;height:760px}
.cmap .rd{stroke:#2a3346;stroke-width:14}
#cocar{position:absolute;left:44px;top:500px;width:26px;height:26px;border-radius:50%;background:#4fd1ff;box-shadow:0 0 16px 6px rgba(79,209,255,.6)}
#copin{position:absolute;left:356px;top:56px;width:46px;height:46px}
#copin b{position:absolute;inset:0;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#ff3b3b;box-shadow:0 0 20px rgba(255,60,60,.8)}
.cbad{position:absolute;left:20px;right:20px;top:290px;padding:18px 0;text-align:center;border-radius:18px;background:#d0021b;font-family:Russo;font-size:40px;color:#fff;opacity:0;z-index:3}
.cgps{position:absolute;left:0;right:0;top:390px;text-align:center;font-family:Mono;font-size:28px;color:#ff6b6b;opacity:0;z-index:3}
/* блогер */
#blroom{position:absolute;inset:-20px}
#blfig{position:absolute;left:340px;top:700px;width:200px;height:520px;opacity:0;transform-origin:50% 100%}
#bllight{position:absolute;left:-1080px;top:-1920px;width:3240px;height:5760px;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,0) 220px,rgba(0,0,0,.6) 380px,rgba(0,0,0,.9) 560px)}
#blframe i{position:absolute;width:70px;height:70px;border:6px solid rgba(255,255,255,.8);z-index:3}
#blframe i:nth-child(1){left:40px;top:360px;border-right:0;border-bottom:0}#blframe i:nth-child(2){right:40px;top:360px;border-left:0;border-bottom:0}
#blframe i:nth-child(3){left:40px;top:1170px;border-right:0;border-top:0}#blframe i:nth-child(4){right:40px;top:1170px;border-left:0;border-top:0}
#bllive{position:absolute;left:70px;top:540px;display:flex;align-items:center;gap:12px;z-index:4}
#bllive b{padding:6px 14px;border-radius:8px;background:#e0102f;font-weight:900;font-size:30px}
#bllive>span{font-size:30px}
.stp.vw{width:140px;height:40px}.stp.vw .sv{text-align:left;font-weight:900;font-size:32px;color:#fff}
#blcam{position:absolute;left:60px;top:960px;width:210px;height:210px;border-radius:50%;overflow:hidden;border:6px solid #ff4d6d;z-index:4}
#blcam svg{width:100%;height:100%}
#blchat{position:absolute;left:600px;top:640px;width:420px;height:540px;display:flex;flex-direction:column;justify-content:flex-end;gap:8px;z-index:4}
#blchat p{margin:0;padding:8px 14px;border-radius:14px;background:rgba(0,0,0,.6);font-weight:700;font-size:26px;opacity:0;white-space:nowrap}
#blchat p b{color:#9fb4ff}
#blchat p.spam{position:absolute;right:0;background:#d0021b;color:#fff;font-weight:900;font-size:30px}
${Array.from({ length: 7 }, (_, k) => `#bls${k}{top:${30 + k * 74}px;right:${(k * 37) % 80}px}`).join('')}
#blnoise{position:absolute;inset:0;opacity:0;z-index:5;background:repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 2px,rgba(0,0,0,.2) 2px 5px),repeating-linear-gradient(90deg,rgba(255,0,60,.12) 0 3px,rgba(0,255,255,.1) 3px 7px)}
/* пёс */
#dgdog{position:absolute;left:250px;top:1000px;width:520px;height:340px;z-index:3}
#dgsn{position:absolute;left:705px;top:1110px;z-index:3}
.dgs{position:absolute;width:12px;height:12px;border-radius:50%;background:rgba(220,230,255,.8)}
#dgvis{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at 50% 55%,rgba(40,120,160,.15),rgba(0,20,40,.7));mix-blend-mode:screen}
#dgghost{position:absolute;inset:0;opacity:0;z-index:2}
.dgp{position:absolute;width:34px;height:40px;border-radius:50% 50% 45% 45%;background:radial-gradient(circle,#c8fbff,#4fd1ff 60%,rgba(79,209,255,0) 75%);box-shadow:0 0 22px 6px rgba(79,209,255,.6);opacity:0}
#dgspirit{position:absolute;left:770px;top:760px;width:120px;height:320px;opacity:0;filter:drop-shadow(0 0 20px #4fd1ff)}
`;

export const THUMBS3 = [
  // город
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><rect width="856" height="400" fill="#141020"/><circle cx="560" cy="80" r="34" fill="#e8e3d2"/>
   <polygon points="0,400 0,40 300,180 300,330" fill="#18161d"/><polygon points="856,400 856,60 560,190 560,330" fill="#1a1720"/><polygon points="0,400 856,400 440,250 416,250" fill="#121115"/>
   ${[[60, 120], [160, 170], [60, 240], [160, 260], [700, 140], [620, 200]].map(([x, y]) => `<rect x="${x}" y="${y}" width="40" height="44" fill="#07060a" stroke="#2c2832"/>`).join('')}<rect x="760" y="230" width="40" height="44" fill="#ffcf7a"/></svg>`,
  // курьер
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><rect width="856" height="400" fill="#0e1118"/>${Array.from({ length: 10 }, (_, i) => `<line x1="${i * 90}" y1="0" x2="${i * 90 + 60}" y2="400" stroke="#2a3346" stroke-width="12"/>`).join('')}
   <path d="M120 360 L260 260 L420 230 L560 120" stroke="#ff7a2e" stroke-width="10" stroke-dasharray="14 12" fill="none"/><circle cx="560" cy="110" r="20" fill="#ff3b3b"/><rect x="250" y="160" width="360" height="70" rx="14" fill="#d0021b"/><text x="430" y="207" text-anchor="middle" font-family="Russo" font-size="30" fill="#fff">АДРЕС НЕ НАЙДЕН</text></svg>`,
  // блогер
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><rect width="856" height="400" fill="#14120f"/><rect x="300" y="80" width="200" height="320" fill="#030303" stroke="#2c261f" stroke-width="10"/>
   <path d="M400 150 a18 18 0 1 0 .1 0 M380 190 L420 190 L428 330 L372 330Z" fill="#000"/><circle cx="394" cy="150" r="4" fill="#fff"/><circle cx="406" cy="150" r="4" fill="#fff"/>
   <rect x="30" y="30" width="110" height="40" rx="8" fill="#e0102f"/><text x="85" y="58" text-anchor="middle" font-family="Russo" font-size="22" fill="#fff">● LIVE</text><rect x="600" y="260" width="220" height="44" rx="10" fill="#d0021b"/><text x="710" y="290" text-anchor="middle" font-family="Russo" font-size="24" fill="#fff">СЗАДИ!!!</text></svg>`,
  // пёс
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><rect width="856" height="400" fill="#0c1820"/><polygon points="0,400 856,400 440,220 416,220" fill="#0e1418"/>
   <path d="M250 300 Q260 260 340 262 L440 260 Q470 250 486 222 L494 196 L506 222 L520 200 L526 236 Q556 250 566 274 L540 284 Q510 300 500 320 L490 380 L474 380 L478 320 L380 324 L370 380 L354 380 L352 320 Q290 320 270 312 L262 380 L246 380 L250 300Z" fill="#000" stroke="#ff7a2e" stroke-width="3"/>
   ${[0, 1, 2, 3].map((k) => `<circle cx="${600 + k * 40}" cy="${360 - k * 40}" r="10" fill="#4fd1ff"/>`).join('')}<path d="M760 180 a20 20 0 1 0 .1 0 M736 220 L784 220 L796 360 L724 360Z" fill="rgba(140,240,255,.35)" stroke="#9ff6ff" stroke-width="3"/></svg>`,
];
