import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { resolvePlan } from '../../domain/plan';
import { recordPlanRevision } from '../../domain/plan/versions';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import { analyzeExecution, recommendExecution } from '../../domain/training/execution';
import { hydratePersisted, useTrainingStore } from '../../stores';
import { seedState } from '../../domain/state';
import { ExecutionAdjustment } from './ExecutionAdjustment';

const actions = vi.hoisted(() => ({
  model: vi.fn(),
  preview: vi.fn(),
  restore: vi.fn(),
  commit: vi.fn(),
  runWalk: vi.fn(),
  runWalkPreview: vi.fn(),
  gate: vi.fn()
}));
vi.mock('../../stores/executionActions', () => ({
  executionModel: actions.model,
  previewExecution: actions.preview,
  previewRestore: actions.restore,
  commitPlanChange: actions.commit,
  runWalkModel: actions.runWalk,
  previewRunWalk: actions.runWalkPreview,
  qualityGateModel: actions.gate
}));

const today = '2026-01-14';
const input = {
  startDate: '2026-01-05',
  raceDate: '2026-04-12',
  raceDistM: 10000,
  pb: { distM: 10000, sec: 2700 },
  weeklyKm: 40,
  runDays: 5,
  quality: 2,
  intensity: 'std' as const,
  trainedRecently: true
};
const stored = adaptGeneratedPlan(generatePlan(input));
if (!stored) throw new Error('test plan');
stored.ulaz = input;
const plan = resolvePlan(stored.weeks, { alts: {}, moves: {} });
const analysis = analyzeExecution({ plan, log: {}, today });
const ready = () => ({
  ok: true as const,
  token: 'preview-token',
  day: today,
  result: stored,
  reason: 'execution' as const,
  summary: 'Povratak posle 14 dana pauze',
  changes: [{ week: 2, beforeKm: 40, afterKm: 28, longRunKm: 10 }],
  notes: ['Odrađeni dani ostaju sačuvani.']
});
const renderAdjustment = () => render(<ExecutionAdjustment plan={plan} today={today} />);

beforeEach(() => {
  vi.clearAllMocks();
  hydratePersisted({ ...seedState(), genPlan: structuredClone(stored) });
  actions.model.mockReturnValue({ analysis, recommendation: recommendExecution(analysis) });
  actions.runWalk.mockReturnValue({ decision: 'not-applicable', reasons: [], advice: null });
  actions.gate.mockReturnValue(null);
  actions.preview.mockReturnValue(ready());
  actions.runWalkPreview.mockReturnValue(ready());
  actions.restore.mockReturnValue({ ...ready(), reason: 'restore' });
  actions.commit.mockReturnValue({ ok: true });
});

