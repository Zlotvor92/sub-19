/* 10 KM — ŠABLONI KAO NAMERA. Šablon ne zna km ni tempo: obim je udeo vrha, dugi udeo najdužeg, doza udeo plafona
   podražaja. Za svaki broj nedelja N (1–52) × porodicu × TAČAN broj dana (1–7) šablon je CEO NIZ NEDELJA napisan
   unapred (rep dužine N, bez tela): rasterećenja, provera forme i faze su na mestu koje im daju ciljni planovi trenera
   `docs/generators-v4/coach/target/10K/` (p01, p03, p06 redovan; p11 početnik).

   Redosled podražaja = redosled dana kvaliteta motora: [četvrtak, utorak, …, subota]. Ciljni planovi: utorak brzina /
   intervali / tempo trke, četvrtak prag.

   Redovan (4+ dana, dva kvaliteta; 1–3 dana jedan kvalitet u četvrtak koji smenjuje vrste):
     osnova (brzina/usponi + prag) → razvoj (intervali + prag, poslednja trećina tela) → rep:
     N ≥ 14 (ciljni p01, krug 2 B1): N−7 vrh razvoja (intervali + prvi tempo trke 3 × 1 km, progresivan dugi) →
       N−6 provera 5 km subotom → N−5 tempo trke 5 × 1 km + završnica u pragu → N−4 gradnja 4 × 1,6 km → N−3
       najteža 3 × 2 km + intervali → N−2 ≤ 85 % → N−1 sužavanje → trka; rasterećenja unazad od provere.
     8 ≤ N < 14 (ciljni p03, p06): provera forme u rasterećenju N−4, u četvrtak → N−3 najteža → N−2 → N−1 →
       trka.
     Rasterećenje svake 4. nedelje brojano unazad od provere (nikad pre 4. nedelje); N ≥ 18: i provera u N−14.
   Početnik (jedan kvalitet u četvrtak; ciljni p11): uvod 2 nedelje samo ubrzanja, pa usponi i prag po osećaju
     10 → 18 min, provera 3 km u rasterećenju N−6, vrh obima N−5, tempo trke 1000 m od N−4, najteža N−3 (završnih
     10 min dugog u tempu trke), sužavanje, oštrenje.
   Silazak 7–10 dana: najteža nedelja je 3 pred trku (i kod kratkih planova — M7 meri nedelju −2 ≤ 85 % vrha). */
import type { LevelId, StimulusSlot, Template, WeekIntent, WeekKind } from '../../engine/types';

type Family = 'redovan' | 'pocetnik';

const REGULAR: LevelId[] = ['spor', 'srednji', 'brz'];
const RETURNING: LevelId[] = ['povratnik'];
const SMALL: LevelId[] = ['mali'];
const BEGINNER: LevelId[] = ['pocetnik'];
const BEGINNER_NEW: LevelId[] = ['pocetnik-nov'];

/** Isto što i `SAFETY.maxPeakOverBase`. */
export const MAX_PEAK_OVER_BASE = 2.2;

const S = (stimulus: string, dosePct?: number, workoutId?: string): StimulusSlot => ({
  stimulus,
  ...(dosePct === undefined ? {} : { dosePct: Math.round(Math.min(1, dosePct) * 1000) / 1000 }),
  ...(workoutId === undefined ? {} : { workoutId })
});

interface LongSpec {
  len: number;
  stimulus?: string;
  dose?: number;
  wave?: number;
}

/* talas dugog 100 / 90 / 100 / 95 % kad dugi stoji na plafonu */
const WAVE = [1, 0.9, 1, 0.95];

const r3 = (x: number): number => Math.round(x * 1000) / 1000;

const week = (
  phase: string,
  kind: WeekKind,
  loadPct: number,
  long: LongSpec | null,
  stimuli: StimulusSlot[]
): WeekIntent => ({
  phase,
  kind,
  loadPct: r3(loadPct),
  long:
    long === null
      ? null
      : {
          lenPct: r3(long.len),
          stimulus: long.stimulus ?? 'dugi',
          ...(long.dose === undefined ? {} : { dosePct: r3(long.dose) }),
          ...(long.wave === undefined || long.wave === 1 ? {} : { wave: long.wave })
        },
  stimuli,
  source: 'template'
});

