/* DRUGO PUŠTANJE, KORAK 1 · VRSTA SAČUVANOG PLANA (BRISANJE-PLAN § 2b, § 2d). JEDINO mesto koje odlučuje da li plan
   naloga prelazi u V4 (`v2`, `licni`) ili se uklanja (`stari`, `v2-prosla-trka`, `nepoznat`). Čista funkcija: ne čita
   store, ne zove mrežu; „danas" je beogradski datum koji šalje pozivalac.

   Pravilo (isto kao SQL nacrt u § 2d):
   1. vlasnikov nalog → `licni` (lični plan ima prednost nad `genPlan` istog naloga; vlasnik se nikad ne briše);
   2. `genPlan` nema → `nema` (ništa se ne dira);
   3. `meta.licni` → `licni` (nikad se ne briše);
   4. v2 (`isV2`: `-v2.` u `policyId`/`policyVersion` ili ključ izlaza v2) i `meta.raceDate >= danas` → `v2`
      (trka danas = nije prošla); v2 sa prošlom ili nepoznatom trkom → `v2-prosla-trka`. Plan koji je i v2 i stari
      format (v2 ključ bez `policyId`) ide ovde;
   5. ostalo: stari format (`isLegacyPlan`) → `stari`, inače `nepoznat`. */
import { isPersonal, isV2 } from '../domain/v4/adapters';
import { isLegacyPlan } from '../domain/generators/select';
import type { GenPlanState } from '../domain/state';

export type StoredPlanKind = 'licni' | 'v2' | 'v2-prosla-trka' | 'stari' | 'nepoznat' | 'nema';

/** Vrste koje se trajno preuzimaju u `plan_v4`. */
export const ADOPTED_KINDS: readonly StoredPlanKind[] = ['v2', 'licni'];
/** Vrste koje čuvar uklanja pri otvaranju (`discardLegacyPlan`). */
export const DISCARDED_KINDS: readonly StoredPlanKind[] = ['stari', 'v2-prosla-trka', 'nepoznat'];

const isRec = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const ISO = /^\d{4}-\d{2}-\d{2}/;

export function kindOfStoredPlan(
  s: { genPlan: unknown; isOwner: boolean },
  today: string
): StoredPlanKind {
  if (s.isOwner) return 'licni';
  const plan = s.genPlan;
  if (plan === null || plan === undefined) return 'nema';
  if (!isRec(plan)) return 'nepoznat';
  const meta = isRec(plan['meta']) ? plan['meta'] : {};
  const read = { raw: plan, meta, weeks: [] };
  if (isPersonal(read)) return 'licni';
  if (isV2(read)) {
    const race = meta['raceDate'];
    if (typeof race !== 'string' || !ISO.test(race)) return 'v2-prosla-trka';
    return race.slice(0, 10) >= today ? 'v2' : 'v2-prosla-trka';
  }
  return isLegacyPlan(plan as unknown as GenPlanState) ? 'stari' : 'nepoznat';
}
