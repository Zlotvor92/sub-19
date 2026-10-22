import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../../date';
import { weekPlanKm, weekRace, weekRealKm } from '../../../../day';
import { resolvePlan, setAlt } from '../../../../plan';
import { getPlanRevisions, recordPlanRevision } from '../../../../plan/versions';
import {
  buildBackup,
  importBackup,
  migrateState,
  seedState,
  type GenPlanState,
  type LogEntry,
  type PersistedState
} from '../../../../state';
import type { StructuredPlanInput } from '../../../contract';
import { fiveKV2ToggleVisible } from '../../../flags';
import {
  FIVE_K_GENERATOR,
  FIVE_K_V2_GENERATOR,
  fiveKV2AdaptPreview,
  fiveKV2FormHistory,
  fiveKV2GoalChange,
  generateFiveKV2Plan,
  generatorForPlan,
  isFiveKV2Plan,
  stampForStorage
} from '../../../select';
import { v2Of } from './adapt';
import { buildFacts, EDITS_KEY } from './facts';
import { KNOWN_VERSIONS, planPolicy } from './plan';

/* SEGMENT 08b — adaptacija 5K v2 u aplikaciji: činjenice (1–5), tok pregled → potvrda → revizija → vraćanje (6), traka
   (7), ugovor (b) (8), forma iz rezultata (9), prekidač (10), km nedelje (12), izmena samo tempa (13). */

const WITH_RESULT: StructuredPlanInput = {
  startDate: '2026-11-02',
  raceDate: '2027-01-10',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 25,
  recentResult: { distanceM: 5000, timeSec: 1500, date: '2026-10-20' },
  goalTimeSec: 1440
};
const FEEL: StructuredPlanInput = {
  startDate: '2026-11-02',
  raceDate: '2027-01-10',
  runDays: ['tue', 'thu', 'sun'],
  currentWeeklyKm: 18,
  typicalEasyPaceSecPerKm: 390,
  goalTimeSec: 1800,
  experience: 'beginner',
  canRun30Min: true
};
const RUN_WALK: StructuredPlanInput = {
  startDate: '2026-11-02',
  raceDate: '2027-01-10',
  runDays: ['mon', 'wed', 'sat'],
  currentWeeklyKm: 0,
  experience: 'beginner',
  canRun30Min: false
};

function planOf(input: StructuredPlanInput): GenPlanState {
  const r = generateFiveKV2Plan(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
}
const view = (p: GenPlanState, alts = {}) => resolvePlan(p.weeks, { alts, moves: {} });
const d = (s: string) => s as IsoDate;
/** Odrađeni treninzi u [from, to] kako ih plan propisuje (km plana, 6:00/km). */
function logDone(p: GenPlanState, from: string, to: string, extra: Partial<LogEntry> = {}) {
  const out: Record<string, LogEntry> = {};
  for (const day of view(p).dated)
    if (!day.rest && day.date >= from && day.date <= to)
      out[day.id] = {
        status: 'done',
        km: day.km ?? 0,
        sec: Math.round((day.km ?? 5) * 360),
        ts: day.date,
        ...extra
      };
  return out;
}
const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
};
const commit = (before: GenPlanState, result: GenPlanState, today: string, summary: string) =>
  recordPlanRevision(before, stampForStorage(result), {
    reason: 'execution',
    date: today,
    summary
  });

