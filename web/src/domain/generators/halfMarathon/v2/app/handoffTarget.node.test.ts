import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../../date';
import type { GenPlanState } from '../../../../state';
import * as select from '../../../select';
import { MARATHON_V2_POLICY } from '../../../marathon/v2/policy.ts';
import * as TM from '../../../marathon/v2/testInputs.ts';
import { HM_V2_POLICY } from '../policy.ts';
import type { HmV2Plan } from '../types.ts';
import { generateHmV2 } from '../generate.ts';
import { alignedStart } from './generate.ts';
import { targetInput } from './handoffTarget.ts';
import { PREFIX_KEY, prefixOf } from './plan.ts';
import { FULL } from '../../../../../test/level';
import { handoffFuture as tenKV2HandoffFuture } from '../../../tenK/v2/app/handoffTarget.ts';

/* FAZA 3, SEGMENT 3f — HM v2 kao CILJ predaje „kraća distanca" (DESIGN.md § 3 P3/P5, § 8 O3a, O4a, O6b).
   Izvor: sintetički maraton v2 (plan za upis iz generatora maratona v2 + činjenice 4a scenarija), jer izvor maratona
   dolazi u 3e. Cilj se bira kao u aplikaciji: `shorterHandoffForV2Source` sa uključenim prekidačem HM v2.
   - Tok: generate (činjenice ulaza, start = granica nedelje posle potvrde) + adapt (sirove činjenice bez dayId).
   - O6(b): prošle nedelje i tekuća nedelja izvora ostaju doslovno. Nedelje cilja imaju broj i id kao nedelja izvora
     istog početka. Nema duplog datuma ni id-a.
   - Uslov 8 / zajedničke provere 4a: budući dani nisu prazni, lagan ≤ dugi.
   - T1/T2: politika izvora (i `startingKm` izvršenja) ne menja cilj; politika cilja ga menja.
   - Odbijanje generatora cilja → opcija nedostupna sa razlogom v2 doslovno, nikad v1. */

const ON: select.GeneratorFlags = { fiveKV2: false, hmV2: true };
const MAR_FORMAT = {
  planKey: 'marathonV2',
  metaKeys: ['vdot', 'paceBasis', 'mpVdot', 'predictedMarathonSec', 'goalVdot', 'goalAssessment']
} as const;
const WD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY = 86_400_000;
const addDays = (d: string, n: number): IsoDate =>
  new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10) as IsoDate;

type MarIn = {
  startDate: string;
  raceDate: string;
  runDays: string[];
  longRunDay?: string | null;
  currentWeeklyKm: number;
  recentResult?: { distanceM: number; timeSec: number; date: string } | null;
  easyPaceSecPerKm?: number | null;
  recentLongRunKm?: number | null;
  experience?: string;
};
/** Ulaz ugovora iz ulaza maratona v2 — samo činjenice čarobnjaka (kao HM v2 izvor, `preparation.ts`). */
function contractInput(v: MarIn) {
  const runDows = v.runDays.map((d) => WD.indexOf(d) + 1);
  return {
    startDate: v.startDate,
    raceDate: v.raceDate,
    raceDistM: 21097.5,
    ...(v.recentResult
      ? {
          pb: {
            distM: v.recentResult.distanceM,
            sec: v.recentResult.timeSec,
            date: v.recentResult.date
          }
        }
      : {}),
    weeklyKm: v.currentWeeklyKm,
    ...(v.recentLongRunKm != null ? { recentLongRunKm: v.recentLongRunKm } : {}),
    ...(v.easyPaceSecPerKm != null ? { easyPaceSecPerKm: v.easyPaceSecPerKm } : {}),
    runDays: runDows.length,
    runDows,
    ...(v.longRunDay ? { lrDow: WD.indexOf(v.longRunDay) + 1 } : {}),
    intensity: 'std' as const,
    goalSec: null,
    trainedRecently: v.experience !== 'beginner'
  };
}
const source = (input: unknown): GenPlanState | null => {
  const r = select.generateMarathonV2Plan(input as never);
  return r.ok ? r.plan : null;
};
type Out = { result?: GenPlanState; coverage?: string; error?: string };
function handoff(
  src: GenPlanState,
  input: MarIn,
  asOf: IsoDate,
  scenario: Parameters<typeof TM.factsOf>[1],
  execution: unknown = null
): Out {
  const h = select.shorterHandoffForV2Source(ON, MAR_FORMAT)(21097.5)!;
  const raw = TM.factsOf((src as unknown as { marathonV2: never }).marathonV2, scenario, asOf);
  return (h as unknown as (...a: unknown[]) => Out)(
    src,
    contractInput(input),
    asOf,
    {},
    {
      execution,
      restartFromBase: execution !== null,
      notes: [],
      meta: {},
      raw
    }
  );
}
const datesOf = (p: GenPlanState) =>
  p.weeks.flatMap((w) => w.days.map((d) => [addDays(w.start, d.dow), d] as const));

