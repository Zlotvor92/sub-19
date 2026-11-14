/* R24 (M2) — svojstvo nad scenarijima E4 SVIH distanci: posle bola nivoa 4–6 prijavljenog posle dugog, od kraja zaštite
   (dan 10) do prvog brzog treninga najviše 7 dana (osim kad je do trke < 10 dana); prvi brzi je prag u komadu, ne ispod
   najmanje smislene doze (R22 A3, microDose.test.ts). Tvrdnja: 10K s15 — 28. 1. prag u komadu. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import type { DistanceData } from '../engine';
import { addDays, diffDays } from '../engine/dates';

const dataMods = import.meta.glob<Record<string, unknown>>('./*/index.ts', { eager: true });
const scenMods = import.meta.glob<Record<string, unknown>>('./*/testdata/scenarios.ts', {
  eager: true
});
const DIST = Object.entries(dataMods).map(([path, mod]) => {
  const data = Object.values(mod).find(
    (v): v is DistanceData => typeof v === 'object' && v !== null && 'adequate' in v && 'id' in v
  );
  if (data === undefined) throw new Error(path);
  const scen = scenMods[path.replace('index.ts', 'testdata/scenarios.ts')];
  return { data, scenarios: (scen?.SCENARIOS ?? []) as any[] };
});

const fast = (w: any): boolean =>
  w !== null && (w.kind === 'quality' || w.kind === 'test' || w.kind === 'race');

describe('R24 (M2) — posle bola prvi brzi trening postoji (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: E4, bol posle dugog — prvi brzi ≤ 7 dana posle kraja zaštite',
    (_id, d) => {
      const bad: string[] = [];
      for (const s of d.scenarios.filter((x) => /^E4:/.test(String(x.title)))) {
        const r = s.run();
        const pain = ((r.after.header.adjustments ?? []) as any[]).find((a) => a.kind === 'pain');
        if (pain === undefined || pain.level < 4 || pain.level > 6) continue;
        const before = (r.before.weeks as any[]).flatMap((w) => w.days);
        if (before.find((x: any) => x.date === pain.date)?.workout?.kind !== 'long') continue;
        const race: string = r.after.header.goal.raceDate;
        const end = addDays(pain.date, 10);
        if (diffDays(race, end) < 17) continue;
        const days = (r.after.weeks as any[]).flatMap((w) => w.days);
        const first = days.find((x: any) => x.date > pain.date && fast(x.workout));
        if (first === undefined || diffDays(first.date, end) > 7)
          bad.push(
            `s${String(s.no)}: prvi brzi ${String(first?.date ?? '—')} (kraj zaštite ${end})`
          );
      }
      expect(bad).toEqual([]);
    },
    60_000
  );

  it('10K s15: 28. 1. prag u komadu (tempo trke sledeće nedelje samo kad nedelja ne skače > 20 %)', () => {
    const d = DIST.find((x) => x.data.id === 'tenk');
    const r = d?.scenarios.find((s) => s.no === 15)?.run();
    const days = (r.after.weeks as any[]).flatMap((w) => w.days);
    const day = days.find((x: any) => x.date === '2027-01-28');
    expect(day.workout.kind).toBe('quality');
    expect(String(day.workout.text)).toContain('u komadu');
  });
});
