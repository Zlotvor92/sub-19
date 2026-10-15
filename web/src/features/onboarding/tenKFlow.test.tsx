import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmHost } from '../../components/ui/ConfirmHost';
import * as tenK from '../../domain/generators/tenK';
import { resolvePlan } from '../../domain/plan';
import { getPlanRevisions } from '../../domain/plan/versions';
import { seedState, type PersistedState } from '../../domain/state';
import { createKeyValueStore } from '../../services/storage/kv';
import { createStateSaver, loadState } from '../../services/storage/stateStorage';
import { collectPersisted, hydratePersisted, useTrainingStore } from '../../stores';
import {
  commitPlanChange,
  executionModel,
  previewExecution,
  previewRestore,
  replanContext
} from '../../stores/executionActions';
import { useUIStore } from '../../stores/uiStore';
import { UNSUPPORTED_DISTANCE } from '../../domain/generators/select';
import { changeGoalTime } from '../plan/planActions';
import PlanPage from '../plan/index';
import { Wizard } from './Wizard';

/* STVARNI 10K TOK: izbor 10K u čarobnjaku → generisanje → prikaz → čuvanje → učitavanje → adaptacija (povratak posle
   pauze) → vraćanje verzije → promena cilja. Stari zajednički mehanizam je ovde obmotan brojačem poziva: za 10K plan ne sme
   biti pozvan nijednom (dokaz da store-ovi i ekrani zaista idu kroz izdvojeni 10K generator, a ne samo da daju isti
   rezultat). Isti postupak kao `fiveKFlow.test.tsx`. */

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
vi.mock('../../domain/training/generator/generatePlan', spyModule('generatePlan'));
vi.mock('../../domain/training/generator/assess', spyModule('assess'));
vi.mock('../../domain/plan/future', spyModule('future'));
vi.mock('../../domain/plan/regenerate', spyModule('regenerate'));
vi.mock('../../domain/plan/executionAdjustment', spyModule('executionAdjustment'));
vi.mock('../../domain/plan/replan', spyModule('replan'));
vi.mock('../../domain/plan/runWalkAdjustment', spyModule('runWalkAdjustment'));
vi.mock('../../domain/training/runWalkProgress', spyModule('runWalkProgress'));
vi.mock('../../domain/training/qualityGate', spyModule('qualityGate'));
vi.mock('../../domain/training/adaptation/proposal', spyModule('proposal'));

const TODAY = '2026-01-07';
const LATER = '2026-02-11';
const blank = (): PersistedState => JSON.parse(JSON.stringify(seedState())) as PersistedState;

beforeEach(() => {
  legacyCalls.length = 0;
  hydratePersisted(blank());
  useUIStore.setState({ wizard: false, confirm: null, today: TODAY });
});
afterEach(() => {
  legacyCalls.length = 0;
});

