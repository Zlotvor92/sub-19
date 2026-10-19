/* Provera plana prema policy.ts (M1–M17). SAMO prijavljuje prekršaje; plan se nikad ne menja i nema petlji
   skraćivanja. Greške obaraju plan (generate.ts → PLAN_VIOLATES_POLICY); upozorenja idu u plan. Svaka odluka
   generatora ima ovde nezavisnu proveru (pravilo se ponovo računa iz ulaza i politike). */

import { addDays as isoAdd, daysBetween, mustDay, weekdayOf } from './dates.ts';
import { checkInput } from './input.ts';
import {
  deloadLengths,
  jumpBase10,
  longCap10,
  longJumpCap10,
  longJumpNote,
  longTimeCap10,
  recentLongNote
} from './lengths.ts';
import {
  assessGoal,
  feelPaces,
  midEasy,
  pacesFromVdot,
  predictedMarathon,
  raceTimeForVdot,
  vdotFromEasyPace
} from './paces.ts';
import {
  buildAllowed,
  deloadAllowed,
  firstOfPhase,
  isBuildPhase,
  phasesOf,
  taperStep
} from './periodize.ts';
import { BEGINNER_DAYS_COUNTS, MARATHON_V2_POLICY as P, RUN_DAYS_COUNTS } from './policy.ts';
import {
  capM,
  carries,
  deloadLadder,
  deloadSlot,
  nextLevel,
  mpFitsLong,
  type SlotState,
  taperDoses
} from './quality.ts';
import { adjacentDays } from './schedule.ts';
import type {
  DayRole,
  Dose,
  LadderId,
  MarathonV2Plan,
  Phase,
  PlanWeek,
  QualityType,
  Structure,
  WorkZone
} from './types.ts';
import {
  capacityLimits,
  capacityMessage,
  capacityWeeks,
  growth10,
  peakCap10,
  startKm10
} from './volume.ts';
import {
  doseOf,
  ladderLevels,
  recoveryOf,
  repsOf,
  sameStructure,
  structuresForDose,
  zoneOf
} from './workouts.ts';

const EPS = 1e-6;
const RUN_DAYS_MAX = RUN_DAYS_COUNTS[RUN_DAYS_COUNTS.length - 1]!;
const BEGINNER_DAYS_MAX = BEGINNER_DAYS_COUNTS[BEGINNER_DAYS_COUNTS.length - 1]!;
const PHASES: readonly Phase[] = ['base', 'development', 'specific', 'taper', 'race'];
const HARD: readonly DayRole[] = ['q1', 'q2', 'long', 'sharpener', 'race', 'test'];
const ZONES: readonly WorkZone[] = ['R', 'I', 'T', 'MP'];
const to10 = (km: number): number => Math.round(km * 10);
const to100 = (km: number): number => Math.round(km * 100);

/** M10: dozvoljeni tipovi kvaliteta po fazi i slotu (T druge strukture je kontinuirano ↔ deonice). */
const SLOT_TYPES: Readonly<
  Record<Phase, { q1: readonly QualityType[]; q2: readonly QualityType[] }>
> = {
  base: { q1: ['R'], q2: ['T_continuous', 'T_cruise'] },
  development: { q1: ['I'], q2: ['T_cruise', 'T_continuous'] },
  specific: { q1: ['MP'], q2: ['T_cruise', 'T_continuous'] },
  taper: { q1: ['MP'], q2: ['T_cruise', 'T_continuous'] },
  race: { q1: [], q2: [] }
};
/** M15 3 dana: jedan kvalitet — baza T kont. (↔ deonice), razvoj T cruise (↔ kont.), specifično MP; bez I i R. */
const SLOT_TYPES_ONE: Readonly<
  Record<Phase, { q1: readonly QualityType[]; q2: readonly QualityType[] }>
> = {
  base: { q1: ['T_continuous', 'T_cruise'], q2: [] },
  development: { q1: ['T_cruise', 'T_continuous'], q2: [] },
  specific: { q1: ['MP'], q2: [] },
  taper: { q1: ['MP'], q2: [] },
  race: { q1: [], q2: [] }
};

const isSteady = (w: PlanWeek): boolean => isBuildPhase(w.phase) && !w.deload;
/** Nedelja izgradnje čiji se kvalitet poredi u progresiji (M12): bez testa (M16) i uvoda (M17). */
const hasQualityWork = (w: PlanWeek): boolean => w.days.some((d) => d.workout.kind === 'quality');
const slotDose = (w: PlanWeek, role: 'q1' | 'q2'): Dose | null =>
  w.days.find((d) => d.role === role)?.workout.dose ?? null;
const mainDoseM = (w: PlanWeek): number =>
  w.days.reduce(
    (a, d) =>
      a +
      (d.workout.kind === 'quality'
        ? Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.MP) * 1000)
        : 0),
    0
  );
const qualityKey = (w: PlanWeek): string =>
  JSON.stringify(
    w.days.filter((d) => d.workout.kind === 'quality').map((d) => [d.role, d.workout.blocks])
  );

const slotOf = (d: Dose | null): SlotState | null =>
  d ? { ladder: d.ladder as LadderId, doseM: d.doseM, structure: d.structure } : null;

/** ≈ share × poslednja doza, najviši nivo lestvice naniže (početnik: lestvica M17); ispod najnižeg → floor
    (M5). */
function expectedReduced(
  ladder: LadderId,
  lastM: number,
  share: number,
  floorM: number,
  beginner = false
): number {
  const lv = ladderLevels(ladder, beginner)
    .map(doseOf)
    .filter((m) => m <= share * lastM + EPS && m >= floorM);
  return lv[lv.length - 1] ?? floorM;
}

