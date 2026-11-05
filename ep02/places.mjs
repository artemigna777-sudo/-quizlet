/**
 * Серия 2, выбор №2 «Где всё происходит?»: мини-сцены на весь экран — лагерь, метро, космос, — и превью для монитора.
 * Устроены как genres.mjs: (ctx, tm) → HTML, анимации и звуки уходят в таймлайн через ctx.
 */

let seed = 77001;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n0 = (v) => Math.round(v);
const reps = (from, to, period) => Math.max(1, Math.ceil((to - from) / period) + 2);
const stars = (n, h, pre) => Array.from({ length: n }, (_, i) => {
  const w = 2 + n0(rnd() * 3);
  return `<i ${pre ? `id="${pre}${i}"` : ''} style="left:${n0(rnd() * 1080)}px;top:${n0(rnd() * h)}px;width:${w}px;height:${w}px;opacity:${(0.3 + rnd() * 0.7).toFixed(2)}"></i>`;
}).join('');

// ═══════════════════════════ ЛАГЕРЬ ═══════════════════════════
export function camp(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const end = e + 0.5;
  let pines = '';
  for (let x = -60; x < 1140; x += 58) {
    const h = 200 + rnd() * 160;
    const b = 1010 + rnd() * 25;
    pines += `<path d="M${x} ${b} L${x + 46} ${b - h} L${x + 92} ${b}Z"/>`;
  }
  const cabin = (x, lit, id) => `<g><path d="M${x} 1110 L${x} 930 L${x + 150} 830 L${x + 300} 930 L${x + 300} 1110Z" fill="#0d1210" stroke="#26302a" stroke-width="5"/>
    <path d="M${x - 20} 940 L${x + 150} 815 L${x + 320} 940" fill="none" stroke="#1b2420" stroke-width="18"/>
    <rect x="${x + 40}" y="960" width="80" height="66" fill="${lit === 0 ? '#ffd27a' : '#060807'}" stroke="#26302a" stroke-width="5"/>
    <rect x="${x + 180}" y="960" width="80" height="66" fill="${lit === 1 ? '#ffd27a' : '#060807'}" stroke="#26302a" stroke-width="5"/>
    <rect x="${x + 128}" y="1030" width="44" height="80" fill="#060807"/></g>`;
  const fog = [0, 1, 2].map((k) => `<div class="cp-fog" id="cpf${k}" style="top:${960 + k * 80}px"></div>`).join('');
  const html = `
<div class="cp-sky"></div><div class="cp-stars">${stars(40, 640)}</div>
<div class="cp-moon"></div>
<svg class="cp-svg" viewBox="0 0 1080 1920"><g fill="#040907">${pines}</g></svg>
<div class="cp-ground"></div>
<svg class="cp-svg" viewBox="0 0 1080 1920">
 <g stroke="#2a2016" stroke-width="24" fill="none"><path d="M352 1060 L352 790 M728 1060 L728 790"/><path d="M352 800 Q540 690 728 800"/></g>
 <g transform="rotate(-5 540 765)"><rect x="380" y="735" width="320" height="64" rx="6" fill="#3a2a1a" stroke="#1a120a" stroke-width="5"/>
  <text x="540" y="780" text-anchor="middle" font-family="Russo" font-size="34" fill="#c9b48a" letter-spacing="2">ЛАГ РЬ «ЗОР КА»</text></g>
 <circle id="cplamp" cx="540" cy="718" r="12" fill="#ffe3a0"/>
 ${cabin(20, 0, 'a')}${cabin(760, 1, 'b')}
 <g stroke="#1e2420" stroke-width="12" stroke-linecap="round"><path d="M70 1250 L130 935 L190 1250 M290 1250 L350 935 L410 1250 M110 935 L370 935"/></g>
 <g id="cpswing"><path d="M215 935 L215 1170 M275 935 L275 1170" stroke="#5a4a3a" stroke-width="5"/><rect x="198" y="1166" width="94" height="16" rx="4" fill="#5a3a22"/></g>
</svg>
<div class="cp-win" id="cpw0" style="left:60px;top:960px"><i id="cps0"></i></div>
<div class="cp-win" id="cpw1" style="left:940px;top:960px"><i id="cps1"></i></div>
${fog}
<div id="cpglow"></div>
<div id="cpdark"></div>
<div class="gtitle camp" id="cptitle"><span>ЛАГЕРЬ</span></div>`;

  // Фон: туман, качели сами качаются, лампа на воротах мигает, сверчки.
  [0, 1, 2].forEach((k) => A(`tl.fromTo('#cpf${k}',{x:${k % 2 ? -700 : 0}},{x:${k % 2 ? 0 : -700},duration:${6 + k * 2},ease:'none'},${s});`));
  A(`tl.fromTo('#cpswing',{rotation:-24},{rotation:24,duration:1.05,ease:'sine.inOut',yoyo:true,repeat:${reps(s, end, 1.05)},svgOrigin:'245 935'},${s});`);
  for (let t = s; t < end; t += 1.05) sfx(t + 0.9, 'creak');
  A(`tl.to('#cplamp,#cpglow',{keyframes:[{opacity:.2,duration:.05},{opacity:1,duration:.07},{opacity:.4,duration:.04},{opacity:1,duration:.1}],repeat:${reps(s, end, 1.2)},repeatDelay:.95},${s});`);
  sfx(s, 'crickets', end - s);
  // Зум.
  A(`tl.fromTo('#cptitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  // Фонарик: на качели → на корпус справа.
  A(`tl.fromTo('#cpdark',{opacity:0,x:-290,y:200},{opacity:1,duration:.15,immediateRender:false},${z + 0.3});`);
  A(`tl.to('#cpdark',{x:-300,y:180,duration:.3},${tm.swing - 0.2});`);
  A(`tl.to('#cpswing',{rotation:30,duration:.3,ease:'power2.out',svgOrigin:'245 935'},${tm.swing});`);
  sfx(tm.swing, 'creak');
  A(`tl.to('#cpdark',{x:440,y:40,duration:.5,ease:'power2.inOut'},${tm.cabins - 0.2});`);
  // В окне проходит тень, свет гаснет, шаги.
  A(`tl.fromTo('#cps1',{x:-90},{x:90,duration:.7,ease:'none'},${tm.walk - 0.35});`);
  A(`tl.to('#cpw1',{background:'#060807',duration:.05},${tm.walk + 0.45});`);
  A(`tl.to('#cpw0',{background:'#060807',duration:.05},${tm.walk + 0.75});`);
  sfx(tm.walk - 0.35, 'steps', 1.2);
  shake(tm.walk + 0.45, 10);
  return html;
}

// ═══════════════════════════ МЕТРО ═══════════════════════════
export function metro(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const end = e + 0.5;
  const SC = [1, 0.62, 0.42, 0.3, 0.22, 0.16, 0.12, 0.09, 0.07];
  const ring = (k) => {
    const v = SC[k];
    const fy = 800 + 820 * v;
    const x0 = 540 - 650 * v, x1 = 540 + 650 * v, yw = fy - 700 * v, r = 650 * v;
    return { v, fy, x0, x1, yw, r, d: `M${x0.toFixed(1)} ${fy.toFixed(1)} L${x0.toFixed(1)} ${yw.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${yw.toFixed(1)} L${x1.toFixed(1)} ${fy.toFixed(1)}` };
  };
  const rings = SC.map((_, k) => ring(k));
  const sleepers = rings.map(({ v, fy }) => `<line x1="${(540 - 240 * v).toFixed(1)}" y1="${fy.toFixed(1)}" x2="${(540 + 240 * v).toFixed(1)}" y2="${fy.toFixed(1)}"/>`).join('');
  const lamps = rings.slice(1).map(({ v, yw, r }, k) => `<g class="mtlamp" id="mtl${k}"><circle cx="540" cy="${(yw - r).toFixed(1)}" r="${(60 * v + 6).toFixed(1)}" fill="#ffe7a8" opacity=".25"/><rect x="${(540 - 40 * v - 4).toFixed(1)}" y="${(yw - r + 4).toFixed(1)}" width="${(80 * v + 8).toFixed(1)}" height="${(14 * v + 3).toFixed(1)}" fill="#fff4cc"/></g>`).join('');
  const html = `
<div class="mt-bg"></div>
<svg class="mt-svg" viewBox="0 0 1080 1920">
 <defs><radialGradient id="mtvp" cx=".5" cy=".42" r=".25"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
 <g fill="none" stroke="#3a4642" stroke-width="5">${rings.map((r) => `<path d="${r.d}"/>`).join('')}</g>
 <g stroke="#2a2420" stroke-width="10">${sleepers}</g>
 <g stroke="#9aa7a8" stroke-width="7"><line x1="526" y1="806" x2="300" y2="1920"/><line x1="554" y1="806" x2="780" y2="1920"/></g>
 <g stroke="#1d2523" stroke-width="6"><line x1="-20" y1="1100" x2="490" y2="760"/><line x1="-20" y1="1150" x2="490" y2="775"/><line x1="1100" y1="1100" x2="590" y2="760"/></g>
 <rect width="1080" height="1920" fill="url(#mtvp)"/>
 ${lamps}
</svg>
<div id="mttrain"><div class="mt-car"><i></i><i></i><b></b><b class="r"></b></div></div>
<div id="mtback"></div>
<svg id="mtfig" viewBox="0 0 200 520"><path d="M100 20 a32 32 0 1 0 0.1 0 M62 96 Q100 82 138 96 L150 300 L132 510 L114 510 L104 330 L96 330 L86 510 L68 510 L50 300 Z M62 104 L30 330 M138 104 L170 330" fill="#000" stroke="#000" stroke-width="16" stroke-linejoin="round"/>
 <circle cx="88" cy="50" r="9" fill="#fff"/><circle cx="112" cy="50" r="9" fill="#fff"/></svg>
<div id="mtboard"><b id="mtb">ПОЕЗДОВ НЕТ</b><span>00:47</span></div>
<div id="mtdark"></div>
<div class="gtitle metro" id="mttitle"><span>МЕТРО</span></div>`;

  sfx(s, 'buzz', end - s);
  A(`tl.fromTo('#mttitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.to('#mtb',{opacity:.2,duration:.25,yoyo:true,repeat:${reps(s, end, 0.25)},ease:'steps(1)'},${s});`);
  // Поезд уходит в тоннель.
  A(`tl.fromTo('#mttrain',{scale:.8,y:0},{scale:.03,y:-540,duration:${(tm.train + 0.9 - s).toFixed(2)},ease:'power2.out'},${s});`);
  A(`tl.to('#mttrain',{opacity:0,duration:.2},${tm.train + 0.8});`);
  sfx(s, 'train', 2.2);
  // Свет мигает.
  A(`tl.to('.mtlamp',{keyframes:[{opacity:.1,duration:.05},{opacity:1,duration:.06},{opacity:0,duration:.06},{opacity:.8,duration:.08},{opacity:.15,duration:.05},{opacity:1,duration:.07}],stagger:.03},${tm.blink - 0.1});`);
  A(`tl.to('.mt-svg',{keyframes:[{opacity:.35,duration:.05},{opacity:1,duration:.06},{opacity:.2,duration:.06},{opacity:1,duration:.1}]},${tm.blink - 0.1});`);
  sfx(tm.blink - 0.1, 'flick');
  // Из тоннеля кто-то идёт: свет гаснет от дальних ламп к ближним, фигура приближается.
  A(`tl.fromTo('#mtback',{opacity:0,scale:.5},{opacity:1,scale:1,duration:.5},${tm.comes - 0.35});`);
  A(`tl.fromTo('#mtfig',{scale:.08,y:0,opacity:0},{scale:.8,y:230,opacity:1,duration:${(e - tm.comes + 0.2).toFixed(2)},ease:'power2.in'},${tm.comes - 0.3});`);
  A(`tl.to('#mtfig',{rotation:2,duration:.22,yoyo:true,repeat:9,ease:'sine.inOut'},${tm.comes - 0.3});`);
  for (let k = 7; k >= 0; k--) A(`tl.to('#mtl${k}',{opacity:0,duration:.05},${(tm.comes + (7 - k) * 0.14).toFixed(3)});`);
  A(`tl.to('#mtdark',{opacity:.75,duration:1},${tm.comes});`);
  sfx(tm.comes - 0.3, 'steps', e - tm.comes + 0.4);
  sfx(tm.comes, 'heart');
  sfx(tm.comes + 0.62, 'heart');
  return html;
}

// ═══════════════════════════ КОСМОС ═══════════════════════════
export function space(c, tm) {
  const { A, sfx, stepper, shake } = c;
  const { s, z, e } = tm;
  const end = e + 0.5;
  const o2 = [];
  for (let k = 0; k <= 12; k++) o2.push({ t: tm.oxy - 0.1 + k * 0.17, text: `${21 - k}%` });
  const o2html = stepper('spo', [{ t: s, text: '21%' }, ...o2], 'o2');
  let panels = '';
  for (let x = 0; x <= 1080; x += 180) panels += `<line x1="${x}" y1="300" x2="${x}" y2="1920"/>`;
  for (let y = 300; y <= 1920; y += 180) panels += `<line x1="0" y1="${y}" x2="1080" y2="${y}"/>`;
  const html = `
<div class="sp-bg"><svg viewBox="0 0 1080 1920"><g stroke="#202a36" stroke-width="5">${panels}</g></svg></div>
<div id="sppt"><div class="sp-space"><div class="sp-stars" id="spst">${stars(70, 600)}${stars(70, 600)}</div><div class="sp-planet"></div>
 <svg id="spalien" viewBox="0 0 400 300"><path d="M60 200 Q120 110 200 120 Q290 110 340 190 L370 290 M300 170 L330 300 M100 180 L70 300 M140 160 L120 300 M200 120 Q190 60 230 40 Q270 30 280 70 Q290 110 250 120" fill="none" stroke="#000" stroke-width="34" stroke-linecap="round"/><circle cx="250" cy="70" r="7" fill="#7dff8a"/><circle cx="266" cy="74" r="5" fill="#7dff8a"/></svg>
 </div><div class="sp-ring"></div>${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<i class="sp-bolt" style="transform:rotate(${k * 45}deg) translateY(-270px)"></i>`).join('')}</div>
<div id="spbeam"></div>
<div id="spred"></div>
<div id="spo2"><b>O₂ КИСЛОРОД</b>${o2html}<div class="bt"><i id="spo2b"></i></div></div>
<div id="sprad"><div class="sw" id="spsw"></div><i class="blip" id="spblip"></i><span>ДВИЖЕНИЕ</span></div>
<div id="spwarn">⚠ УТЕЧКА КИСЛОРОДА</div>
<div class="gtitle space" id="sptitle"><span>КОСМОС</span></div>`;

  A(`tl.fromTo('#spst',{x:0},{x:-1080,duration:30,ease:'none'},${s});`);
  A(`tl.fromTo('.sp-planet',{rotation:0},{rotation:12,duration:6,ease:'none'},${s});`);
  A(`tl.fromTo('#spsw',{rotation:0},{rotation:360,duration:1,ease:'none',repeat:${reps(s, end, 1)}},${s});`);
  sfx(s, 'hum', end - s);
  A(`tl.fromTo('#sptitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  shake(z + 0.5, 12);
  sfx(z + 0.48, 'boom');
  A(`tl.fromTo('#spo2,#sprad',{y:-50,opacity:0},{y:0,opacity:1,duration:.35,ease:'power3.out',stagger:.1},${z + 0.3});`);
  // Кислород на исходе: тревога.
  const t = tm.oxy - 0.1;
  A(`tl.fromTo('#spred',{opacity:0},{opacity:.55,duration:.3,yoyo:true,repeat:${reps(t, end, 0.3)},ease:'sine.inOut'},${t});`);
  A(`tl.set('#spbeam',{opacity:1},${t});`);
  A(`tl.fromTo('#spbeam',{rotation:0},{rotation:720,duration:2.4,ease:'none',repeat:2},${t});`);
  A(`tl.fromTo('#spwarn',{scale:.5,opacity:0},{scale:1,opacity:1,duration:.25,ease:'back.out(2)'},${t});`);
  A(`tl.to('#spwarn',{opacity:.3,duration:.2,yoyo:true,repeat:9,ease:'steps(1)'},${t + 0.3});`);
  A(`tl.fromTo('#spo2b',{scaleX:1},{scaleX:.28,duration:2.2,ease:'none'},${t});`);
  A(`tl.to('#spo2 .sv',{color:'#ff4d4d',duration:.2},${t + 0.8});`);
  sfx(t, 'alarm', end - t);
  sfx(t + 0.2, 'breath', end - t);
  // Ты не один: метка на радаре приближается, за иллюминатором тень.
  A(`tl.fromTo('#spblip',{x:110,y:-70,opacity:0},{x:110,y:-70,opacity:1,duration:.1},${tm.oxy + 0.3});`);
  A(`tl.to('#spblip',{x:22,y:-12,duration:${(tm.alone - tm.oxy).toFixed(2)},ease:'power1.in'},${tm.oxy + 0.4});`);
  A(`tl.to('#spblip',{scale:1.8,duration:.15,yoyo:true,repeat:${reps(tm.oxy, end, 0.3)}},${tm.oxy + 0.4});`);
  for (let tb = tm.oxy + 0.3, g = 0.5; tb < end; g = Math.max(0.12, g * 0.8), tb += g) sfx(tb, 'beep');
  A(`tl.fromTo('#spalien',{x:-520,y:120,rotation:-8},{x:520,y:60,rotation:6,duration:1.1,ease:'power1.inOut'},${tm.alone - 0.25});`);
  A(`tl.fromTo('#gflash',{opacity:.4,background:'#ff2020'},{opacity:0,duration:.35,immediateRender:false},${tm.alone + 0.1});`);
  shake(tm.alone + 0.1, 22);
  sfx(tm.alone + 0.05, 'sting');
  sfx(tm.alone + 0.1, 'boom');
  return html;
}

export const PLACE_CSS = `
.gtitle.camp span{color:#d8ecc0;text-shadow:0 0 30px rgba(140,220,140,.5),6px 6px 0 #0d1a10;letter-spacing:6px}
.gtitle.metro span{color:#fff;text-shadow:0 0 30px rgba(255,40,40,.6),7px 7px 0 #b3001b}
.gtitle.space span{color:#c6f2ff;text-shadow:0 0 34px rgba(79,209,255,.8),7px 7px 0 #123a63}
/* лагерь */
.cp-sky{position:absolute;left:0;right:0;top:0;height:1100px;background:linear-gradient(#03060c 0%,#0a1618 55%,#16282a 100%)}
.cp-stars i,.sp-stars i{position:absolute;background:#fff;border-radius:50%}
.cp-moon{position:absolute;left:720px;top:470px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 40% 38%,#f7fbe6,#cfd8b6 75%);box-shadow:0 0 90px 30px rgba(220,240,200,.22)}
.cp-svg{position:absolute;left:0;top:0;width:1080px;height:1920px}
.cp-ground{position:absolute;left:0;right:0;top:1000px;bottom:0;background:linear-gradient(#0a130f,#030504 60%)}
.cp-win{position:absolute;width:80px;height:66px;background:#ffd27a;overflow:hidden;box-shadow:0 0 40px rgba(255,200,100,.5)}
.cp-win i{position:absolute;left:10px;top:12px;width:60px;height:80px;background:#0a0806;border-radius:30px 30px 0 0;transform:translateX(-90px)}
#cpw0{left:60px}
.cp-fog{position:absolute;left:-300px;width:2400px;height:170px;background:radial-gradient(ellipse at 30% 50%,rgba(190,215,205,.2),rgba(190,215,205,0) 60%),radial-gradient(ellipse at 75% 50%,rgba(190,215,205,.16),rgba(190,215,205,0) 55%)}
#cpglow{position:absolute;left:390px;top:570px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(255,220,150,.35),rgba(255,220,150,0) 65%)}
#cpdark{position:absolute;left:-1080px;top:-1920px;width:3240px;height:5760px;opacity:0;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,0) 190px,rgba(0,0,0,.35) 340px,rgba(0,0,0,.62) 560px)}
/* метро */
.mt-bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,#000 0,#10161a 30%,#1c2427 70%,#11171a 100%)}
.mt-svg{position:absolute;left:0;top:0;width:1080px;height:1920px}
#mttrain{position:absolute;left:280px;top:930px;width:520px;height:440px;transform-origin:50% 100%}
.mt-car{position:absolute;inset:0;border-radius:40px 40px 10px 10px;background:linear-gradient(#3a4c66,#1e2a3a);border:8px solid #10161f}
.mt-car i{position:absolute;top:50px;width:150px;height:150px;border-radius:14px;background:#0a0e14;box-shadow:inset 0 0 30px rgba(120,170,220,.25)}
.mt-car i:nth-child(1){left:60px}.mt-car i:nth-child(2){right:60px}
.mt-car b{position:absolute;bottom:60px;left:50px;width:70px;height:46px;border-radius:12px;background:#ff1f3b;box-shadow:0 0 50px 16px rgba(255,30,60,.7)}
.mt-car b.r{left:auto;right:50px}
#mtfig{position:absolute;left:440px;top:500px;width:200px;height:520px;transform-origin:50% 60%;opacity:0}
#mtboard{position:absolute;left:290px;top:560px;width:500px;padding:12px 20px;border-radius:12px;background:#050505;border:5px solid #333;display:flex;justify-content:space-between;align-items:center;z-index:3}
#mtboard b,#mtboard span{font-family:Mono;font-size:38px;color:#ff3b3b;text-shadow:0 0 12px #ff3b3b}
#mtback{position:absolute;left:240px;top:500px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(255,60,40,.85),rgba(255,40,30,.35) 35%,rgba(255,40,30,0) 70%);opacity:0}
#mtdark{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 60%,rgba(0,0,0,0) 20%,rgba(0,0,0,.95) 75%);opacity:0}
/* космос */
.sp-bg{position:absolute;inset:0;background:linear-gradient(#0a0f16,#141c26 50%,#0a0f16)}
.sp-bg svg{width:1080px;height:1920px}
#sppt{position:absolute;left:300px;top:660px;width:480px;height:480px}
.sp-space{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:#000}
.sp-stars{position:absolute;left:0;top:0;width:2160px;height:600px}
.sp-stars i:nth-child(n+71){margin-left:1080px}
.sp-planet{position:absolute;left:-300px;top:220px;width:800px;height:800px;border-radius:50%;background:radial-gradient(circle at 60% 30%,#7fd3ff,#1d6fb8 40%,#0b2a55 70%);box-shadow:0 0 60px 20px rgba(120,200,255,.45)}
#spalien{position:absolute;left:40px;top:100px;width:400px;height:300px}
.sp-ring{position:absolute;inset:-34px;border-radius:50%;border:40px solid #39424f;box-shadow:inset 0 0 40px rgba(0,0,0,.8),0 20px 60px rgba(0,0,0,.7)}
.sp-bolt{position:absolute;left:232px;top:232px;width:16px;height:16px;border-radius:50%;background:#7a8597}
#spbeam{position:absolute;left:-460px;top:-500px;width:2000px;height:2000px;opacity:0;background:conic-gradient(rgba(255,40,40,.35) 0deg,rgba(255,40,40,0) 40deg,rgba(255,40,40,0) 180deg,rgba(255,40,40,.35) 200deg,rgba(255,40,40,0) 240deg);mix-blend-mode:screen}
#spred{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(255,0,0,.1),rgba(200,0,0,.7));opacity:0}
#spo2{position:absolute;left:60px;top:560px;width:330px;padding:14px 20px;border-radius:20px;background:rgba(0,0,0,.6);border:3px solid rgba(79,209,255,.6);opacity:0;z-index:4}
#spo2 b{font-weight:900;font-size:26px;letter-spacing:2px;color:#9fe8ff}
.stp.o2{height:80px}.stp.o2 .sv{font-family:Mono;font-size:72px;line-height:80px;color:#fff}
#spo2 .bt{height:16px;border-radius:8px;background:rgba(255,255,255,.12);overflow:hidden}#spo2b{display:block;height:100%;background:linear-gradient(90deg,#ff4d4d,#4fd1ff);transform-origin:0 50%}
#sprad{position:absolute;left:770px;top:550px;width:250px;height:250px;border-radius:50%;border:4px solid #3ecf6e;background:radial-gradient(circle,rgba(62,207,110,.15),rgba(0,0,0,.75) 70%),repeating-radial-gradient(circle,rgba(62,207,110,0) 0 44px,rgba(62,207,110,.4) 44px 47px);overflow:hidden;opacity:0;z-index:4}
#sprad .sw{position:absolute;inset:0;background:conic-gradient(rgba(62,207,110,.65) 0deg,rgba(62,207,110,0) 70deg)}
#sprad .blip{position:absolute;left:115px;top:115px;width:20px;height:20px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 16px 6px rgba(255,60,60,.8);opacity:0}
#sprad span{position:absolute;left:0;right:0;bottom:20px;text-align:center;font-family:Mono;font-size:22px;color:#3ecf6e}
#spwarn{position:absolute;left:0;right:0;top:1160px;text-align:center;font-family:Russo;font-size:52px;color:#ff4d4d;text-shadow:0 0 24px rgba(255,0,0,.8);opacity:0;z-index:4}
`;

/** Превью для монитора в начале: выживание+хоррор, лагерь, метро, космос. */
export const THUMBS2 = [
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="u1a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02040d"/><stop offset="1" stop-color="#10233a"/></linearGradient><radialGradient id="u1g"><stop offset="0" stop-color="#ff9632" stop-opacity=".7"/><stop offset="1" stop-color="#ff6e1e" stop-opacity="0"/></radialGradient></defs>
   <rect width="856" height="400" fill="url(#u1a)"/>${Array.from({ length: 18 }, (_, i) => `<path d="M${i * 50 - 20} 300 L${i * 50 + 10} ${150 + (i * 37) % 80} L${i * 50 + 40} 300Z" fill="#03070a"/>`).join('')}
   <rect y="290" width="856" height="110" fill="#120d08"/><circle cx="428" cy="320" r="150" fill="url(#u1g)"/>
   <path d="M428 340 C396 340 390 312 404 292 C410 304 414 304 416 298 C410 278 422 258 428 232 C436 258 452 270 448 292 C456 284 458 274 458 264 C478 292 470 340 428 340Z" fill="#ff7a00"/>
   <circle cx="650" cy="250" r="5" fill="#ff2a2a"/><circle cx="668" cy="250" r="5" fill="#ff2a2a"/><circle cx="180" cy="270" r="4" fill="#ffd23f"/><circle cx="194" cy="270" r="4" fill="#ffd23f"/>
   <path d="M640 300 L650 230 Q659 214 668 230 L678 300Z" fill="#000"/></svg>`,
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><rect width="856" height="400" fill="#07100f"/><circle cx="660" cy="90" r="40" fill="#e3ecd0"/>
   ${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 56 - 20} 260 L${i * 56 + 18} ${120 + (i * 41) % 70} L${i * 56 + 56} 260Z" fill="#030806"/>`).join('')}<rect y="255" width="856" height="145" fill="#0a130f"/>
   <path d="M330 300 L330 200 M526 300 L526 200 M330 205 Q428 160 526 205" stroke="#2a2016" stroke-width="12" fill="none"/><rect x="360" y="180" width="136" height="28" fill="#3a2a1a" transform="rotate(-5 428 194)"/>
   <path d="M40 330 L40 240 L120 190 L200 240 L200 330Z" fill="#0d1210"/><rect x="70" y="260" width="40" height="34" fill="#ffd27a"/>
   <path d="M600 330 L600 240 L690 190 L780 240 L780 330Z" fill="#0d1210"/><rect x="700" y="260" width="40" height="34" fill="#ffd27a"/></svg>`,
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><rect width="856" height="400" fill="#11171a"/>
   <g fill="none" stroke="#3a4642" stroke-width="4">${[1, 0.6, 0.38, 0.24, 0.15].map((v) => `<path d="M${428 - 330 * v} ${200 + 230 * v} L${428 - 330 * v} ${200 + 40 * v} A${330 * v} ${330 * v} 0 0 1 ${428 + 330 * v} ${200 + 40 * v} L${428 + 330 * v} ${200 + 230 * v}"/>`).join('')}</g>
   <circle cx="428" cy="200" r="60" fill="#000"/><path d="M420 205 L300 400 M436 205 L556 400" stroke="#9aa7a8" stroke-width="5"/><circle cx="420" cy="196" r="3" fill="#fff"/><circle cx="436" cy="196" r="3" fill="#fff"/>
   <rect x="300" y="40" width="256" height="40" fill="#050505"/><text x="428" y="70" text-anchor="middle" font-family="Mono" font-size="24" fill="#ff3b3b">ПОЕЗДОВ НЕТ</text></svg>`,
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><rect width="856" height="400" fill="#141c26"/><circle cx="428" cy="200" r="170" fill="#000" stroke="#39424f" stroke-width="30"/>
   <circle cx="330" cy="330" r="200" fill="#1d6fb8"/>${Array.from({ length: 30 }, () => `<circle cx="${n0(280 + rnd() * 300)}" cy="${n0(60 + rnd() * 200)}" r="1.5" fill="#fff"/>`).join('')}
   <rect width="856" height="400" fill="#ff0000" opacity=".18"/><text x="428" y="380" text-anchor="middle" font-family="Russo" font-size="30" fill="#ff4d4d">O₂ 9%</text></svg>`,
];
