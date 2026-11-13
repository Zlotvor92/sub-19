/* F4-K — kalibracija procene forme na stvarnoj istoriji vlasnika (Strava, 1. 4. – 6. 11. 2026).
   Samo analiza: `estimateForm` se pušta unazad, na dan pre svake trke/testa, sa trčanjima pre tog dana, i poredi
   sa stvarnim rezultatom. Model se NE menja; promašaji su upisani kao `it.fails` sa razlogom (F4K-REPORT). */
import { describe, expect, it } from 'vitest';
import type { FormEstimate, Lap } from '../engine/types';
import { raceTimeSec, vdotFromResult } from '../engine/vdot';
import { dayNum, estimateForm, isoOf } from './estimate';
import { clock } from './explain';
import type { FitnessFacts, FitnessRun } from './types';
import sample from './fixtures/owner-strava-2026.json';
import extra from './fixtures/owner-strava-2026.extra.json';

interface SampleRun {
  date: string;
  dayId: string;
  km: number;
  sec: number;
  hr?: number;
  temp?: number;
  race: boolean;
  splits: number[][];
}
interface ExtraRun {
  tempC?: number;
  lapsKm?: { distM: number; sec: number; hr?: number }[];
  note?: string;
}

const HALF = 21097.5;
/** Predlog F4-K: gubitak VDOT po jedinici ln(dužina cilja / dužina rezultata) za trkača ~25–40 km nedeljno. [niska] */
const BETA = 3.5;
const extras = extra as unknown as Record<string, ExtraRun | undefined>;

/** Krugovi sa sata: rad = krug brži od 0,92 × prosečnog tempa trčanja (oznaka uloge ne postoji u podacima). */
function lapsOf(x: ExtraRun | undefined, avgPace: number): Lap[] | undefined {
  const laps = x?.lapsKm;
  if (laps === undefined || laps.length === 0) return undefined;
  return laps.map((l) => ({
    role: l.distM > 0 && (l.sec / l.distM) * 1000 <= 0.92 * avgPace ? 'work' : 'recovery',
    distanceM: l.distM,
    durationSec: l.sec,
    ...(l.hr !== undefined ? { avgHr: l.hr } : {})
  }));
}

function ownerRuns(withHr: boolean): FitnessRun[] {
  return (sample.runs as SampleRun[]).map((r) => {
    const key = `${r.date}#${r.dayId.slice(1)}`;
    const x = extras[key];
    const isTest = x?.note?.includes('TEST') === true;
    const half = r.race && r.km > 21;
    const distanceM = half ? HALF : isTest ? 3000 : Math.round(r.km * 1000);
    /* test 9. 8.: tri uzastopna kruga od 1 km punim naporom (233 + 232 + 231 s), pa hlađenje */
    const durationSec = isTest ? 696 : r.sec;
    /* trka i test se boduju celi (krugovi samo za opterećenje treninga) */
    const laps = isTest || r.race ? undefined : lapsOf(x, r.sec / r.km);
    const temp = r.temp ?? x?.tempC;
    return {
      id: `${r.date}-${r.dayId}`,
      date: r.date,
      distanceM,
      durationSec,
      ...(withHr && r.hr !== undefined ? { avgHr: r.hr } : {}),
      ...(temp !== undefined ? { tempC: temp } : {}),
      ...(r.splits.length > 0 && !isTest
        ? {
            splits: r.splits.map(([paceSec, hr]) => ({
              paceSec: paceSec ?? 0,
              ...(withHr && hr !== undefined ? { hr } : {})
            }))
          }
        : {}),
      ...(laps !== undefined ? { laps } : {}),
      ...(r.race ? { effort: 'race' as const } : isTest ? { effort: 'test' as const } : {})
    };
  });
}

function factsOn(today: string, withHr: boolean): FitnessFacts {
  return {
    today,
    availability: { runDays: [1, 3, 5, 6], longDay: 6 },
    profile: {},
    runs: ownerRuns(withHr).filter((r) => r.date <= today),
    pauses: [],
    pain: []
  };
}

