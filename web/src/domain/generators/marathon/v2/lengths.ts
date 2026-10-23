/* M13 — dužine dugog i laganih trčanja (jedini vlasnik). Rad u desetinkama km (korak 0,1). Dugi uzima
   najveću dozvoljenu dužinu (≤ udeo cilja po broju dana, M15; ≤ 150 min sporim E; skok ≤ 10 % prema najdužem
   dugom prethodne 4 nedelje, M13a; svaki lagan ≥ 5 km); lagani dele ostatak na jednake delove (razlika ≤ 0,1 km). Dugi ≥ svaki
   lagan je tvrdo pravilo (pouka 2): kad ne može da se ispuni, nedelja nije izvodljiva (M6). */

import { type DayRule, MARATHON_V2_POLICY as P } from './policy.ts';
import type { Paces, PlanDay } from './types.ts';
import { fmtKm } from './workouts.ts';
import { midEasy } from './paces.ts';

const EPS = 1e-9;
const EASY_MIN10 = Math.round(P.lengths.easyMinKm * 10);

export interface Lengths {
  long10: number;
  /** Lagani dani redom (raniji dan prvi). */
  easy10: number[];
  /** M13a: dugi je na plafonu skoka (plafon skoka niži od ostalih plafona nedelje). */
  jumpBound: boolean;
  /** Rasterećenje (M16/M17 ispred M5, odstupanje): dugi kraći od 0,8 × poslednjeg da lagani ostanu ≥ 5 km. */
  shortened?: true;
  /** Rasterećenje posle smanjenja (A9, odstupanje): 0,8 × poslednji < 5 km → dugi 5 km (dugi ≥ lagan ≥ 5 km). */
  raised?: true;
  /** MAR-11 (T1): lagani na 0,8 × dugi ne nose ostatak — planirano < cilj (poslednje rešenje, generate.ts). */
  under?: true;
}

/** M13: plafon dugog od 150 min sporim E [0,1 km]. */
export function longTimeCap10(p: Paces): number {
  return Math.floor((P.lengths.longMaxSec / p.E.slow) * 10 + EPS);
}

/** M13/M15: plafon dugog kao udeo cilja nedelje [0,1 km]. */
export function longShareCap10(target10: number, rule: DayRule): number {
  return Math.floor(rule.longMaxShare * target10 + EPS);
}

/** M13a: najduži dugi `L` [0,1 km] u prethodne 4 nedelje plana pre nedelje `week` (1-indeks); `longs10[i]` =
    dugi nedelje i + 1 (null bez dugog — trkačka nedelja). Skorašnji najduži trk iz ulaza je dugi „nedelje 0"
    (ulazi u L za nedelje 1–4). null = nema prethodnog dugog. */
export function jumpBase10(
  longs10: readonly (number | null)[],
  week: number,
  recentLongRunKm: number | null | undefined
): number | null {
  const n = P.longJump.windowWeeks;
  const r10 =
    recentLongRunKm === null || recentLongRunKm === undefined
      ? null
      : Math.round(recentLongRunKm * 10);
  const all = [r10, ...longs10];
  const prev = all.slice(Math.max(0, week - n), week).filter((x): x is number => x !== null);
  return prev.length > 0 ? Math.max(...prev) : null;
}

/** M13a (pouka 28, izmena organizatora): plafon dugog nedelje = max(1,1 × L; L + 1,0 km) [0,1 km, naniže],
    L = jumpBase10; null kad L ne postoji (nedelja 1 bez ulaza). JEDINA funkcija za konstruktor i validator
    (pouka 24). */
export function longJumpCap10(
  longs10: readonly (number | null)[],
  week: number,
  recentLongRunKm: number | null | undefined
): number | null {
  const L = jumpBase10(longs10, week, recentLongRunKm);
  if (L === null) return null;
  const q = P.longJump;
  return Math.floor(Math.max(q.factor * L, L + q.addKm * 10) + EPS);
}

/** M13a: najkraći skorašnji najduži trk [0,1 km, naviše] čiji plafon ne seče dugi `long10` — X/1,1 (za X < 11 km
    X − 1). */
export function recentLongThreshold10(long10: number): number {
  const q = P.longJump;
  return Math.ceil(Math.min(long10 / q.factor, long10 - q.addKm * 10) - EPS);
}

