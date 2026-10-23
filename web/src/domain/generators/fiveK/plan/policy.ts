/* IDENTITET POLITIKE I FAZA NEDELJE — odluke ovog (5K) generatora koje se upisuju u plan (A3, A7).

   - `POLICY_ID`/`POLICY_VERSION`: koja politika je POSLEDNJA upisala plan (novi plan ili revizija posle prilagođavanja).
     Plan bez oznake je `legacy-5k` (napravljen pre oznake) i obrađuje ga ovaj, postojeći generator; to NE znači da
     današnji kod reprodukuje taj plan. Oznaka koju ovaj generator ne poznaje (druga distanca, novija ili istorijska
     verzija) je `unknown`: aplikacija to prikazuje eksplicitno, bez tihe zamene.
   - `phase` po nedelji: faza za prikaz iz ovog generatora (`weekPhase` iz `./describe`). Stari plan bez polja dobija fazu
     istom funkcijom pri čitanju (`phaseOfWeek`), ne iz zajedničkog procenta aplikacije.
   Upis ide kroz `stampPlan` koji aplikacija poziva pri upisu plana; `generatePlan`/`adaptGeneratedPlan` ostaju nepromenjeni
   (reference izlaza). */
import type { GenPlanState, StoredWeek } from '../exchange';
import { weekPhase, type WeekPhase } from './describe';

export const POLICY_ID = '5k-v1';
export const POLICY_VERSION = '5k-v1.0.0';
export const LEGACY_POLICY_ID = 'legacy-5k';

/** Verzije koje ovaj kod ume da obradi. Istorijske implementacije se ne čuvaju: postoji samo trenutna. */
const KNOWN_VERSIONS: readonly string[] = [POLICY_VERSION];

export type PolicyStatus =
  | { status: 'current'; policyId: string; policyVersion: string }
  | { status: 'legacy'; policyId: string; policyVersion: null }
  | { status: 'unknown'; policyId: string; policyVersion: string | null };

/** Čija politika je upisala plan, iz `meta`. */
export function planPolicy(plan: Pick<GenPlanState, 'meta'> | null | undefined): PolicyStatus {
  const meta = (plan?.meta ?? {}) as { policyId?: unknown; policyVersion?: unknown };
  if (meta.policyId == null && meta.policyVersion == null)
    return { status: 'legacy', policyId: LEGACY_POLICY_ID, policyVersion: null };
  const id = typeof meta.policyId === 'string' ? meta.policyId : String(meta.policyId);
  const version = typeof meta.policyVersion === 'string' ? meta.policyVersion : null;
  if (id === POLICY_ID && version != null && KNOWN_VERSIONS.includes(version))
    return { status: 'current', policyId: id, policyVersion: version };
  return { status: 'unknown', policyId: id, policyVersion: version };
}

const PHASES: readonly string[] = ['DELOAD', 'TRKA', 'TAPER', 'BAZA', 'RAZVOJ', 'VRHUNAC', ''];

/** Faza nedelje za prikaz: upisana odluka generatora, a za stari plan bez polja ista funkcija ovog generatora. */
export function phaseOfWeek(
  w:
    | { w: number; deload?: boolean; focus?: string; taper?: boolean; phase?: unknown }
    | null
    | undefined,
  totalWeeks: number
): WeekPhase {
  if (w && typeof w.phase === 'string' && PHASES.includes(w.phase)) return w.phase as WeekPhase;
  return weekPhase(w, totalWeeks);
}

/** Plan za upis: faza svake nedelje i oznaka politike ovog generatora. Ne menja ulaz ni ostala polja. */
export function stampPlan<P extends GenPlanState>(plan: P): P {
  const total = plan.weeks.length;
  const weeks: StoredWeek[] = plan.weeks.map((w) => ({ ...w, phase: weekPhase(w, total) }));
  return {
    ...plan,
    weeks,
    meta: { ...(plan.meta ?? {}), policyId: POLICY_ID, policyVersion: POLICY_VERSION } as P['meta']
  };
}
