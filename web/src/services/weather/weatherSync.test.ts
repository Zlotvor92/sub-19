import { describe, expect, it } from 'vitest';
import type { ForecastCache } from '../../domain/weather';
import { createWeather, type Geo, type GeoPort } from './weatherSync';

/* parity: vremePovuci i uključivanje lokacije (app.js). Odluke o prognozi su dokazane u `domain/weather`. */

const NOW = Date.UTC(2026, 6, 14, 14, 30);
const body = {
  hourly: {
    time: ['2026-07-14T14:00', '2026-07-14T15:00'],
    temperature_2m: [30, 31],
    apparent_temperature: [33, 34],
    relative_humidity_2m: [40, 41],
    wind_speed_10m: [5, 6],
    precipitation_probability: [0, 10]
  }
};

function make(
  opts: {
    response?: () => Response | Promise<Response>;
    geo?: Partial<GeoPort>;
    location?: Geo | null;
    cache?: ForecastCache | null;
  } = {}
) {
  const calls: string[] = [];
  let cache = opts.cache ?? null;
  let location: Geo | null =
    opts.location === undefined ? { lat: 44.8, lon: 20.46 } : opts.location;
  const weather = createWeather({
    fetcher: (url) => {
      calls.push(url);
      return Promise.resolve(
        opts.response
          ? opts.response()
          : new Response(JSON.stringify(body), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
      );
    },
    geo: {
      available: () => true,
      denied: () => Promise.resolve(false),
      position: () => Promise.resolve({ lat: 44.80412, lon: 20.4649 }),
      inApp: () => false,
      ...opts.geo
    },
    cache: { get: () => cache, set: (v) => void (cache = v) },
    location: { get: () => location, set: (v) => void (location = v) },
    now: () => NOW,
    today: () => '2026-07-14',
    hour: () => 14
  });
  return { weather, calls, cache: () => cache, location: () => location };
}

describe('prognoza', () => {
  it('bez lokacije ne zove mrežu', async () => {
    const m = make({ location: null });
    expect(await m.weather.pull(true)).toEqual({ ok: false, error: 'Lokacija nije podešena.' });
    expect(m.calls).toHaveLength(0);
  });

  it('povlači direktno sa Open-Meteo, 3 dana unapred i 7 unazad, i čuva keš', async () => {
    const m = make();
    expect(await m.weather.pull(false)).toEqual({ ok: true, cached: false });
    expect(m.calls[0]).toMatch(
      /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=44\.8&longitude=20\.46&hourly=/
    );
    expect(m.calls[0]).toContain('forecast_days=3&past_days=7&timezone=auto');
    expect(m.cache()).toMatchObject({ at: NOW, lat: 44.8, lon: 20.46 });
    expect(m.cache()?.sati['2026-07-14T14']).toEqual({
      temp: 30,
      osecaj: 33,
      vlaga: 40,
      vetar: 5,
      kisa: 0
    });
  });

  it('keš važi 3 h za istu lokaciju i trenutni sat; sila i nova lokacija ga zaobilaze', async () => {
    const fresh = make();
    await fresh.weather.pull(false);
    expect(await fresh.weather.pull(false)).toEqual({ ok: true, cached: true });
    expect(fresh.calls).toHaveLength(1);
    await fresh.weather.pull(true);
    expect(fresh.calls).toHaveLength(2);

    const stale = make({
      cache: {
        at: NOW - 4 * 3600000,
        lat: 44.8,
        lon: 20.46,
        sati: { '2026-07-14T14': { temp: 1, osecaj: 1, vlaga: 1, vetar: 1, kisa: 1 } }
      }
    });
    await stale.weather.pull(false);
    expect(stale.calls).toHaveLength(1);

    const elsewhere = make({
      cache: {
        at: NOW,
        lat: 1,
        lon: 2,
        sati: { '2026-07-14T14': { temp: 1, osecaj: 1, vlaga: 1, vetar: 1, kisa: 1 } }
      }
    });
    await elsewhere.weather.pull(false);
    expect(elsewhere.calls).toHaveLength(1);

    // mlad keš koji NE pokriva trenutni sat nije upotrebljiv
    const noHour = make({
      cache: {
        at: NOW,
        lat: 44.8,
        lon: 20.46,
        sati: { '2026-07-14T03': { temp: 1, osecaj: 1, vlaga: 1, vetar: 1, kisa: 1 } }
      }
    });
    await noHour.weather.pull(false);
    expect(noHour.calls).toHaveLength(1);
  });

  it('greške su vrednosti sa istim porukama kao ranije', async () => {
    expect(
      await make({ response: () => new Response('{}', { status: 503 }) }).weather.pull(true)
    ).toEqual({ ok: false, error: 'Vremenska prognoza trenutno nije dostupna.' });
    expect(
      await make({ response: () => Promise.reject(new Error('net')) }).weather.pull(true)
    ).toEqual({ ok: false, error: 'Nema veze sa vremenskom službom.' });
    expect(
      await make({
        response: () => new Response(JSON.stringify({ nesto: 1 }), { status: 200 })
      }).weather.pull(true)
    ).toEqual({ ok: false, error: 'Prognoza je stigla u neočekivanom obliku.' });
    expect(
      await make({
        response: () => new Response(JSON.stringify({ hourly: { time: [] } }), { status: 200 })
      }).weather.pull(true)
    ).toEqual({ ok: false, error: 'Prognoza je stigla u neočekivanom obliku.' });
  });
});

describe('uključivanje lokacije', () => {
  it('uspeh: koordinate se zaokružuju na ~1 km, čuvaju, i odmah se povlači prognoza', async () => {
    const m = make({ location: null });
    expect(await m.weather.enable()).toEqual({ ok: true, pullError: null });
    expect(m.location()).toEqual({ lat: 44.8, lon: 20.46 });
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0]).toContain('latitude=44.8&longitude=20.46');
  });

  it('koordinate ostaju i kad prognoza ne uspe; greška se javlja posebno', async () => {
    const m = make({ location: null, response: () => new Response('{}', { status: 500 }) });
    expect(await m.weather.enable()).toEqual({
      ok: true,
      pullError: 'Vremenska prognoza trenutno nije dostupna.'
    });
    expect(m.location()).toEqual({ lat: 44.8, lon: 20.46 });
  });

  it('bez podrške, sa unapred odbijenom dozvolom i sa odbijenim pitanjem: poruka bez poziva mreže', async () => {
    const none = make({ location: null, geo: { available: () => false } });
    expect(await none.weather.enable()).toEqual({
      ok: false,
      error: 'Ovaj pregledač ne ume da odredi lokaciju.'
    });
    const denied = make({ location: null, geo: { denied: () => Promise.resolve(true) } });
    const r = await denied.weather.enable();
    expect(r.ok === false && r.error).toMatch(/^Pristup lokaciji je odbijen\./);
    const refused = make({
      location: null,
      geo: {
        position: () => Promise.reject(Object.assign(new Error('x'), { code: 1 })),
        inApp: () => true
      }
    });
    const rr = await refused.weather.enable();
    expect(rr.ok === false && rr.error).toMatch(/Podešavanja telefona → Aplikacije → SUB-20/);
    expect(refused.location()).toBeNull();
    expect(refused.calls).toHaveLength(0);
  });

  it('istek nije odgovor: jedan duži pokušaj sa GPS-om; ako i on ne uspe, poruka o isteku', async () => {
    const seen: Array<{ high: boolean; timeout: number }> = [];
    const ok = make({
      location: null,
      geo: {
        position: (o) => {
          seen.push({ high: o.enableHighAccuracy, timeout: o.timeout });
          return seen.length === 1
            ? Promise.reject(Object.assign(new Error('t'), { code: 3 }))
            : Promise.resolve({ lat: 1.234, lon: 2.345 });
        }
      }
    });
    const progress: string[] = [];
    expect(await ok.weather.enable((l) => progress.push(l))).toEqual({ ok: true, pullError: null });
    expect(seen).toEqual([
      { high: false, timeout: 12000 },
      { high: true, timeout: 30000 }
    ]);
    expect(progress).toEqual(['Još tražim…']);

    const fail = make({
      location: null,
      geo: { position: () => Promise.reject(Object.assign(new Error('t'), { code: 3 })) }
    });
    const r = await fail.weather.enable();
    expect(r.ok === false && r.error).toMatch(/^Traženje lokacije je isteklo\./);
  });

  it('isključivanje briše koordinate i keš sa uređaja', async () => {
    const m = make();
    await m.weather.pull(true);
    m.weather.disable();
    expect(m.location()).toBeNull();
    expect(m.cache()).toBeNull();
  });
});
