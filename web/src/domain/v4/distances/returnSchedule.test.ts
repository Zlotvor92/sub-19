/* R19 (briefs/R19-MOTOR.md, stavka 1) — povratak posle kratke bolesti/pauze nad scenarijima SVIH distanci (svojstvo):
   posle pauze od 5 do 10 dana nijedna nedelja rasporeda nije veća od referentne nedelje (ni od svog udela: 75 / 90 %),
   a treća nedelja je ≥ 95 % plana bez događaja (osim sužavanja i nedelje trke). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
   -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { paceCtxOf, type DistanceData } from '../engine';
import { weekCost } from '../engine/guard';
import { pauseLength, returnSchedule } from '../engine/readiness';

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

describe('R19 — povratak po nedeljama posle pauze 5–10 dana (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: nedelje rasporeda ≤ udela referentne, treća ≥ 95 % plana',
    (_id, d) => {
      const bad: string[] = [];
      let seen = 0;
      for (const s of d.scenarios) {
        const r = s.run();
        const pause = (r.after.header.adjustments ?? []).find(
          (a: any) => a.kind === 'pause' && a.refWeekKm !== undefined
        );
        if (pause === undefined) continue;
        const length = pauseLength(pause.from, pause.to);
        if (length < 5 || length > 10) continue;
        const sch = returnSchedule(pause);
        if (sch === null) continue;
        seen += 1;
        const race = r.after.header.goal.raceDate;
        const km = (doc: any, start: string): number => {
          const w = doc.weeks.find((x: any) => x.start === start);
          return w === undefined ? 0 : weekCost(w, race, paceCtxOf(doc.header)).km;
        };
        const at = (k: number): string => {
          const [y, m, dd] = sch.week1.split('-').map(Number);
          const t = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (dd ?? 1) + 7 * k));
          return t.toISOString().slice(0, 10);
        };
        const tag = `s${String(s.no)}`;
        sch.shares.forEach((share, k) => {
          const w = km(r.after, at(k));
          if (w > pause.refWeekKm + 0.5)
            bad.push(`${tag} ned ${String(k + 1)} ${w.toFixed(1)} > ref`);
          if (w > share * pause.refWeekKm + 0.75)
            bad.push(`${tag} ned ${String(k + 1)} ${w.toFixed(1)} > ${String(share)} ref`);
        });
        /* treća nedelja: samo kad je pauza poslednji događaj i nedelja nije sužavanje ni nedelja trke */
        const last = r.after.header.appliedEvents.at(-1) ?? '';
        const third = r.after.weeks.find((x: any) => x.start === at(sch.shares.length));
        if (
          last.startsWith('pause:') &&
          third !== undefined &&
          third.intent.kind !== 'taper' &&
          third.intent.kind !== 'race' &&
          pause.rampDays === undefined
        ) {
          const plan = km(r.before, third.start);
          const now = km(r.after, third.start);
          if (now < 0.95 * plan)
            bad.push(`${tag} ned 3 ${now.toFixed(1)} < 95 % od ${plan.toFixed(1)}`);
        }
      }
      expect(seen).toBeGreaterThan(0);
      expect(bad).toEqual([]);
    }
  );
});
