/* KRUG 9 (briefs/R9-ROUND9.md § A) — opšta pravila motora, provera nad podacima 10 km. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import {
  buildState,
  guard,
  plan,
  type DistanceData,
  type PlanDoc,
  type RunnerState
} from '../../engine';
import { diffDays } from '../../engine/dates';
import { effortResult, paceAtShare, vdotFromResult } from '../../engine/vdot';
import { ZONE_SHARE } from '../../engine/constants';
import { estimateForm } from '../../fitness';
import { marathon } from './index';
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
  it('profili i svih 29 scenarija 10 km: (b) i (c) važe', () => {
    const bad: string[] = [];
    for (const p of PROFILES) {
      const state = buildState(factsOf(p), p.goal, marathon, estimateForm);
      const r = plan(state, p.goal, marathon);
      if (r.ok) bad.push(...zoneViolations(p.id, r.doc, state, marathon));
    }
    for (const s of SCENARIOS) {
      const r: any = s.run();
      bad.push(...zoneViolations(`s${String(s.no)}`, r.after, r.afterState, marathon));
    }
    expect(bad).toEqual([]);
  });
});

describe('krug 9 — A8: prognoza početnika', () => {
  it('nivo početnika: očekivano najviše 3 % brže od današnje forme; potpuno nov bez napretka u tački', () => {
    let seen = 0;
    for (const p of PROFILES) {
      const r = plan(buildState(factsOf(p), p.goal, marathon, estimateForm), p.goal, marathon);
      if (!r.ok) continue;
      const h = r.doc.header;
      const max = marathon.safety.forecastMaxGainByLevel?.[h.decisions.level];
      if (max === undefined) continue;
      seen += 1;
      expect(h.form.raceDay.expectedSec, p.id).toBeGreaterThanOrEqual(
        Math.round(h.form.current.raceTimeSec * (1 - max)) - 1
      );
    }
    expect(seen).toBeGreaterThan(0);
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
  it('svih 29 scenarija: čuvar nad planom posle izmene nema nalaza', () => {
    const bad: string[] = [];
    /* E5 (s17–s20) je nov plan iz novog stanja, ne izmena */
    for (const s of SCENARIOS.filter((x) => !x.title.startsWith('E5'))) {
      const r: any = s.run();
      /* samo nalazi koje je događaj uveo (prvobitan plan ima svoje opravdane nalaze profila) */
      const key = (f: { check: string; weekIndex: number | null }): string =>
        `${f.check}@${String(f.weekIndex)}`;
      const before = new Set(guard(r.before, r.beforeState ?? r.afterState, marathon).map(key));
      for (const f of guard(r.after, r.afterState, marathon))
        if (!before.has(key(f))) bad.push(`s${String(s.no)} ${key(f)}`);
    }
    /* poznato (maraton, 13. 11.; zahtevi u F7-MAR-REPORT): dugi-za-distancu posle događaja kod početnika malog obima
       (p11: najduži dugi posle izmene ispod 27 km — plan to kaže upozorenjem); ostalo su putevi izmene motora
       (povratak posle bolesti, bol, nadovezani prozori) */
    /* krug 10: preostali: s15 dugi posle bola raste po R2, s25 udeo brzog u nedelji izmene */
    /* krug 12 (maraton): p11 posle bolesti/bola gubi najduži dugi ispod 27 km — plan to kaže upozorenjem (s7, s26);
       s26 silazak N−2 posle trke u prozoru bola — motor (M3) */
    const KNOWN_A6 = new Set<string>([
      's15 dugi-za-distancu@17',
      's25 brz-udeo@6',
      's7 dugi-za-distancu@13',
      's26 dugi-za-distancu@19',
      's26 silazak@22',
      /* krug 17 (dopuna sudije 2): 3 dana (p08) posle pripremnog polumaratona — lagani dani vezani za dugi (s2);
         lestvica dugog posle bolesti u N−7 (s6, motor M2); p11 posle bolesti/bola (s7, s26) */
      's2 ispod-cilja@20',
      's6 dugi-korak@21',
      's7 dugi-za-distancu@19',
      's26 ispod-cilja@18'
    ]);
    expect(bad.filter((b) => !KNOWN_A6.has(b))).toEqual([]);
  });
});

describe('krug 9 — A3: tekst o tempu prati zone', () => {
  it('„tempa su ubrzana/usporena" samo kad sve zone idu u istom smeru', () => {
    const bad: string[] = [];
    for (const s of SCENARIOS) {
      const r: any = s.run();
      const text = (r.changes as any[]).map((c) => String(c.reason ?? '')).join(' ');
      const a = r.after.header.paces;
      const b = r.before.header.paces;
      const zs = ['T', 'RP', 'I'] as const;
      if (/tempa su ubrzana/.test(text) && zs.some((z) => a[z] > b[z]))
        bad.push(`s${String(s.no)} ubrzana`);
      if (/tempa su usporena/.test(text) && zs.some((z) => a[z] < b[z]))
        bad.push(`s${String(s.no)} usporena`);
    }
    expect(bad).toEqual([]);
  });
});