export function validatePlan(plan: MarathonV2Plan): Violation[] {
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
  const chk = checkInput(input);
  if (!chk.ok) {
    err('INPUT', `Ulaz plana nije ispravan (M1): ${chk.reasons.map((r) => r.code).join(', ')}.`);
    return out;
  }
  // M15/M17: red tabele (početnik: tabela početnika) iz ulaza.
  const rule = chk.rule;
  const beginner = rule.beginner;
  const feel = chk.pace.kind === 'feel';

  // --- Uslov 6: oznaka politike.
  if (plan.policyId !== P.id || plan.policyVersion !== P.version)
    err('POLICY_STAMP', `Plan mora nositi ${P.id}/${P.version}.`);

  // --- M2: tempo iz rezultata (korekcija obima za MP); M16: po osećaju; M3: ocena cilja.
  const want =
    chk.pace.kind === 'result'
      ? pacesFromVdot(chk.pace.vdotRaw, input.currentWeeklyKm)
      : feelPaces(chk.pace.easySecPerKm, input.currentWeeklyKm).paces;
  if (plan.paceBasis !== (feel ? 'feel' : 'result'))
    err('PACE_BASIS', `Osnova tempa ${plan.paceBasis} ≠ ${feel ? 'feel' : 'result'} (M16).`);
  if (JSON.stringify(want) !== JSON.stringify(p))
    err(
      'PACES',
      feel
        ? 'Tempo ≠ M16 (E = lagan ± 15 s, ostale zone iz procene VDOT-a).'
        : 'Tempo ≠ M2 (VDOT iz rezultata, MP iz VDOT-a umanjenog za korekciju obima).'
    );
  if (
    plan.vdot !== want.vdot ||
    plan.predictedMarathonSec !== (feel ? null : predictedMarathon(want))
  )
    err('PACES', 'VDOT ili prognoza maratona ≠ M2/M16 (po osećaju bez prognoze).');
  if (chk.pace.kind === 'feel') {
    // M16: procena VDOT-a nezavisno — VDOT čiji je brži kraj E jednak laganom tempu, 25–60.
    const f = P.feel;
    const est = Math.round(vdotFromEasyPace(chk.pace.easySecPerKm) * 10) / 10;
    if (want.vdot !== Math.min(f.vdotMax, Math.max(f.vdotMin, est)))
      err('PACES', 'Procena VDOT-a ≠ M16.');
    if (est > f.vdotMax)
      warn(
        'VDOT_ESTIMATE_CAPPED',
        `Procena VDOT-a iz laganog tempa ${est} > ${f.vdotMax}: brze zone su ograničene; za ovaj tempo unesi rezultat (M16).`
      );
  }
  const goal = input.goalTimeSec && !feel ? assessGoal(want.mpVdot, input.goalTimeSec, N) : null;
  if (JSON.stringify(goal) !== JSON.stringify(plan.goal)) err('GOAL', 'Ocena cilja ≠ M3/M16.');
  if (goal?.status === 'unrealistic') warn('GOAL_UNREALISTIC', goal.message);
  if (chk.shortResult)
    warn(
      'RESULT_5K',
      'Rezultat 5 km: maratonska prognoza iz kratke trke je nesigurnija; preporuka rezultat 10 km ili duži (M1).'
    );

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
      if (d.hard !== HARD.includes(d.role))
        err('HARD_FLAG', `Oznaka zahtevnog dana ne odgovara ulozi ${d.role}.`, w.index, d.date);
    }
  });

  // --- M4 / Uslov 6: faza svake nedelje iz odluke generatora.
  const expected = phasesOf(N);
  for (const w of weeks) {
    if (!PHASES.includes(w.phase)) err('NO_PHASE', 'Nedelja bez faze.', w.index);
    else if (w.phase !== expected[w.index - 1])
      err('PHASES', `Faza ${w.phase} ≠ ${expected[w.index - 1]} (M4).`, w.index);
  }
  const phases = weeks.map((w) => w.phase);
  if (phases.filter((x) => x === 'taper').length !== P.phases.taperWeeks)
    err('TAPER_WEEKS', `Taper mora imati ${P.phases.taperWeeks} nedelje (M4, M7).`);

  // --- M5: gde su rasterećenja (pouka 4) i niz izgradnje.
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
      err('DELOAD_PLACEMENT', `Rasterećenje ${why} (M5).`, w.index);
    }
    if (!isBuildPhase(w.phase)) continue;
    if (w.deload) run = 0;
    else {
      if (!buildAllowed(phases, w.index, run))
        err('DELOAD_RUN', `${run + 1} uzastopne nedelje izgradnje bez rasterećenja (M5).`, w.index);
      run++;
    }
  }

  // --- M9: uloge dana po šablonu; M5/M7 broj kvaliteta (ostali dani lagani).
  const pat = plan.pattern;
  if ((pat.q2 === null ? 1 : 2) !== rule.quality)
    err('ROLES', `Šablon ima ${pat.q2 === null ? 1 : 2} kvaliteta, M15 traži ${rule.quality}.`);
  if (
    adjacentDays(pat.q1, pat.long) ||
    (pat.q2 !== null && (adjacentDays(pat.q1, pat.q2) || adjacentDays(pat.q2, pat.long)))
  )
    err('HARD_ADJACENT', 'Šablon ima susedne zahtevne dane (M9).');
  const tSlot = deloadSlot(rule.quality);
  // M17: nedelja izgradnje bez Q1 — uvod (ned 1–2) ili početnik kad ni T 1,5 km ne staje u plafon (nezavisno).
  const tFirstM = Math.round(P.beginner.tFirstKm * 1000);
  const noQ1 = (w: PlanWeek): boolean =>
    isSteady(w) &&
    !w.test &&
    (w.index <= rule.introWeeks || (beginner && tFirstM > capM('T', w.targetKm)));
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    const has = (r: DayRole): boolean => w.days.some((d) => d.role === r);
    // Rasterećenje: samo T slot (Q2; 3 dana Q1); taper: Q1 (MP) i Q2 (T, samo N−2) kad postoje (M7, odstupanje
    // M11 ispred M7).
    // M16: test zamenjuje Q1 (izgradnja) ili kvalitet rasterećenja (dan T slota). M17: uvod i nedelja
    // početnika bez kvaliteta — dan Q1 lagan (BUILD_NO_QUALITY proverava plafon).
    const testSlot = w.deload ? tSlot : 'q1';
    const roleOf = (r: 'q1' | 'q2'): DayRole =>
      w.test && r === testSlot
        ? 'test'
        : w.deload
          ? r === tSlot
            ? r
            : 'easy'
          : (w.phase === 'taper' && !has(r)) || (r === 'q1' && noQ1(w))
            ? 'easy'
            : r;
    const exp = [
      `${roleOf('q1')}@${pat.q1}`,
      ...(pat.q2 !== null ? [`${roleOf('q2')}@${pat.q2}`] : []),
      `long@${pat.long}`,
      ...pat.easy.map((wd) => `easy@${wd}`)
    ].sort();
    const got = w.days.map((d) => `${d.role}@${d.weekday}`).sort();
    if (JSON.stringify(got) !== JSON.stringify(exp))
      err('ROLES', `Dani ${got.join(', ')} ≠ šablon ${exp.join(', ')} (M9).`, w.index);
  }

  // --- M9: zahtevni dani nikad uzastopni (i preko granice nedelje).
  const hard = weeks.flatMap((w) => w.days.filter((d) => d.hard).map((d) => ({ w: w.index, d })));
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!.d.date, hard[i]!.d.date) < 2)
      err(
        'HARD_ADJACENT',
        `Zahtevni dani ${hard[i - 1]!.d.date} i ${hard[i]!.d.date} su susedni (M9).`,
        hard[i]!.w,
        hard[i]!.d.date
      );

  // --- Aritmetika i Uslov 8 (M15; trkačka nedelja: planirano + 42,2 km, M8).
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
      // M13: lagan ≥ 5 km van trkačke nedelje (trkačku nedelju potpuno zadaje M8).
      if (d.role === 'easy' && w.phase !== 'race' && d.workout.km + EPS < P.lengths.easyMinKm)
        err(
          'EASY_MIN',
          `Lagan ${d.workout.km} km < ${P.lengths.easyMinKm} km (M13).`,
          w.index,
          d.date
        );
    }
    const planned = w.days.reduce((a, d) => a + (d.countsToWeek ? to100(d.workout.km) : 0), 0);
    if (planned !== to100(w.plannedKm)) err('ARITHMETIC', 'Planirano ≠ zbir dana.', w.index);
    if (w.days.filter((d) => d.countsToWeek).length === 0)
      err('EMPTY_WEEK', 'Nedelja bez treninga (Uslov 8).', w.index);
    if (Math.abs(w.plannedKm - w.targetKm) > P.tolerance.plannedKm + EPS)
      err('PLANNED_VS_TARGET', `Planirano ${w.plannedKm} km ≠ cilj ${w.targetKm} km.`, w.index);
    const load = w.plannedKm + (w.phase === 'race' ? P.raceWeek.raceKm : 0);
    if (load + EPS < rule.weekMinKm)
      err(
        'WEEK_MIN_VOLUME',
        `Nedelja ${w.plannedKm} km${w.phase === 'race' ? ` + maraton ${P.raceWeek.raceKm} km` : ''} < ${rule.weekMinKm} km (Uslov 8, M15).`,
        w.index
      );
  }

  // --- M13: dužine (dugi ≤ 40 % i ≤ 150 min sporim E, dugi ≥ lagan, korak 0,1 km).
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.phase === 'race') {
      if (long) err('RACE_WEEK', 'Trkačka nedelja nema dugi (trka ga zamenjuje, M8).', w.index);
      continue;
    }
    if (!long) {
      err('ROLES', 'Nedelja nema dugi trk.', w.index);
      continue;
    }
    const l10 = to10(long.workout.km);
    if (Math.abs(long.workout.km * 10 - l10) > EPS)
      err('LENGTH_STEP', 'Dugi nije u koraku 0,1 km (M13).', w.index, long.date);
    if (l10 > Math.floor(rule.longMaxShare * to10(w.targetKm) + 1e-9))
      err(
        'LONG_SHARE',
        `Dugi ${long.workout.km} km > ${Math.round(rule.longMaxShare * 100)} % cilja ${w.targetKm} km (M13, M15).`,
        w.index,
        long.date
      );
    if (long.workout.km * p.E.slow > P.lengths.longMaxSec + EPS)
      err(
        'LONG_DURATION',
        `Dugi ${long.workout.km} km > ${P.lengths.longMaxSec / 60} min sporim E (M13).`,
        w.index,
        long.date
      );
    if (long.workout.segments.some((s) => s.zone !== 'E'))
      err('LONG_NOT_EASY', 'Dugi trk je samo lagan.', w.index, long.date);
    const easyKm = w.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km));
    if (easyKm.length > 1 && Math.max(...easyKm) - Math.min(...easyKm) > 1)
      err(
        'EASY_UNEQUAL',
        `Lagani dani ${easyKm.map((x) => x / 10).join(' / ')} km nisu jednaki.`,
        w.index
      );
    for (const d of w.days)
      if (d.role === 'easy') {
        if (d.workout.km > long.workout.km + EPS)
          err(
            'LONG_SHORTER_THAN_EASY',
            `Dugi ${long.workout.km} km < lagan ${d.workout.km} km (M13, pouka 2).`,
            w.index,
            d.date
          );
        if (Math.abs(d.workout.km * 10 - to10(d.workout.km)) > EPS)
          err('LENGTH_STEP', 'Lagan nije u koraku 0,1 km (M13).', w.index, d.date);
      }
  }
  // M13: upozorenje kad je najduži dugi < 26 km.
  const longestKm = Math.max(
    0,
    ...weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
  );
  if (longestKm + EPS < rule.longShortKm) {
    const timeCapped = weeks.some((w) =>
      w.days.some(
        (d) =>
          d.role === 'long' && d.workout.km === longestKm && to10(d.workout.km) === longTimeCap10(p)
      )
    );
    warn(
      'MARATHON_LONG_SHORT',
      `Najduži dugi trk u planu je ${String(longestKm).replace('.', ',')} km; za maraton se preporučuje bar ${rule.longShortKm} km (${beginner ? 'M17' : 'M13'}). ` +
        (beginner ? 'Početnik: cilj je završiti maraton. ' : '') +
        (timeCapped
          ? `Ograničava ga trajanje (≤ ${P.lengths.longMaxSec / 60} min laganim tempom) — namerna granica opterećenja; ostatak obima nose ostali dani.`
          : `Ograničava ga udeo dugog (≤ ${Math.round(rule.longMaxShare * 100)} % nedelje sa ${input.runDays.length} dana): veći nedeljni obim${input.runDays.length < (beginner ? BEGINNER_DAYS_MAX : RUN_DAYS_MAX) ? ' (više dana trčanja nose veći obim)' : ''} daje duži dugi trk.`)
    );
  }
  // Pouka 14: kvalitetni dan duži od dugog po trajanju u ne-rasteretnoj nedelji izgradnje (upozorenje).
  const longer = weeks.flatMap((w) => {
    const long = w.days.find((d) => d.role === 'long');
    if (!isSteady(w) || !long) return [];
    const q = Math.max(
      0,
      ...w.days.filter((d) => d.workout.kind === 'quality').map((d) => d.workout.sec)
    );
    const jump = w.notes.some((n) => n.includes('plafon skoka'));
    return q > long.workout.sec ? [{ w: w.index, q, long: long.workout.sec, jump }] : [];
  });
  if (longer.length > 0) {
    const f = longer[0]!;
    warn(
      'LONG_SHORTER_THAN_QUALITY',
      `Kvalitetni dan duži od dugog po trajanju u ${longer.length} od ${weeks.filter(isSteady).length} nedelja izgradnje (ned ${f.w}: ${Math.round(f.q / 60)} > ${Math.round(f.long / 60)} min; pouka 14)${longer.some((x) => x.jump) ? '; dugi je ograničen skokom od skorašnjeg najdužeg (M13a), MP je najniži nivo (2 × 3000 m)' : ''}.`,
      f.w
    );
  }

  // --- M11: jedan plafon po zoni, po treningu (trkačka nedelja: M8).
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    for (const d of w.days)
      for (const z of ZONES) {
        const m = Math.round(d.workout.workKm[z] * 1000);
        // M7a: u taperu je MP doza iz M7 (minimum 2 × 3000 m ispred plafona; proverava TAPER_QUALITY).
        if (w.phase === 'taper' && z === 'MP') continue;
        if (m > capM(z, w.targetKm))
          err(
            'ZONE_CAP',
            `${z} ${m} m > ${P.caps[z] * 100} % cilja ${w.targetKm} km (M11).`,
            w.index,
            d.date
          );
      }
  }

  // --- M10 tipovi po fazi; M14 WU/CD (pojas trenutnog obima) i oporavci; M10 strukture.
  const km10 = to10(input.currentWeeklyKm);
  // M14 pojas trenutnog obima; početnik uvek 15/10 (M17).
  const wc = beginner
    ? { warmupSec: P.beginner.warmupSec, cooldownSec: P.beginner.cooldownSec }
    : P.workout.warmupCooldown.filter((b) => to10(b.fromKm) <= km10).pop()!;
  const mid = midEasy(p);
  for (const w of weeks)
    for (const d of w.days) {
      const wo = d.workout;
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
        if (d.role !== 'sharpener' || wo.qualityType !== 'MP_sharpener')
          err('PHASE_QUALITY', 'Trkačka nedelja ima samo oštrenje (M8).', w.index, d.date);
      } else if (w.deload) {
        const lad = deloadLadder(w.phase);
        if (d.role !== tSlot || dose.ladder !== lad)
          err(
            'PHASE_QUALITY',
            `Rasterećenje: jedini kvalitet je T (${lad}) na danu ${tSlot.toUpperCase()} (M5).`,
            w.index,
            d.date
          );
      } else if (beginner && isSteady(w)) {
        // M17: lestvica faze (M15 jedan kvalitet); kad njen prvi nivo ne staje u plafon — T kontinuirano
        // (lestvica početnika od 1,5 km). Plafon računat ovde iz politike.
        const phaseLadder: LadderId =
          w.phase === 'base' ? 'T_continuous' : w.phase === 'development' ? 'T_cruise' : 'MP';
        const first = doseOf(P.ladders[phaseLadder][0]!);
        const zone: WorkZone = phaseLadder === 'MP' ? 'MP' : 'T';
        const fits = first <= Math.floor(P.caps[zone] * w.targetKm * 1000 + 1e-6);
        const wantLadder = fits ? phaseLadder : 'T_continuous';
        const tTypes: readonly QualityType[] = ['T_continuous', 'T_cruise'];
        const okType =
          wantLadder === 'MP' ? wo.qualityType === 'MP' : tTypes.includes(wo.qualityType!);
        if (d.role !== 'q1' || dose.ladder !== wantLadder || !okType)
          err(
            'PHASE_QUALITY',
            `Početnik: ${wo.qualityType} (${dose.ladder}) ≠ ${wantLadder} u fazi ${w.phase} (M17).`,
            w.index,
            d.date
          );
        else if (!fits && !w.notes.some((n) => n.startsWith('T kontinuirano (M17)')))
          err('PHASE_QUALITY', 'T kontinuirano početnika bez napomene (M17).', w.index, d.date);
      } else {
        const role = d.role === 'q1' || d.role === 'q2' ? d.role : null;
        const types = rule.quality === 1 ? SLOT_TYPES_ONE : SLOT_TYPES;
        // M17: početnik u N−1 — T kontinuirano umesto MP (TAPER_QUALITY proverava dozu).
        const begTaperT =
          beginner && taperStep(phases, w.index) === 1 && wo.qualityType === 'T_continuous';
        if (
          !role ||
          !wo.qualityType ||
          (!types[w.phase][role].includes(wo.qualityType) && !begTaperT)
        )
          err(
            'PHASE_QUALITY',
            `${wo.qualityType} ne pripada fazi ${w.phase} (${d.role}) (M10).`,
            w.index,
            d.date
          );
      }
      // M16: RPE samo u planu po osećaju, po zoni iz politike.
      const r = P.feel.rpe[dose.zone];
      if (
        feel
          ? !wo.rpe || wo.rpe.min !== r.min || wo.rpe.max !== r.max || wo.rpe.cue !== r.cue
          : wo.rpe !== undefined
      )
        err(
          'RPE',
          feel ? `Kvalitet bez RPE ${dose.zone} (M16).` : 'RPE u planu sa rezultatom.',
          w.index,
          d.date
        );
      if (Math.round(wo.workKm[dose.zone] * 1000) !== dose.doseM)
        err('DOSE', 'Rad u zoni ≠ doza.', w.index, d.date);
      if (doseOf(dose.structure) !== dose.doseM) err('DOSE', 'Struktura ≠ doza.', w.index, d.date);
      const seg = wo.segments;
      const wu = seg[0];
      const cd = seg[seg.length - 1];
      if (
        !wu ||
        wu.kind !== 'warmup' ||
        wu.sec !== wc.warmupSec ||
        to100(wu.km) !== Math.round((wu.sec * 100) / mid)
      )
        err('WARMUP', `Zagrevanje mora biti ${wc.warmupSec / 60} min E (M14).`, w.index, d.date);
      if (
        !cd ||
        cd.kind !== 'cooldown' ||
        cd.sec !== wc.cooldownSec ||
        to100(cd.km) !== Math.round((cd.sec * 100) / mid)
      )
        err('COOLDOWN', `Hlađenje mora biti ${wc.cooldownSec / 60} min E (M14).`, w.index, d.date);
      if (seg.filter((x) => x.kind === 'warmup' || x.kind === 'cooldown').length !== 2)
        err('WARMUP', 'Tačno jedno zagrevanje i jedno hlađenje (M14).', w.index, d.date);
      // M10: najmanja deonica po zoni; MP kontinuirano do 16 km; I 800–1200 m ili piramida; R 200/300/400 m.
      const s = dose.structure;
      const a = P.alternatives;
      const repM = repsOf(s);
      const bad =
        dose.ladder === 'MP_sharpener'
          ? false
          : dose.zone === 'T'
            ? repM.some((m) => m < a.tRepMinM)
            : dose.zone === 'MP'
              ? repM.some((m) => m < a.mpRepMinM) ||
                (s.form === 'continuous' && s.km > a.mpContinuousMaxKm + EPS)
              : dose.zone === 'I'
                ? s.form === 'continuous' ||
                  (s.form === 'reps' &&
                    (s.repM < a.iRepMinM || s.repM > a.iRepMaxM || s.reps > a.iRepsMax)) ||
                  (s.form === 'pyramid' &&
                    (s.repsM.length > a.iRepsMax ||
                      s.repsM.some((m) => m < a.iRepMinM || m > a.iRepMaxM)))
                : s.form !== 'reps' || !a.rRepM.includes(s.repM);
      if (bad) err('REP_MIN', `${dose.zone}: struktura van pravila M10.`, w.index, d.date);
      const reps = seg.filter((x) => x.kind === 'rep');
      const recs = seg.filter((x) => x.kind === 'recovery');
      if (s.form !== 'continuous') {
        const okRec = recs.every((x, i) => {
          const rec = recoveryOf(dose.ladder, repM[i]!, p);
          return 'm' in rec ? to100(x.km) === Math.round(rec.m / 10) : x.sec === rec.sec;
        });
        const okReps = reps.every((x, i) => to100(x.km) === Math.round(repM[i]! / 10));
        if (reps.length !== repM.length || recs.length !== repM.length - 1 || !okRec || !okReps)
          err('RECOVERY', `Oporavak deonica ne odgovara M14 (${dose.ladder}).`, w.index, d.date);
      } else if (recs.length > 0 || reps.length > 0)
        err('RECOVERY', 'Kontinuiran blok nema deonice ni oporavak.', w.index, d.date);
    }

  // --- M12: progresija po slotu kroz ne-rasteretne nedelje izgradnje. Plafon slota: M11 i za MP u izgradnji
  // trajanje ≤ najduži dozvoljeni dugi nedelje (pouka 14, quality.mpFitsLong — ista funkcija kao konstruktor).
  const longTop10 = (b: PlanWeek): number => {
    const prevLongs = weeks.slice(0, b.index - 1).map((x) => {
      const l = x.days.find((d) => d.role === 'long');
      return l ? to10(l.workout.km) : null;
    });
    const jump = longJumpCap10(prevLongs, b.index, input.recentLongRunKm ?? null);
    return Math.min(longCap10(to10(b.targetKm), rule, p), jump ?? Infinity);
  };
  const slotOk = (b: PlanWeek, zone: WorkZone, s: Structure): boolean =>
    doseOf(s) <= capM(zone, b.targetKm) && (zone !== 'MP' || mpFitsLong(s, longTop10(b), p, wc));
  const steady = weeks.filter(isSteady);
  for (const b of steady)
    for (const d of b.days) {
      const dz = d.workout.dose;
      if (dz?.zone === 'MP' && !slotOk(b, 'MP', dz.structure))
        err(
          'MP_LONG_CAP',
          `MP ${dz.doseM} m: kvalitetni dan ${Math.round(d.workout.sec / 60)} min duži od najdužeg dozvoljenog dugog ili > 20 % (M11, pouka 14).`,
          b.index,
          d.date
        );
    }
  const lastOf: Record<'q1' | 'q2', Dose | null> = { q1: null, q2: null };
  let prevMain: PlanWeek | null = null;
  let prevW: PlanWeek | null = null;
  for (const b of steady) {
    for (const role of ['q1', 'q2'] as const) {
      const da = lastOf[role];
      const db = slotDose(b, role);
      if (db) lastOf[role] = db;
      if (!da || !db) continue;
      if (db.step === 'drop') {
        // M11 ispred M12 (i pouka 14 za MP): samo kad nijedna struktura prethodne doze ne staje u plafon slota, na
        // najviši nivo koji staje, uz napomenu.
        const lad = db.ladder as LadderId;
        const best = ladderLevels(lad, beginner)
          .filter((s) => slotOk(b, db.zone, s))
          .map(doseOf)
          .pop();
        const prevFits = structuresForDose(lad, da.doseM).some((s) => slotOk(b, db.zone, s));
        if (prevFits || db.doseM !== best || !b.notes.some((n) => n.includes('spušten sa')))
          err('DOSE_DROP', `${role}: spuštanje doze bez razloga iz plafona (M11/M12).`, b.index);
        else
          warn(
            'DOSE_DROPPED',
            `${role}: doza spuštena ${da.doseM} → ${db.doseM} m (plafon, nijedan cilj nije izvodljiv bez toga).`,
            b.index
          );
        continue;
      }
      if (da.ladder === db.ladder) {
        const ladder = db.ladder as LadderId;
        const nl = nextLevel(ladder, da.doseM, beginner);
        if (db.doseM < da.doseM)
          err('DOSE_DECREASE', `${role}: doza ${db.doseM} m < ${da.doseM} m (M12).`, b.index);
        else if (db.doseM > da.doseM && (!nl || db.doseM !== doseOf(nl)))
          err(
            'DOSE_JUMP',
            `${role}: više od jednog nivoa (${da.doseM} → ${db.doseM} m) (M12).`,
            b.index
          );
        else if (db.doseM === da.doseM) {
          if (nl && slotOk(b, db.zone, nl))
            err(
              'DOSE_STALL',
              `${role}: sledeći nivo ${doseOf(nl)} m staje u plafon, a nije uzet (M12).`,
              b.index
            );
          const others = structuresForDose(ladder, da.doseM).some(
            (x) => !sameStructure(x, da.structure) && slotOk(b, db.zone, x)
          );
          if (sameStructure(da.structure, db.structure) && others)
            err(
              'SLOT_REPEAT',
              `${role}: ista doza iste strukture, a druga struktura postoji (M12).`,
              b.index
            );
        }
      } else if (carries(da.ladder as LadderId, db.ladder as LadderId) && db.doseM < da.doseM)
        err(
          'TRANSITION_DOSE',
          `${role}: ${db.ladder} ${db.doseM} m < poslednje ${da.ladder} ${da.doseM} m (M12).`,
          b.index
        );
    }
    // M16/M17: nedelja testa i uvod (bez kvaliteta) se ne porede (test nije doza).
    if (b.test || !hasQualityWork(b)) continue;
    const dropped = (['q1', 'q2'] as const).some((r) => slotDose(b, r)?.step === 'drop');
    if (prevMain && mainDoseM(b) < mainDoseM(prevMain) && !dropped)
      err(
        'MAIN_DOSE_DECREASE',
        `Glavna doza ${mainDoseM(b)} m < ${mainDoseM(prevMain)} m (M12).`,
        b.index
      );
    prevMain = b;
    if (prevW && qualityKey(prevW) === qualityKey(b))
      err('IDENTICAL_WEEKS', `Isti kvalitet kao nedelja ${prevW.index} (M12).`, b.index);
    // Baza bez platoa (pouka 3): T slot raste ili, kad sledeći nivo ne staje, menja strukturu.
    if (prevW && prevW.phase === 'base' && b.phase === 'base' && !dropped) {
      const ta = slotDose(prevW, tSlot);
      const tb = slotDose(b, tSlot);
      if (ta && tb) {
        const nl = nextLevel(ta.ladder as LadderId, ta.doseM, beginner);
        const blocked = !nl || doseOf(nl) > capM('T', b.targetKm);
        // Doza bez druge strukture (T 1,5 km početnika, M17) sme da se ponovi kad sledeći nivo ne staje.
        const single = !structuresForDose(ta.ladder as LadderId, ta.doseM).some(
          (x) => !sameStructure(x, ta.structure)
        );
        const changed = !sameStructure(ta.structure, tb.structure) || single;
        if (!(tb.doseM > ta.doseM || (blocked && changed)))
          err(
            'BASE_PLATEAU',
            `Baza: T doza ${tb.doseM} m bez rasta ili druge strukture (M12).`,
            b.index
          );
      }
    }
    prevW = b;
  }

  // --- M12: početni nivo (prva nedelja slota; I i MP na prvoj nedelji faze; MP ≥ poslednje I).
  // Početnik (M17): prvi nivo lestvice početnika (60 % plafona ne važi).
  const startM = (ladder: LadderId, targetKm: number): number => {
    const cap = capM(zoneOf(ladder), targetKm);
    const lv = ladderLevels(ladder, beginner).map(doseOf);
    if (beginner) return lv[0]!;
    return lv.filter((m) => m <= P.startLevel.capShare * cap + EPS).pop() ?? lv[0]!;
  };
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
      let wantM = startM(ladder, b.targetKm);
      // Pouka 14: početni nivo MP koji ne staje u trajanje dugog → najviši nivo ispod njega koji staje.
      const startS = ladderLevels(ladder, beginner).find((s) => doseOf(s) === wantM);
      if (startS && !slotOk(b, zoneOf(ladder), startS))
        wantM =
          ladderLevels(ladder, beginner)
            .filter((s) => doseOf(s) <= wantM && slotOk(b, zoneOf(ladder), s))
            .map(doseOf)
            .pop() ?? wantM;
      if (da && carry) {
        const lv = ladderLevels(ladder)
          .map(doseOf)
          .find((m) => m >= Math.max(wantM, da.doseM));
        const lvS = ladderLevels(ladder).find((s) => doseOf(s) === lv);
        if (lv === undefined || !lvS || !slotOk(b, zoneOf(ladder), lvS)) continue;
        wantM = lv;
      }
      if (db.doseM !== wantM)
        err(
          'START_LEVEL',
          `${role}: početni nivo ${ladder} ${db.doseM} m ≠ ${wantM} m (≤ 60 % plafona, M12).`,
          b.index
        );
    }

  // --- M13a (pouka 28): dugi svake nedelje ≤ max(1,1 × L; L + 1,0), L = najduži dugi prethodne 4 nedelje
  // (skorašnji najduži = nedelja 0); bez ulaza napomena nedelje 1 sa pragom.
  const recent = input.recentLongRunKm ?? null;
  const longs10 = weeks.map((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? to10(l.workout.km) : null;
  });
  weeks.forEach((w, i) => {
    const l10 = longs10[i];
    if (l10 === null || l10 === undefined) return;
    const jump = longJumpCap10(longs10.slice(0, i), w.index, recent);
    if (jump !== null && l10 > jump)
      err(
        'LONG_JUMP',
        `Dugi ${l10 / 10} km > max(1,1 × L; L + 1,0) = ${jump / 10} km (M13a).`,
        w.index
      );
    const bound =
      jump !== null && l10 === jump && isSteady(w) && jump < longCap10(to10(w.targetKm), rule, p);
    const note =
      jump !== null &&
      w.notes.includes(longJumpNote(l10, jumpBase10(longs10.slice(0, i), w.index, recent)!));
    if (bound && !note) err('LONG_JUMP', 'Dugi na plafonu skoka bez napomene (M13a).', w.index);
  });
  const w1 = weeks[0]!;
  const long1 = w1.days.find((d) => d.role === 'long');
  const jump1 = longJumpCap10([], 1, recent);
  if (long1 && recent === null && !w1.notes.includes(recentLongNote(to10(long1.workout.km))))
    err('RECENT_LONG', 'Ned 1 bez napomene praga skorašnjeg najdužeg trka (M13a).', 1);

  // --- M6: obim. Ned 1 = trenutni obim (ispod samo uz dugi na 150 min, pouka 9); izgradnja po pravilu ili
  // najbliži izvodljiv cilj (napomena); rasterećenje 0,8 ×, taper 0,8 / 0,6 × vrh samo naniže; vrh.
  const start10 = startKm10(input.currentWeeklyKm);
  const cap10 = peakCap10(start10, rule);
  let lastBuild10: number | null = null;
  let peak10 = 0;
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    const t10 = to10(w.targetKm);
    const step = taperStep(phases, w.index);
    const nominal =
      step !== null
        ? Math.round(P.taper.weeks[step]!.factor * peak10)
        : lastBuild10 === null
          ? start10
          : w.deload
            ? Math.round(P.deload.factor * lastBuild10)
            : Math.min(lastBuild10 + growth10(lastBuild10, rule), cap10);
    if (to10(w.nominalKm) !== nominal)
      err(
        'VOLUME_RULE',
        `Cilj po pravilu ${w.nominalKm} km ≠ ${nominal / 10} km (M5, M6, M7).`,
        w.index
      );
    const fittedNote = w.notes.some((n) => n.includes('najbliži izvodljiv cilj'));
    if (
      t10 === nominal
        ? w.fitted !== null
        : w.fitted !== (t10 < nominal ? 'down' : 'up') || !fittedNote
    )
      err(
        'VOLUME_FIT',
        `Cilj ${w.targetKm} km ≠ pravilo ${nominal / 10} km bez oznake i napomene (M6).`,
        w.index
      );
    if ((w.deload || step !== null || w.index === 1) && t10 > nominal)
      err(
        'VOLUME_FIT',
        `Cilj ${w.targetKm} km > ${nominal / 10} km (smanjenje ne raste, M5/M7; ned 1 = obim, M6).`,
        w.index
      );
    if (isSteady(w) && t10 > cap10)
      err(
        'VOLUME_PEAK',
        `Cilj ${w.targetKm} km > granica izgradnje ${cap10 / 10} km (M6).`,
        w.index
      );
    if (w.index === 1 && t10 < start10) {
      const long = w.days.find((d) => d.role === 'long');
      const l10 = long ? to10(long.workout.km) : null;
      if (l10 === null || (l10 !== longTimeCap10(p) && l10 !== jump1))
        err(
          'VOLUME_START',
          `Ned 1 ${w.targetKm} km < trenutni obim bez dugog na ${P.lengths.longMaxSec / 60} min ili na pragu skorašnjeg najdužeg (M6, pouke 9 i 28).`,
          1
        );
    }
    if (isSteady(w)) {
      lastBuild10 = t10;
      peak10 = Math.max(peak10, t10);
    }
  }
  if (
    to10(plan.peakKm) !== peak10 ||
    to10(plan.peakCapKm) !== cap10 ||
    to10(plan.startKm) !== start10
  )
    err('VOLUME_PEAK', 'Vrh, granica izgradnje ili start ≠ M6.');
  const limited = capacityWeeks(weeks, rule, p, recent).length > 0;
  if (limited) {
    const msg = capacityMessage(input.runDays.length, rule, capacityLimits(weeks, rule, p, recent));
    if (!plan.notes.some((n) => n.startsWith(msg)))
      err('CAPACITY_NOTE', 'Spuštena nedelja izgradnje bez napomene kapaciteta (M6).');
    warn('CAPACITY_LIMITED', msg);
  }

  // --- M5 sadržaj rasterećenja, M7 taper (doze iz poslednje ne-rasteretne nedelje izgradnje).
  let last: Record<'q1' | 'q2', Dose | null> = { q1: null, q2: null };
  /** M5: poslednja doza u zoni T iz ne-rasteretne nedelje izgradnje. */
  let lastT = 0;
  let lastLong10: number | null = null;
  let longest10 = 0;
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    const nQuality = w.days.filter((d) => d.workout.kind === 'quality').length;
    if (w.deload) {
      const t = slotDose(w, tSlot);
      // M17: najmanja T doza rasterećenja početnika 1,5 km.
      const minM = Math.round((beginner ? P.beginner.tFirstKm : P.deload.tMinKm) * 1000);
      const wantT = expectedReduced(deloadLadder(w.phase), lastT, P.deload.tShare, minM, beginner);
      // M16: u nedelji testa test zamenjuje kvalitet rasterećenja (TEST proverava dan).
      if (w.test ? nQuality !== 0 : nQuality !== 1 || !t || t.zone !== 'T' || t.doseM !== wantT)
        err(
          'DELOAD_CONTENT',
          w.test
            ? 'Rasterećenje sa testom: bez kvaliteta (M16).'
            : `Rasterećenje: 1 kvalitet T ${wantT} m (≈ 60 % od ${lastT} m, min ${minM / 1000} km) (M5, M17).`,
          w.index
        );
      if (long && lastLong10 !== null) {
        // Dužine rasterećenja iz JEDINE funkcije (lengths.deloadLengths, pouka 24): 0,8 × poslednji dugi (M5),
        // skraćen samo u nedelji testa (M16) i kod početnika (M17) kad lagani ne bi bili ≥ 5 km (odstupanje).
        const i = w.index - 1;
        const prevLongs = weeks.slice(0, i).map((x) => {
          const l = x.days.find((d) => d.role === 'long');
          return l ? to10(l.workout.km) : null;
        });
        const q100 = w.days
          .filter((d) => d.workout.kind === 'quality' || d.workout.kind === 'test')
          .reduce((a, d) => a + to100(d.workout.km), 0);
        const len = deloadLengths(
          to10(w.targetKm),
          q100,
          w.days.filter((d) => d.role === 'easy').length,
          lastLong10,
          rule,
          p,
          longJumpCap10(prevLongs, w.index, input.recentLongRunKm ?? null),
          w.test === true || beginner
        );
        const note = w.notes.some((n) => n.includes('skraćen sa 0,8 ×'));
        if (!len || to10(long.workout.km) !== len.long10 || note !== (len.shortened === true))
          err(
            'DELOAD_LONG',
            `Dugi rasterećenja ${long.workout.km} km ≠ ${len ? len.long10 / 10 : '—'} km (M5; skraćen samo M16/M17, uz napomenu).`,
            w.index
          );
        if (len?.shortened)
          warn(
            'DELOAD_LONG_SHORTENED',
            `Rasterećenje: dugi ${long.workout.km} km < 0,8 × poslednji da lagani ostanu ≥ ${P.lengths.easyMinKm} km (${w.test ? 'M16' : 'M17'} ispred M5).`,
            w.index
          );
      }
    }
    const step = taperStep(phases, w.index);
    if (step !== null) {
      const tw = P.taper.weeks[step]!;
      const mp = slotDose(w, 'q1');
      const t = slotDose(w, 'q2');
      // Doza tapera iz JEDINE funkcije (quality.taperDoses, pouka 24) nad poslednjim dozama izgradnje.
      const want = taperDoses(
        { q1: slotOf(last.q1), q2: slotOf(last.q2), t: lastT },
        step,
        rule.quality,
        beginner
      );
      if (!want.mp) {
        // M17: početnik u N−1 — jedini kvalitet T kontinuirano na danu Q1, bez MP (staje u plafon T).
        const wantT1 = doseOf(want.t!);
        if (
          !mp ||
          mp.zone !== 'T' ||
          mp.ladder !== want.tLadder ||
          mp.doseM !== wantT1 ||
          wantT1 > capM('T', w.targetKm) ||
          t
        )
          err('TAPER_QUALITY', `Taper N−1 početnika: T kont. ${wantT1} m, bez MP (M17).`, w.index);
      }
      const wantMp = want.mp ? doseOf(want.mp) : 0;
      const wantT = want.t === null ? null : doseOf(want.t);
      const tFits = wantT !== null && wantT <= capM('T', w.targetKm);
      const okMp = !!mp && mp.zone === 'MP' && mp.doseM === wantMp;
      const okT = tFits ? !!t && t.zone === 'T' && t.doseM === wantT : !t;
      if (want.mp && (!okMp || !okT))
        err(
          'TAPER_QUALITY',
          `Taper N−${2 - step}: MP ${wantMp} m${wantT === null ? ', bez T' : `, T ${tFits ? `${wantT} m` : 'otpada (plafon)'}`} (M7, M7a, M11).`,
          w.index
        );
      else if (want.mp && wantT !== null && !tFits) {
        if (!w.notes.some((n) => n.includes('M11 ispred M7')))
          err('TAPER_QUALITY', 'T tapera otpao bez napomene (M11 ispred M7).', w.index);
        warn(
          'TAPER_ZONE_DROPPED',
          `Taper N−${2 - step}: T ${wantT} m > plafon ${capM('T', w.targetKm)} m — T otpada (M11 ispred M7).`,
          w.index
        );
      }
      if (want.mp && okMp && wantMp > capM('MP', w.targetKm)) {
        if (!w.notes.some((n) => n.includes('(M7a)')))
          err('TAPER_QUALITY', 'MP tapera iznad plafona bez napomene (M7a).', w.index);
        warn(
          'TAPER_MP_OVER_CAP',
          `Taper N−${2 - step}: MP ${wantMp} m > 20 % cilja ${w.targetKm} km — minimum tapera ispred plafona (M7a).`,
          w.index
        );
      }
      if (long && to10(long.workout.km) > Math.floor(tw.longFactor * longest10 + 1e-9))
        err(
          'TAPER_LONG',
          `Dugi tapera ${long.workout.km} km > ${tw.longFactor} × najduži ${longest10 / 10} km (M7).`,
          w.index
        );
      if (w.days.length !== input.runDays.length)
        err(
          'TAPER_DAYS',
          `Taper zadržava svih ${input.runDays.length} dana trčanja (M7).`,
          w.index
        );
    }
    if (long) longest10 = Math.max(longest10, to10(long.workout.km));
    if (isSteady(w)) {
      last = { q1: slotDose(w, 'q1') ?? last.q1, q2: slotDose(w, 'q2') ?? last.q2 };
      const t = [slotDose(w, 'q1'), slotDose(w, 'q2')].filter((d) => d?.zone === 'T').pop();
      if (t) lastT = t.doseM;
      if (long) lastLong10 = to10(long.workout.km);
    }
  }

  // --- M16: test 5 km — samo plan po osećaju koji nije početnik (M17); tačno jedan, u poslednjoj nedelji baze,
  // na danu Q1 (u rasterećenju na danu T slota); WU/CD (M14) + 5 km; računa se u obim, nije doza.
  const wantTest = feel && rule.feelTest;
  const testWeek = phases.lastIndexOf('base') + 1;
  const tests = weeks.flatMap((w) =>
    w.days.filter((d) => d.role === 'test' || d.workout.kind === 'test').map((d) => ({ w, d }))
  );
  const flagged = weeks.filter((w) => w.test);
  if (!wantTest) {
    if (tests.length > 0 || flagged.length > 0)
      err('TEST', beginner ? 'Početnik nema test (M17).' : 'Test samo u planu po osećaju (M16).');
  } else {
    if (
      tests.length !== 1 ||
      flagged.length !== 1 ||
      flagged[0]!.index !== testWeek ||
      tests[0]!.w.index !== testWeek
    )
      err(
        'TEST',
        `Test ${P.test.km} km tačno jednom, u poslednjoj nedelji baze (${testWeek}) (M16).`
      );
    for (const { w, d } of tests) {
      const wd = w.deload && tSlot === 'q2' ? pat.q2 : pat.q1;
      const k = d.workout.segments;
      const ts = k.find((x) => x.kind === 'test');
      const okSeg =
        k.length === 3 &&
        k[0]!.kind === 'warmup' &&
        k[0]!.sec === wc.warmupSec &&
        k[2]!.kind === 'cooldown' &&
        k[2]!.sec === wc.cooldownSec &&
        !!ts &&
        ts.km === P.test.km &&
        ts.sec === raceTimeForVdot(p.vdot, P.test.km * 1000);
      if (
        d.role !== 'test' ||
        d.workout.kind !== 'test' ||
        d.weekday !== wd ||
        !d.countsToWeek ||
        !d.hard ||
        d.workout.dose !== null ||
        ZONES.some((z) => d.workout.workKm[z] !== 0) ||
        !okSeg
      )
        err(
          'TEST',
          `Test: dan ${wd}, WU ${wc.warmupSec / 60} min + ${P.test.km} km + CD ${wc.cooldownSec / 60} min, u obimu, bez doze (M16).`,
          w.index,
          d.date
        );
      if (!w.notes.some((n) => n.startsWith(`Test ${P.test.km} km (M16)`)))
        err('TEST', 'Nedelja testa bez napomene (M16).', w.index);
    }
  }
  if (feel && !plan.notes.some((n) => n.startsWith('Plan po osećaju (M16)')))
    err('PACE_BASIS', 'Plan po osećaju bez napomene (M16).');

  // --- M17: uvod bez kvaliteta (ned 1–2); nedelja izgradnje početnika bez kvaliteta samo kad ni T 1,5 km ne
  // staje u plafon (ROLES proverava dane).
  for (const w of weeks) {
    if (!isSteady(w) || w.test || hasQualityWork(w) || rule.quality !== 1) continue;
    if (w.index <= rule.introWeeks) {
      if (!w.notes.some((n) => n.startsWith('Uvod (M17)')))
        err('INTRO', 'Uvod bez napomene (M17).', w.index);
    } else
      warn(
        'BUILD_NO_QUALITY',
        `Nedelja ${w.index}: ni T ${P.beginner.tFirstKm} km ne staje u plafon ${P.caps.T * 100} % (M11 ispred M17).`,
        w.index
      );
  }
  // --- M8 trkačka nedelja.
  const rw = weeks[N - 1]!;
  const lastTaper = weeks[N - 2];
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
        k.length !== 2 ||
        !raceSeg ||
        raceSeg.km !== q.raceKm ||
        k[0]?.kind !== 'warmup' ||
        k[0].sec !== q.raceWarmupSec ||
        raceSeg.sec !== predictedMarathon(p)
      )
        err(
          'RACE_DAY',
          `Trka: ${q.raceKm} km + WU ${q.raceWarmupSec / 60} min, van obima (M8).`,
          rw.index,
          rd.date
        );
    }
    // Dana sa trkom = min(broj dana, 5); otpada prvo dan dugog, pa najraniji lagan dan šablona.
    const inWeek = (wd: string): string =>
      Array.from({ length: 7 }, (_, i) => isoAdd(rw.startDate, i)).find(
        (d) => weekdayOf(d) === wd
      )!;
    const runs = input.runDays
      .map(inWeek)
      .filter((d) => d !== race)
      .sort();
    const keep = Math.min(input.runDays.length, q.maxRunDays) - 1;
    const dropOrder = [inWeek(pat.long), ...pat.easy.map(inWeek).sort()].filter((d) =>
      runs.includes(d)
    );
    const dropped = dropOrder.slice(0, Math.max(0, runs.length - keep));
    const wantDays = runs.filter((d) => !dropped.includes(d));
    const others = rw.days.filter((d) => d.role !== 'race');
    if (JSON.stringify(others.map((d) => d.date).sort()) !== JSON.stringify(wantDays))
      err(
        'RACE_WEEK',
        `Trkačka nedelja: dani ${others.map((d) => d.weekday).join(', ')} ≠ M8.`,
        rw.index
      );
    const taperMpM =
      lastTaper?.days.map((d) => d.workout.dose).find((x) => x?.zone === 'MP')?.doseM ?? 0;
    const taperEasy10 = Math.min(
      ...(lastTaper?.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km)) ?? [])
    );
    const prevHard = lastTaper?.days.filter((d) => d.hard).pop()?.date ?? null;
    const s = q.sharpener;
    const sharp = others.filter((d) => d.role === 'sharpener');
    const canSharpen = taperMpM >= s.reps * s.repM;
    const cand = canSharpen
      ? [...wantDays]
          .reverse()
          .find(
            (d) =>
              daysBetween(d, race) >= q.sharpenerMinGapDays &&
              (prevHard === null || daysBetween(prevHard, d) >= 2)
          )
      : undefined;
    if (cand === undefined ? sharp.length !== 0 : sharp.length !== 1 || sharp[0]!.date !== cand)
      err(
        'RACE_SHARPENER',
        `Oštrenje ${cand ?? 'nema'} (≥ ${q.sharpenerMinGapDays} dana pre trke, nesusedno taperu, ≤ MP doza N−1 ${taperMpM} m) (M8).`,
        rw.index
      );
    for (const d of sharp) {
      const dz = d.workout.dose;
      if (
        !dz ||
        dz.structure.form !== 'reps' ||
        dz.structure.reps !== s.reps ||
        dz.structure.repM !== s.repM ||
        dz.doseM > taperMpM
      )
        err(
          'RACE_SHARPENER',
          `Oštrenje ${s.reps} × ${s.repM} m MP ≤ MP doza N−1 (M8).`,
          rw.index,
          d.date
        );
    }
    for (const d of others) {
      if (d.role === 'sharpener') continue;
      if (daysBetween(d.date, race) === 1) {
        const st = q.eveStrides;
        const k = d.workout.segments;
        if (
          d.role !== 'eve' ||
          k[0]?.sec !== q.eveEasySec ||
          k.filter((x) => x.kind === 'stride').length !== st.reps ||
          k.some((x) => x.kind === 'stride' && x.sec !== st.sec) ||
          d.workout.sec > q.eveMaxSec
        )
          err(
            'RACE_EVE',
            `Dan pred trku: ${q.eveEasySec / 60} min E + ${st.reps} × ${st.sec} s, ≤ ${q.eveMaxSec / 60} min (M8).`,
            rw.index,
            d.date
          );
        continue;
      }
      // Lagan = min(30 min E, najkraći lagan N−1); kraći se zadaje u km.
      const timed = Math.round((q.otherEasySec * 100) / mid);
      const wantKm100 = Math.min(timed, taperEasy10 * 10);
      if (d.role !== 'easy' || to100(d.workout.km) !== wantKm100)
        err(
          'RACE_WEEK_EASY',
          `Lagan trkačke nedelje ${d.workout.km} km ≠ min(${q.otherEasySec / 60} min E, lagan N−1) (M8).`,
          rw.index,
          d.date
        );
    }
    if (lastTaper && rw.plannedKm > lastTaper.plannedKm + EPS)
      err(
        'RACE_WEEK_OVER_TAPER',
        `Trkačka nedelja ${rw.plannedKm} km > poslednja nedelja tapera ${lastTaper.plannedKm} km (M8, pouka 5).`,
        rw.index
      );
    if (to10(rw.targetKm) !== Math.round(to100(rw.plannedKm) / 10))
      err('RACE_WEEK', 'Cilj trkačke nedelje = planirano (M8).', rw.index);
  }

  return out;
}

type Violation = MarathonV2Plan['warnings'][number];
