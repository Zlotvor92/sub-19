import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../../date';
import {
  durationText,
  sessionBreakdown,
  sessionCore,
  structureRows,
  weekPlanKm,
  weekRace
} from '../../../../day';
import { initialWizard, toGenerationInput } from '../../../../onboarding';
import { personalPlan } from '../../../../personal';
import { resolvePlan, type ResolvedDay } from '../../../../plan';
import { getPlanRevisions, recordPlanRevision } from '../../../../plan/versions';
import {
  buildBackup,
  importBackup,
  isValidGenPlan,
  migrateState,
  seedState,
  type GenPlanState,
  type PersistedState
} from '../../../../state';
import type { MarathonV2PlanInput } from '../../../contract';
import { generatorFlags, marathonV2Enabled, marathonV2ToggleVisible } from '../../../flags';
import { regeneratorForDistance } from '../../../handoff';
import {
  FIVE_K_GENERATOR,
  HALF_MARATHON_GENERATOR,
  HALF_MARATHON_V2_GENERATOR,
  MARATHON_GENERATOR,
  MARATHON_V2_GENERATOR,
  TEN_K_GENERATOR,
  TEN_K_V2_GENERATOR,
  UNKNOWN_POLICY,
  generateMarathonV2Plan,
  generatorForNewPlan,
  generatorForPlan,
  isHmV2Plan,
  isMarathonV2Plan,
  isTenKV2Plan,
  marathonV2Start,
  phaseReaderFor,
  preparationForPlan,
  stampForStorage,
  tracksOffPlanRuns,
  unsupportedPlanReason,
  type PlanGenerator
} from '../../../select';
import * as hm from '../../../halfMarathon/index';
import * as tenK from '../../../tenK/index';
import * as mar from '../../index';
import { midEasy, pacesFromVdot } from '../paces.ts';
import { MARATHON_V2_POLICY } from '../policy.ts';
import type { MarathonV2Plan } from '../types.ts';
import { qualityWorkout, warmupCooldown } from '../workouts.ts';
import {
  ADAPTATION_V2,
  MEMBERS,
  NO_PREPARATION_DECISION,
  NO_RUN_WALK,
  RECALIBRATION_NOT_USED,
  T3K_NOT_USED
} from './members.ts';
import { workoutStructure } from './structure.ts';
import { SKIP_FEEL, SKIP_NO_STRUCTURE } from './watch.ts';

/* SEGMENT MAR-05 — maraton v2 u aplikaciji: prekidač, rutiranje po oznaci politike, generisanje kroz adapter (nedelja
   7 dana, struktura na svakom treningu, faza iz v2, taper 2 nedelje, trka 42,2 km van obima, odbijanje sa razlozima),
   čuvanje (backup/uvoz i vraćanje verzije), prikaz iz strukture (orijentir + RPE, test 5 km, MP), izmena samo tempa, sat
   (preskočeno sa razlogom), kopija procene stanja (iste vrednosti kao maraton v1) i raspodela ugovora (a/b/c; (b)
   posle MAR-06 kroz činjenice i adaptaciju v2 ili „ne koristi se" sa razlogom, nikad maraton v1). Obrazac `halfMarathon/v2/app/app.node.test.ts` (HM-05, kopija). */

const VERSION = MARATHON_V2_POLICY.version;
const TODAY = '2026-10-26';
const RACE = '2027-03-07'; // nedelja; od 2026-10-26: 19 celih nedelja
const START = marathonV2Start(RACE, TODAY)!;
const WEEKS = 19;
const WITH_RESULT: MarathonV2PlanInput = {
  startDate: START,
  raceDate: RACE,
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 45,
  recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-10-10' },
  goalTimeSec: 12600
};
const FEEL: MarathonV2PlanInput = {
  startDate: START,
  raceDate: RACE,
  runDays: ['tue', 'thu', 'sun'],
  currentWeeklyKm: 35,
  easyPaceSecPerKm: 390,
  goalTimeSec: 15000
};
const BEGINNER: MarathonV2PlanInput = {
  startDate: START,
  raceDate: RACE,
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 30,
  easyPaceSecPerKm: 420,
  experience: 'beginner'
};
const SIX: MarathonV2PlanInput = {
  startDate: START,
  raceDate: RACE,
  runDays: ['mon', 'tue', 'wed', 'fri', 'sat', 'sun'],
  currentWeeklyKm: 60,
  recentResult: { distanceM: 21097.5, timeSec: 5700, date: '2026-10-18' },
  recentLongRunKm: 20
};

/** Mapa faze iz zadatka (P3), nezavisno od adaptera: rasterećenje bilo koje faze → DELOAD. */
const PHASE_MAP: Record<string, string> = {
  base: 'BAZA',
  development: 'RAZVOJ',
  specific: 'VRHUNAC',
  taper: 'TAPER',
  race: 'TRKA'
};

