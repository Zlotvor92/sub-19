/* Nezavisne invarijante mreža 10K v2 (sa rezultatom, po osećaju, početnik) — brojevi iz odluka, ne iz
   koda generatora (nije testni fajl: dele ga grid.node, feelGrid.node i beginnerGrid.node). Prekršaji idu u
   `bad[invarijanta]`, brojke za izveštaj u `GridStats`. */

import { daysBetween } from './dates.ts';
import type { Phase, PlanWeek, TenKV2Plan } from './types.ts';

export type Days = 3 | 4 | 5 | 6;
export const DAYS = [3, 4, 5, 6] as const;

/** D17 (02b: 3 dana udeo 0,45); D28 početnik: isti udeo i minimum, obim 3 dana 15–30, 4 dana 18–35 km. */
const SHARE: Record<Days, number> = { 3: 0.45, 4: 0.33, 5: 0.3, 6: 0.27 };
const WEEK_MIN: Record<Days, number> = { 3: 9, 4: 12, 5: 15, 6: 18 };
const KM_RANGE: Record<Days, [number, number]> = {
  3: [20, 40],
  4: [25, 55],
  5: [30, 65],
  6: [35, 80]
};
const KM_RANGE_BEGINNER: Record<3 | 4, [number, number]> = { 3: [15, 30], 4: [18, 35] };
/** D14: WU/CD po pojasu trenutnog obima, isti za sve brojeve dana; početnik uvek prvi pojas (D28). */
const band = (km: number, beginner: boolean): [number, number] =>
  beginner || km < 35 ? [900, 600] : km < 45 ? [1200, 900] : [1500, 900];
/** D26: RPE po zoni (plan po osećaju). */
const RPE: Record<string, [number, number, string]> = {
  T: [6, 7, 'udobno teško, kratke rečenice'],
  RP: [7, 8, 'ritam trke 10K'],
  I: [8, 8, 'teško, izdrživo 3–5 min'],
  R: [8, 8, 'brzo, opušteno']
};
const EPS = 1e-9;
const to10 = (km: number): number => Math.round(km * 10);
export const isBuild = (ph: Phase): boolean =>
  ph === 'base' || ph === 'development' || ph === 'specific';
export const steady = (w: PlanWeek): boolean => isBuild(w.phase) && !w.deload;
const T_C = [2000, 2500, 3000, 3500, 4000, 4500, 5000];
const T_CRUISE = [2000, 2400, 3000, 3600, 4000, 4800, 5000, 6000, 6400, 8000];
const RP = [2400, 3000, 4000, 4500, 5000, 6000];
/** D31: lestvica T kontinuirano početnika (od 1,5 km); 1,5 km = najmanja T doza početnika. */
const T_C_BEG = [1500, ...T_C];
/** D11: plafon zone 10 % (T, RP) cilja nedelje [m]. */
const cap10 = (targetKm: number): number => Math.floor(0.1 * targetKm * 1000 + 1e-6);
/** ≈ 60 % poslednje doze, nivo lestvice naniže, najmanje `min` (D5/D7/D31). */
const reduced = (ladder: readonly number[], last: number, min: number): number =>
  ladder.filter((m) => m <= 0.6 * last + 1e-6 && m >= min).pop() ?? min;

export interface GridStats {
  plans: number;
  /** Ned 1 ispod trenutnog obima uz dugi na plafonu trajanja / samo na udelu D17. */
  belowTime: number;
  belowShare: number;
  capacity: number;
  raceKmEasy: number;
  longShorter: number;
  doseDropped: number;
  /** DOSE_DROPPED bez nedelje spuštene uz dugi na plafonu trajanja (spuštena uz dugi na udelu D17). */
  doseDroppedShare: number;
  repeats: number;
  peakRatio: number;
  deloadNoQuality: number;
  taperRpOnly: number;
  taperNone: number;
  raceShort: number;
  /** D27: test u rasterećenju; dugi skraćen (odstupanje); cilj rasterećenja sa testom podignut. */
  testDeload: number;
  testDeloadLong: number;
  testDeloadUp: number;
  /** D28: nedelje izgradnje bez kvaliteta posle uvoda; planovi sa njima. */
  buildNoQuality: number;
  buildNoQualityPlans: number;
  /** Planovi bez ijednog kvaliteta od nedelje 3 do trke. */
  noQualityPlans: number;
  /** D31: nedelje izgradnje sa T kontinuirano umesto lestvice faze (razvoj, specifično); taper sa T. */
  beginnerT: number;
  taperT: number;
  /** Testovi (D27) i planovi sa dugim rasterećenja < 4 km. */
  tests: number;
  deloadLongBelow4: number;
}

