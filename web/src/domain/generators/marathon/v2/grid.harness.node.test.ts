/* Zajednički kod mreže 01 (grid.node.test.ts i delovi punog nivoa grid.<k>.full.node.test.ts); bez testova
   (vitest ga ne skuplja, v. vitest.config.ts). Invarijante su NEZAVISNE od validatora: računaju se iz plana i
   politike, ne pozivaju validate.ts. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { daysBetween } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { longTimeCap10 } from './lengths.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import { gridInputs, type GridInput } from './testInputs.ts';
import type { MarathonV2Plan, PlanWeek } from './types.ts';

export const GRID_PARTS = 3;
export const WRITE = process.env['MARATHON_V2_WRITE_BASELINE'] === '1';
const HERE = dirname(fileURLToPath(import.meta.url));
export const BASELINE = join(HERE, 'segment01.baseline.json');

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

/** FNV-1a (32 bit) nad JSON-om plana bez oznake verzije — heš za regresiju sledećih segmenata. */
export function planHash(p: MarathonV2Plan): string {
  const s = JSON.stringify({ ...p, policyVersion: '' });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

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

/** Invarijante (Uslov 8 i pouke 1–5, 9, 12): spisak prekršaja; prazan = plan je upotrebljiv. */
export function invariants(id: string, p: MarathonV2Plan): string[] {
  const bad: string[] = [];
  const no = (m: string): void => {
    bad.push(`${id}: ${m}`);
  };
  const W = p.weeks;
  const N = W.length;
  if (p.policyId !== 'marathon-v2' || p.policyVersion !== P.version) no('oznaka politike');
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
    if (load + 1e-9 < P.days[4].weekMinKm) no(`nedelja ${w.index} ispod minimuma`);
    if (w.phase === 'race') continue;
    if (Math.abs(w.plannedKm - w.targetKm) > 0.1 + 1e-9) no(`planirano ≠ cilj ned ${w.index}`);
    const long = w.days.find((d) => d.role === 'long');
    if (!long) {
      no(`bez dugog ned ${w.index}`);
      continue;
    }
    for (const d of w.days)
      if (d.role === 'easy' && d.workout.km > long.workout.km + 1e-9)
        no(`dugi < lagan ned ${w.index}`);
    if (to10(long.workout.km) > Math.floor(0.4 * to10(w.targetKm) + 1e-9))
      no(`dugi > 40 % ned ${w.index}`);
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
  // Glavna doza ne opada van kapaciteta (pouke 3 i 12).
  const steady = W.filter(isSteady);
  for (let i = 1; i < steady.length; i++)
    if (mainM(steady[i]!) < mainM(steady[i - 1]!) && steady[i]!.fitted !== 'down')
      no(`glavna doza opada ned ${steady[i]!.index}`);
  // Ned 1 = trenutni obim; ispod samo uz dugi na 150 min (pouka 9).
  const w1 = W[0]!;
  if (w1.targetKm > p.startKm) no('ned 1 iznad obima');
  if (w1.targetKm < p.startKm) {
    const l = w1.days.find((d) => d.role === 'long')!;
    if (to10(l.workout.km) !== longTimeCap10(p.paces)) no('ned 1 ispod obima bez dugog na 150 min');
  }
  // Taper (M7): cilj ≤ 0,8 / 0,6 × vrh; N−1 bez T.
  const [t0, t1, rw] = [W[N - 3]!, W[N - 2]!, W[N - 1]!];
  if (to10(t0.targetKm) > Math.round(0.8 * to10(p.peakKm))) no('N−2 > 0,8 × vrh');
  if (to10(t1.targetKm) > Math.round(0.6 * to10(p.peakKm))) no('N−1 > 0,6 × vrh');
  if (t1.days.some((d) => d.workout.dose?.zone === 'T')) no('N−1 ima T');
  // M7/M7a: obe nedelje tapera imaju MP ≥ 2 × 3000 m; N−2 ≥ N−1 (cilj i planirano); taper ≤ poslednja
  // izgradnja (odluka organizatora posle STANI, nalaz 1).
  for (const t of [t0, t1]) {
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

export interface GridRun {
  plans: Map<string, MarathonV2Plan>;
  rejected: string[];
}

/** Mreža nad `inputs`: generisanje u beforeAll; K1, invarijante, determinizam, bazna linija. */
export function describeGrid(
  title: string,
  inputs: readonly GridInput[],
  extra?: () => void
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
        for (const w of p.weeks)
          if (isSteady(w) && !w.days.some((d) => d.workout.kind === 'quality')) noQ++;
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

    it('= bazna linija segment01.baseline.json (vrh, dugi, doza, rasterećenja, taper, upozorenja, heš plana)', () => {
      const rows = Object.fromEntries([...run.plans].map(([id, p]) => [id, rowOf(p)]));
      if (WRITE) {
        expect(FULL && inputs.length === ALL.length).toBe(true);
        writeFileSync(BASELINE, `${JSON.stringify(rows, null, 0)}\n`);
        return;
      }
      const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, string>;
      expect(Object.keys(base)).toHaveLength(ALL.length);
      const diff = Object.entries(rows).filter(([id, row]) => base[id] !== row);
      expect(diff.slice(0, 10)).toEqual([]);
    });

    extra?.();
  });
}
