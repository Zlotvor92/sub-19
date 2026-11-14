/* 5 KM — BROJEVI BEZBEDNOSTI I ADEKVATNE PRIPREME. Jedan plafon po veličini (SPEC § 11.2). Opterećenje je u bodovima
   (BO = minut laganog trčanja); km se izvode. Izvor brojeva: ciljni planovi trenera (`coach/target/5K/`, README) i
   pravila krugova R3–R9 (brz rad, silazak obima i intenziteta). Gde broj nije trenerov, piše „izbor".
   Razlike prema 10 km: I i R nose veći deo rada (veći udeo plafona i više brzine u osnovi), sužavanje je 5–7 dana,
   provera forme je 3 km (početnik i mali obim 1,5 km), dugi je aerobna osnova 50–90 min bez bloka u tempu trke. */
import type { AdequatePrep, LevelRule, SafetyNumbers } from '../../engine/types';
import { MAX_PEAK_OVER_BASE } from './templates';

/** Nivo: prvo pravilo koje važi. Isti nivoi kao kod drugih distanci; „mali obim" je ispod ≈ 20 km nedeljno
    (≈ 2 h): 5 km nosi dva kvaliteta već od ≈ 20 km (ciljni p08 sa 3 dana i 35 km nosi dva mala). */
export const LEVELS: LevelRule[] = [
  { id: 'pocetnik-nov', when: { beginner: true, maxTenureWeeks: 8 } },
  { id: 'pocetnik', when: { beginner: true } },
  { id: 'povratnik', when: { maxWeeksSincePause: 8 } },
  { id: 'povratnik', when: { maxRecentQualityWeeks: 0 } },
  { id: 'mali', when: { maxBaseLoad: 120, maxVdot: 51.9 } },
  { id: 'spor', when: { maxVdot: 39.9 } },
  { id: 'srednji', when: { maxVdot: 51.9 } },
  { id: 'brz', when: {} }
];

/* Udeo dugog u KILOMETRIMA nedelje po broju dana (README trenera: 28–33 %, 3 dana do 42 %; ciljni p01 16 od 48 km = 33 %, 4 dana ovde 32 %: sa 33 % povratnik sa 20 km ima nedelju trke > 50 % vrha). Motor ga primenjuje na
   minute u laganom tempu, pa je stvarni udeo u km ≤ zadatog. */
const LONG_SHARE = { '1': 1, '2': 0.58, '3': 0.42, '4': 0.32, '5': 0.29, '6': 0.27, '7': 0.25 };