describe('ExecutionAdjustment', () => {
  it('prikazuje neupisane treninge kao nepotvrđene i ne primenjuje promenu pri prikazu', () => {
    renderAdjustment();
    expect(screen.getByText(/bez potvrde/)).toHaveTextContent(`${analysis.unknown} bez potvrde`);
    expect(screen.getByText(/Neupisan trening ne računamo kao preskočen/)).toBeInTheDocument();
    expect(actions.preview).not.toHaveBeenCalled();
    expect(actions.commit).not.toHaveBeenCalled();
  });

  it('zahteva potvrdu pauze i stvarnu bazu, zatim prvo prikazuje predlog', async () => {
    const user = userEvent.setup();
    renderAdjustment();
    await user.selectOptions(screen.getByLabelText('Šta želiš da prilagodiš?'), 'return');
    await user.selectOptions(screen.getByLabelText('Trajanje pauze'), '14');
    await user.click(screen.getByRole('button', { name: 'Pregledaj predlog' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Potvrdi da si zaista pravio pauzu');
    expect(actions.preview).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox', { name: /Potvrđujem da sam pravio/ }));
    await user.click(screen.getByRole('button', { name: 'Pregledaj predlog' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Unesi stvarni pozitivan nedeljni obim');
    await user.type(screen.getByLabelText('Ponovljiva baza pre pauze (km/ned)'), '40');
    await user.type(screen.getByLabelText('Ponovljiva dužina pre pauze (km, opciono)'), '14');
    await user.click(screen.getByRole('button', { name: 'Pregledaj predlog' }));
    expect(actions.preview).toHaveBeenCalledWith(plan, today, {
      breakDays: 14,
      weeklyKm: 40,
      recentLongRunKm: 14
    });
    expect(screen.getByRole('table')).toHaveTextContent('28,0');
    expect(actions.commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Primeni prikazanu promenu' }));
    expect(actions.commit).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Promena je primenjena');
    expect(screen.queryByRole('button', { name: 'Primeni prikazanu promenu' })).toBeNull();
  });

  it('izmena unosa poništava prethodni pregled; zastareo predlog prikazuje grešku', async () => {
    const user = userEvent.setup();
    renderAdjustment();
    await user.type(screen.getByLabelText('Trenutna odrađena baza (km/ned)'), '30');
    await user.click(screen.getByRole('button', { name: 'Pregledaj predlog' }));
    await user.type(screen.getByLabelText('Nedavna ponovljiva dužina (km, opciono)'), '10');
    expect(screen.queryByRole('button', { name: 'Primeni prikazanu promenu' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Pregledaj predlog' }));
    actions.commit.mockReturnValueOnce({
      ok: false,
      reason: 'Plan ili dnevnik je promenjen. Ponovi pregled.'
    });
    act(() => useTrainingStore.getState().patchLog('g1d2', { status: 'done', km: 6 }));
    await user.click(screen.getByRole('button', { name: 'Primeni prikazanu promenu' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Plan ili dnevnik je promenjen');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('vraćanje verzije prikazuje pregled i čeka primenu', async () => {
    const user = userEvent.setup();
    const withHistory = recordPlanRevision(stored, stored, {
      reason: 'execution',
      date: today,
      summary: 'Smanjen obim prema dnevniku'
    });
    useTrainingStore.setState({ genPlan: withHistory });
    renderAdjustment();
    await user.click(
      screen.getByRole('button', { name: 'Pregledaj vraćanje: Smanjen obim prema dnevniku' })
    );
    expect(actions.restore).toHaveBeenCalledWith(expect.stringMatching(/^r1-/), today);
    expect(screen.getByRole('heading', { name: 'Pregled promene' })).toBeInTheDocument();
    expect(actions.commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Odustani' }));
    expect(screen.queryByRole('heading', { name: 'Pregled promene' })).toBeNull();
    expect(actions.commit).not.toHaveBeenCalled();
  });

  it('grešku generatora prikazuje bez dugmeta za primenu', async () => {
    const user = userEvent.setup();
    actions.preview.mockReturnValue({
      ok: false,
      reason: 'Preostalo je premalo nedelja za obnovu plana.'
    });
    renderAdjustment();
    await user.type(screen.getByLabelText('Trenutna odrađena baza (km/ned)'), '30');
    await user.click(screen.getByRole('button', { name: 'Pregledaj predlog' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Preostalo je premalo nedelja');
    expect(screen.queryByRole('button', { name: 'Primeni prikazanu promenu' })).toBeNull();
  });

  it('pregled prikazuje preostali obim, minute kvalitetnog rada i zahtevne dane', async () => {
    const user = userEvent.setup();
    actions.preview.mockReturnValue({
      ...ready(),
      changes: [
        {
          week: 2,
          beforeKm: 24,
          afterKm: 18,
          longRunKm: 8,
          qualityMinutesBefore: 25,
          qualityMinutesAfter: 0,
          demandingDaysBefore: 2,
          demandingDaysAfter: 0
        }
      ]
    });
    renderAdjustment();
    await user.type(screen.getByLabelText('Trenutna odrađena baza (km/ned)'), '30');
    await user.click(screen.getByRole('button', { name: 'Pregledaj predlog' }));
    expect(
      screen.getByRole('table', { name: 'Preostali km pre i posle promene' })
    ).toHaveTextContent('18,0');
    expect(screen.getByText(/Nedelja 2: kvalitetan rad/)).toHaveTextContent(
      'Nedelja 2: kvalitetan rad 25,0 → 0,0 min; zahtevni treninzi 2 → 0.'
    );
    expect(screen.getByText(/Preostali km i opterećenje/)).toHaveTextContent('dane posle danas');
    expect(actions.commit).not.toHaveBeenCalled();
  });

  it('trčanje/hod: prikazuje procenu tolerancije i šalje izabrani režim bez unosa baze', async () => {
    const user = userEvent.setup();
    actions.runWalk.mockReturnValue({
      decision: 'hold',
      reasons: ['1 trčanja uz napor 7+/10 ili bol 4+/10.'],
      advice: 'Zadrži korak „5 min trčanja / 1 min hoda" još nedelju dana pre prelaza.'
    });
    renderAdjustment();
    expect(screen.getByText(/Trčanje\/hod: Zadrži korak/)).toBeInTheDocument();
    expect(screen.getByText(/uz napor 7\+\/10/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Šta želiš da prilagodiš?'), 'runwalk');
    expect(screen.queryByLabelText('Trenutna odrađena baza (km/ned)')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Kako da produžim fazu?'), 'step-back');
    await user.click(screen.getByRole('button', { name: 'Pregledaj predlog' }));
    expect(actions.runWalkPreview).toHaveBeenCalledWith(plan, today, { mode: 'step-back' });
    expect(actions.preview).not.toHaveBeenCalled();
  });

  it('bez run/walk faze nema te opcije; nepotvrđena forma prikazuje nezadovoljene uslove', () => {
    actions.gate.mockReturnValue({
      open: false,
      met: [],
      unmet: ['Forma potvrđena merenjem u poslednjih 90 dana — do tada napor vodi.'],
      unknown: []
    });
    renderAdjustment();
    expect(screen.queryByRole('option', { name: 'Ponovi ili zadrži trčanje/hod' })).toBeNull();
    expect(screen.getByText(/Forma nije potvrđena: zahtevniji rad čeka/)).toBeInTheDocument();
    expect(screen.getByText(/Forma potvrđena merenjem u poslednjih 90 dana/)).toBeInTheDocument();
  });
});
