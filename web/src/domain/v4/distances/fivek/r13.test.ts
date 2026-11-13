/* KRUG 13 (M17) — model tempa nad scenarijima 5 km. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { paceDirection } from '../../engine/testdata/round12';
import { SCENARIOS } from './testdata/scenarios';

const ALL = SCENARIOS.map((s) => ({ s, r: s.run() as any }));

describe('krug 13 — 5 km, model tempa', () => {
  it('M17: test brži od očekivanog (S03, S11) daje izmenu, ne „PROMENA: 0"', () => {
    for (const no of [3, 11]) {
      const r = ALL.find(({ s }) => s.no === no)?.r;
      expect((r.changes as unknown[]).length, `s${String(no)}`).toBeGreaterThan(0);
    }
  });
  it('M17: smer tempa prati smer rezultata (nijedna zona suprotno)', () => {
    const replans = ALL.filter(({ s }) => !s.title.startsWith('E5'));
    expect(replans.flatMap(({ s, r }) => paceDirection(`s${String(s.no)}`, r))).toEqual([]);
  });
});
