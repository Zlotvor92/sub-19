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
  it('istorija i odvojena težina preživljavaju pravljenje, čuvanje i ponovno učitavanje stanja', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    await fill(user, { raceDate: '2026-04-12', min: '24', sec: '30', km: '40' });
    await user.click(screen.getByRole('button', { name: 'Nazad' }));
    await user.click(screen.getByText('Tvoja trenutna baza — opciono'));
    await user.type(screen.getByLabelText('Skorašnja ponovljiva dužina (km)'), '12');
    await user.type(screen.getByLabelText('Nedelja redovnog trčanja u kontinuitetu'), '24');
    await user.type(screen.getByLabelText('Skorašnja pauza (nedelja)'), '0');
    await user.selectOptions(
      screen.getByLabelText('Iskustvo sa intervalima i tempo treningom'),
      'experienced'
    );
    await user.click(screen.getByRole('button', { name: 'Dalje' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Težina kvalitetnog rada' })).getByRole('button', {
        name: 'Konzervativno'
      })
    );
    await user.click(
      within(screen.getByRole('group', { name: 'Tempo rasta obima' })).getByRole('button', {
        name: 'Agresivno'
      })
    );
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    const saved = collectPersisted();
    expect(saved.genPlan?.ulaz).toMatchObject({
      recentLongRunKm: 12,
      consistentWeeks: 24,
      breakWeeks: 0,
      qualityExperience: 'experienced',
      intensity: 'kons',
      volIntensity: 'agr'
    });
    expect(saved.genPlan?.meta).toMatchObject({
      athlete: { qualityReadiness: 'experienced' },
      preparation: { forecastBasis: 'result-and-delivered-preparation' }
    });
    hydratePersisted(JSON.parse(JSON.stringify(saved)) as PersistedState);
    expect(collectPersisted().genPlan?.ulaz).toEqual(saved.genPlan?.ulaz);
    expect(collectPersisted().genPlan?.meta).toEqual(saved.genPlan?.meta);
  });

  it('„Dalje" je zaključano dok korak nije ispunjen; bez plana nema „✕"', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Za koju trku se spremaš?');
    expect(screen.getByRole('button', { name: 'Dalje' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Otkaži' })).toBeNull();
    await user.type(screen.getByLabelText('Datum trke'), '2026-04-12');
    expect(screen.getByRole('button', { name: 'Dalje' })).toBeEnabled();
  });

  it('napomena pod datumom: kratko za izabranu distancu → savet bez blokade; dovoljno → pun ciklus', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    await user.type(screen.getByLabelText('Datum trke'), '2026-02-08');
    expect(screen.getByText(/možeš napraviti plan za izabrani datum/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Datum trke'));
    await user.type(screen.getByLabelText('Datum trke'), '2026-04-12');
    expect(screen.getByText(/pun ciklus pripreme za 5K/)).toBeInTheDocument();
  });

  it.each([
    ['5K', '2026-02-08', 5000],
    ['10K', '2026-02-22', 10000],
    ['Polumaraton', '2026-03-08', 21097.5],
    ['Maraton', '2026-03-22', 42195]
  ])('kratka priprema za %s može da se napravi i sačuva', async (name, raceDate, distance) => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    await user.click(
      within(screen.getByRole('group', { name: 'Ciljna distanca' })).getByRole('button', {
        name: String(name)
      })
    );
    await fill(user, { raceDate: String(raceDate), min: '24', sec: '30', km: '40' });
    expect(screen.getByText('Trenutna forma')).toBeInTheDocument();
    expect(await screen.findByText(/Skraćena priprema/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    const saved = collectPersisted();
    expect(saved.genPlan?.meta?.raceDate).toBe(raceDate);
    expect(saved.genPlan?.meta?.raceDistM).toBe(distance);
    expect(saved.genPlan?.meta?.dayWarnings.join(' ')).toContain('Skraćena priprema');
    hydratePersisted(JSON.parse(JSON.stringify(saved)) as PersistedState);
    expect(collectPersisted().genPlan).toEqual(saved.genPlan);
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
      'Kako da izgleda priprema?'
    );
    // jedna referenca trenutne forme
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

  it('korak 4: rast obima je dostupan bez izbora obećanog napretka forme', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    await fill(user, { raceDate: '2026-04-12', min: '24', sec: '30', km: '30' });
    const vol = screen.getByRole('group', { name: 'Tempo rasta obima' });
    expect(within(vol).getByRole('button', { name: 'Standardno' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.queryByText('Tempo napretka')).not.toBeInTheDocument();
    expect(screen.getByText('Trenutna forma')).toBeInTheDocument();
    await user.click(within(vol).getByRole('button', { name: 'Konzervativno' }));
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    expect(collectPersisted().genPlan?.ulaz).toMatchObject({
      intensity: 'std',
      volIntensity: 'kons'
    });
    expect(collectPersisted().genPlan?.meta).toMatchObject({
      assessmentBasis: 'current-fitness'
    });
  });

  it('cilj se poredi sa trenutnom formom bez obećanja budućeg rezultata', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    await fill(user, { raceDate: '2026-04-12', min: '24', sec: '30', km: '30' });
    await user.type(screen.getByLabelText('minuti', { selector: '#in-goalMin' }), '15');
    await user.type(screen.getByLabelText('sekunde', { selector: '#in-goalSec' }), '00');
    expect(await screen.findByText(/Cilj 15:00 traži napredak/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('minuti', { selector: '#in-goalMin' }));
    await user.type(screen.getByLabelText('minuti', { selector: '#in-goalMin' }), '26');
    expect(
      await screen.findByText(/Cilj 26:00 je u okviru procene trenutne forme/)
    ).toBeInTheDocument();
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
