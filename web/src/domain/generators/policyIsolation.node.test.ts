import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IsoDate } from '../date';
import type { GenPlanState, VdotRecord } from '../state';
import { recordAutoPace, type WorkPaceState } from '../day/workPace';
import type { ResolvedDay } from '../plan/types';
import * as select from './select';
import { RETURN_POLICY as HM_RETURN_POLICY } from './halfMarathon/plan/regenerate';
import { RETURN_POLICY as MARATHON_RETURN_POLICY } from './marathon/plan/regenerate';
import { RETURN_POLICY as TEN_K_RETURN_POLICY } from './tenK/plan/regenerate';

/* IZOLACIJA POLITIKE (A12): promena tolerancije automatskog merenja, α lanca forme ili povratne politike u JEDNOM
   generatoru ne menja izlaz drugog — uključujući predaju „kraća distanca", gde izmena IZVORA ne sme da promeni plan ciljne
   distance (cilj sam određuje povratnu politiku, bazu rasta i pokrivenost, A2). Kontrola: izmena politike CILJA menja
   taj plan (kanal je stvaran). Uz to: oznaka politike i faza nedelje (A3/A7). */

type Select = typeof select;
const GENERATORS = ['5k', '10k', 'hm', 'marathon'] as const;
const byId = (s: Select, id: (typeof GENERATORS)[number]) =>
  ({
    '5k': s.FIVE_K_GENERATOR,
    '10k': s.TEN_K_GENERATOR,
    hm: s.HALF_MARATHON_GENERATOR,
    marathon: s.MARATHON_GENERATOR
  })[id];

/** Merenja forme kroz ugovor generatora: klasifikacija automatskog tempa, lanac i trenutna forma. */
function formRun(g: select.PlanGenerator): unknown {
  const out: unknown[] = [];
  for (const form of [45, 50, 55]) {
    for (const delta of [-3, -1.5, 1, 2.5, 3.5]) {
      const paceSec = g.paceForZone(form + delta, 'T');
      out.push(
        g.classifyMeasurement({
          row: { l: 'N5 · Tempo', q: 1, zone: 'T' },
          paceSec,
          kind: 'Tempo',
          auto: true,
          retagged: false,
          currentVdot: form,
          baselineVdot: form
        })
      );
    }
  }
  const entries: VdotRecord[] = [
    { id: 't3k_a', ts: '2026-01-03', vdot: null, prev: null, delta: null, measured: 51 },
    { id: 'g1_0', ts: '2026-01-07', vdot: null, prev: null, delta: null, measured: 52 },
    { id: 'g2_1', ts: '2026-01-14', vdot: null, prev: null, delta: null, measured: 49 },
    { id: 'g3_2', ts: '2026-01-21', vdot: null, prev: null, delta: null, measured: 53 }
  ];
  const labels: Record<string, string> = {
    g1_0: 'N1 · Tempo',
    g2_1: 'N2 · Intervali',
    g3_2: 'N3 · Repeticije'
  };
  const chain = g.recomputeVdotChain(entries, 50, (id) =>
    g.sessionClassFor(id.startsWith('t3k'), labels[id])
  );
  out.push(chain, g.currentVdot(chain));
  return out;
}

/** Isti tok kroz aplikacioni upis automatskog tempa (`recordAutoPace`), sa politikom generatora u kontekstu. */
function appRun(g: select.PlanGenerator): unknown {
  const day = {
    id: 'g1d2',
    date: '2026-01-07',
    tag: 'tempo',
    origin: { tag: 'tempo' },
    session: { zone: 'T', kind: 'Tempo' }
  } as unknown as ResolvedDay;
  const state: WorkPaceState = {
    pred: {},
    predLock: {},
    vdotLog: [{ id: 'g0_0', ts: '2026-01-01', vdot: null, prev: null, delta: null, measured: 50 }],
    log: { g1d2: { status: 'done' } }
  };
  const ctx = {
    form: g,
    rows: [{ id: 'g1_0', w: 1, l: 'N1 · Tempo', q: 1, pt: 0, p5k: 0, zone: 'T' as const }],
    baselineVdot: 50,
    hasAlt: false
  };
  return [51.5, 52.5, 53.5].map((v) =>
    recordAutoPace(day, 'g1_0', g.paceForZone(v, 'T'), '2026-01-07', state, ctx)
  );
}

const snapshot = (s: Select) =>
  Object.fromEntries(
    GENERATORS.map((id) => [id, JSON.stringify([formRun(byId(s, id)), appRun(byId(s, id))])])
  );

