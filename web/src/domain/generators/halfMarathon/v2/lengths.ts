/* H13 — dužine dugog i laganih trčanja (jedini vlasnik). Rad u desetinkama km (korak 0,1). Dugi uzima
   najveću dozvoljenu dužinu (≤ udeo cilja po broju dana H15, ≤ 150 min sporim E, ≤ 24 km, u nedelji 1 ≤
   kotrljajuća granica pouke 28 (HI7: ≤ max(1,1 × L, L + 1,0), L = najduži dugi prethodne 4 nedelje i u nedeljama
   1–4 skorašnji najduži trk) i da svaki lagan ostane ≥ 4 km); lagani dele ostatak na jednake delove (razlika ≤ 0,1 km). Dugi ≥ svaki lagan je tvrdo pravilo
   (pouka 2): kad ne može da se ispuni, nedelja nije izvodljiva (H6). */

import { HM_V2_POLICY as P } from './policy.ts';
import type { Paces } from './types.ts';

const EPS = 1e-9;
export const EASY_MIN10 = Math.round(P.lengths.easyMinKm * 10);

/** Pravilo dugog iz pravila plana (policy.planRule): udeo reda H15 i plafon trajanja (H13; početnik 135 min,
    H17). */
export interface LongRule {
  readonly longMaxShare: number;
  readonly longMaxSec: number;
  /** T1 izuzetak (nedelja na minimumu, buildLengths); pravilo plana ga nosi (H15). */
  readonly weekMinKm?: number;
  /** T1/G6: lagan ≤ ovaj udeo dugog u nedelji izgradnje (pravilo plana; bez polja 0,8). */
  readonly easyLongMaxShare?: number;
  /** G8: početnik — dugi sme do `share` cilja nedelje da bi dostigao `km`. */
  readonly longReach?: { readonly share: number; readonly km: number };
}

export interface Lengths {
  long10: number;
  /** Lagani dani redom (raniji dan prvi). */
  easy10: number[];
}

/** H13: plafon dugog od 150 min (početnik 135 min, H17) sporim E [0,1 km]. */
export function longTimeCap10(p: Paces, longMaxSec: number): number {
  return Math.floor((longMaxSec / p.E.slow) * 10 + EPS);
}

/** H13 (odluka HM-01 → 02): plafon dugog u km [0,1 km]. */
export const longKmCap10 = (): number => Math.round(P.lengths.longMaxKm * 10);

/** Pouka 28 (HI7): granica dugog iz najdužeg prethodnog `l10` — max(1,1 × L, L + 1,0) [0,1 km, naniže]. */
export function stepCap10(l10: number): number {
  const q = P.recentLong;
  return Math.max(Math.floor(q.factor * l10 + EPS), l10 + Math.round(q.addKm * 10));
}

/** Pouka 28 (HI7): granica dugog iz skorašnjeg najdužeg trka [0,1 km]. */
export const recentLongCap10 = (recentKm: number): number => stepCap10(Math.round(recentKm * 10));

/** Pouka 28 (HI7): kotrljajuća granica dugog nedelje `index` (1-indeks) — L = najduži dugi nedelja
    index − 4 … index − 1 (`longs10[i]` = dugi nedelje i + 1, null bez dugog) i u nedeljama 1–4 skorašnji
    najduži trk kad je dat; bez L nema granice (∞). Jedna funkcija za konstruktor, validator i poruku. */
export function rollingLongCap10(
  index: number,
  longs10: readonly (number | null)[],
  recentKm: number | null | undefined
): number {
  const w = P.recentLong.windowWeeks;
  const prev = longs10
    .slice(Math.max(0, index - 1 - w), index - 1)
    .filter((x): x is number => x !== null);
  if (recentKm != null && index <= w) prev.push(Math.round(recentKm * 10));
  return prev.length === 0 ? Infinity : stepCap10(Math.max(...prev));
}

/** Pouka 28 (HI7): najmanji skorašnji najduži trk [0,1 km] (≥ 5 km) za koji je dugi `long10` u granici. */
export function recentLongNeeded10(long10: number): number {
  let r10 = Math.round(P.recentLong.minKm * 10);
  while (recentLongCap10(r10 / 10) < long10) r10++;
  return r10;
}

