import { describe, expect, it } from 'vitest';
import { buildCtx, plannedEffort, weekTarget } from './build';
import { decideLongMax, decideLongStart } from './decide';
import {
  buildState,
  deriveEvents,
  guard,
  paceCtxOf,
  plan,
  renderPlan,
  replan,
  summarize
} from './index';
import { modsFor } from './readiness';
import { build, facts, goalAt, runsAsPlanned } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type {
  Adjustment,
  DistanceData,
  Goal,
  PlanDay,
  PlanDoc,
  RunnerFacts,
  RunnerState,
  WeekIntent
} from './types';

/* TREĆI KRUG (zahtevi taba podataka distance, prihvatio organizator). */

const GOAL: Goal = goalAt('2027-01-24');
const EVERY_DAY: RunnerFacts['availability'] = { runDays: [0, 1, 2, 3, 4, 5, 6], longDay: 6 };

function make(
  f: RunnerFacts,
  data: DistanceData,
  goal: Goal = GOAL
): { doc: PlanDoc; state: RunnerState } {
  const state = buildState(f, goal, data);
  const result = plan(state, goal, data);
  if (!result.ok) throw new Error('plan odbijen');
  return { doc: result.doc, state };
}

const days = (doc: PlanDoc): PlanDay[] => doc.weeks.flatMap((w) => w.days);
const template = SYNTHETIC.templates[1];
if (template === undefined) throw new Error('nema šablona');

/** Sintetička distanca u kojoj svaka nedelja tela ima proveru forme iz plana, pa prag i ubrzanja. */
const WITH_TEST: DistanceData = {
  ...SYNTHETIC,
  templates: [
    {
      ...template,
      body: template.body.map((phase) => ({
        ...phase,
        cycle: phase.cycle.map((w) => ({
          ...w,
          stimuli: [{ stimulus: 'test' }, { stimulus: 'prag' }, { stimulus: 'ubrzanja' }]
        }))
      }))
    }
  ]
};

describe('1–2: pun napor iz plana (provera forme, pripremna trka)', () => {
  const planned: Adjustment = {
    kind: 'effort',
    source: 'plan',
    date: '2026-12-01',
    durationSec: 2700,
    planned: true
  };
  const outside: Adjustment = {
    kind: 'effort',
    source: 'x',
    date: '2026-12-01',
    durationSec: 2700
  };

  it('posle napora iz plana: 3 dana bez ičeg brzog, bez rampe i bez × 0,8', () => {
    for (const n of [1, 2, 3]) {
      const m = modsFor(`2026-12-0${String(1 + n)}`, [planned], [], 'quality:prag');
      expect([m.quality, m.addon, m.f, m.rest], String(n)).toEqual([false, false, 1, false]);
    }
    const fourth = modsFor('2026-12-05', [planned], [], 'quality:prag');
    expect([fourth.quality, fourth.addon, fourth.f, fourth.doseFactor]).toEqual([true, true, 1, 1]);
    expect(modsFor('2026-12-12', [planned], [], 'quality:prag').doseFactor).toBe(1);
  });

  it('spoljni napor iste dužine i dalje ima rampu i × 0,8', () => {
    expect(modsFor('2026-12-03', [outside], [], 'quality:prag').f).toBeLessThan(1);
    expect(modsFor('2026-12-06', [outside], [], 'quality:prag').doseFactor).toBe(0.8);
    expect(modsFor('2026-12-12', [outside], [], 'quality:prag').doseFactor).toBe(0.8);
  });

  const { doc, state } = make(facts({ availability: EVERY_DAY }), WITH_TEST);
  const tests = days(doc).filter((d) => d.workout?.kind === 'test');

  it('plan sa proverama forme: lagani dani posle testa nisu skraćeni, čuvar ne prijavljuje `ispod-cilja`', () => {
    expect(tests.length).toBeGreaterThan(2);
    expect(
      plannedEffort(
        tests[0] ?? { id: '', date: '', origin: 'template', locked: false, workout: null }
      )
    ).toMatchObject({ planned: true });
    const findings = guard(doc, state, WITH_TEST).map((f) => f.check);
    expect(findings).not.toContain('ispod-cilja');
    expect(findings).not.toContain('min-nedelja');
  });

  it('rezultat provere forme iz plana ne pokreće rampu (replan bez izmena dana)', () => {
    const test = tests[0];
    if (test === undefined) throw new Error('nema testa');
    /* Sam test (bez zagrevanja): 3 km za očekivano vreme po formi plana — forma se ne menja. */
    const run = {
      id: 'provera',
      date: test.date,
      distanceM: 3000,
      durationSec: test.workout?.workSec ?? 0,
      dayId: test.id,
      effort: 'test' as const
    };
    const before = runsAsPlanned(doc, test.date, (d) => d === test.date);
    const st = buildState(
      { ...facts({ availability: EVERY_DAY }), today: test.date, runs: [...before, run] },
      GOAL,
      WITH_TEST
    );
    const events = deriveEvents(doc, st);
    expect(events.map((e) => e.kind)).toContain('result');
    const result = replan(doc, st, events, WITH_TEST);
    expect(result.changes.filter((c) => c.scope === 'dan')).toEqual([]);
  });
});

