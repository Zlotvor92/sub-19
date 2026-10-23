/* MAR-07 (marathon-v2.4.0, Faza 4a): N1 trkačka nedelja samo sa trkom (RACE_WEEK_SHORT, ne EMPTY_WEEK); pouka 35
   (dva dana kvaliteta samo kad dugi ostaje najduži); pouka 36 (umor vezan za zapise); N8 (validator čita stanje
   upisane mešovite nedelje); N9 (jedna definicija po veličini); N10.5 (pouka 14: preporuka manje dana); N11
   (upozorenja: MARATHON_LONG_SHORT samo kad dugi nije na 150 min, tehnička napomena, CAPACITY_LIMITED i
   DELOAD_LONG_SHORTENED jednom po planu). Na 7ba9717 (marathon-v2.3.1) testovi N1, 35, 36, N8, N9, N10.5 i N11 padaju. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { adaptBanner, adaptMarathonV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { longTimeCapNote } from './lengths.ts';
import {
  adaptBases,
  beginnerInputs,
  factsOf,
  gridInputs,
  inputOf,
  painFacts,
  recentInputs
} from './testInputs.ts';
import type { AdaptResult, MarathonV2Facts, MarathonV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { generatedPlan } from './app/plan.ts';
import { longWorkout } from './workouts.ts';

const planOf = (input: Record<string, unknown>): MarathonV2Plan => {
  const r = generateMarathonV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const errors = (p: MarathonV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => `${v.rule}@${v.week ?? '-'}`);
const rules = (p: MarathonV2Plan): string[] => p.warnings.map((v) => v.rule);
const BUILD = ['base', 'development', 'specific'];
const steady = (w: PlanWeek): boolean => BUILD.includes(w.phase) && !w.deload;
const grid = (id: string): Record<string, unknown> => gridInputs().find((x) => x.id === id)!.input;
const base = (id: string): Record<string, unknown> => adaptBases().find((x) => x.id === id)!.input;

describe('N1 (pouka 30): trkačka nedelja samo sa trkom — RACE_WEEK_SHORT, ne EMPTY_WEEK', () => {
  // Organizator: 3 d, bol 7/8 poslednji dan ned N − 1 → 148/892 toka (svaki 7. plan gridInputs) odbijeno.
  it.each([7, 8])(
    'd3-13w-35km-v40-C-sun, bol %i u nedelju N − 1: plan se vraća, trkačka ima samo trku',
    (lvl) => {
      const p = planOf(grid('d3-13w-35km-v40-C-sun'));
      const N = p.weeks.length;
      const at = p.weeks[N - 2]!.endDate;
      const f = painFacts(at, lvl);
      const r = ok(adaptMarathonV2(p, f, at));
      const rw = r.plan.weeks[N - 1]!;
      expect(rw.days.map((d) => d.role)).toEqual(['race']);
      expect(rw.limits?.rest?.length).toBeGreaterThan(0);
      expect(rules(r.plan)).toContain('RACE_WEEK_SHORT');
      expect(adaptInvariants(p, r.plan, at, f as MarathonV2Facts)).toEqual([]);
    }
  );

  it('prazna nedelja van tog izuzetka ostaje greška (EMPTY_WEEK)', () => {
    const p = planOf(grid('d3-13w-35km-v40-C-sun'));
    const q = structuredClone(p);
    q.weeks[3]!.days = [];
    q.weeks[3]!.plannedKm = 0;
    expect(errors(q)).toContain('EMPTY_WEEK@4');
    // MAR-09 t. 1: trkačka nedelja nikad nije prazna (ima trku) — jedna definicija (week.raceOnlyWeek); trkačka samo
    // sa trkom bez dana odmora koraka/pouke 30 obara RACE_WEEK (dani ≠ M8), ne EMPTY_WEEK.
    const r = structuredClone(p);
    const rw = r.weeks.at(-1)!;
    rw.days = rw.days.filter((d) => d.role === 'race');
    rw.plannedKm = 0;
    rw.targetKm = 0;
    expect(errors(r)).toContain(`RACE_WEEK@${rw.index}`);
    expect(errors(r)).not.toContain(`EMPTY_WEEK@${rw.index}`);
  });
});

/** Nedelje izgradnje sa dva dana kvaliteta u kojima je neki dan kvaliteta duži od dugog. */
const twoQOver = (p: MarathonV2Plan): PlanWeek[] =>
  p.weeks.filter((w) => {
    const L = w.days.find((d) => d.role === 'long');
    const qs = w.days.filter((d) => d.workout.kind === 'quality');
    return steady(w) && L && qs.length === 2 && qs.some((d) => d.workout.sec > L.workout.sec);
  });
