import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import {
  PERSONAL_PRED,
  PERSONAL_QS,
  PERSONAL_RACE,
  PERSONAL_START,
  PERSONAL_WEEKS
} from '../../data/personalPlan';
import { resolvePlan, weekOf } from '../plan';
import type { LogEntry } from '../state';
// Ugrađeni lični plan je polumaraton → HM generator (v. domain/generators/personalPlan.node.test.ts).
import { planVdotNow } from '../generators/halfMarathon';
import {
  OLD_SEED_SIGNATURE,
  PERSONAL,
  isOwnerUid,
  mustMakeOwnPlan,
  ownsEntries,
  personalBaselineVdot,
  personalGoalVdot,
  personalPlan,
  removeForeignSeed,
  startingRace
} from './index';
import { goalContext } from '../ai';

/* parity: test/licni-plan.test.mjs, test/snaga-trka-polazna.test.mjs, test/forma-vs-plan.test.mjs (lični plan), `baselineVdot`/`goalVdotActive`/`polaznaTrka`/
   `planVdotSada`/`imaUnosaNaLicnom`/`moraSvojPlan`/`ukloniTudjiSeed` (app.js). Za razliku od generatora, ovde se tvrde TAČNE vrednosti — namerno: cilj je da nijedna izmena
   drugde ne može tiho da promeni nečiji stvarni plan. */

const ADMIN = '0403f8fb-a643-4d4e-843d-f71199a0d6f9';
let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-10-01T09:00:00Z');
});

/** Kanonski (sortirani ključevi) SHA-256 — isti zapis kao pri merenju nad starim kodom. */
const canon = (x: unknown): unknown =>
  Array.isArray(x)
    ? x.map(canon)
    : x && typeof x === 'object'
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, canon((x as Record<string, unknown>)[k])])
        )
      : x;
const sha = (x: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(canon(JSON.parse(JSON.stringify(x)))))
    .digest('hex');

