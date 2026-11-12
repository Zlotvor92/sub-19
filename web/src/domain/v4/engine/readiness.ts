/* V4 — SPREMNOST IZ STANJA (SPEC § 6.5, § 14.1): jedina politika povratka, ista za svaku distancu.
   Uzroci (`Adjustment`) → modifikator dana → izmenjen recept. Isti modifikator koriste `plan` i `replan`. */
import {
  EFFORT_MIN_PER_RAMP_DAY,
  FATIGUE_DAYS,
  FATIGUE_FACTOR,
  NO_FAST_DAYS_AFTER_EFFORT,
  PAIN_HIGH_REST_DAYS,
  PAIN_LOW_DAYS,
  PAIN_LOW_MAX,
  PAIN_MID_DAYS,
  PAIN_MID_FACTOR,
  PAIN_MID_MAX,
  PAUSE_MIN_DAYS,
  PAUSE_RAMP_FACTOR,
  PAUSE_RAMP_MAX_DAYS,
  POST_RAMP_FIRST_DAYS,
  QUALITY_FROM_F,
  RAMP_DOSE_FACTOR,
  RAMP_MIN_DURATION_SEC,
  RAMP_SPAN,
  RAMP_START,
  REST_BELOW_F
} from './constants';
import { addDays, diffDays } from './dates';
import { summarize } from './load';
import { type BuildCtx, minDoseOf, pickDef, realize, type Recipe, steadyLongDef } from './select';
import type { Adjustment, IsoDate, Seconds } from './types';

/** Rampa povratka: `zero` je dan napora ili poslednji dan pauze; traje `days`; `noFast` dana bez ičeg brzog. */
export interface Ramp {
  zero: IsoDate;
  days: number;
  noFast: number;
}

export function effortRampDays(durationSec: Seconds): number {
  return Math.max(1, Math.ceil(durationSec / 60 / EFFORT_MIN_PER_RAMP_DAY));
}

export function pauseRampDays(pauseDays: number): number {
  return Math.ceil(PAUSE_RAMP_FACTOR * Math.min(pauseDays, PAUSE_RAMP_MAX_DAYS));
}

export const pauseLength = (from: IsoDate, to: IsoDate): number => diffDays(to, from) + 1;

/** Rampa koju uzrok povlači; bol nivoa ≥ 7 se posle odmora računa kao pauza od 7 dana. */
export function rampOf(adj: Adjustment): Ramp | null {
  switch (adj.kind) {
    case 'effort':
      return {
        zero: adj.date,
        days: effortRampDays(adj.durationSec),
        noFast: NO_FAST_DAYS_AFTER_EFFORT
      };
    case 'pause': {
      const length = pauseLength(adj.from, adj.to);
      return length >= PAUSE_MIN_DAYS
        ? { zero: adj.to, days: pauseRampDays(length), noFast: 0 }
        : null;
    }
    case 'pain':
      return adj.level > PAIN_MID_MAX
        ? {
            zero: addDays(adj.date, PAIN_HIGH_REST_DAYS),
            days: pauseRampDays(PAIN_HIGH_REST_DAYS),
            noFast: 0
          }
        : null;
    default:
      return null;
  }
}

export const rampFactor = (n: number, ramp: Ramp): number =>
  RAMP_START + (RAMP_SPAN * n) / ramp.days;

/** Poslednji dan na koji uzrok utiče (uklj. „prvi kvalitet posle rampe"); `null` za uzrok bez prozora. */
export function adjustmentWindow(
  adj: Adjustment
): { from: IsoDate; to: IsoDate; rampEnd: IsoDate } | null {
  const ramp = rampOf(adj);
  if (ramp !== null) {
    const rampEnd = addDays(ramp.zero, Math.max(ramp.days, ramp.noFast));
    const from =
      adj.kind === 'pause'
        ? adj.from
        : adj.kind === 'pain'
          ? addDays(adj.date, 1)
          : addDays(ramp.zero, 1);
    return { from, to: addDays(rampEnd, POST_RAMP_FIRST_DAYS), rampEnd };
  }
  if (adj.kind === 'pain') {
    const days = adj.level <= PAIN_LOW_MAX ? PAIN_LOW_DAYS : PAIN_MID_DAYS;
    return {
      from: addDays(adj.date, 1),
      to: addDays(adj.date, days),
      rampEnd: addDays(adj.date, days)
    };
  }
  if (adj.kind === 'fatigue') {
    const to = addDays(adj.date, FATIGUE_DAYS);
    return { from: addDays(adj.date, 1), to, rampEnd: to };
  }
  return null;
}

/** Modifikator jednog dana: najmanji faktor svih uzroka; kvalitet samo ako ga svi dozvoljavaju. */
export interface Mods {
  rest: boolean;
  /** Faktor trajanja (1 = bez izmene). */
  f: number;
  quality: boolean;
  addon: boolean;
  highImpact: boolean;
  /** Faktor doze kvaliteta i bloka (kvalitet u rampi i prvi posle nje). */
  doseFactor: number;
}

export interface Seen {
  date: IsoDate;
  key: string;
}

export const NO_MODS: Mods = {
  rest: false,
  f: 1,
  quality: true,
  addon: true,
  highImpact: true,
  doseFactor: 1
};

