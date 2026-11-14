/* R20 (A1) — JEDNO pravilo povratka posle prekida, isto za svaki prekid (bolest, put, bol, neplanirana trka; R22 A2:
   propušten trening nije prekid). Radi nad gotovim kandidatom posle događaja, samo nad budućim promenljivim danima, i
   samo SMANJUJE (nikad ne dodaje rad):
   - dugi posle prekida raste najviše `BREAK_LONG_STEP_SEC` ili `BREAK_LONG_STEP_SHARE` (veće) od najdužeg dugog od
     poslednjeg odrađenog naovamo, dok ne stigne prvobitan plan;
   - prvi brzi trening svake vrste (i blok u dugom) u `BREAK_FIRST_WINDOW_DAYS` od prvog brzog posle prekida ≤
     `BREAK_FIRST_DOSE_SHARE` doze iz plana i ≤ poslednji odrađeni iste vrste;
   - nedelja posle prekida najviše `BREAK_WEEK_STEP_SHARE` × prethodna (i posle rasterećenja), dok ne stigne plan.
   Sužavanje i nedelja trke se ne diraju. */
import { buildCtx, doneDayIds, isMutable } from './build';
import { easyShareOfLong, minEasyOf } from './decide';
import { addDays, mondayOf } from './dates';
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
import { PAIN_LOW_MAX, PAIN_MID_LONG_DAYS, PREP_RACE_WORK_MIN_SEC } from './constants';
import { meaningfulDose, pauseLength, RETURN_TRAVEL_DOSE_FACTOR } from './readiness';
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

/** Najnoviji prekid koji još važi: pauza > 4 dana, bol ≥ 4 ili neplaniran pun napor (uzroci u zaglavlju). R22 (A2):
    propušten trening nije prekid. */
export function breakStartOf(
  doc: PlanDoc,
  today: IsoDate,
  ev: PlanEvent | null = null,
  before: PlanDoc = doc
): BreakStart | null {
  void before;
  /* R22 (A2): propušten trening (i dugi, i više njih) nije prekid — pravilo povratka se ne primenjuje ponovo ni
     dok traje prozor ranijeg prekida (njegove izmene su već u planu) */
  if (ev?.kind === 'missed') return null;
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
        lastLongSec: 'lastLongSec' in a ? (a.lastLongSec ?? 0) : 0,
        refFrom: a.kind === 'pause' ? a.from : z,
        firstShare:
          a.kind === 'pause' && a.reason === 'put'
            ? RETURN_TRAVEL_DOSE_FACTOR
            : BREAK_FIRST_DOSE_SHARE,
        pain: a.kind === 'pain'
      };
  }
  return best;
}

const defOf = (w: Workout, data: DistanceData): WorkoutDef | undefined =>
  w.libraryId === undefined ? undefined : data.library.find((d) => d.id === w.libraryId);

