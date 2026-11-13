/* 5 KM — ŠABLONI KAO NAMERA. Šablon ne zna km ni tempo: obim je udeo vrha, dugi udeo najdužeg, doza udeo plafona
   podražaja. Za svaki broj nedelja N (1–52; sadržajno 4–24, duži plan produžava osnovu, kraći od 4 je samo rep) ×
   porodicu × TAČAN broj dana (1–7) šablon je CEO NIZ NEDELJA napisan unapred: rasterećenja, provera forme i faze su
   na mestu koje im daju ciljni planovi trenera `docs/generators-v4/coach/target/5K/` (p01, p04, p08 redovan; p11
   početnik).

   Redosled podražaja = redosled dana kvaliteta motora: [četvrtak, utorak, …, subota]. Ciljni planovi: utorak brzina
   (R) / intervali / tempo trke, četvrtak prag.

   Redovan (4+ dana, dva kvaliteta):
     osnova (R 200–400 m ili usponi 45 s + prag 14 → 26 min) → razvoj (I blok 3 nedelje 65 → 80 → 100 % + prag
     održavanje, završnih 8–10 min dugog u pragu u vrhu obima) → N−4 rasterećenje + provera 3 km subotom → N−3
     najteža (tempo trke 5 × 1000 m, završnica dugog u pragu) → N−2 ≤ 85 % (tempo trke + kratka brzina) → N−1
     sužavanje (tempo trke 3 × 1000 m + kratak prag) → nedelja trke (oštrenje 4 × 400 m).
     Rasterećenje svake 4. nedelje brojano unazad od provere (N−8, N−12, …; nikad pre 4. nedelje).
     Plan kraći od 8 nedelja nema proveru: razvoj → najteža → N−2 → N−1 → trka.
   Tri dana: utorak glavni kvalitet, četvrtak mali podražaj (kratak prag ili usponi) naizmenično sa završnicom u
     dugom (ciljni p08). Jedan–dva dana: jedan kvalitet.
   Početnik (jedan kvalitet u četvrtak; ciljni p11): uvod 2 nedelje samo ubrzanja, pa usponi, fartlek i tempo po
     osećaju 10 → 15 min, provera 1,5 km u rasterećenju N−4, tempo trke 4 × 800 m → 3 × 1000 m → 3 × 600 m, oštrenje.
   Sužavanje 5–7 dana: najteža nedelja je 3 pred trku, nedelja −2 ≤ 85 % vrha, nedelja −1 ≈ 70 %. */
import type { LevelId, StimulusSlot, Template, WeekIntent, WeekKind } from '../../engine/types';

type Family = 'redovan' | 'pocetnik';

const REGULAR: LevelId[] = ['spor', 'srednji', 'brz'];
const RETURNING: LevelId[] = ['povratnik'];
const SMALL: LevelId[] = ['mali'];
const BEGINNER: LevelId[] = ['pocetnik'];
const BEGINNER_NEW: LevelId[] = ['pocetnik-nov'];

/** Isto što i `SAFETY.maxPeakOverBase`. */
export const MAX_PEAK_OVER_BASE = 2.0;

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

/* talas dugog 100 / 95 / 100 / 97 % kad dugi stoji na plafonu (R12: 92 % je kod dugog od 100 min ostavljao lagan dan
   iznad 80 % dugog) */
const WAVE = [1, 0.95, 1, 0.97];

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
const ADDONS = [HILLS_SHORT, STRIDES6, STRIDES];
const EARLY_TEST: StimulusSlot = { ...S('kontrola-rana'), onlyByFeel: true };
/* provera forme: test 3 km (biblioteka daje 1,5 km početniku i ispod ≈ 20 km nedeljno) */
const KONTROLA = S('kontrola');

