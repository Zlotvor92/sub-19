/* Zajednički kod mreže 02 (grid.node.test.ts i delovi punog nivoa grid.<k>.full.node.test.ts) i guste mreže
   nedelje 1 (dense*); bez testova (vitest ga ne skuplja, v. vitest.config.ts). Invarijante su NEZAVISNE od
   validatora: računaju se iz plana i politike, ne pozivaju validate.ts. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { daysBetween } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { longTimeCap10 } from './lengths.ts';
import { raceTimeForVdot, vdotFromResult } from './paces.ts';
import { MARATHON_V2_POLICY as P, planRule } from './policy.ts';
import {
  gridInputs,
  type GridInput,
  hasPyramid,
  normalizedHash,
  planHash,
  planHash02
} from './testInputs.ts';
import type { MarathonV2Plan, PlanWeek } from './types.ts';

export const GRID_PARTS = 6;
export const WRITE = process.env['MARATHON_V2_WRITE_BASELINE'] === '1';
const HERE = dirname(fileURLToPath(import.meta.url));
export const BASELINE = join(HERE, 'segment03.baseline.json');
/** Bazna linija MAR-02 (marathon-v2.1.0): regresija planova sa rezultatom (planHash02). */
export const BASELINE_02 = join(HERE, 'segment02.baseline.json');
/** Regresija 4 dana prema MAR-01 (e86d2c3): heš normalizovanog plana MAR-01 po id-u mreže 01 + planovi koje
    menja piramida M10a (artifacts/segment-02/regression-01.ts). */
export const REGRESSION_01 = join(HERE, 'segment02.regression-01.json');
export const BASELINE_01 = join(HERE, 'segment01.baseline.json');

export const ALL: readonly GridInput[] = gridInputs();

const to10 = (km: number): number => Math.round(km * 10);
const BUILD = ['base', 'development', 'specific'];
const isSteady = (w: PlanWeek): boolean => BUILD.includes(w.phase) && !w.deload;
const firstOfPhase = (p: MarathonV2Plan, i: number): boolean =>
  i === 1 || p.weeks[i - 2]!.phase !== p.weeks[i - 1]!.phase;
const mainM = (w: PlanWeek): number =>
  w.days.reduce(
    (a, d) =>
      a + Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.MP) * 1000),
    0
  );

/** Red bazne linije: vrh cilja, najveće planirano, najduži dugi, najveća glavna doza [m], rasterećenja,
    cilj N−2 / N−1 / trkačke, upozorenja (pravila), heš celog plana. */
export function rowOf(p: MarathonV2Plan): string {
  const W = p.weeks;
  const N = W.length;
  const longest = Math.max(
    ...W.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
  );
  return [
    p.peakKm,
    Math.max(...W.map((w) => w.plannedKm)),
    longest,
    Math.max(...W.filter(isSteady).map(mainM)),
    W.filter((w) => w.deload)
      .map((w) => w.index)
      .join('.'),
    W[N - 3]!.targetKm,
    W[N - 2]!.targetKm,
    W[N - 1]!.plannedKm,
    [...new Set(p.warnings.map((w) => w.rule))].sort().join('.'),
    planHash(p)
  ].join('|');
}

/** Invarijante (Uslov 8 i pouke 1–5, 9, 12; M16 po osećaju i M17 početnik): spisak prekršaja; prazan = plan
    je upotrebljiv. */
