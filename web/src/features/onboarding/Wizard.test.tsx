import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfirmHost } from '../../components/ui/ConfirmHost';
import { isFiveKV2Plan } from '../../domain/generators/select';
import { seedState, type PersistedState } from '../../domain/state';
import { collectPersisted, hydratePersisted } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { Wizard } from './Wizard';

/* V1b: čarobnjak ima jednu putanju — koraci generatora v2 izabrane distance (trka → rezultat → iskustvo → dani), bez
   podešavanja i prekidača. Tok po distanci: `fiveKV2Flow`, `tenKV2Flow`, `hmV2Flow`, `marathonV2Flow`. Ovde: zajednička
   ljuska čarobnjaka (zaključan „Dalje", „✕" samo uz plan, potvrda pre brisanja unosa postojećeg plana). */

const TODAY = '2026-01-07';
const blank = (): PersistedState => JSON.parse(JSON.stringify(seedState())) as PersistedState;

beforeEach(() => {
  hydratePersisted(blank());
  useUIStore.setState({ wizard: false, confirm: null });
});

/** Ceo tok 5K v2: datum trke, rezultat, obim, dani. */
async function fiveK(user: ReturnType<typeof userEvent.setup>, raceDate: string, km: string) {
  await user.type(screen.getByLabelText('Datum trke'), raceDate);
  await user.click(screen.getByRole('button', { name: 'Dalje' }));
  await user.click(screen.getByRole('button', { name: 'Imam rezultat' }));
  await user.type(screen.getByLabelText('minuti'), '22');
  await user.type(screen.getByLabelText('sekunde'), '30');
  await user.type(screen.getByLabelText('Datum rezultata'), '2026-01-03');
  await user.click(screen.getByRole('button', { name: 'Dalje' }));
  await user.type(screen.getByLabelText('Nedeljna kilometraža'), km);
  await user.click(screen.getByRole('button', { name: 'Trčim redovno' }));
  await user.click(screen.getByRole('button', { name: 'Dalje' }));
  const group = screen.getByRole('group', { name: 'Dani trčanja' });
  for (const d of ['Uto', 'Čet', 'Sub', 'Ned'])
    await user.click(within(group).getByRole('button', { name: d }));
}

describe('čarobnjak (samo v2)', () => {
  it('„Dalje" je zaključano dok korak nije ispunjen; bez plana nema „✕"; koraci v2', async () => {
    const user = userEvent.setup();
    render(<Wizard today={TODAY} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Za koju trku se spremaš?');
    expect(screen.getByRole('button', { name: 'Dalje' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Otkaži' })).toBeNull();
    expect(screen.getByText('Iskustvo')).toBeTruthy();
    expect(screen.getByText('Dani')).toBeTruthy();
    expect(screen.queryByText('Intenzitet')).toBeNull();
    await user.type(screen.getByLabelText('Datum trke'), '2026-04-12');
    expect(screen.getByRole('button', { name: 'Dalje' })).toBeEnabled();
  });

  it('nov plan je plan v2; postojeći plan sa podacima: pita pre brisanja, „Ne" ništa ne menja', async () => {
    const user = userEvent.setup();
    const first = render(
      <>
        <Wizard today={TODAY} />
        <ConfirmHost />
      </>
    );
    await fiveK(user, '2026-04-12', '30');
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    await waitFor(() => expect(collectPersisted().genPlan).not.toBeNull());
    const made = collectPersisted().genPlan!;
    expect(isFiveKV2Plan(made)).toBe(true);
    first.unmount();
    const cur = collectPersisted();
    hydratePersisted({ ...cur, log: { g1d1: { status: 'done', km: 5 } } });
    render(
      <>
        <Wizard today={TODAY} />
        <ConfirmHost />
      </>
    );
    expect(screen.getByRole('button', { name: 'Otkaži' })).toBeTruthy();
    await fiveK(user, '2026-04-26', '35');
    await user.click(screen.getByRole('button', { name: 'Napravi plan' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Već postoji generisan plan');
    await user.click(screen.getByRole('button', { name: 'Ne' }));
    expect(collectPersisted().log['g1d1']).toBeDefined();
    expect(collectPersisted().genPlan).toEqual(made);
  });
});
