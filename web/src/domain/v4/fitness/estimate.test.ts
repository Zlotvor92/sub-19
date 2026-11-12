import { describe, expect, it } from 'vitest';
import { ZONE_SHARE } from '../engine/constants';
import type { FormEstimate, Lap, Pause } from '../engine/types';
import { paceAtShare, raceTimeSec, vdotFromResult } from '../engine/vdot';
import { dayNum, estimateForm, isoOf } from './estimate';
import type { FitnessFacts, FitnessRun } from './types';

const HALF = 21097.5;
const TEN = 10000;
const T0 = '2026-09-07'; // ponedeljak

const add = (iso: string, n: number): string => isoOf(dayNum(iso) + n);

function facts(runs: FitnessRun[], today: string, extra: Partial<FitnessFacts> = {}): FitnessFacts {
  return {
    today,
    availability: { runDays: [1, 3, 5, 6], longDay: 6 },
    profile: { recentResult: { distanceM: TEN, timeSec: raceTimeSec(45, TEN), date: add(T0, -7) } },
    runs,
    pauses: [],
    pain: [],
    ...extra
  };
}

/** Deterministički šum u [−1, 1]. */
function noise(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 2 ** 32) * 2 - 1;
  };
}

function easyRun(id: string, date: string, vdot: number, min: number, hr?: number): FitnessRun {
  const pace = paceAtShare(vdot, ZONE_SHARE.E);
  const sec = min * 60;
  const n = Math.floor((sec / pace) * 1000) / 1000;
  return {
    id,
    date,
    distanceM: Math.round((sec / pace) * 1000),
    durationSec: sec,
    ...(hr !== undefined ? { avgHr: hr } : {}),
    splits: Array.from({ length: Math.floor(n) }, () => ({
      paceSec: pace,
      ...(hr !== undefined ? { hr } : {})
    }))
  };
}

/** Prag 4 × 5 min (rad 1200 s), tempo = tempo praga za `vdot` × `factor`. */
function tempoRun(
  id: string,
  date: string,
  vdot: number,
  factor: number,
  rpe?: number
): FitnessRun {
  const pace = paceAtShare(vdot, ZONE_SHARE.T) * factor;
  const laps: Lap[] = [];
  for (let i = 0; i < 4; i += 1) {
    laps.push({ role: 'work', durationSec: 300, distanceM: (300 / pace) * 1000 });
    laps.push({ role: 'recovery', durationSec: 90, distanceM: 200 });
  }
  const dist = laps.reduce((a, l) => a + l.distanceM, 0) + 4000;
  return {
    id,
    date,
    distanceM: Math.round(dist),
    durationSec: 4 * 390 + 1500,
    laps,
    planned: { zone: 'T', workSec: 1200 },
    ...(rpe !== undefined ? { rpe } : {})
  };
}

const goal = (raceDate: string): { distanceM: number; raceDate: string } => ({
  distanceM: HALF,
  raceDate
});
const signals = (e: FormEstimate): string[] => e.history.map((h) => h.signal);

