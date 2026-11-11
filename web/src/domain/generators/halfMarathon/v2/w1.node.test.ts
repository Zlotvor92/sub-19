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

/** W1-C (nezavisno): tačno jedno upozorenje dužine, ista rečenica u napomeni plana; kratak — „Skraćena priprema" sa
    MIN, dug — „duži od preporučenih 20 nedelja" sa nedeljom K + 1. */
export function warningViolations(p: HmV2Plan, weeks: number): string[] {
  const bad: string[] = [];
  const ws = p.warnings.filter((w) => w.rule === 'PLAN_LENGTH');
  const min = p.input.experience === 'beginner' ? 12 : 10;
  if (weeks >= min && weeks <= 20) {
    if (ws.length > 0) bad.push('upozorenje dužine u planu [MIN, MAX]');
    return bad;
  }
  if (ws.length !== 1) return [`upozorenja dužine: ${ws.length}`];
  const t = ws[0]!.message;
  if (!p.notes.includes(t)) bad.push('napomena plana bez upozorenja');
  if (/W1|layout|MIN|MAX/.test(t)) bad.push(`interna oznaka: ${t}`);
  if (weeks < min) {
    if (!t.startsWith('Skraćena priprema: plan ima ') || !t.includes(`najmanje ${min}.`))
      bad.push(`tekst: ${t}`);
  } else if (
    !t.startsWith('Plan je duži od preporučenih 20 nedelja: ') ||
    !t.endsWith(`počinje u nedelji ${weeks - 19}.`)
  )
    bad.push(`tekst: ${t}`);
  return bad;
}

/** Nezavisne invarijante plana W1 (prekršaji kao tekst). */
export function w1Violations(p: HmV2Plan, weeks: number): string[] {
  const bad: string[] = [...warningViolations(p, weeks)];
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

describe('W1-B: dug plan (N > MAX, najviše 52)', () => {
  const cases = w1Cases([21, 28, 52]);
  it(`mreža: ${cases.length} planova — 0 odbijanja zbog dužine, 0 padova validatora, invarijante uslova 8`, () => {
    const rejected: string[] = [];
    const bad: string[] = [];
    for (const c of cases) {
      const r = generateHmV2(inputOf(c.profile));
      if (!r.ok) {
        rejected.push(`${c.id}: ${r.reasons.map((x) => `${x.code} ${x.message}`).join(' | ')}`);
        continue;
      }
      const p = r.plan;
      const K = c.profile.weeks - 20;
      for (const v of w1Violations(p, c.profile.weeks)) bad.push(`${c.id}: ${v}`);
      // Nezavisno: K nedelja baze + faze standardnog plana od 20 nedelja; osnovna priprema bez kvaliteta i testa,
      // cilj = trenutni obim (rasterećenje svaka četvrta, 0,8 ×), ubrzanja na jednom laganom danu.
      const want = [...Array<string>(K).fill('base'), ...phasesOf(20)];
      if (p.weeks.map((w) => w.phase).join() !== want.join()) bad.push(`${c.id}: faze`);
      for (const w of p.weeks.slice(0, K)) {
        if (!w.prep) bad.push(`${c.id}: ned ${w.index} bez oznake pripreme`);
        if (w.days.some((d) => d.workout.kind === 'quality' || d.workout.kind === 'test'))
          bad.push(`${c.id}: ned ${w.index} ima kvalitet`);
        if (w.deload !== (w.index % 4 === 0)) bad.push(`${c.id}: ned ${w.index} rasterećenje`);
        const t = w.deload ? Math.round(0.8 * c.profile.km * 10) / 10 : c.profile.km;
        if (Math.abs(w.targetKm - t) > 0.1 + EPS)
          bad.push(`${c.id}: ned ${w.index} cilj ${w.targetKm}`);
        const strides = w.days.filter((d) => /ubrzanja/.test(d.workout.title)).length;
        if (!(w.index <= 2 && c.profile.beginner) && strides !== 1)
          bad.push(`${c.id}: ned ${w.index} ubrzanja ${strides}`);
      }
      if (p.weeks.slice(K).some((w) => w.prep)) bad.push(`${c.id}: priprema u standardnom delu`);
      if (p.layout?.kind !== 'long' || p.layout.prepWeeks !== K)
        bad.push(`${c.id}: činjenica rasporeda`);
    }
    expect(rejected).toEqual([]);
    expect(bad).toEqual([]);
  });

  it('standardni deo kreće od trenutnog obima: nedelje K+1.. = plan od 20 nedelja (isti ciljevi i dani)', () => {
    const base = {
      km: 45,
      vdot: 48,
      days: ['tue', 'thu', 'sat', 'sun'] as const,
      long: 'sun' as const
    };
    const r20 = generateHmV2(inputOf({ ...base, days: [...base.days], weeks: 20 }));
    const r24 = generateHmV2(inputOf({ ...base, days: [...base.days], weeks: 24 }));
    if (!r20.ok || !r24.ok) throw new Error('plan');
    expect(r24.plan.weeks[4]!.targetKm).toBe(45);
    expect(r24.plan.weeks.slice(4).map((w) => w.targetKm)).toEqual(
      r20.plan.weeks.map((w) => w.targetKm)
    );
  });
});

describe('W1-C: upozorenje', () => {
  const plan = (weeks: number, beginner = false) => {
    const r = generateHmV2(
      inputOf({
        weeks,
        km: 30,
        days: ['tue', 'thu', 'sat', 'sun'],
        ...(beginner ? { beginner: true, easyPaceSecPerKm: 420 } : { vdot: 45 })
      })
    );
    if (!r.ok) throw new Error(`plan ${weeks}`);
    return r.plan;
  };
  it('tekst za korisnika: padeži broja nedelja, početnik uz svoje upozorenje', () => {
    const msg = (weeks: number, b = false) =>
      plan(weeks, b).warnings.find((w) => w.rule === 'PLAN_LENGTH')?.message;
    expect(msg(1)).toBe(
      'Skraćena priprema: plan ima 1 nedelju, a za pun ciklus za polumaraton preporučuje se najmanje 10. Plan je napravljen za izabrani datum, ali nema vremena za sve faze pripreme i ne garantuje spremnost ni ciljno vreme. Ne nadoknađuj kraći rok naglim povećanjem obima ili intenziteta.'
    );
    expect(msg(3)).toContain('plan ima 3 nedelje,');
    expect(msg(9)).toContain('plan ima 9 nedelja,');
    expect(msg(11, true)).toContain(
      'plan ima 11 nedelja, a za pun ciklus za polumaraton preporučuje se najmanje 12.'
    );
    expect(msg(21)).toBe(
      'Plan je duži od preporučenih 20 nedelja: prva nedelja je osnovna priprema na sadašnjem obimu, a puna priprema za polumaraton počinje u nedelji 2.'
    );
    expect(msg(23)).toContain('prve 3 nedelje su osnovna priprema');
    expect(msg(28)).toContain('prvih 8 nedelja je osnovna priprema');
    expect(msg(41)).toContain('prva 21 nedelja je osnovna priprema');
    expect(msg(10)).toBeUndefined();
    expect(msg(20)).toBeUndefined();
    expect(msg(12, true)).toBeUndefined();
    // Postojeća napomena početnika ostaje uz upozorenje dužine.
    expect(plan(11, true).notes.some((n) => n.startsWith('Početnik (H17)'))).toBe(true);
    for (const n of [1, 9, 21, 52]) expect(warningViolations(plan(n), n)).toEqual([]);
  });
});
