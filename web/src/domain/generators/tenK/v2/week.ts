/* Sastav nedelje: izgradnja, rasterećenje (D5 sadržaj), taper (D7), trkačka nedelja (D8, D20, D23), za 1
   ili 2 kvaliteta i 1–3 lagana dana (D17–D19); test 5 km (D27); uvod, T kontinuirano umesto lestvice faze
   i nedelja bez kvaliteta početnika (D28, D31). Doze bira quality.ts, dužine lengths.ts, treninge
   workouts.ts; ovde se samo raspoređuju po danima šablona (D9). null = nedelja sa ovim ciljem nije
   izvodljiva po pravilima (volume.ts traži najbliži izvodljiv cilj). */

import { addDays, daysBetween, weekdayOf } from './dates.ts';
import {
  buildLengths,
  deloadLengths,
  limitedEasy10,
  longCap10,
  painLong10,
  taperLengths
} from './lengths.ts';
import { type PlanRule, TEN_K_V2_POLICY as P } from './policy.ts';
import {
  deloadSlot,
  ladderFor,
  pickBuild,
  pickDeload,
  pickTaper,
  type QualityState,
  type SlotState,
  type WeekPicks
} from './quality.ts';
import type {
  DayRole,
  Dose,
  Paces,
  Pattern,
  PlanDay,
  PreStartRef,
  TenKV2Input,
  WeekFrame,
  Weekday,
  Workout
} from './types.ts';
import {
  doseOf,
  easyTimeWorkout,
  easyWorkout,
  eveWorkout,
  fmtKm,
  ladderLevels,
  longWorkout,
  qualityWorkout,
  raceWorkout,
  sharpenerWorkout,
  testWorkout,
  type WarmupCooldown,
  zoneOf
} from './workouts.ts';
import { weekLabel } from './weekLabel.ts';

export interface WeekContext {
  input: TenKV2Input;
  paces: Paces;
  pattern: Pattern;
  /** Prognoza 10K [s] (trka). */
  raceSec: number;
  /** D14: WU/CD po pojasu trenutnog obima (workouts.ts; početnik prvi pojas, D28). */
  wc: WarmupCooldown;
  /** D17/D28: pravilo plana (red tabele za broj dana; početnik). */
  rule: PlanRule;
  /** D26: plan po osećaju (RPE na kvalitetu). */
  feel: boolean;
  /** Segment 04: nedelja posle smanjenja obima (A9/A13: test i dugi rasterećenja, v. buildWeek). */
  adapted?: boolean;
  /** A5 (10k-v2.5.2, pouka 34): prinudno rasterećenje nedelje 1 pri umoru pre starta — referenca (dugi, doza)
      = nedelja 1 generatora bez činjenica (korak.preStart). */
  preStart?: PreStartRef;
}

/** Režim kvaliteta nedelje: 'rule' po pravilu; 'relax' druga pretraga (D11 ispred D12, rasterećenje bez
    kvaliteta, taper samo RP); segment 04 (A4/A9): 'one' jedan kvalitet doze rasterećenja (taper: samo RP),
    'none' bez kvaliteta. */
export type QualityMode = 'rule' | 'relax' | 'one' | 'none';

export interface BuiltWeek {
  days: PlanDay[];
  planned100: number;
  /** Dugi nedelje [0,1 km]; null u trkačkoj nedelji. */
  long10: number | null;
  /** Izbor doza nedelje izgradnje (stanje za sledeću nedelju); null van izgradnje. */
  picks: WeekPicks | null;
  notes: string[];
}

const HARD: readonly DayRole[] = ['q1', 'q2', 'long', 'sharpener', 'race', 'test'];
const EASY_MIN10 = Math.round(P.lengths.easyMinKm * 10);
const km100 = (km: number): number => Math.round(km * 100);

function day(date: string, role: DayRole, workout: Workout, countsToWeek = true): PlanDay {
  return { date, weekday: weekdayOf(date), role, hard: HARD.includes(role), countsToWeek, workout };
}

function finish(
  days: PlanDay[],
  long10: number | null,
  picks: BuiltWeek['picks'],
  notes: string[]
): BuiltWeek {
  days.sort((a, b) => a.date.localeCompare(b.date));
  const planned100 = days.reduce((a, d) => a + (d.countsToWeek ? km100(d.workout.km) : 0), 0);
  return { days, planned100, long10, picks, notes };
}

const dateOf = (frame: WeekFrame, wd: Weekday): string => {
  for (let i = 0; i < 7; i++) {
    const d = addDays(frame.startDate, i);
    if (weekdayOf(d) === wd) return d;
  }
  throw new Error(`Dan ${wd} nije u nedelji ${frame.index}.`);
};

/** D27: napomena nedelje testa. */
const testNote = `Test ${P.test.km} km (D27): kontrolisano maksimalno; računa se u obim nedelje, ne u dozu kvaliteta; rezultat koristi adaptacija (segment 04), do tada tempo ostaje procena.`;

/** Napomena kad slot ponavlja trening jer druga struktura iste doze ne postoji (D10). */
const repeatNote = (slot: string, d: Dose): string =>
  `${slot}: ${d.zone} ${fmtKm(d.doseM / 1000)} km ponovljen — sledeći nivo ne staje u plafon, a druga struktura iste doze ne postoji (D10).`;

/** Lagani dani: datumi rastuće (raniji dan dobija višak zaokruženja, D19). */
const easyDates = (frame: WeekFrame, days: readonly Weekday[]): string[] =>
  days.map((wd) => dateOf(frame, wd)).sort();