/** HI8: apsolutni plafon dugog nedelje 1 — min(150 min (početnik 135), 24 km, kotrljajuća granica nedelje 1 =
    granica skorašnjeg najdužeg ako je dat) [0,1 km]. Jedna funkcija za konstruktor, poruku i validator
    (pouka 9, 24). */
export function week1LongCap10(
  p: Paces,
  recentKm: number | null | undefined,
  longMaxSec: number
): number {
  return Math.min(longTimeCap10(p, longMaxSec), longKmCap10(), rollingLongCap10(1, [], recentKm));
}

/** H13/H15: plafon dugog kao udeo cilja nedelje [0,1 km]. */
export function longShareCap10(
  target10: number,
  rule: { longMaxShare: number; longReach?: { share: number; km: number } }
): number {
  const base = Math.floor(rule.longMaxShare * target10 + EPS);
  // G8 (P8, STOP S2 → O2): početnik — max(udeo reda; min(50 % cilja, 16 km)); jedno mesto, validator čita isto.
  const r = rule.longReach;
  return r
    ? Math.max(base, Math.min(Math.floor(r.share * target10 + EPS), Math.round(r.km * 10)))
    : base;
}

/** H13: najduži dozvoljen dugi [0,1 km] za cilj nedelje (udeo H15, trajanje, 24 km; `roll10` — kotrljajuća
    granica pouke 28, HI7). */
export function longCap10(target10: number, rule: LongRule, p: Paces, roll10 = Infinity): number {
  return Math.min(
    longShareCap10(target10, rule),
    longTimeCap10(p, rule.longMaxSec),
    longKmCap10(),
    roll10
  );
}

/** H7: plafon dugog tapera — 0,6 × najduži dugi plana [0,1 km]. HM-09 (B3, kao A18 deloadLong10): najmanje 4 km —
    posle smanjenja (najduži < 6,7 km) 0,6 × bi bio kraći od laganog minimuma i taper nije izvodljiv (pouka 2);
    validator tada upozorava TAPER_LONG_MIN. */
export function taperLongCap10(longest10: number): number {
  return Math.max(EASY_MIN10, Math.floor(P.taper.longFactor * longest10 + EPS));
}

/** HM-09 (B3): dugi tapera je na minimumu 4 km iznad 0,6 × najduži (taperLongCap10). */
export const taperLongAtMin = (long10: number, longest10: number): boolean =>
  long10 > Math.floor(P.taper.longFactor * longest10 + EPS);

/** H5: dugi rasterećenja — 0,8 × poslednji ne-rasteretni dugi [0,1 km]. A18 (adaptirana nedelja, kao 10K
    deloadLengths): najmanje 4 km — posle povratka sa dugim 4 km 0,8 × bi bio kraći od laganog minimuma. */
export function deloadLong10(lastLong10: number, adapted = false): number {
  return Math.max(adapted ? EASY_MIN10 : 0, Math.floor(P.deload.longFactor * lastLong10 + EPS));
}

/** `total10` na `n` jednakih delova u koraku 0,1 km; raniji dani dobijaju višak (razlika ≤ 0,1). */
export function splitEasy(total10: number, n: number): number[] {
  const each = Math.floor(total10 / n);
  return Array.from({ length: n }, (_, i) => each + (i < total10 - each * n ? 1 : 0));
}

/** `n` laganih dana: dugi do `cap10` (svaki lagan ≥ 4 km), lagani = ostatak (≥ 4 km, ≤ dugi). Ostatak u
    stotinkama km. */
function withEasy(rest100: number, cap10: number, n: number): Lengths | null {
  const long10 = Math.min(cap10, Math.floor((rest100 - n * EASY_MIN10 * 10) / 10));
  if (long10 < EASY_MIN10) return null;
  const easy10 = splitEasy(Math.round((rest100 - long10 * 10) / 10), n);
  if (easy10.some((e) => e < EASY_MIN10 || e > long10)) return null;
  return { long10, easy10 };
}

