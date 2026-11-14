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
