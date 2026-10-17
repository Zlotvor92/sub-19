/* 5K v2 → aplikacija: plan v2 → plan formata razmene (nedelje, dani, struktura, meta), oznaka politike i faza nedelje.

   - Nedelja aplikacije = nedelja v2 (početak `startDate` v2, 7 dana; dan bez treninga je odmor). `dow` je pomak od
     početka nedelje (0–6), ID dana `g{nedelja}d{dow + 1}` kao kod ostalih generatora.
   - Dan nosi strukturu v2 (`structure`); `desc` je samo naslov treninga. `session` se ne pravi: prikaz i sat čitaju
     strukturu, a v2 nema redove predikcije (`pred` prazan), pa ni merenje forme po redu.
   - `meta` nosi SAMO ono što v2 zna (nema intenziteta, „predviđenog" cilja ni procene budućeg napretka); polja formata
     koja v2 nema su izostavljena — čitaoci aplikacije ih proveravaju (`raceRefs`, `planBaselineVdot`). Ocena cilja ide
     doslovno (`goalAssessment`). Ceo izlaz v2 je u `fiveKV2` (osnova adaptacije, 08b). */

import { FIVE_K_V2_POLICY as P } from '../policy.ts';
import type {
  FiveKV2Plan,
  FiveKV2RunWalkPlan,
  GoalAssessment,
  Phase,
  PlanDay,
  RunWalkDay
} from '../types.ts';
import { addDays, diffDays, type IsoDate } from './date.ts';
import type { GenPlanState, StoredWeek } from '../../exchange.ts';
import { runWalkRaceStructure, runWalkStructure, workoutStructure } from './structure.ts';
import type {
  PlanMeta,
  PolicyStatus,
  RestDay,
  RunWalk,
  StoredDay,
  StructuredDay,
  WeekPhase,
  WorkoutStructure
} from './types.ts';

export const POLICY_ID = P.id;
export const POLICY_VERSION = P.version;
/** v2 nema plan pre oznake politike: svaki v2 plan nosi `5k-v2`. */
export const LEGACY_POLICY_ID = 'legacy-5k';
/** Verzije koje trenutni kod ume da gradi: samo tekuća (istorijske implementacije v2 se ne čuvaju). */
export const KNOWN_VERSIONS: readonly string[] = [P.version];

export type AnyV2Plan = FiveKV2Plan | FiveKV2RunWalkPlan;

/** Faza za prikaz iz odluke v2 (prikazna odluka adaptera): baza → BAZA, vrhunac obima → RAZVOJ (kvalitet postaje
 *  teži), oštrenje → VRHUNAC (najspecifičniji rad za tempo trke), taper → TAPER, trka → TRKA; rasterećenje → DELOAD.
 *  Trčanje/hodanje: izgradnja → BAZA, trkačka nedelja → TRKA. */
const PHASE: Readonly<Record<Phase | 'runWalk', WeekPhase>> = {
  base: 'BAZA',
  peak: 'RAZVOJ',
  sharpen: 'VRHUNAC',
  taper: 'TAPER',
  race: 'TRKA',
  runWalk: 'BAZA'
};
const PHASES: readonly string[] = ['DELOAD', 'TRKA', 'TAPER', 'BAZA', 'RAZVOJ', 'VRHUNAC', ''];

const GOAL_LABEL: Readonly<Record<GoalAssessment['status'] | 'finish', string>> = {
  feasible: 'izvodljiv',
  ambitious: 'ambiciozan',
  unrealistic: 'nerealan',
  orientation: 'orijentir',
  insufficient_data: 'nedovoljno podataka',
  finish: 'završiti'
};

const TAG: Readonly<Record<string, StoredDayTag>> = {
  easy: 'lako',
  long: 'lr',
  race: 'trka'
};
type StoredDayTag = StructuredDay['tag'];

/** Tip dana aplikacije iz treninga v2 (prikazna oznaka; struktura nosi sadržaj). */
function tagOf(d: PlanDay): StoredDayTag {
  const w = d.workout;
  if (w.kind !== 'quality') return TAG[w.kind]!;
  switch (w.qualityType) {
    case 'TEST_3K':
      return 'test';
    case 'T_short':
    case 'T_cruise':
    case 'RP':
    case 'RP_sharpener':
    case 'TEMPO_FEEL':
      return 'tempo';
    default:
      return 'int';
  }
}

/** Kratko ime vrste treninga za oznaku dana i uputstvo (prikazna odluka adaptera; ključevi postojećih uputstava gde
 *  se smisao poklapa). */
function kindOf(d: PlanDay): string {
  const w = d.workout;
  if (w.kind === 'easy') return 'Lako';
  if (w.kind === 'long') return 'Dugo (LR)';
  if (w.kind === 'race') return 'TRKA';
  switch (w.qualityType) {
    case 'R':
    case 'R_sharpen':
      return 'Repeticije';
    case 'I':
      return 'Intervali';
    case 'T_short':
    case 'TEMPO_FEEL':
      return 'Tempo';
    case 'T_cruise':
      return 'Tempo isprekidan';
    case 'RP':
    case 'RP_sharpener':
      return 'Trkački ritam';
    case 'HILLS':
      return 'Usponi';
    case 'FARTLEK':
    case 'FARTLEK_RP':
      return 'Fartlek';
    case 'TEST_3K':
      return 'Test';
    default:
      return 'Kvalitet';
  }
}

