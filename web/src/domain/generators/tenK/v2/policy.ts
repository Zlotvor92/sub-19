/* 10K v2 — politika: svaki trenerski broj ima JEDNO mesto (ovde) i red u DECISIONS sa obrazloženjem.
   Kod ostalih fajlova čita samo ovaj objekat; nijedan od njih ne nosi sopstveni trenerski broj. */

/** Deonica lestvice: broj × metraža. */
interface Rep {
  readonly reps: number;
  readonly repM: number;
}

export interface Decision {
  readonly id: string;
  readonly rule: string;
  readonly place: string;
  readonly rationale: string;
}

const DECISIONS: readonly Decision[] = [
  {
    id: 'D1',
    rule: 'Tačno 4 dana; 10–18 celih nedelja do trke; obim 25–55 km; rezultat 3/5/10 km ili polumaraton ≤ 84 dana; VDOT 30–80; cilj opcion.',
    place: 'input.ts',
    rationale:
      'Opseg jezgra segmenta 01. Van opsega strukturisano odbijanje: 3/5/6 dana i 8–9 ned privremeno (segment 02), bez pouzdanog rezultata privremeno (plan po osećaju, segment 03), < 8 ned trajno.'
  },
  {
    id: 'D2',
    rule: 'VDOT iz rezultata (Daniels–Gilbert); zone E/T/I/R kao udeo VDOT-a; RP = tempo prognoze 10K iz trenutnog VDOT-a; tempo fiksan kroz plan.',
    place: 'paces.ts (udeli: paces)',
    rationale:
      'Jednačine su objavljeni model (Daniels i Gilbert 1979). Udeli su 10K odluka u skladu sa Danielsovim opisom zona (sekundarni izvor: E ≈ 59–74 %, T ≈ 83–88 %, I ≈ 95–100 % VO2max); R = 1,05 je heuristika (R nije definisan udelom VO2max). RP iz cilja bi trening vezao za neproveren broj; menja ga samo adaptacija (04).'
  },
  {
    id: 'D3',
    rule: 'Δ = VDOT cilja − trenutni VDOT; Δ ≤ 0,1·N realističan, ≤ 0,2·N ambiciozan, više nerealan (upozorenje).',
    place: 'paces.ts assessGoal (pragovi: goal)',
    rationale:
      'Heuristika napretka po nedelji. Nerealan cilj je upozorenje, ne odbijanje, i ne menja tempo; sporiji od prognoze je realističan.'
  },
  {
    id: 'D4',
    rule: 'Poslednja nedelja trka, pretposlednja taper; B = N − 2: specifično 3 (B ≤ 11) ili 4; baza = ceil((B − spec)/2); razvoj = ostatak.',
    place: 'periodize.ts (phases)',
    rationale:
      'Ukupno smanjenje ≈ 13 dana (taper + 6 dana trkačke nedelje), u opsegu 8–14 dana iz meta-analize Bosquet i sar. 2007 (više sportova, nije 10K-specifično: 8–14 dana, obim −41–60 %, intenzitet i učestalost zadržani).'
  },
  {
    id: 'D5',
    rule: 'Najviše 3 uzastopne nedelje izgradnje (izuzetno 4 kad bi rasterećenje palo na prvu nedelju faze); nikad na prvoj nedelji faze, u ned 1–2, pred taperom, u taperu/trkačkoj. Cilj 0,8 × poslednji ne-rasteretni; 1 kvalitet T ≈ 60 % (nivo naniže, min 2,0 km); dugi 0,8 × poslednji ne-rasteretni.',
    place: 'periodize.ts (gde), week.ts + quality.ts + lengths.ts (sadržaj), volume.ts (cilj)',
    rationale:
      'Heuristika 3:1. Raspored se bira determinističkom pretragom: najmanje rasterećenja, pa izgradnja što ranije (rasterećenje što kasnije).'
  },
  {
    id: 'D6',
    rule: 'Ned 1 = trenutni obim; izgradnja +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 3,0 km, korak 0,1); vrh = min(start × 1,4; start + 15; 60; kapacitet). Kapacitet = stvarna konstrukcija nedelje; neizvodljiv cilj → samo ta nedelja na najbliži izvodljiv cilj (napomena). Spuštena nedelja izgradnje → CAPACITY_LIMITED: „4 dana ne nose ovaj obim uz dugi ≤ 105 min; preporuka 5–6 dana (od segmenta 02)".',
    place: 'volume.ts (jedini vlasnik cilja); poruka generate.ts + validate.ts',
    rationale:
      'Heuristika umerenog rasta. Kapacitet nije formula: cilj nedelje se proverava stvarnom konstrukcijom (week.ts); granica izgradnje se ne spušta zbog jedne nedelje, a sledeći rast meri se od cilja koji je nedelja stvarno dobila.'
  },
  {
    id: 'D7',
    rule: 'Taper: cilj 0,75 × vrh; RP i T, svaki ≈ 60 % poslednje doze zone (naniže; min 2 × 1000 m RP, 2,0 km T); dugi ≤ 0,75 × najduži; 4 dana.',
    place: 'week.ts + quality.ts + lengths.ts; cilj volume.ts',
    rationale:
      'Smanjen obim uz zadržan intenzitet i učestalost (Bosquet i sar. 2007, isti ograničeni dokaz kao D4).'
  },
  {
    id: 'D8',
    rule: 'Trkačka nedelja: ≤ 4 dana sa trkom; trka zamenjuje dugi; oštrenje WU + 3 × 1000 m RP (90 s) + CD ako je RP doza tapera ≥ 3,0 km, inače 2 × 1000 m (oštrenje ≤ RP doza tapera), na najkasnijem danu ≥ 3 dana pre trke; WU/CD oštrenja po D14; dan pred trku 20 min E + 4 × 20 s (≤ 30 min); ostali 35 min E; trka 10 km + WU 15 + CD 10 van obima; cilj = planirano.',
    place: 'week.ts (raceWeek) + workouts.ts',
    rationale:
      'Fiksna trenerska heuristika. D8 je potpuna specifikacija trkačke nedelje, pa se plafon D11 na nju ne primenjuje (oštrenje 3 km RP je > 10 % cilja od 13–20 km). Oštrenje ne sme biti veće od RP doze tapera (zamenjuje prag „vrh < 35 km" iz 10k-v2.0.0). WU/CD trke ostaju 15/10 min (D8, van obima).'
  },
  {
    id: 'D9',
    rule: 'Šablon 2 kvaliteta + 1 dugi + 1 lagan; Q1, Q2 i dugi međusobno nesusedni (ciklično); dugi: dan iz ulaza, inače nedelja, inače poslednji dan trčanja; nema rešenja → SCHEDULE_NO_RECOVERY sa predlogom.',
    place: 'schedule.ts',
    rationale:
      'Dan oporavka između zahtevnih dana. Kad postoji više rešenja: najveći razmak dugi → Q1, pa Q1 → Q2 (tehnički, deterministički izbor).'
  },
  {
    id: 'D10',
    rule: 'Baza: Q1 R, Q2 T kontinuirano; razvoj: Q1 I, Q2 T cruise; specifično: Q1 RP, Q2 T cruise; lestvice u ladders; ista doza druge strukture pravilom: T kontinuirano ↔ 2–5 jednakih deonica ≥ 1000 m (podela ne postoji → kontinuirano); I do 6 jednakih deonica 800–1200 m ili piramida 1200 + 1000 + 800 m (3,0 km); RP 2–5 jednakih deonica; deonice deljive sa 100 m.',
    place: 'workouts.ts (lestvice, strukture), quality.ts (izbor)',
    rationale:
      'Heuristika redosleda razvoja (brzina/ekonomija → prag/VO2max → specifičnost). Pravilo prihvata samo tačne podele (bez promene doze); R menja deonice 200 ↔ 300 m. Kad druga struktura ne postoji, slot ponavlja trening (nedelja se razlikuje po drugom slotu). Piramida: samo primer iz odluke (800/1000/1200 m po jednom, ukupno 3,0 km), bez drugih kombinacija.'
  },
  {
    id: 'D11',
    rule: 'Jedan plafon po zoni, po treningu, % ciljnog obima nedelje: R 5 %, I 8 %, T 10 %, RP 10 %.',
    place: 'policy.ts caps; proverava quality.ts (izbor) i validate.ts',
    rationale:
      'R/I/T prema Danielsu (sekundarni izvor, ne dokaz); RP heuristika. Nema drugih limita za iste zone. Ne važi za trkačku nedelju (D8).'
  },
  {
    id: 'D12',
    rule: 'Po slotu: sledeći nivo ako staje u plafon (≤ 1 nivo/ned), inače ista doza druge strukture; doza ne pada van rasterećenja/tapera/trke; T cruise ≥ poslednje T kontinuirano; RP ≥ poslednje I; glavna doza (T + I + RP) ne opada; nema identičnih uzastopnih ne-rasteretnih nedelja; baza bez platoa. D11 ispred D12: kad nijedan cilj nedelje nije izvodljiv uz „doza ne pada", doza van plafona ide na najviši nivo lestvice u plafonu (napomena, DOSE_DROPPED).',
    place: 'quality.ts',
    rationale:
      'Postepena progresija bez skokova; „sledeći nivo" = najmanji nivo lestvice veći od trenutne doze; početni nivo određuje D16. Plafon zone ispred progresije: usvojena odluka posle segmenta 01 (u 10k-v2.0.0 vođeno kao odstupanje). Odstupanje 10k-v2.1.0 (opreznije): „baza bez platoa" ne važi kad T doza nema drugu strukturu (T 2,5 / 3,5 km kontinuirano, deonice ≥ 1000 m po D10) — T se ponavlja uz napomenu (D10) umesto skoka obima; npr. 10 ned, 25 km, VDOT 30, uto/čet/sub/ned: ned 3 cilj 28,1 km, T 3,0 km > plafon 2,8 km.'
  },
  {
    id: 'D13',
    rule: 'Dugi ≤ 33 % cilja i ≤ 105 min sporim E; korak 0,1 km; dugi ≥ svaki lagan (tvrdo); lagan ≥ 3 km.',
    place: 'lengths.ts (jedini vlasnik dužina)',
    rationale:
      '33 % jer sa 4 dana dugi mora biti ≥ lagan i ostaviti mesta za 2 kvaliteta; pri 30 km dugi ≈ 10 km ≥ distanca trke. Dugi uzima najveću dozvoljenu dužinu (do lagan ≥ 3 km), lagan ostatak.'
  },
  {
    id: 'D14',
    rule: 'WU/CD E po pojasu trenutnog obima iz ulaza (0,1 km), konstantno kroz plan: < 35 km → 15/10 min; 35–44,9 km → 20/15 min; ≥ 45 km → 25/15 min (fiksni deo treninga, nikad pufer); km po srednjem E; oporavci: R isti metraž džogom, I 1:1 vreme zaokruženo naniže na 15 s (max 4:00), T cruise 60 s, RP 60 s (≤ 1200 m) / 90 s (1500–2000 m) / 120 s (3000 m).',
    place: 'workouts.ts (warmupCooldown, recoveryOf)',
    rationale:
      'Trkač većeg obima ima duže zagrevanje; kvalitetni dan nosi srazmeran deo nedelje. RP deonice van navedenih opsega (1300–1400 m, 2100–2900 m) dobijaju sledeći duži oporavak (opreznije). Ubrzanja (D8) su R zona: oporavak isti metraž džogom.'
  },
  {
    id: 'D15',
    rule: 'Uslov 8: nedelja ≥ 12 km (trkačka bez trke); lagan ≥ 3 km; prazan trening, dugi < lagan, nedelja < 12 km = greška; takav ulaz se odbija.',
    place: 'policy.ts week + validate.ts',
    rationale: 'Upotrebljivost, ne samo aritmetika: degenerisan plan se ne predaje.'
  },
  {
    id: 'D16',
    rule: 'Početni nivo slota (prva nedelja baze; prva nedelja nove zone na prelazu faze: I u razvoju, RP u specifičnoj) = najviši nivo lestvice ≤ 60 % plafona zone (D11) za cilj te nedelje; najmanje prvi nivo; na prelazu i dalje važi D12 (RP ≥ poslednje I).',
    place: 'quality.ts (startLevel)',
    rationale:
      'Heuristika: kvalitetni dan nosi srazmeran deo nedelje, pa trkač većeg obima ne kreće sa najnižeg nivoa; 60 % plafona ostavlja prostor za progresiju D12. T cruise posle T kontinuiranog nije nova zona (samo D12).'
  }
];

