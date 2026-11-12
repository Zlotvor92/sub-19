/* V4 — TIPOVI JEZGRA. Samo tipovi i konstante verzije; bez logike i bez uvoza.
   Ugovor i sve formule: docs/generators-v4/SPEC.md (brojevi u zagradama upućuju na odeljke SPEC-a).
   Motor ne zna za distance: ovde nema imena distance; sve što se razlikuje po distanci je `DistanceData`. */

/** Verzija oblika `PlanDoc`. Menja se samo kad stari dokument više ne može da se čita bez migracije. */
export const PLAN_DOC_VERSION = 1;
/** Verzija motora koja je poslednja upisala plan (`PlanDoc.engineVersion`). */
export const ENGINE_VERSION = '4.0.0';

/* ------------------------------------------------------------------ osnovne jedinice */

/** Kalendarski dan `YYYY-MM-DD` po beogradskom vremenu (Europe/Belgrade). */
export type IsoDate = string;
/** 0 = ponedeljak … 6 = nedelja. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Seconds = number;
export type Meters = number;
export type SecPerKm = number;
/** Bod opterećenja (BO): 1 BO = 1 minut laganog trčanja (§ 5). */
export type LoadPoints = number;
/** Forma kao VDOT (Daniels–Gilbert), jedna decimala u prikazu (§ 5.4, § 7). */
export type Vdot = number;
export type Confidence = 'niska' | 'srednja' | 'visoka';

/** Podaci distance: slobodne oznake; motor ih samo poredi na jednakost. */
export type PhaseId = string;
export type LevelId = string;
export type StimulusTag = string;
export type TextKey = string;
export type DayId = string;
export type RunId = string;
export type EventId = string;

/* ------------------------------------------------------------------ trening (§ 1.4) */

/** E lagano · M umereno (stabilno) · T prag · I interval · R repeticije · RP tempo trke za cilj plana. */
export type ZoneId = 'E' | 'M' | 'T' | 'I' | 'R' | 'RP';

export type Target =
  | { type: 'zone'; zone: ZoneId }
  /** Napor bez tempa (hod, stajanje, „po osećaju" u preuzetom planu). `rpe` 1–10. */
  | { type: 'effort'; rpe: number }
  /** Izričit tempo: samo ručni unos i preuzeti planovi; motor ga nikad ne proizvodi. */
  | { type: 'pace'; secPerKm: SecPerKm }
  /** Maksimalan ravnomeran napor na zadatu dužinu (trka, test). */
  | { type: 'allOut' };

/** Tačno jedno od dva. */
export type Extent = { durationSec: Seconds } | { distanceM: Meters };

export type StepRole = 'warmup' | 'work' | 'recovery' | 'cooldown' | 'steady';

export interface SingleStep {
  role: StepRole;
  target: Target;
  extent: Extent;
}
export interface RepeatStep {
  repeat: number;
  steps: SingleStep[];
}
export type Step = SingleStep | RepeatStep;

export type WorkoutKind = 'easy' | 'long' | 'quality' | 'test' | 'race' | 'other';

/** Konkretan trening u planu. Isti oblik za generisan, ručno unet i preuzet. */
export interface Workout {
  kind: WorkoutKind;
  /** Podražaj koji trening nosi (oznaka iz podataka distance); `null` = čisto lagano / nepoznato. */
  stimulus: StimulusTag | null;
  /** Unos biblioteke iz kog je nastao; nema ga ručni ni preuzeti trening. */
  libraryId?: string;
  /** Doza glavnog dela u sekundama rada (0 za lagano). Izvedena iz `steps` pri upisu, čuva se radi napredovanja. */
  workSec: Seconds;
  steps: Step[];
  /** Čitljiv opis BEZ brojeva tempa (tempo se čita iz `PlanDoc.header.paces`). Preuzet plan: izvorni tekst doslovno. */
  text: string;
  notes?: string[];
}

/* ------------------------------------------------------------------ PlanDoc (§ 1) */

/** Ko je poslednji odredio sadržaj dana. Motor sme da menja samo `template` (i `adopted`, v. § 9). */
export type DayOrigin = 'template' | 'manual' | 'adopted';

