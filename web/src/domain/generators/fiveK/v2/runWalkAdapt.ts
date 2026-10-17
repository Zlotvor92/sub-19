/* 2.6.0: adaptacija plana trčanje/hodanje (isti API adaptFiveKV2). Tok kao kontinuirani plan (Uslov 4):
   (1) runWalkAssess — činjenice → stanje (nivo) i prelaz; (2) isti konstruktor kao generate
   (constructRunWalk) gradi projekciju od novog nivoa; (3) spajanje — dani ≤ asOf, urađeni i zaključani
   ostaju bajt-isti; zaštita samo proverava; (4) validate. Prelaz (Odluka 8): ostatak plana gradi
   generateFiveKV2 kao početnik po osećaju. Posle prelaza adaptira se samo kontinuirani deo (isti
   kontinuirani adapt, ubrizgan da ne bi bilo kružnog uvoza sa adapt.ts). */

import { assessRunWalk } from './runWalkAssess.ts';
import { checkFacts } from './assess.ts';
import { dayNumber, mustDay } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { constructRunWalk, transitionInput, weekCount } from './runWalk.ts';
import type {
  AdaptChange,
  AdaptFacts,
  AdaptResult,
  FiveKV2RunWalkPlan,
  Reason,
  RunWalkAdaptResult,
  RunWalkDay,
  RunWalkWeek,
  WorkoutFact
} from './types.ts';
import { validatePlan } from './validate.ts';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const reject = (code: Reason['code'], message: string): RunWalkAdaptResult => ({
  ok: false,
  reasons: [{ code, message }],
  violations: []
});

function checkPlan(raw: unknown): FiveKV2RunWalkPlan | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as FiveKV2RunWalkPlan;
  if (p.policyId !== P.id || p.planType !== 'runWalk' || !Array.isArray(p.weeks)) return null;
  const c = checkInput(p.input);
  if (!c.ok || !same(c.input, p.input) || p.input.canRun30Min !== false) return null;
  const n = weekCount(p.input);
  const k = p.continuous ? p.continuous.fromWeek - 1 : n;
  if (p.weeks.length !== k || p.weeks.some((w) => !Array.isArray(w.days))) return null;
  return p;
}

const label = (d: RunWalkDay | undefined): string =>
  !d ? '—' : d.role === 'race' ? `race: ${d.race.title}` : `session: ${d.session.title}`;

function diff(before: FiveKV2RunWalkPlan, after: FiveKV2RunWalkPlan): AdaptChange[] {
  const out: AdaptChange[] = [];
  before.weeks.forEach((o, i) => {
    const w: RunWalkWeek | undefined = after.weeks[i];
    if (!w) {
      out.push({ week: o.index, field: 'phase', before: o.phase, after: 'continuous' });
      return;
    }
    if (same(o, w)) return;
    const dates = [...new Set([...o.days, ...w.days].map((d) => d.date))].sort();
    for (const date of dates) {
      const a = label(o.days.find((x) => x.date === date));
      const b = label(w.days.find((x) => x.date === date));
      if (a !== b) out.push({ week: w.index, date, field: 'day', before: a, after: b });
    }
  });
  return out;
}

