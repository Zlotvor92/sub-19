/* Provera plana prema policy.ts (D1–D15). SAMO prijavljuje prekršaje; plan se nikad ne menja i nema
   petlji skraćivanja. Greške obaraju plan (generate.ts → PLAN_VIOLATES_POLICY); upozorenja idu u plan. */

import { daysBetween, mustDay, weekdayOf } from './dates.ts';
import { longCap10 } from './lengths.ts';
import { assessGoal, midEasy, pacesFromVdot, vdotFromResult } from './paces.ts';
import { buildAllowed, deloadAllowed, firstOfPhase, isBuildPhase, phasesOf } from './periodize.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import { capM, ladderFor, nextLevel } from './quality.ts';
import { adjacentDays } from './schedule.ts';
import type {
  DayRole,
  Dose,
  LadderId,
  Phase,
  PlanWeek,
  QualityType,
  Structure,
  TenKV2Plan,
  Violation,
  WorkZone
} from './types.ts';
import { CAPACITY_MESSAGE, growth10, peakCap10, startKm10 } from './volume.ts';
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
const ZONES: readonly WorkZone[] = ['R', 'I', 'T', 'RP'];
const to10 = (km: number): number => Math.round(km * 10);
const to100 = (km: number): number => Math.round(km * 100);

/** D10: dozvoljeni tipovi kvaliteta po fazi i slotu (T druge strukture je kontinuirano ↔ deonice). */
const SLOT_TYPES: Readonly<
  Record<Phase, { q1: readonly QualityType[]; q2: readonly QualityType[] }>
> = {
  base: { q1: ['R'], q2: ['T_continuous', 'T_cruise'] },
  development: { q1: ['I'], q2: ['T_cruise', 'T_continuous'] },
  specific: { q1: ['RP'], q2: ['T_cruise', 'T_continuous'] },
  taper: { q1: ['RP'], q2: ['T_cruise'] },
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
        ? Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP) * 1000)
        : 0),
    0
  );
const qualityKey = (w: PlanWeek): string =>
  JSON.stringify(
    w.days.filter((d) => d.workout.kind === 'quality').map((d) => [d.role, d.workout.blocks])
  );

/** ≈ share × poslednja doza, najviši nivo lestvice naniže; ispod najnižeg → floor (D5/D7). */
function expectedReduced(ladder: LadderId, lastM: number, share: number, floorM: number): number {
  const lv = ladderLevels(ladder)
    .map(doseOf)
    .filter((m) => m <= share * lastM + EPS && m >= floorM);
  return lv[lv.length - 1] ?? floorM;
}

