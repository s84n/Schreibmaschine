export type SoundId = 'key' | 'strike' | 'space' | 'soft' | 'jam' | 'bell' | 'return';

export interface PlayOptions {
  /** Startposition im Sample in s */
  offset?: number;
  /** zusätzlicher Lautstärkefaktor */
  gain?: number;
  /** Stereoposition der Taste, -1 bis 1 */
  pan?: number;
  /** Zeichen des Anschlags: jeder Typenhebel behält seinen eigenen Klang */
  ch?: string;
  /** Umschaltung gedrückt: der Typenkorb ist mitbewegt, der Anschlag satter */
  heavy?: boolean;
}

const STRIKE_COUNT = 12;
/** Abklingende Eigenschwingungen des Blechgehäuses: Sie machen aus Einzelklängen eine Maschine. */
const BODY_MODES: [freq: number, gain: number, length: number][] = [
  [235, 0.11, 0.07],
  [410, 0.08, 0.05],
  [690, 0.05, 0.035],
];

/**
 * Web-Audio-Engine mit echten Aufnahmen. Ein Anschlag läuft ab wie an der echten Maschine:
 * Taste geht herunter, Type trifft die Walze (Aufnahme + Gummi + Gehäuse), die Schaltklinke
 * rückt den Wagen weiter, der Hebel fällt zurück. Jede Taste hat ihren eigenen Klang, und
 * schnelles Tippen trifft leiser und dumpfer als ein bewusster Einzelanschlag.
 *
 * Signalweg der Maschinengeräusche:
 *   Stimmen → EQ (Tiefen-Shelf + Präsenz) → Kompressor → Ausgang
 *                                         ↘ kleiner Raumhall (Faltung) ↗
 * Musik und Regen laufen über je einen eigenen Bus in den Ausgang; am Ende sitzt ein Limiter.
 */