describe('forma iz trčanja — ne skače (§ 7.3)', () => {
  it('jedan odličan trening pomera procenu ≤ 0,1 VDOT', () => {
    const today = add(T0, 3);
    const base = estimateForm(facts([], today), goal('2027-01-10'), null);
    const one = estimateForm(
      facts([tempoRun('q1', add(T0, 2), 45, 0.9)], today),
      goal('2027-01-10'),
      null
    );
    const d = one.current.vdot - base.current.vdot;
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  it('zbir kvaliteta ≤ 0,3 VDOT u 7 dana', () => {
    const runs = [0, 1, 2, 3, 4, 5].map((i) => tempoRun(`q${i}`, add(T0, i), 45, 0.85));
    const e = estimateForm(facts(runs, add(T0, 6)), goal('2027-01-10'), null);
    expect(e.current.vdot - 45).toBeLessThanOrEqual(0.3 + 0.011);
    expect(e.current.vdot - 45).toBeGreaterThan(0.25);
  });

  it('RPE ≥ 9: držao je, ali na granici — bez pomeranja', () => {
    const e = estimateForm(
      facts([tempoRun('q', add(T0, 1), 45, 0.95, 9)], add(T0, 2)),
      goal('2027-01-10'),
      null
    );
    expect(e.current.vdot).toBeCloseTo(45, 2);
  });

  it('neodrađen (sporo) spušta najviše 0,1', () => {
    const e = estimateForm(
      facts([tempoRun('q', add(T0, 1), 45, 1.08)], add(T0, 2)),
      goal('2027-01-10'),
      null
    );
    expect(e.current.vdot).toBeLessThan(45);
    expect(45 - e.current.vdot).toBeLessThanOrEqual(0.1 + 1e-9);
  });
});

describe('trka i test (§ 7.2)', () => {
  const race = (vdot: number, date: string, effort: 'race' | 'test', m: number): FitnessRun => ({
    id: `r-${date}`,
    date,
    distanceM: m,
    durationSec: Math.round(raceTimeSec(vdot, m)),
    effort
  });

  it('trka pomera odmah, k = 0,7 (srednja pouzdanost)', () => {
    const e = estimateForm(
      facts([race(47, add(T0, 5), 'race', TEN)], add(T0, 6)),
      goal('2027-01-10'),
      null
    );
    expect(e.current.vdot).toBeCloseTo(45 + 0.7 * 2, 1);
    expect(signals(e)).toContain('trka');
  });

  it('test, k = 0,5', () => {
    const e = estimateForm(
      facts([race(47, add(T0, 5), 'test', 3000)], add(T0, 6)),
      goal('2027-01-10'),
      null
    );
    expect(e.current.vdot).toBeCloseTo(46, 1);
  });

  it('niska pouzdanost → k = 1,0', () => {
    const low = facts([race(47, add(T0, 5), 'race', TEN)], add(T0, 6), {
      profile: { easyPaceSecPerKm: 360 }
    });
    const e = estimateForm(low, goal('2027-01-10'), null);
    expect(e.start.confidence).toBe('niska');
    expect(e.current.vdot).toBeCloseTo(47, 1);
    expect(e.current.confidence).toBe('visoka');
  });

  it('kraće od 3000 m (trka) se ne računa', () => {
    const e = estimateForm(
      facts([race(50, add(T0, 5), 'race', 2000)], add(T0, 6)),
      goal('2027-01-10'),
      null
    );
    expect(e.current.vdot).toBeCloseTo(45, 2);
  });

  it('toplo: slabiji rezultat ne spušta procenu', () => {
    const r = { ...race(43, add(T0, 5), 'race', TEN), tempC: 27 };
    const e = estimateForm(facts([r], add(T0, 6)), goal('2027-01-10'), null);
    expect(e.current.vdot).toBeCloseTo(45, 2);
  });
});

describe('puls sa zgloba: samo trend (§ 7.4)', () => {
  /** 8 nedelja po 3 lagana trčanja; tempo isti, puls pada 150 → 140 (efikasnost raste ~7 %). */
  function series(withHr: boolean): FitnessRun[] {
    const out: FitnessRun[] = [];
    for (let w = 0; w < 8; w += 1) {
      for (const d of [1, 3, 5]) {
        const hr = 150 - (10 * w) / 7;
        out.push(
          easyRun(`e${w}-${d}`, add(T0, w * 7 + d), 45, 45, withHr ? Math.round(hr) : undefined)
        );
      }
      if (w >= 5) out.push(tempoRun(`q${w}`, add(T0, w * 7 + 2), 47, 1));
    }
    return out;
  }
  const today = add(T0, 7 * 8 - 1);
  const noResult = { profile: { easyPaceSecPerKm: Math.round(paceAtShare(45, ZONE_SHARE.E)) } };

  it('trend pulsa podiže procenu; bez pulsa signal je preskočen i pouzdanost je niža', () => {
    const withHr = estimateForm(facts(series(true), today, noResult), goal('2027-01-10'), null);
    const noHr = estimateForm(facts(series(false), today, noResult), goal('2027-01-10'), null);
    expect(signals(withHr)).toContain('trend-pulsa');
    expect(signals(noHr)).not.toContain('trend-pulsa');
    expect(withHr.current.vdot).toBeGreaterThan(noHr.current.vdot);
    expect(withHr.current.confidence).toBe('srednja');
    expect(noHr.current.confidence).toBe('niska');
    expect(noHr.raceDay.highSec - noHr.raceDay.lowSec).toBeGreaterThan(
      withHr.raceDay.highSec - withHr.raceDay.lowSec
    );
  });

  it('jedno trčanje sa niskim pulsom ne menja ništa; intervali i kratka trčanja se ne koriste', () => {
    const runs: FitnessRun[] = [];
    for (let w = 0; w < 8; w += 1) {
      for (const d of [1, 3, 5]) runs.push(easyRun(`e${w}-${d}`, add(T0, w * 7 + d), 45, 45, 148));
    }
    const base = estimateForm(facts(runs, today), goal('2027-01-10'), null);
    const lowOne = runs.map((r) => (r.id === 'e7-5' ? { ...r, avgHr: 120 } : r));
    const short = Array.from({ length: 6 }, (_, i) =>
      easyRun(`s${i}`, add(T0, 42 + i), 45, 20, 120)
    );
    const intervals = Array.from({ length: 6 }, (_, i) => ({
      ...tempoRun(`i${i}`, add(T0, 43 + i), 45, 1.02),
      avgHr: 120
    }));
    for (const variant of [lowOne, [...runs, ...short], [...runs, ...intervals]]) {
      const e = estimateForm(facts(variant, today), goal('2027-01-10'), null);
      expect(signals(e)).not.toContain('trend-pulsa');
    }
    expect(signals(base)).not.toContain('trend-pulsa');
  });
});

describe('pauza (§ 7.2)', () => {
  const pause = (days: number): Pause => ({
    from: add(T0, 1),
    to: add(T0, days),
    reason: 'bolest'
  });

  it('−0,3 %/dan posle petog', () => {
    const runs = [easyRun('a', T0, 45, 40), easyRun('b', add(T0, 11), 45, 40)];
    const e = estimateForm(
      facts(runs, add(T0, 12), { pauses: [pause(10)] }),
      goal('2027-01-10'),
      null
    );
    expect(e.current.vdot).toBeCloseTo(45 * (1 - 0.003 * 5), 2);
    expect(signals(e)).toContain('pauza');
  });

  it('najviše −8 %', () => {
    const runs = [easyRun('a', T0, 45, 40), easyRun('b', add(T0, 61), 45, 40)];
    const e = estimateForm(
      facts(runs, add(T0, 62), { pauses: [pause(60)] }),
      goal('2027-01-10'),
      null
    );
    expect(e.current.vdot).toBeCloseTo(45 * 0.92, 2);
  });

  it('prekid bez zapisanog trčanja se sam računa tek od 14 dana; 13 dana nije pauza', () => {
    const gap = (n: number): FormEstimate =>
      estimateForm(
        facts([easyRun('a', T0, 45, 40), easyRun('b', add(T0, n + 1), 45, 40)], add(T0, n + 1)),
        goal('2027-01-10'),
        null
      );
    expect(signals(gap(13))).not.toContain('pauza');
    expect(gap(14).current.vdot).toBeCloseTo(45 * (1 - 0.003 * 9), 1);
  });
});

describe('determinizam i urađeno se ne menja', () => {
  it('isti ulaz → isti izlaz; ulaz netaknut (zamrznut)', () => {
    const runs = [
      easyRun('a', T0, 45, 50, 145),
      tempoRun('q', add(T0, 2), 45, 0.97),
      easyRun('b', add(T0, 4), 45, 50, 144)
    ];
    const f = facts(runs, add(T0, 20));
    const snap = JSON.stringify(f);
    const deepFreeze = <T>(o: T): T => {
      if (o !== null && typeof o === 'object') {
        Object.freeze(o);
        for (const v of Object.values(o)) deepFreeze(v);
      }
      return o;
    };
    deepFreeze(f);
    const a = estimateForm(f, goal('2027-01-10'), { baseLoad: 300, peakLoad: 380 });
    const b = estimateForm(f, goal('2027-01-10'), { baseLoad: 300, peakLoad: 380 });
    expect(a).toEqual(b);
    expect(JSON.stringify(f)).toBe(snap);
    /* redosled trčanja na ulazu ne menja rezultat */
    const c = estimateForm({ ...f, runs: [...f.runs].reverse() }, goal('2027-01-10'), {
      baseLoad: 300,
      peakLoad: 380
    });
    expect(c).toEqual(a);
  });

  it('trčanje posle „danas" se ne uzima', () => {
    const f = facts([tempoRun('q', add(T0, 30), 45, 0.8)], add(T0, 5));
    expect(estimateForm(f, goal('2027-01-10'), null).current.vdot).toBeCloseTo(45, 2);
  });
});

describe('raspon na dan trke (§ 7.5)', () => {
  const today = add(T0, 0);
  it('plan ≥ 10 nedelja: očekivano brže od današnjeg vremena; low < expected < high', () => {
    const e = estimateForm(facts([], today), goal(add(today, 7 * 12)), {
      baseLoad: 300,
      peakLoad: 390
    });
    expect(e.raceDay.expectedSec).toBeLessThan(e.current.raceTimeSec);
    expect(e.raceDay.lowSec).toBeLessThan(e.raceDay.expectedSec);
    expect(e.raceDay.expectedSec).toBeLessThan(e.raceDay.highSec);
    expect(e.ceilingGain).toBeGreaterThan(0);
  });

  it('raspon se sužava kad pouzdanost raste', () => {
    const low = estimateForm(
      facts([], today, { profile: { easyPaceSecPerKm: 330 } }),
      goal(add(today, 84)),
      null
    );
    const raceRun: FitnessRun = {
      id: 'r',
      date: today,
      distanceM: TEN,
      durationSec: Math.round(raceTimeSec(45, TEN)),
      effort: 'race'
    };
    const high = estimateForm(facts([raceRun], today), goal(add(today, 84)), null);
    expect(low.current.confidence).toBe('niska');
    expect(high.current.confidence).toBe('visoka');
    const width = (e: FormEstimate): number => e.raceDay.highSec - e.raceDay.lowSec;
    expect(width(high)).toBeLessThan(width(low));
  });

  it('početnik ima veći plafon od trkača sa > 3 god.', () => {
    const g = goal(add(today, 7 * 16));
    const beginner = estimateForm(
      facts([], today, { profile: { beginner: true, easyPaceSecPerKm: 360 } }),
      g,
      null
    );
    const senior = estimateForm(
      facts([], today, { profile: { yearsRunning: 6, easyPaceSecPerKm: 360 } }),
      g,
      null
    );
    expect(beginner.ceilingGain).toBeGreaterThan(senior.ceilingGain);
  });

  it('rast obima diže plafon (f_v 0,8 → 1,2)', () => {
    const g = goal(add(today, 7 * 12));
    const flat = estimateForm(facts([], today), g, { baseLoad: 300, peakLoad: 300 });
    const up = estimateForm(facts([], today), g, { baseLoad: 300, peakLoad: 400 });
    expect(up.ceilingGain / flat.ceilingGain).toBeCloseTo(1.5, 2);
  });
});

/* ------------------------------------------------------------------ izmišljeni nizovi sa poznatim odgovorom */

/** Nedelja: lagano uto/čet/sub 45 min, prag sreda, dugi nedelja 90 min; `trueV(dan)` je stvarna forma. */
function athlete(
  weeks: number,
  trueV: (day: number) => number,
  pctNoise: number,
  seed: number
): FitnessRun[] {
  const rnd = noise(seed);
  const out: FitnessRun[] = [];
  for (let w = 0; w < weeks; w += 1) {
    for (const d of [1, 3, 5]) {
      const day = w * 7 + d;
      out.push(easyRun(`e${day}`, add(T0, day), trueV(day), 45, 146 + Math.round(rnd() * 2)));
    }
    const qd = w * 7 + 2;
    out.push(tempoRun(`q${qd}`, add(T0, qd), trueV(qd), 1 + pctNoise * rnd()));
    out.push(easyRun(`l${w}`, add(T0, w * 7 + 6), trueV(w * 7 + 6), 90, 144));
  }
  return out;
}

/** Simulacija § 7.6: koliko puta bi se tempa plana promenila kroz niz. */
function paceUpdates(runs: FitnessRun[], days: number): { count: number; daily: number[] } {
  let paceVdot: number | null = null;
  let updatedOn = -Infinity;
  let count = 0;
  const daily: number[] = [];
  for (let d = 0; d < days; d += 1) {
    const today = add(T0, d);
    const e = estimateForm(
      facts(
        runs.filter((r) => r.date <= today),
        today
      ),
      goal('2027-03-01'),
      null
    );
    daily.push(e.current.vdot);
    if (paceVdot === null) {
      paceVdot = e.current.vdot;
      updatedOn = d;
      continue;
    }
    if (
      Math.abs(e.current.vdot - paceVdot) >= 0.5 &&
      e.current.confidence !== 'niska' &&
      d - updatedOn >= 14
    ) {
      paceVdot = e.current.vdot;
      updatedOn = d;
      count += 1;
    }
  }
  return { count, daily };
}

describe('izmišljeni nizovi (12 nedelja)', () => {
  const DAYS = 84;

  it('napreduje 0,1 VDOT/ned: procena prati sa kašnjenjem, ne prebacuje', () => {
    const trueV = (day: number): number => 45 + (0.1 * day) / 7;
    const runs = athlete(12, trueV, 0, 1);
    const { daily } = paceUpdates(runs, DAYS);
    daily.forEach((v, d) => expect(v).toBeLessThanOrEqual(trueV(d) + 0.15));
    const last = daily[daily.length - 1] ?? 0;
    expect(last).toBeGreaterThan(45.4);
    expect(last).toBeLessThan(trueV(DAYS));
    /* kašnjenje: ravnoteža k = 0,1 uz jedan kvalitet nedeljno je ≈ 1 VDOT (F4-REPORT) */
    expect(trueV(DAYS) - last).toBeLessThanOrEqual(1.0);
  });

  it('stagnira: procena stoji', () => {
    const runs = athlete(12, () => 45, 0, 2);
    const { daily, count } = paceUpdates(runs, DAYS);
    daily.forEach((v) => expect(Math.abs(v - 45)).toBeLessThan(0.15));
    expect(count).toBe(0);
  });

  it('šum ± 3 %: procena ne „šeta" (≤ 2 promene tempa po histerezi)', () => {
    for (const seed of [3, 4, 5]) {
      const runs = athlete(12, () => 45, 0.03, seed);
      const { daily, count } = paceUpdates(runs, DAYS);
      expect(count).toBeLessThanOrEqual(2);
      daily.forEach((v) => expect(Math.abs(v - 45)).toBeLessThan(1.0));
    }
  });
});

describe('korekcija rezultata', () => {
  it('izrazito negativan split dodaje najviše polovinu razlike', () => {
    const paces = [
      310, 305, 300, 300, 300, 300, 300, 295, 295, 295, 290, 290, 285, 285, 280, 280, 275, 275, 270,
      265, 260
    ];
    const dur = paces.reduce((a, b) => a + b, 0) + 30;
    const r: FitnessRun = {
      id: 'h',
      date: T0,
      distanceM: HALF,
      durationSec: dur,
      effort: 'race',
      splits: paces.map((p) => ({ paceSec: p }))
    };
    const e = estimateForm(facts([r], T0, { profile: {} }), goal('2027-01-10'), null);
    const raw = vdotFromResult(HALF, dur);
    expect(e.current.vdot).toBeGreaterThan(raw + 0.1);
    expect(e.current.vdot).toBeLessThanOrEqual(raw + 1.0);
  });
});
