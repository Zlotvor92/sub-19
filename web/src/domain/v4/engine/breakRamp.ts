/* R20 (A1) — JEDNO pravilo povratka posle prekida, isto za svaki događaj (bolest, put, bol, neplanirana trka,
   propušteni dugi). Radi nad gotovim kandidatom posle događaja, samo nad budućim promenljivim danima, i samo
   SMANJUJE (nikad ne dodaje rad):
   - dugi posle prekida raste najviše `BREAK_LONG_STEP_SEC` ili `BREAK_LONG_STEP_SHARE` (veće) od najdužeg dugog od
     poslednjeg odrađenog naovamo, dok ne stigne prvobitan plan;
   - prvi brzi trening svake vrste (i blok u dugom) u `BREAK_FIRST_WINDOW_DAYS` od prvog brzog posle prekida ≤
     `BREAK_FIRST_DOSE_SHARE` doze iz plana i ≤ poslednji odrađeni iste vrste;
   - nedelja posle prekida najviše `BREAK_WEEK_STEP_SHARE` × prethodna (i posle rasterećenja), dok ne stigne plan.
   Sužavanje i nedelja trke se ne diraju. */
import { buildCtx, doneDayIds, isMutable } from './build';
import { minEasyOf } from './decide';
import { addDays } from './dates';
import { weekCost } from './guard';
import { paceCtxOf, summarize } from './load';
import { mainZone, minDoseOf, realize, steadyLongDef } from './select';
import type {
  DistanceData,
  IsoDate,
  PlanDay,
  PlanDoc,
  PlanEvent,
  PlanWeek,
  RunnerState,
  Seconds,
  Workout,
  WorkoutDef
} from './types';
import { PAIN_LOW_MAX, PAIN_MID_LONG_DAYS } from './constants';
import { pauseLength, RETURN_TRAVEL_DOSE_FACTOR } from './readiness';
import { refWeekKmBefore } from './state';

export const BREAK_LONG_STEP_SEC = 1200;
export const BREAK_LONG_STEP_SHARE = 0.15;
export const BREAK_FIRST_DOSE_SHARE = 0.7;
export const BREAK_FIRST_WINDOW_DAYS = 14;
export const BREAK_WEEK_STEP_SHARE = 1.25;
export const BREAK_WEEK_EXIT_SHARE = 1.2;
/** R20 (A4): prvi trening iste vrste posle bola ≤ ovaj udeo treninga posle kog je bol prijavljen. */
export const PAIN_TRIGGER_SHARE = 0.8;
/** R20 (A4): u nedeljama zaštite posle bola lagan dan ≤ ovaj udeo dugog. */
export const PAIN_EASY_OF_LONG_SHARE = 0.65;
/** Smanjen prvi brzi trening: razlika do prvobitnog trajanja ide u hlađenje, najviše ovoliko. */
const BREAK_COOLDOWN_MAX_EXTRA_SEC = 600;
/** Pauza do 4 dana nema rampu (R19): propušteno je propušteno. */
const BREAK_PAUSE_NO_RAMP_MAX_DAYS = 4;

/** Najveći dozvoljen sledeći dugi posle prekida, od najdužeg dugog od poslednjeg odrađenog. */
export const breakLongCap = (running: Seconds): Seconds =>
  running + Math.max(BREAK_LONG_STEP_SEC, BREAK_LONG_STEP_SHARE * running);

export interface BreakStart {
  /** Poslednji dan prekida (pauza: poslednji dan; bol, trka, propušten dugi: taj dan). */
  zero: IsoDate;
  /** Propušten dugi: samo rast dugog (kvalitet i obim nisu prekinuti). */
  longOnly: boolean;
  /** Poslednji dugi pre prekida iz istorije (kad ga plan nema kao odrađen dan). */
  lastLongSec: Seconds;
  /** Dan od kog se meri nivo pre prekida (pauza: prvi dan pauze). */
  refFrom: IsoDate;
  /** Udeo doze prvog brzog (R20 A2: posle puta 0,8, inače 0,7). */
  firstShare: number;
  /** R20 (A4): prekid je bol (prijavljen posle treninga na dan `zero`). */
  pain: boolean;
}

/** Prekid važi ovoliko dana posle svog poslednjeg dana (pravilo samo smanjuje, a lanac se gasi kad stigne plan). */
const BREAK_ACTIVE_DAYS = 42;

