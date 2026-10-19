/* Segment 08g (5k-v2.8.0, Faza 4a N2–N4): imenovani primeri koji na f4b257d padaju + validator vidi mešovitu
   nedelju. Trajna rana mreža: segment08g.harness.node.test.ts (brz uzorak u segment08g.grid.node.test.ts, pun
   nivo u segment08g.{2,3,4,5}.full.node.test.ts).
   - N2a (pouka 23/29): lanac pauza 10 (sreda ned 2) → manjak — premeštanje testa iz koraka 1 se ne gubi.
   - N2b (pouka 23): sporiji rezultat u bazi — novi VDOT je nova osnova merenja R u km (odluka organizatora).
   - N3 (pouka 30): bol 8 kraj ned N − 2 — trkačka nedelja ≤ planirano tapera; višak laganih → odmor.
   - N4 (pouka 29): stanje doze iz upisanih dana (pauza usred nedelje: upisan dan kvaliteta pre pauze nije
     doza novog segmenta). */

import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays, weekdayOf } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import {
  earlyChain2,
  earlyChecks,
  earlyFacts,
  earlyGridInputs,
  type EarlyPlan,
  type EarlyScenario
} from './testInputs.ts';
import type { AdaptResult, FiveKV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { raceWeekRest } from './week.ts';

const S = JSON.stringify;
const planOf = (id: string): FiveKV2Plan => {
  const b = earlyGridInputs().find((x) => x.id === id)!;
  const g = generateFiveKV2(b.input);
  if (!g.ok) throw new Error(id);
  return g.plan as FiveKV2Plan;
};
const wed = (w: PlanWeek): string => {
  let d = w.startDate;
  while (weekdayOf(d) !== 'wed') d = addDays(d, 1);
  return d;
};
const run = (p: FiveKV2Plan, s: EarlyScenario, asOf: string): AdaptResult =>
  adaptFiveKV2(p, earlyFacts(p as unknown as EarlyPlan, s, asOf), asOf);
const errors = (r: AdaptResult): string[] =>
  r.ok
    ? []
    : r.violations.filter((v) => v.severity === 'error').map((v) => `${v.rule}: ${v.message}`);
const errRules = (p: FiveKV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const tests = (p: FiveKV2Plan): number[] =>
  p.weeks
    .filter((w) => w.days.some((d) => d.workout.qualityType === 'TEST_3K'))
    .map((w) => w.index);

describe('08g N2a — lanac pauza 10 → manjak: premeštanje testa se ne gubi (pouka 23, 29)', () => {
  const p = planOf('f-d4-6w-30km-e420-0');
  const at = wed(p.weeks[1]!);
  const r1 = run(p, 'chain', at);
  it('korak 1 (sreda ned 2): test 3 → 4', () => {
    expect(errors(r1)).toEqual([]);
    expect(r1.ok && tests(r1.plan)).toEqual([4]);
  });
  it('korak 2 (sreda ned 3, posle originalnog dana testa): prihvaćen, test ostaje u ned 4, oznaka ⇔ trening', () => {
    if (!r1.ok) throw new Error('korak 1');
    const at2 = addDays(at, 7);
    const r2 = adaptFiveKV2(r1.plan, earlyChain2(p as unknown as EarlyPlan, at2), at2);
    expect(errors(r2)).toEqual([]);
    if (!r2.ok) return;
    expect(tests(r2.plan)).toEqual([4]);
    expect(r2.plan.weeks.filter((w) => w.test).map((w) => w.index)).toEqual([4]);
  });
});

describe('08g N2b — sporiji rezultat u bazi: jedinica doze i plafon ispred progresije (odluka organizatora D)', () => {
  it('(i) r-d5-14w-60km-v32-1, sreda ned 3: plafon R 2,34 km < 2,40 km → R 2,10 km, napomena + upozorenje DOSE_DROPPED', () => {
    const p = planOf('r-d5-14w-60km-v32-1');
    const r = run(p, 'slower', wed(p.weeks[2]!));
    expect(errors(r)).toEqual([]);
    if (!r.ok) return;
    expect(r.plan.warnings.filter((w) => w.rule === 'DOSE_DROPPED').map((w) => w.week)).toEqual([
      5
    ]);
    expect(r.plan.weeks[4]!.notes.some((n) => n.includes('DOSE_DROPPED'))).toBe(true);
    expect(r.plan.weeks.filter((w) => w.notes.some((n) => n.includes('DOSE_DROPPED'))).length).toBe(
      1
    );
  });
  it('(i) plafon dozvoljava prethodnu R, a R padne → i dalje BASE_R_DECREASE', () => {
    const p = planOf('r-d5-14w-60km-v32-1');
    const t = JSON.parse(S(p)) as FiveKV2Plan;
    const w5 = t.weeks[4]!;
    const q = w5.days.find((d) => d.role === 'q1')!.workout;
    q.blocks = q.blocks.map((b) =>
      b.kind === 'reps' && b.zone === 'R' ? { ...b, reps: b.reps - 1 } : b
    );
    expect(errRules(t)).toContain('BASE_R_DECREASE');
    expect(validatePlan(t).map((v) => v.rule)).not.toContain('DOSE_DROPPED');
  });
  it('(ii) b-d3-16w-20km-v32-1, sreda ned 4: usponi po vremenu 270 s → 300 s (km 0,63 → 0,60 nije doza) → prihvaćen, bez DOSE_DROPPED', () => {
    const p = planOf('b-d3-16w-20km-v32-1');
    const r = run(p, 'slower', wed(p.weeks[3]!));
    expect(errors(r)).toEqual([]);
    if (r.ok) expect(r.plan.warnings.map((w) => w.rule)).not.toContain('DOSE_DROPPED');
  });
  it('(ii) doza po vremenu koja zaista padne → BASE_R_DECREASE', () => {
    const p = planOf('b-d3-16w-20km-v32-1');
    const r = run(p, 'slower', wed(p.weeks[3]!));
    if (!r.ok) throw new Error('osnova');
    const t = JSON.parse(S(r.plan)) as FiveKV2Plan;
    const w7 = t.weeks[6]!;
    const q = w7.days.find((d) => d.workout.qualityType === 'HILLS')!.workout;
    q.blocks = q.blocks.map((b) => (b.kind === 'reps' && b.zone === 'R' ? { ...b, reps: 1 } : b));
    expect(errRules(t)).toContain('BASE_R_DECREASE');
  });
});

describe('08g pouka 36 — umor vezan za zapise: isti zapisi ponovo ne prave novo rasterećenje', () => {
  for (const [id, wk] of [
    ['f-d4-6w-40km-e300-1', 2],
    ['r-d4-10w-30km-v45-0', 3]
  ] as const)
    it(`${id}, umor kraj ned ${wk}: isti zapisi asOf + 1 … + 7 → 0 novih rasterećenja`, () => {
      const p = planOf(id);
      const at = p.weeks[wk - 1]!.endDate;
      const facts = earlyFacts(p as unknown as EarlyPlan, 'fatigue', at);
      const r1 = adaptFiveKV2(p, facts, at);
      expect(errors(r1)).toEqual([]);
      if (!r1.ok) return;
      const dl = (x: FiveKV2Plan): number => x.weeks.filter((w) => w.deload).length;
      for (let k = 1; k <= 7; k++) {
        const r2 = adaptFiveKV2(r1.plan, facts, addDays(at, k));
        expect(errors(r2)).toEqual([]);
        if (r2.ok) expect([k, dl(r2.plan)]).toEqual([k, dl(r1.plan)]);
      }
    });
});

describe('08g N3 — trkačka nedelja ≤ planirano tapera (pouka 30)', () => {
  const p = planOf('r-d3-9w-20km-v45-1');
  const at = p.weeks[6]!.endDate;
  const r = run(p, 'pain8', at);
  it('bol 8 kraj ned 7: taper 7,9 km, trkačka 9,3 → 6,6 km (najraniji lagan postaje odmor)', () => {
    expect(errors(r)).toEqual([]);
    if (!r.ok) return;
    const [taper, race] = r.plan.weeks.slice(-2) as [PlanWeek, PlanWeek];
    expect(taper.plannedKm).toBe(7.9);
    expect(race.plannedKm).toBe(6.6);
    expect(race.raceRest).toEqual([race.startDate]);
    expect(race.days.some((d) => d.role === 'race')).toBe(true);
    expect(race.days.some((d) => addDays(d.date, 1) === p.input.raceDate)).toBe(true);
    expect(earlyChecks(p as unknown as EarlyPlan, r.plan as unknown as EarlyPlan, at, {})).toEqual(
      []
    );
  });
  it('raceWeekRest: prvo dani bola, pa najraniji lagani; dan pred trku i trka nikad; prazno kad ne staje', () => {
    if (!r.ok) throw new Error('N3');
    const p0 = p.weeks[8]!;
    const race = p.input.raceDate;
    const easy = p0.days
      .filter((d) => d.role === 'easy' && addDays(d.date, 1) !== race)
      .map((d) => d.date);
    expect(raceWeekRest(p0.days, race, new Set(), p0.plannedKm)).toEqual([]);
    expect(raceWeekRest(p0.days, race, new Set(), 7.9)).toEqual([easy[0]]);
    // Dan bola ima prednost pred najranijim laganim (sintetički drugi lagan dan posle prvog).
    const e0 = p0.days.find((d) => d.date === easy[0])!;
    const extra = { ...e0, date: addDays(e0.date, 1) };
    const days2 = [...p0.days, extra].sort((a, b) => a.date.localeCompare(b.date));
    const cap = Math.round((p0.plannedKm + extra.workout.km - e0.workout.km) * 100) / 100;
    expect(raceWeekRest(days2, race, new Set(), cap)).toEqual([e0.date]);
    expect(raceWeekRest(days2, race, new Set([extra.date]), cap)).toEqual([extra.date]);
    expect(raceWeekRest(days2, race, new Set([addDays(race, -1)]), cap)).toEqual([e0.date]);
    expect(raceWeekRest(p0.days, race, new Set(), 1)).toEqual([]);
  });
  it('validator: trkačka > taper → RACE_WEEK_TAPER; skraćena ispod minimuma → upozorenje RACE_WEEK_SHORT', () => {
    if (!r.ok) throw new Error('N3');
    const t = JSON.parse(S(r.plan)) as FiveKV2Plan;
    const rw = t.weeks[t.weeks.length - 1]!;
    rw.days = rw.days.map((d) =>
      d.role === 'easy' && addDays(d.date, 1) !== p.input.raceDate
        ? {
            ...d,
            workout: {
              ...d.workout,
              km: d.workout.km + 2,
              segments: d.workout.segments.map((x, i) => (i === 0 ? { ...x, km: x.km + 2 } : x))
            }
          }
        : d
    );
    rw.plannedKm =
      Math.round(rw.days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0) * 100) / 100;
    rw.targetKm = rw.plannedKm;
    expect(errRules(t)).toContain('RACE_WEEK_TAPER');
    const u = JSON.parse(S(r.plan)) as FiveKV2Plan;
    const uw = u.weeks[u.weeks.length - 1]!;
    uw.days = uw.days.filter((d) => d.role !== 'easy' || addDays(d.date, 1) === p.input.raceDate);
    uw.raceRest = [
      ...new Set([
        ...uw.raceRest!,
        ...r.plan.weeks[8]!.days.filter(
          (d) => d.role === 'easy' && addDays(d.date, 1) !== p.input.raceDate
        ).map((d) => d.date)
      ])
    ].sort();
    uw.plannedKm = uw.targetKm =
      Math.round(uw.days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0) * 100) / 100;
    expect(uw.plannedKm).toBeLessThan(P.week.minRaceWeekKm);
    const v = validatePlan(u);
    expect(v.filter((x) => x.severity === 'error').map((x) => x.rule)).not.toContain(
      'WEEK_MIN_VOLUME'
    );
    expect(v.map((x) => x.rule)).toContain('RACE_WEEK_SHORT');
    delete uw.raceRest;
    expect(errRules(u)).toContain('WEEK_MIN_VOLUME');
  });
});

