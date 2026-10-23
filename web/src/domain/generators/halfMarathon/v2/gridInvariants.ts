/* Nezavisne invarijante mreže HM v2 (Uslov 8, pouke 1–14, 28) — brojevi iz odluka (MASTER § 4 H15 i H13 sa
   odlukama organizatora: udeo 4 dana 40 %, dugi ≤ 24 km; H16 po osećaju i test; H17 početnik), NE iz koda
   generatora (nije testni fajl: dele ga grid testovi i docs/hm-v2/artifacts/segment-0N/k-metrics.ts). Prekršaji
   idu u `bad[invarijanta]`, brojke K1–K6 u `GridStats`. */

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
/** H17: T kontinuirano početnika [1,5; 2,0; …]. */
const T_C_BEG = [1500, ...T_C];
const T_CRUISE = [2400, 3000, 3200, 4000, 4800, 6000, 6400, 8000, 9000];
const RP = [4000, 5000, 6000, 8000, 9000, 10000, 12000];
const EPS = 1e-9;
const to10 = (km: number): number => Math.round(km * 10);
export const isBuild = (ph: Phase): boolean =>
  ph === 'base' || ph === 'development' || ph === 'specific';
export const steady = (w: PlanWeek): boolean => isBuild(w.phase) && !w.deload;
/** H16: RPE po zoni (T 6–7, RP 6–7, I 8, R 8). */
const RPE: Record<string, [number, number]> = { T: [6, 7], RP: [6, 7], I: [8, 8], R: [8, 8] };
/** H2/H16: VDOT čiji je brži kraj E (0,70) jednak laganom tempu — Daniels–Gilbert VO2(v), nezavisno od koda. */
const feelVdot = (easy: number): number => {
  const v = 60000 / easy;
  const raw = (-4.6 + 0.182258 * v + 0.000104 * v * v) / 0.7;
  return Math.min(60, Math.max(25, Math.round(raw * 10) / 10));
};
/** ≈ 60 % poslednje doze, nivo lestvice naniže, najmanje `min` (H5/H7). */
const reduced = (ladder: readonly number[], last: number, min: number): number =>
  ladder.filter((m) => m <= 0.6 * last + 1e-6 && m >= min).pop() ?? min;

/** Pouka 32: najniži nivo zone [m] — izgradnja: prvi nivo lestvice (R 6 × 200, I 2 × 1000, T kont. 2,0 (početnik
    1,5), T cruise 2 × 1200, RP 2 × 2000); rasterećenje i taper: T 2,0 km (početnik 1,5), RP 2 × 2000 m. */
const LOWEST: Record<string, number> = {
  R: 1200,
  I: 2000,
  T_continuous: 2000,
  T_cruise: 2400,
  RP: 4000
};

export interface GridStats {
  plans: number;
  /** K2: nedelja 1 ispod trenutnog obima — ukupno / dugi nije na apsolutnom plafonu (150 min, 24 km,
      skorašnji najduži); po plafonu (dugi na 150 min / na 24 km / na granici skorašnjeg najdužeg). */
  week1Below: number;
  week1BelowNotTime: number;
  week1BelowAt: { time: number; km: number; recent: number };
  /** Pouka 28: najveći skok dugog nedelja 1 → 2 (odnos; `longJump12MaxL` prema max(dugi ned 1, skorašnji
      najduži)) i nedelja izgradnje sa dugim na kotrljajućoj granici. */
  longJump12Max: number;
  longJump12MaxL: number;
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
  /** H16: test u rasterećenju / test u rasterećenju sa skraćenim dugim; dan testa duži (km) od dugog nedelje. */
  testInDeload: number;
  testDeloadShortLong: number;
  testLongerThanLong: number;
  /** H17/HI10: nedelje izgradnje T kontinuirano umesto lestvice faze; taper T umesto RP; najduži dugi < 14 km. */
  beginnerTFallbackWeeks: number;
  beginnerTaperT: number;
  beginnerLongShort: number;
  /** Pouka 32 (HM-04 A): dani duži od dugog po vrsti nedelje — iznad najnižeg nivoa zone (mora biti 0),
      najniži nivo zone (izuzetak), test; nedelje sa padom doze zbog trajanja; spuštene doze rasterećenja/tapera. */
  overLong: Record<'build' | 'deload' | 'taper', { above: number; lowest: number; test: number }>;
  lowestOverLongWeek1: number;
  lowestOverLongPlans: number;
  durationDropWeeks: number;
  /** Pouka 35: nedelje izgradnje u kojima je drugi dan kvaliteta lagan. */
  secondEasyWeeks: number;
  /** Pouka 35: dva kvaliteta ostaju jer je dugi na plafonu (nedelja sa jednim kvalitetom neizvodljiva). */
  secondKeptAtCapWeeks: number;
  reducedDeloadTaper: number;
}

