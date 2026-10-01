/* VREME NA DAN TRENINGA — jedini podatak koji menja ODLUKU pre nego što izađeš: na 34 °C intervali na
   planskom tempu nisu isti trening nego drugi, teži, i sa manjim prinosom.

   Prognoza (Open-Meteo) ide DIREKTNO iz pregledača, ne preko našeg servera: servis je bez ključa i sa CORS-om,
   a preko našeg servera bi KOORDINATE korisnika morale da prođu kroz nas. Koordinate se zaokružuju na dve
   decimale (~1 km). Ovde je samo ČISTA logika nad već preuzetim satima; poziv je u `services/weather`. */

import { looseNumber } from '../lib/number';

/** Prognoza za jedan sat. Sve vrednosti su na jednu decimalu ili `null`. */
export interface HourForecast {
  temp: number | null;
  /** „Osećaj" (apparent temperature) — vlažnost je ta koja ubija hlađenje znojenjem. */
  feel: number | null;
  humidity: number | null;
  wind: number | null;
  rain: number | null;
}

/** Sati ključani kao `2026-07-12T18` (datum + `T` + sat). */
export type HourlyForecast = Record<string, HourForecast>;

/**
 * KOLIKO VRUĆINA USPORAVA — približno, i tako je označeno na ekranu. Literatura se slaže oko smera i reda
 * veličine, ne oko tačne krive; brojevi prate uobičajenu trenersku smernicu (~1–2 % po 3 °C iznad ~15 °C) i
 * namerno su konzervativni (heuristika, NE nauka). Gleda se OSEĆAJ, ne temperatura vazduha.
 */
export const HEAT_TABLE: ReadonlyArray<{ from: number; pct: number; advice: string }> = [
  {
    from: 35,
    pct: 8,
    advice:
      'Preko 35 °C osećaja — kvalitetnu sesiju pomeri ili zameni laganim trčanjem. Tempo tu više ne meri formu.'
  },
  {
    from: 30,
    pct: 6,
    advice:
      'Na ovoj vrućini radni deo drži po osećaju, ne po satu. Skrati ako puls ode iznad uobičajenog za taj tempo.'
  },
  /* %PCT% se zamenjuje procentom pri prikazu: tekst nosi broj i stoji sam, ne oslanja se na red „tempo uz
     vrućinu" koji postoji samo na kvalitetnim sesijama. */
  {
    from: 25,
    pct: 4,
    advice: 'Toplo — ciljni tempo je realno oko %PCT% sporiji. To nije pad forme.'
  },
  { from: 20, pct: 2, advice: 'Blago toplo; računaj na oko %PCT% sporiji tempo pri istom naporu.' },
  { from: 15, pct: 1, advice: '' },
  { from: -99, pct: 0, advice: '' }
];

export type HeatLevel = (typeof HEAT_TABLE)[number];

export function heatFor(feel: number | null | undefined): HeatLevel | null {
  if (feel == null || !Number.isFinite(feel)) return null;
  return HEAT_TABLE.find((x) => feel >= x.from) ?? null;
}

/** Savet o vrućini sa ubačenim procentom; prazan string kad nema šta da se kaže. */
export function heatAdvice(level: HeatLevel | null): string {
  return level && level.advice ? level.advice.replace('%PCT%', `${level.pct} %`) : '';
}

/** Tempo uz vrućinu: ciljni tempo uvećan za procenat. */
export const heatAdjustedPace = (paceSec: number, pct: number): number =>
  Math.round(paceSec * (1 + pct / 100));

const oneDecimal = (arr: unknown, i: number): number | null => {
  if (!Array.isArray(arr)) return null;
  const x: unknown = arr[i];
  return x != null && Number.isFinite(x) ? Math.round((x as number) * 10) / 10 + 0 : null; // + 0: „−0 °C" nije temperatura
};

/**
 * Odgovor Open-Meteo-a (`hourly.*`) → sati. `null` kad je oblik neočekivan. Strogu proveru oblika radi Zod na
 * granici servisa; ovde se samo odbacuje ono što nije broj (jedna decimala, `null` za rupe).
 */
export function parseForecast(json: unknown): HourlyForecast | null {
  const h = (json as { hourly?: Record<string, unknown> } | null | undefined)?.hourly;
  if (!h || !Array.isArray(h['time']) || !h['time'].length) return null;
  const hours: HourlyForecast = {};
  (h['time'] as unknown[]).forEach((t, i) => {
    if (typeof t !== 'string') return;
    hours[t.slice(0, 13)] = {
      temp: oneDecimal(h['temperature_2m'], i),
      feel: oneDecimal(h['apparent_temperature'], i),
      humidity: oneDecimal(h['relative_humidity_2m'], i),
      wind: oneDecimal(h['wind_speed_10m'], i),
      rain: oneDecimal(h['precipitation_probability'], i)
    };
  });
  return Object.keys(hours).length ? hours : null;
}

export const hourKey = (date: string, hour: number): string =>
  `${date}T${String(hour).padStart(2, '0')}`;

export function forecastAt(
  hours: HourlyForecast | null | undefined,
  date: string | null | undefined,
  hour: number
): HourForecast | null {
  if (!hours || !date) return null;
  return Object.prototype.hasOwnProperty.call(hours, hourKey(date, hour))
    ? (hours[hourKey(date, hour)] ?? null)
    : null;
}