/** T1 (krug T): najkraći lagan nedelje izgradnje [0,1 km] — max(4 km, 20 min laganim tempom: srednji E, kao
    easyWorkout). Jedna funkcija za konstruktor (buildLengths) i validator (EASY_BUILD). */
export function buildEasyMin10(p: Paces): number {
  const mid = (p.E.fast + p.E.slow) / 2;
  let k = EASY_MIN10;
  while (Math.round((k / 10) * mid) < P.lengths.easyMinSec) k++;
  return k;
}

/** T1 (krug T): najduži lagan nedelje izgradnje uz dugi `long10` [0,1 km] — 0,8 × dugi (naniže). */
export const buildEasyCap10 = (long10: number, rule?: { easyLongMaxShare?: number }): number =>
  Math.floor((rule?.easyLongMaxShare ?? P.lengths.easyLongMaxShare) * long10 + EPS);

/** Nedelja izgradnje: kvalitet (zbir `quality100`) + dugi + `easyDays` laganih. T1 (krug T, JEDNO mesto): dugi
    kao i do sada (najduži dozvoljen, laganima ostaje ≥ najkraći lagan buildEasyMin10); svaki lagan ≤ 0,8 × dugi
    (buildEasyCap10). Kad najkraći lagan ne staje ispod 0,8 × dugi (mali obim), manje laganih dana: najkasniji
    lagani dani postaju odmor (`easy10` kraći od `easyDays`; week.easyDays, validator ROLES). Ostatak cilja koji ne
    staje u lagane u tim granicama ne produžava dugi: nedelja nije izvodljiva sa ovim ciljem (null) — pretraga
    cilja (volume.fit10) spušta nedelju na najbliži izvodljiv cilj (planirano < cilj po pravilu, upozorenje
    CAPACITY_LIMITED sa preporukom više dana). Konstruktor i validator. */
export function buildLengthsT1(
  target10: number,
  quality100: number,
  easyDays: number,
  rule: LongRule,
  p: Paces,
  roll10 = Infinity,
  /** Najmanje laganih dana (podrazumevano 1; `easyDays` = bez dana odmora, week.secondQualityEasy). */
  minEasy = 1
): Lengths | null {
  const min10 = buildEasyMin10(p);
  const rest100 = target10 * 10 - quality100;
  const cap10 = longCap10(target10, rule, p, roll10);
  for (let k = easyDays; k >= Math.max(1, minEasy); k--) {
    const long10 = Math.min(cap10, Math.floor((rest100 - k * min10 * 10) / 10));
    if (long10 < EASY_MIN10) continue;
    const easy10 = splitEasy(Math.round((rest100 - long10 * 10) / 10), k);
    const hi10 = buildEasyCap10(long10, rule);
    if (easy10.every((e) => e >= min10 && e <= hi10)) return { long10, easy10 };
  }
  if (easyDays === 0) {
    const long10 = Math.min(cap10, Math.floor(rest100 / 10));
    return long10 >= EASY_MIN10 ? { long10, easy10: [] } : null;
  }
  return null;
}

/** T1 izuzetak (otvoreno pitanje organizatoru): nedelja NA MINIMUMU obima (H15, A9 — cilj se ne spušta ispod njega)
    u kojoj granice T1 nisu izvodljive ni sa manje laganih dana (npr. 3 dana, 12 km: dugi ≤ 45 % = 5,4 km, lagan
    ≥ 4 km i ≤ 0,8 × dugi) → dužine kao pre T1 (lagan ≤ dugi, pouka 2), validator upozorava EASY_BUILD_MIN_WEEK. */
export const t1MinWeek = (target10: number, rule: LongRule): boolean =>
  rule.weekMinKm !== undefined && target10 <= Math.round(rule.weekMinKm * 10);

/** Nedelja izgradnje (JEDNO mesto): T1 (buildLengthsT1), a u nedelji na minimumu kad T1 nije izvodljiv izuzetak
    t1MinWeek. Konstruktor i validator. */
