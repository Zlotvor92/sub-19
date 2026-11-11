/* ŠABLONI KAO PODACI. Ništa ovde ne računa km: doze su udeli plafona zone (scale.ts), dužine dugog udeli najdužeg,
   obim udeo vrha. Raspored uloga po nedeljama (layout.ts) je parametrizovan udelima faza, pa šablon važi za 4–30 nedelja. */

export type QSpec =
  | { t: 'easy'; strides?: number; hills?: number; tMin?: number }
  | { t: 'R'; reps: number; m: number; hills?: number }
  | { t: 'H'; reps: number; sec: number }
  | { t: 'T'; dose: number; shape: Shape }
  | { t: 'I'; dose: number; shape: 'k1000' | 'k800' | 'pyr' }
  | { t: 'RP'; dose: number; shape: Shape }
  | { t: 'sharpen' };
export type Shape = 'komad' | 'x2' | 'x3' | 'x4';

/** Uloga dugog u nedelji; `block` = udeo plafona bloka RP trkača (km RP na kraju dugog). */
export interface LongSpec {
  len: number; // udeo najdužeg dugog plana
  block?: number;
}

export interface RoleSpec {
  q1: QSpec;
  q2: QSpec;
  long: LongSpec | null;
  /** obim kao udeo vrha (`prev` = udeo prethodne ne-rasteretne) */
  vol: number;
  volRel?: 'prev';
}

/* ---------- obim i dugi po ulozi ---------- */
export const VOL = { rest: 0.8, post: 0.9, taper: 0.65, race: 0.32 } as const;
export const LONG = { rest: 0.8, checkSameWeek: 0.6, wave: 0.82, post: 0.82, taper: 0.6 } as const;

/* ---------- redovan (sa rezultatom i po osećaju), 4+ dana ---------- */
/** Kvalitet 1 u osnovi: brzina i brda, redom (posle kraja ponavlja od 3. stavke). */
export const BASE_Q1: QSpec[] = [
  { t: 'R', reps: 6, m: 200, hills: 4 },
  { t: 'R', reps: 8, m: 200 },
  { t: 'H', reps: 8, sec: 45 },
  { t: 'R', reps: 6, m: 300 },
  { t: 'H', reps: 10, sec: 45 },
  { t: 'R', reps: 8, m: 300 },
  { t: 'R', reps: 6, m: 400 }
];
/** Kvalitet 1 u razvoju: I lestvica 70 → 85 → 100 % plafona, pa menja oblik. */
export const DEV_Q1: QSpec[] = [
  { t: 'I', dose: 0.7, shape: 'k1000' },
  { t: 'I', dose: 0.85, shape: 'k1000' },
  { t: 'I', dose: 1, shape: 'pyr' },
  { t: 'I', dose: 0.9, shape: 'k800' },
  { t: 'I', dose: 1, shape: 'k1000' }
];
/** Oblik T kroz osnovu i razvoj (doza raste linearno od početne do plafona): deonice ↔ u komadu. */
export const T_SHAPES: Shape[] = ['komad', 'x2', 'komad', 'x3', 'komad', 'x2', 'komad', 'x4'];

/** Specifična faza i kraj, redovan. Nedelja sa blokom u dugom ima jedan kvalitet. */
export const REGULAR_ROLES: Record<string, RoleSpec> = {
  block1: {
    q1: { t: 'RP', dose: 0.65, shape: 'x2' },
    q2: { t: 'easy' },
    long: { len: 0.93, block: 0.5 },
    vol: 1
  },
  wave: {
    q1: { t: 'RP', dose: 0.9, shape: 'x2' },
    q2: { t: 'T', dose: 0.65, shape: 'x3' },
    long: { len: LONG.wave },
    vol: 1
  },
  block2: {
    q1: { t: 'RP', dose: 0.85, shape: 'x3' },
    q2: { t: 'easy' },
    long: { len: 0.96, block: 0.75 },
    vol: 1
  },
  peak: {
    q1: { t: 'RP', dose: 1, shape: 'x3' },
    q2: { t: 'easy' },
    long: { len: 1, block: 1 },
    vol: 1
  },
  post: {
    q1: { t: 'RP', dose: 0.65, shape: 'x2' },
    q2: { t: 'T', dose: 0.4, shape: 'komad' },
    long: { len: LONG.post, block: 0.5 },
    vol: VOL.post
  },
  taper: {
    q1: { t: 'RP', dose: 0.55, shape: 'x2' },
    q2: { t: 'T', dose: 0.27, shape: 'x2' },
    long: { len: LONG.taper },
    vol: VOL.taper
  },
  race: { q1: { t: 'easy', strides: 4 }, q2: { t: 'sharpen' }, long: null, vol: VOL.race }
};

/* ---------- početnik ---------- */
/** Podražaj (kvalitet 2) u uvodu i prvoj nedelji osnove; posle toga T lestvica 10 → plafon. */
export const BEGINNER_INTRO: QSpec[] = [
  { t: 'easy', strides: 4 },
  { t: 'easy', strides: 6 },
  { t: 'H', reps: 6, sec: 20 }
];
export const BEGINNER_T_SHAPES: Shape[] = ['x2', 'komad', 'x3'];
export const BEGINNER_ROLES: Record<string, RoleSpec> = {
  block1: {
    q1: { t: 'easy' },
    q2: { t: 'RP', dose: 0.9, shape: 'x2' },
    long: { len: 0.8, block: 0.7 },
    vol: 1
  },
  peak: {
    q1: { t: 'easy' },
    q2: { t: 'RP', dose: 1, shape: 'komad' },
    long: { len: 1, block: 1 },
    vol: 1
  },
  post: {
    q1: { t: 'easy' },
    q2: { t: 'RP', dose: 0.8, shape: 'x3' },
    long: { len: 0.8, block: 0.7 },
    vol: VOL.post
  },
  taper: {
    q1: { t: 'easy' },
    q2: { t: 'RP', dose: 0.55, shape: 'x2' },
    long: { len: LONG.taper },
    vol: VOL.taper
  },
  race: { q1: { t: 'easy', strides: 4 }, q2: { t: 'sharpen' }, long: null, vol: VOL.race }
};

/* ---------- plafoni (ROUND-01 § 3; brojevi van dokumenata su označeni u izveštaju kao pretpostavke) ---------- */
export const CAPS = {
  hoursBeginner: 6.5,
  hoursSlow: 7.5, // VDOT < 40
  hoursMid: 9, // VDOT 40–52
  longTimeBeginnerMin: 125,
  longTimeMin: 135,
  longShare: { 3: 0.45, 4: 0.4, 5: 0.35, 6: 0.35 } as Record<number, number>,
  easyShareOfLong: 0.65,
  easyShareOfLong3: 0.75,
  dayBeforeLong: 0.5,
  minEasyMin: 30,
  peakAbsKm: 100
} as const;
