import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../../date';
import { sessionBreakdown, sessionCore } from '../../../../day';
import { resolvePlan, type ResolvedDay } from '../../../../plan';
import {
  buildBackup,
  importBackup,
  isValidGenPlan,
  migrateState,
  seedState,
  type GenPlanState,
  type PersistedState
} from '../../../../state';
import { fiveKV2Enabled, generatorFlags } from '../../../flags';
import {
  FIVE_K_GENERATOR,
  FIVE_K_V2_GENERATOR,
  HALF_MARATHON_GENERATOR,
  MARATHON_GENERATOR,
  TEN_K_GENERATOR,
  UNKNOWN_POLICY,
  generateFiveKV2Plan,
  generatorForDistance,
  generatorForNewPlan,
  generatorForPlan,
  isFiveKV2Plan,
  phaseReaderFor,
  stampForStorage,
  unsupportedPlanReason,
  type PlanGenerator
} from '../../../select';
import type { StructuredPlanInput } from '../../../contract';
import * as fiveK from '../../index';

/* SEGMENT 08a — 5K v2 u aplikaciji: generisanje kroz adapter, oznaka i rutiranje po politici, čuvanje (backup/uvoz
   round-trip), prikaz iz strukture, izvoz na sat iz strukture, kopija procene stanja (iste vrednosti kao fiveK) i
   raspodela ugovora (a/b/c). */

const TODAY = '2026-10-26';
const RACE = '2027-01-10'; // nedelja → nedelje pon–ned
const WITH_RESULT: StructuredPlanInput = {
  startDate: '2026-11-02',
  raceDate: RACE,
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 25,
  recentResult: { distanceM: 5000, timeSec: 1500, date: '2026-10-20' },
  goalTimeSec: 1440
};
const FEEL: StructuredPlanInput = {
  startDate: '2026-11-02',
  raceDate: RACE,
  runDays: ['tue', 'thu', 'sun'],
  currentWeeklyKm: 18,
  typicalEasyPaceSecPerKm: 390,
  goalTimeSec: 1800,
  experience: 'beginner',
  canRun30Min: true
};
const RUN_WALK: StructuredPlanInput = {
  startDate: '2026-11-02',
  raceDate: RACE,
  runDays: ['mon', 'wed', 'sat'],
  currentWeeklyKm: 0,
  experience: 'beginner',
  canRun30Min: false
};

