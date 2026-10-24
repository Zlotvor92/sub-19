import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import type { AdaptResult, TenKV2Plan } from './types.ts';

/* 10K-07 dopuna (ugao 3, lanci; docs/generators-v2/audit/fixes/01-chains-addendum.md): najkraći lanci iz
   `chains.ts 10K 20261023` (ulaz i činjenice po koraku u segment07.chains-20261023.json).
   - Z6 (C1) i=204: LIMITS za dan zaključan u ranijem koraku — lanac se ne odbija.
   - Z7 (C2) i=529: manjak izvršenja — ponovna primena istih činjenica na isti asOf ne seče cilj ponovo.
   - C3 i=218, i=1885: zaključan test + ponovna adaptacija → ne dva testa (TEST).
   - C7 i=5771: zaključan lagan dan trkačke drži trkačku > taper → upozorenje RACE_WEEK_OVER_TAPER_LOCKED.
   - C8 i=664: mešovita nedelja pauze planirano > cilj → upozorenje MIXED_OVER_TARGET. */

interface Chain {
  id: string;
  input: Record<string, unknown>;
  steps: { asOf: string; facts: Record<string, unknown> }[];
}
const FX = JSON.parse(
  readFileSync(fileURLToPath(new URL('./segment07.chains-20261023.json', import.meta.url)), 'utf8')
) as { chains: Record<string, Chain> };

/** Lanac: generate → koraci; rezultat svakog koraka. */
function run(i: number): { before: TenKV2Plan; r: AdaptResult; asOf: string; facts: unknown }[] {
  const c = FX.chains[String(i)]!;
  const g = generateTenKV2(c.input);
  if (!g.ok) throw new Error(`${c.id}: generate`);
  let p = g.plan;
  const out: { before: TenKV2Plan; r: AdaptResult; asOf: string; facts: unknown }[] = [];
  for (const s of c.steps) {
    // 10K-08 (T1): činjenice lanca su iz plana 10k-v2.9.0; dan koji je sada odmor (lagan od 20 min ne staje) nije dan
    // plana — zapis tog dana ostaje bez dayId (van plana), zaključavanje tog dana otpada. Ostali lanci: bez promene.
    const ids = new Set(p.weeks.flatMap((w) => w.days.map((d) => d.date)));
    const raw = JSON.parse(JSON.stringify(s.facts)) as {
      workouts?: { dayId?: string }[];
      lockedDayIds?: string[];
    };
    const facts = {
      ...raw,
      ...(raw.workouts
        ? {
            workouts: raw.workouts.map((x) => {
              if (!x.dayId || ids.has(x.dayId)) return x;
              const { dayId: _d, ...y } = x;
              return y;
            })
          }
        : {}),
      ...(raw.lockedDayIds ? { lockedDayIds: raw.lockedDayIds.filter((d) => ids.has(d)) } : {})
    } as unknown;
    const r = adaptTenKV2(p, facts, s.asOf);
    out.push({ before: p, r, asOf: s.asOf, facts });
    if (!r.ok) break;
    p = r.plan;
  }
  return out;
}
const weeks = (r: AdaptResult): unknown => (r.ok ? r.plan.weeks : r.reasons);

describe('10K-07 dopuna: lanci adaptacija', () => {
  it('Z6 i=204: lanac bez odbijanja (LIMITS ne sudi zaštićenom danu)', () => {
    const s = run(204);
    expect(s.map((x) => (x.r.ok ? 'ok' : x.r.reasons[0]!.code))).toEqual(s.map(() => 'ok'));
  });

  it('Z7 i=529 i C3 i=218/1885: ponovna primena istih činjenica na isti asOf ne menja plan', () => {
    for (const i of [529, 218, 1885])
      for (const [k, x] of run(i).entries()) {
        if (!x.r.ok) continue;
        const again = adaptTenKV2(x.r.plan, JSON.parse(JSON.stringify(x.facts)), x.asOf);
        expect(weeks(again), `${i}#${k}`).toEqual(weeks(x.r));
      }
  });

  it('Z8 i=1855: sutra bez novih zapisa (bol, umor presuđen) — umor se ne primenjuje, budući ciljevi ne padaju', () => {
    const x = run(1855)[0]!;
    if (!x.r.ok) throw new Error('odbijeno');
    const next = addDays(x.asOf, 1);
    const r = adaptTenKV2(x.r.plan, JSON.parse(JSON.stringify(x.facts)), next);
    if (!r.ok) throw new Error('sutra odbijeno');
    expect(r.reasons.some((y) => y.condition === 'FATIGUE' && y.applied)).toBe(false);
    const before = new Map(x.r.plan.weeks.map((w) => [w.index, w.targetKm]));
    expect(
      r.plan.weeks
        .filter((w) => w.startDate > next && w.targetKm < before.get(w.index)! * 0.9 - 0.05)
        .map((w) => w.index)
    ).toEqual([]);
  });

  it('C7 i=5771: zaključan dan trkačke drži trkačku > taper → upozorenje', () => {
    const r = run(5771)[0]!.r;
    if (!r.ok) throw new Error('odbijeno');
    expect(r.plan.warnings.map((w) => w.rule)).toContain('RACE_WEEK_OVER_TAPER_LOCKED');
  });

  it('C8 i=664: mešovita nedelja pauze planirano > cilj → upozorenje MIXED_OVER_TARGET', () => {
    const over = run(664).filter(
      (x) =>
        x.r.ok &&
        x.r.plan.weeks.some(
          (w) =>
            (x.r.ok ? x.r.plan.adaptation!.mixedWeeks : []).includes(w.index) &&
            w.endDate > x.asOf &&
            w.phase !== 'race' &&
            w.plannedKm > w.targetKm + 0.1 + 1e-9
        )
    );
    expect(over.length).toBeGreaterThan(0);
    for (const x of over)
      expect(x.r.ok && x.r.plan.warnings.some((w) => w.rule === 'MIXED_OVER_TARGET')).toBe(true);
  });
});
