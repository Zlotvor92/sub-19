/* POLUMARATON — ŠABLONI KAO NAMERA. Šablon ne zna km ni tempo: obim je udeo vrha, dugi udeo najdužeg, doza udeo
   plafona podražaja. Jedan šablon po broju nedelja N (1–52) × porodica × TAČAN broj dana (1–7): broj dana određuje
   na kom mestu u nizu podražaja stoji subota (provera forme vikendom, krug 2, R17). Šabloni se razlikuju po množiocu
   vrha, dužini repa i broju kvaliteta.

   Rep (kraj plana), brojano od trke unazad, za 12+ nedelja:
     N−8 rasterećenje + provera forme subotom umesto dugog (pripremna trka 10 km gde obim dozvoljava) · N−7 prvi blok u dugom,
     usred nedelje prag · N−6 tempo trke usred nedelje (≥ prethodni prag, R16) · N−5 drugi blok · N−4 rasterećenje ·
     N−3 najteža nedelja (najduži dugi, najveći blok) · N−2 ≤ 85 % · N−1 sužavanje · N trka.
   Telo (pre repa): osnova (prag + brzina/brda) pa razvoj (prag + intervali); jedan kvalitet nedeljno (1–3 dana,
   mali obim, početnik) smenjuje prag sa brdima/brzinom u osnovi i sa intervalima u razvoju — ne 9–11 istih
   nedelja praga (R16). Rasterećenje svake 4. nedelje brojano od repa unazad; rep dobija 1–2 nedelje razvoja kad bi
   telo imalo 4k ili 4k + 1 nedelja (rasterećenje nikad u 1. ili 2. nedelji). Rani test forme (samo dok su tempa po
   osećaju) je u 2. nedelji subotom (4. kad je rasterećenje u 3.), 3 km — isti test koji navodi upozorenje motora (R17). */
import type { LevelId, StimulusSlot, Template, WeekIntent, WeekKind } from '../../engine/types';

type Family = 'redovan' | 'pocetnik';

const REGULAR: LevelId[] = ['spor', 'srednji', 'brz'];
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
const HILLS_SHORT = S('usponi-kratki');
/* rani test forme samo dok su tempa „po osećaju" (rasterećenje ga nikad ne kopira); ostalima je dan lagan */
const EARLY_TEST: StimulusSlot = { ...S('kontrola-rana'), onlyByFeel: true };
/* provera forme: pripremna trka 10 km kad obim to dozvoljava, inače 5 km ili 3 km (biblioteka bira po obimu) */
const KONTROLA = S('kontrola', undefined, 'kontrola-10k');

/** Oblik nedelje po broju dana: `days` dana trčanja, `single` = jedan kvalitet nedeljno. */
interface Shape {
  days: number;
  single: boolean;
  /** Brz nivo (VDOT ≥ 52): veće doze tempa trke usred nedelje (R16: 12–15 km). */
  strong?: boolean;
  /** Mali obim: mali vrh, pa prva doza po lestvici može pasti ispod 8 min rada. */
  small?: boolean;
}

/** Mesto subote u nizu dana kvaliteta: motor ređa dane po razmaku od dugog (nedelja), pa je subota poslednja.
    Sa 1–3 dana subota nije dan trčanja — tada prvo mesto (četvrtak, najbliže vikendu posle dugog). */
const satIndex = (sh: Shape): number => (sh.days >= 4 ? sh.days - 2 : 0);

/** Niz podražaja u kome `slot` stoji subotom; mesta pre njega su `head`, dopunjena ubrzanjima. */
function withSaturday(sh: Shape, head: StimulusSlot[], slot: StimulusSlot): StimulusSlot[] {
  const at = satIndex(sh);
  /* 1–3 dana: test u četvrtak, prvi kvalitet iz `head` ide u utorak (bez testa po osećaju ostaje on) */
  if (at === 0) return [slot, head[0] ?? STRIDES];
  const list = head.slice(0, at);
  while (list.length < at) list.push(STRIDES);
  return [...list, slot];
}

/** Drugi dan kvaliteta: sa dva kvaliteta pravi podražaj, sa jednim lagan dan sa ubrzanjima. */
const q2 = (sh: Shape, slot: StimulusSlot): StimulusSlot => (sh.single ? STRIDES : slot);

/** Linearno od `a` do `b` u `n` koraka (prvi = a, poslednji = b). */
const ramp = (a: number, b: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => (n === 1 ? b : a + ((b - a) * i) / (n - 1)));

