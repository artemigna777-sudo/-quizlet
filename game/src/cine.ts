/** Сценки на движке игры: своя камера летит по точкам, сверху и снизу — чёрные полосы, внизу — подпись. */
import * as THREE from 'three';
import { VOICE_DUR } from './voicedur';

type V3 = [number, number, number];
export interface Shot { dur: number; from: V3; to?: V3; look: V3; lookTo?: V3; text?: string; title?: string; voice?: string; on?: () => void }

export class Cine {
  readonly cam = new THREE.PerspectiveCamera(52, 1, 0.1, 160);
  active = false;
  private shots: Shot[] = [];
  private i = 0;
  private t = 0;
  private done: () => void = () => {};
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private dur = 0;
  constructor(private ui: { root: HTMLElement; sub: HTMLElement; title: HTMLElement }, private say: (id: string | null) => void) {}

  play(shots: Shot[], done: () => void) {
    this.shots = shots; this.i = -1; this.done = done; this.active = true;
    this.ui.root.classList.add('on');
    this.next();
  }
  private next() {
    this.i++; this.t = 0;
    const s = this.shots[this.i];
    if (!s) { this.end(); return; }
    s.on?.();
    // Кадр длится не меньше, чем звучит реплика.
    this.dur = Math.max(s.dur, s.voice ? (VOICE_DUR[s.voice] ?? 0) + 0.5 : 0);
    if (s.voice) this.say(s.voice);
    this.ui.sub.textContent = s.text ?? '';
    this.ui.title.textContent = s.title ?? '';
  }
  private end() {
    // Незавершённые действия кадров всё равно должны случиться (если сценку пропустили).
    for (let k = this.i + 1; k < this.shots.length; k++) this.shots[k].on?.();
    this.active = false;
    this.say(null);
    this.ui.root.classList.remove('on');
    this.ui.sub.textContent = ''; this.ui.title.textContent = '';
    this.done();
  }
  skip() { if (this.active) this.end(); }
  update(dt: number) {
    if (!this.active) return;
    const s = this.shots[this.i];
    this.t += dt;
    const k = Math.min(1, this.t / this.dur), e = k * k * (3 - 2 * k);
    this.a.set(...s.from); if (s.to) this.a.lerp(this.b.set(...s.to), e);
    this.cam.position.copy(this.a);
    this.a.set(...s.look); if (s.lookTo) this.a.lerp(this.b.set(...s.lookTo), e);
    this.cam.lookAt(this.a);
    if (this.t >= this.dur) this.next();
  }
}
