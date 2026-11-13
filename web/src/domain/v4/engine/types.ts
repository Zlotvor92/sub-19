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
  /** Talas (krug 4, T3): kad dugi ne može da raste (plafon, polazni dugi), odlučen dugi × `wave` (0,8–1) — da dugi
      ne stoji isti nedeljama. */
  wave?: number;
}

export interface StimulusSlot {
  stimulus: StimulusTag;
  /** Doza kao udeo plafona podražaja (0–1). Bez nje: lestvica napredovanja iz podataka (§ 4.4). */
  dosePct?: number;
  /** Izričit unos biblioteke (preskače izbor po oznakama). */
  workoutId?: string;
  /** true: mesto postoji samo dok su tempa „po osećaju" (rani test forme); inače je dan lagan. */
  onlyByFeel?: boolean;
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
  /** Obim nedelje u minutima (cilj bez dodatka kvaliteta; krug 4, S1/S2): kad budžet brzog rada skrati rad,
      oslobođeni bodovi ne postaju minuti, pa čuvar meri manjak prema obimu. Stari planovi ga nemaju. */
  volumeMin?: number;
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
  /** Lična kriva forme po dužini (F4-K2) po kojoj su računata tempa: `paceVdot` važi na `refM`. Bez nje β = 0. */
  transfer?: Transfer;
}

/** Lična kriva forme po dužini (F4-K2): VDOT na dužini d = VDOT na `refM` + β · ln(refM / d). */
export interface Transfer {
  /** VDOT po jedinici ln dužine (naniže, ka dužoj trci, pun iznos). */
  beta: number;
  /** β je delom iz trkačevih rezultata na dve dužine; bez toga se naviše (ka kraćoj dužini) uzima pola. */
  personal: boolean;
  /** Dužina na kojoj važi referentni VDOT (dužina cilja). */
  refM: Meters;
  /** Prelom krive: dužina poslednjeg dokaza (rezultata). Ka kraćem od nje pola β (bez ličnog), ka dužem pun β.
      Bez njega = `refM`. */
  anchorM?: Meters;
  /** Prelom je na unetom rezultatu bez istorije: naniže najviše `TRANSFER_DOWN_MAX_SEC` (odluka F4-K2). */
  capDown?: boolean;
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
  /** M3 (krug 5): prognoza dana trke bez napretka od obima (nalaz `dugi-za-distancu`) i faktor širenja raspona
      (kratak staž); ispis i plan ih primenjuju istom funkcijom (`adjustRaceDay`). */
  raceDayNoProgress?: boolean;
  /** T7 (krug 6): polazni dugi je iz stvarnih trčanja (poslednje 4 nedelje) — dugi kreće od njega. */
  longStartFromRuns?: boolean;
  raceDayWiden?: number;
  /** Bazno nedeljno opterećenje trkača na dan nastanka plana. */
  baseLoad: LoadPoints;
  /** Vrh nedeljnog opterećenja plana. */
  peakLoad: LoadPoints;
  longMaxSec: Seconds;
  /** Polazni dugi (trajanje). */
  longStartSec: Seconds;
  /** Plafon doze po podražaju, sekunde rada po treningu. */
  doseCapSec: Readonly<Record<StimulusTag, Seconds>>;
  /** Osnovica lestvice doze (krug 4, S4): `shareOfPeakLoad × P`, bez plafona nivoa; doza mesta =
      `min(doseCapSec, dosePct × doseBaseSec)`. Stari planovi je nemaju — tada je osnovica plafon. */
  doseBaseSec?: Readonly<Record<StimulusTag, Seconds>>;
  /** Množilac vrha iz lestvice (S2), zapamćen da preračun posle pauze koristi isti. */
  peakOverBase?: number;
  /** Polazni obim u minutima kad je istorija merodavna (S8a): lanac rasta kreće od stvarnih minuta, ne od bodova
      (trkač koji sve trči brže ima više bodova nego minuta). Nema ga: lanac kreće od `baseLoad`. */
  baseVolumeMin?: number;
  /** Stvarni prosek km iz istorije (S8a) — „Polazim od ≈ N km". */
  baseKm?: number;
  /** Tegoba u poslednjih 12 meseci (S8e): bez unosa visokog udara prve 4 nedelje. */
  painCaution?: boolean;
  warmupSec: Seconds;
  cooldownSec: Seconds;
  runDays: Weekday[];
  longDay: Weekday;
  /** Dani kvaliteta po pravilu rasporeda (§ 4.6), po prioritetu (Q1, Q2, …). */
  qualityDays: Weekday[];
  /** Činjenice iz istorije na dan nastanka plana (personalizacija); nema ih kad istorija nije poznata. */
  recentQualityWeeks?: number;
  weeksSincePause?: number;
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
  /** Polja starog plana koja adapter prenosi doslovno; motor ih ne čita, ulaze u kanonsku serijalizaciju. */
  legacy?: Readonly<Record<string, unknown>>;
}

