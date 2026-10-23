import { render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp';
import { ConfirmHost } from '../../components/ui/ConfirmHost';
import type { StructuredPlanInput } from '../../domain/generators/contract';
import { generateFiveKV2Plan } from '../../domain/generators/select';
import { resolvePlan } from '../../domain/plan';
import { seedState, type GenPlanState, type PersistedState } from '../../domain/state';
import { createKeyValueStore, type StorageLike } from '../../services/storage/kv';
import { steady } from '../../test/importScenario';
import { collectPersisted, hydratePersisted } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { AdjustPlan } from './AdjustPlan';

/* SEGMENT 08c (UI) — ceo put: createApp → uvoz sa Strave (prava veza store-ova) → Plan → Prilagodi plan. Nedelja 1 po
   planu, nedelja 2 samo na dane odmora (isti obim): uvoz ih beleži kao trčanja van plana, pa pregled ne predlaže
   smanjenje (ni pauzu ni manjak), iako je sinhronizacija potpuna danas. */

const INPUT: StructuredPlanInput = {
  startDate: '2026-11-02',
  raceDate: '2027-01-10',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 25,
  recentResult: { distanceM: 5000, timeSec: 1500, date: '2026-10-20' },
  goalTimeSec: 1440
};
const TODAY = '2026-11-15';
const NOW = Date.UTC(2026, 10, 15, 9);

class Mem implements StorageLike {
  d = new Map<string, string>();
  getItem(k: string): string | null {
    return this.d.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.d.set(k, v);
  }
  removeItem(k: string): void {
    this.d.delete(k);
  }
}
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function plan(): GenPlanState {
  const r = generateFiveKV2Plan(INPUT);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}

/** Strava: nedelja 1 na dane plana, nedelja 2 (isti obim) na dane odmora; tokovi svakog trčanja. */
function activities(p: GenPlanState): { list: unknown[]; streams: Map<string, unknown> } {
  const days = resolvePlan(p.weeks, { alts: {}, moves: {} }).dated;
  const out: unknown[] = [];
  const streams = new Map<string, unknown>();
  let id = 300;
  const run = (date: string, km: number) => {
    streams.set(String(id), steady(Math.max(1, Math.round(km)), 360));
    out.push({
      id: id++,
      name: 'Trčanje',
      type: 'Run',
      sport_type: 'Run',
      start_date_local: `${date}T07:00:00Z`,
      distance: Math.round(km * 1000),
      moving_time: Math.round(km * 360)
    });
  };
  for (const d of days) if (!d.rest && d.date <= '2026-11-08') run(d.date, d.km ?? 5);
  const week2 = days
    .filter((d) => !d.rest && d.date >= '2026-11-09' && d.date <= TODAY)
    .reduce((s, d) => s + (d.km ?? 0), 0);
  for (const date of ['2026-11-09', '2026-11-11', '2026-11-13']) run(date, week2 / 3);
  return { list: out, streams };
}

beforeEach(() => {
  useAuthStore.setState({ configured: true, hasSession: false, userId: null, email: null });
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('08c: Prilagodi plan (5K v2) posle uvoza sa trčanjima van plana', () => {
  it('Strava uvoz → zapisi van plana → pregled bez smanjenja (nema pauze ni manjka), zapis potpun', async () => {
    const p = plan();
    const acts = activities(p);
    const stream = (url: string) =>
      acts.streams.get(/\/activities\/(\d+)\/streams/.exec(url)?.[1] ?? '');
    const app = createApp({
      kv: createKeyValueStore(new Mem()),
      fetcher: (url) =>
        Promise.resolve(
          url.startsWith('https://www.strava.com/api/v3/athlete/activities')
            ? json(200, acts.list)
            : stream(url)
              ? json(200, stream(url))
              : json(404, { message: 'nema' })
        ),
      now: () => NOW,
      today: () => TODAY,
      online: () => true,
      notify: () => undefined
    });
    hydratePersisted({
      ...(JSON.parse(JSON.stringify(seedState())) as PersistedState),
      genPlan: p,
      strava: {
        access: 'AT',
        refresh: 'RT',
        expiresAt: Math.floor(NOW / 1000) + 21600,
        zonesTs: NOW,
        lastSync: 0
      }
    });
    useUIStore.setState({ today: TODAY, confirm: null });

    const r = await app.activities.sync(true);
    expect(r).toMatchObject({ ok: true, source: 'strava' });
    const st = collectPersisted();
    expect(
      Object.values(st.vanPlanaV2 ?? {})
        .map((x) => x.date)
        .sort()
    ).toEqual(['2026-11-09', '2026-11-11', '2026-11-13']);
    expect(st.strava?.['syncIssues']).toEqual([]);
    expect(st.strava?.['fullSync']).toBe(NOW);

    render(
      <>
        <AdjustPlan />
        <ConfirmHost />
      </>
    );
    const pv = document.getElementById('plan-change-preview')!;
    expect(
      within(pv).getByText(/Zapis treninga je potpun od 2026-11-02 do 2026-11-15/)
    ).toBeTruthy();
    expect(within(pv).getByText('Budući deo plana se ne menja.')).toBeTruthy();
    expect(pv.textContent).not.toMatch(/Pauza \d+ dana/);
    expect(pv.textContent).not.toMatch(/Izvršeno .* \(< 60%\)/);
    expect(within(pv).queryByRole('table', { name: 'Promenjene nedelje' })).toBeNull();
    expect(collectPersisted().genPlan).toEqual(p); // pregled ne upisuje
  });
});
