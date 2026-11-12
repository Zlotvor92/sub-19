import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isValidDate, mondayOf, weekdayOf } from './dates';
import { assignDays } from './decide';
import { buildState, canonical, fingerprint, paceCtxOf, summarize } from './index';
import { rollDay, runLoad } from './load';
import { expandTemplate } from './template';
import { build, facts, goalAt, runsAsPlanned } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type { Run, Workout } from './types';
import { zonePaces } from './vdot';

describe('datumi', () => {
  it('validnost, dan u nedelji, ponedeljak, razlika', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-2-3')).toBe(false);
    expect(weekdayOf('2026-11-16')).toBe(0);
    expect(weekdayOf('2027-01-24')).toBe(6);
    expect(mondayOf('2027-01-24')).toBe('2027-01-18');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2027-01-24', '2026-11-16')).toBe(69);
  });
});

describe('raspored dana (SPEC § 4.6)', () => {
  it('Q1 je najdalji od dugog (izjednačeno: kasniji), Q2 najdalji od oba (izjednačeno: raniji)', () => {
    expect(assignDays([1, 3, 5, 6], 6)).toEqual([3, 1, 5]);
    expect(assignDays([0, 2, 4, 6], 6)).toEqual([2, 4, 0]);
    expect(assignDays([6], 6)).toEqual([]);
    expect(assignDays([0, 1, 2, 3, 4, 5, 6], 6)).toHaveLength(6);
  });
});

describe('razvijanje šablona (SPEC § 4.2)', () => {
  const template = SYNTHETIC.templates[1];
  if (template === undefined) throw new Error('nema šablona');

  it('N nedelja za svako N 1–52; rep je kraj šablona; poslednja je nedelja trke', () => {
    for (let n = 1; n <= 52; n += 1) {
      const intents = expandTemplate(template, n);
      expect(intents).toHaveLength(n);
      expect(intents.at(-1)?.kind).toBe('race');
      const tail = template.tail.slice(-Math.min(n, template.tail.length)).map((t) => t.kind);
      expect(intents.slice(-tail.length).map((t) => t.kind)).toEqual(tail);
    }
  });

  it('rasterećenje je svaka 4. nedelja tela brojano unazad od repa i ne troši mesto u ciklusu', () => {
    const intents = expandTemplate(template, 14);
    const body = intents.slice(0, 11);
    const fromTail = (i: number): number => body.length - i;
    body.forEach((w, i) => expect(w.kind === 'recovery', String(i)).toBe(fromTail(i) % 4 === 0));
    const recovery = body[3];
    const previous = body[2];
    expect(recovery?.loadPct).toBeCloseTo((previous?.loadPct ?? 0) * 0.8, 10);
    expect(recovery?.long?.lenPct).toBeCloseTo((previous?.long?.lenPct ?? 0) * 0.8, 10);
    expect(body.filter((w) => w.phase === 'osnova')).toHaveLength(6);
    expect(body.filter((w) => w.phase === 'posebna')).toHaveLength(5);
  });
});

