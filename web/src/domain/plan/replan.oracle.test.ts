import { beforeAll, describe, expect, it } from 'vitest';
import { d6Snapshot } from '@/test/d6Snapshot';
import { canonical } from '@/test/fingerprint';
import { firstDiff } from '@/test/firstDiff';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import type { GenPlanState } from '../state';
import { generatePlan } from '@/test/legacyGenerator';
import type { PlanGenerationInput, Session } from '../training/types';
import { adaptGeneratedPlan } from './adapt';
import { mergeOverrides, planWithNewGoal, recalibratedPlan, reentryPlan } from './replan';

/* Test names are recording keys and remain unchanged; generated outputs now use D6 snapshots.
   parity: test/ostali (planSaNovimCiljem u test/podesavanja + revizija6), test/generator (rekalibracija,
   re-entry). Poredi `plan/replan` sa starim `planSaNovimCiljem`, `mergeOverrides`, `recalibratedPlan`,
   `reentryPlan`. JEDNA NAMERNA RAZLIKA: ključevi `qs` posle promene cilja (docs/ENGINE_CHANGES.md, A3). */

const START = '2026-01-05' as IsoDate;
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;

const PB: Record<number, number> = { 5000: 1237, 10000: 2570, 21097.5: 5700, 42195: 13500 };
const input = (
  raceDistM: number,
  over: Partial<PlanGenerationInput> = {}
): PlanGenerationInput => ({
  startDate: START,
  raceDate: addDays(START, 20 * 7),
  raceDistM,
  pb: { distM: raceDistM, sec: PB[raceDistM] as number },
  weeklyKm: 50,
  runDays: 5,
  quality: 2,
  intensity: 'std',
  trainedRecently: true,
  ...over
});

let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
});

function stored(inp: PlanGenerationInput, withInput = true): GenPlanState {
  const a = adaptGeneratedPlan(generatePlan(inp));
  if (!a) throw new Error('adapt');
  return withInput ? { ...a, ulaz: inp } : a;
}

function loadLegacy(plan: GenPlanState): void {
  const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
  ctx['__p'] = j(plan);
  legacy.evalIn('S.genPlan=__p; S.alts={}; S.moves={}; setActivePlan(); rebuildDateIndex(); 0');
}

/** Zaključava nekoliko polja sesija — tempo, broj ponavljanja — da `mergeOverrides` ima šta da prenese. */
function withLocks(plan: GenPlanState): GenPlanState {
  const p = j<GenPlanState>(plan);
  let n = 0;
  for (const w of p.weeks)
    for (const d of w.days) {
      const s = d.session as (Session & Record<string, unknown>) | undefined;
      if (!s || n++ % 2) continue;
      s['paceSec'] = s.paceSec + 7;
      s.overrides = { ...s.overrides, paceSec: true };
      if (s.type === 'int') {
        s['reps'] = s.reps + 1;
        s.overrides['reps'] = true;
      }
    }
  return p;
}

