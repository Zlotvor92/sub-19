/* MARATON — ŠABLONI KAO NAMERA. Šablon ne zna km ni tempo: obim je udeo vrha, dugi udeo najdužeg, doza udeo plafona
   podražaja. Za svaki broj nedelja N (1–52) × porodicu × TAČAN broj dana (1–7) šablon je CEO NIZ NEDELJA napisan
   unapred. Jezgro su planovi od 8 do 30 nedelja (ciljni planovi trenera `coach/target/MAR/`: p07 12 ned, p12 18,
   p08 i p11 24); kraći i duži planovi su isti obrazac (kraći odseca početak, duži dodaje osnovu).

   Redosled podražaja = redosled dana kvaliteta motora: [četvrtak, utorak, …, subota].

   Redovan (4+ dana, dva kvaliteta; 1–3 dana jedan):
     osnova (prag + brda/brzina; dugi raste sa talasom) → razvoj (prag + intervali ili tempo trke 2 × 3 km; dugi
     progresivan) → N−8 rasterećenje sa proverom 10 km subotom → specifična: N−7 blok 1 u dugom (≈ 8 km MP),
     N−6 talas (kraći lagan dugi, MP 2 × 4–5 km usred nedelje), N−5 blok 2 (≈ 12 km), N−4 rasterećenje, N−3
     najteža (najduži dugi sa najvećim blokom ≈ 14 km) → sužavanje 3 nedelje: N−2 ≈ 80 % (dugi 20–22 km sa
     poslednja 3 km MP, MP 2 × 3 km), N−1 ≈ 60 % (dugi 12–14 km, MP 4 km), nedelja trke ≈ 30 % + trka.
     U nedelji sa blokom u dugom nema MP usred nedelje (README trenera) — samo prag ili lagano.
   Početnik (jedan kvalitet u četvrtak): uvod 2 nedelje ubrzanja/usponi, prag po osećaju, N−8 provera, MP od N−6,
   blok 6 → 8 km (≤ 55 min). Nov početnik (staž ≤ 8 nedelja): rasterećenje svake 3. nedelje i dugi hod-trk.
   Rani test (3 ili 5 km, samo dok su tempa po osećaju) u prvom rasterećenju subotom (ciljni p12: 4. nedelja). */
import type { LevelId, StimulusSlot, Template, WeekIntent, WeekKind } from '../../engine/types';

type Family = 'redovan' | 'pocetnik';

const REGULAR: LevelId[] = ['srednji', 'brz'];
const SLOW: LevelId[] = ['spor'];
const RETURNING: LevelId[] = ['povratnik'];
const SMALL: LevelId[] = ['mali'];
const BEGINNER: LevelId[] = ['pocetnik'];
const BEGINNER_NEW: LevelId[] = ['pocetnik-nov'];

/** Isto što i `SAFETY.maxPeakOverBase` (lestvica vrha ga ionako zamenjuje). */
export const MAX_PEAK_OVER_BASE = 2.3;

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

/* talas dugog od početka (README: vrh / −15–20 % / vrh) */
const WAVE = [1, 0.88, 1, 0.82];
/* 1–3 dana: bez talasa u telu — nedelja je ≈ 2,4 × dugi (lagani dani ≤ 70 % dugog), pa kraći dugi ruši nedelju ispod
   cilja; talas daju rasterećenja i N−6 */
const WAVE_FEW = [1, 0.95, 1, 1];

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
const EARLY_TEST: StimulusSlot = { ...S('kontrola-rana'), onlyByFeel: true };
/* provera forme: 10 km kad obim to dozvoljava, inače 5 ili 3 km (biblioteka bira po obimu) */
const KONTROLA = S('kontrola', undefined, 'kontrola-10k');
/* R5 (krug 12): pripremni polumaraton 6–9 nedelja pred maraton (README; ciljni p08 ned 15 = N−9) */
const KONTROLA_HM = S('kontrola', undefined, 'kontrola-hm');