/** Najnoviji prekid koji još važi: pauza > 4 dana, bol ≥ 4 ili neplaniran pun napor (uzroci u zaglavlju) — ili, bez
    njega, propušten dugi (događaj). */
export function breakStartOf(
  doc: PlanDoc,
  today: IsoDate,
  ev: PlanEvent | null = null,
  before: PlanDoc = doc
): BreakStart | null {
  let best: BreakStart | null = null;
  for (const a of doc.header.adjustments ?? []) {
    const z =
      a.kind === 'pause'
        ? pauseLength(a.from, a.to) > BREAK_PAUSE_NO_RAMP_MAX_DAYS
          ? a.to
          : null
        : a.kind === 'pain' && a.level > PAIN_LOW_MAX
          ? a.date
          : a.kind === 'effort' && a.planned !== true
            ? a.date
            : null;
    if (z === null || z < addDays(today, -BREAK_ACTIVE_DAYS)) continue;
    if (best === null || z > best.zero)
      best = {
        zero: z,
        longOnly: false,
        lastLongSec: 'lastLongSec' in a ? (a.lastLongSec ?? 0) : 0,
        refFrom: a.kind === 'pause' ? a.from : z,
        firstShare:
          a.kind === 'pause' && a.reason === 'put' ? RETURN_TRAVEL_DOSE_FACTOR : BREAK_FIRST_DOSE_SHARE,
        pain: a.kind === 'pain'
      };
  }
  if (best !== null) return best;
  if (ev?.kind === 'missed') {
    const day = before.weeks.flatMap((w) => w.days).find((d) => d.id === ev.dayId);
    if (day?.workout?.kind === 'long')
      return {
        zero: day.date,
        longOnly: true,
        lastLongSec: 0,
        refFrom: day.date,
        firstShare: BREAK_FIRST_DOSE_SHARE,
        pain: false
      };
  }
  return null;
}

const defOf = (w: Workout, data: DistanceData): WorkoutDef | undefined =>
  w.libraryId === undefined ? undefined : data.library.find((d) => d.id === w.libraryId);

/** Ključ vrste brzog rada: kvalitet po podražaju i zoni, blok u dugom posebno; `null` za ostalo. */
function fastKey(w: Workout | null, data: DistanceData): string | null {
  if (w === null) return null;
  const def = defOf(w, data);
  if (def === undefined) return null;
  if (w.kind === 'quality') return `quality:${def.stimulus}@${mainZone(def.main) ?? ''}`;
  if (w.kind === 'long' && w.workSec > 0)
    return `long:${def.stimulus}@${mainZone(def.main) ?? ''}`;
  return null;
}