export class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private sfx?: GainNode;
  private musicBus?: GainNode;
  private rainBus?: GainNode;
  private strikes: AudioBuffer[] = [];
  private bell?: AudioBuffer;
  private ret?: AudioBuffer;
  private volume = 0.8;
  private musicVolume = 0.5;
  private rainVolume = 0.5;
  private muted = false;
  private loading?: Promise<void>;
  private lastStrike = -1;
  private lastHit = 0;
  private noise?: AudioBuffer;

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
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    this.noise.getChannelData(0).forEach((_, i, d) => (d[i] = Math.random() * 2 - 1));
    this.sfx = ctx.createGain();
    this.sfx.connect(this.buildSfxChain(ctx, this.master));
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.rainBus = ctx.createGain();
    this.rainBus.connect(this.master);
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

  /** Kontext und Regen-Bus für das Regengeräusch. */
  get rain(): { ctx: AudioContext; out: AudioNode } {
    this.init();
    return { ctx: this.ctx!, out: this.rainBus! };
  }

  setVolume(v: number): void {
    this.volume = v;
    this.applyVolume();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    this.applyVolume();
  }

  setRainVolume(v: number): void {
    this.rainVolume = v;
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
      case 'key': {
        // Taste trifft die Führung, kurz bevor die Type die Walze erreicht
        const out = this.panned(opts.pan);
        this.burst(out, when, 1900 + Math.random() * 500, 1, 0.028 * g, 0.006);
        this.thump(when, 0.02 * g, 170, out);
        break;
      }
      case 'strike':
        this.strike(when, opts);
        break;
      case 'space':
        // Leertaste: kein Typenaufschlag, nur Schaltschritt – dumpfer und leiser
        this.playBuffer(this.pickStrike(), when, { rate: 0.78 + Math.random() * 0.05, gain: 0.45 * g, lowpass: 1400 });
        this.thump(when, 0.3 * g, 70);
        this.escapement(when + 0.018, 0.8 * g);
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

  /** Typenanschlag mit allem, was mitklingt. */
  private strike(when: number, opts: PlayOptions): void {
    const gap = when - this.lastHit;
    this.lastHit = when;
    // Ein bewusster Einzelanschlag trifft härter als einer mitten im schnellen Tippen
    const force = (0.68 + 0.2 * Math.min(1, gap / 0.35) + Math.random() * 0.2 + (opts.heavy ? 0.08 : 0)) * (opts.gain ?? 1);
    const voice = hash(opts.ch?.toLowerCase() ?? '');
    const out = this.panned(opts.pan);

    this.playBuffer(this.pickStrike(voice), when, {
      rate: 0.97 + (voice % 7) * 0.01 + Math.random() * 0.012,
      gain: force,
      lowpass: 2500 + 7000 * force * force,
      out,
    });
    // Gummiwalze und Gehäuse: Die Aufnahme allein ist hell und dünn
    this.burst(out, when, 1150 + (voice % 5) * 90, 1, 0.32 * force, 0.016);
    this.thump(when, 0.34 * force, 85 + Math.random() * 15, out);
    for (const [freq, gain, length] of BODY_MODES) this.ring(out, when, freq * (0.99 + Math.random() * 0.02), gain * force, length);

    this.escapement(when + 0.03 + Math.random() * 0.008, force);

    // Der Hebel fällt zurück auf die Ablage
    const back = when + 0.1 + (voice % 4) * 0.008 + Math.random() * 0.012;
    this.burst(out, back, 850, 1.5, 0.04 * force, 0.012);
    this.thump(back, 0.025 * force, 135, out);
  }

  /** Schaltklinke: Der Wagen rückt um einen Schritt, ein feiner metallischer Tick. */
  private escapement(when: number, force: number): void {
    const out = this.sfx!;
    this.burst(out, when, 3800 + Math.random() * 500, 3, 0.1 * force, 0.008);
    this.ring(out, when, 2650, 0.018 * force, 0.014);
  }

  private panned(pan = 0): AudioNode {
    const p = this.ctx!.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.sfx!);
    return p;
  }

  /** Kurzer gefärbter Rauschimpuls. */
  private burst(out: AudioNode, when: number, freq: number, q: number, gain: number, length: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + length);
    src.connect(f).connect(env).connect(out);
    src.start(when, Math.random() * 0.9, length + 0.01);
  }

  /** Abklingender Sinus: Schwingung eines Metallteils. */
  private ring(out: AudioNode, when: number, freq: number, gain: number, length: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), when + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(env).connect(out);
    osc.start(when);
    osc.stop(when + length + 0.01);
  }

  /** Tieffrequenter Körperschall: der Anschlag überträgt sich auf Gehäuse und Tisch. */
  private thump(when: number, gain: number, freq: number, out: AudioNode = this.sfx!): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.6, when);
    osc.frequency.exponentialRampToValueAtTime(freq, when + 0.03);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    osc.connect(env).connect(out);
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
    // Sanft eingestellt, damit harte und weiche Anschläge unterscheidbar bleiben
    comp.threshold.value = -20;
    comp.knee.value = 8;
    comp.ratio.value = 2.5;
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

  /** Ohne `voice` ein beliebiges Sample, sonst eins aus der kleinen Gruppe dieser Taste. */
  private pickStrike(voice?: number): AudioBuffer | undefined {
    const n = this.strikes.length;
    if (!n) return undefined;
    let i = voice === undefined ? Math.floor(Math.random() * n) : (voice + Math.floor(Math.random() * 4)) % n;
    if (i === this.lastStrike) i = (i + 1) % n;
    this.lastStrike = i;
    return this.strikes[i];
  }

  private playBuffer(
    buf: AudioBuffer | undefined,
    when: number,
    o: { rate?: number; gain?: number; lowpass?: number; offset?: number; out?: AudioNode },
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
    node.connect(gain).connect(o.out ?? this.panned((Math.random() - 0.5) * 0.15));
    src.start(when, Math.min(o.offset ?? 0, buf.duration - 0.05));
  }

  private applyVolume(): void {
    if (!this.master || !this.sfx || !this.musicBus || !this.rainBus) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfx.gain.value = this.volume;
    this.musicBus.gain.value = this.musicVolume;
    this.rainBus.gain.value = this.rainVolume;
  }

  /** Schneidet die Stille vor dem Aufschlag ab: Die Samples beginnen bis zu 30 ms versetzt. */
  private trimToOnset(buf: AudioBuffer): AudioBuffer {
    const data = buf.getChannelData(0);
    const peak = data.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
    const hit = data.findIndex((v) => Math.abs(v) >= peak * 0.3);
    const start = Math.max(0, hit - Math.floor(buf.sampleRate * 0.001));
    const out = this.ctx!.createBuffer(1, buf.length - start, buf.sampleRate);
    out.copyToChannel(data.subarray(start), 0);
    return out;
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
    this.strikes = strikes.map((s) => this.trimToOnset(s));
    this.bell = bell;
    this.ret = ret;
  }
}

function hash(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