const easy35 = (w: PlanWeek): boolean => w.notes.some((n) => n.endsWith('(pouka 35).'));

describe('pouka 35: dva dana kvaliteta samo kad dugi ostaje najduži', () => {
  it('generator (M13a, kratak skorašnji dugi): drugi dan kvaliteta lagan, dugi raste; inače nedelja sa jednim kvalitetom nije izvodljiva', () => {
    const p = planOf(recentInputs().find((x) => x.id === 'recent-d5-16w-70km-v45-C-r5')!.input);
    const w = p.weeks.find(easy35)!;
    expect(w).toBeDefined();
    expect(w.days.filter((d) => d.role === 'q2')).toEqual([]);
    expect(
      w.days.find((d) => d.date === w.days.find((x) => x.weekday === p.pattern.q2)?.date)?.role
    ).toBe('easy');
    expect(errors(p)).toEqual([]);
    // Preostale nedelje sa dva kvaliteta i danom dužim od dugog: nedelja sa jednim kvalitetom nije izvodljiva
    // (validator, ista funkcija: QUALITY_DAYS bi oborio plan) — upozorenje pouke 14.
    if (twoQOver(p).length > 0) expect(rules(p)).toContain('LONG_SHORTER_THAN_QUALITY');
  });

  it('adaptacija (pauza 35, nov start): nedelja izgradnje sa dva kvaliteta nema dan kvaliteta duži od dugog kad jedan kvalitet staje', () => {
    const p = planOf(base('d4-r-12w'));
    const at = p.weeks[2]!.endDate;
    const f = factsOf(p, 'pause35', at);
    const r = ok(adaptMarathonV2(p, f, at));
    const w = r.plan.weeks[7]!;
    expect(easy35(w)).toBe(true);
    expect(w.days.filter((d) => d.workout.kind === 'quality')).toHaveLength(1);
    expect(twoQOver(r.plan).filter((x) => x.index > 3)).toEqual([]);
    expect(adaptInvariants(p, r.plan, at, f as MarathonV2Facts)).toEqual([]);
    // Pouka 14: kad ni sa jednim kvalitetom dugi nije najduži — upozorenje sa preporukom manje dana (N10.5).
    const lsq = r.plan.warnings.find((v) => v.rule === 'LONG_SHORTER_THAN_QUALITY')!.message;
    expect(lsq).toMatch(/preporuka 3 dana \(red sa manje dana podržava obim 45 km/);
  });

  it('validator čita istu funkciju: dva kvaliteta uz dan duži od dugog → QUALITY_DAYS; napomena bez nedelje sa jednim → QUALITY_DAYS', () => {
    const p = planOf(base('d4-r-12w'));
    const q = structuredClone(p);
    const w = q.weeks.find((x) => steady(x) && x.index > 1)!;
    const long = w.days.find((d) => d.role === 'long')!;
    w.days.find((d) => d.role === 'q2')!.workout.sec = long.workout.sec + 60;
    expect(errors(q)).toContain(`QUALITY_DAYS@${w.index}`);
    const n = structuredClone(p);
    n.weeks[w.index - 1]!.notes.push(
      'Q2: dan kvaliteta je lagan — sa dva kvaliteta dan bi trajao duže od dugog; T 2,0 km otpada, dugi preuzima oslobođeni obim (pouka 35).'
    );
    expect(errors(n)).toContain(`QUALITY_DAYS@${w.index}`);
    // Trajanje dugog je ono iz kog odlučuje konstruktor (dugi nedelje sa dva kvaliteta).
    expect(long.workout.sec).toBe(longWorkout(long.workout.km, p.paces).sec);
  });

  it('taper i trkačka nedelja su izuzeti (M7): bez napomene pouke 35', () => {
    const p = planOf(base('d4-r-12w'));
    const r = ok(
      adaptMarathonV2(p, factsOf(p, 'pause35', p.weeks[2]!.endDate), p.weeks[2]!.endDate)
    );
    for (const w of r.plan.weeks.filter((x) => !BUILD.includes(x.phase)))
      expect(easy35(w)).toBe(false);
  });
});

describe('pouka 36: umor vezan za zapise (isti zapisi = isti plan)', () => {
  const p = planOf(grid('d3-12w-30km-v30-A-sat'));
  const at = p.weeks[1]!.endDate;
  const f = factsOf(p, 'fatigue', at);
  const a1 = ok(adaptMarathonV2(p, f, at));
  const deloads = (x: MarathonV2Plan): number[] =>
    x.weeks.filter((w) => w.deload).map((w) => w.index);

  it('isti zapisi umora ponovo asOf + 1 … + 7: nema novog rasterećenja, traka ga ne vidi kao novo', () => {
    expect(a1.reasons.some((x) => x.condition === 'FATIGUE' && x.applied)).toBe(true);
    for (let k = 1; k <= 7; k++) {
      const a = addDays(at, k);
      const r = ok(adaptMarathonV2(a1.plan, f, a));
      expect(deloads(r.plan)).toEqual(deloads(a1.plan));
      expect(r.newLimits.filter((x) => x.startsWith('deload:'))).toEqual([]);
      expect(adaptBanner(a1.plan, r, f, a)).toEqual([]);
    }
  });

  it('isti zapisi, prva adaptacija dan kasnije (preko granice nedelje): ista nedelja rasterećenja', () => {
    const r = ok(adaptMarathonV2(p, f, addDays(at, 1)));
    expect(deloads(r.plan)).toEqual(deloads(a1.plan));
    const w = deloads(a1.plan).find((i) => !p.weeks[i - 1]!.deload)!;
    expect(r.plan.weeks[w - 1]!.targetKm).toBe(a1.plan.weeks[w - 1]!.targetKm);
  });
});

describe('N8 (pouka 29): validator čita stanje upisane mešovite nedelje', () => {
  it('d4-r-16w, manjak kraj ned 6 + zaključan Q1 ned 7 (mešovita): skok doze u ned 8 → DOSE_JUMP (ranije preskočeno)', () => {
    const p = planOf(base('d4-r-16w'));
    const at = p.weeks[5]!.endDate;
    const lock = p.weeks[6]!.days.find((d) => d.role === 'q1')!.date;
    const r = ok(adaptMarathonV2(p, { ...factsOf(p, 'under50', at), lockedDayIds: [lock] }, at));
    expect(r.plan.adaptation!.mixedWeeks).toEqual([7]);
    expect(errors(r.plan)).toEqual([]);
    const q = structuredClone(r.plan);
    const d = q.weeks[7]!.days.find((x) => x.role === 'q2')!.workout.dose!;
    d.doseM += 2000;
    d.structure = { form: 'continuous', km: d.doseM / 1000 };
    expect(errors(q)).toContain('DOSE_JUMP@8');
  });
});

describe('N9 (pouka 24): jedna definicija po veličini — validator ne nosi kopiju', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = (f: string): string => readFileSync(join(here, f), 'utf8');
  it('nominalni cilj, minimum nedelje, dugi tapera, pod T, doza rasterećenja i WU/CD samo iz funkcija konstruktora', () => {
    const v = src('validate.ts');
    expect(v).not.toMatch(/P\.deload\.factor \*|P\.taper\.weeks\[step\]!\.factor/);
    expect(v).not.toMatch(/rule\.weekMinKm\s*[<>)]|[<>]\s*(to10\()?rule\.weekMinKm/);
    expect(v).not.toMatch(/longFactor \*/);
    expect(v).not.toMatch(/P\.deload\.tMinKm\) \* 1000|function expectedReduced/);
    expect(v).not.toMatch(/P\.workout\.warmupCooldown/);
    // Minimum nedelje: jedna funkcija (weekMin10; od MAR-08b definisana u lengths.ts — zaokruživanje laganih na
    // minimumu, K4 — i izvezena iz volume.ts) za pretragu cilja, donju granicu, dužine i validator.
    for (const f of ['volume.ts', 'generate.ts', 'week.ts', 'lengths.ts', 'validate.ts'])
      expect(src(f).match(/rule\.weekMinKm \* 10|to10\(rule\.weekMinKm\)/g)?.length ?? 0).toBe(
        f === 'lengths.ts' ? 1 : 0
      );
  });
});

