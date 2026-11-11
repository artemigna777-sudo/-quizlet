/**
 * Серия 6: стирание (S3) и выбор №6 «Что защищает тебя от стирания?» — свет, фотографии, пёс.
 * Устроено как genres.mjs: (ctx, tm) → HTML, анимации и звуки уходят в таймлайн через ctx.
 */
import { street, streetLife } from './town.mjs';

let seed = 60606;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n0 = (v) => Math.round(v);
const reps = (from, to, period) => Math.max(1, Math.ceil((to - from) / period) + 2);

/** Помехи «стирания», которые наступают со всех сторон; дыра в центре растёт или сжимается (scale). */
const STATIC = (id) => `<div class="kst" id="${id}"><i></i></div>`;
const staticLoop = (A, id, s, e) => A(`tl.fromTo('#${id} i',{backgroundPosition:'0px 0px'},{backgroundPosition:'0px 60px',duration:.1,ease:'steps(3)',repeat:${reps(s, e, 0.1)}},${s});`);
/** Частицы-пиксели, разлетающиеся из точки. */
const pix = (pre, n, x, y, w, h) => Array.from({ length: n }, (_, k) => `<b class="kpx" id="${pre}${k}" style="left:${n0(x + rnd() * w)}px;top:${n0(y + rnd() * h)}px"></b>`).join('');
const pixFly = (A, pre, n, t, back = false) => {
  for (let k = 0; k < n; k++) {
    const dx = n0(rnd() * 160 - 80), dy = n0(-120 - rnd() * 240);
    A(back
      ? `tl.fromTo('#${pre}${k}',{x:${dx},y:${dy},opacity:0},{x:0,y:0,opacity:1,duration:.4,ease:'power2.in'},${(t + rnd() * 0.25).toFixed(3)});`
      : `tl.fromTo('#${pre}${k}',{x:0,y:0,opacity:1},{x:${dx},y:${dy},opacity:0,duration:.55,ease:'power2.out'},${(t + rnd() * 0.3).toFixed(3)});`);
  }
};

// ═══════════ S3: стирание приходит — звуки, цвета, ты ═══════════
export function erasing(c, tm) {
  const { A, sfx, shake } = c;
  const { s, e } = tm;
  const html = `
<div id="ekcam">${street('k')}</div>
<div id="ekwave"><svg viewBox="0 0 600 120"><path id="ekwp" d="M0 60 Q25 10 50 60 T100 60 T150 60 T200 60 T250 60 T300 60 T350 60 T400 60 T450 60 T500 60 T550 60 T600 60" stroke="#4fd1ff" stroke-width="6" fill="none"/></svg><b>ЗВУК</b></div>
<div id="ekhand"><img src="pf1.png">${pix('ekp', 40, 250, 900, 600, 700)}</div>
${STATIC('ekst')}
<div class="mixt" id="ekt">СТИРАНИЕ</div>`;
  streetLife(c, 'k', s, e + 0.5);
  staticLoop(A, 'ekst', s, e + 0.5);
  A(`tl.fromTo('#ekt',{scale:2.4,autoAlpha:0},{scale:1,autoAlpha:1,duration:.25,ease:'power4.in'},${s + 0.15});`);
  A(`tl.fromTo('#ekst',{scale:3.2,opacity:.9},{scale:1.2,duration:${(e - s).toFixed(2)},ease:'power1.in'},${s});`);
  sfx(s + 0.38, 'boom');
  // Исчезают звуки: волна звука выпрямляется в линию.
  A(`tl.fromTo('#ekwave',{autoAlpha:0,y:-30},{autoAlpha:1,y:0,duration:.25},${tm.sounds - 0.5});`);
  A(`tl.to('#ekwp',{attr:{d:'M0 60 Q25 60 50 60 T100 60 T150 60 T200 60 T250 60 T300 60 T350 60 T400 60 T450 60 T500 60 T550 60 T600 60'},stroke:'#55606a',duration:.6,ease:'power2.in'},${tm.sounds});`);
  // Исчезают цвета.
  A(`tl.to('#ekcam',{filter:'grayscale(1) contrast(1.15) brightness(.8)',duration:.5},${tm.colors});`);
  A(`tl.to('#ekwave',{autoAlpha:0,duration:.2},${tm.colors});`);
  sfx(tm.colors, 'glitch');
  // Потом — ты: ладонь распадается на пиксели.
  A(`tl.fromTo('#ekhand',{autoAlpha:0,scale:1.12},{autoAlpha:1,scale:1,duration:.25},${tm.you - 0.55});`);
  A(`tl.fromTo('#ekhand img',{clipPath:'inset(0% 0% 0% 0%)',filter:'grayscale(0)'},{clipPath:'inset(0% 0% 100% 0%)',filter:'grayscale(1)',duration:.7,ease:'power1.in'},${tm.you});`);
  pixFly(A, 'ekp', 40, tm.you);
  shake(tm.you + 0.1, 22);
  sfx(tm.you, 'glitch');
  sfx(tm.you + 0.2, 'sting');
  return html;
}

