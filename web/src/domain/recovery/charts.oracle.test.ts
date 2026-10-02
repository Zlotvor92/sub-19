import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import type { IsoDate } from '../date';
import type { PainRecord, WeightRecord, WellnessRecord } from '../state';
import { painModel, seriesModel, weightModel } from './index';

/* parity: chartHrv, chartRhr, chartWeight, chartKnee (app.js) — iste tačke, iste ose. */

const TODAY = '2026-01-07' as IsoDate;
let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;
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
const day = (n: number): string => new Date(Date.UTC(2025, 10, 1 + n)).toISOString().slice(0, 10);
const pts = (svg: string, cls: string): string[] => {
  const m = new RegExp(`<polyline class="${cls}"[^>]*points="([^"]*)"`).exec(svg);
  return m?.[1] ? m[1].split(' ') : [];
};
const fx = (p: { x: number; y: number }): string => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

describe('grafikoni oporavka naspram starog koda', () => {
  for (const [name, field, legacyFn, range] of [
    ['HRV', 'hrv', 'chartHrv', 'percent'],
    ['puls u miru', 'pulsUMiru', 'chartRhr', 'beats']
  ] as const) {
    it(`${name}: iste tačke i ista osnova (150 nasumičnih nizova)`, () => {
      const r = rng(21);
      let drawn = 0;
      for (let i = 0; i < 150; i++) {
        const n = 1 + Math.floor(r() * 30);
        const recs: WellnessRecord[] = [];
        for (let k = 0; k < n; k++) {
          const date = day(k + Math.floor(r() * 2));
          recs.push({
            datum: date,
            hrv: r() < 0.15 ? null : Math.round(35 + r() * 50),
            pulsUMiru: r() < 0.15 ? null : Math.round(42 + r() * 18)
          } as WellnessRecord);
        }
        ctx()['__n'] = j(recs);
        const svg = String(legacy.evalIn(`${legacyFn}(__n)`));
        const m = seriesModel(recs, field, range);
        if (!m) {
          expect(svg, `${i}`).toContain('bar 4 dana');
          continue;
        }
        drawn++;
        expect(m.items.map(fx), `${name} ${i} linija`).toEqual(pts(svg, 'ln'));
        const all = [...svg.matchAll(/<polyline points="([^"]*)"/g)].map((x) => x[1]);
        expect(m.base.map(fx).join(' '), `${name} ${i} osnova`).toBe(all[0]);
      }
      expect(drawn).toBeGreaterThan(100);
    });
  }

  it('masa: iste tačke, iste vrednosti na osi, iste oznake datuma (uključujući kratke i prazne nizove)', () => {
    const r = rng(22);
    let drawn = 0;
    for (let i = 0; i < 150; i++) {
      const n = Math.floor(r() * 12);
      const kg: WeightRecord[] = [];
      const span = r() < 0.3 ? 3 : 60;
      for (let k = 0; k < n; k++)
        kg.push({ date: day(Math.floor(r() * span)), kg: Math.round((70 + r() * 15) * 10) / 10 });
      ctx()['__kg'] = j(kg);
      legacy.evalIn('S.kg=__kg; CHART_SEL.wt=null; S.genPlan=S.genPlan||null; 0');
      const svg = String(legacy.evalIn('chartWeight()'));
      const m = weightModel(kg, TODAY);
      if (!m) {
        expect(svg).toContain('Još nema merenja');
        continue;
      }
      drawn++;
      expect(m.items.map(fx), `${i} tačke`).toEqual(
        [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="3\.4"/g)].map(
          (x) => `${x[1]},${x[2]}`
        )
      );
      const ticks = [
        ...svg.matchAll(
          /<text class="ax" x="[\d.]+" y="([\d.]+)" text-anchor="end">([^<]*)<\/text>/g
        )
      ];
      expect(
        m.ticks.map((t) => (t.y + 3).toFixed(1)),
        `${i} y osa`
      ).toEqual(ticks.slice(0, 5).map((t) => t[1]));
      const labels = [
        ...svg.matchAll(
          /<text class="ax" x="([\d.]+)" y="[\d.]+" text-anchor="(?:start|middle)">(\d\d\.\d\d\.)<\/text>/g
        )
      ];
      expect(
        m.dateLabels.slice(0, 2).map((l) => l.x.toFixed(1)),
        `${i} datumi`
      ).toEqual(labels.map((l) => l[1]));
    }
    expect(drawn).toBeGreaterThan(80);
  });

  it('bol: iste tačke i ista osa', () => {
    const r = rng(23);
    for (let i = 0; i < 100; i++) {
      const n = Math.floor(r() * 15);
      const knee: PainRecord[] = [];
      for (let k = 0; k < n; k++)
        knee.push({
          id: `k${k}`,
          date: day(Math.floor(r() * 60)),
          pain: Math.floor(r() * 11),
          part: 'koleno-L',
          act: 'Trčanje'
        });
      ctx()['__k'] = j(knee);
      legacy.evalIn('S.knee=__k; CHART_SEL.knee=null; 0');
      const svg = String(legacy.evalIn('chartKnee()'));
      const m = painModel(knee, TODAY);
      if (!m) {
        expect(svg).toContain('Nema unosa');
        continue;
      }
      expect(m.items.map(fx), `${i}`).toEqual(
        [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="3\.6"/g)].map(
          (x) => `${x[1]},${x[2]}`
        )
      );
    }
  });
});
