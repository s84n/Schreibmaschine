import { TRACKS, type TrackId } from '../audio/Music';
import type { LayoutId } from '../input/layouts';
import type { ViewId } from '../scene/Room';
import type { Quality, TimeOfDay } from '../scene/Scene';
import type { RibbonId } from '../state/Document';
import type { BodyColorId, ModelId } from '../typewriter/materials';
import type { PaperTone } from '../paper/InkCanvas';
import type { Lang } from './i18n';

export type TextSize = 'normal' | 'large' | 'xlarge';

export interface Settings {
  layout: LayoutId;
  lang: Lang;
  volume: number;
  muted: boolean;
  quality: Quality;
  color: BodyColorId;
  view: ViewId;
  track: TrackId | '';
  musicVolume: number;
  rainVolume: number;
  time: TimeOfDay;
  ribbon: RibbonId;
  model: ModelId;
  rain: boolean;
  dust: boolean;
  shafts: boolean;
  life: boolean;
  ao: boolean;
  /** Sanfter Umbruch am Zeilenende */
  softWrap: boolean;
  /** Korrekturband: Rücktaste entfernt das Zeichen */
  correction: boolean;
  /** Schreibtischlampe an */
  lamp: boolean;
  /** Gedämpfter Anschlag */
  softStrike: boolean;
  bellVolume: number;
  returnVolume: number;
  /** Akku-Modus */
  saver: boolean;
  /** Ruhige Bewegung */
  calm: boolean;
  textSize: TextSize;
  paperTone: PaperTone;
  /** Leuchtende Punkte an den bedienbaren Dingen */
  hints: boolean;
  /** Dinge, die schon einmal benutzt wurden und keinen Punkt mehr brauchen */
  hintsSeen: string[];
}

const KEY = 'schreibmaschine.settings';

function defaults(): Settings {
  const lang: Lang = navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
  const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4 || /Mobi|Android/i.test(navigator.userAgent);
  return {
    layout: lang === 'de' ? 'qwertz' : 'qwerty',
    lang,
    volume: 0.8,
    muted: false,
    quality: lowEnd ? 'low' : 'high',
    color: 'sage',
    view: 'alps',
    track: '',
    musicVolume: 0.5,
    rainVolume: 0.5,
    time: 'day',
    ribbon: 'black',
    model: 'reise',
    rain: false,
    dust: true,
    shafts: true,
    life: true,
    ao: true,
    softWrap: true,
    correction: false,
    lamp: true,
    softStrike: false,
    bellVolume: 1,
    returnVolume: 1,
    saver: false,
    calm: matchMedia('(prefers-reduced-motion: reduce)').matches,
    textSize: 'normal',
    paperTone: 'classic',
    hints: true,
    hintsSeen: [],
  };
}

export function loadSettings(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    // Bis v0.12 war Regen ein Wert der entfernten Einstellung „Geräuschkulisse“
    // Bis v0.18 war Musik ein Schalter für das generative Stück: wer sie hörte, bekommt den ersten Song
    const { ambience, music, ...stored } = JSON.parse(raw) as Partial<Settings> & { ambience?: string; music?: boolean };
    const merged = { ...base, ...stored, ...(ambience === 'rain' ? { rain: true } : {}) };
    if (music && stored.track === undefined) merged.track = TRACKS[0];
    // Bis v0.20 teilten sich Musik und Regen einen Regler: Der Regen bleibt so laut wie zuletzt
    if (stored.rainVolume === undefined && stored.musicVolume !== undefined) merged.rainVolume = stored.musicVolume;
    // Bis v0.19 hieß „America“ noch „Song 1“
    if ((merged.track as string) === 'SchreibMaschine - Song 1') merged.track = 'SchreibMaschine - America';
    if (merged.track && !TRACKS.includes(merged.track)) merged.track = '';
    return merged;
  } catch {
    return base;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignorieren */
  }
}
