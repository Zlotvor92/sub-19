/* Provera plana prema policy.ts. SAMO prijavljuje prekršaje; plan se ne menja.
   2.5.0: adaptiran plan (plan.adaptation) — tempo i trkač po nedelji (steps.ts), obim od starta svakog
   koraka, ograničenja po datumima (LIMITS); nedelje iz mixedWeeks proveravaju se samo na nivou dana. */

import { daysBetween, mustDay } from './dates.ts';
import { isShortPrep, periodize, phaseCounts, testWeekOf } from './periodize.ts';
import { isRunDaysCount, FIVE_K_V2_POLICY as P, rulesOf, type Athlete } from './policy.ts';
import { athleteAt, baseAthlete, doseResetAt, inRange, pacesAt, vdotAt } from './steps.ts';
import type { FiveKV2Plan, PaceModel, Phase, PlanWeek, QualityType, Violation } from './types.ts';
import { adaptFloorKm, capacityKm, fitTargetKm, peakKm, planVolume } from './volume.ts';
import { baseDoseKey, qualityBudgets, tFormOf, tMaxSec, warmupBand } from './workouts.ts';

const PHASE_ORDER: readonly Phase[] = ['base', 'peak', 'sharpen', 'taper', 'race'];
/** 2.4.0: + treninzi po osećaju (feel.ts) i kontrolno trčanje (samo nedelja testa, v. TEST_WEEK). */
const PHASE_QUALITY: Readonly<Record<Phase, readonly QualityType[]>> = {
  base: ['R', 'T_short', 'T_cruise', 'HILLS', 'TEMPO_FEEL', 'FARTLEK', 'TEST_3K'],
  peak: ['I', 'T_cruise', 'T_short', 'FARTLEK', 'TEMPO_FEEL', 'HILLS', 'TEST_3K'],
  sharpen: ['RP', 'R_sharpen', 'FARTLEK_RP', 'HILLS', 'TEST_3K'],
  taper: ['RP', 'T_short', 'FARTLEK_RP', 'TEMPO_FEEL', 'FARTLEK'],
  race: ['RP_sharpener', 'FARTLEK_RP']
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
const DELOAD_SUBSTITUTES: readonly QualityType[] = ['T_short', 'R', 'TEMPO_FEEL', 'HILLS'];
/** Nedeljna doza baze (R km, oblik T, T km), isti ključ kao generator. */
const baseKey = (w: PlanWeek): string => {
  const q = w.days.filter((d) => d.workout.kind === 'quality');
  const r = q.reduce((a, d) => a + d.workout.workKm.R, 0);
  const t = q.find((d) => d.workout.workKm.T > 0)?.workout;
  return baseDoseKey(r, t ? tFormOf(t) : 'continuous', t ? t.workKm.T : 0);
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
  const nDays = plan.input.runDays.length;
  if (!isRunDaysCount(nDays)) {
    err('RUN_DAYS', `Nepodržan broj dana trčanja (${nDays}).`);
    return out;
  }
  // 2.4.0: trkač iz plana (početnik, po osećaju) i njegova pravila (rulesOf).
  const a: Athlete = {
    days: nDays,
    beginner: plan.experience === 'beginner',
    feel: plan.paceMode === 'feel'
  };
  const rule = rulesOf(a);
  const intro = (w: PlanWeek): boolean =>
    a.beginner && w.index <= P.beginner.introWeeks && isBuild(w);
  // 2.5.0: adaptacija — koraci, mešovite nedelje, tempo/trkač nedelje.
  const ad = plan.adaptation;
  const steps = ad?.steps ?? [];
  const mixed = new Set(ad?.mixedWeeks ?? []);
  const checked = (w: PlanWeek): boolean => !mixed.has(w.index);
  const pw = (w: PlanWeek): PaceModel => (ad ? pacesAt(plan.input, steps, w.index) : plan.paces);
  const aw = (w: PlanWeek): Athlete => (ad ? athleteAt(plan.input, steps, w.index) : a);
  const forcedDeload = (w: PlanWeek): boolean =>
    steps.some((s) => s.deload && s.fromWeek === w.index);
  const restartAt = (i: number): boolean => steps.some((s) => s.restart && s.fromWeek === i);
  const limited = (w: PlanWeek): boolean =>
    (w.limits?.rest?.length ?? 0) > 0 || (w.limits?.pain?.length ?? 0) > 0;

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
      if (PHASE_ORDER.indexOf(w.phase) < PHASE_ORDER.indexOf(prev.phase) && !restartAt(w.index))
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
  const counts = phaseCounts(weeks.length);
  if (taperWeeks.length !== counts.taper)
    err('PHASES', `Taper mora trajati ${counts.taper} nedelja (plan od ${weeks.length}).`);
  // 2.3.0: kratka priprema (6–7 nedelja) nema rasterećenja.
  if (isShortPrep(weeks.length) && weeks.some((w) => w.deload && !forcedDeload(w)))
    err('DELOAD_SHORT', 'Kratka priprema ne sme imati rasteretnu nedelju.');
  const races = weeks.flatMap((w) => w.days.filter((d) => d.role === 'race'));
  if (races.length !== 1 || races[0]!.date !== plan.input.raceDate)
    err('RACE_DAY', 'Trka mora biti jednom, na dan trke (poslednji dan plana).');

  // --- Dani: 3/4/5 dana trčanja (tabela days), uloge, nesusedni zahtevni dani.
  for (const w of weeks) {
    const roles = w.days.map((d) => d.role);
    const qualities = w.days.filter((d) => d.workout.kind === 'quality');
    for (const d of w.days) {
      if (d.role !== 'race' && !runDays.has(d.weekday))
        err('RUN_DAYS', `Trening na dan koji nije izabran (${d.weekday}).`, w.index, d.date);
      for (const qd of [d])
        if (
          checked(w) &&
          qd.workout.qualityType &&
          !PHASE_QUALITY[w.phase].includes(qd.workout.qualityType) &&
          !(
            (w.deload || w.limits?.quality === 'one') &&
            DELOAD_SUBSTITUTES.includes(qd.workout.qualityType)
          )
        )
          err(
            'PHASE_QUALITY',
            `${qd.workout.qualityType} ne pripada fazi ${w.phase}.`,
            w.index,
            d.date
          );
    }
    if (!checked(w)) continue;
    const lim = w.limits;
    if (w.phase !== 'race') {
      // 2.5.0: dani odmora se ne prave; uz bol/odmor kvaliteta može biti manje (nikad više).
      const restN = lim?.rest?.length ?? 0;
      if (w.days.length !== nDays - restN)
        err('RUN_DAYS', `Nedelja ima ${w.days.length} treninga umesto ${nDays - restN}.`, w.index);
      const longs = roles.filter((r) => r === 'long').length;
      if (restN > 0 ? longs > 1 : longs !== 1)
        err('ROLES', 'Nedelja mora imati tačno jedan dugi trk.', w.index);
      const oneQuality =
        w.deload || w.taperStep === 2 || rule.qualityDays === 1 || lim?.quality === 'one';
      const expectedQ =
        w.stridesOnly || lim?.quality === 'none' ? 0 : oneQuality ? 1 : rule.qualityDays;
      if (limited(w) ? qualities.length > expectedQ : qualities.length !== expectedQ)
        err('ROLES', `Nedelja ima ${qualities.length} kvaliteta umesto ${expectedQ}.`, w.index);
      // 2.3.0 (Odluka 5): nedelja samo sa ubrzanjima je rasteretna i ima tačno jedan lagan dan sa
      // stridesOnly ubrzanjima.
      if (w.stridesOnly) {
        const so = q.deloadSubstitute.stridesOnly;
        const ok = w.days.filter((d) => {
          const st = d.workout.segments.filter((x) => x.kind === 'stride');
          return d.role === 'easy' && st.length === so.reps && st.every((x) => x.sec === so.sec);
        });
        if (!(w.deload || intro(w) || lim?.quality === 'one') || ok.length !== 1)
          err(
            'DELOAD_STRIDES_ONLY',
            `Nedelja samo sa ubrzanjima mora biti rasteretna (ili 1–2 početnika), sa jednim laganim danom + ${so.reps} × ${so.sec} s.`,
            w.index
          );
      }
      // 2.4.0: početnik — nedelje 1–2 bez kvaliteta (samo lagano + ubrzanja). 2.5.0: uz bol/odmor
      // ubrzanja mogu izostati.
      if (intro(w) && (qualities.length > 0 || (!w.stridesOnly && !limited(w))))
        err('BEGINNER_INTRO', 'Nedelje 1–2 početnika moraju biti bez kvaliteta.', w.index);
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
      const easyCap = Math.max(
        P.easy.taperMinKm,
        Math.min(P.easy.raceWeekMaxSec / pw(w).E.slow, prevLong * P.easy.raceWeekMaxShareOfPrevLong)
      );
      // 2.5.0: prethodna mešovita nedelja (dugi iz prethodnog plana) — granica je iz konstrukcije.
      for (const d of w.days)
        if (!mixed.has(w.index - 1) && d.role === 'easy' && d.workout.km > easyCap + EPS)
          err(
            'RACE_WEEK_EASY',
            `Lagan ${d.workout.km} km > min(50 min, 50% dugog ${prevLong} km).`,
            w.index,
            d.date
          );
      const eve = w.days.find((d) => daysBetween(d.date, plan.input.raceDate) === 1);
      if (eve) {
        const strides = eve.workout.segments.filter((x) => x.kind === 'stride');
        // 2.5.0: dan pred trku u periodu bola — bez ubrzanja.
        const hurt = lim?.pain?.includes(eve.date) ?? false;
        if (
          eve.workout.kind !== 'easy' ||
          eve.workout.km > P.easy.raceEveMaxKm + EPS ||
          strides.length !== (hurt ? 0 : q.strides.reps) ||
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

  // --- 2.4.0: plan po osećaju, početnik, kontrolno trčanje.
  // 2.5.0: VDOT budućnosti = rezultat ulaza ili poslednji primenjen rezultat adaptacije.
  const vNow = vdotAt(plan.input, steps, weeks.length);
  if (a.feel !== (vNow === null) || (plan.paces.vdot === null) !== a.feel || plan.vdot !== vNow)
    err(
      'PACE_MODE',
      'Način tempa ne odgovara ulazu (po osećaju ⇔ nema rezultata mlađeg od 12 nedelja ni novog rezultata).'
    );
  if (a.feel) {
    const e = plan.input.typicalEasyPaceSecPerKm ?? NaN;
    const s = P.feel.easySpreadSec;
    if (plan.paces.E.fast !== Math.round(e) - s || plan.paces.E.slow !== Math.round(e) + s)
      err('FEEL_EASY_PACE', `E mora biti uobičajen lagan tempo ± ${s} s.`);
    if (plan.predicted5kSec !== null || plan.vdot !== null)
      err('FEEL_FORECAST', 'Plan po osećaju nema prognozu ni VDOT (nedovoljno podataka).');
    if (plan.goal && (plan.goal.status !== 'insufficient_data' || plan.goal.goalVdot !== null))
      err('FEEL_GOAL', 'Cilj bez pouzdanog rezultata: samo „nedovoljno podataka", bez broja.');
  }
  if (a.beginner && plan.goal?.status === 'feasible')
    err('BEGINNER_GOAL', 'Početnik: cilj najviše „orijentir", nikad „izvodljiv".');
  for (const w of weeks)
    for (const d of w.days) {
      if (a.beginner && (d.workout.workKm.I > 0 || d.workout.qualityType === 'I'))
        err('BEGINNER_NO_I', 'Početnik: bez I u celom planu.', w.index, d.date);
      // Bez rezultata nema brojčanog tempa van E (procena km je E tempom).
      if (aw(w).feel)
        for (const x of d.workout.segments)
          if (x.zone !== 'E' && x.zone !== 'jog' && (x.paceSecPerKm !== null || !x.effort))
            err(
              'FEEL_NUMERIC_PACE',
              `Segment ${x.kind} (${x.zone}) ima brojčani tempo.`,
              w.index,
              d.date
            );
    }
  const testWeeks = weeks.filter((w) => w.days.some((d) => d.workout.qualityType === 'TEST_3K'));
  const expectTest = a.feel ? testWeekOf(weeks) : null;
  // 2.5.0: posle adaptacije test najviše jednom, samo u nedelji po osećaju, oznaka ⇔ trening.
  if (ad) {
    const flagged = weeks.filter((w) => w.test);
    if (
      flagged.length > 1 ||
      testWeeks.length > 1 ||
      flagged.some((w) => !aw(w).feel) ||
      weeks.some((w) => checked(w) && w.test !== testWeeks.includes(w))
    )
      err('TEST_WEEK', 'Adaptiran plan: kontrolno trčanje najviše jednom, u nedelji po osećaju.');
  } else if (
    testWeeks.length !== (expectTest === null ? 0 : 1) ||
    (expectTest !== null && testWeeks[0]!.index !== expectTest) ||
    weeks.some((w) => w.test !== (w.index === expectTest))
  )
    err(
      'TEST_WEEK',
      a.feel
        ? `Plan po osećaju: kontrolno trčanje tačno jednom, u nedelji ${expectTest ?? '—'} (3. ili 4., ne rasteretna).`
        : 'Plan sa rezultatom nema kontrolno trčanje.'
    );

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
    for (const d of w.days)
      if (
        d.workout.segments.length === 0 ||
        d.workout.km <= 0 ||
        d.workout.sec <= 0 ||
        d.workout.segments.some((x) => x.km <= 0 || x.sec <= 0)
      )
        err('EMPTY_WORKOUT', 'Prazan trening ili segment bez km/trajanja.', w.index, d.date);
    if (!checked(w)) continue;
    const dev = Math.abs(w.plannedKm - w.targetKm) / w.targetKm;
    // 2.3.0 (Odluka 4): u trkačkoj nedelji cilj = planirano (granica je VOLUME_RACE_WEEK).
    if (w.phase === 'race' && Math.abs(w.plannedKm - w.targetKm) > tolKm)
      err(
        'PLANNED_VS_TARGET',
        `Trkačka nedelja: cilj ${w.targetKm} km ≠ planirano ${w.plannedKm} km.`,
        w.index
      );
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
    else if (limited(w) && w.plannedKm <= w.targetKm + tolKm)
      warn(
        'PLANNED_BELOW_TARGET_LIMITS',
        `Planirano ${w.plannedKm} km < cilj obima ${w.targetKm} km (odmor/bol, adaptacija).`,
        w.index
      );
    else if (w.phase !== 'race' && dev > P.tolerance.plannedVsTarget + EPS)
      err('PLANNED_VS_TARGET', `Planirano ${w.plannedKm} km vs cilj ${w.targetKm} km.`, w.index);
    // Uslov 8: degenerisan plan — nedelja ispod minimalnog smislenog obima, prazan trening.
    // 2.5.0: nedelja sa danima odmora (bol ≥ 7) je namerno manja.
    const minKm = w.phase === 'race' ? P.week.minRaceWeekKm : rule.minWeekKm;
    if (w.plannedKm + EPS < minKm && !(w.limits?.rest?.length ?? 0))
      err('WEEK_MIN_VOLUME', `Nedelja ${w.plannedKm} km < ${minKm} km.`, w.index);
  }

  // --- Obim. 2.5.0: posle adaptacije rast se meri od cilja koraka (startKm u nedelji fromWeek), vrh od
  // starta plana ili novog starta (pauza ≥ 28), taper/trkačka nedelja od vrha koraka (volume.adaptVolume).
  const build = weeks.filter(isBuild);
  const capacity = capacityKm(plan.paces, a);
  if (Math.abs(plan.capacityKm - capacity) > EPS)
    err('VOLUME_CAPACITY', `Kapacitet plana ${plan.capacityKm} km ≠ ${capacity} km iz tempa.`);
  const capOf = (w: PlanWeek): number => (ad ? capacityKm(pw(w), aw(w)) : capacity);
  const fit = (w: PlanWeek, t: number): number =>
    fitTargetKm(Math.round(t * 10) / 10, pw(w), aw(w));
  const startRef = (i: number): number => {
    let x = plan.startKm;
    for (const st of steps)
      if (st.restart && st.startKm !== null && st.fromWeek <= i) x = st.startKm;
    return x;
  };
  const resetKm = (i: number): number | null => {
    let x: number | null = null;
    for (const st of steps) if (st.startKm !== null && st.fromWeek === i) x = st.startKm;
    return x;
  };
  const buildMax = (from: number): number =>
    Math.max(...build.filter((w) => w.index >= from).map((w) => w.targetKm));
  const peakRefAt = (i: number): number => {
    let from = 1;
    let cap: number | null = null;
    let ref = buildMax(1);
    for (const st of steps) {
      if (st.firstWeek > i) break;
      if (st.startKm !== null) {
        const fw = weeks[st.fromWeek - 1];
        if (fw && isBuild(fw)) {
          from = st.fromWeek;
          cap = null;
        } else cap = Math.min(ref, st.startKm);
      }
      ref = cap ?? buildMax(from);
    }
    return ref;
  };
  if (!ad && build[0] && Math.abs(build[0].targetKm - plan.startKm) > 0.05)
    err(
      'VOLUME_START',
      `Prva nedelja ${build[0].targetKm} km ≠ trenutni obim ${plan.startKm} km.`,
      1
    );
  let last: PlanWeek | null = null;
  for (const w of build) {
    const reset = resetKm(w.index);
    if (reset !== null) {
      if (checked(w) && w.targetKm > reset + 0.05)
        err('VOLUME_RESET', `Cilj ${w.targetKm} km > cilj adaptacije ${reset} km.`, w.index);
      last = w;
      continue;
    }
    if (w.deload) continue;
    if (
      last &&
      checked(w) &&
      checked(last) &&
      w.targetKm > last.targetKm * (1 + rule.maxBuildGrowth) + 0.05
    )
      err(
        'VOLUME_GROWTH',
        `Rast ${last.targetKm} → ${w.targetKm} km > ${rule.maxBuildGrowth * 100}%.`,
        w.index
      );
    last = w;
  }
  // 2.2.0 (Odluka 1), 2.3.0: kapacitet n dana — svaki cilj ≤ kapaciteta; start = min(trenutni, kapacitet).
  for (const w of build) {
    if (!checked(w)) continue;
    const peakCap = peakKm(startRef(w.index), capOf(w), aw(w));
    if (w.targetKm > peakCap + 0.05)
      err(
        'VOLUME_PEAK',
        `Cilj ${w.targetKm} km > peakKm(${startRef(w.index)}) = ${peakCap} km.`,
        w.index
      );
  }
  for (const w of weeks)
    if (checked(w) && w.targetKm > capOf(w) + EPS)
      err(
        'VOLUME_CAPACITY',
        `Cilj ${w.targetKm} km > kapacitet ${nDays} dana ${capOf(w)} km.`,
        w.index
      );
  // 2.4.1 (Odluka 2): cilj u rupi izvodljivih → fitTargetKm (start, rasterećenje, taper).
  if (!ad) {
    const w1 = weeks[0]!;
    if (Math.abs(plan.startKm - fit(w1, Math.min(plan.input.currentWeeklyKm, capacity))) > 0.05)
      err(
        'VOLUME_START',
        `Start ${plan.startKm} km ≠ min(trenutni obim, kapacitet ${capacity} km).`,
        1
      );
    if (plan.input.currentWeeklyKm > capacity + 0.05)
      warn(
        'START_ABOVE_CAPACITY',
        `Trenutni obim ${plan.input.currentWeeklyKm} km > kapacitet ${nDays} dana ${capacity} km; plan kreće od kapaciteta.`,
        1
      );
  }
  // 2.2.0 (Odluka 2): rasterećenje nije prva nedelja faze (2.5.0: osim prisilnog, umor).
  for (const w of weeks) {
    const prev = weeks[w.index - 2];
    if (checked(w) && w.deload && !forcedDeload(w) && (!prev || prev.phase !== w.phase))
      err('DELOAD_PHASE_START', `Rasterećenje u prvoj nedelji faze ${w.phase}.`, w.index);
  }
  // 2.5.0: donja granica adaptiranog cilja (volume.adaptFloorKm) od cilja nedelje u planu generatora.
  const a0 = baseAthlete(plan.input);
  const base0 = ad
    ? planVolume(
        periodize(plan.input.startDate, weeks.length, rulesOf(a0).deloadEvery, a0.feel),
        plan.input.currentWeeklyKm,
        pacesAt(plan.input, [], 1),
        a0
      ).targets
    : [];
  const floored = (w: PlanWeek): boolean =>
    ad !== undefined &&
    (Math.abs(w.targetKm - fit(w, adaptFloorKm(base0[w.index - 1]!, aw(w)))) < EPS ||
      Math.abs(w.targetKm - fit(w, capOf(w))) < EPS);
  const raceWeek = weeks[weeks.length - 1]!;
  const raceBound = Math.round(peakRefAt(raceWeek.index) * P.volume.raceWeekFactor * 10) / 10;
  for (const w of weeks) {
    if (!checked(w)) continue;
    // Rasterećenje se meri od poslednje ne-rasteretne nedelje (u generatoru: prethodna).
    const prev =
      weeks
        .slice(0, w.index - 1)
        .reverse()
        .find((x) => !x.deload) ?? weeks[w.index - 2];
    if (w.deload && prev) {
      const f = w.targetKm / prev.targetKm;
      const fitted = Math.abs(w.targetKm - fit(w, prev.targetKm * P.volume.deloadFactor)) < EPS;
      if (
        Math.abs(f - P.volume.deloadFactor) > fTol &&
        !fitted &&
        !floored(w) &&
        resetKm(w.index) === null
      )
        err('VOLUME_DELOAD', `Rasterećenje ${f.toFixed(2)} × prethodne.`, w.index);
    }
    if (w.phase === 'taper' && w.taperStep) {
      const peak = peakRefAt(w.index);
      const f = w.targetKm / peak;
      const factor = P.volume.taperFactors[w.taperStep - 1]!;
      const fitted = Math.abs(w.targetKm - fit(w, peak * factor)) < EPS || floored(w);
      if (Math.abs(f - factor) > fTol && !fitted)
        err('VOLUME_TAPER', `Taper ${w.taperStep}: ${f.toFixed(2)} × vrh.`, w.index);
    }
    if (w.phase === 'race' && w.targetKm > raceBound + tolKm)
      err(
        'VOLUME_RACE_WEEK',
        `Trkačka nedelja ${w.targetKm} km > granica ${raceBound} km (${P.volume.raceWeekFactor} × vrh).`,
        w.index
      );
  }

  // --- Kvalitet: budžeti, udeli, dužine ponavljanja, donji prag u vrhuncu.
  for (const w of weeks) {
    if (!checked(w)) continue;
    // 2.1.0: udeli se mere od ciljnog km (isti osnov kao budžeti); planirano < cilj samo kad je lagan = dugi.
    // 2.3.0: osnov trkačke nedelje je njena granica (cilj = planirano ≤ granica).
    const base = w.phase === 'race' ? raceBound : w.targetKm;
    if (JSON.stringify(w.budgets) !== JSON.stringify(qualityBudgets(base)))
      err('BUDGETS', 'Budžeti kvaliteta ne odgovaraju udelima iz policy.ts.', w.index);
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
    // 2.3.0 (Odluka 5): R kao zamena u rasterećenju (vrhunac, oštrenje) ≥ deloadSubstitute.minRKm.
    // 2.4.0: kratki usponi su glavni kvalitet vrhunca početnika (ne zamena).
    const rIsMain = a.beginner && w.phase === 'peak';
    if (
      (w.deload || w.limits?.quality === 'one') &&
      w.phase !== 'base' &&
      !rIsMain &&
      sum.R > 0 &&
      sum.R + EPS < q.deloadSubstitute.minRKm
    )
      err(
        'DELOAD_R_MIN',
        `Zamena R ${sum.R.toFixed(2)} km < ${q.deloadSubstitute.minRKm} km u rasterećenju.`,
        w.index
      );
    // 2.4.0: donji prag ne važi bez tempa (po osećaju) ni za početnika (nema I; RP kratko).
    if (
      (w.phase === 'peak' || w.phase === 'sharpen') &&
      !w.deload &&
      !w.limits?.quality &&
      !w.test &&
      !aw(w).feel &&
      !a.beginner
    ) {
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
  // 2.4.0: bez nedelje testa i nedelja početnika bez kvaliteta.
  // 2.5.0: bez nedelja sa ograničenjem kvaliteta i mešovitih; nov start, smanjen cilj koraka (startKm)
  // i prelaz po osećaju → VDOT počinju novi segment progresije (doza sme da padne sa obimom).
  const feel0 = aw(weeks[0]!).feel;
  const seg = (w: PlanWeek): number =>
    steps.filter((st) => (doseResetAt(st) ?? Infinity) <= w.index).length +
    (aw(w).feel !== feel0 ? 1 : 0);
  const steady = weeks.filter(
    (w) => isBuild(w) && !w.deload && !w.test && !w.stridesOnly && !w.limits?.quality && checked(w)
  );
  for (let i = 1; i < steady.length; i++) {
    const a = steady[i - 1]!;
    const b = steady[i]!;
    if (seg(a) !== seg(b)) continue;
    // 2.2.0: I u vrhuncu neopadajući (zadržan I uz promenu T). 2.3.0: i RP u oštrenju neopadajući
    // (bez višeg nivoa druga struktura; identičan par ostaje QUALITY_REPEAT).
    if (a.phase === b.phase && (b.phase === 'peak' || b.phase === 'sharpen'))
      if (mainWork(b) + EPS < mainWork(a))
        err(
          'DOSE_PROGRESSION',
          `Glavni ${b.phase === 'sharpen' ? 'RP' : 'I'} rad ${mainWork(b)} km manji od prethodne nedelje (${mainWork(a)} km).`,
          b.index
        );
    if (qualityKey(a) === qualityKey(b))
      err('QUALITY_REPEAT', `Isti par kvaliteta kao nedelja ${a.index}.`, b.index);
  }
  // 2.2.0 (Odluka 3): nema dugog platoa u bazi — 3 uzastopne ne-rasteretne nedelje iste doze.
  const baseSteady = steady.filter((w) => w.phase === 'base');
  // 2.3.0 (Odluka 6): R doza u bazi ne pada između ne-rasteretnih nedelja (sa R; 3 dana: svaka druga).
  const rKm = (w: PlanWeek): number =>
    w.days.reduce((a, d) => a + (d.workout.kind === 'quality' ? d.workout.workKm.R : 0), 0);
  const withR = baseSteady.filter((w) => rKm(w) > 0);
  for (let i = 1; i < withR.length; i++)
    if (seg(withR[i]!) === seg(withR[i - 1]!) && rKm(withR[i]!) + EPS < rKm(withR[i - 1]!))
      err(
        'BASE_R_DECREASE',
        `R u bazi ${rKm(withR[i]!).toFixed(2)} km < prethodne ${rKm(withR[i - 1]!).toFixed(2)} km.`,
        withR[i]!.index
      );
  for (let i = P.quality.baseSameDoseMaxWeeks; i < baseSteady.length; i++) {
    const ws = baseSteady.slice(i - P.quality.baseSameDoseMaxWeeks, i + 1);
    const run = ws.map(baseKey);
    if (run.every((k) => k === run[0]) && ws.every((w) => seg(w) === seg(ws[0]!)))
      err(
        'BASE_PLATEAU',
        `${run.length} uzastopne ne-rasteretne nedelje baze iste doze (${run[0]}).`,
        baseSteady[i]!.index
      );
  }

  // --- Dugi, lagani, zagrevanje/hlađenje.
  for (const w of weeks) {
    if (!checked(w)) continue;
    const long = w.days.find((d) => d.role === 'long');
    if (long) {
      const lw = long.workout;
      if (lw.km > w.targetKm * rule.longMaxShare + EPS)
        err(
          'LONG_SHARE',
          `Dugi ${lw.km} km > ${rule.longMaxShare * 100}% od cilja ${w.targetKm} km.`,
          w.index,
          long.date
        );
      // 2.5.0: dugi na danu bola ≤ adapt.painLongMaxSec.
      const longMax = w.limits?.pain?.includes(long.date)
        ? Math.min(rule.longMaxSec, P.adapt.painLongMaxSec)
        : rule.longMaxSec;
      if (lw.km * pw(w).E.slow > longMax + EPS)
        err(
          'LONG_DURATION',
          `Dugi ${lw.km} km sporijim E tempom > ${longMax / 60} min.`,
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
      // 2.3.0: oštrenje trkačke nedelje je sastavljeno od granice nedelje (osnov budžeta).
      const bandKm = w.phase === 'race' ? raceBound : w.targetKm;
      const band = d.workout.kind === 'race' ? P.warmup.race : warmupBand(bandKm);
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
  // --- 2.5.0: ograničenja koraka po datumima (i u mešovitim nedeljama; zaključan dan je izuzet):
  // zabrana kvaliteta / bol / odmor → bez kvaliteta; bol → bez ubrzanja; odmor → bez treninga.
  const lockedIds = new Set(ad?.lockedDayIds ?? []);
  for (const w of weeks)
    for (const d of w.days) {
      if (lockedIds.has(d.date) || d.role === 'race') continue;
      const inAny = (
        pick: (st: (typeof steps)[number]) => readonly ({ from: string; to: string } | null)[]
      ): boolean => steps.some((st) => pick(st).some((r) => inRange(d.date, r)));
      if (inAny((st) => [st.rest]))
        err('LIMITS', 'Trening na dan odmora (bol ≥ 7).', w.index, d.date);
      if (d.workout.kind === 'quality' && inAny((st) => [...st.noQuality, st.pain, st.rest]))
        err('LIMITS', 'Kvalitet na dan zabrane kvaliteta (adaptacija).', w.index, d.date);
      if (inAny((st) => [st.pain]) && d.workout.segments.some((x) => x.kind === 'stride'))
        err('LIMITS', 'Ubrzanja u periodu bola.', w.index, d.date);
    }
  return out;
}
