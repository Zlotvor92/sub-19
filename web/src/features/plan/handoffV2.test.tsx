import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmHost } from '../../components/ui/ConfirmHost';
import { V1_TARGET_NEEDS_RESULT } from '../../domain/generators/handoff';
import {
  generateHmV2Plan,
  generateMarathonV2Plan,
  hmV2Start,
  isFiveKV2Plan,
  isHmV2Plan,
  marathonV2Start,
  RESTORE_OTHER_DISTANCE
} from '../../domain/generators/select';
import type { HmV2PlanInput, MarathonV2PlanInput } from '../../domain/generators/contract';
import { resolvePlan } from '../../domain/plan';
import { getPlanRevisions } from '../../domain/plan/versions';
import { seedState, type GenPlanState, type PersistedState } from '../../domain/state';
import { collectPersisted, hydratePersisted, useSettingsStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import {
  commitPlanChange,
  previewFiveKV2,
  previewHmV2,
  storedPreparationDecision
} from '../../stores/executionActions';
import { useUIStore } from '../../stores/uiStore';
import { AdjustPlan } from './AdjustPlan';
import PlanPage from './index';
import { PlanOverview } from './PlanOverview';

/* FAZA 3, SEGMENT 3g — UI predaje „kraća distanca" za izvore v2 (HM v2, maraton v2). Odluku, opcije, razloge i plan cilja
   daje domen; UI ih prikazuje (pouka 20). Stavke: (1) store prosleđuje plan (`isLimitedLongPreparation(meta, plan)`);
   (2) store prosleđuje prekidače korisnika (`preparationForPlan(plan, flags)`); (3) pregled adaptacije v2 nosi ponudu
   (`shorterOffer`) i vezu ka odluci, odluka traje dok traje stanje, „Zatvori" je sklanja bez promene plana; (4) odluka:
   izjava, opcija sa vrhom i pokrivenošću, nedostupne opcije sa razlogom doslovno; (5) plan cilja sa nedeljama izvora
   kao prefiksom — broj nedelje `offset + index`, dnevnik na svojim danima; (6) vraćanje verzije druge distance →
   razlog `RESTORE_OTHER_DISTANCE`. */

const RACE = '2026-04-12';
const START = hmV2Start(RACE, '2026-01-14')!; // 2026-01-19, 12 nedelja
/** Utorak druge nedelje izvora: tekuća nedelja ostaje izvor (O6b), cilj počinje 2026-02-02. */
const TODAY = '2026-01-27';
const PAUSE = { from: '2025-12-24', to: TODAY }; // 35 dana
const FEEL: HmV2PlanInput = {
  startDate: START,
  raceDate: RACE,
  runDays: ['tue', 'thu', 'sun'],
  longRunDay: 'sun',
  currentWeeklyKm: 30,
  easyPaceSecPerKm: 390
};
const WITH_RESULT: HmV2PlanInput = {
  startDate: START,
  raceDate: RACE,
  runDays: ['tue', 'thu', 'sat', 'sun'],
  longRunDay: 'sun',
  currentWeeklyKm: 40,
  recentLongRunKm: 16,
  recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-01-10' },
  goalTimeSec: 6000
};

function plan(input: HmV2PlanInput): GenPlanState {
  const r = generateHmV2Plan(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
function state(extra: Partial<PersistedState>): PersistedState {
  return { ...(JSON.parse(JSON.stringify(seedState())) as PersistedState), ...extra };
}
const stored = () => collectPersisted().genPlan!;
const preview = () => document.getElementById('plan-change-preview')!;
const decisionBox = () => document.getElementById('plan-decision');
type Flag = 'generatorV2FiveK' | 'generatorV2TenK' | 'generatorV2HalfMarathon';
function flags(...on: Flag[]): void {
  useSettingsStore.getState().patchUi({
    generatorV2FiveK: on.includes('generatorV2FiveK'),
    generatorV2TenK: on.includes('generatorV2TenK'),
    generatorV2HalfMarathon: on.includes('generatorV2HalfMarathon')
  });
}
/** Izvor HM v2 posle primenjene adaptacije (pauza 35 d) — sačuvan plan je ograničena priprema. */
function adaptedSource(
  input: HmV2PlanInput,
  extra: Partial<PersistedState> = {},
  today = TODAY,
  pause = PAUSE
): GenPlanState {
  hydratePersisted(state({ genPlan: plan(input), ...extra }));
  useUIStore.setState({ today, confirm: null, screens: [] });
  const pv = previewHmV2(today, { breaks: [pause] });
  if (!pv.ok || !pv.hmV2?.shorterOffer) throw new Error('nema ponude');
  if (!commitPlanChange(pv).ok) throw new Error('upis');
  return stored();
}

beforeEach(() => {
  useAuthStore.setState({ configured: true, hasSession: false, userId: null, email: null });
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('3g store: plan i prekidači korisnika', () => {
  it('(1) odluka nad sačuvanim planom HM v2 postoji (izvor ocenjuje pripremu iz nedelja plana)', () => {
    adaptedSource(FEEL);
    flags();
    const d = storedPreparationDecision(TODAY)!;
    expect(d).not.toBeNull();
    expect(d.statement).toMatch(
      /^Posle prilagođavanja najduži dugi u planu je [\d,]+ km, ispod 16 km/
    );
    expect(d.conditions[0]).toMatch(/^Zadrži plan v2/);
  });

  it('(2) prekidač 5K v2 korisnika bira cilj 5K v2; bez njega je cilj v1 (traži rezultat)', () => {
    adaptedSource(FEEL);
    flags('generatorV2FiveK');
    const on = storedPreparationDecision(TODAY)!;
    expect(on.options.map((o) => o.title)).toEqual(['Kraća distanca: 5K istog datuma']);
    flags();
    const off = storedPreparationDecision(TODAY)!;
    expect(off.options).toEqual([]);
    expect(off.unavailable).toEqual([
      `10K: ${V1_TARGET_NEEDS_RESULT}`,
      `5K: ${V1_TARGET_NEEDS_RESULT}`
    ]);
  });
});

describe('3g UI: ponuda, odluka, zatvaranje', () => {
  it('(3) pregled pauze nosi ponudu → primena → odluka; „Zatvori" ne menja plan; ponovo pri sledećem otvaranju', async () => {
    hydratePersisted(state({ genPlan: plan(FEEL) }));
    flags('generatorV2FiveK');
    useUIStore.setState({ today: TODAY, confirm: null, screens: [] });
    const user = userEvent.setup();
    const first = render(<AdjustPlan />);
    expect(document.getElementById('v2-shorter-offer')).toBeNull();
    expect(decisionBox()).toBeNull();
    await user.type(screen.getByLabelText('Pauza od'), PAUSE.from);
    await user.type(screen.getByLabelText('Pauza do'), PAUSE.to);
    await user.click(screen.getByRole('button', { name: 'Dodaj pauzu' }));
    const note = within(preview()).getByRole('note');
    expect(note.textContent).toMatch(/plan nije puna priprema za polumaraton/);
    expect(note.textContent).toMatch(/Odluka o pripremi se prikazuje ovde kada primeniš/);
    expect(decisionBox()).toBeNull(); // pregled ne upisuje: sačuvani plan još nije ograničen
    await user.click(within(preview()).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    const box = decisionBox()!;
    expect(within(box).getByText(/^Posle prilagođavanja najduži dugi u planu je/)).toBeTruthy();
    expect(within(box).getByText(/^Zadrži plan v2:/)).toBeTruthy();
    const adapted = stored();
    await user.click(within(box).getByRole('button', { name: 'Zatvori' }));
    expect(decisionBox()).toBeNull();
    expect(stored()).toEqual(adapted);
    first.unmount();
    // Stanje traje → ponovo se nudi; pregled sa ponudom sada vodi do odluke.
    render(<AdjustPlan />);
    expect(decisionBox()).not.toBeNull();
    await user.type(screen.getByLabelText('Pauza od'), PAUSE.from);
    await user.type(screen.getByLabelText('Pauza do'), PAUSE.to);
    await user.click(screen.getByRole('button', { name: 'Dodaj pauzu' }));
    expect(
      within(within(preview()).getByRole('note')).getByRole('button', { name: 'Odluka o pripremi' })
    ).toBeTruthy();
  });

  it('(4) nedostupne opcije sa razlogom doslovno; opcija sa vrhom dugog/obima i pokrivenošću', () => {
    adaptedSource(FEEL);
    flags();
    const a = render(<AdjustPlan />);
    const list = within(decisionBox()!).getByRole('list', { name: 'Nedostupne opcije' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual([`10K: ${V1_TARGET_NEEDS_RESULT}`, `5K: ${V1_TARGET_NEEDS_RESULT}`]);
    a.unmount();
    // Plan sa rezultatom: ponuda posle pauze 35 d u prvoj nedelji (utorak 2026-01-20).
    adaptedSource(WITH_RESULT, {}, '2026-01-20', { from: '2025-12-17', to: '2026-01-20' });
    flags('generatorV2TenK');
    const b = render(<AdjustPlan />);
    const box = decisionBox()!;
    // 3d-10K: 10K v2 je cilj predaje (nema NOT_READY); vrh opcije iz plana 10K v2 cilja.
    expect(within(box).queryByRole('list', { name: 'Nedostupne opcije' })).toBeNull();
    expect(within(box).getByText('Kraća distanca: 10K istog datuma')).toBeTruthy();
    expect(storedPreparationDecision('2026-01-20')!.options[0]!.peakLongRunKm).toBeGreaterThan(0);
    b.unmount();
    flags();
    render(<AdjustPlan />);
    const opt = decisionBox()!;
    expect(within(opt).getByText('Kraća distanca: 10K istog datuma')).toBeTruthy();
    const d = storedPreparationDecision('2026-01-20')!.options[0]!;
    expect(d.peakLongRunKm).toBeGreaterThan(0);
    const km = (x: number) => x.toFixed(1).replace('.', ',');
    expect(
      within(opt).getByText(
        new RegExp(
          `najduže ${km(d.peakLongRunKm)} km · vrhunac ${km(d.peakWeeklyKm)} km/ned · ispunjava pravila pune pripreme`
        )
      )
    ).toBeTruthy();
  });
});

describe('3g UI: izbor kraće distance, prefiks, vraćanje', () => {
  /** HM v2 po osećaju → 5K v2 kroz UI: odluka → pregled opcije (pre → posle) → primena. */
  async function handoffTo5K() {
    const source = plan(FEEL);
    const day = resolvePlan(source.weeks, { alts: {}, moves: {} }).dated.find(
      (d) => d.date === '2026-01-20'
    )!;
    adaptedSource(FEEL, {
      log: { [day.id]: { status: 'done', km: 5, sec: 1950, ts: day.date } }
    });
    flags('generatorV2FiveK');
    const before = stored();
    const user = userEvent.setup();
    const adj = render(
      <>
        <AdjustPlan />
        <ConfirmHost />
      </>
    );
    await user.click(
      within(decisionBox()!).getByRole('button', {
        name: 'Pregledaj opciju: Kraća distanca: 5K istog datuma'
      })
    );
    expect(within(preview()).getByText('Kraća distanca: 5K istog datuma')).toBeTruthy();
    const dl = within(preview()).getByLabelText('Promena trke i cilja');
    expect(dl.textContent).toMatch(/Pre.*Polumaraton.*Posle.*5K.*bez vremenskog cilja/);
    expect(stored()).toEqual(before); // pregled ne upisuje
    await user.click(within(preview()).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    const after = stored();
    expect(isFiveKV2Plan(after)).toBe(true);
    expect(getPlanRevisions(after).at(-1)?.summary).toBe('Kraća distanca: 5K istog datuma');
    // Potvrda „primenjeno" na ekranu cilja (prilagođavanje 5K v2), jednom; „U redu" je sklanja.
    expect(screen.getByRole('status').textContent).toBe(
      'Plan je promenjen: Kraća distanca: 5K istog datuma. Prethodni plan je sačuvan u istoriji (Prethodne verzije plana).'
    );
    expect(document.getElementById('v2-adapt')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'U redu' }));
    expect(document.getElementById('handoff-applied')).toBeNull();
    adj.unmount();
    return { before, after, day, user };
  }

  it('(5) 5K v2: prefiks izvora (faza i dani), broj nedelje offset + index u kalendaru i pregledu, dnevnik ostaje', async () => {
    const { before, after, day } = await handoffTo5K();
    // Prefiks: nedelje izvora pre starta cilja (tekuća uključena) doslovno — faza i dani izvora.
    const offset = after.weeks.findIndex((w) => w.start === '2026-02-02');
    expect(offset).toBe(2);
    expect(after.weeks.slice(0, offset)).toEqual(before.weeks.slice(0, offset));
    expect(after.weeks.map((w) => w.w)).toEqual(after.weeks.map((_, i) => i + 1));
    // Dnevnik ostaje na svom danu (id dana = id izvora istog datuma).
    const dated = resolvePlan(after.weeks, { alts: {}, moves: {} }).dated;
    expect(dated.find((d) => d.id === day.id)?.date).toBe('2026-01-20');
    expect(collectPersisted().log[day.id]?.km).toBe(5);
    // Kalendar: tekuća nedelja (prefiks) i sve nedelje sa brojem offset + index.
    const page = render(<PlanPage />);
    expect(
      screen.getByRole('heading', { name: `Nedelja 2 od ${after.weeks.length}` })
    ).toBeTruthy();
    page.unmount();
    const overview = render(<PlanOverview />);
    for (const w of after.weeks)
      expect(screen.getByRole('button', { name: `Nedelja ${w.w}` })).toBeTruthy();
    overview.unmount();
    // Pregled adaptacije cilja: brojevi nedelja posle prefiksa.
    const pv = previewFiveKV2('2026-02-10', { breaks: [{ from: '2026-02-02', to: '2026-02-10' }] });
    if (!pv.ok || !pv.fiveKV2) throw new Error('pregled 5K v2');
    expect(pv.fiveKV2.weeks.length).toBeGreaterThan(0);
    for (const w of pv.fiveKV2.weeks) expect(w.week).toBeGreaterThan(offset);
  });

  it('(6) vraćanje verzije HM (pre predaje) preko plana 5K → razlog domena doslovno, plan isti', async () => {
    const { after, user } = await handoffTo5K();
    render(<AdjustPlan />);
    const hmRevision = getPlanRevisions(after).find((r) => r.summary.startsWith('Prilagođavanje'))!;
    await user.click(
      screen.getByRole('button', { name: `Pregledaj vraćanje: ${hmRevision.summary}` })
    );
    const box = document.getElementById('v2-adapt-rejected')!;
    expect(within(box).getByRole('status').textContent).toBe(RESTORE_OTHER_DISTANCE);
    expect(stored()).toEqual(after);
  });

  it('maraton v2 → HM v2 (prekidač HM v2): ponuda u pregledu, odluka, izbor → plan HM v2 sa prefiksom', async () => {
    const race = '2026-05-10';
    const input: MarathonV2PlanInput = {
      startDate: marathonV2Start(race, '2026-01-14')!,
      raceDate: race,
      runDays: ['tue', 'thu', 'sat', 'sun'],
      longRunDay: 'sun',
      currentWeeklyKm: 50,
      recentLongRunKm: 24,
      recentResult: { distanceM: 10000, timeSec: 2280, date: '2026-01-10' },
      goalTimeSec: 11400
    };
    const g = generateMarathonV2Plan(input);
    if (!g.ok) throw new Error(JSON.stringify(g.reasons));
    hydratePersisted(state({ genPlan: g.plan }));
    flags('generatorV2HalfMarathon');
    useUIStore.setState({ today: TODAY, confirm: null, screens: [] });
    const user = userEvent.setup();
    render(<AdjustPlan />);
    await user.type(screen.getByLabelText('Pauza od'), PAUSE.from);
    await user.type(screen.getByLabelText('Pauza do'), PAUSE.to);
    await user.click(screen.getByRole('button', { name: 'Dodaj pauzu' }));
    expect(within(preview()).getByRole('note').textContent).toMatch(
      /plan nije puna priprema za maraton/
    );
    await user.click(within(preview()).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    await user.click(
      within(decisionBox()!).getByRole('button', {
        name: 'Pregledaj opciju: Kraća distanca: Polumaraton istog datuma'
      })
    );
    await user.click(within(preview()).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    const after = stored();
    expect(isHmV2Plan(after)).toBe(true);
    const offset = after.weeks.findIndex((w) => w.start === '2026-02-02');
    expect(offset).toBe(2);
    expect(after.weeks.map((w) => w.w)).toEqual(after.weeks.map((_, i) => i + 1));
    expect(getPlanRevisions(after).at(-1)?.summary).toBe(
      'Kraća distanca: Polumaraton istog datuma'
    );
  });
});