const OSNOVA = 'osnova';
const RAZVOJ = 'razvoj';
const SPEC = 'posebna';
const FINISH = 'zavrsna';

/* ------------------------------------------------------------------ telo */

function regularBody(first: number, sh: Shape, testAt: number): Template['body'] {
  const loads = ramp(first, 0.86, 6);
  const longs = sh.days <= 3 ? ramp(0.8, 0.88, 6) : ramp(0.76, 0.87, 6);
  const devLoads = ramp(0.88, 0.95, 5);
  const devLongs = ramp(0.88, 0.96, 5);
  /* osnova: dva kvaliteta = prag + brzina/brda; jedan kvalitet = prag i brda/brzina naizmenično */
  const base = (i: number): StimulusSlot[] =>
    sh.single
      ? i >= 2 && i % 2 === 0
        ? [S('brzina'), HILLS_SHORT]
        : [S('prag'), STRIDES]
      : [S('prag'), S('brzina')];
  /* razvoj: dva kvaliteta = prag + intervali; jedan = intervali i prag naizmenično */
  const dev = (i: number): StimulusSlot[] =>
    sh.single
      ? i % 2 === 0
        ? /* prvi intervali malog obima: lestvica bi dala < 8 min rada, pa bi nedelja ostala bez kvaliteta */
          [S('intervali', i === 0 && sh.small === true ? 0.5 : undefined), STRIDES]
        : [S('prag'), STRIDES]
      : [S('prag'), S('intervali')];
  return [
    {
      phase: OSNOVA,
      share: 0.5,
      cycle: loads.map((pct, i) =>
        week(
          OSNOVA,
          'build',
          pct,
          { len: longs[i] ?? 0.86 },
          /* rani test subotom (samo po osećaju) umesto drugog kvaliteta */
          i === testAt ? withSaturday(sh, [S('prag'), STRIDES], EARLY_TEST) : base(i)
        )
      ),
      loopFrom: 2
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
          dev(i)
        )
      ),
      loopFrom: 1
    }
  ];
}

function beginnerBody(first: number, sh: Shape, testAt: number): Template['body'] {
  const loads = ramp(first, 0.85, 6);
  const longs = ramp(0.76, 0.86, 6);
  const devLoads = ramp(0.87, 0.94, 5);
  const devLongs = ramp(0.87, 0.95, 5);
  /* početnik: ubrzanja i kratki usponi pre prvog praga (v3 i ciljni plan p11) */
  const plain: StimulusSlot[][] = [
    [S('ubrzanja-6'), STRIDES],
    [HILLS_SHORT, STRIDES],
    [S('prag-p'), STRIDES],
    [HILLS_SHORT, STRIDES],
    [S('prag-p'), STRIDES],
    /* prvi intervali početnika: mala doza (≈ 3 × 3 min), lestvica posle raste od nje */
    [S('intervali', 0.35), HILLS_SHORT]
  ];
  const intro = plain.map((x, i) => (i === testAt ? withSaturday(sh, x, EARLY_TEST) : x));
  return [
    {
      phase: OSNOVA,
      share: 0.5,
      cycle: loads.map((pct, i) =>
        week(OSNOVA, 'build', pct, { len: longs[i] ?? 0.85 }, intro[i] ?? [STRIDES])
      ),
      loopFrom: 2
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
          i % 2 === 0 ? [S('prag-p'), STRIDES] : [S('intervali'), HILLS_SHORT]
        )
      ),
      loopFrom: 1
    }
  ];
}

/** Vrlo kratka priprema (1–7 nedelja): održavanje i tempo trke, pa najteža nedelja, sužavanje i trka. */
function shortBody(first: number, family: Family, sh: Shape): Template['body'] {
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
            S('tempo-trke', 0.5 + 0.05 * i),
            family === 'pocetnik' ? STRIDES : q2(sh, S(quality, 0.5))
          ]
        )
      ),
      loopFrom: 1
    }
  ];
}

/** Najteža nedelja kratke pripreme (2 nedelje pred trku). */
const shortPeak = (family: Family, sh: Shape): WeekIntent =>
  week(SPEC, 'peak', 1, { len: 0.98, stimulus: 'dugi-rp', dose: 0.8 }, [
    S('tempo-trke', family === 'pocetnik' || sh.single ? 0.55 : 0.6),
    STRIDES
  ]);

/* ------------------------------------------------------------------ rep (kraj plana) */

