/* Segment 04 (10k-v2.4.0): adaptTenKV2(plan, facts, asOf) → { ok, plan, changes, reasons } ili
   strukturisano odbijanje { ok: false, reasons, violations }. Tok (Uslov 4): (1) assess.ts — činjenice →
   ograničenja (TenKV2AdaptStep); (2) isti konstruktor kao generate (construct) gradi ceo plan sa svim
   koracima; (3) spajanje — dani ≤ asOf, urađeni i zaključani dani ostaju bajt-isti iz prethodnog plana;
   završna zaštita to samo proverava (A11); (4) validate. Bez čitanja sata: asOf je ulaz; isti ulaz → isti
   JSON (A14). */

import { assess, checkFacts, painReturnNote } from './assess.ts';
import { dayNumber, mustDay } from './dates.ts';
import { construct, preStartRef } from './generate.ts';
import { checkInput } from './input.ts';
import { dayRule, TEN_K_V2_POLICY as P } from './policy.ts';
import { baseFrames, framesFor, targetReducedWeek } from './steps.ts';
import type {
  AdaptChange,
  AdaptReason,
  AdaptResult,
  PlanDay,
  Reason,
  TenKV2AdaptStep,
  TenKV2Plan
} from './types.ts';
import { validatePlan } from './validate.ts';
import { to10 } from './volume.ts';
import { type Written, writtenWeeks } from './written.ts';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const reject = (code: Reason['code'], message: string): AdaptResult => ({
  ok: false,
  reasons: [{ code, message }],
  violations: []
});

/** A15: plan politike 10k-v2 (bilo koje verzije) sa ispravnim ulazom i nedeljama; inače null. */
function checkPlan(raw: unknown): TenKV2Plan | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as TenKV2Plan;
  if (p.policyId !== P.id || typeof p.policyVersion !== 'string') return null;
  if (!Array.isArray(p.weeks) || p.weeks.length === 0) return null;
  const c = checkInput(p.input);
  if (!c.ok || !same(c.input, p.input) || p.weeks.length !== c.weeks) return null;
  if (
    p.weeks.some(
      (w, i) => typeof w !== 'object' || w === null || w.index !== i + 1 || !Array.isArray(w.days)
    )
  )
    return null;
  const a = p.adaptation;
  if (a !== undefined && (typeof a !== 'object' || a === null || !Array.isArray(a.steps)))
    return null;
  return p;
}

/** A17: uslovi čiji je cilj koraka smanjenje (assess: reduced = true). */
const REDUCING: readonly AdaptReason['condition'][] = ['PAUSE', 'UNDER_EXECUTION'];

const dayLabel = (d: PlanDay | undefined): string => (d ? `${d.role}: ${d.workout.title}` : '—');

/** Razlike prethodnog i novog plana (plan: tempo, cilj; nedelja: faza, rasterećenje, test, cilj,
    planirano; dan: trening). */
