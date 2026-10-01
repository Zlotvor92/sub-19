/* PROGNOZA I LOKACIJA. Open-Meteo se zove DIREKTNO iz pregleda, ne preko našeg servera: bez ključa je i sa CORS-om, a preko nas bi
   KOORDINATE korisnika morale da prođu kroz naš server. Zato je u CSP dodat samo taj jedan domen. Koordinate se zaokružuju na ~1 km.

   Odluke (šta prognoza znači) su u `domain/weather`; ovde je samo tok poziva i keš. Nikad ne baca: ishod je vrednost. */

import { z } from 'zod';
import {
  forecastFresh,
  geoMessage,
  parseForecast,
  roundCoord,
  type ForecastCache
} from '../../domain/weather';
import { requestJson, type Fetcher } from '../http';

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** `past_days` NIJE za karticu (ona gleda unapred): temperatura ODRAĐENOG trčanja se čita iz istog keša, za sat u kom se trčalo. */
const QUERY =
  'hourly=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation_probability&forecast_days=3&past_days=7&timezone=auto';

const Body = z
  .object({ hourly: z.object({ time: z.array(z.unknown()) }).passthrough() })
  .passthrough();

export interface GeoPort {
  available(): boolean;
  /** Dozvola je već odbijena (`permissions` ne postoji svuda — tada `false` i prosto se pita). */
  denied(): Promise<boolean>;
  position(opts: {
    enableHighAccuracy: boolean;
    timeout: number;
    maximumAge: number;
  }): Promise<{ lat: number; lon: number }>;
  /** Instalirana aplikacija (dozvola pripada samoj aplikaciji, ne pregledaču). */
  inApp(): boolean;
}

export interface Geo {
  lat: number;
  lon: number;
}

export interface WeatherDeps {
  fetcher: Fetcher;
  geo: GeoPort;
  cache: { get(): ForecastCache | null; set(v: ForecastCache | null): void };
  location: { get(): Geo | null; set(v: Geo | null): void };
  now: () => number;
  today: () => string;
  /** Sat u danu (0–23), lokalno. */
  hour: () => number;
}

export type PullResult = { ok: true; cached: boolean } | { ok: false; error: string };

export type EnableResult = { ok: true; pullError: string | null } | { ok: false; error: string };

export function createWeather(deps: WeatherDeps) {
  /** `force`: bez obzira na keš. Keš važi 3 h, samo za istu lokaciju, i samo ako pokriva trenutni sat. */
  async function pull(force: boolean): Promise<PullResult> {
    const g = deps.location.get();
    if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon))
      return { ok: false, error: 'Lokacija nije podešena.' };
    const hourKey = `${deps.today()}T${String(deps.hour()).padStart(2, '0')}`;
    if (!force && forecastFresh(deps.cache.get(), g, deps.now(), hourKey))
      return { ok: true, cached: true };
    const url = `${FORECAST_URL}?latitude=${encodeURIComponent(g.lat)}&longitude=${encodeURIComponent(g.lon)}&${QUERY}`;
    const r = await requestJson(deps.fetcher, url, Body);
    if (!r.ok) {
      if (r.kind === 'network') return { ok: false, error: 'Nema veze sa vremenskom službom.' };
      if (r.kind === 'http')
        return { ok: false, error: 'Vremenska prognoza trenutno nije dostupna.' };
      return { ok: false, error: 'Prognoza je stigla u neočekivanom obliku.' };
    }
    const sati = parseForecast(r.data);
    if (!sati) return { ok: false, error: 'Prognoza je stigla u neočekivanom obliku.' };
    deps.cache.set({ at: deps.now(), lat: g.lat, lon: g.lon, sati });
    return { ok: true, cached: false };
  }

  /**
   * Uključivanje: lokacija pa prognoza. Istek NIJE odgovor — u zatvorenom prostoru je 12 s bez GPS-a često premalo za prvi fiks, pa
   * jedan duži pokušaj (sa GPS-om) pre odustajanja. Koordinate se čuvaju i kad prognoza ne uspe (javlja se posebno).
   */
  async function enable(onProgress?: (label: string) => void): Promise<EnableResult> {
    if (!deps.geo.available())
      return { ok: false, error: 'Ovaj pregledač ne ume da odredi lokaciju.' };
    if (await deps.geo.denied()) return { ok: false, error: geoMessage(1, deps.geo.inApp()) };
    let pos: Geo | null = null;
    let failure: unknown = null;
    try {
      pos = await deps.geo.position({
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 600000
      });
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code === 3) {
        onProgress?.('Još tražim…');
        try {
          pos = await deps.geo.position({
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 600000
          });
        } catch (err2) {
          failure = err2;
        }
      } else failure = err;
    }
    if (!pos) {
      const code = (failure as { code?: unknown } | null)?.code;
      return {
        ok: false,
        error: geoMessage(typeof code === 'number' ? code : undefined, deps.geo.inApp())
      };
    }
    deps.location.set({ lat: roundCoord(pos.lat), lon: roundCoord(pos.lon) });
    const r = await pull(true);
    return { ok: true, pullError: r.ok ? null : r.error };
  }

  /** Isključivanje briše koordinate sa uređaja. */
  function disable(): void {
    deps.location.set(null);
    deps.cache.set(null);
  }

  return { pull, enable, disable };
}
