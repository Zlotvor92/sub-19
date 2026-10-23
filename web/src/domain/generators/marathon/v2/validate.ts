/* Provera plana prema policy.ts (M1–M18, A1–A17). SAMO prijavljuje prekršaje; plan se nikad ne menja i nema
   petlji skraćivanja. Greške obaraju plan (generate.ts → PLAN_VIOLATES_POLICY); upozorenja idu u plan. Svaka
   odluka generatora ima ovde nezavisnu proveru (pravilo se ponovo računa iz ulaza i politike). Segment 04 (M18):
   adaptiran plan (plan.adaptation) — tempo i osnova tempa po nedelji (steps.ts), okviri iz koraka (steps.framesFor:
   nov start, prinudno rasterećenje, A17, test, ograničenja), cilj po pravilu adaptiranog plana (volume.adaptNominal10),
   ograničenja po datumima (LIMITS), doza ne raste u nedelji sa ograničenjem (ONE_QUALITY). Nedelje iz mixedWeeks
   proveravaju se samo na nivou dana; provere zavisne od stanja prethodne nedelje posle mešovite nedelje se
   preskaču dok ga nova nedelja ne odredi. */

import { addDays as isoAdd, daysBetween, mustDay, weekdayOf } from './dates.ts';
import { checkInput } from './input.ts';
import {
  adaptedLongCap10,
  deloadLengths,
  jumpBase10,
  longCap10,
  longestLong10,
  longJumpCap10,
  longJumpNote,
  longShortOf,
  longsOf,
  longTimeCap10,
  longTimeCapNote,
  recentLongNote,
  taperLongFactor10
} from './lengths.ts';
import {
  assessGoal,
  midEasy,
  predictedMarathon,
  raceTimeForVdot,
  vdotFromEasyPace
} from './paces.ts';
import {
  buildAllowed,
  deloadAllowed,
  firstOfPhase,
  isBuildPhase,
  periodize,
  phasesOf,
  taperStep
} from './periodize.ts';
import { keptKm100, mixedRest, pauseOwned } from './mixed.ts';
import { BEGINNER_DAYS_COUNTS, MARATHON_V2_POLICY as P, RUN_DAYS_COUNTS } from './policy.ts';
import {
  capM,
  carries,
  type DayFits,
  deloadLadder,
  deloadMinM,
  deloadSlot,
  fitsDay,
  floorOf,
  ladderFor,
  nextLevel,
  pickDeload,
  type QualityState,
  reduced,
  type SlotState,
  taperDoses
} from './quality.ts';
import { adjacentDays } from './schedule.ts';
import {
  A17_MAX_RUN,
  appliedRestarts,
  basePaces,
  basisAt,
  dateIn,
  deloadWeekOf,
  framesFor,
  inRange,
  jumpRecentKm,
  pacesAt,
  preStartOf,
  stateRefOf,
  restartWeeks
} from './steps.ts';
import type {
  DateRange,
  DayRole,
  Dose,
  LadderId,
  MarathonV2Plan,
  Paces,
  Phase,
  PlanDay,
  PlanWeek,
  QualityType,
  Structure,
  WeekFrame,
  Weekday,
  WorkZone
} from './types.ts';
import {
  adaptNominal10,
  adaptVolume,
  capacityLimits,
  capacityMessage,
  capacityWeeks,
  enterWeek,
  fewerDaysAdvice,
  initialAdaptHistory,
  leaveWeek,
  nominal10,
  peakCap10,
  startKm10,
  weekMin10
} from './volume.ts';
import {
  buildDayLimit,
  type DayLimitContext,
  dayLimitContext,
  deloadDayLimit,
  lowestBuild,
  oneDayLimit,
  allRestWeek,
  raceOnlyWeek,
  raceWeekRest,
  secondEasyWeek,
  secondQualityEasy,
  taperWeekLimit
} from './week.ts';
import {
  doseOf,
  ladderLevels,
  qualityDaySec,
  recoveryOf,
  repsOf,
  sameStructure,
  structuresForDose,
  warmupCooldown,
  zoneOf
} from './workouts.ts';

const EPS = 1e-6;
const RUN_DAYS_MAX = RUN_DAYS_COUNTS[RUN_DAYS_COUNTS.length - 1]!;
const BEGINNER_DAYS_MAX = BEGINNER_DAYS_COUNTS[BEGINNER_DAYS_COUNTS.length - 1]!;
const PHASES: readonly Phase[] = ['base', 'development', 'specific', 'taper', 'race'];
const HARD: readonly DayRole[] = ['q1', 'q2', 'long', 'sharpener', 'race', 'test'];
const ZONES: readonly WorkZone[] = ['R', 'I', 'T', 'MP'];
const to10 = (km: number): number => Math.round(km * 10);
const to100 = (km: number): number => Math.round(km * 100);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const planned100 = (ds: readonly PlanDay[]): number =>
  ds.reduce((a, d) => a + (d.countsToWeek ? to100(d.workout.km) : 0), 0);

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
/** M15 3 dana: jedan kvalitet — baza T kont. (↔ deonice), razvoj T cruise (↔ kont.), specifično MP; bez I i R. */
const SLOT_TYPES_ONE: Readonly<
  Record<Phase, { q1: readonly QualityType[]; q2: readonly QualityType[] }>
> = {
  base: { q1: ['T_continuous', 'T_cruise'], q2: [] },
  development: { q1: ['T_cruise', 'T_continuous'], q2: [] },
  specific: { q1: ['MP'], q2: [] },
  taper: { q1: ['MP'], q2: [] },
  race: { q1: [], q2: [] }
};

const isSteady = (w: PlanWeek): boolean => isBuildPhase(w.phase) && !w.deload;
const sameLimits = (a: WeekFrame, b: WeekFrame): boolean =>
  JSON.stringify(a.limits ?? null) === JSON.stringify(b.limits ?? null);
