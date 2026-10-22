/* Maraton v2 → aplikacija: plan v2 → plan formata razmene (nedelje, dani, struktura, meta), oznaka politike i faza nedelje.

   - Nedelja aplikacije = nedelja v2 (početak `startDate` nedelje v2, 7 dana; dan bez treninga je odmor). `dow` je pomak od
     početka nedelje (0–6), ID dana `g{nedelja}d{dow + 1}` kao kod ostalih generatora.
   - Dan nosi strukturu v2 doslovno (`structure`: blokovi, RPE plana po osećaju, test 5 km); `desc` je samo naslov. `session`
     se ne pravi: prikaz i sat čitaju strukturu, a v2 nema redove predikcije (`pred` prazan).
   - Trka (sa svojim WU/CD) je VAN nedeljnog obima kao u v2 (`countsToWeek`): km dana trke su ceo dan, a prikaz je ne sabira
     u nedelju (`day/stats.outsideWeekVolume` za dan trke sa strukturom): trka 42,2 km + WU (M8).
   - `meta` nosi SAMO ono što v2 zna; polja formata koja v2 nema (intenzitet, „predviđeno" vreme kao cilj, procena napretka)
     su izostavljena — čitaoci aplikacije ih proveravaju (`raceRefs`, `planBaselineVdot`). Ceo izlaz v2 je u `marathonV2`.
   Jedine odluke adaptera (mapa faze, ime vrste, tip dana, oblik dana) imaju po jedno mesto: ovaj fajl. */

import { checkInput } from '../input.ts';
import { MARATHON_V2_POLICY as P } from '../policy.ts';
import { basisAt, pacesAt } from '../steps.ts';
import type { GoalAssessment, MarathonV2Plan, Paces, Phase, PlanDay } from '../types.ts';
import { technicalNote } from '../volume.ts';
import { addDays, diffDays } from './date.ts';
import { workoutStructure } from './structure.ts';
import type {
  GoalAssessmentView,
  PlanLike,
  PolicyStatus,
  RestDay,
  StoredDay,
  StoredPlan,
  StoredWeek,
  StructuredDay,
  StructuredDayTag,
  MarathonV2Meta,
  WeekPhase
} from './types.ts';

export const POLICY_ID = P.id;
export const POLICY_VERSION = P.version;
/** v2 nema plan pre oznake politike: svaki v2 plan nosi `marathon-v2`; plan bez oznake je maraton v1 (`legacy-marathon`). */
export const LEGACY_POLICY_ID = 'legacy-marathon';
/** Verzije koje trenutni kod ume da prikaže i adaptira (istorijske implementacije v2 se ne čuvaju): sve koje su mogle
 *  biti sačuvane posle MAR-05 (aplikacija je od MAR-05 pisala samo `marathon-v2.3.1`), 2.4.0, 2.4.1, 2.4.2, 2.5.0 i tekuća. Sačuvan stariji plan
 *  ostaje plan maratona v2; prilagođavanje ga gradi tekućim pravilima, a rezultat nosi tekuću oznaku. Svaka druga
 *  verzija je „unknown" (UNKNOWN_POLICY). */
export const KNOWN_VERSIONS: readonly string[] = [
  ...new Set([
    'marathon-v2.3.1',
    'marathon-v2.4.0',
    'marathon-v2.4.1',
    'marathon-v2.4.2',
    'marathon-v2.5.0',
    P.version
  ])
];

/** JEDNA mapa faze za prikaz (odluka adaptera): baza → BAZA, razvoj → RAZVOJ, specifična faza (najspecifičniji rad za
 *  tempo trke) → VRHUNAC, taper → TAPER, trkačka nedelja → TRKA; rasterećenje (bilo koje faze) → DELOAD. */
const PHASE: Readonly<Record<Phase, WeekPhase>> = {
  base: 'BAZA',
  development: 'RAZVOJ',
  specific: 'VRHUNAC',
  taper: 'TAPER',
  race: 'TRKA'
};
const PHASES: readonly string[] = ['DELOAD', 'TRKA', 'TAPER', 'BAZA', 'RAZVOJ', 'VRHUNAC', ''];

export const phaseOf = (w: { phase: Phase; deload: boolean }): WeekPhase =>
  w.deload ? 'DELOAD' : PHASE[w.phase];

const GOAL_LABEL: Readonly<Record<GoalAssessment['status'], string>> = {
  realistic: 'realističan',
  ambitious: 'ambiciozan',
  unrealistic: 'nerealan',
  orientation: 'orijentir'
};

/** Tip dana aplikacije iz treninga v2 (prikazna oznaka; sadržaj nosi struktura). */
export function tagOf(d: PlanDay): StructuredDayTag {
  const w = d.workout;
  switch (w.kind) {
    case 'easy':
      return 'lako';
    case 'long':
      return 'lr';
    case 'race':
      return 'trka';
    case 'test':
      return 'test';
    default:
      return w.qualityType === 'R' || w.qualityType === 'I' ? 'int' : 'tempo';
  }
}

