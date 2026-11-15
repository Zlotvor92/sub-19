import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedState, type PersistedState } from '../../domain/state';
import { ADMIN_UID } from '../../services/config';
import { hydratePersisted, useTrainingStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { addTest } from '../../stores/raceActions';
import { useUIStore } from '../../stores/uiStore';
import { AdjustPlan } from '../plan/AdjustPlan';
import { SheetHost } from '../sheets';
import { FormScreen } from './FormScreen';

/* parity: renderPred, t3kKarta, openT3kSheet, vdotPredlog (app.js) — ekran „Forma i predikcija“ (Napredak) i predlog tempa u Plan → Prilagodi plan.
   V1b: ovaj ekran (lanac forme, test 3 km, predlog tempa) pripada planu koji obrađuje v1 generator, a posle brisanja v1 to
   je SAMO ugrađeni lični plan vlasnika (zamrznut HM v1, `LEGACY_PERSONAL_GENERATOR`; polumaraton, cilj 1:40:00). Plan v2
   ima svoj ekran forme (`*V2Adapt.test.tsx`). Lični plan se ne upisuje, pa se predlog tempa prikazuje ali ne primenjuje. */

function freshState(): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  s.genPlan = null;
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
  useAuthStore.setState({ configured: true, hasSession: true, userId: ADMIN_UID, email: null });
  hydratePersisted(freshState());
  useUIStore.setState({ today: '2026-11-20', sheet: null, confirm: null, screens: [] });
});

describe('Forma i predikcija', () => {
  it('bez unosa: verdikt kaže „Još nema merenja", cilj i polazna forma iz plana, nema predloga', () => {
    const { container } = render(<Screen />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Forma i predikcija' })
    ).toBeInTheDocument();
    expect(container.querySelector('header.screen-head p')).toHaveTextContent(/cilj 1:40:00$/);
    expect(screen.getByText('Još nema merenja')).toBeInTheDocument();
    expect(screen.getByText('Procena će se pojaviti posle prvog merenja.')).toBeInTheDocument();
    expect(screen.getByText(/Trend se prikazuje kad budu bar 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unesi test na 3 km' })).toBeInTheDocument();
    expect(screen.queryByText('Prilagodi tempo')).toBeNull(); // predlog tempa živi u Plan → Prilagodi plan
    /* polazna tačka i cilj su na osi puta do cilja, procena danas još nije */
    const journey = container.querySelector('.journey');
    expect(journey?.getAttribute('aria-label')).toMatch(
      /^Put do cilja: start [\d:]+, cilj 1:40:00/
    );
    expect(journey?.getAttribute('aria-label')).not.toMatch(/sada/);
    expect(journey?.getAttribute('aria-label')).not.toMatch(/plan vodi do/);
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
    expect(within(rows[2] as HTMLElement).getByText('tvoja trka')).toBeInTheDocument();
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
      'Unesi vreme, pa se ispod prikaže šta znači.'
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
      /^Tempo 3:54\/km · VDOT \d+,\d · predikcija [\d:]+$/
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
      addTest('2026-11-10', 720, 'aaaaa');
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
      addTest('2026-11-05', 660, 'aaaaa');
      addTest('2026-11-15', 600, 'bbbbb');
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

  it('predlog tempa nad ličnim planom: Forma ne nosi radnju nad planom; plan se ne upisuje', () => {
    act(() => {
      addTest('2026-11-03', 600 + 40, 'a1a1a');
      addTest('2026-11-07', 600 + 30, 'a2a2a');
      addTest('2026-11-12', 600 + 20, 'a3a3a');
      addTest('2026-11-17', 600 + 10, 'a4a4a');
    });
    expect(useTrainingStore.getState().t3k).toHaveLength(4);
    render(<Screen />);
    expect(screen.queryByText('Merenja ukazuju na brži tempo')).toBeNull(); // Forma i predikcija ne nosi radnju nad planom
    cleanup();
    render(<AdjustPlan />);
    expect(useTrainingStore.getState().genPlan).toBeNull();
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
    expect(req[1]).toMatch(/cilj 1:40:00/);

    trend.mockResolvedValueOnce({ ok: true, text: '**Forma** raste.' });
    await user.click(screen.getByRole('button', { name: /Objasni trend/ }));
    expect(await screen.findByText('Forma')).toBeInTheDocument();
    setApp(null);
  });
});
