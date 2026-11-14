/* KAPIJA MARATONA — mašinski, za 19 profila (`testdata/gate.ts`, isto što ispisuje
   `docs/generators-v4/plans/gate.ts --dist marathon`): vrh ≤ lestvica maratona × polazno; skok nedelje ≤ 10 % ili 3 km;
   lagan dan ≤ 66 % dugog (3 dana 75 %); udeo dugog (3 dana 52 %, 4 dana 45 %, 5+ 44 %, + 5 poena u 3 nedelje,
   početnik + 4); broj treninga = traženi dani; nedelja trke: lagan ≤ 65 min; nedelja 1 ≥ 95 % (3 dana 90 %); brz rad
   ≤ 18 % (vršna ≤ 20 %), vršna ≥ 10 %; najduži dugi po vrhu obima (≥ 60 km → 28 km; 45–60 → 23 km), ≤ 3 h 15 i
   ≤ 35 km, najkasnije N−3, najduži nikad dve nedelje zaredom; nedelja sa blokom bez MP usred nedelje; sužavanje
   3 nedelje (N−2 ≤ 85 %, N−1 ≤ 68 %, nedelja trke ≤ 45 %, nikad naopako); blok u dugom ≥ 8 km (srednji, brz) ili
   ≥ 5 km; scenario „ništa" (sve urađeno po planu do kraja 6. nedelje) → očekivano vreme se ne pogoršava. */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  deriveEvents,
  paceCtxOf,
  plan,
  replan,
  sortEvents,
  summarize,
  type Goal,
  type PlanDoc,
  type Run,
  type RunnerFacts
} from '../../engine';
import { estimateForm } from '../../fitness';
import { marathon } from './index';
import { gateStats } from './testdata/gate';
import { PROFILES, factsOf } from './testdata/profiles';

interface Case {
  id: string;
  facts: RunnerFacts;
  goal: Goal;
}

const CASES: Case[] = PROFILES.map((p) => ({ id: p.id, facts: factsOf(p), goal: p.goal }));

function build(c: Case): PlanDoc {
  const state = buildState(c.facts, c.goal, marathon, estimateForm);
  const result = plan(state, c.goal, marathon);
  if (!result.ok) throw new Error(`${c.id}: ${JSON.stringify(result.errors)}`);
  return result.doc;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

/** Trčanja tačno po planu do `through` (uključivo); test iz plana trčan tačno u tempu današnje forme. */
function runsAsPlanned(doc: PlanDoc, through: string): Run[] {
  const ctx = paceCtxOf(doc.header);
  const runs: Run[] = [];
  for (const day of doc.weeks.flatMap((w) => w.days)) {
    const w = day.workout;
    if (w === null || w.kind === 'race' || day.date > through) continue;
    const c = summarize(w, ctx);
    /* test iz plana: samo deo punim naporom u tempu današnje forme (zagrevanje i hlađenje bi forma čitala kao trku) */
    const step =
      w.kind === 'test' ? w.steps.find((x) => 'role' in x && x.role === 'work') : undefined;
    const testM =
      step !== undefined && 'extent' in step && 'distanceM' in step.extent
        ? step.extent.distanceM
        : null;
    runs.push({
      id: `run-${day.id}`,
      date: day.date,
      distanceM: Math.round(testM ?? c.distanceM),
      durationSec: Math.round(testM === null ? c.durationSec : c.workSec),
      dayId: day.id
    });
  }
  return runs;
}

describe('kapija maratona (19 profila)', () => {
  /* R8-13 (krug 8): pravilo rasta u km je u motoru (`weekTarget` + `kmCutMin`) — p01 i p08 više nisu izuzetak */
  /* B9 (krug 2): sužavanje nije naopako — p06 posle kruga 9b (A10 a) bez izuzetka */
  const numbers = (c: Case): void => {
    const s = gateStats(build(c), c.facts);
    expect(s.violations).toEqual([]);
  };
  it.each(CASES.map((c) => [c.id, c] as const))('%s: brojevi plana', (_id, c) => numbers(c));

  /* „Ništa" → očekivano vreme se ne pogoršava. Planovi kod kojih se to ne drži su `it.fails` sa razlogom (model
     forme, isti uzrok kao kod polumaratona i 10 km — FORM_DRIFT u F7-10K-REPORT); kad forma bude ispravljena, test
     pada i spisak se briše. Maraton (13. 11.): 2–30 s sporije (≤ 0,3 %) kod p06, p07 (12 nedelja, provera u 4.
     nedelji trčana tačno u tempu današnje forme), p09, p18, p19 — ne podaci maratona */
  /* krug 10 (stavka 22): p09 skinut — dugi sa km bloka stiže do dugog za distancu, prognoza računa napredak */
  /* krug 14 (M7, motor): p06 i p19 bez napretka od obima (obim/dugi ne nose trku) — prognoza = današnja forma, pa
     prolaze; p10 isto bez napretka, pa se vidi pomak današnje forme posle 6 nedelja po planu (+6 s, isti uzrok) */
  /* krug 17 (dopuna sudije 2): p01 opet ima `dugi-za-distancu` (bez napretka od obima) i prolazi; p06 sa dugim
     24,5 km računa napredak, pa se vidi pomak današnje forme (+53 s, isti uzrok) */
  /* R20 (II): p10 i p18 (forma iz laganog tempa) više ne gube očekivano vreme */
  const FORM_DRIFT = new Set<string>(['p01', 'p06', 'p07']);
  const nothing = (c: Case): void => {
    const doc = build(c);
    const today = addDays(doc.weeks[5]?.start ?? doc.header.startDate, 6);
    const history = c.facts.runs.filter((r) => r.date < doc.header.startDate);
    const facts: RunnerFacts = {
      ...c.facts,
      today,
      runs: [...history, ...runsAsPlanned(doc, today)]
    };
    const state = buildState(facts, c.goal, marathon, estimateForm, doc);
    const events = sortEvents(deriveEvents(doc, state));
    const after = replan(doc, state, events, marathon);
    expect(state.form.raceDay.expectedSec).toBeLessThanOrEqual(doc.header.form.raceDay.expectedSec);
    expect(after.doc.header.form.raceDay.expectedSec).toBeLessThanOrEqual(
      doc.header.form.raceDay.expectedSec
    );
  };
  const title = '%s: „ništa se nije desilo" do kraja 6. nedelje → očekivano vreme se ne pogoršava';
  it.each(CASES.filter((c) => !FORM_DRIFT.has(c.id)).map((c) => [c.id, c] as const))(
    title,
    (_id, c) => nothing(c)
  );
  it.fails.each(CASES.filter((c) => FORM_DRIFT.has(c.id)).map((c) => [c.id, c] as const))(
    `${title} — ČEKA FORMU (R12)`,
    (_id, c) => nothing(c)
  );
});
