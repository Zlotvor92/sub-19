import { describe, expect, it } from 'vitest';
import * as select from '../../../select';
import type { IsoDate } from '../../../../date';
import type { GenPlanState } from '../../../../state';
import { adaptHmV2 } from '../adapt.ts';
import { factsOf } from '../adaptInputs.ts';
import { generateHmV2 } from '../generate.ts';
import { longestLong10 } from '../lengths.ts';
import { longWarnKmOf, shorterOffer } from '../shorter.ts';
import { grid02Inputs } from '../testInputs.ts';
import type { HmV2Plan } from '../types.ts';
import { generatedPlan, storedPlan } from './plan.ts';
import { contractInput } from './preparation.ts';

/* FAZA 3, SEGMENT 3c — HM v2 kao IZVOR predaje „kraća distanca" (DESIGN.md § 3 P1–P5, § 8).
   - Okidač (O1): adaptirani plan ispod praga upozorenja najdužeg dugog, plan generatora za isti ulaz nije.
   - Opcije (O2a): 10K, pa 5K (prva koju cilj pokriva), „zadrži plan v2"; nedostupne sa razlogom (O4a/O5a).
   - Tok HM v2 → 10K v1 i 5K v1 kroz čistač: objekat v2 i meta v2 ne prelaze u plan cilja.
   - T1 (obrazac Predaja-1): politika IZVORA (HM v2) ne menja plan cilja; T2 kontrola: politika CILJA ga menja. */

const ofId = (id: string) => grid02Inputs().find((c) => c.id === id)!.input;
/** Primer iz merenja M1: 10 nedelja, 3 dana, 35 km; pauza 35 d pre starta spusti najduži dugi 17,8 → 13,7 km. */
const BASE = ofId('d3-10w-35km-v30-A-sat');
const AS_OF = '2026-10-31' as IsoDate;

function adapted(input: unknown, scenario: Parameters<typeof factsOf>[1], asOf: string): HmV2Plan {
  const g = generateHmV2(input);
  if (!g.ok) throw new Error('generator odbio ulaz');
  const r = adaptHmV2(g.plan, factsOf(g.plan, scenario, asOf), asOf);
  if (!r.ok) throw new Error('adaptacija odbijena');
  return r.plan;
}
const stored = (v2: HmV2Plan): GenPlanState =>
  select.stampForStorage(storedPlan(generatedPlan(v2)) as unknown as GenPlanState);

describe('3c: okidač (O1) — jedna funkcija, prelaz', () => {
  it('pauza 35 d: adaptirani plan < 16 km, plan generatora ≥ 16 km → ponuda', () => {
    const v2 = adapted(BASE, 'pause35', AS_OF);
    expect(longWarnKmOf(v2)).toBe(16);
    expect(longestLong10(v2.weeks)).toBeLessThan(160);
    expect(shorterOffer(v2, AS_OF)).toBe(true);
    expect(shorterOffer(v2, v2.input.raceDate)).toBe(false); // trka nije posle asOf
    // Validator prijavljuje isto (LONG_RUN_SHORT) — ista funkcija lengths.longRunShort.
    expect(v2.warnings.some((w) => w.rule === 'LONG_RUN_SHORT')).toBe(true);
  });

  it('plan bez adaptacije ili bez pada ispod praga → nema ponude', () => {
    const g = generateHmV2(BASE);
    expect(g.ok && shorterOffer(g.plan, AS_OF)).toBe(false);
    expect(shorterOffer(adapted(BASE, 'done100', '2026-11-08'), '2026-11-08')).toBe(false);
  });

  it('plan već iz generatora ispod praga (stanje čarobnjaka) → nikad ponuda, ni posle adaptacije', () => {
    const born = grid02Inputs().find((c) => {
      const g = generateHmV2(c.input);
      return g.ok && longestLong10(g.plan.weeks) < 160;
    })!;
    const v2 = adapted(born.input, 'pause35', AS_OF);
    expect(longestLong10(v2.weeks)).toBeLessThan(160);
    expect(shorterOffer(v2, AS_OF)).toBe(false);
  });
});

describe('3c: odluka o pripremi HM v2 i tok do v1 cilja', () => {
  const source = stored(adapted(BASE, 'pause35', AS_OF));
  const today = AS_OF;

  it('preparationForPlan → HM v2 izvor; ograničena priprema iz plana (meta sama nije dovoljna)', () => {
    const prep = select.preparationForPlan(source)!;
    expect(prep).not.toBeNull();
    expect(prep.isLimitedLongPreparation(source.meta, source)).toBe(true);
    expect(prep.isLimitedLongPreparation(source.meta)).toBe(false);
    const basis = prep.basisFromPlan(source, today)!;
    expect(basis.policy).toBeNull();
    expect(basis.execution).toBeNull();
    expect('guardBaseKm' in basis).toBe(false);
  });

  it('prekidač cilja v2 uključen → 10K iz 10K v2 (3d-10K), prva koju cilj pokriva; nikad v1', () => {
    const prep = select.preparationForPlan(source)!;
    const d = prep.preparationDecision(
      source,
      today,
      prep.basisFromPlan(source, today)!,
      {},
      'limited',
      undefined
    );
    // 3d: 5K v2 i 10K v2 su ciljevi predaje (`<distanca>/v2/app/handoffTarget.node.test.ts`); nema NOT_READY.
    expect(d.unavailable).toEqual([]);
    expect(d.options.map((o) => o.id)).toEqual(['shorter-10000']);
    // Vrh opcije iz plana 10K v2 cilja (strukturno, `tenKV2`; nalaz 3g), > 0.
    const c = prep.buildPreparationChoice(
      source,
      today,
      prep.basisFromPlan(source, today)!,
      { kind: 'shorter', raceDistM: 10000 },
      {}
    );
    if ('error' in c) throw new Error(c.error);
    const pk = v2Peaks(c.result, 'tenKV2');
    expect(pk.longKm).toBeGreaterThan(0);
    expect([d.options[0]!.peakLongRunKm, d.options[0]!.peakWeeklyKm]).toEqual([
      pk.longKm,
      pk.weeklyKm
    ]);
  });
});

/** Vrh plana v2 cilja (bez prefiksa izvora): najduži dugi i `peakKm` objekta plana v2. */
function v2Peaks(result: object, key: string): { longKm: number; weeklyKm: number } {
  const p = (
    result as Record<
      string,
      { peakKm: number; weeks: { days: { role: string; workout: { km: number } }[] }[] }
    >
  )[key]!;
  const longs = p.weeks.flatMap((w) =>
    w.days.filter((d) => d.role === 'long').map((d) => d.workout.km)
  );
  return { longKm: Math.max(...longs), weeklyKm: p.peakKm };
}


/* 3d-dopuna (odluka organizatora): lak tempo iz čarobnjaka je činjenica korisnika → izvor ga šalje kad ga ulaz ima.
   v1 ciljevi ga ne čitaju (plan cilja bajt-isti sa i bez polja); 5K v2 cilj ga koristi za plan po osećaju. */
describe('3d-dopuna: lak tempo izvora (činjenica čarobnjaka)', () => {
  const EASY = { ...BASE, easyPaceSecPerKm: 330 };
  it('contractInput: polje prisutno kad ga ulaz ima, odsutno kad ga nema', () => {
    const withEasy = generateHmV2(EASY);
    const without = generateHmV2(BASE);
    if (!withEasy.ok || !without.ok) throw new Error('generator');
    expect(contractInput(withEasy.plan).easyPaceSecPerKm).toBe(330);
    expect('easyPaceSecPerKm' in contractInput(without.plan)).toBe(false);
  });
});

