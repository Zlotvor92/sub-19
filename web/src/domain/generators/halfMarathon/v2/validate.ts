/* Provera plana prema policy.ts (H1–H15, HI*). SAMO prijavljuje prekršaje; plan se nikad ne menja i nema
   petlji skraćivanja (Uslov 1). Greške obaraju plan (generate.ts → PLAN_VIOLATES_POLICY); upozorenja idu u
   plan. Svaka odluka konstruktora ima proveru ovde (rule = kod prekršaja). Veličine koje koriste i
   konstruktor i validator (cilj po pravilu, minimum nedelje, dugi rasterećenja/tapera, doza rasterećenja i
   tapera, dan oštrenja) imaju JEDNU funkciju (pouka 24). */

import { daysBetween, mustDay, weekdayOf } from './dates.ts';
import {
  deloadLong10,
  EASY_MIN10,
  longCap10,
  longShareCap10,
  longTimeCap10,
  taperLongCap10
} from './lengths.ts';
import { assessGoal, midEasy, pacesFromVdot, raceTimeForVdot, vdotFromResult } from './paces.ts';
import {
  buildAllowed,
  deloadAllowed,
  deloadWeeks,
  firstOfPhase,
  isBuildPhase,
  phasesOf
} from './periodize.ts';
import { dayRule, HM_V2_POLICY as P } from './policy.ts';
import {
  capM,
  carries,
  deloadDose,
  deloadLadder,
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
import { HARD_ROLES, raceWeekRuns, sharpenerAllowed, sharpenerDate } from './week.ts';
import {
  doseOf,
  ladderLevels,
  recoveryOf,
  repsOf,
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

/** H10: dozvoljeni tipovi kvaliteta po fazi i slotu (druga struktura: T kontinuirano ↔ deonice; RP
    kontinuirano je tip RP). */
const SLOT_TYPES: Readonly<
  Record<Phase, { q1: readonly QualityType[]; q2: readonly QualityType[] }>
> = {
  base: { q1: ['R'], q2: ['T_continuous', 'T_cruise'] },
  development: { q1: ['I'], q2: ['T_cruise', 'T_continuous'] },
  specific: { q1: ['RP'], q2: ['T_cruise', 'T_continuous'] },
  taper: { q1: ['RP'], q2: ['T_cruise', 'T_continuous'] },
  race: { q1: [], q2: [] }
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
  const rule = dayRule(input.runDays.length);
  if (!rule) {
    err('RUN_DAYS', `Broj dana ${input.runDays.length} nije u tabeli H15.`);
    return out;
  }
  const pat = plan.pattern;

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

  // --- H9: uloge dana po šablonu. Rasterećenje: samo Q2 (T) ili bez kvaliteta (odstupanje H5); taper:
  // Q1 (RP) i Q2 (T), samo RP ili bez kvaliteta (odstupanje H7); ostali dani šablona lagani.
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    const has = (r: DayRole): boolean => w.days.some((d) => d.role === r);
    const roleOf = (r: 'q1' | 'q2'): DayRole => {
      if (w.deload) return r === 'q2' && has('q2') ? 'q2' : 'easy';
      if (w.phase === 'taper') return has(r) ? r : 'easy';
      return r;
    };
    const want = [
      `${roleOf('q1')}@${pat.q1}`,
      `${roleOf('q2')}@${pat.q2}`,
      `long@${pat.long}`,
      ...pat.easy.map((wd) => `easy@${wd}`)
    ].sort();
    const got = w.days.map((d) => `${d.role}@${d.weekday}`).sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      err('ROLES', `Dani ${got.join(', ')} ≠ šablon ${want.join(', ')} (H9).`, w.index);
    if (w.deload && has('q1')) err('ROLES', 'Rasterećenje ima samo T kvalitet (H5).', w.index);
  }

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
    adjacentDays(pat.q1, pat.q2) ||
    adjacentDays(pat.q2, pat.long)
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
    if (long.workout.km * p.E.slow > P.lengths.longMaxSec + EPS)
      err(
        'LONG_DURATION',
        `Dugi ${long.workout.km} km > ${P.lengths.longMaxSec / 60} min sporim E (H13).`,
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
  if (longestAll10 < to10(P.lengths.longWarnKm))
    warn(
      'LONG_RUN_SHORT',
      `Najduži dugi ${longestAll10 / 10} km < ${P.lengths.longWarnKm} km (H13): preporuka više dana ili obima.`
    );

  // --- HI3 (pouka 14): upozorenje — kvalitetni dan duži od dugog po trajanju u ne-rasteretnoj izgradnji.
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
      `Kvalitetni dan duži od dugog po trajanju u ${longer.length} od ${weeks.filter(isSteady).length} nedelja izgradnje (ned ${f.w}: ${Math.round(f.q / 60)} > ${Math.round(f.long / 60)} min; HI3)${fewerDaysAdvice(input.runDays.length, input.currentWeeklyKm)}.`,
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

  // --- H10 tipovi po fazi; H14 WU/CD i oporavci; najmanja deonica po zoni.
  const wc = warmupCooldown(input.currentWeeklyKm);
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
        if (d.role !== 'sharpener' || wo.qualityType !== 'RP_sharpener')
          err('PHASE_QUALITY', 'Trkačka nedelja ima samo oštrenje (H8).', w.index, d.date);
      } else if (w.deload) {
        if (d.role !== 'q2' || dose.ladder !== deloadLadder(w.phase))
          err(
            'PHASE_QUALITY',
            `Rasterećenje: jedini kvalitet je T (${deloadLadder(w.phase)}) na danu Q2 (H5).`,
            w.index,
            d.date
          );
      } else {
        const role = d.role === 'q1' || d.role === 'q2' ? d.role : null;
        if (!role || !wo.qualityType || !SLOT_TYPES[w.phase][role].includes(wo.qualityType))
          err(
            'PHASE_QUALITY',
            `${wo.qualityType} ne pripada fazi ${w.phase} (${d.role}) (H10).`,
            w.index,
            d.date
          );
        else if (isBuildPhase(w.phase) && dose.ladder !== ladderFor(w.phase, role))
          err('PHASE_QUALITY', `Lestvica ${dose.ladder} ≠ faza ${w.phase} (H10).`, w.index, d.date);
      }
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

  // --- H12: progresija po slotu kroz ne-rasteretne nedelje izgradnje.
  const steady = weeks.filter(isSteady);
  const lastOf: Record<'q1' | 'q2', Dose | null> = { q1: null, q2: null };
  let prevMain: PlanWeek | null = null;
  let prevW: PlanWeek | null = null;
  for (const b of steady) {
    let dropped = false;
    for (const role of ['q1', 'q2'] as const) {
      const da = lastOf[role];
      const db = slotDose(b, role);
      if (db) lastOf[role] = db;
      if (!da || !db) continue;
      if (db.step === 'drop') {
        // Pouka 12: H11 ispred H12 samo u nedelji ograničenoj kapacitetom — prethodna doza ne staje u
        // plafon ove nedelje, najviši nivo lestvice u plafonu, uz napomenu.
        dropped = true;
        const ladder = db.ladder as LadderId;
        const cap = capM(db.zone, b.targetKm);
        const best = structuresOfLadder(ladder)
          .filter((m) => m <= cap)
          .pop();
        if (da.doseM <= cap || db.doseM !== best || !b.notes.some((n) => n.includes('spušten sa')))
          err('DOSE_DROP', `${role}: spuštanje doze bez razloga iz plafona (H11/H12).`, b.index);
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
          err('DOSE_DECREASE', `${role}: doza ${db.doseM} m < ${da.doseM} m (H12).`, b.index);
        else if (db.doseM > da.doseM && (!nl || db.doseM !== doseOf(nl)))
          err(
            'DOSE_JUMP',
            `${role}: više od jednog nivoa (${da.doseM} → ${db.doseM} m) (H12).`,
            b.index
          );
        else if (db.doseM === da.doseM) {
          if (nl && doseOf(nl) <= capM(db.zone, b.targetKm))
            err(
              'DOSE_STALL',
              `${role}: sledeći nivo ${doseOf(nl)} m staje u plafon, a nije uzet (H12).`,
              b.index
            );
          const others = structuresForDose(ladder, da.doseM).some(
            (x) => !sameStructure(x, da.structure)
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
    if (prevMain && mainDoseM(b) < mainDoseM(prevMain) && !dropped)
      err(
        'MAIN_DOSE_DECREASE',
        `Glavna doza ${mainDoseM(b)} m < ${mainDoseM(prevMain)} m (H12, pouka 3).`,
        b.index
      );
    prevMain = b;
    if (prevW) {
      const repeat = (['q1', 'q2'] as const).some((r) => slotDose(b, r)?.step === 'repeat');
      if (
        qualityKey(prevW) === qualityKey(b) &&
        !(repeat && b.notes.some((n) => n.includes('ponovljen')))
      )
        err('IDENTICAL_WEEKS', `Isti kvalitet kao nedelja ${prevW.index} (H12).`, b.index);
      // Baza bez platoa (pouka 3): T slota raste ili, kad sledeći nivo ne staje, menja strukturu.
      if (prevW.phase === 'base' && b.phase === 'base' && !dropped) {
        const ta = slotDose(prevW, 'q2');
        const tb = slotDose(b, 'q2');
        if (ta && tb) {
          const nl = nextLevel(ta.ladder as LadderId, ta.doseM);
          const blocked = !nl || doseOf(nl) > capM('T', b.targetKm);
          if (!(tb.doseM > ta.doseM || (blocked && !sameStructure(ta.structure, tb.structure))))
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
      const st = startLevel(ladder, b.targetKm);
      let want = st ? doseOf(st) : NaN;
      if (da && carry) {
        const lv = structuresOfLadder(ladder).find((m) => m >= Math.max(want, da.doseM));
        if (lv === undefined || lv > capM(zoneOf(ladder), b.targetKm)) continue;
        want = lv;
      }
      if (db.doseM !== want)
        err(
          'START_LEVEL',
          `${role}: početni nivo ${ladder} ${db.doseM} m ≠ ${want} m (≤ 60 % plafona, H12).`,
          b.index
        );
    }

  // --- H5 sadržaj rasterećenja i H7 taper: doza iz stanja poslednje ne-rasteretne izgradnje (ista
  // funkcija kao konstruktor), dugi 0,8 × poslednji / ≤ 0,6 × najduži.
  let state: QualityState = INITIAL_QUALITY;
  let lastLong10: number | null = null;
  let longest10 = 0;
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.deload && lastLong10 !== null) {
      const want = deloadDose(state, w.phase);
      const t = slotDose(w, 'q2');
      const nQuality = w.days.filter((d) => d.workout.kind === 'quality').length;
      if (want.doseM > capM('T', w.targetKm)) {
        if (nQuality !== 0 || !w.notes.some((n) => n.includes('bez kvaliteta')))
          err(
            'DELOAD_CONTENT',
            `Rasterećenje: T ${want.doseM} m > plafon → bez kvaliteta, uz napomenu (H11 ispred H5).`,
            w.index
          );
        else warn('DELOAD_NO_QUALITY', `Rasterećenje bez kvaliteta: T ${want.doseM} m.`, w.index);
      } else if (
        nQuality !== 1 ||
        !t ||
        t.doseM !== want.doseM ||
        !sameStructure(t.structure, want.structure)
      )
        err(
          'DELOAD_CONTENT',
          `Rasterećenje: 1 kvalitet T ${want.doseM} m (≈ 60 % poslednje T doze, min 2,0 km) (H5).`,
          w.index
        );
      if (long) {
        const want10 = Math.min(deloadLong10(lastLong10), longCap10(to10(w.targetKm), rule, p));
        if (to10(long.workout.km) !== want10)
          err(
            'DELOAD_LONG',
            `Dugi rasterećenja ${long.workout.km} km ≠ ${want10 / 10} km (0,8 × poslednji, H5).`,
            w.index
          );
      }
    }
    if (w.phase === 'taper') {
      const want = taperDoses(state);
      const rp = slotDose(w, 'q1');
      const t = slotDose(w, 'q2');
      const rpFits = want.q1.doseM <= capM('RP', w.targetKm);
      const same = (x: Dose | null, y: Dose): boolean =>
        !!x && x.doseM === y.doseM && sameStructure(x.structure, y.structure);
      if (!rpFits) {
        if (rp || t || !w.notes.some((n) => n.includes('bez kvaliteta')))
          err(
            'TAPER_QUALITY',
            `Taper: RP ${want.q1.doseM} m > plafon → bez kvaliteta, uz napomenu (H11 ispred H7).`,
            w.index
          );
        else warn('TAPER_NO_QUALITY', `Taper bez kvaliteta: RP ${want.q1.doseM} m.`, w.index);
      } else if (!same(rp, want.q1))
        err('TAPER_QUALITY', `Taper: RP ${want.q1.doseM} m (≈ 60 % poslednje doze) (H7).`, w.index);
      else if (!t) {
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
      const q1 = slotDose(w, 'q1');
      const q2 = slotDose(w, 'q2');
      if (q1 && q2)
        state = {
          q1: { ladder: q1.ladder as LadderId, doseM: q1.doseM, structure: q1.structure },
          q2: { ladder: q2.ladder as LadderId, doseM: q2.doseM, structure: q2.structure }
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
    err('VOLUME_PEAK', 'Granica izgradnje ≠ min(1,4×, +20, max nedelje H15) (H6).');
  let h = INITIAL_VOLUME;
  let capacityCut = false;
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    const nominal = nominal10(w, h, start10, cap10);
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
  // Pouka 9: nedelja 1 ispod trenutnog obima samo kad je dugi nedelje 1 na vremenskom plafonu (150 min).
  const w1 = weeks[0]!;
  const long1 = w1.days.find((d) => d.role === 'long');
  if (to10(w1.targetKm) < start10 && (!long1 || to10(long1.workout.km) !== longTimeCap10(p)))
    err(
      'WEEK1_BELOW_START',
      `Nedelja 1 ${w1.targetKm} km < trenutni obim ${plan.startKm} km, a dugi nije na ${P.lengths.longMaxSec / 60} min (H6, pouka 9).`,
      1
    );
  if (capacityCut)
    warn(
      'CAPACITY_LIMITED',
      capacityMessage(input.runDays.length, rule, capacityLimits(weeks, rule, p))
    );

  // --- H2 tempo, H3 cilj.
  const res = input.recentResult;
  if (!res) err('PACES', 'Plan mora imati rezultat (H1).');
  else if (
    JSON.stringify(pacesFromVdot(vdotFromResult(res.distanceM, res.timeSec))) !== JSON.stringify(p)
  )
    err('PACES', 'Tempo ne odgovara VDOT-u iz rezultata (H2).');
  if (plan.vdot !== p.vdot) err('PACES', 'VDOT plana ≠ VDOT tempa (H2).');
  if (plan.predictedHmSec !== raceTimeForVdot(p.vdot, P.paces.raceDistanceM))
    err('PACES', 'Prognoza polumaratona ≠ VDOT plana (H2).');
  if (input.goalTimeSec) {
    const g = assessGoal(plan.vdot, input.goalTimeSec, N);
    if (!plan.goal || plan.goal.status !== g.status || plan.goal.vdotGap !== g.vdotGap)
      err('GOAL', 'Ocena cilja ne odgovara pravilu H3.');
    else if (g.status === 'unrealistic') warn('GOAL_UNREALISTIC', g.message);
  } else if (plan.goal) err('GOAL', 'Bez cilja nema ocene (H3).');
  return out;
}

/** Doze nivoa lestvice rastuće [m]. */
const structuresOfLadder = (ladder: LadderId): number[] => ladderLevels(ladder).map(doseOf);