const STRIDES = S('ubrzanja');
const STRIDES6 = S('ubrzanja-6');
const HILLS_SHORT = S('usponi-kratki');
const ADDONS = [STRIDES, HILLS_SHORT, STRIDES6];
const EARLY_TEST: StimulusSlot = { ...S('kontrola-rana'), onlyByFeel: true };
/* provera forme: trka ili test 5 km (biblioteka daje 3 km početniku i ispod ≈ 25 km nedeljno) */
const KONTROLA = S('kontrola', undefined, 'kontrola-5k');

interface Shape {
  days: number;
  single: boolean;
  gentle?: boolean;
  fresh?: boolean;
}

const satIndex = (sh: Shape): number => (sh.days >= 4 ? sh.days - 2 : 0);

function withSaturday(sh: Shape, head: StimulusSlot[], slot: StimulusSlot): StimulusSlot[] {
  const at = satIndex(sh);
  if (at === 0) return [slot, head[1] ?? STRIDES];
  const list = head.slice(0, at);
  while (list.length < at) list.push(STRIDES);
  return [...list, slot];
}

const OSNOVA = 'osnova';
const RAZVOJ = 'razvoj';
const SPEC = 'posebna';
const FINISH = 'zavrsna';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.min(1, Math.max(0, t));

/* ------------------------------------------------------------------ redovan */

/** Doza praga po položaju u telu (0 → 1): ciljni p01 14 → 28 min (plafon 28). */
const tDose = (t: number, gentle = false): number => lerp(gentle ? 0.4 : 0.5, 1, t);
/** Intervali kroz 3 nedelje: 12 → 17 → 22 min (README trenera 14 → 22; prvi ≤ 70 % plafona i posle zaokruživanja
    deonica, K7), plafon 22 min. */
const I_DOSE = [0.55, 0.78, 1];

