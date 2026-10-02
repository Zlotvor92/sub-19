/* Stanje: migracija šeme, čišćenje nepouzdanog ulaza, provere pri uvozu backupa.

   Ovo je sloj u kom greška ne pravi pogrešan broj nego GUBI podatke, pa se testira i ono što NE sme
   da se desi. Oracle test (`migrate.oracle.test.ts`) dokazuje da je ponašanje isto kao u starom kodu;
   ovde su pravila izražena sama za sebe — da prežive brisanje starog koda.

   parity: test/state.test.mjs (migrate; backup — uvoz; uvezen backup: bol i težina; Backup i Zajednica;
   datumi iz uvezenog backupa) + test/otpornost.test.mjs (deo koji se tiče čišćenja). Testovi
   sinhronizacije, sesije i localStorage-a prelaze sa `services/*`. */

import { describe, expect, it } from 'vitest';
import {
  cleanAlts,
  cleanDated,
  cleanNumberField,
  cleanOutOfPlanKm,
  cleanT3k,
  cleanVdotLog,
  cleanWellness
} from './clean';
import { findInvalidId, isValidGenPlan, migrateState } from './migrate';
import { SCHEMA_VERSION, seedState, type PersistedState } from './types';

const rich = (): Record<string, unknown> => ({
  v: 11,
  log: { g1d1: { status: 'done', km: 8, ts: '2026-01-05' }, g1d2: { status: 'skip' } },
  knee: [{ id: 'k1', date: '2026-01-05', pain: 3 }],
  kg: [{ date: '2026-01-05', kg: 75 }],
  pred: { g1_0: 270 },
  predLock: {},
  vdotLog: [{ id: 'g1_0', ts: '2026-01-06', measured: 48, vdot: 48.1, prev: 47, delta: 1.1 }],
  t3k: [{ id: 't3k-1', date: '2026-01-10', sec: 700 }],
  moves: {},
  alts: {},
  genPlan: null,
  wellness: {},
  vanPlana: {},
  zajed: { vidljiv: true, nadimak: 'Marko' },
  ui: { firstRun: '2026-01-05' }
});
const migrate = (x: unknown): PersistedState => {
  const s = migrateState(x);
  if (!s) throw new Error('migrateState vratio null');
  return s;
};

