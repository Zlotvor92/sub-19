/* HM v2 Segment HM-07 (hm-v2.4.0, Faza 4a): pouka 35 (dva dana kvaliteta samo uz najduži dugi), pod RP (N6), dopuna
   pouke 34 (N7 doza ned 2, N10.3 dugi reference u L), jedna definicija (N9: LONG_RUN_SHORT preko svih nedelja),
   ponavljanje doze kao upozorenje (N10.1), upozorenja jednom po planu (N11), traka u domenu (pouka 20). */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { adaptBanner, adaptHmV2 } from './adapt.ts';
import { adaptBases, factsOf } from './adaptInputs.ts';
import { addDays } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import { isBuildPhase } from './periodize.ts';
import { beginnerInputs, feelInputs, grid02Inputs } from './testInputs.ts';
import type { AdaptResult, HmV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { userWeekNotes } from './volume.ts';
import { SECOND_EASY_NOTE } from './week.ts';
import { longWorkout, qualityWorkout, warmupCooldown } from './workouts.ts';

const DIR = dirname(fileURLToPath(import.meta.url));
const plans = new Map<string, HmV2Plan>();
const plan = (id: string): HmV2Plan => {
  let p = plans.get(id);
  if (!p) {
    const b = [...adaptBases(), ...grid02Inputs(), ...feelInputs(), ...beginnerInputs()].find(
      (x) => x.id === id
    );
    if (!b) throw new Error(id);
    const r = generateHmV2(b.input);
    if (!r.ok) throw new Error(`${id}: ${JSON.stringify(r.reasons)}`);
    plans.set(id, (p = r.plan));
  }
  return p;
};
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const errors = (p: HmV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const clone = (p: HmV2Plan): HmV2Plan => JSON.parse(JSON.stringify(p)) as HmV2Plan;
const wedOf = (w: PlanWeek): string => {
  let d = w.startDate;
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 3) d = addDays(d, 1);
  return d;
};
/** Nedelje izgradnje (bez mešovitih) sa dva dana kvaliteta/testa i danom dužim od dugog. */
const twoOverLong = (p: HmV2Plan): number[] => {
  const mixed = new Set(p.adaptation?.mixedWeeks ?? []);
  return p.weeks
    .filter((w) => isBuildPhase(w.phase) && !w.deload && !mixed.has(w.index))
    .filter((w) => {
      const long = w.days.find((d) => d.role === 'long');
      const hard = w.days.filter((d) => d.workout.kind === 'quality' || d.workout.kind === 'test');
      return !!long && hard.length === 2 && hard.some((d) => d.workout.sec > long.workout.sec);
    })
    .map((w) => w.index);
};
const secondEasy = (w: PlanWeek): boolean => w.notes.some((n) => n.includes(SECOND_EASY_NOTE));

describe('pouka 35 (N5): dva dana kvaliteta samo kad dugi ostaje najduži', () => {
  it('generator: drugi dan kvaliteta lagan (napomena), prvi ostaje, dugi raste; validator čita istu funkciju', () => {
    const p = plan('d6-10w-40km-v60-A-sat');
    expect(errors(p)).toEqual([]);
    expect(twoOverLong(p)).toEqual([]);
    const w = p.weeks.find(secondEasy)!;
    expect(w.days.find((d) => d.weekday === p.pattern.q2)!.role).toBe('easy');
    expect(w.days.some((d) => d.role === 'q1')).toBe(true);
    // Vraćen drugi dan kvaliteta (dugi kraći od dana) → greška; napomena bez razloga → greška.
    const a = clone(p);
    const wa = a.weeks[w.index - 1]!;
    const q2 = wa.days.find((d) => d.weekday === p.pattern.q2)!;
    const next = a.weeks.slice(w.index).find((x) => x.days.some((d) => d.role === 'q2'))!;
    const dose = next.days.find((d) => d.role === 'q2')!.workout.dose!;
    q2.role = 'q2';
    q2.hard = true;
    q2.workout = qualityWorkout(dose, a.paces, warmupCooldown(a.input.currentWeeklyKm));
    wa.notes = wa.notes.filter((n) => !n.includes(SECOND_EASY_NOTE));
    expect(errors(a)).toContain('SECOND_QUALITY');
    const b = clone(p);
    const wb = b.weeks.find((x) => isBuildPhase(x.phase) && !x.deload && x.index > 2)!;
    wb.notes.push(`Q2: ${SECOND_EASY_NOTE}.`);
    expect(errors(b)).toContain('SECOND_QUALITY');
  });

  it('adaptacija: pauza 35 (nov start) — nijedna nedelja izgradnje sa dva kvaliteta i danom dužim od dugog', () => {
    for (const [id, wk] of [
      ['d4-r-14w', 1],
      ['d4-r-14w', 8],
      ['d6-r-18w', 4]
    ] as const) {
      const p = plan(id);
      const at = p.weeks[wk - 1]!.endDate;
      const r = ok(adaptHmV2(p, factsOf(p, 'pause35', at), at));
      expect(errors(r.plan), `${id} ${wk}`).toEqual([]);
      expect(twoOverLong(r.plan), `${id} ${wk}`).toEqual([]);
    }
  });
});

describe('N6: RP nikad ispod najnižeg nivoa (2 × 2000 m)', () => {
  it('d3-11w-40km-v70-A-sun, pauza 35 kraj ned 3: bez RP < 4000 m (bilo „RP 2,0 km kontinuirano"); validator RP_FLOOR', () => {
    const p = plan('d3-11w-40km-v70-A-sun');
    const at = p.weeks[2]!.endDate;
    const r = ok(adaptHmV2(p, factsOf(p, 'pause35', at), at));
    const rp = r.plan.weeks.flatMap((w) =>
      w.days.filter((d) => d.workout.dose?.zone === 'RP').map((d) => d.workout.dose!.doseM)
    );
    expect(rp.length).toBeGreaterThan(0);
    expect(rp.filter((m) => m < 4000)).toEqual([]);
    const a = clone(r.plan);
    const d = a.weeks.flatMap((w) => w.days).find((x) => x.workout.dose?.zone === 'RP')!;
    d.workout.dose = { ...d.workout.dose!, doseM: 2000 };
    expect(errors(a)).toContain('RP_FLOOR');
  });
});

describe('N10.3: dugi reference umora pre starta ulazi u L pouke 28 kao nedelja 0', () => {
  it('ned 2 sme do granice iz dugog planirane ned 1 (ne iz skraćenog dugog rasterećenja ned 1)', () => {
    const p = plan('d4-r-14w');
    const at = addDays(p.input.startDate, -3);
    const r = ok(adaptHmV2(p, factsOf(p, 'fatigue', at), at));
    const long = (w: PlanWeek) => w.days.find((d) => d.role === 'long')!.workout.km;
    expect(long(r.plan.weeks[0]!)).toBeLessThan(long(p.weeks[0]!));
    expect(long(r.plan.weeks[1]!)).toBe(long(p.weeks[0]!));
    expect(errors(r.plan)).toEqual([]);
  });
});

describe('N9: LONG_RUN_SHORT preko SVIH nedelja plana (i mešovitih)', () => {
  it('d4-11w-35km-v50-B-sat, bol 5 sreda ned 4: najduži 16,6 ≥ 16 → bez upozorenja (bilo lažno)', () => {
    const p = plan('d4-11w-35km-v50-B-sat');
    const at = wedOf(p.weeks[3]!);
    const r = ok(adaptHmV2(p, factsOf(p, 'pain5', at), at));
    const longest = Math.max(
      ...r.plan.weeks.flatMap((w) =>
        w.days.filter((d) => d.role === 'long').map((d) => d.workout.km)
      )
    );
    expect(longest).toBeGreaterThanOrEqual(16);
    expect(r.plan.warnings.map((v) => v.rule)).not.toContain('LONG_RUN_SHORT');
  });
});

describe('N10.1: ponavljanje doze — upozorenje IDENTICAL_WEEKS kad ni druga struktura ni sledeći nivo ne staju', () => {
  it('početnik 4 d, 20 km, manjak 50 % na kraju ned 1: T ponovljen → upozorenje (bilo tiho)', () => {
    const p = plan('b-d4-12w-20km-e330-B');
    const at = p.weeks[0]!.endDate;
    const r = ok(adaptHmV2(p, factsOf(p, 'under50', at), at));
    expect(errors(r.plan)).toEqual([]);
    expect(r.plan.weeks.some((w) => w.notes.some((n) => n.includes('ponovljen')))).toBe(true);
    expect(r.plan.warnings.map((v) => v.rule)).toContain('IDENTICAL_WEEKS');
  });
});

describe('N11: upozorenja jednom po planu; tehnička napomena ne ide korisniku', () => {
  it('cele mreže (uzorak): WEEK_FITTED, CAPACITY_LIMITED, DELOAD_LONG_SHORTENED najviše jednom; plan bez napomene kapaciteta', () => {
    const ins = [...grid02Inputs(), ...feelInputs(), ...beginnerInputs()].filter(
      (_, i) => i % 23 === 0
    );
    let fitted = 0;
    for (const g of ins) {
      const r = generateHmV2(g.input);
      if (!r.ok) continue;
      const rules = r.plan.warnings.map((v) => v.rule);
      for (const x of ['WEEK_FITTED', 'CAPACITY_LIMITED', 'DELOAD_LONG_SHORTENED'])
        expect(rules.filter((y) => y === x).length, `${g.id} ${x}`).toBeLessThanOrEqual(1);
      const fw = r.plan.weeks.filter((w) => w.fitted !== null);
      expect(rules.includes('WEEK_FITTED'), g.id).toBe(fw.length > 0);
      if (fw.length > 0) {
        fitted++;
        expect(r.plan.warnings.find((v) => v.rule === 'WEEK_FITTED')!.message).toContain(
          `nedelje ${fw.map((w) => w.index).join(', ')}`
        );
      }
      expect(r.plan.notes.some((n) => n.includes('ne nose ovaj obim'))).toBe(false);
      for (const w of r.plan.weeks)
        expect(userWeekNotes(w).some((n) => n.includes('nije izvodljiv u konstrukciji'))).toBe(
          false
        );
    }
    expect(fitted).toBeGreaterThan(0);
  });
});

describe('pouka 20: traka u domenu (adaptBanner), aplikacija samo zove', () => {
  it('pravilo trake: promena posle asOf; ograničenje samo novo; bol samo uz nov zapis; isti dan posle primene — ništa', () => {
    const p = plan('d4-r-14w');
    const a = wedOf(p.weeks[3]!);
    const pain = { workouts: [{ date: a, km: 0, durationSec: 0, completed: false, pain: 6 }] };
    const r1 = adaptHmV2(p, pain, a);
    expect(adaptBanner(p, r1, pain, a)).toHaveLength(1);
    const p1 = ok(r1).plan;
    expect(adaptBanner(p1, adaptHmV2(p1, pain, a), pain, a)).toEqual([]);
    const b = addDays(a, 1);
    expect(adaptBanner(p1, adaptHmV2(p1, pain, b), pain, b)).toEqual([]);
    const at = p.weeks[5]!.endDate;
    const pause = factsOf(p, 'pause20', at);
    expect(adaptBanner(p, adaptHmV2(p, pause, at), pause, at).length).toBeGreaterThan(0);
    expect(adaptBanner(p, adaptHmV2(p, {}, at), {}, at)).toEqual([]);
  });

  it('aplikacija nema svoje pravilo trake (jedno mesto): app/adapt.ts zove domen', () => {
    const src = readFileSync(join(DIR, 'app', 'adapt.ts'), 'utf8');
    expect(src).toContain("import { adaptBanner, adaptHmV2 } from '../adapt.ts';");
    expect(src).not.toMatch(/function adaptBanner|newLimits|LIMIT\.has|CHANGE\.has/);
  });
});

describe('dugi tapera i najduži dugi (N9): jedna funkcija', () => {
  it('generator: dugi tapera ≤ 0,6 × najduži dugi pre tapera (lengths.longestLong10)', () => {
    const p = plan('d4-r-14w');
    const i = p.weeks.findIndex((w) => w.phase === 'taper');
    const longest = Math.max(
      ...p.weeks
        .slice(0, i)
        .flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
    );
    const tl = p.weeks[i]!.days.find((d) => d.role === 'long')!;
    expect(tl.workout.km).toBeLessThanOrEqual(Math.floor(6 * longest) / 10);
    expect(longWorkout(tl.workout.km, p.paces).km).toBe(tl.workout.km);
  });
});