// ═══════════ 1 — свет ═══════════
export function light(c, tm) {
  const { A, sfx, stepper, shake } = c;
  const { s, z, e } = tm;
  const bat = [];
  for (let k = 0; k <= 10; k++) bat.push({ t: s + k * ((e - s) / 10), text: `${100 - k * 7}%` });
  const bhtml = stepper('lgb', bat, 'bat');
  const html = `
<div id="lgcam">${street('g')}</div>
<div id="lgdark"></div>
${STATIC('lgst')}
<div id="lgbeam"></div>
<div id="lgbat"><b></b>${bhtml}</div>
<div class="gtitle klight" id="lgtitle"><span>СВЕТ</span></div>`;
  streetLife(c, 'g', s, e + 0.5);
  staticLoop(A, 'lgst', s, e + 0.5);
  A(`tl.fromTo('#lgtitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.fromTo('#lgbeam',{rotation:-8},{rotation:8,duration:1,yoyo:true,repeat:${reps(s, e, 1)},ease:'sine.inOut'},${s});`);
  // Свет держит помехи на расстоянии; на «не видит» фонарь мигает — помехи бросаются, свет возвращается — отступают.
  A(`tl.fromTo('#lgst',{scale:2.2},{scale:2.0,duration:.6,yoyo:true,repeat:${reps(s, e, 0.6)},ease:'sine.inOut'},${s});`);
  const t = tm.blink;
  A(`tl.to('#lgbeam,#lgdark',{keyframes:[{opacity:.1,duration:.06},{opacity:1,duration:.06},{opacity:0,duration:.25},{opacity:1,duration:.06}]},${t});`);
  A(`tl.to('#lgst',{scale:1.05,duration:.25,ease:'power3.in'},${t + 0.1});`);
  A(`tl.to('#lgst',{scale:2.4,duration:.35,ease:'power3.out'},${t + 0.45});`);
  shake(t + 0.3, 18);
  sfx(t, 'flick');
  sfx(t + 0.3, 'glitch');
  sfx(t + 0.45, 'click');
  return html;
}

