/* Ugao 4 (jedan vlasnik), maraton v2 — iscrpno poređenje DRUGIH definicija u validatoru (inline formule) sa
   funkcijom vlasnika, nad celim dozvoljenim domenom (bez slučajnosti; deterministički). SAMO ČITANJE.
   Iz web/: node ../docs/generators-v2/audit/owner/mar-formulas.ts
   Svaka stavka: broj poređenja, broj razilaženja, prvi primer, i (gde postoji) razilaženje van dozvoljenog domena. */

import { longShareCap10, longTimeCap10, painLong10, weekMin10 } from "../../../../web/src/domain/generators/marathon/v2/lengths.ts";
import { MARATHON_V2_POLICY as P, planRule } from "../../../../web/src/domain/generators/marathon/v2/policy.ts";
import { buildLadder, capM, ladderFor, startLevel } from "../../../../web/src/domain/generators/marathon/v2/quality.ts";
import { testWeekOf, phasesOf } from "../../../../web/src/domain/generators/marathon/v2/periodize.ts";
import { raceEasyWorkout, raceWeekRuns } from "../../../../web/src/domain/generators/marathon/v2/week.ts";
import { patternOf } from "../../../../web/src/domain/generators/marathon/v2/schedule.ts";
import { pacesFromVdot, feelPaces, midEasy } from "../../../../web/src/domain/generators/marathon/v2/paces.ts";
import { doseOf, ladderLevels, structuresForDose, zoneOf } from "../../../../web/src/domain/generators/marathon/v2/workouts.ts";
import { addDays, weekdayOf } from "../../../../web/src/domain/generators/marathon/v2/dates.ts";
import type { LadderId, Paces, Phase, Weekday } from "../../../../web/src/domain/generators/marathon/v2/types.ts";

const out: Record<string, unknown> = {};
const rec = (k: string, n: number, bad: number, ex: unknown, extra: Record<string, unknown> = {}) =>
  (out[k] = { compared: n, diverge: bad, example: ex ?? null, ...extra });

const RULES = [
  ...[3, 4, 5, 6].map((d) => ({ tag: `regular/${d}`, r: planRule(d, "regular")! })),
  ...[4, 5].map((d) => ({ tag: `beginner/${d}`, r: planRule(d, "beginner")! })),
];

/* Paleta tempa: rezultat VDOT 30,0–80,0 (korak 0,1) × obim {20, 45, 65, 110}; po osećaju 270–510 s/km (korak 1). */
const PACES: { tag: string; p: Paces }[] = [];
for (let v = 300; v <= 800; v++) for (const km of [20, 45, 65, 110]) PACES.push({ tag: `v${v / 10}/km${km}`, p: pacesFromVdot(v / 10, km) });
for (let s = 270; s <= 510; s++) PACES.push({ tag: `feel${s}`, p: feelPaces(s, 45).paces });

/* (a) LONG_SHARE: validate.ts:650 `Math.floor(rule.longMaxShare * to10(w.targetKm) + 1e-9)` vs lengths.longShareCap10. */
{
  let n = 0, bad = 0, ex: unknown = null;
  for (const { tag, r } of RULES)
    for (let t10 = 50; t10 <= 1500; t10++) {
      n++;
      const v = Math.floor(r.longMaxShare * t10 + 1e-9);
      if (v !== longShareCap10(t10, r)) { bad++; ex ??= { tag, t10, v, owner: longShareCap10(t10, r) }; }
    }
  rec("LONG_SHARE inline vs longShareCap10", n, bad, ex);
}