describe('3–4: polazni dugi i udeo dugog', () => {
  const s = SYNTHETIC.safety;

  it('polazni dugi = veće od najdužeg skorašnjeg i udela bazne nedelje; udeo može biti mapa po danima', () => {
    expect(decideLongStart(1800, 200, s, 4)).toBe(0.3 * 200 * 60);
    expect(decideLongStart(5400, 200, s, 4)).toBe(5400);
    const mapped = { ...s, longStartShare: { '3': 0.4, '5': 0.25 } };
    expect(decideLongStart(0, 200, mapped, 3)).toBe(0.4 * 200 * 60);
    expect(decideLongStart(0, 200, mapped, 4)).toBe(0.4 * 200 * 60);
    expect(decideLongStart(0, 200, mapped, 6)).toBe(0.25 * 200 * 60);
  });

  it('udeo dugog po nivou; bez nivoa važi postojeća mapa', () => {
    const flat = decideLongMax(200, s, 'osnovni', 4);
    expect(flat).toBe(Math.round((0.38 * 200 * 60) / 60) * 60);
    const leveled = {
      ...s,
      longShareByRunDays: { pocetni: { '4': 0.3 }, osnovni: { '4': 0.45 } }
    };
    expect(decideLongMax(200, leveled, 'pocetni', 4)).toBe(0.3 * 200 * 60);
    expect(decideLongMax(200, leveled, 'osnovni', 4)).toBe(0.45 * 200 * 60);
  });
});

describe('5–6: cilj prve nedelje i rasterećenja', () => {
  const lowStart: DistanceData = {
    ...SYNTHETIC,
    templates: [
      {
        ...template,
        body: template.body.map((phase) => ({
          ...phase,
          cycle: phase.cycle.map((w) => ({ ...w, loadPct: w.loadPct * 0.8 }))
        }))
      }
    ]
  };

  it('prva nedelja gradnje nije ispod sadašnjeg obima', () => {
    const { doc } = make(facts(), lowStart);
    expect(doc.weeks[0]?.targetLoad).toBeGreaterThanOrEqual(
      Math.round(doc.header.decisions.baseLoad)
    );
    const capped: DistanceData = {
      ...SYNTHETIC,
      safety: { ...SYNTHETIC.safety, peakLoadCap: { pocetni: 240, osnovni: 150 } }
    };
    const c = make(facts(), capped);
    expect(c.doc.header.decisions.peakLoad).toBe(c.doc.header.decisions.baseLoad);
    expect(c.doc.weeks[0]?.targetLoad).toBeGreaterThanOrEqual(
      Math.round(c.doc.header.decisions.baseLoad)
    );
  });

  it('plan koji počinje u rampi: cilj ostaje na bazi, dane skraćuje spremnost (krug 2, R5)', () => {
    const race = {
      id: 'trka',
      date: '2026-11-15',
      distanceM: 10000,
      durationSec: 2760,
      effort: 'race' as const
    };
    const fresh = make(facts(), lowStart);
    const ramp = make(facts({ runs: [race] }), lowStart);
    const ctx = paceCtxOf(ramp.doc.header);
    const load = (doc: PlanDoc): number =>
      (doc.weeks[0]?.days ?? []).reduce((sum, day) => sum + summarize(day.workout, ctx).load, 0);
    expect(fresh.doc.weeks[0]?.targetLoad).toBeGreaterThanOrEqual(
      Math.round(fresh.doc.header.decisions.baseLoad)
    );
    expect(load(ramp.doc)).toBeLessThan(0.8 * load(fresh.doc));
  });

  it('rasterećenje nije veće od `recovery.loadFactor` × cilj prethodne nedelje', () => {
    const { doc } = make(facts(), SYNTHETIC);
    const ctx = buildCtx(doc.header, SYNTHETIC);
    const intent: WeekIntent = {
      phase: 'osnova',
      kind: 'recovery',
      loadPct: 0.9,
      long: null,
      stimuli: [],
      source: 'template'
    };
    const input = { m: 400, fraction: 1, firstFresh: false };
    const free = weekTarget(intent, { ...input, previousTarget: null }, ctx).target;
    const capped = weekTarget(intent, { ...input, previousTarget: 180 }, ctx).target;
    expect(free).toBe(Math.round(0.9 * doc.header.decisions.peakLoad));
    expect(capped).toBe(Math.round(0.8 * 180));
    doc.weeks.forEach((w, i) => {
      const prev = doc.weeks[i - 1];
      if (w.intent.kind === 'recovery' && prev !== undefined) {
        expect(w.targetLoad, String(w.index)).toBeLessThanOrEqual(
          Math.round(0.8 * prev.targetLoad) + 1
        );
      }
    });
  });
});

