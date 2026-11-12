/* V4 — BROJEVI MODELA. Jedino mesto gde žive; uz svaki stoji odeljak docs/generators-v4/SPEC.md.
   Brojevi koji zavise od distance NISU ovde nego u `DistanceData` (safety, adequate, šabloni). */

/* ------------------------------------------------------------------ forma i tempa (§ 5.4) */

/** Daniels–Gilbert: VO2 (ml/kg/min) pri brzini `v` u m/min: `a + b·v + c·v²`. */
export const VO2_A = -4.6;
export const VO2_B = 0.182258;
export const VO2_C = 0.000104;
/** Udeo VO2max koji se može držati `t` minuta: `p0 + p1·e^(k1·t) + p2·e^(k2·t)`. */
export const SHARE_P0 = 0.8;
export const SHARE_P1 = 0.1894393;
export const SHARE_K1 = -0.012778;
export const SHARE_P2 = 0.2989558;
export const SHARE_K2 = -0.1932605;

/** Udeo VDOT po zoni (§ 5.4). E je raspon; `ZONE_SHARE.E` je vrednost za račun km. */
export const ZONE_SHARE = { E: 0.66, M: 0.8, T: 0.88, I: 0.975, R: 1.05 } as const;
export const EASY_SLOW_SHARE = 0.62;
export const EASY_FAST_SHARE = 0.7;
/** Tempa se zaokružuju na 1 s/km (§ 5.4). */
export const PACE_ROUND_SEC = 1;
/** Bisekcija vremena trke: granice brzine (m/s) i broj koraka; 60 koraka daje tačnost ispod 1 ms. */
export const RACE_SPEED_MIN_MPS = 0.5;
export const RACE_SPEED_MAX_MPS = 12;
export const BISECTION_STEPS = 60;
/** Kad nema ni rezultata ni laganog tempa (§ 2.4). */
export const DEFAULT_VDOT = 30;

/* ------------------------------------------------------------------ opterećenje (§ 5.1) */

/** Sidra težine po odnosu brzine i brzine praga `s = v / v_T`; linearno između, ravno van. */
export const WEIGHT_ANCHORS: readonly (readonly [s: number, weight: number])[] = [
  [0.8, 1.0],
  [0.93, 1.5],
  [1.0, 2.0],
  [1.09, 3.0]
];
/** Stalne težine imenovanih zona; RP se računa iz `s` i zaokružuje na `RP_WEIGHT_STEP`. */
export const ZONE_WEIGHT = { E: 1.0, M: 1.5, T: 2.0, I: 3.0, R: 3.0 } as const;
export const RP_WEIGHT_STEP = 0.05;
export const JOG_WEIGHT = 1.0;
export const WALK_WEIGHT = 0.5;
/** Težina po RPE (§ 5.1): ≤ 4 → 1,0; 5–6 → 1,5; 7 → 2,0; ≥ 8 → 3,0. */
export const RPE_WEIGHTS: readonly (readonly [maxRpe: number, weight: number])[] = [
  [4, 1.0],
  [6, 1.5],
  [7, 2.0],
  [10, 3.0]
];
/** Dogovor za korak oporavka bez trčanja: `effort` sa ovim RPE (hod = 2, stajanje = 1). */
export const RPE_WALK = 2;
export const RPE_STAND = 1;
/** Hod se u kilometre računa po 9:00/km, stajanje ne daje kilometre (§ 5.5). */
export const WALK_PACE_SEC_PER_KM = 540;

/** Urađen dan plana bez krugova: planirana prosečna težina × stvarno trajanje, ako je odrađeno ≥ 90 % planiranog
    trajanja (odluka organizatora, drugi krug) — da pravilo rasta ne kažnjava sat koji ne šalje krugove. */
export const PLANNED_LOAD_MIN_SHARE = 0.9;

/* ------------------------------------------------------------------ baza i umor (§ 5.3) */

export const CHRONIC_DAYS = 42;
export const ACUTE_DAYS = 7;
/** Prozori izvedenih polja stanja (§ 2.3). */
export const STATE_WEEKS = 12;
export const LONGEST_RECENT_DAYS = 28;
export const HARD_EFFORT_DAYS = 42;
export const PAUSE_WINDOW_DAYS = 42;
export const PAIN_RESOLVED_DAYS = 14;

/* ------------------------------------------------------------------ kilometri i zaokruživanje (§ 4.3, § 5.5) */

