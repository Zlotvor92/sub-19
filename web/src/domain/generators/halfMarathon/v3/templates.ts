/* HM v3 (pilot) — TRENERSKI ŠABLONI kao podaci. Oblik pripreme je ovde; motor (build.ts) ga samo skalira.
   Jedinice su relativne: obim = udeo vrha obima, dugi = udeo najdužeg dugog, kvalitet = udeo vrha doze zone
   (minuti rada, plafon zone iz v2 politike — scale.ts). Nedelje specifične faze, tapera i trke su vezane za
   rastojanje od trke (kk); osnova i razvoj se uzimaju iz nizova (osnova od početka, razvoj od kraja), pa šablon
   važi za bilo koji broj nedelja. Izvori oblika: target/HM/p01, p04, p11, p12 i GAP § 2–3. */

export type QZone = 'T' | 'I' | 'R' | 'RP';

/** Oblik doze: u komadu, n jednakih deonica ili deonice zadate dužine [m]. */
export type Form = 'c' | { n: number } | { m: number };

export type QIntent =
  | { z: QZone; s: number; f: Form }
  /** Usponi: broj ponavljanja × trajanje [s]. */
  | { z: 'H'; reps: number; sec: number }
  /** Bez kvaliteta: lagan dan sa ubrzanjima. */
  | { z: 'S' };

export type LongRole = 'easy' | 'prog' | 'block' | 'down';

export interface LongIntent {
  /** Udeo najdužeg dugog; 'ramp' = lestvica od s0 do 1,0; 'deload' = × deloadLong prethodnog dugog. */
  s: number | 'ramp' | 'deload';
  role: LongRole;
  /** Blok tempom trke na kraju dugog [km] (uloga 'block'); 'top' = vrh bloka profila. */
  block?: number | 'top';
}

export interface WeekIntent {
  /** Udeo vrha obima; 'ramp' = lestvica od starta do vrha; 'deload' = × deloadVol prethodne izgradnje. */
  vol: number | 'ramp' | 'deload';
  long: LongIntent;
  q1: QIntent | null;
  q2: QIntent | null;
  /** Provera forme: pripremna trka 10 km (subota rasteretne nedelje) ili test 3 km (plan po osećaju). */
  test?: 'race10' | 'test3';
  /** Rečenica trenera uz nedelju (ishrana, proba opreme…). */
  note?: string;
}

export interface Template {
  id: 'regular' | 'beginner';
  /** Lestvica obima i dugog: početni udeo dugog i nedelja (kk) u kojoj lestvice stižu do vrha. */
  longS0: number;
  /** Dugi na početku lestvice je najmanje ovaj udeo sadašnjeg obima (p12: 14 km od 45). */
  longStartShare: number;
  rampEndKk: number;
  deloadVol: number;
  deloadLong: number;
  /** Udeo nedelja pre specifične faze koji je osnova (ostatak je razvoj). */
  baseShare: number;
  base: readonly WeekIntent[];
  /** Osnovna priprema plana dužeg od 20 nedelja: dve namere naizmenično (obim i dugi na startu). */
  prep: readonly [WeekIntent, WeekIntent];
  dev: readonly WeekIntent[];
  /** kk 2..7 (kk 4 je rasterećenje) i kk 1 (taper). */
  tail: Readonly<Record<1 | 2 | 3 | 5 | 6 | 7, WeekIntent>>;
  deload: WeekIntent;
  check: WeekIntent;
  feelTest: WeekIntent;
  /** Blok RP u dugom: vrh [km] (brz trkač, VDOT ≥ 50: + fastBlockAddKm). */
  blockTopKm: number;
}

const S: QIntent = { z: 'S' };
const easyLong: LongIntent = { s: 'ramp', role: 'easy' };
const progLong: LongIntent = { s: 'ramp', role: 'prog' };

export const FUEL = 'U dugom vežbaj unos: gel ili napitak na 35–40 min.';
const PEAK =
  'Najteža nedelja pripreme (3 nedelje pred trku): u dugom proba opreme, doručka i gelova kao na dan trke.';