/** M13 (N11): najduži dugi plana [km] kad je ispod praga MARATHON_LONG_SHORT (`rule.longShortKm`; početnik M17) i
    da li ga ograničava trajanje (najduži dugi = plafon 150 min sporim E tempa SVOJE nedelje `pacesOf(index)` — isti
    tempo kojim ga je konstruktor gradio, MAR-09 t. 4); null kad prag nije problem. JEDNA odluka za konstruktor
    (napomena plana kad je trajanje — namerna granica M13) i validator (upozorenje samo kad trajanje NIJE uzrok: tada
    je savet „više dana/obima" stvaran). */
export function longShortOf(
  weeks: readonly { index: number; days: readonly PlanDay[] }[],
  longShortKm: number,
  pacesOf: (week: number) => Paces
): { longestKm: number; timeCapped: boolean } | null {
  const longs = weeks.flatMap((w) =>
    w.days.filter((d) => d.role === 'long').map((d) => ({ d, w: w.index }))
  );
  const longestKm = Math.max(0, ...longs.map((x) => x.d.workout.km));
  if (longestKm + 1e-6 >= longShortKm) return null;
  const timeCapped = longs.some(
    (x) =>
      x.d.workout.km === longestKm &&
      Math.round(x.d.workout.km * 10) === longTimeCap10(pacesOf(x.w))
  );
  return { longestKm, timeCapped };
}

/** N11: rečenica u opisu plana (plan.notes) kad najduži dugi ograničava trajanje (M13: ≤ 150 min) — ne upozorenje. */
export function longTimeCapNote(longestKm: number, longShortKm: number, beginner: boolean): string {
  return `Najduže dugo trčanje je ${fmtKm(longestKm)} km: ograničava ga trajanje (≤ ${P.lengths.longMaxSec / 60} min laganim tempom, ${beginner ? 'M17' : 'M13'}) — namerna granica opterećenja umesto preporučenih ${fmtKm(longShortKm)} km; ostatak obima nose ostali dani${beginner ? ', cilj je završiti maraton' : ''}.`;
}

/** M13a: napomena nedelje čiji je dugi na plafonu skoka (`L` = jumpBase10). */
export function longJumpNote(long10: number, L10: number): string {
  return `Dugi ${fmtKm(long10 / 10)} km = plafon skoka max(1,1 × L; L + 1,0 km), L = ${fmtKm(L10 / 10)} km (najduže dugo trčanje prethodne 4 nedelje ili skorašnje najduže trčanje) (M13a).`;
}

/** M13a: napomena nedelje 1 bez ulaza `recentLongRunKm`. */
export function recentLongNote(long10: number): string {
  return `Dugi ${fmtKm(long10 / 10)} km: ako ti je skorašnje najduže trčanje kraće od ${fmtKm(recentLongThreshold10(long10) / 10)} km, unesi ga — plan počinje od njega (M13a).`;
}

/** M13: najduži dozvoljen dugi [0,1 km] za cilj nedelje. */
export function longCap10(target10: number, rule: DayRule, p: Paces): number {
  return Math.min(longShareCap10(target10, rule), longTimeCap10(p));
}

/** `total10` na `n` jednakih delova u koraku 0,1 km; raniji dani dobijaju višak (razlika ≤ 0,1). */
export function splitEasy(total10: number, n: number): number[] {
  const each = Math.floor(total10 / n);
  return Array.from({ length: n }, (_, i) => each + (i < total10 - each * n ? 1 : 0));
}

/** Minimum nedelje M15 [0,1 km] — JEDNA definicija (pouka 24; volume.ts je izvozi za obim i validator). */
export function weekMin10(rule: DayRule): number {
  return Math.round(rule.weekMinKm * 10);
}

/** MAR-08b (K4, pouka 23): zbir laganih [0,1 km] iz ostatka nedelje [0,01 km] — zaokružen; kad je cilj na minimumu
    nedelje (M15), naviše, da planirano ne padne ispod minimuma koji validator proverava (WEEK_MIN_VOLUME, 19,98 < 20).
    JEDINO zaokruživanje laganih (buildLengths, deloadLengths, taperLengths). */
export function easyTotal10(rest100: number, target10: number, rule: DayRule): number {
  return target10 <= weekMin10(rule) ? Math.ceil(rest100 / 10 - EPS) : Math.round(rest100 / 10);
}

