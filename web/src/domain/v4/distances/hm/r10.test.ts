/* KRUG 10 (poruka organizatora 13. 11.) — povratak posle događaja, provera nad podacima ove distance. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-argument -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { longCapAfterEvent, noCatchUp, returnsToOriginal } from '../../engine/testdata/round10';
import { SCENARIOS } from './testdata/scenarios';

const RUNS = SCENARIOS.filter((s) => !s.title.startsWith('E5')).map((s) => ({
  s,
  r: s.run() as any
}));

describe('krug 10 — povratak posle događaja (hm)', () => {
  it('1: posle bolesti (E2) plan se vraća na prvobitan pre sužavanja', () => {
    const bad: string[] = [];
    for (const { s, r } of RUNS.filter(({ s }) => s.title.startsWith('E2')))
      bad.push(...returnsToOriginal(`s${String(s.no)}`, r.before, r.after, r.afterState.today));
    expect(bad).toEqual([]);
  });
  it('2: dugi posle svakog događaja ≤ + 25 % / + 20 min od prethodnog dok se plan ne vrati', () => {
    const bad: string[] = [];
    for (const { s, r } of RUNS)
      bad.push(...longCapAfterEvent(`s${String(s.no)}`, r.before, r.after, r.afterState.today));
    expect(bad).toEqual([]);
  });
  it('3: nijedna nedelja posle događaja nije veća od prvobitne (i nedelja −2 ne raste)', () => {
    const bad: string[] = [];
    for (const { s, r } of RUNS)
      bad.push(...noCatchUp(`s${String(s.no)}`, r.before, r.after, r.afterState.today));
    expect(bad).toEqual([]);
  });
});
