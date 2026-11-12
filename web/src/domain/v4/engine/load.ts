/* V4 — OPTEREĆENJE (SPEC § 5): jedna mera (minuti × težina), kilometri izvedeni, baza i umor kao dve sredine. */
import {
  ACUTE_DAYS,
  CHRONIC_DAYS,
  DAY_KM_STEP,
  JOG_WEIGHT,
  RPE_STAND,
  RPE_WALK,
  RPE_WEIGHTS,
  RP_WEIGHT_STEP,
  WALK_PACE_SEC_PER_KM,
  WALK_WEIGHT,
  ZONE_SHARE,
  ZONE_WEIGHT
} from './constants';
import type {
  LoadPoints,
  Meters,
  Paces,
  PlanHeader,
  Run,
  SecPerKm,
  Seconds,
  SingleStep,
  Step,
  Vdot,
  Workout,
  ZoneId
} from './types';
import { paceAtShare, racePace, weightAtPace } from './vdot';

/** Sve što treba da se korak pretvori u vreme, dužinu i opterećenje: tempa i forma po kojoj su računata. */
export interface PaceCtx {
  paces: Paces;
  vdot: Vdot;
}

export function paceCtxOf(header: PlanHeader): PaceCtx {
  return { paces: header.paces, vdot: header.form.paceVdot };
}

/** Tempo zone za račun (E = 66 %). */
export function zonePace(zone: ZoneId, paces: Paces): SecPerKm {
  return zone === 'E' ? paces.easy : paces[zone];
}

/** Težina zone (§ 5.1). RP nema stalnu: iz odnosa tempa trke i (nezaokruženog) praga forme, na 0,05. */
export function zoneWeight(zone: ZoneId, ctx: PaceCtx): number {
  if (zone !== 'RP') return ZONE_WEIGHT[zone];
  const threshold = paceAtShare(ctx.vdot, ZONE_SHARE.T);
  return Math.round(weightAtPace(ctx.paces.RP, threshold) / RP_WEIGHT_STEP) * RP_WEIGHT_STEP;
}

function rpeWeight(rpe: number): number {
  for (const [maxRpe, weight] of RPE_WEIGHTS) if (rpe <= maxRpe) return weight;
  return RPE_WEIGHTS[RPE_WEIGHTS.length - 1]?.[1] ?? 1;
}

interface Pacing {
  /** s/km; `Infinity` = stajanje (bez dužine). */
  pace: SecPerKm;
  weight: number;
}

function pacingOf(step: SingleStep, ctx: PaceCtx): Pacing {
  const { target } = step;
  switch (target.type) {
    case 'zone':
      if (step.role === 'recovery' && target.zone === 'E') {
        return { pace: ctx.paces.easySlow, weight: JOG_WEIGHT };
      }
      return { pace: zonePace(target.zone, ctx.paces), weight: zoneWeight(target.zone, ctx) };
    case 'effort':
      if (step.role === 'recovery' && target.rpe <= RPE_STAND) {
        return { pace: Number.POSITIVE_INFINITY, weight: WALK_WEIGHT };
      }
      if (step.role === 'recovery' && target.rpe <= RPE_WALK) {
        return { pace: WALK_PACE_SEC_PER_KM, weight: WALK_WEIGHT };
      }
      return { pace: ctx.paces.easy, weight: rpeWeight(target.rpe) };
    case 'pace':
      return { pace: target.secPerKm, weight: weightAtPace(target.secPerKm, ctx.paces.T) };
    case 'allOut': {
      const pace =
        'distanceM' in step.extent ? racePace(ctx.vdot, step.extent.distanceM) : ctx.paces.T;
      return { pace, weight: weightAtPace(pace, ctx.paces.T) };
    }
  }
}

export interface Cost {
  durationSec: Seconds;
  distanceM: Meters;
  load: LoadPoints;
  /** Sekunde koraka uloge `work` i punog napora (brz rad). */
  workSec: Seconds;
}

