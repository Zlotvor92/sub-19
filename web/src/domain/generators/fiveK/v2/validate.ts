/* Provera plana prema policy.ts. SAMO prijavljuje prekršaje; plan se ne menja. */

import { daysBetween, mustDay } from './dates.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import type { FiveKV2Plan, Phase, PlanWeek, QualityType, Violation } from './types.ts';
import { qualityBudgets, warmupBand } from './workouts.ts';

const PHASE_ORDER: readonly Phase[] = ['base', 'peak', 'sharpen', 'taper', 'race'];
const PHASE_QUALITY: Readonly<Record<Phase, readonly QualityType[]>> = {
  base: ['R', 'T_short'],
  peak: ['I', 'T_cruise', 'T_short'],
  sharpen: ['RP', 'R_sharpen'],
  taper: ['RP', 'T_short'],
  race: ['RP_sharpener']
};
const EPS = 1e-6;
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'peak' || w.phase === 'sharpen';

export function validatePlan(plan: FiveKV2Plan): Violation[] {
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
  const tolKm = P.tolerance.arithmeticKm;
  const fTol = P.volume.factorTolerance;
  const q = P.quality;
  const weeks = plan.weeks;
  const runDays = new Set(plan.input.runDays);

  // --- Struktura: datumi, faze, trkačka nedelja.
  if (weeks.length === 0) {
    err('STRUCTURE', 'Plan nema nedelja.');
    return out;
  }
  if (weeks[0]!.startDate !== plan.input.startDate)
    err('STRUCTURE', 'Prva nedelja ne počinje datumom starta.', 1);
  if (weeks[weeks.length - 1]!.endDate !== plan.input.raceDate)
    err('STRUCTURE', 'Poslednja nedelja se ne završava danom trke.', weeks.length);
  weeks.forEach((w, i) => {
    if (w.index !== i + 1) err('STRUCTURE', `Redni broj nedelje ${w.index} ≠ ${i + 1}.`, w.index);
    if (daysBetween(w.startDate, w.endDate) !== 6)
      err('STRUCTURE', 'Nedelja nema 7 dana.', w.index);
    const prev = weeks[i - 1];
    if (prev) {
      if (daysBetween(prev.endDate, w.startDate) !== 1)
        err('STRUCTURE', 'Nedelje nisu uzastopne.', w.index);
      if (PHASE_ORDER.indexOf(w.phase) < PHASE_ORDER.indexOf(prev.phase))
        err('PHASE_ORDER', `Faza ${w.phase} posle ${prev.phase}.`, w.index);
    }
    for (const d of w.days)
      if (mustDay(d.date) < mustDay(w.startDate) || mustDay(d.date) > mustDay(w.endDate))
        err('STRUCTURE', `Dan ${d.date} je van nedelje.`, w.index, d.date);
  });
  const raceWeeks = weeks.filter((w) => w.phase === 'race');
  const taperWeeks = weeks.filter((w) => w.phase === 'taper');
  if (raceWeeks.length !== P.phases.raceWeeks || weeks[weeks.length - 1]!.phase !== 'race')
    err('PHASES', 'Mora postojati tačno jedna trkačka nedelja i ona je poslednja.');
  if (taperWeeks.length !== P.phases.taperWeeks)
    err('PHASES', `Taper mora trajati ${P.phases.taperWeeks} nedelje.`);
  const races = weeks.flatMap((w) => w.days.filter((d) => d.role === 'race'));
  if (races.length !== 1 || races[0]!.date !== plan.input.raceDate)
    err('RACE_DAY', 'Trka mora biti jednom, na dan trke (poslednji dan plana).');

  // --- Dani: 4 dana trčanja, uloge, nesusedni zahtevni dani.
  for (const w of weeks) {
    const roles = w.days.map((d) => d.role);
    const qualities = w.days.filter((d) => d.workout.kind === 'quality');
    for (const d of w.days) {
      if (d.role !== 'race' && !runDays.has(d.weekday))
        err('RUN_DAYS', `Trening na dan koji nije izabran (${d.weekday}).`, w.index, d.date);
      for (const qd of [d])
        if (qd.workout.qualityType && !PHASE_QUALITY[w.phase].includes(qd.workout.qualityType))
          err(
            'PHASE_QUALITY',
            `${qd.workout.qualityType} ne pripada fazi ${w.phase}.`,
            w.index,
            d.date
          );
    }
    if (w.phase !== 'race') {
      if (w.days.length !== P.input.runDaysPerWeek)
        err(
          'RUN_DAYS',
          `Nedelja ima ${w.days.length} treninga umesto ${P.input.runDaysPerWeek}.`,
          w.index
        );
      if (roles.filter((r) => r === 'long').length !== 1)
        err('ROLES', 'Nedelja mora imati tačno jedan dugi trk.', w.index);
      const oneQuality = w.deload || w.taperStep === 2;
      const expectedQ = oneQuality ? 1 : 2;
      if (qualities.length !== expectedQ)
        err('ROLES', `Nedelja ima ${qualities.length} kvaliteta umesto ${expectedQ}.`, w.index);
    } else {
      if (qualities.length > 1)
        err('ROLES', 'Trkačka nedelja sme imati najviše jedan kvalitet.', w.index);
      for (const d of qualities) {
        const gap = daysBetween(d.date, plan.input.raceDate);
        if (gap < P.schedule.sharpenerMinGapDays)
          err('SHARPENER_GAP', `Kvalitet ${gap} dan(a) pre trke.`, w.index, d.date);
      }
    }
  }
  const hardDates = weeks
    .flatMap((w) => w.days.filter((d) => d.hard).map((d) => ({ w: w.index, date: d.date })))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < hardDates.length; i++) {
    const a = hardDates[i - 1]!;
    const b = hardDates[i]!;
    if (daysBetween(a.date, b.date) < P.schedule.minHardGapDays)
      err('HARD_ADJACENT', `Zahtevni dani ${a.date} i ${b.date} su uzastopni.`, b.w, b.date);
  }

  // --- Aritmetika komponenti.
  for (const w of weeks) {
    for (const d of w.days) {
      const s = d.workout.segments;
      const kmSum = s.reduce((a, x) => a + x.km, 0);
      const secSum = s.reduce((a, x) => a + x.sec, 0);
      if (Math.abs(kmSum - d.workout.km) > tolKm)
        err('ARITHMETIC', `Km dana ≠ zbir komponenti.`, w.index, d.date);
      if (secSum !== d.workout.sec)
        err('ARITHMETIC', `Trajanje dana ≠ zbir komponenti.`, w.index, d.date);
    }
    const planned = w.days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0);
    if (Math.abs(planned - w.plannedKm) > tolKm)
      err('ARITHMETIC', 'Planirani km nedelje ≠ zbir dana.', w.index);
    const dev = Math.abs(w.plannedKm - w.targetKm) / w.targetKm;
    if (dev > P.tolerance.plannedVsTarget + EPS) {
      const msg = `Planirano ${w.plannedKm} km vs cilj ${w.targetKm} km.`;
      if (w.phase === 'race') warn('PLANNED_VS_TARGET', msg, w.index);
      else err('PLANNED_VS_TARGET', msg, w.index);
    }
  }

  // --- Obim.
  const build = weeks.filter(isBuild);
  if (build[0] && Math.abs(build[0].targetKm - plan.startKm) > 0.05)
    err(
      'VOLUME_START',
      `Prva nedelja ${build[0].targetKm} km ≠ trenutni obim ${plan.startKm} km.`,
      1
    );
  let last: PlanWeek | null = null;
  for (const w of build) {
    if (w.deload) continue;
    if (last && w.targetKm > last.targetKm * (1 + P.volume.maxBuildGrowth) + 0.05)
      err(
        'VOLUME_GROWTH',
        `Rast ${last.targetKm} → ${w.targetKm} km > ${P.volume.maxBuildGrowth * 100}%.`,
        w.index
      );
    last = w;
  }
  const peak = Math.max(...build.map((w) => w.targetKm));
  const peakCap = Math.min(plan.startKm * P.volume.peakCapFactor, P.volume.fourDayMaxWeekKm);
  if (peak > peakCap + 0.05)
    err(
      'VOLUME_PEAK',
      `Vrh ${peak} km > min(${P.volume.peakCapFactor} × ${plan.startKm}, ${P.volume.fourDayMaxWeekKm}) km.`
    );
  for (const w of weeks) {
    const prev = weeks[w.index - 2];
    if (w.deload && prev) {
      const f = w.targetKm / prev.targetKm;
      if (Math.abs(f - P.volume.deloadFactor) > fTol)
        err('VOLUME_DELOAD', `Rasterećenje ${f.toFixed(2)} × prethodne.`, w.index);
    }
    if (w.phase === 'taper' && w.taperStep) {
      const f = w.targetKm / peak;
      if (Math.abs(f - P.volume.taperFactors[w.taperStep - 1]!) > fTol)
        err('VOLUME_TAPER', `Taper ${w.taperStep}: ${f.toFixed(2)} × vrh.`, w.index);
    }
    if (w.phase === 'race') {
      const f = w.targetKm / peak;
      if (Math.abs(f - P.volume.raceWeekFactor) > fTol)
        err('VOLUME_RACE_WEEK', `Trkačka nedelja ${f.toFixed(2)} × vrh.`, w.index);
    }
  }

  // --- Kvalitet: budžeti, udeli, dužine ponavljanja, donji prag u vrhuncu.
  for (const w of weeks) {
    if (JSON.stringify(w.budgets) !== JSON.stringify(qualityBudgets(w.targetKm)))
      err('BUDGETS', 'Budžeti kvaliteta ne odgovaraju udelima iz policy.ts.', w.index);
    const base = w.plannedKm;
    const sum = { I: 0, T: 0, R: 0 };
    const bout = { I: 0, T: 0, R: 0 };
    for (const d of w.days) {
      if (!d.countsToWeek) continue;
      const k = d.workout.workKm;
      sum.I += k.I + k.RP;
      sum.T += k.T;
      sum.R += k.R;
      const b = d.workout.maxBoutSec;
      bout.I = Math.max(bout.I, b.I, b.RP);
      bout.T = Math.max(bout.T, b.T);
      // Ubrzanja (stride) su R tempo, ali ih ne računamo u R udeo; trajanje im se ipak proverava.
      bout.R = Math.max(bout.R, b.R);
    }
    if (sum.I > base * q.iMaxShare + EPS)
      err('I_SHARE', `I/RP ${sum.I.toFixed(2)} km > ${q.iMaxShare * 100}% od ${base} km.`, w.index);
    if (sum.T > base * q.tMaxShare + EPS)
      err('T_SHARE', `T ${sum.T.toFixed(2)} km > ${q.tMaxShare * 100}% od ${base} km.`, w.index);
    if (sum.R > base * q.rMaxShare + EPS)
      err('R_SHARE', `R ${sum.R.toFixed(2)} km > ${q.rMaxShare * 100}% od ${base} km.`, w.index);
    if (bout.I > q.iRepMaxSec)
      err('I_REP', `I/RP ponavljanje ${bout.I} s > ${q.iRepMaxSec} s.`, w.index);
    if (bout.T > q.tContinuousMaxSec)
      err('T_CONTINUOUS', `T blok ${bout.T} s > ${q.tContinuousMaxSec} s.`, w.index);
    if (bout.R > q.rRepMaxSec)
      err('R_REP', `R ponavljanje ${bout.R} s > ${q.rRepMaxSec} s.`, w.index);
    if (w.phase === 'peak' && !w.deload) {
      const main = w.days.find((d) => d.role === 'q1');
      const work = main ? main.workout.workKm.I : 0;
      const need = w.budgets.I * q.peakMainMinShareOfBudget;
      if (work + EPS < need)
        err(
          'PEAK_MAIN_FLOOR',
          `Glavni I ${work} km < ${(q.peakMainMinShareOfBudget * 100).toFixed(0)}% budžeta (${need.toFixed(2)} km).`,
          w.index
        );
    }
  }

  // --- Dugi, lagani, zagrevanje/hlađenje.
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (long) {
      const lw = long.workout;
      if (lw.km > w.plannedKm * P.long.maxShare + EPS)
        err(
          'LONG_SHARE',
          `Dugi ${lw.km} km > ${P.long.maxShare * 100}% od ${w.plannedKm} km.`,
          w.index,
          long.date
        );
      if (lw.km * plan.paces.E.slow > P.long.maxSec)
        err(
          'LONG_DURATION',
          `Dugi ${lw.km} km sporijim E tempom > ${P.long.maxSec / 60} min.`,
          w.index,
          long.date
        );
      if (lw.segments.some((s) => s.zone !== 'E' || s.kind !== 'long'))
        err(
          'LONG_NOT_EASY',
          'Dugi trk sme biti samo lagan, bez brzog završetka.',
          w.index,
          long.date
        );
      for (const d of w.days)
        if (d.role === 'easy' && d.workout.km > lw.km + EPS)
          warn(
            'EASY_LONGER_THAN_LONG',
            `Lagan ${d.workout.km} km duži od dugog ${lw.km} km (${d.date}).`,
            w.index
          );
    }
    for (const d of w.days) {
      const easyMin = w.phase === 'taper' || w.phase === 'race' ? P.easy.taperMinKm : P.easy.minKm;
      if (d.role === 'easy' && d.workout.km + EPS < easyMin)
        err('EASY_MIN', `Lagan trk ${d.workout.km} km < ${easyMin} km.`, w.index, d.date);
      if (d.workout.kind !== 'quality' && d.workout.kind !== 'race') continue;
      const band = d.workout.kind === 'race' ? P.warmup.race : warmupBand(w.targetKm);
      for (const s of d.workout.segments) {
        if (s.kind === 'warmup' && Math.abs(s.km - band.warmupKm) > EPS)
          err(
            'WARMUP',
            `Zagrevanje ${s.km} km ≠ ${band.warmupKm} km za ${w.targetKm} km nedeljno.`,
            w.index,
            d.date
          );
        if (s.kind === 'cooldown' && Math.abs(s.km - band.cooldownKm) > EPS)
          err(
            'COOLDOWN',
            `Hlađenje ${s.km} km ≠ ${band.cooldownKm} km za ${w.targetKm} km nedeljno.`,
            w.index,
            d.date
          );
      }
    }
  }
  return out;
}
