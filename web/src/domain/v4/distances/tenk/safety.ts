/* 10 KM — BROJEVI BEZBEDNOSTI I ADEKVATNE PRIPREME. Jedan plafon po veličini (SPEC § 11.2). Opterećenje je u bodovima
   (BO = minut laganog trčanja); km se izvode. Izvor brojeva: ciljni planovi trenera (`coach/target/10K/`) i pravila
   krugova R3–R7 (brz rad ≤ 22 %, vršna ≤ 25 %, silazak obima i intenziteta). Gde broj nije trenerov, piše „izbor". */
import type { AdequatePrep, LevelRule, SafetyNumbers } from '../../engine/types';
import { MAX_PEAK_OVER_BASE } from './templates';

/** Nivo: prvo pravilo koje važi. Isti nivoi kao kod drugih distanci; „mali obim" je ispod ≈ 25 km nedeljno
    (2 h 30 min), jer 10 km nosi dva kvaliteta već od ≈ 25 km (ciljni p01, p06). */
export const LEVELS: LevelRule[] = [
  { id: 'pocetnik-nov', when: { beginner: true, maxTenureWeeks: 8 } },
  { id: 'pocetnik', when: { beginner: true } },
  { id: 'povratnik', when: { maxWeeksSincePause: 8 } },
  { id: 'povratnik', when: { maxRecentQualityWeeks: 0 } },
  { id: 'mali', when: { maxBaseLoad: 150, maxVdot: 51.9 } },
  { id: 'spor', when: { maxVdot: 39.9 } },
  { id: 'srednji', when: { maxVdot: 51.9 } },
  { id: 'brz', when: {} }
];

/* Udeo dugog u KILOMETRIMA nedelje po broju dana (README trenera: dugi 30–33 % nedelje; 3 dana ciljni p03 i p11
   43–45 %). Motor ga primenjuje na minute u laganom tempu, pa je stvarni udeo u km ≤ zadatog. */
const LONG_SHARE = { '1': 1, '2': 0.6, '3': 0.44, '4': 0.33, '5': 0.31, '6': 0.28, '7': 0.26 };

