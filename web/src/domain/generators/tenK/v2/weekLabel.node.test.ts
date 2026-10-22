/* FAZA 3, SEGMENT 3i (REVIEW-3 #2 dopuna): broj nedelje u PORUKAMA jezgra na planu sa nedeljama ispred
   (`input.weekOffset`). Isti ulaz i iste činjenice sa offsetom 100 i bez njega: svaki string plana i rezultata (napomene
   nedelja i plana, upozorenja, razlozi adaptacije, traka, odbijanja) posle vraćanja broja nedelje (n − 100) je isti kao
   bez offseta, a svaki broj nedelje u tekstu je ≥ 101 — jedna poruka mimo `weekLabel` obara test. Brojevi i indeksi
   (polja `index`, `week`, koraci) su isti (v2). Izuzeci (nisu broj nedelje kalendara, A22): redni broj uvoda
   „nedelja k od N" i „u nedeljama 1–2" (položaj u segmentu, D5). */

import { describe, expect, it } from 'vitest';
import { sample } from '@/test/level';
import { adaptBanner, adaptTenKV2 } from './adapt.ts';
import { generateTenKV2 } from './generate.ts';
import { adaptBases, factsOf, SCENARIOS } from './testInputs.ts';
import type { TenKV2Plan } from './types.ts';

const OFF = 100;
/** Broj nedelje u tekstu (uz opseg „a–b" i premeštaj „a → b"); km, broj kvaliteta („prva nedelja 1 kvalitet") i redni
 *  broj uvoda nisu broj nedelje. */
const WEEK =
  /(nedelj[a-z]*|Nedelj[a-z]*|ned\.?)\s+(\d+)(?![\d,.]*\s*km)(?!\s+od\s)(?!\s+kvalitet)(?:(\s*[–→]\s*)(\d+))?/g;
const HAS = new RegExp(WEEK.source);
const EXEMPT = /u nedeljama 1–2/g;

/** Tekst sa offsetom → tekst bez offseta (n − OFF); `low` skuplja brojeve nedelje < OFF + 1 (poruka mimo weekLabel). */
function unshift(s: string, low: string[]): string {
  const sub = (n: string): string => {
    const k = Number(n);
    if (k <= OFF) low.push(s);
    return String(k - OFF);
  };
  return s
    .split(EXEMPT)
    .map((part) =>
      part.replace(WEEK, (_m, w: string, a: string, sep?: string, b?: string) =>
        b === undefined ? `${w} ${sub(a)}` : `${w} ${sub(a)}${sep}${sub(b)}`
      )
    )
    .join('u nedeljama 1–2');
}

function mapStrings(x: unknown, f: (s: string) => string): unknown {
  if (typeof x === 'string') return f(x);
  if (Array.isArray(x)) return x.map((v) => mapStrings(v, f));
  if (x && typeof x === 'object')
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, mapStrings(v, f)]));
  return x;
}

/** Rezultat sa offsetom, vraćen na v2 (bez polja weekOffset u ulazu, brojevi nedelje u tekstu − OFF). */
function back(x: unknown, low: string[]): unknown {
  const y = mapStrings(x, (s) => unshift(s, low)) as Record<string, unknown>;
  const strip = (p: unknown): void => {
    const input = (p as { input?: Record<string, unknown> } | null)?.input;
    if (input) delete input['weekOffset'];
  };
  strip(y);
  strip(y['plan']);
  return y;
}

describe('3i: broj nedelje u porukama jezgra 10K v2 = weekOffset + indeks', () => {
  it('ulaz: weekOffset ceo broj ≥ 0; 0 se ne upisuje (isti plan), > 0 u plan.input', () => {
    const input = adaptBases()[0]!.input;
    const g0 = generateTenKV2(input);
    expect(generateTenKV2({ ...input, weekOffset: 0 })).toEqual(g0);
    const g = generateTenKV2({ ...input, weekOffset: 6 });
    expect(g.ok && g.plan.input.weekOffset).toBe(6);
    for (const bad of [-1, 1.5, '3'])
      expect(generateTenKV2({ ...input, weekOffset: bad })).toMatchObject({
        ok: false,
        reasons: [{ code: 'INPUT_SHAPE' }]
      });
  });

  it('generator i adaptacija (17 scenarija): isto kao bez offseta osim broja nedelje u tekstu', () => {
    const low: string[] = [];
    let flows = 0;
    let shifted = 0;
    for (const b of sample(adaptBases(), 3)) {
      const g0 = generateTenKV2(b.input);
      const g = generateTenKV2({ ...b.input, weekOffset: OFF });
      expect(back(g, low), b.id).toEqual(g0);
      if (!g0.ok || !g.ok) continue;
      const p0: TenKV2Plan = g0.plan;
      const p: TenKV2Plan = g.plan;
      for (const at of [p0.weeks[1]!.endDate, p0.weeks[Math.floor(p0.weeks.length / 2)]!.endDate])
        for (const s of SCENARIOS) {
          const f = factsOf(p0, s, at);
          const r0 = adaptTenKV2(p0, f, at);
          const r = adaptTenKV2(p, f, at);
          expect(back(r, low), `${b.id} ${at} ${s}`).toEqual(r0);
          expect(
            adaptBanner(p, r, f as never, at).map((m) => unshift(m, low)),
            `${b.id} ${at} ${s}`
          ).toEqual(adaptBanner(p0, r0, f as never, at));
          if (r.ok && r.reasons.some((x) => HAS.test(x.message))) shifted++;
          flows++;
        }
    }
    expect(low).toEqual([]);
    expect(flows).toBeGreaterThan(100);
    expect(shifted).toBeGreaterThan(0);
  });
});
