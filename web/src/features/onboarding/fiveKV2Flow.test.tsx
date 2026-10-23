import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfirmHost } from '../../components/ui/ConfirmHost';
import { FIVE_K_V2_GENERATOR, generatorForPlan } from '../../domain/generators/select';
import { resolvePlan } from '../../domain/plan';
import { seedState, type PersistedState } from '../../domain/state';
import { createKeyValueStore } from '../../services/storage/kv';
import { createStateSaver, loadState } from '../../services/storage/stateStorage';
import { collectPersisted, hydratePersisted } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import PlanPage from '../plan/index';
import { AdjustPlan } from '../plan/AdjustPlan';
import { sessionView } from '../session/sessionModel';
import { Wizard } from './Wizard';

/* SEGMENT 08a — čarobnjak 5K v2 iza prekidača: polja v2, plan v2 u skladištu, prikaz strukture, odbijanje kao poruka.
   Prekidač isključen → čarobnjak i plan kao do sada (isti bajtovi i za 10K uz uključen prekidač). */

const TODAY = '2026-01-07';
const state = (fiveKV2: boolean): PersistedState => {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  if (fiveKV2) s.ui = { ...s.ui, generatorV2FiveK: true };
  return s;
};

beforeEach(() => {
  useUIStore.setState({ wizard: false, confirm: null, today: TODAY });
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
  dist = '5K',
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

describe('5K v2 iza prekidača', () => {
  it('uključen: čarobnjak v2 (4 dana, rezultat) → plan v2 → čuvanje → učitavanje → Plan tab i dan iz strukture', async () => {
    hydratePersisted(state(true));
    const user = userEvent.setup();
    const { unmount } = renderWizard();
    await stepRace(user, '5K', () =>
      expect(screen.getByText(/Plan 5K v2:/).textContent).toContain('13 nedelja')
    );
    // 2. rezultat
    await user.click(screen.getByRole('button', { name: 'Imam rezultat' }));
    await user.type(screen.getByLabelText('minuti'), '22');
    await user.type(screen.getByLabelText('sekunde'), '30');
    await user.type(screen.getByLabelText('Datum rezultata'), '2026-01-03');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    // 3. iskustvo i obim
    await user.type(screen.getByLabelText('Nedeljna kilometraža'), '32');
    await user.click(screen.getByRole('button', { name: 'Trčim redovno' }));
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    // 4. dani i cilj
    await pickDays(user, ['Uto', 'Čet', 'Sub', 'Ned']);
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    unmount();

    const saved = collectPersisted();
    expect(saved.genPlan!.meta).toMatchObject({ policyId: '5k-v2', policyVersion: '5k-v2.10.4' });
    expect(generatorForPlan(saved.genPlan)).toBe(FIVE_K_V2_GENERATOR);
    expect(saved.genPlan!.weeks[0]!.start).toBe('2026-01-12');

    // Čuvanje i učitavanje kroz pravo skladište stanja.
    const kv = createKeyValueStore();
    createStateSaver({ kv }).save(saved);
    const loaded = loadState(kv, TODAY);
    expect(loaded.loadFailure).toBeNull();
    hydratePersisted(loaded.state);
    expect(JSON.stringify(collectPersisted().genPlan)).toBe(JSON.stringify(saved.genPlan));

    // Plan tab: struktura v2 u redovima dana.
    useUIStore.setState({ today: '2026-02-03' });
    render(<PlanPage />);
    expect(screen.getAllByText(/× \d+ m @ \d:\d\d\/km|km @ \d:\d\d\/km/).length).toBeGreaterThan(0);

    // Dan: naslov iz vrste v2, rad, procena trajanja i profil iz strukture.
    const days = resolvePlan(saved.genPlan!.weeks, { alts: {}, moves: {} }).dated;
    const q = days.find((d) => d.tag === 'int')!;
    const v = sessionView(q, {
      alt: undefined,
      easyPaceSec: null,
      rpeTarget: FIVE_K_V2_GENERATOR.rpeTarget
    });
    expect(v.title).toBe(q.structure!.kind);
    expect(v.core).toMatch(/@ \d:\d\d\/km/);
    expect(v.paceSec).toBe(q.structure!.blocks.find((b) => b.step.kind === 'work')!.step.paceSec);
    expect(v.minutes).toBe(Math.round(q.structure!.sec! / 60));
    expect(v.segments?.length).toBeGreaterThan(2);
    expect(v.rows?.some((r) => r[0] === 'Zagrevanje')).toBe(true);
  });

  it('prilagođavanje v2 plana (08b): tok v2 sa pregledom, bez predloga starog generatora', async () => {
    hydratePersisted(state(true));
    const user = userEvent.setup();
    const { unmount } = renderWizard();
    await stepRace(user);
    await user.click(screen.getByRole('button', { name: 'Nemam skoriji rezultat' }));
    await user.type(screen.getByLabelText('minuti'), '6');
    await user.type(screen.getByLabelText('sekunde'), '30');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await user.type(screen.getByLabelText('Nedeljna kilometraža'), '20');
    await user.click(screen.getByRole('button', { name: 'Trčim redovno' }));
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await pickDays(user, ['Uto', 'Čet', 'Ned']);
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    unmount();
    useUIStore.setState({ today: '2026-02-03' });
    render(<AdjustPlan />);
    // 08b: tok prilagođavanja v2 (pregled iz činjenica, potvrda), ne alati v1.
    expect(screen.getByRole('heading', { name: 'Prilagođavanje plana' })).toBeTruthy();
    expect(document.getElementById('plan-change-preview')).not.toBeNull();
    expect(screen.queryByText('Prilagođavanje prema izvršenju')).toBeNull();
  });

  it('odbijanje v2 (5 dana, početnik) je poruka sa razlogom, plan se ne pravi', async () => {
    hydratePersisted(state(true));
    const user = userEvent.setup();
    renderWizard();
    await stepRace(user);
    await user.click(screen.getByRole('button', { name: 'Nemam skoriji rezultat' }));
    await user.type(screen.getByLabelText('minuti'), '6');
    await user.type(screen.getByLabelText('sekunde'), '30');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await user.type(screen.getByLabelText('Nedeljna kilometraža'), '25');
    await user.click(screen.getByRole('button', { name: 'Početnik' }));
    await user.click(screen.getByRole('button', { name: 'Da' }));
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await pickDays(user, ['Pon', 'Uto', 'Sre', 'Pet', 'Sub']);
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('Plan nije napravljen');
    expect(notice.textContent).toContain('Početnik: najviše 4 dana trčanja nedeljno; zadato 5.');
    expect(screen.queryByRole('alert')?.textContent ?? '').not.toContain('Početnik');
    expect(collectPersisted().genPlan).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Pravljenje plana' })).toBeTruthy();
  });

  it('isključen: 5K čarobnjak je stari (rezultat je obavezan, bez polja v2)', async () => {
    hydratePersisted(state(false));
    const user = userEvent.setup();
    renderWizard();
    await stepRace(user);
    expect(screen.getByText('Šta si poslednje istrčao?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nemam skoriji rezultat' })).toBeNull();
  });

  it('uključen prekidač: 10K plan je bajt-isti kao sa isključenim', async () => {
    const run = async (on: boolean): Promise<string> => {
      hydratePersisted(state(on));
      const user = userEvent.setup();
      const { unmount } = renderWizard();
      await stepRace(user, '10K');
      await user.type(screen.getByLabelText('minuti'), '45');
      await user.type(screen.getByLabelText('sekunde'), '0');
      await user.click(screen.getByRole('button', { name: 'Dalje' }));
      await user.type(screen.getByLabelText('Nedeljna kilometraža'), '40');
      await user.click(screen.getByRole('button', { name: 'Dalje' }));
      await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
      await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
      unmount();
      return JSON.stringify(collectPersisted().genPlan);
    };
    const off = await run(false);
    const on = await run(true);
    expect(on).toBe(off);
    expect((JSON.parse(on) as { meta: { policyId: string } }).meta.policyId).toBe('10k-v1');
  });
});
