import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReferenceRow } from '@/test/fiveK/reference';
import {
  marathonAdaptationRows,
  marathonDecisionRows,
  marathonGenerationRows,
  loadMarathonReference
} from '@/test/marathon/reference';
import type { MarathonApi } from '@/test/marathon/scenarios';
import { regeneratorForDistance } from '../handoff';
import * as m from './index';

/* MARATON PRE/POSLE IZDVAJANJA. Referenca je uzeta iz STAROG zajedničkog mehanizma pre izdvajanja maratona
   (`src/test/fixtures/marathon-reference.json.gz`, v. `src/test/marathon/captureReference.node.test.ts`; ponovo
   snimljena u čistom worktree-ju na izvornom `main` — bajt-identična). Poredi se tačan zapis celog izlaza
   (`src/test/fiveK/exact.ts`): nijedno polje nije izostavljeno i ništa se ne zaokružuje. Kategorije samo imenuju gde je
   razlika. Opciju „kraća distanca" (polumaraton/10K) pravi izdvojeni generator te distance, predat kroz aplikacioni `handoff.ts`
   — isti put kao u produkciji (`select.ts`). */

const handoff = regeneratorForDistance as m.ShorterDistanceHandoff;

const api: MarathonApi = {
  generatePlan: m.generatePlan,
  assess: m.assess,
  adaptGeneratedPlan: m.adaptGeneratedPlan,
  resolvePlan: m.resolvePlan,
  executionModel: m.executionModel,
  buildExecutionAdjustment: ((...a: Parameters<typeof m.buildExecutionAdjustment>) =>
    m.buildExecutionAdjustment(a[0], a[1], a[2], a[3], a[4], handoff)) as never,
  buildRunWalkAdjustment: m.buildRunWalkAdjustment,
  assessRunWalkProgress: m.assessRunWalkProgress,
  qualityEntryGate: m.qualityEntryGate,
  hasRecentMeasuredForm: m.hasRecentMeasuredForm,
  planWithNewGoal: m.planWithNewGoal,
  planRecalibrated: m.planRecalibrated,
  recalibratedPlan: m.recalibratedPlan,
  reentryPlan: m.reentryPlan,
  graftFuturePlan: m.graftFuturePlan,
  alignAutomaticOverlays: m.alignAutomaticOverlays,
  vdotProposal: m.vdotProposal,
  applyVdotProposal: m.applyVdotProposal,
  undoVdotAdjustments: m.undoVdotAdjustments,
  fitnessEvidence: m.fitnessEvidence,
  planVdotNow: m.planVdotNow,
  matchPlanRows: m.matchPlanRows,
  sessKm: m.sessKm,
  sessDesc: m.sessDesc,
  t3kVdot: m.t3kVdot,
  executionBasis: m.executionBasis,
  basisFromPlan: m.basisFromPlan,
  preparationDecision: (...a: Parameters<typeof m.preparationDecision>) =>
    m.preparationDecision(a[0], a[1], a[2], a[3], a[4], a[5], handoff),
  buildPreparationChoice: (...a: Parameters<typeof m.buildPreparationChoice>) =>
    m.buildPreparationChoice(a[0], a[1], a[2], a[3], a[4], handoff),
  isLimitedLongPreparation: m.isLimitedLongPreparation
};

function compare(
  actual: Record<string, ReferenceRow>,
  expected: Record<string, ReferenceRow>
): string[] {
  const out: string[] = [];
  for (const [name, ref] of Object.entries(expected)) {
    const got = actual[name];
    if (!got) {
      out.push(`NEDOSTAJE: ${name}`);
      continue;
    }
    if (got.pure !== ref.pure)
      out.push(`${name}: čistoća ${String(got.pure)} ≠ ${String(ref.pure)}`);
    if (got.full !== ref.full) {
      const parts = Object.keys(ref.parts).filter(
        (k) => got.parts[k as keyof typeof got.parts] !== ref.parts[k as keyof typeof ref.parts]
      );
      out.push(`${name}: razlika u [${parts.join(', ') || 'redosled/oblik'}]`);
    }
  }
  for (const name of Object.keys(actual)) if (!expected[name]) out.push(`NOVO: ${name}`);
  return out;
}

