import type { AmbienceId } from '../audio/Ambience';
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
  music: boolean;
  musicVolume: number;
  time: TimeOfDay;
  ribbon: RibbonId;
  model: ModelId;
  ambience: AmbienceId;
  rain: boolean;
  cat: boolean;
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
    music: false,
    musicVolume: 0.5,
    time: 'day',
    ribbon: 'black',
    model: 'reise',
    ambience: 'off',
    rain: false,
    cat: true,
  };
}

export function loadSettings(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    const s: Settings = raw ? { ...base, ...(JSON.parse(raw) as Partial<Settings>) } : base;
    // Bis v0.12 war Regen eine Geräuschkulisse, jetzt ein eigener Schalter
    if (s.ambience === 'rain') return { ...s, ambience: 'off', rain: true };
    return s;
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