export interface PlanDay {
  id: DayId;
  /** Važeći datum (posle eventualnog pomeranja). */
  date: IsoDate;
  /** Datum pre ručnog pomeranja; nema ga dan koji nije pomeren. */
  movedFrom?: IsoDate;
  origin: DayOrigin;
  /** Zaključan dan motor ne menja ni na događaj. */
  locked: boolean;
  /** `null` = dan odmora. */
  workout: Workout | null;
  /** Sadržaj pre ručne izmene (za vraćanje); postoji samo kad je `origin: 'manual'` nastao izmenom. */
  base?: Workout | null;
  /** Dodatna aktivnost uz dan koju motor ne planira (npr. snaga); prenosi se doslovno. */
  extras?: string[];
  /** Polja starog formata koja V4 ne tumači; adapter ih prenosi doslovno (§ 9). */
  legacy?: Readonly<Record<string, JsonValue>>;
}

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type WeekKind = 'build' | 'recovery' | 'peak' | 'taper' | 'race';

/** Dugi u nameri nedelje. */
export interface LongSlot {
  /** Dužina kao udeo najdužeg dugog plana (`Decisions.longMaxSec`), 0–1. */
  lenPct: number;
  /** Vrsta dugog: bira unos biblioteke `kind: 'long'` sa ovim podražajem. */
  stimulus: StimulusTag;
  /** Doza bloka/progresije kao udeo plafona tog podražaja; nema je lagan dugi. */
  dosePct?: number;
}

export interface StimulusSlot {
  stimulus: StimulusTag;
  /** Doza kao udeo plafona podražaja (0–1). Bez nje: lestvica napredovanja iz podataka (§ 4.4). */
  dosePct?: number;
  /** Izričit unos biblioteke (preskače izbor po oznakama). */
  workoutId?: string;
}

/** NAMERA nedelje — ono što šablon nosi (AGENTS t. 4). */
export interface WeekIntent {
  phase: PhaseId;
  kind: WeekKind;
  /** Opterećenje kao udeo vrha plana (`Decisions.peakLoad`), 0–1. */
  loadPct: number;
  long: LongSlot | null;
  /** Podražaji po važnosti: prvi ide na prvi dan kvaliteta iz `Decisions.qualityDays` (§ 4.6). */
  stimuli: StimulusSlot[];
  /** `inferred`: nameru je adapter izveo iz preuzetog plana (§ 9). */
  source: 'template' | 'inferred';
}

export interface PlanWeek {
  /** 1-indeksirano, neprekidno kroz ceo plan. */
  index: number;
  /** Ponedeljak nedelje. */
  start: IsoDate;
  intent: WeekIntent;
  /** Cilj opterećenja nedelje posle svih odluka (bez dana trke). */
  targetLoad: LoadPoints;
  /** Odlučeno trajanje dugog te nedelje pre stanja spremnosti (0 = nedelja bez dugog); preuzet plan: najduži dan. */
  longSec: Seconds;
  /** Dani hronološki; nedelja na početku plana može biti nepotpuna. */
  days: PlanDay[];
}

/** Upozorenje (AGENTS t. 6): problem + značenje + konkretan predlog. */
export interface Warning {
  code: string;
  severity: 'info' | 'upozorenje' | 'ozbiljno';
  /** Šta je problem. */
  problem: string;
  /** Šta to znači za trku. */
  meaning: string;
  /** Konkretan predlog šta je potrebno. */
  proposal: string;
  /** Predlog u brojevima, da ekran može da ponudi dugme. */
  suggest?: {
    weeks?: number;
    peakWeeklyKm?: number;
    runDays?: number;
    longKm?: number;
    distanceId?: string;
  };
}

export interface FormPoint {
  vdot: Vdot;
  /** Ekvivalentno vreme na distanci cilja. */
  raceTimeSec: Seconds;
  asOf: IsoDate;
  confidence: Confidence;
}

/** Snimak forme u zaglavlju: stanje pri poslednjoj izmeni plana (živa vrednost dolazi iz `fitness/`, § 7). */
export interface FormHeader {
  /** Polazna forma: pri nastanku plana; ne menja se. */
  start: FormPoint;
  /** Procena pri poslednjoj izmeni plana. */
  current: FormPoint;
  /** Forma po kojoj su računata tempa plana (menja se uz histerezu, § 7.6). */
  paceVdot: Vdot;
  pacesUpdatedOn: IsoDate;
  /** Očekivani raspon na dan trke. */
  raceDay: { lowSec: Seconds; expectedSec: Seconds; highSec: Seconds };
}

