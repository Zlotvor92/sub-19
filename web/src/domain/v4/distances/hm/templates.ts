/* POLUMARATON — ŠABLONI KAO NAMERA (krug 3: ciljni planovi trenera su META). Šablon ne zna km ni tempo: obim je udeo
   vrha, dugi udeo najdužeg, doza udeo plafona podražaja. Za svaki broj nedelja N (1–52) × porodicu × TAČAN broj dana
   (1–7) šablon je CEO NIZ NEDELJA napisan unapred (rep dužine N, bez tela): rasterećenja, provera forme i faze su na
   mestu koje im daju ciljni planovi `docs/generators-v2/perfection/target/HM/` (p01, p04 redovan; p11, p12 početnik).

   Redosled podražaja = redosled dana kvaliteta motora: [četvrtak, utorak, …, subota] (motor ređa dane po razmaku od
   dugog u nedelju). Ciljni planovi: utorak brzina/intervali/tempo trke, četvrtak prag; u nedelji sa blokom u dugom
   četvrtak je lagan (ovde lagano + ubrzanja).

   Redovan (4+ dana, dva kvaliteta; 1–3 dana jedan kvalitet u četvrtak koji smenjuje vrste):
     osnova (brzina/brda + prag) → razvoj (intervali + prag) → rasterećenje sa pripremnom trkom subotom
     (rasterećenje najbliže 8. nedelji, najkasnije N−8) → rep od N−7: vrh obima / blok u dugom / tempo trke usred
     nedelje 2 × 3–4 km → rasterećenje N−4 → najteža N−3 (najveći blok) → N−2 ≤ 90 % → sužavanje → trka.
     Rasterećenje svake 4. nedelje brojano od N−4 unazad (nikad pre 4. nedelje).
   Početnik (jedan kvalitet u četvrtak, utorak lagano uz ubrzanja/kratke uspone): uvod bez praga 2–3 nedelje,
   prag po osećaju 10 → 20 min, pripremna trka N−8, tempo trke i mali blok (3 → 5 km) od N−5.
   Rani test (3 km, samo dok su tempa po osećaju) je u prvom rasterećenju subotom (p12: 4. nedelja). */
import type { LevelId, StimulusSlot, Template, WeekIntent, WeekKind } from '../../engine/types';

type Family = 'redovan' | 'pocetnik';

const REGULAR: LevelId[] = ['spor', 'srednji', 'brz'];
const RETURNING: LevelId[] = ['povratnik'];
const SMALL: LevelId[] = ['mali'];
const BEGINNER: LevelId[] = ['pocetnik'];
const BEGINNER_NEW: LevelId[] = ['pocetnik-nov'];

/** Isto što i `SAFETY.maxPeakOverBase`. */
export const MAX_PEAK_OVER_BASE = 1.75;

const S = (stimulus: string, dosePct?: number, workoutId?: string): StimulusSlot => ({
  stimulus,
  ...(dosePct === undefined ? {} : { dosePct: Math.round(Math.min(1, dosePct) * 1000) / 1000 }),
  ...(workoutId === undefined ? {} : { workoutId })
});

interface LongSpec {
  len: number;
  stimulus?: string;
  dose?: number;
  /** T3: talas kad dugi ne raste (motor množi samo dugi na plafonu ili polaznom). */
  wave?: number;
}

/* T3 (krug 4): talas dugog 100 / 85 / 100 / 90 % kad dugi stoji (p04, p05, p08, P3 A) */
const WAVE = [1, 0.85, 1, 0.9];

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
/* rani test forme samo dok su tempa „po osećaju"; ostalima je dan lagan */
const EARLY_TEST: StimulusSlot = { ...S('kontrola-rana'), onlyByFeel: true };
/* provera forme: pripremna trka 10 km kad obim to dozvoljava, inače 5 ili 3 km (biblioteka bira po obimu) */
const KONTROLA = S('kontrola', undefined, 'kontrola-10k');