interface Shape {
  days: number;
  single: boolean;
  gentle?: boolean;
  fresh?: boolean;
  /** R6 (krug 12): spor i mali obim (VDOT < 40 ili ispod 40 km) — bez intervala (README: I samo za VDOT ≥ 40); u
      razvoju umesto intervala ubrzanja, pa nedelja nosi prag + tempo maratona ili samo prag uz dugi */
  noIntervals?: boolean;
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

/* ------------------------------------------------------------------ položaj nedelja */

interface Layout {
  recoveries: Set<number>;
  /** Nedelja provere (rasterećenje), 0 = bez nje. */
  check: number;
  /** Ranija provera u planu od 16+ nedelja (N−16), 0 = bez nje. */
  early: number;
}

/** Rasterećenja: N−4, N−8, … unazad, nikad pre 4. nedelje (README: svake 4. nedelje). Provera forme: N−8
    (ciljni p07 ned 4, p08 i p11 ned 16 = pripremna trka); plan od 16+ nedelja i ranija (N−16 ili najbliža
    raniji rasterećenju), da tempa ne stoje duže od 8 nedelja bez rezultata. */
function layout(n: number, every = 4): Layout {
  const recoveries = new Set<number>();
  for (let w = n - 4; w >= every; w -= every) recoveries.add(w);
  const check = recoveries.has(n - 8) ? n - 8 : 0;
  const early = n >= 16 && check > 0 && recoveries.has(check - 8) ? check - 8 : 0;
  return { recoveries, check, early };
}

/* ------------------------------------------------------------------ redovan */

/** Prag kroz osnovu i razvoj 23 → 35 min (README), ovde udeo plafona (35 min). */
const tDose = (t: number, gentle = false): number => lerp(gentle ? 0.5 : 0.56, 0.95, t);

function regularWeeks(n: number, sh: Shape, startLoad: number): WeekIntent[] {
  const L = layout(n);
  /* plan ≥ 18 nedelja: rep počinje pripremnim polumaratonom u N−9 */
  const tailStart = Math.max(1, n >= 18 ? n - 9 : n - 8);
  const out: WeekIntent[] = [];
  const builds: number[] = [];
  for (let w = 1; w < tailStart; w += 1) if (!L.recoveries.has(w)) builds.push(w);
  /* razvoj: poslednja trećina tela (najmanje 0) */
  const devCount = Math.round(builds.length / 3);
  const devFrom = builds[builds.length - devCount] ?? Number.POSITIVE_INFINITY;
  const firstRecovery = Math.min(...L.recoveries);
  /* sa jednim kvalitetom smena vrsta po nedeljama */
  const one = (thu: StimulusSlot, tue: StimulusSlot, k: number): StimulusSlot[] =>
    sh.single ? [k % 2 === 0 ? tue : thu, STRIDES] : [thu, tue];

  let osn = 0;
  let dev = 0;
  for (let w = 1; w < tailStart; w += 1) {
    const t = (w - 1) / Math.max(1, tailStart - 1);
    if (L.recoveries.has(w)) {
      if (w === L.early) {
        out.push(
          week(
            dev > 0 ? RAZVOJ : OSNOVA,
            'recovery',
            1,
            { len: 0.5 },
            withSaturday(sh, sh.single ? [STRIDES] : [S('prag', 0.4), STRIDES], KONTROLA)
          )
        );
      } else {
        out.push(
          week(
            dev > 0 ? RAZVOJ : OSNOVA,
            'recovery',
            1,
            { len: 1 },
            w === firstRecovery
              ? withSaturday(sh, [S('prag', 0.4), STRIDES], EARLY_TEST)
              : [S('prag', 0.45), STRIDES]
          )
        );
      }
      continue;
    }
    /* dugi raste kroz telo od ≈ 66 % do ≈ 92 % najdužeg (README: + 1–2 km po koraku, talas od početka). Talas je u
       nameri (ne samo na plafonu): 100 / 88 / 100 / 82 %; sa 1–3 dana blaži (dugi je pola nedelje), a nedelja prati
       dugi (lagani dani ne smeju preko 70 % dugog, pa ne mogu da nadoknade kraći dugi) */
    /* kratak plan (< 16 nedelja): bez talasa u telu — dugi ima premalo nedelja da stigne do 28–32 km (ciljni p07) */
    const wave = (sh.single || n < 16 ? WAVE_FEW : WAVE)[(w - 1) % WAVE.length] ?? 1;
    const load = lerp(startLoad, 0.95, t ** 0.7) * (1 - (sh.single ? 0.6 : 0.3) * (1 - wave));
    /* 1–3 dana: dugi kreće bliže polaznom, da raste od prve nedelje (inače stoji na polaznom, a nedelja ne može da
       raste — lagani dani su vezani za dugi) */
    const long = (sh.single || sh.gentle === true ? lerp(0.8, 0.95, t) : lerp(0.9, 0.97, t)) * wave;
    if (sh.gentle === true && w <= 2) {
      out.push(week(OSNOVA, 'build', load, { len: long }, [HILLS_SHORT, STRIDES]));
      continue;
    }
    if (w >= devFrom) {
      dev += 1;
      /* razvoj: prag + smena intervala (17–21 min) i tempa trke 2 × 3 km; dugi progresivan svake druge nedelje */
      const second =
        dev % 2 === 1
          ? sh.noIntervals === true
            ? STRIDES
            : S('intervali', dev === 1 ? 0.65 : 1)
          : S('tempo-trke', dev <= 2 ? 0.45 : 0.6);
      /* R4: talas i na plafonu (dugi koji je stigao do najdužeg dozvoljenog ne stoji) */
      const capWave = { wave: 1 - (1 - wave) * 1.5 };
      const longSpec =
        /* povratnik: dugi lagan (progresivni deo nosi više km za isto vreme — korak dugog u km, K7) */
        dev % 2 === 0 || sh.gentle === true
          ? { len: long, ...capWave }
          : { len: long, stimulus: 'dugi-progresivno', ...capWave };
      /* u nedelji sa intervalima prag je kraći: budžet brzog rada (≤ 18 %) ostavlja intervalima 17–21 min (K7) */
      const pragDose = second.stimulus === 'intervali' ? tDose(t) * 0.65 : tDose(t) * 0.85;
      out.push(week(RAZVOJ, 'build', load, longSpec, one(S('prag', pragDose), second, dev)));
    } else {
      osn += 1;
      /* brzina: smena uspona i kratkih brzih deonica (redosled u biblioteci) */
      const second = S('brzina');
      out.push(
        week(
          OSNOVA,
          'build',
          load,
          { len: long, wave: 1 - (1 - wave) * 1.5 },
          one(S('prag', tDose(t, sh.gentle)), second, osn)
        )
      );
    }
  }
  return [...out, ...regularTail(sh, n)].slice(-n);
}

/** Rep od N−8 do trke (ciljni p07 ned 4–12, p08 ned 16–24). */
function regularTail(sh: Shape, n: number): WeekIntent[] {
  /* jedan kvalitet (1–3 dana): u nedelji sa blokom oba druga dana lagana (README), inače MP ili prag */
  const pair = (thu: StimulusSlot, tue: StimulusSlot): StimulusSlot[] =>
    sh.single ? [tue.stimulus === 'ubrzanja' ? STRIDES : tue, STRIDES] : [thu, tue];
  const block = (dose: number, len: number, load: number, kind: WeekKind = 'build'): WeekIntent =>
    week(
      SPEC,
      kind,
      load,
      { len, stimulus: 'dugi-rp', dose },
      /* nedelja sa blokom: utorak lagan uz ubrzanja, prag u četvrtak (kod 1–3 dana samo lagano) */
      sh.single ? [STRIDES, STRIDES] : [S('prag', 0.6), STRIDES]
    );
  const short = n < 12;
  /* R5 (krug 12): plan ≥ 18 nedelja — N−9 pripremni polumaraton na dan dugog (M10, krug 15), N−8 cela nedelja bez
     kvaliteta (README: „zatim cela nedelja bez kvaliteta") */
  const halfRace: WeekIntent[] =
    n >= 18
      ? [
          /* M10 (krug 15): polumaraton na dan dugog (nedelja), bez dugog te nedelje */
          {
            /* R17 (sudija 2): nedelja trke nije odmor od 5–6 dana — obim ≈ 85 % uz lagane dane, bez kvaliteta */
            ...week(RAZVOJ, 'build', 0.85, null, sh.single ? [STRIDES] : [STRIDES, STRIDES]),
            long: { lenPct: 1, stimulus: 'dugi', race: KONTROLA_HM }
          },
          /* 1–3 dana: dugi posle trke kraći (≤ ≈ 45 % nedelje, R17) */
          week(RAZVOJ, 'build', 0.85, { len: sh.single ? 0.6 : 0.78 }, [STRIDES, STRIDES])
        ]
      : [
          /* N−8: rasterećenje + provera 10 km subotom, dugi kratak lagan; plan kraći od 12 nedelja nema proveru u
             prve 3 nedelje — tada je N−8 nedelja gradnje */
          short
            ? week(RAZVOJ, 'build', 0.9, { len: 0.8 }, pair(S('prag', 0.7), S('tempo-trke', 0.6)))
            : week(
                RAZVOJ,
                'recovery',
                1,
                { len: 0.5 },
                withSaturday(sh, sh.single ? [STRIDES] : [STRIDES, STRIDES], KONTROLA)
              )
        ];
  return [
    ...halfRace,
    /* N−7: R18 — lagan dugi (bez bloka: višak km bloka bi skratio dugi u udelu ≤ 45 %), da lestvica N−7 → N−5 → N−3
       stigne do 26 km; plan kraći od 16 nedelja zadržava prvi blok (≈ 8 km MP) */
    n >= 16
      ? week(
          SPEC,
          'build',
          0.93,
          { len: sh.single ? 0.84 : 0.92 },
          sh.single ? [STRIDES, STRIDES] : [S('prag', 0.6), STRIDES]
        )
      : block(0.5, sh.single ? 0.84 : 0.92, short ? 0.95 : 0.93),
    /* N−6: talas — kraći lagan dugi, MP usred nedelje 2 × 4–5 km + prag */
    week(
      SPEC,
      'build',
      sh.single ? 0.84 : 0.92,
      { len: 0.68, wave: 0.85 },
      /* MP 0,85 plafona: deonice se zaokružuju na 0,5 km, pa 3 × 4,5 km ne prelazi 50 min */
      pair(S('prag', 0.6), S('tempo-trke', 0.85))
    ),
    /* N−5: prvi najduži dugi (R1: dva puta u poslednjih 7 nedelja, N−5 i N−3), blok ≈ 10–11 km MP */
    block(0.7, 0.98, 1),
    /* N−4: rasterećenje sa kratkim pragom */
    week(SPEC, 'recovery', 1, { len: 1 }, [S('prag', 0.5), STRIDES]),
    /* N−3: najteža — najduži dugi sa najvećim blokom (≈ 12–13 km MP, R3: ≤ 45 % dugog) */
    week(
      SPEC,
      'peak',
      1,
      { len: 1, stimulus: 'dugi-rp', dose: 0.85 },
      sh.single ? [STRIDES, STRIDES] : [S('prag', 0.45), STRIDES]
    ),
    /* N−2: ≈ 80 % — dugi 20–22 km sa poslednja 3 km u MP, MP 2 × 3 km usred nedelje */
    /* vrsta „taper": dugi nije vezan za polazni (pod gradnje), ciljni N−2 dugi 20–22 km i kod velikog obima */
    week(
      FINISH,
      'taper',
      0.78,
      { len: 0.6, stimulus: 'dugi-rp', dose: 0.22 },
      /* jedan kvalitet: vršna nedelja nosi samo blok, pa MP ≤ 55 % njenog rada zajedno sa 3 km u dugom */
      pair(STRIDES, S('tempo-trke', sh.single ? 0.42 : 0.5))
    ),
    /* N−1: ≈ 60 % — dugi 12–14 km lagano, MP 4 km */
    week(FINISH, 'taper', 0.6, { len: 0.42 }, pair(STRIDES, S('tempo-trke', 0.5))),
    /* N: nedelja trke ≈ 30 % — oštrenje MP 2 × 1000 m u četvrtak, utorak lagano uz ubrzanja */
    week(FINISH, 'race', 0.3, null, [S('ostrenje', 1), STRIDES])
  ];
}

/* ------------------------------------------------------------------ početnik */

function beginnerWeeks(n: number, sh: Shape, startLoad: number): WeekIntent[] {
  const fresh = sh.fresh === true;
  const L = layout(n, fresh ? 3 : 4);
  const longStim = fresh ? 'dugi-hod' : 'dugi';
  /* R2/R4 (krug 12): nov ili spor početnik (p13, p18, P2 B) — dugi je vreme na nogama uz hod-trk, bez MP bloka */
  const blockStim = fresh ? longStim : 'dugi-rp';
  const blockOf = (dose: number): { stimulus: string; dose?: number } =>
    fresh ? { stimulus: longStim } : { stimulus: blockStim, dose };
  const intro = n >= 20 ? 3 : 2;
  const tailStart = Math.max(1, n >= 18 ? n - 9 : n - 8);
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
          { len: 1, stimulus: longStim },
          w === firstRecovery
            ? withSaturday(sh, [STRIDES, STRIDES], EARLY_TEST)
            : w === L.early
              ? withSaturday(sh, [STRIDES, STRIDES], KONTROLA)
              : [HILLS_SHORT, STRIDES]
        )
      );
      continue;
    }
    k += 1;
    const stimuli: StimulusSlot[] =
      w <= intro
        ? [w === 1 ? STRIDES6 : HILLS_SHORT, STRIDES]
        : [S('prag-p', lerp(0.45, 0.9, t)), k % 2 === 0 ? HILLS_SHORT : STRIDES];
    /* početnik (jedan kvalitet): talas daju rasterećenja i N−6, kao kod 1–3 dana */
    const wave = WAVE_FEW[(w - 1) % WAVE.length] ?? 1;
    const load = lerp(startLoad, 0.93, t ** 0.7) * (1 - 0.3 * (1 - wave));
    out.push(
      week(
        w >= tailStart - 3 ? RAZVOJ : OSNOVA,
        'build',
        load,
        { len: lerp(0.6, 0.86, t) * wave, stimulus: longStim },
        stimuli
      )
    );
  }
  /* R5 (krug 12): plan ≥ 18 nedelja — pripremni polumaraton u N−9 (ciljni p11 ned 16, p12 ned 11), pa nedelja bez
     kvaliteta; kraći plan: N−8 rasterećenje + 10 km subotom (ciljni p12 ned 8, p11 ned 12), < 12 nedelja gradnja */
  const head: WeekIntent[] =
    n >= 18
      ? [
          /* M10 (krug 15): polumaraton na dan dugog */
          {
            ...week(RAZVOJ, 'build', 0.85, null, [STRIDES, STRIDES]),
            long: { lenPct: 1, stimulus: 'dugi', race: KONTROLA_HM }
          },
          week(RAZVOJ, 'build', 0.85, { len: 0.78, stimulus: longStim }, [STRIDES, STRIDES])
        ]
      : [
          n < 12
            ? week(RAZVOJ, 'build', 0.9, { len: 0.8, stimulus: longStim }, [
                S('prag-p', 0.8),
                STRIDES
              ])
            : week(
                RAZVOJ,
                'recovery',
                1,
                { len: 0.5, stimulus: longStim },
                withSaturday(sh, [STRIDES, STRIDES], KONTROLA)
              )
        ];
  const tail = [
    ...head,
    /* N−7: prag po osećaju, dugi raste */
    week(
      RAZVOJ,
      'build',
      0.95,
      { len: 0.88, ...(n >= 16 ? blockOf(0.36) : { stimulus: longStim }) },
      [S('prag-p', 1), STRIDES]
    ),
    /* N−6: talas — MP 2 × 3 km usred nedelje */
    week(SPEC, 'build', 0.97, { len: 0.68, stimulus: longStim, wave: 0.85 }, [
      S('tempo-trke', fresh ? 0.4 : 0.75),
      STRIDES
    ]),
    /* N−5: blok 6 km MP (≈ 40 min), usred nedelje lagano */
    /* nov/spor početnik: bez bloka, MP usred nedelje raste 0,4 → 0,6 → 0,7 (K7: prvi ≤ 70 % vrha) */
    week(SPEC, 'build', 1, { len: 0.97, ...blockOf(n >= 16 ? 0.45 : 0.52) }, [
      fresh ? S('tempo-trke', 0.6) : STRIDES,
      STRIDES
    ]),
    week(SPEC, 'recovery', 1, { len: 1, stimulus: longStim }, [S('prag-p', 0.45), STRIDES]),
    /* N−3: najteža — najduži dugi (≈ 3 h – 3 h 15) sa blokom 8 km MP (≤ 55 min) */
    /* R18: blok 0,6 — višak km bloka uz korak dugog ne sme preći + 2 km / 12 % (K7) */
    week(SPEC, 'peak', 1, { len: 0.98, ...blockOf(n >= 16 ? 0.55 : 0.85) }, [
      fresh ? S('tempo-trke', 0.7) : STRIDES,
      STRIDES
    ]),
    /* N−2: ≈ 80 %, MP 4 km, dugi 18 km sa poslednja 3 km MP */
    week(FINISH, 'taper', 0.8, { len: 0.6, ...blockOf(0.27) }, [S('tempo-trke', 0.3), STRIDES]),
    week(FINISH, 'taper', 0.6, { len: 0.42, stimulus: longStim }, [S('tempo-trke', 0.4), STRIDES]),
    week(FINISH, 'race', 0.3, null, [S('ostrenje', 0.8), STRIDES])
  ];
  return [...out, ...tail].slice(-n);
}