describe('podaci ličnog plana su isti kao u starom kodu', () => {
  it('PLAN, PRED i QS: nepromenjen sadržaj (SHA-256; nedelje 4–6 iz Plan_Bokeski_1h35.xlsx, 7–12 iz plana od 1.11.2026, n3d7 = 6 km lagano)', () => {
    expect(sha(PERSONAL_WEEKS)).toBe(
      'bad2504dbfcbfb2f0da40563663c7953fee1bfc4918d08c66d35148beefa70bf'
    );
    expect(sha(PERSONAL_PRED)).toBe(
      '97d6a3445f7bfa8a2eee5b38a61f00e6bdfef14a75a1741e0a8891edef999494'
    );
    expect(sha(PERSONAL_QS)).toBe(
      'e5a0fcdbf9d39f9ab8b80dd79b010bd1eda81d6deda30f149db5a9d3a173c7d1'
    );
  });

  it('datumi, cilj i konstante', () => {
    expect([
      PERSONAL_START,
      PERSONAL_RACE,
      PERSONAL.goalText,
      PERSONAL.raceDistM,
      PERSONAL.goalSec,
      PERSONAL.pb5kSec,
      PERSONAL.startingDay,
      PERSONAL.raceName
    ]).toEqual([
      '2026-09-21',
      '2026-12-13',
      '1:40:00',
      21097.5,
      6000,
      1237,
      'n2d6',
      'Bokeški polumaraton'
    ]);
    expect(PERSONAL.goalContext).toBe('Bokeški polumaraton 13.12.2026 — cilj 1:40:00 (4:44/km)');
  });

  it('12 nedelja, 80 dana i 387,7 km; Excel ned. k je N(k+3) do N6, nedelje 1–3 su raniji plan, 7–12 plan od 1.11.', () => {
    expect(PERSONAL_WEEKS).toHaveLength(12);
    expect(PERSONAL_WEEKS[0]?.start).toBe('2026-09-21');
    expect(PERSONAL_WEEKS[11]?.start).toBe('2026-12-07');
    expect(PERSONAL_WEEKS[0]?.days.map((d) => d.id)).toEqual(['n1d5', 'n1d6', 'n1d7']);
    const nis = PERSONAL_WEEKS[1]?.days.find((d) => d.id === 'n2d6');
    expect(nis?.tag).toBe('lr'); // Niš polumaraton je LAGANO — ne sme biti označen kao trka
    const days = PERSONAL_WEEKS.flatMap((w) => w.days);
    const km = days.reduce((s, d) => s + (typeof d.km === 'number' ? d.km : 0), 0);
    expect(Math.round(km * 10) / 10).toBe(387.7);
    // sutra (11.10) je 6 km lagano; Excel (N4–N6): 4 tempo dana; plan od 1.11. (N7–N12): 4 tempa, 2 intervala, trka 21,1 km
    const sun = days.find((d) => d.id === 'n3d7');
    expect([sun?.tag, sun?.km]).toEqual(['lako', 6]);
    expect(days.filter((d) => d.tag === 'tempo')).toHaveLength(8);
    expect(days.filter((d) => d.tag === 'int')).toHaveLength(2);
    const weekKm = PERSONAL_WEEKS.slice(3).map(
      (w) =>
        Math.round(w.days.reduce((s, d) => s + (typeof d.km === 'number' ? d.km : 0), 0) * 100) /
        100
    );
    expect(weekKm).toEqual([30, 32.4, 34.99, 28, 37.1, 42.6, 44, 34.8, 37.7]);
    // ID-jevi su u „n" prostoru, nikad „g"; N7–N12 sa nastavkom „b", da se ručne izmene (`alts`) starih dana n7–n12 ne vežu za nove treninge
    for (const w of PERSONAL_WEEKS)
      for (const d of w.days) expect(d.id).toMatch(w.w <= 6 ? /^n\d+d\d$/ : /^n\d+d\db$/);
    expect(new Set(days.map((d) => d.id)).size).toBe(days.length);
  });

  it('tipovi sesija (Excel, N4–N6): odmor posle svakog trčanja, bez snage', () => {
    const days = PERSONAL_WEEKS.slice(3, 6).flatMap((w) => w.days);
    expect(days.some((d) => d.tag === 'snaga')).toBe(false);
    for (let i = 1; i < days.length; i++)
      expect(!!days[i]?.rest || !!days[i - 1]?.rest, days[i]?.id).toBe(true);
  });

  it('plan od 1.11. (N7–N12): kvalitet, dugo, snaga i trka po nedeljama; bez degenerisanih dana', () => {
    const weeks = PERSONAL_WEEKS.slice(6);
    expect(weeks.map((w) => w.start)).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
      '2026-12-07'
    ]);
    const count = (tags: string[]) =>
      weeks.map((w) => w.days.filter((d) => !d.rest && tags.includes(String(d.tag))).length);
    expect(count(['tempo', 'int'])).toEqual([0, 1, 2, 1, 1, 1]);
    expect(count(['lr'])).toEqual([1, 1, 1, 1, 1, 0]);
    expect(count(['snaga'])).toEqual([2, 2, 2, 2, 1, 0]);
    for (const w of weeks) {
      expect(w.days.map((d) => d.dow)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      const runs = w.days.filter((d) => !d.rest && d.tag !== 'snaga');
      // nijedan trening bez km ni prazan opis; dugo je najduže trčanje nedelje
      for (const d of runs) expect(typeof d.km === 'number' && d.km > 0, d.id).toBe(true);
      for (const d of w.days) expect(String(d.desc).trim().length > 0, d.id).toBe(true);
      const lr = runs.find((d) => d.tag === 'lr');
      const easy = runs.filter((d) => d.tag === 'lako').map((d) => d.km);
      if (lr) expect(lr.km).toBeGreaterThan(Math.max(...easy));
    }
    const last = weeks.at(-1)?.days.at(-1);
    expect([last?.id, last?.tag, last?.km]).toEqual(['n12d7b', 'trka', 21.1]);
    // svaki kvalitetni dan ima spec deonica za Strava lap-detekciju
    for (const d of weeks.flatMap((w) => w.days))
      if (d.tag === 'tempo' || d.tag === 'int')
        expect(PERSONAL_QS[String(d.id)], d.id).toBeDefined();
  });
});

