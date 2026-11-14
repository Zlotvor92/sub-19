/* V4 · STANJE ZASTAVICE I PLANA V4 U APLIKACIJI (F9 korak 7, INTEGRACIJA.md § 1–2).
   Podrazumevano ISKLJUČENO: dok `enabled` nije `true`, nijedna kukica ne menja ponašanje (`v4DocOf` vraća `null`).
   Kad je uključeno, plan za prikaz dolazi iz V4 ovim redom:
     1. red iz `plan_v4` (plan koji je V4 napravio ili već preuzeo);
     2. inače postojeći plan preuzet adapterom — SAMO ako je otisak pre = otisak posle (odluka vlasnika 5);
   Lični plan vlasnika (`meta.licni`) se ne dira do 13. 12. 2026 (Bokeška): ostaje stari prikaz.
   Ovaj store ništa ne upisuje u `user_state` i ne zove mrežu; puni ga učitavač (`loadV4`) iz servisa. */
import { create } from 'zustand';
import type { Change, PlanDoc, Run } from '../domain/v4/engine';
import { isPersonalPlan } from '../domain/generators/select';
import { adoptActive, type AdoptSnapshot } from '../integrations/v4';
import type { PlanRow } from '../services/v4';

/** Do ovog dana (uključivo) lični plan vlasnika ostaje van V4. */
export const PERSONAL_PROTECTED_UNTIL = '2026-12-13';

export interface V4State {
  enabled: boolean;
  /** Red iz `plan_v4` (ili `null`: korisnik još nema V4 plan). */
  row: PlanRow | null;
  /** Danas po Beogradu (`YYYY-MM-DD`); bez njega se preuzimanje ne radi. */
  today: string | null;
  /** Korak 8: trčanja iz `aktivnost` (forma iz trčanja); prazno dok se ne učitaju. */
  runs: readonly Run[];
  /** Prijavljeni događaji koje je trkač odbio („Ne menjaj") — ne nude se ponovo. */
  rejected: readonly string[];
  /** Promene koje je V4 sam primenio u ovoj sesiji (traka „Plan je promenjen — zašto"). */
  changes: readonly Change[];
  set(
    p: Partial<Pick<V4State, 'enabled' | 'row' | 'today' | 'runs' | 'rejected' | 'changes'>>
  ): void;
}

export const useV4Store = create<V4State>()((set) => ({
  enabled: false,
  row: null,
  today: null,
  runs: [],
  rejected: [],
  changes: [],
  set: (p) => set(p)
}));

/** Lični plan vlasnika je aktivan i još zaštićen (do `PERSONAL_PROTECTED_UNTIL`): V4 ga ne prikazuje i ne pravi mu
 *  nov plan (čarobnjak tada ide starim putem, kao sa ugašenom zastavicom — ništa se tiho ne upisuje u `plan_v4`). */
export function personalProtected(plan: AdoptSnapshot['plan'], today: string | null): boolean {
  return isPersonalPlan(plan) && (today === null || today <= PERSONAL_PROTECTED_UNTIL);
}

export type V4Source = 'plan_v4' | 'preuzet';

/**
 * Plan za prikaz iz V4, ili `null` (tada važi stari prikaz). Čista funkcija stanja; preuzimanje je skupo, pa ga
 * kukica memoizuje.
 */
export function v4DocOf(
  v4: Pick<V4State, 'enabled' | 'row' | 'today'>,
  snap: AdoptSnapshot
): { doc: PlanDoc; source: V4Source } | null {
  if (!v4.enabled) return null;
  const today = v4.today;
  if (personalProtected(snap.plan, today)) return null;
  if (v4.row !== null) return { doc: v4.row.doc, source: 'plan_v4' };
  if (snap.plan === null || today === null) return null;
  const r = adoptActive(snap, today);
  return r.status === 'preuzet' ? { doc: r.doc, source: 'preuzet' } : null;
}
