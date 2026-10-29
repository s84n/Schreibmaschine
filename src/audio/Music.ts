/**
 * Generativer Lo-Fi-Jazz: E-Piano (FM-Synthese), Bass, Besen-Schlagzeug mit Swing,
 * sparsame Melodie und Vinyl-Knistern. Komplett in Web Audio erzeugt – keine Dateien,
 * keine Lizenzfragen, nie exakt gleich.
 */

interface Chord {
  bass: number;
  notes: number[];
  /** Töne für die Melodie (Akkord + Pentatonik), eine Oktave höher gespielt */
  scale: number[];
}

// 8 Takte in F-Dur: Fmaj9 – Am9 – Dm9 – G13 – Gm9 – C9 – Fmaj7 – Bbmaj9
const PROGRESSION: Chord[] = [
  { bass: 41, notes: [57, 60, 64, 67], scale: [65, 67, 69, 72, 74, 76] },
  { bass: 45, notes: [55, 60, 64, 71], scale: [64, 67, 69, 71, 72, 76] },
  { bass: 38, notes: [53, 57, 60, 64], scale: [62, 64, 65, 69, 72, 74] },
  { bass: 43, notes: [53, 59, 64, 69], scale: [62, 64, 67, 69, 71, 74] },
  { bass: 43, notes: [58, 62, 65, 69], scale: [62, 65, 67, 69, 70, 74] },
  { bass: 36, notes: [58, 62, 64, 69], scale: [60, 62, 64, 67, 69, 72] },
  { bass: 41, notes: [57, 60, 64, 69], scale: [64, 65, 67, 69, 72, 76] },
  { bass: 46, notes: [62, 65, 69, 72], scale: [62, 65, 67, 69, 72, 74] },
];

const BPM = 72;
const BEAT = 60 / BPM;
const SWING = 0.62;
const STEPS_PER_BAR = 8;
/** Ausgangspegel – Musik soll leise unter den Maschinengeräuschen liegen */
const OUT_LEVEL = 0.5;

