import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../../date';
import type { GenPlanState, LogEntry } from '../../../../state';
import * as select from '../../../select';
import { grid02Inputs } from '../../../halfMarathon/v2/testInputs.ts';
import { prefixOf } from './plan.ts';

/* FAZA 3, SEGMENT 3i (REVIEW-3 #2 dopuna) — poruke JEZGRA (razlozi pregleda, traka „needed", napomene) na planu 10K v2
   cilja predaje („kraća distanca" iz HM v2) nose broj nedelje kao kalendar (`weekOffset + indeks`). Cilj predaje
   postavlja `input.weekOffset` = offset prefiksa (isti broj, jedno mesto); Forma čita isti offset. Pre 3i: razlog
   „… od nedelje 3", kalendar 9. */

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
/** Broj nedelje u tekstu (km, broj kvaliteta i redni broj uvoda „k od N" nisu broj nedelje). */
const WEEK =
  /(?:nedelj[a-z]*|Nedelj[a-z]*|ned\.?)\s+(\d+)(?![\d,.]*\s*km)(?!\s+od\s)(?!\s+kvalitet)/g;
const weeksIn = (s: string): number[] => [...s.matchAll(WEEK)].map((m) => Number(m[1]));

type V2 = {
  input: { weekOffset?: number };
  weeks: { startDate: string }[];
  adaptation?: { steps: { fromWeek: number }[] };
};
const v2Of = (p: GenPlanState): V2 => (p as unknown as { tenKV2: V2 }).tenKV2;

/** Plan 10K v2 iz predaje HM v2 (pauza 20 d). */
function handedOff(): GenPlanState {
  const base = grid02Inputs().find((x) => x.id === 'd4-16w-40km-v45-A-sun')!.input;
  const g = select.generateHmV2Plan(base as never);
  if (!g.ok) throw new Error('generator');
  const asOf = addDays(g.plan.weeks[g.plan.weeks.length - 11]!.start, 2);
  const a = select.hmV2AdaptPreview(g.plan, asOf, {}, [{ from: addDays(asOf, -20), to: asOf }]);
  if (!a.ok) throw new Error('adaptacija');
  const src = select.stampForStorage(a.result);
  const prep = select.preparationForPlan(src, { fiveKV2: false, tenKV2: true, hmV2: true })!;
  const basis = prep.basisFromPlan(src, asOf)!;
  const ch = prep.buildPreparationChoice(
    src,
    asOf,
    basis,
    { kind: 'shorter', raceDistM: 10000 },
    {}
  );
  if ('error' in ch) throw new Error(ch.error);
  return select.stampForStorage(ch.result);
}

describe('3i: broj nedelje u porukama jezgra na planu 10K v2 cilja predaje', () => {
  it('cilj predaje: input.weekOffset = offset prefiksa (jedan broj)', () => {
    const plan = handedOff();
    const off = prefixOf(plan)!.offset;
    expect(off).toBeGreaterThan(0);
    expect(v2Of(plan).input.weekOffset).toBe(off);
  });

  it('trka u 2. nedelji v2: razlog i traka „VDOT … od nedelje N", N = broj nedelje u kalendaru', () => {
    const plan = handedOff();
    const off = prefixOf(plan)!.offset;
    const v2w = v2Of(plan).weeks;
    const day = addDays(v2w[1]!.startDate, 2);
    const log = { trka: race(day) };
    const pv = select.tenKV2AdaptPreview(plan, addDays(day, 1), { log });
    if (!pv.ok) throw new Error(JSON.stringify(pv.reasons));
    const applied = select.stampForStorage(pv.result);
    const fromWeek = v2Of(applied).adaptation!.steps.at(-1)!.fromWeek;
    expect(fromWeek).toBe(3);
    const shown = off + fromWeek;
    const reason = pv.reasons.find((x) => x.condition === 'NEW_RESULT' && x.applied)!;
    expect(reason.message).toMatch(new RegExp(`VDOT [\\d,]+ od nedelje ${shown}[ ;(]`));
    expect(pv.needed.some((m) => m.includes(`od nedelje ${shown}`))).toBe(true);
    // Kalendar: nedelja sa tim brojem počinje na nedelji v2 `fromWeek`; pregled nedelja u istim brojevima.
    expect(applied.weeks.find((w) => w.w === shown)!.start).toBe(v2w[fromWeek - 1]!.startDate);
    expect(Math.min(...pv.weeks.map((w) => w.week))).toBeGreaterThan(off);
    // Svaka poruka jezgra sa brojem nedelje (razlozi, traka, napomene plana i nedelja) — broj iz kalendara (> offset).
    const texts = [
      ...pv.reasons.map((x) => x.message),
      ...pv.needed,
      ...applied.weeks.filter((w) => w.w > off).map((w) => w.focus ?? '')
    ];
    const nums = texts.flatMap(weeksIn);
    expect(nums.length).toBeGreaterThan(0);
    expect(nums.filter((n) => n <= off)).toEqual([]);
    // Forma: isti broj (isti offset iz plana, bez duplog sabiranja).
    const f = select.tenKV2FormHistory({ plan: applied, today: addDays(day, 1), log })!;
    expect(f.next).toMatchObject({ week: shown });
  });
});
