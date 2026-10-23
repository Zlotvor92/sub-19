/* HM v2 Segment 04 (hm-v2.3.0, H18): adaptacija — assess → isti konstruktor → upisani plan (pouka 29) → validate.
   Po jedan test za odluke A1–A15, A17, A18, pouka 7 (a–g) i posebni testovi pouka 16–20, 22, 23, 29, 30, 31.
   Mreže: grid04.node.test.ts (mreža 04, MASTER § 3) i earlyGrid.node.test.ts (rana i srednja adaptacija). */

import { describe, expect, it } from 'vitest';
import { adaptHmV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { adaptBases, factsOf, painFacts, runsIn } from './adaptInputs.ts';
import { addDays, mustDay, weekdayOf } from './dates.ts';
import { construct, generateHmV2 } from './generate.ts';
import { round1, vdotFromResult } from './paces.ts';
import { deloadAllowed, isBuildPhase, periodize, rePeriodize } from './periodize.ts';
import { HM_V2_POLICY as P, dayRule } from './policy.ts';
import { newLimits } from './steps.ts';
import { beginnerInputs, feelInputs, grid02Inputs } from './testInputs.ts';
import type { AdaptResult, HmV2Facts, HmV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';

const A = P.adapt;
const bases = adaptBases();
const plans = new Map<string, HmV2Plan>();
const plan = (id: string): HmV2Plan => {
  let p = plans.get(id);
  if (!p) {
    const b = [...bases, ...grid02Inputs(), ...feelInputs(), ...beginnerInputs()].find(
      (x) => x.id === id
    );
    if (!b) throw new Error(id);
    const r = generateHmV2(b.input);
    if (!r.ok) throw new Error(`${id}: ${JSON.stringify(r.reasons)}`);
    plans.set(id, (p = r.plan));
  }
  return p;
};
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
  return r;
};
const wed = (p: HmV2Plan, i: number): string => {
  let d = p.weeks[i - 1]!.startDate;
  while (weekdayOf(d) !== 'wed') d = addDays(d, 1);
  return d;
};
const end = (p: HmV2Plan, i: number): string => p.weeks[i - 1]!.endDate;
const isBuild = (w: PlanWeek): boolean => isBuildPhase(w.phase);
const applied = (r: AdaptResult, c: string): boolean =>
  r.ok && r.reasons.some((x) => x.condition === c && x.applied);
const sameWeeks = (a: HmV2Plan, b: HmV2Plan, from = 1): boolean =>
  a.weeks.every((w, i) => i + 1 < from || JSON.stringify(w) === JSON.stringify(b.weeks[i]));
const quality = (w: PlanWeek): number => w.days.filter((d) => d.workout.kind === 'quality').length;
const adapt = (p: HmV2Plan, facts: unknown, asOf: string) => {
  const r = ok(adaptHmV2(p, facts, asOf));
  expect(adaptInvariants(p, r.plan, asOf, facts as HmV2Facts)).toEqual([]);
  return r;
};

describe('pouka 7', () => {
  it('(a) posle pauze cilj raste +10 %/ned do nivoa pre pauze — ne ravno do trke i ne skokom; nikad sporije od H6', () => {
    for (const id of ['d4-r-18w', 'd5-f-18w', 'd3-r-14w']) {
      const p = plan(id);
      const asOf = wed(p, 6);
      const r = adapt(p, factsOf(p, 'pause20', asOf), asOf);
      const st = r.plan.adaptation!.steps[0]!;
      const level = st.levelKm!;
      let last = r.plan.weeks[st.fromWeek - 1]!.targetKm;
      let reached = false;
      for (const w of r.plan.weeks.filter(
        (x) => isBuild(x) && !x.deload && x.index > st.fromWeek
      )) {
        const ret = Math.max(A.returnGrowthMinKm, round1(last * A.returnGrowth));
        const h6 = Math.min(
          P.volume.growthMaxKm,
          Math.max(P.volume.growthMinKm, round1(last * P.volume.growth))
        );
        if (last < level) {
          expect(w.targetKm, `${id} ned ${w.index}`).toBeGreaterThan(last);
          expect(w.nominalKm, `${id} ned ${w.index}`).toBeLessThanOrEqual(
            Math.max(Math.min(level, last + ret), last + h6) + 0.05
          );
        } else reached = true;
        last = w.targetKm;
      }
      // 18 ned: nivo dostignut pre tapera; 14 ned (3 dana) raste do kraja izgradnje.
      expect(reached, id).toBe(id.endsWith('18w'));
    }
  });

  it('(b) cilj nikad ispod minimuma nedelje (A9): pauza 35 posle malog obima → cilj = minimum nedelje', () => {
    const p = plan('d3-r-10w');
    const asOf = end(p, 2);
    const facts = {
      workouts: runsIn(p, addDays(asOf, -48), addDays(asOf, -35), 0.2),
      coverage: { from: addDays(asOf, -48), to: asOf, complete: true }
    };
    const r = adapt(p, facts, asOf);
    const min = dayRule(3)!.weekMinKm;
    expect(r.plan.adaptation!.steps[0]!.startKm).toBe(min);
    for (const w of r.plan.weeks)
      if (w.phase !== 'race') expect(w.targetKm, `ned ${w.index}`).toBeGreaterThanOrEqual(min);
  });

  it('(c) nepotpun zapis bez coverage (i sa complete = false) ≠ pauza ni manjak: plan isti', () => {
    const p = plan('d4-r-14w');
    const asOf = wed(p, 6);
    const workouts = runsIn(p, addDays(asOf, -13), asOf).slice(0, 2);
    for (const coverage of [undefined, { from: addDays(asOf, -13), to: asOf, complete: false }]) {
      const r = adapt(p, { workouts, ...(coverage ? { coverage } : {}) }, asOf);
      expect(r.reasons.filter((x) => x.applied).map((x) => x.condition)).toEqual([]);
      expect(sameWeeks(p, r.plan)).toBe(true);
    }
  });

  it('(d) eksplicitna pauza radi bez zapisa i bez coverage', () => {
    const p = plan('d5-r-14w');
    const asOf = end(p, 8);
    const r = adapt(p, { breaks: [{ kind: 'break', from: addDays(asOf, -19), to: asOf }] }, asOf);
    expect(applied(r, 'PAUSE')).toBe(true);
    const ps = mustDay(addDays(asOf, -19));
    const pw = p.weeks.find((w) => mustDay(w.startDate) <= ps && ps <= mustDay(w.endDate))!;
    expect(r.plan.adaptation!.steps[0]!.startKm).toBe(round1(A.pause.midShare * pw.targetKm));
  });

  it('(e) prioritet: bol uvek (po datumima) > pauza > umor > izvršenje', () => {
    const p = plan('d4-r-14w');
    const asOf = wed(p, 6);
    const back = (n: number): string => addDays(asOf, -n);
    const r = adapt(
      p,
      {
        workouts: [
          ...runsIn(p, back(33), back(20)),
          { date: back(1), km: 0, durationSec: 0, completed: false, pain: 5 },
          { date: back(25), km: 6, durationSec: 2400, completed: true, rpe: 8 }
        ],
        coverage: { from: back(33), to: asOf, complete: true }
      },
      asOf
    );
    expect(Object.fromEntries(r.reasons.map((x) => [x.condition, x.applied]))).toEqual({
      PAIN: true,
      PAUSE: true,
      UNDER_EXECUTION: false
    });
    const r2 = adapt(
      p,
      {
        workouts: [
          ...runsIn(p, back(13), back(7)),
          ...runsIn(p, back(6), asOf, 0.3),
          { date: back(1), km: 6, durationSec: 2400, completed: true, rpe: 8 },
          { date: back(2), km: 6, durationSec: 2400, completed: true, rpe: 8, pain: 4 }
        ],
        coverage: { from: back(13), to: asOf, complete: true }
      },
      asOf
    );
    expect(Object.fromEntries(r2.reasons.map((x) => [x.condition, x.applied]))).toEqual({
      PAIN: true,
      FATIGUE: true,
      UNDER_EXECUTION: false
    });
  });

  it('(f) zaštita: prošlost, urađeno i zaključano bajt-isto; završna zaštita samo proverava', () => {
    const p = plan('d4-f-14w');
    const asOf = wed(p, 6);
    const future = p.weeks
      .flatMap((w) => w.days)
      .filter((d) => mustDay(d.date) > mustDay(asOf) && d.role !== 'race')
      .slice(0, 4)
      .map((d) => d.date);
    const r = adapt(
      p,
      {
        workouts: runsIn(p, addDays(asOf, -9), addDays(asOf, -9)),
        breaks: [{ kind: 'break', from: addDays(asOf, -8), to: asOf }],
        lockedDayIds: future
      },
      asOf
    );
    const after = new Map(r.plan.weeks.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
    for (const w of p.weeks)
      for (const d of w.days)
        if (mustDay(d.date) <= mustDay(asOf) || future.includes(d.date))
          expect(JSON.stringify(after.get(d.date)), d.date).toBe(JSON.stringify(d));
    expect(r.plan.adaptation!.lockedDayIds).toEqual(future);
    expect(r.plan.adaptation!.mixedWeeks.length).toBeGreaterThan(0);
  });

  it('(g) taper posle smanjenja = 0,7 × najveći cilj izgradnje posle smanjenja, nije veći od poslednje nedelje izgradnje', () => {
    for (const s of ['pause10', 'pause20', 'pause35', 'under50', 'pain8'] as const)
      for (const id of ['d3-r-10w', 'd4-f-14w', 'd6-r-18w', 'beg-d4-r-16w']) {
        const p = plan(id);
        const asOf = wed(p, 4);
        const r = adapt(p, factsOf(p, s, asOf), asOf);
        const ws = r.plan.weeks;
        const taper = ws.find((w) => w.phase === 'taper')!;
        const lastBuild = ws.filter((w) => isBuild(w) && !w.deload).pop()!;
        expect(taper.targetKm, `${id}/${s}`).toBeLessThanOrEqual(lastBuild.targetKm);
        const st = r.plan.adaptation!.steps[0]!;
        const from = st.startKm !== null ? st.fromWeek : st.returnFrom!.week + 1;
        const peak = Math.max(
          ...ws
            .filter((w) => isBuild(w) && w.index >= from && (!w.deload || w.index === st.fromWeek))
            .map((w) => w.targetKm)
        );
        expect(taper.nominalKm, `${id}/${s}`).toBe(
          Math.round(P.taper.factor * Math.round(peak * 10)) / 10
        );
      }
  });
});

describe('odluke A1–A15', () => {
  it('A1: rezultat 5000/10000/21097,5/42195 m — VDOT od sledeće nedelje; po osećaju → result; obim isti; stari rezultat i VDOT van opsega se ignorišu', () => {
    const p = plan('d4-f-14w');
    const asOf = wed(p, 6);
    const r = adapt(p, { results: [{ distM: 5000, sec: 1470, date: asOf, kind: 'test' }] }, asOf);
    const st = r.plan.adaptation!.steps[0]!;
    expect(st.fromWeek).toBe(7);
    expect(r.plan.paceBasis).toBe('result');
    expect(r.plan.vdot).toBe(st.vdot);
    expect(r.plan.predictedHmSec).not.toBeNull();
    expect(r.plan.weeks.slice(0, -1).map((w) => w.nominalKm)).toEqual(
      p.weeks.slice(0, -1).map((w) => w.nominalKm)
    );
    const pr = plan('d4-r-14w');
    for (const [distM, sec] of [
      [5000, 1300],
      [10000, 2700],
      [21097.5, 5940],
      [42195, 12400]
    ] as const) {
      const x = adapt(pr, { results: [{ distM, sec, date: asOf, kind: 'race' }] }, asOf);
      expect(applied(x, 'NEW_RESULT'), String(distM)).toBe(true);
      expect(x.plan.vdot, String(distM)).toBe(round1(vdotFromResult(distM, sec)));
      expect(x.plan.goal!.weeks).toBe(14 - 7 + 1);
    }
    const slow = { distM: 5000, sec: 2700, date: asOf, kind: 'race' };
    const old = { distM: 5000, sec: 1300, date: addDays(asOf, -90), kind: 'race' };
    const ri = adapt(pr, { results: [slow, old] }, asOf);
    expect(ri.reasons.map((x) => `${x.condition}:${x.applied}`)).toEqual([
      'RESULT_IGNORED:false',
      'RESULT_IGNORED:false'
    ]);
    expect(sameWeeks(pr, ri.plan)).toBe(true);
    const bad = adaptHmV2(pr, { results: [{ distM: 3000, sec: 700, date: asOf }] }, asOf);
    expect(bad.ok).toBe(false);
  });

  it('A2: manjak (< 60 % u pokrivenih 7 dana) → cilj sledeće nedelje = min(cilj, poslednja izgradnja, max(izvršeno, 0,8 × cilj)), dalje povratni rast', () => {
    const p = plan('d5-r-14w');
    const asOf = wed(p, 6);
    const f = factsOf(p, 'under50', asOf);
    const r = adapt(p, f, asOf);
    const st = r.plan.adaptation!.steps[0]!;
    const tn = p.weeks[st.fromWeek - 1]!.targetKm;
    const last = p.weeks.filter((w) => w.index < st.fromWeek && isBuild(w) && !w.deload).pop()!
      .targetKm;
    const done = (f.workouts as { date: string; km: number }[])
      .filter((x) => mustDay(x.date) > mustDay(asOf) - 7)
      .reduce((a, x) => a + x.km, 0);
    expect(st.startKm).toBe(round1(Math.min(tn, last, Math.max(done, A.underFloorShare * tn))));
    expect(r.plan.weeks[st.fromWeek - 1]!.targetKm).toBe(st.startKm);
    expect(st.levelKm).not.toBeNull();
  });

  it('A3: pauza 7–13 → 80 % i 1 kvalitet; 14–27 → 70 %, bez kvaliteta pa 1; ≥ 28 → nov start; < 10 ned do trke → orijentir', () => {
    const p = plan('d4-r-18w');
    const asOf = wed(p, 6);
    const r10 = adapt(p, factsOf(p, 'pause10', asOf), asOf);
    const s10 = r10.plan.adaptation!.steps[0]!;
    expect(r10.plan.weeks[s10.fromWeek - 1]!.limits?.quality).toBe('one');
    const r20 = adapt(p, factsOf(p, 'pause20', asOf), asOf);
    const s20 = r20.plan.adaptation!.steps[0]!;
    expect(r20.plan.weeks[s20.fromWeek - 1]!.limits?.quality).toBe('none');
    expect(r20.plan.weeks[s20.fromWeek]!.limits?.quality).toBe('one');
    expect(quality(r20.plan.weeks[s20.fromWeek - 1]!)).toBe(0);
    const r35 = adapt(p, factsOf(p, 'pause35', asOf), asOf);
    const s35 = r35.plan.adaptation!.steps[0]!;
    expect([s35.restart, s35.orientation]).toEqual([true, false]);
    expect(r35.plan.weeks[s35.fromWeek - 1]!.phase).toBe('base');
    // < 10 nedelja do trke → „orijentir".
    const q = plan('d4-r-14w');
    const a = end(q, 6);
    const ro = adapt(q, factsOf(q, 'pause35', a), a);
    expect(ro.plan.adaptation!.steps[0]!.orientation).toBe(true);
    expect(ro.plan.goal!.status).toBe('orientation');
    expect(ro.plan.notes).toContain(A.orientationMessage);
  });

  it('A4: bol ≥ 4 → 7 dana bez kvaliteta i ubrzanja, dugi ≤ 60 min, lagani × 0,7 (≥ 4 km); bol ≥ 7 → 3 dana odmora', () => {
    const p = plan('d6-r-18w');
    const asOf = end(p, 8);
    const r5 = adapt(p, factsOf(p, 'pain5', asOf), asOf);
    const st = r5.plan.adaptation!.steps[0]!;
    expect(st.rest).toBeNull();
    expect(st.pain).toEqual({ from: addDays(asOf, 1), to: addDays(asOf, 7) });
    expect(r5.reasons[0]!.message).toContain('stručni pregled');
    const w9 = r5.plan.weeks[8]!;
    expect(quality(w9)).toBe(0);
    expect(w9.days.some((d) => d.workout.segments.some((x) => x.kind === 'stride'))).toBe(false);
    expect(w9.days.find((d) => d.role === 'long')!.workout.sec).toBeLessThanOrEqual(
      A.painLongMaxSec
    );
    const noPain = { ...st, pain: null, noQuality: [st.pain!] };
    const c = construct(p.input, [noPain]);
    if (!c.ok) throw new Error('construct');
    for (const d of w9.days.filter((x) => x.role === 'easy')) {
      const o = c.plan.weeks[8]!.days.find((x) => x.date === d.date)!;
      expect(d.workout.km, d.date).toBe(
        Math.max(4, Math.floor(o.workout.km * A.painEasyFactor * 10 + 1e-9) / 10)
      );
    }
    expect(st.returnFrom).toEqual({ week: 9, share: A.painEasyFactor });
    const r8 = adapt(p, factsOf(p, 'pain8', asOf), asOf);
    const s8 = r8.plan.adaptation!.steps[0]!;
    expect(s8.rest).toEqual({ from: addDays(asOf, 1), to: addDays(asOf, 3) });
    expect(
      r8.plan.weeks[8]!.days.filter((d) => mustDay(d.date) <= mustDay(addDays(asOf, 3)))
    ).toEqual([]);
  });

  it('A5: umor (≥ 2 laganih sa RPE ≥ 7) → sledeća nedelja rasterećenje 0,8 × poslednja ne-rasteretna; redovno odmah posle se ukida', () => {
    const p = plan('d4-r-14w');
    const dl = p.weeks.find((w) => w.deload && w.index > 4)!;
    const before = end(p, dl.index - 1);
    expect(applied(adapt(p, factsOf(p, 'fatigue', before), before), 'FATIGUE')).toBe(false);
    const a = end(p, dl.index - 2);
    const r = adapt(p, factsOf(p, 'fatigue', a), a);
    const ws = r.plan.weeks;
    expect([ws[dl.index - 2]!.deload, ws[dl.index - 1]!.deload]).toEqual([true, false]);
    expect(ws[dl.index - 2]!.nominalKm).toBe(
      Math.round(P.deload.factor * ws[dl.index - 3]!.targetKm * 10) / 10
    );
  });

  it('A6: višak > 115 % u dva pokrivena prozora → sledeća nedelja bez rasta; ne kad je sledeća rasteretna', () => {
    const p = plan('d4-r-14w');
    const k = p.weeks.findIndex(
      (w, i) =>
        i > 4 && isBuild(w) && !w.deload && isBuild(p.weeks[i + 1]!) && !p.weeks[i + 1]!.deload
    );
    const a = end(p, k + 1);
    const r = adapt(p, factsOf(p, 'over120', a), a);
    expect(applied(r, 'OVER_EXECUTION')).toBe(true);
    expect(r.plan.weeks[k + 1]!.targetKm).toBe(p.weeks[k]!.targetKm);
    const dl = p.weeks.find((w) => w.deload && w.index > 4)!;
    const b = end(p, dl.index - 1);
    expect(applied(adapt(p, factsOf(p, 'over120', b), b), 'OVER_EXECUTION')).toBe(false);
  });

  it('A7: svi aktivni uslovi u reasons (applied true/false, poruka); za obim samo najviši', () => {
    const p = plan('d3-r-14w');
    const asOf = wed(p, 6);
    const r = adapt(p, factsOf(p, 'painPause', asOf), asOf);
    for (const x of r.reasons) expect(x.message.length).toBeGreaterThan(20);
    expect(
      r.reasons.filter(
        (x) =>
          ['PAUSE', 'FATIGUE', 'UNDER_EXECUTION', 'OVER_EXECUTION'].includes(x.condition) &&
          x.applied
      ).length
    ).toBe(1);
  });

  it('A8: rasterećenje u povratku 0,8 × poslednja ne-rasteretna; cilj koraka osnov i kad je rasteretna', () => {
    const p = plan('d4-r-18w');
    const dl = p.weeks.find((w) => w.deload)!;
    const a = end(p, dl.index - 1);
    const rd = adapt(p, factsOf(p, 'pause10', a), a);
    const sd = rd.plan.adaptation!.steps[0]!;
    expect(rd.plan.weeks[sd.fromWeek - 1]!.targetKm).toBe(sd.startKm);
    const a2 = wed(p, 6);
    const r = adapt(p, factsOf(p, 'pause20', a2), a2);
    const st = r.plan.adaptation!.steps[0]!;
    for (const w of r.plan.weeks.filter((x) => x.deload && x.index > st.fromWeek)) {
      const prev = r.plan.weeks.filter((x) => x.index < w.index && isBuild(x) && !x.deload).pop()!;
      expect(w.nominalKm).toBe(Math.round(P.deload.factor * prev.targetKm * 10) / 10);
    }
  });

  it('A9: kvalitet koji ne staje → 1 kvalitet → bez kvaliteta (napomena A9); trkačka ≤ taper', () => {
    const p = plan('beg-d4-f-16w');
    const asOf = wed(p, 6);
    const r = adapt(p, factsOf(p, 'pause35', asOf), asOf);
    for (const w of r.plan.weeks.filter((x) => x.notes.some((n) => n.includes('(A9)'))))
      expect(quality(w)).toBeLessThanOrEqual(1);
    const q = plan('d4-r-10w');
    const n = q.weeks.length;
    const at = wed(q, n - 1);
    const rq = adapt(q, factsOf(q, 'pause20', at), at);
    const race = rq.plan.weeks.at(-1)!;
    expect(race.days.some((d) => d.role === 'sharpener')).toBe(false);
    expect(race.plannedKm).toBeLessThanOrEqual(rq.plan.weeks.at(-2)!.plannedKm);
  });

  it('A10: dan bez zapisa je poznat samo u coverage complete; vremenski zapis bez km je trčanje', () => {
    const p = plan('d4-r-14w');
    const asOf = wed(p, 6);
    const f = factsOf(p, 'pause10', asOf) as HmV2Facts;
    expect(applied(adaptHmV2(p, f, asOf), 'PAUSE')).toBe(true);
    const { coverage: _c, ...noCov } = f;
    expect(adapt(p, noCov, asOf).reasons.filter((x) => x.applied)).toEqual([]);
    const timed = {
      ...f,
      workouts: [
        ...f.workouts!,
        { date: addDays(asOf, -2), km: 0, durationSec: 1800, completed: true }
      ]
    };
    expect(applied(adaptHmV2(p, timed, asOf), 'PAUSE')).toBe(false);
  });

  it('A11: asOf ≥ dan trke ili pre prethodne adaptacije → ADAPT_AS_OF_INVALID; isti asOf dozvoljen', () => {
    const p = plan('d4-r-14w');
    const asOf = wed(p, 6);
    const r = adapt(p, factsOf(p, 'pause10', asOf), asOf);
    const back = adaptHmV2(r.plan, {}, addDays(asOf, -1));
    expect(!back.ok && back.reasons[0]!.code).toBe('ADAPT_AS_OF_INVALID');
    const race = adaptHmV2(p, {}, p.input.raceDate);
    expect(!race.ok && race.reasons[0]!.code).toBe('ADAPT_AS_OF_INVALID');
    expect(adaptHmV2(r.plan, {}, asOf).ok).toBe(true);
  });

  it('A12: rePeriodize — taper i trkačka ostaju, rasterećenja po H5; datum trke se ne pomera', () => {
    const base = periodize('2026-11-02', 18)!;
    for (let from = 2; from <= 16; from++) {
      const f = rePeriodize(base, from);
      if (!f) continue;
      expect(f.slice(16).map((x) => x.phase)).toEqual(['taper', 'race']);
      expect(f.slice(0, from - 1)).toEqual(base.slice(0, from - 1));
      const rel = f.slice(from - 1).map((x) => x.phase);
      f.slice(from - 1).forEach((x, k) => {
        if (x.deload) expect(deloadAllowed(rel, k + 1), `from ${from} ned ${x.index}`).toBe(true);
      });
    }
    const p = plan('d4-r-14w');
    const a = end(p, 8);
    const r = adapt(p, factsOf(p, 'pause35', a), a);
    expect(r.plan.weeks.at(-1)!.days.find((d) => d.role === 'race')!.date).toBe(p.input.raceDate);
  });

  it('A13: blokirana nedelja testa → prva sledeća ne-rasteretna nedelja izgradnje bez ograničenja; posle rezultata testa nema; početnik bez testa', () => {
    const p = plan('d4-f-14w');
    const tw = p.weeks.find((w) => w.test)!;
    const asOf = addDays(tw.startDate, -1);
    const r = adapt(p, factsOf(p, 'pause20', asOf), asOf);
    const moved = r.plan.weeks.find((w) => w.test);
    if (moved) {
      expect(moved.index).toBeGreaterThan(tw.index);
      expect(moved.limits).toBeUndefined();
    }
    expect(r.reasons.some((x) => x.condition === 'TEST_MOVED')).toBe(true);
    const rr = adapt(p, factsOf(p, 'test5k', asOf), asOf);
    expect(rr.plan.weeks.some((w) => w.test || w.days.some((d) => d.role === 'test'))).toBe(false);
    const b = plan('beg-d4-f-16w');
    const a = end(b, 2);
    expect(adapt(b, factsOf(b, 'pause10', a), a).plan.weeks.some((w) => w.test)).toBe(false);
  });

  it('A14: koraci se čuvaju — construct(input, koraci) = budući deo adaptiranog plana; lanac', () => {
    const p = plan('d5-f-14w');
    const a1 = wed(p, 6);
    const r1 = adapt(p, factsOf(p, 'pause10', a1), a1);
    const a2 = addDays(a1, 7);
    const f2 = {
      workouts: runsIn(r1.plan, addDays(a2, -6), a2, 0.5),
      coverage: { from: addDays(a2, -6), to: a2, complete: true }
    };
    const r2 = adapt(r1.plan, f2, a2);
    expect(r2.plan.adaptation!.steps.length).toBe(2);
    const c = construct(p.input, r2.plan.adaptation!.steps);
    if (!c.ok) throw new Error('construct');
    r2.plan.weeks.forEach((w, i) => {
      if (mustDay(w.startDate) > mustDay(a2))
        expect(JSON.stringify(w)).toBe(JSON.stringify(c.plan.weeks[i]));
    });
    expect(JSON.stringify(adaptHmV2(r1.plan, f2, a2))).toBe(JSON.stringify(r2));
  });

  it('A15: druga politika → ADAPT_PLAN_INVALID; plan nosi policyId/policyVersion i fazu svake nedelje', () => {
    const p = plan('d4-r-14w');
    const asOf = wed(p, 6);
    const other = adaptHmV2({ ...p, policyId: 'hm-v1' }, {}, asOf);
    expect(!other.ok && other.reasons[0]!.code).toBe('ADAPT_PLAN_INVALID');
    const r = adapt(p, factsOf(p, 'pause10', asOf), asOf);
    expect([r.plan.policyId, r.plan.policyVersion]).toEqual(['hm-v2', P.version]);
    expect(r.plan.weeks.every((w) => typeof w.phase === 'string')).toBe(true);
  });
});

describe('A17 / pouka 22: redovno rasterećenje posle smanjene nedelje otpada; prinudno ostaje', () => {
  it('manjak na kraju nedelje pre-pre rasterećenja: sledeća smanjena, redovno rasterećenje ukinuto (poruka A17)', () => {
    const p = plan('d4-r-14w');
    const dl = p.weeks.find((w) => w.deload && w.index > 4)!;
    const a = end(p, dl.index - 2);
    const r = adapt(p, factsOf(p, 'under50', a), a);
    expect(r.plan.weeks[dl.index - 1]!.deload).toBe(false);
    expect(r.reasons.some((x) => x.message.includes('(A17)'))).toBe(true);
  });

  it('višak (A6, reduced = false) nije smanjenje: redovno rasterećenje posle nedelje bez rasta ostaje', () => {
    const p = plan('d4-r-14w');
    const dl = p.weeks.find((w) => w.deload && w.index > 4)!;
    const a = end(p, dl.index - 2);
    const r = adapt(p, factsOf(p, 'over120', a), a);
    expect(applied(r, 'OVER_EXECUTION')).toBe(true);
    expect(r.plan.adaptation!.steps[0]!.reduced).toBe(false);
    expect(r.plan.weeks[dl.index - 1]!.deload).toBe(true);
  });

  it('prinudno rasterećenje (umor) odmah posle nedelje sidra bola ostaje (pouka 22 ukida samo redovno)', () => {
    const p = plan('d4-r-14w');
    const at = wed(p, 5);
    const facts = {
      workouts: [
        ...(factsOf(p, 'fatigue', at).workouts as Record<string, unknown>[]),
        { date: at, km: 0, durationSec: 0, completed: false, pain: 5 }
      ]
    };
    const r = adapt(p, facts, at);
    expect([applied(r, 'PAIN'), applied(r, 'FATIGUE')]).toEqual([true, true]);
    const st = r.plan.adaptation!.steps[0]!;
    expect([st.returnFrom!.week, st.fromWeek, st.deload]).toEqual([5, 6, true]);
    expect(r.plan.weeks[5]!.deload).toBe(true);
  });
});

describe('pouka 34: umor pre starta', () => {
  it('asOf start − 1/− 3/− 6: ned 1 prinudno rasterećenje 0,8 × planirana ned 1, ned 2 = planirana ned 1 bez rasta; referenca = ned 1 generatora', () => {
    for (const id of ['d3-r-10w', 'd4-r-14w', 'd6-f-18w', 'beg-d4-f-12w', 'beg-d5-f-20w'])
      for (const d of [1, 3, 6]) {
        const p = plan(id);
        const at = addDays(p.input.startDate, -d);
        const r = adapt(p, factsOf(p, 'fatigue', at), at);
        const st = r.plan.adaptation!.steps[0]!;
        const w1 = p.weeks[0]!;
        expect(st.preStart, `${id} ${at}`).toEqual({
          targetKm: w1.targetKm,
          longKm: w1.days.find((x) => x.role === 'long')!.workout.km,
          q1: w1.days.find((x) => x.role === 'q1')?.workout.dose ?? null,
          q2: w1.days.find((x) => x.role === 'q2')?.workout.dose ?? null
        });
        const [a1, a2] = [r.plan.weeks[0]!, r.plan.weeks[1]!];
        expect([a1.deload, a1.nominalKm]).toEqual([true, round1(P.deload.factor * w1.targetKm)]);
        expect(a2.targetKm, `${id} ${at}`).toBe(w1.targetKm);
        // Dopuna N7: doza nedelje 2 = doza planirane nedelje 1 (ponavljanje, bez rasta).
        const doses = (w: typeof w1) =>
          w.days.filter((x) => x.workout.dose).map((x) => [x.role, x.workout.dose!.doseM]);
        expect(doses(a2), `${id} ${at}`).toEqual(doses(w1));
        expect(r.reasons[0]!.message).toContain('pouka 34');
        if (id.startsWith('beg')) expect(quality(a1)).toBe(0);
      }
  });

  it('pre starta i bol 5/8, pauza 10, rezultat: prihvaćeno, bez reference', () => {
    const p = plan('d4-r-14w');
    const at = addDays(p.input.startDate, -3);
    for (const s of ['pain5', 'pain8', 'pause10', 'faster', 'test5k'] as const)
      expect(
        adapt(p, factsOf(p, s, at), at).plan.adaptation!.steps[0]!.preStart,
        s
      ).toBeUndefined();
  });
});

describe('A18: rasterećenje posle smanjenja obima — dugi ≥ 4 km', () => {
  // hm-v2.4.0: pouka 35 (drugi dan kvaliteta lagan) podiže dugi posle novog starta, pa primer 4 dana / 14 ned (dugi
  // 4 km pre rasterećenja) više ne postoji; početnik 4 d / 12 ned (jedan kvalitet) i dalje ima dugi 4,5 km.
  it('početnik 4 dana, 12 ned, pauza 35 do srede ned 6: dugi 4,5 km, rasterećenje ned 9 ima dugi 4 km (0,8 × = 3,6 km ispod minimuma laganog)', () => {
    const p = plan('beg-d4-r-12w');
    const at = wed(p, 6);
    const r = adapt(p, factsOf(p, 'pause35', at), at);
    const w = r.plan.weeks[8]!;
    expect(w.deload).toBe(true);
    expect(r.plan.weeks[7]!.days.find((d) => d.role === 'long')!.workout.km).toBe(4.5);
    expect(w.days.find((d) => d.role === 'long')!.workout.km).toBe(4);
  });
});

describe('nalazi široke pretrage (wide04.ts)', () => {
  it('novi rezultat na kraju ned 1: nedelja 1 se proverava tempom nedelje 1 (WEEK1_BELOW_START, A1)', () => {
    const p = plan('d4-12w-60km-v30-A-sat');
    const at = end(p, 1);
    const r = adapt(p, factsOf(p, 'faster', at), at);
    expect(r.plan.vdot).toBeGreaterThan(p.vdot);
    expect(r.plan.weeks[0]).toEqual(p.weeks[0]);
  });

  it('taper „samo RP" (druga pretraga): drugi član plafona za nedelju sa jednim danom kvaliteta — RP spušten da dan ne bude duži od dugog (pouka 32)', () => {
    const b = grid02Inputs().find((x) => x.id === 'd6-20w-50km-v60-A-sat')!;
    const g = generateHmV2({ ...b.input, recentLongRunKm: 15 });
    if (!g.ok) throw new Error('plan');
    const at = end(g.plan, 16);
    const r = adapt(g.plan, factsOf(g.plan, 'pause20', at), at);
    const taper = r.plan.weeks[18]!;
    const rp = taper.days.find((d) => d.role === 'q1')!;
    expect(taper.days.some((d) => d.role === 'q2')).toBe(false);
    expect(rp.workout.dose!.doseM).toBe(4000);
    expect(taper.notes.some((n) => n.includes('RP 4,0 km umesto 5,0 km'))).toBe(true);
  });
});

describe('pouka 16/17: bez koraka = generator; adaptacija bez činjenica ne menja plan', () => {
  it('construct(input, []) = generateHmV2(input); plan generatora nema adaptation ni limits', () => {
    for (const b of bases) {
      const g = generateHmV2(b.input);
      expect(JSON.stringify(construct(b.input, []))).toBe(JSON.stringify(g));
      if (g.ok) {
        expect(g.plan.adaptation).toBeUndefined();
        expect(g.plan.weeks.some((w) => w.limits !== undefined)).toBe(false);
      }
    }
  });

  it('adaptacija bez činjenica: sve nedelje bajt-iste, iste napomene, korak zapisan', () => {
    for (const b of bases.slice(0, 8)) {
      const p = plan(b.id);
      const asOf = wed(p, 4);
      const r = adapt(p, {}, asOf);
      expect(sameWeeks(p, r.plan)).toBe(true);
      expect(r.plan.notes).toEqual(p.notes);
      expect(r.changes).toEqual([]);
      expect(r.plan.adaptation!.steps.length).toBe(1);
    }
  });
});

describe('pouka 18: sidro povratka = nedelja koja sadrži asOf + 1', () => {
  it('bol 5 u bilo kom danu pon–sub iste nedelje → ista nedelja sidra, isti ciljevi od r + 1', () => {
    for (const id of ['d4-r-14w', 'd5-f-18w', 'beg-d4-r-16w']) {
      const p = plan(id);
      const k = 6;
      const targets = new Set<string>();
      for (let d = 0; d < 6; d++) {
        const at = addDays(p.weeks[k - 1]!.startDate, d);
        const r = adapt(p, painFacts(at, 5), at);
        const st = r.plan.adaptation!.steps[0]!;
        expect(st.returnFrom!.week, `${id} ${at}`).toBe(k);
        targets.add(JSON.stringify(r.plan.weeks.slice(k).map((w) => w.nominalKm)));
      }
      expect(targets.size, id).toBe(1);
    }
  });
});

describe('pouka 19 i 20', () => {
  it('19: promena cilja (novi rezultat) — zaključani i urađeni dani bajt-isti', () => {
    const p = plan('d4-r-14w');
    const asOf = wed(p, 6);
    const future = p.weeks
      .flatMap((w) => w.days)
      .filter((d) => mustDay(d.date) > mustDay(asOf) && d.role !== 'race')
      .slice(0, 3)
      .map((d) => d.date);
    const f = { ...factsOf(p, 'faster', asOf), lockedDayIds: future };
    const r = adapt(p, f, asOf);
    expect(r.plan.vdot).not.toBe(p.vdot);
    const after = new Map(r.plan.weeks.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
    for (const d of p.weeks.flatMap((w) => w.days))
      if (future.includes(d.date))
        expect(JSON.stringify(after.get(d.date))).toBe(JSON.stringify(d));
  });

  it('20: traka „plan treba prilagoditi" samo za novo ograničenje (newLimits)', () => {
    const p = plan('d4-r-14w');
    const a1 = wed(p, 6);
    const r1 = adapt(p, painFacts(a1, 5), a1);
    expect(r1.newLimits.length).toBeGreaterThan(0);
    expect(newLimits(r1.plan.adaptation!.steps)).toEqual(r1.newLimits);
    const a2 = addDays(a1, 1);
    const r2 = adapt(r1.plan, {}, a2);
    expect(r2.newLimits).toEqual([]);
  });
});

describe('pouka 23: rasterećenje sa testom bez cilja naviše', () => {
  it('plan po osećaju, adaptacija pred nedeljom testa: nedelja testa nije podignuta iznad pravila', () => {
    for (const id of ['d4-f-14w', 'd5-f-18w', 'd3-f-10w'])
      for (const s of ['pain5', 'pause10', 'under50'] as const) {
        const p = plan(id);
        const tw = p.weeks.find((w) => w.test)!;
        const at = end(p, tw.index - 1);
        const r = adapt(p, factsOf(p, s, at), at);
        for (const w of r.plan.weeks.filter((x) => x.deload))
          expect(w.fitted, `${id}/${s} ned ${w.index}`).not.toBe('up');
      }
  });
});

describe('pouka 29: prošlost = upisani dani (stanje doze, dugi)', () => {
  it('pauza 10 u sredu = dan Q1 (upisan T kont. 3000 m): ned 5 spušta T cruise sa 3,0 km (stanje iz upisanog dana)', () => {
    const p = plan('d3-13w-30km-v55-B-sat');
    const at = wed(p, 3);
    const r = adapt(p, { breaks: [{ kind: 'break', from: addDays(at, -9), to: at }] }, at);
    const q = r.plan.weeks[2]!.days.find((d) => d.role === 'q1')!;
    expect(q).toEqual(p.weeks[2]!.days.find((d) => d.role === 'q1'));
    expect(q.workout.dose!.doseM).toBe(3000);
    expect(r.plan.adaptation!.mixedWeeks).toContain(3);
    expect(r.plan.weeks[4]!.notes.some((n) => n.includes('spušten sa 3,0'))).toBe(true);
  });
});

describe('pouka 29: najduži dugi iz upisanih dana', () => {
  it('3 dana, pauza 10 do ponedeljka ned 8 (ostatak nedelje smanjen): dugi tapera = 0,6 × upisan dugi ned 8 (15,7 km, nedelja), ne sastavljen', () => {
    const p = plan('d3-10w-25km-v30-A-sat');
    const at = '2026-12-21';
    const r = adapt(p, { breaks: [{ kind: 'break', from: addDays(at, -9), to: at }] }, at);
    const long8 = r.plan.weeks[7]!.days.find((d) => d.role === 'long')!;
    expect(long8).toEqual(p.weeks[7]!.days.find((d) => d.role === 'long'));
    expect(long8.workout.km).toBe(15.7);
    expect(r.plan.weeks[7]!.targetKm).toBeLessThan(p.weeks[7]!.targetKm);
    expect(r.plan.weeks[8]!.days.find((d) => d.role === 'long')!.workout.km).toBe(9.4);
  });
});

describe('pouka 30: trkačka nedelja ≤ taper i kad taper ima dane odmora/bola', () => {
  it('bol 8 u sredu tapera: trkačka ≤ planirano tapera; skraćena ispod minimuma → RACE_WEEK_SHORT', () => {
    let short = 0;
    for (const b of bases) {
      const p = plan(b.id);
      const n = p.weeks.length;
      for (let k = 3; k <= 6; k++) {
        const at = addDays(p.weeks[n - 2]!.startDate, k);
        const r = adapt(p, factsOf(p, 'pain8', at), at);
        const [taper, race] = [r.plan.weeks[n - 2]!, r.plan.weeks[n - 1]!];
        expect(race.plannedKm, `${b.id} ${at}`).toBeLessThanOrEqual(taper.plannedKm);
        if (race.notes.some((x) => x.includes('(pouka 30)'))) {
          short++;
          expect(race.days.filter((d) => d.role === 'easy').length).toBeLessThan(
            p.weeks[n - 1]!.days.filter((d) => d.role === 'easy').length
          );
        }
      }
    }
    expect(short).toBeGreaterThan(0);
  });

  it('početnik 4 dana, bol 8 u sredu tapera (taper mešovit): višak laganog trkačke nedelje je odmor — validator čita upisan taper', () => {
    const p = plan('b-d4-20w-20km-e330-A');
    const n = p.weeks.length;
    const at = wed(p, n - 1);
    const r = adapt(p, factsOf(p, 'pain8', at), at);
    const [taper, race] = [r.plan.weeks[n - 2]!, r.plan.weeks[n - 1]!];
    expect(r.plan.adaptation!.mixedWeeks).toContain(n - 1);
    expect(race.notes).toContain(
      'Trkačka nedelja skraćena: taper je imao dane odmora/bola (pouka 30).'
    );
    expect(race.plannedKm).toBeLessThanOrEqual(taper.plannedKm);
  });

  it('3 dana, bol 8 u nedelju pred trkačku: oba dana pre trke su odmor — trkačka ima samo trku (dani odmora A4, ne EMPTY_WEEK; trka ≥ minimum nedelje)', () => {
    const p = plan('f-d3-12w-40km-e270-B');
    const n = p.weeks.length;
    const at = p.weeks[n - 2]!.endDate;
    const r = adapt(p, factsOf(p, 'pain8', at), at);
    const race = r.plan.weeks[n - 1]!;
    expect(race.days.map((d) => d.role)).toEqual(['race']);
    expect(race.limits?.rest?.length).toBe(2);
    expect(r.plan.warnings.some((w) => w.week === n && w.rule === 'EMPTY_WEEK')).toBe(false);
    // Ista nedelja u planu bez dana odmora je prazna (Uslov 8).
    const noRest = {
      ...r.plan,
      weeks: r.plan.weeks.map((w, i) => (i === n - 1 ? { ...w, limits: undefined } : w))
    };
    expect(validatePlan(noRest).some((v) => v.rule === 'EMPTY_WEEK')).toBe(true);
  });
});

describe('pouka 31: prinudno rasterećenje u uvodu početnika', () => {
  it('umor početnika na kraju ned 1 → ned 2 rasterećenje 0,8 ×, bez kvaliteta, sadržaj uvoda', () => {
    for (const id of ['beg-d4-f-12w', 'beg-d5-f-16w', 'beg-d4-r-20w']) {
      const p = plan(id);
      const a = end(p, 1);
      const r = adapt(p, factsOf(p, 'fatigue', a), a);
      const w = r.plan.weeks[1]!;
      expect(w.deload, id).toBe(true);
      expect(w.nominalKm).toBe(Math.round(P.deload.factor * p.weeks[0]!.targetKm * 10) / 10);
      expect(quality(w)).toBe(0);
      expect(w.notes.some((x) => x.includes('pouka 31'))).toBe(true);
    }
  });
});
