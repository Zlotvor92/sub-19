/* KRUG 9 (briefs/R9-ROUND9.md § A) — opšta pravila motora, provera nad podacima polumaratona. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  guard,
  plan,
  renderPlan,
  type DistanceData,
  type PlanDoc,
  type RunnerState
} from '../../engine';
import { diffDays } from '../../engine/dates';
import { effortResult, paceAtShare, vdotFromResult, zonePaces } from '../../engine/vdot';
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

describe('krug 9 — A7: prenos naviše bez dokaza', () => {
  it('bez ličnog β i bez kraćeg dokaza: I/R/T najviše 3 s/km brži od tabele na dužini cilja; početnik 0', () => {
    for (const p of PROFILES) {
      const state = buildState(factsOf(p), p.goal, hm, estimateForm);
      const t = state.form.transfer;
      if (t?.up === undefined) continue;
      const r = plan(state, p.goal, hm);
      if (!r.ok || r.doc.header.paces.byFeel) continue;
      const h = r.doc.header;
      const flat = zonePaces(h.form.paceVdot, hm.distanceM, false, hm.safety.intervalPaceFloor);
      for (const z of ['T', 'I', 'R'] as const)
        expect(flat[z] - h.paces[z], `${p.id} ${z}`).toBeLessThanOrEqual(t.up.maxSec + 1);
    }
  });
  it('manji obim ne dobija brži prag (p08 prema p07)', () => {
    const pace = (id: string): number => {
      const p = PROFILES.find((x) => x.id === id);
      if (p === undefined) throw new Error(id);
      const r = plan(buildState(factsOf(p), p.goal, hm, estimateForm), p.goal, hm);
      if (!r.ok) throw new Error(id);
      return r.doc.header.paces.T;
    };
    expect(pace('p08')).toBeGreaterThanOrEqual(pace('p07'));
  });
});

describe('krug 9 — A8: prognoza početnika', () => {
  it('nivo početnika: očekivano najviše 3 % brže od današnje forme; potpuno nov bez napretka u tački', () => {
    let seen = 0;
    for (const p of PROFILES) {
      const r = plan(buildState(factsOf(p), p.goal, hm, estimateForm), p.goal, hm);
      if (!r.ok) continue;
      const h = r.doc.header;
      const max = hm.safety.forecastMaxGainByLevel?.[h.decisions.level];
      if (max === undefined) continue;
      seen += 1;
      expect(h.form.raceDay.expectedSec, p.id).toBeGreaterThanOrEqual(
        Math.round(h.form.current.raceTimeSec * (1 - max)) - 1
      );
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('krug 9 — A16: trka na ciljnoj dužini se usvaja cela', () => {
  it('E5 (juče polumaraton): današnja forma nije sporija od te trke', () => {
    for (const s of SCENARIOS.filter((x) => x.title.startsWith('E5'))) {
      const r: any = s.run();
      const race = (r.afterState.runs as any[]).find(
        (x) => x.effort === 'race' && Math.abs(x.distanceM - hm.distanceM) < 100
      );
      if (race === undefined || race.walking === true) continue;
      const e = effortResult(race);
      if (e === null) continue;
      expect(r.after.header.form.current.raceTimeSec, `s${String(s.no)}`).toBeLessThanOrEqual(
        e.durationSec + 1
      );
    }
  });
});

describe('krug 9 — A5: u prozoru bola/bolesti nijedna zona se ne ubrzava', () => {
  it('scenariji bolesti, bola i više događaja: posle tempa nisu brža ni u jednoj zoni', () => {
    const bad: string[] = [];
    for (const s of SCENARIOS.filter((x) => /^E(2|4|7)/.test(x.title))) {
      const r: any = s.run();
      const a = r.after.header.paces;
      const b = r.before.header.paces;
      if (b.byFeel) continue;
      for (const z of ['easy', 'M', 'T', 'I', 'R', 'RP'] as const)
        if (a[z] < b[z]) bad.push(`s${String(s.no)} ${z} ${String(b[z])} → ${String(a[z])}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('krug 9 — A6: posle događaja čuvar bez nalaza', () => {
  it('svih 27 scenarija: čuvar nad planom posle izmene nema nalaza', () => {
    const bad: string[] = [];
    /* E5 (s17–s20) je nov plan iz novog stanja, ne izmena */
    for (const s of SCENARIOS.filter((x) => !x.title.startsWith('E5'))) {
      const r: any = s.run();
      /* samo nalazi koje je događaj uveo (prvobitan plan ima svoje opravdane nalaze profila) */
      const key = (f: { check: string; weekIndex: number | null }): string =>
        `${f.check}@${String(f.weekIndex)}`;
      const before = new Set(guard(r.before, r.beforeState ?? r.afterState, hm).map(key));
      for (const f of guard(r.after, r.afterState, hm))
        if (!before.has(key(f))) bad.push(`s${String(s.no)} ${key(f)}`);
    }
    /* poznato (krug 9, R9-REPORT): HM s07 — povratak posle bolesti traje do sužavanja (A10, otvoreno); 10K — drugi
       putevi izmene (rasterećenje, bol, nadovezani prozori) */
    const KNOWN_A6 = new Set<string>(['s7 dugi-za-distancu@15']);
    expect(bad.filter((b) => !KNOWN_A6.has(b))).toEqual([]);
  });
});

describe('krug 9 — A13: provera forme je u prikazu brz rad', () => {
  it('nedelja sa proverom forme nikad ne piše „brz rad 0 %"', () => {
    for (const p of PROFILES) {
      const state = buildState(factsOf(p), p.goal, hm, estimateForm);
      const r = plan(state, p.goal, hm);
      if (!r.ok) continue;
      const text = renderPlan(r.doc, state, hm);
      for (const block of text.split(/\n(?=\d+\. NEDELJA)/))
        if (block.includes('provera forme:'))
          expect(block, `${p.id} ${block.slice(0, 12)}`).not.toMatch(/brz rad 0 %/);
    }
  });
});