/** Oblik nedelje: `days` dana trčanja; `single` = jedan kvalitet nedeljno (1–3 dana, početnik). */
interface Shape {
  days: number;
  single: boolean;
  /** Povratnik posle pauze: prve 2 nedelje samo ubrzanja i kratki usponi, prag kreće niže (par P1 B). */
  gentle?: boolean;
  /** Početnik sa stažom ≤ 8 nedelja (T1): 2:1 i dugi hod-trk. */
  fresh?: boolean;
}

/** Mesto subote u nizu dana kvaliteta: sa 4+ dana poslednje (subota je najbliža nedelji); sa 1–3 dana subota nije
    dan trčanja — tada prvo mesto (četvrtak). */
const satIndex = (sh: Shape): number => (sh.days >= 4 ? sh.days - 2 : 0);

/** Niz podražaja u kome `slot` stoji subotom; mesta pre njega su `head`, dopunjena ubrzanjima. */
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

/* ------------------------------------------------------------------ položaj nedelja */

interface Layout {
  /** Rasterećenja (1-indeksirano). */
  recoveries: Set<number>;
  /** Nedelja pripremne trke/provere (rasterećenje), 0 = bez nje. */
  check: number;
}

/** Rasterećenja: N−4, N−8, … unazad, nikad pre 4. nedelje. Provera forme: rasterećenje najbliže 8. nedelji, a
    najkasnije N−8 (ciljni planovi: p01 ned 8 = N−8, p04 ned 8 = N−12, p11 ned 12 = N−8). Početnik: N−8. */
function layout(n: number, family: Family, every = 4): Layout {
  const recoveries = new Set<number>();
  for (let w = n - 4; w >= every; w -= every) recoveries.add(w);
  const candidates = [...recoveries].filter((w) => w <= n - 8);
  let check = 0;
  if (family === 'pocetnik') check = candidates.includes(n - 8) ? n - 8 : 0;
  else if (candidates.length > 0)
    check = candidates.reduce((best, w) => (Math.abs(w - 8) < Math.abs(best - 8) ? w : best));
  return { recoveries, check };
}

/* ------------------------------------------------------------------ redovan */

/** Doza praga po položaju u pripremi (0 = početak, 1 = kraj tela): ciljni p01 14 → 33 min, p04 23 → 34 min. */
/* krug 5: prvi prag 0,4 osnovice — silazak intenziteta (E9) skraćuje kasne doze, a K7 traži prvi ≤ 70 % vrha */
const tDose = (t: number, gentle = false): number => lerp(gentle ? 0.35 : 0.4, 0.95, t);