export const emptyStats = (): GridStats => ({
  plans: 0,
  week1Below: 0,
  week1BelowNotTime: 0,
  week1BelowAt: { time: 0, km: 0, recent: 0 },
  longJump12Max: 0,
  longJump12MaxL: 0,
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
  longAt24Plans: 0,
  testInDeload: 0,
  testDeloadShortLong: 0,
  testLongerThanLong: 0,
  beginnerTFallbackWeeks: 0,
  beginnerTaperT: 0,
  beginnerLongShort: 0,
  overLong: {
    build: { above: 0, lowest: 0, test: 0 },
    deload: { above: 0, lowest: 0, test: 0 },
    taper: { above: 0, lowest: 0, test: 0 }
  },
  lowestOverLongWeek1: 0,
  lowestOverLongPlans: 0,
  durationDropWeeks: 0,
  secondEasyWeeks: 0,
  secondKeptAtCapWeeks: 0,
  reducedDeloadTaper: 0
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
  const beg = p.input.experience === 'beginner';
  const row0 = ROWS[nDays];
  if (!row0 || (beg && nDays !== 4 && nDays !== 5)) {
    no('DAYS', `${nDays} dana${beg ? ' (početnik 4–5)' : ''}`);
    return;
  }
  // H17: početnik — 1 kvalitet + (dani − 2) lagana; udeo i minimum iz reda H15.
  const row = beg ? { ...row0, q: 1, easy: nDays - 2 } : row0;
  const SHARE = row.share;
  const WEEK_MIN = row.weekMin;
  const one = row.q === 1;
  const LONG_SEC = beg ? 8100 : LONG_MAX_SEC;
  const time10 = Math.floor((LONG_SEC / p.paces.E.slow) * 10 + EPS);
  const intro = (w: PlanWeek): boolean => beg && w.index <= 2;

  // H16: osnova tempa — bez pouzdanog rezultata (nema ga u mreži 03 po osećaju) plan po osećaju: E = lagan ±
  // 15 s, procena VDOT-a nezavisnom formulom, bez prognoze i cilja; RPE po zoni na svakom kvalitetu.
  const easyIn = p.input.easyPaceSecPerKm;
  const feel = !p.input.recentResult;
  if (feel) {
    if (p.paceBasis !== 'feel') no('PACE_BASIS', 'po osećaju bez oznake');
    if (easyIn == null || p.paces.E.fast !== easyIn - 15 || p.paces.E.slow !== easyIn + 15)
      no('FEEL_E', `${p.paces.E.fast}–${p.paces.E.slow}`);
    if (easyIn != null && p.vdot !== feelVdot(easyIn))
      no('FEEL_VDOT', `${p.vdot} ≠ ${feelVdot(easyIn)}`);
    if (p.predictedHmSec !== null || p.goal !== null) no('FEEL_NO_FORECAST', 'prognoza/cilj');
  } else if (p.paceBasis !== undefined) no('PACE_BASIS', 'rezultat sa oznakom');
  for (const w of p.weeks)
    for (const d of w.days) {
      const z = d.workout.dose?.zone;
      const r = d.workout.rpe;
      if (d.workout.kind === 'quality' && feel) {
        if (!z || !r || r.min !== RPE[z]![0] || r.max !== RPE[z]![1])
          no('RPE', `ned ${w.index} ${d.date}`);
      } else if (r !== undefined) no('RPE', `ned ${w.index} ${d.date} bez kvaliteta/rezultat`);
    }

  // H16: test 5 km — plan po osećaju koji nije početnik: tačno jedan, u poslednjoj nedelji baze, na danu Q1
  // (rasterećenje: dan T slota — Q2, 3 dana Q1); WU/CD po pojasu, 5 km, u obimu, bez doze. Inače nijedan.
  const tests = p.weeks.flatMap((w) =>
    w.days.filter((d) => d.workout.kind === 'test').map((d) => ({ w, d }))
  );
  const lastBase = p.weeks.map((w) => w.phase).lastIndexOf('base') + 1;
  if (feel && !beg) {
    const t = tests[0];
    if (tests.length !== 1 || !t || t.w.index !== lastBase)
      no('TEST_ONCE', `${tests.length} testova`);
    else {
      const wantDay = t.w.deload && !one ? p.pattern.q2 : p.pattern.q1;
      const s0 = t.d.workout.segments;
      if (
        t.d.weekday !== wantDay ||
        !t.d.countsToWeek ||
        t.d.workout.dose !== null ||
        s0.length !== 3 ||
        s0[1]!.km !== 5 ||
        s0[0]!.sec !== band(p.input.currentWeeklyKm)[0] ||
        s0[2]!.sec !== band(p.input.currentWeeklyKm)[1]
      )
        no('TEST_DAY', `ned ${t.w.index} ${t.d.weekday}`);
      if (t.w.days.some((d) => d.workout.kind === 'quality' && (t.w.deload || d.role === 'q1')))
        no('TEST_DAY', `ned ${t.w.index}: kvalitet uz test`);
      if (!t.w.test) no('TEST_DAY', 'oznaka nedelje');
      if (t.w.deload) st.testInDeload++;
      const lt = t.w.days.find((d) => d.role === 'long')!.workout.km;
      if (t.d.workout.km > lt) st.testLongerThanLong++;
    }
  } else if (tests.length > 0 || p.weeks.some((w) => w.test)) no('TEST_NONE', `${tests.length}`);
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
  const [wu, cd] = beg ? [900, 600] : band(p.input.currentWeeklyKm);
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
  let lastT = 0;
  let prevSteady: PlanWeek | null = null;
  let dropped = false;
  let longer = false;
  let lowestOver = false;
  let fitted = false;
  /** Pouka 32: doza ispod pravila (≈ 60 %) samo uz napomenu „pouka 32" i ≥ najmanje doze. */
  const lowered = (w: PlanWeek, got: number, rule: number, min: number, what: string): boolean => {
    if (got > rule || got < min) return false;
    if (got < rule) {
      st.reducedDeloadTaper++;
      if (!w.notes.some((n) => n.includes('pouka 32')))
        no('POUKA32_NOTE', `ned ${w.index} ${what}`);
    }
    return true;
  };
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
    // Pouka 32: dan kvaliteta iznad najnižeg nivoa zone ≤ dugi po trajanju (WU + rad + oporavci + CD; džog
    // zadat metrima sporim E); najniži nivo i test se samo broje.
    const lw0 = w.days.find((d) => d.role === 'long');
    if (w.phase !== 'race' && lw0) {
      const kind = w.deload ? 'deload' : w.phase === 'taper' ? 'taper' : 'build';
      for (const d of w.days) {
        if (d.workout.kind === 'test') {
          if (d.workout.sec > lw0.workout.sec) st.overLong[kind].test++;
          continue;
        }
        const dose = d.workout.dose;
        if (d.workout.kind !== 'quality' || !dose) continue;
        const sec = d.workout.segments.reduce(
          (a, x) =>
            a +
            (x.kind === 'recovery' && x.kmBasis === 'exact'
              ? Math.round(x.km * p.paces.E.slow)
              : x.sec),
          0
        );
        if (sec <= lw0.workout.sec) continue;
        const low =
          kind === 'build'
            ? dose.doseM <= (beg && dose.ladder === 'T_continuous' ? 1500 : LOWEST[dose.ladder]!)
            : dose.doseM <= (dose.zone === 'RP' ? 4000 : beg ? 1500 : 2000);
        if (low) {
          st.overLong[kind].lowest++;
          lowestOver = true;
          if (w.index === 1) st.lowestOverLongWeek1++;
        } else {
          st.overLong[kind].above++;
          no('POUKA32_OVER_LONG', `${tag} ${dose.zone} ${dose.doseM}`);
        }
      }
    }
    // H17: uvod bez kvaliteta; početnik ≤ 1 kvalitet nedeljno.
    const nQ = w.days.filter((d) => d.workout.kind === 'quality').length;
    if (intro(w) && nQ > 0) no('INTRO', tag);
    if (beg && nQ > 1) no('BEGINNER_ONE_Q', tag);
    // H14: WU/CD po pojasu (početnik 15/10).
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
      // Pouka 32 (fuzz F6): rasterećenje sa testom — dugi podignut do trajanja dana testa (napomena „podignut").
      const raised = !!w.test && w.notes.some((n) => n.includes('podignut'));
      if (lastLong !== null && long !== null && long > Math.floor(0.8 * lastLong + EPS) && !raised)
        no('DELOAD_LONG', tag);
      const qs = w.days.filter((d) => d.workout.kind === 'quality');
      if (qs.length === 0 && !w.test) st.deloadNoQuality++;
      if (w.test && lastLong !== null && long !== null && long < Math.floor(0.8 * lastLong + EPS))
        st.testDeloadShortLong++;
      // 3 dana: T ≈ 60 % poslednje doze jedinog slota, na danu Q1 (HI6). Početnik (HI10): ≈ 60 % poslednje T
      // doze, min 1,5 km.
      const ladder = w.phase === 'base' ? (beg ? T_C_BEG : T_C) : T_CRUISE;
      const tSlot = one ? 'q1' : 'q2';
      const tWant = beg
        ? reduced(ladder, lastT, 1500)
        : reduced(ladder, one ? lastQ1 : lastQ2, 2000);
      if (
        qs.length > 1 ||
        (qs.length === 1 &&
          (qs[0]!.role !== tSlot ||
            !lowered(w, doseOf(w, tSlot), tWant, beg ? 1500 : 2000, 'T rasterećenja')))
      )
        no('DELOAD_QUALITY', `${tag} T ${doseOf(w, tSlot)} ≠ ${tWant}`);
    } else if (isBuild(w.phase)) {
      run++;
      if (run > 4 || (run === 4 && !first(w.index))) no('DELOAD_RUN', tag);
    }
    if (steady(w)) {
      // K3: kvaliteti reda (test zamenjuje Q1; uvod bez kvaliteta); H6: rast ≤ +6 % (1,0–4,0 km), početnik
      // +5 % (1,0–2,0 km), ≤ granica; nedelja 1 = trenutni (pouka 9).
      const nq = w.days.filter((d) => d.workout.kind === 'quality').length;
      // Pouka 35 (Faza 4a N5): drugi dan kvaliteta lagan (napomena) — dan Q2 šablona je lagan.
      const second =
        row.q === 2 && w.notes.some((n) => n.includes('(pouka 35)')) && p.pattern.q2 !== null
          ? w.days.find((d) => d.weekday === p.pattern.q2)?.role === 'easy'
          : false;
      if (second) st.secondEasyWeeks++;
      if (!intro(w) && nq !== row.q - (w.test ? 1 : 0) - (second ? 1 : 0)) st.buildNoQuality++;
      // Pouka 35: u nedelji sa dva dana kvaliteta (ili testa) nijedan nije duži od dugog.
      const lw2 = w.days.find((d) => d.role === 'long');
      const hard2 = w.days.filter((d) => d.workout.kind === 'quality' || d.workout.kind === 'test');
      // Izuzetak: dugi na svom plafonu (udeo, 150 min, 24 km, pouka 28) — nedelja sa jednim kvalitetom bi imala
      // lagane duže od dugog (pouka 2), pa ostaju dva kvaliteta (upozorenje pouke 14).
      const cap2 = Math.min(
        Math.floor(SHARE * to10(w.targetKm) + EPS),
        time10,
        LONG_MAX10,
        roll10(w.index)
      );
      if (lw2 && hard2.length === 2 && hard2.some((d) => d.workout.sec > lw2.workout.sec)) {
        if (to10(lw2.workout.km) < cap2) no('POUKA35', tag);
        else st.secondKeptAtCapWeeks++;
      }
      const t10 = to10(w.targetKm);
      if (lastBuild !== null) {
        const g = beg
          ? Math.min(20, Math.max(10, Math.round(lastBuild * 0.05)))
          : Math.min(40, Math.max(10, Math.round(lastBuild * 0.06)));
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
      // Pouka 32: pad doze zbog trajanja dana je kapacitet (napomena „pouka 32, plafon zone").
      const durationDrop = w.notes.some((n) => n.includes('pouka 32, plafon zone'));
      if (drop) {
        dropped = true;
        if (durationDrop) st.durationDropWeeks++;
        else if (w.fitted !== 'down') st.dropOutsideCapacity++;
      }
      // H16/H17: nedelja testa i uvoda nema Q1 (stanje slota i glavna doza se ne porede).
      const counted = !w.test && !intro(w);
      if (prevSteady && !drop && counted) {
        // T slot (Q2) nosi dozu kroz sve faze; Q1 u istoj fazi i na prelazu I → RP (3 dana: jedini slot
        // kroz sve faze T kont. → T cruise → RP, HI6).
        const q1Carries = one || w.phase === prevSteady.phase || w.phase === 'specific';
        // Pouka 35: nedelja bez drugog dana kvaliteta ne poredi Q2 ni glavnu dozu (stanje Q2 ostaje).
        if ((!second && q2 < lastQ2) || (q1Carries && q1 < lastQ1)) no('DOSE_DECREASE', tag);
        const main = (x: PlanWeek): number =>
          x.days.reduce(
            (a, d) =>
              a +
              (d.workout.kind === 'quality'
                ? d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP
                : 0),
            0
          );
        if (!second && main(w) + 1e-6 < main(prevSteady)) no('MAIN_DOSE_DECREASE', tag);
        const key = (x: PlanWeek): string =>
          JSON.stringify(
            x.days.filter((d) => d.workout.kind === 'quality').map((d) => d.workout.blocks)
          );
        if (key(w) === key(prevSteady) && !w.days.some((d) => d.workout.dose?.step === 'repeat'))
          no('IDENTICAL_WEEKS', tag);
      }
      // H17: početnik bez I/R; T kontinuirano od 1,5 km na prvoj nedelji kvaliteta (prvi nivo, HI10).
      if (beg) {
        const qd = w.days.find((d) => d.workout.kind === 'quality')?.workout.dose;
        if (qd && w.phase !== 'base' && qd.ladder === 'T_continuous') st.beginnerTFallbackWeeks++;
        if (qd && w.index === 3 && qd.zone === 'T' && qd.doseM !== 1500)
          no('BEGINNER_START', `${tag} ${qd.doseM}`);
      }
      if (w.days.some((d) => d.workout.dose?.step === 'repeat')) st.slotRepeatWeeks++;
      // Pouka 14: kvalitetni dan duži od dugog (trajanje).
      const lw = w.days.find((d) => d.role === 'long');
      if (lw && w.days.some((d) => d.workout.kind === 'quality' && d.workout.sec > lw.workout.sec))
        longer = true;
      lastBuild = t10;
      peak = Math.max(peak, t10);
      if (long !== null) lastLong = long;
      if (q1 > 0) lastQ1 = q1;
      if (q2 > 0) lastQ2 = q2;
      const tz = w.days.filter((d) => d.workout.dose?.zone === 'T').pop();
      if (tz) lastT = tz.workout.dose!.doseM;
      if (counted && !second) prevSteady = w;
    }
    if (w.phase === 'taper') {
      // H7: cilj ≤ 0,7 × vrh; RP i T ≈ 60 % (min 2 × 2000 m, 2,0 km); dugi ≤ 0,6 × najduži.
      if (to10(w.targetKm) > Math.round(0.7 * peak)) no('TAPER_TARGET', tag);
      if (long !== null && long > Math.max(40, Math.floor(0.6 * longest + EPS)))
        no('TAPER_LONG', tag);
      const q1d = w.days.find((d) => d.role === 'q1')?.workout.dose;
      // H17/HI10: taper početnika T kontinuirano ≈ 60 % poslednje T doze (min 1,5 km) kad RP ne staje.
      const rp = q1d?.zone === 'RP' ? q1d.doseM : 0;
      const t = doseOf(w, 'q2');
      if (q1d && q1d.zone === 'T') {
        st.beginnerTaperT++;
        if (!beg || !lowered(w, q1d.doseM, reduced(T_C_BEG, lastT, 1500), 1500, 'T tapera'))
          no('TAPER_T', `${tag} početnik`);
        if (4000 <= Math.floor(0.15 * w.targetKm * 1000 + 1e-6)) no('TAPER_T', `${tag} RP staje`);
      } else if (rp === 0 || (!one && t === 0)) st.taperRelaxed++;
      if (rp !== 0 && !lowered(w, rp, reduced(RP, lastQ1, 4000), 4000, 'RP tapera'))
        no('TAPER_RP', `${tag} ${rp}`);
      // 3 dana: taper samo RP (HI6).
      if (one && t !== 0) no('TAPER_T', `${tag} 3 dana T ${t}`);
      if (t !== 0 && !lowered(w, t, reduced(T_CRUISE, lastQ2, 2000), 2000, 'T tapera'))
        no('TAPER_T', `${tag} ${t}`);
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
  const taperRp =
    tw.days.find((d) => d.role === 'q1')?.workout.dose?.zone === 'RP' ? doseOf(tw, 'q1') : 0;
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
  // H17: granica vrha min(1,4×, +15, max); upozorenje kad je najduži dugi < 14 km.
  if (beg) {
    const s10 = to10(p.startKm);
    const peakMax10 = nDays === 4 ? 700 : 850;
    if (to10(p.peakCapKm) !== Math.min(Math.floor(1.4 * s10 + EPS), s10 + 150, peakMax10))
      no('BEGINNER_PEAK', `${p.peakCapKm}`);
    const warned = p.warnings.some((v) => v.rule === 'LONG_RUN_SHORT');
    if (warned !== longest < 140) no('BEGINNER_LONG_WARN', `${longest / 10}`);
    if (longest < 140) st.beginnerLongShort++;
  }
  if (fitted) st.capacityPlans++;
  if (dropped) st.doseDroppedPlans++;
  if (longer) st.longerQualityPlans++;
  if (lowestOver) st.lowestOverLongPlans++;
  if (longest < 160) st.longShortPlans++;
  if (longest === LONG_MAX10) st.longAt24Plans++;
  const [l1, l2] = longsByWeek;
  if (l1 && l2) {
    st.longJump12Max = Math.max(st.longJump12Max, l2 / l1);
    st.longJump12MaxL = Math.max(st.longJump12MaxL, l2 / Math.max(l1, r10 ?? 0));
  }
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
