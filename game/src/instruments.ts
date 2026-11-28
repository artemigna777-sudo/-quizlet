import './instruments.css';
import type { Sound } from './audio';
import { KNOCK_PATTERN, KNOCK_WINDOWS, RADIO_LOCK_MS, TAP_TIMEOUT, knockFits, radioInTune, radioStrength, TAPE_ORDER, tapeFits } from './signal';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type Instrument = 'knocker' | 'tuner' | 'splicer' | 'patcher';

function bindDrag(handle: HTMLElement, start: (e: PointerEvent) => void, move: (e: PointerEvent) => void, end: (e: PointerEvent, cancelled: boolean) => void) {
  let pointer: number | null = null;
  handle.onpointerdown = (e) => {
    if (pointer !== null || e.button !== 0) return;
    e.preventDefault();
    pointer = e.pointerId;
    handle.setPointerCapture(pointer);
    start(e);
    move(e);
  };
  handle.onpointermove = (e) => { if (pointer === e.pointerId) move(e); };
  const stop = (e: PointerEvent, cancelled: boolean) => {
    if (pointer !== e.pointerId) return;
    pointer = null;
    end(e, cancelled);
  };
  handle.onpointerup = (e) => stop(e, false);
  handle.onpointercancel = (e) => stop(e, true);
  handle.onlostpointercapture = (e) => stop(e, true);
}

export class Instruments {
  private current: Instrument | null = null;
  private done = () => {};
  private relayResult = (_line: number) => {};
  private status = get('instrumentStatus');
  private dial = get('radioDial');
  private scope = get<HTMLCanvasElement>('radioScope');
  private slots = [...get('tapeSlots').children] as HTMLElement[];
  private tray = [...get('tapeTray').children] as HTMLElement[];
  private pieces = this.tray.map((cell) => cell.firstElementChild as HTMLButtonElement);
  private tapeCheck = get<HTMLButtonElement>('tapeCheck');
  private pulses = [...document.querySelectorAll<HTMLElement>('.knock-pulses i')];
  private taps: number[] = [];
  private lastTap = -Infinity;
  private channel = 10;
  private signalAt: number | null = null;
  private lastScope = 0;
  private dragGhost: HTMLElement | null = null;
  private hover: HTMLElement | null = null;
  private plug = get('relayPlug');
  private cable = get('relayCable');

  constructor(private sound: Sound, back: () => void) {
    get('instrumentBack').onclick = back;
    const pad = get<HTMLButtonElement>('knockTap');
    pad.onpointerdown = (e) => { if (e.isPrimary && e.button === 0) { e.preventDefault(); this.tap(); } };
    pad.onclick = (e) => { if (e.detail === 0) this.tap(); };
    get('knockDemo').onclick = () => {
      this.clearTaps('Слушай: два близких удара, затем пауза.');
      this.sound.knock(KNOCK_PATTERN, true);
    };
    bindDrag(this.dial, () => {}, (e) => {
      if (this.current !== 'tuner') return;
      const r = this.dial.getBoundingClientRect();
      const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
      if (Math.hypot(dx, dy) < 10) return;
      const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
      this.readDial(8 + (Math.max(-135, Math.min(135, angle)) + 135) / 30);
    }, () => {});
    this.dial.onkeydown = (e) => {
      const offset: Partial<Record<string, number>> = { ArrowRight: .1, ArrowUp: .1, ArrowLeft: -.1, ArrowDown: -.1, PageUp: .5, PageDown: -.5 };
      const step = offset[e.key];
      if (step === undefined) return;
      e.preventDefault();
      this.readDial(this.channel + step);
    };
    for (const [i, piece] of this.pieces.entries()) {
      bindDrag(piece, () => {
        const ghost = piece.cloneNode(true) as HTMLElement;
        const r = piece.getBoundingClientRect();
        ghost.className = 'tape-piece tape-drag';
        ghost.style.cssText = 'inset:auto;width:' + r.width + 'px;height:' + r.height + 'px';
        ghost.setAttribute('aria-hidden', 'true');
        ghost.removeAttribute('data-tape-id');
        ghost.tabIndex = -1;
        document.body.append(ghost);
        piece.dataset.dragging = '';
        this.dragGhost = ghost;
      }, (e) => {
        if (this.dragGhost) {
          this.dragGhost.style.left = e.clientX + 'px';
          this.dragGhost.style.top = e.clientY + 'px';
        }
        this.highlight(this.slotAt(e));
      }, (e, cancelled) => {
        delete piece.dataset.dragging;
        const to = cancelled ? null : this.slotAt(e);
        this.resetDrag();
        if (to || (!cancelled && piece.parentElement !== this.tray[i])) this.placePiece(piece, to, i);
      });
      piece.onclick = (e) => {
        if (e.detail === 0) this.placePiece(piece, piece.parentElement === this.tray[i] ? this.slots.find((slot) => !slot.querySelector('button')) ?? null : null, i);
      };
    }
    this.tapeCheck.onclick = () => {
      const order = this.slots.map((slot) => slot.querySelector<HTMLElement>('.tape-piece')?.dataset.tapeId);
      if (tapeFits(order)) {
        this.sound.click();
        this.sound.knock([.30, .54], true);
        this.done();
      } else {
        this.sound.cassette();
        this.status.textContent = order[0] !== TAPE_ORDER[0] ? 'Найди момент, когда оператор включает линию.' : 'Голос отвечает на стук. Проверь, какой фрагмент был раньше.';
      }
    };
    bindDrag(this.plug, () => { this.cable.hidden = false; }, (e) => {
      const origin = this.plug.getBoundingClientRect();
      const x = origin.left + origin.width / 2, y = origin.top + origin.height / 2;
      const dx = e.clientX - x, dy = e.clientY - y;
      this.cable.style.width = Math.hypot(dx, dy) + 'px';
      this.cable.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + Math.atan2(dy, dx) + 'rad)';
      this.highlight(this.portAt(e));
    }, (e, cancelled) => {
      const target = cancelled ? null : this.portAt(e);
      this.cable.hidden = true;
      this.highlight(null);
      if (target) this.connect(Number(target.dataset.line));
    });
    for (const port of get('relayPorts').querySelectorAll<HTMLButtonElement>('.relay-port')) {
      port.onclick = (e) => { if (e.detail === 0) this.connect(Number(port.dataset.line)); };
    }
  }

