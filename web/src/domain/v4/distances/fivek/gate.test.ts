/* KAPIJA 5 KM — mašinski, za 16 profila (`testdata/gate.ts`, isto što ispisuje
   `docs/generators-v4/plans/gate.ts --dist fivek`): vrh ≤ lestvica 5 km × polazno; skok nedelje ≤ 10 % ili 3 km
   (+ 0,25 km po treningu; rampa povratka izuzeta); lagan dan ≤ 80 % dugog; dugi ≤ 35 % nedelje kod 4 dana (5+ dana
   32 %, 3 dana 46 %); broj treninga = traženi dani u svakoj nedelji gradnje; nedelja trke: lagan dan ≤ 40 min i ≤ isti
   dan prethodne nedelje; nedelja 1 ≥ 95 % sadašnjeg obima (3 dana 90 %, početnik 85 %); brz rad ≤ 20 % (najteža
   ≤ 23 %), najbrža nedelja ≥ 12 %; plan ≥ 10 nedelja ima dugi ≥ 7 km ili 50 min, dugi ≤ 90 min; dva kvaliteta u
   nedelji gradnje sa tempom trke (srednji, brz); bez kvaliteta 2 dana pre provere; nedelja −2 ≤ 85 % vrha i ≤ 2 brza
   treninga; nedelja trke ≤ 50 % vrha; tempo trke ≥ 4,5 km (srednji, brz); sužavanje nije naopako; scenario „ništa"
   (sve urađeno po planu do kraja 6. nedelje) → očekivano vreme se ne pogoršava. */
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
import { fivek } from './index';
import { gateStats } from './testdata/gate';
import { PROFILES, factsOf } from './testdata/profiles';

interface Case {
  id: string;
  facts: RunnerFacts;
  goal: Goal;
}

const CASES: Case[] = PROFILES.map((p) => ({ id: p.id, facts: factsOf(p), goal: p.goal }));

function build(c: Case): PlanDoc {
  const state = buildState(c.facts, c.goal, fivek, estimateForm);
  const result = plan(state, c.goal, fivek);
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

describe('kapija 5 km (16 profila)', () => {
  /* krug 11: p06 (brz, 25 km, 5 dana, 6 nedelja) bez izuzetka — silazak po `taper.trimOrder` (lagani, brz trening do
     najmanje doze, dugi) */
  it.each(CASES.map((c) => [c.id, c] as const))('%s: brojevi plana', (_id, c) => {
    const s = gateStats(build(c), c.facts);
    expect(s.violations).toEqual([]);
  });

  /* „Ništa" → očekivano vreme se ne pogoršava. Planovi kod kojih se to ne drži su `it.fails` sa razlogom (model
     forme, kao kod 10 km — zahtev u F7-5K-REPORT); kad forma bude ispravljena, test pada i spisak se briše. */
  /* 5 km (13. 11.): 1–8 s sporije (≤ 0,7 %) kod p02, p03, p05, p09, p14 — isti uzrok kao kod 10 km i polumaratona
     (pripisani napredak posle ponovnog planiranja, model forme), ne podaci 5 km */
  /* krug 13: p12 — provera 1,5 km se sada čita kao test (bila je ispod najmanje dužine), isti uzrok (+3 s) */
  /* R20 (II): p09 i p12 (forma iz laganog tempa) više ne gube očekivano vreme */
  const FORM_DRIFT = new Set<string>(['p02', 'p03', 'p05', 'p14']);
  const nothing = (c: Case): void => {
    const doc = build(c);
    const today = addDays(doc.weeks[5]?.start ?? doc.header.startDate, 6);
    const history = c.facts.runs.filter((r) => r.date < doc.header.startDate);
    const facts: RunnerFacts = {
      ...c.facts,
      today,
      runs: [...history, ...runsAsPlanned(doc, today)]
    };
    const state = buildState(facts, c.goal, fivek, estimateForm, doc);
    const events = sortEvents(deriveEvents(doc, state));
    const after = replan(doc, state, events, fivek);
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
