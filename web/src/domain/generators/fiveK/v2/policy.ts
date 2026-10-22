/* 5K v2 — pravila (specifikacija u kodu).

   Svaki prag ovde je TRENERSKA HEURISTIKA, ne dokazana fiziološka granica. Brojevi su izabrani
   da budu konzervativni i proverljivi; promena praga = nova verzija (`version`) i zapis u
   `DECISIONS` na dnu fajla. Jednačine Daniels–Gilbert (paces.ts) su objavljeni model, ali i
   one su model, ne merenje konkretnog trkača. */

import type { Effort, Weekday } from './types.ts';

export const FIVE_K_V2_POLICY = {
  /** Identitet politike (Uslov 6: plan nosi policyId/policyVersion). */
  id: '5k-v2',
  version: '5k-v2.10.3',

  /** 2.3.0: JEDNA tabela po broju dana trčanja (heuristike opsega i šablona, ne dokazana pravila).
      - weeklyKm: trenutni nedeljni obim [km]; van opsega → odbijanje;
      - qualityDays / easyDays: šablon nedelje (+ jedan dugi);
      - longMaxShare: dugi ≤ ovaj udeo ciljnog km nedelje (i ≤ long.maxSec), naniže na longStepKm
        (2.4.1: 0,1 km za sve brojeve dana; 3 dana 45% — heuristika: oba nekvalitetna trčanja su
        bliske dužine, pa dugi ≤ 45% i lagan ≤ dugi traže kvalitet ≥ 10% nedelje, ne ≥ 20%);
      - maxWeekKm: apsolutni vrh obima (član peakKm());
      - minWeekKm: Uslov 8, najmanji smislen obim nedelje treninga (≈ broj dana × 2,5 km). */
  days: {
    3: {
      /* 2.4.0: min 12 (bilo 10): ispod 12 km 3 dana nema prostora za kvalitet (Segment 04, problem 2). */
      weeklyKm: { min: 12, max: 35 },
      qualityDays: 1,
      easyDays: 1,
      longMaxShare: 0.45,
      longStepKm: 0.1,
      maxWeekKm: 40,
      minWeekKm: 7.5
    },
    4: {
      weeklyKm: { min: 15, max: 45 },
      qualityDays: 2,
      easyDays: 1,
      longMaxShare: 0.35,
      longStepKm: 0.1,
      maxWeekKm: 50,
      minWeekKm: 10
    },
    5: {
      weeklyKm: { min: 25, max: 65 },
      qualityDays: 2,
      easyDays: 2,
      longMaxShare: 0.3,
      longStepKm: 0.1,
      maxWeekKm: 65,
      minWeekKm: 12.5
    }
  },

  input: {
    /** Rezultat stariji od ovoga ne opisuje trenutnu formu dovoljno pouzdano (heuristika). 2.4.0: star
        rezultat nije odbijanje — plan je po osećaju, a rezultat se samo prikazuje. */
    resultMaxAgeDays: 84,
    /** 2.4.0: uobičajen lagan tempo korisnika [s/km] za plan bez pouzdanog rezultata (4:30–8:30). */
    easyPaceSecPerKm: { min: 270, max: 510 },
    /** 2.4.0: poruka kad je obim ispod donje granice 3 dana. */
    lowVolume3DaysMessage:
      'ispod 12 km na 3 dana nema prostora za kvalitet; počni laganim trčanjem ili izaberi 4 dana',
    /** Distance rezultata iz kojih se računa VDOT. */
    resultDistancesM: [3000, 5000, 10000] as const,
    /** Opseg VDOT-a za koji v2 pravi plan (heuristika opsega; van toga pravila nisu proverena). */
    vdot: { min: 30, max: 60 },
    /** Trajanje plana u celim nedeljama (heuristika opsega). 2.3.0: od 6 (kratka priprema). */
    planWeeks: { min: 6, max: 16 },
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
    peakMaxWeeks: 4,
    /** 2.3.0: kratka priprema (6–7 nedelja): fiksna raspodela, bez rasterećenja, jedna nedelja tapera
        (taperStep 1). Od 8 nedelja važi phaseCounts() kao ranije (heuristika). */
    short: {
      6: { base: 2, peak: 2, sharpen: 0, taper: 1, race: 1 },
      7: { base: 2, peak: 2, sharpen: 1, taper: 1, race: 1 }
    } as Readonly<
      Record<number, { base: number; peak: number; sharpen: number; taper: number; race: number }>
    >,
    /** Napomena plana kratke pripreme. */
    shortNote: 'Kratka priprema: malo vremena za izgradnju; cilj prikazati kao orijentir.'
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
    /** Trkačka nedelja: GORNJA GRANICA = udeo vrha, BEZ same trke (heuristika). 2.3.0: cilj trkačke
        nedelje = zbir planiranih dana (≤ ove granice). */
    raceWeekFactor: 0.5,
    /** 2.2.0: kapacitet (volume.ts) računa kvalitetne dane donjom granicom: zagrevanje +
        hlađenje + ovaj udeo cilja (rad + oporavak svih kvaliteta zajedno). Heuristika; u mreži od 240
        ulaza pod 2.1.0 najmanji izmereni udeo je 11,8%. Ako stvarni kvalitet ipak bude manji, ostaje
        zaštita „lagan = dugi" (PLANNED_BELOW_TARGET). 2.3.0: ista formula za 3/4/5 dana (days). */
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
    /** 2.3.0 (Odluka 5): zamena u rasterećenju — R samo ako je rad ≥ minRKm (≈ 6 × 200 m); ako ni
        to ni kratak T (≥ shortTMinKm) ne staje, kvalitet nedelje su samo ubrzanja `stridesOnly` na
        laganom danu (heuristika). */
    deloadSubstitute: { minRKm: 1.2, stridesOnly: { reps: 6, sec: 20, recoverySec: 60 } },
    /** 2.4.0 (Odluka 3): ista doza druge strukture bez druge ponude ponavljanja — kraći oporavak I/RP:
        udeo vremena ponavljanja − step, ne ispod minRatio (heuristika gustine). */
    denser: { step: 0.25, minRatio: { I: 0.5, RP: 0.25 } },
    /** Trkačka nedelja: kratko oštrenje RP-om (opcije u repOptionsKm.RPsharpener). */
    raceWeekSharpener: { maxReps: 4, minReps: 2 }
  },

  /** 2.4.0: plan po osećaju (bez pouzdanog rezultata). Trajanja, broj ponavljanja i RPE su
      HEURISTIKE. Km kvaliteta su procena: vreme × E tempo (sredina opsega = korisnikov lagan tempo).
      Budžeti su isti udeli kao sa rezultatom; donji prag 70% ne važi (nema tempa). */
  feel: {
    /** E = korisnikov lagan tempo ± ovoliko sekundi. */
    easySpreadSec: 15,
    /** Kratki usponi (R budžet): ponavljanje 30–45 s, oporavak lagano nazad 2 × vreme uspona. */
    hills: { boutsSec: [45, 30], minReps: 4, maxReps: 12, recoveryRatio: 2 },
    /** Fartlek 1–2 min „brzo ali kontrolisano" (vrhunac: I budžet; početnik: T budžet). */
    fartlek: { boutsSec: [120, 90, 60], minReps: 3, maxReps: 10, recoveryRatio: 1 },
    /** RP-ekvivalent po osećaju (oštrenje, taper, trkačka nedelja): kratko, oporavak pola vremena. */
    fartlekRP: { boutsSec: [120, 90, 60, 45, 30], minReps: 3, maxReps: 10, recoveryRatio: 0.5 },
    /** Tempo po osećaju (T budžet): kontinuirano 10 min do plafona T faze (tContinuousMaxSec), korak
        1 min; ili 2–3 × 5–10 min (korak 30 s) sa 60 s lagano. */
    tempo: {
      minSec: 600,
      stepSec: 60,
      splitReps: [2, 3],
      splitMinSec: 300,
      splitMaxSec: 600,
      splitStepSec: 30,
      recoverySec: 60
    },
    /** Kontrolno trčanje: 3 km maksimalno ravnomerno u 3. nedelji, ili 4. ako je 3. rasteretna. */
    test: { km: 3, weeks: [3, 4] as const },
    effort: {
      strides: { rpeMin: 8, rpeMax: 8, cue: 'brzo i opušteno, ne sprint' },
      hills: { rpeMin: 8, rpeMax: 8, cue: 'snažno uzbrdo, kontrolisano; nazad lagano' },
      fartlek: { rpeMin: 7, rpeMax: 8, cue: 'brzo ali kontrolisano' },
      fartlekBeginner: { rpeMin: 6, rpeMax: 7, cue: 'brzo ali kontrolisano, bez naprezanja' },
      fartlekRP: { rpeMin: 8, rpeMax: 8, cue: 'osećaj trkačkog napora za 5K' },
      tempo: { rpeMin: 6, rpeMax: 7, cue: 'može da se priča u kratkim rečenicama' },
      test: { rpeMin: 9, rpeMax: 10, cue: 'maksimalno ravnomerno' },
      race: { rpeMin: 9, rpeMax: 10, cue: 'trka' }
    } satisfies Record<string, Effort>,
    note:
      'Plan po osećaju: nema pouzdanog rezultata, pa E dolazi iz tvog uobičajenog laganog tempa (±15 s), ' +
      'a kvalitet je zadat trajanjem i naporom (RPE), bez brojčanog tempa. Km kvaliteta su procena iz E tempa.',
    testNote:
      'Kontrolno trčanje 3 km u nedelji {week}: plan i dalje ostaje po osećaju do kraja; tempo iz testa ' +
      'ulazi tek kroz adaptaciju (segment 06).',
    forecastNote: 'Prognoza 5K: nedovoljno podataka (nema pouzdanog rezultata).',
    oldResultNote:
      'Rezultat {result} ({date}) je stariji od 12 nedelja: prikazan samo kao informacija, ne koristi se za tempo ni prognozu.'
  },

  /** 2.4.0: početnik (trči redovno < 6 meseci, mora 30 min kontinuirano). Heuristike konzervativnog
      početka, ne dokazana pravila. */
  beginner: {
    maxRunDays: 4,
    qualityDays: 1,
    /** Nedelje 1–2 bez kvaliteta: samo lagano + ubrzanja. */
    introWeeks: 2,
    maxBuildGrowth: 0.05,
    peakCapFactor: 1.2,
    /** Dugi ≤ 60 min (sporijom granicom E). */
    longMaxSec: 3600,
    deloadEvery: 3,
    /** Oštrenje/taper sa rezultatom: RP kratko (VDOT RP tempo). */
    rpShort: { optionsKm: [0.4, 0.3, 0.2], minReps: 2, maxReps: 6 },
    goalMessage:
      'Cilj je orijentir: kod početnika napredak je teško predvideti; tempo treninga ne zavisi od cilja.'
  },

  long: {
    /** Dugi trk ≤ days[n].longMaxShare ciljnog km nedelje i ≤ 90 min (računato sporijom granicom E
        tempa), lagano (heuristika). 2.1.0: 35% za 4 dana; 2.3.0: udeo je u tabeli `days`. */
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
    /** 2.1.0 (Uslov 8): trkačka nedelja bez same trke ≈ 2 kratka trka (heuristika). Minimum nedelje
        treninga je days[n].minWeekKm (2.3.0). Ispod toga plan je degenerisan. */
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

  /** 2.5.0: adaptacija (assess.ts). Svi pragovi su TRENERSKE HEURISTIKE (v. DECISIONS 5k-v2.5.0). */
  adapt: {
    /** Odluka 1: rezultat (test ili trka) ne stariji od ovoga [dana] menja VDOT od sledeće nedelje. */
    resultMaxAgeDays: 84,
    /** Odluka 2: izvršenje poslednjih windowDays < underShare planiranog → sledeća nedelja ne raste:
        cilj = max(izvršeno, underFloorShare × planirano za tu nedelju). */
    windowDays: 7,
    underShare: 0.6,
    underFloorShare: 0.8,
    /** Odluka 3: pauza [dana bez trčanja do asOf] → udeo obima pre pauze (7 dana pre pauze). */
    pause: {
      shortDays: 7,
      midDays: 14,
      longDays: 28,
      shortShare: 0.8,
      midShare: 0.7,
      longShare: 0.5
    },
    /** Odluka 3: nov start i < ovoliko nedelja do trke → cilj „orijentir". */
    restartFullPrepWeeks: 6,
    /** Odluka 4: bol ≥ painMin u poslednjih painLookbackDays dana → painDays dana bez kvaliteta, dugi ≤
        painLongMaxSec, lagani × painEasyFactor; bol ≥ painRestMin → najpre restDays dana odmora. */
    painMin: 4,
    painRestMin: 7,
    painLookbackDays: 3,
    painDays: 7,
    restDays: 3,
    painLongMaxSec: 3600,
    painEasyFactor: 0.7,
    /** Odluka 5: ≥ fatigueCount laganih treninga u poslednjih windowDays sa RPE ≥ fatigueRpe. */
    fatigueRpe: 7,
    fatigueCount: 2,
    /** Odluka 6: izvršeno > overShare planiranog u 2 uzastopna prozora od windowDays → bez rasta. */
    overShare: 1.15,
    /** 2.6.0 (Odluka 1): povratni rast posle smanjenja (pauza, bol, manjak izvršenja) do nivoa pre
        smanjenja, u svim fazama osim tapera i trkačke nedelje (volume.adaptVolume). */
    returnGrowth: 0.1,
    orientationMessage:
      'Cilj je orijentir: posle duge pauze ostaje manje od 6 nedelja do trke, priprema nije potpuna.',
    painMessage:
      'Bol: nedelju dana bez kvaliteta, dugi ≤ 60 min, lagani kraći. Ako bol traje ili se pojačava, potraži stručni pregled.'
  },

  /** 2.6.0: plan trčanje/hodanje (canRun30Min = false; runWalk.ts, runWalkAssess.ts). Lestvica i pragovi
      su TRENERSKE HEURISTIKE (uobičajen obrazac postepenih „trčanje/hodanje" programa), ne merenje:
      - trajanje jednog trčanja raste ~1,5–2× po koraku (1 → 1,5 → 2 → 3 → 4 → 5 → 8 → 10 → 15 min),
        hod se skraćuje 2:00 → 1:30 → 1:00; od L10 kontinuirano 20 → 25 → 30 min;
      - aktivni deo (reps × trčanje + (reps − 1) × hod) 20–35 min, uz 5 min hoda pre i posle;
      - bez kvaliteta i bez tempa: napor RPE 3–4 („razgovorno"). */
  runWalk: {
    days: 3,
    levels: [
      { level: 1, runSec: 60, walkSec: 120, reps: 8 },
      { level: 2, runSec: 90, walkSec: 120, reps: 7 },
      { level: 3, runSec: 120, walkSec: 120, reps: 6 },
      { level: 4, runSec: 180, walkSec: 120, reps: 5 },
      { level: 5, runSec: 240, walkSec: 120, reps: 5 },
      { level: 6, runSec: 300, walkSec: 90, reps: 4 },
      { level: 7, runSec: 480, walkSec: 90, reps: 3 },
      { level: 8, runSec: 600, walkSec: 90, reps: 3 },
      { level: 9, runSec: 900, walkSec: 60, reps: 2 },
      { level: 10, runSec: 1200, walkSec: 0, reps: 1 },
      { level: 11, runSec: 1500, walkSec: 0, reps: 1 },
      { level: 12, runSec: 1800, walkSec: 0, reps: 1 }
    ],
    warmupWalkSec: 300,
    cooldownWalkSec: 300,
    activeSec: { min: 1200, max: 2100 },
    effort: { rpeMin: 3, rpeMax: 4, cue: 'razgovorno — možeš da pričaš u punim rečenicama' },
    /** Projekcija (Odluka 5): +1 nivo na svakih `sessionsPerLevel` odrađenih sesija. */
    sessionsPerLevel: 2,
    /** Odluka 6: sesija „dobra" ako je završena, RPE ≤ goodRpeMax i bol < adapt.painMin; RPE ≥ holdRpe →
        isti nivo; bol ≥ adapt.painMin ili pauza adapt.pause.shortDays–midDays − 1 → −1; ≥ midDays → −2. */
    goodRpeMax: 6,
    holdRpe: 7,
    /** Odluka 7: trkačka nedelja — 2 sesije (nivo − 1), pa trka; odnos trke za kontinuiran nivo < L12:
        trčanje = trajanje nivoa, hod = raceWalkSec (najkraći hod lestvice). */
    raceWeekSessions: 2,
    raceWalkSec: 60,
    raceKm: 5,
    /** Odluka 8: prelaz na kontinuirani plan početnika kad adaptacija dostigne L12 i ostaje ≥ ovoliko
        nedelja do trke (= najkraći plan generatora). */
    transitionMinWeeks: 6,
    note:
      'Plan trčanje/hodanje: vremenski, bez tempa i bez kvaliteta; napor RPE 3–4 (razgovorno). Svaka ' +
      'sesija: 5 min hoda, aktivni deo nivoa, 5 min hoda.',
    projectionNote:
      'Nivoi su projekcija: +1 nivo na svake 2 odrađene sesije. Adaptacija ih ispravlja prema stvarnim ' +
      'sesijama (RPE, bol, pauze).',
    kmNote: 'Km su procena trčanja iz uobičajenog laganog tempa; hod se ne procenjuje.',
    noKmNote: 'Bez uobičajenog laganog tempa km se ne procenjuju (plan je vremenski).',
    goalMessage: 'Cilj: završiti trku (bez ciljnog vremena).',
    resultNote:
      'Rezultat {result} ({date}) je samo informacija: plan trčanje/hodanje ne koristi tempo.',
    painMessage: 'Bol: nivo −1. Ako bol traje ili se pojačava, potraži stručni pregled.',
    transitionNote:
      'Od nedelje {week}: kontinuirani plan početnika (po osećaju), isti konstruktor kao generator.'
  },

  /** Tolerancija aritmetike (km) i planirano/ciljno (udeo). */
  tolerance: { arithmeticKm: 0.011, plannedVsTarget: 0.05 }
} as const;

export type FiveKV2Policy = typeof FIVE_K_V2_POLICY;

/** 2.3.0: podržan broj dana trčanja. */
export type RunDaysCount = keyof typeof FIVE_K_V2_POLICY.days;
export const isRunDaysCount = (n: number): n is RunDaysCount => n in FIVE_K_V2_POLICY.days;
/** Red tabele `days` za broj dana trčanja (jedino mesto grananja po broju dana). */
export const daysRule = (n: RunDaysCount): (typeof FIVE_K_V2_POLICY.days)[RunDaysCount] =>
  FIVE_K_V2_POLICY.days[n];

/** 2.4.0: ko trči — broj dana, početnik, plan po osećaju (bez pouzdanog rezultata). */
export interface Athlete {
  days: RunDaysCount;
  beginner: boolean;
  feel: boolean;
}

/** 2.4.0: broj dana (stari potpis, 2.3.0) → iskusan trkač sa rezultatom. */
export const asAthlete = (a: Athlete | RunDaysCount): Athlete =>
  typeof a === 'number' ? { days: a, beginner: false, feel: false } : a;

/** 2.4.0: pravila za trkača (jedino mesto grananja po početniku): red tabele `days` + početnik. */
export function rulesOf(a: Athlete): {
  weeklyKm: { min: number; max: number };
  qualityDays: number;
  easyDays: number;
  longMaxShare: number;
  longStepKm: number;
  longMaxSec: number;
  maxWeekKm: number;
  minWeekKm: number;
  maxBuildGrowth: number;
  peakCapFactor: number;
  deloadEvery: number;
} {
  const d = daysRule(a.days);
  const b = FIVE_K_V2_POLICY.beginner;
  const v = FIVE_K_V2_POLICY.volume;
  const qualityDays = a.beginner ? b.qualityDays : d.qualityDays;
  return {
    weeklyKm: d.weeklyKm,
    qualityDays,
    easyDays: a.days - 1 - qualityDays,
    longMaxShare: d.longMaxShare,
    longStepKm: d.longStepKm,
    longMaxSec: a.beginner ? b.longMaxSec : FIVE_K_V2_POLICY.long.maxSec,
    maxWeekKm: d.maxWeekKm,
    minWeekKm: d.minWeekKm,
    maxBuildGrowth: a.beginner ? b.maxBuildGrowth : v.maxBuildGrowth,
    peakCapFactor: a.beginner ? b.peakCapFactor : v.peakCapFactor,
    deloadEvery: a.beginner ? b.deloadEvery : v.deloadEvery
  };
}

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
  },
  {
    version: '5k-v2.4.0',
    decision:
      'Segment 04: 3 i 5 dana, kratka priprema. Opseg: 3/4/5 dana, obim 3 d 10–35, 4 d 15–45, 5 d 25–65 km, ' +
      '6–16 nedelja. (1) Šablon po broju dana iz JEDNE tabele `days`: 3 d = 1 kvalitet + dugi + lagan sa ' +
      'ubrzanjima (baza R/T naizmenično, vrhunac I, oštrenje i taper RP), dugi ≤ 40%; 4 d kao 2.2.0; 5 d = ' +
      '2 kvaliteta + dugi + 2 lagana, dugi ≤ 30%; dugi ≤ 90 min; zahtevni dani nisu uzastopni (ciklično). ' +
      '(2) Kapacitet: ista nejednačina kao 4 d, parametrizovana brojem kvaliteta, laganih i udelom dugog; ' +
      'peakKm = min(1,3 × start, kapacitet, 40/50/65). (3) 6 ned = baza 2, vrhunac 2, taper 1, trka 1; 7 ned ' +
      '+ oštrenje 1; bez rasterećenja; jedna nedelja tapera = taper 1 (0,85 vrha); napomena plana. ' +
      '(4) Trkačka nedelja: cilj = zbir planiranih dana, 50% vrha je gornja granica i osnov budžeta. ' +
      '(5) Rasterećenje: zamena R samo ako je rad ≥ 1,2 km; inače samo ubrzanja 6 × 20 s na laganom ' +
      '(stridesOnly). (6) Baza: R km ne pada između ne-rasteretnih nedelja; bez višeg nivoa R se drži, a T ' +
      'menja strukturu. Posle mreže (odstupanja): dugi za 3 d na 0,1 km (longStepKm), jer jedini kvalitet ' +
      'je ~20% nedelje; prvi T u bazi 3 d = 1 km kad 70% budžeta ne prima minimum; RP u oštrenju ' +
      'neopadajući — bez višeg nivoa ista doza druge strukture (ranije 15 km/10 ned odbijan za sve VDOT-e); ' +
      'minimum nedelje (Uslov 8) po broju dana 7,5/10/12,5 km.'
  },
  {
    version: '5k-v2.4.0',
    decision:
      'Segment 05: 3-dnevne dopune, plan bez pouzdanog rezultata, početnik. (1) Kapacitet iz stvarne ' +
      'konstrukcije (volume.capacityKm): najveći cilj T ≤ apsolutnog vrha takav da weekQuality + ' +
      'weekLengths (iste funkcije kao generate) ni za jedan cilj ≤ T ne daju lagan > dugi dok dugi stoji ' +
      'na plafonu; probne nedelje = prva nedelja svake faze, rasterećenje, taper 1/2, smena 3 dana, uvod ' +
      'početnika, nedelja testa; korak 0,1 km. 3 dana ≈ 17 km za svaki VDOT (prva T nedelja: WU+CD 2,5 + ' +
      'T 1 km mora biti ≥ 20% nedelje). Lagani: zaokruživanje više ne gura poslednji lagan preko dugog. ' +
      '(2) 3 dana 12–35 km; ispod poruka „ispod 12 km na 3 dana nema prostora za kvalitet…". (3) I u ' +
      'vrhuncu i RP u oštrenju bez višeg nivoa: ista doza druge strukture; ako je nema, ista ponavljanja ' +
      'sa kraćim oporavkom (quality.denser); tek onda (4/5 dana) zadržan I uz promenu T. (4) Bez rezultata ' +
      'ili sa rezultatom starijim od 12 nedelja: plan po osećaju, E = typicalEasyPaceSecPerKm ± 15 s ' +
      '(obavezan, 4:30–8:30), kvalitet zadat trajanjem i RPE (usponi 30–45 s, fartlek 1–2 min, tempo ' +
      '10–20 min, RP po osećaju), km procenjeni E tempom; star rezultat samo informacija. (5) Kontrolno ' +
      'trčanje 3 km u 3. (ili 4.) ne-rasteretnoj nedelji umesto glavnog kvaliteta; plan ostaje po osećaju. ' +
      '(6) Prognoza i cilj: „nedovoljno podataka". (7) Isti udeli budžeta; 70% prag ne važi. ' +
      '(8–10) Početnik (< 6 meseci, mora 30 min kontinuirano, inače RUN_WALK_NOT_SUPPORTED_YET): ≤ 4 dana, ' +
      '1 kvalitet, nedelje 1–2 samo lagano + ubrzanja, bez I, rast ≤ 5%, dugi ≤ 60 min, vrh ≤ 1,2 × start, ' +
      'rasterećenje svake 3. nedelje, cilj najviše „orijentir". Dopune posle mreže: trkačka nedelja lagan ' +
      'dan ≥ 2 km (taperMinKm) i kad je 50% dugog manje; rasterećenje po osećaju bez mesta za kvalitet → ' +
      'samo ubrzanja; prvi izbor po osećaju = 70% najvećeg rada koji staje (ponuda je ograničena).'
  },
  {
    version: '5k-v2.5.0',
    decision:
      'Segment 05b, regresija kapaciteta (pod 2.4.0: 3 dana ≈ 17,1 km za svaki VDOT; 4 dana VDOT ≥ 45 ' +
      '41,3 km zbog rupa 41,4–44,9). (1) 3 dana: dva nekvalitetna trčanja su dugi i lagan (duže = dugi); ' +
      'ostatak posle kvaliteta: dugi ≥ lagan, dugi ≤ 45% nedelje (bilo 40%; samo 3 dana — heuristika: oba ' +
      'preostala trčanja su bliske dužine) i ≤ 90 min. Lagan ≤ dugi ostaje, ali više ne tera kvalitet na ' +
      '≥ 20% nedelje (sada ≥ 10%). (2) Rupe u izvodljivim ciljevima ne spuštaju kapacitet: capacityKm = ' +
      'najveći izvodljiv cilj (bez zatvaranja naniže); cilj nedelje u rupi → najveći izvodljiv cilj ≤ želje ' +
      '(volume.fitTargetKm, pretraga naniže 0,1 km, jedno mesto; start, izgradnja, rasterećenje, taper). ' +
      'Korak dugog 0,1 km za 3/4/5 dana. (3) Nijedan regular plan sa rezultatom nema niži vrh nego na ' +
      '7b4b574, osim gde je tamo vrh-nedelja imala lagan = dugi / planirano < cilj (test sa fixture).'
  },
  {
    version: '5k-v2.5.0',
    decision:
      'Segment 06, adaptacija (adapt.ts). Tok: assess.ts izvodi OGRANIČENJA iz činjenica (jedno mesto) → ' +
      'isti konstruktor kao generate (periodize/volume/week, generate.construct) gradi plan sa tim ' +
      'ograničenjima → spajanje (dani ≤ asOf, urađeni i zaključani dani bajt-isti) → validate. Datum trke, ' +
      'taper i trkačka nedelja ne pomeraju se. Heuristike: (1) rezultat ≤ 12 ned: VDOT od sledeće nedelje, ' +
      'po osećaju → tempo, cilj/prognoza iz novog VDOT-a; obim ne raste zbog tempa (samo kapacitet novog ' +
      'tempa). (2) izvršenje 7 dana < 60%: cilj sledeće nedelje = min(prethodni cilj izgradnje, max(izvršeno, ' +
      '80% planiranog)), dalje rast po pravilima. (3) pauza 7–13: 80% obima 7 dana pre pauze, prva nedelja 1 ' +
      'kvalitet (doza rasterećenja); 14–27: 70%, prva bez kvaliteta, druga 1 kvalitet; ≥ 28: nov start = ' +
      'min(14 dana pre pauze / 2, 50%), faze preostale izgradnje ponovo (periodize), < 6 ned → orijentir. Start ' +
      'nikad ispod donje granice ulaza za broj dana (12/15/25 km) ni iznad planiranog. Ostatak tekuće nedelje ' +
      'dobija ograničenja prve nedelje. (4) bol ≥ 4 u 3 dana: 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, ' +
      'lagani × 0,7 (ne ispod minimuma); ≥ 7: 3 dana odmora pa isto; poruka o stručnom pregledu; opsezi ' +
      'prethodnih koraka ostaju (ponovni bol produžava). (5) 2+ lagana (lagan ili dugi) sa RPE ≥ 7 u 7 dana: ' +
      'sledeća nedelja rasterećenje (ne u taperu/trci; sledeće redovno rasterećenje odmah posle se ukida). ' +
      '(6) > 115% planiranog u 2 uzastopna 7-dnevna prozora: sledeća nedelja bez rasta. (7) prioritet za obim ' +
      'sledeće nedelje: pauza > umor > izvršenje; bol se uvek primenjuje po datumima (najstroži); tempo iz ' +
      'rezultata uvek. Činjenice se smatraju potpunim od prvog zapisa do asOf.'
  },
  {
    version: '5k-v2.6.0',
    decision:
      'Segment 07, ispravke adaptacije i trčanje/hodanje (heuristike). (1) Povratni rast: posle smanjenja ' +
      '(pauza, bol, manjak izvršenja) cilj raste +10%/ned do nivoa pre smanjenja (cilj poslednje ' +
      'ne-rasteretne nedelje izgradnje završene pre događaja) u svim fazama osim tapera i trkačke nedelje — ' +
      'oštrenje ne drži dok je ispod nivoa; povratak ne usporava redovan rast (veće od dva); rasterećenje ' +
      'ostaje. Bol ne menja cilj nedelje bola (dani su ograničeni); rast posle poslednje nedelje bola kreće ' +
      'od 0,7 × njenog cilja. Jedno mesto: volume.adaptVolume / nextBuildKm. (2) Donja granica adaptiranog ' +
      'cilja = minimum nedelje 7,5/10/12,5 km; u izgradnji nedelja mora i da se sastavi bez kvaliteta (n dana ' +
      '× lagan ≥ 3 km), pa 9/12/15 km; kvalitet, kontrolno trčanje i oštrenje trkačke nedelje koji ne staju ' +
      'otpadaju (dopuna f). (3) facts.coverage {from, to, complete}: dan bez zapisa je poznat (bez trčanja) ' +
      'samo u potpunoj pokrivenosti; bez nje odluke 2, 3 i 6 se ne primenjuju; bol, umor, rezultat i ' +
      'eksplicitna pauza facts.breaks {kind: break} uvek (pauza završena u poslednjih 7 dana, posle ' +
      'prethodne adaptacije). Trčanje = završen zapis sa km ili trajanjem. (4) Trčanje/hodanje ' +
      '(canRun30Min = false, početnik ili iskusan, tačno 3 nesusedna dana, 6–16 ned, rezultat samo ' +
      'informacija): lestvica L1–L12 u runWalk.levels, aktivno 20–35 min + 5 min hoda pre i posle, RPE 3–4, ' +
      'bez kvaliteta i tempa; km samo procena trčanja (typicalEasyPaceSecPerKm) ili null. (5) Projekcija: +1 ' +
      'nivo na svake 2 sesije, nivo za svaki dan, oznaka projection. (6) Adaptacija: 2 uzastopne sesije ' +
      'završene, RPE ≤ 6, bol < 4 → +1; RPE ≥ 7 ili bez RPE → isti; bol ≥ 4 ili pauza 7–13 → −1; ≥ 14 → −2; ' +
      'ne ispod L1; ostatak projekcije od novog nivoa. (7) Trka: nivo < L12 → odnos poslednjeg nivoa ' +
      '(kontinuiran nivo: trajanje / 1:00 hoda), cilj „završiti"; poslednja nedelja 2 sesije (nivo − 1) bez ' +
      'dana pred trku. (8) L12 i ≥ 6 nedelja do trke → ostatak = generateFiveKV2 kao početnik po osećaju ' +
      '(obim 3 × 30 min tipičnim tempom; bez tempa ili < 12 km — bez prelaza).'
  },
  {
    version: '5k-v2.6.1',
    decision:
      'Segment 08d, Odluka 1 dopuna (odluka organizatora, heuristika; ista kao 10K A16; bez novog broja: 0,7 = ' +
      'adapt.painEasyFactor, +10% = adapt.returnGrowth, 0,8 = volume.deloadFactor). Povratak posle bola ne ' +
      'zavisi od dana u nedelji. (1) Sidro = nedelja r koja sadrži asOf + 1 (prvi dan odmora ili bola, = ' +
      'firstWeek koraka), ne poslednja nedelja perioda bola; cilj nedelje r ostaje, njeni dani u periodu bola ' +
      'i odmora su ograničeni kao do sada. (2) Posle nedelje r rast kreće od osnove = min(round1(0,7 × nivo ' +
      'koraka), cilj nedelje r); nivo = levelBefore prvog dana bola (pauza u istom koraku: najveći nivo ' +
      'koraka); korak bez nivoa (stariji): 0,7 × cilj nedelje r (2.6.0). (3) Od nedelje r + 1 povratni rast ' +
      '(nextBuildKm, +10% do nivoa), pa redovan; rasterećenje posle sidra = 0,8 × osnova; nedelje sa danima ' +
      'bola posle r dobijaju taj cilj, dani ostaju ograničeni. (4) Povratak samo kad je r nedelja izgradnje. ' +
      '(5) Poruka PAIN: „Posle nedelje r rast kreće od 70% nivoa pre bola (osnova km)." + napomena o ' +
      'povratku; kad min deluje: „… rast kreće od osnova km (cilj nedelje r; 70% nivoa pre bola bilo bi x ' +
      'km)." (6) Jedno mesto: volume.returnBaseKm (adaptVolume, validator, poruka); oblik koraka isti ' +
      '(returnFrom { week, share }), week = r. Obrazloženje: u 2.6.0 nedelja u koju period bola pređe dobija ' +
      'pun planirani rast, a pad dolazi nedelju kasnije; osnova zavisi i od toga da li je nedelja sidra ' +
      'rasteretna. Primeri (4 dana uto/čet/sub/ned, start 2026-10-26, trka 2027-01-24, 40 km, 5 km 21:00, cilj ' +
      '20:00; bol iz zapisa bez trčanja; cilj/planirano, 2.6.0 → 2.6.1): A asOf 2026-11-15, bol 5 na ' +
      '2026-11-14 (r = 4 rasterećenje 36,5, nivo 43,2, osnova 30,2): ned 5 28,0 → 33,2, ned 6 30,8 → 36,5; B ' +
      'isto, bol 8: ned 5 45,6/42,5 → 33,2/30,95, ned 6 35,0 → 36,5; C asOf 2026-11-18, bol 5 (nivo 45,6, ' +
      'osnova 31,9): ned 5 45,6/42,5 → 35,0/32,55, ned 6 35,0 → 38,5; D isto, bol 8: ned 5 45,6/36,3 → ' +
      '35,0/28,1, ned 6 35,0 → 38,5; E asOf 2026-11-13, bol 7 (r = 3, nivo 43,2, osnova 30,2): ned 4 ' +
      '(rasterećenje) 36,5/26,6 → 24,2/19,3 = 0,8 × osnova, ned 5 45,6 sa 2 kvaliteta → 33,2, ned 6 35,0 → ' +
      '36,5. Sačuvan plan 5k-v2.6.0 ostaje plan 5K v2 i prilagođava se pravilima 2.6.1 (app/plan.ts ' +
      'KNOWN_VERSIONS); njegov sačuvan korak se ponavlja kako je sačuvan (week = poslednja nedelja bola). ' +
      '(7) Odluka organizatora o sudaru 08d: korak bola sa povratkom počinje novu progresiju doze od nedelje ' +
      'r + 1, ako je ona nedelja izgradnje (steps.doseResetAt; isti mehanizam kao korak koji menja cilj nedelje, ' +
      'konstruktor i validator čitaju istu funkciju; korak sa pauzom zadržava svoj start); BASE_R_DECREASE se ' +
      'ne menja i poredi od novog starta doze. Obrazloženje: posle bola sledi nedelja bez kvaliteta i niži obim ' +
      'povratka; doza kvaliteta kreće iznova, kao posle pauze. Na bf47249 22 toka bola u bazi (v45-d4-22km-14w, ' +
      'bol u ned 3) su odbijana (R ned 5 < R ned 2/3), što je greška upotrebljivosti (korisnik sa bolom dobija ' +
      '„plan nije prilagođen"); sada su prihvaćeni (ned 5 = 18,2 km, R 0,80 + T 1,00).'
  },
  {
    version: '5k-v2.8.1',
    decision:
      'Segment 08e, Odluka 9 (odluka organizatora, heuristika; ista kao 10K A17; bez novog broja). Redovno ' +
      'rasterećenje odmah posle nedelje smanjenja otpada. (1) Nedelja smanjenja: (a) korak sa ciljem koraka koji ' +
      'je smanjenje — pauza i manjak izvršenja (višak nije; oznaka koraka reduced) → fromWeek; (b) korak bola sa ' +
      'povratkom → nedelja sidra r; (c) korak sa novim startom (pauza ≥ 28) se ne računa. Korak sačuvan pre ' +
      '5k-v2.7.0 (bez reduced): cilj koraka uz nivo pre smanjenja. (2) Ukida se samo redovno rasterećenje iz ' +
      'osnovnog rasporeda u fazi izgradnje; prinudno (umor) nikad; taper i trkačka nedelja nisu rasterećenja. ' +
      '(3) Granica: od ukinute nedelje (uključujući nju) do sledećeg rasterećenja ili kraja izgradnje najviše ' +
      'najduži niz izgradnje bez rasterećenja koji generator sam pravi u osnovnom rasporedu (periodize, planovi ' +
      'sa rasterećenjem 8–16 ned; izmereno: 5 — plan od 11 ned; početnik 3) + 1 = 6, početnik 4 ' +
      '(steps.reliefMaxRun, izvedeno iz periodize); duži niz → rasterećenje ostaje. Raspored se ne pomera, ništa ' +
      'se ne ubacuje. (4) Ukinuta nedelja dobija cilj po postojećem pravilu povratka (volume.adaptVolume: ' +
      'nextBuildKm od osnove; kod bola od returnBaseKm). (5) Jedno mesto: steps.framesFor (izlaz dropped; ' +
      'konstrukcija, poruka koraka); nijedno pravilo validatora ne zavisi od rasporeda rasterećenja (VOLUME_DELOAD ' +
      'meri samo nedelje koje su u planu rasteretne; donja granica čita cilj generatora isto kao konstruktor), ' +
      'pa validator nema izuzetak. (6) Poruka koraka: „Redovno rasterećenje u nedelji n + 1 otpada: nedelja n je ' +
      'smanjena (Odluka 9)." (pauza i bol iste nedelje: jedna rečenica, uz pauzu). Obrazloženje: smanjena ' +
      'nedelja je već oporavak; drugo rasterećenje zaredom gubi nedelju povratka. Primeri (cilj km, 5k-v2.6.1 → ' +
      '5k-v2.7.0): v45-d4-22km-14w, asOf kraj ned 2 — pauza 10 dana: ned 4 rasterećenje 14,1 → 19,3, ned 5 19,3 → ' +
      '21,2, ned 8 rasterećenje 18,2 → 19,7; bol 5: ned 4 12,3 → 16,9; manjak: ned 4 16,3 → 22,0; v45-d3-15km-10w, ' +
      'kraj ned 1, pauza 10: ned 3 rasterećenje 9,6 → 13,2 (niz 3–7 = 5). Pretraga (adaptNetwork, asOf kraj ned i ' +
      'kraj − 3, w = 1 … N − 2; pauza 10/20, bol 5/8, pauza 10 + bol 5, manjak; 5952 toka): pre 975 tokova sa ' +
      'redovnim rasterećenjem odmah posle smanjenja, posle 0 (0 zadržano granicom). Kontrolno trčanje: postojeće ' +
      'premeštanje; u 90 tokova test ranije (u ukinutu nedelju) ili dodat, nijedan uklonjen. (7) Konstruktor ne ' +
      'sme sastaviti ono što validator odbije (P2; ista pretraga 44 odbijena → 0, šira 42 → 0): VOLUME_GROWTH — ' +
      'validator rasta nije znao donju granicu adaptiranog cilja (2.6.0 Odluka 2, volume.adaptFloorKm), sada je ' +
      'čita (npr. beg-feel-d4-15km-10w, bol 5 kraj ned 1: osnova 10,5, cilj 12 = granica 4 × 3 km); ' +
      'WEEK_MIN_VOLUME — u nedelji sa danima bola minimum nedelje važi za cilj, planirano ispod cilja zbog dana ' +
      'bola je upozorenje (PLANNED_BELOW_TARGET_LIMITS); cilj ispod minimuma ostaje greška (npr. ' +
      'beg-feel-d3-12km-10w, pauza 10 + bol 5 kraj ned 8: ned 9 cilj 7,5, planirano 7,3); VOLUME_DELOAD — cilj ' +
      'ostatka tekuće nedelje pauze (2.5.0 Odluka 3: min(cilj pauze, cilj)) validator nije znao; jedna funkcija ' +
      'volume.pauseRemainderKm (adaptVolume i validator; rasterećenje u kom počinje pauza sme ispod 0,8 × ' +
      'prethodne — pauza je jači razlog za smanjenje; npr. v38-d4-38km-10w, pauza 20, asOf sreda ned 3: ' +
      'rasterećenje 29,9 → 26,2 = 0,70 × 37,4). Sačuvan plan 5k-v2.6.0 i 5k-v2.6.1 ostaje plan 5K v2 i ' +
      'prilagođava se po 2.7.0 (app/plan.ts KNOWN_VERSIONS).'
  },
  {
    version: '5k-v2.8.1',
    decision:
      'Segment 08g, Faza 4a N2–N4 + pouka 36 (odluke organizatora; bez novog broja). (N2a, pouka 23/29) ' +
      'Kontrolno trčanje iz UPISANOG plana (steps.writtenTest): test u zaštićenom danu je urađen i ostaje u svojoj ' +
      'nedelji (nedelja ga nosi i kad sastavljeni ostatak nema test); neurađen test polazi od nedelje prethodnog ' +
      'plana — premeštanje iz ranijeg koraka se ne gubi (f4b257d: lanac pauza 10 → manjak, f-d4-6w-30km-e420-0, ' +
      'TEST_WEEK). (N2b, odluka D) Provere progresije porede dozu u JEDINICI u kojoj je zadata (m: distanca, ' +
      'kontinuirano, progresija; s: ponavljanja vremenom) — km procenjen tempom nije doza (BASE_R_DECREASE, ' +
      'DOSE_PROGRESSION, BASE_PLATEAU; QUALITY_REPEAT već poredi strukturu); R sme da padne samo kad je plafon R ' +
      'nedelje (workouts.qualityBudgets: 5 % cilja) ispod prethodne R doze zadate distancom (MASTER pouke 12/32): ' +
      'konstruktor bira najveću strukturu koja staje + napomena, validator upozorenje DOSE_DROPPED; inače odbijanje ' +
      '(r-d5-14w-60km-v32-1, sporiji rezultat sreda ned 3: plafon 2,34 < 2,40 km → R 2,10; početnik usponi 270 → ' +
      '300 s, km 0,63 → 0,60 nije pad). Merenje (slower/faster/test5k, uzorak 7/7/7): 18/34 701 → 0. (N3, pouka 30) ' +
      'Trkačka nedelja (bez trke) ≤ planirano poslednje nedelje tapera (upisane): višak laganih dana postaje odmor — ' +
      'prvo dani bola, pa najraniji lagani; dan pred trku, oštrenje i trka ostaju; jedno mesto week.raceWeekRest → ' +
      'polje nedelje raceRest, validator ga čita (RACE_WEEK_TAPER greška; skraćena ispod minimuma → upozorenje ' +
      'RACE_WEEK_SHORT). Primer r-d3-9w-20km-v45-1, bol 8 kraj ned 7: taper 7,9, trkačka 9,3 → 6,6 km. (N4, pouka ' +
      '29) Prošlost = upisani dani: written.ts je jedino mesto spajanja (adapt i konstruktor); konstruktor čita iz ' +
      'upisanih dana dugi prethodne nedelje za trkačku, taper, test i stanje doze (doza nedelje važi samo kad su ' +
      'upisani dani kvaliteta isti kao sastavljeni); validator ne preskače mešovitu nedelju u proverama zavisnim od ' +
      'prošlosti — segment doze se čita po DATUMU upisanog dana kvaliteta (steps.doseResetDate: pauza usred nedelje ' +
      'počinje novi segment od asOf + 1; nedelja sa danima u dva segmenta nema jednu dozu); zaključan budući dan je ' +
      'činjenica — lanac doze i oznaka testa ga ne porede, kao LIMITS (MAR-07 nalaz: novi rezultat kraj ned k + ' +
      'zaključan Q1 ned k + 1, f4b257d 47/5184 odbijeno → 0). (Pouka 36, precizno) Prinudno rasterećenje = nedelja ' +
      'POSLE nedelje poslednjeg zapisa umora; ako je asOf već u njoj, važi za njen ostatak (korak deloadWeek, prošli ' +
      'dani zaštićeni); ako je ona već rasterećenje — novo se ne pravi; isti zapisi u nedelju i u ponedeljak = isti ' +
      'plan (fatigue-repeat.ts 5K end: 58/117 → 0). Merenje (Faza 4a ' +
      'early.ts 5K 29 19 11, 75 456 tokova): odbijeno 92 → 0, trkačka > taper 34 → 0; generator bez činjenica ' +
      'bajt-isti (3816 planova). Sačuvan plan 5k-v2.6.0/2.6.1/2.7.0 se prilagođava po 2.8.0 (KNOWN_VERSIONS).'
  },
  {
    version: '5k-v2.8.1',
    decision:
      'Segment 08h (odluke organizatora; bez novog broja). (Pouka 35, MASTER) Dva dana kvaliteta samo kad dugi ostaje ' +
      'najduži: u nedelji izgradnje (baza, vrhunac, oštrenje; taper i trkačka izuzeti; ne u nedelji sa danima bola/' +
      'odmora) sa dva dana kvaliteta, kad bi neki dan kvaliteta trajao duže od dugog, drugi dan kvaliteta postaje lagan ' +
      '(napomena), prvi ostaje, oslobođen obim ide u dugi i lagane (weekLengths); doza drugog kvaliteta se ne beleži. ' +
      'Jedno mesto: week.secondQualityEasy (konstruktor i validator: SECOND_QUALITY; oznaka u napomeni nedelje → ROLES ' +
      'očekuje 1). Kad nedelja sa jednim kvalitetom nije izvodljiva (lagan < minimuma ili lagan = dugi) ostaju dva ' +
      'kvaliteta uz upozorenje LONG_NOT_LONGEST (pouka 14). Merenje: generator e41defc 88/3816 planova sa takvom ' +
      'nedeljom → 0 (npr. f-d4-6w-15km-e300-0 ned 1: usponi 20 min > dugi 18 min); u 08h mreži nijedna nedelja ' +
      'izvodljivosti (LONG_NOT_LONGEST 0); adaptacija (trajna rana mreža): 1217 tokova → 0. Pouka 36 (precizno) i ' +
      'zaključan dan posle novog rezultata već su u 5k-v2.8.0 — trajne mreže 08h (umor po danima: isto rasterećenje; ' +
      'locked-result: 0 odbijanja); urađen dan posle asOf u 5K nije činjenica (checkFacts: ADAPT_FACT_AFTER_AS_OF). ' +
      'Sačuvan plan 5k-v2.8.0 i stariji prilagođavaju se po 2.8.1 (KNOWN_VERSIONS).'
  },
  {
    version: '5k-v2.9.0',
    decision:
      'Faza 3, segment 3d (DESIGN.md § 8 O3a, O4a, O6b, O8a): 5K v2 kao CILJ predaje „kraća distanca" (izvor HM v2). ' +
      'Pravila nepromenjena; menja se samo format plana: plan cilja nosi nedelje izvora ispred (app/plan.ts ' +
      'PREFIX_KEY), nedelje 5K imaju broj i id dana kao nedelja izvora istog datuma. Cilj = generate (činjenice ulaza, ' +
      'obim čarobnjaka izvora, start = granica nedelje posle potvrde) + adapt (sirove činjenice bez dayId; potvrđena ' +
      'pauza = činjenica pauze). Odbijanje → opcija nedostupna sa razlogom v2 doslovno. Sačuvan plan 5k-v2.8.1 i ' +
      'stariji prilagođavaju se po 2.9.0 (KNOWN_VERSIONS).'
  },
  {
    version: '5k-v2.10.0',
    decision:
      'MASTER pouka 37 (organizator, 10K-06h sudar; dopuna iz HM-08): mešovita nedelja izgradnje/tapera (deo dana ' +
      'zaštićen: ≤ asOf, zaključan; urađen dan posle asOf u 5K nije činjenica) — cilj važi za CELU nedelju. Konstruktor ' +
      'sastavlja nedelju bez zaštićenih dana, pa preostali dani dobijaju ostatak = cilj − zbir zaštićenih, SAMO NANIŽE ' +
      '(nijedan dan duži od sastavljenog, manjak se ne nadoknađuje). Dugi se NE skraćuje (referenca poslednjeg dugog); ' +
      'prvo lagani do minimuma (lagan ≤ dugi samo među preostalim danima — zaštićeni su činjenice), pa otpada kvalitet ' +
      '(prvo drugi, pa svi; dan postaje lagan, doza se ne beleži); kad ni minimum preostalih dana (bez kvaliteta, lagan = ' +
      'minimum, dugi kakav je) ne staje → preostali dani na minimumu, planirano > cilj uz upozorenje MIXED_OVER_TARGET ' +
      '(pouka 14), ne odbijanje. Trkačka nedelja izuzeta (pouka 30: ≤ planirano tapera). Jedno mesto: week.mixedRemainder ' +
      '(generate.construct); validator: mešovita nedelja posle asOf sa planirano > cilj → MIXED_OVER_TARGET ako su ' +
      'preostali dani na week.mixedFloorKm (ista funkcija), inače MIXED_REMAINDER. Ciljevi nedelja se ne menjaju. ' +
      'Merenje: mixed-deload.ts e2e482e planirano > cilj 22/42 (+2,4 km prosek, max 4,6) → 7/42 (svi sa upozorenjem, ' +
      '+1,29, max 2,12); regresija 99 069 tokova (svaki 24. plan × 17 scenarija × asOf start − 3/− 1 i dan 0/3/6 svake ' +
      'nedelje, umor svaki dan): generator bajt-isti (3816), promenjeno 15 742 — svi sa mešovitom nedeljom po pouci 37 ' +
      '(pauza/lanac/bol+pauza 12 634, umor 553, bol 16, drugi korak lanca 2 539), ciljevi 0, nijedan km naviše, ' +
      '0 odbijanja; trajna mreža 08i 0 odbijanja. Sačuvan plan 5k-v2.9.0 i stariji prilagođavaju se po 2.10.0 ' +
      '(KNOWN_VERSIONS).'
  },
  {
    version: '5k-v2.10.1',
    decision:
      'Dopuna 08i-b (organizator, MASTER pouka 37): (1) zbir zaštićenih dana mešovite nedelje po ČINJENICAMA — ' +
      'assess.factKmOf (jedino mesto): dan u eksplicitnoj pauzi = 0, dan sa zapisom = urađeni km (neurađen = 0), poznat ' +
      'dan bez zapisa (potpuna pokrivenost, Odluka 3) = 0, ostalo (asOf bez zapisa i pokrivenosti, zaključan budući) = ' +
      'planirani km; week.protectedKm sabira, konstruktor ga upisuje u PlanWeek.protectedKm kad se razlikuje od planiranih ' +
      'km i validator ga treba (nedelja je tada mešovita), validator ga čita. Nedelja ostatka pauze (volume.pauseRemainderKm) ' +
      'ima vlasnika — pravilo pauze; pouka 37 je ne menja (merenje: isključen izuzetak → 0 promenjenih tokova od 99 069, ' +
      'pravila se ne sudaraju). (2) Pouka 23 (kao maraton A13/A13b): kontrolno trčanje koje se premešta (steps.framesFor) ' +
      'ne ide na zaštićen (zaključan) dan — tada otpada uz napomenu, bez drugog testa. Merenje: tokovi pauze sa ' +
      'MIXED_OVER_TARGET 10 362 → 0 (dani pauze kao na e2e482e); više od plana (over120) sada skraćuje preostale dane ' +
      '(urađeni km > planirani); TEST_WEEK u trajnoj mreži sa zaključanim danom i u planu po osećaju 168 / 9 919 → 0. ' +
      '(3) Dopuna MAR-08: kvalitet otpada samo kad time ostatak staje; kad ni bez kvaliteta ne staje — kvalitet ostaje, ' +
      'lagani na minimumu, MIXED_OVER_TARGET (816 tokova regresije zadržava kvalitet). (4) Doza: otpao samo drugi kvalitet ' +
      '→ week.secondEasyDose (kao pouka 35), i kad je takva nedelja kasnije upisana prošlost (lanac; inače BASE_R_DECREASE / ' +
      'DOSE_PROGRESSION). Regresija prema e2e482e (99 069): ciljevi 0, km naviše 0, odbijanja 0. Sačuvan plan 5k-v2.10.0 i stariji ' +
      'prilagođavaju se po 2.10.1 (KNOWN_VERSIONS).'
  },
  {
    version: '5k-v2.10.2',
    decision:
      'K9 (organizator, two-step.ts; pouka 23): drugi korak adaptacije posle koraka smanjenja (pauza, izvršenje) bio je ' +
      'odbijan (VOLUME_RESET / VOLUME_GROWTH / VOLUME_PEAK) — volume.adaptVolume je za kasniji korak bez cilja ponovo ' +
      'gradio nedelju sa ciljem RANIJEG koraka od generatora, dok validator (resetKm) drži cilj koraka. Ispravka na ' +
      'strani konstruktora: nedelja sa ciljem ranijeg koraka zadržava ga i ostaje osnov rasta. Idempotentnost: ista ' +
      'adaptacija sa istim činjenicama na kasniji asOf daje iste ciljeve i dane posle asOf — zato kontrolno trčanje koje ' +
      'ne staje u obim otpada PRVO samo (ista ograničenja), a tek onda manje kvaliteta (pouka 13: test ne „jede" ' +
      'nedelju). Trajna mreža 08j: smanjenje → 17 scenarija (+3/+7, new/cum), 0 odbijanja, isti plan za iste činjenice. ' +
      'Sačuvan plan 5k-v2.10.1 i stariji prilagođavaju se po 2.10.2 (KNOWN_VERSIONS).'
  },
  {
    version: '5k-v2.10.3',
    decision:
      '08k (organizator, edges.ts; pouka 23): (1) posle sporijeg rezultata baza je zadržavala prethodnu R dozu ' +
      '(workouts.baseWeek) čije ponavljanje na NOVOM tempu traje duže od plafona → R_REP (npr. 0,4 km × 308 s/km = 123 s ' +
      '> 120 s). Ispravka na strani konstruktora: zadržana doza mora stati u plafon trajanja na tekućem tempu ' +
      '(workouts.repFits); validator bez izmene. I_REP i T_CONTINUOUS na istom obrascu: 0 na edges (15 800 tokova) i na ' +
      'pretrazi sporijih rezultata (VDOT − 3 … − 12, svaka nedelja, 11 988 tokova) — ostale putanje biraju ponavljanje ' +
      'na tekućem tempu. (2) Rezultat sa VDOT van 30–60 → RESULT_IGNORED sa vrednošću i opsegom (kao 10K A1); ' +
      'adaptacija se nastavlja sa ostalim činjenicama; generator (input.ts) i dalje odbija ulaz. Merenje: edges.ts 5K ' +
      '428 → 0 odbijanja (VDOT_OUT_OF_RANGE 420, R_REP 20 → 0); generator bajt-isti; regresija 99 069 tokova bez ' +
      'promene. Sačuvan plan 5k-v2.10.2 i stariji prilagođavaju se po 2.10.3 (KNOWN_VERSIONS).'
  }
];
