/* V4 — FORMA IZ TRČANJA: brojevi (SPEC § 7, § 14.3, § 14.6). Jedino mesto gde žive.
   Pouzdanost: [visoka] zahtev vlasnika ili formula · [srednja] trenerska praksa · [niska] procena, kalibriše se.
   Izvori i obrazloženje: docs/generators-v4/reports/F4-REPORT.md. */
import type { Confidence } from '../engine/types';
import type { Tenure } from './types';

/* ------------------------------------------------------------------ signali (§ 7.2) */

/** Trka se računa od 3000 m, test od 2000 m. [srednja] */
export const RACE_MIN_M = 3000;
export const TEST_MIN_M = 2000;
/** Deo razlike koji se usvaja: trka 0,7, test 0,5; pri niskoj pouzdanosti 1,0. [srednja] */
export const K_RACE = 0.7;
export const K_TEST = 0.5;
export const K_LOW_CONFIDENCE = 1.0;

/** Odrađen kvalitet (§ 7.3). [niska] */
export const QUALITY_ZONES = ['T', 'I', 'RP'] as const;
export const K_QUALITY = 0.1;
/** Jedan trening pomera najviše 0,1 VDOT; zbir kvaliteta u 7 dana najviše 0,3 VDOT (u svakom smeru). */
export const QUALITY_MAX_STEP = 0.1;
export const QUALITY_WINDOW_DAYS = 7;
export const QUALITY_WINDOW_MAX = 0.3;
/** „Odrađeno" = vreme rada ≥ 90 % zadatog. */
export const QUALITY_DONE_SHARE = 0.9;
/** Držao tempo: p_r ≤ 1,01 × p_c; nije: p_r > 1,03 × p_c; između — bez dokaza. */
export const QUALITY_HELD_RATIO = 1.01;
export const QUALITY_MISSED_RATIO = 1.03;
/** Dokaz kvaliteta najviše ± 1,0 VDOT od stare procene. */
export const QUALITY_EVIDENCE_SPAN = 1.0;
/** RPE od kog je trening „na granici" (dokaz = stara procena). */
export const QUALITY_LIMIT_RPE = 9;

/** Trend pulsa sa zgloba (§ 7.4). [niska] */
export const HR_MIN_SEC = 25 * 60;
/** Prosečan tempo u zoni E ± 10 %. */
export const HR_EASY_TOLERANCE = 0.1;
/** Razlika najbržeg i najsporijeg km ≤ 12 %. */
export const HR_SPLIT_SPREAD = 0.12;
export const HR_MIN_RUNS_PER_WEEK = 2;
export const HR_MIN_WEEKS = 4;
export const HR_WINDOW_WEEKS = 8;
export const HR_MIN_TREND = 0.02;
/** Dokaz = stara + (trend u %) × 0,5 VDOT; k 0,5; najviše ± 0,5 VDOT i najviše jednom u 14 dana. */
export const HR_VDOT_PER_PCT = 0.5;
export const K_HR = 0.5;
export const HR_MAX_STEP = 0.5;
export const HR_EVERY_DAYS = 14;

/** Pauza (§ 7.2): svaki dan posle petog −0,3 %, najviše −8 % po pauzi. [srednja] */
export const PAUSE_FREE_DAYS = 5;
/** Prekid bez ijednog zapisanog trčanja se sam računa kao pauza tek od 14 dana: aplikacija čuva pun zapis samo za
    trčanja vezana za plan (LOG F0), pa je kraći prekid češće rupa u podacima nego pauza. Kraće pauze stižu kao
    prijavljene ili izvedene iz plana (`facts.pauses`, § 2.3). [niska] */
export const PAUSE_DERIVED_MIN_DAYS = 14;
export const PAUSE_DAILY_LOSS = 0.003;
export const PAUSE_MAX_LOSS = 0.08;

/* ------------------------------------------------------------------ korekcija rezultata za uslove (F4, § 7.2) */

/** Negativan split: prva polovina sporija od druge za ≥ 3 % → rezultat potcenjuje formu. [niska] */
export const NEG_SPLIT_MIN = 0.03;
/** Usvaja se polovina razlike između VDOT druge polovine (kao da je cela trka tako trčana) i rezultata. [niska] */
export const NEG_SPLIT_SHARE = 0.5;
export const NEG_SPLIT_MAX_BONUS = 1.0;
/** Toplo: od 20 °C rezultat je donja granica (ne spušta procenu); vreme se ne preračunava — nema proverenog
    koeficijenta po stepenu za rekreativce na polumaratonu. [srednja da toplota usporava, niska za prag] */
export const HOT_FROM_C = 20;

/* ------------------------------------------------------------------ pouzdanost i raspon (§ 7.5) */

export const CONF_HIGH_DAYS = 42;
export const CONF_MID_DAYS = 180;
export const CONF_MID_QUALITY = 4;
export const CONF_MID_QUALITY_DAYS = 28;
/** Neodređenost σ po pouzdanosti (VDOT). [niska] */
export const SIGMA: Readonly<Record<Confidence, number>> = {
  visoka: 0.5,
  srednja: 1.0,
  niska: 2.0
};

