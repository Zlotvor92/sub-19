/* UPIS OSTVARENOG TEMPA RADNOG DELA (kvalitetna sesija) → predikcija + lanac forme.

   Tri ulaza, ista pravila (`classifyMeasurement` generatora AKTIVNOG plana, `ctx.form`):
   - RUČNI unos: tempo se UVEK upisuje u `pred` i zaključava (`predLock`) — to je korisnikova izričita tvrdnja — a u lanac forme ulazi
     samo ako je verodostojan (zasićenje tablice, moguć VDOT; sesija koja ne meri formu ostaje van lanca);
   - AUTOMATSKI (Strava/icu): odbijen tempo se NE upisuje nigde (polovično stanje — tempo bez VDOT-a — je gore od praznog), dan se
     obeleži (`autoOdbijen`) da kartica može da kaže zašto je prazno i da pozove na ručni unos; „ne meri formu" se upisuje i prikazuje
     kao ručni, samo ne ulazi u lanac;
   - BRISANJE: uklonjena sesija ne sme da ostane u lancu.

   Klasifikacija (tolerancija automatskog merenja), uglađivanje lanca (α) i trenutna forma su politika generatora plana
   (A1): ovde se ne odlučuje ništa, samo se upisuju sirova merenja (`measured`, datum, ID izvora) i poziva `ctx.form`.
   Plan bez generatora (nepodržana distanca ili nepoznata verzija politike) nema politiku forme: merenje se ne prihvata
   (`no-generator`), a sačuvani lanac ostaje kakav jeste.

   Čiste funkcije: primaju delove stanja, vraćaju nove. */

import type { ResolvedDay } from '../plan/types';
import type { LogEntry, VdotRecord } from '../state/types';
import type { StoredPredRow } from '../training/adaptation';
import type { FormPolicy, MeasureOutcome as GeneratorOutcome } from '../generators/select';
import { isT3kId } from '../training/vdot/limits';
import { sessKind } from '../plan/describe';

export interface WorkPaceState {
  pred: Readonly<Record<string, unknown>>;
  predLock: Readonly<Record<string, unknown>>;
  vdotLog: readonly VdotRecord[];
  log: Readonly<Record<string, LogEntry>>;
}

export type MeasureOutcome = GeneratorOutcome | { status: 'rejected'; reason: 'no-generator' };

export interface WorkPaceContext {
  /** Politika prijema merenja generatora aktivnog plana; `null` kad plan nema generator. */
  form: FormPolicy | null;
  rows: readonly StoredPredRow[];
  /** Polazna forma plana (`meta.vdot0`). */
  baselineVdot: number | null;
  /** Efektivno ima li dan ručnu izmenu (tip prikaza). */
  hasAlt: boolean;
}

/** Lanac forme iznova iz izmerenih vrednosti (`recomputeVdotChain` generatora plana); bez generatora lanac ostaje. */
export const recomputeChain = (list: readonly VdotRecord[], ctx: WorkPaceContext): VdotRecord[] => {
  const form = ctx.form;
  if (!form) return [...list];
  return form.recomputeVdotChain(list, ctx.baselineVdot, (id) => {
    const row = ctx.rows.find((r) => r.id === id);
    return form.sessionClassFor(isT3kId(id), row?.l, row?.zone);
  });
};

function upsert(
  list: readonly VdotRecord[],
  id: string,
  ts: string,
  measured: number
): VdotRecord[] {
  const entry: VdotRecord = { id, ts, vdot: null, prev: null, delta: null, measured };
  const ix = list.findIndex((e) => e.id === id);
  return ix >= 0 ? list.map((e, i) => (i === ix ? entry : e)) : [...list, entry];
}

export interface PaceResult extends WorkPaceState {
  outcome: MeasureOutcome;
}

