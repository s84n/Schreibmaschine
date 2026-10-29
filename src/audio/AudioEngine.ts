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
 *
 * Signalweg der Maschinengeräusche:
 *   Stimmen → EQ (Tiefen-Shelf + Präsenz) → Kompressor → Ausgang
 *                                         ↘ kleiner Raumhall (Faltung) ↗
 * Musik läuft über einen eigenen Bus in den Ausgang; am Ende sitzt ein Limiter.
 */
export class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private sfx?: GainNode;
  private musicBus?: GainNode;
  private strikes: AudioBuffer[] = [];
  private bell?: AudioBuffer;
  private ret?: AudioBuffer;
  private volume = 0.8;
  private musicVolume = 0.5;
  private muted = false;
  private loading?: Promise<void>;
  private lastStrike = -1;

  /** Lädt die Samples vorab; der Kontext startet bis zur ersten Nutzergeste pausiert. */
  init(): void {
    if (this.ctx) return;
    const ctx = (this.ctx = new AudioContext({ latencyHint: 'interactive' }));
    this.master = ctx.createGain();
    // Limiter am Ende: fängt Spitzen ab, wenn Anschläge, Glocke und Musik zusammenfallen
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    this.master.connect(limiter).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.buildSfxChain(ctx, this.master));
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.applyVolume();
    this.loading = this.load().catch((err) => console.warn('Sounds konnten nicht geladen werden', err));
  }

  /** Muss aus einer Nutzergeste heraus aufgerufen werden (Autoplay-Richtlinien). */
  unlock(): void {
    this.init();
    if (this.ctx!.state === 'suspended') void this.ctx!.resume();
  }

  /** Kontext und Musik-Bus für die Hintergrundmusik. */
  get music(): { ctx: AudioContext; out: AudioNode } {
    this.init();
    return { ctx: this.ctx!, out: this.musicBus! };
  }

  setVolume(v: number): void {
    this.volume = v;
    this.applyVolume();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    this.applyVolume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }

  /** Spielt einen Klang nach `delay` Sekunden. */
  play(id: SoundId, delay = 0, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || !this.loading) return;
    const when = ctx.currentTime + Math.max(0, delay);
    const g = opts.gain ?? 1;

    switch (id) {
      case 'strike':
        this.playBuffer(this.pickStrike(), when, { rate: 0.95 + Math.random() * 0.1, gain: (0.75 + Math.random() * 0.25) * g });
        this.thump(when, 0.22 * g, 85 + Math.random() * 15);
        break;
      case 'space':
        // Leertaste: kein Typenaufschlag, nur Schaltschritt – dumpfer und leiser
        this.playBuffer(this.pickStrike(), when, { rate: 0.78 + Math.random() * 0.05, gain: 0.45 * g, lowpass: 1400 });
        this.thump(when, 0.3 * g, 70);
        break;
      case 'soft':
        this.playBuffer(this.pickStrike(), when, { rate: 0.7, gain: 0.3 * g, lowpass: 900 });
        break;
      case 'jam':
        this.playBuffer(this.pickStrike(), when, { rate: 0.6, gain: 0.35 * g, lowpass: 600 });
        break;
      case 'bell':
        this.playBuffer(this.bell, when, { rate: 0.98 + Math.random() * 0.04, gain: 0.6 * g });
        break;
      case 'return':
        // Zeilenschaltung: zwei Ratschen-Klicks des Hebels, dann Wagenlauf + Anschlag
        for (const dt of [0, 0.055]) {
          this.playBuffer(this.pickStrike(), when + dt, { rate: 1.35 + Math.random() * 0.1, gain: 0.32 * g, lowpass: 3500 });
        }
        this.playBuffer(this.ret, when + 0.04, { gain: 1.0 * g, offset: opts.offset });
        break;
    }
  }

  /** Tieffrequenter Körperschall: der Anschlag überträgt sich auf Gehäuse und Tisch. */
  private thump(when: number, gain: number, freq: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.6, when);
    osc.frequency.exponentialRampToValueAtTime(freq, when + 0.03);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    osc.connect(env).connect(this.sfx!);
    osc.start(when);
    osc.stop(when + 0.1);
  }

  private buildSfxChain(ctx: AudioContext, out: AudioNode): AudioNode {
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 180;
    low.gain.value = 5;
    const box = ctx.createBiquadFilter();
    box.type = 'peaking';
    box.frequency.value = 600;
    box.Q.value = 1.2;
    box.gain.value = -2.5;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3500;
    presence.Q.value = 0.9;
    presence.gain.value = 2;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.knee.value = 8;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;
    const makeup = ctx.createGain();
    makeup.gain.value = 1.5;

    low.connect(box).connect(presence).connect(comp).connect(makeup).connect(out);

    // Kleiner Holzraum: kurzer, dunkler Hall, sehr dezent beigemischt
    const verb = ctx.createConvolver();
    verb.buffer = this.roomImpulse(ctx, 0.9);
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    presence.connect(verb).connect(wet).connect(out);
    return low;
  }

  /** Synthetische Raumimpulsantwort: Rauschen mit exponentiellem Abklingen, nach hinten dunkler. */
  private roomImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const k = 0.6 - 0.5 * t; // Tiefpass wird mit der Zeit stärker
        lp += k * ((Math.random() * 2 - 1) - lp);
        // frühe Reflexionen etwas betonen
        const early = i < rate * 0.03 && Math.random() < 0.004 ? 2.5 : 1;
        data[i] = lp * early * Math.pow(1 - t, 3.2);
      }
    }
    return buf;
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
    if (!buf || !this.ctx || !this.sfx) return;
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
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.15;
    node.connect(gain).connect(pan).connect(this.sfx);
    src.start(when, Math.min(o.offset ?? 0, buf.duration - 0.05));
  }

  private applyVolume(): void {
    if (!this.master || !this.sfx || !this.musicBus) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfx.gain.value = this.volume;
    this.musicBus.gain.value = this.musicVolume;
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