export function buildLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  rule: LongRule,
  p: Paces,
  roll10 = Infinity
): Lengths | null {
  return (
    buildLengthsT1(target10, quality100, easyDays, rule, p, roll10) ??
    (t1MinWeek(target10, rule)
      ? withEasy(target10 * 10 - quality100, longCap10(target10, rule, p, roll10), easyDays)
      : null)
  );
}

/** H7: taper — dugi ≤ 0,6 × najduži dugi plana (i H13). */
export function taperLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  longest10: number,
  rule: LongRule,
  p: Paces,
  roll10 = Infinity
): Lengths | null {
  const cap10 = Math.min(longCap10(target10, rule, p, roll10), taperLongCap10(longest10));
  return withEasy(target10 * 10 - quality100, cap10, easyDays);
}

/** HI14: rasterećenje sa danom od `quality100` [0,01 km] uz pun dugi (0,8 × poslednji, H13) ostavlja lagane
    ispod 4 km — jedini slučaj u kom kvalitet rasterećenja sme da otpadne (kad ni uz skraćen dugi ne staje).
    Jedna funkcija za konstruktor i validator. */
export function deloadEasyShort(
  target10: number,
  quality100: number,
  easyDays: number,
  lastLong10: number,
  rule: LongRule,
  p: Paces,
  roll10 = Infinity,
  adapted = false
): boolean {
  const long10 = Math.min(deloadLong10(lastLong10, adapted), longCap10(target10, rule, p, roll10));
  return target10 * 10 - quality100 - long10 * 10 < easyDays * EASY_MIN10 * 10;
}

/** H5: rasterećenje — dugi = 0,8 × poslednji ne-rasteretni dugi (i ≤ H13); ostatak na `easyDays` jednakih
    laganih dana (≥ 4 km, ≤ dugi). HI14 (i HI11 b za test): SAMO kad tako nije izvodljivo, dugi je najduži koji
    ostavlja lagane ≥ 4 km i ≤ dugi (skraćen, nikad duži od 0,8 ×; cilj nedelje ostaje). Pouka 32 (nedelja
    testa, `minLong10`): dugi naviše do `minLong10` (trajanje dana testa) u granicama udela, vremena, 24 km i
    pouke 28 (`longCap10`) i laganih ≥ 4 km — gde nije izvodljivo, najduži mogući (upozorenje validatora).
    Jedna funkcija za konstruktor i validator. */
export function deloadLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  lastLong10: number,
  rule: LongRule,
  p: Paces,
  roll10 = Infinity,
  minLong10 = 0,
  adapted = false
): Lengths | null {
  const cap10 = longCap10(target10, rule, p, roll10);
  const base10 = Math.min(deloadLong10(lastLong10, adapted), cap10);
  const long10 = Math.max(base10, Math.min(minLong10, cap10));
  const easy10 = splitEasy(Math.round((target10 * 10 - quality100 - long10 * 10) / 10), easyDays);
  if (long10 >= EASY_MIN10 && easy10.every((e) => e >= EASY_MIN10 && e <= long10))
    return { long10, easy10 };
  // Podignut dugi (pouka 32) skraćuje samo lagane: izvodljiva nedelja bez podizanja ostaje izvodljiva.
  return withEasy(target10 * 10 - quality100, long10, easyDays);
}

/** Pouka 32: najkraći dugi [0,1 km] čije trajanje (srednjim E, kao longWorkout) nije kraće od `sec`. */
export function longFor10(sec: number, p: Paces): number {
  const mid = (p.E.fast + p.E.slow) / 2;
  let k = Math.max(0, Math.floor((sec / mid) * 10) - 1);
  while (Math.round((k / 10) * mid) < sec) k++;
  return k;
}

/** Pouka 28 (pouka 24): dugi svake nedelje [0,1 km] (null bez dugog) — osnov kotrljajuće granice; jedna
    definicija za konstruktor (upisani dani, written.ts) i validator (dani plana). HM-09: `ran` (ključ = broj
    nedelje) = najduži trčan po činjenicama — dugi te nedelje je min(upisani, trčan), 0 kad nije trčano. */
