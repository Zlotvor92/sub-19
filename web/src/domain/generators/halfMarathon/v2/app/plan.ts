/* HM v2 → aplikacija: plan v2 → plan formata razmene (nedelje, dani, struktura, meta), oznaka politike i faza nedelje.

   - Nedelja aplikacije = nedelja v2 (početak `startDate` nedelje v2, 7 dana; dan bez treninga je odmor). `dow` je pomak od
     početka nedelje (0–6), ID dana `g{nedelja}d{dow + 1}` kao kod ostalih generatora.
   - Dan nosi strukturu v2 doslovno (`structure`: blokovi, RPE plana po osećaju, test 5 km); `desc` je samo naslov. `session`
     se ne pravi: prikaz i sat čitaju strukturu, a v2 nema redove predikcije (`pred` prazan).
   - Trka (sa svojim WU/CD) je VAN nedeljnog obima kao u v2 (`countsToWeek`): km dana trke su ceo dan, a prikaz je ne sabira
     u nedelju (`day/stats.outsideWeekVolume` za dan trke sa strukturom): trka 21,1 km + WU/CD (H8).
   - `meta` nosi SAMO ono što v2 zna; polja formata koja v2 nema (intenzitet, „predviđeno" vreme kao cilj, procena napretka)
     su izostavljena — čitaoci aplikacije ih proveravaju (`raceRefs`, `planBaselineVdot`). Ceo izlaz v2 je u `hmV2`.
   Jedine odluke adaptera (mapa faze, ime vrste, tip dana, oblik dana) imaju po jedno mesto: ovaj fajl. */

import { checkInput } from '../input.ts';
import { HM_V2_POLICY as P } from '../policy.ts';
import { basisAt, pacesAt } from '../steps.ts';
import type { GoalAssessment, HmV2Plan, Paces, Phase, PlanDay } from '../types.ts';
import { userWeekNotes } from '../volume.ts';
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
  HmV2Meta,
  WeekPhase
} from './types.ts';

export const POLICY_ID = P.id;
export const POLICY_VERSION = P.version;
/** v2 nema plan pre oznake politike: svaki v2 plan nosi `hm-v2`; plan bez oznake je HM v1 (`legacy-hm`). */
export const LEGACY_POLICY_ID = 'legacy-hm';
/** Verzije koje trenutni kod ume da prikaže i adaptira (istorijske implementacije v2 se ne čuvaju): sve koje su mogle
 *  biti sačuvane posle HM-05 (aplikacija je od HM-05 do HM-06 pisala samo `hm-v2.3.0`; od HM-07 `hm-v2.4.0`; od HM-07b `hm-v2.4.1`; od 3f `hm-v2.5.0` — plan sa nedeljama izvora predaje, `PREFIX_KEY`; od HM-08 `hm-v2.6.0`; od HM-08b `hm-v2.6.1`; od 3i `hm-v2.6.2` — ulaz `weekOffset`) i tekuća. Sačuvan stariji plan ostaje plan
 *  HM v2; prilagođavanje ga gradi tekućim pravilima, a rezultat nosi tekuću oznaku. Svaka druga verzija je „unknown"
 *  (UNKNOWN_POLICY). */
export const KNOWN_VERSIONS: readonly string[] = [
  ...new Set([
    'hm-v2.3.0',
    'hm-v2.4.0',
    'hm-v2.4.1',
    'hm-v2.5.0',
    'hm-v2.6.0',
    'hm-v2.6.1',
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
      return 'Trkački ritam';
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
function weekPaces(plan: HmV2Plan): (w: number) => { paces: Paces; feel: boolean } {
  const whole = { paces: plan.paces, feel: plan.paceBasis === 'feel' };
  const steps = plan.adaptation?.steps ?? [];
  const chk = steps.length > 0 ? checkInput(plan.input) : null;
  if (!chk?.ok) return () => whole;
  const pace = chk.pace;
  return (w) => ({ paces: pacesAt(pace, steps, w), feel: basisAt(pace, steps, w) === 'feel' });
}

function weeksOf(plan: HmV2Plan): GeneratedWeek[] {
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
      // Faza 4a N11: napomene za korisnika bira domen (tehnička napomena izvodljivog cilja ne ide korisniku).
      focus: [wk.deload ? 'Rasterećenje.' : '', ...userWeekNotes(wk)].filter(Boolean).join(' '),
      ...(wk.phase === 'taper' ? { taper: true as const } : {})
    };
  });
}

export function goalOf(plan: HmV2Plan): GoalAssessmentView | undefined {
  const g = plan.goal;
  return g ? { status: g.status, label: GOAL_LABEL[g.status], message: g.message } : undefined;
}

