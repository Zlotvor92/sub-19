//#region ../sub-19-baseline/web/src/domain/date/index.ts
const ISO_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 864e5;
function pad(n, width) {
  return String(n).padStart(width, '0');
}
/** Epoch-dan za kalendarski datum; `null` ako takav datum ne postoji. */
function ymdToEpochDay(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d)
    return null;
  return ms / MS_PER_DAY;
}
/** Strogo parsiranje. Vraća `null` za sve što nije postojeći kalendarski datum. */
function parseIsoDate(value) {
  if (typeof value !== 'string') return null;
  const m = ISO_SHAPE.exec(value);
  if (!m) return null;
  return ymdToEpochDay(Number(m[1]), Number(m[2]), Number(m[3])) === null ? null : value;
}
/** Epoch-dan (celi dani od 1970-01-01). Baca za neispravan datum — pozivalac je već validirao. */
function toEpochDay(date) {
  const m = ISO_SHAPE.exec(date);
  const epoch = m ? ymdToEpochDay(Number(m[1]), Number(m[2]), Number(m[3])) : null;
  if (epoch === null) throw new RangeError(`Neispravan datum: ${date}`);
  return epoch;
}
function fromEpochDay(epochDay) {
  if (!Number.isInteger(epochDay))
    throw new RangeError(`Epoch-dan mora biti ceo broj: ${epochDay}`);
  const d = /* @__PURE__ */ new Date(epochDay * MS_PER_DAY);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}
