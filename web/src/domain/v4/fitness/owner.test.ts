/* Uzorak vlasnika (8 trčanja, 27. 9 – 6. 11. 2026): procena kroz trčanja i ispis istorije promena (F4-REPORT). */
import { describe, expect, it } from 'vitest';
import type { FormEstimate } from '../engine/types';
import { estimateForm } from './estimate';
import { clock } from './explain';
import type { FitnessFacts, FitnessRun } from './types';
import sample from './fixtures/owner-2026-autumn.json';

interface SampleRun {
  date: string;
  dayId: string;
  km: number;
  sec: number;
  hr: number;
  temp: number;
  race: boolean;
  splits: number[][];
}

const HALF = 21097.5;

/** Trka je zvanični polumaraton (21,0975 km); ostalo dužina sa sata. */
function ownerRuns(): FitnessRun[] {
  return (sample.runs as SampleRun[]).map((r) => ({
    id: `${r.date}-${r.dayId}`,
    date: r.date,
    dayId: r.dayId,
    distanceM: r.race ? HALF : Math.round(r.km * 1000),
    durationSec: r.sec,
    avgHr: r.hr,
    tempC: r.temp,
    splits: r.splits.map(([paceSec, hr]) => ({
      paceSec: paceSec ?? 0,
      ...(hr !== undefined ? { hr } : {})
    })),
    ...(r.race ? { effort: 'race' as const } : {})
  }));
}

function ownerFacts(today: string): FitnessFacts {
  return {
    today,
    availability: { runDays: [1, 3, 5, 6], longDay: 6 },
    profile: {},
    runs: ownerRuns().filter((r) => r.date <= today),
    pauses: [],
    pain: []
  };
}

const line = (e: FormEstimate): string =>
  `${e.current.asOf}: ${e.current.vdot} (${clock(e.current.raceTimeSec)}, ${e.current.confidence}); ` +
  `dan trke ${clock(e.raceDay.lowSec)} – ${clock(e.raceDay.expectedSec)} – ${clock(e.raceDay.highSec)}, G ${e.ceilingGain}`;

describe('uzorak vlasnika', () => {
  it('procena kroz 8 trčanja + istorija promena', () => {
    const dec = { distanceM: HALF, raceDate: '2026-12-13' };
    const apr = { distanceM: HALF, raceDate: '2027-04-17' };
    const afterRace = estimateForm(ownerFacts('2026-10-03'), dec, null);
    const today = estimateForm(ownerFacts('2026-11-12'), dec, null);
    const spring = estimateForm(ownerFacts('2026-11-12'), apr, null);
    const springPlan = estimateForm(ownerFacts('2026-11-12'), apr, {
      baseLoad: 250,
      peakLoad: 325
    });

    const out = [
      `posle trke  ${line(afterRace)}`,
      `danas → 13. 12.  ${line(today)}`,
      `danas → 17. 4.   ${line(spring)}`,
      `danas → 17. 4. (obim +30 %)  ${line(springPlan)}`,
      ...today.history.map((h) => `  ${h.date} ${h.signal} ${h.before} → ${h.after}: ${h.reason}`)
    ];
    console.log(out.join('\n'));

    const race = today.history.find((h) => h.signal === 'trka');
    expect(race).toBeDefined();
    /* Trka 1:42:01 (VDOT ≈ 44,1) + polovina razlike do druge polovine → ≈ 44,76 (oko 1:40:42). */
    expect(afterRace.current.vdot).toBeGreaterThan(44.3);
    expect(afterRace.current.vdot).toBeLessThan(45.1);
    /* R14: prvi rezultat u aplikaciji — pouzdanost najviše srednja; rečenica objašnjava korekciju. */
    expect(afterRace.current.confidence).toBe('srednja');
    expect(race?.reason).toContain('1:42:01');
    expect(race?.reason).toContain('računa kao');
    /* R13: 5 kratkih trčanja od 3. 10 — baza je pala ispod 70 % → forma blago niža, sa rečenicom. */
    const drop = today.history.find((h) => h.reason.includes('šest nedelja'));
    expect(drop).toBeDefined();
    expect(today.current.vdot).toBeLessThan(afterRace.current.vdot);
    expect(today.current.vdot).toBeGreaterThanOrEqual(afterRace.current.vdot * (1 - 0.03) - 0.01);
    expect(spring.raceDay.expectedSec).toBeLessThan(today.current.raceTimeSec);
    expect(springPlan.ceilingGain).toBeGreaterThan(spring.ceilingGain);
  });
});
