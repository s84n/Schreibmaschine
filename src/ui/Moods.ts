import type { Settings } from './Settings';

export type MoodId = 'rainnight' | 'sunday' | 'kyoto' | 'winter' | 'stars' | 'bosporus' | 'rio' | 'paris' | 'udaipur' | 'elmina' | 'granada' | 'laboca' | 'andes' | 'serengeti' | 'alps' | 'nordic';

type MoodPatch = Pick<Settings, 'view' | 'time' | 'rain' | 'lamp' | 'track' | 'softStrike'>;

/** Stimmungen: Ein Klick stellt Aussicht, Tageszeit, Wetter, Licht, Musik und Anschlag zusammen. */
export const MOODS: Record<MoodId, MoodPatch> = {
  rainnight: { view: 'nordiclake', time: 'night', rain: true, lamp: true, track: 'SchreibMaschine - Asia', softStrike: true },
  sunday: { view: 'mediterranean', time: 'day', rain: false, lamp: false, track: 'SchreibMaschine - America', softStrike: false },
  kyoto: { view: 'japanforest', time: 'day', rain: false, lamp: false, track: 'Schreibmaschine - Koto Japan', softStrike: false },
  winter: { view: 'winterlake', time: 'night', rain: false, lamp: true, track: '', softStrike: true },
  stars: { view: 'starnight', time: 'night', rain: false, lamp: false, track: '', softStrike: true },
  bosporus: { view: 'istanbul', time: 'day', rain: false, lamp: false, track: 'SchreibMaschine - Middle East', softStrike: false },
  rio: { view: 'rio', time: 'day', rain: false, lamp: false, track: 'Schreibmaschine - Bossa Nova', softStrike: false },
  paris: { view: 'paris', time: 'day', rain: false, lamp: true, track: 'Schreibmaschine - Musette', softStrike: false },
  udaipur: { view: 'udaipur', time: 'day', rain: false, lamp: false, track: 'Schreibmaschine - India', softStrike: true },
  elmina: { view: 'elmina', time: 'day', rain: false, lamp: false, track: 'Schreibmaschine - Kora Westafrica', softStrike: false },
  granada: { view: 'granada', time: 'day', rain: false, lamp: true, track: 'Schreibmaschine - Flamenco', softStrike: true },
  laboca: { view: 'buenosaires', time: 'day', rain: true, lamp: true, track: 'Schreibmaschine - Tango Argentinia', softStrike: true },
  andes: { view: 'machupicchu', time: 'day', rain: false, lamp: false, track: 'Schreibmaschine - Andes', softStrike: false },
  serengeti: { view: 'serengeti', time: 'day', rain: false, lamp: true, track: 'Schreibmaschine - Ethio Jazz Eastafrica', softStrike: false },
  alps: { view: 'alps', time: 'night', rain: false, lamp: true, track: 'Schreibmaschine - Nocturne MiddleEurope', softStrike: true },
  nordic: { view: 'nordiclake', time: 'day', rain: false, lamp: true, track: 'Schreibmaschine - Northeurope Folk', softStrike: true },
};

/** Die Stimmung, die den Einstellungen gerade entspricht. */
export function activeMood(s: Settings): MoodId | undefined {
  return (Object.keys(MOODS) as MoodId[]).find((id) => (Object.keys(MOODS[id]) as (keyof MoodPatch)[]).every((k) => MOODS[id][k] === s[k]));
}
