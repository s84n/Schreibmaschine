/** Eigene Songs aus `public/music`: angezeigt wird der Dateiname ohne Endung. */
export const TRACKS = ['SchreibMaschine - Asia', 'SchreibMaschine - Middle East', 'SchreibMaschine - America'] as const;

export type TrackId = (typeof TRACKS)[number];

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