export function adaptRunWalk(
  rawPlan: unknown,
  rawFacts: unknown,
  asOf: unknown,
  adaptContinuous: (plan: unknown, facts: unknown, asOf: unknown) => AdaptResult
): RunWalkAdaptResult {
  const plan = checkPlan(rawPlan);
  if (!plan) return reject('ADAPT_PLAN_INVALID', 'Plan nije ispravan 5K v2 plan trčanje/hodanje.');
  if (dayNumber(asOf) === null)
    return reject('ADAPT_AS_OF_INVALID', 'asOf mora biti ispravan datum YYYY-MM-DD.');
  const at = asOf as string;
  const t = mustDay(at);
  if (t >= mustDay(plan.input.raceDate))
    return reject('ADAPT_AS_OF_INVALID', 'asOf mora biti pre dana trke (datum trke se ne pomera).');
  if (plan.adaptation && t < mustDay(plan.adaptation.asOf))
    return reject(
      'ADAPT_AS_OF_INVALID',
      `asOf ne sme biti pre prethodne adaptacije (${plan.adaptation.asOf}).`
    );
  const cont = plan.continuous;
  const subDays = new Set(cont ? cont.plan.weeks.flatMap((w) => w.days.map((d) => d.date)) : []);
  const ids = new Set([...plan.weeks.flatMap((w) => w.days.map((d) => d.date)), ...subDays]);
  const cf = checkFacts(rawFacts, at, ids);
  if (!cf.ok) return { ok: false, reasons: cf.reasons, violations: [] };
  const facts = cf.facts;
  const steps0 = plan.adaptation?.steps ?? [];

  const finish = (
    out: FiveKV2RunWalkPlan,
    rest: Omit<Extract<RunWalkAdaptResult, { ok: true }>, 'ok' | 'plan'>
  ): RunWalkAdaptResult => {
    const violations = validatePlan(out);
    const errors = violations.filter((v) => v.severity === 'error');
    if (errors.length > 0)
      return {
        ok: false,
        reasons: [
          {
            code: 'PLAN_VIOLATES_POLICY',
            message: `Adaptiran plan krši ${errors.length} pravila; plan se ne vraća.`
          }
        ],
        violations
      };
    out.warnings = violations;
    return { ok: true, plan: out, ...rest };
  };

  // Posle prelaza: deo trčanja/hodanja je prošlost; kontinuirani deo adaptira kontinuirani adapt.
  if (cont) {
    const workouts: WorkoutFact[] = facts.workouts.map((x) => {
      if (x.dayId === undefined || subDays.has(x.dayId)) return x;
      const { dayId: _dayId, ...rest } = x;
      return rest;
    });
    const subFacts: AdaptFacts = {
      workouts,
      results: facts.results,
      lockedDayIds: facts.lockedDayIds.filter((d) => subDays.has(d)),
      coverage: facts.coverage,
      breaks: facts.breaks
    };
    const r = adaptContinuous(cont.plan, subFacts, at);
    if (!r.ok) return r;
    const out: FiveKV2RunWalkPlan = {
      ...plan,
      policyVersion: P.version,
      continuous: { fromWeek: cont.fromWeek, plan: r.plan },
      warnings: [],
      adaptation: { asOf: at, steps: steps0, lockedDayIds: facts.lockedDayIds }
    };
    return finish(out, {
      changes: r.changes.map((c) => ({ ...c, week: c.week > 0 ? c.week + cont.fromWeek - 1 : 0 })),
      reasons: r.reasons
    });
  }

  // (1) Činjenice → stanje; (2) isti konstruktor; (3) spajanje.
  const as = assessRunWalk(plan, facts, at);
  const steps = [...steps0, as.step];
  const built = constructRunWalk(plan.input, steps);
  const done = new Set(facts.workouts.filter((x) => x.completed).map((x) => x.dayId ?? x.date));
  const locked = new Set(facts.lockedDayIds);
  const keep = (d: RunWalkDay): boolean =>
    mustDay(d.date) <= t || done.has(d.date) || locked.has(d.date);
  const weeks: RunWalkWeek[] = built.map((b, i) => {
    const s = plan.weeks[i]!;
    if (mustDay(s.endDate) <= t) return s;
    const days = [
      ...s.days.filter(keep),
      ...b.days.filter((d) => !s.days.some((x) => x.date === d.date && keep(x)))
    ].sort((x, y) => x.date.localeCompare(y.date));
    if (same(days, b.days)) return same(s, b) ? s : b;
    return { ...b, days };
  });
  for (const s of plan.weeks)
    for (const d of s.days)
      if (keep(d)) {
        const m = weeks[s.index - 1]?.days.filter((x) => x.date === d.date) ?? [];
        if (m.length !== 1 || !same(m[0], d))
          return reject(
            'ADAPT_PROTECTION',
            `Zaštićen dan ${d.date} bi bio promenjen; plan se ne vraća.`
          );
      }

  // Odluka 8: prelaz — ostatak plana gradi generator (kontinuirani plan početnika po osećaju).
  const T = as.step.transitionWeek;
  let continuous: FiveKV2RunWalkPlan['continuous'] = null;
  if (T !== null) {
    const g = generateFiveKV2(transitionInput(plan.input, T));
    if (!g.ok) return { ok: false, reasons: g.reasons, violations: g.violations };
    if (g.plan.planType === 'runWalk')
      return reject('ADAPT_PLAN_INVALID', 'Prelaz mora dati kontinuirani plan.');
    continuous = { fromWeek: T, plan: g.plan };
  }
  const out: FiveKV2RunWalkPlan = {
    policyId: P.id,
    policyVersion: P.version,
    planType: 'runWalk',
    input: plan.input,
    experience: plan.experience,
    goal: plan.goal,
    notes: [
      ...plan.notes,
      ...(T !== null ? [P.runWalk.transitionNote.replace('{week}', String(T))] : [])
    ],
    weeks,
    continuous,
    warnings: [],
    adaptation: { asOf: at, steps, lockedDayIds: facts.lockedDayIds }
  };
  const result = finish(out, { changes: [], reasons: as.reasons });
  if (result.ok) result.changes = diff(plan, result.plan);
  return result;
}
