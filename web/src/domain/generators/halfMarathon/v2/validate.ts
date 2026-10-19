/* Provera plana prema policy.ts (H1–H17, HI*). SAMO prijavljuje prekršaje; plan se nikad ne menja i nema
   petlji skraćivanja (Uslov 1). Greške obaraju plan (generate.ts → PLAN_VIOLATES_POLICY); upozorenja idu u
   plan. Svaka odluka konstruktora ima proveru ovde (rule = kod prekršaja). Veličine koje koriste i
   konstruktor i validator (cilj po pravilu, minimum nedelje, dugi rasterećenja/tapera, doza rasterećenja i
   tapera, dan oštrenja) imaju JEDNU funkciju (pouka 24). */

import { daysBetween, mustDay, weekdayOf } from './dates.ts';
import {
  deloadEasyShort,
  deloadLengths,
  deloadLong10,
  EASY_MIN10,
  longCap10,
  longFor10,
  longKmCap10,
  longShareCap10,
  rollingLongCap10,
  taperLongCap10,
  week1LongCap10
} from './lengths.ts';
import {
  assessGoal,
  feelPaces,
  midEasy,
  pacesFromVdot,
  raceTimeForVdot,
  round1,
  vdotFromResult
} from './paces.ts';
import {
  buildAllowed,
  deloadAllowed,
  deloadWeeks,
  firstOfPhase,
  isBuildPhase,
  phasesOf,
  testWeekOf
} from './periodize.ts';
import { HM_V2_POLICY as P, planRule } from './policy.ts';
import {
  beginnerTaperT,
  buildLadder,
  capM,
  carries,
  deloadDose,
  deloadLadder,
  deloadSlot,
  type BuildLimit,
  type DayFits,
  fitsDay,
  INITIAL_QUALITY,
  ladderFor,
  nextLevel,
  type QualityState,
  startLevel,
  taperDoses
} from './quality.ts';
import { adjacentDays } from './schedule.ts';
import type {
  DayRole,
  Dose,
  HmV2Plan,
  LadderId,
  Structure,
  Phase,
  PlanWeek,
  QualityType,
  Violation,
  WorkZone
} from './types.ts';
import {
  capacityLimits,
  capacityMessage,
  fewerDaysAdvice,
  INITIAL_VOLUME,
  leaveWeek,
  nominal10,
  peakCap10,
  startKm10,
  weekMin10
} from './volume.ts';
import {
  buildDayLimit,
  type DayLimitContext,
  deloadDayLimit,
  HARD_ROLES,
  lowestBuild,
  raceWeekRuns,
  sharpenerAllowed,
  sharpenerDate,
  taperDayLimit
} from './week.ts';
import {
  doseOf,
  ladderLevels,
  qualityDaySec,
  qualityWorkout,
  recoveryOf,
  repsOf,
  rpeOf,
  sameStructure,
  structuresForDose,
  warmupCooldown,
  zoneOf
} from './workouts.ts';

const EPS = 1e-6;
const PHASES: readonly Phase[] = ['base', 'development', 'specific', 'taper', 'race'];
const ZONES: readonly WorkZone[] = ['R', 'I', 'T', 'RP'];
const to10 = (km: number): number => Math.round(km * 10);
const to100 = (km: number): number => Math.round(km * 100);

type SlotTypes = Readonly<
  Record<Phase, { q1: readonly QualityType[]; q2: readonly QualityType[] }>
>;
/** H10: dozvoljeni tipovi kvaliteta po fazi i slotu (druga struktura: T kontinuirano ↔ deonice; RP
    kontinuirano je tip RP). */
const SLOT_TYPES: SlotTypes = {
  base: { q1: ['R'], q2: ['T_continuous', 'T_cruise'] },
  development: { q1: ['I'], q2: ['T_cruise', 'T_continuous'] },
  specific: { q1: ['RP'], q2: ['T_cruise', 'T_continuous'] },
  taper: { q1: ['RP'], q2: ['T_cruise', 'T_continuous'] },
  race: { q1: [], q2: [] }
};
/** H10/H15: 3 dana — jedan kvalitet (Q1) T kontinuirano → T cruise → RP, bez I i R; taper samo RP (HI6). */
const SLOT_TYPES_ONE: SlotTypes = {
  base: { q1: ['T_continuous', 'T_cruise'], q2: [] },
  development: { q1: ['T_cruise', 'T_continuous'], q2: [] },
  specific: { q1: ['RP'], q2: [] },
  taper: { q1: ['RP'], q2: [] },
  race: { q1: [], q2: [] }
};
/** H17/HI10: početnik — kao 3 dana, uz T kontinuirano kad prvi nivo lestvice faze ne staje u plafon (lestvicu
    nedelje proverava buildLadder) i T kontinuirano tapera kad RP ne staje. */
const SLOT_TYPES_BEGINNER: SlotTypes = {
  ...SLOT_TYPES_ONE,
  specific: { q1: ['RP', 'T_continuous', 'T_cruise'], q2: [] },
  taper: { q1: ['RP', 'T_continuous'], q2: [] }
};

const isSteady = (w: PlanWeek): boolean => isBuildPhase(w.phase) && !w.deload;
const slotDose = (w: PlanWeek, role: 'q1' | 'q2'): Dose | null =>
  w.days.find((d) => d.role === role)?.workout.dose ?? null;
/** H12: glavna doza = rad T + I + RP u treninzima kvaliteta [m]. */
export const mainDoseM = (w: PlanWeek): number =>
  w.days.reduce(
    (a, d) =>
      a +
      (d.workout.kind === 'quality'
        ? Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP) * 1000)
        : 0),
    0
  );
const hasQuality = (w: PlanWeek): boolean => w.days.some((d) => d.workout.kind === 'quality');
const qualityKey = (w: PlanWeek): string =>
  JSON.stringify(
    w.days.filter((d) => d.workout.kind === 'quality').map((d) => [d.role, d.workout.blocks])
  );

