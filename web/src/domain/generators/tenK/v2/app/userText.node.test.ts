import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from '../adapt.ts';
import { generateTenKV2 } from '../generate.ts';
import * as T from '../testInputs.ts';
import type { TenKV2Plan } from '../types.ts';
import { FULL } from '../../../../../test/level';
import { userText } from './format.ts';
import { rejection } from './generate.ts';
import { generatedPlan, goalOf } from './plan.ts';

/* 10K-07 Z2: tekst koji vidi korisnik (fokus nedelje, „Na šta da paziš", ocena cilja, razlozi adaptacije i odbijanja)
   je bez internih oznaka (D6, A3/A4, H17, M7, pouka N, segment N), sa decimalnim zarezom, km sa najviše jednom
   decimalom i bez „..". Mreža: grid02 + početnik + po osećaju (uzorak) i adaptacija baznih planova (svi scenariji). */

const INTERNAL = /\b[DAHMF]\d{1,2}[a-z]?\b|\bpouka \d|\bsegment \d/iu;
const BAD = (t: string): string | null =>
  INTERNAL.test(t)
    ? 'oznaka'
    : /\d\.\d/u.test(t.replace(/\d{4}-\d{2}-\d{2}/gu, ''))
      ? 'tačka'
      : /\d,\d{2,}\s*km/u.test(t)
        ? 'km 2 dec'
        : /\.\./u.test(t)
          ? '..'
          : null;

function appTexts(p: TenKV2Plan): string[] {
  const g = generatedPlan(p);
  return [
    ...g.weeks.map((w) => w.focus),
    ...(g.meta as unknown as { dayWarnings: string[] }).dayWarnings,
    goalOf(p)?.message ?? ''
  ];
}

describe('10K-07 Z2: korisnički tekst bez internih oznaka', () => {
  it('userText: oznake, zarez, km jedna decimala, bez ..', () => {
    expect(
      userText('Pouka 35: drugi dan (D11 ispred D7/D31, odstupanje); plan 24.97 km (A3/A4)..')
    ).toBe('Drugi dan (odstupanje); plan 25,0 km.');
    expect(userText('traži 0.3 VDOT (realistično ≤ 1.2)')).toBe(
      'traži 0,3 VDOT (realistično ≤ 1,2)'
    );
    expect(userText('Mešovita nedelja (pouka 37): zaštićeni dani 11,76 km')).toBe(
      'Mešovita nedelja: zaštićeni dani 11,8 km'
    );
  });

  it('mreža: generisani i adaptirani planovi, razlozi i odbijanja', () => {
    const step = FULL ? 3 : 41;
    const cases = [
      ...([3, 4, 5, 6] as const).flatMap((d) => T.grid02Inputs(d)),
      ...([3, 4] as const).flatMap((d) => T.beginnerGridInputs(d)),
      ...([3, 4, 5, 6] as const).flatMap((d) => T.feelGridInputs(d))
    ].filter((_, i) => i % step === 0);
    const bad: string[] = [];
    const check = (id: string, ts: readonly string[]) => {
      for (const t of ts) {
        const why = BAD(t);
        if (why && bad.length < 10) bad.push(`${id} [${why}]: ${t}`);
      }
    };
    let n = 0;
    for (const c of cases) {
      const r = generateTenKV2(c.input);
      if (!r.ok) {
        check(
          c.id,
          rejection(r.reasons).map((x) => x.message)
        );
        continue;
      }
      n++;
      check(c.id, appTexts(r.plan));
    }
    for (const b of T.adaptBases().filter((_, i) => FULL || i % 5 === 0)) {
      const g = generateTenKV2(b.input);
      if (!g.ok) continue;
      for (const kind of T.AS_OF_KINDS) {
        const at = T.asOfOf(g.plan, kind);
        for (const s of T.SCENARIOS) {
          const r = adaptTenKV2(g.plan, T.factsOf(g.plan, s, at), at);
          if (!r.ok) continue;
          n++;
          check(`${b.id}/${kind}/${s}`, [
            ...appTexts(r.plan),
            ...r.reasons.map((x) => userText(x.message))
          ]);
        }
      }
    }
    expect(n).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });
});