export const SAFETY: SafetyNumbers = {
  /* rast nedelje: + 7 % u bodovima, najmanje 10 BO (≈ 1,5 km) — trener: + 0,5–2 km nedeljno (ciljni p11 + 0,5–1 km) */
  maxWeeklyRampPct: 0.07,
  minRampLoad: 10,
  minRampKm: 1.5,
  maxPeakOverBase: MAX_PEAK_OVER_BASE,
  /* LESTVICA VRHA za 5 km (u km, ciljni planovi): p11 12 → 19,5 km za 16 nedelja (× 1,6), p01 40 → 48 za 12 (× 1,2),
     p04 45 → 50 za 16 (× 1,1), p08 35 → 36 za 16 (× 1,03). 5 km ne traži velik obim: vrh raste malo kod iskusnih,
     a početnik i mali obim rastu najviše. Množioci bodova ≈ 1,15 × množilac u km (rad 5 km je brz, pa nosi više
     bodova po minutu; izbor, izmereno na 12 profila; kapija meri km po tabeli `testdata/gate.ts`). */
  peakLadder: {
    rows: [
      { maxBaseKm: 20.5, minWeeks: 14, overBase: 1.9 },
      { maxBaseKm: 20.5, minWeeks: 8, overBase: 1.65 },
      { maxBaseKm: 20.5, minWeeks: 0, overBase: 1.45 },
      { maxBaseKm: 35.5, minWeeks: 8, overBase: 1.55 },
      { maxBaseKm: 35.5, minWeeks: 0, overBase: 1.35 },
      /* R12 (F1): 20–35 km × 1,55 od 8 nedelja (sa 1,7 stariji trkač p16 ide preko × 1,4 u km), > 35 km × 1,7 / 1,55
         / 1,3 u bodovima (bilo 1,5 / 1,4 / 1,28): kvalitet
         nosi više bodova po minutu, pa obim u km raste ≈ × 1,1–1,25 */
      { maxBaseKm: null, minWeeks: 12, overBase: 1.7 },
      { maxBaseKm: null, minWeeks: 8, overBase: 1.55 },
      { maxBaseKm: null, minWeeks: 0, overBase: 1.3 }
    ],
    limitedOverBase: 1.45,
    limitedTenureWeeks: 8
  },
  /* plafon vrha po nivou (BO ≈ minuti nedelje sa težinom rada): 5 km — brz ≈ 8 h 30, srednji i spor ≈ 7 h 30
     (ciljni p04 vrh 50 km ≈ 5,8 h; brz trkač 65 km ≈ 6 h) (izbor) */
  /* R12 (F1): plafoni podignuti (spor/srednji 600, brz 660) — sa 460/520 plafon je, a ne lestvica, držao obim ravnim
     (p04: P 455 uz plafon 460) */
  peakLoadCap: {
    pocetnik: 300,
    'pocetnik-nov': 220,
    povratnik: 420,
    mali: 280,
    spor: 600,
    srednji: 600,
    brz: 660
  },
  /* najduži dugi: 50–90 min (brief 5K; README: rekreativac 60–90 min, početnik do 60 min, ciljni p11 9 km ≈ 62 min; početnik 90 min jer početnik sa
     velikim obimom (p12: 45 km, 4 dana) inače ne nosi ni sadašnji obim — lagan dan je ≤ 80 % dugog) */
  longMaxSec: {
    /* R12 (F2): početnik i povratnik do 100 min — plan ne kreće ispod obima i dugog koje trkač već trči (p12 početnik
       sa 45 km na 4 dana: sa 90 min dugog i lagan ≤ 80 % dugog nedelja staje na 40 km; P3 A dugi 14–15 km) */
    pocetnik: 6000,
    'pocetnik-nov': 3300,
    povratnik: 6000,
    mali: 4800,
    /* R12 (F1): spor do 100 min — ciljni p04 dugi 14 km uz lagano 6:47–7:28 ≈ 100 min; sa 90 min obim sporog sa 5
       dana ne raste (lagan ≤ 80 % dugog) */
    spor: 6000,
    /* R20: jedan plafon dugog za 5 km — 100 min (bilo 90/95/100 po nivou, sudija B4); kod 3 dana i srednjeg nivoa
       obim inače ne raste (p08 ravan 33–36 km 16 nedelja) */
    srednji: 6000,
    brz: 6000
  },
  longShareByRunDays: {
    /* početnik sa 3 dana: ciljni p11 dugi 9 od 19,5 km (46 %) */
    pocetnik: { ...LONG_SHARE, '3': 0.45 },
    'pocetnik-nov': { ...LONG_SHARE, '3': 0.44, '4': 0.36, '5': 0.32 },
    povratnik: LONG_SHARE,
    mali: LONG_SHARE,
    spor: LONG_SHARE,
    srednji: LONG_SHARE,
    brz: LONG_SHARE
  },
  /* korak dugog: + 4 min ili + 0,5–1 km nedeljno (README: + 0,5–1 km do kraja razvoja) */
  longStepSec: 240,
  longStepKm: 1,
  /* dugi kreće sa 0,80–0,85 × vrha (README) — sa 3 dana nedelja 1 = sadašnji obim */
  longStartFloorShare: 0.96,
  longStartFloorFromCapShare: 0.85,
  longFloorGrowMinRunDays: 3,
  longStartShare: { '1': 0.6, '2': 0.5, '3': 0.43, '4': 0.33, '5': 0.29, '6': 0.26, '7': 0.23 },
  /* plafon doze po treningu (README trenera 5K). Udeo (`shareOfPeakLoad`) × vrh je osnovica lestvice doze (S4) —
     izabran tako da je kod ≈ 40 km nedeljno (P ≈ 300–330 BO) osnovica ≈ plafon, pa `dosePct` šablona znači % plafona;
     kod malog obima doza je srazmerno manja (12 km: R 9 min, I 11 min, RP 14 min, prag 12 min); brzina ima veći udeo (0,06) da i obim od
     12 km dobije R ≥ 6 min.
     R 6 → 12 min (VDOT < 40 do 12; ostali 8–10 — ovde 12 za sve, brzina je ono po čemu se 5 km razlikuje);
     T 14 → 24 min (brz 28; plafon deljiv sa 2, 3 i 4 deonice — deonica se zaokružuje na minut); I 12–24 min po obimu (VDOT < 40 najviše 20); RP 20–22 min u najtežoj (početnik 16–17);
     završnica u dugom 8–10 min u T. Udeo plafona (`shareOfPeakLoad`) za I i R je veći nego kod 10 km. */
  doseCaps: {
    brzina: { maxWorkSec: 720, shareOfPeakLoad: 0.06 },
    prag: { maxWorkSec: { brz: 1680, '*': 1440 }, shareOfPeakLoad: 0.085 },
    /* R20 (P2 B): 0,11 — kod obima hod-trka (P ≈ 95) prvi fartlek je inače ispod najmanje doze i otpada do 13. nedelje */
    'prag-p': { maxWorkSec: 900, shareOfPeakLoad: 0.11 },
    intervali: { maxWorkSec: { brz: 1440, spor: 1200, '*': 1260 }, shareOfPeakLoad: 0.075 },
    'tempo-trke': {
      maxWorkSec: { brz: 1440, pocetnik: 1020, 'pocetnik-nov': 900, '*': 1320 },
      shareOfPeakLoad: 0.095
    },
    ostrenje: { maxWorkSec: 540, shareOfPeakLoad: 0.05 },
    'dugi-prag': { maxWorkSec: 600, shareOfPeakLoad: 0.035 },
    'dugi-progresivno': { maxWorkSec: 600, shareOfPeakLoad: 0.035 }
  },
  /* lestvice: prvi trening zone ≤ 70 % plafona (K7); I blok 65 → 80 → 100 % (README) */
  progression: {
    brzina: { startPct: 0.55, stepPct: 0.12 },
    prag: { startPct: 0.55, stepPct: 0.1 },
    'prag-p': { startPct: 0.6, stepPct: 0.1 },
    intervali: { startPct: 0.65, stepPct: 0.15 },
    'tempo-trke': { startPct: 0.6, stepPct: 0.1 },
    ostrenje: { startPct: 0.9, stepPct: 0 },
    'dugi-prag': { startPct: 0.8, stepPct: 0.1 },
    'dugi-progresivno': { startPct: 0.8, stepPct: 0.1 }
  },
  minDoseSec: 360,
  /* brz rad (sav rad: prag, intervali, brzina, tempo trke, završnica u dugom) ≤ 20 % vremena nedelje, najteža
     ≤ 23 % (README: T + I + R + RP ≤ 20 %; ciljni planovi 9–16 %; vršna sme malo više zbog R uz RP, izbor) */
  maxFastShare: 0.2,
  maxFastSharePeak: 0.23,
  /* oštrenje nedelje trke: 4 × 400 m u tempu trke, 7–9 min rada (README) */
  sharpening: { stimulus: 'ostrenje', minSec: 420, maxSec: 540 },
  painReturnFromLevel: 5,
  /* trka do 65 min (5 km i kraće) — oporavak kao planirana provera */
  shortEffortSec: 3900,
  /* A8: prognoza početnika najviše 3 % brža od današnje forme, potpuno nov bez napretka */
  forecastMaxGainByLevel: { pocetnik: 0.03, 'pocetnik-nov': 0 },
  /* start 5 km: prvi km 1–3 s/km sporije od tempa trke (ciljni p01 1. km 4:28 uz RP 4:26, p04 5:26–5:28 uz 5:24) */
  raceStartPaceOffsetSec: { from: 1, to: 3 },
  /* skraćena nedelja: dugi ≤ 38 % nedelje u km (5 km: dugi je ≈ trećina nedelje, izbor) */
  shortenedLongMaxShare: 0.38,
  /* prag i tempo trke bliži od 5 s/km — jedan podražaj nedeljno; drugi kvalitet tada intervali */
  minZoneGapSecPerKm: 5,
  /* README: prvi kvalitet najranije 4 dana posle provere; pre provere 2 dana bez kvaliteta */
  noQualityBeforeTestDays: 2,
  zoneGapReplacement: 'intervali',
  /* SUŽAVANJE 5–7 DANA (brief 5K; README: jedna nedelja tapera, obim ≈ 75 %, rad ≤ 60 %): najteža nedelja je 3
     pred trku (kraći planovi 2), nedelja −2 ≤ 85 % vrha, 7 dana pred trku najviše 2 brza treninga i ≤ 60 % brzog
     rada vršne nedelje, poslednjih 5 dana samo oštrenje; nedelja trke (bez trke) ≤ 50 % vrha (ciljni p01 16 od 48 km,
     p04 20 od 50, p11 6 od 19,5) */
  taper: {
    lastDays: 5,
    weekBeforeFromDays: 8,
    weekBeforeMaxQuality: 2,
    weekBeforeMaxOfPeak: 0.6,
    weekMinus2MaxOfPeak: 0.85,
    calendarMinus2MaxQuality: 2,
    raceWeekMaxOfPeak: 0.5,
    /* krug 11: kad su lagani dani i dugi već na najkraćem, silazak skraćuje brz trening do najmanje doze (i
       najkraćeg zagrevanja i hlađenja); nedelja ne gubi ni dan ni kvalitet (p06: brz, 25 km, 5 dana) */
    trimOrder: ['scale', 'easy', 'long', 'quality']
  },
  /* lagan dan najmanje 20 min (K8: najkraći trening ≥ 20 min; ciljni p11 3 km ≈ 21 min) */
  minEasySec: 1200,
  /* krug 11 (stavka 16): lagan dan i dan sa ubrzanjima ne padaju ispod 20 min zbog zaokruživanja na 0,5 km */
  easyNotBelowMin: true,
  /* krug 11 (stavka 17): zaokruživanje doze ne prelazi plafon zone */
  doseRoundUnderCap: true,
  /* krug 11 (stavka 19): od 55 godina dan oporavka više između dva brza treninga nedelje */
  ageRecovery: { fromAge: 55, extraGapDays: 1 },
  /* najkraće lagano trčanje po nivou: 30 min iskusnima (lagani dani 5 km su kraći nego kod 10 km), 25 min malom
     obimu i povratniku */
  minEasyMin: { brz: 30, srednji: 30, spor: 30, mali: 25, povratnik: 25 },
  minEasyFromRunDays: 5,
  /* Z8: kad obim ne nosi najkraće lagano nivoa, lagan dan sme do 20 min uz rečenicu */
  minEasyFallbackMin: 20,
  peakNotBelowBase: true,
  /* usponi najviše 2 od 3 nedelje — treća dobija brzinu na ravnom */
  tagMaxRun: [{ tag: 'brdo', max: 2, window: 3, replacement: 'brzina' }],
  /* sporiji od 30:00 na 5 km (≈ VDOT 31) — intervali ne brži od tempa na 3 km iz forme (izbor) */
  intervalPaceFloor: { distanceM: 3000, fromRaceSec: 1800 },
  /* lagan dan ≤ 80 % dugog (ciljni p01: lagano 9 uz dugi 13–16; p04: 7–9 uz 11–14); 3 dana 75 % — dan sa ubrzanjima
     nosi i 5 min dodatka, pa bi sa 80 % prešao 80 % dugog (p10) */
  easyMaxShareOfLong: {
    '1': 0.8,
    '2': 0.8,
    '3': 0.75,
    '4': 0.8,
    '5': 0.8,
    '6': 0.8,
    '7': 0.8
  },
  dayBeforeLongMaxShare: 0.75,
  /* R17: lagan dan sme do 2 × najdužeg laganog prethodne nedelje (podrazumevano 1,25) — kod 5 km nedelja tela sa dva
     kvaliteta ima lagan dan od ≈ 22 min, pa je sa 1,25 najteža nedelja posle provere ostajala ispod cilja i ispod nedelje
     tela (p02: „vršna" u 2. od 8, silazak od 2. nedelje) */
  easyMaxOverPrevious: 2,
  /* WU/CD po baznoj nedelji: rad 5 km je najbrži, pa je zagrevanje duže i sa ubrzanjima (tekst u biblioteci):
     do ≈ 20 km 10/10, do ≈ 35 km 15/10, više 20/10 (izbor; ciljni p01: dan kvaliteta ≈ 10 km uz 40 km nedeljno) */
  warmupCooldown: [
    { uptoBaseLoad: 120, warmupSec: 600, cooldownSec: 600 },
    { uptoBaseLoad: 210, warmupSec: 900, cooldownSec: 600 },
    { uptoBaseLoad: null, warmupSec: 1200, cooldownSec: 600 }
  ]
};

/** Adekvatna priprema za 5 km (izvor upozorenja i predloga). */
export const ADEQUATE: AdequatePrep = {
  minWeeks: 6,
  minPeakWeeklyKm: 15,
  minRunDays: 3,
  /* R12 (F6): dugi bar dužine trke ili 35 min — „dugi ≥ 7 km" nema osnova za 5 km, a tekst upozorenja („poslednji deo
     trke biće duži od svega") je netačan kad je dugi duži od trke (p03 6,6 km, p13 5,2 km) */
  minLongKm: 5,
  longCheckKm: 5,
  minLongSec: 2100,
  longCheckMinWeeks: 10,
  minTenureWeeks: 6,
  /* brz trkač: obim ≥ 35 km da kvalitet nivoa stane (I 20+ min, RP 22 min uz WU/CD) */
  minPeakWeeklyKmByLevel: { brz: 35 }
  /* kraće distance od 5 km u aplikaciji nema */
};
