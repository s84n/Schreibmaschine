/** Eine feste Tropfstelle: tropft fast regelmäßig, jede mit eigenem Klang und Ort. */
interface DripSpot {
  period: number;
  freq: number;
  pan: number;
  gain: number;
  kind: 'puddle' | 'sill' | 'wood';
}

/** So viele Sekunden werden Klänge im Voraus geplant; muss über dem 1-s-Takt gedrosselter Timer liegen. */
const LOOKAHEAD = 1.6;

const DRIP_SPOTS: DripSpot[] = [
  { period: 1.15, freq: 620, pan: -0.55, gain: 0.3, kind: 'puddle' },
  { period: 1.9, freq: 2300, pan: 0.35, gain: 0.16, kind: 'sill' },
  { period: 2.7, freq: 840, pan: 0.7, gain: 0.26, kind: 'puddle' },
  { period: 3.6, freq: 420, pan: -0.2, gain: 0.22, kind: 'wood' },
  { period: 0.72, freq: 1050, pan: -0.8, gain: 0.13, kind: 'puddle' },
];

/**
 * Generiertes Regengeräusch – keine Dateien, keine Lizenzfragen.
 *
 * Aufgebaut, wie man Regen am Fenster hört: Rauschen in drei Bändern (durch die Scheibe
 * gedämpft) mit langsam wechselnder Stärke, Prasseln auf dem Glas, eine leise laufende Regenrinne
 * und einzelne Tropfstellen vom Dach, die mit etwas Raumklang aus dem Hintergrund kommen.
 */
