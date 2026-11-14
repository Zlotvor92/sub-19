/* R24 (coach/R24-ISPRAVKA.md, P2) — nivo `pocetnik-nov` po stažu (≤ 12 nedelja), ne po jednom testu: početnik sa 6
   nedelja trčanja koji je istrčao test na 10 km (par P2 B) nema računat napredak i dobija rečenicu o cilju i nastavku
   posle trke; početnik sa 8 meseci staža (p11, P2 A) ostaje `pocetnik`. */
import { describe, expect, it } from 'vitest';
import { buildState, plan, renderPlan } from '../../engine';
import type { RunnerFacts } from '../../engine/types';
import { estimateForm } from '../../fitness';
import { fivek } from './index';
import { factsOf, PROFILES } from './testdata/profiles';

const p11 = PROFILES.find((p) => p.id === 'p11');
if (p11 === undefined) throw new Error('p11');

function make(yearsRunning: number): { level: string; text: string } {
  const base = factsOf(p11 as NonNullable<typeof p11>);
  /* kao par P2 B (`docs/generators-v4/plans/pairs.ts`): test na 10 km za 56:02 pre 1 nedelje, najduže 10 km */
  const facts: RunnerFacts = {
    ...base,
    profile: {
      ...base.profile,
      yearsRunning,
      longestRecentKm: 10,
      recentResult: { distanceM: 10000, timeSec: 3362, date: '2026-10-25' }
    }
  };
  const goal = (p11 as NonNullable<typeof p11>).goal;
  const st = buildState(facts, goal, fivek, estimateForm);
  const r = plan(st, goal, fivek);
  if (!r.ok) throw new Error('plan');
  return { level: r.doc.header.decisions.level, text: renderPlan(r.doc, st, fivek) };
}

describe('R24 P2 — nivo hod-trk početnika po stažu', () => {
  it('6 nedelja staža i test na 10 km: pocetnik-nov, bez napretka, rečenica o nastavku posle trke', () => {
    const b = make(0.1);
    expect(b.level).toBe('pocetnik-nov');
    expect(b.text).toMatch(
      /Očekivano na dan trke: [\d:]+ \(raspon [^)]*\) — bez računanja napretka/
    );
    expect(b.text).toContain('Posle trke nastavi');
  });
  it('8 meseci staža (P2 A, p11): ostaje pocetnik', () => {
    expect(make(0.7).level).toBe('pocetnik');
  });
});