const easyDays = (dates: readonly string[], easy10: readonly number[], p: Paces): PlanDay[] =>
  dates.map((d, i) => day(d, 'easy', easyWorkout(easy10[i]! / 10, p)));

/** A4: dani odmora se ne prave; na danima bola dugi ≤ 60 min, lagani × 0,7 (≥ 3 km); svaki lagan ≤ dugi
    (D13). Bez dana bola/odmora dani ostaju isti. Vraća i dugi posle ograničenja [0,1 km]. */
function limitDays(
  frame: WeekFrame,
  days: PlanDay[],
  long10: number | null,
  p: Paces
): { days: PlanDay[]; long10: number | null; notes: string[] } {
  const L = frame.limits;
  if (!L || (!L.rest && !L.pain)) return { days, long10, notes: [] };
  const rest = new Set(L.rest ?? []);
  const pain = new Set(L.pain ?? []);
  const long = days.find((d) => d.role === 'long');
  const l10 =
    !long || rest.has(long.date)
      ? null
      : pain.has(long.date)
        ? painLong10(Math.round(long.workout.km * 10), p)
        : Math.round(long.workout.km * 10);
  const out = days
    .filter((d) => !rest.has(d.date))
    .map((d) => {
      const km10 = Math.round(d.workout.km * 10);
      if (d.role === 'long')
        return l10 === km10 ? d : day(d.date, 'long', longWorkout(l10! / 10, p));
      if (d.role === 'easy') {
        const e10 = limitedEasy10(km10, pain.has(d.date), l10);
        return e10 === km10 && !pain.has(d.date)
          ? d
          : day(d.date, 'easy', easyWorkout(e10 / 10, p));
      }
      if (d.role === 'eve' && pain.has(d.date)) return day(d.date, 'eve', eveWorkout(p, false));
      return d;
    });
  return {
    days: out,
    long10: l10,
    notes: [
      `Adaptacija: ${rest.size > 0 ? `${rest.size} dan(a) odmora, ` : ''}${pain.size > 0 ? 'period bola (dugi ≤ 60 min, lagani × 0,7 ≥ 3 km, bez ubrzanja), ' : ''}planirano ≤ cilj obima (A4).`
    ]
  };
}

/** A4/A9: dan jedinog kvaliteta — željeni dan šablona, a kad je u zabrani kvaliteta drugi dan kvaliteta. */
function oneQualityDay(frame: WeekFrame, pat: Pattern, pref: Weekday): Weekday | null {
  const banned = new Set(frame.limits?.noQuality ?? []);
  const order = [pref, ...[pat.q1, pat.q2].filter((x): x is Weekday => !!x && x !== pref)];
  return order.find((wd) => !banned.has(dateOf(frame, wd))) ?? null;
}

const limitNote = (mode: QualityMode, frame: WeekFrame, targetKm: number): string[] =>
  mode === 'one' || mode === 'none'
    ? [
        frame.limits?.quality === mode
          ? `Adaptacija: ${mode === 'one' ? 'jedan kvalitet doze rasterećenja' : 'nedelja bez kvaliteta'} (ograničenje koraka, A3/A4).`
          : `Adaptacija: kvalitet ne staje u obim ${fmtKm(targetKm)} km — ${mode === 'one' ? 'jedan kvalitet doze rasterećenja' : 'nedelja bez kvaliteta'} (A9).`
      ]
    : [];

/**
 * Izgradnja, rasterećenje ili taper sa ciljem `target10` [0,1 km]. `mode` (QualityMode): 'relax' = druga
 * pretraga cilja, samo kad nijedan cilj nije izvodljiv po pravilu (generate.ts): izgradnja — D11 ispred D12
 * (spuštanje doze); rasterećenje — bez kvaliteta kad ni najmanja T doza ne staje u plafon D11 (odstupanje
 * D5); taper 4–6 dana — samo RP, kao kod 3 dana (odstupanje D7). Segment 04: 'one' / 'none' (ograničenje
 * koraka ili A9) — jedan kvalitet doze rasterećenja (taper: samo RP) na dozvoljenom danu kvaliteta / bez
 * kvaliteta; stanje doze se tada ne menja (picks null). Dani bola/odmora: limitDays (A4).
 */
