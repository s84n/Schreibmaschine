export type SoundId = 'strike' | 'space' | 'soft' | 'jam' | 'bell' | 'return';

export interface PlayOptions {
  /** Startposition im Sample in s */
  offset?: number;
  /** zusätzlicher Lautstärkefaktor */
  gain?: number;
}

const STRIKE_COUNT = 12;

/**
 * Web-Audio-Engine mit echten Aufnahmen. Jeder Anschlag wählt ein zufälliges Sample
 * und variiert Tonhöhe und Lautstärke leicht – so klingt keine Taste zweimal gleich.
 */
export class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private strikes: AudioBuffer[] = [];
  private bell?: AudioBuffer;
  private ret?: AudioBuffer;
  private volume = 0.8;
  private muted = false;
  private loading?: Promise<void>;
  private lastStrike = -1;

  /** Lädt die Samples vorab; der Kontext startet bis zur ersten Nutzergeste pausiert. */
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.applyVolume();
    this.loading = this.load().catch((err) => console.warn('Sounds konnten nicht geladen werden', err));
  }

  /** Muss aus einer Nutzergeste heraus aufgerufen werden (Autoplay-Richtlinien). */
  unlock(): void {
    this.init();
    if (this.ctx!.state === 'suspended') void this.ctx!.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    this.applyVolume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }

  /** Spielt einen Klang nach `delay` Sekunden. */
  play(id: SoundId, delay = 0, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.loading) return;
    const when = ctx.currentTime + Math.max(0, delay);
    const gainMul = opts.gain ?? 1;

    switch (id) {
      case 'strike':
        this.playBuffer(this.pickStrike(), when, {
          rate: 0.95 + Math.random() * 0.1,
          gain: (0.75 + Math.random() * 0.25) * gainMul,
        });
        break;
      case 'space':
        // Leertaste: kein Typenaufschlag, nur Schaltschritt – dumpfer und leiser
        this.playBuffer(this.pickStrike(), when, { rate: 0.78 + Math.random() * 0.05, gain: 0.45 * gainMul, lowpass: 1400 });
        break;
      case 'soft':
        this.playBuffer(this.pickStrike(), when, { rate: 0.7, gain: 0.3 * gainMul, lowpass: 900 });
        break;
      case 'jam':
        this.playBuffer(this.pickStrike(), when, { rate: 0.6, gain: 0.35 * gainMul, lowpass: 600 });
        break;
      case 'bell':
        this.playBuffer(this.bell, when, { rate: 0.98 + Math.random() * 0.04, gain: 0.6 * gainMul });
        break;
      case 'return':
        this.playBuffer(this.ret, when, { gain: 0.9 * gainMul, offset: opts.offset });
        break;
    }
  }

  private pickStrike(): AudioBuffer | undefined {
    if (!this.strikes.length) return undefined;
    let i = Math.floor(Math.random() * this.strikes.length);
    if (i === this.lastStrike) i = (i + 1) % this.strikes.length;
    this.lastStrike = i;
    return this.strikes[i];
  }

  private playBuffer(
    buf: AudioBuffer | undefined,
    when: number,
    o: { rate?: number; gain?: number; lowpass?: number; offset?: number },
  ): void {
    if (!buf || !this.ctx || !this.master) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate ?? 1;
    const gain = this.ctx.createGain();
    gain.gain.value = o.gain ?? 1;
    let node: AudioNode = src;
    if (o.lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      node.connect(f);
      node = f;
    }
    // leichte Stereo-Position: Wagen/Glocke sitzen eher links bzw. mittig
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.15;
    node.connect(gain).connect(pan).connect(this.master);
    src.start(when, Math.min(o.offset ?? 0, buf.duration - 0.05));
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  private async load(): Promise<void> {
    const base = `${import.meta.env.BASE_URL}sounds/`;
    const fetchBuf = async (name: string) => {
      const res = await fetch(base + name);
      return this.ctx!.decodeAudioData(await res.arrayBuffer());
    };
    const names = Array.from({ length: STRIKE_COUNT }, (_, i) => `strike_${String(i + 1).padStart(2, '0')}.wav`);
    const [strikes, bell, ret] = await Promise.all([
      Promise.all(names.map(fetchBuf)),
      fetchBuf('bell.wav'),
      fetchBuf('return.wav'),
    ]);
    this.strikes = strikes;
    this.bell = bell;
    this.ret = ret;
  }
}