export const emptyStats = (): GridStats => ({
  plans: 0,
  belowTime: 0,
  belowShare: 0,
  capacity: 0,
  raceKmEasy: 0,
  longShorter: 0,
  doseDropped: 0,
  doseDroppedShare: 0,
  repeats: 0,
  peakRatio: 0,
  deloadNoQuality: 0,
  taperRpOnly: 0,
  taperNone: 0,
  raceShort: 0,
  testDeload: 0,
  testDeloadLong: 0,
  testDeloadUp: 0,
  buildNoQuality: 0,
  buildNoQualityPlans: 0,
  noQualityPlans: 0,
  beginnerT: 0,
  taperT: 0,
  tests: 0,
  deloadLongBelow4: 0
});

/** Nezavisne invarijante jednog plana (sve mreže). */
/** T1 (10K-08), nezavisno od validatora: nedelja izgradnje bez laganog dana sa planiranim < cilj za manje od jednog
    laganog od 20 min (brzim E tempom). */
export function t1Short(
  w: {
    phase: string;
    deload: boolean;
    plannedKm: number;
    targetKm: number;
    days: readonly { role: string }[];
  },
  p: { paces: { E: { fast: number } } }
): boolean {
  const gap = w.targetKm - w.plannedKm;
  return (
    ['base', 'development', 'specific'].includes(w.phase) &&
    !w.deload &&
    !w.days.some((d) => d.role === 'easy') &&
    gap > 0 &&
    gap <= 1200 / p.paces.E.fast + 0.1 + EPS
  );
}

