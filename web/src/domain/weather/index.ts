/* VREME NA DAN TRENINGA: odluke bez ikakvog ulaza/izlaza. Servis (`services/weather`) povlači prognozu; ovde je šta ona znači.

   Sve ostalo u aplikaciji opisuje PROŠLOST. Ovo je jedini podatak koji menja ODLUKU pre nego što izađeš: na 34 °C intervali na planskom
   tempu nisu isti trening nego drugi, teži, sa manjim prinosom.

   (Od prenosa u generatore, vrućina, tempo uz vrućinu, najhladniji sat i kartica dana su u generatoru distance plana — v. kraj
   fajla.) VRUĆINA je PROIZVODNA HEURISTIKA (ne dokazana kriva): literatura se slaže oko smera i reda veličine, ne oko tačne krive; brojevi prate
   uobičajenu trenersku smernicu (~1–2 % po 3 °C iznad ~15 °C) i namerno su konzervativni. Gleda se OSEĆAJ (apparent temperature), ne
   temperatura vazduha: vlažnost je ta koja ubija hlađenje znojenjem. */

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
  temp: number;
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
  const airTemp = z ? num(z.temp) : null;
  if (z && airTemp != null) return { temp: airTemp, osecaj: num(z.osecaj), sat, izvor: 'om' };
  const wrist = num(log['temp']);
  if (wrist == null) return null;
  const icu = log['icu'];
  const feels =
    icu && typeof icu === 'object' ? num((icu as Record<string, unknown>)['osecaSe']) : null;
  return { temp: wrist, osecaj: feels, sat, izvor: 'sat' };
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

/* Vrućina (pojasevi i usporavanje), najhladniji sat, ciljni tempo dana i kartica „Vreme" su trenerske odluke i od prenosa
   pripadaju generatoru distance plana (`domain/generators/<distanca>/weather`). Ovde ostaje čitanje prognoze, sat treninga,
   temperatura odrađenog trčanja i lokacija. */
