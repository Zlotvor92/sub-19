/* Nezavisne invarijante mreže HM v2 (Uslov 8, pouke 1–14, 28) — brojevi iz odluka (MASTER § 4 H15 i H13 sa
   odlukama organizatora: udeo 4 dana 40 %, dugi ≤ 24 km), NE iz koda generatora (nije testni fajl: dele ga grid
   testovi i docs/hm-v2/artifacts/segment-0N/k-metrics.ts). Prekršaji idu u `bad[invarijanta]`, brojke K1–K6 u
   `GridStats`. */

import { daysBetween } from './dates.ts';
import type { HmV2Plan, Phase, PlanWeek } from './types.ts';

/** H15: po broju dana — broj kvaliteta, laganih, udeo dugog, minimum nedelje. */
const ROWS: Record<number, { q: number; easy: number; share: number; weekMin: number }> = {
  3: { q: 1, easy: 1, share: 0.45, weekMin: 12 },
  4: { q: 2, easy: 1, share: 0.4, weekMin: 16 },
  5: { q: 2, easy: 2, share: 0.32, weekMin: 20 },
  6: { q: 2, easy: 3, share: 0.3, weekMin: 24 }
};
/** H13: lagan ≥ 4 km, dugi ≤ 150 min i ≤ 24 km. */
const EASY_MIN10 = 40;
const LONG_MAX_SEC = 9000;
const LONG_MAX10 = 240;
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
  /** K2: nedelja 1 ispod trenutnog obima — ukupno / dugi nije na apsolutnom plafonu (150 min, 24 km,
      skorašnji najduži); po plafonu (dugi na 150 min / na 24 km / na granici skorašnjeg najdužeg). */
  week1Below: number;
  week1BelowNotTime: number;
  week1BelowAt: { time: number; km: number; recent: number };
  /** Pouka 28: najveći skok dugog nedelja 1 → 2 (odnos) i nedelja izgradnje sa dugim na kotrljajućoj granici. */
  longJump12Max: number;
  rollingCappedWeeks: number;
  /** K3: ne-rasteretne nedelje izgradnje sa manje kvaliteta od reda H15 (3 dana 1, inače 2). */
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
  /** H13 (24 km): planova čiji je najduži dugi tačno 24 km. */
  longAt24Plans: number;
}

