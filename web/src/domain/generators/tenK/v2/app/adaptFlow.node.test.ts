import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../../date';
import { resolvePlan } from '../../../../plan';
import type { GenPlanState, LogEntry } from '../../../../state';
import type { TenKV2PlanInput } from '../../../contract';
import { regeneratorForDistance } from '../../../handoff';
import {
  generateTenKV2Plan,
  stampForStorage,
  TEN_K_GENERATOR,
  TEN_K_V2_GENERATOR,
  TEN_K_V2_TEST_FIELD,
  tenKV2AdaptPreview,
  tenKV2FormHistory,
  tenKV2GoalChange,
  tenKV2Start,
  type TenKV2AdaptOutcome
} from '../../../select';
import * as tenK from '../../index';
import { TEN_K_V2_POLICY as P } from '../policy.ts';
import type { TenKV2Plan } from '../types.ts';
import { buildFacts, EDITS_KEY } from './facts.ts';

/* SEGMENT 06 — adaptacija 10K v2 u aplikaciji (domen): podaci aplikacije → činjenice (dnevnik i uvoz, van plana bez
   duplog brojanja, bol, test 5 km na danu testa, test 3 km, trke, pokrivenost samo iz potpune sinhronizacije ili potvrde,
   pauze, ručne izmene) → `adaptTenKV2` → pregled (razlozi doslovno, promenjene nedelje, traka) → plan za upis; zaštita
   urađenog i ručno izmenjenog; vraćanje verzije; promena cilja (isti treninzi); forma iz rezultata; članovi (b) kroz
   isti tok; upotrebljivost adaptiranog plana (Uslov 8); predaja HM/maraton → 10K ostaje 10K v1. */

const TODAY = '2026-10-26';
const RACE = '2027-01-24';
const START = tenKV2Start(RACE, TODAY)!;
const WITH_RESULT: TenKV2PlanInput = {
  startDate: START,
  raceDate: RACE,
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 40,
  recentResult: { distanceM: 10000, timeSec: 2700, date: '2026-10-10' },
  goalTimeSec: 2580
};
const FEEL: TenKV2PlanInput = {
  startDate: START,
  raceDate: RACE,
  runDays: ['tue', 'thu', 'sun'],
  currentWeeklyKm: 25,
  easyPaceSecPerKm: 390,
  goalTimeSec: 3300
};

