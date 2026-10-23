import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../date';
import type { GenPlanState } from '../state';
import type { HandoffFacts, HmV2PlanInput, MarathonV2PlanInput } from './contract';
import { sourceViewForV1, V1_TARGET_NEEDS_RESULT, type SourceFormat } from './handoff';
import * as select from './select';
import { handoffFuture as tenKHandoffFuture } from './tenK';
import { FULL } from '../../test/level';

/* FAZA 3, SEGMENT 3b — lepak predaje za IZVOR v2 (DESIGN.md § 3, § 8). Bez trenerskih odluka:
   - v1 cilj nad planom izvora v2 ne nasleđuje format v2: ni objekat plana v2 (`hmV2`/`marathonV2`) ni meta ključeve koje
     piše samo v2 (DESIGN.md M2: pre 3b 100 % predaja) — ponovljeno merenje M2 sa čistačem `sourceViewForV1`;
   - plan v2 po osećaju → v1 cilj nedostupan sa razlogom (O5); cilj v2 (prekidač korisnika) → nedostupan sa razlogom dok
     ne postoji predaja v2 cilju (O4, 3d), nikad tihi prelaz na v1;
   - vraćanje sačuvane verzije DRUGE distance se izričito odbija (P5);
   - `HandoffFacts` ugovora i kopija v1 cilja su strukturno isti tip; `isLimitedLongPreparation(meta, plan)` v1 ne čita
     `plan`. */

const DAY = 86_400_000;
const addDays = (d: string, n: number): IsoDate =>
  new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10) as IsoDate;
const WD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const START = '2026-11-02';

/** Format izvora za čistač — ono što će adapter izvora v2 dati (segment 3c/3e): meta ključevi koje piše samo v2 (ili
 *  koji opisuju cilj izvora); ključeve koje piše i v1 cilj (`trainingVdot`, `racePace` …) cilj ionako prepisuje. */
const HM_FORMAT: SourceFormat = {
  planKey: 'hmV2',
  metaKeys: ['vdot', 'paceBasis', 'predictedHmSec', 'goalVdot', 'goalAssessment']
};
const MAR_FORMAT: SourceFormat = {
  planKey: 'marathonV2',
  metaKeys: ['vdot', 'paceBasis', 'mpVdot', 'predictedMarathonSec', 'goalVdot', 'goalAssessment']
};

type Src = { id: string; input: HmV2PlanInput | MarathonV2PlanInput };
function sources(dist: 'hm' | 'marathon', feel: boolean): Src[] {
  const out: Src[] = [];
  const weeksSet = dist === 'hm' ? [10, 12, 16] : [14, 16, 20];
  const kmSet = dist === 'hm' ? [30, 45] : [45, 60];
  const daysSet: (typeof WD)[number][][] = [
    ['tue', 'thu', 'sat', 'sun'],
    ['mon', 'tue', 'thu', 'fri', 'sun']
  ];
  // Trka u nedelju (nedelje izvora od ponedeljka) i u subotu (od nedelje) — dopuna 3b: pogled za v1 cilj pregrupiše.
  for (const raceDay of ['sun', 'sat'] as const)
    for (const weeks of weeksSet)
      for (const km of kmSet)
        for (const runDays of daysSet)
          for (const t of feel ? [360, 420] : [2400, 2700, 3000])
            out.push({
              id: `${dist}-${weeks}w-${km}km-${runDays.length}d-${t}-${raceDay}`,
              input: {
                startDate: raceDay === 'sun' ? START : addDays(START, -1),
                raceDate: addDays(raceDay === 'sun' ? START : addDays(START, -1), 7 * weeks - 1),
                runDays: [...runDays],
                longRunDay: 'sun',
                currentWeeklyKm: km,
                ...(feel
                  ? { easyPaceSecPerKm: t }
                  : { recentResult: { distanceM: 10000, timeSec: t, date: addDays(START, -14) } }),
                goalTimeSec: null
              }
            });
  // Samo ulazi koje generator izvora prihvata (odbijanje izvora nije predmet ovog testa).
  const ok = out.filter((x) => generated(dist, x.input).ok);
  return FULL ? ok : ok.filter((_, i) => i % 3 === 0);
}

const generated = (dist: 'hm' | 'marathon', input: Src['input']) =>
  dist === 'hm' ? select.generateHmV2Plan(input) : select.generateMarathonV2Plan(input);

