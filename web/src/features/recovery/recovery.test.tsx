import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDate } from '../../domain/date';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { resolvePlan } from '../../domain/plan';
import { acwrNow, acwrPosition, acwrText } from '../../domain/recovery';
import { seedState, type PersistedState, type WellnessRecord } from '../../domain/state';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import { hydratePersisted, useTrainingStore } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUIStore } from '../../stores/uiStore';
import { AdjustPlan } from '../plan/AdjustPlan';
import { SheetHost } from '../sheets';
import { BolScreen } from './BolScreen';
import { MasaScreen } from './MasaScreen';
import { OporavakScreen } from './OporavakScreen';

/* parity: renderOporavak, karticaOporavka, karticaPulsUMiru, karticaOpterecenja, karticaMase, openKneeSheet (app.js) — sada tri ekrana: Oporavak, Bol, Masa.
   Predlog izmene plana zbog bola je u Plan → Prilagodi plan. */

const TODAY = '2026-01-14';
function freshState(extra: Partial<PersistedState> = {}): PersistedState {
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
  return { ...s, ...extra };
}
const withSheet = (screen: ReactElement): ReactElement => (
  <>
    {screen}
    <div id="sheet">
      <SheetHost />
    </div>
  </>
);
const Oporavak = (): ReactElement => withSheet(<OporavakScreen />);
const Bol = (): ReactElement => withSheet(<BolScreen />);
const Masa = (): ReactElement => withSheet(<MasaScreen />);
const day = (n: number): string => new Date(Date.UTC(2026, 0, 14 - n)).toISOString().slice(0, 10);

beforeEach(() => {
  hydratePersisted(freshState());
  useUIStore.setState({ today: TODAY, sheet: null, confirm: null, screens: [] });
});

describe('Oporavak', () => {
  it('bez unosa: stanje danas bez povreda, bez predloga; odeljci bez podataka kažu zašto', () => {
    render(<Oporavak />);
    expect(screen.getByRole('heading', { level: 1, name: 'Oporavak' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stanje danas' })).toBeInTheDocument();
    expect(screen.queryByText('Plan se može prilagoditi')).toBeNull();
    expect(screen.getByText(/Odnos se prikazuje kad prođe bar jedna nedelja/)).toBeInTheDocument();
    expect(screen.getByText(/stižu preko intervals\.icu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Poveži intervals\.icu/ })).toBeInTheDocument();
  });

  it('jak bol: „STANI“ u stanju danas; predlog izmene plana je u Prilagodi plan i traži potvrdu', async () => {
    const user = userEvent.setup();
    hydratePersisted(
      freshState({
        knee: [{ id: 'k1', date: TODAY, pain: 7, part: 'koleno-L', act: 'Trčanje', note: '' }]
      })
    );
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const view = render(<Oporavak />);
    expect(screen.getAllByText('STANI').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Prilagodi plan' })).toBeNull();
    view.unmount();

    render(<AdjustPlan />);
    expect(screen.getByText('Zbog bola')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prilagodi plan' }));
    expect(useUIStore.getState().confirm?.text).toMatch(/^Prilagoditi plan\?/);
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() =>
      expect(Object.keys(useTrainingStore.getState().alts).length).toBeGreaterThan(0)
    );
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/prilagođen/));
    alert.mockRestore();
  });

  it('jutarnja merenja: HRV prema sopstvenoj osnovi i puls u miru (obrnut smer)', () => {
    const w: Record<string, WellnessRecord> = {};
    for (let i = 8; i >= 0; i--) {
      const d = day(i);
      w[d] = {
        datum: d,
        hrv: 60 + (i === 0 ? -12 : 0),
        pulsUMiru: 46 + (i === 0 ? 6 : 0),
        sanH: 7.4
      } as WellnessRecord;
    }
    hydratePersisted(freshState({ wellness: w }));
    render(<Oporavak />);
    expect(screen.getByRole('heading', { name: 'HRV' })).toBeInTheDocument();
    /* signal sa brojem i stanjem je jednom (Stanje danas), a odeljak ispod nosi kretanje i objašnjenje */
    expect(screen.getAllByText(/−20% od osnove 60/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('heading', { name: 'Puls u miru' })).toBeInTheDocument();
    expect(screen.getAllByText(/\+6 od osnove/).length).toBeGreaterThanOrEqual(1);
    /* HRV −20 % je crveno, pa najlošiji signal odlučuje i kaže šta da radiš */
    const ready = screen.getByRole('heading', { name: 'Stanje danas' }).closest('section');
    expect(within(ready as HTMLElement).getByText('Olakšaj')).toBeInTheDocument();
    expect(
      within(ready as HTMLElement).getByText('Oporavak zaostaje: lakši dan.')
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Dodirni tačku za detalje/).length).toBe(2);
  });

  it('opterećenje: sa četiri završene nedelje prikazuje odnos i pojas koje računa domen', () => {
    const gp = freshState().genPlan;
    if (!gp) throw new Error('plan');
    const resolved = resolvePlan(gp.weeks, { alts: {}, moves: {} });
    const log: PersistedState['log'] = {};
    for (const d of resolved.dated)
      if (d.km && d.date < '2026-02-09') log[d.id] = { status: 'done', km: d.km, ts: d.date };
    hydratePersisted(freshState({ log }));
    useUIStore.setState({ today: '2026-02-08' });
    render(<Oporavak />);
    const ctx = { plan: resolved, log, outOfPlan: {}, pain: [] };
    const now = acwrNow(ctx, '2026-02-08' as IsoDate);
    expect(now.ratio).not.toBeNull();
    const card = screen
      .getByRole('heading', { name: 'Opterećenje' })
      .closest('section') as HTMLElement;
    expect(card.querySelector('.ac-v')).toHaveTextContent(acwrText(now.ratio));
    expect(card.querySelector('.acwr i')).toHaveStyle({
      left: `${acwrPosition(now.ratio ?? 0).toFixed(1)}%`
    });
    expect(card.textContent).toMatch(
      /bezbednom pojasu|bezbednog pojasa|Iznad gornje ivice|Preko 1,5/
    );
  });
});

describe('Bol', () => {
  it('bez unosa: poziva na dodir, mapa i grafikon kažu da nema unosa', () => {
    render(<Bol />);
    expect(screen.getByRole('heading', { level: 1, name: 'Bol' })).toBeInTheDocument();
    expect(screen.getByText('Dodirni deo koji te boli')).toBeInTheDocument();
    expect(screen.getAllByText('Nema unosa.').length).toBeGreaterThan(0);
  });

  it('mapa tela: dodir otvara novi unos za taj deo; „Dodaj“ upisuje zapis sa id-jem i delom', async () => {
    const user = userEvent.setup();
    render(<Bol />);
    await user.click(screen.getByRole('button', { name: 'Levo koleno' }));
    const sheet = document.querySelector('#sheet') as HTMLElement;
    expect(within(sheet).getByText(/Novi unos — Levo koleno/)).toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText(/Bol \(0–10\)/), { target: { value: '4' } });
    await user.type(within(sheet).getByLabelText('Beleška'), '  posle brda ');
    await user.click(within(sheet).getByRole('button', { name: 'Dodaj' }));
    const k = useRecoveryStore.getState().knee;
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({
      pain: 4,
      part: 'koleno-L',
      date: TODAY,
      act: 'Trčanje',
      note: 'posle brda',
      src: null
    });
    expect(k[0]?.id).toMatch(/^k\d+$/);
    expect(useUIStore.getState().sheet).toBeNull();
    expect(screen.getByText(/1 deo tela u poslednjih 14 dana/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Levo koleno — bol 4' })).toBeInTheDocument();
  });

  it('izmena postojećeg unosa se čuva odmah; brisanje traži potvrdu', async () => {
    const user = userEvent.setup();
    hydratePersisted(
      freshState({
        knee: [{ id: 'k1', date: day(2), pain: 2, part: 'list-D', act: 'Trčanje', note: 'x' }]
      })
    );
    render(<Bol />);
    const history = screen.getByRole('heading', { name: 'Istorija' }).closest('section');
    await user.click(history?.querySelector('button.krow') as HTMLElement);
    const sheet = document.querySelector('#sheet') as HTMLElement;
    fireEvent.change(within(sheet).getByLabelText(/Bol \(0–10\)/), { target: { value: '5' } });
    expect(useRecoveryStore.getState().knee[0]?.pain).toBe(5);
    await user.selectOptions(within(sheet).getByLabelText('Deo tela'), '');
    expect(useRecoveryStore.getState().knee[0]).not.toHaveProperty('part');
    await user.click(within(sheet).getByRole('button', { name: 'Obriši unos' }));
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useRecoveryStore.getState().knee).toEqual([]));
  });
});