function regularWeeks(n: number, sh: Shape, startLoad: number): WeekIntent[] {
  const L = layout(n, 'redovan');
  const tailStart = Math.max(1, n - 7);
  const out: WeekIntent[] = [];
  /* nedelje gradnje pre repa (bez rasterećenja): osnova, pa poslednja trećina razvoj */
  const builds: number[] = [];
  for (let w = 1; w < tailStart; w += 1) if (!L.recoveries.has(w)) builds.push(w);
  const devCount = Math.round(builds.length / 3);
  const devFrom = builds[builds.length - devCount] ?? Number.POSITIVE_INFINITY;
  /* poslednja nedelja gradnje pre provere: progresivni dugi (p01 ned 7, p04 ned 7) */
  const lastBeforeCheck = L.check > 0 ? Math.max(0, ...builds.filter((w) => w < L.check)) : 0;
  const firstRecovery = Math.min(...L.recoveries);
  const one = (thu: StimulusSlot, tue: StimulusSlot, k: number): StimulusSlot[] =>
    sh.single ? [k % 2 === 0 ? tue : thu, STRIDES] : [thu, tue];

  let osn = 0;
  let dev = 0;
  for (let w = 1; w < tailStart; w += 1) {
    const t = (w - 1) / Math.max(1, tailStart - 1);
    if (L.recoveries.has(w)) {
      if (w === L.check) {
        /* pripremna trka subotom (sa 1–3 dana četvrtak), dugi u nedelju lagan i kratak (p01 ned 8: 12 km) */
        out.push(
          week(
            dev > 0 ? RAZVOJ : OSNOVA,
            'recovery',
            1,
            { len: 0.55 },
            withSaturday(sh, sh.single ? [STRIDES] : [S('brzina', 0.9), STRIDES], KONTROLA)
          )
        );
      } else {
        out.push(
          week(
            dev > 0 ? RAZVOJ : OSNOVA,
            'recovery',
            1,
            { len: lerp(0.64, 0.73, t) },
            /* prvo rasterećenje: rani test 3 km po osećaju subotom (ciljni p12 ned 4) */
            w === firstRecovery
              ? withSaturday(sh, [S('prag', 0.27), STRIDES], EARLY_TEST)
              : [S('prag', 0.4), STRIDES]
          )
        );
      }
      continue;
    }
    /* obim raste brže na početku (ciljni p01: 0,71 → 0,93 vrha do 7. nedelje) */
    const load = lerp(startLoad, 0.97, t ** 0.6);
    const long = lerp(0.68, 0.95, t);
    /* T3: talas i smena sadržaja — svaka treća nedelja gradnje progresivan dugi (lagan / progresivan) */
    const wave = WAVE[(w - 1) % WAVE.length] ?? 1;
    const longSpec =
      w === lastBeforeCheck || (w % 3 === 0 && w < tailStart - 1)
        ? { len: long, stimulus: 'dugi-progresivno', wave }
        : { len: long, wave };
    if (sh.gentle === true && w <= 2) {
      out.push(week(OSNOVA, 'build', load, { len: long }, [HILLS_SHORT, STRIDES]));
      continue;
    }
    if (w >= devFrom) {
      /* intervali: 17 → 22 → 16 min (ciljni p01, p04; plafon 22 min); nedelja posle pripremne trke nema intervale
         (utorak je 3. dan posle trke, motor ga ionako daje lagano) */
      const afterRace = w === L.check + 1;
      if (!afterRace) dev += 1;
      /* krug 4: prva doza 0,5 osnovice — osnovica više nije plafon (S4), a budžet brzog rada (S1) skraćuje vrh */
      const iDose = [0.5, 0.9, 0.72][(Math.max(1, dev) - 1) % 3];
      out.push(
        week(
          RAZVOJ,
          'build',
          load,
          longSpec,
          afterRace
            ? [S('prag', tDose(t)), STRIDES]
            : /* krug 4 (S1): u nedelji sa intervalima prag je kraći, da budžet brzog rada (≤ 22 %) ostavi intervalima
                 rast (K7: prvi ≤ 80 % vrha zone) */
              one(S('prag', tDose(t) * 0.8), S('intervali', iDose), dev)
        )
      );
    } else {
      osn += 1;
      out.push(
        week(OSNOVA, 'build', load, longSpec, one(S('prag', tDose(t, sh.gentle)), S('brzina'), osn))
      );
    }
  }
  return [...out, ...regularTail(sh, L.check === n - 8, n < 12)].slice(-n);
}

