import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmHost } from '../../components/ui/ConfirmHost';
import {
  TEN_K_GENERATOR,
  TEN_K_V2_GENERATOR,
  generatorForPlan
} from '../../domain/generators/select';
import { resolvePlan } from '../../domain/plan';
import { seedState, type PersistedState } from '../../domain/state';
import { ADMIN_UID } from '../../services/config';
import { createKeyValueStore } from '../../services/storage/kv';
import { createStateSaver, loadState } from '../../services/storage/stateStorage';
import { collectPersisted, hydratePersisted } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import PlanPage from '../plan/index';
import { AdjustPlan } from '../plan/AdjustPlan';
import { FormScreen } from '../race/FormScreen';
import { sessionView } from '../session/sessionModel';
import { TrainingSettingsScreen } from '../ti/screens';
import { Wizard } from './Wizard';
import { userText } from '../../domain/generators/tenK/v2/app/format.ts';

/* SEGMENT 05 — čarobnjak 10K v2 iza prekidača: polja v2 (rezultat ili lagan tempo, iskustvo, trčanje/hodanje, dani i dan
   dugog, cilj), plan v2 u skladištu, prikaz strukture (orijentir + RPE, test 5 km), prilagođavanje v2 (segment 06),
   odbijanje kao poruka sa razlozima v2 doslovno. Prekidač isključen → čarobnjak i plan kao do sada; uključen ne dira
   ostale distance. */

const TODAY = '2026-01-07';
const state = (ui: Record<string, unknown> = {}): PersistedState => {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  s.ui = { ...s.ui, ...ui };
  return s;
};
const ON = { generatorV2TenK: true };

beforeEach(() => {
  useUIStore.setState({ wizard: false, confirm: null, today: TODAY });
});
afterEach(() => {
  vi.unstubAllEnvs();
  useAuthStore.setState({ configured: true, hasSession: false, userId: null, email: null });
});

const renderWizard = () =>
  render(
    <>
      <Wizard today={TODAY} />
      <ConfirmHost />
    </>
  );

async function stepRace(
  user: ReturnType<typeof userEvent.setup>,
  dist = '10K',
  check?: () => void
): Promise<void> {
  await user.click(
    within(screen.getByRole('group', { name: 'Ciljna distanca' })).getByRole('button', {
      name: dist
    })
  );
  await user.type(screen.getByLabelText('Datum trke'), '2026-04-12');
  check?.();
  await user.click(screen.getByRole('button', { name: 'Dalje' }));
}

async function pickDays(user: ReturnType<typeof userEvent.setup>, days: string[]): Promise<void> {
  const group = screen.getByRole('group', { name: 'Dani trčanja' });
  for (const d of days) await user.click(within(group).getByRole('button', { name: d }));
}

async function experience(
  user: ReturnType<typeof userEvent.setup>,
  km: string,
  level: 'Početnik' | 'Trčim redovno'
): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Da' }));
  await user.type(screen.getByLabelText('Nedeljna kilometraža'), km);
  await user.click(screen.getByRole('button', { name: level }));
  await user.click(screen.getByRole('button', { name: 'Dalje' }));
}

