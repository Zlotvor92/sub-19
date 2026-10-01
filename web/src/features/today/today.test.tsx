import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { resolvePlan, type ResolvedDay } from '../../domain/plan';
import { seedState, type PersistedState } from '../../domain/state';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import {
  collectPersisted,
  hydratePersisted,
  onPersistRequest,
  useTrainingStore
} from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';
import TodayPage from './index';

/* parity: dayCard / bindDayCard / bindForm / renderDanas (app.js) — Danas ekran: hero, kartica dana, status, unos, tempo radnog dela. */

function freshState(): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: '2026-01-05',
      raceDate: '2026-04-12',
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2700 },
      weeklyKm: 40,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!a) throw new Error('plan');
  s.genPlan = a;
  return s;
}

const days = (): ResolvedDay[] => {
  const gp = useTrainingStore.getState().genPlan;
  if (!gp) throw new Error('nema plana');
  return resolvePlan(gp.weeks, { alts: {}, moves: {} }).dated;
};
const firstOf = (pred: (d: ResolvedDay) => boolean): ResolvedDay => {
  const d = days().find(pred);
  if (!d) throw new Error('nema dana');
  return d;
};
const goTo = (date: string): void => {
  act(() => useUIStore.setState({ today: date }));
};

beforeEach(() => {
  hydratePersisted(freshState());
  useUIStore.setState({ today: '', confirm: null });
});

