import { describe, expect, it } from 'vitest';
import { personalPlan } from '../personal';
import type { ReferenceRow } from '@/test/fiveK/reference';
import type { GeneratorApi } from '@/test/fiveK/legacyApi';
import { loadPersonalReference, personalRows } from '@/test/personal/reference';
import { regeneratorForDistance } from './handoff';
import * as hm from './halfMarathon';
import { HALF_MARATHON_GENERATOR, generatorForPlan } from './select';

/* UGRAĐENI LIČNI PLAN → HM GENERATOR (segment 5/5).

   Lični plan vlasnika je polumaraton (`meta.raceDistM` 21097,5), ali se u store-u čuva kao `genPlan === null`, pa ga je
   aplikacija do segmenta 5 slala STAROM mehanizmu. Sada se generator bira po aktivnom planu i lični plan ide HM
   generatoru. Ovaj test dokazuje da to ne menja ponašanje: tokovi nad ličnim planom (v. `src/test/personal/scenarios.ts`)
   daju tačno isti zapis kao stari mehanizam (`src/test/fixtures/personal-reference.json.gz`, snimljeno na `348391c`,
   ponovo u čistom worktree-ju na izvornom `main` `05088e0` — bajt-identično). Nijedno polje nije izostavljeno. */

const handoff = regeneratorForDistance;
const api: GeneratorApi = {
  generatePlan: hm.generatePlan,
  assess: hm.assess,
  adaptGeneratedPlan: hm.adaptGeneratedPlan,
  resolvePlan: hm.resolvePlan,
  executionModel: hm.executionModel,
  buildExecutionAdjustment: ((...a: Parameters<typeof hm.buildExecutionAdjustment>) =>
    hm.buildExecutionAdjustment(a[0], a[1], a[2], a[3], a[4], handoff)) as never,
  buildRunWalkAdjustment: hm.buildRunWalkAdjustment,
  assessRunWalkProgress: hm.assessRunWalkProgress,
  qualityEntryGate: hm.qualityEntryGate,
  hasRecentMeasuredForm: hm.hasRecentMeasuredForm,
  planWithNewGoal: hm.planWithNewGoal,
  planRecalibrated: hm.planRecalibrated,
  recalibratedPlan: hm.recalibratedPlan,
  reentryPlan: hm.reentryPlan,
  graftFuturePlan: hm.graftFuturePlan,
  alignAutomaticOverlays: hm.alignAutomaticOverlays,
  vdotProposal: hm.vdotProposal,
  applyVdotProposal: hm.applyVdotProposal,
  undoVdotAdjustments: hm.undoVdotAdjustments,
  fitnessEvidence: hm.fitnessEvidence,
  planVdotNow: hm.planVdotNow,
  matchPlanRows: hm.matchPlanRows,
  sessKm: hm.sessKm,
  sessDesc: hm.sessDesc,
  t3kVdot: hm.t3kVdot
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
    if (got.pure !== ref.pure) out.push(`${name}: čistoća`);
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

describe('ugrađeni lični plan ide HM generatoru bez promene ponašanja', () => {
  it('aktivni lični plan bira HM generator', () => {
    expect(generatorForPlan(personalPlan(48))).toBe(HALF_MARATHON_GENERATOR);
  });

  it('referenca postoji i uzeta je iz starog mehanizma', () => {
    const ref = loadPersonalReference();
    expect(ref?.baselineSha).toBe('348391c6f81f8ee62b73b06379c9b563cf75394e');
    expect(ref?.crossCheckedSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
    expect(Object.keys(ref?.flows ?? {}).length).toBe(13782);
  });

  it('HM generator nad ličnim planom = stari mehanizam (tačan zapis)', { timeout: 600_000 }, () => {
    const ref = loadPersonalReference()!;
    const actual = personalRows(api);
    expect(compare(actual, ref.flows)).toEqual([]);
    // Primena/poništavanje predloga je zaista pokrivena (sintetička „merljiva" varijanta).
    expect(Object.keys(actual).filter((n) => n.endsWith('· apply')).length).toBeGreaterThan(50);
  });
});