/** `n` laganih dana: dugi do min(`cap10`, `jump10`) (svaki lagan ≥ 5 km), lagani = ostatak (≥ 5 km, ≤ dugi).
    Ostatak u stotinkama km; `target10` i `rule` za zaokruživanje laganih (easyTotal10). */
function withEasy(
  rest100: number,
  cap10: number,
  n: number,
  jump10: number | null,
  target10: number,
  rule: DayRule,
  t1: Paces | null = null,
  under = false,
  relax = false
): Lengths | null {
  const min10 = t1 ? easyFloor10(t1) : EASY_MIN10;
  const top = Math.min(cap10, jump10 ?? Infinity);
  const long10 = Math.min(top, Math.floor((rest100 - n * min10 * 10) / 10));
  if (long10 < min10) return null;
  let easy10 = splitEasy(easyTotal10(rest100 - long10 * 10, target10, rule), n);
  const max10 = t1 ? easyCap10(long10, min10, relax) : long10;
  const jumpBound = jump10 !== null && jump10 < cap10 && long10 === jump10;
  if (easy10.some((e) => e < min10)) return null;
  if (easy10.some((e) => e > max10)) {
    // MAR-11 (T1): poslednje rešenje (generate.ts) — lagani na 0,8 × dugi, planirano < cilj.
    if (!under || max10 < min10) return null;
    easy10 = easy10.map((e) => Math.min(e, max10));
    return { long10, easy10, jumpBound, under: true };
  }
  return { long10, easy10, jumpBound };
}

/** MAR-11 (T1): u nedelji izgradnje svaki lagan ≤ 0,8 × dugi iste nedelje [0,1 km, naniže]. Kad je 0,8 × dugi kraći
    od najkraćeg laganog (`floor10`; dugi < 6,25 km, npr. plafon skoka posle pauze) granice su nespojive — tada (`relax`;
    konstruktor tek kao poslednji pokušaj, generate.ts) važi lagan ≤ dugi (pouka 2) kao pre T1 (otvoreno pitanje
    organizatoru, izveštaj MAR-11). JEDNA funkcija za konstruktor (withEasy) i validator (EASY_LONG_SHARE). */
export function easyCap10(long10: number, floor10: number, relax = true): number {
  const cap = Math.floor(P.lengths.easyLongShare * long10 + EPS);
  return cap >= floor10 || !relax ? cap : long10;
}

/** MAR-11 (T1): najkraći lagan nedelje izgradnje [0,1 km] = max(5 km, 20 min laganim tempom — tempo laganog dana,
    workouts.easyWorkout), naviše. */
export function easyFloor10(p: Paces): number {
  return Math.max(EASY_MIN10, Math.ceil((P.lengths.easyMinSec / midEasy(p)) * 10 - EPS));
}

/** Nedelja izgradnje: kvalitet (zbir `quality100`) + dugi + `easyDays` laganih; `jump10` = plafon skoka M13a
    (null kad ga nema). MAR-11 (T1): lagani u granicama easyFloor10…easyCap10; ostatak cilja koji tu ne staje čini
    nedelju neizvodljivom — pretraga cilja (M6, vlasnik obima) uzima najbliži izvodljiv cilj naniže (planirano <
    cilj po pravilu, CAPACITY_LIMITED sa preporukom); dugi se zbog toga ne produžava. */
export function buildLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  rule: DayRule,
  p: Paces,
  jump10: number | null = null,
  under = false,
  relax = false
): Lengths | null {
  return withEasy(
    target10 * 10 - quality100,
    longCap10(target10, rule, p),
    easyDays,
    jump10,
    target10,
    rule,
    p,
    under,
    relax
  );
}

/** M7: najduži dugi plana [0,1 km] — JEDNA definicija (pouke 24 i 29) za konstruktor i validator: dani uloge 'long'
    nedelja `weeks` kakve se upisuju (adaptacija: zaštićeni dani iz prethodnog plana, written.ts); 0 bez dugog. */
export function longestLong10(weeks: readonly { days: readonly PlanDay[] }[]): number {
  let m = 0;
  for (const w of weeks)
    for (const d of w.days) if (d.role === 'long') m = Math.max(m, Math.round(d.workout.km * 10));
  return m;
}

