/**
 * Мини-сцены жанров на весь экран (гонки, хоррор, выживание) и маленькие превью для монитора в начале ролика.
 * Каждая сцена — функция (ctx, tm) → HTML; анимации и звуки она сама добавляет в таймлайн через ctx.
 *   ctx.A(js)        — строка GSAP в таймлайн
 *   ctx.sfx(t, kind, arg) — звук
 *   ctx.stepper(id, items, cls) — «счётчик» из готовых значений (без колбэков, работает при перемотке)
 *   ctx.shake(t, сила)
 * tm — моменты: s — начало окна, z — зум на весь экран, e — зум обратно в плитку, и слова реплики.
 */

let seed = 20261103;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n0 = (v) => Math.round(v);
const reps = (from, to, period) => Math.max(1, Math.ceil((to - from) / period) + 2);

/** Плитки выбора жанра: left, top; размер 430×320. */
export const TILE = [[90, 520], [560, 520], [90, 870], [560, 870]];
export const TW = 430;
export const TH = 320;

// ═══════════════════════════ ГОНКИ ═══════════════════════════
const RH = 780; // горизонт

const carSVG = (id, c1, c2, plate) => `<svg class="car" viewBox="0 0 460 340">
<defs><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
<linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe3ff" stop-opacity=".75"/><stop offset="1" stop-color="#1a1036"/></linearGradient></defs>
<ellipse cx="230" cy="266" rx="226" ry="18" fill="#000" opacity=".6"/>
<rect x="36" y="196" width="72" height="68" rx="12" fill="#0d0d10"/><rect x="352" y="196" width="72" height="68" rx="12" fill="#0d0d10"/>
<path d="M150 34 L310 34 Q330 34 340 52 L372 112 L88 112 L120 52 Q130 34 150 34Z" fill="#1d0f2e"/>
<path d="M158 46 L302 46 L330 104 L130 104 Z" fill="url(#${id}w)"/>
<path d="M192 50 L216 50 L182 100 L160 100Z" fill="#fff" opacity=".2"/>
<path d="M30 128 Q30 112 50 112 L410 112 Q430 112 430 128 L440 214 Q440 236 418 236 L42 236 Q20 236 20 214 Z" fill="url(#${id}b)"/>
<ellipse cx="230" cy="145" rx="236" ry="44" fill="#ff1f4b" opacity=".2"/>
<rect x="48" y="132" width="364" height="26" rx="13" fill="#ff1f4b"/>
<rect x="58" y="138" width="344" height="10" rx="5" fill="#ffd0d8"/>
<rect x="186" y="176" width="88" height="34" rx="6" fill="#f4f4f2"/>
<text x="230" y="201" font-family="Russo" font-size="21" text-anchor="middle" fill="#111">${plate}</text>
<rect x="22" y="94" width="416" height="12" rx="6" fill="#111"/>
<rect x="80" y="104" width="12" height="12" fill="#111"/><rect x="368" y="104" width="12" height="12" fill="#111"/>
<circle cx="150" cy="232" r="12" fill="#222" stroke="#777" stroke-width="4"/><circle cx="310" cy="232" r="12" fill="#222" stroke="#777" stroke-width="4"/>
</svg>`;

