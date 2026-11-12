/**
 * Серия 8: выбор №8 «Как найти дорогу в стёртом городе?» — блокнот, без карты, старая карта.
 * Устроено как names.mjs: (ctx, tm) → HTML, анимации и звуки уходят в таймлайн через ctx.
 */
import { street, streetLife } from './town.mjs';

let seed = 80808;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n0 = (v) => Math.round(v);
const f3 = (v) => (+v).toFixed(3);
const reps = (from, to, period) => Math.max(1, Math.ceil((to - from) / period) + 2);

const DOG = (id, fill = '#c9925a', stroke = '#5a3a1e') => `<svg id="${id}" viewBox="0 0 520 340"><g fill="${fill}" stroke="${stroke}" stroke-width="3">
 <g class="dtail"><path d="M80 150 Q30 110 40 60 Q60 110 96 140Z"/></g>
 <path d="M80 140 Q100 110 200 112 L330 110 Q360 100 380 80 L392 40 L410 76 L430 44 L440 92 Q480 110 498 140 Q500 160 470 164 L430 160 Q400 170 384 190 L370 230 L360 320 L340 320 L344 236 L250 240 L230 320 L210 320 L214 240 Q170 240 140 232 L120 320 L100 320 L104 228 Q80 200 80 140Z"/></g>
 <path d="M410 70 L430 100" stroke="#f0e0c8" stroke-width="5"/><circle cx="452" cy="112" r="6" fill="#111"/></svg>`;
const PENCIL = `<svg viewBox="0 0 120 520"><path d="M30 0 H90 V420 L60 510 L30 420Z" fill="#ffd23f" stroke="#5a3a00" stroke-width="5"/><path d="M30 420 L60 510 L90 420Z" fill="#f2d2a8" stroke="#5a3a00" stroke-width="5"/><path d="M50 480 L60 510 L70 480Z" fill="#333"/><rect x="30" y="0" width="60" height="50" fill="#ff8aa0" stroke="#5a3a00" stroke-width="5"/></svg>`;
/** Помехи стирания — тот же рисунок, что в прошлых сериях. */
const STATIC = (id, cls = '') => `<div class="mst ${cls}" id="${id}"><i></i></div>`;
const staticLoop = (A, id, s, e) => A(`tl.fromTo('#${id} i',{backgroundPosition:'0px 0px'},{backgroundPosition:'0px 60px',duration:.1,ease:'steps(3)',repeat:${reps(s, e, 0.1)}},${f3(s)});`);

