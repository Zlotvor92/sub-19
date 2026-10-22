import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../../date';
import type { GenPlanState } from '../../../../state';
import * as select from '../../../select';
import { HM_V2_POLICY } from '../../../halfMarathon/v2/policy.ts';
import { factsOf as hmFactsOf } from '../../../halfMarathon/v2/adaptInputs.ts';
import * as TH from '../../../halfMarathon/v2/testInputs.ts';
import {
  contractInput as hmContractInput,
  HM_V2_SOURCE_FORMAT
} from '../../../halfMarathon/v2/app/preparation.ts';
import { MARATHON_V2_POLICY } from '../../../marathon/v2/policy.ts';
import * as TM from '../../../marathon/v2/testInputs.ts';
import {
  contractInput as marContractInput,
  MARATHON_V2_SOURCE_FORMAT
} from '../../../marathon/v2/app/preparation.ts';
import { TEN_K_V2_POLICY } from '../policy.ts';
import type { TenKV2Plan } from '../types.ts';
import { generateTenKV2 } from '../generate.ts';
import { alignedStart } from './generate.ts';
import { targetInput } from './handoffTarget.ts';
import { PREFIX_KEY, prefixOf } from './plan.ts';
import { FULL } from '../../../../../test/level';

/* FAZA 3, SEGMENT 3d-10K — 10K v2 kao CILJ predaje „kraća distanca" (DESIGN.md § 3 P3/P5, § 8 O3a, O4a, O6b, O8a).
   Obrazac 3f (`halfMarathon/v2/app/handoffTarget.node.test.ts`) i 3d-5K. Izvori: HM v2 (3c) i maraton v2 (3e) — plan
   za upis iz generatora izvora, ulaz ugovora iz PRAVOG `contractInput` izvora, činjenice 4a scenarija; tok kroz pravu
   odluku izvora (`preparationForPlan`) posebno. Cilj se bira kao u aplikaciji: `shorterHandoffForV2Source` sa
   uključenim 10K v2.
   - Tok: generate (činjenice ulaza, start = granica nedelje posle potvrde) + adapt (sirove činjenice bez dayId).
   - O6(b): prošle nedelje i tekuća nedelja izvora ostaju doslovno; nedelje cilja imaju broj i id kao nedelja izvora
     istog početka; nema duplog datuma ni id-a.
   - Uslov 8 / zajedničke provere 4a: budući dani nisu prazni, lagan ≤ dugi.
   - T1/T2: politika izvora (i `startingKm` izvršenja) ne menja cilj; politika cilja ga menja.
   - Odbijanje generatora cilja → opcija nedostupna sa razlogom v2 doslovno, nikad v1. */

const ON: select.GeneratorFlags = { fiveKV2: false, tenKV2: true };
const DAY = 86_400_000;
const addDays = (d: string, n: number): IsoDate =>
  new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10) as IsoDate;

type V2 = { input: { raceDate: string; startDate: string } };
interface Source {
  name: 'HM' | 'MAR';
  key: 'hmV2' | 'marathonV2';
  format: { planKey: string; metaKeys: readonly string[] };
  generate: (input: unknown) => GenPlanState | null;
  contract: (v2: never) => Record<string, unknown>;
  facts: (v2: never, s: string, asOf: string) => Record<string, unknown>;
  inputs: () => { id: string; input: unknown }[];
}
const SOURCES: readonly Source[] = [
  {
    name: 'HM',
    key: 'hmV2',
    format: HM_V2_SOURCE_FORMAT,
    generate: (input) => {
      const r = select.generateHmV2Plan(input as never);
      return r.ok ? r.plan : null;
    },
    contract: (v2) => ({ ...hmContractInput(v2) }),
    facts: (v2, s, asOf) => hmFactsOf(v2, s as never, asOf),
    inputs: () => TH.grid02Inputs().filter((_, i) => i % (FULL ? 89 : 307) === 41)
  },
  {
    name: 'MAR',
    key: 'marathonV2',
    format: MARATHON_V2_SOURCE_FORMAT,
    generate: (input) => {
      const r = select.generateMarathonV2Plan(input as never);
      return r.ok ? r.plan : null;
    },
    contract: (v2) => ({ ...marContractInput(v2) }),
    facts: (v2, s, asOf) => TM.factsOf(v2, s as never, asOf),
    inputs: () => TM.gridInputs().filter((_, i) => i % (FULL ? 97 : 389) === 48)
  }
];
const v2Of = (s: Source, src: GenPlanState): V2 => (src as unknown as Record<string, V2>)[s.key]!;
const contract = (s: Source, src: GenPlanState) => ({
  ...s.contract(v2Of(s, src) as never),
  raceDistM: 10000,
  goalSec: null
});
type Out = { result?: GenPlanState; coverage?: string; error?: string };
function handoff(
  s: Source,
  src: GenPlanState,
  asOf: IsoDate,
  scenario: string,
  execution: unknown = null,
  input: unknown = contract(s, src)
): Out {
  const h = select.shorterHandoffForV2Source(ON, s.format)(10000)!;
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
      raw: s.facts(v2Of(s, src) as never, scenario, asOf)
    }
  );
}
const datesOf = (p: GenPlanState) =>
  p.weeks.flatMap((w) => w.days.map((d) => [addDays(w.start, d.dow), d] as const));
