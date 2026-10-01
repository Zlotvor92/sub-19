import { beforeAll, describe, expect, it } from 'vitest';
import { canonical } from '@/test/fingerprint';
import { firstDiff } from '@/test/firstDiff';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import type { AltRecord, GenPlanState, LogEntry } from '../state';
import { generatePlan } from '../training/generator/generatePlan';
import {
  allWorkLapsPace,
  blockPace,
  decouplingPerKm,
  detectWorkSegments,
  extractPaceFromDesc,
  icuRoundsToLaps,
  icuWorkPace,
  mergeDay,
  perKmDetail,
  predictRange,
  realignPlan,
  selectIcuWorkLaps,
  selectWorkLaps,
  workLapsPace,
  type ActivityStreams,
  type IcuRound,
  type Lap
} from './index';

/* parity: test/intervali-radni-deo.test.mjs, test/icu-treninzi.test.mjs, test/doslednost (spojiDan),
   test/spojevi.test.mjs (autoRealign). Poredi `domain/activities` sa starim `detectWorkSegments`,
   `perKmDetail`, `decouplingPerKm`, `workLapsSelect/Tempo`, `genWorkLapsTempo`, `blockTempo`,
   `predictRange`, `spojiDan`, `extractPaceFromDesc`, `autoRealign` na sintetičkim i nasumičnim ulazima. */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;

let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
});

/* ---------- sintetički streamovi ---------- */

interface Piece {
  sec: number;
  v: number;
}

function structure(r: () => number): Piece[] {
  const kind = pick(r, [
    'easy',
    'intervals',
    'tempo',
    'fartlek',
    'pyramid',
    'overunder',
    'prog',
    'strides'
  ] as const);
  const wu: Piece = { sec: 480 + Math.floor(r() * 400), v: 2.9 + r() * 0.3 };
  const cd: Piece = { sec: 300 + Math.floor(r() * 300), v: 2.8 + r() * 0.3 };
  const p: Piece[] = [];
  if (kind === 'easy') return [{ sec: 1800 + Math.floor(r() * 2400), v: 2.8 + r() * 0.6 }];
  if (kind === 'prog') {
    for (let k = 0; k < 6; k++) p.push({ sec: 420, v: 2.9 + k * 0.22 });
    return p;
  }
  p.push(wu);
  if (kind === 'intervals') {
    const reps = 3 + Math.floor(r() * 6);
    const dist = pick(r, [400, 600, 800, 1000, 1200, 1600]);
    const v = 4.0 + r() * 0.8;
    const walk = r() < 0.5;
    for (let k = 0; k < reps; k++) {
      p.push({ sec: dist / v, v });
      if (k < reps - 1) p.push(walk ? { sec: 120, v: 1.0 } : { sec: 90, v: 2.0 });
    }
  } else if (kind === 'tempo') {
    const blocks = 1 + Math.floor(r() * 3);
    for (let k = 0; k < blocks; k++) {
      p.push({ sec: 600 + Math.floor(r() * 600), v: 3.7 + r() * 0.4 });
      if (k < blocks - 1) p.push({ sec: 90, v: 2.4 });
    }
  } else if (kind === 'fartlek') {
    for (let k = 0; k < 8; k++) p.push({ sec: 60, v: 4.3 + r() * 0.3 }, { sec: 90, v: 3.1 });
  } else if (kind === 'pyramid') {
    for (const d of [600, 1000, 1600, 1000, 600])
      p.push({ sec: d / 4.4, v: 4.4 }, { sec: 105, v: 1.2 });
  } else if (kind === 'overunder') {
    for (let k = 0; k < 3; k++) {
      for (let q = 0; q < 3; q++) p.push({ sec: 120, v: 4.17 }, { sec: 120, v: 3.85 });
      p.push({ sec: 120, v: 2.2 });
    }
  } else {
    p.push({ sec: 1500, v: 3.2 });
    for (let k = 0; k < 6; k++) p.push({ sec: 20, v: 5.2 }, { sec: 60, v: 2.8 });
  }
  p.push(cd);
  return p;
}

