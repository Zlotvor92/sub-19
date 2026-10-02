import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONAL, personalBaselineVdot } from '../domain/personal';
import { seedState, type PersistedState } from '../domain/state';
import { adaptGeneratedPlan } from '../domain/plan/adapt';
import { generatePlan } from '../domain/training/generator/generatePlan';
import { ADMIN_UID } from '../services/config';
import { hydratePersisted, useActiveGenPlan, useResolvedPlan, useTrainingStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { editField, setStatus } from '../stores/dayActions';
import { useUIStore } from '../stores/uiStore';
import { Banners } from './today/Banners';
import { PlanBody, usePlanInfo } from './settings/planSection';
import { setApp } from '../app/appContext';
import { createApp } from '../app/createApp';
import { createKeyValueStore, type StorageLike } from '../services/storage/kv';

/* parity: test/licni-plan.test.mjs („Lični plan je aktivan kad nema generisanog", „Vlasnikovi podaci ne izlaze van njegovog naloga"), test/snaga-trka-polazna.test.mjs.
   Ugrađeni plan je VLASNIKOV: vidi ga vlasnik, ili ko je već upisivao treninge na njega; ostali idu pravo u čarobnjaka. */

const TODAY = '2026-10-01';
const asUser = (userId: string | null): void =>
  useAuthStore.setState({ configured: true, hasSession: !!userId, userId, email: null });
const empty = (): PersistedState => JSON.parse(JSON.stringify(seedState())) as PersistedState;

class Mem implements StorageLike {
  d = new Map<string, string>();
  getItem(k: string): string | null {
    return this.d.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.d.set(k, v);
  }
  removeItem(k: string): void {
    this.d.delete(k);
  }
}

beforeEach(() => {
  hydratePersisted(empty());
  useUIStore.setState({ today: TODAY, sheet: null, confirm: null, wizard: false });
  setApp(
    createApp({
      kv: createKeyValueStore(new Mem()),
      fetcher: () => Promise.resolve(new Response('{}', { status: 404 })),
      now: () => Date.UTC(2026, 9, 1, 10, 0, 0),
      today: () => TODAY,
      supabaseUrl: 'https://x.supabase.co',
      anonKey: 'anon',
      appVersion: '283',
      location: { hash: '', search: '', origin: 'https://sub-19.vercel.app', pathname: '/' },
      navigate: () => undefined,
      online: () => true
    })
  );
});
afterEach(() => {
  setApp(null);
  vi.restoreAllMocks();
});

describe('ko vidi ugrađeni plan', () => {
  it('vlasnik bez generisanog plana: 12 nedelja ugrađenog plana, tekuća je N2', () => {
    asUser(ADMIN_UID);
    const { result } = renderHook(() => useResolvedPlan());
    expect(result.current?.weeks).toHaveLength(12);
    expect(result.current?.weeks[1]?.days.some((d) => d.id === 'n2d6')).toBe(true);
    // perzistirano stanje ostaje čisto: ugrađeni plan se NIKAD ne upisuje
    expect(useTrainingStore.getState().genPlan).toBeNull();
  });

  it('tuđi nalog bez unosa: nema plana (ide u čarobnjaka); sa unosom na ugrađenom: ima plan', () => {
    asUser('neko-drugi');
    const none = renderHook(() => useResolvedPlan());
    expect(none.result.current).toBeNull();
    act(() => useTrainingStore.setState({ log: { n2d1: { status: 'done' } } }));
    const some = renderHook(() => useResolvedPlan());
    expect(some.result.current?.weeks).toHaveLength(12);
  });

  it('generisan plan ima prednost nad ugrađenim i za vlasnika', () => {
    asUser(ADMIN_UID);
    const g = adaptGeneratedPlan(
      generatePlan({
        startDate: '2026-10-05',
        raceDate: '2027-01-17',
        raceDistM: 5000,
        pb: { distM: 5000, sec: 1290 },
        weeklyKm: 40,
        runDays: 5,
        quality: 2,
        intensity: 'std',
        trainedRecently: true
      })
    );
    act(() => useTrainingStore.setState({ genPlan: g }));
    const { result } = renderHook(() => useActiveGenPlan());
    expect(result.current).toBe(g);
  });

  it('isti objekat dok se ništa ne menja (memoizovanje ekrana)', () => {
    asUser(ADMIN_UID);
    const { result, rerender } = renderHook(() => useActiveGenPlan());
    const first = result.current;
    rerender();
    act(() => useTrainingStore.setState({ log: { n2d1: { status: 'done' } } }));
    expect(result.current).toBe(first);
  });
});

describe('traka „Ovo nije tvoj plan"', () => {
  it('pokazuje se SAMO nalogu koji nije vlasnik, ima unose na ugrađenom planu i nema svoj plan; „Napravi svoj" nudi backup pa otvara čarobnjaka', async () => {
    const user = userEvent.setup();
    asUser('neko-drugi');
    const view = render(<Banners today={TODAY} />);
    expect(screen.queryByText('Ovo nije tvoj plan')).toBeNull();
    view.unmount();

    act(() => useTrainingStore.setState({ log: { n2d1: { status: 'done' } } }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Banners today={TODAY} />);
    expect(screen.getByText('Ovo nije tvoj plan')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Napravi svoj' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/^Prvo izvezi backup/));
    expect(useUIStore.getState().wizard).toBe(true); // otvara se u oba slučaja — ovo je ponuda, ne kapija
  });

  it('vlasnik je ne vidi', () => {
    asUser(ADMIN_UID);
    act(() => useTrainingStore.setState({ log: { n2d1: { status: 'done' } } }));
    render(<Banners today={TODAY} />);
    expect(screen.queryByText('Ovo nije tvoj plan')).toBeNull();
  });
});

describe('Podešavanja → Plan', () => {
  const Probe = () => (
    <>
      <span id="info">{usePlanInfo().summary}</span>
      <PlanBody />
    </>
  );

  it('ugrađeni plan: „tvoj lični plan", dugme „Generiši novi plan" otvara čarobnjaka', async () => {
    const user = userEvent.setup();
    asUser(ADMIN_UID);
    const { container } = render(<Probe />);
    expect(container.querySelector('#info')?.textContent).toBe('tvoj lični plan · 12 nedelja');
    expect(screen.queryByRole('button', { name: /Promeni cilj/ })).toBeNull(); // cilj se ne menja na ugrađenom
    await user.click(screen.getByRole('button', { name: /Generiši novi plan/ }));
    expect(useUIStore.getState().wizard).toBe(true);
  });

  it('vlasnik sa generisanim planom: „Vrati na moj plan" briše generisan plan i vraća ugrađeni', async () => {
    const user = userEvent.setup();
    asUser(ADMIN_UID);
    const g = adaptGeneratedPlan(
      generatePlan({
        startDate: '2026-10-05',
        raceDate: '2027-01-17',
        raceDistM: 5000,
        pb: { distM: 5000, sec: 1290 },
        weeklyKm: 40,
        runDays: 5,
        quality: 2,
        intensity: 'std',
        trainedRecently: true
      })
    );
    act(() => useTrainingStore.setState({ genPlan: g }));
    const { container } = render(<Probe />);
    expect(container.querySelector('#info')?.textContent).toMatch(/^generisan plan · /);
    await user.click(screen.getByRole('button', { name: 'Vrati na moj plan' }));
    expect(useUIStore.getState().confirm?.text).toMatch(/^Vratiti se na tvoj originalni plan\?/);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await vi.waitFor(() => expect(useTrainingStore.getState().genPlan).toBeNull());
    expect(renderHook(() => useResolvedPlan()).result.current?.weeks).toHaveLength(12);
  });

  it('tuđ nalog sa generisanim planom: „Napravi novi plan", ne „Vrati na moj plan"', () => {
    asUser('neko-drugi');
    const g = adaptGeneratedPlan(
      generatePlan({
        startDate: '2026-10-05',
        raceDate: '2027-01-17',
        raceDistM: 5000,
        pb: { distM: 5000, sec: 1290 },
        weeklyKm: 40,
        runDays: 5,
        quality: 2,
        intensity: 'std',
        trainedRecently: true
      })
    );
    act(() => useTrainingStore.setState({ genPlan: g }));
    render(<Probe />);
    expect(screen.queryByRole('button', { name: 'Vrati na moj plan' })).toBeNull();
    expect(screen.getByRole('button', { name: /Napravi novi plan/ })).toBeInTheDocument();
  });
});

describe('polazni dan (Niš polumaraton)', () => {
  it('upis km i vremena menja POLAZNI VDOT plana i preračunava lanac forme u istom upisu', () => {
    asUser(ADMIN_UID);
    const before = personalBaselineVdot({});
    const plan = renderHook(() => useResolvedPlan()).result.current;
    const day = plan?.byId.get(PERSONAL.startingDay);
    if (!day) throw new Error('nema polaznog dana');
    act(() => {
      setStatus(day, 'done', TODAY);
      editField(day, 'km', '21,1', TODAY);
      editField(day, 'sec', '13000', TODAY); // 1:30:00
    });
    const log = useTrainingStore.getState().log;
    const after = personalBaselineVdot(log);
    expect(after).not.toBe(before);
    const active = renderHook(() => useActiveGenPlan()).result.current;
    expect((active?.meta as { vdot0?: number }).vdot0).toBe(after);
  });
});