export function checkPlan(
  id: string,
  n: Days,
  p: TenKV2Plan,
  bad: Record<string, string[]>,
  st: GridStats
): void {
  const no = (inv: string, msg: string): void => {
    (bad[inv] ??= []).push(`${id}: ${msg}`);
  };
  const beginner = p.input.experience === 'beginner';
  // Mreže: plan po osećaju tačno kad ulaz nema rezultata (ostali rezultati u mrežama su pouzdani).
  const feel = p.input.recentResult === null;
  // D27/D32: test samo u planu po osećaju koji nije početnik.
  const withTest = feel && !beginner;
  const oneSlot = n === 3 || beginner;
  const longMaxSec = beginner ? 5400 : 6300;
  const time10 = Math.floor((longMaxSec / p.paces.E.slow) * 10 + EPS);
  const shareCap10 = (t: number): number => Math.floor(SHARE[n] * to10(t) + EPS);
  const longOf = (w: PlanWeek): number | null => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? to10(l.workout.km) : null;
  };
  const [wu, cd] = band(p.input.currentWeeklyKm, beginner);
  const phases = p.weeks.map((w) => w.phase);
  const B = phases.filter(isBuild).length;
  const lastBase = phases.lastIndexOf('base') + 1;
  const first = (k: number): boolean => k === 1 || phases[k - 2] !== phases[k - 1];
  const tSlot = oneSlot ? 'q1' : 'q2';
  let run = 0;
  let last: PlanWeek | null = null;
  /** Poslednja doza T slota (rasterećenje): iz poslednje nedelje izgradnje koja ga ima. */
  let lastT = 0;
  /** D31 (početnik): poslednja doza u zoni T i poslednja doza jedinog slota. */
  let lastTZone = 0;
  let lastQ1 = 0;
  let noQualityWeeks = 0;
  let qualityAfterIntro = 0;
  let deloadBelow4 = false;
  const tests: { w: PlanWeek; role: string; weekday: string }[] = [];
  for (const w of p.weeks) {
    const tag = `ned ${w.index}`;
    // planirano = cilj (tehnička tolerancija 0,1 km); trkačka: cilj = planirano.
    if (Math.abs(w.plannedKm - w.targetKm) > 0.1 + EPS && !t1Short(w, p))
      no('PLANNED_EQ_TARGET', `${tag} ${w.plannedKm} ≠ ${w.targetKm}`);
    // Uslov 8 (D15/D17): nedelja ≥ minimum po broju dana; trkačka: planirano + trka 10 km (D30).
    if (w.phase !== 'race' && w.plannedKm + EPS < WEEK_MIN[n]) no('WEEK_MIN', tag);
    if (w.phase === 'race' && w.plannedKm + 10 + EPS < WEEK_MIN[n]) st.raceShort++;
    const long = longOf(w);
    const easy = w.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km));
    if (w.phase !== 'race') {
      if (long === null) no('LONG', `${tag} bez dugog`);
      else {
        if (easy.some((e) => e > long)) no('LONG_GE_EASY', tag);
        if (long < 30) no('LONG_MIN', `${tag} ${long / 10}`);
        if (w.deload && long < 40) deloadBelow4 = true;
        if (long > shareCap10(w.targetKm) || long > time10) no('LONG_CAP', `${tag} ${long / 10}`);
      }
      // D19: lagani dani jednaki (razlika ≤ 0,1 km), svaki ≥ 3 km.
      if (easy.length > 1 && Math.max(...easy) - Math.min(...easy) > 1) no('EASY_EQUAL', tag);
      if (easy.some((e) => e < 30)) no('EASY_MIN', tag);
    }
    for (const d of w.days) {
      const wo = d.workout;
      if (wo.kind === 'test') {
        tests.push({ w, role: d.role, weekday: d.weekday });
        const s = wo.segments;
        // D27: WU (pojas) + 5 km + CD, u obimu, bez doze.
        if (
          s.length !== 3 ||
          s[0]!.kind !== 'warmup' ||
          s[0]!.sec !== wu ||
          s[1]!.kind !== 'test' ||
          s[1]!.km !== 5 ||
          s[2]!.kind !== 'cooldown' ||
          s[2]!.sec !== cd ||
          !d.countsToWeek ||
          !d.hard ||
          wo.dose !== null
        )
          no('TEST_STRUCTURE', tag);
        continue;
      }
      if (wo.kind !== 'quality') continue;
      const s = wo.segments;
      // D8 (10K-07): oštrenje trkačke nedelje nosi WU/CD trke (15 + 10 min), ne pojas D14.
      const sharp = d.role === 'sharpener';
      if (
        s[0]!.kind !== 'warmup' ||
        s[0]!.sec !== (sharp ? 900 : wu) ||
        s.at(-1)!.kind !== 'cooldown' ||
        s.at(-1)!.sec !== (sharp ? 600 : cd)
      )
        no('WU_CD_BAND', `${tag} ${d.date}`);
      const zone = wo.dose!.zone;
      // D10/D22: T deonice ≥ 1000 m; D30: RP deonice ≥ 800 m.
      for (const x of s)
        if (x.kind === 'rep') {
          const m = Math.round(x.km * 1000);
          if (zone === 'T' && m < 1000) no('T_REP_1000', tag);
          if (zone === 'RP' && m < 800) no('RP_REP_800', tag);
        }
      // D18/D28: 3 dana i početnik bez I i R.
      if (oneSlot && (zone === 'I' || zone === 'R')) no('ONE_SLOT_NO_I_R', tag);
      // D26: RPE tačno u planu po osećaju.
      const r = RPE[zone]!;
      if (feel) {
        if (!wo.rpe || wo.rpe.min !== r[0] || wo.rpe.max !== r[1] || wo.rpe.cue !== r[2])
          no('RPE', `${tag} ${zone}`);
      } else if (wo.rpe !== undefined) no('RPE', `${tag} RPE u planu sa rezultatom`);
    }
    const quality = w.days.filter((d) => d.workout.kind === 'quality');
    const hasTest = w.days.some((d) => d.workout.kind === 'test');
    if (hasTest) st.tests++;
    if (w.index >= 3 && quality.length > 0) qualityAfterIntro++;
    // D28: uvod bez kvaliteta i testa; početnik najviše 1 kvalitet nedeljno (i trkačka nedelja).
    if (beginner && w.index <= 2 && (quality.length > 0 || hasTest)) no('INTRO_NO_QUALITY', tag);
    if (beginner && quality.length > 1) no('BEGINNER_ONE_QUALITY', tag);
    if (oneSlot && steady(w)) {
      const intro = beginner && w.index <= 2;
      const nq = w.notes.some((x) => x.includes('Bez kvaliteta'));
      if (nq) {
        noQualityWeeks++;
        if (!beginner || intro || hasTest) no('BUILD_NO_QUALITY_ONLY_BEGINNER', tag);
      }
      if (quality.length !== (intro || hasTest || nq ? 0 : 1)) no('ONE_SLOT_ONE_QUALITY', tag);
      // D31: početnik — lestvica faze (prvi nivo: baza T 1,5, razvoj T cruise 2,0, specifično RP 2,4 km)
      // kad staje u plafon; inače T kontinuirano = najviši nivo lestvice početnika ≤ plafon; bez kvaliteta
      // samo kad ni 1,5 km ne staje.
      if (beginner && !intro) {
        const cap = cap10(w.targetKm);
        const first = w.phase === 'base' ? 1500 : w.phase === 'development' ? 2000 : 2400;
        const phaseLadder =
          w.phase === 'base' ? 'T_continuous' : w.phase === 'development' ? 'T_cruise' : 'RP';
        const dose = quality[0]?.workout.dose;
        if (nq !== cap < 1500) no('BEGINNER_NO_QUALITY', `${tag} plafon ${cap}`);
        else if (dose && first <= cap && dose.ladder !== phaseLadder)
          no('BEGINNER_PHASE_LADDER', `${tag} ${dose.ladder}`);
        else if (dose && first > cap) {
          st.beginnerT++;
          const want = T_C_BEG.filter((m) => m <= cap).pop();
          if (dose.ladder !== 'T_continuous' || dose.zone !== 'T' || dose.doseM !== want)
            no('BEGINNER_T_FALLBACK', `${tag} ${dose.ladder} ${dose.doseM} ≠ T ${want}`);
        }
      }
    }
    if (w.notes.some((x) => x.includes('ponovljen'))) st.repeats++;
    // D5: mesto rasterećenja i niz izgradnje.
    if (isBuild(w.phase)) {
      if (w.deload) {
        if (w.index < 3 || w.index === B || first(w.index)) no('DELOAD_PLACE', tag);
        run = 0;
      } else {
        run++;
        if (run > 4 || (run === 4 && !first(w.index))) no('DELOAD_RUN', tag);
      }
    } else if (w.deload) no('DELOAD_PLACE', tag);
    // D5: sadržaj rasterećenja (D27: test umesto kvaliteta, dugi skraćen samo do laganih ≥ 3 km, cilj
    // naviše samo ispod poslednje izgradnje).
    if (w.deload && last) {
      const lastLong = longOf(last)!;
      const wantLong = Math.min(Math.floor(0.8 * lastLong + EPS), shareCap10(w.targetKm), time10);
      const nominal = Math.round(0.8 * to10(last.targetKm));
      if (hasTest) {
        st.testDeload++;
        if (quality.length !== 0) no('DELOAD_CONTENT', `${tag} test + kvalitet`);
        if (long! > wantLong) no('DELOAD_LONG', `${tag} ${long} > ${wantLong}`);
        if (long! < wantLong) {
          st.testDeloadLong++;
          if (Math.max(...easy) > 31) no('DELOAD_LONG', `${tag} skraćen uz lagan > 3,1`);
        }
        if (w.fitted === 'up') {
          st.testDeloadUp++;
          if (to10(w.targetKm) >= to10(last.targetKm)) no('DELOAD_TARGET', `${tag} ≥ izgradnja`);
        }
        if (easy.length !== n - 2) no('DELOAD_CONTENT', `${tag} lagani`);
      } else {
        // D5/D18: ≈ 60 % poslednje doze T slota, min 2,0 km; D31 početnik: poslednje T doze, min 1,5 km.
        const ladder = w.phase === 'base' ? (beginner ? T_C_BEG : T_C) : T_CRUISE;
        const want = beginner ? reduced(ladder, lastTZone, 1500) : reduced(ladder, lastT, 2000);
        const cap = cap10(w.targetKm);
        if (want > cap) {
          if (quality.length !== 0) no('DELOAD_CONTENT', `${tag} kvalitet uprkos plafonu`);
          st.deloadNoQuality++;
        } else if (
          quality.length !== 1 ||
          quality[0]!.role !== tSlot ||
          quality[0]!.workout.dose!.doseM !== want
        )
          no('DELOAD_CONTENT', `${tag} T ≠ ${want}`);
        if (long !== wantLong) no('DELOAD_LONG', `${tag} ${long} ≠ ${wantLong}`);
        if (easy.length !== n - 1 - quality.length) no('DELOAD_CONTENT', `${tag} lagani`);
        if (w.fitted === 'up') no('DELOAD_TARGET', `${tag} naviše`);
      }
      if (w.fitted === null && to10(w.targetKm) !== nominal) no('DELOAD_TARGET', tag);
    }
    if (w.phase === 'taper') {
      const q = quality.map((d) => d.workout.dose!.zone).join();
      if (q === '') st.taperNone++;
      else if (!oneSlot && q === 'RP') st.taperRpOnly++;
      // D7 + D31: početnik — RP ≈ 60 % poslednje doze slota (min 2 × 1000 m); kad ne staje, T kontinuirano
      // ≈ 60 % poslednje T doze (min 1,5 km); bez kvaliteta samo kad ni to ne staje.
      if (beginner) {
        const cap = cap10(w.targetKm);
        const rp = reduced(RP, lastQ1, 2000);
        const t = reduced(T_C_BEG, lastTZone, 1500);
        const want = rp <= cap ? `RP:${rp}` : t <= cap ? `T:${t}:continuous` : '';
        const d = quality[0]?.workout.dose;
        const got = d ? `${d.zone}:${d.doseM}${d.zone === 'T' ? `:${d.structure.form}` : ''}` : '';
        if (quality.length > 1 || got !== want) no('BEGINNER_TAPER', `${tag} ${got} ≠ ${want}`);
        if (d?.zone === 'T') st.taperT++;
      }
      if (w.days.length !== n) no('TAPER_DAYS', tag);
      if (w.fitted === 'up') no('TAPER_TARGET', `${tag} naviše`);
    }
    // D20: dana sa trkom = min(broj dana, 5).
    if (w.phase === 'race' && w.days.length !== Math.min(n, 5)) no('RACE_DAYS', tag);
    if (steady(w)) {
      last = w;
      const t = w.days.find((d) => d.role === tSlot)?.workout.dose;
      if (t) lastT = t.doseM;
      for (const d of quality) if (d.workout.dose!.zone === 'T') lastTZone = d.workout.dose!.doseM;
      const q1 = w.days.find((d) => d.role === 'q1')?.workout.dose;
      if (q1) lastQ1 = q1.doseM;
    }
  }
  // D27: plan po osećaju — tačno jedan test, u poslednjoj nedelji baze, na danu Q1 (rasterećenje: na danu
  // T slota); plan sa rezultatom i početnik (D32) nijedan. Oznaka nedelje testa samo na toj nedelji.
  if (withTest) {
    const t = tests[0];
    const day = t && (t.w.deload ? (tSlot === 'q1' ? p.pattern.q1 : p.pattern.q2) : p.pattern.q1);
    if (tests.length !== 1 || !t || t.w.index !== lastBase || t.weekday !== day)
      no('TEST_ONE', `${tests.length} ${tests.map((x) => `${x.w.index}:${x.weekday}`).join()}`);
  } else if (tests.length > 0) no('TEST_NONE', `${tests.length}`);
  for (const w of p.weeks)
    if ((w.test === true) !== (withTest && w.index === lastBase)) no('TEST_FLAG', `ned ${w.index}`);
  // D26: osnova tempa, E = lagan tempo ± 15 s, procena VDOT-a = VO2(lagan) / 0,70 (Daniels–Gilbert,
  // 0,1; 25–60), bez prognoze i ocene cilja.
  if (feel) {
    const e = p.input.easyPaceSecPerKm!;
    const v = 60000 / e;
    const est = Math.round(((-4.6 + 0.182258 * v + 0.000104 * v * v) / 0.7) * 10) / 10;
    if (p.paceBasis !== 'feel' || p.paces.E.fast !== e - 15 || p.paces.E.slow !== e + 15)
      no('FEEL_PACES', `${p.paceBasis} ${JSON.stringify(p.paces.E)}`);
    if (p.vdot !== Math.min(60, Math.max(25, est))) no('FEEL_VDOT', `${p.vdot} ≠ ${est}`);
    if (p.predicted10kSec !== null || p.goal !== null) no('FEEL_NO_PREDICTION', '');
  } else if (p.paceBasis !== 'result') no('PACE_BASIS', p.paceBasis);
  // D23: trkačka nedelja (bez trke) ≤ taper; lagan = min(35 min E, najkraći lagan tapera).
  const taper = p.weeks[p.weeks.length - 2]!;
  const race = p.weeks[p.weeks.length - 1]!;
  if (race.plannedKm > taper.plannedKm + EPS)
    no('RACE_LE_TAPER', `${race.plannedKm} > ${taper.plannedKm}`);
  const taperEasy = Math.min(
    ...taper.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km))
  );
  const byKm = taperEasy * 10 < Math.round((2100 * 100) / ((p.paces.E.fast + p.paces.E.slow) / 2));
  const raceEasy = race.days.filter((d) => d.role === 'easy');
  for (const d of raceEasy)
    if (
      byKm ? Math.round(d.workout.km * 100) !== taperEasy * 10 : d.workout.segments[0]!.sec !== 2100
    )
      no('RACE_EASY_D23', `${d.date}`);
  if (byKm && raceEasy.length > 0) st.raceKmEasy++;
  // D25: upozorenje TAČNO kad je u ne-rasteretnoj nedelji izgradnje kvalitetni dan, ili u bilo kojoj nedelji
  // izgradnje dan testa (10K-07), duži od dugog po trajanju; preporuka manje dana tačno kad red sa manje dana podržava
  // trenutni obim.
  const longer = p.weeks.some((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return (
      !!l &&
      w.days.some(
        (d) =>
          ((steady(w) && d.workout.kind === 'quality') ||
            (w.phase !== 'taper' && w.phase !== 'race' && d.workout.kind === 'test')) &&
          d.workout.sec > l.workout.sec
      )
    );
  });
  const d25 = p.warnings.filter((x) => x.rule === 'LONG_SHORTER_THAN_QUALITY');
  if (longer !== (d25.length === 1) || d25.length > 1 || d25.some((x) => x.severity !== 'warning'))
    no('D25_EXACT', `${longer} ${d25.length}`);
  const km = p.input.currentWeeklyKm;
  const range = (k: number): [number, number] =>
    beginner ? KM_RANGE_BEGINNER[k as 3 | 4] : KM_RANGE[k as Days];
  const fewer = (beginner ? [3, 4] : DAYS).filter(
    (k) => k < n && range(k)[0] <= km && km <= range(k)[1]
  );
  if (d25.length === 1 && d25[0]!.message.includes('preporuka') !== fewer.length > 0)
    no('D25_ADVICE', d25[0]!.message);
  if (longer) st.longShorter++;
  // D9: zahtevni dani nikad uzastopni (i preko granice nedelje).
  const hard = p.weeks.flatMap((w) => w.days.filter((d) => d.hard).map((d) => d.date)).sort();
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!, hard[i]!) < 2) no('HARD_ADJACENT', `${hard[i - 1]} ${hard[i]}`);
  // Nedelja 1 < trenutni obim SAMO kad je dugi nedelje 1 na plafonu (trajanje 105 min — početnik 90 min —
  // ili udeo D17; mreža sa rezultatom: samo trajanje, test belowShare = 0).
  const w1 = p.weeks[0]!;
  if (w1.targetKm < p.input.currentWeeklyKm) {
    const l1 = longOf(w1)!;
    if (l1 === time10) st.belowTime++;
    else if (l1 === shareCap10(w1.targetKm)) st.belowShare++;
    else no('WEEK1_BELOW', `${w1.targetKm} < ${p.input.currentWeeklyKm}, dugi ${l1 / 10}`);
  }
  // DOSE_DROPPED SAMO u planovima ograničenim kapacitetom: nedelja izgradnje spuštena sa dugim na plafonu
  // (trajanje; ili udeo D17 — doseDroppedShare).
  const cut = (cap: (w: PlanWeek) => number): boolean =>
    p.weeks.some((w) => steady(w) && w.fitted === 'down' && longOf(w) === cap(w));
  if (p.warnings.some((x) => x.rule === 'DOSE_DROPPED')) {
    st.doseDropped++;
    if (!cut(() => time10)) {
      if (cut((w) => shareCap10(w.targetKm))) st.doseDroppedShare++;
      else no('DOSE_DROPPED_ONLY_CAPACITY', 'bez nedelje spuštene uz dugi na plafonu');
    }
  }
  // D28: početnik — rast ≤ max(5 %, 1,0 km) i ≤ 2,0 km od poslednjeg cilja izgradnje; vrh ≤ start × 1,3 i
  // ≤ start + 10; dugi ≤ 90 min sporim E (gore, LONG_CAP).
  if (beginner) {
    let prev: number | null = null;
    for (const w of p.weeks.filter(steady)) {
      if (prev !== null) {
        const g = to10(w.targetKm) - prev;
        if (g > Math.min(20, Math.max(10, Math.round(prev * 0.05))))
          no('BEGINNER_GROWTH', `ned ${w.index} +${g / 10}`);
      }
      prev = to10(w.targetKm);
    }
    const s10 = to10(p.startKm);
    if (to10(p.peakKm) > Math.min(Math.floor(s10 * 1.3 + EPS), s10 + 100))
      no('BEGINNER_PEAK', `${p.peakKm} > ${p.startKm}`);
  }
  if (noQualityWeeks > 0) st.buildNoQualityPlans++;
  st.buildNoQuality += noQualityWeeks;
  if (qualityAfterIntro === 0) st.noQualityPlans++;
  if (deloadBelow4) st.deloadLongBelow4++;
  if (p.warnings.some((x) => x.rule === 'CAPACITY_LIMITED')) st.capacity++;
  st.peakRatio += p.peakKm / p.startKm;
  st.plans++;
}

