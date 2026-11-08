/**
 * Серия 4, выбор №4 «Кто такой Стрелок?»: мини-сцены на весь экран — «ты сам» (зеркало), «охотник в противогазе»,
 * «тень, которая появляется, когда гаснет свет». Устроено как genres.mjs: (ctx, tm) → HTML.
 */
import { street, streetLife } from './town.mjs';

let seed = 40404;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n0 = (v) => Math.round(v);
const reps = (from, to, period) => Math.max(1, Math.ceil((to - from) / period) + 2);

const MASK = `<g id="__ID__"><path d="M74 96 Q100 84 126 96 L130 140 Q100 158 70 140Z" fill="#2a2c26" stroke="#111" stroke-width="3"/>
 <circle cx="86" cy="104" r="11" fill="#300" stroke="#555" stroke-width="4"/><circle cx="114" cy="104" r="11" fill="#300" stroke="#555" stroke-width="4"/>
 <circle class="mk-eye" cx="86" cy="104" r="7" fill="#ff2a2a"/><circle class="mk-eye" cx="114" cy="104" r="7" fill="#ff2a2a"/>
 <rect x="88" y="134" width="24" height="26" rx="6" fill="#3a3c34" stroke="#111" stroke-width="3"/></g>`;

// ═══════════ 1 — ты сам: отражение в треснувшем зеркале ═══════════
export function self(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  let tiles = '';
  for (let x = 0; x < 1080; x += 90) for (let y = 300; y < 1920; y += 90) tiles += `<rect x="${x + 3}" y="${y + 3}" width="84" height="84" fill="#1a2224" opacity="${(0.6 + rnd() * 0.4).toFixed(2)}"/>`;
  const cracks = ['M300 300 L240 210 L250 120 L200 40', 'M300 300 L390 230 L470 250 L560 160', 'M300 300 L330 420 L280 520 L320 600', 'M300 300 L180 340 L90 300 L20 360', 'M300 300 L420 380 L520 470', 'M300 300 L260 400 L160 470']
    .map((d, k) => `<path class="sfcr" id="sfc${k}" d="${d}" stroke="#e8f4ff" stroke-width="4" fill="none" stroke-dasharray="400" stroke-dashoffset="400"/>`).join('');
  const shards = Array.from({ length: 10 }, (_, k) => `<i class="sfsh" id="sfs${k}" style="left:${n0(300 + rnd() * 480)}px;top:${n0(640 + rnd() * 420)}px"></i>`).join('');
  const html = `
<svg class="tw-svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#0d1314"/>${tiles}<rect y="1260" width="1080" height="660" fill="#101616"/></svg>
<div id="sfmirror"><div class="sfin"><svg viewBox="0 0 600 600" class="sfroom"><rect width="600" height="600" fill="#0a0f10"/><rect x="420" y="80" width="120" height="260" fill="#050707" stroke="#1a2224" stroke-width="6"/>
 <g id="sfme"><circle cx="300" cy="250" r="78" fill="#1a1512"/><path d="M150 600 Q160 380 300 360 Q440 380 450 600Z" fill="#141210"/>
  <circle cx="272" cy="248" r="7" fill="#c8c0b0"/><circle cx="328" cy="248" r="7" fill="#c8c0b0"/>
  <g transform="translate(200 160)">${MASK.replace('__ID__', 'sfmask')}</g></g></svg>
 <div id="sffog">ЭТО ТЫ</div>
 <svg viewBox="0 0 600 600" class="sfcracks">${cracks}</svg></div></div>
<svg class="tw-svg" viewBox="0 0 1080 1920"><path d="M120 1260 L960 1260 L900 1420 L180 1420Z" fill="#c9d1d2"/><ellipse cx="540" cy="1300" rx="220" ry="36" fill="#8e9a9c"/><rect x="520" y="1170" width="40" height="90" fill="#7f8a8c"/></svg>
${shards}
<div id="sflight"></div>
<div class="gtitle wself" id="sftitle"><span>ТЫ САМ</span></div>`;
  A(`tl.fromTo('#sftitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.fromTo('#sfme',{x:-6},{x:6,duration:.9,yoyo:true,repeat:${reps(s, e, 0.9)},ease:'sine.inOut'},${s});`);
  A(`tl.to('#sflight',{opacity:.35,duration:.07,yoyo:true,repeat:${reps(s, e, 0.6)},repeatDelay:.5,ease:'steps(1)'},${s});`);
  sfx(s, 'buzz', e - s + 0.5);
  // «Ты сам»: на отражении проступает противогаз, на запотевшем стекле — надпись.
  A(`tl.fromTo('#sfmask',{opacity:0},{keyframes:[{opacity:1,duration:.05},{opacity:0,duration:.05},{opacity:1,duration:.06}]},${tm.you});`);
  A(`tl.fromTo('#sffog',{opacity:0,clipPath:'inset(0 100% 0 0)'},{opacity:1,clipPath:'inset(0 0% 0 0)',duration:.6,ease:'none'},${tm.you + 0.15});`);
  A(`tl.to('#sfme',{rotation:-8,svgOrigin:'300 360',duration:.4},${tm.you + 0.2});`);
  sfx(tm.you, 'sting');
  // «Поэтому ты всё и забыл»: трещины, осколки летят в камеру.
  const t = tm.forgot;
  A(`tl.to('.sfcr',{strokeDashoffset:0,duration:.25,stagger:.04,ease:'power2.out'},${t});`);
  for (let k = 0; k < 10; k++) A(`tl.fromTo('#sfs${k}',{opacity:0,scale:.3,rotation:0,x:0,y:0},{opacity:1,scale:${(1.5 + rnd() * 2).toFixed(2)},rotation:${n0(rnd() * 360 - 180)},x:${n0(rnd() * 600 - 300)},y:${n0(rnd() * 500 - 150)},duration:.45,ease:'power2.out'},${(t + 0.25).toFixed(3)});`);
  A(`tl.fromTo('#gflash',{opacity:.5,background:'#e8f4ff'},{opacity:0,duration:.3,immediateRender:false},${t + 0.25});`);
  shake(t + 0.25, 28);
  sfx(t, 'glass');
  sfx(t + 0.25, 'boom');
  return html;
}

