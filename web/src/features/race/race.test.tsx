import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { seedState, type PersistedState } from '../../domain/state';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import { hydratePersisted, useTrainingStore } from '../../stores';
import { addTest } from '../../stores/raceActions';
import { useUIStore } from '../../stores/uiStore';
import { AdjustPlan } from '../plan/AdjustPlan';
import { SheetHost } from '../sheets';
import { FormScreen } from './FormScreen';

/* parity: renderPred, t3kKarta, openT3kSheet, vdotPredlog (app.js) — ekran „Forma i predikcija“ (Napredak) i predlog tempa u Plan → Prilagodi plan. */

function freshState(): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: '2026-01-05',
      raceDate: '2026-04-12',
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2700 },
      goalSec: 2520,
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
const Screen = () => (
  <>
    <FormScreen />
    <div id="sheet">
      <SheetHost />
    </div>
  </>
);

beforeEach(() => {
  hydratePersisted(freshState());
  useUIStore.setState({ today: '2026-02-20', sheet: null, confirm: null, screens: [] });
});

describe('Forma i predikcija', () => {
  it('bez unosa: verdikt kaže „Još nema merenja", cilj i polazna forma iz plana, nema predloga', () => {
    const { container } = render(<Screen />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Forma i predikcija' })
    ).toBeInTheDocument();
    expect(container.querySelector('header.screen-head p')).toHaveTextContent(/cilj 42:00$/);
    expect(screen.getByText('Još nema merenja')).toBeInTheDocument();
    expect(screen.getByText('Procena će se pojaviti posle prvog merenja.')).toBeInTheDocument();
    expect(screen.getByText(/Trend se prikazuje kad budu bar 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unesi test na 3 km' })).toBeInTheDocument();
    expect(screen.queryByText('Prilagodi tempo')).toBeNull(); // predlog tempa živi u Plan → Prilagodi plan
    /* polazna tačka i cilj su na osi puta do cilja, procena danas još nije */
    const journey = container.querySelector('.journey');
    expect(journey?.getAttribute('aria-label')).toMatch(
      /^Put do cilja: start \d+:\d\d, cilj 42:00/
    );
    expect(journey?.getAttribute('aria-label')).not.toMatch(/sada/);
  });

  it('tempo svakog trčanja: odeljak postoji i bez trčanja kaže šta da se uradi', () => {
    render(<Screen />);
    const sec = screen.getByRole('heading', { name: 'Tempo svakog trčanja' }).closest('section');
    expect(sec).not.toBeNull();
    expect(within(sec as HTMLElement).getByText(/trend se crta automatski/)).toBeInTheDocument();
  });

  it('procene po distancama: iz polazne forme dok nema merenja, a trka iz plana je označena', () => {
    render(<Screen />);
    const card = screen.getByRole('heading', { name: 'Procena po distancama' }).closest('section');
    expect(card).not.toBeNull();
    const rows = within(card as HTMLElement).getAllByRole('listitem');
    expect(rows.map((r) => r.querySelector('.rt-n')?.firstChild?.textContent)).toEqual([
      '5 km',
      '10 km',
      'Polumaraton',
      'Maraton'
    ]);
    expect(within(rows[1] as HTMLElement).getByText('tvoja trka')).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText(/Iz polazne forme, VDOT/)).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText('Procena')).toBeInTheDocument();
  });

  it('test na 3 km: živa provera; nemoguće vreme se ne upisuje; ispravno ulazi u listu i lanac forme', async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(<Screen />);
    await user.click(screen.getByRole('button', { name: 'Unesi test na 3 km' }));
    const sheet = document.querySelector('#sheet') as HTMLElement;
    expect(within(sheet).getByRole('status')).toHaveTextContent(
      'Unesi vreme pa se ispod prikaže šta znači.'
    );
    await user.type(within(sheet).getByLabelText('Vreme'), '600');
    expect(within(sheet).getByRole('status')).toHaveTextContent(
      /Vreme za 3 km mora biti između 7:20 i /
    );
    await user.click(within(sheet).getByRole('button', { name: 'Sačuvaj' }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(useTrainingStore.getState().t3k).toEqual([]);
    await user.clear(within(sheet).getByLabelText('Vreme'));
    await user.type(within(sheet).getByLabelText('Vreme'), '1142');
    expect(within(sheet).getByRole('status')).toHaveTextContent(
      /^Tempo 3:54\/km · VDOT \d+,\d · predikcija \d+:\d\d$/
    );
    await user.click(within(sheet).getByRole('button', { name: 'Sačuvaj' }));
    const t = useTrainingStore.getState();
    expect(t.t3k).toHaveLength(1);
    expect(t.t3k[0]).toMatchObject({ sec: 702 });
    expect(t.t3k[0]?.id).toMatch(/^t3k-\d{4}-\d{2}-\d{2}-[a-z0-9]+$/);
    expect(t.vdotLog).toHaveLength(1);
    expect(t.vdotLog[0]).toMatchObject({ id: t.t3k[0]?.id, vdotMigrated: true });
    expect(t.vdotLog[0]?.vdot).not.toBeNull();
    expect(useUIStore.getState().sheet).toBeNull();
    expect(screen.queryByText('Još nema merenja')).toBeNull();
    expect(screen.getByRole('button', { name: 'Novi test' })).toBeInTheDocument();
    alert.mockRestore();
  });

  it('izmena testa preračunava lanac; brisanje traži potvrdu i čisti lanac', async () => {
    const user = userEvent.setup();
    act(() => {
      addTest('2026-02-10', 720, 'aaaaa');
    });
    render(<Screen />);
    const before = useTrainingStore.getState().vdotLog[0]?.vdot;
    await user.click(screen.getByRole('button', { name: /izmeni/ }));
    const sheet = document.querySelector('#sheet') as HTMLElement;
    const time = within(sheet).getByLabelText('Vreme');
    await user.clear(time);
    await user.type(time, '1100');
    await user.click(within(sheet).getByRole('button', { name: 'Sačuvaj izmenu' }));
    const after = useTrainingStore.getState().vdotLog[0]?.vdot;
    expect(after).toBeGreaterThan(before as number);
    expect(useTrainingStore.getState().t3k[0]?.sec).toBe(660);
    await user.click(screen.getByRole('button', { name: /izmeni/ }));
    await user.click(
      within(document.querySelector('#sheet') as HTMLElement).getByRole('button', {
        name: 'Obriši test'
      })
    );
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useTrainingStore.getState().t3k).toEqual([]));
    expect(useTrainingStore.getState().vdotLog).toEqual([]);
  });

  it('dva testa daju VDOT trend; raniji test se otvara iz liste', async () => {
    const user = userEvent.setup();
    act(() => {
      addTest('2026-01-20', 760, 'aaaaa');
      addTest('2026-02-15', 700, 'bbbbb');
    });
    const { container } = render(<Screen />);
    expect(container.querySelector('#vdottrend svg')).not.toBeNull();
    expect(screen.getByText('Raniji testovi')).toBeInTheDocument();
    /* brži drugi test → forma je viša od polazne → odgovor „Da", a procena i projekcija su na osi */
    expect(screen.getByText('Da')).toBeInTheDocument();
    expect(container.querySelector('.journey')?.getAttribute('aria-label')).toMatch(
      /sada · procena/
    );
    expect(screen.getByText(/Merenja u lancu forme: 2\. Malo merenja/)).toBeInTheDocument();
    const tests = screen
      .getByRole('heading', { name: 'Test 3 km' })
      .closest('section') as HTMLElement;
    const older = within(tests)
      .getAllByRole('button')
      .find((b) => b.className === 'row') as HTMLElement;
    await user.click(older);
    expect(document.querySelector('#sheet .sh-t')).toHaveTextContent('Test 3 km —');
    expect(useTrainingStore.getState().vdotLog[1]?.prev).toBe(
      useTrainingStore.getState().vdotLog[0]?.vdot
    );
  });

  it('predlog prilagođavanja tempa: kad je forma daleko ispred plana; primena menja SAMO tempo (paceAuto), poništavanje ga vraća', async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    act(() => {
      addTest('2026-01-20', 600 + 40, 'a1a1a');
      addTest('2026-01-27', 600 + 30, 'a2a2a');
      addTest('2026-02-03', 600 + 20, 'a3a3a');
      addTest('2026-02-10', 600 + 10, 'a4a4a');
    });
    expect(useTrainingStore.getState().t3k).toHaveLength(4);
    render(<Screen />);
    expect(screen.queryByText('Forma je ispred plana')).toBeNull(); // Forma i predikcija ne nosi radnju nad planom
    cleanup();
    render(<AdjustPlan />);
    expect(screen.getByText('Forma je ispred plana')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Prilagodi tempo' });
    const planBefore = JSON.stringify(useTrainingStore.getState().genPlan);
    await user.click(btn);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() =>
      expect(Object.values(useTrainingStore.getState().alts).some((a) => a.paceAuto)).toBe(true)
    );
    for (const a of Object.values(useTrainingStore.getState().alts)) expect(a.paceAuto).toBe(true);
    expect(await screen.findByText('Tempi su prilagođeni tvojoj formi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vrati planski tempo' }));
    await waitFor(() => expect(useTrainingStore.getState().alts).toEqual({}));
    expect(JSON.stringify(useTrainingStore.getState().genPlan)).toBe(planBefore); // tempo sesija se vratio na izvorni
    alert.mockRestore();
  });
});

describe('Forma · AI trend', () => {
  it('manje od 3 odrađena treninga: poruka sa brojem, bez poziva ka serveru; sa dovoljno: tekst iz odgovora', async () => {
    const trend = vi.fn();
    const { setApp } = await import('../../app/appContext');
    setApp({ ai: { trend } } as never);
    trend.mockResolvedValueOnce({
      ok: false,
      error: 'Za trend analizu treba bar 3 odrađena treninga. Trenutno: 0. Nakupljaj kroz nedelje.'
    });
    render(<Screen />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Objasni trend/ }));
    expect(await screen.findByText(/Trenutno: 0/)).toHaveClass('err');
    const req = trend.mock.calls[0] as [{ treninzi: unknown[] }, string];
    expect(req[0].treninzi).toEqual([]);
    expect(req[1]).toMatch(/ciljno vreme 42:00/);

    trend.mockResolvedValueOnce({ ok: true, text: '**Forma** raste.' });
    await user.click(screen.getByRole('button', { name: /Objasni trend/ }));
    expect(await screen.findByText('Forma')).toBeInTheDocument();
    setApp(null);
  });
});
