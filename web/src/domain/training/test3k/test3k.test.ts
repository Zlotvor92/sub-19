import { describe, expect, it } from 'vitest';
import { T3K_SEC_MIN } from '../constants/product';
import { predictionSummary } from '../prediction/summary';
import { t3kPossible, t3kSlowest } from '../vdot/limits';
import { addT3k, removeT3k, t3kRows, t3kSeries, t3kVdot } from './index';

/* parity: test/test-3km.test.mjs — granice verodostojnosti, upis i brisanje, red predikcije.
   Brojčana jednakost sa starim kodom je u `test3k.oracle.test.ts`. */

const empty = { t3k: [], vdotLog: [] };

describe('verodostojnost vremena', () => {
  it('ispod 7:20 i iznad granice tablice nije test', () => {
    expect(t3kPossible(T3K_SEC_MIN - 1)).toBe(false);
    expect(t3kPossible(T3K_SEC_MIN)).toBe(true);
    expect(t3kPossible(t3kSlowest())).toBe(true);
    expect(t3kPossible(t3kSlowest() + 1)).toBe(false);
  });
  it('brže vreme daje veći VDOT; besmislica daje null', () => {
    const a = t3kVdot(700) as number;
    const b = t3kVdot(800) as number;
    expect(a).toBeGreaterThan(b);
    expect(t3kVdot(-5)).toBeNull();
    expect(t3kVdot(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('upis i brisanje', () => {
  it('nemoguć test se ne upisuje ni u listu ni u lanac', () => {
    expect(addT3k(empty, '2026-02-01', 100, 'a')).toBeNull();
  });
  it('mogući test ulazi u listu i u lanac sa istim ID-jem; ulaz se ne mutira', () => {
    const before = JSON.stringify(empty);
    const r = addT3k(empty, '2026-02-01', 720, 'a');
    expect(JSON.stringify(empty)).toBe(before);
    expect(r?.id).toBe('t3k-2026-02-01-a');
    expect(r?.t3k).toHaveLength(1);
    expect(r?.vdotLog[0]).toMatchObject({ id: r?.id, measured: r?.measured, vdotMigrated: true });
  });
  it('ponovni upis istog ID-ja zamenjuje zapis u lancu, ne dupla ga', () => {
    const r = addT3k(empty, '2026-02-01', 720, 'a');
    if (!r) throw new Error('addT3k');
    const again = addT3k({ t3k: [], vdotLog: r.vdotLog }, '2026-02-01', 700, 'a');
    expect(again?.vdotLog).toHaveLength(1);
  });
  it('brisanje uklanja test i iz liste i iz lanca', () => {
    const r = addT3k(empty, '2026-02-01', 720, 'a');
    if (!r) throw new Error('addT3k');
    const out = removeT3k(r, r.id);
    expect(out.t3k).toEqual([]);
    expect(out.vdotLog).toEqual([]);
  });
});

describe('red predikcije', () => {
  it('test van plana pada na najbližu ivicu (prva/poslednja nedelja)', () => {
    const list = [
      { id: 't3k-1', date: '2025-12-01', sec: 720 },
      { id: 't3k-2', date: '2027-01-01', sec: 700 },
      { id: 't3k-3', date: '2026-02-03', sec: 710 }
    ];
    const rows = t3kRows(list, (d) => (d === '2026-02-03' ? 5 : null), '2026-01-05', 18);
    expect(rows.map((r) => r.w)).toEqual([1, 5, 18]);
    expect(rows[0]?.l).toBe('Test 3 km · 01.12.');
    expect(rows[1]?.pt).toBe(Math.round(710 / 3));
  });
  it('t3kSeries preskače zapise sa nemogućim vremenom i nevažećim datumom', () => {
    expect(
      t3kSeries([
        { id: 't3k-1', date: '2026-02-31', sec: 700 },
        { id: 't3k-2', date: '2026-02-01', sec: 100 },
        { id: 't3k-3', date: '2026-02-01', sec: 700 }
      ]).map((t) => t.id)
    ).toEqual(['t3k-3']);
  });
});

describe('predikcija: dva broja na istom ekranu govore isto', () => {
  const row = { id: 'g3_0', w: 3, l: 'N3 · Intervali', q: 1, pt: 250, p5k: 1200 };
  it('vreme ide iz izglačanog lanca, ne iz sirovog tempa', () => {
    const base = { pred: [row], paces: { g3_0: 250 }, tests: [], raceDistM: 5000 };
    const chained = predictionSummary({
      ...base,
      chain: [{ id: 'g3_0', ts: '2026-01-20', vdot: 40, prev: 40, delta: 0, measured: 55 }]
    });
    const raw = predictionSummary({ ...base, chain: [] });
    expect(chained.rows[0]?.pred).not.toBe(raw.rows[0]?.pred);
    // forma 40 sporija je od sirovog merenja → duže vreme
    expect(chained.rows[0]?.pred as number).toBeGreaterThan(raw.rows[0]?.pred as number);
  });
  it('red koji ne meri formu nikad nema predikciju', () => {
    const s = predictionSummary({
      pred: [{ ...row, nemeri: true }],
      paces: { g3_0: 250 },
      chain: [],
      tests: [],
      raceDistM: 5000
    });
    expect(s.rows[0]?.pred).toBeNull();
    expect(s.entered).toEqual([]);
    expect(s.best).toBeNull();
  });
  it('„zadnja" je hronološki najnovija, ne poslednja po nedelji', () => {
    const rows = [
      { ...row, id: 'a', w: 2 },
      { ...row, id: 'b', w: 9 }
    ];
    const s = predictionSummary({
      pred: rows,
      paces: { a: 250, b: 250 },
      chain: [
        { id: 'a', ts: '2026-03-01', vdot: 45, prev: 44, delta: 1, measured: 46 },
        { id: 'b', ts: '2026-02-01', vdot: 44, prev: 43, delta: 1, measured: 45 }
      ],
      tests: [],
      raceDistM: 5000
    });
    expect(s.last?.r.id).toBe('a');
    expect(s.lastRow?.r.id).toBe('a');
  });
});