// ═══════════ 2 — охотник в противогазе ═══════════
export function hunter(c, tm) {
  const { A, sfx, stepper, shake } = c;
  const { s, z, e } = tm;
  const nights = [];
  for (let k = 0; k <= 9; k++) nights.push({ t: tm.night + k * 0.12, text: `НОЧЬ ${k + 1}` });
  const nhtml = stepper('hnn', [{ t: s, text: 'НОЧЬ 1' }, ...nights], 'night');
  const html = `
<div id="hncam">${street('h')}</div>
<svg class="tw-svg" viewBox="0 0 1080 1920"><g id="hnx" fill="none" stroke="#c1121f" stroke-width="10" stroke-linecap="round">
 <path class="hnx" d="M110 1150 L170 1230 M170 1150 L110 1230"/><path class="hnx" d="M905 1140 L965 1220 M965 1140 L905 1220"/><path class="hnx" d="M300 1030 L336 1080 M336 1030 L300 1080"/></g></svg>
<div id="hnman"><svg viewBox="0 0 200 520"><path d="M100 30 a40 40 0 1 0 .1 0 M48 110 Q100 90 152 110 L170 330 Q176 450 150 510 L50 510 Q24 450 30 330Z" fill="#0b0b0d"/>
 <path d="M40 300 Q40 240 60 200" stroke="#0b0b0d" stroke-width="28" fill="none"/><path d="M150 140 L196 330" stroke="#1d1a16" stroke-width="12"/>
 <g transform="translate(0 -40)">${MASK.replace('__ID__', 'hnmask')}</g></svg><div id="hnlant"></div></div>
<div id="hnbeam"></div>
<div id="hnnight">${nhtml}</div>
<div class="gtitle whunt" id="hntitle"><span>ОХОТНИК</span></div>`;
  streetLife(c, 'h', s, e + 0.5);
  A(`tl.fromTo('#hntitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.fromTo('#hnman',{scale:.35,y:0},{scale:1.25,y:260,duration:${(e - s + 0.3).toFixed(2)},ease:'power1.in'},${s});`);
  A(`tl.fromTo('#hnman',{rotation:-2},{rotation:2,duration:.45,yoyo:true,repeat:${reps(s, e, 0.45)},ease:'sine.inOut'},${s});`);
  A(`tl.fromTo('#hnlant',{rotation:-18},{rotation:18,duration:.45,yoyo:true,repeat:${reps(s, e, 0.45)},ease:'sine.inOut'},${s});`);
  A(`tl.fromTo('#hnbeam',{rotation:-25},{rotation:25,duration:1.1,yoyo:true,repeat:${reps(s, e, 1.1)},ease:'sine.inOut'},${s});`);
  sfx(s, 'steps', e - s + 0.3);
  sfx(s, 'wind', e - s + 0.5);
  // «Каждую ночь»: счётчик ночей, «забирает людей» — гаснет окно, на дверях кресты.
  A(`tl.fromTo('#hnnight',{scale:.5,opacity:0},{scale:1,opacity:1,duration:.25,ease:'back.out(2)'},${tm.night - 0.1});`);
  sfx(tm.night, 'ticks', 1.2);
  A(`tl.to('#hlit',{fill:'#07060a',duration:.05},${tm.take});`);
  A(`tl.to('.hnx',{opacity:1,duration:.05,stagger:.18},${tm.take + 0.1});`);
  A(`tl.fromTo('#gflash',{opacity:.35,background:'#ff2020'},{opacity:0,duration:.3,immediateRender:false},${tm.take});`);
  shake(tm.take + 0.05, 20);
  sfx(tm.take, 'scream');
  return html;
}

