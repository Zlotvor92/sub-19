/* R22 (A4) — svojstvo nad scenarijima SVIH distanci: posle pauze > 4 dana prvi dan trčanja nije dugi i nije duži od
   istog dana u planu pre događaja; u 6 nedelja posle prekida dugi nije duži od dugog istog dana u planu pre događaja. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { paceCtxOf, summarize, type DistanceData } from '../engine';
import { addDays } from '../engine/dates';
import { pauseLength } from '../engine/readiness';

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

describe('R22 (A4) — povratak posle pauze (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: prvi dan posle pauze nije dugi ni duži od plana; dugi u povratku ≤ plan pre događaja',
    (_id, d) => {
      const bad: string[] = [];
      let seen = 0;
      for (const s of d.scenarios) {
        if (String(s.title).startsWith('E5')) continue;
        const r = s.run();
        const old = new Set(
          ((r.before.header.adjustments ?? []) as any[]).map((a) => JSON.stringify(a))
        );
        const pause = ((r.after.header.adjustments ?? []) as any[]).find(
          (a) => !old.has(JSON.stringify(a)) && a.kind === 'pause' && pauseLength(a.from, a.to) > 4
        );
        if (pause === undefined) continue;
        seen += 1;
        const tag = `s${String(s.no)}`;
        const today: string = r.afterState.today;
        const pb = paceCtxOf(r.before.header);
        const pa = paceCtxOf(r.after.header);
        const before = new Map<string, any>(
          (r.before.weeks as any[]).flatMap((w) => w.days).map((x: any) => [x.date, x])
        );
        const days = (r.after.weeks as any[])
          .filter((w) => w.intent.kind !== 'taper' && w.intent.kind !== 'race')
          .flatMap((w) => w.days)
          .filter((x: any) => x.date > pause.to && x.date > today && x.workout !== null);
        const first = days[0];
        if (first !== undefined && first.origin !== 'manual' && !first.locked) {
          const b = before.get(first.date)?.workout;
          if (first.workout.kind === 'long')
            bad.push(
              `${tag} ${String(first.date)} prvi dan posle pauze: ${String(first.workout.text)}`
            );
          else if (
            b?.kind === 'easy' &&
            first.workout.kind === 'easy' &&
            summarize(first.workout, pa).durationSec > summarize(b, pb).durationSec + 300
          )
            bad.push(
              `${tag} ${String(first.date)} prvi dan duži od plana: ${String(first.workout.text)}`
            );
        }
        for (const x of days) {
          if (x.date > addDays(pause.to, 42) || x.workout.kind !== 'long') continue;
          const b = before.get(x.date)?.workout;
          if (b?.kind !== 'long') continue;
          if (summarize(x.workout, pa).durationSec > summarize(b, pb).durationSec + 120)
            bad.push(
              `${tag} ${String(x.date)} dugi ${String(x.workout.text)} > plan ${String(b.text)}`
            );
        }
      }
      expect(seen).toBeGreaterThan(0);
      expect(bad).toEqual([]);
    },
    60_000
  );
});