/** Tempa zona izvedena iz `FormHeader.paceVdot` (§ 5.4). E je raspon, ostalo tačka. */
export interface Paces {
  easySlow: SecPerKm;
  easyFast: SecPerKm;
  /** Tempo E za račun kilometara (66 %, § 5.4 i § 5.5). */
  easy: SecPerKm;
  M: SecPerKm;
  T: SecPerKm;
  I: SecPerKm;
  R: SecPerKm;
  RP: SecPerKm;
  /** true: forma je niske pouzdanosti — kvalitet se prikazuje kao napor dok ne dođe test ili trka. */
  byFeel: boolean;
}

/** Odluke donete jednom pri nastanku plana; ponovno planiranje ih ČITA (stabilnost, § 6.3). */
export interface Decisions {
  templateId: string;
  level: LevelId;
  /** Bazno nedeljno opterećenje trkača na dan nastanka plana. */
  baseLoad: LoadPoints;
  /** Vrh nedeljnog opterećenja plana. */
  peakLoad: LoadPoints;
  longMaxSec: Seconds;
  /** Polazni dugi (trajanje). */
  longStartSec: Seconds;
  /** Plafon doze po podražaju, sekunde rada po treningu. */
  doseCapSec: Readonly<Record<StimulusTag, Seconds>>;
  warmupSec: Seconds;
  cooldownSec: Seconds;
  runDays: Weekday[];
  longDay: Weekday;
  /** Dani kvaliteta po pravilu rasporeda (§ 4.6), po prioritetu (Q1, Q2, …). */
  qualityDays: Weekday[];
}

export interface Goal {
  distanceId: string;
  raceDate: IsoDate;
  raceName?: string;
  /** Prvi dan plana; bez njega plan počinje sutradan od `RunnerState.today`. */
  startDate?: IsoDate;
  /** Ciljno vreme; utiče samo na upozorenja i tekst trke, ne na doze (§ 7.6). */
  targetTimeSec?: Seconds;
}

export interface PlanHeader {
  goal: Goal;
  /** Prvi dan plana. */
  startDate: IsoDate;
  /** Podaci distance po kojima je plan nastao. */
  policyId: string;
  policyVersion: string;
  form: FormHeader;
  paces: Paces;
  decisions: Decisions;
  /** Upozorenja pri nastanku i posle izmena; ostaju u zaglavlju (AGENTS t. 6). */
  warnings: Warning[];
  /** Lični plan vlasnika: motor ga nikad ne menja sam (AGENTS t. 8c). */
  protected: boolean;
  /** Događaji koji su već primenjeni (idempotentnost, § 6.4). */
  appliedEvents: EventId[];
  /** Dan do kog je istorija već uzeta u obzir (nastanak ili preuzimanje plana). */
  eventsFrom: IsoDate;
  /** Uzroci spremnosti i ponovljene doze koji važe za plan (§ 6.5); dan u prozoru izmene se gradi iz namere + ovoga.
      Upisuje ih `plan` (iz stanja) i `replan` (iz primenjenih događaja); bez njih je lista prazna. */
  adjustments?: Adjustment[];
}

/** Trajna posledica događaja po kojoj se dani grade iznova (§ 6.4, § 6.5). `source` je `id` događaja ili `'plan'`. */
export type Adjustment =
  /** `lastLongSec`: poslednji odrađeni dugi pre uzroka (plafon dugog u rampi, § 14.6); 0 ili bez njega = nepoznat. */
  | { kind: 'effort'; source: string; date: IsoDate; durationSec: Seconds; lastLongSec?: Seconds }
  | {
      kind: 'pause';
      source: string;
      from: IsoDate;
      to: IsoDate;
      reason?: Pause['reason'];
      lastLongSec?: Seconds;
    }
  | { kind: 'pain'; source: string; date: IsoDate; level: number; lastLongSec?: Seconds }
  | { kind: 'fatigue'; source: string; date: IsoDate }
  /** Propušten ključan trening: dan `dayId` ponavlja propuštenu dozu ili dužinu (§ 6.4). */
  | { kind: 'repeat'; source: string; dayId: DayId; workSec?: Seconds; lengthSec?: Seconds };

export interface PlanDoc {
  schema: 'plan-doc';
  version: typeof PLAN_DOC_VERSION;
  engineVersion: string;
  header: PlanHeader;
  weeks: PlanWeek[];
}

/* ------------------------------------------------------------------ RunnerState (§ 2) */