/** Begleitrhythmen des E-Pianos: [Schlag, Dauer in Schlägen] */
const COMP_PATTERNS: [number, number][][] = [
  [[0, 3.5]],
  [[0, 1.4], [1.5, 2.4]],
  [[0, 2], [2.5, 1.4]],
  [[-0.5, 2.5], [2.5, 1.5]],
  [[0, 1], [1.5, 1], [3, 1]],
];

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export class Music {
  private readonly out: GainNode;
  private readonly epBus: GainNode;
  private readonly drumBus: GainNode;
  private readonly wow: GainNode;
  private noise?: AudioBuffer;
  private crackle?: AudioBufferSourceNode;
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  private running = false;
  private lastMelody = 0;

  constructor(private readonly ctx: AudioContext, destination: AudioNode) {
    // Ausgang: Fader → warmer Tiefpass → leichte Sättigung
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 5200;
    tone.Q.value = 0.5;
    const sat = ctx.createWaveShaper();
    sat.curve = this.saturationCurve(1.6);
    this.out.connect(tone).connect(sat).connect(destination);

    // E-Piano-Bus mit Tremolo und sanftem Hochpass
    this.epBus = ctx.createGain();
    this.epBus.gain.value = 1.7;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 120;
    const trem = ctx.createGain();
    const tremLfo = ctx.createOscillator();
    tremLfo.frequency.value = 4.2;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.12;
    tremLfo.connect(tremDepth).connect(trem.gain);
    tremLfo.start();
    this.epBus.connect(hp).connect(trem).connect(this.out);

    this.drumBus = ctx.createGain();
    this.drumBus.gain.value = 0.8;
    const drumTone = ctx.createBiquadFilter();
    drumTone.type = 'lowpass';
    drumTone.frequency.value = 4200;
    this.drumBus.connect(drumTone).connect(this.out);

    // "Wow & Flutter" wie bei Tonband/Platte: langsames Tonhöhenschwanken in Cent
    const wowLfo = ctx.createOscillator();
    wowLfo.frequency.value = 0.45;
    this.wow = ctx.createGain();
    this.wow.gain.value = 7;
    wowLfo.connect(this.wow);
    wowLfo.start();
  }

  get playing(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const now = this.ctx.currentTime;
    this.noise ??= this.makeNoise();
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(OUT_LEVEL, now + 2.5);
    this.startCrackle();
    this.step = 0;
    this.nextTime = now + 0.15;
    this.timer = window.setInterval(() => this.schedule(), 50);
    this.schedule();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + 1.5);
    window.clearInterval(this.timer);
    const crackle = this.crackle;
    this.crackle = undefined;
    window.setTimeout(() => crackle?.stop(), 1600);
  }

  // ───────────────────────── Sequenzer ─────────────────────────

  private schedule(): void {
    // Im Hintergrund-Tab drosselt der Browser Timer → weiter vorausplanen
    const lookahead = document.hidden ? 1.5 : 0.35;
    while (this.nextTime < this.ctx.currentTime + lookahead) {
      this.playStep(this.step, this.nextTime);
      this.step++;
      // Swing: das zweite Achtel jedes Schlags kommt später
      const onBeat = this.step % 2 === 1;
      this.nextTime += onBeat ? BEAT * SWING : BEAT * (1 - SWING);
    }
  }

  private playStep(step: number, t: number): void {
    const inBar = step % STEPS_PER_BAR;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const chord = PROGRESSION[bar % PROGRESSION.length];
    const beat = inBar / 2;

    if (inBar === 0) this.playBar(chord, t, bar);

    // Schlagzeug
    const intro = bar < 2; // die ersten zwei Takte nur Piano und Bass
    if (!intro) {
      if (beat === 0 || beat === 2.5 || (beat === 1.5 && Math.random() < 0.25)) this.kick(t, beat === 0 ? 0.55 : 0.4);
      if (beat === 1 || beat === 3) this.snare(t, rand(0.18, 0.24));
      this.hat(t, inBar % 2 === 1 ? rand(0.09, 0.14) : rand(0.045, 0.08));
    }

    // Melodie: sparsam, eher auf Zählzeiten, kleine Schritte
    if (bar >= 4 && Math.random() < (inBar % 2 === 0 ? 0.22 : 0.1)) {
      const scale = chord.scale;
      let idx = Math.max(0, Math.min(scale.length - 1, this.lastMelody + Math.round(rand(-2, 2))));
      if (Math.random() < 0.2) idx = Math.floor(Math.random() * scale.length);
      this.lastMelody = idx;
      this.epiano(scale[idx] + 12, t + rand(0, 0.02), BEAT * rand(0.6, 1.4), rand(0.05, 0.08), 3.2);
    }
  }

  private playBar(chord: Chord, t: number, bar: number): void {
    // E-Piano-Begleitung mit leichtem Arpeggio ("Strum")
    for (const [b, dur] of pick(COMP_PATTERNS)) {
      const start = t + b * BEAT;
      if (start < this.ctx.currentTime) continue;
      const notes = Math.random() < 0.3 ? chord.notes.slice(1) : chord.notes;
      notes.forEach((n, i) => this.epiano(n, start + i * rand(0.008, 0.022), dur * BEAT, rand(0.07, 0.1), 2.2));
    }
    // Bass: Grundton auf 1, Quinte oder Oktave auf 3, ab und zu ein Durchgangston
    this.bass(chord.bass, t, BEAT * 1.7, 0.42);
    const second = Math.random() < 0.6 ? chord.bass + 7 : chord.bass + 12;
    this.bass(second, t + BEAT * 2, BEAT * 1.3, 0.32);
    if (bar % 2 === 1 && Math.random() < 0.5) this.bass(Math.random() < 0.5 ? chord.bass - 1 : chord.bass + 2, t + BEAT * 3.5, BEAT * 0.45, 0.25);
  }

  // ───────────────────────── Instrumente ─────────────────────────

  /** E-Piano: FM-Synthese (Träger + Modulator 1:1) mit abklingendem Modulationsindex. */
  private epiano(midi: number, t: number, dur: number, vel: number, brightness: number): void {
    const ctx = this.ctx;
    const f = midiToFreq(midi);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * brightness, t);
    modGain.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.5);
    mod.connect(modGain).connect(car.frequency);
    // Glöckchen-Anteil (Tine) beim Anschlag
    const tine = ctx.createOscillator();
    tine.frequency.value = f * 4;
    const tineEnv = ctx.createGain();
    tineEnv.gain.setValueAtTime(vel * 0.25, t);
    tineEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    this.wow.connect(car.detune);
    this.wow.connect(tine.detune);

    const env = ctx.createGain();
    const release = 0.6;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    env.gain.exponentialRampToValueAtTime(vel * 0.35, t + Math.min(dur, 1.2));
    env.gain.setValueAtTime(vel * 0.35, t + dur);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.35, 0.35);
    car.connect(env);
    tine.connect(tineEnv).connect(env);
    env.connect(pan).connect(this.epBus);
    const end = t + dur + release + 0.05;
    for (const o of [car, mod, tine]) {
      o.start(t);
      o.stop(end);
    }
    car.onended = () => {
      this.wow.disconnect(car.detune);
      this.wow.disconnect(tine.detune);
    };
  }

  private bass(midi: number, t: number, dur: number, vel: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiToFreq(midi);
    const sub = ctx.createOscillator();
    sub.frequency.value = midiToFreq(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vel, t + 0.015);
    env.gain.exponentialRampToValueAtTime(vel * 0.4, t + dur * 0.8);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    osc.connect(lp);
    sub.connect(lp);
    const level = ctx.createGain();
    level.gain.value = 0.25;
    lp.connect(env).connect(level).connect(this.out);
    for (const o of [osc, sub]) {
      o.start(t);
      o.stop(t + dur + 0.15);
    }
  }

  private kick(t: number, vel: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(vel * 0.5, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(env).connect(this.drumBus);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** Besen-Snare: gefiltertes Rauschen mit weichem Einschwingen. */
  private snare(t: number, vel: number): void {
    const ctx = this.ctx;
    const src = this.noiseSource(t, 0.3);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(1700, 2300);
    bp.Q.value = 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vel, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    src.connect(bp).connect(env).connect(this.drumBus);
    const body = ctx.createOscillator();
    body.frequency.value = 185;
    const bodyEnv = ctx.createGain();
    bodyEnv.gain.setValueAtTime(vel * 0.5, t);
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    body.connect(bodyEnv).connect(this.drumBus);
    body.start(t);
    body.stop(t + 0.08);
  }

  private hat(t: number, vel: number): void {
    const ctx = this.ctx;
    const src = this.noiseSource(t, 0.08);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vel, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.03, 0.06));
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0.3;
    src.connect(hp).connect(env).connect(pan).connect(this.drumBus);
  }

  /** Plattenknistern + leises Rauschen als Endlosschleife. */
  private startCrackle(): void {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += 0.05 * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * 0.25;
        if (Math.random() < 0.00035) {
          const amp = rand(0.2, 0.9) * (Math.random() < 0.5 ? -1 : 1);
          for (let k = 0; k < 30 && i + k < len; k++) d[i + k] += amp * Math.exp(-k / 4);
        }
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    src.connect(hp).connect(g).connect(this.out);
    src.start();
    this.crackle = src;
  }

  private noiseSource(t: number, dur: number): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise!;
    src.start(t, Math.random() * 1.5, dur);
    return src;
  }

  private makeNoise(): AudioBuffer {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private saturationCurve(amount: number): Float32Array<ArrayBuffer> {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }
}
