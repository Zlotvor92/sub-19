/* KRUG 15 (briefs/R15-MOTOR.md) — motor nad podacima polumaratona: lagan dan uz dugi ≥ 90 min (M2, M21). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, paceCtxOf, plan, summarize, type PlanDoc } from '../../engine';
import { longEasyFloor } from '../../engine/decide';
import { estimateForm } from '../../fitness';
import { hm } from './index';
import { PROFILES, factsOf } from './testdata/profiles';
import { SCENARIOS } from './testdata/scenarios';

const run = (no: number): any => SCENARIOS.find((s) => s.no === no)?.run();

/** Nedelje u kojima je lagan dan (bez dodatka, ne dan pred trku) ispod poda uz dugi ≥ 90 min. */
function shortEasy(doc: PlanDoc, from = 0): string[] {
  const ctx = paceCtxOf(doc.header);
  const eve = new Date(`${doc.header.goal.raceDate}T00:00:00Z`);
  eve.setUTCDate(eve.getUTCDate() - 1);
  const eveIso = eve.toISOString().slice(0, 10);
  const out: string[] = [];
  for (const w of doc.weeks.slice(from)) {
    const long = w.days.find((d) => d.workout?.kind === 'long')?.workout;
    if (long == null) continue;
    const floor = longEasyFloor(
      doc.header.decisions,
      summarize(long, ctx).durationSec,
      ctx.paces.easy
    );
    if (floor <= 0) continue;
    for (const d of w.days) {
      if (d.workout?.kind !== 'easy' || d.workout.stimulus !== null || d.date === eveIso) continue;
      const sec = summarize(d.workout, ctx).durationSec;
      if (sec < floor - 60) out.push(`n${String(w.index)} ${d.date} ${String(Math.round(sec / 60))} min`);
    }
  }
  return out;
}

describe('krug 15 — lagan dan uz dugi ≥ 90 min (M2, M21)', () => {
  it('svih 12 profila: van silaska lagan dan ≥ 30 min (45 kod 5+ dana i ≥ 55 km) uz dugi ≥ 90 min', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const facts = factsOf(p);
      const state = buildState(facts, p.goal, hm, estimateForm);
      const res = plan(state, p.goal, hm);
      if (!res.ok) throw new Error(p.id);
      /* nedelje −2 i −1 imaju svoj pod (silazak obima) */
      const doc = { ...res.doc, weeks: res.doc.weeks.slice(0, -3) };
      bad.push(...shortEasy(doc).map((x) => `${p.id} ${x}`));
    }
    expect(bad).toEqual([]);
  });

  /* s05 (bolest, p01: ned 12 sa pomerenom proverom), s08 (bolest u ned 13), s14 (bol), s27 (put) */
  it.each([5, 8, 14, 27])('s%i: posle izmene nijedan lagan dan ispod poda uz dugi ≥ 90 min', (no) => {
    const r = run(no);
    expect(shortEasy(r.after)).toEqual([]);
  });

  it('p01: kvalitet ostaje (dva kvaliteta u ned 3 i 5), skraćuje se samo zagrevanje', () => {
    const p = PROFILES.find((x) => x.id === 'p01');
    if (p === undefined) throw new Error('p01');
    const state = buildState(factsOf(p), p.goal, hm, estimateForm);
    const res = plan(state, p.goal, hm);
    if (!res.ok) throw new Error('p01');
    for (const i of [2, 4]) {
      const w = res.doc.weeks[i];
      expect(w?.days.filter((d) => d.workout?.kind === 'quality').length).toBe(2);
    }
  });
});