function planOf(input: MarathonV2PlanInput): GenPlanState {
  const r = generateMarathonV2Plan(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
const v2Of = (p: GenPlanState): MarathonV2Plan => p['marathonV2'] as MarathonV2Plan;
const view = (p: GenPlanState) => resolvePlan(p.weeks, { alts: {}, moves: {} });
const coreOf = (d: ResolvedDay): string => sessionCore(d);
const r2 = (x: number): number => Math.round(x * 100) / 100;

describe('generisanje kroz adapter', () => {
  for (const [name, input] of [
    ['sa rezultatom 4 d', WITH_RESULT],
    ['po osećaju 3 d', FEEL],
    ['početnik 4 d', BEGINNER],
    ['sa rezultatom 6 d', SIX]
  ] as const)
    it(`${name}: oznaka v2, nedelja 7 dana, struktura na svakom treningu, faza iz v2, trka van obima`, () => {
      const p = planOf(input);
      const v2 = v2Of(p);
      expect(p.meta).toMatchObject({
        policyId: 'marathon-v2',
        policyVersion: VERSION,
        raceDistM: 42195,
        raceName: 'Maraton',
        raceDate: RACE,
        start: START,
        weeks: WEEKS
      });
      expect(p.weeks).toHaveLength(v2.weeks.length);
      const plan = view(p);
      p.weeks.forEach((w, i) => {
        const v2w = v2.weeks[i]!;
        expect(w.start).toBe(v2w.startDate);
        expect(w.days).toHaveLength(7);
        expect(w.days.map((d) => d.dow)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        // Faza iz odluke v2 (jedna mapa adaptera), ne iz procenta aplikacije.
        expect(w.phase).toBe(v2w.deload ? 'DELOAD' : PHASE_MAP[v2w.phase]);
        expect(w.deload).toBe(v2w.deload);
        const training = w.days.filter((d) => !d.rest);
        expect(training).toHaveLength(v2w.days.length);
        for (const d of w.days) {
          expect(d.id).toBe(`g${w.w}d${d.dow + 1}`);
          expect(d.session).toBeUndefined();
          if (d.rest) continue;
          const s = d.structure!;
          expect(s.blocks.length).toBeGreaterThan(0);
          expect(d.km).toBeGreaterThan(0);
          expect(s.km).toBe(d.km);
          // Blokovi nose ceo trening: zbir delova (ponavljanja + oporavci) = km treninga v2.
          const sum = s.blocks.reduce(
            (a, b) => a + b.reps * (b.step.km ?? 0) + (b.reps - 1) * (b.recovery?.km ?? 0),
            0
          );
          expect(r2(sum)).toBeCloseTo(d.km!, 1);
        }
        // Uslov 8 (upotrebljivost u formatu aplikacije): dugi ≥ svaki lagan dan; nedelja ≥ minimum nedelje reda.
        const long = w.days.find((d) => d.tag === 'lr');
        for (const d of w.days.filter((x) => x.tag === 'lako'))
          if (long) expect(long.km, `ned ${w.w} dugi ≥ lagan`).toBeGreaterThanOrEqual(d.km);
        if (v2w.phase !== 'race')
          expect(v2w.plannedKm).toBeGreaterThanOrEqual(
            MARATHON_V2_POLICY.days[input.runDays.length as 3 | 4 | 5 | 6].weekMinKm
          );
        // Trka 42,2 km (sa WU) van nedeljnog obima kao u v2 (M8): km nedelje = planirani obim v2.
        const rw = plan.weeks[i]!;
        expect(r2(weekPlanKm(rw))).toBeCloseTo(v2w.plannedKm, 1);
        const race = weekRace(rw);
        if (v2w.phase === 'race') {
          expect(race).toEqual({ raceKm: 42.2, dayKm: race!.dayKm });
          expect(race!.dayKm).toBeGreaterThan(42.2);
        } else expect(race).toBeNull();
      });
      expect(p.weeks.at(-1)!.phase).toBe('TRKA');
      // M4: taper 2 nedelje (N−2, N−1), obeležen i kao `taper` nedelje formata.
      expect(p.weeks.slice(-3, -1).map((w) => w.phase)).toEqual(['TAPER', 'TAPER']);
      expect(p.weeks.filter((w) => w['taper'] === true).map((w) => w.w)).toEqual([
        WEEKS - 2,
        WEEKS - 1
      ]);
      expect(p.pred).toEqual([]);
      expect(p.ulaz).toBeUndefined();
      expect(isValidGenPlan(p)).toBe(true);
    });

  it('meta: samo ono što v2 zna — VDOT i prognoza samo uz rezultat, bez „predviđenog" cilja', () => {
    const res = planOf(WITH_RESULT);
    const meta = res.meta as Record<string, unknown>;
    for (const k of [
      'predictedSec',
      'vdotGoal',
      'realno',
      'intensity',
      'baseWeeks',
      'assessmentBasis',
      'preparation',
      'cycleDecision'
    ])
      expect(meta, k).not.toHaveProperty(k);
    const v2 = v2Of(res);
    expect(meta).toMatchObject({
      paceBasis: 'result',
      vdot: v2.vdot,
      vdot0: v2.vdot,
      predictedMarathonSec: v2.predictedMarathonSec,
      mpVdot: v2.paces.mpVdot,
      racePace: v2.paces.MP,
      goalSec: 12600,
      goalVdot: v2.goal!.goalVdot,
      runDays: 4
    });
    expect(meta['goalAssessment']).toEqual({
      status: v2.goal!.status,
      label: { realistic: 'realističan', ambitious: 'ambiciozan', unrealistic: 'nerealan' }[
        v2.goal!.status as 'realistic'
      ],
      message: v2.goal!.message
    });
    const feel = planOf(FEEL);
    const fm = feel.meta as Record<string, unknown>;
    expect(fm).toMatchObject({ paceBasis: 'feel', vdot: null, goalSec: 15000 });
    for (const k of [
      'vdot0',
      'trainingVdot',
      'predictedMarathonSec',
      'mpVdot',
      'goalVdot',
      'goalAssessment',
      'racePace'
    ])
      expect(fm, k).not.toHaveProperty(k);
    // Upozorenja i napomene v2 doslovno.
    for (const n of v2Of(feel).notes) expect(fm['dayWarnings']).toContain(n);
    for (const v of v2Of(feel).warnings) expect(fm['dayWarnings']).toContain(v.message);
  });

  it('plan po osećaju: rad kvaliteta nosi RPE i tempo kao procenu; test 5 km; sa rezultatom tempo je propisan', () => {
    const feelPlan = planOf(FEEL);
    const feel = view(feelPlan);
    const quality = feel.dated.filter((d) => d.tag === 'tempo' || d.tag === 'int');
    expect(quality.length).toBeGreaterThan(0);
    for (const d of quality) {
      expect(d.structure!.rpe).toBeDefined();
      const work = d.structure!.blocks.filter((b) => b.step.kind === 'work');
      for (const b of work) {
        expect(b.step.paceSec).toBeNull();
        expect(b.step.estimatePaceSec).toBeGreaterThan(0);
        expect(b.step.effort).toBeDefined();
      }
    }
    const test = feel.dated.filter((d) => d.tag === 'test');
    expect(test).toHaveLength(1);
    expect(test[0]!.structure!.kind).toBe('Test');
    const step = test[0]!.structure!.blocks.find((b) => b.step.kind === 'test')!.step;
    expect(step).toMatchObject({ km: 5, paceSec: null });
    expect(step.estimatePaceSec).toBeGreaterThan(0);
    // Lagano: propisan E opseg iz laganog tempa (opseg v2 oko 390 s/km).
    const e = v2Of(feelPlan).paces.E;
    expect(e.fast).toBeLessThan(390);
    expect(e.slow).toBeGreaterThan(390);
    const easy = feel.dated.find((d) => d.tag === 'lako')!.structure!.blocks[0]!.step;
    expect(easy).toMatchObject({ paceSec: 390, paceRange: { fast: e.fast, slow: e.slow } });

    const res = view(planOf(WITH_RESULT));
    for (const d of res.dated.filter((x) => x.tag === 'tempo' || x.tag === 'int')) {
      expect(d.structure!.rpe).toBeUndefined();
      for (const b of d.structure!.blocks)
        if (b.step.kind === 'work') expect(b.step.paceSec).toBeGreaterThan(0);
    }
    expect(res.dated.some((d) => d.tag === 'test')).toBe(false);
    // Početnik (M17): bez testa i po osećaju.
    expect(view(planOf(BEGINNER)).dated.some((d) => d.tag === 'test')).toBe(false);
  });

  it('degenerisan ulaz → odbijanje sa razlozima v2 doslovno, bez plana', () => {
    const rw = generateMarathonV2Plan({ ...BEGINNER, runWalk: true });
    expect(rw.ok).toBe(false);
    if (!rw.ok) expect(rw.reasons.map((r) => r.code)).toEqual(['RUN_WALK_NOT_SUPPORTED']);
    const seven = generateMarathonV2Plan({
      ...WITH_RESULT,
      runDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    });
    expect(seven.ok).toBe(false);
    if (!seven.ok) expect(seven.reasons.map((r) => r.code)).toContain('RUN_DAYS_COUNT');
    const short = generateMarathonV2Plan({ ...WITH_RESULT, startDate: '2026-12-21' });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.reasons.map((r) => r.code)).toEqual(['PLAN_TOO_SHORT']);
    const low = generateMarathonV2Plan({ ...WITH_RESULT, currentWeeklyKm: 5 });
    expect(low.ok).toBe(false);
    if (!low.ok) expect(low.reasons[0]!.code).toBe('WEEKLY_KM_TOO_LOW');
    const noPace = generateMarathonV2Plan({ ...FEEL, easyPaceSecPerKm: null });
    expect(noPace.ok).toBe(false);
    if (!noPace.ok) expect(noPace.reasons[0]!.code).toBe('EASY_PACE_REQUIRED');
  });

  it('isti ulaz → isti JSON; start = cele nedelje do trke, ne pre danas', () => {
    expect(JSON.stringify(planOf(WITH_RESULT))).toBe(JSON.stringify(planOf(WITH_RESULT)));
    expect(START).toBe('2026-10-26');
    expect(marathonV2Start('2027-03-07', '2026-10-27')).toBe('2026-11-02');
    expect(marathonV2Start('2026-10-20', '2026-10-26')).toBeNull();
    expect(marathonV2Start('nije-datum', '2026-10-26')).toBeNull();
  });
});

describe('prekidač i rutiranje po oznaci politike', () => {
  it('flags: podrazumevano isključen; override 1/true i 0/false nadjačavaju podešavanje; vidljivost', () => {
    const off = { setting: undefined, devOverride: undefined };
    expect(marathonV2Enabled(off)).toBe(false);
    expect(marathonV2Enabled({ setting: 'true', devOverride: undefined })).toBe(false);
    expect(marathonV2Enabled({ setting: true, devOverride: undefined })).toBe(true);
    expect(marathonV2Enabled({ setting: false, devOverride: '1' })).toBe(true);
    expect(marathonV2Enabled({ setting: false, devOverride: 'TRUE' })).toBe(true);
    expect(marathonV2Enabled({ setting: true, devOverride: '0' })).toBe(false);
    expect(marathonV2Enabled({ setting: true, devOverride: 'false' })).toBe(false);
    expect(marathonV2Enabled({ setting: true, devOverride: 'x' })).toBe(true);
    // Bez izvora prekidača maratona polje izostaje (= isključen); 5K, 10K i HM prekidači se ne mešaju.
    const on = { setting: true, devOverride: undefined };
    expect(generatorFlags(off)).toEqual({ fiveKV2: false });
    expect(generatorFlags(off, off, off)).toEqual({ fiveKV2: false, tenKV2: false, hmV2: false });
    expect(generatorFlags(off, off, off, on)).toEqual({
      fiveKV2: false,
      tenKV2: false,
      hmV2: false,
      marathonV2: true
    });
    expect(generatorFlags(on, on, on, off)).toEqual({
      fiveKV2: true,
      tenKV2: true,
      hmV2: true,
      marathonV2: false
    });
    expect(marathonV2ToggleVisible({ devOverride: undefined, isAdmin: false })).toBe(false);
    expect(marathonV2ToggleVisible({ devOverride: ' ', isAdmin: false })).toBe(false);
    expect(marathonV2ToggleVisible({ devOverride: '0', isAdmin: false })).toBe(true);
    expect(marathonV2ToggleVisible({ devOverride: undefined, isAdmin: true })).toBe(true);
  });

  it('nov plan: uključen prekidač menja SAMO maraton; isključen = kao do sada; predaja ostaje v1', () => {
    expect(generatorForNewPlan(42195, { fiveKV2: false })).toBe(MARATHON_GENERATOR);
    expect(
      generatorForNewPlan(42195, { fiveKV2: true, tenKV2: true, hmV2: true, marathonV2: false })
    ).toBe(MARATHON_GENERATOR);
    expect(generatorForNewPlan(42195, { fiveKV2: false, marathonV2: true })).toBe(
      MARATHON_V2_GENERATOR
    );
    expect(generatorForNewPlan(5000, { fiveKV2: false, marathonV2: true })).toBe(FIVE_K_GENERATOR);
    expect(generatorForNewPlan(10000, { fiveKV2: false, marathonV2: true })).toBe(TEN_K_GENERATOR);
    expect(generatorForNewPlan(21097.5, { fiveKV2: false, marathonV2: true })).toBe(
      HALF_MARATHON_GENERATOR
    );
    expect(generatorForNewPlan(10000, { fiveKV2: false, tenKV2: true, marathonV2: true })).toBe(
      TEN_K_V2_GENERATOR
    );
    expect(generatorForNewPlan(21097.5, { fiveKV2: false, hmV2: true, marathonV2: true })).toBe(
      HALF_MARATHON_V2_GENERATOR
    );
    // Predaja „kraća distanca" (maraton → HM, HM → 10K) ostaje v1 (predaja v2 je faza 3).
    expect(regeneratorForDistance(21097.5)).toBe(hm.handoffFuture);
    expect(regeneratorForDistance(10000)).toBe(tenK.handoffFuture);
  });

  it('postojeći planovi: marathon-v1 i legacy-marathon ostaju na maraton v1; marathon-v2 → v2; nepoznata/bez verzije → UNKNOWN_POLICY; tuđa distanca → null', () => {
    const v2 = stampForStorage(planOf(WITH_RESULT));
    expect(generatorForPlan(v2)).toBe(MARATHON_V2_GENERATOR);
    expect(isMarathonV2Plan(v2)).toBe(true);
    expect(isHmV2Plan(v2)).toBe(false);
    expect(isTenKV2Plan(v2)).toBe(false);
    // Odluka o ograničenoj pripremi je samo maraton v1.
    expect(preparationForPlan(v2)).toBeNull();
    const meta = v2.meta!;
    const withMeta = (m: Record<string, unknown>): GenPlanState => ({
      ...v2,
      meta: { ...meta, ...m }
    });
    expect(
      generatorForPlan(withMeta({ policyId: 'marathon-v1', policyVersion: 'marathon-v1.0.0' }))
    ).toBe(MARATHON_GENERATOR);
    const legacy = { ...v2, meta: { ...meta } };
    delete legacy.meta['policyId'];
    delete legacy.meta['policyVersion'];
    expect(generatorForPlan(legacy)).toBe(MARATHON_GENERATOR);
    for (const version of [
      'marathon-v2.0.0',
      'marathon-v2.3.0',
      'marathon-v2.99.0',
      'hm-v2.3.0',
      undefined
    ]) {
      if (version === VERSION) continue;
      const p = withMeta({ policyVersion: version });
      expect(generatorForPlan(p), String(version)).toBeNull();
      expect(isMarathonV2Plan(p)).toBe(false);
      expect(unsupportedPlanReason(p)).toBe(UNKNOWN_POLICY);
      expect(preparationForPlan(p)).toBeNull();
      expect(stampForStorage(p)).toBe(p);
      expect(phaseReaderFor(p)(p.weeks[0], WEEKS)).toBe('');
    }
    for (const raceDistM of [5000, 10000, 21097.5])
      expect(generatorForPlan(withMeta({ raceDistM })), String(raceDistM)).toBeNull();
    // Prekidač ne prebacuje postojeći v1 plan (izbor ne čita prekidač); lični plan vlasnika ostaje HM v1.
    const input = toGenerationInput(
      {
        ...initialWizard(),
        raceDist: 42195,
        raceDate: '2027-04-04',
        pbDist: 21097.5,
        pbH: '1',
        pbMin: '40',
        pbSec: '0',
        weeklyKm: '50',
        runDays: 5,
        runDows: [1, 2, 4, 6, 7]
      },
      '2026-11-02'
    )!;
    const v1 = stampForStorage(
      MARATHON_GENERATOR.adaptGeneratedPlan(MARATHON_GENERATOR.generatePlan(input))!
    );
    expect(generatorForPlan(v1)).toBe(MARATHON_GENERATOR);
    expect(generatorForPlan(personalPlan(48))).toBe(HALF_MARATHON_GENERATOR);
    for (const p of [v1, personalPlan(48)]) {
      expect(isMarathonV2Plan(p)).toBe(false);
      expect(tracksOffPlanRuns(p)).toBe(false);
    }
    expect(tracksOffPlanRuns(v2)).toBe(true);
  });

  it('KNOWN_VERSIONS = sve verzije sačuvane posle MAR-05 (marathon-v2.3.1) i tekuća', () => {
    expect(mar.marathonV2.KNOWN_VERSIONS).toEqual([
      ...new Set(['marathon-v2.3.1', 'marathon-v2.4.0', 'marathon-v2.4.1', VERSION])
    ]);
    expect(MARATHON_V2_GENERATOR.policyVersion).toBe(VERSION);
    expect(MARATHON_V2_GENERATOR.legacyPolicyId).toBe('legacy-marathon');
  });

  it('upis i faza idu kroz generator plana; stampPlan ne menja ostala polja', () => {
    const p = planOf(FEEL);
    const again = stampForStorage(p);
    expect(JSON.stringify(again)).toBe(JSON.stringify(p));
    const phase = phaseReaderFor(p);
    expect(p.weeks.map((w) => phase(w, p.weeks.length))).toEqual(p.weeks.map((w) => w.phase));
  });
});

describe('čuvanje: upis → učitavanje → backup → uvoz → isti plan; vraćanje verzije', () => {
  for (const [name, input] of [
    ['sa rezultatom', WITH_RESULT],
    ['po osećaju', FEEL]
  ] as const)
    it(name, () => {
      const plan = stampForStorage(planOf(input));
      const state: PersistedState = { ...seedState(TODAY), genPlan: plan };
      const reloaded = migrateState(JSON.parse(JSON.stringify(state)) as unknown)!;
      expect(JSON.stringify(reloaded.genPlan)).toBe(JSON.stringify(plan));
      const file = JSON.parse(
        JSON.stringify(buildBackup(reloaded, '2026-10-26T10:00:00.000Z'))
      ) as unknown;
      const imported = importBackup(file, seedState(TODAY));
      expect(imported.ok).toBe(true);
      if (!imported.ok) return;
      expect(JSON.stringify(imported.state.genPlan)).toBe(JSON.stringify(plan));
      expect(generatorForPlan(imported.state.genPlan)).toBe(MARATHON_V2_GENERATOR);
      expect(view(imported.state.genPlan!).dated.map(coreOf)).toEqual(view(plan).dated.map(coreOf));
      // Revizija čuva izlaz v2 (`marathonV2` u PLAN_FIELDS): vraćena verzija je ponovo plan maratona v2.
      const other = stampForStorage(planOf({ ...input, goalTimeSec: 13800 }));
      const next = recordPlanRevision(plan, other, {
        reason: 'goal',
        date: TODAY,
        summary: 'proba'
      });
      const [rev] = getPlanRevisions(next);
      expect(rev).toBeDefined();
      expect(JSON.stringify(rev!.snapshot['marathonV2'])).toBe(JSON.stringify(plan['marathonV2']));
      expect(isMarathonV2Plan(rev!.snapshot)).toBe(true);
    });
});

const fmt = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

describe('prikaz iz strukture (Plan tab, dan)', () => {
  it('sa rezultatom: rad sa tempom, zagrevanje/hlađenje sa E opsegom, odmor; MP; trka 42,2 km sa tempom', () => {
    const plan = view(planOf(WITH_RESULT));
    const q = plan.dated.find((d) =>
      d.structure?.blocks.some((b) => b.step.kind === 'work' && b.reps > 1)
    )!;
    expect(coreOf(q)).toMatch(/^\d+ × [\d,]+ (m|km) @ \d:\d\d\/km$/);
    const rows = sessionBreakdown(q, MARATHON_V2_GENERATOR.rpeTarget)!;
    const labels = rows.map((r) => r[0]);
    expect(labels).toEqual(
      expect.arrayContaining(['Zagrevanje', 'Radni deo', 'Odmor', 'Hlađenje'])
    );
    expect(rows.find((r) => r[0] === 'Zagrevanje')![1]).toMatch(/@ \d:\d\d–\d:\d\d\/km/);
    const race = plan.dated.find((d) => d.tag === 'trka')!;
    expect(race.structure!.kind).toBe('TRKA');
    expect(coreOf(race)).toMatch(/^42,2 km @ \d:\d\d\/km$/);
    // MP (M10): vrsta „Maratonski tempo", rad tempom MP plana (VDOT umanjen za korekciju obima, M2).
    const mpTempo = v2Of(planOf(WITH_RESULT)).paces.MP;
    const mp = plan.dated.filter((d) => d.structure?.kind === 'Maratonski tempo');
    expect(mp.length).toBeGreaterThan(0);
    for (const d of mp)
      for (const b of d.structure!.blocks)
        if (b.step.kind === 'work') expect(b.step.paceSec).toBe(mpTempo);
  });

  it('po osećaju: napor (RPE) + tempo „orijentir (procena)"; test 5 km; trka bez propisanog tempa', () => {
    const plan = view(planOf(FEEL));
    const q = plan.dated.find((d) => d.tag === 'tempo')!;
    expect(coreOf(q)).toMatch(/po osećaju \(RPE \d(–\d)?\), orijentir \(procena\) \d:\d\d\/km/);
    const rows = sessionBreakdown(q, MARATHON_V2_GENERATOR.rpeTarget)!;
    expect(rows.find((r) => r[0] === 'Napor')![1]).toMatch(/^RPE \d(–\d)? — /);
    const test = plan.dated.find((d) => d.tag === 'test')!;
    expect(coreOf(test)).toMatch(/^5 km — orijentir \(procena\) \d:\d\d\/km$/);
    const race = plan.dated.find((d) => d.tag === 'trka')!;
    expect(coreOf(race)).toMatch(/^42,2 km — orijentir \(procena\) \d:\d\d\/km$/);
    expect(MARATHON_V2_GENERATOR.rpeTarget(q)).toEqual(q.structure!.rpe);
    expect(MARATHON_V2_GENERATOR.rpeTarget(plan.dated.find((d) => d.tag === 'lako'))).toBeNull();
  });

  it('piramida (I): svaka deonica i oporavak redom; odmor se prikazuje', () => {
    const p = pacesFromVdot(50, 60);
    const w = qualityWorkout(
      {
        ladder: 'I',
        zone: 'I',
        doseM: 3000,
        structure: { form: 'pyramid', repsM: [1200, 1000, 800] },
        step: 'alt'
      },
      p,
      warmupCooldown(40)
    );
    const s = workoutStructure(w, p, false);
    expect(s.blocks.map((b) => `${b.reps}:${b.step.kind}:${b.step.km}`)).toEqual([
      `1:warmup:${s.blocks[0]!.step.km}`,
      '1:work:1.2',
      `1:recovery:${s.blocks[2]!.step.km}`,
      '1:work:1',
      `1:recovery:${s.blocks[4]!.step.km}`,
      '1:work:0.8',
      `1:cooldown:${s.blocks[6]!.step.km}`
    ]);
    expect(structureRows(s, null).find((r) => r[0] === 'Odmor')![1]).toBe(
      `${durationText(s.blocks[2]!.step.sec!)} / ${durationText(s.blocks[4]!.step.sec!)} kaskanje`
    );
    expect(structureRows(s, null).find((r) => r[0] === 'Radni deo')![1]).toBe(
      `1,2 km @ ${fmt(p.I)}/km + 1 km @ ${fmt(p.I)}/km + 800 m @ ${fmt(p.I)}/km`
    );
    expect(s.blocks[0]!.step.paceRange).toEqual({ fast: p.E.fast, slow: p.E.slow });
    expect(s.blocks[0]!.step.paceSec).toBe(midEasy(p));
  });

  it('izmena samo tempa čuva strukturu (tempo rada); izmena tipa je briše', () => {
    const p = planOf(FEEL);
    const plan = view(p);
    const q = plan.dated.find((d) => d.tag === 'tempo')!;
    const alt = {
      tag: 'tempo' as const,
      km: q.km,
      desc: q.desc ?? '',
      pace: 300,
      rw: null,
      paceAuto: false
    };
    const edited = resolvePlan(p.weeks, { alts: { [q.id]: alt }, moves: {} }).byId.get(q.id)!;
    expect(edited.structure).toBeDefined();
    for (const b of edited.structure!.blocks)
      if (b.step.kind === 'work') expect(b.step.paceSec).toBe(300);
      else expect(b.step).toEqual(q.structure!.blocks[edited.structure!.blocks.indexOf(b)]!.step);
    const retyped = resolvePlan(p.weeks, {
      alts: { [q.id]: { ...alt, tag: 'lako', pace: null } },
      moves: {}
    }).byId.get(q.id)!;
    expect(retyped.structure).toBeUndefined();
  });
});

describe('izvoz na sat iz strukture', () => {
  it('sa rezultatom: ponavljanja sa oporavkom, E opseg; trka se ne šalje; ništa preskočeno', () => {
    const plan = view(planOf(WITH_RESULT));
    const b = MARATHON_V2_GENERATOR.workoutsForWatch(plan, START, 28, null);
    expect(b.skipped).toBe(0);
    expect(b.skippedReasons).toBeUndefined();
    expect(b.events.length).toBeGreaterThan(10);
    const q = b.events.find((e) => /Radni deo \d+x/.test(e.description))!;
    expect(q.description).toMatch(/Zagrevanje\n- \d+m \d:\d\d-\d:\d\d\/km Pace/);
    expect(q.description).toMatch(/- Oporavak kaskanje /);
    expect(q.description).toMatch(/Poslednja deonica\n- /);
    const race = plan.dated.find((d) => d.tag === 'trka')!;
    const end = MARATHON_V2_GENERATOR.workoutsForWatch(plan, race.date, 7, null);
    expect(end.events.some((e) => e.date === race.date)).toBe(false);
  });

  it('po osećaju: dan sa delom po osećaju se ne šalje, broji se i navodi razlog; test se ne šalje', () => {
    const plan = view(planOf(FEEL));
    const b = MARATHON_V2_GENERATOR.workoutsForWatch(plan, START, 28, null);
    const quality = plan.dated.filter(
      (d) => d.date <= '2026-11-23' && (d.tag === 'tempo' || d.tag === 'int')
    );
    expect(quality.length).toBeGreaterThan(0);
    expect(b.skipped).toBe(b.skippedReasons!.length);
    expect(b.skippedReasons!.filter((r) => r.includes(SKIP_FEEL))).toHaveLength(quality.length);
    expect(b.events.every((e) => !/RPE/.test(e.description))).toBe(true);
    expect(b.events.some((e) => plan.byId.get(e.externalId.slice(6))?.tag === 'test')).toBe(false);
  });

  it('ručno izmenjen dan bez strukture se ne šalje (sa razlogom)', () => {
    const p = planOf(WITH_RESULT);
    const plan = view(p);
    const q = plan.dated.find((d) => (d.tag === 'tempo' || d.tag === 'int') && d.date >= START)!;
    const edited = resolvePlan(p.weeks, {
      alts: {
        [q.id]: { tag: 'lako', km: 8, desc: 'Lagano 8 km', pace: null, rw: null, paceAuto: false }
      },
      moves: {}
    });
    const b = MARATHON_V2_GENERATOR.workoutsForWatch(edited, START, 28, null);
    expect(b.skipped).toBe(1);
    expect(b.skippedReasons![0]).toContain(SKIP_NO_STRUCTURE);
  });
});

describe('ugovor: (a) v2, (b) kroz činjenice i adaptaciju v2 (nikad maraton v1), (c) sopstvena kopija procene stanja', () => {
  const A = [
    'id',
    'policyId',
    'policyVersion',
    'legacyPolicyId',
    'planPolicy',
    'stampPlan',
    'phaseOfWeek',
    'generatePlan',
    'adaptGeneratedPlan',
    'assess',
    'product',
    'workoutsForWatch',
    'thresholdPace',
    'rpeTarget',
    'paceForZone'
  ];
  const B = Object.keys(MEMBERS);
  const C = [
    'weatherCard',
    'painStatus',
    'acwrNow',
    'acwrPlan',
    'readinessModel',
    'loadMeaning',
    'wellnessSignals',
    'acwrBand',
    'acwrText',
    'acwrPosition',
    'ACWR_MAX',
    'ACWR_RETURN',
    'ACWR_HIGH',
    'ACWR_SCALE'
  ];

  it('tabela pokriva svaki član ugovora tačno jednom; nijedna funkcija nije funkcija maraton v1', () => {
    const keys = Object.keys(MARATHON_V2_GENERATOR).sort();
    expect(keys).toHaveLength(55);
    expect(B).toHaveLength(26);
    expect([...A, ...B, ...C].sort()).toEqual(keys);
    expect(Object.keys(MARATHON_GENERATOR).sort()).toEqual(keys);
    const g = MARATHON_V2_GENERATOR as unknown as Record<string, unknown>;
    const old = MARATHON_GENERATOR as unknown as Record<string, unknown>;
    const v1 = new Set<unknown>(Object.values(mar).filter((x) => typeof x === 'function'));
    for (const k of keys)
      if (typeof g[k] === 'function') {
        expect(g[k], k).not.toBe(old[k]);
        expect(v1.has(g[k]), k).toBe(false);
      }
    for (const k of B) expect(MEMBERS[k]!.reason.length, k).toBeGreaterThan(10);
  });

  it('(b) adapter članova (b) uvozi samo iz maratona v2 (jezgro i adapter): ne može da pozove maraton v1', () => {
    for (const f of ['./members.ts', './adapt.ts', './facts.ts', './form.ts']) {
      const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
      const from = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!);
      expect(from.length, f).toBeGreaterThan(0);
      for (const x of from) expect(x, `${f}: ${x}`).toMatch(/^\.\.?\/[A-Za-z]+\.ts$/);
    }
  });

  it('(b) „ne koristi se" sa razlogom, „nema predloga" ili nepromenjen ulaz — bez maraton v1', () => {
    const g: PlanGenerator = MARATHON_V2_GENERATOR;
    const p = planOf(WITH_RESULT);
    const plan = view(p);
    const today = '2026-11-20' as IsoDate;
    expect(g.buildRunWalkAdjustment(p, today, null as never, { mode: 'hold' })).toEqual({
      error: NO_RUN_WALK
    });
    expect(g.executionBasis(p, today, null as never, {})).toEqual({
      error: NO_PREPARATION_DECISION
    });
    expect(g.planRecalibrated(p, 50, today)).toEqual({ error: RECALIBRATION_NOT_USED });
    const ex = g.executionModel(plan, today, {});
    expect(ex.analysis.today).toBe(today);
    expect(ex.analysis.reasons).toEqual([ADAPTATION_V2]);
    expect(ex.recommendation).toMatchObject({ kind: null, actionable: false });
    expect(g.assessRunWalkProgress({ plan, log: {}, today })).toMatchObject({
      decision: 'not-applicable'
    });
    expect(g.qualityEntryGate({ analysis: ex.analysis, formConfirmed: true }).open).toBe(false);
    // Test 3 km nije rezultat maratona v2 (A1): ni svež ne čini formu.
    expect(g.hasRecentMeasuredForm(today, { t3k: [{ id: 'x', date: today, sec: 700 }] })).toBe(
      false
    );
    expect(MEMBERS['hasRecentMeasuredForm']!.reason).toBe(T3K_NOT_USED);
    expect(g.classifyMeasurement({} as never)).toMatchObject({ status: 'not-used' });
    const chain = [{ id: 'a', ts: today, vdot: 50, prev: null, delta: null, measured: 50 }];
    expect(g.recomputeVdotChain(chain, 50, () => 'default')).toEqual(chain);
    expect(g.currentVdot(chain)).toBeNull();
    expect(g.vdotProposal({} as never)).toBeNull();
    expect(g.injuryProposal({} as never, today)).toBeNull();
    const alts = {
      g1d2: { tag: 'lako' as const, km: 5, desc: 'x', pace: null, rw: null, paceAuto: false }
    };
    expect(g.applyVdotProposal(null, plan, {}, alts, p)).toEqual({ applied: 0, alts, genPlan: p });
    expect(g.undoVdotAdjustments(plan, alts, p)).toEqual({ applied: 0, alts, genPlan: p });
    expect(g.applyInjuryProposal(null, plan, {}, alts)).toEqual({ applied: 0, alts });
    expect(g.alignAutomaticOverlays(p, p, today, { alts })).toEqual(alts);
    expect(
      g.realignPlan({ weeks: p.weeks, alts, moves: { a: 1 }, log: {}, runsByDate: {} })
    ).toEqual({
      moves: { a: 1 },
      moved: 0
    });
    const ev = g.fitnessEvidence({
      today,
      tests: [{ id: 't', date: today, sec: 700 }],
      vdotChain: chain
    } as never);
    expect(ev).toMatchObject({ form: null, measurements: 0, trainingMeasurements: 0, chain: [] });
    expect(g.planVdotNow({ meta: p.meta } as never)).toBe(v2Of(p).vdot);
    expect(g.planVdotNow({ meta: planOf(FEEL).meta } as never)).toBeNull();
    expect(g.matchPlanRows([], []).size).toBe(0);
    expect(g.recalibrationMinMeasurements).toBe(Number.POSITIVE_INFINITY);
    expect(g.recalibrationThreshold).toBe(Number.POSITIVE_INFINITY);
    // Vraćanje iste verzije: nema dana za vraćanje.
    const graft = g.graftFuturePlan(p, p, today);
    expect(graft.meta?.['futureChanges']).toEqual({ changedDays: 0, conflicts: [] });
  });

  it('(c) procena stanja: iste vrednosti kao maraton v1 (posebna kopija)', () => {
    const p = planOf(WITH_RESULT);
    const plan = view(p);
    const log = Object.fromEntries(
      plan.dated
        .filter((d) => d.date <= '2026-11-25' && !d.rest)
        .map((d, i) => [d.id, { status: i % 4 === 3 ? 'skip' : 'done', km: (d.km ?? 0) + 0.5 }])
    );
    const ctx = { plan, log, outOfPlan: { '2026-10-20': 6, '2026-10-22': 8 } };
    const pain = [
      { date: '2026-11-20', pain: 4, part: 'koleno-L', act: 'Trčanje' },
      { date: '2026-11-22', pain: 7, part: 'stopalo-D' }
    ];
    const wellness = {
      '2026-11-22': {
        datum: '2026-11-22',
        hrv: 60,
        pulsUMiru: 50,
        sanH: 7,
        sanOcena: 80,
        tezina: null,
        ctl: 30,
        atl: 35,
        svezina: -5
      },
      '2026-11-23': {
        datum: '2026-11-23',
        hrv: 52,
        pulsUMiru: 55,
        sanH: 5.5,
        sanOcena: 60,
        tezina: null,
        ctl: 30,
        atl: 38,
        svezina: -8
      }
    };
    const g = MARATHON_V2_GENERATOR;
    const o = MARATHON_GENERATOR;
    for (const day of ['2026-11-23', '2026-11-26', '2026-12-10'] as IsoDate[]) {
      expect(g.painStatus(pain, day)).toEqual(o.painStatus(pain, day));
      expect(g.acwrNow(ctx, day)).toEqual(o.acwrNow(ctx, day));
      expect(g.acwrPlan(ctx, day)).toEqual(o.acwrPlan(ctx, day));
      const input = {
        status: o.painStatus(pain, day),
        load: o.acwrNow(ctx, day),
        wellness,
        today: day
      };
      expect(g.readinessModel(input)).toEqual(o.readinessModel(input));
      expect(g.wellnessSignals(wellness, day, true)).toEqual(
        o.wellnessSignals(wellness, day, true)
      );
    }
    for (const r of [0.5, 0.8, 1.1, 1.4, 1.7]) {
      expect(g.acwrBand(r)).toBe(o.acwrBand(r));
      expect(g.acwrText(r)).toBe(o.acwrText(r));
      expect(g.acwrPosition(r)).toBe(o.acwrPosition(r));
      expect(g.loadMeaning(g.acwrBand(r))).toBe(o.loadMeaning(o.acwrBand(r)));
    }
    expect([g.ACWR_MAX, g.ACWR_RETURN, g.ACWR_HIGH, g.ACWR_SCALE]).toEqual([
      o.ACWR_MAX,
      o.ACWR_RETURN,
      o.ACWR_HIGH,
      o.ACWR_SCALE
    ]);
    // Vreme: isti pragovi vrućine i tekst; tempo dana iz strukture v2.
    const day = plan.dated.find((d) => d.tag === 'int' || d.tag === 'tempo')!;
    const hot = { temp: 31, osecaj: 33, vlaga: 60, vetar: 5, kisa: 0 };
    const cache = {
      sati: { [`${day.date}T18`]: hot, [`${day.date}T07`]: { ...hot, osecaj: 22, temp: 21 } }
    };
    const input = {
      day,
      today: day.date,
      nowHour: 6,
      trainingHour: 18,
      cache,
      hasLocation: true,
      predPace: null,
      vdot: null
    };
    const work = day.structure!.blocks.find((b) => b.step.kind === 'work')!.step;
    const mine = g.weatherCard(input)!;
    const theirs = o.weatherCard({
      ...input,
      day: { ...day, session: { paceSec: work.paceSec } }
    })!;
    expect(mine).toEqual(theirs);
    expect(mine.rows.some((r) => r.label === 'tempo uz vrućinu')).toBe(true);
  });

  it('(a) tempo/prag/napor/proizvod/procena iz v2 modela', () => {
    const g = MARATHON_V2_GENERATOR;
    expect(g.thresholdPace(null)).toBeNull();
    expect(g.thresholdPace(45)).toBe(fmt(pacesFromVdot(45, 60).T));
    for (const km of [30, 45, 70]) expect(g.paceForZone(45, 'T')).toBe(pacesFromVdot(45, km).T);
    expect(g.product(42195)).toMatchObject({ name: 'Maraton', minWeeks: 12 });
    expect(g.product(21097.5)).toBeUndefined();
    const a = g.assess({ distM: 10000, sec: 2700 }, WEEKS, 'std', 12600, 42195);
    expect(a).toMatchObject({ assessmentBasis: 'current-fitness' });
    expect(a.vdotGoal).toBe(a.vdot0); // v2 ne projektuje napredak
    // Ugovor ne nosi obim: prognoza iz VDOT-a sa najvećom korekcijom M2 (opreznije) — ne brža od plana sa obimom.
    expect(a.predictedSec).toBeGreaterThanOrEqual(v2Of(planOf(WITH_RESULT)).predictedMarathonSec!);
    // Ugovorni generatePlan (zajednički ulaz) → isti plan kao čarobnjak za isti ulaz v2.
    const gen = g.generatePlan({
      startDate: TODAY,
      raceDate: RACE,
      raceDistM: 42195,
      pb: { distM: 10000, sec: 2700, date: '2026-10-10' },
      weeklyKm: 45,
      runDows: [2, 4, 6, 7],
      goalSec: 12600,
      intensity: 'std'
    });
    expect(JSON.stringify(g.adaptGeneratedPlan(gen))).toBe(JSON.stringify(planOf(WITH_RESULT)));
    expect(
      'error' in
        g.generatePlan({
          startDate: TODAY,
          raceDate: RACE,
          pb: { distM: 10000, sec: 2700 },
          weeklyKm: 45,
          runDows: [2, 4, 6, 7],
          intensity: 'std'
        })
    ).toBe(true);
    expect(g.adaptGeneratedPlan({ error: 'x' })).toBeNull();
  });
});