// ═══════════ 2 — воспоминания: фотографии ═══════════
export function photos(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const ph = [[150, 1010, -14], [420, 1060, 8], [700, 990, -6], [260, 1250, 12], [600, 1240, -10]];
  const photo = (k, [x, y, r]) => `<div class="kph" id="kph${k}" style="left:${x}px;top:${y}px;transform:rotate(${r}deg)"><svg viewBox="0 0 200 160"><rect width="200" height="160" fill="#c9c0a8"/><rect x="10" y="10" width="180" height="120" fill="#3d4a52"/>
    ${[40, 90, 140].slice(0, 2 + (k % 2)).map((cx, q) => `<circle cx="${cx}" cy="${62 - q * 4}" r="14" fill="#1a1c20"/><path d="M${cx - 22} 130 Q${cx} 74 ${cx + 22} 130Z" fill="#1a1c20"/>`).join('')}</svg></div>`;
  const html = `
<div id="kpbg"><svg class="tw-svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#1a1512"/>
 ${Array.from({ length: 12 }, (_, k) => `<rect x="0" y="${900 + k * 90}" width="1080" height="4" fill="#120e0b"/>`).join('')}</svg></div>
${ph.map((p, k) => photo(k, p)).join('')}
<div id="kpbig"><svg viewBox="0 0 200 160"><rect width="200" height="160" fill="#e8dfc6"/><rect x="10" y="10" width="180" height="120" fill="#5a6a72"/>
 <circle cx="70" cy="56" r="16" fill="#1a1c20"/><path d="M44 130 Q70 70 96 130Z" fill="#1a1c20"/><circle cx="130" cy="62" r="13" fill="#1a1c20"/><path d="M108 130 Q130 80 152 130Z" fill="#1a1c20"/>
 <path d="M150 110 Q160 96 176 104 L182 128 L146 128Z" fill="#2a1e14"/><text x="100" y="152" text-anchor="middle" font-family="Caveat,Montserrat" font-weight="700" font-size="20" fill="#3a2a1a">мы с тобой</text></svg></div>
<div id="kpglow"></div>
${STATIC('kpst')}
<div class="gtitle kmem" id="kptitle"><span>ПАМЯТЬ</span></div>`;
  A(`tl.fromTo('#kptitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  staticLoop(A, 'kpst', s, e + 0.5);
  A(`tl.fromTo('#kpst',{scale:1.6},{scale:1.1,duration:${(tm.photo - s).toFixed(2)},ease:'power1.in'},${s});`);
  A(`tl.fromTo('#kpbg,.kph',{filter:'grayscale(1)'},{filter:'grayscale(1)',duration:.1},${s});`);
  // «Каждая найденная фотография»: одна взлетает и приближается.
  const t = tm.photo;
  A(`tl.fromTo('#kpbig',{x:-120,y:240,rotation:-12,scale:.4,autoAlpha:0},{x:0,y:0,rotation:-3,scale:1,autoAlpha:1,duration:.5,ease:'back.out(1.4)'},${t});`);
  sfx(t, 'whoosh');
  // «Держит тебя в реальности»: помехи отступают, цвет возвращается.
  const r = tm.real;
  A(`tl.fromTo('#kpglow',{opacity:0,scale:.5},{opacity:1,scale:1.3,duration:.5},${r});`);
  A(`tl.to('#kpst',{scale:3.4,duration:.5,ease:'power3.out'},${r});`);
  A(`tl.to('#kpbg,.kph',{filter:'grayscale(0)',duration:.5},${r});`);
  shake(r + 0.1, 10);
  sfx(r, 'ding');
  sfx(r, 'sting');
  return html;
}

// ═══════════ 3 — пёс помнит тебя ═══════════
export function dogkeep(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const html = `
<div id="kdcam">${street('q')}</div>
${STATIC('kdst')}
<div id="kdman"><svg viewBox="0 0 160 420"><g fill="#2a2632" stroke="#cfe8ff" stroke-width="4"><circle cx="80" cy="48" r="32"/><path d="M40 92 Q80 78 120 92 L130 260 L112 410 L92 410 L82 280 L78 280 L68 410 L48 410 L30 260Z"/></g></svg>${pix('kdp', 30, 0, 0, 160, 420)}</div>
<svg id="kddog" viewBox="0 0 520 340"><g fill="#3a2a1e" stroke="#ffb066" stroke-width="3">
 <g id="kdtail"><path d="M80 150 Q30 110 40 60 Q60 110 96 140Z"/></g>
 <path d="M80 140 Q100 110 200 112 L330 110 Q360 100 380 80 L392 40 L410 76 L430 44 L440 92 Q480 110 498 140 Q500 160 470 164 L430 160 Q400 170 384 190 L370 230 L360 320 L340 320 L344 236 L250 240 L230 320 L210 320 L214 240 Q170 240 140 232 L120 320 L100 320 L104 228 Q80 200 80 140Z"/></g>
 <path d="M410 70 L430 100" stroke="#f0e0c8" stroke-width="5"/><circle cx="452" cy="112" r="6" fill="#111"/></svg>
<div id="kdheart"></div>
<div class="gtitle kdog" id="kdtitle"><span>ПЁС</span></div>`;
  streetLife(c, 'q', s, e + 0.5);
  staticLoop(A, 'kdst', s, e + 0.5);
  A(`tl.fromTo('#kdtitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.set('#kdcam',{filter:'grayscale(1) brightness(.8)'},${s});`);
  A(`tl.fromTo('#kdst',{scale:1.8},{scale:1.25,duration:${(tm.erase - s).toFixed(2)},ease:'power1.in'},${s});`);
  // «Город не может стереть»: человек начинает распадаться сверху.
  A(`tl.fromTo('#kdman svg',{clipPath:'inset(0% 0% 0% 0%)'},{clipPath:'inset(55% 0% 0% 0%)',duration:.6,ease:'power1.in'},${tm.erase});`);
  pixFly(A, 'kdp', 30, tm.erase);
  sfx(tm.erase, 'glitch');
  // Пёс прибегает (он единственный цветной), человек собирается обратно.
  A(`tl.fromTo('#kddog',{x:-700},{x:0,duration:.5,ease:'power3.out'},${tm.erase + 0.3});`);
  A(`tl.fromTo('#kdtail',{rotation:-14},{rotation:16,duration:.12,yoyo:true,repeat:${reps(s, e, 0.12)},svgOrigin:'90 145'},${s});`);
  sfx(tm.erase + 0.35, 'steps', 0.6);
  const r = tm.remember;
  A(`tl.to('#kdman svg',{clipPath:'inset(0% 0% 0% 0%)',duration:.5,ease:'power2.out'},${r});`);
  A(`tl.fromTo('#kdman',{filter:'drop-shadow(0 0 0px #ffd27a)'},{filter:'drop-shadow(0 0 30px #ffd27a)',duration:.4},${r + 0.2});`);
  pixFly(A, 'kdp', 30, r, true);
  A(`tl.to('#kdst',{scale:3.2,duration:.5,ease:'power3.out'},${r});`);
  A(`tl.to('#kdcam',{filter:'grayscale(.2) brightness(1)',duration:.5},${r});`);
  A(`tl.fromTo('#kdheart',{scale:0,opacity:0},{scale:1,opacity:1,duration:.3,ease:'back.out(3)'},${r + 0.1});`);
  A(`tl.to('#kdheart',{scale:1.2,duration:.15,yoyo:true,repeat:5},${r + 0.4});`);
  shake(r + 0.1, 10);
  sfx(r, 'ding');
  return html;
}

export const KEEP_CSS = `
.gtitle.klight span{color:#fff3c0;text-shadow:0 0 40px rgba(255,230,150,.8),7px 7px 0 #3a2a00}
.gtitle.kmem span{color:#ffe0b0;text-shadow:0 0 30px rgba(255,190,120,.6),7px 7px 0 #3a1e0a}
.gtitle.kdog span{color:#ffb066;text-shadow:0 0 30px rgba(255,140,60,.6),7px 7px 0 #3a1e0a}
.kst{position:absolute;inset:-200px;z-index:3;-webkit-mask-image:radial-gradient(circle at 50% 50%,transparent 0,transparent 230px,#000 380px);mask-image:radial-gradient(circle at 50% 50%,transparent 0,transparent 230px,#000 380px)}
.kst i{position:absolute;inset:0;background:repeating-linear-gradient(0deg,#0b0b0e 0 3px,#2a2a33 3px 5px,#08080a 5px 9px),repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 2px,rgba(0,0,0,0) 2px 7px);background-blend-mode:screen}
.kpx{position:absolute;width:14px;height:14px;background:#cfe8ff;box-shadow:0 0 8px #4fd1ff;opacity:0}
#ekcam,#lgcam,#kdcam{position:absolute;inset:0}
#ekwave{position:absolute;left:240px;top:560px;width:600px;text-align:center;opacity:0;visibility:hidden;z-index:5}
#ekwave svg{width:600px;height:120px}#ekwave b{font-family:Mono;font-size:30px;color:#9fe8ff}
#ekhand{position:absolute;inset:0;opacity:0;visibility:hidden;z-index:4}
#ekhand img{width:1080px;height:1920px;object-fit:cover;image-rendering:pixelated}
#ekt{top:350px;font-size:120px;color:#e8ffff;text-shadow:4px 0 #ff0040,-4px 0 #00e5ff,0 0 30px rgba(255,255,255,.4)}
#lgdark{position:absolute;inset:0;background:radial-gradient(ellipse 40% 30% at 50% 62%,rgba(0,0,0,0) 0,rgba(0,0,0,.75) 100%);z-index:2}
#lgbeam{position:absolute;left:290px;top:1150px;width:500px;height:800px;background:linear-gradient(rgba(255,240,200,.35),rgba(255,240,200,0) 85%);clip-path:polygon(44% 100%,56% 100%,100% 0,0 0);transform-origin:50% 100%;z-index:4}
#lgbat{position:absolute;left:70px;top:540px;width:200px;height:70px;border:5px solid #fff3c0;border-radius:12px;z-index:5}
#lgbat b{position:absolute;right:-16px;top:20px;width:10px;height:22px;background:#fff3c0;border-radius:3px}
.stp.bat{position:absolute;left:0;right:0;top:8px;height:50px}.stp.bat .sv{text-align:center;font-family:Mono;font-size:42px;color:#fff3c0}
#kpbg{position:absolute;inset:0}
.kph{position:absolute;width:220px;height:176px;box-shadow:0 10px 30px rgba(0,0,0,.6)}
.kph svg,#kpbig svg{width:100%;height:100%}
#kpbig{position:absolute;left:220px;top:560px;width:640px;height:512px;box-shadow:0 30px 80px rgba(0,0,0,.8);opacity:0;visibility:hidden;z-index:6}
#kpglow{position:absolute;left:40px;top:320px;width:1000px;height:1000px;border-radius:50%;background:radial-gradient(circle,rgba(255,210,140,.5),rgba(255,210,140,0) 65%);opacity:0;z-index:5}
#kdman{position:absolute;left:280px;top:820px;width:160px;height:420px;z-index:4}
#kdman svg{width:160px;height:420px}
#kddog{position:absolute;left:420px;top:1000px;width:420px;height:275px;z-index:5}
#kdheart{position:absolute;left:470px;top:700px;width:140px;height:126px;z-index:6;opacity:0;background:#ff4d6d;clip-path:path('M70 126 L10 66 Q-10 40 10 18 Q36 -6 70 26 Q104 -6 130 18 Q150 40 130 66Z');filter:drop-shadow(0 0 20px #ff4d6d)}
`;