const LETTER = { base: 'B', development: 'D', specific: 'S', taper: 'T', race: 'R' } as const;

/** Red bazne linije: vrh cilj/planirano, najduži dugi, najveća glavna doza [km], niz faza, rasteretne
    nedelje. */
export type Row = [number, number, number, number, string, number[]];

export function summaryRow(p: TenKV2Plan): Row {
  const build = p.weeks.filter((w) => isBuild(w.phase));
  const peak = build.reduce((a, w) => (w.targetKm > a.targetKm ? w : a), build[0]!);
  const longest = Math.max(
    ...p.weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
  );
  const main = Math.max(
    ...p.weeks.map((w) =>
      w.days.reduce(
        (a, d) =>
          a + Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP) * 1000),
        0
      )
    )
  );
  return [
    peak.targetKm,
    peak.plannedKm,
    longest,
    main / 1000,
    p.weeks.map((w) => LETTER[w.phase]).join(''),
    p.weeks.filter((w) => w.deload).map((w) => w.index)
  ];
}

/** Sažetak brojki po broju dana (tabela izveštaja). */
export function statsRow(s: GridStats): number[] {
  return [
    s.plans,
    s.capacity,
    s.repeats,
    Math.round((s.peakRatio / s.plans) * 1000) / 1000,
    s.deloadNoQuality,
    s.taperRpOnly,
    s.taperNone,
    s.raceShort
  ];
}
