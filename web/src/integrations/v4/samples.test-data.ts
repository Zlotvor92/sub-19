/* Test podaci sloja (samo testovi ga uvoze). Uzorci preuzimanja = isti JSON uzorci koje koristi test adaptera
   (`domain/v4/adapters/fixtures`, svi formati i sve četiri distance); planovi V4 se prave kroz javni ulaz motora.
   Tvrdnje u testovima ne zavise od tačnih brojeva plana V4 (oblik, oznake, datumi, otisak). */
import {
  buildState,
  plan,
  type Goal,
  type PlanDoc,
  type RunnerFacts
} from '../../domain/v4/engine';
import { estimateForm } from '../../domain/v4/fitness';
import type { GenPlanState } from '../../domain/state';
import { DISTANCES, toFacts } from './facts';
import { adopt, type AdoptOk } from '../../domain/v4/adapters';

type PlanFile = { plan: Record<string, unknown> };
type StateFile = { plan: string; today: string; state: Record<string, unknown> };

const planFiles = import.meta.glob<PlanFile>('../../domain/v4/adapters/fixtures/*.json', {
  eager: true,
  import: 'default'
});
const stateFiles = import.meta.glob<StateFile>('../../domain/v4/adapters/fixtures/states/*.json', {
  eager: true,
  import: 'default'
});

export const addDays = (d: string, n: number): string => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

const base = (p: string): string => p.replace(/^.*\//, '').replace(/\.json$/, '');
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function deepFreeze<T>(x: T): T {
  if (typeof x === 'object' && x !== null && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v);
  }
  return x;
}

const plans = new Map(Object.entries(planFiles).map(([p, f]) => [base(p), f.plan]));
const rec = (x: unknown): Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

/** Delovi stanja koje adapter čita + aktivni plan (isti oblik kao `AdoptSnapshot` sloja). */
export interface Snapshot {
  plan: GenPlanState | null;
  log: Record<string, unknown>;
  alts: Record<string, unknown>;
  moves: Record<string, unknown>;
  vanPlana: Record<string, unknown>;
  vanPlanaV2?: Record<string, unknown>;
  knee: unknown[];
}

const snapshotOf = (state: Record<string, unknown>, planJson: unknown): Snapshot => ({
  plan: (planJson ?? null) as GenPlanState | null,
  log: rec(state['log']),
  alts: rec(state['alts']),
  moves: rec(state['moves']),
  vanPlana: rec(state['vanPlana']),
  ...(state['vanPlanaV2'] !== undefined ? { vanPlanaV2: rec(state['vanPlanaV2']) } : {}),
  knee: Array.isArray(state['knee']) ? (state['knee'] as unknown[]) : []
});

export interface Sample {
  name: string;
  today: string;
  snap: Snapshot;
}

const firstStart = (p: Record<string, unknown>): string =>
  (p['weeks'] as { start: string }[])[0]?.start ?? '2026-01-01';

/** Svaki plan sa praznim stanjem (dan pre početka) + snimljena stanja korisnika (izmene, pomeranja, unosi, bol). */
export const SAMPLES: Sample[] = [
  ...[...plans.entries()].map(([name, p]) => ({
    name: `${name} (prazno)`,
    today: addDays(firstStart(p), -1),
    snap: snapshotOf({}, p)
  })),
  ...Object.entries(stateFiles).map(([p, s]) => ({
    name: base(p),
    today: s.today,
    snap: snapshotOf(clone(s.state), plans.get(s.plan))
  }))
];

/** Nov plan V4 za svaku distancu iz izjave trkača (bez istorije), kroz sloj (`toFacts`) i javni ulaz motora. */
export const TODAY = '2026-11-16';
const WEEKS: Readonly<Record<string, number>> = { fivek: 10, tenk: 12, hm: 14, marathon: 18 };

export function newPlan(distanceId: string): { doc: PlanDoc; facts: RunnerFacts; goal: Goal } {
  const data = DISTANCES[distanceId];
  if (data === undefined) throw new Error(`nepoznata distanca ${distanceId}`);
  const goal: Goal = { distanceId, raceDate: addDays(TODAY, 7 * (WEEKS[distanceId] ?? 12) - 1) };
  const facts = toFacts({
    today: TODAY,
    availability: { runDays: [1, 3, 5, 6], longDay: 6 },
    profile: { weeklyKm: 35, easyPaceSecPerKm: 360, longestRecentKm: 15, yearsRunning: 3 }
  });
  const state = buildState(facts, goal, data, estimateForm);
  const r = plan(state, goal, data);
  if (!r.ok) throw new Error(`${distanceId}: ${r.errors.map((e) => e.code).join(', ')}`);
  return { doc: r.doc, facts, goal };
}

/** Preuzimanje uzorka direktno kroz javni ulaz adaptera (bez sloja). */
export function adoptSample(s: Sample): AdoptOk {
  const { plan: genPlan, ...rest } = s.snap;
  const r = adopt({ genPlan, ...rest }, s.today);
  if ('error' in r) throw new Error(`${s.name}: ${r.error.code}`);
  return r;
}
