import { describe, expect, it } from 'vitest';
import { resolvePlan } from '../../domain/plan';
import { DAY_TAGS, type DayTag, type StoredWeek } from '../../domain/state';
import type { PlanDoc } from '../../domain/v4/engine';
import { DISTANCES } from './facts';
import { adoptSample, clone, deepFreeze, newPlan, SAMPLES, TODAY } from './samples.test-data';
import { toResolved } from './view';

/** Klasa treninga kakvu je adapter preuzeo iz oznake (`lr` + `mlr` je lagan dan). */
const classOf = (tag: DayTag | undefined, mlr: boolean): string => {
  switch (tag) {
    case 'lako':
    case 'rw':
      return 'easy';
    case 'lr':
      return mlr ? 'easy' : 'long';
    case 'tempo':
    case 'int':
      return 'quality';
    case 'trka':
      return 'race';
    case 'test':
      return 'test';
    default:
      return 'other';
  }
};

describe('preuzet plan: prikaz kroz V4 = prikaz aplikacije danas', () => {
  it('ima uzorke svih formata', () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(30);
  });

  describe.each(SAMPLES)('$name', ({ snap, today }) => {
    const r = adoptSample({ name: '', snap, today });
    const plan = snap.plan as { weeks: StoredWeek[] };
    const app = resolvePlan(plan.weeks, {
      alts: snap.alts as Parameters<typeof resolvePlan>[1]['alts'],
      moves: snap.moves
    });
    const mine = toResolved(r.doc);

    it('isti dani, datumi, odmori, km i opisi', () => {
      expect(mine.byId.size).toBe(app.byId.size);
      expect(mine.weeks.map((w) => w.start)).toEqual(app.weeks.map((w) => w.start));
      for (const [id, a] of app.byId) {
        const d = mine.byId.get(id);
        expect(d, id).toBeDefined();
        if (d === undefined) continue;
        expect(d.date, id).toBe(a.date);
        expect(d.origDate, id).toBe(a.origDate);
        expect(d.rest, id).toBe(a.rest);
        if (a.rest) continue;
        expect(d.desc ?? '', id).toBe(a.desc ?? '');
        expect(Math.abs((d.km ?? 0) - (a.km ?? 0)), id).toBeLessThan(0.011);
        expect(classOf(d.tag, d.mlr), id).toBe(classOf(a.tag, a.mlr));
      }
      expect(mine.dated.map((d) => d.id)).toEqual(app.dated.map((d) => d.id));
    });
  });
});

describe.each(Object.keys(DISTANCES))('nov plan V4: %s', (distanceId) => {
  const { doc, goal } = newPlan(distanceId);
  const days = doc.weeks.flatMap((w) => w.days);
  const frozen = deepFreeze(clone(doc));
  const view = toResolved(frozen);

  it('svaki dan plana je u prikazu, na svom datumu, bez sudara', () => {
    expect(view.byId.size).toBe(days.length);
    expect(new Set(days.map((d) => d.date)).size).toBe(days.length);
    for (const d of days) expect(view.byId.get(d.id)?.date, d.id).toBe(d.date);
    const dates = view.dated.map((d) => d.date);
    expect(dates).toEqual([...dates].sort());
    expect(view.weeks.map((w) => w.w)).toEqual(doc.weeks.map((w) => w.index));
  });

  it('oznake su oznake aplikacije i odgovaraju vrsti treninga', () => {
    for (const d of days) {
      const v = view.byId.get(d.id);
      if (v === undefined) continue;
      expect(v.rest, d.id).toBe(d.workout === null);
      if (d.workout === null) {
        expect(v.tag, d.id).toBeUndefined();
        continue;
      }
      expect(DAY_TAGS, d.id).toContain(v.tag);
      expect(classOf(v.tag, v.mlr), d.id).toBe(
        d.workout.kind === 'other' ? 'other' : d.workout.kind
      );
      expect((v.desc ?? '').length, d.id).toBeGreaterThan(0);
      if (v.tag !== 'snaga') expect(v.km ?? 0, d.id).toBeGreaterThan(0);
    }
  });

  it('dan trke je na datumu trke, sa oznakom trke', () => {
    const race = view.dated.find((d) => d.date === goal.raceDate);
    expect(race?.tag).toBe('trka');
  });

  it('dugi > lagan po km u svakoj nedelji koja ima oba', () => {
    for (const w of view.weeks) {
      const long = w.days.filter((d) => d.tag === 'lr').map((d) => d.km ?? 0);
      const easy = w.days.filter((d) => d.tag === 'lako').map((d) => d.km ?? 0);
      if (long.length === 0 || easy.length === 0) continue;
      expect(Math.max(...long), `nedelja ${w.w}`).toBeGreaterThan(Math.min(...easy));
    }
  });

  it('premešten dan: važeći datum novi, mesto po planu staro', () => {
    const today = TODAY;
    const week =
      doc.weeks.find((w) => w.days.some((d) => d.workout !== null && d.date > today)) ??
      doc.weeks[0];
    if (week === undefined) throw new Error('nema nedelje');
    const taken = new Set(week.days.map((d) => d.date));
    const day = week.days.find((d) => d.workout !== null);
    const free = [0, 1, 2, 3, 4, 5, 6]
      .map((i) => {
        const t = new Date(`${week.start}T00:00:00Z`);
        t.setUTCDate(t.getUTCDate() + i);
        return t.toISOString().slice(0, 10);
      })
      .find((x) => !taken.has(x));
    if (day === undefined || free === undefined) return;
    const moved: PlanDoc = clone(doc);
    for (const w of moved.weeks)
      for (const d of w.days)
        if (d.id === day.id) {
          d.movedFrom = d.date;
          d.date = free;
          d.origin = 'manual';
        }
    const v = toResolved(moved).byId.get(day.id);
    expect(v?.date).toBe(free);
    expect(v?.origDate).toBe(day.date);
  });

  it('ne menja ulaz i isti doc daje isti prikaz', () => {
    expect(JSON.stringify(frozen)).toBe(JSON.stringify(doc));
    const again = toResolved(frozen);
    expect(again.dated.map((d) => [d.id, d.date, d.tag, d.km])).toEqual(
      view.dated.map((d) => [d.id, d.date, d.tag, d.km])
    );
  });
});
