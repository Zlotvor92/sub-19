/* POLUMARATON — BROJEVI BEZBEDNOSTI I ADEKVATNE PRIPREME. Jedan plafon po veličini (SPEC § 11.2).
   Opterećenje je u bodovima (BO = minut laganog trčanja); km se izvode. Izvor brojeva: trenerske granice iz v3 znanja
   (ROUND-01 § 3, V3-HM-REPORT) prevedene u minute; gde broj nije trenerov, piše „izbor". */
import type { AdequatePrep, LevelRule, SafetyNumbers } from '../../engine/types';
import { MAX_PEAK_OVER_BASE } from './templates';

/** Nivo: prvo pravilo koje važi. Početnik po izjavi; mali obim (ispod 3 h 30 min nedeljno) nosi jedan kvalitet
    nedeljno (v3: ispod 25 km jedan kvalitet); ostali po formi (VDOT). */
export const LEVELS: LevelRule[] = [
  /* krug 4 (T1, par P2): početnik sa stažom ≤ 8 nedelja — ritam 2:1 i dugi hod-trk */
  { id: 'pocetnik-nov', when: { beginner: true, maxTenureWeeks: 8 } },
  { id: 'pocetnik', when: { beginner: true } },
  /* povratnik: ≤ 8 nedelja od kraja pauze (uslov iz istorije, motor krug 3) — blaži početak i niži vrh (par P1 B) */
  { id: 'povratnik', when: { maxWeeksSincePause: 8 } },
  /* krug 4 (S8c, presuda trenera § F7): istorija bez ijedne nedelje sa kvalitetom (krugovi rada, zadat kvalitet, pun
     napor) — „sve u istom tempu" se tretira kao BEZ kvaliteta: blaži početak kao povratnik (par P3 A) */
  { id: 'povratnik', when: { maxRecentQualityWeeks: 0 } },
  /* mali obim samo ispod VDOT 52: brz trkač malog obima ostaje „brz" (dva kvaliteta) i dobija upozorenje
     `obim-za-nivo` (krug 2, R11; p06) */
  { id: 'mali', when: { maxBaseLoad: 210, maxVdot: 51.9 } },
  { id: 'spor', when: { maxVdot: 39.9 } },
  { id: 'srednji', when: { maxVdot: 51.9 } },
  { id: 'brz', when: {} }
];

/** Udeo dugog u PLANIRANIM minutima nedelje po broju dana (krug 2, R4/R15). Kapija meri km, a dugi sa blokom je
    brži od nedelje, pa je udeo u minutima nešto ispod granice u km: 4 dana 0,38 (≤ 40 % km), 5 → 0,34, 6 → 0,31,
    3 → 0,48 (≤ 50 %). Početnik isto (organizator: ≤ 45 %; kapija ≤ 40 % kod 4+ dana) — lagani dani rastu sa dugim. */
/* krug 5 (E7): udeli su u KILOMETRIMA. Motor ih primenjuje na minute nedelje u laganom tempu, a stvarni km nedelje
   su veći (kvalitet je brži), pa je udeo dugog u km uvek ≤ zadatog. */
const LONG_SHARE = { '1': 1, '2': 0.6, '3': 0.5, '4': 0.4, '5': 0.37, '6': 0.34, '7': 0.3 };

