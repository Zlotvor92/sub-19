/* R20 B1 (briefs/R20.md, MOTOR B) — dugi u nedelji 1 i plafon dugog prema istoriji, nad SVIM distancama (svojstvo):
   (a) profil sa unetim najdužim skorašnjim trčanjem: prvi dugi plana ≤ taj + 2 km (+ 0,5 km zaokruživanja dana);
   (b) trkač koji redovno trči dugi od 18 km (svake druge nedelje, 12 nedelja): prvi dugi ≤ 18 + 2 km, a najduži dugi
       plana nije kraći od onoga što već trči (plafon dugog važi za rast, ne spušta ispod navike). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
   -- profili su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, paceCtxOf, plan, type DistanceData, type Run } from '../engine';
import { weekCost } from '../engine/guard';
import { estimateForm } from '../fitness';

const dataMods = import.meta.glob<Record<string, unknown>>('./*/index.ts', { eager: true });
const profMods = import.meta.glob<Record<string, unknown>>('./*/testdata/profiles.ts', {
  eager: true
});
const DIST = Object.entries(dataMods).map(([path, mod]) => {
  const data = Object.values(mod).find(
    (v): v is DistanceData => typeof v === 'object' && v !== null && 'adequate' in v && 'id' in v
  );
  if (data === undefined) throw new Error(path);
  const p = profMods[path.replace('index.ts', 'testdata/profiles.ts')] as any;
  return { data, profiles: p.PROFILES as any[], factsOf: p.factsOf as (x: any) => any };
});

/** km dugih po nedeljama plana (0 = nedelja bez dugog). */
function longs(doc: any): number[] {
  const ctx = paceCtxOf(doc.header);
  return doc.weeks.map((w: any) => {
    let km = 0;
    for (const d of w.days) {
      if (d.workout?.kind !== 'long') continue;
      km = Math.max(km, weekCost({ ...w, days: [d] }, doc.header.goal.raceDate, ctx).km);
    }
    return km;
  });
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}

describe('R20 B1 — dugi u nedelji 1 i navika dugog (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: uneti najduži + 2 km',
    (_id, d) => {
      const bad: string[] = [];
      for (const p of d.profiles.filter((x) => (x.profile.longestRecentKm ?? 0) > 0)) {
        const facts = d.factsOf(p);
        const res = plan(buildState(facts, p.goal, d.data, estimateForm), p.goal, d.data);
        if (!res.ok) throw new Error(p.id);
        const first = longs(res.doc).find((k) => k > 0) ?? 0;
        if (first > p.profile.longestRecentKm + 2.5)
          bad.push(`${String(p.id)} prvi dugi ${first.toFixed(1)} uz ${String(p.profile.longestRecentKm)}`);
      }
      expect(bad).toEqual([]);
    }
  );

  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: istorija 14/18 km — prvi ≤ 20 km, najduži ≥ 18 km',
    (_id, d) => {
      const base = d.profiles.find((x) => x.runDays.length >= 4) ?? d.profiles[0];
      const runs: Run[] = [];
      for (let k = 0; k < 12; k += 1) {
        const mon = addDays('2026-10-26', -7 * (11 - k));
        [1, 3, 5].forEach((day, j) =>
          runs.push({ id: `e${String(k)}-${String(j)}`, date: addDays(mon, day), distanceM: 9000, durationSec: 9 * 430 })
        );
        const km = k % 2 === 0 ? 14 : 18;
        runs.push({ id: `l${String(k)}`, date: addDays(mon, 6), distanceM: km * 1000, durationSec: km * 435 });
      }
      const facts = {
        ...d.factsOf(base),
        today: '2026-11-01',
        availability: { runDays: [1, 3, 5, 6], longDay: 6 },
        profile: { ...base.profile, weeklyKm: 43, longestRecentKm: 18 },
        runs
      };
      const res = plan(buildState(facts, base.goal, d.data, estimateForm), base.goal, d.data);
      if (!res.ok) throw new Error('plan');
      const ks = longs(res.doc);
      const first = ks.find((k) => k > 0) ?? 0;
      expect(first, 'prvi dugi').toBeLessThanOrEqual(20.5);
      expect(Math.max(...ks), 'najduži dugi').toBeGreaterThanOrEqual(17.5);
    }
  );
});