export class RainSound {
  private readonly noise: AudioBuffer;
  private bus?: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private playing = false;
  private schedulers: (() => void)[] = [];
  private timer = 0;

  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode) {
    const len = ctx.sampleRate * 6;
    this.noise = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = this.noise.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
  }

  set(on: boolean): void {
    if (on === this.playing) return;
    this.playing = on;
    this.stop();
    if (!on) return;
    const bus = (this.bus = this.ctx.createGain());
    bus.gain.setValueAtTime(0, this.ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 2);
    bus.connect(this.out);
    this.startRain(bus);
    const tick = () => this.schedulers.forEach((run) => run());
    tick();
    this.timer = window.setInterval(tick, 300);
  }

  private startRain(bus: AudioNode): void {
    // Rauschbett: Fläche, Körper, tiefes Grollen; Scheibe und Raum nehmen die Höhen weg
    const bed = this.ctx.createGain();
    const glass = this.ctx.createBiquadFilter();
    glass.type = 'lowpass';
    glass.frequency.value = 6500;
    bed.connect(glass).connect(bus);
    this.layer(bed, 'bandpass', 3000, 0.075, 0.5);
    this.layer(bed, 'bandpass', 800, 0.13, 0.6);
    this.layer(bed, 'lowpass', 170, 0.13, 0.7);

    // Der Regen wird in langen Wellen stärker und schwächer
    this.loop(
      (t) => bed.gain.setTargetAtTime(0.65 + Math.random() * 0.55, t, 1.8),
      () => 3000 + Math.random() * 5000,
    );

    // Raumklang für alles, was von draußen kommt
    const room = this.ctx.createConvolver();
    room.buffer = this.outdoorImpulse();
    const wet = this.ctx.createGain();
    wet.gain.value = 0.35;
    const drips = this.ctx.createGain();
    drips.connect(bus);
    drips.connect(room).connect(wet).connect(bus);

    // Prasseln: viele sehr leise, helle Einschläge auf dem Glas
    this.loop(
      (t) => this.tick(bed, t, 2200 + Math.random() * 4300, 0.05 + Math.random() ** 3 * 0.32, (Math.random() - 0.5) * 1.6),
      () => 18 + Math.random() ** 2 * 170,
    );

    // Regenrinne: dichtes Glucksen aus vielen kleinen Blasen auf einer Seite
    this.loop(
      (t) => this.bubble(drips, t, 480 + Math.random() * 800, 0.012 + Math.random() ** 2 * 0.05, 0.75, 0.04),
      () => 25 + Math.random() * 110,
    );

    // Tropfstellen vom Dach: fast im Takt, mit leichtem Schwanken, ab und zu ein Doppeltropfen
    for (const spot of DRIP_SPOTS) {
      this.loop(
        (t) => {
          this.drip(drips, t, spot);
          if (Math.random() < 0.15) this.drip(drips, t + 0.09 + Math.random() * 0.12, spot, 0.6);
        },
        () => spot.period * 1000 * (0.82 + Math.random() * 0.36),
        Math.random() * spot.period * 1000,
      );
    }
  }

  private drip(out: AudioNode, t: number, spot: DripSpot, scale = 1): void {
    const f = spot.freq * (0.94 + Math.random() * 0.12);
    const g = spot.gain * scale * (0.7 + Math.random() * 0.45);
    if (spot.kind === 'puddle') {
      this.bubble(out, t, f, g, spot.pan, 0.075);
    } else if (spot.kind === 'sill') {
      // Blech der Fensterbank: heller Klang mit unharmonischem Oberton und kurzem Anschlag
      this.ping(out, t, f, g, spot.pan, 0.09);
      this.ping(out, t, f * 2.76, g * 0.4, spot.pan, 0.04);
      this.tick(out, t, 4000, g * 0.8, spot.pan);
    } else {
      // Holz, nasse Dielen: dumpfes Klopfen
      this.ping(out, t, f, g, spot.pan, 0.05);
      this.tick(out, t, 900, g * 0.7, spot.pan);
    }
  }

  /** Tropfen ins Wasser: eine Luftblase schwingt mit schnell steigender Tonhöhe. */
  private bubble(out: AudioNode, t: number, freq: number, gain: number, pan: number, length: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.7, t + length);
    this.voice(osc, out, gain, pan, t, length);
  }

  private ping(out: AudioNode, t: number, freq: number, gain: number, pan: number, length: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = freq;
    this.voice(osc, out, gain, pan, t, length);
  }

  private voice(osc: OscillatorNode, out: AudioNode, gain: number, pan: number, t: number, length: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(g).connect(p).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.01);
  }

  /** Sehr kurzer gefärbter Rauschimpuls: Einschlag auf dem Glas. */
  private tick(out: AudioNode, now: number, freq: number, gain: number, pan = 0): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.015 + Math.random() * 0.04);
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(out);
    src.start(now, Math.random() * 5, 0.08);
  }

  private layer(out: AudioNode, type: BiquadFilterType, freq: number, gain: number, q: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(out);
    src.start(0, Math.random() * 5);
    this.sources.push(src);
  }

  /** Abklingendes, dunkles Rauschen: klingt nach Hof und Hauswand statt nach Zimmer. */
  private outdoorImpulse(): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * 0.7);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += 0.35 * (Math.random() * 2 - 1 - lp);
        d[i] = lp * (1 - i / len) ** 3;
      }
    }
    return buf;
  }

  /**
   * Plant `fn` in zufälligen Abständen (ms) auf der Audio-Uhr. Vorausplanung statt einzelner
   * Zeitgeber: Browser drosseln Timer in Hintergrund-Tabs, der Rhythmus bliebe sonst nicht erhalten.
   */
  private loop(fn: (t: number) => void, next: () => number, firstDelay = 0): void {
    let at = this.ctx.currentTime + firstDelay / 1000;
    this.schedulers.push(() => {
      const horizon = this.ctx.currentTime + LOOKAHEAD;
      while (at < horizon) {
        fn(Math.max(at, this.ctx.currentTime));
        at += next() / 1000;
      }
    });
  }

  private stop(): void {
    window.clearInterval(this.timer);
    this.schedulers = [];
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