// ═══════════ 3 — тень, когда гаснет свет ═══════════
export function shadow(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const html = `
<div id="shroom"><svg class="tw-svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#3a2d22"/><rect y="1240" width="1080" height="680" fill="#24190f"/>
 <rect x="120" y="560" width="300" height="380" fill="#1a1410" stroke="#5a4532" stroke-width="10"/><path d="M270 560 V940 M120 750 H420" stroke="#5a4532" stroke-width="8"/>
 <rect x="640" y="1020" width="300" height="230" fill="#4a3424"/><rect x="760" y="900" width="18" height="120" fill="#20160e"/><path d="M700 900 L840 900 L800 820 L740 820Z" fill="#e8c27a"/>
 <path d="M200 1240 L200 1080 Q200 1040 240 1040 L330 1040" stroke="#1d140c" stroke-width="12" fill="none"/></svg>
 <div id="shlamp"></div></div>
<div id="shdark"></div>
<svg id="shshadow" viewBox="0 0 600 1100"><path d="M300 60 Q380 60 390 170 Q400 260 360 300 Q470 330 500 520 L560 760 L520 770 L470 600 L470 1100 L130 1100 L130 600 L80 770 L40 760 L100 520 Q130 330 240 300 Q200 260 210 170 Q220 60 300 60Z" fill="#000"/>
 <path d="M560 760 L590 860 M548 768 L570 880 M534 772 L548 890 M40 760 L10 860 M52 768 L30 880 M66 772 L52 890" stroke="#000" stroke-width="12" stroke-linecap="round"/>
 <ellipse cx="262" cy="190" rx="16" ry="9" fill="#fff"/><ellipse cx="338" cy="190" rx="16" ry="9" fill="#fff"/></svg>
<div class="gtitle wshad" id="shtitle"><span>ТЕНЬ</span></div>`;
  A(`tl.fromTo('#shtitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  sfx(s, 'buzz', e - s + 0.5);
  // Свет мигает: в темноте на стене тень, со светом её нет; на «гаснет свет» — тьма, тень ближе.
  const off = (t, d) => {
    A(`tl.set('#shdark',{opacity:.92},${t.toFixed(3)});`);
    A(`tl.set('#shshadow',{opacity:1},${t.toFixed(3)});`);
    A(`tl.set('#shdark',{opacity:0},${(t + d).toFixed(3)});`);
    A(`tl.set('#shshadow',{opacity:0},${(t + d).toFixed(3)});`);
    sfx(t, 'flick');
  };
  off(tm.appear - 0.1, 0.12);
  off(tm.appear + 0.25, 0.18);
  const t = tm.dark;
  A(`tl.set('#shdark',{opacity:.95},${t});`);
  A(`tl.set('#shshadow',{opacity:1},${t});`);
  A(`tl.fromTo('#shshadow',{scale:1,y:0},{scale:1.9,y:300,duration:${(e - t + 0.3).toFixed(2)},ease:'power2.in'},${t});`);
  A(`tl.to('#shshadow ellipse',{attr:{ry:14},fill:'#ff4040',duration:.15},${t + 0.4});`);
  shake(t + 0.4, 22);
  sfx(t, 'click');
  sfx(t + 0.35, 'heart');
  sfx(t + 0.4, 'sting');
  return html;
}

export const WHO_CSS = `
.gtitle.wself span{color:#e8f4ff;text-shadow:0 0 30px rgba(180,220,255,.7),7px 7px 0 #203040}
.gtitle.whunt span{color:#ff3b3b;text-shadow:0 0 30px rgba(255,40,40,.6),7px 7px 0 #300}
.gtitle.wshad span{color:#f0e6d0;text-shadow:0 0 34px rgba(0,0,0,.9),7px 7px 0 #000}
#sfmirror{position:absolute;left:240px;top:560px;width:600px;height:640px;border-radius:300px 300px 30px 30px;border:22px solid #4a5456;box-shadow:0 30px 80px rgba(0,0,0,.7);overflow:hidden}
#sfmirror .sfin{position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,0) 40%)}
.sfroom,.sfcracks{position:absolute;left:0;top:0;width:600px;height:600px}
#sffog{position:absolute;left:0;right:0;top:420px;text-align:center;font-family:Caveat,Montserrat;font-weight:900;font-size:96px;color:rgba(230,240,245,.75);text-shadow:0 0 12px rgba(255,255,255,.4);transform:rotate(-6deg);opacity:0}
.sfsh{position:absolute;width:60px;height:80px;background:linear-gradient(135deg,rgba(230,245,255,.85),rgba(150,180,200,.4));clip-path:polygon(50% 0,100% 70%,30% 100%,0 40%);opacity:0;z-index:4}
#sflight{position:absolute;inset:0;background:#000;opacity:0}
#hncam{position:absolute;inset:0}
.hnx{opacity:0}
#hnman{position:absolute;left:440px;top:780px;width:200px;height:520px;transform-origin:50% 100%;z-index:3}
#hnman svg{width:200px;height:520px}
#hnlant{position:absolute;left:20px;top:300px;width:44px;height:60px;border-radius:10px;background:#ffd27a;box-shadow:0 0 60px 30px rgba(255,190,90,.55);transform-origin:50% -40px}
#hnbeam{position:absolute;left:340px;top:1000px;width:400px;height:900px;background:linear-gradient(rgba(255,220,150,.28),rgba(255,220,150,0));clip-path:polygon(45% 0,55% 0,100% 100%,0 100%);transform-origin:50% 0;z-index:2}
#hnnight{position:absolute;left:0;right:0;top:540px;text-align:center;opacity:0;z-index:4}
.stp.night{height:80px}.stp.night .sv{font-family:Mono;font-size:64px;color:#ff6b6b;text-shadow:0 0 20px rgba(255,0,0,.6)}
#shroom{position:absolute;inset:0}
#shlamp{position:absolute;left:470px;top:560px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(255,210,130,.45),rgba(255,210,130,0) 65%)}
#shdark{position:absolute;inset:0;background:#030202;opacity:0}
#shshadow{position:absolute;left:240px;top:420px;width:600px;height:1100px;opacity:0;transform-origin:50% 20%;z-index:3}
`;
