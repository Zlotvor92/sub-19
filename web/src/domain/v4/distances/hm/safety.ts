/* POLUMARATON — BROJEVI BEZBEDNOSTI I ADEKVATNE PRIPREME. Jedan plafon po veličini (SPEC § 11.2).
   Opterećenje je u bodovima (BO = minut laganog trčanja); km se izvode. Izvor brojeva: trenerske granice iz v3 znanja
   (ROUND-01 § 3, V3-HM-REPORT) prevedene u minute; gde broj nije trenerov, piše „izbor". */
import type { AdequatePrep, LevelRule, SafetyNumbers } from '../../engine/types';

/** Nivo: prvo pravilo koje važi. Početnik po izjavi; ostali po formi (VDOT). */
export const LEVELS: LevelRule[] = [
  { id: 'pocetnik', when: { beginner: true } },
  { id: 'spor', when: { maxVdot: 39.9 } },
  { id: 'srednji', when: { maxVdot: 51.9 } },
  { id: 'brz', when: {} }
];

export const SAFETY: SafetyNumbers = {
  /* rast nedelje: +8 %, najmanje 12 BO (≈ 2 km) — trener: 5–10 % */
  maxWeeklyRampPct: 0.08,
  minRampLoad: 12,
  /* plafon vrha po nivou ≈ satni plafon iz v3 (6,5 / 7,5 / 9 h nedeljno) uvećan za rad kvaliteta; brz: bez */
  peakLoadCap: { pocetnik: 420, spor: 500, srednji: 600, brz: null },
  /* najduži dugi: početnik 2 h 05, spor 2 h 15 (ROUND-01); srednji 2 h 10 i brz 2 h — v3 je dugi brzih
     ograničavao i dužinom (22–26 km), pa brz trkač ne trči 29 km u pripremi za polumaraton */
  longMaxSec: { pocetnik: 7500, spor: 8100, srednji: 7800, brz: 7200 },
  /* udeo dugog u vrhu: 4+ dana 30–34 % (trener: 30–35 %), 3 dana 42 %, 2 dana 55 % */
  longShareByRunDays: {
    '1': 1,
    '2': 0.55,
    '3': 0.42,
    '4': 0.34,
    '5': 0.32,
    '6': 0.3,
    '7': 0.28
  },
  /* korak dugog 7 min (≈ 1–1,5 km); polazni dugi bez podatka: 30 % bazne nedelje (mora
     biti ≤ dugom prve nedelje, inače prvi korak dugog preskače pravilo koraka) */
  longStepSec: 420,
  longStartShare: 0.3,
  /* plafon doze po treningu: sekunde rada i udeo vrha (min rada / BO vrha) */
  doseCaps: {
    brzina: { maxWorkSec: 600, shareOfPeakLoad: 0.045 },
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
    brzina: { startPct: 0.8, stepPct: 0.1 },
    prag: { startPct: 0.5, stepPct: 0.08 },
    'prag-p': { startPct: 0.45, stepPct: 0.07 },
    intervali: { startPct: 0.65, stepPct: 0.1 },
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
  /* lagan dan najmanje 25 min; lagan ≤ 75 % dugog, dan pred dugi ≤ 65 % */
  minEasySec: 1500,
  easyMaxShareOfLong: 0.75,
  dayBeforeLongMaxShare: 0.65,
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
