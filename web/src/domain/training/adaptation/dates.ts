/* USKLAĐIVANJE DATUMA LANCA FORME sa pravim datumima trčanja.

   Zapisi lanca nastali pre uvođenja `runDate` nose datum SINHRONIZACIJE umesto datuma trčanja, a sinhronizacija ih ne prepravlja
   (preskače već povučene treninge radi štednje kvote). Ovo ih ispravlja direktno: ID sesije → dan u planu → `runDate`.
   Idempotentno. Promena datuma menja redosled, pa se ceo lanac preračunava. */

import type { ResolvedPlan } from '../../plan/types';
import type { LogEntry, VdotRecord } from '../../state/types';
import { recomputeVdotChain, sessionClassFor } from './chain';
import { matchWeekRows, type StoredPredRow } from './matching';
import { isT3kId } from '../vdot/limits';

export function alignVdotDates(
  vdotLog: readonly VdotRecord[],
  plan: ResolvedPlan,
  rows: readonly StoredPredRow[],
  log: Readonly<Record<string, LogEntry>>,
  baselineVdot: number | null
): { vdotLog: VdotRecord[]; changed: boolean } {
  if (!vdotLog.length) return { vdotLog: [...vdotLog], changed: false };
  const predToDay = new Map<string, string>();
  for (const w of plan.weeks) {
    const matched = matchWeekRows(w, rows);
    for (const d of w.days)
      for (const pid of matched[d.id] ?? []) if (!predToDay.has(pid)) predToDay.set(pid, d.id);
  }
  let changed = false;
  const next = vdotLog.map((e) => {
    const dayId = predToDay.get(String(e.id));
    if (!dayId) return e;
    const real = log[dayId]?.runDate ?? null;
    if (real && e.ts !== real) {
      changed = true;
      return { ...e, ts: real };
    }
    return e;
  });
  if (!changed) return { vdotLog: [...vdotLog], changed: false };
  return {
    changed: true,
    vdotLog: recomputeVdotChain(next, baselineVdot, (id) =>
      sessionClassFor(isT3kId(id), rows.find((r) => r.id === id)?.l)
    )
  };
}