describe('10K: unos → generisanje → prikaz → čuvanje → učitavanje → adaptacija', () => {
  it('ceo tok ide kroz izdvojeni 10K generator i čuva istoriju', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <>
        <Wizard today={TODAY} />
        <ConfirmHost />
      </>
    );
    await user.click(
      within(screen.getByRole('group', { name: 'Ciljna distanca' })).getByRole('button', {
        name: '10K'
      })
    );
    await user.type(screen.getByLabelText('Datum trke'), '2026-04-12');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await user.type(screen.getByLabelText('minuti'), '22');
    await user.type(screen.getByLabelText('sekunde'), '30');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await user.type(screen.getByLabelText('Nedeljna kilometraža'), '32');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    unmount();

    // Generisanje: identično direktnom pozivu 10K generatora sa sačuvanim ulazom.
    const saved = collectPersisted();
    const input = saved.genPlan!.ulaz as Parameters<typeof tenK.generatePlan>[0];
    expect(input.raceDistM).toBe(10000);
    const direct = tenK.adaptGeneratedPlan(
      tenK.generatePlan(JSON.parse(JSON.stringify(input)) as typeof input)
    );
    expect(JSON.stringify({ ...direct, ulaz: input })).toBe(JSON.stringify(saved.genPlan));
    expect(saved.genPlan!.meta!.raceName).toBe('10K');

    // Prikaz.
    render(<PlanPage />);
    expect(screen.getAllByText(/km/).length).toBeGreaterThan(0);

    // Čuvanje i učitavanje kroz pravo skladište stanja.
    const kv = createKeyValueStore();
    createStateSaver({ kv }).save(saved);
    const loaded = loadState(kv, TODAY);
    expect(loaded.loadFailure).toBeNull();
    hydratePersisted(loaded.state);
    expect(JSON.stringify(collectPersisted().genPlan)).toBe(JSON.stringify(saved.genPlan));

    // Istorija: odrađeni dani, stvarna merenja, pomeren dan, ručna izmena, zaključan red.
    useUIStore.setState({ today: LATER });
    const t = useTrainingStore.getState();
    const view = resolvePlan(t.genPlan!.weeks, { alts: {}, moves: {} });
    const past = view.dated.filter((d) => d.date <= LATER && !d.rest && (d.km ?? 0) > 0);
    const log: Record<string, Record<string, unknown>> = {};
    for (const d of past)
      log[d.id] = { status: 'done', km: (d.km ?? 0) + 0.3, sec: 1800, runDate: d.date, rpe: 4 };
    const future = view.dated.filter((d) => d.date > LATER && !d.rest && (d.km ?? 0) > 0);
    const futureDone = future[0]!;
    log[futureDone.id] = { status: 'done', km: 5.5, sec: 1900, runDate: LATER, rpe: 5 };
    const manual = future.find((d) => d.tag === 'lako' && d !== futureDone)!;
    const moved = future.find((d) => d !== futureDone && d !== manual)!;
    const lockedDay = future.find(
      (d) => d.session && d !== futureDone && d !== manual && d !== moved
    )!;
    const rows = tenK.matchPlanRows(view.weeks, t.genPlan!.pred as never);
    const lockedRow = rows.get(lockedDay.id)!;
    t.patch({
      log: log,
      alts: {
        [manual.id]: {
          tag: 'lako',
          km: 4.4,
          desc: 'moja izmena',
          pace: null,
          rw: null,
          paceAuto: false
        }
      } as never,
      moves: { [moved.id]: past.at(-1)!.date },
      pred: { [lockedRow.id]: lockedRow.pt },
      predLock: { [lockedRow.id]: true }
    });
    const historyBefore = JSON.stringify({
      log: useTrainingStore.getState().log,
      alts: useTrainingStore.getState().alts,
      moves: useTrainingStore.getState().moves,
      pred: useTrainingStore.getState().pred,
      predLock: useTrainingStore.getState().predLock
    });
    const before = useTrainingStore.getState().genPlan!;
    legacyCalls.length = 0;

    // Adaptacija: povratak posle potvrđene pauze, pregled pa upis.
    const resolved = resolvePlan(before.weeks, replanContext());
    const p = previewExecution(resolved, LATER, {
      breakDays: 14,
      weeklyKm: 25,
      recentLongRunKm: 8
    });
    expect(p.ok, p.ok ? '' : p.reason).toBe(true);
    if (!p.ok) return;
    const expected = tenK.buildExecutionAdjustment(
      before,
      LATER as never,
      executionModel(resolved, LATER).analysis,
      { breakDays: 14, weeklyKm: 25, recentLongRunKm: 8 },
      replanContext()
    );
    expect('error' in expected).toBe(false);
    if ('error' in expected) return;
    expect(JSON.stringify(p.result)).toBe(JSON.stringify(expected.result));
    expect(commitPlanChange(p)).toEqual({ ok: true });

    const after = useTrainingStore.getState();
    const oldDays = new Map(before.weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
    const newDays = new Map(after.genPlan!.weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
    // Zaštićeno: prošlost, budući odrađen, ručno izmenjen, pomeren u prošlost, zaključan merenjem.
    for (const d of [...past, futureDone, manual, moved, lockedDay])
      expect(JSON.stringify(newDays.get(d.id)), d.id).toBe(JSON.stringify(oldDays.get(d.id)));
    expect(after.genPlan!.pred.some((r) => JSON.stringify(r) === JSON.stringify(lockedRow))).toBe(
      true
    );
    expect(
      JSON.stringify({
        log: after.log,
        alts: after.alts,
        moves: after.moves,
        pred: after.pred,
        predLock: after.predLock
      })
    ).toBe(historyBefore);
    expect(after.genPlan!.meta!['executionAdjustment']).toMatchObject({ breakDays: 14 });
    expect(after.genPlan!.meta!.dayWarnings.some((w) => w.includes('Ručno izmenjen trening'))).toBe(
      true
    );
    expect(getPlanRevisions(after.genPlan!).length).toBeGreaterThan(0);

    // Vraćanje prethodne verzije: samo nezaštićeni budući dani.
    const revision = getPlanRevisions(after.genPlan!)[0]!;
    const r = previewRestore(revision.id, LATER);
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    if (r.ok) {
      expect(commitPlanChange(r)).toEqual({ ok: true });
      const restored = new Map(
        useTrainingStore
          .getState()
          .genPlan!.weeks.flatMap((w) => w.days)
          .map((d) => [d.id, d])
      );
      for (const d of [...past, futureDone, manual, moved, lockedDay])
        expect(JSON.stringify(restored.get(d.id)), d.id).toBe(JSON.stringify(oldDays.get(d.id)));
    }

    // Promena cilja kroz radnju ekrana (pitanje → „Da" → upis).
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const goalBase = useTrainingStore.getState().genPlan!;
    const expectedGoal = tenK.planWithNewGoal(goalBase, 2700, LATER as never, replanContext());
    expect('error' in expectedGoal && expectedGoal.error).toBeFalsy();
    const host = render(<ConfirmHost />);
    const changing = changeGoalTime(goalBase, '45:00', LATER);
    await user.click(await screen.findByRole('button', { name: 'Da' }));
    expect(await changing).toBe(true);
    host.unmount();
    alert.mockRestore();
    const goalPlan = useTrainingStore.getState().genPlan!;
    expect(goalPlan.meta!.goalSec).toBe(2700);
    const { goalChange: _g, ...expectedPlan } = expectedGoal as {
      goalChange: unknown;
      weeks: unknown;
    };
    expect(JSON.stringify(goalPlan.weeks)).toBe(JSON.stringify(expectedPlan.weeks));
    const goalDays = new Map(goalPlan.weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
    for (const d of [...past, futureDone, manual, moved, lockedDay])
      expect(JSON.stringify(goalDays.get(d.id)), d.id).toBe(JSON.stringify(oldDays.get(d.id)));

    expect(legacyCalls).toEqual([]);
  });

  /* Segment 2/5: 10K je izdvojen, pa je kontrola brojača prešla na polumaraton; segment 3/5: izdvojen je i polumaraton,
     pa kontrola koristi maraton (i dalje stari mehanizam). Segment 4/5: izdvojen je i maraton, pa stari mehanizam ostaje
     samo za plan bez podržane distance; kontrola zato koristi takav plan (7000 m) i dokazuje da brojač radi. */
  /* Segment 5/5: stari mehanizam više nije rezerva ni za plan bez podržane distance. Takav plan se EKSPLICITNO odbija
     (poruka `UNSUPPORTED_DISTANCE`), bez poziva starog mehanizma i bez zamene drugim generatorom. Da brojač zaista radi,
     kontrola na kraju direktno poziva obmotan stari modul. */
  it('plan bez podržane distance se eksplicitno odbija, bez starog mehanizma (kontrola brojača)', async () => {
    const plan = tenK.adaptGeneratedPlan(
      tenK.generatePlan({
        startDate: TODAY,
        raceDate: '2026-04-12',
        raceDistM: 10000,
        pb: { distM: 5000, sec: 1350 },
        weeklyKm: 30,
        runDays: 4,
        quality: 2,
        intensity: 'std'
      } as never)
    )!;
    // Isti oblik plana, ali deklarisan sa nepodržanom distancom: izbor generatora mora poslati stari mehanizam.
    useTrainingStore.getState().patch({
      genPlan: {
        ...plan,
        meta: { ...plan.meta!, raceDistM: 7000 },
        ulaz: { raceDistM: 7000 }
      }
    });
    legacyCalls.length = 0;
    const t = useTrainingStore.getState();
    const view = resolvePlan(t.genPlan!.weeks, replanContext());
    expect(() => executionModel(view, LATER)).toThrow(UNSUPPORTED_DISTANCE);
    expect(previewExecution(view, LATER, {})).toEqual({ ok: false, reason: UNSUPPORTED_DISTANCE });
    expect(legacyCalls).toEqual([]);
    // Kontrola brojača: direktan poziv obmotanog starog modula se beleži.
    const legacy = await import('../../domain/plan/executionAdjustment');
    legacy.executionModel(view, LATER, replanContext());
    expect(legacyCalls).toContain('executionAdjustment.executionModel');
  });
});
