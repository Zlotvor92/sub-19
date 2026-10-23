/* 2.4.0: kvalitet bez brojčanog tempa (plan bez pouzdanog rezultata) i nedelje početnika (sa ili bez
   rezultata). Zadato je trajanje i napor (RPE + opis); km rada su PROCENA iz E tempa (vreme × E tempo,
   kmBasis 'estimated'). Budžeti su isti udeli nedelje kao sa rezultatom (qualityBudgets); donji prag
   70% budžeta ne važi (nema tempa). Progresija (jedno nabrajanje fiksne ponude, bez petlje):
   najmanji procenjeni rad veći od prethodnog iste vrste u fazi; bez višeg nivoa ista doza druge
   strukture (Odluka 3); tek tada, uz drugi kvalitet koji se menja, zadržana doza. */

import { weekLabel } from './input.ts';
import { easyCount, weekLengths } from './lengths.ts';
import { FIVE_K_V2_POLICY as P, rulesOf, type Athlete } from './policy.ts';
import type {
  BlockSpec,
  Effort,
  PaceModel,
  Phase,
  QualityBudgets,
  QualityType,
  WeekFrame,
  Workout,
  Zone
} from './types.ts';
import {
  baseDoseKey,
  buildWorkout,
  easyPaceOf,
  intervalSession,
  qualityBudgets,
  roundRecoverySec,
  tFormOf,
  tMaxSec,
  warmupBand,
  type FeelDose,
  type FeelKind,
  type SessionResult,
  type WeekDose,
  type WeekQuality
} from './workouts.ts';

const r2 = (x: number): number => Math.round(x * 100) / 100;
const F = P.feel;

