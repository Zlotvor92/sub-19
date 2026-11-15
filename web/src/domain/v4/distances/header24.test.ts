/* R24 (M3) — svojstva zaglavlja nad profilima (i sa 3, 4 i 5 dana) i scenarijima SVIH distanci: (a) u redu o tempu
   trke najviše dva različita tempa (forma, savet; rečenica o cilju trkača se ne broji); (b) „ne na napredak" samo kad je očekivano ==
   forma; (c) najviše 3 stavke upozorenja + najviše jedna „Pomoglo bi i"; (d) nigde „poslednjih 1 km". */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
   -- profili i scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, plan, renderPlan, type DistanceData } from '../engine';
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

const DAYS: Record<number, number[]> = { 3: [1, 3, 6], 4: [1, 3, 5, 6], 5: [0, 1, 3, 5, 6] };

function headerBad(label: string, text: string): string[] {
  const bad: string[] = [];
  const head = text.split('\n1. NEDELJA')[0] ?? text;
  const lines = head.split('\n');
  /* rečenica o cilju trkača („Tvoj cilj X traži Y/km") je njegov ulaz, ne tempo za trku */
  const rp = (lines.find((l) => l.startsWith('Tempo trke u treninzima')) ?? '').replace(
    /Tvoj cilj \S+ traži \S+/,
    ''
  );
  const paces = new Set(rp.match(/\d+:\d{2}\/km/g) ?? []);
  if (paces.size > 2) bad.push(`${label} (a): ${[...paces].join(', ')}`);
  if (head.includes('ne na napredak')) {
    const exp = /Očekivano na dan trke: (\d+:\d{2}(?::\d{2})?)/.exec(head)?.[1];
    const now = /Današnja prognoza \([^)]*\): (\d+:\d{2}(?::\d{2})?)/.exec(head)?.[1];
    if (exp !== now) bad.push(`${label} (b): očekivano ${String(exp)} ≠ forma ${String(now)}`);
  }
  const warn = (head.split('\nUPOZORENJA\n')[1] ?? '')
    .split('\n')
    .filter((l) => l.startsWith('- '));
  const items = warn.filter((l) => !l.startsWith('- Pomoglo bi i'));
  if (items.length > 3) bad.push(`${label} (c): ${String(items.length)} stavki`);
  if (warn.length - items.length > 1) bad.push(`${label} (c): više od jedne „Pomoglo bi i"`);
  if (text.includes('poslednjih 1 km')) bad.push(`${label} (d)`);
  return bad;
}

describe('R24 (M3) — zaglavlje: jedan tempo za trku, iskrena rečenica o formi, najviše tri upozorenja', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))(
    '%s: profili (i 3/4/5 dana) i scenariji',
    (_id, d) => {
      const bad: string[] = [];
      for (const p of d.profiles) {
        for (const n of [0, 3, 4, 5]) {
          const facts = d.factsOf(p);
          if (n > 0) facts.availability = { runDays: DAYS[n], longDay: 6 };
          const state = buildState(facts, p.goal, d.data, estimateForm);
          const res = plan(state, p.goal, d.data);
          if (res.ok)
            bad.push(
              ...headerBad(`${String(p.id)}/${String(n)}`, renderPlan(res.doc, state, d.data))
            );
        }
      }
      for (const s of d.scenarios) {
        const r = s.run();
        bad.push(...headerBad(`s${String(s.no)}`, renderPlan(r.after, r.afterState, d.data)));
      }
      expect(bad).toEqual([]);
    },
    180_000
  );
});
