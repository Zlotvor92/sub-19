import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { resolvePlan, type ResolvedDay } from '../../domain/plan';
import { seedState, type PersistedState } from '../../domain/state';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import { hydratePersisted, useTrainingStore } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';
import { SheetHost } from '../sheets';
import { DayScreen } from '../day/DayScreen';
import PlanPage from './index';
import { PlanOverview } from './PlanOverview';
import { dayRowState } from './DayRow';

/* parity: renderPlan / nedeljaTelo / openDaySheet / renderWeekSwap / renderAltSheet (app.js) — Plan (jedna nedelja), Pregled celog plana, Detalji treninga. */

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
  const t = useTrainingStore.getState();
  if (!t.genPlan) throw new Error('nema plana');
  return resolvePlan(t.genPlan.weeks, { alts: t.alts, moves: t.moves }).dated;
};
const firstOf = (p: (d: ResolvedDay) => boolean, from = 0): ResolvedDay => {
  const d = days().find((x, i) => i >= from && p(x));
  if (!d) throw new Error('nema dana');
  return d;
};
const withSheet = (screen: ReactElement): ReactElement => (
  <>
    {screen}
    <div id="sheet">
      <SheetHost />
    </div>
  </>
);
const Screen = (): ReactElement => withSheet(<PlanPage />);
const Overview = (): ReactElement => withSheet(<PlanOverview />);

beforeEach(() => {
  hydratePersisted(freshState());
  useUIStore.setState({ today: '2026-01-14', sheet: null, confirm: null, screens: [] });
});
afterEach(() => vi.useRealTimers());

