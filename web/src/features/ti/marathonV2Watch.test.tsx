import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setApp } from '../../app/appContext';
import {
  MARATHON_V2_GENERATOR,
  generateMarathonV2Plan,
  marathonV2Start
} from '../../domain/generators/select';
import { resolvePlan } from '../../domain/plan';
import { WatchBody } from './icuSections';

/* SEGMENT MAR-05 (sat) — pregled slanja na sat za plan maratona v2: dan sa delom po osećaju se ne šalje, broji se i
   navodi sa razlogom (generator); plan sa rezultatom šalje sve dane trčanja osim trke. */

afterEach(() => setApp(null));

function stub(batch: ReturnType<typeof MARATHON_V2_GENERATOR.workoutsForWatch>): void {
  setApp({ icu: { watch: { preview: () => batch, threshold: () => null } } } as never);
}

const start = marathonV2Start('2027-03-07', '2026-10-26')!;
function planOf(input: Record<string, unknown>) {
  const r = generateMarathonV2Plan({ startDate: start, raceDate: '2027-03-07', ...input } as never);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return resolvePlan(r.plan.weeks, { alts: {}, moves: {} });
}

describe('slanje na sat (maraton v2): preskočeni dani sa razlogom', () => {
  it('po osećaju: „Preskočeno dana trčanja" + razlog po danu', async () => {
    const plan = planOf({
      runDays: ['tue', 'thu', 'sun'],
      currentWeeklyKm: 35,
      easyPaceSecPerKm: 390
    });
    const batch = MARATHON_V2_GENERATOR.workoutsForWatch(plan, start, 14, null);
    expect(batch.skipped).toBeGreaterThan(0);
    stub(batch);
    const user = userEvent.setup();
    render(<WatchBody />);
    await user.click(document.querySelector('#icu-vidi') as HTMLElement);
    expect(screen.getByText(`Preskočeno dana trčanja: ${batch.skipped}`)).toBeTruthy();
    const list = document.getElementById('icu-skipped')!;
    for (const reason of batch.skippedReasons!) expect(list.textContent).toContain(reason);
  });

  it('sa rezultatom: svi dani trčanja idu na sat, bez preskočenih', async () => {
    const plan = planOf({
      runDays: ['tue', 'thu', 'sat', 'sun'],
      currentWeeklyKm: 45,
      recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-10-10' }
    });
    const batch = MARATHON_V2_GENERATOR.workoutsForWatch(plan, start, 14, null);
    expect(batch.skipped).toBe(0);
    expect(batch.events).toHaveLength(
      plan.dated.filter((d) => !d.rest && d.date <= '2026-11-09').length
    );
    stub(batch);
    const user = userEvent.setup();
    render(<WatchBody />);
    await user.click(document.querySelector('#icu-vidi') as HTMLElement);
    expect(document.getElementById('icu-skipped')).toBeNull();
    expect(screen.queryByText(/Preskočeno dana trčanja/)).toBeNull();
  });
});
