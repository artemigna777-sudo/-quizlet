/** Звук синтезируется в браузере (без файлов): ветер, шаги, лай, помехи стирания, находка. */
export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private world!: GainNode;
  private noise!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private drone!: GainNode;
  private roomTone = 1;
  enabled = true;

  /** Запускается по первому касанию: так требуют браузеры. */
  start() {
    if (this.ctx) { if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.world = ctx.createGain();
    this.world.connect(this.master);
    const buf = this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
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
    for (const id of [1, 2]) void this.clip(ctx, `sfx/tuzik-${id}.mp3`).catch(() => {});
  }

  /** Давление стирания: мир глохнет, помехи громче. */
  setPressure(p: number) {
    if (!this.ctx) return;
    this.world.gain.value = this.enabled ? (1 - p * 0.92) * this.roomTone : 0;
    this.noise.gain.value = this.enabled ? p * p * 0.22 : 0;
  }
  quietRoom(on: boolean) { this.roomTone = on ? .16 : 1; }

  /** Ночью — низкий гул; чем ближе опасность, тем он громче. */
  setNight(k: number) { if (this.ctx) this.drone.gain.setTargetAtTime(this.enabled ? k * 0.2 : 0, this.ctx.currentTime, 0.8); }
  heart() { this.tone(62, 38, 0.16, 0.5); setTimeout(() => this.tone(55, 34, 0.2, 0.35), 170); }

  private tone(freq: number, to: number, dur: number, gain: number, type: OscillatorType = 'sine', bus?: AudioNode, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    const at = ctx.currentTime + delay;
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(bus ?? this.world);
    o.start(at);
    o.stop(at + dur + 0.02);
  }
  knock(taps: readonly number[], softer = false, delay = 0) {
    for (const tap of taps) {
      this.tone(156, 96, 0.16, softer ? 0.22 : 0.38, 'triangle', this.master, delay + tap);
      this.tone(690, 339, 0.085, softer ? 0.06 : 0.11, 'sine', this.master, delay + tap);
    }
  }
  // ───────── Голоса ─────────
  private voice: AudioBufferSourceNode | null = null;
  private voiceRequest = 0;
  private clips = new Map<string, Promise<AudioBuffer>>();
  private radioHiss: { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;

  radio(strength: number | null) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (strength === null || !this.enabled) {
      const hiss = this.radioHiss;
      if (!hiss) return;
      this.radioHiss = null;
      hiss.gain.gain.setTargetAtTime(0, ctx.currentTime, .025);
      hiss.source.onended = () => { hiss.source.disconnect(); hiss.filter.disconnect(); hiss.gain.disconnect(); };
      hiss.source.stop(ctx.currentTime + .13);
      return;
    }
    if (!this.radioHiss) {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = this.noiseBuffer;
      source.loop = true;
      filter.type = 'bandpass';
      filter.Q.value = .65;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(this.master);
      source.start();
      this.radioHiss = { source, filter, gain };
    }
    this.radioHiss.filter.frequency.setTargetAtTime(1400 + strength * 650, ctx.currentTime, .035);
    this.radioHiss.gain.gain.setTargetAtTime(.115 * (1 - strength) ** 1.6, ctx.currentTime, .055);
  }

  preloadVoices(ids: readonly string[]) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const id of ids) void this.clip(ctx, `voice/${id}.mp3`).catch(() => {});
  }

  private clip(ctx: AudioContext, path: string): Promise<AudioBuffer> {
    const saved = this.clips.get(path);
    if (saved) return saved;
    const clip = fetch(new URL(path, document.baseURI), { signal: AbortSignal.timeout(9000) })
      .then((response) => { if (!response.ok) throw new Error(`Audio ${path}: ${response.status}`); return response.arrayBuffer(); })
      .then((data) => ctx.decodeAudioData(data))
      .catch((error) => { this.clips.delete(path); throw error; });
    this.clips.set(path, clip);
    return clip;
  }

  /** Один аудиоконтекст открывается касанием; сцена узнаёт о фактическом конце реплики. */
  say(id: string | null, onEnd?: () => void, delay = 0) {
    const request = ++this.voiceRequest;
    if (this.voice) { this.voice.onended = null; this.voice.stop(); this.voice.disconnect(); this.voice = null; }
    const ctx = this.ctx;
    if (!id || !ctx || !this.enabled) { onEnd?.(); return; }
    void this.clip(ctx, `voice/${id}.mp3`).then((buffer) => {
      if (request !== this.voiceRequest) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.master);
      source.onended = () => {
        source.disconnect();
        if (this.voice === source) this.voice = null;
        onEnd?.();
      };
      source.start(ctx.currentTime + delay);
      this.voice = source;
    }).catch(() => { if (request === this.voiceRequest) onEnd?.(); });
  }
  step() { this.tone(90, 45, 0.09, 0.22); }
  private barkTake = 0;
  bark(distance = 2.5) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || distance > 24) return;
    const take = 1 + this.barkTake++ % 2, started = ctx.currentTime;
    void this.clip(ctx, `sfx/tuzik-${take}.mp3`).then((buffer) => {
      if (!this.enabled || ctx.currentTime - started > 0.4) return;
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = buffer;
      source.playbackRate.value = 0.95 + Math.random() * 0.1;
      gain.gain.value = 0.75 / (1 + (distance / 7) ** 2);
      source.connect(gain).connect(this.world);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
    }).catch(() => {});
  }
  pickup() { this.tone(660, 660, 0.5, 0.16); setTimeout(() => this.tone(990, 990, 0.7, 0.14), 140); }
  sting() { this.tone(1480, 1400, 1.2, 0.05); this.tone(1567, 1500, 1.2, 0.05); }
  click() { this.tone(1800, 900, 0.04, 0.12, 'square'); }
  cassette() {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    this.click();
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass'; filter.frequency.value = 1350; filter.Q.value = 0.85;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.17);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(); source.stop(ctx.currentTime + 1.2);
  }
  swing() { this.tone(300, 120, 0.16, 0.12, 'triangle'); }
  shot() { this.tone(180, 40, 0.12, 0.5, 'square', this.master); this.tone(1200, 200, 0.05, 0.2, 'sawtooth', this.master); }
  glass() { for (const f of [2370, 3260, 4310]) this.tone(f, f * 0.58, 0.19, 0.045, 'triangle', this.master); }
  dry() { this.tone(900, 700, 0.03, 0.1, 'square'); }
  thud() { this.tone(140, 50, 0.14, 0.4, 'square'); }
  pain() { this.tone(110, 60, 0.3, 0.35, 'sawtooth', this.master); }
  scream() { this.tone(900, 1900, 0.9, 0.5, 'sawtooth', this.master); this.tone(1340, 2300, 0.9, 0.3, 'square', this.master); }
  scareImpact() {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    this.tone(132, 46, .22, .40, 'triangle', this.master);
    this.tone(710, 116, .13, .19, 'sawtooth', this.master);
    const hit = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    hit.buffer = this.noiseBuffer;
    filter.type = 'bandpass'; filter.frequency.value = 850; filter.Q.value = .75;
    gain.gain.setValueAtTime(.40, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .24);
    hit.connect(filter).connect(gain).connect(this.master);
    hit.onended = () => { hit.disconnect(); filter.disconnect(); gain.disconnect(); };
    hit.start();
    hit.stop(ctx.currentTime + .27);
  }
  growl() { this.tone(95, 70, 0.6, 0.3, 'sawtooth'); }
  gulp() { this.tone(240, 160, 0.12, 0.2); setTimeout(() => this.tone(220, 150, 0.12, 0.2), 180); }
  dissolve() { this.tone(2400, 300, 0.5, 0.12, 'sawtooth'); }
  erased() { this.tone(200, 30, 1.2, 0.4, 'sawtooth', this.master); }
}