describe('7: dan trke u ispisu', () => {
  it('napomene dana trke: `noteRules` sa `kinds: [race]`, tekst iz `texts`', () => {
    const data: DistanceData = {
      ...SYNTHETIC,
      noteRules: [
        ...SYNTHETIC.noteRules,
        { kinds: ['race'], minDurationSec: 0, text: 'trka-tempo' },
        { kinds: ['race'], minDurationSec: 36000, text: 'trka-unos' }
      ],
      texts: {
        ...SYNTHETIC.texts,
        'trka-tempo': 'prva 2 km mirno, zatim ravnomerno, poslednji km sve što imaš',
        'trka-unos': 'unos na svakih 30 min'
      }
    };
    const { doc, state } = make(facts(), data);
    const race = days(doc).find((d) => d.workout?.kind === 'race');
    expect(race?.workout?.text).toBe('trka 8 km');
    expect(race?.workout?.notes).toEqual([
      'prva 2 km mirno, zatim ravnomerno, poslednji km sve što imaš'
    ]);
    const lines = renderPlan(doc, state, data).split('\n');
    const at = lines.findIndex((l) => l.includes('TRKA: probna trka 8 km'));
    /* Krug 2 (R6, R10): prvo tempo za trku, pa napomene iz podataka, na kraju rečenica o oporavku. */
    expect(lines[at + 1]).toMatch(/^ {6}napomena: Tempo za trku: \d:\d\d\/km \(današnja forma /);
    expect(lines[at + 2]).toBe(
      '      napomena: prva 2 km mirno, zatim ravnomerno, poslednji km sve što imaš'
    );
    expect(lines[at + 3]).toMatch(/^ {6}napomena: Posle trke: \d+ dana? bez brzih treninga/);
    expect(
      days(make(facts(), SYNTHETIC).doc).find((d) => d.workout?.kind === 'race')?.workout?.notes
    ).toBeUndefined();
  });
});

describe('8: uslov „samo dok su tempa po osećaju"', () => {
  const slotData: DistanceData = {
    ...SYNTHETIC,
    templates: SYNTHETIC.templates.map((t) => ({
      ...t,
      body: t.body.map((phase) => ({
        ...phase,
        cycle: phase.cycle.map((w, i) =>
          i === 0
            ? { ...w, stimuli: [{ stimulus: 'test', onlyByFeel: true }, ...w.stimuli.slice(1)] }
            : w
        )
      }))
    }))
  };
  const defData: DistanceData = {
    ...slotData,
    templates: slotData.templates.map((t) => ({
      ...t,
      body: t.body.map((phase) => ({
        ...phase,
        cycle: phase.cycle.map((w) => ({
          ...w,
          stimuli: w.stimuli.map((s) => ({ stimulus: s.stimulus }))
        }))
      }))
    })),
    library: SYNTHETIC.library.map((d) =>
      d.id === 'test-3k' ? { ...d, requires: { onlyByFeel: true } } : d
    )
  };
  const feel = facts({ profile: { weeklyKm: 30, easyPaceSecPerKm: 380 } });
  const known = facts();

  it.each([
    ['mesto u šablonu', slotData],
    ['unos biblioteke', defData]
  ])('%s: rani test postoji samo kad su tempa po osećaju', (_name, data) => {
    const byFeel = make(feel, data);
    expect(byFeel.doc.header.paces.byFeel).toBe(true);
    expect(days(byFeel.doc).some((d) => d.workout?.kind === 'test')).toBe(true);
    const paced = make(known, data);
    expect(paced.doc.header.paces.byFeel).toBe(false);
    expect(days(paced.doc).some((d) => d.workout?.kind === 'test')).toBe(false);
    expect(paced.doc.weeks[0]?.days.filter((d) => d.workout !== null).length).toBe(4);
  });
});

describe('postojeći podaci rade nepromenjeno', () => {
  it('sintetička distanca bez novih polja i dalje daje plan bez nalaza', () => {
    const b = build(facts(), GOAL);
    expect(guard(b.doc, b.state, SYNTHETIC)).toEqual([]);
  });
});