/** Ključ vrste brzog rada: kvalitet po podražaju i zoni, blok u dugom posebno; `null` za ostalo. */
function fastKey(w: Workout | null, data: DistanceData): string | null {
  if (w === null) return null;
  const def = defOf(w, data);
  if (def === undefined) return null;
  if (w.kind === 'quality') return `quality:${def.stimulus}@${mainZone(def.main) ?? ''}`;
  if (w.kind === 'long' && w.workSec > 0) return `long:${def.stimulus}@${mainZone(def.main) ?? ''}`;
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
  const mutable = (d: PlanDay): boolean => d.date > zero && isMutable(d, after.header, today, done);
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
  /* R22 (A3): unos poslednjeg odrađenog (kraće deonice kad cele deonice plana ne staju ispod njega) */
  const lastDoneDef = new Map<string, WorkoutDef>();
  let lastLong = 0;
  for (const d of after.weeks.flatMap((w) => w.days)) {
    if (d.date > today || d.workout === null || !done.has(d.id)) continue;
    if (d.workout.kind === 'long' && d.date <= zero) lastLong = dur(d.workout);
    const key = fastKey(d.workout, data);
    if (key !== null) lastDone.set(key, d.workout.workSec);
    const def = defOf(d.workout, data);
    if (key !== null && def !== undefined) lastDoneDef.set(key, def);
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
  {
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
        /* R22 (A3): prag i tempo trke ne ispod najmanje smislene doze (ne „2 × 600 m") */
        const meaningful = Math.min(
          meaningfulDose(def, ctx, 0, d.workout.workSec),
          lastDone.get(key) ?? Number.POSITIVE_INFINITY
        );
        const dose = Math.max(
          meaningful,
          def.main.kind === 'reps' && want >= data.safety.minDoseSec ? want : Math.max(want, min)
        );
        if (dose >= d.workout.workSec - 30) continue;
        const floor = Math.max(meaningful, def.main.kind === 'reps' ? data.safety.minDoseSec : min);
        const fit0 = fitQuality(
          def,
          dose,
          Math.min(dose, Math.max(floor, dose - 600)),
          w.intent.phase,
          0
        );
        /* ceo broj deonica ne sme da pređe poslednji odrađeni — tada najbliži ispod njega */
        const ceiling = lastDone.get(key) ?? Number.POSITIVE_INFINITY;
        const over = fit0 !== null && fit0.workSec > ceiling + 30;
        const doneDef = lastDoneDef.get(key);
        const byDone =
          over && doneDef !== undefined && doneDef.id !== def.id
            ? fitQuality(
                doneDef,
                ceiling,
                Math.max(minDoseOf(doneDef, ctx), ceiling - 600),
                w.intent.phase,
                0
              )
            : null;
        const cut = !over
          ? fit0
          : byDone !== null && byDone.workSec >= meaningful - 45 && byDone.workSec <= ceiling + 30
            ? byDone
            : fitQuality(def, ceiling, Math.max(min, ceiling - 600), w.intent.phase, 0);
        if (cut === null || cut.workSec >= d.workout.workSec - 30) continue;
        /* manje rada, isto vreme treninga: razlika ide u lagano hlađenje (nedelja ne gubi obim) */
        const wasSec = dur(d.workout);
        const extra = Math.max(0, Math.min(BREAK_COOLDOWN_MAX_EXTRA_SEC, wasSec - dur(cut)));
        const next =
          extra < 60
            ? cut
            : (fitQuality(
                def,
                cut.workSec,
                cut.workSec - 60,
                w.intent.phase,
                Math.round(extra / 60) * 60
              ) ?? cut);
        put(wi, di, next.workSec <= cut.workSec + 30 ? next : cut);
      }
    }
  }

  /* 2. dugi i 3. nedelja: dugi raste od poslednjeg odrađenog (najviše `BREAK_ACTIVE_DAYS` posle prekida); nedelja dok
     ne stigne nivo pre prekida (najveća od poslednje 4 nedelje pre njega) */
  /* prvi dugi posle prekida se meri od poslednjeg odrađenog; dalje od najdužeg posle prekida */
  const refKm = refWeekKmBefore(state, start.refFrom);
  /* R22 (A1): nedelja oporavka posle trke (dani 1–7) je namerno manja — nije merilo rasta sledeće (merilo je i
     nedelja pre nje) */
  const prepWeeks = new Set(
    postRacesOf(after, state, data).flatMap((r) =>
      [1, 7].map((k) => weeks.findIndex((w) => w.days.some((d) => d.date === addDays(r.date, k))))
    )
  );
  const refOf = (wi: number): number => {
    const w = weeks[wi] as PlanWeek;
    const before = weeks[wi - 1];
    return prepWeeks.has(wi) && before !== undefined ? Math.max(km(w), km(before)) : km(w);
  };
  const horizon = addDays(zero, BREAK_ACTIVE_DAYS);
  let running = 0;
  let firstLong = true;
  const longOn = true;
  let weekOn = true;
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
    /* i pravilo izlaska R2 (≤ 1,2 × najveće od tri prethodne posle prekida) — skraćen dugi ne sme da ga probije;
       R22: posle bola (svaka nedelja u lancu) korak je R2 (+20 %), posle rasterećenja + 25 % */
    const prev3 = weeks.slice(Math.max(0, wi - 3), wi).filter((x) => x.start > start.zero);
    const cap = Math.min(
      (start.pain ? BREAK_WEEK_EXIT_SHARE : BREAK_WEEK_STEP_SHARE) * refOf(wi - 1),
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

/* ------------------------------------------------------------------ R22 (A1): prvih 7 dana posle trke */

/** R22 (A1): dani posle trke (1–3) bez ičeg bržeg od laganog i najviše ovoliko (ili odmor). */
export const POST_RACE_EASY_DAYS = 3;
export const POST_RACE_EASY_MAX_SEC = 1800;
/** R22 (A1): dan posle trke od bar ovoliko je odmor. */
export const POST_RACE_REST_FROM_SEC = 4500;
/** R22 (A1): prvih 7 dana posle neplanirane trke duže od 40 min ≤ ovaj udeo referentne nedelje. */
export const POST_RACE_WEEK_SHARE = 0.6;
/** R22 (A1): posle pripremne trke iz plana (pun napor ≥ 75 min) nedelja ≤ ovaj udeo najveće od tri pre nje. */
export const POST_PREP_RACE_WEEK_SHARE = 0.7;
const POST_RACE_WEEK_FROM_SEC = 2400;

export interface PostRace {
  date: IsoDate;
  durationSec: Seconds;
  /** Gornja granica km prvih 7 dana; `null` = bez granice nedelje (kratka trka). */
  weekKm: number | null;
  /** Pripremna trka iz plana: broj dana trčanja ostaje (bez odmora) — lagani dani su kraći. */
  planned: boolean;
  /** Bez rampe posle trke (pripremna iz plana, kratka trka): dugi se ne skraćuje (lanac dugog se ne lomi). */
  keepLong: boolean;
}

/** Trke posle kojih važi oporavak: trka iz zaglavlja (uzrok `effort` sa `race`) i pripremna trka iz plana (≥ 75 min rada). */
export function postRacesOf(doc: PlanDoc, state: RunnerState, data: DistanceData): PostRace[] {
  const pace = paceCtxOf(doc.header);
  const race = doc.header.goal.raceDate;
  const out = new Map<IsoDate, PostRace>();
  for (const a of doc.header.adjustments ?? []) {
    /* i trka na danu plana (`planned`) — posle trke je trka */
    if (a.kind !== 'effort' || a.race !== true) continue;
    const ref = a.refWeekKm ?? state.profile.weeklyKm ?? 0;
    out.set(a.date, {
      date: a.date,
      durationSec: a.durationSec,
      /* kratka trka van plana (`planned`, E5) se oporavlja kao provera iz plana: samo dani 1–3 */
      weekKm:
        a.planned !== true && a.durationSec > POST_RACE_WEEK_FROM_SEC && ref > 0
          ? POST_RACE_WEEK_SHARE * ref
          : null,
      planned: false,
      keepLong: a.planned === true
    });
  }
  doc.weeks.forEach((w, wi) => {
    for (const d of w.days) {
      if (d.workout?.kind !== 'test' || d.date >= race || out.has(d.date)) continue;
      if (d.workout.workSec < PREP_RACE_WORK_MIN_SEC) continue;
      const prev = doc.weeks.slice(Math.max(0, wi - 3), wi).map((x) => weekCost(x, race, pace).km);
      const ref = Math.max(0, ...prev);
      out.set(d.date, {
        date: d.date,
        durationSec: d.workout.workSec,
        weekKm: ref > 0 ? POST_PREP_RACE_WEEK_SHARE * ref : null,
        planned: true,
        keepLong: true
      });
    }
  });
  void data;
  return [...out.values()].sort((x, y) => (x.date < y.date ? -1 : 1));
}

/** R22 (A1): JEDNO mesto oporavka posle trke — dan 1 odmor (trka ≥ 75 min), dani 1–3 lagano ≤ 30 min (ili odmor),
    prvih 7 dana ≤ udeo referentne nedelje: prvo odmor u danima 1–3, pa srazmerno kraći lagani dani 4–7 (ne ispod
    najmanjeg), pa kraći dugi, pa odmor umesto laganog dana 4–7. Posle pripremne trke iz plana bez odmora — dani su
    kraći, broj dana trčanja ostaje. Samo smanjuje; urađeno i zaključano se ne dira. */
export function applyPostRace(doc: PlanDoc, state: RunnerState, data: DistanceData): PlanDoc {
  const races = postRacesOf(doc, state, data);
  if (races.length === 0) return doc;
  const today = state.today;
  const pace = paceCtxOf(doc.header);
  const ctx = buildCtx(doc.header, data);
  const done = doneDayIds(state);
  const raceDate = doc.header.goal.raceDate;
  const dec = doc.header.decisions;
  const minEasy = minEasyOf(data.safety, dec.level, dec.runDays.length);
  /* skraćen lagan dan (dani 4–7 i nedelje posle) ne ide ispod najmanjeg laganog dana nivoa */
  const easyFloor = minEasy;
  const weeks = doc.weeks.map((w) => ({ ...w, days: [...w.days] }));
  const touched = new Set<number>();
  const pos = new Map<IsoDate, { wi: number; di: number }>();
  weeks.forEach((w, wi) => w.days.forEach((d, di) => pos.set(d.date, { wi, di })));
  const dayAt = (date: IsoDate): PlanDay | undefined => {
    const p = pos.get(date);
    return p === undefined ? undefined : (weeks[p.wi] as PlanWeek).days[p.di];
  };
  const setDay = (date: IsoDate, workout: Workout | null): void => {
    const p = pos.get(date);
    if (p === undefined) return;
    const w = weeks[p.wi] as PlanWeek;
    const d = w.days[p.di] as PlanDay;
    w.days[p.di] = { ...d, origin: 'template', workout };
    touched.add(p.wi);
  };
  const dur = (w: Workout | null | undefined): Seconds =>
    w == null ? 0 : summarize(w, pace).durationSec;
  const kmOf = (w: Workout | null | undefined): number => (w == null ? 0 : summarize(w, pace).km);
  const easy = (sec: Seconds): Workout | null => realize({ type: 'easy', sec, maxSec: sec }, ctx);
  const can = (d: PlanDay | undefined): d is PlanDay =>
    d !== undefined && d.workout !== null && isMutable(d, doc.header, today, done);
  for (const r of races) {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(r.date, i + 1)).filter(
      (x) => x < raceDate
    );
    /* dani 1–3 */
    for (const [i, date] of dates.slice(0, POST_RACE_EASY_DAYS).entries()) {
      const d = dayAt(date);
      if (!can(d)) continue;
      const w = d.workout as Workout;
      if (i === 0 && !r.planned && r.durationSec >= POST_RACE_REST_FROM_SEC) {
        setDay(date, null);
        continue;
      }
      /* samo ravnomerno lagano (bez ubrzanja i dodataka) */
      const plain = w.kind === 'easy' && w.steps.length === 1;
      if (plain && dur(w) <= POST_RACE_EASY_MAX_SEC + 30) continue;
      const cap = Math.min(
        POST_RACE_EASY_MAX_SEC,
        w.kind === 'easy' ? dur(w) : POST_RACE_EASY_MAX_SEC
      );
      setDay(
        date,
        cap < minEasy - 60 && !r.planned
          ? null
          : easy(Math.max(cap, r.planned ? Math.min(minEasy, POST_RACE_EASY_MAX_SEC) : 0))
      );
    }
    /* nedelja: prvih 7 dana */
    if (r.weekKm === null || addDays(r.date, 7) >= addDays(mondayOf(raceDate), -7)) continue;
    const limit = r.weekKm;
    const total = (): number => dates.reduce((s, x) => s + kmOf(dayAt(x)?.workout), 0);
    /* 0. posle neplanirane trke prvo odmor u danima 1–3 (od prvog) */
    for (const date of r.planned ? [] : dates.slice(0, POST_RACE_EASY_DAYS)) {
      if (total() <= limit + 0.5) break;
      const d = dayAt(date);
      if (can(d) && d.workout?.kind === 'easy') setDay(date, null);
    }
    /* 1. lagani dani 4–7 srazmerno, ne ispod najmanjeg */
    const later = dates.slice(POST_RACE_EASY_DAYS);
    const easyLater = (): PlanDay[] =>
      later.map(dayAt).filter((d): d is PlanDay => can(d) && d.workout?.kind === 'easy');
    if (total() > limit + 0.5) {
      const ds = easyLater();
      const ekm = ds.reduce((s, d) => s + kmOf(d.workout), 0);
      const f = ekm <= 0 ? 1 : Math.max(0, 1 - (total() - limit) / ekm);
      for (const d of ds) {
        const sec = Math.max(easyFloor, Math.floor((dur(d.workout) * f) / 300) * 300);
        if (sec < dur(d.workout) - 60) setDay(d.date, easy(sec));
      }
    }
    /* 2. dugi (lagan, ne kraći od najdužeg laganog dana + 5 min) */
    if (!r.keepLong && total() > limit + 0.5) {
      const ld = later.map(dayAt).find((d) => can(d) && d.workout?.kind === 'long');
      if (ld !== undefined) {
        const longest = Math.max(
          0,
          ...later.map((x) => {
            const w = dayAt(x)?.workout;
            return w?.kind === 'easy' ? dur(w) : 0;
          })
        );
        const sec = dur(ld.workout);
        const target = Math.max(
          easyFloor,
          longest + 300,
          sec - (total() - limit) * pace.paces.easy
        );
        const s = Math.ceil(target / 300) * 300;
        if (s < sec - 60) {
          const next = realize(
            { type: 'long', sec: s, def: steadyLongDef(ctx, null), dose: 0, slot: null },
            ctx
          );
          if (next !== null) setDay(ld.date, next);
        }
      }
    }
    /* 4. odmor umesto laganog dana 4–7 (najkraći prvo; ne posle pripremne trke iz plana) */
    for (const d of r.planned
      ? []
      : [...easyLater()].sort((a, b) => dur(a.workout) - dur(b.workout))) {
      if (total() <= limit + 0.5) break;
      setDay(d.date, null);
    }
    /* 5. posle trke iz događaja sledeće nedelje rastu najviše `BREAK_WEEK_EXIT_SHARE` od prethodne (bez skoka posle
       skraćene nedelje; pripremna trka iz plana ne — plan je već sklopljen oko nje) */
    if (r.planned) continue;
    const first = pos.get(addDays(r.date, 1))?.wi;
    const last = pos.get(addDays(r.date, 7))?.wi;
    if (first === undefined || last === undefined) continue;
    /* nedelje koje seku prvih 7 dana i jedna posle njih */
    for (let wi = first + 1; wi <= last + 1 && wi < weeks.length; wi += 1) {
      const w = weeks[wi] as PlanWeek;
      const prev = weeks[wi - 1] as PlanWeek;
      if (w.intent.kind === 'taper' || w.intent.kind === 'race') break;
      if (addDays(w.start, 6) >= addDays(mondayOf(raceDate), -7)) break;
      const cap = BREAK_WEEK_EXIT_SHARE * weekCost(prev, raceDate, pace).km;
      const now = (): number => weekCost(weeks[wi] as PlanWeek, raceDate, pace).km;
      if (now() <= cap) continue;
      const ds = w.days.filter((d) => can(d) && d.workout?.kind === 'easy');
      const ekm = ds.reduce((x, d) => x + kmOf(d.workout), 0);
      if (ekm <= 0) continue;
      const f = Math.max(0, 1 - (now() - cap) / ekm);
      for (const d of ds) {
        const sec = Math.max(easyFloor, Math.floor((dur(d.workout) * f) / 300) * 300);
        if (sec < dur(d.workout) - 60) setDay(d.date, easy(sec));
      }
    }
  }
  if (touched.size === 0) return doc;
  /* cilj nedelje (namera plana) ostaje — oporavak posle trke je izmena dana, ne nov cilj (sledeći prolaz gradi od
     cilja, pa bi snižen cilj spustio i lanac dugog) */
  return { ...doc, weeks };
}

