import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { generatePlan } from '../training/generator/generatePlan';
import type { GenPlanState } from '../state';
import {
  decouplingPerKm,
  detectWorkSegments,
  icuRoundsToLaps,
  icuWorkPace,
  keepWorkItems,
  mergeDay,
  perKmDetail,
  realignPlan,
  selectIcuWorkLaps,
  selectWorkLaps,
  workLapsPace,
  type ActivityStreams
} from './index';

/* parity: test/intervali-radni-deo.test.mjs, test/spojevi.test.mjs, test/doslednost.test.mjs.
   Brojčana jednakost sa starim kodom je u `activities.oracle.test.ts`; ovde su NAMERA i poznate zamke. */

/** Deterministički stream: niz delova (sekunde, brzina m/s), 1 Hz, bez šuma. */
function build(pieces: Array<{ sec: number; v: number }>, moving?: boolean[]): ActivityStreams {
  const dist = [0];
  const time = [0];
  let d = 0;
  let t = 0;
  for (const p of pieces)
    for (let k = 0; k < p.sec; k++) {
      t += 1;
      d += p.v;
      dist.push(d);
      time.push(t);
    }
  return {
    distance: { data: dist },
    time: { data: time },
    ...(moving ? { moving: { data: moving } } : {})
  };
}

describe('prepoznavanje radnih segmenata', () => {
  it('5 × 1000 m @ 3:52 sa hodom: pet segmenata, tempo ±4 s', () => {
    const v = 1000 / 232;
    const pieces = [{ sec: 600, v: 3.0 }];
    for (let k = 0; k < 5; k++) pieces.push({ sec: 232, v }, { sec: 120, v: 1.0 });
    pieces.push({ sec: 480, v: 2.8 });
    const segs = detectWorkSegments(build(pieces));
    expect(segs).toHaveLength(5);
    for (const s of segs ?? []) {
      expect(Math.abs(s.paceSec - 232)).toBeLessThanOrEqual(4);
      expect(Math.abs(s.distM - 1000)).toBeLessThanOrEqual(50); // klizni prozor ±7 s razmazuje ivice: ~3 % je svojstvo metode;
    }
    expect(segs?.map((s) => s.i)).toEqual([1, 2, 3, 4, 5]);
  });

  it('lagano kontinuirano trčanje: nema radnih segmenata (prazan niz, ne null)', () => {
    expect(detectWorkSegments(build([{ sec: 2400, v: 3.1 }]))).toEqual([]);
  });

  it('tempo 2 × 10 min između zagrevanja i hlađenja: dva segmenta', () => {
    const segs = detectWorkSegments(
      build([
        { sec: 600, v: 2.9 },
        { sec: 600, v: 3.9 },
        { sec: 90, v: 2.2 },
        { sec: 600, v: 3.9 },
        { sec: 420, v: 2.8 }
      ])
    );
    expect(segs?.length).toBeGreaterThanOrEqual(1);
    expect(segs?.every((s) => Math.abs(s.paceSec - 256) <= 6)).toBe(true);
  });

  it('streamovi koji se ne mogu koristiti: null (kratki, različitih dužina, bez vremena)', () => {
    expect(detectWorkSegments(build([{ sec: 60, v: 3 }]))).toBeNull();
    expect(detectWorkSegments({ distance: { data: [1, 2, 3] } })).toBeNull();
    expect(detectWorkSegments(null)).toBeNull();
  });

  it('puls, kadenca i snaga se prosečavaju samo preko pozitivnih uzoraka', () => {
    const reps = Array.from({ length: 4 }, () => [
      { sec: 150, v: 5.0 },
      { sec: 120, v: 1.0 }
    ]).flat();
    const s = build([{ sec: 300, v: 3.0 }, ...reps]);
    const n = (s.distance?.data.length ?? 0) - 1;
    const withHr: ActivityStreams = {
      ...s,
      heartrate: { data: Array.from({ length: n + 1 }, (_, i) => (i % 7 === 0 ? 0 : 160)) }
    };
    const segs = detectWorkSegments(withHr);
    expect(segs?.[0]?.avgHr).toBe(160);
    expect(detectWorkSegments(s)?.[0]?.avgHr).toBeNull();
  });
});

