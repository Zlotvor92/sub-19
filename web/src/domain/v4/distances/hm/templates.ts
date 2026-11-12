/* POLUMARATON — ŠABLONI KAO NAMERA. Šablon ne zna km ni tempo: obim je udeo vrha, dugi udeo najdužeg, doza udeo
   plafona podražaja. Jedan šablon po broju nedelja N (1–52) × porodica × raspon dana (SPEC § 4.2: pokriven svaki
   nivo × 1–52 nedelje × 1–7 dana); šabloni se razlikuju samo po množiocu vrha i dužini repa.

   Rep (kraj plana), brojano od trke unazad, za 12+ nedelja:
     N−8 rasterećenje + provera forme · N−7 prvi blok u dugom · N−6 talas (RP + prag) · N−5 drugi blok ·
     N−4 rasterećenje · N−3 najteža nedelja (najduži dugi, najveći blok) · N−2 ≤ 85 % · N−1 sužavanje · N trka.
   Telo (pre repa): osnova (prag + brzina/brda) pa razvoj (prag + intervali); rasterećenje svake 4. nedelje
   brojano od repa unazad. Da rasterećenje nikad ne padne u 1. ili 2. nedelju, rep dobija 1–2 nedelje razvoja kad
   bi telo imalo 4k ili 4k + 1 nedelja (motor broji rasterećenja od repa). */
import type { LevelId, StimulusSlot, Template, WeekIntent, WeekKind } from '../../engine/types';

type Family = 'redovan' | 'pocetnik';
type DayBand = 'malo' | 'vise';

const REGULAR: LevelId[] = ['spor', 'srednji', 'brz'];
/** Obim blizu plafona nivoa: isti šablon, množilac vrha najviše × 1,2 (početnik × 1,25). */
const REGULAR_FULL: LevelId[] = ['spor-obiman', 'srednji-obiman'];
const BEGINNER_FULL: LevelId[] = ['pocetnik-obiman'];
/** Mali obim: isti šablon kao 1–3 dana (jedan kvalitet + ubrzanja), za bilo koji broj dana. */
const SMALL: LevelId[] = ['mali'];
const BEGINNER: LevelId[] = ['pocetnik'];

const S = (stimulus: string, dosePct?: number, workoutId?: string): StimulusSlot => ({
  stimulus,
  ...(dosePct === undefined ? {} : { dosePct }),
  ...(workoutId === undefined ? {} : { workoutId })
});

interface LongSpec {
  len: number;
  stimulus?: string;
  dose?: number;
}

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
          ...(long.dose === undefined ? {} : { dosePct: long.dose })
        },
  stimuli,
  source: 'template'
});

const STRIDES = S('ubrzanja');
/* provera forme: 10 km kad je trkač dovoljno brz i obiman (unos to traži), inače 5 km */
const KONTROLA = S('kontrola', undefined, 'kontrola-10k');

/** Drugi dan kvaliteta: za 4+ dana pravi kvalitet, za 1–3 dana lagan dan sa ubrzanjima (jedan kvalitet nedeljno). */
const q2 = (band: DayBand, slot: StimulusSlot): StimulusSlot => (band === 'vise' ? slot : STRIDES);

/** Linearno od `a` do `b` u `n` koraka (prvi = a, poslednji = b). */
const ramp = (a: number, b: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => (n === 1 ? b : a + ((b - a) * i) / (n - 1)));

const OSNOVA = 'osnova';
const RAZVOJ = 'razvoj';
const SPEC = 'posebna';
const FINISH = 'zavrsna';

/* ------------------------------------------------------------------ telo */

function regularBody(first: number, band: DayBand): Template['body'] {
  const loads = ramp(first, 0.86, 6);
  /* 1–3 dana: dugi nosi veći deo nedelje od početka (v3: do 0,85 najdužeg) */
  const longs = band === 'malo' ? ramp(0.8, 0.88, 6) : ramp(0.76, 0.87, 6);
  const devLoads = ramp(0.88, 0.95, 5);
  const devLongs = ramp(0.88, 0.96, 5);
  return [
    {
      phase: OSNOVA,
      share: 0.5,
      cycle: loads.map((pct, i) =>
        week(OSNOVA, 'build', pct, { len: longs[i] ?? 0.86 }, [
          S('prag'),
          /* nedelja 1: jedan kvalitet + ubrzanja (nedelja 1 ≈ sadašnji obim) */
          i === 0 ? STRIDES : q2(band, S('brzina'))
        ])
      ),
      loopFrom: 5
    },
    {
      phase: RAZVOJ,
      share: 0.5,
      cycle: devLoads.map((pct, i) =>
        week(
          RAZVOJ,
          'build',
          pct,
          i % 2 === 1
            ? { len: devLongs[i] ?? 0.92, stimulus: 'dugi-progresivno' }
            : { len: devLongs[i] ?? 0.92 },
          [S('prag'), q2(band, S('intervali'))]
        )
      ),
      loopFrom: 3
    }
  ];
}