describe('A. činjenice iz aplikacije (facts.ts, jedno mesto)', () => {
  it('1. izvršeno: dnevnik (ručno i uvoz), propušteno, bez statusa nije činjenica; dayId = dan v2; pomeren dan; bol; RPE', () => {
    const plan = planOf(WITH_RESULT);
    const log: Record<string, LogEntry> = {
      g1d2: { status: 'done', km: 5, sec: 1800, ts: '2026-11-03', rpe: 4 },
      g1d4: { status: 'done', km: 6.2, sec: 2100, runDate: '2026-11-05', src: 'strava' },
      g1d6: { status: 'skip' },
      g1d7: { status: 'pending', km: 4 },
      g2d2: { status: 'done', km: 5, sec: 1700 }
    };
    const f = buildFacts(
      {
        today: d('2026-11-12'),
        plan,
        log,
        moves: { g2d2: '2026-11-11' },
        pain: [
          { date: '2026-11-05', pain: 3 },
          { date: '2026-11-06', pain: 5 },
          { date: '2026-11-09', pain: 2 }
        ]
      },
      v2Of(plan)!
    );
    expect(f.facts.workouts).toEqual([
      {
        date: '2026-11-03',
        dayId: '2026-11-03',
        km: 5,
        durationSec: 1800,
        completed: true,
        rpe: 4
      },
      {
        date: '2026-11-05',
        dayId: '2026-11-05',
        km: 6.2,
        durationSec: 2100,
        completed: true,
        pain: 3
      },
      // bol ≥ praga bez treninga tog dana: zaseban zapis bez trčanja; bol 2 bez treninga ne ulazi
      { date: '2026-11-06', km: 0, durationSec: 0, completed: false, pain: 5 },
      { date: '2026-11-07', dayId: '2026-11-07', km: 0, durationSec: 0, completed: false },
      // pomeren dan: stvarni datum, a dayId ostaje datum dana u planu v2
      { date: '2026-11-11', dayId: '2026-11-10', km: 5, durationSec: 1700, completed: true }
    ]);
    // Pomeranje je ručna izmena posle nastanka plana → zaključan dan v2.
    expect(f.facts.lockedDayIds).toEqual(['2026-11-10']);
  });

  it('2. rezultati: test 3 km i uneta trka punim naporom na 3/5/10 km; ostalo u napomenama (ne tiho)', () => {
    const plan = planOf(WITH_RESULT);
    const race = (date: string, distanceM: number, officialSec: number, intent: string) => ({
      status: 'done',
      km: distanceM / 1000,
      sec: officialSec,
      ts: date,
      raceAi: { context: { date, distanceM, officialSec, intent } }
    });
    const f = buildFacts(
      {
        today: d('2026-11-12'),
        plan,
        log: {
          'race-a': race('2026-11-07', 5000, 1440, 'race'),
          'race-b': race('2026-11-01', 21097.5, 6000, 'race'),
          'race-c': race('2026-11-02', 5000, 1500, 'controlled')
        },
        tests: [{ id: 't3k-1', date: '2026-11-08', sec: 780 }]
      },
      v2Of(plan)!
    );
    expect(f.facts.results).toEqual([
      { distM: 5000, sec: 1440, date: '2026-11-07', kind: 'race' },
      { distM: 3000, sec: 780, date: '2026-11-08', kind: 'test' }
    ]);
    expect(f.notes).toEqual([
      'Trka 2026-11-01 (21.0975 km): plan koristi rezultat na 3, 5 ili 10 km — ne menja tempo.',
      'Trka 2026-11-02 nije uneta kao trka punim naporom — ne menja tempo.'
    ]);
  });

  it('3. pokrivenost: nikad pretpostavljena — sinhronizacija uspešna danas ili potvrda korisnika', () => {
    const plan = planOf(WITH_RESULT);
    const v2 = v2Of(plan)!;
    const cov = (extra: object) =>
      buildFacts({ today: d('2026-11-20'), plan, log: {}, ...extra }, v2).coverage;
    expect(cov({})).toEqual({
      from: '2026-11-02',
      to: '2026-11-20',
      complete: false,
      basis: 'none'
    });
    expect(cov({ sync: [{ source: 'strava', lastSuccessDate: '2026-11-19' }] }).complete).toBe(
      false
    );
    expect(cov({ sync: [{ source: 'strava', lastSuccessDate: null }] }).complete).toBe(false);
    expect(cov({ sync: [{ source: 'icu', lastSuccessDate: '2026-11-20' }] })).toEqual({
      from: '2026-11-02',
      to: '2026-11-20',
      complete: true,
      basis: 'sync',
      source: 'icu'
    });
    expect(cov({ confirmedDays: 14 })).toEqual({
      from: '2026-11-07',
      to: '2026-11-20',
      complete: true,
      basis: 'confirmed'
    });
    // Činjenica ide u jezgro samo kao {from, to, complete}.
    expect(buildFacts({ today: d('2026-11-20'), plan, log: {} }, v2).facts.coverage).toEqual({
      from: '2026-11-02',
      to: '2026-11-20',
      complete: false
    });
  });

  it('4. eksplicitna pauza → facts.breaks (najkasnije do danas)', () => {
    const plan = planOf(WITH_RESULT);
    const f = buildFacts(
      {
        today: d('2026-11-20'),
        plan,
        log: {},
        breaks: [
          { from: '2026-11-10', to: '2026-11-25' },
          { from: '2026-11-22', to: '2026-11-23' }
        ]
      },
      v2Of(plan)!
    );
    expect(f.facts.breaks).toEqual([{ kind: 'break', from: '2026-11-10', to: '2026-11-20' }]);
  });

  it('5. zaključani dani: ručna izmena ili pomeranje POSLE poslednje adaptacije', () => {
    const plan = planOf(WITH_RESULT);
    const alt = {
      tag: 'lako' as const,
      km: 4,
      desc: 'lako',
      pace: null,
      rw: null,
      paceAuto: false
    };
    const src = (p: GenPlanState, alts: Record<string, typeof alt>) => ({
      today: d('2026-11-12'),
      plan: p,
      log: {},
      alts,
      moves: {}
    });
    const first = buildFacts(src(plan, { g3d2: alt, g3d1: alt }), v2Of(plan)!);
    expect(first.facts.lockedDayIds).toEqual(['2026-11-17']);
    expect(first.notes).toEqual([
      'Ručna izmena dana 2026-11-16 ostaje kao izmena; dan nije trening plana v2, pa ga adaptacija ne zaključava.'
    ]);
    // Posle primenjene adaptacije iste izmene su „pre poslednje adaptacije"; nova/izmenjena posle nje — zaključana.
    const applied = ok(fiveKV2AdaptPreview(plan, d('2026-11-12'), { alts: { g3d2: alt } })).result;
    expect(applied.meta?.[EDITS_KEY]).toEqual({ alts: { g3d2: alt }, moves: {} });
    expect(buildFacts(src(applied, { g3d2: alt }), v2Of(applied)!).facts.lockedDayIds).toEqual([]);
    expect(
      buildFacts(src(applied, { g3d2: { ...alt, km: 5 } }), v2Of(applied)!).facts.lockedDayIds
    ).toEqual(['2026-11-17']);
  });
});

