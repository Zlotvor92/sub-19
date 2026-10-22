import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../../date';
import type { GenPlanState } from '../../../../state';
import * as select from '../../../select';
import { HM_V2_POLICY } from '../../../halfMarathon/v2/policy.ts';
import { factsOf } from '../../../halfMarathon/v2/adaptInputs.ts';
import { feelInputs, grid02Inputs } from '../../../halfMarathon/v2/testInputs.ts';
import {
  contractInput as hmContractInput,
  HM_V2_SOURCE_FORMAT
} from '../../../halfMarathon/v2/app/preparation.ts';
import { FIVE_K_V2_POLICY } from '../policy.ts';
import type { FiveKV2Plan } from '../types.ts';
import { generateFiveKV2 } from '../generate.ts';
import { alignedStart } from './generate.ts';
import { targetInput } from './handoffTarget.ts';
import { PREFIX_KEY, prefixOf } from './plan.ts';
import { FULL } from '../../../../../test/level';

/* FAZA 3, SEGMENT 3d — 5K v2 kao CILJ predaje „kraća distanca" (DESIGN.md § 3 P3/P5, § 8 O3a, O4a, O6b, O8a).
   Obrazac 3f (`halfMarathon/v2/app/handoffTarget.node.test.ts`). Izvor: HM v2 — plan za upis iz generatora HM v2,
   ulaz ugovora iz pravog `contractInput` izvora (3c) i činjenice 4a scenarija; tok kroz pravu odluku izvora
   (`preparationForPlan`) posebno. Cilj se bira kao u aplikaciji: `shorterHandoffForV2Source` sa uključenim 5K v2.
   - Tok: generate (činjenice ulaza, start = granica nedelje posle potvrde) + adapt (sirove činjenice bez dayId).
   - O6(b): prošle nedelje i tekuća nedelja izvora ostaju doslovno. Nedelje cilja imaju broj i id kao nedelja izvora
     istog početka. Nema duplog datuma ni id-a.
   - Uslov 8 / zajedničke provere 4a: budući dani nisu prazni, lagan ≤ dugi.
   - T1/T2: politika izvora (i `startingKm` izvršenja) ne menja cilj; politika cilja ga menja.
   - Odbijanje generatora cilja → opcija nedostupna sa razlogom v2 doslovno, nikad v1. */

const ON: select.GeneratorFlags = { fiveKV2: true };
const DAY = 86_400_000;
const addDays = (d: string, n: number): IsoDate =>
  new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10) as IsoDate;

type HmPlan = Parameters<typeof hmContractInput>[0];
const hmOf = (src: GenPlanState): HmPlan => (src as unknown as { hmV2: HmPlan }).hmV2;
/** Ulaz ugovora pravog izvora HM v2 (3c) za 5K; `easyPace` dodaje lak tempo iz ulaza izvora (3c ga ne šalje). */
function contract(src: GenPlanState, easyPace = false) {
  const v = hmOf(src);
  const ep = (v.input as { easyPaceSecPerKm?: number | null }).easyPaceSecPerKm;
  return {
    ...hmContractInput(v),
    raceDistM: 5000,
    goalSec: null,
    ...(easyPace && ep != null ? { easyPaceSecPerKm: ep } : {})
  };
}
const source = (input: unknown): GenPlanState | null => {
  const r = select.generateHmV2Plan(input as never);
  return r.ok ? r.plan : null;
};
type Out = { result?: GenPlanState; coverage?: string; error?: string };
function handoff(
  src: GenPlanState,
  asOf: IsoDate,
  scenario: Parameters<typeof factsOf>[1],
  execution: unknown = null,
  input: unknown = contract(src)
): Out {
  const h = select.shorterHandoffForV2Source(ON, HM_V2_SOURCE_FORMAT)(5000)!;
  return (h as unknown as (...a: unknown[]) => Out)(
    src,
    input,
    asOf,
    {},
    {
      execution,
      restartFromBase: execution !== null,
      notes: [],
      meta: {},
      raw: factsOf(hmOf(src), scenario, asOf)
    }
  );
}
const datesOf = (p: GenPlanState) =>
  p.weeks.flatMap((w) => w.days.map((d) => [addDays(w.start, d.dow), d] as const));
const weeksLeft = (src: GenPlanState, asOf: string) =>
  Math.floor(
    (Date.parse(hmOf(src).input.raceDate) - Date.parse(addDays(asOf, 1))) / DAY / 7 + 1 / 7
  );

const inputs = grid02Inputs().filter((_, i) => i % (FULL ? 89 : 307) === 41);
const SCEN = ['none', 'under50', 'pause35', 'pain8', 'fatigue'] as const;

