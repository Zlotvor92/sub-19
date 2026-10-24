/* F1 (04-final): tekst korisnika (napomene plana i nedelja, upozorenja, ocena cilja, razlozi adaptacije i odbijanja)
   bez internih oznaka pravila, sa decimalnim zarezom, bez „X < X" i „Vrh X umesto do X". */
import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from './adapt.ts';
import { generateTenKV2 } from './generate.ts';
import {
  adaptBases,
  AS_OF_KINDS,
  asOfOf,
  beginnerGridInputs,
  factsOf,
  feelGridInputs,
  gridInputs,
  SCENARIOS
} from './testInputs.ts';
import type { AdaptResult, TenKV2Plan } from './types.ts';

const CODE =
  /\((?:[ADLMTZ]\d|[^)]*, [ADLMTZ]\d)|\b[DA]\d+\)|[Pp]ouka \d|segment 0|T_cruise|T_continuous|plafon|ne-rasteretn|konstrukcij|po pravilu|odstupanje|Uslov 8|\d\.\d/;

function texts(r: { ok: boolean; plan?: TenKV2Plan; reasons?: { message: string }[] }): string[] {
  const out = (r.reasons ?? []).map((x) => x.message);
  if (r.ok && r.plan) {
    out.push(...r.plan.notes, ...r.plan.warnings.map((w) => w.message));
    if (r.plan.goal) out.push(r.plan.goal.message);
    for (const w of r.plan.weeks) out.push(...w.notes);
  }
  return out;
}

function problems(id: string, ts: readonly string[]): string[] {
  const bad: string[] = [];
  for (const t of ts) {
    if (CODE.test(t)) bad.push(`${id}: oznaka — ${t}`);
    // „Planirano X < cilj X", „Vrh X umesto do X" posle zaokruživanja.
    for (const m of t.matchAll(
      /(-?[\d,]+) (?:km )?(?:<|umesto do) (?:cilj (?:obima )?)?(-?[\d,]+)/g
    ))
      if (m[1] === m[2]) bad.push(`${id}: isto — ${t}`);
  }
  return bad;
}

describe('F1: tekst korisnika', () => {
  it('generator: uzorak mreže (rezultat, po osećaju, početnik) bez oznaka, decimalni zarez, bez „X < X"', () => {
    const every = <X>(xs: readonly X[], n: number): X[] => xs.filter((_, i) => i % n === 0);
    const cases = [
      ...every(gridInputs(), 40),
      ...every(feelGridInputs(3), 60),
      ...every(feelGridInputs(6), 60),
      ...every(beginnerGridInputs(3), 30)
    ];
    const bad = cases.flatMap((c) => problems(c.id, texts(generateTenKV2(c.input))));
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('adaptacija: bazni planovi × scenariji bez oznaka', () => {
    const bad: string[] = [];
    for (const b of adaptBases().filter((_, i) => i % 3 === 0)) {
      const r0 = generateTenKV2(b.input);
      if (!r0.ok) throw new Error(b.id);
      for (const k of AS_OF_KINDS)
        for (const s of SCENARIOS) {
          const asOf = asOfOf(r0.plan, k);
          const r: AdaptResult = adaptTenKV2(r0.plan, factsOf(r0.plan, s, asOf), asOf);
          bad.push(...problems(`${b.id}/${k}/${s}`, texts(r)));
        }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('ocena cilja sa decimalnim zarezom', () => {
    const c = gridInputs().find((x) => (x.input as { goalTimeSec?: unknown }).goalTimeSec);
    if (!c) return;
    const r = generateTenKV2(c.input);
    if (r.ok && r.plan.goal) expect(r.plan.goal.message).toMatch(/traži -?\d+,\d VDOT/);
  });
});