export function buildWeek(
  ctx: WeekContext,
  frame: WeekFrame,
  target10: number,
  quality: QualityState,
  lastLong10: number | null,
  longest10: number,
  mode: QualityMode = 'rule'
): BuiltWeek | null {
  const p = ctx.paces;
  const pat = ctx.pattern;
  const rule = ctx.rule;
  const targetKm = target10 / 10;
  const relax = mode === 'relax';
  const reduced = mode === 'one' || mode === 'none';
  if (frame.phase === 'race') return null;
  const done = (
    days: PlanDay[],
    long10: number | null,
    picks: BuiltWeek['picks'],
    notes: string[]
  ): BuiltWeek => {
    const lim = limitDays(frame, days, long10, p);
    return finish(lim.days, lim.long10, picks, [
      ...notes,
      ...limitNote(mode, frame, targetKm),
      ...lim.notes
    ]);
  };

  if (frame.deload) {
    // D5/D19: jedan kvalitet (T) na danu T slota, dugi, ostali dani lagani (3 dana: D18). D27: u nedelji
    // testa test zamenjuje kvalitet rasterećenja (na njegovom danu; nije doza, bez plafona D11).
    // A5 (10k-v2.5.2, pouka 34): umor pre starta — poslednji dugi i doza iz nedelje 1 generatora (ctx.preStart).
    const ref = ctx.preStart;
    const lastLong = ref ? Math.round(ref.longKm * 10) : lastLong10;
    if (lastLong === null) return null;
    const test = frame.test === true && (mode === 'rule' || mode === 'relax');
    const slot = deloadSlot(rule.quality);
    const pref = slot === 'q1' ? pat.q1 : pat.q2!;
    const qDay0 = mode === 'none' ? null : test ? pref : oneQualityDay(frame, pat, pref);
    const t0 =
      test || !qDay0
        ? null
        : pickDeload(quality, frame.phase, targetKm, rule, ref ? ref.tDoseM : null);
    // A5 (10k-v2.5.1): prinudno rasterećenje u uvodu početnika (D28) — obim rasterećenja, sadržaj uvoda
    // (bez kvaliteta, dani po šablonu uvoda); uvod ima prednost.
    const intro = frame.index <= rule.introWeeks;
    const [qDay, t] = intro ? [null, null] : [qDay0, t0];
    if (!t && !test && !intro && (mode === 'rule' || mode === 'one')) return null;
    const tw = test ? testWorkout(p, ctx.wc) : t ? qualityWorkout(t, p, ctx.wc, ctx.feel) : null;
    const dates = easyDates(
      frame,
      [pat.q1, ...(pat.q2 ? [pat.q2] : []), ...pat.easy].filter((wd) => !tw || wd !== qDay)
    );
    const len = deloadLengths(
      target10,
      tw ? km100(tw.km) : 0,
      dates.length,
      lastLong,
      rule,
      p,
      test,
      ctx.adapted === true
    );
    if (!len) return null;
    // A9/A13: u adaptiranoj nedelji test koji ne staje (dugi bi bio kraći od testa) otpada.
    if (test && ctx.adapted && len.long10 < Math.round(P.test.km * 10)) return null;
    const days = [
      ...(tw && qDay
        ? [day(dateOf(frame, qDay), test ? 'test' : qDay === pat.q1 ? 'q1' : 'q2', tw)]
        : []),
      day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
      ...easyDays(dates, len.easy10, p)
    ];
    const long0 = Math.floor(P.deload.longFactor * lastLong + 1e-9);
    return done(days, len.long10, null, [
      test
        ? `Rasterećenje: cilj ${fmtKm(targetKm)} km, test ${P.test.km} km umesto kvaliteta rasterećenja (D27), dugi ${len.long10 < long0 ? `${fmtKm(len.long10 / 10)} km — skraćen sa 0,8 × poslednjeg ne-rasteretnog (${fmtKm(long0 / 10)} km) da lagani ostanu ≥ ${fmtKm(P.lengths.easyMinKm)} km (D27 ispred D5, odstupanje)` : '0,8 × poslednji ne-rasteretni (D5)'}.`
        : ctx.adapted &&
            len.long10 < Math.max(EASY_MIN10, Math.min(long0, longCap10(target10, rule, p)))
          ? `Rasterećenje: cilj ${fmtKm(targetKm)} km${tw ? ', jedan kvalitet (T)' : ' bez kvaliteta'}, dugi ${fmtKm(len.long10 / 10)} km — skraćen sa 0,8 × poslednjeg ne-rasteretnog da lagani ostanu ≥ ${fmtKm(P.lengths.easyMinKm)} km (A9, odstupanje).`
          : intro
            ? `Uvod (D28): nedelja ${frame.index} od ${rule.introWeeks} bez kvaliteta — dan kvaliteta je lagan; prinudno rasterećenje (A5): cilj ${fmtKm(targetKm)} km, nedelja bez kvaliteta, dugi 0,8 × poslednji ne-rasteretni.`
            : tw
              ? `Rasterećenje: cilj ${fmtKm(targetKm)} km, jedan kvalitet (T), dugi 0,8 × poslednji ne-rasteretni (D5).`
              : mode === 'none'
                ? `Rasterećenje: cilj ${fmtKm(targetKm)} km bez kvaliteta (adaptacija); dugi 0,8 × poslednji ne-rasteretni.`
                : `Rasterećenje: cilj ${fmtKm(targetKm)} km bez kvaliteta — ni T ${fmtKm(rule.beginner ? P.beginner.tFirstKm : P.deload.tMinKm)} km ne staje u plafon ${P.caps.T * 100} % (D11 ispred D5, odstupanje); dugi 0,8 × poslednji ne-rasteretni.`,
      ...(test ? [testNote] : []),
      ...(ref
        ? [
            `Umor pre starta (A5): referenca rasterećenja je nedelja ${weekLabel(ctx.input, 1)} plana bez činjenica — cilj ${fmtKm(ref.buildKm)} km, dugi ${fmtKm(ref.longKm)} km${ref.tDoseM > 0 ? `, T ${ref.tDoseM} m` : ''}.`
          ]
        : [])
    ]);
  }

  if (frame.phase === 'taper') {
    const t =
      mode === 'none' ? 'none' : pickTaper(quality, targetKm, rule, relax || mode === 'one');
    if (!t || (mode === 'one' && t === 'none')) return null;
    const d1 = t === 'none' ? null : mode === 'one' ? oneQualityDay(frame, pat, pat.q1) : pat.q1;
    if (t !== 'none' && !d1) return null;
    const w1 = t === 'none' ? null : qualityWorkout(t.q1, p, ctx.wc, ctx.feel);
    const w2 = t !== 'none' && t.q2 ? qualityWorkout(t.q2, p, ctx.wc, ctx.feel) : null;
    const q100 = (w1 ? km100(w1.km) : 0) + (w2 ? km100(w2.km) : 0);
    // Dani šablona bez zadržanog kvaliteta su lagani (odstupanje D7 „samo RP" / „bez kvaliteta").
    const kept = [...(w1 && d1 ? [d1] : []), ...(w2 && pat.q2 ? [pat.q2] : [])];
    const dates = easyDates(
      frame,
      [pat.q1, ...(pat.q2 ? [pat.q2] : []), ...pat.easy].filter((wd) => !kept.includes(wd))
    );
    const len = taperLengths(target10, q100, dates.length, longest10, rule, p);
    if (!len) return null;
    const rpMin = `RP ${P.taper.rpMin.reps} × ${P.taper.rpMin.repM} m`;
    const note =
      mode === 'none'
        ? 'Taper bez kvaliteta (adaptacija); dugi ≤ 0,75 × najduži.'
        : !w1
          ? rule.beginner
            ? `Taper bez kvaliteta — ni ${rpMin} ni T ${fmtKm(P.beginner.tFirstKm)} km ne staju u plafon ${P.caps.T * 100} % cilja (D11 ispred D7/D31, odstupanje); dugi ≤ 0,75 × najduži.`
            : `Taper bez kvaliteta — ni ${rpMin} ne staje u plafon ${P.caps.RP * 100} % cilja (D11 ispred D7, odstupanje); dugi ≤ 0,75 × najduži.`
          : t !== 'none' && t.q1.zone === 'T'
            ? `Taper (D31): ${rpMin} ne staje u plafon ${P.caps.RP * 100} % cilja — T kontinuirano ≈ 60 % poslednje T doze (min ${fmtKm(P.beginner.tFirstKm)} km); dugi ≤ 0,75 × najduži.`
            : mode === 'one'
              ? 'Taper: samo RP ≈ 60 % poslednje doze (adaptacija); dugi ≤ 0,75 × najduži.'
              : rule.quality === 2 && !w2
                ? 'Taper: samo RP ≈ 60 % poslednje doze — sa RP i T nijedan cilj ≤ 0,75 × vrh nije izvodljiv (D7, odstupanje); dugi ≤ 0,75 × najduži.'
                : rule.quality === 1
                  ? 'Taper: RP ≈ 60 % poslednje doze, dugi ≤ 0,75 × najduži (D7, D18).'
                  : 'Taper: RP i T ≈ 60 % poslednje doze, dugi ≤ 0,75 × najduži (D7).';
    return done(
      [
        ...(w1 && d1 ? [day(dateOf(frame, d1), d1 === pat.q1 ? 'q1' : 'q2', w1)] : []),
        ...(w2 && pat.q2 ? [day(dateOf(frame, pat.q2), 'q2', w2)] : []),
        day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
        ...easyDays(dates, len.easy10, p)
      ],
      len.long10,
      null,
      [note]
    );
  }

  // D28: uvod bez kvaliteta; D27: test na danu Q1; početnik: T kontinuirano kad prvi nivo lestvice faze ne
  // staje u plafon (D31), bez kvaliteta kad ni 1,5 km ne staje (odstupanje D28). Dan Q1 bez treninga
  // kvaliteta (i bez testa) je lagan. Segment 04: 'one' — jedan kvalitet doze rasterećenja na danu T slota (u
  // zabrani: drugi dan kvaliteta), bez testa; 'none' — bez kvaliteta i bez testa.
  const intro = frame.index <= rule.introWeeks;
  const test = frame.test === true && (mode === 'rule' || mode === 'relax');
  let picks: WeekPicks | null;
  let one: { dose: Dose; day: Weekday } | null = null;
  if (intro) picks = { q1: null, q2: null };
  else if (reduced) {
    picks = null;
    if (mode === 'one') {
      const slot = deloadSlot(rule.quality);
      const wd = oneQualityDay(frame, pat, slot === 'q1' ? pat.q1 : pat.q2!);
      const d = wd ? pickDeload(quality, frame.phase, targetKm, rule) : null;
      if (!d || !wd) return null;
      one = { dose: d, day: wd };
    }
  } else {
    picks = pickBuild(quality, frame.phase, targetKm, p, rule, relax, test);
    if (!picks) return null;
  }
  const w1 = test
    ? testWorkout(p, ctx.wc)
    : picks?.q1
      ? qualityWorkout(picks.q1, p, ctx.wc, ctx.feel)
      : null;
  const w2full = picks?.q2 ? qualityWorkout(picks.q2, p, ctx.wc, ctx.feel) : null;
  const wo = one ? qualityWorkout(one.dose, p, ctx.wc, ctx.feel) : null;
  const assemble = (dropQ2: boolean) => {
    const w2 = dropQ2 ? null : w2full;
    const q100 = (w1 ? km100(w1.km) : 0) + (w2 ? km100(w2.km) : 0) + (wo ? km100(wo.km) : 0);
    const busy = [
      ...(w1 ? [pat.q1] : []),
      ...(w2 && pat.q2 ? [pat.q2] : []),
      ...(one ? [one.day] : [])
    ];
    const dates = easyDates(
      frame,
      [pat.q1, ...(pat.q2 ? [pat.q2] : []), ...pat.easy].filter((wd) => !busy.includes(wd))
    );
    const len = buildLengths(target10, q100, dates.length, rule, p);
    return len ? { w2, dates, len } : null;
  };
  const full = assemble(false);
  if (!full) return null;
  // A9/A13: u adaptiranoj nedelji test koji ne staje (dugi bi bio kraći od testa) otpada.
  if (test && ctx.adapted && full.len.long10 < Math.round(P.test.km * 10)) return null;
  const notes: string[] = [];
  if (intro)
    notes.push(
      `Uvod: ${frame.index}. od ${rule.introWeeks} nedelje uvoda bez kvaliteta — dan kvaliteta je lagan.`
    );
  else if (test) notes.push(testNote);
  else if (reduced) {
    // Napomena režima (limitNote).
  } else if (!w1)
    notes.push(
      `Bez kvaliteta: ni T ${fmtKm(P.beginner.tFirstKm)} km kontinuirano ne staje u plafon ${P.caps.T * 100} % cilja ${fmtKm(targetKm)} km (D11 ispred D28, odstupanje).`
    );
  else if (picks?.q1 && picks.q1.ladder !== ladderFor(frame.phase, 'q1', rule.quality)) {
    const phaseLadder = ladderFor(frame.phase, 'q1', rule.quality);
    const first = doseOf(ladderLevels(phaseLadder)[0]!) / 1000;
    notes.push(
      `T kontinuirano (D31): prvi nivo ${phaseLadder} (${fmtKm(first)} km) ne staje u plafon ${P.caps[zoneOf(phaseLadder)] * 100} % cilja ${fmtKm(targetKm)} km.`
    );
  }
  const slots: [string, Dose, SlotState | null][] = [];
  if (picks?.q1) slots.push(['Q1', picks.q1, quality.q1]);
  if (picks?.q2) slots.push(['Q2', picks.q2, quality.q2]);
  for (const [slot, d] of slots) if (d.step === 'repeat') notes.push(repeatNote(slot, d));
  for (const [slot, d, prev] of slots)
    if (d.step === 'drop')
      notes.push(
        `${slot}: ${d.zone} spušten sa ${fmtKm((prev?.doseM ?? 0) / 1000)} na ${fmtKm(d.doseM / 1000)} km — nijedan cilj nedelje nije izvodljiv uz „doza ne pada" i plafon (D11 ispred D12).`
      );
  const make = (a: NonNullable<ReturnType<typeof assemble>>, extra: string[]): BuiltWeek =>
    done(
      [
        ...(w1 ? [day(dateOf(frame, pat.q1), test ? 'test' : 'q1', w1)] : []),
        ...(a.w2 && pat.q2 ? [day(dateOf(frame, pat.q2), 'q2', a.w2)] : []),
        ...(one && wo ? [day(dateOf(frame, one.day), one.day === pat.q1 ? 'q1' : 'q2', wo)] : []),
        day(dateOf(frame, pat.long), 'long', longWorkout(a.len.long10 / 10, p)),
        ...easyDays(a.dates, a.len.easy10, p)
      ],
      a.len.long10,
      a.w2 || !picks ? picks : { ...picks, q2: null },
      [...notes, ...extra]
    );
  const two = make(full, []);
  // Pouka 35 (10k-v2.6.0, jedino mesto odluke o broju dana kvaliteta nedelje izgradnje): kad bi u nedelji sa
  // dva dana kvaliteta neki trajao duže od dugog, drugi dan kvaliteta je lagan (prvi ostaje); oslobođeni obim
  // raspoređuje buildLengths (dugi raste). Nije izvodljivo sa jednim → dva ostaju uz napomenu (validator:
  // upozorenje). Validator čita isti predikat (qualityOverLong).
  if (frame.deload || !qualityOverLong(two.days)) return two;
  const oneQ = assemble(true);
  const built = oneQ ? make(oneQ, []) : null;
  if (!built) return { ...two, notes: [...two.notes, P35_KEEP] };
  const q2 = two.days.find((d) => d.role === 'q2')!;
  const long = built.days.find((d) => d.role === 'long');
  const still = qualityOverLong(built.days, 1) && long !== undefined;
  return {
    ...built,
    notes: [
      ...built.notes,
      `${P35_DROP} (${q2.workout.title}) je lagan — sa dva dana kvaliteta dan kvaliteta bio bi duži od dugog${still ? '; prvi dan kvaliteta i dalje traje duže od dugog (D25, preporuka manje dana)' : ''}.`
    ]
  };
}

