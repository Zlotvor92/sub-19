/* R22 (briefs/R22.md, MOTOR B, B1 i B2) — svojstva nad SVIM distancama, profilima i scenarijima:
   B1: zaglavlje ima tačno jedan polazni broj forme („Polazna forma" = broj u rečenici o polaznoj proceni);
   B2: tempo trke u treninzima = tempo koji plan savetuje za trku (napomena dana trke), u okviru ±3 s/km. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return
   -- profili i scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { buildState, plan, raceNotes, renderPlan, type DistanceData } from '../engine';
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
  const s = scenMods[path.replace('index.ts', 'testdata/scenarios.ts')] as any;
  return {
    data,
    profiles: p.PROFILES as any[],
    factsOf: p.factsOf as (x: any) => any,
    scenarios: (s?.SCENARIOS ?? []) as any[]
  };
});

const CLOCK = /(\d+:\d{2}(?::\d{2})?)/;
const PACE = /(\d+):(\d{2})\/km/;
const paceSec = (m: RegExpExecArray | null): number | null =>
  m === null ? null : Number(m[1]) * 60 + Number(m[2]);

/** B1: polazni brojevi u zaglavlju — `Polazna forma` i rečenica „Polazna procena … oko X za". */
function startNumbers(text: string): string[] {
  const head = text.split('\n1. NEDELJA')[0] ?? text;
  const out: string[] = [];
  for (const l of head.split('\n')) {
    if (l.startsWith('Polazna forma')) out.push(CLOCK.exec(l.split(': ').slice(1).join(': '))?.[1] ?? '?');
    const m = /Polazna procena je iz .*?oko (\d+:\d{2}(?::\d{2})?) za/.exec(l);
    if (m?.[1] !== undefined) out.push(m[1]);
  }
  return out;
}

function check(label: string, doc: any, state: any, data: DistanceData, bad: string[]): void {
  const text = renderPlan(doc, state, data);
  const nums = startNumbers(text);
  /* polazna procena iz rezultata pre pauze sme da se razlikuje kad je rečenica istorije vodi do polazne forme */
  const head = text.split('\n1. NEDELJA')[0] ?? text;
  const chained = nums[0] !== undefined && head.includes(`→ ${nums[0]}`);
  if (nums.length === 0 || (new Set(nums).size !== 1 && !chained))
    bad.push(`B1 ${label}: ${nums.join(' / ')}`);
  const h = doc.header;
  if (h.paces.byFeel) return;
  const hasRp = doc.weeks.some((w: any) =>
    w.days.some(
      (d: any) =>
        d.workout !== null &&
        d.workout.kind !== 'race' &&
        JSON.stringify(d.workout.steps).includes('"zone":"RP"')
    )
  );
  if (!hasRp) return;
  const advised = paceSec(PACE.exec(raceNotes(doc, state, data)[0] ?? ''));
  if (advised === null) return;
  if (Math.abs(advised - h.paces.RP) > 3)
    bad.push(`B2 ${label}: trening ${String(h.paces.RP)} / trka ${String(advised)} s/km`);
}

describe('R22 B1/B2 — jedan polazni broj, tempo trke = tempo za trku (sve distance)', () => {
  it.each(DIST.map((d) => [d.data.id, d] as const))('%s: profili', (_id, d) => {
    const bad: string[] = [];
    for (const p of d.profiles) {
      const facts = d.factsOf(p);
      const state = buildState(facts, p.goal, d.data, estimateForm);
      const res = plan(state, p.goal, d.data);
      if (!res.ok) throw new Error(String(p.id));
      check(String(p.id), res.doc, state, d.data, bad);
    }
    expect(bad).toEqual([]);
  });
  it.each(DIST.map((d) => [d.data.id, d] as const))('%s: scenariji', (_id, d) => {
    const bad: string[] = [];
    for (const s of d.scenarios) {
      const r = s.run();
      check(`s${String(s.no)}`, r.after, r.afterState, d.data, bad);
    }
    expect(bad).toEqual([]);
  });
});
