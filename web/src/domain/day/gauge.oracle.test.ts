import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { gaugeView, vdotDeltaView } from './gauge';

/* parity: meriloHTML / vdotDeltaHTML (app.js). */

let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp();
});

const html = (plan: unknown, done: unknown): string =>
  String(legacy.evalIn(`meriloHTML(${JSON.stringify(plan)}, ${JSON.stringify(done)})`));

describe('merilo radnog dela naspram starog meriloHTML', () => {
  const cases: Array<[number | null, number | null]> = [
    [240, 240],
    [240, 238],
    [240, 250],
    [240, 300],
    [240, 100],
    [240, null],
    [null, 240],
    [0, 240],
    [240, 0],
    [300.4, 305.9]
  ];
  for (let i = 0; i < 60; i++) cases.push([200 + i * 3, 190 + ((i * 17) % 90)]);

  it.each(cases)('plan %s / ostvareno %s: luk, kuglica i odstupanje isti', (plan, done) => {
    const old = html(plan, done);
    const g = gaugeView(plan, done);
    expect(old).toContain(`d="${g.arc}"`);
    const circle = /<circle cx="([\d.]+)" cy="([\d.]+)"/.exec(old);
    if (g.dot) expect([circle?.[1], circle?.[2]]).toEqual(g.dot.map((n) => n.toFixed(1)));
    else expect(circle).toBeNull();
    const txt = />([^<]*)<\/span>$/.exec(old)?.[1];
    expect(txt).toBe(g.delta == null ? '—' : `${g.delta > 0 ? '+' : ''}${g.delta} s`);
  });
});

describe('promena VDOT-a', () => {
  it('stanja: bez tempa, bez zapisa, rast, pad, bez promene', () => {
    expect(vdotDeltaView(null, undefined).kind).toBe('enter');
    expect(vdotDeltaView(240, undefined).kind).toBe('none');
    expect(vdotDeltaView(240, { vdot: 50, delta: 0.4 })).toMatchObject({ arrow: '↑', tone: 'up' });
    expect(vdotDeltaView(240, { vdot: 50, delta: -0.4 })).toMatchObject({
      arrow: '↓',
      tone: 'down'
    });
    expect(vdotDeltaView(240, { vdot: 50, delta: 0.05 })).toMatchObject({
      arrow: '→',
      tone: 'flat'
    });
  });
});