/** Rep od N−7 do trke. `afterCheck`: N−8 je bila pripremna trka (p01), inače N−8 je obično rasterećenje (p04). */
function regularTail(sh: Shape, afterCheck: boolean, short: boolean): WeekIntent[] {
  /* sa jednim kvalitetom tempo trke ide u četvrtak, prag otpada */
  /* jedan kvalitet (1–3 dana): tempo trke umanjen, jer blok i tempo trke u tri treninga brže prelaze udeo rada */
  const pair = (thu: StimulusSlot, tue: StimulusSlot): StimulusSlot[] =>
    sh.single
      ? [tue.dosePct === undefined ? tue : { ...tue, dosePct: r3(tue.dosePct * 0.8) }, STRIDES]
      : [thu, tue];
  const blockWeek = (dose: number, rp: number, load: number): WeekIntent =>
    week(
      SPEC,
      'build',
      load,
      { len: 0.92, stimulus: 'dugi-rp', dose },
      pair(STRIDES, S('tempo-trke', rp))
    );
  const head: WeekIntent[] = afterCheck
    ? [
        /* N−7: vrh obima, oporavak od trke (utorak lagan), prag u četvrtak (p01 ned 9) */
        week(SPEC, 'build', 0.98, { len: 0.87 }, [S('prag', 0.95), STRIDES]),
        /* N−6: prvi blok 6 km + tempo trke 3 × 2 km (p01 ned 10) */
        blockWeek(0.6, 0.66, 0.98),
        /* N−5: najduži lagan dugi, tempo trke 2 × 4 km + prag (p01 ned 11) */
        week(SPEC, 'build', 0.98, { len: 1 }, pair(S('prag', 0.65), S('tempo-trke', 0.89)))
      ]
    : [
        /* N−7: vrh obima, prvi blok 4 km + tempo trke 2 × 2 km (p04 ned 13) */
        blockWeek(0.45, 0.5, 0.94),
        /* N−6: talas — kraći lagan dugi, tempo trke 2 × 3 km + prag (p04 ned 14) */
        week(SPEC, 'build', 0.93, { len: 0.81 }, pair(S('prag', 0.8), S('tempo-trke', 0.8))),
        /* N−5: drugi blok 6 km + tempo trke 3 × 2 km (p04 ned 15) */
        blockWeek(0.7, 0.7, 1)
      ];
  return [
    ...head,
    /* N−4: rasterećenje sa malim pragom */
    week(SPEC, 'recovery', 1, { len: 0.73 }, [S('prag', 0.42), STRIDES]),
    /* N−3: najteža — najveći blok (8–10 km) + tempo trke 6–9 km usred nedelje, četvrtak lagan */
    week(
      SPEC,
      'peak',
      1,
      { len: 0.95, stimulus: 'dugi-rp', dose: 1 },
      pair(STRIDES, S('tempo-trke', 0.85))
    ),
    /* N−2: ≤ 90 %, blok 4 km, tempo trke 2 × 3 km + kratak prag */
    week(
      SPEC,
      'build',
      0.85,
      { len: 0.82, stimulus: 'dugi-rp', dose: 0.45 },
      /* kratka priprema (vrh ≤ 1,4 × sadašnji obim): bez praga, inače bi pod nedelje (obim + rad, R5) bio > 85 % */
      pair(short ? STRIDES : S('prag', 0.42), S('tempo-trke', 0.6))
    ),
    /* N−1: sužavanje — tempo trke 2 × 2,5 km + prag 2 × 1 km */
    /* krug 4 (S4, T4): osnovica doze više nije plafon, pa su doze sužavanja niže (rad ≤ 60 % vršne nedelje) */
    week(FINISH, 'taper', 0.68, { len: 0.59 }, pair(S('prag', 0.2), S('tempo-trke', 0.38))),
    /* N: nedelja trke — oštrenje 2 × 1200 m u četvrtak, utorak lagano uz ubrzanja */
    week(FINISH, 'race', 0.33, null, [S('ostrenje', 1), STRIDES])
  ];
}

/* ------------------------------------------------------------------ početnik */

