/* Kopija za maraton v2 (segment MAR-05): izvor `marathon/weather/index.ts` (maraton v1) u 9443676 (iste vrednosti i pragovi), uz
   ciljni tempo iz strukture dana; kopija, ne uvoz — maraton v2 ne uvozi ništa van `marathon/v2/`. Dalje se razvija samo ovde. */
/* VREME NA DAN TRENINGA: odluke bez ikakvog ulaza/izlaza. Servis (`services/weather`) povlači prognozu; ovde je šta ona znači.

   Sve ostalo u aplikaciji opisuje PROŠLOST. Ovo je jedini podatak koji menja ODLUKU pre nego što izađeš: na 34 °C intervali na planskom
   tempu nisu isti trening nego drugi, teži, sa manjim prinosom.

   VRUĆINA je PROIZVODNA HEURISTIKA (ne dokazana kriva): literatura se slaže oko smera i reda veličine, ne oko tačne krive; brojevi prate
   uobičajenu trenersku smernicu (~1–2 % po 3 °C iznad ~15 °C) i namerno su konzervativni. Gleda se OSEĆAJ (apparent temperature), ne
   temperatura vazduha: vlažnost je ta koja ubija hlađenje znojenjem. */

import { dowShort, fmtClock, fmtDayMonth, fmtNum } from './format.ts';
import { paceForZone, type AppZone as Zone } from './paces.ts';
import type { WorkoutStructure } from './types.ts';

/** Sat prognoze: ključ je `YYYY-MM-DDTHH`. */
export interface ForecastHour {
  temp: number | null;
  osecaj: number | null;
  vlaga: number | null;
  vetar: number | null;
  kisa: number | null;
}
export type ForecastHours = Record<string, ForecastHour>;

export interface ForecastCache {
  at: number;
  lat: number;
  lon: number;
  sati: ForecastHours;
}

/* ------------------------------------------------------------- vrućina (heuristika) */

export interface HeatBand {
  /** Osećaj od kog traka važi (°C). */
  od: number;
  /** Približno usporavanje tempa u procentima. */
  pct: number;
  /** Savet; `%PCT%` se zamenjuje procentom pri prikazu. */
  rec: string;
}

export const HEAT_BANDS: readonly HeatBand[] = [
  {
    od: 35,
    pct: 8,
    rec: 'Preko 35 °C osećaja — kvalitetnu sesiju pomeri ili zameni laganim trčanjem. Tempo tu više ne meri formu.'
  },
  {
    od: 30,
    pct: 6,
    rec: 'Na ovoj vrućini radni deo drži po osećaju, ne po satu. Skrati ako puls ode iznad uobičajenog za taj tempo.'
  },
  {
    od: 25,
    pct: 4,
    rec: 'Toplo — ciljni tempo je realno oko %PCT% sporiji. To nije pad forme.'
  },
  { od: 20, pct: 2, rec: 'Blago toplo; računaj na oko %PCT% sporiji tempo pri istom naporu.' },
  { od: 15, pct: 1, rec: '' },
  { od: -99, pct: 0, rec: '' }
];

/** Traka vrućine za osećaj (°C); `null` kad osećaja nema. */
export function heatFor(feelsLike: number | null | undefined): HeatBand | null {
  if (feelsLike == null || !Number.isFinite(feelsLike)) return null;
  return HEAT_BANDS.find((b) => feelsLike >= b.od) ?? null;
}

/** Savet o vrućini sa ubačenim procentom; prazan string kad nema šta da se kaže. */
export const heatAdvice = (band: HeatBand | null): string =>
  band?.rec ? band.rec.replace('%PCT%', `${band.pct} %`) : '';

/** Tempo uz vrućinu: ciljni tempo uvećan za procenat. */
export const heatAdjustedPace = (paceSec: number, pct: number): number =>
  Math.round(paceSec * (1 + pct / 100));

const hh = (h: number): string => String(h).padStart(2, '0');

