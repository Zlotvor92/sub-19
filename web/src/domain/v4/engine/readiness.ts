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
  PAUSE_RAMP_FACTORS,
  BLOCK_GATE_MAX_DAYS,
  BLOCK_GATE_PAUSE_DAYS,
  BLOCK_GATE_SHARE,
  RAMP_LONG_SHARE,
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
import type { Adjustment, IsoDate, Pause, Seconds } from './types';

/** Rampa povratka: `zero` je dan napora ili poslednji dan pauze; traje `days`; `noFast` dana bez ičeg brzog. */
export interface Ramp {
  zero: IsoDate;
  days: number;
  noFast: number;
  /** Poslednji odrađeni dugi pre uzroka (0 = nepoznat): plafon dugog u rampi. */
  lastLongSec: Seconds;
  /** Pauza ≥ 7 dana: blok u dugom tek posle dugog bez bloka (§ 14.6). */
  gate: boolean;
  /** Prvi kvalitet svakog podražaja posle rampe × 0,8 — samo za spoljne uzroke, ne za napor iz plana. */
  firstReduced: boolean;
}

export function effortRampDays(durationSec: Seconds): number {
  return Math.max(1, Math.ceil(durationSec / 60 / EFFORT_MIN_PER_RAMP_DAY));
}

export function pauseRampDays(pauseDays: number, reason: Pause['reason'] = 'nepoznato'): number {
  return Math.ceil(PAUSE_RAMP_FACTORS[reason] * Math.min(pauseDays, PAUSE_RAMP_MAX_DAYS));
}

export const pauseLength = (from: IsoDate, to: IsoDate): number => diffDays(to, from) + 1;