/** M13a (pouka 29): dugi svake nedelje [0,1 km] iz upisanih dana (null bez dugog — trkačka nedelja ili dugi na
    dan odmora). Ulaz za jumpBase10/longJumpCap10 u konstruktoru i validatoru. */
export function longsOf(weeks: readonly { days: readonly PlanDay[] }[]): (number | null)[] {
  return weeks.map((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? Math.round(l.workout.km * 10) : null;
  });
}

/** M13a (MAR-09 t. 2, pouka 37 za L): dugi prethodnih nedelja za plafon skoka nedelje `forWeek` — upisani dugi
    (longsOf), a za celu prošlu nedelju poznatu iz činjenica (korak `ranLongs`: potpuna pokrivenost ili pauza) najviše
    najduži odrađen trk te nedelje; nedelja bez trka ≥ najkraćeg laganog (5 km) nije L (null). Činjenice samo
    spuštaju L i važe samo za nedelju koja se gradi posle asOf koraka (≥ firstWeek). Nedelje 1–4 (L sa skorašnjim
    najdužim trkom, „nedelja 0") bez promene; kad u prozoru 4 nedelje ne ostane nijedan L, L ostaje iz upisanih
    (plafon se ne ukida). JEDINA funkcija za konstruktor (generate.ts), validator (LONG_JUMP, rasterećenje) i
    kapacitet (volume.ts). */
export function jumpLongs10(
  weeks: readonly { days: readonly PlanDay[] }[],
  steps: readonly { firstWeek: number; ranLongs?: Readonly<Record<string, number>> }[],
  forWeek: number
): (number | null)[] {
  const longs = longsOf(weeks);
  const n = P.longJump.windowWeeks;
  if (forWeek <= n) return longs;
  const ran = new Map<number, number>();
  for (const s of steps)
    if (s.firstWeek <= forWeek)
      for (const [k, v] of Object.entries(s.ranLongs ?? {})) ran.set(Number(k), v);
  const fact = longs.map((l, i) => {
    const r = ran.get(i + 1);
    if (l === null || r === undefined) return l;
    const r10 = Math.floor(r * 10 + EPS);
    return r10 >= EASY_MIN10 ? Math.min(l, r10) : null;
  });
  const win = (xs: readonly (number | null)[]): boolean =>
    xs.slice(Math.max(0, forWeek - 1 - n), forWeek - 1).some((x) => x !== null);
  return win(fact) || !win(longs) ? fact : longs;
}

/** A4 (M18): dugi na danu bola ≤ 60 min sporim E (korak 0,1 km). */
export function painLong10(long10: number, p: Paces): number {
  return Math.min(long10, Math.floor((P.adapt.painLongMaxSec / p.E.slow) * 10 + EPS));
}

/** A4 (M18): lagan na danu bola × 0,7 naniže na 0,1 km, ne ispod 5 km i nikad duži od planiranog (trkačka
    nedelja: lagan kraći od 5 km, M8, ostaje); svaki lagan ≤ dugi nedelje (pouka 2; `long10` = dugi posle
    ograničenja, null ako dugog nema). */
export function limitedEasy10(easy10: number, inPain: boolean, long10: number | null): number {
  const k = inPain
    ? Math.min(easy10, Math.max(EASY_MIN10, Math.floor(easy10 * P.adapt.painEasyFactor + EPS)))
    : easy10;
  return long10 === null ? k : Math.min(k, long10);
}

/** M7: nedelja tapera `step` (0 = N−2, 1 = N−1) — dugi ≤ udeo × najduži dugi plana (0,65 / 0,45) i ≤ M13.
    `adapted` (A9, odstupanje kao rasterećenje): dugi ne ispod 5 km (dugi ≥ lagan ≥ 5 km) kad je najduži dugi
    posle smanjenja kratak. */
export function taperLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  longest10: number,
  step: number,
  rule: DayRule,
  p: Paces,
  jump10: number | null = null,
  adapted = false
): Lengths | null {
  const rule10 = taperRule10(target10, longest10, step, rule, p);
  const cap10 = adaptedLongCap10(rule10, adapted);
  const len = withEasy(target10 * 10 - quality100, cap10, easyDays, jump10, target10, rule);
  return len && len.long10 > rule10 ? { ...len, raised: true } : len;
}

