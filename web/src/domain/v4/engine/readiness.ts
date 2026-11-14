/* V4 — SPREMNOST IZ STANJA (SPEC § 6.5, § 14.1): jedina politika povratka, ista za svaku distancu.
   Uzroci (`Adjustment`) → modifikator dana → izmenjen recept. Isti modifikator koriste `plan` i `replan`. */
import {
  EFFORT_MIN_PER_RAMP_DAY,
  FATIGUE_DAYS,
  FATIGUE_FACTOR,
  NO_FAST_DAYS_AFTER_EFFORT,
  NO_TEST_AFTER_RACE_DAYS,
  PAIN_HIGH_REST_DAYS,
  PAIN_LOW_DAYS,
  PAIN_LOW_MAX,
  PAIN_LOW_REST_DAYS,
  PAIN_MID_DAYS,
  PAIN_MID_DOSE_FACTOR,
  PAIN_FIRST_ZONE_MAX_DAYS,
  PAIN_MID_FACTOR,
  PAIN_MID_LONG_DAYS,
  PAIN_MID_MAX,
  PAIN_MID_REST_DAYS,
  PAIN_MID_SHORT_DAYS,
  PAUSE_MIN_DAYS,
  PAUSE_RAMP_FACTORS,
  PAUSE_RAMP_START,
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
import { addDays, diffDays, mondayOf } from './dates';
import { summarize } from './load';
import {
  type BuildCtx,
  mainZone,
  minDoseOf,
  pickDef,
  realize,
  type Recipe,
  steadyLongDef
} from './select';
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
  /** Faktor prvog dana rampe (krug 14, M2: posle pauze `PAUSE_RAMP_START`, inače `RAMP_START`). */
  start?: number;
  /** R19 (stavka 1): kratka pauza (5–21 dan) — povratak po NEDELJAMA (udeo referentne nedelje), ne po danima. */
  schedule?: ReturnSchedule;
}

/** R19 (stavka 1, odluka organizatora): povratak posle pauze od 5 do 21 dan po nedeljama. Nedelja `k` (od
    `week1`, ponedeljak) ima cilj `shares[k−1]` × referentna nedelja (najveća od poslednje 4 pre pauze), nikad iznad
    plana; posle rasporeda važi plan. Prva nedelja bez brzog rada i dugi ≤ ¾ referentnog dugog; dalje dugi ≤ referentni,
    a prvi trening svakog podražaja smanjene doze. */
export interface ReturnSchedule {
  week1: IsoDate;
  shares: readonly number[];
  refKm: number;
  refLongSec: Seconds;
  /** Prva nedelja bez kvaliteta (pauza; posle trke kad raspored ima bar dve nedelje). */
  noFirstQuality: boolean;
  /** Plafon dugog prve nedelje kao udeo referentnog (¾; posle puta 0,9 — R20 A2). */
  firstLongShare: number;
}

