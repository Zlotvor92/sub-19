/* K4 (marathon-v2.14.0; glavni trener krug 3, coach/ROUND-03.md § 3): K4-A plan sa 3 dana — blok MP najnižeg nivoa u
   dugom nedelje B (dan MP treninga lagan) i talas dugog (najduži najviše 3 puta od kraja, ostale nedelje platoa ≤ 0,85
   × najduži); K4-B mali obim — kratak lagan dan. Profili P9 iz k3.node.test.ts; mere se čitaju iz plana (dani,
   segmenti), nezavisno od funkcija konstruktora. */
import { describe, expect, it } from 'vitest';
import { prof } from './k3.node.test.ts';
import type { MarathonV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';

const longOf = (w: PlanWeek) => w.days.find((d) => d.role === 'long');
const longKm = (w: PlanWeek): number => longOf(w)?.workout.km ?? 0;
const blockKm = (w: PlanWeek): number => longOf(w)?.workout.workKm.MP ?? 0;
/** Rep: ne-rasteretne nedelje izgradnje pred taperom. */
const tail = (p: MarathonV2Plan): PlanWeek[] =>
  p.weeks.filter((w) => !w.deload && ['base', 'development', 'specific'].includes(w.phase));
const errors = (p: MarathonV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => `${v.rule} ${v.week}`);

describe('K4-A: 3 dana — blok MP u dugom i talas dugog', () => {
  for (const id of ['p03', 'p08', 'p10']) {
    it(`${id}: nedelja B ima blok MP 8 km (najniži nivo naviše), bez kvaliteta usred nedelje; ostale specifične imaju MP`, () => {
      const p = prof(id);
      const spec = p.weeks.filter((w) => w.phase === 'specific' && !w.deload);
      const b = spec.filter((w) => blockKm(w) > 0);
      expect(b.length).toBeGreaterThanOrEqual(2);
      expect(blockKm(b[0]!)).toBe(8);
      // Poslednja nedelja pred taper je nedelja B.
      expect(blockKm(spec[spec.length - 1]!)).toBeGreaterThan(0);
      for (const w of b) expect(w.days.some((d) => d.workout.kind === 'quality')).toBe(false);
      for (const w of spec.filter((x) => blockKm(x) === 0))
        expect(w.days.some((d) => d.workout.dose?.zone === 'MP')).toBe(true);
      expect(errors(p)).toEqual([]);
    });

    it(`${id}: talas — najduži dugi najviše 3 puta, nikad 2 nedelje repa zaredom; između ≤ 0,85 × najduži`, () => {
      const p = prof(id);
      const t = tail(p);
      const top = Math.max(...p.weeks.map(longKm));
      const atTop = t.map((w) => longKm(w) >= top - 0.45);
      expect(atTop.filter(Boolean).length).toBeLessThanOrEqual(3);
      for (let i = 1; i < atTop.length; i++) expect(atTop[i]! && atTop[i - 1]!).toBe(false);
      // Nedelja A između dve nedelje B (specifična faza) — dugi ≤ 0,85 × najduži + 0,1 km.
      const spec = t.filter((w) => w.phase === 'specific');
      for (const w of spec.filter((x) => blockKm(x) === 0))
        expect(longKm(w)).toBeLessThanOrEqual(0.85 * top + 0.1);
    });
  }

  it('p08: dugi 29,3 km × 2–3 (bilo 29,3 × 5 pri 50 % nedelje), vrh obima ostaje 60 km', () => {
    const p = prof('p08');
    const top = Math.max(...p.weeks.map(longKm));
    expect(top).toBe(29.3);
    expect(tail(p).filter((w) => longKm(w) >= 29.25).length).toBeLessThanOrEqual(3);
    expect(Math.max(...tail(p).map((w) => w.targetKm))).toBe(60);
  });
});

describe('K4-B: mali obim — kratak lagan dan', () => {
  it('p06 (5 dana, 40 km): nedelje sa danom odmora i oznakom, dugi isti, lagani ≥ 30 min; rečenica plana; bez upozorenja planirano < cilj', () => {
    const p = prof('p06');
    const tagged = p.weeks.filter((w) =>
      w.notes.some((n) => n.includes('odmor ili 20 min lagano po želji'))
    );
    expect(tagged.length).toBeGreaterThan(2);
    expect(p.notes.some((n) => n.startsWith('Mali obim:'))).toBe(true);
    for (const w of tagged) {
      expect(w.deload).toBe(false);
      expect(w.days).toHaveLength(p.input.runDays.length - 1);
      expect(w.plannedKm).toBeLessThanOrEqual(w.targetKm + 0.1);
      for (const d of w.days.filter((x) => x.role === 'easy'))
        expect(d.workout.sec).toBeGreaterThanOrEqual(1800);
    }
    expect(p.warnings.some((v) => v.rule === 'PLANNED_BELOW_TARGET')).toBe(false);
    expect(errors(p)).toEqual([]);
  });

  it('plan bez kratkih laganih (p01) — bez dana odmora i bez rečenice', () => {
    const p = prof('p01');
    expect(p.notes.some((n) => n.startsWith('Mali obim:'))).toBe(false);
    expect(
      p.weeks.every((w) => !w.notes.some((n) => n.includes('odmor ili 20 min lagano po želji')))
    ).toBe(true);
    // Korisnički tekst bez interne oznake pravila.
    for (const w of prof('p06').weeks) for (const n of w.notes) expect(n).not.toContain('K4-B');
  });
});