describe('opterećenje i kilometri (SPEC § 5)', () => {
  const paces = zonePaces(44.6, 21097.5, false);
  const ctx = { paces, vdot: 44.6 };

  it('kvalitet iz primera: 15 min + prag 2 × 8 min (oporavak 1:30) + 10 min = 43 min, 59 bodova', () => {
    const workout: Workout = {
      kind: 'quality',
      stimulus: 'prag',
      workSec: 960,
      steps: [
        { role: 'warmup', target: { type: 'zone', zone: 'E' }, extent: { durationSec: 900 } },
        {
          repeat: 1,
          steps: [
            { role: 'work', target: { type: 'zone', zone: 'T' }, extent: { durationSec: 480 } },
            { role: 'recovery', target: { type: 'zone', zone: 'E' }, extent: { durationSec: 90 } }
          ]
        },
        { role: 'work', target: { type: 'zone', zone: 'T' }, extent: { durationSec: 480 } },
        { role: 'cooldown', target: { type: 'zone', zone: 'E' }, extent: { durationSec: 600 } }
      ],
      text: 'prag 2 × 8 min'
    };
    const s = summarize(workout, ctx);
    expect(Math.round(s.durationSec / 60)).toBe(43);
    expect(s.load).toBeCloseTo(58.5, 1);
    expect(s.workSec).toBe(960);
    expect(summarize(null, ctx)).toMatchObject({ km: 0, load: 0, durationSec: 0 });
  });

  it('tempo trke nema stalnu težinu: iz odnosa prema pragu, na 0,05', () => {
    const step = (zone: 'RP' | 'T' | 'E'): Workout => ({
      kind: 'quality',
      stimulus: null,
      workSec: 600,
      steps: [{ role: 'work', target: { type: 'zone', zone }, extent: { durationSec: 600 } }],
      text: 'x'
    });
    expect(summarize(step('RP'), ctx).load).toBeCloseTo(18, 1);
    expect(summarize(step('T'), ctx).load).toBe(20);
    expect(summarize(step('E'), ctx).load).toBe(10);
  });

  it('hod se računa po 9:00/km i pola težine, stajanje ne daje kilometre', () => {
    const rest = (rpe: number): Workout => ({
      kind: 'other',
      stimulus: null,
      workSec: 0,
      steps: [{ role: 'recovery', target: { type: 'effort', rpe }, extent: { durationSec: 540 } }],
      text: 'x'
    });
    expect(summarize(rest(2), ctx)).toMatchObject({ km: 1, load: 4.5 });
    expect(summarize(rest(1), ctx)).toMatchObject({ km: 0, load: 4.5 });
  });

  it('odrađeno trčanje: krugovi, pa km, pa prosečan tempo', () => {
    const base: Run = { id: 'r', date: '2026-11-10', distanceM: 10000, durationSec: 3520 };
    expect(runLoad(base, paces.T)).toBeCloseTo(3520 / 60, 1);
    const withLaps: Run = {
      ...base,
      laps: [
        { role: 'other', distanceM: 3000, durationSec: 1056 },
        { role: 'work', distanceM: 4000, durationSec: 1120 },
        { role: 'other', distanceM: 3000, durationSec: 1056 }
      ]
    };
    expect(runLoad(withLaps, paces.T)).toBeCloseTo(1056 / 60 + (1120 / 60) * 2 + 1056 / 60, 0);
  });

  it('baza i umor: sredine 42 i 7 dana', () => {
    let s = { chronic: 25, acute: 25 };
    for (let i = 0; i < 7; i += 1) s = rollDay(s, 0);
    expect(s.chronic).toBeCloseTo(25 * (41 / 42) ** 7, 10);
    expect(s.acute).toBeCloseTo(25 * (6 / 7) ** 7, 10);
  });
});

describe('stanje (SPEC § 2)', () => {
  it('bez trčanja: baza iz izjave, `seeded`; bez ičega: dani × najkraće lagano', () => {
    const goal = goalAt('2027-01-24');
    const declared = buildState(facts(), goal, SYNTHETIC);
    expect(declared.load.seeded).toBe(true);
    expect(declared.load.chronic * 7).toBeCloseTo((30 * 352) / 60, 0);
    const empty = buildState(facts({ profile: {} }), goal, SYNTHETIC);
    expect(empty.load.chronic * 7).toBeCloseTo((4 * SYNTHETIC.safety.minEasySec) / 60, 6);
    expect(empty.form.current).toMatchObject({ vdot: 30, confidence: 'niska' });
  });

  it('12 nedelja, najduže skorašnje, poslednji pun napor', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    const today = '2026-12-13';
    const state = buildState(
      { ...b.facts, today, runs: runsAsPlanned(b.doc, today) },
      b.goal,
      SYNTHETIC
    );
    expect(state.weeks).toHaveLength(12);
    expect(state.weeks.at(-1)?.start).toBe('2026-12-07');
    expect(state.weeks.at(-1)?.runs).toBe(4);
    expect(state.longestRecentSec).toBeGreaterThan(4000);
    expect(state.lastHardEffort).toBeNull();
    expect(state.load.seeded).toBe(false);
    expect(state.load.acute).toBeGreaterThan(0);
  });
});

describe('otisak i kanonska serijalizacija (SPEC § 9.2)', () => {
  const b = build(facts(), goalAt('2027-01-24'));

  it('red po danu: datum | odmor? | vrsta | km | tekst | urađeno | zaključano | ručno', () => {
    const f = { ...b.facts, runs: runsAsPlanned(b.doc, '2026-11-19') };
    const lines = fingerprint(b.doc, f).split('\n');
    expect(lines).toHaveLength(b.doc.weeks.flatMap((w) => w.days).length);
    expect(lines[0]).toBe('2026-11-16 | odmor | - | 0.0 |  | - | - | -');
    expect(lines[3]).toMatch(
      /^2026-11-19 \| trening \| quality \| \d+\.\d \| prag 2 × 7 min, oporavak 1:30 min džog \| urađeno \| - \| -$/
    );
    expect(fingerprint(b.doc, b.facts)).not.toBe(fingerprint(b.doc, f));
  });

  it('kanonski zapis ne zavisi od redosleda ključeva', () => {
    expect(canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonical({ a: [{ c: 3, d: 2 }], b: 1 }));
    expect(canonical({ a: undefined, b: 1 })).toBe('{"b":1}');
    const ctx = paceCtxOf(b.doc.header);
    expect(ctx.paces).toEqual(b.doc.header.paces);
  });
});
