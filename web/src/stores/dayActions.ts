/* RADNJE NAD DANOM (ekran Danas i list dana): status, unos u dnevnik, tempo radnog dela.

   Sva pravila su u `domain/day`; ovde se samo čita stanje iz store-ova, poziva čista funkcija i upisuje rezultat — jednim
   upisom po radnji, da se nikad ne sačuva polovično stanje (npr. tempo bez zaključavanja). */

import {
  applyLogField,
  clearWorkPace,
  enterWorkPace,
  setDayStatus,
  syncSideRecords,
  type LogField,
  type PaceResult,
  type WorkPaceContext
} from '../domain/day';
import { parseTimeStr } from '../domain/format';
import { PERSONAL, personalBaselineVdot } from '../domain/personal';
import { isT3kId } from '../domain/training/vdot/limits';
import {
  predRowsForDay,
  recomputeVdotChain,
  sessionClassFor,
  type StoredPredRow
} from '../domain/training/adaptation';
import type { ResolvedDay } from '../domain/plan';
import { useRecoveryStore } from './recoveryStore';
import { activeGenPlan, useTrainingStore } from './trainingStore';

type Status = 'done' | 'skip' | 'pending';

export function setStatus(day: ResolvedDay, status: Status, today: string): void {
  const t = useTrainingStore.getState();
  t.patchLog(day.id, setDayStatus(t.log[day.id], status, day.date, today));
}

/** Unos jednog polja forme. Beleška (kuca se) ide odloženim upisom, ostalo odmah. */
export function editField(day: ResolvedDay, field: LogField, raw: string, today: string): void {
  const t = useTrainingStore.getState();
  const entry = applyLogField(t.log[day.id], field, raw, t.log[day.id]?.status ?? 'pending');
  const r = useRecoveryStore.getState();
  const side = syncSideRecords(r.knee, r.kg, day, entry, today);
  /* Bol i težina menjaju samo oporavak; upis radi poslednja radnja da bi ceo `PersistedState` bio sklopljen iz svih. */
  useRecoveryStore.getState().setPain(side.knee, 'soon');
  useRecoveryStore.getState().setWeight(side.kg, 'soon');
  const log = { ...t.log, [day.id]: entry };
  /* UPISAN REZULTAT POLAZNOG DANA ugrađenog plana (Niš polumaraton) menja POLAZNI VDOT, pa se ceo lanac forme preračunava naspram nove polazne tačke — u istom upisu. */
  if (day.id === PERSONAL.startingDay && (field === 'km' || field === 'sec')) {
    const base = personalBaselineVdot(log);
    const preds = storedRows();
    t.patch({
      log,
      vdotLog: recomputeVdotChain(t.vdotLog, base, (id) =>
        sessionClassFor(isT3kId(id), preds.find((p) => p.id === id)?.l)
      )
    });
    return;
  }
  t.patch({ log }, field === 'note' ? 'soon' : 'now');
}

export { predRowsForDay };

/** Redovi sa ID-jem (stari generisani planovi bez ID-ja se ne spajaju — nemaju na šta). */
export function storedRows(): StoredPredRow[] {
  const gp = activeGenPlan();
  return (gp?.pred ?? []).filter((r): r is StoredPredRow => typeof r.id === 'string');
}

export function workPaceContext(day: Pick<ResolvedDay, 'id'>): WorkPaceContext {
  const t = useTrainingStore.getState();
  const v0 = (activeGenPlan()?.meta as { vdot0?: unknown } | undefined)?.vdot0;
  return {
    rows: storedRows(),
    baselineVdot: typeof v0 === 'number' && Number.isFinite(v0) ? v0 : null,
    hasAlt: !!t.alts[day.id]
  };
}

/** Ručni unos tempa radnog dela. Prazno polje briše tempo; nečitljiv unos se ignoriše (dok se kuca). */
export function enterPace(
  day: ResolvedDay,
  predId: string,
  raw: string
): PaceResult | 'cleared' | 'ignored' {
  const t = useTrainingStore.getState();
  const state = { pred: t.pred, predLock: t.predLock, vdotLog: t.vdotLog, log: t.log };
  const ctx = workPaceContext(day);
  if (raw.trim() === '') {
    const r = clearWorkPace(day, predId, state, ctx);
    t.patch({ ...r, vdotLog: [...r.vdotLog] });
    return 'cleared';
  }
  const pace = parseTimeStr(raw);
  if (!pace) return 'ignored';
  const entry = t.log[day.id];
  const date = entry?.runDate || entry?.ts || day.date;
  const r = enterWorkPace(day, predId, pace, date, state, ctx);
  t.patch({ pred: r.pred, predLock: r.predLock, vdotLog: [...r.vdotLog], log: r.log });
  return r;
}

/** „Obriši unos": dnevnik dana i zapisi o bolu/težini uneti uz njega. Tempo i lanac forme ostaju (kao u starom kodu). */
export function deleteEntry(dayId: string): void {
  const t = useTrainingStore.getState();
  const rest = { ...t.log };
  delete rest[dayId];
  const r = useRecoveryStore.getState();
  r.setPain(
    r.knee.filter((k) => k.src !== dayId),
    'soon'
  );
  r.setWeight(
    r.kg.filter((k) => k.src !== dayId),
    'soon'
  );
  t.patch({ log: rest });
}