/** R19: udeli referentne nedelje po dužini pauze (dani bez trčanja); `null` = stara rampa (pauza > 21 dan). */
/** R20 (A2): put / odsustvo bez bolesti je blaži od bolesti, i kraća bolest od duže (srazmerno danima). */
export function returnShares(
  pauseDays: number,
  reason: Pause['reason'] = 'nepoznato'
): readonly number[] | null {
  if (pauseDays <= RETURN_NO_RAMP_MAX_DAYS) return [];
  const travel = reason === 'put';
  if (pauseDays <= RETURN_SHORT_MAX_DAYS) {
    if (travel) return RETURN_TRAVEL_SHARES;
    return pauseDays <= RETURN_SHORTEST_MAX_DAYS ? RETURN_SHORTEST_SHARES : RETURN_SHORT_SHARES;
  }
  if (pauseDays <= RETURN_MID_MAX_DAYS) return travel ? RETURN_SHORT_SHARES : RETURN_MID_SHARES;
  return null;
}
/** R20 (A2): put 5–10 dana — jedna nedelja ≈ 87,5 % sa jednim kvalitetom (doza 0,8), pa plan. */
const RETURN_TRAVEL_SHARES = [0.875] as const;
/** R20 (A2): posle puta prva 2 dana bez brzog. */
const TRAVEL_NO_FAST_DAYS = 2;
const RETURN_TRAVEL_FIRST_LONG_SHARE = 0.9;
/** R20 (A2): bolest 5–6 dana — blaža od 7–10 dana. */
const RETURN_SHORTEST_MAX_DAYS = 6;
const RETURN_SHORTEST_SHARES = [0.8, 0.95] as const;
/** R20 (A2): doza prvog kvaliteta posle puta (prva nedelja ga ima). */
export const RETURN_TRAVEL_DOSE_FACTOR = 0.8;
const RETURN_NO_RAMP_MAX_DAYS = 4;
const RETURN_SHORT_MAX_DAYS = 10;
const RETURN_MID_MAX_DAYS = 21;
const RETURN_SHORT_SHARES = [0.75, 0.9] as const;
const RETURN_MID_SHARES = [0.6, 0.75, 0.9] as const;
/** Prvi dugi posle pauze ≤ ovaj udeo referentnog dugog. */
export const RETURN_SCHEDULE_FIRST_LONG_SHARE = 0.75;
/** R20 (A4): dugi u prvih 7 dana posle bola nivoa 4–6 ≤ ovaj udeo poslednjeg dugog. */
const PAIN_FIRST_WEEK_LONG_SHARE = 0.6;

/** R20 (A1): udeli referentne nedelje posle NEPLANIRANE trke, po trajanju napora (srazmerno dužini trke): do 40 min
    bez rasporeda (samo dani bez brzog), do 75 min jedna nedelja, do 2 h dve, do 3 h tri, duže četiri. */
export function effortShares(durationSec: Seconds): readonly number[] {
  const min = durationSec / 60;
  if (min <= 40) return [];
  if (min <= 75) return [0.85];
  if (min <= 120) return [0.6, 0.8];
  if (min <= 180) return [0.5, 0.65, 0.8];
  return [0.4, 0.55, 0.7, 0.85];
}
/** R20 (A1): posle trke od ovoliko minuta prvi dan je odmor. */
const EFFORT_REST_DAY_FROM_MIN = 75;

/** Prva nedelja povratka: nedelja prvog dana posle `last`, osim kad u njoj ostaju manje od 4 dana (tada sledeća;
    ostatak tekuće nedelje se računa kao prva). */
function firstReturnWeek(last: IsoDate): IsoDate {
  const next = addDays(last, 1);
  const monday = mondayOf(next);
  return diffDays(addDays(monday, 6), next) + 1 >= 4 ? monday : addDays(monday, 7);
}

/** R20 (A1): raspored povratka posle trke važi samo kad se završi pre nedelje pred trkom (inače stara rampa — nedelja
    pred trkom zadržava sužavanje). */
export function effortScheduleFits(date: IsoDate, durationSec: Seconds, raceDate: IsoDate): boolean {
  const shares = effortShares(durationSec);
  const end = addDays(firstReturnWeek(date), 7 * shares.length - 1);
  return shares.length > 0 && end < addDays(mondayOf(raceDate), -7);
}

/** Raspored povratka za pauzu sa poznatom referentnom nedeljom (5–21 dan) i za neplaniranu trku (R20); `null` =
    stara rampa. */
