/* Provera plana prema policy.ts (M1–M15). SAMO prijavljuje prekršaje; plan se nikad ne menja i nema petlji
   skraćivanja. Greške obaraju plan (generate.ts → PLAN_VIOLATES_POLICY); upozorenja idu u plan. Svaka odluka
   generatora ima ovde nezavisnu proveru (pravilo se ponovo računa iz ulaza i politike). */

import { addDays as isoAdd, daysBetween, mustDay, weekdayOf } from './dates.ts';
import { checkInput } from './input.ts';
import { longCap10, longTimeCap10 } from './lengths.ts';
import { assessGoal, midEasy, pacesFromVdot, predictedMarathon } from './paces.ts';
import {
  buildAllowed,
  deloadAllowed,
  firstOfPhase,
  isBuildPhase,
  phasesOf,
  taperStep
} from './periodize.ts';
import { dayRule, MARATHON_V2_POLICY as P } from './policy.ts';
import { capM, carries, deloadLadder, nextLevel, type SlotState, taperDoses } from './quality.ts';
import { adjacentDays } from './schedule.ts';
import type {
  DayRole,
  Dose,
  LadderId,
  MarathonV2Plan,
  Phase,
  PlanWeek,
  QualityType,
  WorkZone
} from './types.ts';
import { capacityLimits, capacityMessage, growth10, peakCap10, startKm10 } from './volume.ts';
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
const PHASES: readonly Phase[] = ['base', 'development', 'specific', 'taper', 'race'];
const HARD: readonly DayRole[] = ['q1', 'q2', 'long', 'sharpener', 'race'];
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

const isSteady = (w: PlanWeek): boolean => isBuildPhase(w.phase) && !w.deload;
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