function stored(dist: 'hm' | 'marathon', input: Src['input']): GenPlanState {
  const r = dist === 'hm' ? select.generateHmV2Plan(input) : select.generateMarathonV2Plan(input);
  if (!r.ok) throw new Error(`izvor odbijen: ${r.reasons.map((x) => x.code).join(', ')}`);
  return r.plan;
}

/** Ulaz ugovora iz činjenica ulaza v2 (bez izvedenih polja) — kao merenje M2. */
function contractInput(v: Src['input'], dist: number, start?: IsoDate) {
  const runDows = v.runDays.map((d) => WD.indexOf(d) + 1);
  return {
    startDate: start ?? v.startDate,
    raceDate: v.raceDate,
    raceDistM: dist,
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
    runDays: runDows.length,
    runDows,
    lrDow: 7,
    intensity: 'std' as const,
    goalSec: null
  };
}

const NO_FLAGS: select.GeneratorFlags = { fiveKV2: false };
type Handoff = NonNullable<ReturnType<ReturnType<typeof select.shorterHandoffForV2Source>>>;
const call = (
  h: Handoff,
  current: GenPlanState,
  input: unknown,
  at: IsoDate,
  facts: HandoffFacts
) =>
  (h as unknown as (...a: unknown[]) => { result?: GenPlanState; error?: string })(
    current,
    input,
    at,
    {},
    facts
  );

const CASES = [
  { dist: 'hm' as const, format: HM_FORMAT, targets: [10000, 5000] },
  { dist: 'marathon' as const, format: MAR_FORMAT, targets: [21097.5, 10000] }
];

