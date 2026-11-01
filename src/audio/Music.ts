/** Eigene Songs aus `public/music`; die Einträge sind die Dateinamen ohne Endung. */
export const TRACKS = [
  'SchreibMaschine - Asia',
  'SchreibMaschine - Middle East',
  'SchreibMaschine - America',
  'Schreibmaschine - Bossa Nova',
  'Schreibmaschine - Musette',
  'Schreibmaschine - India',
  'Schreibmaschine - Kora Westafrica',
  'Schreibmaschine - Flamenco',
  'Schreibmaschine - Tango Argentinia',
  'Schreibmaschine - Andes',
  'Schreibmaschine - Ethio Jazz Eastafrica',
  'Schreibmaschine - Koto Japan',
  'Schreibmaschine - Nocturne MiddleEurope',
  'Schreibmaschine - Northeurope Folk',
] as const;

export type TrackId = (typeof TRACKS)[number];

/** Anzeigename: nur der Titel, damit man in der Liste sofort sieht, was man wählt. */
export const trackTitle = (id: TrackId): string => SHORT_TITLES[id] ?? id.replace(/^Schreibmaschine - /i, '');

/** Wo der Dateiname mehr sagt, als in die Liste gehört. */
const SHORT_TITLES: Partial<Record<TrackId, string>> = {
  'Schreibmaschine - India': 'Raga',
  'Schreibmaschine - Kora Westafrica': 'Kora',
  'Schreibmaschine - Tango Argentinia': 'Tango',
  'Schreibmaschine - Ethio Jazz Eastafrica': 'Ethio Jazz',
  'Schreibmaschine - Koto Japan': 'Koto',
  'Schreibmaschine - Nocturne MiddleEurope': 'Nocturne',
  'Schreibmaschine - Northeurope Folk': 'Nordic Folk',
};

/** Ausgangspegel: Die Songs liegen bei etwa -16 LUFS und sollen leise unter den Maschinengeräuschen bleiben. */
const OUT_LEVEL = 0.75;
const FADE = 0.4;
/** Überblendung am Songende in Sekunden; kurz vorher lädt der zweite Spieler schon vor. */
const CROSSFADE = 5;
const PREPARE = 20;

/** Gleichbleibende Lautheit: Beide Songenden zusammen klingen so laut wie einer allein. */
const fadeCurve = (rising: boolean): Float32Array<ArrayBuffer> => {
  const curve = new Float32Array(64);
  for (let i = 0; i < curve.length; i++) {
    const t = i / (curve.length - 1);
    curve[i] = OUT_LEVEL * (rising ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2));
  }
  return curve;
};

interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
  /** Geladene Adresse, damit derselbe Song nicht doppelt angefordert wird */
  url: string;
}

/**
 * Spielt den gewählten Song in Dauerschleife über den Musik-Bus; gestreamt statt vorab dekodiert.
 * Zwei Spieler sorgen für den weichen Übergang: Kurz vor dem Ende beginnt der zweite von vorn und
 * blendet über. Beide bleiben auf Schleife gestellt: Verweigert ein Browser den zweiten Start
 * (iOS erlaubt ihn nur nach einer Berührung), läuft der Song einfach mit hartem Schnitt weiter.
 */
export class Music {
  private readonly decks: [Deck, Deck];
  private active = 0;
  private track: TrackId | '' = '';
  private pauseTimer = 0;
  private crossTimer = 0;
  private crossing = false;
  private crossBlocked = false;
  /** Zählt Songwechsel: Ein verspätetes play() eines alten Songs darf nichts mehr auslösen. */
  private generation = 0;

  constructor(private readonly ctx: AudioContext, destination: AudioNode) {
    const deck = (): Deck => {
      const el = new Audio();
      el.loop = true;
      el.preload = 'auto';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(destination);
      el.addEventListener('timeupdate', () => this.watch(el));
      return { el, gain, url: '' };
    };
    this.decks = [deck(), deck()];
  }

  set(track: TrackId | ''): void {
    if (track === this.track) return;
    const switching = !!this.track;
    this.track = track;
    this.generation++;
    this.crossing = this.crossBlocked = false;
    window.clearTimeout(this.pauseTimer);
    window.clearTimeout(this.crossTimer);
    const now = this.ctx.currentTime;
    for (const { gain } of this.decks) {
      const level = gain.gain.value;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(level, now);
      gain.gain.setTargetAtTime(0, now, FADE / 4);
    }
    this.pauseTimer = window.setTimeout(() => this.apply(), switching ? FADE * 1000 : 0);
  }

  private url(): string {
    return `${import.meta.env.BASE_URL}music/${encodeURIComponent(this.track)}.mp3`;
  }

  private load(deck: Deck): void {
    const url = this.url();
    if (deck.url === url) return;
    deck.url = url;
    deck.el.src = url;
  }

  private apply(): void {
    for (const { el } of this.decks) el.pause();
    if (!this.track) return;
    const deck = this.decks[this.active];
    this.load(deck);
    deck.el.currentTime = 0;
    deck.el.play().catch((err) => console.warn('Song konnte nicht abgespielt werden', err));
    const now = this.ctx.currentTime;
    deck.gain.gain.cancelScheduledValues(now);
    deck.gain.gain.setTargetAtTime(OUT_LEVEL, now, FADE / 2);
  }

  /** Läuft bei jedem Zeit-Update des spielenden Songs mit. */
  private watch(el: HTMLAudioElement): void {
    const current = this.decks[this.active];
    if (el !== current.el || !this.track || this.crossing || this.crossBlocked) return;
    const left = el.duration - el.currentTime;
    // Bei sehr kurzen Stücken bliebe vom Song kaum etwas übrig
    if (!Number.isFinite(left) || el.duration < CROSSFADE * 3) return;
    const next = this.decks[1 - this.active];
    if (left <= PREPARE) this.load(next);
    if (left <= CROSSFADE) this.crossfade(current, next, left);
  }

  private crossfade(from: Deck, to: Deck, seconds: number): void {
    this.crossing = true;
    const generation = this.generation;
    to.el.currentTime = 0;
    to.el
      .play()
      .then(() => {
        if (generation !== this.generation) return;
        const now = this.ctx.currentTime;
        for (const [deck, rising] of [[from, false], [to, true]] as const) {
          deck.gain.gain.cancelScheduledValues(now);
          deck.gain.gain.setValueCurveAtTime(fadeCurve(rising), now, seconds);
        }
        this.active = 1 - this.active;
        this.crossTimer = window.setTimeout(() => {
          from.el.pause();
          this.crossing = false;
        }, seconds * 1000 + 100);
      })
      .catch((err) => {
        if (generation !== this.generation) return;
        console.warn('Weicher Übergang nicht möglich, der Song läuft in der Schleife weiter', err);
        this.crossing = false;
        this.crossBlocked = true;
      });
  }
}