describe('po-kilometarski presek', () => {
  it('tempo iz vremena u POKRETU: stajanje ne kvari tempo kilometra', () => {
    const pieces = [
      { sec: 300, v: 3.0 },
      { sec: 90, v: 0 },
      { sec: 600, v: 3.0 }
    ];
    const s = build(pieces);
    const n = (s.time?.data.length ?? 1) - 1;
    const moving = [true, ...Array.from({ length: n }, (_, i) => !(i >= 300 && i < 390))];
    const withStop = perKmDetail({ ...s, moving: { data: moving } });
    const without = perKmDetail(s);
    expect(withStop[0]?.paceSec).toBeLessThan(without[0]?.paceSec as number);
    expect(Math.abs((withStop[0]?.paceSec ?? 0) - 333)).toBeLessThanOrEqual(2);
    expect(withStop.some((k) => (k.stopSec ?? 0) >= 80)).toBe(true);
  });

  it('dekuplovanje: ravnomeran tempo daje broj, progresivno trčanje razlog (ne broj)', () => {
    const even = Array.from({ length: 10 }, (_, i) => ({ paceSec: 300, hr: 140 + i }));
    expect(typeof decouplingPerKm(even)?.n).toBe('number');
    const prog = Array.from({ length: 10 }, (_, i) => ({ paceSec: 330 - i * 10, hr: 140 + i }));
    expect(decouplingPerKm(prog)).toEqual({ n: null, reason: 'tempo nije bio ravnomeran' });
    expect(decouplingPerKm([{ paceSec: 300, hr: 140 }])).toBeNull();
  });
});

describe('krugovi', () => {
  const lap = (distance: number, pace: number) => ({
    distance,
    moving_time: Math.round((distance / 1000) * pace)
  });

  it('zagrevanje i hladjenje iste dužine ne ulaze u radni tempo', () => {
    const laps = [lap(1000, 390), lap(1000, 232), lap(1000, 234), lap(1000, 231), lap(1000, 380)];
    expect(selectWorkLaps(laps, [1000])).toHaveLength(3);
    expect(workLapsPace(laps, [1000])).toBe(232);
  });

  it('neupotrebljiv tempo (nula, NaN) ispada iz izbora', () => {
    expect(keepWorkItems([0, Number.NaN, 250, 260], (x) => x)).toEqual([250, 260]);
    expect(keepWorkItems([], (x: number) => x)).toEqual([]);
  });

  it('bez krugova nema tempa', () => {
    expect(workLapsPace([], [1000])).toBeNull();
    expect(workLapsPace(null, [1000])).toBeNull();
  });
});

describe('spajanje trčanja istog dana', () => {
  const run = (km: number, sec: number, hr?: number) => ({
    distance: km * 1000,
    moving_time: sec,
    ...(hr ? { average_heartrate: hr } : {})
  });

  it('dva trčanja istog dana su dva trčanja: km i vreme se sabiraju, puls je ponderisan trajanjem', () => {
    const m = mergeDay([run(7.71, 2400, 150), run(9.4, 3000, 130)]);
    expect(m.n).toBe(2);
    expect(m.km).toBe(17.11);
    expect(m.sec).toBe(5400);
    expect(m.hr).toBe(Math.round((150 * 2400 + 130 * 3000) / 5400));
  });

  it('isti trening koji stigne dvaput (razlika < 1 %) se ne sabira', () => {
    const m = mergeDay([run(10, 3000, 140), run(10.05, 3010, 141)]);
    expect(m.n).toBe(1);
    expect(m.km).toBe(10);
  });

  it('nepoznato trajanje nije nula: `sec` je null, a poznat puls se ne gubi', () => {
    const m = mergeDay([{ distance: 8000, average_heartrate: 145 }]);
    expect(m.sec).toBeNull();
    expect(m.hr).toBe(145);
  });

  it('prazna lista: nula km, ništa nepoznato ne izmišljeno', () => {
    expect(mergeDay([])).toMatchObject({
      n: 0,
      km: 0,
      sec: null,
      hr: null,
      maxHr: null,
      elev: null
    });
    expect(mergeDay(null).n).toBe(0);
  });
});

