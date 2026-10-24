import { describe, expect, it } from 'vitest';
import { RETURN_POLICY as HM_RETURN_POLICY } from '../../../halfMarathon/plan/regenerate';
import { HM_V2_POLICY } from '../../../halfMarathon/v2/policy.ts';
import { V1_TARGET_NEEDS_RESULT } from '../../../handoff';
import * as select from '../../../select';
import type { IsoDate } from '../../../../date';
import type { GenPlanState } from '../../../../state';
import { adaptMarathonV2 } from '../adapt.ts';
import { generateMarathonV2 } from '../generate.ts';
import { checkInput } from '../input.ts';
import { longShortOf, longTimeCapNote } from '../lengths.ts';
import { MARATHON_V2_POLICY } from '../policy.ts';
import { longShortKmOf, shorterOffer } from '../shorter.ts';
import * as TM from '../testInputs.ts';
import { pacesAt } from '../steps.ts';
import type { MarathonV2Plan, Paces } from '../types.ts';
import { generatedPlan, storedPlan } from './plan.ts';
import { MARATHON_V2_SOURCE_FORMAT, rawFacts } from './preparation.ts';

/* FAZA 3, SEGMENT 3e — maraton v2 kao IZVOR predaje „kraća distanca" (DESIGN.md § 3 P1–P5, § 8; obrazac 3c).
   - Okidač (O1): adaptirani plan ispod praga MARATHON_LONG_SHORT (`longShortOf`, ista funkcija kao validator), plan
     generatora za isti ulaz nije. Okidač iz rezultata (test 5 km → dugi ograničen trajanjem, N11: bez upozorenja) je
     dozvoljen.
   - Opcije (O2a): polumaraton, pa 10K (prva koju cilj pokriva), „zadrži plan v2"; nedostupne sa razlogom
     (O4a/O5a/O8a).
   - Tok maraton v2 → HM v1 / 10K v1 kroz čistač i → HM v2 (prekidač, 3f) kroz PRAVI izvor (ne sintetički).
   - T1 (obrazac Predaja-1): politika IZVORA ne menja plan cilja; T2 kontrola: politika CILJA ga menja. */

const ofId = (id: string) => TM.gridInputs().find((c) => c.id === id)!.input;
/** 13 nedelja, 3 dana, 35 km, VDOT 55: najduži dugi 26,2 km. Pauza 35 d u nedelji 2 → 18,5 km; test 5 km (25:00) →
 *  21,9 km (ograničen trajanjem 150 min). Trka subota 2027-01-30 / nedelja 2027-01-31. */
const BASE = ofId('d3-13w-35km-v55-A-sat');
const BASE_SUN = ofId('d3-13w-35km-v55-A-sun');
const AS_OF = '2026-11-14' as IsoDate;
const AS_OF_SUN = '2026-11-15' as IsoDate;
const HM_ON: select.GeneratorFlags = { fiveKV2: false, hmV2: true };
const DAY = 86_400_000;
const addDays = (d: string, n: number): string =>
  new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);

function adapted(input: unknown, scenario: TM.Scenario, asOf: string): MarathonV2Plan {
  const g = generateMarathonV2(input);
  if (!g.ok) throw new Error('generator odbio ulaz');
  const r = adaptMarathonV2(g.plan, TM.factsOf(g.plan, scenario, asOf), asOf);
  if (!r.ok) throw new Error('adaptacija odbijena');
  return r.plan;
}
const stored = (v2: MarathonV2Plan): GenPlanState =>
  select.stampForStorage(storedPlan(generatedPlan(v2)) as unknown as GenPlanState);
const longest = (p: MarathonV2Plan): number =>
  Math.max(
    0,
    ...p.weeks.flatMap((w) => w.days.filter((d) => d.role === 'long').map((d) => d.workout.km))
  );
const datesOf = (p: GenPlanState) =>
  p.weeks.flatMap((w) => w.days.map((d) => [addDays(w.start, d.dow), d] as const));

/** MAR-09 t. 4: tempo nedelje (isti kao konstruktor i validator, steps.pacesAt). */
const weekPaces =
  (p: MarathonV2Plan) =>
  (w: number): Paces => {
    const c = checkInput(p.input);
    if (!c.ok) throw new Error('ulaz');
    return pacesAt(c.pace, p.adaptation?.steps ?? [], w, p.input.currentWeeklyKm);
  };