export function longsOf10(
  weeks: readonly { index?: number; days: readonly { role: string; workout: { km: number } }[] }[],
  ran: Readonly<Record<string, number>> = {}
): (number | null)[] {
  return weeks.map((w, i) => {
    const l = w.days.find((d) => d.role === 'long');
    const r = ran[String(w.index ?? i + 1)];
    const l10 = l ? Math.round(l.workout.km * 10) : null;
    return r === undefined || l10 === null ? l10 : Math.min(l10, Math.round(r * 10));
  });
}

/** HM-09 (1b #5; pouka 37 i za L skoka) — JEDNA funkcija kotrljajuće granice dugog nedelje `index` sa činjenicama:
    `ran` = najduži trčan prošlih nedelja cele poznate (steps.ranLongFor). L iz trčanog važi od nedelje 5 (nedelje
    1–4 nose pretpostavljeni skorašnji najduži trk — ostaju kao pre); kad ništa nije trčano (L = 0), granica je
    kao pre; ne ispod `floor10` (ranCapFloor10). Nikad labavija od granice iz upisanih dugih. Konstruktor, validator i poruka kapaciteta. */
export function rollingCapRan10(
  index: number,
  weeks: readonly { index?: number; days: readonly { role: string; workout: { km: number } }[] }[],
  ran: Readonly<Record<string, number>>,
  recentKm: number | null | undefined,
  floor10 = 0
): number {
  const plan = rollingLongCap10(index, longsOf10(weeks), recentKm);
  const w = P.recentLong.windowWeeks;
  if (index <= w || Object.keys(ran).length === 0) return plan;
  const L = Math.max(
    0,
    ...longsOf10(weeks, ran)
      .slice(Math.max(0, index - 1 - w), index - 1)
      .filter((x): x is number => x !== null)
  );
  return L > 0 ? Math.min(plan, Math.max(stepCap10(L), floor10)) : plan;
}

/** HM-09: najmanji dugi nedelje minimuma [0,1 km] — dugi ≥ lagan (pouka 2) i ≥ 4 km: granica iz trčanog ne pada
    ispod njega (nedelja minimuma A9 ostaje izvodljiva). */
export const ranCapFloor10 = (weekMinKm: number, runDays: number): number =>
  Math.max(EASY_MIN10, Math.ceil((weekMinKm * 10) / runDays - EPS));

/** H7 / pouka 29: najduži dugi plana — jedna definicija za konstruktor (iz upisanih dana, written.ts) i
    validator (dani nedelja pre tapera). */
export function longestLong10(
  weeks: readonly { days: readonly { role: string; workout: { km: number } }[] }[]
): number {
  let m = 0;
  for (const w of weeks)
    for (const d of w.days) if (d.role === 'long') m = Math.max(m, Math.round(d.workout.km * 10));
  return m;
}

/** H13/H17 (LONG_RUN_SHORT) i faza 3 (O1, okidač „kraća distanca"): najduži dugi plana ispod praga upozorenja
    `longWarnKm` — jedna definicija za validator i okidač. */
export function longRunShort(
  weeks: readonly { days: readonly { role: string; workout: { km: number } }[] }[],
  longWarnKm: number
): boolean {
  return longestLong10(weeks) < Math.round(longWarnKm * 10);
}

/** A4 (H18): dugi na danu bola ≤ 60 min sporim E [0,1 km]. */
export function painLong10(long10: number, p: Paces): number {
  return Math.min(long10, longTimeCap10(p, P.adapt.painLongMaxSec));
}

/** A4 (H18): lagan na danu bola × 0,7 naniže na 0,1 km, ne ispod 4 km; svaki lagan ≤ dugi nedelje (H13;
    `long10` = dugi posle ograničenja, null ako dugog nema). */
export function limitedEasy10(easy10: number, inPain: boolean, long10: number | null): number {
  const k = inPain
    ? Math.max(EASY_MIN10, Math.floor(easy10 * P.adapt.painEasyFactor + EPS))
    : easy10;
  return long10 === null ? k : Math.min(k, long10);
}