function planOf(input: StructuredPlanInput): GenPlanState {
  const r = generateFiveKV2Plan(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
const view = (p: GenPlanState) => resolvePlan(p.weeks, { alts: {}, moves: {} });
const coreOf = (d: ResolvedDay): string => sessionCore(d);
const breakdownOrNull = (d: ResolvedDay) => sessionBreakdown(d, FIVE_K_V2_GENERATOR.rpeTarget);

describe('generisanje kroz adapter', () => {
  it('plan sa rezultatom: oznaka v2, cele nedelje od 7 dana, struktura na svakom treningu, faza iz v2', () => {
    const p = planOf(WITH_RESULT);
    expect(p.meta).toMatchObject({
      policyId: '5k-v2',
      policyVersion: '5k-v2.10.3',
      raceDistM: 5000
    });
    expect(p.weeks).toHaveLength(10);
    for (const w of p.weeks) {
      expect(w.days).toHaveLength(7);
      expect(w.days.map((d) => d.dow)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      for (const d of w.days) {
        expect(d.id).toBe(`g${w.w}d${d.dow + 1}`);
        if (!d.rest) expect(d.structure?.blocks.length).toBeGreaterThan(0);
        expect(d.session).toBeUndefined();
      }
    }
    // Faza iz odluke v2 (prikazna mapa adaptera), ne iz procenta aplikacije.
    const v2weeks = (p['fiveKV2'] as { weeks: Array<{ phase: string; deload: boolean }> }).weeks;
    const MAP: Record<string, string> = {
      base: 'BAZA',
      peak: 'RAZVOJ',
      sharpen: 'VRHUNAC',
      taper: 'TAPER',
      race: 'TRKA'
    };
    expect(p.weeks.map((w) => w.phase)).toEqual(
      v2weeks.map((w) => (w.deload ? 'DELOAD' : MAP[w.phase]))
    );
    expect(p.weeks[2]!.phase).toBe('DELOAD');
    expect(p.weeks[9]!.phase).toBe('TRKA');
    // Ceo izlaz v2 doslovno (osnova adaptacije, 08b); `pred` prazan (v2 nema redove predikcije).
    expect((p['fiveKV2'] as { policyVersion: string }).policyVersion).toBe('5k-v2.10.3');
    expect(p.pred).toEqual([]);
    expect(p.ulaz).toBeUndefined();
  });

  it('meta nosi samo ono što v2 zna: bez „predviđenog" cilja, intenziteta i procene napretka', () => {
    const meta = planOf(WITH_RESULT).meta as Record<string, unknown>;
    for (const k of [
      'predictedSec',
      'vdotGoal',
      'realno',
      'intensity',
      'baseWeeks',
      'assessmentBasis'
    ])
      expect(meta, k).not.toHaveProperty(k);
    expect(meta['vdot0']).toBeCloseTo(38.3, 1);
    const feel = planOf(FEEL).meta as Record<string, unknown>;
    expect(feel).not.toHaveProperty('vdot0');
    expect(feel).not.toHaveProperty('racePace');
  });

  it('cilj doslovno iz v2: „nedovoljno podataka", „orijentir", „završiti"', () => {
    expect(planOf(FEEL).meta?.goalAssessment).toMatchObject({
      status: 'insufficient_data',
      label: 'nedovoljno podataka'
    });
    const beginnerWithResult = planOf({
      ...WITH_RESULT,
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 18,
      goalTimeSec: 1520,
      experience: 'beginner',
      canRun30Min: true
    });
    expect(beginnerWithResult.meta?.goalAssessment).toMatchObject({
      status: 'orientation',
      label: 'orijentir'
    });
    expect(planOf(RUN_WALK).meta?.goalAssessment).toEqual({
      status: 'finish',
      label: 'završiti',
      message: 'Cilj: završiti trku (bez ciljnog vremena).'
    });
  });

  it('odbijanje v2 vraća strukturisane razloge (5 dana početnik), bez plana', () => {
    const r = generateFiveKV2Plan({
      ...FEEL,
      currentWeeklyKm: 25,
      runDays: ['mon', 'tue', 'wed', 'fri', 'sat']
    });
    expect(r).toEqual({
      ok: false,
      reasons: [
        { code: 'RUN_DAYS_COUNT', message: 'Početnik: najviše 4 dana trčanja nedeljno; zadato 5.' }
      ]
    });
  });

  it('isti ulaz → isti JSON (bez sata i slučajnosti)', () => {
    expect(JSON.stringify(planOf(WITH_RESULT))).toBe(JSON.stringify(planOf(WITH_RESULT)));
  });
});

describe('prekidač i rutiranje po oznaci politike', () => {
  it('flags: podrazumevano isključen; override 1/0 nadjačava podešavanje', () => {
    expect(fiveKV2Enabled({ setting: undefined, devOverride: undefined })).toBe(false);
    expect(fiveKV2Enabled({ setting: 'true', devOverride: undefined })).toBe(false);
    expect(fiveKV2Enabled({ setting: true, devOverride: undefined })).toBe(true);
    expect(fiveKV2Enabled({ setting: false, devOverride: '1' })).toBe(true);
    expect(fiveKV2Enabled({ setting: true, devOverride: '0' })).toBe(false);
    expect(fiveKV2Enabled({ setting: true, devOverride: '' })).toBe(true);
    expect(generatorFlags({ setting: true, devOverride: undefined })).toEqual({ fiveKV2: true });
  });

  it('nov plan: uključen prekidač menja SAMO 5K; isključen = kao do sada', () => {
    for (const on of [false, true])
      for (const d of [10000, 21097.5, 42195, 7000])
        expect(generatorForNewPlan(d, { fiveKV2: on })).toBe(generatorForDistance(d));
    expect(generatorForNewPlan(5000, { fiveKV2: false })).toBe(FIVE_K_GENERATOR);
    expect(generatorForNewPlan(undefined, { fiveKV2: false })).toBe(FIVE_K_GENERATOR);
    expect(generatorForNewPlan(5000, { fiveKV2: true })).toBe(FIVE_K_V2_GENERATOR);
  });

  it('postojeći planovi: 5k-v1 i legacy-5k ostaju na fiveK; 5k-v2 → v2; nepoznata verzija → UNKNOWN_POLICY', () => {
    const plan = (meta: Record<string, unknown>): GenPlanState =>
      ({ weeks: [], pred: [], meta: { raceDistM: 5000, ...meta } }) as never;
    expect(generatorForPlan(plan({}))).toBe(FIVE_K_GENERATOR);
    expect(generatorForPlan(plan({ policyId: '5k-v1', policyVersion: '5k-v1.0.0' }))).toBe(
      FIVE_K_GENERATOR
    );
    expect(generatorForPlan(plan({ policyId: '5k-v2', policyVersion: '5k-v2.6.0' }))).toBe(
      FIVE_K_V2_GENERATOR
    );
    for (const version of ['5k-v2.5.0', '5k-v2.7.1', null]) {
      const p = plan({ policyId: '5k-v2', policyVersion: version });
      expect(generatorForPlan(p)).toBeNull();
      expect(unsupportedPlanReason(p)).toBe(UNKNOWN_POLICY);
    }
    // 10K/HM/maraton sa tuđom oznakom ne idu u v2.
    expect(
      generatorForPlan(plan({ raceDistM: 10000, policyId: '5k-v2', policyVersion: '5k-v2.6.0' }))
    ).toBeNull();
    expect(generatorForPlan(planOf(WITH_RESULT))).toBe(FIVE_K_V2_GENERATOR);
  });

  it('upis i faza idu kroz generator plana; v1 plan se upisuje bajt-isto kao pre (prekidač ga ne dotiče)', () => {
    const v1 = fiveK.adaptGeneratedPlan(
      fiveK.generatePlan({
        startDate: '2026-01-07',
        raceDate: '2026-04-12',
        raceDistM: 5000,
        pb: { distM: 5000, sec: 1350 },
        weeklyKm: 32,
        intensity: 'std'
      })
    )!;
    expect(JSON.stringify(stampForStorage(v1))).toBe(JSON.stringify(fiveK.stampPlan(v1)));
    const v2 = planOf(WITH_RESULT);
    expect(JSON.stringify(stampForStorage(v2))).toBe(JSON.stringify(v2));
    expect(phaseReaderFor(v2)(view(v2).weeks[2], 10)).toBe('DELOAD');
    // 08b: plan v2 se prilagođava tokom v2 (činjenice → pregled → potvrda); v1 plan kao do sada.
    expect(isFiveKV2Plan(v2)).toBe(true);
    expect(isFiveKV2Plan(v1)).toBe(false);
  });
});

describe('čuvanje: upis → učitavanje → backup → uvoz → isti plan', () => {
  for (const [name, input] of [
    ['sa rezultatom', WITH_RESULT],
    ['po osećaju', FEEL],
    ['trčanje/hodanje', RUN_WALK]
  ] as const)
    it(name, () => {
      const plan = stampForStorage(planOf(input));
      expect(isValidGenPlan(plan)).toBe(true);
      const state: PersistedState = { ...seedState(TODAY), genPlan: plan };
      // Učitavanje (migracija stanja) i backup → uvoz u prazno stanje.
      const reloaded = migrateState(JSON.parse(JSON.stringify(state)) as unknown)!;
      expect(JSON.stringify(reloaded.genPlan)).toBe(JSON.stringify(plan));
      const file = JSON.parse(
        JSON.stringify(buildBackup(reloaded, '2026-10-26T10:00:00.000Z'))
      ) as unknown;
      const imported = importBackup(file, seedState(TODAY));
      expect(imported.ok).toBe(true);
      if (!imported.ok) return;
      expect(JSON.stringify(imported.state.genPlan)).toBe(JSON.stringify(plan));
      expect(generatorForPlan(imported.state.genPlan)).toBe(FIVE_K_V2_GENERATOR);
      // Prikaz posle uvoza čita istu strukturu.
      expect(view(imported.state.genPlan!).dated.map(coreOf)).toEqual(view(plan).dated.map(coreOf));
    });
});

describe('prikaz iz strukture (Plan tab, dan)', () => {
  it('sa rezultatom: rad sa tempom, zagrevanje/hlađenje, odmor', () => {
    const days = view(planOf(WITH_RESULT)).dated;
    const q = days.find((d) => d.id === 'g4d2')!;
    expect(q.structure?.kind).toBe('Intervali');
    expect(coreOf(q)).toMatch(/^3 × 600 m @ \d:\d\d\/km$/);
    const rows = breakdownOrNull(q)!;
    expect(rows.map((r) => r[0])).toEqual(['Zagrevanje', 'Radni deo', 'Odmor', 'Hlađenje']);
    expect(rows[2]![1]).toBe('3 min kaskanje');
    const easy = days.find((d) => d.id === 'g4d6')!;
    expect(coreOf(easy)).toBe('Lagano 6.8 km'); // bez radnog dela → naslov
  });

  it('po osećaju: napor (RPE) umesto tempa, ništa izmišljeno', () => {
    const days = view(planOf(FEEL)).dated;
    const hills = days.find((d) => d.id === 'g3d4')!;
    expect(coreOf(hills)).toBe('7 × 30 s po osećaju (RPE 8)');
    const rows = breakdownOrNull(hills)!;
    expect(rows.find((r) => r[0] === 'Napor')?.[1]).toBe(
      'RPE 8 — snažno uzbrdo, kontrolisano; nazad lagano'
    );
    expect(rows.find((r) => r[0] === 'Radni deo')?.[1]).not.toMatch(/\/km/);
  });

  it('trčanje/hodanje: ritam, nivo (projekcija), napor; trka „završiti"', () => {
    const days = view(planOf(RUN_WALK)).dated.filter((d) => !d.rest);
    const first = days[0]!;
    expect(first.tag).toBe('rw');
    expect(first.km).toBeNull();
    expect(coreOf(first)).toBe('8 × (1 min trčanje / 2 min hod)');
    const rows = breakdownOrNull(first)!;
    expect(rows.map((r) => r[0])).toEqual([
      'Zagrevanje',
      'Radni deo',
      'Odmor',
      'Hlađenje',
      'Ritam',
      'Nivo',
      'Napor'
    ]);
    expect(rows.find((r) => r[0] === 'Nivo')?.[1]).toBe('L1');
    expect(breakdownOrNull(days[2]!)!.find((r) => r[0] === 'Nivo')?.[1]).toBe('L2 (projekcija)');
    const race = days[days.length - 1]!;
    expect(race.tag).toBe('trka');
    expect(coreOf(race)).toBe('5 km — cilj: završiti');
    expect(breakdownOrNull(race)!.find((r) => r[0] === 'Cilj')?.[1]).toBe('završiti');
  });
});

describe('izvoz na sat iz strukture', () => {
  const watch = (p: GenPlanState, from: string, days = 14) =>
    FIVE_K_V2_GENERATOR.workoutsForWatch(view(p), from, days, null);

  it('sa rezultatom: ponavljanja sa oporavkom, E opseg, distanca/vreme po osnovi', () => {
    const b = watch(planOf(WITH_RESULT), '2026-11-23', 6);
    const q = b.events.find((e) => e.externalId === 'sub19-g4d2')!;
    expect(q.name).toBe('I: 3 × 600 m (oporavak 180 s lagano)');
    expect(q.description).toMatch(
      /^Zagrevanje\n- [\d.]+km \d:\d\d-\d:\d\d\/km Pace\n\nRadni deo 2x\n- 600mtr \d:\d\d\/km Pace\n- Oporavak kaskanje 3m /
    );
    expect(q.description).toMatch(/\n\nPoslednja deonica\n- 600mtr \d:\d\d\/km Pace\n\nHlađenje\n/);
    expect(b.skipped).toBe(0);
  });

  it('po osećaju: dan sa delom bez brojčanog cilja se ne šalje i broji se (ne tiho)', () => {
    const b = watch(planOf(FEEL), '2026-11-16', 6);
    expect(b.events.map((e) => e.externalId)).toEqual(['sub19-g3d7']);
    expect(b.skipped).toBe(2); // lagano + ubrzanja po osećaju; usponi po osećaju
  });

  it('trčanje/hodanje: bez uobičajenog tempa ne šalje se; sa tempom šalje se ritam', () => {
    expect(watch(planOf(RUN_WALK), '2026-11-02', 6)).toEqual({ events: [], skipped: 3 });
    const b = watch(planOf({ ...RUN_WALK, typicalEasyPaceSecPerKm: 420 }), '2026-11-02', 6);
    expect(b.skipped).toBe(0);
    expect(b.events[0]!.description).toBe(
      'Hod\n- 5m 13:00-9:00/km Pace\n\nTrčanje 7x\n- 1m 7:40-7:00/km Pace\n- Pauza hod 2m 13:00-9:00/km Pace\n\nPoslednje trčanje\n- 1m 7:40-7:00/km Pace\n\nHod\n- 5m 13:00-9:00/km Pace'
    );
  });
});

describe('ugovor: (a) v2, (b) adaptacija v2 (08b), (c) sopstvena kopija procene stanja', () => {
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
  const B = [
    'classifyMeasurement',
    'recomputeVdotChain',
    'sessionClassFor',
    'currentVdot',
    'executionModel',
    'executionBasis',
    'buildExecutionAdjustment',
    'buildRunWalkAdjustment',
    'assessRunWalkProgress',
    'qualityEntryGate',
    'hasRecentMeasuredForm',
    'planWithNewGoal',
    'planRecalibrated',
    'graftFuturePlan',
    'alignAutomaticOverlays',
    'vdotProposal',
    'applyVdotProposal',
    'undoVdotAdjustments',
    'fitnessEvidence',
    'planVdotNow',
    'matchPlanRows',
    'recalibrationMinMeasurements',
    'recalibrationThreshold',
    'injuryProposal',
    'applyInjuryProposal',
    'realignPlan'
  ];
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

  it('tabela pokriva svaki član ugovora tačno jednom; nijedna funkcija nije funkcija starog 5K', () => {
    const keys = Object.keys(FIVE_K_V2_GENERATOR).sort();
    expect([...A, ...B, ...C].sort()).toEqual(keys);
    expect(Object.keys(FIVE_K_GENERATOR).sort()).toEqual(keys);
    const g = FIVE_K_V2_GENERATOR as unknown as Record<string, unknown>;
    const old = FIVE_K_GENERATOR as unknown as Record<string, unknown>;
    for (const k of keys) if (typeof g[k] === 'function') expect(g[k], k).not.toBe(old[k]);
  });

  it('(b) adaptacija/predlog (08b): kroz činjenice i adaptFiveKV2 (detalji: adapt.node.test.ts), nikad stari generator', () => {
    const g: PlanGenerator = FIVE_K_V2_GENERATOR;
    const p = planOf(WITH_RESULT);
    const today = '2026-11-20' as IsoDate;
    // Bez činjenica: pregled bez promene budućeg dela; predloga po danu (bol, tempo) nema.
    const r = g.buildExecutionAdjustment(p, today, null as never, {});
    expect('error' in r ? r.error : r.summary).toBe(
      'Prilagođavanje 2026-11-20: bez novih činjenica'
    );
    expect(g.vdotProposal({} as never)).toBeNull();
    expect(g.injuryProposal({} as never, today)).toBeNull();
    expect(g.currentVdot([])).toBeNull();
    expect(g.recalibrationMinMeasurements).toBe(Number.POSITIVE_INFINITY);
    const graft = g.graftFuturePlan(p, p, today);
    expect(graft.weeks).toEqual(p.weeks);
    expect(graft.meta?.['futureChanges']).toEqual({ changedDays: 0, conflicts: [] });
  });

  it('(c) procena stanja: iste vrednosti kao fiveK (posebna kopija)', () => {
    const p = planOf(WITH_RESULT);
    const plan = view(p);
    const log = Object.fromEntries(
      plan.dated
        .filter((d) => d.date <= '2026-11-25' && !d.rest)
        .map((d, i) => [d.id, { status: i % 4 === 3 ? 'skip' : 'done', km: (d.km ?? 0) + 0.5 }])
    );
    const ctx = { plan, log, outOfPlan: { '2026-10-28': 6, '2026-10-30': 8 } };
    const pain = [
      { date: '2026-11-20', pain: 4, part: 'koleno-L', act: 'Trčanje' },
      { date: '2026-11-22', pain: 2, part: 'stopalo-D' }
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
    const g = FIVE_K_V2_GENERATOR;
    const o = FIVE_K_GENERATOR;
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
    const day = plan.dated.find((d) => d.id === 'g4d2')!;
    const hot = { temp: 31, osecaj: 33, vlaga: 60, vetar: 5, kisa: 0 };
    const cache = {
      sati: { '2026-11-24T18': hot, '2026-11-24T07': { ...hot, osecaj: 22, temp: 21 } }
    };
    const input = {
      day,
      today: '2026-11-24',
      nowHour: 6,
      trainingHour: 18,
      cache,
      hasLocation: true,
      predPace: null,
      vdot: null
    };
    const mine = g.weatherCard(input)!;
    const theirs = o.weatherCard({
      ...input,
      day: { ...day, session: { paceSec: day.structure!.blocks[1]!.step.paceSec } }
    })!;
    expect(mine).toEqual(theirs);
    expect(mine.rows.some((r) => r.label === 'tempo uz vrućinu')).toBe(true);
  });

  it('(a) tempo/prag/napor/proizvod/procena iz v2 modela', () => {
    const g = FIVE_K_V2_GENERATOR;
    expect(g.thresholdPace(null)).toBeNull();
    expect(g.thresholdPace(45)).toMatch(/^\d:\d\d$/);
    expect(g.product(5000)).toMatchObject({ name: '5K', minWeeks: 6 });
    expect(g.product(10000)).toBeUndefined();
    const a = g.assess({ distM: 5000, sec: 1500 }, 10, 'std', 1440, 5000);
    expect(a).toMatchObject({ assessmentBasis: 'current-fitness', realno: false });
    expect(a.vdotGoal).toBe(a.vdot0); // v2 ne projektuje napredak
    const feelDay = view(planOf(FEEL)).dated.find((d) => d.id === 'g3d4')!;
    expect(g.rpeTarget(feelDay)).toEqual({
      min: 8,
      max: 8,
      txt: 'snažno uzbrdo, kontrolisano; nazad lagano'
    });
    expect(g.rpeTarget({ rest: false, tag: 'lako' })).toBeNull();
  });
});

describe('Prekidač uključen ne dira 10K/HM/maraton', () => {
  it('generator novog plana je isti objekat kao do sada', () => {
    expect(generatorForNewPlan(10000, { fiveKV2: true })).toBe(TEN_K_GENERATOR);
    expect(generatorForNewPlan(21097.5, { fiveKV2: true })).toBe(HALF_MARATHON_GENERATOR);
    expect(generatorForNewPlan(42195, { fiveKV2: true })).toBe(MARATHON_GENERATOR);
  });
});
