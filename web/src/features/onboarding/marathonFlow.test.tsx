import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmHost } from '../../components/ui/ConfirmHost';
import * as m from '../../domain/generators/marathon';
import { regeneratorForDistance } from '../../domain/generators/handoff';
import { generatorForPlan, HALF_MARATHON_GENERATOR } from '../../domain/generators/select';
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
  previewPreparationChoice,
  previewRestore,
  replanContext,
  storedPreparationDecision
} from '../../stores/executionActions';
import { useUIStore } from '../../stores/uiStore';
import { UNSUPPORTED_DISTANCE } from '../../domain/generators/select';
import { changeGoalTime } from '../plan/planActions';
import PlanPage from '../plan/index';
import { Wizard } from './Wizard';

/* STVARNI MARATONSKI TOK: izbor maratona u čarobnjaku → generisanje → prikaz → čuvanje → učitavanje → adaptacija
   (povratak posle pauze) → vraćanje verzije → promena cilja → odluka o ograničenoj pripremi nad sačuvanim planom →
   „kraća distanca: polumaraton". Stari zajednički engine je obrisan; izolaciju dokazuju arhitektonski i runtime test. Opciju polumaraton pravi izdvojeni HM generator (predaja kroz
   `handoff.ts`). Isti postupak kao `fiveKFlow`, `tenKFlow` i `halfMarathonFlow.test.tsx`. */

const handoff = regeneratorForDistance;

const TODAY = '2026-01-07';
const LATER = '2026-02-11';
const blank = (): PersistedState => JSON.parse(JSON.stringify(seedState())) as PersistedState;

beforeEach(() => {
  hydratePersisted(blank());
  useUIStore.setState({ wizard: false, confirm: null, today: TODAY });
});