/** Podrazumevani sat treninga kad ga korisnik nije izabrao. */
export const DEFAULT_TRAINING_HOUR = 18;

/** Sat treninga iz podešavanja (0–23), inače 18. */
export function trainingHour(setting: unknown): number {
  const h = setting;
  return h != null && Number.isFinite(h) && (h as number) >= 0 && (h as number) <= 23
    ? +(h as number)
    : DEFAULT_TRAINING_HOUR;
}

/**
 * Trenutni sat — samo za DANAS, i samo ako prognoza pokriva taj sat. Kartica je ranije pokazivala isključivo
 * sat treninga, pa se rečenica o hladnijem satu čitala kao trenutna temperatura.
 */
export function forecastNow(
  hours: HourlyForecast | null | undefined,
  date: string,
  today: string,
  nowHour: number
): { hour: number; forecast: HourForecast } | null {
  if (date !== today) return null;
  const f = forecastAt(hours, date, nowHour);
  return f ? { hour: nowHour, forecast: f } : null;
}

/** Najhladniji sat u razumnom prozoru (5–21 h) i ostatak razlike od izabranog. */
export const COOLER_HOUR_MIN_GAIN = 3;

/**
 * Najhladniji sat. Nudi se samo kad je razlika dovoljna da promeni odluku (≥ 3 °C) — pomeranje treninga zbog
 * pola stepena nije savet nego smetnja. Za DANAS se gledaju samo sati koji tek dolaze: „idi u 5:00" u dva po
 * podne nije savet nego zbunjivanje.
 */
export function coolestHour(
  hours: HourlyForecast | null | undefined,
  date: string,
  chosenHour: number,
  today: string,
  nowHour: number
): { hour: number; feel: number } | null {
  if (!hours) return null;
  const first = date === today ? Math.max(5, nowHour + 1) : 5;
  let best: { hour: number; feel: number } | null = null;
  for (let h = first; h <= 21; h++) {
    const z = forecastAt(hours, date, h);
    if (!z || z.feel == null) continue;
    if (!best || z.feel < best.feel - 0.01) best = { hour: h, feel: z.feel };
  }
  if (!best) return null;
  const chosen = forecastAt(hours, date, chosenHour);
  if (!chosen || chosen.feel == null) return best;
  return chosen.feel - best.feel >= COOLER_HOUR_MIN_GAIN && best.hour !== chosenHour ? best : null;
}

/**
 * SAT KOJI SE TRAŽI U PROGNOZI za odrađeno trčanje: SREDINA trčanja, ne početak (dvočasovno dugo trčanje
 * krenuto u 8:40 odvija se najvećim delom u 9 i 10 h, a avgust ume da doda 4–5 °C između 8 i 10). `startHour`
 * upisuje uvoz sa Strave/icu-a; kad ga nema (ručan unos), pada se na sat treninga. Prelazak preko ponoći se
 * ne prati: takvo trčanje dobija 23 h istog dana.
 */
export function runHour(
  log: { satTrk?: unknown; sec?: unknown } | null | undefined,
  fallbackHour: number
): number {
  const start = looseNumber(log?.satTrk);
  if (start == null || start < 0 || start > 23) return fallbackHour;
  const sec = looseNumber(log?.sec);
  const half = sec != null && sec > 0 ? sec / 3600 / 2 : 0;
  return Math.max(0, Math.min(23, Math.round(start + half)));
}

export interface RunTemperature {
  temp: number;
  feel: number | null;
  hour: number;
  /** `om` — Open-Meteo za sat trčanja (merodavno); `watch` — očitavanje sa ručnog sata, kad prognoze nema. */
  source: 'om' | 'watch';
}

/**
 * TEMPERATURA ODRAĐENOG TRČANJA — jedan izvor za ceo program. Polje `l.temp` puni ISKLJUČIVO senzor na satu,
 * koji stoji uz zglob i čita 2–5 °C više od vazduha (kartica vremena je pokazivala 30 °C, a AI analiza istog
 * trčanja „33 °C" — dva broja za jedno trčanje, i netačniji je nosio jači sud). Merodavna je zato vrednost
 * Open-Meteo-a za sat trčanja; očitavanje sa sata ostaje samo kao rezerva i UVEK nosi oznaku izvora. `osecaSe`
 * sa icu-a je izvedeno iz istog zglobnog očitavanja, pa deli sudbinu temperature.
 */
export function runTemperature(
  log: { satTrk?: unknown; sec?: unknown; temp?: unknown; icu?: unknown } | null | undefined,
  date: string | null | undefined,
  hours: HourlyForecast | null | undefined,
  fallbackHour: number
): RunTemperature | null {
  if (!log || typeof log !== 'object') return null;
  const hour = runHour(log, fallbackHour);
  const z = date ? forecastAt(hours, date, hour) : null;
  if (z && looseNumber(z.temp) != null)
    return { temp: looseNumber(z.temp) as number, feel: looseNumber(z.feel), hour, source: 'om' };
  const watch = looseNumber(log.temp);
  if (watch == null) return null;
  const icu = log.icu;
  const feel =
    icu && typeof icu === 'object' ? looseNumber((icu as { osecaSe?: unknown }).osecaSe) : null;
  return { temp: watch, feel, hour, source: 'watch' };
}