/** Pouka 35: napomena nedelje izgradnje u kojoj je drugi dan kvaliteta lagan (validator: uloga q2 → lagan). */
export const P35_DROP = 'Pouka 35: drugi dan kvaliteta';
/** Pouka 35: nedelja sa jednim kvalitetom nije izvodljiva — dva ostaju (validator: upozorenje). */
export const P35_KEEP =
  'Pouka 35: dva dana kvaliteta ostaju — nedelja sa jednim kvalitetom nije izvodljiva po pravilima; dan kvaliteta duži od dugog (D25).';

/**
 * Pouka 35 (jedan predikat za konstruktor i validator): nedelja ima bar `min` (podrazumevano 2) dana kvaliteta
 * i neki od njih traje duže od dugog iste nedelje.
 */
export function qualityOverLong(days: readonly PlanDay[], min = 2): boolean {
  const q = days.filter((d) => d.workout.kind === 'quality');
  const long = days.find((d) => d.role === 'long');
  return q.length >= min && long !== undefined && q.some((d) => d.workout.sec > long.workout.sec);
}

/** Pouka 25 (A4, 10k-v2.8.0 kao predikat): nedelja sa danima odmora koraka (bol) sme planirano (+ trka u trkačkoj) ispod
    minimuma nedelje — upozorenje WEEK_MIN_REST, ne greška. Jedan predikat za validator i adaptInvariants. */
