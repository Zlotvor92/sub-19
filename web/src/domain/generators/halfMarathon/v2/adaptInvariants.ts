/* Segment 04 (H18): invarijante adaptiranih planova — sopstvena provera, NEZAVISNO od validatora (testovi
   adapt.node.test.ts, adaptGrid). Nije testni fajl, da bi ga izolacioni test video kao deo v2; uvozi samo
   dates.ts, policy.ts i types.ts (obrazac 10K v2). */

import { daysBetween, mustDay } from './dates.ts';
import { checkInput } from './input.ts';
import { HM_V2_POLICY as P, planRule } from './policy.ts';
import { baseFrames, pacesAt } from './steps.ts';
import type { PlanDay, PlanWeek, HmV2Facts, HmV2Plan } from './types.ts';

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
  before: HmV2Plan,
  after: HmV2Plan,
  asOf: string,
  facts: HmV2Facts
): string[] {
  const bad: string[] = [];
  const t = mustDay(asOf);
  const ad = after.adaptation;
  if (!ad) return ['bez plan.adaptation'];
  const mixed = new Set(ad.mixedWeeks);
  const steps = ad.steps;
  const beg = after.input.experience === 'beginner';
  const min = planRule(after.input.runDays.length, beg ? 'beginner' : 'regular')!.weekMinKm;
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
  // Pouka 37: planirano mešovite nedelje sa zaštićenim danima po činjenicama (pauza 0, upisani km).
  const factKm = ad.factKm ?? {};
  const factPlanned = (w: PlanWeek): number =>
    w.days.reduce(
      (a, d) => a + (!d.countsToWeek ? 0 : d.date in factKm ? factKm[d.date]! : d.workout.km),
      0
    );
  for (const w of after.weeks) {
    if (steps.some((s) => s.restart && s.fromWeek === w.index)) maxDose = {};
    const m = mixed.has(w.index);
    const long = w.days.find((d) => d.role === 'long');
    // Dugi ≥ lagan (mešovita: među preostalim danima — posle asOf, nisu urađeni ni zaključani; pouka 37: zaštićeni
    // dani su činjenice).
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
    // Pouka 37: mešovita nedelja sa danima posle asOf — planirano ≤ cilj ili upozorenje sa razlogom.
    if (
      m &&
      w.phase !== 'race' &&
      w.days.some((d) => mustDay(d.date) > t && !locked.has(d.date) && !done.has(d.date)) &&
      factPlanned(w) > w.targetKm + P.tolerance.plannedKm + EPS &&
      !after.warnings.some((v) => v.rule === 'MIXED_WEEK_OVER' && v.week === w.index)
    )
      bad.push(`mešovita nedelja planirano > cilj bez upozorenja ned ${w.index}`);
    if (m) continue;
    const limited = (w.limits?.pain?.length ?? 0) > 0 || (w.limits?.rest?.length ?? 0) > 0;
    // Planirano = cilj.
    if (
      w.phase !== 'race' &&
      (limited
        ? w.plannedKm > w.targetKm + P.tolerance.plannedKm + EPS
        : Math.abs(w.plannedKm - w.targetKm) > P.tolerance.plannedKm + EPS)
    )
      bad.push(`planirano ≠ cilj ned ${w.index}`);
    // Uslov 8 i A9 (u koraku 0,1 km, kao validator). Krug T (T1 — lagani u nedelji bola veći, × 0,7 ih skraćuje):
    // nedelja sa danima bola ili odmora sme ispod minimuma (pouka 25, upozorenje WEEK_MIN_LIMITS validatora).
    if (w.phase !== 'race' && Math.round(w.plannedKm * 10) < Math.round(min * 10) && !limited)
      bad.push(`nedelja < minimum ned ${w.index}`);
    if (w.phase !== 'race' && w.index >= first && w.targetKm + EPS < min)
      bad.push(`cilj < minimum ned ${w.index}`);
    // D5 (A5: prinudno rasterećenje sme bilo gde u izgradnji).
    if (w.deload) {
      const forced = steps.some((s) => s.deload && (s.deloadWeek ?? s.fromWeek) === w.index);
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
    if (race.plannedKm > taper.plannedKm + EPS) bad.push('trkačka > taper');
    // Izuzetak (pouka 30, uzak): trkačka nedelja skraćena (dani pretvoreni u odmor — manje dana trčanja od H8
    // bez dana odmora koraka — uz napomenu) i plan nosi upozorenje RACE_WEEK_SHORT.
    const runs = race.days.filter((d) => d.role !== 'race').length;
    const d20 =
      Math.min(after.input.runDays.length, P.raceWeek.maxRunDays) -
      1 -
      (race.limits?.rest ?? []).length;
    const d23Rest =
      runs < d20 &&
      race.notes.includes('Trkačka nedelja skraćena: taper je imao dane odmora/bola (pouka 30).') &&
      after.warnings.some((w) => w.rule === 'RACE_WEEK_SHORT' && w.week === race.index);
    // K2 (HM-08b, kao 10K K2 i pouka 25): trkačka nedelja sa danima odmora koraka (bol, A4) sme ispod minimuma uz
    // upozorenje RACE_WEEK_SHORT — kao obična nedelja sa danima odmora („nedelja < minimum" ih izuzima).
    const a4Rest =
      (race.limits?.rest ?? []).length > 0 &&
      after.warnings.some((w) => w.rule === 'RACE_WEEK_SHORT' && w.week === race.index);
    if (race.plannedKm + P.raceWeek.raceKm + EPS < min && !d23Rest && !a4Rest)
      bad.push('trkačka + trka < minimum');
  }
  // A8: taper posle smanjenja ≤ poslednja nedelja izgradnje.
  if (
    steps.some((s) => s.startKm !== null || s.returnFrom) &&
    lastBuild &&
    !mixed.has(taper.index) &&
    taper.targetKm > lastBuild.targetKm + EPS
  )
    bad.push('taper > poslednja izgradnja');
  // HM-09 (C9/Z6): zaštićeni = zaključani i urađeni (činjenice).
  extra(before, after, steps, mixed, t, new Set([...locked, ...done]), bad);
  return bad;
}

/** Datumi opsega [from, to]. */
const daysOf = (r: { from: string; to: string } | null): string[] => {
  if (!r) return [];
  const out: string[] = [];
  for (let k = mustDay(r.from); k <= mustDay(r.to); k++) out.push(String(k));
  return out;
};

/**
 * HM-04 (H18): nema kvaliteta/testa/ubrzanja u danima bola i odmora (i treninga na danu odmora); nema
 * redovnog rasterećenja odmah posle nedelje smanjenja (pouka 22; prinudno sme; ostaje kad bi niz izgradnje od
 * njega bio > 5); niz izgradnje ≤ 5 (posle prinudnog i novog starta bez granice); kvalitetni dan iznad
 * najnižeg nivoa zone ≤ dugi (pouka 32; džog zadat metrima sporim E); dugi ≤ kotrljajuće pravilo pouke 28
 * (iz dana plana); povratni rast ≤ nivo pre smanjenja (A8: iznad poslednje izgradnje samo do nivoa ili
 * redovnim rastom H6).
 */
function extra(
  before: HmV2Plan,
  p: HmV2Plan,
  steps: NonNullable<HmV2Plan['adaptation']>['steps'],
  mixed: ReadonlySet<number>,
  t: number,
  locked: ReadonlySet<string>,
  bad: string[]
): void {
  const pain = new Set(steps.flatMap((s) => daysOf(s.pain)));
  const rest = new Set(steps.flatMap((s) => daysOf(s.rest)));
  const banned = new Set(steps.flatMap((s) => s.noQuality.flatMap(daysOf)));
  for (const w of p.weeks)
    for (const d of w.days) {
      if (mustDay(d.date) <= t || locked.has(d.date) || d.role === 'race') continue;
      const k = String(mustDay(d.date));
      if (rest.has(k)) bad.push(`trening na dan odmora ${d.date}`);
      const hard = d.workout.kind === 'quality' || d.workout.kind === 'test';
      if (hard && (pain.has(k) || rest.has(k) || banned.has(k)))
        bad.push(`kvalitet u zabrani ${d.date}`);
      if (pain.has(k) && d.workout.segments.some((x) => x.kind === 'stride'))
        bad.push(`ubrzanja u bolu ${d.date}`);
    }
  // Pouka 22: nedelje smanjenja (cilj koraka smanjenje; sidro bola); nov start ne ulazi.
  const reducedW = new Set(
    steps.flatMap((s) =>
      s.restart
        ? []
        : [
            ...(s.reduced === true ? [s.fromWeek] : []),
            ...(s.returnFrom ? [s.returnFrom.week] : [])
          ]
    )
  );
  const forced = new Set(steps.filter((s) => s.deload).map((s) => s.deloadWeek ?? s.fromWeek));
  const W = p.weeks;
  for (const w of W) {
    if (!w.deload || !isBuild(w) || forced.has(w.index) || !reducedW.has(w.index - 1)) continue;
    if (mixed.has(w.index)) continue;
    let k = w.index;
    while (k < W.length && isBuild(W[k]!) && !W[k]!.deload) k++;
    if (k - w.index + 1 <= P.deload.exceptionRun + 1)
      bad.push(`rasterećenje posle smanjenja ned ${w.index}`);
  }
  // Niz izgradnje ≤ 5 (H5 izuzetak 4 + ukinuto rasterećenje), osim posle prinudnog i novog starta.
  const restarts = new Set(steps.filter((s) => s.restart).map((s) => s.fromWeek));
  const chk = checkInput(p.input);
  /** Spor E nedelje (tempo nedelje iz koraka, A1: rezultat važi od sledeće nedelje). */
  const slowOf = (i: number): number => (chk.ok ? pacesAt(chk.pace, steps, i) : p.paces).E.slow;
  const base0 = new Set(
    (chk.ok
      ? (baseFrames(
          chk.input.startDate,
          chk.weeks,
          chk.pace.kind === 'feel' && chk.rule.feelTest
        ) ?? [])
      : []
    )
      .filter((f) => f.deload)
      .map((f) => f.index)
  );
  let run = 0;
  let free = false;
  for (const w of W) {
    if (restarts.has(w.index)) [run, free] = [0, true];
    if (!isBuild(w)) continue;
    // Pouka 22: niz se broji od ukinutog rasterećenja (rasteretna u osnovnoj periodizaciji ili u prethodnom
    // planu, sada izgradnja; lanac: ukinuto u ranijem koraku).
    if (!w.deload && (before.weeks[w.index - 1]?.deload || base0.has(w.index))) run = 0;
    if (w.deload) [run, free] = [0, forced.has(w.index)];
    else if (++run > P.deload.exceptionRun + 1 && !free && !mixed.has(w.index))
      bad.push(`niz izgradnje ${run} ned ${w.index}`);
  }
  // Pouka 32: kvalitetni dan iznad najnižeg nivoa zone ≤ dugi (buduće nedelje bez mešanja).
  const beg = p.input.experience === 'beginner';
  const LOW: Record<string, number> = {
    R: 1200,
    I: 2000,
    T_continuous: 2000,
    T_cruise: 2400,
    RP: 4000
  };
  for (const w of W) {
    const long = w.days.find((d) => d.role === 'long');
    if (!long || w.phase === 'race' || mixed.has(w.index) || mustDay(w.endDate) <= t) continue;
    for (const d of qualityOf(w)) {
      const dose = d.workout.dose!;
      const low =
        isBuild(w) && !w.deload && w.limits?.quality === undefined
          ? dose.doseM <= (beg && dose.ladder === 'T_continuous' ? 1500 : LOW[dose.ladder]!)
          : dose.doseM <= (dose.zone === 'RP' ? 4000 : beg ? 1500 : 2000);
      const sec = d.workout.segments.reduce(
        (a, x) =>
          a +
          (x.kind === 'recovery' && x.kmBasis === 'exact'
            ? Math.round(x.km * slowOf(w.index))
            : x.sec),
        0
      );
      if (!low && sec > long.workout.sec) bad.push(`dan kvaliteta > dugi ned ${w.index}`);
    }
  }
  // Pouka 28: dugi ≤ max(1,1 × L, L + 1), L = najduži dugi prethodne 4 nedelje (u ned 1–4 i skorašnji i dugi
  // reference umora pre starta).
  const longs = W.map((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? Math.round(l.workout.km * 10) : null;
  });
  const r = p.input.recentLongRunKm;
  W.forEach((w, i) => {
    const l = longs[i];
    if (l == null || mustDay(w.endDate) <= t) return;
    // HM-09 (C9): zaključan ili urađen dugi je činjenica (zaštićen) — ne sudi mu se.
    const ld = w.days.find((d) => d.role === 'long')!.date;
    if (locked.has(ld)) return;
    const prev = longs.slice(Math.max(0, i - 4), i).filter((x): x is number => x !== null);
    if (r != null && i < 4) prev.push(Math.round(r * 10));
    // Pouka 34 (Faza 4a N10.3): posle umora pre starta dugi reference (ned 1 generatora) je „nedelja 0".
    const ref = [...steps].reverse().find((s) => s.preStart)?.preStart?.longKm;
    if (ref != null && i < 4) prev.push(Math.round(ref * 10));
    if (prev.length === 0) return;
    const L = Math.max(...prev);
    if (l > Math.max(Math.floor(1.1 * L + 1e-9), L + 10))
      bad.push(`dugi > pouka 28 ned ${w.index}`);
  });
  // A8: povratni rast ≤ nivo pre smanjenja (ili redovan rast H6) — nedelje izgradnje posle smanjenja.
  const reducedFrom = Math.min(
    ...steps.filter((s) => s.startKm !== null || s.returnFrom).map((s) => s.firstWeek)
  );
  let prev: number | null = null;
  for (const w of W) {
    if (!isBuild(w) || w.deload) continue;
    const t10 = Math.round(w.targetKm * 10);
    if (prev !== null && w.index > reducedFrom && !mixed.has(w.index)) {
      const level = Math.max(
        0,
        ...steps
          .filter((s) => s.fromWeek <= w.index && s.levelKm !== null)
          .map((s) => Math.round(s.levelKm! * 10))
      );
      // H17 (owner K1): početnik najviše 2,0 km rasta (kao gridInvariants), ostali 4,0 km.
      const normal =
        prev + Math.min(beg ? 20 : 40, Math.max(10, Math.round(prev * (beg ? 0.05 : 0.06))));
      const back = Math.min(level, prev + Math.max(10, Math.round(prev * 0.1)));
      // H6: nedelja na najbližem izvodljivom cilju (fitted, napomena) — poredi se cilj po pravilu.
      const rule10 = w.fitted !== null ? Math.round(w.nominalKm * 10) : t10;
      if (rule10 > Math.max(normal, back)) bad.push(`povratni rast > nivo ned ${w.index}`);
    }
    prev = t10;
  }
}