export function invariants(id: string, p: MarathonV2Plan): string[] {
  const bad: string[] = [];
  const no = (m: string): void => {
    bad.push(`${id}: ${m}`);
  };
  const W = p.weeks;
  const N = W.length;
  const beginner = p.input.experience === 'beginner';
  const rule = planRule(p.input.runDays.length, beginner ? 'beginner' : 'regular')!;
  if (p.policyId !== 'marathon-v2' || p.policyVersion !== P.version) no('oznaka politike');
  bad.push(...feelBeginnerInvariants(id, p));
  // Faze: taper tačno N−2 i N−1, trka N (M4/M7).
  if (
    W.map((w) => w.phase).join() !==
      [...W.slice(0, N - 3).map((w) => w.phase), 'taper', 'taper', 'race'].join() ||
    W.slice(0, N - 3).some((w) => !BUILD.includes(w.phase))
  )
    no('faze: taper 2 nedelje + trka');
  for (const w of W) {
    for (const d of w.days)
      if (!(d.workout.km > 0) || d.workout.segments.length === 0)
        no(`prazan trening ned ${w.index}`);
    const load = w.plannedKm + (w.phase === 'race' ? P.raceWeek.raceKm : 0);
    if (load + 1e-9 < rule.weekMinKm) no(`nedelja ${w.index} ispod minimuma`);
    // M15 3 dana: bez I i R nigde; najviše 1 kvalitet nedeljno.
    const q = w.days.filter((d) => d.workout.kind === 'quality');
    if (rule.quality === 1 && q.some((d) => d.workout.workKm.I > 0 || d.workout.workKm.R > 0))
      no(`3 dana sa I/R ned ${w.index}`);
    if (q.length > rule.quality) no(`više od ${rule.quality} kvaliteta ned ${w.index}`);
    if (w.phase === 'race') continue;
    // M16: test zamenjuje Q1; M17: uvod (ned 1–2) bez kvaliteta.
    const want =
      w.index <= (beginner ? 2 : 0)
        ? 0
        : rule.quality - (w.days.some((d) => d.role === 'test') ? 1 : 0);
    if (isSteady(w) && q.length !== want) no(`izgradnja bez ${want} kvaliteta ned ${w.index}`);
    // M15 5/6 dana: lagani jednaki (razlika ≤ 0,1 km).
    const easy = w.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km));
    if (easy.length > 1 && Math.max(...easy) - Math.min(...easy) > 1)
      no(`lagani nejednaki ned ${w.index}`);
    if (Math.abs(w.plannedKm - w.targetKm) > 0.1 + 1e-9) no(`planirano ≠ cilj ned ${w.index}`);
    const long = w.days.find((d) => d.role === 'long');
    if (!long) {
      no(`bez dugog ned ${w.index}`);
      continue;
    }
    for (const d of w.days)
      if (d.role === 'easy' && d.workout.km > long.workout.km + 1e-9)
        no(`dugi < lagan ned ${w.index}`);
    if (to10(long.workout.km) > Math.floor(rule.longMaxShare * to10(w.targetKm) + 1e-9))
      no(`dugi > udeo ned ${w.index}`);
    if (long.workout.km * p.paces.E.slow > 9000 + 1e-6) no(`dugi > 150 min ned ${w.index}`);
    // Plafoni po treningu (M11), iz politike — nezavisno od quality.capM. M7a: MP u taperu je doza M7
    // (minimum 2 × 3000 m ispred plafona) — proverava se ispod.
    for (const d of w.days)
      for (const z of ['R', 'I', 'T', 'MP'] as const)
        if (!(w.phase === 'taper' && z === 'MP'))
          if (
            Math.round(d.workout.workKm[z] * 1000) >
            Math.floor(P.caps[z] * w.targetKm * 1000 + 1e-6)
          )
            no(`plafon ${z} ned ${w.index}`);
  }
  // Teški dani nesusedni, i preko granice nedelje (M9).
  const hard = W.flatMap((w) => w.days.filter((d) => d.hard).map((d) => d.date));
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!, hard[i]!) < 2) no(`susedni teški dani ${hard[i]}`);
  // Rasterećenje (M5, pouka 4).
  const build = W.filter((w) => BUILD.includes(w.phase)).length;
  let run = 0;
  for (const w of W.filter((x) => BUILD.includes(x.phase))) {
    if (w.deload) {
      if (w.index < 3 || firstOfPhase(p, w.index) || w.index === build)
        no(`rasterećenje ned ${w.index}`);
      run = 0;
    } else if (++run > 4 || (run === 4 && !firstOfPhase(p, w.index)))
      no(`niz izgradnje ned ${w.index}`);
  }
  // Glavna doza ne opada van kapaciteta (pouke 3 i 12); nedelja testa i uvod se ne porede (M16, M17).
  const steady = W.filter(
    (w) =>
      isSteady(w) &&
      !w.days.some((d) => d.role === 'test') &&
      w.days.some((d) => d.workout.kind === 'quality')
  );
  for (let i = 1; i < steady.length; i++)
    if (mainM(steady[i]!) < mainM(steady[i - 1]!) && steady[i]!.fitted !== 'down')
      no(`glavna doza opada ned ${steady[i]!.index}`);
  // Ned 1 = trenutni obim; ispod samo uz dugi na 150 min (pouka 9) ili na pragu skorašnjeg najdužeg
  // max(1,1 r; r + 1) (pouka 28) — prag računat ovde, nezavisno od lengths.ts.
  const w1 = W[0]!;
  const l1 = to10(w1.days.find((d) => d.role === 'long')!.workout.km);
  const r = p.input.recentLongRunKm;
  const rCap = r == null ? null : Math.floor(Math.max(1.1 * r, r + 1) * 10 + 1e-9);
  // M13a: svaki dugi ≤ max(1,1 m; m + 1,0), m = najduži u prethodne 4 nedelje (r = nedelja 0).
  const L = [r ?? null, ...W.map((w) => w.days.find((d) => d.role === 'long')?.workout.km ?? null)];
  for (let i = 1; i < L.length; i++) {
    const l = L[i];
    const prev = L.slice(Math.max(0, i - 4), i).filter((x): x is number => x !== null);
    if (l === null || l === undefined || prev.length === 0) continue;
    const m = Math.max(...prev);
    if (to10(l) > Math.floor(Math.max(1.1 * m, m + 1) * 10 + 1e-9)) no(`skok dugog ned ${i}`);
  }
  if (w1.targetKm > p.startKm) no('ned 1 iznad obima');
  if (w1.targetKm < p.startKm && l1 !== longTimeCap10(p.paces) && l1 !== rCap)
    no('ned 1 ispod obima bez dugog na plafonu');
  // Taper (M7): cilj ≤ 0,8 / 0,6 × vrh; N−1 bez T.
  const [t0, t1, rw] = [W[N - 3]!, W[N - 2]!, W[N - 1]!];
  if (to10(t0.targetKm) > Math.round(0.8 * to10(p.peakKm))) no('N−2 > 0,8 × vrh');
  if (to10(t1.targetKm) > Math.round(0.6 * to10(p.peakKm))) no('N−1 > 0,6 × vrh');
  // M17: početnik u N−1 ima T kont. umesto MP (odluka organizatora MAR-03 S3).
  if (!beginner && t1.days.some((d) => d.workout.dose?.zone === 'T')) no('N−1 ima T');
  if (beginner && t1.days.some((d) => d.workout.dose?.zone === 'MP')) no('početnik: N−1 ima MP');
  if (rule.quality === 1 && t0.days.some((d) => d.workout.dose?.zone === 'T'))
    no('3 dana: N−2 ima T');
  // M7/M7a: obe nedelje tapera imaju MP ≥ 2 × 3000 m; N−2 ≥ N−1 (cilj i planirano); taper ≤ poslednja
  // izgradnja (odluka organizatora posle STANI, nalaz 1).
  for (const t of beginner ? [t0] : [t0, t1]) {
    const mp = t.days.find((d) => d.workout.dose?.zone === 'MP')?.workout.dose?.doseM ?? 0;
    if (mp < 6000) no(`taper ned ${t.index} bez MP ≥ 6000 m`);
  }
  if (t0.targetKm < t1.targetKm || t0.plannedKm < t1.plannedKm) no('N−2 < N−1');
  const lastBuild = W.filter(isSteady).at(-1)!;
  for (const t of [t0, t1])
    if (t.targetKm > lastBuild.targetKm || t.plannedKm > lastBuild.plannedKm)
      no(`taper ned ${t.index} > poslednja izgradnja`);
  // Trkačka (M8, pouka 5): ≤ taper, oštrenje ≤ MP doza N−1 i ≥ 3 dana pre trke, dan pred trku ≤ 30 min.
  if (rw.plannedKm > t1.plannedKm + 1e-9) no('trkačka > taper');
  const mpN1 = t1.days.find((d) => d.workout.dose?.zone === 'MP')?.workout.dose?.doseM ?? 0;
  for (const d of rw.days) {
    if (
      d.role === 'sharpener' &&
      ((d.workout.dose?.doseM ?? 0) > mpN1 || daysBetween(d.date, p.input.raceDate) < 3)
    )
      no('oštrenje');
    if (d.role === 'eve' && d.workout.sec > 1800) no('dan pred trku > 30 min');
    if (
      d.role === 'easy' &&
      t1.days.some((e) => e.role === 'easy' && e.workout.km + 1e-9 < d.workout.km)
    )
      no('lagan trkačke > lagan tapera');
  }
  const races = W.flatMap((w) => w.days.filter((d) => d.role === 'race'));
  if (races.length !== 1 || races[0]!.date !== p.input.raceDate || races[0]!.countsToWeek)
    no('trka');
  return bad;
}