/** Prognoza za datum i sat; `null` kad je nema. */
export function hourFor(
  cache: Pick<ForecastCache, 'sati'> | null | undefined,
  date: string | null | undefined,
  hour: number
): ForecastHour | null {
  if (!cache?.sati || !date) return null;
  return cache.sati[`${date}T${hh(hour)}`] ?? null;
}

/** Trenutni sat — samo za DANAS i samo ako prognoza pokriva taj sat. */
export function hourNow(
  cache: Pick<ForecastCache, 'sati'> | null | undefined,
  date: string,
  today: string,
  nowHour: number
): { hour: number; z: ForecastHour } | null {
  if (date !== today) return null;
  const z = hourFor(cache, date, nowHour);
  return z ? { hour: nowHour, z } : null;
}

/** Sat treninga iz podešavanja (0–23), podrazumevano 18. */
/* ------------------------------------------------------------- najhladniji sat */

/** Koliko stepeni (osećaj) sat mora biti hladniji da se uopšte predloži (isti broj stoji u uputstvu). */
export const COOLER_HOUR_DELTA = 3;

/** Najhladniji sat u razumnom prozoru (5–21 h); nudi se samo kad je razlika ≥ 3 °C (inače pomeranje je smetnja, ne savet). */
export function bestHour(
  cache: Pick<ForecastCache, 'sati'> | null | undefined,
  date: string,
  chosen: number,
  today: string,
  nowHour: number
): { hour: number; osecaj: number } | null {
  if (!cache?.sati) return null;
  const first = date === today ? Math.max(5, nowHour + 1) : 5;
  let best: { hour: number; osecaj: number } | null = null;
  for (let h = first; h <= 21; h++) {
    const z = hourFor(cache, date, h);
    if (!z || z.osecaj == null) continue;
    if (!best || z.osecaj < best.osecaj - 0.01) best = { hour: h, osecaj: z.osecaj };
  }
  if (!best) return null;
  const cur = hourFor(cache, date, chosen);
  if (!cur || cur.osecaj == null) return best;
  return cur.osecaj - best.osecaj >= COOLER_HOUR_DELTA && best.hour !== chosen ? best : null;
}

/* ------------------------------------------------------------- ciljni tempo dana */

const ZONE_FOR_TAG: Readonly<Record<string, Zone>> = { lako: 'E', lr: 'LR' };

/** maraton v2: tempo glavnog dela strukture dana (prvi radni/trkački deo sa brojčanim tempom). */
function structurePace(s: WorkoutStructure | undefined): number | null {
  const main = s?.blocks.find((b) => ['work', 'race', 'test'].includes(b.step.kind))?.step;
  return main?.paceSec != null && main.paceSec > 0 ? main.paceSec : null;
}

/**
 * Ciljni tempo dana: iz sesije (maraton v2: iz strukture) kad postoji, inače iz reda predikcije; za lagana trčanja iz forme (v2 zone). Bez
 * osnove `null` — prilagođen tempo se ne izmišlja. Snaga i „rw" (trčanje/hod) tempo ne dobijaju.
 */
export function targetPace(
  day:
    | {
        tag?: string | null;
        session?: { paceSec?: number | null } | null;
        structure?: WorkoutStructure;
      }
    | null
    | undefined,
  predPace: number | null,
  vdot: number | null
): number | null {
  const s = day?.session?.paceSec ?? structurePace(day?.structure);
  if (s != null && s > 0) return s;
  if (predPace != null && predPace > 0) return predPace;
  const zone = day?.tag ? ZONE_FOR_TAG[day.tag] : undefined;
  if (!zone) return null;
  if (vdot == null || !Number.isFinite(vdot) || vdot < 20 || vdot > 85) return null;
  return paceForZone(vdot, zone);
}

/* ------------------------------------------------------------- kartica dana */

export interface WeatherPart {
  kind: 'b' | 'small';
  text: string;
}
export interface WeatherRow {
  label: string;
  parts: WeatherPart[];
}
export interface WeatherCardModel {
  /** „14.07. u 18:00". */
  extra: string;
  rows: WeatherRow[];
  /** Savet i napomena o proceni, jedan pasus. */
  note: string;
}

