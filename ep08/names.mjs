/**
 * Серия 7: пёс — защита от стирания (S3) и выбор №7 «Как зовут пса?» — Шрам, Призрак, Тузик.
 * Устроено как genres.mjs: (ctx, tm) → HTML, анимации и звуки уходят в таймлайн через ctx.
 */
import { street, streetLife } from './town.mjs';

let seed = 70707;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n0 = (v) => Math.round(v);
const reps = (from, to, period) => Math.max(1, Math.ceil((to - from) / period) + 2);

const DOG = (id, fill = '#3a2a1e', stroke = '#ffb066') => `<svg id="${id}" viewBox="0 0 520 340"><g fill="${fill}" stroke="${stroke}" stroke-width="3">
 <g class="dtail"><path d="M80 150 Q30 110 40 60 Q60 110 96 140Z"/></g>
 <path d="M80 140 Q100 110 200 112 L330 110 Q360 100 380 80 L392 40 L410 76 L430 44 L440 92 Q480 110 498 140 Q500 160 470 164 L430 160 Q400 170 384 190 L370 230 L360 320 L340 320 L344 236 L250 240 L230 320 L210 320 L214 240 Q170 240 140 232 L120 320 L100 320 L104 228 Q80 200 80 140Z"/></g>
 <path d="M410 70 L430 100" stroke="#f0e0c8" stroke-width="5"/><circle cx="452" cy="112" r="6" fill="#111"/></svg>`;
const MAN = (id) => `<svg id="${id}" viewBox="0 0 160 420"><g fill="#2a2632" stroke="#cfe8ff" stroke-width="4"><circle cx="80" cy="48" r="32"/><path d="M40 92 Q80 78 120 92 L130 260 L112 410 L92 410 L82 280 L78 280 L68 410 L48 410 L30 260Z"/></g></svg>`;
const STATIC = (id) => `<div class="nst" id="${id}"><i></i></div>`;
const staticLoop = (A, id, s, e) => A(`tl.fromTo('#${id} i',{backgroundPosition:'0px 0px'},{backgroundPosition:'0px 60px',duration:.1,ease:'steps(3)',repeat:${reps(s, e, 0.1)}},${s});`);
const wag = (A, sel, s, e, origin = '90 145') => A(`tl.fromTo('${sel}',{rotation:-14},{rotation:16,duration:.12,yoyo:true,repeat:${reps(s, e, 0.12)},svgOrigin:'${origin}'},${s});`);

// ═══════════ S3: пёс держит стирание на расстоянии ═══════════
export function guard(c, tm) {
  const { A, sfx, shake } = c;
  const { s, e } = tm;
  const html = `
<div id="gdcam">${street('w')}</div>
<div id="gdaura"></div>
${STATIC('gdst')}
<div id="gdring"></div>
<div id="gdman">${MAN('gdmansvg')}</div>
<div id="gddog">${DOG('gddogsvg')}</div>
<div id="gdbark">ГАВ!</div>
<div class="mixt" id="gdt">НАПАРНИК</div>`;
  streetLife(c, 'w', s, e + 0.5);
  staticLoop(A, 'gdst', s, e + 0.5);
  wag(A, '#gddogsvg .dtail', s, e + 0.5);
  A(`tl.set('#gdcam',{filter:'grayscale(.85) brightness(.8)'},${s});`);
  A(`tl.fromTo('#gdt',{scale:2.4,autoAlpha:0},{scale:1,autoAlpha:1,duration:.25,ease:'power4.in'},${s + 0.15});`);
  sfx(s + 0.38, 'boom');
  A(`tl.fromTo('#gdst',{scale:2.2},{scale:1.7,duration:${(tm.attack - s).toFixed(2)},ease:'power1.in'},${s});`);
  A(`tl.fromTo('#gdaura',{opacity:.5,scale:.95},{opacity:.9,scale:1.05,duration:.5,yoyo:true,repeat:${reps(s, e, 0.5)}},${s});`);
  // Лай: кольцо отталкивает помехи.
  const bark = (t) => {
    A(`tl.fromTo('#gdbark',{scale:.4,opacity:1,y:0},{scale:1.3,opacity:0,y:-60,duration:.5,ease:'power2.out'},${t});`);
    A(`tl.fromTo('#gdring',{scale:.3,opacity:.9},{scale:3.2,opacity:0,duration:.6,ease:'power2.out'},${t});`);
    A(`tl.to('#gddog',{y:-10,duration:.08,yoyo:true,repeat:1},${t});`);
    sfx(t, 'bark');
  };
  bark(tm.bark);
  // «Город не может тебя стереть»: помехи бросаются — пёс лает — отступают, цвет возвращается.
  A(`tl.to('#gdst',{scale:1.1,duration:.35,ease:'power3.in'},${tm.attack});`);
  sfx(tm.attack, 'glitch');
  bark(tm.attack + 0.4);
  A(`tl.to('#gdst',{scale:3.4,duration:.45,ease:'power3.out'},${tm.attack + 0.45});`);
  A(`tl.to('#gdcam',{filter:'grayscale(.1) brightness(1)',duration:.5},${tm.attack + 0.45});`);
  shake(tm.attack + 0.45, 18);
  return html;
}

