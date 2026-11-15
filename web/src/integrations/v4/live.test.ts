import { describe, expect, it } from 'vitest';
import type { PlanDoc, Run } from '../../domain/v4/engine';
import { otisakOf } from './manual';
import { acceptReport, formView, liveState, previewReport, refreshPlan } from './live';
import { makePlan } from './wizard';

const T0 = '2026-11-14';
function planOf(): PlanDoc {
  const r = makePlan({
    distance: 'hm',
    answers: {
      raceDate: '2027-03-21',
      runDays: ['tue', 'thu', 'sat', 'sun'],
      currentWeeklyKm: 35,
      recentResult: { distanceM: 5000, timeSec: 1350, date: '2026-10-20' },
      experience: 'regular'
    },
    today: T0
  });
  if (!r.ok) throw new Error('plan');
  return r.doc;
}
const live = (doc: PlanDoc, today: string, runs: Run[] = []) => {
  const l = liveState({ doc, today, runs, log: {}, knee: [] });
  if (l === null) throw new Error('live');
  return l;
};

describe('F9 korak 8 · živo stanje plana', () => {
  it('bez trčanja: forma = polazna forma plana (ne pada na podrazumevanu)', () => {
    const doc = planOf();
    const v = formView(live(doc, '2026-11-20'));
    expect(v.today.timeSec).toBe(doc.header.form.start.raceTimeSec);
    expect(v.raceDay.lowSec).toBeLessThanOrEqual(v.raceDay.expectedSec);
    expect(v.raceDay.highSec).toBeGreaterThanOrEqual(v.raceDay.expectedSec);
    expect(v.why.length).toBeGreaterThan(0);
  });

  it('trka iz trčanja (bez pulsa) pomera formu, uz objašnjenje', () => {
    const doc = planOf();
    const race: Run = {
      id: 'strava:1',
      date: '2026-11-22',
      distanceM: 10000,
      durationSec: 44 * 60,
      effort: 'race'
    };
    const v0 = formView(live(doc, '2026-11-23'));
    const v1 = formView(live(doc, '2026-11-23', [race]));
    expect(v1.today.timeSec).toBeLessThan(v0.today.timeSec);
    expect(v1.why[0]?.reason.length ?? 0).toBeGreaterThan(0);
  });

  it('izvedene promene: ponovni poziv nad izlazom nema promena (idempotentno)', () => {
    const doc = planOf();
    const today = '2026-12-01'; // dve nedelje bez ijednog trčanja
    const a = refreshPlan(doc, live(doc, today), { rejected: [] });
    const b = refreshPlan(a.doc, live(a.doc, today), { rejected: [] });
    expect(b.changes).toEqual([]);
    expect(otisakOf(b.doc, today)).toBe(otisakOf(a.doc, today));
  });

  it('pregled prijave ne menja plan; „Primeni" dvaput = jednom; odbijen se ne primenjuje', () => {
    const doc = planOf();
    const today = '2026-11-20';
    const l = live(doc, today);
    const before = otisakOf(doc, today);
    const p = previewReport(doc, l, { kind: 'fatigue' }, today);
    expect(otisakOf(doc, today)).toBe(before);
    expect(p.result.changes.length).toBeGreaterThan(0);
    const once = acceptReport(doc, l, { rejected: [] }, p.event);
    const twice = acceptReport(once.doc, live(once.doc, today), { rejected: [] }, p.event);
    expect(otisakOf(twice.doc, today)).toBe(otisakOf(once.doc, today));
    const no = acceptReport(doc, l, { rejected: [p.event.id] }, p.event);
    expect(no.changes).toEqual([]);
  });
});
