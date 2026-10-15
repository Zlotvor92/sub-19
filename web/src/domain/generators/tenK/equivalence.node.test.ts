import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';
import type { ReferenceRow } from '@/test/fiveK/reference';
import { loadTenKReference, tenKAdaptationRows, tenKGenerationRows } from '@/test/tenK/reference';
import * as tenK from './index';

/* 10K PRE/POSLE IZDVAJANJA. Referenca je uzeta iz STAROG zajedničkog mehanizma pre izdvajanja 10K
   (`src/test/fixtures/tenK-reference.json.gz`, v. `src/test/tenK/captureReference.node.test.ts`; ponovo snimljena u čistom
   worktree-ju na izvornom `main` — bajt-identična). Poredi se tačan zapis celog izlaza (`src/test/fiveK/exact.ts`): nijedno
   polje nije izostavljeno i ništa se ne zaokružuje. Kategorije samo imenuju gde je razlika. */

const api: GeneratorApi = {
  generatePlan: tenK.generatePlan,
  assess: tenK.assess,
  adaptGeneratedPlan: tenK.adaptGeneratedPlan,
  resolvePlan: tenK.resolvePlan,
  executionModel: tenK.executionModel,
  buildExecutionAdjustment: tenK.buildExecutionAdjustment,
  buildRunWalkAdjustment: tenK.buildRunWalkAdjustment,
  assessRunWalkProgress: tenK.assessRunWalkProgress,
  qualityEntryGate: tenK.qualityEntryGate,
  hasRecentMeasuredForm: tenK.hasRecentMeasuredForm,
  planWithNewGoal: tenK.planWithNewGoal,
  planRecalibrated: tenK.planRecalibrated,
  recalibratedPlan: tenK.recalibratedPlan,
  reentryPlan: tenK.reentryPlan,
  graftFuturePlan: tenK.graftFuturePlan,
  alignAutomaticOverlays: tenK.alignAutomaticOverlays,
  vdotProposal: tenK.vdotProposal,
  applyVdotProposal: tenK.applyVdotProposal,
  undoVdotAdjustments: tenK.undoVdotAdjustments,
  fitnessEvidence: tenK.fitnessEvidence,
  planVdotNow: tenK.planVdotNow,
  matchPlanRows: tenK.matchPlanRows,
  sessKm: tenK.sessKm,
  sessDesc: tenK.sessDesc,
  t3kVdot: tenK.t3kVdot
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

const reference = loadTenKReference();

describe('10K izdvojen generator = stari mehanizam (polazno stanje)', () => {
  it('referenca postoji', () => {
    expect(reference?.baselineSha).toBe('f745be0e3f11d0382ee62879dcd24c57e9175683');
    expect(reference?.crossCheckedSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
  });

  it('generisanje: svi 10K ulazi daju identičan izlaz', () => {
    const diff = compare(tenKGenerationRows(api), reference!.generation);
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
    expect(Object.keys(reference!.generation).length).toBeGreaterThan(1000);
  });

  it('adaptacija: svi tokovi daju identičan izlaz i ne menjaju ulaze', { timeout: 600_000 }, () => {
    const rows = tenKAdaptationRows(api);
    expect(Object.keys(rows).filter((k) => k.startsWith('event · ')).length).toBe(9);
    const diff = compare(rows, reference!.adaptation);
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
    expect(Object.values(rows).every((r) => r.pure)).toBe(true);
  });

  it('vremenska zona, sat i slučajnost ne utiču na rezultat', { timeout: 600_000 }, () => {
    const tz = process.env['TZ'];
    const RealDate = Date;
    try {
      // Domen ne sme da čita sat ni slučajnost: svaki takav poziv bi ovde pao.
      vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Math.random u 10K generatoru');
      });
      class NoClockDate extends RealDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) throw new Error('new Date() bez argumenta u 10K generatoru');
          super(...(args as [string]));
        }
        static override now(): number {
          throw new Error('Date.now u 10K generatoru');
        }
      }
      for (const zone of ['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC']) {
        process.env['TZ'] = zone;
        globalThis.Date = NoClockDate as DateConstructor;
        const gen = tenKGenerationRows(api, (n) => /^(edge10k|qa) /.test(n) || /· 8n$/.test(n));
        const adapt = tenKAdaptationRows(api, 3);
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
        expect(Object.keys(gen).length).toBeGreaterThan(100);
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
