/* 5K v2 — pravila (specifikacija u kodu).

   Svaki prag ovde je TRENERSKA HEURISTIKA, ne dokazana fiziološka granica. Brojevi su izabrani
   da budu konzervativni i proverljivi; promena praga = nova verzija (`version`) i zapis u
   `DECISIONS` na dnu fajla. Jednačine Daniels–Gilbert (paces.ts) su objavljeni model, ali i
   one su model, ne merenje konkretnog trkača. */

import type { Weekday } from './types.ts';

export const FIVE_K_V2_POLICY = {
  /** Identitet politike (Uslov 6: plan nosi policyId/policyVersion). */
  id: '5k-v2',
  version: '5k-v2.2.0',

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
    sharpenWeeksShort: 1,
    /** 2.1.0: vrhunac (I) najviše 4 nedelje, višak ide u bazu (heuristika). Sa rasterećenjem na svakoj
        4. nedelji to su ≤ 3 ne-rasteretne nedelje, pa strogi rast I doze (v. DECISIONS) ostaje izvodljiv
        i kad je budžet ravan (obim na vrhu). */
    peakMaxWeeks: 4
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
        nedelje, pa ostatak ide u dugi i jedan lagan trk. 2.1.0: zadržano (vrh se ne podiže).
        2.2.0: drugi član funkcije peakKm() (volume.ts); kapacitet 4 dana je posebno ograničenje. */
    fourDayMaxWeekKm: 50,
    /** 2.2.0: kapacitet 4 dana (volume.ts) računa kvalitetne dane donjom granicom: zagrevanje +
        hlađenje + ovaj udeo cilja (rad + oporavak oba kvaliteta zajedno). Heuristika; u mreži od 240
        ulaza pod 2.1.0 najmanji izmereni udeo je 11,8%. Ako stvarni kvalitet ipak bude manji, ostaje
        zaštita „lagan = dugi" (PLANNED_BELOW_TARGET). */
    capacityQualityMinShare: 0.1,
    /** Dozvoljeno odstupanje faktora pri proveri (zaokruživanje na 0,1 km). */
    factorTolerance: 0.03
  },

  quality: {
    /** I (uključujući RP) ≤ 8% nedeljnog obima; ponavljanje ≤ 5 min (Daniels-ova heuristika). */
    iMaxShare: 0.08,
    iRepMaxSec: 300,
    /** T ≤ 10% nedeljnog obima (heuristika). */
    tMaxShare: 0.1,
    /** 2.2.0 (Uslov 2): JEDAN plafon T bloka (kontinuirano ili cruise ponavljanje) po fazi [s]
        (heuristika): baza 15 min, vrhunac 20 min, oštrenje 15 min, taper 10 min. Trkačka nedelja nema T. */
    tContinuousMaxSec: { base: 900, peak: 1200, sharpen: 900, taper: 600 },
    /** 2.2.0: rast kontinuiranog T u bazi po ne-rasteretnoj nedelji [km] (heuristika). */
    tStepKm: 0.5,
    /** 2.2.0: ista nedeljna doza baze (R km, T km, oblik T) najviše ovoliko ne-rasteretnih nedelja
        zaredom, pa promena strukture T (kontinuirano ↔ cruise) (heuristika). */
    baseSameDoseMaxWeeks: 2,
    /** R ≤ 5% nedeljnog obima; ponavljanje ≤ 2 min (heuristika). */
    rMaxShare: 0.05,
    rRepMaxSec: 120,
    /** Glavni kvalitet ne-rasteretne nedelje vrhunca (I) i oštrenja (RP) ≥ 70% svog budžeta
        (heuristika). 2.1.0: isti donji prag važi za progresiju doze (v. DECISIONS). */
    mainMinShareOfBudget: 0.7,
    /** Ponuda dužina ponavljanja [km] po tipu, od poželjnije ka manje poželjnoj (heuristika).
        Bira se PRVA opcija čiji ukupni rad dostiže `repFillShare` budžeta; ako nijedna, ona sa
        najvećim ukupnim radom. 2.0.1: dodate kraće opcije za nizak obim (v. DECISIONS). */
    repOptionsKm: {
      R: [0.4, 0.3, 0.2, 0.15],
      Rsharpen: [0.3, 0.2],
      I: [1.2, 1.0, 0.8, 0.7, 0.6, 0.5, 0.4],
      RP: [1.0, 0.8, 0.6, 0.5, 0.4],
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
    /** Kratak T: kontinuirani blok = min(udeo T budžeta, plafon T faze), zaokruženo naniže na 0,5 km.
        2.2.0: plafon je tContinuousMaxSec[faza] (ukinut dvojnik shortTMaxSec). */
    shortTShareOfBudget: 0.7,
    shortTMinKm: 1.0,
    /** Rasteretna nedelja: jedan kvalitet sa ovim udelom budžeta. 2.0.1: 1,0 — „kratak" dolazi od
        manjeg obima nedelje (80%) i jednog umesto dva kvaliteta (v. DECISIONS). */
    deloadBudgetScale: 1.0,
    /** Oporavak: I = isto vreme lagano; R = ista distanca lagano; RP = pola vremena; T = 60 s.
        2.1.0: oporavak zadat vremenom zaokružuje se na `roundSec` (prikaz i obračun isti). */
    recovery: {
      iTimeRatio: 1.0,
      rDistanceRatio: 1.0,
      rpTimeRatio: 0.5,
      tCruiseSec: 60,
      roundSec: 15
    },
    /** Ubrzanja na laganom danu u bazi/taperu: broj × trajanje, oporavak u s. Ne ulaze u R udeo. */
    strides: { reps: 4, sec: 20, recoverySec: 60 },
    /** Trkačka nedelja: kratko oštrenje RP-om (opcije u repOptionsKm.RPsharpener). */
    raceWeekSharpener: { maxReps: 4, minReps: 2 }
  },

  long: {
    /** Dugi trk ≤ 35% ciljnog km nedelje i ≤ 90 min (računato sporijom granicom E tempa), lagano
        (heuristika). 2.1.0: 30% → 35% za 4 dana; lagan trk nikad duži od dugog (v. DECISIONS). */
    maxShare: 0.35,
    maxSec: 5400
  },

  easy: {
    /** Najkraći smislen lagan trk [km] (heuristika ≈ 20 min). */
    minKm: 3.0,
    /** 2.0.1: u taperu i trkačkoj nedelji važi niži minimum (≈ 15 min) da se zadrži učestalost
        trčanja dok obim pada (heuristika; v. DECISIONS). */
    taperMinKm: 2.0,
    /** 2.1.0: dan pred trku lagan ≤ 4 km (ukupno, sa ubrzanjima) + 4 × 20 s ubrzanja (heuristika). */
    raceEveMaxKm: 4.0,
    /** 2.2.0: lagan dan trkačke nedelje ≤ 50 min (sporijom granicom E) i ≤ 50% dugog iz prethodne
        nedelje; ostatak cilja se ne raspoređuje (heuristika). */
    raceWeekMaxSec: 3000,
    raceWeekMaxShareOfPrevLong: 0.5
  },

  week: {
    /** 2.1.0 (Uslov 8): najmanji smislen obim nedelje [km]; trening nedelja ≈ 4 trka × 2,5 km,
        trkačka nedelja bez same trke ≈ 2 kratka trka (heuristika). Ispod toga plan je degenerisan. */
    minTrainingKm: 10,
    minRaceWeekKm: 4
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
    /** Oštrenje u trkačkoj nedelji: najmanje 3 dana pre trke (2.1.0: dva dana pred trku bez
        kvaliteta); od dozvoljenih bira se najbliži trci. */
    sharpenerMinGapDays: 3
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
  },
  {
    version: '5k-v2.1.0',
    decision:
      'Segment 02, trenerske ispravke 4-dnevnog jezgra (opseg ulaza nepromenjen). ' +
      '(1) Dugi ≥ svaki lagan trk u nedelji je TVRDO pravilo (EASY_LONGER_THAN_LONG = greška). Dugi ≤ 35% ' +
      'ciljnog km i ≤ 90 min. Ako je i tada ostatak po laganom danu > dugi, lagan = dugi i planirani km = ' +
      'kvalitet + dugi + n × dugi; razlika do cilja ostaje kao targetKm naspram plannedKm uz napomenu i ' +
      'upozorenje PLANNED_BELOW_TARGET. Vrh obima se ne podiže. Odluku donosi samo generate.ts, u jednom ' +
      'prolazu. (2) Progresija doze: svaka sledeća ne-rasteretna nedelja vrhunca ima strogo veći glavni I ' +
      'rad (više ili duža ponavljanja), u okviru I ≤ 8% i ≥ 70% budžeta; isto za RP u oštrenju. Izbor = ' +
      'najmanji rad iz ponude veći od prethodne nedelje iste faze (jedno nabrajanje, bez petlje). Baza ' +
      'koristi isti izbor za R; kad R ponuda nema veći nivo, bira se najveći rad drugačije strukture. Dve ' +
      'uzastopne ne-rasteretne nedelje izgradnje ne smeju imati identičan par kvaliteta (QUALITY_REPEAT). ' +
      '(3) Dan pred trku: lagan ≤ 4 km ukupno, sa 4 × 20 s ubrzanja; oštrenje ≥ 3 dana pre trke. ' +
      '(4) Oporavak zadat vremenom zaokružen na 15 s (prikaz i obračun isti; R oporavak ostaje distanca). ' +
      '(5) Uslov 8: nedelja ispod minimalnog obima ili prazan trening je greška. (6) policyId u planu. ' +
      'Posle pregleda primera i mreže 240 ulaza: (7) dugi = min(35%, 90 min, cilj − kvalitet − n × min. ' +
      'lagan), inače 15 km/8 ned ostaje bez 3 km za lagan; (8) udeli I/T/R mere se od ciljnog km (isti ' +
      'osnov kao budžeti), jer bi u nedeljama „lagan = dugi" planirano < cilj lažno probijalo udeo; ' +
      '(9) ponuda I + 700 m i 400 m (uz I ≥ 2 min), RP + 500 m — bez toga ravni budžet nema dovoljno ' +
      'nivoa za strogi rast; (10) vrhunac najviše 4 nedelje (višak u bazu): sa 5 nedelja vrhunca (16 ned) ' +
      'trebala su 4 rastuća nivoa I, pa je 15 km/16 ned odbijan za svaki VDOT; (11) baza R: nova ' +
      'struktura, doza ne pada, prednost dužem ponavljanju (strogi rast je davao 9 × 150 m); (12) trkačka ' +
      'nedelja: ostatak se deli jednako, dan pred trku ≤ 4 km, bez odbacivanja dana zbog istrčavanja.'
  },
  {
    version: '5k-v2.2.0',
    decision:
      'Segment 03, preostale trenerske odluke 4-dnevnog jezgra (opseg ulaza nepromenjen). ' +
      '(1) Pošten cilj obima: volume.ts računa kapacitet 4 dana iz tempa (q1 + q2 donjom granicom ' +
      '2 × zagrevanje/hlađenje + 10% cilja, dugi ≤ 35% i ≤ 90 min, lagan ≤ dugi) i ograničava SVAKI cilj ' +
      'na ulazu; start = min(trenutni obim, kapacitet), uz napomenu i upozorenje START_ABOVE_CAPACITY ' +
      '(„5 dana će biti podržano kasnije"). „Lagan = dugi" ostaje samo zaštita. Treći član dugog ' +
      '(prostor za min. lagan) zaokružen na 0,1 km, inače mala rasteretna nedelja daje lagan > dugi. ' +
      '(2) Rasterećenje se ne poklapa sa prvom nedeljom vrhunca/oštrenja: pomera se na poslednju nedelju ' +
      'prethodne faze; izostavlja se ako bi pala u poslednju nedelju izgradnje (periodize.ts). ' +
      '(3) Baza bez platoa: R raste do budžeta (duže ili isto ponavljanje) ili se drži; T kontinuirano ' +
      '+0,5 km/ned do min(T budžet, 15 min), na limitu prelazi u cruise (T obim raste ponavljanjima); ista ' +
      'doza (R km, oblik T, T km) najviše 2 ne-rasteretne nedelje zaredom, pa promena strukture T; ' +
      'validator BASE_PLATEAU. (4) Jedan T plafon po fazi (baza 900, vrhunac 1200, oštrenje 900, ' +
      'taper 600 s); ukinut shortTMaxSec. Vrh obima: jedna funkcija peakKm() = min(1,3 × start, 50); ' +
      'kapacitet je posebno ograničenje svakog cilja, nezavisno od 50 km. (5) Rasteretna nedelja: kad ' +
      'glavni kvalitet ne staje, zamena kratkim T, pa R, uz ubrzanja (workouts.ts, weekQuality — jedino ' +
      'mesto odluke o dozi). Vrhunac: I neopadajući; bez višeg nivoa I se drži, a T menja strukturu ' +
      '(cruise ↔ kontinuirano, inače ±0,5 km). (6) Trkačka nedelja: lagan dan ≤ 50 min i ≤ 50% dugog ' +
      'prethodne nedelje; ostatak se ne raspoređuje (planirano < cilj samo tu, uz napomenu). ' +
      'Posle pregleda primera: T u bazi na limitu odmah prelazi u cruise (ne čeka treću istu nedelju), a R ' +
      'se drži iste strukture dok T napreduje — inače je spor profil sa 45 km dobijao R 10 × 150 m.'
  }
];