/** Kratko ime vrste za oznaku dana i uputstvo (ključevi postojećih uputstava gde se smisao poklapa). */
export function kindOf(d: PlanDay): string {
  const w = d.workout;
  if (w.kind === 'easy') return 'Lako';
  if (w.kind === 'long') return 'Dugo (LR)';
  if (w.kind === 'race') return 'TRKA';
  if (w.kind === 'test') return 'Test';
  switch (w.qualityType) {
    case 'R':
      return 'Repeticije';
    case 'I':
      return 'Intervali';
    case 'T_continuous':
      return 'Tempo';
    case 'T_cruise':
      return 'Tempo isprekidan';
    default:
      // MP i oštrenje MP (M8, M10): postojeće uputstvo maratonskog tempa.
      return 'Maratonski tempo';
  }
}

/** Dan generatora (dow 1–7 od početka nedelje, kao izlaz ostalih generatora pre upisa). */
type GeneratedDay = StructuredDay | RestDay;
export interface GeneratedWeek {
  w: number;
  /** Planirani obim nedelje v2 (dani koji se računaju u obim; trka van obima). */
  vol: number;
  days: GeneratedDay[];
  deload: boolean;
  focus: string;
  taper?: true;
}

const rest = (dow: number): RestDay => ({ dow, rest: true, desc: null });

/** Tempo i osnova nedelje za strukturu (E opseg, tempo zona, šta je procena) — pouka 16: u adaptiranom planu po
 *  NEDELJI (A1 — plan po osećaju prelazi na rezultat od nedelje rezultata, pa nedelje pre nje ostaju po osećaju, a tempo
 *  posle rezultata važi tek od sledeće nedelje); bez koraka adaptacije ceo plan (bajt-isto kao generator). */
function weekPaces(plan: MarathonV2Plan): (w: number) => { paces: Paces; feel: boolean } {
  const whole = { paces: plan.paces, feel: plan.paceBasis === 'feel' };
  const steps = plan.adaptation?.steps ?? [];
  const chk = steps.length > 0 ? checkInput(plan.input) : null;
  if (!chk?.ok) return () => whole;
  const pace = chk.pace;
  const km = chk.input.currentWeeklyKm;
  return (w) => ({
    paces: pacesAt(pace, steps, w, km),
    feel: basisAt(pace, steps, w) === 'feel'
  });
}

function weeksOf(plan: MarathonV2Plan): GeneratedWeek[] {
  const pacesOf = weekPaces(plan);
  return plan.weeks.map((wk) => {
    const byDate = new Map<string, GeneratedDay>();
    const { paces, feel } = pacesOf(wk.index);
    for (const d of wk.days) {
      const structure = { ...workoutStructure(d.workout, paces, feel), kind: kindOf(d) };
      byDate.set(d.date, {
        dow: diffDays(wk.startDate, d.date) + 1,
        tag: tagOf(d),
        km: d.workout.km,
        desc: structure.title,
        structure
      });
    }
    return {
      w: wk.index,
      vol: wk.plannedKm,
      days: Array.from(
        { length: 7 },
        (_, i) => byDate.get(addDays(wk.startDate, i)) ?? rest(i + 1)
      ),
      deload: wk.deload,
      // N11: tehničke napomene nedelje (domen: volume.technicalNote) ne idu korisniku.
      focus: [wk.deload ? 'Rasterećenje.' : '', ...wk.notes.filter((n) => !technicalNote(n))]
        .filter(Boolean)
        .join(' '),
      ...(wk.phase === 'taper' ? { taper: true as const } : {})
    };
  });
}

export function goalOf(plan: MarathonV2Plan): GoalAssessmentView | undefined {
  const g = plan.goal;
  return g ? { status: g.status, label: GOAL_LABEL[g.status], message: g.message } : undefined;
}

/** Napomene i upozorenja plana za „Na šta da paziš" (doslovno iz v2, bez ponavljanja). */
function planWarnings(plan: MarathonV2Plan): string[] {
  const out: string[] = [];
  for (const t of [...plan.notes, ...plan.warnings.map((v) => v.message)])
    if (t && !out.includes(t)) out.push(t);
  return out;
}

/** Izlaz generatora u obliku ostalih generatora (dow 1–7, `vol`) + doslovan plan v2. */
export interface GeneratedV2Plan {
  weeks: GeneratedWeek[];
  pred: [];
  qs: Record<string, number[]>;
  meta: MarathonV2Meta;
  marathonV2: MarathonV2Plan;
}