/* ------------------------------------------------------------------ množilac za oblik prvih nedelja */

/** Lestvica vrha (`SAFETY.peakLadder`) je jedini vlasnik vrha; `startPct` samo oblikuje prve nedelje (koji udeo vrha
    je nedelja 1). Broj je ≈ množilac lestvice za srednji polazni obim (40–60 km). */
const regularMult = (n: number): number =>
  n >= 20 ? 1.4 : n >= 16 ? 1.28 : n >= 12 ? 1.2 : 1 + (0.15 * Math.max(0, n - 4)) / 8;
/* početnik obično kreće sa malim obimom, a lestvica mu daje do × 2,1: nedelje rastu od × 1/startPct, pa je za njega
   startPct bliži lestvici malog obima (inače su prve nedelje cilj iznad onoga što rast od 7 % dozvoljava — skok) */
const beginnerMult = (n: number): number => (n >= 24 ? 2 : n >= 18 ? 1.75 : n >= 12 ? 1.5 : 1.3);

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
    id: `mar-${name}-${String(weeks)}-${String(sh.days)}d`,
    levels,
    minWeeks: weeks,
    maxWeeks: weeks,
    minRunDays: sh.days,
    maxRunDays: sh.days,
    startPct: sp,
    tail,
    body: [],
    recoveryEvery: 0,
    /* rasterećenje: nedelja ≈ 75 % cilja, dugi ≈ 72 % prethodnog (ciljni p07: 84 → 66 km, 30 → 21 km) */
    recovery: { loadFactor: 0.75, longFactor: 0.72, doseFactor: 0.6 }
  };
}

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);
const DAYS = [1, 2, 3, 4, 5, 6, 7];

export const TEMPLATES: Template[] = WEEKS.flatMap((n) =>
  DAYS.flatMap((days) => {
    const few = days <= 3;
    return [
      makeTemplate('redovan', 'redovan', { days, single: few }, n, REGULAR, regularMult(n)),
      makeTemplate(
        'spor',
        'redovan',
        { days, single: few, noIntervals: true },
        n,
        [...SLOW, ...SMALL],
        regularMult(n)
      ),
      makeTemplate('pocetnik', 'pocetnik', { days, single: true }, n, BEGINNER, beginnerMult(n)),
      makeTemplate(
        'pocetnik-nov',
        'pocetnik',
        { days, single: true, fresh: true },
        n,
        BEGINNER_NEW,
        beginnerMult(n)
      ),
      makeTemplate(
        'povratnik',
        'redovan',
        { days, single: few, gentle: true },
        n,
        RETURNING,
        1 + (regularMult(n) - 1) * 0.8
      )
    ];
  })
);
