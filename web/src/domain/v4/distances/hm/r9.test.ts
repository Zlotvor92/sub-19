/* KRUG 9 (briefs/R9-ROUND9.md § A) — opšta pravila motora, provera nad podacima polumaratona. */
/* eslint-disable @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, plan, type DistanceData, type PlanDoc, type RunnerState } from '../../engine';
import { diffDays } from '../../engine/dates';
import { effortResult, paceAtShare, vdotFromResult } from '../../engine/vdot';
import { ZONE_SHARE } from '../../engine/constants';
import { estimateForm } from '../../fitness';
import { hm } from './index';
import { OWNER_PLANS } from './testdata/owner';
import { PROFILES, factsOf } from './testdata/profiles';
import { SCENARIOS } from './testdata/scenarios';

/** Stvarni rezultati trkača (unet + trke/testovi iz trčanja) u poslednjih 12 nedelja: dužina, vreme. */
export function realResults(state: RunnerState): { distanceM: number; sec: number }[] {
  const out: { distanceM: number; sec: number }[] = [];
  const r = state.profile.recentResult;
  if (r !== undefined && (r.date === undefined || diffDays(state.today, r.date) <= 84))
    out.push({ distanceM: r.distanceM, sec: r.timeSec });
  for (const run of state.runs) {
    if (run.effort === undefined && (run.plannedEffortM ?? 0) <= 0) continue;
    if (diffDays(state.today, run.date) > 84 || run.date > state.today) continue;
    const e = effortResult(run);
    if (e !== null) out.push({ distanceM: e.distanceM, sec: e.durationSec });
  }
  return out;
}

/** A14 (b), (c): zone nisu brže od onoga što je trkač istrčao (+ 1 s zaokruživanja). */
export function zoneViolations(
  id: string,
  doc: PlanDoc,
  state: RunnerState,
  data: DistanceData
): string[] {
  const p = doc.header.paces;
  if (p.byFeel) return [];
  const bad: string[] = [];
  const results = realResults(state);
  /* (b) VDOT zone ≤ najveći sirovi VDOT rezultata kraćeg od cilja (i ne ispod forme na cilju) */
  const shorter = results.filter((x) => x.distanceM < data.distanceM - 1);
  if (shorter.length > 0) {
    const v = Math.max(
      doc.header.form.paceVdot,
      ...shorter.map((x) => vdotFromResult(x.distanceM, x.sec))
    );
    for (const z of ['T', 'I', 'R'] as const)
      if (p[z] < paceAtShare(v, ZONE_SHARE[z]) - 1.5)
        bad.push(`${id} ${z} ${p[z].toFixed(0)} brže od najboljeg kraćeg rezultata`);
  }
  for (const x of results) {
    const pace = (x.sec / x.distanceM) * 1000;
    if (x.sec >= 2400 && x.sec <= 4200 && p.T < pace - 1.5)
      bad.push(`${id} prag ${p.T.toFixed(0)} < trka ${pace.toFixed(0)} s/km`);
    if (x.sec <= 900 && p.I < pace - 1.5)
      bad.push(`${id} I ${p.I.toFixed(0)} < trka ${pace.toFixed(0)} s/km`);
  }
  return bad;
}

describe('krug 9 — A14: zone nikad brže od same trke', () => {
  it('profili, vlasnik i svih 27 scenarija polumaratona: (b) i (c) važe', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const state = buildState(factsOf(p), p.goal, hm, estimateForm);
      const r = plan(state, p.goal, hm);
      if (r.ok) bad.push(...zoneViolations(p.id, r.doc, state, hm));
    }
    for (const o of OWNER_PLANS) {
      const state = buildState(o.facts, o.goal, hm, estimateForm);
      const r = plan(state, o.goal, hm);
      if (r.ok) bad.push(...zoneViolations(o.id, r.doc, state, hm));
    }
    for (const s of SCENARIOS) {
      const r: any = s.run();
      bad.push(...zoneViolations(`s${String(s.no)}`, r.after, r.afterState, hm));
    }
    expect(bad).toEqual([]);
  });
});