describe('Danas', () => {
  it('bez plana ne crta ništa', () => {
    hydratePersisted(JSON.parse(JSON.stringify(seedState())) as PersistedState);
    useUIStore.setState({ today: '2026-01-07' });
    const { container } = render(<TodayPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hero: broj dana do trke i serija; dan van plana kaže kad plan počinje', () => {
    goTo('2025-12-29');
    render(<TodayPage />);
    expect(screen.getByText('104')).toBeInTheDocument(); // 29.12. → 12.4.
    expect(screen.getByText('dana do trke')).toBeInTheDocument();
    expect(screen.getByText(/Plan počinje/)).toBeInTheDocument();
  });

  it('odmor po planu: prikazuje sledeći trening', () => {
    const rest = firstOf((d) => d.rest && !!d.date);
    goTo(rest.date);
    render(<TodayPage />);
    expect(screen.getByText('Odmor')).toBeInTheDocument();
    expect(screen.getByText(/Sledeći trening:/)).toBeInTheDocument();
  });

  it('„Završi trening": status done + datum trčanja; pojavljuje se forma za unos; upis je odmah', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => !x.rest && x.tag === 'lako');
    goTo(d.date);
    const persists: string[] = [];
    const off = onPersistRequest((m) => persists.push(m));
    render(<TodayPage />);
    expect(screen.queryByText('Uneto')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Završi trening' }));
    off();
    expect(useTrainingStore.getState().log[d.id]).toEqual({ status: 'done', ts: d.date });
    expect(persists).toContain('now');
    expect(screen.getByText('Uneto')).toBeInTheDocument();
    expect(screen.getByText('Odrađen')).toBeInTheDocument();
  });

  it('„Preskoči" traži potvrdu; odbijanje ne menja ništa, potvrda upisuje „skip", „Vrati" ga uklanja', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => !x.rest && x.tag === 'lako');
    goTo(d.date);
    render(<TodayPage />);
    await user.click(screen.getByRole('button', { name: 'Preskoči' }));
    expect(useUIStore.getState().confirm?.text).toBe('Označi trening kao preskočen?');
    act(() => useUIStore.getState().confirm?.resolve(false));
    expect(useTrainingStore.getState().log[d.id]).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Preskoči' }));
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useTrainingStore.getState().log[d.id]?.status).toBe('skip'));
    await user.click(screen.getByRole('button', { name: 'Vrati' }));
    expect(useTrainingStore.getState().log[d.id]?.status).toBe('pending');
  });

  it('unos: decimalni zarez, vreme bez dvotačke, prosečan tempo; zarez se može ukucati', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => !x.rest && x.tag === 'lako');
    goTo(d.date);
    render(<TodayPage />);
    await user.click(screen.getByRole('button', { name: 'Završi trening' }));
    const km = screen.getByLabelText(/Distanca/);
    await user.type(km, '8,');
    expect(km).toHaveValue('8,'); // zarez ostaje dok se kuca
    await user.type(km, '5');
    await user.type(screen.getByLabelText(/Vreme/), '4233');
    const log = useTrainingStore.getState().log[d.id];
    expect(log?.km).toBe(8.5);
    expect(log?.sec).toBe(2553);
    expect(screen.getByRole('status')).toHaveTextContent('5:00 /km');
    expect(screen.getByLabelText(/Vreme/)).toHaveValue('4233'); // ne prepisuje se dok se kuca
  });

  it('beleška ide odloženim upisom, a brojevi odmah', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => !x.rest && x.tag === 'lako');
    goTo(d.date);
    render(<TodayPage />);
    await user.click(screen.getByRole('button', { name: 'Završi trening' }));
    const modes: string[] = [];
    const off = onPersistRequest((m) => modes.push(m));
    await user.click(screen.getByText(/Više detalja/));
    await user.type(screen.getByLabelText('Beleška'), 'ok');
    off();
    expect(new Set(modes)).toEqual(new Set(['soon']));
    expect(useTrainingStore.getState().log[d.id]?.note).toBe('ok');
  });

  it('bol i težina uneti uz trening postaju zapisi u oporavku (kt-<dan>, src=<dan>)', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => !x.rest && x.tag === 'lako');
    goTo(d.date);
    render(<TodayPage />);
    await user.click(screen.getByRole('button', { name: 'Završi trening' }));
    await user.click(screen.getByText(/Više detalja/));
    await user.selectOptions(screen.getByLabelText(/Bol/), '4');
    await user.type(screen.getByLabelText(/Telesna masa/), '80,5');
    const r = useRecoveryStore.getState();
    expect(r.knee.find((x) => x.id === `kt-${d.id}`)?.pain).toBe(4);
    expect(r.kg.find((x) => x.src === d.id)?.kg).toBe(80.5);
  });

  it('ručni unos nad Stravom zaključava polje (lock)', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => !x.rest && x.tag === 'lako');
    act(() =>
      useTrainingStore
        .getState()
        .patchLog(d.id, { status: 'done', src: 'strava', km: 5, sec: 1500 })
    );
    goTo(d.date);
    render(<TodayPage />);
    expect(screen.getByText(/sa Strave/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Distanca/), '1');
    expect(useTrainingStore.getState().log[d.id]?.lock).toBe(true);
    expect(screen.getByText(/ručno korigovano/)).toBeInTheDocument();
  });

  it('radni deo: ručni tempo se upisuje i zaključava; merilo pokazuje odstupanje; brisanje čisti lanac', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => x.tag === 'int' && !x.test);
    act(() => useTrainingStore.getState().patchLog(d.id, { status: 'done', ts: d.date }));
    goTo(d.date);
    render(<TodayPage />);
    const group = screen.getByRole('group', { name: 'Radni deo — ostvaren tempo' });
    const input = within(group).getByLabelText('Ostvaren tempo radnog dela');
    await user.type(input, '400');
    const t = useTrainingStore.getState();
    const ids = Object.keys(t.pred);
    expect(ids.length).toBe(1);
    expect(t.pred[ids[0] as string]).toBe(240);
    expect(t.predLock[ids[0] as string]).toBe(true);
    expect(within(group).getByText(/^[+-]?\d+ s$/)).toBeInTheDocument();
    await user.clear(input);
    expect(useTrainingStore.getState().pred).toEqual({});
    expect(useTrainingStore.getState().vdotLog).toEqual([]);
    expect(within(group).getByText('unesi tempo →')).toBeInTheDocument();
  });

  it('unos se ne gubi pri preračunavanju: stanje pre i posle ostaje isto sklopljeno (collectPersisted)', () => {
    const d = firstOf((x) => !x.rest && x.tag === 'lako');
    goTo(d.date);
    render(<TodayPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Završi trening' }));
    const s = collectPersisted();
    expect(s.log[d.id]?.status).toBe('done');
    vi.useRealTimers();
  });
});
