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

/** Spielt den gewählten Song in Dauerschleife über den Musik-Bus; gestreamt statt vorab dekodiert. */
export class Music {
  private readonly el = new Audio();
  private readonly fader: GainNode;
  private track: TrackId | '' = '';
  private pauseTimer = 0;

  constructor(private readonly ctx: AudioContext, destination: AudioNode) {
    this.el.loop = true;
    this.fader = ctx.createGain();
    this.fader.gain.value = 0;
    ctx.createMediaElementSource(this.el).connect(this.fader).connect(destination);
  }

  set(track: TrackId | ''): void {
    if (track === this.track) return;
    const switching = !!this.track;
    this.track = track;
    window.clearTimeout(this.pauseTimer);
    const now = this.ctx.currentTime;
    this.fader.gain.cancelScheduledValues(now);
    this.fader.gain.setTargetAtTime(0, now, FADE / 4);
    this.pauseTimer = window.setTimeout(() => this.apply(), switching ? FADE * 1000 : 0);
  }

  private apply(): void {
    if (!this.track) return this.el.pause();
    this.el.src = `${import.meta.env.BASE_URL}music/${encodeURIComponent(this.track)}.mp3`;
    this.el.play().catch((err) => console.warn('Song konnte nicht abgespielt werden', err));
    const now = this.ctx.currentTime;
    this.fader.gain.cancelScheduledValues(now);
    this.fader.gain.setTargetAtTime(OUT_LEVEL, now, FADE / 2);
  }
}
