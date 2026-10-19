/* Maraton v2 → aplikacija: članovi ugovora (b) — ADAPTACIJA I PREDLOG. Jezgro ima adaptaciju (`adaptMarathonV2`, M18), ali
   činjenice iz aplikacije (dnevnik, bol, pokrivenost, pauze) i pregled pre upisa su segment MAR-06. Do tada je svaki član
   EKSPLICITNO nepodržan, sa razlogom (`UNSUPPORTED`): vraća odbijanje sa porukom, „nema predloga" ili nepromenjen ulaz —
   nikad ne prepušta posao maraton v1 generatoru (test: nijedna funkcija nije funkcija maraton v1). Merenje forme po redu
   predikcije ne postoji (v2 plan nema redove), pa se tempo treninga ne meri kao forma, a lanac forme ostaje kakav jeste.

   Tipovi su generički (dan, izmena, zapis lanca, plan prolaze kroz član nepromenjeni), pa `select.ts` proverava ugovor bez
   kasta; datum analize izvršenja dobija tip iz razrešenog plana (`D`). */

/** Poruka u UI-ju umesto prilagođavanja plana maraton v2. */
export const ADAPTATION_UNSUPPORTED =
  'Prilagođavanje plana stiže uskoro. Ovaj plan maratona (v2) se do tada ne menja automatski; treninge beleži kao i do sada.';
/** Merenje forme iz tempa treninga se u maraton v2 ne koristi (nije greška). */
export const MEASUREMENT_NOT_USED =
  'Ne koristi se u ovom planu: maraton v2 ne meri formu iz tempa treninga (plan nema redove predikcije); tempo menja rezultat, kroz prilagođavanje koje stiže uskoro.';

/** Razlog za svaki član (b) — „nepodržano do segmenta MAR-06" (test: tabela pokriva svaki član). */
export const UNSUPPORTED = {
  classifyMeasurement:
    'v2 nema redove predikcije: tempo treninga nije merenje forme (rezultat ulazi u MAR-06)',
  recomputeVdotChain: 'lanac forme v1 se ne preračunava: ostaje kakav jeste',
  sessionClassFor: 'nema klase sesije bez redova predikcije',
  currentVdot: 'forma v2 nije lanac merenja iz treninga',
  executionModel: 'opis bez odluke: odluku o izvršenju donosi adaptacija v2 iz činjenica (MAR-06)',
  executionBasis:
    'odluka o ograničenoj pripremi maraton v1 ne važi za v2: povratak i smanjenje odlučuje adaptacija v2 (M18, MAR-06)',
  buildExecutionAdjustment:
    'prilagođavanje prema izvršenju ide kroz činjenice i pregled v2 (MAR-06)',
  buildRunWalkAdjustment: 'maraton v2 nema plan trčanje/hodanje (M17)',
  assessRunWalkProgress: 'maraton v2 nema plan trčanje/hodanje (M17)',
  qualityEntryGate:
    'v2 nema kapiju kvaliteta po formi: plan po osećaju prelazi na tempo posle rezultata (MAR-06)',
  hasRecentMeasuredForm: 'svež rezultat kao forma ulazi kroz činjenice (MAR-06)',
  planWithNewGoal: 'promena cilja kroz isti ulaz v2 sa novim ciljem (MAR-06)',
  planRecalibrated:
    'rekalibracija iz forme treninga ne postoji u v2; tempo menja rezultat (MAR-06)',
  graftFuturePlan:
    'vraćanje verzije spaja planove v2 tek sa adaptacijom (MAR-06); do tada bez promene dana',
  alignAutomaticOverlays: 'v2 nema automatskih izmena dana: ručne izmene ostaju',
  vdotProposal: 'predlog tempa iz forme treninga ne postoji u v2',
  applyVdotProposal: 'nema predloga tempa: ništa se ne primenjuje',
  undoVdotAdjustments: 'nema primenjenih predloga tempa: ništa se ne vraća',
  fitnessEvidence: 'dokaz forme iz treninga ne postoji u v2 (rezultati ulaze u MAR-06)',
  planVdotNow: 'VDOT plana po nedelji dolazi sa adaptacijom (MAR-06)',
  matchPlanRows: 'v2 nema redove predikcije',
  recalibrationMinMeasurements: 'kapija rekalibracije se ne otvara (beskonačan prag)',
  recalibrationThreshold: 'kapija rekalibracije se ne otvara (beskonačan prag)',
  injuryProposal: 'bol ulazi kao činjenica u adaptaciju v2 (MAR-06), bez predloga po danu',
  applyInjuryProposal: 'nema predloga zbog bola: ništa se ne primenjuje',
  realignPlan: 'v2 ne pomera dane prema uvezenim trčanjima (trčanje ulazi sa stvarnim datumom)'
} as const;

const refuse = (): { error: string } => ({ error: ADAPTATION_UNSUPPORTED });

