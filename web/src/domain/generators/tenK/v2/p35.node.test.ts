/* Segment 06f (10k-v2.6.0): pouka 35 — dva dana kvaliteta samo kad dugi ostaje najduži. Jedno mesto odluke
   (week.ts buildWeek, predikat qualityOverLong), validator čita isti predikat. Na 7ba9717: 2022 nedelje u 966
   planova mreža 01/02/F (segment06f.p35-plans-7ba9717.json; 858 različitih ulaza) — tačno ti planovi se menjaju
   (regresije grid/feelGrid), u svakom od njih prva promenjena nedelja je nedelja pouke 35 (izveštaj 06f). */

import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { generateTenKV2 } from './generate.ts';
import { P35_PLANS } from './level.harness.node.test.ts';
import {
  beginnerGridInputs,
  feelGridInputs,
  grid02Inputs,
  gridInputs,
  inputOf,
  SCHEDULES_BY_DAYS
} from './testInputs.ts';
import type { PlanWeek, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { P35_DROP, P35_KEEP, qualityOverLong } from './week.ts';

const BUILD = new Set(['base', 'development', 'specific']);
const steady = (w: PlanWeek): boolean => BUILD.has(w.phase) && !w.deload;
const p35 = (w: PlanWeek): boolean => w.notes.some((n) => n.startsWith(P35_DROP));
const planOf = (days: 3 | 4 | 5 | 6, o: { weeks: number; km: number; vdot: number }) => {
  const sc = SCHEDULES_BY_DAYS[days].A;
  const r = generateTenKV2(inputOf({ ...o, days: sc.days, long: sc.long }));
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const rules = (p: TenKV2Plan, w: number) =>
  validatePlan(p)
    .filter((v) => v.week === w)
    .map((v) => `${v.severity}:${v.rule}`);

describe('pouka 35 u generatoru', () => {
  it('10 ned, 25 km, VDOT 70, 4 dana: ned 1 — T dan je lagan, dugi 5,6 → 8,2 km (34 min) duži od R dana (32 min)', () => {
    const p = planOf(4, { weeks: 10, km: 25, vdot: 70 });
    const w = p.weeks[0]!;
    expect(w.days.map((d) => d.role).sort()).toEqual(['easy', 'easy', 'long', 'q1']);
    const long = w.days.find((d) => d.role === 'long')!.workout;
    const q1 = w.days.find((d) => d.role === 'q1')!.workout;
    expect([long.km, Math.round(long.sec / 60), Math.round(q1.sec / 60)]).toEqual([8.2, 34, 32]);
    expect(w.targetKm).toBe(25);
    expect(w.notes.find((n) => n.startsWith(P35_DROP))).toBe(
      `${P35_DROP} (WU 15 min + T 2,0 km kontinuirano + CD 10 min) je lagan — sa dva dana kvaliteta dan kvaliteta bio bi duži od dugog.`
    );
    // Ned 3: dva dana kvaliteta, dugi najduži.
    expect(qualityOverLong(p.weeks[2]!.days)).toBe(false);
    expect(p.weeks[2]!.days.filter((d) => d.workout.kind === 'quality')).toHaveLength(2);
  });

  it('6 dana, 35 km, VDOT 70: prvi dan kvaliteta i dalje duži od dugog → napomena + upozorenje D25', () => {
    const p = planOf(6, { weeks: 12, km: 35, vdot: 70 });
    const w = p.weeks[0]!;
    expect(w.notes.find((n) => n.startsWith(P35_DROP))).toMatch(
      /prvi dan kvaliteta i dalje traje duže od dugog \(D25/
    );
    expect(p.warnings.some((v) => v.rule === 'LONG_SHORTER_THAN_QUALITY')).toBe(true);
  });

  it(`planovi pouke 35 sa 7ba9717 (${P35_PLANS.size}) — nijedna nedelja izgradnje sa 2 dana kvaliteta i danom kvaliteta dužim od dugog; ${FULL ? 'pun: sve mreže' : 'brz: ti planovi'}`, () => {
    const all = [
      ...gridInputs(),
      ...([3, 4, 5, 6] as const).flatMap((d) => grid02Inputs(d)),
      ...([3, 4, 5, 6] as const).flatMap((d) => feelGridInputs(d)),
      ...([3, 4] as const).flatMap((d) => beginnerGridInputs(d))
    ];
    const cases = FULL ? all : all.filter((c) => P35_PLANS.has(c.id));
    expect(cases.length).toBeGreaterThanOrEqual(P35_PLANS.size);
    const bad: string[] = [];
    let dropped = 0;
    for (const c of cases) {
      const r = generateTenKV2(c.input);
      if (!r.ok) {
        bad.push(`${c.id}: odbijen`);
        continue;
      }
      for (const w of r.plan.weeks.filter(steady)) {
        if (qualityOverLong(w.days)) bad.push(`${c.id} ned ${w.index}`);
        if (p35(w)) dropped++;
      }
      if (P35_PLANS.has(c.id) && !r.plan.weeks.some(p35)) bad.push(`${c.id}: bez pouke 35`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
    // Nedelje sa drugim danom kvaliteta laganim (na 7ba9717 2022 nedelje sa 2 kvaliteta dužim od dugog; posle prve
    // takve nedelje progresija q2 kreće kasnije, pa deo kasnijih ne treba): isto u brzom i punom nivou.
    expect(dropped).toBe(1854);
  });
});

describe('pouka 35 u validatoru (isti predikat)', () => {
  const p = planOf(4, { weeks: 10, km: 25, vdot: 70 });

  it('plan generatora: bez grešaka', () => {
    expect(validatePlan(p).filter((v) => v.severity === 'error')).toEqual([]);
  });

  it('nedelja sa 2 dana kvaliteta i danom kvaliteta dužim od dugog → QUALITY_OVER_LONG; uz napomenu P35_KEEP → upozorenje', () => {
    const i = 2;
    const longer = (keep: boolean): TenKV2Plan => ({
      ...p,
      weeks: p.weeks.map((w, k) =>
        k !== i
          ? w
          : {
              ...w,
              notes: keep ? [...w.notes, P35_KEEP] : w.notes,
              days: w.days.map((d) =>
                d.role === 'q1' ? { ...d, workout: { ...d.workout, sec: 99999 } } : d
              )
            }
      )
    });
    expect(rules(longer(false), i + 1)).toContain('error:QUALITY_OVER_LONG');
    expect(rules(longer(true), i + 1)).toContain('warning:TWO_QUALITY_LONGER');
    expect(rules(longer(true), i + 1)).not.toContain('error:QUALITY_OVER_LONG');
  });

  it('drugi dan kvaliteta lagan bez napomene pouke 35 → ROLES (validator čita odluku konstruktora)', () => {
    const noNote: TenKV2Plan = {
      ...p,
      weeks: p.weeks.map((w, k) =>
        k !== 0 ? w : { ...w, notes: w.notes.filter((n) => !p35({ ...w, notes: [n] })) }
      )
    };
    expect(rules(noNote, 1)).toContain('error:ROLES');
  });
});