export const restDaysWeek = (w: { limits?: { rest?: readonly string[] } }): boolean =>
  (w.limits?.rest?.length ?? 0) > 0;

/** Pouka 37 (10k-v2.8.0): oznaka (napomena) mešovite nedelje čiji su preostali dani sastavljeni na ostatak do cilja. */
export const MIXED_NOTE = 'Mešovita nedelja (pouka 37)';

const km10 = (km: number): number => Math.round(km * 10);
const sumKm = (ds: readonly PlanDay[]): number =>
  ds.reduce((a, d) => a + (d.countsToWeek ? km100(d.workout.km) : 0), 0) / 100;

/**
 * Pouka 37 (10k-v2.8.0): najmanji obim preostalih (slobodnih) dana mešovite nedelje — lagan = minimum (D13), dugi kakav
 * je sastavljen (ne skraćuje se radi ostatka); kvalitet i test: `withQuality` false — kao lagan na minimumu (kvalitet
 * otpao), true — kakav je (kvalitet ostaje). Nijedan dan iznad sastavljenog (`free` = dani kakvi su sastavljeni bez
 * zaštićenih, ili upisani kod validatora). Konstruktor (mixedRemainder) i validator (MIXED_OVER_TARGET) čitaju istu
 * funkciju: ostatak < najmanjeg bez kvaliteta → kvalitet ostaje, lagani na minimumu, planirano > cilj uz upozorenje.
 */
