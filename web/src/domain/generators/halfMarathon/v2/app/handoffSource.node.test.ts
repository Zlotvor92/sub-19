import { describe, expect, it } from 'vitest';
import { RETURN_POLICY as TEN_K_RETURN_POLICY } from '../../../tenK/plan/regenerate';
import { V1_TARGET_NEEDS_RESULT } from '../../../handoff';
import * as select from '../../../select';
import type { IsoDate } from '../../../../date';
import type { GenPlanState } from '../../../../state';
import { adaptHmV2 } from '../adapt.ts';
import { factsOf } from '../adaptInputs.ts';
import { generateHmV2 } from '../generate.ts';
import { longestLong10 } from '../lengths.ts';
import { HM_V2_POLICY } from '../policy.ts';
import { longWarnKmOf, shorterOffer } from '../shorter.ts';
import { feelInputs, grid02Inputs } from '../testInputs.ts';
import type { HmV2Plan } from '../types.ts';
import { generatedPlan, storedPlan } from './plan.ts';
import { contractInput, HM_V2_SOURCE_FORMAT } from './preparation.ts';

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

  it('opcija 10K (v1 cilj), „zadrži plan v2" u uslovima; plan cilja bez formata HM v2', () => {
    const prep = select.preparationForPlan(source)!;
    const basis = prep.basisFromPlan(source, today)!;
    const d = prep.preparationDecision(source, today, basis, {}, 'limited', undefined);
    expect(d.options.map((o) => o.id)).toEqual(['shorter-10000']);
    expect(d.conditions[0]).toMatch(/^Zadrži plan v2/);
    for (const dist of [10000, 5000] as const) {
      const c = prep.buildPreparationChoice(
        source,
        today,
        basis,
        { kind: 'shorter', raceDistM: dist },
        {}
      );
      if ('error' in c) throw new Error(c.error);
      expect(c.change.to).toEqual({
        raceDate: basis.input.raceDate,
        raceDistM: dist,
        goalSec: null
      });
      expect('hmV2' in c.result).toBe(false);
      const meta = c.result.meta as Record<string, unknown>;
      for (const k of HM_V2_SOURCE_FORMAT.metaKeys) {
        const own = JSON.stringify(meta[k]);
        if (own !== undefined)
          expect(own, k).not.toBe(JSON.stringify((source.meta as Record<string, unknown>)[k]));
      }
      expect(select.generatorForPlan(select.stampForStorage(c.result))?.id).toBe(
        dist === 10000 ? '10k' : '5k'
      );
    }
    const base = prep.buildPreparationChoice(source, today, basis, { kind: 'base' }, {});
    expect('error' in base && base.error).toMatch(/samo kraću distancu/);
  });

  it('prekidač cilja v2 uključen → 10K nedostupan sa razlogom (O4a), 5K iz 5K v2 (3d); nikad v1', () => {
    const prep = select.preparationForPlan(source, { fiveKV2: true, tenKV2: true })!;
    const d = prep.preparationDecision(
      source,
      today,
      prep.basisFromPlan(source, today)!,
      {},
      'limited',
      undefined
    );
    // 3d: 5K v2 je cilj predaje (`fiveK/v2/app/handoffTarget.node.test.ts`); 10K v2 i dalje nedostupan sa razlogom.
    expect(d.unavailable).toEqual([`10K: ${select.V2_TARGET_NOT_READY}`]);
    expect(d.options.map((o) => o.id)).toEqual(['shorter-5000']);
  });

  it('plan po osećaju → v1 cilj nedostupan (O5a)', () => {
    const feel = feelInputs().find((c) => {
      const v = (() => {
        try {
          return adapted(c.input, 'pause35', AS_OF);
        } catch {
          return null;
        }
      })();
      return v !== null && shorterOffer(v, AS_OF);
    })!;
    const src = stored(adapted(feel.input, 'pause35', AS_OF));
    const prep = select.preparationForPlan(src)!;
    const d = prep.preparationDecision(
      src,
      today,
      prep.basisFromPlan(src, today)!,
      {},
      'limited',
      undefined
    );
    expect(d.options).toEqual([]);
    expect(d.unavailable).toEqual([
      `10K: ${V1_TARGET_NEEDS_RESULT}`,
      `5K: ${V1_TARGET_NEEDS_RESULT}`
    ]);
  });
});

/* T1/T2: ceo tok izvor → predaja → cilj, bez i sa potvrđenom pauzom (`executionBasis`). Poredi se budući deo plana
   cilja (dani posle danas) i ocena pripreme; prošli dani su istorija izvora (graft ih čuva). */