/** Trajna posledica događaja po kojoj se dani grade iznova (§ 6.4, § 6.5). `source` je `id` događaja ili `'plan'`. */
export type Adjustment =
  /** `lastLongSec`: poslednji odrađeni dugi pre uzroka (plafon dugog u rampi, § 14.6); 0 ili bez njega = nepoznat. */
  | {
      kind: 'effort';
      source: string;
      date: IsoDate;
      durationSec: Seconds;
      lastLongSec?: Seconds;
      /** Pun napor IZ PLANA (provera forme, pripremna trka): važi samo § 14.1 — 3 dana bez ičeg brzog, bez rampe
          i bez „prvi kvalitet × 0,8" (treći krug). */
      planned?: boolean;
    }
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
  | {
      kind: 'repeat';
      source: string;
      dayId: DayId;
      workSec?: Seconds;
      lengthSec?: Seconds;
      /** Dugi `dayId` dobija blok ove doze (prethodni korak lestvice; krug 2, R8b) iz unosa `blockDefId`. */
      blockSec?: Seconds;
      blockDefId?: string;
      /** Dugi `dayId` ostaje bez bloka (više propuštenih dugih zaredom; krug 2, R8c). */
      noBlock?: boolean;
    };

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
  planned?: {
    zone: ZoneId;
    workSec: Seconds;
    /** Planirano trajanje i opterećenje celog treninga: trčanje bez krugova se boduje planiranom prosečnom težinom
        kad je odrađeno ≥ 90 % planiranog trajanja (odluka organizatora, drugi krug). */
    durationSec?: Seconds;
    load?: LoadPoints;
  };
  /** Temperatura vazduha tokom trčanja (°C). */
  tempC?: number;
  /** U trci ili testu je bilo hodanja: rezultat je slabiji dokaz forme (krug 2, R14). */
  walked?: boolean;
  /** Izričit rezultat punog napora koji je uneo trkač (vreme i, po želji, dužina deonice): ima prednost nad
      svim što se izvodi iz aktivnosti (krug 3, K1). Bez dužine važi planirana deonica dana, inače cela aktivnost. */
  resultSec?: Seconds;
  resultDistanceM?: Meters;
  /** Dužina deonice punog napora koju je dan plana zadao (provera forme, pripremna trka); popunjava `buildState`
      iz plana po `dayId` (krug 3, K1). */
  plannedEffortM?: Meters;
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
  /** `plan`: odrađen plan kao dokaz; `baza`: pad baze bez prekida (krug 2, R12–R13). */
  signal: 'trka' | 'test' | 'kvalitet' | 'trend-pulsa' | 'pauza' | 'izjava' | 'plan' | 'baza';
  before: Vdot;
  after: Vdot;
  /** Rečenica za trkača („zašto se promenilo"). */
  reason: string;
  runId?: RunId;
  /** Rezultat nije mogao da se uzme kao dokaz forme (npr. test upisan kao jedna aktivnost sa zagrevanjem): procena
      se ne menja, a rečenica kaže šta trkač treba da unese (krug 3, K1). */
  ignored?: boolean;
}

