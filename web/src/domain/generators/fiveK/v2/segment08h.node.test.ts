/* Segment 08h (5k-v2.8.1): pouka 35 u 5K — nedelja izgradnje sa dva dana kvaliteta u kojoj bi dan kvaliteta bio duži
   od dugog → drugi dan kvaliteta lagan (week.secondQualityEasy, jedino mesto; validator čita istu funkciju).
   e41defc: 88 / 3816 planova mreže generatora (npr. f-d4-6w-15km-e300-0 ned 1: usponi 20 min > dugi 18 min). */

import { describe, expect, it } from 'vitest';
import { generateFiveKV2 } from './generate.ts';
import { earlyGridInputs } from './testInputs.ts';
import type { FiveKV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { SECOND_EASY_NOTE } from './week.ts';

const S = JSON.stringify;
const planOf = (id: string): FiveKV2Plan => {
  const g = generateFiveKV2(earlyGridInputs().find((x) => x.id === id)!.input);
  if (!g.ok) throw new Error(id);
  return g.plan as FiveKV2Plan;
};
const errRules = (p: FiveKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const isBuild = (w: PlanWeek): boolean => ['base', 'peak', 'sharpen'].includes(w.phase);

describe('08h pouka 35 — dugi ostaje najduži u nedelji izgradnje', () => {
  const p = planOf('f-d4-6w-15km-e300-0');
  const w1 = p.weeks[0]!;
  it('f-d4-6w-15km-e300-0 ned 1: drugi dan kvaliteta lagan (napomena), jedan kvalitet, dugi ≥ svaki dan kvaliteta', () => {
    expect(w1.notes.some((n) => n.includes(SECOND_EASY_NOTE))).toBe(true);
    const q = w1.days.filter((d) => d.workout.kind === 'quality');
    const long = w1.days.find((d) => d.role === 'long')!;
    expect(q.length).toBe(1);
    expect(q.every((d) => d.workout.sec <= long.workout.sec)).toBe(true);
    expect(validatePlan(p).filter((v) => v.severity === 'error')).toEqual([]);
  });
  it('mreža generatora: nijedna nedelja izgradnje sa dva dana kvaliteta nema dan kvaliteta duži od dugog', () => {
    const bad: string[] = [];
    for (const b of earlyGridInputs().filter((_, i) => i % 7 === 0)) {
      const g = generateFiveKV2(b.input);
      if (!g.ok || 'planType' in g.plan) continue;
      for (const w of g.plan.weeks.filter(isBuild)) {
        const q = w.days.filter((d) => d.workout.kind === 'quality');
        const long = w.days.find((d) => d.role === 'long');
        if (q.length === 2 && long && q.some((d) => d.workout.sec > long.workout.sec))
          bad.push(`${b.id} ned ${w.index}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('validator: dva dana kvaliteta kad bi dugi bio kraći → SECOND_QUALITY; oznaka bez drugog dana → ROLES', () => {
    const t = JSON.parse(S(p)) as FiveKV2Plan;
    const w = t.weeks[0]!;
    const q1 = w.days.find((d) => d.role === 'q1')!;
    const q2day = p.pattern.q2!;
    // Drugi dan kvaliteta duži od dugog (1 h): sa njim dugi ne bi bio najduži.
    w.days = w.days.map((d) =>
      d.weekday === q2day
        ? { ...d, role: 'q2', hard: true, workout: { ...q1.workout, sec: 3600 } }
        : d
    );
    w.notes = w.notes.filter((n) => !n.includes(SECOND_EASY_NOTE));
    w.plannedKm =
      Math.round(w.days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0) * 100) / 100;
    expect(errRules(t)).toContain('SECOND_QUALITY');
    const u = JSON.parse(S(p)) as FiveKV2Plan;
    u.weeks[0]!.notes = u.weeks[0]!.notes.filter((n) => !n.includes(SECOND_EASY_NOTE));
    expect(errRules(u)).toContain('ROLES');
  });
});