function planOf(input: TenKV2PlanInput): GenPlanState {
  const r = generateTenKV2Plan(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return stampForStorage(r.plan);
}
const v2Of = (p: GenPlanState): TenKV2Plan => p['tenKV2'] as TenKV2Plan;
const view = (p: GenPlanState, alts = {}, moves = {}) => resolvePlan(p.weeks, { alts, moves });
const ok = (r: TenKV2AdaptOutcome) => {
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r;
};
/** Svi treninzi do `to` (uključivo) odrađeni: km = udeo plana, ts = dan. */
function logUntil(p: GenPlanState, to: string, share = 1, extra: Partial<LogEntry> = {}) {
  const out: Record<string, LogEntry> = {};
  for (const d of view(p).dated)
    if (!d.rest && d.date <= to)
      out[d.id] = {
        status: 'done',
        km: Math.round((d.km ?? 0) * share * 10) / 10,
        sec: Math.round((d.km ?? 0) * share * 330),
        ts: d.date,
        ...extra
      };
  return out;
}
const sync = (day: string) => [{ source: 'strava' as const, lastSuccessDate: day as IsoDate }];

/** Uslov 8 na planu za upis: svaki trening ima strukturu i km > 0; dugi ≥ lagan; nedelja posle `from` ≥ minimum. */
function usable(p: GenPlanState, from: string): void {
  const v2 = v2Of(p);
  const min = P.days[v2.input.runDays.length as 3 | 4 | 5 | 6].weekMinKm;
  p.weeks.forEach((w, i) => {
    const training = w.days.filter((d) => !d.rest);
    expect(training.length, `ned ${w.w}`).toBeGreaterThan(0);
    for (const d of training) {
      expect(d.km, `ned ${w.w} ${d.id}`).toBeGreaterThan(0);
      expect((d.structure?.blocks.length ?? 0) > 0, `ned ${w.w} ${d.id}`).toBe(true);
    }
    const long = training.find((d) => d.tag === 'lr');
    for (const d of training.filter((x) => x.tag === 'lako'))
      if (long) expect(long.km, `ned ${w.w} dugi ≥ lagan`).toBeGreaterThanOrEqual(d.km);
    const vw = v2.weeks[i]!;
    if (vw.startDate > from && vw.phase !== 'race')
      expect(vw.plannedKm, `ned ${w.w} ≥ minimum`).toBeGreaterThanOrEqual(min);
  });
}

describe('činjenice iz aplikacije (facts.ts)', () => {
  it('dnevnik, uvoz, pomeranje, van plana bez duplog brojanja, bol, rezultati, pauze', () => {
    const p = planOf(WITH_RESULT);
    const v2 = v2Of(p);
    const days = view(p).dated.filter((d) => !d.rest);
    const [a, b, c] = days;
    const testDay = days[5]!;
    const today = '2026-11-15' as IsoDate;
    const built = buildFacts(
      {
        today,
        plan: p,
        log: {
          // ručno, sa RPE
          [a!.id]: { status: 'done', km: 8.2, sec: 2700, ts: a!.date, rpe: 4 },
          // uvoz: stvarni dan trčanja iz uvoza
          [b!.id]: {
            status: 'done',
            km: 10,
            sec: 3300,
            runDate: '2026-10-29',
            src: 'strava',
            stravaId: 99
          },
          // propušten
          [c!.id]: { status: 'skip' },
          // bez statusa: nije činjenica
          g9d9: { km: 3 },
          // test 5 km na danu testa i trka iz Analize trke
          [testDay.id]: {
            status: 'done',
            km: 9,
            sec: 3000,
            ts: testDay.date,
            [TEN_K_V2_TEST_FIELD]: 1260,
            raceAi: {
              context: { date: testDay.date, distanceM: 5000, officialSec: 1250, intent: 'race' }
            }
          },
          trka1: {
            status: 'done',
            km: 21.1,
            sec: 6000,
            ts: '2026-11-08',
            raceAi: {
              context: {
                date: '2026-11-08',
                distanceM: 21097.5,
                officialSec: 5990,
                intent: 'controlled'
              }
            }
          },
          trka2: {
            status: 'done',
            km: 8,
            sec: 2400,
            ts: '2026-11-09',
            raceAi: {
              context: { date: '2026-11-09', distanceM: 8000, officialSec: 2400, intent: 'race' }
            }
          }
        },
        outOfPlan: { '2026-10-20': 6 },
        offPlanRuns: {
          'strava:99': { date: '2026-10-29', km: 10, sec: 3300, src: 'strava', id: '99' },
          'strava:100': { date: '2026-11-03', km: 5, sec: 1800, src: 'strava', id: '100' }
        },
        pain: [
          { date: a!.date, pain: 2 },
          { date: a!.date, pain: 3 },
          { date: '2026-11-14', pain: 5 }
        ],
        tests: [{ id: 't1', date: '2026-11-01', sec: 760 }],
        breaks: [{ from: '2026-11-10', to: '2026-11-20' }]
      },
      v2
    );
    const w = built.facts.workouts;
    expect(w.find((x) => x.date === a!.date)).toEqual({
      date: a!.date,
      dayId: a!.date,
      km: 8.2,
      durationSec: 2700,
      completed: true,
      rpe: 4,
      pain: 3
    });
    expect(w.find((x) => x.date === '2026-10-29')).toMatchObject({ dayId: b!.date, km: 10 });
    expect(w.find((x) => x.date === c!.date)).toMatchObject({ completed: false, km: 0 });
    // van plana: pre plana (`vanPlana`) i neupareno uvezeno; isti zapis kao dnevnik se ne broji dvaput
    expect(w.filter((x) => x.dayId === undefined && x.km > 0).map((x) => x.date)).toEqual(
      expect.arrayContaining(['2026-10-20', '2026-11-03'])
    );
    expect(w.filter((x) => x.date === '2026-10-29')).toHaveLength(1);
    expect(built.notes.join(' ')).toMatch(/strava:99 .* van plana se ne broji dvaput/);
    // bol ≥ praga bez treninga: zaseban zapis bez trčanja
    expect(w.find((x) => x.date === '2026-11-14')).toEqual({
      date: '2026-11-14',
      km: 0,
      durationSec: 0,
      completed: false,
      pain: 5
    });
    // rezultati: test 5 km (dan testa), trka 5 km, test 3 km; trka bez punog napora i 8 km ne
    expect(built.facts.results).toEqual([
      { distM: 3000, sec: 760, date: '2026-11-01', kind: 'test' },
      { distM: 5000, sec: 1260, date: testDay.date, kind: 'test' },
      { distM: 5000, sec: 1250, date: testDay.date, kind: 'race' }
    ]);
    expect(built.notes.join(' ')).toMatch(/Trka 2026-11-08 nije uneta kao trka punim naporom/);
    expect(built.notes.join(' ')).toMatch(/Trka 2026-11-09 \(8 km\): plan koristi rezultat/);
    // pauza se seče na danas; bez sinhronizacije i potvrde pokrivenost nije potpuna
    expect(built.facts.breaks).toEqual([{ kind: 'break', from: '2026-11-10', to: today }]);
    expect(built.coverage).toMatchObject({ complete: false, basis: 'none' });
  });

  it('pokrivenost: samo potpuna sinhronizacija danas ili potvrda; neobrađena aktivnost pomera početak', () => {
    const p = planOf(WITH_RESULT);
    const v2 = v2Of(p);
    const today = '2026-11-15' as IsoDate;
    const src = { today, plan: p, log: {} };
    expect(buildFacts({ ...src, sync: sync('2026-11-14') }, v2).coverage.complete).toBe(false);
    expect(buildFacts({ ...src, sync: sync(today) }, v2).coverage).toMatchObject({
      from: START,
      to: today,
      complete: true,
      basis: 'sync'
    });
    expect(buildFacts({ ...src, confirmedDays: 7 }, v2).coverage).toMatchObject({
      from: '2026-11-09',
      complete: true,
      basis: 'confirmed'
    });
    const issue = { date: '2026-11-05', id: '7', reason: 'nepoznat tip' };
    const c = buildFacts({ ...src, sync: [{ ...sync(today)[0]!, issues: [issue] }] }, v2);
    expect(c.coverage).toMatchObject({
      from: '2026-11-06',
      complete: true,
      unprocessed: '2026-11-05'
    });
    expect(c.notes[0]).toMatch(/Strava: aktivnost 7 \(2026-11-05\) nije obrađena — nepoznat tip/);
    const u = buildFacts(
      { ...src, sync: [{ ...sync(today)[0]!, issues: [{ date: null, id: null, reason: 'x' }] }] },
      v2
    );
    expect(u.coverage).toMatchObject({ complete: false, unprocessed: '?' });
  });

  it('zaključani dani: ručne izmene i pomeranja posle poslednje adaptacije (snimak u meta)', () => {
    const p = planOf(WITH_RESULT);
    const v2 = v2Of(p);
    const days = view(p).dated.filter((d) => !d.rest && d.date > '2026-11-20');
    const alt = { tag: 'lako', km: 5, desc: 'x', pace: null, rw: null, paceAuto: false };
    const src = {
      today: '2026-11-15' as IsoDate,
      plan: p,
      log: {},
      alts: { [days[0]!.id]: alt },
      moves: { [days[1]!.id]: days[2]!.date }
    };
    expect(buildFacts(src, v2).facts.lockedDayIds).toEqual([days[0]!.date, days[1]!.date]);
    // posle adaptacije koja je zapamtila iste izmene: ništa nije novo
    const snap = {
      ...p,
      meta: { ...p.meta, [EDITS_KEY]: { alts: src.alts, moves: src.moves } }
    } as GenPlanState;
    expect(buildFacts({ ...src, plan: snap }, v2).facts.lockedDayIds).toEqual([]);
  });
});

describe('pregled prilagođavanja (adaptPreview)', () => {
  it('bez činjenica: plan se ne menja, nema trake', () => {
    const p = planOf(WITH_RESULT);
    const r = ok(tenKV2AdaptPreview(p, '2026-11-15' as IsoDate, {}));
    expect(r.weeks).toEqual([]);
    expect(r.needed).toEqual([]);
    expect(r.summary).toBe('Prilagođavanje 2026-11-15: bez novih činjenica');
    expect(r.result.weeks.map((w) => w.days)).toEqual(p.weeks.map((w) => w.days));
  });

  it('plan po osećaju + test 5 km na danu testa → tempo iz rezultata od sledeće nedelje (struktura po nedelji)', () => {
    const p = planOf(FEEL);
    const test = view(p).dated.find((d) => d.tag === 'test')!;
    const log = logUntil(p, test.date);
    log[test.id] = { ...log[test.id]!, [TEN_K_V2_TEST_FIELD]: 1500 };
    const r = ok(tenKV2AdaptPreview(p, test.date, { log }));
    const res = r.reasons.find((x) => x.condition === 'NEW_RESULT')!;
    expect(res.applied).toBe(true);
    expect(res.message).toMatch(
      /^Test 5 km 25:00 .* plan po osećaju prelazi na tempo iz rezultata/
    );
    expect(r.needed).toEqual([res.message]);
    expect(r.result.meta).toMatchObject({
      paceBasis: 'result',
      vdot: 38.3,
      trainingVdot: 38.3,
      goalAssessment: { status: 'realistic' }
    });
    expect(r.result.meta).toHaveProperty('predicted10kSec');
    expect(r.result.meta?.[EDITS_KEY]).toEqual({ alts: {}, moves: {} });
    const from = v2Of(r.result).adaptation!.steps[0]!.fromWeek;
    const rv = view(r.result);
    for (const w of rv.weeks)
      for (const d of w.days.filter((x) => !x.rest)) {
        const s = d.structure!;
        // lagani delovi: E opseg u svim nedeljama (tempo nedelje, ne poslednje)
        const e = s.blocks.find((b) => ['easy', 'long', 'warmup'].includes(b.step.kind));
        if (e) expect(e.step.paceRange, `${d.id}`).toBeDefined();
        if (d.tag !== 'tempo' && d.tag !== 'int') continue;
        const work = s.blocks.find((b) => b.step.kind === 'work')!.step;
        if (w.w < from) {
          expect(s.rpe, d.id).toBeDefined();
          expect(work.paceSec).toBeNull();
        } else {
          expect(s.rpe, d.id).toBeUndefined();
          expect(work.paceSec).toBeGreaterThan(0);
        }
      }
    // do dana testa sve bajt-isto
    for (const d of view(p).dated.filter((x) => x.date <= test.date))
      expect(rv.byId.get(d.id)!.structure).toEqual(d.structure);
    usable(r.result, test.date);
  });

  it('manjak izvršenja: samo uz potpunu sinhronizaciju (bez nje dan bez zapisa nije poznat)', () => {
    const p = planOf(WITH_RESULT);
    const day = '2026-11-15' as IsoDate;
    const log = logUntil(p, day, 0.4);
    const none = ok(tenKV2AdaptPreview(p, day, { log }));
    expect(none.reasons.map((x) => x.condition)).not.toContain('UNDER_EXECUTION');
    expect(none.weeks).toEqual([]);
    const r = ok(tenKV2AdaptPreview(p, day, { log, facts: { sync: sync(day) } }));
    const under = r.reasons.find((x) => x.condition === 'UNDER_EXECUTION')!;
    expect(under.applied).toBe(true);
    expect(r.needed).toEqual([under.message]);
    expect(r.weeks[0]!.week).toBe(4);
    expect(r.weeks[0]!.after!.targetKm).toBeLessThan(r.weeks[0]!.before!.targetKm);
    expect(r.notes[0]).toMatch(/^Zapis treninga je potpun od/);
    usable(r.result, day);
  });

  it('bol, pauza: traka; zaštita urađenog i ručno izmenjenog dana; posle primene istog dana bez trake', () => {
    const p = planOf(WITH_RESULT);
    const day = '2026-11-15' as IsoDate;
    const future = view(p).dated.filter((d) => !d.rest && d.date > day);
    const locked = future[0]!;
    const alt = { tag: 'lako' as const, km: 5, desc: 'x', pace: null, rw: null, paceAuto: false };
    const r = ok(
      tenKV2AdaptPreview(p, day, {
        alts: { [locked.id]: alt },
        facts: { pain: [{ date: '2026-11-14', pain: 5 }] }
      })
    );
    expect(r.reasons.find((x) => x.condition === 'PAIN')!.applied).toBe(true);
    expect(r.needed).toHaveLength(1);
    const after = view(r.result);
    expect(after.byId.get(locked.id)!.structure).toEqual(locked.structure);
    expect(after.byId.get(future[1]!.id)!.structure).not.toEqual(future[1]!.structure);
    usable(r.result, day);
    // primenjeno → isti dan nema trake; sutra stari bol nije nov
    const applied = stampForStorage(r.result);
    const facts = { pain: [{ date: '2026-11-14', pain: 5 }] };
    const ctx = { alts: { [locked.id]: alt }, facts };
    expect(ok(tenKV2AdaptPreview(applied, day, ctx)).needed).toEqual([]);
    expect(ok(tenKV2AdaptPreview(applied, '2026-11-16' as IsoDate, ctx)).needed).toEqual([]);
    // prijavljena pauza
    const b = ok(tenKV2AdaptPreview(p, day, {}, [{ from: '2026-11-06', to: '2026-11-15' }]));
    expect(b.reasons.find((x) => x.condition === 'PAUSE')!.message).toMatch(
      /^Pauza \(prijavljena\) 10 dana/
    );
    usable(b.result, day);
  });

  it('odbijanje v2 doslovno: rezultat posle danas nije činjenica, plan bez v2 nije plan', () => {
    const p = planOf(WITH_RESULT);
    const bad = tenKV2AdaptPreview({ ...p, tenKV2: null }, '2026-11-15' as IsoDate, {});
    expect(bad).toMatchObject({ ok: false, reasons: [{ code: 'ADAPT_PLAN_INVALID' }] });
    const race = tenKV2AdaptPreview(p, RACE as IsoDate, {});
    expect(race.ok).toBe(false);
    if (!race.ok) expect(race.reasons[0]!.code).toBe('ADAPT_AS_OF_INVALID');
  });
});

describe('vraćanje verzije, promena cilja, forma, članovi (b)', () => {
  it('vraćanje: budući nezaštićeni dani iz verzije, urađeni ostaju; isti plan → 0 dana', () => {
    const p = planOf(WITH_RESULT);
    const day = '2026-11-15' as IsoDate;
    const pain = ok(tenKV2AdaptPreview(p, day, { facts: { pain: [{ date: day, pain: 5 }] } }));
    const applied = stampForStorage(pain.result);
    const next = '2026-11-18' as IsoDate;
    const done = view(applied).dated.find((d) => !d.rest && d.date > day && d.date <= next)!;
    const log = { [done.id]: { status: 'done', km: 5, sec: 1800 } };
    // Budući ručno izmenjen dan (posle danas, u nedelji bola — razlikuje se od sačuvane verzije) ostaje iz trenutnog plana.
    const original0 = view(p);
    const edited = view(applied).dated.find(
      (d) =>
        !d.rest &&
        d.date > next &&
        JSON.stringify(d.structure) !== JSON.stringify(original0.byId.get(d.id)?.structure)
    )!;
    const alt = { tag: 'lako' as const, km: 5, desc: 'x', pace: null, rw: null, paceAuto: false };
    const back = TEN_K_V2_GENERATOR.graftFuturePlan(applied, p, next, {
      log,
      alts: { [edited.id]: alt }
    });
    const ch = back.meta!['futureChanges'] as { changedDays: number; conflicts: string[] };
    expect(ch.changedDays).toBeGreaterThan(10);
    expect(ch.conflicts).toEqual([]);
    const bv = view(back);
    expect(bv.byId.get(done.id)!.structure).toEqual(done.structure);
    expect(bv.byId.get(edited.id)!.structure).toEqual(edited.structure);
    const original = view(p);
    for (const d of original.dated.filter((x) => x.date > '2026-11-22'))
      expect(bv.byId.get(d.id)!.structure, d.id).toEqual(d.structure);
    expect(TEN_K_V2_GENERATOR.graftFuturePlan(p, p, next).meta!['futureChanges']).toEqual({
      changedDays: 0,
      conflicts: []
    });
    const other = planOf({ ...WITH_RESULT, startDate: tenKV2Start(RACE, '2026-11-02')! });
    expect(
      (
        TEN_K_V2_GENERATOR.graftFuturePlan(p, other, next).meta!['futureChanges'] as {
          conflicts: string[];
        }
      ).conflicts[0]
    ).toMatch(/drugi broj nedelja/);
  });

  it('promena cilja: treninzi bajt-isti, menja se samo ocena; po osećaju bez ocene; neispravan cilj odbijen', () => {
    const p = planOf(WITH_RESULT);
    const g = tenKV2GoalChange(p, 2500, '2026-11-20' as IsoDate);
    if (!g.ok) throw new Error(JSON.stringify(g.reasons));
    expect(g.result.weeks.map((w) => w.days)).toEqual(p.weeks.map((w) => w.days));
    expect(g.result.meta?.goalSec).toBe(2500);
    expect(g.before!.status).toBe('ambitious');
    expect(g.after!.status).toBe('unrealistic');
    const viaContract = TEN_K_V2_GENERATOR.planWithNewGoal(p, 2500, '2026-11-20' as IsoDate);
    expect('error' in viaContract).toBe(false);
    if (!('error' in viaContract))
      expect(viaContract.goalChange).toMatchObject({ from: 2580, to: 2500, changedWeeks: 0 });
    const f = planOf(FEEL);
    const gf = tenKV2GoalChange(f, 3000, '2026-11-02' as IsoDate);
    expect(gf).toMatchObject({ ok: true, before: null, after: null });
    // Cilj mora biti > 0 (v2 ga ne ograničava odozdo: nerealan cilj dobija ocenu, ne odbijanje).
    expect(tenKV2GoalChange(p, 0, '2026-11-20' as IsoDate).ok).toBe(false);
    expect(tenKV2GoalChange(p, 1800, '2026-11-20' as IsoDate)).toMatchObject({
      ok: true,
      after: { status: 'unrealistic' }
    });
  });

  it('forma: start iz čarobnjaka, primenjen rezultat (od sledeće nedelje), nov rezultat čeka', () => {
    const p = planOf(FEEL);
    const test = view(p).dated.find((d) => d.tag === 'test')!;
    const log = logUntil(p, test.date);
    log[test.id] = { ...log[test.id]!, [TEN_K_V2_TEST_FIELD]: 1500 };
    const before = tenKV2FormHistory({ plan: p, today: test.date, log })!;
    expect(before.mode).toBe('feel');
    expect(before.points).toEqual([
      expect.objectContaining({ kind: 'test', status: 'pending', vdot: 38.3 })
    ]);
    const applied = stampForStorage(ok(tenKV2AdaptPreview(p, test.date, { log })).result);
    const now = tenKV2FormHistory({ plan: applied, today: test.date, log })!;
    expect(now).toMatchObject({ mode: 'feel', current: null, next: { vdot: 38.3 } });
    expect(now.points).toEqual([expect.objectContaining({ status: 'used', vdot: 38.3 })]);
    const later = tenKV2FormHistory({
      plan: applied,
      today: '2026-12-10' as IsoDate,
      log,
      tests: [{ id: 't', date: '2026-12-08', sec: 780 }]
    })!;
    expect(later).toMatchObject({ mode: 'vdot', current: 38.3, next: null });
    expect(later.predicted10kSec).toBeGreaterThan(3000);
    expect(later.points.at(-1)).toMatchObject({ kind: 'test', status: 'pending' });
    const res = tenKV2FormHistory({ plan: planOf(WITH_RESULT), today: '2026-11-02' as IsoDate })!;
    expect(res.points[0]).toMatchObject({ kind: 'start', status: 'used' });
    expect(res.goal!.status).toBe('ambitious');
  });

  it('članovi (b) kroz isti tok: izvršenje sa potvrđenom pauzom → pregled v2', () => {
    const p = planOf(WITH_RESULT);
    const r = TEN_K_V2_GENERATOR.buildExecutionAdjustment(
      p,
      '2026-11-15' as IsoDate,
      null as never,
      { breakDays: 10 },
      {}
    );
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.summary).toBe('Prilagođavanje 2026-11-15: pauza');
    expect(r.notes[0]).toMatch(/^Pauza \(prijavljena\) 10 dana/);
    expect(TEN_K_V2_GENERATOR.planPolicy(r.result).status).toBe('current');
  });

  it('predaja HM/maraton → kraća distanca 10K ostaje 10K v1 (10K v2 kao cilj predaje tek sa HM v2)', () => {
    expect(regeneratorForDistance(10000)).toBe(tenK.handoffFuture);
    expect(TEN_K_GENERATOR.policyId).toBe('10k-v1');
  });
});