type Plan = { weeks: { start: string; days: { dow: number; id?: string }[] }[]; meta?: unknown };
function future(p: Plan, today: string): string {
  const out: unknown[] = [];
  for (const w of p.weeks)
    for (const d of w.days) {
      const date = new Date(Date.parse(w.start + 'T00:00:00Z') + d.dow * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (date > today) out.push([date, d]);
    }
  return JSON.stringify([out, (p.meta as { preparation?: unknown }).preparation]);
}
function targetFlow(withPause: boolean, input: unknown = BASE): { source: string; target: string } {
  const src = stored(adapted(input, 'pause35', AS_OF));
  const today = AS_OF;
  const prep = select.preparationForPlan(src)!;
  const basis = withPause
    ? select.HALF_MARATHON_V2_GENERATOR.executionBasis(src, today, null as never, {
        breakDays: 35,
        weeklyKm: 20
      })
    : prep.basisFromPlan(src, today)!;
  if ('error' in basis) throw new Error(basis.error);
  const c = prep.buildPreparationChoice(
    src,
    today,
    basis,
    { kind: 'shorter', raceDistM: 10000 },
    {}
  );
  if ('error' in c) throw new Error(c.error);
  return {
    source: future(src, today),
    target: future(c.result, today)
  };
}
function withSourcePolicy<T>(run: () => T): T {
  const a = HM_V2_POLICY.adapt as { returnGrowth: number; pause: { longShare: number } };
  const saved = { returnGrowth: a.returnGrowth, longShare: a.pause.longShare };
  try {
    a.returnGrowth = 0.05;
    a.pause.longShare = 0.3;
    return run();
  } finally {
    a.returnGrowth = saved.returnGrowth;
    a.pause.longShare = saved.longShare;
  }
}
function withTargetPolicy<T>(run: () => T): T {
  const t = TEN_K_RETURN_POLICY as unknown as Record<
    string,
    { fraction: number; easyWeeks: number }
  >;
  const saved = JSON.stringify(t);
  try {
    for (const p of Object.values(t)) {
      p.fraction = Math.round(p.fraction * 50) / 100;
      p.easyWeeks += 3;
    }
    return run();
  } finally {
    for (const [k, v] of Object.entries(JSON.parse(saved) as typeof t)) Object.assign(t[k]!, v);
  }
}

describe('3c: T1/T2 — politika izvora ne menja cilj; politika cilja ga menja', () => {
  // Trka u subotu (nedelje izvora od nedelje) i u nedelju (od ponedeljka) — dopuna 3b.
  for (const [race, input] of [
    ['subota', BASE],
    ['nedelja', ofId('d3-10w-35km-v30-A-sun')]
  ] as const)
    for (const withPause of [false, true])
      it(`HM v2 (trka ${race}) → 10K v1 (${withPause ? 'potvrđena pauza' : 'bez izvršenja'})`, () => {
        const base = targetFlow(withPause, input);
        const t1 = withSourcePolicy(() => targetFlow(withPause, input));
        expect(t1.source, 'kontrola: politika izvora menja plan izvora').not.toBe(base.source);
        expect(t1.target, 'T1: plan cilja isti').toBe(base.target);
        if (withPause) {
          const t2 = withTargetPolicy(() => targetFlow(withPause, input));
          expect(t2.target, 'T2: politika cilja menja plan cilja').not.toBe(base.target);
        }
      });
});

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

  it('v1 cilj (10K, 5K) bajt-isti sa i bez polja; 5K v2 cilj ga koristi (po osećaju)', () => {
    const src = stored(adapted(EASY, 'pause35', AS_OF));
    const prep = select.preparationForPlan(src)!;
    const basis = prep.basisFromPlan(src, AS_OF)!;
    expect(basis.input).toHaveProperty('easyPaceSecPerKm', 330);
    const { easyPaceSecPerKm: _e, ...bare } = basis.input as typeof basis.input & {
      easyPaceSecPerKm?: number;
    };
    for (const dist of [10000, 5000] as const) {
      const a = prep.buildPreparationChoice(
        src,
        AS_OF,
        basis,
        { kind: 'shorter', raceDistM: dist },
        {}
      );
      const b = prep.buildPreparationChoice(
        src,
        AS_OF,
        { ...basis, input: bare },
        { kind: 'shorter', raceDistM: dist },
        {}
      );
      expect('error' in a, String(dist)).toBe(false);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
    // 5K v2 cilj: izvor po osećaju (rezultat izostavljen) — sa lakim tempom plan postoji, bez njega MISSING_EASY_PACE.
    const feel = feelInputs().find((c) => {
      try {
        return shorterOffer(adapted(c.input, 'pause35', AS_OF), AS_OF);
      } catch {
        return false;
      }
    })!;
    const fsrc = stored(adapted(feel.input, 'pause35', AS_OF));
    const v2prep = select.preparationForPlan(fsrc, { fiveKV2: true })!;
    const fb = v2prep.basisFromPlan(fsrc, AS_OF)!;
    const c = v2prep.buildPreparationChoice(
      fsrc,
      AS_OF,
      fb,
      { kind: 'shorter', raceDistM: 5000 },
      {}
    );
    expect('error' in c ? c.error : 'ok').toBe('ok');
  });
});
