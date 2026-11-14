/* R20 B5 (briefs/R20.md, MOTOR B) — raspon prognoze nikad naopako, nad SVIM profilima i scenarijima svih distanci:
   spora strana raspona (sporija granica − očekivano) nije uža od brze (očekivano − brža granica). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
   -- profili i scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, plan, type DistanceData } from '../engine';
import { estimateForm } from '../fitness';

const dataMods = import.meta.glob<Record<string, unknown>>('./*/index.ts', { eager: true });
const profMods = import.meta.glob<Record<string, unknown>>('./*/testdata/profiles.ts', {
  eager: true
});
const scenMods = import.meta.glob<Record<string, unknown>>('./*/testdata/scenarios.ts', {
  eager: true
});
const DIST = Object.entries(dataMods).map(([path, mod]) => {
  const data = Object.values(mod).find(
    (v): v is DistanceData => typeof v === 'object' && v !== null && 'adequate' in v && 'id' in v
  );
  if (data === undefined) throw new Error(path);
  const p = profMods[path.replace('index.ts', 'testdata/profiles.ts')] as any;
  const sc = scenMods[path.replace('index.ts', 'testdata/scenarios.ts')] as any;
  return {
    data,
    profiles: p.PROFILES as any[],
    factsOf: p.factsOf as (x: any) => any,
    scenarios: (sc?.SCENARIOS ?? []) as any[]
  };
});

const upside = (r: any): boolean => r.highSec - r.expectedSec + 1 < r.expectedSec - r.lowSec;

describe('R20 B5 — raspon prognoze nije naopako (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))('%s', (_id, d) => {
    const bad: string[] = [];
    for (const p of d.profiles) {
      const res = plan(buildState(d.factsOf(p), p.goal, d.data, estimateForm), p.goal, d.data);
      if (res.ok && upside(res.doc.header.form.raceDay)) bad.push(String(p.id));
    }
    for (const s of d.scenarios) {
      const r = s.run();
      if (upside(r.after.header.form.raceDay)) bad.push(`s${String(s.no)}`);
    }
    expect(bad).toEqual([]);
  });
});

/* R20 B5 (drugi deo): uneti lagan tempo — plan kaže kad se njegov lagan tempo razlikuje od unetog (5K p10 po
   osećaju: km sa 8:07 uz uneti 7:30; 5K s04: rezultat protivreči unetom tempu 7:00). */
describe('R20 B5 — uneti lagan tempo i plan (5 km)', () => {
  const fivek = DIST.find((d) => d.data.id === 'fivek');
  it('po osećaju (p10) i posle rezultata (s04) rečenica postoji', async () => {
    const { renderPlan } = await import('../engine');
    if (fivek === undefined) throw new Error('fivek');
    const p = fivek.profiles.find((x) => x.id === 'p10');
    const st = buildState(fivek.factsOf(p), p.goal, fivek.data, estimateForm);
    const res = plan(st, p.goal, fivek.data);
    if (!res.ok) throw new Error('p10');
    expect(renderPlan(res.doc, st, fivek.data)).toContain(
      'sporije od tvog unetog laganog tempa (7:30/km)'
    );
    const s = fivek.scenarios.find((x) => x.no === 4);
    const r = s.run();
    expect(renderPlan(r.after, r.afterState, fivek.data)).toContain(
      'Tvoj uneti lagan tempo (7:00/km) je brži'
    );
  });
});

/* R20 (II): bez rezultata, prognoza iz laganog tempa — tempo trke na cilju nije brži od (lagan − granica distance):
   ≈ 30 s/km za 42,2 km, 45 za 21,1, 60 za 10, 75 za 5 km (početnik dve trećine). */
describe('R20 (II) — forma iz laganog tempa je oprezna (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))('%s', (_id, d) => {
    const bad: string[] = [];
    for (const p of d.profiles) {
      const easy = p.profile.easyPaceSecPerKm;
      if (easy === undefined || p.profile.recentResult !== undefined) continue;
      const st = buildState(d.factsOf(p), p.goal, d.data, estimateForm);
      const m = d.data.distanceM;
      const margin = 30 + 15 * Math.max(0, Math.log2(42195 / m));
      const pace = (st.form.current.raceTimeSec / m) * 1000;
      if (pace < easy - margin - 1)
        bad.push(`${String(p.id)} ${pace.toFixed(0)} < ${String(easy)} − ${margin.toFixed(0)}`);
    }
    expect(bad).toEqual([]);
  });
});
