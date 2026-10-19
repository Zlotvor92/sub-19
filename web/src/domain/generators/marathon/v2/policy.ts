/* Maraton v2 — politika: svaki trenerski broj ima JEDNO mesto (ovde) i red u DECISIONS sa obrazloženjem i
   izvorom ili oznakom heuristike (docs/generators-v2/MASTER-HM-MARATHON.md § 5, M1–M15). Ostali fajlovi čitaju
   samo ovaj objekat (i `dayRule`, pristup tabeli M15); nijedan od njih ne nosi sopstveni trenerski broj. */

import type { Structure } from './types.ts';

export interface Decision {
  readonly id: string;
  readonly rule: string;
  readonly place: string;
  readonly rationale: string;
}

const DECISIONS: readonly Decision[] = [
  {
    id: 'M1',
    rule: 'Segment 01: 4 dana trčanja (M15 red 4: 35–65 km); 12–24 cele nedelje do trke; rezultat 10 km, polumaraton ili maraton (5 km dozvoljen uz upozorenje RESULT_5K) ne stariji od 84 dana, VDOT 30–80; cilj opcion.',
    place: 'input.ts',
    rationale:
      'Opseg MASTER § 5 M1. Trajno odbijanje: < 12 ned (preporuka polumaraton), < 35 km (preporuka polumaraton ili izgradnja osnove), > 65 km za 4 dana, 1/2/7 dana, VDOT > 80, trčanje/hodanje (M17). „Počni kasnije": > 24 ned. Privremeno (segment 02/03): 3/5/6 dana, bez rezultata, rezultat stariji od 84 dana, VDOT < 30, početnik — plan po osećaju i početnik dolaze u segmentu 03. 5 km rezultat: Daniels–Gilbert sa 5 km precenjuje maratonsku izdržljivost više od dužih distanci (heuristika; v. M2), zato upozorenje.'
  },
  {
    id: 'M2',
    rule: 'VDOT iz rezultata (Daniels–Gilbert); zone E 0,62–0,70, T 0,88, I 0,975, R 1,05 udela trenutnog VDOT-a; MP = tempo prognoze maratona iz VDOT-a umanjenog za korekciju obima (< 40 km −2,0; 40–59,9 km −1,0; ≥ 60 km 0); tempo fiksan kroz plan.',
    place: 'paces.ts (udeli i korekcija: paces)',
    rationale:
      'Jednačine su objavljeni model (Daniels i Gilbert 1979); udeli zona kao HM (H2, sekundarni izvor: Danielsov opis zona; R = 1,05 heuristika). Korekcija obima je heuristika (Vickers i Vertosick 2016: Riegel je kod rekreativaca preoptimističan za maraton, obim popravlja prognozu). Pojas korekcije po trenutnom obimu iz ulaza, zaokruženom na 0,1 km. Fiksno do adaptacije (segment 04).'
  },
  {
    id: 'M3',
    rule: 'Δ = VDOT cilja − maratonski VDOT (M2); Δ ≤ 0,08·N realističan, ≤ 0,16·N ambiciozan, više nerealan (upozorenje).',
    place: 'paces.ts assessGoal (pragovi: goal)',
    rationale:
      'Heuristika napretka po nedelji (MASTER M3). Tumačenje (opreznije, prihvatio organizator): poredi se sa VDOT-om umanjenim za korekciju obima (M2), istim iz kog je MP i prognoza maratona — jaz je veći ili isti. Nerealan cilj je upozorenje, ne menja tempo.'
  },
  {
    id: 'M4',
    rule: 'Poslednja nedelja trka, dve pre nje taper; B = N − 3: specifično 4 (B ≤ 12), 5 (B 13–16), 6 (B ≥ 17); baza = ceil((B − spec)/2); razvoj = ostatak.',
    place: 'periodize.ts (phases)',
    rationale:
      'Duži taper je opreznija opcija za maraton (praksa; Bosquet i sar. 2007: 8–14 dana smanjenja opšte optimalno, više sportova, specifični dokaz za maraton ograničen). 12 ned → 3/2/4/2/1, 24 ned → 8/7/6/2/1.'
  },
  {
    id: 'M5',
    rule: 'Najviše 3 uzastopne nedelje izgradnje (izuzetno 4 kad bi rasterećenje palo na prvu nedelju faze); nikad na prvoj nedelji faze, u ned 1–2, na poslednjoj pred taperom, u taperu/trkačkoj. Cilj 0,8 × poslednji ne-rasteretni; 1 kvalitet T ≈ 60 % poslednje T doze (nivo naniže, min 2,0 km) na danu Q2; dugi 0,8 × poslednji ne-rasteretni; ostali dani lagani.',
    place: 'periodize.ts (gde), week.ts + quality.ts + lengths.ts (sadržaj), volume.ts (cilj)',
    rationale:
      'Heuristika 3:1 (MASTER H5/M5, pouka 4). Raspored se bira determinističkom pretragom: najmanje rasterećenja, pa izgradnja što ranije. T 2,0 km u razvoju/specifičnoj (lestvica T cruise nema 2,0 km): ista doza druge strukture (2,0 km kontinuirano, M10).'
  },
  {
    id: 'M6',
    rule: 'Ned 1 = trenutni obim; izgradnja +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 5,0 km, korak 0,1); vrh = min(start × 1,5; start + 30; max nedelje 80 km; kapacitet). Kapacitet = stvarna konstrukcija nedelje; neizvodljiv cilj → samo ta nedelja na najbliži izvodljiv cilj (napomena). Spuštena nedelja izgradnje → CAPACITY_LIMITED.',
    place: 'volume.ts (jedini vlasnik cilja i poruke); generate.ts + validate.ts prijavljuju',
    rationale:
      'Heuristika umerenog rasta (MASTER M6; pouke 1 i 9). Kapacitet nije formula: cilj nedelje proverava stvarna konstrukcija (week.ts); granica izgradnje se ne spušta zbog jedne nedelje, sledeći rast meri se od cilja koji je nedelja stvarno dobila. Ned 1 ispod trenutnog obima samo kad je dugi ned 1 na plafonu 150 min (pouka 9).'
  },
  {
    id: 'M7',
    rule: 'Taper 2 nedelje: N−2 cilj 0,8 × vrh, MP i T ≈ 60 % poslednje doze zone (naniže; min MP 2 × 3000 m, T 2,0 km), dugi ≤ 0,65 × najduži; N−1 cilj 0,6 × vrh, MP ≈ 50 % poslednje MP doze izgradnje (min 2 × 3000 m), bez T (dan Q2 lagan), dugi ≤ 0,45 × najduži; svi dani trčanja zadržani; cilj samo naniže (najbliži izvodljiv cilj, M6).',
    place:
      'week.ts + quality.ts (taperDoses, pickTaper) + lengths.ts (taperLengths); cilj volume.ts',
    rationale:
      'Smanjen obim uz zadržan intenzitet i učestalost (Bosquet i sar. 2007, isti ograničeni dokaz kao M4). Tumačenja (prihvatio organizator): MP N−1 ≈ 50 % poslednje MP doze izgradnje (kao N−2 „poslednje doze"); minimum T tapera 2,0 km kao M5. Dublji taper (prihvatio organizator; Bosquet: smanjenje 41–60 %): dugi ≤ 0,65/0,45 × najduži + lagan ≤ dugi (pouka 2) + 1 lagan dan čine 0,8 × / 0,6 × vrh neizvodljivim u 2388 / 1548 od 4368 planova mreže 01 → ta nedelja ide na najbliži izvodljiv cilj naniže; npr. 16 ned, 45 km, VDOT 45, uto/čet/sub/ned: vrh 67,5, N−2 49,7 km (0,74 ×) umesto 54,0. Odstupanje (opreznije): kad T po pravilu ne staje u plafon M11, T otpada uz napomenu (TAPER_ZONE_DROPPED); u mreži 01 nijednom.'
  },
  {
    id: 'M7a',
    rule: 'M7 ispred M11 samo u taperu: MP doza tapera je doza iz M7 (≈ 60 % / 50 % poslednje doze, minimum 2 × 3000 m) i plafon MP 20 % (M11) se na nju ne primenjuje; jedini izuzetak od M11 u izgradnji/taperu. Napomena nedelje + upozorenje TAPER_MP_OVER_CAP.',
    place:
      'quality.ts (taperDoses — jedina funkcija doze tapera, čitaju je pickTaper i validate.ts; pouka 24); validate.ts (ZONE_CAP bez MP u taperu, TAPER_QUALITY)',
    rationale:
      'Sudar brojeva § 5 (STANI, odluka organizatora: opcija b): minimum MP tapera 2 × 3000 m > 20 % cilja kad je N−1 = 0,6 × vrh < 30 km. Mreža 01: 48 / 4368 planova (svi 12 ned / 35 km: vrh 49,7 → N−1 29,8 km, plafon 5960 m), najviše 20,1 % nedelje; ostalih 4320 planova bajt-isto (heš celog plana). Privremeno rešenje pre odluke (MP otpada) gasilo je i oštrenje trkačke nedelje (≤ MP doza N−1 = 0).'
  },
  {
    id: 'M8',
    rule: 'Trkačka nedelja: dana sa trkom = min(dani, 5), trka zamenjuje dugi; oštrenje WU + 2 × 2000 m MP (2:00) + CD na najkasnijem danu ≥ 3 dana pre trke, nesusedno poslednjem zahtevnom danu tapera, ≤ MP doza N−1 (taper bez MP → bez oštrenja); dan pred trku 20 min E + 4 × 20 s (≤ 30 min); ostali min(30 min E, najkraći lagan N−1); trka 42,2 km + WU 5 min van obima; cilj = planirano; Uslov 8 = planirano + 42,2 km.',
    place: 'week.ts (raceWeek, raceWeekRuns, raceEasyWorkout) + workouts.ts',
    rationale:
      'Fiksna trenerska heuristika (MASTER M8; pouka 5). M8 je potpuna specifikacija trkačke nedelje: plafon M11 i „lagan ≥ 5 km" (M13) se na nju ne primenjuju (tumačenje prihvatio organizator, kao 10K D8) — 30 min E je < 5 km kod sporijih (1638 / 4368 planova mreže 01). WU/CD oštrenja po pojasu M14. Ubrzanja R tempom, oporavak isti metraž (M14 R). Kad nijedan dan nije ≥ 3 dana pre trke i nesusedan taperu, oštrenja nema (odstupanje, napomena).'
  },
  {
    id: 'M9',
    rule: 'Q1, Q2 i dugi međusobno nesusedni (ciklično: nedelja i ponedeljak su susedni); dugi: dan iz ulaza, inače nedelja, inače poslednji dan trčanja; ostali dan lagan; nema rešenja → SCHEDULE_NO_RECOVERY sa predlogom.',
    place: 'schedule.ts',
    rationale:
      'Dan oporavka između zahtevnih dana (kao H9). Više rešenja: najveći razmak dugi → Q1, pa Q1 → Q2, pa raniji Q1 (tehnički, deterministički izbor, isti kao 10K v2 D9).'
  },
  {
    id: 'M10',
    rule: 'Baza: Q1 R, Q2 T kontinuirano; razvoj: Q1 I, Q2 T cruise; specifično: Q1 MP, Q2 T cruise. Lestvice u ladders. Ista doza druge strukture: T kontinuirano ↔ 2–5 jednakih deonica ≥ 1000 m (deljivo sa 100 m, a kad podele nema sa 50 m); MP 2–5 jednakih deonica ≥ 3000 m (100 m, pa 50 m) ili kontinuirano do 16 km; I do 6 jednakih deonica 800–1200 m ili piramida 1200 + 1000 + 800 m; R deonice 200 / 300 / 400 m.',
    place: 'workouts.ts (lestvice, strukture), quality.ts (izbor)',
    rationale:
      'Heuristika redosleda razvoja (brzina/ekonomija → prag/VO2max → specifičnost maratona), MASTER M10, pouka 11. Prihvataju se samo tačne podele (doza se ne menja). Kad druga struktura ne postoji (npr. I 2,0 km), slot ponavlja trening uz napomenu; nedelja se razlikuje po drugom slotu.'
  },
  {
    id: 'M11',
    rule: 'Jedan plafon po zoni, po treningu, % ciljnog obima nedelje: R 5 %, I 8 %, T 10 %, MP 20 %.',
    place: 'policy.ts caps; proverava quality.ts (izbor) i validate.ts',
    rationale:
      'R/I/T prema Danielsu (sekundarni izvor, ne dokaz); MP 20 % (Daniels: M ≤ 20 % nedelje, sekundarni izvor). Nema drugih limita za iste zone. Ne važi za trkačku nedelju (M8).'
  },
  {
    id: 'M12',
    rule: 'Po slotu: sledeći nivo ako staje u plafon (≤ 1 nivo/ned), inače ista doza druge strukture; doza ne pada van rasterećenja/tapera/trke; početni nivo = najviši nivo ≤ 60 % plafona zone (najmanje prvi nivo); T cruise ≥ poslednje T kontinuirano; MP ≥ max(početni nivo, poslednje I); glavna doza (T + I + MP) ne opada; nema identičnih uzastopnih ne-rasteretnih nedelja; baza bez platoa. M11 ispred M12: kad nijedan cilj nedelje nije izvodljiv uz „doza ne pada", doza van plafona ide na najviši nivo u plafonu (napomena, DOSE_DROPPED).',
    place: 'quality.ts',
    rationale:
      'Postepena progresija (MASTER H12/M12; pouke 3 i 12). 60 % plafona je heuristika (10K v2 D16). Spuštanje doze samo u nedelji ograničenoj kapacitetom (pouka 12).'
  },
  {
    id: 'M13',
    rule: 'Dugi ≤ 40 % cilja (M15) i ≤ 150 min sporim E; korak 0,1 km; dugi ≥ svaki lagan (tvrdo); lagan ≥ 5 km. Upozorenje MARATHON_LONG_SHORT kad je najduži dugi plana < 26 km (preporuka: više dana ili obima).',
    place: 'lengths.ts (jedini vlasnik dužina); validate.ts (upozorenje)',
    rationale:
      '150 min (Daniels, sekundarni izvor). Dugi uzima najveću dozvoljenu dužinu (do lagan ≥ 5 km), lagani ostatak (pouka 2). 26 km je heuristika praga za maratonski dugi (MASTER M13). Upozorenje navodi najduži dugi i šta ga ograničava (150 min → namerna granica; 40 % → veći obim ili više dana); mreža 01: 2832 / 4368 planova (prihvatio organizator — 5/6 dana u segmentu 02 ga smanjuju).'
  },
  {
    id: 'M14',
    rule: 'WU/CD E po pojasu trenutnog obima iz ulaza (0,1 km), konstantno kroz plan: < 50 km 15/10 min; 50–69,9 km 20/15 min; ≥ 70 km 25/15 min (fiksni deo treninga, nikad pufer); km po srednjem E; oporavci: R isti metraž džogom, I 1:1 vreme zaokruženo naniže na 15 s (max 4:00), T cruise 60 s (deonica ≤ 1600 m) / 90 s, MP 90 s (≤ 4000 m) / 120 s.',
    place: 'workouts.ts (warmupCooldown, recoveryOf)',
    rationale:
      'Trkač većeg obima ima duže zagrevanje (MASTER M14/H14). Pojas ≥ 70 km je nedostižan uz ulaz ≤ 65 km (4 dana); ostaje zbog segmenta 02 (5/6 dana). Oštrenje (M8) ima 2:00 oporavak iz M8.'
  },
  {
    id: 'M15',
    rule: 'Tabela po broju dana (days, JEDINA; segment 01 samo red 4): 4 dana = 2 kvaliteta + 1 lagan + dugi, obim 35–65 km, max nedelje 80 km, dugi ≤ 40 %, min nedelje 20 km.',
    place:
      'policy.ts days (dayRule); čitaju input.ts, schedule.ts, lengths.ts, volume.ts, week.ts, validate.ts',
    rationale:
      'Heuristika (MASTER M15). Uslov 8: nedelja ispod minimuma = greška; trkačka nedelja: planirano + 42,2 km (M8). Redovi 3/5/6 dana dolaze u segmentu 02.'
  }
];