const EASY_FRACTION_FAST = 0.7;

/** M16/M17 invarijante, nezavisno od validatora (brojevi iz MASTER § 5 M16/M17, ne iz politike gde je moguće). */
export function feelBeginnerInvariants(id: string, p: MarathonV2Plan): string[] {
  const bad: string[] = [];
  const no = (m: string): void => {
    bad.push(`${id}: ${m}`);
  };
  const W = p.weeks;
  const beginner = p.input.experience === 'beginner';
  const easy = p.input.easyPaceSecPerKm;
  const feel = p.paceBasis === 'feel';
  const tests = W.flatMap((w) =>
    w.days.filter((d) => d.role === 'test').map((d) => ({ w: w.index, d }))
  );
  const lastBase = W.map((w) => w.phase).lastIndexOf('base') + 1;
  const quality = W.flatMap((w) => w.days.filter((d) => d.workout.kind === 'quality'));
  if (feel) {
    if (typeof easy !== 'number') no('po osećaju bez laganog tempa');
    else {
      if (p.paces.E.fast !== easy - 15 || p.paces.E.slow !== easy + 15) no('E ≠ lagan ± 15 s');
      // Procena VDOT-a: VO2 pri laganom tempu / 0,70 (25–60), nezavisna formula.
      const v = 60000 / easy;
      const est =
        Math.round(((-4.6 + 0.182258 * v + 0.000104 * v * v) / EASY_FRACTION_FAST) * 10) / 10;
      if (p.vdot !== Math.min(60, Math.max(25, est))) no('procena VDOT-a');
    }
    if (p.predictedMarathonSec !== null || p.goal !== null) no('po osećaju sa prognozom/ciljem');
    const rpe: Record<string, [number, number]> = { T: [6, 7], I: [8, 8], R: [8, 8], MP: [5, 6] };
    for (const d of quality) {
      const z = d.workout.dose!.zone;
      if (!d.workout.rpe || d.workout.rpe.min !== rpe[z]![0] || d.workout.rpe.max !== rpe[z]![1])
        no(`RPE ${z}`);
    }
  } else {
    if (p.predictedMarathonSec === null) no('sa rezultatom bez prognoze');
    if (quality.some((d) => d.workout.rpe !== undefined)) no('RPE u planu sa rezultatom');
    const r = p.input.recentResult;
    if (!r || Math.round(vdotFromResult(r.distanceM, r.timeSec) * 10) / 10 !== p.vdot) no('VDOT');
  }
  // M16: tačno jedan test u poslednjoj nedelji baze kod po osećaju (ne početnik); početnik i plan sa
  // rezultatom bez testa.
  if (feel && !beginner) {
    if (tests.length !== 1 || tests[0]!.w !== lastBase)
      no('test nije tačno jednom u poslednjoj nedelji baze');
    for (const { w, d } of tests) {
      const wk = W[w - 1]!;
      const day = wk.deload && p.pattern.q2 !== null ? p.pattern.q2 : p.pattern.q1;
      if (d.weekday !== day) no('dan testa');
      if (!wk.test) no('oznaka nedelje testa');
      if (d.workout.dose !== null || !d.countsToWeek) no('test je doza ili van obima');
      const ts = d.workout.segments.find((s) => s.kind === 'test');
      if (!ts || ts.km !== 5 || ts.sec !== raceTimeForVdot(p.vdot, 5000)) no('test 5 km');
      if (wk.days.some((x) => x.workout.kind === 'quality' && x.role === 'q1')) no('test + Q1');
    }
  } else if (tests.length > 0 || W.some((w) => w.test))
    no('test van plana po osećaju / kod početnika');
  if (beginner) {
    // M17: 4–5 dana, ≥ 16 ned; uvod 2 ned bez kvaliteta; ≤ 1 kvalitet, bez I/R; WU/CD 15/10; rast ≤ max(5 %,
    // 1,0) i ≤ 2,5 km; vrh ≤ min(1,5×, +25); dugi ≤ 150 min.
    if (![4, 5].includes(p.input.runDays.length) || W.length < 16) no('početnik: dani/nedelje');
    for (const w of W) {
      const q = w.days.filter((d) => d.workout.kind === 'quality');
      if (w.index <= 2 && q.length > 0) no(`uvod sa kvalitetom ned ${w.index}`);
      if (q.length > 1) no(`početnik > 1 kvalitet ned ${w.index}`);
      for (const d of q) {
        if (d.workout.workKm.I > 0 || d.workout.workKm.R > 0) no(`početnik I/R ned ${w.index}`);
        const s = d.workout.segments;
        if (s[0]!.sec !== 900 || s[s.length - 1]!.sec !== 600) no(`WU/CD ned ${w.index}`);
      }
    }
    const steady = W.filter(isSteady);
    for (let i = 1; i < steady.length; i++) {
      const a = Math.round(steady[i - 1]!.targetKm * 10);
      const b = Math.round(steady[i]!.targetKm * 10);
      if (b - a > Math.max(Math.round(0.05 * a), 10) || b - a > 25)
        no(`rast ned ${steady[i]!.index}`);
    }
    const s10 = Math.round(p.startKm * 10);
    if (Math.round(p.peakKm * 10) > Math.min(Math.floor(1.5 * s10), s10 + 250)) no('vrh početnika');
  }
  return bad;
}

