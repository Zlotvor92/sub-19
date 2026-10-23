import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmHost } from '../../components/ui/ConfirmHost';
import { generateFiveKV2Plan, isFiveKV2Plan } from '../../domain/generators/select';
import type { StructuredPlanInput } from '../../domain/generators/contract';
import { resolvePlan } from '../../domain/plan';
import { getPlanRevisions } from '../../domain/plan/versions';
import {
  seedState,
  type GenPlanState,
  type LogEntry,
  type PersistedState
} from '../../domain/state';
import { ADMIN_UID } from '../../services/config';
import { collectPersisted, hydratePersisted } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { TrainingSettingsScreen } from '../ti/screens';
import { FormScreen } from '../race/FormScreen';
import { Advisories } from '../today/Advisories';
import { AdjustPlan } from './AdjustPlan';
import PlanPage from './index';

/* SEGMENT 08b — tok prilagođavanja 5K v2 u aplikaciji: dnevnik 2 nedelje sa propuštenom nedeljom → pregled (bez
   potvrde ništa, uz potvrdu pauza) → potvrda → nova revizija → vraćanje revizije; bol 5 → traka → pregled → primena;
   Forma iz rezultata; prekidač vidljiv samo razvoju/administratoru; km nedelje kao v2. */

const INPUT: StructuredPlanInput = {
  startDate: '2026-11-02',
  raceDate: '2027-01-10',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 25,
  recentResult: { distanceM: 5000, timeSec: 1500, date: '2026-10-20' },
  goalTimeSec: 1440
};

