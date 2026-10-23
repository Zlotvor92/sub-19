/* MAR-11 (marathon-v2.7.0): trenerska pravila T1, T2, T3, T6 (C6, C11), T7 i dopuna lanaca (C3, Z8, C8) —
   docs/generators-v2/audit/fixes/03-coach-rules.md, 01-chains-addendum.md. Svaki test pada na b9c4728. */

import { describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { doseRestartWeeks } from './steps.ts';
import {
  adaptAsOfs,
  adaptBases,
  factsOf,
  feelInputs,
  gridInputs,
  painFacts
} from './testInputs.ts';
import type { AdaptResult, MarathonV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';

const planOf = (input: Record<string, unknown>): MarathonV2Plan => {
  const g = generateMarathonV2(input);
  if (!g.ok) throw new Error(JSON.stringify(g.reasons));
  return g.plan;
};
const ok = (r: AdaptResult): MarathonV2Plan => {
  if (!r.ok) throw new Error(JSON.stringify(r.reasons).slice(0, 1500));
  return r.plan;
};
const grid = (id: string): Record<string, unknown> => gridInputs().find((g) => g.id === id)!.input;
const longOf = (w: MarathonV2Plan['weeks'][number]) => w.days.find((d) => d.role === 'long');
const errors = (p: MarathonV2Plan) => validatePlan(p).filter((v) => v.severity === 'error');

describe('T1: lagan ≤ 0,8 × dugi u izgradnji; najkraći max(5 km, 20 min)', () => {
  it('4 dana, 45 km, VDOT 40: svaka nedelja izgradnje lagan ≤ 0,8 × dugi; cilj spušten uz CAPACITY_LIMITED', () => {
    const p = planOf(grid('d4-14w-45km-v40-A-sat'));
    for (const w of p.weeks.filter((x) => x.phase !== 'taper' && x.phase !== 'race' && !x.deload)) {
      const L = longOf(w)!;
      for (const d of w.days.filter((x) => x.role === 'easy'))
        expect(d.workout.km, `ned ${w.index}`).toBeLessThanOrEqual(
          Math.floor(8 * L.workout.km + 1e-9) / 10
        );
    }
    expect(p.warnings.some((v) => v.rule === 'CAPACITY_LIMITED')).toBe(true);
    expect(errors(p)).toEqual([]);
  });
  it('početnik 5 dana, pauza 20 u ned 1: lagan dan postaje odmor (napomena), ne 4 × 5 km + dugi 5 km', () => {
    const b = adaptBases().find((x) => x.id === 'beg-d5-r-16w')!;
    const g = planOf(b.input);
    const asOf = adaptAsOfs(g).find((x) => x.tag === 'w1wed')!.asOf;
    const p = ok(adaptMarathonV2(g, factsOf(g, 'pause20', asOf), asOf));
    const w2 = p.weeks[1]!;
    expect(w2.days.filter((d) => d.role === 'easy').length).toBe(3);
    expect(w2.notes.some((n) => n.includes('odmor umesto laganog dana'))).toBe(true);
    expect(longOf(w2)!.workout.km).toBeGreaterThan(5);
  });
});

describe('T2: u taperu dan MP ne traje duže od dugog iste nedelje', () => {
  it('3 dana, 30 km, VDOT 30 (1b nalaz 3): MP N−1 skraćen do trajanja dugog, doza ne raste', () => {
    const p = planOf(grid('d3-12w-30km-v30-A-sat'));
    for (const w of p.weeks.filter((x) => x.phase === 'taper')) {
      const mp = w.days.find((d) => d.workout.dose?.zone === 'MP')!;
      expect(mp.workout.sec, `ned ${w.index}`).toBeLessThanOrEqual(longOf(w)!.workout.sec);
    }
    const [t0, t1] = p.weeks.filter((x) => x.phase === 'taper');
    const dose = (w: typeof t0) =>
      w!.days.find((d) => d.workout.dose?.zone === 'MP')!.workout.dose!.doseM;
    expect(dose(t1)).toBeLessThanOrEqual(dose(t0));
  });
});

describe('T3: posle novog starta taper zadržava 1 kvalitet, trkačka oštrenje', () => {
  it('4 d, 50 km, VDOT 45, pauza 35 do kraja ned 8: obe nedelje tapera MP, trkačka 2 × 2000 m MP', () => {
    const g = planOf(grid('d4-18w-50km-v45-A-sun'));
    const asOf = g.weeks[7]!.endDate;
    const p = ok(adaptMarathonV2(g, factsOf(g, 'pause35', asOf), asOf));
    expect(p.adaptation!.steps.at(-1)!.restart).toBe(true);
    for (const w of p.weeks.filter((x) => x.phase === 'taper')) {
      expect(w.days.filter((d) => d.workout.dose?.zone === 'MP').length, `ned ${w.index}`).toBe(1);
      expect(w.days.filter((d) => d.workout.kind === 'quality').length, `ned ${w.index}`).toBe(1);
      expect(w.notes.some((n) => n.includes('posle novog starta: jedan kvalitet MP'))).toBe(true);
    }
    expect(p.weeks.at(-1)!.days.some((d) => d.role === 'sharpener')).toBe(true);
  });
});

describe('T6 C6: posle bola progresija doze kreće ispočetka od r + 1', () => {
  it('doseRestartWeeks sadrži r + 1; plan sa bolom 5 u ned 6 prolazi validator', () => {
    const g = planOf(grid('d4-18w-50km-v45-A-sun'));
    const asOf = g.weeks[5]!.endDate;
    const p = ok(adaptMarathonV2(g, painFacts(asOf, 5), asOf));
    const s = p.adaptation!.steps.at(-1)!;
    expect(s.returnFrom).not.toBeNull();
    expect(doseRestartWeeks([s]).has(s.returnFrom!.week + 1)).toBe(true);
    expect(errors(p)).toEqual([]);
  });
});

describe('T6 C11: pouka 35 i u nedelji testa', () => {
  it('po osećaju 4 d, 50 km, skorašnji najduži 8 km: nedelja testa sa danom dužim od dugog — Q2 lagan, test ostaje', () => {
    const c = feelInputs().find((x) => x.id === 'feel-d4-12w-50km-e270-B')!;
    const p = planOf({ ...c.input, recentLongRunKm: 8 });
    const w = p.weeks.find((x) => x.days.some((d) => d.role === 'test'))!;
    const L = longOf(w)!;
    expect(L).toBeDefined();
    expect(w.days.some((d) => d.role === 'q2')).toBe(false);
    expect(w.notes.some((n) => n.startsWith('Q2: dan kvaliteta je lagan'))).toBe(true);
    expect(errors(p)).toEqual([]);
  });
});

describe('T7: skorašnji najduži > trenutni nedeljni obim → odbijanje', () => {
  it('40 km nedeljno, skorašnji najduži 41 km → RECENT_LONG_INVALID sa „proveri unos"', () => {
    const r = checkInput({ ...grid('d4-18w-40km-v45-A-sun'), recentLongRunKm: 41 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons.map((x) => x.code)).toEqual(['RECENT_LONG_INVALID']);
      expect(r.reasons[0]!.message).toMatch(/proveri unos/);
    }
  });
});

describe('Lanci: C3 (zaštićen test + nov rezultat), Z8 (bol vezan za zapise)', () => {
  it('C3 (lanac i=18): plan po osećaju, zaključan dan testa i nov rezultat → prihvaćeno, jedan test', () => {
    const g = planOf(feelInputs().find((c) => c.id === 'feel-d5-23w-70km-e450-C')!.input);
    const td = g.weeks.flatMap((w) => w.days).find((d) => d.role === 'test')!.date;
    const asOf = addDays(td, -14);
    const p = ok(
      adaptMarathonV2(
        g,
        {
          results: [{ distM: 10000, sec: 3818, date: addDays(asOf, -3), kind: 'test' }],
          lockedDayIds: [td]
        },
        asOf
      )
    );
    expect(
      p.weeks
        .flatMap((w) => w.days)
        .filter((d) => d.role === 'test')
        .map((d) => d.date)
    ).toEqual([td]);
  });
  it('C3 (lanac i=175): bol + zaključan dan testa, ista adaptacija ponovo → prihvaćeno, jedan test', () => {
    const g = planOf(feelInputs().find((c) => c.id === 'feel-d3-17w-40km-e450-C')!.input);
    const td = g.weeks.flatMap((w) => w.days).find((d) => d.role === 'test')!.date;
    const asOf = addDays(td, -3);
    const f = { ...painFacts(asOf, 9), lockedDayIds: [td] };
    const a1 = ok(adaptMarathonV2(g, f, asOf));
    const a2 = ok(adaptMarathonV2(a1, f, asOf));
    expect(
      a2.weeks
        .flatMap((w) => w.days)
        .filter((d) => d.role === 'test')
        .map((d) => d.date)
    ).toEqual([td]);
  });
  it('Z8: ista adaptacija bola dvaput i „sutra bez novih zapisa" ne seku cilj ponovo', () => {
    const g = planOf(grid('d4-18w-50km-v45-A-sun'));
    const sat = addDays(g.weeks[5]!.endDate, -1);
    const f = painFacts(sat, 5);
    const a1 = ok(adaptMarathonV2(g, f, sat));
    const a2 = ok(adaptMarathonV2(a1, f, sat));
    expect(a2.weeks.map((w) => w.targetKm)).toEqual(a1.weeks.map((w) => w.targetKm));
    const a3 = ok(adaptMarathonV2(a1, f, addDays(sat, 1)));
    expect(a3.weeks.map((w) => w.targetKm)).toEqual(a1.weeks.map((w) => w.targetKm));
  });
});

describe('C8: mešovita nedelja čiji je vlasnik pravilo pauze — upozorenje kad je planirano > cilj', () => {
  it('pauza 14 dana (potpuna pokrivenost) + zaključan dugi 23,6 km → MIXED_WEEK_OVER za tu nedelju', () => {
    const g = planOf(grid('d5-21w-45km-v55-A-sat'));
    const w = g.weeks[9]!;
    const long = longOf(w)!;
    const asOf = addDays(w.startDate, 1);
    const p = ok(
      adaptMarathonV2(
        g,
        {
          coverage: { from: addDays(asOf, -13), to: asOf, complete: true },
          workouts: [],
          lockedDayIds: [long.date]
        },
        asOf
      )
    );
    const x = p.weeks[9]!;
    expect(x.plannedKm).toBeGreaterThan(x.targetKm);
    expect(p.warnings.some((v) => v.rule === 'MIXED_WEEK_OVER' && v.week === 10)).toBe(true);
  });
});