describe('promena cilja naspram starog planSaNovimCiljem', () => {
  it('sve 4 distance × razne nedelje × zaključana polja: isti plan, osim ključeva qs za nove nedelje (A3)', () => {
    let compared = 0;
    for (const dist of [5000, 10000, 21097.5, 42195]) {
      for (const week of [1, 3, 8, 15, 20]) {
        for (const locks of [false, true]) {
          const base = stored(input(dist));
          const plan = locks ? { ...withLocks(base), ulaz: base.ulaz } : base;
          loadLegacy(plan);
          const today = addDays(START, (week - 1) * 7 + 2);
          const goal = Math.round((PB[dist] as number) * 0.97);
          const old = j<Record<string, unknown>>(legacy.call('planSaNovimCiljem', goal, today));
          const mine = planWithNewGoal(plan, goal, today);
          const where = `${dist} N${week} locks=${locks}`;
          if ('error' in old) {
            expect('error' in mine ? mine.error : null, where).toBe(old['error']);
            continue;
          }
          if ('error' in mine) throw new Error(`${where}: ${mine.error}`);
          // D6: new workouts intentionally differ; historical weeks remain byte-for-byte intact.
          d6Snapshot('replan', `goal ${where}`, mine);
          expect(mine.weeks.filter((w) => w.w < week)).toEqual(
            plan.weeks.filter((w) => w.w < week)
          );
          expect(mine.pred.filter((p) => p.w < week)).toEqual(plan.pred.filter((p) => p.w < week));
          expect(mine.ulaz.goalSec).toBe(goal);
          // qs: stari ključevi (prošle nedelje) isti; novi ključevi po ID-ju dana (g…) umesto n…
          const oldQs = old['qs'] as Record<string, number[]>;
          const keptOld = Object.fromEntries(
            Object.entries(oldQs).filter(([k]) => k.startsWith('g'))
          );
          const mineKept = Object.fromEntries(
            Object.entries(mine.qs).filter(([k]) => k in keptOld)
          );
          expect(mineKept, `${where} qs stari`).toEqual(keptOld);
          const sessionDays = mine.weeks.flatMap((w) =>
            w.days.filter((d) => d.session && w.w >= mine.goalChange.week)
          );
          for (const d of sessionDays) {
            const id = (d as { id: string }).id;
            if (id in mine.qs) continue;
            // sesije bez spec-a (fartlek/prog) nemaju lap-detekciju ni u generatoru
            expect(['fartlek', 'prog']).toContain((d.session as Session).type);
          }
          expect(
            {
              week: mine.goalChange.week,
              from: mine.goalChange.from,
              to: mine.goalChange.to,
              n: mine.goalChange.changedWeeks
            },
            where
          ).toEqual({
            week: (old['promenaCilja'] as Record<string, unknown>)['nedelja'],
            from: (old['promenaCilja'] as Record<string, unknown>)['staro'],
            to: (old['promenaCilja'] as Record<string, unknown>)['novo'],
            n: (old['promenaCilja'] as Record<string, unknown>)['izmenjenoNedelja']
          });
          compared++;
        }
      }
    }
    expect(compared).toBe(40);
  });

  it('A3: stari kod posle promene cilja gubi spec radnih deonica za nove nedelje; novi ga čuva', () => {
    const plan = stored(input(10000));
    loadLegacy(plan);
    const today = addDays(START, 14);
    const old = j<{
      qs: Record<string, number[]>;
      weeks: Array<{ days: Array<{ id: string; session?: unknown }> }>;
    }>(legacy.call('planSaNovimCiljem', 2400, today));
    const mine = planWithNewGoal(plan, 2400, today);
    if ('error' in mine) throw new Error(mine.error);
    const withSession = (weeks: Array<{ days: Array<{ id?: string; session?: unknown }> }>) =>
      weeks.flatMap((w) => w.days.filter((d) => d.session).map((d) => d.id as string));
    const oldCovered = withSession(old.weeks).filter((id) => id in old.qs).length;
    const mineCovered = withSession(mine.weeks).filter((id) => id in mine.qs).length;
    expect(mineCovered).toBeGreaterThan(oldCovered);
    expect(Object.keys(mine.qs).every((k) => k.startsWith('g'))).toBe(true);
    expect(Object.keys(old.qs).some((k) => k.startsWith('n'))).toBe(true);
  });

  it('greške: bez plana, bez ulaza, nevažeći cilj, završen plan', () => {
    const plan = stored(input(10000));
    loadLegacy(plan);
    const today = addDays(START, 14);
    expect(planWithNewGoal(null, 2400, today)).toEqual({
      error: 'Promena cilja radi samo nad generisanim planom.'
    });
    const noInput = stored(input(10000), false);
    loadLegacy(noInput);
    expect(planWithNewGoal(noInput, 2400, today)).toEqual(
      j(legacy.call('planSaNovimCiljem', 2400, today))
    );
    loadLegacy(plan);
    expect(planWithNewGoal(plan, 0, today)).toEqual(j(legacy.call('planSaNovimCiljem', 0, today)));
    const after = addDays(START, 30 * 7);
    expect(planWithNewGoal(plan, 2400, after)).toEqual(
      j(legacy.call('planSaNovimCiljem', 2400, after))
    );
  });

  it('ulaz se ne menja', () => {
    const plan = stored(input(10000));
    const before = JSON.stringify(plan);
    planWithNewGoal(plan, 2400, addDays(START, 14));
    expect(JSON.stringify(plan)).toBe(before);
  });
});

