import { describe, expect, it } from 'vitest';
/* Proročište (SAMO u testu): kako aplikacija danas razrešava plan + `alts` + `moves` — da otisak ne bude sam sebi svedok. */
import { resolvePlan } from '../../plan/resolve';
import { hm } from '../distances/hm';
import { addDays } from '../engine/dates';
import {
  buildState,
  deriveEvents,
  fingerprint,
  guard,
  replan,
  summarize,
  paceCtxOf,
  type DistanceData,
  type PlanDoc,
  type PlanEvent
} from '../engine';
import { SYNTHETIC } from '../engine/testdata/synthetic';
import { adopt, fingerprintLegacy, STIMULUS_TABLE, type AdoptOk, type AdoptResult } from '.';

type PlanFile = { plan: Record<string, unknown> };
type StateFile = { plan: string; today: string; state: Record<string, unknown> };

const planFiles = import.meta.glob<PlanFile>('./fixtures/*.json', {
  eager: true,
  import: 'default'
});
const stateFiles = import.meta.glob<StateFile>('./fixtures/states/*.json', {
  eager: true,
  import: 'default'
});

const base = (p: string): string => p.replace(/^.*\//, '').replace(/\.json$/, '');
const plans = new Map(Object.entries(planFiles).map(([p, f]) => [base(p), f.plan]));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function deepFreeze<T>(x: T): T {
  if (typeof x === 'object' && x !== null && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v);
  }
  return x;
}

interface Sample {
  name: string;
  today: string;
  input: Record<string, unknown>;
}

const firstStart = (plan: Record<string, unknown>): string =>
  (plan['weeks'] as { start: string }[])[0]?.start ?? '2026-01-01';

/** Svaki plan sa praznim stanjem (dan pre početka) + izmišljena stanja korisnika uz planove. */
const samples: Sample[] = [
  ...[...plans.entries()].map(([name, plan]) => ({
    name: `${name} (prazno stanje)`,
    today: addDays(firstStart(plan), -1),
    input: { genPlan: plan, log: {}, alts: {}, moves: {}, vanPlana: {} }
  })),
  ...Object.entries(stateFiles).map(([p, s]) => ({
    name: base(p),
    today: s.today,
    input: { ...clone(s.state), genPlan: plans.get(s.plan) }
  }))
];

const ok = (r: AdoptResult): AdoptOk => {
  if ('error' in r) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r;
};

const dataFor = (doc: PlanDoc): DistanceData =>
  doc.header.goal.distanceId === hm.id ? hm : SYNTHETIC;

describe('uzorci', () => {
  it('ima dovoljno uzoraka po formatu', () => {
    const fmt = (s: Sample): string => {
      const r = adopt(s.input, s.today);
      return 'error' in r ? 'greška' : r.doc.header.policyId;
    };
    const count = (id: string): number => samples.filter((s) => fmt(s) === id).length;
    expect(count('adopted:legacy-a') + count('adopted:legacy-b')).toBeGreaterThanOrEqual(8 + 3);
    expect(count('adopted:legacy-a')).toBeGreaterThanOrEqual(3);
    expect(count('adopted:legacy-b')).toBeGreaterThanOrEqual(3);
    expect(count('adopted:v2')).toBeGreaterThanOrEqual(8 + 3);
    expect(count('adopted:personal')).toBeGreaterThanOrEqual(3);
    const distances = new Set(
      samples.map((s) => {
        const r = adopt(s.input, s.today);
        return 'error' in r ? '' : `${r.doc.header.policyId}|${r.doc.header.goal.distanceId}`;
      })
    );
    for (const d of ['fivek', 'tenk', 'hm', 'marathon']) {
      expect(distances.has(`adopted:v2|${d}`), d).toBe(true);
      expect(
        [...distances].some((x) => x.startsWith('adopted:legacy') && x.endsWith(`|${d}`)),
        d
      ).toBe(true);
    }
  });
});