// ═══════════ 1 — Блокнот: рисуешь карту сам, стёртое исчезает и с бумаги ═══════════
export function notebook(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  // Улицы рисуются по очереди; третья потом стирается.
  const roads = [
    'M120 300 L820 300', 'M300 120 L300 980', 'M620 300 L620 980', 'M120 720 L820 720', 'M300 520 L620 520',
  ];
  const len = [700, 860, 680, 700, 320];
  const html = `
<div id="nbdesk"></div>
<div id="nbpage">
 <svg viewBox="0 0 940 1100" id="nbsvg">
  <defs><pattern id="nbgrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0 H0 V40" fill="none" stroke="#9cc3e6" stroke-width="2"/></pattern></defs>
  <rect width="940" height="1100" fill="#fbf6e9"/><rect width="940" height="1100" fill="url(#nbgrid)" opacity=".7"/>
  <path d="M80 0 V1100" stroke="#ff8a8a" stroke-width="4"/>
  ${roads.map((d, k) => `<path id="nbr${k}" d="${d}" stroke="#2d2a36" stroke-width="16" stroke-linecap="round" fill="none" stroke-dasharray="${len[k]}" stroke-dashoffset="${len[k]}"/>`).join('')}
  <g id="nbh" opacity="0" fill="none" stroke="#2d2a36" stroke-width="7">
   <rect x="350" y="360" width="90" height="110"/><rect x="480" y="360" width="90" height="110"/><rect x="350" y="580" width="90" height="100"/><rect x="480" y="580" width="90" height="100"/>
   <path d="M680 380 h90 v80 h-90z M680 380 l45 -40 l45 40"/>
  </g>
  <g id="nbtxt" opacity="0" font-family="Caveat,'Comic Sans MS',cursive" font-size="44" fill="#1f4ea3" font-style="italic">
   <text x="390" y="555">двор</text><text x="660" y="500">магазин</text><text x="150" y="270">ул. Тихая?</text>
  </g>
  <g id="nbpaw" opacity="0" fill="#c1121f"><circle cx="470" cy="900" r="22"/><circle cx="440" cy="862" r="10"/><circle cx="465" cy="852" r="10"/><circle cx="492" cy="858" r="10"/><circle cx="506" cy="882" r="9"/></g>
 </svg>
 ${STATIC('nbst', 'strip')}
 <div id="nbgone">СТЁРТО</div>
</div>
<div id="nbpen">${PENCIL}</div>
<div class="gtitle mnb" id="nbtitle"><span>БЛОКНОТ</span></div>`;
  A(`tl.fromTo('#nbtitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${f3(z + 0.2)});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.fromTo('#nbpage',{rotation:-4,scale:1.08},{rotation:-1,scale:1,duration:${f3(e - s)},ease:'none'},${f3(s)});`);
  // Карандаш рисует улицы по очереди.
  const d0 = z + 0.35, step = Math.max(0.22, (tm.erase - d0 - 0.5) / roads.length);
  const pts = [[120, 300, 820, 300], [300, 120, 300, 980], [620, 300, 620, 980], [120, 720, 820, 720], [300, 520, 620, 520]];
  roads.forEach((_, k) => {
    const t = d0 + k * step;
    const [x1, y1, x2, y2] = pts[k];
    // Страница 940×1100 стоит в кадре с 70,560; кончик карандаша — внизу картинки (60,510 из 120×520 → 0.5, 0.98).
    const px = (x) => n0(70 + x - 60), py = (y) => n0(560 + y - 510);
    A(`tl.fromTo('#nbpen',{x:${px(x1)},y:${py(y1)}},{x:${px(x2)},y:${py(y2)},duration:${f3(step * 0.9)},ease:'power1.inOut'},${f3(t)});`);
    A(`tl.to('#nbr${k}',{strokeDashoffset:0,duration:${f3(step * 0.9)},ease:'power1.inOut'},${f3(t)});`);
    sfx(t, 'scratch');
  });
  A(`tl.fromTo('#nbpen',{autoAlpha:0},{autoAlpha:1,duration:.15},${f3(d0 - 0.1)});`);
  A(`tl.to('#nbh',{opacity:1,duration:.25},${f3(d0 + step * 2)});`);
  A(`tl.to('#nbtxt',{opacity:1,duration:.25},${f3(d0 + step * 3)});`);
  A(`tl.to('#nbpaw',{opacity:1,duration:.15},${f3(d0 + step * 4)});`);
  sfx(d0 + step * 4, 'pop');
  // «Стёртые улицы исчезают и с бумаги»: помехи ползут по улице, линия и подпись пропадают.
  const t = tm.erase;
  A(`tl.to('#nbpen',{x:'+=180',y:'+=240',rotation:20,autoAlpha:0,duration:.3},${f3(t - 0.2)});`);
  A(`tl.fromTo('#nbst',{scaleX:0},{scaleX:1,duration:.5,ease:'power2.out'},${f3(t)});`);
  staticLoop(A, 'nbst', t, e + 0.5);
  A(`tl.to('#nbr0,#nbtxt text:nth-child(3)',{opacity:0,duration:.4,ease:'steps(4)'},${f3(t + 0.25)});`);
  A(`tl.to('#nbst',{opacity:.35,duration:.4},${f3(t + 0.7)});`);
  A(`tl.fromTo('#nbgone',{scale:2.6,autoAlpha:0,rotation:-6},{scale:1,autoAlpha:1,rotation:-6,duration:.22,ease:'power4.in'},${f3(t + 0.6)});`);
  shake(t + 0.82, 18);
  sfx(t, 'glitch');
  sfx(t + 0.8, 'stamp');
  return html;
}

