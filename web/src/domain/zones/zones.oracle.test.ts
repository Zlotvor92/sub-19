import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import {
  driftLevel,
  missingZonesReason,
  zoneDistribution,
  zoneForHr,
  zoneSource,
  zonesForRun,
  zonesFromUpperBounds,
  type RawZone
} from './index';

/* parity: test/zone-pulsa.test.mjs (57 testova). Poredi `domain/zones` sa starim `zoneIzvor`,
   `zoneIzGranica`, `zoneRaspodela`, `zoneZaTrening`, `zonaZaPuls`, `zoneRazlog`, `bojaDrifta`. */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const j = <T>(x: unknown): T =>
  x === undefined ? (undefined as T) : (JSON.parse(JSON.stringify(x)) as T);
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;

let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-07-12T09:00:00Z');
});
const set = (name: string, v: unknown): void => {
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx[name] = v;
};

function randomZones(r: () => number): RawZone[] | undefined | null {
  const x = r();
  if (x < 0.15) return undefined;
  if (x < 0.2) return null;
  if (x < 0.25) return [];
  const n = 5 + Math.floor(r() * 3);
  const zones: RawZone[] = [];
  let lo = 1;
  for (let i = 0; i < n; i++) {
    const hi = lo + 10 + Math.floor(r() * 15);
    const z: Record<string, unknown> = { min: lo, max: i === n - 1 ? (r() < 0.5 ? null : -1) : hi };
    if (r() < 0.6) z['ime'] = pick(r, ['Z1 oporavak', ' Prag ', '', 5]);
    if (r() < 0.05) z['min'] = null;
    zones.push(z);
    lo = hi + 1;
  }
  if (r() < 0.05) zones.push(null);
  return zones;
}

function randomUpper(r: () => number): unknown {
  const x = r();
  if (x < 0.1) return undefined;
  if (x < 0.15) return 'x';
  const n = 1 + Math.floor(r() * 9);
  const out: unknown[] = [];
  let v = 110;
  for (let i = 0; i < n; i++) {
    v += 6 + Math.floor(r() * 14);
    out.push(
      r() < 0.04 ? null : r() < 0.04 ? 300 : r() < 0.04 ? v - 40 : r() < 0.05 ? String(v) : v
    );
  }
  return out;
}

describe('zone pulsa naspram starog koda', () => {
  it('zonesFromUpperBounds: 500 nizova (nevažeći, preširoki, nerastući, stringovi)', () => {
    const r = rng(1);
    for (let i = 0; i < 500; i++) {
      const g = randomUpper(r);
      set('__g', j(g));
      expect(zonesFromUpperBounds(g), `iter ${i} ${JSON.stringify(g)}`).toEqual(
        j(legacy.evalIn('zoneIzGranica(__g)'))
      );
    }
  });

  it('zoneSource + zoneForHr: izvor icu → Strava → ništa; puls u zoni', () => {
    const r = rng(2);
    for (let i = 0; i < 500; i++) {
      const icu = r() < 0.7 ? { hrZones: randomZones(r) } : null;
      const strava = r() < 0.7 ? { hrZones: randomZones(r) } : null;
      set('__i', j(icu));
      set('__s', j(strava));
      legacy.evalIn('S.icu=__i; S.strava=__s; 0');
      const old = j<{ zone: unknown; izvor: string | null }>(legacy.evalIn('zoneIzvor()'));
      const mine = zoneSource(icu, strava);
      expect({ zone: mine.zones, izvor: mine.source }, `izvor ${i}`).toEqual(old);
      for (const hr of [0, -3, 49, 90, 120, 145, 160, 175, 190, 230, Number.NaN, null, undefined]) {
        expect(zoneForHr(hr as number, mine.zones), `puls ${String(hr)} ${i}`).toEqual(
          (() => {
            const o = j<{ n: number; od: number; do: number | null } | null>(
              legacy.call('zonaZaPuls', hr ?? null)
            );
            return o && { n: o.n, from: o.od, to: o.do };
          })()
        );
      }
    }
  });

  it('zoneDistribution / zonesForRun / missingZonesReason: 700 nasumičnih trčanja', () => {
    const r = rng(3);
    const out = { dist: 0, none: 0 };
    for (let i = 0; i < 700; i++) {
      const n = pick(r, [5, 5, 7, 7, 6]);
      const own = r() < 0.5;
      const secs = Array.from({ length: n }, () =>
        r() < 0.05 ? (null as unknown as number) : r() < 0.05 ? -10 : Math.floor(r() * 1800)
      );
      const log: Record<string, unknown> = {};
      if (r() < 0.9) log['icu'] = { zonePuls: secs };
      if (own && log['icu'])
        (log['icu'] as Record<string, unknown>)['zoneGranice'] = randomUpper(r);
      if (r() < 0.1) log['lock'] = true;
      const icuZones = r() < 0.7 ? { hrZones: randomZones(r) } : null;
      const stravaZones = r() < 0.5 ? { hrZones: randomZones(r) } : null;
      const connected = r() < 0.8;
      const err = r() < 0.2 ? 'Greška pri povlačenju zona' : undefined;
      set('__l', j(log));
      set(
        '__i',
        connected
          ? { athleteId: 'i1', token: 't', ...j<object>(icuZones ?? {}), zoneGreska: err }
          : j(icuZones)
      );
      set('__s', j(stravaZones));
      legacy.evalIn('S.icu=__i; S.strava=__s; 0');
      const current = zoneSource(
        legacy.evalIn('S.icu') as { hrZones?: unknown } | null,
        legacy.evalIn('S.strava') as { hrZones?: unknown } | null
      );
      const old = j<{ ukupno: number; redovi: unknown[]; izvor: string; zone: unknown } | null>(
        legacy.evalIn('zoneRaspodela(__l)')
      );
      const mine = zoneDistribution(log, current);
      expect(
        mine && {
          ukupno: mine.total,
          redovi: mine.rows.map((x) => ({ n: x.n, sec: x.sec, pct: x.pct, ime: x.ime })),
          izvor: mine.source,
          zone: mine.zones
        },
        `raspodela ${i}`
      ).toEqual(old);
      if (mine) {
        out.dist++;
        expect(
          mine.rows.reduce((s, x) => s + x.pct, 0),
          `zbir procenata ${i}`
        ).toBe(100);
      } else out.none++;
      const oldRun = j<{ zone: unknown; izvor: string | null }>(
        legacy.evalIn('zoneZaTrening(__l)')
      );
      const run = zonesForRun(log, current);
      expect({ zone: run.zones, izvor: run.source }, `zone za trening ${i}`).toEqual(oldRun);
      expect(
        missingZonesReason(log, {
          icuConnected: !!legacy.evalIn('icuPovezan()'),
          current,
          zoneError: (legacy.evalIn('S.icu&&S.icu.zoneGreska') as string | undefined) ?? null
        }),
        `razlog ${i}`
      ).toBe(legacy.evalIn('zoneRazlog(__l)'));
    }
    expect(out.dist).toBeGreaterThan(100);
    expect(out.none).toBeGreaterThan(100);
  });

  it('driftLevel: iste granice kao stari bojaDrifta', () => {
    const color = { good: 'var(--green)', warn: 'var(--amber)', bad: 'var(--red)' } as const;
    for (const n of [-3, 0, 4.9, 5, 7.9, 8, 15, Number.NaN])
      expect(color[driftLevel(n)], `${n}`).toBe(legacy.call('bojaDrifta', n));
  });
});