describe('3e: okidač (O1) — jedna funkcija, prelaz', () => {
  it('pauza 35 d: adaptirani plan < 26 km, plan generatora ≥ 26 km → ponuda; MARATHON_LONG_SHORT iz iste funkcije', () => {
    const v2 = adapted(BASE, 'pause35', AS_OF);
    expect(longShortKmOf(v2)).toBe(26);
    expect(longest(v2)).toBe(18.5);
    expect(shorterOffer(v2, AS_OF)).toBe(true);
    expect(shorterOffer(v2, v2.input.raceDate)).toBe(false); // trka nije posle asOf
    expect(longShortOf(v2.weeks, 26, weekPaces(v2))?.timeCapped).toBe(false);
    expect(v2.warnings.some((w) => w.rule === 'MARATHON_LONG_SHORT')).toBe(true);
  });

  it('rezultat (test 5 km): dugi ograničen trajanjem (N11: bez upozorenja, rečenica plana) → ponuda iz istog praga', () => {
    const v2 = adapted(BASE, 'test5k', AS_OF);
    const ls = longShortOf(v2.weeks, 26, weekPaces(v2))!;
    expect(ls).toEqual({ longestKm: 21.9, timeCapped: true, capSec: 9000 });
    expect(v2.warnings.some((w) => w.rule === 'MARATHON_LONG_SHORT')).toBe(false);
    expect(v2.notes).toContain(longTimeCapNote(21.9, 26, false));
    expect(shorterOffer(v2, AS_OF)).toBe(true);
  });

  it('plan bez adaptacije ili bez pada ispod praga → nema ponude', () => {
    const g = generateMarathonV2(BASE);
    expect(g.ok && shorterOffer(g.plan, AS_OF)).toBe(false);
    const done = adapted(BASE, 'done100', AS_OF);
    expect(longest(done)).toBeGreaterThanOrEqual(26);
    expect(shorterOffer(done, AS_OF)).toBe(false);
  });

  it('plan već iz generatora ispod praga (stanje čarobnjaka) → nikad ponuda, ni posle adaptacije', () => {
    const born = ofId('d3-12w-30km-v30-A-sat');
    const g = generateMarathonV2(born);
    expect(g.ok && longest(g.plan)).toBeLessThan(26);
    const v2 = adapted(born, 'pause35', AS_OF);
    expect(longest(v2)).toBeLessThan(26);
    expect(shorterOffer(v2, AS_OF)).toBe(false);
  });
});