describe('3b: izvor v2 → v1 cilj (ponovljeno M2 sa čistačem)', () => {
  for (const c of CASES)
    it(`${c.dist} v2 (rezultat) → v1: bez objekta v2 i bez meta ključeva v2 u planu cilja`, () => {
      let calls = 0;
      const leaks: string[] = [];
      for (const s of sources(c.dist, false)) {
        const plan = stored(c.dist, s.input);
        const N = plan.weeks.length;
        for (const dist of c.targets)
          for (const at of [
            addDays(START, -1),
            addDays(START, 13),
            addDays(START, 7 * Math.floor(N / 2) - 1)
          ])
            for (const pause of [false, true]) {
              const h = select.shorterHandoffForV2Source(NO_FLAGS, c.format)(dist)!;
              const facts: HandoffFacts = pause
                ? {
                    execution: {
                      date: at,
                      reason: 'confirmed-break',
                      breakDays: 14,
                      reportedBaseKm: Math.round(s.input.currentWeeklyKm * 0.6),
                      startingKm: Math.round(s.input.currentWeeklyKm * 0.6)
                    },
                    restartFromBase: true,
                    notes: [],
                    meta: {}
                  }
                : { execution: null, restartFromBase: false, notes: [], meta: {} };
              const input = contractInput(s.input, dist, pause ? addDays(at, 1) : undefined);
              const r = call(h, plan, input, at, facts);
              calls++;
              expect(r.error, `${s.id} → ${dist} ${at}`).toBeUndefined();
              const res = r.result!;
              const k = `${s.id} → ${dist} ${at}${pause ? ' pauza' : ''}`;
              if (c.format.planKey in res) leaks.push(`${k}: ${c.format.planKey}`);
              // Kontrola: isti cilj nad izvorom bez IKAKVE meta izvora (osim početka plana) — meta plana cilja mora biti
              // ista, tj. meta izvora (v2) ne ostavlja ništa u planu cilja.
              const { [c.format.planKey]: _v2, ...rest } = plan as GenPlanState &
                Record<string, unknown>;
              const bare = {
                ...rest,
                meta: { start: plan.meta?.start }
              } as unknown as GenPlanState;
              const pure = call(h, bare, input, at, facts).result!;
              const a = (res.meta ?? {}) as Record<string, unknown>;
              const b = (pure.meta ?? {}) as Record<string, unknown>;
              for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
                if (JSON.stringify(a[key]) !== JSON.stringify(b[key]))
                  leaks.push(`${k}: meta.${key}`);
              // Dopuna 3b: nijedan dupli datum ni id; prošli dani izvora ostaju (isti id i sadržaj, menja se samo dow),
              // budući su iz cilja (bez strukture v2).
              const dated = res.weeks.flatMap((w) =>
                w.days.map((d) => [addDays(w.start, d.dow), d] as const)
              );
              if (new Set(dated.map(([x]) => x)).size !== dated.length)
                leaks.push(`${k}: dupli datum`);
              if (new Set(dated.map(([, d]) => d.id)).size !== dated.length)
                leaks.push(`${k}: dupli id`);
              const srcByDate = new Map(
                plan.weeks.flatMap((w) => w.days.map((d) => [addDays(w.start, d.dow), d] as const))
              );
              for (const [date, d] of dated) {
                const src = srcByDate.get(date);
                if (
                  date <= at &&
                  src &&
                  JSON.stringify({ ...d, dow: 0 }) !== JSON.stringify({ ...src, dow: 0 })
                )
                  leaks.push(`${k}: prošli dan ${date} nije iz izvora`);
                if (date > at && 'structure' in d) leaks.push(`${k}: budući dan ${date} iz izvora`);
              }
              // Upis: plan cilja bira v1 generator cilja (oznaka politike cilja).
              const g = select.generatorForPlan(select.stampForStorage(res));
              expect(g?.id, k).toBe(dist === 5000 ? '5k' : dist === 10000 ? '10k' : 'hm');
              expect(select.isHmV2Plan(select.stampForStorage(res)), k).toBe(false);
            }
      }
      expect(calls).toBeGreaterThan(0);
      expect(leaks).toEqual([]);
    });

  it('kontrola: bez čistača isti v1 cilj nasleđuje objekat i meta ključeve v2 (kanal je stvaran)', () => {
    const s = sources('hm', false)[0]!;
    const plan = stored('hm', s.input);
    const r = tenKHandoffFuture(
      plan,
      contractInput(s.input, 10000) as never,
      addDays(START, 13),
      {},
      { execution: null, restartFromBase: false, notes: [], meta: {} }
    );
    if ('error' in r) throw new Error(r.error);
    expect('hmV2' in r.result).toBe(true);
    expect(Object.keys(r.result.meta ?? {})).toEqual(
      expect.arrayContaining(['racePace', 'paceBasis'])
    );
    const view = sourceViewForV1(plan, HM_FORMAT);
    expect('hmV2' in view).toBe(false);
    expect(view.weeks).toBe(plan.weeks);
  });

  for (const c of CASES)
    it(`${c.dist} v2 po osećaju → v1 cilj nedostupan sa razlogom (O5)`, () => {
      for (const s of sources(c.dist, true).slice(0, 4)) {
        const plan = stored(c.dist, s.input);
        for (const dist of c.targets) {
          const h = select.shorterHandoffForV2Source(NO_FLAGS, c.format)(dist)!;
          const r = call(h, plan, contractInput(s.input, dist), addDays(START, 13), {
            execution: null,
            restartFromBase: false
          });
          expect(r).toEqual({ error: V1_TARGET_NEEDS_RESULT });
        }
      }
    });
});

describe('3b: izbor cilja po prekidaču korisnika (generatorForNewPlan)', () => {
  const plan = stored('hm', sources('hm', false)[0]!.input);
  const input = contractInput(sources('hm', false)[0]!.input, 10000);
  // 3f (HM v2), 3d (5K v2, 10K v2): svaki cilj v2 ima predaju — NOT_READY se više ne vraća; plan je plan v2 cilja
  // ili odbijanje v2 doslovno, nikad v1 (`<distanca>/v2/app/handoffTarget.node.test.ts`).
  it.each([
    [{ fiveKV2: false, tenKV2: true }, 10000, 'tenKV2'],
    [{ fiveKV2: true }, 5000, 'fiveKV2']
  ] as const)(
    'prekidač cilja uključen %j → %d: cilj v2, ne v1 i ne NOT_READY',
    (flags, dist, key) => {
      const h = select.shorterHandoffForV2Source(flags, HM_FORMAT)(dist)!;
      const r = call(h, plan, { ...input, raceDistM: dist }, addDays(START, 13), {
        execution: null,
        restartFromBase: false
      }) as { result?: Record<string, unknown>; error?: string };
      expect(r.error).not.toBe(select.V2_TARGET_NOT_READY);
      if (r.result) expect(key in r.result).toBe(true);
    }
  );
  it('prekidač isključen → v1 cilj; distanca bez generatora → null', () => {
    const h = select.shorterHandoffForV2Source({ fiveKV2: false, tenKV2: false }, HM_FORMAT);
    expect(h(10000)).not.toBeNull();
    expect(h(15000)).toBeNull();
  });
});

