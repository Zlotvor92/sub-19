import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { canonical } from '@/test/fingerprint';
import { addDays, parseIsoDate, type IsoDate } from '../../date';
import type { PlanGenerationInput } from '../types';
import { generatePlan } from './generatePlan';

/* parity: test/generator.test.mjs :: generatePlan — osnovna ispravnost / trenerske invarijante
   DIFERENCIJALNI TEST: slučajni (seeded, ponovljivi) ulazi koje otisak NE pokriva — `goalSec`,
   `lrDow`, `qDows`, `runDows`, `quality:1`, početak usred nedelje, dan trke u bilo kom danu
   (otisak ima trku uvek u ponedeljak!), razni PB. Stari i novi generator moraju dati
   IDENTIČAN kanonski plan (ili identičnu grešku). */

/** mulberry32 — mali deterministički PRNG. */
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

const DISTANCES = [5000, 10000, 21097.5, 42195] as const;
const MIN_WEEKS: Record<number, number> = { 5000: 6, 10000: 8, 21097.5: 10, 42195: 12 };
/** Okvirna „realna" vremena (s) po distanci za nasumične PB-ove. */
const PB_RANGE: Record<number, [number, number]> = {
  5000: [1000, 2100],
  10000: [2200, 4300],
  21097.5: [4800, 9600],
  42195: [10000, 21000]
};
const INTENSITIES = ['kons', 'std', 'agr'] as const;

function randomInput(r: () => number): Record<string, unknown> {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
  const between = (lo: number, hi: number): number => lo + r() * (hi - lo);
  const int = (lo: number, hi: number): number => Math.floor(between(lo, hi + 1));

  const raceDistM = pick(DISTANCES);
  const startDate = addDays(parseIsoDate('2026-01-05') as IsoDate, int(0, 600));
  /* nedelja unapred: malo ispod minimuma (greška) do 70 (iznad 2 godine ne ulazi) */
  const weeksAhead = int((MIN_WEEKS[raceDistM] ?? 6) - 2, 70);
  const raceDate = addDays(startDate, weeksAhead * 7 + int(0, 6));
  const [lo, hi] = PB_RANGE[raceDistM] as [number, number];
  const pbSec = Math.round(between(lo, hi));
  const inp: Record<string, unknown> = {
    startDate,
    raceDate,
    raceDistM,
    pb: { distM: raceDistM, sec: pbSec },
    weeklyKm: r() < 0.3 ? Math.round(between(6, 110) * 10) / 10 : int(8, 100),
    runDays: int(2, 7),
    quality: int(1, 2),
    intensity: pick(INTENSITIES),
    trainedRecently: r() < 0.5
  };
  if (r() < 0.4) {
    /* cilj: od 12% bržeg do 8% sporijeg od PB-a, u sekundama */
    inp['goalSec'] = Math.round(pbSec * between(0.88, 1.08));
  }
  if (r() < 0.4) inp['lrDow'] = int(1, 7);
  if (r() < 0.35) {
    const days = [1, 2, 3, 4, 5, 6, 7].filter(() => r() < 0.4);
    inp['qDows'] = days.slice(0, 2);
  }
  if (r() < 0.35) {
    const days = [1, 2, 3, 4, 5, 6, 7].filter(() => r() < 0.6);
    inp['runDows'] = days;
  }
  return inp;
}

function run(fn: () => unknown): unknown {
  try {
    const p = fn() as {
      error?: string;
      weeks?: unknown;
      pred?: unknown;
      qs?: unknown;
      meta?: unknown;
    };
    if (p.error) return { greska: p.error };
    return canonical(
      JSON.parse(JSON.stringify({ weeks: p.weeks, pred: p.pred, qs: p.qs, meta: p.meta }))
    );
  } catch (e) {
    return { greska: 'IZUZETAK: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** Prva putanja na kojoj se dva kanonska objekta razlikuju (za čitljivu poruku). */
function firstDiff(a: unknown, b: unknown, path = ''): string | null {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return `${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const d = firstDiff(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
      `${path}/${k}`
    );
    if (d) return d;
  }
  return `${path}: oblik se razlikuje`;
}

let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp();
});

describe('generatePlan: novi naspram starog na slučajnim ulazima', () => {
  it('1 500 slučajnih ulaza daje identične planove (ili identične greške)', () => {
    const r = rng(20261001);
    let errors = 0;
    let withGoal = 0;
    const problems: string[] = [];
    for (let i = 0; i < 1500; i++) {
      const inp = randomInput(r);
      const oldPlan = run(() => legacy.call('generatePlan', JSON.parse(JSON.stringify(inp))));
      const newPlan = run(() => generatePlan(inp as unknown as PlanGenerationInput));
      if ((oldPlan as { greska?: string }).greska) errors++;
      if (inp['goalSec'] != null) withGoal++;
      const d = firstDiff(oldPlan, newPlan);
      if (d) problems.push(`#${i} ${JSON.stringify(inp)}\n    ${d}`);
      if (problems.length >= 5) break;
    }
    expect(problems, problems.join('\n')).toEqual([]);
    /* test ne sme da bude prazan hod: dovoljno i grešaka (prekratak plan) i planova sa ciljem */
    expect(errors).toBeGreaterThan(5);
    expect(withGoal).toBeGreaterThan(400);
  });
});
