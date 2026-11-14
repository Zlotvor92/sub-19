/* MARATON — BROJEVI BEZBEDNOSTI I ADEKVATNE PRIPREME. Jedan plafon po veličini (SPEC § 11.2). Opterećenje je u
   bodovima (BO = minut laganog trčanja); km se izvode. Izvor brojeva: ciljni planovi trenera (`coach/target/MAR/`,
   README „Šta šabloni za maraton treba da preuzmu") i brief F7-MAR. Gde broj nije trenerov, piše „izbor".

   Mera opterećenja i dugi > 2 h 30: jedna mera (minuti × težina zone) ne vidi dodatni zamor dugog trčanja posle
   ≈ 2 h 30 (glikogen, mišićno oštećenje). Dok motor nema množilac (zahtev u F7-MAR-REPORT), granicu drže PODACI:
   najduži dugi po VREMENU (`longMaxSec`, 2 h 45 – 3 h 15 po nivou), udeo dugog u nedelji i broj najdužih dugih u
   šablonu (3 u repu, razmak 2 nedelje). */
import type { AdequatePrep, LevelRule, SafetyNumbers } from '../../engine/types';
import { MAX_PEAK_OVER_BASE } from './templates';

/** Nivo: prvo pravilo koje važi. „Mali obim" je ispod ≈ 40 km nedeljno (4 h): ispod toga maraton nosi jedan
    kvalitet nedeljno uz dugi (README: dugi je glavni trening). */
export const LEVELS: LevelRule[] = [
  { id: 'pocetnik-nov', when: { beginner: true, maxTenureWeeks: 8 } },
  /* R2 (krug 12): spor početnik (VDOT < 34: trka ≈ 4 h 30+, p13, p18) — dugi hod-trk po vremenu, bez MP bloka */
  { id: 'pocetnik-nov', when: { beginner: true, maxVdot: 33.9 } },
  { id: 'pocetnik', when: { beginner: true } },
  { id: 'povratnik', when: { maxWeeksSincePause: 8 } },
  { id: 'povratnik', when: { maxRecentQualityWeeks: 0 } },
  { id: 'mali', when: { maxBaseLoad: 225, maxVdot: 51.9 } },
  { id: 'spor', when: { maxVdot: 39.9 } },
  { id: 'srednji', when: { maxVdot: 51.9 } },
  { id: 'brz', when: {} }
];

/* Udeo dugog po broju dana (README: 5–6 dana 33–38 %, 4 dana do 40 %, 3 dana 45–50 %). Motor ga primenjuje na
   minute nedelje u laganom tempu i od njega oduzima višak km bloka u tempu maratona, pa je stvarni udeo u km oko
   5–8 poena niži od zadatog (p07: zadato 42 %, stvarno ≈ 36 % sa blokom od 13 km). */
/* R17 (sudija 2): kod 3–4 dana dugi ≤ ≈ 45 % nedelje osim dve najduže nedelje (p01, p03, p08) */
const LONG_SHARE = { '1': 1, '2': 0.62, '3': 0.5, '4': 0.42, '5': 0.42, '6': 0.38, '7': 0.35 };