/** Plafon napretka (§ 14.6, kalibracija F4): `r` VDOT nedeljno i `G_max` po stažu. [niska–srednja] */
export const CEILING: Readonly<Record<Tenure, { rate: number; max: number }>> = {
  pocetnik: { rate: 0.2, max: 4.0 },
  srednji: { rate: 0.13, max: 2.5 },
  iskusan: { rate: 0.07, max: 1.5 },
  nepoznato: { rate: 0.1, max: 2.0 }
};
/** Bez dokaza kvaliteta u 12 nedelja istorije: `r × 1,25`, `G_max + 0,5` (§ 14.6). */
export const NO_QUALITY_WEEKS = 12;
export const NO_QUALITY_RATE = 1.25;
export const NO_QUALITY_MAX_ADD = 0.5;
/** Obim: `f_v = 0,8 + 0,4 × (clamp(P/B, 1, 1,3) − 1) / 0,3`; bez plana `f_v = 1`. */
export const VOLUME_F_MIN = 0.8;
export const VOLUME_F_SPAN = 0.4;
export const VOLUME_RATIO_MAX = 1.3;
/** Raniji napredak: nagib u 8 nedelja, uz ≥ 2 trke/testa ili ≥ 6 dokaza kvaliteta; `clamp(0,5 + 0,5·n/r, 0,5, 1,5)`. */
export const PROGRESS_WEEKS = 8;
export const PROGRESS_MIN_RESULTS = 2;
export const PROGRESS_MIN_QUALITY = 6;
export const PROGRESS_F_MIN = 0.5;
export const PROGRESS_F_MAX = 1.5;
/** `W = clamp(nedelje do trke − 1, 0, 16)`. */
export const WEEKS_MAX = 16;
/** Očekivano = tekuća + 0,65 × G (SPEC 0,6; trener 0,6–0,65; F4 bira gornju vrednost, § 14.3). [niska] */
export const EXPECTED_SHARE = 0.65;

/** Staž: < 1 god. ili početnik; 1–3; > 3. */
export const TENURE_JUNIOR_YEARS = 1;
export const TENURE_SENIOR_YEARS = 3;

/** VDOT u izlazu: dve decimale (prikaz jedna). */
export const VDOT_ROUND = 100;
/** Promena manja od ovoga se ne upisuje u istoriju. */
export const CHANGE_MIN = 0.01;

/* ------------------------------------------------------------------ krug 2 (R12, R13, R14) */

/** R12 — odrađen plan je dokaz: deo očekivanog napretka koji „istekne" sa danom plana pripisuje se tekućoj
    proceni unapred, a na kraju kalendarske nedelje ispravlja po pridržavanju te nedelje (opterećenje / planirano,
    planirano = `planned.weeks`): ≥ 0,85 pun iznos, < 0,6 ništa, linearno između. Važi samo u 16 nedelja pred trku (§ 7.5 `W`) i od poslednje trke/testa. [srednja za oblik,
    niska za brojeve] */
export const PLAN_ADHERENCE_FULL = 0.85;
export const PLAN_ADHERENCE_NONE = 0.6;
/** Bez nedeljnih ciljeva plana „planirano" = najveća baza u 6 nedelja do pre 7 dana. */
export const PLAN_REFERENCE_LAG_DAYS = 7;
/** Seme baze bez izjave: prosek prvih 28 dana istorije. */
export const LOAD_SEED_DAYS = 28;

/** R13 — pad baze: baza danas ≤ 70 % baze od pre 6 nedelja → forma −1 % na pragu, još −5 % po svakoj jedinici
    odnosa ispod 0,7, najviše −3 %. Smanjen obim uz zadržan intenzitet dugo čuva formu, pa je pad blag.
    Potrebno ≥ 42 dana istorije; ne sabira se sa pauzom u istom prozoru. [niska] */
export const BASE_DROP_DAYS = 42;
export const BASE_DROP_RATIO = 0.7;
export const BASE_DROP_LOSS_MIN = 0.01;
export const BASE_DROP_LOSS_SLOPE = 0.05;
export const BASE_DROP_LOSS_MAX = 0.03;

/** R14 — hodanje u trci: neki km sporiji od 1,25 × medijane km. Takva trka i prvi rezultat: pouzdanost ≤ srednja. */
export const WALK_SPLIT_RATIO = 1.25;

/** E8 (krug 5): uz pouzdanost „niska" očekivano vreme nije više od 1 % brže od trenutne procene. */
export const LOW_CONFIDENCE_MAX_GAIN = 0.01;
/** Z6 (krug 7): dva rezultata su saglasna kad im se VDOT razlikuje najviše 2 %. */
export const CONF_AGREE_SHARE = 0.02;
/** Z6 (krug 7): prva trka u životu — raspon prognoze bar ± 2 %. */
export const FIRST_RESULT_MIN_RANGE = 0.02;