export function race(c, tm) {
  const { A, sfx, stepper, shake } = c;
  const { s, z, e } = tm;
  const end = e + 0.5;

  const stars = Array.from({ length: 34 }, () => {
    const w = 2 + n0(rnd() * 3);
    return `<i style="left:${n0(rnd() * 1080)}px;top:${n0(rnd() * (RH - 300))}px;width:${w}px;height:${w}px;opacity:${(0.3 + rnd() * 0.7).toFixed(2)}"></i>`;
  }).join('');
  let mnt = '0,240';
  for (let x = 0; x <= 1080; x += 54) {
    const k = Math.abs(x - 540) < 220 ? 0.3 : 1;
    mnt += ` ${x},${n0(240 - (30 + rnd() * 170) * k)}`;
  }
  mnt += ' 1080,240';
  const vl = Array.from({ length: 23 }, (_, i) => `<line x1="540" y1="0" x2="${-2320 + i * 260}" y2="1140"/>`).join('');
  const hl = Array.from({ length: 8 }, (_, i) => `<div class="r-hl" id="rhl${i}"></div>`).join('');
  const dash = Array.from({ length: 6 }, (_, i) => `<div class="r-dash" id="rd${i}"></div>`).join('');
  const poles = ['l', 'r'].map((sd) => Array.from({ length: 5 }, (_, i) => `<div class="r-pole ${sd}" id="rp${sd}${i}"><b></b></div>`).join('')).join('');
  const speed = Array.from({ length: 22 }, (_, i) => `<div class="r-slw" style="transform:rotate(${n0(rnd() * 360)}deg)"><div class="r-sl" id="rsl${i}"></div></div>`).join('');
  const smoke = Array.from({ length: 10 }, (_, i) => `<div class="r-smk" id="rsm${i}" style="left:${i % 2 ? 392 : 68}px;top:250px"></div>`).join('');
  const ticks = Array.from({ length: 13 }, (_, i) => {
    const a = ((210 - i * 20) * Math.PI) / 180;
    const p = (r) => `${(130 + r * Math.cos(a)).toFixed(1)} ${(130 - r * Math.sin(a)).toFixed(1)}`;
    return `<path d="M${p(76)} L${p(90)}" stroke="${i > 9 ? '#ff2d75' : '#fff'}" stroke-width="${i % 2 ? 3 : 6}"/>`;
  }).join('');

  // Скорость: 0 → 110 (зум) → 230 (нитро) → 300.
  const sp = [];
  const seg = (t0, t1, v0, v1, n) => { for (let k = 0; k <= n; k++) sp.push({ t: t0 + ((t1 - t0) * k) / n, text: String(Math.round(v0 + ((v1 - v0) * k) / n)) }); };
  seg(z, z + 0.5, 0, 110, 8);
  seg(tm.nitro, tm.nitro + 0.45, 110, 230, 8);
  seg(tm.s300 - 0.1, tm.s300 + 0.2, 230, 300, 5);
  const speedNum = stepper('rsv', sp, 'spd');

  const html = `
<div class="r-sky"></div><div class="r-stars">${stars}</div>
<svg class="r-sun" viewBox="0 0 580 290"><defs>
 <linearGradient id="rsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset=".6" stop-color="#ff7a59"/><stop offset="1" stop-color="#ff2d75"/></linearGradient>
 <mask id="rsm"><rect width="580" height="290" fill="#fff"/>${[150, 178, 202, 224, 244, 262, 278].map((y, i) => `<rect y="${y}" width="580" height="${5 + i * 2}" fill="#000"/>`).join('')}</mask></defs>
 <circle cx="290" cy="290" r="290" fill="url(#rsg)" mask="url(#rsm)"/></svg>
<svg class="r-mnt" viewBox="0 0 1080 240"><polygon points="${mnt}" fill="#1a0533" stroke="#ff4fd8" stroke-width="4" stroke-linejoin="round"/></svg>
<div class="r-floor">${hl}
 <svg class="r-grid" viewBox="0 0 1080 1140" stroke="#ff4fd8" stroke-width="3" opacity=".55">${vl}</svg>
 <svg class="r-road" viewBox="0 0 1080 1140"><polygon points="526,0 554,0 1010,1140 70,1140" fill="#0b0614"/>
  <path d="M526 0 L70 1140 M554 0 L1010 1140" stroke="#4fd1ff" stroke-width="26" opacity=".22"/>
  <path d="M526 0 L70 1140 M554 0 L1010 1140" stroke="#7fe3ff" stroke-width="7"/></svg>
 ${dash}${poles}
</div>
<div id="rspeed">${speed}</div>
<div class="r-rival" id="rrival">${carSVG('rv', '#4fd1ff', '#1e5fa8', 'ИИ 777')}</div>
<div class="r-car" id="rcar"><div id="rcarm">${smoke}${carSVG('rc', '#ff9a4d', '#c2410c', 'ВЫ 001')}<div class="r-fl" id="rfl0" style="left:150px"></div><div class="r-fl" id="rfl1" style="left:310px"></div></div></div>
<div class="gtitle race" id="rtitle"><span>ГОНКИ</span></div>
<div class="rpop" id="rpop0"><span>NITRO!</span></div><div class="rpop" id="rpop1"><span>ДРИФТ!</span></div><div class="rpop hot" id="rpop2"><span>300!</span></div>
<div id="rspd"><svg viewBox="0 0 260 220">
 <path d="M43.4 180 A100 100 0 1 1 216.6 180" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="16" stroke-linecap="round"/>
 <path id="rarc" d="M43.4 180 A100 100 0 1 1 216.6 180" fill="none" stroke="#ff2d75" stroke-width="16" stroke-linecap="round" stroke-dasharray="419" stroke-dashoffset="419"/>
 ${ticks}<line id="rneedle" x1="130" y1="130" x2="130" y2="50" stroke="#fff" stroke-width="7" stroke-linecap="round"/><circle cx="130" cy="130" r="13" fill="#fff"/></svg>
 ${speedNum}<div class="spdu">КМ/Ч</div></div>
<div id="rnit"><b>NITRO</b><div class="nb"><i id="rnitb"></i></div></div>`;

  // Бесконечное движение.
  for (let i = 0; i < 8; i++) A(`tl.fromTo('#rhl${i}',{y:0,scaleY:.4,opacity:.1},{y:1140,scaleY:3,opacity:.9,duration:1,ease:'power2.in',repeat:${reps(s, end, 1)}},${(s - (i / 8) * 1).toFixed(3)});`);
  for (let i = 0; i < 6; i++) A(`tl.fromTo('#rd${i}',{y:0,scaleX:.1,scaleY:.08},{y:1140,scaleX:3,scaleY:3,duration:.5,ease:'power2.in',repeat:${reps(s, end, 0.5)}},${(s - (i / 6) * 0.5).toFixed(3)});`);
  ['l', 'r'].forEach((sd) => {
    for (let i = 0; i < 5; i++) A(`tl.fromTo('#rp${sd}${i}',{x:0,y:0,scale:.04},{x:${sd === 'l' ? -640 : 640},y:1400,scale:2.8,duration:.9,ease:'power2.in',repeat:${reps(s, end, 0.9)}},${(s - (i / 5) * 0.9 - (sd === 'r' ? 0.09 : 0)).toFixed(3)});`);
  });
  for (let i = 0; i < 22; i++) A(`tl.fromTo('#rsl${i}',{y:40,opacity:.9},{y:1100,opacity:0,duration:.45,ease:'power2.in',repeat:${reps(s, end, 0.45)}},${(s - rnd() * 0.45).toFixed(3)});`);
  A(`tl.fromTo('#rcar',{x:-26,rotation:-1.5},{x:26,rotation:1.5,duration:.8,ease:'sine.inOut',yoyo:true,repeat:${reps(s, end, 0.8)}},${s});`);
  A(`tl.fromTo('#rcar .car',{y:0},{y:-5,duration:.07,yoyo:true,repeat:${reps(s, end, 0.07)}},${s});`);
  A(`tl.fromTo('.r-sun',{scale:1},{scale:1.04,duration:.6,yoyo:true,repeat:${reps(s, end, 0.6)},transformOrigin:'50% 100%'},${s});`);

  // Зум: заголовок, спидометр.
  A(`tl.fromTo('#rtitle span',{scale:3,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.25});`);
  shake(z + 0.55, 16);
  sfx(z + 0.53, 'boom');
  sfx(s, 'engine', end - s);
  A(`tl.fromTo('#rneedle',{rotation:-120,svgOrigin:'130 130'},{rotation:-32,svgOrigin:'130 130',duration:.5,ease:'power2.out'},${z});`);
  A(`tl.fromTo('#rarc',{strokeDashoffset:419},{strokeDashoffset:${n0(419 * (1 - 110 / 300))},duration:.5,ease:'power2.out'},${z});`);
  A(`tl.fromTo('#rspd,#rnit',{x:-200,opacity:0},{x:0,opacity:1,duration:.35,ease:'power3.out'},${z + 0.2});`);

  // Соперник впереди — нитро — обгон.
  A(`tl.fromTo('#rrival',{scale:.17,x:70,y:0},{scale:.42,x:150,y:170,duration:${(tm.nitro - s).toFixed(3)},ease:'none'},${s});`);
  A(`tl.to('#rrival',{scale:2.4,x:820,y:760,duration:.42,ease:'power2.in'},${tm.nitro});`);
  sfx(tm.nitro + 0.1, 'pass');

  // НИТРО.
  const t = tm.nitro;
  A(`tl.set('.r-fl',{opacity:1},${t});`);
  A(`tl.fromTo('.r-fl',{scaleY:.7,scaleX:.9},{scaleY:1.35,scaleX:1.1,duration:.05,yoyo:true,repeat:${reps(t, end, 0.05)}},${t});`);
  A(`tl.to('.r-fl',{opacity:0,duration:.2},${tm.drift + 0.5});`);
  A(`tl.to('#rcarm',{y:-70,scale:.88,duration:.3,ease:'power3.out'},${t});`);
  A(`tl.to('#rspeed',{opacity:1,duration:.15},${t});`);
  A(`tl.fromTo('#rpop0 span',{scale:3,opacity:0},{scale:1,opacity:1,duration:.22,ease:'power4.in'},${t - 0.12});`);
  A(`tl.fromTo('#rnitb',{scaleX:1},{scaleX:0,duration:1.1,ease:'none'},${t});`);
  A(`tl.fromTo('#gflash',{opacity:.55,background:'#7fe3ff'},{opacity:0,duration:.3,immediateRender:false},${t + 0.08});`);
  A(`tl.to('#rneedle',{rotation:60,svgOrigin:'130 130',duration:.45,ease:'power2.out'},${t});`);
  A(`tl.to('#rarc',{strokeDashoffset:${n0(419 * (1 - 230 / 300))},duration:.45},${t});`);
  shake(t + 0.1, 14);
  sfx(t, 'nitro');

  // ДРИФТ.
  const d = tm.drift;
  A(`tl.to('#rpop0 span',{opacity:0,scale:.6,duration:.12},${d - 0.15});`);
  A(`tl.fromTo('#rpop1 span',{scale:3,opacity:0,rotation:-14},{scale:1,opacity:1,rotation:-6,duration:.22,ease:'power4.in'},${d - 0.12});`);
  A(`tl.to('#rcarm',{rotation:-17,x:-110,duration:.25,ease:'power2.out'},${d});`);
  A(`tl.to('#rcarm',{rotation:0,x:0,y:-30,duration:.5,ease:'power2.inOut'},${d + 0.45});`);
  for (let i = 0; i < 10; i++) {
    const ti = d + 0.05 + i * 0.06;
    A(`tl.fromTo('#rsm${i}',{scale:.3,opacity:.85,x:0,y:0},{scale:3.4,opacity:0,x:${i % 2 ? 140 + rnd() * 120 : -140 - rnd() * 120},y:${n0(60 + rnd() * 120)},duration:.9,ease:'power2.out'},${ti.toFixed(3)});`);
  }
  sfx(d, 'screech');

  // 300.
  const h = tm.s300;
  A(`tl.to('#rpop1 span',{opacity:0,scale:.6,duration:.12},${h - 0.15});`);
  A(`tl.fromTo('#rpop2 span',{scale:4,opacity:0},{scale:1,opacity:1,duration:.22,ease:'power4.in'},${h - 0.12});`);
  A(`tl.to('#rpop2 span',{scale:1.12,duration:.12,yoyo:true,repeat:5},${h + 0.15});`);
  A(`tl.to('#rneedle',{rotation:120,svgOrigin:'130 130',duration:.3,ease:'back.out(3)'},${h - 0.1});`);
  A(`tl.to('#rarc',{strokeDashoffset:0,stroke:'#ff1f4b',duration:.3},${h - 0.1});`);
  A(`tl.to('.r-hl',{opacity:1,duration:.1},${h});`);
  shake(h + 0.1, 20);
  sfx(h + 0.08, 'boom');
  return html;
}

