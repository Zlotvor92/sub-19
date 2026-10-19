/* Nezavisne invarijante mreže HM v2 (Uslov 8, pouke 1–14) — brojevi iz odluka (MASTER § 4, odluka udela 40 %),
   NE iz koda generatora (nije testni fajl: dele ga grid testovi i docs/hm-v2/artifacts/segment-01/k-metrics.ts).
   Prekršaji idu u `bad[invarijanta]`, brojke K1–K6 u `GridStats`. */

import { daysBetween } from './dates.ts';
import type { HmV2Plan, Phase, PlanWeek } from './types.ts';

/** H15 (4 dana) + H13: udeo dugog, minimum nedelje, lagan, 150 min. */
const SHARE = 0.4;
const WEEK_MIN = 16;
const EASY_MIN10 = 40;
const LONG_MAX_SEC = 9000;
const RACE_KM = 21.1;
/** H14: WU/CD po pojasu trenutnog obima. */
const band = (km: number): [number, number] =>
  km < 40 ? [900, 600] : km < 60 ? [1200, 900] : [1500, 900];
/** H11: plafon po treningu. */
const CAPS = { R: 0.05, I: 0.08, T: 0.1, RP: 0.15 } as const;
/** H10: doze lestvica [m]. */
const T_C = [2000, 2500, 3000, 4000, 5000, 6000, 7000];
const T_CRUISE = [2400, 3000, 3200, 4000, 4800, 6000, 6400, 8000, 9000];
const RP = [4000, 5000, 6000, 8000, 9000, 10000, 12000];
const EPS = 1e-9;
const to10 = (km: number): number => Math.round(km * 10);
export const isBuild = (ph: Phase): boolean =>
  ph === 'base' || ph === 'development' || ph === 'specific';
export const steady = (w: PlanWeek): boolean => isBuild(w.phase) && !w.deload;
/** ≈ 60 % poslednje doze, nivo lestvice naniže, najmanje `min` (H5/H7). */
const reduced = (ladder: readonly number[], last: number, min: number): number =>
  ladder.filter((m) => m <= 0.6 * last + 1e-6 && m >= min).pop() ?? min;

export interface GridStats {
  plans: number;
  /** K2: nedelja 1 ispod trenutnog obima — ukupno / dugi nije na 150 min. */
  week1Below: number;
  week1BelowNotTime: number;
  /** K3: ne-rasteretne nedelje izgradnje sa manje od 2 kvaliteta. */
  buildNoQuality: number;
  /** K5. */
  raceOverTaper: number;
  dropOutsideCapacity: number;
  hardAdjacent: number;
  longBelowEasy: number;
  /** K6. */
  slotRepeatWeeks: number;
  longerQualityPlans: number;
  capacityPlans: number;
  peakRatioSum: number;
  /** Ostalo. */
  doseDroppedPlans: number;
  fittedWeeks: number;
  fittedUpWeeks: number;
  longShortPlans: number;
  taperRelaxed: number;
  deloadNoQuality: number;
}

export const emptyStats = (): GridStats => ({
  plans: 0,
  week1Below: 0,
  week1BelowNotTime: 0,
  buildNoQuality: 0,
  raceOverTaper: 0,
  dropOutsideCapacity: 0,
  hardAdjacent: 0,
  longBelowEasy: 0,
  slotRepeatWeeks: 0,
  longerQualityPlans: 0,
  capacityPlans: 0,
  peakRatioSum: 0,
  doseDroppedPlans: 0,
  fittedWeeks: 0,
  fittedUpWeeks: 0,
  longShortPlans: 0,
  taperRelaxed: 0,
  deloadNoQuality: 0
});