describe('migrateState — šema stanja', () => {
  it('odbija sve što nije prepoznatljivo stanje', () => {
    for (const bad of [
      null,
      undefined,
      0,
      'abc',
      [],
      {},
      { log: null },
      { log: [] },
      { log: 'x' }
    ]) {
      expect(migrateState(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('popunjava SVE ključeve koje aplikacija čita, bez obzira na verziju', () => {
    for (const v of [1, 2, 5, 8, 10, 11, undefined, '7']) {
      const s = migrate({ log: {}, ...(v === undefined ? {} : { v }) });
      for (const k of [
        'log',
        'knee',
        'kg',
        'pred',
        'predLock',
        'vdotLog',
        't3k',
        'moves',
        'alts',
        'wellness',
        'vanPlana',
        'zajed',
        'ui'
      ]) {
        expect(s[k], `v=${String(v)} ključ ${k}`).toBeDefined();
      }
      expect(s.genPlan).toBeNull();
      expect(s.v).toBe(SCHEMA_VERSION);
    }
  });

  it('nikad ne briše postojeće unose', () => {
    const s = migrate(rich());
    expect(Object.keys(s.log)).toEqual(['g1d1', 'g1d2']);
    expect(s.knee).toHaveLength(1);
    expect(s.kg).toHaveLength(1);
    expect(s.vdotLog).toHaveLength(1);
    expect(s.t3k).toHaveLength(1);
  });

  it('v10 → v11: unosi STAROG ličnog plana odlaze, sve ostalo ostaje', () => {
    const s = migrate({
      v: 10,
      log: { n1d1: { status: 'done' }, g1d1: { status: 'done' } },
      alts: { n1d1: { tag: 'lako', km: 5, desc: '' } },
      moves: { n1d3: '2025-12-04', g2d1: '2026-01-13' },
      pred: { p1: 240, g1_0: 270 },
      predLock: { p1: true },
      vdotLog: [
        { id: 'p1', ts: '2025-12-02', measured: 50, vdot: 49 },
        { id: 'g1_0', ts: '2026-01-06', measured: 48, vdot: 48.1 }
      ],
      knee: [
        { id: 'kt-n1d1', src: 'n1d1', date: '2025-12-01', pain: 5 },
        { id: 'k2', date: '2026-01-05', pain: 2 }
      ],
      kg: [{ date: '2025-12-01', kg: 80, src: 'n1d1' }]
    });
    expect(Object.keys(s.log)).toEqual(['g1d1']);
    expect(s.alts).toEqual({});
    expect(s.moves).toEqual({ g2d1: '2026-01-13' });
    expect(s.pred).toEqual({ g1_0: 270 });
    expect(s.vdotLog.map((e) => e.id)).toEqual(['g1_0']);
    /* bol i masa sa tih dana ostaju kao ARHIVA */
    expect(s.knee.map((k) => [k.id, k.src])).toEqual([
      ['kt-arhiva-n1d1', 'arhiva'],
      ['k2', undefined]
    ]);
    expect(s.kg[0]?.src).toBe('arhiva');
  });

  it('v11 stanje se pri ponovnoj migraciji ne dira', () => {
    const once = migrate(rich());
    expect(migrate(once)).toEqual(once);
  });

  it('odbija stanje iz BUDUĆE šeme umesto da ga tiho spusti', () => {
    expect(migrateState({ log: {}, v: 12 })).toBeNull();
    expect(migrateState({ log: {}, v: '99' })).toBeNull();
  });

  it('ne menja ulaz i čuva nepoznata polja prvog nivoa', () => {
    const input = { ...rich(), novoPolje: { x: 1 } };
    const copy = JSON.stringify(input);
    const s = migrate(input);
    expect(JSON.stringify(input)).toBe(copy);
    expect(s['novoPolje']).toEqual({ x: 1 });
  });

  it('Zajednica: vidljiv je SAMO izričito true; nadimak se seče na 24', () => {
    expect(
      migrate({ ...rich(), zajed: { vidljiv: 'yes', nadimak: 'x'.repeat(40) } }).zajed
    ).toEqual({ vidljiv: false, nadimak: 'x'.repeat(24) });
    expect(migrate({ v: 9, log: {}, zajed: { vidljiv: true, nadimak: 'a' } }).zajed.vidljiv).toBe(
      false
    );
    expect(migrate({ ...rich() }).zajed.vidljiv).toBe(true);
  });

  it('STROŽE od starog koda: ui/zajed koji nisu objekat postaju podrazumevani, ne kopija indeksa', () => {
    const s = migrate({ ...rich(), ui: ['a', 'b'], zajed: 'xy' });
    expect(Object.keys(s.ui).sort()).toEqual([
      'firstRun',
      'geo',
      'lastBackup',
      'novo',
      'satTreninga',
      'seenWeek',
      'snooze'
    ]);
    expect(s.zajed).toEqual({ vidljiv: false, nadimak: '' });
  });
});

describe('čišćenje: nikad izvršivo, nikad NaN', () => {
  it('oporavak: sve što nije broj postaje null (XSS napad kroz hrv)', () => {
    const w = cleanWellness({
      '2026-01-05': { hrv: '"><img src=x onerror=alert(1)>', pulsUMiru: 48, sanH: '7.5', ctl: {} },
      'nije-datum': { hrv: 1 },
      '2026-01-06': 'x'
    });
    expect(Object.keys(w)).toEqual(['2026-01-05']);
    expect(w['2026-01-05']).toMatchObject({ hrv: null, pulsUMiru: 48, sanH: 7.5, ctl: null });
  });

  it('lanac forme: samo brojevi; nemoguć VDOT se odbacuje u migraciji', () => {
    const v = cleanVdotLog([
      { id: 'g1_0', ts: '2026-01-05', vdot: '"><img>', measured: 'abc' },
      { id: null, ts: '2026-01-05' },
      { id: 'g1_1', ts: 5 },
      'x'
    ]);
    expect(v).toEqual([
      { id: 'g1_0', ts: '2026-01-05', vdot: null, prev: null, delta: null, measured: null }
    ]);
    const s = migrate({
      ...rich(),
      vdotLog: [
        { id: 'g1_0', ts: '2026-01-05', measured: 89, vdot: 73 },
        { id: 'g1_1', ts: '2026-01-06', measured: 49, vdot: 49 }
      ]
    });
    expect(s.vdotLog.map((e) => e.id)).toEqual(['g1_1']);
  });

  it('zapisi bez upotrebljivog datuma se odbacuju, ne „popravljaju"', () => {
    const dated = cleanDated([
      { date: '2026-01-05' },
      { date: '2026-02-31' },
      { date: 'abc' },
      { date: 20260105 },
      { x: 1 },
      null
    ]);
    expect(dated).toHaveLength(1);
  });

  it('bol van 0–10 i težina van 20–300 se odbacuju; zapis bez broja se ne provlači kao nula', () => {
    const pain = cleanNumberField(
      cleanDated([
        { date: '2026-01-05', pain: 3 },
        { date: '2026-01-05', pain: 11 },
        { date: '2026-01-05', pain: -1 },
        { date: '2026-01-05' },
        { date: '2026-01-05', pain: '4' },
        { date: '2026-01-05', pain: 10 },
        { date: '2026-01-05', pain: 0 }
      ]),
      'pain',
      0,
      10
    );
    expect(pain.map((p) => p['pain'])).toEqual([3, 10, 0]);
    const kg = cleanNumberField(
      cleanDated([
        { date: '2026-01-05', kg: 19.9 },
        { date: '2026-01-05', kg: 20 },
        { date: '2026-01-05', kg: 300 },
        { date: '2026-01-05', kg: 301 }
      ]),
      'kg',
      20,
      300
    );
    expect(kg.map((p) => p['kg'])).toEqual([20, 300]);
  });

  it('izmene dana (alts): ID i tip se proveravaju, opis je uvek tekst, km se ograničava', () => {
    const a = cleanAlts({
      g1d1: { tag: 'lako', km: 5.5, desc: '5.5 km', pace: null, rw: null },
      'x"><img>': { tag: 'lako' },
      g1d2: { tag: 'xyz' },
      g1d3: { tag: 'lako', km: 9999, desc: 123 },
      g1d4: { tag: 'odmor', km: 5, rw: { runSec: 60, walkSec: 60 } },
      g1d5: { tag: 'int', km: 7, pace: '250.4', paceAuto: true, snaga: true },
      g1d6: { tag: 'snaga', snaga: true },
      g1d7: { tag: 'rw', km: 4, rw: { runSec: 90, walkSec: 60 } },
      g1d8: { tag: 'rw', km: 4, rw: { runSec: 5000, walkSec: 60 } }
    });
    expect(Object.keys(a)).toEqual(['g1d1', 'g1d3', 'g1d4', 'g1d5', 'g1d6', 'g1d7', 'g1d8']);
    expect(a['g1d3']).toMatchObject({ km: 500, desc: '' });
    expect(a['g1d4']).toMatchObject({ km: null, rw: null });
    expect(a['g1d5']).toMatchObject({ pace: 250, paceAuto: true, snaga: true });
    expect(a['g1d6']?.snaga).toBeUndefined();
    expect(a['g1d7']?.rw).toEqual({
      runSec: 90,
      walkSec: 60,
      label: '1.5 min trčanje / 1 min hod'
    });
    expect(a['g1d8']?.rw).toBeNull();
  });

  it('STROŽE od starog koda: tip koji je nasleđeno svojstvo objekta („constructor") se odbacuje', () => {
    expect(
      cleanAlts({
        g1d1: { tag: 'constructor' },
        g1d2: { tag: 'toString' },
        g1d3: { tag: '__proto__' }
      })
    ).toEqual({});
  });

  it('trčanja pre plana: datum, 0 < km ≤ 300, zaokruženo na 2 decimale', () => {
    expect(
      cleanOutOfPlanKm({
        '2026-01-05': 5.123,
        '2026-02-31': 5,
        '2026-01-06': 0,
        '2026-01-07': 301,
        '2026-01-08': '5',
        abc: 3,
        '2026-01-09': 300
      })
    ).toEqual({
      '2026-01-05': 5.12,
      '2026-01-09': 300
    });
  });

  it('test na 3 km: ID sa prefiksom, datum, verodostojno vreme', () => {
    const t = cleanT3k([
      { id: 't3k-1', date: '2026-01-05', sec: 700.4 },
      { id: 'abc', date: '2026-01-05', sec: 700 },
      { id: 't3k-2', date: '2026-01-05', sec: 100 },
      { id: 't3k-3', date: '2026-01-05', sec: 99999 },
      { id: 't3k-4', date: 'x', sec: 700 }
    ]);
    expect(t).toEqual([{ id: 't3k-1', date: '2026-01-05', sec: 700 }]);
  });
});

describe('Backup — uvoz odbija pokvaren plan umesto da razbije aplikaciju', () => {
  const week = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    w: 1,
    start: '2026-01-05',
    days: [{ dow: 0, id: 'g1d1', km: 5, desc: 'x' }],
    ...over
  });
  const plan = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    weeks: [week()],
    pred: [{ id: 'g1_0', q: 3, pt: 250, l: 'N1 · Tempo' }],
    qs: { g1d1: [1000] },
    ...over
  });

  it('prihvata ispravan plan i null', () => {
    expect(isValidGenPlan(plan())).toBe(true);
    expect(isValidGenPlan(null)).toBe(true);
    expect(isValidGenPlan(undefined)).toBe(true);
  });

  it.each([
    ['string', 'x'],
    ['niz', []],
    ['bez nedelja', { weeks: [] }],
    ['nedelje nisu niz', { weeks: {} }],
    ['nedelja bez start', plan({ weeks: [week({ start: undefined })] })],
    ['start nije datum', plan({ weeks: [week({ start: 'abc' })] })],
    ['dan bez dow', plan({ weeks: [week({ days: [{ km: 5 }] })] })],
    ['dow van opsega', plan({ weeks: [week({ days: [{ dow: 9, km: 5 }] })] })],
    ['km nije broj', plan({ weeks: [week({ days: [{ dow: 1, km: 'x' }] })] })],
    ['km nije konačan', plan({ weeks: [week({ days: [{ dow: 1, km: Infinity }] })] })],
    [
      'opis je broj (ruši setPage)',
      plan({ weeks: [week({ days: [{ dow: 1, km: 5, desc: 123 }] })] })
    ],
    ['ID dana sa navodnikom', plan({ weeks: [week({ days: [{ dow: 1, id: 'a"b' }] })] })],
    ['pred nije niz', plan({ pred: {} })],
    ['pred bez ID-ja', plan({ pred: [{ q: 1 }] })],
    ['pred ID sa < ', plan({ pred: [{ id: '<img>' }] })],
    ['qs nije objekat', plan({ qs: [] })],
    ['qs ključ sa navodnikom', plan({ qs: { 'a"': [1] } })]
  ])('odbija: %s', (_n, g) => {
    expect(isValidGenPlan(g)).toBe(false);
  });

  it('neispravan identifikator u stanju se imenuje, ispravno stanje prolazi', () => {
    expect(findInvalidId(rich())).toBeNull();
    expect(findInvalidId({ log: { 'x"><img>': {} } })).toMatch(/^log → /);
    expect(findInvalidId({ alts: [] })).toBe('alts');
    expect(findInvalidId({ vdotLog: [{ id: '<a>' }] })).toBe('vdotLog');
    expect(findInvalidId({ t3k: [{ id: 'a b' }] })).toBe('t3k.id');
    expect(findInvalidId({ knee: [{ id: 'k1', src: '"' }] })).toBe('knee.src');
    expect(findInvalidId({ kg: [{ src: 'a"b' }] })).toBe('kg.src');
    expect(findInvalidId(null)).toBe('stanje');
  });
});

describe('seedState', () => {
  it('je prazno za svakoga — vlasnikovi podaci se nikad ne ubacuju iz koda', () => {
    const s = seedState('2026-01-05');
    expect(s.log).toEqual({});
    expect(s.knee).toEqual([]);
    expect(s.kg).toEqual([]);
    expect(s.genPlan).toBeNull();
    expect(s.zajed.vidljiv).toBe(false);
    expect(s.ui.firstRun).toBe('2026-01-05');
    /* i prolazi kroz sopstvenu migraciju netaknuto */
    expect(migrate(s)).toEqual(s);
  });
});