// ═══════════════════════════ ХОРРОР ═══════════════════════════
export function horror(c, tm) {
  const { A, sfx, shake } = c;
  const { s, z, e } = tm;
  const end = e + 0.5;
  // Коридор: внешняя рамка и дальняя стена, перспектива на точку (540, 795).
  const O = [[-60, 250], [1140, 250], [1140, 1680], [-60, 1680]];
  const I = [[440, 700], [640, 700], [640, 890], [440, 890]];
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const ring = (u) => O.map((p, i) => lerp(p, I[i], u));
  const P = (pts) => pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  const rings = [0.28, 0.5, 0.66, 0.78, 0.87, 0.94].map((u) => `<polygon points="${P(ring(u))}" fill="none"/>`).join('');
  const door = (side, u1, u2, k) => {
    const a = ring(u1), b = ring(u2);
    const top = (r, idx0, idx3) => lerp(r[idx3], r[idx0], 0.68);
    const [i0, i3] = side === 'l' ? [0, 3] : [1, 2];
    const pts = [a[i3], top(a, i0, i3), top(b, i0, i3), b[i3]];
    return `<polygon points="${P(pts)}" fill="#0a0c0b" stroke="#2f3a31" stroke-width="3" id="hdoor${k}"/>`;
  };
  const lamps = [0.3, 0.56, 0.78].map((u, k) => {
    const y = 250 + (700 - 250) * u;
    const w = 130 * (1 - u) + 18;
    const hgt = 16 * (1 - u) + 5;
    const fy = 1680 + (890 - 1680) * u;
    return `<g class="hlamp" id="hl${k}"><polygon points="${540 - w},${y + hgt} ${540 + w},${y + hgt} ${540 + w * 2.6},${fy} ${540 - w * 2.6},${fy}" fill="url(#hcone)"/>
      <rect x="${540 - w}" y="${y}" width="${w * 2}" height="${hgt}" fill="#e8ffe9"/></g>`;
  }).join('');
  const dust = Array.from({ length: 22 }, (_, i) => `<i class="hd" id="hds${i}" style="left:${n0(150 + rnd() * 780)}px;top:${n0(450 + rnd() * 800)}px"></i>`).join('');

  const html = `
<div id="hroom"><div id="hzoom"><svg class="h-cor" viewBox="0 0 1080 1920">
 <defs><linearGradient id="hcone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfffe0" stop-opacity=".22"/><stop offset="1" stop-color="#dfffe0" stop-opacity="0"/></linearGradient></defs>
 <polygon points="${P([O[0], O[1], I[1], I[0]])}" fill="#0c0e0d"/>
 <polygon points="${P([O[0], I[0], I[3], O[3]])}" fill="#141916"/>
 <polygon points="${P([O[1], I[1], I[2], O[2]])}" fill="#121714"/>
 <polygon points="${P([O[3], O[2], I[2], I[3]])}" fill="#0f1210"/>
 <rect x="440" y="700" width="200" height="190" fill="#060707"/>
 <g stroke="#34413a" stroke-width="3">${rings}${O.map((p, i) => `<line x1="${p[0]}" y1="${p[1]}" x2="${I[i][0]}" y2="${I[i][1]}"/>`).join('')}</g>
 ${door('l', 0.5, 0.66, 0)}${door('r', 0.28, 0.5, 1)}${door('l', 0.78, 0.87, 2)}
 <rect x="490" y="770" width="100" height="120" fill="#0b0d0c" stroke="#2f3a31" stroke-width="3"/>
 <rect x="536" y="772" width="8" height="116" fill="#9fb5a3" opacity=".35" id="hslit"/>
 <rect x="505" y="730" width="70" height="24" rx="3" fill="#b3001b" id="hexit"/><text x="540" y="748" text-anchor="middle" font-family="Russo" font-size="15" fill="#ffd6dc">ВЫХОД</text>
 ${lamps}
 <g id="hfig" opacity="0"><path d="M540 778 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 M522 796 Q540 790 558 796 L566 860 L560 888 L552 888 L548 846 L540 846 L532 846 L528 888 L520 888 L514 860 Z M522 800 L506 868 M558 800 L574 868" fill="#000" stroke="#000" stroke-width="5"/>
  <circle cx="534.5" cy="777" r="2.6" fill="#fff"/><circle cx="545.5" cy="777" r="2.6" fill="#fff"/>
  <circle cx="540" cy="777" r="14" fill="#fff" opacity=".08"/></g>
</svg></div>${dust}</div>
<div id="hdark"></div>
<div id="hvig"></div>
<div id="hblack"></div>
<svg id="hface" viewBox="0 0 600 800"><defs><radialGradient id="hfg" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#ecead9"/><stop offset=".7" stop-color="#a7a48d"/><stop offset="1" stop-color="#25251e"/></radialGradient></defs>
 <ellipse cx="300" cy="420" rx="230" ry="320" fill="url(#hfg)"/>
 <path d="M70 300 Q60 40 300 30 Q540 40 530 300 L525 720 Q480 500 470 260 Q420 130 300 120 Q180 130 130 260 Q120 500 75 720 Z" fill="#050505"/>
 <ellipse cx="215" cy="385" rx="64" ry="84" fill="#000"/><ellipse cx="385" cy="385" rx="64" ry="84" fill="#000"/>
 <circle cx="224" cy="396" r="9" fill="#fff"/><circle cx="376" cy="396" r="9" fill="#fff"/>
 <path d="M205 465 Q198 545 214 610 M395 465 Q402 545 386 610" stroke="#3a0000" stroke-width="9" fill="none"/>
 <ellipse cx="300" cy="610" rx="74" ry="128" fill="#000"/>
 <path d="M236 538 L252 576 L268 540 L284 580 L300 540 L316 580 L332 540 L348 576 L364 538" fill="none" stroke="#d8d4c0" stroke-width="7"/>
 <path d="M300 150 L286 228 L310 268 L292 332" stroke="#3a2a22" stroke-width="5" fill="none"/></svg>
<div id="hred"></div>
<div class="gtitle horror" id="htitle"><span>ХОРРОР</span></div>`;

  // Пыль и мерцание заголовка.
  for (let i = 0; i < 22; i++) A(`tl.fromTo('#hds${i}',{x:0,y:0,opacity:0},{x:${n0(rnd() * 80 - 40)},y:${n0(-40 - rnd() * 80)},opacity:.5,duration:${(1.2 + rnd()).toFixed(2)},yoyo:true,repeat:3,ease:'sine.inOut'},${(s + rnd()).toFixed(3)});`);
  A(`tl.fromTo('#htitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  A(`tl.to('#htitle span',{keyframes:[{x:-6,opacity:.4,duration:.05},{x:5,opacity:1,duration:.05},{x:0,duration:.05},{opacity:.2,duration:.04},{opacity:1,duration:.06}],repeat:${reps(z, end, 0.9)},repeatDelay:.65},${z + 0.6});`);
  sfx(z + 0.48, 'boom');
  sfx(s, 'drone', end - s);

  // «Темно»: лампы мигают и гаснут, включается фонарик.
  const dk = tm.dark;
  A(`tl.to('.hlamp',{keyframes:[{opacity:.1,duration:.05},{opacity:1,duration:.06},{opacity:0,duration:.05},{opacity:.7,duration:.08},{opacity:0,duration:.05}]},${dk - 0.25});`);
  A(`tl.to('#hroom',{keyframes:[{opacity:.3,duration:.05},{opacity:1,duration:.06},{opacity:.15,duration:.05},{opacity:1,duration:.08}]},${dk - 0.25});`);
  A(`tl.fromTo('#hdark',{opacity:0,x:-330,y:140},{opacity:1,duration:.06,immediateRender:false},${dk + 0.05});`);
  A(`tl.to('#hexit',{opacity:.25,duration:.05,yoyo:true,repeat:${reps(dk, end, 0.18)},repeatDelay:.13},${dk});`);
  sfx(dk - 0.25, 'flick');
  sfx(dk + 0.05, 'click');
  // «Тихо»: фонарик шарит по стенам.
  A(`tl.to('#hdark',{x:330,y:60,duration:.55,ease:'sine.inOut'},${tm.quiet - 0.1});`);
  A(`tl.to('#hdark',{x:0,y:-165,duration:.45,ease:'power2.inOut'},${tm.who - 0.35});`);
  // «Кто-то стоит»: фигура в конце коридора, камера медленно подъезжает.
  A(`tl.to('#hfig',{keyframes:[{opacity:1,duration:.05},{opacity:0,duration:.05},{opacity:1,duration:.06}]},${tm.who + 0.05});`);
  A(`tl.fromTo('#hzoom',{scale:1},{scale:1.5,duration:${(tm.back - tm.who + 0.3).toFixed(3)},ease:'power1.in',transformOrigin:'540px 795px'},${tm.who});`);
  for (let k = 0, tb = tm.who; tb < tm.back; k++, tb += 0.62) {
    A(`tl.fromTo('#hvig',{opacity:.9},{opacity:.25,duration:.5,ease:'power2.out',immediateRender:false},${tb.toFixed(3)});`);
    sfx(tb, 'heart');
  }
  sfx(tm.who + 0.1, 'sting');
  // «За спиной»: фонарик гаснет, фигура исчезает, тишина — и скример.
  A(`tl.set('#hfig',{opacity:0},${tm.back - 0.15});`);
  A(`tl.to('#hblack',{keyframes:[{opacity:.9,duration:.05},{opacity:.2,duration:.05},{opacity:1,duration:.05}]},${tm.back - 0.1});`);
  sfx(tm.back - 0.1, 'flick');
  const j = tm.jump;
  A(`tl.set('#htitle',{opacity:0},${j - 0.02});`);
  A(`tl.fromTo('#hface',{scale:.12,opacity:0},{scale:1.45,opacity:1,duration:.14,ease:'power4.in',immediateRender:false},${j});`);
  A(`tl.to('#hface',{keyframes:[{x:-14,y:8,duration:.03},{x:12,y:-6,duration:.03},{x:-8,y:4,duration:.03},{x:0,y:0,duration:.03}],repeat:5},${j + 0.14});`);
  A(`tl.fromTo('#hred',{opacity:.75},{opacity:0,duration:.5,immediateRender:false},${j + 0.12});`);
  shake(j + 0.13, 42);
  shake(j + 0.3, 30);
  sfx(j + 0.08, 'scream');
  A(`tl.to('#hface',{opacity:0,duration:.08},${e - 0.05});`);
  A(`tl.set('#htitle',{opacity:1},${e - 0.05});`);
  return html;
}

// ═══════════════════════════ ВЫЖИВАНИЕ ═══════════════════════════
export function survival(c, tm) {
  const { A, sfx, stepper, shake } = c;
  const { s, z, e } = tm;
  const end = e + 0.5;
  const SH = 860; // горизонт моря
  const stars = Array.from({ length: 46 }, (_, i) => {
    const w = 2 + n0(rnd() * 3);
    return `<i id="svs${i}" style="left:${n0(rnd() * 1080)}px;top:${n0(330 + rnd() * (SH - 360))}px;width:${w}px;height:${w}px"></i>`;
  }).join('');
  const wave = (y, a, fill, id) => {
    let d = `M0 ${y}`;
    for (let x = 0; x < 2160; x += 270) d += ` Q${x + 67.5} ${y - a} ${x + 135} ${y} Q${x + 202.5} ${y + a} ${x + 270} ${y}`;
    return `<svg class="sv-wave" id="${id}" viewBox="0 0 2160 400" style="top:${SH - 30}px"><path d="${d} L2160 400 L0 400Z" fill="${fill}"/></svg>`;
  };
  const refl = Array.from({ length: 9 }, (_, i) => `<i id="svr${i}" style="top:${SH + 18 + i * 30}px;width:${120 - i * 9}px;margin-left:-${60 - i * 4.5}px"></i>`).join('');
  const leaf = (a) => `<g transform="rotate(${a} 268 640)"><path d="M268 640 Q370 582 476 656 Q372 612 268 654 Z"/></g>`;
  const sparks = Array.from({ length: 16 }, (_, i) => `<i class="sv-sp" id="svp${i}"></i>`).join('');
  const eyes = [[880, 1062], [985, 1094], [96, 1122]].map(([x, y], k) => `<div class="sv-eye" id="sve${k}" style="left:${x}px;top:${y}px"><i></i><i></i></div>`).join('');
  const clock = [];
  for (let k = 0; k <= 10; k++) clock.push({ t: tm.dawn + k * 0.22, text: `07:${String(59 - k).padStart(2, '0')}` });
  const clockHtml = stepper('svc', [{ t: s, text: '08:00' }, ...clock], 'clk');

  const html = `
<div id="svcam">
 <div class="sv-sky"></div><div class="sv-stars">${stars}</div>
 <div class="sv-moon" id="svmoon"><i style="left:40px;top:50px;width:34px;height:34px"></i><i style="left:110px;top:90px;width:22px;height:22px"></i><i style="left:76px;top:128px;width:28px;height:28px"></i></div>
 <div class="sv-sea"></div><div class="sv-refl">${refl}</div>
 ${wave(36, 10, '#0d2a4f', 'svw0')}${wave(70, 14, '#0a2140', 'svw1')}${wave(108, 18, '#071a33', 'svw2')}
 <svg class="sv-palm" id="svpalm" viewBox="0 0 1080 1920"><g fill="#04070c"><path d="M150 1260 Q186 930 258 636 L284 646 Q218 930 196 1260 Z"/>${[-28, 10, 46, 150, 186, 222, 258].map(leaf).join('')}</g></svg>
 <svg class="sv-isl" viewBox="0 0 1080 1920"><path d="M-50 1920 L-50 1150 Q220 1070 540 1090 Q860 1070 1130 1180 L1130 1920 Z" fill="#1b130b"/>
  <g fill="#070a08"><circle cx="880" cy="1110" r="90"/><circle cx="980" cy="1080" r="110"/><circle cx="1070" cy="1120" r="100"/><circle cx="60" cy="1150" r="100"/><circle cx="150" cy="1170" r="70"/></g></svg>
 <div class="sv-glow" id="svglow"></div>
 ${eyes}
 <svg class="sv-man" viewBox="0 0 1080 1920"><g fill="#0b0705" stroke="#ff8a3d" stroke-width="3" stroke-opacity=".75"><circle cx="372" cy="1040" r="27"/><path d="M344 1070 Q330 1112 336 1158 L424 1158 Q424 1104 400 1070 Z"/><path d="M400 1110 L452 1104 L458 1150 L444 1152 L440 1122 L404 1128Z"/></g></svg>
 <div id="svfire"><svg viewBox="0 0 300 340">
  <g id="svfl"><path class="f1" d="M150 300 C70 300 60 220 95 170 C110 200 120 205 125 190 C115 140 140 90 150 40 C165 95 200 120 190 175 C205 160 210 140 212 120 C252 175 240 300 150 300Z" fill="#ff5a00"/>
   <g transform="translate(45 90) scale(.7)"><path class="f2" d="M150 300 C70 300 60 220 95 170 C110 200 120 205 125 190 C115 140 140 90 150 40 C165 95 200 120 190 175 C205 160 210 140 212 120 C252 175 240 300 150 300Z" fill="#ffb000"/></g>
   <g transform="translate(90 180) scale(.4)"><path d="M150 300 C70 300 60 220 95 170 C110 200 120 205 125 190 C115 140 140 90 150 40 C165 95 200 120 190 175 C205 160 210 140 212 120 C252 175 240 300 150 300Z" fill="#fff4c2"/></g></g>
  <rect x="50" y="286" width="200" height="30" rx="15" fill="#4a2c18" transform="rotate(14 150 300)"/><rect x="50" y="286" width="200" height="30" rx="15" fill="#5a3620" transform="rotate(-14 150 300)"/></svg>${sparks}</div>
</div>
<div class="gtitle surv" id="svtitle"><span>ВЫЖИВАНИЕ</span></div>
<div id="svhud">
 <div class="bars">${[['ЗДОРОВЬЕ', '#ff3b5c', 'svb0'], ['ГОЛОД', '#ff9a3c', 'svb1'], ['ХОЛОД', '#4fd1ff', 'svb2']].map(([t, col, id]) => `<div class="bar"><b>${t}</b><div class="bt"><i id="${id}" style="background:${col}"></i></div></div>`).join('')}</div>
 <div class="clock" id="svclock"><b>ДО РАССВЕТА</b>${clockHtml}</div>
</div>`;

  // Фон: звёзды, волны, отражение луны, пальма, огонь, искры.
  for (let i = 0; i < 46; i++) A(`tl.fromTo('#svs${i}',{opacity:.2},{opacity:1,duration:${(0.3 + rnd() * 0.5).toFixed(2)},yoyo:true,repeat:${reps(s, end, 0.4)}},${(s - rnd()).toFixed(3)});`);
  [['svw0', 3.2], ['svw1', 2.4], ['svw2', 1.8]].forEach(([id, p], k) => A(`tl.fromTo('#${id}',{x:${k % 2 ? -1080 : 0}},{x:${k % 2 ? 0 : -1080},duration:${p},ease:'none',repeat:${reps(s, end, p)}},${s});`));
  for (let i = 0; i < 9; i++) A(`tl.fromTo('#svr${i}',{scaleX:.5,opacity:.25},{scaleX:1.1,opacity:.85,duration:${(0.25 + rnd() * 0.3).toFixed(2)},yoyo:true,repeat:${reps(s, end, 0.3)}},${(s - rnd()).toFixed(3)});`);
  A(`tl.fromTo('#svpalm',{rotation:-1.2},{rotation:1.2,duration:1.3,yoyo:true,ease:'sine.inOut',repeat:${reps(s, end, 1.3)},transformOrigin:'173px 1260px'},${s});`);
  A(`tl.fromTo('#svfl',{scaleY:.88,skewX:-4},{scaleY:1.12,skewX:4,duration:.13,yoyo:true,repeat:${reps(s, end, 0.13)},svgOrigin:'150 300'},${s});`);
  A(`tl.fromTo('#svglow',{opacity:.7,scale:.95},{opacity:1,scale:1.05,duration:.17,yoyo:true,repeat:${reps(s, end, 0.17)}},${s});`);
  for (let i = 0; i < 16; i++) A(`tl.fromTo('#svp${i}',{x:0,y:0,opacity:1,scale:1},{x:${n0(rnd() * 160 - 80)},y:${n0(-320 - rnd() * 260)},opacity:0,scale:.4,duration:${(1.1 + rnd() * 0.6).toFixed(2)},ease:'power1.out',repeat:${reps(s, end, 1.1)}},${(s - rnd() * 1.4).toFixed(3)});`);
  sfx(s, 'crackle', end - s);
  sfx(s, 'waves', end - s);

  // Зум: камера опускается с неба на остров, заголовок, интерфейс.
  A(`tl.fromTo('#svcam',{y:-140,scale:1.12},{y:0,scale:1,duration:1.2,ease:'power2.out'},${z});`);
  A(`tl.fromTo('#svtitle span',{scale:2.6,opacity:0},{scale:1,opacity:1,duration:.3,ease:'power4.in'},${z + 0.2});`);
  A(`tl.fromTo('#svhud',{y:-60,opacity:0},{y:0,opacity:1,duration:.35,ease:'power3.out'},${tm.island});`);
  shake(z + 0.5, 14);
  sfx(z + 0.48, 'boom');
  // «Костёр»: вспышка огня.
  A(`tl.fromTo('#svfire',{scale:1},{scale:1.4,duration:.18,yoyo:true,repeat:1,ease:'power2.out',transformOrigin:'50% 90%'},${tm.fire});`);
  A(`tl.fromTo('#svglow',{scale:1},{scale:1.6,duration:.25,yoyo:true,repeat:1,immediateRender:false},${tm.fire});`);
  sfx(tm.fire, 'fireburst');
  // «Ночь»: из темноты смотрят глаза, вой.
  for (let k = 0; k < 3; k++) {
    const t = tm.night + k * 0.18;
    A(`tl.fromTo('#sve${k}',{opacity:0},{opacity:1,duration:.2},${t.toFixed(3)});`);
    A(`tl.to('#sve${k} i',{scaleY:.1,duration:.06,yoyo:true,repeat:1},${(t + 0.6 + k * 0.2).toFixed(3)});`);
  }
  sfx(tm.night - 0.05, 'howl');
  // «До рассвета»: время идёт, силы тают.
  A(`tl.fromTo('#svclock',{scale:1},{scale:1.15,duration:.15,yoyo:true,repeat:1},${tm.dawn});`);
  ['svb0', 'svb1', 'svb2'].forEach((id, k) => A(`tl.fromTo('#${id}',{scaleX:${[0.9, 0.75, 0.6][k]}},{scaleX:${[0.62, 0.35, 0.22][k]},duration:${(end - tm.dawn).toFixed(2)},ease:'none'},${tm.dawn});`));
  sfx(tm.dawn, 'ticks', end - tm.dawn);
  return html;
}

// ═══════════════════════════ CSS ═══════════════════════════
export const GENRE_CSS = `
.genre{position:absolute;inset:0;visibility:hidden;overflow:hidden;z-index:6}
.gin{position:absolute;inset:0;overflow:hidden;background:#000}
.gtitle{position:absolute;left:0;right:0;top:360px;text-align:center;font-family:Russo;font-size:170px;line-height:1;z-index:4}
.gtitle span{display:inline-block}
.gtitle.race span{color:#fff;transform:skewX(-12deg);text-shadow:0 0 30px #ff2d75,9px 9px 0 #ff2d75}
.gtitle.horror span{color:#e8e8e0;font-size:160px;text-shadow:5px 0 #ff0033,-5px 0 #00e5ff,0 0 40px rgba(255,0,40,.6)}
.gtitle.surv span{color:#ffd23f;font-size:118px;text-shadow:0 8px 0 #7a3a00,0 0 40px rgba(255,140,40,.6)}
/* гонки */
.r-sky{position:absolute;left:0;right:0;top:0;height:${RH}px;background:linear-gradient(#0d0221 0%,#2a0a4a 45%,#8a1460 75%,#ff2d75 92%,#ff9a3c 100%)}
.r-stars i{position:absolute;background:#fff;border-radius:50%}
.r-sun{position:absolute;left:250px;top:${RH - 290}px;width:580px;height:290px}
.r-mnt{position:absolute;left:0;top:${RH - 240}px;width:1080px;height:240px}
.r-floor{position:absolute;left:0;top:${RH}px;width:1080px;height:1140px;background:linear-gradient(#1a0436,#07010f 70%)}
.r-hl{position:absolute;left:-600px;width:2280px;height:3px;top:0;background:#ff4fd8}
.r-grid,.r-road{position:absolute;left:0;top:0;width:1080px;height:1140px}
.r-dash{position:absolute;left:535px;top:0;width:10px;height:60px;background:#fff;transform-origin:50% 0}
.r-pole{position:absolute;top:0;width:0;height:0}.r-pole.l{left:516px}.r-pole.r{left:564px}
.r-pole b{position:absolute;left:-4px;bottom:0;width:8px;height:170px;background:#3a2456}
.r-pole b:before{content:'';position:absolute;left:-12px;top:-14px;width:32px;height:32px;border-radius:50%;background:#ffe9a8;box-shadow:0 0 30px 12px rgba(255,200,120,.7)}
#rspeed{position:absolute;inset:0;opacity:.3}
.r-slw{position:absolute;left:540px;top:${RH}px;width:0;height:0}
.r-sl{position:absolute;left:-2px;top:0;width:4px;height:260px;background:linear-gradient(rgba(255,255,255,0),rgba(255,255,255,.85));opacity:0}
.r-rival,.r-car{position:absolute;left:310px;width:460px;height:340px;transform-origin:50% 100%}
.r-rival{top:${RH - 300}px}.r-car{top:880px}
#rcarm{position:absolute;inset:0;transform-origin:50% 80%}
.car{position:absolute;left:0;top:0;width:460px;height:340px}
.r-fl{position:absolute;top:224px;width:56px;height:130px;margin-left:-28px;background:radial-gradient(ellipse at 50% 0%,#fff 0,#bdf4ff 18%,#4fd1ff 42%,rgba(79,209,255,0) 72%);border-radius:50% 50% 45% 45%/20% 20% 80% 80%;transform-origin:50% 0;opacity:0;z-index:2}
.r-smk{position:absolute;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:50%;background:radial-gradient(circle,rgba(225,225,240,.8),rgba(225,225,240,0) 70%);opacity:0}
.rpop{position:absolute;left:0;right:0;top:560px;text-align:center;font-family:Russo;font-size:130px;z-index:4}
.rpop span{display:inline-block;color:#9ff0ff;-webkit-text-stroke:10px #0b0614;paint-order:stroke fill;text-shadow:0 0 40px rgba(79,209,255,.9);opacity:0}
.rpop.hot span{color:#ffe066;text-shadow:0 0 50px rgba(255,45,117,.95);font-size:190px}
#rspd{position:absolute;left:40px;top:960px;width:260px;height:270px;opacity:0;z-index:3}
#rspd svg{width:260px;height:220px}
.stp{position:relative;display:block}
.stp .sv{position:absolute;left:0;right:0;top:0;text-align:center;opacity:0;white-space:nowrap}
.stp.spd{position:absolute;left:0;right:0;top:146px;height:60px}
.stp.spd .sv{font-family:Russo;font-size:54px;color:#fff;text-shadow:0 0 18px #ff2d75}
.spdu{position:absolute;left:0;right:0;top:210px;text-align:center;font-weight:900;font-size:24px;color:#ff9ac0;letter-spacing:4px}
#rnit{position:absolute;left:790px;top:1000px;width:160px;opacity:0;z-index:3}
#rnit b{font-family:Russo;font-size:30px;color:#7fe3ff;text-shadow:0 0 14px #4fd1ff}
#rnit .nb{margin-top:8px;height:22px;border:3px solid #7fe3ff;border-radius:12px;overflow:hidden}
#rnitb{display:block;height:100%;background:linear-gradient(90deg,#4fd1ff,#fff);transform-origin:0 50%}
/* хоррор */
#hroom{position:absolute;inset:0;background:#050605}
#hzoom{position:absolute;inset:0}
.h-cor{position:absolute;inset:0;width:1080px;height:1920px}
.hd{position:absolute;width:5px;height:5px;border-radius:50%;background:#cfd8cf;opacity:0}
#hdark{position:absolute;left:-1080px;top:-1920px;width:3240px;height:5760px;opacity:0;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,0) 150px,rgba(0,0,0,.6) 260px,rgba(0,0,0,.97) 420px)}
#hvig{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 40%,rgba(140,0,0,.75) 100%)}
#hblack{position:absolute;inset:0;background:#000;opacity:0}
#hface{position:absolute;left:150px;top:420px;width:780px;height:1040px;opacity:0;z-index:3}
#hred{position:absolute;inset:0;background:#c00018;opacity:0;mix-blend-mode:multiply;z-index:4}
/* выживание */
#svcam{position:absolute;inset:0;transform-origin:50% 60%}
.sv-sky{position:absolute;left:0;right:0;top:0;height:880px;background:linear-gradient(#02040d 0%,#061230 50%,#123a63 100%)}
.sv-stars i{position:absolute;background:#fff;border-radius:50%}
.sv-moon{position:absolute;left:200px;top:640px;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle at 40% 38%,#fffbea,#e6e0c0 70%,#cfc7a0);box-shadow:0 0 90px 30px rgba(240,236,210,.28)}
.sv-moon i{position:absolute;border-radius:50%;background:rgba(160,150,110,.35)}
.sv-sea{position:absolute;left:0;right:0;top:860px;height:400px;background:linear-gradient(#0f3157,#061226)}
.sv-refl i{position:absolute;left:295px;height:6px;border-radius:3px;background:#f4efcf}
.sv-wave{position:absolute;left:0;width:2160px;height:400px}
.sv-palm,.sv-isl,.sv-man{position:absolute;left:0;top:0;width:1080px;height:1920px}
.sv-glow{position:absolute;left:90px;top:680px;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(255,150,50,.5) 0,rgba(255,110,30,.18) 35%,rgba(255,110,30,0) 65%)}
#svfire{position:absolute;left:390px;top:840px;width:300px;height:340px}
#svfire svg{width:300px;height:340px}
.sv-sp{position:absolute;left:146px;top:120px;width:7px;height:7px;border-radius:50%;background:#ffc06a;box-shadow:0 0 10px #ff8a1f}
.sv-eye{position:absolute;opacity:0}
.sv-eye i{position:absolute;top:0;width:16px;height:10px;border-radius:50%;background:#ffe14a;box-shadow:0 0 16px 4px rgba(255,210,60,.7)}
.sv-eye i:nth-child(2){left:30px}
#svhud{position:absolute;left:70px;right:70px;top:520px;display:flex;justify-content:space-between;opacity:0;z-index:4}
#svhud .bars{display:flex;flex-direction:column;gap:12px;width:420px}
#svhud .bar b{display:block;font-weight:900;font-size:24px;letter-spacing:3px;color:#e9e4d0;margin-bottom:4px}
#svhud .bt{height:20px;border-radius:10px;background:rgba(255,255,255,.12);overflow:hidden;border:2px solid rgba(255,255,255,.25)}
#svhud .bt i{display:block;height:100%;transform-origin:0 50%}
#svhud .clock{text-align:center;padding:14px 20px;border-radius:24px;background:rgba(0,0,0,.45);border:3px solid rgba(255,210,63,.6);height:150px;width:330px}
#svhud .clock b{font-weight:900;font-size:26px;letter-spacing:3px;color:#ffd23f}
.stp.clk{height:90px;margin-top:6px}
.stp.clk .sv{font-family:Mono;font-size:82px;line-height:90px;color:#fff;text-shadow:0 0 20px rgba(255,210,63,.7)}
`;

// ═══════════════════════════ Превью для монитора ═══════════════════════════
export const THUMBS = [
  // гонки
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="t1a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0a4a"/><stop offset=".8" stop-color="#ff2d75"/><stop offset="1" stop-color="#ff9a3c"/></linearGradient><linearGradient id="t1b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#ff2d75"/></linearGradient></defs>
  <rect width="856" height="230" fill="url(#t1a)"/><circle cx="428" cy="230" r="120" fill="url(#t1b)"/>${[176, 194, 210, 222].map((y, i) => `<rect y="${y}" width="856" height="${4 + i * 2}" fill="#a3175f"/>`).join('')}
  <polygon points="0,230 70,170 140,205 210,150 300,210 340,195 516,210 560,190 640,140 720,200 790,160 856,200 856,230" fill="#1a0533" stroke="#ff4fd8" stroke-width="3"/>
  <rect y="230" width="856" height="170" fill="#12032a"/><g stroke="#ff4fd8" stroke-width="2" opacity=".6">${Array.from({ length: 13 }, (_, i) => `<line x1="428" y1="230" x2="${-600 + i * 170}" y2="400"/>`).join('')}<line x1="0" y1="260" x2="856" y2="260"/><line x1="0" y1="300" x2="856" y2="300"/><line x1="0" y1="360" x2="856" y2="360"/></g>
  <polygon points="420,230 436,230 690,400 166,400" fill="#0b0614"/><path d="M420 230 L166 400 M436 230 L690 400" stroke="#7fe3ff" stroke-width="5"/>
  <g transform="translate(330 300) scale(.42)">${carSVG('t1c', '#ff9a4d', '#c2410c', 'ВЫ 001').replace(/<\/?svg[^>]*>/g, '')}</g></svg>`,
  // хоррор
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><rect width="856" height="400" fill="#050605"/>
  <polygon points="0,0 856,0 520,150 336,150" fill="#0c0e0d"/><polygon points="0,0 336,150 336,260 0,400" fill="#151a17"/><polygon points="856,0 520,150 520,260 856,400" fill="#121714"/><polygon points="0,400 856,400 520,260 336,260" fill="#0f1210"/>
  <rect x="336" y="150" width="184" height="110" fill="#020202"/><g stroke="#34413a" stroke-width="3" fill="none"><polygon points="170,75 686,75 600,205 256,205"/><polygon points="256,105 600,105 560,240 296,240"/></g>
  <path d="M428 186 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M418 196 L438 196 L442 256 L414 256Z" fill="#000"/><circle cx="425" cy="186" r="2" fill="#fff"/><circle cx="431" cy="186" r="2" fill="#fff"/>
  <rect width="856" height="400" fill="url(#t2v)"/><defs><radialGradient id="t2v" cx=".5" cy=".5" r=".6"><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a0000" stop-opacity=".85"/></radialGradient></defs>
  <text x="428" y="80" text-anchor="middle" font-family="Russo" font-size="64" fill="#e8e8e0" style="text-shadow:none">ХОРРОР</text></svg>`,
  // выживание
  `<svg viewBox="0 0 856 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="t3a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02040d"/><stop offset="1" stop-color="#123a63"/></linearGradient><radialGradient id="t3g"><stop offset="0" stop-color="#ff9632" stop-opacity=".7"/><stop offset="1" stop-color="#ff6e1e" stop-opacity="0"/></radialGradient></defs>
  <rect width="856" height="240" fill="url(#t3a)"/>${Array.from({ length: 30 }, () => `<circle cx="${n0(rnd() * 856)}" cy="${n0(rnd() * 200)}" r="${(1 + rnd() * 1.6).toFixed(1)}" fill="#fff"/>`).join('')}
  <circle cx="170" cy="140" r="56" fill="#f2edd2"/><rect y="230" width="856" height="80" fill="#0a2140"/><path d="M-10 400 L-10 300 Q200 270 428 280 Q650 270 866 310 L866 400Z" fill="#1b130b"/>
  <circle cx="428" cy="290" r="170" fill="url(#t3g)"/><path d="M428 310 C392 310 386 280 402 258 C408 270 414 270 416 264 C410 244 422 222 428 196 C436 222 452 234 448 258 C456 250 458 240 458 230 C478 258 470 310 428 310Z" fill="#ff7a00"/><path d="M428 310 C410 310 406 290 416 276 C420 284 424 282 428 262 C434 280 442 288 440 300 C440 306 434 310 428 310Z" fill="#ffe08a"/>
  <path d="M120 400 Q140 300 180 210 L190 214 Q154 300 140 400Z M184 212 Q240 180 300 220 Q240 196 184 220Z M184 212 Q120 170 70 210 Q130 192 184 220Z" fill="#04070c"/></svg>`,
];