const reference = loadMarathonReference();

describe('maratonski izdvojen generator = stari mehanizam (polazno stanje)', () => {
  it('referenca postoji', () => {
    expect(reference?.baselineSha).toBe('ad464c01bb3fb3e146cd27939cbe17d8a8e442e8');
    expect(reference?.crossCheckedSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
  });

  it('generisanje: svi maratonski ulazi daju identičan izlaz', { timeout: 600_000 }, () => {
    const diff = compare(marathonGenerationRows(api), reference!.generation);
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
    expect(Object.keys(reference!.generation).length).toBeGreaterThan(1500);
  });

  it(
    'adaptacija: svi tokovi daju identičan izlaz i ne menjaju ulaze',
    { timeout: 1_200_000 },
    () => {
      const rows = marathonAdaptationRows(api);
      expect(Object.keys(rows).filter((k) => k.startsWith('event · ')).length).toBe(6);
      expect(Object.keys(rows).filter((k) => k.includes(' · taper −')).length).toBeGreaterThan(500);
      const diff = compare(rows, reference!.adaptation);
      expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
      expect(Object.values(rows).every((r) => r.pure)).toBe(true);
    }
  );

  it(
    'odluke o pripremi (produženje, polumaraton/10K kroz predaju, povratni režim) su identične',
    { timeout: 900_000 },
    () => {
      const rows = marathonDecisionRows(api);
      const diff = compare(rows, reference!.decisions);
      expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
      const keys = Object.keys(rows);
      expect(
        keys.filter((k) => k.includes('"kind":"shorter","raceDistM":21097.5')).length
      ).toBeGreaterThan(50);
      expect(
        keys.filter((k) => k.includes('"kind":"shorter","raceDistM":10000')).length
      ).toBeGreaterThan(20);
      expect(keys.some((k) => k.includes('"kind":"shorter","raceDistM":5000'))).toBe(false);
      expect(keys.filter((k) => k.endsWith('base · decision')).length).toBeGreaterThan(20);
      expect(Object.values(rows).every((r) => r.pure)).toBe(true);
    }
  );

  it('vremenska zona, sat i slučajnost ne utiču na rezultat', { timeout: 900_000 }, () => {
    const tz = process.env['TZ'];
    const RealDate = Date;
    try {
      // Domen ne sme da čita sat ni slučajnost: svaki takav poziv bi ovde pao.
      vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Math.random u maratonskom generatoru');
      });
      class NoClockDate extends RealDate {
        constructor(...args: unknown[]) {
          if (args.length === 0)
            throw new Error('new Date() bez argumenta u maratonskom generatoru');
          super(...(args as [string]));
        }
        static override now(): number {
          throw new Error('Date.now u maratonskom generatoru');
        }
      }
      for (const zone of ['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC']) {
        process.env['TZ'] = zone;
        globalThis.Date = NoClockDate as DateConstructor;
        const gen = marathonGenerationRows(
          api,
          (n) => /^(edgeM|qa) /.test(n) || /^mTrack · .* · (8|14)n · /.test(n)
        );
        const adapt = marathonAdaptationRows(api, 3);
        globalThis.Date = RealDate;
        const diff = [
          ...compare(
            gen,
            Object.fromEntries(Object.keys(gen).map((k) => [k, reference!.generation[k]!]))
          ),
          ...compare(
            adapt,
            Object.fromEntries(Object.keys(adapt).map((k) => [k, reference!.adaptation[k]!]))
          )
        ];
        expect(diff, zone).toEqual([]);
        expect(Object.keys(gen).length).toBeGreaterThan(200);
        expect(Object.keys(adapt).length).toBeGreaterThan(500);
      }
    } finally {
      globalThis.Date = RealDate;
      process.env['TZ'] = tz;
      vi.restoreAllMocks();
    }
  });

  afterEach(() => vi.restoreAllMocks());
});
