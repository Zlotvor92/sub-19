/* ============================================================
   GENERATOR PLANA — mašina.

   `generatePlan` zna kalendar, raspored deload/taper nedelja, raspodelu po
   danima, izravnavanje rasta i upozorenja. Ne zna nijedan broj specifičan za
   distancu: sve takve odluke čita iz profila (`distances/`).

   KORAK A (port bez promene ponašanja): isti redosled operacija i zaokruživanja
   kao stari `generatePlan`; izlaz mora da prođe golden-master otisak
   (web/src/test/fixtures/otisak-generatora.json). Rationale za pojedine odluke:
   docs/TRAINING_ENGINE_AUDIT.md.
   ============================================================ */

import { addDays, diffDays, mondayOnOrBefore, parseIsoDate } from '../../date';
import { brojNedelja, distUReceni, fmtClock, r1 } from '../../format';
import { DELIVERED_GROWTH_FACTOR, DELOAD_EVERY } from '../constants/heuristics';
import {
  BEGINNER_MAX_WEEKLY_KM,
  DEFAULT_QUALITY,
  DEFAULT_RUN_DAYS,
  FIRST_WEEK_SHORTFALL_WARN,
  MAX_INPUT_WEEKLY_KM,
  MAX_PLAN_WEEKS,
  MIN_KM_PER_RUN,
  MIN_START_WEEKLY_KM,
  RUN_WALK_WEEKS,
  STRUCTURAL_CEILING_RATIO
} from '../constants/product';
import { UNDULATION } from '../constants/distances';
import { profileFor } from '../distances';
import type { DistanceProfile, QualityRequest } from '../distances/types';
import { predRow, qsFor } from '../prediction';
import { sessInt } from '../sessions/build';
import { sessDesc, sessKm, sessQKm } from '../sessions/calc';
import { constrainWeek } from '../sessions/constraints';
import { finishLoadSec, sessionLoadSec, weeklyFastEnvelopeSec } from './weeklyLoad';
import { raceTimeForVdot } from '../vdot/racePrediction';
import type {
  Day,
  EasyRunDay,
  LongRunDay,
  PlanGenerationInput,
  PlanGenerationResult,
  PlanMeta,
  RaceDay,
  RestDay,
  RunWalk,
  RunWalkDay,
  RunningDay,
  SessionDay,
  StrengthDay,
  TrainingPlan
} from '../types';
import { paceForZone } from '../vdot/paceForZone';
import { allocEasyLongRun, perRunFloor, type Allocation } from './allocation';
import { assess } from './assess';
import { buildDaySlots, dayPreferenceWarnings, pickStrengthDay } from './daySlots';
import { weekFocus } from './focus';
import { validateInput } from './validateInput';
import { runWalkForWeek, runWalkText, validRunWalkLadder } from './runWalk';
import {
  EASY_EFFORT_NOTE,
  QUALITY_ENTRY_NOTE,
  formPolicyFor,
  referenceQualityNote
} from './formPolicy';
import { fuelText } from '../sessions/longRun';
import { peakVolume, rampStep } from './volume';
import { assessAthlete, assessPreparation } from './athleteAssessment';
import { nextLongRunTarget } from './longRunProgression';
import { reducedQualityForDeload } from '../sessions/deload';

const hasKm = (d: Day): d is RunningDay => typeof d.km === 'number';
const kmOf = (d: Day): number => d.km || 0;
const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);
const sumKm = (days: readonly Day[]): number => days.reduce((s, d) => s + kmOf(d), 0);
const maxOf = (xs: readonly number[]): number => (xs.length ? Math.max(...xs) : 0);

const D = {
  easy: (dow: number, km: number, desc: string): EasyRunDay => ({ dow, tag: 'lako', km, desc }),
  longRun: (dow: number, km: number, desc: string): LongRunDay => ({ dow, tag: 'lr', km, desc }),
  race: (dow: number, km: number, desc: string): RaceDay => ({ dow, tag: 'trka', km, desc }),
  strength: (dow: number, desc: string): StrengthDay => ({ dow, tag: 'snaga', km: null, desc }),
  runWalk: (dow: number, km: number, desc: string, rw: RunWalk): RunWalkDay => ({
    dow,
    tag: 'rw',
    km,
    desc,
    runWalk: { runSec: rw.runSec, walkSec: rw.walkSec, label: rw.label }
  })
};
const REST = (dow: number, desc?: string | null): RestDay => ({
  dow,
  rest: true,
  desc: desc || null
});

/** Zamenjuje vodeći „<km> km" u opisu novom vrednošću (opis i kilometraža se ne smeju razići). */
function renameKm(d: RunningDay): void {
  d.desc = (d.desc || '').replace(/^[\d.,]+ km/, `${d.km} km`);
}