export function generatedPlan(plan: MarathonV2Plan): GeneratedV2Plan {
  const input = plan.input;
  // M16: osnova tempa iz v2 (`paceBasis`: rezultat ili osećaj).
  const result = plan.paceBasis !== 'feel';
  const goal = goalOf(plan);
  const meta: MarathonV2Meta = {
    policyId: POLICY_ID,
    policyVersion: POLICY_VERSION,
    start: input.startDate,
    weeks: plan.weeks.length,
    raceDate: input.raceDate,
    raceDistM: P.paces.raceDistanceM,
    raceName: 'Maraton',
    goalSec: input.goalTimeSec ?? null,
    runDays: input.runDays.length,
    quality: plan.pattern.q2 ? 2 : 1,
    dayWarnings: planWarnings(plan),
    paceBasis: result ? 'result' : 'feel',
    // VDOT plana: iz rezultata; po osećaju je procena v2 samo orijentir brzih zona — u `meta` se ne prenosi.
    vdot: result ? plan.vdot : null,
    ...(result
      ? {
          vdot0: plan.vdot,
          trainingVdot: plan.vdot,
          racePace: plan.paces.MP,
          mpVdot: plan.paces.mpVdot,
          ...(plan.predictedMarathonSec !== null
            ? { predictedMarathonSec: plan.predictedMarathonSec }
            : {}),
          ...(plan.goal ? { goalVdot: plan.goal.goalVdot } : {})
        }
      : {}),
    ...(goal ? { goalAssessment: goal } : {})
  };
  return { weeks: weeksOf(plan), pred: [], qs: {}, meta, marathonV2: plan };
}

/** Izlaz generatora → plan za upis (ID-jevi dana, početak nedelje, dow 0–6, faza i oznaka politike). */
export function storedPlan(gen: GeneratedV2Plan): StoredPlan {
  const weeks: StoredWeek[] = gen.weeks.map((w, wi) => ({
    w: w.w,
    start: addDays(gen.meta.start, wi * 7),
    deload: w.deload,
    focus: w.focus,
    ...(w.taper ? { taper: true as const } : {}),
    days: w.days.map((d): StoredDay => ({ ...d, dow: d.dow - 1, id: `g${w.w}d${d.dow}` }))
  }));
  return stampPlan({
    weeks,
    pred: [],
    qs: {},
    meta: gen.meta,
    marathonV2: JSON.parse(JSON.stringify(gen.marathonV2)) as unknown
  });
}

/** Čija politika je upisala plan. Samo tekuća verzija `marathon-v2` je „current"; sve ostalo „unknown" (nikad tihi prelaz
 *  na maraton v1 — plan bez oznake ovaj generator ne dobija, `select.ts` ga daje maraton v1). */
export function planPolicy(plan: { meta?: unknown } | null | undefined): PolicyStatus {
  const meta = (plan?.meta ?? {}) as { policyId?: unknown; policyVersion?: unknown };
  const id = typeof meta.policyId === 'string' ? meta.policyId : String(meta.policyId);
  const version = typeof meta.policyVersion === 'string' ? meta.policyVersion : null;
  if (id === POLICY_ID && version != null && KNOWN_VERSIONS.includes(version))
    return { status: 'current', policyId: id, policyVersion: version };
  return { status: 'unknown', policyId: id, policyVersion: version };
}

/** Faza nedelje za prikaz: upisana odluka (`stampPlan`); nedelja bez polja nema fazu (v2 plan je uvek nosi). */
export function phaseOfWeek(
  w:
    | { w: number; deload?: boolean; focus?: string; taper?: boolean; phase?: unknown }
    | null
    | undefined,
  _totalWeeks: number
): WeekPhase {
  return w && typeof w.phase === 'string' && PHASES.includes(w.phase) ? (w.phase as WeekPhase) : '';
}

/** Faza nedelje iz plana v2 (`marathonV2`); bez njega ostaje upisana. */
function phasesFrom(plan: unknown): Map<number, WeekPhase> {
  const out = new Map<number, WeekPhase>();
  const weeks = (plan as { weeks?: unknown } | null | undefined)?.weeks;
  if (!Array.isArray(weeks)) return out;
  for (const w of weeks as ReadonlyArray<{ index?: unknown; phase?: unknown; deload?: unknown }>)
    if (typeof w.index === 'number' && typeof w.phase === 'string' && w.phase in PHASE)
      out.set(w.index, phaseOf({ phase: w.phase as Phase, deload: w.deload === true }));
  return out;
}

/** Plan za upis: faza svake nedelje iz odluke v2 i oznaka politike v2. Ne menja ostala polja. */
export function stampPlan<T extends PlanLike>(plan: T): T {
  const phases = phasesFrom(plan.marathonV2);
  const weeks = plan.weeks.map((w) => {
    const phase = phases.get(w.w) ?? (typeof w.phase === 'string' ? w.phase : undefined);
    return phase === undefined ? { ...w } : { ...w, phase };
  });
  return {
    ...plan,
    weeks,
    meta: {
      ...((plan.meta ?? {}) as Record<string, unknown>),
      policyId: POLICY_ID,
      policyVersion: POLICY_VERSION
    }
  };
}
