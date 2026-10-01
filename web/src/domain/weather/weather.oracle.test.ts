import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import {
  coolestHour,
  forecastAt,
  forecastNow,
  heatAdjustedPace,
  heatAdvice,
  heatFor,
  parseForecast,
  runHour,
  runTemperature,
  trainingHour,
  type HourlyForecast
} from './index';

/* parity: test/temperatura-trcanja.test.mjs (17 testova), test/doslednost (vremeCist). Poredi
   `domain/weather` sa starim `vremeCist`, `vrucinaZa`, `satTreninga`, `satTrcanja`, `tempTrcanja`,
   `najboljiSat`, `vremeSada`. */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;

let legacy: LegacyApp;
let TODAY: string;
let NOW_HOUR: number;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-07-12T09:00:00Z');
  TODAY = legacy.evalIn('TODAY') as string;
  NOW_HOUR = legacy.evalIn('new Date().getHours()') as number;
});

function ctxSet(name: string, v: unknown): void {
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx[name] = v;
}

function randomForecastJson(r: () => number): unknown {
  const days = ['2026-07-10', '2026-07-11', TODAY, '2026-07-13'];
  const time: unknown[] = [];
  const t: unknown[] = [];
  const ap: unknown[] = [];
  const rh: unknown[] = [];
  const ws: unknown[] = [];
  const pp: unknown[] = [];
  for (const d of days)
    for (let h = 0; h < 24; h++) {
      time.push(r() < 0.01 ? 42 : `${d}T${String(h).padStart(2, '0')}:00`);
      const base = 12 + 14 * Math.sin(((h - 9) / 24) * Math.PI * 2);
      t.push(r() < 0.03 ? null : base + r());
      ap.push(r() < 0.03 ? null : base + 2 + r() * 3);
      rh.push(r() < 0.03 ? 'x' : 40 + r() * 40);
      ws.push(r() < 0.5 ? 5 + r() * 10 : null);
      pp.push(r() < 0.5 ? Math.floor(r() * 100) : undefined);
    }
  return {
    hourly: {
      time,
      temperature_2m: t,
      apparent_temperature: ap,
      relative_humidity_2m: rh,
      wind_speed_10m: ws,
      precipitation_probability: pp
    }
  };
}

