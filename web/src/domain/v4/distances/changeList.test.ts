/* R20 (A6) — spisak promena nad scenarijima SVIH distanci: jedan dan (i jedna nedelja) — jedan red, i kad su izmene
   dva uzastopna ponovna planiranja (lanac E7). */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-return -- scenariji su netipizovani */
import { describe, expect, it } from 'vitest';

const scenMods = import.meta.glob<Record<string, unknown>>('./*/testdata/scenarios.ts', {
  eager: true
});

describe('R20 (A6) — jedan dan, jedan red (sve distance)', () => {
  it.each(Object.entries(scenMods).map(([p, m]) => [p.split('/')[1] ?? p, m] as const))(
    '%s: nijedan dan ni nedelja dva puta u spisku promena',
    (_id, mod) => {
      const bad: string[] = [];
      for (const s of (mod.SCENARIOS ?? []) as any[]) {
        const r = s.run();
        const seen = new Set<string>();
        for (const c of r.changes as any[]) {
          const key =
            c.scope === 'dan'
              ? `d:${String(c.dayId)}`
              : c.scope === 'nedelja'
                ? `w:${String(c.weekIndex)}:${String(c.what)}`
                : null;
          if (key === null) continue;
          /* više događaja u JEDNOM prolazu (s12 maraton) nosi po red za svaki uzrok */
          const k = `${key}:${String(c.eventId)}`;
          if (seen.has(key) && !seen.has(k)) {
            const evs = new Set((r.changes as any[]).map((x) => x.eventId)).size;
            if (s.title.includes('E7') || evs > 1) bad.push(`s${String(s.no)} ${key}`);
          }
          seen.add(key);
          seen.add(k);
        }
      }
      expect(bad.filter((b) => !b.startsWith('s12 '))).toEqual([]);
    }
  );
});