describe.each(samples)('$name', ({ today, input }) => {
  const frozen = deepFreeze(clone(input));
  const adopted = ok(adopt(frozen, today));
  const { doc, facts } = adopted;

  it('otisak pre = otisak posle', () => {
    expect(fingerprintLegacy(frozen)).toBe(fingerprint(doc, facts));
  });

  it('dan po dan isto kao razrešen plan aplikacije (proročište)', () => {
    const plan = frozen['genPlan'] as { weeks: Parameters<typeof resolvePlan>[0] };
    const app = resolvePlan(plan.weeks, {
      alts: (frozen['alts'] ?? {}) as Parameters<typeof resolvePlan>[1]['alts'],
      moves: (frozen['moves'] ?? {}) as Record<string, unknown>
    });
    const ctx = paceCtxOf(doc.header);
    const mine = new Map(doc.weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
    expect(mine.size).toBe(app.byId.size);
    for (const [id, a] of app.byId) {
      const d = mine.get(id);
      expect(d, id).toBeDefined();
      if (d === undefined) continue;
      expect(d.date, id).toBe(a.date);
      expect(d.workout === null, id).toBe(a.rest);
      if (d.workout === null) continue;
      expect(d.workout.text, id).toBe(a.desc ?? '');
      expect(Math.round(summarize(d.workout, ctx).distanceM), id).toBe(
        Math.round((a.km ?? 0) * 1000)
      );
    }
  });

  it('ulaz se ne menja', () => {
    expect(JSON.stringify(frozen)).toBe(JSON.stringify(input));
  });

  it('posle preuzimanja nema događaja ni promena; sutradan posle odrađenog dana takođe', () => {
    const data = dataFor(doc);
    const state = buildState(facts, doc.header.goal, data);
    const events = deriveEvents(doc, state);
    /* Zaštićen plan sme da ima izveden događaj (npr. umor iz istorije); `replan` ga ionako ne primenjuje (§ 9.4). */
    if (!doc.header.protected) expect(events).toEqual([]);
    const result = replan(doc, state, events, data);
    expect(result.changes).toEqual([]);
    expect(result.doc).toBe(doc);

    const tomorrow = addDays(today, 1);
    const day = doc.weeks.flatMap((w) => w.days).find((d) => d.date === tomorrow);
    const log = { ...((frozen['log'] ?? {}) as Record<string, unknown>) };
    if (day?.workout != null && day.workout.steps.length > 0) {
      const km = summarize(day.workout, paceCtxOf(doc.header)).km;
      log[day.id] = { status: 'done', km, sec: Math.round(km * 340), hr: 145 };
    }
    const next = ok(adopt({ ...frozen, log }, tomorrow));
    const state2 = buildState(next.facts, doc.header.goal, data);
    const events2 = deriveEvents(doc, state2);
    if (!doc.header.protected) expect(events2).toEqual([]);
    const result2 = replan(doc, state2, events2, data);
    expect(result2.changes).toEqual([]);
    expect(result2.doc).toBe(doc);
  });

  it('preuzimanje je determinističko', () => {
    expect(JSON.stringify(ok(adopt(clone(input), today)))).toBe(JSON.stringify(adopted));
  });

  it('namera preostalih nedelja je izvedena (§ 9.3)', () => {
    const plan = frozen['genPlan'] as {
      weeks: { deload?: boolean; taper?: boolean; phase?: string }[];
    };
    const table = STIMULUS_TABLE[doc.header.goal.distanceId] ?? {};
    const known = new Set(Object.values(table));
    let maxLoad = 0;
    let maxLen = 0;
    doc.weeks.forEach((w, i) => {
      const old = plan.weeks[i];
      expect(w.intent.source).toBe('inferred');
      expect(w.intent.phase).toBe(old?.phase ?? 'nepoznata');
      const race = w.days.some((d) => d.workout?.kind === 'race');
      const kind = race ? 'race' : old?.taper ? 'taper' : old?.deload ? 'recovery' : 'build';
      expect(w.intent.kind).toBe(kind);
      expect(w.intent.loadPct).toBeGreaterThanOrEqual(0);
      expect(w.intent.loadPct).toBeLessThanOrEqual(1);
      maxLoad = Math.max(maxLoad, w.intent.loadPct);
      if (w.intent.long !== null) {
        expect(known.has(w.intent.long.stimulus)).toBe(true);
        maxLen = Math.max(maxLen, w.intent.long.lenPct);
      }
      for (const s of w.intent.stimuli) expect(known.has(s.stimulus), s.stimulus).toBe(true);
    });
    expect(maxLoad).toBe(1);
    if (doc.header.decisions.longMaxSec > 0) expect(maxLen).toBe(1);
    expect(doc.header.eventsFrom).toBe(today);
    expect(doc.header.appliedEvents).toEqual([]);
    expect(doc.header.decisions.runDays).toContain(doc.header.decisions.longDay);
  });

  it('čuvar nad preuzetim danima prijavljuje samo `rucno`', () => {
    for (const f of guard(doc, buildState(facts, doc.header.goal, dataFor(doc)), dataFor(doc))) {
      expect(f.check).toBe('rucno');
    }
  });
});

describe('tabela preslikavanja', () => {
  it('svaka oznaka za polumaraton postoji u biblioteci `distances/hm`', () => {
    const tags = new Set(hm.library.map((w) => w.stimulus));
    for (const tag of Object.values(STIMULUS_TABLE['hm'] ?? {}))
      expect(tags.has(tag), tag).toBe(true);
  });
});

describe('primer SPEC § 12 (c)', () => {
  const s = stateFiles['./fixtures/states/legacy-spec-c.json'];
  if (s === undefined) throw new Error('nema uzorka (c)');
  const { doc, facts } = ok(adopt({ ...s.state, genPlan: plans.get(s.plan) }, s.today));
  const days = doc.weeks.flatMap((w) => w.days);

  it('84 dana, dve ručne izmene sa `base`, 8 urađenih, propušten pre preuzimanja ne pravi događaj', () => {
    expect(days).toHaveLength(84);
    const manual = days.filter((d) => d.origin === 'manual');
    expect(manual.map((d) => d.id).sort()).toEqual(['g3d5', 'g4d2']);
    for (const d of manual) expect(d.base).toBeDefined();
    expect(days.find((d) => d.id === 'g3d5')?.base?.kind).toBe('quality');
    expect(days.find((d) => d.id === 'g3d5')?.workout?.kind).toBe('easy');
    expect(facts.runs.filter((r) => r.dayId !== undefined)).toHaveLength(8);
    expect(facts.runs.some((r) => r.dayId === 'g2d3')).toBe(false);
    expect(days.filter((d) => d.origin === 'adopted')).toHaveLength(82);
    expect(doc.header.eventsFrom).toBe('2026-01-22');
    expect(deriveEvents(doc, buildState(facts, doc.header.goal, SYNTHETIC))).toEqual([]);
  });
});

describe('lični plan vlasnika', () => {
  const personal = Object.values(stateFiles).filter((s) => s.plan === 'personal');
  it.each(personal)('zaštićen; `replan` na bilo koji događaj vraća isti objekat ($today)', (s) => {
    const { doc, facts } = ok(adopt({ ...s.state, genPlan: plans.get('personal') }, s.today));
    expect(doc.header.protected).toBe(true);
    expect(doc.header.policyId).toBe('adopted:personal');
    const state = buildState(facts, doc.header.goal, hm);
    const events: PlanEvent[] = [
      { id: `pain:${s.today}`, date: s.today, kind: 'pain', level: 6, part: 'koleno' },
      {
        id: `pause:${s.today}:${s.today}`,
        date: s.today,
        kind: 'pause',
        from: addDays(s.today, -6),
        to: s.today,
        reason: 'bolest'
      },
      { id: `fatigue:${s.today}`, date: s.today, kind: 'fatigue', source: 'trkac' },
      {
        id: `goal-change:${s.today}`,
        date: s.today,
        kind: 'goal-change',
        goal: { ...doc.header.goal, targetTimeSec: 5900 }
      }
    ];
    for (const ev of events) {
      const r = replan(doc, state, [ev], hm);
      expect(r.doc).toBe(doc);
      expect(r.changes).toEqual([]);
    }
    for (const f of guard(doc, state, hm)) expect(f.check).toBe('rucno');
  });
});

describe('neispravan ili nepoznat ulaz → { error }, bez izuzetka', () => {
  const plan = plans.get('legacy-11a38446') as Record<string, unknown>;
  const weeks = plan['weeks'] as Record<string, unknown>[];
  const cases: [string, unknown, string][] = [
    ['null', null, '2026-01-01'],
    ['broj', 42, '2026-01-01'],
    ['niz', [], '2026-01-01'],
    ['bez plana', { log: {} }, '2026-01-01'],
    ['plan bez nedelja', { genPlan: { weeks: [] } }, '2026-01-01'],
    ['nedelje nisu niz', { genPlan: { weeks: 'x' } }, '2026-01-01'],
    [
      'loš početak nedelje',
      { genPlan: { ...plan, weeks: [{ ...weeks[0], start: '2026-02-30' }] } },
      '2026-01-01'
    ],
    [
      'dan bez ID-ja',
      { genPlan: { ...plan, weeks: [{ start: '2026-01-05', days: [{ dow: 0 }] }] } },
      '2026-01-01'
    ],
    [
      'dan van nedelje',
      { genPlan: { ...plan, weeks: [{ start: '2026-01-05', days: [{ id: 'a', dow: 9 }] }] } },
      '2026-01-01'
    ],
    ['ID se ponavlja', { genPlan: { ...plan, weeks: [weeks[0], weeks[0]] } }, '2026-01-01'],
    ['nepoznata distanca', { genPlan: { ...plan, meta: { raceDistM: 15000 } } }, '2026-01-01'],
    ['bez meta', { genPlan: { weeks } }, '2026-01-01'],
    ['loš današnji datum', { genPlan: plan }, '12. 11. 2026']
  ];
  it.each(cases)('%s', (_name, input, today) => {
    const r = adopt(deepFreeze(clone(input)), today);
    expect('error' in r).toBe(true);
    expect(fingerprintLegacy(input) === null || 'error' in r).toBe(true);
  });

  it('neobična polja ne obaraju adapter i ne gube se', () => {
    const odd = clone(plan);
    const w0 = (odd['weeks'] as Record<string, unknown>[])[0] as {
      days: Record<string, unknown>[];
    };
    w0.days[0] = { ...w0.days[0], km: 'deset', nesto: { a: 1 }, finish: { km: 2 } };
    const r = ok(
      adopt(
        deepFreeze({
          genPlan: { ...odd, planRevisions: [{ at: '2026-01-10' }], goalChange: { from: 3000 } },
          log: { g1d1: 'x', g1d2: { status: 'done', km: 'a', sec: null } },
          alts: { g1d3: 7 },
          moves: { g1d5: 12 },
          vanPlana: { 'nije-datum': 5, '2026-01-04': 'pet' }
        }),
        '2026-01-20'
      )
    );
    const d0 = r.doc.weeks[0]?.days.find((d) => d.id === 'g1d1');
    expect(d0?.legacy?.['nesto']).toEqual({ a: 1 });
    expect(d0?.extras).toContain('brz završetak');
    expect(r.carried['planRevisions']).toEqual([{ at: '2026-01-10' }]);
    expect(r.carried['goalChange']).toEqual({ from: 3000 });
    expect(r.facts.runs.map((x) => x.id)).toEqual(['log:g1d2']);
  });
});
