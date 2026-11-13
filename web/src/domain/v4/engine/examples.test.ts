import { describe, expect, it } from 'vitest';
import { addDays, diffDays } from './dates';
import { fmtDate } from './format';
import { buildState, deriveEvents, guard, paceCtxOf, plan, replan, summarize } from './index';
import { EXAMPLE } from './testdata/example';
import { facts, HALF_M, runsAsPlanned } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type { DistanceData, Goal, PlanDay, PlanDoc, Run, RunnerFacts, RunnerState } from './types';

const GOAL: Goal = { distanceId: EXAMPLE.id, raceDate: '2027-01-24' };

function make(
  f: RunnerFacts,
  goal: Goal = GOAL,
  data: DistanceData = EXAMPLE
): { doc: PlanDoc; state: RunnerState } {
  const state = buildState(f, goal, data);
  const result = plan(state, goal, data);
  if (!result.ok) throw new Error('plan odbijen');
  return { doc: result.doc, state };
}

const days = (doc: PlanDoc): PlanDay[] => doc.weeks.flatMap((w) => w.days);
const onDate = (doc: PlanDoc, date: string): PlanDay | undefined =>
  days(doc).find((d) => d.date === date);
/** Sekunde brzog rada dana (kvalitet, blok u dugom, ubrzanja). */
const fastSec = (doc: PlanDoc, day: PlanDay): number =>
  summarize(day.workout, paceCtxOf(doc.header)).workSec;

describe('SPEC § 12 (a): nov plan, 30 km nedeljno, 4 dana, 10 nedelja, forma 1:41:00', () => {
  const { doc, state } = make(facts());
  const d = doc.header.decisions;

  it('forma, baza, vrh, plafoni, dugi i raspored dana kao u primeru', () => {
    expect(doc.header.form.start.vdot).toBeCloseTo(44.6, 1);
    expect(state.load.chronic).toBeCloseTo(25.2, 1);
    expect(d.baseLoad).toBeCloseTo(176, 0);
    expect(d.peakLoad).toBeCloseTo(245, 0);
    expect(d.doseCapSec['prag'] ?? 0).toBeCloseTo(26.9 * 60, -1);
    expect(d.doseCapSec['tempo-trke'] ?? 0).toBeCloseTo(36.7 * 60, -1);
    expect(d.doseCapSec['intervali'] ?? 0).toBeCloseTo(17.1 * 60, -1);
    expect(d.doseCapSec['dugi-blok'] ?? 0).toBeCloseTo(39.2 * 60, -1);
    expect(d.longMaxSec / 60).toBeCloseTo(103, 0);
    expect(d.longStartSec / 60).toBeCloseTo(58, 0);
    expect([d.warmupSec, d.cooldownSec]).toEqual([900, 600]);
    expect(d.qualityDays.slice(0, 2)).toEqual([3, 1]);
    expect(doc.weeks).toHaveLength(10);
    expect(doc.header.startDate).toBe('2026-11-16');
  });

  it('raspon na dan trke: 1:40:00 (1:38:25–1:41:59)', () => {
    const r = doc.header.form.raceDay;
    expect(Math.abs(r.expectedSec - 6000)).toBeLessThanOrEqual(2);
    expect(Math.abs(r.lowSec - 5905)).toBeLessThanOrEqual(2);
    expect(Math.abs(r.highSec - 6119)).toBeLessThanOrEqual(2);
  });

  it('nedelja 1: cilj = baza + dodatno opterećenje kvaliteta (krug 2, R5), prag 2 × 8 min, dugi 11,5 km, oko 30 km', () => {
    const week = doc.weeks[0];
    /* 176 BO baze (30 km × 5:52) + ≈ 19 BO koje nose prag i ubrzanja iznad laganog trčanja istog trajanja. */
    expect(week?.targetLoad).toBe(195);
    expect(onDate(doc, '2026-11-19')?.workout?.text).toContain('2 × 8 min');
    expect(onDate(doc, '2026-11-22')?.workout?.text).toBe('dugi 11,5 km');
    expect(onDate(doc, '2026-11-17')?.workout?.text).toContain('ubrzanja');
    const ctx = paceCtxOf(doc.header);
    const sums = (week?.days ?? []).map((x) => summarize(x.workout, ctx));
    const km = sums.reduce((a, s) => a + s.km, 0);
    const load = sums.reduce((a, s) => a + s.load, 0);
    /* Nedelja 1 nije ispod sadašnjeg obima (30 km). */
    expect(km).toBeGreaterThanOrEqual(30);
    expect(km).toBeLessThan(31.5);
    expect(Math.abs(load - 195)).toBeLessThan(4);
    expect(Math.round(sums[3]?.load ?? 0)).toBe(59);
  });

  it('ciljevi nedelja: osnova na bazi + kvalitet, zatim šablon; vrh je u 7. nedelji, čuvar bez nalaza', () => {
    /* 1–2. nedelja: baza + dodatno opterećenje (R5); 4. (rasterećenje): najviše 0,8 × cilj prethodne. */
    /* krug 4 (S2): lanac rasta meri km nedelje (u minutima laganog tempa), pa 5. nedelja posle rasterećenja raste
       od km 3. nedelje (212 → 220) */
    /* krug 8 (R8 t. 14): prvi trening zone ≤ 70 % planiranog vrha → manje dodatno opterećenje 5. nedelje (216) */
    const spec = [195, 199, 210, 168, 216, 235, 245, 208, 159, 86];
    doc.weeks.forEach((w, i) =>
      expect(
        Math.abs(w.targetLoad - (spec[i] ?? 0)),
        `${String(i + 1)}: ${doc.weeks.map((x) => x.targetLoad).join(',')}`
      ).toBeLessThanOrEqual(1)
    );
    expect(doc.weeks[6]?.intent.kind).toBe('peak');
    /* Dugi je udeo PLANIRANIH km te nedelje (R4, krug 5 E7: blok nosi više km), ne vrha: 13,5 km od 37 km. */
    expect(onDate(doc, '2027-01-03')?.workout?.text).toContain('13,5 km');
    expect(guard(doc, state, EXAMPLE)).toEqual([]);
  });
});

