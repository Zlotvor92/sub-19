/* R22 (A2) — svojstvo nad scenarijima SVIH distanci: propušten trening (kvalitet ili dugi, bez drugog događaja; i dva
   pojedinačna, ne dva duga zaredom)
   nije prekid — nijedan budući ključni trening (kvalitet, provera: rad) i nijedan dugi (trajanje) nije manji nego u
   planu bez događaja, a izmene nema osim obaveštenja ili dodatka. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { paceCtxOf, summarize, type DistanceData } from '../engine';

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

/** Događaji koje je replan primio u ovom koraku (posle-plan prema pre-plan). */
function newEvents(r: any): string[] {
  const old = new Set<string>(r.before.header.appliedEvents ?? []);
  return ((r.after.header.appliedEvents ?? []) as string[]).filter((e) => !old.has(e));
}

describe('R22 (A2) — jedan propušten trening nije prekid (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: posle jednog propuštenog treninga nijedan budući ključni ni dugi nije manji nego bez događaja',
    (_id, d) => {
      const bad: string[] = [];
      let seen = 0;
      for (const s of d.scenarios) {
        const r = s.run();
        /* samo propušteni treninzi (jedan ili više pojedinačnih, ne dva duga zaredom — to je (c), lanac od
           odrađenog) */
        const evs = newEvents(r).filter((e) => !e.startsWith('none'));
        if (evs.length === 0 || !evs.every((e) => e.startsWith('missed'))) continue;
        const ids = new Set(evs.map((e) => e.slice(e.indexOf(':') + 1)));
        const longs = (r.before.weeks as any[])
          .flatMap((w) => w.days)
          .filter((x: any) => x.workout?.kind === 'long');
        const streak = longs.some(
          (x: any, i: number) => ids.has(x.id) && i > 0 && ids.has(longs[i - 1].id)
        );
        if (streak) continue;
        seen += 1;
        const tag = `s${String(s.no)}`;
        const today: string = r.afterState.today;
        const pb = paceCtxOf(r.before.header);
        const pa = paceCtxOf(r.after.header);
        const after = new Map<string, any>(
          (r.after.weeks as any[]).flatMap((w) => w.days).map((x: any) => [x.date, x])
        );
        for (const b of (r.before.weeks as any[]).flatMap((w) => w.days)) {
          if (b.date <= today || b.workout === null) continue;
          const k = b.workout.kind;
          if (k !== 'quality' && k !== 'test' && k !== 'long') continue;
          const a = after.get(b.date)?.workout ?? null;
          const was = k === 'long' ? summarize(b.workout, pb).durationSec : b.workout.workSec;
          const now =
            a === null || a.kind !== k
              ? -1
              : k === 'long'
                ? summarize(a, pa).durationSec
                : a.workSec;
          if (now < was - 30)
            bad.push(
              `${tag} ${String(b.date)} ${String(b.workout.text)} → ${String(a?.text ?? 'odmor')}`
            );
        }
      }
      expect(seen).toBeGreaterThan(0);
      expect(bad).toEqual([]);
    },
    60_000
  );
});
