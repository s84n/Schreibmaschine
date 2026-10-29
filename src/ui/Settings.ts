import type { LayoutId } from '../input/layouts';
import type { Quality } from '../scene/Scene';
import type { BodyColorId } from '../typewriter/materials';
import type { Lang } from './i18n';

export interface Settings {
  layout: LayoutId;
  lang: Lang;
  volume: number;
  muted: boolean;
  quality: Quality;
  color: BodyColorId;
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
  };
}

export function loadSettings(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...base, ...(JSON.parse(raw) as Partial<Settings>) } : base;
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