// ═══════════ 2 — Без карты: нюх Тузика и стрелки на стенах ═══════════
export function nomap(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const arrows = [[150, 980, 1.1, -8], [800, 940, 0.9, 6], [300, 820, 0.7, -4], [690, 800, 0.6, 3]];
  const trail = Array.from({ length: 14 }, (_, k) => `<i class="nmsm" id="nmsm${k}" style="left:${n0(560 + Math.sin(k * 0.9) * 90 - k * 6)}px;top:${n0(1380 - k * 38)}px;width:${n0(30 - k * 1.3)}px;height:${n0(30 - k * 1.3)}px"></i>`).join('');
  const html = `
<div id="nmcam">${street('m2')}</div>
<div id="nmdark"></div>
${arrows.map(([x, y, k, r], i) => `<div class="nmar" id="nmar${i}" style="left:${x}px;top:${y}px;transform:rotate(${r}deg) scale(${k})"><svg viewBox="0 0 200 120"><path d="M10 64 Q60 52 130 60 L120 26 L190 66 L118 104 L128 76 Q60 74 12 82Z" fill="#f4f4f2" stroke="#f4f4f2" stroke-width="4" stroke-linejoin="round" opacity=".92"/></svg></div>`).join('')}
${trail}
<div id="nmdog">${DOG('nmdogsvg')}</div>
<div id="nmnose">*нюх-нюх*</div>
<div id="nmhard">ХАРДКОР</div>
<div class="gtitle mnm" id="nmtitle"><span>БЕЗ КАРТЫ</span></div>`;
  streetLife(c, 'm2', s, e + 0.5);
  A(`tl.set('#nmcam',{filter:'grayscale(.4) brightness(.75)'},${f3(s)});`);
  A(`tl.fromTo('#nmtitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${f3(z + 0.2)});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.fromTo('#nmcam',{scale:1.15},{scale:1,duration:${f3(e - s)},ease:'none'},${f3(s)});`);
  // «Нюх Тузика»: пёс опускает нос, след запаха светится и уходит вглубь улицы.
  const t1 = tm.sniff;
  A(`tl.fromTo('#nmdog',{x:-500},{x:0,duration:.4,ease:'power3.out'},${f3(t1 - 0.3)});`);
  A(`tl.to('#nmdogsvg',{rotation:6,svgOrigin:'300 240',duration:.15,yoyo:true,repeat:5},${f3(t1 + 0.1)});`);
  A(`tl.fromTo('#nmnose',{y:20,autoAlpha:0},{y:0,autoAlpha:1,duration:.2},${f3(t1 + 0.1)});`);
  A(`tl.to('#nmnose',{autoAlpha:0,duration:.2},${f3(t1 + 1.0)});`);
  for (let k = 0; k < 14; k++) A(`tl.fromTo('#nmsm${k}',{scale:0,opacity:0},{scale:1,opacity:.9,duration:.2,ease:'back.out(3)'},${f3(t1 + 0.15 + k * 0.05)});`);
  A(`tl.to('.nmsm',{opacity:.35,duration:.4,yoyo:true,repeat:${reps(t1, e, 0.4)}},${f3(t1 + 0.9)});`);
  sfx(t1, 'sniff');
  // «Стрелки на стенах»: мелом, одна за другой.
  arrows.forEach((_, i) => {
    const t = tm.arrows + i * 0.16;
    A(`tl.fromTo('#nmar${i}',{clipPath:'inset(0 100% 0 0)',autoAlpha:1},{clipPath:'inset(0 0% 0 0)',duration:.18,ease:'power1.out'},${f3(t)});`);
    sfx(t, 'scratch');
  });
  A(`tl.fromTo('#nmhard',{scale:2.4,autoAlpha:0,rotation:5},{scale:1,autoAlpha:1,rotation:5,duration:.2,ease:'power4.in'},${f3(tm.arrows + 0.75)});`);
  shake(tm.arrows + 0.95, 14);
  sfx(tm.arrows + 0.93, 'stamp');
  return html;
}