function beginnerBody(first: number): Template['body'] {
  const loads = ramp(first, 0.85, 6);
  const longs = ramp(0.76, 0.86, 6);
  const devLoads = ramp(0.87, 0.94, 5);
  const devLongs = ramp(0.87, 0.95, 5);
  /* početnik: ubrzanja i kratki usponi pre prvog praga (v3 i ciljni plan p11) */
  const intro: StimulusSlot[][] = [
    [S('ubrzanja-6')],
    [S('usponi-kratki'), STRIDES],
    [S('prag-p'), STRIDES],
    [S('prag-p'), S('usponi-kratki')],
    [S('prag-p'), STRIDES],
    [S('prag-p'), S('usponi-kratki')]
  ];
  return [
    {
      phase: OSNOVA,
      share: 0.5,
      cycle: loads.map((pct, i) =>
        week(OSNOVA, 'build', pct, { len: longs[i] ?? 0.85 }, intro[i] ?? [STRIDES])
      ),
      loopFrom: 4
    },
    {
      phase: RAZVOJ,
      share: 0.5,
      cycle: devLoads.map((pct, i) =>
        week(
          RAZVOJ,
          'build',
          pct,
          i === 2 || i === 4
            ? { len: devLongs[i] ?? 0.94, stimulus: 'dugi-progresivno' }
            : { len: devLongs[i] ?? 0.9 },
          [S('prag-p'), STRIDES]
        )
      ),
      loopFrom: 3
    }
  ];
}

/** Vrlo kratka priprema (1–7 nedelja): održavanje i tempo trke, pa najteža nedelja, sužavanje i trka. */
function shortBody(first: number, family: Family, band: DayBand): Template['body'] {
  const loads = ramp(first, 0.95, 3);
  const quality = family === 'pocetnik' ? 'prag-p' : 'prag';
  return [
    {
      phase: SPEC,
      share: 1,
      cycle: loads.map((pct, i) =>
        week(
          SPEC,
          'build',
          pct,
          i === 0 ? { len: 0.88 } : { len: 0.9, stimulus: 'dugi-rp', dose: 0.4 + 0.15 * i },
          [
            S('tempo-trke', 0.45 + 0.1 * i),
            family === 'pocetnik' ? STRIDES : q2(band, S(quality, 0.5))
          ]
        )
      ),
      loopFrom: 1
    }
  ];
}

/** Najteža nedelja kratke pripreme (2 nedelje pred trku). */
const shortPeak = (family: Family, band: DayBand): WeekIntent =>
  week(SPEC, 'peak', 1, { len: 0.98, stimulus: 'dugi-rp', dose: 0.8 }, [
    S('tempo-trke', family === 'pocetnik' || band === 'malo' ? 0.5 : 0.65),
    STRIDES
  ]);

/* ------------------------------------------------------------------ rep (kraj plana) */

/* Prvi trening tempa trke ≤ 70 % najvećeg (K7): prvi blok 0,5, najteža nedelja 0,75; bez provere forme
   (≤ 11 nedelja) drugi blok je prvi i kreće od 0,5. */

/** Sužavanje i nedelja trke: zajedničko svim šablonima. */
function finish(family: Family, band: DayBand): WeekIntent[] {
  const single = family === 'pocetnik' || band === 'malo';
  /* rad sužavanja ≤ 60 % najteže nedelje: sa jednim kvalitetom najteža nedelja ima manje rada */
  return [
    week(FINISH, 'taper', 0.66, { len: 0.68 }, [S('tempo-trke', single ? 0.4 : 0.5), STRIDES]),
    week(FINISH, 'race', 0.45, null, [S('ostrenje', 0.8), STRIDES])
  ];
}

