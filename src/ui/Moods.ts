import type { Settings } from './Settings';

export type MoodId = 'rainnight' | 'sunday' | 'kyoto' | 'winter' | 'stars' | 'bosporus' | 'rio' | 'paris' | 'udaipur' | 'elmina' | 'granada' | 'laboca' | 'andes' | 'serengeti' | 'alps' | 'nordic';

type MoodPatch = Pick<Settings, 'view' | 'time' | 'rain' | 'lamp' | 'track'>;

/**
 * Stimmungen: Ein Klick stellt Aussicht, Tageszeit, Wetter, Licht und Musik zusammen.
 * Jede hat einen Song. Den Anschlag lassen sie in Ruhe: Der sanfte Anschlag bleibt allein Sache des Nutzers.
 */
export const MOODS: Record<MoodId, MoodPatch> = {
  rainnight: { view: 'chinavillage', time: 'night', rain: true, lamp: true, track: 'SchreibMaschine - Asia' },
  sunday: { view: 'mediterranean', time: 'day', rain: false, lamp: false, track: 'SchreibMaschine - America' },
  kyoto: { view: 'japanforest', time: 'day', rain: false, lamp: false, track: 'Schreibmaschine - Koto Japan' },
  winter: { view: 'winterlake', time: 'night', rain: false, lamp: true, track: 'Schreibmaschine - Northeurope Folk' },
  stars: { view: 'starnight', time: 'night', rain: false, lamp: false, track: 'Schreibmaschine - Nocturne MiddleEurope' },
  bosporus: { view: 'istanbul', time: 'day', rain: false, lamp: false, track: 'SchreibMaschine - Middle East' },
  rio: { view: 'rio', time: 'day', rain: false, lamp: false, track: 'Schreibmaschine - Bossa Nova' },
  paris: { view: 'paris', time: 'day', rain: false, lamp: true, track: 'Schreibmaschine - Musette' },
  udaipur: { view: 'udaipur', time: 'day', rain: false, lamp: false, track: 'Schreibmaschine - India' },
  elmina: { view: 'elmina', time: 'day', rain: false, lamp: false, track: 'Schreibmaschine - Kora Westafrica' },
  granada: { view: 'granada', time: 'day', rain: false, lamp: true, track: 'Schreibmaschine - Flamenco' },
  laboca: { view: 'buenosaires', time: 'day', rain: true, lamp: true, track: 'Schreibmaschine - Tango Argentinia' },
  andes: { view: 'machupicchu', time: 'day', rain: false, lamp: false, track: 'Schreibmaschine - Andes' },
  serengeti: { view: 'serengeti', time: 'day', rain: false, lamp: true, track: 'Schreibmaschine - Ethio Jazz Eastafrica' },
  alps: { view: 'alps', time: 'night', rain: false, lamp: true, track: 'Schreibmaschine - Nocturne MiddleEurope' },
  nordic: { view: 'nordiclake', time: 'day', rain: false, lamp: true, track: 'Schreibmaschine - Northeurope Folk' },
};

/** Die Stimmung, die den Einstellungen gerade entspricht. */
export function activeMood(s: Settings): MoodId | undefined {
  return (Object.keys(MOODS) as MoodId[]).find((id) => (Object.keys(MOODS[id]) as (keyof MoodPatch)[]).every((k) => MOODS[id][k] === s[k]));
}
