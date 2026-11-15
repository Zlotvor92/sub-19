/* Krug 2 (R12, R13, R14): odrađen plan je dokaz, pad baze, prvi rezultat i trka sa hodanjem. */
import { describe, expect, it } from 'vitest';
import { ZONE_SHARE } from '../engine/constants';
import type { FormEstimate } from '../engine/types';
import { paceAtShare, raceTimeSec, vdotFromResult } from '../engine/vdot';
import { dayNum, estimateForm, isoOf } from './estimate';
import type { FitnessFacts, FitnessPlanned, FitnessRun } from './types';

const HALF = 21097.5;
const TEN = 10000;
const T0 = '2026-09-07'; // ponedeljak
const add = (iso: string, n: number): string => isoOf(dayNum(iso) + n);
const RACE = add(T0, 7 * 14 - 1); // nedelja na kraju 14. nedelje
const goal = { distanceM: HALF, raceDate: RACE };

function facts(runs: FitnessRun[], today: string, extra: Partial<FitnessFacts> = {}): FitnessFacts {
  return {
    today,
    availability: { runDays: [1, 3, 5, 6], longDay: 6 },
    profile: {
      recentResult: { distanceM: TEN, timeSec: raceTimeSec(45, TEN), date: add(T0, -14) },
      yearsRunning: 2
    },
    runs: runs.filter((r) => r.date <= today),
    pauses: [],
    pain: [],
    ...extra
  };
}

/** Lagano trčanje `min` minuta tempom E za VDOT 45 (bez pulsa, po km ravnomerno). */
function easy(id: string, date: string, min: number): FitnessRun {
  const pace = paceAtShare(45, ZONE_SHARE.E);
  const sec = Math.round(min * 60);
  const km = Math.floor(sec / pace);
  return {
    id,
    date,
    dayId: id,
    distanceM: Math.round((sec / pace) * 1000),
    durationSec: sec,
    splits: Array.from({ length: Math.max(1, km) }, () => ({ paceSec: pace }))
  };
}

/** Istorija pre plana (6 nedelja, ~200 min nedeljno) + plan od `weeks` nedelja sa nedeljnim faktorom obima. */
function history(weeks: number, factor: (w: number) => number): FitnessRun[] {
  const out: FitnessRun[] = [];
  for (let w = -6; w < weeks; w += 1) {
    const f = w < 0 ? 1 : factor(w);
    for (const [d, min] of [
      [1, 45],
      [3, 45],
      [5, 40],
      [6, 70]
    ] as const) {
      out.push(easy(`w${w}d${d}`, add(T0, w * 7 + d), min * f));
    }
  }
  return out;
}

const PLAN: FitnessPlanned = { baseLoad: 200, peakLoad: 260 };
const at = (runs: FitnessRun[], day: number, planned: FitnessPlanned | null = PLAN): FormEstimate =>
  estimateForm(facts(runs, add(T0, day)), goal, planned);
const width = (e: FormEstimate): number => e.raceDay.highSec - e.raceDay.lowSec;

describe('R12 — odrađen plan je dokaz', () => {
  it('6 odrađenih nedelja po planu: očekivano se ne pogoršava za > 10 s, raspon se sužava', () => {
    const runs = history(12, (w) => 1 + 0.04 * w);
    const start = at(runs, -1);
    const after6 = at(runs, 7 * 6 - 1);
    expect(after6.raceDay.expectedSec - start.raceDay.expectedSec).toBeLessThanOrEqual(10);
    expect(width(after6)).toBeLessThan(width(start));
    /* E8 (krug 5): odrađen plan bez signala ne pomera trenutnu procenu — samo očekivanje na dan trke */
    expect(after6.current.vdot).toBe(start.current.vdot);
    expect(after6.history.some((h) => h.reason.includes('odrađena je po planu'))).toBe(true);
  });

  it('isto sa nedeljnim ciljevima plana, uključujući rasterećenje', () => {
    const factor = (w: number): number => (w === 3 ? 0.8 : 1 + 0.03 * w);
    const runs = history(12, factor);
    const weeks = Array.from({ length: 14 }, (_, w) => ({
      start: add(T0, w * 7),
      targetLoad: 200 * factor(w)
    }));
    const planned: FitnessPlanned = { ...PLAN, weeks };
    const start = at(runs, -1, planned);
    for (const wk of [2, 4, 6, 8]) {
      const e = at(runs, 7 * wk - 1, planned);
      expect(e.raceDay.expectedSec - start.raceDay.expectedSec).toBeLessThanOrEqual(10);
    }
  });

  it('pridržavanje < 0,6: ništa se ne pripisuje, a manjak ima rečenicu', () => {
    const runs = history(6, () => 0.5);
    /* od 2. nedelje 7-dnevni prozor više ne sadrži nedelje pre pada */
    const start = at(runs, 7 * 1 - 1);
    const after = at(runs, 7 * 4 - 1);
    expect(after.current.vdot).toBeLessThanOrEqual(start.current.vdot + 0.01);
    expect(after.raceDay.expectedSec).toBeGreaterThan(start.raceDay.expectedSec);
    expect(
      after.history.some((h) => h.reason.includes('očekivani napredak do trke smanjuje'))
    ).toBe(true);
  });

  it('svaka promena očekivanog vremena > 20 s između dva dana ima rečenicu tog dana', () => {
    /* mešovito: 3 nedelje po planu, nedelja pauze u obimu (30 %), pa po planu */
    const runs = history(10, (w) => (w === 3 ? 0.3 : 1 + 0.03 * w));
    let prev = at(runs, -1);
    for (let d = 0; d < 70; d += 1) {
      const e = at(runs, d);
      if (Math.abs(e.raceDay.expectedSec - prev.raceDay.expectedSec) > 20) {
        const day = add(T0, d);
        expect(e.history.some((h) => h.date === day && h.reason.length > 20)).toBe(true);
      }
      prev = e;
    }
  });

  it('pripisano nikad ne prelazi plafon; posle trke kreće iznova', () => {
    const runs = history(12, (w) => 1 + 0.05 * w);
    const e = at(runs, 7 * 12 - 1);
    const pre = at(runs, -1);
    expect(e.current.vdot - pre.current.vdot).toBeLessThanOrEqual(0.65 * 2.5 + 0.01);
    const race: FitnessRun = {
      id: 'r',
      date: add(T0, 7 * 6),
      distanceM: TEN,
      durationSec: Math.round(raceTimeSec(45.5, TEN)),
      effort: 'race'
    };
    const withRace = at([...runs, race], 7 * 6);
    expect(withRace.history.some((h) => h.signal === 'trka')).toBe(true);
  });
});

