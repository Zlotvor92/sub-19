/* VREME NA DAN TRENINGA: odluke bez ikakvog ulaza/izlaza. Servis (`services/weather`) povlači prognozu; ovde je šta ona znači.

   Sve ostalo u aplikaciji opisuje PROŠLOST. Ovo je jedini podatak koji menja ODLUKU pre nego što izađeš: na 34 °C intervali na planskom
   tempu nisu isti trening nego drugi, teži, sa manjim prinosom.

   VRUĆINA je PROIZVODNA HEURISTIKA (ne dokazana kriva): literatura se slaže oko smera i reda veličine, ne oko tačne krive; brojevi prate
   uobičajenu trenersku smernicu (~1–2 % po 3 °C iznad ~15 °C) i namerno su konzervativni. Gleda se OSEĆAJ (apparent temperature), ne
   temperatura vazduha: vlažnost je ta koja ubija hlađenje znojenjem. */

import { dowShort, fmtClock, fmtDayMonth, fmtNum } from '../format';
import { paceForZone } from '../training/vdot/paceForZone';
import type { Zone } from '../training/types';

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

/* ------------------------------------------------------------- čitanje odgovora */

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const pick = (arr: unknown, i: number): number | null => {
  if (!Array.isArray(arr)) return null;
  const v: unknown = arr[i];
  return v != null && finite(+(v as number)) && typeof v !== 'boolean'
    ? Math.round(+(v as number) * 10) / 10 + 0 // + 0: „−0 °C" nije temperatura
    : null;
};

/** Sati iz Open-Meteo odgovora; `null` kad oblik nije očekivan ili nema nijednog sata. */
export function parseForecast(json: unknown): ForecastHours | null {
  const h = (json as { hourly?: Record<string, unknown> } | null | undefined)?.hourly;
  const time = h?.['time'];
  if (!h || !Array.isArray(time) || !time.length) return null;
  const hours: ForecastHours = {};
  time.forEach((t: unknown, i: number) => {
    if (typeof t !== 'string') return;
    hours[t.slice(0, 13)] = {
      temp: pick(h['temperature_2m'], i),
      osecaj: pick(h['apparent_temperature'], i),
      vlaga: pick(h['relative_humidity_2m'], i),
      vetar: pick(h['wind_speed_10m'], i),
      kisa: pick(h['precipitation_probability'], i)
    };
  });
  return Object.keys(hours).length ? hours : null;
}

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
export function trainingHour(v: unknown): number {
  return v != null && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 23
    ? Number(v)
    : 18;
}

/** Zbog čega se prognoza ponovo povlači: nema keša, star je, druga lokacija, ili ne pokriva trenutni sat. */
export const FORECAST_TTL_MS = 3 * 3600000;

export function forecastFresh(
  cache: ForecastCache | null | undefined,
  geo: { lat: number; lon: number },
  now: number,
  currentHourKey: string
): boolean {
  return !!(
    cache?.at &&
    now - cache.at < FORECAST_TTL_MS &&
    cache.lat === geo.lat &&
    cache.lon === geo.lon &&
    cache.sati[currentHourKey]
  );
}

/* ------------------------------------------------------------- najhladniji sat */

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
  return cur.osecaj - best.osecaj >= 3 && best.hour !== chosen ? best : null;
}

/* ------------------------------------------------------------- temperatura odrađenog trčanja */

const num = (v: unknown): number | null =>
  v == null || v === '' || typeof v === 'boolean' || !Number.isFinite(+(v as number))
    ? null
    : +(v as number);

/**
 * Sat koji se traži u prognozi za odrađeno trčanje: SREDINA trčanja (ne početak), jer se dvočasovno trčanje od 8:40 odvija u 9 i 10 h.
 * Bez `satTrk` (ručan unos) pada se na sat treninga. Prelazak preko ponoći se ne prati: takvo trčanje dobija 23 h istog dana.
 */
export function runHour(
  log: { satTrk?: unknown; sec?: unknown } | null | undefined,
  trainingHr: number
): number {
  const start = num(log?.satTrk);
  if (start == null || start < 0 || start > 23) return trainingHr;
  const sec = num(log?.sec);
  const half = sec != null && sec > 0 ? sec / 3600 / 2 : 0;
  return Math.max(0, Math.min(23, Math.round(start + half)));
}