function beginnerWeeks(n: number, sh: Shape, startLoad: number): WeekIntent[] {
  /* T1: staž ≤ 8 nedelja — rasterećenje svake 3. nedelje (2:1), dugi hod-trk do repa */
  const fresh = sh.fresh === true;
  const L = layout(n, 'pocetnik', fresh ? 3 : 4);
  const longStim = fresh ? 'dugi-hod' : 'dugi';
  const intro = n >= 20 ? 3 : 2;
  const tailStart = Math.max(1, n - 8);
  const firstRecovery = Math.min(...L.recoveries);
  const out: WeekIntent[] = [];
  let k = 0;
  for (let w = 1; w < tailStart; w += 1) {
    const t = (w - 1) / Math.max(1, tailStart - 1);
    if (L.recoveries.has(w)) {
      out.push(
        week(
          OSNOVA,
          'recovery',
          1,
          { len: lerp(0.55, 0.65, t) },
          w === firstRecovery
            ? withSaturday(sh, [STRIDES, STRIDES], EARLY_TEST)
            : [HILLS_SHORT, STRIDES]
        )
      );
      continue;
    }
    const load = lerp(startLoad, 0.95, t ** 0.7);
    k += 1;
    /* uvod: ubrzanja i kratki usponi; zatim prag po osećaju 10 → 18 min (p11, p12) */
    const stimuli: StimulusSlot[] =
      w <= intro
        ? [w === 1 ? STRIDES6 : HILLS_SHORT, STRIDES]
        : [S('prag-p', lerp(0.45, 0.85, t)), k % 2 === 0 ? HILLS_SHORT : STRIDES];
    out.push(
      week(
        w >= tailStart - 3 ? RAZVOJ : OSNOVA,
        'build',
        load,
        { len: lerp(0.7, 0.9, t), stimulus: longStim },
        stimuli
      )
    );
  }
  const tail = [
    /* N−8: rasterećenje + pripremna trka subotom (p11 ned 12, p12 ned 8) */
    week(SPEC, 'recovery', 1, { len: 0.58 }, withSaturday(sh, [STRIDES, STRIDES], KONTROLA)),
    /* N−7, N−6: prag do 20 min, vrh obima */
    week(RAZVOJ, 'build', 0.97, { len: 0.95 }, [S('prag-p', 0.9), STRIDES]),
    week(RAZVOJ, 'build', 1, { len: 1 }, [S('prag-p', 1), HILLS_SHORT]),
    /* N−5: tempo trke 2 × 2 km + blok 3 km */
    week(SPEC, 'build', 1, { len: 0.9, stimulus: 'dugi-rp', dose: 0.37 }, [
      S('tempo-trke', 0.6),
      STRIDES
    ]),
    week(SPEC, 'recovery', 1, { len: 0.74 }, [S('prag-p', 0.35), STRIDES]),
    /* N−3: najteža — najduži dugi sa blokom 5 km, tempo trke 4–6 km */
    week(SPEC, 'peak', 1, { len: 1, stimulus: 'dugi-rp', dose: 0.6 }, [
      S('tempo-trke', 0.84),
      STRIDES
    ]),
    week(SPEC, 'build', 0.9, { len: 0.84 }, [S('tempo-trke', 0.7), STRIDES]),
    week(FINISH, 'taper', 0.69, { len: 0.58 }, [S('tempo-trke', 0.4), STRIDES]),
    week(FINISH, 'race', 0.32, null, [S('ostrenje', 0.7), STRIDES])
  ];
  return [...out, ...tail].slice(-n);
}

/* ------------------------------------------------------------------ množilac vrha (P = B / startPct) */

/** Vrh: × 1,40 u km kad priprema traje ≥ 14 nedelja (organizator, krug 3), kraće srazmerno; u bodovima vrh nosi i
    rad kvaliteta, pa je množilac bodova veći. Kapija meri km ≤ 1,40. */
const regularMult = (n: number, days: number): number => {
  const full = days <= 3 ? 1.5 : days >= 6 ? 1.55 : 1.58;
  return n >= 14 ? full : 1 + ((full - 1) * Math.max(0, n - 2)) / 12;
};
/** Početnik: isto, najviše × 1,5 (ciljni p12 × 1,31; p11 × 2,0 ne prolazi kapiju × 1,40). */
const beginnerMult = (n: number, days: number): number => Math.min(1.45, regularMult(n, days));

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
    id: `hm-${name}-${String(weeks)}-${String(sh.days)}d`,
    levels,
    minWeeks: weeks,
    maxWeeks: weeks,
    minRunDays: sh.days,
    maxRunDays: sh.days,
    startPct: sp,
    tail,
    body: [],
    recoveryEvery: 0,
    recovery: { loadFactor: 0.8, longFactor: 0.8, doseFactor: 0.65 }
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
        beginnerMult(n, days)
      ),
      /* povratnik: vrh ≈ 1,25 × u km (par P1 B: 48–50 km umesto 56) */
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