/** Nezavisne invarijante jednog plana. */
export function checkPlan(
  id: string,
  p: HmV2Plan,
  bad: Record<string, string[]>,
  st: GridStats
): void {
  const no = (inv: string, msg: string): void => {
    (bad[inv] ??= []).push(`${id}: ${msg}`);
  };
  st.plans++;
  const time10 = Math.floor((LONG_MAX_SEC / p.paces.E.slow) * 10 + EPS);
  const longOf = (w: PlanWeek): number | null => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? to10(l.workout.km) : null;
  };
  const doseOf = (w: PlanWeek, role: 'q1' | 'q2'): number =>
    w.days.find((d) => d.role === role)?.workout.dose?.doseM ?? 0;
  const [wu, cd] = band(p.input.currentWeeklyKm);
  const phases = p.weeks.map((w) => w.phase);
  const N = phases.length;
  const B = phases.filter(isBuild).length;
  const first = (k: number): boolean => k === 1 || phases[k - 2] !== phases[k - 1];

  // H4: faze (trka 1, taper 1, specifično 3/4/5, baza ceil, razvoj ostatak).
  const spec = B <= 9 ? 3 : B <= 13 ? 4 : 5;
  const base = Math.ceil((B - spec) / 2);
  const want = [
    ...Array<Phase>(base).fill('base'),
    ...Array<Phase>(B - spec - base).fill('development'),
    ...Array<Phase>(spec).fill('specific'),
    'taper',
    'race'
  ];
  if (B !== N - 2 || phases.join() !== want.join()) no('PHASES', phases.join());

  let run = 0;
  let lastBuild: number | null = null;
  let peak = 0;
  let lastLong: number | null = null;
  let longest = 0;
  let lastQ1 = 0;
  let lastQ2 = 0;
  let prevSteady: PlanWeek | null = null;
  let dropped = false;
  let longer = false;
  let fitted = false;
  for (const w of p.weeks) {
    const tag = `ned ${w.index}`;
    // Pouka 1 / Uslov 8: planirano = cilj (0,1 km); nedelja ≥ minimum (trkačka + 21,1 km).
    if (Math.abs(w.plannedKm - w.targetKm) > 0.1 + EPS) no('PLANNED_EQ_TARGET', tag);
    if (w.phase !== 'race' && w.plannedKm + EPS < WEEK_MIN) no('WEEK_MIN', tag);
    if (w.phase === 'race' && w.plannedKm + RACE_KM + EPS < WEEK_MIN) no('WEEK_MIN', `${tag} trka`);
    if (w.fitted) {
      st.fittedWeeks++;
      if (w.fitted === 'up') st.fittedUpWeeks++;
      if (steady(w) && w.fitted === 'down') fitted = true;
    }
    const long = longOf(w);
    const easy = w.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km));
    if (w.phase !== 'race') {
      if (long === null) no('LONG', `${tag} bez dugog`);
      else {
        // Pouka 2: dugi ≥ svaki lagan; H13: dugi ≤ 40 % cilja i ≤ 150 min.
        if (easy.some((e) => e > long)) {
          no('LONG_GE_EASY', tag);
          st.longBelowEasy++;
        }
        if (long > Math.floor(SHARE * to10(w.targetKm) + EPS) || long > time10)
          no('LONG_CAP', `${tag} ${long / 10}`);
      }
      if (easy.some((e) => e < EASY_MIN10)) no('EASY_MIN', tag);
      // H11: plafon po treningu.
      for (const d of w.days)
        for (const z of ['R', 'I', 'T', 'RP'] as const)
          if (d.workout.workKm[z] * 1000 > Math.floor(CAPS[z] * w.targetKm * 1000 + 1e-6) + 1e-6)
            no('ZONE_CAP', `${tag} ${z}`);
    }
    // H14: WU/CD po pojasu.
    for (const d of w.days) {
      if (d.workout.kind !== 'quality') continue;
      const s = d.workout.segments;
      if (
        s[0]!.kind !== 'warmup' ||
        s[0]!.sec !== wu ||
        s.at(-1)!.kind !== 'cooldown' ||
        s.at(-1)!.sec !== cd
      )
        no('WU_CD_BAND', `${tag} ${d.date}`);
    }
    // H5 (pouka 4): rasterećenje nikad u ned 1–2, na prvoj nedelji faze, na poslednjoj pre tapera; ≤ 3
    // izgradnje (4 kad bi rasterećenje palo na prvu nedelju faze).
    if (w.deload) {
      if (!isBuild(w.phase) || w.index < 3 || first(w.index) || w.index === B)
        no('DELOAD_PLACEMENT', tag);
      run = 0;
      // Cilj 0,8 × poslednja ne-rasteretna (naniže samo uz oznaku); dugi 0,8 × poslednji; 1 kvalitet T.
      const t10 = Math.round(0.8 * (lastBuild ?? 0));
      if (to10(w.targetKm) > t10 || (to10(w.targetKm) < t10 && w.fitted !== 'down'))
        no('DELOAD_TARGET', tag);
      if (lastLong !== null && long !== null && long > Math.floor(0.8 * lastLong + EPS))
        no('DELOAD_LONG', tag);
      const qs = w.days.filter((d) => d.workout.kind === 'quality');
      if (qs.length === 0) st.deloadNoQuality++;
      const ladder = w.phase === 'base' ? T_C : T_CRUISE;
      const tWant = reduced(ladder, lastQ2, 2000);
      if (qs.length > 1 || (qs.length === 1 && (qs[0]!.role !== 'q2' || doseOf(w, 'q2') !== tWant)))
        no('DELOAD_QUALITY', `${tag} T ${doseOf(w, 'q2')} ≠ ${tWant}`);
    } else if (isBuild(w.phase)) {
      run++;
      if (run > 4 || (run === 4 && !first(w.index))) no('DELOAD_RUN', tag);
    }
    if (steady(w)) {
      // K3: dva kvaliteta; H6: rast ≤ +6 % (1,0–4,0 km), ≤ granica; nedelja 1 = trenutni (pouka 9).
      const nq = w.days.filter((d) => d.workout.kind === 'quality').length;
      if (nq !== 2) st.buildNoQuality++;
      const t10 = to10(w.targetKm);
      if (lastBuild !== null) {
        const g = Math.min(40, Math.max(10, Math.round(lastBuild * 0.06)));
        // H6: najbliži izvodljiv cilj sme naviše (do granice izgradnje) samo uz oznaku 'up'.
        if (t10 > lastBuild + g && w.fitted !== 'up')
          no('GROWTH', `${tag} ${lastBuild / 10} → ${w.targetKm}`);
      }
      if (t10 > to10(p.peakCapKm)) no('PEAK_CAP', tag);
      // H12 (pouke 3, 12): doza slota ne pada, glavna doza ne pada; pad samo uz spuštanje doze (napomena) u
      // nedelji ograničenoj kapacitetom (fitted down) — inače prekršaj.
      const q1 = doseOf(w, 'q1');
      const q2 = doseOf(w, 'q2');
      const drop = w.days.some((d) => d.workout.dose?.step === 'drop');
      if (drop) {
        dropped = true;
        if (w.fitted !== 'down') st.dropOutsideCapacity++;
      }
      if (prevSteady && !drop) {
        // T slot (Q2) nosi dozu kroz sve faze; Q1 u istoj fazi i na prelazu I → RP.
        const q1Carries = w.phase === prevSteady.phase || w.phase === 'specific';
        if (q2 < lastQ2 || (q1Carries && q1 < lastQ1)) no('DOSE_DECREASE', tag);
        const main = (x: PlanWeek): number =>
          x.days.reduce(
            (a, d) =>
              a +
              (d.workout.kind === 'quality'
                ? d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP
                : 0),
            0
          );
        if (main(w) + 1e-6 < main(prevSteady)) no('MAIN_DOSE_DECREASE', tag);
        const key = (x: PlanWeek): string =>
          JSON.stringify(
            x.days.filter((d) => d.workout.kind === 'quality').map((d) => d.workout.blocks)
          );
        if (key(w) === key(prevSteady) && !w.days.some((d) => d.workout.dose?.step === 'repeat'))
          no('IDENTICAL_WEEKS', tag);
      }
      if (w.days.some((d) => d.workout.dose?.step === 'repeat')) st.slotRepeatWeeks++;
      // Pouka 14: kvalitetni dan duži od dugog (trajanje).
      const lw = w.days.find((d) => d.role === 'long');
      if (lw && w.days.some((d) => d.workout.kind === 'quality' && d.workout.sec > lw.workout.sec))
        longer = true;
      lastBuild = t10;
      peak = Math.max(peak, t10);
      if (long !== null) lastLong = long;
      lastQ1 = q1;
      lastQ2 = q2;
      prevSteady = w;
    }
    if (w.phase === 'taper') {
      // H7: cilj ≤ 0,7 × vrh; RP i T ≈ 60 % (min 2 × 2000 m, 2,0 km); dugi ≤ 0,6 × najduži.
      if (to10(w.targetKm) > Math.round(0.7 * peak)) no('TAPER_TARGET', tag);
      if (long !== null && long > Math.floor(0.6 * longest + EPS)) no('TAPER_LONG', tag);
      const rp = doseOf(w, 'q1');
      const t = doseOf(w, 'q2');
      if (rp === 0 || t === 0) st.taperRelaxed++;
      if (rp !== 0 && rp !== reduced(RP, lastQ1, 4000)) no('TAPER_RP', `${tag} ${rp}`);
      if (t !== 0 && t !== reduced(T_CRUISE, lastQ2, 2000)) no('TAPER_T', `${tag} ${t}`);
    }
    if (long !== null) longest = Math.max(longest, long);
  }
  if (p.peakKm !== peak / 10) no('PEAK', `${p.peakKm} ≠ ${peak / 10}`);

  // H9: zahtevni dani nikad uzastopni (i preko nedelja).
  const hard = p.weeks.flatMap((w) => w.days.filter((d) => d.hard).map((d) => d.date));
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!, hard[i]!) < 2) {
      no('HARD_ADJ', hard[i]!);
      st.hardAdjacent++;
    }

  // H8 (pouka 5): trkačka nedelja.
  const rw = p.weeks[N - 1]!;
  const tw = p.weeks[N - 2]!;
  if (rw.plannedKm > tw.plannedKm + EPS) {
    no('RACE_OVER_TAPER', `${rw.plannedKm} > ${tw.plannedKm}`);
    st.raceOverTaper++;
  }
  const race = rw.days.find((d) => d.role === 'race');
  if (
    !race ||
    race.date !== p.input.raceDate ||
    race.countsToWeek ||
    race.workout.segments[1]?.km !== RACE_KM
  )
    no('RACE_DAY', 'trka');
  if (rw.days.filter((d) => d.role !== 'race').length !== 3) no('RACE_DAYS', 'broj dana');
  const taperRp = doseOf(tw, 'q1');
  const taperEasyMin = Math.min(
    ...tw.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km))
  );
  for (const d of rw.days) {
    const gap = daysBetween(d.date, p.input.raceDate);
    if (d.role === 'sharpener') {
      const dose = d.workout.dose!;
      if (gap < 3 || dose.doseM !== 4000 || dose.doseM > taperRp) no('SHARPENER', d.date);
    } else if (d.role === 'eve') {
      if (gap !== 1 || d.workout.sec > 1800) no('EVE', d.date);
    } else if (d.role === 'easy') {
      if (to10(d.workout.km) > taperEasyMin || d.workout.sec > 2100) no('RACE_EASY', d.date);
    } else if (d.role !== 'race') no('RACE_ROLE', d.date);
  }

  // K2 (pouka 9): nedelja 1 ispod trenutnog obima samo uz dugi na 150 min.
  const w1 = p.weeks[0]!;
  if (w1.targetKm < p.startKm) {
    st.week1Below++;
    if (longOf(w1) !== time10) {
      st.week1BelowNotTime++;
      no('WEEK1_BELOW', `${w1.targetKm} < ${p.startKm}`);
    }
  }
  if (fitted) st.capacityPlans++;
  if (dropped) st.doseDroppedPlans++;
  if (longer) st.longerQualityPlans++;
  if (longest < 160) st.longShortPlans++;
  st.peakRatioSum += p.peakKm / p.startKm;
}