function makeStreams(r: () => number): ActivityStreams {
  const pieces = structure(r);
  const dist: number[] = [0];
  const time: number[] = [0];
  const hr: Array<number | null> = [];
  const cad: Array<number | null> = [];
  const mov: boolean[] = [true];
  const alt: Array<number | null> = [100];
  const noise = r() * 0.06;
  const stopAt = r() < 0.4 ? Math.floor(r() * 2000) : -1;
  let t = 0;
  let d = 0;
  for (const piece of pieces) {
    const n = Math.max(1, Math.round(piece.sec));
    for (let k = 0; k < n; k++) {
      const step = r() < 0.05 ? 2 : 1;
      t += step;
      const stopped = t >= stopAt && t < stopAt + 40 && stopAt >= 0;
      const v = stopped ? 0 : Math.max(0, piece.v * (1 + (r() - 0.5) * 2 * noise));
      d += v * step;
      dist.push(d);
      time.push(t);
      mov.push(!stopped);
      hr.push(r() < 0.03 ? null : Math.round(120 + piece.v * 12 + r() * 4));
      cad.push(r() < 0.03 ? 0 : Math.round(160 + piece.v * 3));
      alt.push(100 + Math.sin(t / 300) * 6);
    }
  }
  hr.unshift(120);
  cad.unshift(160);
  const s: ActivityStreams = { distance: { data: dist }, time: { data: time } };
  if (r() < 0.9) s.heartrate = { data: hr };
  if (r() < 0.7) s.cadence = { data: cad };
  if (r() < 0.3) s.watts = { data: dist.map((_, i) => 150 + (i % 50)) };
  if (r() < 0.6) s.moving = { data: mov };
  if (r() < 0.6) s.altitude = { data: alt };
  if (r() < 0.3) s.temp = { data: dist.map(() => 18 + Math.floor(r() * 3)) };
  return s;
}

describe('radni segmenti i po-km presek naspram starog koda', () => {
  it('300 sintetičkih treninga (intervali, tempo, fartlek, piramida, over/under, progresivno, laganica)', () => {
    const r = rng(2026);
    const kinds = { null: 0, empty: 0, segs: 0 };
    for (let i = 0; i < 300; i++) {
      const s = makeStreams(r);
      const old = j<unknown>(legacy.call('detectWorkSegments', j(s)));
      const mine = detectWorkSegments(s);
      expect(firstDiff(canonical(j(mine)), canonical(old)), `segmenti ${i}`).toBeNull();
      if (mine === null) kinds.null++;
      else if (!mine.length) kinds.empty++;
      else kinds.segs++;
      const oldKm = j<unknown>(legacy.call('perKmDetail', j(s)));
      expect(firstDiff(canonical(j(perKmDetail(s))), canonical(oldKm)), `po km ${i}`).toBeNull();
      const dec = j<unknown>(legacy.call('decouplingPerKm', oldKm));
      const mineDec = decouplingPerKm(perKmDetail(s));
      expect(mineDec, `dekuplovanje ${i}`).toEqual(dec); // `razlog` je deo PERZISTIRANOG zapisa (log[dan].decoupling)
    }
    expect(kinds.segs, 'uzorak mora da sadrži prepoznate segmente').toBeGreaterThan(80);
    expect(kinds.empty, 'uzorak mora da sadrži kontinuirana trčanja').toBeGreaterThan(20);
  });

  it('neupotrebljivi streamovi: null / prazno (stari kod na null/undefined puca sa TypeError, novi vraća null)', () => {
    expect(detectWorkSegments(null)).toBeNull();
    expect(detectWorkSegments(undefined)).toBeNull();
    expect(perKmDetail(null)).toEqual([]);
    for (const s of [
      {},
      { distance: { data: [] }, time: { data: [] } },
      { distance: { data: [1, 2] }, time: { data: [1] } }
    ] as unknown as ActivityStreams[]) {
      expect(detectWorkSegments(s)).toEqual(j(legacy.call('detectWorkSegments', s)) ?? null);
      expect(perKmDetail(s)).toEqual(j(legacy.call('perKmDetail', s)));
    }
  });
});

/* ---------- krugovi ---------- */

function randomLaps(r: () => number): { laps: Lap[]; specs: number[] } {
  const spec = pick(r, [400, 800, 1000, 1600, 2000]);
  const n = 3 + Math.floor(r() * 9);
  const laps: Lap[] = [];
  for (let i = 0; i < n; i++) {
    const kind = r();
    const distance = kind < 0.6 ? spec * (0.9 + r() * 0.2) : 100 + r() * 2000;
    const pace = kind < 0.6 ? 220 + r() * 40 : 280 + r() * 400;
    const L: Lap = { distance, moving_time: Math.round((distance / 1000) * pace) };
    if (r() < 0.2) {
      L.elapsed_time = L.moving_time;
      delete L.moving_time;
    }
    if (r() < 0.05) L.moving_time = 0;
    laps.push(L);
  }
  return { laps, specs: [spec] };
}