const ZERO: Cost = { durationSec: 0, distanceM: 0, load: 0, workSec: 0 };

function add(a: Cost, b: Cost, times = 1): Cost {
  return {
    durationSec: a.durationSec + b.durationSec * times,
    distanceM: a.distanceM + b.distanceM * times,
    load: a.load + b.load * times,
    workSec: a.workSec + b.workSec * times
  };
}

/** Vreme, dužina i opterećenje jednog koraka (§ 5.1, § 5.5). */
export function singleStepCost(step: SingleStep, ctx: PaceCtx): Cost {
  const { pace, weight } = pacingOf(step, ctx);
  const standing = !Number.isFinite(pace);
  let durationSec: number;
  let distanceM: number;
  if ('distanceM' in step.extent) {
    distanceM = standing ? 0 : step.extent.distanceM;
    durationSec = standing ? 0 : (step.extent.distanceM * pace) / 1000;
  } else {
    durationSec = step.extent.durationSec;
    distanceM = standing || pace <= 0 ? 0 : (step.extent.durationSec / pace) * 1000;
  }
  const fast = step.role === 'work' || step.target.type === 'allOut';
  return {
    durationSec,
    distanceM,
    load: (durationSec / 60) * weight,
    workSec: fast ? durationSec : 0
  };
}

export function stepsCost(steps: readonly Step[], ctx: PaceCtx): Cost {
  let total = ZERO;
  for (const step of steps) {
    if ('repeat' in step) total = add(total, stepsCost(step.steps, ctx), step.repeat);
    else total = add(total, singleStepCost(step, ctx));
  }
  return total;
}

export interface WorkoutSummary extends Cost {
  /** Kilometri dana, zaokruženi na 0,1 (§ 5.5). */
  km: number;
}

const round = (value: number, step: number): number => Math.round(value / step) * step;

/** Izvedene veličine treninga: trajanje, dužina, opterećenje, brz rad (§ 1.4). `null` (odmor) daje nule. */
export function summarize(workout: Workout | null, ctx: PaceCtx): WorkoutSummary {
  const cost = workout === null ? ZERO : stepsCost(workout.steps, ctx);
  return { ...cost, km: Math.round(round(cost.distanceM / 1000, DAY_KM_STEP) * 10) / 10 };
}

/** Opterećenje odrađenog trčanja (§ 5.1): po krugovima, inače po km, inače prosečan tempo. */
export function runLoad(run: Run, thresholdPace: SecPerKm): LoadPoints {
  const minutes = run.durationSec / 60;
  if (run.laps !== undefined && run.laps.length > 0) {
    let load = 0;
    for (const lap of run.laps) {
      if (lap.durationSec <= 0) continue;
      const weight =
        lap.distanceM > 0
          ? weightAtPace((lap.durationSec / lap.distanceM) * 1000, thresholdPace)
          : WALK_WEIGHT;
      load += (lap.durationSec / 60) * weight;
    }
    return load;
  }
  if (run.splits !== undefined && run.splits.length > 0) {
    let weighted = 0;
    let seconds = 0;
    for (const split of run.splits) {
      weighted += split.paceSec * weightAtPace(split.paceSec, thresholdPace);
      seconds += split.paceSec;
    }
    return seconds > 0 ? minutes * (weighted / seconds) : minutes;
  }
  if (run.distanceM <= 0) return minutes;
  return minutes * weightAtPace((run.durationSec / run.distanceM) * 1000, thresholdPace);
}

/** Jedan dan dve sredine (§ 5.3). */
export function rollDay(
  prev: { chronic: number; acute: number },
  dayLoad: LoadPoints
): { chronic: number; acute: number } {
  return {
    chronic: prev.chronic + (dayLoad - prev.chronic) / CHRONIC_DAYS,
    acute: prev.acute + (dayLoad - prev.acute) / ACUTE_DAYS
  };
}