function regularWeeks(n: number, sh: Shape, startLoad: number): WeekIntent[] {
  const long = n >= 14;
  /* rep: dug N−7 … N (8 nedelja), kratak N−4 … N (5 nedelja) */
  const tailLen = long ? 8 : 5;
  const tailStart = Math.max(1, n - tailLen + 1);
  /* krug 2 (B1): dug plan — rasterećenja unazad od provere N−6 (N−10, N−14, …), da između provere i najteže nedelje
     nema drugog rasterećenja; kratak plan — od provere N−4 (N−8, …). Plan od 18+ nedelja ima i proveru u N−14
     (provere na ≤ 8 nedelja, Y1). */
  const recoveries = new Set<number>();
  for (let w = n - (long ? 10 : 4); w >= 4; w -= 4) recoveries.add(w);
  const extraCheck = long && n >= 18 && recoveries.has(n - 14) ? n - 14 : 0;
  const firstRecovery = Math.min(...recoveries);
  const builds: number[] = [];
  for (let w = 1; w < tailStart; w += 1) if (!recoveries.has(w)) builds.push(w);
  const devCount = Math.round(builds.length / 3);
  const devFrom = builds[builds.length - devCount] ?? Number.POSITIVE_INFINITY;
  /* jedan kvalitet (1–3 dana): smenjuje vrste; lagan dan smenjuje dodatak (ubrzanja / kratki usponi / 6 ubrzanja),
     da utorak nije isti iz nedelje u nedelju (krug 2, p08) */
  const one = (thu: StimulusSlot, tue: StimulusSlot, k: number): StimulusSlot[] =>
    sh.single ? [k % 2 === 0 ? tue : thu, ADDONS[k % ADDONS.length] ?? STRIDES] : [thu, tue];

  const out: WeekIntent[] = [];
  let osn = 0;
  let dev = 0;
  for (let w = 1; w < tailStart; w += 1) {
    const t = (w - 1) / Math.max(1, tailStart - 1);
    const phase = w >= devFrom ? RAZVOJ : OSNOVA;
    if (recoveries.has(w)) {
      if (w === extraCheck) {
        out.push(
          week(
            phase,
            'recovery',
            1,
            { len: 0.75 },
            withSaturday(sh, sh.single ? [STRIDES] : [S('brzina', 0.8), STRIDES], KONTROLA)
          )
        );
      } else {
        out.push(
          week(
            phase,
            'recovery',
            1,
            { len: lerp(0.8, 0.85, t) },
            w === firstRecovery
              ? withSaturday(sh, [S('prag', 0.35), STRIDES], EARLY_TEST)
              : [S('prag', 0.45), STRIDES]
          )
        );
      }
      continue;
    }
    const load = lerp(startLoad, 0.96, t ** 0.6);
    /* krug 2 (B2): namera dugog od 80 % plafona — dugi raste korakom od polaznog, a sa njim i lagani dani */
    const len = lerp(0.8, 0.96, t);
    const wave = WAVE[(w - 1) % WAVE.length] ?? 1;
    /* svaka treća nedelja gradnje progresivan dugi (lagan / progresivan smena sadržaja) */
    const longSpec =
      w % 3 === 0 && w < tailStart - 1
        ? { len, stimulus: 'dugi-progresivno', dose: 0.8, wave }
        : { len, wave };
    if (sh.gentle === true && w <= 2) {
      out.push(week(OSNOVA, 'build', load, { len }, [HILLS_SHORT, STRIDES]));
      continue;
    }
    /* kratak plan: poslednja nedelja tela uvodi tempo trke i intervale — prvi tempo trke ≥ 60 % minuta poslednjeg
       praga (B7) i ≤ 70 % najvećeg (K7: najteža je 1 km deonice do plafona, ≥ 6 km); prag bi kod bliskih zona motor
       zamenio intervalima pune doze */
    if (!long && w === tailStart - 1 && n >= 8) {
      out.push(
        week(
          RAZVOJ,
          'build',
          load,
          longSpec,
          sh.single
            ? [S('tempo-trke', 0.45, 'rp-1200'), STRIDES]
            : /* R12 T2 (p02): VO2 doza veća od 3 × 800 m */
              [S('intervali', 0.6), S('tempo-trke', 0.45, 'rp-1200')]
        )
      );
      continue;
    }
    if (w >= devFrom) {
      const afterCheck = w === extraCheck + 1;
      if (!afterCheck) dev += 1;
      const iDose = I_DOSE[(Math.max(1, dev) - 1) % 3] ?? 1;
      out.push(
        week(
          RAZVOJ,
          'build',
          load,
          longSpec,
          afterCheck
            ? [S('prag', tDose(t)), STRIDES]
            : one(S('prag', tDose(t) * 0.85), S('intervali', iDose), dev + 1)
        )
      );
    } else {
      osn += 1;
      /* svaka treća nedelja osnove: kratki intervali umesto brzine (raznovrsnost, krug 2) */
      const tue = osn % 3 === 0 && sh.gentle !== true ? S('intervali', 0.5) : S('brzina');
      out.push(
        week(OSNOVA, 'build', load, longSpec, one(S('prag', tDose(t, sh.gentle)), tue, osn))
      );
    }
  }
  return [...out, ...regularTail(sh, long, n >= 8)].slice(-n);
}

