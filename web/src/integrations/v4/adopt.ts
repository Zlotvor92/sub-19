/* F9 · SLOJ APLIKACIJA ↔ V4: PREUZIMANJE AKTIVNOG PLANA (INTEGRACIJA.md § 2e, AGENTS t. 8).
   Stanje aplikacije → `adopt` (jedino mesto koje zna stari format) → provera otiska. Plan se smatra preuzetim SAMO kad
   je otisak pre = otisak posle; inače ostaje stari prikaz i vraća se nalaz (pitanje 5). Ništa se ne upisuje. */
import {
  adopt as adoptPlan,
  fingerprintLegacy,
  type AdoptOk,
  type ReadError
} from '../../domain/v4/adapters';
import { fingerprint, type IsoDate, type PlanDoc, type RunnerFacts } from '../../domain/v4/engine';
import type { GenPlanState } from '../../domain/state';

/** Delovi `PersistedState` koje adapter čita, plus AKTIVNI plan (pravi `genPlan` ili ugrađeni lični plan, `activeOf`). */
export interface AdoptSnapshot {
  plan: GenPlanState | null;
  log: Readonly<Record<string, unknown>>;
  alts: Readonly<Record<string, unknown>>;
  moves: Readonly<Record<string, unknown>>;
  vanPlana: Readonly<Record<string, unknown>>;
  vanPlanaV2?: Readonly<Record<string, unknown>>;
  knee: readonly unknown[];
}

export type AdoptOutcome =
  | {
      status: 'preuzet';
      doc: PlanDoc;
      facts: RunnerFacts;
      carried: AdoptOk['carried'];
      fallbackDays: string[];
      fingerprint: string;
    }
  | { status: 'nema-plana' }
  | { status: 'greska'; error: ReadError }
  | { status: 'otisak-razlicit'; before: string | null; after: string };

/** Zavisnosti (zamenljive samo u testu, da se proveri grana „otisak različit"). */
export interface AdoptDeps {
  adopt: typeof adoptPlan;
  fingerprintLegacy: typeof fingerprintLegacy;
  fingerprint: typeof fingerprint;
}
const DEFAULT_DEPS: AdoptDeps = { adopt: adoptPlan, fingerprintLegacy, fingerprint };

/** Ulaz adaptera u obliku `PersistedState` (`genPlan` = aktivni plan). */
export const adapterInput = (s: AdoptSnapshot): Record<string, unknown> => ({
  genPlan: s.plan,
  log: s.log,
  alts: s.alts,
  moves: s.moves,
  vanPlana: s.vanPlana,
  ...(s.vanPlanaV2 !== undefined ? { vanPlanaV2: s.vanPlanaV2 } : {}),
  knee: s.knee
});

export function adoptActive(
  s: AdoptSnapshot,
  today: IsoDate,
  deps: AdoptDeps = DEFAULT_DEPS
): AdoptOutcome {
  if (s.plan === null) return { status: 'nema-plana' };
  const input = adapterInput(s);
  const r = deps.adopt(input, today);
  if ('error' in r) return { status: 'greska', error: r.error };
  const before = deps.fingerprintLegacy(input);
  const after = deps.fingerprint(r.doc, r.facts);
  if (before !== after) return { status: 'otisak-razlicit', before, after };
  return {
    status: 'preuzet',
    doc: r.doc,
    facts: r.facts,
    carried: r.carried,
    fallbackDays: r.fallbackDays,
    fingerprint: after
  };
}
