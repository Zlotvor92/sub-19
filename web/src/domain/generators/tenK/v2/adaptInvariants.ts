/* Segment 04: invarijante adaptiranih planova — sopstvena provera, NEZAVISNO od validatora (testovi
   adapt.node.test.ts). Nije testni fajl, da bi ga izolacioni test video kao deo v2; uvozi samo dates.ts,
   policy.ts i types.ts. */

import { daysBetween, mustDay } from './dates.ts';
import { dayRule, TEN_K_V2_POLICY as P } from './policy.ts';
import type { PlanDay, PlanWeek, TenKV2Facts, TenKV2Plan } from './types.ts';
import { t1Short } from './gridInvariants.ts';
import { deloadWeekOf } from './steps.ts';
import { raceWeekEveOnly, restDaysWeek } from './week.ts';

const EPS = 1e-6;
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'development' || w.phase === 'specific';
const reduced = (w: PlanWeek): boolean =>
  w.limits?.quality !== undefined || w.notes.some((n) => n.includes('(A9)'));
const qualityOf = (w: PlanWeek): PlanDay[] => w.days.filter((d) => d.workout.kind === 'quality');

/**
 * Prekršaji invarijanti (prazno = sve važi): zaštita prošlosti/urađenog/zaključanog (bajt-isto); planirano
 * = cilj (osim mešovitih; uz dane bola/odmora planirano ≤ cilj); dugi ≥ lagan; teški dani nesusedni;
 * trkačka ≤ taper; D30b (trkačka + trka ≥ minimum); rasterećenje po D5 (izgradnja, ne prva nedelja faze ni
 * pred taperom osim prinudnog, A5); doza ne raste u nedelji sa ograničenjem; cilj ≥ minimum nedelje (A9);
 * Uslov 8; datum trke, taper i trkačka nedelja se ne pomeraju (A12); taper posle smanjenja ≤ poslednja
 * nedelja izgradnje (A8).
 */