/* (b) LONG_DURATION: validate.ts:656-657 `km * E.slow > longMaxSec + 1e-6` vs lengths.longTimeCap10 (konstruktor).
   Isto: plafon konstruktora prolazi validator (A) i prvi korak iznad plafona validator obara (B). Bol: painLong10 vs
   min(longMaxSec, painLongMaxSec) (validate.ts:644-646). */
{
  let n = 0, a = 0, b = 0, pa = 0, pb = 0, ex: unknown = null;
  for (const { tag, p } of PACES) {
    n++;
    const cap = longTimeCap10(p);
    if ((cap / 10) * p.E.slow > P.lengths.longMaxSec + 1e-6) { a++; ex ??= { tag, cap, why: "A" }; }
    if (!(((cap + 1) / 10) * p.E.slow > P.lengths.longMaxSec + 1e-6)) { b++; ex ??= { tag, cap, why: "B" }; }
    const pc = painLong10(10_000, p);
    const lim = Math.min(P.lengths.longMaxSec, P.adapt.painLongMaxSec);
    if ((pc / 10) * p.E.slow > lim + 1e-6) { pa++; ex ??= { tag, pc, why: "painA" }; }
    if (!(((pc + 1) / 10) * p.E.slow > lim + 1e-6)) { pb++; ex ??= { tag, pc, why: "painB" }; }
  }
  rec("LONG_DURATION inline vs longTimeCap10/painLong10", n, a + b + pa + pb, ex, { capFailsValidator: a, validatorLooser: b, painA: pa, painB: pb });
}

/* (c) Početnik PHASE_QUALITY: validate.ts:784-801 (`first = doseOf(P.ladders[phaseLadder][0])`, plafon iz politike,
   napomena „T kontinuirano (M17)" kad !fits) vs konstruktor quality.buildLadder (week.ts:790: napomena kad lestvica ≠
   ladderFor). Dozvoljen domen cilja: ≥ weekMin10 (fit10 donja granica; A9 TARGET_FLOOR). Meri i ceo opseg 10–60 km. */
{
  let n = 0, bad = 0, badIn = 0, ex: unknown = null, minBad = Infinity;
  for (const { tag, r } of RULES.filter((x) => x.r.beginner))
    for (const phase of ["base", "development", "specific"] as Phase[])
      for (let t10 = 100; t10 <= 600; t10++) {
        const tk = t10 / 10;
        const phaseLadder: LadderId = phase === "base" ? "T_continuous" : phase === "development" ? "T_cruise" : "MP";
        const first = doseOf(P.ladders[phaseLadder][0]!);
        const zone = phaseLadder === "MP" ? "MP" : "T";
        const fits = first <= Math.floor(P.caps[zone] * tk * 1000 + 1e-6);
        const vLadder = fits ? phaseLadder : "T_continuous";
        const vNote = !fits; // validator traži napomenu
        const cLadder = buildLadder(phase, tk, r);
        const cNote = cLadder !== null && cLadder !== ladderFor(phase, "q1", r.quality);
        // Poredi samo kad konstruktor ima Q1 (null = bez kvaliteta, validator ga ne sudi ovde — noQ1/ROLES).
        if (cLadder === null) continue;
        n++;
        if (vLadder !== cLadder || vNote !== cNote) {
          bad++;
          if (t10 >= weekMin10(r)) badIn++;
          minBad = Math.min(minBad, t10);
          ex ??= { tag, phase, targetKm: tk, validator: { ladder: vLadder, note: vNote }, constructor: { ladder: cLadder, note: cNote } };
        }
      }
  const maxBad = (() => {
    let m = -Infinity;
    for (const { r } of RULES.filter((x) => x.r.beginner))
      for (let t10 = 100; t10 <= 600; t10++) {
        const tk = t10 / 10;
        const fits = 2000 <= Math.floor(P.caps.T * tk * 1000 + 1e-6);
        const c = buildLadder("base", tk, r);
        if (c !== null && !fits) m = Math.max(m, t10);
      }
    return m;
  })();
  rec("Početnik PHASE_QUALITY (validator) vs buildLadder", n, bad, ex, {
    divergeInAllowedDomain: badIn,
    divergeTargetRange10: [minBad, maxBad],
    beginnerWeekMin10: RULES.filter((x) => x.r.beginner).map((x) => [x.tag, weekMin10(x.r)]),
  });
}

