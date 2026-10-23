import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setApp } from '../../app/appContext';
import {
  TEN_K_V2_GENERATOR,
  generateTenKV2Plan,
  tenKV2Start
} from '../../domain/generators/select';
import { resolvePlan } from '../../domain/plan';
import { WatchBody } from './icuSections';

/* SEGMENT 05 (P7) — pregled slanja na sat za plan 10K v2: dan sa delom po osećaju se ne šalje, broji se i navodi sa
   razlogom (generator); bez razloga (ostali generatori) poruka ostaje stara. */

afterEach(() => setApp(null));

function stub(batch: ReturnType<typeof TEN_K_V2_GENERATOR.workoutsForWatch>): void {
  setApp({ icu: { watch: { preview: () => batch, threshold: () => null } } } as never);
}

describe('slanje na sat: preskočeni dani sa razlogom', () => {
  it('10K v2 po osećaju: „Preskočeno dana trčanja" + razlog po danu', async () => {
    const start = tenKV2Start('2027-01-24', '2026-10-26')!;
    const r = generateTenKV2Plan({
      startDate: start,
      raceDate: '2027-01-24',
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 25,
      easyPaceSecPerKm: 390
    });
    if (!r.ok) throw new Error('plan');
    const plan = resolvePlan(r.plan.weeks, { alts: {}, moves: {} });
    const batch = TEN_K_V2_GENERATOR.workoutsForWatch(plan, start, 14, null);
    expect(batch.skipped).toBeGreaterThan(0);
    stub(batch);
    const user = userEvent.setup();
    render(<WatchBody />);
    await user.click(document.querySelector('#icu-vidi') as HTMLElement);
    expect(screen.getByText(`Preskočeno dana trčanja: ${batch.skipped}`)).toBeTruthy();
    const list = document.getElementById('icu-skipped')!;
    for (const reason of batch.skippedReasons!) expect(list.textContent).toContain(reason);
  });

  it('bez razloga (ostali generatori): stara poruka', async () => {
    stub({
      events: [
        {
          date: '2026-01-15',
          externalId: 'sub19-g1d2',
          name: 'Lako',
          description: '- 5km 6:00/km Pace'
        }
      ],
      skipped: 2
    });
    const user = userEvent.setup();
    render(<WatchBody />);
    await user.click(document.querySelector('#icu-vidi') as HTMLElement);
    expect(document.getElementById('icu-skipped')).toBeNull();
    expect(screen.getByText(/za njih nije poznat lagan/)).toBeTruthy();
  });
});
