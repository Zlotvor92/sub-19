import { describe, expect, it } from 'vitest';
import {
  emptyImportState,
  runIcu,
  runStrava,
  steady,
  type IcuWorld,
  type StravaWorld
} from '@/test/importScenario';
import type { IcuActivity } from '../../../../activities';
import { resolvePlan } from '../../../../plan';
import type { GenPlanState } from '../../../../state';
import { initialWizard, toGenerationInput } from '../../../../onboarding';
import type { HmV2PlanInput } from '../../../contract';
import { HALF_MARATHON_GENERATOR, generateHmV2Plan, stampForStorage } from '../../../select';

/* SEGMENT HM-05 (pouka 8) — uvoz (Strava, intervals.icu) u plan HM v2 koristi postojeću infrastrukturu 5K 08c (kao 10K
   v2): trčanje na dan plana se upari sa danom (dnevnik), trčanje na dan odmora postaje zapis van plana (`vanPlanaV2`), a
   potpuna sinhronizacija pomera `fullSync`. Ništa se ne gubi. Plan HM v1: isti tok kao ranije (bez zapisa van plana i
   `fullSync`; bajt-isto dokazuje `services/importV1Snapshot.node.test.ts`). Činjenice za adaptaciju su segment HM-06. */

const INPUT: HmV2PlanInput = {
  startDate: '2026-11-02',
  raceDate: '2027-01-31',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 40,
  recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-10-20' }
};
const TODAY = '2026-11-15'; // nedelja; 2. nedelja plana: 11-09 – 11-15
const NOW = Date.UTC(2026, 10, 15, 9);
const REST_RUNS = ['2026-11-09', '2026-11-11', '2026-11-13']; // pon, sre, pet — dani odmora
const STRAVA_LINK = { access: 'a', refresh: 'r', expiresAt: 99999999999, lastSync: 0 };
const ICU_LINK = { athleteId: 'i77', apiKey: 'k', lastSync: null };

function v2Plan(): GenPlanState {
  const r = generateHmV2Plan(INPUT);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return stampForStorage(r.plan);
}
function v1Plan(): GenPlanState {
  const input = toGenerationInput(
    {
      ...initialWizard(),
      raceDist: 21097.5,
      raceDate: '2027-01-31',
      pbDist: 10000,
      pbMin: '45',
      pbSec: '0',
      weeklyKm: '40',
      runDays: 4,
      runDows: [2, 4, 6, 7]
    },
    '2026-11-02'
  )!;
  const gen = HALF_MARATHON_GENERATOR.generatePlan(input);
  return stampForStorage(HALF_MARATHON_GENERATOR.adaptGeneratedPlan(gen)!);
}
const view = (p: GenPlanState) => resolvePlan(p.weeks, { alts: {}, moves: {} });

interface Run {
  id: number;
  date: string;
  km: number;
}
/** Nedelja 1 po planu (dani plana), nedelja 2 samo na dane odmora. */
function runs(p: GenPlanState): Run[] {
  const out: Run[] = [];
  let id = 700;
  for (const d of view(p).dated)
    if (!d.rest && d.date <= '2026-11-08') out.push({ id: id++, date: d.date, km: d.km ?? 5 });
  for (const date of REST_RUNS) out.push({ id: id++, date, km: 8 });
  return out;
}
function stravaWorld(list: readonly Run[]): StravaWorld {
  const w: StravaWorld = { acts: [], streams: {}, laps: {}, failing: new Set() };
  for (const r of list) {
    w.acts.push({
      id: r.id,
      name: `Trčanje ${r.id}`,
      type: 'Run',
      sport_type: 'Run',
      start_date_local: `${r.date}T07:00:00Z`,
      distance: Math.round(r.km * 1000),
      moving_time: Math.round(r.km * 330)
    });
    w.streams[String(r.id)] = steady(Math.max(1, Math.round(r.km)), 330);
  }
  return w;
}
function icuWorld(list: readonly Run[]): IcuWorld {
  const w: IcuWorld = { activities: [], details: {}, streams: {} };
  for (const r of list) {
    const id = `i${r.id}`;
    const a: IcuActivity = {
      id,
      datum: r.date,
      sat: 7,
      tip: 'Run',
      km: r.km,
      sec: Math.round(r.km * 330)
    };
    w.activities.push(a);
    w.details[id] = { rounds: [], groups: [] };
    w.streams[id] = steady(Math.max(1, Math.round(r.km)), 330);
  }
  return w;
}

describe('uvoz u plan HM v2: ništa se ne gubi (infrastruktura 08c)', () => {
  it('Strava: trčanja na dane plana u dnevnik, na dane odmora → zapisi van plana; fullSync', async () => {
    const p = v2Plan();
    const list = runs(p);
    const s = await runStrava(emptyImportState(p), stravaWorld(list), STRAVA_LINK, {
      now: NOW,
      today: TODAY
    });
    expect(s.result).toMatchObject({ ok: true });
    const planned = view(p).dated.filter((d) => !d.rest && d.date <= '2026-11-08');
    for (const d of planned) expect(s.state.log[d.id]?.status, d.id).toBe('done');
    const off = Object.values(s.state.vanPlanaV2 ?? {}).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    expect(off.map((r) => [r.date, r.src, r.km])).toEqual(REST_RUNS.map((d) => [d, 'strava', 8]));
    expect(s.link['fullSync']).toBe(NOW);
    expect(s.link['syncIssues']).toEqual([]);
    // Svako trčanje je negde: upareno sa danom plana ili zapis van plana.
    expect(planned.length + off.length).toBe(list.length);
  });

  it('intervals.icu: isto — dnevnik + zapisi van plana; fullSync i trSync', async () => {
    const p = v2Plan();
    const s = await runIcu(emptyImportState(p), icuWorld(runs(p)), ICU_LINK, {
      now: NOW,
      today: TODAY
    });
    expect(s.result).toMatchObject({ ok: true });
    for (const d of view(p).dated.filter((x) => !x.rest && x.date <= '2026-11-08'))
      expect(s.state.log[d.id]?.status, d.id).toBe('done');
    const off = Object.values(s.state.vanPlanaV2 ?? {}).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    expect(off.map((r) => [r.date, r.src])).toEqual(REST_RUNS.map((d) => [d, 'icu']));
    expect(s.link['fullSync']).toBe(NOW);
    expect(s.link['trSync']).toBe(NOW);
  });

  it('plan HM v1 (isti scenario): bez zapisa van plana i bez fullSync — isti tok kao ranije', async () => {
    const p = v1Plan();
    const s = await runStrava(emptyImportState(p), stravaWorld(runs(p)), STRAVA_LINK, {
      now: NOW,
      today: TODAY
    });
    expect(s.result).toMatchObject({ ok: true });
    expect(s.state.vanPlanaV2).toBeUndefined();
    expect(s.link).not.toHaveProperty('fullSync');
    const i = await runIcu(emptyImportState(p), icuWorld(runs(p)), ICU_LINK, {
      now: NOW,
      today: TODAY
    });
    expect(i.state.vanPlanaV2).toBeUndefined();
    expect(i.link).not.toHaveProperty('fullSync');
  });
});