/* ------------------------------------------------------------------ R22 (A3): bez mikro-doza */

/** R22 (A3): posle događaja kvalitet praga i tempa trke koji je smanjen u odnosu na plan pre događaja ne pada ispod
    najmanje smislene doze (12 min; tempo trke 3 km ako je kraće) — ide puna najmanja doza (ceo broj deonica), ne
    „2 × 600 m"; kad je i plan bio ispod nje, plan. Samo budući promenljivi dani, van sužavanja. */
export function noMicroCuts(
  after: PlanDoc,
  before: PlanDoc,
  state: RunnerState,
  data: DistanceData
): PlanDoc {
  const ctx = buildCtx(after.header, data);
  const done = doneDayIds(state);
  const old = new Map(before.weeks.flatMap((w) => w.days).map((d) => [d.date, d] as const));
  const pace = paceCtxOf(after.header);
  const dur = (w: Workout | null | undefined): Seconds =>
    w == null ? 0 : summarize(w, pace).durationSec;
  const dec = after.header.decisions;
  const minEasy = minEasyOf(data.safety, dec.level, dec.runDays.length);
  /* poslednji odrađeni kvalitet po zoni */
  const lastDone = new Map<string, Seconds>();
  for (const d of after.weeks.flatMap((w) => w.days)) {
    if (d.date > state.today || d.workout?.kind !== 'quality' || !done.has(d.id)) continue;
    const def = defOf(d.workout, data);
    if (def !== undefined) lastDone.set(mainZone(def.main) ?? '', d.workout.workSec);
  }
  let changed = false;
  const weeks = after.weeks.map((w) => ({
    ...w,
    days: w.days.map((d) => {
      const x = d.workout;
      /* sužavanje i nedelja trke imaju svoju (malu) dozu oštrenja */
      if (w.intent.kind === 'taper' || w.intent.kind === 'race') return d;
      if (x?.kind !== 'quality' || !isMutable(d, after.header, state.today, done)) return d;
      const def = defOf(x, data);
      const prev = old.get(d.date)?.workout ?? null;
      if (def === undefined || prev === null || prev.kind !== 'quality') return d;
      const pdef = defOf(prev, data);
      if (pdef === undefined || mainZone(pdef.main) !== mainZone(def.main)) return d;
      if (x.workSec >= prev.workSec - 30) return d;
      /* ne preko poslednjeg odrađenog iste zone */
      const cap = Math.min(
        prev.workSec,
        lastDone.get(mainZone(def.main) ?? '') ?? Number.POSITIVE_INFINITY
      );
      /* prvo unos izmene, pa unos plana (deonice druge dužine mogu da ne stignu do granice) */
      const raise = (u: WorkoutDef): Workout | null => {
        const want = meaningfulDose(u, ctx, x.workSec, cap);
        if (want <= x.workSec + 30) return null;
        const y = realize(
          {
            type: 'quality',
            def: u,
            dose: want,
            slot: { place: 'quality', stimulus: u.stimulus, index: 1, phase: w.intent.phase }
          },
          ctx
        );
        return y !== null && y.workSec >= want - 45 && y.workSec <= cap + 30 ? y : null;
      };
      const next = raise(def) ?? raise(pdef);
      if (next === null) return d;
      changed = true;
      return { ...d, origin: 'template' as const, workout: next };
    })
  }));
  if (!changed) return after;
  /* obim nedelje ostaje: dodato vreme kvaliteta skida se sa najdužeg laganog dana iste nedelje (ne ispod najmanjeg);
     kad ni tada nedelja ne staje u + 20 % od prethodne (lagani dani na najmanjem), umesto mikro-doze ide lakša vrsta:
     lagano istog trajanja */
  const km = (w: PlanWeek): number => weekCost(w, after.header.goal.raceDate, pace).km;
  const out: PlanWeek[] = [];
  weeks.forEach((w, wi) => {
    const was = after.weeks[wi] as PlanWeek;
    const extra =
      w.days.reduce((a, d) => a + dur(d.workout), 0) -
      was.days.reduce((a, d) => a + dur(d.workout), 0);
    if (extra < 120) {
      out.push(w);
      return;
    }
    const days = [...w.days];
    const easy = days
      .map((d, di) => ({ d, di }))
      .filter((y) => y.d.workout?.kind === 'easy' && y.d.workout.steps.length === 1)
      .filter((y) => isMutable(y.d, after.header, state.today, done))
      .sort((a, b) => dur(b.d.workout) - dur(a.d.workout))[0];
    if (easy !== undefined) {
      const sec = Math.max(minEasy, Math.floor((dur(easy.d.workout) - extra) / 300) * 300);
      const e = sec < dur(easy.d.workout) - 60 ? realize({ type: 'easy', sec }, ctx) : null;
      if (e !== null) days[easy.di] = { ...easy.d, origin: 'template', workout: e };
    }
    const prev = out[wi - 1];
    const next = { ...w, days };
    if (prev === undefined || km(next) <= BREAK_WEEK_EXIT_SHARE * km(prev) + 0.25) {
      out.push(next);
      return;
    }
    const light = was.days.map((d, di) => {
      const raised = days[di];
      /* podignut kvalitet postaje lagan dan trajanja smanjenog; ostali dani su kakvi su bili pre podizanja */
      if (raised?.workout?.kind !== 'quality' || raised.workout === d.workout) return d;
      /* lagan dan ne duži od udela dugog te nedelje (kao kvalitet koji otpadne) */
      const long = Math.max(
        0,
        ...was.days.map((y) => (y.workout?.kind === 'long' ? dur(y.workout) : 0))
      );
      const share = long > 0 ? easyShareOfLong(data.safety, dec.runDays.length) * long : Infinity;
      const sec = Math.max(minEasy, Math.floor(Math.min(dur(d.workout), share) / 60) * 60);
      const e = realize({ type: 'easy', sec }, ctx);
      return e === null ? d : { ...d, origin: 'template' as const, workout: e };
    });
    out.push({ ...w, days: light });
  });
  return { ...after, weeks: out };
}