/* ---------- Pouka 37: mešovita nedelja (deo dana zaštićen) — ostatak do cilja, samo naniže ---------- */

/** Pouka 37: vrsta preostalog (nezaštićenog) dana — lagan (skraćuje se do 4 km), kvalitet (sme da otpadne u lagan)
    ili nepromenljiv dan (dugi i test: dugi se ne skraćuje radi ostatka — odluka HM-08, opcija A). */
export type FreeKind = 'easy' | 'quality' | 'fixed';

/**
 * Pouka 37 — JEDNA funkcija minimuma preostalih dana mešovite nedelje [0,01 km]: lagan i kvalitet (otpada u lagan)
 * po 4 km, dugi i test svojom dužinom. Kad zaštićeni dani + ovaj minimum > cilj, nedelja je planirano > cilj uz
 * upozorenje (MIXED_WEEK_OVER); konstruktor (week.remainderWeek) i validator čitaju istu funkciju.
 */
export function mixedFloor100(free: readonly { kind: FreeKind; km100: number }[]): number {
  return free.reduce((a, d) => a + (d.kind === 'fixed' ? d.km100 : EASY_MIN10 * 10), 0);
}

/**
 * Pouka 37: lagani preostali dani na ostatak `rest100` [0,01 km] — jednaki delovi (raniji dan dobija višak), svaki
 * ≤ sastavljen (`caps10`, samo naniže) i ≥ 4 km; zbir ≤ `rest100`. null = ne staje.
 */
export function remainderEasy10(rest100: number, caps10: readonly number[]): number[] | null {
  if (caps10.length === 0) return rest100 >= 0 ? [] : null;
  const easy10 = splitEasy(Math.floor(rest100 / 10), caps10.length).map((e, i) =>
    Math.min(e, caps10[i]!)
  );
  return easy10.every((e) => e >= EASY_MIN10) ? easy10 : null;
}

/** K4-A2: talas dugog — nedelje (1-indeks) čiji je dugi ≤ `cap10` (0,85 × plafon) i plafon [0,1 km]. */
export interface LongWave {
  cap10: number;
  weeks: ReadonlySet<number>;
}

/** K4-A2: napomena nedelje talasa (validator je čita kao oznaku). */
export const WAVE_NOTE =
  'Talas dugog: dugi ove nedelje je kraći (≈ 85 % najdužeg), pa je nedelja nešto manja od cilja — najduži dugi se čuva za poslednje nedelje pred taper.';

/** K4-A2: granica dugog nedelje talasa — ⌊0,85 × plafon⌋ [0,1 km]. JEDNA funkcija (konstruktor, validator). */
export const waveCap10 = (ceiling10: number): number =>
  Math.floor(P.specific.wave.share * ceiling10 + EPS);

/**
 * K4-A2 (JEDNO mesto odluke): talas dugog redovnog plana 3 dana iz dugih plana bez talasa. Plafon = najduži dugi plana;
 * kad dugi stoji na plafonu u više od 3 ne-rasteretne nedelje izgradnje zaredom, plafon se troši OD KRAJA unazad:
 * nedelja po rasporedu B ostaje na plafonu, ostale se smenjuju (plafon, 0,85 ×, …), plafon najviše 3 puta; ostale
 * nedelje plafona dobijaju 0,85 × plafon. null = bez talasa.
 */