export function returnSchedule(adj: Adjustment): ReturnSchedule | null {
  if (adj.kind === 'effort') {
    if (adj.planned === true || adj.race !== true || adj.refWeekKm === undefined) return null;
    const shares = effortShares(adj.durationSec);
    if (shares.length === 0) return null;
    return {
      week1: firstReturnWeek(adj.date),
      shares,
      refKm: adj.refWeekKm,
      refLongSec: adj.lastLongSec ?? 0,
      noFirstQuality: shares.length >= 2,
      firstLongShare: RETURN_SCHEDULE_FIRST_LONG_SHARE
    };
  }
  if (adj.kind !== 'pause' || adj.refWeekKm === undefined || adj.baseAfter === true) return null;
  const shares = returnShares(pauseLength(adj.from, adj.to), adj.reason);
  if (shares === null) return null;
  return {
    week1: firstReturnWeek(adj.to),
    shares,
    refKm: adj.refWeekKm,
    refLongSec: adj.lastLongSec ?? 0,
    /* R20 (A2): posle puta prva nedelja ima jedan kvalitet, a dugi ostaje blizu uobičajenog */
    noFirstQuality: !(adj.reason === 'put' && shares === RETURN_TRAVEL_SHARES),
    firstLongShare:
      adj.reason === 'put' && shares === RETURN_TRAVEL_SHARES
        ? RETURN_TRAVEL_FIRST_LONG_SHARE
        : RETURN_SCHEDULE_FIRST_LONG_SHARE
  };
}

/** R19: redni broj nedelje povratka (1 = prva; ostatak nedelje pauze pre `week1` je takođe 1). */
export const returnWeekNo = (date: IsoDate, s: ReturnSchedule): number =>
  Math.max(1, Math.floor(diffDays(date, s.week1) / 7) + 1);

/** Krug 10 (stavka 11): dani posle punog napora bez brzog treninga — isto pravilo kao rampa u planu (brz rad tek kad
    faktor rampe dostigne `QUALITY_FROM_F`), najmanje `NO_FAST_DAYS_AFTER_EFFORT`. */