function dur(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`;
}
const rpe = (e: Effort): string =>
  e.rpeMin === e.rpeMax ? `RPE ${e.rpeMin}` : `RPE ${e.rpeMin}–${e.rpeMax}`;

const repCands = (bouts: readonly number[], min: number, max: number): FeelDose[] =>
  bouts.flatMap((len) => Array.from({ length: max - min + 1 }, (_, i) => ({ reps: min + i, len })));

/** Procenjeni km rada ponavljanja zadatih vremenom (isti obračun kao segmenti: r2 po ponavljanju). */
const secEst = (d: FeelDose, p: PaceModel): number => r2(d.reps * r2(d.len / easyPaceOf(p)));

function timed(
  type: QualityType,
  title: string,
  zone: Zone,
  d: FeelDose,
  recSec: number,
  effort: Effort,
  targetKm: number,
  p: PaceModel
): Workout {
  const band = warmupBand(targetKm);
  const blocks: BlockSpec[] = [
    { kind: 'warmup', km: band.warmupKm },
    { kind: 'reps', zone, reps: d.reps, rep: { sec: d.len }, recovery: { sec: recSec }, effort },
    { kind: 'cooldown', km: band.cooldownKm }
  ];
  return buildWorkout('quality', type, title, blocks, p);
}

interface KindSpec {
  label: string;
  budget: keyof QualityBudgets;
  /** Ponuda doza (faza određuje plafon T bloka). */
  cands: (phase: Phase) => FeelDose[];
  est: (d: FeelDose, p: PaceModel) => number;
  build: (d: FeelDose, targetKm: number, p: PaceModel) => Workout;
}

function fartlekSpec(
  label: string,
  zone: Zone,
  budget: keyof QualityBudgets,
  type: QualityType,
  o: { boutsSec: readonly number[]; minReps: number; maxReps: number; recoveryRatio: number },
  effort: Effort
): KindSpec {
  return {
    label,
    budget,
    cands: () => repCands(o.boutsSec, o.minReps, o.maxReps),
    est: secEst,
    build: (d, t, p) => {
      const rec = roundRecoverySec(d.len * o.recoveryRatio);
      return timed(
        type,
        `${label}: ${d.reps} × ${dur(d.len)} ${effort.cue} (${rpe(effort)}; oporavak ${dur(rec)} lagano)`,
        zone,
        d,
        rec,
        effort,
        t,
        p
      );
    }
  };
}

const SPEC: Record<FeelKind, KindSpec> = {
  HILLS: {
    label: 'Kratki usponi',
    budget: 'R',
    cands: () => repCands(F.hills.boutsSec, F.hills.minReps, F.hills.maxReps),
    est: secEst,
    build: (d, t, p) => {
      const e = F.effort.hills;
      const rec = roundRecoverySec(d.len * F.hills.recoveryRatio);
      return timed(
        'HILLS',
        `Kratki usponi: ${d.reps} × ${dur(d.len)} (${rpe(e)}, ${e.cue} ${dur(rec)})`,
        'R',
        d,
        rec,
        e,
        t,
        p
      );
    }
  },
  TEMPO: {
    label: 'Tempo po osećaju',
    budget: 'T',
    cands: (phase) => {
      const o = F.tempo;
      const top = tMaxSec(phase);
      const out: FeelDose[] = [];
      for (let len = o.minSec; len <= top; len += o.stepSec) out.push({ reps: 1, len });
      for (const reps of o.splitReps)
        for (let len = o.splitMinSec; len <= Math.min(o.splitMaxSec, top); len += o.splitStepSec)
          out.push({ reps, len });
      return out;
    },
    est: secEst,
    build: (d, t, p) => {
      const e = F.effort.tempo;
      const what =
        d.reps === 1
          ? dur(d.len)
          : `${d.reps} × ${dur(d.len)} (${F.tempo.recoverySec} s lagano između)`;
      return timed(
        'TEMPO_FEEL',
        `Tempo po osećaju: ${what} (${rpe(e)}, ${e.cue})`,
        'T',
        d,
        F.tempo.recoverySec,
        e,
        t,
        p
      );
    }
  },
  FARTLEK_I: fartlekSpec('Fartlek', 'I', 'I', 'FARTLEK', F.fartlek, F.effort.fartlek),
  FARTLEK_T: fartlekSpec('Fartlek', 'T', 'T', 'FARTLEK', F.fartlek, F.effort.fartlekBeginner),
  FARTLEK_RP: fartlekSpec(
    'RP po osećaju',
    'RP',
    'I',
    'FARTLEK_RP',
    F.fartlekRP,
    F.effort.fartlekRP
  ),
  RP_SHORT: {
    label: 'RP kratko',
    budget: 'I',
    cands: () => {
      const o = P.beginner.rpShort;
      return o.optionsKm.flatMap((len) =>
        Array.from({ length: o.maxReps - o.minReps + 1 }, (_, i) => ({ reps: o.minReps + i, len }))
      );
    },
    est: (d) => r2(d.reps * d.len),
    build: (d, t, p) => {
      if (p.vdot === null) throw new Error('RP kratko traži VDOT tempo (početnik sa rezultatom).');
      return intervalSession('RP', { reps: d.reps, repKm: d.len }, t, p).workout;
    }
  }
};

type Mode = 'first' | 'up' | 'alt';

/**
 * Izbor iz ponude (jedno nabrajanje): samo doze čiji procenjeni rad staje u budžet;
 * 'first' = najmanji rad ≥ repFillShare × najveći rad koji staje; 'up' = najmanji rad veći od
 * prethodnog (i duže ukupno trajanje); 'alt' = najmanji rad ≥ prethodnog (i trajanje ≥), druga
 * struktura. Pri jednakom radu ranija opcija.
 */
function choose(
  cands: readonly FeelDose[],
  est: (d: FeelDose) => number,
  budgetKm: number,
  prev: FeelDose | null,
  mode: Mode
): FeelDose | null {
  // w = procenjeni km rada (meri ga validator), t = ukupno trajanje/dužina rada (reps × len); rast
  // mora važiti za oba, da zaokruživanje procene ne proglasi kraći trening većim.
  const all = cands
    .map((d) => ({ d, w: est(d), t: d.reps * d.len }))
    .filter((x) => x.w <= budgetKm + 1e-9);
  const pw = prev ? est(prev) : 0;
  const pt = prev ? prev.reps * prev.len : 0;
  const same = (d: FeelDose): boolean =>
    prev !== null && d.reps === prev.reps && Math.abs(d.len - prev.len) < 1e-9;
  const smallest = (ok: (w: number, t: number, d: FeelDose) => boolean): FeelDose | null => {
    let best: { d: FeelDose; w: number } | null = null;
    for (const x of all) if (ok(x.w, x.t, x.d) && (!best || x.w < best.w - 1e-9)) best = x;
    return best?.d ?? null;
  };
  if (mode === 'up') return smallest((w, t) => w > pw + 1e-9 && t > pt + 1e-9);
  if (mode === 'alt') return smallest((w, t, d) => w >= pw - 1e-9 && t >= pt - 1e-9 && !same(d));
  // Prvi izbor: udeo najvećeg rada koji staje (ponuda je ograničena i kad je budžet veći), da ostane
  // mesta za rast u sledećim nedeljama faze.
  const most = Math.max(0, ...all.map((x) => x.w));
  return smallest((w) => w >= most * P.quality.repFillShare - 1e-9);
}

type Pick = { kind: FeelKind; d: FeelDose; how: Mode | 'hold' };

/** Doza vrste `kind` u nedelji: prva u fazi → 'first'; inače veći rad → druga struktura → (hold). */
function progress(
  kind: FeelKind,
  phase: Phase,
  b: QualityBudgets,
  p: PaceModel,
  prev: FeelDose | undefined,
  hold: boolean
): Pick | null {
  const s = SPEC[kind];
  const cands = s.cands(phase);
  const est = (d: FeelDose): number => s.est(d, p);
  const budget = b[s.budget];
  for (const mode of prev ? (['up', 'alt'] as const) : (['first'] as const)) {
    const d = choose(cands, est, budget, prev ?? null, mode);
    if (d) return { kind, d, how: mode };
  }
  if (
    hold &&
    prev &&
    est(prev) <= budget + 1e-9 &&
    cands.some((c) => c.reps === prev.reps && Math.abs(c.len - prev.len) < 1e-9)
  )
    return { kind, d: prev, how: 'hold' };
  return null;
}

/** Kontrolno trčanje (Odluka 5): WU, 3 km maksimalno ravnomerno, CD. Ne ulazi u udele I/T/R. */
export function testRun(targetKm: number, p: PaceModel): Workout {
  const band = warmupBand(targetKm);
  const e = F.effort.test;
  return buildWorkout(
    'quality',
    'TEST_3K',
    `Kontrolno trčanje: ${F.test.km} km ${e.cue} (${rpe(e)})`,
    [
      { kind: 'warmup', km: band.warmupKm },
      { kind: 'test', km: F.test.km, effort: e },
      { kind: 'cooldown', km: band.cooldownKm }
    ],
    p
  );
}

/** Oštrenje trkačke nedelje po osećaju: RP po osećaju, raceWeekSharpener ponavljanja, prvi izbor. */
export function feelRaceSharpener(budgetKm: number, boundKm: number, p: PaceModel): SessionResult {
  const s = SPEC.FARTLEK_RP;
  const o = P.quality.raceWeekSharpener;
  const d = choose(
    repCands(F.fartlekRP.boutsSec, o.minReps, o.maxReps),
    (x) => s.est(x, p),
    budgetKm,
    null,
    'first'
  );
  if (!d)
    return {
      ok: false,
      message: `Oštrenje po osećaju: budžet ${budgetKm} km nije dovoljan za ${o.minReps} × ${Math.min(...F.fartlekRP.boutsSec)} s.`
    };
  return { ok: true, workout: s.build(d, boundKm, p), choice: null };
}

const isBuild = (ph: Phase): boolean => ph === 'base' || ph === 'peak' || ph === 'sharpen';

/** Vrste nedelje: [glavni, drugi | null] i da li se glavni smenjuje sa `alternate` (jedan kvalitet). */
function kindsOf(
  f: WeekFrame,
  a: Athlete,
  two: boolean,
  prev: WeekDose | null
): { main: FeelKind; other: FeelKind | null; second: FeelKind | null } {
  const swap = (x: FeelKind, y: FeelKind): FeelKind[] => (prev?.kind === x ? [y, x] : [x, y]);
  const short: FeelKind = a.beginner && !a.feel ? 'RP_SHORT' : 'FARTLEK_RP';
  if (f.phase === 'base') {
    if (two) return { main: 'HILLS', other: null, second: 'TEMPO' };
    const [m, o] = swap('HILLS', 'TEMPO');
    return { main: m!, other: o!, second: null };
  }
  if (f.phase === 'peak') {
    if (a.beginner) {
      const [m, o] = swap('FARTLEK_T', 'HILLS');
      return { main: m!, other: o!, second: null };
    }
    return { main: 'FARTLEK_I', other: null, second: two ? 'TEMPO' : null };
  }
  if (f.phase === 'sharpen') return { main: short, other: null, second: two ? 'HILLS' : null };
  return { main: short, other: null, second: two && f.taperStep === 1 ? 'TEMPO' : null };
}

const fail = (message: string): WeekQuality => ({ ok: false, message });

/**
 * Kvalitet nedelje po osećaju i/ili početnika (poziva ga samo weekQuality, quality.ts).
 * - početnik: jedan kvalitet; nedelje 1–2 samo lagano + ubrzanja; bez I (vrhunac fartlek „brzo ali
 *   kontrolisano" ili kratki usponi naizmenično; oštrenje/taper RP kratko — sa rezultatom VDOT RP);
 * - bez rezultata: baza usponi + tempo (3 dana naizmenično), vrhunac fartlek (+ tempo), oštrenje RP po
 *   osećaju (+ usponi), taper RP po osećaju (+ tempo u taperu 1);
 * - kontrolno trčanje (f.test) zamenjuje glavni kvalitet; rasterećenje: glavni, pa tempo, pa usponi
 *   (≥ deloadSubstitute.minRKm), inače samo ubrzanja.
 */
export function simpleWeekQuality(
  f: WeekFrame,
  targetKm: number,
  p: PaceModel,
  prev: WeekDose | null,
  a: Athlete
): WeekQuality {
  const b = qualityBudgets(targetKm);
  const two = rulesOf(a).qualityDays === 2;
  const so = P.quality.deloadSubstitute.stridesOnly;
  if (a.beginner && f.index <= P.beginner.introWeeks && isBuild(f.phase))
    return {
      ok: true,
      q1: null,
      q2: null,
      easyStrides: false,
      stridesOnly: true,
      notes: [
        `Početnik: nedelja ${weekLabel(f.index, a.weekOffset)} bez kvaliteta — samo lagano + ubrzanja ${so.reps} × ${so.sec} s.`
      ],
      dose: prev
    };
  const k = kindsOf(f, a, two, prev);
  // Taper: bez progresije (svaka nedelja prvi izbor, kao sa rezultatom).
  const taper = f.phase === 'taper';
  const pf = taper ? {} : (prev?.feel ?? {});
  // Zadržana doza je dozvoljena samo uz drugi kvalitet ili kad prethodna nedelja nije bila ista vrsta.
  const holdOk = (kind: FeelKind): boolean => two || prev?.kind !== kind;

  if (f.deload && isBuild(f.phase)) {
    const chain = [...new Set<FeelKind>([k.main, 'TEMPO', 'HILLS'])];
    // Kvalitet staje u nedelju samo ako dužine (weekLengths, iste kao week.ts) daju lagan ≥ minimum i
    // lagan ≤ dugi; inače rasterećenje samo sa ubrzanjima (npr. početnik, 4 dana, 15 km → 12 km).
    const room = (w: Workout): boolean => {
      const L = weekLengths(targetKm, w.km, easyCount(a, true, false), f.phase, p, a, f.deload);
      return !L.capped && L.shares.every((x) => x + 1e-9 >= L.easyMin);
    };
    for (const kind of chain) {
      const s = SPEC[kind];
      const d = choose(
        s.cands(f.phase),
        (x) => s.est(x, p),
        r2(b[s.budget] * P.quality.deloadBudgetScale),
        null,
        'first'
      );
      if (!d) continue;
      const sub = kind !== k.main;
      if (sub && kind === 'HILLS' && s.est(d, p) + 1e-9 < P.quality.deloadSubstitute.minRKm)
        continue;
      const q1 = s.build(d, targetKm, p);
      if (!room(q1)) continue;
      return {
        ok: true,
        q1,
        q2: null,
        easyStrides: sub || !two,
        stridesOnly: false,
        notes: [
          sub
            ? `Rasterećenje: ${SPEC[k.main].label} ne staje u budžet — ${s.label} umesto toga, uz ubrzanja.`
            : 'Rasterećenje: jedan kratak kvalitet.'
        ],
        dose: null
      };
    }
    return {
      ok: true,
      q1: null,
      q2: null,
      easyStrides: false,
      stridesOnly: true,
      notes: [
        `Rasterećenje: nijedan kvalitet ne staje u budžet ni u nedelju — samo ubrzanja ${so.reps} × ${so.sec} s na laganom.`
      ],
      dose: null
    };
  }

  const notes: string[] = [];
  // Glavni kvalitet (ili kontrolno trčanje); jedan kvalitet bez smene ne sme da se drži (isti trening
  // dve nedelje zaredom), uz smenu ili drugi kvalitet sme.
  let main: Pick | null = null;
  let q1: Workout;
  if (f.test) {
    q1 = testRun(targetKm, p);
    notes.push(
      `Kontrolno trčanje ${F.test.km} km umesto glavnog kvaliteta; plan ostaje po osećaju (tempo iz testa ulazi tek kroz adaptaciju).`
    );
  } else {
    main = progress(k.main, f.phase, b, p, pf[k.main], holdOk(k.main));
    if (!main && k.other) {
      main = progress(k.other, f.phase, b, p, pf[k.other], holdOk(k.other));
      if (main)
        notes.push(`${SPEC[k.main].label} ne staje u budžet — ${SPEC[k.other].label} umesto toga.`);
    }
    if (!main)
      return fail(
        `${SPEC[k.main].label}: budžet ${b[SPEC[k.main].budget]} km nema dozu ${pf[k.main] ? 'veću ili jednaku prethodnoj, druge strukture' : 'po pravilima'}.`
      );
    q1 = SPEC[main.kind].build(main.d, targetKm, p);
  }

  // Drugi kvalitet (2 kvaliteta); tempo koji ne staje → fartlek u T budžetu.
  let second: Pick | null = null;
  if (k.second) {
    second =
      progress(k.second, f.phase, b, p, pf[k.second], true) ??
      (k.second === 'TEMPO' ? progress('FARTLEK_T', f.phase, b, p, pf.FARTLEK_T, true) : null);
    if (!second)
      return fail(`${SPEC[k.second].label}: budžet ${b[SPEC[k.second].budget]} km nije dovoljan.`);
    if (main?.how === 'hold' && second.how === 'hold')
      return fail(
        `${SPEC[main.kind].label} i ${SPEC[second.kind].label}: isti par kao prethodne nedelje.`
      );
  }
  let q2 = second ? SPEC[second.kind].build(second.d, targetKm, p) : null;

  // Baza (2 kvaliteta): ista doza (R km, oblik T, T km) najviše baseSameDoseMaxWeeks nedelja zaredom,
  // pa druga struktura drugog kvaliteta (isti ključ kao validator).
  const keyOf = (w2: Workout | null): string => {
    const ws = [q1, ...(w2 ? [w2] : [])];
    const t = ws.find((w) => w.workKm.T > 0);
    return baseDoseKey(
      ws.reduce((x, w) => x + w.workKm.R, 0),
      t ? tFormOf(t) : 'continuous',
      t ? t.workKm.T : 0
    );
  };
  let key = keyOf(q2);
  let same = prev?.key === key ? prev.same + 1 : 1;
  if (f.phase === 'base' && second && same > P.quality.baseSameDoseMaxWeeks) {
    const s = SPEC[second.kind];
    const alt = choose(s.cands(f.phase), (x) => s.est(x, p), b[s.budget], second.d, 'alt');
    if (alt) {
      second = { kind: second.kind, d: alt, how: 'alt' };
      q2 = s.build(alt, targetKm, p);
      key = keyOf(q2);
      same = prev?.key === key ? prev.same + 1 : 1;
    }
  }
  for (const x of [main, second])
    if (x?.how === 'alt')
      notes.push(`${SPEC[x.kind].label}: bez višeg nivoa u budžetu — ista doza, druga struktura.`);
    else if (x?.how === 'hold')
      notes.push(`${SPEC[x.kind].label}: doza zadržana; drugi kvalitet menja strukturu.`);

  const feel: Partial<Record<FeelKind, FeelDose>> = { ...pf };
  if (main) feel[main.kind] = main.d;
  if (second) feel[second.kind] = second.d;
  return {
    ok: true,
    q1,
    q2,
    easyStrides: f.phase === 'base' || !two || q2 === null,
    stridesOnly: false,
    notes,
    dose: taper
      ? null
      : {
          main: null,
          t: null,
          same,
          key,
          ...(main ? { kind: main.kind } : prev?.kind ? { kind: prev.kind } : {}),
          feel
        }
  };
}