export interface RunTemp {
  temp: number | null;
  osecaj: number | null;
  sat: number;
  /** `om`: Open-Meteo za sat trčanja (merodavno); `sat`: očitavanje sa ručnog sata (zglob čita 2–5 °C više od vazduha) — rezerva. */
  izvor: 'om' | 'sat';
}

/** Temperatura odrađenog trčanja sa OZNAKOM izvora — zglobno merenje se nikad ne predstavlja kao temperatura vazduha. */
export function runTemp(
  log: (Record<string, unknown> & { satTrk?: unknown; sec?: unknown }) | null | undefined,
  date: string | null | undefined,
  cache: Pick<ForecastCache, 'sati'> | null | undefined,
  trainingHr: number
): RunTemp | null {
  if (!log || typeof log !== 'object') return null;
  const sat = runHour(log, trainingHr);
  const z = date ? hourFor(cache, date, sat) : null;
  if (z && num(z.temp) != null)
    return { temp: num(z.temp), osecaj: num(z.osecaj), sat, izvor: 'om' };
  const wrist = num(log['temp']);
  if (wrist == null) return null;
  const icu = log['icu'];
  const feels =
    icu && typeof icu === 'object' ? num((icu as Record<string, unknown>)['osecaSe']) : null;
  return { temp: wrist, osecaj: feels, sat, izvor: 'sat' };
}

/* ------------------------------------------------------------- ciljni tempo dana */

const ZONE_FOR_TAG: Readonly<Record<string, Zone>> = { lako: 'E', lr: 'LR' };

/**
 * Ciljni tempo dana: iz sesije kad postoji, inače iz reda predikcije; za lagana trčanja iz forme (Danielsove zone). Bez osnove `null` —
 * prilagođen tempo se ne izmišlja. Snaga i „rw" (trčanje/hod) tempo ne dobijaju.
 */
export function targetPace(
  day: { tag?: string | null; session?: { paceSec?: number | null } | null } | null | undefined,
  predPace: number | null,
  vdot: number | null
): number | null {
  const s = day?.session?.paceSec;
  if (s != null && s > 0) return s;
  if (predPace != null && predPace > 0) return predPace;
  const zone = day?.tag ? ZONE_FOR_TAG[day.tag] : undefined;
  if (!zone) return null;
  if (vdot == null || !Number.isFinite(vdot) || vdot < 20 || vdot > 85) return null;
  return paceForZone(vdot, zone);
}

/* ------------------------------------------------------------- lokacija */

/** Dve decimale su ~1 km — dovoljno za prognozu, a ne pokazuje gde stanuješ. */
export const roundCoord = (v: number): number => Math.round(v * 100) / 100;

/** Zašto lokacija nije stigla: tri različite stvari (odbijena dozvola, istekla potraga, nedostupna) sa različitim uputstvom. */
export function geoMessage(code: number | undefined, inApp: boolean): string {
  if (code === 1)
    return inApp
      ? 'Pristup lokaciji je odbijen.\n\nPodešavanja telefona → Aplikacije → SUB-20 → Dozvole → Lokacija → „Dozvoli dok se aplikacija koristi". Pa se vrati ovde i probaj ponovo.'
      : 'Pristup lokaciji je odbijen.\n\nUključi ga u podešavanjima pregledača za ovu stranicu (ikonica pored adrese → Lokacija), pa probaj ponovo.';
  if (code === 3)
    return 'Traženje lokacije je isteklo.\n\nProbaj ponovo — pomaže da izađeš napolje ili blizu prozora. Uključen Wi-Fi ubrzava grubo određivanje i kad nisi povezan ni na jednu mrežu.';
  return inApp
    ? 'Lokacija trenutno nije dostupna.\n\nProveri dve stvari:\n1. Lokacija je uključena u brzim podešavanjima telefona (ikonica sa iglom).\n2. Podešavanja telefona → Aplikacije → SUB-20 → Dozvole → Lokacija je dozvoljena.'
    : 'Lokacija trenutno nije dostupna.\n\nProveri da li je Lokacija uključena na samom telefonu, pa probaj ponovo.';
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
