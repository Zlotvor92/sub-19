/* Predikcijski redovi („PRED"): jedan red po kvalitetnoj sesiji, sa vremenom na
   ciljnoj distanci koje plan očekuje te nedelje. Iz njih se izvode i spec radnih
   deonica za Strava lap-detekciju (`qs`). */

import { RAMP_CAP_WEEKS } from '../constants/heuristics';
import { KIND_FROM_GOAL, ZONE_FOR_KIND } from '../vdot/zoneForKind';
import { riegelDist, raceTimeForVdot } from '../vdot/racePrediction';
import { vdotFromPace } from '../vdot/vdotFromPace';
import { sessQKm } from '../sessions/calc';
import type { PlanMeta, PredictionRow, Session } from '../types';

/**
 * Red predikcije. `refVdot` je forma koju PLAN očekuje te nedelje; kad je ima,
 * `p5k` se računa iz nje, NE iz propisanog tempa. Propis nije merenje: intervalni
 * tempo se pred kraj namerno klampuje na tempo trke, a aktivacija pred trku je
 * 6×200 m — pročitani unazad daju izopačenu referentnu krivu.
 */
export function predRow(
  w: number,
  kind: string,
  q: number,
  pt: number,
  raceDistM: number,
  refVdot?: number | null
): PredictionRow {
  const zone = ZONE_FOR_KIND[kind];
  const p5k =
    refVdot != null && Number.isFinite(refVdot)
      ? Math.round(raceTimeForVdot(refVdot, raceDistM))
      : zone != null
        ? Math.round(raceTimeForVdot(vdotFromPace(pt, zone), raceDistM))
        : Math.round(riegelDist(pt * q, q * 1000, raceDistM));
  const row: PredictionRow = { w, l: `N${w} · ${kind}`, q, pt, p5k };
  if (KIND_FROM_GOAL.has(kind)) row.nemeri = true;
  return row;
}

/** Radne deonice (m) po danu za lap-detekciju; fartlek/progresivno nemaju (vremenski/kontinuirani). */
export function qsFor(session: Session): number[] | null {
  switch (session.type) {
    case 'int':
      return [session.repM];
    case 'pyramid':
      return session.reps.slice();
    case 'tempo':
      return [Math.round(session.qKm * 1000)];
    case 'fartlek':
    case 'prog':
      return null;
  }
}

/** Planska putanja forme (VDOT) za jednu nedelju, izvedena iz `meta`; `null` ako plan nema putanju. */
export function planVdotForWeek(
  meta: Pick<PlanMeta, 'vdot0' | 'vdotGoal' | 'weeks' | 'trainingVdot'> | null | undefined,
  w: number
): number | null {
  if (!meta) return null;
  if (meta.trainingVdot != null) return meta.trainingVdot;
  const v0 = +meta.vdot0;
  const vg = +meta.vdotGoal;
  const total = +meta.weeks;
  if (!Number.isFinite(v0) || !Number.isFinite(vg) || !Number.isFinite(total)) return null;
  const ramp = Math.min(total - 2, RAMP_CAP_WEEKS);
  if (!(ramp > 0)) return v0;
  return v0 + ((vg - v0) * Math.min(w, ramp)) / ramp;
}

/** Nedelje sa danima koji nose sesiju — i generatorski `Week` i perzistirani `StoredWeek`. */
export type WeeksWithSessions = ReadonlyArray<{
  w: number;
  days: ReadonlyArray<{ dow: number; id?: string; session?: Session }>;
}>;

export function deriveQS(weeks: WeeksWithSessions, idPrefix = 'n'): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  weeks.forEach((wk) =>
    wk.days.forEach((d) => {
      if (!d.session) return;
      const spec = qsFor(d.session);
      if (spec) out[`${idPrefix}${wk.w}d${d.dow}`] = spec;
    })
  );
  return out;
}

/**
 * Isto što `deriveQS`, ali ključ je ID dana (`g5d4`). Stari kod je posle promene cilja pozivao
 * `deriveQS` nad perzistiranim nedeljama (dow 0–6, bez prefiksa „g"): ključevi su ispadali `n5d3`
 * umesto `g5d4`, pa je 26 od 30 sesija gubilo spec radnih deonica i lap-detekcija sa Strave je tiho
 * prestajala da radi za ceo ostatak plana (docs/ENGINE_CHANGES.md, A3).
 */
export function deriveQSById(weeks: WeeksWithSessions): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  weeks.forEach((wk) =>
    wk.days.forEach((d) => {
      if (!d.session || !d.id) return;
      const spec = qsFor(d.session);
      if (spec) out[d.id] = spec;
    })
  );
  return out;
}

export function derivePred(
  weeks: WeeksWithSessions,
  raceDistM: number,
  meta: Pick<PlanMeta, 'vdot0' | 'vdotGoal' | 'weeks' | 'trainingVdot'> | null | undefined
): PredictionRow[] {
  const pred: PredictionRow[] = [];
  weeks.forEach((wk) =>
    wk.days.forEach((d) => {
      if (!d.session) return;
      pred.push(
        predRow(
          wk.w,
          d.session.kind,
          sessQKm(d.session),
          d.session.paceSec,
          raceDistM,
          planVdotForWeek(meta, wk.w)
        )
      );
    })
  );
  return pred;
}