const mmss = (sec: number): string =>
  sec % 60 === 0
    ? `${sec / 60} min`
    : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min`;
const runWalkOf = (runSec: number, walkSec: number): RunWalk => ({
  runSec,
  walkSec,
  label: `${mmss(runSec)} trčanja / ${mmss(walkSec)} hoda`
});

/** Dan generatora (dow 1–7 od početka nedelje, kao izlaz ostalih generatora pre `adaptGeneratedPlan`). */
type GeneratedDay = StructuredDay | RestDay;
interface GeneratedWeek {
  w: number;
  vol: number;
  /** Dan sa strukturom nije u uniji `Day` formata (v. `StructuredDay`): nosi se kao dan formata razmene. */
  days: StoredDay[];
  deload: boolean;
  focus: string;
  taper?: true;
}

function structuredDay(
  dow: number,
  tag: StoredDayTag,
  structure: WorkoutStructure,
  km: number | null,
  runWalk?: RunWalk
): GeneratedDay {
  return {
    dow,
    tag,
    km,
    desc: structure.title,
    structure,
    ...(runWalk ? { runWalk } : {})
  };
}

const rest = (dow: number): GeneratedDay => ({ dow, rest: true, desc: null });

function fillWeek(start: IsoDate, days: Map<IsoDate, GeneratedDay>): StoredDay[] {
  return Array.from(
    { length: 7 },
    (_, i) => (days.get(addDays(start, i)) ?? rest(i + 1)) as StoredDay
  );
}

const sumKm = (days: readonly StoredDay[]): number =>
  Math.round(days.reduce((a, d) => a + (d.km ?? 0), 0) * 10) / 10;

function continuousWeeks(plan: FiveKV2Plan): GeneratedWeek[] {
  return plan.weeks.map((wk) => {
    const start = wk.startDate as IsoDate;
    const byDate = new Map<IsoDate, GeneratedDay>();
    for (const d of wk.days) {
      const dow = diffDays(start, d.date as IsoDate) + 1;
      byDate.set(
        d.date as IsoDate,
        structuredDay(
          dow,
          tagOf(d),
          { ...workoutStructure(d.workout, plan.paces), kind: kindOf(d) },
          d.workout.km
        )
      );
    }
    const days = fillWeek(start, byDate);
    return {
      w: wk.index,
      vol: sumKm(days),
      days,
      deload: wk.deload,
      focus: [wk.deload ? 'Rasterećenje.' : '', ...wk.notes].filter(Boolean).join(' '),
      ...(wk.taperStep !== null ? { taper: true as const } : {})
    };
  });
}

function runWalkDay(start: IsoDate, d: RunWalkDay, easyPace: number | null): GeneratedDay {
  const dow = diffDays(start, d.date as IsoDate) + 1;
  if (d.role === 'race') {
    const r = d.race;
    return structuredDay(
      dow,
      'trka',
      { ...runWalkRaceStructure(r, d.level, d.projection), kind: 'TRKA' },
      r.distanceKm,
      r.continuous ? undefined : runWalkOf(r.runSec, r.walkSec)
    );
  }
  const s = d.session;
  const structure = {
    ...runWalkStructure(s, easyPace, d.projection),
    kind: s.continuous ? 'Lako' : 'Trčanje/hod'
  };
  return structuredDay(
    dow,
    s.continuous ? 'lako' : 'rw',
    structure,
    s.estRunKm,
    s.continuous ? undefined : runWalkOf(s.runSec, s.walkSec)
  );
}

function runWalkWeeks(plan: FiveKV2RunWalkPlan): GeneratedWeek[] {
  // Prelaz na kontinuirani plan (Odluka 8) nastaje samo adaptacijom (08b); generator ga ne pravi.
  if (plan.continuous)
    throw new Error('5K v2: plan sa prelazom na kontinuirani plan je deo adaptacije (08b).');
  const pace = plan.input.typicalEasyPaceSecPerKm ?? null;
  return plan.weeks.map((wk) => {
    const start = wk.startDate as IsoDate;
    const byDate = new Map<IsoDate, GeneratedDay>(
      wk.days.map((d) => [d.date as IsoDate, runWalkDay(start, d, pace)])
    );
    const days = fillWeek(start, byDate);
    return { w: wk.index, vol: sumKm(days), days, deload: false, focus: wk.notes.join(' ') };
  });
}

const isRunWalk = (p: AnyV2Plan): p is FiveKV2RunWalkPlan => p.planType === 'runWalk';

function goalOf(plan: AnyV2Plan): PlanMeta['goalAssessment'] {
  if (isRunWalk(plan))
    return { status: 'finish', label: GOAL_LABEL.finish, message: plan.goal.message };
  const g = plan.goal;
  return g ? { status: g.status, label: GOAL_LABEL[g.status], message: g.message } : undefined;
}

/** Napomene i upozorenja plana za „Na šta da paziš" (doslovno iz v2, bez ponavljanja). */
function planWarnings(plan: AnyV2Plan): string[] {
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
  meta: PlanMeta;
  fiveKV2: AnyV2Plan;
}

export function generatedPlan(plan: AnyV2Plan): GeneratedV2Plan {
  const weeks = isRunWalk(plan) ? runWalkWeeks(plan) : continuousWeeks(plan);
  const input = plan.input;
  const vdot = isRunWalk(plan) ? null : plan.vdot;
  const goal = goalOf(plan);
  const meta = {
    policyId: POLICY_ID,
    policyVersion: POLICY_VERSION,
    start: input.startDate,
    weeks: weeks.length,
    raceDate: input.raceDate,
    raceDistM: P.paces.raceDistanceM,
    raceName: '5K',
    goalSec: input.goalTimeSec ?? null,
    runDays: input.runDays.length,
    quality: isRunWalk(plan) ? 0 : plan.pattern.q2 ? 2 : 1,
    dayWarnings: planWarnings(plan),
    ...(vdot !== null && !isRunWalk(plan)
      ? {
          vdot0: vdot,
          trainingVdot: vdot,
          racePace: (plan.paces as { RP: number }).RP,
          ...(plan.goal?.goalVdot != null ? { goalVdot: plan.goal.goalVdot } : {})
        }
      : {}),
    ...(goal ? { goalAssessment: goal } : {})
  };
  return {
    weeks,
    pred: [],
    qs: {},
    // Polja formata koja v2 nema (intenzitet, „predviđeno" vreme, procena napretka) su namerno izostavljena.
    meta: meta as unknown as PlanMeta,
    fiveKV2: plan
  };
}

/** Izlaz generatora → plan za upis (ID-jevi dana, početak nedelje, dow 0–6). */
export function storedPlan(gen: GeneratedV2Plan): GenPlanState {
  const weeks: StoredWeek[] = gen.weeks.map((w, wi) => ({
    w: w.w,
    start: addDays(gen.meta.start, wi * 7),
    deload: w.deload,
    focus: w.focus,
    ...(w.taper ? { taper: true as const } : {}),
    days: w.days.map((d) => ({ ...d, dow: d.dow - 1, id: `g${w.w}d${d.dow}` }))
  }));
  return stampPlan({
    weeks,
    pred: [],
    qs: {},
    meta: gen.meta,
    fiveKV2: JSON.parse(JSON.stringify(gen.fiveKV2)) as unknown
  });
}

/** Čija politika je upisala plan. Plan bez oznake ovaj generator ne obrađuje (to je 5K v1). */
export function planPolicy(plan: Pick<GenPlanState, 'meta'> | null | undefined): PolicyStatus {
  const meta = (plan?.meta ?? {}) as { policyId?: unknown; policyVersion?: unknown };
  const id = typeof meta.policyId === 'string' ? meta.policyId : String(meta.policyId);
  const version = typeof meta.policyVersion === 'string' ? meta.policyVersion : null;
  if (id === POLICY_ID && version != null && KNOWN_VERSIONS.includes(version))
    return { status: 'current', policyId: id, policyVersion: version };
  return { status: 'unknown', policyId: id, policyVersion: version };
}

/** Faza nedelje za prikaz: upisana odluka (stampPlan); nedelja bez polja nema fazu (v2 plan je uvek nosi). */
export function phaseOfWeek(
  w:
    | { w: number; deload?: boolean; focus?: string; taper?: boolean; phase?: unknown }
    | null
    | undefined,
  _totalWeeks: number
): WeekPhase {
  return w && typeof w.phase === 'string' && PHASES.includes(w.phase) ? (w.phase as WeekPhase) : '';
}

/** Faza nedelje iz plana v2 (`fiveKV2`); bez njega ostaje upisana. */
function phasesFrom(plan: unknown): Map<number, WeekPhase> {
  const out = new Map<number, WeekPhase>();
  const p = plan as Partial<AnyV2Plan> | null | undefined;
  for (const w of (p?.weeks ?? []) as ReadonlyArray<{
    index: number;
    phase: Phase | 'runWalk';
    deload?: boolean;
  }>)
    out.set(w.index, w.deload ? 'DELOAD' : (PHASE[w.phase] ?? ''));
  return out;
}

/** Plan za upis: faza svake nedelje iz odluke v2 i oznaka politike v2. Ne menja ostala polja. */
export function stampPlan<T extends GenPlanState>(plan: T): T {
  const phases = phasesFrom(plan['fiveKV2']);
  const weeks: StoredWeek[] = plan.weeks.map((w) => {
    const phase = phases.get(w.w) ?? (typeof w.phase === 'string' ? w.phase : undefined);
    return phase === undefined ? { ...w } : { ...w, phase };
  });
  return {
    ...plan,
    weeks,
    meta: { ...(plan.meta ?? {}), policyId: POLICY_ID, policyVersion: POLICY_VERSION } as T['meta']
  };
}