const weeksLeft = (raceDate: string, asOf: string) =>
  Math.floor((Date.parse(raceDate) - Date.parse(addDays(asOf, 1))) / DAY / 7 + 1 / 7);
const SCEN = ['none', 'under50', 'pause35', 'pain8', 'fatigue'] as const;

describe.each(SOURCES)('3d-10K: $name v2 → 10K v2 cilj (generate + adapt, O6b)', (s) => {
  const inputs = s.inputs();

  it('tok: plan 10K v2 sa prefiksom izvora; bez duplih datuma i id-a; id cilja = id izvora istog datuma; uslov 8', () => {
    let ok = 0;
    const bad: string[] = [];
    for (const c of inputs) {
      const src = s.generate(c.input);
      if (!src) continue;
      const N = src.weeks.length;
      for (const k of [N - 15, Math.floor(N / 2), N - 9]) {
        if (k < 1) continue;
        const asOf = addDays(src.weeks[k - 1]!.start, 3);
        for (const sc of SCEN) {
          const r = handoff(s, src, asOf, sc);
          if (!r.result) continue;
          ok++;
          const key = `${c.id} ${asOf} ${sc}`;
          expect(r.coverage, key).toBe('full');
          const res = select.stampForStorage(r.result);
          if (!select.isTenKV2Plan(res)) bad.push(`${key}: nije plan 10K v2`);
          if (s.key in res) bad.push(`${key}: objekat izvora u planu cilja`);
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
          const v2 = (res as unknown as { tenKV2: TenKV2Plan }).tenKV2;
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

  it('M3 kroz pravi kod: adaptacija cilja nikad ne odbija; kasna predaja → PLAN_TOO_SHORT doslovno (O8a)', () => {
    const adaptRejected: string[] = [];
    let short = 0;
    for (const c of inputs) {
      const src = s.generate(c.input);
      if (!src) continue;
      const v2 = v2Of(s, src);
      const N = src.weeks.length;
      for (const k of [1, 2, Math.floor(N / 2), N - 4])
        for (const sc of SCEN) {
          const asOf = addDays(src.weeks[k - 1]!.start, 6);
          const r = handoff(s, src, asOf, sc);
          if (!r.error) continue;
          // Odbijanje ADAPTACIJE: generator cilja prihvata isti ulaz (start = granica posle asOf), a predaja ne uspe.
          const start = alignedStart(v2.input.raceDate, addDays(asOf, 1));
          const g = start ? generateTenKV2(targetInput(contract(s, src) as never, start)) : null;
          if (g?.ok) adaptRejected.push(`${c.id} ${asOf} ${sc}: ${r.error}`);
          const left = weeksLeft(v2.input.raceDate, asOf);
          if (left < 8) {
            expect(r.error, `${c.id} ${asOf}`).toContain(
              `Plan od ${left} nedelja je prekratak: 10K plan traži najmanje 8 nedelja.`
            );
            short++;
          }
        }
    }
    expect(adaptRejected).toEqual([]);
    expect(short).toBeGreaterThan(0);
  });
});

describe('3d-10K: po osećaju, pravi izvor, nedostupno', () => {
  const HM = SOURCES[0]!;
  const MAR = SOURCES[1]!;

  it('HM v2 po osećaju: izvor šalje lak tempo (3d-dopuna) → plan; bez njega EASY_PACE_REQUIRED doslovno', () => {
    const c = TH.feelInputs().find((x) => (HM.generate(x.input)?.weeks.length ?? 0) >= 14)!;
    const src = HM.generate(c.input)!;
    const asOf = addDays(src.weeks[src.weeks.length - 11]!.start, 3);
    const { easyPaceSecPerKm: ep, ...bare } = contract(HM, src) as Record<string, unknown>;
    expect(ep).toBeGreaterThan(0);
    expect(handoff(HM, src, asOf, 'none').result).toBeDefined();
    const r = handoff(HM, src, asOf, 'none', null, bare);
    expect(r.result).toBeUndefined();
    expect(r.error).toMatch(/^Nema pouzdanog rezultata .*za plan po osećaju unesi lagan tempo/);
  });

  it('pravi izvor maraton v2: odluka (HM v2 isključen, 10K v2 uključen) nudi HM v1 ili 10K v2; izbor 10K → plan 10K v2 sa prefiksom', () => {
    const base = TM.gridInputs().find((x) => (MAR.generate(x.input)?.weeks.length ?? 0) >= 16)!;
    const g = select.generateMarathonV2Plan(base.input as never);
    if (!g.ok) throw new Error('generator');
    const asOf = addDays(g.plan.weeks[g.plan.weeks.length - 11]!.start, 2);
    const a = select.marathonV2AdaptPreview(g.plan, asOf, {}, [
      { from: addDays(asOf, -20), to: asOf }
    ]);
    if (!a.ok) throw new Error('adaptacija');
    const src = select.stampForStorage(a.result);
    const prep = select.preparationForPlan(src, ON)!;
    const basis = prep.basisFromPlan(src, asOf)!;
    const d = prep.preparationDecision(src, asOf, basis, {}, 'limited', undefined);
    expect(d.unavailable.join(' ')).not.toContain(select.V2_TARGET_NOT_READY);
    const ch = prep.buildPreparationChoice(
      src,
      asOf,
      basis,
      { kind: 'shorter', raceDistM: 10000 },
      {}
    );
    if ('error' in ch) throw new Error(ch.error);
    const res = select.stampForStorage(ch.result);
    expect(select.isTenKV2Plan(res)).toBe(true);
    expect('marathonV2' in res).toBe(false);
    expect(prefixOf(res)!.weeks).toEqual(src.weeks.filter((w) => w.start <= asOf));
  });
});

/* T1/T2: budući deo plana cilja (nedelje posle prefiksa i plan v2). Činjenice nezavisne od plana izvora (pauza 20 d =
   samo prijavljena pauza), da promena politike izvora ne bi menjala ni činjenice. */
function targetPart(r: Out): string {
  const res = r.result!;
  const n = prefixOf(res)!.weeks.length;
  return JSON.stringify([res.weeks.slice(n), (res as unknown as { tenKV2: unknown }).tenKV2]);
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
describe.each([
  ['HM', SOURCES[0]!, HM_V2_POLICY.volume, 'd4-16w-40km-v45-A-sun'],
  ['MAR', SOURCES[1]!, MARATHON_V2_POLICY.volume, null]
] as const)('3d-10K: T1/T2 (%s v2)', (_name, s, volume, id) => {
  const c = id
    ? TH.grid02Inputs().find((x) => x.id === id)!
    : TM.gridInputs().find((x) => (s.generate(x.input)?.weeks.length ?? 0) >= 16)!;
  const asOfOf = (src: GenPlanState) => addDays(src.weeks[src.weeks.length - 11]!.start, 3);
  const flow = (execution: unknown = null) => {
    const src = s.generate(c.input)!;
    return { src, r: handoff(s, src, asOfOf(src), 'pause20', execution) };
  };

  it('T1: politika izvora (obim) menja izvor, a ne cilj', () => {
    const base = flow();
    expect(base.r.result, base.r.error).toBeDefined();
    const t1 = mutate(
      volume as unknown as Record<string, number>,
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
    expect(targetPart(flow(ex(30)).r)).toBe(targetPart(flow(ex(10)).r));
    expect(targetPart(flow(ex(10, 35)).r)).not.toBe(targetPart(flow().r));
  });

  it('T2: politika cilja (10K v2 povratak posle pauze) menja cilj', () => {
    const base = flow();
    const t2 = mutate(
      TEN_K_V2_POLICY.adapt.pause as unknown as Record<string, number>,
      { midShare: 0.4, shortShare: 0.5 },
      flow
    );
    expect(targetPart(t2.r)).not.toBe(targetPart(base.r));
  });
});

describe('3d-10K: format i izbor', () => {
  it('prekidač 10K v2 isključen → v1 cilj (10K v1); uključen → 10K v2 (nije NOT_READY)', () => {
    for (const s of SOURCES) {
      const off = select.shorterHandoffForV2Source({ fiveKV2: false }, s.format)(10000);
      const on = select.shorterHandoffForV2Source(ON, s.format)(10000);
      expect(off, s.name).not.toBe(on);
      const src = s.generate(s.inputs()[0]!.input)!;
      const r = handoff(s, src, addDays(src.weeks[src.weeks.length - 10]!.start, 3), 'none');
      expect(r.error ?? '', s.name).not.toBe(select.V2_TARGET_NOT_READY);
    }
  });
  it(`plan bez predaje nema ${PREFIX_KEY}; verzija 10k-v2.7.0, KNOWN_VERSIONS ∪ 10k-v2.6.2`, () => {
    const r = select.generateTenKV2Plan({
      startDate: '2026-11-02',
      raceDate: addDays('2026-11-02', 7 * 10 - 1),
      runDays: ['tue', 'thu', 'sat', 'sun'],
      longRunDay: 'sun',
      currentWeeklyKm: 35,
      recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-10-20' },
      goalTimeSec: null
    } as never);
    if (!r.ok) throw new Error('generator');
    expect(PREFIX_KEY in r.plan).toBe(false);
    expect(r.plan.meta?.['policyVersion']).toBe('10k-v2.7.0');
    expect(r.plan.weeks[0]!.days[0]!.id).toBe('g1d1');
    expect(
      select.TEN_K_V2_GENERATOR.planPolicy({
        meta: { policyId: '10k-v2', policyVersion: '10k-v2.6.2' }
      } as never).status
    ).toBe('current');
  });
});