/** Nedelja izgradnje čiji se kvalitet poredi u progresiji (M12): bez testa (M16) i uvoda (M17). */
const hasQualityWork = (w: PlanWeek): boolean => w.days.some((d) => d.workout.kind === 'quality');
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
  const chk = checkInput(input);
  if (!chk.ok) {
    err('INPUT', `Ulaz plana nije ispravan (M1): ${chk.reasons.map((r) => r.code).join(', ')}.`);
    return out;
  }
  // M15/M17: red tabele (početnik: tabela početnika) iz ulaza.
  const rule = chk.rule;
  const beginner = rule.beginner;
  const feel = chk.pace.kind === 'feel';
  const pace = chk.pace;
  const km = input.currentWeeklyKm;
  // Segment 04: adaptacija — koraci, mešovite nedelje, tempo i osnova tempa nedelje, okviri iz koraka.
  const ad = plan.adaptation;
  const steps = ad?.steps ?? [];
  const mixed = new Set(ad?.mixedWeeks ?? []);
  const checked = (w: PlanWeek): boolean => !mixed.has(w.index);
  /** MAR-07b (pouka 4, stalni uslov 4): zaštićen dan — ≤ asOf adaptacije, zaključan (ručna izmena) ili urađen. Završna
      zaštita samo štiti: provere koje sude jednom danu po tempu ili strukturi ga preskaču (kao LIMITS) — validator
      ne sudi činjenicama. */
  const lockedIds = new Set([...(ad?.lockedDayIds ?? []), ...(ad?.doneDayIds ?? [])]);
  const protectedDay = (d: { date: string }): boolean =>
    lockedIds.has(d.date) || (ad !== undefined && mustDay(d.date) <= mustDay(ad.asOf));
  const pw = (w: { index: number }): Paces => pacesAt(pace, steps, w.index, km);
  const feelW = (w: { index: number }): boolean => basisAt(pace, steps, w.index) === 'feel';
  const base0 = steps.length > 0 ? periodize(input.startDate, N, feel && rule.feelTest) : null;
  /** A17: ukinuta redovna rasterećenja (isti podatak kao konstruktor, steps.framesFor). */
  const dropped = new Map<number, number>();
  const frames =
    base0 && base0.length === N
      ? framesFor(
          base0,
          plan.pattern,
          input.runDays,
          input.raceDate,
          pace,
          steps,
          dropped,
          lockedIds
        )
      : null;
  const restarts = base0 ? appliedRestarts(base0, steps) : new Set<number>();
  /** M13a (pouka 34): „nedelja 0" plafona skoka — skorašnji najduži iz ulaza i dugi reference umora pre starta. */
  const recentJ = jumpRecentKm(input.recentLongRunKm, steps);
  /** Pouka 34: referenca umora pre starta (ned 1 generatora) — stanje pre nedelje 1. */
  const pre = preStartOf(steps);
  /** A3: nov start počinje progresiju doze iznova i kad faze ostaju (odstupanje A3). */
  const doseRestarts = restartWeeks(steps);
  const firstAdapted = steps.length > 0 ? Math.min(...steps.map((x) => x.firstWeek)) : Infinity;
  /** A9/pouka 33: prva nedelja posle smanjenja obima (dugi rasterećenja sme da se skrati). */
  const reducedFrom = steps.length > 0 ? adaptVolume(steps).reducedFrom : Infinity;
  const forced = (w: PlanWeek): boolean =>
    steps.some((x) => x.deload && deloadWeekOf(x) === w.index);
  /** A12: početak segmenta izgradnje (nov start sa rePeriodize) za nedelju i. */
  const segStart = (i: number): number => Math.max(1, ...[...restarts].filter((r) => r <= i));
  /** A4/A9: nedelja sa manje kvaliteta — ograničenje koraka ili napomena A9 konstruktora. */
  const reducedQ = (w: PlanWeek): boolean =>
    w.limits?.quality !== undefined || w.notes.some((n) => n.includes('(A9)'));
  const noneQ = (w: PlanWeek): boolean =>
    w.limits?.quality === 'none' || w.notes.some((n) => n.includes('nedelja bez kvaliteta'));
  const restOf = (w: PlanWeek): Set<string> => new Set(w.limits?.rest ?? []);
  const painOf = (w: PlanWeek): Set<string> => new Set(w.limits?.pain ?? []);
  const limitedDays = (w: PlanWeek): boolean => restOf(w).size > 0 || painOf(w).size > 0;
  /** A5/pouka 31: prinudno rasterećenje u uvodu početnika — sadržaj uvoda (bez kvaliteta). */
  const introDeload = (w: PlanWeek): boolean => w.deload && w.index <= rule.introWeeks;

  // --- Uslov 6: oznaka politike.
  if (plan.policyId !== P.id || plan.policyVersion !== P.version)
    err('POLICY_STAMP', `Plan mora nositi ${P.id}/${P.version}.`);

  // --- M2: tempo iz rezultata (korekcija obima za MP); M16: po osećaju; M3: ocena cilja. Segment 04 (A1): tempo
  // plana = tempo poslednje nedelje iz koraka (MP po korekciji M2); osnova tempa poslednje nedelje; ocena cilja
  // za nedelje od rezultata do trke; nov start sa < 12 nedelja → „orijentir" (A3, M18).
  const want = pacesAt(pace, steps, N, km);
  const feelN = basisAt(pace, steps, N) === 'feel';
  if (plan.paceBasis !== (feelN ? 'feel' : 'result'))
    err('PACE_BASIS', `Osnova tempa ${plan.paceBasis} ≠ ${feelN ? 'feel' : 'result'} (M16, A1).`);
  if (JSON.stringify(want) !== JSON.stringify(p))
    err(
      'PACES',
      feelN
        ? 'Tempo ≠ M16 (E = lagan ± 15 s, ostale zone iz procene VDOT-a).'
        : 'Tempo ≠ M2 (VDOT iz rezultata, MP iz VDOT-a umanjenog za korekciju obima; A1).'
    );
  if (
    plan.vdot !== want.vdot ||
    plan.predictedMarathonSec !== (feelN ? null : predictedMarathon(want))
  )
    err('PACES', 'VDOT ili prognoza maratona ≠ M2/M16 (po osećaju bez prognoze; A1).');
  if (pace.kind === 'feel') {
    // M16: procena VDOT-a nezavisno — VDOT čiji je brži kraj E jednak laganom tempu, 25–60.
    const f = P.feel;
    const est = Math.round(vdotFromEasyPace(pace.easySecPerKm) * 10) / 10;
    if (basePaces(pace, km).vdot !== Math.min(f.vdotMax, Math.max(f.vdotMin, est)))
      err('PACES', 'Procena VDOT-a ≠ M16.');
    if (est > f.vdotMax)
      warn(
        'VDOT_ESTIMATE_CAPPED',
        `Procena VDOT-a iz laganog tempa ${est} > ${f.vdotMax}: brze zone su ograničene; za ovaj tempo unesi rezultat (M16).`
      );
  }
  const lastRes = [...steps].reverse().find((x) => x.vdot !== null);
  const goal0 =
    input.goalTimeSec && !feelN
      ? assessGoal(want.mpVdot, input.goalTimeSec, lastRes ? N - lastRes.fromWeek + 1 : N)
      : null;
  const goal =
    goal0 && steps.some((x) => x.orientation)
      ? { ...goal0, status: 'orientation' as const, message: P.adapt.orientationMessage }
      : goal0;
  if (JSON.stringify(goal) !== JSON.stringify(plan.goal))
    err('GOAL', 'Ocena cilja ≠ M3/M16 (A1, A3).');
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

  // --- M4 / Uslov 6: faza svake nedelje iz odluke generatora. Segment 04: iz koraka (nov start: A3/A12); okvir
  // nedelje (rasterećenje, ograničenja) = steps.framesFor.
  const expected = frames ? frames.map((f) => f.phase) : phasesOf(N);
  for (const w of weeks) {
    if (!PHASES.includes(w.phase)) err('NO_PHASE', 'Nedelja bez faze.', w.index);
    else if (checked(w) && w.phase !== expected[w.index - 1])
      err('PHASES', `Faza ${w.phase} ≠ ${expected[w.index - 1]} (M4, A12).`, w.index);
    const f = frames?.[w.index - 1];
    if (f && checked(w) && (f.deload !== w.deload || !sameLimits(f, w)))
      err(
        'FRAMES',
        'Rasterećenje ili ograničenja nedelje ≠ koraci adaptacije (A3–A5, A17).',
        w.index
      );
  }
  const phases = weeks.map((w) => w.phase);
  if (phases.filter((x) => x === 'taper').length !== P.phases.taperWeeks)
    err('TAPER_WEEKS', `Taper mora imati ${P.phases.taperWeeks} nedelje (M4, M7).`);

  // --- M5: gde su rasterećenja (pouka 4) i niz izgradnje. Segment 04: relativno od novog starta (A12);
  // prinudno rasterećenje (A5) sme bilo gde u izgradnji, a niz posle njega nije ograničen; A17 (pouka 22): niz
  // koji počinje rasterećenjem ukinutim posle nedelje smanjenja (dropped) najviše A17_MAX_RUN nedelja.
  let run = 0;
  let afterForced = false;
  let afterDropped = false;
  for (const w of weeks) {
    const s0 = segStart(w.index);
    const rel = phases.slice(s0 - 1);
    const k = w.index - s0 + 1;
    if (restarts.has(w.index)) [run, afterForced, afterDropped] = [0, false, false];
    if (w.deload && checked(w) && !forced(w) && !deloadAllowed(rel, k)) {
      const why = !isBuildPhase(w.phase)
        ? `u fazi ${w.phase}`
        : k < P.deload.firstAllowedWeek
          ? 'u nedeljama 1–2'
          : firstOfPhase(rel, k)
            ? 'na prvoj nedelji faze'
            : 'na poslednjoj nedelji pre tapera';
      err('DELOAD_PLACEMENT', `Rasterećenje ${why} (M5).`, w.index);
    }
    if (!isBuildPhase(w.phase)) continue;
    if (w.deload) [run, afterForced, afterDropped] = [0, forced(w), false];
    else {
      if (dropped.has(w.index)) [run, afterDropped] = [0, true];
      const allowed = afterDropped ? run + 1 <= A17_MAX_RUN : buildAllowed(rel, k, run);
      if (!allowed && !afterForced && checked(w))
        err(
          'DELOAD_RUN',
          `${run + 1} uzastopne nedelje izgradnje bez rasterećenja (M5${afterDropped ? ', A17' : ''}).`,
          w.index
        );
      run++;
    }
  }

  // --- M9: uloge dana po šablonu; M5/M7 broj kvaliteta (ostali dani lagani).
  const pat = plan.pattern;
  if ((pat.q2 === null ? 1 : 2) !== rule.quality)
    err('ROLES', `Šablon ima ${pat.q2 === null ? 1 : 2} kvaliteta, M15 traži ${rule.quality}.`);
  if (
    adjacentDays(pat.q1, pat.long) ||
    (pat.q2 !== null && (adjacentDays(pat.q1, pat.q2) || adjacentDays(pat.q2, pat.long)))
  )
    err('HARD_ADJACENT', 'Šablon ima susedne zahtevne dane (M9).');
  const tSlot = deloadSlot(rule.quality);
  // M17: nedelja izgradnje bez Q1 — uvod (ned 1–2) ili početnik kad ni T 1,5 km ne staje u plafon (nezavisno).
  const tFirstM = Math.round(P.beginner.tFirstKm * 1000);
  const noQ1 = (w: PlanWeek): boolean =>
    isSteady(w) &&
    !w.test &&
    (w.index <= rule.introWeeks || (beginner && tFirstM > capM('T', w.targetKm)));
  const qDays: [DayRole, Weekday][] = [
    ['q1', pat.q1],
    ...(pat.q2 !== null ? [['q2', pat.q2] as [DayRole, Weekday]] : [])
  ];
  for (const w of weeks) {
    if (w.phase === 'race' || !checked(w)) continue;
    const has = (r: DayRole): boolean => w.days.some((d) => d.role === r);
    const rest = restOf(w);
    if (w.index >= firstAdapted && (reducedQ(w) || rest.size > 0 || introDeload(w))) {
      // A4/A9: dani odmora bez treninga; dan kvaliteta šablona sme biti lagan ili nositi jedini kvalitet (svoja
      // uloga), ukupno najviše dozvoljeno kvaliteta (ograničenje koraka; A9 manje od pravila; uvod bez kvaliteta).
      const max = noneQ(w) || introDeload(w) ? 0 : reducedQ(w) ? 1 : rule.quality;
      const want: [DayRole, Weekday][] = [
        ...qDays,
        ['long', pat.long],
        ...pat.easy.map((wd): [DayRole, Weekday] => ['easy', wd])
      ];
      const roleAt = new Map(w.days.map((d) => [d.weekday as string, d.role]));
      const bad = want.filter(([r, wd]) => {
        const got = roleAt.get(wd);
        if (rest.has(dateIn(w, wd))) return got !== undefined;
        const slot = qDays.find(([, q]) => q === wd)?.[0];
        return slot
          ? !(got === r || got === slot || got === 'easy' || (got === 'test' && w.test))
          : got !== r;
      });
      const nq = w.days.filter((d) => d.role === 'q1' || d.role === 'q2').length;
      if (
        bad.length > 0 ||
        w.days.length !== want.filter(([, wd]) => !rest.has(dateIn(w, wd))).length ||
        nq > max
      )
        err(
          'ROLES',
          `Dani ${w.days.map((d) => `${d.role}@${d.weekday}`).join(', ')} ne odgovaraju šablonu uz ograničenja (M9, A4, A9).`,
          w.index
        );
      continue;
    }
    // Rasterećenje: samo T slot (Q2; 3 dana Q1); taper: Q1 (MP) i Q2 (T, samo N−2) kad postoje (M7, odstupanje
    // M11 ispred M7).
    // M16: test zamenjuje Q1 (izgradnja) ili kvalitet rasterećenja (dan T slota). M17: uvod i nedelja
    // početnika bez kvaliteta — dan Q1 lagan (BUILD_NO_QUALITY proverava plafon).
    const testSlot = w.deload ? tSlot : 'q1';
    const roleOf = (r: 'q1' | 'q2'): DayRole =>
      w.test && r === testSlot
        ? 'test'
        : w.deload
          ? r === tSlot
            ? r
            : 'easy'
          : (w.phase === 'taper' && !has(r)) ||
              (r === 'q1' && noQ1(w)) ||
              (r === 'q2' && secondEasyWeek(w))
            ? 'easy'
            : r;
    const exp = [
      `${roleOf('q1')}@${pat.q1}`,
      ...(pat.q2 !== null ? [`${roleOf('q2')}@${pat.q2}`] : []),
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
      if (
        d.role === 'easy' &&
        w.phase !== 'race' &&
        !protectedDay(d) &&
        d.workout.km + EPS < P.lengths.easyMinKm
      )
        err(
          'EASY_MIN',
          `Lagan ${d.workout.km} km < ${P.lengths.easyMinKm} km (M13).`,
          w.index,
          d.date
        );
    }
    const planned = w.days.reduce((a, d) => a + (d.countsToWeek ? to100(d.workout.km) : 0), 0);
    if (planned !== to100(w.plannedKm)) err('ARITHMETIC', 'Planirano ≠ zbir dana.', w.index);
    // Pouka 30 (N1, kao HM-04 t. 4): trkačka nedelja čiji su svi dani trčanja pre trke odmor (A4) ima samo trku —
    // skraćena trkačka nedelja (RACE_WEEK_SHORT), ne prazna.
    if (raceOnlyWeek(w))
      warn(
        'RACE_WEEK_SHORT',
        'Trkačka nedelja ima samo trku: dani pre trke su odmor (bol, A4; pouka 30).',
        w.index
      );
    else if (
      allRestWeek(
        w,
        input.runDays.map((wd) => dateIn(w, wd))
      )
    )
      warn(
        'WEEK_ALL_REST',
        'Nedelja bez treninga: svi dani trčanja su dani odmora (bol, A4; kao pouka 30).',
        w.index
      );
    else if (w.days.filter((d) => d.countsToWeek).length === 0)
      err('EMPTY_WEEK', 'Nedelja bez treninga (Uslov 8).', w.index);
    // Pouka 37: mešovita nedelja (ne cela prošlost, ne trkačka) — planirano ≤ cilj; više samo kad ni najmanji
    // preostali dani ne staju u ostatak (ista funkcija kao konstruktor, mixed.ts) → upozorenje.
    const kept = w.days.filter(protectedDay);
    const rest = w.days.filter((d) => !protectedDay(d));
    if (
      !checked(w) &&
      ad !== undefined &&
      w.phase !== 'race' &&
      mustDay(w.endDate) > mustDay(ad.asOf) &&
      !pauseOwned(steps, w.index) &&
      keptKm100(kept, ad.factKm) + planned100(rest) >
        10 * to10(w.targetKm) + to100(P.tolerance.plannedKm)
    ) {
      const m = mixedRest(kept, rest, to10(w.targetKm), pw(w), ad.factKm);
      if (m.over && same(m.days, rest))
        warn(
          'MIXED_WEEK_OVER',
          `Planirano ${(keptKm100(kept, ad.factKm) + planned100(rest)) / 100} km > cilj ${w.targetKm} km: zaštićeni dani (urađeno/zaključano/prošlost) i najmanji preostali dani ne staju u cilj (pouka 37, 14); preporuka: preostale dane trčite lagano, a ako umor traje, preskočite lagan dan.`,
          w.index
        );
      else
        err(
          'MIXED_OVER_TARGET',
          `Planirano ${(keptKm100(kept, ad.factKm) + planned100(rest)) / 100} km > cilj ${w.targetKm} km u mešovitoj nedelji — preostali dani nisu na ostatku ${m.remainder100 / 100} km (pouka 37).`,
          w.index
        );
    }
    // Segment 04: mešovita nedelja — samo dani; nedelja sa danima bola/odmora (A4, pouka 25): planirano ≤ cilj
    // (manje = upozorenje).
    if (!checked(w)) continue;
    if (limitedDays(w) && w.plannedKm <= w.targetKm + P.tolerance.plannedKm + EPS) {
      if (w.plannedKm + P.tolerance.plannedKm + EPS < w.targetKm)
        warn(
          'PLANNED_BELOW_TARGET_LIMITS',
          `Planirano ${w.plannedKm} km < cilj obima ${w.targetKm} km (odmor/bol, A4).`,
          w.index
        );
    } else if (Math.abs(w.plannedKm - w.targetKm) > P.tolerance.plannedKm + EPS)
      err('PLANNED_VS_TARGET', `Planirano ${w.plannedKm} km ≠ cilj ${w.targetKm} km.`, w.index);
    // A9: donja granica adaptiranog cilja = minimum nedelje (M15).
    if (w.index >= firstAdapted && w.phase !== 'race' && to10(w.targetKm) < weekMin10(rule))
      err(
        'TARGET_FLOOR',
        `Cilj ${w.targetKm} km < minimum nedelje ${rule.weekMinKm} km (A9).`,
        w.index
      );
    // Minimum nedelje (M15) iz jedne funkcije (volume.weekMin10, pouka 24); planirano u 0,01 km.
    const load100 = to100(w.plannedKm) + (w.phase === 'race' ? to100(P.raceWeek.raceKm) : 0);
    const below = load100 < 10 * weekMin10(rule);
    // A4 (pouka 25): nedelja sa danima odmora/bola sme ispod minimuma (upozorenje); minimum važi za cilj
    // (TARGET_FLOOR).
    if (below && limitedDays(w))
      warn(
        'WEEK_MIN_LIMITS',
        `Nedelja ${w.plannedKm} km < ${rule.weekMinKm} km — dani odmora/bola (A4, pouka 25).`,
        w.index
      );
    else if (below)
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
    // Mešovita nedelja: zadržani dani (prošlost) i konstruisani dani nisu ista nedelja (samo provere dana).
    if (!checked(w)) continue;
    if (!long) {
      if (!restOf(w).has(dateIn(w, pat.long))) err('ROLES', 'Nedelja nema dugi trk.', w.index);
      continue;
    }
    // A4: dugi na danu bola ≤ 60 min; lagani na danima bola nisu jednaki (× 0,7).
    const pk = pw(w);
    const longMaxSec = painOf(w).has(long.date)
      ? Math.min(P.lengths.longMaxSec, P.adapt.painLongMaxSec)
      : P.lengths.longMaxSec;
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
    if (long.workout.km * pk.E.slow > longMaxSec + EPS)
      err(
        'LONG_DURATION',
        `Dugi ${long.workout.km} km > ${longMaxSec / 60} min sporim E (M13, A4).`,
        w.index,
        long.date
      );
    if (long.workout.segments.some((s) => s.zone !== 'E'))
      err('LONG_NOT_EASY', 'Dugi trk je samo lagan.', w.index, long.date);
    const easyKm = w.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km));
    if (easyKm.length > 1 && Math.max(...easyKm) - Math.min(...easyKm) > 1 && painOf(w).size === 0)
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
  // M13: najduži dugi < 26 km (početnik 24 km, M17). N11: kad ga ograničava trajanje (150 min, namerna granica M13)
  // — rečenica u opisu plana (konstruktor, ista funkcija lengths.longShortOf), ne upozorenje; inače upozorenje sa
  // savetom više dana/obima.
  const ls = longShortOf(weeks, rule.longShortKm, p);
  if (ls?.timeCapped) {
    if (!plan.notes.includes(longTimeCapNote(ls.longestKm, rule.longShortKm, beginner)))
      err('LONG_SHORT_NOTE', 'Najduži dugi ograničen trajanjem bez napomene plana (M13, N11).');
  } else if (ls)
    warn(
      'MARATHON_LONG_SHORT',
      `Najduži dugi trk u planu je ${String(ls.longestKm).replace('.', ',')} km; za maraton se preporučuje bar ${rule.longShortKm} km (${beginner ? 'M17' : 'M13'}). ` +
        (beginner ? 'Početnik: cilj je završiti maraton. ' : '') +
        `Ograničava ga udeo dugog (≤ ${Math.round(rule.longMaxShare * 100)} % nedelje sa ${input.runDays.length} dana): veći nedeljni obim${input.runDays.length < (beginner ? BEGINNER_DAYS_MAX : RUN_DAYS_MAX) ? ' (više dana trčanja nose veći obim)' : ''} daje duži dugi trk.`
    );
  // Pouka 14/32: kvalitetni dan duži od dugog po trajanju u nedelji izgradnje ili rasterećenja (upozorenje; posle
  // pouke 32 samo najniži nivo zone — iznad njega greška QUALITY_OVER_LONG).
  const longer = weeks.flatMap((w) => {
    const long = w.days.find((d) => d.role === 'long');
    if (!isBuildPhase(w.phase) || !long || !checked(w)) return [];
    const q = Math.max(
      0,
      ...w.days.filter((d) => d.workout.kind === 'quality').map((d) => d.workout.sec)
    );
    const jump = w.notes.some((n) => n.includes('plafon skoka'));
    return q > long.workout.sec ? [{ w: w.index, q, long: long.workout.sec, jump }] : [];
  });
  if (longer.length > 0) {
    const f = longer[0]!;
    warn(
      'LONG_SHORTER_THAN_QUALITY',
      `Kvalitetni dan duži od dugog po trajanju u ${longer.length} od ${weeks.filter((w) => isBuildPhase(w.phase)).length} nedelja izgradnje i rasterećenja (ned ${f.w}: ${Math.round(f.q / 60)} > ${Math.round(f.long / 60)} min; najniži nivo zone, pouka 32)${longer.some((x) => x.jump) ? '; dugi je ograničen skokom od skorašnjeg najdužeg (M13a)' : ''}${fewerDaysAdvice(input.runDays.length, input.currentWeeklyKm, rule)}.`,
      f.w
    );
  }

  // --- M11: jedan plafon po zoni, po treningu (trkačka nedelja: M8).
  for (const w of weeks) {
    if (w.phase === 'race' || !checked(w)) continue;
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
  // M14 pojas trenutnog obima; početnik uvek 15/10 (M17) — ista funkcija kao konstruktor (workouts.warmupCooldown,
  // pouka 24).
  const wc = warmupCooldown(input.currentWeeklyKm, rule);
  for (const w of weeks)
    for (const d of w.days) {
      // MAR-07b: zaštićen dan nosi tempo i strukturu iz kojih je upisan — ne sudi se po tempu nedelje.
      if (protectedDay(d)) continue;
      // Segment 04: tempo i osnova tempa nedelje (A1).
      const pk = pw(w);
      const mid = midEasy(pk);
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
      // A4/A9: jedini kvalitet doze rasterećenja sme na drugi dan kvaliteta kad je dan slota u zabrani.
      const swapOk = (slot: DayRole): boolean =>
        reducedQ(w) &&
        (d.role === 'q1' || d.role === 'q2') &&
        (w.limits?.noQuality ?? []).includes(dateIn(w, slot === 'q1' ? pat.q1 : pat.q2!));
      if (!checked(w)) {
        // Mešovita nedelja: samo provere dana (ispod).
      } else if (w.phase === 'race') {
        if (d.role !== 'sharpener' || wo.qualityType !== 'MP_sharpener')
          err('PHASE_QUALITY', 'Trkačka nedelja ima samo oštrenje (M8).', w.index, d.date);
      } else if (w.deload || (reducedQ(w) && isBuildPhase(w.phase))) {
        // Rasterećenje (M5) i nedelja izgradnje sa jednim kvalitetom doze rasterećenja (A4/A9; doza: ONE_QUALITY).
        const lad = deloadLadder(w.phase);
        if ((d.role !== tSlot && !swapOk(tSlot)) || dose.ladder !== lad)
          err(
            'PHASE_QUALITY',
            `Rasterećenje: jedini kvalitet je T (${lad}) na danu ${tSlot.toUpperCase()} (M5).`,
            w.index,
            d.date
          );
      } else if (w.phase === 'taper' && reducedQ(w) && swapOk('q1')) {
        // A4/A9: taper samo glavni kvalitet na drugom danu kvaliteta (dan Q1 u zabrani); doza: TAPER_QUALITY.
      } else if (beginner && isSteady(w)) {
        // M17: lestvica faze (M15 jedan kvalitet); kad njen prvi nivo ne staje u plafon — T kontinuirano
        // (lestvica početnika od 1,5 km). Plafon računat ovde iz politike.
        const phaseLadder: LadderId =
          w.phase === 'base' ? 'T_continuous' : w.phase === 'development' ? 'T_cruise' : 'MP';
        const first = doseOf(P.ladders[phaseLadder][0]!);
        const zone: WorkZone = phaseLadder === 'MP' ? 'MP' : 'T';
        const fits = first <= Math.floor(P.caps[zone] * w.targetKm * 1000 + 1e-6);
        const wantLadder = fits ? phaseLadder : 'T_continuous';
        const tTypes: readonly QualityType[] = ['T_continuous', 'T_cruise'];
        const okType =
          wantLadder === 'MP' ? wo.qualityType === 'MP' : tTypes.includes(wo.qualityType!);
        if (d.role !== 'q1' || dose.ladder !== wantLadder || !okType)
          err(
            'PHASE_QUALITY',
            `Početnik: ${wo.qualityType} (${dose.ladder}) ≠ ${wantLadder} u fazi ${w.phase} (M17).`,
            w.index,
            d.date
          );
        else if (!fits && !w.notes.some((n) => n.startsWith('T kontinuirano (M17)')))
          err('PHASE_QUALITY', 'T kontinuirano početnika bez napomene (M17).', w.index, d.date);
      } else {
        const role = d.role === 'q1' || d.role === 'q2' ? d.role : null;
        const types = rule.quality === 1 ? SLOT_TYPES_ONE : SLOT_TYPES;
        // M17: početnik u N−1 — T kontinuirano umesto MP (TAPER_QUALITY proverava dozu).
        const begTaperT =
          beginner && taperStep(phases, w.index) === 1 && wo.qualityType === 'T_continuous';
        if (
          !role ||
          !wo.qualityType ||
          (!types[w.phase][role].includes(wo.qualityType) && !begTaperT)
        )
          err(
            'PHASE_QUALITY',
            `${wo.qualityType} ne pripada fazi ${w.phase} (${d.role}) (M10).`,
            w.index,
            d.date
          );
      }
      // M16: RPE samo u planu po osećaju, po zoni iz politike.
      const r = P.feel.rpe[dose.zone];
      const feelD = feelW(w);
      if (
        feelD
          ? !wo.rpe || wo.rpe.min !== r.min || wo.rpe.max !== r.max || wo.rpe.cue !== r.cue
          : wo.rpe !== undefined
      )
        err(
          'RPE',
          feelD ? `Kvalitet bez RPE ${dose.zone} (M16).` : 'RPE u nedelji sa rezultatom (A1).',
          w.index,
          d.date
        );
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
                    (s.repM < a.iRepMinM || s.repM > a.iRepMaxM || s.reps > a.iRepsMax)) ||
                  (s.form === 'pyramid' &&
                    (s.repsM.length > a.iRepsMax ||
                      s.repsM.some((m) => m < a.iRepMinM || m > a.iRepMaxM)))
                : s.form !== 'reps' || !a.rRepM.includes(s.repM);
      if (bad) err('REP_MIN', `${dose.zone}: struktura van pravila M10.`, w.index, d.date);
      const reps = seg.filter((x) => x.kind === 'rep');
      const recs = seg.filter((x) => x.kind === 'recovery');
      if (s.form !== 'continuous') {
        const okRec = recs.every((x, i) => {
          const rec = recoveryOf(dose.ladder, repM[i]!, pk);
          return 'm' in rec ? to100(x.km) === Math.round(rec.m / 10) : x.sec === rec.sec;
        });
        const okReps = reps.every((x, i) => to100(x.km) === Math.round(repM[i]! / 10));
        if (reps.length !== repM.length || recs.length !== repM.length - 1 || !okRec || !okReps)
          err('RECOVERY', `Oporavak deonica ne odgovara M14 (${dose.ladder}).`, w.index, d.date);
      } else if (recs.length > 0 || reps.length > 0)
        err('RECOVERY', 'Kontinuiran blok nema deonice ni oporavak.', w.index, d.date);
    }

  // --- Pouka 32: plafon zone = M11 i drugi član (trajanje dana ≤ dugi iste nedelje) — isti predikat kao
  // konstruktor (week.ts *DayLimit, quality.fitsDay / pickDeload / taperDoses).
  const dlcOf = (w: PlanWeek): DayLimitContext =>
    dayLimitContext(pw(w), wc, rule, w.limits, () => dateIn(w, pat.long));
  /** M13a: plafon skoka nedelje iz upisanih dugih (isto kao konstruktor, lengths.longsOf). */
  const jumpOf = (w: PlanWeek): number | null =>
    longJumpCap10(longsOf(weeks.slice(0, w.index - 1)), w.index, recentJ);
  const fitsMemo = new Map<string, DayFits>();
  const slotFits = (b: PlanWeek, role: 'q1' | 'q2'): DayFits => {
    const key = `${b.index}${role}`;
    const got = fitsMemo.get(key);
    if (got) return got;
    const l = buildDayLimit(
      dlcOf(b),
      to10(b.targetKm),
      pat.easy.length,
      jumpOf(b),
      rule.quality === 2 ? ladderFor(b.phase, 'q2') : null,
      b.days.find((d) => d.workout.kind === 'test')?.workout ?? null
    );
    const f = role === 'q1' ? l.q1 : l.q2(slotDose(b, 'q1'));
    fitsMemo.set(key, f);
    return f;
  };
  const slotOk = (b: PlanWeek, role: 'q1' | 'q2', ladder: LadderId, s: Structure): boolean =>
    doseOf(s) <= capM(zoneOf(ladder), b.targetKm) &&
    fitsDay(ladder, s, role === 'q1' && beginner, slotFits(b, role));
  // Greška: dan kvaliteta iznad najniže doze zone duži od dugog iste nedelje (izgradnja: prvi nivo lestvice,
  // početnik M17; rasterećenje, jedan kvalitet doze rasterećenja i taper: najmanja doza — T 2,0 km / početnik
  // 1,5 km, MP 2 × 3000 m, M7a). Najniži nivo: upozorenje LONG_SHORTER_THAN_QUALITY.
  const tFloorM = deloadMinM(beginner);
  const lowestOf = (d: Dose): boolean =>
    d.step === 'deload' || d.step === 'taper'
      ? d.doseM <= (d.zone === 'MP' ? doseOf(P.taper.mpMin) : tFloorM)
      : lowestBuild(d, beginner);
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.phase === 'race' || !long || !checked(w)) continue;
    for (const d of w.days) {
      const dz = d.workout.dose;
      if (d.workout.kind !== 'quality' || !dz || lowestOf(dz) || protectedDay(d)) continue;
      const sec = qualityDaySec(dz, pw(w), wc);
      if (sec > long.workout.sec)
        err(
          'QUALITY_OVER_LONG',
          `${dz.zone} ${dz.doseM} m: dan ${Math.round(sec / 60)} min > dugi ${Math.round(long.workout.sec / 60)} min (pouka 32, plafon zone).`,
          w.index,
          d.date
        );
    }
  }
  // --- Pouka 35: nedelja izgradnje sa dva dana kvaliteta u kojoj bi neki dan trajao duže od dugog, a nedelja sa
  // jednim kvalitetom je izvodljiva — drugi dan kvaliteta mora biti lagan (ista funkcija kao konstruktor,
  // week.secondQualityEasy). Nedelja sa lakim drugim danom nosi napomenu i nema Q2 (ROLES).
  for (const w of weeks) {
    if (!isSteady(w) || !checked(w) || reducedQ(w) || rule.quality !== 2) continue;
    const q1 = w.days.find((d) => d.role === 'q1' && d.workout.kind === 'quality');
    const q2 = w.days.find((d) => d.role === 'q2' && d.workout.kind === 'quality');
    if (secondEasyWeek(w) && (!q1 || q2 || w.test))
      err('QUALITY_DAYS', 'Napomena pouke 35 bez nedelje sa jednim kvalitetom (Q1).', w.index);
    if (
      q1 &&
      q2 &&
      secondQualityEasy(
        to10(w.targetKm),
        rule,
        pw(w),
        jumpOf(w),
        pat.easy.length,
        q1.workout,
        q2.workout
      )
    )
      err(
        'QUALITY_DAYS',
        'Dan kvaliteta duži od dugog uz dva kvaliteta, a nedelja sa jednim je izvodljiva — drugi dan kvaliteta je lagan (pouka 35).',
        w.index
      );
  }

  // Segment 04: lanac ne-rasteretnih nedelja izgradnje; nedelja sa ograničenjem kvaliteta (A4/A9) ne menja stanje
  // doze i preskače se; nov start (A3) počinje progresiju iznova ('restart'). N8 (pouka 29, kao HM-04 t. 2):
  // mešovita nedelja se ne proverava, a stanje doze daje iz upisanih dana ({ state }) — isto kao konstruktor
  // (generate.writtenPicks); poređenja sa njom (glavna doza, isti kvalitet, plato baze) se preskaču.
  const chain: (PlanWeek | 'restart' | { state: PlanWeek })[] = [];
  for (const w of weeks) {
    if (doseRestarts.has(w.index)) chain.push('restart');
    if (!isSteady(w) || reducedQ(w)) continue;
    chain.push(checked(w) ? w : { state: w });
  }
  let lastOf: Record<'q1' | 'q2', Dose | null> = { q1: null, q2: null };
  let prevMain: PlanWeek | null = null;
  let prevW: PlanWeek | null = null;
  /** Poslednja nedelja lanca sa dozom T slota (i nedelja testa M16: test zamenjuje samo Q1) — baza bez platoa. */
  let prevT: PlanWeek | null = null;
  for (const c of chain) {
    if (typeof c === 'string') {
      [lastOf, prevMain, prevW, prevT] = [{ q1: null, q2: null }, null, null, null];
      continue;
    }
    if ('state' in c) {
      for (const role of ['q1', 'q2'] as const)
        lastOf[role] = slotDose(c.state, role) ?? lastOf[role];
      [prevMain, prevW, prevT] = [null, null, null];
      continue;
    }
    const b = c;
    for (const role of ['q1', 'q2'] as const) {
      const da = lastOf[role];
      const db = slotDose(b, role);
      if (db) lastOf[role] = db;
      if (!da || !db) continue;
      if (db.step === 'drop') {
        // M11 ispred M12 (i pouka 32, plafon zone): samo kad nijedna struktura prethodne doze ne staje u plafon
        // slota, na najviši nivo koji staje, uz napomenu.
        const lad = db.ladder as LadderId;
        const best = ladderLevels(lad, beginner)
          .filter((s) => slotOk(b, role, lad, s))
          .map(doseOf)
          .pop();
        const prevFits = structuresForDose(lad, da.doseM).some((s) => slotOk(b, role, lad, s));
        if (prevFits || db.doseM !== best || !b.notes.some((n) => n.includes('spušten sa')))
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
        const nl = nextLevel(ladder, da.doseM, beginner);
        if (db.doseM < da.doseM)
          err('DOSE_DECREASE', `${role}: doza ${db.doseM} m < ${da.doseM} m (M12).`, b.index);
        else if (db.doseM > da.doseM && (!nl || db.doseM !== doseOf(nl)))
          err(
            'DOSE_JUMP',
            `${role}: više od jednog nivoa (${da.doseM} → ${db.doseM} m) (M12).`,
            b.index
          );
        else if (db.doseM === da.doseM) {
          if (nl && slotOk(b, role, ladder, nl))
            err(
              'DOSE_STALL',
              `${role}: sledeći nivo ${doseOf(nl)} m staje u plafon, a nije uzet (M12).`,
              b.index
            );
          const others = structuresForDose(ladder, da.doseM).some(
            (x) => !sameStructure(x, da.structure) && slotOk(b, role, ladder, x)
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
    // Baza bez platoa (pouka 3): T slot raste ili, kad sledeći nivo ne staje u plafon zone (pouka 32), menja
    // strukturu — prema poslednjoj nedelji sa T slotom, i preko nedelje testa (N2, MAR-04b: test M16 zamenjuje samo
    // Q1, T slot nedelje testa napreduje kao i u konstruktoru). A2/A3/A8: adaptirana nedelja sa manjim ciljem i
    // spuštena doza se ne porede.
    const tb = slotDose(b, tSlot);
    const ta = prevT ? slotDose(prevT, tSlot) : null;
    if (prevT && ta && tb && prevT.phase === 'base' && b.phase === 'base') {
      const lower = b.index >= firstAdapted && to10(b.targetKm) < to10(prevT.targetKm);
      const anyDrop = (['q1', 'q2'] as const).some((r) => slotDose(b, r)?.step === 'drop');
      const tl = ta.ladder as LadderId;
      const nl = nextLevel(tl, ta.doseM, beginner);
      const blocked = !nl || !slotOk(b, tSlot, tl, nl);
      // Doza bez druge strukture koja staje u plafon zone (T 1,5 km početnika, M17; pouka 32) sme da se ponovi
      // kad sledeći nivo ne staje.
      const single = !structuresForDose(tl, ta.doseM).some(
        (x) => !sameStructure(x, ta.structure) && slotOk(b, tSlot, tl, x)
      );
      const changed = !sameStructure(ta.structure, tb.structure) || single;
      if (!lower && !anyDrop && !(tb.doseM > ta.doseM || (blocked && changed)))
        err(
          'BASE_PLATEAU',
          `Baza: T doza ${tb.doseM} m bez rasta ili druge strukture (M12).`,
          b.index
        );
    }
    if (tb) prevT = b;
    // M16/M17: nedelja testa i uvod (bez kvaliteta) se ne porede (test nije doza).
    if (b.test || !hasQualityWork(b)) continue;
    // A2/A3/A8: u adaptiranoj nedelji sa manjim ciljem od nedelje poređenja doza sme da padne sa obimom (plafon
    // M11 ispred M12).
    const reducedVolume =
      b.index >= firstAdapted && prevMain !== null && to10(b.targetKm) < to10(prevMain.targetKm);
    // Pouka 35: nedelja sa lakim drugim danom kvaliteta ima manju glavnu dozu po odluci (ne pad progresije).
    const dropped =
      (['q1', 'q2'] as const).some((r) => slotDose(b, r)?.step === 'drop') ||
      reducedVolume ||
      secondEasyWeek(b);
    if (prevMain && mainDoseM(b) < mainDoseM(prevMain) && !dropped)
      err(
        'MAIN_DOSE_DECREASE',
        `Glavna doza ${mainDoseM(b)} m < ${mainDoseM(prevMain)} m (M12).`,
        b.index
      );
    prevMain = b;
    if (prevW && qualityKey(prevW) === qualityKey(b)) {
      // Pouka 32 (odluka organizatora MAR-04b): ponavljanje doze je upozorenje uz napomenu samo kad za svaki slot
      // važi: (2') nijedna druga struktura iste doze ne staje u plafon zone i (3) sledeći nivo ne staje u plafon
      // zone (oba člana, ista funkcija). Svako drugo identično ponavljanje je greška.
      const qs = (['q1', 'q2'] as const).filter((r) => slotDose(b, r));
      const forced =
        qs.length > 0 &&
        b.notes.some((n) => n.includes('ponovljen')) &&
        qs.every((r) => {
          const d = slotDose(b, r)!;
          const lad = d.ladder as LadderId;
          const nl = nextLevel(lad, d.doseM, r === 'q1' && beginner);
          return (
            !structuresForDose(lad, d.doseM).some(
              (x) => !sameStructure(x, d.structure) && slotOk(b, r, lad, x)
            ) &&
            (!nl || !slotOk(b, r, lad, nl))
          );
        });
      if (forced)
        warn(
          'IDENTICAL_WEEKS',
          `Isti kvalitet kao nedelja ${prevW.index}: druga struktura iste doze i sledeći nivo ne staju u plafon zone (pouka 32, M10).`,
          b.index
        );
      else err('IDENTICAL_WEEKS', `Isti kvalitet kao nedelja ${prevW.index} (M12).`, b.index);
    }
    prevW = b;
  }

  // --- M12: početni nivo (prva nedelja slota; I i MP na prvoj nedelji faze; MP ≥ poslednje I).
  // Početnik (M17): prvi nivo lestvice početnika (60 % plafona ne važi).
  const startM = (ladder: LadderId, targetKm: number): number => {
    const cap = capM(zoneOf(ladder), targetKm);
    const lv = ladderLevels(ladder, beginner).map(doseOf);
    if (beginner) return lv[0]!;
    return lv.filter((m) => m <= P.startLevel.capShare * cap + EPS).pop() ?? lv[0]!;
  };
  let lastWeek: Record<'q1' | 'q2', PlanWeek | null> = { q1: null, q2: null };
  for (const c of chain) {
    if (c === 'restart') lastWeek = { q1: null, q2: null };
    if (typeof c === 'string') continue;
    // N8: mešovita nedelja — stanje slota iz upisanih dana.
    if ('state' in c) {
      for (const role of ['q1', 'q2'] as const)
        if (slotDose(c.state, role)) lastWeek[role] = c.state;
      continue;
    }
    const b = c;
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
      // Pouka 32: početni nivo koji ne staje u plafon zone (trajanje dugog) → najviši nivo ispod njega koji staje.
      const startS = ladderLevels(ladder, beginner).find((s) => doseOf(s) === wantM);
      if (startS && !slotOk(b, role, ladder, startS))
        wantM =
          ladderLevels(ladder, beginner)
            .filter((s) => doseOf(s) <= wantM && slotOk(b, role, ladder, s))
            .map(doseOf)
            .pop() ?? wantM;
      if (da && carry) {
        const lv = ladderLevels(ladder)
          .map(doseOf)
          .find((m) => m >= Math.max(wantM, da.doseM));
        const lvS = ladderLevels(ladder).find((s) => doseOf(s) === lv);
        if (lv === undefined || !lvS || !slotOk(b, role, ladder, lvS)) continue;
        wantM = lv;
      }
      if (db.doseM !== wantM)
        err(
          'START_LEVEL',
          `${role}: početni nivo ${ladder} ${db.doseM} m ≠ ${wantM} m (≤ 60 % plafona, M12).`,
          b.index
        );
    }
  }

  // --- M13a (pouka 28): dugi svake nedelje ≤ max(1,1 × L; L + 1,0), L = najduži dugi prethodne 4 nedelje
  // (skorašnji najduži = nedelja 0); bez ulaza napomena nedelje 1 sa pragom.
  const recent = input.recentLongRunKm ?? null;
  // Pouka 29: dugi prethodnih nedelja iz plana kakav se upisuje (isto kao konstruktor, lengths.longsOf); zaključan
  // dan (A11) se ne proverava.
  const longs10 = longsOf(weeks);
  weeks.forEach((w, i) => {
    const l10 = longs10[i];
    if (l10 === null || l10 === undefined) return;
    const longDay = w.days.find((d) => d.role === 'long')!;
    if (lockedIds.has(longDay.date)) return;
    const jump = longJumpCap10(longs10.slice(0, i), w.index, recentJ);
    if (jump !== null && l10 > jump)
      err(
        'LONG_JUMP',
        `Dugi ${l10 / 10} km > max(1,1 × L; L + 1,0) = ${jump / 10} km (M13a).`,
        w.index
      );
    const bound =
      jump !== null &&
      l10 === jump &&
      isSteady(w) &&
      checked(w) &&
      !painOf(w).has(longDay.date) &&
      jump < longCap10(to10(w.targetKm), rule, pw(w));
    const note =
      jump !== null &&
      w.notes.includes(longJumpNote(l10, jumpBase10(longs10.slice(0, i), w.index, recentJ)!));
    if (bound && !note) err('LONG_JUMP', 'Dugi na plafonu skoka bez napomene (M13a).', w.index);
  });
  const w1 = weeks[0]!;
  const long1 = w1.days.find((d) => d.role === 'long');
  const jump1 = longJumpCap10([], 1, recent);
  if (
    long1 &&
    recent === null &&
    checked(w1) &&
    !w1.notes.includes(recentLongNote(Math.max(to10(long1.workout.km), pre ? to10(pre.longKm) : 0)))
  )
    err('RECENT_LONG', 'Ned 1 bez napomene praga skorašnjeg najdužeg trka (M13a).', 1);

  // --- M6: obim. Ned 1 = trenutni obim (ispod samo uz dugi na 150 min, pouka 9); izgradnja po pravilu ili
  // najbliži izvodljiv cilj (napomena); rasterećenje 0,8 ×, taper 0,8 / 0,6 × vrh samo naniže; vrh.
  const start10 = startKm10(input.currentWeeklyKm);
  const cap10 = peakCap10(start10, rule);
  // Segment 04: isti rekurent kao konstruktor (volume.adaptNominal10: cilj koraka, povratni rast, vrh od novog
  // starta, taper 0,8 / 0,6 × najveći cilj izgradnje posle poslednjeg smanjenja, donja granica); izvodljiv cilj
  // adaptacije samo naniže. Posle mešovite nedelje čiji cilj nije po pravilu provera čeka sledeći cilj koraka.
  const av = steps.length > 0 ? adaptVolume(steps) : null;
  let h = initialAdaptHistory(cap10);
  let known = true;
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    const t10 = to10(w.targetKm);
    const step = taperStep(phases, w.index);
    if (av) {
      h = enterWeek(h, w, av, rule);
      if (av.reset.has(w.index) && isBuildPhase(w.phase)) known = true;
    }
    // Cilj po pravilu iz iste funkcije kao konstruktor (volume.nominal10 / adaptNominal10, pouka 24).
    const { nominal, downOnly } = av
      ? adaptNominal10(w, h, start10, step, rule, av)
      : { nominal: nominal10(w, h, start10, cap10, step, rule), downOnly: false };
    if (checked(w) && known) {
      if (to10(w.nominalKm) !== nominal)
        err(
          'VOLUME_RULE',
          `Cilj po pravilu ${w.nominalKm} km ≠ ${nominal / 10} km (M5, M6, M7, A8).`,
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
      if ((w.deload || step !== null || w.index === 1 || downOnly) && t10 > nominal)
        err(
          'VOLUME_FIT',
          `Cilj ${w.targetKm} km > ${nominal / 10} km (smanjenje ne raste, M5/M7; ned 1 = obim, M6; adaptacija samo naniže, A8).`,
          w.index
        );
    }
    // A3/A8: granica izgradnje od novog starta; povratak sme do nivoa pre smanjenja.
    const capW = av ? h.cap10 : cap10;
    const levelW = av ? av.levelAt(w.index) : null;
    if (checked(w) && isSteady(w) && t10 > capW && !(levelW !== null && t10 <= levelW))
      err(
        'VOLUME_PEAK',
        `Cilj ${w.targetKm} km > granica izgradnje ${capW / 10} km (M6; nov start: A3).`,
        w.index
      );
    if (w.index === 1 && t10 < start10 && checked(w) && w.index < firstAdapted) {
      const long = w.days.find((d) => d.role === 'long');
      const l10 = long ? to10(long.workout.km) : null;
      if (l10 === null || (l10 !== longTimeCap10(pw(w)) && l10 !== jump1))
        err(
          'VOLUME_START',
          `Ned 1 ${w.targetKm} km < trenutni obim bez dugog na ${P.lengths.longMaxSec / 60} min ili na pragu skorašnjeg najdužeg (M6, pouke 9 i 28).`,
          1
        );
    }
    if (av) h = leaveWeek(h, w, t10, av);
    else if (isSteady(w)) {
      h.lastBuild10 = t10;
      h.peak10 = Math.max(h.peak10, t10);
    }
    if (!checked(w) && to10(w.nominalKm) !== nominal) known = false;
  }
  const peak10 = h.peak10;
  if (
    to10(plan.peakKm) !== peak10 ||
    to10(plan.peakCapKm) !== cap10 ||
    to10(plan.startKm) !== start10
  )
    err('VOLUME_PEAK', 'Vrh, granica izgradnje ili start ≠ M6.');
  const limited = capacityWeeks(weeks, rule, p, recentJ).length > 0;
  if (limited) {
    const msg = capacityMessage(
      input.runDays.length,
      rule,
      capacityLimits(weeks, rule, p, recentJ)
    );
    // N11: jednom po planu — upozorenje nosi isti tekst kao napomena plana (prikaz bez ponavljanja).
    const note = plan.notes.find((n) => n.startsWith(msg));
    if (!note) err('CAPACITY_NOTE', 'Spuštena nedelja izgradnje bez napomene kapaciteta (M6).');
    warn('CAPACITY_LIMITED', note ?? msg);
  }

  // --- M5 sadržaj rasterećenja, M7 taper (doze iz poslednje ne-rasteretne nedelje izgradnje). Segment 04: stanje
  // doze menjaju samo nedelje izgradnje bez ograničenja kvaliteta (A4/A9); nov start ga briše (A3); posle mešovite
  // nedelje doza rasterećenja/tapera se ne proverava dok je nova nedelja ne odredi (poslednja T doza i dugi iz
  // upisanih dana, pouka 29). Ograničenje 'none' → bez kvaliteta; 'one' → jedan kvalitet (rasterećenje: T doza
  // M5, i na drugom danu kvaliteta kad je dan slota u zabrani; taper: samo glavni kvalitet).
  let last: Record<'q1' | 'q2', Dose | null> = { q1: null, q2: null };
  /** M5: poslednja doza u zoni T iz ne-rasteretne nedelje izgradnje (pouka 34: posle umora pre starta iz
      reference, kao i poslednji dugi). */
  const ref = stateRefOf(steps);
  let lastT = ref ? ref.tM : 0;
  let lastLong10: number | null = ref ? to10(ref.longKm) : null;
  let seenSteady = pre !== null;
  const otherSlot = (r: 'q1' | 'q2'): 'q1' | 'q2' => (r === 'q1' ? 'q2' : 'q1');
  /** N11: rasterećenja sa skraćenim dugim — jedno upozorenje po planu. */
  const shortened: { w: number; why: string }[] = [];
  for (const w of weeks) {
    if (doseRestarts.has(w.index)) [last, lastT] = [{ q1: null, q2: null }, 0];
    const long = w.days.find((d) => d.role === 'long');
    const nQuality = w.days.filter((d) => d.workout.kind === 'quality').length;
    const nTest = w.days.filter((d) => d.workout.kind === 'test').length;
    const pk = pw(w);
    const rest = restOf(w);
    // M17: najmanja T doza rasterećenja početnika 1,5 km (quality.deloadMinM, pouka 24).
    const minM = deloadMinM(beginner);
    // Doza rasterećenja ≈ 60 % poslednje T doze (M5) i drugi član plafona zone (pouka 32) — ista funkcija kao
    // konstruktor (quality.pickDeload + week.deloadDayLimit / oneDayLimit); doza po pravilu van plafona M11 → bez
    // drugog člana (taj kvalitet konstruktor ne sastavlja).
    const dLad = deloadLadder(w.phase);
    const wantT0 = doseOf(
      reduced(dLad, lastT, P.deload.tShare, floorOf(dLad, minM, beginner), beginner)
    );
    const stT: QualityState = { q1: null, q2: null, t: lastT };
    const nEasy1 = (pat.q2 ? 2 : 1) + pat.easy.length - 1;
    const wantWith = (fits: DayFits): number =>
      pickDeload(stT, w.phase, w.targetKm, beginner, fits)?.doseM ?? wantT0;
    const wantT = !w.deload
      ? wantT0
      : wantWith(
          deloadDayLimit(
            dlcOf(w),
            to10(w.targetKm),
            nEasy1,
            lastLong10 ?? 0,
            jumpOf(w),
            w.test === true || beginner || w.index >= reducedFrom,
            w.index >= reducedFrom
          )
        );
    if (w.deload && checked(w) && seenSteady) {
      const t =
        slotDose(w, tSlot) ??
        (reducedQ(w) && rule.quality === 2 ? slotDose(w, otherSlot(tSlot)) : null);
      if (noneQ(w) || introDeload(w)) {
        if (nQuality !== 0 || nTest !== 0)
          err('DELOAD_CONTENT', 'Rasterećenje bez kvaliteta (adaptacija, A3/A4/A5/A9).', w.index);
      } else if (w.test) {
        // M16: u nedelji testa test zamenjuje kvalitet rasterećenja (TEST proverava dan).
        if (nQuality !== 0)
          err('DELOAD_CONTENT', 'Rasterećenje sa testom: bez kvaliteta (M16).', w.index);
      } else if (nQuality !== 1 || !t || t.zone !== 'T' || t.doseM !== wantT)
        err(
          'DELOAD_CONTENT',
          `Rasterećenje: 1 kvalitet T ${wantT} m (≈ 60 % od ${lastT} m, min ${minM / 1000} km) (M5, M17).`,
          w.index
        );
      if (long && lastLong10 !== null && !limitedDays(w)) {
        // Dužine rasterećenja iz JEDINE funkcije (lengths.deloadLengths, pouka 24): 0,8 × poslednji dugi (M5),
        // skraćen samo u nedelji testa (M16), kod početnika (M17) i posle smanjenja obima (A9, pouka 33) kad
        // lagani ne bi bili ≥ 5 km (odstupanje).
        const q100 = w.days
          .filter((d) => d.workout.kind === 'quality' || d.workout.kind === 'test')
          .reduce((a, d) => a + to100(d.workout.km), 0);
        const len = deloadLengths(
          to10(w.targetKm),
          q100,
          w.days.filter((d) => d.role === 'easy').length,
          lastLong10,
          rule,
          pk,
          longJumpCap10(longsOf(weeks.slice(0, w.index - 1)), w.index, recentJ),
          w.test === true || beginner || w.index >= reducedFrom,
          w.index >= reducedFrom
        );
        const note = w.notes.some((n) => n.includes('skraćen sa 0,8 ×'));
        if (!len || to10(long.workout.km) !== len.long10 || note !== (len.shortened === true))
          err(
            'DELOAD_LONG',
            `Dugi rasterećenja ${long.workout.km} km ≠ ${len ? len.long10 / 10 : '—'} km (M5; skraćen samo M16/M17/A9, uz napomenu).`,
            w.index
          );
        if (len?.shortened)
          shortened.push({ w: w.index, why: w.test ? 'M16' : beginner ? 'M17' : 'A9, pouka 33' });
      }
      if (
        w.days.filter((d) => d.role === 'easy').length !==
        input.runDays.length - rest.size - (long ? 1 : 0) - nQuality - nTest
      )
        err('DELOAD_CONTENT', 'Rasterećenje: ostali dani su lagani (M5).', w.index);
    }
    const step = taperStep(phases, w.index);
    if (step !== null && checked(w) && seenSteady) {
      const tw = P.taper.weeks[step]!;
      let mp = slotDose(w, 'q1');
      let t = slotDose(w, 'q2');
      // A4/A9: jedini kvalitet tapera na drugom danu kvaliteta kad je dan Q1 u zabrani.
      if (reducedQ(w) && !mp && t) [mp, t] = [t, null];
      // Doza tapera iz JEDINE funkcije (quality.taperDoses, pouka 24) nad poslednjim dozama izgradnje; M11 na dozama
      // po pravilu (want0), drugi član plafona zone (pouka 32, week.taperWeekLimit) spušta izabrane doze.
      const stTaper: QualityState = { q1: slotOf(last.q1), q2: slotOf(last.q2), t: lastT };
      const want0 = taperDoses(stTaper, step, rule.quality, beginner);
      const want = taperDoses(
        stTaper,
        step,
        rule.quality,
        beginner,
        taperWeekLimit(
          dlcOf(w),
          stTaper,
          step,
          to10(w.targetKm),
          input.runDays.length,
          longestLong10(weeks.slice(0, w.index - 1)),
          jumpOf(w),
          w.index >= reducedFrom,
          reducedQ(w)
        )
      );
      const wantMp = want.mp ? doseOf(want.mp) : 0;
      const wantT = want.t === null ? null : doseOf(want.t);
      if (noneQ(w)) {
        if (mp || t) err('TAPER_QUALITY', 'Taper bez kvaliteta (adaptacija, A3/A4/A9).', w.index);
      } else if (reducedQ(w)) {
        // A4/A9: samo glavni kvalitet — MP po M7 (M7a); početnik N−1: T kontinuirano.
        const okOne = want.mp
          ? !!mp && mp.zone === 'MP' && mp.doseM === wantMp && !t
          : !!mp && mp.zone === 'T' && mp.doseM === wantT && !t;
        if (!okOne)
          err(
            'TAPER_QUALITY',
            `Taper N−${2 - step} (adaptacija): samo ${want.mp ? `MP ${wantMp}` : `T ${wantT}`} m (M7, A9).`,
            w.index
          );
      } else {
        if (!want.mp) {
          // M17: početnik u N−1 — jedini kvalitet T kontinuirano na danu Q1, bez MP (staje u plafon T).
          const wantT1 = doseOf(want.t!);
          if (
            !mp ||
            mp.zone !== 'T' ||
            mp.ladder !== want.tLadder ||
            mp.doseM !== wantT1 ||
            doseOf(want0.t!) > capM('T', w.targetKm) ||
            t
          )
            err(
              'TAPER_QUALITY',
              `Taper N−1 početnika: T kont. ${wantT1} m, bez MP (M17).`,
              w.index
            );
        }
        const tFits = want0.t !== null && doseOf(want0.t) <= capM('T', w.targetKm);
        const okMp = !!mp && mp.zone === 'MP' && mp.doseM === wantMp;
        const okT = tFits ? !!t && t.zone === 'T' && t.doseM === wantT : !t;
        if (want.mp && (!okMp || !okT))
          err(
            'TAPER_QUALITY',
            `Taper N−${2 - step}: MP ${wantMp} m${wantT === null ? ', bez T' : `, T ${tFits ? `${wantT} m` : 'otpada (plafon)'}`} (M7, M7a, M11).`,
            w.index
          );
        else if (want.mp && wantT !== null && !tFits) {
          if (!w.notes.some((n) => n.includes('M11 ispred M7')))
            err('TAPER_QUALITY', 'T tapera otpao bez napomene (M11 ispred M7).', w.index);
          warn(
            'TAPER_ZONE_DROPPED',
            `Taper N−${2 - step}: T ${doseOf(want0.t!)} m > plafon ${capM('T', w.targetKm)} m — T otpada (M11 ispred M7).`,
            w.index
          );
        }
      }
      if (mp && mp.zone === 'MP' && mp.doseM === wantMp && wantMp > capM('MP', w.targetKm)) {
        if (!w.notes.some((n) => n.includes('(M7a)')))
          err('TAPER_QUALITY', 'MP tapera iznad plafona bez napomene (M7a).', w.index);
        warn(
          'TAPER_MP_OVER_CAP',
          `Taper N−${2 - step}: MP ${wantMp} m > 20 % cilja ${w.targetKm} km — minimum tapera ispred plafona (M7a).`,
          w.index
        );
      }
      // M7: najduži dugi nedelja pre tapera — ista definicija kao konstruktor (lengths.longestLong10, pouka 29).
      const longest10 = longestLong10(weeks.slice(0, w.index - 1));
      // A9 (odstupanje, posle smanjenja obima): dugi tapera ne ispod 5 km (dugi ≥ lagan ≥ 5 km).
      // Plafon iz jedne definicije (lengths.taperLongFactor10, adaptedLongCap10; pouka 24).
      if (
        long &&
        to10(long.workout.km) >
          adaptedLongCap10(taperLongFactor10(longest10, step), w.index >= reducedFrom)
      )
        err(
          'TAPER_LONG',
          `Dugi tapera ${long.workout.km} km > ${tw.longFactor} × najduži ${longest10 / 10} km (M7).`,
          w.index
        );
      if (w.days.length !== input.runDays.length - rest.size)
        err(
          'TAPER_DAYS',
          `Taper zadržava svih ${input.runDays.length} dana trčanja (M7).`,
          w.index
        );
    }
    // A4/A9: doza ne raste u nedelji izgradnje sa ograničenjem — najviše 1 kvalitet doze rasterećenja (T ≈ 60 %
    // poslednje T doze, lestvica rasterećenja faze) ili bez kvaliteta.
    if (isSteady(w) && checked(w) && reducedQ(w) && !w.test) {
      const qs = w.days.filter((d) => d.workout.kind === 'quality');
      const dose = qs[0]?.workout.dose;
      if (
        qs.length > (noneQ(w) ? 0 : 1) ||
        (dose &&
          (dose.ladder !== deloadLadder(w.phase) ||
            dose.doseM > capM('T', w.targetKm) ||
            dose.doseM !== wantWith(oneDayLimit(dlcOf(w), to10(w.targetKm), nEasy1, jumpOf(w)))))
      )
        err(
          'ONE_QUALITY',
          `Nedelja sa ograničenjem: najviše 1 kvalitet doze rasterećenja T ${wantT} m (A4, A9).`,
          w.index
        );
    }
    if (isSteady(w)) {
      seenSteady = true;
      if (long) lastLong10 = to10(long.workout.km);
      // Prošlost = upisani dani (pouka 29, N8): stanje doze i poslednja T doza iz upisanih dana i u mešovitoj
      // nedelji, isto kao konstruktor (generate.writtenPicks).
      if (!reducedQ(w)) {
        last = { q1: slotDose(w, 'q1') ?? last.q1, q2: slotDose(w, 'q2') ?? last.q2 };
        const tt = [slotDose(w, 'q1'), slotDose(w, 'q2')].filter((d) => d?.zone === 'T').pop();
        if (tt) lastT = tt.doseM;
      }
    }
  }

  if (shortened.length > 0)
    warn(
      'DELOAD_LONG_SHORTENED',
      `Rasterećenje (nedelja ${shortened.map((x) => x.w).join(', ')}): dugi kraći od 0,8 × poslednjeg da lagani ostanu ≥ ${P.lengths.easyMinKm} km (${[...new Set(shortened.map((x) => x.why))].join('; ')} ispred M5).`,
      shortened[0]!.w
    );

  // --- M16: test 5 km — samo plan po osećaju koji nije početnik (M17); tačno jedan, u poslednjoj nedelji baze,
  // na danu Q1 (u rasterećenju na danu T slota); WU/CD (M14) + 5 km; računa se u obim, nije doza.
  const wantTest = feel && rule.feelTest;
  const testWeek = phases.lastIndexOf('base') + 1;
  const tests = weeks.flatMap((w) =>
    w.days.filter((d) => d.role === 'test' || d.workout.kind === 'test').map((d) => ({ w, d }))
  );
  const flagged = weeks.filter((w) => w.test);
  if (steps.length > 0) {
    // Segment 04 (A13): najviše jedan test, samo plan po osećaju koji nije početnik, u nedelji izgradnje po
    // osećaju; oznaka nedelje ⇔ dan testa (mešovite nedelje: samo dan).
    const t0 = tests[0];
    if (
      tests.length > 1 ||
      (t0 !== undefined && (!wantTest || !feelW(t0.w) || !isBuildPhase(t0.w.phase)))
    )
      err('TEST', 'Adaptiran plan: najviše jedan test, u nedelji izgradnje po osećaju (A13, M17).');
    for (const w of weeks)
      if (checked(w) && (w.test === true) !== tests.some((x) => x.w === w))
        err('TEST', 'Oznaka nedelje testa ≠ dan testa (A13).', w.index);
  } else if (!wantTest) {
    if (tests.length > 0 || flagged.length > 0)
      err('TEST', beginner ? 'Početnik nema test (M17).' : 'Test samo u planu po osećaju (M16).');
  } else {
    if (
      tests.length !== 1 ||
      flagged.length !== 1 ||
      flagged[0]!.index !== testWeek ||
      tests[0]!.w.index !== testWeek
    )
      err(
        'TEST',
        `Test ${P.test.km} km tačno jednom, u poslednjoj nedelji baze (${testWeek}) (M16).`
      );
    for (const { w, d } of tests.filter((x) => !protectedDay(x.d))) {
      const wd = w.deload && tSlot === 'q2' ? pat.q2 : pat.q1;
      const k = d.workout.segments;
      const ts = k.find((x) => x.kind === 'test');
      const okSeg =
        k.length === 3 &&
        k[0]!.kind === 'warmup' &&
        k[0]!.sec === wc.warmupSec &&
        k[2]!.kind === 'cooldown' &&
        k[2]!.sec === wc.cooldownSec &&
        !!ts &&
        ts.km === P.test.km &&
        ts.sec === raceTimeForVdot(pw(w).vdot, P.test.km * 1000);
      if (
        d.role !== 'test' ||
        d.workout.kind !== 'test' ||
        d.weekday !== wd ||
        !d.countsToWeek ||
        !d.hard ||
        d.workout.dose !== null ||
        ZONES.some((z) => d.workout.workKm[z] !== 0) ||
        !okSeg
      )
        err(
          'TEST',
          `Test: dan ${wd}, WU ${wc.warmupSec / 60} min + ${P.test.km} km + CD ${wc.cooldownSec / 60} min, u obimu, bez doze (M16).`,
          w.index,
          d.date
        );
      if (!w.notes.some((n) => n.startsWith(`Test ${P.test.km} km (M16)`)) && checked(w))
        err('TEST', 'Nedelja testa bez napomene (M16).', w.index);
    }
  }
  if (feel && !plan.notes.some((n) => n.startsWith('Plan po osećaju (M16)')))
    err('PACE_BASIS', 'Plan po osećaju bez napomene (M16).');

  // --- M17: uvod bez kvaliteta (ned 1–2); nedelja izgradnje početnika bez kvaliteta samo kad ni T 1,5 km ne
  // staje u plafon (ROLES proverava dane).
  for (const w of weeks) {
    if (
      !isSteady(w) ||
      w.test ||
      hasQualityWork(w) ||
      rule.quality !== 1 ||
      !checked(w) ||
      reducedQ(w)
    )
      continue;
    if (w.index <= rule.introWeeks) {
      if (!w.notes.some((n) => n.startsWith('Uvod (M17)')))
        err('INTRO', 'Uvod bez napomene (M17).', w.index);
    } else
      warn(
        'BUILD_NO_QUALITY',
        `Nedelja ${w.index}: ni T ${P.beginner.tFirstKm} km ne staje u plafon ${P.caps.T * 100} % (M11 ispred M17).`,
        w.index
      );
  }
  // --- M8 trkačka nedelja. Segment 04: mešovita — samo dan trke; dani odmora (A4) otpadaju; oštrenje ne na danu
  // zabrane kvaliteta i otpada uz napomenu A9 (trkačka ≤ taper); višak laganih postaje odmor (pouka 30,
  // week.raceWeekRest — isti podatak kao konstrukcija); dan pred trku u periodu bola bez ubrzanja; mešovita
  // poslednja nedelja tapera → provere zavisne od tapera se preskaču.
  const rw = weeks[N - 1]!;
  const lastTaper = weeks[N - 2];
  const taperOk = !lastTaper || checked(lastTaper);
  if (rw.phase === 'race' && !checked(rw)) {
    const rd = rw.days.find((d) => d.role === 'race');
    if (!rd || rd.date !== input.raceDate || rd.countsToWeek)
      err('RACE_DAY', 'Trka je jednom, na dan trke, van obima (M8).', rw.index);
  } else if (rw.phase === 'race') {
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
    const restR = restOf(rw);
    const runsR = runs.filter((d) => !dropped.includes(d) && !restR.has(d));
    const others = rw.days.filter((d) => d.role !== 'race');
    const taperMpM =
      lastTaper?.days.map((d) => d.workout.dose).find((x) => x?.zone === 'MP')?.doseM ?? 0;
    const taperEasy10 = Math.min(
      ...(lastTaper?.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km)) ?? [])
    );
    const s = q.sharpener;
    const sharp = others.filter((d) => d.role === 'sharpener');
    // Pouka 30: dani koji postaju odmor (isti podatak kao konstrukcija, week.raceWeekRest; bez oštrenja; N−1 kakva
    // se upisuje, pouka 29).
    const restD23 =
      steps.length > 0 && lastTaper && sharp.length === 0
        ? raceWeekRest(runsR, race, painOf(rw), taperEasy10, pw(rw), to100(lastTaper.plannedKm))
        : [];
    const wantDays = runsR.filter((d) => !restD23.includes(d));
    if (JSON.stringify(others.map((d) => d.date).sort()) !== JSON.stringify(wantDays))
      err(
        'RACE_WEEK',
        `Trkačka nedelja: dani ${others.map((d) => d.weekday).join(', ')} ≠ M8 (A4, pouka 30).`,
        rw.index
      );
    if (restD23.length > 0 && !rw.notes.some((n) => n.includes('(pouka 30)')))
      err('RACE_WEEK', 'Trkačka nedelja skraćena bez napomene (pouka 30).', rw.index);
    const prevHard = lastTaper?.days.filter((d) => d.hard).pop()?.date ?? null;
    const bannedR = new Set(rw.limits?.noQuality ?? []);
    const canSharpen = taperMpM >= s.reps * s.repM;
    const cand = canSharpen
      ? [...wantDays]
          .reverse()
          .find(
            (d) =>
              daysBetween(d, race) >= q.sharpenerMinGapDays &&
              (prevHard === null || daysBetween(prevHard, d) >= 2) &&
              !bannedR.has(d)
          )
      : undefined;
    const a9 = rw.notes.some((n) => n.includes('(A9, M8)'));
    for (const d of sharp)
      if (bannedR.has(d.date))
        err('LIMITS', 'Oštrenje na dan zabrane kvaliteta (A3/A4).', rw.index, d.date);
    if (!taperOk) {
      // Mešovit taper: oštrenje i lagani trkačke nedelje zavise od konstruisanog tapera.
    } else if (a9 && sharp.length === 0) {
      // A9: oštrenje otpada (trkačka ≤ poslednja nedelja tapera).
    } else if (
      cand === undefined ? sharp.length !== 0 : sharp.length !== 1 || sharp[0]!.date !== cand
    )
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
    const painR = painOf(rw);
    const mid = midEasy(pw(rw));
    for (const d of others) {
      if (d.role === 'sharpener') continue;
      const hurt = painR.has(d.date);
      if (daysBetween(d.date, race) === 1) {
        const st = q.eveStrides;
        const k = d.workout.segments;
        if (
          d.role !== 'eve' ||
          k[0]?.sec !== q.eveEasySec ||
          k.filter((x) => x.kind === 'stride').length !== (hurt ? 0 : st.reps) ||
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
      if (d.role !== 'easy' || (!hurt && taperOk && to100(d.workout.km) !== wantKm100))
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

  // --- Segment 04 (A3, A4): ograničenja koraka po datumima (i u mešovitim nedeljama; zaključan dan i trka
  // izuzeti) — dan odmora bez treninga; zabrana kvaliteta / bol / odmor → bez kvaliteta, testa i oštrenja; bol →
  // bez ubrzanja.
  for (const w of weeks)
    for (const d of w.days) {
      if (steps.length === 0 || lockedIds.has(d.date) || d.role === 'race') continue;
      const inAny = (pick: (x: (typeof steps)[number]) => readonly (DateRange | null)[]): boolean =>
        steps.some((x) => pick(x).some((r) => inRange(d.date, r)));
      if (inAny((x) => [x.rest])) err('LIMITS', 'Trening na dan odmora (A4).', w.index, d.date);
      const hardQ = d.workout.kind === 'quality' || d.workout.kind === 'test';
      if (hardQ && inAny((x) => [...x.noQuality, x.pain, x.rest]))
        err('LIMITS', 'Kvalitet ili test na dan zabrane kvaliteta (A3/A4).', w.index, d.date);
      if (inAny((x) => [x.pain]) && d.workout.segments.some((x) => x.kind === 'stride'))
        err('LIMITS', 'Ubrzanja u periodu bola (A4).', w.index, d.date);
    }
  return out;
}

type Violation = MarathonV2Plan['warnings'][number];
