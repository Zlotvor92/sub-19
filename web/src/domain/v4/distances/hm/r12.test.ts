/* KRUG 12 (briefs/R12.md) — motor nad podacima polumaratona. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';
import { paceCtxOf, summarize } from '../../engine';
import { pacesAnnounced } from '../../engine/testdata/round12';
import { SCENARIOS } from './testdata/scenarios';

const ALL = SCENARIOS.map((s) => ({ s, r: s.run() as any }));

describe('krug 12 — polumaraton', () => {
  it('M1: promena tempa posle rezultata uvek ima rečenicu (s02, s04, s08)', () => {
    /* E5 (juče trka) je nov plan iz stanja, ne izmena */
    const replans = ALL.filter(({ s }) => !s.title.startsWith('E5'));
    expect(replans.flatMap(({ s, r }) => pacesAnnounced(`s${String(s.no)}`, r))).toEqual([]);
  });

  it('M9: tekst imenuje tačnu vrstu treninga (prag nije „tempo trke") i razlog pauze (put nije bolest)', () => {
    const bad: string[] = [];
    for (const { s, r } of ALL)
      for (const c of r.changes as { reason: string }[]) {
        if (/ključni trening „prag/.test(c.reason) && /treninga u tempu trke/.test(c.reason))
          bad.push(`s${String(s.no)}: prag kao tempo trke`);
        if (/Pauza zbog puta/.test(c.reason) && /posle bolesti/.test(c.reason))
          bad.push(`s${String(s.no)}: put kao bolest`);
      }
    expect(bad).toEqual([]);
  });

  it('M3: s26 — dugi 3 dana posle trke 10 km ne raste preko poslednjeg odrađenog dugog (60 min)', () => {
    const r = ALL.find(({ s }) => s.no === 26)?.r;
    const ctx = paceCtxOf(r.after.header);
    const day = (r.after.weeks as any[])
      .flatMap((w) => w.days)
      .find((d) => d.date === '2027-01-17');
    expect(day?.workout?.kind).toBe('long');
    expect(summarize(day.workout, ctx).durationSec).toBeLessThanOrEqual(60 * 60 + 60);
  });
});