function plan(): GenPlanState {
  const r = generateFiveKV2Plan(INPUT);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
function weekOneDone(p: GenPlanState): Record<string, LogEntry> {
  const out: Record<string, LogEntry> = {};
  for (const d of resolvePlan(p.weeks, { alts: {}, moves: {} }).dated)
    if (!d.rest && d.date <= '2026-11-08')
      out[d.id] = { status: 'done', km: d.km ?? 0, sec: Math.round((d.km ?? 0) * 360), ts: d.date };
  return out;
}
function state(extra: Partial<PersistedState>): PersistedState {
  return { ...(JSON.parse(JSON.stringify(seedState())) as PersistedState), ...extra };
}
const stored = () => collectPersisted().genPlan!;

beforeEach(() => {
  useAuthStore.setState({ configured: true, hasSession: false, userId: null, email: null });
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Plan → Prilagodi plan (5K v2)', () => {
  it('propuštena nedelja: pregled → potvrda → nova revizija → vraćanje revizije', async () => {
    const p = plan();
    hydratePersisted(state({ genPlan: p, log: weekOneDone(p) }));
    useUIStore.setState({ today: '2026-11-15', confirm: null });
    const user = userEvent.setup();
    render(
      <>
        <AdjustPlan />
        <ConfirmHost />
      </>
    );
    // Pregled odmah: bez potvrde potpunosti dan bez zapisa nije pauza → nema promene.
    const preview = () => document.getElementById('plan-change-preview')!;
    expect(within(preview()).getByText('Budući deo plana se ne menja.')).toBeTruthy();
    expect(within(preview()).getByText(/Zapis treninga nije potvrđen kao potpun/)).toBeTruthy();
    expect(
      within(preview()).getByRole<HTMLButtonElement>('button', {
        name: 'Primeni prikazanu promenu'
      }).disabled
    ).toBe(true);
    // Potvrda „zapis za proteklih 14 dana je potpun" → pauza 7 dana, promenjene nedelje.
    await user.click(screen.getByLabelText(/Zapis treninga za proteklih/));
    const reasons = within(preview()).getByRole('list', { name: 'Razlozi prilagođavanja' });
    expect(reasons.textContent).toMatch(/Pauza 7 dana \(obim 7 dana pre pauze/);
    const table = within(preview()).getByRole('table', { name: 'Promenjene nedelje' });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
    expect(stored()).toEqual(p); // pregled ne upisuje
    await user.click(within(preview()).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    expect(screen.getByRole('status').textContent).toMatch(/Plan je prilagođen/);
    const after = stored();
    expect(isFiveKV2Plan(after)).toBe(true);
    expect(getPlanRevisions(after)).toHaveLength(1);
    expect(after.weeks.slice(0, 2)).toEqual(p.weeks.slice(0, 2));
    expect(after.weeks.slice(2)).not.toEqual(p.weeks.slice(2));
    // Vraćanje revizije (sledećeg dana): pregled pa potvrda; budući dani iz sačuvane verzije.
    useUIStore.setState({ today: '2026-11-16' });
    await user.click(
      screen.getByRole('button', { name: 'Pregledaj vraćanje: Prilagođavanje 2026-11-15: pauza' })
    );
    expect(
      within(preview()).getByText('Vraćanje plana: Prilagođavanje 2026-11-15: pauza')
    ).toBeTruthy();
    await user.click(within(preview()).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    const back = stored();
    expect(getPlanRevisions(back)).toHaveLength(2);
    expect(back.weeks.slice(2)).toEqual(p.weeks.slice(2));
  });

  it('bol 5 → traka „Plan treba prilagoditi" (Plan i Danas) → isti pregled → primena → traka nestaje', async () => {
    const p = plan();
    hydratePersisted(state({ genPlan: p, knee: [{ date: '2026-11-11', pain: 5, src: null }] }));
    useUIStore.setState({ today: '2026-11-12', confirm: null, screens: [] });
    const user = userEvent.setup();
    const { unmount } = render(<PlanPage />);
    const banner = document.getElementById('v2-needed')!;
    expect(banner.textContent).toMatch(/Plan treba prilagoditi/);
    expect(banner.textContent).toMatch(/Bol 5\/10 u poslednja 3 dana/);
    await user.click(within(banner).getByRole('button', { name: 'Pregledaj' }));
    expect(useUIStore.getState().screens.at(-1)).toMatchObject({ kind: 'plan-prilagodi' });
    expect(stored()).toEqual(p); // traka ne upisuje
    unmount();
    const today = render(<Advisories today="2026-11-12" />);
    expect(screen.getByText('Plan treba prilagoditi')).toBeTruthy();
    today.unmount();
    const adj = render(<AdjustPlan />);
    const pv = document.getElementById('plan-change-preview')!;
    expect(within(pv).getByRole('list', { name: 'Razlozi prilagođavanja' }).textContent).toMatch(
      /Bol 5\/10/
    );
    await user.click(within(pv).getByRole('button', { name: 'Primeni prikazanu promenu' }));
    expect(getPlanRevisions(stored())).toHaveLength(1);
    adj.unmount();
    render(<PlanPage />);
    expect(document.getElementById('v2-needed')).toBeNull();
  });

  it('odbijanje v2 → poruka sa razlogom, plan se ne menja', () => {
    // 5k-v2.10.3 (08k): rezultat van opsega VDOT se više ne odbija (RESULT_IGNORED) — odbijanje: asOf = dan trke.
    const p = plan();
    hydratePersisted(state({ genPlan: p }));
    useUIStore.setState({ today: '2027-01-10', confirm: null });
    render(<AdjustPlan />);
    const box = document.getElementById('v2-adapt-rejected')!;
    expect(within(box).getByRole('status').textContent).toMatch(
      /Plan nije prilagođen\. Razlozi:asOf mora biti pre dana trke/
    );
    expect(stored()).toEqual(p);
  });
});

describe('Napredak → Forma (5K v2) i km nedelje', () => {
  it('Forma: VDOT iz rezultata i ocena cilja, bez lanca forme v1', () => {
    const p = plan();
    hydratePersisted(state({ genPlan: p, t3k: [{ id: 't3k-1', date: '2026-11-10', sec: 760 }] }));
    useUIStore.setState({ today: '2026-11-12' });
    render(<FormScreen />);
    expect(screen.getByText(/VDOT plana:/).textContent).toMatch(/38[.,]3/);
    expect(document.getElementById('v2-form-goal')!.textContent).toMatch(/^Cilj: ambiciozan — /);
    const list = screen.getByRole('list', { name: 'Istorija VDOT-a iz rezultata' });
    expect(list.textContent).toMatch(/rezultat iz čarobnjaka\) \(u planu\)/);
    expect(list.textContent).toMatch(
      /Test 3K 12:40 — čeka prilagođavanje plana \(čeka prilagođavanje\)/
    );
    expect(screen.queryByText('Da li napredujem?')).toBeNull();
  });

  it('Plan tab: km trkačke nedelje kao u v2, trka posebno', async () => {
    const p = plan();
    hydratePersisted(state({ genPlan: p }));
    useUIStore.setState({ today: '2027-01-06' });
    render(<PlanPage />);
    const v2 = p['fiveKV2'] as { weeks: Array<{ plannedKm: number }> };
    const km = document.querySelector('.weekkm .weekkm-v')!.textContent.replace(/\s*km$/, '');
    expect(Number(km.replace(',', '.'))).toBeCloseTo(v2.weeks[9]!.plannedKm, 1);
    await waitFor(() =>
      expect(document.getElementById('week-race-km')!.textContent).toMatch(
        /^\+ trka 5 km \(dan trke \d+[.,]?\d* km sa zagrevanjem i hlađenjem\) — van obima nedelje$/
      )
    );
  });
});

describe('Prekidač 5K v2: vidljiv samo uz VITE_FIVEK_V2 ili administratoru', () => {
  it('običan korisnik bez env: nema prekidača; administrator ili env: ima', () => {
    hydratePersisted(state({}));
    vi.stubEnv('VITE_FIVEK_V2', '');
    const a = render(<TrainingSettingsScreen />);
    expect(screen.queryByText('Generator plana')).toBeNull();
    a.unmount();
    useAuthStore.setState({ configured: true, hasSession: true, userId: ADMIN_UID, email: null });
    const b = render(<TrainingSettingsScreen />);
    expect(screen.getByText('Generator plana')).toBeTruthy();
    b.unmount();
    useAuthStore.setState({ configured: true, hasSession: false, userId: null, email: null });
    vi.stubEnv('VITE_FIVEK_V2', '1');
    render(<TrainingSettingsScreen />);
    expect(screen.getByLabelText(/Novi 5K plan pravi generator v2/)).toBeTruthy();
  });
});
