import { describe, expect, it } from 'vitest';
import { applyEdit, applyMove } from './edits';
import { otisakOf, workoutFromAlt } from './manual';
import { undoEdit, undoWeekMoves } from './undo';
import { makePlan } from './wizard';
import type { PlanDoc } from '../../domain/v4/engine';

const TODAY = '2026-11-14';
const ctx = { today: TODAY, done: new Set<string>() };

function planOf(distance: string): PlanDoc {
  const r = makePlan({
    distance,
    answers: {
      raceDate: '2027-03-21',
      runDays: ['tue', 'thu', 'sat', 'sun'],
      currentWeeklyKm: 35,
      recentResult: { distanceM: 5000, timeSec: 1350, date: '2026-10-20' },
      experience: 'regular'
    },
    today: TODAY
  });
  if (!r.ok) throw new Error('plan');
  return r.doc;
}

/** Mali deterministički generator (bez zavisnosti). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('F9 korak 7 · vraćanje ručnih izmena: otisak posle vraćanja = otisak pre izmene', () => {
  for (const distance of ['5k', '10k', 'hm', 'marathon']) {
    it(`${distance}: nasumična premeštanja u nedelji → „Vrati raspored nedelje"`, () => {
      const doc = planOf(distance);
      const before = otisakOf(doc, TODAY);
      for (let seed = 1; seed <= 25; seed++) {
        const r = rng(seed);
        const wi = Math.floor(r() * doc.weeks.length);
        const week = doc.weeks[wi];
        if (!week) continue;
        let cur = doc;
        for (let k = 0; k < 4; k++) {
          const days = cur.weeks[wi]?.days ?? [];
          const a = days[Math.floor(r() * days.length)];
          const b = days[Math.floor(r() * days.length)];
          if (!a || !b) continue;
          const m = applyMove(cur, a.id, b.date, ctx);
          if (m.ok) cur = m.doc;
        }
        if (cur === doc) continue;
        const u = undoWeekMoves(cur, wi, ctx);
        if (!u.ok) {
          expect(cur.weeks[wi]?.days.some((d) => d.movedFrom !== undefined)).toBe(false);
          continue;
        }
        expect(otisakOf(u.doc, TODAY)).toBe(before);
        expect(u.doc.weeks[wi]?.days.map((d) => d.date)).toEqual(week.days.map((d) => d.date));
      }
    });

    it(`${distance}: ručna izmena pa vraćanje (i preko premeštanja)`, () => {
      const doc = planOf(distance);
      const before = otisakOf(doc, TODAY);
      const wi = 2;
      const day = doc.weeks[wi]?.days.find((d) => d.workout !== null);
      const other = doc.weeks[wi]?.days.find((d) => d.id !== day?.id);
      if (!day || !other) throw new Error('dani');
      const e1 = applyEdit(doc, day.id, workoutFromAlt({ tag: 'lako', km: 5, desc: 'x' }), ctx);
      if (!e1.ok) throw new Error(e1.reason);
      const e2 = applyEdit(e1.doc, day.id, null, ctx);
      if (!e2.ok) throw new Error(e2.reason);
      expect(otisakOf(e2.doc, TODAY)).not.toBe(before);
      const u = undoEdit(e2.doc, day.id, ctx);
      expect(u.ok && otisakOf(u.doc, TODAY)).toBe(before);
      // izmena + premeštanje: vraćaju se oba, redom koji god
      const m = applyMove(e1.doc, day.id, other.date, ctx);
      if (!m.ok) throw new Error(m.reason);
      const a = undoEdit(m.doc, day.id, ctx);
      if (!a.ok) throw new Error(a.reason);
      const b = undoWeekMoves(a.doc, wi, ctx);
      expect(b.ok && otisakOf(b.doc, TODAY)).toBe(before);
    });
  }

  it('urađen, zaključan ili prošao dan se ne vraća', () => {
    const doc = planOf('hm');
    const days = doc.weeks[1]?.days ?? [];
    const [a, b] = days;
    if (!a || !b) throw new Error('dani');
    const m = applyMove(doc, a.id, b.date, ctx);
    if (!m.ok) throw new Error(m.reason);
    expect(undoWeekMoves(m.doc, 1, { today: TODAY, done: new Set([a.id]) })).toEqual({
      ok: false,
      reason: 'uradjen'
    });
    expect(undoWeekMoves(m.doc, 1, { today: '2027-12-01', done: new Set() }).ok).toBe(false);
    expect(undoEdit(doc, a.id, ctx).ok).toBe(false); // nema ručne izmene
  });
});
