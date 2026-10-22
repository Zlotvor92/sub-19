/* Segment 08k (5k-v2.10.3): tempo-zavisni plafoni ponavljanja na NOVOM tempu i rezultat van opsega VDOT.
   (1) Posle sporijeg rezultata konstruktor je zadržavao prethodnu dozu (workouts.baseWeek `pm`) čije ponavljanje
   na novom tempu traje duže od plafona → R_REP (npr. 0,4 km × 308 s/km = 123 s > 120 s). Ispravka: workouts.repFits —
   ponovljena/zadržana struktura (R, I, RP, T cruise) mora stati u plafon trajanja na tekućem tempu (kao validator).
   (2) Rezultat sa VDOT van 30–60 → RESULT_IGNORED sa vrednošću i opsegom (kao 10K A1); adaptacija se nastavlja.
   Trajna mreža ivica: km max po broju dana (35 / 45 / 65), VDOT 30 i 60, lak 330 i 510 s/km, 6 i 16 nedelja, trka
   subota i nedelja × rezultat (sporiji, brži, test 3 km/5 km, ivica VDOT) i umor → 0 odbijanja. */

import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { raceTimeForVdot } from './paces.ts';
import { earlyFacts, START, type EarlyPlan, type EarlyScenario } from './testInputs.ts';
import type { FiveKV2Plan } from './types.ts';

const S = JSON.stringify;

describe('08k (1) plafon ponavljanja na novom tempu', () => {
  const g = generateFiveKV2({
    startDate: '2027-01-03',
    raceDate: '2027-03-13',
    runDays: ['mon', 'tue', 'thu', 'sat', 'sun'],
    currentWeeklyKm: 65,
    recentResult: { distanceM: 10000, timeSec: 3365, date: '2026-10-18' },
    experience: 'regular',
    goalTimeSec: null
  });
  if (!g.ok) throw new Error('generate');
  const p = g.plan as FiveKV2Plan;
  it.each([1700, 1720, 1750, 1800])(
    'organizatorov primer: 65 km / 5 dana, trka 5 km %i s na dan starta → prihvaćeno, svako R ≤ 120 s',
    (sec) => {
      const r = adaptFiveKV2(
        p,
        { results: [{ distM: 5000, sec, date: '2027-01-03', kind: 'race' }] },
        '2027-01-03'
      );
      if (!r.ok) throw new Error(S(r.violations.filter((v) => v.severity === 'error')));
      for (const w of r.plan.weeks)
        for (const d of w.days)
          for (const x of d.workout.segments)
            if (x.zone === 'R' && x.kind !== 'stride') expect(x.sec).toBeLessThanOrEqual(120);
    }
  );
});

describe('08k (2) rezultat van opsega VDOT', () => {
  it('plan VDOT 30 + sporiji rezultat (VDOT 28) → RESULT_IGNORED sa vrednošću i opsegom, adaptacija prihvaćena', () => {
    const g = generateFiveKV2({
      startDate: START,
      raceDate: addDays(START, 8 * 7 - 1),
      runDays: ['tue', 'thu', 'sat', 'sun'],
      currentWeeklyKm: 25,
      recentResult: {
        distanceM: 5000,
        timeSec: Math.round(raceTimeForVdot(30, 5000)),
        date: addDays(START, -14)
      },
      goalTimeSec: null
    });
    if (!g.ok) throw new Error('generate');
    const p = g.plan as FiveKV2Plan;
    const at = p.weeks[1]!.endDate;
    const r = adaptFiveKV2(p, earlyFacts(p as unknown as EarlyPlan, 'slower', at), at);
    if (!r.ok) throw new Error(S(r.reasons));
    const x = r.reasons.find((y) => y.condition === 'RESULT_IGNORED');
    expect(x?.message).toMatch(/VDOT 28 van 30–60/);
    expect(r.plan.vdot).toBe(30);
  });
});

