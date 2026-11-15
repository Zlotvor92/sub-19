/* R22 (A3) — svojstvo nad scenarijima SVIH distanci: posle događaja prag i tempo trke koji su smanjeni u odnosu na plan
   pre događaja nisu ispod najmanje smislene doze (12 min; tempo trke 3 km ako je kraće) — ne „2 × 600 m", „prag 2 × 4
   min"; kad je i plan bio ispod nje, ostaje plan. Sužavanje ima svoju dozu oštrenja; E5 je nov plan. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildCtx } from '../engine/build';
import type { DistanceData } from '../engine';
import { meaningfulMinSec } from '../engine/readiness';
import { mainZone } from '../engine/select';

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

describe('R22 (A3) — bez mikro-doza posle događaja (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: smanjen prag / tempo trke ≥ najmanja smislena doza (ili plan)',
    (_id, d) => {
      const bad: string[] = [];
      for (const s of d.scenarios) {
        /* E5 je nov plan iz novog stanja (ne smanjenje plana) */
        if (String(s.title).startsWith('E5')) continue;
        const r = s.run();
        if (r.before === r.after) continue;
        const today: string = r.afterState.today;
        const ctx = buildCtx(r.after.header, d.data);
        const done = new Set((r.afterState.runs as any[]).map((x) => x.dayId));
        const old = new Map<string, any>(
          (r.before.weeks as any[]).flatMap((w) => w.days).map((x: any) => [x.date, x])
        );
        /* poslednji odrađeni kvalitet po zoni — podizanje ne ide preko njega */
        const lastDone = new Map<string, number>();
        for (const a of (r.after.weeks as any[]).flatMap((w) => w.days)) {
          if (a.date > today || a.workout?.kind !== 'quality' || !done.has(a.id)) continue;
          const def = d.data.library.find((y) => y.id === a.workout.libraryId);
          if (def !== undefined) lastDone.set(String(mainZone(def.main)), a.workout.workSec);
        }
        const live = (r.after.weeks as any[]).filter(
          (w) => w.intent.kind !== 'taper' && w.intent.kind !== 'race'
        );
        for (const a of live.flatMap((w) => w.days)) {
          const x = a.workout;
          if (x?.kind !== 'quality' || a.date <= today || done.has(a.id)) continue;
          const p = old.get(a.date)?.workout;
          if (p?.kind !== 'quality') continue;
          const def = d.data.library.find((y) => y.id === x.libraryId);
          const pdef = d.data.library.find((y) => y.id === p.libraryId);
          if (def === undefined || pdef === undefined) continue;
          if (mainZone(def.main) !== mainZone(pdef.main)) continue;
          if (x.workSec >= p.workSec - 30) continue;
          const floor = Math.min(
            meaningfulMinSec(def, ctx),
            p.workSec,
            lastDone.get(String(mainZone(def.main))) ?? Number.POSITIVE_INFINITY
          );
          if (x.workSec < floor - 45)
            bad.push(`s${String(s.no)} ${String(a.date)} ${String(p.text)} → ${String(x.text)}`);
        }
      }
      expect(bad).toEqual([]);
    },
    60_000
  );
});
