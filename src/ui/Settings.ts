import { TRACKS, type TrackId } from '../audio/Music';
import type { LayoutId } from '../input/layouts';
import type { ViewId } from '../scene/Room';
import type { Quality, TimeOfDay } from '../scene/Scene';
import type { RibbonId } from '../state/Document';
import type { BodyColorId, ModelId } from '../typewriter/materials';
import type { Lang } from './i18n';

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
  time: TimeOfDay;
  ribbon: RibbonId;
  model: ModelId;
  rain: boolean;
  dust: boolean;
  shafts: boolean;
  ao: boolean;
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
    time: 'day',
    ribbon: 'black',
    model: 'reise',
    rain: false,
    dust: true,
    shafts: true,
    ao: true,
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
