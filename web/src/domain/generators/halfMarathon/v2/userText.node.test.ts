import { describe, expect, it } from 'vitest';
import { adaptHmV2 } from './adapt.ts';
import { SCENARIOS, adaptBases, factsOf } from './adaptInputs.ts';
import { generatedPlan } from './app/plan.ts';
import { addDays } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import { beginnerInputs, feelInputs, grid02Inputs } from './testInputs.ts';
import type { HmV2Plan } from './types.ts';
import { userText } from './userText.ts';
import { FULL } from '../../../../test/level';

/* HM-09 Z2 — tekst za korisnika (napomene nedelja, napomene i upozorenja plana, razlozi adaptacije) bez internih oznaka
   (H7, A5, pouka N, Uslov N, HI14 …), sa decimalnim zarezom, km na najviše 1 decimalu i bez „..". Tekst se gradi u
   jednom mestu (userText.ts); ovde se proverava ono što aplikacija prikazuje (app/plan.ts fokus i dayWarnings). */

const LABEL = /\b(?:pouk[aeiu]|uslov|segment)\s+\d|\b(?:HI|H|A|M|N|K|D|F|Z)\d+[a-z]?\b/i;
const problems = (s: string): string[] => [
  ...(LABEL.test(s) ? ['oznaka'] : []),
  ...(/\d\.\d/.test(s) ? ['tačka'] : []),
  ...(/\d[.,]\d{2,}\s*km\b/.test(s) ? ['km decimale'] : []),
  ...(/(?<!\.)\.\.(?!\.)/.test(s) ? ['..'] : [])
];

describe('HM-09 Z2: userText', () => {
  it('primeri: oznake otpadaju, ostali delovi zagrade ostaju, decimale', () => {
    expect(
      userText(
        'Taper: RP ≈ 60 % poslednje doze (jedan kvalitetni dan, HI6), dugi ≤ 0,6 × najduži (H7).'
      )
    ).toBe('Taper: RP ≈ 60 % poslednje doze (jedan kvalitetni dan), dugi ≤ 0,6 × najduži.');
    expect(userText('Plafon 10 % (H11 ispred H5, odstupanje); dugi skraćen (HI14).')).toBe(
      'Plafon 10 % (odstupanje); dugi skraćen.'
    );
    expect(userText('Dugi (rasterećenje, najmanji obim; 0,8 × poslednji = 5,9 km; HI14).')).toBe(
      'Dugi (rasterećenje, najmanji obim; 0,8 × poslednji = 5,9 km).'
    );
    expect(userText('unesi ga (dugi ≤ max(1,1 × najduži, najduži + 1 km), pouka 28).')).toBe(
      'unesi ga (dugi ≤ max(1,1 × najduži, najduži + 1 km)).'
    );
    expect(userText('Planirano 30.04 km ≠ cilj 33.7 km (pouka 37, pouka 14)..')).toBe(
      'Planirano 30,0 km ≠ cilj 33,7 km.'
    );
    expect(userText('Uvod (H17): bez kvaliteta.')).toBe('Uvod: bez kvaliteta.');
  });

  it('mreža: tekst koji aplikacija prikazuje nema internih oznaka ni decimalne tačke', () => {
    const bad: string[] = [];
    let n = 0;
    const check = (s: string, where: string): void => {
      n++;
      const p = problems(s);
      if (p.length && bad.length < 10) bad.push(`${where}: ${p.join(', ')} — ${s.slice(0, 160)}`);
    };
    const visible = (p: HmV2Plan, tag: string): void => {
      const g = generatedPlan(p);
      for (const w of g.weeks) check(w.focus, `${tag} ned ${w.w}`);
      for (const t of g.meta.dayWarnings ?? []) check(t, `${tag} plan`);
    };
    const k = FULL ? 7 : 53;
    const bases = [...grid02Inputs(), ...feelInputs(), ...beginnerInputs()].filter(
      (_, i) => i % k === 0
    );
    for (const b of bases) {
      const g = generateHmV2(b.input);
      if (g.ok) visible(g.plan, b.id);
    }
    for (const b of adaptBases().filter((_, i) => FULL || i % 4 === 0)) {
      const g = generateHmV2(b.input);
      if (!g.ok) continue;
      for (const at of [g.plan.weeks[1]!.endDate, addDays(g.plan.weeks[5]!.startDate, 2)])
        for (const s of SCENARIOS) {
          const a = adaptHmV2(g.plan, factsOf(g.plan, s, at), at);
          if (!a.ok) continue;
          visible(a.plan, `${b.id} ${s} ${at}`);
          for (const r of a.reasons) check(userText(r.message), `${b.id} ${s} razlog`);
        }
    }
    expect(n).toBeGreaterThan(1000);
    expect(bad).toEqual([]);
  });
});