export const SAFETY: SafetyNumbers = {
  /* rast nedelje: +7 % u bodovima (km rastu i do ≈ 12 % kad nedelja ima manje brzog rada), najmanje
     12 BO (≈ 2 km) — trener: 5–10 % */
  maxWeeklyRampPct: 0.07,
  minRampLoad: 12,
  /* krug 4 (S2): korak nedelje ≤ + 8 % ili + 3 km (veće od ta dva); motor meri km nedelje, a cilj zadaje u minutima — 7 % daje ≤ 8–10 % stvarnih km (brži rad kvaliteta). Motor meri minute laganog tempa, a minuti
     kvaliteta nose više km — 2 km u minutima daje ≤ 3 km stvarnog rasta (izbor) */
  minRampKm: 2,
  /* vrh ≤ 1,5 × baza u bodovima: vršna nedelja nosi i rad kvaliteta, pa je vrh u km ≈ 1,30–1,38 × polazni obim
     (organizator: 4 dana ≈ +30–35 %, nikad > 1,40 × u km; kapija to meri) */
  maxPeakOverBase: MAX_PEAK_OVER_BASE,
  /* LESTVICA VRHA (krug 4, S2; presuda trenera ROUND-V4-HM-02 § F1). Trener daje množilac u KM: polazno ≤ 25 km →
     × 2,0 za ≥ 18 nedelja, × 1,6 za 12–17, × 1,4 kraće; 25–35 km → × 1,6; ≥ 35 km → × 1,4; staž < 8 nedelja ili
     tegoba u 12 meseci → × 1,5. Motor računa u bodovima, a vršna nedelja nosi i rad kvaliteta (≈ 12–15 % bodova
     iznad minuta), pa su množioci bodova veći od km (izbor; kapija meri km po tabeli trenera). */
  peakLadder: {
    rows: [
      { maxBaseKm: 25.5, minWeeks: 18, overBase: 2.1 },
      { maxBaseKm: 25.5, minWeeks: 12, overBase: 1.8 },
      { maxBaseKm: 25.5, minWeeks: 0, overBase: 1.58 },
      /* 25–35 km: × 1,6 (trener „do × 1,6"); priprema kraća od 12 nedelja ide niže (≈ × 1,3 u km, izbor: vlasnik-v1
         sa 10 nedelja — trener i drugi sudija traže dugi do ≈ 16 km, ne vrh od 48 km) */
      { maxBaseKm: 35.5, minWeeks: 12, overBase: 1.8 },
      { maxBaseKm: 35.5, minWeeks: 0, overBase: 1.47 },
      { maxBaseKm: null, minWeeks: 0, overBase: 1.58 }
    ],
    limitedOverBase: 1.7,
    limitedTenureWeeks: 8
  },
  /* plafon vrha po nivou ≈ satni plafon iz v3 (6,5 / 7,5 / 9 h nedeljno) uvećan za rad kvaliteta; brz ≈ 100 km
     nedeljno (v3 apsolutni plafon) */
  peakLoadCap: {
    pocetnik: 440,
    'pocetnik-nov': 360,
    povratnik: 500,
    mali: 420,
    spor: 540,
    srednji: 600,
    /* brz: ≈ 105–110 km — sa manjim plafonom vrh je samo × 1,25 baze, pa nedelja dve pred trku (pod = sadašnji
       obim + rad kvaliteta, R5) ne može da bude ≤ 85 % najteže */
    brz: 600
  },
  /* najduži dugi: početnik 2 h 10, spor i srednji 2 h 15 (ROUND-01, v3 do 22 km); brz 2 h 05 — v3 je dugi
     brzih ograničavao dužinom (do 26 km), pa brz trkač ne trči 29 km u pripremi za polumaraton */
  longMaxSec: {
    /* krug 4 (S3): ispod 45 km nedeljno granica dugog je vreme — do 2 h 15 */
    pocetnik: 8100,
    'pocetnik-nov': 7800,
    povratnik: 8100,
    mali: 8100,
    spor: 9000,
    srednji: 8100,
    brz: 7800
  },
  /* mali obim: dugi na granici kapije — motor ga računa od cilja nedelje, a nedelja posle pripremne trke je manja od
     cilja (vlasnik-v2 ned. 11 bi imala 41 %) */
  longShareByRunDays: {
    pocetnik: LONG_SHARE,
    /* D2: hod-trk dugi do 50 % nedelje (hodanje spušta udar; trener ROUND-V4-HM-03 § D3) */
    'pocetnik-nov': { ...LONG_SHARE, '3': 0.5, '4': 0.5, '5': 0.45 },
    povratnik: LONG_SHARE,
    mali: LONG_SHARE,
    spor: LONG_SHARE,
    srednji: LONG_SHARE,
    brz: LONG_SHARE
  },
  /* korak dugog 9 min (≈ 1,5 km; K7: ≤ 2 km; motor zaokružuje naniže, pa je stvarni korak ≈ 1–1,5 km); polazni dugi bez podatka: 30 % bazne nedelje. Mora biti ≤ dugom
     prve nedelje: motor ga koristi kao pod pravila koraka (max(prethodni, polazni) + korak), pa bi veći polazni
     dozvolio skok dugog na prelazu faza (K7). Cena: 3–4 dana bez podatka o najdužem trku kreću sa kraćim dugim. */
  longStepSec: 600,
  /* krug 4 (S2): dugi ≤ + 1,5 km ili + 10 min po nedelji gradnje (veće od ta dva) */
  longStepKm: 1.5,
  /* krug 5 (D1, D6; trener § D1): dugi ne kreće na plafonu — 1. nedelja ≈ 85 % najdužeg skorašnjeg, pa raste */
  longStartFloorShare: 0.85,
  /* krug 4 (S3): ispod 45 km nedeljno (motor procenjuje km iz minuta, pa prag 42 km u minutima ≈ 45 km stvarno) udeo dugog ≤ 42 % (u najviše 3 nedelje ≤ 45 %) — u minutima nešto niže, jer
     je dugi sa blokom brži od nedelje (kapija meri km) */
  longShareLowVolume: { belowKm: 42, minRunDays: 4, share: 0.42, peakShare: 0.45, peakWeeks: 3 },
  longStartShare: { '1': 0.6, '2': 0.5, '3': 0.46, '4': 0.35, '5': 0.32, '6': 0.27, '7': 0.24 },
  /* plafon doze po treningu: sekunde rada i udeo vrha (min rada / BO vrha) */
  doseCaps: {
    brzina: { maxWorkSec: 720, shareOfPeakLoad: 0.05 },
    /* prag do 30 min (VDOT 44–46 sa 30–40 km: 25–28 min, R16); više od toga uz intervale i blok prelazi 20 % nedelje */
    prag: { maxWorkSec: 2100, shareOfPeakLoad: 0.1 },
    'prag-p': { maxWorkSec: 1560, shareOfPeakLoad: 0.085 },
    /* intervali do 25 min rada (brz nivo 6–7 × 1 km) */
    intervali: { maxWorkSec: 1320, shareOfPeakLoad: 0.07 },
    /* tempo trke usred nedelje ≈ 1,4 × plafon praga: prva doza tempa trke nije manja od poslednjeg praga (R16);
       brz nivo do 55 min (12–15 km) */
    'tempo-trke': { maxWorkSec: 2640, shareOfPeakLoad: 0.135 },
    ostrenje: { maxWorkSec: 720, shareOfPeakLoad: 0.06 },
    /* blok u dugom: VDOT 45 sa 30 km 4 → 6 km, 40 km do ≈ 8 km, 3 dana do 7+ km (R16, R18) */
    'dugi-rp': { maxWorkSec: 2880, shareOfPeakLoad: 0.12 },
    'dugi-progresivno': { maxWorkSec: 660, shareOfPeakLoad: 0.05 }
  },
  /* lestvice: prvi trening zone ≤ 70 % plafona (K7), korak po pojavljivanju */
  progression: {
    brzina: { startPct: 0.68, stepPct: 0.12 },
    prag: { startPct: 0.5, stepPct: 0.1 },
    'prag-p': { startPct: 0.4, stepPct: 0.07 },
    intervali: { startPct: 0.45, stepPct: 0.15 },
    'tempo-trke': { startPct: 0.55, stepPct: 0.1 },
    ostrenje: { startPct: 0.9, stepPct: 0 },
    'dugi-rp': { startPct: 0.45, stepPct: 0.2 },
    'dugi-progresivno': { startPct: 0.75, stepPct: 0.1 }
  },
  /* doza ispod 8 min nije kvalitet (K8) */
  minDoseSec: 480,
  /* rad (sve deonice, i tempo trke i blok u dugom) ≤ 24 % vremena nedelje, najteža 30 % — ciljni p01 ned 13: tempo
     trke 44 min + blok 48 min ≈ 29 %. Rubrika K6 meri samo prag i brže (tempo trke nije u njoj); motor broji sav
     rad, pa je ovaj broj veći od K6 (zahtev prema motoru: brojati samo T, I, R) */
  maxFastShare: 0.22,
  maxFastSharePeak: 0.25,
  /* oštrenje nedelje trke: van budžeta, 8–12 min rada (krug 4, S1; trener § F8: 6–12 min) */
  sharpening: { stimulus: 'ostrenje', minSec: 480, maxSec: 720 },
  /* krug 5 (E9; drugi sudija: Bosquet i sar. 2007, trener): 8–14 dana pred trku najviše 2 brza treninga i ≤ 60 %
     brzog rada vršne nedelje; poslednjih 7 dana samo oštrenje */
  /* krug 5 (E4; trener § E4): bol 4/10 — 2 dana odmora i 7–10 dana lagano, kasnije nedelje netaknute; od 5/10
     obim se vraća kao posle pauze */
  painReturnFromLevel: 5,
  /* krug 5 (D7): tempo trke (uklj. blok u dugom) nedeljno — početnik ≤ 45, srednji ≤ 60, napredni ≤ 75 min */
  weeklyZoneMaxSec: {
    zone: 'RP',
    byLevel: {
      pocetnik: 2700,
      'pocetnik-nov': 2700,
      povratnik: 3600,
      mali: 3600,
      spor: 3600,
      srednji: 3600,
      brz: 4500
    }
  },
  /* krug 5 (D3; trener § D6): trkač sporiji od 2:05 (očekivano na dan trke; p03, p10) — dugi ≤ vreme trke + 5 min, blok u dugom ≤ 35 min */
  longVsRace: { fromRaceSec: 7500, overSec: 300, blockMaxSec: 2100 },
  taper: { lastDays: 7, weekBeforeFromDays: 14, weekBeforeMaxQuality: 2, weekBeforeMaxOfPeak: 0.6 },
  /* lagan dan najmanje 25 min; lagan ≤ 65 % dugog (3 dana ≤ 70 %; krug 2, R2/R15). Motor meri stvarni dugi
     posle zaokruživanja, a dugi sa blokom je brži — 0,63/0,68 ostavljaju rezervu za 0,5 km zaokruživanja */
  minEasySec: 1500,
  easyMaxShareOfLong: {
    '1': 0.68,
    '2': 0.68,
    '3': 0.68,
    '4': 0.63,
    '5': 0.63,
    '6': 0.63,
    '7': 0.63
  },
  dayBeforeLongMaxShare: 0.7,
  /* WU/CD po baznoj nedelji: do ≈ 25 km 10/10, do ≈ 40 km 15/10, više 20/15 (v3) */
  warmupCooldown: [
    { uptoBaseLoad: 150, warmupSec: 600, cooldownSec: 600 },
    { uptoBaseLoad: 240, warmupSec: 900, cooldownSec: 600 },
    { uptoBaseLoad: null, warmupSec: 1200, cooldownSec: 900 }
  ]
};

/** Adekvatna priprema za polumaraton (izvor upozorenja i predloga). */
export const ADEQUATE: AdequatePrep = {
  minWeeks: 10,
  minPeakWeeklyKm: 40,
  minRunDays: 4,
  minLongKm: 16,
  /* krug 4 (S3, T7; trener § F1): plan od 16+ nedelja mora stići do dugog od 15 km ili 1 h 50 */
  longCheckKm: 15,
  minLongSec: 6600,
  longCheckMinWeeks: 16,
  /* krug 4 (S8e): staž ispod 8 nedelja — širi raspon prognoze i upozorenje */
  minTenureWeeks: 8,
  /* vrh koji nivo traži da bi kvalitet nivoa stao u plan (upozorenje `obim-za-nivo`): brz ≈ 60 km (v3) */
  minPeakWeeklyKmByLevel: { brz: 60 },
  shorter: { distanceId: '10k', label: '10 km' }
};