/** Rep: dug (N ≥ 14) od N−7, kratak od N−4. Plan kraći od 8 nedelja nema proveru forme (N−4 je gradnja). */
function regularTail(sh: Shape, long: boolean, check: boolean): WeekIntent[] {
  /* jedan kvalitet (1–3 dana): tempo trke ima prednost, inače utorak; ubrzanja nisu kvalitet */
  const pick = (thu: StimulusSlot, tue: StimulusSlot): StimulusSlot =>
    thu.stimulus === 'tempo-trke' || tue.stimulus === STRIDES.stimulus ? thu : tue;
  const pair = (thu: StimulusSlot, tue: StimulusSlot): StimulusSlot[] =>
    sh.single ? [pick(thu, tue), STRIDES] : [thu, tue];
  const head: WeekIntent[] = long
    ? [
        /* N−7: vrh razvoja — intervali + prvi tempo trke 4–5 × 1 km (B1: tempo trke ulazi u razvoju; B7: ≥ 60 % minuta
           poslednjeg praga),
           progresivan dugi (ciljni p01 ned 9) */
        week(
          RAZVOJ,
          'build',
          0.97,
          { len: 0.95, stimulus: 'dugi-progresivno', dose: 1 },
          pair(S('tempo-trke', 0.55, 'rp-1000'), S('intervali', 0.9))
        ),
        /* N−6: provera 5 km subotom (rasterećenje), dugi u nedelju lagan i kraći (ciljni p01 ned 10) */
        week(
          SPEC,
          'recovery',
          1,
          { len: 0.75 },
          withSaturday(sh, sh.single ? [STRIDES] : [S('brzina', 0.8), STRIDES], KONTROLA)
        ),
        /* N−5: tempo trke 5 × 1 km (veća doza lomi izlazak iz prozora R2 u s25) + dugi sa završnicom u pragu (ciljni p01 ned 11; utorak je 3. dan posle provere,
           pa lagan) */
        week(
          SPEC,
          'build',
          0.97,
          { len: 0.95, stimulus: 'dugi-prag', dose: 1 },
          /* jedan kvalitet: drugi oblik (1,2 km), da N−7 i N−5 nisu isti trening (krug 3, p10) */
          pair(S('tempo-trke', 0.6, sh.single ? 'rp-1200' : 'rp-1000'), STRIDES)
        ),
        /* N−4: gradnja, ne rasterećenje (B1) — tempo trke 4 × 1,6 km + intervali, dugi lagan najduži */
        week(
          SPEC,
          'build',
          1,
          { len: 1 },
          /* jedan kvalitet: intervali (tempo trke inače 5 nedelja zaredom) */
          sh.single
            ? [S('intervali', 0.8), STRIDES]
            : pair(S('intervali', 0.7), S('tempo-trke', 0.65, 'rp-1600'))
        )
      ]
    : [
        /* N−4: rasterećenje sa proverom 5 km u ČETVRTAK (ciljni p03 ned 8: „čet, sub ako može"): vršna nedelja posle
           nje počinje 5. dan posle provere i zadržava oba kvaliteta (K2: 3 dana bez brzog posle provere) */
        check
          ? week(SPEC, 'recovery', 1, { len: 0.88 }, [KONTROLA])
          : week(
              RAZVOJ,
              'build',
              0.95,
              { len: 0.92 },
              pair(S('intervali', 0.6), S('tempo-trke', 0.4))
            )
      ];
  return [
    ...head,
    /* N−3: najteža — tempo trke 3 × 2000 m + intervali, dugi sa završnicom (ciljni p01 ned 13) */
    week(
      SPEC,
      'peak',
      1,
      /* R12 T4 (p01 ned 13): dug plan — dugi lagan, da najteža nema tri teška treninga u 4 dana (intervali čet + prag
         u dugom ned + tempo trke uto = 3 od 4 dana trčanja); 1–3 dana i 5+ dana zadržavaju završnicu u dugom */
      long && !sh.single && sh.days <= 4
        ? { len: 1 }
        : { len: 1, stimulus: long ? 'dugi-prag' : 'dugi-rp', dose: 1 },
      /* kratak plan (mali obim, budžet brzog rada): tempo trke u prvom mestu (četvrtak) dobija budžet prvi */
      long
        ? pair(S('intervali', !sh.single && sh.days <= 4 ? 1 : 0.8), S('tempo-trke', 1))
        : /* plan kraći od 8 nedelja: manja doza, da najteža ne skoči preko pravila rasta (8 × 1 km posle 42 km) */
          pair(S('tempo-trke', check ? 1 : 0.7, 'rp-1000'), S('intervali', 0.9))
    ),
    /* N−2: ≤ 85 % — tempo trke 4 × 1600 m + kratki intervali, dugi lagan (ciljni p01 ned 14: kratak prag; kod 10 km
       je prag često ≈ tempo trke, pa bi ga motor zamenio intervalima pune doze — zato intervali male doze odmah) */
    week(
      SPEC,
      'build',
      0.82,
      { len: long ? 0.85 : 0.8 },
      pair(S('intervali', 0.45), S('tempo-trke', 0.85, long ? 'rp-1600' : undefined))
    ),
    /* N−1: sužavanje — tempo trke 3 × 1000 m + kratki intervali (ciljni p01 ned 15: prag 2 × 1000 m; v. N−2) */
    week(
      FINISH,
      'taper',
      0.68,
      { len: long ? 0.72 : 0.62 },
      pair(S('intervali', 0.4), S('tempo-trke', 0.4, 'rp-1200'))
    ),
    /* N: nedelja trke — oštrenje 3 × 800 m u četvrtak, utorak lagano uz ubrzanja */
    week(FINISH, 'race', 0.32, null, [S('ostrenje', 1), STRIDES])
  ];
}