export interface Lap {
  role: 'work' | 'recovery' | 'other';
  distanceM: Meters;
  durationSec: Seconds;
  avgHr?: number;
}

export interface KmSplit {
  paceSec: SecPerKm;
  hr?: number;
}

/** Jedno odrađeno trčanje. Obavezno: id, datum, dužina, trajanje. */
export interface Run {
  id: RunId;
  date: IsoDate;
  distanceM: Meters;
  durationSec: Seconds;
  /** Dan plana za koji je trčanje vezano; nema ga trčanje van plana. */
  dayId?: DayId;
  /** Trka ili test punim naporom (korisnik ili dan plana vrste `race`/`test`). */
  effort?: 'race' | 'test';
  avgHr?: number;
  splits?: KmSplit[];
  laps?: Lap[];
  /** Osećaj napora 1–10 koji je uneo trkač. */
  rpe?: number;
  source?: string;
  /** Šta je dan plana zadao (zona rada i zadat rad); `buildState` ga popunjava iz plana po `dayId` (§ 7.3). */
  planned?: { zone: ZoneId; workSec: Seconds };
  /** Temperatura vazduha tokom trčanja (°C). */
  tempC?: number;
}

/** Ono što trkač izjavi kad nema istorije; sve opciono. */
export interface RunnerProfile {
  weeklyKm?: number;
  easyPaceSecPerKm?: SecPerKm;
  longestRecentKm?: number;
  recentResult?: { distanceM: Meters; timeSec: Seconds; date?: IsoDate };
  beginner?: boolean;
  yearsRunning?: number;
  /** Godina rođenja (§ 14.6); motor je u prvoj verziji ne koristi. */
  birthYear?: number;
}

export interface Availability {
  /** Bar jedan dan. */
  runDays: Weekday[];
  /** Mora biti među `runDays`. */
  longDay: Weekday;
}

export interface WeekSummary {
  start: IsoDate;
  load: LoadPoints;
  distanceM: Meters;
  durationSec: Seconds;
  runs: number;
  longestSec: Seconds;
}

/** Model opterećenja (§ 5.3): dve eksponencijalne sredine dnevnog opterećenja, BO/dan. */
export interface LoadState {
  /** Baza: vremenska konstanta 42 dana. */
  chronic: number;
  /** Umor: vremenska konstanta 7 dana. */
  acute: number;
  asOf: IsoDate;
  /** true: nema istorije, vrednosti su iz izjave trkača ili podrazumevane. */
  seeded: boolean;
}

/** Najjači skorašnji napor i prekidi iz kojih motor izvodi povratak (§ 6.5). */
export interface HardEffort {
  date: IsoDate;
  durationSec: Seconds;
  distanceM: Meters;
}
export interface Pause {
  /** Prvi i poslednji dan bez trčanja. */
  from: IsoDate;
  to: IsoDate;
  reason: 'bolest' | 'put' | 'povreda' | 'nepoznato';
}
export interface PainFlag {
  date: IsoDate;
  /** 1–10. */
  level: number;
  part?: string;
  /** Datum kad je trkač javio da je prošlo. */
  resolvedOn?: IsoDate;
}

export interface FormChange {
  date: IsoDate;
  signal: 'trka' | 'test' | 'kvalitet' | 'trend-pulsa' | 'pauza' | 'izjava';
  before: Vdot;
  after: Vdot;
  /** Rečenica za trkača („zašto se promenilo"). */
  reason: string;
  runId?: RunId;
}

/** Izlaz `fitness/` (§ 7). */
export interface FormEstimate {
  start: FormPoint;
  current: FormPoint;
  raceDay: { lowSec: Seconds; expectedSec: Seconds; highSec: Seconds };
  /** Najveći očekivani napredak do trke, u VDOT. */
  ceilingGain: number;
  history: FormChange[];
}

/** Sve što motor sme da zna o trkaču DANAS. Izvedena polja računa `buildState` (§ 2.3), motor ih ne preračunava. */
export interface RunnerState {
  today: IsoDate;
  availability: Availability;
  profile: RunnerProfile;
  /** Sva poznata trčanja, hronološki; može biti prazno. */
  runs: Run[];
  /* izvedeno */
  /** Poslednjih 12 kalendarskih nedelja, najstarija prva (prazne nedelje imaju nule). */
  weeks: WeekSummary[];
  load: LoadState;
  /** Najduže trčanje u poslednjih 28 dana; 0 kad nema podataka. */
  longestRecentSec: Seconds;
  form: FormEstimate;
  lastHardEffort: HardEffort | null;
  /** Prekidi od 3+ dana u poslednjih 42 dana. */
  pauses: Pause[];
  pain: PainFlag[];
}