export const DAY_KM_STEP = 0.1;
/** Lagan i dugi zadat dužinom: korak 0,5 km; zadat trajanjem: korak 5 min. */
export const EASY_DISTANCE_STEP_M = 500;
export const EASY_DURATION_STEP_SEC = 300;
/** Komad rada: 60 s ili 500 m. */
export const WORK_DURATION_STEP_SEC = 60;
export const WORK_DISTANCE_STEP_M = 500;
/** Lestvica sme da pređe dozu za najviše 90 s (§ 4.3). */
export const LADDER_TOLERANCE_SEC = 90;
/** Blok u dugom nije duži od polovine dugog (geometrija treninga; nije plafon doze). */
export const LONG_BLOCK_MAX_SHARE = 0.5;
/** Dan pre trke: odmor ili lagano do 20 min (§ 6.2 k. 10). */
export const RACE_EVE_MAX_SEC = 1200;

/** Lagan dan ne nestaje zbog malog ostatka budžeta kad trkač ima ≥ 3 dana: ostaje na `minEasySec` dok nedelja
    ne pređe cilj za više od 10 % (odluka organizatora, drugi krug). */
export const EASY_FLOOR_MIN_RUN_DAYS = 3;
export const EASY_FLOOR_OVER_TARGET = 0.1;

/* ------------------------------------------------------------------ krug 2 (R1–R5): podrazumevane vrednosti */

/** Vrh ≤ baza × 1,40 kad podaci ne zadaju `safety.maxPeakOverBase` (R3). */
export const DEFAULT_MAX_PEAK_OVER_BASE = 1.4;
/** Lagan dan ≤ 1,25 × najduži lagan dan prethodne nedelje koja nije rasterećenje (R2b). */
export const DEFAULT_EASY_MAX_OVER_PREVIOUS = 1.25;
/** Lagan dan u nedelji sužavanja i nedelji trke: najviše 50 min, do 3 dana trčanja 40 min (R1). */
export const DEFAULT_TAPER_EASY_MAX_SEC: Readonly<Record<string, number>> = {
  '1': 2400,
  '4': 3000
};
/** U nedelji sužavanja i nedelji trke dodatak (ubrzanja) ostaje i kad plafon dana skrati lagani deo, dok je
    lagani deo bar 10 min; ispod toga dan je samo lagan (R1). */
export const TAPER_ADDON_MIN_EASY_SEC = 600;
/** Prva nedelja posle rampe povratka: obim ≤ poslednja puna nedelja pre pauze × 1,10 (R9). */
export const RETURN_WEEK_MAX_OVER_LAST = 1.1;

/* ------------------------------------------------------------------ spremnost (§ 6.5, § 14.1) */

/** `f(n) = RAMP_START + RAMP_SPAN × n / R`. */
export const RAMP_START = 0.4;
export const RAMP_SPAN = 0.6;
/** Posle napora: `R = ceil(minuti / 7)`. */
export const EFFORT_MIN_PER_RAMP_DAY = 7;
/** Posle pauze (§ 14.6): `R = ceil(faktor razloga × min(dani, 28))`, pauza je ≥ 3 dana. */
export const PAUSE_RAMP_FACTORS = { bolest: 2.0, povreda: 2.0, put: 1.0, nepoznato: 1.5 } as const;
export const PAUSE_RAMP_MAX_DAYS = 28;
/** Trka ili test se kao „dugi" računa sa 60 % svog trajanja (polazni dugi i referenca plafona; ispravka tačke E). */
export const EFFORT_AS_LONG_SHARE = 0.6;
/** Dok je `f < 0,8`, dugi ≤ 75 % poslednjeg odrađenog dugog (§ 14.6; od `f ≥ 0,8` određuju ga rampa i lanac). */
export const RAMP_LONG_SHARE = 0.75;
/** Posle pauze ≥ 7 dana: blok u dugom tek posle jednog dugog bez bloka od ≥ 90 % poslednjeg pre pauze (§ 14.6);
    pravilo se gasi 42 dana posle pauze (odluka F2: bez roka bi plan sa kratkim dugim ostao bez bloka do trke). */