describe('SPEC § 12 (d): plan koji počinje dan posle trke od 1:41:00', () => {
  const race: Run = {
    id: 'trka',
    date: '2026-11-15',
    distanceM: 21097.5,
    durationSec: 6060,
    effort: 'race'
  };
  const { doc, state } = make(facts({ runs: [race] }));

  it('nema brzog rada pre 11. dana; prvi kvalitet je 26. 11. sa smanjenom dozom', () => {
    expect(state.lastHardEffort?.durationSec).toBe(6060);
    for (const day of days(doc)) {
      const n = diffDays(day.date, race.date);
      if (n <= 10) expect(fastSec(doc, day), day.date).toBe(0);
    }
    const first = days(doc).find((x) => fastSec(doc, x) > 0);
    expect(first?.date).toBe('2026-11-26');
    expect(first?.workout?.kind).toBe('quality');
    expect(first?.workout?.workSec ?? 0).toBeLessThan(20 * 60);
  });

  it('utorak 17. 11. je odmor (f < 0,5), četvrtak je lagan umesto kvaliteta, dugi je skraćen', () => {
    expect(onDate(doc, '2026-11-17')?.workout).toBeNull();
    expect(onDate(doc, '2026-11-19')?.workout?.kind).toBe('easy');
    const ctx = paceCtxOf(doc.header);
    const long = summarize(onDate(doc, '2026-11-22')?.workout ?? null, ctx);
    expect(long.km).toBeGreaterThanOrEqual(7);
    expect(long.km).toBeLessThanOrEqual(9);
    expect(onDate(doc, '2026-11-24')?.workout?.text).not.toContain('ubrzanja');
  });

  it('upozorenje `povratak` navodi do kada traje oporavak (15 dana) i datum prvog brzog treninga', () => {
    const w = doc.header.warnings.find((x) => x.code === 'povratak');
    expect(w?.problem).toContain('dan posle trke');
    expect(w?.meaning).toContain('do 30. 11. su i kraći');
    expect(w?.proposal).toContain('26. 11.');
    expect(doc.header.form.start.confidence).toBe('visoka');
  });

  it('ista formula: trka od 22 min daje 4 dana rampe, od 46 min 7 dana', () => {
    for (const [durationSec, distanceM, firstFastDay] of [
      [1320, 5000, 4],
      [2760, 10000, 7]
    ] as const) {
      const run: Run = { id: 'kratka', date: '2026-11-15', distanceM, durationSec, effort: 'race' };
      const made = make(
        facts({ runs: [run], availability: { runDays: [0, 1, 2, 3, 4, 5, 6], longDay: 6 } })
      );
      const first = days(made.doc).find((x) => fastSec(made.doc, x) > 0);
      expect(diffDays(first?.date ?? '', run.date), String(durationSec)).toBeGreaterThanOrEqual(
        firstFastDay
      );
    }
  });
});