export function effortNoFastDays(durationSec: Seconds): number {
  const days = effortRampDays(durationSec);
  const firstFast = Math.ceil(((QUALITY_FROM_F - RAMP_START) / RAMP_SPAN) * days);
  return Math.max(NO_FAST_DAYS_AFTER_EFFORT, firstFast - 1);
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
    case 'effort': {
      /* R20 (A1): neplanirana trka — povratak po nedeljama (udeo referentne nedelje po dužini trke), kao posle pauze */
      const schedule = returnSchedule(adj);
      if (schedule !== null) {
        const end = addDays(schedule.week1, 7 * schedule.shares.length - 1);
        const firstEnd = addDays(schedule.week1, 6);
        return {
          zero: adj.date,
          days: Math.max(0, diffDays(end, adj.date)),
          /* bez brzog: koliko i ranije posle trke (`effortNoFastDays`), a uz dve+ nedelje rasporeda cela prva */
          noFast: Math.max(
            effortNoFastDays(adj.durationSec),
            schedule.noFirstQuality ? diffDays(firstEnd, adj.date) : 0
          ),
          lastLongSec: adj.lastLongSec ?? 0,
          gate: false,
          firstReduced: false,
          start: 1,
          schedule
        };
      }
      /* Pun napor iz plana: samo 3 dana bez ičeg brzog (§ 14.1), bez rampe. */
      return {
        zero: adj.date,
        days: adj.planned === true ? 0 : effortRampDays(adj.durationSec),
        noFast: NO_FAST_DAYS_AFTER_EFFORT,
        lastLongSec: adj.planned === true ? 0 : (adj.lastLongSec ?? 0),
        gate: false,
        firstReduced: adj.planned !== true
      };
    }
    case 'pause': {
      const length = pauseLength(adj.from, adj.to);
      if (length < PAUSE_MIN_DAYS) return null;
      const schedule = returnSchedule(adj);
      if (schedule !== null) {
        /* R19: rampa traje do kraja rasporeda (kraća rampa blizu trke ostaje); bez dnevnog skraćenja — obim nedelje
           drži gradnja (cilj = udeo referentne), brz rad tek od druge nedelje */
        const end = addDays(schedule.week1, 7 * schedule.shares.length - 1);
        const days = schedule.shares.length === 0 ? 0 : Math.max(0, diffDays(end, adj.to));
        const firstEnd = addDays(schedule.week1, 6);
        return {
          zero: adj.to,
          days: adj.rampDays === undefined ? days : Math.min(days, adj.rampDays),
          noFast:
            schedule.shares.length === 0
              ? 0
              : schedule.noFirstQuality
                ? Math.max(0, diffDays(firstEnd, adj.to))
                : TRAVEL_NO_FAST_DAYS,
          lastLongSec: adj.lastLongSec ?? 0,
          gate: length >= BLOCK_GATE_PAUSE_DAYS,
          firstReduced: false,
          start: 1,
          schedule
        };
      }
      return {
        zero: adj.to,
        days: adj.rampDays ?? pauseRampDays(length, adj.reason),
        noFast: 0,
        lastLongSec: adj.lastLongSec ?? 0,
        gate: length >= BLOCK_GATE_PAUSE_DAYS,
        firstReduced: true,
        start: adj.baseAfter === true ? 1 : PAUSE_RAMP_START
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
  ramp.start === undefined
    ? RAMP_START + (RAMP_SPAN * n) / ramp.days
    : ramp.start + ((1 - ramp.start) * n) / ramp.days;

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
    if (adj.level <= PAIN_LOW_MAX) {
      const end = addDays(adj.date, PAIN_LOW_DAYS);
      return { from: addDays(adj.date, 1), to: end, rampEnd: end };
    }
    /* Nivo 4–6: zaštita traje 14 dana (dugi), a „prvi kvalitet manje doze" još 14 dana posle zabrane kvaliteta. */
    return {
      from: addDays(adj.date, 1),
      to: addDays(adj.date, PAIN_MID_DAYS + POST_RAMP_FIRST_DAYS),
      rampEnd: addDays(adj.date, PAIN_MID_LONG_DAYS)
    };
  }
  if (adj.kind === 'fatigue') {
    const to = addDays(adj.date, FATIGUE_DAYS);
    return { from: addDays(adj.date, 1), to, rampEnd: to };
  }
  return null;
}

/** Da li nedelja (od ponedeljka `weekStart`) seče pauzu, rampu ili zaštitu posle bola nivoa 4 i više. */
export function underRamp(
  weekStart: IsoDate,
  adjustments: readonly Adjustment[],
  /** R18 (stavka 5): `false` — oporavak posle trke se ne računa (nije povratak kao posle pauze). */
  withEffort = true
): boolean {
  const end = addDays(weekStart, 6);
  return adjustments.some((adj) => {
    if (!returns(adj) || (!withEffort && adj.kind === 'effort')) return false;
    const w = adjustmentWindow(adj);
    return w !== null && w.from <= end && w.rampEnd > weekStart;
  });
}

/** Uzrok posle kog se obim vraća postepeno: pauza, spoljni pun napor, bol nivoa 4 i više (ne napor iz plana). */
function returns(adj: Adjustment): boolean {
  if (adj.kind === 'pain') return adj.level > PAIN_LOW_MAX;
  return rampOf(adj) !== null && !(adj.kind === 'effort' && adj.planned === true);
}

/** Da li je dan u pauzi ili rampi povratka posle pauze (ne posle napora): tu se provera forme pomera (R9). */
/** A2 (krug 9b): dan pada u `NO_TEST_AFTER_RACE_DAYS` dana posle neplanirane trke (provera forme se tada ne radi). */
export function afterRace(date: IsoDate, adjustments: readonly Adjustment[]): boolean {
  return adjustments.some(
    (adj) =>
      adj.kind === 'effort' &&
      adj.race === true &&
      date >= adj.date &&
      diffDays(date, adj.date) <= NO_TEST_AFTER_RACE_DAYS
  );
}

export function inReturn(date: IsoDate, adjustments: readonly Adjustment[]): boolean {
  return adjustments.some((adj) => {
    if (adj.kind === 'effort' || !returns(adj)) return false;
    const w = adjustmentWindow(adj);
    return w !== null && date >= w.from && date <= w.rampEnd;
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
  /** R8 t. 4: doza sme ispod najmanjeg oblika unosa (prvi rad zone posle bola, Z3). */
  belowShape?: boolean;
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
      const sch = ramp.schedule;
      if (sch !== undefined) {
        /* R19: povratak po nedeljama — prva nedelja bez brzog rada i dugi ≤ ¾ referentnog; dalje u rasporedu dugi ≤
           referentni i prvi trening svakog podražaja smanjene doze */
        /* R20: dan posle duge trke je odmor */
        if (adj.kind === 'effort' && n === 1 && adj.durationSec >= EFFORT_REST_DAY_FROM_MIN * 60)
          m.rest = true;
        if (n >= 1 && n <= ramp.days) {
          const k = returnWeekNo(date, sch);
          if (sch.refLongSec > 0)
            m.longCapSec = Math.min(
              m.longCapSec,
              k === 1 ? sch.firstLongShare * sch.refLongSec : sch.refLongSec
            );
          if ((k >= 2 || !sch.noFirstQuality) && key !== null) {
            const done = seen.some((s) => s.key === key && s.date > ramp.zero && s.date < date);
            if (!done) m.doseFactor = Math.min(m.doseFactor, RAMP_DOSE_FACTOR);
          }
        }
      } else if (n >= 1 && n <= ramp.days) {
        const f = rampFactor(n, ramp);
        /* krug 14 (M2): viši početak rampe posle pauze menja samo trajanje; brz rad i plafon dugog prate isti deo
           rampe kao ranije (faktor od `RAMP_START`) */
        const g = RAMP_START + (RAMP_SPAN * n) / ramp.days;
        m.f = Math.min(m.f, f);
        if (f < REST_BELOW_F) m.rest = true;
        if (g < QUALITY_FROM_F) noFast();
        m.doseFactor = Math.min(m.doseFactor, RAMP_DOSE_FACTOR);
        if (ramp.lastLongSec > 0 && g < QUALITY_FROM_F) {
          /* krug 14 (M2): obim već posle pauze — plafon je sadašnji dugi, ne 75 % njega */
          const share = ramp.start === 1 ? 1 : RAMP_LONG_SHARE;
          m.longCapSec = Math.min(m.longCapSec, share * ramp.lastLongSec);
        }
      }
      if (ramp.gate && n >= 1 && n <= BLOCK_GATE_MAX_DAYS) {
        const since = seen.filter((x) => x.date > ramp.zero && x.date < date);
        const requalified = since.some(
          (x) => x.key === PLAIN_LONG && (x.sec ?? 0) >= BLOCK_GATE_SHARE * ramp.lastLongSec
        );
        const blocks = since.filter((x) => x.key.startsWith('long:')).length;
        /* R3 (krug 6): u rampi blok otpada; posle rampe se ne briše nego kreće od najmanjeg koraka */
        if (!requalified && n <= Math.max(ramp.days, ramp.noFast)) m.block = false;
        const step = requalified ? blocks : 0;
        m.blockStep = m.blockStep === null ? step : Math.min(m.blockStep, step);
      }
      if (n >= 1 && n <= ramp.noFast) noFast();
      const end = Math.max(ramp.days, ramp.noFast);
      if (ramp.firstReduced && n > end && n <= end + POST_RAMP_FIRST_DAYS && key !== null) {
        const done = seen.some((s) => s.key === key && s.date > ramp.zero && s.date < date);
        if (!done) m.doseFactor = Math.min(m.doseFactor, RAMP_DOSE_FACTOR);
      }
    }
    if (adj.kind === 'pause' && date >= adj.from && date <= adj.to) m.rest = true;
    if (adj.kind === 'pain') {
      const n = diffDays(date, adj.date);
      if (adj.level <= PAIN_LOW_MAX) {
        if (n >= 1 && n <= PAIN_LOW_REST_DAYS) m.rest = true;
        /* Prvo trčanje posle odmora je lagano. */
        if (n === PAIN_LOW_REST_DAYS + 1) noFast();
        if (n >= 1 && n <= PAIN_LOW_DAYS) m.highImpact = false;
      } else if (adj.level <= PAIN_MID_MAX) {
        if (n >= 1 && n <= PAIN_MID_REST_DAYS) m.rest = true;
        if (n >= 1 && n <= PAIN_MID_DAYS) noFast();
        if (n >= 1 && n <= PAIN_MID_SHORT_DAYS) {
          m.f = Math.min(m.f, PAIN_MID_FACTOR);
          /* R20 (A4): dugi u prvoj nedelji posle bola ≤ 60 % poslednjeg (MAR s13/s14: ne 18–19 km treći dan) */
          const last = adj.lastLongSec ?? 0;
          if (last > 0) m.longCapSec = Math.min(m.longCapSec, PAIN_FIRST_WEEK_LONG_SHARE * last);
        }
        if (n >= 1 && n <= PAIN_MID_LONG_DAYS) {
          m.highImpact = false;
          const last = adj.lastLongSec ?? 0;
          if (last > 0) m.longCapSec = Math.min(m.longCapSec, RAMP_LONG_SHARE * last);
        }
        /* Z3 (krug 7): prvi rad svake ZONE posle bola (i blok u dugom) ≤ 60 % planirane doze, do 6 nedelja posle bola */
        if (n > PAIN_MID_DAYS && n <= PAIN_FIRST_ZONE_MAX_DAYS && key !== null) {
          const zone = key.slice(key.indexOf('@'));
          const done = seen.some(
            (s) => (s.key === key || s.key.endsWith(zone)) && s.date > adj.date && s.date < date
          );
          if (!done) {
            m.doseFactor = Math.min(m.doseFactor, PAIN_MID_DOSE_FACTOR);
            m.belowShape = true;
          }
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
  if (recipe.type === 'quality' || recipe.type === 'test')
    return `quality:${recipe.def.stimulus}@${mainZone(recipe.def.main) ?? ''}`;
  if (recipe.type === 'long' && recipe.def !== null && recipe.dose > 0)
    return `long:${recipe.def.stimulus}@${mainZone(recipe.def.main) ?? ''}`;
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
      return { ...recipe, sec: scaled(recipe.sec, mods.f) };
    case 'addon': {
      const allowed = mods.addon && (mods.highImpact || recipe.def.impact !== 'visok');
      const sec = scaled(recipe.sec, mods.f);
      if (allowed) return { ...recipe, sec };
      return {
        type: 'easy',
        sec,
        ...(recipe.maxSec === undefined ? {} : { maxSec: recipe.maxSec })
      };
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
      /* R8 t. 4: smanjenje sme ispod najmanjeg oblika unosa — prvo manji unos istog podražaja, a kad ga nema,
         deonice fiksne dužine se skraćuju (`mainSteps`); ostali oblici ostaju na najmanjoj dozi (kao ranije). */
      const want = recipe.dose * mods.doseFactor;
      let def = recipe.def;
      let dose = want;
      if (want < minDoseOf(def, ctx) && mods.belowShape !== true) {
        dose = Math.max(want, Math.min(recipe.dose, minDoseOf(def, ctx)));
      } else if (want < minDoseOf(def, ctx)) {
        const other = pickDef(recipe.slot, want, ctx, { noHighImpact: !mods.highImpact });
        if (other !== null && other.kind === 'quality' && want >= minDoseOf(other, ctx))
          def = other;
        else if (def.main.kind !== 'reps') dose = Math.min(recipe.dose, minDoseOf(def, ctx));
      }
      if (!mods.highImpact && def.impact === 'visok') {
        const other = pickDef(recipe.slot, dose, ctx, { noHighImpact: true });
        if (other === null || other.kind !== 'quality') return asEasy(recipe, mods, ctx);
        def = other;
      }
      const floor =
        def.main.kind === 'reps' && mods.belowShape === true
          ? ctx.data.safety.minDoseSec
          : minDoseOf(def, ctx);
      /* R20 (A4): prvi rad zone posle bola ispod najmanje smislene doze ostaje kvalitet na toj dozi (ravnomeran
         povratak: kvalitet ima–nema–ima je gore od manjeg kvaliteta) */
      if (dose < floor && mods.belowShape === true && floor <= recipe.dose)
        return { ...recipe, def, dose: floor };
      if (dose < floor) return asEasy(recipe, mods, ctx);
      return { ...recipe, def, dose };
    }
    case 'test':
      return mods.quality ? recipe : asEasy(recipe, mods, ctx);
  }
}
