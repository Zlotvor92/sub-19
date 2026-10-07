import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { GenPlanState, VdotRecord } from '../state';
import { currentVdot, type StoredPredRow } from '../training/adaptation';
import { predRowsForDay } from '../training/adaptation';
import { generatePlan } from '@/test/legacyGenerator';
import {
  bestHour,
  geoMessage,
  roundCoord,
  heatFor,
  hourFor,
  hourNow,
  parseForecast,
  runHour,
  runTemp,
  targetPace,
  trainingHour,
  weatherCard,
  type ForecastCache
} from './index';

/* parity: vrucinaZa, vremeCist, vremeZaSat, vremeSada, najboljiSat, satTreninga, satTrcanja, tempTrcanja, cilJTempoDana (app.js). */

const NOW = '2026-07-14T14:30:00Z';
const nowDate = new Date(NOW);
const pad = (n: number): string => String(n).padStart(2, '0');
const localDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = localDate(nowDate);
const NOW_HOUR = nowDate.getHours();

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
beforeAll(async () => {
  legacy = await loadLegacyApp(NOW);
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;

/** Open-Meteo oblik: 10 dana po satima, sa rupama (null), pogrešnim vrednostima i nedostajućim nizovima. */
function forecastJson(r: () => number, mode: number): Record<string, unknown> {
  const time: string[] = [];
  for (let d = -7; d <= 2; d++) {
    const date = addDays(TODAY as IsoDate, d);
    for (let h = 0; h < 24; h++) time.push(`${date}T${pad(h)}:00`);
  }
  const series = (base: number, spread: number): unknown[] =>
    time.map((_, i) => {
      const x = r();
      if (x < 0.03) return null;
      if (mode === 3 && x < 0.1) return 'abc';
      if (mode === 4 && x < 0.1) return String(base);
      return base + Math.sin(i / 3.8) * spread + r();
    });
  const hourly: Record<string, unknown> = {
    time,
    temperature_2m: series(24, 9),
    apparent_temperature: series(25, 11),
    relative_humidity_2m: series(55, 25),
    wind_speed_10m: series(9, 6),
    precipitation_probability: series(20, 18)
  };
  if (mode === 1) delete hourly['apparent_temperature'];
  if (mode === 2) hourly['wind_speed_10m'] = 'nije niz';
  return { hourly };
}

describe('vreme naspram starog koda', () => {
  it('traka vrućine: sve granice, prazne i nevažeće vrednosti', () => {
    const values: unknown[] = [
      null,
      undefined,
      NaN,
      Infinity,
      -Infinity,
      -100,
      -99,
      -98.9,
      0,
      14.99,
      15,
      19.99,
      20,
      24.99,
      25,
      29.99,
      30,
      34.99,
      35,
      40
    ];
    for (const v of values) {
      ctx()['__x'] = v;
      const old = legacy.evalIn('vrucinaZa(__x)') as {
        od: number;
        pct: number;
        rec: string;
      } | null;
      const mine = heatFor(v as number | null);
      expect(mine ? { od: mine.od, pct: mine.pct, rec: mine.rec } : null, String(v)).toEqual(old);
    }
  });

  it('čitanje odgovora: isti sati i zaokruživanje, isto odbijanje loših oblika', () => {
    const r = rng(11);
    let accepted = 0;
    for (let i = 0; i < 40; i++) {
      const json = forecastJson(r, i % 5);
      ctx()['__j'] = JSON.parse(JSON.stringify(json));
      const old = j<Record<string, unknown> | null>(legacy.evalIn('vremeCist(__j)'));
      const mine = parseForecast(json);
      expect(mine === null ? null : j(mine), `scenario ${i}`).toEqual(old);
      if (mine) accepted++;
    }
    expect(accepted).toBeGreaterThan(30);
    for (const bad of [
      null,
      {},
      { hourly: {} },
      { hourly: { time: [] } },
      { hourly: { time: [1, 2] } },
      5,
      'x'
    ]) {
      ctx()['__j'] = bad;
      expect(parseForecast(bad)).toEqual(j(legacy.evalIn('vremeCist(__j)')));
    }
  });

  it('sat, trenutni sat, najhladniji sat i sat treninga na nasumičnim prognozama', () => {
    const r = rng(23);
    let offers = 0;
    let nows = 0;
    for (let i = 0; i < 60; i++) {
      const sati = parseForecast(forecastJson(r, i % 2 ? 0 : 3)) as Record<string, unknown>;
      const cache: ForecastCache = { at: 1, lat: 44.8, lon: 20.46, sati: sati as never };
      ctx()['__v'] = j(cache);
      legacy.evalIn('S.vreme=__v; 0');
      for (const off of [-3, 0, 0, 1, 2]) {
        const date = addDays(TODAY as IsoDate, off);
        for (const hour of [0, 5, 7, 12, 18, 21, 23]) {
          ctx()['__d'] = date;
          ctx()['__h'] = hour;
          expect(hourFor(cache, date, hour)).toEqual(j(legacy.evalIn('vremeZaSat(__d,__h)')));
          const a = bestHour(cache, date, hour, TODAY, NOW_HOUR);
          const b = j<{ sat: number; osecaj: number } | null>(
            legacy.evalIn('najboljiSat(__d,__h)')
          );
          expect(a ? { sat: a.hour, osecaj: a.osecaj } : null, `${date} ${hour}`).toEqual(b);
          if (a) offers++;
        }
        const n = hourNow(cache, date, TODAY, NOW_HOUR);
        const o = j<{ sat: number; z: unknown } | null>(legacy.evalIn('vremeSada(__d)'));
        expect(n ? { sat: n.hour, z: j(n.z) } : null).toEqual(o);
        if (n) nows++;
      }
    }
    expect(offers).toBeGreaterThan(20);
    expect(nows).toBeGreaterThan(20);
    for (const v of [null, undefined, '', 0, 7, '7', 23, 24, -1, 'x', 12.5, NaN, true]) {
      ctx()['__s'] = v;
      legacy.evalIn('S.ui.satTreninga=__s; 0');
      expect(trainingHour(v), String(v)).toBe(legacy.evalIn('satTreninga()'));
    }
  });

  it('najhladniji sat: granica od 3 °C i prozor „samo sati koji tek dolaze" na izgrađenim prognozama', () => {
    const date = TODAY;
    const build = (chosenFeel: number, bestHr: number, bestFeel: number): ForecastCache => {
      const sati: Record<string, unknown> = {};
      for (let h = 0; h < 24; h++)
        sati[`${date}T${pad(h)}`] = {
          temp: 25,
          osecaj: h === bestHr ? bestFeel : h === 18 ? chosenFeel : 30,
          vlaga: 50,
          vetar: 5,
          kisa: 0
        };
      return { at: 1, lat: 1, lon: 2, sati: sati as never };
    };
    let offered = 0;
    for (const diff of [1, 2, 2.9, 2.99, 3, 3.01, 4]) {
      for (const bestHr of [5, 6, NOW_HOUR - 1, NOW_HOUR, NOW_HOUR + 1, 21]) {
        const cache = build(20 + diff, bestHr, 20);
        ctx()['__v'] = j(cache);
        ctx()['__d'] = date;
        legacy.evalIn('S.vreme=__v; 0');
        for (const chosen of [18, bestHr]) {
          ctx()['__h'] = chosen;
          const a = bestHour(cache, date, chosen, TODAY, NOW_HOUR);
          const b = j<{ sat: number; osecaj: number } | null>(
            legacy.evalIn('najboljiSat(__d,__h)')
          );
          expect(
            a ? { sat: a.hour, osecaj: a.osecaj } : null,
            `${diff} ${bestHr} ${chosen}`
          ).toEqual(b);
          if (a) offered++;
        }
      }
    }
    expect(offered).toBeGreaterThan(5);
  });

  it('poruke o lokaciji: isti tekst za svaki kod i za aplikaciju i za pregledač', () => {
    for (const inApp of [true, false]) {
      ctx()['__a'] = inApp;
      legacy.evalIn('uAplikaciji=function(){return __a}; 0');
      for (const code of [1, 2, 3, 0, undefined, 99]) {
        ctx()['__c'] = code === undefined ? null : { code };
        ctx()['__e'] = code === undefined ? undefined : { code };
        expect(geoMessage(code, inApp), `${String(code)} ${inApp}`).toBe(
          legacy.evalIn('geoPoruka(__e)')
        );
      }
      expect(geoMessage(undefined, inApp)).toBe(legacy.evalIn('geoPoruka(null)'));
    }
    for (const v of [44.80412, -0.005, 20.4649, 0, 89.999, -179.995, 12.345])
      expect(roundCoord(v)).toBe(Math.round(v * 100) / 100);
  });

  it('sat i temperatura odrađenog trčanja: Open-Meteo je merodavan, sat samo kao označena rezerva', () => {
    const r = rng(37);
    let om = 0;
    let wrist = 0;
    let none = 0;
    for (let i = 0; i < 80; i++) {
      const sati = parseForecast(forecastJson(r, i % 4)) as Record<string, unknown>;
      const cache: ForecastCache = { at: 1, lat: 1, lon: 2, sati: sati as never };
      const useCache = r() < 0.75;
      ctx()['__v'] = useCache ? j(cache) : null;
      const trainingHr = Math.floor(r() * 24);
      ctx()['__s'] = trainingHr;
      legacy.evalIn('S.vreme=__v; S.ui.satTreninga=__s; 0');
      const log: Record<string, unknown> = {};
      const x = r();
      if (x < 0.7) log['satTrk'] = Math.floor(r() * 24);
      else if (x < 0.8) log['satTrk'] = ['x', '', null, 30, -2, true][Math.floor(r() * 6)];
      if (r() < 0.8) log['sec'] = Math.floor(r() * 9000) - 200;
      if (r() < 0.5) log['temp'] = 20 + Math.floor(r() * 150) / 10;
      if (r() < 0.3) log['icu'] = { osecaSe: 22 + Math.floor(r() * 80) / 10 };
      const date = addDays(TODAY as IsoDate, -Math.floor(r() * 9));
      ctx()['__l'] = j(log);
      ctx()['__d'] = date;
      expect(runHour(log, trainingHr), JSON.stringify(log)).toBe(legacy.evalIn('satTrcanja(__l)'));
      const mine = runTemp(log, date, useCache ? cache : null, trainingHr);
      const old = j<unknown>(legacy.evalIn('tempTrcanja(__l,__d)'));
      expect(mine === null ? null : j(mine), JSON.stringify(log)).toEqual(old);
      if (mine?.izvor === 'om') om++;
      else if (mine?.izvor === 'sat') wrist++;
      else none++;
    }
    expect(om).toBeGreaterThan(15);
    expect(wrist).toBeGreaterThan(5);
    expect(none).toBeGreaterThan(2);
    expect(runTemp(null, TODAY, null, 18)).toBeNull();
  });

  it('ciljni tempo dana na svim danima 4 plana: sesija → predikcija → zona iz forme', () => {
    let n = 0;
    let fromZone = 0;
    for (const [dist, sec, weeks, back] of [
      [5000, 1237, 12, 6],
      [10000, 2570, 14, 3],
      [21097.5, 5700, 18, 10],
      [10000, 2570, 16, 12]
    ] as const) {
      const start = addDays('2026-07-13' as IsoDate, -back * 7);
      const gen = adaptGeneratedPlan(
        generatePlan({
          startDate: start,
          raceDate: addDays(start, weeks * 7 + 3),
          raceDistM: dist,
          pb: { distM: dist, sec },
          weeklyKm: 45,
          runDays: 5,
          quality: 2,
          intensity: 'std',
          trainedRecently: true
        })
      );
      if (!gen) throw new Error('adapt');
      const plan: GenPlanState = gen;
      for (const variant of [0, 1, 2]) {
        const vdotLog: VdotRecord[] =
          variant === 1
            ? [{ id: 'g1_0', ts: '2026-02-01', vdot: 47.4, prev: 46, delta: 1.4, measured: 48 }]
            : variant === 2
              ? [{ id: 'g1_0', ts: '2026-02-01', vdot: 12, prev: 12, delta: 0, measured: 12 }]
              : [];
        ctx()['__p'] = j(plan);
        ctx()['__v'] = j(vdotLog);
        legacy.evalIn(
          'S.genPlan=__p; S.alts={}; S.moves={}; S.vdotLog=__v; setActivePlan(); rebuildDateIndex(); 0'
        );
        const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
        const rows = (plan.pred ?? []).filter((x): x is StoredPredRow => typeof x.id === 'string');
        const vdot = currentVdot(vdotLog);
        for (const w of resolved.weeks)
          for (const d of w.days) {
            if (d.rest || !d.date) continue;
            ctx()['__id'] = d.id;
            const old = legacy.evalIn('cilJTempoDana(DATED.find(x=>x.id===__id))') as number | null;
            const predPace = predRowsForDay(resolved, d, rows)[0]?.pt ?? null;
            const mine = targetPace(d, predPace, vdot);
            expect(mine, `${dist} v${variant} ${d.id}`).toBe(old);
            if (mine != null) n++;
            if (mine != null && !d.session?.paceSec && !predPace) fromZone++;
          }
      }
    }
    expect(n).toBeGreaterThan(100);
    expect(fromZone).toBeGreaterThan(20);
  });
});

/* Kartica: stari kod vraća HTML; poredi se strukturno (zaglavlje, redovi sa delovima, napomena), ne bajt po bajt. */
function parseLegacyCard(html: string): {
  extra: string;
  rows: Array<{ label: string; parts: Array<[string, string]> }>;
  note: string;
} | null {
  if (!html) return null;
  const un = (t: string): string =>
    t
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  const extra = /<span class="dhead-x">(.*?)<\/span>/.exec(html)?.[1] ?? '';
  const rows = [
    ...html.matchAll(
      /<div class="drow"><span class="l">(.*?)<\/span><span class="v">(.*?)<\/span><\/div>/g
    )
  ].map((m) => ({
    label: un(m[1] as string),
    parts: [...(m[2] as string).matchAll(/<(b|small)>(.*?)<\/\1>/g)].map((x): [string, string] => [
      x[1] as string,
      un(x[2] as string)
    ])
  }));
  const note = /<div class="note-src">(.*?)<\/div>/.exec(html)?.[1] ?? '';
  return { extra: un(extra), rows, note: un(note) };
}

describe('kartica vremena naspram starog koda', () => {
  it('redovi, prilagođen tempo uz vrućinu i savet za najhladniji sat — na planovima × temperaturama × satu treninga', () => {
    const r = rng(91);
    let cards = 0;
    let withPace = 0;
    let withBetter = 0;
    let withNow = 0;
    const start = addDays(TODAY as IsoDate, -15);
    const gen = adaptGeneratedPlan(
      generatePlan({
        startDate: start,
        raceDate: addDays(start, 12 * 7 + 3),
        raceDistM: 10000,
        pb: { distM: 10000, sec: 2570 },
        weeklyKm: 45,
        runDays: 6,
        quality: 2,
        intensity: 'std',
        trainedRecently: true
      })
    );
    if (!gen) throw new Error('adapt');
    const plan: GenPlanState = gen;
    const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
    const rows = (plan.pred ?? []).filter((x): x is StoredPredRow => typeof x.id === 'string');
    for (const base of [8, 18, 22, 27, 32, 38]) {
      for (const hr of [NOW_HOUR, 7, 18, 20]) {
        const sati: Record<string, unknown> = {};
        for (let off = -7; off <= 2; off++)
          for (let h = 0; h < 24; h++) {
            const feel =
              base + 6 * Math.sin(((h - 9) / 24) * Math.PI * 2) + (r() < 0.05 ? 4 : 0) + off * 0.2;
            sati[`${addDays(TODAY as IsoDate, off)}T${pad(h)}`] = {
              ...(h % 3 === 0
                ? { temp: Math.round(feel) - 1, osecaj: Math.round(feel) }
                : {
                    temp: Math.round((feel - (r() < 0.5 ? 0 : 3)) * 10) / 10,
                    osecaj: Math.round(feel * 10) / 10
                  }),
              vlaga: r() < 0.9 ? Math.floor(r() * 100) : null,
              vetar: r() < 0.9 ? Math.floor(r() * 30) : null,
              kisa: r() < 0.9 ? Math.floor(r() * 100) : null
            };
          }
        const cache: ForecastCache = { at: 1, lat: 1, lon: 2, sati: sati as never };
        ctx()['__v'] = j(cache);
        ctx()['__s'] = hr;
        ctx()['__p'] = j(plan);
        const vdotLog: VdotRecord[] =
          base > 20
            ? [{ id: 'g1_0', ts: '2026-02-01', vdot: 47.4, prev: 46, delta: 1.4, measured: 48 }]
            : [];
        ctx()['__vl'] = j(vdotLog);
        legacy.evalIn(
          'S.vreme=__v; S.ui.satTreninga=__s; S.ui.geo={lat:1,lon:2}; S.genPlan=__p; S.alts={}; S.moves={}; S.vdotLog=__vl; setActivePlan(); rebuildDateIndex(); 0'
        );
        const vdot = currentVdot(vdotLog);
        for (const w of resolved.weeks)
          for (const d of w.days) {
            ctx()['__id'] = d.id;
            const html = legacy.evalIn('karticaVremena(DATED.find(x=>x.id===__id))') as string;
            const old = parseLegacyCard(html);
            const predPace = predRowsForDay(resolved, d, rows)[0]?.pt ?? null;
            const mine = weatherCard({
              day: d,
              today: TODAY,
              nowHour: NOW_HOUR,
              trainingHour: hr,
              cache,
              hasLocation: true,
              predPace,
              vdot
            });
            expect(
              mine && {
                ...mine,
                rows: mine.rows.map((x) => ({
                  label: x.label,
                  parts: x.parts.map((p) => [p.kind, p.text])
                }))
              },
              `${base} ${hr} ${d.id}`
            ).toEqual(old);
            if (mine) {
              cards++;
              if (mine.rows.some((x) => x.label === 'tempo uz vrućinu')) withPace++;
              if (mine.note.startsWith('Hladnije') || mine.note.includes(' Hladnije')) withBetter++;
              if (mine.rows.some((x) => x.label.startsWith('sada'))) withNow++;
            }
          }
      }
    }
    expect(cards).toBeGreaterThan(30);
    expect(withPace).toBeGreaterThan(3);
    expect(withBetter).toBeGreaterThan(3);
    expect(withNow).toBeGreaterThan(3);
    expect(
      weatherCard({
        day: { rest: true, date: TODAY },
        today: TODAY,
        nowHour: 1,
        trainingHour: 18,
        cache: null,
        hasLocation: true,
        predPace: null,
        vdot: null
      })
    ).toBeNull();
  });
});