describe('krugovi naspram starog koda', () => {
  it('400 nasumičnih nizova krugova: izbor radnih, tempo, opseg predikcije', () => {
    const r = rng(77);
    let nonNull = 0;
    for (let i = 0; i < 400; i++) {
      const { laps, specs } = randomLaps(r);
      const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
      ctx['__l'] = j(laps);
      ctx['__s'] = specs;
      const where = `iter ${i}`;
      expect(j(selectWorkLaps(laps, specs)), where).toEqual(
        j(legacy.evalIn('workLapsSelect(__l,__s)'))
      );
      expect(workLapsPace(laps, specs), where).toBe(legacy.evalIn('workLapsTempo(__l,__s)'));
      expect(allWorkLapsPace(laps, specs), where).toBe(legacy.evalIn('genWorkLapsTempo(__l,__s)'));
      expect(blockPace(laps, specs), where).toBe(legacy.evalIn('blockTempo(__l,__s)'));
      const qKm = 4 + r() * 2;
      expect(predictRange(laps, specs, qKm), where).toEqual(
        j(legacy.evalIn(`predictRange(__l,__s,${qKm})`))
      );
      if (workLapsPace(laps, specs) != null) nonNull++;
    }
    expect(nonNull).toBeGreaterThan(200);
  });
});

/* ---------- spajanje dana ---------- */

describe('spajanje trčanja istog dana naspram starog spojiDan', () => {
  it('500 nasumičnih lista (Strava i icu oblik, duplikati, nepoznato trajanje, bez pulsa)', () => {
    const r = rng(5);
    for (let i = 0; i < 500; i++) {
      const n = Math.floor(r() * 4);
      const list: Array<Record<string, unknown> | null> = [];
      for (let k = 0; k < n; k++) {
        const base = { d: 3000 + Math.round(r() * 12000), t: 900 + Math.round(r() * 4000) };
        const a: Record<string, unknown> = {};
        const icu = r() < 0.4;
        if (icu) {
          a['km'] = base.d / 1000;
          a['distance'] = base.d;
          if (r() < 0.85) a['sec'] = base.t;
          if (r() < 0.7) a['hr'] = 130 + Math.round(r() * 40);
          if (r() < 0.5) a['maxHr'] = 170 + Math.round(r() * 20);
          if (r() < 0.5) a['uspon'] = Math.round(r() * 200);
        } else {
          a['distance'] = base.d;
          if (r() < 0.85) a['moving_time'] = base.t;
          if (r() < 0.7) a['average_heartrate'] = 130 + r() * 40;
          if (r() < 0.5) a['max_heartrate'] = 170 + Math.round(r() * 20);
          if (r() < 0.5) a['total_elevation_gain'] = r() * 200;
        }
        list.push(a);
        if (r() < 0.25)
          list.push({ ...a, distance: (a['distance'] as number) * (1 + (r() - 0.5) * 0.015) });
      }
      if (r() < 0.1) list.push(null);
      const old = j<Record<string, unknown>>(legacy.call('spojiDan', j(list)));
      const mine = mergeDay(list);
      expect(
        { n: mine.n, km: mine.km, sec: mine.sec, hr: mine.hr, maxHr: mine.maxHr, elev: mine.elev },
        `iter ${i}`
      ).toEqual({
        n: old['n'],
        km: old['km'],
        sec: old['sec'],
        hr: old['hr'],
        maxHr: old['maxHr'],
        elev: old['elev']
      });
    }
  });

  it('extractPaceFromDesc: isti rezultat na 40 opisa', () => {
    const descs = [
      '4×1000 m @ 3:52/km (90 s)',
      'Tempo 5 km ~4:25/km',
      'Prag 3:52–3:54/km',
      'Prag 3:52-3:54 / km',
      'Lagano 8 km',
      '',
      null,
      '12:05/km',
      '10:99/km',
      'bez tempa 3:5/km',
      '@ 4:10 /km i 4:20/km'
    ];
    for (const d of descs)
      expect(extractPaceFromDesc(d), String(d)).toBe(legacy.call('extractPaceFromDesc', d));
  });
});

/* ---------- realign ---------- */

