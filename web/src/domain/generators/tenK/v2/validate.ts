/* Provera plana prema policy.ts (D1–D32, A1–A15). SAMO prijavljuje prekršaje; plan se nikad ne menja i
   nema petlji skraćivanja. Greške obaraju plan (generate.ts → PLAN_VIOLATES_POLICY); upozorenja idu u plan.
   Segment 04: adaptiran plan (plan.adaptation) — tempo i osnova tempa po nedelji (steps.ts), faze iz koraka
   (nov start, prinudno rasterećenje), cilj po pravilu adaptiranog plana (volume.adaptNominal10: rast od cilja
   koraka, povratni rast, vrh od novog starta, taper od vrha posle poslednjeg smanjenja, donja granica),
   ograničenja po datumima (LIMITS), doza ne raste u nedelji sa ograničenjem (ONE_QUALITY). Nedelje iz
   mixedWeeks proveravaju se samo na nivou dana, a provere koje zavise od stanja prethodne nedelje se posle
   mešovite nedelje preskaču do sledeće proverene nedelje (konstruisan plan bez mešanja proverava
   generate.construct). */

import { addDays as isoAdd, daysBetween, mustDay, weekdayOf } from './dates.ts';
import { checkInput } from './input.ts';
import { longCap10, longestLong10 } from './lengths.ts';
import {
  assessGoal,
  feelPaces,
  midEasy,
  pacesFromVdot,
  raceTimeForVdot,
  round1,
  vdotFromEasyPace,
  vdotFromResult
} from './paces.ts';
import {
  buildAllowed,
  deloadAllowed,
  firstOfPhase,
  isBuildPhase,
  periodize,
  phasesOf,
  testWeekOf
} from './periodize.ts';
import { planRule, TEN_K_V2_POLICY as P } from './policy.ts';
import {
  capM,
  carries,
  deloadLadder,
  deloadSlot,
  firstLevelOverCap,
  ladderFor,
  nextLevel
} from './quality.ts';
import { adjacentDays } from './schedule.ts';
import {
  mixedFloorKm,
  recordedExcessKeepsQuality,
  P35_DROP,
  P35_KEEP,
  qualityOverLong,
  raceWeekEveOnly,
  raceWeekRest,
  restDaysWeek
} from './week.ts';
import {
  A17_MAX_RUN,
  appliedRestarts,
  basisAt,
  deloadWeekOf,
  framesFor,
  inRange,
  pacesAt,
  restartWeeks
} from './steps.ts';
import type {
  DayRole,
  Dose,
  LadderId,
  Phase,
  Paces,
  PlanWeek,
  QualityType,
  Structure,
  TenKV2Plan,
  Violation,
  WeekFrame,
  WorkZone
} from './types.ts';
import {
  adaptNominal10,
  adaptVolume,
  capacityLimits,
  capacityMessage,
  enterWeek,
  fewerDaysAdvice,
  growth10,
  initialAdaptHistory,
  leaveWeek,
  peakCap10,
  startKm10
} from './volume.ts';
import {
  doseOf,
  ladderLevels,
  recoveryOf,
  repsOf,
  sameStructure,
  sharpenerWarmupCooldown,
  structuresForDose,
  zoneOf
} from './workouts.ts';
import { weekLabel } from './weekLabel.ts';

const EPS = 1e-6;
const PHASES: readonly Phase[] = ['base', 'development', 'specific', 'taper', 'race'];
const HARD: readonly DayRole[] = ['q1', 'q2', 'long', 'sharpener', 'race', 'test'];
const ZONES: readonly WorkZone[] = ['R', 'I', 'T', 'RP'];
const to10 = (km: number): number => Math.round(km * 10);
const to100 = (km: number): number => Math.round(km * 100);

type SlotTypes = Readonly<
  Record<Phase, { q1: readonly QualityType[]; q2: readonly QualityType[] }>
>;
/** D10: dozvoljeni tipovi kvaliteta po fazi i slotu (T druge strukture je kontinuirano ↔ deonice). */
const SLOT_TYPES: SlotTypes = {
  base: { q1: ['R'], q2: ['T_continuous', 'T_cruise'] },
  development: { q1: ['I'], q2: ['T_cruise', 'T_continuous'] },
  specific: { q1: ['RP'], q2: ['T_cruise', 'T_continuous'] },
  taper: { q1: ['RP'], q2: ['T_cruise'] },
  race: { q1: [], q2: [] }
};
/** D18: 3 dana — jedan kvalitet: baza T kontinuirano, razvoj T cruise, specifično i taper RP; bez I i R. */
const SLOT_TYPES_ONE: SlotTypes = {
  base: { q1: ['T_continuous', 'T_cruise'], q2: [] },
  development: { q1: ['T_cruise', 'T_continuous'], q2: [] },
  specific: { q1: ['RP'], q2: [] },
  taper: { q1: ['RP'], q2: [] },
  race: { q1: [], q2: [] }
};

const isSteady = (w: PlanWeek): boolean => isBuildPhase(w.phase) && !w.deload;
const sameLimits = (a: WeekFrame, b: WeekFrame): boolean =>
  JSON.stringify(a.limits ?? null) === JSON.stringify(b.limits ?? null);
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
const hasQuality = (w: PlanWeek): boolean => w.days.some((d) => d.workout.kind === 'quality');
const qualityKey = (w: PlanWeek): string =>
  JSON.stringify(
    w.days.filter((d) => d.workout.kind === 'quality').map((d) => [d.role, d.workout.blocks])
  );

/** ≈ share × poslednja doza, najviši nivo lestvice naniže (`beginner`: lestvica početnika, D31); ispod
    najnižeg → floor (D5/D7). */