/** Napomene i upozorenja plana za „Na šta da paziš" (doslovno iz v2, bez ponavljanja). */
function planWarnings(plan: HmV2Plan): string[] {
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
  meta: HmV2Meta;
  hmV2: HmV2Plan;
}

export function generatedPlan(plan: HmV2Plan): GeneratedV2Plan {
  const input = plan.input;
  // H16: plan sa rezultatom nema polje `paceBasis` (osnova = rezultat).
  const result = plan.paceBasis !== 'feel';
  const goal = goalOf(plan);
  const meta: HmV2Meta = {
    policyId: POLICY_ID,
    policyVersion: POLICY_VERSION,
    start: input.startDate,
    weeks: plan.weeks.length,
    raceDate: input.raceDate,
    raceDistM: P.paces.raceDistanceM,
    raceName: 'Polumaraton',
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
          racePace: plan.paces.RP,
          ...(plan.predictedHmSec !== null ? { predictedHmSec: plan.predictedHmSec } : {}),
          ...(plan.goal ? { goalVdot: plan.goal.goalVdot } : {})
        }
      : {}),
    ...(goal ? { goalAssessment: goal } : {})
  };
  return { weeks: weeksOf(plan), pred: [], qs: {}, meta, hmV2: plan };
}

/** Faza 3 (3f, O6b): plan polumaratona napravljen predajom „kraća distanca" iz dužeg plana v2 nosi nedelje IZVORA pre
 *  svog početka (prošlost i tekuća nedelja izvora, doslovno: dani, id-jevi, faze). Nedelje v2 tada imaju broj
 *  `offset + index` (isti broj i id dana kao nedelja izvora istog datuma — oba plana se završavaju danom trke), pa
 *  dnevnik, izmene i pomeranja ostaju na svojim danima. Plan bez polja = običan plan HM v2 (offset 0). */
export const PREFIX_KEY = 'hmV2Prefix';
export interface Prefix {
  offset: number;
  weeks: StoredWeek[];
}
export function prefixOf(plan: unknown): Prefix | null {
  const p = (plan as Record<string, unknown> | null | undefined)?.[PREFIX_KEY] as
    { offset?: unknown; weeks?: unknown } | undefined;
  return p && Number.isInteger(p.offset) && Array.isArray(p.weeks) ? (p as Prefix) : null;
}

/** Izlaz generatora → plan za upis (ID-jevi dana, početak nedelje, dow 0–6, faza i oznaka politike); uz `prefix`
 *  (3f) nedelje izvora ostaju ispred, a nedelje v2 dobijaju broj `offset + index`. */
export function storedPlan(gen: GeneratedV2Plan, prefix: Prefix | null = null): StoredPlan {
  const off = prefix?.offset ?? 0;
  const weeks: StoredWeek[] = gen.weeks.map((w, wi) => ({
    w: off + w.w,
    start: addDays(gen.meta.start, wi * 7),
    deload: w.deload,
    focus: w.focus,
    ...(w.taper ? { taper: true as const } : {}),
    days: w.days.map((d): StoredDay => ({ ...d, dow: d.dow - 1, id: `g${off + w.w}d${d.dow}` }))
  }));
  if (prefix) {
    const before = JSON.parse(JSON.stringify(prefix.weeks)) as StoredWeek[];
    return stampPlan({
      weeks: [...before, ...weeks],
      pred: [],
      qs: {},
      meta: {
        ...gen.meta,
        start: before[0]?.start ?? gen.meta.start,
        weeks: before.length + weeks.length
      },
      hmV2: JSON.parse(JSON.stringify(gen.hmV2)) as unknown,
      [PREFIX_KEY]: { offset: off, weeks: before }
    });
  }
  return stampPlan({
    weeks,
    pred: [],
    qs: {},
    meta: gen.meta,
    hmV2: JSON.parse(JSON.stringify(gen.hmV2)) as unknown
  });
}

/** Čija politika je upisala plan. Samo tekuća verzija `hm-v2` je „current"; sve ostalo „unknown" (nikad tihi prelaz
 *  na HM v1 — plan bez oznake ovaj generator ne dobija, `select.ts` ga daje HM v1). */
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

/** Faza nedelje iz plana v2 (`hmV2`); bez njega ostaje upisana. */
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
  const phases = phasesFrom(plan.hmV2);
  // 3f: nedelje izvora (≤ offset) zadržavaju svoju fazu; nedelja v2 broj `offset + index`.
  const off = prefixOf(plan)?.offset ?? 0;
  const weeks = plan.weeks.map((w) => {
    const phase =
      (w.w > off ? phases.get(w.w - off) : undefined) ??
      (typeof w.phase === 'string' ? w.phase : undefined);
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