const prev = (iso: string): string => isoOf(dayNum(iso) - 1);

interface Check {
  date: string;
  label: string;
  distanceM: number;
  actualSec: number;
}
/** Rezultati iz podataka (trajanje = vreme iz fiksture; HM zvanična dužina). */
const CHECKS: Check[] = ownerRuns(true)
  .filter((r) => r.effort !== undefined)
  .map((r) => ({
    date: r.date,
    label: `${r.effort === 'test' ? 'test' : 'trka'} ${(r.distanceM / 1000).toFixed(2)} km`,
    distanceM: r.distanceM,
    actualSec: r.durationSec
  }));

function predict(c: Check, withHr: boolean): { e: FormEstimate; errSec: number; inRange: boolean } {
  const e = estimateForm(
    factsOn(prev(c.date), withHr),
    { distanceM: c.distanceM, raceDate: c.date },
    null
  );
  const predicted = e.current.raceTimeSec;
  return {
    e,
    errSec: predicted - c.actualSec,
    inRange: c.actualSec >= e.raceDay.lowSec && c.actualSec <= e.raceDay.highSec
  };
}

describe('F4-K: istorija vlasnika', () => {
  it('ispis: procena na dan pre svakog rezultata, sa pulsom i bez', () => {
    const rows: string[] = [];
    for (const c of CHECKS) {
      for (const hr of [true, false]) {
        const p = predict(c, hr);
        rows.push(
          [
            c.date,
            c.label.padEnd(16),
            hr ? 'puls' : 'bez ',
            `stvarno ${clock(c.actualSec)}`,
            `procena ${clock(p.e.current.raceTimeSec)}`,
            `greška ${p.errSec >= 0 ? '+' : ''}${String(p.errSec)} s (${((100 * p.errSec) / c.actualSec).toFixed(1)} %)`,
            `raspon ${clock(p.e.raceDay.lowSec)}–${clock(p.e.raceDay.highSec)} ${p.inRange ? 'DA' : 'NE'}`,
            p.e.current.confidence,
            `VDOT ${String(p.e.current.vdot)} → stvarno ${vdotFromResult(c.distanceM, c.actualSec).toFixed(2)}`
          ].join(' | ')
        );
      }
    }
    console.log(rows.join('\n'));
    expect(rows.length).toBe(CHECKS.length * 2);
  });

  it('ispis: tok procene po nedeljama (nedelja), obim i signali', () => {
    const rows: string[] = [];
    const runs = ownerRuns(true);
    let prevVdot: number | null = null;
    for (let d = dayNum('2026-04-05'); d <= dayNum('2026-11-15'); d += 7) {
      const today = isoOf(Math.min(d, dayNum('2026-11-13')));
      const e = estimateForm(
        factsOn(today, true),
        { distanceM: HALF, raceDate: '2026-12-13' },
        null
      );
      const km = runs
        .filter((r) => dayNum(r.date) > d - 7 && dayNum(r.date) <= d)
        .reduce((a, r) => a + r.distanceM / 1000, 0);
      const week = e.history.filter((h) => dayNum(h.date) > d - 7 && dayNum(h.date) <= d);
      rows.push(
        `${today} | ${km.toFixed(1).padStart(5)} km | VDOT ${String(e.current.vdot).padEnd(5)} ` +
          `(${prevVdot === null ? '' : (e.current.vdot - prevVdot >= 0 ? '+' : '') + (e.current.vdot - prevVdot).toFixed(2)}) ` +
          `${clock(e.current.raceTimeSec)} ${e.current.confidence} | ` +
          week.map((h) => `${h.signal} ${String(h.before)}→${String(h.after)}`).join('; ')
      );
      prevVdot = e.current.vdot;
    }
    const last = estimateForm(
      factsOn('2026-11-13', true),
      { distanceM: HALF, raceDate: '2026-12-13' },
      null
    );
    console.log(rows.join('\n'));
    console.log(
      last.history
        .filter((h) => h.date >= '2026-09-01')
        .map((h) => `${h.date} ${h.signal}: ${h.reason}`)
        .join('\n')
    );
    expect(rows.length).toBeGreaterThan(30);
  });

  it('ispis: danas (13. 11.) za Bokeški 13. 12. i Beogradski 17. 4. 2027', () => {
    const out: string[] = [];
    for (const [name, raceDate] of [
      ['Bokeški 13. 12. 2026', '2026-12-13'],
      ['Beogradski 17. 4. 2027', '2027-04-17']
    ] as const) {
      for (const hr of [true, false]) {
        const e = estimateForm(factsOn('2026-11-13', hr), { distanceM: HALF, raceDate }, null);
        out.push(
          `${name} ${hr ? 'puls' : 'bez '}: danas ${String(e.current.vdot)} (${clock(e.current.raceTimeSec)}, ${e.current.confidence}); ` +
            `raspon ${clock(e.raceDay.lowSec)} – ${clock(e.raceDay.expectedSec)} – ${clock(e.raceDay.highSec)}, G ${String(e.ceilingGain)}`
        );
      }
    }
    console.log(out.join('\n'));
    expect(out.length).toBe(4);
  });

  it('ispis: stvarni napredak iz rezultata i obim po mesecima', () => {
    const runs = ownerRuns(true);
    const res = CHECKS.map(
      (c) => `${c.date} ${c.label}: VDOT ${vdotFromResult(c.distanceM, c.actualSec).toFixed(2)}`
    );
    const months: string[] = [];
    for (let m = 4; m <= 11; m += 1) {
      const mm = String(m).padStart(2, '0');
      const inM = runs.filter((r) => r.date.slice(5, 7) === mm);
      const km = inM.reduce((a, r) => a + r.distanceM / 1000, 0);
      months.push(`2026-${mm}: ${String(inM.length)} trčanja, ${km.toFixed(0)} km`);
    }
    console.log([...res, ...months].join('\n'));
    expect(raceTimeSec(45, HALF)).toBeGreaterThan(0);
  });

  it('ispis: predlog — prenos rezultata na drugu dužinu (β = 3,5 VDOT po ln dužine), poslednji rezultat', () => {
    const rows: string[] = [];
    for (const [i, c] of CHECKS.entries()) {
      if (i === 0) continue;
      const before = CHECKS.slice(0, i);
      /* najbliži po dužini među rezultatima u 120 dana pre, toplota ≥ 30 °C se preskače */
      const hot = (x: Check): boolean =>
        (ownerRuns(true).find((r) => r.date === x.date && r.effort !== undefined)?.tempC ?? 0) >=
        30;
      const pool = before.filter((x) => dayNum(c.date) - dayNum(x.date) <= 120 && !hot(x));
      const src = [...pool].sort(
        (a, b) =>
          Math.abs(Math.log(a.distanceM / c.distanceM)) -
            Math.abs(Math.log(b.distanceM / c.distanceM)) || dayNum(b.date) - dayNum(a.date)
      )[0];
      if (src === undefined) continue;
      const v =
        vdotFromResult(src.distanceM, src.actualSec) - BETA * Math.log(c.distanceM / src.distanceM);
      const t = raceTimeSec(v, c.distanceM);
      rows.push(
        `${c.date} ${c.label}: iz ${src.date} ${src.label} → ${clock(t)} (stvarno ${clock(c.actualSec)}, ` +
          `greška ${((100 * (t - c.actualSec)) / c.actualSec).toFixed(1)} %, VDOT ${v.toFixed(2)})`
      );
    }
    console.log(rows.join('\n'));
    expect(rows.length).toBeGreaterThan(3);
  });

  it('jedan trening ne pomera procenu: između nedelja bez trke/testa promena ≤ 0,3 VDOT', () => {
    let prevVdot: number | null = null;
    for (let d = dayNum('2026-05-03'); d <= dayNum('2026-11-08'); d += 7) {
      const e = estimateForm(
        factsOn(isoOf(d), true),
        { distanceM: HALF, raceDate: '2026-12-13' },
        null
      );
      const results = e.history.filter(
        (h) =>
          (h.signal === 'trka' || h.signal === 'test' || h.signal === 'baza') &&
          dayNum(h.date) > d - 7
      );
      if (prevVdot !== null && results.length === 0) {
        expect(Math.abs(e.current.vdot - prevVdot)).toBeLessThanOrEqual(0.3);
      }
      prevVdot = e.current.vdot;
    }
  });

  it('pad obima u oktobru: forma opada postepeno, ukupno ≤ 3 %, svaki korak ima rečenicu', () => {
    const e = estimateForm(
      factsOn('2026-11-13', true),
      { distanceM: HALF, raceDate: '2026-12-13' },
      null
    );
    const drops = e.history.filter((h) => h.signal === 'baza');
    expect(drops.length).toBeGreaterThan(0);
    const first = drops[0]?.before ?? 0;
    const last = drops[drops.length - 1]?.after ?? 0;
    expect(last).toBeLessThan(first);
    expect(last).toBeGreaterThanOrEqual(first * 0.97 - 0.01);
    expect(drops.every((h) => h.reason.includes('šest nedelja'))).toBe(true);
  });

  it('puls (21 trčanje sa zgloba) ne menja procenu ni na jednom datumu', () => {
    for (const c of CHECKS) {
      expect(predict(c, true).e.current.vdot).toBe(predict(c, false).e.current.vdot);
    }
  });

  /* ---------------- nalazi F4-K posle ispravke F4-K2 (bili `it.fails`) ---------------- */

  it('NALAZ 1 (ispravljen): polumaraton 3. 10. (1:42:09, 22,2 °C) ulazi u procenu, sa rečenicom', () => {
    const e = estimateForm(
      factsOn('2026-11-13', true),
      { distanceM: HALF, raceDate: '2026-12-13' },
      null
    );
    const race = e.history.find((h) => h.date === '2026-10-03' && h.signal === 'trka');
    expect(race).toBeDefined();
    expect(race?.after).toBeLessThan(race?.before ?? 0);
  });

  it('NALAZ 2 (delimično): back-test — srednja aps. greška ≤ 5 %, polumaraton u rasponu (stvarno: v. F4K-REPORT)', () => {
    const errs = CHECKS.map((c) => predict(c, true));
    const mae =
      errs.reduce((a, p, i) => a + Math.abs(p.errSec) / (CHECKS[i]?.actualSec ?? 1), 0) /
      errs.length;
    expect(mae).toBeLessThanOrEqual(0.05);
    const half = CHECKS.findIndex((c) => c.distanceM === HALF);
    expect(errs[half]?.inRange).toBe(true);
    expect(Math.abs(errs[half]?.errSec ?? 999) / 6129).toBeLessThanOrEqual(0.03);
  });

  it.fails(
    'cilj organizatora još NIJE dostignut: srednja greška ≤ 3 % i ≥ 4 od 6 u rasponu (kratke trke posle dužih: naviše se ne prenosi)',
    () => {
      const errs = CHECKS.map((c) => predict(c, true));
      const mae =
        errs.reduce((a, p, i) => a + Math.abs(p.errSec) / (CHECKS[i]?.actualSec ?? 1), 0) /
        errs.length;
      expect(mae).toBeLessThanOrEqual(0.03);
      expect(errs.filter((p) => p.inRange).length).toBeGreaterThanOrEqual(4);
    }
  );

  it('NALAZ 3 (ispravljen): bez plana (planned = null) nema rečenica o „planiranom opterećenju"', () => {
    const e = estimateForm(
      factsOn('2026-11-13', true),
      { distanceM: HALF, raceDate: '2026-12-13' },
      null
    );
    expect(e.history.some((h) => h.signal === 'plan' && h.reason.includes('planiranog'))).toBe(
      false
    );
  });

  it('NALAZ 4 (ispravljen): procena za polumaraton danas nije brža od poslednjeg polumaratona za više od 3 %', () => {
    const e = estimateForm(
      factsOn('2026-11-13', true),
      { distanceM: HALF, raceDate: '2026-12-13' },
      null
    );
    expect(e.current.raceTimeSec).toBeGreaterThan(6129 * 0.97);
  });
});