describe('10K v2 iza prekidača', () => {
  it('uključen: čarobnjak v2 (rezultat, 4 dana, dan dugog) → plan v2 → čuvanje → učitavanje → Plan tab i dan iz strukture', async () => {
    hydratePersisted(state(ON));
    const user = userEvent.setup();
    const { unmount } = renderWizard();
    await stepRace(user, '10K', () =>
      expect(screen.getByText(/Plan 10K v2:/).textContent).toContain('13 nedelja')
    );
    // 2. rezultat (10 km)
    await user.click(screen.getByRole('button', { name: 'Imam rezultat' }));
    await user.type(screen.getByLabelText('minuti'), '45');
    await user.type(screen.getByLabelText('sekunde'), '0');
    await user.type(screen.getByLabelText('Datum rezultata'), '2026-01-03');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    // 3. iskustvo i obim
    await experience(user, '40', 'Trčim redovno');
    // 4. dani, dan dugog i cilj
    await pickDays(user, ['Uto', 'Čet', 'Sub', 'Ned']);
    await user.click(
      within(screen.getByRole('group', { name: 'Dan dugog trčanja' })).getByRole('button', {
        name: 'Sub'
      })
    );
    await user.type(screen.getByLabelText('minuti'), '43');
    await user.type(screen.getByLabelText('sekunde'), '0');
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    unmount();

    const saved = collectPersisted();
    expect(saved.genPlan!.meta).toMatchObject({
      policyId: '10k-v2',
      policyVersion: '10k-v2.9.0',
      paceBasis: 'result',
      goalSec: 2580
    });
    expect(generatorForPlan(saved.genPlan)).toBe(TEN_K_V2_GENERATOR);
    expect(saved.genPlan!.weeks[0]!.start).toBe('2026-01-12');
    const input = (saved.genPlan!['tenKV2'] as { input: { longRunDay: string } }).input;
    expect(input.longRunDay).toBe('sat');

    // Čuvanje i učitavanje kroz pravo skladište stanja.
    const kv = createKeyValueStore();
    createStateSaver({ kv }).save(saved);
    const loaded = loadState(kv, TODAY);
    expect(loaded.loadFailure).toBeNull();
    hydratePersisted(loaded.state);
    expect(JSON.stringify(collectPersisted().genPlan)).toBe(JSON.stringify(saved.genPlan));

    // Plan tab: struktura v2 u redovima dana, trka van obima nedelje.
    useUIStore.setState({ today: '2026-02-03' });
    const page = render(<PlanPage />);
    expect(screen.getAllByText(/× \d+ m @ \d:\d\d\/km|km @ \d:\d\d\/km/).length).toBeGreaterThan(0);
    page.unmount();

    // Dan: naslov iz vrste v2, rad, procena trajanja i profil iz strukture.
    const days = resolvePlan(saved.genPlan!.weeks, { alts: {}, moves: {} }).dated;
    const q = days.find((d) => d.tag === 'int' || d.tag === 'tempo')!;
    const v = sessionView(q, {
      alt: undefined,
      easyPaceSec: null,
      rpeTarget: TEN_K_V2_GENERATOR.rpeTarget
    });
    expect(v.title).toBe(q.structure!.kind);
    expect(v.core).toMatch(/@ \d:\d\d\/km/);
    expect(v.minutes).toBe(Math.round(q.structure!.sec! / 60));
    expect(v.segments?.length).toBeGreaterThan(2);
    expect(v.rows?.some((r) => r[0] === 'Zagrevanje')).toBe(true);
    expect(days.find((d) => d.tag === 'lr')!.date.endsWith('-17')).toBe(true); // subota

    // Prilagođavanje (segment 06): tok v2 iz činjenica sa pregledom (10K v1 se ne poziva).
    const adj = render(<AdjustPlan />);
    expect(document.getElementById('v2-adapt')).not.toBeNull();
    expect(document.getElementById('plan-change-preview')!.textContent).toContain(
      'bez novih činjenica'
    );
    expect(screen.queryByText('Prilagođavanje prema izvršenju')).toBeNull();
    expect(screen.queryByText('Trenutno nema predloga za prilagođavanje plana.')).toBeNull();
    adj.unmount();
    // Napredak → Forma: VDOT iz rezultata v2 (forma 10K v2), bez lanca forme v1.
    render(<FormScreen />);
    expect(document.getElementById('v2-form')!.textContent).toContain('VDOT plana');
    expect(screen.queryByText('Da li napredujem?')).toBeNull();
  });

  it('po osećaju (bez rezultata): RPE i tempo „orijentir (procena)", test 5 km u planu', async () => {
    hydratePersisted(state(ON));
    const user = userEvent.setup();
    const { unmount } = renderWizard();
    await stepRace(user);
    await user.click(screen.getByRole('button', { name: 'Nemam skoriji rezultat' }));
    await user.type(screen.getByLabelText('minuti'), '6');
    await user.type(screen.getByLabelText('sekunde'), '30');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await experience(user, '25', 'Trčim redovno');
    await pickDays(user, ['Uto', 'Čet', 'Ned']);
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    unmount();
    const plan = collectPersisted().genPlan!;
    expect(plan.meta).toMatchObject({ policyId: '10k-v2', paceBasis: 'feel', vdot: null });
    const days = resolvePlan(plan.weeks, { alts: {}, moves: {} }).dated;
    const test = days.find((d) => d.tag === 'test')!;
    expect(test.structure!.kind).toBe('Test');
    const q = days.find((d) => d.tag === 'tempo')!;
    const v = sessionView(q, {
      alt: undefined,
      easyPaceSec: null,
      rpeTarget: TEN_K_V2_GENERATOR.rpeTarget
    });
    expect(v.core).toMatch(/po osećaju \(RPE \d(–\d)?\), orijentir \(procena\) \d:\d\d\/km/);
    expect(v.rows?.find((r) => r[0] === 'Napor')?.[1]).toMatch(/^RPE /);
    // Napredak → Forma: bez lanca forme i predloga (nepodržano do 06), ekran se crta bez greške.
    const form = render(<FormScreen />);
    expect(document.body.textContent).toContain('Forma');
    form.unmount();
    useUIStore.setState({ today: test.date });
    render(<PlanPage />);
    expect(screen.getAllByText(/5 km — orijentir \(procena\)/).length).toBeGreaterThan(0);
    // Napomene i upozorenja v2 u „Na šta da paziš" — kao tekst za korisnika (10K-07 Z2: bez internih oznaka).
    expect(screen.getByText('Na šta da paziš u ovom planu')).toBeTruthy();
    const notes = (plan['tenKV2'] as { notes: string[] }).notes;
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(document.body.textContent).toContain(userText(n));
  });

  it('trčanje/hodanje: odbijanje v2 doslovno sa preporukom 5K, dalje se ne ide, plan se ne pravi', async () => {
    hydratePersisted(state(ON));
    const user = userEvent.setup();
    renderWizard();
    await stepRace(user);
    await user.click(screen.getByRole('button', { name: 'Nemam skoriji rezultat' }));
    await user.type(screen.getByLabelText('minuti'), '7');
    await user.type(screen.getByLabelText('sekunde'), '30');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await user.click(screen.getByRole('button', { name: 'Ne još' }));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('Plan nije napravljen');
    expect(notice.textContent).toContain(
      '10K plan traži neprekidno trčanje ≥ 30 min; preporuka: 5K plan (trčanje/hodanje).'
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Dalje' }).disabled).toBe(true);
    expect(collectPersisted().genPlan).toBeNull();
  });

  it('odbijanje v2 (početnik, 5 dana) je poruka sa razlogom v2 doslovno, plan se ne pravi', async () => {
    hydratePersisted(state(ON));
    const user = userEvent.setup();
    renderWizard();
    await stepRace(user);
    await user.click(screen.getByRole('button', { name: 'Nemam skoriji rezultat' }));
    await user.type(screen.getByLabelText('minuti'), '7');
    await user.type(screen.getByLabelText('sekunde'), '0');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await experience(user, '25', 'Početnik');
    await pickDays(user, ['Pon', 'Uto', 'Sre', 'Pet', 'Sub']);
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('Plan nije napravljen');
    expect(notice.textContent).toContain(
      'Početnik: 10K plan radi sa 3–4 dana trčanja (izabrano 5); preporuka 3–4 dana.'
    );
    expect(collectPersisted().genPlan).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Pravljenje plana' })).toBeTruthy();
  });

  it('isključen: 10K čarobnjak je stari (rezultat je obavezan, bez polja v2), plan 10K v1', async () => {
    hydratePersisted(state());
    const user = userEvent.setup();
    renderWizard();
    await stepRace(user);
    expect(screen.getByText('Šta si poslednje istrčao?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nemam skoriji rezultat' })).toBeNull();
  });

  it('uključen 10K v2: 5K i polumaraton plan su bajt-isti kao sa isključenim', async () => {
    const run = async (ui: Record<string, unknown>, dist: string): Promise<string> => {
      hydratePersisted(state(ui));
      const user = userEvent.setup();
      const { unmount } = renderWizard();
      await stepRace(user, dist);
      // Rezultat 5 km (podrazumevana distanca rezultata u starom čarobnjaku).
      await user.type(screen.getByLabelText('minuti'), '22');
      await user.type(screen.getByLabelText('sekunde'), '30');
      await user.click(screen.getByRole('button', { name: 'Dalje' }));
      await user.type(screen.getByLabelText('Nedeljna kilometraža'), '40');
      await user.click(screen.getByRole('button', { name: 'Dalje' }));
      await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
      await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
      unmount();
      return JSON.stringify(collectPersisted().genPlan);
    };
    for (const dist of ['5K', 'Polumaraton']) {
      const off = await run({}, dist);
      const on = await run(ON, dist);
      expect(on, dist).toBe(off);
    }
    // 10K uz isključen 10K prekidač (uključen 5K) ostaje 10K v1.
    const v1 = await run({ generatorV2FiveK: true }, '10K');
    expect(generatorForPlan(JSON.parse(v1) as never)).toBe(TEN_K_GENERATOR);
  });
});