describe('pomeranje plana za trčanje bez para naspram starog autoRealign', () => {
  it('300 nasumičnih paketa trčanja: ista pomeranja i isti broj', () => {
    const r = rng(9);
    const START = '2026-01-05' as IsoDate;
    let moved = 0;
    for (let i = 0; i < 300; i++) {
      const dist = pick(r, [5000, 10000, 21097.5, 42195]);
      const sec = (
        { 5000: 1237, 10000: 2570, 21097.5: 5700, 42195: 13500 } as Record<number, number>
      )[dist] as number;
      const g = adaptGeneratedPlan(
        generatePlan({
          startDate: START,
          raceDate: addDays(START, 16 * 7),
          raceDistM: dist,
          pb: { distM: dist, sec },
          weeklyKm: 40 + Math.floor(r() * 30),
          runDays: 5,
          quality: 2,
          intensity: 'std',
          trainedRecently: true
        })
      ) as GenPlanState;
      const week = 1 + Math.floor(r() * 14);
      const log: Record<string, LogEntry> = {};
      const alts: Record<string, AltRecord> = {};
      const runsByDate: Record<string, Array<{ distance: number }>> = {};
      for (const w of g.weeks.slice(0, week)) {
        for (const d of w.days) {
          if (!d.km || r() < 0.3) continue;
          const date = addDays(w.start as IsoDate, d.dow);
          if (w.w < week) log[d.id as string] = { status: 'done' };
          else if (r() < 0.7) {
            const shift = r() < 0.5 ? 0 : Math.floor(r() * 5) - 2;
            const dt = addDays(date, shift);
            (runsByDate[dt] ??= []).push({ distance: Math.round(d.km * 1000 * (0.7 + r() * 0.6)) });
          }
        }
      }
      const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
      ctx['__p'] = j(g);
      ctx['__l'] = j(log);
      ctx['__a'] = j(alts);
      ctx['__r'] = j(runsByDate);
      legacy.evalIn(
        'S.genPlan=__p; S.alts=__a; S.moves={}; S.log=__l; setActivePlan(); rebuildDateIndex(); 0'
      );
      const oldMoved = legacy.evalIn('autoRealign(__r)');
      const oldMoves = j<Record<string, unknown>>(legacy.evalIn('S.moves'));
      const mine = realignPlan({ weeks: g.weeks, alts, moves: {}, log, runsByDate });
      expect(mine.moved, `moved ${i}`).toBe(oldMoved);
      expect(mine.moves, `moves ${i}`).toEqual(oldMoves);
      moved += mine.moved;
    }
    expect(moved, 'uzorak mora da sadrži stvarna pomeranja').toBeGreaterThan(20);
  });
});

/* ---------- krugovi sa intervals.icu ---------- */

function randomRounds(r: () => number): { rounds: IcuRound[]; specs: number[] | undefined } {
  const spec = pick(r, [400, 800, 1000, 1600]);
  const reps = 3 + Math.floor(r() * 6);
  const out: IcuRound[] = [];
  if (r() < 0.8) out.push({ distM: 1200 + r() * 600, paceSec: 330 + r() * 80, hr: 130 }); // zagrevanje
  for (let k = 0; k < reps; k++) {
    const d = spec * (0.95 + r() * 0.1);
    out.push({
      distM: d,
      paceSec: 215 + r() * 40,
      hr: 165,
      kadenca: 180,
      gapSec: r() < 0.5 ? 210 : null,
      maxHr: r() < 0.5 ? 175 : null,
      oznaka: r() < 0.3 ? 'x'.repeat(50) : null
    });
    if (k < reps - 1) {
      const kind = r();
      if (kind < 0.6) out.push({ tip: 'oporavak', sec: 90, paceSec: 420 });
      else if (kind < 0.8)
        out.push({ distM: 200, paceSec: 540 + r() * 100 }); // kaskanje bez oznake
      else out.push({ tip: 'oporavak', sec: 0 });
    }
  }
  if (r() < 0.8) out.push({ distM: 1500 + r() * 1500, paceSec: 340 + r() * 80, hr: 135 }); // hlađenje
  if (r() < 0.2) out.push(null as unknown as IcuRound);
  if (r() < 0.1) out.push({ distM: 0, paceSec: 300 });
  return { rounds: out, specs: r() < 0.6 ? [spec] : r() < 0.5 ? [] : undefined };
}

describe('krugovi sa icu-a naspram starog koda', () => {
  it('500 nasumičnih sesija: isti l.laps i isti tempo radnog dela', () => {
    const r = rng(404);
    let withRest = 0;
    for (let i = 0; i < 500; i++) {
      const { rounds, specs } = randomRounds(r);
      const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
      ctx['__k'] = j(rounds);
      ctx['__s'] = specs === undefined ? undefined : j(specs);
      const old = j<unknown>(legacy.evalIn('icuKrugoviULaps(__k,__s)'));
      const mine = icuRoundsToLaps(rounds, specs);
      expect(firstDiff(canonical(j(mine)), canonical(old)), `laps ${i}`).toBeNull();
      ctx['__k2'] = j(mine);
      expect(icuWorkPace(mine, specs), `tempo ${i}`).toBe(legacy.evalIn('icuRadniTempo(__k2,__s)'));
      expect(selectIcuWorkLaps(rounds.map((x) => x && { ...x }) as never, specs)).toEqual(
        j(legacy.evalIn('icuRadniKrugovi(__k,__s)'))
      );
      if (mine.some((x) => x.restSec)) withRest++;
    }
    expect(withRest).toBeGreaterThan(200);
  });
});
