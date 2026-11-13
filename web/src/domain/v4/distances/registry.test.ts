/* KRUG 8 (briefs/R8-ENGINE.md t. 9): podaci distanci upućuju jedni na druge samo kroz id foldera (registar). */
import { describe, expect, it } from 'vitest';
import { DISTANCE_BY_METERS } from '../adapters/stimuli';
import type { DistanceData } from '../engine';

const modules = import.meta.glob<DistanceData>('./*/index.ts', { import: 'default', eager: false });
const all = await Promise.all(
  Object.keys(modules).map(async (path) => {
    const mod = (await import(/* @vite-ignore */ path)) as Record<string, unknown>;
    const data = Object.values(mod).find(
      (v): v is DistanceData => typeof v === 'object' && v !== null && 'adequate' in v && 'id' in v
    );
    if (data === undefined) throw new Error(path);
    return { path, data };
  })
);

describe('registar distanci', () => {
  it('svaka distanca je folder sa id-jem foldera', () => {
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (const { path, data } of all) expect(path).toBe(`./${data.id}/index.ts`);
  });
  it('`adequate.shorter.distanceId` je id distance iz registra (adapteri), a dužina mu je kraća', () => {
    const known = new Map(DISTANCE_BY_METERS.map((x) => [x.id, x.distanceM]));
    for (const { data } of all) {
      expect(known.get(data.id), data.id).toBe(data.distanceM);
      const to = data.adequate.shorter?.distanceId;
      if (to === undefined) continue;
      expect([...known.keys()], data.id).toContain(to);
      expect(known.get(to) ?? Infinity, data.id).toBeLessThan(data.distanceM);
    }
  });
});