/* ------------------------------------------------------------------ početnik */

function beginnerWeeks(n: number, sh: Shape, startLoad: number): WeekIntent[] {
  const fresh = sh.fresh === true;
  const every = fresh ? 3 : 4;
  const longStim = fresh ? 'dugi-hod' : 'dugi';
  const intro = 2;
  /* rep: N−6 provera, N−5 … N; telo do N−7 sa rasterećenjima unazad od provere */
  const tailStart = Math.max(1, n - 6);
  const recoveries = new Set<number>();
  for (let w = n - 6 - every; w >= every; w -= every) recoveries.add(w);
  const firstRecovery = Math.min(...recoveries);
  const out: WeekIntent[] = [];
  let k = 0;
  for (let w = 1; w < tailStart; w += 1) {
    const t = (w - 1) / Math.max(1, tailStart - 1);
    if (recoveries.has(w)) {
      out.push(
        week(
          /* krug 3: faza ne ide unazad — rasterećenje nosi fazu svog mesta */
          w >= tailStart - 3 ? RAZVOJ : OSNOVA,
          'recovery',
          1,
          { len: lerp(0.7, 0.75, t), stimulus: longStim },
          w === firstRecovery
            ? withSaturday(sh, [STRIDES, STRIDES], EARLY_TEST)
            : [HILLS_SHORT, STRIDES]
        )
      );
      continue;
    }
    const load = lerp(startLoad, 0.94, t ** 0.7);
    k += 1;
    /* uvod: ubrzanja; zatim usponi i prag po osećaju 10 → 18 min (ciljni p11 ned 5–11) */
    const stimuli: StimulusSlot[] =
      w <= intro
        ? [w === 1 ? STRIDES : STRIDES6, STRIDES]
        : k % 3 === 0
          ? /* R12 T3 (p11 ned 7): usponi uz utorak, četvrtak ostaje prag — lagan četvrtak od 49 min umesto praga od
               32 min dizao je nedelju + 12,8 % */
            [S('prag-p', lerp(0.5, 0.9, t)), HILLS_SHORT]
          : [S('prag-p', lerp(0.5, 0.9, t)), STRIDES];
    out.push(
      week(
        w >= tailStart - 3 ? RAZVOJ : OSNOVA,
        'build',
        load,
        { len: lerp(0.85, 1, t), stimulus: longStim },
        stimuli
      )
    );
  }
  const tail = [
    /* N−6: rasterećenje + provera 3 km (ciljni p11 ned 12) */
    week(
      SPEC,
      'recovery',
      1,
      { len: 0.62, stimulus: longStim },
      withSaturday(sh, [STRIDES, STRIDES], KONTROLA)
    ),
    /* N−5: vrh obima, prag 18 min (ciljni p11 ned 13) */
    week(SPEC, 'build', 0.98, { len: 0.95, stimulus: longStim }, [S('prag-p', 0.95), STRIDES]),
    /* N−4: tempo trke 3 × 1000 m (ciljni p11 ned 14) */
    week(SPEC, 'build', 1, { len: 1 }, [S('tempo-trke', 0.45), STRIDES]),
    /* N−3: najteža — tempo trke 4 × 1000 m, završnih 10 min dugog u tempu trke (ciljni p11 ned 15) */
    week(SPEC, 'peak', 1, { len: 1, stimulus: 'dugi-rp', dose: 1 }, [
      S('tempo-trke', 0.95),
      STRIDES
    ]),
    week(SPEC, 'build', 0.84, { len: 0.88 }, [S('tempo-trke', 0.65), STRIDES]),
    week(FINISH, 'taper', 0.68, { len: 0.68 }, [S('tempo-trke', 0.4), STRIDES]),
    week(FINISH, 'race', 0.3, null, [S('ostrenje', 0.8), STRIDES])
  ];
  return [...out, ...tail].slice(-n);
}