describe('B. tok prilagođavanja: pregled → potvrda → nova revizija → vraćanje', () => {
  it('6. dnevnik 2 nedelje, propuštena nedelja: bez potvrde ništa; uz potvrdu pauza, pregled, revizija, vraćanje', () => {
    const plan = planOf(WITH_RESULT);
    const log = logDone(plan, '2026-11-02', '2026-11-08');
    const today = d('2026-11-15');
    // Nepotpun zapis: dan bez zapisa nije pauza → budući deo plana ostaje isti.
    const none = ok(fiveKV2AdaptPreview(plan, today, { log }));
    expect(none.coverage.complete).toBe(false);
    expect(none.weeks).toEqual([]);
    expect(none.needed).toEqual([]);
    // Potvrda „zapis za proteklih 14 dana je potpun" → pauza 7 dana.
    const pr = ok(fiveKV2AdaptPreview(plan, today, { log, facts: { confirmedDays: 14 } }));
    const pause = pr.reasons.find((r) => r.condition === 'PAUSE')!;
    expect(pause.applied).toBe(true);
    expect(pause.message).toMatch(/^Pauza 7 dana \(obim 7 dana pre pauze/);
    expect(pr.summary).toBe('Prilagođavanje 2026-11-15: pauza');
    expect(pr.weeks.length).toBeGreaterThan(0);
    expect(pr.weeks[0]!.week).toBe(3);
    expect(pr.weeks[0]!.after!.targetKm!).toBeLessThan(pr.weeks[0]!.before!.targetKm!);
    expect(pr.notes[0]).toMatch(/^Potvrdio si da je zapis za proteklih 14 dana potpun/);
    // Potvrda → nova revizija; prošle nedelje bajt-iste, plan ostaje v2.
    const next = commit(plan, pr.result, today, pr.summary);
    expect(isFiveKV2Plan(next)).toBe(true);
    expect(getPlanRevisions(next)).toHaveLength(1);
    expect(next.weeks.slice(0, 2)).toEqual(plan.weeks.slice(0, 2));
    expect((next['fiveKV2'] as { adaptation: { asOf: string } }).adaptation.asOf).toBe(today);
    // Vraćanje revizije: budući dani iz sačuvane verzije, prošlost ostaje.
    const rev = getPlanRevisions(next)[0]!;
    expect(rev.snapshot['fiveKV2']).toEqual(plan['fiveKV2']);
    const back = FIVE_K_V2_GENERATOR.graftFuturePlan(next, rev.snapshot, d('2026-11-16'), { log });
    const fc = back.meta?.['futureChanges'] as { changedDays: number; conflicts: string[] };
    expect(fc.conflicts).toEqual([]);
    expect(fc.changedDays).toBeGreaterThan(0);
    expect(back.weeks.slice(2)).toEqual(plan.weeks.slice(2));
    expect(back.weeks.slice(0, 2)).toEqual(next.weeks.slice(0, 2));
    // Vraćen plan je i dalje ispravan v2 plan: nova adaptacija radi nad njim.
    expect(ok(fiveKV2AdaptPreview(back, d('2026-11-16'), { log })).ok).toBe(true);
  });

  it('6b. odbijanje v2 → razlozi doslovno, bez plana', () => {
    const plan = planOf(WITH_RESULT);
    const r = fiveKV2AdaptPreview(plan, d('2026-11-12'), {
      facts: { tests: [{ id: 't', date: '2026-11-10', sec: 420 }] }
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons[0]!.code).toBe('VDOT_OUT_OF_RANGE');
    expect(r.reasons[0]!.message).toMatch(
      /^VDOT novog rezultata \(\d+(\.\d)?\) mora biti 30–60\.$/
    );
  });

  it('7. bol 5 → traka (aktivno ograničenje) → primena → traka nestaje (bez automatskog upisa)', () => {
    const plan = planOf(WITH_RESULT);
    const today = d('2026-11-12');
    const ctx = { facts: { pain: [{ date: '2026-11-11', pain: 5 }] } };
    const pr = ok(fiveKV2AdaptPreview(plan, today, ctx));
    expect(pr.needed).toHaveLength(1);
    expect(pr.needed[0]).toMatch(/^Bol 5\/10 u poslednja 3 dana: 7 dana bez kvaliteta/);
    // Pregled ne menja ulazni plan.
    expect(isFiveKV2Plan(plan) && (plan['fiveKV2'] as { adaptation?: unknown }).adaptation).toBe(
      undefined
    );
    const next = commit(plan, pr.result, today, pr.summary);
    expect(ok(fiveKV2AdaptPreview(next, today, ctx)).needed).toEqual([]);
    expect(ok(fiveKV2AdaptPreview(next, d('2026-11-13'), ctx)).needed).toEqual([]);
    // Nov zapis bola posle primene, a period bez kvaliteta pokriva nove dane kvaliteta → ponovo traka.
    const again = { facts: { pain: [...ctx.facts.pain, { date: '2026-11-19', pain: 6 }] } };
    expect(ok(fiveKV2AdaptPreview(next, d('2026-11-19'), again)).needed).toHaveLength(1);
    // Nov bol koji ne menja nijedan budući trening (period pada na dane bez kvaliteta) → bez trake.
    const quiet = { facts: { pain: [...ctx.facts.pain, { date: '2026-11-13', pain: 6 }] } };
    expect(ok(fiveKV2AdaptPreview(next, d('2026-11-13'), quiet)).needed).toEqual([]);
  });

  it('7b. test 3 km u planu po osećaju → prelaz na tempo (traka, pregled)', () => {
    const plan = planOf(FEEL);
    const test = view(plan).dated.find((x) => x.tag === 'test')!;
    const pr = ok(
      fiveKV2AdaptPreview(plan, test.date, {
        facts: { tests: [{ id: 't3k', date: test.date, sec: 810 }] }
      })
    );
    const res = pr.reasons.find((r) => r.condition === 'NEW_RESULT')!;
    expect(res.applied).toBe(true);
    expect(res.message).toMatch(/plan po osećaju prelazi na tempo/);
    expect(pr.needed).toContain(res.message);
    const v2 = pr.result['fiveKV2'] as { paceMode: string };
    expect(v2.paceMode).toBe('vdot');
    // Kvalitet posle testa ima brojčani tempo u strukturi.
    const later = view(pr.result).dated.filter(
      (x) => x.date > test.date && (x.tag === 'int' || x.tag === 'tempo')
    );
    expect(later.length).toBeGreaterThan(0);
    expect(
      later.some((x) =>
        x.structure!.blocks.some((b) => b.step.paceSec !== null && b.step.kind === 'work')
      )
    ).toBe(true);
  });

  it('7c. trčanje/hodanje: 3 sesije RPE 5 → nivo +1 (kao projekcija); RPE 7 → nivo ostaje, traka', () => {
    const plan = planOf(RUN_WALK);
    const sessions = view(plan)
      .dated.filter((x) => !x.rest)
      .slice(0, 3);
    const logOf = (rpe: number) =>
      Object.fromEntries(
        sessions.map((s) => [s.id, { status: 'done', km: 0, sec: 1800, ts: s.date, rpe }])
      );
    const today = sessions[2]!.date;
    const pr = ok(fiveKV2AdaptPreview(plan, today, { log: logOf(5) }));
    const level = pr.reasons.find((r) => r.condition === 'LEVEL')!;
    expect(level.message).toMatch(
      /: L2 \(bilo L1; \+1 posle po 2 uzastopne sesije RPE ≤ 6 bez bola\)/
    );
    const v2 = pr.result['fiveKV2'] as { adaptation: { steps: Array<{ level: number }> } };
    expect(v2.adaptation.steps.at(-1)!.level).toBe(2);
    // L2 posle 3 sesije je upravo projekcija generatora: budući deo se ne menja, traka se ne nudi.
    expect(pr.weeks).toEqual([]);
    expect(pr.needed).toEqual([]);
    // RPE 7: nivo ostaje L1, projekcija se pomera → pregled i traka.
    const hard = ok(fiveKV2AdaptPreview(plan, today, { log: logOf(7) }));
    expect(hard.reasons.find((r) => r.condition === 'LEVEL')!.message).toMatch(/: L1 \(bilo L1\)/);
    expect(hard.weeks.length).toBeGreaterThan(0);
    expect(hard.needed).toEqual(['3 sesija sa RPE ≥ 7: nivo se na njima ne povećava.']);
  });

  it('promena cilja: isti ulaz sa novim ciljem — treninzi i tempo bajt-isti, menja se samo ocena cilja', () => {
    const plan = planOf(WITH_RESULT);
    const r = fiveKV2GoalChange(plan, 1300, d('2026-11-12'));
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    expect(r.before?.status).toBe('ambitious');
    expect(r.after?.status).toBe('unrealistic');
    expect(r.result.weeks.map((w) => w.days)).toEqual(plan.weeks.map((w) => w.days));
    const a = r.result['fiveKV2'] as { paces: unknown; input: { goalTimeSec: number } };
    expect(a.paces).toEqual((plan['fiveKV2'] as { paces: unknown }).paces);
    expect(a.input.goalTimeSec).toBe(1300);
    expect(r.result.meta?.goalSec).toBe(1300);
    const rw = fiveKV2GoalChange(planOf(RUN_WALK), 1800, d('2026-11-12'));
    expect(rw.ok).toBe(false);
  });
});

describe('prelaz i trajnost', () => {
  it('trčanje/hodanje → L12 → prelaz na kontinuirani plan: prikaz nastavlja brojeve nedelja, faza iz v2', () => {
    const plan = planOf({ ...RUN_WALK, startDate: '2026-09-21', typicalEasyPaceSecPerKm: 420 });
    const log = Object.fromEntries(
      view(plan)
        .dated.filter((x) => !x.rest && x.date <= '2026-11-15')
        .map((x) => [x.id, { status: 'done', km: 0, sec: 1800, ts: x.date, rpe: 5 }])
    );
    const pr = ok(
      fiveKV2AdaptPreview(plan, d('2026-11-15'), { log, facts: { confirmedDays: 56 } })
    );
    const tr = pr.reasons.find((r) => r.condition === 'TRANSITION')!;
    expect(tr.applied).toBe(true);
    expect(pr.needed).toContain(tr.message);
    const r = pr.result;
    expect(r.weeks.map((w) => w.w)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(r.weeks.slice(0, 8)).toEqual(plan.weeks.slice(0, 8));
    expect(r.weeks[8]!.phase).toBe('BAZA');
    expect(r.weeks[15]!.phase).toBe('TRKA');
    expect(r.weeks[8]!.days.filter((x) => !x.rest).every((x) => x.tag !== 'rw')).toBe(true);
    expect(isFiveKV2Plan(stampForStorage(r))).toBe(true);
    // Vraćanje verzije pre prelaza bi menjalo vrstu plana → odbija se sa razlogom.
    const next = commit(plan, r, '2026-11-15', pr.summary);
    const back = FIVE_K_V2_GENERATOR.graftFuturePlan(
      next,
      getPlanRevisions(next)[0]!.snapshot,
      d('2026-11-16')
    );
    expect(back.meta?.['futureChanges']).toMatchObject({ changedDays: 0 });
  });

  it('prilagođen plan (revizije, izmene u trenutku adaptacije) se čuva bajt-isto: učitavanje, backup, uvoz', () => {
    const plan = planOf(WITH_RESULT);
    const log = logDone(plan, '2026-11-02', '2026-11-08');
    const pr = ok(
      fiveKV2AdaptPreview(plan, d('2026-11-15'), { log, facts: { confirmedDays: 14 } })
    );
    const next = commit(plan, pr.result, '2026-11-15', pr.summary);
    const state: PersistedState = { ...seedState('2026-11-15'), genPlan: next, log };
    const reloaded = migrateState(JSON.parse(JSON.stringify(state)) as unknown)!;
    expect(JSON.stringify(reloaded.genPlan)).toBe(JSON.stringify(next));
    const file = JSON.parse(
      JSON.stringify(buildBackup(reloaded, '2026-11-15T10:00:00.000Z'))
    ) as unknown;
    const imported = importBackup(file, seedState('2026-11-15'));
    if (!imported.ok) throw new Error('uvoz');
    expect(JSON.stringify(imported.state.genPlan)).toBe(JSON.stringify(next));
    expect(getPlanRevisions(imported.state.genPlan)).toHaveLength(1);
  });
});

describe('8. ugovor (b) posle 08b: kroz činjenice i adaptFiveKV2, nijedan poziv v1', () => {
  const g = FIVE_K_V2_GENERATOR;
  const today = d('2026-11-15');

  it('izvršenje/pauza → pregled v2; run/walk → isti tok; nepodržano samo sa razlogom', () => {
    const plan = planOf(WITH_RESULT);
    const log = logDone(plan, '2026-11-02', '2026-11-08');
    const r = g.buildExecutionAdjustment(plan, today, null as never, { breakDays: 7 }, { log });
    if ('error' in r) throw new Error(r.error);
    expect(r.summary).toBe('Prilagođavanje 2026-11-15: pauza');
    expect(r.notes[0]).toMatch(/^Pauza \(prijavljena\) 7 dana/);
    expect(g.buildRunWalkAdjustment(plan, today, null as never, { mode: 'hold' })).toEqual({
      error: 'Plan nije plan trčanje/hodanje.'
    });
    const rw = g.buildRunWalkAdjustment(planOf(RUN_WALK), today, null as never, { mode: 'hold' });
    expect('error' in rw ? rw.error : rw.notes[0]).toMatch(
      /^Nivo trčanja\/hodanja određuje plan v2/
    );
    expect(g.executionBasis(plan, today, null as never, {})).toEqual({
      error:
        'Odluka o pripremi (produženje, kraća distanca) postoji samo za polumaraton i maraton; plan 5K v2 je nema.'
    });
    const m = g.executionModel(view(plan), today, { log });
    expect(m.analysis).toMatchObject({ completed: 4, actualKm: expect.any(Number) as number });
    expect(m.recommendation).toMatchObject({ kind: null, actionable: false });
  });

  it('bol, forma, cilj, rekalibracija: kroz činjenice/rezultate; merenje iz treninga „ne koristi se"', () => {
    const plan = planOf(WITH_RESULT);
    expect(g.injuryProposal({} as never, today)).toBeNull();
    expect(g.vdotProposal({} as never)).toBeNull();
    expect(g.classifyMeasurement({} as never)).toEqual({
      status: 'not-used',
      reason: 'plan-uses-results',
      message:
        'Ne koristi se u ovom planu: 5K v2 menja tempo samo iz rezultata (test 3 km ili trka), ne iz tempa treninga.'
    });
    expect(g.planRecalibrated(plan, 45, today)).toEqual({
      error:
        'Plan 5K v2 se ne preračunava prema formi iz treninga: tempo menja nov rezultat (test 3 km ili trka), kroz Plan → Prilagodi plan.'
    });
    const goal = g.planWithNewGoal(plan, 1300, today);
    if ('error' in goal) throw new Error(goal.error);
    expect(goal.goalChange).toEqual({ week: 3, from: 1440, to: 1300, changedWeeks: 0 });
    expect(goal.weeks.map((w) => w.days)).toEqual(plan.weeks.map((w) => w.days));
    const tests = [{ id: 't', date: '2026-11-10', sec: 780 }];
    const ev = g.fitnessEvidence({ today, tests } as never);
    expect(ev).toMatchObject({ form: expect.any(Number) as number, confirmedTests: 1, chain: [] });
    expect(g.hasRecentMeasuredForm(today, { t3k: tests })).toBe(true);
    expect(g.hasRecentMeasuredForm('2027-03-01', { t3k: tests })).toBe(false);
    expect(g.planVdotNow({ today, plan: view(plan), meta: plan.meta as never })).toBeCloseTo(
      38.3,
      1
    );
    // Nijedan član nije funkcija starog 5K.
    const v2 = g as unknown as Record<string, unknown>;
    const v1 = FIVE_K_GENERATOR as unknown as Record<string, unknown>;
    for (const k of Object.keys(v2))
      if (typeof v2[k] === 'function') expect(v2[k], k).not.toBe(v1[k]);
  });
});

describe('9. Napredak → Forma: VDOT iz rezultata v2 i ocena cilja, bez lanca forme v1', () => {
  it('rezultat čarobnjaka u upotrebi; nov test čeka prilagođavanje; posle primene u planu', () => {
    const plan = planOf(WITH_RESULT);
    const tests = [{ id: 't', date: '2026-11-10', sec: 760 }];
    const h = fiveKV2FormHistory({ plan, today: d('2026-11-12'), tests })!;
    expect(h.mode).toBe('vdot');
    expect(h.current).toBeCloseTo(38.3, 1);
    expect(h.goal).toMatchObject({ status: 'ambitious', label: 'ambiciozan' });
    expect(h.points.map((p) => p.status)).toEqual(['used', 'pending']);
    const pr = ok(fiveKV2AdaptPreview(plan, d('2026-11-12'), { facts: { tests } }));
    const next = commit(plan, pr.result, '2026-11-12', pr.summary);
    const after = fiveKV2FormHistory({ plan: next, today: d('2026-11-17'), tests })!;
    expect(after.points.map((p) => p.status)).toEqual(['used', 'used']);
    expect(after.current).toBeGreaterThan(h.current!);
    expect(fiveKV2FormHistory({ plan: planOf(RUN_WALK), today: d('2026-11-12') })!.mode).toBe(
      'runWalk'
    );
  });
});

describe('10. prekidač: vidljiv samo uz VITE_FIVEK_V2 ili administratoru', () => {
  it('pravilo vidljivosti', () => {
    expect(fiveKV2ToggleVisible({ devOverride: undefined, isAdmin: false })).toBe(false);
    expect(fiveKV2ToggleVisible({ devOverride: '', isAdmin: false })).toBe(false);
    expect(fiveKV2ToggleVisible({ devOverride: '1', isAdmin: false })).toBe(true);
    expect(fiveKV2ToggleVisible({ devOverride: '0', isAdmin: false })).toBe(true);
    expect(fiveKV2ToggleVisible({ devOverride: undefined, isAdmin: true })).toBe(true);
  });
});

describe('12. km nedelje kao u v2: trka van obima, prikazana posebno', () => {
  it('trkačka nedelja v2 = planirano v2; trka posebno; plan bez strukture kao do sada', () => {
    const plan = planOf(WITH_RESULT);
    const v2 = plan['fiveKV2'] as { weeks: Array<{ plannedKm: number }> };
    const weeks = view(plan).weeks;
    weeks.forEach((w, i) => expect(weekPlanKm(w)).toBeCloseTo(v2.weeks[i]!.plannedKm, 1));
    const race = weekRace(weeks[9]!)!;
    expect(race.raceKm).toBe(5);
    expect(race.dayKm).toBeGreaterThan(5);
    expect(weekRace(weeks[8]!)).toBeNull();
    // Odrađena trka se ne sabira u ostvareni obim nedelje (prikazana je posebno).
    const raceDay = weeks[9]!.days.find((x) => x.tag === 'trka')!;
    expect(weekRealKm(weeks[9]!, { [raceDay.id]: { status: 'done', km: 9 } })).toBe(0);
    // Ručno izmenjen dan trke (bez strukture) računa se kao do sada.
    const plain = { days: [{ ...raceDay, structure: undefined, km: 5 }] };
    expect(weekPlanKm(plain)).toBe(5);
  });
});

describe('13. ručna izmena v2 dana: samo tempo zadržava strukturu, tip je briše', () => {
  it('novi tempo u koracima rada; zagrevanje, oporavak, hlađenje isti; izmena tipa briše strukturu', () => {
    const plan = planOf(WITH_RESULT);
    const before = view(plan);
    const day = before.byId.get('g4d2')!;
    expect(day.tag).toBe('int');
    const pace = day.structure!.blocks.find((b) => b.step.kind === 'work')!.step.paceSec! + 10;
    const r = setAlt(before, {}, {}, 'g4d2', { tag: 'int', km: day.km, desc: day.desc, pace });
    if (!r.ok) throw new Error(r.err);
    const after = view(plan, r.alts).byId.get('g4d2')!;
    expect(after.structure).toBeDefined();
    const work = after.structure!.blocks.filter((b) => b.step.kind === 'work');
    expect(work.every((b) => b.step.paceSec === pace)).toBe(true);
    expect(after.structure!.blocks.filter((b) => b.step.kind !== 'work')).toEqual(
      day.structure!.blocks.filter((b) => b.step.kind !== 'work')
    );
    expect(after.structure!.sec).toBeGreaterThan(day.structure!.sec!);
    const t = setAlt(before, {}, {}, 'g4d2', { tag: 'lako', km: 6, desc: '6 km lako' });
    if (!t.ok) throw new Error(t.err);
    expect(view(plan, t.alts).byId.get('g4d2')!.structure).toBeUndefined();
  });
});

describe('08d (5k-v2.6.1): sačuvan plan 5k-v2.6.0', () => {
  it('ostaje plan 5K v2 (current) i prilagođava se tekućim pravilima — rezultat nosi tekuću oznaku; druge verzije unknown', () => {
    expect(KNOWN_VERSIONS).toEqual([
      '5k-v2.6.0',
      '5k-v2.6.1',
      '5k-v2.7.0',
      '5k-v2.8.0',
      '5k-v2.8.1',
      '5k-v2.9.0'
    ]);
    const plan = planOf(WITH_RESULT);
    const old = JSON.parse(JSON.stringify(plan)) as GenPlanState;
    old.meta = { ...old.meta, policyVersion: '5k-v2.6.0' } as GenPlanState['meta'];
    (old['fiveKV2'] as { policyVersion: string }).policyVersion = '5k-v2.6.0';
    expect(planPolicy(old)).toEqual({
      status: 'current',
      policyId: '5k-v2',
      policyVersion: '5k-v2.6.0'
    });
    expect(generatorForPlan(old)).toBe(FIVE_K_V2_GENERATOR);
    expect(planPolicy(plan).status).toBe('current');
    for (const version of ['5k-v2.5.0', '5k-v2.6.2', '5k-v2.7.1', '5k-v2.8.2']) {
      const p = { ...old, meta: { ...old.meta, policyVersion: version } } as GenPlanState;
      expect(planPolicy(p).status).toBe('unknown');
      expect(generatorForPlan(p)).toBeNull();
    }
    // Bol 5 u sredu 11. 11., asOf četvrtak 12. 11.: sidro r = ned 2 (sadrži 13. 11.), ne ned 3 (kraj bola 19. 11.).
    const pain = { facts: { pain: [{ date: '2026-11-11', pain: 5 }] } };
    const pr = ok(fiveKV2AdaptPreview(old, d('2026-11-12'), pain));
    expect(pr.result.meta).toMatchObject({ policyId: '5k-v2', policyVersion: '5k-v2.9.0' });
    const v2 = v2Of(pr.result)!;
    if (v2.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
    expect(v2.policyVersion).toBe('5k-v2.9.0');
    expect(v2.adaptation!.steps[0]!.returnFrom).toEqual({ week: 2, share: 0.7 });
    // Odluka 9 (5k-v2.7.0): redovno rasterećenje ned 3 posle nedelje sidra otpada (niz 3–7 = 5 ≤ 6).
    expect(v2.weeks[2]!.deload).toBe(false);
    expect(pr.reasons.find((x) => x.condition === 'PAIN')!.message).toContain(
      'Posle nedelje 2 rast kreće od 70% nivoa pre bola (17.5 km).'
    );
    expect(pr.reasons.find((x) => x.condition === 'PAIN')!.message).toContain(
      'Redovno rasterećenje u nedelji 3 otpada: nedelja 2 je smanjena (Odluka 9).'
    );
  });
});

describe('08e (5k-v2.7.0): sačuvan plan 5k-v2.6.1', () => {
  it('ostaje plan 5K v2 (current) i prilagođava se po 2.7.0 — redovno rasterećenje posle nedelje bola otpada (Odluka 9)', () => {
    const plan = planOf({ ...WITH_RESULT, raceDate: '2027-01-31' });
    const old = JSON.parse(JSON.stringify(plan)) as GenPlanState;
    old.meta = { ...old.meta, policyVersion: '5k-v2.6.1' } as GenPlanState['meta'];
    (old['fiveKV2'] as { policyVersion: string }).policyVersion = '5k-v2.6.1';
    expect(planPolicy(old)).toEqual({
      status: 'current',
      policyId: '5k-v2',
      policyVersion: '5k-v2.6.1'
    });
    expect(generatorForPlan(old)).toBe(FIVE_K_V2_GENERATOR);
    const before = v2Of(old)!;
    if (before.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
    expect(before.weeks.map((w) => w.deload)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false
    ]);
    // Bol 5 u sredu 18. 11., asOf četvrtak 19. 11.: sidro r = ned 3; ned 4 (redovno rasterećenje) otpada.
    const pain = { facts: { pain: [{ date: '2026-11-18', pain: 5 }] } };
    const pr = ok(fiveKV2AdaptPreview(old, d('2026-11-19'), pain));
    expect(pr.result.meta).toMatchObject({ policyId: '5k-v2', policyVersion: '5k-v2.9.0' });
    const v2 = v2Of(pr.result)!;
    if (v2.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
    expect(v2.adaptation!.steps[0]!.returnFrom).toEqual({ week: 3, share: 0.7 });
    expect(v2.weeks[3]!.deload).toBe(false);
    expect(v2.weeks[7]!.deload).toBe(true);
    expect(pr.reasons.find((x) => x.condition === 'PAIN')!.message).toContain(
      'Redovno rasterećenje u nedelji 4 otpada: nedelja 3 je smanjena (Odluka 9).'
    );
  });
});

describe('08g (5k-v2.8.0): sačuvan plan 5k-v2.7.0', () => {
  it('ostaje plan 5K v2 (current) i prilagođava se po 2.8.0', () => {
    const plan = planOf({ ...WITH_RESULT, raceDate: '2027-01-31' });
    const old = JSON.parse(JSON.stringify(plan)) as GenPlanState;
    old.meta = { ...old.meta, policyVersion: '5k-v2.7.0' } as GenPlanState['meta'];
    (old['fiveKV2'] as { policyVersion: string }).policyVersion = '5k-v2.7.0';
    expect(planPolicy(old)).toEqual({
      status: 'current',
      policyId: '5k-v2',
      policyVersion: '5k-v2.7.0'
    });
    expect(generatorForPlan(old)).toBe(FIVE_K_V2_GENERATOR);
    const pain = { facts: { pain: [{ date: '2026-11-18', pain: 5 }] } };
    const pr = ok(fiveKV2AdaptPreview(old, d('2026-11-19'), pain));
    expect(pr.result.meta).toMatchObject({ policyId: '5k-v2', policyVersion: '5k-v2.9.0' });
  });
});