export const emptyStats = (): GridStats => ({
  plans: 0,
  week1Below: 0,
  week1BelowNotTime: 0,
  week1BelowAt: { time: 0, km: 0, recent: 0 },
  longJump12Max: 0,
  rollingCappedWeeks: 0,
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
  deloadNoQuality: 0,
  longAt24Plans: 0
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
  const nDays = p.input.runDays.length;
  const row = ROWS[nDays];
  if (!row) {
    no('DAYS', `${nDays} dana`);
    return;
  }
  const SHARE = row.share;
  const WEEK_MIN = row.weekMin;
  const one = row.q === 1;
  const time10 = Math.floor((LONG_MAX_SEC / p.paces.E.slow) * 10 + EPS);
  // Pouka 28: dugi nedelje k ≤ max(1,1 × L, L + 1,0) (0,1 km naniže), L = najduži dugi nedelja k − 4 … k − 1,
  // u nedeljama 1–4 i skorašnji najduži r.
  const r = p.input.recentLongRunKm;
  const r10 = r == null ? null : Math.round(r * 10);
  const longsByWeek = p.weeks.map((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? to10(l.workout.km) : null;
  });
  const roll10 = (k: number): number => {
    const prev = longsByWeek
      .slice(Math.max(0, k - 5), k - 1)
      .filter((x): x is number => x !== null);
    if (r10 !== null && k <= 4) prev.push(r10);
    if (prev.length === 0) return Infinity;
    const L = Math.max(...prev);
    return Math.max(Math.floor(1.1 * L + EPS), L + 10);
  };
  const recent10 = roll10(1);
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
        // Pouka 2: dugi ≥ svaki lagan; H13: dugi ≤ udeo reda, ≤ 150 min, ≤ 24 km; pouka 28: nedelja 1 ≤
        // granica skorašnjeg najdužeg.
        if (easy.some((e) => e > long)) {
          no('LONG_GE_EASY', tag);
          st.longBelowEasy++;
        }
        if (long > Math.floor(SHARE * to10(w.targetKm) + EPS) || long > time10)
          no('LONG_CAP', `${tag} ${long / 10}`);
        if (long > LONG_MAX10) no('LONG_24', `${tag} ${long / 10}`);
        if (long > roll10(w.index))
          no('LONG_ROLLING', `${tag} ${long / 10} > ${roll10(w.index) / 10}`);
      }
      if (easy.some((e) => e < EASY_MIN10)) no('EASY_MIN', tag);
      // H15: 5/6 dana lagani jednaki (razlika ≤ 0,1 km); broj dana nedelje = broj dana trčanja.
      if (easy.length > 1 && Math.max(...easy) - Math.min(...easy) > 1) no('EASY_EQUAL', tag);
      if (w.days.length !== nDays) no('DAYS_COUNT', `${tag} ${w.days.length}`);
      // H15 / H10: 3 dana bez I i R (ni jedan metar rada u tim zonama).
      if (one && w.days.some((d) => d.workout.workKm.I > 0 || d.workout.workKm.R > 0))
        no('THREE_DAYS_NO_IR', tag);
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
      // 3 dana: T ≈ 60 % poslednje doze jedinog slota, na danu Q1 (HI6).
      const ladder = w.phase === 'base' ? T_C : T_CRUISE;
      const tSlot = one ? 'q1' : 'q2';
      const tWant = reduced(ladder, one ? lastQ1 : lastQ2, 2000);
      if (
        qs.length > 1 ||
        (qs.length === 1 && (qs[0]!.role !== tSlot || doseOf(w, tSlot) !== tWant)) ||
        (qs.length === 1 && qs[0]!.workout.workKm.T * 1000 < tWant - 1e-6)
      )
        no('DELOAD_QUALITY', `${tag} T ${doseOf(w, tSlot)} ≠ ${tWant}`);
    } else if (isBuild(w.phase)) {
      run++;
      if (run > 4 || (run === 4 && !first(w.index))) no('DELOAD_RUN', tag);
    }
    if (steady(w)) {
      // K3: dva kvaliteta; H6: rast ≤ +6 % (1,0–4,0 km), ≤ granica; nedelja 1 = trenutni (pouka 9).
      const nq = w.days.filter((d) => d.workout.kind === 'quality').length;
      if (nq !== row.q) st.buildNoQuality++;
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
        // T slot (Q2) nosi dozu kroz sve faze; Q1 u istoj fazi i na prelazu I → RP (3 dana: jedini slot
        // kroz sve faze T kont. → T cruise → RP, HI6).
        const q1Carries = one || w.phase === prevSteady.phase || w.phase === 'specific';
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
      if (rp === 0 || (!one && t === 0)) st.taperRelaxed++;
      if (rp !== 0 && rp !== reduced(RP, lastQ1, 4000)) no('TAPER_RP', `${tag} ${rp}`);
      // 3 dana: taper samo RP (HI6).
      if (one && t !== 0) no('TAPER_T', `${tag} 3 dana T ${t}`);
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
  // H8: dana sa trkom = min(broj dana, 5).
  if (rw.days.filter((d) => d.role !== 'race').length !== Math.min(nDays, 5) - 1)
    no('RACE_DAYS', 'broj dana');
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

  // K2 (pouka 9, HI8): nedelja 1 ispod trenutnog obima samo uz dugi na apsolutnom plafonu — min(150 min,
  // 24 km, granica skorašnjeg najdužeg).
  const w1 = p.weeks[0]!;
  if (w1.targetKm < p.startKm) {
    st.week1Below++;
    const l1 = longOf(w1);
    const abs = Math.min(time10, LONG_MAX10, recent10);
    if (l1 !== abs) {
      st.week1BelowNotTime++;
      no('WEEK1_BELOW', `${w1.targetKm} < ${p.startKm}`);
    } else if (abs === recent10 && r != null) st.week1BelowAt.recent++;
    else if (abs === LONG_MAX10) st.week1BelowAt.km++;
    else st.week1BelowAt.time++;
  }
  if (fitted) st.capacityPlans++;
  if (dropped) st.doseDroppedPlans++;
  if (longer) st.longerQualityPlans++;
  if (longest < 160) st.longShortPlans++;
  if (longest === LONG_MAX10) st.longAt24Plans++;
  const [l1, l2] = longsByWeek;
  if (l1 && l2) st.longJump12Max = Math.max(st.longJump12Max, l2 / l1);
  for (const w of p.weeks)
    if (steady(w) && longsByWeek[w.index - 1] === roll10(w.index)) st.rollingCappedWeeks++;
  st.peakRatioSum += p.peakKm / p.startKm;
}

/** Pouka 28 (nezavisno): plan ima nedelju čiji je dugi tačno na kotrljajućoj granici, a ona je niža od udela
    reda, 150 min i 24 km — pravilo zaista seče dugi (regresija prema HM-01: dozvoljen uzrok promene). */
export function rollingBinds(p: HmV2Plan): boolean {
  const row = ROWS[p.input.runDays.length]!;
  const time10 = Math.floor((LONG_MAX_SEC / p.paces.E.slow) * 10 + EPS);
  const r = p.input.recentLongRunKm;
  const longs = p.weeks.map((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? to10(l.workout.km) : null;
  });
  return p.weeks.some((w, i) => {
    const l = longs[i];
    if (l === null || l === undefined) return false;
    const prev = longs.slice(Math.max(0, i - 4), i).filter((x): x is number => x !== null);
    if (r != null && i < 4) prev.push(Math.round(r * 10));
    if (prev.length === 0) return false;
    const L = Math.max(...prev);
    const roll = Math.max(Math.floor(1.1 * L + EPS), L + 10);
    const other = Math.min(Math.floor(row.share * to10(w.targetKm) + EPS), time10, LONG_MAX10);
    return l === roll && roll < other;
  });
}