export function longWave(
  weeks: readonly {
    index: number;
    phase: string;
    deload: boolean;
    long10: number | null;
    b: boolean;
  }[],
  rule: { readonly quality: number; readonly beginner: boolean }
): LongWave | null {
  const q = P.specific.wave;
  if (rule.beginner || rule.quality !== 1) return null;
  const nd = weeks.filter(
    (w) => !w.deload && (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific')
  );
  const c10 = Math.max(0, ...weeks.map((w) => w.long10 ?? 0));
  let run = 0;
  let maxRun = 0;
  for (const w of nd) {
    run = w.long10 === c10 ? run + 1 : 0;
    maxRun = Math.max(maxRun, run);
  }
  if (c10 === 0 || maxRun <= q.run) return null;
  const at = nd.filter((w) => w.long10 === c10).reverse();
  const wave = new Set<number>();
  let keeps = 0;
  let lastKept = false;
  for (const w of at) {
    if (w.b || (!lastKept && keeps < q.maxAtCap)) {
      keeps++;
      lastKept = true;
    } else {
      wave.add(w.index);
      lastKept = false;
    }
  }
  return wave.size > 0 ? { cap10: waveCap10(c10), weeks: wave } : null;
}

/** K4-B: napomena nedelje sa danom „po želji" (validator je čita kao oznaku). */
export const OPT_NOTE = 'Kratak lagan dan';

/**
 * K4-B (JEDNO mesto odluke): nedelja izgradnje plana sa kratkim laganim danima — najkraći lagan (< 30 min, `easySec`)
 * je „odmor ili 20 min lagano po želji": izlazi iz obaveznog obima, njegovi km prelaze u ostale lagane do granice
 * (≤ udeo × dugi, buildEasyCap10), ostatak je planirano < cilj. `opt` = indeks tog dana u `len.easy10` (među jednakima
 * kasniji); null = nijedan lagan nije kraći od 30 min.
 */
export function optEasy(
  len: Lengths,
  rule: { easyLongMaxShare?: number },
  easySec: (easy10: number) => number,
  /** Najveći dozvoljen manjak nedelje [0,1 km] (cilj − minimum nedelje, H15): nedelja ne pada ispod minimuma. */
  maxShort10 = Infinity
): { len: Lengths; opt: number } | null {
  const e = len.easy10;
  if (e.length === 0) return null;
  const secs = e.map(easySec);
  const min = Math.min(...secs);
  if (min >= P.lengths.optEasySec) return null;
  const opt = secs.lastIndexOf(min);
  const rest = e.filter((_, i) => i !== opt);
  if (rest.length === 0)
    return e[opt]! > maxShort10 ? null : { len: { long10: len.long10, easy10: [] }, opt };
  const total = Math.min(
    rest.reduce((a, x) => a + x, 0) + e[opt]!,
    rest.length * buildEasyCap10(len.long10, rule)
  );
  if (rest.reduce((a, x) => a + x, 0) + e[opt]! - total > maxShort10) return null;
  return { len: { long10: len.long10, easy10: splitEasy(total, rest.length) }, opt };
}

/** K4-B: plan ima kratke lagane dane — najkraći lagan < 30 min u više od 2 ne-rasteretne nedelje izgradnje. */
export function shortEasyPlan(
  weeks: readonly {
    phase: string;
    deload: boolean;
    days: readonly { role: string; workout: { km: number; sec: number } }[];
  }[]
): boolean {
  const n = weeks.filter(
    (w) =>
      !w.deload &&
      (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific') &&
      w.days.some(
        (d) => d.role === 'easy' && d.workout.km > 0 && d.workout.sec < P.lengths.optEasySec
      )
  ).length;
  return n > P.lengths.optWeeks;
}

/** K4-A2: dužine nedelje talasa (jedno mesto) — kad dužine po pravilu nisu izvodljive sa kraćim dugim (`roll10` nosi
    granicu talasa), dugi = granica, svaki lagan = granica laganog (≤ udeo × dugi, ≥ najkraći); ostatak cilja je
    planirano < cilj (cilj nedelje ostaje po pravilu, doza i rast obima se ne menjaju). */
export function waveLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  rule: LongRule,
  p: Paces,
  roll10: number
): Lengths | null {
  const len = buildLengths(target10, quality100, easyDays, rule, p, roll10);
  if (len) return len;
  const long10 = longCap10(target10, rule, p, roll10);
  const hi10 = buildEasyCap10(long10, rule);
  if (easyDays === 0 || hi10 < buildEasyMin10(p)) return null;
  const rest10 = Math.floor((target10 * 10 - quality100) / 10) - long10;
  if (rest10 <= easyDays * hi10) return null;
  return { long10, easy10: Array.from({ length: easyDays }, () => hi10) };
}