export function generatePlan(inp: PlanGenerationInput): PlanGenerationResult {
  const raceDistM = inp.raceDistM || 5000;
  const maybeProfile = profileFor(raceDistM);
  if (!maybeProfile) {
    return {
      error: 'Nepodržana distanca. Generator pravi planove za 5K, 10K, polumaraton i maraton.'
    };
  }
  const prof: DistanceProfile = maybeProfile;
  const invalid = validateInput(inp);
  if (invalid) return { error: invalid };

  /* Plan kreće OD DANA generisanja, ne od sledećeg ponedeljka. Nedelja 1 zadržava
     PRAVU pon–ned strukturu; dani PRE datuma generisanja se filtriraju na kraju. */
  const startDate = parseIsoDate(inp.startDate);
  const raceDate = parseIsoDate(inp.raceDate);
  if (!startDate) return { error: 'Datum početka nije ispravan datum (očekuje se GGGG-MM-DD).' };
  if (!raceDate) return { error: 'Datum trke nije ispravan datum (očekuje se GGGG-MM-DD).' };
  const start = mondayOnOrBefore(startDate);
  const daysN = diffDays(start, raceDate);
  const weeks = Math.floor(daysN / 7) + 1;
  if (weeks < prof.product.minWeeks) {
    return {
      error: `Manje od ${brojNedelja(prof.product.minWeeks)} do trke (minimum za ${distUReceni(prof.product.name)}) — puna periodizacija nije moguća.`
    };
  }
  if (weeks > MAX_PLAN_WEEKS) {
    return {
      error: `Više od ${brojNedelja(MAX_PLAN_WEEKS)} (2 godine) — proveri datum trke, verovatno je pogrešno unet.`
    };
  }

  const runDays = Math.max(2, Math.min(7, softInt(inp.runDays, DEFAULT_RUN_DAYS)));
  let qWant = Math.max(1, Math.min(2, softInt(inp.quality, DEFAULT_QUALITY)));
  const H = prof.heuristic;
  const athlete = assessAthlete(inp, H);
  /* Rast obima ima SVOJ izbor; bez njega (stari planovi) prati tempo napretka. */
  const volIntensity = inp.volIntensity ?? inp.intensity;
  const QUAL2_MIN_KM = prof.product.qual2MinKm;
  /* Taper nedelje: 5K i 10K jedna, HM i maraton dve. Zadnja RADNA nedelja je ona iza koje
     slede taper nedelje i trkačka. */
  const taperW = Math.max(1, Math.min(3, H.taperWeeks || 1));
  const lastWorking = weeks - 1 - taperW;
  /* Raspored dana se pravi JEDNOM za ceo plan, pa se odluke o MLR-u i drugom kvalitetu
     mere VRHUNCEM plana, ne unetim obimom. */
  const cur0 = Math.max(MIN_START_WEEKLY_KM, Math.min(inp.weeklyKm, MAX_INPUT_WEEKLY_KM));
  const deload0 = Math.floor(lastWorking / DELOAD_EVERY);
  const ramp0 = Math.max(lastWorking - deload0, 1);
  const peakEstimate = peakVolume(H, cur0, ramp0, volIntensity);
  const mlrCfg = H.midweekLong;
  const wantMLR = !!(mlrCfg && runDays >= mlrCfg.minDays && peakEstimate >= mlrCfg.minKm);
  /* Koliko kvaliteta obim UOPŠTE podnosi: dva kvalitetna u nedelji od 12 km su besmislena. */
  const qCut = qWant > 1 && peakEstimate < QUAL2_MIN_KM;
  if (qCut) qWant = 1;
  // Three running days must leave an easy day alongside quality and the LR.
  // Otherwise shrinking sessions and the LR share cap can reinforce each other.
  const frequencyQCut = qWant > 1 && runDays < 4;
  if (frequencyQCut) qWant = 1;
  const slots = buildDaySlots(
    runDays,
    qWant,
    { lrDow: inp.lrDow, qDows: inp.qDows, runDows: inp.runDows },
    wantMLR
  );
  const dayWarnings = dayPreferenceWarnings(slots);
  const effQ = Object.values(slots).filter((r) => r === 'q1' || r === 'q2').length;
  if (frequencyQCut)
    dayWarnings.push(
      'Na tri dana trčanja ovaj generator planira najviše jedan kvalitet, uz lagan dan i dužinu. ' +
        'Tražena dva kvaliteta ostavila bi premalo prostora za lagani obim i oporavak.'
    );
  const a = assess(inp.pb, weeks, inp.intensity, inp.goalSec || null, raceDistM);

  /* Cilj je želja; ekvivalent trenutne forme nije prognoza napretka kroz pripremu. */
  if (inp.goalSec && a.realno === false) {
    dayWarnings.push(
      'Ciljno vreme ' +
        fmtClock(inp.goalSec) +
        ' je brže od reference trenutne forme (' +
        fmtClock(a.predictedSec) +
        '). To ne procenjuje napredak do dana trke ni izdržljivost za ciljnu distancu. ' +
        'Tempo treninga ostaje vezan za potvrđenu formu. Cilj je sačuvan kao želja; proveri napredak novom trkom ili testom pre ubrzavanja.'
    );
  }

  /* ============================================================
     BAZNA FAZA — samo za one koji tek počinju (`trainedRecently === false`):
     obavezan mesec trčanja/hoda, pa konsolidacija. Ko trenira redovno nema baznu
     fazu. Koliko traje je odluka distance; ŠTA se u njoj radi je isto za sve.
     ============================================================ */
  const trainedRecently = inp.trainedRecently !== false;
  const isBeginner = athlete.qualityReadiness === 'beginner';
  const isReturning = athlete.qualityReadiness === 'returning';
  /* Ponavljanje/zadržavanje koraka: eksplicitna lestvica produžuje fazu, a bar jedna bazna nedelja ostaje iza nje. */
  const rwLadder =
    isBeginner && validRunWalkLadder(inp.runWalkLadder) ? inp.runWalkLadder : undefined;
  const wantedBase = isBeginner
    ? Math.max(prof.product.baseWeeksBeginner, rwLadder ? rwLadder.length + 1 : 0)
    : isReturning
      ? Math.min(3, Math.max(1, Math.ceil(athlete.breakWeeks / 2)))
      : 0;
  const baseWeeks = wantedBase ? Math.max(0, Math.min(wantedBase, weeks - 1)) : 0;
  const rwWeeks = isBeginner ? Math.min(rwLadder ? rwLadder.length : RUN_WALK_WEEKS, baseWeeks) : 0;
  const rwFor = (w: number): RunWalk | null => runWalkForWeek(w <= rwWeeks ? w : 0, rwLadder);
  /* Prva nedelja bez hodanja je probna: bez potvrde tolerancije nije automatski ishod faze. */
  const transitionW = rwWeeks > 0 && rwWeeks < weeks - 1 ? rwWeeks + 1 : 0;
  const lastRw = rwWeeks > 0 ? runWalkForWeek(rwWeeks, rwLadder) : null;
  const transitionNote = lastRw
    ? ` · Prelaz na neprekidno trčanje je probni: radi ga samo ako su poslednja run/walk trčanja bila razgovorna (napor do 5/10) i bez bola. Ako nisu, ponovi korak „${lastRw.label}" i prilagodi plan u kartici „Prema odrađenim treninzima"`
    : '';
  const formPolicy = formPolicyFor(athlete);
  const effortFirst = formPolicy !== null;
  const easyNote = effortFirst ? ` · ${EASY_EFFORT_NOTE}` : '';
  dayWarnings.push(...athlete.assumptions);
  if (isReturning)
    dayWarnings.push(
      `Posle pauze od ${athlete.breakWeeks} nedelja plan počinje sa ${baseWeeks} lagane povratne nedelje. Stari PB ostaje referenca; proveri formu pre zahtevnijeg rada.`
    );
  if (athlete.speedConfidence === 'stale-result')
    dayWarnings.push(
      'Rezultat je stariji od 90 dana. Tempa su referenca tog rezultata; ona nisu potvrda sadašnje forme niti automatska procena gubitka brzine.'
    );
  if (formPolicy)
    dayWarnings.push(
      `${formPolicy.reason} Laki rad i kvalitet vode se naporom, a ritmovi su samo orijentir. Zahtevniji rad se uvodi tek kad: ${formPolicy.entryConditions.map((c, i) => `${i + 1}) ${c}`).join('; ')}. Vremenski cilj ostaje cilj i ne potvrđuje formu.`
    );
  if (rwWeeks > 0)
    dayWarnings.push(
      `Trčanje/hod traje ${rwWeeks} ${rwWeeks === 1 ? 'nedelju' : 'nedelje'}. Prelaz na neprekidno trčanje u ${transitionW}. nedelji nije automatska potvrda tolerancije: potvrdi je naporom do 5/10 i odsustvom bola, inače ponovi poslednji korak. Prazan dnevnik ne znači ni uspeh ni neuspeh.`
    );

  if (qCut) {
    dayWarnings.push(
      'Plan daje JEDAN kvalitetan trening nedeljno umesto dva. Dva kvaliteta traže bar ~' +
        QUAL2_MIN_KM +
        ' km/ned, a ovaj plan i na vrhuncu dostiže oko ' +
        Math.round(peakEstimate) +
        ' km/ned — ispod toga bi oni sami bili većina nedelje, a za lagano trčanje (koje gradi bazu) ne bi ' +
        'ostalo mesta. Za dva kvaliteta treba ti viša polazna baza ili više nedelja do trke.'
    );
  }
  const volFloor = r1(runDays * MIN_KM_PER_RUN);
  if (inp.weeklyKm > 0 && inp.weeklyKm < volFloor) {
    dayWarnings.push(
      'Na ' +
        runDays +
        ' dana trčanja minimum je oko ' +
        volFloor +
        ' km/ned (ispod ~1,5 km po treningu nema smisla). Tražio si ' +
        inp.weeklyKm +
        ' km — plan će biti veći od toga. Za tako nizak obim uzmi manje dana trčanja.'
    );
  }
  const minRunDaysRec = prof.product.recommendedMinRunDays;
  if (minRunDaysRec && runDays < minRunDaysRec) {
    dayWarnings.push(
      'Izabrao si ' +
        runDays +
        ' dana za ' +
        distUReceni(prof.product.name) +
        '. Manje dana ostavlja manje prostora za raspodelu obima i oporavak između dužine i kvaliteta. ' +
        'Spremnost zavisi od tvoje baze i isporučene pripreme, a ne samo od broja dana.'
    );
  }
  if (isBeginner && rwWeeks < RUN_WALK_WEEKS) {
    dayWarnings.push(
      'Plan je prekratak za pun početnički uvod: trčanje/hod traje mesec dana (4 nedelje), ' +
        'a ovde staje ' +
        rwWeeks +
        '. Kvalitetni treninzi počinju dok si još na pauzama za hod — ' +
        'uzmi ih blaže, ili pomeri trku za koju nedelju.'
    );
  }
  /* „TEK POČINJEM" + VISOK OBIM je protivrečan ulaz; ne blokira se, ali se imenuje. */
  if (isBeginner && inp.weeklyKm > BEGINNER_MAX_WEEKLY_KM) {
    dayWarnings.push(
      'Označio si da TEK POČINJEŠ da trčiš, a uneo ' +
        inp.weeklyKm +
        ' km/ned. ' +
        'To se ne slaže: mesec dana trčanja/hoda (1:1 → 5:1) je uvod za nekoga ko gradi prvih ~10–25 km/ned. ' +
        'Plan je napravljen, ali će bazna faza biti nesrazmerno velika, a skok kad uđu kvalitetni treninzi ' +
        'nagliji nego što je bezbedno. Ako već redovno trčiš toliko, vrati se i reci da si trenirao — ' +
        'dobićeš plan bez početničkog uvoda. Ako zaista počinješ, unesi obim koji sada stvarno trčiš.'
    );
  }
  const qualWeeks = weeks - baseWeeks; // nedelje u kojima se odvija kvalitetni ciklus

  /* ============================================================
     OBIM. Vrhunac iz STOPE rasta (`peakVolume`), odredište iz distance; nedeljni
     korak je APSOLUTAN. Ciljni niz `vols` se posle potkresuje stvarnom raspodelom.
     ============================================================ */
  const vols: number[] = [];
  let cur = cur0;
  const peakTarget = peakEstimate;
  const next = (v: number): number => Math.min(v + rampStep(H, v, volIntensity), peakTarget);
  /** Najviši dosadašnji ciljni obim, ali ne ispod tekuće vrednosti `cur`. */
  const peak = (arr: readonly number[]): number => Math.max(...arr, cur);

  for (let w = 1; w <= weeks; w++) {
    if (w === weeks) {
      vols.push(r1(peak(vols) * H.raceWeekFactor));
    } else if (w === weeks - 1) {
      vols.push(r1(peak(vols.length ? vols : [cur]) * H.taperFactor));
    } else if (taperW >= 2 && w > lastWorking) {
      /* PRVA taper nedelja (kad ih ima dve): prelaz, ~82% vrhunca; intenzitet ostaje. */
      vols.push(r1(peak(vols.length ? vols : [cur]) * (H.firstTaperFactor || 0.82)));
    } else if (w <= baseWeeks) {
      /* Bazne nedelje: blag rast od starta; deload na SVAKU četvrtu baznu nedelju. */
      if (w % DELOAD_EVERY === 0 && vols.length) {
        vols.push(r1(at(vols, vols.length - 1) * H.deloadFactor));
      } else {
        /* Posle deloada rast kreće od nedelje PRE deloada, ne od snižene vrednosti. */
        const prevB = vols.length ? at(vols, vols.length - 1) : cur;
        const baseB =
          w > 1 && (w - 1) % DELOAD_EVERY === 0 && vols.length >= 2
            ? at(vols, vols.length - 2)
            : prevB;
        cur = vols.length ? next(baseB) : cur;
        vols.push(r1(cur));
      }
    } else if (w % DELOAD_EVERY === 0 && w < lastWorking) {
      vols.push(r1(at(vols, vols.length - 1) * H.deloadFactor));
    } else {
      const prev = vols.length ? at(vols, vols.length - 1) : cur;
      const base = w > 1 && (w - 1) % DELOAD_EVERY === 0 ? at(vols, vols.length - 2) : prev;
      cur = next(base);
      vols.push(r1(cur));
    }
  }
  /* UNDULACIJA NA ODREDIŠTU: kad trkač već trči blizu obima koji distanca traži,
     talasa se unutar bloka (lakše → normalno → malo teže → deload); samo na nedelje
     koje su vec dosegle vrhunac. */
  for (let w = baseWeeks + 1; w <= lastWorking; w++) {
    if (w % DELOAD_EVERY === 0) continue; // deload ima svoju ulogu
    if (at(vols, w - 1) < peakTarget * 0.995) continue; // još raste — ne diraj
    vols[w - 1] = r1(peakTarget * at(UNDULATION, (w - 1) % DELOAD_EVERY));
  }

  const currentRaceSec = raceTimeForVdot(a.vdot0, raceDistM);
  const racePace = Math.round(
    Math.max(inp.goalSec || currentRaceSec, currentRaceSec) / (raceDistM / 1000)
  );
  const raceDow = daysN - (weeks - 1) * 7 + 1; // 1..7 unutar poslednje nedelje
  const meta: PlanMeta = {
    ...a,
    athlete,
    trainingVdot: a.vdot0,
    start,
    weeks,
    intensity: inp.intensity,
    racePace,
    runDays,
    quality: effQ,
    dayWarnings,
    raceDistM,
    raceName: prof.product.name,
    baseWeeks,
    raceDate: inp.raceDate,
    goalSec: inp.goalSec || null,
    ...(formPolicy ? { formPolicy } : {}),
    ...(rwWeeks > 0
      ? {
          runWalk: {
            ladder: Array.from({ length: rwWeeks }, (_, i) => rwLadder?.[i] ?? i + 1),
            transitionWeek: transitionW,
            conditions: [
              'sva run/walk trčanja poslednjeg koraka završena uz napor do 5/10',
              'nema zapisa bola 3/10 ili jačeg uz ta trčanja',
              'bar tri trčanja imaju upisan napor; prazan dnevnik ostaje nepoznat podatak'
            ]
          }
        }
      : {})
  };
  const plan: TrainingPlan = { weeks: [], pred: [], qs: {}, meta };
  const strengthDow = runDays <= 5 ? pickStrengthDay(slots) : null;

  /** Plafon udela dugog trčanja na SASTAVLJENOJ nedelji (ne na ciljnom obimu). */
  const clampLongRun = (alloc: Allocation, qKms: readonly number[]): Allocation => {
    const c = H.longRunMaxShare;
    if (!c || !(alloc.lr > 0)) return alloc;
    const rest = sum(qKms) + (alloc.mlr || 0) + sum(alloc.easies);
    const maxQ = maxOf(qKms);
    const ceiling = Math.max(r1((rest * c) / (1 - c)), r1(maxQ * 1.05));
    if (alloc.lr > ceiling) alloc.lr = ceiling;
    return alloc;
  };

  const pushPredQs = (day: SessionDay, w: number, doesNotMeasure?: boolean): void => {
    const ses = day.session;
    const row = predRow(w, ses.kind, sessQKm(ses), ses.paceSec, raceDistM, a.vdot0, ses.zone);
    if (doesNotMeasure) row.nemeri = true;
    plan.pred.push(row);
    const spec = qsFor(ses);
    if (spec) plan.qs[`n${w}d${day.dow}`] = spec;
  };

  /** Konačni LR opis se izvodi iz završne kilometraže, uključujući gorivo i brz završetak. */
  const refreshLongRun = (day: LongRunDay, w: number): void => {
    const pLR = paceForZone(a.vdot0, 'LR');
    if (day.mlr) {
      day.desc = `${day.km} km srednje-dugo (Z2) @ ~${fmtClock(pLR)}/km — drugo duže trčanje u nedelji${easyNote}`;
      return;
    }
    if (day.finish) {
      const finish = prof.longRunFinish?.(
        prof.phase(Math.max(w - baseWeeks, 1), qualWeeks),
        Math.max(w - baseWeeks, 1),
        day.km,
        racePace,
        prof.paceStrategy?.(racePace) ?? null,
        prof.longRunCycle?.(w, {
          weeks,
          baseWeeks,
          taperW,
          isDeload: w % DELOAD_EVERY === 0 && w < lastWorking
        }) ?? null
      );
      if (finish) day.finish = finish;
      else delete day.finish;
    }
    const base = w <= baseWeeks;
    day.desc = `${day.km} km ${base ? 'lako-dugo' : 'LR'} (Z2) @ ~${fmtClock(pLR)}/km — ${base ? 'bazna faza, bez kvaliteta' : 'najduže trčanje te nedelje'}${fuelText(day.km, pLR, H)}${day.finish ? ` · poslednjih ${day.finish.km} km @ ${fmtClock(day.finish.paceSec)}/km (${day.finish.zone === 'M' ? 'maratonski' : 'tempo trke'})` : ''}${easyNote}${w === transitionW && !day.finish ? transitionNote : ''}`;
  };

  /** Proveri sastavljenu nedelju posle rezanja obima; LR i sesije dele konačni imenilac. */
  const finalizeWeek = (days: Day[], w: number): void => {
    for (let pass = 0; pass < 30; pass++) {
      constrainWeek(days, H.tempoMaxSec, paceForZone(a.vdot0, 'E'));
      if (w === weeks) break; // kilometraža same trke nije trening dužine
      const lr = days.find(
        (d): d is LongRunDay | RunWalkDay =>
          (d.tag === 'lr' && !d.mlr) || (d.tag === 'rw' && slots[d.dow] === 'lr')
      );
      if (!lr || !H.longRunMaxShare) break;
      const rest = sumKm(days) - lr.km;
      const maxQ = maxOf(days.filter((d) => d.session).map(kmOf));
      const before = sumKm(days);
      const ceiling = Math.max(
        r1((rest * H.longRunMaxShare) / (1 - H.longRunMaxShare)),
        r1(maxQ * 1.05)
      );
      // Deload podovi WU/CD mogu ostaviti kvalitet duži od LR-a; isti izuzetak
      // kao u raspodeli zadržava LR najdužim, bez povećavanja kvalitetne doze.
      lr.km = Math.min(Math.max(lr.km, r1(maxQ * 1.05)), ceiling);
      renameKm(lr);
      for (const day of days) {
        if (!hasKm(day) || day === lr || day.session || day.tag === 'trka') continue;
        if (day.km > lr.km) {
          day.km = lr.km;
          renameKm(day);
        }
      }
      if (Math.abs(before - sumKm(days)) < 0.05) break;
    }
    for (const day of days) if (day.tag === 'lr') refreshLongRun(day, w);
  };

  /* Uslovi za uvođenje zahtevnijeg rada stoje uz prvi kvalitetan trening plana, ne uz svaki. */
  let entryNoteDone = false;
  for (let w = 1; w <= weeks; w++) {
    const vdotW = a.vdot0;
    /* Specifičnost tek u POSLEDNJIH 6 nedelja pred taper — APSOLUTAN broj, ne razlomak. */
    const pI = prof.intervalPaceForWeek(paceForZone(vdotW, 'I'), racePace, weeks - w);
    const pT = paceForZone(vdotW, 'T');
    const pE = paceForZone(vdotW, 'E');
    const pLR = paceForZone(vdotW, 'LR');
    const pR = paceForZone(vdotW, 'R');
    const vol = at(vols, w - 1);
    const isDeload = w % DELOAD_EVERY === 0 && w < lastWorking;
    const isTaper1 = w === weeks - 1;
    const isRace = w === weeks;
    /* Prva taper nedelja (kad ih ima dve) NIJE `isTaper1`: kvalitet je normalan, samo je obim manji. */
    const isTaper2 = taperW >= 2 && w > lastWorking && w < weeks - 1;
    const days: Day[] = [];
    const previousLongRunPeak = Math.max(
      0,
      ...plan.weeks.flatMap((pw) =>
        pw.days
          .filter((d) => (d.tag === 'lr' && !d.mlr) || (d.tag === 'rw' && slots[d.dow] === 'lr'))
          .map(kmOf)
      )
    );
    const longRunTarget = nextLongRunTarget({
      heuristic: H,
      week: w,
      recentLongRunKm: athlete.repeatableLongRunKm,
      ...(athlete.consistentWeeks != null ? { consistentWeeks: athlete.consistentWeeks } : {}),
      trainedRecently: !isBeginner && !isReturning,
      ...(w > 1 ? { previousPeakKm: previousLongRunPeak } : {}),
      startingWeeklyKm: inp.weeklyKm,
      weeklyKm: vol,
      paceSecPerKm: pLR,
      isDeload,
      ...(isTaper1 ? { taperFactor: H.taperLongRunFactor } : isTaper2 ? { taperFactor: 0.85 } : {}),
      marathon: raceDistM === 42195
    });
    const independentLR = { km: longRunTarget.km, maxShare: H.longRunMaxShare };

    if (isRace) {
      buildRaceWeek();
    } else if (w <= baseWeeks) {
      buildBaseWeek();
    } else {
      buildQualityWeek();
    }

    if (!isRace) limitEasyAfterLongRun();

    /* IZRAVNAVANJE RASTA: ciljni niz poštuje korak, ali STVARNI zbir dana odstupa jer su
       kvalitetne sesije diskretne. Višak se seče SAMO sa laganih dana (kvalitet i LR se ne
       diraju), pod po danu se poštuje. Deload se meri prema STVARNO ISPORUČENOJ prethodnoj
       nedelji i skalira proporcionalno (smanjena kopija nedelje, ne nedelja kojoj je jedan
       dan pojeden). Taper i trka se preskaču. */
    if (!isTaper1 && !isTaper2 && !isRace && plan.weeks.length) {
      const prevW = at(plan.weeks, plan.weeks.length - 1);
      /* Posle DELOAD nedelje obim NAMERNO skače nazad — poredi se sa nedeljom PRE nje. */
      const baseW =
        prevW.deload && plan.weeks.length >= 2 ? at(plan.weeks, plan.weeks.length - 2) : prevW;
      const prevVol = sumKm(baseW.days);
      const now = sumKm(days);
      if (prevVol > 0 && isDeload) {
        const limit = prevVol * (H.deloadFactor || 0.73);
        const deloadFloor = perRunFloor(limit, runDays);
        if (now > limit) {
          const f = limit / now;
          days.forEach((d) => {
            if (!hasKm(d)) return;
            if (d.session) {
              /* Dan sa SESIJOM (oštrina) se skalira KROZ sesiju — skraćuju se zagrevanje i
                 hlađenje, deonice ostaju; inače se kartica i opis raziđu. */
              const ses = d.session;
              ses.wuKm = r1(Math.max(1, ses.wuKm * f));
              ses.cdKm = r1(Math.max(0.8, ses.cdKm * f));
              d.km = sessKm(ses);
              d.desc = sessDesc(ses);
              return;
            }
            d.km = Math.max(deloadFloor, r1(d.km * f));
            renameKm(d);
          });
        }
      }
    }
    /* TAPER SE MERI PREMA STVARNO ISPORUČENOM VRHUNCU, ne prema ciljnom. Klamp SAMO SEČE. */
    if ((isTaper1 || isTaper2) && plan.weeks.length) {
      const pik = Math.max(...plan.weeks.map((pw) => sumKm(pw.days)), 0);
      const limit = Math.min(
        pik * (isTaper1 ? H.taperFactor : H.firstTaperFactor || 0.82),
        at(plan.weeks, plan.weeks.length - 1).vol
      );
      const now = sumKm(days);
      if (pik > 0 && now > limit) {
        /* Skida se SAMO sa dana bez kvalitetne sesije; kvalitet u taperu je već mali i nosi oštrinu. */
        const floorKm = perRunFloor(vol, runDays);
        const maxQ = Math.max(...days.filter((d) => d.session).map(kmOf), 0);
        /* Dugo trčanje ima VIŠI pod — „LR je najduže trčanje nedelje" ne sme da padne. */
        const lrDay = days
          .filter((d): d is RunningDay => d.tag === 'lr' || d.tag === 'rw')
          .sort((x, y) => (y.km || 0) - (x.km || 0))[0];
        const floorFor = (d: RunningDay): number =>
          d === lrDay ? Math.max(floorKm, r1(maxQ * 1.05)) : floorKm;
        const soft = days.filter(
          (d): d is RunningDay => !d.rest && !d.session && hasKm(d) && d.km > 0
        );
        const slack = soft.reduce((s, d) => s + Math.max(0, d.km - floorFor(d)), 0);
        const need = Math.min(now - limit, slack);
        if (slack > 0 && need > 0.05) {
          const f = need / slack;
          /* Srazmerno IZNAD sopstvenog poda — monotono po km, pa se redosled dana (a s njim i
             invarijanta dugog trčanja) čuva po konstrukciji. */
          soft.forEach((d) => {
            const pd = floorFor(d);
            d.km = r1(Math.max(pd, d.km - Math.max(0, d.km - pd) * f));
            renameKm(d);
          });
        }
        let remaining = Math.max(0, sumKm(days) - limit);
        for (const day of days) {
          if (remaining <= 0.05) break;
          if (!day.session) continue;
          const s = day.session;
          for (const [key, minimum] of [
            ['cdKm', 0.8],
            ['wuKm', 1]
          ] as const) {
            const before = s[key];
            s[key] = r1(Math.max(minimum, s[key] - remaining));
            remaining -= before - s[key];
          }
          day.km = sessKm(s);
          day.desc = sessDesc(s);
        }
        if (lrDay && remaining > 0.05) {
          const finalMaxQ = maxOf(days.filter((d) => d.session).map(kmOf));
          lrDay.km = r1(Math.max(floorKm, finalMaxQ * 1.05, lrDay.km - remaining));
          renameKm(lrDay);
        }
      }
    }
    // Final delivered-volume guard also covers the transition out of a longer beginner base.
    if (!isRace && !isTaper1 && !isTaper2 && !isDeload && plan.weeks.length) {
      const previous = at(plan.weeks, plan.weeks.length - 1);
      const reference =
        previous.deload && plan.weeks.length > 1 ? at(plan.weeks, plan.weeks.length - 2) : previous;
      const limit =
        reference.vol + rampStep(H, reference.vol, volIntensity) * DELIVERED_GROWTH_FACTOR;
      let excess = Math.max(0, sumKm(days) - limit);
      const maxQualityKm = maxOf(days.filter((day) => day.session).map(kmOf));
      const softDays = days.filter((day): day is RunningDay => hasKm(day) && !day.session);
      const floorFor = (day: RunningDay): number =>
        (day.tag === 'lr' && !day.mlr) || (day.tag === 'rw' && slots[day.dow] === 'lr')
          ? Math.max(perRunFloor(limit, runDays), r1(maxQualityKm * 1.05))
          : perRunFloor(limit, runDays);
      const slack = softDays.reduce((n, day) => n + Math.max(0, day.km - floorFor(day)), 0);
      const reduction = slack > 0 ? Math.min(1, excess / slack) : 0;
      // Preserve the easy/LR balance. Cutting the only easy day first starves
      // the LR share denominator and causes a repeated downward feedback loop.
      for (const day of softDays) {
        day.km = r1(
          Math.max(floorFor(day), day.km - Math.max(0, day.km - floorFor(day)) * reduction)
        );
        renameKm(day);
      }
      excess = Math.max(0, sumKm(days) - limit);
      // A new workout family can exceed the limit even after easy days reach
      // their floors. Remove optional easy padding before cutting LR exposure.
      for (const day of days) {
        if (excess <= 0.05) break;
        if (!day.session) continue;
        const s = day.session;
        for (const [key, minimum] of [
          ['cdKm', 0.8],
          ['wuKm', 1]
        ] as const) {
          const take = Math.min(Math.max(0, s[key] - minimum), excess);
          s[key] = r1(s[key] - take);
          excess -= take;
        }
        day.km = sessKm(s);
        day.desc = sessDesc(s);
      }
      const mainLR = days.find(
        (d) => (d.tag === 'lr' && !d.mlr) || (d.tag === 'rw' && slots[d.dow] === 'lr')
      );
      if (mainLR && hasKm(mainLR) && excess > 0.05) {
        const maxQ = maxOf(days.filter((d) => d.session).map(kmOf));
        mainLR.km = r1(Math.max(perRunFloor(vol, runDays), maxQ * 1.05, mainLR.km - excess));
        renameKm(mainLR);
      }
    }
    finalizeWeek(days, w);
    plan.weeks.push({
      w,
      vol: r1(sumKm(days)),
      days,
      deload: isDeload,
      focus: weekFocus(days, { isDeload, isTaper1, isTaper2, isRace, isBase: w <= baseWeeks }),
      ...(isTaper1 || isTaper2 ? { taper: true as const } : {})
    });

    /* ---------------------------------------------------------- trkačka nedelja */
    function buildRaceWeek(): void {
      const rp = racePace;
      const distKm = (raceDistM / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',');
      /* Dani trkačke nedelje prate obim, uz apsolutni minimum da shakeout ostane shakeout. */
      const shakeA = r1(Math.max(1.5, Math.min(3, vol * 0.22)));
      const shakeB = r1(Math.max(1, Math.min(2, vol * 0.15)));
      const activationWu = r1(Math.max(1, Math.min(1.5, vol * 0.11)));
      const activationCd = r1(Math.max(0.8, Math.min(1, vol * 0.08)));
      const activationN = 6;
      const activationPace = Math.max(rp - 4, pI - 6);
      /* PROTOKOL PRED TRKU SE VODI PO POMERAJU OD DANA TRKE, ne po danu u nedelji: dani
         −3/−2/−1 idu tamo gde po KALENDARU i padaju — u prethodnu (taper) nedelju kad treba. */
      const proto: Record<string, (dw: number) => Day> = {
        '-3': (dw) => D.easy(dw, shakeA, `${shakeA} km shakeout (skroz lagano) + lagani core`),
        '-2': (dw) => {
          const s = sessInt(
            dw,
            activationWu,
            activationN,
            200,
            activationPace,
            120,
            activationCd,
            'Aktivacija',
            'activation'
          );
          s.session.notes =
            'Kratka aktivacija približno na ritmu trke, bez sprinta; oporavak 120 s hoda.';
          s.desc = sessDesc(s.session);
          return s;
        },
        '-1': (dw) => D.easy(dw, shakeB, `${shakeB} km shakeout + lagana mobilnost`),
        '0': (dw) =>
          D.race(
            dw,
            raceDistM / 1000,
            `🏁 TRKA ${distKm} km (${prof.product.name}) — ${inp.goalSec ? `željeni cilj ${fmtClock(inp.goalSec)} · ` : ''}preporučeni ritam ${fmtClock(rp)}/km (oko ${fmtClock(Math.round((rp * raceDistM) / 1000))}, prema unetom rezultatu${inp.goalSec && inp.goalSec >= currentRaceSec ? ' i izabranom cilju' : ''})`
          )
      };
      const activationFactory = proto['-2'];
      const preparation: number[] = [];
      let nextRun = 0;
      for (let off = -1; off >= -6; off--) {
        const dw = ((raceDow + off - 1 + 7) % 7) + 1;
        if (slots[dw] === 'rest' || (runDays < 5 && nextRun - off < 2)) continue;
        if (preparation.length >= Math.min(3, runDays - 1)) break;
        preparation.push(off);
        nextRun = off;
      }
      const activationOffset = trainedRecently
        ? preparation.find((off) => off <= -2 && off !== -3)
        : undefined;
      for (let off = -6; off <= -1; off++) {
        proto[String(off)] = !preparation.includes(off)
          ? (dw) => REST(dw)
          : off === activationOffset && activationFactory
            ? activationFactory
            : (dw) => D.easy(dw, shakeA, `${shakeA} km shakeout @ ~${fmtClock(pE)}/km`);
      }
      for (let dw = 1; dw <= raceDow; dw++) {
        const mk = proto[String(dw - raceDow)];
        days.push(mk ? mk(dw) : REST(dw));
      }
      const activation = days.find((d): d is SessionDay => d.dow === raceDow - 2 && !!d.session);
      /* AKTIVACIJA SE NE MERI: red joj treba (tempo se prikazuje i sme da se unese), ali se iz
         nje ne sme izvoditi forma — propis je tempo TRKE a vodi se kao Repeticije. */
      if (activation) pushPredQs(activation, w, true);
      /* Dani protokola koji ne staju u trkačku nedelju upisuju se u PRETHODNU; dan koji se time
         gubi povlači i svoj PRED red i qs ključ. */
      let overwroteLongRun = false;
      for (let off = -6; off <= -1; off++) {
        const dw = raceDow + off;
        if (dw >= 1 || !plan.weeks.length) continue;
        const pw = at(plan.weeks, plan.weeks.length - 1);
        const target = dw + 7;
        const i = pw.days.findIndex((x) => x.dow === target);
        if (i < 0) continue;
        const old = at(pw.days, i);
        if (old.tag === 'lr' && !old.mlr) overwroteLongRun = true;
        delete plan.qs[`n${pw.w}d${target}`];
        if (old.session) {
          const j = plan.pred.findIndex(
            (pr) => pr.w === pw.w && pr.l === `N${pw.w} · ${old.session?.kind}`
          );
          if (j >= 0) plan.pred.splice(j, 1);
        }
        const mk = proto[String(off)];
        if (!mk) continue;
        const repl = mk(target);
        pw.days[i] = repl;
        /* `nemeri` i OVDE: jedina sesija koja ide kroz `proto[-2]` je aktivacija. */
        if (repl.session) pushPredQs(repl, pw.w, off === -2);
        pw.vol = r1(sumKm(pw.days));
      }
      /* Ako je protokol pregazio samo dugo trčanje, srednje-dugo ostaje jedini „dugi" dan — a to
         više nije drugo duže trčanje nego običan lagan dan. */
      if (overwroteLongRun && plan.weeks.length) {
        const pw = at(plan.weeks, plan.weeks.length - 1);
        if (!pw.days.some((d) => (d.tag === 'lr' && !d.mlr) || d.tag === 'rw')) {
          pw.days = pw.days.map((d) =>
            d.tag === 'lr' && d.mlr ? D.easy(d.dow, d.km, `${d.km} km lako (Z2)`) : d
          );
        }
      }
    }

    /* ------------------------------------------------------------ bazna nedelja */
    function buildBaseWeek(): void {
      const mlrShare = wantMLR && mlrCfg ? mlrCfg.share : 0;
      const lrCapBase = (): number => longRunTarget.km;
      const alloc = clampLongRun(
        allocEasyLongRun(vol, [], runDays - 1, runDays, pLR, lrCapBase, mlrShare, independentLR),
        []
      );
      let ei = 0;
      for (let dow = 1; dow <= 7; dow++) {
        const role = slots[dow];
        if (role === 'rest') {
          days.push(
            dow === strengthDow
              ? D.strength(dow, 'Mobilnost + snaga po sopstvenom programu — opciono (bez trčanja)')
              : REST(dow)
          );
          continue;
        }
        if (role === 'lr') {
          const rwLR = rwFor(w);
          if (rwLR) {
            days.push(
              D.runWalk(
                dow,
                alloc.lr,
                `${alloc.lr} km — ${runWalkText(rwLR)}, najduže trčanje te nedelje`,
                rwLR
              )
            );
          } else {
            days.push(
              D.longRun(
                dow,
                alloc.lr,
                `${alloc.lr} km lako-dugo (Z2) @ ~${fmtClock(pLR)}/km — bazna faza, bez kvaliteta${fuelText(alloc.lr, pLR, H)}${easyNote}${w === transitionW ? transitionNote : ''}`
              )
            );
          }
          continue;
        }
        if (role === 'mlr' && (alloc.mlr ?? 0) > 0 && !rwFor(w)) {
          const m = D.longRun(
            dow,
            alloc.mlr as number,
            `${alloc.mlr} km srednje-dugo (Z2) @ ~${fmtClock(pLR)}/km — drugo duže trčanje u nedelji${easyNote}`
          );
          m.mlr = true;
          days.push(m);
          continue;
        }
        /* strides na svakom drugom lakom danu tokom baze (Daniels: strides kroz sve faze) */
        let km = alloc.easies[ei] != null ? (alloc.easies[ei] as number) : 4;
        km = capAfterLongRun(dow, km);
        const rw = rwFor(w);
        if (rw) {
          /* Početnik: lagani dan je run/walk; strides se NE dodaju. */
          days.push(D.runWalk(dow, km, `${km} km — ${runWalkText(rw)}`, rw));
        } else {
          /* Neproverena forma i probni prelaz: bez ubrzanja dok se ne potvrdi da lagan rad prolazi. */
          const strides =
            ei % 2 === 0 && !effortFirst && w !== transitionW
              ? ' + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)'
              : '';
          days.push(
            D.easy(
              dow,
              km,
              `${km} km lako (Z2) @ ~${fmtClock(pE)}/km${strides}${easyNote}${w === transitionW ? transitionNote : ''}`
            )
          );
        }
        ei++;
      }
    }

    /** Lak dan posle zahtevne duge (iste ili prethodne nedelje) je kraći; višak ide na lake dane
     *  koji nisu uz dugu, do plafona lakog dana. U taperu se višak ne vraća (taper skida obim). */
    function limitEasyAfterLongRun(): void {
      const rule = H.easyAfterLongRun;
      if (!rule) return;
      const isMainLR = (d: Day): boolean => d.tag === 'lr' && !d.mlr;
      const lrHere = days.find(isMainLR);
      const prevW = plan.weeks.length ? at(plan.weeks, plan.weeks.length - 1) : null;
      const prevSundayLR = prevW?.days.find((d) => d.dow === 7 && isMainLR(d));
      const pairs: { lrKm: number; dow: number }[] = [];
      if (lrHere && lrHere.dow < 7) pairs.push({ lrKm: kmOf(lrHere), dow: lrHere.dow + 1 });
      if (prevSundayLR) pairs.push({ lrKm: kmOf(prevSundayLR), dow: 1 });
      const neighbours = new Set(
        lrHere ? [lrHere.dow - 1, lrHere.dow + 1].concat(lrHere.dow === 7 ? [1] : []) : []
      );
      const lrKm = lrHere ? kmOf(lrHere) : 0;
      for (const pair of pairs) {
        if ((pair.lrKm * pLR) / 60 < rule.demandingMin) continue;
        const day = days.find((d): d is EasyRunDay => d.dow === pair.dow && d.tag === 'lako');
        if (!day) continue;
        const cap = Math.max(
          perRunFloor(vol, runDays),
          Math.floor(Math.min(pair.lrKm * rule.maxShare, (rule.maxMin * 60) / pE) * 10) / 10
        );
        let excess = r1(day.km - cap);
        if (excess <= 0.05) continue;
        day.km = cap;
        renameKm(day);
        if (isTaper1 || isTaper2) continue;
        const ceiling = Math.min(14, r1(lrKm * 0.8));
        const others = days.filter(
          (d): d is EasyRunDay =>
            d.tag === 'lako' &&
            d !== day &&
            !neighbours.has(d.dow) &&
            !pairs.some((p) => p.dow === d.dow)
        );
        for (const other of others) {
          const add = Math.min(excess, Math.max(0, ceiling - other.km));
          if (add <= 0.05) continue;
          other.km = r1(other.km + add);
          renameKm(other);
          excess = r1(excess - add);
        }
      }
    }

    /** Među-nedeljno susedstvo: lak dan odmah posle LR-a prethodne nedelje ne sme biti skoro isti kao LR. */
    function capAfterLongRun(dow: number, km: number): number {
      if (dow === 1 && slots[7] === 'lr' && plan.weeks.length > 0) {
        const prevW = at(plan.weeks, plan.weeks.length - 1);
        if (prevW.deload) return km;
        const prevLR = maxOf(prevW.days.filter((d) => d.tag === 'lr').map(kmOf));
        if (prevLR > 0) {
          const capKm = Math.min(14, r1(prevLR * 0.8));
          return Math.min(km, capKm);
        }
      }
      return km;
    }

    /** Ritam iz neproverene reference: napor vodi, a uslovi za zahtevniji rad stoje uz prvi kvalitet. */
    function markReferencePace(day: SessionDay): SessionDay {
      if (!effortFirst) return day;
      const s = day.session;
      s.paceBasis = 'reference';
      s.notes = [
        s.notes,
        s.notes?.includes(referenceQualityNote(s)) ? '' : referenceQualityNote(s),
        entryNoteDone ? '' : QUALITY_ENTRY_NOTE
      ]
        .filter(Boolean)
        .join(' · ');
      entryNoteDone = true;
      day.desc = sessDesc(s);
      return day;
    }

    /* -------------------------------------------------------- kvalitetna nedelja */
    function buildQualityWeek(): void {
      const qualW = w - baseWeeks; // redni broj unutar kvalitetnog ciklusa (1-indeksiran)
      /* KOLIKI OBIM SME DA DIKTIRA VELIČINU KVALITETNIH SESIJA: ciljni obim ume da bude veći od
         onoga što izabrani broj dana nosi. Prvo se napravi PROBNA raspodela sa svim lakim danima;
         njen zbir je pošten donji procenitelj. Važi za SVE četiri distance. */
      let volQ = vol;
      {
        const probeCap = (): number => longRunTarget.km;
        const probe = allocEasyLongRun(
          vol,
          [],
          Math.max(runDays - 1, 1),
          runDays,
          pLR,
          probeCap,
          wantMLR && mlrCfg ? mlrCfg.share : 0,
          independentLR
        );
        const possible = probe.lr + (probe.mlr || 0) + sum(probe.easies);
        if (possible > 0) volQ = Math.min(vol, r1(possible * 1.05));
      }
      /* „Uvodna" prva kvalitetna nedelja (samo q1, lagan tempo) ima smisla za nekoga ko ULAZI u kvalitet. */
      const recent = plan.weeks.filter((pw) => !pw.deload).slice(-3);
      const supportedKm = Math.min(
        inp.weeklyKm + Math.max(0, w - 1) * 2,
        ...(recent.length ? recent.map((pw) => pw.vol) : [inp.weeklyKm])
      );
      // Session sizing follows demonstrated delivered volume as well as the
      // target allocation, especially when availability limits the real base.
      volQ = Math.min(volQ, supportedKm + rampStep(H, supportedKm, volIntensity));
      const weeklyQ = Math.min(
        effQ,
        runDays >= 4 &&
          volQ >= QUAL2_MIN_KM &&
          supportedKm >= QUAL2_MIN_KM &&
          (athlete.qualityReadiness === 'experienced' || qualW > (isReturning ? 3 : 2))
          ? 2
          : 1
      );
      const sessions: Record<number, SessionDay> = {};
      const requestFor = (dow: number, slotRole: 'q1' | 'q2'): QualityRequest => ({
        qualW,
        qualWeeks,
        slotRole,
        effQ: weeklyQ,
        vol: volQ,
        pI,
        pT,
        pE,
        pR,
        isTaper1,
        ...(isTaper2 ? { taperTransition: true } : {}),
        dow,
        racePace,
        ctx: { weeks, w, taperW },
        readiness: athlete.qualityReadiness,
        qualityIntensity: inp.intensity,
        consistentWeeks: athlete.consistentWeeks
      });
      for (let dow = 1; dow <= 7; dow++) {
        const role = slots[dow];
        if (role !== 'q1' && role !== 'q2') continue;
        if (role === 'q2' && weeklyQ < 2) continue;
        /* DELOAD: jedna kratka oštrina umesto potpunog brisanja kvaliteta; samo q1. */
        if (isDeload) {
          if (role === 'q1') {
            const previous = plan.weeks
              .flatMap((week) => week.days)
              .filter((day): day is SessionDay => !!day.session)
              .at(-1);
            const reduced = previous ? reducedQualityForDeload(previous, dow) : null;
            if (reduced) sessions[dow] = markReferencePace(reduced);
          }
          continue;
        }
        sessions[dow] = markReferencePace(prof.buildQuality(requestFor(dow, role)));
      }
      const sessionList = (): SessionDay[] => Object.values(sessions);
      /* MLR se broji među „lagane" dane jer se hrani iz istog ostatka. */
      let easyDowsCount = [1, 2, 3, 4, 5, 6, 7].filter((d) => {
        const role = slots[d];
        return (
          role === 'easy' || role === 'mlr' || ((role === 'q1' || role === 'q2') && !sessions[d])
        );
      }).length;

      const mlrShareQ = wantMLR && mlrCfg ? mlrCfg.share : 0;
      /* CIKLUS DUGOG TRČANJA (samo maraton): dugo trčanje ima SOPSTVEN talas. */
      const lrF = prof.longRunCycle
        ? prof.longRunCycle(w, { weeks, baseWeeks, taperW, isDeload })
        : 1;
      const lrCapW = (): number => longRunTarget.km;
      const allocFor = (): Allocation =>
        allocEasyLongRun(
          vol,
          sessionList().map(kmOf),
          easyDowsCount,
          runDays,
          pLR,
          lrCapW,
          mlrShareQ,
          independentLR
        );
      let alloc = allocFor();
      let replacedSecond = false;
      const hasTrial = sessionList().some((d) => d.session.kind === 'Kontrolna trka');
      const finishCandidate =
        !isTaper1 &&
        !isTaper2 &&
        !isDeload &&
        !hasTrial &&
        athlete.qualityReadiness === 'experienced' &&
        inp.intensity !== 'kons' &&
        prof.longRunFinish?.(
          prof.phase(qualW, qualWeeks),
          qualW,
          alloc.lr,
          racePace,
          prof.paceStrategy?.(racePace) ?? null,
          lrF
        );
      /* Profil može da zadrži jedan kvalitet uz zahtevnu dugu (HM prvi polumaraton na ≤ 4 dana). */
      const singleQuality =
        !finishCandidate &&
        !isTaper1 &&
        !isTaper2 &&
        !isDeload &&
        !hasTrial &&
        !!prof.singleQualityWeek?.({
          readiness: athlete.qualityReadiness,
          runDays,
          longRunMin: (alloc.lr * pLR) / 60
        });
      if ((finishCandidate || hasTrial || singleQuality) && sessionList().length > 1) {
        const second = Object.keys(sessions)
          .map(Number)
          .find((dow) => slots[dow] === 'q2');
        if (second != null) {
          delete sessions[second];
          easyDowsCount++;
          const first = Object.keys(sessions)
            .map(Number)
            .find((dow) => slots[dow] === 'q1');
          if (first != null && (finishCandidate || singleQuality)) {
            replacedSecond = true;
            sessions[first] = markReferencePace(
              prof.buildQuality({
                ...requestFor(first, 'q1'),
                replacesSecondQuality: true,
                ...(finishCandidate ? { lrFinish: true } : {})
              })
            );
          }
          alloc = allocFor();
        }
      }

      /* Jedini kvalitet uz brz završetak duge: profil zna da je duga već dan tempa trke. */
      if (finishCandidate && !replacedSecond && sessionList().length === 1) {
        const only = Number(Object.keys(sessions)[0]);
        const role = slots[only] === 'q2' ? 'q2' : 'q1';
        sessions[only] = prof.buildQuality({ ...requestFor(only, role), lrFinish: true });
        alloc = allocFor();
      }

      /* NEDELJNI OBUHVAT BRZOG RADA: brz završetak dugog trčanja i zahtevna dužina ulaze u
         isti nedeljni zbir kao kvalitetni dani. Višak se skida prvo sa opšteg (T/I/R) rada,
         pa tek onda sa specifičnog; sesija koja ne može da zadrži smislenu dozu postaje lak
         dan. Taper, deload i kontrolna trka imaju svoja pravila i ostaju nepromenjeni. */
      if (!isTaper1 && !isTaper2 && !isDeload && !hasTrial) {
        const envelope = weeklyFastEnvelopeSec({
          readiness: athlete.qualityReadiness,
          // Same realistic week as session sizing, not the unconstrained target.
          volKm: volQ,
          easyPaceSec: pE,
          longRunKm: alloc.lr,
          longRunPaceSec: pLR,
          share: prof.weeklyFastShare?.(athlete.qualityReadiness)
        });
        const finishSec = finishLoadSec(finishCandidate || null);
        const specific = (d: SessionDay): number =>
          prof.trimPriority?.(d) ?? (d.session.zone === 'RP' || d.session.zone === 'M' ? 1 : 0);
        const order = Object.keys(sessions)
          .map(Number)
          .sort(
            (x, y) =>
              specific(sessions[x] as SessionDay) - specific(sessions[y] as SessionDay) ||
              sessionLoadSec(sessions[y] as SessionDay) - sessionLoadSec(sessions[x] as SessionDay)
          );
        let trimmed = false;
        for (const dow of order) {
          const excess = finishSec + sum(sessionList().map(sessionLoadSec)) - envelope;
          if (excess <= 1) break;
          const own = sessions[dow] as SessionDay;
          const weight = own.session.zone === 'M' ? 0.5 : 1;
          const allowedLoad = sessionLoadSec(own) - excess;
          const role = slots[dow] === 'q2' ? 'q2' : 'q1';
          const rebuilt =
            allowedLoad > 0
              ? prof.buildQuality({
                  ...requestFor(dow, role),
                  ...(role === 'q1' && replacedSecond ? { replacesSecondQuality: true } : {}),
                  ...(finishCandidate && (replacedSecond || sessionList().length === 1)
                    ? { lrFinish: true }
                    : {}),
                  maxWorkSec: allowedLoad / weight
                })
              : null;
          if (
            !rebuilt ||
            sessionLoadSec(rebuilt) > allowedLoad + 1 ||
            sessQKm(rebuilt.session) < 0.4
          ) {
            delete sessions[dow];
            easyDowsCount++;
          } else sessions[dow] = rebuilt;
          trimmed = true;
        }
        if (trimmed) alloc = allocFor();
      }

      /* PRODUŽENO ZAGREVANJE/SMIRIVANJE kad nedelja podbacuje ciljni obim: raspodela se stvarno
         izvrši, izmeri se pravi manjak, WU/CD se prošire i raspodela ponovi (dva prolaza). U
         TAPER nedelji se ovo NE radi (taper skida količinu; manjak je namera). */
      if (!isTaper1) {
        const side = sessionList().filter(
          (d) => d.session.type !== 'prog' && d.session.wuKm != null && d.session.cdKm != null
        );
        if (side.length) {
          const total = (): number =>
            sumKm(sessionList()) + alloc.lr + (alloc.mlr || 0) + sum(alloc.easies);
          const maxAdd = H.wuCdMaxExtraKm;
          const base = side.map((d) => ({ d, wu: d.session.wuKm, cd: d.session.cdKm }));
          for (let pass = 0; pass < 2; pass++) {
            const shortfall = vol - total();
            if (shortfall <= 1) break;
            const step = shortfall / (side.length * 2);
            let moved = false;
            base.forEach((b) => {
              const s = b.d.session;
              // Easy padding must not force the independently progressed LR upward.
              const spare = Math.max(0, longRunTarget.km / 1.05 - b.d.km);
              const add = Math.min(step, spare / 2);
              /* nikad ne SMANJUJE postojeći WU/CD — samo raste, do osnova+maxAdd */
              const nw = Math.max(s.wuKm, r1(Math.min(b.wu + maxAdd, s.wuKm + add)));
              const nc = Math.max(s.cdKm, r1(Math.min(b.cd + maxAdd, s.cdKm + add)));
              if (nw > s.wuKm || nc > s.cdKm) {
                s.wuKm = nw;
                s.cdKm = nc;
                b.d.km = sessKm(s);
                b.d.desc = sessDesc(s);
                moved = true;
              }
            });
            if (!moved) break; // već na plafonu
            alloc = allocFor();
          }
        }
      }
      /* TAPER SKRAĆUJE I DUGO TRČANJE, ne samo kvalitet: LR na ~60–70% vrhunca, MLR ~55% LR-a. */
      if ((isTaper1 || isTaper2) && plan.weeks.length && H.taperLongRunFactor) {
        const peakLR = Math.max(
          ...plan.weeks.map((pw) =>
            Math.max(...pw.days.filter((d) => d.tag === 'lr' || d.tag === 'rw').map(kmOf), 0)
          ),
          0
        );
        /* Prva taper nedelja skida blaže (85%), poslednja do kraja. */
        const f = isTaper1 ? H.taperLongRunFactor : 0.85;
        if (peakLR > 0) alloc.lr = r1(Math.min(alloc.lr, peakLR * f));
        /* Invarijanta: dugo trčanje ostaje najduže trčanje nedelje. */
        const maxQt = Math.max(...sessionList().map(kmOf), 0);
        if (maxQt > 0) alloc.lr = r1(Math.max(alloc.lr, maxQt * 1.05));
        /* Lagani dani prate skraćeni LR nanize. */
        alloc.easies = alloc.easies.map((e) => Math.min(e, r1(alloc.lr * 0.8)));
        if ((alloc.mlr ?? 0) > 0) alloc.mlr = r1(Math.min(alloc.mlr as number, alloc.lr * 0.55));
      }
      clampLongRun(alloc, sessionList().map(kmOf));
      let ei = 0;
      for (let dow = 1; dow <= 7; dow++) {
        const role = slots[dow];
        if (role === 'rest') {
          days.push(
            dow === strengthDow
              ? D.strength(dow, 'Mobilnost + snaga po sopstvenom programu — opciono (bez trčanja)')
              : REST(dow)
          );
          continue;
        }
        if (role === 'lr') {
          const rwL = rwFor(w);
          if (rwL) {
            /* Dugo trčanje MORA ostati run/walk dok je čovek na lestvici. */
            days.push(
              D.runWalk(
                dow,
                alloc.lr,
                `${alloc.lr} km — ${runWalkText(rwL)}, najduže trčanje te nedelje`,
                rwL
              )
            );
          } else {
            const finish =
              !isTaper1 &&
              !isTaper2 &&
              !isDeload &&
              !hasTrial &&
              athlete.qualityReadiness === 'experienced' &&
              inp.intensity !== 'kons' &&
              prof.longRunFinish
                ? prof.longRunFinish(
                    prof.phase(Math.max(w - baseWeeks, 1), weeks - baseWeeks),
                    Math.max(w - baseWeeks, 1),
                    alloc.lr,
                    racePace,
                    prof.paceStrategy ? prof.paceStrategy(racePace) : null,
                    prof.longRunCycle
                      ? prof.longRunCycle(w, { weeks, baseWeeks, taperW, isDeload })
                      : null
                  )
                : null;
            const longDay = D.longRun(
              dow,
              alloc.lr,
              `${alloc.lr} km LR (Z2) @ ~${fmtClock(pLR)}/km — najduže trčanje te nedelje${fuelText(alloc.lr, pLR, H)}${finish ? ` · poslednjih ${finish.km} km @ ${fmtClock(finish.paceSec)}/km (${finish.zone === 'M' ? 'maratonski' : 'tempo trke'})` : ''}${easyNote}${w === transitionW && !finish ? transitionNote : ''}`
            );
            if (finish) longDay.finish = finish;
            days.push(longDay);
          }
          continue;
        }
        /* SREDNJE-DUGO TRČANJE: Z2, bez radnog dela, gradi izdržljivost bez umora dugog trčanja. */
        if (role === 'mlr' && (alloc.mlr ?? 0) > 0) {
          const m = D.longRun(
            dow,
            alloc.mlr as number,
            `${alloc.mlr} km srednje-dugo (Z2) @ ~${fmtClock(pLR)}/km — drugo duže trčanje u nedelji, gradi izdržljivost bez umora dugog trčanja${easyNote}`
          );
          m.mlr = true;
          days.push(m);
          continue;
        }
        const sess = sessions[dow];
        if (sess) {
          days.push(sess);
          pushPredQs(sess, w);
          continue;
        }
        let km = alloc.easies[ei] != null ? (alloc.easies[ei] as number) : 4;
        km = capAfterLongRun(dow, km);
        /* Strides na prvom lakom danu SVAKE kval. nedelje; izostaju u taper1; u deloadu kraći set. */
        const rwQ = rwFor(w);
        if (rwQ) {
          /* Početnik i u kvalitetnoj fazi: LAGANI dani ostaju run/walk dok lestvica ne dođe do neprekidnog. */
          days.push(D.runWalk(dow, km, `${km} km — ${runWalkText(rwQ)}`, rwQ));
        } else {
          const strides =
            isTaper1 || w === transitionW
              ? ''
              : ei === 0
                ? isDeload
                  ? ' + 4×15 s ubrzanja (lagani ubrzani koraci)'
                  : ' + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)'
                : '';
          days.push(
            D.easy(
              dow,
              km,
              `${km} km lako (Z2) @ ~${fmtClock(pE)}/km${strides}${easyNote}${w === transitionW ? transitionNote : ''}`
            )
          );
        }
        ei++;
      }
    }
  }

  /* PROVERA STVARNO ISPORUČENOG OBIMA: da li PRVA puna nedelja odgovara onome što korisnik već trči. */
  {
    const first = plan.weeks.filter((wk) => !wk.deload && wk.w <= 3);
    if (first.length && inp.weeklyKm) {
      const actual = sumKm(at(first, 0).days);
      const shortfall = 1 - actual / inp.weeklyKm;
      if (shortfall > FIRST_WEEK_SHORTFALL_WARN) {
        const actualQuality = at(first, 0).days.filter((day) => day.session).length;
        const suggestion =
          ' Prva nedelja ima ' +
          actualQuality +
          ' kvalitetnih treninga. ' +
          'Početna ponovljiva dužina i raspored ograničavaju raspodelu obima. ' +
          'Proveri prijavljeni nedeljni obim i ponovljivu dužinu; dodatni dan može pomoći raspodeli, ali ne zamenjuje postojeću bazu.';
        dayWarnings.push(
          'Tražio si ' +
            inp.weeklyKm +
            ' km/ned, a plan prve nedelje daje oko ' +
            actual.toFixed(0) +
            ' km.' +
            suggestion
        );
      }
    }
  }

  /* STRUKTURNI PLAFON — meren iz sastavljenog plana: koliko plan STVARNO može da isporuči na
     izabranom broju dana, i TAČAN broj dana koji bi trebao (ponovnim generisanjem). */
  if (!inp._noSuggest && inp.weeklyKm > 0) {
    const working = plan.weeks.filter((wk, i) => !wk.deload && i < plan.weeks.length - 2);
    const pik = working.length ? Math.max(...working.map((wk) => sumKm(wk.days))) : 0;
    if (pik > 0 && pik < inp.weeklyKm * STRUCTURAL_CEILING_RATIO) {
      let neededDays: number | null = null;
      for (let d = runDays + 1; d <= 7; d++) {
        const probe = generatePlan({ ...inp, runDays: d, _noSuggest: true });
        if ('error' in probe || !probe.weeks) continue;
        const r2 = probe.weeks.filter((wk, i) => !wk.deload && i < probe.weeks.length - 2);
        const p2 = r2.length ? Math.max(...r2.map((wk) => sumKm(wk.days))) : 0;
        if (p2 >= inp.weeklyKm * STRUCTURAL_CEILING_RATIO) {
          neededDays = d;
          break;
        }
      }
      dayWarnings.push(
        'Na ' +
          runDays +
          ' dana trčanja plan realno dostiže oko ' +
          pik.toFixed(0) +
          ' km/ned — manje od traženih ' +
          inp.weeklyKm +
          ' km. Razlog: dugo trčanje i lagani dani imaju ' +
          'bezbednosne granice, pa se veći obim ne može rasporediti na tako malo dana.' +
          (neededDays
            ? ' Za ' + inp.weeklyKm + ' km trebalo bi ti ' + neededDays + ' dana trčanja.'
            : ' Ni na 7 dana ne staje — za toliki obim verovatno trebaju dupli treninzi.')
      );
    }

    /* BAZA ZA CILJNU DISTANCU: rast je namerno postupan, ali ko krene sa vrlo niskom bazom neće
       stići do obima koji distanca traži. Ne blokira se; mora da se kaže naglas. */
    const minPeak = prof.product.minPeakKm;
    if (minPeak && pik > 0 && pik < minPeak * 0.85) {
      dayWarnings.push(
        'Vrhunac plana je oko ' +
          pik.toFixed(0) +
          ' km/ned, a za ' +
          distUReceni(prof.product.name) +
          ' se orijentaciono računa sa ~' +
          minPeak +
          ' km/ned. Rast je namerno postupan (od tvojih ' +
          inp.weeklyKm +
          ' km/ned). Ovaj obim sam po sebi ne potvrđuje spremnost da završiš distancu niti da ostvariš vremenski cilj. ' +
          'Za pun pristup trebalo bi ti više nedelja ili viša polazna baza.'
      );
    }
  }

  /* Protokol trke menja već sastavljenu taper nedelju: proveri je ponovo pre filtriranja.
     Delimična početna nedelja nije nova puna nedelja i ne podleže novom LR udelu. */
  for (const wk of plan.weeks) {
    finalizeWeek(wk.days, wk.w);
    wk.vol = r1(sumKm(wk.days));
  }

  /* Filtriraj dane PRE datuma generisanja iz nedelje 1 (samo ona može imati dane pre `startDate`);
     uklonjeni dani povlače i svoj PRED red i qs ključ. */
  if (plan.weeks.length) {
    const w1 = at(plan.weeks, 0);
    const keep = (d: Day): boolean => addDays(start, d.dow - 1) >= startDate;
    const removed = w1.days.filter((d) => !keep(d));
    w1.days = w1.days.filter(keep);
    w1.vol = r1(sumKm(w1.days));
    removed.forEach((d) => {
      delete plan.qs[`n${w1.w}d${d.dow}`];
      if (!d.session) return;
      const i = plan.pred.findIndex((p) => p.w === w1.w && p.l === `N${w1.w} · ${d.session?.kind}`);
      if (i >= 0) plan.pred.splice(i, 1);
    });
  }
  plan.pred = [];
  plan.qs = {};
  for (const wk of plan.weeks) {
    constrainWeek(wk.days, H.tempoMaxSec, paceForZone(a.vdot0, 'E'));
    wk.vol = r1(sumKm(wk.days));
    for (const day of wk.days) {
      if (day.session) pushPredQs(day, wk.w, wk.w === weeks || day.session.kind === 'Oštrina');
      const strides = /([0-9]+)×([0-9]+) s ubrzanja/.exec(day.desc || '');
      if (strides && day.tag === 'lako')
        day.strides = {
          reps: Number(strides[1]),
          runSec: Number(strides[2]),
          restSec: 60,
          paceSec: paceForZone(a.vdot0, 'R')
        };
    }
    if (wk.w !== weeks)
      wk.focus = weekFocus(wk.days, {
        isDeload: wk.deload,
        isTaper1: !!wk.taper,
        isTaper2: false,
        isRace: false,
        isBase: wk.w <= baseWeeks
      });
  }
  meta.preparation = assessPreparation(plan, prof.product.minPeakKm);
  dayWarnings.push(...meta.preparation.reasons);
  if (meta.preparation.endurance !== 'supported' || athlete.speedConfidence !== 'recent-result') {
    for (const day of plan.weeks.flatMap((week) => week.days)) {
      if (day.tag === 'trka')
        day.desc +=
          ' · Spremnost nije potvrđena: ovaj ritam je referenca iz rezultata, ne potvrda završetka distance ili ostvarenja cilja.';
    }
  }
  return plan;
}

/** Opciono celobrojno polje: ono što nije konačan, nenulti broj postaje podrazumevana vrednost (ne NaN). */
function softInt(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v !== 0 ? Math.round(v) : fallback;
}

/** `arr[i]` za indeks koji je po konstrukciji validan; baca ako to nije tačno (ne tiho NaN). */
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined)
    throw new RangeError(`generatePlan: indeks ${i} van niza dužine ${arr.length}`);
  return v;
}