describe('prognoza naspram starog koda', () => {
  it('parseForecast / heatFor: isti sati i isti nivo vrućine', () => {
    const r = rng(1);
    for (let i = 0; i < 50; i++) {
      const json = randomForecastJson(r);
      ctxSet('__j', j(json));
      const old = j<Record<string, Record<string, unknown>> | null>(
        legacy.evalIn('vremeCist(__j)')
      );
      const mine = parseForecast(json);
      const norm = (h: HourlyForecast | null) =>
        h &&
        Object.fromEntries(
          Object.entries(h).map(([k, v]) => [
            k,
            { temp: v.temp, osecaj: v.feel, vlaga: v.humidity, vetar: v.wind, kisa: v.rain }
          ])
        );
      expect(norm(mine)).toEqual(old);
    }
    for (const bad of [
      null,
      undefined,
      {},
      { hourly: {} },
      { hourly: { time: [] } },
      { hourly: { time: 'x' } }
    ]) {
      expect(parseForecast(bad), JSON.stringify(bad)).toEqual(
        j(legacy.call('vremeCist', bad ?? null))
      );
    }
    for (let f = -120; f <= 60; f += 0.5) {
      const old = j<{ od: number; pct: number; rec: string } | null>(legacy.call('vrucinaZa', f));
      const mine = heatFor(f);
      expect(mine && { od: mine.from, pct: mine.pct, rec: mine.advice }, `${f}`).toEqual(old);
    }
    expect(heatFor(null)).toBeNull();
    expect(heatFor(Number.NaN)).toBeNull();
  });

  it('satovi i temperatura trčanja: 600 nasumičnih trčanja sa i bez prognoze', () => {
    const r = rng(2);
    const kinds = { om: 0, watch: 0, none: 0 };
    for (let i = 0; i < 600; i++) {
      const hours = parseForecast(randomForecastJson(r));
      if (!hours) throw new Error('prognoza');
      const have = r() < 0.7;
      const setting = r() < 0.5 ? undefined : r() < 0.3 ? 'x' : Math.floor(r() * 30) - 3;
      ctxSet(
        '__v',
        have
          ? {
              at: 1,
              lat: 1,
              lon: 1,
              sati: j(
                Object.fromEntries(
                  Object.entries(hours).map(([k, v]) => [
                    k,
                    { temp: v.temp, osecaj: v.feel, vlaga: v.humidity, vetar: v.wind, kisa: v.rain }
                  ])
                )
              )
            }
          : null
      );
      ctxSet('__ui', setting);
      legacy.evalIn('S.vreme=__v; S.ui=S.ui||{}; S.ui.satTreninga=__ui; 0');
      const log: Record<string, unknown> = {};
      if (r() < 0.7) log['satTrk'] = r() < 0.15 ? 'x' : Math.floor(r() * 26) - 1;
      if (r() < 0.8) log['sec'] = r() < 0.1 ? -5 : Math.floor(r() * 9000);
      if (r() < 0.5) log['temp'] = r() < 0.2 ? '' : 20 + r() * 12;
      if (r() < 0.3) log['icu'] = { osecaSe: r() < 0.5 ? 33 : null };
      const date =
        r() < 0.9
          ? ['2026-07-10', '2026-07-11', TODAY, '2026-07-13', '2026-06-01'][Math.floor(r() * 5)]
          : undefined;
      ctxSet('__l', j(log));
      const fb = trainingHour(setting);
      expect(fb, `sat treninga ${i}`).toBe(legacy.evalIn('satTreninga()'));
      expect(runHour(log, fb), `sat trčanja ${i}`).toBe(legacy.evalIn('satTrcanja(__l)'));
      const old = j<{ temp: number; osecaj: number | null; sat: number; izvor: string } | null>(
        legacy.evalIn(`tempTrcanja(__l, ${JSON.stringify(date ?? null)})`)
      );
      const mine = runTemperature(log, date, have ? hours : null, fb);
      expect(
        mine && {
          temp: mine.temp,
          osecaj: mine.feel,
          sat: mine.hour,
          izvor: mine.source === 'om' ? 'om' : 'sat'
        },
        `temperatura ${i}`
      ).toEqual(old);
      if (!old) kinds.none++;
      else if (old.izvor === 'om') kinds.om++;
      else kinds.watch++;
    }
    expect(kinds.om).toBeGreaterThan(100);
    expect(kinds.watch).toBeGreaterThan(50);
    expect(kinds.none).toBeGreaterThan(20);
  });

  it('najhladniji sat i trenutni sat: isti za sve dane, izabrane sate i prognoze', () => {
    const r = rng(3);
    let offered = 0;
    for (let i = 0; i < 400; i++) {
      const hours = parseForecast(randomForecastJson(r)) as HourlyForecast;
      ctxSet('__v', {
        at: 1,
        lat: 1,
        lon: 1,
        sati: j(
          Object.fromEntries(
            Object.entries(hours).map(([k, v]) => [
              k,
              { temp: v.temp, osecaj: v.feel, vlaga: v.humidity, vetar: v.wind, kisa: v.rain }
            ])
          )
        )
      });
      legacy.evalIn('S.vreme=__v; 0');
      const date = ['2026-07-10', '2026-07-11', TODAY, '2026-07-13'][Math.floor(r() * 4)] as string;
      const chosen = Math.floor(r() * 24);
      const old = j<{ sat: number; osecaj: number } | null>(
        legacy.evalIn(`najboljiSat("${date}", ${chosen})`)
      );
      const mine = coolestHour(hours, date, chosen, TODAY, NOW_HOUR);
      expect(mine && { sat: mine.hour, osecaj: mine.feel }, `najbolji ${i}`).toEqual(old);
      if (old) offered++;
      const oldNow = j<{ sat: number; z: Record<string, unknown> } | null>(
        legacy.evalIn(`vremeSada("${date}")`)
      );
      const nowMine = forecastNow(hours, date, TODAY, NOW_HOUR);
      expect(nowMine && { sat: nowMine.hour, temp: nowMine.forecast.temp }, `sada ${i}`).toEqual(
        oldNow && { sat: oldNow.sat, temp: oldNow.z['temp'] }
      );
      expect(forecastAt(hours, date, chosen)?.temp ?? null).toBe(
        j<Record<string, unknown> | null>(legacy.evalIn(`vremeZaSat("${date}", ${chosen})`))?.[
          'temp'
        ] ?? null
      );
    }
    expect(offered).toBeGreaterThan(30);
  });
});

describe('tempo uz vrućinu', () => {
  it('procenat se ubacuje u savet i uvećava tempo', () => {
    expect(heatAdvice(heatFor(26))).toBe(
      'Toplo — ciljni tempo je realno oko 4 % sporiji. To nije pad forme.'
    );
    expect(heatAdvice(heatFor(10))).toBe('');
    expect(heatAdvice(null)).toBe('');
    expect(heatAdjustedPace(240, 4)).toBe(250);
    expect(heatAdjustedPace(240, 0)).toBe(240);
  });
});