export interface WeatherCardInput {
  day: {
    rest?: boolean;
    date?: string | null;
    tag?: string | null;
    session?: { paceSec?: number | null } | null;
    structure?: WorkoutStructure;
  };
  today: string;
  nowHour: number;
  trainingHour: number;
  cache: Pick<ForecastCache, 'sati'> | null | undefined;
  /** Lokacija je uključena. */
  hasLocation: boolean;
  /** Tempo iz reda predikcije (prvi red dana) ili `null`. */
  predPace: number | null;
  vdot: number | null;
}

const temps = (x: ForecastHour): WeatherPart[] => {
  const out: WeatherPart[] = [{ kind: 'b', text: `${fmtNum(x.temp, 0)} °C` }];
  if (x.osecaj != null && x.temp != null && Math.abs(x.osecaj - x.temp) >= 1)
    out.push({ kind: 'small', text: `oseća se ${fmtNum(x.osecaj, 0)} °C` });
  return out;
};

/**
 * Kartica „Vreme" za dan koji predstoji. `null` kad je ne treba crtati: odmor, prošlost (prognoza za prošlost nema smisla), nema lokacije
 * ili prognoze za sat treninga. Prilagođen tempo uz vrućinu se računa SVUDA gde postoji osnova (v. `targetPace`), ne samo na kvalitetnim.
 */
export function weatherCard(input: WeatherCardInput): WeatherCardModel | null {
  const { day, today, trainingHour: sat } = input;
  if (!day || day.rest || !day.date) return null;
  if (day.date < today) return null;
  if (!input.hasLocation) return null;
  const z = hourFor(input.cache, day.date, sat);
  if (!z) return null;
  const heat = heatFor(z.osecaj);
  const rows: WeatherRow[] = [];
  const now = hourNow(input.cache, day.date, today, input.nowHour);
  if (now && now.hour !== sat) rows.push({ label: `sada · ${now.hour}:00`, parts: temps(now.z) });
  rows.push({
    label: now && now.hour !== sat ? `u ${sat}:00` : 'temperatura',
    parts: temps(z)
  });
  if (z.vlaga != null)
    rows.push({ label: 'vlažnost', parts: [{ kind: 'b', text: `${fmtNum(z.vlaga, 0)} %` }] });
  if (z.vetar != null)
    rows.push({ label: 'vetar', parts: [{ kind: 'b', text: `${fmtNum(z.vetar, 0)} km/h` }] });
  if (z.kisa != null)
    rows.push({ label: 'padavine', parts: [{ kind: 'b', text: `${fmtNum(z.kisa, 0)} %` }] });
  if (heat && heat.pct > 0) {
    const goal = targetPace(day, input.predPace, input.vdot);
    if (goal)
      rows.push({
        label: 'tempo uz vrućinu',
        parts: [
          { kind: 'b', text: fmtClock(heatAdjustedPace(goal, heat.pct)) },
          { kind: 'small', text: `umesto ${fmtClock(goal)} · +${heat.pct} %` }
        ]
      });
  }
  const better = bestHour(input.cache, day.date, sat, today, input.nowHour);
  const notes: string[] = [];
  if (heat?.rec) notes.push(heatAdvice(heat));
  if (better && z.osecaj != null)
    notes.push(
      `Hladnije je u ${better.hour}:00 (${day.date === today ? 'danas' : `${dowShort(day.date)} ${fmtDayMonth(day.date)}`}): osećaj ${fmtNum(better.osecaj, 0)} °C, ${Math.round(z.osecaj - better.osecaj)} °C manje nego u ${sat}:00.`
    );
  notes.push(
    'Procena usporavanja je približna, ne formula — služi da tempo na vrućini ne pročitaš kao pad forme.'
  );
  return { extra: `${fmtDayMonth(day.date)} u ${sat}:00`, rows, note: notes.join(' ') };
}
