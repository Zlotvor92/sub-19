/* RADNJE NAD OPORAVKOM: bol, masa, prilagođavanje plana povredi. Pravila su u `domain/recovery`; ovde se čita stanje,
   poziva čista funkcija i upisuje rezultat jednim upisom po radnji. */

import { applyInjuryProposal, type InjuryProposal } from '../domain/recovery';
import {
  addWeight,
  deleteWeight,
  deleteWeightsBefore,
  detachWeightFromLog,
  type WeightResult
} from '../domain/recovery';
import type { PainRecord } from '../domain/state';
import type { ResolvedPlan } from '../domain/plan';
import { useRecoveryStore } from './recoveryStore';
import { useTrainingStore } from './trainingStore';

const byDate = (a: { date: string }, b: { date: string }): number => (a.date < b.date ? -1 : 1);

export interface NewPain {
  date: string;
  pain: number;
  act: string;
  note: string;
  part?: string;
}

/** Ručni unos bola (nema `src`); `id` daje pozivalac (čist je i testabilan). */
export function addPain(id: string, rec: NewPain): void {
  const r = useRecoveryStore.getState();
  const entry: PainRecord = { ...rec, id, src: null };
  r.setPain([...r.knee, entry].sort(byDate));
}

export interface PainPatch {
  date?: string;
  act?: string;
  pain?: number;
  note?: string;
  /** `null` = opšte (bez dela tela): ključ se uklanja. */
  part?: string | null;
}

export function updatePain(id: string, patch: PainPatch, mode: 'now' | 'soon' = 'now'): void {
  const r = useRecoveryStore.getState();
  const next = r.knee.map((k) => {
    if (k.id !== id) return k;
    const { part, ...rest } = patch;
    const merged: PainRecord = { ...k, ...rest };
    if (part === null) delete merged.part;
    else if (part !== undefined) merged.part = part;
    return merged;
  });
  if (patch.date) next.sort(byDate);
  r.setPain(next, mode);
}

export function removePain(id: string): void {
  const r = useRecoveryStore.getState();
  r.setPain(r.knee.filter((k) => k.id !== id));
}

export function addWeightEntry(date: string, input: string, today: string): WeightResult {
  const r = useRecoveryStore.getState();
  const res = addWeight(r.kg, date, input, today);
  if (res.ok) r.setWeight(res.kg);
  return res;
}

/** Brisanje merenja po mestu u nizu; merenje vezano za trening skida masu i sa treninga. */
export function removeWeightAt(index: number): boolean {
  const r = useRecoveryStore.getState();
  const rem = deleteWeight(r.kg, index);
  if (!rem) return false;
  const t = useTrainingStore.getState();
  if (rem.detach.length) t.patch({ log: detachWeightFromLog(t.log, rem.detach) });
  r.setWeight(rem.kg);
  return true;
}

export function removeWeightsBefore(date: string): number {
  const r = useRecoveryStore.getState();
  const rem = deleteWeightsBefore(r.kg, date);
  const n = r.kg.length - rem.kg.length;
  if (!n) return 0;
  const t = useTrainingStore.getState();
  if (rem.detach.length) t.patch({ log: detachWeightFromLog(t.log, rem.detach) });
  r.setWeight(rem.kg);
  return n;
}

/** „Prilagodi plan": izmene predloga idu u `alts`; vraća broj primenjenih. */
export function applyProposal(plan: ResolvedPlan, proposal: InjuryProposal): number {
  const t = useTrainingStore.getState();
  const { applied, alts } = applyInjuryProposal(proposal, plan, t.log, t.alts);
  if (applied) t.setAlts(alts);
  return applied;
}
