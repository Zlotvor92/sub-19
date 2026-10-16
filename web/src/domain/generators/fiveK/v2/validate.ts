/* Provera plana prema policy.ts. SAMO prijavljuje prekršaje; plan se ne menja. */

import { daysBetween, mustDay } from './dates.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import type { FiveKV2Plan, Phase, PlanWeek, QualityType, Violation } from './types.ts';
import { fourDayCapacityKm, peakKm } from './volume.ts';
import { baseDoseKey, qualityBudgets, tMaxSec, warmupBand } from './workouts.ts';

const PHASE_ORDER: readonly Phase[] = ['base', 'peak', 'sharpen', 'taper', 'race'];
const PHASE_QUALITY: Readonly<Record<Phase, readonly QualityType[]>> = {
  base: ['R', 'T_short', 'T_cruise'],
  peak: ['I', 'T_cruise', 'T_short'],
  sharpen: ['RP', 'R_sharpen'],
  taper: ['RP', 'T_short'],
  race: ['RP_sharpener']
};
const EPS = 1e-6;
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'peak' || w.phase === 'sharpen';
/** Glavni rad nedelje: I u vrhuncu, RP u oštrenju (dan q1). */
const mainWork = (w: PlanWeek): number => {
  const k = w.days.find((d) => d.role === 'q1')?.workout.workKm;
  return k ? (w.phase === 'sharpen' ? k.RP : k.I) : 0;
};
/** 2.2.0: rasteretna nedelja sme zameniti glavni kvalitet kratkim T ili R (Odluka 5). */
const DELOAD_SUBSTITUTES: readonly QualityType[] = ['T_short', 'R'];
/** Nedeljna doza baze (R km, oblik T, T km), isti ključ kao generator. */
const baseKey = (w: PlanWeek): string => {
  const q = w.days.filter((d) => d.workout.kind === 'quality');
  const r = q.reduce((a, d) => a + d.workout.workKm.R, 0);
  const t = q.find((d) => d.workout.workKm.T > 0)?.workout;
  return baseDoseKey(
    r,
    t?.qualityType === 'T_cruise' ? 'cruise' : 'continuous',
    t ? t.workKm.T : 0
  );
};
/** Par kvaliteta nedelje (struktura blokova, bez datuma). */
const qualityKey = (w: PlanWeek): string =>
  JSON.stringify(
    w.days
      .filter((d) => d.workout.kind === 'quality')
      .map((d) => [d.workout.qualityType, d.workout.blocks])
  );

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
        if (
          qd.workout.qualityType &&
          !PHASE_QUALITY[w.phase].includes(qd.workout.qualityType) &&
          !(w.deload && DELOAD_SUBSTITUTES.includes(qd.workout.qualityType))
        )
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
      // 2.2.0 (Odluka 6): lagan dan ≤ 50 min i ≤ 50% dugog iz prethodne nedelje.
      const prevLong = weeks[w.index - 2]?.days.find((d) => d.role === 'long')?.workout.km ?? 0;
      const easyCap = Math.min(
        P.easy.raceWeekMaxSec / plan.paces.E.slow,
        prevLong * P.easy.raceWeekMaxShareOfPrevLong
      );
      for (const d of w.days)
        if (d.role === 'easy' && d.workout.km > easyCap + EPS)
          err(
            'RACE_WEEK_EASY',
            `Lagan ${d.workout.km} km > min(50 min, 50% dugog ${prevLong} km).`,
            w.index,
            d.date
          );
      const eve = w.days.find((d) => daysBetween(d.date, plan.input.raceDate) === 1);
      if (eve) {
        const strides = eve.workout.segments.filter((x) => x.kind === 'stride');
        if (
          eve.workout.kind !== 'easy' ||
          eve.workout.km > P.easy.raceEveMaxKm + EPS ||
          strides.length !== q.strides.reps ||
          strides.some((x) => x.sec !== q.strides.sec)
        )
          err(
            'RACE_EVE',
            `Dan pred trku mora biti lagan ≤ ${P.easy.raceEveMaxKm} km + ${q.strides.reps} × ${q.strides.sec} s ubrzanja.`,
            w.index,
            eve.date
          );
      }
    }
    for (const d of w.days)
      for (const x of d.workout.segments)
        if (x.kind === 'recovery' && x.secBasis === 'exact' && x.sec % q.recovery.roundSec !== 0)
          err(
            'RECOVERY_ROUNDING',
            `Oporavak ${x.sec} s nije deljiv sa ${q.recovery.roundSec} s.`,
            w.index,
            d.date
          );
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
    const long = w.days.find((d) => d.role === 'long');
    const easy = w.days.filter((d) => d.role === 'easy');
    // 2.1.0: planirano < cilj je dozvoljeno samo kad su SVI lagani dani tačno dužine dugog.
    const cappedOk =
      w.easyCappedAtLong &&
      long !== undefined &&
      easy.length > 0 &&
      easy.every((d) => Math.abs(d.workout.km - long.workout.km) < tolKm) &&
      w.plannedKm < w.targetKm;
    if (w.easyCappedAtLong && !cappedOk)
      err('EASY_CAP', 'Oznaka „lagan = dugi" ne odgovara danima nedelje.', w.index);
    if (cappedOk)
      warn(
        'PLANNED_BELOW_TARGET',
        `Planirano ${w.plannedKm} km < cilj ${w.targetKm} km (lagan = dugi ${long.workout.km} km).`,
        w.index
      );
    else if (dev > P.tolerance.plannedVsTarget + EPS) {
      const msg = `Planirano ${w.plannedKm} km vs cilj ${w.targetKm} km.`;
      if (w.phase === 'race') warn('PLANNED_VS_TARGET', msg, w.index);
      else err('PLANNED_VS_TARGET', msg, w.index);
    }
    // Uslov 8: degenerisan plan — nedelja ispod minimalnog smislenog obima, prazan trening.
    const minKm = w.phase === 'race' ? P.week.minRaceWeekKm : P.week.minTrainingKm;
    if (w.plannedKm + EPS < minKm)
      err('WEEK_MIN_VOLUME', `Nedelja ${w.plannedKm} km < ${minKm} km.`, w.index);
    for (const d of w.days)
      if (
        d.workout.segments.length === 0 ||
        d.workout.km <= 0 ||
        d.workout.sec <= 0 ||
        d.workout.segments.some((x) => x.km <= 0 || x.sec <= 0)
      )
        err('EMPTY_WORKOUT', 'Prazan trening ili segment bez km/trajanja.', w.index, d.date);
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
  if (peak > peakKm(plan.startKm) + 0.05)
    err('VOLUME_PEAK', `Vrh ${peak} km > peakKm(${plan.startKm}) = ${peakKm(plan.startKm)} km.`);
  // 2.2.0 (Odluka 1): kapacitet 4 dana — svaki cilj ≤ kapaciteta; start = min(trenutni, kapacitet).
  const capacity = fourDayCapacityKm(plan.paces);
  if (Math.abs(plan.capacityKm - capacity) > EPS)
    err('VOLUME_CAPACITY', `Kapacitet plana ${plan.capacityKm} km ≠ ${capacity} km iz tempa.`);
  for (const w of weeks)
    if (w.targetKm > capacity + EPS)
      err('VOLUME_CAPACITY', `Cilj ${w.targetKm} km > kapacitet 4 dana ${capacity} km.`, w.index);
  if (Math.abs(plan.startKm - Math.min(plan.input.currentWeeklyKm, capacity)) > 0.05)
    err(
      'VOLUME_START',
      `Start ${plan.startKm} km ≠ min(trenutni obim, kapacitet ${capacity} km).`,
      1
    );
  if (plan.input.currentWeeklyKm > capacity + 0.05)
    warn(
      'START_ABOVE_CAPACITY',
      `Trenutni obim ${plan.input.currentWeeklyKm} km > kapacitet 4 dana ${capacity} km; plan kreće od kapaciteta.`,
      1
    );
  // 2.2.0 (Odluka 2): rasterećenje nije prva nedelja faze.
  for (const w of weeks) {
    const prev = weeks[w.index - 2];
    if (w.deload && (!prev || prev.phase !== w.phase))
      err('DELOAD_PHASE_START', `Rasterećenje u prvoj nedelji faze ${w.phase}.`, w.index);
  }
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
    // 2.1.0: udeli se mere od ciljnog km (isti osnov kao budžeti); planirano < cilj samo kad je lagan = dugi.
    const base = w.targetKm;
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
    if (bout.T > tMaxSec(w.phase))
      err('T_CONTINUOUS', `T blok ${bout.T} s > ${tMaxSec(w.phase)} s (${w.phase}).`, w.index);
    if (bout.R > q.rRepMaxSec)
      err('R_REP', `R ponavljanje ${bout.R} s > ${q.rRepMaxSec} s.`, w.index);
    if ((w.phase === 'peak' || w.phase === 'sharpen') && !w.deload) {
      const zone = w.phase === 'peak' ? 'I' : 'RP';
      const work = mainWork(w);
      const need = w.budgets.I * q.mainMinShareOfBudget;
      if (work + EPS < need)
        err(
          w.phase === 'peak' ? 'PEAK_MAIN_FLOOR' : 'SHARPEN_MAIN_FLOOR',
          `Glavni ${zone} ${work} km < ${(q.mainMinShareOfBudget * 100).toFixed(0)}% budžeta (${need.toFixed(2)} km).`,
          w.index
        );
    }
  }

  // --- 2.1.0 progresija doze i ponavljanje para kvaliteta (ne-rasteretne nedelje izgradnje).
  const steady = weeks.filter((w) => isBuild(w) && !w.deload);
  for (let i = 1; i < steady.length; i++) {
    const a = steady[i - 1]!;
    const b = steady[i]!;
    // 2.2.0: I u vrhuncu neopadajući (zadržan I uz promenu T), RP u oštrenju strogo raste.
    const strict = b.phase === 'sharpen';
    if (a.phase === b.phase && (b.phase === 'peak' || strict))
      if (strict ? mainWork(b) <= mainWork(a) + EPS : mainWork(b) + EPS < mainWork(a))
        err(
          'DOSE_PROGRESSION',
          `Glavni ${strict ? 'RP' : 'I'} rad ${mainWork(b)} km ${strict ? 'nije veći od' : 'manji od'} prethodne nedelje (${mainWork(a)} km).`,
          b.index
        );
    if (qualityKey(a) === qualityKey(b))
      err('QUALITY_REPEAT', `Isti par kvaliteta kao nedelja ${a.index}.`, b.index);
  }
  // 2.2.0 (Odluka 3): nema dugog platoa u bazi — 3 uzastopne ne-rasteretne nedelje iste doze.
  const baseSteady = steady.filter((w) => w.phase === 'base');
  for (let i = P.quality.baseSameDoseMaxWeeks; i < baseSteady.length; i++) {
    const run = baseSteady.slice(i - P.quality.baseSameDoseMaxWeeks, i + 1).map(baseKey);
    if (run.every((k) => k === run[0]))
      err(
        'BASE_PLATEAU',
        `${run.length} uzastopne ne-rasteretne nedelje baze iste doze (${run[0]}).`,
        baseSteady[i]!.index
      );
  }

  // --- Dugi, lagani, zagrevanje/hlađenje.
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (long) {
      const lw = long.workout;
      if (lw.km > w.targetKm * P.long.maxShare + EPS)
        err(
          'LONG_SHARE',
          `Dugi ${lw.km} km > ${P.long.maxShare * 100}% od cilja ${w.targetKm} km.`,
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
          err(
            'EASY_LONGER_THAN_LONG',
            `Lagan ${d.workout.km} km duži od dugog ${lw.km} km.`,
            w.index,
            d.date
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