describe('R12 sa ciljevima nedelja plana (krug 3): kao S09 i S21', () => {
  /* 12 nedelja gradnje (+3 %/ned), pa dve nedelje sužavanja (70 %, 55 %); trka u nedelju 14. nedelje */
  const factor = (w: number): number => (w < 12 ? 1 + 0.03 * w : w === 12 ? 0.7 : 0.55);
  const planned: FitnessPlanned = {
    ...PLAN,
    weeks: Array.from({ length: 14 }, (_, w) => ({
      start: add(T0, w * 7),
      targetLoad: 200 * factor(w)
    }))
  };
  const expectedOn = (runs: FitnessRun[], day: number): FormEstimate => at(runs, day, planned);

  /** Svaka promena očekivanog vremena > 20 s između dva dana ima rečenicu tog dana. */
  function explainedDaily(runs: FitnessRun[], last: number): void {
    let prev = expectedOn(runs, -1);
    for (let d = 0; d <= last; d += 1) {
      const e = expectedOn(runs, d);
      if (Math.abs(e.raceDay.expectedSec - prev.raceDay.expectedSec) > 20) {
        expect(e.history.some((h) => h.date === add(T0, d))).toBe(true);
      }
      prev = e;
    }
  }

  it('sve po planu (S21) i sužavanje: očekivano ≤ +10 s do dana pred trku; signal „plan"', () => {
    const runs = history(14, factor);
    const start = expectedOn(runs, -1);
    for (const day of [41, 83, 90, 96]) {
      const e = expectedOn(runs, day);
      expect(e.raceDay.expectedSec - start.raceDay.expectedSec).toBeLessThanOrEqual(10);
    }
    const end = expectedOn(runs, 90);
    expect(end.history.some((h) => h.signal === 'plan')).toBe(true);
    expect(end.history.some((h) => h.reason.includes('smanjuje'))).toBe(false);
    explainedDaily(runs, 96);
  });

  it('propušten vršni dugi (S09): pad očekivanog samo uz rečenicu', () => {
    const runs = history(14, factor).filter((r) => r.id !== 'w11d6');
    const start = expectedOn(runs, -1);
    const end = expectedOn(runs, 90);
    const short = end.history.filter((h) => h.signal === 'plan' && h.reason.includes('smanjuje'));
    expect(short.length).toBe(1);
    /* pridržavanje je 7-dnevni prozor: manjak se vidi u nedelji propuštenog dugog ili prvoj sledećoj */
    const missed = dayNum(add(T0, 7 * 11 + 6));
    const said = dayNum(short[0]?.date ?? '1970-01-01');
    expect(said - missed).toBeGreaterThanOrEqual(0);
    expect(said - missed).toBeLessThanOrEqual(7);
    expect(end.raceDay.expectedSec - start.raceDay.expectedSec).toBeLessThanOrEqual(60);
    explainedDaily(runs, 96);
  });
});

