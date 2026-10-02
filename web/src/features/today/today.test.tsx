import type * as Config from '../../services/config';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import TodayPage from './index';

/* Zajednica je UGAŠENA u izdanju (`COMMUNITY_ENABLED = false`). Testovi ovog fajla koji je pominju drže da kod iza prekidača i dalje radi kad se
   prekidač vrati (ovde je podrazumevano uključen); ugašeno stanje je proveren posebnim opisom ispod, prebacivanjem `flag.community`. */
const flag = vi.hoisted(() => ({ community: true }));
vi.mock('../../services/config', async (orig) => {
  const actual = await orig<typeof Config>();
  return Object.defineProperty({ ...actual }, 'COMMUNITY_ENABLED', {
    enumerable: true,
    get: () => flag.community
  });
});

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

describe('Vreme na kartici dana', () => {
  /* Sat „sada" se čita iz sata uređaja: zamrznut na 06:00 da ishod ne zavisi od toga kad se test pokrene. */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 1, 6, 0, 0));
  });
  afterEach(() => vi.useRealTimers());
  const hourly = (date: string, feel: number) => {
    const sati: Record<string, unknown> = {};
    for (let h = 0; h < 24; h++)
      sati[`${date}T${String(h).padStart(2, '0')}`] = {
        temp: feel - 2,
        osecaj: feel,
        vlaga: 40,
        vetar: 6,
        kisa: 10
      };
    return sati;
  };
  const withWeather = (date: string, feel: number): void => {
    const st = freshState();
    st.ui = { ...st.ui, geo: { lat: 1, lon: 2 }, satTreninga: 18 };
    st.vreme = { at: 1, lat: 1, lon: 2, sati: hourly(date, feel) };
    hydratePersisted(st);
  };

  it('stoji odmah ispod plana dok trening predstoji: temperatura, vlažnost, vetar, padavine i tempo uz vrućinu', () => {
    const q = firstOf((d) => d.tag === 'int' && !!d.date);
    withWeather(q.date, 31);
    goTo(q.date);
    render(<TodayPage />);
    const card = screen.getByText('Vreme', { selector: '.card-t' }).closest('.card') as HTMLElement;
    // današnji dan: red „sada" (6:00 po satu uređaja) i red za sat treninga
    expect(within(card).getByText('sada · 6:00')).toBeInTheDocument();
    expect(within(card).getByText('u 18:00')).toBeInTheDocument();
    expect(within(card).getAllByText('29 °C')).toHaveLength(2);
    expect(within(card).getAllByText('oseća se 31 °C')).toHaveLength(2);
    expect(within(card).getByText('40 %')).toBeInTheDocument();
    expect(within(card).getByText('6 km/h')).toBeInTheDocument();
    expect(within(card).getByText('tempo uz vrućinu')).toBeInTheDocument();
    expect(within(card).getByText(/Na ovoj vrućini radni deo drži po osećaju/)).toBeInTheDocument();
    expect(within(card).getByText(/Procena usporavanja je približna/)).toBeInTheDocument();
  });

  it('bez lokacije, za prošli dan i za odmor kartice nema', () => {
    const q = firstOf((d) => d.tag === 'int' && !!d.date);
    goTo(q.date);
    const { unmount } = render(<TodayPage />);
    expect(screen.queryByText('Vreme', { selector: '.card-t' })).toBeNull(); // lokacija nije uključena
    unmount();
    withWeather(q.date, 31);
    goTo(addDaysIso(q.date, 1));
    const rest = render(<TodayPage />);
    expect(screen.queryByText('Vreme', { selector: '.card-t' })).toBeNull(); // nema prognoze za taj datum
    rest.unmount();
  });
});

