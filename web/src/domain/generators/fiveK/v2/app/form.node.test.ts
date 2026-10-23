import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../../date';
import type { GenPlanState, LogEntry } from '../../../../state';
import * as select from '../../../select';
import { grid02Inputs } from '../../../halfMarathon/v2/testInputs.ts';
import { prefixOf } from './plan.ts';

/* FAZA 3, SEGMENT 3h (REVIEW-3 #2) — Napredak → Forma na planu 5K v2 cilja predaje („kraća distanca" iz HM v2): plan
   nosi nedelje izvora ispred (`prefixOf(plan).offset`), pa je prikazni broj nedelje `offset + fromWeek` (isto kao
   pregled i kalendar, 3d/3g). Unutrašnje poređenje ostaje u indeksu v2. Plan bez prefiksa: broj = `fromWeek`. */

const DAY = 86_400_000;
const addDays = (d: string, n: number): IsoDate =>
  new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10) as IsoDate;
const race = (date: string): LogEntry => ({
  status: 'done',
  km: 5,
  sec: 1380,
  ts: date,
  raceAi: { context: { date, distanceM: 5000, officialSec: 1380, intent: 'race' } }
});

/** Plan 5K v2 iz predaje HM v2 (pauza 20 d). */
function handedOff(): GenPlanState {
  const base = grid02Inputs().find((x) => x.id === 'd3-10w-35km-v30-A-sat')!.input;
  const g = select.generateHmV2Plan(base as never);
  if (!g.ok) throw new Error('generator');
  const asOf = addDays(g.plan.weeks[3]!.start, 2);
  const a = select.hmV2AdaptPreview(g.plan, asOf, {}, [{ from: addDays(asOf, -20), to: asOf }]);
  if (!a.ok) throw new Error('adaptacija');
  const src = select.stampForStorage(a.result);
  const prep = select.preparationForPlan(src, { fiveKV2: true, tenKV2: true, hmV2: true })!;
  const basis = prep.basisFromPlan(src, asOf)!;
  const ch = prep.buildPreparationChoice(
    src,
    asOf,
    basis,
    { kind: 'shorter', raceDistM: 5000 },
    {}
  );
  if ('error' in ch) throw new Error(ch.error);
  return select.stampForStorage(ch.result);
}

/** Trka u drugoj nedelji plana v2, primenjena adaptacijom (tempo od sledeće nedelje); forma dan posle trke. */
function formAfterResult(plan: GenPlanState) {
  const v2w = (plan as unknown as { fiveKV2: { weeks: { startDate: string }[] } }).fiveKV2.weeks;
  const day = addDays(v2w[1]!.startDate, 2);
  const log = { trka: race(day) };
  const today = addDays(day, 1);
  const a = select.fiveKV2AdaptPreview(plan, today, { log });
  if (!a.ok) throw new Error(JSON.stringify(a.reasons));
  const applied = select.stampForStorage(a.result);
  const steps = (
    applied as unknown as { fiveKV2: { adaptation: { steps: { fromWeek: number }[] } } }
  ).fiveKV2.adaptation.steps;
  return { applied, today, log, fromWeek: steps.at(-1)!.fromWeek };
}

describe('3h: Forma na planu 5K v2 sa prefiksom izvora', () => {
  it('oznaka primenjenog rezultata = offset + fromWeek (broj kao kalendar)', () => {
    const plan = handedOff();
    const off = prefixOf(plan)!.offset;
    expect(off).toBeGreaterThan(0);
    const { applied, today, log, fromWeek } = formAfterResult(plan);
    expect(fromWeek).toBe(3);
    const f = select.fiveKV2FormHistory({ plan: applied, today, log })!;
    const shown = off + fromWeek;
    const used = f.points.find((p) => p.kind === 'race')!;
    expect(used.status).toBe('used');
    expect(used.label).toMatch(new RegExp(`— tempo od nedelje ${shown}$`));
    // Kalendar (3d/3g): nedelja sa tim brojem počinje na nedelji v2 `fromWeek`.
    const v2 = (applied as unknown as { fiveKV2: { weeks: { startDate: string }[] } }).fiveKV2;
    expect(applied.weeks.find((w) => w.w === shown)!.start).toBe(v2.weeks[fromWeek - 1]!.startDate);
  });

  it('plan bez prefiksa: broj = fromWeek (kao pre)', () => {
    const plan = handedOff();
    const bare = { ...plan } as Record<string, unknown>;
    for (const k of Object.keys(bare)) if (k.endsWith('Prefix')) delete bare[k];
    // 08l: plan bez prefiksa nema ni pomak u ulazu jezgra (weekOffset) — kao običan plan 5K v2.
    const v2 = bare['fiveKV2'] as { input: Record<string, unknown> };
    const { weekOffset: _off, ...input } = v2.input;
    bare['fiveKV2'] = { ...v2, input };
    expect(prefixOf(bare)).toBeNull();
    const { applied, today, log, fromWeek } = formAfterResult(bare as GenPlanState);
    const f = select.fiveKV2FormHistory({ plan: applied, today, log })!;
    expect(f.points.find((p) => p.kind === 'race')!.label).toMatch(
      new RegExp(`— tempo od nedelje ${fromWeek}$`)
    );
  });
});
