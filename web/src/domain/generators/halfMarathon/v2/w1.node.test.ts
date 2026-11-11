/* W1 (hm-v2.15.0) — plan za bilo koji broj nedelja, uz upozorenje (docs/generators-v2/perfection/briefs/
   W1-bilo-koja-duzina-plana.md). Nezavisne invarijante (brojevi iz odluka, ne iz koda generatora): plan postoji (0
   odbijanja zbog dužine, 0 padova validatora), trkačka nedelja je poslednja, nema nedelje ispod minimuma reda H15,
   nema praznog treninga, dugi ≥ svaki lagan (AGENTS.md uslov 8). Mreža W1-D: N ∈ {1, 2, 3, MIN − 1} i {MAX + 1,
   MAX + 8, 52} × osnovni profili (redovan sa rezultatom, po osećaju, početnik; 3–6 dana; mali i veliki obim). */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { phasesOf } from './periodize.ts';
import { inputOf, KM_BY_DAYS, type Profile, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { HmV2Plan } from './types.ts';

/** H15 (nezavisno): minimum nedelje po broju dana. */
const WEEK_MIN: Record<number, number> = { 3: 12, 4: 16, 5: 20, 6: 24 };
/** H17 (nezavisno): obim početnika. */
const BEG_KM: Record<number, [number, number]> = { 4: [20, 40], 5: [25, 45] };
const EPS = 1e-9;

export interface W1Case {
  id: string;
  profile: Profile;
}

/** Osnovni profili W1-D za dužinu N. */
export function w1Cases(ns: readonly number[]): W1Case[] {
  const out: W1Case[] = [];
  for (const weeks of ns)
    for (const days of [3, 4, 5, 6] as const)
      for (const kind of ['res', 'feel', 'beg'] as const) {
        if (kind === 'beg' && days !== 4 && days !== 5) continue;
        const [lo, hi] =
          kind === 'beg' ? BEG_KM[days]! : [KM_BY_DAYS[days].min, KM_BY_DAYS[days].max];
        for (const km of [lo, hi])
          for (const sc of ['A', 'C'] as const) {
            const s = SCHEDULES_BY_DAYS[days][sc];
            const profile: Profile = { weeks, km, days: s.days, long: s.long };
            if (kind === 'res') profile.vdot = km === lo ? 38 : 52;
            else if (kind === 'feel') profile.easyPaceSecPerKm = km === lo ? 420 : 330;
            else
              Object.assign(profile, { beginner: true, easyPaceSecPerKm: km === lo ? 450 : 390 });
            out.push({ id: `${weeks}w-d${days}-${km}km-${kind}-${sc}`, profile });
          }
      }
  return out;
}

/** Nezavisne invarijante plana W1 (prekršaji kao tekst). */
export function w1Violations(p: HmV2Plan, weeks: number): string[] {
  const bad: string[] = [];
  const min = WEEK_MIN[p.input.runDays.length]!;
  if (p.weeks.length !== weeks) bad.push(`broj nedelja ${p.weeks.length}`);
  const last = p.weeks[p.weeks.length - 1]!;
  if (last.phase !== 'race' || !last.days.some((d) => d.role === 'race'))
    bad.push('poslednja nedelja nije trkačka');
  for (const w of p.weeks) {
    if (w.phase === 'race' && w !== last) bad.push(`ned ${w.index}: trkačka nije poslednja`);
    // Trkačka nedelja: planirano + trka ≥ minimum (kao mreža 02).
    const km = w.plannedKm + (w.phase === 'race' ? 21.1 : 0);
    if (km + EPS < min) bad.push(`ned ${w.index}: ${w.plannedKm} km < minimum ${min}`);
    for (const d of w.days)
      if (d.role !== 'race' && (!(d.workout.km > 0) || !(d.workout.sec > 0)))
        bad.push(`ned ${w.index}: prazan trening ${d.date}`);
    const long = w.days.find((d) => d.role === 'long');
    if (w.phase !== 'race' && !long) bad.push(`ned ${w.index}: bez dugog`);
    if (long)
      for (const d of w.days)
        if (d.role === 'easy' && d.workout.km > long.workout.km + EPS)
          bad.push(`ned ${w.index}: lagan ${d.workout.km} > dugi ${long.workout.km}`);
  }
  return bad;
}

/** W1-A (nezavisno): faze kratkog plana = poslednjih N nedelja plana od MIN nedelja (10, početnik 12). */
const shortPhases = (n: number, beginner: boolean): string[] =>
  phasesOf(beginner ? 12 : 10).slice((beginner ? 12 : 10) - n);

describe('W1-A: kratak plan (1 ≤ N < MIN)', () => {
  const cases = w1Cases([1, 2, 3, 9, 11]).filter(
    (c) => c.profile.weeks < (c.profile.beginner ? 12 : 10)
  );
  it(`mreža: ${cases.length} planova — 0 odbijanja zbog dužine, 0 padova validatora, invarijante uslova 8`, () => {
    const rejected: string[] = [];
    const bad: string[] = [];
    for (const c of cases) {
      const r = generateHmV2(inputOf(c.profile));
      if (!r.ok) {
        rejected.push(`${c.id}: ${r.reasons.map((x) => `${x.code} ${x.message}`).join(' | ')}`);
        continue;
      }
      for (const v of w1Violations(r.plan, c.profile.weeks)) bad.push(`${c.id}: ${v}`);
      const want = shortPhases(c.profile.weeks, !!c.profile.beginner);
      if (r.plan.weeks.map((w) => w.phase).join() !== want.join())
        bad.push(`${c.id}: faze ${r.plan.weeks.map((w) => w.phase).join()}`);
      if (r.plan.layout?.kind !== 'short') bad.push(`${c.id}: bez činjenice rasporeda`);
    }
    expect(rejected).toEqual([]);
    expect(bad).toEqual([]);
  });

  it('N = 1 je samo trkačka nedelja, N = 2 taper + trkačka; nedelje 1–2 bez rasterećenja', () => {
    const one = generateHmV2(
      inputOf({ weeks: 1, km: 40, vdot: 45, days: ['tue', 'thu', 'sat', 'sun'] })
    );
    const two = generateHmV2(
      inputOf({ weeks: 2, km: 40, vdot: 45, days: ['tue', 'thu', 'sat', 'sun'] })
    );
    if (!one.ok || !two.ok) throw new Error('plan');
    expect(one.plan.weeks.map((w) => w.phase)).toEqual(['race']);
    expect(two.plan.weeks.map((w) => w.phase)).toEqual(['taper', 'race']);
    for (const n of [3, 4, 5, 6, 7, 8, 9]) {
      const r = generateHmV2(
        inputOf({ weeks: n, km: 40, vdot: 45, days: ['tue', 'thu', 'sat', 'sun'] })
      );
      if (!r.ok) throw new Error(`plan ${n}`);
      expect(
        r.plan.weeks.slice(0, 2).some((w) => w.deload),
        `${n}`
      ).toBe(false);
    }
  });

  it('početnik kratkog plana: uvod samo za nedelje uvoda koje postoje (11 ned → 1, 10 ned → 0)', () => {
    const b = (n: number) =>
      generateHmV2(
        inputOf({
          weeks: n,
          km: 30,
          days: ['tue', 'thu', 'sat', 'sun'],
          beginner: true,
          easyPaceSecPerKm: 420
        })
      );
    const q = (p: HmV2Plan, i: number) =>
      p.weeks[i]!.days.some((d) => d.workout.kind === 'quality');
    const r11 = b(11);
    const r10 = b(10);
    if (!r11.ok || !r10.ok) throw new Error('plan');
    expect(q(r11.plan, 0)).toBe(false);
    expect(q(r11.plan, 1)).toBe(true);
    expect(q(r10.plan, 0)).toBe(true);
  });
});