export const SAFETY: SafetyNumbers = {
  /* rast nedelje: + 7 % u bodovima, najmanje 12 BO (≈ 2 km) — README: obim + 6 % nedeljno (ciljni p07) */
  maxWeeklyRampPct: 0.07,
  minRampLoad: 12,
  minRampKm: 2,
  maxPeakOverBase: MAX_PEAK_OVER_BASE,
  /* LESTVICA VRHA za maraton (README trenera, u km): vrh ≤ start × 1,30 za 12 nedelja, × 1,40 za 16+; početnik do
     × 2,1 za 24 nedelje uz satni plafon 7,5 h. Mali polazni obim raste više (ciljni p11 25 → 52 km). Motor računa u
     bodovima, a maratonski rad (MP ≈ 85 % praga) nosi malo bodova iznad minuta, pa su množioci bodova ≈ 1,05 ×
     množilac u km (izbor; kapija `testdata/gate.ts` meri km po tabeli trenera). */
  peakLadder: {
    rows: [
      { maxBaseKm: 25.5, minWeeks: 24, overBase: 2.08 },
      { maxBaseKm: 25.5, minWeeks: 18, overBase: 1.9 },
      { maxBaseKm: 25.5, minWeeks: 12, overBase: 1.62 },
      { maxBaseKm: 25.5, minWeeks: 0, overBase: 1.42 },
      { maxBaseKm: 40.5, minWeeks: 18, overBase: 1.64 },
      { maxBaseKm: 40.5, minWeeks: 12, overBase: 1.52 },
      { maxBaseKm: 40.5, minWeeks: 0, overBase: 1.28 },
      { maxBaseKm: 60.5, minWeeks: 16, overBase: 1.46 },
      { maxBaseKm: 60.5, minWeeks: 12, overBase: 1.37 },
      { maxBaseKm: 60.5, minWeeks: 0, overBase: 1.22 },
      { maxBaseKm: null, minWeeks: 16, overBase: 1.36 },
      { maxBaseKm: null, minWeeks: 12, overBase: 1.32 },
      { maxBaseKm: null, minWeeks: 0, overBase: 1.18 }
    ],
    /* staž < 8 nedelja ili tegoba u 12 meseci: najviše × 1,4 u km */
    limitedOverBase: 1.45,
    limitedTenureWeeks: 8
  },
  /* plafon vrha po nivou (BO ≈ minuti nedelje sa težinom rada): početnik 7,5 h (README), nov početnik 6,5 h,
     brz ≈ 12 h (≈ 140 km) — iskusan trkač sa 110 km ostaje na svom obimu (izbor) */
  peakLoadCap: {
    pocetnik: 470,
    'pocetnik-nov': 400,
    povratnik: 560,
    mali: 460,
    spor: 640,
    srednji: 680,
    brz: 760
  },
  /* NAJDUŽI DUGI PO VREMENU (README: ≥ 80 km 2 h 45–3 h; 60–80 km 3 h; < 45 km 3 h – 3 h 15 uz hod). Plafon u km
     (≤ 32–35 km) daje udeo nedelje: 0,37 × 90 km = 33 km. Brz trkač 2 h 45 (lagan 4:40/km → 35 km). */
  longMaxSec: {
    pocetnik: 11400,
    'pocetnik-nov': 11700,
    povratnik: 10800,
    mali: 11100,
    spor: 11400,
    srednji: 10800,
    brz: 9900
  },
  longShareByRunDays: {
    /* početnik: ciljni p11 (4 dana) najduži 27 km = 52 % vrha od 52 km, p12 (5 dana) 41 % — dugi je jedini put do
       27 km kad je obim mali; hod-trk spušta udar */
    /* R20: dugi po vremenu — p11 N−5 2 h 52, N−3 3 h 03 (trener MAR-03 § D6) */
    pocetnik: { ...LONG_SHARE, '4': 0.455, '5': 0.43, '6': 0.4 },
    /* hod-trk: vreme na nogama (p13 3 dana, 10 nedelja) — dugi nosi više nedelje */
    /* R20: p18 jedan dugi 3 h hod-trk u N−3 */
    'pocetnik-nov': { ...LONG_SHARE, '4': 0.445, '5': 0.43, '6': 0.4 },
    povratnik: LONG_SHARE,
    mali: LONG_SHARE,
    spor: LONG_SHARE,
    srednji: LONG_SHARE,
    brz: LONG_SHARE
  },
  /* korak dugog: + 1,5 km ili + 8 min po nedelji gradnje (README: + 1–2 km po koraku; K7 ≤ 2 km i ≤ 12 %, dan se zaokružuje na 0,5 km) */
  longStepSec: 480,
  /* R20: 1,75 km (R19 rastezanje × 1,15 = 2,0 km, K7) */
  longStepKm: 1.75,
  longStartFloorShare: 0.85,
  longStartFloorFromCapShare: 0.88,
  longFloorGrowMinRunDays: 4,
  /* R4 (krug 12): dugi ne stoji na polaznom (p04 2 h 30 × 8, p17 27,5 × 5) — rast nosi namera šablona (od 80 %
     najdužeg, korak 1,5 km nedeljno, talas); pod koji raste sam (bez talasa) samo povratniku (HM Y3) */
  longGrowPastStart: { minRunDays: 4, levels: ['povratnik'] },
  /* 4 dana: do 40 %, u najviše 3 nedelje vrha do 45 % (README); ispod ≈ 55 km nedeljno */
  /* ciljni p12 (5 dana, vrh 65 km): najduži 27 km = 41 %, p11 (4 dana, 52 km): 27 km — README-ovih 33–38 % važi za
     veći obim. README tabela najdužeg dugog (45–60 km vrha → 26–30 km, 60–80 km → 28–32 km) traži više od
     40–45 %: ispod 75 km nedeljno 43 %, u 3 nedelje najdužeg dugog 47 % (blok u dugom to spušta za ≈ 1,5 km) */
  /* R1/R2 (krug 12, presuda trenera ROUND-V4-MAR-01 § E): kod malog obima dugi je vreme na nogama, ne udeo nedelje —
     ispod 66 km nedeljno 45 %, u 3 nedelje najdužeg dugog — R18 (odluka organizatora): dve nedelje najdužeg dugog (N−5, N−3) 55 %, ostale ≤ 45 % (4 dana) / 50 % (3 dana) (najduži = min(28 km, 3 h, 0,50 × vrh) kod 4 dana,
     ≥ 26 km kad je vrh ≥ 52 km); 66–85 km 44 % (p07: 30–32 km) */
  longShareLowVolume: {
    belowKm: 66,
    minRunDays: 3,
    share: 0.44,
    /* R20 (organizator): dugi kod malog obima po vremenu — dve najduže nedelje do 55 % (4 dana) / 60 % (3 dana) u km;
       jedan broj za sve dane (MOTOR: `peakShare` po broju dana), 0,6 u minutima je u km ≤ 55 % kod 4 dana */
    peakShare: 0.6,
    peakWeeks: 2,
    midKm: 85,
    midShare: 0.44
  },
  longStartShare: { '1': 0.6, '2': 0.5, '3': 0.44, '4': 0.4, '5': 0.34, '6': 0.29, '7': 0.26 },
  /* plafon doze po treningu (README trenera) */
  doseCaps: {
    /* osnova: usponi 8–10 × 1 min, kratke brze deonice — malo R (brief) */
    brzina: { maxWorkSec: 660, shareOfPeakLoad: 0.035 },
    /* prag 23 → 35 min kroz osnovu i razvoj, posle održavanje 19–30 min */
    prag: { maxWorkSec: 2100, shareOfPeakLoad: 0.085 },
    'prag-p': { maxWorkSec: 1680, shareOfPeakLoad: 0.075 },
    /* intervali samo u razvoju, 17–21 min */
    intervali: { maxWorkSec: 1260, shareOfPeakLoad: 0.05 },
    /* MP usred nedelje 2 × 3–5 km = 30–50 min (brz do 55 min: 3 × 4,5 km na 3:50/km); početnik ≤ 39–45 min */
    'tempo-trke': {
      maxWorkSec: { pocetnik: 2700, 'pocetnik-nov': 2400, mali: 2700, brz: 3300, '*': 3000 },
      shareOfPeakLoad: 0.11
    },
    /* oštrenje nedelje trke: MP 2 × 900–1000 m (≤ 10 min) */
    ostrenje: { maxWorkSec: 600, shareOfPeakLoad: 0.04 },
    /* MP blok u dugom: 8 → 12 → 14 km (≈ 40 → 60 → 70 min) za VDOT ≥ 40; početnik i spori 6 → 8 km (≤ 55 min);
       brzi na ≥ 80 km do 16–18 km (≤ 75 min). Blok ≤ 45 % dužine dugog drži udeo bodova (izbor). */
    'dugi-rp': {
      maxWorkSec: {
        /* R3 (krug 12): blok ≤ 45 % dugog u km — brz 55 min (≈ 14 km uz dugi 31–35 km), srednji 63 min */
        brz: 3300,
        srednji: 3780,
        spor: 3300,
        mali: 3300,
        povratnik: 3600,
        pocetnik: 3300,
        'pocetnik-nov': 2400
      },
      shareOfPeakLoad: 0.16
    },
    /* progresivni dugi: poslednjih 15–20 min do MP */
    'dugi-progresivno': { maxWorkSec: 1200, shareOfPeakLoad: 0.04 }
  },
  progression: {
    brzina: { startPct: 0.85, stepPct: 0.1 },
    prag: { startPct: 0.6, stepPct: 0.08 },
    'prag-p': { startPct: 0.45, stepPct: 0.08 },
    intervali: { startPct: 0.8, stepPct: 0.1 },
    'tempo-trke': { startPct: 0.6, stepPct: 0.1 },
    ostrenje: { startPct: 1, stepPct: 0 },
    'dugi-rp': { startPct: 0.57, stepPct: 0.2 },
    'dugi-progresivno': { startPct: 0.75, stepPct: 0.1 }
  },
  minDoseSec: 480,
  /* BRZ RAD (prag, intervali, brze deonice, MP usred nedelje i blok u dugom; bez trke i testa): nedelja ≤ 18 %,
     vršna ≤ 20 %. Niže nego polumaraton (22/25 %): maratonska nedelja je duža, a dugi sa blokom od 60–70 min već nosi
     većinu rada; ciljni p07 najteža nedelja 19 %, p12 11 %, raspon ciljnih 11–21 % (README dozvoljava do 22 %,
     brief predlaže 15–18 / 20 %). MP je uključen jer je 70 min MP u dugom najveći pojedinačni napor nedelje. */
  maxFastShare: 0.18,
  maxFastSharePeak: 0.2,
  sharpening: { stimulus: 'ostrenje', minSec: 360, maxSec: 600 },
  painReturnFromLevel: 5,
  /* trka do 65 min (10 km i kraće) van plana — oporavak kao planirana provera */
  shortEffortSec: 3900,
  /* prvi maraton: prognoza početnika najviše 3 % brža od današnje forme, potpuno nov bez napretka */
  forecastMaxGainByLevel: { pocetnik: 0.03, 'pocetnik-nov': 0 },
  /* start maratona: prvih 5–10 km 5–10 s/km sporije od tempa trke (README) */
  raceStartPaceOffsetSec: { from: 5, to: 10 },
  shortenedLongMaxShare: 0.45,
  /* R12 M4 (krug 15): brz trening ne ide dan uz dugi (niz teških dana najviše 1; lagan dan prekida niz) (p04 n21) */
  maxConsecutiveWithHard: {
    days: 1,
    levels: ['spor', 'pocetnik', 'pocetnik-nov', 'povratnik', 'mali']
  },
  /* R12 M2 (krug 15): posle prekida ≥ 4 nedelje pred trku ostaje jedan dugi ≥ 26 km */
  returnKeepLong: { km: 26, minWeeksToRace: 4 },
  /* R12 M3 (krug 15): E5 — 1. i 2. nedelja posle polumaratona: dugi ≤ 60 %, nedelja ≤ 75 % */
  afterLongRace: { minEffortSec: 4500, weeks: 2, longShare: 0.6, weekShare: 0.75 },
  minZoneGapSecPerKm: 5,
  noQualityBeforeTestDays: 2,
  zoneGapReplacement: 'intervali',
  /* MP nedeljno (blok + usred nedelje): početnik ≤ 55 min, ostali ≤ 75 min, brz ≤ 85 min. Pošto nedelja sa blokom
     nema MP usred nedelje, plafon u praksi drži samo blok (izbor). */
  weeklyZoneMaxSec: {
    zone: 'RP',
    fallbackStimulus: 'prag',
    minLeftSec: 900,
    byLevel: {
      pocetnik: 3300,
      'pocetnik-nov': 2700,
      povratnik: 3900,
      mali: 3600,
      spor: 3600,
      srednji: 4500,
      brz: 5100
    }
  },
  /* SUŽAVANJE 3 nedelje (README, brief): N−3 najteža, N−2 ≈ 80 % (≤ 2 brza treninga uz blok), N−1 ≈ 60 %, nedelja
     trke ≤ 40 % bez trke; poslednjih 7 dana samo oštrenje. Brz rad nedelja sužavanja ≤ 68 % vršne: čuvar meri i N−2
     (vrsta „taper"), a ciljni p07 N−2 nosi 45 od 89 min vršne (51 %); N−1 po šablonu ≈ 25–30 %. */
  taper: {
    lastDays: 7,
    weekBeforeFromDays: 14,
    weekBeforeMaxQuality: 2,
    weekBeforeMaxOfPeak: 0.68,
    weekMinus2MaxOfPeak: 0.82,
    calendarMinus2MaxQuality: 2,
    raceWeekMaxOfPeak: 0.4,
    /* poslednji dugi sa blokom (N−2) zadržava poslednja 3 km u MP (≈ 15 min) */
    lastLongMinBlockSec: 900
  },
  /* lagan dan: najmanje 30 min; iskusni nivoi 35 min (40 min bi u nedelji trke sa 6 dana ostavilo ≥ 45 % vrha) */
  minEasySec: 1800,
  minEasyMin: { brz: 35, srednji: 35, spor: 35, mali: 30, povratnik: 35 },
  minEasyFromRunDays: 5,
  minEasyFallbackMin: 30,
  peakNotBelowBase: true,
  tagMaxRun: [{ tag: 'brdo', max: 2, window: 3, replacement: 'intervali' }],
  /* trkač sporiji od 4:15 na maratonu: intervali ne brži od tempa na 5 km iz forme */
  intervalPaceFloor: { distanceM: 5000, fromRaceSec: 15300 },
  /* lagan dan ≤ 64 % dugog kod 4+ dana (README srednje-dugi 55–65 % dugog), 3 dana 70 % (ciljni p08 utorak 15–17 km
     uz dugi 24–32) */
  easyMaxShareOfLong: {
    '1': 0.7,
    '2': 0.7,
    '3': 0.7,
    '4': 0.64,
    '5': 0.64,
    '6': 0.64,
    '7': 0.64
  },
  dayBeforeLongMaxShare: 0.6,
  /* sužavanje maratona traje 3 nedelje: lagani dani N−1 i nedelje trke do 65 min (3 dana 75 min), ne 50 min kao
     kod kraćih distanci (ciljni p07 N−1 50 km sa 5 dana) */
  taperEasyMaxSec: { '1': 4500, '2': 4500, '3': 4500, '4': 3900, '5': 3900, '6': 3900, '7': 3900 },
  warmupCooldown: [
    { uptoBaseLoad: 180, warmupSec: 600, cooldownSec: 600 },
    { uptoBaseLoad: 300, warmupSec: 900, cooldownSec: 600 },
    { uptoBaseLoad: null, warmupSec: 1200, cooldownSec: 900 }
  ]
};