// ═══════════ 1 — Шрам: молния высвечивает шрам ═══════════
export function scar(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const rain = Array.from({ length: 40 }, (_, k) => `<i id="scr${k}" style="left:${n0(rnd() * 1080)}px;top:${n0(rnd() * 1920)}px"></i>`).join('');
  const html = `
<div id="scbg"></div>
<div id="scrain">${rain}</div>
<svg id="schead" viewBox="0 0 600 700"><g fill="#2e2219" stroke="#1a120c" stroke-width="6">
 <path d="M110 700 Q90 480 170 360 Q140 250 160 140 L210 40 L250 170 Q300 150 360 170 L420 60 L450 190 Q500 260 560 300 Q600 330 580 380 Q560 420 500 420 L460 430 Q420 470 400 560 L410 700Z"/></g>
 <ellipse cx="575" cy="345" rx="26" ry="20" fill="#111"/><path d="M500 420 Q520 440 545 430" stroke="#111" stroke-width="6" fill="none"/>
 <ellipse id="sceye" cx="420" cy="285" rx="20" ry="14" fill="#ffcf5a"/><circle cx="424" cy="285" r="7" fill="#111"/>
 <path id="scscar" d="M370 205 L405 255 L398 270 L440 320 L432 336 L462 372" stroke="#f3e6d6" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="260" stroke-dashoffset="260"/></svg>
<div id="scflash"></div>
<div id="scmem"><b>???</b></div>
<div class="gtitle nscar" id="sctitle"><span>ШРАМ</span></div>`;
  A(`tl.fromTo('#sctitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  for (let k = 0; k < 40; k++) A(`tl.fromTo('#scr${k}',{y:-200},{y:2100,duration:${(0.5 + rnd() * 0.3).toFixed(2)},ease:'none',repeat:${reps(s, e, 0.5)}},${(s - rnd()).toFixed(3)});`);
  sfx(s, 'waves', e - s + 0.4);
  A(`tl.fromTo('#schead',{x:60,scale:1.05},{x:0,scale:1,duration:${(e - s).toFixed(2)},ease:'none'},${s});`);
  // Молния: вспышка, шрам проступает и светится.
  const t = tm.reveal;
  A(`tl.to('#scflash',{keyframes:[{opacity:.9,duration:.04},{opacity:0,duration:.08},{opacity:.7,duration:.04},{opacity:0,duration:.25}]},${t});`);
  A(`tl.to('#scscar',{strokeDashoffset:0,duration:.35,ease:'power2.out'},${t + 0.05});`);
  A(`tl.to('#scscar',{stroke:'#ff7a2e',filter:'drop-shadow(0 0 12px #ff7a2e)',duration:.3},${t + 0.4});`);
  shake(t + 0.05, 22);
  sfx(t, 'boom');
  sfx(t + 0.02, 'glass');
  // «Никому не расскажет»: обрывки воспоминания мелькают и гаснут — тайна.
  A(`tl.fromTo('#scmem',{opacity:0},{keyframes:[{opacity:1,duration:.05},{opacity:0,duration:.06},{opacity:.8,duration:.05},{opacity:0,duration:.2}]},${tm.secret});`);
  A(`tl.to('#sceye',{attr:{ry:3},duration:.15,yoyo:true,repeat:1},${tm.secret + 0.35});`);
  sfx(tm.secret, 'glitch');
  sfx(tm.secret + 0.1, 'growl');
  return html;
}

// ═══════════ 2 — Призрак: виден в тумане и исчезает ═══════════
export function ghostdog(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const spots = [[160, 1020, 0.55], [640, 940, 0.4], [300, 900, 0.32], [720, 1080, 0.6]];
  const html = `
<div id="ghcam">${street('v')}</div>
<div id="ghfog"><i></i><i></i><i></i></div>
${spots.map(([x, y, k], i) => `<div class="ghd" id="ghd${i}" style="left:${x}px;top:${y}px;width:${n0(520 * k)}px;height:${n0(340 * k)}px">${DOG(`ghds${i}`, '#1a1a22', '#9fb0c8')}</div>`).join('')}
<div id="ghhand"><svg viewBox="0 0 400 500"><path d="M120 500 L140 300 Q130 220 160 200 Q190 190 196 240 L200 150 Q205 110 235 115 Q262 120 258 165 L262 140 Q270 108 296 115 Q320 122 316 165 L318 210 Q330 186 352 196 Q376 210 366 260 L346 380 L330 500Z" fill="#c99a78" stroke="#8a5f44" stroke-width="5"/></svg></div>
<div id="ghnear">${DOG('ghnearsvg', '#2a2620', '#e8d8c0')}</div>
<div class="gtitle nghost" id="ghtitle"><span>ПРИЗРАК</span></div>`;
  streetLife(c, 'v', s, e + 0.5);
  A(`tl.set('#ghcam',{filter:'grayscale(.6) brightness(.7) blur(1px)'},${s});`);
  A(`tl.fromTo('#ghtitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.fromTo('#ghfog i',{x:0},{x:-600,duration:6,ease:'none',stagger:1},${s});`);
  sfx(s, 'wind', e - s + 0.5);
  // В тумане: пёс то тут, то там — появляется и растворяется.
  spots.forEach((_, i) => {
    const t = tm.fog + i * 0.28;
    A(`tl.fromTo('#ghd${i}',{opacity:0},{keyframes:[{opacity:.85,duration:.12},{opacity:.85,duration:.06},{opacity:0,duration:.18}]},${t.toFixed(3)});`);
  });
  sfx(tm.fog, 'sting');
  // «Всегда рядом»: камера вниз — пёс прижимается к руке героя.
  A(`tl.fromTo('#ghhand',{y:800},{y:0,duration:.4,ease:'power3.out'},${tm.near});`);
  A(`tl.fromTo('#ghnear',{x:-500,opacity:0},{x:0,opacity:1,duration:.45,ease:'power3.out'},${tm.near + 0.1});`);
  wag(A, '#ghnearsvg .dtail', tm.near, e + 0.5);
  A(`tl.to('#ghcam',{filter:'grayscale(.2) brightness(.95) blur(0px)',duration:.4},${tm.near + 0.1});`);
  sfx(tm.near + 0.2, 'sniff');
  return html;
}

// ═══════════ 3 — Тузик: да, в хорроре ═══════════
export function tuzik(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const hearts = Array.from({ length: 8 }, (_, k) => `<i class="tzh" id="tzh${k}"></i>`).join('');
  const html = `
<div id="tzcam">${street('t2')}</div>
<div id="tzdark"></div>
<div id="tzeyes"><i></i><i></i></div>
<div id="tzdog">${DOG('tzdogsvg', '#c9925a', '#5a3a1e')}</div>
<div id="tzbark">ГАВ!</div>
${hearts}
<div id="tzwink">😉</div>
<div class="gtitle ntuz" id="tztitle"><span>ТУЗИК</span></div>`;
  streetLife(c, 't2', s, e + 0.5);
  A(`tl.fromTo('#tztitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  sfx(z + 0.48, 'boom');
  sfx(s, 'drone', tm.bark - s);
  // Страшно: тьма, из темноты горят глаза…
  A(`tl.fromTo('#tzeyes',{opacity:0,scale:.6},{opacity:1,scale:1,duration:.3},${z + 0.1});`);
  sfx(z + 0.1, 'heart');
  // …а это Тузик: гав, свет, хвост, сердечки.
  const t = tm.bark;
  A(`tl.to('#tzdark,#tzeyes',{opacity:0,duration:.15},${t});`);
  A(`tl.fromTo('#tzdog',{scale:.3,y:200,opacity:0},{scale:1,y:0,opacity:1,duration:.3,ease:'back.out(2.5)'},${t});`);
  A(`tl.fromTo('#tzbark',{scale:.3,opacity:0,rotation:-20},{scale:1,opacity:1,rotation:-8,duration:.2,ease:'back.out(3)'},${t + 0.05});`);
  A(`tl.to('#tzbark',{opacity:0,scale:1.4,duration:.3},${t + 0.6});`);
  wag(A, '#tzdogsvg .dtail', t, e + 0.5);
  A(`tl.to('#tzdog',{y:-26,duration:.15,yoyo:true,repeat:5,ease:'power1.out'},${t + 0.35});`);
  for (let k = 0; k < 8; k++) A(`tl.fromTo('#tzh${k}',{x:0,y:0,opacity:1,scale:.4},{x:${n0(rnd() * 360 - 180)},y:${n0(-200 - rnd() * 260)},opacity:0,scale:1.3,duration:.9,ease:'power1.out'},${(t + 0.2 + k * 0.06).toFixed(3)});`);
  shake(t + 0.05, 14);
  sfx(t, 'scratch');
  sfx(t + 0.05, 'bark');
  // «Именно поэтому» — подмигивание.
  A(`tl.fromTo('#tzwink',{scale:0,rotation:-30},{scale:1,rotation:0,duration:.3,ease:'back.out(3)'},${tm.wink});`);
  sfx(tm.wink, 'pop');
  return html;
}

export const NAMES_CSS = `
.gtitle.nscar span{color:#ffb066;text-shadow:0 0 30px rgba(255,122,46,.6),7px 7px 0 #3a1e0a}
.gtitle.nghost span{color:#dfe8f4;text-shadow:0 0 34px rgba(200,220,255,.8),7px 7px 0 #1a2030}
.gtitle.ntuz span{color:#ffd23f;text-shadow:0 0 30px rgba(255,210,60,.6),7px 7px 0 #5a3a00}
.nst{position:absolute;inset:-200px;z-index:3;-webkit-mask-image:radial-gradient(circle at 46% 56%,transparent 0,transparent 230px,#000 380px);mask-image:radial-gradient(circle at 46% 56%,transparent 0,transparent 230px,#000 380px)}
.nst i{position:absolute;inset:0;background:repeating-linear-gradient(0deg,#0b0b0e 0 3px,#2a2a33 3px 5px,#08080a 5px 9px),repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 2px,rgba(0,0,0,0) 2px 7px);background-blend-mode:screen}
#gdcam,#ghcam,#tzcam{position:absolute;inset:0}
#gdaura{position:absolute;left:190px;top:700px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,120,.35),rgba(255,200,120,0) 65%);z-index:2}
#gdring{position:absolute;left:400px;top:900px;width:240px;height:240px;border-radius:50%;border:10px solid rgba(255,210,140,.8);opacity:0;z-index:4}
#gdman{position:absolute;left:300px;top:840px;width:160px;height:420px;z-index:5}
#gdman svg{width:160px;height:420px}
#gddog{position:absolute;left:430px;top:1010px;width:400px;height:262px;z-index:5}
#gddog svg,.ghd svg,#ghnear svg,#tzdog svg{width:100%;height:100%}
#gdbark,#tzbark{position:absolute;left:640px;top:900px;font-family:Russo;font-size:80px;color:#fff;-webkit-text-stroke:8px #111;paint-order:stroke fill;opacity:0;z-index:6}
#gdt{top:350px;font-size:116px;color:#ffb066;text-shadow:0 8px 0 #3a1e0a,0 0 40px rgba(255,140,60,.5)}
#scbg{position:absolute;inset:0;background:radial-gradient(ellipse at 60% 45%,#1a2230,#06080c 70%)}
#scrain i{position:absolute;width:3px;height:90px;background:linear-gradient(rgba(180,200,230,0),rgba(180,200,230,.6))}
#schead{position:absolute;left:120px;top:560px;width:840px;height:980px;z-index:2}
#scflash{position:absolute;inset:0;background:#e8f0ff;opacity:0;z-index:3;mix-blend-mode:screen}
#scmem{position:absolute;left:0;right:0;top:640px;text-align:center;opacity:0;z-index:4}
#scmem b{display:inline-block;padding:10px 40px;background:#c1121f;font-family:Russo;font-size:110px;color:#fff;transform:rotate(-4deg)}
#ghfog{position:absolute;inset:0;z-index:3;pointer-events:none}
#ghfog i{position:absolute;left:-200px;width:2400px;height:420px;background:radial-gradient(ellipse at 30% 50%,rgba(200,210,225,.35),rgba(200,210,225,0) 60%),radial-gradient(ellipse at 75% 50%,rgba(200,210,225,.3),rgba(200,210,225,0) 55%)}
#ghfog i:nth-child(1){top:800px}#ghfog i:nth-child(2){top:1000px}#ghfog i:nth-child(3){top:1180px}
.ghd{position:absolute;opacity:0;z-index:2;filter:drop-shadow(0 0 12px rgba(200,220,255,.6))}
.ghd svg circle{fill:#bfe8ff}
#ghhand{position:absolute;left:180px;top:1250px;width:400px;height:500px;z-index:5}
#ghhand svg{width:100%;height:100%}
#ghnear{position:absolute;left:420px;top:1150px;width:520px;height:340px;opacity:0;z-index:4}
#tzdark{position:absolute;inset:0;background:rgba(0,0,0,.82);z-index:2}
#tzeyes{position:absolute;left:470px;top:1040px;z-index:3;opacity:0}
#tzeyes i{position:absolute;width:30px;height:18px;border-radius:50%;background:#ff3030;box-shadow:0 0 24px 8px rgba(255,40,40,.7)}#tzeyes i:nth-child(2){left:70px}
#tzdog{position:absolute;left:280px;top:1000px;width:520px;height:340px;opacity:0;z-index:4;transform-origin:50% 100%}
#tzbark{left:620px;top:860px;color:#ffd23f}
.tzh{position:absolute;left:540px;top:1060px;width:60px;height:54px;background:#ff4d6d;clip-path:path('M30 54 L4 28 Q-4 14 6 6 Q18 -4 30 10 Q42 -4 54 6 Q64 14 56 28Z');opacity:0;z-index:5}
#tzwink{position:absolute;left:760px;top:640px;font-size:150px;transform:scale(0);z-index:6}
`;