describe('08g N4 — stanje zavisno od prošlosti iz upisanih dana (pouka 29)', () => {
  it('r-d3-13w-20km-v32-1, pauza 10 sreda ned 5: upisan I ned 5 (pre pauze) nije doza novog segmenta — ned 7 kreće iznova', () => {
    const p = planOf('r-d3-13w-20km-v32-1');
    const at = wed(p.weeks[4]!);
    const r = run(p, 'pause10', at);
    expect(errors(r)).toEqual([]);
    if (!r.ok) return;
    expect(r.plan.adaptation!.mixedWeeks).toContain(5);
    const q1 = (w: PlanWeek): string =>
      w.days.find((d) => d.role === 'q1')!.workout.title.split(' (')[0]!;
    // Upisan dan kvaliteta ned 5 = dan prethodnog plana (≤ asOf); f4b257d je progresiju ned 7 vodio od sastavljene
    // (neupisane) doze ned 5 → I 2 × 700 m; posle: nov segment od asOf + 1 → I 2 × 600 m (prvi izbor bez prethodne).
    expect(q1(r.plan.weeks[4]!)).toBe(q1(p.weeks[4]!));
    expect(q1(r.plan.weeks[6]!)).toBe('I: 2 × 600 m');
  });
});

describe('08g N4 — validator ne preskače mešovitu nedelju (pouka 29)', () => {
  const p = planOf('r-d4-10w-30km-v45-0');
  const r = run(p, 'pain5', p.weeks[0]!.endDate);
  if (!r.ok) throw new Error('osnova');
  const steadyPair = (pl: FiveKV2Plan): [number, number] => {
    const st = pl.weeks.filter(
      (w) =>
        ['base', 'peak', 'sharpen'].includes(w.phase) && !w.deload && !w.test && !w.limits?.quality
    );
    for (let i = 1; i < st.length; i++)
      if (st[i]!.phase === st[i - 1]!.phase && st[i]!.index === st[i - 1]!.index + 1)
        return [st[i - 1]!.index, st[i]!.index];
    throw new Error('nema para');
  };
  it('isti par kvaliteta posle mešovite nedelje → QUALITY_REPEAT', () => {
    const t = JSON.parse(S(r.plan)) as FiveKV2Plan;
    const [m, n] = steadyPair(t);
    t.adaptation!.mixedWeeks = [m];
    const M = t.weeks[m - 1]!;
    const N = t.weeks[n - 1]!;
    const qm = M.days.filter((d) => d.workout.kind === 'quality');
    let i = 0;
    N.days = N.days.map((d) =>
      d.workout.kind === 'quality' && i < qm.length ? { ...d, workout: qm[i++]!.workout } : d
    );
    N.plannedKm =
      Math.round(N.days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0) * 100) / 100;
    expect(errRules(t)).toContain('QUALITY_REPEAT');
  });
  it('lagan trkačke nedelje > 50 % dugog mešovite nedelje tapera → RACE_WEEK_EASY', () => {
    const t = JSON.parse(S(r.plan)) as FiveKV2Plan;
    const N = t.weeks.length;
    t.adaptation!.mixedWeeks = [N - 1];
    const rw = t.weeks[N - 1]!;
    const e = rw.days.find((d) => d.role === 'easy' && addDays(d.date, 1) !== p.input.raceDate)!;
    const k = 4;
    e.workout = {
      ...e.workout,
      km: e.workout.km + k,
      segments: e.workout.segments.map((x, i) => (i === 0 ? { ...x, km: x.km + k } : x))
    };
    expect(errRules(t)).toContain('RACE_WEEK_EASY');
  });
  it('oznaka testa ⇔ trening i u mešovitoj nedelji → TEST_WEEK', () => {
    const f = planOf('f-d4-10w-30km-e420-0');
    const rf = run(f, 'pain5', f.weeks[0]!.endDate);
    if (!rf.ok) throw new Error('osnova F');
    const t = JSON.parse(S(rf.plan)) as FiveKV2Plan;
    const tw = t.weeks.find((w) => w.test)!;
    t.adaptation!.mixedWeeks = [tw.index];
    tw.test = false;
    expect(errRules(t)).toContain('TEST_WEEK');
  });
});