/** Dodatne nedelje razvoja na početku repa (da rasterećenje ne padne u 1–2. nedelju). */
function extension(family: Family, band: DayBand, count: number): WeekIntent[] {
  const q: StimulusSlot[] =
    family === 'pocetnik' ? [S('prag-p'), STRIDES] : [S('prag'), q2(band, S('intervali'))];
  return Array.from({ length: count }, (_, i) =>
    week(
      RAZVOJ,
      'build',
      0.93 + 0.01 * i,
      i === count - 1 ? { len: 0.94, stimulus: 'dugi-progresivno' } : { len: 0.93 },
      q
    )
  );
}

function regularTail(band: DayBand, withCheck: boolean): WeekIntent[] {
  /* 1–3 dana: u nedelji sa blokom RP usred nedelje je manji (jedan kvalitet + blok) */
  const rp = (pct: number): number => (band === 'malo' ? pct * 0.75 : pct);
  /* 1–3 dana: i blok u dugom je manji — u tri treninga brz rad brže prelazi 22 % nedelje */
  const blk = (pct: number): number => (band === 'malo' ? pct * 0.85 : pct);
  const check = withCheck
    ? [
        week(SPEC, 'recovery', 0.8, { len: 0.7 }, [STRIDES, KONTROLA]),
        week(SPEC, 'build', 0.95, { len: 0.9, stimulus: 'dugi-rp', dose: blk(0.5) }, [
          S('tempo-trke', rp(0.5)),
          STRIDES
        ]),
        week(SPEC, 'build', 0.95, { len: 0.92 }, [S('tempo-trke', 0.65), q2(band, S('prag', 0.6))])
      ]
    : [];
  return [
    ...check,
    week(SPEC, 'build', withCheck ? 1 : 0.96, { len: 0.95, stimulus: 'dugi-rp', dose: blk(0.75) }, [
      S('tempo-trke', rp(withCheck ? 0.7 : 0.5)),
      STRIDES
    ]),
    week(SPEC, 'recovery', 0.8, { len: 0.8 }, [S('prag', 0.5), STRIDES]),
    week(SPEC, 'peak', 1, { len: 0.98, stimulus: 'dugi-rp', dose: blk(1) }, [
      S('tempo-trke', rp(0.75)),
      STRIDES
    ]),
    week(SPEC, 'build', 0.82, { len: 0.85, stimulus: 'dugi-rp', dose: blk(0.5) }, [
      S('tempo-trke', rp(0.55)),
      q2(band, S('prag', 0.35))
    ]),
    ...finish('redovan', band)
  ];
}

function beginnerTail(band: DayBand, withCheck: boolean): WeekIntent[] {
  const rp = (pct: number): number => (band === 'malo' ? pct * 0.8 : pct);
  const blk = (pct: number): number => (band === 'malo' ? pct * 0.85 : pct);
  const check = withCheck
    ? [
        week(SPEC, 'recovery', 0.8, { len: 0.7 }, [STRIDES, KONTROLA]),
        week(SPEC, 'build', 0.94, { len: 0.88, stimulus: 'dugi-rp', dose: blk(0.45) }, [
          S('tempo-trke', rp(0.45)),
          STRIDES
        ]),
        week(SPEC, 'build', 0.95, { len: 0.9 }, [S('tempo-trke', 0.6), STRIDES])
      ]
    : [];
  return [
    ...check,
    week(SPEC, 'build', withCheck ? 1 : 0.96, { len: 0.94, stimulus: 'dugi-rp', dose: blk(0.7) }, [
      S('tempo-trke', rp(withCheck ? 0.6 : 0.45)),
      STRIDES
    ]),
    week(SPEC, 'recovery', 0.8, { len: 0.8 }, [S('prag-p', 0.6), STRIDES]),
    week(SPEC, 'peak', 1, { len: 0.98, stimulus: 'dugi-rp', dose: blk(1) }, [
      S('tempo-trke', rp(0.65)),
      STRIDES
    ]),
    week(SPEC, 'build', 0.82, { len: 0.85, stimulus: 'dugi-rp', dose: blk(0.5) }, [
      S('tempo-trke', rp(0.55)),
      STRIDES
    ]),
    ...finish('pocetnik', band)
  ];
}

/* ------------------------------------------------------------------ množilac vrha (P = B / startPct) */

const lerp = (x: number, x0: number, x1: number, y0: number, y1: number): number =>
  y0 + ((y1 - y0) * Math.min(x1 - x0, Math.max(0, x - x0))) / (x1 - x0);

/** Redovan: v3 — 1,1 (6 ned) → 1,3 (12) → 1,4 (16+); kraće od 6 nedelja samo održavanje. */
const regularMult = (n: number): number =>
  n <= 6 ? lerp(n, 1, 6, 1, 1.1) : n <= 12 ? lerp(n, 6, 12, 1.1, 1.3) : lerp(n, 12, 16, 1.3, 1.4);
