/** Звук синтезируется в браузере (без файлов): ветер, шаги, лай, помехи стирания, находка. */
export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private world!: GainNode;
  private noise!: GainNode;
  private drone!: GainNode;
  enabled = true;

  /** Запускается по первому касанию: так требуют браузеры. */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.world = ctx.createGain();
    this.world.connect(this.master);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (filter: BiquadFilterType, freq: number, gain: number, to: AudioNode) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(to);
      src.start();
      return g;
    };
    loop('lowpass', 320, 0.16, this.world); // ветер
    // Ночной гул: два низких тона с биением.
    this.drone = ctx.createGain();
    this.drone.gain.value = 0;
    this.drone.connect(this.world);
    for (const f of [55, 58.2, 110.7]) { const o = ctx.createOscillator(); o.type = f > 100 ? 'triangle' : 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = f > 100 ? 0.25 : 1; o.connect(g).connect(this.drone); o.start(); }
    this.noise = loop('highpass', 2500, 0, this.master); // помехи стирания
  }

  /** Давление стирания: мир глохнет, помехи громче. */
  setPressure(p: number) {
    if (!this.ctx) return;
    this.world.gain.value = this.enabled ? 1 - p * 0.92 : 0;
    this.noise.gain.value = this.enabled ? p * p * 0.22 : 0;
  }

  /** Ночью — низкий гул; чем ближе опасность, тем он громче. */
  setNight(k: number) { if (this.ctx) this.drone.gain.setTargetAtTime(this.enabled ? k * 0.2 : 0, this.ctx.currentTime, 0.8); }
  heart() { this.tone(62, 38, 0.16, 0.5); setTimeout(() => this.tone(55, 34, 0.2, 0.35), 170); }

  private tone(freq: number, to: number, dur: number, gain: number, type: OscillatorType = 'sine', bus?: AudioNode) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(bus ?? this.world);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }
  // ───────── Голоса ─────────
  private voice: HTMLAudioElement | null = null;
  /** Произнести реплику (public/voice/<id>.mp3); null — замолчать. */
  say(id: string | null) {
    if (this.voice) { this.voice.pause(); this.voice = null; }
    if (!id || !this.enabled) return;
    const a = new Audio(new URL(`voice/${id}.mp3`, document.baseURI).href);
    a.volume = 1;
    void a.play().catch(() => { /* звук ещё не разрешён */ });
    this.voice = a;
  }
  step() { this.tone(90, 45, 0.09, 0.22); }
  bark() { this.tone(520, 260, 0.13, 0.28, 'sawtooth'); setTimeout(() => this.tone(480, 230, 0.13, 0.24, 'sawtooth'), 190); }
  pickup() { this.tone(660, 660, 0.5, 0.16); setTimeout(() => this.tone(990, 990, 0.7, 0.14), 140); }
  sting() { this.tone(1480, 1400, 1.2, 0.05); this.tone(1567, 1500, 1.2, 0.05); }
  click() { this.tone(1800, 900, 0.04, 0.12, 'square'); }
  swing() { this.tone(300, 120, 0.16, 0.12, 'triangle'); }
  shot() { this.tone(180, 40, 0.12, 0.5, 'square', this.master); this.tone(1200, 200, 0.05, 0.2, 'sawtooth', this.master); }
  dry() { this.tone(900, 700, 0.03, 0.1, 'square'); }
  thud() { this.tone(140, 50, 0.14, 0.4, 'square'); }
  pain() { this.tone(110, 60, 0.3, 0.35, 'sawtooth', this.master); }
  scream() { this.tone(900, 1900, 0.9, 0.5, 'sawtooth', this.master); this.tone(1340, 2300, 0.9, 0.3, 'square', this.master); }
  growl() { this.tone(95, 70, 0.6, 0.3, 'sawtooth'); }
  gulp() { this.tone(240, 160, 0.12, 0.2); setTimeout(() => this.tone(220, 150, 0.12, 0.2), 180); }
  dissolve() { this.tone(2400, 300, 0.5, 0.12, 'sawtooth'); }
  erased() { this.tone(200, 30, 1.2, 0.4, 'sawtooth', this.master); }
}