describe('R13 — pad baze', () => {
  it('baza ≤ 70 % one od pre 6 nedelja: forma blago opada, sa rečenicom; najviše −3 %', () => {
    const runs = history(8, (w) => (w >= 2 ? 0.35 : 1));
    /* cilj iste dužine kao uneti rezultat (10 km): bez prenosa na dužinu */
    const far = { distanceM: TEN, raceDate: add(T0, 400) };
    const e = estimateForm(facts(runs, add(T0, 7 * 8 - 1)), far, null);
    const drop = e.history.filter((h) => h.reason.includes('šest nedelja'));
    expect(drop.length).toBeGreaterThan(0);
    expect(drop.every((h) => h.signal === 'baza')).toBe(true);
    const base = vdotFromResult(TEN, raceTimeSec(45, TEN));
    expect(e.current.vdot).toBeLessThan(base);
    expect(e.current.vdot).toBeGreaterThanOrEqual(base * 0.97 - 0.01);
  });

  it('obim isti: nema pada; pauza u prozoru: ne sabira se sa padom baze', () => {
    const far = { distanceM: HALF, raceDate: add(T0, 400) };
    const steady = estimateForm(
      facts(
        history(8, () => 1),
        add(T0, 55)
      ),
      far,
      null
    );
    expect(steady.history.some((h) => h.reason.includes('šest nedelja'))).toBe(false);
    const runs = history(8, (w) => (w >= 2 && w < 5 ? 0 : 1)).filter((r) => r.durationSec > 0);
    const paused = estimateForm(
      facts(runs, add(T0, 55), {
        pauses: [{ from: add(T0, 14), to: add(T0, 34), reason: 'bolest' }]
      }),
      far,
      null
    );
    expect(
      paused.history.some((h) => h.signal === 'pauza' && h.reason.includes('Bez trčanja'))
    ).toBe(true);
    expect(paused.history.some((h) => h.reason.includes('šest nedelja'))).toBe(false);
  });
});

describe('R14 — prvi rezultat i trka sa hodanjem', () => {
  const noResult = { profile: { easyPaceSecPerKm: 400 } };
  const far = { distanceM: TEN, raceDate: add(T0, 400) };

  it('trka sa hodanjem: bez korekcije, vreme = rezultat, pouzdanost srednja, rečenica', () => {
    const paces = Array.from({ length: 21 }, (_, i) => (i % 5 === 4 ? 560 : 360));
    const dur = paces.reduce((a, b) => a + b, 0) + 40;
    const race: FitnessRun = {
      id: 'h',
      date: T0,
      distanceM: HALF,
      durationSec: dur,
      effort: 'race',
      splits: paces.map((p) => ({ paceSec: p }))
    };
    const e = estimateForm(facts([race], T0, noResult), { ...far, distanceM: HALF }, null);
    expect(Math.abs(e.current.raceTimeSec - dur)).toBeLessThanOrEqual(2);
    expect(e.current.confidence).toBe('srednja');
    expect(e.history.find((h) => h.signal === 'trka')?.reason).toContain('hodanja');
  });

  it('Run.walked: hodanje i bez km — bez korekcije, i drugi rezultat ostaje srednja', () => {
    const r1: FitnessRun = {
      id: 'a',
      date: T0,
      distanceM: TEN,
      durationSec: Math.round(raceTimeSec(44, TEN)),
      effort: 'race'
    };
    const r2: FitnessRun = {
      id: 'b',
      date: add(T0, 21),
      distanceM: HALF,
      durationSec: 7920,
      effort: 'race',
      walked: true
    };
    const e = estimateForm(facts([r1, r2], add(T0, 22), noResult), far, null);
    expect(e.current.confidence).toBe('srednja');
    expect(e.history.find((h) => h.runId === 'b')?.reason).toContain('hodanja');
  });

  it('prvi rezultat: srednja; drugi rezultat: visoka; delimično usvajanje ima rečenicu', () => {
    const r1: FitnessRun = {
      id: 'a',
      date: T0,
      distanceM: TEN,
      durationSec: Math.round(raceTimeSec(44, TEN)),
      effort: 'race'
    };
    const r2: FitnessRun = {
      id: 'b',
      date: add(T0, 21),
      distanceM: TEN,
      durationSec: Math.round(raceTimeSec(46, TEN)),
      effort: 'race'
    };
    const one = estimateForm(facts([r1], add(T0, 1), noResult), far, null);
    expect(one.current.confidence).toBe('srednja');
    expect(one.current.vdot).toBeCloseTo(44, 1);
    /* Z6 (krug 7): „visoka" tek posle dva SAGLASNA rezultata (VDOT ≤ 2 %); 44 i 46 nisu saglasni */
    const two = estimateForm(facts([r1, r2], add(T0, 22), noResult), far, null);
    expect(two.current.confidence).toBe('srednja');
    /* A16 (krug 9): brža trka na dužini cilja se usvaja cela; delimično usvajanje (uz rečenicu) ostaje za drugu dužinu */
    expect(two.current.vdot).toBeCloseTo(46, 1);
    const other: FitnessRun = {
      ...r2,
      id: 's',
      distanceM: 5000,
      durationSec: Math.round(raceTimeSec(46, 5000))
    };
    const partial = estimateForm(facts([r1, other], add(T0, 22), noResult), far, null);
    const second = partial.history.filter((h) => h.signal === 'trka')[1];
    expect(second?.reason).toContain('Usvaja se 70 %');
    const r3: FitnessRun = { ...r2, id: 'c', durationSec: Math.round(raceTimeSec(44.6, TEN)) };
    const agree = estimateForm(facts([r1, r3], add(T0, 22), noResult), far, null);
    expect(agree.current.confidence).toBe('visoka');
  });
});