/** Redovan plan (sa rezultatom ili po osećaju), 3–6 dana; 3 dana: jedan kvalitet (motor bira q1/q2). */
export const REGULAR: Template = {
  id: 'regular',
  longS0: 0.82,
  longStartShare: 0.3,
  rampEndKk: 7,
  deloadVol: 0.8,
  deloadLong: 0.75,
  baseShare: 0.6,
  base: [
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'R', s: 0.6, f: { m: 200 } },
      q2: { z: 'T', s: 0.45, f: 'c' }
    },
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'R', s: 0.8, f: { m: 200 } },
      q2: { z: 'T', s: 0.55, f: { n: 2 } }
    },
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'H', reps: 8, sec: 45 },
      q2: { z: 'T', s: 0.65, f: 'c' }
    },
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'R', s: 0.8, f: { m: 300 } },
      q2: { z: 'T', s: 0.75, f: { n: 3 } }
    },
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'H', reps: 10, sec: 45 },
      q2: { z: 'T', s: 0.85, f: 'c' }
    },
    {
      vol: 'ramp',
      long: progLong,
      q1: { z: 'R', s: 0.9, f: { m: 400 } },
      q2: { z: 'T', s: 0.9, f: { n: 4 } },
      note: FUEL
    },
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'H', reps: 10, sec: 60 },
      q2: { z: 'T', s: 0.95, f: { n: 3 } }
    },
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'R', s: 1.0, f: { m: 300 } },
      q2: { z: 'T', s: 1.0, f: 'c' }
    }
  ],
  prep: [
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'R', s: 0.6, f: { m: 200 } },
      q2: { z: 'T', s: 0.45, f: 'c' }
    },
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'H', reps: 8, sec: 30 },
      q2: { z: 'T', s: 0.45, f: { n: 2 } }
    }
  ],
  dev: [
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'I', s: 0.6, f: { m: 1000 } },
      q2: { z: 'T', s: 0.75, f: { n: 3 } }
    },
    {
      vol: 'ramp',
      long: progLong,
      q1: { z: 'I', s: 0.7, f: { m: 800 } },
      q2: { z: 'T', s: 0.85, f: 'c' },
      note: FUEL
    },
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'I', s: 0.8, f: { m: 1000 } },
      q2: { z: 'T', s: 0.9, f: { n: 2 } }
    },
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'I', s: 0.9, f: { m: 1200 } },
      q2: { z: 'T', s: 0.95, f: { n: 3 } }
    },
    {
      vol: 'ramp',
      long: progLong,
      q1: { z: 'I', s: 1.0, f: { m: 1000 } },
      q2: { z: 'T', s: 1.0, f: 'c' },
      note: FUEL
    }
  ],
  tail: {
    7: {
      vol: 'ramp',
      long: { s: 'ramp', role: 'block', block: 4 },
      q1: { z: 'RP', s: 0.55, f: { n: 2 } },
      q2: null
    },
    6: {
      vol: 1,
      long: { s: 0.82, role: 'down' },
      q1: { z: 'RP', s: 0.75, f: { n: 2 } },
      q2: { z: 'T', s: 0.8, f: 'c' }
    },
    5: {
      vol: 1,
      long: { s: 0.95, role: 'block', block: 6 },
      q1: { z: 'RP', s: 0.8, f: { n: 3 } },
      q2: null
    },
    3: {
      vol: 1,
      long: { s: 1, role: 'block', block: 'top' },
      q1: { z: 'RP', s: 1, f: 'c' },
      q2: null,
      note: PEAK
    },
    2: {
      vol: 0.88,
      long: { s: 0.82, role: 'block', block: 4 },
      q1: { z: 'RP', s: 0.6, f: { n: 2 } },
      q2: { z: 'T', s: 0.45, f: 'c' }
    },
    1: {
      vol: 0.65,
      long: { s: 0.6, role: 'easy' },
      q1: { z: 'RP', s: 0.5, f: { n: 2 } },
      q2: { z: 'T', s: 0.3, f: { n: 2 } }
    }
  },
  deload: {
    vol: 'deload',
    long: { s: 'deload', role: 'easy' },
    q1: S,
    q2: { z: 'T', s: 0.45, f: { n: 2 } }
  },
  check: { vol: 'deload', long: { s: 0.55, role: 'easy' }, q1: S, q2: null, test: 'race10' },
  feelTest: { vol: 'deload', long: { s: 'deload', role: 'easy' }, q1: S, q2: null, test: 'test3' },
  blockTopKm: 8
};

/** Početnik (4–5 dana, jedan kvalitet): uvod 2 nedelje, T od 2 × 5 min, RP i u dugom; obim i dugi rastu do vrha
    u najtežoj nedelji (kk 3). */
