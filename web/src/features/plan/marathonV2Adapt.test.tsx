import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmHost } from '../../components/ui/ConfirmHost';
import {
  generateMarathonV2Plan,
  isMarathonV2Plan,
  MARATHON_V2_TEST_FIELD,
  marathonV2Start
} from '../../domain/generators/select';
import type { MarathonV2PlanInput } from '../../domain/generators/contract';
import { resolvePlan } from '../../domain/plan';
import { getPlanRevisions } from '../../domain/plan/versions';
import {
  seedState,
  type GenPlanState,
  type LogEntry,
  type PersistedState
} from '../../domain/state';
import { collectPersisted, hydratePersisted, useTrainingStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { DayScreen } from '../day/DayScreen';
import { FormScreen } from '../race/FormScreen';
import { GoalScreen } from '../ti/screens';
import { Advisories } from '../today/Advisories';
import { AdjustPlan } from './AdjustPlan';
import PlanPage from './index';

/* SEGMENT MAR-06 — tok prilagođavanja maratona v2 u aplikaciji (kopija obrasca HM v2 06): propuštena nedelja →
   pregled (bez potvrde ništa, uz potvrdu pauza) → potvrda → nova revizija → vraćanje revizije; bol 5 → traka (Plan i
   Danas) → pregled → primena → traka nestaje; test 5 km na danu testa → pregled „nov rezultat" → plan po osećaju prelazi
   na tempo; Forma iz rezultata; Ti → Cilj: isti treninzi, nova ocena; odbijanje v2 sa razlozima doslovno. Nijedan alat
   maraton v1 se ne prikazuje. */

const RACE = '2027-03-07';
const START = marathonV2Start(RACE, '2026-11-02')!; // 18 nedelja od 2026-11-02
const WITH_RESULT: MarathonV2PlanInput = {
  startDate: START,
  raceDate: RACE,
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 45,
  recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-10-20' },
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

function plan(input: MarathonV2PlanInput): GenPlanState {
  const r = generateMarathonV2Plan(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
const days = (p: GenPlanState) => resolvePlan(p.weeks, { alts: {}, moves: {} }).dated;
function doneUntil(p: GenPlanState, to: string): Record<string, LogEntry> {
  const out: Record<string, LogEntry> = {};
  for (const d of days(p))
    if (!d.rest && d.date <= to)
      out[d.id] = { status: 'done', km: d.km ?? 0, sec: Math.round((d.km ?? 0) * 330), ts: d.date };
  return out;
}
function state(extra: Partial<PersistedState>): PersistedState {
  return { ...(JSON.parse(JSON.stringify(seedState())) as PersistedState), ...extra };
}
const stored = () => collectPersisted().genPlan!;
const preview = () => document.getElementById('plan-change-preview')!;

beforeEach(() => {
  useAuthStore.setState({ configured: true, hasSession: false, userId: null, email: null });
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Plan → Prilagodi plan (maraton v2)', () => {
  it('propuštena nedelja: pregled → potvrda → nova revizija → vraćanje revizije', async () => {
    const p = plan(WITH_RESULT);
    hydratePersisted(state({ genPlan: p, log: doneUntil(p, '2026-11-08') }));
    useUIStore.setState({ today: '2026-11-15', confirm: null });
    const user = userEvent.setup();
    render(
      <>
        <AdjustPlan />
        <ConfirmHost />
      </>
    );
    // Bez potvrde potpunosti dan bez zapisa nije pauza → nema promene; alat v1 se ne prikazuje.
    expect(screen.queryByText('Prilagođavanje prema izvršenju')).toBeNull();
    expect(within(preview()).getByText('Budući deo plana se ne menja.')).toBeTruthy();
    expect(within(preview()).getByText(/Zapis treninga nije potvrđen kao potpun/)).toBeTruthy();
    expect(
      within(preview()).getByRole<HTMLButtonElement>('button', {
        name: 'Primeni prikazanu promenu'
      }).disabled
    ).toBe(true);
    // Potvrda „zapis za proteklih 14 dana je potpun" → pauza 7 dana, promenjene nedelje.
    await user.click(screen.getByLabelText(/Zapis treninga za proteklih/));
    const reasons = within(preview()).getByRole('list', { name: 'Razlozi prilagođavanja' });
    expect(reasons.textContent).toMatch(/Pauza 7 dana \(obim 7 dana pre pauze/);
    const table = within(preview()).getByRole('table', { name: 'Promenjene nedelje' });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
    expect(stored()).toEqual(p); // pregled ne upisuje
    await user.click(within(preview()).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    expect(screen.getByRole('status').textContent).toMatch(/Plan je prilagođen/);
    const after = stored();
    expect(isMarathonV2Plan(after)).toBe(true);
    expect(getPlanRevisions(after)).toHaveLength(1);
    expect(after.weeks.slice(0, 2)).toEqual(p.weeks.slice(0, 2));
    expect(after.weeks.slice(2)).not.toEqual(p.weeks.slice(2));
    // MAR-10 (Z4): vraćanje revizije (sledećeg dana) = spoj → validatePlan jezgra; pregled pa potvrda; budući dani iz
    // sačuvane verzije.
    useUIStore.setState({ today: '2026-11-16' });
    await user.click(
      screen.getByRole('button', { name: 'Pregledaj vraćanje: Prilagođavanje 2026-11-15: pauza' })
    );
    expect(
      within(preview()).getByText('Vraćanje plana: Prilagođavanje 2026-11-15: pauza')
    ).toBeTruthy();
    await user.click(within(preview()).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    const back = stored();
    expect(getPlanRevisions(back)).toHaveLength(2);
    expect(back.weeks.slice(3)).toEqual(p.weeks.slice(3));
  });

  it('bol 5 → traka „Plan treba prilagoditi" (Plan i Danas) → isti pregled → primena → traka nestaje', async () => {
    const p = plan(WITH_RESULT);
    hydratePersisted(state({ genPlan: p, knee: [{ date: '2026-11-11', pain: 5, src: null }] }));
    useUIStore.setState({ today: '2026-11-12', confirm: null, screens: [] });
    const user = userEvent.setup();
    const { unmount } = render(<PlanPage />);
    const banner = document.getElementById('v2-needed')!;
    expect(banner.textContent).toMatch(/Plan treba prilagoditi/);
    expect(banner.textContent).toMatch(/Bol 5\/10 u poslednja 3 dana/);
    await user.click(within(banner).getByRole('button', { name: 'Pregledaj' }));
    expect(useUIStore.getState().screens.at(-1)).toMatchObject({ kind: 'plan-prilagodi' });
    expect(stored()).toEqual(p); // traka ne upisuje
    unmount();
    const today = render(<Advisories today="2026-11-12" />);
    expect(screen.getByText('Plan treba prilagoditi')).toBeTruthy();
    today.unmount();
    const adj = render(<AdjustPlan />);
    expect(
      within(preview()).getByRole('list', { name: 'Razlozi prilagođavanja' }).textContent
    ).toMatch(/Bol 5\/10/);
    await user.click(within(preview()).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    expect(getPlanRevisions(stored())).toHaveLength(1);
    adj.unmount();
    render(<PlanPage />);
    expect(document.getElementById('v2-needed')).toBeNull();
  });

  it('odbijanje v2 → poruka sa razlozima doslovno, plan se ne menja', () => {
    const p = plan(WITH_RESULT);
    hydratePersisted(state({ genPlan: p }));
    useUIStore.setState({ today: RACE, confirm: null });
    render(<AdjustPlan />);
    const box = document.getElementById('v2-adapt-rejected')!;
    expect(within(box).getByRole('status').textContent).toMatch(
      /Plan nije prilagođen\. Razlozi:asOf mora biti pre dana trke/
    );
    expect(document.getElementById('plan-change-preview')).toBeNull();
    expect(stored()).toEqual(p);
  });
});

describe('Test 5 km, Forma i cilj (maraton v2)', () => {
  it('dan testa: vreme 5 km → pregled „nov rezultat" → primena → tempo iz rezultata; Forma iz rezultata', async () => {
    const p = plan(FEEL);
    const test = days(p).find((d) => d.tag === 'test')!;
    hydratePersisted(state({ genPlan: p, log: doneUntil(p, test.date) }));
    useUIStore.setState({ today: test.date, confirm: null, screens: [] });
    const user = userEvent.setup();
    const day = render(<DayScreen id={test.id} />);
    const box = document.getElementById('v2-test-result')!;
    await user.type(within(box).getByLabelText(/Vreme 5 km/), '25:00');
    await user.click(within(box).getByRole('button', { name: 'Sačuvaj vreme testa' }));
    expect(useTrainingStore.getState().log[test.id]![MARATHON_V2_TEST_FIELD]).toBe(1500);
    expect(within(box).getByRole('status').textContent).toMatch(/5 km za 25:00/);
    expect(stored()).toEqual(p); // rezultat je činjenica, plan se ne menja
    day.unmount();
    const adj = render(<AdjustPlan />);
    const reasons = within(preview()).getByRole('list', { name: 'Razlozi prilagođavanja' });
    expect(reasons.textContent).toMatch(
      /Test 5 km 25:00 .* plan po osećaju prelazi na tempo iz rezultata/
    );
    await user.click(within(preview()).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    const after = stored();
    expect(after.meta).toMatchObject({ paceBasis: 'result', vdot: 38.3 });
    adj.unmount();
    render(<FormScreen />);
    expect(document.getElementById('v2-form-next')!.textContent).toMatch(
      /Od nedelje \d+ tempo iz rezultata: VDOT 38[.,]3/
    );
    const list = screen.getByRole('list', { name: 'Istorija VDOT-a iz rezultata' });
    expect(list.textContent).toMatch(/Test 5 km 25:00 — tempo od nedelje \d+ \(u planu\)/);
    expect(screen.queryByText('Da li napredujem?')).toBeNull();
  });

  it('dan testa bez odrađenog treninga: vreme se ne upisuje (prvo trening)', () => {
    const p = plan(FEEL);
    const test = days(p).find((d) => d.tag === 'test')!;
    hydratePersisted(state({ genPlan: p }));
    useUIStore.setState({ today: test.date, confirm: null, screens: [] });
    render(<DayScreen id={test.id} />);
    const box = document.getElementById('v2-test-result')!;
    expect(box.textContent).toMatch(/Prvo upiši odrađen trening/);
    expect(within(box).queryByLabelText(/Vreme 5 km/)).toBeNull();
  });

  it('Ti → Cilj: isti treninzi, nova ocena cilja, nova revizija', async () => {
    const p = plan(WITH_RESULT);
    hydratePersisted(state({ genPlan: p }));
    useUIStore.setState({ today: '2026-11-20', confirm: null });
    const user = userEvent.setup();
    render(
      <>
        <GoalScreen />
        <ConfirmHost />
      </>
    );
    await user.type(screen.getByLabelText('Novo ciljno vreme'), '3:00:00');
    await user.click(screen.getByRole('button', { name: 'Promeni cilj' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toMatch(/menja se samo ocena cilja/);
    expect(dialog.textContent).toMatch(/Sada: realističan/);
    expect(dialog.textContent).toMatch(/Posle: nerealan/);
    await user.click(within(dialog).getByRole('button', { name: 'Da' }));
    const after = stored();
    expect(after.weeks.map((w) => w.days)).toEqual(p.weeks.map((w) => w.days));
    expect(after.meta?.goalSec).toBe(10800);
    expect(getPlanRevisions(after)).toHaveLength(1);
  });
});