export const SAFETY: SafetyNumbers = {
  /* rast nedelje: + 7 % u bodovima, najmanje 12 BO (≈ 2 km) — trener: 5–10 %, ciljni p01 + 2 km nedeljno */
  maxWeeklyRampPct: 0.07,
  minRampLoad: 12,
  minRampKm: 2,
  maxPeakOverBase: MAX_PEAK_OVER_BASE,
  /* LESTVICA VRHA za 10 km (u km, ciljni planovi): p11 15 → 27 km za 18 nedelja (× 1,8), p03 20 → 28 za 12 (× 1,4),
     p01 40 → 53 za 16 (× 1,33), p06 30 → 39 za 8 (× 1,3). Motor računa u bodovima, a vršna nedelja nosi i rad
     kvaliteta (rad 10 km je brz, pa nosi ≈ 25 % više bodova po minutu od laganog), pa su množioci bodova ≈ 1,2 × množilac
     u km (izbor, izmereno na 12 profila; kapija meri km po tabeli `testdata/gate.ts`). */
  peakLadder: {
    rows: [
      { maxBaseKm: 25.5, minWeeks: 18, overBase: 1.95 },
      { maxBaseKm: 25.5, minWeeks: 12, overBase: 1.72 },
      { maxBaseKm: 25.5, minWeeks: 0, overBase: 1.6 },
      { maxBaseKm: 35.5, minWeeks: 12, overBase: 1.75 },
      { maxBaseKm: 35.5, minWeeks: 0, overBase: 1.55 },
      { maxBaseKm: null, minWeeks: 12, overBase: 1.65 },
      { maxBaseKm: null, minWeeks: 0, overBase: 1.5 }
    ],
    limitedOverBase: 1.65,
    limitedTenureWeeks: 8
  },
  /* plafon vrha po nivou (BO ≈ minuti nedelje sa težinom rada): 10 km ne traži maratonski obim — brz ≈ 10 h,
     srednji i spor ≈ 9 h; krug 2 (B2): plafon više ne drži obim ravnim (p04 50 → 56 km za 18 nedelja) (izbor) */
  peakLoadCap: {
    pocetnik: 360,
    'pocetnik-nov': 280,
    povratnik: 480,
    mali: 340,
    spor: 560,
    srednji: 560,
    brz: 600
  },
  /* najduži dugi: 60–100 min (ciljni p03 ≈ 93 min, p11 ≈ 85 min); dugi za 10 km nije duži od 1 h 40, osim sporog
     nivoa (VDOT < 40): 1 h 50 ≈ 15 km — krug 2 (B2): sa 1 h 40 (14 km) obim sporog trkača sa 5 dana ne raste (p04) */
  longMaxSec: {
    pocetnik: 5400,
    'pocetnik-nov': 4800,
    povratnik: 5700,
    mali: 5700,
    spor: 6600,
    srednji: 6000,
    brz: 6000
  },
  /* krug 10 (F7-10K § Krug 3, t. 2): srednji sa 3 dana sme dugi do 1 h 50 da bi obim rastao (p08 × 1,10 → × 1,20) */
  longMaxSecByRunDays: { srednji: { '3': 6600 } },
  longShareByRunDays: {
    pocetnik: LONG_SHARE,
    'pocetnik-nov': { ...LONG_SHARE, '3': 0.45, '4': 0.38, '5': 0.34 },
    povratnik: LONG_SHARE,
    mali: LONG_SHARE,
    spor: LONG_SHARE,
    srednji: LONG_SHARE,
    brz: LONG_SHARE
  },
  /* korak dugog: + 5 min ili + 1 km nedeljno (ciljni p01 + 0,5–1 km, p11 + 0,5 km) */
  longStepSec: 300,
  longStepKm: 1,
  /* krug 2 (B2): 3 dana — nedelja 1 = sadašnji obim (p08 kretao sa 36 uz 41 km), pa dugi kreće sa 96 % plafona */
  longStartFloorShare: 0.96,
  longStartFloorFromCapShare: 0.88,
  longFloorGrowMinRunDays: 3,
  longStartShare: { '1': 0.6, '2': 0.5, '3': 0.42, '4': 0.31, '5': 0.28, '6': 0.25, '7': 0.22 },
  /* plafon doze po treningu (README: T do 28 min, I 14 → 22 min, RP 23 → 29 min; završnica u dugom 10–15 min) */
  doseCaps: {
    /* brzina do 12 min: prvi trening (68 % plafona) ostaje ≥ 8 min rada (K8) */
    brzina: { maxWorkSec: 720, shareOfPeakLoad: 0.07 },
    /* brz nivo (VDOT 52+, 60+ km): prag do 32 min, intervali do 25 min, tempo trke do 40 min (8–10 × 1 km,
       3–4 × 2 km) — sa plafonima ostalih vršna nedelja od 90+ km ima ispod 14 % brzog rada (izbor) */
    prag: { maxWorkSec: { brz: 1920, '*': 1680 }, shareOfPeakLoad: 0.1 },
    'prag-p': { maxWorkSec: 1200, shareOfPeakLoad: 0.085 },
    intervali: { maxWorkSec: { brz: 1500, '*': 1320 }, shareOfPeakLoad: 0.08 },
    /* krug 2 (B7): do 35 min (brz 40) — najveći tempo trke plana ≥ 6 km i za trkača od 56 min (p04: 6 × 1 km) */
    'tempo-trke': { maxWorkSec: { brz: 2400, '*': 2100 }, shareOfPeakLoad: 0.1 },
    ostrenje: { maxWorkSec: 720, shareOfPeakLoad: 0.06 },
    'dugi-rp': { maxWorkSec: 900, shareOfPeakLoad: 0.08 },
    'dugi-prag': { maxWorkSec: 900, shareOfPeakLoad: 0.08 },
    'dugi-progresivno': { maxWorkSec: 900, shareOfPeakLoad: 0.05 }
  },
  /* lestvice: prvi trening zone ≤ 70 % plafona (K7) */
  progression: {
    brzina: { startPct: 0.68, stepPct: 0.12 },
    prag: { startPct: 0.5, stepPct: 0.1 },
    'prag-p': { startPct: 0.45, stepPct: 0.08 },
    intervali: { startPct: 0.6, stepPct: 0.15 },
    'tempo-trke': { startPct: 0.6, stepPct: 0.1 },
    ostrenje: { startPct: 0.9, stepPct: 0 },
    'dugi-rp': { startPct: 0.7, stepPct: 0.15 },
    'dugi-prag': { startPct: 0.7, stepPct: 0.15 },
    'dugi-progresivno': { startPct: 0.8, stepPct: 0.1 }
  },
  minDoseSec: 480,
  /* brz rad (sav rad: prag, intervali, brzina, tempo trke, završnica u dugom) ≤ 22 % vremena nedelje, najteža ≤ 25 %
     (R3 S1; ciljni planovi 10K nose 26–33 % u vršnoj nedelji — poznata greška trenera, pravilo ima prednost) */
  maxFastShare: 0.22,
  maxFastSharePeak: 0.25,
  /* oštrenje nedelje trke: 8–12 min rada (K8: kvalitet ≥ 8 min; ciljni p01 11 min, p06 9 min) */
  sharpening: { stimulus: 'ostrenje', minSec: 480, maxSec: 720 },
  painReturnFromLevel: 5,
  /* trka do 65 min (10 km i kraće) — oporavak kao planirana provera */
  shortEffortSec: 3900,
  /* A8 (krug 9, tab motora): prognoza početnika najviše 3 % brža od današnje forme, potpuno nov bez napretka */
  forecastMaxGainByLevel: { pocetnik: 0.03, 'pocetnik-nov': 0 },
  /* R8 t. 19: start 10 km 3–6 s/km sporije od tempa trke (napomena trke; motor bez podatka daje 5–10) */
  raceStartPaceOffsetSec: { from: 3, to: 6 },
  /* skraćena nedelja: dugi ≤ 40 % nedelje u km (10 km: dugi je trećina nedelje, izbor) */
  shortenedLongMaxShare: 0.4,
  /* prag i tempo trke bliži od 5 s/km — jedan podražaj nedeljno; drugi kvalitet tada intervali */
  minZoneGapSecPerKm: 5,
  noQualityBeforeTestDays: 2,
  zoneGapReplacement: 'intervali',
  /* SILAZAK 7–10 DANA (zadatak 10K): najteža nedelja 3 pred trku, nedelja −2 ≤ 85 % (README trenera), 8–10 dana pred
     trku najviše 2 brza treninga i ≤ 60 % brzog rada vršne nedelje (rubrika: „rad ≤ 60 %"; čuvar meri isto),
     poslednjih 7 dana samo oštrenje; nedelja trke (bez trke) ≤ 60 % vrha (ciljni p01 17 od 53 km; manji obim drže
     najkraći lagani dani) */
  taper: {
    lastDays: 7,
    weekBeforeFromDays: 10,
    weekBeforeMaxQuality: 2,
    weekBeforeMaxOfPeak: 0.6,
    weekMinus2MaxOfPeak: 0.85,
    calendarMinus2MaxQuality: 2,
    raceWeekMaxOfPeak: 0.6
  },
  /* lagan dan najmanje 25 min */
  minEasySec: 1500,
  /* najkraće lagano trčanje po nivou (M5): 30 min (10 km: lagani dani su kraći nego kod polumaratona, gde je iskusnima
     35), početnici 25 */
  minEasyMin: { brz: 30, srednji: 30, spor: 30, mali: 30, povratnik: 30 },
  minEasyFromRunDays: 5,
  /* Z8 (krug 7): traženi dani se poštuju — kad obim ne nosi najkraće lagano nivoa, lagan dan sme do 25 min uz
     rečenicu (10 km: najkraće lagano je 30 min, pa je zamena 5 min kraća, kao kod polumaratona 35 → 30) */
  minEasyFallbackMin: 25,
  peakNotBelowBase: true,
  /* usponi najviše 2 od 3 nedelje — treća dobija intervale */
  tagMaxRun: [{ tag: 'brdo', max: 2, window: 3, replacement: 'intervali' }],
  /* sporiji od 52:30 (≈ VDOT 39) — intervali ne brži od tempa na 5 km iz forme */
  intervalPaceFloor: { distanceM: 5000, fromRaceSec: 3150 },
  /* lagan dan ≤ udeo dugog: dugi je kod 10 km trećina nedelje, pa lagani dani 4 dana idu do 80 % dugog (ciljni p01:
     lagano 9–12 km uz dugi 13–17 km); krug 2 (B2): 3 i 5+ dana 80 % (85 % je probano: lagan dan sa ubrzanjima bio je duži od
     progresivnog dugog) */
  easyMaxShareOfLong: {
    '1': 0.8,
    '2': 0.8,
    '3': 0.8,
    '4': 0.8,
    '5': 0.8,
    '6': 0.8,
    '7': 0.8
  },
  dayBeforeLongMaxShare: 0.75,
  /* WU/CD po baznoj nedelji: do ≈ 25 km 10/10, do ≈ 35 km 15/10, više 20/15 — rad 10 km je brži od rada dužih
     distanci, pa duže zagrevanje dolazi ranije (ciljni p01: dan kvaliteta ≈ 10–11 km uz 40 km nedeljno) */
  warmupCooldown: [
    { uptoBaseLoad: 150, warmupSec: 600, cooldownSec: 600 },
    { uptoBaseLoad: 210, warmupSec: 900, cooldownSec: 600 },
    { uptoBaseLoad: null, warmupSec: 1200, cooldownSec: 900 }
  ]
};

/** Adekvatna priprema za 10 km (izvor upozorenja i predloga). */
export const ADEQUATE: AdequatePrep = {
  minWeeks: 8,
  minPeakWeeklyKm: 25,
  minRunDays: 4,
  /* dugi bar dužine trke (ciljni p11 „dugi = distanca trke") */
  minLongKm: 10,
  longCheckKm: 10,
  minLongSec: 3600,
  longCheckMinWeeks: 12,
  minTenureWeeks: 8,
  /* brz trkač: obim ≥ 45 km da kvalitet nivoa stane (ciljni p06) */
  /* krug 3: jedan izvor predloga obima za upozorenje `obim-za-nivo` (p02 srednji 40 km, p06 brz 45 km) */
  minPeakWeeklyKmByLevel: { brz: 45, srednji: 40, spor: 35, mali: 30, povratnik: 35 },
  shorter: { distanceId: 'fivek', label: '5 km' }
};