/* (d) START_LEVEL: validate.ts:1134-1139 startM vs quality.startLevel (bez drugog člana; on je u oba isti slotOk/ok). */
{
  let n = 0, bad = 0, ex: unknown = null;
  const LAD: LadderId[] = ["R", "I", "T_continuous", "T_cruise", "MP"];
  for (const { tag, r } of RULES)
    for (const ladder of LAD)
      for (let t10 = weekMin10(r); t10 <= r.peakMaxKm * 10; t10++) {
        const tk = t10 / 10;
        const s = startLevel(ladder, tk, r.beginner);
        if (s === null) continue; // konstruktor: slot ne staje (nedelja neizvodljiva) — validator tada nema dozu
        n++;
        const cap = capM(zoneOf(ladder), tk);
        const lv = ladderLevels(ladder, r.beginner).map(doseOf);
        const vM = r.beginner ? lv[0]! : (lv.filter((m) => m <= P.startLevel.capShare * cap + 1e-6).pop() ?? lv[0]!);
        if (vM !== doseOf(s)) { bad++; ex ??= { tag, ladder, tk, validator: vM, owner: doseOf(s) }; }
      }
  rec("START_LEVEL startM vs quality.startLevel", n, bad, ex);
}

/* (e) Nedelja testa: validate.ts:1571 `phases.lastIndexOf('base') + 1` vs periodize.testWeekOf. */
{
  let n = 0, bad = 0;
  for (let N = 12; N <= 24; N++) {
    n++;
    const ph = phasesOf(N);
    if (ph.lastIndexOf("base") + 1 !== testWeekOf(ph)) bad++;
  }
  rec("testWeek inline vs testWeekOf", n, bad, null);
}

/* (f) Trkačka nedelja — dani: validate.ts:1698-1713 (sopstveni redosled otpadanja) vs week.raceWeekRuns. Svi
   podskupovi 3–6 dana od 7, svaki dozvoljen dan dugog, početak nedelje svaki dan u nedelji (trka = poslednji dan). */
{
  const WD: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  let n = 0, bad = 0, ex: unknown = null;
  for (let mask = 0; mask < 128; mask++) {
    const days = WD.filter((_, i) => mask & (1 << i));
    if (days.length < 3 || days.length > 6) continue;
    for (const long of days) {
      const pat = patternOf(days, long);
      if (!pat) continue;
      for (let s0 = 0; s0 < 7; s0++) {
        const startDate = addDays("2027-03-01", s0);
        const endDate = addDays(startDate, 6);
        const race = endDate;
        if (!days.includes(weekdayOf(race)) && false) continue;
        const frame = { index: 20, startDate, endDate, phase: "race" as const, deload: false };
        n++;
        const own = raceWeekRuns(days, pat, frame, race);
        // Validator (kopija validate.ts:1698-1713, bez dana odmora koraka).
        const inWeek = (wd: string): string => Array.from({ length: 7 }, (_, i) => addDays(startDate, i)).find((d) => weekdayOf(d) === wd)!;
        const runs = days.map(inWeek).filter((d) => d !== race).sort();
        const keep = Math.min(days.length, P.raceWeek.maxRunDays) - 1;
        const dropOrder = [inWeek(pat.long), ...pat.easy.map(inWeek).sort()].filter((d) => runs.includes(d));
        const dropped = dropOrder.slice(0, Math.max(0, runs.length - keep));
        const v = runs.filter((d) => !dropped.includes(d));
        if (JSON.stringify(v) !== JSON.stringify(own)) { bad++; ex ??= { days, long, startDate, validator: v, owner: own }; }
      }
    }
  }
  rec("Trkačka nedelja dani: validator vs raceWeekRuns", n, bad, ex);
}

/* (g) Trkačka nedelja — lagan: validate.ts:1805-1806 min(round(1800·100/mid), lagan N−1·10) vs week.raceEasyWorkout. */
{
  let n = 0, bad = 0, ex: unknown = null;
  for (const { tag, p } of PACES)
    for (let t10 = 30; t10 <= 200; t10++) {
      n++;
      const v = Math.min(Math.round((P.raceWeek.otherEasySec * 100) / midEasy(p)), t10 * 10);
      const o = Math.round(raceEasyWorkout(t10, p).km * 100);
      if (v !== o) { bad++; ex ??= { tag, t10, validator: v, owner: o }; }
    }
  rec("Trkačka lagan: validator vs raceEasyWorkout", n, bad, ex);
}