interface Shape {
  days: number;
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

/** I blok kroz 3 nedelje: 70 → 85 → 100 % (README trenera 5K 65 → 80 → 100; 70 % da i mali obim dobije prvi trening
    ≥ 8 min — K8; ciljni p01 14 → 17 → 22 min). */
const I_DOSE = [0.7, 0.85, 1];

/** Dva kvaliteta po broju dana: [četvrtak, utorak]. 3 dana (ciljni p08): utorak nosi glavni kvalitet, četvrtak je
    lagan dan sa dodatkom (usponi / ubrzanja) — kratak kvalitet u četvrtak skraćuje nedelju za 5 km i dugi tada nosi
    preko 46 % nedelje; drugi podražaj je progresivan dugi svake treće nedelje. U osnovi utorak smenjuje brzinu i
    prag (ciljni p08 ned 1–7: R, T, R, …). 1–2 dana: jedan kvalitet. */
function pairFor(
  sh: Shape,
  thu: StimulusSlot,
  tue: StimulusSlot,
  k: number,
  alternate = false
): StimulusSlot[] {
  if (sh.days <= 2) return [alternate && k % 2 === 0 ? thu : tue, STRIDES];
  if (sh.days === 3)
    return [ADDONS[k % ADDONS.length] ?? STRIDES, alternate && k % 2 === 0 ? thu : tue];
  /* R12 (F5): 4+ dana u osnovi — lagan dan nosi ubrzanja ili kratke uspone (README: 4–6 × 20 s svake nedelje;
     stariji trkač sa jednim kvalitetom inače ostaje bez neuromišićnog podražaja — p16). U razvoju ne: dodatak kod
     malog obima uzima mesto drugom kvalitetu (p02, p06) */
  return alternate ? [thu, tue, ADDONS[k % ADDONS.length] ?? STRIDES] : [thu, tue];
}

/** 3 dana: progresivan dugi svake treće nedelje (vidi `pairFor`). */
const threeDayProgressive = (sh: Shape, k: number): boolean => sh.days === 3 && k % 3 === 0;

function regularWeeks(n: number, sh: Shape, startLoad: number): WeekIntent[] {
  const check = n >= 8;
  /* rep: N−4 (provera) … N, kraći plan N−3 … N */
  /* R17: plan ≤ 5 nedelja — najteža je 2 pred trku, bez nedelje −2 (sužavanje 7–10 dana; p14: 4 nedelje nisu
     1 najteža + 3 silaska) */
  const short = n <= 5;
  const tailLen = check ? 5 : short ? 3 : 4;
  const tailStart = Math.max(1, n - tailLen + 1);
  const recoveries = new Set<number>();
  if (check) for (let w = n - 8; w >= 4; w -= 4) recoveries.add(w);
  const firstRecovery = recoveries.size > 0 ? Math.min(...recoveries) : 0;
  /* razvoj = poslednje 3 nedelje tela (I blok); kod kraćeg plana bez provere celo telo */
  const devFrom = check ? n - 7 : 1;
  const out: WeekIntent[] = [];
  let osn = 0;
  let dev = 0;
  let k = 0;
  for (let w = 1; w < tailStart; w += 1) {
    const t = (w - 1) / Math.max(1, tailStart - 1);
    if (recoveries.has(w)) {
      /* rasterećenje: jedan kratak kvalitet (≤ 60 % doze), dugi 0,8 × (README); prvo rasterećenje kod tempa po
         osećaju nosi rani test u subotu */
      out.push(
        week(
          w >= devFrom ? RAZVOJ : OSNOVA,
          'recovery',
          1,
          { len: 0.8 },
          w === firstRecovery
            ? withSaturday(sh, [STRIDES6, S('brzina', 0.55)], EARLY_TEST)
            : [STRIDES6, S(w >= devFrom ? 'intervali' : 'brzina', 0.55)]
        )
      );
      continue;
    }
    k += 1;
    /* R12 (F4): telo do 92 % vrha — najveći obim plana je najteža nedelja (N−3), ne nedelja tela (ispis je zove „vršna") */
    const load = lerp(startLoad, 0.92, t ** 0.6);
    const len = lerp(0.82, 0.97, t);
    const wave = WAVE[(w - 1) % WAVE.length] ?? 1;
    if (sh.gentle === true && w <= 2) {
      out.push(week(OSNOVA, 'build', load, { len }, [HILLS_SHORT, STRIDES]));
      continue;
    }
    if (w >= devFrom) {
      dev += 1;
      const iDose = I_DOSE[Math.min(2, dev - 1)] ?? 1;
      const top = w === tailStart - 1;
      /* vrh obima (poslednja nedelja razvoja): završnih 8–10 min dugog u pragu (ciljni p01, p04 ned 7/11) i prvi
         tempo trke umesto praga (≈ 60 % najvećeg, deonice od 400 m da zaokruživanje ne pređe 70 % — K7: prvi trening podražaja ≤ 70 % vrha, inače bi najteža nedelja
         dobila samo 70 %) */
      const longSpec =
        top && sh.days !== 3 && !short
          ? { len: 1, stimulus: 'dugi-prag', dose: 1 }
          : threeDayProgressive(sh, k) && !top
            ? { len, stimulus: 'dugi-progresivno', dose: 0.8, wave }
            : { len: top ? 1 : len, wave: top ? 1 : wave };
      const thu = top && (check || short) ? S('tempo-trke', 0.6, 'rp-400') : S('prag', 0.8);
      out.push(
        week(
          RAZVOJ,
          'build',
          top ? (sh.days === 3 ? 1 : 0.94) : load,
          longSpec,
          sh.days === 3 && top && (check || short)
            ? [thu, S('intervali', iDose)]
            : pairFor(sh, thu, S('intervali', iDose), k)
        )
      );
    } else {
      osn += 1;
      /* osnova: R raste 70 → 100 % (README 6 → 12 min), prag 55 → 100 % (deonice → u komadu) */
      const tb = (osn - 1) / Math.max(1, devFrom - 2);
      const longSpec = threeDayProgressive(sh, k)
        ? { len, stimulus: 'dugi-progresivno', dose: 0.8, wave }
        : { len, wave };
      out.push(
        week(
          OSNOVA,
          'build',
          load,
          longSpec,
          pairFor(sh, S('prag', lerp(0.55, 1, tb)), S('brzina', lerp(0.7, 1, tb)), k, true)
        )
      );
    }
  }
  return [...out, ...regularTail(sh, check, short)].slice(-n);
}

/** Rep: N−4 (provera) … N; plan kraći od 8 nedelja N−3 … N. */
function regularTail(sh: Shape, check: boolean, short = false): WeekIntent[] {
  const head: WeekIntent[] = check
    ? [
        /* N−4: rasterećenje + provera 3 km subotom (ciljni p01 ned 8); 3 dana: četvrtak; dan pre provere lagan */
        week(SPEC, 'recovery', 1, { len: 0.72 }, withSaturday(sh, [STRIDES6, STRIDES], KONTROLA))
      ]
    : [];
  const one = sh.days <= 2;
  return [
    ...head,
    /* N−3: najteža — tempo trke 5 × 1000 m (20–22 min); posle provere utorak lagan, drugi podražaj je završnica
       dugog u pragu (ciljni p01 ned 9); bez provere i R 6 × 300 m (ciljni p04 ned 13) */
    week(
      SPEC,
      'peak',
      1,
      { len: 1, stimulus: 'dugi-prag', dose: 1 },
      /* bez provere (plan < 8 nedelja) ovo je prvi tempo trke (≤ 70 % vrha, K7): deonice od 400 m, da
         zaokruživanje ne pređe granicu */
      one
        ? [S('tempo-trke', 1, check || short ? 'rp-1000' : 'rp-400'), STRIDES]
        : check
          ? [S('tempo-trke', 1, 'rp-1000'), STRIDES6]
          : [S('tempo-trke', 1, short ? 'rp-1000' : 'rp-400'), S('brzina', 0.6)]
    ),
    /* N−2: ≤ 85 % — tempo trke 4 × 1000 m + R 6 × 200 m (ciljni p01 ned 10); plan ≤ 5 nedelja je nema */
    ...(short
      ? []
      : [
          week(
            SPEC,
            'build',
            0.82,
            { len: 0.88 },
            one
              ? [S('tempo-trke', 0.85), STRIDES]
              : sh.days === 3
                ? [STRIDES6, S('tempo-trke', 0.85)]
                : [S('brzina', 0.35, 'r-200'), S('tempo-trke', 0.85)]
          )
        ]),
    /* N−1: sužavanje — tempo trke ≈ 60 % (ciljni p01 ned 11: 3 × 1000 m; ovde deonice od 800 m, da zaokruživanje ne
       pređe 60 % najveće doze) */
    week(
      FINISH,
      'taper',
      0.7,
      { len: 0.66 },
      /* sužavanje bez praga (README: RP 3 × 1000 m + T 1,5 km): sa pragom brz rad nedelje −1 kod velikog obima
         prelazi rad nedelje −2 (p05: 26 prema 25 min) — silazak intenziteta ima prednost.
         3 dana: jedan podražaj (tempo trke u četvrtak), utorak lagan bez ubrzanja — mali obim bi dan sa ubrzanjima
         skratio ispod 20 min (dodatak ne čuva najkraće lagano; zahtev motoru) */
      /* plan ≤ 5 nedelja: najteža ima prvi tempo trke (≤ 70 % vrha), pa sužavanje 40 % da ostane ≤ 60 % najteže */
      sh.days === 3
        ? [S('tempo-trke', short ? 0.4 : 0.6, 'rp-600')]
        : [STRIDES, S('tempo-trke', short ? 0.4 : 0.6, 'rp-800')]
    ),
    /* N: nedelja trke — oštrenje 4 × 400 m u tempu trke u četvrtak, utorak lagano uz ubrzanja */
    /* 3 dana: utorak lagan bez ubrzanja (mali obim bi ga skratio ispod 20 min) */
    week(
      FINISH,
      'race',
      0.3,
      null,
      sh.days === 3 ? [S('ostrenje', 1)] : [S('ostrenje', 1), STRIDES]
    )
  ];
}

/* ------------------------------------------------------------------ početnik */

function beginnerWeeks(n: number, sh: Shape, startLoad: number): WeekIntent[] {
  const fresh = sh.fresh === true;
  /* hod-trk početnik: rasterećenje svake 4. nedelje kao ostali — kod ≈ 10 km nedeljno rasterećenje svake 3. ostavlja
     nedelju od 2 treninga (20 min je najkraće trčanje) */
  const every = 4;
  const longStim = fresh ? 'dugi-hod' : 'dugi';
  /* R12 (F5): hod-trk početnik pre trke trči dugi u komadu 30–35 min (trka traje ≈ 31 min). R17: samo u nedelji
     provere (N−4) i u N−1 — u najtežoj i N−2 dugi ostaje hod-trk pune dužine, inače nedelja (lagan ≤ 75 % dugog) pada
     5 nedelja zaredom posle vrha */
  const tailLong = (len: number, inOnePiece = false): { len: number; stimulus: string } =>
    fresh && inOnePiece
      ? { len: Math.min(len, 0.6), stimulus: 'dugi' }
      : { len, stimulus: longStim };
  /* R17 (p12): uvod samo ubrzanjima 2 nedelje kod 12+ nedelja, 1 nedelja kod kraćih (p12: prvi rad tek u ned 4–5) */
  const intro = fresh || n >= 12 ? 2 : 1;
  const check = n >= 8;
  /* rep: N−4 provera (kraći plan bez provere), N−3 … N; telo sa rasterećenjima unazad od provere */
  const tailStart = Math.max(1, n - (check ? 4 : 3));
  const recoveries = new Set<number>();
  if (check) for (let w = n - 4 - every; w >= every; w -= every) recoveries.add(w);
  const firstRecovery = recoveries.size > 0 ? Math.min(...recoveries) : 0;
  const out: WeekIntent[] = [];
  let k = 0;
  for (let w = 1; w < tailStart; w += 1) {
    const t = (w - 1) / Math.max(1, tailStart - 1);
    if (recoveries.has(w)) {
      out.push(
        week(
          OSNOVA,
          'recovery',
          1,
          { len: 0.78, stimulus: longStim },
          /* hod-trk početnik: bez ranog testa (jedna provera, u N−4) */
          w === firstRecovery && !fresh
            ? withSaturday(sh, [STRIDES, STRIDES], EARLY_TEST)
            : [HILLS_SHORT, STRIDES]
        )
      );
      continue;
    }
    /* linearno: posle rasterećenja i prvog fartleka obim početnika inače skače + 20 % (p11 ned 5) */
    const load = lerp(startLoad, 0.95, t);
    k += 1;
    /* uvod: ubrzanja; zatim usponi, fartlek i tempo po osećaju 10 → 15 min (ciljni p11 ned 3–11) */
    const stimuli: StimulusSlot[] =
      w <= intro
        ? [w === 1 ? STRIDES : STRIDES6, STRIDES]
        : fresh
          ? [k % 2 === 0 ? HILLS_SHORT : STRIDES6, STRIDES]
          : check && w === tailStart - 1
            ? /* prvi tempo trke pre najteže (K7), kao kod redovnog */
              [S('tempo-trke', 0.6, 'rp-600'), STRIDES]
            : k % 3 === 0
              ? [HILLS_SHORT, STRIDES]
              : [S('prag-p', lerp(0.45, 1, t)), STRIDES];
    out.push(
      week(
        w >= tailStart - 3 ? RAZVOJ : OSNOVA,
        'build',
        load,
        { len: lerp(0.82, 1, t), stimulus: longStim },
        stimuli
      )
    );
  }
  const tail = [
    ...(check
      ? [
          /* N−4: rasterećenje + provera 1,5 km „jako ravnomerno" (ciljni p11 ned 8: kraći test) */
          week(
            SPEC,
            'recovery',
            1,
            tailLong(0.72, true),
            withSaturday(sh, [STRIDES, STRIDES], KONTROLA)
          )
        ]
      : []),
    /* N−3: najteža — prvi put ciljni tempo, 4 × 800 m (ciljni p11 ned 13) */
    week(SPEC, 'peak', 1, tailLong(1), [
      S('tempo-trke', fresh ? 0.7 : 1, fresh ? 'rp-400' : 'rp-800'),
      STRIDES
    ]),
    /* N−2: tempo trke 3 × 1000 m (ciljni p11 ned 14) */
    week(SPEC, 'build', 0.88, tailLong(0.9), [
      S('tempo-trke', fresh ? 0.8 : 0.95, fresh ? 'rp-400' : 'rp-1000'),
      STRIDES
    ]),
    /* N−1: sužavanje — tempo trke 3 × 600 m (ciljni p11 ned 15) */
    week(FINISH, 'taper', 0.72, tailLong(0.6, true), [
      S('tempo-trke', 0.6, fresh ? 'rp-400' : 'rp-600'),
      STRIDES
    ]),
    /* nedelja trke: 40 % vrha (malom obimu 30 % ne nosi ni dva lagana dana od 20 min) */
    week(FINISH, 'race', 0.4, null, [S('ostrenje', 0.8), STRIDES])
  ];
  return [...out, ...tail].slice(-n);
}

/* ------------------------------------------------------------------ množilac vrha (P = B / startPct) */

/** Množilac prvih nedelja (P = B / startPct): vrh određuje lestvica (`safety.peakLadder`) i plafon nivoa, a
    `startPct` samo oblikuje prve nedelje. 5 km: × 1,15 za 12+ nedelja (ciljni p01 × 1,2, p04 × 1,1). */
const regularMult = (n: number): number => (n >= 12 ? 1.3 : 1 + (0.3 * Math.max(0, n - 2)) / 10);
/** Početnik: ciljni p11 × 1,6 u km za 16 nedelja (bodovi ≈ × 1,8); 8–13 nedelja × 1,45, kraće × 1,25. */
const beginnerMult = (n: number): number => (n >= 14 ? 1.8 : n >= 8 ? 1.45 : 1.25);

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
    id: `fivek-${name}-${String(weeks)}-${String(sh.days)}d`,
    levels,
    minWeeks: weeks,
    maxWeeks: weeks,
    minRunDays: sh.days,
    maxRunDays: sh.days,
    startPct: sp,
    tail,
    body: [],
    recoveryEvery: 0,
    recovery: { loadFactor: 0.78, longFactor: 0.85, doseFactor: 0.6 }
  };
}

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);
const DAYS = [1, 2, 3, 4, 5, 6, 7];

export const TEMPLATES: Template[] = WEEKS.flatMap((n) =>
  DAYS.flatMap((days) => [
    makeTemplate('redovan', 'redovan', { days }, n, [...REGULAR, ...SMALL], regularMult(n)),
    makeTemplate('pocetnik', 'pocetnik', { days }, n, BEGINNER, beginnerMult(n)),
    makeTemplate(
      'pocetnik-nov',
      'pocetnik',
      { days, fresh: true },
      n,
      BEGINNER_NEW,
      Math.min(1.5, beginnerMult(n))
    ),
    /* povratnik: vrh ≈ 1,2 × u km */
    makeTemplate(
      'povratnik',
      'redovan',
      { days, gentle: true },
      n,
      RETURNING,
      1 + (regularMult(n) - 1) * 0.8
    )
  ])
);