afterEach(() => {
  vi.doUnmock('./fiveK/training/constants/heuristics');
  vi.resetModules();
});

describe('A1: tolerancija i α pripadaju generatoru plana', () => {
  it('promena tolerancije/α u 5K menja samo 5K; 10K, HM i maraton ostaju isti (i kroz upis tempa)', async () => {
    vi.resetModules();
    const before = snapshot(await import('./select'));
    vi.resetModules();
    vi.doMock('./fiveK/training/constants/heuristics', async (orig) => ({
      ...(await orig<object>()),
      AUTO_VDOT_TOLERANCE: 0.5,
      VDOT_ALPHA: { test: 0.9, tempo: 0.9, int: 0.9, rep: 0.9, default: 0.9 }
    }));
    const after = snapshot(await import('./select'));
    expect(after['5k']).not.toBe(before['5k']);
    for (const id of ['10k', 'hm', 'marathon'] as const) expect(after[id], id).toBe(before[id]);
  });
});

/* ---------------------------------------------------------------- A2: predaja prenosi samo činjenice */

type Event = {
  input: {
    current: GenPlanState;
    context: select.ReplanContext;
    options: select.ExecutionAdjustmentOptions;
    today?: IsoDate;
  };
  analysis: never;
  today?: IsoDate;
  profile?: { eventToday: IsoDate };
};
function load(id: 'U08' | 'U10'): { e: Event; today: IsoDate } {
  const url = new URL(`../../../../docs/qa/generator-ab/users/${id}-event.json`, import.meta.url);
  const doc = JSON.parse(readFileSync(url, 'utf8')) as { event: Event; profile?: Event['profile'] };
  const e = id === 'U10' ? { ...doc.event, profile: doc.profile } : doc.event;
  return { e, today: e.today ?? e.input.today ?? e.profile!.eventToday };
}

type Policy = Record<string, { days: number; fraction: number; easyWeeks: number }>;
/** Probna izmena povratne politike SAMO u memoriji ovog testa; vraća se u `finally`. */
function withPolicy<T>(table: unknown, run: () => T): T {
  const t = table as Policy;
  const saved = JSON.stringify(t);
  try {
    for (const p of Object.values(t)) {
      p.fraction = Math.round(p.fraction * 50) / 100;
      p.easyWeeks += 3;
    }
    return run();
  } finally {
    const orig = JSON.parse(saved) as Policy;
    for (const [k, v] of Object.entries(orig)) Object.assign(t[k]!, v);
  }
}

const cases = [
  {
    name: 'HM → 10K (U08)',
    id: 'U08' as const,
    generator: select.HALF_MARATHON_GENERATOR,
    preparation: select.HALF_MARATHON_PREPARATION,
    shorter: 10000,
    source: HM_RETURN_POLICY,
    target: TEN_K_RETURN_POLICY
  },
  {
    name: 'maraton → HM (U10)',
    id: 'U10' as const,
    generator: select.MARATHON_GENERATOR,
    preparation: select.MARATHON_PREPARATION,
    shorter: 21097.5,
    source: MARATHON_RETURN_POLICY,
    target: HM_RETURN_POLICY
  }
];

describe('A2: izmena povratne politike izvora ne menja plan ciljne distance', () => {
  for (const c of cases) {
    it(c.name, { timeout: 120_000 }, () => {
      const { e, today } = load(c.id);
      const { current, context, options } = e.input;
      const basis = c.generator.executionBasis(current, today, e.analysis, options);
      if ('error' in basis) throw new Error(basis.error);
      expect(basis.policy, 'potvrđena pauza daje povratnu politiku izvora').not.toBeNull();
      const choice = { kind: 'shorter' as const, raceDistM: c.shorter as 10000 };
      const shorterPlan = (
        b: typeof basis | NonNullable<ReturnType<typeof c.preparation.basisFromPlan>>
      ) => {
        const r = c.preparation.buildPreparationChoice(current, today, b, choice, context);
        if ('error' in r) throw new Error(r.error);
        expect(r.result.meta!.raceDistM).toBe(c.shorter);
        return JSON.stringify(r);
      };
      const reference = shorterPlan(basis);

      // 1. Osnova izračunata pre izmene: izvor i dalje drži SVOJ (izmenjen) objekat politike u `basis.policy`.
      expect(withPolicy(c.source, () => shorterPlan(basis))).toBe(reference);

      // 2. Osnova iz sačuvanog plana posle izmene (`basisFromPlan` čita izmenjenu tablicu izvora).
      const adjusted = c.generator.buildExecutionAdjustment(
        current,
        today,
        e.analysis,
        options,
        context
      );
      if ('error' in adjusted) throw new Error(adjusted.error);
      const stored = adjusted.result;
      const fromStored = () => {
        const b = c.preparation.basisFromPlan(stored, today);
        if (!b) throw new Error('nema osnove');
        expect(b.policy).not.toBeNull();
        const r = c.preparation.buildPreparationChoice(stored, today, b, choice, context);
        if ('error' in r) throw new Error(r.error);
        return JSON.stringify(r);
      };
      const storedReference = fromStored();
      expect(withPolicy(c.source, fromStored)).toBe(storedReference);

      // 3. Kontrola: izmena politike CILJA menja plan kraće distance (cilj odlučuje sam).
      expect(withPolicy(c.target, () => shorterPlan(basis))).not.toBe(reference);
    });
  }
});

