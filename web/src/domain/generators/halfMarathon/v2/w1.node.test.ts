/* W1 (hm-v2.15.0) — plan za bilo koji broj nedelja, uz upozorenje (docs/generators-v2/perfection/briefs/
   W1-bilo-koja-duzina-plana.md). Nezavisne invarijante (brojevi iz odluka, ne iz koda generatora): plan postoji (0
   odbijanja zbog dužine, 0 padova validatora), trkačka nedelja je poslednja, nema nedelje ispod minimuma reda H15,
   nema praznog treninga, dugi ≥ svaki lagan (AGENTS.md uslov 8). Mreža W1-D: N ∈ {1, 2, 3, MIN − 1} i {MAX + 1,
   MAX + 8, 52} × osnovni profili (redovan sa rezultatom, po osećaju, početnik; 3–6 dana; mali i veliki obim). */

import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import type { IsoDate } from '../../../date';
import type { GenPlanState } from '../../../state';
import * as select from '../../select';
import { adaptHmV2 } from './adapt.ts';
import { factsOf } from './adaptInputs.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { generatedPlan, storedPlan } from './app/plan.ts';
import { addDays } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import { layoutOf, phasesOf } from './periodize.ts';
import { inputOf } from './testInputs.ts';
import type { HmV2Plan } from './types.ts';
import { EPS, w1Cases, w1Violations, warningViolations } from './w1Invariants.ts';

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

/* W1-D: adaptacija i prenos plana nastalog po W1-A/B — raspored se čita iz upisanog plana (pouka 29). */
const SCEN = [
  'none',
  'done100',
  'under50',
  'pause20',
  'pause35',
  'pain8',
  'fatigue',
  'test5k',
  'faster'
] as const;
const D_NS = [1, 2, 3, 9, 11, 21, 28, 52];
const dCases = w1Cases(D_NS).filter((c) => !(c.profile.weeks === 11 && !c.profile.beginner));

describe('W1-D: adaptacija i prenos', () => {
  const cases = FULL ? dCases : dCases.filter((_, i) => i % 9 === 0);
  it(`mreža adaptacije: ${cases.length} planova × asOf × ${SCEN.length} scenarija — 0 odbijanja, invarijante adaptacije`, () => {
    const rejected: string[] = [];
    const bad: string[] = [];
    let n = 0;
    for (const c of cases) {
      const g = generateHmV2(inputOf(c.profile));
      if (!g.ok) {
        rejected.push(`${c.id}: generator`);
        continue;
      }
      const p = g.plan;
      const W = p.weeks;
      const wed = (i: number) => addDays(W[i - 1]!.startDate, 2);
      const ats = [
        ...new Set([
          wed(1),
          ...(W.length > 1 ? [W[0]!.endDate] : []),
          wed(Math.ceil(W.length / 2)),
          ...(W.length > 2 ? [W[W.length - 3]!.endDate] : [])
        ])
      ].filter((a) => a < p.input.raceDate);
      for (const at of ats)
        for (const s of FULL ? SCEN : SCEN.filter((_, i) => i % 2 === 0)) {
          n++;
          const facts = factsOf(p, s, at);
          const r = adaptHmV2(p, facts, at);
          if (!r.ok) {
            rejected.push(`${c.id} ${at} ${s}: ${r.reasons.map((x) => x.code).join(',')}`);
            continue;
          }
          for (const v of adaptInvariants(p, r.plan, at, facts))
            bad.push(`${c.id} ${at} ${s}: ${v}`);
          // Pouka 29: činjenica rasporeda ostaje činjenica upisanog plana.
          if (JSON.stringify(r.plan.layout ?? null) !== JSON.stringify(p.layout ?? null))
            bad.push(`${c.id} ${at} ${s}: raspored`);
          if (r.plan.weeks.length !== W.length || r.plan.weeks.at(-1)!.phase !== 'race')
            bad.push(`${c.id} ${at} ${s}: trkačka nedelja`);
        }
    }
    expect(n).toBeGreaterThan(0);
    expect(rejected).toEqual([]);
    expect(bad).toEqual([]);
  });

  it('raspored adaptacije je činjenica upisanog plana, ne računa se ponovo iz dužine', () => {
    // Činjenica drugačija od tekuće odluke dužine određuje raspored.
    expect(layoutOf(5, false, { kind: 'short', fullWeeks: 12 })!.phases).toEqual(
      phasesOf(12).slice(7)
    );
    expect(layoutOf(5, false)!.phases).toEqual(phasesOf(10).slice(5));
    expect(layoutOf(24, false, { kind: 'long', prepWeeks: 2 })!.phases).toEqual([
      'base',
      'base',
      ...phasesOf(22)
    ]);
    // Plan dužine [MIN, MAX] (činjenica null) — kao pre.
    expect(layoutOf(14, false, null)!.phases).toEqual(phasesOf(14));
    // Adaptacija plana sa upisanom činjenicom (npr. iz ranije politike sa MIN 12) gradi budućnost po njoj.
    const g = generateHmV2(
      inputOf({ weeks: 7, km: 40, vdot: 45, days: ['tue', 'thu', 'sat', 'sun'] })
    );
    if (!g.ok) throw new Error('plan');
    const old = { ...g.plan, layout: { kind: 'short' as const, fullWeeks: 12 } };
    const at = addDays(g.plan.weeks[0]!.startDate, 2);
    const r = adaptHmV2(old, factsOf(old, 'none', at), at);
    if (!r.ok) throw new Error(r.reasons.map((x) => x.message).join(' | '));
    expect(r.plan.layout).toEqual({ kind: 'short', fullWeeks: 12 });
    expect(r.plan.weeks.map((w) => w.phase)).toEqual(phasesOf(12).slice(5));
    expect(phasesOf(12).slice(5)).not.toEqual(g.plan.weeks.map((w) => w.phase));
  });

  it('prenos: plan W1 kao izvor ne šalje svoju politiku (osnova bez politike)', () => {
    for (const weeks of [3, 28]) {
      const g = generateHmV2(
        inputOf({ weeks, km: 35, vdot: 42, days: ['tue', 'thu', 'sun'], long: 'sun' })
      );
      if (!g.ok) throw new Error('plan');
      const at = addDays(g.plan.weeks[0]!.startDate, 9);
      const r = adaptHmV2(g.plan, factsOf(g.plan, 'pause35', at), at);
      if (!r.ok) throw new Error('adaptacija');
      const st = select.stampForStorage(
        storedPlan(generatedPlan(r.plan)) as unknown as GenPlanState
      );
      const prep = select.preparationForPlan(st);
      expect(prep).not.toBeNull();
      const basis = prep!.basisFromPlan(st, at as IsoDate);
      if (basis) expect(basis.policy).toBeNull();
    }
  });
});