/* ------------------------------------------------------------------ Event (§ 3) */

interface EventBase {
  /** Determinističan: `<vrsta>:<datum>[:<dan ili trčanje>]`. */
  id: EventId;
  date: IsoDate;
}

export type PlanEvent =
  | (EventBase & { kind: 'result'; runId: RunId })
  | (EventBase & { kind: 'missed'; dayId: DayId })
  | (EventBase & { kind: 'pause'; from: IsoDate; to: IsoDate; reason: Pause['reason'] })
  | (EventBase & { kind: 'pain'; level: number; part?: string })
  | (EventBase & { kind: 'fatigue'; source: 'trkac' | 'opterecenje' })
  | (EventBase & { kind: 'manual-edit'; dayId: DayId })
  | (EventBase & { kind: 'goal-change'; goal: Goal })
  | (EventBase & { kind: 'availability-change'; availability: Availability })
  | (EventBase & { kind: 'form-update'; vdot: Vdot })
  | (EventBase & { kind: 'none' });

export type PlanEventKind = PlanEvent['kind'];

/* ------------------------------------------------------------------ objašnjenje promene (§ 10) */

export interface Change {
  /** Događaj koji je uzrok. */
  eventId: EventId;
  scope: 'dan' | 'nedelja' | 'zaglavlje';
  dayId?: DayId;
  weekIndex?: number;
  what:
    | 'skraceno'
    | 'kvalitet-u-lagano'
    | 'odmor'
    | 'doza-ponovljena'
    | 'tempa'
    | 'raspored'
    | 'cilj'
    | 'obim'
    | 'upozorenje';
  before: string;
  after: string;
  /** Rečenica za trkača: šta se desilo → šta je promenjeno → do kada važi. */
  reason: string;
  /** Poslednji dan na koji promena utiče. */
  until: IsoDate;
}

export interface ReplanResult {
  doc: PlanDoc;
  /** Prazno = plan je bajt-isti kao ulazni. */
  changes: Change[];
}

/* ------------------------------------------------------------------ čuvar (§ 8) */

export interface Finding {
  check: string;
  weekIndex: number | null;
  dayId: DayId | null;
  message: string;
}

/** Jedino što se odbija: neispravan unos (§ 8.1). */
export type InputErrorCode =
  | 'datum-neispravan'
  | 'trka-u-proslosti'
  | 'nema-dana'
  | 'dugi-van-dana'
  | 'broj-neispravan'
  | 'nepoznata-distanca';

export interface InputError {
  code: InputErrorCode;
  field: string;
  message: string;
}

export type PlanResult = { ok: true; doc: PlanDoc } | { ok: false; errors: InputError[] };

/* ------------------------------------------------------------------ biblioteka i šablon (§ 4) */

/** Jedinica u kojoj se zadaje komad rada. */
export type WorkUnit = 'trajanje' | 'duzina';

export type RecoverySpec = { extent: Extent; mode: 'dzog' | 'hod' | 'stajanje' };

/** Oblik glavnog dela; doza (sekunde rada) ga skalira (§ 4.3). */
export type MainSet =
  /** Ceo trening u jednoj zoni; trajanje = budžet dana (lagano, lagan dugi). */
  | { kind: 'steady'; zone: ZoneId }
  /** Jedan komad rada = doza. `by`: jedinica komada; bez nje kao lagani dani (`presentation`). */
  | { kind: 'continuous'; zone: ZoneId; by?: WorkUnit }
  /** Doza podeljena na `pieces` jednakih komada. */
  | { kind: 'split'; zone: ZoneId; pieces: number; recovery: RecoverySpec; by?: WorkUnit }
  /** Deonice stalne dužine; broj = doza / trajanje deonice, u granicama. */
  | {
      kind: 'reps';
      zone: ZoneId;
      rep: Extent;
      recovery: RecoverySpec;
      minReps: number;
      maxReps: number;
    }
  /** Stalna lestvica; uzima se najduži početak koji staje u dozu. */
  | { kind: 'ladder'; zone: ZoneId; reps: Extent[]; recovery: RecoverySpec }
  /** Dugi: lagano, pa blok doze na kraju. */
  | { kind: 'finish-block'; zone: ZoneId; by?: WorkUnit }
  /** Dugi: poslednji deo (doza) progresivno od lagano do zone. */
  | { kind: 'progressive'; zone: ZoneId; by?: WorkUnit }
  /** Mali podražaj uz lagan dan (ubrzanja, kratki usponi); doza je stalna. */
  | {
      kind: 'add-on';
      zone: ZoneId;
      count: number;
      rep: Extent;
      recovery: RecoverySpec;
      place: 'kraj' | 'sredina';
    }
  /** Test ili pripremna trka na zadatu dužinu. */
  | { kind: 'all-out'; distanceM: Meters };

