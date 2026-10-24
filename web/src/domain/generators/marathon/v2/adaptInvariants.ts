/* Segment 04 (M18): invarijante adaptiranih planova — sopstvena provera, NEZAVISNO od validatora (testovi adapt.node,
   earlyGrid, široka pretraga). Nije testni fajl, da bi ga izolacioni test video kao deo v2; uvozi samo dates.ts,
   policy.ts i types.ts (obrazac tenK/v2/adaptInvariants.ts). */

import { daysBetween, mustDay } from './dates.ts';
import { MARATHON_V2_POLICY as P, planRule } from './policy.ts';
import type { MarathonV2Facts, MarathonV2Plan, PlanDay, PlanWeek } from './types.ts';

const EPS = 1e-6;
const isBuild = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'development' || w.phase === 'specific';
const limitedQ = (w: PlanWeek): boolean =>
  w.limits?.quality !== undefined || w.notes.some((n) => n.includes('(A9)'));
const qualityOf = (w: PlanWeek): PlanDay[] => w.days.filter((d) => d.workout.kind === 'quality');
const longOf = (w: PlanWeek): PlanDay | undefined => w.days.find((d) => d.role === 'long');
const k10 = (km: number): number => Math.round(km * 10);

/**
 * Prekršaji invarijanti (prazno = sve važi): prošlost/urađeno/zaključano bajt-isto; km > 0 i segmenti; dugi ≥
 * lagan; planirano = cilj (uz dane bola/odmora ≤ cilj); nedelja ≥ minimum i cilj ≥ minimum (A9); nema kvaliteta,
 * testa ni ubrzanja u danima bola/odmora; teški dani nesusedni; nema redovnog rasterećenja odmah posle nedelje
 * smanjenja (prinudno sme; ostaje samo kad bi niz izgradnje bio > 5, pouka 22); niz izgradnje ≤ 5 (osim posle
 * prinudnog); doza ne raste u nedelji sa ograničenjem; trkačka ≤ poslednja nedelja tapera; taper N−1 ≤ N−2; taper ≤
 * poslednja izgradnja posle smanjenja; MP dan ≤ dugi u adaptiranim nedeljama izgradnje (pouka 32 za maraton;
 * izuzetak najniži nivo MP); dugi ≤ max(1,1 × L; L + 1) iz upisanih dugih (pouka 28); povratni rast ne preskače nivo pre
 * smanjenja (pouka 7); datum trke, taper i trkačka nedelja se ne pomeraju (A12).
 */