export function mixedFloorKm(free: readonly PlanDay[], withQuality = false): number {
  const q = (d: PlanDay): boolean => d.workout.kind === 'quality' || d.workout.kind === 'test';
  return (
    free
      .filter((d) => d.countsToWeek)
      .reduce(
        (s, d) =>
          s +
          (d.role === 'long' || (withQuality && q(d))
            ? km100(d.workout.km)
            : Math.min(km100(d.workout.km), EASY_MIN10 * 10)),
        0
      ) / 100
  );
}

/**
 * Z1 (10K-07, odluka organizatora; dopuna pouke 37) — JEDINA definicija: kvalitet mešovite nedelje NE otpada kad je
 * jedini uzrok viška upisani višak (zaštićeni po činjenicama `keptKm` > planirani zaštićeni `plannedKeptKm`: sa
 * planiranim zaštićenim kvalitet staje, sa upisanim ne) i planirano sa zadržanim kvalitetom (lagani na minimumu)
 * ≤ 1,10 × cilj. Tada kvalitet ostaje, lagani na minimumu, planirano > cilj (upozorenje MIXED_OVER_TARGET). Zovu je
 * konstruktor (mixedRemainder) i validator.
 */
export function recordedExcessKeepsQuality(
  free: readonly PlanDay[],
  keptKm: number,
  plannedKeptKm: number,
  targetKm: number
): boolean {
  const withQ = mixedFloorKm(free, true);
  return (
    free.some((d) => d.workout.kind === 'quality' || d.workout.kind === 'test') &&
    keptKm > plannedKeptKm + 1e-9 &&
    targetKm - plannedKeptKm + 1e-9 >= withQ &&
    targetKm - keptKm + 1e-9 < withQ &&
    keptKm + withQ <= P.adapt.mixedKeepQualityMax * targetKm + 1e-9
  );
}

/** Pouka 37: raspodela `total` [0,1 km] na lagane dane u [lo, hi] — ujednačeno, raniji dan dobija višak (D19). */
function fillEasy(total: number, lo: readonly number[], hi: readonly number[]): number[] {
  const x = [...lo];
  let rem = total - lo.reduce((a, v) => a + v, 0);
  while (rem > 0) {
    let k = -1;
    for (let i = 0; i < x.length; i++) if (x[i]! < hi[i]! && (k < 0 || x[i]! < x[k]!)) k = i;
    if (k < 0) break;
    x[k]!++;
    rem--;
  }
  return x;
}

/**
 * Pouka 37 (10k-v2.8.0, MASTER § 2; dopuna HM-08 i 5K-08i) — JEDINO mesto odluke o obimu preostalih dana mešovite
 * nedelje (deo dana zaštićen: ≤ asOf, zaključan, urađen; trkačka nedelja izuzeta — pouka 30; nedelja pauze — vlasnik
 * je pravilo pauze, volume.adaptVolume `remainder`). Cilj važi za CELU nedelju: preostali dani (`free`, sastavljeni
 * na cilj bez zaštićenih) dobijaju ostatak = cilj − `keptKm` (zbir zaštićenih po činjenicama, written.protectedKm),
 * SAMO NANIŽE (nijedan dan duži od sastavljenog; manjak se ne nadoknađuje; ostatak u toleranciji planiranog — bez
 * izmene). Dugi se ne skraćuje (referenca poslednjeg
 * dugog); prvo lagani do minimuma (lagan ≤ dugi samo među preostalim danima), pa otpada kvalitet (prvo Q2, pa Q1/test;
 * dan postaje lagan, doza se ne beleži) — samo kad time ostatak staje. Kad ni minimum preostalih dana bez kvaliteta
 * (mixedFloorKm) ne staje: kvalitet ostaje, lagani na minimumu, `over` (planirano > cilj; validator: upozorenje
 * MIXED_OVER_TARGET). null = staje bez izmene.
 */
