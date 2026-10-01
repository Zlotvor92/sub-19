/* ============================================================
   GENERATOR PLANA — mašina.

   `generatePlan` zna kalendar, raspored deload/taper nedelja, raspodelu po
   danima, izravnavanje rasta i upozorenja. Ne zna nijedan broj specifičan za
   distancu: sve takve odluke čita iz profila (`distances/`).

   KORAK A (port bez promene ponašanja): isti redosled operacija i zaokruživanja
   kao stari `generatePlan`; izlaz mora da prođe golden-master otisak
   (test/fixtures/otisak-generatora.json). Rationale za pojedine odluke:
   docs/TRAINING_ENGINE_AUDIT.md.
   ============================================================ */

import { addDays, diffDays, mondayOnOrBefore, parseIsoDate } from '../../date';
import { brojNedelja, distUReceni, fmtClock, r1 } from '../../format';
import { DELIVERED_GROWTH_FACTOR, DELOAD_EVERY, RAMP_CAP_WEEKS } from '../constants/heuristics';
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
import type { DistanceProfile } from '../distances/types';
import { predRow, qsFor } from '../prediction';
import { mkDeloadSharpness, sessInt, sessTempo, wuCdForVolume } from '../sessions/build';
import { sessDesc, sessKm, sessQKm } from '../sessions/calc';
import type {
  Day,
  EasyRunDay,
  Intensity,
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
import { allocEasyLongRun, perRunFloor, type Allocation, type LongRunCapFn } from './allocation';
import { assess } from './assess';
import { buildDaySlots, dayPreferenceWarnings, pickStrengthDay } from './daySlots';
import { weekFocus } from './focus';
import { runWalkForWeek, runWalkText } from './runWalk';
import { fuelText } from './fuel';
import { longRunCap, peakVolume, rampStep } from './volume';

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
  if (!inp.pb || !(inp.pb.sec > 0) || !(inp.pb.distM > 0)) {
    return { error: 'Neispravan skorašnji rezultat (distanca i vreme moraju biti veći od nule).' };
  }
  if (!(inp.weeklyKm > 0)) return { error: 'Nedeljna kilometraža mora biti veća od nule.' };

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

  const runDays = Math.max(2, Math.min(7, Math.round(inp.runDays || DEFAULT_RUN_DAYS)));
  let qWant = Math.max(1, Math.min(2, Math.round(inp.quality || DEFAULT_QUALITY)));
  const H = prof.heuristic;
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
  const peakEstimate = peakVolume(H, cur0, ramp0, inp.intensity);
  const mlrCfg = H.midweekLong;
  const wantMLR = !!(mlrCfg && runDays >= mlrCfg.minDays && peakEstimate >= mlrCfg.minKm);
  /* Koliko kvaliteta obim UOPŠTE podnosi: dva kvalitetna u nedelji od 12 km su besmislena. */
  const qCut = qWant > 1 && peakEstimate < QUAL2_MIN_KM;
  if (qCut) qWant = 1;
  const slots = buildDaySlots(
    runDays,
    qWant,
    { lrDow: inp.lrDow, qDows: inp.qDows, runDows: inp.runDows },
    wantMLR
  );
  const dayWarnings = dayPreferenceWarnings(slots);
  const effQ = Object.values(slots).filter((r) => r === 'q1' || r === 'q2').length;
  const a = assess(inp.pb, weeks, inp.intensity, inp.goalSec || null, raceDistM);

  /* NEREALAN CILJ SE MORA IZGOVORITI: racePace se računa IZ CILJA, ne iz predviđanja. */
  if (inp.goalSec && a.realno === false) {
    const ORDER: ReadonlyArray<readonly [Intensity, string]> = [
      ['kons', 'Konzervativno'],
      ['std', 'Standardno'],
      ['agr', 'Agresivno']
    ];
    const reaches = ORDER.find(
      ([k]) => assess(inp.pb, weeks, k, inp.goalSec ?? null, raceDistM).realno
    );
    const chosenName = (ORDER.find(([k]) => k === inp.intensity) ?? [null, 'izabranom'])[1];
    dayWarnings.push(
      'Ciljno vreme ' +
        fmtClock(inp.goalSec) +
        ' je iznad onoga što ovaj plan realno donosi — ' +
        'na tempu napretka „' +
        chosenName +
        '" predviđanje za dan trke je ' +
        fmtClock(a.predictedSec) +
        '. ' +
        (reaches
          ? 'Tempo napretka „' + reaches[1] + '" bi ga dostigao.'
          : 'Nijedan tempo napretka ga ne dostiže za ' +
            brojNedelja(weeks) +
            ' — treba ti više vremena do trke ili blaži cilj.') +
        ' Plan i dalje računa tempo trke IZ TVOG CILJA, ne iz predviđanja, pa će kvalitetni treninzi biti brži ' +
        'nego što forma trenutno nosi. To je namerno — ali znaj da je tako.'
    );
  }

  /* ============================================================
     BAZNA FAZA — samo za one koji tek počinju (`trainedRecently === false`):
     obavezan mesec trčanja/hoda, pa konsolidacija. Ko trenira redovno nema baznu
     fazu. Koliko traje je odluka distance; ŠTA se u njoj radi je isto za sve.
     ============================================================ */
  const trainedRecently = inp.trainedRecently !== false;
  const isBeginner = !trainedRecently;
  const wantedBase = isBeginner ? prof.product.baseWeeksBeginner : 0;
  const baseWeeks = wantedBase
    ? Math.max(0, Math.min(wantedBase, weeks - prof.product.minWeeks))
    : 0;
  const rwWeeks = isBeginner ? Math.min(RUN_WALK_WEEKS, baseWeeks) : 0;

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
      'Za ' +
        distUReceni(prof.product.name) +
        ' se preporučuje bar ' +
        minRunDaysRec +
        ' dana trčanja nedeljno; izabrao si ' +
        runDays +
        '. Na tako malo dana dugo trčanje postaje ' +
        'polovina cele nedelje, pa se obim ne može rasporediti a da svaki trening ne bude dugačak. ' +
        'Plan je napravljen, ali računaj na duže oporavke i manje prostora za kvalitet.'
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
  const next = (v: number): number => Math.min(v + rampStep(H, v, inp.intensity), peakTarget);
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

  const rampWeeks = Math.min(weeks - 2, RAMP_CAP_WEEKS);
  const racePace = Math.round((inp.goalSec || a.predictedSec) / (raceDistM / 1000));
  const raceDow = daysN - (weeks - 1) * 7 + 1; // 1..7 unutar poslednje nedelje
  const meta: PlanMeta = {
    ...a,
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
    goalSec: inp.goalSec || null
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
    const row = predRow(
      w,
      ses.kind,
      sessQKm(ses),
      ses.paceSec,
      raceDistM,
      a.vdot0 + ((a.vdotGoal - a.vdot0) * Math.min(w, rampWeeks)) / rampWeeks
    );
    if (doesNotMeasure) row.nemeri = true;
    plan.pred.push(row);
    const spec = qsFor(ses);
    if (spec) plan.qs[`n${w}d${day.dow}`] = spec;
  };

  /** Plafon dugog trčanja, opciono skaliran faktorom ciklusa (maraton). */
  const lrCapFor = (factor: number | null): LongRunCapFn =>
    factor !== null && factor !== 1
      ? (v, pl) => longRunCap(H, v, pl) * factor
      : (v, pl) => longRunCap(H, v, pl);

  for (let w = 1; w <= weeks; w++) {
    const vdotW = a.vdot0 + ((a.vdotGoal - a.vdot0) * Math.min(w, rampWeeks)) / rampWeeks;
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

    if (isRace) {
      buildRaceWeek();
    } else if (w <= baseWeeks) {
      buildBaseWeek();
    } else {
      buildQualityWeek();
    }

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
      const floorKm = perRunFloor(vol, runDays);

      if (prevVol > 0 && isDeload) {
        const limit = prevVol * (H.deloadFactor || 0.73);
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
            d.km = Math.max(floorKm, r1(d.km * f));
            renameKm(d);
          });
        }
      } else if (prevVol > 0) {
        /* Granica isporučenog rasta prati isti apsolutni korak (uz margin za diskretnost). */
        const limit = prevVol + rampStep(H, prevVol, inp.intensity) * DELIVERED_GROWTH_FACTOR;
        if (now > limit) {
          /* I SREDNJE-DUGO učestvuje (Z2 dan bez radnog dela); dugo trčanje se NE dira. */
          const easy = days.filter(
            (d): d is EasyRunDay | RunWalkDay | LongRunDay =>
              hasKm(d) &&
              (d.tag === 'lako' || d.tag === 'rw' || (d.tag === 'lr' && !!d.mlr)) &&
              d.km > floorKm
          );
          let excess = now - limit;
          /* skraćuje od NAJDUŽEG laganog dana nanize — ravnomernije nego redom */
          easy.sort((x, y) => y.km - x.km);
          for (const d of easy) {
            if (excess <= 0.05) break;
            /* Plafon od 30% SOPSTVENE vrednosti dana: jedini lak dan ne sme izgubiti 70%. */
            const can = Math.min(d.km - floorKm, d.km * 0.3);
            const take = Math.min(can, excess);
            if (take > 0) {
              const nova = Math.max(floorKm, r1(d.km - take));
              excess -= d.km - nova;
              d.km = nova;
              renameKm(d);
            }
          }
        }
      }
    }
    /* TAPER SE MERI PREMA STVARNO ISPORUČENOM VRHUNCU, ne prema ciljnom. Klamp SAMO SEČE. */
    if ((isTaper1 || isTaper2) && plan.weeks.length) {
      const pik = Math.max(...plan.weeks.map((pw) => sumKm(pw.days)), 0);
      const limit = pik * (isTaper1 ? H.taperFactor : H.firstTaperFactor || 0.82);
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
      }
    }
    plan.weeks.push({
      w,
      vol: r1(sumKm(days)),
      days,
      deload: isDeload,
      focus: weekFocus(days, { isDeload, isTaper1, isTaper2, isRace, isBase: w <= baseWeeks })
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
            'Repeticije'
          );
          s.desc += ' — aktivacija';
          return s;
        },
        '-1': (dw) => D.easy(dw, shakeB, `${shakeB} km shakeout + lagana mobilnost`),
        '0': (dw) =>
          D.race(
            dw,
            raceDistM / 1000,
            `🏁 TRKA ${distKm} km (${prof.product.name}) — cilj ${fmtClock(inp.goalSec || a.predictedSec)} / ritam ${fmtClock(rp)}/km`
          )
      };
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
      for (let off = -3; off <= -1; off++) {
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
      /* DUGO TRČANJE U BAZI RASTE POSTEPENO (`baseLongRunStart`): baza gradi obim, ne testira maksimum. */
      const baseStart = H.baseLongRunStart;
      const bazaF =
        baseStart && baseWeeks > 0 ? baseStart + (1 - baseStart) * (w / Math.max(baseWeeks, 1)) : 1;
      const lrCapBase =
        bazaF < 1
          ? (v: number, pl: number): number => longRunCap(H, v, pl) * bazaF
          : (v: number, pl: number): number => longRunCap(H, v, pl);
      const alloc = clampLongRun(
        allocEasyLongRun(vol, [], runDays - 1, runDays, pLR, lrCapBase, mlrShare),
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
          const rwLR = runWalkForWeek(w <= rwWeeks ? w : 0);
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
                `${alloc.lr} km lako-dugo (Z2) @ ~${fmtClock(pLR)}/km — bazna faza, bez kvaliteta${fuelText(alloc.lr, pLR, H)}`
              )
            );
          }
          continue;
        }
        if (role === 'mlr' && (alloc.mlr ?? 0) > 0 && !runWalkForWeek(w <= rwWeeks ? w : 0)) {
          const m = D.longRun(
            dow,
            alloc.mlr as number,
            `${alloc.mlr} km srednje-dugo (Z2) @ ~${fmtClock(pLR)}/km — drugo duže trčanje u nedelji`
          );
          m.mlr = true;
          days.push(m);
          continue;
        }
        /* strides na svakom drugom lakom danu tokom baze (Daniels: strides kroz sve faze) */
        let km = alloc.easies[ei] != null ? (alloc.easies[ei] as number) : 4;
        km = capAfterLongRun(dow, km);
        const rw = runWalkForWeek(w <= rwWeeks ? w : 0);
        if (rw) {
          /* Početnik: lagani dan je run/walk; strides se NE dodaju. */
          days.push(D.runWalk(dow, km, `${km} km — ${runWalkText(rw)}`, rw));
        } else {
          const strides =
            ei % 2 === 0 ? ' + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)' : '';
          days.push(D.easy(dow, km, `${km} km lako (Z2) @ ~${fmtClock(pE)}/km${strides}`));
        }
        ei++;
      }
    }

    /** Među-nedeljno susedstvo: lak dan odmah posle LR-a prethodne nedelje ne sme biti skoro isti kao LR. */
    function capAfterLongRun(dow: number, km: number): number {
      if (dow === 1 && slots[7] === 'lr' && plan.weeks.length > 0) {
        const prevW = at(plan.weeks, plan.weeks.length - 1);
        const prevLR = maxOf(prevW.days.filter((d) => d.tag === 'lr').map(kmOf));
        if (prevLR > 0) {
          const capKm = Math.min(14, Math.max(r1(prevLR * 0.5), Math.min(12, r1(prevLR * 0.7))));
          return Math.min(km, capKm);
        }
      }
      return km;
    }

    /* -------------------------------------------------------- kvalitetna nedelja */
    function buildQualityWeek(): void {
      const qualW = w - baseWeeks; // redni broj unutar kvalitetnog ciklusa (1-indeksiran)
      /* KOLIKI OBIM SME DA DIKTIRA VELIČINU KVALITETNIH SESIJA: ciljni obim ume da bude veći od
         onoga što izabrani broj dana nosi. Prvo se napravi PROBNA raspodela sa svim lakim danima;
         njen zbir je pošten donji procenitelj. Važi za SVE četiri distance. */
      let volQ = vol;
      {
        const cycleF = prof.longRunCycle
          ? prof.longRunCycle(w, { weeks, baseWeeks, taperW, isDeload })
          : null;
        const probeCap = lrCapFor(cycleF);
        const probe = allocEasyLongRun(
          vol,
          [],
          Math.max(runDays - 1, 1),
          runDays,
          pLR,
          probeCap,
          wantMLR && mlrCfg ? mlrCfg.share : 0
        );
        const possible = probe.lr + (probe.mlr || 0) + sum(probe.easies);
        if (possible > 0) volQ = Math.min(vol, r1(possible * 1.05));
      }
      /* „Uvodna" prva kvalitetna nedelja (samo q1, lagan tempo) ima smisla za nekoga ko ULAZI u kvalitet. */
      const isFirstQualWeek = qualW === 1 && (baseWeeks > 0 || !trainedRecently);
      const sessions: Record<number, SessionDay> = {};
      for (let dow = 1; dow <= 7; dow++) {
        const role = slots[dow];
        if (role !== 'q1' && role !== 'q2') continue;
        /* DELOAD: jedna kratka oštrina umesto potpunog brisanja kvaliteta; samo q1. */
        if (isDeload) {
          if (role === 'q1') sessions[dow] = mkDeloadSharpness(dow, volQ, pR);
          continue;
        }
        if (isFirstQualWeek && role === 'q2') continue;
        if (isFirstQualWeek && role === 'q1') {
          /* UVODNA sesija: lagan kontinuiran tempo — najblaži kvalitet ciklusa, skalira se obimom. */
          const [uwu, ucd] = wuCdForVolume(vol);
          const qT = r1(Math.min(Math.max(volQ * H.introShare, 1.5), 5, H.tempoMaxSec / pT));
          sessions[dow] = sessTempo(dow, uwu, qT, pT, Math.max(ucd, 1), 'Tempo');
          continue;
        }
        sessions[dow] = prof.buildQuality({
          qualW,
          qualWeeks,
          slotRole: role,
          effQ,
          vol: volQ,
          pI,
          pT,
          pE,
          pR,
          isTaper1,
          dow,
          racePace,
          ctx: { weeks, w, taperW }
        });
      }
      const sessionList = (): SessionDay[] => Object.values(sessions);
      /* MLR se broji među „lagane" dane jer se hrani iz istog ostatka. */
      const easyDowsCount = [1, 2, 3, 4, 5, 6, 7].filter((d) => {
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
      const lrCapW = lrCapFor(lrF !== 1 ? lrF : null);
      const allocFor = (): Allocation =>
        allocEasyLongRun(
          vol,
          sessionList().map(kmOf),
          easyDowsCount,
          runDays,
          pLR,
          lrCapW,
          mlrShareQ
        );
      let alloc = allocFor();

      /* PRODUŽENO ZAGREVANJE/SMIRIVANJE kad nedelja podbacuje ciljni obim: raspodela se stvarno
         izvrši, izmeri se pravi manjak, WU/CD se prošire i raspodela ponovi (dva prolaza). U
         TAPER nedelji se ovo NE radi (taper skida količinu; manjak je namera). */
      if (!isTaper1) {
        const side = sessionList().filter(
          (d) => d.session.type !== 'prog' && d.session.wuKm != null && d.session.cdKm != null
        );
        if (side.length) {
          const total = (): number => sumKm(sessionList()) + alloc.lr + sum(alloc.easies);
          const maxAdd = H.wuCdMaxExtraKm;
          const base = side.map((d) => ({ d, wu: d.session.wuKm, cd: d.session.cdKm }));
          for (let pass = 0; pass < 2; pass++) {
            const shortfall = vol - total();
            if (shortfall <= 1) break;
            const step = shortfall / (side.length * 2);
            let moved = false;
            base.forEach((b) => {
              const s = b.d.session;
              /* nikad ne SMANJUJE postojeći WU/CD — samo raste, do osnova+maxAdd */
              const nw = Math.max(s.wuKm, r1(Math.min(b.wu + maxAdd, s.wuKm + step)));
              const nc = Math.max(s.cdKm, r1(Math.min(b.cd + maxAdd, s.cdKm + step)));
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
          const rwL = runWalkForWeek(w <= rwWeeks ? w : 0);
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
              !isTaper1 && !isDeload && prof.longRunFinish
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
                : '';
            days.push(
              D.longRun(
                dow,
                alloc.lr,
                `${alloc.lr} km LR (Z2) @ ~${fmtClock(pLR)}/km — najduže trčanje te nedelje${fuelText(alloc.lr, pLR, H)}${finish}`
              )
            );
          }
          continue;
        }
        /* SREDNJE-DUGO TRČANJE: Z2, bez radnog dela, gradi izdržljivost bez umora dugog trčanja. */
        if (role === 'mlr' && (alloc.mlr ?? 0) > 0) {
          const m = D.longRun(
            dow,
            alloc.mlr as number,
            `${alloc.mlr} km srednje-dugo (Z2) @ ~${fmtClock(pLR)}/km — drugo duže trčanje u nedelji, gradi izdržljivost bez umora dugog trčanja`
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
        const rwQ = runWalkForWeek(w <= rwWeeks ? w : 0);
        if (rwQ) {
          /* Početnik i u kvalitetnoj fazi: LAGANI dani ostaju run/walk dok lestvica ne dođe do neprekidnog. */
          days.push(D.runWalk(dow, km, `${km} km — ${runWalkText(rwQ)}`, rwQ));
        } else {
          const strides = isTaper1
            ? ''
            : ei === 0
              ? isDeload
                ? ' + 4×15 s ubrzanja (lagani ubrzani koraci)'
                : ' + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)'
              : '';
          days.push(D.easy(dow, km, `${km} km lako (Z2) @ ~${fmtClock(pE)}/km${strides}`));
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
        const easyCount = Math.max(runDays - 1 - effQ, 0);
        const suggestion =
          easyCount <= 1
            ? ' Na ' +
              runDays +
              ' dana sa ' +
              (effQ === 1 ? 'jednim kvalitetnim treningom' : effQ + ' kvalitetna treninga') +
              ' ostaje samo ' +
              (easyCount === 1 ? 'jedan lagan dan' : 'nijedan lagan dan') +
              ', pa se toliki obim ne može bezbedno rasporediti — lagan dan bi morao da bude dug koliko i dugo trčanje. Dodaj jedan dan trčanja.'
            : ' Dodaj jedan dan trčanja ili smanji broj kvalitetnih treninga.';
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
          ' km/ned) jer je nagli skok obima najčešći uzrok povrede — ' +
          'ali to znači da je ovo plan da distancu ISTRČIŠ, ne da je trčiš na vreme. ' +
          'Za pun pristup trebalo bi ti više nedelja ili viša polazna baza.'
      );
    }
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
  return plan;
}

/** `arr[i]` za indeks koji je po konstrukciji validan; baca ako to nije tačno (ne tiho NaN). */
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined)
    throw new RangeError(`generatePlan: indeks ${i} van niza dužine ${arr.length}`);
  return v;
}