export function modsFor(
  date: IsoDate,
  adjustments: readonly Adjustment[],
  seen: readonly Seen[],
  key: string | null
): Mods {
  const m: Mods = { ...NO_MODS };
  const noFast = (): void => {
    m.quality = false;
    m.addon = false;
  };
  for (const adj of adjustments) {
    const ramp = rampOf(adj);
    if (ramp !== null) {
      const n = diffDays(date, ramp.zero);
      if (n >= 1 && n <= ramp.days) {
        const f = rampFactor(n, ramp);
        m.f = Math.min(m.f, f);
        if (f < REST_BELOW_F) m.rest = true;
        if (f < QUALITY_FROM_F) noFast();
        m.doseFactor = RAMP_DOSE_FACTOR;
      }
      if (n >= 1 && n <= ramp.noFast) noFast();
      const end = Math.max(ramp.days, ramp.noFast);
      if (n > end && n <= end + POST_RAMP_FIRST_DAYS && key !== null) {
        const done = seen.some((s) => s.key === key && s.date > ramp.zero && s.date < date);
        if (!done) m.doseFactor = RAMP_DOSE_FACTOR;
      }
    }
    if (adj.kind === 'pause' && date >= adj.from && date <= adj.to) m.rest = true;
    if (adj.kind === 'pain') {
      const n = diffDays(date, adj.date);
      if (adj.level <= PAIN_LOW_MAX) {
        if (n >= 1 && n <= PAIN_LOW_DAYS) m.highImpact = false;
      } else if (adj.level <= PAIN_MID_MAX) {
        if (n >= 1 && n <= PAIN_MID_DAYS) {
          noFast();
          m.f = Math.min(m.f, PAIN_MID_FACTOR);
        }
      } else if (n >= 1 && n <= PAIN_HIGH_REST_DAYS) {
        m.rest = true;
      }
    }
    if (adj.kind === 'fatigue') {
      const n = diffDays(date, adj.date);
      if (n >= 1 && n <= FATIGUE_DAYS) {
        noFast();
        m.f = Math.min(m.f, FATIGUE_FACTOR);
      }
    }
  }
  return m;
}

/** Trajanje u rampi: × f, ali ne ispod 20 min (ni iznad izvornog). */
function scaled(sec: Seconds, f: number): Seconds {
  return f >= 1 ? sec : Math.min(sec, Math.max(RAMP_MIN_DURATION_SEC, sec * f));
}

function totalSec(recipe: Recipe, ctx: BuildCtx): Seconds {
  return summarize(realize(recipe, ctx), ctx.pace).durationSec;
}

/** Kvalitet ili test koji stanje ne dozvoljava postaje lagan dan trajanja `ukupno × f`. */
function asEasy(recipe: Recipe, mods: Mods, ctx: BuildCtx): Recipe {
  return { type: 'easy', sec: scaled(totalSec(recipe, ctx), mods.f) };
}

/** Ključ podražaja za pravilo „prvi kvalitet posle rampe"; `null` za dan bez brzog rada. */
export function recipeKey(recipe: Recipe): string | null {
  if (recipe.type === 'quality' || recipe.type === 'test') return `quality:${recipe.def.stimulus}`;
  if (recipe.type === 'long' && recipe.def !== null && recipe.dose > 0)
    return `long:${recipe.def.stimulus}`;
  return null;
}

/** Primena stanja na recept dana (§ 6.5). Ne zna za događaje: prima samo modifikator. */
export function applyReadiness(recipe: Recipe, mods: Mods, ctx: BuildCtx): Recipe {
  if (recipe.type === 'rest') return recipe;
  if (mods.rest) return { type: 'rest' };
  switch (recipe.type) {
    case 'easy':
      return { type: 'easy', sec: scaled(recipe.sec, mods.f) };
    case 'addon': {
      const allowed = mods.addon && (mods.highImpact || recipe.def.impact !== 'visok');
      const sec = scaled(recipe.sec, mods.f);
      return allowed ? { ...recipe, sec } : { type: 'easy', sec };
    }
    case 'long': {
      const sec = scaled(recipe.sec, mods.f);
      if (recipe.def === null || recipe.dose <= 0) return { ...recipe, sec };
      const dose = recipe.dose * mods.doseFactor;
      const blocked = !mods.quality || (!mods.highImpact && recipe.def.impact === 'visok');
      if (blocked || dose < minDoseOf(recipe.def, ctx)) {
        return { type: 'long', sec, def: steadyLongDef(ctx, null), dose: 0, slot: recipe.slot };
      }
      return { ...recipe, sec, dose };
    }
    case 'quality': {
      if (!mods.quality) return asEasy(recipe, mods, ctx);
      const dose = recipe.dose * mods.doseFactor;
      let def = recipe.def;
      if (!mods.highImpact && def.impact === 'visok') {
        const other = pickDef(recipe.slot, dose, ctx, { noHighImpact: true });
        if (other === null || other.kind !== 'quality') return asEasy(recipe, mods, ctx);
        def = other;
      }
      if (dose < minDoseOf(def, ctx)) return asEasy(recipe, mods, ctx);
      return { ...recipe, def, dose };
    }
    case 'test':
      return mods.quality ? recipe : asEasy(recipe, mods, ctx);
  }
}
