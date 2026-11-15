/* R19 (briefs/R19-MOTOR.md, stavka 7) — 5 km s26: rečenica o bolu („prvi brzi trening je X") se računa iz konačnog
   plana, ne iz plana posle prvog događaja (kasnija trka pomera prvi brzi trening). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument
   -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { renderPlan } from '../../engine';
import { fmtDate } from '../../engine/format';
import { fivek } from './index';
import { SCENARIOS } from './testdata/scenarios';

describe('R19 — tekst o bolu iz konačnog plana (5 km s26)', () => {
  it('„prvi brzi trening je X" = prvi brzi trening posle bola u ispisanom planu', () => {
    const r: any = SCENARIOS.find((s: any) => s.no === 26)?.run();
    const pain = (r.after.header.adjustments as any[]).find((a) => a.kind === 'pain');
    const first = (r.after.weeks as any[])
      .flatMap((w) => w.days)
      .find(
        (d: any) =>
          d.date > pain.date &&
          d.workout !== null &&
          d.workout.kind !== 'race' &&
          (d.workout.kind === 'quality' || d.workout.kind === 'test' || d.workout.workSec > 0)
      );
    const text = renderPlan(r.after, r.afterState, fivek, { changes: r.changes });
    const dates = [...text.matchAll(/prvi brzi trening je (\d{1,2}\. \d{1,2}\.)/g)].map(
      (m) => m[1]
    );
    expect(dates.length).toBeGreaterThan(0);
    for (const d of dates) expect(d).toBe(fmtDate(first.date));
  });
});