describe('maraton: unos → generisanje → prikaz → čuvanje → učitavanje → adaptacija → odluka', () => {
  it(
    'ceo tok ide kroz izdvojeni maratonski generator i čuva istoriju',
    { timeout: 120_000 },
    async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <>
          <Wizard today={TODAY} />
          <ConfirmHost />
        </>
      );
      await user.click(
        within(screen.getByRole('group', { name: 'Ciljna distanca' })).getByRole('button', {
          name: 'Maraton'
        })
      );
      await user.type(screen.getByLabelText('Datum trke'), '2026-05-31');
      await user.click(screen.getByRole('button', { name: 'Dalje' }));
      await user.type(screen.getByLabelText('minuti'), '22');
      await user.type(screen.getByLabelText('sekunde'), '30');
      await user.click(screen.getByRole('button', { name: 'Dalje' }));
      await user.type(screen.getByLabelText('Nedeljna kilometraža'), '32');
      await user.click(screen.getByRole('button', { name: 'Dalje' }));
      await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
      await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
      unmount();

      // Generisanje: identično direktnom pozivu maratonskog generatora sa sačuvanim ulazom.
      const saved = collectPersisted();
      const input = saved.genPlan!.ulaz as Parameters<typeof m.generatePlan>[0];
      expect(input.raceDistM).toBe(42195);
      const direct = m.adaptGeneratedPlan(
        m.generatePlan(JSON.parse(JSON.stringify(input)) as typeof input)
      );
      expect(JSON.stringify({ ...direct, ulaz: input })).toBe(JSON.stringify(saved.genPlan));
      expect(saved.genPlan!.meta!.raceName).toBe('Maraton');
      // Dvonedeljni maratonski taper je deo isporučenog plana.
      expect(saved.genPlan!.weeks.filter((w) => w.taper).length).toBe(2);

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
      const rows = m.matchPlanRows(view.weeks, t.genPlan!.pred as never);
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

      // Adaptacija: povratak posle potvrđene pauze, pregled pa upis.
      const resolved = resolvePlan(before.weeks, replanContext());
      const p = previewExecution(resolved, LATER, {
        breakDays: 14,
        weeklyKm: 25,
        recentLongRunKm: 8
      });
      expect(p.ok, p.ok ? '' : p.reason).toBe(true);
      if (!p.ok) return;
      const expected = m.buildExecutionAdjustment(
        before,
        LATER as never,
        executionModel(resolved, LATER).analysis,
        { breakDays: 14, weeklyKm: 25, recentLongRunKm: 8 },
        replanContext(),
        handoff
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
      expect(
        after.genPlan!.meta!.dayWarnings.some((w) => w.includes('Ručno izmenjen trening'))
      ).toBe(true);
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
      const expectedGoal = m.planWithNewGoal(goalBase, 14340, LATER as never, replanContext());
      expect('error' in expectedGoal && expectedGoal.error).toBeFalsy();
      const host = render(<ConfirmHost />);
      const changing = changeGoalTime(goalBase, '3:59:00', LATER);
      await user.click(await screen.findByRole('button', { name: 'Da' }));
      expect(await changing).toBe(true);
      host.unmount();
      alert.mockRestore();
      const goalPlan = useTrainingStore.getState().genPlan!;
      expect(goalPlan.meta!.goalSec).toBe(14340);
      const { goalChange: _g, ...expectedPlan } = expectedGoal as {
        goalChange: unknown;
        weeks: unknown;
      };
      expect(JSON.stringify(goalPlan.weeks)).toBe(JSON.stringify(expectedPlan.weeks));
      const goalDays = new Map(goalPlan.weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
      for (const d of [...past, futureDone, manual, moved, lockedDay])
        expect(JSON.stringify(goalDays.get(d.id)), d.id).toBe(JSON.stringify(oldDays.get(d.id)));

      // Odluka o ograničenoj pripremi nad sačuvanim planom (32 km/ned je ispod maratonskog vrhunca od 55 km/ned).
      const stored = useTrainingStore.getState().genPlan!;
      expect(m.isLimitedLongPreparation(stored.meta)).toBe(true);
      const decision = storedPreparationDecision(LATER);
      expect(decision).not.toBeNull();
      const basis = m.basisFromPlan(stored, LATER as never)!;
      const directDecision = m.preparationDecision(
        stored,
        LATER as never,
        basis,
        replanContext(),
        'limited',
        stored.meta!.preparation,
        handoff
      );
      expect(JSON.stringify(decision)).toBe(JSON.stringify(directDecision));
      const shorter = decision!.options.find(
        (o) => o.choice.kind === 'shorter' && o.choice.raceDistM === 21097.5
      );
      expect(shorter, JSON.stringify(decision!.options.map((o) => o.choice))).toBeDefined();
      const storedView = resolvePlan(stored.weeks, replanContext());
      const choice = previewPreparationChoice(storedView, LATER, null, shorter!.choice);
      expect(choice.ok, choice.ok ? '' : choice.reason).toBe(true);
      if (!choice.ok) return;
      const directChoice = m.buildPreparationChoice(
        stored,
        LATER as never,
        basis,
        shorter!.choice,
        replanContext(),
        handoff
      );
      expect('error' in directChoice).toBe(false);
      if ('error' in directChoice) return;
      expect(JSON.stringify(choice.result)).toBe(JSON.stringify(directChoice.result));
      expect(commitPlanChange(choice)).toEqual({ ok: true });
      const hmPlan = useTrainingStore.getState().genPlan!;
      expect(hmPlan.meta!.raceDistM).toBe(21097.5);
      expect(hmPlan.meta!.raceName).toBe('Polumaraton');
      // Od sada plan pripada izdvojenom HM generatoru; istorija maratonske pripreme ostaje.
      expect(generatorForPlan(hmPlan)).toBe(HALF_MARATHON_GENERATOR);
      const hmDays = new Map(hmPlan.weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
      for (const d of [...past, futureDone, manual, moved])
        expect(JSON.stringify(hmDays.get(d.id)), d.id).toBe(JSON.stringify(oldDays.get(d.id)));
      expect(
        JSON.stringify({
          log: useTrainingStore.getState().log,
          alts: useTrainingStore.getState().alts,
          moves: useTrainingStore.getState().moves,
          pred: useTrainingStore.getState().pred,
          predLock: useTrainingStore.getState().predLock
        })
      ).toBe(historyBefore);
    }
  );

  /* Plan bez podržane distance se EKSPLICITNO odbija (poruka `UNSUPPORTED_DISTANCE`), bez zamene drugim generatorom;
     stari zajednički engine više ne postoji. */
  it('plan bez podržane distance se eksplicitno odbija, bez zamene drugim generatorom', () => {
    const plan = m.adaptGeneratedPlan(
      m.generatePlan({
        startDate: TODAY,
        raceDate: '2026-05-31',
        raceDistM: 42195,
        pb: { distM: 5000, sec: 1350 },
        weeklyKm: 30,
        runDays: 4,
        quality: 2,
        intensity: 'std'
      } as never)
    )!;
    // Isti oblik plana, ali deklarisan sa nepodržanom distancom.
    useTrainingStore.getState().patch({
      genPlan: {
        ...plan,
        meta: { ...plan.meta!, raceDistM: 7000 },
        ulaz: { raceDistM: 7000 }
      }
    });
    const t = useTrainingStore.getState();
    const view = resolvePlan(t.genPlan!.weeks, replanContext());
    expect(() => executionModel(view, LATER)).toThrow(UNSUPPORTED_DISTANCE);
    expect(previewExecution(view, LATER, {})).toEqual({ ok: false, reason: UNSUPPORTED_DISTANCE });
    // Odluka o pripremi: plan bez podržane distance je nema (`null`), bez poziva stare odluke.
    expect(storedPreparationDecision(LATER)).toBeNull();
  });
});