/* --- merenje forme (lanac forme) --- */
export const classifyMeasurement = () => ({
  status: 'not-used' as const,
  reason: 'plan-uses-results' as const,
  message: MEASUREMENT_NOT_USED
});
export const recomputeVdotChain = <E extends object>(entries: readonly E[]): E[] =>
  entries.map((e) => ({ ...e }));
export const sessionClassFor = () => 'default' as const;
export const currentVdot = (): number | null => null;

/* --- izvršenje, run/walk napredak, kapija kvaliteta --- */
/** Prazan opis izvršenja (bez odluke) sa razlogom; datum je tipa datuma razrešenog plana. */
export function executionModel<D extends string>(
  _plan: { weeks: ReadonlyArray<{ start: D }> },
  todayStr: string
) {
  const today = todayStr as D;
  return {
    analysis: {
      today,
      windowStart: today,
      completed: 0,
      missed: 0,
      unknown: 0,
      statusCoverage: 0,
      volumeCoverage: 0,
      actualKm: 0,
      plannedKm: 0,
      completeWeeks: [],
      recentWeeklyKm: null,
      lastPositiveWeeklyKm: null,
      recentLongRunKm: null,
      lastRunDate: null,
      daysSinceLastRun: null,
      explicitMisses14d: 0,
      easyHighRpeCount: 0,
      lowerVolumeWeeks: 0,
      reasons: [ADAPTATION_UNSUPPORTED]
    },
    recommendation: {
      kind: null,
      reason: ADAPTATION_UNSUPPORTED,
      actionable: false,
      requiresConfirmation: false,
      reasons: [ADAPTATION_UNSUPPORTED]
    }
  };
}
export const executionBasis = refuse;
export const buildExecutionAdjustment = refuse;
export const buildRunWalkAdjustment = refuse;
export const assessRunWalkProgress = () => ({
  decision: 'not-applicable' as const,
  rung: null,
  finalRung: false,
  considered: 0,
  completed: 0,
  missed: 0,
  tolerated: 0,
  borderline: 0,
  hard: 0,
  unreported: 0,
  reasons: [UNSUPPORTED.assessRunWalkProgress],
  advice: null
});
export const qualityEntryGate = () => ({
  open: false,
  met: [],
  unmet: [ADAPTATION_UNSUPPORTED],
  unknown: []
});
export const hasRecentMeasuredForm = (): boolean => false;

/* --- promena cilja, rekalibracija, vraćanje verzije, automatske izmene --- */
export const planWithNewGoal = refuse;
export const planRecalibrated = refuse;
/** Bez izmene budućih dana: pregled vraćanja verzije prijavljuje da nema šta da se vrati, uz razlog. */
export const graftFuturePlan = <T extends { meta?: unknown }>(plan: T): T => ({
  ...plan,
  meta: {
    ...((plan.meta ?? {}) as Record<string, unknown>),
    futureChanges: { changedDays: 0, conflicts: [ADAPTATION_UNSUPPORTED] }
  }
});
export const alignAutomaticOverlays = <A>(
  _current: unknown,
  _result: unknown,
  _today: string,
  context: { alts?: Readonly<Record<string, A>> }
): Record<string, A> => ({ ...(context.alts ?? {}) });

/* --- predlog tempa, dokaz forme --- */
export const vdotProposal = (): null => null;
export const applyVdotProposal = <A, G>(
  _proposal: unknown,
  _plan: unknown,
  _log: unknown,
  alts: Readonly<Record<string, A>>,
  genPlan: G
) => ({ applied: 0, alts: { ...alts }, genPlan });
export const undoVdotAdjustments = <A, G>(
  _plan: unknown,
  alts: Readonly<Record<string, A>>,
  genPlan: G
) => ({ applied: 0, alts: { ...alts }, genPlan });
export const fitnessEvidence = <E extends object>(ctx: { vdotChain: readonly E[] }) => ({
  form: null,
  measurements: 0,
  distinctDays: 0,
  confirmedTests: 0,
  trainingMeasurements: 0,
  windowDays: 0,
  chain: ctx.vdotChain.map((e) => ({ ...e })),
  excluded: []
});
export const planVdotNow = (): number | null => null;
export const matchPlanRows = <R>(): Map<string, R> => new Map<string, R>();
/** Kapija rekalibracije se nikad ne otvara (beskonačan prag) dok adaptacija nije povezana. */
export const RECALIBRATION_MIN_MEASUREMENTS = Number.POSITIVE_INFINITY;
export const RECALIBRATION_THRESHOLD = Number.POSITIVE_INFINITY;

/* --- predlog zbog bola, poravnanje sa uvezenim trčanjima --- */
export const injuryProposal = (): null => null;
export const applyInjuryProposal = <A>(
  _proposal: unknown,
  _plan: unknown,
  _log: unknown,
  alts: Readonly<Record<string, A>>
) => ({ applied: 0, alts: { ...alts } });
export const realignPlan = (input: { moves: Readonly<Record<string, unknown>> }) => ({
  moves: { ...input.moves },
  moved: 0
});