describe('3e: odluka o pripremi maratona v2 i tok do cilja', () => {
  const source = stored(adapted(BASE, 'pause35', AS_OF));
  const today = AS_OF;
  const decide = (src: GenPlanState, flags?: select.GeneratorFlags, at: IsoDate = today) => {
    const prep = select.preparationForPlan(src, flags)!;
    return prep.preparationDecision(
      src,
      at,
      prep.basisFromPlan(src, at)!,
      {},
      'limited',
      undefined
    );
  };

  it('preparationForPlan → maraton v2 izvor; ograničena priprema iz plana (meta sama nije dovoljna)', () => {
    const prep = select.preparationForPlan(source)!;
    expect(prep).not.toBeNull();
    expect(prep.isLimitedLongPreparation(source.meta, source)).toBe(true);
    expect(prep.isLimitedLongPreparation(source.meta)).toBe(false);
    const basis = prep.basisFromPlan(source, today)!;
    expect(basis.policy).toBeNull();
    expect(basis.execution).toBeNull();
    expect('guardBaseKm' in basis).toBe(false);
    // Ulaz čarobnjaka bez izvedenih polja (obim čarobnjaka, ne obim plana).
    expect(basis.input).toMatchObject({ raceDistM: 42195, weeklyKm: 35, runDays: 3 });
  });

  it('opcija polumaraton (v1 cilj), „zadrži plan v2" u uslovima; plan cilja bez formata maratona v2', () => {
    const prep = select.preparationForPlan(source)!;
    const basis = prep.basisFromPlan(source, today)!;
    const d = decide(source);
    expect(d.options.map((o) => o.id)).toEqual(['shorter-21097.5']);
    expect(d.options[0]!.peakLongRunKm).toBeGreaterThan(0);
    expect(d.conditions[0]).toMatch(/^Zadrži plan v2/);
    expect(d.statement).toMatch(/18,5 km, ispod 26 km/);
    for (const dist of [21097.5, 10000] as const) {
      const c = prep.buildPreparationChoice(
        source,
        today,
        basis,
        { kind: 'shorter', raceDistM: dist },
        {}
      );
      if ('error' in c) throw new Error(c.error);
      expect(c.change).toEqual({
        from: { raceDate: basis.input.raceDate, raceDistM: 42195, goalSec: null },
        to: { raceDate: basis.input.raceDate, raceDistM: dist, goalSec: null }
      });
      expect('marathonV2' in c.result).toBe(false);
      const meta = c.result.meta as Record<string, unknown>;
      for (const k of MARATHON_V2_SOURCE_FORMAT.metaKeys) {
        const own = JSON.stringify(meta[k]);
        if (own !== undefined)
          expect(own, k).not.toBe(JSON.stringify((source.meta as Record<string, unknown>)[k]));
      }
      const res = select.stampForStorage(c.result);
      expect(select.generatorForPlan(res)).toBe(
        dist === 10000 ? select.TEN_K_GENERATOR : select.HALF_MARATHON_GENERATOR
      );
      // Nema duplog datuma ni id-a; prošli dani izvora ostaju sa svojim id-jem.
      const dated = datesOf(res);
      expect(new Set(dated.map(([x]) => x)).size).toBe(dated.length);
      expect(new Set(dated.map(([, x]) => x.id)).size).toBe(dated.length);
      const srcByDate = new Map(datesOf(source));
      for (const [date, x] of dated)
        if (date <= today) expect(x.id, date).toBe(srcByDate.get(date)?.id);
    }
    const base = prep.buildPreparationChoice(source, today, basis, { kind: 'base' }, {});
    expect('error' in base && base.error).toMatch(/samo kraću distancu/);
  });

  it('prekidač HM v2 → HM v2 cilj (3f) iz pravog izvora: prefiks, id = id izvora istog datuma, vrh iz hmV2', () => {
    const prep = select.preparationForPlan(source, HM_ON)!;
    const d = decide(source, HM_ON);
    expect(d.options.map((o) => o.id)).toEqual(['shorter-21097.5']);
    expect(d.options[0]!.peakLongRunKm).toBeGreaterThanOrEqual(16);
    expect(d.options[0]!.peakWeeklyKm).toBeGreaterThan(0);
    const c = prep.buildPreparationChoice(
      source,
      today,
      prep.basisFromPlan(source, today)!,
      { kind: 'shorter', raceDistM: 21097.5 },
      {}
    );
    if ('error' in c) throw new Error(c.error);
    const res = select.stampForStorage(c.result);
    expect(select.isHmV2Plan(res)).toBe(true);
    expect('marathonV2' in res).toBe(false);
    const dated = datesOf(res);
    expect(new Set(dated.map(([x]) => x)).size).toBe(dated.length);
    const srcByDate = new Map(datesOf(source));
    for (const [date, x] of dated) expect(x.id, date).toBe(srcByDate.get(date)?.id);
  });

  it('nedostupne opcije: HM v2 kasno (PLAN_TOO_SHORT) doslovno (O4a); 10K iz 10K v2 (3d-10K)', () => {
    const late = '2026-12-05' as IsoDate;
    const src = stored(adapted(BASE, 'pause35', late));
    const d = decide(src, { fiveKV2: false, hmV2: true, tenKV2: true }, late);
    expect(d.options.map((o) => o.id)).toEqual(['shorter-10000']);
    // Vrh opcije iz plana 10K v2 cilja (strukturno, `tenKV2`; nalaz 3g), > 0.
    const prep = select.preparationForPlan(src, { fiveKV2: false, hmV2: true, tenKV2: true })!;
    const c = prep.buildPreparationChoice(
      src,
      late,
      prep.basisFromPlan(src, late)!,
      { kind: 'shorter', raceDistM: 10000 },
      {}
    );
    if ('error' in c) throw new Error(c.error);
    const t = (
      c.result as unknown as {
        tenKV2: { peakKm: number; weeks: { days: { role: string; workout: { km: number } }[] }[] };
      }
    ).tenKV2;
    const longKm = Math.max(
      ...t.weeks.flatMap((w) => w.days.filter((x) => x.role === 'long').map((x) => x.workout.km))
    );
    expect(longKm).toBeGreaterThan(0);
    expect([d.options[0]!.peakLongRunKm, d.options[0]!.peakWeeklyKm]).toEqual([longKm, t.peakKm]);
    expect(d.unavailable).toEqual([
      'Polumaraton: Plan od 8 nedelja je prekratak: polumaraton traži najmanje 10 nedelja; preporuka: 10K plan.'
    ]);
  });

  it('O8a: HM cilj > 20 nedelja do trke → nedostupno sa PLAN_TOO_LONG doslovno; sledeća opcija 10K', () => {
    const at = '2026-11-14' as IsoDate;
    const src = stored(adapted(ofId('d3-24w-35km-v50-A-sat'), 'pause35', at));
    const d = decide(src, HM_ON, at);
    expect(d.unavailable).toHaveLength(1);
    expect(d.unavailable[0]).toMatch(
      /^Polumaraton: Plan od 2[1-4] nedelja je predug \(najviše 20\): počni plan kasnije/
    );
    expect(d.options.map((o) => o.id)).toEqual(['shorter-10000']);
  });

  it('plan po osećaju → v1 cilj nedostupan (O5a); HM v2 cilj dobija lak tempo i radi', () => {
    const feel = TM.feelInputs().find((c) => c.id === 'feel-d4-19w-50km-e315-B')!.input;
    const at = '2026-11-15' as IsoDate;
    const src = stored(adapted(feel, 'pause35', at));
    expect(decide(src, undefined, at)).toMatchObject({
      options: [],
      unavailable: [`Polumaraton: ${V1_TARGET_NEEDS_RESULT}`, `10K: ${V1_TARGET_NEEDS_RESULT}`]
    });
    const prep = select.preparationForPlan(src, HM_ON)!;
    expect(prep.basisFromPlan(src, at)!.input).toMatchObject({ easyPaceSecPerKm: 315 });
    expect(decide(src, HM_ON, at).options.map((o) => o.id)).toEqual(['shorter-21097.5']);
  });

  it('rezultat iz koraka adaptacije (P2) je činjenica: v1 cilj ga dobija kad nije posle starta ulaza', () => {
    // Plan po osećaju, test 5 km u nedelji 2 → ponuda (dugi ograničen trajanjem). Osnova iz plana (start = start plana)
    // nema rezultat do tog dana → v1 nedostupan; potvrđeno izvršenje (start = sutra) nosi rezultat koraka → HM v1.
    const feel = TM.feelInputs().find((c) => c.id === 'feel-d4-14w-50km-e270-B')!.input;
    const at = '2026-11-15' as IsoDate;
    const v2 = adapted(feel, 'test5k', at);
    expect(shorterOffer(v2, at)).toBe(true);
    const step = v2.adaptation!.steps.find((x) => x.result)!.result!;
    const src = stored(v2);
    const prep = select.preparationForPlan(src)!;
    const plain = prep.basisFromPlan(src, at)!;
    expect(plain.input.pb).toBeUndefined();
    expect(decide(src, undefined, at).options).toEqual([]);
    const ex = select.MARATHON_V2_GENERATOR.executionBasis(src, at, null as never, {
      weeklyKm: 40
    });
    if ('error' in ex) throw new Error(ex.error);
    expect(ex.input.pb).toEqual({ distM: step.distM, sec: step.sec, date: step.date });
    const d = prep.preparationDecision(src, at, ex, {}, 'limited', undefined);
    expect(d.options.map((o) => o.id)).toEqual(['shorter-21097.5']);
  });

  it('činjenice izvora: zapisi bez dayId i bez zaključanih dana izvora', () => {
    const log: Record<string, { status: string; km: number; sec: number }> = {};
    for (const w of source.weeks)
      for (const x of w.days)
        if (x.id && addDays(w.start, x.dow) < '2026-11-08' && 'km' in x)
          log[x.id] = { status: 'done', km: Number(x.km), sec: 1800 };
    const raw = rawFacts(source, today, { log });
    const workouts = raw['workouts'] as Record<string, unknown>[];
    expect(workouts.length).toBeGreaterThan(0);
    for (const w of workouts) expect('dayId' in w).toBe(false);
    expect('lockedDayIds' in raw).toBe(false);
  });
});