describe('SPEC § 12 (b): bolest 7 dana u 5. nedelji', () => {
  const start = make(facts());
  const today = '2026-12-20';
  const state = buildState(
    {
      ...facts(),
      today,
      runs: runsAsPlanned(start.doc, '2026-12-13'),
      pauses: [{ from: '2026-12-14', to: today, reason: 'bolest' }]
    },
    GOAL,
    EXAMPLE
  );
  const events = deriveEvents(start.doc, state);
  const result = replan(start.doc, state, events, EXAMPLE);

  it('jedan događaj pauze sa determinističnim id', () => {
    expect(events.map((e) => e.id)).toEqual(['pause:2026-12-14:2026-12-20']);
    expect(result.doc.header.appliedEvents).toEqual(['pause:2026-12-14:2026-12-20']);
    expect(new Set(result.changes.map((c) => c.eventId)).size).toBe(1);
  });

  it('§ 14.6: rampa posle bolesti traje 14 dana; bez brzog rada dok je f < 0,8; utorak 22. 12. je odmor', () => {
    for (const day of days(result.doc)) {
      const n = diffDays(day.date, today);
      if (n >= 1 && n <= 9) expect(fastSec(result.doc, day), day.date).toBe(0);
    }
    expect(onDate(result.doc, '2026-12-22')?.workout).toBeNull();
    expect(onDate(result.doc, '2026-12-24')?.workout?.kind).toBe('easy');
    const pause = result.doc.header.adjustments?.find((a) => a.kind === 'pause');
    expect(pause).toMatchObject({ reason: 'bolest', from: '2026-12-14', to: today });
  });

  it('§ 14.6: dugi u rampi ≤ 75 % poslednjeg odrađenog i bez bloka; blok tek posle dugog bez bloka', () => {
    const ctx = paceCtxOf(result.doc.header);
    /* „Poslednji odrađeni dugi" = najduže trčanje u 28 dana pre pauze (dugi rasterećenja ne spušta plafon). */
    const lastDone = Math.max(
      ...['2026-11-22', '2026-11-29', '2026-12-06', '2026-12-13'].map(
        (date) => summarize(onDate(start.doc, date)?.workout ?? null, ctx).durationSec
      )
    );
    /* Plafon 75 % važi dok je f < 0,8 (27. 12.: n = 7, f = 0,70); 3. 1. (f = 1,0) određuju rampa i lanac. */
    const capped = onDate(result.doc, '2026-12-27')?.workout;
    expect(capped?.kind).toBe('long');
    expect(capped?.workSec).toBe(0);
    expect(summarize(capped ?? null, ctx).durationSec).toBeLessThanOrEqual(0.75 * lastDone + 1);
    expect(onDate(result.doc, '2027-01-03')?.workout?.workSec).toBe(0);
    const longs = days(result.doc).filter((x) => x.date > today && x.workout?.kind === 'long');
    const firstBlock = longs.findIndex((x) => (x.workout?.workSec ?? 0) > 0);
    if (firstBlock >= 0) {
      const plainBefore = longs
        .slice(0, firstBlock)
        .some((x) => summarize(x.workout, ctx).durationSec >= 0.9 * lastDone);
      expect(plainBefore).toBe(true);
    }
  });

  it('§ 14.6: rampa zavisi od razloga pauze (put 7, nepoznato 11, bolest i povreda 14 dana)', () => {
    for (const [reason, rampDays] of [
      ['put', 7],
      ['nepoznato', 11],
      ['povreda', 14]
    ] as const) {
      const st = buildState(
        {
          ...facts(),
          today,
          runs: runsAsPlanned(start.doc, '2026-12-13'),
          pauses: [{ from: '2026-12-14', to: today, reason }]
        },
        GOAL,
        EXAMPLE
      );
      const r = replan(start.doc, st, deriveEvents(start.doc, st), EXAMPLE);
      const text = r.changes.find((c) => c.scope === 'dan')?.reason ?? '';
      expect(text, reason).toContain(`treninzi su kraći do ${fmtDate(addDays(today, rampDays))}`);
      for (const day of days(r.doc)) {
        const n = diffDays(day.date, today);
        if (n >= 1 && n < (0.4 * rampDays) / 0.6)
          expect(fastSec(r.doc, day), `${reason} ${day.date}`).toBe(0);
      }
    }
  });

  it('urađene nedelje 1–4 i propuštena nedelja 5 su netaknute', () => {
    const before = new Map(days(start.doc).map((x) => [x.date, JSON.stringify(x)] as const));
    for (const day of days(result.doc)) {
      if (day.date <= today) expect(JSON.stringify(day), day.date).toBe(before.get(day.date));
    }
    expect(result.changes.every((c) => c.scope !== 'dan' || (c.dayId ?? '') > 'w5')).toBe(true);
  });

  it('ciljevi posle povratka rastu od stvarno odrađenog (pravilo rasta), poslednje dve nedelje ostaju', () => {
    const targets = result.doc.weeks.map((w) => w.targetLoad);
    const old = start.doc.weeks.map((w) => w.targetLoad);
    expect(targets.slice(0, 5)).toEqual(old.slice(0, 5));
    expect(targets[6] ?? 0).toBeLessThan(old[6] ?? 0);
    expect(targets[7] ?? 0).toBeLessThanOrEqual(old[7] ?? 0);
    expect(targets.slice(8)).toEqual(old.slice(8));
    expect(result.changes.some((c) => c.what === 'obim')).toBe(true);
  });

  it('objašnjenje kaže šta se desilo, šta je promenjeno i do kada', () => {
    const reason = result.changes.find((c) => c.scope === 'dan')?.reason ?? '';
    expect(reason).toContain('7 dana (14–20. 12.)');
    /* Tekst prati plan (krug 2, R9): do kada su treninzi kraći i kog dana je prvi brzi trening. */
    expect(reason).toContain('treninzi su kraći do 3. 1.');
    const first = days(result.doc).find(
      (d) => d.date > today && d.workout !== null && fastSec(result.doc, d) > 0
    );
    expect(first).toBeDefined();
    expect(reason).toContain(`prvi brzi trening je ${fmtDate(first?.date ?? '')}`);
  });
});