export function validatePlan(plan: TenKV2Plan): Violation[] {
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
      if (d.hard !== HARD.includes(d.role))
        err('HARD_FLAG', `Oznaka zahtevnog dana ne odgovara ulozi ${d.role}.`, w.index, d.date);
    }
  });

  // --- D4 / Uslov 6: faza svake nedelje iz odluke generatora.
  const expected = phasesOf(N);
  for (const w of weeks) {
    if (!PHASES.includes(w.phase)) err('NO_PHASE', 'Nedelja bez faze.', w.index);
    else if (w.phase !== expected[w.index - 1])
      err('PHASES', `Faza ${w.phase} ≠ ${expected[w.index - 1]} (D4).`, w.index);
  }
  const phases = weeks.map((w) => w.phase);

  // --- D5: gde su rasterećenja.
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
      err('DELOAD_PLACEMENT', `Rasterećenje ${why} (D5).`, w.index);
    }
    if (!isBuildPhase(w.phase)) continue;
    if (w.deload) run = 0;
    else {
      if (!buildAllowed(phases, w.index, run))
        err('DELOAD_RUN', `${run + 1} uzastopne nedelje izgradnje bez rasterećenja (D5).`, w.index);
      run++;
    }
  }

  // --- D9: uloge dana po šablonu; D5/D7 broj kvaliteta.
  const pat = plan.pattern;
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    const want: [DayRole, string][] = w.deload
      ? [
          ['q2', pat.q2],
          ['long', pat.long],
          ['easy', pat.q1],
          ['easy', pat.easy[0]!]
        ]
      : [
          ['q1', pat.q1],
          ['q2', pat.q2],
          ['long', pat.long],
          ['easy', pat.easy[0]!]
        ];
    const got = w.days.map((d) => `${d.role}@${d.weekday}`).sort();
    const exp = want.map(([r, wd]) => `${r}@${wd}`).sort();
    if (JSON.stringify(got) !== JSON.stringify(exp))
      err('ROLES', `Dani ${got.join(', ')} ≠ šablon ${exp.join(', ')} (D9).`, w.index);
  }

  // --- D9: zahtevni dani nikad uzastopni (i preko granice nedelje).
  const hard = weeks.flatMap((w) => w.days.filter((d) => d.hard).map((d) => ({ w: w.index, d })));
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!.d.date, hard[i]!.d.date) < 2)
      err(
        'HARD_ADJACENT',
        `Zahtevni dani ${hard[i - 1]!.d.date} i ${hard[i]!.d.date} su susedni (D9).`,
        hard[i]!.w,
        hard[i]!.d.date
      );
  if (
    adjacentDays(pat.q1, pat.q2) ||
    adjacentDays(pat.q1, pat.long) ||
    adjacentDays(pat.q2, pat.long)
  )
    err('HARD_ADJACENT', 'Šablon ima susedne zahtevne dane (D9).');

  // --- Aritmetika i Uslov 8 (D15).
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
      if (Math.abs(s.reduce((a, x) => a + to100(x.km), 0) - to100(d.workout.km)) > 0)
        err('ARITHMETIC', 'Km dana ≠ zbir segmenata.', w.index, d.date);
      if (s.reduce((a, x) => a + x.sec, 0) !== d.workout.sec)
        err('ARITHMETIC', 'Trajanje dana ≠ zbir segmenata.', w.index, d.date);
      if (d.role === 'easy' && d.workout.km + EPS < P.lengths.easyMinKm)
        err(
          'EASY_MIN',
          `Lagan ${d.workout.km} km < ${P.lengths.easyMinKm} km (D13/D15).`,
          w.index,
          d.date
        );
    }
    const planned = w.days.reduce((a, d) => a + (d.countsToWeek ? to100(d.workout.km) : 0), 0);
    if (planned !== to100(w.plannedKm)) err('ARITHMETIC', 'Planirano ≠ zbir dana.', w.index);
    if (Math.abs(w.plannedKm - w.targetKm) > P.tolerance.plannedKm + EPS)
      err('PLANNED_VS_TARGET', `Planirano ${w.plannedKm} km ≠ cilj ${w.targetKm} km.`, w.index);
    if (w.plannedKm + EPS < P.week.minKm)
      err('WEEK_MIN_VOLUME', `Nedelja ${w.plannedKm} km < ${P.week.minKm} km (Uslov 8).`, w.index);
    if (w.days.filter((d) => d.countsToWeek).length === 0)
      err('EMPTY_WEEK', 'Nedelja bez treninga (Uslov 8).', w.index);
  }

  // --- D13: dužine.
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.phase === 'race') {
      if (long) err('RACE_WEEK', 'Trkačka nedelja nema dugi (trka ga zamenjuje, D8).', w.index);
      continue;
    }
    if (!long) {
      err('ROLES', 'Nedelja nema dugi trk.', w.index);
      continue;
    }
    const l10 = to10(long.workout.km);
    if (Math.abs(long.workout.km * 10 - l10) > EPS)
      err('LENGTH_STEP', 'Dugi nije u koraku 0,1 km (D13).', w.index, long.date);
    if (l10 > Math.floor(P.lengths.longMaxShare * to10(w.targetKm) + 1e-9))
      err(
        'LONG_SHARE',
        `Dugi ${long.workout.km} km > 33 % cilja ${w.targetKm} km (D13).`,
        w.index,
        long.date
      );
    if (long.workout.km * p.E.slow > P.lengths.longMaxSec + EPS)
      err(
        'LONG_DURATION',
        `Dugi ${long.workout.km} km > 105 min sporim E (D13).`,
        w.index,
        long.date
      );
    if (long.workout.segments.some((s) => s.zone !== 'E'))
      err('LONG_NOT_EASY', 'Dugi trk je samo lagan.', w.index, long.date);
    for (const d of w.days)
      if (d.role === 'easy') {
        if (d.workout.km > long.workout.km + EPS)
          err(
            'LONG_SHORTER_THAN_EASY',
            `Dugi ${long.workout.km} km < lagan ${d.workout.km} km (D13).`,
            w.index,
            d.date
          );
        if (Math.abs(d.workout.km * 10 - to10(d.workout.km)) > EPS)
          err('LENGTH_STEP', 'Lagan nije u koraku 0,1 km (D13).', w.index, d.date);
      }
  }

  // --- D11: jedan plafon po zoni, po treningu (trkačka nedelja: D8).
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    for (const d of w.days)
      for (const z of ZONES) {
        const m = Math.round(d.workout.workKm[z] * 1000);
        if (m > capM(z, w.targetKm))
          err(
            'ZONE_CAP',
            `${z} ${m} m > ${P.caps[z] * 100} % cilja ${w.targetKm} km (D11).`,
            w.index,
            d.date
          );
      }
  }

  // --- D10 tipovi po fazi; D14 WU/CD (pojas trenutnog obima) i oporavci.
  const mid = midEasy(p);
  const km10 = to10(input.currentWeeklyKm);
  const wc = P.workout.warmupCooldown.filter((b) => to10(b.fromKm) <= km10).pop()!;
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
          err('PHASE_QUALITY', 'Trkačka nedelja ima samo oštrenje (D8).', w.index, d.date);
      } else if (w.deload) {
        const lad = ladderFor(w.phase, 'q2');
        if (d.role !== 'q2' || dose.ladder !== lad)
          err(
            'PHASE_QUALITY',
            `Rasterećenje: jedini kvalitet je T (${lad}) (D5).`,
            w.index,
            d.date
          );
      } else {
        const role = d.role === 'q1' || d.role === 'q2' ? d.role : null;
        if (!role || !wo.qualityType || !SLOT_TYPES[w.phase][role].includes(wo.qualityType))
          err(
            'PHASE_QUALITY',
            `${wo.qualityType} ne pripada fazi ${w.phase} (${d.role}) (D10).`,
            w.index,
            d.date
          );
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
          `Zagrevanje mora biti ${wc.warmupSec / 60} min E (km po srednjem E) (D14).`,
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
          `Hlađenje mora biti ${wc.cooldownSec / 60} min E (km po srednjem E) (D14).`,
          w.index,
          d.date
        );
      if (seg.filter((x) => x.kind === 'warmup' || x.kind === 'cooldown').length !== 2)
        err('WARMUP', 'Tačno jedno zagrevanje i jedno hlađenje (D14).', w.index, d.date);
      const s = dose.structure;
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
          err('RECOVERY', `Oporavak deonica ne odgovara D14 (${dose.ladder}).`, w.index, d.date);
      } else if (recs.length > 0 || reps.length > 0)
        err('RECOVERY', 'Kontinuiran blok nema deonice ni oporavak.', w.index, d.date);
    }

  // --- D12: progresija po slotu kroz ne-rasteretne nedelje izgradnje.
  const steady = weeks.filter(isSteady);
  for (let i = 1; i < steady.length; i++) {
    const a = steady[i - 1]!;
    const b = steady[i]!;
    for (const role of ['q1', 'q2'] as const) {
      const da = slotDose(a, role);
      const db = slotDose(b, role);
      if (!da || !db) continue;
      if (db.step === 'drop') {
        // D11 ispred D12: dozvoljeno samo kad prethodna doza ne staje u plafon ove nedelje, na najviši
        // nivo lestvice koji staje, uz napomenu.
        const ladder = db.ladder as LadderId;
        const cap = capM(db.zone, b.targetKm);
        const best = ladderLevels(ladder)
          .map(doseOf)
          .filter((m) => m <= cap)
          .pop();
        if (da.doseM <= cap || db.doseM !== best || !b.notes.some((n) => n.includes('spušten sa')))
          err('DOSE_DROP', `${role}: spuštanje doze bez razloga iz plafona (D11/D12).`, b.index);
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
          err('DOSE_DECREASE', `${role}: doza ${db.doseM} m < ${da.doseM} m (D12).`, b.index);
        else if (db.doseM > da.doseM && (!nl || db.doseM !== doseOf(nl)))
          err(
            'DOSE_JUMP',
            `${role}: više od jednog nivoa (${da.doseM} → ${db.doseM} m) (D12).`,
            b.index
          );
        else if (db.doseM === da.doseM) {
          if (nl && doseOf(nl) <= capM(db.zone, b.targetKm))
            err(
              'DOSE_STALL',
              `${role}: sledeći nivo ${doseOf(nl)} m staje u plafon, a nije uzet (D12).`,
              b.index
            );
          const others = structuresForDose(ladder, da.doseM).some(
            (x) => !sameStructure(x, da.structure)
          );
          if (sameStructure(da.structure, db.structure) && others)
            err(
              'SLOT_REPEAT',
              `${role}: ista doza iste strukture, a druga struktura postoji (D12).`,
              b.index
            );
        }
      } else {
        const carry =
          (da.ladder === 'T_continuous' && db.ladder === 'T_cruise') ||
          (da.ladder === 'I' && db.ladder === 'RP');
        if (carry && db.doseM < da.doseM)
          err(
            'TRANSITION_DOSE',
            `${role}: ${db.ladder} ${db.doseM} m < poslednje ${da.ladder} ${da.doseM} m (D12).`,
            b.index
          );
      }
    }
    const dropped = (['q1', 'q2'] as const).some((r) => slotDose(b, r)?.step === 'drop');
    if (mainDoseM(b) < mainDoseM(a) && !dropped)
      err(
        'MAIN_DOSE_DECREASE',
        `Glavna doza ${mainDoseM(b)} m < ${mainDoseM(a)} m (D12).`,
        b.index
      );
    if (qualityKey(a) === qualityKey(b))
      err('IDENTICAL_WEEKS', `Isti kvalitet kao nedelja ${a.index} (D12).`, b.index);
    if (a.phase === 'base' && b.phase === 'base' && !dropped) {
      const ta = slotDose(a, 'q2');
      const tb = slotDose(b, 'q2');
      if (ta && tb) {
        const nl = nextLevel(ta.ladder as LadderId, ta.doseM);
        const blocked = !nl || doseOf(nl) > capM('T', b.targetKm);
        // Odstupanje (D10 ispred „baza bez platoa"): kad druga struktura iste doze ne postoji
        // (T 2,5 / 3,5 km, deonice ≥ 1000 m), T se ponavlja uz napomenu — opreznije od skoka obima.
        const noOther = !structuresForDose(ta.ladder as LadderId, ta.doseM).some(
          (x) => !sameStructure(x, ta.structure)
        );
        const repeated = noOther && b.notes.some((n) => n.includes('ponovljen'));
        const ok =
          tb.doseM > ta.doseM ||
          (blocked && (!sameStructure(ta.structure, tb.structure) || repeated));
        if (!ok)
          err(
            'BASE_PLATEAU',
            `Baza: T doza ${tb.doseM} m bez rasta ili druge strukture (D12).`,
            b.index
          );
      }
    }
  }

  // --- D16: početni nivo (prva nedelja baze; I i RP na prvoj nedelji faze; RP i dalje ≥ poslednje I).
  const startM = (ladder: LadderId, targetKm: number): number => {
    const cap = capM(zoneOf(ladder), targetKm);
    const lv = ladderLevels(ladder).map(doseOf);
    return lv.filter((m) => m <= P.startLevel.capShare * cap + EPS).pop() ?? lv[0]!;
  };
  for (let i = 0; i < steady.length; i++) {
    const b = steady[i]!;
    const a = i > 0 ? steady[i - 1]! : null;
    if (a && a.phase === b.phase) continue;
    for (const role of ['q1', 'q2'] as const) {
      const db = slotDose(b, role);
      if (!db || db.step === 'drop') continue;
      const ladder = db.ladder as LadderId;
      const da = a ? slotDose(a, role) : null;
      if (da && (da.ladder === ladder || (da.ladder === 'T_continuous' && ladder === 'T_cruise')))
        continue;
      let want = startM(ladder, b.targetKm);
      if (da?.ladder === 'I' && ladder === 'RP') {
        const lv = ladderLevels('RP')
          .map(doseOf)
          .find((m) => m >= Math.max(want, da.doseM));
        if (lv === undefined || lv > capM('RP', b.targetKm)) continue;
        want = lv;
      }
      if (db.doseM !== want)
        err(
          'START_LEVEL',
          `${role}: početni nivo ${ladder} ${db.doseM} m ≠ ${want} m (≤ 60 % plafona, D16).`,
          b.index
        );
    }
  }

  // --- D5 sadržaj rasterećenja, D7 taper.
  let lastSteady: PlanWeek | null = null;
  let longest10 = 0;
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.deload && lastSteady) {
      const lastT = slotDose(lastSteady, 'q2')?.doseM ?? 0;
      const t = slotDose(w, 'q2');
      const ladder = ladderFor(w.phase, 'q2');
      const want = expectedReduced(
        ladder,
        lastT,
        P.deload.tShare,
        Math.round(P.deload.tMinKm * 1000)
      );
      if (w.days.filter((d) => d.workout.kind === 'quality').length !== 1 || !t || t.doseM !== want)
        err(
          'DELOAD_CONTENT',
          `Rasterećenje: 1 kvalitet T ${want} m (≈ 60 % od ${lastT} m) (D5).`,
          w.index
        );
      const lastLong = lastSteady.days.find((d) => d.role === 'long');
      if (long && lastLong) {
        const want10 = Math.min(
          Math.floor(P.deload.longFactor * to10(lastLong.workout.km) + 1e-9),
          longCap10(to10(w.targetKm), p)
        );
        if (to10(long.workout.km) !== want10)
          err(
            'DELOAD_LONG',
            `Dugi rasterećenja ${long.workout.km} km ≠ ${want10 / 10} km (D5).`,
            w.index
          );
      }
      if (w.days.filter((d) => d.role === 'easy').length !== 2)
        err('DELOAD_CONTENT', 'Rasterećenje: ostala dva dana su lagana (D5).', w.index);
    }
    if (w.phase === 'taper' && lastSteady) {
      const rp = slotDose(w, 'q1');
      const t = slotDose(w, 'q2');
      const t7 = P.taper;
      const wantRp = expectedReduced(
        'RP',
        slotDose(lastSteady, 'q1')?.doseM ?? 0,
        t7.doseShare,
        t7.rpMin.reps * t7.rpMin.repM
      );
      const wantT = expectedReduced(
        'T_cruise',
        slotDose(lastSteady, 'q2')?.doseM ?? 0,
        t7.doseShare,
        Math.round(t7.tMinKm * 1000)
      );
      if (
        !rp ||
        rp.zone !== 'RP' ||
        rp.doseM !== wantRp ||
        !t ||
        t.zone !== 'T' ||
        t.doseM !== wantT
      )
        err(
          'TAPER_QUALITY',
          `Taper: RP ${wantRp} m i T ${wantT} m (≈ 60 % poslednje doze) (D7).`,
          w.index
        );
      if (long && to10(long.workout.km) > Math.floor(t7.longFactor * longest10 + 1e-9))
        err(
          'TAPER_LONG',
          `Dugi tapera ${long.workout.km} km > 0,75 × najduži ${longest10 / 10} km (D7).`,
          w.index
        );
      if (w.days.length !== P.input.runDays)
        err('TAPER_DAYS', 'Taper zadržava 4 dana (D7).', w.index);
    }
    if (long) longest10 = Math.max(longest10, to10(long.workout.km));
    if (isSteady(w)) lastSteady = w;
  }

  // --- D8 trkačka nedelja.
  const rw = weeks[N - 1]!;
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
        k[0]?.kind !== 'warmup' ||
        k[0].sec !== q.raceWarmupSec ||
        k[k.length - 1]?.kind !== 'cooldown' ||
        k[k.length - 1]!.sec !== q.raceCooldownSec
      )
        err('RACE_DAY', 'Trka: 10 km + WU 15 min + CD 10 min, van obima (D8).', rw.index, rd.date);
    }
    if (rw.days.length > q.maxRunDays)
      err(
        'RACE_WEEK',
        `Trkačka nedelja ima ${rw.days.length} dana (> ${q.maxRunDays}) (D8).`,
        rw.index
      );
    const others = rw.days.filter((d) => d.role !== 'race');
    const sharp = others.filter((d) => d.role === 'sharpener');
    const taperRp = weeks.find((w) => w.phase === 'taper')?.days.find((d) => d.role === 'q1');
    const taperRpM = taperRp?.workout.dose?.doseM ?? 0;
    const full = q.sharpener.reps * q.sharpener.repM;
    const reps = taperRpM >= full ? q.sharpener.reps : q.sharpenerSmallReps;
    const latest = others
      .filter((d) => daysBetween(d.date, race) >= q.sharpenerMinGapDays)
      .map((d) => d.date)
      .sort()
      .pop();
    const sd = sharp[0];
    const st: Structure | undefined = sd?.workout.dose?.structure;
    if (
      sharp.length !== 1 ||
      !sd ||
      sd.date !== latest ||
      !st ||
      st.form !== 'reps' ||
      st.reps !== reps ||
      st.repM !== q.sharpener.repM ||
      sd.workout.segments.some((x) => x.kind === 'recovery' && x.sec !== q.sharpener.recoverySec)
    )
      err(
        'RACE_SHARPENER',
        `Oštrenje: ${reps} × ${q.sharpener.repM} m RP (90 s, ≤ RP doza tapera ${taperRpM} m) na najkasnijem danu ≥ ${q.sharpenerMinGapDays} dana pre trke (D8).`,
        rw.index
      );
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
          err('RACE_EVE', 'Dan pred trku: 20 min E + 4 × 20 s, ≤ 30 min (D8).', rw.index, d.date);
      } else if (
        d.role !== 'easy' ||
        segs.length !== 1 ||
        segs[0]!.zone !== 'E' ||
        segs[0]!.sec !== q.otherEasySec
      )
        err('RACE_WEEK_EASY', 'Ostali dani trkačke nedelje: 35 min E (D8).', rw.index, d.date);
    }
    if (to10(rw.targetKm) !== Math.round(to100(rw.plannedKm) / 10))
      err('RACE_WEEK', 'Cilj trkačke nedelje = planirano (D8).', rw.index);
  }

  // --- D6 obim: cilj po pravilu, izvodljiv cilj samo uz oznaku i napomenu.
  const start10 = startKm10(input.currentWeeklyKm);
  const cap10 = peakCap10(start10);
  if (to10(plan.startKm) !== start10) err('VOLUME_START', 'Start ≠ trenutni obim (D6).');
  if (to10(plan.peakCapKm) !== cap10)
    err('VOLUME_PEAK', 'Granica izgradnje ≠ min(1,4×, +15, 60) (D6).');
  let lastBuild: number | null = null;
  let peak = 0;
  let capacityCut = false;
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    const nominal: number =
      w.phase === 'taper'
        ? Math.round(P.taper.factor * peak)
        : lastBuild === null
          ? start10
          : w.deload
            ? Math.round(P.deload.factor * lastBuild)
            : Math.min(lastBuild + growth10(lastBuild), cap10);
    const t10 = to10(w.targetKm);
    if (to10(w.nominalKm) !== nominal)
      err(
        'VOLUME_RULE',
        `Nominalni cilj ${w.nominalKm} km ≠ ${nominal / 10} km po pravilu (D6).`,
        w.index
      );
    if (t10 === nominal) {
      if (w.fitted !== null)
        err('VOLUME_RULE', 'Oznaka izvodljivog cilja bez promene cilja.', w.index);
    } else if (
      w.fitted === null ||
      (w.fitted === 'down' && t10 > nominal) ||
      (w.fitted === 'up' && t10 < nominal) ||
      !w.notes.some((n) => n.includes('najbliži izvodljiv'))
    )
      err(
        'VOLUME_RULE',
        `Cilj ${w.targetKm} km ≠ ${nominal / 10} km po pravilu, bez oznake (D6).`,
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
        `Cilj ${w.targetKm} km > granica izgradnje ${cap10 / 10} km (D6).`,
        w.index
      );
    if (isSteady(w)) {
      if (w.fitted === 'down') capacityCut = true;
      lastBuild = t10;
      peak = Math.max(peak, t10);
    }
  }
  if (to10(plan.peakKm) !== peak) err('VOLUME_PEAK', 'Vrh plana ≠ najveći cilj izgradnje.');
  if (capacityCut) warn('CAPACITY_LIMITED', CAPACITY_MESSAGE);

  // --- D2 tempo, D3 cilj.
  const res = input.recentResult;
  if (!res) err('PACES', 'Plan sa rezultatom mora imati rezultat (D1).');
  else if (
    JSON.stringify(pacesFromVdot(vdotFromResult(res.distanceM, res.timeSec))) !== JSON.stringify(p)
  )
    err('PACES', 'Tempo ne odgovara VDOT-u iz rezultata (D2).');
  if (input.goalTimeSec) {
    const g = assessGoal(plan.vdot, input.goalTimeSec, N);
    if (!plan.goal || plan.goal.status !== g.status || plan.goal.vdotGap !== g.vdotGap)
      err('GOAL', 'Ocena cilja ne odgovara pravilu D3.');
    else if (g.status === 'unrealistic') warn('GOAL_UNREALISTIC', g.message);
  } else if (plan.goal) err('GOAL', 'Bez cilja nema ocene (D3).');
  return out;
}
