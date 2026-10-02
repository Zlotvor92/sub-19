import { readFileSync } from 'node:fs';
import vm from 'node:vm';
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
import { planVdotNow } from '../training/adaptation';
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

/** Netaknute konstante: izvor se parsira i izvršava u praznom kontekstu (PLAN u živom `vm` je već izmenjen `rebuildDateIndex`-om). */
function pristine(name: string, startPrefix: string): unknown {
  const lines = readFileSync(`${process.cwd()}/../app.js`, 'utf8').split('\n');
  const s = lines.findIndex((l) => l.startsWith(startPrefix));
  let e = s;
  while (!/^[\]}];?\s*$/.test(lines[e] ?? '')) e++;
  return JSON.parse(
    JSON.stringify(vm.runInNewContext(`${lines.slice(s, e + 1).join('\n')};${name}`))
  );
}

describe('podaci ličnog plana su isti kao u starom kodu', () => {
  it('PLAN, PRED i QS: duboka jednakost', () => {
    expect(JSON.parse(JSON.stringify(PERSONAL_WEEKS))).toEqual(pristine('PLAN', 'const PLAN=['));
    expect(JSON.parse(JSON.stringify(PERSONAL_PRED))).toEqual(pristine('PRED', 'const PRED=['));
    expect(PERSONAL_QS).toEqual(pristine('QS', 'const QS={'));
  });

  it('datumi, cilj i konstante', () => {
    expect(
      legacy.evalIn(
        '[START,RACE,CILJ,LICNI.raceDistM,LICNI.goalSec,LICNI.pb5kSec,LICNI.polazniDan,LICNI.raceName]'
      )
    ).toEqual([
      PERSONAL_START,
      PERSONAL_RACE,
      PERSONAL.goalText,
      PERSONAL.raceDistM,
      PERSONAL.goalSec,
      PERSONAL.pb5kSec,
      PERSONAL.startingDay,
      PERSONAL.raceName
    ]);
    expect(legacy.evalIn('goalCtxText()')).toBe(PERSONAL.goalContext);
  });

  it('12 nedelja, nepromenjen raspored, 80 dana i 408,2 km (Excel ned. 0 je N1+N2)', () => {
    expect(PERSONAL_WEEKS).toHaveLength(12);
    expect(PERSONAL_WEEKS[0]?.start).toBe('2026-09-21');
    expect(PERSONAL_WEEKS[11]?.start).toBe('2026-12-07');
    expect(PERSONAL_WEEKS[0]?.days.map((d) => d.id)).toEqual(['n1d5', 'n1d6', 'n1d7']);
    const nis = PERSONAL_WEEKS[1]?.days.find((d) => d.id === 'n2d6');
    expect(nis?.tag).toBe('lr'); // Niš polumaraton je LAGANO — ne sme biti označen kao trka
    const days = PERSONAL_WEEKS.flatMap((w) => w.days);
    const km = days.reduce((s, d) => s + (typeof d.km === 'number' ? d.km : 0), 0);
    expect(Math.round(km * 10) / 10).toBe(408.2);
    // ID-jevi su u „n" prostoru, nikad „g"
    for (const d of days) expect(d.id).toMatch(/^n\d+d\d$/);
  });

  it('nijedan dan ne završi u M zoni, a tipovi sesija su isti', () => {
    const legacyTags = legacy.evalIn(
      'PLAN.flatMap(w=>w.days.map(d=>d.id+":"+(d.tag||"")))'
    ) as string[];
    expect(PERSONAL_WEEKS.flatMap((w) => w.days.map((d) => `${d.id}:${d.tag ?? ''}`))).toEqual(
      legacyTags
    );
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
    expect(personalGoalVdot()).toBe(legacy.evalIn('goalVdotActive()'));
    expect(legacy.evalIn('goalSecActive()')).toBe(6000);
    expect(legacy.evalIn('raceDistActive()')).toBe(21097.5);
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
        const old = legacy.evalIn(`planVdotSada('${today}')`);
        const mine = planVdotNow({ today, plan, meta, pred: PERSONAL_PRED });
        expect(mine, today).toBe(old);
        checked++;
      }
    expect(checked).toBeGreaterThan(30);
    // pre prve i posle poslednje nedelje
    for (const today of ['2026-09-01', '2027-02-01'])
      expect(planVdotNow({ today, plan, meta, pred: PERSONAL_PRED })).toBe(
        legacy.evalIn(`planVdotSada('${today}')`)
      );
    expect(weekOf(plan, '2026-10-01')?.w).toBe(2);
  });

  it('opis cilja za AI (isti tekst kao stari goalCtxText)', () => {
    expect(
      goalContext(personalPlan(personalBaselineVdot({})).meta as Record<string, unknown>)
    ).toBe(legacy.evalIn('goalCtxText()'));
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