export function applyBreakRamp(
  after: PlanDoc,
  before: PlanDoc,
  state: RunnerState,
  data: DistanceData,
  start: BreakStart
): PlanDoc {
  const today = state.today;
  const zero = start.zero;
  const pace = paceCtxOf(after.header);
  const ctx = buildCtx(after.header, data);
  const race = after.header.goal.raceDate;
  const done = doneDayIds(state);
  const minEasyFloor = minEasyOf(
    data.safety,
    after.header.decisions.level,
    after.header.decisions.runDays.length
  );
  const dur = (w: Workout | null | undefined): Seconds =>
    w == null ? 0 : summarize(w, pace).durationSec;
  const km = (w: PlanWeek): number => weekCost(w, race, pace).km;
  const oldDay = new Map(before.weeks.flatMap((w) => w.days).map((d) => [d.date, d] as const));
  const mutable = (d: PlanDay): boolean =>
    d.date > zero && isMutable(d, after.header, today, done);
  const weeks = after.weeks.map((w) => ({ ...w, days: [...w.days] }));
  const touched = new Set<number>();
  const put = (wi: number, di: number, workout: Workout): void => {
    const w = weeks[wi] as PlanWeek;
    const d = w.days[di] as PlanDay;
    w.days[di] = { ...d, origin: 'template', workout };
    touched.add(wi);
  };
  const longWorkout = (sec: Seconds, def: WorkoutDef | null, dose: Seconds): Workout | null => {
    const w = realize({ type: 'long', sec, def, dose, slot: null }, ctx);
    if (w === null || def === null || dose <= 0) return w;
    /* unos koji drži svoju dužinu: ravnomeran dugi zadatog trajanja */
    if (dur(w) <= sec + 120) return w;
    return realize({ type: 'long', sec, def: steadyLongDef(ctx, null), dose: 0, slot: null }, ctx);
  };

  /* doza kvaliteta: ostvarena doza (zaokružena na deonice) ne prelazi traženu — korak po 30 s naniže do `floor` */
  const fitQuality = (
    def: WorkoutDef,
    dose: Seconds,
    floor: Seconds,
    phase: PlanWeek['intent']['phase'],
    extraCooldownSec: Seconds
  ): Workout | null => {
    let best: Workout | null = null;
    const dec = ctx.decisions;
    for (let x = dose; x >= floor - 1; x -= 30) {
      const w = realize(
        {
          type: 'quality',
          def,
          dose: x,
          slot: { place: 'quality', stimulus: def.stimulus, index: 1, phase },
          ...(extraCooldownSec > 0
            ? {
                wuCd: {
                  warmupSec: dec.warmupSec,
                  cooldownSec: dec.cooldownSec + extraCooldownSec
                }
              }
            : {})
        },
        ctx
      );
      if (w === null) continue;
      best = w;
      if (w.workSec <= dose + 30) return w;
    }
    return best;
  };

  /* poslednji odrađeni (dan ≤ danas iz plana koji je trkač odradio) */
  const lastDone = new Map<string, Seconds>();
  let lastLong = 0;
  for (const d of after.weeks.flatMap((w) => w.days)) {
    if (d.date > today || d.workout === null || !done.has(d.id)) continue;
    if (d.workout.kind === 'long' && d.date <= zero) lastLong = dur(d.workout);
    const key = fastKey(d.workout, data);
    if (key !== null) lastDone.set(key, d.workout.workSec);
  }

  /* R20 (A4): posle bola prva nedelja sa kvalitetom ima jedan kvalitet (ostali su lagani istog trajanja), a u
     nedeljama zaštite (14 dana) lagan dan ≤ 65 % dugog */
  if (start.pain) {
    let firstWeek = true;
    for (let wi = 0; wi < weeks.length; wi += 1) {
      const w = weeks[wi] as PlanWeek;
      if (w.intent.kind === 'taper' || w.intent.kind === 'race') break;
      if (addDays(w.start, 6) <= zero) continue;
      if (firstWeek) {
        const qs = w.days
          .map((d, di) => ({ d, di }))
          .filter((x) => x.d.date > zero && x.d.workout?.kind === 'quality');
        if (qs.length > 0) {
          firstWeek = false;
          for (const { d, di } of qs.slice(1)) {
            if (!mutable(d)) continue;
            const next = realize({ type: 'easy', sec: Math.round(dur(d.workout) / 60) * 60 }, ctx);
            if (next !== null) put(wi, di, next);
          }
        }
      }
      if (w.start > addDays(zero, PAIN_MID_LONG_DAYS)) continue;
      const ld = w.days.find((d) => d.workout?.kind === 'long');
      if (ld?.workout == null) continue;
      const cap = Math.max(minEasyFloor, PAIN_EASY_OF_LONG_SHARE * dur(ld.workout));
      w.days.forEach((d, di) => {
        if (d.workout?.kind !== 'easy' || !mutable(d) || dur(d.workout) <= cap + 60) return;
        const next = realize({ type: 'easy', sec: Math.floor(cap / 300) * 300 }, ctx);
        if (next !== null) put(wi, di, next);
      });
    }
  }

  /* R20 (A4): trening posle kog je bol prijavljen — prvi iste vrste posle bola je STROGO manji od njega */
  const painDay = start.pain
    ? after.weeks.flatMap((w) => w.days).find((d) => d.date === zero && done.has(d.id))
    : undefined;
  const painKey = painDay === undefined ? null : fastKey(painDay.workout, data);
  const painSec = painDay?.workout?.workSec ?? 0;

  /* 1. prvi brzi trening svake vrste (i blok u dugom) */
  if (!start.longOnly) {
    const seen = new Set<string>();
    let first: IsoDate | null = null;
    for (let wi = 0; wi < weeks.length; wi += 1) {
      const w = weeks[wi] as PlanWeek;
      if (w.intent.kind === 'taper' || w.intent.kind === 'race') break;
      for (let di = 0; di < w.days.length; di += 1) {
        const d = w.days[di] as PlanDay;
        if (d.date <= zero || d.workout === null) continue;
        const key = fastKey(d.workout, data);
        if (key === null) continue;
        if (first === null) first = d.date;
        /* blok u dugom: ≤ poslednji odrađeni blok bez obzira na prozor; 70 % plana samo u prozoru */
        const inWindow = d.date <= addDays(first, BREAK_FIRST_WINDOW_DAYS);
        if (!inWindow && (d.workout.kind !== 'long' || !lastDone.has(key))) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!mutable(d)) continue;
        const def = defOf(d.workout, data);
        if (def === undefined) continue;
        const prev = oldDay.get(d.date)?.workout ?? null;
        const planned =
          prev !== null && fastKey(prev, data) === key ? prev.workSec : d.workout.workSec;
        const want = Math.min(
          d.workout.workSec,
          inWindow ? start.firstShare * planned : Number.POSITIVE_INFINITY,
          lastDone.get(key) ?? Number.POSITIVE_INFINITY,
          key === painKey && painSec > 0 ? PAIN_TRIGGER_SHARE * painSec : Number.POSITIVE_INFINITY
        );
        if (want >= d.workout.workSec - 30) continue;
        const min = minDoseOf(def, ctx);
        if (d.workout.kind === 'long') {
          const sec = dur(d.workout);
          /* ostvaren blok (zaokružen) ne prelazi traženi — korak po 30 s naniže */
          let next: Workout | null = null;
          for (let x = want; x >= min - 1; x -= 30) {
            next = longWorkout(sec, def, x);
            if (next === null || next.workSec <= want + 30) break;
          }
          if (want < min || next === null || next.workSec > want + 30)
            next = longWorkout(sec, steadyLongDef(ctx, null), 0);
          if (next !== null) put(wi, di, next);
          continue;
        }
        /* deonice fiksne dužine se skraćuju (3 × 400 m umesto 3 × 600 m) do najmanje smislene doze; ostali oblici
           staju na najmanjoj dozi unosa */
        const dose =
          def.main.kind === 'reps' && want >= data.safety.minDoseSec ? want : Math.max(want, min);
        if (dose >= d.workout.workSec - 30) continue;
        const floor = def.main.kind === 'reps' ? data.safety.minDoseSec : min;
        const cut = fitQuality(def, dose, Math.min(dose, Math.max(floor, dose - 600)), w.intent.phase, 0);
        if (cut === null || cut.workSec >= d.workout.workSec - 30) continue;
        /* manje rada, isto vreme treninga: razlika ide u lagano hlađenje (nedelja ne gubi obim) */
        const wasSec = dur(d.workout);
        const extra = Math.max(0, Math.min(BREAK_COOLDOWN_MAX_EXTRA_SEC, wasSec - dur(cut)));
        const next =
          extra < 60
            ? cut
            : (fitQuality(def, cut.workSec, cut.workSec - 60, w.intent.phase, Math.round(extra / 60) * 60) ?? cut);
        put(wi, di, next.workSec <= cut.workSec + 30 ? next : cut);
      }
    }
  }

  /* 2. dugi i 3. nedelja: dugi raste od poslednjeg odrađenog (najviše `BREAK_ACTIVE_DAYS` posle prekida); nedelja dok
     ne stigne nivo pre prekida (najveća od poslednje 4 nedelje pre njega) */
  /* prvi dugi posle prekida se meri od poslednjeg odrađenog; dalje od najdužeg posle prekida */
  const refKm = refWeekKmBefore(state, start.refFrom);
  const horizon = addDays(zero, BREAK_ACTIVE_DAYS);
  let running = 0;
  let firstLong = true;
  const longOn = true;
  let weekOn = !start.longOnly;
  const dec = after.header.decisions;
  const minEasy = minEasyOf(data.safety, dec.level, dec.runDays.length);
  for (let wi = 0; wi < weeks.length && (longOn || weekOn); wi += 1) {
    const w = weeks[wi] as PlanWeek;
    if (w.intent.kind === 'taper' || w.intent.kind === 'race' || w.start > horizon) break;
    if (addDays(w.start, 6) <= zero) continue;
    const runningBefore = running;
    const li = w.days.findIndex((d) => d.workout?.kind === 'long' && d.date > zero);
    const ld = li < 0 ? undefined : w.days[li];
    if (longOn && ld?.workout != null) {
      const sec = dur(ld.workout);
      const base = firstLong ? lastLong || start.lastLongSec : running;
      firstLong = false;
      if (!mutable(ld) || base === 0) {
        running = Math.max(running, sec);
      } else {
        const cap = breakLongCap(base);
        if (sec > cap + 60) {
          const def = defOf(ld.workout, data) ?? null;
          /* ostvaren dugi (zaokružen na 0,5 km) ne prelazi granicu */
          let next: Workout | null = null;
          for (let s = Math.floor(cap / 60) * 60 + 60; s >= cap - 900; s -= 60) {
            next = longWorkout(s, def, Math.min(ld.workout.workSec, s / 2));
            if (next === null || dur(next) <= cap + 60) break;
          }
          if (next !== null) put(wi, li, next);
          running = Math.max(running, dur(next ?? ld.workout));
        } else {
          /* dugi raste od najdužeg posle prekida do kraja prozora (rasterećenje ga ne spušta) */
          running = Math.max(running, sec);
        }
      }
    }
    if (!weekOn) continue;
    const prevW = weeks[wi - 1];
    /* nedelja plana posle rasterećenja (cela nedelja posle prekida): najviše + 25 % od njega; ostale nedelje drži
       pravilo izlaska (`smoothExit`) */
    /* R20 (A4): posle bola i svaka sledeća nedelja (ravnomeran povratak, bez skoka 22 → 32 km) */
    /* povratak obima je gotov kod prve nedelje gradnje na nivou pre prekida koja staje u granicu (rasterećenje i
       provera ga ne završavaju) */
    const doneAt = (cur: PlanWeek): boolean =>
      cur.intent.kind !== 'recovery' &&
      !cur.days.some((d) => d.workout?.kind === 'test') &&
      refKm > 0 &&
      km(cur) >= refKm - 0.5;
    if (
      prevW === undefined ||
      prevW.start <= start.zero ||
      (prevW.intent.kind !== 'recovery' && !start.pain)
    ) {
      if (doneAt(w) && w.start > zero) weekOn = false;
      continue;
    }
    /* i pravilo izlaska R2 (≤ 1,2 × najveće od tri prethodne posle prekida) — skraćen dugi ne sme da ga probije */
    const prev3 = weeks.slice(Math.max(0, wi - 3), wi).filter((x) => x.start > start.zero);
    const cap = Math.min(
      BREAK_WEEK_STEP_SHARE * km(prevW),
      BREAK_WEEK_EXIT_SHARE * Math.max(...prev3.map(km))
    );
    const now = weeks[wi] as PlanWeek;
    if (km(now) <= cap + 0.5) {
      if (doneAt(now)) weekOn = false;
      continue;
    }
    /* lagani dani srazmerno (ne ispod najmanjeg laganog dana) */
    const easy = now.days
      .map((d, di) => ({ d, di }))
      .filter((x) => x.d.workout?.kind === 'easy' && mutable(x.d));
    const easyKm = easy.reduce((s, x) => s + summarize(x.d.workout as Workout, pace).km, 0);
    const over = km(now) - cap;
    if (easyKm <= 0) continue;
    const f = Math.max(0, 1 - over / easyKm);
    for (const { d, di } of easy) {
      const sec = Math.max(minEasy, Math.round((dur(d.workout) * f) / 60) * 60);
      if (sec >= dur(d.workout) - 30) continue;
      const next = realize({ type: 'easy', sec }, ctx);
      if (next !== null) put(wi, di, next);
    }
    /* R20 (A4): posle bola, kad su lagani dani na najmanjem, ostatak skida dugi — ne ispod najdužeg pre njega */
    const left = km(weeks[wi] as PlanWeek) - cap;
    const cur = li < 0 ? undefined : (weeks[wi] as PlanWeek).days[li];
    if (start.pain && left > 0.5 && cur?.workout != null && mutable(cur)) {
      const sec = dur(cur.workout);
      const target = Math.max(runningBefore, sec - left * pace.paces.easy);
      if (target < sec - 60) {
        const def = defOf(cur.workout, data) ?? null;
        const s2 = Math.floor(target / 60) * 60;
        const w2 = longWorkout(s2, def, Math.min(cur.workout.workSec, s2 / 2));
        if (w2 !== null) {
          put(wi, li, w2);
          running = Math.max(runningBefore, dur(w2));
        }
      }
    }
  }
  /* cilj izmenjene nedelje je ono što je planirano (odluka povratka), da čuvar ne prijavi manjak */
  const out = weeks.map((w, wi): PlanWeek => {
    if (!touched.has(wi)) return w;
    const c = weekCost(w, race, pace);
    return {
      ...w,
      targetLoad: Math.min(w.targetLoad, Math.round(c.load)),
      ...(w.volumeMin === undefined
        ? {}
        : { volumeMin: Math.min(w.volumeMin, Math.round(c.durationSec / 60)) })
    };
  });
  return { ...after, weeks: out };
}
