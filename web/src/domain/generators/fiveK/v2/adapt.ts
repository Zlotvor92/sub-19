/* 2.5.0: adaptFiveKV2(plan, facts, asOf) → { plan, changes, reasons } ili strukturisano odbijanje.
   Tok (Uslov 4): (1) assess.ts — činjenice → ograničenja (AdaptStep); (2) isti konstruktor kao generate
   (construct) gradi ceo plan sa svim koracima; (3) spajanje — dani ≤ asOf, urađeni i zaključani dani
   ostaju bajt-isti iz prethodnog plana; završna zaštita to samo proverava; (4) validate.
   Bez čitanja sata: asOf je ulaz. Ista vrednost ulaza → isti JSON.
   2.6.0: plan trčanje/hodanje ide u runWalkAdapt.ts (isti API, isti tok). */

import { dayNumber, mustDay } from './dates.ts';
import { checkInput } from './input.ts';
import { assess, checkFacts } from './assess.ts';
import { construct } from './generate.ts';
import { assessGoal, beginnerGoal, goalWithoutData, raceTimeForVdot } from './paces.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { adaptRunWalk } from './runWalkAdapt.ts';
import { athleteAt, pacesAt, vdotAt } from './steps.ts';
import type {
  AdaptChange,
  AdaptResult,
  FiveKV2Plan,
  FiveKV2RunWalkPlan,
  GoalAssessment,
  PlanDay,
  PlanWeek,
  Reason,
  RunWalkAdaptResult
} from './types.ts';
import { validatePlan } from './validate.ts';
import { capacityKm } from './volume.ts';

const r2 = (x: number): number => Math.round(x * 100) / 100;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const reject = (code: Reason['code'], message: string): AdaptResult => ({
  ok: false,
  reasons: [{ code, message }],
  violations: []
});

function checkPlan(raw: unknown): FiveKV2Plan | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as FiveKV2Plan;
  if (p.policyId !== P.id || !Array.isArray(p.weeks) || p.weeks.length === 0) return null;
  const c = checkInput(p.input);
  if (!c.ok || !same(c.input, p.input)) return null;
  const n = (mustDay(p.input.raceDate) - mustDay(p.input.startDate) + 1) / 7;
  if (p.weeks.length !== n || p.weeks.some((w) => !Array.isArray(w.days))) return null;
  return p;
}

const dayLabel = (d: PlanDay | undefined): string => (d ? `${d.role}: ${d.workout.title}` : '—');

/** Razlike prethodnog i novog plana (nedelja: faza, rasterećenje, cilj, planirano; dan: trening). */
function diff(before: FiveKV2Plan, after: FiveKV2Plan): AdaptChange[] {
  const out: AdaptChange[] = [];
  const push = (week: number, field: string, b: unknown, a: unknown, date?: string): void => {
    if (!same(b, a))
      out.push({ week, ...(date ? { date } : {}), field, before: String(b), after: String(a) });
  };
  push(0, 'paceMode', before.paceMode, after.paceMode);
  push(0, 'vdot', before.vdot, after.vdot);
  push(0, 'predicted5kSec', before.predicted5kSec, after.predicted5kSec);
  push(0, 'goal', before.goal?.status ?? null, after.goal?.status ?? null);
  after.weeks.forEach((w, i) => {
    const o = before.weeks[i]!;
    if (same(o, w)) return;
    push(w.index, 'phase', o.phase, w.phase);
    push(w.index, 'deload', o.deload, w.deload);
    push(w.index, 'targetKm', o.targetKm, w.targetKm);
    push(w.index, 'plannedKm', o.plannedKm, w.plannedKm);
    const dates = [...new Set([...o.days, ...w.days].map((d) => d.date))].sort();
    for (const d of dates)
      push(
        w.index,
        'day',
        dayLabel(o.days.find((x) => x.date === d)),
        dayLabel(w.days.find((x) => x.date === d)),
        d
      );
  });
  return out;
}

/** 2.6.0: plan trčanje/hodanje → runWalkAdapt.ts (isti API); kontinuirani plan → adaptContinuous. */
export function adaptFiveKV2(
  rawPlan: FiveKV2RunWalkPlan,
  rawFacts: unknown,
  asOf: unknown
): RunWalkAdaptResult;
export function adaptFiveKV2(rawPlan: FiveKV2Plan, rawFacts: unknown, asOf: unknown): AdaptResult;
export function adaptFiveKV2(
  rawPlan: unknown,
  rawFacts: unknown,
  asOf: unknown
): AdaptResult | RunWalkAdaptResult;
export function adaptFiveKV2(
  rawPlan: unknown,
  rawFacts: unknown,
  asOf: unknown
): AdaptResult | RunWalkAdaptResult {
  const runWalk =
    typeof rawPlan === 'object' &&
    rawPlan !== null &&
    (rawPlan as { planType?: unknown }).planType === 'runWalk';
  return runWalk
    ? adaptRunWalk(rawPlan, rawFacts, asOf, adaptContinuous)
    : adaptContinuous(rawPlan, rawFacts, asOf);
}

