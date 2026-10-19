import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generatorFlags } from '@/domain/generators/flags';
import {
  fiveKV2AdaptPreview,
  fiveKV2Start,
  generateFiveKV2Plan,
  generateHmV2Plan,
  generateTenKV2Plan,
  generatorForNewPlan,
  generatorForPlan,
  hmV2AdaptPreview,
  hmV2Start,
  phaseReaderFor,
  planPolicyOf,
  preparationForPlan,
  stampForStorage,
  tenKV2AdaptPreview,
  tenKV2Start,
  type GeneratorFlags,
  type PlanGenerator
} from '@/domain/generators/select';
import { initialWizard, toGenerationInput, type WizardState } from '@/domain/onboarding';
import { personalPlan } from '@/domain/personal';
import { resolvePlan } from '@/domain/plan';
import type { GenPlanState } from '@/domain/state';

/* MARATON v2 SEGMENT MAR-05 — BAJT-ISTO UZ ISKLJUČEN PREKIDAČ MARATONA v2. Isti tokovi kroz aplikacioni izbor
   generatora (čarobnjak → generator nove distance → upis → razrešen plan → faza, politika, sat, napor dana, promena
   cilja, izvršenje, prilagođavanje, odluka o pripremi HM/maratona, procena stanja) za 5K v1, 10K v1, polumaraton v1,
   maraton v1, 5K v2, 10K v2 i HM v2 (sa pregledom prilagođavanja) i ugrađeni lični plan vlasnika. Snimak = SHA-256
   JSON-a svakog koraka; poredi se sa snimkom napravljenim na 9443676 (pre segmenta MAR-05). Ponovno snimanje (samo na
   kodu PRE izmene): BYTE_SAME_RECORD=1. Obrazac `halfMarathon/v2/app/byteSame.node.test.ts` (HM-05, kopija). */

const FIXTURE = fileURLToPath(new URL('./byteSame.9443676.json', import.meta.url));
const TODAY = '2026-11-02';
const sha = (x: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(x) ?? 'undefined')
    .digest('hex');
const OFF = generatorFlags({ setting: undefined, devOverride: undefined });

const wizard = (p: Partial<WizardState>): WizardState => ({ ...initialWizard(), ...p });
const V1: ReadonlyArray<[string, WizardState]> = [
  [
    '5K 4d',
    wizard({
      raceDist: 5000,
      raceDate: '2027-01-24',
      pbDist: 5000,
      pbMin: '22',
      pbSec: '30',
      weeklyKm: '35',
      runDays: 4,
      runDows: [2, 4, 6, 7],
      goalMin: '21',
      goalSec: '30'
    })
  ],
  [
    '5K 3d početnik',
    wizard({
      raceDist: 5000,
      raceDate: '2027-02-07',
      pbDist: 5000,
      pbMin: '29',
      pbSec: '0',
      weeklyKm: '15',
      runDays: 3,
      runDows: [2, 4, 7],
      trainedRecently: false
    })
  ],
  [
    '10K 4d',
    wizard({
      raceDist: 10000,
      raceDate: '2027-02-07',
      pbDist: 10000,
      pbMin: '45',
      pbSec: '0',
      weeklyKm: '40',
      runDays: 4,
      runDows: [2, 4, 6, 7],
      goalMin: '43',
      goalSec: '0'
    })
  ],
  [
    '10K 3d',
    wizard({
      raceDist: 10000,
      raceDate: '2027-01-17',
      pbDist: 10000,
      pbMin: '58',
      pbSec: '0',
      weeklyKm: '22',
      runDays: 3,
      runDows: [2, 4, 7],
      quality: 1
    })
  ],
  [
    'HM 5d',
    wizard({
      raceDist: 21097.5,
      raceDate: '2027-04-04',
      pbDist: 10000,
      pbMin: '46',
      pbSec: '0',
      weeklyKm: '45',
      runDays: 5,
      runDows: [1, 2, 4, 6, 7],
      goalH: '1',
      goalMin: '42',
      goalSec: '0'
    })
  ],
  [
    'HM 4d',
    wizard({
      raceDist: 21097.5,
      raceDate: '2027-02-28',
      pbDist: 5000,
      pbMin: '24',
      pbSec: '0',
      weeklyKm: '32',
      runDays: 4,
      runDows: [2, 4, 6, 7],
      intensity: 'agr'
    })
  ],
  [
    'HM 3d početnik',
    wizard({
      raceDist: 21097.5,
      raceDate: '2027-03-21',
      pbDist: 10000,
      pbMin: '62',
      pbSec: '0',
      weeklyKm: '20',
      runDays: 3,
      runDows: [2, 4, 7],
      trainedRecently: false
    })
  ],
  [
    'maraton 4d',
    wizard({
      raceDist: 42195,
      raceDate: '2027-04-18',
      pbDist: 10000,
      pbMin: '44',
      pbSec: '0',
      weeklyKm: '45',
      runDays: 4,
      runDows: [2, 4, 6, 7],
      goalH: '3',
      goalMin: '30',
      goalSec: '0'
    })
  ],
  [
    'maraton',
    wizard({
      raceDist: 42195,
      raceDate: '2027-05-02',
      pbDist: 21097.5,
      pbH: '1',
      pbMin: '40',
      pbSec: '0',
      weeklyKm: '60',
      runDays: 5,
      runDows: [1, 2, 4, 6, 7]
    })
  ]
];