describe('3d: HM v2 → 5K v2 cilj (generate + adapt, O6b)', () => {
  it('tok: plan 5K v2 sa prefiksom izvora; bez duplih datuma i id-a; id cilja = id izvora istog datuma; uslov 8', () => {
    let ok = 0;
    const bad: string[] = [];
    for (const c of inputs) {
      const src = source(c.input);
      if (!src) continue;
      const N = src.weeks.length;
      for (const k of [N - 13, Math.floor(N / 2), N - 7]) {
        if (k < 1) continue;
        const asOf = addDays(src.weeks[k - 1]!.start, 3);
        for (const s of SCEN) {
          const r = handoff(src, asOf, s);
          if (!r.result) continue;
          ok++;
          const key = `${c.id} ${asOf} ${s}`;
          expect(r.coverage, key).toBe('full');
          const res = select.stampForStorage(r.result);
          if (!select.isFiveKV2Plan(res)) bad.push(`${key}: nije plan 5K v2`);
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
          // Faza nedelja cilja iz odluke 5K v2 (broj nedelje `offset + index`).
          expect(res.weeks.at(-1)!.phase, key).toBe('TRKA');
          // Uslov 8 na delu cilja (plan v2): budući dani nisu prazni, lagan ≤ dugi.
          const v2 = (res as unknown as { fiveKV2: FiveKV2Plan }).fiveKV2;
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

  it('M3 kroz pravi kod: adaptacija cilja nikad ne odbija; van 6–16 nedelja PLAN_LENGTH_OUT_OF_RANGE doslovno (O8a)', () => {
    const adaptRejected: string[] = [];
    const out: string[] = [];
    for (const c of inputs) {
      const src = source(c.input);
      if (!src) continue;
      const N = src.weeks.length;
      for (const k of [1, 2, Math.floor(N / 2), N - 4])
        for (const s of SCEN) {
          const asOf = addDays(src.weeks[k - 1]!.start, 6);
          const r = handoff(src, asOf, s, null, contract(src, true));
          if (!r.error) continue;
          // Odbijanje ADAPTACIJE: generator cilja prihvata isti ulaz (start = granica posle asOf), a predaja ne uspe.
          const start = alignedStart(hmOf(src).input.raceDate, addDays(asOf, 1));
          const g = start ? generateFiveKV2(targetInput(contract(src, true), start)) : null;
          if (g?.ok) adaptRejected.push(`${c.id} ${asOf} ${s}: ${r.error}`);
          const left = weeksLeft(src, asOf);
          if (left < 6 || left > 16) {
            expect(r.error, `${c.id} ${asOf}`).toContain(
              `Plan mora trajati 6–16 nedelja; sada ${left}.`
            );
            out.push(String(left));
          }
        }
    }
    expect(adaptRejected).toEqual([]);
    // Uzorak sadrži i ranu (> 16) i kasnu (< 6) predaju.
    expect(out.some((x) => Number(x) > 16) && out.some((x) => Number(x) < 6)).toBe(true);
  });

  it('plan v2 po osećaju: bez laganog tempa u ulazu cilja → MISSING_EASY_PACE doslovno; sa njim radi', () => {
    const c = feelInputs().find((x) => {
      const s = source(x.input);
      return s !== null && s.weeks.length >= 12;
    })!;
    const src = source(c.input)!;
    const asOf = addDays(src.weeks[src.weeks.length - 9]!.start, 3);
    const r = handoff(src, asOf, 'none');
    expect(r.result).toBeUndefined();
    expect(r.error).toContain('potreban je uobičajen lagan tempo (typicalEasyPaceSecPerKm)');
    expect(handoff(src, asOf, 'none', null, contract(src, true)).result).toBeDefined();
  });

  it('pravi izvor: odluka HM v2 (5K v2 uključen, 10K v2 NOT_READY) nudi 5K; izbor gradi plan 5K v2 sa prefiksom', () => {
    const base = grid02Inputs().find((x) => x.id === 'd3-10w-35km-v30-A-sat')!.input;
    const g = select.generateHmV2Plan(base as never);
    if (!g.ok) throw new Error('generator');
    const asOf = addDays(g.plan.weeks[3]!.start, 2);
    const a = select.hmV2AdaptPreview(g.plan, asOf, {}, [{ from: addDays(asOf, -20), to: asOf }]);
    if (!a.ok) throw new Error('adaptacija');
    const src = select.stampForStorage(a.result);
    const prep = select.preparationForPlan(src, { fiveKV2: true, tenKV2: true })!;
    const basis = prep.basisFromPlan(src, asOf)!;
    const d = prep.preparationDecision(src, asOf, basis, {}, 'limited', undefined);
    expect(d.unavailable).toEqual([`10K: ${select.V2_TARGET_NOT_READY}`]);
    expect(d.options.map((o) => o.id)).toEqual(['shorter-5000']);
    const ch = prep.buildPreparationChoice(
      src,
      asOf,
      basis,
      { kind: 'shorter', raceDistM: 5000 },
      {}
    );
    if ('error' in ch) throw new Error(ch.error);
    const res = select.stampForStorage(ch.result);
    expect(select.isFiveKV2Plan(res)).toBe(true);
    expect('hmV2' in res).toBe(false);
    expect(prefixOf(res)!.weeks).toEqual(src.weeks.filter((w) => w.start <= asOf));
  });
});

/* T1/T2: budući deo plana cilja (nedelje posle prefiksa i plan v2). Činjenice nezavisne od plana izvora (pauza 20 d =
   samo prijavljena pauza), da promena politike izvora ne bi menjala ni činjenice. */
function targetPart(r: Out): string {
  const res = r.result!;
  const n = prefixOf(res)!.weeks.length;
  return JSON.stringify([res.weeks.slice(n), (res as unknown as { fiveKV2: unknown }).fiveKV2]);
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
describe('3d: T1/T2', () => {
  // Izvor sa ≥ 16 nedelja (4 dana, 40 km): predaja 10 nedelja pre trke (5K v2: 6–16 nedelja).
  const c = grid02Inputs().find((x) => x.id === 'd4-16w-40km-v45-A-sun')!;
  const asOfOf = (src: GenPlanState) => addDays(src.weeks[src.weeks.length - 11]!.start, 3);
  const flow = (execution: unknown = null) => {
    const src = source(c.input)!;
    return { src, r: handoff(src, asOfOf(src), 'pause20', execution) };
  };

  it('T1: politika izvora (HM v2 obim) menja izvor, a ne cilj', () => {
    const base = flow();
    expect(base.r.result, base.r.error).toBeDefined();
    const t1 = mutate(
      HM_V2_POLICY.volume as unknown as Record<string, number>,
      { growth: 0.03, peakAddKm: 10 },
      flow
    );
    expect(JSON.stringify(t1.src.weeks.slice(-8)), 'kontrola: izvor se menja').not.toBe(
      JSON.stringify(base.src.weeks.slice(-8))
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

  it('T2: politika cilja (5K v2 povratak posle pauze) menja cilj', () => {
    const base = flow();
    const t2 = mutate(
      FIVE_K_V2_POLICY.adapt.pause as unknown as Record<string, number>,
      { midShare: 0.4, shortShare: 0.5 },
      flow
    );
    expect(targetPart(t2.r)).not.toBe(targetPart(base.r));
  });
});

describe('3d: format i izbor', () => {
  it('prekidač 5K v2 isključen → v1 cilj (5K v1); uključen → 5K v2 (nije NOT_READY); 10K v2 i dalje NOT_READY', () => {
    const off = select.shorterHandoffForV2Source({ fiveKV2: false }, HM_V2_SOURCE_FORMAT)(5000);
    const on = select.shorterHandoffForV2Source(ON, HM_V2_SOURCE_FORMAT)(5000)!;
    expect(off).not.toBe(on);
    const src = source(inputs[0]!.input)!;
    const r = handoff(src, addDays(src.weeks[src.weeks.length - 9]!.start, 3), 'none');
    expect(r.error ?? '').not.toBe(select.V2_TARGET_NOT_READY);
    const ten = select.shorterHandoffForV2Source(
      { fiveKV2: true, tenKV2: true },
      HM_V2_SOURCE_FORMAT
    )(10000)!;
    expect((ten as unknown as () => unknown)()).toEqual({ error: select.V2_TARGET_NOT_READY });
  });
  it(`plan bez predaje nema ${PREFIX_KEY}; verzija 5k-v2.10.0, KNOWN_VERSIONS ∪ 5k-v2.9.0`, () => {
    const r = select.generateFiveKV2Plan({
      startDate: '2026-11-02',
      raceDate: addDays('2026-11-02', 7 * 10 - 1),
      runDays: ['tue', 'thu', 'sat', 'sun'],
      currentWeeklyKm: 35,
      recentResult: { distanceM: 5000, timeSec: 1350, date: '2026-10-20' },
      goalTimeSec: null
    } as never);
    if (!r.ok) throw new Error('generator');
    expect(PREFIX_KEY in r.plan).toBe(false);
    expect(r.plan.meta?.['policyVersion']).toBe('5k-v2.10.0');
    expect(r.plan.weeks.map((w) => w.days.map((d) => d.id))[0]![0]).toBe('g1d1');
    expect(
      select.FIVE_K_V2_GENERATOR.planPolicy({
        meta: { policyId: '5k-v2', policyVersion: '5k-v2.9.0' }
      } as never).status
    ).toBe('current');
  });
});