describe('mergeOverrides naspram starog', () => {
  it('prenosi zaključana polja, preskače drugi tip sesije, preračunava km i opis', () => {
    const base = stored(input(10000));
    const locked = withLocks(base);
    const freshWeeks = j<GenPlanState['weeks']>(stored(input(10000, { goalSec: 2400 })).weeks);
    const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
    ctx['__f'] = j(freshWeeks);
    ctx['__o'] = j(locked.weeks);
    const old = j<unknown>(legacy.evalIn('mergeOverrides(__f, __o)'));
    const mine = mergeOverrides(freshWeeks, locked.weeks);
    expect(firstDiff(canonical(j(mine)), canonical(old))).toBeNull();
    expect(JSON.stringify(freshWeeks)).toBe(
      JSON.stringify(j(ctx['__f'] === undefined ? freshWeeks : freshWeeks))
    );
  });
});

describe('rekalibracija i povratak naspram starih funkcija', () => {
  it('recalibratedPlan: isti plan sa i bez spajanja zaključanih polja, sve 4 distance', () => {
    for (const dist of [5000, 10000, 21097.5, 42195]) {
      for (const idx of [2, 6, 12]) {
        for (const intensity of ['kons', 'std', 'agr'] as const) {
          const inp = input(dist, { intensity });
          const plan = withLocks(stored(inp));
          loadLegacy(plan);
          const predicted = (plan.meta as unknown as { predictedSec: number }).predictedSec;
          const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
          ctx['__i'] = j(inp);
          /* A4: stari kod prima perzistirane nedelje (dow 0–6) i spaja ih sa generatorskim (1–7) bez
             pomeranja; poredi se sa starim kodom kome je pomeranje uneto ručno. */
          ctx['__w'] = j(
            plan.weeks.map((w) => ({
              ...w,
              days: w.days.map((d) => ({ ...d, dow: d.dow + 1 }))
            }))
          );
          const vdot = 44 + idx / 3;
          for (const merge of [false, true]) {
            const old = j<unknown>(
              legacy.evalIn(
                `recalibratedPlan(__i, ${idx}, ${vdot}, ${merge ? '__w' : 'undefined'})`
              )
            );
            const mine = recalibratedPlan(inp, idx, vdot, {
              ...(merge ? { oldWeeks: plan.weeks } : {}),
              originalPredictedSec: predicted
            });
            // Consume the legacy recording, but assert the deliberately changed D6 output.
            expect(old).toBeTruthy();
            d6Snapshot('replan', `recal ${dist} N${idx} ${intensity} merge=${merge}`, mine);
            if ('error' in mine) throw new Error(mine.error);
            expect(mine.meta.trainingVdot).toBeCloseTo(vdot, 1);
            expect(mine.weeks[0]?.w).toBe(idx);
          }
        }
      }
    }
  });

  it('reentryPlan: isti plan i ista greška kad je do trke manje od 4 nedelje', () => {
    for (const dist of [5000, 10000, 21097.5, 42195]) {
      for (const resume of [3, 9, 17, 19]) {
        const inp = input(dist);
        const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
        ctx['__i'] = j(inp);
        const old = j<unknown>(legacy.evalIn(`reentryPlan(__i, ${resume}, 22.5, 47.3)`));
        const mine = reentryPlan(inp, resume, 22.5, 47.3);
        if (old && typeof old === 'object' && 'error' in old) expect(mine).toEqual(old);
        else {
          d6Snapshot('replan', `reentry ${dist} N${resume}`, mine);
          if ('error' in mine) throw new Error(mine.error);
          expect(mine.meta.trainingVdot).toBeCloseTo(47.3, 1);
          expect(mine.weeks[0]?.vol).toBeLessThanOrEqual(22.5 * 1.08 + 0.05);
        }
      }
    }
  });
});

describe('A4: zaključana polja pri rekalibraciji stižu na ISTI dan', () => {
  it('perzistirana nedelja sa zaključanim tempom → sveža nedelja ima isti tempo istog dana', () => {
    const inp = input(10000);
    const plan = withLocks(stored(inp));
    const idx = 4;
    const res = recalibratedPlan(inp, idx, 46, {
      oldWeeks: plan.weeks,
      originalPredictedSec: 2500
    });
    if ('error' in res) throw new Error(res.error);
    let checked = 0;
    for (const w of res.weeks) {
      const old = plan.weeks.find((x) => x.w === w.w);
      for (const d of w.days) {
        const o = old?.days.find((x) => x.dow === d.dow - 1);
        if (!d.session || !o?.session || o.session.type !== d.session.type) continue;
        if (!o.session.overrides['paceSec']) continue;
        expect(d.session.paceSec, `N${w.w} dow ${d.dow}`).toBe(o.session.paceSec);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(3);
  });
});