function measure(
  day: ResolvedDay,
  predId: string,
  pace: number,
  auto: boolean,
  state: WorkPaceState,
  ctx: WorkPaceContext
): MeasureOutcome {
  const form = ctx.form;
  if (!form) return { status: 'rejected', reason: 'no-generator' };
  const row = ctx.rows.find((r) => r.id === predId);
  const chain = recomputeChain(state.vdotLog, ctx);
  return form.classifyMeasurement({
    row,
    zone: day.session?.zone,
    paceSec: pace,
    kind: sessKind(day, ctx.hasAlt),
    auto,
    retagged: !!day.origin.tag && day.origin.tag !== day.tag,
    currentVdot: form.currentVdot(chain),
    baselineVdot: ctx.baselineVdot
  });
}

/** Ručni unos tempa radnog dela. `date` je datum trčanja (za redosled u lancu). */
export function enterWorkPace(
  day: ResolvedDay,
  predId: string,
  paceSec: number,
  date: string,
  state: WorkPaceState,
  ctx: WorkPaceContext
): PaceResult {
  const pred = { ...state.pred, [predId]: paceSec };
  const predLock = { ...state.predLock, [predId]: true };
  const outcome = measure(day, predId, paceSec, false, state, ctx);
  const vdotLog =
    outcome.status === 'accepted'
      ? recomputeChain(upsert(state.vdotLog, predId, date, outcome.measured), ctx)
      : recomputeChain(
          state.vdotLog.filter((e) => e.id !== predId),
          ctx
        );
  return { pred, predLock, vdotLog, log: state.log, outcome };
}

/** Brisanje tempa: iz predikcije, zaključavanja i lanca; lanac se preračunava. */
export function clearWorkPace(
  day: Pick<ResolvedDay, 'id'>,
  predId: string,
  state: WorkPaceState,
  ctx: WorkPaceContext
): WorkPaceState {
  const pred = { ...state.pred };
  delete pred[predId];
  const predLock = { ...state.predLock };
  delete predLock[predId];
  const vdotLog = recomputeChain(
    state.vdotLog.filter((e) => e.id !== predId),
    ctx
  );
  let log = state.log;
  const entry = state.log[day.id];
  if (entry && 'autoOdbijen' in entry) {
    const { autoOdbijen: _drop, ...rest } = entry as LogEntry & { autoOdbijen?: unknown };
    log = { ...state.log, [day.id]: rest };
  }
  return { pred, predLock, vdotLog, log };
}

/**
 * AUTOMATSKI izmeren tempo (Strava/icu). Vraća `accepted` kad je tempo upisan (merenje ili „ne meri formu"), `rejected` kad nije
 * (dan dobija `autoOdbijen`).
 */
export function recordAutoPace(
  day: ResolvedDay,
  predId: string,
  paceSec: number,
  date: string,
  state: WorkPaceState,
  ctx: WorkPaceContext
): PaceResult & { written: boolean } {
  const outcome = measure(day, predId, paceSec, true, state, ctx);
  // A retained manual work pace is authoritative. An automatic import must not replace
  // either its displayed pace or its evidence, even when the imported result is invalid.
  if (state.predLock[predId]) return { ...state, outcome, written: false };
  if (outcome.status === 'rejected') {
    const l = state.log[day.id];
    const log = l ? { ...state.log, [day.id]: { ...l, autoOdbijen: paceSec } } : state.log;
    const pred = { ...state.pred };
    if (!state.predLock[predId]) delete pred[predId];
    return {
      ...state,
      pred,
      vdotLog: recomputeChain(
        state.vdotLog.filter((e) => e.id !== predId),
        ctx
      ),
      log,
      outcome,
      written: false
    };
  }
  const vdotLog =
    outcome.status === 'accepted'
      ? recomputeChain(upsert(state.vdotLog, predId, date, outcome.measured), ctx)
      : recomputeChain(
          state.vdotLog.filter((e) => e.id !== predId),
          ctx
        );
  const l = state.log[day.id];
  let log = state.log;
  if (l && 'autoOdbijen' in l) {
    const { autoOdbijen: _drop, ...rest } = l as LogEntry & { autoOdbijen?: unknown };
    log = { ...state.log, [day.id]: rest };
  }
  return {
    pred: { ...state.pred, [predId]: paceSec },
    predLock: state.predLock,
    vdotLog,
    log,
    outcome,
    written: true
  };
}