describe('08g pouka 36 (precizno) — rasterećenje = nedelja posle nedelje poslednjeg zapisa umora', () => {
  const p = planOf('r-d4-10w-30km-v45-0');
  const w1 = p.weeks[0]!;
  const easy = w1.days.filter((d) => d.role === 'easy' || d.role === 'long').slice(-2);
  const facts = {
    workouts: easy.map((d) => ({
      date: d.date,
      dayId: d.date,
      km: d.workout.km,
      durationSec: d.workout.sec,
      completed: true,
      rpe: 8
    }))
  };
  const sun = w1.endDate;
  const mon = addDays(sun, 1);
  const rs = adaptFiveKV2(p, facts, sun);
  const rm = adaptFiveKV2(p, facts, mon);
  it('zapisi iz ned 1, asOf ponedeljak ned 2 → rasterećenje tekuće nedelje 2 (ostatak)', () => {
    expect(errors(rm)).toEqual([]);
    if (!rm.ok) return;
    expect(rm.plan.weeks[1]!.deload).toBe(true);
    expect(rm.plan.adaptation!.steps[0]!.deloadWeek).toBe(2);
  });
  it('isti zapisi u nedelju i u ponedeljak → isto rasterećenje i isti ciljevi, isti dani posle ponedeljka', () => {
    expect(errors(rs)).toEqual([]);
    if (!rs.ok || !rm.ok) return;
    expect(rm.plan.weeks.map((w) => [w.deload, w.targetKm])).toEqual(
      rs.plan.weeks.map((w) => [w.deload, w.targetKm])
    );
    const after = (x: FiveKV2Plan) => x.weeks.flatMap((w) => w.days.filter((d) => d.date > mon));
    expect(S(after(rm.plan))).toBe(S(after(rs.plan)));
  });
});

describe('08g MAR-07 nalaz u 5K — zaključan dan kvaliteta u nedelji posle novog rezultata', () => {
  // f4b257d: 47 / 5184 odbijeno (QUALITY_REPEAT 42, BASE_R_DECREASE 5); zaključan budući dan je činjenica —
  // lanac doze i oznaka testa ga ne porede (kao LIMITS).
  for (const [id, k, s] of [
    ['r-d3-12w-16km-v38-0', 1, 'faster'],
    ['f-d3-6w-16km-e360-0', 2, 'test5k']
  ] as const)
    it(`${id}, ${s} kraj ned ${k} + zaključan Q1 ned ${k + 1} → prihvaćen, dan zadržan`, () => {
      const p = planOf(id);
      const at = p.weeks[k - 1]!.endDate;
      const q1 = p.weeks[k]!.days.find((d) => d.workout.kind === 'quality')!;
      const r = adaptFiveKV2(
        p,
        { ...earlyFacts(p as unknown as EarlyPlan, s, at), lockedDayIds: [q1.date] },
        at
      );
      expect(errors(r)).toEqual([]);
      if (r.ok) expect(S(r.plan.weeks[k]!.days.find((d) => d.date === q1.date))).toBe(S(q1));
    });
});