  private highlight(target: HTMLElement | null) {
    if (target === this.hover) return;
    this.hover?.removeAttribute('data-hover');
    this.hover = target;
    if (target) target.dataset.hover = '';
  }
  private slotAt(e: PointerEvent) {
    return document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-tape-slot]') ?? null;
  }
  private portAt(e: PointerEvent) {
    return document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-line]') ?? null;
  }
  private resetDrag() { this.dragGhost?.remove(); this.dragGhost = null; this.highlight(null); }
  private placePiece(piece: HTMLButtonElement, to: HTMLElement | null, i: number) {
    if (this.current !== 'splicer') return;
    const from = piece.parentElement!;
    if (to === from) return;
    const previous = to?.querySelector<HTMLButtonElement>('.tape-piece');
    if (previous) {
      const home = from.hasAttribute('data-tape-slot') ? from : this.tray[this.pieces.indexOf(previous)];
      home.append(previous);
    }
    (to ?? this.tray[i]).append(piece);
    this.sound.click();
    this.tapeCheck.disabled = this.slots.some((slot) => !slot.querySelector('button'));
    this.status.textContent = this.tapeCheck.disabled ? '' : 'Можно прослушать собранную запись.';
  }
  private connect(line: number) {
    if (this.current !== 'patcher') return;
    this.sound.click();
    this.relayResult(line);
  }

  private show(part: Instrument, title: string, hint: string, done: () => void) {
    this.close();
    this.current = part;
    this.done = done;
    get('instrumentTitle').textContent = title;
    get('instrumentHint').textContent = hint;
    get(part).hidden = false;
    this.status.textContent = '';
  }
  openKnock(title: string, hint: string, done: () => void) {
    this.show('knocker', title, hint, done);
    this.clearTaps('Первый удар запускает шкалу.');
    get('knockTap').focus({ preventScroll: true });
  }
  openRadio(done: () => void) {
    this.show('tuner', 'Радиоприёмник', 'Поверни ручку. Когда шум стихнет, удерживай частоту до появления голоса.', done);
    this.readDial(10);
    this.dial.focus({ preventScroll: true });
  }
  openTape(done: () => void) {
    this.show('splicer', 'Монтажный стол', 'Перетащи полоски в том порядке, в каком они звучали. Реле включили до стука.', done);
    this.pieces.forEach((piece, i) => this.tray[i].append(piece));
    this.tapeCheck.disabled = true;
    this.pieces[0].focus({ preventScroll: true });
  }
  openRelay(result: (line: number) => void) {
    this.show('patcher', 'Коммутатор', 'Возьми штекер и протяни к гнезду. Нужная линия указана в журнале.', () => {});
    this.relayResult = result;
    this.plug.focus({ preventScroll: true });
  }
  message(s: string) { this.status.textContent = s; }
  visibility(visible: boolean) {
    if (this.current === 'tuner') {
      this.signalAt = null;
      if (visible) this.readDial(this.channel); else this.sound.radio(null);
    }
    if (this.current === 'knocker' && !visible) this.clearTaps('Первый удар запускает шкалу.');
  }
  close() {
    if (this.current === 'tuner') this.sound.radio(null);
    if (this.current) get(this.current).hidden = true;
    this.current = null;
    this.signalAt = null;
    this.cable.hidden = true;
    this.resetDrag();
  }

  private clearTaps(message: string) { this.taps.length = 0; this.status.textContent = message; }
  private tap() {
    if (this.current !== 'knocker') return;
    const now = performance.now(), count = this.taps.length;
    this.sound.knock([0]);
    this.lastTap = now;
    if (count && !knockFits(count - 1, now - this.taps[count - 1])) {
      this.clearTaps('Ритм сбился. Начни с первого удара.');
      return;
    }
    this.taps.push(now);
    if (this.taps.length === 3) { this.done(); return; }
    this.status.textContent = count ? 'Два удара. Теперь выдержи паузу.' : 'Один удар. Следующий — быстро.';
  }
  private readDial(value: number) {
    this.channel = Math.round(Math.max(8, Math.min(17, value)) * 10) / 10;
    const strength = radioStrength(this.channel), percent = Math.round(strength * 100);
    const formatted = this.channel.toFixed(1).replace('.', ',');
    get('radioFreq').textContent = formatted;
    this.dial.style.setProperty('--angle', (this.channel - 8) * 30 - 135 + 'deg');
    this.dial.setAttribute('aria-valuenow', String(this.channel));
    const meter = get('radioMeter');
    meter.style.setProperty('--level', percent + '%');
    meter.setAttribute('aria-valuenow', String(percent));
    this.sound.radio(strength);
    if (radioInTune(this.channel)) this.signalAt ??= performance.now();
    else this.signalAt = null;
    this.status.textContent = this.signalAt !== null ? 'Есть голос. Удерживай частоту.' : strength > .1 ? 'Слышны обрывки слов.' : 'Только шум.';
  }

  update(now: number) {
    if (this.current === 'knocker') {
      const meter = get('knockMeter'), band = KNOCK_WINDOWS[this.taps.length - 1];
      const gap = band ? Math.max(0, now - this.taps[this.taps.length - 1]) : 0;
      meter.style.setProperty('--level', Math.min(1, gap / TAP_TIMEOUT) * 100 + '%');
      meter.style.setProperty('--from', (band ? band[0] / TAP_TIMEOUT * 100 : 0) + '%');
      meter.style.setProperty('--span', (band ? (band[1] - band[0]) / TAP_TIMEOUT * 100 : 0) + '%');
      for (const [i, pulse] of this.pulses.entries()) pulse.toggleAttribute('data-lit', i < this.taps.length);
      get('knockTap').toggleAttribute('data-struck', now - this.lastTap < 100);
      if (band && gap > TAP_TIMEOUT) this.clearTaps('Труба стихла. Попробуй снова.');
    }
    if (this.current !== 'tuner') return;
    if (this.signalAt !== null && now - this.signalAt >= RADIO_LOCK_MS) { this.done(); return; }
    if (now - this.lastScope < 45) return;
    this.lastScope = now;
    const g = this.scope.getContext('2d')!, { width, height } = this.scope;
    const signal = radioStrength(this.channel), noise = 1 - signal, t = now / 1000;
    g.clearRect(0, 0, width, height);
    g.strokeStyle = '#3d503b';
    g.beginPath();
    for (let x = 0; x < width; x += 28) { g.moveTo(x, 0); g.lineTo(x, height); }
    for (let y = 12; y < height; y += 17) { g.moveTo(0, y); g.lineTo(width, y); }
    g.stroke();
    g.strokeStyle = signal > .7 ? '#bedc9b' : '#aeaf87';
    g.lineWidth = 1.7;
    g.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const wave = Math.sin(x * .048 - t * 3.6) * (5 + 18 * signal);
      const grain = noise * (Math.sin(x * 2.47 + t * 9) * 16 + Math.sin(x * .95 - t * 36) * 9);
      g.lineTo(x, height / 2 + wave + grain);
    }
    g.stroke();
  }
}