describe('Prekidač 10K v2: vidljiv samo uz VITE_TENK_V2 ili administratoru', () => {
  it('običan korisnik bez env: nema prekidača; administrator ili env: ima', () => {
    hydratePersisted(state());
    vi.stubEnv('VITE_TENK_V2', '');
    vi.stubEnv('VITE_FIVEK_V2', '');
    const a = render(<TrainingSettingsScreen />);
    expect(screen.queryByText('Generator plana')).toBeNull();
    a.unmount();
    useAuthStore.setState({ configured: true, hasSession: true, userId: ADMIN_UID, email: null });
    const b = render(<TrainingSettingsScreen />);
    expect(screen.getByLabelText(/Novi 10K plan pravi generator v2/)).toBeTruthy();
    b.unmount();
    useAuthStore.setState({ configured: true, hasSession: false, userId: null, email: null });
    vi.stubEnv('VITE_TENK_V2', '1');
    render(<TrainingSettingsScreen />);
    expect(screen.getByLabelText(/Novi 10K plan pravi generator v2/)).toBeTruthy();
    expect(screen.queryByLabelText(/Novi 5K plan pravi generator v2/)).toBeNull();
  });

  it('checkbox upisuje podešavanje ui.generatorV2TenK (podrazumevano isključen)', async () => {
    hydratePersisted(state());
    vi.stubEnv('VITE_TENK_V2', 'x');
    const user = userEvent.setup();
    render(<TrainingSettingsScreen />);
    const box = screen.getByLabelText<HTMLInputElement>(/Novi 10K plan pravi generator v2/);
    expect(box.checked).toBe(false);
    await user.click(box);
    expect(collectPersisted().ui['generatorV2TenK']).toBe(true);
  });

  it('06f: tekst prekidača bez „prilagođavanje stiže uskoro" (prilagođavanje 10K v2 postoji od segmenta 06)', () => {
    hydratePersisted(state());
    vi.stubEnv('VITE_TENK_V2', '1');
    render(<TrainingSettingsScreen />);
    const note = screen.getByText(/Važi samo za novi 10K plan iz čarobnjaka\./);
    expect(note.textContent).toContain('Postojeći plan se ne menja.');
    expect(note.textContent).not.toMatch(/stiže uskoro/);
  });
});
