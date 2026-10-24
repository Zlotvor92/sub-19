import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { TestSpecification, Vitest } from 'vitest/node';
import { DurationSequencer } from './testSequencer.ts';

/* scripts/testSequencer.ts: podela `--shard` po trajanju mora dati svaki fajl TAČNO jednom (unija delova = svi fajlovi,
   bez preklapanja), istu podelu u svakom poslu i uravnotežen zbir; redosled: pali prvo, pa najduži. */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TABLE = JSON.parse(
  readFileSync(new URL('./test-durations.json', import.meta.url), 'utf8')
) as Record<string, number>;

const spec = (path: string): TestSpecification =>
  ({ moduleId: `${ROOT}${path}`, project: { name: 'node' } }) as unknown as TestSpecification;

function sequencer(
  shard: { index: number; count: number } | undefined,
  cached: Record<string, { failed: boolean; duration: number }> = {}
): DurationSequencer {
  const ctx = {
    config: { root: ROOT.replace(/\/$/, ''), shard },
    cache: { getFileTestResults: (key: string) => cached[key] }
  } as unknown as Vitest;
  return new DurationSequencer(ctx);
}

const FILES = [...Object.keys(TABLE), 'src/nov.node.test.ts', 'src/drugi-nov.test.ts'];

describe('raspoređivanje testova po trajanju', () => {
  it('delovi su disjunktni, unija = svi fajlovi, ista podela pri svakom pozivu', async () => {
    const seen = new Map<string, number>();
    for (let i = 1; i <= 6; i++) {
      const a = await sequencer({ index: i, count: 6 }).shard(FILES.map(spec));
      const b = await sequencer({ index: i, count: 6 }).shard([...FILES].reverse().map(spec));
      expect(a.map((s) => s.moduleId).sort()).toEqual(b.map((s) => s.moduleId).sort());
      for (const s of a) seen.set(s.moduleId, (seen.get(s.moduleId) ?? 0) + 1);
    }
    expect(seen.size).toBe(FILES.length);
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
  });

  it('zbir trajanja delova se razlikuje najviše za najduži fajl', async () => {
    const totals: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const xs = await sequencer({ index: i, count: 6 }).shard(FILES.map(spec));
      totals.push(xs.reduce((s, x) => s + (TABLE[x.moduleId.slice(ROOT.length)] ?? 1), 0));
    }
    const longest = Math.max(...Object.values(TABLE));
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(longest);
  });

  it('bez --shard vraća sve fajlove', async () => {
    expect(await sequencer(undefined).shard(FILES.map(spec))).toHaveLength(FILES.length);
  });

  it('redosled: pali prvo, pa najduži (keš poslednjeg pokretanja, inače tabela)', async () => {
    const [heavy] = Object.entries(TABLE).sort((a, b) => b[1] - a[1])[0];
    const light = 'src/nov.node.test.ts';
    const failed = 'src/drugi-nov.test.ts';
    const order = await sequencer(undefined, {
      [`node:${failed}`]: { failed: true, duration: 5 }
    }).sort([light, heavy, failed].map(spec));
    expect(order.map((s) => s.moduleId.slice(ROOT.length))).toEqual([failed, heavy, light]);
  });
});