/** Izlaz `fitness/` (§ 7). */
export interface FormEstimate {
  start: FormPoint;
  current: FormPoint;
  raceDay: { lowSec: Seconds; expectedSec: Seconds; highSec: Seconds };
  /** Najveći očekivani napredak do trke, u VDOT. */
  ceilingGain: number;
  history: FormChange[];
  /** Lična kriva forme po dužini (F4-K2); bez nje motor uzima β = 0 (jedan VDOT za sve dužine). */
  transfer?: Transfer;
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
  /** Broj nedelja (od poslednjih 8) sa bar jednim trčanjem bržim od laganog; `null` = nema trčanja u tom periodu
      (nepoznato). Personalizacija: pravila nivoa i zahtevi unosa mogu da ga koriste (krug 3). */
  recentQualityWeeks?: number | null;
  /** Cele nedelje od kraja poslednje pauze; `null` = pauze nije bilo. */
  weeksSincePause?: number | null;
  /** Bol u poslednjih 12 meseci (krug 4, S2/S8e: opreznost rasta i izbora). */
  painHistory?: PainFlag[];
  /** Prosek km i minuta poslednje 4 cele nedelje kad je istorija merodavna (krug 4, S8a); nema ih kad nije. */
  historyWeeklyKm?: number;
  historyWeeklyMin?: number;
  /** Prosečan lagani tempo istorije brži od brže granice laganog (krug 4, S8d). */
  easyTooFast?: boolean;
  /** Neispravan unos koji je `buildState` morao da preskoči da bi izračunao stanje (datum, nivo bola…); `plan` ga
      vraća kao `errors` (krug 3, O5). Nema ga kad je unos ispravan. */
  inputErrors?: readonly InputError[];
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
    | 'upozorenje'
    /** Događaj ne menja treninge, ali trkač dobija rečenicu (propušten ključni trening, krug 2, R8). */
    | 'obavestenje';
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

export interface Requirements extends HistoryConditions {
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
  /** true: unos se bira SAMO dok su tempa „po osećaju" (rani test forme). Podrazumevano false. */
  onlyByFeel?: boolean;
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

/** Uslovi iz istorije trčanja (personalizacija, krug 3). Kad je činjenica nepoznata (nema istorije), uslov NE
    važi — pravilo ili unos sa takvim uslovom se preskače, pa ponašanje bez istorije ostaje isto. */
export interface HistoryConditions {
  /** Broj nedelja (od poslednjih 8) sa bar jednim trčanjem bržim od laganog. */
  minRecentQualityWeeks?: number;
  maxRecentQualityWeeks?: number;
  /** Cele nedelje od kraja poslednje pauze. */
  minWeeksSincePause?: number;
  maxWeeksSincePause?: number;
}

export interface LevelRule {
  id: LevelId;
  /** Svi navedeni uslovi moraju važiti; prvo pravilo koje prođe određuje nivo. */
  when: {
    beginner?: boolean;
    minVdot?: Vdot;
    maxVdot?: Vdot;
    maxBaseLoad?: LoadPoints;
    /** Staž (nedelje, iz `profile.yearsRunning`) najviše ovoliko; nepoznat staž ne ispunjava uslov (krug 4, T1). */
    maxTenureWeeks?: number;
  } & HistoryConditions;
}

/** Brojevi bezbednosti distance (§ 11.2). Jedan plafon po veličini. */
export interface SafetyNumbers {
  /** Najveći rast nedeljnog opterećenja u odnosu na najveću od prethodne 3 nedelje (udeo, npr. 0,08). */
  maxWeeklyRampPct: number;
  /** Rast je dozvoljen bar za ovoliko BO i kad je procenat manji. */
  minRampLoad: LoadPoints;
  /** Plafon vrha po nivou (BO nedeljno); `null` = bez plafona. */
  peakLoadCap: Readonly<Record<LevelId, LoadPoints | null>>;
  /** Vrh najviše ovoliko puta bazna nedelja (krug 2, R3). Podrazumevano `DEFAULT_MAX_PEAK_OVER_BASE` (1,40). */
  maxPeakOverBase?: number;
  /** LESTVICA VRHA (krug 4, S2): množilac vrha (bodovi) po polaznom obimu (km) i dužini pripreme; prvi red čiji je
      `maxBaseKm` ≥ polazni obim (ili `null`) i `minWeeks` ≤ broj nedelja. `limitedOverBase` važi za trkača sa
      stažom ispod `limitedTenureWeeks` ili tegobom u poslednjih 12 meseci (manje od dva). Ima prednost nad
      `maxPeakOverBase`. */
  peakLadder?: {
    rows: readonly { maxBaseKm: number | null; minWeeks: number; overBase: number }[];
    limitedOverBase?: number;
    limitedTenureWeeks?: number;
  };
  /** Rast nedelje je dozvoljen bar za ovoliko km (u minutima laganog tempa; krug 4, S2); uz `minRampLoad`. */
  minRampKm?: number;
  longMaxSec: Readonly<Record<LevelId, Seconds>>;
  /** Najveći udeo dugog u vrhu, po broju dana trčanja (ključ „1"…„7"). */
  /** Može i po nivou: `{ nivo: { "1".."7": udeo } }`; nivo bez svoje mape nema plafon po danima (udeo 1). */
  longShareByRunDays:
    Readonly<Record<string, number>> | Readonly<Record<LevelId, Readonly<Record<string, number>>>>;
  longStepSec: Seconds;
  /** Pod dugog u prvoj nedelji gradnje kao udeo polaznog dugog; raste za korak po nedelji gradnje (krug 5, D1/D6).
      Bez njega dugi gradnje nije ispod polaznog od prve nedelje. */
  longStartFloorShare?: number;
  /** P2 (krug 5): `longStartFloorShare` važi samo kad je polazni dugi ≥ ovoliki deo najdužeg dozvoljenog. */
  longStartFloorFromCapShare?: number;
  /** Pod dugog raste do polaznog samo uz bar ovoliko dana; manje dana — pod ostaje `longStartFloorShare` (D6). */
  longFloorGrowMinRunDays?: number;
  /** Pod dugog raste i posle polaznog (pola koraka nedeljno) samo za ove nivoe i bar ovoliko dana (D1). */
  longGrowPastStart?: { minRunDays: number; levels: readonly LevelId[] };
  /** Korak dugog i u km (u trajanju laganog tempa); važi veće od ta dva (krug 4, S2). */
  longStepKm?: number;
  /** Udeo dugog kod malog obima (krug 4, S3): nedelja ispod `belowKm` (planirani km) uz bar `minRunDays` dana ima
      udeo `share` (u minutima), a u najviše `peakWeeks` nedelja (najduži dugi namere, kasnije prvo) `peakShare`. */
  longShareLowVolume?: {
    belowKm: number;
    minRunDays: number;
    share: number;
    peakShare: number;
    peakWeeks: number;
    /** Od `belowKm` do `midKm` (procena km) udeo `midShare` (dopuna kruga 4, D4). */
    midKm?: number;
    midShare?: number;
  };
  /** Polazni dugi kao udeo bazne nedelje kad nema podatka o najdužem trčanju. */
  /** Broj, ili mapa po broju dana trčanja („1"…„7"). Polazni dugi = veće od ovoga i najdužeg skorašnjeg trčanja. */
  longStartShare: number | Readonly<Record<string, number>>;
  /** `maxWorkSec` je broj ili mapa po nivou (krug 4, S4: plafon doze po nivou; nivo bez broja: `*` ili bez plafona). */
  doseCaps: Readonly<
    Record<
      StimulusTag,
      { maxWorkSec: Seconds | Readonly<Record<LevelId, Seconds>>; shareOfPeakLoad: number }
    >
  >;
  /** Dugi prema vremenu trke (krug 5, D3): za očekivano vreme ≥ `fromRaceSec` dugi ≤ vreme trke + `overSec`, a blok
      ili progresija u dugom ≤ `blockMaxSec`. */
  longVsRace?: { fromRaceSec: Seconds; overSec: Seconds; blockMaxSec: Seconds };
  /** Najviše rada u jednoj zoni nedeljno po nivou (krug 5, D7: tempo trke uklj. blok u dugom); nivo bez broja
      nema plafon. */
  weeklyZoneMaxSec?: {
    zone: ZoneId;
    byLevel: Readonly<Record<LevelId, Seconds>>;
    /** Podražaj koji dobija mesto kad plafon zone ne ostavi dozu (krug 4 dopuna). */
    fallbackStimulus?: StimulusTag;
    /** Ostatak plafona ispod ovoga (s) ide celim u zamenski podražaj (M1). */
    minLeftSec?: Seconds;
  };
  /** M6 (krug 5): toliko dana pre provere forme nema kvaliteta. */
  noQualityBeforeTestDays?: number;
  /** D8 (krug 4 dopuna): prag i tempo trke bliži od ovoga (s/km) se ne zadaju u istoj nedelji. */
  minZoneGapSecPerKm?: number;
  /** Podražaj koji zamenjuje prag u nedelji sa tempom trke kad su bliski (P4). */
  zoneGapReplacement?: StimulusTag;
  /** E2 (krug 4 dopuna): skraćena nedelja — dugi ≤ ovoliki deo nedelje u km (4+ dana). */
  shortenedLongMaxShare?: number;
  /** Trka/test do ovoliko sekundi (i van plana) dobija oporavak kao planirana provera forme (krug 5, E5). */
  shortEffortSec?: Seconds;
  /** R8 t. 15: blok u dugom ne skraćuje dugi ispod ovog udela vremena nedelje (bez: 0,25). */
  longBlockMinWeekShare?: number;
  /** R8 t. 8: start trke — `{paceFrom}`–`{paceTo}` u napomeni trke je tempo trke + ovoliko s/km (bez: 5 i 10). */
  raceStartPaceOffsetSec?: { from: number; to: number };
  /** Bol od ovog nivoa vraća obim kao posle pauze; niži menja samo dane u prozoru zaštite (krug 5, E4).
      Podrazumevano 4. */
  painReturnFromLevel?: number;
  /** Silazak intenziteta pred trku (krug 5, E9): u danima [trka − `weekBeforeFromDays`, trka − `lastDays` − 1]
      najviše `weekBeforeMaxQuality` brzih treninga (blok u dugom se broji) i brz rad ≤ `weekBeforeMaxOfPeak` ×
      brz rad vršne nedelje; u poslednjih `lastDays` dana samo oštrenje. */
  taper?: {
    lastDays: number;
    weekBeforeFromDays: number;
    weekBeforeMaxQuality: number;
    weekBeforeMaxOfPeak: number;
    /** M7 (krug 5): kalendarska nedelja dve pred nedeljom trke ≤ ovoliki deo vršne nedelje (km), najviše
        `calendarMinus2MaxQuality` brzih treninga; nedelja trke (bez trke) ≤ `raceWeekMaxOfPeak`. */
    weekMinus2MaxOfPeak?: number;
    /** M9 (krug 5): blok poslednjeg dugog pred trku ne pada ispod ovoga (sekunde), kad šablon traži blok. */
    lastLongMinBlockSec?: Seconds;
    calendarMinus2MaxQuality?: number;
    raceWeekMaxOfPeak?: number;
  };
  /** Oštrenje nedelje trke (krug 4, S1): podražaj van budžeta brzog rada, doza uvek u [minSec, maxSec]. */
  sharpening?: { stimulus: StimulusTag; minSec: Seconds; maxSec: Seconds };
  /** Napredovanje doze kad šablon ne zada `dosePct`. */
  progression: Readonly<Record<StimulusTag, { startPct: number; stepPct: number }>>;
  /** Doza ispod ove se ne trči kao kvalitet (postaje lagan dan sa malim podražajem). */
  minDoseSec: Seconds;
  /** Najveći udeo brzog rada u vremenu nedelje; posebno za nedelju vrste `peak`. */
  maxFastShare: number;
  maxFastSharePeak: number;
  minEasySec: Seconds;
  /** M5 (krug 5): najkraće lagano trčanje po nivou, u minutima; nivo bez unosa koristi `minEasySec`. */
  minEasyMin?: Readonly<Record<LevelId, number>>;
  /** P3 (krug 5): sporiji od `fromRaceSec` na distanci — tempo intervala ne brži od tempa trke na `distanceM`. */
  intervalPaceFloor?: { distanceM: Meters; fromRaceSec: Seconds };
  /** P3 (krug 5): kvalitet sa oznakom `tag` najviše `max` od `window` nedelja zaredom; inače `replacement`. */
  tagMaxRun?: ReadonlyArray<{ tag: string; max: number; window: number; replacement: StimulusTag }>;
  /** T6 (krug 6): vršna nedelja nije ispod polaznog obima (mali manjak nadoknađuju lagani dani). */
  peakNotBelowBase?: boolean;
  /** Z8 (krug 7): kad traženi dani sa `minEasyMin` ne staju u obim, lagan dan sme do ovoliko minuta (dan se ne ispušta). */
  minEasyFallbackMin?: number;
  /** Od koliko dana trčanja nedeljno važi `minEasyMin`. */
  minEasyFromRunDays?: number;
  /** Lagan dan najviše ovoliki udeo dugog te nedelje; broj, ili mapa po broju dana trčanja („1"…„7"). */
  easyMaxShareOfLong: number | Readonly<Record<string, number>>;
  dayBeforeLongMaxShare: number;
  /** Lagan dan najviše ovoliko puta najduži lagan dan prethodne nedelje koja nije rasterećenje (krug 2, R2).
      Podrazumevano `DEFAULT_EASY_MAX_OVER_PREVIOUS` (1,25). */
  easyMaxOverPrevious?: number;
  /** Najduži lagan dan u nedelji sužavanja i nedelji trke (krug 2, R1); broj, ili mapa po broju dana trčanja.
      Podrazumevano `DEFAULT_TAPER_EASY_MAX_SEC` (50 min; do 3 dana 40 min). */
  taperEasyMaxSec?: Seconds | Readonly<Record<string, Seconds>>;
  /** Zagrevanje i hlađenje po baznom opterećenju: prvi red čiji `uptoBaseLoad` ≥ baza (poslednji red `null`). */
  warmupCooldown: { uptoBaseLoad: LoadPoints | null; warmupSec: Seconds; cooldownSec: Seconds }[];
}

/** Šta je adekvatna priprema za distancu — izvor brojeva za upozorenja (§ 8.3). */
export interface AdequatePrep {
  minWeeks: number;
  minPeakWeeklyKm: number;
  minRunDays: number;
  minLongKm: number;
  /** Dugi je dovoljan i kad traje bar ovoliko (krug 4, S3: „15 km ili 1 h 50"). */
  minLongSec?: Seconds;
  /** Dugi za distancu u km za proveru `dugi-za-distancu` (S3); bez njega `minLongKm`. */
  longCheckKm?: number;
  /** Provera `dugi-za-distancu` važi za plan od bar ovoliko nedelja (S3). */
  longCheckMinWeeks?: number;
  /** Staž (nedelje) ispod koga trkač nosi upozorenje i širi raspon (S8e). */
  minTenureWeeks?: number;
  /** Vrh nedeljnog obima (km) koji nivo traži da bi kvalitet tog nivoa stao u plan (upozorenje `obim-za-nivo`,
      krug 2, R11); nivo bez broja: obim pri kom plafoni doza prestaju da zavise od obima. */
  minPeakWeeklyKmByLevel?: Readonly<Record<LevelId, number>>;
  /** Kraća distanca koja se predlaže kad priprema nije dovoljna. */
  shorter?: { distanceId: string; label: string };
}

export interface NoteRule {
  kinds: WorkoutKind[];
  minDurationSec: Seconds;
  text: TextKey;
  /** Tekst iste napomene za trkača čija su tempa „po osećaju" (bez s/km); bez njega važi `text`. */
  byFeelText?: TextKey;
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
/** Šta plan nosi za procenu forme (§ 7.1): baza i vrh, i — za postojeći plan — ciljevi nedelja, da sužavanje pred
    trku ne izgleda kao manjak odrađenog (krug 2). */
export interface FormPlanned {
  baseLoad: LoadPoints;
  peakLoad: LoadPoints;
  /** `PlanWeek.start` i `targetLoad` (bez dana trke). */
  weeks?: readonly { start: IsoDate; targetLoad: LoadPoints }[];
  /** Lična kriva po kojoj je plan zadao tempa i pun napor (F4-K2): rezultat se poredi sa očekivanim po njoj. */
  transfer?: Transfer;
}
export type EstimateFormFn = (
  facts: RunnerFacts,
  goal: { distanceM: Meters; raceDate: IsoDate },
  planned: FormPlanned | null
) => FormEstimate;

/** Adapter starog formata (§ 9): jedino mesto koje zna stari oblik; `TLegacy` je njegov ulaz. */
export interface Adopted {
  doc: PlanDoc;
  facts: RunnerFacts;
}
export type AdoptFn<TLegacy> = (legacy: TLegacy, today: IsoDate) => Adopted;
/** Kanonski otisak plana kao tekst (§ 9.2); adapter mora dati isti otisak pre i posle. */
export type FingerprintFn = (doc: PlanDoc, facts: RunnerFacts) => string;
