import { describe, expect, it } from 'vitest';
import { same as sameFiveK } from './fiveK/v2/same.ts';
import { same as sameHm } from './halfMarathon/v2/same.ts';
import { same as sameMarathon } from './marathon/v2/same.ts';
import { same as sameTenK } from './tenK/v2/same.ts';

/* `<distanca>/v2/same.ts` (četiri kopije, Uslov 7) zamenjuje `JSON.stringify(a) === JSON.stringify(b)` u spajanju,
   konstruktoru i validatoru v2 generatora. Mora biti TAČNO isto: rubni slučajevi JSON-a i nasumični parovi (isti
   ulaz → isti par pri svakom pokretanju). Bajt-isti izlaz generatora uz to proveravaju heševi mreža punog nivoa. */

const json = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const COPIES = [
  ['5K', sameFiveK],
  ['10K', sameTenK],
  ['HM', sameHm],
  ['maraton', sameMarathon]
] as const;

const fn = (): number => 1;
const sym = Symbol('s');
const day = new Date(Date.UTC(2026, 9, 24));

const EDGE: readonly (readonly [unknown, unknown])[] = [
  [undefined, undefined],
  [undefined, null],
  [fn, undefined],
  [sym, fn],
  [null, null],
  [0, -0],
  [NaN, null],
  [Infinity, null],
  [-Infinity, NaN],
  [1, '1'],
  [true, 'true'],
  ['a', 'a'],
  ['\ud800', '\ud800'],
  ['\ud800', '\udc00'],
  [[], {}],
  [[undefined], [null]],
  [
    [fn, sym],
    [null, null]
  ],
  [[NaN], [null]],
  [
    [1, 2],
    [1, 2, 3]
  ],
  [{ a: undefined }, {}],
  [{ a: fn, b: 1 }, { b: 1 }],
  [
    { a: 1, b: 2 },
    { b: 2, a: 1 }
  ],
  [
    { 2: 'x', 1: 'y' },
    { 1: 'y', 2: 'x' }
  ],
  [{ a: [1, { b: undefined }] }, { a: [1, {}] }],
  [Object.create(null) as object, {}],
  [{ d: day }, { d: day.toISOString() }],
  [day, day.toISOString()],
  [new Map([[1, 2]]), {}],
  [{ toJSON: () => 5 }, 5],
  [{ toJSON: () => undefined }, undefined],
  [{ a: { toJSON: () => 'x' } }, { a: 'x' }],
  [{ a: { toJSON: () => undefined } }, {}],
  [{ a: { toJSON: () => undefined }, b: 1 }, { b: 1 }],
  [[{ toJSON: () => undefined }], [null]],
  [new Number(3), 3],
  [new String('s'), 's'],
  [Array.from({ length: 2 }, (_, i) => (i === 1 ? 1 : undefined)), [null, 1]]
];

/** mulberry32: isti niz pri svakom pokretanju. */
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

const LEAVES: readonly unknown[] = [
  0,
  -0,
  1,
  1.5,
  -7,
  1e21,
  NaN,
  Infinity,
  null,
  true,
  false,
  '',
  'a',
  'Ž',
  '2026-10-24',
  undefined,
  fn,
  sym,
  day,
  { toJSON: () => undefined }
];
const KEYS = ['a', 'b', 'km', 'date', 'role', '0', '7', 'weeks'];

function value(r: () => number, depth: number): unknown {
  const p = r();
  if (depth > 3 || p < 0.5) return LEAVES[Math.floor(r() * LEAVES.length)];
  if (p < 0.75) return Array.from({ length: Math.floor(r() * 4) }, () => value(r, depth + 1));
  const o: Record<string, unknown> = {};
  for (let i = Math.floor(r() * 4); i > 0; i--)
    o[KEYS[Math.floor(r() * KEYS.length)]!] = value(r, depth + 1);
  return o;
}

/** Kopija sa malom izmenom (ili bez nje): list, redosled ključeva, izostavljen član, null ↔ undefined. */
function near(v: unknown, r: () => number): unknown {
  const p = r();
  if (p < 0.08) return LEAVES[Math.floor(r() * LEAVES.length)];
  if (Array.isArray(v)) return v.map((x) => near(x, r));
  if (typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype) {
    const entries = Object.entries(v).map(([k, x]) => [k, near(x, r)] as const);
    if (p < 0.15) entries.reverse();
    if (p > 0.95) entries.push(['extra', undefined]);
    if (p > 0.9 && p <= 0.95) entries.pop();
    return Object.fromEntries(entries);
  }
  return v;
}

describe('same = JSON.stringify jednakost (sve četiri kopije)', () => {
  it.each(COPIES)('%s: rubni slučajevi JSON-a', (_, same) => {
    for (const [a, b] of EDGE) {
      expect(same(a, b), `${String(JSON.stringify(a))} / ${String(JSON.stringify(b))}`).toBe(
        json(a, b)
      );
      expect(same(b, a)).toBe(json(b, a));
      expect(same(a, a)).toBe(json(a, a));
    }
  });

  it.each(COPIES)('%s: 20 000 nasumičnih parova', (_, same) => {
    const r = rng(20261024);
    let equal = 0;
    for (let i = 0; i < 20_000; i++) {
      const a = value(r, 0);
      const b = near(a, r);
      const want = json(a, b);
      if (want) equal++;
      if (same(a, b) !== want) expect([JSON.stringify(a), JSON.stringify(b)]).toBe(want);
    }
    expect(equal).toBeGreaterThan(5000);
    expect(equal).toBeLessThan(19_000);
  });
});