export function adaptInvariants(
  before: TenKV2Plan,
  after: TenKV2Plan,
  asOf: string,
  facts: TenKV2Facts
): string[] {
  const bad: string[] = [];
  const t = mustDay(asOf);
  const ad = after.adaptation;
  if (!ad) return ['bez plan.adaptation'];
  const mixed = new Set(ad.mixedWeeks);
  const steps = ad.steps;
  const min = dayRule(after.input.runDays.length)!.weekMinKm;
  const first = Math.min(...steps.map((s) => s.firstWeek));
  // A11: zaštita.
  const done = new Set(
    (facts.workouts ?? []).filter((x) => x.completed).map((x) => x.dayId ?? x.date)
  );
  const locked = new Set(facts.lockedDayIds ?? []);
  const afterDays = new Map(after.weeks.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
  for (const w of before.weeks)
    for (const d of w.days)
      if (mustDay(d.date) <= t || done.has(d.date) || locked.has(d.date))
        if (JSON.stringify(afterDays.get(d.date)) !== JSON.stringify(d))
          bad.push(`zaštita ${d.date}`);
  // A12.
  const n = after.weeks.length;
  if (
    n !== before.weeks.length ||
    after.weeks.some(
      (w, i) =>
        w.startDate !== before.weeks[i]!.startDate ||
        (w.phase === 'taper' || w.phase === 'race') !==
          (before.weeks[i]!.phase === 'taper' || before.weeks[i]!.phase === 'race')
    ) ||
    after.weeks[n - 1]!.days.find((d) => d.role === 'race')?.date !== after.input.raceDate
  )
    bad.push('datum trke / taper / trkačka nedelja pomereni');
  // Teški dani nesusedni (ceo plan).
  const hard = after.weeks.flatMap((w) => w.days.filter((d) => d.hard)).map((d) => d.date);
  hard.sort();
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!, hard[i]!) < 2) bad.push(`teški susedni ${hard[i]}`);
  const taper = after.weeks.find((w) => w.phase === 'taper')!;
  const race = after.weeks[n - 1]!;
  let lastBuild: PlanWeek | null = null;
  let maxDose: Record<string, number> = {};
  for (const w of after.weeks) {
    if (steps.some((s) => s.restart && s.fromWeek === w.index)) maxDose = {};
    const m = mixed.has(w.index);
    const long = w.days.find((d) => d.role === 'long');
    // Dugi ≥ lagan (mešovita: samo među preostalim danima — zaštićeni ≤ asOf, urađeni i zaključani su činjenice, pouka
    // 37; organizator K5: zaključan lagan sledeće nedelje).
    const free = (d: PlanDay): boolean =>
      mustDay(d.date) > t && !done.has(d.date) && !locked.has(d.date);
    for (const d of w.days)
      if (
        long &&
        d.role === 'easy' &&
        d.workout.km > long.workout.km + EPS &&
        (!m || (free(d) && free(long)))
      )
        bad.push(`dugi < lagan ned ${w.index}`);
    for (const d of w.days)
      if (d.workout.km <= 0 || d.workout.segments.length === 0)
        bad.push(`prazan trening ${d.date}`);
    if (m) continue;
    const limited = (w.limits?.pain?.length ?? 0) > 0 || (w.limits?.rest?.length ?? 0) > 0;
    // Planirano = cilj.
    if (
      w.phase !== 'race' &&
      (limited
        ? w.plannedKm > w.targetKm + P.tolerance.plannedKm + EPS
        : Math.abs(w.plannedKm - w.targetKm) > P.tolerance.plannedKm + EPS) &&
      !t1Short(w, after)
    )
      bad.push(`planirano ≠ cilj ned ${w.index}`);
    // Uslov 8 i A9.
    // Pouka 25 (kao validator WEEK_MIN_REST): nedelja sa danima odmora ili bola sme planirano ispod minimuma (10K-08:
    // uz T1 — lagan dan odmor — to se javlja i u nedelji bola bez dana odmora).
    if (
      w.phase !== 'race' &&
      w.plannedKm + EPS < min &&
      !restDaysWeek(w) &&
      !(w.limits?.pain?.length ?? 0)
    )
      bad.push(`nedelja < minimum ned ${w.index}`);
    if (w.phase !== 'race' && w.index >= first && w.targetKm + EPS < min)
      bad.push(`cilj < minimum ned ${w.index}`);
    // D5 (A5: prinudno rasterećenje sme bilo gde u izgradnji).
    if (w.deload) {
      const forced = steps.some((s) => s.deload && deloadWeekOf(s) === w.index);
      const prev = after.weeks[w.index - 2];
      const next = after.weeks[w.index];
      if (!isBuild(w)) bad.push(`rasterećenje van izgradnje ned ${w.index}`);
      else if (
        !forced &&
        (w.index < P.deload.firstAllowedWeek ||
          !prev ||
          prev.phase !== w.phase ||
          !next ||
          !isBuild(next))
      )
        bad.push(`rasterećenje D5 ned ${w.index}`);
    }
    // Doza ne raste u nedelji sa ograničenjem (najviše 1 kvalitet, doza ≤ dosadašnje u zoni).
    if (isBuild(w) && !w.deload && reduced(w)) {
      const qs = qualityOf(w);
      if (qs.length > 1) bad.push(`ograničenje: ${qs.length} kvaliteta ned ${w.index}`);
      for (const d of qs) {
        const z = d.workout.dose!.zone;
        if (maxDose[z] !== undefined && d.workout.dose!.doseM > maxDose[z])
          bad.push(`ograničenje: doza raste ned ${w.index}`);
      }
    } else if (isBuild(w) && !w.deload)
      for (const d of qualityOf(w)) {
        const z = d.workout.dose!.zone;
        maxDose[z] = Math.max(maxDose[z] ?? 0, d.workout.dose!.doseM);
      }
    if (isBuild(w) && !w.deload) lastBuild = w;
  }
  // Trkačka ≤ taper; D30b.
  if (!mixed.has(taper.index) && !mixed.has(race.index)) {
    // 06g (pouka 30): izuzetak — ostali su samo dan pred trku i trka (svi ostali dani odmor), uz upozorenje.
    const eveOnly =
      raceWeekEveOnly(race.days) &&
      after.warnings.some((w) => w.rule === 'RACE_WEEK_OVER_TAPER_EVE' && w.week === race.index);
    if (race.plannedKm > taper.plannedKm + EPS && !eveOnly) bad.push('trkačka > taper');
    // Izuzetak D30b (10k-v2.5.1, uzak): trkačka nedelja skraćena po D23 (dani pretvoreni u odmor — manje dana
    // trčanja od D20 bez dana odmora koraka — uz napomenu D23) i plan nosi upozorenje RACE_WEEK_SHORT.
    const runs = race.days.filter((d) => d.role !== 'race').length;
    const d20 =
      Math.min(after.input.runDays.length, P.raceWeek.maxRunDays) -
      1 -
      (race.limits?.rest ?? []).length;
    const d23Rest =
      runs < d20 &&
      race.notes.includes('Trkačka nedelja skraćena: taper je imao dane odmora/bola (D23).') &&
      after.warnings.some((w) => w.rule === 'RACE_WEEK_SHORT' && w.week === race.index);
    // Pouka 25 (organizator, rani prolaz K2): dani odmora koraka (bol) — isti predikat kao validator (WEEK_MIN_REST).
    const painRest =
      restDaysWeek(race) &&
      after.warnings.some((w) => w.rule === 'WEEK_MIN_REST' && w.week === race.index);
    if (race.plannedKm + P.raceWeek.raceKm + EPS < min && !d23Rest && !painRest)
      bad.push('trkačka + trka < minimum');
  }
  // A5 (10k-v2.5.2, pouka 34): umor pre starta — nedelja 1 rasterećenje ≤ 0,8 × planirana nedelja 1 (ne ispod
  // minimuma), najviše 1 kvalitet (uvod početnika: bez kvaliteta); nedelja 2 bez rasta (≤ planirana nedelja 1).
  // Referenca: nedelja 1 prethodnog plana kad je on plan generatora (bez adaptacije).
  const g1 = before.weeks[0]!;
  if (steps.some((s) => s.deload && deloadWeekOf(s) === 1) && !before.adaptation) {
    const [w1, w2] = after.weeks;
    if (!w1!.deload) bad.push('umor pre starta: ned 1 nije rasterećenje');
    else if (!mixed.has(1)) {
      const want = Math.max(min, Math.round(P.deload.factor * g1.targetKm * 10) / 10);
      if (w1!.targetKm > want + EPS) bad.push('umor pre starta: ned 1 > 0,8 × planirana ned 1');
      const intro = after.input.experience === 'beginner';
      if (qualityOf(w1!).length > (intro ? 0 : 1))
        bad.push('umor pre starta: kvalitet ned 1 (uvod bez kvaliteta, inače najviše 1)');
    }
    if (w2 && isBuild(w2) && !w2.deload && !mixed.has(2) && w2.targetKm > g1.targetKm + EPS)
      bad.push('umor pre starta: ned 2 raste preko planirane ned 1');
  }
  // A8: taper posle smanjenja ≤ poslednja nedelja izgradnje.
  if (
    steps.some((s) => s.startKm !== null || s.returnFrom) &&
    lastBuild &&
    !mixed.has(taper.index) &&
    taper.targetKm > lastBuild.targetKm + EPS
  )
    bad.push('taper > poslednja izgradnja');
  return bad;
}
