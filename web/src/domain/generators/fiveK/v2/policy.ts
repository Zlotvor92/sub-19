/* 5K v2 — pravila (specifikacija u kodu).

   Svaki prag ovde je TRENERSKA HEURISTIKA, ne dokazana fiziološka granica. Brojevi su izabrani
   da budu konzervativni i proverljivi; promena praga = nova verzija (`version`) i zapis u
   `DECISIONS` na dnu fajla. Jednačine Daniels–Gilbert (paces.ts) su objavljeni model, ali i
   one su model, ne merenje konkretnog trkača. */

import type { Weekday } from './types.ts';

export const FIVE_K_V2_POLICY = {
  version: '5k-v2.0.1',

  input: {
    /** Podržan je samo raspored sa tačno 4 dana trčanja (heuristika opsega v2, ne pravilo treninga). */
    runDaysPerWeek: 4,
    /** Trenutni nedeljni obim [km]; van opsega → odbijanje (heuristika opsega, nije validirano na populaciji). */
    weeklyKm: { min: 15, max: 45 },
    /** Rezultat stariji od ovoga ne opisuje trenutnu formu dovoljno pouzdano (heuristika). */
    resultMaxAgeDays: 84,
    /** Distance rezultata iz kojih se računa VDOT. */
    resultDistancesM: [3000, 5000, 10000] as const,
    /** Opseg VDOT-a za koji v2 pravi plan (heuristika opsega; van toga pravila nisu proverena). */
    vdot: { min: 30, max: 60 },
    /** Trajanje plana u celim nedeljama (heuristika opsega). */
    planWeeks: { min: 8, max: 16 },
    /** Cilj [s] mora da odgovara VDOT-u u ovom opsegu da bi uopšte bio procenjen (sanity granica). */
    goalVdot: { min: 25, max: 85 }
  },

  paces: {
    /* Udeo VDOT-a (VO2) po zoni. Kalibrisano tako da daje brojeve bliske Danielsovim tabelama;
       heuristika, ne merenje. */
    /** E: opseg lagano (sporija i brža granica). */
    eFractionSlow: 0.62,
    eFractionFast: 0.7,
    /** T: prag (~1 h trkačkog napora). */
    tFraction: 0.88,
    /** I: interval blizu vVO2max. */
    iFraction: 0.975,
    /** R: ponavljanja brža od vVO2max. */
    rFraction: 1.055,
    /** RP = predviđeni tempo 5K trke iz VDOT-a rezultata. Cilj NE menja tempo. */
    raceDistanceM: 5000
  },

  goal: {
    /** Razlika VDOT(cilj) − VDOT(rezultat) do koje je cilj „izvodljiv" (heuristika). */
    feasibleMaxGain: 1.0,
    /** … do koje je „ambiciozan"; iznad je „nerealan" (heuristika, bez obećanja). */
    ambitiousMaxGain: 2.5
  },

  phases: {
    /** Taper traje 2 nedelje, pa trkačka nedelja (heuristika). */
    taperWeeks: 2,
    raceWeeks: 1,
    /** Oštrenje: 2 nedelje ako ima ≥ 7 nedelja izgradnje, inače 1 (heuristika). */
    sharpenWeeksLong: 2,
    sharpenLongFromBuildWeeks: 7,
    sharpenWeeksShort: 1
  },

  volume: {
    /** Najveći rast ciljnog km između uzastopnih ne-rasteretnih nedelja izgradnje (heuristika „+8%"). */
    maxBuildGrowth: 0.08,
    /** Vrh obima ≤ ovaj faktor × početni obim (heuristika). */
    peakCapFactor: 1.3,
    /** Svaka N-ta nedelja (po rednom broju plana) u izgradnji je rasteretna (heuristika). */
    deloadEvery: 4,
    /** Rasteretna nedelja ≈ ovaj udeo prethodne nedelje (heuristika). */
    deloadFactor: 0.8,
    /** Taper: udeo vrha po nedelji tapera (heuristika). */
    taperFactors: [0.85, 0.7] as const,
    /** Trkačka nedelja ≈ udeo vrha, BEZ same trke (heuristika). */
    raceWeekFactor: 0.5,
    /** 2.0.1: gornja granica nedeljnog cilja za 4 dana (heuristika): kvalitetni dani primaju ~35–40%
        nedelje, dugi ≤ 30%, pa ostatak ide u jedan lagan trk; iznad ~50 km on prelazi ~17 km. */
    fourDayMaxWeekKm: 50,
    /** Dozvoljeno odstupanje faktora pri proveri (zaokruživanje na 0,1 km). */
    factorTolerance: 0.03
  },

  quality: {
    /** I (uključujući RP) ≤ 8% nedeljnog obima; ponavljanje ≤ 5 min (Daniels-ova heuristika). */
    iMaxShare: 0.08,
    iRepMaxSec: 300,
    /** T ≤ 10% nedeljnog obima; kontinuirano ≤ 20 min (heuristika). */
    tMaxShare: 0.1,
    tContinuousMaxSec: 1200,
    /** R ≤ 5% nedeljnog obima; ponavljanje ≤ 2 min (heuristika). */
    rMaxShare: 0.05,
    rRepMaxSec: 120,
    /** U nedeljama vrhunca (bez rasterećenja) glavni kvalitet ≥ 70% svog budžeta (heuristika). */
    peakMainMinShareOfBudget: 0.7,
    /** Ponuda dužina ponavljanja [km] po tipu, od poželjnije ka manje poželjnoj (heuristika).
        Bira se PRVA opcija čiji ukupni rad dostiže `repFillShare` budžeta; ako nijedna, ona sa
        najvećim ukupnim radom. 2.0.1: dodate kraće opcije za nizak obim (v. DECISIONS). */
    repOptionsKm: {
      R: [0.4, 0.3, 0.2, 0.15],
      Rsharpen: [0.3, 0.2],
      I: [1.2, 1.0, 0.8, 0.6, 0.5],
      RP: [1.0, 0.8, 0.6, 0.4],
      Tcruise: [2.0, 1.6, 1.2, 1.0],
      RPsharpener: [0.4, 0.3, 0.2]
    },
    /** Udeo budžeta koji izabrana opcija treba da popuni (heuristika; isti broj kao donji prag vrhunca). */
    repFillShare: 0.7,
    /** I ponavljanje kraće od ovoga nije I stimulus (heuristika ≈ 2 min). */
    iRepMinSec: 120,
    /** Najmanji/najveći broj ponavljanja da bi sesija imala smisla (heuristika). */
    minReps: { R: 4, I: 2, RP: 2, T: 2 },
    maxReps: { R: 10, I: 6, RP: 6, T: 5 },
    /** Kratak T: kontinuirani blok = min(udeo T budžeta, minuta T), zaokruženo naniže na 0,5 km. */
    shortTShareOfBudget: 0.7,
    shortTMaxSec: 900,
    shortTMinKm: 1.0,
    /** Rasteretna nedelja: jedan kvalitet sa ovim udelom budžeta. 2.0.1: 1,0 — „kratak" dolazi od
        manjeg obima nedelje (80%) i jednog umesto dva kvaliteta (v. DECISIONS). */
    deloadBudgetScale: 1.0,
    /** Oporavak: I = isto vreme lagano; R = ista distanca lagano; RP = pola vremena; T = 60 s. */
    recovery: { iTimeRatio: 1.0, rDistanceRatio: 1.0, rpTimeRatio: 0.5, tCruiseSec: 60 },
    /** Ubrzanja na laganom danu u bazi/taperu: broj × trajanje, oporavak u s. Ne ulaze u R udeo. */
    strides: { reps: 4, sec: 20, recoverySec: 60 },
    /** Trkačka nedelja: kratko oštrenje RP-om (opcije u repOptionsKm.RPsharpener). */
    raceWeekSharpener: { maxReps: 4, minReps: 2 }
  },

  long: {
    /** Dugi trk ≤ 30% nedelje i ≤ 90 min (računato sporijom granicom E tempa), lagano (heuristika). */
    maxShare: 0.3,
    maxSec: 5400
  },

  easy: {
    /** Najkraći smislen lagan trk [km] (heuristika ≈ 20 min). */
    minKm: 3.0,
    /** 2.0.1: u taperu i trkačkoj nedelji važi niži minimum (≈ 15 min) da se zadrži učestalost
        trčanja dok obim pada (heuristika; v. DECISIONS). */
    taperMinKm: 2.0
  },

  warmup: {
    /** Zagrevanje/hlađenje [km] po ciljnom km nedelje (heuristika). Zadatak: 2–3 / 1,5–2 km.
        2.0.1: ispod 25 km nedeljno 1,5 / 1,0 km, inače nedelja od 15–24 km nema mesta za lagan
        trk (v. DECISIONS). Trka uvek koristi `race`. */
    bands: [
      { fromWeekKm: 0, warmupKm: 1.5, cooldownKm: 1.0 },
      { fromWeekKm: 25, warmupKm: 2.0, cooldownKm: 1.5 },
      { fromWeekKm: 35, warmupKm: 2.5, cooldownKm: 1.5 },
      { fromWeekKm: 45, warmupKm: 3.0, cooldownKm: 2.0 }
    ],
    race: { warmupKm: 2.0, cooldownKm: 1.5 }
  },

  schedule: {
    /** Redosled preferencije dana za dugi trk (heuristika: vikend). */
    longDayPreference: ['sun', 'sat', 'fri', 'thu', 'wed', 'tue', 'mon'] as readonly Weekday[],
    /** Najmanji razmak (u danima) između zahtevnih dana, ciklično kroz nedelje: 2 = nisu uzastopni. */
    minHardGapDays: 2,
    /** Oštrenje u trkačkoj nedelji: poželjno ≥ 3 dana pre trke, najmanje 2. */
    sharpenerPreferredGapDays: 3,
    sharpenerMinGapDays: 2
  },

  /** Tolerancija aritmetike (km) i planirano/ciljno (udeo). */
  tolerance: { arithmeticKm: 0.011, plannedVsTarget: 0.05 }
} as const;