function diff(before: TenKV2Plan, after: TenKV2Plan): AdaptChange[] {
  const out: AdaptChange[] = [];
  const push = (week: number, field: string, b: unknown, a: unknown, date?: string): void => {
    if (!same(b, a))
      out.push({ week, ...(date ? { date } : {}), field, before: String(b), after: String(a) });
  };
  push(0, 'paceBasis', before.paceBasis, after.paceBasis);
  push(0, 'vdot', before.vdot, after.vdot);
  push(0, 'predicted10kSec', before.predicted10kSec, after.predicted10kSec);
  push(0, 'goal', before.goal?.status ?? null, after.goal?.status ?? null);
  after.weeks.forEach((w, i) => {
    const o = before.weeks[i]!;
    if (same(o, w)) return;
    push(w.index, 'phase', o.phase, w.phase);
    push(w.index, 'deload', o.deload, w.deload);
    push(w.index, 'test', o.test === true, w.test === true);
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

export function adaptTenKV2(rawPlan: unknown, rawFacts: unknown, asOf: unknown): AdaptResult {
  const plan = checkPlan(rawPlan);
  if (!plan) return reject('ADAPT_PLAN_INVALID', 'Plan nije ispravan 10K v2 plan (A15).');
  if (dayNumber(asOf) === null)
    return reject('ADAPT_AS_OF_INVALID', 'asOf mora biti ispravan datum YYYY-MM-DD.');
  const at = asOf as string;
  const t = mustDay(at);
  if (t >= mustDay(plan.input.raceDate))
    return reject(
      'ADAPT_AS_OF_INVALID',
      'asOf mora biti pre dana trke (datum trke se ne pomera, A11).'
    );
  const prevSteps: readonly TenKV2AdaptStep[] = plan.adaptation?.steps ?? [];
  const prevAsOf = plan.adaptation?.asOf;
  if (prevAsOf !== undefined && (dayNumber(prevAsOf) === null || t < mustDay(prevAsOf)))
    return reject(
      'ADAPT_AS_OF_INVALID',
      `asOf ne sme biti pre prethodne adaptacije (${String(prevAsOf)}, A11).`
    );
  const ids = new Set(plan.weeks.flatMap((w) => w.days.map((d) => d.date)));
  const cf = checkFacts(rawFacts, at, ids);
  if (!cf.ok) return { ok: false, reasons: cf.reasons, violations: [] };
  const facts = cf.facts;
  const chk = checkInput(plan.input);
  if (!chk.ok) return reject('ADAPT_PLAN_INVALID', 'Ulaz plana nije ispravan (A15).');

  // (1) Činjenice → ograničenja.
  const as = assess(plan, facts, at, chk.pace, dayRule(chk.input.runDays.length)!.weekMinKm, () =>
    preStartRef(plan.input)
  );
  const steps = [...prevSteps, as.step];

  // Zaštita (A11): dani ≤ asOf, urađeni (po dayId ili datumu) i zaključani iz prethodnog plana — konstruktor
  // je zna unapred: prošlost = upisani dani (written.ts, 10k-v2.5.1).
  const done = new Set(facts.workouts.filter((x) => x.completed).map((x) => x.dayId ?? x.date));
  const locked = new Set(facts.lockedDayIds);
  const keep = (d: PlanDay): boolean =>
    mustDay(d.date) <= t || done.has(d.date) || locked.has(d.date);
  const prior: Written = {
    weeks: plan.weeks,
    keep,
    asOf: t,
    at,
    lockedDayIds: facts.lockedDayIds
  };

  // (2) Isti konstruktor kao generate.
  const built = construct(plan.input, steps, prior);
  if (!built.ok) return { ok: false, reasons: built.reasons, violations: [] };
  const c = built.plan;

  // (3) Spajanje (A11, written.ts — isto koje vidi validacija u construct).
  const { weeks, mixed } = writtenWeeks(c.weeks, prior);

  // Završna zaštita (A11): samo proverava, ne menja plan.
  for (const s of plan.weeks)
    for (const d of s.days)
      if (keep(d)) {
        const m = weeks[s.index - 1]!.days.filter((x) => x.date === d.date);
        if (m.length !== 1 || !same(m[0], d))
          return reject(
            'ADAPT_PROTECTION',
            `Zaštićen dan ${d.date} bi bio promenjen; plan se ne vraća (A11).`
          );
      }

  // A4 (10k-v2.4.1): poruka PAIN — osnova povratka iz cilja nedelje sidra u konstrukciji (pauza iz istog
  // koraka ga smanjuje, A3); računa je volume.returnBase10 (assess.painReturnNote). A17 (10k-v2.5.0):
  // rasterećenja koja je ukinuo ovaj korak (odluka okvira, steps.framesFor — isti podatak `dropped`) —
  // rečenica u poruci uslova koji je smanjio nedelju (cilj koraka: pauza/manjak; inače bol). A13: test
  // premešten ili uklonjen (odluka okvira, steps.framesFor) — zapis u reasons.
  const rf = as.step.returnFrom;
  const dropped = new Map<number, number>();
  const base = baseFrames(
    chk.input.startDate,
    chk.weeks,
    chk.pace.kind === 'feel' && chk.rule.feelTest
  );
  if (base)
    framesFor(base, chk.pattern, chk.input.runDays, chk.input.raceDate, chk.pace, steps, dropped);
  const own = [...dropped].filter(([, k]) => k === steps.length - 1).map(([w]) => w);
  const byTarget = (w: number): boolean => targetReducedWeek(as.step) === w - 1;
  const a17 = (x: AdaptReason): string =>
    own
      .filter((w) =>
        x.condition === 'PAIN' ? !byTarget(w) : REDUCING.includes(x.condition) && byTarget(w)
      )
      .map(
        (w) => ` Redovno rasterećenje u nedelji ${w} otpada: nedelja ${w - 1} je smanjena (A17).`
      )
      .join('');
  const reasons: AdaptReason[] = as.reasons.map((x) => {
    const pain =
      rf && x.condition === 'PAIN'
        ? painReturnNote(as.step, to10(c.weeks[rf.week - 1]!.targetKm))
        : '';
    const note = pain + (x.applied ? a17(x) : '');
    return note ? { ...x, message: x.message + note } : x;
  });
  const testOf = (p: TenKV2Plan): number | null =>
    p.weeks.find((w) => w.days.some((d) => d.role === 'test'))?.index ?? null;
  const tb = testOf(plan);
  const ta = testOf({ ...c, weeks });
  if (tb !== ta)
    reasons.push({
      condition: 'TEST_MOVED',
      applied: true,
      message:
        ta === null
          ? `Test ${P.test.km} km (nedelja ${tb}) otpada: primljen rezultat ili nema nedelje izgradnje bez ograničenja (A13).`
          : `Test ${P.test.km} km: nedelja ${tb ?? '—'} → ${ta} (prva sledeća ne-rasteretna nedelja izgradnje bez ograničenja, A13).`
    });
  const applied = reasons.filter((x) => x.applied && x.condition !== 'NO_FACTS');
  const prevNotes = plan.notes.filter((x) => x.startsWith('Adaptacija '));
  const out: TenKV2Plan = {
    ...c,
    weeks,
    notes: [
      ...c.notes,
      ...prevNotes.filter((x) => !c.notes.includes(x)),
      ...applied.map((x) => `Adaptacija ${at}: ${x.message}`)
    ],
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
  return { ok: true, plan: out, changes: diff(plan, out), reasons };
}