export interface Requirements {
  minVdot?: Vdot;
  maxVdot?: Vdot;
  /** Najmanje bazno nedeljno opterećenje trkača. */
  minBaseLoad?: LoadPoints;
  phases?: PhaseId[];
  levels?: LevelId[];
  minRunDays?: number;
  /** Raspon doze u kom je unos smislen (sekunde rada). */
  minDoseSec?: Seconds;
  maxDoseSec?: Seconds;
  /** true: unos se ne bira dok su tempa „po osećaju" (`Paces.byFeel`). Podrazumevano false. */
  needsKnownPaces?: boolean;
}

/** Unos biblioteke treninga. Nov sadržaj = nov unos, ne nov kod. */
export interface WorkoutDef {
  id: string;
  kind: WorkoutKind;
  /** Glavna oznaka: po njoj se unos bira. */
  stimulus: StimulusTag;
  /** Dodatne oznake (teren, oblik); služe samo filteru `prefer`. */
  tags: string[];
  /** Visok udar (brda, kratke brze deonice): izostaje dok traje bol (§ 6.5). */
  impact: 'obican' | 'visok';
  requires: Requirements;
  main: MainSet;
  /** Šablon teksta: `{n}`, `{rep}`, `{dose}`, `{rec}`, `{len}` (§ 4.6). */
  text: TextKey;
  notes?: TextKey[];
}

export interface BodyPhase {
  phase: PhaseId;
  /** Udeo nedelja tela koji pripada fazi; zbir udela = 1. */
  share: number;
  /** Niz namera; kad se potroši, nastavlja od `loopFrom`. */
  cycle: WeekIntent[];
  loopFrom: number;
}

export interface Template {
  id: string;
  levels: LevelId[];
  minWeeks: number;
  maxWeeks: number;
  minRunDays: number;
  maxRunDays: number;
  /** Koji udeo vrha odgovara sadašnjoj bazi trkača: `peakLoad = baseLoad / startPct` (§ 6.2). */
  startPct: number;
  /** Poslednjih K nedelja, stalne, brojano unazad od trke (poslednja je nedelja trke). */
  tail: WeekIntent[];
  body: BodyPhase[];
  /** Svaka N-ta nedelja tela, brojano unazad od repa, je rasterećenje; 0 = bez. */
  recoveryEvery: number;
  /** Kako se nedelja tela pretvara u rasterećenje. */
  recovery: { loadFactor: number; longFactor: number; doseFactor: number };
}

export interface LevelRule {
  id: LevelId;
  /** Svi navedeni uslovi moraju važiti; prvo pravilo koje prođe određuje nivo. */
  when: { beginner?: boolean; minVdot?: Vdot; maxVdot?: Vdot; maxBaseLoad?: LoadPoints };
}