/** Rampa koju uzrok povlači; bol nivoa ≥ 7 se posle odmora računa kao pauza od 7 dana. */
export function rampOf(adj: Adjustment): Ramp | null {
  switch (adj.kind) {
    case 'effort':
      /* Pun napor iz plana: samo 3 dana bez ičeg brzog (§ 14.1), bez rampe. */
      return {
        zero: adj.date,
        days: adj.planned === true ? 0 : effortRampDays(adj.durationSec),
        noFast: NO_FAST_DAYS_AFTER_EFFORT,
        lastLongSec: adj.planned === true ? 0 : (adj.lastLongSec ?? 0),
        gate: false,
        firstReduced: adj.planned !== true
      };
    case 'pause': {
      const length = pauseLength(adj.from, adj.to);
      if (length < PAUSE_MIN_DAYS) return null;
      return {
        zero: adj.to,
        days: pauseRampDays(length, adj.reason),
        noFast: 0,
        lastLongSec: adj.lastLongSec ?? 0,
        gate: length >= BLOCK_GATE_PAUSE_DAYS,
        firstReduced: true
      };
    }
    case 'pain':
      if (adj.level <= PAIN_MID_MAX) return null;
      return {
        zero: addDays(adj.date, PAIN_HIGH_REST_DAYS),
        days: pauseRampDays(PAIN_HIGH_REST_DAYS, 'povreda'),
        noFast: 0,
        lastLongSec: adj.lastLongSec ?? 0,
        gate: PAIN_HIGH_REST_DAYS >= BLOCK_GATE_PAUSE_DAYS,
        firstReduced: true
      };
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
    const to = ramp.firstReduced ? addDays(rampEnd, POST_RAMP_FIRST_DAYS) : rampEnd;
    return { from, to, rampEnd };
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

/** Da li nedelja (od ponedeljka `weekStart`) seče pauzu ili rampu nekog uzroka. */
export function underRamp(weekStart: IsoDate, adjustments: readonly Adjustment[]): boolean {
  const end = addDays(weekStart, 6);
  return adjustments.some((adj) => {
    if (rampOf(adj) === null || (adj.kind === 'effort' && adj.planned === true)) return false;
    const w = adjustmentWindow(adj);
    return w !== null && w.from <= end && w.rampEnd >= weekStart;
  });
}

/** Da li ijedan uzrok spremnosti (rampa, bol, umor) pada u nedelju od ponedeljka `weekStart`. */
export function anyCauseIn(weekStart: IsoDate, adjustments: readonly Adjustment[]): boolean {
  const end = addDays(weekStart, 6);
  return adjustments.some((adj) => {
    const w = adjustmentWindow(adj);
    return w !== null && w.from <= end && w.rampEnd >= weekStart;
  });
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
  /** Najduži dozvoljeni dugi dok rampa traje. */
  longCapSec: Seconds;
  /** Blok ili progresija u dugom dozvoljeni (pauza ≥ 7 dana: tek posle dugog bez bloka). */
  block: boolean;
  /** Posle pauze ≥ 7 dana lestvica bloka kreće ispočetka: redni broj bloka od povratka; `null` = bez izmene. */
  blockStep: number | null;
}

/** Trening koji je prolaz već video: ključ podražaja, ili `long-plain` (dugi bez bloka) sa trajanjem. */
export interface Seen {
  date: IsoDate;
  key: string;
  sec?: Seconds;
}

export const PLAIN_LONG = 'long-plain';

export const NO_MODS: Mods = {
  rest: false,
  f: 1,
  quality: true,
  addon: true,
  highImpact: true,
  doseFactor: 1,
  longCapSec: Number.POSITIVE_INFINITY,
  block: true,
  blockStep: null
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
        if (ramp.lastLongSec > 0) {
          m.longCapSec = Math.min(m.longCapSec, RAMP_LONG_SHARE * ramp.lastLongSec);
        }
      }
      if (ramp.gate && n >= 1 && n <= BLOCK_GATE_MAX_DAYS) {
        const since = seen.filter((x) => x.date > ramp.zero && x.date < date);
        const requalified = since.some(
          (x) => x.key === PLAIN_LONG && (x.sec ?? 0) >= BLOCK_GATE_SHARE * ramp.lastLongSec
        );
        if (!requalified) m.block = false;
        const blocks = since.filter((x) => x.key.startsWith('long:')).length;
        m.blockStep = m.blockStep === null ? blocks : Math.min(m.blockStep, blocks);
      }
      if (n >= 1 && n <= ramp.noFast) noFast();
      const end = Math.max(ramp.days, ramp.noFast);
      if (ramp.firstReduced && n > end && n <= end + POST_RAMP_FIRST_DAYS && key !== null) {
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

/** Doza bloka u dugom: posle pauze ≥ 7 dana od najnižeg koraka lestvice pa redom (§ 14.6), inače × faktor rampe. */
function blockDose(dose: Seconds, stimulus: string, mods: Mods, ctx: BuildCtx): Seconds {
  const ladder = ctx.data.safety.progression[stimulus];
  const cap = ctx.decisions.doseCapSec[stimulus];
  if (mods.blockStep === null || ladder === undefined || cap === undefined)
    return dose * mods.doseFactor;
  return Math.min(dose, Math.min(1, ladder.startPct + ladder.stepPct * mods.blockStep) * cap);
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
      const sec = Math.min(scaled(recipe.sec, mods.f), mods.longCapSec);
      if (recipe.def === null || recipe.dose <= 0) return { ...recipe, sec };
      const dose = blockDose(recipe.dose, recipe.def.stimulus, mods, ctx);
      const blocked =
        !mods.quality || !mods.block || (!mods.highImpact && recipe.def.impact === 'visok');
      if (blocked || dose < minDoseOf(recipe.def, ctx)) {
        return { type: 'long', sec, def: steadyLongDef(ctx, null), dose: 0, slot: recipe.slot };
      }
      return { ...recipe, sec, dose };
    }
    case 'quality': {
      if (!mods.quality) return asEasy(recipe, mods, ctx);
      /* Smanjenje (× 0,8) ne obara trening ispod njegovog najmanjeg oblika: tada ostaje najmanja doza. */
      const dose = Math.max(
        recipe.dose * mods.doseFactor,
        Math.min(recipe.dose, minDoseOf(recipe.def, ctx))
      );
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
