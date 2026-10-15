import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as hm from '../domain/generators/halfMarathon';
import * as fiveK from '../domain/generators/fiveK';
import { UNSUPPORTED_DISTANCE } from '../domain/generators/select';
import { resolvePlan } from '../domain/plan';
import { personalBaselineVdot, personalPlan } from '../domain/personal';
import { seedState, type PersistedState } from '../domain/state';
import { ADMIN_UID } from '../services/config';
import { activeGenPlan, hydratePersisted, useTrainingStore } from '../stores';
import { currentPlan } from '../stores/trainingStore';
import { useAuthStore } from '../stores/authStore';
import {
  executionModel,
  positiveAdjustmentBlock,
  previewExecution,
  replanContext,
  runWalkModel
} from '../stores/executionActions';
import { currentVdotProposal, undoAdjustments } from '../stores/raceActions';
import { useUIStore } from '../stores/uiStore';
import { AdjustPlan } from './plan/AdjustPlan';

/* SEGMENT 5/5 — APLIKACIONE PUTANJE BEZ STAROG MEHANIZMA.
   1. Ugrađeni lični plan vlasnika (u store-u `genPlan === null`) do segmenta 5 je išao STAROM mehanizmu. Sada store-ovi
      biraju generator po aktivnom planu (polumaraton → HM). Brojač poziva starog mehanizma mora ostati 0, a rezultati
      jednaki direktnom pozivu HM generatora (jednakost sa starim mehanizmom: `personalPlan.node.test.ts`).
   2. Plan bez podržane distance: ekran „Prilagodi plan" eksplicitno kaže da ga nijedan generator ne prilagođava. */

const { legacyCalls, spyModule } = vi.hoisted(() => {
  const legacyCalls: string[] = [];
  const spyModule =
    (name: string) =>
    async (
      importOriginal: () => Promise<Record<string, unknown>>
    ): Promise<Record<string, unknown>> => {
      const mod = await importOriginal();
      return Object.fromEntries(
        Object.entries(mod).map(([k, v]) => [
          k,
          typeof v === 'function'
            ? (...args: unknown[]) => {
                legacyCalls.push(`${name}.${k}`);
                return (v as (...a: unknown[]) => unknown)(...args);
              }
            : v
        ])
      );
    };
  return { legacyCalls, spyModule };
});
vi.mock('../domain/training/generator/generatePlan', spyModule('generatePlan'));
vi.mock('../domain/training/generator/assess', spyModule('assess'));
vi.mock('../domain/plan/future', spyModule('future'));
vi.mock('../domain/plan/regenerate', spyModule('regenerate'));
vi.mock('../domain/plan/executionAdjustment', spyModule('executionAdjustment'));
vi.mock('../domain/plan/replan', spyModule('replan'));
vi.mock('../domain/plan/runWalkAdjustment', spyModule('runWalkAdjustment'));
vi.mock('../domain/training/runWalkProgress', spyModule('runWalkProgress'));
vi.mock('../domain/training/qualityGate', spyModule('qualityGate'));
vi.mock('../domain/training/adaptation/evidence', spyModule('evidence'));
vi.mock('../domain/plan/preparationDecision', spyModule('preparationDecision'));

const TODAY = '2026-10-21';
const blank = (): PersistedState => JSON.parse(JSON.stringify(seedState())) as PersistedState;

beforeEach(() => {
  legacyCalls.length = 0;
  hydratePersisted(blank());
  useAuthStore.setState({ configured: true, hasSession: true, userId: ADMIN_UID, email: null });
  useUIStore.setState({ wizard: false, confirm: null, today: TODAY });
});

describe('ugrađeni lični plan ide HM generatoru', () => {
  it('model izvršenja, run/walk, kapija i predlog tempa bez starog mehanizma, isto kao HM', () => {
    expect(useTrainingStore.getState().genPlan).toBeNull();
    const active = activeGenPlan()!;
    expect(active).toBe(personalPlan(personalBaselineVdot({})));
    const plan = currentPlan()!;
    const model = executionModel(plan, TODAY);
    expect(model).toEqual(hm.executionModel(plan, TODAY, replanContext(), {}));
    expect(runWalkModel(plan, TODAY)).toEqual(
      hm.assessRunWalkProgress({ plan, log: {}, today: TODAY, recentPainMax: null })
    );
    expect(positiveAdjustmentBlock(plan, TODAY)).toBeNull();
    expect(currentVdotProposal(plan, TODAY)).toBeNull(); // svi PRED redovi ličnog plana su `nemeri`
    expect(undoAdjustments(plan)).toBe(0);
    expect(legacyCalls).toEqual([]);
  });

  it('ekran „Prilagodi plan" nad ličnim planom ne poziva stari mehanizam', () => {
    render(<AdjustPlan />);
    expect(screen.getByRole('heading', { name: 'Prilagodi plan' })).toBeInTheDocument();
    expect(screen.queryByText(UNSUPPORTED_DISTANCE)).toBeNull();
    expect(legacyCalls).toEqual([]);
  });
});

describe('plan bez podržane distance', () => {
  it('„Prilagodi plan" to eksplicitno prikazuje; prilagođavanje se odbija bez starog mehanizma', () => {
    const gen = fiveK.generatePlan({
      startDate: '2026-10-05',
      raceDate: '2026-12-13',
      raceDistM: 5000,
      pb: { distM: 5000, sec: 1350 },
      weeklyKm: 30,
      runDays: 4,
      quality: 2,
      intensity: 'std'
    } as never);
    const plan = fiveK.adaptGeneratedPlan(gen)!;
    useTrainingStore.getState().patch({
      genPlan: { ...plan, meta: { ...plan.meta!, raceDistM: 7000 }, ulaz: { raceDistM: 7000 } }
    });
    render(<AdjustPlan />);
    expect(screen.getAllByText(UNSUPPORTED_DISTANCE).length).toBeGreaterThan(0);
    const view = resolvePlan(useTrainingStore.getState().genPlan!.weeks, replanContext());
    expect(previewExecution(view, TODAY, {})).toEqual({ ok: false, reason: UNSUPPORTED_DISTANCE });
    expect(currentVdotProposal(view, TODAY)).toBeNull();
    expect(legacyCalls).toEqual([]);
  });
});