describe('pomeranje plana za trčanje bez para', () => {
  const START = '2026-01-05' as IsoDate;
  const plan = adaptGeneratedPlan(
    generatePlan({
      startDate: START,
      raceDate: addDays(START, 12 * 7),
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2700 },
      weeklyKm: 45,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  ) as GenPlanState;
  const week = plan.weeks[2] as GenPlanState['weeks'][number];
  const runDays = week.days.filter((d) => d.km && !d.rest);
  const restDay = week.days.find((d) => d.rest);
  const dateOf = (dow: number): IsoDate => addDays(week.start as IsoDate, dow);

  it('trčanje na dan odmora prelazi na najbliži neodrađen trkački dan sličnog obima', () => {
    if (!restDay) throw new Error('plan bez dana odmora');
    const near = runDays
      .filter((d) => Math.abs(d.dow - restDay.dow) <= 2)
      .sort((a, b) => Math.abs(a.dow - restDay.dow) - Math.abs(b.dow - restDay.dow))[0];
    if (!near || !near.km) return;
    const res = realignPlan({
      weeks: plan.weeks,
      alts: {},
      moves: {},
      log: {},
      runsByDate: { [dateOf(restDay.dow)]: [{ distance: near.km * 1000 }] }
    });
    expect(res.moved).toBe(1);
    expect(Object.keys(res.moves).length).toBe(2);
  });

  it('dan sa sopstvenim trčanjem u istom paketu nikad nije kandidat', () => {
    if (!restDay) throw new Error('plan bez dana odmora');
    const runsByDate: Record<string, Array<{ distance: number }>> = {
      [dateOf(restDay.dow)]: [{ distance: 8000 }]
    };
    for (const d of runDays) runsByDate[dateOf(d.dow)] = [{ distance: (d.km as number) * 1000 }];
    const res = realignPlan({ weeks: plan.weeks, alts: {}, moves: {}, log: {}, runsByDate });
    expect(res.moved).toBe(0);
  });

  it('odrađen dan se ne pomera; ulaz se ne menja', () => {
    if (!restDay) throw new Error('plan bez dana odmora');
    const log = Object.fromEntries(runDays.map((d) => [d.id as string, { status: 'done' }]));
    const moves = {};
    const before = JSON.stringify([plan, log, moves]);
    const res = realignPlan({
      weeks: plan.weeks,
      alts: {},
      moves,
      log,
      runsByDate: { [dateOf(restDay.dow)]: [{ distance: 8000 }] }
    });
    expect(res.moved).toBe(0);
    expect(JSON.stringify([plan, log, moves])).toBe(before);
  });
});

describe('krugovi sa intervals.icu', () => {
  it('zagrevanje i hlađenje ne ulaze u radni tempo (sesija 1,5 km WU + 6×1000 @ 3:55 + 2,5 km CD)', () => {
    const rounds = [
      { distM: 1500, paceSec: 330 },
      ...Array.from({ length: 6 }, () => [
        { distM: 1000, paceSec: 235 },
        { tip: 'oporavak', sec: 90, paceSec: 420 }
      ]).flat(),
      { distM: 2500, paceSec: 345 }
    ];
    const laps = icuRoundsToLaps(rounds, [1000]);
    expect(laps).toHaveLength(6);
    expect(icuWorkPace(laps, [1000])).toBe(235);
    expect(laps[0]?.restSec).toBe(90);
    // bez plana (specs) sporiji krajevi se svejedno skidaju po položaju
    expect(icuWorkPace(icuRoundsToLaps(rounds), undefined)).toBe(235);
  });

  it('lestvica: kratak brz rep na krajevima i dugi sporiji u sredini — svi su radni (sredina se ne dira)', () => {
    const rounds = [
      { distM: 400, paceSec: 180 },
      { distM: 1600, paceSec: 240 },
      { distM: 400, paceSec: 180 }
    ];
    expect(selectIcuWorkLaps(rounds)).toHaveLength(3);
  });

  it('prva deonica sporija od 1,25 × najbrža iz jezgra je zagrevanje (poznato ponašanje, ne zakon)', () => {
    const rounds = [
      { distM: 1600, paceSec: 240 },
      { distM: 400, paceSec: 180 },
      { distM: 1600, paceSec: 240 },
      { distM: 400, paceSec: 180 }
    ];
    expect(selectIcuWorkLaps(rounds)).toHaveLength(3);
  });

  it('ispod tri deonice se ne dira ništa; deonice bez tempa ili dužine ispadaju', () => {
    const two = [
      { distM: 1000, paceSec: 240 },
      { distM: 1000, paceSec: 330 }
    ];
    expect(selectIcuWorkLaps(two)).toEqual(two);
    expect(selectIcuWorkLaps([{ distM: 0, paceSec: 200 }, null, { distM: 500 }])).toEqual([]);
    expect(icuWorkPace([], [1000])).toBeNull();
  });

  it('ako nijedna deonica ne odgovara planu, pravilo se NE primenjuje (ne briše sve)', () => {
    const laps = [
      { distM: 1000, paceSec: 240 },
      { distM: 1000, paceSec: 242 },
      { distM: 1000, paceSec: 238 }
    ];
    expect(selectIcuWorkLaps(laps, [400])).toHaveLength(3);
  });
});