function addDays(date, days) {
  return fromEpochDay(toEpochDay(date) + days);
}
/** Broj dana od `from` do `to` (pozitivan ako je `to` kasnije). Isto značenje kao stari `diffD(a, b)`. */
function diffDays(from, to) {
  return toEpochDay(to) - toEpochDay(from);
}
function weekdayIndex(date) {
  return (((toEpochDay(date) + 3) % 7) + 7) % 7;
}
/** Ponedeljak nedelje kojoj datum pripada (stari `mondayOfWeek`). */
function mondayOnOrBefore(date) {
  return addDays(date, -weekdayIndex(date));
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/format/index.ts
/** Zaokruživanje na jednu decimalu — jedino zaokruživanje kilometraže u planu. */
const r1 = (x) => Math.round(x * 10) / 10;
const pad2 = (n) => String(n).padStart(2, '0');
/**
 * Sekunde → `m:ss` ili `h:mm:ss`. Nevažeće vreme (null, nije konačno, negativno)
 * daje „—", nikad „NaN:NaN" (isti dogovor kao stari `fmtClock`).
 */
function fmtClock(sec) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—';
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}
/** Srpski oblik množine: 1 → jedan, 2–4 (osim 12–14) → dva, ostalo → pet. */
function pl3(n, jedan, dva, pet) {
  const m = n % 10;
  const h = n % 100;
  if (m === 1 && h !== 11) return jedan;
  if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return dva;
  return pet;
}
const brojNedelja = (n) => `${n} ${pl3(n, 'nedelja', 'nedelje', 'nedelja')}`;
/** „Polumaraton" → „polumaraton", „5K" ostaje „5K" (počinje ciframa). */
function distUReceni(ime) {
  const s = String(ime ?? '');
  return /^\d/.test(s) ? s : s.toLowerCase();
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/constants/heuristics.ts
/** Udeo VO2max po zoni (E, LR, I, T, R). Zona M se NE računa iz procenta —
 *  ona je po definiciji tempo maratona za dati VDOT (v. `paceForZone`). `M`
 *  ostaje ovde samo zbog potpunosti tabele. */
const ZONE_FRACTION = {
  I: 1,
  T: 0.88,
  M: 0.8,
  E: 0.7,
  LR: 0.68,
  R: 1.05
};
/** Rast VDOT-a po nedelji (poena). `agr` je kalibrisan na putanju jednog autora plana. */
const VDOT_RAMP_PER_WEEK = {
  kons: 0.15,
  std: 0.25,
  agr: 0.43
};
/** Najveće prihvatljivo odstupanje isporučenog rasta: korak × ovaj faktor. */
const DELIVERED_GROWTH_FACTOR = 1.6;
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/constants/product.ts
const RUN_WALK_LADDER = [
  {
    runSec: 60,
    walkSec: 60,
    label: '1 min trčanja / 1 min hoda'
  },
  {
    runSec: 120,
    walkSec: 60,
    label: '2 min trčanja / 1 min hoda'
  },
  {
    runSec: 180,
    walkSec: 60,
    label: '3 min trčanja / 1 min hoda'
  },
  {
    runSec: 300,
    walkSec: 60,
    label: '5 min trčanja / 1 min hoda'
  }
];
/** Plan se pravi i ispod ovoga, ali se prijavljuje: minimum po treningu je 1,5 km. */
const MIN_KM_PER_RUN = 1.5;
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/constants/distances.ts
/** Talasanje obima unutar 4-nedeljnog bloka kad je odredište dostignuto: lakše, normalno, malo teže, deload. */
const UNDULATION = [0.94, 0.99, 1.03];
const PRODUCT_5K = {
  name: '5K',
  minWeeks: 6,
  baseWeeksBeginner: 6,
  qual2MinKm: 18,
  minPeakKm: 30
};
const HEURISTIC_5K = {
  rampStep: {
    kons: {
      pct: 0.04,
      min: 1.2,
      max: 2.5
    },
    std: {
      pct: 0.055,
      min: 1.8,
      max: 3.5
    },
    agr: {
      pct: 0.07,
      min: 2.4,
      max: 4.5
    }
  },
  targetVolumeKm: 55,
  hardCapKm: 120,
  longRun: {
    share: 0.27,
    lowVolumeShare: 0.4,
    lowVolumeCapKm: 8,
    timeCapMin: 90,
    absCapKm: 20
  },
  intervalBudget: {
    pct: 0.08,
    maxKm: 8
  },
  tempoBudget: { pct: 0.1 },
  repetitionBudget: {
    pct: 0.05,
    maxKm: 5
  },
  tempoMaxSec: 1200,
  introShare: 0.08,
  longRunMaxShare: 0.4,
  wuCdMaxExtraKm: 1,
  deloadFactor: 0.73,
  taperFactor: 0.65,
  raceWeekFactor: 0.3,
  taperLongRunFactor: 0.6
};
const PRODUCT_10K = {
  name: '10K',
  minWeeks: 8,
  baseWeeksBeginner: 8,
  qual2MinKm: 24,
  minPeakKm: 40
};
const HEURISTIC_10K = {
  rampStep: {
    kons: {
      pct: 0.04,
      min: 1.4,
      max: 3
    },
    std: {
      pct: 0.055,
      min: 2,
      max: 4
    },
    agr: {
      pct: 0.07,
      min: 2.6,
      max: 5
    }
  },
  targetVolumeKm: 70,
  hardCapKm: 140,
  longRun: {
    share: 0.3,
    lowVolumeShare: 0.42,
    lowVolumeCapKm: 11,
    timeCapMin: 105,
    absCapKm: 24
  },
  intervalBudget: {
    pct: 0.08,
    maxKm: 10
  },
  tempoBudget: { pct: 0.1 },
  repetitionBudget: {
    pct: 0.04,
    maxKm: 4
  },
  tempoMaxSec: 1500,
  introShare: 0.08,
  longRunMaxShare: 0.42,
  wuCdMaxExtraKm: 1.5,
  deloadFactor: 0.75,
  taperFactor: 0.72,
  raceWeekFactor: 0.34,
  taperLongRunFactor: 0.65
};
const PRODUCT_21K = {
  name: 'Polumaraton',
  minWeeks: 10,
  baseWeeksBeginner: 10,
  qual2MinKm: 30,
  minPeakKm: 45,
  recommendedMinRunDays: 4
};
const HEURISTIC_21K = {
  rampStep: {
    kons: {
      pct: 0.04,
      min: 1.6,
      max: 3.4
    },
    std: {
      pct: 0.055,
      min: 2.2,
      max: 4.5
    },
    agr: {
      pct: 0.07,
      min: 2.8,
      max: 5.5
    }
  },
  targetVolumeKm: 80,
  hardCapKm: 160,
  longRun: {
    share: 0.3,
    lowVolumeShare: 0.45,
    lowVolumeCapKm: 14,
    timeCapMin: 135,
    absCapKm: 22
  },
  intervalBudget: {
    pct: 0.06,
    maxKm: 8
  },
  tempoBudget: { pct: 0.1 },
  repetitionBudget: {
    pct: 0.03,
    maxKm: 3
  },
  racePaceBudget: {
    pct: 0.1,
    maxKm: 12
  },
  tempoMaxSec: 1800,
  introShare: 0.08,
  longRunMaxShare: 0.45,
  wuCdMaxExtraKm: 1.5,
  taperWeeks: 2,
  firstTaperFactor: 0.82,
  deloadFactor: 0.76,
  taperFactor: 0.75,
  raceWeekFactor: 0.36,
  taperLongRunFactor: 0.65,
  midweekLong: {
    minDays: 5,
    minKm: 45,
    share: 0.62
  },
  baseLongRunStart: 0.55,
  fuelFromMin: 90
};
const PRODUCT_42K = {
  name: 'Maraton',
  minWeeks: 12,
  baseWeeksBeginner: 12,
  qual2MinKm: 38,
  minPeakKm: 55,
  recommendedMinRunDays: 5
};
const HEURISTIC_42K = {
  rampStep: {
    kons: {
      pct: 0.04,
      min: 1.8,
      max: 3.8
    },
    std: {
      pct: 0.055,
      min: 2.4,
      max: 5
    },
    agr: {
      pct: 0.07,
      min: 3,
      max: 6
    }
  },
  targetVolumeKm: 95,
  hardCapKm: 180,
  longRun: {
    share: 0.3,
    lowVolumeShare: 0.42,
    lowVolumeCapKm: 16,
    timeCapMin: 180,
    absCapKm: 32
  },
  marathonPaceBudget: {
    pct: 0.1,
    maxKm: 16
  },
  intervalBudget: {
    pct: 0.05,
    maxKm: 8
  },
  tempoBudget: { pct: 0.1 },
  repetitionBudget: {
    pct: 0.02,
    maxKm: 2.5
  },
  tempoMaxSec: 2100,
  introShare: 0.07,
  longRunMaxShare: 0.42,
  wuCdMaxExtraKm: 1.5,
  taperWeeks: 2,
  firstTaperFactor: 0.8,
  deloadFactor: 0.78,
  taperFactor: 0.65,
  raceWeekFactor: 0.4,
  taperLongRunFactor: 0.7,
  midweekLong: {
    minDays: 5,
    minKm: 50,
    share: 0.6
  },
  baseLongRunStart: 0.5,
  fuelFromMin: 75,
  fuelStrongFromMin: 120
};
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/sessions/calc.ts
/** Kod pragovskih i race-pace formata pauza je LAGANO TRČANJE (napor ostaje
 *  neprekidan), kod I/R formata je hod. Spisak je izričit, ne obrazac: širok
 *  regex je zahvatao i „Trkački ritam" (10K) i tiho menjao potvrđene planove. */
const RECOVERY_JOG = ['Tempo isprekidan', 'Tempo trke', 'Kontrolna trka'];
/** Pauza: tačan minut kao minut, ispod 90 s u sekundama, ostalo `m:ss min`. */
function fmtRest(sec) {
  if (sec % 60 === 0 && sec >= 60) return `${Math.round(sec / 60)} min`;
  if (sec < 90) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')} min`;
}
/** Pređeno u pauzama između ponavljanja: džog (~35% sporiji od tempa deonice) ili 150 m hoda. */
function kmBetweenReps(s) {
  const n = Math.max((s.reps | 0) - 1, 0);
  if (!n) return 0;
  if (RECOVERY_JOG.includes(s.kind) && s.restSec > 0 && s.paceSec > 0)
    return (n * s.restSec) / (s.paceSec * 1.35);
  return n * 0.15;
}
function sessKm(s) {
  switch (s.type) {
    case 'int':
      return r1(s.wuKm + (s.reps * s.repM) / 1e3 + s.cdKm + kmBetweenReps(s));
    case 'pyramid':
      return r1(
        s.wuKm + s.reps.reduce((a, b) => a + b, 0) / 1e3 + s.cdKm + (s.reps.length - 1) * 0.15
      );
    case 'fartlek':
      return r1(s.wuKm + s.cdKm + fartlekKm(s));
    case 'prog':
      return r1(s.qKm);
    case 'tempo':
      return r1(s.wuKm + s.qKm + s.cdKm);
  }
}
const fartlekKm = (s) => s.reps * (s.repSec / s.paceSec + s.restSec / s.easyPaceSec);
function sessDesc(s) {
  switch (s.type) {
    case 'int': {
      const restWord = RECOVERY_JOG.includes(s.kind) ? 'laganog trčanja' : 'hoda';
      return `${s.kind} — ${s.wuKm} km zagrevanje + ${s.reps}×${s.repM} m @ ${fmtClock(s.paceSec)}/km (${fmtRest(s.restSec)} ${restWord}) + ${s.cdKm} km hlađenje`;
    }
    case 'pyramid':
      return `${s.kind} — ${s.wuKm} km zagrevanje + ${s.reps.join('-')} m @ ${fmtClock(s.paceSec)}/km (${fmtRest(s.restSec)} hoda između ponavljanja) + ${s.cdKm} km hlađenje`;
    case 'fartlek':
      return `Fartlek — ${s.wuKm} km zagrevanje + ${s.reps}×${s.repSec} s brzo @ ~${fmtClock(s.paceSec)}/km (${s.restSec} s laganog trčanja) + ${s.cdKm} km hlađenje`;
    case 'prog':
      return `Progresivno — ${s.qKm} km: prve dve trećine @ ~${fmtClock(s.easyPaceSec)}/km → poslednja trećina @ ${fmtClock(s.paceSec)}/km`;
    case 'tempo':
      return `${s.kind || 'Tempo'} — ${s.wuKm} km zagrevanje + ${s.qKm} km @ ${fmtClock(s.paceSec)}/km + ${s.cdKm} km hlađenje`;
  }
}
/** Radni kilometri sesije (bez zagrevanja i smirivanja) — za predikciju i lap-detekciju. */
function sessQKm(s) {
  switch (s.type) {
    case 'int':
      return r1((s.reps * s.repM) / 1e3);
    case 'pyramid':
      return r1(s.reps.reduce((a, b) => a + b, 0) / 1e3);
    case 'fartlek':
      return r1((s.reps * s.repSec) / s.paceSec);
    case 'prog':
      return r1(s.qKm / 3);
    case 'tempo':
      return s.qKm;
  }
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/sessions/build.ts
function sessInt(dow, wuKm, reps, repM, paceSec, restSec, cdKm, kind) {
  const session = {
    type: 'int',
    kind,
    wuKm,
    reps,
    repM,
    paceSec,
    restSec,
    cdKm,
    overrides: {}
  };
  return {
    dow,
    tag: kind === 'Tempo isprekidan' ? 'tempo' : 'int',
    km: sessKm(session),
    desc: sessDesc(session),
    session
  };
}
function sessTempo(dow, wuKm, qKm, paceSec, cdKm, kind) {
  const session = {
    type: 'tempo',
    kind,
    wuKm,
    qKm,
    paceSec,
    cdKm,
    overrides: {}
  };
  return {
    dow,
    tag: 'tempo',
    km: sessKm(session),
    desc: sessDesc(session),
    session
  };
}
function sessPyramid(dow, wuKm, reps, paceSec, restSec, cdKm, kind) {
  const session = {
    type: 'pyramid',
    kind,
    wuKm,
    reps,
    paceSec,
    restSec,
    cdKm,
    overrides: {}
  };
  return {
    dow,
    tag: 'int',
    km: sessKm(session),
    desc: sessDesc(session),
    session
  };
}
/** Fartlek po McMillan smernici: vremenski surge-ovi, pa nema pouzdane lap-detekcije po distanci. */
function sessFartlek(dow, wuKm, n, surgeSec, easySec, paceSec, cdKm, easyPaceSec) {
  const session = {
    type: 'fartlek',
    kind: 'Fartlek',
    wuKm,
    cdKm,
    reps: n,
    repSec: surgeSec,
    restSec: easySec,
    paceSec,
    easyPaceSec,
    overrides: {}
  };
  return {
    dow,
    tag: 'int',
    km: sessKm(session),
    desc: sessDesc(session),
    session
  };
}
/** Progresivno: prve 2/3 lako, poslednja trećina na `endPaceSec`. `kind` razdvaja
 *  završetak na pragu od završetka na tempu trke (iz imena se izvodi zona). */
function sessProg(dow, totalKm, endPaceSec, easyPaceSec, kind = 'Progresivno') {
  const session = {
    type: 'prog',
    kind,
    qKm: totalKm,
    paceSec: endPaceSec,
    easyPaceSec,
    wuKm: 0,
    cdKm: 0,
    overrides: {}
  };
  return {
    dow,
    tag: 'tempo',
    km: sessKm(session),
    desc: sessDesc(session),
    session
  };
}
/**
 * Zagrevanje/smirivanje skalirano OBIMOM (nije odluka po distanci): 2 km
 * zagrevanja je isto pogrešno za 11 km/ned bez obzira na to koja je trka.
 */
function wuCdForVolume(vol) {
  return [Math.max(1, Math.min(2, r1(vol * 0.055))), Math.max(0.8, Math.min(1.5, r1(vol * 0.04)))];
}
/** Deload „oštrina": kratka serija 200 m umesto potpunog brisanja kvaliteta. */
function mkDeloadSharpness(dow, vol, pR) {
  const [wu, cd] = wuCdForVolume(vol);
  const n = Math.max(4, Math.min(8, Math.round(vol * 0.12)));
  return sessInt(
    dow,
    r1(Math.max(wu * 0.7, 1)),
    n,
    200,
    pR,
    120,
    r1(Math.max(cd * 0.7, 0.8)),
    'Oštrina'
  );
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/sessions/cruise.ts
function cruiseIntervals(tempoBudgetPct, p, dow, vol, pT, share) {
  const total =
    Math.max(Math.min(p.floorCapKm, vol * p.floorShare), vol * tempoBudgetPct) * (share || 1);
  const repKm = p.ladder.find((s) => total >= s.fromKm)?.repKm ?? p.minRepKm;
  const n = Math.max(2, Math.floor(total / repKm + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(
    dow,
    wu,
    n,
    Math.round(repKm * 1e3),
    pT,
    p.restSec(repKm),
    Math.max(cd, 1),
    'Tempo isprekidan'
  );
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/sessions/intervals.ts
/**
 * Dužina i broj ponavljanja za dati radni budžet [km]. Budžet zone je PLAFON:
 * DUŽINA ponavljanja se skraćuje dok tri ponavljanja ne stanu u budžet (broj
 * ostaje ≥ 3), a broj se zaokružuje NANIZE uz toleranciju 8% (Math.round bi probio
 * Danielsov budžet — nađeno u 41 scenariju).
 */
function chooseReps(workKm, wishM, ladderM, fallbackM) {
  const budgetM = workKm * 1e3;
  const rep = ladderM.filter((x) => x <= wishM).find((x) => 3 * x <= budgetM * 1.15) ?? fallbackM;
  return {
    rep,
    n: Math.max(3, Math.floor(budgetM / rep + 0.08))
  };
}
/** Pauza: 80% vremena deonice, u granicama 90–180 s. */
const proportionalRest = (repM, paceSec) =>
  Math.min(180, Math.max(90, Math.round((repM / 1e3) * paceSec * 0.8)));
function pyramid(p, workKm, dow, vol, pI) {
  const [wu, cd] = wuCdForVolume(vol);
  return sessPyramid(
    dow,
    wu,
    [...(p.tiers.find((t) => workKm >= t.fromKm)?.legs ?? p.fallbackLegs)],
    pI,
    p.restSec,
    cd,
    'Piramida'
  );
}
function fartlek(p, dow, vol, pI, pE) {
  const n = Math.max(p.minN, Math.min(p.maxN, Math.round(vol * p.nShare)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessFartlek(dow, wu, n, p.surgeSec, p.restSec, pI, cd, pE);
}
/** Intervali sa zadatim ponavljanjima i pauzom (zagrevanje/smirivanje iz obima). */
function intervalsOf(dow, vol, n, repM, paceSec, restSec) {
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, repM, paceSec, restSec, cd, 'Intervali');
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/sessions/progression.ts
function progressionRun(p, dow, vol, endPace, pE, opts = {}) {
  return sessProg(
    dow,
    r1(Math.max(p.minKm, Math.min(vol * p.pct * (opts.share || 1), p.maxKm))),
    endPace,
    pE,
    opts.atRacePace ? 'Progresivno (tempo trke)' : 'Progresivno'
  );
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/sessions/repetitions.ts
function repetitions(p, repM, dow, vol, pR) {
  const total = Math.max(p.minTotalKm, Math.min(vol * p.pct, p.maxKm));
  const n = Math.max(4, Math.floor((total * 1e3) / repM + 0.08));
  const restSec = Math.round((repM / 1e3) * pR * 2.5);
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, repM, pR, restSec, cd, 'Repeticije');
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/sessions/tempo.ts
/**
 * `fixKm` zadaje tačnu dužinu (taper, uvodna nedelja). `share` (< 1) je udeo
 * nedeljnog budžeta praga kad se prag deli između dva dana (HM).
 */
function continuousTempo(h, p, dow, vol, pT, fixKm, share) {
  const floor = Math.min(p.floorCapKm, r1(vol * p.floorShare)) * (share || 1);
  const q =
    fixKm != null
      ? fixKm
      : r1(Math.max(floor, Math.min(vol * h.tempoBudget.pct * (share || 1), h.tempoMaxSec / pT)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessTempo(dow, wu, q, pT, Math.max(cd, 1), 'Tempo');
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/distances/profile10k.ts
const TEMPO$3 = {
  floorCapKm: 4,
  floorShare: 0.12
};
const CRUISE$3 = {
  floorCapKm: 3,
  floorShare: 0.12,
  ladder: [
    {
      fromKm: 8,
      repKm: 3
    },
    {
      fromKm: 5,
      repKm: 2
    },
    {
      fromKm: 3,
      repKm: 1.6
    }
  ],
  minRepKm: 1,
  restSec: () => 90
};
const FARTLEK$2 = {
  minN: 6,
  maxN: 12,
  nShare: 0.18,
  surgeSec: 90,
  restSec: 90
};
const PYRAMID$1 = {
  tiers: [
    {
      fromKm: 5,
      legs: [600, 1e3, 1600, 1e3, 600]
    },
    {
      fromKm: 3.5,
      legs: [400, 800, 1200, 800, 400]
    }
  ],
  fallbackLegs: [400, 600, 800, 600, 400],
  restSec: 105
};
const PROGRESSION$2 = {
  minKm: 5,
  maxKm: 14,
  pct: 0.2
};
const INTERVAL_LADDER_M$3 = [1600, 1200, 1e3, 800, 600, 400];
/** <30% prag, <70% vrhunac, ostalo specifika. */
function phase10K(qualW, qualWeeks) {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.3) return 'threshold';
  if (f < 0.7) return 'peak';
  return 'specific';
}
const intervalWish$2 = (phase, wkIdx) => {
  const menu =
    phase === 'threshold' ? [1e3, 1200] : phase === 'specific' ? [1200, 1600] : [1e3, 1200, 1600];
  return menu[wkIdx % menu.length];
};
const mkIntervals$3 = (dow, vol, pI, phase, wkIdx) => {
  const { rep, n } = chooseReps(
    Math.min(
      Math.max(vol * HEURISTIC_10K.intervalBudget.pct, 2),
      HEURISTIC_10K.intervalBudget.maxKm
    ),
    intervalWish$2(phase, wkIdx),
    INTERVAL_LADDER_M$3,
    400
  );
  return intervalsOf(dow, vol, n, rep, pI, proportionalRest(rep, pI));
};
const mkRacePace$1 = (dow, vol, racePace, wkIdx) => {
  const q = Math.min(Math.max(vol * 0.1, 2.5), 8);
  const longer = (wkIdx || 0) % 2 === 0;
  const rep = q >= 6 ? (longer ? 1600 : 1200) : q >= 3.5 ? (longer ? 1200 : 1e3) : 1e3;
  const n = Math.max(3, Math.floor((q * 1e3) / rep + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, rep, racePace, rep >= 1600 ? 75 : 60, cd, 'Trkački ritam');
};
const mkPyramid$1 = (dow, vol, pI) =>
  pyramid(
    PYRAMID$1,
    Math.min(
      Math.max(vol * HEURISTIC_10K.intervalBudget.pct, 2),
      HEURISTIC_10K.intervalBudget.maxKm
    ),
    dow,
    vol,
    pI
  );
const mkRepetitions$3 = (dow, vol, pR) =>
  repetitions(
    {
      minTotalKm: 1.2,
      ...HEURISTIC_10K.repetitionBudget
    },
    300,
    dow,
    vol,
    pR
  );
const mkTempo$3 = (dow, vol, pT, fixKm) =>
  continuousTempo(HEURISTIC_10K, TEMPO$3, dow, vol, pT, fixKm);
const mkCruise$3 = (dow, vol, pT) =>
  cruiseIntervals(HEURISTIC_10K.tempoBudget.pct, CRUISE$3, dow, vol, pT);
const mkProgression$2 = (dow, vol, pT, pE) => progressionRun(PROGRESSION$2, dow, vol, pT, pE);
function buildQuality10K(req) {
  const { qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace } = req;
  const phase = phase10K(qualW, qualWeeks);
  if (isTaper1) {
    const [twu, tcd] = wuCdForVolume(vol);
    if (effQ === 1 || slotRole === 'q1') {
      const n = Math.max(3, Math.min(5, Math.round(vol * 0.02)));
      return sessInt(
        dow,
        r1(Math.max(twu * 0.8, 1)),
        n,
        600,
        Math.max(pI, racePace),
        75,
        r1(Math.max(tcd * 0.8, 0.8)),
        'Trkački ritam'
      );
    }
    return mkTempo$3(dow, vol, pT, r1(Math.min(4, Math.max(2, vol * 0.08))));
  }
  if (effQ === 1) {
    if (phase === 'threshold')
      return qualW % 3 === 2 ? mkRepetitions$3(dow, vol, pR) : mkCruise$3(dow, vol, pT);
    if (phase === 'specific')
      return qualW % 2 === 1
        ? mkRacePace$1(dow, vol, racePace, qualW)
        : mkProgression$2(dow, vol, pT, pE);
    const m = qualW % 4;
    if (m === 0) return fartlek(FARTLEK$2, dow, vol, pI, pE);
    if (m === 2) return mkIntervals$3(dow, vol, pI, phase, qualW);
    return mkCruise$3(dow, vol, pT);
  }
  if (slotRole === 'q1') {
    if (phase === 'threshold') return mkRepetitions$3(dow, vol, pR);
    if (phase === 'specific')
      return qualW % 3 === 0
        ? mkIntervals$3(dow, vol, pI, phase, qualW)
        : mkRacePace$1(dow, vol, racePace, qualW);
    if (qualW % 6 === 3) return mkPyramid$1(dow, vol, pI);
    if (qualW % 4 === 2) return fartlek(FARTLEK$2, dow, vol, pI, pE);
    return mkIntervals$3(dow, vol, pI, phase, qualW);
  }
  if (phase === 'threshold')
    return qualW % 2 === 1 ? mkCruise$3(dow, vol, pT) : mkTempo$3(dow, vol, pT);
  if (phase === 'specific')
    return qualW % 2 === 1 ? mkProgression$2(dow, vol, pT, pE) : mkTempo$3(dow, vol, pT);
  return qualW % 2 === 1 ? mkCruise$3(dow, vol, pT) : mkTempo$3(dow, vol, pT);
}
const PROFILE_10K = {
  product: PRODUCT_10K,
  heuristic: HEURISTIC_10K,
  phase: phase10K,
  buildQuality: buildQuality10K,
  intervalPaceForWeek: (pI) => pI
};
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/distances/profile21k.ts
/** <30% prag, <60% vrhunac, ostalo specifika. */
function phase21K(qualW, qualWeeks) {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.3) return 'threshold';
  if (f < 0.6) return 'peak';
  return 'specific';
}
/** Strategija ritma po vremenu trke: <80 min prag, ≤110 min blokovi na tempu trke, inače dugo. */
function paceStrategy21K(racePaceSec) {
  const min = (racePaceSec * 21.0975) / 60;
  if (min < 80) return 'threshold';
  if (min <= 110) return 'blocks';
  return 'long';
}
const TEMPO$2 = {
  floorCapKm: 5,
  floorShare: 0.1
};
const CRUISE$2 = {
  floorCapKm: 3,
  floorShare: 0.12,
  ladder: [
    {
      fromKm: 10,
      repKm: 3
    },
    {
      fromKm: 6,
      repKm: 2.5
    },
    {
      fromKm: 3.5,
      repKm: 1.6
    }
  ],
  minRepKm: 1,
  restSec: (repKm) => (repKm >= 2.5 ? 75 : 60)
};
const FARTLEK$1 = {
  minN: 5,
  maxN: 10,
  nShare: 0.12,
  surgeSec: 120,
  restSec: 90
};
const PROGRESSION$1 = {
  minKm: 6,
  maxKm: 16,
  pct: 0.2
};
const INTERVAL_LADDER_M$2 = [2e3, 1600, 1200, 1e3, 800, 600];
const intervalWish$1 = (phase, wkIdx) => {
  const menu = phase === 'threshold' ? [1200, 1600] : [1200, 1600, 2e3];
  return menu[wkIdx % menu.length];
};
const mkIntervals$2 = (dow, vol, pI, phase, wkIdx) => {
  const { rep, n } = chooseReps(
    Math.min(
      Math.max(vol * HEURISTIC_21K.intervalBudget.pct, 2.4),
      HEURISTIC_21K.intervalBudget.maxKm
    ),
    intervalWish$1(phase, wkIdx),
    INTERVAL_LADDER_M$2,
    600
  );
  return intervalsOf(dow, vol, n, rep, pI, proportionalRest(rep, pI));
};
/** `share` (0.6) deli nedeljni budžet praga kad se q1 ujedno računa na prag. */
const mkCruise$2 = (dow, vol, pT, share) =>
  cruiseIntervals(HEURISTIC_21K.tempoBudget.pct, CRUISE$2, dow, vol, pT, share);
const mkTempo$2 = (dow, vol, pT, fixKm, share) =>
  continuousTempo(HEURISTIC_21K, TEMPO$2, dow, vol, pT, fixKm, share);
/** Blokovi na tempu trke (2–5 km) sa kratkim džogom između. */
const mkRaceRhythm = (dow, vol, racePace, pE, qualW) => {
  const q = Math.min(
    Math.max(vol * HEURISTIC_21K.racePaceBudget.pct, Math.min(4, vol * 0.1)),
    HEURISTIC_21K.racePaceBudget.maxKm
  );
  const early = (qualW || 0) % 2 === 0;
  const repKm = q >= 12 ? (early ? 4 : 5) : q >= 7.5 ? (early ? 3 : 4) : q >= 5 ? 3 : 2;
  const n = Math.max(2, Math.floor(q / repKm + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(
    dow,
    wu,
    n,
    Math.round(repKm * 1e3),
    racePace,
    Math.round(pE * 0.9),
    Math.max(cd, 1),
    'Tempo trke'
  );
};
const mkRepetitions$2 = (dow, vol, pR) =>
  repetitions(
    {
      minTotalKm: 1.2,
      ...HEURISTIC_21K.repetitionBudget
    },
    300,
    dow,
    vol,
    pR
  );
const mkProgression$1 = (dow, vol, endPace, pE, share, atRacePace) =>
  progressionRun(PROGRESSION$1, dow, vol, endPace, pE, {
    share,
    atRacePace
  });
/**
 * Kontrolna trka: pravi presek forme 3–4 nedelje pred cilj — i probni dan za
 * opremu, doručak i gorivo. NAMERNO nema Danielsovu zonu (v. ZONE_FOR_KIND):
 * korisnik je može istrčati punom snagom ili kontrolisano.
 */
const mkTimeTrial = (dow, vol, racePace) => {
  const [wu, cd] = wuCdForVolume(vol);
  const trialKm = Math.max(5, Math.min(10, Math.round(vol * 0.15)));
  return {
    dow,
    tag: 'tempo',
    km: r1(wu + trialKm + cd),
    desc: `Kontrolna trka — ${wu} km zagrevanje + ${trialKm} km + ${cd} km hlađenje. Ako nađeš pravu trku (${trialKm >= 8 ? '10K trka' : 'kraća trka (5K ili 10K)'}) — trči je PUNOM SNAGOM, brže od tempa polumaratona; to je najpošteniji presek forme. Ako je nema, istrči ${trialKm} km sam, kontrolisano na ${fmtClock(racePace)}/km (tempo polumaratona). Isprobaj opremu, doručak i gorivo tačno kako planiraš na dan trke. Sledeća 2–3 dana drži skroz lagano, bez obzira kako se osećaš.`,
    session: {
      type: 'tempo',
      kind: 'Kontrolna trka',
      wuKm: wu,
      qKm: trialKm,
      paceSec: racePace,
      cdKm: cd,
      overrides: {}
    }
  };
};
/**
 * Koji sistem gađa q1 te nedelje — JEDAN izvor istine za izbor sesije I za
 * deljenje nedeljnog budžeta praga (Danielsov budžet je NEDELJNI, ne po sesiji).
 */
function q1Family$1(phase, strat, qualW) {
  if (phase === 'threshold') return qualW % 3 === 0 ? 'I' : 'R';
  if (phase === 'peak') return 'I';
  if (strat === 'blocks') return 'RP';
  if (strat === 'threshold') return qualW % 3 === 0 ? 'I' : 'T';
  return qualW % 2 === 1 ? 'RP' : 'T';
}
function buildQuality21K(req) {
  const { qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace, ctx } =
    req;
  const phase = phase21K(qualW, qualWeeks);
  const strat = paceStrategy21K(racePace);
  const share = effQ === 2 && q1Family$1(phase, strat, qualW) === 'T' ? 0.6 : 1;
  if (isTaper1) {
    const [twu, tcd] = wuCdForVolume(vol);
    if (effQ === 1 || slotRole === 'q1') {
      const km = r1(Math.min(5, Math.max(2, vol * 0.09)));
      return sessTempo(
        dow,
        r1(Math.max(twu * 0.8, 1)),
        km,
        racePace,
        r1(Math.max(tcd * 0.8, 0.8)),
        'Tempo trke'
      );
    }
    return mkTempo$2(dow, vol, pT, r1(Math.min(4, Math.max(2, vol * 0.07))));
  }
  if (
    ctx.weeks &&
    ctx.w &&
    phase === 'specific' &&
    (effQ === 1 || slotRole === 'q1') &&
    vol >= 30
  ) {
    const weeksToRace = ctx.weeks - ctx.w;
    const w4 = ctx.weeks - 4;
    const lastWorking = ctx.weeks - 1 - (ctx.taperW || 1);
    const fourthIsDeload = w4 > 0 && w4 % 4 === 0 && w4 < lastWorking;
    if (weeksToRace === 4 ? !fourthIsDeload : weeksToRace === 3 && fourthIsDeload)
      return mkTimeTrial(dow, vol, racePace);
  }
  if (effQ === 1) {
    if (phase === 'threshold')
      return qualW % 3 === 2 ? mkRepetitions$2(dow, vol, pR) : mkCruise$2(dow, vol, pT);
    if (phase === 'peak')
      return qualW % 3 === 1 ? mkIntervals$2(dow, vol, pI, phase, qualW) : mkCruise$2(dow, vol, pT);
    if (strat === 'blocks')
      return qualW % 2 === 1
        ? mkRaceRhythm(dow, vol, racePace, pE, qualW)
        : mkTempo$2(dow, vol, pT);
    return qualW % 2 === 1
      ? mkCruise$2(dow, vol, pT)
      : mkProgression$1(dow, vol, strat === 'long' ? racePace : pT, pE, null, strat === 'long');
  }
  if (slotRole === 'q1') {
    const fam = q1Family$1(phase, strat, qualW);
    if (fam === 'R') return mkRepetitions$2(dow, vol, pR);
    if (fam === 'I')
      return qualW % 4 === 2
        ? fartlek(FARTLEK$1, dow, vol, pI, pE)
        : mkIntervals$2(dow, vol, pI, phase, qualW);
    if (fam === 'RP')
      return phase === 'specific' && strat === 'long'
        ? mkProgression$1(dow, vol, racePace, pE, null, true)
        : mkRaceRhythm(dow, vol, racePace, pE, qualW);
    return phase === 'peak'
      ? mkProgression$1(dow, vol, pT, pE, share, false)
      : mkCruise$2(dow, vol, pT, share);
  }
  if (phase === 'specific')
    return qualW % 2 === 1 ? mkTempo$2(dow, vol, pT, null, share) : mkCruise$2(dow, vol, pT, share);
  return qualW % 2 === 1 ? mkCruise$2(dow, vol, pT, share) : mkTempo$2(dow, vol, pT, null, share);
}
/** Brz završetak dugog trčanja na tempu trke u specifičnoj fazi (češće za strategiju „dugo"). */
function longRunFinish21K(phase, qualW, lrKm, racePace, strategy) {
  if (phase !== 'specific' || !(lrKm >= 10)) return '';
  if (!(strategy === 'long') && qualW % 2 === 0) return '';
  return ` · brz završetak: poslednjih ${r1(Math.max(3, Math.min(6, lrKm * 0.25)))} km @ ${fmtClock(racePace)}/km (tempo trke, na umornim nogama)`;
}
const PROFILE_21K = {
  product: PRODUCT_21K,
  heuristic: HEURISTIC_21K,
  phase: phase21K,
  buildQuality: buildQuality21K,
  intervalPaceForWeek: (pI) => pI,
  paceStrategy: paceStrategy21K,
  longRunFinish: longRunFinish21K
};
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/distances/profile42k.ts
/** <33% izdržljivost, <73% prag, ostalo specifika. */
function phase42K(qualW, qualWeeks) {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.33) return 'endurance';
  if (f < 0.73) return 'threshold';
  return 'specific';
}
/**
 * Faktor ciklusa dugog trčanja: većina nedelja srednje dugačko, dva prava
 * vrhunca (3 i 0 nedelja pre kraja radnog dela), deload najviše 70%.
 */
function longRunCycle42K(w, c) {
  const lastWorking = c.weeks - 1 - c.taperW;
  if (w > lastWorking) return 1;
  const toEnd = lastWorking - w;
  let f;
  if (toEnd === 0) f = 1;
  else if (toEnd === 1) f = 0.85;
  else if (toEnd === 2) f = 0.75;
  else if (toEnd === 3) f = 1;
  else if (toEnd === 4) f = 0.85;
  else if (toEnd === 5) f = 0.92;
  else f = 0.8;
  return c.isDeload ? Math.min(f, 0.7) : f;
}
const TEMPO$1 = {
  floorCapKm: 6,
  floorShare: 0.09
};
const CRUISE$1 = {
  floorCapKm: 3,
  floorShare: 0.1,
  ladder: [
    {
      fromKm: 10,
      repKm: 3
    },
    {
      fromKm: 6,
      repKm: 2.5
    },
    {
      fromKm: 3.5,
      repKm: 1.6
    }
  ],
  minRepKm: 1,
  restSec: (repKm) => (repKm >= 2.5 ? 75 : 60)
};
const PROGRESSION = {
  minKm: 8,
  maxKm: 18,
  pct: 0.2
};
const INTERVAL_MENU_M = [1200, 1600, 2e3];
const INTERVAL_LADDER_M$1 = [2e3, 1600, 1200, 1e3, 800];
const mkIntervals$1 = (dow, vol, pI, wkIdx) => {
  const q = Math.min(
    Math.max(vol * HEURISTIC_42K.intervalBudget.pct, 2.4),
    HEURISTIC_42K.intervalBudget.maxKm
  );
  const wish = INTERVAL_MENU_M[wkIdx % INTERVAL_MENU_M.length];
  const { rep, n } = chooseReps(q, wish, INTERVAL_LADDER_M$1, 800);
  return intervalsOf(dow, vol, n, rep, pI, proportionalRest(rep, pI));
};
const mkCruise$1 = (dow, vol, pT, share) =>
  cruiseIntervals(HEURISTIC_42K.tempoBudget.pct, CRUISE$1, dow, vol, pT, share);
const mkTempo$1 = (dow, vol, pT, fixKm, share) =>
  continuousTempo(HEURISTIC_42K, TEMPO$1, dow, vol, pT, fixKm, share);
/** Rad na tempu maratona: naizmenično blokovi 3–5 km sa pauzom i kontinuiran deo. */
const mkMarathonPace = (dow, vol, pM, qualW) => {
  const q = Math.min(
    Math.max(vol * HEURISTIC_42K.marathonPaceBudget.pct, Math.min(6, vol * 0.1)),
    HEURISTIC_42K.marathonPaceBudget.maxKm
  );
  const [wu, cd] = wuCdForVolume(vol);
  if ((qualW || 0) % 2 === 0) {
    const repKm = q >= 12 ? 5 : q >= 8 ? 4 : 3;
    return sessInt(
      dow,
      wu,
      Math.max(2, Math.floor(q / repKm + 0.08)),
      Math.round(repKm * 1e3),
      pM,
      90,
      Math.max(cd, 1),
      'Maratonski tempo'
    );
  }
  return sessTempo(dow, wu, r1(q), pM, Math.max(cd, 1), 'Maratonski tempo');
};
const mkProgression = (dow, vol, endPace, pE, share, atRacePace) =>
  progressionRun(PROGRESSION, dow, vol, endPace, pE, {
    share,
    atRacePace
  });
const mkRepetitions$1 = (dow, vol, pR) =>
  repetitions(
    {
      minTotalKm: 1,
      ...HEURISTIC_42K.repetitionBudget
    },
    200,
    dow,
    vol,
    pR
  );
/** q1 više nikad nije pragovski, pa nema deljenja budžeta — nedeljni prag u celosti pripada q2. */
function q1Family(phase, qualW) {
  if (phase === 'endurance') return qualW % 2 === 1 ? 'R' : 'M';
  if (phase === 'threshold') return qualW % 3 === 0 ? 'I' : 'M';
  return qualW % 4 === 3 ? 'I' : 'M';
}
function buildQuality42K(req) {
  const { qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace } = req;
  const phase = phase42K(qualW, qualWeeks);
  const pM = racePace;
  const share = 1;
  if (isTaper1) {
    const [twu, tcd] = wuCdForVolume(vol);
    if (effQ === 1 || slotRole === 'q1') {
      const km = r1(Math.min(6, Math.max(3, vol * 0.1)));
      return sessTempo(
        dow,
        r1(Math.max(twu * 0.8, 1)),
        km,
        pM,
        r1(Math.max(tcd * 0.8, 0.8)),
        'Maratonski tempo'
      );
    }
    return mkTempo$1(dow, vol, pT, r1(Math.min(5, Math.max(2.5, vol * 0.07))));
  }
  if (effQ === 1) {
    if (phase === 'endurance')
      return qualW % 3 === 2 ? mkRepetitions$1(dow, vol, pR) : mkCruise$1(dow, vol, pT);
    if (phase === 'threshold')
      return qualW % 4 === 0 ? mkIntervals$1(dow, vol, pI, qualW) : mkCruise$1(dow, vol, pT);
    return qualW % 2 === 1 ? mkMarathonPace(dow, vol, pM, qualW) : mkTempo$1(dow, vol, pT);
  }
  if (slotRole === 'q1') {
    const fam = q1Family(phase, qualW);
    if (fam === 'R') return mkRepetitions$1(dow, vol, pR);
    if (fam === 'I') return mkIntervals$1(dow, vol, pI, qualW);
    return phase === 'endurance'
      ? mkProgression(dow, vol, pM, pE, null, true)
      : mkMarathonPace(dow, vol, pM, qualW);
  }
  if (phase === 'endurance') return mkCruise$1(dow, vol, pT, share);
  return qualW % 2 === 1 ? mkTempo$1(dow, vol, pT, null, share) : mkCruise$1(dow, vol, pT, share);
}
/** Poslednjih 5–12 km dugog trčanja na tempu maratona (samo u specifičnoj fazi, ne na vrhuncu ciklusa). */
function longRunFinish42K(phase, _qualW, lrKm, racePace, _strategy, cycleFactor) {
  if (phase !== 'specific' || !(lrKm >= 16)) return '';
  if (cycleFactor != null && cycleFactor >= 0.99) return '';
  return ` · poslednjih ${r1(Math.max(5, Math.min(12, lrKm * 0.35)))} km @ ${fmtClock(racePace)}/km (maratonski tempo, na umornim nogama)`;
}
const PROFILE_42K = {
  product: PRODUCT_42K,
  heuristic: HEURISTIC_42K,
  phase: phase42K,
  buildQuality: buildQuality42K,
  intervalPaceForWeek: (pI) => pI,
  longRunFinish: longRunFinish42K,
  longRunCycle: longRunCycle42K
};
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/distances/profile5k.ts
const TEMPO = {
  floorCapKm: 3,
  floorShare: 0.12
};
const CRUISE = {
  floorCapKm: 3,
  floorShare: 0.12,
  ladder: [
    {
      fromKm: 6,
      repKm: 2
    },
    {
      fromKm: 3,
      repKm: 1.6
    }
  ],
  minRepKm: 1,
  restSec: () => 90
};
const FARTLEK = {
  minN: 6,
  maxN: 12,
  nShare: 0.2,
  surgeSec: 60,
  restSec: 60
};
const PYRAMID = {
  tiers: [
    {
      fromKm: 3.4,
      legs: [400, 800, 1200, 800, 400]
    },
    {
      fromKm: 2.6,
      legs: [400, 600, 800, 600, 400]
    }
  ],
  fallbackLegs: [200, 400, 600, 400, 200],
  restSec: 90
};
const INTERVAL_LADDER_M = [1200, 1e3, 800, 600, 400];
/** Faze po udelu kvalitetnog ciklusa: <25% ekonomija, <75% vrhunac, ostalo oštrenje. */
function phase5K(qualW, qualWeeks) {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.25) return 'economy';
  if (f < 0.75) return 'peak';
  return 'sharpening';
}
/** Dužina intervala za 5K: 800–1200 m je srce; kraći (600) samo u oštrenju. */
const intervalWish = (phase, wkIdx) => {
  const menu = phase === 'sharpening' ? [600, 800] : phase === 'peak' ? [1e3, 1200] : [800, 1e3];
  return menu[wkIdx % menu.length];
};
const mkIntervals = (dow, vol, pI, phase, wkIdx) => {
  const { rep, n } = chooseReps(
    Math.min(
      Math.max(vol * HEURISTIC_5K.intervalBudget.pct, 1.6),
      HEURISTIC_5K.intervalBudget.maxKm
    ),
    intervalWish(phase, wkIdx),
    INTERVAL_LADDER_M,
    400
  );
  return intervalsOf(dow, vol, n, rep, pI, 120);
};
const mkRacePace = (dow, vol, racePace) => {
  const q = Math.min(Math.max(vol * HEURISTIC_5K.intervalBudget.pct, 1.6), 6);
  const rep = q >= 3 ? 1e3 : 800;
  const n = Math.max(3, Math.floor((q * 1e3) / rep + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, rep, racePace, 90, cd, 'Trkački ritam');
};
const mkPyramid = (dow, vol, pI) =>
  pyramid(
    PYRAMID,
    Math.min(
      Math.max(vol * HEURISTIC_5K.intervalBudget.pct, 1.6),
      HEURISTIC_5K.intervalBudget.maxKm
    ),
    dow,
    vol,
    pI
  );
const mkRepetitions = (dow, vol, pR, phase) =>
  repetitions(
    {
      minTotalKm: 1.2,
      ...HEURISTIC_5K.repetitionBudget
    },
    phase === 'sharpening' ? 200 : 300,
    dow,
    vol,
    pR
  );
const mkTempo = (dow, vol, pT, fixKm) => continuousTempo(HEURISTIC_5K, TEMPO, dow, vol, pT, fixKm);
const mkCruise = (dow, vol, pT) =>
  cruiseIntervals(HEURISTIC_5K.tempoBudget.pct, CRUISE, dow, vol, pT);
function buildQuality5K(req) {
  const { qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace } = req;
  const phase = phase5K(qualW, qualWeeks);
  if (isTaper1) {
    const [twu, tcd] = wuCdForVolume(vol);
    if (effQ === 1 || slotRole === 'q1') {
      const n = Math.max(4, Math.min(6, Math.round(vol * 0.03)));
      return sessInt(
        dow,
        r1(Math.max(twu * 0.75, 1)),
        n,
        400,
        Math.max(pI, racePace),
        90,
        r1(Math.max(tcd * 0.75, 0.8)),
        'Intervali'
      );
    }
    return mkTempo(dow, vol, pT, r1(Math.min(3, Math.max(1.5, vol * 0.08))));
  }
  if (effQ === 1) {
    if (phase === 'economy')
      return qualW % 2 === 1 ? mkRepetitions(dow, vol, pR, phase) : mkCruise(dow, vol, pT);
    if (phase === 'sharpening')
      return qualW % 2 === 1 ? mkRacePace(dow, vol, racePace) : mkTempo(dow, vol, pT);
    const m = qualW % 3;
    if (m === 0) return fartlek(FARTLEK, dow, vol, pI, pE);
    if (m === 2) return mkTempo(dow, vol, pT);
    return mkIntervals(dow, vol, pI, phase, qualW);
  }
  if (slotRole === 'q1') {
    if (phase === 'economy') return mkRepetitions(dow, vol, pR, phase);
    if (phase === 'sharpening')
      return qualW % 2 === 1
        ? mkRacePace(dow, vol, racePace)
        : mkIntervals(dow, vol, pI, phase, qualW);
    if (qualW % 6 === 3) return mkPyramid(dow, vol, pI);
    if (qualW % 4 === 2) return fartlek(FARTLEK, dow, vol, pI, pE);
    return mkIntervals(dow, vol, pI, phase, qualW);
  }
  if (phase === 'economy') return mkCruise(dow, vol, pT);
  if (phase === 'sharpening') return mkTempo(dow, vol, pT, 3);
  return qualW % 2 === 1 ? mkCruise(dow, vol, pT) : mkTempo(dow, vol, pT);
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/distances/index.ts
/** Profil po ciljnoj distanci [m]. Nova distanca = novi profil; nijedan postojeći se ne dira. */
const DISTANCE_PROFILES = {
  5e3: {
    product: PRODUCT_5K,
    heuristic: HEURISTIC_5K,
    phase: phase5K,
    buildQuality: buildQuality5K,
    intervalPaceForWeek: (pI, racePace, weeksToRace) =>
      weeksToRace <= 6 ? Math.max(pI, racePace) : pI
  },
  1e4: PROFILE_10K,
  21097.5: PROFILE_21K,
  42195: PROFILE_42K
};
function profileFor(raceDistM) {
  return DISTANCE_PROFILES[String(raceDistM)];
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/vdot/zoneForKind.ts
/**
 * Naziv sesije → Danielsova zona, za ISPRAVNO računanje VDOT-a iz ostvarenog
 * tempa kvalitetne sesije. Tempo/interval sesije se trče submaksimalno
 * (T ≈ 88% VO2max, ne trka), pa Riegel (koji pretpostavlja maksimalan napor)
 * sistematski potcenjuje VDOT baš na njima.
 *
 * NAMERNO NEMA ZONU: `Kontrolna trka` — korisnik je može istrčati kao pravu
 * trku ili kontrolisano, plan ne zna šta je izabrao; putanja „trka na toj
 * distanci" je za nju bezbednija nego prag (koji bi pravu trku precenio).
 *
 * `Trkački ritam` → I (tačno za 5K, za 10K blago POTCENJUJE VDOT — bezbedan
 * smer greške). `Tempo trke` → T (isto: greška potcenjuje).
 */
const ZONE_FOR_KIND = {
  Intervali: 'I',
  Fartlek: 'I',
  Piramida: 'I',
  Repeticije: 'R',
  Tempo: 'T',
  'Tempo (broken)': 'T',
  Progresivno: 'T',
  'Tempo isprekidan': 'T',
  'Trkački ritam': 'I',
  'Tempo trke': 'T',
  'Progresivno (tempo trke)': 'M',
  'Maratonski tempo': 'M'
};
/**
 * Sesije čiji je propis izveden iz CILJA (`racePace`), ne iz forme te nedelje.
 * Inverz tempa maratona nad ciljnim tempom vraća tačno `vdotGoal` — pa ih
 * čitati unazad kao merenje daje cirkularnost. Tempo se čuva i prikazuje; samo
 * ne ulazi u lanac forme.
 */
const KIND_FROM_GOAL = /* @__PURE__ */ new Set([
  'Trkački ritam',
  'Tempo trke',
  'Progresivno (tempo trke)',
  'Maratonski tempo'
]);
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/constants/evidence.ts
/** Daniels & Gilbert (1979): potrošnja kiseonika u funkciji brzine v [m/min]. */
const VO2_INTERCEPT = -4.6;
const VO2_LINEAR = 0.182258;
const VO2_QUADRATIC = 104e-6;
/** Daniels & Gilbert (1979): udeo VO2max koji se može držati t minuta. */
const PCT_VO2MAX_BASE = 0.8;
const PCT_VO2MAX_SLOW = {
  amplitude: 0.1894393,
  rate: -0.012778
};
const PCT_VO2MAX_FAST = {
  amplitude: 0.2989558,
  rate: -0.1932605
};
/** Riegel (1981): t₂ = t₁·(d₂/d₁)^k. */
const RIEGEL_EXPONENT = 1.06;
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/vdot/physiology.ts
/** VO2 [ml/kg/min] pri brzini v [m/min]. */
function vo2AtV(v) {
  return VO2_INTERCEPT + VO2_LINEAR * v + VO2_QUADRATIC * v * v;
}
/** Inverz `vo2AtV` (veći koren kvadratne jednačine): brzina [m/min] za dati VO2. */
function vAtVo2(vo2) {
  const a = VO2_QUADRATIC;
  const b = VO2_LINEAR;
  const c = VO2_INTERCEPT - vo2;
  return (-0.182258 + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}
/** Udeo VO2max koji se može držati `tMin` minuta. */
function pctVo2max(tMin) {
  return (
    PCT_VO2MAX_BASE +
    PCT_VO2MAX_SLOW.amplitude * Math.exp(PCT_VO2MAX_SLOW.rate * tMin) +
    PCT_VO2MAX_FAST.amplitude * Math.exp(PCT_VO2MAX_FAST.rate * tMin)
  );
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/vdot/racePrediction.ts
/**
 * Vreme trke [s] na `distM` koje odgovara datom VDOT-u. Rešava se Newton-ovom
 * iteracijom (najviše 40 koraka) nad `vdotFromRace(distM, t) = vdot`.
 */
function raceTimeForVdot(vdot, distM) {
  let t = distM / vAtVo2(vdot);
  for (let i = 0; i < 40; i++) {
    const f = vo2AtV(distM / t) / pctVo2max(t) - vdot;
    const dt = 0.01;
    const d = (vo2AtV(distM / (t + dt)) / pctVo2max(t + dt) - vdot - f) / dt;
    if (Math.abs(d) < 1e-9) break;
    t = t - f / d;
    if (Math.abs(f) < 1e-6) break;
  }
  return Math.round(t * 60);
}
/** Riegel: vreme [s] sa `fromM` preračunato na `toM`. */
function riegelDist(sec, fromM, toM) {
  return sec * Math.pow(toM / fromM, RIEGEL_EXPONENT);
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/vdot/paceForZone.ts
const MARATHON_M = 42195;
/**
 * Tempo [s/km] za zonu pri datom VDOT-u.
 *
 * Zona M NIJE procenat VO2max nego definicija: tempo maratonske trke za taj
 * VDOT (Daniels). Procenat je grešio 3–6 s/km naniže i ubrzavao plan preko
 * procene forme — zato se izvodi iz iste jednačine kao predviđanje trke.
 */
function paceForZone(vdot, zone) {
  if (zone === 'M') return Math.round(raceTimeForVdot(vdot, MARATHON_M) / 42.195);
  const v = vAtVo2(vdot * ZONE_FRACTION[zone]);
  return Math.round(6e4 / v);
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/vdot/vdotFromPace.ts
/**
 * Inverz `paceForZone`: opservirani tempo na zoni → implicirani VDOT.
 * `paceForZone` je monotono opadajuća po VDOT-u (viša forma, brži tempo), pa se
 * traži binarnom pretragom. Vraća `hi`, ne sredinu: `paceForZone` zaokružuje na
 * celu sekundu (stepenasta je), a `hi` je najmanji VDOT čiji tempo već JESTE
 * tražen — round-trip tempo→VDOT→tempo pogađa uvek (0/1206 promašaja), dok je
 * sredina padala na pogrešnu stranu u 49% kombinacija.
 */
function vdotFromPace(paceSecKm, zone) {
  let lo = 20;
  let hi = 85;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (paceForZone(mid, zone) > paceSecKm) lo = mid;
    else hi = mid;
  }
  return hi;
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/prediction/index.ts
/**
 * Red predikcije. `refVdot` je forma koju PLAN očekuje te nedelje; kad je ima,
 * `p5k` se računa iz nje, NE iz propisanog tempa. Propis nije merenje: intervalni
 * tempo se pred kraj namerno klampuje na tempo trke, a aktivacija pred trku je
 * 6×200 m — pročitani unazad daju izopačenu referentnu krivu.
 */
function predRow(w, kind, q, pt, raceDistM, refVdot) {
  const zone = ZONE_FOR_KIND[kind];
  const p5k =
    refVdot != null && Number.isFinite(refVdot)
      ? Math.round(raceTimeForVdot(refVdot, raceDistM))
      : zone != null
        ? Math.round(raceTimeForVdot(vdotFromPace(pt, zone), raceDistM))
        : Math.round(riegelDist(pt * q, q * 1e3, raceDistM));
  const row = {
    w,
    l: `N${w} · ${kind}`,
    q,
    pt,
    p5k
  };
  if (KIND_FROM_GOAL.has(kind)) row.nemeri = true;
  return row;
}
/** Radne deonice (m) po danu za lap-detekciju; fartlek/progresivno nemaju (vremenski/kontinuirani). */
function qsFor(session) {
  switch (session.type) {
    case 'int':
      return [session.repM];
    case 'pyramid':
      return session.reps.slice();
    case 'tempo':
      return [Math.round(session.qKm * 1e3)];
    case 'fartlek':
    case 'prog':
      return null;
  }
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/generator/allocation.ts
/** Pod po danu trčanja: prati obim po danu, uz apsolutni minimum od 1,5 km (ispod toga nije trening). */
function perRunFloor(vol, runDays) {
  return Math.max(1.5, Math.min(3, r1((vol / Math.max(runDays, 1)) * 0.75)));
}
/**
 * LR je uvek najduže trčanje nedelje; lagan dan ne sme da mu se približi (inače
 * to više nije lagan dan nego drugo dugo trčanje). `mlrShare` (HM, 42K) je udeo
 * dugog trčanja koji dobija srednje-dugo; lagani dani dele ono što ostane.
 */
function allocEasyLongRun(vol, qKms, easyCount, runDays, longRunPaceSecPerKm, lrCapFn, mlrShare) {
  const floorPerRun = perRunFloor(vol, runDays);
  const qSum = qKms.reduce((a, b) => a + b, 0);
  const maxQ = qKms.length ? Math.max(...qKms) : 0;
  const rem = Math.max(vol - qSum, 3);
  const dayCap = lrCapFn(vol, longRunPaceSecPerKm || 0);
  if (easyCount === 0)
    return {
      lr: r1(Math.min(Math.max(rem, maxQ * 1.1), Math.max(dayCap, maxQ * 1.05))),
      easies: []
    };
  const cap = Math.min(
    vol * (runDays >= 5 ? 0.32 : runDays === 4 ? 0.36 : runDays === 3 ? 0.5 : 0.68),
    dayCap
  );
  const floor = Math.max(maxQ * 1.05, Math.min(4, vol * 0.3));
  let lr = Math.max(rem * 0.45, maxQ * 1.12, (rem / (easyCount + 1)) * 1.3);
  lr = Math.min(lr, cap, rem - floorPerRun * easyCount);
  lr = Math.max(lr, Math.min(floor, rem - floorPerRun * 0.85 * easyCount));
  const weights = [1.15, 1, 0.9, 0.85, 0.8, 0.75].slice(0, easyCount);
  const wsum = weights.reduce((a, b) => a + b, 0);
  let easies = weights.map((x) => Math.max(floorPerRun, r1(((rem - lr) * x) / wsum)));
  const mx = Math.max(...easies);
  const easyCeil = Math.min(14, Math.max(lr * 0.5, Math.min(12, lr * 0.7)));
  if (mx >= easyCeil && mx > 0) {
    const sc = easyCeil / mx;
    easies = easies.map((e) => Math.max(floorPerRun, r1(e * sc)));
  }
  const mxE = easies.length ? Math.max(...easies) : 0;
  if (mxE > lr) lr = mxE * 1.05;
  lr = r1(Math.max(lr, floor));
  if (!mlrShare)
    return {
      lr,
      easies
    };
  const mlr = r1(Math.min(lr * mlrShare, lr * 0.85));
  const free = easies.reduce((s, e) => s + Math.max(0, e - floorPerRun), 0);
  const first = easies.length ? easies[0] : 0;
  const need = Math.max(0, mlr - first);
  if (easies.length < 1 || need > free + 0.01)
    return {
      lr,
      easies,
      mlr: 0
    };
  if (need > 0) {
    let left = need;
    easies
      .map((e, i) => ({
        e,
        i
      }))
      .sort((a, b) => b.e - a.e)
      .forEach((x) => {
        if (left <= 0.01) return;
        const can = Math.max(0, easies[x.i] - floorPerRun);
        const take = Math.min(can, left);
        easies[x.i] = r1(easies[x.i] - take);
        left -= take;
      });
  }
  easies.shift();
  return {
    lr,
    easies,
    mlr
  };
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/vdot/calculateVDOT.ts
/** VDOT iz trke: `distM` metara za `sec` sekundi. */
function vdotFromRace(distM, sec) {
  const tMin = sec / 60;
  return vo2AtV(distM / tMin) / pctVo2max(tMin);
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/generator/assess.ts
/**
 * Procena: polazni VDOT iz PB-a, projektovani VDOT na dan trke
 * (`vdot0 + rampa × min(nedelje−2, 20)`), predviđeno vreme i — ako je cilj
 * zadat — da li je realan (tolerancija zaokruživanja 0,3 VDOT).
 */
function assess(pb, weeks, intensity, goalSec, raceDistM) {
  const dist = raceDistM || 5e3;
  const vdot0 = vdotFromRace(pb.distM, pb.sec);
  const rampW = Math.min(Math.max(weeks - 2, 1), 20);
  const vdotGoal = vdot0 + VDOT_RAMP_PER_WEEK[intensity] * rampW;
  const predictedSec = raceTimeForVdot(vdotGoal, dist);
  const out = {
    vdot0: r1(vdot0),
    vdotGoal: r1(vdotGoal),
    predictedSec,
    realno: null,
    goalVdot: null
  };
  if (goalSec) {
    const gv = vdotFromRace(dist, goalSec);
    out.goalVdot = r1(gv);
    out.realno = gv <= vdotGoal + 0.3;
  }
  return out;
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/generator/daySlots.ts
const DOW_NAMES = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
const dowName = (d) => DOW_NAMES[d - 1] ?? '?';
/** Izbor dana za lagana trčanja kad korisnik nije izabrao konkretne dane. */
const EASY_DAY_ORDER = [1, 3, 5, 2, 6, 4, 7];
/** Dani 1–7 iz opcionog niza; sve što nije konačan broj se odbacuje (nepouzdan ulaz, ne NaN). */
const asDays = (a) =>
  (Array.isArray(a) ? a : [])
    .filter((x) => typeof x === 'number' && Number.isFinite(x))
    .map(Math.round)
    .filter((d) => d >= 1 && d <= 7);
/**
 * Promenljiv broj dana trčanja (2–7) i broj kvalitetnih sesija (1–2). Kvalitet
 * ≤1 kad je ≤3 dana (nema prostora za oporavak između dva teška). Dugo trčanje
 * je `lrDow` (podrazumevano nedelja). Kvalitet ide na proporcionalne pozicije
 * unutar preostalih dana. `wantMidweekLong` traži još jedan duži dan (HM, 42K).
 */
function buildDaySlots(runDaysIn, qualityCount, prefs, wantMidweekLong) {
  const runDays = Math.max(2, Math.min(7, Math.round(runDaysIn)));
  const effQ = runDays <= 3 ? Math.min(qualityCount, 1) : Math.min(qualityCount, 2);
  const lrPref = prefs?.lrDow;
  const lrDow = typeof lrPref === 'number' && lrPref >= 1 && lrPref <= 7 ? Math.round(lrPref) : 7;
  const slots = {
    1: 'rest',
    2: 'rest',
    3: 'rest',
    4: 'rest',
    5: 'rest',
    6: 'rest',
    7: 'rest'
  };
  slots[lrDow] = 'lr';
  let qSel = asDays(prefs?.qDows).filter((d) => d !== lrDow);
  qSel = [...new Set(qSel)].slice(0, effQ).sort((a, b) => a - b);
  let runSel = [...new Set(asDays(prefs?.runDows))].sort((a, b) => a - b);
  let chosen;
  if (runSel.length >= 2) {
    if (!runSel.includes(lrDow)) runSel.push(lrDow);
    runSel = [...new Set(runSel)].sort((a, b) => a - b);
    qSel = qSel.filter((d) => runSel.includes(d));
    chosen = runSel.filter((d) => d !== lrDow).sort((a, b) => a - b);
  } else {
    const order = EASY_DAY_ORDER.filter((d) => d !== lrDow && !qSel.includes(d));
    const need = runDays - 1 - qSel.length;
    chosen = qSel.concat(order.slice(0, Math.max(need, 0))).sort((a, b) => a - b);
  }
  const len = chosen.length;
  if (qSel.length) {
    chosen.forEach((dow) => {
      if (dow === qSel[0]) slots[dow] = 'q1';
      else if (qSel[1] != null && dow === qSel[1]) slots[dow] = 'q2';
      else slots[dow] = 'easy';
    });
    if (qSel.length === 1 && effQ === 2) {
      const rest = chosen.filter((d) => slots[d] === 'easy');
      if (rest.length) {
        const pick = rest[Math.min(rest.length - 1, Math.round((rest.length * 2) / 3))];
        if (pick !== void 0) slots[pick] = 'q2';
      }
    }
  } else {
    const idx = (num, den) => Math.min(len - 1, Math.max(0, Math.round((len * num) / den)));
    let qIdx = [];
    if (effQ === 2) qIdx = [idx(1, 3), idx(2, 3)];
    else if (effQ === 1) qIdx = [idx(1, 2)];
    qIdx = [...new Set(qIdx)];
    chosen.forEach((dow, i) => {
      if (qIdx[0] === i) slots[dow] = 'q1';
      else if (qIdx[1] === i) slots[dow] = 'q2';
      else slots[dow] = 'easy';
    });
  }
  if (wantMidweekLong) {
    const easy = [1, 2, 3, 4, 5, 6, 7].filter((d) => slots[d] === 'easy');
    if (easy.length >= 2) {
      const neighbours = (d) => [d === 1 ? 7 : d - 1, d === 7 ? 1 : d + 1];
      const beside = (d) => (neighbours(d).some((x) => slots[x] === 'lr') ? 1 : 0);
      const distance = (d) => {
        const x = Math.abs(d - lrDow);
        return Math.min(x, 7 - x);
      };
      const best = easy
        .map((d) => ({
          d,
          touching: beside(d),
          far: distance(d)
        }))
        .sort((a, b) => a.touching - b.touching || b.far - a.far)[0];
      if (best) slots[best.d] = 'mlr';
    }
  }
  return slots;
}
/**
 * Upozorenja za korisnički izbor dana — NE blokira (sve je izmenjivo), samo
 * kaže. Teški dani zaredom (kvalitet ili LR, uključujući prelaz Ned→Pon) i dva
 * duga trčanja zaredom. Srednje-dugo uz kvalitet se NE broji (to je obrazac,
 * ne greška — upozorenje koje se javi skoro uvek je šum).
 */
function dayPreferenceWarnings(slots) {
  const hard = (d) => slots[d] === 'q1' || slots[d] === 'q2' || slots[d] === 'lr';
  const out = [];
  for (let d = 1; d <= 7; d++) {
    const nxt = d === 7 ? 1 : d + 1;
    if (hard(d) && hard(nxt))
      out.push(
        `Teški dani zaredom: ${dowName(d)} → ${dowName(nxt)} — hard/easy princip preporučuje lak dan ili odmor između.`
      );
  }
  for (let d = 1; d <= 7; d++) {
    const nxt = d === 7 ? 1 : d + 1;
    if ((slots[d] === 'mlr' && slots[nxt] === 'lr') || (slots[d] === 'lr' && slots[nxt] === 'mlr'))
      out.push(
        `Dva duga trčanja zaredom: ${dowName(d)} → ${dowName(nxt)} — dugo i srednje-dugo trčanje traže lak dan između.`
      );
  }
  return out;
}
/** Snaga ide na prvi slobodan („rest") dan Pon–Sub; `null` ako ga nema. */
function pickStrengthDay(slots) {
  for (let d = 1; d <= 6; d++) if (slots[d] === 'rest') return d;
  return null;
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/generator/focus.ts
/**
 * Čemu nedelja služi — gradi se IZ STVARNIH sesija te nedelje (faza se već
 * prikazuje pored). „DELOAD" ostaje PREFIKS: `weekPhase` i dnevni izveštaj
 * prepoznaju rasterećenje po toj reči.
 */
function weekFocus(days, st) {
  if (st.isRace) return 'TRKA';
  if (st.isDeload) return 'DELOAD — obim dole, ostaje kratka oštrina';
  if (st.isBase) return 'Baza — aerobni obim, bez kvaliteta';
  const kinds = [];
  for (const d of days) {
    const k = d.session?.kind;
    if (k && !kinds.includes(k)) kinds.push(k);
  }
  if (!kinds.length) return st.isTaper1 || st.isTaper2 ? 'Taper — obim dole, oštrina ostaje' : '';
  const list = kinds.join(' + ');
  if (st.isTaper1 || st.isTaper2) return `Taper · ${list}`;
  return list;
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/generator/validateInput.ts
const INTENSITIES = ['kons', 'std', 'agr'];
const plausiblePace = (distM, sec) => {
  const pace = sec / (distM / 1e3);
  return pace >= 140 && pace <= 1200;
};
/** `null` = ulaz je upotrebljiv; inače poruka za korisnika (srpski, bez tehničkog žargona). */
function validateInput(inp) {
  if (typeof inp.raceDistM !== 'number' && inp.raceDistM !== void 0)
    return 'Distanca trke mora biti broj (metri).';
  if (!inp.pb || !(inp.pb.sec > 0) || !(inp.pb.distM > 0))
    return 'Neispravan skorašnji rezultat (distanca i vreme moraju biti veći od nule).';
  if (!(inp.weeklyKm > 0) || !Number.isFinite(inp.weeklyKm))
    return 'Nedeljna kilometraža mora biti veća od nule.';
  if (!INTENSITIES.includes(inp.intensity))
    return 'Nepoznat tempo napretka (očekuje se „kons", „std" ili „agr").';
  if (inp.volIntensity !== void 0 && !INTENSITIES.includes(inp.volIntensity))
    return 'Nepoznat tempo rasta obima (očekuje se „kons", „std" ili „agr").';
  if (
    !Number.isFinite(inp.pb.sec) ||
    !Number.isFinite(inp.pb.distM) ||
    !plausiblePace(inp.pb.distM, inp.pb.sec)
  )
    return 'Skorašnji rezultat nije verodostojan (tempo van opsega 2:20–20:00 po kilometru).';
  const goal = inp.goalSec;
  if (goal && !(Number.isFinite(goal) && plausiblePace(inp.raceDistM ?? 5e3, goal)))
    return 'Ciljno vreme nije verodostojno (tempo van opsega 2:20–20:00 po kilometru).';
  return null;
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/generator/runWalk.ts
/** Trčanje/hod lestvica za početnike: nedelja 1–4 → 1:1, 2:1, 3:1, 5:1. Van lestvice `null`. */
function runWalkForWeek(weekIdx) {
  if (weekIdx < 1 || weekIdx > 4) return null;
  const step = RUN_WALK_LADDER[weekIdx - 1];
  return step
    ? {
        runSec: step.runSec,
        walkSec: step.walkSec,
        label: step.label
      }
    : null;
}
/** „3 min trčanje / 1 min hod" (celi minuti bez decimale, inače jedna decimala). */
function runWalkText(rw) {
  if (!rw) return '';
  const f = (s) =>
    s >= 60
      ? s / 60 === Math.floor(s / 60)
        ? `${s / 60} min`
        : `${(s / 60).toFixed(1)} min`
      : `${s} s`;
  return `${f(rw.runSec)} trčanje / ${f(rw.walkSec)} hod`;
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/sessions/longRun.ts
/**
 * Uputstvo za gorivo na dugom trčanju: preko praga trajanja (`fuelFromMin`) telo troši
 * zalihe glikogena brže nego što ih nadoknađuje, a CREVO mora da nauči da prima ugljene
 * hidrate — adaptacija traži 4–6 nedelja vežbanja, a dugo trčanje je jedina prilika.
 * Jača preporuka (60–90 g/h) je maratonska odluka vezana za profil, ne za trajanje samo.
 */
function fuelText(km, longRunPaceSecPerKm, h) {
  const fromMin = h.fuelFromMin;
  if (!fromMin || !(longRunPaceSecPerKm > 0)) return '';
  const min = (km * longRunPaceSecPerKm) / 60;
  if (min < fromMin) return '';
  const strongFrom = h.fuelStrongFromMin;
  return !!strongFrom && min >= strongFrom
    ? ` · ${Math.round(min)} min — uvežbaj gorivo: 60–90 g ugljenih hidrata na sat, prvi unos oko 40. minuta pa na svakih 20–25 min. Crevo se na to navikava nedeljama; ne improvizuj na dan trke.`
    : ` · ${Math.round(min)} min — uvežbaj gorivo: 30–60 g ugljenih hidrata na sat, prvi unos oko 40. minuta`;
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/generator/volume.ts
/**
 * Nedeljni korak rasta = clamp(obim × procenat, min, max).
 *
 * Procenat sam je POGREŠNA MERA na niskom obimu (+5% od 10 km/ned je 0,5 km —
 * to je šum, ne napredak); rizik povrede prati apsolutno opterećenje tkiva.
 * Zato apsolutni pod, a na velikom obimu apsolutni plafon.
 */
function rampStep(h, vol, intensity) {
  const k = h.rampStep[intensity];
  return Math.max(k.min, Math.min(k.max, vol * k.pct));
}
/**
 * Vrhunac nedeljnog obima. Tri ograničenja redom: (1) koliko stopa rasta
 * dozvoli u raspoloživim rampnim nedeljama, (2) ODREDIŠTE distance skalirano
 * polaznom tačkom (najviše ~75% iznad onoga što već trči, uz apsolutni pod od
 * +20 km), (3) apsolutni plafon protiv degenerisanog unosa. Nikad ispod unetog.
 */
function peakVolume(h, cur, rampSteps, intensity) {
  let v = cur;
  for (let i = 0; i < rampSteps; i++) v += rampStep(h, v, intensity);
  const destination = Math.min(h.targetVolumeKm, Math.max(cur * 1.75, cur + 20));
  const upper = Math.max(cur * 1.1, destination);
  return Math.max(cur, Math.min(v, upper, h.hardCapKm));
}
/**
 * Plafon dugog trčanja [km]: udeo nedelje (na niskom obimu veći — trkač mora
 * da bude sposoban da pretrči samu distancu), vremenski plafon i apsolutni.
 */
function longRunCap(h, vol, longRunPaceSecPerKm) {
  const lr = h.longRun;
  const timeCap = longRunPaceSecPerKm > 0 ? (lr.timeCapMin * 60) / longRunPaceSecPerKm : Infinity;
  const share = Math.max(vol * lr.share, Math.min(lr.lowVolumeCapKm, vol * lr.lowVolumeShare));
  return Math.min(share, timeCap, lr.absCapKm);
}
//#endregion
//#region ../sub-19-baseline/web/src/domain/training/generator/generatePlan.ts
const hasKm = (d) => typeof d.km === 'number';
const kmOf = (d) => d.km || 0;
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const sumKm = (days) => days.reduce((s, d) => s + kmOf(d), 0);
const maxOf = (xs) => (xs.length ? Math.max(...xs) : 0);
const D = {
  easy: (dow, km, desc) => ({
    dow,
    tag: 'lako',
    km,
    desc
  }),
  longRun: (dow, km, desc) => ({
    dow,
    tag: 'lr',
    km,
    desc
  }),
  race: (dow, km, desc) => ({
    dow,
    tag: 'trka',
    km,
    desc
  }),
  strength: (dow, desc) => ({
    dow,
    tag: 'snaga',
    km: null,
    desc
  }),
  runWalk: (dow, km, desc, rw) => ({
    dow,
    tag: 'rw',
    km,
    desc,
    runWalk: {
      runSec: rw.runSec,
      walkSec: rw.walkSec,
      label: rw.label
    }
  })
};
const REST = (dow, desc) => ({
  dow,
  rest: true,
  desc: desc || null
});
/** Zamenjuje vodeći „<km> km" u opisu novom vrednošću (opis i kilometraža se ne smeju razići). */
function renameKm(d) {
  d.desc = (d.desc || '').replace(/^[\d.,]+ km/, `${d.km} km`);
}
function generatePlan(inp) {
  const raceDistM = inp.raceDistM || 5e3;
  const maybeProfile = profileFor(raceDistM);
  if (!maybeProfile)
    return {
      error: 'Nepodržana distanca. Generator pravi planove za 5K, 10K, polumaraton i maraton.'
    };
  const prof = maybeProfile;
  const invalid = validateInput(inp);
  if (invalid) return { error: invalid };
  const startDate = parseIsoDate(inp.startDate);
  const raceDate = parseIsoDate(inp.raceDate);
  if (!startDate) return { error: 'Datum početka nije ispravan datum (očekuje se GGGG-MM-DD).' };
  if (!raceDate) return { error: 'Datum trke nije ispravan datum (očekuje se GGGG-MM-DD).' };
  const start = mondayOnOrBefore(startDate);
  const daysN = diffDays(start, raceDate);
  const weeks = Math.floor(daysN / 7) + 1;
  if (weeks < prof.product.minWeeks)
    return {
      error: `Manje od ${brojNedelja(prof.product.minWeeks)} do trke (minimum za ${distUReceni(prof.product.name)}) — puna periodizacija nije moguća.`
    };
  if (weeks > 104)
    return {
      error: `Više od ${brojNedelja(104)} (2 godine) — proveri datum trke, verovatno je pogrešno unet.`
    };
  const runDays = Math.max(2, Math.min(7, softInt(inp.runDays, 4)));
  let qWant = Math.max(1, Math.min(2, softInt(inp.quality, 2)));
  const H = prof.heuristic;
  const volIntensity = inp.volIntensity ?? inp.intensity;
  const QUAL2_MIN_KM = prof.product.qual2MinKm;
  const taperW = Math.max(1, Math.min(3, H.taperWeeks || 1));
  const lastWorking = weeks - 1 - taperW;
  const cur0 = Math.max(8, Math.min(inp.weeklyKm, 120));
  const deload0 = Math.floor(lastWorking / 4);
  const peakEstimate = peakVolume(H, cur0, Math.max(lastWorking - deload0, 1), volIntensity);
  const mlrCfg = H.midweekLong;
  const wantMLR = !!(mlrCfg && runDays >= mlrCfg.minDays && peakEstimate >= mlrCfg.minKm);
  const qCut = qWant > 1 && peakEstimate < QUAL2_MIN_KM;
  if (qCut) qWant = 1;
  const slots = buildDaySlots(
    runDays,
    qWant,
    {
      lrDow: inp.lrDow,
      qDows: inp.qDows,
      runDows: inp.runDows
    },
    wantMLR
  );
  const dayWarnings = dayPreferenceWarnings(slots);
  const effQ = Object.values(slots).filter((r) => r === 'q1' || r === 'q2').length;
  const a = assess(inp.pb, weeks, inp.intensity, inp.goalSec || null, raceDistM);
  if (inp.goalSec && a.realno === false) {
    const ORDER = [
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
        ' je iznad onoga što ovaj plan realno donosi — na tempu napretka „' +
        chosenName +
        '" predviđanje za dan trke je ' +
        fmtClock(a.predictedSec) +
        '. ' +
        (reaches
          ? 'Tempo napretka „' + reaches[1] + '" bi ga dostigao.'
          : 'Nijedan tempo napretka ga ne dostiže za ' +
            brojNedelja(weeks) +
            ' — treba ti više vremena do trke ili blaži cilj.') +
        ' Plan i dalje računa tempo trke IZ TVOG CILJA, ne iz predviđanja, pa će kvalitetni treninzi biti brži nego što forma trenutno nosi. To je namerno — ali znaj da je tako.'
    );
  }
  const trainedRecently = inp.trainedRecently !== false;
  const isBeginner = !trainedRecently;
  const wantedBase = isBeginner ? prof.product.baseWeeksBeginner : 0;
  const baseWeeks = wantedBase
    ? Math.max(0, Math.min(wantedBase, weeks - prof.product.minWeeks))
    : 0;
  const rwWeeks = isBeginner ? Math.min(4, baseWeeks) : 0;
  if (qCut)
    dayWarnings.push(
      'Plan daje JEDAN kvalitetan trening nedeljno umesto dva. Dva kvaliteta traže bar ~' +
        QUAL2_MIN_KM +
        ' km/ned, a ovaj plan i na vrhuncu dostiže oko ' +
        Math.round(peakEstimate) +
        ' km/ned — ispod toga bi oni sami bili većina nedelje, a za lagano trčanje (koje gradi bazu) ne bi ostalo mesta. Za dva kvaliteta treba ti viša polazna baza ili više nedelja do trke.'
    );
  const volFloor = r1(runDays * MIN_KM_PER_RUN);
  if (inp.weeklyKm > 0 && inp.weeklyKm < volFloor)
    dayWarnings.push(
      'Na ' +
        runDays +
        ' dana trčanja minimum je oko ' +
        volFloor +
        ' km/ned (ispod ~1,5 km po treningu nema smisla). Tražio si ' +
        inp.weeklyKm +
        ' km — plan će biti veći od toga. Za tako nizak obim uzmi manje dana trčanja.'
    );
  const minRunDaysRec = prof.product.recommendedMinRunDays;
  if (minRunDaysRec && runDays < minRunDaysRec)
    dayWarnings.push(
      'Za ' +
        distUReceni(prof.product.name) +
        ' se preporučuje bar ' +
        minRunDaysRec +
        ' dana trčanja nedeljno; izabrao si ' +
        runDays +
        '. Na tako malo dana dugo trčanje postaje polovina cele nedelje, pa se obim ne može rasporediti a da svaki trening ne bude dugačak. Plan je napravljen, ali računaj na duže oporavke i manje prostora za kvalitet.'
    );
  if (isBeginner && rwWeeks < 4)
    dayWarnings.push(
      'Plan je prekratak za pun početnički uvod: trčanje/hod traje mesec dana (4 nedelje), a ovde staje ' +
        rwWeeks +
        '. Kvalitetni treninzi počinju dok si još na pauzama za hod — uzmi ih blaže, ili pomeri trku za koju nedelju.'
    );
  if (isBeginner && inp.weeklyKm > 30)
    dayWarnings.push(
      'Označio si da TEK POČINJEŠ da trčiš, a uneo ' +
        inp.weeklyKm +
        ' km/ned. To se ne slaže: mesec dana trčanja/hoda (1:1 → 5:1) je uvod za nekoga ko gradi prvih ~10–25 km/ned. Plan je napravljen, ali će bazna faza biti nesrazmerno velika, a skok kad uđu kvalitetni treninzi nagliji nego što je bezbedno. Ako već redovno trčiš toliko, vrati se i reci da si trenirao — dobićeš plan bez početničkog uvoda. Ako zaista počinješ, unesi obim koji sada stvarno trčiš.'
    );
  const qualWeeks = weeks - baseWeeks;
  const vols = [];
  let cur = cur0;
  const peakTarget = peakEstimate;
  const next = (v) => Math.min(v + rampStep(H, v, volIntensity), peakTarget);
  /** Najviši dosadašnji ciljni obim, ali ne ispod tekuće vrednosti `cur`. */
  const peak = (arr) => Math.max(...arr, cur);
  for (let w = 1; w <= weeks; w++)
    if (w === weeks) vols.push(r1(peak(vols) * H.raceWeekFactor));
    else if (w === weeks - 1) vols.push(r1(peak(vols.length ? vols : [cur]) * H.taperFactor));
    else if (taperW >= 2 && w > lastWorking)
      vols.push(r1(peak(vols.length ? vols : [cur]) * (H.firstTaperFactor || 0.82)));
    else if (w <= baseWeeks) {
      if (w % 4 === 0 && vols.length) vols.push(r1(at(vols, vols.length - 1) * H.deloadFactor));
      else {
        const prevB = vols.length ? at(vols, vols.length - 1) : cur;
        const baseB =
          w > 1 && (w - 1) % 4 === 0 && vols.length >= 2 ? at(vols, vols.length - 2) : prevB;
        cur = vols.length ? next(baseB) : cur;
        vols.push(r1(cur));
      }
    } else if (w % 4 === 0 && w < lastWorking)
      vols.push(r1(at(vols, vols.length - 1) * H.deloadFactor));
    else {
      const prev = vols.length ? at(vols, vols.length - 1) : cur;
      cur = next(w > 1 && (w - 1) % 4 === 0 ? at(vols, vols.length - 2) : prev);
      vols.push(r1(cur));
    }
  for (let w = baseWeeks + 1; w <= lastWorking; w++) {
    if (w % 4 === 0) continue;
    if (at(vols, w - 1) < peakTarget * 0.995) continue;
    vols[w - 1] = r1(peakTarget * at(UNDULATION, (w - 1) % 4));
  }
  const rampWeeks = Math.min(weeks - 2, 20);
  const racePace = Math.round((inp.goalSec || a.predictedSec) / (raceDistM / 1e3));
  const raceDow = daysN - (weeks - 1) * 7 + 1;
  const plan = {
    weeks: [],
    pred: [],
    qs: {},
    meta: {
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
    }
  };
  const strengthDow = runDays <= 5 ? pickStrengthDay(slots) : null;
  /** Plafon udela dugog trčanja na SASTAVLJENOJ nedelji (ne na ciljnom obimu). */
  const clampLongRun = (alloc, qKms) => {
    const c = H.longRunMaxShare;
    if (!c || !(alloc.lr > 0)) return alloc;
    const rest = sum(qKms) + (alloc.mlr || 0) + sum(alloc.easies);
    const maxQ = maxOf(qKms);
    const ceiling = Math.max(r1((rest * c) / (1 - c)), r1(maxQ * 1.05));
    if (alloc.lr > ceiling) alloc.lr = ceiling;
    return alloc;
  };
  const pushPredQs = (day, w, doesNotMeasure) => {
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
  const lrCapFor = (factor) =>
    factor !== null && factor !== 1
      ? (v, pl) => longRunCap(H, v, pl) * factor
      : (v, pl) => longRunCap(H, v, pl);
  for (let w = 1; w <= weeks; w++) {
    const vdotW = a.vdot0 + ((a.vdotGoal - a.vdot0) * Math.min(w, rampWeeks)) / rampWeeks;
    const pI = prof.intervalPaceForWeek(paceForZone(vdotW, 'I'), racePace, weeks - w);
    const pT = paceForZone(vdotW, 'T');
    const pE = paceForZone(vdotW, 'E');
    const pLR = paceForZone(vdotW, 'LR');
    const pR = paceForZone(vdotW, 'R');
    const vol = at(vols, w - 1);
    const isDeload = w % 4 === 0 && w < lastWorking;
    const isTaper1 = w === weeks - 1;
    const isRace = w === weeks;
    const isTaper2 = taperW >= 2 && w > lastWorking && w < weeks - 1;
    const days = [];
    if (isRace) buildRaceWeek();
    else if (w <= baseWeeks) buildBaseWeek();
    else buildQualityWeek();
    if (!isTaper1 && !isTaper2 && !isRace && plan.weeks.length) {
      const prevW = at(plan.weeks, plan.weeks.length - 1);
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
        const limit = prevVol + rampStep(H, prevVol, volIntensity) * DELIVERED_GROWTH_FACTOR;
        if (now > limit) {
          const easy = days.filter(
            (d) =>
              hasKm(d) &&
              (d.tag === 'lako' || d.tag === 'rw' || (d.tag === 'lr' && !!d.mlr)) &&
              d.km > floorKm
          );
          let excess = now - limit;
          easy.sort((x, y) => y.km - x.km);
          for (const d of easy) {
            if (excess <= 0.05) break;
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
    if ((isTaper1 || isTaper2) && plan.weeks.length) {
      const pik = Math.max(...plan.weeks.map((pw) => sumKm(pw.days)), 0);
      const limit = pik * (isTaper1 ? H.taperFactor : H.firstTaperFactor || 0.82);
      const now = sumKm(days);
      if (pik > 0 && now > limit) {
        const floorKm = perRunFloor(vol, runDays);
        const maxQ = Math.max(...days.filter((d) => d.session).map(kmOf), 0);
        const lrDay = days
          .filter((d) => d.tag === 'lr' || d.tag === 'rw')
          .sort((x, y) => (y.km || 0) - (x.km || 0))[0];
        const floorFor = (d) => (d === lrDay ? Math.max(floorKm, r1(maxQ * 1.05)) : floorKm);
        const soft = days.filter((d) => !d.rest && !d.session && hasKm(d) && d.km > 0);
        const slack = soft.reduce((s, d) => s + Math.max(0, d.km - floorFor(d)), 0);
        const need = Math.min(now - limit, slack);
        if (slack > 0 && need > 0.05) {
          const f = need / slack;
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
      focus: weekFocus(days, {
        isDeload,
        isTaper1,
        isTaper2,
        isRace,
        isBase: w <= baseWeeks
      }),
      ...(isTaper1 || isTaper2 ? { taper: true } : {})
    });
    function buildRaceWeek() {
      const rp = racePace;
      const distKm = (raceDistM / 1e3).toFixed(1).replace(/\.0$/, '').replace('.', ',');
      const shakeA = r1(Math.max(1.5, Math.min(3, vol * 0.22)));
      const shakeB = r1(Math.max(1, Math.min(2, vol * 0.15)));
      const activationWu = r1(Math.max(1, Math.min(1.5, vol * 0.11)));
      const activationCd = r1(Math.max(0.8, Math.min(1, vol * 0.08)));
      const activationN = 6;
      const activationPace = Math.max(rp - 4, pI - 6);
      const proto = {
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
        0: (dw) =>
          D.race(
            dw,
            raceDistM / 1e3,
            `🏁 TRKA ${distKm} km (${prof.product.name}) — cilj ${fmtClock(inp.goalSec || a.predictedSec)} / ritam ${fmtClock(rp)}/km`
          )
      };
      for (let dw = 1; dw <= raceDow; dw++) {
        const mk = proto[String(dw - raceDow)];
        days.push(mk ? mk(dw) : REST(dw));
      }
      const activation = days.find((d) => d.dow === raceDow - 2 && !!d.session);
      if (activation) pushPredQs(activation, w, true);
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
        if (repl.session) pushPredQs(repl, pw.w, off === -2);
        pw.vol = r1(sumKm(pw.days));
      }
      if (overwroteLongRun && plan.weeks.length) {
        const pw = at(plan.weeks, plan.weeks.length - 1);
        if (!pw.days.some((d) => (d.tag === 'lr' && !d.mlr) || d.tag === 'rw'))
          pw.days = pw.days.map((d) =>
            d.tag === 'lr' && d.mlr ? D.easy(d.dow, d.km, `${d.km} km lako (Z2)`) : d
          );
      }
    }
    function buildBaseWeek() {
      const mlrShare = wantMLR && mlrCfg ? mlrCfg.share : 0;
      const baseStart = H.baseLongRunStart;
      const bazaF =
        baseStart && baseWeeks > 0 ? baseStart + (1 - baseStart) * (w / Math.max(baseWeeks, 1)) : 1;
      const lrCapBase =
        bazaF < 1 ? (v, pl) => longRunCap(H, v, pl) * bazaF : (v, pl) => longRunCap(H, v, pl);
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
          if (rwLR)
            days.push(
              D.runWalk(
                dow,
                alloc.lr,
                `${alloc.lr} km — ${runWalkText(rwLR)}, najduže trčanje te nedelje`,
                rwLR
              )
            );
          else
            days.push(
              D.longRun(
                dow,
                alloc.lr,
                `${alloc.lr} km lako-dugo (Z2) @ ~${fmtClock(pLR)}/km — bazna faza, bez kvaliteta${fuelText(alloc.lr, pLR, H)}`
              )
            );
          continue;
        }
        if (role === 'mlr' && (alloc.mlr ?? 0) > 0 && !runWalkForWeek(w <= rwWeeks ? w : 0)) {
          const m = D.longRun(
            dow,
            alloc.mlr,
            `${alloc.mlr} km srednje-dugo (Z2) @ ~${fmtClock(pLR)}/km — drugo duže trčanje u nedelji`
          );
          m.mlr = true;
          days.push(m);
          continue;
        }
        let km = alloc.easies[ei] != null ? alloc.easies[ei] : 4;
        km = capAfterLongRun(dow, km);
        const rw = runWalkForWeek(w <= rwWeeks ? w : 0);
        if (rw) days.push(D.runWalk(dow, km, `${km} km — ${runWalkText(rw)}`, rw));
        else {
          const strides =
            ei % 2 === 0 ? ' + 6×20 s ubrzanja (lagani ubrzani koraci, pun oporavak)' : '';
          days.push(D.easy(dow, km, `${km} km lako (Z2) @ ~${fmtClock(pE)}/km${strides}`));
        }
        ei++;
      }
    }
    /** Među-nedeljno susedstvo: lak dan odmah posle LR-a prethodne nedelje ne sme biti skoro isti kao LR. */
    function capAfterLongRun(dow, km) {
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
    function buildQualityWeek() {
      const qualW = w - baseWeeks;
      let volQ = vol;
      {
        const cycleF = prof.longRunCycle
          ? prof.longRunCycle(w, {
              weeks,
              baseWeeks,
              taperW,
              isDeload
            })
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
      const isFirstQualWeek = qualW === 1 && (baseWeeks > 0 || !trainedRecently);
      const sessions = {};
      for (let dow = 1; dow <= 7; dow++) {
        const role = slots[dow];
        if (role !== 'q1' && role !== 'q2') continue;
        if (isDeload) {
          if (role === 'q1') sessions[dow] = mkDeloadSharpness(dow, volQ, pR);
          continue;
        }
        if (isFirstQualWeek && role === 'q2') continue;
        if (isFirstQualWeek && role === 'q1') {
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
          ctx: {
            weeks,
            w,
            taperW
          }
        });
      }
      const sessionList = () => Object.values(sessions);
      const easyDowsCount = [1, 2, 3, 4, 5, 6, 7].filter((d) => {
        const role = slots[d];
        return (
          role === 'easy' || role === 'mlr' || ((role === 'q1' || role === 'q2') && !sessions[d])
        );
      }).length;
      const mlrShareQ = wantMLR && mlrCfg ? mlrCfg.share : 0;
      const lrF = prof.longRunCycle
        ? prof.longRunCycle(w, {
            weeks,
            baseWeeks,
            taperW,
            isDeload
          })
        : 1;
      const lrCapW = lrCapFor(lrF !== 1 ? lrF : null);
      const allocFor = () =>
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
      if (!isTaper1) {
        const side = sessionList().filter(
          (d) => d.session.type !== 'prog' && d.session.wuKm != null && d.session.cdKm != null
        );
        if (side.length) {
          const total = () => sumKm(sessionList()) + alloc.lr + sum(alloc.easies);
          const maxAdd = H.wuCdMaxExtraKm;
          const base = side.map((d) => ({
            d,
            wu: d.session.wuKm,
            cd: d.session.cdKm
          }));
          for (let pass = 0; pass < 2; pass++) {
            const shortfall = vol - total();
            if (shortfall <= 1) break;
            const step = shortfall / (side.length * 2);
            let moved = false;
            base.forEach((b) => {
              const s = b.d.session;
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
            if (!moved) break;
            alloc = allocFor();
          }
        }
      }
      if ((isTaper1 || isTaper2) && plan.weeks.length && H.taperLongRunFactor) {
        const peakLR = Math.max(
          ...plan.weeks.map((pw) =>
            Math.max(...pw.days.filter((d) => d.tag === 'lr' || d.tag === 'rw').map(kmOf), 0)
          ),
          0
        );
        const f = isTaper1 ? H.taperLongRunFactor : 0.85;
        if (peakLR > 0) alloc.lr = r1(Math.min(alloc.lr, peakLR * f));
        const maxQt = Math.max(...sessionList().map(kmOf), 0);
        if (maxQt > 0) alloc.lr = r1(Math.max(alloc.lr, maxQt * 1.05));
        alloc.easies = alloc.easies.map((e) => Math.min(e, r1(alloc.lr * 0.8)));
        if ((alloc.mlr ?? 0) > 0) alloc.mlr = r1(Math.min(alloc.mlr, alloc.lr * 0.55));
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
          if (rwL)
            days.push(
              D.runWalk(
                dow,
                alloc.lr,
                `${alloc.lr} km — ${runWalkText(rwL)}, najduže trčanje te nedelje`,
                rwL
              )
            );
          else {
            const finish =
              !isTaper1 && !isDeload && prof.longRunFinish
                ? prof.longRunFinish(
                    prof.phase(Math.max(w - baseWeeks, 1), weeks - baseWeeks),
                    Math.max(w - baseWeeks, 1),
                    alloc.lr,
                    racePace,
                    prof.paceStrategy ? prof.paceStrategy(racePace) : null,
                    prof.longRunCycle
                      ? prof.longRunCycle(w, {
                          weeks,
                          baseWeeks,
                          taperW,
                          isDeload
                        })
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
        if (role === 'mlr' && (alloc.mlr ?? 0) > 0) {
          const m = D.longRun(
            dow,
            alloc.mlr,
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
        let km = alloc.easies[ei] != null ? alloc.easies[ei] : 4;
        km = capAfterLongRun(dow, km);
        const rwQ = runWalkForWeek(w <= rwWeeks ? w : 0);
        if (rwQ) days.push(D.runWalk(dow, km, `${km} km — ${runWalkText(rwQ)}`, rwQ));
        else {
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
  {
    const first = plan.weeks.filter((wk) => !wk.deload && wk.w <= 3);
    if (first.length && inp.weeklyKm) {
      const actual = sumKm(at(first, 0).days);
      if (1 - actual / inp.weeklyKm > 0.15) {
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
  if (!inp._noSuggest && inp.weeklyKm > 0) {
    const working = plan.weeks.filter((wk, i) => !wk.deload && i < plan.weeks.length - 2);
    const pik = working.length ? Math.max(...working.map((wk) => sumKm(wk.days))) : 0;
    if (pik > 0 && pik < inp.weeklyKm * 0.93) {
      let neededDays = null;
      for (let d = runDays + 1; d <= 7; d++) {
        const probe = generatePlan({
          ...inp,
          runDays: d,
          _noSuggest: true
        });
        if ('error' in probe || !probe.weeks) continue;
        const r2 = probe.weeks.filter((wk, i) => !wk.deload && i < probe.weeks.length - 2);
        if ((r2.length ? Math.max(...r2.map((wk) => sumKm(wk.days))) : 0) >= inp.weeklyKm * 0.93) {
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
          ' km. Razlog: dugo trčanje i lagani dani imaju bezbednosne granice, pa se veći obim ne može rasporediti na tako malo dana.' +
          (neededDays
            ? ' Za ' + inp.weeklyKm + ' km trebalo bi ti ' + neededDays + ' dana trčanja.'
            : ' Ni na 7 dana ne staje — za toliki obim verovatno trebaju dupli treninzi.')
      );
    }
    const minPeak = prof.product.minPeakKm;
    if (minPeak && pik > 0 && pik < minPeak * 0.85)
      dayWarnings.push(
        'Vrhunac plana je oko ' +
          pik.toFixed(0) +
          ' km/ned, a za ' +
          distUReceni(prof.product.name) +
          ' se orijentaciono računa sa ~' +
          minPeak +
          ' km/ned. Rast je namerno postupan (od tvojih ' +
          inp.weeklyKm +
          ' km/ned) jer je nagli skok obima najčešći uzrok povrede — ali to znači da je ovo plan da distancu ISTRČIŠ, ne da je trčiš na vreme. Za pun pristup trebalo bi ti više nedelja ili viša polazna baza.'
      );
  }
  if (plan.weeks.length) {
    const w1 = at(plan.weeks, 0);
    const keep = (d) => addDays(start, d.dow - 1) >= startDate;
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
/** Opciono celobrojno polje: ono što nije konačan, nenulti broj postaje podrazumevana vrednost (ne NaN). */
function softInt(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) && v !== 0 ? Math.round(v) : fallback;
}
/** `arr[i]` za indeks koji je po konstrukciji validan; baca ako to nije tačno (ne tiho NaN). */
function at(arr, i) {
  const v = arr[i];
  if (v === void 0) throw new RangeError(`generatePlan: indeks ${i} van niza dužine ${arr.length}`);
  return v;
}
//#endregion
export { generatePlan };