/* T1/T2: ceo tok izvor → predaja → cilj, bez i sa potvrđenom pauzom (`executionBasis`). Poredi se deo plana koji pravi
   cilj (v1: dani posle danas i ocena pripreme; HM v2: nedelje posle prefiksa izvora i plan v2) — prefiks HM v2 cilja
   je tekuća (adaptirana) nedelja izvora (O6b) i menja se sa politikom izvora. */
type Plan = { weeks: { start: string; days: { dow: number }[] }[]; meta?: unknown; hmV2?: unknown };
function targetPart(p: Plan, today: string): string {
  const prefix = (p as { hmV2Prefix?: { weeks: unknown[] } }).hmV2Prefix;
  if (prefix) return JSON.stringify([p.weeks.slice(prefix.weeks.length), p.hmV2]);
  const out: unknown[] = [];
  for (const w of p.weeks)
    for (const d of w.days) {
      const date = addDays(w.start, d.dow);
      if (date > today) out.push([date, d]);
    }
  return JSON.stringify([out, (p.meta as { preparation?: unknown }).preparation]);
}
const sourcePart = (p: Plan, today: string): string =>
  JSON.stringify(p.weeks.flatMap((w) => w.days.filter((d) => addDays(w.start, d.dow) > today)));
function targetFlow(
  withPause: boolean,
  input: unknown,
  today: IsoDate,
  flags?: select.GeneratorFlags
): { source: string; target: string } {
  const src = stored(adapted(input, 'pause35', today));
  const prep = select.preparationForPlan(src, flags)!;
  const basis = withPause
    ? select.MARATHON_V2_GENERATOR.executionBasis(src, today, null as never, {
        breakDays: 35,
        weeklyKm: 20
      })
    : prep.basisFromPlan(src, today)!;
  if ('error' in basis) throw new Error(basis.error);
  const c = prep.buildPreparationChoice(
    src,
    today,
    basis,
    { kind: 'shorter', raceDistM: 21097.5 },
    {}
  );
  if ('error' in c) throw new Error(c.error);
  return { source: sourcePart(src, today), target: targetPart(c.result, today) };
}
function withSourcePolicy<T>(run: () => T): T {
  const a = MARATHON_V2_POLICY.adapt as { returnGrowth: number; pause: { longShare: number } };
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
function withTargetPolicy<T>(v2: boolean, run: () => T): T {
  if (v2) {
    const p = HM_V2_POLICY.adapt.pause as unknown as Record<string, number>;
    const saved = { ...p };
    try {
      Object.assign(p, { shortShare: 0.5, midShare: 0.4, longShare: 0.3 });
      return run();
    } finally {
      Object.assign(p, saved);
    }
  }
  const t = HM_RETURN_POLICY as unknown as Record<string, { fraction: number; easyWeeks: number }>;
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

describe('3e: T1/T2 — politika izvora ne menja cilj; politika cilja ga menja', () => {
  for (const [target, flags] of [
    ['HM v1', undefined],
    ['HM v2', HM_ON]
  ] as const)
    for (const [race, input, today] of [
      ['subota', BASE, AS_OF],
      ['nedelja', BASE_SUN, AS_OF_SUN]
    ] as const)
      for (const withPause of [false, true])
        it(`maraton v2 (trka ${race}) → ${target} (${withPause ? 'potvrđena pauza' : 'bez izvršenja'})`, () => {
          const base = targetFlow(withPause, input, today, flags);
          const t1 = withSourcePolicy(() => targetFlow(withPause, input, today, flags));
          expect(t1.source, 'kontrola: politika izvora menja plan izvora').not.toBe(base.source);
          expect(t1.target, 'T1: plan cilja isti').toBe(base.target);
          if (withPause) {
            const t2 = withTargetPolicy(flags !== undefined, () =>
              targetFlow(withPause, input, today, flags)
            );
            expect(t2.target, 'T2: politika cilja menja plan cilja').not.toBe(base.target);
          }
        });
});
