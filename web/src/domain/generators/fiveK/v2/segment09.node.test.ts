/* Segment 5K-09 (5k-v2.11.0): ispravke posle dubinske provere (docs/generators-v2/audit/fixes/5K.md). Svaki test je
   ulaz iz nalaza (pada na c13c258, prolazi posle); merne skripte i brojevi pre → posle su u
   docs/5k-v2/reports/SEGMENT-09-IMPLEMENTATION.md. */

import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays, daysBetween, weekdayOf } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { raceTimeForVdot } from './paces.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { START } from './testInputs.ts';
import { kmText, mss, userText } from './text.ts';
import type { IsoDate } from '../exchange.ts';
import type { AdaptResult, FiveKV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { raceWeekEasyCap, sharpenerCandidates } from './week.ts';
import { restoreMerge } from './app/adapt.ts';
import { formHistory } from './app/form.ts';
import { targetFacts, targetInput } from './app/handoffTarget.ts';
import { generatedPlan, storedPlan } from './app/plan.ts';

type Gen = ReturnType<typeof generateFiveKV2>;
const planOf = (input: Record<string, unknown>): FiveKV2Plan => {
  const r = generateFiveKV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
  return r.plan;
};
const adapted = (r: AdaptResult): FiveKV2Plan => {
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const errors = (p: FiveKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const WD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const subsets = (k: number, from = 0): string[][] =>
  k === 0
    ? [[]]
    : WD.slice(from).flatMap((d, j) => subsets(k - 1, from + j + 1).map((s) => [d, ...s]));
const result = (vdot: number, date: string, distanceM = 5000) => ({
  distanceM,
  timeSec: Math.round(raceTimeForVdot(vdot, distanceM)),
  date
});
/** Izvršeni treninzi plana od `from` do `to` (km × share), pre starta obim ulaza po danu (kao final-check lib). */
function runsIn(p: FiveKV2Plan, from: string, to: string, share = 1): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const byDate = new Map(p.weeks.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const pd = byDate.get(d);
    if (pd && pd.countsToWeek)
      out.push({
        date: d,
        dayId: d,
        km: Math.round(pd.workout.km * share * 100) / 100,
        durationSec: Math.round(pd.workout.sec * share),
        completed: true,
        rpe: 5
      });
    else if (!pd && d < p.input.startDate && p.input.runDays.includes(weekdayOf(d)))
      out.push({
        date: d,
        km: Math.round((p.input.currentWeeklyKm / p.input.runDays.length) * share * 10) / 10,
        durationSec: 2400,
        completed: true,
        rpe: 5
      });
  }
  return out;
}

describe('F1: 3 dana — oštrenje bez zahtevnog dana ≥ 3 dana pre trke', () => {
  it('nalaz: uto/pet/ned + trka ned → plan (ranije WEEK_INFEASIBLE); oštrenje na laganom danu ≥ 2 dana pre trke', () => {
    const p = planOf({
      startDate: '2026-12-28',
      raceDate: '2027-03-07',
      runDays: ['tue', 'fri', 'sun'],
      currentWeeklyKm: 20,
      recentResult: { distanceM: 5000, timeSec: 1309, date: '2026-12-18' },
      goalTimeSec: null
    });
    const race = p.weeks.at(-1)!;
    const q = race.days.filter((d) => d.workout.kind === 'quality');
    expect(q).toHaveLength(1);
    expect(daysBetween(q[0]!.date, p.input.raceDate)).toBeGreaterThanOrEqual(
      P.schedule.sharpenerEasyMinGapDays
    );
    expect([p.pattern.q1, p.pattern.long]).not.toContain(q[0]!.weekday);
    expect(race.notes.some((n) => n.startsWith('Oštrenje je na laganom danu'))).toBe(true);
    expect(errors(p)).toEqual([]);
  });

  it('svi skupovi 3 dana × dan trke (245): 0 WEEK_INFEASIBLE, 0 odbijanja', () => {
    const bad: string[] = [];
    for (const days of subsets(3))
      for (let rw = 0; rw < 7; rw++) {
        const race = addDays('2027-03-01', rw);
        const start = addDays(race, -69);
        const r: Gen = generateFiveKV2({
          startDate: start,
          raceDate: race,
          runDays: days,
          currentWeeklyKm: 20,
          recentResult: result(45, addDays(start, -10)),
          goalTimeSec: null
        });
        if (!r.ok) bad.push(`${days.join(',')} trka ${WD[rw]}: ${r.reasons[0]!.code}`);
      }
    expect(bad).toEqual([]);
  });

  it('jedan vlasnik: rezervni dan nije uz zahtevni dan prethodne nedelje (pon/pet/ned, trka ned → pet, ne pon)', () => {
    const gap = (w: string): number => ({ mon: 6, fri: 2, sun: 0 })[w]!;
    const c = sharpenerCandidates(
      { q1: 'fri', q2: null, long: 'sun', easy: ['mon'] },
      ['mon', 'fri', 'sun'],
      'sun',
      gap
    );
    expect(c).toEqual({ days: ['fri'], onEasyDay: true, minGap: 2 });
  });
});

describe('F2: 3 dana / 12 km — kvalitet koji ne staje: manja doza ili bez kvaliteta uz upozorenje', () => {
  it('nalaz: VDOT 30, 8 ned → plan (ranije QUALITY_INFEASIBLE ned 7), upozorenje QUALITY_REDUCED', () => {
    const p = planOf({
      startDate: '2027-01-11',
      raceDate: '2027-03-07',
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 12,
      recentResult: { distanceM: 5000, timeSec: 1841, date: '2027-01-01' },
      goalTimeSec: null
    });
    const w7 = p.weeks[6]!;
    expect(w7.limits?.quality).toBeDefined();
    expect(p.warnings.filter((w) => w.rule === 'QUALITY_REDUCED').map((w) => w.week)).toContain(7);
    expect(errors(p)).toEqual([]);
  });

  it('mreža 3 dana × 12 km × 6–16 ned × VDOT 30–60 (3 skupa dana): 0 odbijanja', () => {
    const bad: string[] = [];
    for (const days of [
      ['tue', 'thu', 'sun'],
      ['mon', 'wed', 'sat'],
      ['mon', 'thu', 'sat']
    ])
      for (let w = 6; w <= 16; w++)
        for (let v = 30; v <= 60; v += 3) {
          const race = '2027-03-07';
          const start = addDays(race, -7 * w + 1);
          const r: Gen = generateFiveKV2({
            startDate: start,
            raceDate: race,
            runDays: days,
            currentWeeklyKm: 12,
            recentResult: result(v, addDays(start, -10)),
            goalTimeSec: null
          });
          if (!r.ok) bad.push(`${days.join(',')} ${w} ned v${v}: ${r.reasons[0]!.code}`);
        }
    expect(bad).toEqual([]);
  });
});

describe('Z5: 5K kao cilj predaje sam određuje politiku', () => {
  const base = {
    raceDate: '2026-12-27',
    weeklyKm: 30,
    runDows: [2, 4, 6, 7],
    trainedRecently: true
  };
  it('Z5a: rezultat polumaratona → plan po osećaju (lak tempo iz rezultata), ne RESULT_DISTANCE_UNSUPPORTED', () => {
    const input = targetInput(
      { ...base, pb: { distM: 21097.5, sec: 6600, date: '2026-10-20' } },
      '2026-11-02'
    );
    expect(input['recentResult']).toBeNull();
    const ep = input['typicalEasyPaceSecPerKm'] as number;
    expect(ep).toBeGreaterThanOrEqual(P.input.easyPaceSecPerKm.min);
    expect(ep).toBeLessThanOrEqual(P.input.easyPaceSecPerKm.max);
    const p = planOf(input);
    expect(p.paceMode).toBe('feel');
    // Lak tempo izvora ima prednost.
    expect(
      targetInput(
        { ...base, pb: { distM: 42195, sec: 14400, date: '2026-10-20' }, easyPaceSecPerKm: 400 },
        '2026-11-02'
      )['typicalEasyPaceSecPerKm']
    ).toBe(400);
    // Rezultat 3/5/10 km ide doslovno.
    expect(
      targetInput({ ...base, pb: { distM: 10000, sec: 2700, date: '2026-10-20' } }, '2026-11-02')[
        'recentResult'
      ]
    ).toEqual({ distanceM: 10000, timeSec: 2700, date: '2026-10-20' });
  });

  it('Z5a u adaptaciji: rezultat nepodržane distance iz činjenica izvora se ne prosleđuje (ranije ADAPT_RESULT_INVALID)', () => {
    const facts = targetFacts({
      execution: null,
      restartFromBase: false,
      raw: {
        results: [
          { distM: 21097.5, sec: 6600, date: '2026-11-10', kind: 'race' },
          { distM: 5000, sec: 1500, date: '2026-11-11', kind: 'race' }
        ]
      }
    });
    expect(facts['results']).toEqual([
      { distM: 5000, sec: 1500, date: '2026-11-11', kind: 'race' }
    ]);
    const p = planOf(targetInput({ ...base, easyPaceSecPerKm: 400 }, '2026-11-02'));
    expect(
      adaptFiveKV2(
        p,
        {
          results: [{ distM: 21097.5, sec: 6600, date: '2026-11-10', kind: 'race' }]
        },
        '2026-11-12'
      ).ok
    ).toBe(false);
    expect(adaptFiveKV2(p, { ...facts, results: [] }, '2026-11-12').ok).toBe(true);
  });

  it('Z5b: početnik izvora sa 5 dana (više od maksimuma početnika 5K) → plan bez oznake početnika', () => {
    const input = targetInput(
      {
        ...base,
        runDows: [1, 2, 4, 6, 7],
        trainedRecently: false,
        easyPaceSecPerKm: 420
      },
      '2026-11-02'
    );
    expect(input['experience']).toBe('regular');
    expect(generateFiveKV2(input).ok).toBe(true);
    // Do 4 dana početnik ostaje početnik.
    expect(
      targetInput({ ...base, trainedRecently: false, easyPaceSecPerKm: 420 }, '2026-11-02')[
        'experience'
      ]
    ).toBe('beginner');
  });
});

describe('C8: VDOT ispod opsega → plan po osećaju (kao 10K); iznad → odbijanje', () => {
  const input = (timeSec: number, ep?: number) => ({
    startDate: START,
    raceDate: addDays(START, 7 * 9 - 1),
    runDays: ['tue', 'thu', 'sun'],
    currentWeeklyKm: 20,
    recentResult: { distanceM: 5000, timeSec, date: addDays(START, -8) },
    goalTimeSec: null,
    ...(ep ? { typicalEasyPaceSecPerKm: ep } : {})
  });
  it('5 km 31:40 (VDOT < 30) + lak tempo → po osećaju, rezultat kao informacija', () => {
    const p = planOf(input(1900, 420));
    expect([p.paceMode, p.vdot]).toEqual(['feel', null]);
    expect(p.notes.some((n) => n.includes('sporiji od opsega tabela tempa'))).toBe(true);
  });
  it('bez laganog tempa MISSING_EASY_PACE; VDOT > 60 VDOT_OUT_OF_RANGE', () => {
    const codes = (r: Gen) => (r.ok ? [] : r.reasons.map((x) => x.code));
    expect(codes(generateFiveKV2(input(1900)))).toEqual(['MISSING_EASY_PACE']);
    expect(codes(generateFiveKV2(input(900, 420)))).toEqual(['VDOT_OUT_OF_RANGE']);
  });
});

describe('Z4: vraćanje revizije kroz spajanje jezgra', () => {
  it('nalaz: v45-d3-15km-7w, bol 5 na kraju ned 2, vraćanje verzije bez adaptacije posle 4 dana — vraćen plan prolazi validator, sledeća adaptacija nije odbijena', () => {
    const g = planOf({
      startDate: START,
      raceDate: addDays(START, 7 * 7 - 1),
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 15,
      recentResult: result(45, addDays(START, -14)),
      goalTimeSec: null
    });
    const asOf = '2026-11-15';
    const cur = adapted(
      adaptFiveKV2(
        g,
        {
          workouts: [
            ...runsIn(g, addDays(START, -7), asOf).slice(0, -1),
            { date: asOf, km: 0, durationSec: 0, completed: false, pain: 5 }
          ]
        },
        asOf
      )
    );
    const store = (p: FiveKV2Plan) => storedPlan(generatedPlan(p));
    const today = addDays(asOf, 4);
    const r = restoreMerge(store(cur), store(g), today as IsoDate, {});
    // Vraća se (budući dani iz verzije, prošla nedelja bola ostaje i postaje mešovita), bez sukoba.
    expect(
      (r.meta as unknown as { futureChanges: { conflicts: string[] } }).futureChanges.conflicts
    ).toEqual([]);
    const core = (r as unknown as { fiveKV2: FiveKV2Plan }).fiveKV2;
    expect(errors(core)).toEqual([]);
    expect(adaptFiveKV2(core, {}, today).ok).toBe(true);
  });
});

describe('M2/M3: napomene adaptacije', () => {
  const g = () =>
    planOf({
      startDate: START,
      raceDate: addDays(START, 7 * 10 - 1),
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 15,
      recentResult: result(45, addDays(START, -14)),
      goalTimeSec: null
    });
  it('M2: napomena odmora/bola nema broj planiranog pre upisa (bez „planirano X km < cilj")', () => {
    const p = g();
    const asOf = '2026-11-18';
    const r = adapted(
      adaptFiveKV2(
        p,
        {
          workouts: [
            ...runsIn(p, addDays(START, -7), asOf).slice(0, -1),
            { date: asOf, km: 0, durationSec: 0, completed: false, pain: 5 }
          ]
        },
        asOf
      )
    );
    const notes = r.weeks.flatMap((w) => w.notes);
    expect(notes.some((n) => n.includes('planirano ≤ cilj obima'))).toBe(true);
    expect(notes.filter((n) => /planirano [\d,.]+ km < cilj/.test(n))).toEqual([]);
  });
  it('M3: „Rasterećenje:" samo u rasteretnoj nedelji (jedan kvalitet doze rasterećenja posle pauze)', () => {
    const p = g();
    const asOf = '2026-11-25';
    const r = adapted(
      adaptFiveKV2(p, { breaks: [{ kind: 'break', from: addDays(asOf, -9), to: asOf }] }, asOf)
    );
    const bad = r.weeks
      .filter((w) => !w.deload)
      .flatMap((w) =>
        w.notes.filter((n) => n.startsWith('Rasterećenje:')).map((n) => `${w.index}: ${n}`)
      );
    expect(bad).toEqual([]);
    expect(r.weeks.some((w) => w.limits?.quality === 'one' && !w.deload)).toBe(true);
  });
});

describe('C1: početnik — rasterećenje nikad u nedeljama 1–2 (pouka 4)', () => {
  it('nalaz b-d3-8w-12km-e420-0: ciljevi 12 → 9,6 R → … postaje rasterećenje u ned 4 (kao 10K/HM „izuzetno 4")', () => {
    const p = planOf({
      startDate: START,
      raceDate: addDays(START, 55),
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 12,
      experience: 'beginner',
      canRun30Min: true,
      typicalEasyPaceSecPerKm: 420,
      goalTimeSec: null
    });
    expect(p.weeks.filter((w) => w.deload).map((w) => w.index)).toEqual([4]);
    expect(p.weeks[1]!.targetKm).toBeGreaterThanOrEqual(p.weeks[0]!.targetKm);
  });
});

describe('C2: zapis umora bez dayId je van plana (lagan)', () => {
  it('nalaz r-d4-6w-20km-v32-1: RPE 8/7 bez dayId na dan kvaliteta → FATIGUE (ranije bez umora)', () => {
    const p = planOf({
      startDate: START,
      raceDate: addDays(START, 41),
      runDays: ['mon', 'wed', 'fri', 'sun'],
      currentWeeklyKm: 20,
      recentResult: result(32, addDays(START, -14)),
      goalTimeSec: null
    });
    const asOf = '2026-11-09';
    // 2026-11-06 je dan kvaliteta plana; zapis bez dayId nije uparen sa njim.
    expect(p.weeks.flatMap((w) => w.days).find((d) => d.date === '2026-11-06')!.workout.kind).toBe(
      'quality'
    );
    const r = adaptFiveKV2(
      p,
      {
        workouts: [
          { date: '2026-11-08', km: 5, durationSec: 1800, completed: true, rpe: 8 },
          { date: '2026-11-06', km: 5, durationSec: 1800, completed: true, rpe: 7 }
        ]
      },
      asOf
    );
    expect(r.ok && r.reasons.some((x) => x.condition === 'FATIGUE' && x.applied)).toBe(true);
  });
});

describe('N1: jedna „poslednja izgradnja" (assess = adaptVolume = validator)', () => {
  it('nalaz r-d3-6w-20km-v45-1: bol 5 (2026-11-15) pa višak (2026-11-22) — „plan se ne povećava" drži osnovu povratka (14), ne +10 % (15,4)', () => {
    const p = planOf({
      startDate: START,
      raceDate: addDays(START, 41),
      runDays: ['mon', 'wed', 'sat'],
      currentWeeklyKm: 20,
      recentResult: result(45, addDays(START, -14)),
      goalTimeSec: null
    });
    const a1 = '2026-11-15';
    const p1 = adapted(
      adaptFiveKV2(
        p,
        { workouts: [{ date: a1, km: 0, durationSec: 0, completed: false, pain: 5 }] },
        a1
      )
    );
    const a2 = '2026-11-22';
    const r = adaptFiveKV2(
      p1,
      {
        workouts: runsIn(p1, addDays(a2, -13), a2, 1.2),
        coverage: { from: addDays(a2, -13), to: a2, complete: true }
      },
      a2
    );
    const p2 = adapted(r);
    const over = r.ok ? r.reasons.find((x) => x.condition === 'OVER_EXECUTION') : undefined;
    expect(over?.applied).toBe(true);
    expect(p2.adaptation!.steps.at(-1)!.startKm).toBe(14);
    expect(p2.weeks[3]!.targetKm).toBe(14);
  });
});

describe('N1 posledica: višak posle bola ne spušta cilj ispod donje granice nedelje', () => {
  it('r-d3-6w-12km-v38-1, bol 5 (2026-11-15) pa višak (2026-11-22): prihvaćeno (ranije VOLUME_RESET), cilj ned 4 = granica 9 km', () => {
    const p = planOf({
      startDate: START,
      raceDate: addDays(START, 41),
      runDays: ['mon', 'wed', 'sat'],
      currentWeeklyKm: 12,
      recentResult: result(38, addDays(START, -14)),
      goalTimeSec: null
    });
    const a1 = '2026-11-15';
    const p1 = adapted(
      adaptFiveKV2(
        p,
        { workouts: [{ date: a1, km: 0, durationSec: 0, completed: false, pain: 5 }] },
        a1
      )
    );
    const a2 = '2026-11-22';
    const r = adaptFiveKV2(
      p1,
      {
        workouts: runsIn(p1, addDays(a2, -13), a2, 1.2),
        coverage: { from: addDays(a2, -13), to: a2, complete: true }
      },
      a2
    );
    const p2 = adapted(r);
    expect(r.ok && r.reasons.some((x) => x.condition === 'OVER_EXECUTION' && x.applied)).toBe(true);
    expect([p2.adaptation!.steps.at(-1)!.startKm, p2.weeks[3]!.targetKm]).toEqual([9, 9]);
  });
});

describe('Z1: mešovita nedelja — upisani višak ≤ 10 % ne skida kvalitet', () => {
  it('nalaz r-d4-7w-15km-v38-1, višak 120 % do 2026-11-10: kvalitet ned 2 ostaje, upozorenje MIXED_OVER_TARGET', () => {
    const p = planOf({
      startDate: START,
      raceDate: addDays(START, 48),
      runDays: ['mon', 'wed', 'fri', 'sun'],
      currentWeeklyKm: 15,
      recentResult: result(38, addDays(START, -14)),
      goalTimeSec: null
    });
    const asOf = '2026-11-10';
    const r = adapted(
      adaptFiveKV2(
        p,
        {
          workouts: runsIn(p, addDays(asOf, -13), asOf, 1.2),
          coverage: { from: addDays(asOf, -13), to: asOf, complete: true }
        },
        asOf
      )
    );
    const q = (w: PlanWeek) =>
      w.days.filter((d) => d.date > asOf && d.workout.kind === 'quality').length;
    expect(q(r.weeks[1]!)).toBe(q(p.weeks[1]!));
    expect(r.warnings.filter((w) => w.rule === 'MIXED_OVER_TARGET').map((w) => w.week)).toEqual([
      2
    ]);
    expect(r.weeks[1]!.plannedKm).toBeLessThanOrEqual(
      P.mixed.keepQualityMaxShare * r.weeks[1]!.targetKm
    );
  });
});

describe('Z2: tekst korisniku (decimalni zarez, km ≤ 1 decimala, oporavak m:ss, bez internih oznaka)', () => {
  it('format: userText je idempotentan', () => {
    expect(kmText(9.64)).toBe('9,6');
    expect(kmText(12)).toBe('12');
    expect(mss(240)).toBe('4:00');
    const s = 'Lagano 9.64 km (oporavak 90 s), VDOT 45.3, 0.8 × vrh';
    expect(userText(s)).toBe('Lagano 9,6 km (oporavak 1:30), VDOT 45,3, 0,8 × vrh');
    expect(userText(userText(s))).toBe(userText(s));
  });

  it('mreža (generator i adaptacija, rezultat/po osećaju/početnik, 3/4/5 dana): nijedna korisnička poruka ne sadrži internu oznaku, decimalnu tačku, km sa 2 decimale, oporavak u sekundama ni „.."', () => {
    const LABEL =
      /\b(?:[ADHMFNKCO]\d+[a-z]?|pouk[aei] \d+|[Ss]egment\w* \d+\w*|Odluk[aei] \d+\w*|\d+\.\d+\.\d+|[A-Z]{3,}_[A-Z_]+)\b/;
    const BAD: [string, RegExp][] = [
      ['oznaka', LABEL],
      ['tačka', /\d\.\d/],
      ['km2', /\d+[.,]\d{2,}\s*km/],
      ['oporavak s', /oporav\w* \d+ s\b/],
      ['..', /\.\./]
    ];
    const bad: string[] = [];
    const scan = (s: unknown, where: string): void => {
      if (typeof s !== 'string') return;
      for (const [k, re] of BAD) if (re.test(s)) bad.push(`${where} [${k}]: ${s}`);
    };
    const scanPlan = (p: FiveKV2Plan): void => {
      p.notes.forEach((n) => scan(n, 'plan'));
      p.warnings.forEach((w) => scan(w.message, w.rule));
      scan(p.goal?.message, 'cilj');
      for (const w of p.weeks) {
        w.notes.forEach((n) => scan(n, `ned ${w.index}`));
        w.days.forEach((d) => scan(d.workout.title, d.date));
      }
    };
    const inputs: Record<string, unknown>[] = [];
    for (const [days, km] of [
      [['tue', 'thu', 'sun'], 12],
      [['tue', 'thu', 'sat', 'sun'], 25],
      [['mon', 'tue', 'thu', 'sat', 'sun'], 40]
    ] as const)
      for (const weeks of [7, 10])
        for (const kind of ['v', 'f', 'b']) {
          if (kind === 'b' && days.length === 5) continue;
          inputs.push({
            startDate: START,
            raceDate: addDays(START, weeks * 7 - 1),
            runDays: days,
            currentWeeklyKm: km,
            goalTimeSec: 1500,
            ...(kind === 'v' ? { recentResult: result(42, addDays(START, -10)) } : {}),
            ...(kind !== 'v' ? { typicalEasyPaceSecPerKm: 400 } : {}),
            ...(kind === 'b' ? { experience: 'beginner', canRun30Min: true } : {})
          });
        }
    for (const input of inputs) {
      const p = planOf(input);
      scanPlan(p);
      for (const k of [2, 4]) {
        const asOf = p.weeks[k - 1]!.endDate;
        for (const facts of [
          { breaks: [{ kind: 'break', from: addDays(asOf, -19), to: asOf }] },
          {
            workouts: [
              ...runsIn(p, addDays(START, -7), asOf).slice(0, -1),
              { date: asOf, km: 0, durationSec: 0, completed: false, pain: 5 }
            ]
          },
          { workouts: runsIn(p, addDays(asOf, -13), asOf, 1.2) },
          { results: [{ distM: 3000, sec: 600, date: asOf, kind: 'test' }] }
        ]) {
          const r = adaptFiveKV2(p, facts, asOf);
          if (r.ok) {
            scanPlan(r.plan);
            r.reasons.forEach((x) => scan(x.message, x.condition));
          } else r.reasons.forEach((x) => scan(x.message, x.code));
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});

describe('Z3: Forma čita odluku jezgra o rezultatu', () => {
  it('rezultat sa VDOT van opsega (test 3 km 7:00) → „ne menja tempo", ne „čeka prilagođavanje"', () => {
    const p = planOf({
      startDate: START,
      raceDate: addDays(START, 7 * 10 - 1),
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 20,
      recentResult: result(45, addDays(START, -10)),
      goalTimeSec: null
    });
    const plan = storedPlan(generatedPlan(p));
    const today = addDays(START, 9) as IsoDate;
    const h = formHistory({
      plan,
      today,
      tests: [{ id: 't', date: addDays(START, 8), sec: 420 }]
    })!;
    const pt = h.points.find((x) => x.kind === 'test')!;
    expect(pt.status).toBe('old');
    expect(pt.label).not.toContain('čeka prilagođavanje');
    expect(pt.label).toContain('VDOT van opsega');
  });
});

describe('owner K: jedan plafon laganog dana trkačke nedelje; peakKm adaptacije', () => {
  it('validator koristi isti plafon kao konstruktor (⌊…⌋ na 0,1 km): lagan iznad njega je greška', () => {
    // 4 dana, 30 km, VDOT 38, 10 ned: plafon 4,5 km, bez zaokruživanja 4,55 — lagan 4,51 je greška samo sa istom
    // funkcijom kao konstruktor.
    const p = planOf({
      startDate: START,
      raceDate: addDays(START, 7 * 10 - 1),
      runDays: ['tue', 'thu', 'sat', 'sun'],
      currentWeeklyKm: 30,
      recentResult: result(38, addDays(START, -10)),
      goalTimeSec: null
    });
    const race = p.weeks.at(-1)!;
    const prevLong = p.weeks.at(-2)!.days.find((d) => d.role === 'long')!.workout.km;
    const cap = raceWeekEasyCap(p.paces, prevLong);
    const raw = Math.max(
      P.easy.taperMinKm,
      Math.min(P.easy.raceWeekMaxSec / p.paces.E.slow, prevLong * P.easy.raceWeekMaxShareOfPrevLong)
    );
    expect([cap, Math.round(raw * 100) / 100]).toEqual([4.5, 4.55]);
    const easy = race.days.find((d) => d.role === 'easy' && d.workout.km < cap)!;
    const q = JSON.parse(JSON.stringify(p)) as FiveKV2Plan;
    const d = q.weeks.at(-1)!.days.find((x) => x.date === easy.date)!;
    d.workout.km = Math.round((cap + 0.01) * 100) / 100;
    expect(
      validatePlan(q)
        .filter((v) => v.rule === 'RACE_WEEK_EASY')
        .map((v) => v.date)
    ).toEqual([easy.date]);
  });

  it('peakKm adaptiranog plana = vrh za taper iz konstrukcije, ne najveći cilj izgradnje (nalaz r-d3-6w-20km-v32-0, pauza 20 d)', () => {
    const p = planOf({
      startDate: START,
      raceDate: addDays(START, 7 * 6 - 1),
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 20,
      recentResult: result(32, addDays(START, -14)),
      goalTimeSec: null
    });
    const asOf = '2026-11-11';
    const r = adapted(
      adaptFiveKV2(p, { breaks: [{ kind: 'break', from: addDays(asOf, -19), to: asOf }] }, asOf)
    );
    const build = r.weeks.filter((w) => w.phase !== 'taper' && w.phase !== 'race');
    expect([r.peakKm, Math.max(...build.map((w) => w.targetKm))]).toEqual([15.4, 20]);
    const taper1 = r.weeks.find((w) => w.phase === 'taper')!;
    expect(taper1.targetKm).toBe(Math.round(r.peakKm * P.volume.taperFactors[0] * 10) / 10);
    // Bez činjenica: isti vrh kao generator.
    expect(adapted(adaptFiveKV2(p, {}, addDays(START, 9))).peakKm).toBe(p.peakKm);
  });
});

describe('plafon trajanja I na novom tempu (POSLE-MERGE c)', () => {
  it('r-d3-6w-25km-v45-0, trka Δ8 VDOT (37) 2026-11-04: I 2 × 1000 m tačno na plafonu 300 s prolazi', () => {
    const p = planOf({
      startDate: START,
      raceDate: addDays(START, 41),
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 25,
      recentResult: result(45, addDays(START, -14)),
      goalTimeSec: null
    });
    const at = '2026-11-04';
    const r = adapted(
      adaptFiveKV2(
        p,
        {
          results: [
            { distM: 5000, sec: Math.round(raceTimeForVdot(37, 5000)), date: at, kind: 'race' }
          ]
        },
        at
      )
    );
    expect(r.vdot).toBe(37);
    const reps = r.weeks[3]!.days.flatMap((d) =>
      d.workout.segments.filter((s) => s.zone === 'I' && s.kind === 'rep')
    );
    expect(reps.map((s) => [s.km, s.sec])).toEqual([
      [1, P.quality.iRepMaxSec],
      [1, P.quality.iRepMaxSec]
    ]);
  });
});