describe('izvedene vrednosti naspram starog koda', () => {
  const setLog = (log: Record<string, LogEntry>): void => {
    legacy.evalIn(
      `S.genPlan=null; S.log=${JSON.stringify(log)}; S.vdotLog=[]; rebuildDateIndex(); 0`
    );
  };

  it('baseline i ciljni VDOT: PB 20:37 na 5K → polumaraton 1:40:00', () => {
    setLog({});
    expect(personalBaselineVdot({})).toBe(legacy.evalIn('baselineVdot()'));
    expect(personalGoalVdot()).toBe(45.1);
    expect(PERSONAL.goalSec).toBe(6000);
    expect(PERSONAL.raceDistM).toBe(21097.5);
  });

  const cases: Array<[string, LogEntry | undefined]> = [
    ['nema unosa', undefined],
    ['upisan Niš 1:38:12 sa km', { status: 'done', km: 21.1, sec: 5892 }],
    ['upisan Niš bez km (uzima se planirano)', { status: 'done', sec: 5700 }],
    ['preskočen', { status: 'skip', sec: 5700 }],
    ['kratko trčanje tog dana nije polazna tačka', { status: 'done', km: 10, sec: 2900 }],
    ['21,1 km za 40 minuta je nemoguće (VDOT > 90)', { status: 'done', km: 21.1, sec: 2400 }],
    ['bez vremena', { status: 'done', km: 21.1 }],
    ['sa datumom trčanja', { status: 'done', km: 21.1, sec: 6100, runDate: '2026-10-03' }],
    ['granica 20 km', { status: 'done', km: 20, sec: 5400 }],
    ['granica 25 km', { status: 'done', km: 25, sec: 7200 }],
    ['iznad 25 km', { status: 'done', km: 25.1, sec: 7200 }]
  ];
  for (const [name, entry] of cases)
    it(`polazna trka: ${name}`, () => {
      const log: Record<string, LogEntry> = entry ? { n2d6: entry } : {};
      setLog(log);
      const old = legacy.evalIn('polaznaTrka()') as {
        vdot: number;
        sec: number;
        km: number;
        date: string | null;
      } | null;
      const mine = startingRace(log);
      expect(mine).toEqual(old);
      expect(personalBaselineVdot(log)).toBe(legacy.evalIn('baselineVdot()'));
    });

  it('planska forma („planVdotSada") za svaku nedelju: p5k redovi, sa nasleđivanjem kad nedelja nema redova', () => {
    setLog({});
    const plan = resolvePlan(PERSONAL_WEEKS, { alts: {}, moves: {} });
    const meta = personalPlan(personalBaselineVdot({})).meta as unknown as Parameters<
      typeof planVdotNow
    >[0]['meta'];
    let checked = 0;
    for (const w of PERSONAL_WEEKS)
      for (let k = 0; k < 7; k += 3) {
        const day = new Date(`${w.start}T12:00:00Z`);
        day.setUTCDate(day.getUTCDate() + k);
        const today = day.toISOString().slice(0, 10);
        // N4 je baza bez tempa (nema p5k reda), od N5 je referenca ciljni VDOT (N7 bez kvaliteta nasleđuje N6)
        const old = w.w < 5 ? null : 45.1;
        const mine = planVdotNow({ today, plan, meta, pred: PERSONAL_PRED });
        expect(mine, today).toBe(old);
        checked++;
      }
    expect(checked).toBeGreaterThan(30);
    // pre prve i posle poslednje nedelje
    for (const today of ['2026-09-01', '2027-02-01'])
      expect(planVdotNow({ today, plan, meta, pred: PERSONAL_PRED })).toBe(45.1);
    expect(weekOf(plan, '2026-10-01')?.w).toBe(2);
  });

  it('opis cilja za AI', () => {
    expect(
      goalContext(personalPlan(personalBaselineVdot({})).meta as Record<string, unknown>)
    ).toBe(PERSONAL.goalContext);
  });
});