/** Sužavanje i nedelja trke: zajedničko svim šablonima. Tempo trke sužavanja ≥ poslednjeg praga (R16). */
function finish(sh: Shape): WeekIntent[] {
  return [
    week(FINISH, 'taper', 0.66, { len: 0.68 }, [S('tempo-trke', sh.single ? 0.5 : 0.55), STRIDES]),
    week(FINISH, 'race', 0.45, null, [S('ostrenje', 0.8), STRIDES])
  ];
}

/** Dodatne nedelje razvoja na početku repa (da rasterećenje ne padne u 1–2. nedelju). */
function extension(family: Family, sh: Shape, count: number): WeekIntent[] {
  const q: StimulusSlot[] =
    family === 'pocetnik'
      ? [S('prag-p'), STRIDES]
      : sh.single
        ? [S('intervali'), STRIDES]
        : [S('prag'), S('intervali')];
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

/** Rep: `thr` = prag te porodice; `rpScale` umanjuje tempo trke kad je kvalitet jedan nedeljno i rad brže
    prelazi 22 % nedelje. Doze tempa trke usred nedelje su ≥ doze praga pre njih (plafon tempa trke je ≈ 1,4 ×
    plafon praga, pa 0,6 tempa trke ≈ 0,85 praga). */
function tail(family: Family, sh: Shape, withCheck: boolean): WeekIntent[] {
  const thr = family === 'pocetnik' ? 'prag-p' : 'prag';
  const rp = (pct: number): number =>
    Math.min(1, sh.single ? pct * 0.95 : sh.strong === true ? pct * 1.12 : pct);
  const check = withCheck
    ? [
        /* rasterećenje sa proverom forme subotom; sa 4+ dana trka/test zamenjuje dugi te nedelje (v3: pripremna
           trka vikendom), nedelja je lagano trčanje; sa 1–3 dana test je u četvrtak, dugi ostaje */
        week(
          SPEC,
          'recovery',
          0.8,
          sh.days >= 4 ? null : { len: 0.7 },
          withSaturday(sh, [STRIDES], KONTROLA)
        ),
        week(SPEC, 'build', 0.95, { len: 0.95, stimulus: 'dugi-rp', dose: 0.5 }, [
          S(thr, 0.75),
          q2(sh, S('intervali', 0.5))
        ]),
        week(SPEC, 'build', 0.97, { len: 0.96 }, [S('tempo-trke', rp(0.65)), q2(sh, S(thr, 0.5))])
      ]
    : [];
  return [
    ...check,
    week(
      SPEC,
      'build',
      withCheck ? 1 : 0.94,
      { len: 0.95, stimulus: 'dugi-rp', dose: withCheck ? 0.75 : 0.5 },
      [S('tempo-trke', rp(0.6)), STRIDES]
    ),
    week(SPEC, 'recovery', 0.8, { len: 0.8 }, [S(thr, 0.5), STRIDES]),
    /* najteža nedelja: ključ je najveći blok u dugom; usred nedelje manji tempo trke (brz rad ≤ 22 % nedelje), a sa
       jednim kvalitetom prag (tempo trke usred nedelje bi pao ispod poslednjeg praga, R16) */
    week(SPEC, 'peak', 1, { len: 1, stimulus: 'dugi-rp', dose: 1 }, [
      sh.single ? S(thr, 0.6) : S('tempo-trke', rp(0.45)),
      STRIDES
    ]),
    /* dve nedelje pred trku: jedan tempo trke i kratak blok (nedelja ≤ 85 % najteže i kad je pod obima sadašnji
       obim + rad kvaliteta, R5) */
    week(
      SPEC,
      'build',
      0.77,
      /* brz nivo: dugi bez bloka (tempo trke usred nedelje je već velik, a pod nedelje je obim + rad kvaliteta) */
      sh.strong === true ? { len: 0.85 } : { len: 0.85, stimulus: 'dugi-rp', dose: 0.4 },
      [S('tempo-trke', sh.single ? 0.45 : 0.5), STRIDES]
    ),
    ...finish(sh)
  ];
}

/* ------------------------------------------------------------------ množilac vrha (P = B / startPct) */

const lerp = (x: number, x0: number, x1: number, y0: number, y1: number): number =>
  y0 + ((y1 - y0) * Math.min(x1 - x0, Math.max(0, x - x0))) / (x1 - x0);

/** Redovan (bodovi): ≤ 11 nedelja 1,15 → 1,5; 12+ nedelja 1,55. Plafon je `safety.maxPeakOverBase` (vrh u km
    ≈ +30–35 % kod 4 dana, nikad > 1,40 ×; R15). */
const regularMult = (n: number): number =>
  n <= 6 ? lerp(n, 1, 6, 1, 1.15) : n <= 11 ? lerp(n, 6, 12, 1.15, 1.55) : 1.55;
/** Početnik: 1 + (N − 4) / 14 (plafon kao gore). */
const beginnerMult = (n: number): number => Math.min(2.15, Math.max(1, 1 + (n - 4) / 14));
/** 1–3 dana za srednji i brz nivo: tri dana ne nose veliki vrh (dugi ≤ 2 h 15, lagan ≤ 70 % dugog), pa najviše
    × 1,25 (v3: p08 45 → 48 km). */
const capacityMult = (n: number): number => Math.min(1.25, regularMult(n));

/** Nedelja 1 ≈ sadašnji obim: udeo prve nedelje = startPct × 1,07 (rad kvaliteta nosi više bodova po km). */
const FIRST_WEEK_BONUS = 1.07;
/** Isto što i `SAFETY.maxPeakOverBase`. */
export const MAX_PEAK_OVER_BASE = 1.5;

/** Dužina repa; za 12+ nedelja produžena tako da telo nema 4k ni 4k + 1 nedelja (§ 4.2 k. 5). */
function tailFor(family: Family, sh: Shape, weeks: number): WeekIntent[] {
  if (weeks <= 2) return finish(sh);
  if (weeks <= 7) return [shortPeak(family, sh), ...finish(sh)];
  const full = weeks >= 12;
  const base = tail(family, sh, full);
  if (!full) return base;
  const body = weeks - base.length;
  const extra = body % 4 === 0 ? 1 : body % 4 === 1 ? 2 : 0;
  return [...extension(family, sh, Math.min(extra, Math.max(0, body - 2))), ...base];
}

function makeTemplate(
  name: string,
  family: Family,
  sh: Shape,
  weeks: number,
  levels: LevelId[],
  mult: number
): Template {
  /* množilac iznad plafona vrha (`safety.maxPeakOverBase`) samo bi spustio prve nedelje ispod sadašnjeg obima */
  const sp = r3(1 / Math.min(mult, MAX_PEAK_OVER_BASE));
  const first = Math.min(1, sp * FIRST_WEEK_BONUS);
  const tailWeeks = tailFor(family, sh, weeks);
  /* rasterećenje tela je kopija prethodne nedelje (motor), pa rani test ne sme pred njega: rasterećenje je u
     3. nedelji kad telo ima 4k + 2 nedelje — tada test ide u 4. nedelju (3. mesto niza), inače u 2. */
  const testAt = (weeks - tailWeeks.length) % 4 === 2 ? 2 : 1;
  const body =
    weeks <= 7
      ? shortBody(first, family, sh)
      : family === 'pocetnik'
        ? beginnerBody(first, sh, testAt)
        : regularBody(first, sh, testAt);
  return {
    id: `hm-${name}-${String(weeks)}-${String(sh.days)}d`,
    levels,
    minWeeks: weeks,
    maxWeeks: weeks,
    minRunDays: sh.days,
    maxRunDays: sh.days,
    startPct: sp,
    tail: tailWeeks,
    body,
    /* rep već nosi svoja rasterećenja; kraće pripreme (≤ 11 nedelja) imaju telo ≤ 5 nedelja, bez rasterećenja */
    recoveryEvery: weeks >= 12 ? 4 : 0,
    recovery: { loadFactor: 0.76, longFactor: 0.8, doseFactor: 0.65 }
  };
}

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);
const DAYS = [1, 2, 3, 4, 5, 6, 7];

export const TEMPLATES: Template[] = WEEKS.flatMap((n) =>
  DAYS.flatMap((days) => {
    const few = days <= 3;
    const out: Template[] = [];
    /* srednji i brz sa 1–3 dana: manji vrh (nosivost tri dana) — prvo pravilo koje važi */
    if (few)
      out.push(
        makeTemplate(
          'nosivost',
          'redovan',
          { days, single: true },
          n,
          ['srednji', 'brz'],
          capacityMult(n)
        )
      );
    out.push(
      makeTemplate(
        'brz',
        'redovan',
        { days, single: few, strong: !few },
        n,
        ['brz'],
        regularMult(n)
      )
    );
    out.push(makeTemplate('redovan', 'redovan', { days, single: few }, n, REGULAR, regularMult(n)));
    out.push(
      makeTemplate(
        'mali-obim',
        'redovan',
        { days, single: true, small: true },
        n,
        SMALL,
        regularMult(n)
      )
    );
    out.push(
      makeTemplate('pocetnik', 'pocetnik', { days, single: true }, n, BEGINNER, beginnerMult(n))
    );
    return out;
  })
);