describe('blok u dugom se vraća posle rampe (presuda organizatora uz § 14.6)', () => {
  it('posle prvog dugog od ≥ 90 % (bez bloka) blok se vraća čim ga šablon traži', () => {
    const goal: Goal = { distanceId: EXAMPLE.id, raceDate: '2027-03-07' };
    const first = make(facts(), goal);
    const today = '2026-12-20';
    const state = buildState(
      {
        ...facts(),
        today,
        runs: runsAsPlanned(first.doc, '2026-12-13'),
        pauses: [{ from: '2026-12-14', to: today, reason: 'bolest' }]
      },
      goal,
      EXAMPLE
    );
    const result = replan(first.doc, state, deriveEvents(first.doc, state), EXAMPLE);
    const ctx = paceCtxOf(result.doc.header);
    const rampEnd = '2027-01-03';
    const lastLong = summarize(onDate(first.doc, '2026-12-06')?.workout ?? null, ctx).durationSec;
    const all = days(result.doc).filter((x) => x.date > rampEnd && x.workout?.kind === 'long');
    /* krug 4 (S9): nedelje posle rampe nisu veće nego pre pauze, pa prvi dugi ne mora odmah da stigne 90 %; blok
       se vraća posle PRVOG dugog bez bloka od ≥ 90 % poslednjeg pre pauze */
    const gateAt = all.findIndex(
      (x) =>
        summarize(x.workout, ctx).durationSec >= 0.9 * lastLong && (x.workout?.workSec ?? 0) === 0
    );
    expect(gateAt).toBeGreaterThanOrEqual(0);
    for (const day of all.slice(0, gateAt)) expect(day.workout?.workSec ?? 0, day.date).toBe(0);
    const after = all.slice(gateAt);
    const planned = (date: string): number => onDate(first.doc, date)?.workout?.workSec ?? 0;
    for (const day of after.slice(1)) {
      expect((day.workout?.workSec ?? 0) > 0, day.date).toBe(planned(day.date) > 0);
    }
    expect(after.some((x) => (x.workout?.workSec ?? 0) > 0)).toBe(true);
    for (const day of days(result.doc).filter((x) => x.date > today && x.date <= rampEnd)) {
      if (day.workout?.kind === 'long') expect(day.workout.workSec, day.date).toBe(0);
    }
  });
});