/* (h) noQ1: validate.ts:424-428 (uvod ili početnik kad T 1,5 km ne staje) vs konstruktor (uvod ili buildLadder null). */
{
  let n = 0, bad = 0, ex: unknown = null;
  for (const { tag, r } of RULES)
    for (const phase of ["base", "development", "specific"] as Phase[])
      for (let t10 = weekMin10(r); t10 <= r.peakMaxKm * 10; t10++) {
        n++;
        const tk = t10 / 10;
        const v = r.beginner && Math.round(P.beginner.tFirstKm * 1000) > capM("T", tk);
        const c = buildLadder(phase, tk, r) === null;
        if (v !== c) { bad++; ex ??= { tag, phase, tk, validator: v, constructor: c }; }
      }
  rec("noQ1 (validator) vs buildLadder null (izvan uvoda)", n, bad, ex);
}

/* (i) SLOT_TYPES / SLOT_TYPES_ONE (validate.ts:148-166, kopija tabele) vs ladderFor + qualityType struktura lestvice
   (workouts.qualityWorkout: T kontinuirano → T_continuous, deonice → T_cruise; inače zona). */
{
  const T = ["T_continuous", "T_cruise"];
  const SLOT: Record<string, { q1: string[]; q2: string[] }> = {
    base: { q1: ["R"], q2: T }, development: { q1: ["I"], q2: T }, specific: { q1: ["MP"], q2: T },
  };
  const ONE: Record<string, { q1: string[] }> = {
    base: { q1: T }, development: { q1: T }, specific: { q1: ["MP"] },
  };
  const qt = (ladder: LadderId, s: { form: string }): string =>
    zoneOf(ladder) === "T" ? (s.form === "continuous" ? "T_continuous" : "T_cruise") : zoneOf(ladder);
  let n = 0, bad = 0, ex: unknown = null;
  for (const phase of ["base", "development", "specific"] as Phase[])
    for (const [quality, slots] of [[2, ["q1", "q2"]], [1, ["q1"]]] as const)
      for (const slot of slots) {
        const lad = ladderFor(phase, slot, quality);
        for (const lv of ladderLevels(lad, true))
          for (const s of structuresForDose(lad, doseOf(lv))) {
            n++;
            const allowed = quality === 2 ? SLOT[phase]![slot as "q1" | "q2"] : ONE[phase]!.q1;
            if (!allowed.includes(qt(lad, s))) { bad++; ex ??= { phase, quality, slot, lad, s }; }
          }
      }
  rec("SLOT_TYPES vs ladderFor (+druga struktura)", n, bad, ex);
}

/* (j) Donja granica cilja adaptacije: assess.ts:404-406 (pauza: min(max(weekMin, raw), tn); manjak A2 assess.ts:471-477) i volume.ts:393-394
   (adaptNominal10: max(floor, t)) — dva mesta iste granice. Da li je ishod isti i bez assess granice? (tn ≥ weekMin:
   ciljevi nedelja su ≥ weekMin, fit10 lo.) Domen: weekMin 15/20/25/30, raw 0–130 korak 0,1, tn weekMin–120 korak 0,1. */
{
  let n = 0, bad = 0, ex: unknown = null;
  for (const wm of [15, 20, 25, 30])
    for (let raw10 = 0; raw10 <= 1300; raw10 += 1)
      for (let tn10 = wm * 10; tn10 <= 1200; tn10 += 7) {
        n++;
        const raw = raw10 / 10, tn = tn10 / 10;
        const withAssess = Math.max(wm * 10, Math.round(Math.min(Math.max(wm, raw), tn) * 10));
        const volumeOnly = Math.max(wm * 10, Math.round(Math.min(raw, tn) * 10));
        if (withAssess !== volumeOnly) { bad++; ex ??= { wm, raw, tn, withAssess, volumeOnly }; }
      }
  rec("Donja granica: assess (pauza) + volume vs samo volume", n, bad, ex);
}

console.log(JSON.stringify(out, null, 1));