/** Ivični ulazi trajne mreže (km max po broju dana, osnova, nedelje, dan trke). */
export function edgeInputs(): { id: string; input: Record<string, unknown> }[] {
  const out: { id: string; input: Record<string, unknown> }[] = [];
  const days: Record<3 | 4 | 5, { km: number; runDays: string[] }> = {
    3: { km: 35, runDays: ['tue', 'thu', 'sat'] },
    4: { km: 45, runDays: ['tue', 'thu', 'sat', 'sun'] },
    5: { km: 65, runDays: ['mon', 'tue', 'thu', 'sat', 'sun'] }
  };
  for (const n of [3, 4, 5] as const)
    for (const weeks of [6, 16])
      for (const race of ['sat', 'sun'] as const)
        for (const base of ['v30', 'v60', 'e330', 'e510'] as const) {
          // Trka subotom: plan počinje nedeljom (nedelje plana se završavaju danom trke).
          const startDate = race === 'sat' ? addDays(START, -1) : START;
          const v = base.startsWith('v') ? Number(base.slice(1)) : null;
          out.push({
            id: `edge-d${n}-${weeks}w-${days[n].km}km-${base}-${race}`,
            input: {
              startDate,
              raceDate: addDays(startDate, weeks * 7 - 1),
              runDays: days[n].runDays,
              currentWeeklyKm: days[n].km,
              ...(v !== null
                ? {
                    recentResult: {
                      distanceM: 5000,
                      timeSec: Math.round(raceTimeForVdot(v, 5000)),
                      date: addDays(startDate, -14)
                    }
                  }
                : { typicalEasyPaceSecPerKm: Number(base.slice(1)) }),
              goalTimeSec: null
            }
          });
        }
  return out;
}

const SCEN: readonly EarlyScenario[] = ['slower', 'faster', 'test5k', 'fatigue'];

describe('08k trajna mreža ivica (km max 35/45/65, VDOT 30/60, lak 330/510, trka sub/ned)', () => {
  const all = edgeInputs();
  const bases = FULL ? all : all.filter((_, i) => i % 6 === 0);
  it(`${bases.length} planova × rezultat/umor × asOf start − 1, start, sreda ned 1, kraj ned 2, kraj ⌊N/2⌋ → 0 odbijanja`, () => {
    const bad: string[] = [];
    let flows = 0;
    for (const b of bases) {
      const g = generateFiveKV2(b.input);
      if (!g.ok) {
        bad.push(`${b.id}: generator ${g.reasons.map((x) => x.code).join('+')}`);
        continue;
      }
      const p = g.plan as FiveKV2Plan;
      const N = p.weeks.length;
      const ats = [
        addDays(p.input.startDate, -1),
        p.input.startDate,
        addDays(p.weeks[0]!.startDate, 2),
        p.weeks[1]!.endDate,
        p.weeks[Math.floor(N / 2) - 1]!.endDate
      ];
      for (const at of ats) {
        for (const s of SCEN) {
          const r = adaptFiveKV2(p, earlyFacts(p as unknown as EarlyPlan, s, at), at);
          flows++;
          if (!r.ok)
            bad.push(
              `${b.id}/${s}/${at}: ${r.violations.map((v) => v.rule).join('+') || r.reasons.map((x) => x.code).join('+')}`
            );
        }
        // Ivica VDOT: rezultat tačno na granicama opsega (30, 60) i van njega (29, 61).
        for (const v of [29, 30, 60, 61]) {
          const r = adaptFiveKV2(
            p,
            {
              results: [
                { distM: 5000, sec: Math.round(raceTimeForVdot(v, 5000)), date: at, kind: 'race' }
              ]
            },
            at
          );
          flows++;
          if (!r.ok)
            bad.push(
              `${b.id}/vdot${v}/${at}: ${r.violations.map((x) => x.rule).join('+') || r.reasons.map((x) => x.code).join('+')}`
            );
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(flows).toBeGreaterThan(0);
  }, 300_000);
});