export interface GridRun {
  plans: Map<string, MarathonV2Plan>;
  rejected: string[];
}

/** Mreža nad `inputs`: generisanje u beforeAll; K1, invarijante, determinizam, bazna linija `baseline`
    (`all` = ceo skup za snimanje); `withResult` = mreža 02 (regresije prema MAR-01 i MAR-02). */
export function describeGrid(
  title: string,
  inputs: readonly GridInput[],
  extra?: (run: GridRun) => void,
  baseline: string = BASELINE,
  all: readonly GridInput[] = ALL,
  withResult = true
): void {
  describe(title, () => {
    const run: GridRun = { plans: new Map(), rejected: [] };
    beforeAll(() => {
      for (const g of inputs) {
        const r = generateMarathonV2(g.input);
        if (r.ok) run.plans.set(g.id, r.plan);
        else run.rejected.push(`${g.id}: ${r.reasons.map((x) => x.message).join('; ')}`);
      }
    }, 600_000);

    it('K1: 0 odbijanja i 0 grešaka validatora za ulaze u opsegu', () => {
      expect(inputs.length).toBeGreaterThan(0);
      expect(run.rejected).toEqual([]);
      expect(run.plans.size).toBe(inputs.length);
    });

    it('invarijante (Uslov 8, pouke 1–5, 9, 12) nezavisno od validatora: 0 prekršaja', () => {
      const bad = [...run.plans].flatMap(([id, p]) => invariants(id, p));
      expect(bad.slice(0, 20)).toEqual([]);
    });

    it('K3/K5: nedelje izgradnje bez kvaliteta 0; trkačka > taper 0; spuštena doza samo u nedelji ograničenoj kapacitetom', () => {
      let noQ = 0;
      let dropOutside = 0;
      for (const p of run.plans.values()) {
        // Test (M16) zamenjuje kvalitet; uvod početnika (M17, ned 1–2) je bez kvaliteta.
        const intro = p.input.experience === 'beginner' ? 2 : 0;
        for (const w of p.weeks)
          if (
            isSteady(w) &&
            w.index > intro &&
            !w.days.some((d) => d.workout.kind === 'quality' || d.role === 'test')
          )
            noQ++;
        for (const v of p.warnings)
          if (v.rule === 'DOSE_DROPPED' && p.weeks[v.week! - 1]!.fitted !== 'down') dropOutside++;
      }
      expect([noQ, dropOutside]).toEqual([0, 0]);
    });

    it('determinizam: dva generisanja bajt-isto (svaki 6. ulaz)', () => {
      for (const g of inputs.filter((_, i) => i % 6 === 0)) {
        const r = generateMarathonV2(g.input);
        expect(r.ok && JSON.stringify(r.plan)).toBe(JSON.stringify(run.plans.get(g.id)));
      }
    });

    it(`= bazna linija ${baseline.split('/').pop()} (vrh, dugi, doza, rasterećenja, taper, upozorenja, heš plana)`, () => {
      const rows = Object.fromEntries([...run.plans].map(([id, p]) => [id, rowOf(p)]));
      if (WRITE) {
        expect(FULL && inputs.length === all.length).toBe(true);
        writeFileSync(baseline, `${JSON.stringify(rows, null, 0)}\n`);
        return;
      }
      const base = JSON.parse(readFileSync(baseline, 'utf8')) as Record<string, string>;
      expect(Object.keys(base)).toHaveLength(all.length);
      const diff = Object.entries(rows).filter(([id, row]) => base[id] !== row);
      expect(diff.slice(0, 10)).toEqual([]);
    });

    if (withResult)
      it('regresija prema MAR-02 (segment02.baseline.json): menjaju se tačno planovi sa kvalitetnim danom dužim od dugog u MAR-02 (plafon MP, pouka 14); ostali bajt-isti osim paceBasis (planHash02)', () => {
        const base = JSON.parse(readFileSync(BASELINE_02, 'utf8')) as Record<string, string>;
        const fields = (row: string): string => row.split('|').slice(0, -1).join('|');
        const bad: string[] = [];
        for (const [id, p] of run.plans) {
          const row = base[id]!;
          const longer = row.split('|')[8]!.split('.').includes('LONG_SHORTER_THAN_QUALITY');
          const same = planHash02(p) === row.split('|').pop() && fields(rowOf(p)) === fields(row);
          if (same === longer) bad.push(id);
          if (p.warnings.some((w) => w.rule === 'LONG_SHORTER_THAN_QUALITY'))
            bad.push(`kval > dugi ${id}`);
        }
        expect(bad.slice(0, 10)).toEqual([]);
      });

    if (withResult)
      it('regresija 4 dana prema MAR-01: menjaju samo piramida M10a i plafon skoka M13a (ostalo bajt-isto osim teksta preporuke i napomene ned 1)', () => {
        const reg = JSON.parse(readFileSync(REGRESSION_01, 'utf8')) as {
          hashes: Record<string, string>;
          pyramid: string[];
          jump: string[];
        };
        const base01 = JSON.parse(readFileSync(BASELINE_01, 'utf8')) as Record<string, string>;
        const pyr = new Set(reg.pyramid);
        const jump = new Set(reg.jump);
        const bad: string[] = [];
        const fields = (row: string): string => row.split('|').slice(0, -1).join('|');
        for (const [id, p] of run.plans) {
          if (!id.startsWith('d4-')) continue;
          const old = id.slice(3);
          const why = pyr.has(old) || jump.has(old);
          const bound = p.weeks.some((w) => w.notes.some((n) => n.includes('plafon skoka')));
          if ((normalizedHash(p) !== reg.hashes[old]) !== why) bad.push(old);
          if (hasPyramid(p) !== pyr.has(old) || (!pyr.has(old) && bound !== jump.has(old)))
            bad.push(`uzrok ${old}`);
          // Red segment01.baseline.json bez heša (vrh, dugi, doza, rasterećenja, taper, upozorenja).
          if (!why && fields(rowOf(p)) !== fields(base01[old]!)) bad.push(`red ${old}`);
        }
        expect(bad.slice(0, 10)).toEqual([]);
      });

    extra?.(run);
  });
}