export const TEN_K_V2_POLICY = {
  id: '10k-v2',
  version: '10k-v2.1.0',

  /** D1. */
  input: {
    runDays: 4,
    runDaysLaterSegment: [3, 5, 6] as readonly number[],
    weeksMin: 10,
    weeksMax: 18,
    /** 8–9 nedelja: privremeno odbijanje (segment 02); < 8 trajno. */
    weeksAbsoluteMin: 8,
    weeklyKmMin: 25,
    weeklyKmMax: 55,
    resultMaxAgeDays: 84,
    resultDistancesM: [3000, 5000, 10000, 21097.5] as readonly number[],
    vdotMin: 30,
    vdotMax: 80
  },

  /** D2: udeli VDOT-a po zonama (10K odluka). */
  paces: {
    eFractionFast: 0.7,
    eFractionSlow: 0.62,
    tFraction: 0.88,
    iFraction: 0.975,
    rFraction: 1.05,
    raceDistanceM: 10000
  },

  /** D3: dozvoljen rast VDOT-a po nedelji plana. */
  goal: { realisticPerWeek: 0.1, ambitiousPerWeek: 0.2 },

  /** D4. */
  phases: {
    specificShort: 3,
    specificLong: 4,
    specificShortMaxBuild: 11,
    taperWeeks: 1,
    raceWeeks: 1
  },

  /** D5. */
  deload: {
    maxBuildRun: 3,
    exceptionRun: 4,
    firstAllowedWeek: 3,
    factor: 0.8,
    tShare: 0.6,
    tMinKm: 2.0,
    longFactor: 0.8
  },

  /** D6. */
  volume: {
    growth: 0.06,
    growthMinKm: 1.0,
    growthMaxKm: 3.0,
    peakFactor: 1.4,
    peakAddKm: 15,
    peakMaxKm: 60
  },

  /** D7. */
  taper: {
    factor: 0.75,
    doseShare: 0.6,
    rpMin: { reps: 2, repM: 1000 } as Rep,
    tMinKm: 2.0,
    longFactor: 0.75
  },

  /** D8. */
  raceWeek: {
    maxRunDays: 4,
    /** Puno oštrenje kad je RP doza tapera ≥ reps × repM (3,0 km), inače sharpenerSmallReps. */
    sharpener: { reps: 3, repM: 1000, recoverySec: 90 },
    sharpenerSmallReps: 2,
    sharpenerMinGapDays: 3,
    eveEasySec: 1200,
    eveStrides: { reps: 4, sec: 20 },
    eveMaxSec: 1800,
    otherEasySec: 2100,
    raceKm: 10,
    raceWarmupSec: 900,
    raceCooldownSec: 600
  },

  /** D9. */
  schedule: { defaultLongDay: 'sun' as const },

  /** D10: lestvice (km u zoni). T kontinuirano u km; ostale deonice. */
  ladders: {
    R: [
      { reps: 6, repM: 200 },
      { reps: 8, repM: 200 },
      { reps: 6, repM: 300 },
      { reps: 10, repM: 200 },
      { reps: 8, repM: 300 }
    ] as readonly Rep[],
    T_continuous: [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0] as readonly number[],
    T_cruise: [
      { reps: 2, repM: 1000 },
      { reps: 2, repM: 1200 },
      { reps: 3, repM: 1000 },
      { reps: 3, repM: 1200 },
      { reps: 4, repM: 1000 },
      { reps: 3, repM: 1600 },
      { reps: 5, repM: 1000 },
      { reps: 4, repM: 1500 },
      { reps: 4, repM: 1600 },
      { reps: 5, repM: 1600 }
    ] as readonly Rep[],
    I: [
      { reps: 2, repM: 1000 },
      { reps: 3, repM: 800 },
      { reps: 3, repM: 1000 },
      { reps: 3, repM: 1200 },
      { reps: 4, repM: 1000 },
      { reps: 4, repM: 1200 },
      { reps: 5, repM: 1000 },
      { reps: 5, repM: 1200 }
    ] as readonly Rep[],
    RP: [
      { reps: 2, repM: 1200 },
      { reps: 3, repM: 1000 },
      { reps: 4, repM: 1000 },
      { reps: 3, repM: 1500 },
      { reps: 5, repM: 1000 },
      { reps: 3, repM: 2000 }
    ] as readonly Rep[]
  },

  /** D10: „ista doza druge strukture". */
  alternatives: {
    repsMin: 2,
    repsMax: 5,
    roundM: 100,
    tRepMinM: 1000,
    iRepsMax: 6,
    iRepMinM: 800,
    iRepMaxM: 1200,
    iPyramidM: [1200, 1000, 800] as readonly number[],
    rRepM: [200, 300] as readonly number[]
  },

  /** D11: jedan plafon po zoni, po treningu, udeo ciljnog obima nedelje. */
  caps: { R: 0.05, I: 0.08, T: 0.1, RP: 0.1 },

  /** D13. */
  lengths: { longMaxShare: 0.33, longMaxSec: 6300, easyMinKm: 3.0 },

  /** D16: početni nivo slota ≤ udeo plafona zone (D11). */
  startLevel: { capShare: 0.6 },

  /** D14. */
  workout: {
    /** WU/CD po pojasu trenutnog obima: poslednji pojas sa fromKm ≤ obim (0,1 km). */
    warmupCooldown: [
      { fromKm: 0, warmupSec: 900, cooldownSec: 600 },
      { fromKm: 35, warmupSec: 1200, cooldownSec: 900 },
      { fromKm: 45, warmupSec: 1500, cooldownSec: 900 }
    ] as readonly { fromKm: number; warmupSec: number; cooldownSec: number }[],
    iRecoveryMaxSec: 240,
    iRecoveryStepSec: 15,
    tCruiseRecoverySec: 60,
    /** RP oporavak po dužini deonice (gornja granica uključena). */
    rpRecovery: [
      { maxRepM: 1200, sec: 60 },
      { maxRepM: 2000, sec: 90 },
      { maxRepM: 3000, sec: 120 }
    ] as readonly { maxRepM: number; sec: number }[]
  },

  /** D15 (Uslov 8). */
  week: { minKm: 12 },

  /** Tehnička tolerancija: planirano vs cilj (zaokruženje dana na 0,1 km). */
  tolerance: { plannedKm: 0.1 },

  DECISIONS
} as const;

export type TenKV2Policy = typeof TEN_K_V2_POLICY;