export const BLOCK_GATE_PAUSE_DAYS = 7;
export const BLOCK_GATE_SHARE = 0.9;
export const BLOCK_GATE_MAX_DAYS = 42;
export const PAUSE_MIN_DAYS = 3;
/** Izvedena pauza traži bar 2 planirana treninga u prekidu (§ 2.3). */
export const PAUSE_MIN_PLANNED = 2;
export const REST_BELOW_F = 0.5;
export const QUALITY_FROM_F = 0.8;
export const RAMP_MIN_DURATION_SEC = 1200;
/** Kvalitet u rampi i prvi kvalitet svakog podražaja posle rampe: doza × 0,8 (§ 14.5: jedan broj). */
export const RAMP_DOSE_FACTOR = 0.8;
/** Koliko dana posle kraja rampe još važi „prvi kvalitet podražaja" (odluka F2, v. F2-REPORT). */
export const POST_RAMP_FIRST_DAYS = 14;
/** § 14.1: ništa brzo u prva 3 dana posle trke ili testa (kvalitet najranije 4. dana). */
export const NO_FAST_DAYS_AFTER_EFFORT = 3;
/** Bol (krug 2, R7). Nivo 1–3: 1 dan odmora, prvo trčanje lagano, 5 dana bez visokog udara.
    Nivo 4–6: 2 dana odmora; 10 dana bez kvaliteta i bloka (prvih 7 i kraće, × 0,7); 14 dana dugi ≤ 75 % poslednjeg
    dugog i bez visokog udara; prvi kvalitet svake vrste posle toga ≤ 60 % doze. Nivo ≥ 7: 7 dana odmor, pa kao
    pauza zbog povrede. */
export const PAIN_LOW_MAX = 3;
export const PAIN_MID_MAX = 6;
export const PAIN_LOW_REST_DAYS = 1;
export const PAIN_LOW_DAYS = 5;
export const PAIN_MID_REST_DAYS = 2;
export const PAIN_MID_SHORT_DAYS = 7;
export const PAIN_MID_FACTOR = 0.7;
export const PAIN_MID_DAYS = 10;
export const PAIN_MID_LONG_DAYS = 14;
export const PAIN_MID_DOSE_FACTOR = 0.6;
export const PAIN_HIGH_REST_DAYS = 7;
/** Uslov za nastavak i prag za prekid u tekstu promene (R7). */
export const PAIN_CONTINUE_MAX = 2;
export const PAIN_STOP_FROM = 4;
export const PAIN_DOCTOR_AFTER_DAYS = 7;
/** Umor (§ 6.5): 4 dana bez kvaliteta, trajanje × 0,8; izveden kad je umor / baza ≥ 1,5 (§ 3). */
export const FATIGUE_DAYS = 4;
export const FATIGUE_FACTOR = 0.8;
export const FATIGUE_RATIO = 1.5;
/** Izveden umor traži i opterećenje poslednjih 7 dana ≥ 1,2 × bazna nedelja (§ 14.6). */
export const FATIGUE_WEEK_SHARE = 1.2;
export const FATIGUE_REPEAT_DAYS = 7;

/* ------------------------------------------------------------------ ponovno planiranje (§ 6.3, § 6.4, § 7.6) */

/** Pauza od ovoliko dana preračunava vrh, plafone i dugi (§ 6.3). */
export const PAUSE_FULL_REPLAN_DAYS = 14;
/** Propušten ključan trening se ponavlja na sledećem istom mestu u najviše 14 dana (§ 6.4). */
export const MISSED_LOOKAHEAD_DAYS = 14;
/** Histereza tempa (§ 7.6): 0,5 VDOT i 14 dana; posle trke ili testa odmah od 0,3. */
export const PACE_UPDATE_VDOT = 0.5;
export const PACE_UPDATE_DAYS = 14;
export const PACE_UPDATE_AFTER_RESULT_VDOT = 0.3;

/* ------------------------------------------------------------------ čuvar (§ 8.2) */

export const GUARD_DOSE_TOLERANCE_SEC = 90;
export const GUARD_FAST_SHARE_TOLERANCE = 0.02;
/** § 8.2 daje 5 %; drugi krug: čuvar ne prijavljuje do + 10 % (lagan dan na najkraćem trajanju). */
export const GUARD_JUMP_TOLERANCE = 0.1;
export const GUARD_LONG_STEP_TOLERANCE_SEC = 60;
export const GUARD_MIN_WORKOUT_SEC = 900;
/** Krug 2 (R2c): neplaniran višak se ne prijavljuje do −15 %. */
export const GUARD_UNDER_TARGET = 0.85;
export const GUARD_MIN_WEEK_SHARE = 0.5;
export const GUARD_MIN_WEEK_WORKOUTS = 3;
export const GUARD_TAPER_WORK_SHARE = 0.6;
