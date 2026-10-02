import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../domain/date';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import { resolvePlan } from '../../domain/plan';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import { cycleCaption, cycleModel, PHASE_ORDER } from './cycle';
import { kindOf, weekCells } from './dayCells';

function planOf(raceDate: string, weeks?: number) {
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: '2026-01-05',
      raceDate,
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2700 },
      weeklyKm: 40,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!a) throw new Error('plan');
  const p = resolvePlan(a.weeks, { alts: {}, moves: {} });
  return weeks ? { ...p, weeks: p.weeks.slice(0, weeks) } : p;
}

describe('cycleModel', () => {
  const plan = planOf('2026-04-12');

  it('faze idu redom BAZA → … → TAPER → TRKA, svaka nedelja pripada tačno jednoj', () => {
    const m = cycleModel(plan, {}, '2026-01-14' as IsoDate);
    const keys = m.phases.map((p) => p.key);
    expect(keys[0]).toBe('BAZA');
    expect(keys[keys.length - 1]).toBe('TRKA');
    expect(keys).toEqual([...keys].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b)));
    expect(m.phases.reduce((n, p) => n + p.weeks.length, 0)).toBe(m.total);
    expect(m.total).toBe(plan.weeks.length);
  });

  it('tekuća nedelja je jedna, ranije su urađene, kasnije buduće', () => {
    const m = cycleModel(plan, {}, '2026-01-14' as IsoDate);
    expect(m.current?.w).toBe(2);
    expect(m.weeks.filter((w) => w.state === 'now')).toHaveLength(1);
    expect(m.weeks.filter((w) => w.state === 'done').map((w) => w.w)).toEqual([1]);
    expect(m.weeks.every((w) => w.w <= 2 || w.state === 'future')).toBe(true);
    expect(cycleCaption(m)).toEqual({ week: `N2/${m.total}`, phase: m.current?.phase });
  });

  it('pre početka sve je buduće i nema tekuće nedelje; posle trke sve je urađeno', () => {
    const before = cycleModel(plan, {}, '2025-12-20' as IsoDate);
    expect(before.current).toBeNull();
    expect(before.weeks.every((w) => w.state === 'future')).toBe(true);
    expect(cycleCaption(before)).toBeNull();
    const after = cycleModel(plan, {}, '2026-06-01' as IsoDate);
    expect(after.current).toBeNull();
    expect(after.weeks.every((w) => w.state === 'done')).toBe(true);
    expect(after.phases.every((p) => p.state === 'done')).toBe(true);
  });

  it('rasterećenje nasleđuje fazu prethodne nedelje (ne pravi svoju fazu)', () => {
    const m = cycleModel(plan, {}, '2026-01-14' as IsoDate);
    const deloads = m.weeks.filter((w) => w.deload);
    expect(deloads.length).toBeGreaterThan(0);
    for (const d of deloads) {
      const prev = m.weeks.find((w) => w.w === d.w - 1);
      if (prev) expect([prev.phase, 'TAPER', 'TRKA']).toContain(d.phase);
    }
    expect(m.phases.map((p) => p.key)).not.toContain('DELOAD' as never);
  });

  it('kilometri faze su zbir njenih nedelja', () => {
    const m = cycleModel(plan, {}, '2026-01-14' as IsoDate);
    for (const p of m.phases)
      expect(p.planKm).toBeCloseTo(
        p.weeks.reduce((s, w) => s + w.planKm, 0),
        6
      );
  });
});

describe('weekCells', () => {
  const plan = planOf('2026-04-12');
  const week = plan.weeks[1]!;
  const run = week.days.find((d) => !d.rest && d.date)!;

  it('uvek sedam ćelija, po–ne, sa opisom za čitač ekrana', () => {
    const cells = weekCells(week, {}, '2026-01-14' as IsoDate);
    expect(cells).toHaveLength(7);
    for (const c of cells) expect(c.label).toMatch(/ — /);
  });

  it('stanje: odrađen, preskočen, danas, propušten, predstoji', () => {
    const today = run.date;
    const log = { [run.id]: { status: 'done' as const } };
    const done = weekCells(week, log, today)[run.dow];
    expect(done?.state).toBe('done');
    expect(done?.label).toMatch(/urađeno$/);
    expect(weekCells(week, { [run.id]: { status: 'skip' as const } }, today)[run.dow]?.state).toBe(
      'skip'
    );
    expect(weekCells(week, {}, today)[run.dow]?.state).toBe('today');
    const later = weekCells(week, {}, '2026-03-01' as IsoDate)[run.dow];
    expect(later?.state).toBe('miss');
    const earlier = weekCells(week, {}, '2026-01-01' as IsoDate)[run.dow];
    expect(earlier?.state).toBe('next');
  });

  it('dan odmora je odmor, a vrste su samo četiri', () => {
    const cells = weekCells(week, {}, '2026-01-14' as IsoDate);
    expect(cells.some((c) => c.state === 'rest')).toBe(true);
    expect(new Set(cells.map((c) => c.kind)).size).toBeLessThanOrEqual(4);
    expect(kindOf('tempo')).toBe('q');
    expect(kindOf('lr')).toBe('l');
    expect(kindOf('snaga')).toBe('s');
    expect(kindOf('lako')).toBe('e');
  });
});