// ═══════════ 3 — Старая карта: на ней улицы, которых больше нет ═══════════
export function oldmap(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const html = `
<div id="omdesk"></div>
<div id="ommap">
 <svg viewBox="0 0 960 1100">
  <defs><radialGradient id="omg" cx="50%" cy="50%" r="70%"><stop offset="55%" stop-color="#e9d7a8"/><stop offset="100%" stop-color="#a9874e"/></radialGradient></defs>
  <rect width="960" height="1100" fill="url(#omg)"/>
  <path d="M320 0 V1100 M640 0 V1100 M0 366 H960 M0 733 H960" stroke="#8a6a3a" stroke-width="3" opacity=".5"/>
  <g fill="#cdb27c" stroke="#7a5a2e" stroke-width="3">
   ${Array.from({ length: 16 }, (_, k) => `<rect x="${60 + (k % 4) * 220}" y="${80 + Math.floor(k / 4) * 250}" width="170" height="190" rx="6"/>`).join('')}
  </g>
  <path d="M0 950 Q300 900 520 1000 T960 960" stroke="#6f9bb8" stroke-width="40" fill="none" opacity=".75"/>
  <g font-family="'PT Serif',Georgia,serif" font-size="30" fill="#4a3518" font-style="italic">
   <text x="250" y="72" transform="rotate(0)">ул. Садовая</text><text x="245" y="560" transform="rotate(-90 245 560)">пр. Мира</text>
   <text x="560" y="322">ул. Тихая</text><text x="700" y="1060">р. Светлая</text>
  </g>
  <text x="620" y="120" font-family="'PT Serif',Georgia,serif" font-size="34" fill="#5a3a18">ГОРОД · 1986</text>
  <path id="omroute" d="M120 1020 L262 1020 L262 572 L702 572 L702 318" stroke="#c1121f" stroke-width="10" stroke-dasharray="26 16" fill="none" stroke-dashoffset="0" opacity="0"/>
 </svg>
 ${STATIC('omst', 'blk')}
 <div id="ompin"><svg viewBox="0 0 80 110"><path d="M40 106 Q4 60 4 40 Q4 4 40 4 Q76 4 76 40 Q76 60 40 106Z" fill="#c1121f" stroke="#5a0a0a" stroke-width="4"/><circle cx="40" cy="40" r="14" fill="#fff"/></svg></div>
 <div id="omno">УЛИЦЫ НЕТ</div>
</div>
<div class="gtitle mom" id="omtitle"><span>СТАРАЯ КАРТА</span></div>`;
  A(`tl.fromTo('#omtitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${f3(z + 0.2)});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  // Карту разворачивают, маршрут ведёт к улице Тихой.
  A(`tl.fromTo('#ommap',{scaleY:.05,rotation:3},{scaleY:1,rotation:1,duration:.35,ease:'back.out(1.6)'},${f3(z + 0.05)});`);
  sfx(z + 0.05, 'whoosh');
  A(`tl.set('#omroute',{opacity:1},${f3(z + 0.5)});`);
  A(`tl.fromTo('#omroute',{strokeDashoffset:1400},{strokeDashoffset:0,duration:${f3(Math.max(0.5, tm.lie - z - 0.7))},ease:'none'},${f3(z + 0.5)});`);
  A(`tl.fromTo('#ompin',{y:-300,autoAlpha:0},{y:0,autoAlpha:1,duration:.3,ease:'bounce.out'},${f3(z + 0.4)});`);
  A(`tl.fromTo('#ommap',{scale:1},{scale:1.25,transformOrigin:'73% 30%',duration:${f3(e - z)},ease:'power1.in'},${f3(z + 0.4)});`);
  // «Улицы, которых больше нет»: квартал на карте рассыпается помехами, штамп.
  const t = tm.lie;
  A(`tl.fromTo('#omst',{autoAlpha:0,scale:.3},{autoAlpha:1,scale:1,duration:.35,ease:'power3.out'},${f3(t)});`);
  staticLoop(A, 'omst', t, e + 0.5);
  A(`tl.to('#ommap svg',{filter:'sepia(1) saturate(.4) brightness(.8)',duration:.3},${f3(t)});`);
  A(`tl.fromTo('#omno',{scale:2.6,autoAlpha:0,rotation:-8},{scale:1,autoAlpha:1,rotation:-8,duration:.22,ease:'power4.in'},${f3(t + 0.45)});`);
  shake(t + 0.67, 20);
  sfx(t, 'glitch');
  sfx(t + 0.65, 'stamp');
  sfx(t + 0.7, 'sting');
  return html;
}

export const MAP_CSS = `
.gtitle.mnb span{color:#1f4ea3;text-shadow:0 0 0 transparent,6px 6px 0 #fbf6e9}
.gtitle.mnm span{color:#f4f4f2;text-shadow:0 0 30px rgba(255,255,255,.5),7px 7px 0 #222}
.gtitle.mom span{color:#e9d7a8;text-shadow:0 0 30px rgba(233,215,168,.5),7px 7px 0 #4a3518}
.mst{position:absolute;z-index:3;overflow:hidden}
.mst i{position:absolute;inset:0;background:repeating-linear-gradient(0deg,#0b0b0e 0 3px,#2a2a33 3px 5px,#08080a 5px 9px),repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0 2px,rgba(0,0,0,0) 2px 7px);background-blend-mode:screen}
#nbdesk{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#5a3c26,#20140c 75%)}
#nbpage{position:absolute;left:70px;top:560px;width:940px;height:1100px;box-shadow:0 30px 80px rgba(0,0,0,.6);transform-origin:50% 50%}
#nbsvg{width:100%;height:100%}
#nbst.strip{left:60px;top:250px;width:820px;height:110px;transform-origin:0 50%;transform:scaleX(0)}
#nbgone{position:absolute;left:390px;top:180px;padding:6px 26px;border:9px solid #c1121f;border-radius:14px;color:#c1121f;font-family:Russo;font-size:84px;background:rgba(251,246,233,.85);opacity:0;visibility:hidden;z-index:4}
#nbpen{position:absolute;left:0;top:0;width:120px;height:520px;transform-origin:50% 98%;opacity:0;visibility:hidden;z-index:6;filter:drop-shadow(10px 20px 14px rgba(0,0,0,.5))}
#nbpen svg{width:100%;height:100%}
#nmcam{position:absolute;inset:0}
#nmdark{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 62%,rgba(0,0,0,0) 25%,rgba(0,0,0,.75) 75%);z-index:1}
.nmar{position:absolute;width:200px;height:120px;opacity:0;visibility:hidden;z-index:2;filter:drop-shadow(0 0 10px rgba(255,255,255,.5))}
.nmar svg{width:100%;height:100%}
.nmsm{position:absolute;border-radius:50%;background:radial-gradient(circle,#ffe08a,rgba(255,180,60,0) 70%);box-shadow:0 0 22px 8px rgba(255,200,90,.45);opacity:0;z-index:3}
#nmdog{position:absolute;left:300px;top:1300px;width:520px;height:340px;z-index:4}
#nmdog svg{width:100%;height:100%}
#nmnose{position:absolute;left:660px;top:1240px;font-family:Russo;font-size:52px;color:#ffe08a;-webkit-text-stroke:7px #111;paint-order:stroke fill;opacity:0;visibility:hidden;z-index:5}
#nmhard{position:absolute;left:0;right:0;margin:auto;top:640px;width:640px;text-align:center;padding:8px 0;border:12px solid #ff3b3b;border-radius:22px;color:#ff3b3b;background:rgba(14,15,19,.85);font-family:Russo;font-size:100px;opacity:0;visibility:hidden;z-index:6}
#omdesk{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#2b2a35,#0b0b10 75%)}
#ommap{position:absolute;left:60px;top:580px;width:960px;height:1100px;box-shadow:0 30px 80px rgba(0,0,0,.7);transform-origin:50% 50%}
#ommap>svg{width:100%;height:100%}
#omst.blk{left:520px;top:280px;width:400px;height:330px;border-radius:30px;opacity:0;visibility:hidden}
#ompin{position:absolute;left:662px;top:200px;width:80px;height:110px;opacity:0;visibility:hidden;z-index:4}
#ompin svg{width:100%;height:100%}
#omno{position:absolute;left:400px;top:400px;padding:6px 24px;border:10px solid #c1121f;border-radius:14px;color:#c1121f;font-family:Russo;font-size:78px;background:rgba(233,215,168,.9);white-space:nowrap;opacity:0;visibility:hidden;z-index:5}
`;