describe('N11: upozorenja i napomene', () => {
  it('MARATHON_LONG_SHORT samo kad dugi NIJE ograničen sa 150 min; inače rečenica u opisu plana (bez nje → LONG_SHORT_NOTE)', () => {
    const slow = planOf(
      inputOf({ weeks: 16, km: 55, vdot: 30, days: ['tue', 'thu', 'sat', 'sun'], long: 'sun' })
    );
    expect(rules(slow)).not.toContain('MARATHON_LONG_SHORT');
    const longest = Math.max(
      ...slow.weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
    );
    expect(slow.notes).toContain(longTimeCapNote(longest, 26, false));
    const q = structuredClone(slow);
    q.notes = q.notes.filter((n) => !n.startsWith('Najduži dugi trk je'));
    expect(errors(q)).toContain('LONG_SHORT_NOTE@-');
    const fast = planOf(
      inputOf({ weeks: 16, km: 35, vdot: 70, days: ['tue', 'thu', 'sat', 'sun'], long: 'sun' })
    );
    expect(rules(fast)).toContain('MARATHON_LONG_SHORT');
    expect(fast.notes.some((n) => n.startsWith('Najduži dugi trk je'))).toBe(false);
  });

  it('napomena „Cilj po pravilu … nije izvodljiv" ostaje u planu (validator), ne ide korisniku (aplikacija)', () => {
    const p = planOf(grid('d3-12w-30km-v30-A-sat'));
    const w = p.weeks.find((x) =>
      x.notes.some((n) => n.includes('nije izvodljiv u konstrukciji'))
    )!;
    expect(w).toBeDefined();
    const g = generatedPlan(p).weeks[w.index - 1]!;
    expect(g.focus).not.toMatch(/nije izvodljiv u konstrukciji/);
  });

  it('CAPACITY_LIMITED i DELOAD_LONG_SHORTENED jednom po planu (upozorenje = napomena plana, bez ponavljanja)', () => {
    const c = planOf(
      inputOf({ weeks: 24, km: 65, vdot: 30, days: ['tue', 'thu', 'sat', 'sun'], long: 'sun' })
    );
    const cap = c.warnings.filter((v) => v.rule === 'CAPACITY_LIMITED');
    expect(cap).toHaveLength(1);
    expect(c.notes).toContain(cap[0]!.message);
    let seen = 0;
    for (const b of beginnerInputs().filter((_, i) => i % 40 === 0)) {
      const r = generateMarathonV2(b.input);
      if (!r.ok) continue;
      const n = r.plan.warnings.filter((v) => v.rule === 'DELOAD_LONG_SHORTENED').length;
      expect(n).toBeLessThanOrEqual(1);
      if (
        n === 1 &&
        r.plan.weeks.filter((w) => w.notes.some((x) => x.includes('skraćen sa 0,8 ×'))).length > 1
      )
        seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('MAR-07b (pouka 4, stalni uslov 4): provere po danu preskaču zaštićene dane — validator ne sudi činjenicama', () => {
  // Zaštićen dan (zaključan / urađen) iz nedelje posle novog rezultata nosi stari tempo; na 46a3e22 odbijano (WARMUP).
  it.each([5, 6])(
    'd4-r-16w: brži rezultat kraj ned %i + zaključan Q1 sledeće nedelje → plan se vraća, dan bajt-isti',
    (k) => {
      const p = planOf(base('d4-r-16w'));
      const at = p.weeks[k - 1]!.endDate;
      const q1 = p.weeks[k]!.days.find((d) => d.role === 'q1')!;
      const f = { ...factsOf(p, 'faster', at), lockedDayIds: [q1.date] };
      const r = ok(adaptMarathonV2(p, f, at));
      expect(r.plan.weeks[k]!.days.find((d) => d.date === q1.date)).toEqual(q1);
      expect(adaptInvariants(p, r.plan, at, f as MarathonV2Facts)).toEqual([]);
    }
  );

  it('urađen Q2 sledeće nedelje (dayId, trčan dan ranije) + brži rezultat → plan se vraća, dan bajt-isti', () => {
    const p = planOf(base('d4-r-16w'));
    const at = p.weeks[4]!.endDate;
    const q2 = p.weeks[5]!.days.find((d) => d.role === 'q2')!;
    const f = factsOf(p, 'faster', at) as { results: unknown[] };
    const facts = {
      ...f,
      workouts: [
        {
          date: at,
          dayId: q2.date,
          km: q2.workout.km,
          durationSec: q2.workout.sec,
          completed: true
        }
      ]
    };
    const r = ok(adaptMarathonV2(p, facts, at));
    expect(r.plan.weeks[5]!.days.find((d) => d.date === q2.date)).toEqual(q2);
    expect(r.plan.adaptation!.doneDayIds).toEqual([q2.date]);
  });
});
