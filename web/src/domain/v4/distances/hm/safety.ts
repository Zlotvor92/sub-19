/* POLUMARATON — BROJEVI BEZBEDNOSTI I ADEKVATNE PRIPREME. Jedan plafon po veličini (SPEC § 11.2).
   Opterećenje je u bodovima (BO = minut laganog trčanja); km se izvode. Izvor brojeva: trenerske granice iz v3 znanja
   (ROUND-01 § 3, V3-HM-REPORT) prevedene u minute; gde broj nije trenerov, piše „izbor". */
import type { AdequatePrep, LevelRule, SafetyNumbers } from '../../engine/types';

/** Nivo: prvo pravilo koje važi. Početnik po izjavi; mali obim (ispod 3 h 30 min nedeljno) nosi jedan kvalitet
    nedeljno (v3: ispod 25 km jedan kvalitet); ostali po formi (VDOT). */
export const LEVELS: LevelRule[] = [
  { id: 'pocetnik', when: { beginner: true } },
  { id: 'mali', when: { maxBaseLoad: 210 } },
  { id: 'spor', when: { maxVdot: 39.9 } },
  { id: 'srednji', when: { maxVdot: 51.9 } },
  { id: 'brz', when: {} }
];

/** Udeo dugog u vrhu po broju dana (bodovi): 4 dana 40 % (organizator: 40–42 % kod 4 dana), 5 → 36 %, 6 → 33 %,
    3 → 45 % (v3), 2 → 55 %. Početnik: dugi kao v3 (≈ 45 % nedelje kod 4 dana, p11 do 18 km). */
const REGULAR_SHARE = { '1': 1, '2': 0.55, '3': 0.45, '4': 0.4, '5': 0.36, '6': 0.33, '7': 0.3 };
const REGULAR_SHARE_BEGINNER = {
  '1': 1,
  '2': 0.6,
  '3': 0.5,
  '4': 0.46,
  '5': 0.42,
  '6': 0.38,
  '7': 0.35
};

export const SAFETY: SafetyNumbers = {
  /* rast nedelje: +7 % u bodovima (km rastu i do ≈ 12 % kad nedelja ima manje brzog rada), najmanje
     12 BO (≈ 2 km) — trener: 5–10 % */
  maxWeeklyRampPct: 0.07,
  minRampLoad: 12,
  /* plafon vrha po nivou ≈ satni plafon iz v3 (6,5 / 7,5 / 9 h nedeljno) uvećan za rad kvaliteta; brz ≈ 100 km
     nedeljno (v3 apsolutni plafon) */
  peakLoadCap: {
    pocetnik: 440,
    mali: 420,
    spor: 540,
    srednji: 600,
    brz: 520
  },
  /* najduži dugi: početnik 2 h 10, spor i srednji 2 h 15 (ROUND-01, v3 do 22 km); brz 2 h 05 — v3 je dugi
     brzih ograničavao dužinom (do 26 km), pa brz trkač ne trči 29 km u pripremi za polumaraton */
  longMaxSec: {
    pocetnik: 7800,
    mali: 7800,
    spor: 8100,
    srednji: 8100,
    brz: 7500
  },
  longShareByRunDays: {
    pocetnik: REGULAR_SHARE_BEGINNER,
    mali: REGULAR_SHARE,
    spor: REGULAR_SHARE,
    srednji: REGULAR_SHARE,
    brz: REGULAR_SHARE
  },
  /* korak dugog 9 min (≈ 1,5 km; K7: ≤ 2 km; motor zaokružuje naniže, pa je stvarni korak ≈ 1–1,5 km); polazni dugi bez podatka: 30 % bazne nedelje. Mora biti ≤ dugom
     prve nedelje: motor ga koristi kao pod pravila koraka (max(prethodni, polazni) + korak), pa bi veći polazni
     dozvolio skok dugog na prelazu faza (K7). Cena: 3–4 dana bez podatka o najdužem trku kreću sa kraćim dugim. */
  longStepSec: 540,
  longStartShare: { '1': 0.6, '2': 0.45, '3': 0.38, '4': 0.31, '5': 0.28, '6': 0.25, '7': 0.23 },
  /* plafon doze po treningu: sekunde rada i udeo vrha (min rada / BO vrha) */
  doseCaps: {
    brzina: { maxWorkSec: 720, shareOfPeakLoad: 0.05 },
    prag: { maxWorkSec: 2100, shareOfPeakLoad: 0.1 },
    'prag-p': { maxWorkSec: 1560, shareOfPeakLoad: 0.085 },
    intervali: { maxWorkSec: 1260, shareOfPeakLoad: 0.062 },
    'tempo-trke': { maxWorkSec: 2640, shareOfPeakLoad: 0.12 },
    ostrenje: { maxWorkSec: 720, shareOfPeakLoad: 0.06 },
    'dugi-rp': { maxWorkSec: 2400, shareOfPeakLoad: 0.1 },
    'dugi-progresivno': { maxWorkSec: 900, shareOfPeakLoad: 0.045 }
  },
  /* lestvice: prvi trening zone ≤ 70 % plafona (K7), korak po pojavljivanju */
  progression: {
    brzina: { startPct: 0.68, stepPct: 0.12 },
    prag: { startPct: 0.5, stepPct: 0.08 },
    'prag-p': { startPct: 0.4, stepPct: 0.07 },
    intervali: { startPct: 0.55, stepPct: 0.2 },
    'tempo-trke': { startPct: 0.55, stepPct: 0.1 },
    ostrenje: { startPct: 0.9, stepPct: 0 },
    'dugi-rp': { startPct: 0.45, stepPct: 0.2 },
    'dugi-progresivno': { startPct: 0.6, stepPct: 0.2 }
  },
  /* doza ispod 8 min nije kvalitet (K8) */
  minDoseSec: 480,
  /* brz rad ≤ 20 % vremena nedelje, vršna 22 % (rubrika: ≤ 22 %, najviše jedna do 25 %) */
  maxFastShare: 0.2,
  maxFastSharePeak: 0.22,
  /* lagan dan najmanje 25 min; lagan ≤ 80 % dugog, dan pred dugi ≤ 70 % (v3: 65–75 %;
     više od toga ne, da dugi ostane najduži i najvažniji trening nedelje) */
  minEasySec: 1500,
  easyMaxShareOfLong: 0.8,
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
  shorter: { distanceId: '10k', label: '10 km' }
};