/** Nivo lestvice: deonice (broj × metraža) ili kontinuirano (km). */
type Level = Structure;
const reps = (n: number, repM: number): Level => ({ form: 'reps', reps: n, repM });
const cont = (km: number): Level => ({ form: 'continuous', km });

export const MARATHON_V2_POLICY = {
  id: 'marathon-v2',
  version: 'marathon-v2.0.0',

  /** M1 (dani i obim: M15). */
  input: {
    weeksMin: 12,
    weeksMax: 24,
    resultMaxAgeDays: 84,
    resultDistancesM: [5000, 10000, 21097.5, 42195] as readonly number[],
    /** M1: rezultat 5 km dozvoljen uz upozorenje RESULT_5K. */
    shortResultM: 5000,
    vdotMin: 30,
    vdotMax: 80
  },

  /** M15: JEDINA tabela po broju dana trčanja (segment 01: red 4). */
  days: {
    4: {
      quality: 2,
      easy: 1,
      kmMin: 35,
      kmMax: 65,
      peakMaxKm: 80,
      longMaxShare: 0.4,
      weekMinKm: 20
    }
  },

  /** M2: udeli VDOT-a po zonama; korekcija VDOT-a za MP po pojasu trenutnog obima. */
  paces: {
    eFractionFast: 0.7,
    eFractionSlow: 0.62,
    tFraction: 0.88,
    iFraction: 0.975,
    rFraction: 1.05,
    raceDistanceM: 42195,
    mpCorrection: [
      { fromKm: 0, vdot: -2.0 },
      { fromKm: 40, vdot: -1.0 },
      { fromKm: 60, vdot: 0 }
    ] as readonly { fromKm: number; vdot: number }[]
  },

  /** M3: dozvoljen rast VDOT-a po nedelji plana. */
  goal: { realisticPerWeek: 0.08, ambitiousPerWeek: 0.16 },

  /** M4: specifično po broju nedelja izgradnje B (poslednji red sa fromBuild ≤ B). */
  phases: {
    specific: [
      { fromBuild: 0, weeks: 4 },
      { fromBuild: 13, weeks: 5 },
      { fromBuild: 17, weeks: 6 }
    ] as readonly { fromBuild: number; weeks: number }[],
    taperWeeks: 2,
    raceWeeks: 1
  },

  /** M5. */
  deload: {
    maxBuildRun: 3,
    exceptionRun: 4,
    firstAllowedWeek: 3,
    factor: 0.8,
    tShare: 0.6,
    tMinKm: 2.0,
    longFactor: 0.8
  },

  /** M6 (max nedelje: M15). */
  volume: {
    growth: 0.06,
    growthMinKm: 1.0,
    growthMaxKm: 5.0,
    peakFactor: 1.5,
    peakAddKm: 30
  },

  /** M7: nedelje tapera redom (N−2, N−1). tShare null = bez T. */
  taper: {
    weeks: [
      { factor: 0.8, mpShare: 0.6, tShare: 0.6, longFactor: 0.65 },
      { factor: 0.6, mpShare: 0.5, tShare: null, longFactor: 0.45 }
    ] as readonly {
      factor: number;
      mpShare: number;
      tShare: number | null;
      longFactor: number;
    }[],
    mpMin: reps(2, 3000),
    tMinKm: 2.0
  },

  /** M8. */
  raceWeek: {
    maxRunDays: 5,
    sharpener: { reps: 2, repM: 2000, recoverySec: 120 },
    sharpenerMinGapDays: 3,
    eveEasySec: 1200,
    eveStrides: { reps: 4, sec: 20 },
    eveMaxSec: 1800,
    otherEasySec: 1800,
    raceKm: 42.2,
    raceDistanceM: 42195,
    raceWarmupSec: 300
  },

  /** M9. */
  schedule: { defaultLongDay: 'sun' as const },

  /** M10: lestvice rastućom dozom. */
  ladders: {
    R: [
      reps(6, 200),
      reps(8, 200),
      reps(6, 300),
      reps(10, 200),
      reps(8, 300),
      reps(8, 400)
    ] as readonly Level[],
    T_continuous: [
      cont(2.0),
      cont(3.0),
      cont(4.0),
      cont(5.0),
      cont(6.0),
      cont(8.0)
    ] as readonly Level[],
    T_cruise: [
      reps(2, 1200),
      reps(3, 1000),
      reps(3, 1600),
      reps(4, 1600),
      reps(5, 1600),
      reps(3, 3200)
    ] as readonly Level[],
    I: [
      reps(2, 1000),
      reps(3, 1000),
      reps(4, 1000),
      reps(5, 1000),
      reps(5, 1200)
    ] as readonly Level[],
    MP: [
      reps(2, 3000),
      reps(2, 4000),
      reps(2, 5000),
      cont(12),
      reps(2, 7000),
      cont(16)
    ] as readonly Level[]
  },

  /** M10: „ista doza druge strukture" (pouka 11). */
  alternatives: {
    repsMin: 2,
    repsMax: 5,
    roundM: 100,
    roundFallbackM: 50,
    tRepMinM: 1000,
    mpRepMinM: 3000,
    mpContinuousMaxKm: 16,
    iRepsMax: 6,
    iRepMinM: 800,
    iRepMaxM: 1200,
    iPyramidM: [1200, 1000, 800] as readonly number[],
    rRepM: [200, 300, 400] as readonly number[]
  },

  /** M11: jedan plafon po zoni, po treningu, udeo ciljnog obima nedelje. */
  caps: { R: 0.05, I: 0.08, T: 0.1, MP: 0.2 },

  /** M13 (udeo dugog: M15). */
  lengths: { longMaxSec: 9000, easyMinKm: 5.0, longShortKm: 26 },

  /** M12: početni nivo slota ≤ udeo plafona zone (M11). */
  startLevel: { capShare: 0.6 },

  /** M14. */
  workout: {
    /** WU/CD po pojasu trenutnog obima: poslednji pojas sa fromKm ≤ obim (0,1 km). */
    warmupCooldown: [
      { fromKm: 0, warmupSec: 900, cooldownSec: 600 },
      { fromKm: 50, warmupSec: 1200, cooldownSec: 900 },
      { fromKm: 70, warmupSec: 1500, cooldownSec: 900 }
    ] as readonly { fromKm: number; warmupSec: number; cooldownSec: number }[],
    iRecoveryMaxSec: 240,
    iRecoveryStepSec: 15,
    /** Oporavak po dužini deonice: ≤ shortMaxM → shortSec, inače longSec. */
    tCruiseRecovery: { shortMaxM: 1600, shortSec: 60, longSec: 90 },
    mpRecovery: { shortMaxM: 4000, shortSec: 90, longSec: 120 }
  },

  /** Tehnička tolerancija: planirano vs cilj (zaokruženje dana na 0,1 km). */
  tolerance: { plannedKm: 0.1 },

  DECISIONS
} as const;

export type MarathonV2Policy = typeof MARATHON_V2_POLICY;

/** Podržani brojevi dana trčanja (M15). */
export type RunDaysCount = keyof MarathonV2Policy['days'];
export interface DayRule {
  readonly quality: 2;
  readonly easy: number;
  readonly kmMin: number;
  readonly kmMax: number;
  readonly peakMaxKm: number;
  readonly longMaxShare: number;
  readonly weekMinKm: number;
}

export const RUN_DAYS_COUNTS = Object.keys(MARATHON_V2_POLICY.days)
  .map(Number)
  .sort((a, b) => a - b) as readonly RunDaysCount[];

/** M15: red tabele za broj dana trčanja; null za broj koji tabela nema. */
export function dayRule(count: number): DayRule | null {
  return (RUN_DAYS_COUNTS as readonly number[]).includes(count)
    ? MARATHON_V2_POLICY.days[count as RunDaysCount]
    : null;
}