/* ------------------------------------------------------------------ množilac vrha (P = B / startPct) */

/** Množilac prvih nedelja (P = B / startPct): vrh određuje lestvica (`safety.peakLadder`) i plafon nivoa, a
    `startPct` samo oblikuje prve nedelje. Krug 2 (B2): × 1,45 (6 dana × 1,4) za 14+ nedelja — veći množilac je prve
    nedelje stavljao ispod sadašnjeg obima, pa ih je motor držao na polaznom (p04, p12: ravno 5–18 nedelja). */
const regularMult = (n: number, days: number): number => {
  const full = days >= 6 ? 1.4 : 1.45;
  return n >= 14 ? full : 1 + ((full - 1) * Math.max(0, n - 2)) / 12;
};
/** Početnik: ciljni p11 × 1,8 u km za 18 nedelja (bodovi × 2,1); 12–17 nedelja × 1,4, kraće × 1,35 (B2: p12 pet
    istih nedelja kod × 1,8). */
const beginnerMult = (n: number, days: number): number =>
  n >= 18 ? 1.95 : n >= 12 ? 1.4 : Math.min(1.35, regularMult(n, days));

function makeTemplate(
  name: string,
  family: Family,
  sh: Shape,
  weeks: number,
  levels: LevelId[],
  mult: number
): Template {
  const sp = r3(1 / Math.min(mult, MAX_PEAK_OVER_BASE));
  const tail = family === 'pocetnik' ? beginnerWeeks(weeks, sh, sp) : regularWeeks(weeks, sh, sp);
  return {
    id: `tenk-${name}-${String(weeks)}-${String(sh.days)}d`,
    levels,
    minWeeks: weeks,
    maxWeeks: weeks,
    minRunDays: sh.days,
    maxRunDays: sh.days,
    startPct: sp,
    tail,
    body: [],
    recoveryEvery: 0,
    recovery: { loadFactor: 0.8, longFactor: 0.9, doseFactor: 0.65 }
  };
}

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);
const DAYS = [1, 2, 3, 4, 5, 6, 7];

export const TEMPLATES: Template[] = WEEKS.flatMap((n) =>
  DAYS.flatMap((days) => {
    const few = days <= 3;
    return [
      makeTemplate(
        'redovan',
        'redovan',
        { days, single: few },
        n,
        [...REGULAR, ...SMALL],
        regularMult(n, days)
      ),
      makeTemplate(
        'pocetnik',
        'pocetnik',
        { days, single: true },
        n,
        BEGINNER,
        beginnerMult(n, days)
      ),
      makeTemplate(
        'pocetnik-nov',
        'pocetnik',
        { days, single: true, fresh: true },
        n,
        BEGINNER_NEW,
        Math.min(1.65, beginnerMult(n, days))
      ),
      /* povratnik: vrh ≈ 1,25 × u km */
      makeTemplate(
        'povratnik',
        'redovan',
        { days, single: few, gentle: true },
        n,
        RETURNING,
        1 + (regularMult(n, days) - 1) * 0.8
      )
    ];
  })
);
