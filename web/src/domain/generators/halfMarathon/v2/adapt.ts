/* Segment 04 (hm-v2.3.0, H18): adaptHmV2(plan, facts, asOf) → { ok, plan, changes, reasons } ili
   strukturisano odbijanje { ok: false, reasons, violations }. Tok (Uslov 4): (1) assess.ts — činjenice →
   ograničenja (HmV2AdaptStep); (2) isti konstruktor kao generate (construct) gradi ceo plan sa svim
   koracima; (3) spajanje — dani ≤ asOf, urađeni i zaključani dani ostaju bajt-isti iz prethodnog plana;
   završna zaštita to samo proverava (A11); (4) validate. Bez čitanja sata: asOf je ulaz; isti ulaz → isti
   JSON (A14). */

import { assess, checkFacts, painReturnNote } from './assess.ts';
import { dayNumber, mustDay } from './dates.ts';
import { construct } from './generate.ts';
import { checkInput } from './input.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import { baseFrames, framesFor, newLimits, targetReducedWeek } from './steps.ts';
import type {
  AdaptChange,
  AdaptReason,
  AdaptResult,
  PlanDay,
  PreStartRef,
  Reason,
  HmV2AdaptStep,
  HmV2Plan,
  WorkoutFact
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

/** A15: plan politike hm-v2 (bilo koje verzije) sa ispravnim ulazom i nedeljama; inače null. */
function checkPlan(raw: unknown): HmV2Plan | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as HmV2Plan;
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
function diff(before: HmV2Plan, after: HmV2Plan): AdaptChange[] {
  const out: AdaptChange[] = [];
  const push = (week: number, field: string, b: unknown, a: unknown, date?: string): void => {
    if (!same(b, a))
      out.push({ week, ...(date ? { date } : {}), field, before: String(b), after: String(a) });
  };
  push(0, 'paceBasis', before.paceBasis, after.paceBasis);
  push(0, 'vdot', before.vdot, after.vdot);
  push(0, 'predictedHmSec', before.predictedHmSec, after.predictedHmSec);
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

export function adaptHmV2(rawPlan: unknown, rawFacts: unknown, asOf: unknown): AdaptResult {
  const plan = checkPlan(rawPlan);
  if (!plan) return reject('ADAPT_PLAN_INVALID', 'Plan nije ispravan HM v2 plan (A15).');
  if (dayNumber(asOf) === null)
    return reject('ADAPT_AS_OF_INVALID', 'asOf mora biti ispravan datum YYYY-MM-DD.');
  const at = asOf as string;
  const t = mustDay(at);
  if (t >= mustDay(plan.input.raceDate))
    return reject(
      'ADAPT_AS_OF_INVALID',
      'asOf mora biti pre dana trke (datum trke se ne pomera, A11).'
    );
  const prevSteps: readonly HmV2AdaptStep[] = plan.adaptation?.steps ?? [];
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
  // Pouka 34: referenca umora pre starta — nedelja 1 generatora bez činjenica (isti konstruktor).
  const week1Ref = (): PreStartRef | null => {
    const g = construct(plan.input, []);
    if (!g.ok) return null;
    const w = g.plan.weeks[0]!;
    const dose = (role: string) => w.days.find((d) => d.role === role)?.workout.dose ?? null;
    return {
      targetKm: w.targetKm,
      longKm: w.days.find((d) => d.role === 'long')?.workout.km ?? null,
      q1: dose('q1'),
      q2: dose('q2')
    };
  };
  const as = assess(plan, facts, at, chk.pace, chk.rule.weekMinKm, week1Ref);
  const steps = [...prevSteps, as.step];

  // Zaštita (A11): dani ≤ asOf, urađeni (po dayId ili datumu) i zaključani iz prethodnog plana — konstruktor
  // je zna unapred: prošlost = upisani dani (written.ts, pouka 29).
  const done = new Set(facts.workouts.filter((x) => x.completed).map((x) => x.dayId ?? x.date));
  const locked = new Set(facts.lockedDayIds);
  const keep = (d: PlanDay): boolean =>
    mustDay(d.date) <= t || done.has(d.date) || locked.has(d.date);
  // Pouka 37: urađeni dani posle asOf ulaze u plan (adaptation.doneDayIds) — validator ih, kao zaključane, vidi
  // kao zaštićene (ostatak mešovite nedelje).
  const doneAfter = [...done].filter((id) => ids.has(id) && mustDay(id) > t).sort();
  const factKm = factKmOf(plan, facts, keep, t);
  const prior: Written = {
    weeks: plan.weeks,
    keep,
    asOf: t,
    at,
    lockedDayIds: facts.lockedDayIds,
    doneDayIds: doneAfter,
    factKm
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

  // A4 (pouka 18): poruka PAIN — osnova povratka iz cilja nedelje sidra u konstrukciji (pauza iz istog
  // koraka ga smanjuje, A3); računa je volume.returnBase10 (assess.painReturnNote). A17 (pouka 22):
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
  const testOf = (p: HmV2Plan): number | null =>
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
  const out: HmV2Plan = {
    ...c,
    weeks,
    notes: [
      ...c.notes,
      ...prevNotes.filter((x) => !c.notes.includes(x)),
      ...applied.map((x) => `Adaptacija ${at}: ${x.message}`)
    ],
    warnings: [],
    adaptation: {
      asOf: at,
      steps,
      mixedWeeks: mixed,
      lockedDayIds: facts.lockedDayIds,
      ...(doneAfter.length > 0 ? { doneDayIds: doneAfter } : {}),
      ...(Object.keys(factKm).length > 0 ? { factKm } : {})
    }
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
  // Pouka 20: traka samo za NOVO ograničenje (steps.newLimits; aplikacija čita ovo polje).
  return { ok: true, plan: out, changes: diff(plan, out), reasons, newLimits: newLimits(steps) };
}

/**
 * Pouka 37 (dopuna organizatora, 5K-08i): km zaštićenih dana nedelja koje nisu cele ≤ asOf po ČINJENICAMA — dan u
 * prijavljenoj pauzi 0, dan sa upisanim treningom (dayId, inače datum) zbir upisanih km (completed = false → 0);
 * ostali (asOf bez zapisa, zaključani) ostaju po planu i nisu u mapi. Samo dani čiji se km razlikuje od plana.
 * Zbir čita week.keptSum100 (konstruktor i validator).
 */
function factKmOf(
  plan: HmV2Plan,
  facts: { workouts: readonly WorkoutFact[]; breaks: readonly { from: string; to: string }[] },
  keep: (d: PlanDay) => boolean,
  t: number
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of plan.weeks) {
    if (mustDay(w.endDate) <= t) continue;
    for (const d of w.days) {
      if (!keep(d) || !d.countsToWeek) continue;
      const x = mustDay(d.date);
      const rec = facts.workouts.filter((r) => (r.dayId ?? r.date) === d.date);
      const km = facts.breaks.some((b) => mustDay(b.from) <= x && x <= mustDay(b.to))
        ? 0
        : rec.length > 0
          ? Math.round(rec.reduce((a, r) => a + (r.completed ? r.km : 0), 0) * 100) / 100
          : d.workout.km;
      if (Math.round(km * 100) !== Math.round(d.workout.km * 100)) out[d.date] = km;
    }
  }
  return out;
}

/** Pouka 20: ograničenja (bol, pauza, umor) — traka samo kad korak donese NOVO ograničenje (`newLimits`). */
const LIMIT: ReadonlySet<AdaptReason['condition']> = new Set(['PAIN', 'PAUSE', 'FATIGUE']);
/** Pouka 20: promene cilja obima ili tempa (nov rezultat je nov po definiciji — assess primenjuje samo rezultat
    noviji od rezultata u upotrebi). Premeštanje testa (TEST_MOVED) i neprimenjen rezultat nisu razlog: posledica su
    drugog uslova. */
const CHANGE: ReadonlySet<AdaptReason['condition']> = new Set([
  'NEW_RESULT',
  'UNDER_EXECUTION',
  'OVER_EXECUTION'
]);

/**
 * Pouka 20 — JEDINO pravilo trake „Plan treba prilagoditi" (Faza 4a, oblik maratona posle MAR-06; aplikacija samo zove
 * ovu funkciju): `asOf` je posle poslednje adaptacije plana `before` (isti dan posle primene — prazno) i plan `r` se
 * menja u nedelji koja se završava posle `asOf`; primenjen uslov — promena (nov rezultat, manjak, višak) uvek,
 * ograničenje (bol, pauza, umor) samo kad korak donese NOVO ograničenje (`r.newLimits`), a bol uz to samo uz zapis bola
 * noviji od poslednje adaptacije (period bola je vezan za asOf, A4: isti stari zapis sutradan pomera kraj perioda i
 * newLimits taj dan vidi kao nov — to nije nova činjenica).
 */
export function adaptBanner(
  before: HmV2Plan,
  r: AdaptResult,
  facts: { workouts?: readonly { date: string; pain?: number }[] },
  asOf: string
): string[] {
  if (!r.ok) return [];
  const last = before.adaptation?.asOf ?? null;
  const t = mustDay(asOf);
  if (last !== null && mustDay(last) >= t) return [];
  const future = r.changes.some(
    (c) => c.week > 0 && mustDay(r.plan.weeks[c.week - 1]!.endDate) > t
  );
  if (!future) return [];
  const newPain = (facts.workouts ?? []).some(
    (w) => (w.pain ?? 0) >= P.adapt.painMin && (last === null || mustDay(w.date) > mustDay(last))
  );
  return r.reasons
    .filter(
      (x) =>
        x.applied &&
        (CHANGE.has(x.condition) ||
          (LIMIT.has(x.condition) && r.newLimits.length > 0 && (x.condition !== 'PAIN' || newPain)))
    )
    .map((x) => x.message);
}
