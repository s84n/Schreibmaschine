export type AmbienceId = 'off' | 'rain' | 'fire';

/** Generierte Hintergrundgeräusche (Regen, Kaminfeuer) – keine Dateien, keine Lizenzfragen. */
export class Ambience {
  private readonly noise: AudioBuffer;
  private bus?: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private crackleTimer = 0;
  private current: AmbienceId = 'off';

  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode) {
    const len = ctx.sampleRate * 4;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  set(id: AmbienceId): void {
    if (id === this.current) return;
    this.current = id;
    this.stop();
    if (id === 'off') return;
    const bus = (this.bus = this.ctx.createGain());
    bus.gain.setValueAtTime(0, this.ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.5);
    bus.connect(this.out);
    if (id === 'rain') {
      // Bewusst leise: Rauschen im Hintergrund, vereinzelte Tropfen an der Scheibe
      this.layer(bus, 'highpass', 1400, 0.03);
      this.layer(bus, 'lowpass', 380, 0.13);
      this.tick(bus, 1800, 4200, 0.02, 0.07, 500);
    } else {
      this.layer(bus, 'lowpass', 170, 0.5);
      this.tick(bus, 1200, 3800, 0.04, 0.5, 900);
    }
  }

  private layer(bus: AudioNode, type: BiquadFilterType, freq: number, gain: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(bus);
    src.start();
    this.sources.push(src);
  }

  /** Kurze, zufällig gefärbte Rauschimpulse in unregelmäßigen Abständen: Knacken bzw. Tropfen. */
  private tick(bus: AudioNode, fMin: number, fRange: number, gMin: number, gRange: number, spacing: number): void {
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = fMin + Math.random() * fRange;
    f.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gMin + Math.random() ** 3 * gRange, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.015 + Math.random() * 0.04);
    src.connect(f).connect(g).connect(bus);
    src.start(now, Math.random() * 3.5, 0.08);
    this.crackleTimer = window.setTimeout(() => this.tick(bus, fMin, fRange, gMin, gRange, spacing), 40 + Math.random() ** 2 * spacing);
  }

  private stop(): void {
    window.clearTimeout(this.crackleTimer);
    const bus = this.bus;
    const sources = this.sources;
    this.bus = undefined;
    this.sources = [];
    if (!bus) return;
    bus.gain.cancelScheduledValues(this.ctx.currentTime);
    bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    window.setTimeout(() => {
      sources.forEach((s) => s.stop());
      bus.disconnect();
    }, 1200);
  }
}