export function adaptInvariants(
  before: MarathonV2Plan,
  after: MarathonV2Plan,
  asOf: string,
  facts: MarathonV2Facts
): string[] {
  const bad: string[] = [];
  const t = mustDay(asOf);
  const ad = after.adaptation;
  if (!ad) return ['bez plan.adaptation'];
  const mixed = new Set(ad.mixedWeeks);
  const steps = ad.steps;
  const rule = planRule(after.input.runDays.length, after.input.experience ?? 'regular')!;
  const min = rule.weekMinKm;
  const first = Math.min(...steps.map((s) => s.firstWeek));
  const W = after.weeks;
  const n = W.length;
  // A11: zaštita.
  const done = new Set(
    (facts.workouts ?? []).filter((x) => x.completed).map((x) => x.dayId ?? x.date)
  );
  const locked = new Set(facts.lockedDayIds ?? []);
  const last = steps[steps.length - 1]!;
  /** Km dana po činjenicama (dani ≤ asOf): pauza 0, zapis(i) dana = upisani km (neodrađen 0), poznat iz potpune
      pokrivenosti bez zapisa 0, inače plan. */
  const factKm = (d: PlanDay): number => {
    if (mustDay(d.date) > t) return d.workout.km;
    if ((facts.breaks ?? []).some((b) => b.from <= d.date && d.date <= b.to)) return 0;
    const rec = (facts.workouts ?? []).filter((x) => (x.dayId ?? x.date) === d.date);
    if (rec.length > 0) return rec.reduce((a, x) => a + (x.completed ? x.km : 0), 0);
    const c = facts.coverage;
    return c && c.complete && c.from <= d.date && d.date <= c.to ? 0 : d.workout.km;
  };
  const afterDays = new Map(W.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
  for (const w of before.weeks)
    for (const d of w.days)
      if (mustDay(d.date) <= t || done.has(d.date) || locked.has(d.date))
        if (JSON.stringify(afterDays.get(d.date)) !== JSON.stringify(d))
          bad.push(`zaštita ${d.date}`);
  // A12.
  if (
    n !== before.weeks.length ||
    W.some(
      (w, i) =>
        w.startDate !== before.weeks[i]!.startDate ||
        (w.phase === 'taper' || w.phase === 'race') !==
          (before.weeks[i]!.phase === 'taper' || before.weeks[i]!.phase === 'race')
    ) ||
    W[n - 1]!.days.find((d) => d.role === 'race')?.date !== after.input.raceDate
  )
    bad.push('datum trke / taper / trkačka nedelja pomereni');
  // Teški dani nesusedni (ceo plan).
  const hard = W.flatMap((w) => w.days.filter((d) => d.hard)).map((d) => d.date);
  hard.sort();
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!, hard[i]!) < 2) bad.push(`teški susedni ${hard[i]}`);
  // Ograničenja po datumima (nema kvaliteta/testa/ubrzanja u bolu, ništa na dan odmora).
  const inR = (d: string, r: { from: string; to: string } | null): boolean =>
    r !== null && mustDay(d) >= mustDay(r.from) && mustDay(d) <= mustDay(r.to);
  for (const w of W)
    for (const d of w.days) {
      if (locked.has(d.date) || d.role === 'race' || mustDay(d.date) <= t) continue;
      const pain = steps.some((s) => inR(d.date, s.pain));
      const rest = steps.some((s) => inR(d.date, s.rest));
      const q = d.workout.kind === 'quality' || d.workout.kind === 'test';
      if (rest) bad.push(`trening na dan odmora ${d.date}`);
      if (pain && (q || d.workout.segments.some((x) => x.kind === 'stride')))
        bad.push(`kvalitet/ubrzanja u bolu ${d.date}`);
    }
  // A17 (pouka 22): nedelje smanjenja i prinudna rasterećenja.
  const reducedAt = new Set<number>();
  for (const s of steps) {
    if (s.restart) continue;
    if (s.reduced === true) reducedAt.add(s.fromWeek);
    if (s.returnFrom) reducedAt.add(s.returnFrom.week);
  }
  const forced = new Set(steps.filter((s) => s.deload).map((s) => s.deloadWeek ?? s.fromWeek));
  const restartAt = new Set(steps.filter((s) => s.restart).map((s) => s.fromWeek));
  const runFrom = (i: number): number => {
    let k = i;
    while (k <= n && isBuild(W[k - 1]!) && (k === i || !W[k - 1]!.deload)) k++;
    return k - i;
  };
  for (const r of reducedAt) {
    const nx = W[r];
    if (nx && nx.deload && isBuild(nx) && !forced.has(nx.index) && !mixed.has(nx.index))
      if (runFrom(nx.index) <= P.deload.exceptionRun + 1)
        bad.push(`rasterećenje odmah posle smanjenja ned ${nx.index}`);
  }
  // Niz izgradnje (od ukinutog rasterećenja broji se iznova, pouka 22).
  let runLen = 0;
  let free = false;
  for (const w of W) {
    if (restartAt.has(w.index)) [runLen, free] = [0, false];
    if (!isBuild(w)) break;
    if (!w.deload && reducedAt.has(w.index - 1)) runLen = 0;
    if (w.deload) [runLen, free] = [0, forced.has(w.index)];
    else if (++runLen > P.deload.exceptionRun + 1 && !free && w.index >= first)
      bad.push(`niz izgradnje ${runLen} ned ${w.index}`);
  }
  let lastBuild: PlanWeek | null = null;
  let maxDose: Record<string, number> = {};
  const recent = after.input.recentLongRunKm;
  const longs10: (number | null)[] = W.map((w) => {
    const l = longOf(w);
    return l ? k10(l.workout.km) : null;
  });
  for (const w of W) {
    if (restartAt.has(w.index)) maxDose = {};
    const m = mixed.has(w.index);
    const long = longOf(w);
    // Dugi ≥ lagan (mešovita: među danima posle asOf; zaključan i urađen dan se ne sude — A11b, MAR-08).
    for (const d of w.days)
      if (
        long &&
        d.role === 'easy' &&
        !locked.has(d.date) &&
        !locked.has(long.date) &&
        !done.has(d.date) &&
        !done.has(long.date) &&
        d.workout.km > long.workout.km + EPS &&
        (!m || (mustDay(d.date) > t && mustDay(long.date) > t))
      )
        bad.push(`dugi < lagan ned ${w.index}`);
    for (const d of w.days)
      if (d.workout.km <= 0 || d.workout.segments.length === 0)
        bad.push(`prazan trening ${d.date}`);
    // Pouka 28: dugi ≤ max(1,1 × L; L + 1,0), L = najduži dugi prethodne 4 nedelje (+ skorašnji za ned 1–4; pouka
    // 34: posle umora pre starta i dugi reference — nedelja 1 generatora, iz koraka).
    const l10 = longs10[w.index - 1];
    if (l10 !== null && l10 !== undefined && long && !locked.has(long.date)) {
      const prev = [
        ...(w.index <= 4 && recent != null ? [k10(recent)] : []),
        ...(w.index <= 4 ? steps.flatMap((x) => (x.preStart ? [k10(x.preStart.longKm)] : [])) : []),
        ...longs10.slice(Math.max(0, w.index - 5), w.index - 1)
      ].filter((x): x is number => x !== null);
      if (prev.length > 0) {
        const L = Math.max(...prev);
        if (l10 > Math.floor(Math.max(1.1 * L, L + 10) + EPS))
          bad.push(`skok dugog ned ${w.index}`);
      }
    }
    // Pouka 37: mešovita nedelja posle asOf (ne trkačka, ne nedelja ostatka pauze) — planirano (zaštićeni dani ≤ asOf
    // po činjenicama: pauza 0, zapis = upisani km, neodrađen 0) ≤ cilj, ili upozorenje MIXED_WEEK_OVER za nju.
    if (
      m &&
      w.phase !== 'race' &&
      mustDay(w.endDate) > t &&
      !(last.pauseRemainder && last.firstWeek < last.fromWeek && last.firstWeek === w.index) &&
      w.days.reduce((a, d) => a + (d.countsToWeek ? factKm(d) : 0), 0) >
        w.targetKm + P.tolerance.plannedKm + EPS &&
      !after.warnings.some((x) => x.rule === 'MIXED_WEEK_OVER' && x.week === w.index)
    )
      bad.push(`mešovita > cilj ned ${w.index}`);
    // MAR-08c (pouka 29): mešovita nedelja se ne sudi, ali njene upisane doze ulaze u „najveću dosadašnju dozu" (isto
    // kao writtenPicks u konstruktoru i { state } u validatoru) — inače se ograničena nedelja poredi sa starijom dozom.
    if (m && isBuild(w) && !w.deload)
      for (const d of qualityOf(w)) {
        const z = d.workout.dose!.zone;
        maxDose[z] = Math.max(maxDose[z] ?? 0, d.workout.dose!.doseM);
      }
    if (m) continue;
    // MAR-11 (T1): nedelja izgradnje čiji lagani (≤ 0,8 × dugi) ne nose cilj — planirano < cilj (napomena), kao
    // nedelja sa danima odmora.
    const limited =
      (w.limits?.pain?.length ?? 0) > 0 ||
      (w.limits?.rest?.length ?? 0) > 0 ||
      w.notes.some((n) => n.startsWith('Nedelja izgradnje: planirano je manje od cilja'));
    // Planirano = cilj (pouka 25: uz dane bola/odmora ≤ cilj).
    if (
      w.phase !== 'race' &&
      (limited
        ? w.plannedKm > w.targetKm + P.tolerance.plannedKm + EPS
        : Math.abs(w.plannedKm - w.targetKm) > P.tolerance.plannedKm + EPS)
    )
      bad.push(`planirano ≠ cilj ned ${w.index}`);
    // Uslov 8 i A9.
    if (w.phase !== 'race' && w.plannedKm + EPS < min && !limited)
      bad.push(`nedelja < minimum ned ${w.index}`);
    if (w.phase !== 'race' && w.index >= first && w.targetKm + EPS < min)
      bad.push(`cilj < minimum ned ${w.index}`);
    // Pouka 32 (maraton: drugi član plafona samo za MP, MAR-03): MP dan ≤ dugi u adaptiranoj nedelji izgradnje,
    // i u nedeljama bola/povratka (izuzetak najniži nivo MP 2 × 3000 m). Ostale zone: upozorenje (K6, izveštaj).
    if (isBuild(w) && w.index >= first && long)
      for (const d of qualityOf(w)) {
        const mp = d.workout.dose?.zone === 'MP';
        if (mp && d.workout.dose!.doseM > 2 * 3000 && d.workout.sec > long.workout.sec)
          bad.push(`MP dan duži od dugog ned ${w.index}`);
      }
    // Doza ne raste u nedelji sa ograničenjem (najviše 1 kvalitet, doza ≤ dosadašnje u zoni).
    if (isBuild(w) && !w.deload && limitedQ(w)) {
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
  // Pouka 7 (A8): povratni rast ne preskače nivo pre smanjenja; korak ≤ max(M6 rast, +10 % min 1 km).
  const levelAt = (i: number): number | null => {
    let lv: number | null = null;
    for (const s of steps)
      if (s.fromWeek <= i && s.levelKm !== null) lv = Math.max(lv ?? 0, k10(s.levelKm));
    return lv;
  };
  const growth = (a10: number): number =>
    Math.min(k10(rule.growthMaxKm), Math.max(k10(rule.growthMinKm), Math.round(a10 * rule.growth)));
  const back = (a10: number): number =>
    Math.max(k10(P.adapt.returnGrowthMinKm), Math.round(a10 * P.adapt.returnGrowth));
  const steady = W.filter((w) => isBuild(w) && !w.deload && !mixed.has(w.index));
  for (let i = 1; i < steady.length; i++) {
    const a = steady[i - 1]!;
    const b = steady[i]!;
    if (b.index < first || b.index !== a.index + 1 || restartAt.has(b.index)) continue;
    const a10 = k10(a.targetKm);
    const b10 = k10(b.targetKm);
    const lv = levelAt(b.index);
    // Rupa izvodljivosti (M6, pouka 1): nedelja sme naviše do granice izgradnje samo uz oznaku 'up' (van povratka).
    if (
      b10 > a10 + Math.max(growth(a10), back(a10)) &&
      !(b.fitted === 'up' && (lv === null || a10 >= lv))
    )
      bad.push(`skok cilja ned ${b.index}`);
    if (lv !== null && a10 < lv && b10 > Math.max(lv, a10 + growth(a10)))
      bad.push(`povratak preko nivoa ned ${b.index}`);
  }
  // Trkačka ≤ poslednja nedelja tapera; taper N−1 ≤ N−2; trkačka + trka ≥ minimum.
  const t2 = W[n - 3]!;
  const t1 = W[n - 2]!;
  const race = W[n - 1]!;
  if (!mixed.has(t1.index) && !mixed.has(race.index)) {
    if (race.plannedKm > t1.plannedKm + EPS) bad.push('trkačka > poslednja nedelja tapera');
    if (race.plannedKm + P.raceWeek.raceKm + EPS < min) bad.push('trkačka + trka < minimum');
  }
  if (!mixed.has(t1.index) && !mixed.has(t2.index) && t1.targetKm > t2.targetKm + EPS)
    bad.push('taper N−1 > N−2');
  // A8 (M18): taper posle smanjenja ≤ poslednja nedelja izgradnje.
  if (
    steps.some((s) => s.startKm !== null || s.returnFrom) &&
    lastBuild &&
    !mixed.has(t2.index) &&
    t2.targetKm > lastBuild.targetKm + EPS
  )
    bad.push('taper > poslednja izgradnja');
  return bad;
}