/* ---------------------------------------------------------------- A3/A7: faza i oznaka politike */

describe('A3/A7: faza nedelje i oznaka politike iz generatora plana', () => {
  const planOf = (raceDistM: number, meta: Record<string, unknown> = {}): GenPlanState =>
    ({
      weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => ({
        w,
        start: '2026-01-05',
        deload: w === 4,
        focus: '',
        days: []
      })),
      pred: [],
      meta: { raceDistM, ...meta }
    }) as unknown as GenPlanState;

  it('stampPlan upisuje fazu svake nedelje i policyId/policyVersion svog generatora, bez mutacije ulaza', () => {
    for (const [dist, g] of [
      [5000, select.FIVE_K_GENERATOR],
      [10000, select.TEN_K_GENERATOR],
      [21097.5, select.HALF_MARATHON_GENERATOR],
      [42195, select.MARATHON_GENERATOR]
    ] as const) {
      const plan = planOf(dist);
      const before = JSON.stringify(plan);
      const stamped = select.stampForStorage(plan);
      expect(JSON.stringify(plan)).toBe(before);
      expect(stamped.meta).toMatchObject({ policyId: g.policyId, policyVersion: g.policyVersion });
      expect(g.planPolicy(stamped).status).toBe('current');
      expect(stamped.weeks.map((w) => w.phase)).toEqual(
        plan.weeks.map((w) => g.phaseOfWeek(w, plan.weeks.length))
      );
      // Prikaz čita upisanu fazu; stari plan bez polja dobija istu fazu funkcijom generatora.
      const read = select.phaseReaderFor(stamped);
      const legacyRead = select.phaseReaderFor(plan);
      for (const w of stamped.weeks) expect(read(w, 10)).toBe(w.phase);
      for (const w of plan.weeks) expect(legacyRead(w, 10)).toBe(g.phaseOfWeek(w, 10));
      // Upisana faza je odluka generatora, ne procenat pri čitanju: menja se samo ponovnim upisom.
      expect(read({ ...stamped.weeks[0]!, phase: 'VRHUNAC' }, 10)).toBe('VRHUNAC');
    }
  });

  it('plan bez oznake je legacy-<distanca> i obrađuje ga postojeći generator', () => {
    expect(select.planPolicyOf(planOf(5000))).toEqual({
      status: 'legacy',
      policyId: 'legacy-5k',
      policyVersion: null
    });
    expect(select.generatorForPlan(planOf(21097.5))).toBe(select.HALF_MARATHON_GENERATOR);
  });

  it('nepoznata verzija ili tuđa oznaka → nema generatora i eksplicitna poruka, bez tihe zamene', () => {
    for (const meta of [
      { policyId: '5k-v1', policyVersion: '5k-v1.9.0' },
      { policyId: '5k-v2', policyVersion: '5k-v2.1.0' },
      { policyId: 'hm-v1', policyVersion: 'hm-v1.0.0' }
    ]) {
      const plan = planOf(5000, meta);
      expect(select.generatorForPlan(plan)).toBeNull();
      expect(select.preparationForPlan(plan)).toBeNull();
      expect(select.unsupportedPlanReason(plan)).toBe(select.UNKNOWN_POLICY);
      expect(select.stampForStorage(plan)).toBe(plan);
      expect(select.phaseReaderFor(plan)(plan.weeks[0], 10)).toBe('');
    }
    expect(select.unsupportedPlanReason(planOf(7000))).toBe(select.UNSUPPORTED_DISTANCE);
  });
});