describe('ko vidi ugrađeni plan (imaUnosaNaLicnom, moraSvojPlan, jeVlasnik) naspram starog koda', () => {
  const logs: Array<[string, Record<string, LogEntry>]> = [
    ['prazno', {}],
    ['n done', { n2d1: { status: 'done' } }],
    ['n skip', { n3d3: { status: 'skip' } }],
    ['n pending', { n3d3: { status: 'pending' } }],
    ['n bez statusa', { n3d3: { km: 5 } }],
    ['samo g', { g1d1: { status: 'done' } }],
    ['g i n', { g1d1: { status: 'done' }, n1d6: { status: 'done' } }]
  ];
  for (const [name, log] of logs)
    for (const uid of [ADMIN, 'tudji-1', null])
      for (const genPlan of [false, true])
        it(`${name} · ${uid === ADMIN ? 'vlasnik' : (uid ?? 'neprijavljen')} · ${genPlan ? 'sa generisanim' : 'bez generisanog'}`, () => {
          legacy.evalIn(`
            SB.userId=${JSON.stringify(uid)}; SB.access=${uid ? "'a'" : 'null'}; SB.refresh=${uid ? "'r'" : 'null'}; SB.expiresAt=Date.now()+36e5;
            S.log=${JSON.stringify(log)};
            S.genPlan=${genPlan ? '{weeks:[],pred:[],qs:{},meta:{}}' : 'null'}; 0`);
          const access = { hasGenPlan: genPlan, isOwner: isOwnerUid(uid, ADMIN), log };
          expect(ownsEntries(log)).toBe(legacy.evalIn('imaUnosaNaLicnom()'));
          expect(mustMakeOwnPlan(access)).toBe(legacy.evalIn('moraSvojPlan()'));
          expect(access.isOwner).toBe(legacy.evalIn('jeVlasnik()'));
        });
});

describe('uklanjanje zatečenog tuđeg seeda naspram starog `ukloniTudjiSeed`', () => {
  const sig = OLD_SEED_SIGNATURE;
  const knee = (id: string) => ({ id, date: '2026-06-22', pain: 3, note: 'x' });
  const scenarios: Array<[string, Record<string, unknown>]> = [
    [
      'ceo seed',
      {
        log: Object.fromEntries(sig.log.map((k) => [k, { status: 'done' }])),
        knee: sig.knee.map(knee),
        kg: sig.kg.map((date) => ({ date, kg: 80 })),
        pred: { p1: 250, p2: 255 },
        predLock: { p1: true },
        vdotLog: [
          { id: 'p1', vdot: 50 },
          { id: 'g1_0', vdot: 51 }
        ]
      }
    ],
    [
      'seed + svoj unos na ugrađenom',
      {
        log: {
          ...Object.fromEntries(sig.log.map((k) => [k, { status: 'done' }])),
          n9d9: { status: 'done' }
        },
        knee: [],
        kg: [],
        pred: { p1: 250 },
        predLock: {},
        vdotLog: []
      }
    ],
    [
      'samo koleno i masa, uz generisan plan',
      {
        log: { g1d1: { status: 'done' } },
        knee: [...sig.knee.map(knee), knee('k1751376000000'), knee('kt-g1d1')],
        kg: [
          { date: sig.kg[0], kg: 80 },
          { date: sig.kg[0], kg: 81, src: 'g1d1' },
          { date: '2026-07-01', kg: 79 }
        ],
        pred: {},
        predLock: {},
        vdotLog: []
      }
    ],
    [
      'pred van potpisa',
      {
        log: {},
        knee: [],
        kg: [],
        pred: { p1: 250, p3: 255 },
        predLock: { p3: true },
        vdotLog: [{ id: 'p3' }]
      }
    ],
    ['prazno', { log: {}, knee: [], kg: [], pred: {}, predLock: {}, vdotLog: [] }]
  ];
  for (const [name, st] of scenarios)
    it(name, () => {
      legacy.evalIn(`
        SB.userId='tudji-1'; SB.access='a'; SB.refresh='r'; SB.expiresAt=Date.now()+36e5;
        var __s=${JSON.stringify(st)}; S.log=__s.log; S.knee=__s.knee; S.kg=__s.kg; S.pred=__s.pred; S.predLock=__s.predLock; S.vdotLog=__s.vdotLog; S.genPlan=null; 0`);
      const changed = legacy.evalIn('ukloniTudjiSeed()') as boolean;
      const old = JSON.parse(
        JSON.stringify(
          legacy.evalIn(
            '({log:S.log,knee:S.knee,kg:S.kg,pred:S.pred,predLock:S.predLock,vdotLog:S.vdotLog})'
          )
        )
      ) as Record<string, unknown>;
      const mine = removeForeignSeed(JSON.parse(JSON.stringify(st)) as never);
      expect(mine.changed).toBe(changed);
      expect(JSON.parse(JSON.stringify(mine.next))).toEqual(old);
    });
});