export function validatePlan(plan: HmV2Plan): Violation[] {
  const out: Violation[] = [];
  const err = (rule: string, message: string, week?: number, date?: string): void => {
    out.push({
      rule,
      severity: 'error',
      message,
      ...(week !== undefined ? { week } : {}),
      ...(date ? { date } : {})
    });
  };
  const warn = (rule: string, message: string, week?: number): void => {
    out.push({ rule, severity: 'warning', message, ...(week !== undefined ? { week } : {}) });
  };
  const weeks = plan.weeks;
  const input = plan.input;
  const p = plan.paces;
  const N = weeks.length;
  const rule = planRule(
    input.runDays.length,
    input.experience === 'beginner' ? 'beginner' : 'regular'
  );
  if (!rule) {
    err('RUN_DAYS', `Broj dana ${input.runDays.length} nije u tabeli H15 / H17.`);
    return out;
  }
  const pat = plan.pattern;
  const nq = rule.quality;
  const B0 = rule.beginner;
  const slotTypes = rule.beginner ? SLOT_TYPES_BEGINNER : nq === 1 ? SLOT_TYPES_ONE : SLOT_TYPES;
  const intro = (w: { index: number }): boolean => w.index <= rule.introWeeks;
  // H16: osnova tempa iz ulaza (nezavisno od plana) — pouzdan rezultat ≤ 84 dana i VDOT ≥ 30, inače osećaj.
  const res = input.recentResult;
  const resDay = res ? mustDay(res.date) : 0;
  const reliable =
    !!res &&
    mustDay(input.startDate) - resDay <= P.input.resultMaxAgeDays &&
    round1(vdotFromResult(res.distanceM, res.timeSec)) >= P.input.vdotMin;
  const feel = !reliable;
  const feelTest = feel && rule.feelTest;
  if ((pat.q2 === null) !== (nq === 1))
    err('ROLES', `Šablon mora imati ${nq} kvalitetna dana (H15, H9).`);

  // --- Uslov 6: oznaka politike.
  if (plan.policyId !== P.id || plan.policyVersion !== P.version)
    err('POLICY_STAMP', `Plan mora nositi ${P.id}/${P.version}.`);

  // --- Struktura i datumi.
  if (N === 0) {
    err('STRUCTURE', 'Plan nema nedelja.');
    return out;
  }
  if (weeks[0]!.startDate !== input.startDate)
    err('STRUCTURE', 'Prva nedelja ne počinje startom.', 1);
  if (weeks[N - 1]!.endDate !== input.raceDate)
    err('STRUCTURE', 'Poslednja nedelja se ne završava danom trke.', N);
  weeks.forEach((w, i) => {
    if (w.index !== i + 1) err('STRUCTURE', `Redni broj nedelje ${w.index} ≠ ${i + 1}.`, w.index);
    if (daysBetween(w.startDate, w.endDate) !== 6)
      err('STRUCTURE', 'Nedelja nema 7 dana.', w.index);
    if (i > 0 && daysBetween(weeks[i - 1]!.endDate, w.startDate) !== 1)
      err('STRUCTURE', 'Nedelje nisu uzastopne.', w.index);
    const dates = new Set<string>();
    for (const d of w.days) {
      if (mustDay(d.date) < mustDay(w.startDate) || mustDay(d.date) > mustDay(w.endDate))
        err('STRUCTURE', `Dan ${d.date} je van nedelje.`, w.index, d.date);
      if (dates.has(d.date)) err('STRUCTURE', `Dva treninga na ${d.date}.`, w.index, d.date);
      dates.add(d.date);
      if (weekdayOf(d.date) !== d.weekday)
        err('STRUCTURE', 'Pogrešan dan u nedelji.', w.index, d.date);
      if (d.role !== 'race' && !input.runDays.includes(d.weekday))
        err('RUN_DAYS', `Trening na dan koji nije izabran (${d.weekday}).`, w.index, d.date);
      if (d.hard !== HARD_ROLES.includes(d.role))
        err('HARD_FLAG', `Oznaka zahtevnog dana ne odgovara ulozi ${d.role}.`, w.index, d.date);
    }
  });

  // --- H4 / Uslov 6: faza svake nedelje iz odluke generatora.
  const expected = phasesOf(N);
  for (const w of weeks)
    if (!PHASES.includes(w.phase)) err('NO_PHASE', 'Nedelja bez faze.', w.index);
    else if (w.phase !== expected[w.index - 1])
      err('PHASES', `Faza ${w.phase} ≠ ${expected[w.index - 1]} (H4).`, w.index);
  const phases = weeks.map((w) => w.phase);

  // --- H5 (pouka 4): gde su rasterećenja — pravila i jedini raspored pretrage.
  let run = 0;
  for (const w of weeks) {
    if (w.deload && !deloadAllowed(phases, w.index)) {
      const why = !isBuildPhase(w.phase)
        ? `u fazi ${w.phase}`
        : w.index < P.deload.firstAllowedWeek
          ? 'u nedeljama 1–2'
          : firstOfPhase(phases, w.index)
            ? 'na prvoj nedelji faze'
            : 'na poslednjoj nedelji pre tapera';
      err('DELOAD_PLACEMENT', `Rasterećenje ${why} (H5).`, w.index);
    }
    if (!isBuildPhase(w.phase)) continue;
    if (w.deload) run = 0;
    else {
      if (!buildAllowed(phases, w.index, run))
        err('DELOAD_RUN', `${run + 1} uzastopne nedelje izgradnje bez rasterećenja (H5).`, w.index);
      run++;
    }
  }
  const wantDeloads = deloadWeeks(expected) ?? [];
  const gotDeloads = weeks.filter((w) => w.deload).map((w) => w.index);
  if (JSON.stringify(gotDeloads) !== JSON.stringify(wantDeloads))
    err(
      'DELOAD_SCHEDULE',
      `Rasterećenja ${gotDeloads.join(', ') || '—'} ≠ raspored H5 ${wantDeloads.join(', ') || '—'}.`
    );

  // --- H9: uloge dana po šablonu. Rasterećenje: samo T slot (Q2; 3 dana Q1, HI6) ili bez kvaliteta
  // (odstupanje H5); taper: Q1 (RP) i Q2 (T), samo RP ili bez kvaliteta (odstupanje H7); H16: test na danu Q1
  // (u rasterećenju na danu T slota); H17: uvod bez kvaliteta, početnik bez kvaliteta kad ni 1,5 km ne staje;
  // ostali dani šablona lagani.
  const dSlot = deloadSlot(nq);
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    const has = (r: DayRole): boolean => w.days.some((d) => d.role === r);
    const roleOf = (r: 'q1' | 'q2'): DayRole => {
      if (w.test && r === (w.deload ? dSlot : 'q1')) return 'test';
      if (intro(w)) return 'easy';
      if (w.deload) return r === dSlot && has(r) ? r : 'easy';
      if (w.phase === 'taper' || rule.beginner) return has(r) ? r : 'easy';
      return r;
    };
    const want = [
      `${roleOf('q1')}@${pat.q1}`,
      ...(pat.q2 ? [`${roleOf('q2')}@${pat.q2}`] : []),
      `long@${pat.long}`,
      ...pat.easy.map((wd) => `easy@${wd}`)
    ].sort();
    const got = w.days.map((d) => `${d.role}@${d.weekday}`).sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      err('ROLES', `Dani ${got.join(', ')} ≠ šablon ${want.join(', ')} (H9).`, w.index);
    if (w.deload && w.days.some((d) => d.workout.kind === 'quality' && d.role !== dSlot))
      err('ROLES', 'Rasterećenje ima samo T kvalitet (H5).', w.index);
    // H17/HI13: uvod bez kvaliteta (i kad je rasteretna nedelja).
    if (intro(w) && hasQuality(w))
      err('INTRO', `Nedelja uvoda ${w.index} ima kvalitet (H17, HI13).`, w.index);
  }

  // --- H16: test 5 km — plan po osećaju koji nije početnik: tačno jedan, u poslednjoj nedelji baze (oznaka
  // nedelje), na danu Q1 ili na danu kvaliteta rasterećenja; plan sa rezultatom i početnik: nijedan.
  const tests = weeks.flatMap((w) =>
    w.days.filter((d) => d.workout.kind === 'test' || d.role === 'test').map((d) => ({ w, d }))
  );
  const flagged = weeks.filter((w) => w.test).map((w) => w.index);
  const wantTest = feelTest ? testWeekOf(weeks.map((w) => w.phase)) : null;
  if (wantTest === null) {
    if (tests.length > 0 || flagged.length > 0)
      err(
        'TEST',
        rule.beginner ? 'Početnik nema test 5 km (H17).' : 'Plan sa rezultatom nema test (H16).'
      );
  } else if (
    tests.length !== 1 ||
    flagged.join() !== String(wantTest) ||
    tests[0]!.w.index !== wantTest
  )
    err(
      'TEST',
      `Plan po osećaju ima tačno jedan test 5 km, u poslednjoj nedelji baze (${wantTest}) (H16).`,
      tests[0]?.w.index
    );

  // --- H9: zahtevni dani nikad uzastopni (i preko granice nedelje).
  const hard = weeks.flatMap((w) => w.days.filter((d) => d.hard).map((d) => ({ w: w.index, d })));
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!.d.date, hard[i]!.d.date) < 2)
      err(
        'HARD_ADJACENT',
        `Zahtevni dani ${hard[i - 1]!.d.date} i ${hard[i]!.d.date} su susedni (H9).`,
        hard[i]!.w,
        hard[i]!.d.date
      );
  if (
    adjacentDays(pat.q1, pat.long) ||
    (pat.q2 !== null && (adjacentDays(pat.q1, pat.q2) || adjacentDays(pat.q2, pat.long)))
  )
    err('HARD_ADJACENT', 'Šablon ima susedne zahtevne dane (H9).');

  // --- Aritmetika i Uslov 8 (H15).
  for (const w of weeks) {
    for (const d of w.days) {
      const s = d.workout.segments;
      if (
        s.length === 0 ||
        d.workout.km <= 0 ||
        d.workout.sec <= 0 ||
        s.some((x) => x.km <= 0 || x.sec <= 0)
      )
        err(
          'EMPTY_WORKOUT',
          'Prazan trening ili segment bez km/trajanja (Uslov 8).',
          w.index,
          d.date
        );
      if (s.reduce((a, x) => a + to100(x.km), 0) !== to100(d.workout.km))
        err('ARITHMETIC', 'Km dana ≠ zbir segmenata.', w.index, d.date);
      if (s.reduce((a, x) => a + x.sec, 0) !== d.workout.sec)
        err('ARITHMETIC', 'Trajanje dana ≠ zbir segmenata.', w.index, d.date);
      if (d.role === 'easy' && w.phase !== 'race' && to10(d.workout.km) < EASY_MIN10)
        err(
          'EASY_MIN',
          `Lagan ${d.workout.km} km < ${P.lengths.easyMinKm} km (H13).`,
          w.index,
          d.date
        );
      if (d.countsToWeek === (d.role === 'race'))
        err('RACE_DAY', 'Samo trka je van obima nedelje (H8).', w.index, d.date);
    }
    const planned = w.days.reduce((a, d) => a + (d.countsToWeek ? to100(d.workout.km) : 0), 0);
    if (planned !== to100(w.plannedKm)) err('ARITHMETIC', 'Planirano ≠ zbir dana.', w.index);
    if (w.days.filter((d) => d.countsToWeek).length === 0)
      err('EMPTY_WEEK', 'Nedelja bez treninga (Uslov 8).', w.index);
    if (Math.abs(w.plannedKm - w.targetKm) > P.tolerance.plannedKm + EPS)
      err('PLANNED_VS_TARGET', `Planirano ${w.plannedKm} km ≠ cilj ${w.targetKm} km.`, w.index);
    // Uslov 8: nedelja ≥ minimum (trkačka: planirano + trka, H8 — potpuno zadata, pa upozorenje).
    const load10 = to10(w.plannedKm + (w.phase === 'race' ? P.raceWeek.raceKm : 0));
    if (load10 < weekMin10(rule)) {
      if (w.phase === 'race')
        warn(
          'RACE_WEEK_SHORT',
          `Trkačka nedelja ${w.plannedKm} km + trka ${P.raceWeek.raceKm} km < ${rule.weekMinKm} km (Uslov 8).`,
          w.index
        );
      else
        err(
          'WEEK_MIN_VOLUME',
          `Nedelja ${w.plannedKm} km < ${rule.weekMinKm} km (Uslov 8, H15).`,
          w.index
        );
    }
  }

  // --- H13: dužine (dugi ≤ udeo i ≤ 150 min; dugi ≥ svaki lagan; korak 0,1 km).
  let longestAll10 = 0;
  /** Pouka 28: dugi svake nedelje (null bez dugog) — ista funkcija granice kao konstruktor. */
  const longsAll10 = weeks.map((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? to10(l.workout.km) : null;
  });
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.phase === 'race') {
      if (long) err('RACE_WEEK', 'Trkačka nedelja nema dugi (trka ga zamenjuje, H8).', w.index);
      continue;
    }
    if (!long) {
      err('ROLES', 'Nedelja nema dugi trk.', w.index);
      continue;
    }
    const l10 = to10(long.workout.km);
    longestAll10 = Math.max(longestAll10, l10);
    if (Math.abs(long.workout.km * 10 - l10) > EPS)
      err('LENGTH_STEP', 'Dugi nije u koraku 0,1 km (H13).', w.index, long.date);
    if (l10 > longShareCap10(to10(w.targetKm), rule))
      err(
        'LONG_SHARE',
        `Dugi ${long.workout.km} km > ${Math.round(rule.longMaxShare * 100)} % cilja ${w.targetKm} km (H13).`,
        w.index,
        long.date
      );
    if (long.workout.km * p.E.slow > rule.longMaxSec + EPS)
      err(
        'LONG_DURATION',
        `Dugi ${long.workout.km} km > ${rule.longMaxSec / 60} min sporim E (H13${rule.beginner ? ', H17' : ''}).`,
        w.index,
        long.date
      );
    if (l10 > longKmCap10())
      err(
        'LONG_KM',
        `Dugi ${long.workout.km} km > ${P.lengths.longMaxKm} km (H13).`,
        w.index,
        long.date
      );
    const roll10 = rollingLongCap10(w.index, longsAll10, input.recentLongRunKm);
    if (l10 > roll10)
      err(
        'LONG_ROLLING',
        `Dugi ${long.workout.km} km > ${roll10 / 10} km = max(1,1 × L, L + 1 km), L najduži prethodne 4 nedelje (u ned 1–4 i skorašnji najduži) (pouka 28).`,
        w.index,
        long.date
      );
    if (long.workout.segments.some((s) => s.zone !== 'E'))
      err('LONG_NOT_EASY', 'Dugi trk je samo lagan.', w.index, long.date);
    const easyKm = w.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km));
    if (easyKm.length > 1 && Math.max(...easyKm) - Math.min(...easyKm) > 1)
      err('EASY_UNEQUAL', `Lagani dani ${easyKm.map((x) => x / 10).join(' / ')} km.`, w.index);
    for (const d of w.days)
      if (d.role === 'easy') {
        if (to10(d.workout.km) > l10)
          err(
            'LONG_SHORTER_THAN_EASY',
            `Dugi ${long.workout.km} km < lagan ${d.workout.km} km (H13, pouka 2).`,
            w.index,
            d.date
          );
        if (Math.abs(d.workout.km * 10 - to10(d.workout.km)) > EPS)
          err('LENGTH_STEP', 'Lagan nije u koraku 0,1 km (H13).', w.index, d.date);
      }
  }
  if (longestAll10 < to10(rule.longWarnKm))
    warn(
      'LONG_RUN_SHORT',
      `Najduži dugi ${longestAll10 / 10} km < ${rule.longWarnKm} km (${rule.beginner ? 'H17' : 'H13'}): preporuka više dana ili obima.`
    );

  // --- Pouka 32: plafon zone, drugi član — dan kvaliteta iznad najnižeg nivoa zone traje ≤ dugi iste
  // nedelje (trajanje sporim krajem tempa zone, workouts.qualityDaySec). Izuzeci (upozorenje dole): najniži
  // nivo zone (izgradnja: prvi nivo lestvice; rasterećenje/taper: najmanja doza) i dan testa.
  const wcQ = warmupCooldown(input.currentWeeklyKm, rule.beginner);
  const tFloorM = Math.round((B0 ? P.beginner.tFirstKm : P.deload.tMinKm) * 1000);
  const rpMinM = P.taper.rpMin.reps * P.taper.rpMin.repM;
  const lowestOf = (w: PlanWeek, d: Dose): boolean =>
    w.deload || w.phase === 'taper'
      ? d.doseM <= (d.zone === 'RP' ? rpMinM : tFloorM)
      : lowestBuild(d, B0);
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.phase === 'race' || !long) continue;
    for (const d of w.days) {
      const dose = d.workout.dose;
      if (d.workout.kind !== 'quality' || !dose || lowestOf(w, dose)) continue;
      const sec = qualityDaySec(dose, p, wcQ);
      if (sec > long.workout.sec)
        err(
          'QUALITY_OVER_LONG',
          `${dose.zone} ${dose.doseM} m: dan ${Math.round(sec / 60)} min > dugi ${Math.round(long.workout.sec / 60)} min (pouka 32, plafon zone).`,
          w.index,
          d.date
        );
    }
  }

  // --- HI3 (pouka 14): upozorenje — kvalitetni dan (ili dan testa) duži od dugog po trajanju; posle pouke 32
  // samo najniži nivo zone i test, u izgradnji i rasterećenju. Taper (H7: dugi ≤ 0,6 × najduži, RP ≥ 2 × 2000 m)
  // nema upozorenje — preporuka manje dana ne menja taj odnos (HI15).
  const longer = weeks.flatMap((w) => {
    const long = w.days.find((d) => d.role === 'long');
    if (!isBuildPhase(w.phase) || !long) return [];
    const q = Math.max(
      0,
      // Odluka HM-03: dan testa se računa kao kvalitetni dan (ista provera, isti kod).
      ...w.days
        .filter((d) => d.workout.kind === 'quality' || d.workout.kind === 'test')
        .map((d) => d.workout.sec)
    );
    return q > long.workout.sec ? [{ w: w.index, q, long: long.workout.sec }] : [];
  });
  if (longer.length > 0) {
    const f = longer[0]!;
    warn(
      'LONG_SHORTER_THAN_QUALITY',
      `Kvalitetni dan duži od dugog po trajanju u ${longer.length} od ${weeks.filter((w) => isBuildPhase(w.phase)).length} nedelja izgradnje i rasterećenja (ned ${f.w}: ${Math.round(f.q / 60)} > ${Math.round(f.long / 60)} min; najniži nivo zone ili test, pouka 32; HI3)${fewerDaysAdvice(input.runDays.length, input.currentWeeklyKm, rule)}.`,
      f.w
    );
  }

  // --- H11: jedan plafon po zoni, po treningu (trkačka nedelja: H8).
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    for (const d of w.days)
      for (const z of ZONES) {
        const m = Math.round(d.workout.workKm[z] * 1000);
        if (m > capM(z, w.targetKm))
          err(
            'ZONE_CAP',
            `${z} ${m} m > ${P.caps[z] * 100} % cilja ${w.targetKm} km (H11).`,
            w.index,
            d.date
          );
      }
  }

  // --- H10 tipovi po fazi; H14 WU/CD i oporavci; najmanja deonica po zoni; H16 RPE i struktura testa.
  const wc = warmupCooldown(input.currentWeeklyKm, rule.beginner);
  const mid = midEasy(p);
  for (const w of weeks)
    for (const d of w.days) {
      const wo = d.workout;
      if (wo.kind !== 'quality' && wo.rpe !== undefined)
        err('RPE', 'RPE samo na treningu kvaliteta (H16).', w.index, d.date);
      if (wo.kind === 'test') {
        const seg = wo.segments;
        const t = seg.filter((x) => x.kind === 'test');
        if (
          d.role !== 'test' ||
          !d.countsToWeek ||
          wo.dose !== null ||
          seg.length !== 3 ||
          t.length !== 1 ||
          t[0]!.km !== P.test.km ||
          t[0]!.zone !== 'test' ||
          t[0]!.sec !== raceTimeForVdot(p.vdot, P.test.km * 1000) ||
          seg[0]!.kind !== 'warmup' ||
          seg[0]!.sec !== wc.warmupSec ||
          seg[2]!.kind !== 'cooldown' ||
          seg[2]!.sec !== wc.cooldownSec
        )
          err(
            'TEST',
            `Test: WU ${wc.warmupSec / 60} min + ${P.test.km} km + CD ${wc.cooldownSec / 60} min, u obimu nedelje, bez doze (H16).`,
            w.index,
            d.date
          );
        continue;
      }
      if (d.role === 'test') err('TEST', 'Dan testa bez testa (H16).', w.index, d.date);
      if (wo.kind !== 'quality') {
        if (wo.dose) err('DOSE', 'Doza na treningu koji nije kvalitet.', w.index, d.date);
        continue;
      }
      const dose = wo.dose;
      if (!dose) {
        err('DOSE', 'Kvalitet bez doze.', w.index, d.date);
        continue;
      }
      if (w.phase === 'race') {
        if (d.role !== 'sharpener' || wo.qualityType !== 'RP_sharpener')
          err('PHASE_QUALITY', 'Trkačka nedelja ima samo oštrenje (H8).', w.index, d.date);
      } else if (w.deload) {
        if (d.role !== dSlot || dose.ladder !== deloadLadder(w.phase))
          err(
            'PHASE_QUALITY',
            `Rasterećenje: jedini kvalitet je T (${deloadLadder(w.phase)}) na danu ${dSlot.toUpperCase()} (H5).`,
            w.index,
            d.date
          );
      } else {
        const role = d.role === 'q1' || d.role === 'q2' ? d.role : null;
        if (!role || !wo.qualityType || !slotTypes[w.phase][role].includes(wo.qualityType))
          err(
            'PHASE_QUALITY',
            `${wo.qualityType} ne pripada fazi ${w.phase} (${d.role}) (H10).`,
            w.index,
            d.date
          );
        else if (
          isBuildPhase(w.phase) &&
          dose.ladder !==
            (role === 'q1' ? buildLadder(w.phase, w.targetKm, rule) : ladderFor(w.phase, role, nq))
        )
          err(
            'PHASE_QUALITY',
            `Lestvica ${dose.ladder} ≠ faza ${w.phase} (H10${rule.beginner ? ', HI10' : ''}).`,
            w.index,
            d.date
          );
      }
      // H16: plan po osećaju — RPE zone na svakom kvalitetu (i oštrenju); plan sa rezultatom bez RPE.
      const r = rpeOf(dose.zone);
      if (
        feel
          ? !wo.rpe || wo.rpe.min !== r.min || wo.rpe.max !== r.max || wo.rpe.cue !== r.cue
          : wo.rpe !== undefined
      )
        err(
          'RPE',
          feel
            ? `Kvalitet ${dose.zone} nosi RPE ${r.min}–${r.max} („${r.cue}") (H16).`
            : 'Plan sa rezultatom nema RPE (H16).',
          w.index,
          d.date
        );
      if (Math.round(wo.workKm[dose.zone] * 1000) !== dose.doseM)
        err('DOSE', 'Rad u zoni ≠ doza.', w.index, d.date);
      const seg = wo.segments;
      const wu = seg[0];
      const cd = seg[seg.length - 1];
      if (
        !wu ||
        wu.kind !== 'warmup' ||
        wu.sec !== wc.warmupSec ||
        to100(wu.km) !== Math.round((wu.sec * 100) / mid)
      )
        err(
          'WARMUP',
          `Zagrevanje mora biti ${wc.warmupSec / 60} min E (km po srednjem E) (H14).`,
          w.index,
          d.date
        );
      if (
        !cd ||
        cd.kind !== 'cooldown' ||
        cd.sec !== wc.cooldownSec ||
        to100(cd.km) !== Math.round((cd.sec * 100) / mid)
      )
        err(
          'COOLDOWN',
          `Hlađenje mora biti ${wc.cooldownSec / 60} min E (km po srednjem E) (H14).`,
          w.index,
          d.date
        );
      if (seg.filter((x) => x.kind === 'warmup' || x.kind === 'cooldown').length !== 2)
        err('WARMUP', 'Tačno jedno zagrevanje i jedno hlađenje (H14).', w.index, d.date);
      const s = dose.structure;
      const a = P.alternatives;
      // H10: T deonice ≥ 1000 m; RP deonice ≥ 2000 m, kontinuirano do 10 km (oštrenje: H8).
      const repMin = dose.zone === 'T' ? a.tRepMinM : dose.zone === 'RP' ? a.rpRepMinM : 0;
      if (repsOf(s).some((m) => m < repMin))
        err('REP_MIN', `${dose.zone} deonica < ${repMin} m (H10).`, w.index, d.date);
      if (dose.zone === 'RP' && s.form === 'continuous' && dose.doseM > a.rpContinuousMaxKm * 1000)
        err('REP_MIN', `RP kontinuirano > ${a.rpContinuousMaxKm} km (H10).`, w.index, d.date);
      if (dose.zone === 'I' && repsOf(s).some((m) => m < a.iRepMinM || m > a.iRepMaxM))
        err('REP_MIN', `I deonica van ${a.iRepMinM}–${a.iRepMaxM} m (H10, HI5).`, w.index, d.date);
      if ((dose.zone === 'R' || dose.zone === 'I') && s.form === 'continuous')
        err('PHASE_QUALITY', `${dose.zone} nema kontinuiranu strukturu (H10).`, w.index, d.date);
      const reps = seg.filter((x) => x.kind === 'rep');
      const recs = seg.filter((x) => x.kind === 'recovery');
      if (s.form !== 'continuous') {
        const want = repsOf(s);
        const okRec = recs.every((x, i) => {
          const rec = recoveryOf(dose.ladder, want[i]!, p);
          return 'm' in rec ? to100(x.km) === Math.round(rec.m / 10) : x.sec === rec.sec;
        });
        const okReps = reps.every((x, i) => to100(x.km) === Math.round(want[i]! / 10));
        if (reps.length !== want.length || recs.length !== want.length - 1 || !okRec || !okReps)
          err('RECOVERY', `Oporavak deonica ne odgovara H14 (${dose.ladder}).`, w.index, d.date);
      } else if (recs.length > 0 || reps.length > 0)
        err('RECOVERY', 'Kontinuiran blok nema deonice ni oporavak.', w.index, d.date);
    }

  // --- H12: progresija po slotu kroz ne-rasteretne nedelje izgradnje. Slot bez treninga (test H16, uvod i
  // nedelja bez kvaliteta početnika H17) ne menja stanje slota; „glavna doza ne opada" preskače nedelje bez
  // pravog kvaliteta Q1 (test, uvod).
  const B = rule.beginner;
  const steady = weeks.filter(isSteady);
  for (const b of steady)
    if (B && !b.test && !intro(b) && !slotDose(b, 'q1')) {
      if (doseOf(ladderLevels('T_continuous', true)[0]!) > capM('T', b.targetKm))
        warn(
          'BUILD_NO_QUALITY',
          `Nedelja izgradnje bez kvaliteta: ni T ${P.beginner.tFirstKm} km ne staje u plafon (H11 ispred H17).`,
          b.index
        );
      else err('BUILD_NO_QUALITY', 'Početnik: nedelja izgradnje bez kvaliteta (H17).', b.index);
    }
  const lastOf: Record<'q1' | 'q2', Dose | null> = { q1: null, q2: null };
  let prevMain: PlanWeek | null = null;
  let prevW: PlanWeek | null = null;
  // Pouka 32: drugi član plafona zone po slotu — isti predikat kao konstruktor (week.buildDayLimit).
  const dl: DayLimitContext = { paces: p, wc: wcQ, rule };
  const limitOf = (b: PlanWeek): BuildLimit =>
    buildDayLimit(
      dl,
      to10(b.targetKm),
      pat.easy.length,
      rollingLongCap10(b.index, longsAll10, input.recentLongRunKm),
      nq === 2 ? ladderFor(b.phase, 'q2') : null,
      b.days.find((d) => d.workout.kind === 'test')?.workout ?? null
    );
  const slotFits = (b: PlanWeek, role: 'q1' | 'q2'): DayFits =>
    role === 'q1' ? limitOf(b).q1 : limitOf(b).q2(slotDose(b, 'q1'));
  const fit = (b: PlanWeek, role: 'q1' | 'q2', ladder: LadderId, s: Structure) =>
    fitsDay(ladder, s, role === 'q1' && B, slotFits(b, role));
  for (const b of steady) {
    let dropped = false;
    for (const role of ['q1', 'q2'] as const) {
      const da = lastOf[role];
      const db = slotDose(b, role);
      if (db) lastOf[role] = db;
      if (!db) continue;
      if (db.step === 'drop') {
        dropped = true;
        const ladder = db.ladder as LadderId;
        const cap = capM(db.zone, b.targetKm);
        if (da && da.doseM > cap) {
          // Pouka 12: H11 ispred H12 samo u nedelji ograničenoj kapacitetom — prethodna doza ne staje u
          // plafon ove nedelje, najviši nivo lestvice u plafonu, uz napomenu.
          // Pouka 32: najviši nivo u oba člana plafona zone.
          const best = ladderLevels(ladder, role === 'q1' && B)
            .filter((x) => doseOf(x) <= cap && fit(b, role, ladder, x) === 'fits')
            .map(doseOf)
            .pop();
          if (db.doseM !== best || !b.notes.some((n) => n.includes('spušten sa')))
            err('DOSE_DROP', `${role}: spuštanje doze bez razloga iz plafona (H11/H12).`, b.index);
          else
            warn(
              'DOSE_DROPPED',
              `${role}: doza spuštena ${da.doseM} → ${db.doseM} m (plafon, nijedan cilj nije izvodljiv bez toga).`,
              b.index
            );
          continue;
        }
        // Pouka 32: pad doze kao kapacitet — doza staje u oba člana plafona zone, a sledeći nivo lestvice ne
        // staje (najviši takav nivo), uz napomenu.
        const nl = nextLevel(ladder, db.doseM, role === 'q1' && B);
        if (
          db.doseM > cap ||
          fit(b, role, ladder, db.structure) !== 'fits' ||
          (nl !== null && doseOf(nl) <= cap && fit(b, role, ladder, nl) === 'fits') ||
          !b.notes.some((n) => n.includes('pouka 32, plafon zone'))
        )
          err(
            'DOSE_DROP',
            `${role}: spuštanje doze bez razloga iz plafona zone (pouka 32: najviši nivo čiji dan nije duži od dugog).`,
            b.index
          );
        else
          warn(
            'DOSE_DROPPED',
            `${role}: doza ${db.doseM} m${da ? ` (bilo ${da.doseM} m)` : ''} — viša bi dan kvaliteta učinila dužim od dugog (pouka 32).`,
            b.index
          );
        continue;
      }
      if (!da) continue;
      if (da.ladder === db.ladder) {
        const ladder = db.ladder as LadderId;
        const nl = nextLevel(ladder, da.doseM, B);
        if (db.doseM < da.doseM)
          err('DOSE_DECREASE', `${role}: doza ${db.doseM} m < ${da.doseM} m (H12).`, b.index);
        else if (db.doseM > da.doseM && (!nl || db.doseM !== doseOf(nl)))
          err(
            'DOSE_JUMP',
            `${role}: više od jednog nivoa (${da.doseM} → ${db.doseM} m) (H12).`,
            b.index
          );
        else if (db.doseM === da.doseM) {
          if (nl && doseOf(nl) <= capM(db.zone, b.targetKm) && fit(b, role, ladder, nl) !== 'over')
            err(
              'DOSE_STALL',
              `${role}: sledeći nivo ${doseOf(nl)} m staje u plafon, a nije uzet (H12).`,
              b.index
            );
          // Pouka 32: druga struktura koja ne staje u trajanje dugog se ne računa.
          const others = structuresForDose(ladder, da.doseM).some(
            (x) => !sameStructure(x, da.structure) && fit(b, role, ladder, x) !== 'over'
          );
          if (sameStructure(da.structure, db.structure) && others)
            err(
              'SLOT_REPEAT',
              `${role}: ista doza iste strukture, a druga struktura postoji (H12).`,
              b.index
            );
        }
      } else if (carries(da.ladder as LadderId, db.ladder as LadderId) && db.doseM < da.doseM)
        err(
          'TRANSITION_DOSE',
          `${role}: ${db.ladder} ${db.doseM} m < poslednje ${da.ladder} ${da.doseM} m (H12).`,
          b.index
        );
    }
    // H16/H17: nedelja testa i uvoda ne ulaze u poređenje glavne doze.
    const counted = !b.test && !intro(b);
    if (counted && prevMain && mainDoseM(b) < mainDoseM(prevMain) && !dropped)
      err(
        'MAIN_DOSE_DECREASE',
        `Glavna doza ${mainDoseM(b)} m < ${mainDoseM(prevMain)} m (H12, pouka 3).`,
        b.index
      );
    if (counted) prevMain = b;
    if (prevW) {
      const repeat = (['q1', 'q2'] as const).some((r) => slotDose(b, r)?.step === 'repeat');
      if (
        hasQuality(b) &&
        qualityKey(prevW) === qualityKey(b) &&
        !(repeat && b.notes.some((n) => n.includes('ponovljen')))
      )
        err('IDENTICAL_WEEKS', `Isti kvalitet kao nedelja ${prevW.index} (H12).`, b.index);
      // Baza bez platoa (pouka 3): T slota (Q2; 3 dana Q1) raste ili, kad sledeći nivo ne staje, menja
      // strukturu.
      if (prevW.phase === 'base' && b.phase === 'base' && !dropped) {
        const ta = slotDose(prevW, dSlot);
        const tb = slotDose(b, dSlot);
        if (ta && tb) {
          const tl = ta.ladder as LadderId;
          const nl = nextLevel(tl, ta.doseM, B);
          const blocked =
            !nl || doseOf(nl) > capM('T', b.targetKm) || fit(b, dSlot, tl, nl) === 'over';
          // HI10: doza bez druge strukture (T 1,5 km) sme da se ponovi kad sledeći nivo ne staje; pouka 32:
          // druga struktura koja ne staje u trajanje dugog se ne računa.
          const only = !structuresForDose(tl, ta.doseM).some(
            (x) => !sameStructure(x, ta.structure) && fit(b, dSlot, tl, x) !== 'over'
          );
          if (!(
            tb.doseM > ta.doseM ||
            (blocked && (!sameStructure(ta.structure, tb.structure) || only))
          ))
            err(
              'BASE_PLATEAU',
              `Baza: T doza ${tb.doseM} m bez rasta ili druge strukture (H12).`,
              b.index
            );
        }
      }
    }
    prevW = b;
  }

  // --- H12: početni nivo (prva nedelja slota; I i RP na prvoj nedelji nove zone; RP ≥ poslednje I).
  const lastWeek: Record<'q1' | 'q2', PlanWeek | null> = { q1: null, q2: null };
  for (const b of steady)
    for (const role of ['q1', 'q2'] as const) {
      const db = slotDose(b, role);
      if (!db) continue;
      const a = lastWeek[role];
      lastWeek[role] = b;
      if ((a && a.phase === b.phase) || db.step === 'drop') continue;
      const ladder = db.ladder as LadderId;
      const da = a ? slotDose(a, role) : null;
      const carry = da !== null && carries(da.ladder as LadderId, ladder);
      if (da && (da.ladder === ladder || (carry && zoneOf(da.ladder) === zoneOf(ladder)))) continue;
      const st = startLevel(ladder, b.targetKm, B);
      let want = st ? doseOf(st) : NaN;
      if (da && carry) {
        const lv = structuresOfLadder(ladder, B).find((m) => m >= Math.max(want, da.doseM));
        if (lv === undefined || lv > capM(zoneOf(ladder), b.targetKm)) continue;
        want = lv;
      }
      if (db.doseM !== want)
        err(
          'START_LEVEL',
          `${role}: početni nivo ${ladder} ${db.doseM} m ≠ ${want} m (${B ? 'prvi nivo, HI10' : '≤ 60 % plafona, H12'}).`,
          b.index
        );
    }

  // --- H5 sadržaj rasterećenja i H7 taper: doza iz stanja poslednje ne-rasteretne izgradnje (ista
  // funkcija kao konstruktor), dugi 0,8 × poslednji / ≤ 0,6 × najduži. H16: rasterećenje sa testom; HI13:
  // rasterećenje u uvodu bez kvaliteta; HI10: početnik (min T 1,5 km, taper T kad RP ne staje).
  let state: QualityState = INITIAL_QUALITY;
  let lastLong10: number | null = null;
  let longest10 = 0;
  const same = (x: Dose | null, y: Dose): boolean =>
    !!x && x.doseM === y.doseM && sameStructure(x.structure, y.structure);
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.deload && lastLong10 !== null) {
      const roll10 = rollingLongCap10(w.index, longsAll10, input.recentLongRunKm);
      // H11 na dozi po pravilu; drugi član plafona zone (pouka 32) — ista funkcija kao konstruktor.
      const want0 = deloadDose(state, w.phase, rule);
      const want =
        !w.test && !intro(w) && want0.doseM <= capM('T', w.targetKm)
          ? deloadDose(
              state,
              w.phase,
              rule,
              deloadDayLimit(dl, to10(w.targetKm), input.runDays.length - 2, lastLong10, roll10)
            )
          : want0;
      const t = slotDose(w, dSlot);
      const nQuality = w.days.filter((d) => d.workout.kind === 'quality').length;
      const want10 = Math.min(
        deloadLong10(lastLong10),
        longCap10(to10(w.targetKm), rule, p, roll10)
      );
      // HI14: dužine rasterećenja — ista funkcija kao konstruktor (dugi ≤ 0,8 ×, skraćen kad lagani ne bi bili
      // ≥ 4 km); kvalitet otpada samo kad ni uz skraćen dugi ne staje.
      const nRuns = w.days.length - 1;
      const last10 = lastLong10;
      const testDay = w.days.find((d) => d.workout.kind === 'test');
      // Pouka 32: u nedelji testa dugi naviše do trajanja dana testa (ista funkcija dužina).
      const minLong10 = testDay ? longFor10(testDay.workout.sec, p) : 0;
      const lenWith = (km: number, nEasy: number) =>
        deloadLengths(to10(w.targetKm), to100(km), nEasy, last10, rule, p, roll10, minLong10);
      const tFits = want.doseM <= capM('T', w.targetKm);
      if (w.test || intro(w)) {
        if (nQuality !== 0)
          err(
            'DELOAD_CONTENT',
            w.test
              ? 'Rasterećenje sa testom: test umesto kvaliteta (H16).'
              : 'Rasterećenje u uvodu: bez kvaliteta (HI13).',
            w.index
          );
      } else if (!tFits) {
        if (nQuality !== 0 || !w.notes.some((n) => n.includes('bez kvaliteta')))
          err(
            'DELOAD_CONTENT',
            `Rasterećenje: T ${want.doseM} m > plafon → bez kvaliteta, uz napomenu (H11 ispred H5).`,
            w.index
          );
        else warn('DELOAD_NO_QUALITY', `Rasterećenje bez kvaliteta: T ${want.doseM} m.`, w.index);
      } else if (
        nQuality === 0 &&
        lenWith(qualityWorkout(want, p, wc, feel).km, nRuns - 1) === null &&
        deloadEasyShort(
          to10(w.targetKm),
          to100(qualityWorkout(want, p, wc, feel).km),
          nRuns - 1,
          last10,
          rule,
          p,
          roll10
        )
      ) {
        if (!w.notes.some((n) => n.includes('ni uz skraćen dugi')))
          err('DELOAD_CONTENT', 'Rasterećenje bez kvaliteta (HI14) bez napomene.', w.index);
        else
          warn(
            'DELOAD_NO_QUALITY',
            `Rasterećenje bez kvaliteta: ni uz skraćen dugi T ${want.doseM} m ne ostavlja lagane ≥ ${P.lengths.easyMinKm} km (HI14).`,
            w.index
          );
      } else if (nQuality !== 1 || !same(t, want))
        err(
          'DELOAD_CONTENT',
          `Rasterećenje: 1 kvalitet T ${want.doseM} m (≈ 60 % poslednje T doze, min ${B ? P.beginner.tFirstKm : P.deload.tMinKm} km) (H5${B ? ', HI10' : ''}).`,
          w.index
        );
      if (long) {
        const dayKm = testDay
          ? testDay.workout.km
          : w.days
              .filter((d) => d.workout.kind === 'quality')
              .reduce((a, d) => a + d.workout.km, 0);
        const len = lenWith(dayKm, w.days.filter((d) => d.role === 'easy').length);
        const exp10 = len ? len.long10 : want10;
        if (to10(long.workout.km) !== exp10)
          err(
            'DELOAD_LONG',
            `Dugi rasterećenja ${long.workout.km} km ≠ ${exp10 / 10} km (0,8 × poslednji, H5; skraćen samo da lagani ostanu ≥ 4 km, HI14).`,
            w.index
          );
        else if (exp10 > want10) {
          if (!w.notes.some((n) => n.includes('podignut')))
            err(
              'DELOAD_LONG',
              'Podignut dugi rasterećenja sa testom bez napomene (pouka 32).',
              w.index
            );
        } else if (exp10 < want10) {
          if (!w.notes.some((n) => n.includes('kraćen')))
            err('DELOAD_LONG', 'Skraćen dugi rasterećenja bez napomene (HI14).', w.index);
          warn(
            w.test ? 'TEST_DELOAD_LONG' : 'DELOAD_LONG_SHORTENED',
            w.test
              ? `Rasterećenje sa testom: dugi ${exp10 / 10} km < 0,8 × poslednji (${want10 / 10} km) da lagani ostanu ≥ ${P.lengths.easyMinKm} km (H16 ispred H5, HI11).`
              : `Rasterećenje: dugi ${exp10 / 10} km < 0,8 × poslednji (${want10 / 10} km) da lagani ostanu ≥ ${P.lengths.easyMinKm} km (najmanji obim, HI14).`,
            w.index
          );
        }
      }
    }
    if (w.phase === 'taper') {
      // H11 na dozama po pravilu; drugi član plafona zone (pouka 32) — ista funkcija kao konstruktor.
      const tl = taperDayLimit(
        dl,
        to10(w.targetKm),
        pat.easy.length,
        longest10,
        rollingLongCap10(w.index, longsAll10, input.recentLongRunKm),
        nq
      );
      const want0 = taperDoses(state, nq);
      const want = taperDoses(state, nq, tl);
      const rp = slotDose(w, 'q1');
      const t = slotDose(w, 'q2');
      const rpFits = want0.q1.doseM <= capM('RP', w.targetKm);
      // HI10: početnik — RP ne staje → T kontinuirano ≈ 60 % poslednje T doze (min 1,5 km).
      const bt0 = B && !rpFits ? beginnerTaperT(state) : null;
      const bt = bt0 && bt0.doseM <= capM('T', w.targetKm) ? beginnerTaperT(state, tl.q1) : null;
      if (bt) {
        if (!same(rp, bt) || t)
          err(
            'TAPER_QUALITY',
            `Taper početnika: RP ne staje → T ${bt.doseM} m kontinuirano (≈ 60 % poslednje T doze, HI10).`,
            w.index
          );
      } else if (!rpFits) {
        if (rp || t || !w.notes.some((n) => n.includes('bez kvaliteta')))
          err(
            'TAPER_QUALITY',
            `Taper: RP ${want0.q1.doseM} m > plafon → bez kvaliteta, uz napomenu (H11 ispred H7).`,
            w.index
          );
        else warn('TAPER_NO_QUALITY', `Taper bez kvaliteta: RP ${want0.q1.doseM} m.`, w.index);
      } else if (!same(rp, want.q1))
        err('TAPER_QUALITY', `Taper: RP ${want.q1.doseM} m (≈ 60 % poslednje doze) (H7).`, w.index);
      else if (want.q2 === null) {
        if (t)
          err(
            'TAPER_QUALITY',
            'Taper sa jednim kvalitetom: samo RP (jedan kvalitetni dan, HI6).',
            w.index
          );
      } else if (!t) {
        if (!w.notes.some((n) => n.includes('samo RP')))
          err('TAPER_QUALITY', `Taper: T ${want.q2.doseM} m (H7).`, w.index);
        else
          warn(
            'TAPER_RP_ONLY',
            'Taper samo sa RP: sa RP i T nijedan cilj nije izvodljiv.',
            w.index
          );
      } else if (!same(t, want.q2))
        err('TAPER_QUALITY', `Taper: T ${want.q2.doseM} m (≈ 60 % poslednje doze) (H7).`, w.index);
      if (long && to10(long.workout.km) > taperLongCap10(longest10))
        err(
          'TAPER_LONG',
          `Dugi tapera ${long.workout.km} km > 0,6 × najduži ${longest10 / 10} km (H7).`,
          w.index
        );
      if (w.days.length !== input.runDays.length)
        err(
          'TAPER_DAYS',
          `Taper zadržava svih ${input.runDays.length} dana trčanja (H7).`,
          w.index
        );
    }
    if (long) longest10 = Math.max(longest10, to10(long.workout.km));
    if (isSteady(w)) {
      if (long) lastLong10 = to10(long.workout.km);
      // Slot bez treninga (test, uvod) zadržava stanje pre nedelje (H16); t = poslednja T doza (HI10).
      const slot = (d: Dose | null, before: QualityState['q1']): QualityState['q1'] =>
        d ? { ladder: d.ladder as LadderId, doseM: d.doseM, structure: d.structure } : before;
      const q1 = slotDose(w, 'q1');
      const q2 = slotDose(w, 'q2');
      const tz = [q1, q2].filter((d) => d?.zone === 'T').pop();
      state = {
        q1: slot(q1, state.q1),
        q2: slot(q2, state.q2),
        t: tz ? tz.doseM : state.t
      };
    }
  }

  // --- H8 trkačka nedelja (pouka 5).
  const rw = weeks[N - 1]!;
  const taperW = weeks.find((w) => w.phase === 'taper');
  if (rw.phase === 'race') {
    const q = P.raceWeek;
    const race = input.raceDate;
    const races = weeks.flatMap((w) => w.days.filter((d) => d.role === 'race'));
    const rd = rw.days.find((d) => d.role === 'race');
    if (races.length !== 1 || !rd || rd.date !== race)
      err('RACE_DAY', 'Trka je jednom, na dan trke.', rw.index);
    if (rd) {
      const k = rd.workout.segments;
      const raceSeg = k.find((x) => x.kind === 'race');
      if (
        rd.countsToWeek ||
        !raceSeg ||
        raceSeg.km !== q.raceKm ||
        raceSeg.sec !== raceTimeForVdot(p.vdot, P.paces.raceDistanceM) ||
        k[0]?.kind !== 'warmup' ||
        k[0].sec !== q.raceWarmupSec ||
        k[k.length - 1]?.kind !== 'cooldown' ||
        k[k.length - 1]!.sec !== q.raceCooldownSec
      )
        err(
          'RACE_DAY',
          `Trka: ${q.raceKm} km + WU ${q.raceWarmupSec / 60} + CD ${q.raceCooldownSec / 60} min, van obima (H8).`,
          rw.index,
          rd.date
        );
    }
    // Dani: min(broj dana, 5) sa trkom; otpada prvo dan dugog, pa najraniji lagan (ista funkcija).
    const wantDays = raceWeekRuns(input.runDays, pat, rw, race);
    const others = rw.days.filter((d) => d.role !== 'race');
    if (JSON.stringify(others.map((d) => d.date).sort()) !== JSON.stringify(wantDays))
      err(
        'RACE_WEEK',
        `Trkačka nedelja: dani ${others.map((d) => d.weekday).join(', ')} ≠ H8 (${wantDays.map(weekdayOf).join(', ')}).`,
        rw.index
      );
    const sharp = others.filter((d) => d.role === 'sharpener');
    const taperRpM =
      taperW?.days.map((d) => d.workout.dose).find((x) => x?.zone === 'RP')?.doseM ?? 0;
    const prevHard = N > 1 ? (weeks[N - 2]!.days.filter((d) => d.hard).pop()?.date ?? null) : null;
    const sd = sharpenerAllowed(taperRpM) ? sharpenerDate(wantDays, race, prevHard) : null;
    const s0 = sharp[0];
    const st = s0?.workout.dose?.structure;
    if (sd === null) {
      if (sharp.length > 0)
        err(
          'RACE_SHARPENER',
          'Oštrenje bez dana ≥ 3 dana pre trke ili bez RP u taperu (H8).',
          rw.index
        );
    } else if (
      sharp.length !== 1 ||
      !s0 ||
      s0.date !== sd ||
      !st ||
      st.form !== 'reps' ||
      st.reps !== q.sharpener.reps ||
      st.repM !== q.sharpener.repM ||
      daysBetween(s0.date, race) < q.sharpenerMinGapDays ||
      s0.workout.segments.some((x) => x.kind === 'recovery' && x.sec !== q.sharpener.recoverySec)
    )
      err(
        'RACE_SHARPENER',
        `Oštrenje: ${q.sharpener.reps} × ${q.sharpener.repM} m RP (2:00, ≤ RP doza tapera ${taperRpM} m) na najkasnijem danu ≥ ${q.sharpenerMinGapDays} dana pre trke (H8).`,
        rw.index
      );
    if (s0 && s0.workout.dose && s0.workout.dose.doseM > taperRpM)
      err('RACE_SHARPENER', 'Oštrenje > RP doza tapera (H8, pouka 5).', rw.index);
    // Ostali dani: dan pred trku 20 min E + 4 × 20 s (≤ 30 min); ostali min(35 min E, najkraći lagan tapera).
    const taperEasy = (taperW?.days ?? [])
      .filter((d) => d.role === 'easy')
      .map((d) => to10(d.workout.km));
    const easyCap10 = taperEasy.length > 0 ? Math.min(...taperEasy) : Infinity;
    const easyByKm = easyCap10 * 10 < Math.round((q.otherEasySec * 100) / mid);
    for (const d of others) {
      if (d.role === 'sharpener') continue;
      const gap = daysBetween(d.date, race);
      const segs = d.workout.segments;
      if (gap === 1) {
        const strides = segs.filter((x) => x.kind === 'stride');
        const easy = segs.filter((x) => x.kind === 'easy');
        if (
          d.role !== 'eve' ||
          d.workout.sec > q.eveMaxSec ||
          easy.length !== 1 ||
          easy[0]!.sec !== q.eveEasySec ||
          strides.length !== q.eveStrides.reps ||
          strides.some((x) => x.sec !== q.eveStrides.sec)
        )
          err('RACE_EVE', 'Dan pred trku: 20 min E + 4 × 20 s, ≤ 30 min (H8).', rw.index, d.date);
      } else if (
        d.role !== 'easy' ||
        segs.length !== 1 ||
        segs[0]!.zone !== 'E' ||
        (easyByKm ? to100(segs[0]!.km) !== easyCap10 * 10 : segs[0]!.sec !== q.otherEasySec)
      )
        err(
          'RACE_WEEK_EASY',
          easyByKm
            ? `Ostali dani trkačke nedelje: ${easyCap10 / 10} km E = najkraći lagan tapera (H8).`
            : 'Ostali dani trkačke nedelje: 35 min E (H8).',
          rw.index,
          d.date
        );
    }
    // Pouka 5: trkačka nedelja (bez trke) ≤ taper.
    if (taperW && to100(rw.plannedKm) > to100(taperW.plannedKm))
      err(
        'RACE_WEEK_OVER_TAPER',
        `Trkačka nedelja ${rw.plannedKm} km > taper ${taperW.plannedKm} km (H8, pouka 5).`,
        rw.index
      );
    if (to10(rw.targetKm) !== Math.round(to100(rw.plannedKm) / 10))
      err('RACE_WEEK', 'Cilj trkačke nedelje = planirano (H8).', rw.index);
  }

  // --- H6 obim: cilj po pravilu (ista funkcija kao konstruktor), izvodljiv cilj samo uz oznaku i napomenu.
  const start10 = startKm10(input.currentWeeklyKm);
  const cap10 = peakCap10(start10, rule);
  if (to10(plan.startKm) !== start10) err('VOLUME_START', 'Start ≠ trenutni obim (H6).');
  if (to10(plan.peakCapKm) !== cap10)
    err(
      'VOLUME_PEAK',
      B
        ? 'Granica izgradnje početnika ≠ min(1,4×, +15, max nedelje H15) (H17).'
        : 'Granica izgradnje ≠ min(1,4×, +20, max nedelje H15) (H6).'
    );
  let h = INITIAL_VOLUME;
  let capacityCut = false;
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    const nominal = nominal10(w, h, start10, cap10, rule);
    const t10 = to10(w.targetKm);
    if (to10(w.nominalKm) !== nominal)
      err(
        'VOLUME_RULE',
        `Nominalni cilj ${w.nominalKm} km ≠ ${nominal / 10} km po pravilu (H6).`,
        w.index
      );
    if (t10 === nominal) {
      if (w.fitted !== null)
        err('VOLUME_RULE', 'Oznaka izvodljivog cilja bez promene cilja.', w.index);
    } else if (
      w.fitted === null ||
      (w.fitted === 'down' && t10 > nominal) ||
      (w.fitted === 'up' && t10 < nominal) ||
      (w.fitted === 'up' && (w.deload || w.phase === 'taper')) ||
      !w.notes.some((n) => n.includes('najbliži izvodljiv'))
    )
      err(
        'VOLUME_RULE',
        `Cilj ${w.targetKm} km ≠ ${nominal / 10} km po pravilu, bez oznake (H6).`,
        w.index
      );
    else
      warn(
        'WEEK_FITTED',
        `Nedelja ${w.fitted === 'down' ? 'spuštena' : 'podignuta'} na izvodljiv cilj ${w.targetKm} km (pravilo ${nominal / 10} km).`,
        w.index
      );
    if (isBuildPhase(w.phase) && t10 > cap10)
      err(
        'VOLUME_PEAK',
        `Cilj ${w.targetKm} km > granica izgradnje ${cap10 / 10} km (H6).`,
        w.index
      );
    if (t10 < weekMin10(rule))
      err('TARGET_FLOOR', `Cilj ${w.targetKm} km < minimum nedelje ${rule.weekMinKm} km.`, w.index);
    if (isSteady(w) && w.fitted === 'down') capacityCut = true;
    h = leaveWeek(h, w, t10);
  }
  if (to10(plan.peakKm) !== h.peak10) err('VOLUME_PEAK', 'Vrh plana ≠ najveći cilj izgradnje.');
  // Pouka 9 (HI8): nedelja 1 ispod trenutnog obima samo kad je dugi nedelje 1 na apsolutnom plafonu
  // (150 min, 24 km, granica skorašnjeg najdužeg).
  const w1 = weeks[0]!;
  const long1 = w1.days.find((d) => d.role === 'long');
  const abs1 = week1LongCap10(p, input.recentLongRunKm, rule.longMaxSec);
  if (to10(w1.targetKm) < start10 && (!long1 || to10(long1.workout.km) !== abs1))
    err(
      'WEEK1_BELOW_START',
      `Nedelja 1 ${w1.targetKm} km < trenutni obim ${plan.startKm} km, a dugi nije na ${abs1 / 10} km (150 min, 24 km, skorašnji najduži; H6, pouka 9, HI8).`,
      1
    );
  if (capacityCut)
    warn(
      'CAPACITY_LIMITED',
      capacityMessage(
        input.runDays.length,
        rule,
        capacityLimits(weeks, rule, p, input.recentLongRunKm ?? null)
      )
    );

  // --- H2 tempo, H3 cilj; H16 plan po osećaju (osnova tempa iz ulaza, bez prognoze i ocene cilja).
  if (feel) {
    const easy = input.easyPaceSecPerKm;
    if (plan.paceBasis !== 'feel')
      err('PACE_BASIS', 'Bez pouzdanog rezultata plan je po osećaju (H16).');
    if (easy == null || JSON.stringify(feelPaces(easy)) !== JSON.stringify(p))
      err('PACES', 'Tempo ne odgovara laganom tempu ± 15 s i proceni VDOT-a (H16).');
    if (plan.predictedHmSec !== null || plan.goal !== null)
      err('PACES', 'Plan po osećaju nema prognozu ni ocenu cilja do testa (H16).');
  } else {
    if (plan.paceBasis !== undefined)
      err('PACE_BASIS', 'Plan sa rezultatom nema oznaku osnove tempa (osnova = rezultat, H2).');
    if (
      !res ||
      JSON.stringify(pacesFromVdot(vdotFromResult(res.distanceM, res.timeSec))) !==
        JSON.stringify(p)
    )
      err('PACES', 'Tempo ne odgovara VDOT-u iz rezultata (H2).');
    if (plan.predictedHmSec !== raceTimeForVdot(p.vdot, P.paces.raceDistanceM))
      err('PACES', 'Prognoza polumaratona ≠ VDOT plana (H2).');
  }
  if (plan.vdot !== p.vdot) err('PACES', 'VDOT plana ≠ VDOT tempa (H2).');
  if (feel) {
    // Ocena cilja posle testa (H16).
  } else if (input.goalTimeSec) {
    const g = assessGoal(plan.vdot, input.goalTimeSec, N);
    if (!plan.goal || plan.goal.status !== g.status || plan.goal.vdotGap !== g.vdotGap)
      err('GOAL', 'Ocena cilja ne odgovara pravilu H3.');
    else if (g.status === 'unrealistic') warn('GOAL_UNREALISTIC', g.message);
  } else if (plan.goal) err('GOAL', 'Bez cilja nema ocene (H3).');
  return out;
}

/** Doze nivoa lestvice rastuće [m] (`beginner`: lestvica početnika, HI10). */
const structuresOfLadder = (ladder: LadderId, beginner = false): number[] =>
  ladderLevels(ladder, beginner).map(doseOf);