const V2_5K = [
  {
    raceDate: '2027-01-24',
    runDays: ['tue', 'thu', 'sat', 'sun'],
    currentWeeklyKm: 30,
    recentResult: { distanceM: 5000, timeSec: 1350, date: '2026-10-10' },
    goalTimeSec: 1290,
    experience: 'regular'
  },
  {
    raceDate: '2027-01-24',
    runDays: ['tue', 'thu', 'sun'],
    currentWeeklyKm: 15,
    typicalEasyPaceSecPerKm: 420,
    experience: 'beginner',
    canRun30Min: true
  }
] as const;

const V2_10K = [
  {
    raceDate: '2027-01-24',
    runDays: ['tue', 'thu', 'sat', 'sun'],
    currentWeeklyKm: 40,
    recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-10-10' },
    goalTimeSec: 2580
  },
  {
    raceDate: '2027-01-24',
    runDays: ['tue', 'thu', 'sun'],
    currentWeeklyKm: 25,
    easyPaceSecPerKm: 390
  }
] as const;

function flows(g: PlanGenerator, stored: GenPlanState, label: string): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: unknown): void => {
    out[`${label} · ${k}`] = sha(v);
  };
  put('plan', stored);
  put('generator', [g.id, g.policyId, g.policyVersion, g.legacyPolicyId]);
  put('policy', planPolicyOf(stored));
  const resolved = resolvePlan(stored.weeks, { alts: {}, moves: {} });
  const phase = phaseReaderFor(stored);
  put(
    'faze',
    resolved.weeks.map((w) => phase(w, resolved.weeks.length))
  );
  const start = resolved.weeks[0]?.start ?? TODAY;
  const mid = resolved.weeks[Math.floor(resolved.weeks.length / 2)]?.start ?? TODAY;
  const vdot = typeof stored.meta?.vdot0 === 'number' ? stored.meta.vdot0 : null;
  put('sat', g.workoutsForWatch(resolved, start, 21, vdot));
  put(
    'napor',
    resolved.dated.map((d) => g.rpeTarget(d))
  );
  put('prag', g.thresholdPace(vdot));
  const goal = typeof stored.meta?.goalSec === 'number' ? stored.meta.goalSec : null;
  if (goal)
    put(
      'cilj',
      g.planWithNewGoal(stored, goal - 30, mid as never, { log: {}, alts: {}, moves: {} })
    );
  const log = Object.fromEntries(
    resolved.dated
      .filter((d) => !d.rest && d.date < mid)
      .map((d, i) => [
        d.id,
        i % 4 === 3 ? { status: 'skip' } : { status: 'done', km: (d.km ?? 5) * 0.8 }
      ])
  );
  const ctx = { log, alts: {}, moves: {} };
  const ex = g.executionModel(resolved, mid, ctx);
  put('izvršenje', ex);
  put(
    'prilagođavanje',
    g.buildExecutionAdjustment(stored, mid as never, ex.analysis, { weeklyKm: 30 }, ctx)
  );
  const prep = preparationForPlan(stored);
  put(
    'priprema',
    prep
      ? [prep.basisFromPlan(stored, mid as never), prep.isLimitedLongPreparation(stored.meta)]
      : null
  );
  put('bol', g.painStatus([{ date: mid, level: 4, part: 'koleno-L' }] as never, mid as never));
  put('opterećenje', g.acwrNow({ plan: resolved, log, outOfPlan: {} }, mid as never));
  return out;
}

const V2_HM = [
  {
    raceDate: '2027-02-28',
    runDays: ['tue', 'thu', 'sat', 'sun'],
    currentWeeklyKm: 40,
    recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-10-10' },
    goalTimeSec: 6000
  },
  {
    raceDate: '2027-02-28',
    runDays: ['tue', 'thu', 'sun'],
    currentWeeklyKm: 30,
    easyPaceSecPerKm: 390
  }
] as const;

