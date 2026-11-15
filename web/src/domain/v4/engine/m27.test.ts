/* KRUG 18 (briefs/R18-MOTOR.md t. 13, M27; F8 § 9 t. 5): ručno premešten trening je činjenica — ostali dani nedelje se
   preslažu radi razmaka (težak trening ne stoji dan uz drugi težak), bez promene sadržaja i obima nedelje. */
import { describe, expect, it } from 'vitest';
import { replan } from './index';
import { build, facts, goalAt } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type { PlanDay, PlanDoc, PlanEvent } from './types';

const hard = (d: PlanDay | undefined): boolean =>
  d?.workout != null && ['quality', 'test', 'long', 'race'].includes(d.workout.kind);

/** Premesti dugi nedelje `wi` na dan posle prvog kvaliteta (zamena sa tim danom), kao ručna izmena. */
function moveLongNextToQuality(doc: PlanDoc, wi: number): { doc: PlanDoc; dayId: string } | null {
  const w = doc.weeks[wi];
  if (w === undefined) return null;
  const q = w.days.findIndex((d) => d.workout?.kind === 'quality');
  const l = w.days.findIndex((d) => d.workout?.kind === 'long');
  const t = q + 1;
  const target = w.days[t];
  const long = w.days[l];
  if (q < 0 || l < 0 || target === undefined || long === undefined || t === l) return null;
  const days = [...w.days];
  days[t] = { ...target, origin: 'manual', workout: long.workout, base: target.workout };
  days[l] = { ...long, origin: 'manual', workout: target.workout, base: long.workout };
  return {
    doc: { ...doc, weeks: doc.weeks.map((x, i) => (i === wi ? { ...x, days } : x)) },
    dayId: target.id
  };
}

describe('M27: premeštanje dana', () => {
  it('dugi premešten na dan posle kvaliteta: kvalitet menja mesto sa laganim danom, sadržaj nedelje isti', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    let checked = 0;
    for (let wi = 3; wi < b.doc.weeks.length - 2; wi += 1) {
      const m = moveLongNextToQuality(b.doc, wi);
      if (m === null) continue;
      const ev: PlanEvent = {
        id: `manual-edit:${b.state.today}:${m.dayId}`,
        date: b.state.today,
        kind: 'manual-edit',
        dayId: m.dayId
      };
      const r = replan(m.doc, b.state, [ev], SYNTHETIC);
      const w = r.doc.weeks[wi];
      const moved = w?.days.find((d) => d.id === m.dayId);
      if (w === undefined || moved === undefined) continue;
      const before = m.doc.weeks[wi]?.days ?? [];
      /* ručni dan ostaje kako ga je trkač postavio */
      expect(moved.workout).toEqual(before.find((d) => d.id === m.dayId)?.workout);
      /* isti treninzi u nedelji (samo datumi) */
      const texts = (ds: readonly PlanDay[]): string[] =>
        ds.map((d) => d.workout?.text ?? '-').sort();
      expect(texts(w.days)).toEqual(texts(before));
      if (r.changes.length === 0) continue;
      checked += 1;
      const i = w.days.findIndex((d) => d.id === m.dayId);
      expect(hard(w.days[i - 1]) && w.days[i - 1]?.origin !== 'manual').toBe(false);
      expect(r.changes.some((c) => c.reason.includes('ručno postavljen'))).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