describe('3b: vraćanje verzije druge distance', () => {
  for (const c of CASES)
    it(`verzija ${c.dist} v2 se ne vraća preko plana kraće distance`, () => {
      const s = sources(c.dist, false)[0]!;
      const source = stored(c.dist, s.input);
      const h = select.shorterHandoffForV2Source(NO_FLAGS, c.format)(10000)!;
      const at = addDays(START, 13);
      const r = call(h, source, contractInput(s.input, 10000), at, {
        execution: null,
        restartFromBase: false
      });
      const current = select.stampForStorage(r.result!);
      const generator = select.generatorForPlan(source)!;
      const restored = generator.graftFuturePlan(current, source, at, {});
      expect(restored.weeks).toEqual(current.weeks);
      expect(restored.meta?.['futureChanges']).toEqual({
        changedDays: 0,
        conflicts: [select.RESTORE_OTHER_DISTANCE]
      });
    });
});

describe('3b: ugovor', () => {
  it('HandoffFacts ugovora = kopija v1 cilja (strukturno, oba smera)', () => {
    type V1Facts = Parameters<typeof tenKHandoffFuture>[4];
    const v1: V1Facts = { execution: null, restartFromBase: false };
    const contract: HandoffFacts = v1;
    const back: V1Facts = contract;
    expect(back).toBe(v1);
  });
  it('isLimitedLongPreparation(meta, plan): v1 ne čita plan', () => {
    for (const api of [select.HALF_MARATHON_PREPARATION, select.MARATHON_PREPARATION]) {
      const meta = {
        raceDistM: 21097.5,
        preparation: { endurance: 'limited', peakLongRunKm: 12, peakWeeklyKm: 30 }
      };
      const plan = { weeks: [], pred: [], meta } as unknown as GenPlanState;
      expect(api.isLimitedLongPreparation(meta as never, plan)).toBe(
        api.isLimitedLongPreparation(meta as never)
      );
    }
  });
});

describe('REVIEW-3 #1: lanac maraton v2 → HM v2 (predaja, prefiks) → v1 cilj', () => {
  const RACE = '2026-05-10';
  const TODAY = '2026-01-27' as IsoDate; // utorak 2. nedelje izvora → prefiks 2 nedelje (O6b)
  const input: MarathonV2PlanInput = {
    startDate: select.marathonV2Start(RACE, '2026-01-14')!,
    raceDate: RACE,
    runDays: ['tue', 'thu', 'sat', 'sun'],
    longRunDay: 'sun',
    currentWeeklyKm: 50,
    recentLongRunKm: 24,
    recentResult: { distanceM: 10000, timeSec: 2280, date: '2026-01-10' },
    goalTimeSec: 11400
  };
  function choose(source: GenPlanState, dist: number, flags: select.GeneratorFlags): GenPlanState {
    const prep = select.preparationForPlan(source, flags)!;
    const basis = prep.basisFromPlan(source, TODAY)!;
    const c = prep.buildPreparationChoice(
      source,
      TODAY,
      basis,
      { kind: 'shorter', raceDistM: dist as never },
      {}
    );
    if ('error' in c) throw new Error(c.error);
    return select.stampForStorage(c.result);
  }

  it('v1 cilj iz plana HM v2 sa prefiksom ne nasleđuje ključ prefiksa (ni objekte v2)', () => {
    const g = select.generateMarathonV2Plan(input);
    if (!g.ok) throw new Error(JSON.stringify(g.reasons));
    const hm = choose(select.stampForStorage(g.plan), 21097.5, { fiveKV2: false, hmV2: true });
    expect(select.isHmV2Plan(hm)).toBe(true);
    expect('hmV2Prefix' in hm).toBe(true); // kontrola: izvor zaista nosi prefiks
    for (const dist of [10000, 5000]) {
      const v1 = choose(hm, dist, { fiveKV2: false }) as GenPlanState & Record<string, unknown>;
      expect(select.generatorForPlan(v1)?.id).toBe(dist === 10000 ? '10k' : '5k');
      for (const k of ['hmV2Prefix', 'hmV2', 'marathonV2']) expect(k in v1, k).toBe(false);
    }
  });
});