function snapshot(flags: GeneratorFlags = OFF, skipMarathon = false): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, w] of V1) {
    if (skipMarathon && w.raceDist === 42195) continue;
    const input = toGenerationInput(w, TODAY)!;
    const g = generatorForNewPlan(input.raceDistM, flags)!;
    const gen = g.generatePlan(input);
    out[`${name} · generisanje`] = sha(gen);
    if ('error' in gen) throw new Error(`${name}: ${gen.error}`);
    const adapted = g.adaptGeneratedPlan(gen)!;
    adapted.ulaz = JSON.parse(JSON.stringify(input)) as unknown;
    const stored = stampForStorage(adapted);
    Object.assign(out, flows(generatorForPlan(stored)!, stored, name));
  }
  const on5 = generatorFlags({ setting: true, devOverride: undefined });
  out['5K v2 · izbor'] = sha([
    generatorForNewPlan(5000, on5)?.policyId,
    generatorForNewPlan(10000, on5)?.policyId,
    generatorForNewPlan(21097.5, on5)?.policyId
  ]);
  out['v2 · izbor'] = sha(
    [5000, 10000, 21097.5].map(
      (d) => generatorForNewPlan(d, { ...flags, fiveKV2: true, tenKV2: true, hmV2: true })?.policyId
    )
  );
  V2_5K.forEach((input, i) => {
    const r = generateFiveKV2Plan({
      ...input,
      startDate: fiveKV2Start(input.raceDate, TODAY)!
    } as never);
    out[`5K v2 #${i} · generisanje`] = sha(r);
    if (!r.ok) throw new Error(`5K v2 #${i}: ${r.reasons.map((x) => x.message).join(' ')}`);
    const stored = stampForStorage(r.plan);
    Object.assign(out, flows(generatorForPlan(stored)!, stored, `5K v2 #${i}`));
    out[`5K v2 #${i} · adaptacija`] = sha(fiveKV2AdaptPreview(stored, '2026-12-01' as never, {}));
  });
  V2_10K.forEach((input, i) => {
    const r = generateTenKV2Plan({
      ...input,
      startDate: tenKV2Start(input.raceDate, TODAY)!
    } as never);
    out[`10K v2 #${i} · generisanje`] = sha(r);
    if (!r.ok) throw new Error(`10K v2 #${i}: ${r.reasons.map((x) => x.message).join(' ')}`);
    const stored = stampForStorage(r.plan);
    Object.assign(out, flows(generatorForPlan(stored)!, stored, `10K v2 #${i}`));
    out[`10K v2 #${i} · adaptacija`] = sha(tenKV2AdaptPreview(stored, '2026-12-01' as never, {}));
  });
  V2_HM.forEach((input, i) => {
    const r = generateHmV2Plan({
      ...input,
      startDate: hmV2Start(input.raceDate, TODAY)!
    } as never);
    out[`HM v2 #${i} · generisanje`] = sha(r);
    if (!r.ok) throw new Error(`HM v2 #${i}: ${r.reasons.map((x) => x.message).join(' ')}`);
    const stored = stampForStorage(r.plan);
    Object.assign(out, flows(generatorForPlan(stored)!, stored, `HM v2 #${i}`));
    out[`HM v2 #${i} · adaptacija`] = sha(hmV2AdaptPreview(stored, '2026-12-01' as never, {}));
  });
  const personal = personalPlan(48);
  Object.assign(out, flows(generatorForPlan(personal)!, personal, 'lični plan'));
  return out;
}

describe('bajt-isto prema 9443676 (prekidač maratona v2 isključen)', () => {
  it(
    'snimak tokova 5K v1/v2, 10K v1/v2, HM v1/v2, maratona v1 i ličnog plana je isti',
    { timeout: 300_000 },
    () => {
      const now = snapshot();
      if (process.env['BYTE_SAME_RECORD'] === '1') {
        writeFileSync(FIXTURE, `${JSON.stringify(now, null, 2)}\n`);
        return;
      }
      expect(existsSync(FIXTURE)).toBe(true);
      const before = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, string>;
      expect(Object.keys(now).length).toBeGreaterThanOrEqual(200);
      expect(now).toEqual(before);
    }
  );

  it(
    'uključen prekidač maratona v2 ne menja 5K, 10K, HM (v1 i v2) ni lični plan (menja se samo nov maraton)',
    { timeout: 300_000 },
    () => {
      const before = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, string>;
      const ON: GeneratorFlags = { ...OFF, marathonV2: true };
      const on = snapshot(ON, true);
      const others = Object.keys(before).filter((k) => !k.startsWith('maraton'));
      expect(others.length).toBeGreaterThanOrEqual(180);
      expect(Object.keys(on).sort()).toEqual(others.sort());
      for (const k of others) expect(on[k], k).toBe(before[k]);
      // Nov maraton ide u v2 samo uz uključen prekidač maratona.
      expect(generatorForNewPlan(42195, ON)?.policyId).toBe('marathon-v2');
      expect(generatorForNewPlan(42195, OFF)?.policyId).toBe('marathon-v1');
      expect(
        generatorForNewPlan(42195, { fiveKV2: true, tenKV2: true, hmV2: true })?.policyId
      ).toBe('marathon-v1');
    }
  );
});