function adaptContinuous(rawPlan: unknown, rawFacts: unknown, asOf: unknown): AdaptResult {
  const plan = checkPlan(rawPlan);
  if (!plan) return reject('ADAPT_PLAN_INVALID', 'Plan nije ispravan 5K v2 plan.');
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
  const ids = new Set(plan.weeks.flatMap((w) => w.days.map((d) => d.date)));
  const cf = checkFacts(rawFacts, at, ids);
  if (!cf.ok) return { ok: false, reasons: cf.reasons, violations: [] };
  const facts = cf.facts;

  // (1) Činjenice → ograničenja.
  const as = assess(plan, facts, at);
  if (!as.ok) return { ok: false, reasons: as.reasons, violations: [] };
  const steps = [...(plan.adaptation?.steps ?? []), as.step];

  // (2) Isti konstruktor kao generate.
  const built = construct(plan.input, steps);
  if (!built.ok) return { ok: false, reasons: built.reasons, violations: [] };
  const c = built.c;

  // (3) Spajanje: dani ≤ asOf, urađeni i zaključani dani iz prethodnog plana.
  const done = new Set(facts.workouts.filter((x) => x.completed).map((x) => x.dayId ?? x.date));
  const locked = new Set(facts.lockedDayIds);
  const keep = (d: PlanDay): boolean =>
    mustDay(d.date) <= t || done.has(d.date) || locked.has(d.date);
  const mixed: number[] = [];
  const weeks: PlanWeek[] = c.weeks.map((b, i) => {
    const s = plan.weeks[i]!;
    if (mustDay(s.endDate) <= t) {
      if (!same(s, b)) mixed.push(s.index);
      return s;
    }
    const days = [
      ...s.days.filter(keep),
      ...b.days.filter((d) => !s.days.some((x) => x.date === d.date && keep(x)))
    ].sort((x, y) => x.date.localeCompare(y.date));
    if (same(days, b.days)) return same(s, b) ? s : b;
    mixed.push(s.index);
    const kept = s.days.filter((d) => keep(d) && mustDay(d.date) > t).map((d) => d.date);
    return {
      ...b,
      days,
      plannedKm: r2(days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0)),
      notes: [
        ...b.notes,
        `Adaptacija ${at}: ${mustDay(s.startDate) <= t ? `dani do ${at} nepromenjeni` : ''}${kept.length > 0 ? `${mustDay(s.startDate) <= t ? '; ' : ''}zaključano/urađeno zadržano: ${kept.join(', ')}` : ''}.`
      ]
    };
  });

  // Završna zaštita: samo proverava (ne menja plan).
  for (const s of plan.weeks)
    for (const d of s.days)
      if (keep(d)) {
        const m = weeks[s.index - 1]!.days.filter((x) => x.date === d.date);
        if (m.length !== 1 || !same(m[0], d))
          return reject(
            'ADAPT_PROTECTION',
            `Zaštićen dan ${d.date} bi bio promenjen; plan se ne vraća.`
          );
      }

  // Nivo plana: tempo/prognoza/cilj iz tempa poslednje nedelje (budućnost).
  const N = weeks.length;
  const vdot = vdotAt(plan.input, steps, N);
  const paces = pacesAt(plan.input, steps, N);
  const a = athleteAt(plan.input, steps, N);
  const g = plan.input.goalTimeSec;
  let goal: GoalAssessment | null = null;
  if (g)
    goal =
      vdot === null
        ? goalWithoutData(g)
        : a.beginner
          ? beginnerGoal(assessGoal(vdot, g))
          : assessGoal(vdot, g);
  const orientation = steps.some((s) => s.orientation);
  if (goal && orientation && vdot !== null)
    goal = { ...goal, status: 'orientation', message: P.adapt.orientationMessage };
  const applied = as.reasons.filter((x) => x.applied && x.condition !== 'NO_FACTS');
  const notes = [
    ...plan.notes.filter((x) => a.feel || x !== P.feel.forecastNote),
    ...applied.map((x) => `Adaptacija ${at}: ${x.message}`),
    ...(orientation && !plan.notes.includes(P.adapt.orientationMessage)
      ? [P.adapt.orientationMessage]
      : [])
  ];
  const build = weeks.filter(
    (w) => w.phase === 'base' || w.phase === 'peak' || w.phase === 'sharpen'
  );
  const out: FiveKV2Plan = {
    policyId: P.id,
    policyVersion: P.version,
    input: plan.input,
    paceMode: a.feel ? 'feel' : 'vdot',
    experience: plan.experience,
    vdot,
    paces,
    predicted5kSec: vdot === null ? null : raceTimeForVdot(vdot, P.paces.raceDistanceM),
    goal,
    pattern: c.pattern,
    startKm: plan.startKm,
    peakKm: Math.max(...build.map((w) => w.targetKm)),
    capacityKm: capacityKm(paces, a),
    notes,
    weeks,
    warnings: [],
    adaptation: { asOf: at, steps, mixedWeeks: mixed, lockedDayIds: facts.lockedDayIds }
  };

  // (4) Validacija.
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
  if (out.goal && out.goal.status !== 'feasible')
    out.warnings.push({ rule: 'GOAL_STATUS', severity: 'warning', message: out.goal.message });
  return { ok: true, plan: out, changes: diff(plan, out), reasons: as.reasons };
}