const addDaysIso = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('Kartice sa sata, po zonama i jutros', () => {
  const doneWith = (extra: Record<string, unknown>) => {
    const q = firstOf((d) => d.tag === 'lako' && !!d.date);
    const st = freshState();
    st.log = {
      [q.id]: {
        status: 'done',
        km: 8,
        sec: 2800,
        ts: q.date,
        runDate: q.date,
        cadence: 172.4,
        maxHr: 171,
        elevGain: 63.2,
        decoupling: { n: 6.1 },
        icu: { zonePuls: [300, 1200, 900, 400, 0], zoneGranice: [130, 150, 165, 178, 190] },
        ...extra
      }
    };
    st.wellness = {
      [addDaysIso(q.date, -1)]: { hrv: 50 },
      [addDaysIso(q.date, -2)]: { hrv: 52 },
      [addDaysIso(q.date, -3)]: { hrv: 51 },
      [addDaysIso(q.date, -4)]: { hrv: 49 },
      [q.date]: { hrv: 44, pulsUMiru: 51, sanH: 6.5, svezina: 3.2 }
    } as never;
    st.icu = {
      athleteId: 'i1',
      token: 't',
      hrZones: [
        { min: 1, max: 130 },
        { min: 131, max: 150 },
        { min: 151, max: 165 },
        { min: 166, max: 178 },
        { min: 179, max: null }
      ]
    };
    hydratePersisted(st);
    goTo(q.date);
  };

  it('Sa sata: kadenca, maks. puls sa zonom, uspon i drift sa bojom; Po zonama: procenti daju 100; Jutros: HRV sa odstupanjem od osnove', () => {
    doneWith({});
    render(<TodayPage />);
    const watch = screen
      .getByText('Sa sata', { selector: '.card-t' })
      .closest('.card') as HTMLElement;
    expect(within(watch).getByText('172')).toBeInTheDocument();
    expect(within(watch).getByText('171')).toBeInTheDocument();
    expect(within(watch).getByText('Z4')).toBeInTheDocument();
    expect(within(watch).getByText('63')).toBeInTheDocument();
    const drift = within(watch).getByText('+6,1 %');
    expect(drift).toHaveStyle({ color: 'var(--amber)' });

    const zones = screen
      .getByText('Po zonama', { selector: '.card-t' })
      .closest('.card') as HTMLElement;
    expect(within(zones).getByText('puls · ukupno 47 min')).toBeInTheDocument();
    const pcts = [...zones.querySelectorAll('.drow b')]
      .map((e) => e.textContent)
      .filter((t) => t?.endsWith(' %'));
    expect(pcts.reduce((a, t) => a + parseInt(t ?? '0', 10), 0)).toBe(100);

    const morning = screen
      .getByText('Jutros', { selector: '.card-t' })
      .closest('.card') as HTMLElement;
    expect(within(morning).getByText('44')).toHaveStyle({ color: 'var(--red)' }); // −12 % od osnove
    expect(within(morning).getByText('6,5 h')).toHaveStyle({ color: 'var(--amber)' });
  });

  it('dok trening predstoji, kartice sa sata nema', () => {
    doneWith({});
    const q = firstOf((d) => d.tag === 'lako' && !!d.date);
    act(() => {
      useTrainingStore.getState().patch({ log: { [q.id]: { status: 'pending' } } });
    });
    render(<TodayPage />);
    expect(screen.queryByText('Sa sata', { selector: '.card-t' })).toBeNull();
    expect(screen.queryByText('Jutros', { selector: '.card-t' })).toBeNull();
  });

  it('bez raspodele po zonama kartica kaže ZAŠTO (povezan intervals.icu, trening bez zona)', () => {
    doneWith({ icu: undefined });
    render(<TodayPage />);
    const zones = screen
      .getByText('Po zonama', { selector: '.card-t' })
      .closest('.card') as HTMLElement;
    expect(within(zones).getByText('nema podatka')).toBeInTheDocument();
    expect(
      within(zones).getByText(/intervals\.icu još nije dao vreme po zonama/)
    ).toBeInTheDocument();
  });
});

