/**
 * Управление. Компьютер: WASD/стрелки, мышь (захват курсора), Shift — бег, F — фонарик, Q — ладонь, E — действие.
 * Телефон: левая половина экрана — джойстик, правая — обзор; кнопки на экране.
 */
export class Input {
  moveX = 0; // вправо
  moveZ = 0; // вперёд
  run = false;
  hand = false;
  private lookDX = 0;
  private lookDY = 0;
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private joy: { id: number; x0: number; y0: number; x: number; y: number } | null = null;
  private look: { id: number; x: number; y: number } | null = null;
  readonly touch = matchMedia('(pointer: coarse)').matches;
  locked = false;

  constructor(private canvas: HTMLCanvasElement, private stick: HTMLElement) {
    addEventListener('keydown', (e) => { if (!e.repeat) this.pressed.add(e.code); this.keys.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', (e) => { if (this.locked) { this.lookDX += e.movementX; this.lookDY += e.movementY; } });
    canvas.addEventListener('touchstart', (e) => this.onTouch(e, 'start'), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouch(e, 'move'), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouch(e, 'end'), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this.onTouch(e, 'end'), { passive: false });
  }

  /** Захватить курсор (только по действию пользователя). */
  lock() { if (!this.touch) this.canvas.requestPointerLock?.(); }

  private onTouch(e: TouchEvent, kind: 'start' | 'move' | 'end') {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (kind === 'start') {
        if (t.clientX < innerWidth / 2 && !this.joy) this.joy = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY };
        else if (!this.look) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      } else if (kind === 'move') {
        if (this.joy?.id === t.identifier) { this.joy.x = t.clientX; this.joy.y = t.clientY; }
        if (this.look?.id === t.identifier) { this.lookDX += (t.clientX - this.look.x) * 2.2; this.lookDY += (t.clientY - this.look.y) * 2.2; this.look.x = t.clientX; this.look.y = t.clientY; }
      } else {
        if (this.joy?.id === t.identifier) this.joy = null;
        if (this.look?.id === t.identifier) this.look = null;
      }
    }
    const s = this.stick;
    if (this.joy) {
      s.style.display = 'block';
      s.style.left = `${this.joy.x0}px`;
      s.style.top = `${this.joy.y0}px`;
      const dx = this.joy.x - this.joy.x0, dy = this.joy.y - this.joy.y0;
      const m = Math.min(1, Math.hypot(dx, dy) / 60);
      const a = Math.atan2(dy, dx);
      (s.firstElementChild as HTMLElement).style.transform = `translate(${Math.cos(a) * m * 46}px,${Math.sin(a) * m * 46}px)`;
    } else s.style.display = 'none';
  }

  /** Нажата ли клавиша в этом кадре (один раз). */
  hit(code: string) { const v = this.pressed.has(code); this.pressed.delete(code); return v; }
  /** Нажатие кнопки на экране. */
  press(code: string) { this.pressed.add(code); }

  /** Раз в кадр: собрать движение и обзор. */
  frame() {
    const k = (c: string) => (this.keys.has(c) ? 1 : 0);
    let x = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft');
    let z = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown');
    let run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    if (this.joy) {
      const dx = this.joy.x - this.joy.x0, dy = this.joy.y - this.joy.y0;
      const m = Math.hypot(dx, dy);
      if (m > 8) { x = dx / Math.max(m, 60); z = -dy / Math.max(m, 60); run = m > 95; }
    }
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    this.moveX = x;
    this.moveZ = z;
    this.run = run;
    this.hand = this.keys.has('KeyQ') || this.keys.has('held:hand');
    const d = { x: this.lookDX, y: this.lookDY };
    this.lookDX = this.lookDY = 0;
    return d;
  }
  hold(code: string, on: boolean) { if (on) this.keys.add(code); else this.keys.delete(code); }
}