function expectedReduced(
  ladder: LadderId,
  lastM: number,
  share: number,
  floorM: number,
  beginner = false
): number {
  const lv = ladderLevels(ladder, beginner)
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
  // Segment 3i: broj nedelje u porukama (prefiks plana cilja predaje); indeksi i polje `week` ostaju v2.
  const wl = (w: number): number => weekLabel(input, w);
  const p = plan.paces;
  const N = weeks.length;
  const rule = planRule(input.runDays.length, input.experience ?? 'regular');
  if (!rule) {
    err('RUN_DAYS', `Broj dana ${input.runDays.length} nije u tabeli D17 (početnik: D28).`);
    return out;
  }
  const tSlot = deloadSlot(rule.quality);
  const feel = plan.paceBasis === 'feel';
  // Segment 04: adaptacija — koraci, mešovite nedelje, tempo i osnova tempa nedelje, okviri iz koraka.
  const ad = plan.adaptation;
  const steps = ad?.steps ?? [];
  const mixed = new Set(ad?.mixedWeeks ?? []);
  const checked = (w: PlanWeek): boolean => !mixed.has(w.index);
  /** 06f (pouka 4, stalni uslov 4; kao maraton MAR-07b): zaštićen dan — ≤ asOf adaptacije, zaključan (ručna izmena)
      ili urađen. Provere koje sude jednom danu po tempu ili strukturi ga preskaču (kao LIMITS): validator ne sudi
      činjenicama; nedeljna pravila važe za konstrukciju. */
  const lockedIds = new Set([...(ad?.lockedDayIds ?? []), ...(ad?.doneDayIds ?? [])]);
  const protectedDay = (d: { date: string }): boolean =>
    lockedIds.has(d.date) || (ad !== undefined && mustDay(d.date) <= mustDay(ad.asOf));
  const chk = ad ? checkInput(input) : null;
  const pace = chk?.ok ? chk.pace : null;
  if (ad && !pace) {
    err('ADAPTATION', 'Ulaz adaptiranog plana nije ispravan (A15).');
    return out;
  }
  const pw = (w: { index: number }): Paces => (pace ? pacesAt(pace, steps, w.index) : p);
  const feelW = (w: { index: number }): boolean =>
    pace ? basisAt(pace, steps, w.index) === 'feel' : feel;
  const base0 = pace ? periodize(input.startDate, N, pace.kind === 'feel' && rule.feelTest) : null;
  /** A17: ukinuta redovna rasterećenja (isti podatak kao konstruktor, steps.framesFor). */
  const dropped = new Map<number, number>();
  const frames =
    pace && base0 && base0.length === N
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
  const restarts = pace && base0 ? appliedRestarts(base0, steps) : new Set<number>();
  /** A3: nov start počinje progresiju doze iznova i kad faze ostaju (odstupanje A3). */
  const doseRestarts = restartWeeks(steps);
  const firstAdapted = steps.length > 0 ? Math.min(...steps.map((x) => x.firstWeek)) : Infinity;
  /** A9: prva nedelja posle smanjenja obima (odstupanja za mali obim). */
  const reducedFrom = steps.length > 0 ? adaptVolume(steps).reducedFrom : Infinity;
  const forced = (w: PlanWeek): boolean =>
    steps.some((x) => x.deload && deloadWeekOf(x) === w.index);
  /** A12: početak segmenta izgradnje (nov start sa rePeriodize) za nedelju i. */
  const segStart = (i: number): number => Math.max(1, ...[...restarts].filter((r) => r <= i));
  /** A4/A9: nedelja sa manje kvaliteta — ograničenje koraka ili napomena A9 konstruktora. */
  const reducedQ = (w: PlanWeek): boolean =>
    w.limits?.quality !== undefined || w.notes.some((n) => n.includes('(A9)'));
  const restOf = (w: PlanWeek): Set<string> => new Set(w.limits?.rest ?? []);
  const painOf = (w: PlanWeek): Set<string> => new Set(w.limits?.pain ?? []);
  const dateIn = (w: PlanWeek, wd: string): string =>
    Array.from({ length: 7 }, (_, i) => isoAdd(w.startDate, i)).find((d) => weekdayOf(d) === wd)!;

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

  // --- D4 / Uslov 6: faza svake nedelje iz odluke generatora. Segment 04: iz koraka (nov start: A3/A12);
  // okvir nedelje (rasterećenje, ograničenja) = steps.framesFor.
  const expected = frames ? frames.map((f) => f.phase) : phasesOf(N);
  for (const w of weeks) {
    if (!PHASES.includes(w.phase)) err('NO_PHASE', 'Nedelja bez faze.', w.index);
    else if (checked(w) && w.phase !== expected[w.index - 1])
      err('PHASES', `Faza ${w.phase} ≠ ${expected[w.index - 1]} (D4, A12).`, w.index);
    const f = frames?.[w.index - 1];
    if (f && checked(w) && (f.deload !== w.deload || !sameLimits(f, w)))
      err('FRAMES', 'Rasterećenje ili ograničenja nedelje ≠ koraci adaptacije (A3–A5).', w.index);
  }
  const phases = weeks.map((w) => w.phase);

  // --- D5: gde su rasterećenja. Segment 04: relativno od novog starta (A12); prinudno rasterećenje (A5)
  // sme bilo gde u izgradnji, a niz posle njega (ukinuto redovno rasterećenje) nije ograničen. A17: niz koji
  // počinje rasterećenjem ukinutim posle nedelje smanjenja (dropped) najviše A17_MAX_RUN nedelja.
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
      err('DELOAD_PLACEMENT', `Rasterećenje ${why} (D5).`, w.index);
    }
    if (!isBuildPhase(w.phase)) continue;
    if (w.deload) [run, afterForced, afterDropped] = [0, forced(w), false];
    else {
      if (dropped.has(w.index)) [run, afterDropped] = [0, true];
      const allowed = afterDropped ? run + 1 <= A17_MAX_RUN : buildAllowed(rel, k, run);
      if (!allowed && !afterForced && checked(w))
        err(
          'DELOAD_RUN',
          `${run + 1} uzastopne nedelje izgradnje bez rasterećenja (D5${afterDropped ? ', A17' : ''}).`,
          w.index
        );
      run++;
    }
  }

  // --- D9: uloge dana po šablonu; D5/D7/D18/D19 broj kvaliteta (ostali dani lagani).
  const pat = plan.pattern;
  const quality: [DayRole, string][] = [
    ['q1', pat.q1],
    ...(pat.q2 ? [['q2', pat.q2] as [DayRole, string]] : [])
  ];
  if (quality.length !== rule.quality)
    err('ROLES', `Šablon ima ${quality.length} kvaliteta, D17 traži ${rule.quality}.`);
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    // Uloge kvaliteta koje nedelja zadržava; ostali dani šablona su lagani. Rasterećenje: samo T slot (bez
    // njega kad je bez kvaliteta, odstupanje D5); taper „samo RP" (odstupanje D7): samo Q1. D27: test na
    // danu Q1, u rasterećenju na danu T slota. D28: uvod bez kvaliteta; početnik bez kvaliteta kad ni prvi
    // nivo ne staje u plafon (proverava BUILD_NO_QUALITY ispod).
    const has = (r: DayRole): boolean => w.days.some((d) => d.role === r);
    const roleOf = (r: DayRole): DayRole => {
      if (w.test && r === (w.deload ? tSlot : 'q1')) return 'test';
      if (w.index <= rule.introWeeks) return 'easy';
      if (w.deload) return r === tSlot && has(r) ? r : 'easy';
      // Pouka 35: drugi dan kvaliteta nedelje izgradnje lagan (napomena konstruktora, week.ts).
      if (r === 'q2' && isSteady(w) && w.notes.some((n) => n.startsWith(P35_DROP))) return 'easy';
      return w.phase !== 'taper' && !rule.beginner ? r : has(r) ? r : 'easy';
    };
    const want: [DayRole, string][] = [
      ...quality.map(([r, wd]): [DayRole, string] => [roleOf(r), wd]),
      ['long', pat.long],
      ...pat.easy.map((wd): [DayRole, string] => ['easy', wd])
    ];
    if (!checked(w)) continue;
    const rest = restOf(w);
    if (w.index >= firstAdapted && (reducedQ(w) || rest.size > 0)) {
      // A4/A9: dani odmora bez treninga; dan kvaliteta šablona sme biti lagan ili nositi jedini kvalitet
      // (svoja uloga), ukupno najviše dozvoljeno kvaliteta (ograničenje koraka; A9 manje od pravila).
      const none =
        w.limits?.quality === 'none' || w.notes.some((n) => n.includes('nedelja bez kvaliteta'));
      const max = none ? 0 : reducedQ(w) ? 1 : rule.quality;
      const roleAt = new Map(w.days.map((d) => [d.weekday as string, d.role]));
      const bad = want.filter(([r, wd]) => {
        const got = roleAt.get(wd);
        if (rest.has(dateIn(w, wd))) return got !== undefined;
        const slot = quality.find(([, q]) => q === wd)?.[0];
        return slot ? !(got === r || got === slot || got === 'easy') : got !== r;
      });
      const nq = w.days.filter((d) => d.role === 'q1' || d.role === 'q2').length;
      if (
        bad.length > 0 ||
        w.days.length !== want.filter(([, wd]) => !rest.has(dateIn(w, wd))).length ||
        nq > max
      )
        err(
          'ROLES',
          `Dani ${w.days.map((d) => `${d.role}@${d.weekday}`).join(', ')} ne odgovaraju šablonu uz ograničenja (D9, A4, A9).`,
          w.index
        );
      continue;
    }
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
    adjacentDays(pat.q1, pat.long) ||
    (pat.q2 !== null && (adjacentDays(pat.q1, pat.q2) || adjacentDays(pat.q2, pat.long)))
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
      if (d.role === 'easy' && !protectedDay(d) && d.workout.km + EPS < P.lengths.easyMinKm)
        err(
          'EASY_MIN',
          `Lagan ${d.workout.km} km < ${P.lengths.easyMinKm} km (D13/D15).`,
          w.index,
          d.date
        );
    }
    const planned = w.days.reduce((a, d) => a + (d.countsToWeek ? to100(d.workout.km) : 0), 0);
    if (planned !== to100(w.plannedKm)) err('ARITHMETIC', 'Planirano ≠ zbir dana.', w.index);
    // 06g (kao HM/maraton N1, pouke 25 i 30): svaki dan trčanja nedelje je dan odmora koraka (bol, A4) — osim trke —
    // nedelja bez treninga nije degenerisan plan nego odmor: upozorenje, ne EMPTY_WEEK.
    const allRest =
      (restOf(w).size > 0 &&
        input.runDays.every((wd) => {
          const d = dateIn(w, wd);
          return restOf(w).has(d) || w.days.some((x) => x.date === d && x.role === 'race');
        })) ||
      // Trkačka nedelja samo sa trkom: ostali dani odmor ili otpali po D23 (taper sa danima odmora/bola).
      (w.phase === 'race' &&
        w.days.every((d) => d.role === 'race') &&
        (restOf(w).size > 0 ||
          w.notes.some((n) => n.includes('(D23).') && n.includes('skraćena'))));
    if (w.days.filter((d) => d.countsToWeek).length === 0) {
      if (allRest)
        warn(
          'WEEK_ALL_REST',
          `Nedelja bez treninga${w.phase === 'race' ? ' (osim trke)' : ''} — svi dani su odmor (bol, A4).`,
          w.index
        );
      else err('EMPTY_WEEK', 'Nedelja bez treninga (Uslov 8).', w.index);
    }
    // Pouka 37 (10k-v2.8.0): mešovita nedelja čiji su preostali dani na ostatku do cilja (keptKm = zbir zaštićenih po
    // činjenicama, konstruktor) — preostali dani ≤ cilj − keptKm; iznad samo kad ni najmanji preostali dani ne staju
    // (week.mixedFloorKm — ista funkcija kao konstruktor week.mixedRemainder) → upozorenje (pouka 14), inače greška.
    // Nedelja cela ≤ asOf: istorija (prethodna adaptacija), ne sudi se.
    if (
      ad &&
      w.keptKm !== undefined &&
      w.phase !== 'race' &&
      mustDay(w.endDate) > mustDay(ad.asOf)
    ) {
      const free = w.days.filter((d) => !protectedDay(d));
      const freeKm = free.reduce((a, d) => a + (d.countsToWeek ? to100(d.workout.km) : 0), 0) / 100;
      const rest = Math.round((w.targetKm - w.keptKm) * 100) / 100;
      if (!mixed.has(w.index) || free.length === 0)
        err('MIXED_REMAINDER', 'Ostatak do cilja (pouka 37) van mešovite nedelje.', w.index);
      else if (freeKm > rest + P.tolerance.plannedKm + EPS) {
        const floor = mixedFloorKm(free);
        // Kvalitet ostaje (dopuna MAR-08): preostali = dugi + kvalitet + lagani na minimumu (ista funkcija).
        // Z1 (10K-07): ili je jedini uzrok upisani višak zaštićenih dana (ista funkcija kao konstruktor).
        const plannedKept =
          w.days
            .filter((d) => protectedDay(d) && d.countsToWeek)
            .reduce((a, d) => a + to100(d.workout.km), 0) / 100;
        if (
          Math.abs(freeKm - mixedFloorKm(free, true)) <= EPS &&
          (rest + EPS < floor ||
            recordedExcessKeepsQuality(free, w.keptKm, plannedKept, w.targetKm))
        )
          warn(
            'MIXED_OVER_TARGET',
            `Mešovita nedelja: zaštićeni dani ${w.keptKm} km (po činjenicama), ostatak do cilja ${rest} km < najmanji preostali dani ${floor} km — planirano ${w.plannedKm} km > cilj ${w.targetKm} km (pouka 37/14).`,
            w.index
          );
        else
          err(
            'MIXED_REMAINDER',
            `Mešovita nedelja: preostali dani ${freeKm} km > ostatak do cilja ${rest} km, a nisu na minimumu (pouka 37).`,
            w.index
          );
      }
    }
    // Segment 04: mešovita nedelja — samo dani; nedelja sa danima bola/odmora (A4): planirano ≤ cilj.
    if (!checked(w)) continue;
    const limited = restOf(w).size > 0 || painOf(w).size > 0;
    if (limited && w.plannedKm <= w.targetKm + P.tolerance.plannedKm + EPS) {
      if (w.plannedKm + P.tolerance.plannedKm + EPS < w.targetKm)
        warn(
          'PLANNED_BELOW_TARGET_LIMITS',
          `Planirano ${w.plannedKm} km < cilj obima ${w.targetKm} km (odmor/bol, A4).`,
          w.index
        );
    } else if (Math.abs(w.plannedKm - w.targetKm) > P.tolerance.plannedKm + EPS)
      err('PLANNED_VS_TARGET', `Planirano ${w.plannedKm} km ≠ cilj ${w.targetKm} km.`, w.index);
    // A9: donja granica adaptiranog cilja = minimum nedelje (D17).
    if (w.index >= firstAdapted && w.phase !== 'race' && to10(w.targetKm) < to10(rule.weekMinKm))
      err(
        'TARGET_FLOOR',
        `Cilj ${w.targetKm} km < minimum nedelje ${rule.weekMinKm} km (A9).`,
        w.index
      );
    // D30: trkačka nedelja — planirano + trka (10 km) ≥ minimum (trka je opterećenje nedelje). Nedelja je
    // potpuno zadata (D8/D20), pa je ispod minimuma upozorenje (D15), nedelja se ne puni. A4 (pouka 25,
    // 10k-v2.6.0): minimum važi za CILJ (TARGET_FLOOR) — nedelja sa danima odmora, ili bola van trkačke
    // (ona ima RACE_WEEK_SHORT), sme planirano ispod minimuma (upozorenje).
    const load = w.plannedKm + (w.phase === 'race' ? P.raceWeek.raceKm : 0);
    if (
      load + EPS < rule.weekMinKm &&
      (restDaysWeek(w) || (painOf(w).size > 0 && w.phase !== 'race'))
    )
      warn(
        'WEEK_MIN_REST',
        restOf(w).size > 0
          ? `Nedelja ${w.plannedKm} km < ${rule.weekMinKm} km — dani odmora (bol, A4).`
          : `Nedelja ${w.plannedKm} km < ${rule.weekMinKm} km — dani bola (A4, pouka 25).`,
        w.index
      );
    else if (load + EPS < rule.weekMinKm) {
      if (w.phase === 'race')
        warn(
          'RACE_WEEK_SHORT',
          `Trkačka nedelja ${w.plannedKm} km + trka ${P.raceWeek.raceKm} km < ${rule.weekMinKm} km (Uslov 8, D17, D30).`,
          w.index
        );
      else
        err(
          'WEEK_MIN_VOLUME',
          `Nedelja ${w.plannedKm} km < ${rule.weekMinKm} km (Uslov 8, D17).`,
          w.index
        );
    }
  }

  // --- D13: dužine. Segment 04: mešovita nedelja — samo provere dana; A4 dugi na danu bola ≤ 60 min,
  // lagani na danima bola nisu jednaki (× 0,7); dugi na danu odmora otpada.
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.phase === 'race') {
      if (long) err('RACE_WEEK', 'Trkačka nedelja nema dugi (trka ga zamenjuje, D8).', w.index);
      continue;
    }
    // Mešovita nedelja: zadržani dani (prošlost) i konstruisani dani nisu ista nedelja (samo provere dana).
    if (!checked(w)) continue;
    if (!long) {
      if (!restOf(w).has(dateIn(w, pat.long))) err('ROLES', 'Nedelja nema dugi trk.', w.index);
      continue;
    }
    const pk = pw(w);
    const longMaxSec = painOf(w).has(long.date)
      ? Math.min(rule.longMaxSec, P.adapt.painLongMaxSec)
      : rule.longMaxSec;
    const l10 = to10(long.workout.km);
    if (Math.abs(long.workout.km * 10 - l10) > EPS)
      err('LENGTH_STEP', 'Dugi nije u koraku 0,1 km (D13).', w.index, long.date);
    if (l10 > Math.floor(rule.longMaxShare * to10(w.targetKm) + 1e-9))
      err(
        'LONG_SHARE',
        `Dugi ${long.workout.km} km > ${Math.round(rule.longMaxShare * 100)} % cilja ${w.targetKm} km (D13, D17).`,
        w.index,
        long.date
      );
    if (long.workout.km * pk.E.slow > longMaxSec + EPS)
      err(
        'LONG_DURATION',
        `Dugi ${long.workout.km} km > ${longMaxSec / 60} min sporim E (D13, D28, A4).`,
        w.index,
        long.date
      );
    if (long.workout.segments.some((s) => s.zone !== 'E'))
      err('LONG_NOT_EASY', 'Dugi trk je samo lagan.', w.index, long.date);
    // D19: lagani dani jednaki (zaokruženje 0,1 km, razlika ≤ 0,1 km).
    const easyKm = w.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km));
    if (easyKm.length > 1 && Math.max(...easyKm) - Math.min(...easyKm) > 1 && painOf(w).size === 0)
      err(
        'EASY_UNEQUAL',
        `Lagani dani ${easyKm.map((x) => x / 10).join(' / ')} km nisu jednaki (D19).`,
        w.index
      );
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

  // --- Pouka 35 (10k-v2.6.0): dva dana kvaliteta samo kad dugi ostaje najduži (isti predikat kao week.ts);
  // nedelja sa jednim kvalitetom neizvodljiva (napomena konstruktora) → upozorenje.
  for (const w of weeks) {
    if (!isSteady(w) || !checked(w) || !qualityOverLong(w.days)) continue;
    if (w.notes.includes(P35_KEEP))
      warn(
        'TWO_QUALITY_LONGER',
        `Dva dana kvaliteta, dan kvaliteta duži od dugog — nedelja sa jednim nije izvodljiva (pouka 35, D25).`,
        w.index
      );
    else
      err(
        'QUALITY_OVER_LONG',
        `Dva dana kvaliteta, a dan kvaliteta traje duže od dugog — drugi dan kvaliteta je lagan (pouka 35).`,
        w.index
      );
  }

  // --- D25: upozorenje — dan kvaliteta duži od dugog po trajanju u ne-rasteretnoj nedelji izgradnje; dan testa
  // (10K-07, kao HM pouka 32) u svakoj nedelji izgradnje, i u rasterećenju.
  const d25 = (w: PlanWeek): boolean =>
    isSteady(w) || (isBuildPhase(w.phase) && w.days.some((d) => d.workout.kind === 'test'));
  const longer = weeks.flatMap((w) => {
    const long = w.days.find((d) => d.role === 'long');
    if (!d25(w) || !long || !checked(w)) return [];
    const q = Math.max(
      0,
      ...w.days
        .filter((d) => d.workout.kind === 'test' || (d.workout.kind === 'quality' && isSteady(w)))
        .map((d) => d.workout.sec)
    );
    return q > long.workout.sec ? [{ w: w.index, q, long: long.workout.sec }] : [];
  });
  if (longer.length > 0) {
    const f = longer[0]!;
    warn(
      'LONG_SHORTER_THAN_QUALITY',
      `Dan kvaliteta ili testa duži od dugog po trajanju u ${longer.length} od ${weeks.filter(d25).length} nedelja izgradnje (${wl(f.w)}. nedelja: ${Math.round(f.q / 60)} > ${Math.round(f.long / 60)} min)${fewerDaysAdvice(input.runDays.length, input.currentWeeklyKm, rule)}.`,
      f.w
    );
  }

  // --- D11: jedan plafon po zoni, po treningu (trkačka nedelja: D8).
  for (const w of weeks) {
    if (w.phase === 'race' || !checked(w)) continue;
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

  // --- D10/D18 tipovi po fazi; D14 WU/CD (pojas trenutnog obima; početnik prvi pojas, D28) i oporavci;
  // D26 RPE; D27 struktura testa.
  const slotTypes = rule.quality === 1 ? SLOT_TYPES_ONE : SLOT_TYPES;
  const km10 = to10(input.currentWeeklyKm);
  const bands = P.workout.warmupCooldown;
  const wcBand = rule.beginner ? bands[0]! : bands.filter((b) => to10(b.fromKm) <= km10).pop()!;
  const wuCdOk = (
    seg: readonly { kind: string; sec: number; km: number }[],
    mid: number,
    wc: { warmupSec: number; cooldownSec: number } = wcBand
  ): [boolean, boolean] => {
    const wu = seg[0];
    const cd = seg[seg.length - 1];
    return [
      !!wu &&
        wu.kind === 'warmup' &&
        wu.sec === wc.warmupSec &&
        to100(wu.km) === Math.round((wu.sec * 100) / mid),
      !!cd &&
        cd.kind === 'cooldown' &&
        cd.sec === wc.cooldownSec &&
        to100(cd.km) === Math.round((cd.sec * 100) / mid)
    ];
  };
  for (const w of weeks)
    for (const d of w.days) {
      // 06f: zaštićen dan nosi tempo i strukturu iz kojih je upisan — ne sudi se po tempu nedelje.
      if (protectedDay(d)) continue;
      // Segment 04: tempo i osnova tempa nedelje (A1).
      const pk = pw(w);
      const mid = midEasy(pk);
      const wo = d.workout;
      if (wo.kind !== 'quality' && wo.rpe !== undefined)
        err('RPE', 'RPE samo na treningu kvaliteta (D26).', w.index, d.date);
      if (wo.kind === 'test') {
        // D27: WU (pojas D14) + 5 km kontrolisano maksimalno + CD; u obimu; nije doza.
        const seg = wo.segments;
        const t = seg.filter((x) => x.kind === 'test');
        const [okWu, okCd] = wuCdOk(seg, mid);
        if (
          d.role !== 'test' ||
          !d.countsToWeek ||
          wo.dose ||
          seg.length !== 3 ||
          t.length !== 1 ||
          seg[1] !== t[0] ||
          t[0]!.km !== P.test.km ||
          t[0]!.zone !== 'test' ||
          t[0]!.sec !== raceTimeForVdot(pk.vdot, P.test.km * 1000) ||
          !okWu ||
          !okCd
        )
          err(
            'TEST',
            `Test: WU ${wcBand.warmupSec / 60} min + ${P.test.km} km + CD ${wcBand.cooldownSec / 60} min, u obimu nedelje, bez doze (D27).`,
            w.index,
            d.date
          );
        continue;
      }
      if (d.role === 'test') err('TEST', 'Dan testa bez testa (D27).', w.index, d.date);
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
        if (d.role !== 'sharpener' || wo.qualityType !== 'RP_sharpener')
          err('PHASE_QUALITY', 'Trkačka nedelja ima samo oštrenje (D8).', w.index, d.date);
      } else if (w.deload || (reducedQ(w) && isBuildPhase(w.phase))) {
        // Rasterećenje (D5) i nedelja izgradnje sa jednim kvalitetom doze rasterećenja (A4/A9; doza:
        // ONE_QUALITY).
        const lad = deloadLadder(w.phase);
        if ((d.role !== tSlot && !swapOk(tSlot)) || dose.ladder !== lad)
          err(
            'PHASE_QUALITY',
            `Rasterećenje: jedini kvalitet je T (${lad}) (D5).`,
            w.index,
            d.date
          );
      } else if (w.phase === 'taper' && reducedQ(w) && dose.zone === 'RP' && swapOk('q1')) {
        // A4/A9: taper samo RP na drugom danu kvaliteta (dan Q1 u zabrani); doza: TAPER_QUALITY.
      } else {
        const role = d.role === 'q1' || d.role === 'q2' ? d.role : null;
        if (!role || !wo.qualityType || !slotTypes[w.phase][role].includes(wo.qualityType)) {
          // D31: početnik — T kontinuirano (i ista doza druge strukture) umesto RP specifične faze; u taperu
          // T kontinuirano umesto RP (sadržaj: TAPER_QUALITY).
          const beginnerT =
            rule.beginner &&
            role === 'q1' &&
            dose.ladder === 'T_continuous' &&
            (wo.qualityType === 'T_continuous' || wo.qualityType === 'T_cruise') &&
            (w.phase === 'taper' ||
              firstLevelOverCap(ladderFor(w.phase, 'q1', 1), w.targetKm, true));
          if (!beginnerT)
            err(
              'PHASE_QUALITY',
              `${wo.qualityType} ne pripada fazi ${w.phase} (${d.role}) (D10).`,
              w.index,
              d.date
            );
        }
        // D31: početnik u izgradnji — lestvica faze kad njen prvi nivo staje u plafon, inače T kontinuirano
        // (nezavisna provera plafona).
        if (rule.beginner && role === 'q1' && isBuildPhase(w.phase)) {
          const phaseLadder = ladderFor(w.phase, 'q1', 1);
          const over = firstLevelOverCap(phaseLadder, w.targetKm, true);
          const want: LadderId = over ? 'T_continuous' : phaseLadder;
          if (dose.ladder !== want)
            err(
              'PHASE_QUALITY',
              `Početnik: ${dose.ladder} ≠ ${want} — prvi nivo ${phaseLadder} ${over ? 'ne staje' : 'staje'} u plafon cilja ${w.targetKm} km (D31).`,
              w.index,
              d.date
            );
        }
      }
      if (Math.round(wo.workKm[dose.zone] * 1000) !== dose.doseM)
        err('DOSE', 'Rad u zoni ≠ doza.', w.index, d.date);
      // D26: plan po osećaju — RPE zone na svakom kvalitetu; plan sa rezultatom bez RPE.
      const r = P.feel.rpe[dose.zone];
      const feelD = feelW(w);
      if (
        feelD
          ? !wo.rpe || wo.rpe.min !== r.min || wo.rpe.max !== r.max || wo.rpe.cue !== r.cue
          : wo.rpe !== undefined
      )
        err(
          'RPE',
          feelD
            ? `Kvalitet ${dose.zone} nosi RPE ${r.min}–${r.max} („${r.cue}") (D26).`
            : 'Plan sa rezultatom nema RPE (D26).',
          w.index,
          d.date
        );
      const seg = wo.segments;
      // D8 (10K-07): oštrenje nosi WU/CD trke (workouts.sharpenerWarmupCooldown), ostali kvalitet pojas D14.
      const wc = d.role === 'sharpener' ? sharpenerWarmupCooldown() : wcBand;
      const [okWu, okCd] = wuCdOk(seg, mid, wc);
      if (!okWu)
        err(
          'WARMUP',
          `Zagrevanje mora biti ${wc.warmupSec / 60} min E (km po srednjem E) (D14).`,
          w.index,
          d.date
        );
      if (!okCd)
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
      // D10/D22: T deonice ≥ 1000 m; D30: RP deonice ≥ 800 m (oštrenje: D8, 1000 m).
      const repMin =
        dose.zone === 'T'
          ? P.alternatives.repMinM
          : dose.zone === 'RP'
            ? P.alternatives.rpRepMinM
            : 0;
      if (repsOf(s).some((m) => m < repMin))
        err('REP_MIN', `${dose.zone} deonica < ${repMin} m (D10, D22, D30).`, w.index, d.date);
      if (s.form !== 'continuous') {
        const want = repsOf(s);
        const okRec = recs.every((x, i) => {
          const rec = recoveryOf(dose.ladder, want[i]!, pk);
          return 'm' in rec ? to100(x.km) === Math.round(rec.m / 10) : x.sec === rec.sec;
        });
        const okReps = reps.every((x, i) => to100(x.km) === Math.round(want[i]! / 10));
        if (reps.length !== want.length || recs.length !== want.length - 1 || !okRec || !okReps)
          err('RECOVERY', `Oporavak deonica ne odgovara D14 (${dose.ladder}).`, w.index, d.date);
      } else if (recs.length > 0 || reps.length > 0)
        err('RECOVERY', 'Kontinuiran blok nema deonice ni oporavak.', w.index, d.date);
    }

  // --- D12: progresija po slotu kroz ne-rasteretne nedelje izgradnje. Prethodna doza slota je iz poslednje
  // nedelje koja ga ima: test (D27), uvod i nedelja bez kvaliteta početnika (D28) ne menjaju stanje slota.
  // Segment 04: lanac ne-rasteretnih nedelja izgradnje; nedelja sa ograničenjem kvaliteta (A4/A9) ne menja
  // stanje doze i preskače se; nov start (A3) počinje progresiju iznova ('restart', D16); posle mešovite
  // nedelje stanje nije poznato ('unknown': sledeća poređenja se preskaču).
  const chain: (PlanWeek | 'restart' | 'unknown')[] = [];
  for (const w of weeks) {
    if (doseRestarts.has(w.index)) chain.push('restart');
    if (!isSteady(w) || reducedQ(w)) continue;
    chain.push(checked(w) ? w : 'unknown');
  }
  const steady = chain.filter((x): x is PlanWeek => typeof x !== 'string');
  let lastOf: Record<'q1' | 'q2', Dose | null> = { q1: null, q2: null };
  /** D28: početnik, nedelja izgradnje posle uvoda bez kvaliteta (ni prvi nivo ne staje u plafon). */
  const noQuality = (w: PlanWeek): boolean =>
    rule.beginner && !w.test && w.index > rule.introWeeks && !slotDose(w, 'q1');
  let prevMain: PlanWeek | null = null;
  let a: PlanWeek | null = null;
  for (const c of chain) {
    if (typeof c === 'string') {
      [lastOf, prevMain, a] = [{ q1: null, q2: null }, null, null];
      continue;
    }
    const b = c;
    for (const role of ['q1', 'q2'] as const) {
      const da = lastOf[role];
      const db = slotDose(b, role);
      if (db) lastOf[role] = db;
      if (!da || !db) continue;
      if (db.step === 'drop') {
        // D11 ispred D12: dozvoljeno samo kad prethodna doza ne staje u plafon ove nedelje, na najviši
        // nivo lestvice koji staje, uz napomenu.
        const ladder = db.ladder as LadderId;
        const cap = capM(db.zone, b.targetKm);
        const best = ladderLevels(ladder, rule.beginner)
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
        const nl = nextLevel(ladder, da.doseM, rule.beginner);
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
        const carry = carries(da.ladder as LadderId, db.ladder as LadderId);
        if (carry && db.doseM < da.doseM)
          err(
            'TRANSITION_DOSE',
            `${role}: ${db.ladder} ${db.doseM} m < poslednje ${da.ladder} ${da.doseM} m (D12).`,
            b.index
          );
      }
    }
    // A2/A3/A8: u adaptiranoj nedelji sa manjim ciljem od nedelje poređenja doza sme da padne sa obimom
    // (plafon D11 ispred D12).
    const reducedVolume =
      b.index >= firstAdapted && prevMain !== null && to10(b.targetKm) < to10(prevMain.targetKm);
    const dropped =
      (['q1', 'q2'] as const).some((r) => slotDose(b, r)?.step === 'drop') ||
      noQuality(b) ||
      reducedVolume ||
      b.notes.some((n) => n.startsWith(P35_DROP));
    // D27: provera „glavna doza ne opada" preskače test nedelju.
    if (!b.test) {
      if (prevMain && mainDoseM(b) < mainDoseM(prevMain) && !dropped)
        err(
          'MAIN_DOSE_DECREASE',
          `Glavna doza ${mainDoseM(b)} m < ${mainDoseM(prevMain)} m (D12).`,
          b.index
        );
      if (!noQuality(b)) prevMain = b;
    }
    const prevA = a;
    a = b;
    if (!prevA) continue;
    const a0 = prevA;
    // Odstupanje D12 (3 dana, jedan slot): kad druga struktura iste doze ne postoji (D10), slot ponavlja
    // trening uz napomenu, pa je nedelja ista kao prethodna.
    // Pouka 35: nedelja izgradnje sa drugim danom kvaliteta laganim ima jedan slot — isto odstupanje.
    const oneSlotRepeat =
      (rule.quality === 1 || b.notes.some((n) => n.startsWith(P35_DROP))) &&
      slotDose(b, 'q1')?.step === 'repeat' &&
      b.notes.some((n) => n.includes('ponovljen'));
    if (hasQuality(b) && qualityKey(a0) === qualityKey(b) && !oneSlotRepeat)
      err('IDENTICAL_WEEKS', `Isti kvalitet kao nedelja ${wl(a0.index)} (D12).`, b.index);
    // D12/D22: baza bez platoa (tvrdo) — T slota raste ili, kad sledeći nivo ne staje, menja strukturu.
    if (a0.phase === 'base' && b.phase === 'base' && !dropped) {
      const ta = slotDose(a0, tSlot);
      const tb = slotDose(b, tSlot);
      if (ta && tb) {
        const nl = nextLevel(ta.ladder as LadderId, ta.doseM, rule.beginner);
        const blocked = !nl || doseOf(nl) > capM('T', b.targetKm);
        // Odstupanje D31: početnik ponavlja T 1,5 km (druga struktura ne postoji, D10) uz napomenu.
        const onlyStructure =
          rule.beginner &&
          oneSlotRepeat &&
          tb.doseM === ta.doseM &&
          !structuresForDose(ta.ladder as LadderId, ta.doseM).some(
            (x) => !sameStructure(x, ta.structure)
          );
        const ok =
          tb.doseM > ta.doseM ||
          (blocked && (!sameStructure(ta.structure, tb.structure) || onlyStructure));
        if (!ok)
          err(
            'BASE_PLATEAU',
            `Baza: T doza ${tb.doseM} m bez rasta ili druge strukture (D12).`,
            b.index
          );
      }
    }
  }

  // --- D16: početni nivo (prva nedelja slota; I i RP na prvoj nedelji faze; RP i dalje ≥ poslednje I).
  // D28: početnik — početni nivo je prvi nivo lestvice.
  const startM = (ladder: LadderId, targetKm: number): number => {
    const cap = capM(zoneOf(ladder), targetKm);
    const lv = ladderLevels(ladder, rule.beginner).map(doseOf);
    if (rule.beginner) return lv[0]!;
    return lv.filter((m) => m <= P.startLevel.capShare * cap + EPS).pop() ?? lv[0]!;
  };
  let lastWeek: Record<'q1' | 'q2', PlanWeek | null> = { q1: null, q2: null };
  let skip = { q1: false, q2: false };
  for (const c of chain) {
    if (c === 'restart')
      [lastWeek, skip] = [
        { q1: null, q2: null },
        { q1: false, q2: false }
      ];
    if (c === 'unknown')
      [lastWeek, skip] = [
        { q1: null, q2: null },
        { q1: true, q2: true }
      ];
    if (typeof c === 'string') continue;
    const b = c;
    for (const role of ['q1', 'q2'] as const) {
      const db = slotDose(b, role);
      if (!db) continue;
      const a = lastWeek[role];
      lastWeek[role] = b;
      if (skip[role]) {
        skip[role] = false;
        continue;
      }
      if ((a && a.phase === b.phase) || db.step === 'drop') continue;
      const ladder = db.ladder as LadderId;
      const da = a ? slotDose(a, role) : null;
      const carry = da !== null && carries(da.ladder as LadderId, ladder);
      // Ista lestvica ili T cruise posle T kontinuiranog (ista zona): nije početni nivo.
      if (da && (da.ladder === ladder || (carry && zoneOf(da.ladder) === zoneOf(ladder)))) continue;
      let want = startM(ladder, b.targetKm);
      // Nova zona sa prenosom (RP posle I, kod 3 dana posle T): najmanji nivo ≥ max(D16, poslednja doza).
      if (da && carry) {
        const lv = ladderLevels(ladder, rule.beginner)
          .map(doseOf)
          .find((m) => m >= Math.max(want, da.doseM));
        if (lv === undefined || lv > capM(zoneOf(ladder), b.targetKm)) continue;
        want = lv;
      }
      if (db.doseM !== want)
        err(
          'START_LEVEL',
          `${role}: početni nivo ${ladder} ${db.doseM} m ≠ ${want} m (${rule.beginner ? 'prvi nivo, D28' : '≤ 60 % plafona, D16'}).`,
          b.index
        );
    }
  }

  // --- D28/D31: početnik — posle uvoda nedelja izgradnje bez kvaliteta samo kad ni T 1,5 km (prvi nivo
  // lestvice T kontinuirano početnika) ne staje u plafon D11 (odstupanje, napomena).
  for (const w of steady)
    if (noQuality(w)) {
      const t = P.beginner.tFirstKm;
      if (
        !firstLevelOverCap('T_continuous', w.targetKm, true) ||
        !w.notes.some((n) => n.includes('Bez kvaliteta'))
      )
        err(
          'BUILD_NO_QUALITY',
          `Početnik: nedelja bez kvaliteta, a T ${t} km staje u plafon (D28, D31).`,
          w.index
        );
      else
        warn(
          'BUILD_NO_QUALITY',
          `Nedelja bez kvaliteta: ni T ${t} km ne staje u plafon ${P.caps.T * 100} % cilja ${w.targetKm} km (D11 ispred D28, D31).`,
          w.index
        );
    }

  // --- D5 sadržaj rasterećenja, D7 taper. Poslednja doza slota iz poslednje nedelje izgradnje koja ga ima
  // (D27, D28). Segment 04: stanje doze menjaju samo nedelje izgradnje bez ograničenja kvaliteta (A4/A9);
  // nov start ga briše (A3); posle mešovite nedelje doza rasterećenja/tapera i dugi rasterećenja se ne
  // proveravaju dok ih nova nedelja ne odredi. Ograničenje 'none' → bez kvaliteta; 'one' → jedan kvalitet
  // (rasterećenje: T doza D5, i na drugom danu kvaliteta kad je dan slota u zabrani; taper: samo RP).
  let seenSteady = false;
  let lastSlot: Record<'q1' | 'q2', Dose | null> = { q1: null, q2: null };
  /** D31: poslednja doza u zoni T iz ne-rasteretne nedelje izgradnje (rasterećenje i taper početnika). */
  let lastTDose = 0;
  /** Stanje doze slota poznato (posle mešovite nedelje nije, dok ga nedelja izgradnje ne odredi — 06f, pouka 35:
      nedelja pouke 35 ne određuje drugi slot). */
  let slotKnown = { q1: true, q2: true };
  let lastLong10: number | null = null;
  let longKnown = true;
  const tFirstM = Math.round(P.beginner.tFirstKm * 1000);
  const noneQ = (w: PlanWeek): boolean =>
    w.limits?.quality === 'none' || w.notes.some((n) => n.includes('nedelja bez kvaliteta'));
  const otherSlot = (r: 'q1' | 'q2'): 'q1' | 'q2' => (r === 'q1' ? 'q2' : 'q1');
  for (const w of weeks) {
    if (doseRestarts.has(w.index))
      [lastSlot, lastTDose, slotKnown] = [{ q1: null, q2: null }, 0, { q1: true, q2: true }];
    const long = w.days.find((d) => d.role === 'long');
    const pk = pw(w);
    const rest = restOf(w);
    // A5 (10k-v2.5.2, pouka 34): umor pre starta — referenca prinudnog rasterećenja (dugi, doza) je nedelja 1
    // generatora bez činjenica, iz koraka (isto što čita konstruktor).
    const ref = steps.find((x) => x.preStart && deloadWeekOf(x) === w.index)?.preStart;
    if (w.deload && (seenSteady || ref) && checked(w)) {
      // D5/D18: poslednja doza T slota, min 2,0 km; D31 početnik: poslednja T doza, min 1,5 km.
      const lastT = ref ? ref.tDoseM : rule.beginner ? lastTDose : (lastSlot[tSlot]?.doseM ?? 0);
      const t =
        slotDose(w, tSlot) ??
        (reducedQ(w) && rule.quality === 2 ? slotDose(w, otherSlot(tSlot)) : null);
      const ladder = deloadLadder(w.phase);
      const want = expectedReduced(
        ladder,
        lastT,
        P.deload.tShare,
        rule.beginner ? tFirstM : Math.round(P.deload.tMinKm * 1000),
        rule.beginner
      );
      const nQuality = w.days.filter((d) => d.workout.kind === 'quality').length;
      const nTest = w.days.filter((d) => d.workout.kind === 'test').length;
      if (noneQ(w)) {
        if (nQuality !== 0 || nTest !== 0)
          err('DELOAD_CONTENT', 'Rasterećenje bez kvaliteta (adaptacija, A3/A4/A9).', w.index);
      }
      // D27: u nedelji testa test zamenjuje kvalitet rasterećenja (bez plafona D11).
      else if (w.test) {
        if (nQuality !== 0 || nTest !== 1)
          err('DELOAD_CONTENT', 'Rasterećenje sa testom: test umesto kvaliteta (D27).', w.index);
      } else if (!slotKnown[tSlot]) {
        if (nQuality > 1) err('DELOAD_CONTENT', 'Rasterećenje: najviše 1 kvalitet (D5).', w.index);
      }
      // Odstupanje D5 (D11 ispred D5): kad ni T doza po pravilu ne staje u plafon, rasterećenje je bez
      // kvaliteta (uz napomenu).
      else if (want > capM('T', w.targetKm)) {
        if (nQuality !== 0 || !w.notes.some((n) => n.includes('bez kvaliteta')))
          err(
            'DELOAD_CONTENT',
            `Rasterećenje: T ${want} m > plafon ${capM('T', w.targetKm)} m → bez kvaliteta, uz napomenu (D11 ispred D5).`,
            w.index
          );
        else
          warn(
            'DELOAD_NO_QUALITY',
            `Rasterećenje bez kvaliteta: T ${want} m ne staje u plafon.`,
            w.index
          );
      } else if (nQuality !== 1 || !t || t.doseM !== want)
        err(
          'DELOAD_CONTENT',
          `Rasterećenje: 1 kvalitet T ${want} m (≈ 60 % od ${lastT} m) (D5).`,
          w.index
        );
      const hurt = long !== undefined && painOf(w).has(long.date);
      const refLong10 = ref ? to10(ref.longKm) : lastLong10;
      if (long && refLong10 !== null && (ref || longKnown) && !hurt) {
        // Odstupanje A9 (D13 ispred D5): posle smanjenja obima dugi ≥ 3 km.
        const want10 = Math.max(
          w.index >= reducedFrom ? to10(P.lengths.easyMinKm) : 0,
          Math.min(
            Math.floor(P.deload.longFactor * refLong10 + 1e-9),
            longCap10(to10(w.targetKm), rule, pk)
          )
        );
        const l10 = to10(long.workout.km);
        // Odstupanje D27 ispred D5: u rasterećenju sa testom dugi je skraćen samo toliko da lagani ostanu
        // ≥ 3 km (lagani tada na 3,0–3,1 km), uz napomenu.
        const easyMax = Math.max(
          0,
          ...w.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km))
        );
        // A9 (odstupanje): posle smanjenja obima isto pravilo i bez testa.
        const shortened =
          (w.test || w.index >= reducedFrom) &&
          l10 < want10 &&
          easyMax <= to10(P.lengths.easyMinKm) + 1 &&
          w.notes.some((n) => n.includes('skraćen'));
        if (shortened)
          warn(
            w.test ? 'TEST_DELOAD_LONG' : 'ADAPT_DELOAD_LONG',
            `Rasterećenje sa testom: dugi ${long.workout.km} km < ${want10 / 10} km da lagani ostanu ≥ ${P.lengths.easyMinKm} km (D27 ispred D5).`,
            w.index
          );
        else if (l10 !== want10)
          err(
            'DELOAD_LONG',
            `Dugi rasterećenja ${long.workout.km} km ≠ ${want10 / 10} km (D5).`,
            w.index
          );
      }
      if (
        w.days.filter((d) => d.role === 'easy').length !==
        input.runDays.length - rest.size - (long ? 1 : 0) - nQuality - nTest
      )
        err(
          'DELOAD_CONTENT',
          'Rasterećenje: osim kvaliteta i dugog svi dani su lagani (D5).',
          w.index
        );
    }
    if (w.phase === 'taper' && seenSteady && checked(w)) {
      let rp = slotDose(w, 'q1');
      let t = slotDose(w, 'q2');
      // A4/A9: jedini kvalitet tapera (RP) na drugom danu kvaliteta kad je dan Q1 u zabrani.
      if (reducedQ(w) && !rp && t?.zone === 'RP') [rp, t] = [t, null];
      const t7 = P.taper;
      const wantRp = expectedReduced(
        'RP',
        lastSlot.q1?.doseM ?? 0,
        t7.doseShare,
        t7.rpMin.reps * t7.rpMin.repM
      );
      const wantT = expectedReduced(
        'T_cruise',
        lastSlot.q2?.doseM ?? 0,
        t7.doseShare,
        Math.round(t7.tMinKm * 1000)
      );
      // D18: 3 dana — taper ima samo RP. Odstupanje D7 (4–6 dana): „samo RP" uz napomenu, kad sa RP i T
      // nijedan cilj nije izvodljiv (validator vidi napomenu; izvodljivost proverava konstrukcija).
      const rpOnly = rule.quality === 2 && t === null && w.notes.some((n) => n.includes('samo RP'));
      if (rpOnly)
        warn('TAPER_RP_ONLY', 'Taper samo sa RP: sa RP i T nijedan cilj nije izvodljiv.', w.index);
      const tOk =
        rule.quality === 1 || rpOnly ? t === null : !!t && t.zone === 'T' && t.doseM === wantT;
      // Odstupanje D7 (D11 ispred D7): kad ni RP doza po pravilu ne staje u plafon, taper je bez kvaliteta.
      // D31: početnik — tada T kontinuirano ≈ 60 % poslednje T doze (min 1,5 km), ako staje.
      const none = wantRp > capM('RP', w.targetKm);
      const wantT31 = expectedReduced('T_continuous', lastTDose, t7.doseShare, tFirstM, true);
      if (noneQ(w)) {
        if (rp || t) err('TAPER_QUALITY', 'Taper bez kvaliteta (adaptacija, A3/A4/A9).', w.index);
      } else if (!slotKnown.q1 || !slotKnown.q2) {
        if (reducedQ(w) && t)
          err('TAPER_QUALITY', 'Taper: najviše 1 kvalitet (adaptacija).', w.index);
      } else if (none && rule.beginner && wantT31 <= capM('T', w.targetKm)) {
        if (
          !rp ||
          t ||
          rp.ladder !== 'T_continuous' ||
          rp.doseM !== wantT31 ||
          rp.structure.form !== 'continuous'
        )
          err(
            'TAPER_QUALITY',
            `Taper početnika: RP ${wantRp} m > plafon ${capM('RP', w.targetKm)} m → T kontinuirano ${wantT31} m (≈ 60 % poslednje T doze ${lastTDose} m, min ${tFirstM} m) (D31).`,
            w.index
          );
      } else if (none) {
        if (rp || t || !w.notes.some((n) => n.includes('bez kvaliteta')))
          err(
            'TAPER_QUALITY',
            `Taper: RP ${wantRp} m > plafon ${capM('RP', w.targetKm)} m → bez kvaliteta, uz napomenu (D11 ispred D7).`,
            w.index
          );
        else
          warn(
            'TAPER_NO_QUALITY',
            `Taper bez kvaliteta: RP ${wantRp} m ne staje u plafon.`,
            w.index
          );
      } else if (!rp || rp.zone !== 'RP' || rp.doseM !== wantRp || !tOk)
        err(
          'TAPER_QUALITY',
          rule.quality === 1
            ? `Taper: jedan kvalitet RP ${wantRp} m (≈ 60 % poslednje doze) (D7, D18).`
            : `Taper: RP ${wantRp} m i T ${wantT} m (≈ 60 % poslednje doze) (D7).`,
          w.index
        );
      // D7: najduži dugi nedelja pre tapera — ista definicija kao konstruktor (lengths.longestLong10).
      const longest10 = longestLong10(weeks.slice(0, w.index - 1));
      if (long && to10(long.workout.km) > Math.floor(t7.longFactor * longest10 + 1e-9))
        err(
          'TAPER_LONG',
          `Dugi tapera ${long.workout.km} km > 0,75 × najduži ${longest10 / 10} km (D7).`,
          w.index
        );
      if (w.days.length !== input.runDays.length - rest.size)
        err(
          'TAPER_DAYS',
          `Taper zadržava svih ${input.runDays.length} dana trčanja (D7).`,
          w.index
        );
    }
    // A4/A9: doza ne raste u nedelji izgradnje sa ograničenjem — najviše 1 kvalitet, doza rasterećenja
    // (T ≈ 60 % poslednje doze slota, lestvica rasterećenja faze), ili bez kvaliteta.
    if (isSteady(w) && checked(w) && reducedQ(w) && !w.test) {
      const qs = w.days.filter((d) => d.workout.kind === 'quality');
      const lastT = rule.beginner ? lastTDose : (lastSlot[tSlot]?.doseM ?? 0);
      const want = expectedReduced(
        deloadLadder(w.phase),
        lastT,
        P.deload.tShare,
        rule.beginner ? tFirstM : Math.round(P.deload.tMinKm * 1000),
        rule.beginner
      );
      const dose = qs[0]?.workout.dose;
      if (
        qs.length > (noneQ(w) ? 0 : 1) ||
        (dose &&
          (dose.ladder !== deloadLadder(w.phase) ||
            dose.doseM > capM('T', w.targetKm) ||
            (slotKnown[tSlot] && dose.doseM !== want)))
      )
        err(
          'ONE_QUALITY',
          `Nedelja sa ograničenjem: najviše 1 kvalitet doze rasterećenja T ${want} m (A4, A9).`,
          w.index
        );
    }
    if (isSteady(w)) {
      seenSteady = true;
      if (long) [lastLong10, longKnown] = [to10(long.workout.km), checked(w)];
      if (!checked(w) && !reducedQ(w)) {
        slotKnown = { q1: false, q2: false };
        // Prošlost = upisani dani (10k-v2.5.1, A11): poslednja T doza (D31) iz upisanih dana mešovite nedelje,
        // isto kao konstruktor.
        for (const r of ['q1', 'q2'] as const) {
          const d = slotDose(w, r);
          if (d?.zone === 'T') lastTDose = d.doseM;
        }
      } else if (!reducedQ(w)) {
        for (const r of ['q1', 'q2'] as const) {
          const d = slotDose(w, r);
          // 06f (pouka 35): drugi slot nedelje pouke 35 je lagan — njegovo stanje ostaje nepoznato.
          if (d || r === 'q1' || !w.notes.some((n) => n.startsWith(P35_DROP))) slotKnown[r] = true;
          lastSlot[r] = d ?? lastSlot[r];
          if (d?.zone === 'T') lastTDose = d.doseM;
        }
      }
    }
  }

  // --- D8 trkačka nedelja. Segment 04: mešovita — samo dan trke; dani odmora (A4) otpadaju; oštrenje ne
  // na danu zabrane kvaliteta i otpada uz napomenu A9 (trkačka ≤ taper); dan pred trku u periodu bola bez
  // ubrzanja; mešovit taper → provere zavisne od tapera se preskaču.
  const rw = weeks[N - 1]!;
  const taperW = weeks.find((w) => w.phase === 'taper');
  const taperOk = !taperW || checked(taperW);
  if (rw.phase === 'race' && !checked(rw)) {
    const rd = rw.days.find((d) => d.role === 'race');
    if (!rd || rd.date !== input.raceDate || rd.countsToWeek)
      err('RACE_DAY', 'Trka je jednom, na dan trke, van obima (D8).', rw.index);
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
        !raceSeg ||
        raceSeg.km !== q.raceKm ||
        k[0]?.kind !== 'warmup' ||
        k[0].sec !== q.raceWarmupSec ||
        k[k.length - 1]?.kind !== 'cooldown' ||
        k[k.length - 1]!.sec !== q.raceCooldownSec
      )
        err('RACE_DAY', 'Trka: 10 km + WU 15 min + CD 10 min, van obima (D8).', rw.index, rd.date);
    }
    // D20: dana sa trkom = min(broj dana, 5); otpada prvo dan dugog, pa najraniji lagan dan šablona.
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
    // D23 (10k-v2.5.1): taper skraćen danima odmora/bola — dani koji postaju odmor (isti podatak kao
    // konstrukcija, week.raceWeekRest; bez oštrenja, A9 ga ukida pre toga). 06g: i kad je taper mešovit — konstruktor
    // čita upisan taper (written.ts), isti koji vidi validator.
    const taperW0 = weeks.find((w) => w.phase === 'taper');
    const taperEasy0 = (taperW0?.days ?? [])
      .filter((d) => d.role === 'easy')
      .map((d) => to10(d.workout.km));
    const restD23 =
      steps.length > 0 && taperW0 && !others.some((d) => d.role === 'sharpener')
        ? raceWeekRest(
            runsR,
            race,
            painOf(rw),
            taperEasy0.length > 0 ? Math.min(...taperEasy0) : Infinity,
            pw(rw),
            to100(taperW0.plannedKm)
          )
        : [];
    const wantDays = runsR.filter((d) => !restD23.includes(d));
    if (JSON.stringify(others.map((d) => d.date).sort()) !== JSON.stringify(wantDays))
      err(
        'RACE_WEEK',
        `Trkačka nedelja: dani ${others.map((d) => d.weekday).join(', ')} ≠ D20 (${wantDays.map(weekdayOf).join(', ')}).`,
        rw.index
      );
    const sharp = others.filter((d) => d.role === 'sharpener');
    // D31: T tapera početnika nije RP doza. A4/A9: RP tapera i na drugom danu kvaliteta.
    const taperRpM =
      taperW?.days.map((d) => d.workout.dose).find((x) => x?.zone === 'RP')?.doseM ?? 0;
    const full = q.sharpener.reps * q.sharpener.repM;
    // Oštrenje ≤ RP doza tapera: taper bez RP (odstupanje D7) → bez oštrenja.
    const reps =
      taperRpM >= full
        ? q.sharpener.reps
        : taperRpM >= q.sharpenerSmallReps * q.sharpener.repM
          ? q.sharpenerSmallReps
          : 0;
    // Najkasniji dan ≥ 3 dana pre trke, nesusedan poslednjem zahtevnom danu prethodne nedelje (D8 + D9).
    const prevHard = N > 1 ? weeks[N - 2]!.days.filter((d) => d.hard).pop()?.date : undefined;
    const bannedR = new Set(rw.limits?.noQuality ?? []);
    const latest = others
      .filter(
        (d) =>
          daysBetween(d.date, race) >= q.sharpenerMinGapDays &&
          (prevHard === undefined || daysBetween(prevHard, d.date) >= 2) &&
          !bannedR.has(d.date)
      )
      .map((d) => d.date)
      .sort()
      .pop();
    const sd = sharp[0];
    const st: Structure | undefined = sd?.workout.dose?.structure;
    const a9 = rw.notes.some((n) => n.includes('(A9, D23)'));
    if (sd && bannedR.has(sd.date))
      err('LIMITS', 'Oštrenje na dan zabrane kvaliteta (A3/A4).', rw.index, sd.date);
    if (!taperOk) {
      // Mešovit taper: oštrenje i lagani trkačke nedelje zavise od konstruisanog tapera.
    }
    // Odstupanje D8: nijedan dan ≥ 3 dana pre trke → bez oštrenja. A9: oštrenje otpada (trkačka ≤ taper).
    else if (latest === undefined || reps === 0 || (a9 && sharp.length === 0)) {
      if (sharp.length > 0)
        err(
          'RACE_SHARPENER',
          'Oštrenje bez dana ≥ 3 dana pre trke ili bez RP u taperu (D8).',
          rw.index
        );
    } else if (
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
    // D23: lagan = min(35 min E, najkraći lagan tapera); kraći se zadaje u km.
    const taperWeek = weeks.find((w) => w.phase === 'taper');
    const taperEasy = (taperWeek?.days ?? [])
      .filter((d) => d.role === 'easy')
      .map((d) => to10(d.workout.km));
    const easyCap10 = taperEasy.length > 0 ? Math.min(...taperEasy) : Infinity;
    const easyByKm = easyCap10 * 10 < Math.round((q.otherEasySec * 100) / midEasy(pw(rw)));
    const painR = painOf(rw);
    for (const d of others) {
      if (d.role === 'sharpener') continue;
      const gap = daysBetween(d.date, race);
      const segs = d.workout.segments;
      const hurt = painR.has(d.date);
      if (gap === 1) {
        const strides = segs.filter((x) => x.kind === 'stride');
        const easy = segs.filter((x) => x.kind === 'easy');
        if (
          d.role !== 'eve' ||
          d.workout.sec > q.eveMaxSec ||
          easy.length !== 1 ||
          easy[0]!.sec !== q.eveEasySec ||
          strides.length !== (hurt ? 0 : q.eveStrides.reps) ||
          strides.some((x) => x.sec !== q.eveStrides.sec)
        )
          err('RACE_EVE', 'Dan pred trku: 20 min E + 4 × 20 s, ≤ 30 min (D8).', rw.index, d.date);
      } else if (
        d.role !== 'easy' ||
        segs.length !== 1 ||
        segs[0]!.zone !== 'E' ||
        (!hurt &&
          taperOk &&
          (easyByKm ? to100(segs[0]!.km) !== easyCap10 * 10 : segs[0]!.sec !== q.otherEasySec))
      )
        err(
          'RACE_WEEK_EASY',
          easyByKm
            ? `Ostali dani trkačke nedelje: ${easyCap10 / 10} km E = najkraći lagan tapera (D23).`
            : 'Ostali dani trkačke nedelje: 35 min E (D8, D23).',
          rw.index,
          d.date
        );
    }
    // D23: trkačka nedelja (bez trke) ≤ taper.
    // 06g (pouke 23 i 30): kad su posle D23 ostali samo dan pred trku i trka, konstruktor nema šta da ukloni —
    // upozorenje (isti predikat kao konstruktor, week.raceWeekEveOnly).
    if (taperWeek && taperOk && to100(rw.plannedKm) > to100(taperWeek.plannedKm)) {
      if (restD23.length > 0 && raceWeekEveOnly(rw.days))
        warn(
          'RACE_WEEK_OVER_TAPER_EVE',
          `Trkačka nedelja ${rw.plannedKm} km > taper ${taperWeek.plannedKm} km — ostali su samo dan pred trku i trka (D23, pouka 30).`,
          rw.index
        );
      else
        err(
          'RACE_WEEK_OVER_TAPER',
          `Trkačka nedelja ${rw.plannedKm} km > taper ${taperWeek.plannedKm} km (D23).`,
          rw.index
        );
    }
    if (to10(rw.targetKm) !== Math.round(to100(rw.plannedKm) / 10))
      err('RACE_WEEK', 'Cilj trkačke nedelje = planirano (D8).', rw.index);
  }

  // --- D6 obim: cilj po pravilu, izvodljiv cilj samo uz oznaku i napomenu.
  const start10 = startKm10(input.currentWeeklyKm);
  const cap10 = peakCap10(start10, rule);
  if (to10(plan.startKm) !== start10) err('VOLUME_START', 'Start ≠ trenutni obim (D6).');
  if (to10(plan.peakCapKm) !== cap10)
    err(
      'VOLUME_PEAK',
      'Granica izgradnje ≠ min(1,4×, +15, max nedelje D17) (D6; početnik 1,3×, +10, D28).'
    );
  // Segment 04: isti rekurent kao konstruktor (volume.adaptNominal10: cilj koraka, povratni rast, vrh od
  // novog starta, taper od vrha posle poslednjeg smanjenja, donja granica); izvodljiv cilj adaptacije samo
  // naniže. Posle mešovite nedelje čiji cilj nije po pravilu (npr. prošlost plana starije verzije, A15)
  // provera čeka sledeći cilj koraka.
  const av = steps.length > 0 ? adaptVolume(steps) : null;
  let h = initialAdaptHistory(cap10);
  let capacityCut = false;
  let known = true;
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    if (av) {
      h = enterWeek(h, w, av, rule);
      if (av.reset.has(w.index) && isBuildPhase(w.phase)) known = true;
    }
    const lastBuild = h.lastBuild10;
    const peak = h.peak10;
    const { nominal, downOnly } = av
      ? adaptNominal10(w, h, start10, rule, av)
      : {
          nominal:
            w.phase === 'taper'
              ? Math.round(P.taper.factor * peak)
              : lastBuild === null
                ? start10
                : w.deload
                  ? Math.round(P.deload.factor * lastBuild)
                  : Math.min(lastBuild + growth10(lastBuild, rule), cap10),
          downOnly: false
        };
    const t10 = to10(w.targetKm);
    if (checked(w) && known) {
      if (to10(w.nominalKm) !== nominal)
        err(
          'VOLUME_RULE',
          `Nominalni cilj ${w.nominalKm} km ≠ ${nominal / 10} km po pravilu (D6, A8).`,
          w.index
        );
      if (t10 === nominal) {
        if (w.fitted !== null)
          err('VOLUME_RULE', 'Oznaka izvodljivog cilja bez promene cilja.', w.index);
      } else if (
        w.fitted === null ||
        (w.fitted === 'down' && t10 > nominal) ||
        (w.fitted === 'up' && t10 < nominal) ||
        // Rasterećenje i taper samo naniže; rasterećenje sa testom naviše samo ispod poslednje izgradnje
        // (D27); cilj adaptacije i povratni rast samo naniže (A8).
        (w.fitted === 'up' &&
          (w.deload || w.phase === 'taper') &&
          !(w.deload && w.test && lastBuild !== null && t10 < lastBuild)) ||
        (w.fitted === 'up' && downOnly) ||
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
    }
    // A3/A8: granica izgradnje od novog starta; povratak sme do nivoa pre smanjenja.
    const capW = av ? h.cap10 : cap10;
    const levelW = av ? av.levelAt(w.index) : null;
    if (checked(w) && isBuildPhase(w.phase) && t10 > capW && !(levelW !== null && t10 <= levelW))
      err(
        'VOLUME_PEAK',
        `Cilj ${w.targetKm} km > granica izgradnje ${capW / 10} km (D6; nov start: A3).`,
        w.index
      );
    if (isSteady(w) && w.fitted === 'down') capacityCut = true;
    if (av) h = leaveWeek(h, w, t10, av);
    else if (isSteady(w)) {
      h.lastBuild10 = t10;
      h.peak10 = Math.max(peak, t10);
    }
    if (!checked(w) && to10(w.nominalKm) !== nominal) known = false;
  }
  if (to10(plan.peakKm) !== h.peak10) err('VOLUME_PEAK', 'Vrh plana ≠ najveći cilj izgradnje.');
  if (capacityCut)
    warn(
      'CAPACITY_LIMITED',
      capacityMessage(
        input.runDays.length,
        input.currentWeeklyKm,
        rule,
        capacityLimits(weeks, rule, p)
      )
    );

  // --- D26: osnova tempa — rezultat ≤ 84 dana sa VDOT ≥ 30, inače plan po osećaju.
  const res = input.recentResult;
  const resultOk =
    !!res &&
    mustDay(input.startDate) - mustDay(res.date) <= P.input.resultMaxAgeDays &&
    round1(vdotFromResult(res.distanceM, res.timeSec)) >= P.input.vdotMin;
  // Segment 04 (A1): osnova tempa plana = osnova poslednje nedelje (budućnost).
  const basisN = pace ? basisAt(pace, steps, N) : resultOk ? 'result' : 'feel';
  if (plan.paceBasis !== basisN)
    err(
      'PACE_BASIS',
      `Osnova tempa ${plan.paceBasis} ≠ ${basisN} (D26: rezultat ≤ ${P.input.resultMaxAgeDays} dana i VDOT ≥ ${P.input.vdotMin}; A1).`
    );

  // --- D2 tempo, D3 cilj; D26 plan po osećaju: E = lagan tempo ± 15 s, zone iz procene VDOT-a, bez
  // prognoze i ocene cilja. Segment 04 (A1): tempo plana = tempo poslednje nedelje; ocena cilja za nedelje
  // od rezultata do trke; nov start sa < 8 nedelja → „orijentir" (A3).
  if (pace) {
    const pN = pacesAt(pace, steps, N);
    if (JSON.stringify(pN) !== JSON.stringify(p) || plan.vdot !== pN.vdot)
      err('PACES', 'Tempo plana ≠ tempo poslednje nedelje iz koraka (A1).');
    const last = [...steps].reverse().find((x) => x.vdot !== null);
    if (basisN === 'feel') {
      if (plan.predicted10kSec !== null) err('PACES', 'Plan po osećaju nema prognozu 10K (D26).');
      if (plan.goal) err('GOAL', 'Plan po osećaju nema ocenu cilja (posle testa, D26).');
    } else {
      if (plan.predicted10kSec !== raceTimeForVdot(pN.vdot, P.paces.raceDistanceM))
        err('PACES', 'Prognoza 10K ≠ VDOT plana (D2, A1).');
      if (input.goalTimeSec) {
        const g = assessGoal(pN.vdot, input.goalTimeSec, last ? N - last.fromWeek + 1 : N);
        const orientation = steps.some((x) => x.orientation);
        if (
          !plan.goal ||
          plan.goal.status !== (orientation ? 'orientation' : g.status) ||
          plan.goal.vdotGap !== g.vdotGap
        )
          err('GOAL', 'Ocena cilja ne odgovara pravilu D3 (A1, A3).');
        else if (plan.goal.status === 'unrealistic') warn('GOAL_UNREALISTIC', g.message);
      } else if (plan.goal) err('GOAL', 'Bez cilja nema ocene (D3).');
    }
  } else if (feel) {
    const easy = input.easyPaceSecPerKm;
    if (typeof easy !== 'number') err('PACES', 'Plan po osećaju mora imati lagan tempo (D26).');
    else {
      const f = feelPaces(easy);
      if (JSON.stringify(f.paces) !== JSON.stringify(p))
        err('PACES', 'Tempo ne odgovara laganom tempu i proceni VDOT-a (D26).');
      if (f.capped)
        warn(
          'VDOT_ESTIMATE_CAPPED',
          `Procena VDOT ${round1(vdotFromEasyPace(easy))} > ${P.feel.vdotMax}: orijentir na ${P.feel.vdotMax}; za ovaj tempo unesi rezultat (D26).`
        );
    }
    if (plan.predicted10kSec !== null) err('PACES', 'Plan po osećaju nema prognozu 10K (D26).');
    if (plan.goal) err('GOAL', 'Plan po osećaju nema ocenu cilja (posle testa, D26).');
  } else {
    if (!res) err('PACES', 'Plan sa rezultatom mora imati rezultat (D1).');
    else if (
      JSON.stringify(pacesFromVdot(vdotFromResult(res.distanceM, res.timeSec))) !==
      JSON.stringify(p)
    )
      err('PACES', 'Tempo ne odgovara VDOT-u iz rezultata (D2).');
    if (plan.predicted10kSec !== raceTimeForVdot(p.vdot, P.paces.raceDistanceM))
      err('PACES', 'Prognoza 10K ≠ VDOT plana (D2).');
    if (input.goalTimeSec) {
      const g = assessGoal(plan.vdot, input.goalTimeSec, N);
      if (!plan.goal || plan.goal.status !== g.status || plan.goal.vdotGap !== g.vdotGap)
        err('GOAL', 'Ocena cilja ne odgovara pravilu D3.');
      else if (g.status === 'unrealistic') warn('GOAL_UNREALISTIC', g.message);
    } else if (plan.goal) err('GOAL', 'Bez cilja nema ocene (D3).');
  }

  // --- D27: plan po osećaju ima tačno jedan test, u poslednjoj nedelji baze (dan: ROLES); plan sa
  // rezultatom nijedan; D32: početnik nijedan.
  const withTest = feel && rule.feelTest;
  const tw = withTest ? testWeekOf(phasesOf(N)) : 0;
  const tests = weeks.flatMap((w) => w.days.filter((d) => d.role === 'test').map(() => w.index));
  if (pace) {
    // Segment 04 (A13): najviše jedan test, samo plan po osećaju koji nije početnik, u nedelji izgradnje po
    // osećaju; oznaka nedelje ⇔ dan testa (mešovite nedelje: samo dan).
    const tw0 = tests[0];
    // A13b (10k-v2.8.0): zaštićen dan testa (≤ asOf, zaključan, urađen) je upisan kakav jeste (A11) — ne sudi se po
    // osnovi tempa ni fazi nedelje (npr. nov rezultat posle zaključanog testa); najviše jedan test važi i dalje.
    const tDay = weeks.flatMap((w) => w.days).find((d) => d.role === 'test');
    const bad =
      tests.length > 1 ||
      (tests.length === 1 && (pace.kind !== 'feel' || !rule.feelTest)) ||
      (tw0 !== undefined &&
        !(tDay && protectedDay(tDay)) &&
        (!feelW({ index: tw0 }) || !isBuildPhase(weeks[tw0 - 1]!.phase)));
    if (bad)
      err('TEST', 'Adaptiran plan: najviše jedan test, u nedelji izgradnje po osećaju (A13, D32).');
    for (const w of weeks)
      if (
        checked(w) &&
        ((w.test === true) !== tests.includes(w.index) || (w.test !== undefined && w.test !== true))
      )
        err('TEST', 'Oznaka nedelje testa ≠ dan testa (A13).', w.index);
  } else if (JSON.stringify(tests) !== JSON.stringify(withTest ? [tw] : []))
    err(
      'TEST',
      withTest
        ? `Plan po osećaju: tačno jedan test, u poslednjoj nedelji baze ${wl(tw)} (sada: ${tests.map(wl).join(', ') || 'nijedan'}) (D27).`
        : feel
          ? 'Početnik nema test (D32).'
          : 'Plan sa rezultatom nema test (D27).'
    );
  if (!pace)
    for (const w of weeks)
      if ((w.test === true) !== (w.index === tw) || (w.test !== undefined && w.test !== true))
        err('TEST', `Oznaka nedelje testa ne odgovara D27.`, w.index);

  // --- Segment 04 (A3, A4): ograničenja koraka po datumima (i u mešovitim nedeljama; zaključan dan i trka
  // izuzeti) — dan odmora bez treninga; zabrana kvaliteta / bol / odmor → bez kvaliteta, testa i oštrenja;
  // bol → bez ubrzanja.
  const locked = new Set(ad?.lockedDayIds ?? []);
  for (const w of weeks)
    for (const d of w.days) {
      if (steps.length === 0 || locked.has(d.date) || d.role === 'race') continue;
      const inAny = (pick: (x: (typeof steps)[number]) => readonly (DateRangeLike | null)[]) =>
        steps.some((x) => pick(x).some((r) => inRange(d.date, r)));
      if (inAny((x) => [x.rest])) err('LIMITS', 'Trening na dan odmora (A4).', w.index, d.date);
      const hard = d.workout.kind === 'quality' || d.workout.kind === 'test';
      if (hard && inAny((x) => [...x.noQuality, x.pain, x.rest]))
        err('LIMITS', 'Kvalitet ili test na dan zabrane kvaliteta (A3/A4).', w.index, d.date);
      if (inAny((x) => [x.pain]) && d.workout.segments.some((x) => x.kind === 'stride'))
        err('LIMITS', 'Ubrzanja u periodu bola (A4).', w.index, d.date);
    }
  return out;
}

type DateRangeLike = { from: string; to: string };
