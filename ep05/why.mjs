/**
 * Серия 5, выбор №5 «Почему город опустел?»: мини-сцены на весь экран — поезд с ядовитым грузом, все ушли в одну ночь,
 * город стирает людей. Устроено как genres.mjs: (ctx, tm) → HTML.
 */
import { street, streetLife } from './town.mjs';

let seed = 50505;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n0 = (v) => Math.round(v);
const reps = (from, to, period) => Math.max(1, Math.ceil((to - from) / period) + 2);

// ═══════════ 1 — поезд с ядовитым грузом ═══════════
export function train(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  let town = '';
  for (let x = -20; x < 1100; x += 90 + n0(rnd() * 40)) {
    const h = 140 + rnd() * 220, w = 70 + rnd() * 50;
    town += `<rect x="${x}" y="${1000 - h}" width="${w}" height="${h}" fill="#0b0d14"/>`;
    for (let wy = 1000 - h + 20; wy < 980; wy += 34) for (let wx = x + 12; wx < x + w - 14; wx += 26) if (rnd() < 0.45) town += `<rect class="trw" x="${wx}" y="${wy}" width="12" height="14" fill="#ffcf7a"/>`;
  }
  const tank = (k) => `<g class="tcar" id="tc${k}" transform="translate(${k * 330} 0)"><rect x="10" y="0" width="300" height="120" rx="58" fill="#8a948a" stroke="#2a302a" stroke-width="6"/>
    <rect x="10" y="52" width="300" height="10" fill="#6c766c"/><rect x="128" y="-18" width="64" height="22" rx="6" fill="#5c665c"/>
    <g transform="translate(160 62) rotate(45)"><rect x="-34" y="-34" width="68" height="68" fill="#ffd23f" stroke="#111" stroke-width="5"/></g>
    <text x="160" y="76" text-anchor="middle" font-family="Russo" font-size="30" fill="#111">ЯД</text>
    <rect x="30" y="122" width="260" height="22" fill="#1d201d"/><circle cx="70" cy="152" r="20" fill="#111"/><circle cx="250" cy="152" r="20" fill="#111"/></g>`;
  const html = `
<div class="tr-sky"></div>
<svg class="tw-svg" viewBox="0 0 1080 1920">${town}<rect y="1000" width="1080" height="920" fill="#0d0f0c"/>
 <polygon points="0,1180 1080,1180 1080,1260 0,1260" fill="#2a251e"/><g stroke="#8a8f96" stroke-width="7"><line x1="0" y1="1172" x2="1080" y2="1172"/><line x1="0" y1="1186" x2="1080" y2="1186"/></g></svg>
<div id="trn"><svg viewBox="0 0 1700 200" class="trsvg">
 <g transform="translate(0 20)"><rect x="0" y="10" width="300" height="130" rx="14" fill="#3a4a3a" stroke="#1a221a" stroke-width="6"/><rect x="200" y="-20" width="90" height="70" rx="8" fill="#2c3a2c"/><rect x="214" y="-6" width="60" height="34" fill="#ffd27a"/><circle cx="292" cy="96" r="14" fill="#fff6c8"/><circle cx="70" cy="160" r="20" fill="#111"/><circle cx="230" cy="160" r="20" fill="#111"/></g>
 <g transform="translate(330 30)">${[0, 1, 2, 3].map(tank).join('')}</g></svg></div>
<div id="trspark">${Array.from({ length: 16 }, (_, k) => `<i id="tsp${k}"></i>`).join('')}</div>
<div id="trgas">${[0, 1, 2, 3, 4, 5].map((k) => `<i id="tg${k}"></i>`).join('')}</div>
<div id="trred"></div>
<div class="gtitle wtrain" id="trtitle"><span>ПОЕЗД</span></div>`;
  A(`tl.fromTo('#trtitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  // Поезд идёт справа налево, вагоны покачиваются.
  A(`tl.fromTo('#trn',{x:700},{x:-560,duration:${(tm.derail - s).toFixed(2)},ease:'none'},${s});`);
  A(`tl.fromTo('.tcar',{y:0},{y:-4,duration:.12,yoyo:true,repeat:${reps(s, tm.derail, 0.12)}},${s});`);
  sfx(s, 'train', tm.derail - s + 0.4);
  // Сход с рельсов: вагоны заваливаются, искры, удар.
  const d = tm.derail;
  [0, 1, 2, 3].forEach((k) => A(`tl.to('#tc${k}',{rotation:${[18, -24, 32, -40][k]},y:${[40, 90, 60, 140][k]},x:'+=${30 + k * 20}',svgOrigin:'${k * 330 + 160} 60',duration:.45,ease:'power2.out'},${(d + k * 0.08).toFixed(3)});`));
  for (let k = 0; k < 16; k++) A(`tl.fromTo('#tsp${k}',{x:0,y:0,opacity:1},{x:${n0(rnd() * 700 - 350)},y:${n0(-100 - rnd() * 300)},opacity:0,duration:.6,ease:'power2.out'},${(d + rnd() * 0.3).toFixed(3)});`);
  A(`tl.fromTo('#gflash',{opacity:.6,background:'#fff3c0'},{opacity:0,duration:.3,immediateRender:false},${d + 0.05});`);
  shake(d + 0.05, 34);
  sfx(d, 'boom');
  sfx(d + 0.05, 'screech');
  // Облако накрывает город: окна гаснут, тревога.
  [0, 1, 2, 3, 4, 5].forEach((k) => A(`tl.fromTo('#tg${k}',{scale:.2,opacity:0,x:0,y:0},{scale:${(2.2 + k * 0.5).toFixed(1)},opacity:.85,x:${n0((k - 2.5) * 140)},y:${n0(-160 - k * 70)},duration:${(e - d + 0.3).toFixed(2)},ease:'power1.out'},${(d + 0.2 + k * 0.1).toFixed(3)});`));
  A(`tl.to('.trw',{opacity:0,duration:.05,stagger:{each:.012,from:'random'}},${tm.cloud - 0.2});`);
  A(`tl.fromTo('#trred',{opacity:0},{opacity:.4,duration:.3,yoyo:true,repeat:5},${tm.cloud - 0.2});`);
  sfx(tm.cloud - 0.2, 'siren', e - tm.cloud + 0.6);
  return html;
}

// ═══════════ 2 — все ушли в одну ночь ═══════════
export function leftall(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const steam = Array.from({ length: 8 }, (_, k) => `<i class="lfst" id="lfs${k}" style="left:${[330, 360, 520, 545, 700, 728, 345, 715][k]}px"></i>`).join('');
  const html = `
<div id="lfroom"><svg class="tw-svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#2a3230"/>
 ${Array.from({ length: 18 }, (_, k) => `<rect x="${k * 60}" y="300" width="4" height="900" fill="#323b38"/>`).join('')}
 <rect y="1200" width="1080" height="720" fill="#1e1915"/>
 <rect x="90" y="520" width="300" height="300" fill="#0a0f1a" stroke="#4a3a2a" stroke-width="14"/><path d="M240 520 V820 M90 670 H390" stroke="#4a3a2a" stroke-width="8"/><circle cx="320" cy="580" r="26" fill="#d8d4c0"/>
 <circle cx="560" cy="560" r="64" fill="#e8e2d0" stroke="#3a2a1a" stroke-width="8"/><path d="M560 560 L560 516 M560 560 L590 584" stroke="#111" stroke-width="7" stroke-linecap="round"/>
 <rect x="640" y="500" width="110" height="140" fill="#d8d0b8"/><rect x="640" y="500" width="110" height="34" fill="#c1121f"/><text x="695" y="610" text-anchor="middle" font-family="Russo" font-size="54" fill="#111">13</text>
 <path d="M120 1090 L960 1090 L1010 1180 L70 1180Z" fill="#5a4030"/><rect x="110" y="1180" width="24" height="200" fill="#3a2a1e"/><rect x="946" y="1180" width="24" height="200" fill="#3a2a1e"/>
 ${[[340, 1080], [535, 1076], [715, 1080]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="78" ry="20" fill="#e8e6dc"/><ellipse cx="${x}" cy="${y - 6}" rx="52" ry="12" fill="#b2541f"/>`).join('')}
 <rect x="440" y="1030" width="40" height="52" rx="6" fill="#d8d8e0"/><path d="M820 1080 L860 1040 L900 1080Z" fill="#c9a060"/>
 <path d="M160 1300 L250 1160 L330 1180 L250 1330Z" fill="#3a2a1e"/><path d="M820 1420 L760 1270 L840 1250 L900 1400Z" fill="#3a2a1e"/>
</svg>
 ${steam}
 <div id="lfdoor"><i></i></div><div id="lfwind"></div></div>
<div class="gtitle wleft" id="lftitle"><span>ВСЕ УШЛИ</span></div>`;
  A(`tl.fromTo('#lftitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  for (let k = 0; k < 8; k++) A(`tl.fromTo('#lfs${k}',{y:0,opacity:0,scaleX:.6},{keyframes:[{y:-60,opacity:.6,scaleX:1,duration:.5},{y:-180,opacity:0,scaleX:1.6,duration:.8}],repeat:${reps(s, e, 1.3)}},${(s + k * 0.17).toFixed(3)});`);
  sfx(s, 'buzz', e - s + 0.4);
  sfx(s, 'ticks', e - s);
  A(`tl.fromTo('#lfroom',{scale:1},{scale:1.35,duration:.8,ease:'power2.inOut',transformOrigin:'540px 1060px'},${tm.food - 0.1});`);
  A(`tl.to('#lfroom',{scale:1,duration:.6,ease:'power2.inOut'},${tm.doors - 0.25});`);
  A(`tl.fromTo('#lfdoor i',{rotationY:0},{rotationY:-70,duration:.9,ease:'power2.out'},${tm.doors});`);
  A(`tl.fromTo('#lfwind',{opacity:0},{opacity:1,duration:.4},${tm.doors + 0.1});`);
  shake(tm.doors + 0.1, 10);
  sfx(tm.doors, 'creak');
  sfx(tm.doors + 0.1, 'wind', e - tm.doors + 0.5);
  return html;
}

// ═══════════ 3 — город стирает людей ═══════════
export function erase(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const P = [[160, 1060, 1.1], [330, 1000, 0.8], [520, 960, 0.6], [690, 990, 0.75], [860, 1050, 1.05]];
  const people = P.map(([x, y, k], i) => `<div class="erp" id="erp${i}" style="left:${n0(x - 60 * k)}px;top:${n0(y - 300 * k)}px;width:${n0(120 * k)}px;height:${n0(300 * k)}px">
    <svg viewBox="0 0 120 300"><circle cx="60" cy="34" r="26" fill="#0a090c"/><path d="M28 70 Q60 58 92 70 L100 200 L86 300 L66 300 L60 210 L54 300 L34 300 L20 200Z" fill="#0a090c"/></svg>
    ${Array.from({ length: 10 }, (_, q) => `<b id="erb${i}_${q}" style="left:${n0(rnd() * 100)}%;top:${n0(rnd() * 100)}%"></b>`).join('')}</div>`).join('');
  const html = `
<div id="ercam">${street('e')}</div>
${people}
<div id="erhand"><img src="pf1.png"><div id="ererase"></div></div>
<div id="ernoise"></div>
<div class="gtitle werase" id="ertitle"><span>СТИРАЕТ</span></div>`;
  streetLife(c, 'e', s, e + 0.5);
  A(`tl.fromTo('#ertitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  // Люди стираются один за другим: срез снизу вверх, пиксели улетают.
  P.forEach((_, i) => {
    const t = tm.erase + i * 0.2;
    A(`tl.fromTo('#erp${i} svg',{clipPath:'inset(0% 0 0% 0)'},{clipPath:'inset(0% 0 100% 0)',duration:.35,ease:'none'},${t.toFixed(3)});`);
    for (let q = 0; q < 10; q++) A(`tl.fromTo('#erb${i}_${q}',{opacity:1,y:0,x:0},{opacity:0,y:${-80 - n0(rnd() * 120)},x:${n0(rnd() * 60 - 30)},duration:.5},${(t + rnd() * 0.3).toFixed(3)});`);
    sfx(t, 'glitch');
  });
  // «Как стёр твою память»: ладонь с надписью — надпись стирается.
  const m = tm.memory;
  A(`tl.fromTo('#erhand',{autoAlpha:0,scale:1.15},{autoAlpha:1,scale:1,duration:.25},${m - 0.2});`);
  A(`tl.fromTo('#ererase',{clipPath:'inset(0% 100% 0% 0%)'},{clipPath:'inset(0% 0% 0% 0%)',duration:.8,ease:'power1.inOut'},${m + 0.15});`);
  A(`tl.fromTo('#ernoise',{opacity:0},{keyframes:[{opacity:.6,duration:.05},{opacity:.1,duration:.05},{opacity:.5,duration:.05},{opacity:0,duration:.1}],repeat:2},${m + 0.2});`);
  shake(m + 0.2, 16);
  sfx(m + 0.15, 'glitch');
  sfx(m + 0.3, 'sting');
  return html;
}

export const WHY_CSS = `
.gtitle.wtrain span{color:#ffd23f;text-shadow:0 0 30px rgba(255,210,60,.6),7px 7px 0 #3a2a00}
.gtitle.wleft span{color:#f0e6d0;text-shadow:0 0 30px rgba(0,0,0,.8),7px 7px 0 #3a2a1a}
.gtitle.werase span{color:#e8ffff;text-shadow:4px 0 #ff0040,-4px 0 #00e5ff,0 0 30px rgba(255,255,255,.4)}
.tr-sky{position:absolute;left:0;right:0;top:0;height:1000px;background:linear-gradient(#05060c,#121625 60%,#1c2230)}
#trn{position:absolute;left:0;top:1000px;width:1700px;height:200px}
.trsvg{width:1700px;height:200px;overflow:visible}
#trspark{position:absolute;left:540px;top:1170px}
#trspark i{position:absolute;width:8px;height:8px;border-radius:50%;background:#ffd27a;box-shadow:0 0 12px #ff8a1f;opacity:0}
#trgas{position:absolute;left:540px;top:1150px}
#trgas i{position:absolute;left:-200px;top:-200px;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(190,220,90,.85),rgba(150,190,60,.45) 45%,rgba(150,190,60,0) 70%);opacity:0}
#trred{position:absolute;inset:0;background:radial-gradient(ellipse,rgba(255,0,0,0),rgba(200,0,0,.6));opacity:0}
#lfroom{position:absolute;inset:0}
.lfst{position:absolute;top:1020px;width:30px;height:90px;border-radius:50%;background:radial-gradient(ellipse,rgba(240,240,240,.7),rgba(240,240,240,0) 70%);opacity:0}
#lfdoor{position:absolute;left:820px;top:640px;width:220px;height:560px;background:#050505;perspective:900px}
#lfdoor i{position:absolute;inset:0;background:linear-gradient(90deg,#5a4030,#4a3426);border:6px solid #2a1d14;transform-origin:100% 50%}
#lfwind{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0) 60%,rgba(10,20,40,.55));opacity:0}
#ercam{position:absolute;inset:0}
.erp{position:absolute}
.erp svg{width:100%;height:100%}
.erp b{position:absolute;width:12px;height:12px;background:#9ff6ff;box-shadow:0 0 8px #4fd1ff;opacity:0}
#erhand{position:absolute;inset:0;opacity:0;visibility:hidden;z-index:4}
#erhand img{width:1080px;height:1920px;object-fit:cover;image-rendering:pixelated}
#ererase{position:absolute;left:-60px;top:1080px;width:1200px;height:680px;background:radial-gradient(ellipse 52% 48% at 50% 50%,#a97753 60%,rgba(169,119,83,0) 78%);clip-path:inset(0 100% 0 0)}
#ernoise{position:absolute;inset:0;opacity:0;z-index:5;background:repeating-linear-gradient(0deg,rgba(255,255,255,.2) 0 2px,rgba(0,0,0,.25) 2px 5px)}
`;