/** M7: plafon dugog nedelje tapera `step` iz najdužeg dugog plana [0,1 km] = udeo × najduži (0,65 / 0,45),
    naniže. JEDNA definicija (pouka 24) za konstruktor (taperLengths, taperTop10) i validator (TAPER_LONG). */
export function taperLongFactor10(longest10: number, step: number): number {
  return Math.floor(P.taper.weeks[step]!.longFactor * longest10 + EPS);
}

/** A9 (odstupanje posle smanjenja obima, `adapted`): plafon dugog rasterećenja/tapera ne ispod 5 km (dugi ≥ lagan ≥
    5 km). JEDNA definicija za konstruktor (deloadLengths, deloadTop10, taperLengths, taperTop10) i validator. */
export function adaptedLongCap10(cap10: number, adapted: boolean): number {
  return adapted ? Math.max(EASY_MIN10, cap10) : cap10;
}

/** M7: dugi tapera po pravilu [0,1 km] — ≤ udeo × najduži dugi plana i ≤ M13. */
function taperRule10(
  target10: number,
  longest10: number,
  step: number,
  rule: DayRule,
  p: Paces
): number {
  return Math.min(longCap10(target10, rule, p), taperLongFactor10(longest10, step));
}

/** Pouka 32: najduži dozvoljen dugi nedelje tapera [0,1 km] (taperLengths bez laganih) — poređenje drugog člana
    plafona zone kad nedelja sa tim danom nema izvodljive dužine. */
export function taperTop10(
  target10: number,
  longest10: number,
  step: number,
  rule: DayRule,
  p: Paces,
  jump10: number | null,
  adapted: boolean
): number {
  const rule10 = taperRule10(target10, longest10, step, rule, p);
  return Math.min(adaptedLongCap10(rule10, adapted), jump10 ?? Infinity);
}

/** Pouka 32: najduži dozvoljen dugi nedelje rasterećenja [0,1 km] (deloadLengths bez laganih). */
export function deloadTop10(
  target10: number,
  lastLong10: number,
  rule: DayRule,
  p: Paces,
  jump10: number | null,
  adapted: boolean
): number {
  const rule10 = Math.min(
    Math.floor(P.deload.longFactor * lastLong10 + EPS),
    longCap10(target10, rule, p)
  );
  return Math.min(adaptedLongCap10(rule10, adapted), jump10 ?? Infinity);
}

/** M5: rasterećenje — dugi = 0,8 × poslednji ne-rasteretni dugi (i ≤ M13); ostatak na `easyDays` jednakih
    laganih dana. `shorten` (nedelja testa M16, početnik M17 i — pouka 33, A9 — adaptirana nedelja posle smanjenja
    obima): kad lagani ne bi bili ≥ 5 km, dugi se skraćuje (odstupanje). `adapted` (A9): dugi ne ispod 5 km. */
export function deloadLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  lastLong10: number,
  rule: DayRule,
  p: Paces,
  jump10: number | null = null,
  shorten = false,
  adapted = false
): Lengths | null {
  const rule10 = Math.min(
    Math.floor(P.deload.longFactor * lastLong10 + EPS),
    longCap10(target10, rule, p)
  );
  // A9 (odstupanje, kao 10K: adaptirana nedelja posle smanjenja): dugi ne ispod 5 km (dugi ≥ lagan ≥ 5 km).
  const cap10 = adaptedLongCap10(rule10, adapted);
  const long10 = Math.min(cap10, jump10 ?? Infinity);
  const raised = long10 > rule10 ? { raised: true as const } : {};
  const easy10 = splitEasy(
    easyTotal10(target10 * 10 - quality100 - long10 * 10, target10, rule),
    easyDays
  );
  if (easy10.every((e) => e >= EASY_MIN10 && e <= long10))
    return { long10, easy10, jumpBound: jump10 !== null && jump10 < cap10, ...raised };
  // Odstupanje (M16 test u rasterećenju; M17 mali obim početnika): lagani ispod 5 km → dugi se skraćuje na
  // najduži koji ostavlja lagane ≥ 5 km (i dugi ≥ lagan); cilj i kvalitet ostaju.
  if (!shorten) return null;
  const short = withEasy(target10 * 10 - quality100, long10, easyDays, null, target10, rule);
  return short && short.long10 < long10 ? { ...short, jumpBound: false, shortened: true } : null;
}