describe('SPEC § 14.1: ništa brzo 3 dana posle trke ili testa', () => {
  const everyDay = { runDays: [0, 1, 2, 3, 4, 5, 6] as const, longDay: 6 as const };

  it('test 3 km dan pre plana: prva 3 dana bez kvaliteta, bloka i ubrzanja', () => {
    const test: Run = {
      id: 'test',
      date: '2026-11-15',
      distanceM: 3000,
      durationSec: 780,
      effort: 'test'
    };
    /* 60 km nedeljno: sa 30 km na 7 dana kvalitet bi ustupio mesto laganim danima (krug 2, R4). */
    const { doc } = make(
      facts({
        runs: [test],
        availability: { runDays: [...everyDay.runDays], longDay: 6 },
        profile: { weeklyKm: 60, recentResult: { distanceM: HALF_M, timeSec: 6060 } }
      })
    );
    for (const day of days(doc)) {
      if (diffDays(day.date, test.date) <= 3) expect(fastSec(doc, day), day.date).toBe(0);
    }
    expect(days(doc).some((x) => diffDays(x.date, test.date) <= 7 && fastSec(doc, x) > 0)).toBe(
      true
    );
  });

  it('rezultat testa usred plana (replan): naredna 3 dana bez brzog rada', () => {
    const base = make(facts({ availability: { runDays: [...everyDay.runDays], longDay: 6 } }));
    const today = '2026-12-01';
    const test: Run = {
      id: 'test',
      date: today,
      distanceM: 3000,
      durationSec: 780,
      effort: 'test'
    };
    const state = buildState(
      {
        ...facts(),
        today,
        availability: { runDays: [...everyDay.runDays], longDay: 6 },
        runs: [...runsAsPlanned(base.doc, addDays(today, -1)), test]
      },
      GOAL,
      EXAMPLE
    );
    const result = replan(base.doc, state, deriveEvents(base.doc, state), EXAMPLE);
    for (const day of days(result.doc)) {
      const n = diffDays(day.date, today);
      if (n >= 1 && n <= 3) expect(fastSec(result.doc, day), day.date).toBe(0);
    }
  });

  it('test iz plana: prvi kvalitet najranije 4. dana posle njega', () => {
    const template = SYNTHETIC.templates[1];
    if (template === undefined) throw new Error('nema šablona');
    const withTest: DistanceData = {
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
    const goal: Goal = { distanceId: SYNTHETIC.id, raceDate: '2027-01-24' };
    const { doc } = make(
      facts({ availability: { runDays: [0, 1, 2, 3, 4, 5, 6], longDay: 6 } }),
      goal,
      withTest
    );
    const tests = days(doc).filter((x) => x.workout?.kind === 'test');
    expect(tests.length).toBeGreaterThan(2);
    for (const t of tests) {
      for (const day of days(doc)) {
        const n = diffDays(day.date, t.date);
        if (n >= 1 && n <= 3) expect(fastSec(doc, day), `${t.date} → ${day.date}`).toBe(0);
      }
    }
  });
});