export const BEGINNER: Template = {
  id: 'beginner',
  longS0: 0.46,
  longStartShare: 0.3,
  rampEndKk: 3,
  deloadVol: 0.78,
  deloadLong: 0.75,
  baseShare: 0.6,
  base: [
    { vol: 'ramp', long: easyLong, q1: S, q2: null },
    { vol: 'ramp', long: easyLong, q1: S, q2: null },
    { vol: 'ramp', long: easyLong, q1: { z: 'H', reps: 6, sec: 20 }, q2: null },
    { vol: 'ramp', long: easyLong, q1: { z: 'T', s: 0.45, f: { n: 2 } }, q2: null },
    { vol: 'ramp', long: easyLong, q1: { z: 'T', s: 0.5, f: 'c' }, q2: null },
    { vol: 'ramp', long: easyLong, q1: { z: 'T', s: 0.65, f: { n: 3 } }, q2: null },
    { vol: 'ramp', long: easyLong, q1: { z: 'H', reps: 8, sec: 30 }, q2: null },
    { vol: 'ramp', long: easyLong, q1: { z: 'T', s: 0.75, f: { n: 2 } }, q2: null }
  ],
  prep: [
    { vol: 'ramp', long: easyLong, q1: S, q2: null },
    { vol: 'ramp', long: easyLong, q1: { z: 'H', reps: 6, sec: 20 }, q2: null }
  ],
  dev: [
    {
      vol: 'ramp',
      long: easyLong,
      q1: { z: 'T', s: 0.7, f: { n: 2 } },
      q2: null,
      note: 'U dugom vežbaj unos vode.'
    },
    { vol: 'ramp', long: easyLong, q1: { z: 'T', s: 0.8, f: 'c' }, q2: null },
    { vol: 'ramp', long: easyLong, q1: { z: 'T', s: 0.85, f: { n: 3 } }, q2: null },
    { vol: 'ramp', long: easyLong, q1: { z: 'T', s: 0.95, f: { n: 2 } }, q2: null }
  ],
  tail: {
    7: { vol: 'ramp', long: easyLong, q1: { z: 'T', s: 0.9, f: { n: 2 } }, q2: null },
    6: { vol: 'ramp', long: easyLong, q1: { z: 'T', s: 1, f: 'c' }, q2: null },
    5: {
      vol: 'ramp',
      long: { s: 'ramp', role: 'block', block: 3 },
      q1: { z: 'RP', s: 0.8, f: { n: 2 } },
      q2: null
    },
    3: {
      vol: 'ramp',
      long: { s: 1, role: 'block', block: 'top' },
      q1: { z: 'RP', s: 1, f: 'c' },
      q2: null,
      note: PEAK
    },
    2: {
      vol: 0.9,
      long: { s: 0.8, role: 'easy' },
      q1: { z: 'RP', s: 0.75, f: { n: 3 } },
      q2: null
    },
    1: {
      vol: 0.68,
      long: { s: 0.57, role: 'easy' },
      q1: { z: 'RP', s: 0.5, f: { n: 2 } },
      q2: null
    }
  },
  deload: {
    vol: 'deload',
    long: { s: 'deload', role: 'easy' },
    q1: { z: 'T', s: 0.4, f: { n: 2 } },
    q2: null
  },
  check: { vol: 'deload', long: { s: 0.5, role: 'easy' }, q1: S, q2: null, test: 'race10' },
  feelTest: {
    vol: 'deload',
    long: { s: 'deload', role: 'easy' },
    q1: null,
    q2: null,
    test: 'test3'
  },
  blockTopKm: 4
};

/** Trenerski brojevi pilota koji NISU u v2 politici (izvor u komentaru). */
export const COACH = {
  /** GAP § 2 st. 3: vrh obima početnika ≤ start × 2,0, korak ≤ 1,5 km nedeljno. */
  beginnerPeakFactor: 2.0,
  beginnerStepKm: 1.5,
  /** GAP § 2 st. 3 / p11: dugi početnika vođen vremenom do 2 h 05 (srednji lagan tempo). */
  beginnerLongSec: 7500,
  /** p11: dugi početnika ≤ 50 % nedelje. */
  beginnerLongShare: 0.5,
  /** ROUND-01 § 3: RP početnika 15–25 min u komadu. */
  beginnerRpSec: 1500,
  /** p01: brz trkač — blok u dugom do 10 km. */
  fastBlockAddKm: 2,
  /** ROUND-01 § 3: provera forme — rad testa ≤ 2 × najveća dotadašnja doza (inače kraći test). */
  testMaxDoseFactor: 2,
  /** Najmanji smislen kvalitet [s]; ispod toga lagan dan sa ubrzanjima. */
  minWorkSec: 300,
  /** GAP § 2 st. 2: nedelja posle vrha ≤ 85 %, taper ≤ 60 % minuta rada vrha. */
  afterPeakShare: 0.85,
  taperShare: 0.6
} as const;
