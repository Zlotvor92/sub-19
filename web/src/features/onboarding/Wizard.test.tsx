import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfirmHost } from '../../components/ui/ConfirmHost';
import { seedState, type PersistedState } from '../../domain/state';
import { collectPersisted, hydratePersisted, onPersistRequest } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { Wizard } from './Wizard';

/* parity: test/uvod.test.mjs, test/licni-plan.test.mjs (čarobnjak). Ceo tok: četiri koraka → plan u store-u. */

const TODAY = '2026-01-07';
const blank = (): PersistedState => JSON.parse(JSON.stringify(seedState())) as PersistedState;

beforeEach(() => {
  hydratePersisted(blank());
  useUIStore.setState({ wizard: false, confirm: null });
});

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  opts: { raceDate: string; min: string; sec: string; km: string }
) {
  await user.type(screen.getByLabelText('Datum trke'), opts.raceDate);
  await user.click(screen.getByRole('button', { name: 'Dalje' }));
  await user.type(screen.getByLabelText('minuti'), opts.min);
  await user.type(screen.getByLabelText('sekunde'), opts.sec);
  await user.click(screen.getByRole('button', { name: 'Dalje' }));
  await user.type(screen.getByLabelText('Nedeljna kilometraža'), opts.km);
  await user.click(screen.getByRole('button', { name: 'Dalje' }));
}

describe('čarobnjak', () => {
  it('„Dalje" je zaključano dok korak nije ispunjen; bez plana nema „✕"', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Za koju trku se spremaš?');
    expect(screen.getByRole('button', { name: 'Dalje' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Otkaži' })).toBeNull();
    await user.type(screen.getByLabelText('Datum trke'), '2026-04-12');
    expect(screen.getByRole('button', { name: 'Dalje' })).toBeEnabled();
  });

  it('napomena pod datumom: kratko za izabranu distancu → kaže da plan ne može; dovoljno → pun ciklus', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    await user.type(screen.getByLabelText('Datum trke'), '2026-02-08');
    expect(screen.getByText(/ne može da se napravi/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Datum trke'));
    await user.type(screen.getByLabelText('Datum trke'), '2026-04-12');
    expect(screen.getByText(/pun ciklus pripreme za 5K/)).toBeInTheDocument();
  });

  it('korak 2: nemoguće vreme objašnjava ZAŠTO je „Dalje" zaključano; moguće prikazuje formu (VDOT) i tempove', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    await user.type(screen.getByLabelText('Datum trke'), '2026-04-12');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await user.type(screen.getByLabelText('minuti'), '5');
    await user.type(screen.getByLabelText('sekunde'), '00');
    expect(screen.getByRole('alert')).toHaveTextContent('brže od realnog opsega');
    expect(screen.getByRole('button', { name: 'Dalje' })).toBeDisabled();
    await user.clear(screen.getByLabelText('minuti'));
    await user.type(screen.getByLabelText('minuti'), '24');
    await user.clear(screen.getByLabelText('sekunde'));
    await user.type(screen.getByLabelText('sekunde'), '30');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Tvoja forma')).toBeInTheDocument();
    expect(screen.getByText('VDOT', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dalje' })).toBeEnabled();
  });

  it('polumaraton i maraton traže i sate; kad se vrati na kratku distancu sati se slivaju u minute', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    await user.type(screen.getByLabelText('Datum trke'), '2026-04-12');
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    expect(screen.queryByLabelText('sati')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Polumaraton' }));
    await user.type(screen.getByLabelText('sati'), '1');
    await user.type(screen.getByLabelText('minuti'), '40');
    await user.click(screen.getByRole('button', { name: '10 km' }));
    expect(screen.queryByLabelText('sati')).toBeNull();
    expect(screen.getByLabelText('minuti')).toHaveValue(40); // 1h40 = 100 min > 99 → ne sliva se, minuti ostaju
  });

  it('ceo tok: četiri koraka prave plan i upisuju ga u stanje (sa ulazom za kasniju promenu cilja); jedan upis', async () => {
    const user = userEvent.setup();
    const writes: string[] = [];
    const off = onPersistRequest((m) => writes.push(m));
    render(<Wizard today={TODAY} />);
    await fill(user, { raceDate: '2026-04-12', min: '24', sec: '30', km: '30' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Koliko brzo da raste forma?'
    );
    // predviđanje za tri tempa napretka
    expect(
      within(document.getElementById('ob-outlook') as HTMLElement).getAllByText(/VDOT/).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Napravi plan' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    off();
    const s = collectPersisted();
    expect(s.genPlan?.weeks.length).toBeGreaterThan(8);
    expect(s.genPlan?.ulaz).toMatchObject({
      raceDate: '2026-04-12',
      weeklyKm: 30,
      pb: { distM: 5000, sec: 1470 }
    });
    expect(writes).toEqual(['now']);
  });

  it('cilj koji nije realan se kaže; cilj koji jeste realan imenuje tempo napretka', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    await fill(user, { raceDate: '2026-04-12', min: '24', sec: '30', km: '30' });
    await user.type(screen.getByLabelText('minuti', { selector: '#in-goalMin' }), '15');
    await user.type(screen.getByLabelText('sekunde', { selector: '#in-goalSec' }), '00');
    expect(await screen.findByText(/nije realan za ovaj plan/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('minuti', { selector: '#in-goalMin' }));
    await user.type(screen.getByLabelText('minuti', { selector: '#in-goalMin' }), '26');
    expect(await screen.findByText(/Cilj 26:00 je dostižan/)).toBeInTheDocument();
  });

  it('upozorenja generatora stižu posle kratke tišine (ne na svaki taster)', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    await fill(user, { raceDate: '2026-04-12', min: '24', sec: '30', km: '30' });
    expect(await screen.findByText('Na šta da paziš', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('postojeći plan sa podacima: pita pre brisanja; „Ne" ništa ne menja', async () => {
    const user = userEvent.setup();
    const st = blank();
    hydratePersisted(st);
    // prvo napravi plan
    const first = render(
      <>
        <Wizard today={TODAY} />
        <ConfirmHost />
      </>
    );
    await fill(user, { raceDate: '2026-04-12', min: '24', sec: '30', km: '30' });
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    first.unmount();
    // upiši trening plana pa pokušaj nov plan
    const cur = collectPersisted();
    hydratePersisted({ ...cur, log: { g1d1: { status: 'done', km: 5 } } });
    render(
      <>
        <Wizard today={TODAY} />
        <ConfirmHost />
      </>
    );
    await fill(user, { raceDate: '2026-05-10', min: '23', sec: '00', km: '35' });
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Već postoji generisan plan');
    await user.click(screen.getByRole('button', { name: 'Ne' }));
    expect(collectPersisted().log['g1d1']).toBeDefined();
    expect((collectPersisted().genPlan?.ulaz as { raceDate: string }).raceDate).toBe('2026-04-12');
  });
});