/** Adekvatna priprema za maraton (izvor upozorenja i predloga; README trenera: p11 „oko 35 km nedeljno pre početka
    ili 30+ nedelja", p08 „4. dan"). */
export const ADEQUATE: AdequatePrep = {
  minWeeks: 16,
  /* README: vrh 60–80 km nosi dugi 28–32 km */
  minPeakWeeklyKm: 60,
  minRunDays: 4,
  /* najduži dugi ≥ 28 km ili ≥ 3 h (README: ispod 24 km plan to kaže i daje predlog) */
  /* R17 (d): isti broj kao provera dugog (26 km, presuda MAR-01), da dva upozorenja ne traže 26 i 28 km */
  minLongKm: 26,
  /* provera `dugi-za-distancu` meri dugi u km laganog tempa (bez viška km bloka u tempu maratona, ≈ 1–1,5 km), pa je
     prag 27 km ili 2 h 50 — dugi od 28 km sa blokom tada ne dobija upozorenje (zahtev motoru u izveštaju) */
  minLongSec: 10200,
  /* R17 (presuda trenera MAR-01 § E1): 26 km je tačno za vrh 45–60 km */
  longCheckKm: 26,
  longCheckMinWeeks: 16,
  minTenureWeeks: 26,
  minPeakWeeklyKmByLevel: { brz: 80 },
  minRunDaysByLevel: { pocetnik: 3, 'pocetnik-nov': 3, mali: 3, spor: 3 },
  shorter: { distanceId: 'hm', label: 'polumaraton' }
};