const inputs = TM.gridInputs().filter((_, i) => i % (FULL ? 97 : 389) === 48);
const SCEN = ['none', 'under50', 'pause35', 'pain8', 'fatigue'] as const;

describe('3f: maraton v2 → HM v2 cilj (generate + adapt, O6b)', () => {
  it('tok: plan HM v2 sa prefiksom izvora; bez duplih datuma i id-a; id cilja = id izvora istog datuma; uslov 8', () => {
    let ok = 0;
    const bad: string[] = [];
    for (const c of inputs) {
      const src = source(c.input);
      if (!src) continue;
      const v = c.input as MarIn;
      const N = src.weeks.length;
      for (const k of [Math.floor(N / 2), N - 11]) {
        if (k < 1) continue;
        const asOf = addDays(src.weeks[k - 1]!.start, 3);
        for (const s of SCEN) {
          const r = handoff(src, v, asOf, s);
          if (!r.result) continue;
          ok++;
          const key = `${c.id} ${asOf} ${s}`;
          const res = select.stampForStorage(r.result);
          if (!select.isHmV2Plan(res)) bad.push(`${key}: nije plan HM v2`);
          const dated = datesOf(res);
          if (new Set(dated.map(([d]) => d)).size !== dated.length) bad.push(`${key}: dupli datum`);
          if (new Set(dated.map(([, d]) => d.id)).size !== dated.length)
            bad.push(`${key}: dupli id`);
          const srcByDate = new Map(datesOf(src));
          for (const [date, d] of dated)
            if (srcByDate.get(date)?.id !== d.id) bad.push(`${key}: id ${date}`);
          // O6(b): nedelje izvora pre starta cilja doslovno (tekuća nedelja izvora uključena).
          const prefix = prefixOf(res)!;
          const start = res.weeks[prefix.weeks.length]!.start;
          expect(start > asOf, key).toBe(true);
          expect(prefix.weeks).toEqual(src.weeks.filter((w) => w.start < start));
          expect(res.weeks.slice(0, prefix.weeks.length).map((w) => w.days)).toEqual(
            prefix.weeks.map((w) => w.days)
          );
          // Uslov 8 na delu cilja (plan v2): budući dani nisu prazni, lagan ≤ dugi.
          const v2 = (res as unknown as { hmV2: HmV2Plan }).hmV2;
          for (const w of v2.weeks) {
            const fut = w.days.filter((d) => d.date > asOf);
            for (const d of fut)
              if (d.role !== 'race' && !(d.workout.km > 0 && d.workout.sec > 0))
                bad.push(`${key}: prazan ${d.date}`);
            const long = fut.find((d) => d.role === 'long');
            if (long && fut.some((d) => d.role === 'easy' && d.workout.km > long.workout.km + 1e-6))
              bad.push(`${key}: dugi < lagan ned ${w.index}`);
          }
        }
      }
    }
    expect(ok).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  it('M3 kroz pravi kod: adaptacija cilja nikad ne odbija; odbijanja su samo ulazna, sa razlogom v2 doslovno', () => {
    const adaptRejected: string[] = [];
    const reasons = new Set<string>();
    for (const c of inputs) {
      const src = source(c.input);
      if (!src) continue;
      for (const k of [2, Math.floor(src.weeks.length / 2), src.weeks.length - 4])
        for (const s of SCEN) {
          const asOf = addDays(src.weeks[k - 1]!.start, 6);
          const r = handoff(src, c.input as MarIn, asOf, s);
          if (r.error) {
            // Odbijanje ADAPTACIJE: generator cilja prihvata isti ulaz (start = granica posle asOf), a predaja ne uspe.
            const start = alignedStart((c.input as MarIn).raceDate, addDays(asOf, 1));
            const g = start
              ? generateHmV2(targetInput(contractInput(c.input as MarIn), start))
              : null;
            if (g?.ok) adaptRejected.push(`${c.id} ${asOf} ${s}: ${r.error}`);
            reasons.add(r.error.replace(/[0-9]+([.,][0-9]+)?/g, '#').slice(0, 60));
          }
        }
    }
    expect(adaptRejected).toEqual([]);
    // Kasna predaja: < 10 nedelja do trke → odbijanje generatora HM v2 doslovno (PLAN_TOO_SHORT, preporuka 10K).
    expect([...reasons].some((r) => r.startsWith('Plan od # nedelja je prekratak'))).toBe(true);
  });

  it('plan v2 po osećaju bez laganog tempa u ulazu cilja → EASY_PACE_REQUIRED doslovno; sa njim radi', () => {
    const c = TM.feelInputs().find((x) => source(x.input) !== null)!;
    const src = source(c.input)!;
    const v = c.input as MarIn;
    const asOf = addDays(src.weeks[1]!.start, 3);
    const r = handoff(src, { ...v, easyPaceSecPerKm: null }, asOf, 'none');
    expect(r.result).toBeUndefined();
    expect(r.error).toMatch(/lagan tempo|lak tempo|easyPace/i);
    expect(handoff(src, v, asOf, 'none').result).toBeDefined();
  });
});

/* T1/T2: budući deo plana cilja (nedelje posle prefiksa i plan v2). Činjenice nezavisne od plana izvora (pauza 20 d =
   samo prijavljena pauza), da promena politike izvora ne bi menjala ni činjenice. */
function targetPart(r: Out): string {
  const res = r.result!;
  const n = prefixOf(res)!.weeks.length;
  return JSON.stringify([res.weeks.slice(n), (res as unknown as { hmV2: unknown }).hmV2]);
}
function mutate<T>(obj: Record<string, number>, patch: Record<string, number>, run: () => T): T {
  const saved = { ...obj };
  try {
    Object.assign(obj, patch);
    return run();
  } finally {
    Object.assign(obj, saved);
  }
}
describe('3f: T1/T2', () => {
  // Izvor sa ≥ 16 nedelja: predaja 12 nedelja pre trke (HM v2 traži ≥ 10 nedelja).
  const c = inputs.find((x) => (source(x.input)?.weeks.length ?? 0) >= 16)!;
  const v = c.input as MarIn;
  const asOfOf = (src: GenPlanState) => addDays(src.weeks[src.weeks.length - 13]!.start, 3);
  const flow = (execution: unknown = null) => {
    const src = source(c.input)!;
    const asOf = asOfOf(src);
    return { src, r: handoff(src, v, asOf, 'pause20', execution) };
  };

  it('T1: politika izvora (maraton v2 obim) menja izvor, a ne cilj', () => {
    const base = flow();
    const t1 = mutate(
      MARATHON_V2_POLICY.volume as unknown as Record<string, number>,
      { growth: 0.03, peakAddKm: 15 },
      flow
    );
    expect(JSON.stringify(t1.src.weeks.slice(-6)), 'kontrola: izvor se menja').not.toBe(
      JSON.stringify(base.src.weeks.slice(-6))
    );
    expect(targetPart(t1.r)).toBe(targetPart(base.r));
  });

  it('T1: `startingKm` izvršenja (odluka izvora) ne menja cilj; potvrđena pauza (činjenica) ga menja', () => {
    const asOf = asOfOf(flow().src);
    const ex = (startingKm: number, breakDays = 21) => ({
      date: asOf,
      reason: 'confirmed-break',
      breakDays,
      reportedBaseKm: 30,
      startingKm
    });
    const a = flow(ex(10));
    const b = flow(ex(30));
    expect(targetPart(b.r)).toBe(targetPart(a.r));
    expect(targetPart(flow(ex(10, 35)).r)).not.toBe(targetPart(flow().r));
  });

  it('T2: politika cilja (HM v2 povratak posle pauze) menja cilj', () => {
    const base = flow();
    const t2 = mutate(
      HM_V2_POLICY.adapt.pause as unknown as Record<string, number>,
      { midShare: 0.4, shortShare: 0.5 },
      flow
    );
    expect(targetPart(t2.r)).not.toBe(targetPart(base.r));
  });
});

describe('HM-09 Z5b: početnik izvora iznad opsega početnika cilja', () => {
  // A1 (audit/app): maraton v2 početnik 4 d, 45 km (MAR 25–45) → HM početnik 4 d 20–40 → WEEKLY_KM_TOO_HIGH; cilj
  // sam određuje politiku (uslov 5) i gradi plan bez oznake početnika.
  const mar: MarIn = {
    startDate: '2026-01-12',
    raceDate: '2026-05-10',
    runDays: ['tue', 'thu', 'sat', 'sun'],
    longRunDay: 'sun',
    currentWeeklyKm: 45,
    recentResult: { distanceM: 10000, timeSec: 46 * 60, date: '2026-01-10' },
    recentLongRunKm: 18,
    experience: 'beginner'
  };
  it('MAR v2 početnik 45 km → ponuda HM v2 postoji (plan bez oznake početnika)', () => {
    const src = source(mar)!;
    expect(src, 'izvor maraton v2').not.toBeNull();
    const asOf = '2026-01-27' as IsoDate;
    const start = alignedStart(mar.raceDate, addDays(asOf, 1))!;
    const g = generateHmV2(targetInput(contractInput(mar), start));
    expect(!g.ok && g.reasons.map((r) => r.code)).toEqual(['WEEKLY_KM_TOO_HIGH']);
    const r = handoff(src, mar, asOf, 'none');
    expect(r.error).toBeUndefined();
    const v2 = (select.stampForStorage(r.result!) as unknown as { hmV2: HmV2Plan }).hmV2;
    expect(v2.input.experience ?? 'regular').toBe('regular');
  });
});

describe('3f: format i izbor', () => {
  it('prekidač HM v2 isključen → v1 cilj (HM v1); uključen → HM v2; 10K v2 → cilj 10K v2 (3d-10K)', () => {
    expect(select.shorterHandoffForV2Source({ fiveKV2: false }, MAR_FORMAT)(21097.5)).not.toBe(
      select.shorterHandoffForV2Source(ON, MAR_FORMAT)(21097.5)
    );
    const ten = select.shorterHandoffForV2Source(
      { fiveKV2: false, tenKV2: true },
      MAR_FORMAT
    )(10000)!;
    expect(ten).toBe(tenKV2HandoffFuture);
  });
  it(`plan bez predaje nema ${PREFIX_KEY}; verzija hm-v2.7.1, KNOWN_VERSIONS ∪ hm-v2.4.1`, () => {
    const r = select.generateHmV2Plan({
      startDate: '2026-11-02',
      raceDate: addDays('2026-11-02', 7 * 12 - 1),
      runDays: ['tue', 'thu', 'sat', 'sun'],
      longRunDay: 'sun',
      currentWeeklyKm: 40,
      recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-10-20' },
      goalTimeSec: null
    });
    if (!r.ok) throw new Error('generator');
    expect(PREFIX_KEY in r.plan).toBe(false);
    expect(r.plan.meta?.['policyVersion']).toBe('hm-v2.7.1');
    expect(
      select.HALF_MARATHON_V2_GENERATOR.planPolicy({
        meta: { policyId: 'hm-v2', policyVersion: 'hm-v2.4.1' }
      } as never).status
    ).toBe('current');
    expect(
      select.HALF_MARATHON_V2_GENERATOR.planPolicy({
        meta: { policyId: 'hm-v2', policyVersion: 'hm-v2.5.0' }
      } as never).status
    ).toBe('current');
  });
});