/** ≈ share × poslednja doza, najviši nivo lestvice naniže; ispod najnižeg → floor (M5). */
function expectedReduced(ladder: LadderId, lastM: number, share: number, floorM: number): number {
  const lv = ladderLevels(ladder)
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
  const rule = dayRule(input.runDays.length);
  if (!rule) {
    err('RUN_DAYS', `Broj dana ${input.runDays.length} nije u tabeli M15.`);
    return out;
  }
  const chk = checkInput(input);
  if (!chk.ok) {
    err('INPUT', `Ulaz plana nije ispravan (M1): ${chk.reasons.map((r) => r.code).join(', ')}.`);
    return out;
  }

  // --- Uslov 6: oznaka politike.
  if (plan.policyId !== P.id || plan.policyVersion !== P.version)
    err('POLICY_STAMP', `Plan mora nositi ${P.id}/${P.version}.`);

  // --- M2: tempo iz rezultata (korekcija obima za MP); M3: ocena cilja.
  const want = pacesFromVdot(chk.vdotRaw, input.currentWeeklyKm);
  if (JSON.stringify(want) !== JSON.stringify(p))
    err('PACES', 'Tempo ≠ M2 (VDOT iz rezultata, MP iz VDOT-a umanjenog za korekciju obima).');
  if (plan.vdot !== want.vdot || plan.predictedMarathonSec !== predictedMarathon(want))
    err('PACES', 'VDOT ili prognoza maratona ≠ M2.');
  const goal = input.goalTimeSec ? assessGoal(want.mpVdot, input.goalTimeSec, N) : null;
  if (JSON.stringify(goal) !== JSON.stringify(plan.goal)) err('GOAL', 'Ocena cilja ≠ M3.');
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
  if (
    adjacentDays(pat.q1, pat.long) ||
    adjacentDays(pat.q1, pat.q2) ||
    adjacentDays(pat.q2, pat.long)
  )
    err('HARD_ADJACENT', 'Šablon ima susedne zahtevne dane (M9).');
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    const has = (r: DayRole): boolean => w.days.some((d) => d.role === r);
    // Rasterećenje: samo Q2 (T); taper: Q1 (MP) i Q2 (T, samo N−2) kad postoje (M7, odstupanje M11 ispred M7).
    const roleOf = (r: 'q1' | 'q2'): DayRole =>
      w.deload ? (r === 'q2' ? 'q2' : 'easy') : w.phase === 'taper' && !has(r) ? 'easy' : r;
    const exp = [
      `${roleOf('q1')}@${pat.q1}`,
      `${roleOf('q2')}@${pat.q2}`,
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
  if (longestKm + EPS < P.lengths.longShortKm) {
    const timeCapped = weeks.some((w) =>
      w.days.some(
        (d) =>
          d.role === 'long' && d.workout.km === longestKm && to10(d.workout.km) === longTimeCap10(p)
      )
    );
    warn(
      'MARATHON_LONG_SHORT',
      `Najduži dugi trk u planu je ${String(longestKm).replace('.', ',')} km; za maraton se preporučuje bar ${P.lengths.longShortKm} km (M13). ` +
        (timeCapped
          ? `Ograničava ga trajanje (≤ ${P.lengths.longMaxSec / 60} min laganim tempom) — namerna granica opterećenja; ostatak obima nose ostali dani.`
          : `Ograničava ga udeo dugog (≤ ${Math.round(rule.longMaxShare * 100)} % nedelje sa ${input.runDays.length} dana): veći nedeljni obim ili više dana trčanja (od segmenta 02) daju duži dugi trk.`)
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
    return q > long.workout.sec ? [{ w: w.index, q, long: long.workout.sec }] : [];
  });
  if (longer.length > 0) {
    const f = longer[0]!;
    warn(
      'LONG_SHORTER_THAN_QUALITY',
      `Kvalitetni dan duži od dugog po trajanju u ${longer.length} od ${weeks.filter(isSteady).length} nedelja izgradnje (ned ${f.w}: ${Math.round(f.q / 60)} > ${Math.round(f.long / 60)} min; pouka 14).`,
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
  const wc = P.workout.warmupCooldown.filter((b) => to10(b.fromKm) <= km10).pop()!;
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
        if (d.role !== 'q2' || dose.ladder !== lad)
          err(
            'PHASE_QUALITY',
            `Rasterećenje: jedini kvalitet je T (${lad}) na danu Q2 (M5).`,
            w.index,
            d.date
          );
      } else {
        const role = d.role === 'q1' || d.role === 'q2' ? d.role : null;
        if (!role || !wo.qualityType || !SLOT_TYPES[w.phase][role].includes(wo.qualityType))
          err(
            'PHASE_QUALITY',
            `${wo.qualityType} ne pripada fazi ${w.phase} (${d.role}) (M10).`,
            w.index,
            d.date
          );
      }
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
                    (s.repM < a.iRepMinM || s.repM > a.iRepMaxM || s.reps > a.iRepsMax))
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

  // --- M12: progresija po slotu kroz ne-rasteretne nedelje izgradnje.
  const steady = weeks.filter(isSteady);
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
        // M11 ispred M12: samo kad prethodna doza ne staje u plafon, na najviši nivo koji staje, uz napomenu.
        const cap = capM(db.zone, b.targetKm);
        const best = ladderLevels(db.ladder as LadderId)
          .map(doseOf)
          .filter((m) => m <= cap)
          .pop();
        if (da.doseM <= cap || db.doseM !== best || !b.notes.some((n) => n.includes('spušten sa')))
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
        const nl = nextLevel(ladder, da.doseM);
        if (db.doseM < da.doseM)
          err('DOSE_DECREASE', `${role}: doza ${db.doseM} m < ${da.doseM} m (M12).`, b.index);
        else if (db.doseM > da.doseM && (!nl || db.doseM !== doseOf(nl)))
          err(
            'DOSE_JUMP',
            `${role}: više od jednog nivoa (${da.doseM} → ${db.doseM} m) (M12).`,
            b.index
          );
        else if (db.doseM === da.doseM) {
          if (nl && doseOf(nl) <= capM(db.zone, b.targetKm))
            err(
              'DOSE_STALL',
              `${role}: sledeći nivo ${doseOf(nl)} m staje u plafon, a nije uzet (M12).`,
              b.index
            );
          const others = structuresForDose(ladder, da.doseM).some(
            (x) => !sameStructure(x, da.structure)
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
      const ta = slotDose(prevW, 'q2');
      const tb = slotDose(b, 'q2');
      if (ta && tb) {
        const nl = nextLevel(ta.ladder as LadderId, ta.doseM);
        const blocked = !nl || doseOf(nl) > capM('T', b.targetKm);
        if (!(tb.doseM > ta.doseM || (blocked && !sameStructure(ta.structure, tb.structure))))
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
  const startM = (ladder: LadderId, targetKm: number): number => {
    const cap = capM(zoneOf(ladder), targetKm);
    const lv = ladderLevels(ladder).map(doseOf);
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
      if (da && carry) {
        const lv = ladderLevels(ladder)
          .map(doseOf)
          .find((m) => m >= Math.max(wantM, da.doseM));
        if (lv === undefined || lv > capM(zoneOf(ladder), b.targetKm)) continue;
        wantM = lv;
      }
      if (db.doseM !== wantM)
        err(
          'START_LEVEL',
          `${role}: početni nivo ${ladder} ${db.doseM} m ≠ ${wantM} m (≤ 60 % plafona, M12).`,
          b.index
        );
    }

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
            : Math.min(lastBuild10 + growth10(lastBuild10), cap10);
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
      if (!long || to10(long.workout.km) !== longTimeCap10(p))
        err(
          'VOLUME_START',
          `Ned 1 ${w.targetKm} km < trenutni obim bez dugog na ${P.lengths.longMaxSec / 60} min (M6, pouka 9).`,
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
  const limited = weeks.some((w) => isSteady(w) && w.fitted === 'down');
  if (limited) {
    const msg = capacityMessage(input.runDays.length, rule, capacityLimits(weeks, rule, p));
    if (!plan.notes.some((n) => n.startsWith(msg)))
      err('CAPACITY_NOTE', 'Spuštena nedelja izgradnje bez napomene kapaciteta (M6).');
    warn('CAPACITY_LIMITED', msg);
  }

  // --- M5 sadržaj rasterećenja, M7 taper (doze iz poslednje ne-rasteretne nedelje izgradnje).
  let last: Record<'q1' | 'q2', Dose | null> = { q1: null, q2: null };
  let lastLong10: number | null = null;
  let longest10 = 0;
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    const nQuality = w.days.filter((d) => d.workout.kind === 'quality').length;
    if (w.deload) {
      const t = slotDose(w, 'q2');
      const wantT = expectedReduced(
        deloadLadder(w.phase),
        last.q2?.doseM ?? 0,
        P.deload.tShare,
        Math.round(P.deload.tMinKm * 1000)
      );
      if (nQuality !== 1 || !t || t.zone !== 'T' || t.doseM !== wantT)
        err(
          'DELOAD_CONTENT',
          `Rasterećenje: 1 kvalitet T ${wantT} m (≈ 60 % od ${last.q2?.doseM ?? 0} m, min 2,0 km) (M5).`,
          w.index
        );
      if (long && lastLong10 !== null) {
        const want10 = Math.min(
          Math.floor(P.deload.longFactor * lastLong10 + 1e-9),
          longCap10(to10(w.targetKm), rule, p)
        );
        if (to10(long.workout.km) !== want10)
          err(
            'DELOAD_LONG',
            `Dugi rasterećenja ${long.workout.km} km ≠ ${want10 / 10} km (M5).`,
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
      const want = taperDoses({ q1: slotOf(last.q1), q2: slotOf(last.q2) }, step);
      const wantMp = doseOf(want.mp);
      const wantT = want.t === null ? null : doseOf(want.t);
      const tFits = wantT !== null && wantT <= capM('T', w.targetKm);
      const okMp = !!mp && mp.zone === 'MP' && mp.doseM === wantMp;
      const okT = tFits ? !!t && t.zone === 'T' && t.doseM === wantT : !t;
      if (!okMp || !okT)
        err(
          'TAPER_QUALITY',
          `Taper N−${2 - step}: MP ${wantMp} m${wantT === null ? ', bez T' : `, T ${tFits ? `${wantT} m` : 'otpada (plafon)'}`} (M7, M7a, M11).`,
          w.index
        );
      else if (wantT !== null && !tFits) {
        if (!w.notes.some((n) => n.includes('M11 ispred M7')))
          err('TAPER_QUALITY', 'T tapera otpao bez napomene (M11 ispred M7).', w.index);
        warn(
          'TAPER_ZONE_DROPPED',
          `Taper N−${2 - step}: T ${wantT} m > plafon ${capM('T', w.targetKm)} m — T otpada (M11 ispred M7).`,
          w.index
        );
      }
      if (okMp && wantMp > capM('MP', w.targetKm)) {
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
      if (long) lastLong10 = to10(long.workout.km);
    }
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