/** Brojevi bezbednosti distance (§ 11.2). Jedan plafon po veličini. */
export interface SafetyNumbers {
  /** Najveći rast nedeljnog opterećenja u odnosu na najveću od prethodne 3 nedelje (udeo, npr. 0,08). */
  maxWeeklyRampPct: number;
  /** Rast je dozvoljen bar za ovoliko BO i kad je procenat manji. */
  minRampLoad: LoadPoints;
  /** Plafon vrha po nivou (BO nedeljno); `null` = bez plafona. */
  peakLoadCap: Readonly<Record<LevelId, LoadPoints | null>>;
  longMaxSec: Readonly<Record<LevelId, Seconds>>;
  /** Najveći udeo dugog u vrhu, po broju dana trčanja (ključ „1"…„7"). */
  longShareByRunDays: Readonly<Record<string, number>>;
  longStepSec: Seconds;
  /** Polazni dugi kao udeo bazne nedelje kad nema podatka o najdužem trčanju. */
  longStartShare: number;
  doseCaps: Readonly<Record<StimulusTag, { maxWorkSec: Seconds; shareOfPeakLoad: number }>>;
  /** Napredovanje doze kad šablon ne zada `dosePct`. */
  progression: Readonly<Record<StimulusTag, { startPct: number; stepPct: number }>>;
  /** Doza ispod ove se ne trči kao kvalitet (postaje lagan dan sa malim podražajem). */
  minDoseSec: Seconds;
  /** Najveći udeo brzog rada u vremenu nedelje; posebno za nedelju vrste `peak`. */
  maxFastShare: number;
  maxFastSharePeak: number;
  minEasySec: Seconds;
  easyMaxShareOfLong: number;
  dayBeforeLongMaxShare: number;
  /** Zagrevanje i hlađenje po baznom opterećenju: prvi red čiji `uptoBaseLoad` ≥ baza (poslednji red `null`). */
  warmupCooldown: { uptoBaseLoad: LoadPoints | null; warmupSec: Seconds; cooldownSec: Seconds }[];
}

/** Šta je adekvatna priprema za distancu — izvor brojeva za upozorenja (§ 8.3). */
export interface AdequatePrep {
  minWeeks: number;
  minPeakWeeklyKm: number;
  minRunDays: number;
  minLongKm: number;
  /** Kraća distanca koja se predlaže kad priprema nije dovoljna. */
  shorter?: { distanceId: string; label: string };
}

export interface NoteRule {
  kinds: WorkoutKind[];
  minDurationSec: Seconds;
  text: TextKey;
}

/** Sve što folder distance isporučuje motoru (§ 11). */
export interface DistanceData {
  id: string;
  version: string;
  distanceM: Meters;
  label: string;
  levels: LevelRule[];
  templates: Template[];
  library: WorkoutDef[];
  safety: SafetyNumbers;
  adequate: AdequatePrep;
  noteRules: NoteRule[];
  presentation: {
    /** Lagani i dugi se zadaju trajanjem kad je lagani tempo sporiji od ovoga; inače dužinom. */
    byDurationAboveSecPerKm: SecPerKm;
  };
  texts: Readonly<Record<TextKey, string>>;
}

/* ------------------------------------------------------------------ ugovori funkcija (§ 6, § 7, § 9) */

export type PlanFn = (state: RunnerState, goal: Goal, data: DistanceData) => PlanResult;
export type ReplanFn = (
  doc: PlanDoc,
  state: RunnerState,
  events: readonly PlanEvent[],
  data: DistanceData
) => ReplanResult;
export type DeriveEventsFn = (doc: PlanDoc, state: RunnerState) => PlanEvent[];
export type GuardFn = (doc: PlanDoc, state: RunnerState, data: DistanceData) => Finding[];

/** Ulaz `buildState`: činjenice bez izvedenih polja. */
export interface RunnerFacts {
  today: IsoDate;
  availability: Availability;
  profile: RunnerProfile;
  runs: Run[];
  pauses: Pause[];
  pain: PainFlag[];
  /** Bol u poslednjih 12 meseci (§ 14.6); koristi ga `fitness/`, motor ga u prvoj verziji ne čita. */
  painHistory?: PainFlag[];
}
/** `estimate`: procena forme (`fitness/`); bez nje motor koristi najprostiju procenu iz izjave (§ 2.4). */
export type BuildStateFn = (
  facts: RunnerFacts,
  goal: Goal,
  data: DistanceData,
  estimate?: EstimateFormFn,
  /** Postojeći plan: iz njega se popunjava `Run.planned` i izvode pauze (§ 2.3). */
  doc?: PlanDoc
) => RunnerState;
export type EstimateFormFn = (
  facts: RunnerFacts,
  goal: { distanceM: Meters; raceDate: IsoDate },
  planned: { baseLoad: LoadPoints; peakLoad: LoadPoints } | null
) => FormEstimate;

/** Adapter starog formata (§ 9): jedino mesto koje zna stari oblik; `TLegacy` je njegov ulaz. */
export interface Adopted {
  doc: PlanDoc;
  facts: RunnerFacts;
}
export type AdoptFn<TLegacy> = (legacy: TLegacy, today: IsoDate) => Adopted;
/** Kanonski otisak plana kao tekst (§ 9.2); adapter mora dati isti otisak pre i posle. */
export type FingerprintFn = (doc: PlanDoc, facts: RunnerFacts) => string;
