import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../../date';
import type { GenPlanState, LogEntry } from '../../../../state';
import * as select from '../../../select';
import { gridInputs } from '../../../marathon/v2/testInputs.ts';
import { prefixOf } from './plan.ts';

/* FAZA 3, SEGMENT 3h (REVIEW-3 #2) — Napredak → Forma na planu HM v2 cilja predaje („kraća distanca" iz HM v2): plan
   nosi nedelje izvora ispred (`prefixOf(plan).offset`), pa je prikazni broj nedelje `offset + fromWeek` (isto kao
   pregled i kalendar, 3d/3g). Unutrašnje poređenje ostaje u indeksu v2. Plan bez prefiksa: broj = `fromWeek`. 3i: Forma
   čita isti offset kao jezgro (`input.weekOffset`, postavlja ga cilj predaje = offset prefiksa). */

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

/** Plan HM v2 iz predaje maratona v2 (pauza 20 d). */
function handedOff(): GenPlanState {
  const base = gridInputs().find((x) => {
    const r = select.generateMarathonV2Plan(x.input as never);
    return r.ok && r.plan.weeks.length >= 16;
  })!.input;
  const g = select.generateMarathonV2Plan(base as never);
  if (!g.ok) throw new Error('generator');
  const asOf = addDays(g.plan.weeks[g.plan.weeks.length - 11]!.start, 2);
  const a = select.marathonV2AdaptPreview(g.plan, asOf, {}, [
    { from: addDays(asOf, -20), to: asOf }
  ]);
  if (!a.ok) throw new Error('adaptacija');
  const src = select.stampForStorage(a.result);
  const prep = select.preparationForPlan(src, { fiveKV2: false, hmV2: true, marathonV2: true })!;
  const basis = prep.basisFromPlan(src, asOf)!;
  const ch = prep.buildPreparationChoice(
    src,
    asOf,
    basis,
    { kind: 'shorter', raceDistM: 21097.5 },
    {}
  );
  if ('error' in ch) throw new Error(ch.error);
  return select.stampForStorage(ch.result);
}

/** Trka u drugoj nedelji plana v2, primenjena adaptacijom (tempo od sledeće nedelje); forma dan posle trke. */
function formAfterResult(plan: GenPlanState) {
  const v2w = (plan as unknown as { hmV2: { weeks: { startDate: string }[] } }).hmV2.weeks;
  const day = addDays(v2w[1]!.startDate, 2);
  const log = { trka: race(day) };
  const today = addDays(day, 1);
  const a = select.hmV2AdaptPreview(plan, today, { log });
  if (!a.ok) throw new Error(JSON.stringify(a.reasons));
  const applied = select.stampForStorage(a.result);
  const steps = (applied as unknown as { hmV2: { adaptation: { steps: { fromWeek: number }[] } } })
    .hmV2.adaptation.steps;
  return { applied, today, log, fromWeek: steps.at(-1)!.fromWeek };
}

describe('3h: Forma na planu HM v2 sa prefiksom izvora', () => {
  it('oznaka primenjenog rezultata i „sledeća nedelja" = offset + fromWeek (broj kao kalendar)', () => {
    const plan = handedOff();
    const off = prefixOf(plan)!.offset;
    expect(off).toBeGreaterThan(0);
    const { applied, today, log, fromWeek } = formAfterResult(plan);
    expect(fromWeek).toBe(3);
    const f = select.hmV2FormHistory({ plan: applied, today, log })!;
    const shown = off + fromWeek;
    expect(f.next).toMatchObject({ week: shown });
    const used = f.points.find((p) => p.kind === 'race')!;
    expect(used.status).toBe('used');
    expect(used.label).toMatch(new RegExp(`— tempo od nedelje ${shown}$`));
    // Kalendar (3d/3g): nedelja sa tim brojem počinje na nedelji v2 `fromWeek`.
    const v2 = (applied as unknown as { hmV2: { weeks: { startDate: string }[] } }).hmV2;
    expect(applied.weeks.find((w) => w.w === shown)!.start).toBe(v2.weeks[fromWeek - 1]!.startDate);
  });

  it('plan bez prefiksa i bez weekOffset (3i): broj = fromWeek (kao pre)', () => {
    const plan = handedOff();
    const bare = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>;
    for (const k of Object.keys(bare)) if (k.endsWith('Prefix')) delete bare[k];
    delete (bare['hmV2'] as { input: Record<string, unknown> }).input['weekOffset'];
    expect(prefixOf(bare)).toBeNull();
    const { applied, today, log, fromWeek } = formAfterResult(bare as GenPlanState);
    const f = select.hmV2FormHistory({ plan: applied, today, log })!;
    expect(f.next).toMatchObject({ week: fromWeek });
    expect(f.points.find((p) => p.kind === 'race')!.label).toMatch(
      new RegExp(`— tempo od nedelje ${fromWeek}$`)
    );
  });
});

describe('HM-09 Z3: Forma čita odluku jezgra o rezultatu (assess.resultUse)', () => {
  it('owner T1: početnik, trka 5 km 36:00 (VDOT 24,7 van 30–80) — jezgro ignoriše, Forma ne piše „čeka"', async () => {
    const { adaptBases } = await import('../adaptInputs.ts');
    const { generateHmV2 } = await import('../generate.ts');
    const { adaptHmV2 } = await import('../adapt.ts');
    const { generatedPlan, storedPlan } = await import('./plan.ts');
    const { formHistory } = await import('./form.ts');
    const b = adaptBases().find((x) => x.id === 'beg-d4-f-12w')!;
    const g = generateHmV2(b.input);
    if (!g.ok) throw new Error('generator');
    const day = addDays(g.plan.weeks[1]!.startDate, 2);
    const today = addDays(day, 1);
    const sec = 36 * 60;
    const log = {
      trka: {
        status: 'done',
        km: 5,
        sec,
        ts: day,
        raceAi: { context: { date: day, distanceM: 5000, officialSec: sec, intent: 'race' } }
      } as LogEntry
    };
    const a = adaptHmV2(
      g.plan,
      { results: [{ distM: 5000, sec, date: day, kind: 'race' }] },
      today
    );
    expect(a.ok && a.reasons.some((r) => r.condition === 'RESULT_IGNORED')).toBe(true);
    const f = formHistory({ plan: storedPlan(generatedPlan(g.plan)), today, log })!;
    const pt = f.points.find((p) => p.kind === 'race')!;
    expect(pt.status).toBe('old');
    expect(pt.label).toMatch(/VDOT van 30–80/);
  });
});