export function mixedRemainder(
  free: readonly PlanDay[],
  keptKm: number,
  targetKm: number,
  p: Paces,
  plannedKeptKm = keptKm
): {
  days: PlanDay[];
  over: boolean;
  excess: boolean;
  droppedQuality: boolean;
  remainderKm: number;
} | null {
  const R = Math.round((targetKm - keptKm) * 100) / 100;
  // Tolerancija planiranog (D6: planirano = cilj ± tolerance.plannedKm) — sastavljena nedelja bez činjenica ostaje ista.
  if (free.length === 0 || sumKm(free) <= R + P.tolerance.plannedKm + 1e-9) return null;
  const long = free.find((d) => d.role === 'long');
  const top10 = long ? km10(long.workout.km) : Infinity;
  const rank = (d: PlanDay): number => (d.role === 'q2' ? 1 : 0);
  const qs = free
    .filter((d) => d.workout.kind === 'quality' || d.workout.kind === 'test')
    .sort((a, b) => rank(a) - rank(b));
  // Z1: upisani višak zaštićenih dana ne obara kvalitet (lagani na minimumu, kao `over`).
  const excess = recordedExcessKeepsQuality(free, keptKm, plannedKeptKm, targetKm);
  const over = excess || R + 1e-9 < mixedFloorKm(free);
  // Dopuna (organizator, MAR-08): kvalitet otpada SAMO kad time ostatak staje; ni bez kvaliteta ne staje → kvalitet
  // ostaje (stimulus i progresija doze), lagani na minimumu.
  const attempts: PlanDay[][] = over
    ? [qs]
    : [qs, ...(qs.length === 2 ? [qs.slice(0, 1)] : []), ...(qs.length > 0 ? [[]] : [])];
  for (const keep of attempts) {
    const easies = free.filter((d) => d.role === 'easy' || (qs.includes(d) && !keep.includes(d)));
    const lo = easies.map((d) => Math.min(km10(d.workout.km), EASY_MIN10));
    const hi = easies.map((d, i) => Math.max(lo[i]!, Math.min(km10(d.workout.km), top10)));
    const avail10 = Math.floor((R - sumKm(keep) - (long ? long.workout.km : 0)) * 10 + 1e-6);
    if (!over && avail10 < lo.reduce((a, v) => a + v, 0)) continue;
    const shares = over ? lo : fillEasy(avail10, lo, hi);
    const days = free.map((d): PlanDay => {
      const i = easies.indexOf(d);
      if (i < 0) return d;
      if (d.role === 'easy' && shares[i] === km10(d.workout.km)) return d;
      return day(d.date, 'easy', easyWorkout(shares[i]! / 10, p));
    });
    return { days, over, excess, droppedQuality: keep.length < qs.length, remainderKm: R };
  }
  return null;
}

/** D8: oštrenje ≤ RP doza tapera — puno (3 × 1000 m) ako ga RP doza tapera nosi, inače 2 × 1000 m; taper
    bez RP (odstupanje D7) → 0 (bez oštrenja). */
export function sharpenerReps(taperRpM: number): number {
  const s = P.raceWeek.sharpener;
  if (taperRpM >= s.reps * s.repM) return s.reps;
  return taperRpM >= P.raceWeek.sharpenerSmallReps * s.repM ? P.raceWeek.sharpenerSmallReps : 0;
}

/** D20: dani trčanja trkačke nedelje osim trke — ukupno sa trkom najviše min(broj dana, 5); otpada prvo
    dan dugog, pa najraniji lagan dan šablona. Datumi rastuće. */
export function raceWeekRuns(
  runDays: readonly Weekday[],
  pattern: Pattern,
  frame: WeekFrame,
  race: string
): string[] {
  const runs = runDays
    .map((wd) => dateOf(frame, wd))
    .filter((d) => d !== race)
    .sort();
  const keep = Math.min(runDays.length, P.raceWeek.maxRunDays) - 1;
  const order = [dateOf(frame, pattern.long), ...easyDates(frame, pattern.easy)];
  const drop = order.filter((d) => runs.includes(d)).slice(0, Math.max(0, runs.length - keep));
  return runs.filter((d) => !drop.includes(d));
}

/** D23: lagan dan trkačke nedelje = min(35 min E, najkraći lagan tapera `taperEasy10` [0,1 km]); kad je
    lagan tapera kraći, dan se zadaje u km. */
export function raceEasyWorkout(taperEasy10: number, p: Paces): Workout {
  const timed = easyTimeWorkout(P.raceWeek.otherEasySec, p);
  return taperEasy10 * 10 < km100(timed.km) ? easyWorkout(taperEasy10 / 10, p) : timed;
}

/**
 * D23 (10k-v2.5.1, jedino mesto): datumi trkačke nedelje koji postaju odmor kad trkačka nedelja bez trke ne bi
 * bila ≤ planirano tapera `cap100` [0,01 km] (taper skraćen danima odmora/bola) — prvo dani bola, pa najraniji
 * lagani, najmanje koliko treba; dan pred trku i trka nikad. `runs` = dani trčanja bez trke (D20, bez dana
 * odmora koraka), bez oštrenja (A9 ga ukida pre ovoga). Konstrukcija (raceWeek) ga primenjuje, validator D20
 * ga čita (isti podatak). Prazno kad staje.
 */
export function raceWeekRest(
  runs: readonly string[],
  race: string,
  pain: ReadonlySet<string>,
  taperEasy10: number,
  p: Paces,
  cap100: number
): string[] {
  // Isti dani kao raceWeek + limitDays: lagan min(35 min E, lagan tapera), na danu bola × 0,7 (≥ 3 km, A4).
  const easyKm = raceEasyWorkout(taperEasy10, p).km;
  const km100 = new Map(
    runs.map((d) => [
      d,
      daysBetween(d, race) === 1
        ? Math.round(eveWorkout(p, !pain.has(d)).km * 100)
        : pain.has(d)
          ? limitedEasy10(Math.round(easyKm * 10), true, null) * 10
          : Math.round(easyKm * 100)
    ])
  );
  let total = [...km100.values()].reduce((a, x) => a + x, 0);
  const order = [
    ...runs.filter((d) => pain.has(d) && daysBetween(d, race) !== 1),
    ...runs.filter((d) => !pain.has(d) && daysBetween(d, race) !== 1)
  ];
  const out: string[] = [];
  for (const d of order) {
    if (total <= cap100) break;
    out.push(d);
    total -= km100.get(d)!;
  }
  // 06g (pouka 30, odluka organizatora): ni bez svih laganih dana trkačka nije ≤ tapera — ostaju dan pred trku i
  // trka (svi lagani postaju odmor); validator: upozorenje RACE_WEEK_OVER_TAPER_EVE (raceWeekEveOnly).
  return out.sort();
}