/** Početnik: v3 — 1 + (N − 4) / 16, najviše × 2,0 (20 nedelja). */
const beginnerMult = (n: number): number => Math.min(2, Math.max(1, 1 + (n - 4) / 16));
/** 1–3 dana za srednji i brz nivo: tri dana ne nose vrh × 1,4 (dugi ≤ 2 h 10, lagan ≤ 75 % dugog), pa najviše
    × 1,18 (v3: p08 45 → 48 km). Spor trkač sa 1–3 dana ima mali apsolutni obim i tu granicu ne dostiže. */
const capacityMult = (n: number): number => Math.min(1.18, regularMult(n));
const fullMult = (n: number): number => Math.min(1.2, regularMult(n));
const beginnerFullMult = (n: number): number => Math.min(1.25, beginnerMult(n));

/** Nedelja 1 ≈ sadašnji obim: udeo prve nedelje = startPct × 1,07 (rad kvaliteta nosi više bodova po km; isto je
    granica pravila rasta, pa nedelja 1 ne ide iznad nje). */
const FIRST_WEEK_BONUS = 1.07;

/** Dužina repa; za 12+ nedelja produžena tako da telo nema 4k ni 4k + 1 nedelja (§ 4.2 k. 5). */
function tailFor(family: Family, band: DayBand, weeks: number): WeekIntent[] {
  if (weeks <= 2) return finish(family, band);
  if (weeks <= 7) return [shortPeak(family, band), ...finish(family, band)];
  const full = weeks >= 12;
  const base = family === 'pocetnik' ? beginnerTail(band, full) : regularTail(band, full);
  if (!full) return base;
  const body = weeks - base.length;
  const extra = body % 4 === 0 ? 1 : body % 4 === 1 ? 2 : 0;
  return [...extension(family, band, Math.min(extra, Math.max(0, body - 2))), ...base];
}

function makeTemplate(
  family: Family,
  band: DayBand,
  minRun: number,
  maxRun: number,
  weeks: number,
  levels: LevelId[],
  mult: number,
  suffix = ''
): Template {
  const sp = r3(1 / mult);
  const first = Math.min(1, sp * FIRST_WEEK_BONUS);
  const body =
    weeks <= 7
      ? shortBody(first, family, band)
      : family === 'pocetnik'
        ? beginnerBody(first)
        : regularBody(first, band);
  return {
    id: `hm-${family}-${String(weeks)}-${band}${suffix}`,
    levels,
    minWeeks: weeks,
    maxWeeks: weeks,
    minRunDays: minRun,
    maxRunDays: maxRun,
    startPct: sp,
    tail: tailFor(family, band, weeks),
    body,
    /* rep već nosi svoja rasterećenja; kraće pripreme (≤ 11 nedelja) imaju telo ≤ 5 nedelja, bez rasterećenja */
    recoveryEvery: weeks >= 12 ? 4 : 0,
    recovery: { loadFactor: 0.76, longFactor: 0.8, doseFactor: 0.65 }
  };
}

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);

export const TEMPLATES: Template[] = WEEKS.flatMap((n) => [
  makeTemplate(
    'redovan',
    'malo',
    1,
    3,
    n,
    ['srednji', 'brz', ...REGULAR_FULL],
    capacityMult(n),
    '-nosivost'
  ),
  makeTemplate('redovan', 'vise', 4, 7, n, REGULAR_FULL, fullMult(n), '-obiman'),
  makeTemplate(
    'pocetnik',
    'malo',
    1,
    3,
    n,
    BEGINNER_FULL,
    Math.min(1.18, beginnerFullMult(n)),
    '-obiman'
  ),
  makeTemplate('pocetnik', 'vise', 4, 7, n, BEGINNER_FULL, beginnerFullMult(n), '-obiman'),
  makeTemplate('redovan', 'malo', 1, 3, n, REGULAR, regularMult(n)),
  makeTemplate('redovan', 'vise', 4, 7, n, REGULAR, regularMult(n)),
  makeTemplate('redovan', 'malo', 1, 7, n, SMALL, regularMult(n), '-mali-obim'),
  makeTemplate('pocetnik', 'malo', 1, 3, n, BEGINNER, beginnerMult(n)),
  makeTemplate('pocetnik', 'vise', 4, 7, n, BEGINNER, beginnerMult(n))
]);
