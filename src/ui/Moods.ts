import type { Settings } from './Settings';

export type MoodId = 'rainnight' | 'sunday' | 'kyoto' | 'winter' | 'stars' | 'bosporus';

type MoodPatch = Pick<Settings, 'view' | 'time' | 'rain' | 'lamp' | 'track' | 'softStrike'>;

/** Stimmungen: Ein Klick stellt Aussicht, Tageszeit, Wetter, Licht, Musik und Anschlag zusammen. */
export const MOODS: Record<MoodId, MoodPatch> = {
  rainnight: { view: 'nordiclake', time: 'night', rain: true, lamp: true, track: 'SchreibMaschine - Asia', softStrike: true },
  sunday: { view: 'mediterranean', time: 'day', rain: false, lamp: false, track: 'SchreibMaschine - America', softStrike: false },
  kyoto: { view: 'japanforest', time: 'day', rain: false, lamp: false, track: 'SchreibMaschine - Asia', softStrike: false },
  winter: { view: 'winterlake', time: 'night', rain: false, lamp: true, track: '', softStrike: true },
  stars: { view: 'starnight', time: 'night', rain: false, lamp: false, track: '', softStrike: true },
  bosporus: { view: 'istanbul', time: 'day', rain: false, lamp: false, track: 'SchreibMaschine - Middle East', softStrike: false },
};

/** Die Stimmung, die den Einstellungen gerade entspricht. */
export function activeMood(s: Settings): MoodId | undefined {
  return (Object.keys(MOODS) as MoodId[]).find((id) => (Object.keys(MOODS[id]) as (keyof MoodPatch)[]).every((k) => MOODS[id][k] === s[k]));
}