describe('Plan (jedna nedelja)', () => {
  it('tekuća nedelja: naslov, sedam dana sa stanjem, današnji dan istaknut; ‹ › pomeraju nedelju', async () => {
    const user = userEvent.setup();
    act(() =>
      useTrainingStore
        .getState()
        .patchLog(firstOf((d) => !d.rest && d.w === 2 && d.date < '2026-01-14').id, {
          status: 'done',
          km: 6
        })
    );
    render(<Screen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tvoj plan' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /^Nedelja 2 od / })).toBeInTheDocument();
    expect(screen.getByText(/ova nedelja/)).toBeInTheDocument();
    const rows = document.querySelectorAll('.rows .plan-row');
    expect(rows).toHaveLength(7);
    expect(document.querySelectorAll('.plan-row.is-today')).toHaveLength(1);
    expect(document.querySelectorAll('.plan-row.s-done').length).toBeGreaterThanOrEqual(1);
    await user.click(screen.getByRole('button', { name: 'Sledeća nedelja' }));
    expect(screen.getByRole('heading', { level: 2, name: /^Nedelja 3 od / })).toBeInTheDocument();
    expect(screen.queryByText(/ova nedelja/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Prethodna nedelja' }));
    await user.click(screen.getByRole('button', { name: 'Prethodna nedelja' }));
    expect(screen.getByRole('heading', { level: 2, name: /^Nedelja 1 od / })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prethodna nedelja' })).toBeDisabled();
  });

  it('dodir na dan otvara Detalje treninga; radnje vode na svoja mesta', async () => {
    const user = userEvent.setup();
    render(<Screen />);
    await user.click(document.querySelector('.plan-row.is-today') as HTMLElement);
    const top = useUIStore.getState().screens.at(-1);
    expect(top?.kind).toBe('trening');
    await user.click(screen.getByRole('button', { name: /Pomeri treninge/ }));
    expect(useUIStore.getState().sheet).toMatchObject({ kind: 'swap', props: { w: 2 } });
    act(() => useUIStore.getState().closeSheet());
    await user.click(screen.getByRole('button', { name: /Prilagodi plan/ }));
    expect(useUIStore.getState().screens.at(-1)?.kind).toBe('plan-prilagodi');
    await user.click(screen.getByRole('button', { name: 'Pregled celog plana' }));
    expect(useUIStore.getState().screens.at(-1)?.kind).toBe('plan-pregled');
    expect(screen.queryByRole('button', { name: /Pošalji na sat/ })).toBeNull(); // bez intervals.icu nema slanja
  });

  it('stanje dana: odmor, današnji, predstojeći, završen, preskočen i propušten se razlikuju', () => {
    const lastEntry = (status: 'done' | 'skip') => ({ status });
    const run = firstOf((x) => !x.rest && x.w === 2);
    const rest = firstOf((x) => x.rest && !!x.date);
    expect(dayRowState(rest, undefined, '2026-01-01')).toBe('rest');
    expect(dayRowState(rest, undefined, rest.date)).toBe('today');
    expect(dayRowState(run, undefined, '2026-01-01')).toBe('next');
    expect(dayRowState(run, undefined, run.date)).toBe('today');
    expect(dayRowState(run, undefined, '2030-01-01')).toBe('miss');
    expect(dayRowState(run, lastEntry('done'), '2030-01-01')).toBe('done');
    expect(dayRowState(run, lastEntry('skip'), '2030-01-01')).toBe('skip');
  });
});

describe('Pregled celog plana', () => {
  it('sažetak: traka napretka i činjenice; faze; nedelje se otvaraju dodirom i nose dane', async () => {
    const user = userEvent.setup();
    act(() =>
      useTrainingStore.getState().patchLog(firstOf((d) => d.km === 8 || (d.km ?? 0) > 5).id, {
        status: 'done',
        km: 6
      })
    );
    render(<Overview />);
    expect(screen.getByText('od plana do sada')).toBeInTheDocument();
    expect(screen.getByText('ceo plan')).toBeInTheDocument();
    expect(screen.getByText('Nedeljna kilometraža')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'BAZA' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'TRKA' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pomeri treninge' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Nedelja 2' }));
    expect(screen.getByRole('button', { name: 'Nedelja 2' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText(/tekuća nedelja/)).toBeInTheDocument(); // 14.1. je u N2
    expect(screen.getByRole('button', { name: 'Pomeri treninge' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nedelja 2' }));
    expect(screen.queryByRole('button', { name: 'Pomeri treninge' })).toBeNull();
  });

  it('grafikon: dodir na nedelju pokazuje plan i urađeno, isti dodir poništava', async () => {
    const user = userEvent.setup();
    const { container } = render(<Overview />);
    expect(screen.getByText('Dodirni nedelju za detalje')).toBeInTheDocument();
    const col = container.querySelector('[data-wk="3"]');
    expect(col).not.toBeNull();
    await user.click(col as Element);
    expect(screen.getByText(/^N3 · plan .* km · urađeno/)).toBeInTheDocument();
    await user.click(col as Element);
    expect(screen.getByText('Dodirni nedelju za detalje')).toBeInTheDocument();
  });
});

describe('Detalji treninga', () => {
  const Details = ({ id }: { id: string }): ReactElement => withSheet(<DayScreen id={id} />);

  it('status i brisanje unosa (uz bol/težinu); brisanje zatvara ekran', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => !x.rest && x.tag === 'lako' && x.w === 2);
    act(() => useUIStore.getState().openScreen({ kind: 'trening', props: { id: d.id } }));
    render(<Details id={d.id} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Odrađen' }));
    expect(useTrainingStore.getState().log[d.id]?.status).toBe('done');
    await user.click(screen.getByText(/Više detalja/));
    await user.type(screen.getByLabelText(/Telesna masa/), '80');
    expect(useRecoveryStore.getState().kg.some((k) => k.src === d.id)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Obriši unos' }));
    expect(useUIStore.getState().confirm?.text).toBe('Obriši sve unete podatke za ovaj trening?');
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useTrainingStore.getState().log[d.id]).toBeUndefined());
    expect(useRecoveryStore.getState().kg.some((k) => k.src === d.id)).toBe(false);
    expect(useUIStore.getState().screens).toEqual([]);
  });

  it('dok trening predstoji, „Prilagodi trening“ nosi pomeranje i izmenu; posle odrađenog ih nema', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => !x.rest && x.tag === 'lako' && x.w === 3);
    render(<Details id={d.id} />);
    expect(screen.getByRole('button', { name: /Pomeri na drugi dan/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Zameni ili skrati/ }));
    expect(useUIStore.getState().sheet).toMatchObject({ kind: 'alt', props: { id: d.id } });
    act(() => useUIStore.getState().closeSheet());
    await user.click(screen.getByRole('button', { name: 'Odrađen' }));
    expect(screen.queryByRole('button', { name: /Pomeri na drugi dan/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Zameni ili skrati/ })).toBeNull();
  });

  it('dan odmora nema ni status ni formu, samo prilagođavanje', () => {
    const d = firstOf((x) => x.rest && !!x.date);
    render(<Details id={d.id} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Odmor' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Odrađen' })).toBeNull();
    expect(screen.queryByLabelText(/Distanca/)).toBeNull();
    expect(screen.getByRole('button', { name: /Dodaj trening/ })).toBeInTheDocument();
  });

  it('dan koji više ne postoji: poruka umesto praznog ekrana', () => {
    render(<Details id="nema-ga" />);
    expect(screen.getByText('Ovaj dan više ne postoji u planu.')).toBeInTheDocument();
  });
});

describe('Pomeranje i izmena dana (listovi)', () => {
  it('pomeranje: dva dodira zamenjuju dane, odrađen dan je zaključan, „Vrati" čisti raspored', async () => {
    const user = userEvent.setup();
    const w2 = days().filter((d) => d.w === 2 && !d.test);
    const [a, b, c] = w2 as [ResolvedDay, ResolvedDay, ResolvedDay];
    act(() => useTrainingStore.getState().patchLog(c.id, { status: 'done' }));
    render(<Screen />);
    act(() => useUIStore.getState().openSheet({ kind: 'swap', props: { w: 2 } }));
    const list = document.querySelector('.swap-list') as HTMLElement;
    const buttons = within(list).getAllByRole('button');
    expect(buttons.length).toBe(w2.length - 1); // odrađen dan nije dugme
    await user.click(buttons[0] as HTMLElement);
    expect(screen.getByText(/Izabrano:/)).toBeInTheDocument();
    await user.click(buttons[1] as HTMLElement);
    const moves = useTrainingStore.getState().moves;
    expect(moves[a.id]).toBe(b.date);
    expect(moves[b.id]).toBe(a.date);
    await user.click(screen.getByRole('button', { name: 'Vrati raspored nedelje na plan' }));
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useTrainingStore.getState().moves).toEqual({}));
  });

  it('izmena treninga: tip, km i opis se čuvaju kao izmena; „Vrati na plan" je briše', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => !x.rest && x.tag === 'lako' && x.w === 3);
    render(<Screen />);
    act(() => useUIStore.getState().openSheet({ kind: 'alt', props: { id: d.id } }));
    await user.click(screen.getByRole('button', { name: 'Tempo' }));
    expect(screen.getByLabelText(/Ciljni tempo/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Kilometraža'));
    await user.type(screen.getByLabelText('Kilometraža'), '9');
    await user.clear(screen.getByLabelText(/Ciljni tempo/)); // polje je popunjeno predlogom (tempo kvalitetne sesije)
    await user.type(screen.getByLabelText(/Ciljni tempo/), '410');
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }));
    const alt = useTrainingStore.getState().alts[d.id];
    expect(alt).toMatchObject({ tag: 'tempo', km: 9, pace: 250 });
    expect(useUIStore.getState().sheet).toBeNull();
    act(() => useUIStore.getState().openSheet({ kind: 'alt', props: { id: d.id } }));
    expect(screen.getByText(/· izmenjen/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vrati na plan' }));
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useTrainingStore.getState().alts[d.id]).toBeUndefined());
  });

  it('izmena odrađenog treninga se odbija sa razlogom', async () => {
    const user = userEvent.setup();
    const d = firstOf((x) => !x.rest && x.tag === 'lako' && x.w === 3);
    act(() => useTrainingStore.getState().patchLog(d.id, { status: 'done' }));
    render(<Screen />);
    act(() => useUIStore.getState().openSheet({ kind: 'alt', props: { id: d.id } }));
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }));
    expect(screen.getByRole('alert')).toHaveTextContent('odrađen trening se ne menja');
    expect(useTrainingStore.getState().alts[d.id]).toBeUndefined();
  });

  it('dugo držanje „Snaga" uz trčanje dodaje snagu; kratak dodir je bira umesto trčanja', () => {
    vi.useFakeTimers();
    const d = firstOf((x) => !x.rest && x.tag === 'lako' && x.w === 3);
    render(<Screen />);
    act(() => useUIStore.getState().openSheet({ kind: 'alt', props: { id: d.id } }));
    const snaga = screen.getByRole('button', { name: 'Snaga' });
    act(() => {
      snaga.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      vi.advanceTimersByTime(700);
    });
    expect(snaga).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Lako' })).toHaveAttribute('aria-pressed', 'true');
    act(() => snaga.click()); // klik koji sledi držanje je progutan
    expect(screen.getByRole('button', { name: 'Lako' })).toHaveAttribute('aria-pressed', 'true');
  });
});