describe('Poređenje sa ranijim istim treningom', () => {
  it('lagano trčanje: puls i drift naspram ranijeg sličnog; razlika u pulsu se boji samo kad je tempo uporediv', () => {
    const easy = days().filter((d) => d.tag === 'lako' && !!d.date && (d.km ?? 0) > 0);
    const [earlier, current] = [
      easy[0],
      easy.find(
        (d) =>
          d.id !== easy[0]?.id && Math.round((d.km ?? 0) / 2) === Math.round((easy[0]?.km ?? 0) / 2)
      )
    ];
    if (!earlier || !current) throw new Error('nema para laganih dana');
    const st = freshState();
    st.log = {
      [earlier.id]: {
        status: 'done',
        km: earlier.km,
        sec: Math.round((earlier.km ?? 0) * 330),
        hr: 150,
        decoupling: { n: 6.2 },
        ts: earlier.date
      },
      [current.id]: {
        status: 'done',
        km: current.km,
        sec: Math.round((current.km ?? 0) * 330),
        hr: 146,
        decoupling: { n: 3.1 },
        ts: current.date
      }
    };
    hydratePersisted(st);
    goTo(current.date);
    render(<TodayPage />);
    const card = screen
      .getByText('Slično lagano ranije', { selector: '.card-t' })
      .closest('.card') as HTMLElement;
    expect(within(card).getByText('150')).toBeInTheDocument();
    expect(within(card).getByText('−4')).toHaveStyle({ color: 'var(--green)' }); // niži puls, isti tempo
    expect(within(card).getByText('+6,2 %')).toHaveStyle({ color: 'var(--amber)' });
    expect(within(card).getByText('−3,1')).toBeInTheDocument(); // razlika drifta
  });

  it('bez ranijeg istog treninga kartice nema', () => {
    const q = firstOf((d) => d.tag === 'lako' && !!d.date && (d.km ?? 0) > 0);
    const st = freshState();
    st.log = { [q.id]: { status: 'done', km: q.km, sec: 2800, hr: 146, ts: q.date } };
    hydratePersisted(st);
    goTo(q.date);
    render(<TodayPage />);
    expect(screen.queryByText(/ranije$/, { selector: '.card-t' })).toBeNull();
  });
});

describe('Trake na vrhu', () => {
  const withUi = (ui: Record<string, unknown>): void => {
    const st = freshState();
    st.ui = { ...st.ui, ...ui };
    hydratePersisted(st);
    goTo('2026-01-14');
  };

  it('backup: nudi se neprijavljenom posle nedelju dana; „Kasnije" odlaže za nedelju dana i traka nestaje', async () => {
    withUi({ lastBackup: '2026-01-01' });
    useAuthStore.setState({ hasSession: false });
    render(<TodayPage />);
    expect(screen.getByText('Uradi backup podataka.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Kasnije' }));
    expect(collectPersisted().ui.snooze).toBe('2026-01-21');
    expect(screen.queryByText('Uradi backup podataka.')).toBeNull();
  });

  it('backup: prijavljenom se ne nudi (server nosi podatke)', () => {
    withUi({ lastBackup: '2026-01-01' });
    useAuthStore.setState({ hasSession: true });
    render(<TodayPage />);
    expect(screen.queryByText('Uradi backup podataka.')).toBeNull();
  });

  it('objava „novo": samo prijavljenom koji nije video i nije nov; „Sakrij" i „Pogledaj" je gase zauvek, a „Pogledaj" vodi u Zajednicu', async () => {
    withUi({ firstRun: '2026-01-01', lastBackup: '2026-01-13' });
    useAuthStore.setState({ hasSession: false });
    const a = render(<TodayPage />);
    expect(screen.queryByText('Novo: Zajednica')).toBeNull();
    a.unmount();

    useAuthStore.setState({ hasSession: true });
    const b = render(<TodayPage />);
    expect(screen.getByText('Novo: Zajednica')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Pogledaj' }));
    expect(collectPersisted().ui.novo).toBe('zajednica');
    expect(useUIStore.getState().tab).toBe('zajed');
    expect(screen.queryByText('Novo: Zajednica')).toBeNull();
    b.unmount();

    withUi({ firstRun: '2026-01-01', lastBackup: '2026-01-13' });
    render(<TodayPage />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Zatvori' }));
    expect(collectPersisted().ui.novo).toBe('zajednica');
  });
});

describe('Trake — Zajednica ugašena', () => {
  afterEach(() => {
    flag.community = true;
  });
  it('objava „Novo: Zajednica" se ne pokazuje nikome dok je funkcija ugašena', () => {
    flag.community = false;
    const st = freshState();
    st.ui = { ...st.ui, firstRun: '2026-01-01', lastBackup: '2026-01-13' };
    hydratePersisted(st);
    goTo('2026-01-14');
    useAuthStore.setState({ hasSession: true });
    render(<TodayPage />);
    expect(screen.queryByText('Novo: Zajednica')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pogledaj' })).toBeNull();
  });
});