describe('Telesna masa', () => {
  it('greška za nemoguć unos; ispravan unos zamenjuje ručni za isti datum; brisanje traži potvrdu', async () => {
    const user = userEvent.setup();
    render(<Masa />);
    const kg = screen.getByLabelText('Masa (kg)');
    await user.type(kg, '19');
    await user.click(screen.getByRole('button', { name: 'Sačuvaj merenje' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Masa mora biti između 20 i 300 kg.');
    await user.clear(kg);
    await user.type(kg, '79,44');
    await user.click(screen.getByRole('button', { name: 'Sačuvaj merenje' }));
    expect(useRecoveryStore.getState().kg).toEqual([{ date: TODAY, kg: 79.4 }]);
    expect(screen.queryByRole('alert')).toBeNull();
    await user.type(screen.getByLabelText('Masa (kg)'), '79');
    await user.click(screen.getByRole('button', { name: 'Sačuvaj merenje' }));
    expect(useRecoveryStore.getState().kg).toEqual([{ date: TODAY, kg: 79 }]);
    await user.click(screen.getByText(/Sva merenja/));
    await user.click(screen.getByRole('button', { name: /Obriši merenje 79 kg/ }));
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() => expect(useRecoveryStore.getState().kg).toEqual([]));
  });

  it('merenja pre početka plana: dugme je tu samo kad ih ima, i briše baš ta merenja', async () => {
    const user = userEvent.setup();
    hydratePersisted(
      freshState({
        kg: [
          { date: '2025-12-01', kg: 82 },
          { date: '2025-12-20', kg: 81.5 },
          { date: '2026-01-10', kg: 80 }
        ]
      })
    );
    render(<Masa />);
    await user.click(screen.getByRole('button', { name: /Obriši 2 merenja pre 05\.01\./ }));
    act(() => useUIStore.getState().confirm?.resolve(true));
    await waitFor(() =>
      expect(useRecoveryStore.getState().kg).toEqual([{ date: '2026-01-10', kg: 80 }])
    );
    expect(screen.queryByRole('button', { name: /pre 05\.01\./ })).toBeNull();
  });
});