/** 06g (jedan predikat za validator i adaptInvariants): trkačka nedelja ima samo dan pred trku i trku — kad je
    raceWeekRest pretvorio sve ostale dane u odmor, a i dalje je > tapera (upozorenje RACE_WEEK_OVER_TAPER_EVE, pouke
    23 i 30). */
export const raceWeekEveOnly = (days: readonly PlanDay[]): boolean =>
  days.some((d) => d.role === 'eve') && days.every((d) => d.role === 'eve' || d.role === 'race');

/**
 * D8 + D20: trkačka nedelja. Dani po D20; trka zamenjuje dugi. Oštrenje (≤ RP doza tapera) na najkasnijem
 * danu ≥ 3 dana pre trke koji nije susedan poslednjem zahtevnom danu tapera `prevHard` (D9); nema takvog
 * dana → bez oštrenja (odstupanje D8). Dan pred trku 20 min E + ubrzanja; ostali 35 min E, ali ne duže od
 * najkraćeg laganog dana tapera `taperEasy10` (D23). Trka (sa WU/CD) se ne računa u obim.
 */
export function raceWeek(
  ctx: WeekContext,
  frame: WeekFrame,
  taperRpM: number,
  prevHard: string | null,
  taperEasy10: number,
  noSharpener = false,
  cap100: number | null = null
): BuiltWeek {
  const q = P.raceWeek;
  const p = ctx.paces;
  const race = ctx.input.raceDate;
  const runs0 = raceWeekRuns(ctx.input.runDays, ctx.pattern, frame, race);
  // D23 (10k-v2.5.1): taper skraćen danima odmora/bola — višak laganih dana postaje odmor (raceWeekRest).
  const restK = new Set(frame.limits?.rest ?? []);
  const rested =
    cap100 === null
      ? []
      : raceWeekRest(
          runs0.filter((d) => !restK.has(d)),
          race,
          new Set(frame.limits?.pain ?? []),
          taperEasy10,
          p,
          cap100
        );
  const runs = runs0.filter((d) => !rested.includes(d));
  const reps = sharpenerReps(taperRpM);
  // Segment 04: oštrenje ne pada na dan zabrane kvaliteta (A3/A4) i otpada kad trkačka nedelja sa njim ne
  // bi bila ≤ taper (`noSharpener`, A9).
  const banned = new Set(frame.limits?.noQuality ?? []);
  const cands =
    reps === 0
      ? []
      : [...runs]
          .reverse()
          .filter(
            (d) =>
              daysBetween(d, race) >= q.sharpenerMinGapDays &&
              (prevHard === null || daysBetween(prevHard, d) >= 2)
          );
  const sharpenDate = noSharpener ? null : (cands.find((d) => !banned.has(d)) ?? null);
  const days: PlanDay[] = [day(race, 'race', raceWorkout(p, ctx.raceSec), false)];
  const easy = raceEasyWorkout(taperEasy10, p);
  for (const d of runs) {
    if (d === sharpenDate) days.push(day(d, 'sharpener', sharpenerWorkout(reps, p, ctx.feel)));
    else if (daysBetween(d, race) === 1) days.push(day(d, 'eve', eveWorkout(p)));
    else days.push(day(d, 'easy', easy));
  }
  const shortened =
    easy.blocks[0]?.kind === 'easy' && days.some((d) => d.role === 'easy')
      ? [
          `Trkačka nedelja: lagan ${fmtKm(easy.km)} km = najkraći lagan tapera (kraći od ${Math.round(q.otherEasySec / 60)} min E; trkačka ≤ taper, D23).`
        ]
      : [];
  const lim = limitDays(frame, days, null, p);
  return finish(lim.days, null, null, [
    sharpenDate
      ? `Trkačka nedelja: oštrenje ${reps} × ${q.sharpener.repM} m RP (≤ RP doza tapera ${fmtKm(taperRpM / 1000)} km), trka ${q.raceKm} km se ne računa u obim (D8).`
      : reps === 0
        ? `Trkačka nedelja: taper bez RP — bez oštrenja (oštrenje ≤ RP doza tapera, D8); trka ${q.raceKm} km se ne računa u obim (D20).`
        : cands.length > 0
          ? noSharpener
            ? `Trkačka nedelja: bez oštrenja — sa njim bi trkačka nedelja bila veća od tapera (A9, D23); trka ${q.raceKm} km se ne računa u obim (D20).`
            : `Trkačka nedelja: bez oštrenja — dan oštrenja je u zabrani kvaliteta (adaptacija); trka ${q.raceKm} km se ne računa u obim (D20).`
          : `Trkačka nedelja: nijedan dan trčanja nije ≥ ${q.sharpenerMinGapDays} dana pre trke i nesusedan poslednjem zahtevnom danu tapera — bez oštrenja (D8, odstupanje); trka ${q.raceKm} km se ne računa u obim (D20).`,
    ...shortened,
    ...(rested.length > 0
      ? ['Trkačka nedelja skraćena: taper je imao dane odmora/bola (D23).']
      : []),
    ...lim.notes
  ]);
}