export type FiveKV2Policy = typeof FIVE_K_V2_POLICY;

/** Dnevnik odluka: svaka promena pravila posle pregleda primera. */
export const DECISIONS: readonly { version: string; decision: string }[] = [
  { version: '5k-v2.0.0', decision: 'Početna pravila iz zadatka Segment 01.' },
  {
    version: '5k-v2.0.1',
    decision:
      'Pregled 13 primera pod 2.0.0: 7 od 10 podržanih profila odbijeno. (1) Rasterećenje sa 60% ' +
      'budžeta nije moglo da sastavi ni minimalan kvalitet do ~35 km → deloadBudgetScale 1,0 ' +
      '(nedelja ionako ima 80% obima i jedan kvalitet). (2) Ispod ~25 km zagrevanje 2 + hlađenje ' +
      '1,5 km na dva kvalitetna dana ostavlja < 3 km za lagan trk → za nedelje < 25 km 1,5 / 1,0 km. ' +
      '(3) Budžeti 5–8% pri 15–20 km ne primaju 4×200 R ni 2×800 I → dodate kraće opcije ' +
      '(R 150 m, I 600/500 m uz I ≥ 2 min, RP 400 m, oštrenje 200–400 m); bira se prva (najduža) opcija ' +
      'koja popuni ≥ 70% budžeta, da se kraće ne biraju kad duže staju. (4) T cruise traži ≥ 2×1 km; ' +
      'kad T budžet to ne prima, drugi kvalitet vrhunca je kontinuirani T. (5) Lagan trk izlazi ' +
      '31–37% nedelje (duži od dugog) pri SVIM obimima: kvalitetni dani primaju 35–40%, dugi ≤ 30%, ' +
      'pa ostatak mora u jedan lagan dan. Probano „lagan ≤ 30%" kao greška → odbijeno 10/10 ' +
      'profila, pa je vraćeno: lagan > dugi je UPOZORENJE (EASY_LONGER_THAN_LONG), a cilj nedelje ' +
      'za 4 dana ograničen na 50 km da lagan trk ne raste preko ~17 km. Otvoreno za trenera. ' +
      '(6) 15 km/8 ned je i dalje padao: rasteretni I budžet 1,1 km ne prima 2×600 → I opcija ' +
      '500 m (koristi se samo kad traje ≥ 2 min, tj. kod sporijih); taper 2 (12 km) ostavljao je ' +
      '2,6 km po laganom trku → u taperu i trkačkoj nedelji minimum laganog trka 2 km (zadržava ' +
      'učestalost dok obim pada).'
  }
];
