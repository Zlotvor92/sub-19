import { describe, expect, it } from 'vitest';
import { assessGoal, pacesFromVdot, raceTimeForVdot, vdotFromResult } from './paces.ts';
import { choosePattern } from './schedule.ts';
import { buildWorkout, chooseReps, qualityBudgets } from './workouts.ts';
import { planVolume } from './volume.ts';
import { periodize } from './periodize.ts';
import { START } from './testInputs.ts';

const p = pacesFromVdot(50);

describe('tempo (Daniels–Gilbert)', () => {
  it('VDOT iz rezultata i prognoza su međusobno inverzni', () => {
    expect(vdotFromResult(5000, 1197)).toBeCloseTo(49.95, 2);
    expect(vdotFromResult(10000, 3000)).toBeCloseTo(40.01, 2);
    expect(raceTimeForVdot(50, 5000)).toBe(1196);
    for (const v of [30, 40, 50, 60])
      expect(vdotFromResult(5000, raceTimeForVdot(v, 5000))).toBeCloseTo(v, 1);
  });
  it('VDOT 50: E 5:07–5:38, T 4:15, I 3:55, R 3:40, RP 3:59 /km', () => {
    expect(p).toEqual({ vdot: 50, E: { fast: 307, slow: 338 }, T: 255, I: 235, R: 220, RP: 239 });
  });
  it('procena cilja', () => {
    expect(assessGoal(50, 1196).status).toBe('feasible');
    expect(assessGoal(50, 1170).status).toBe('ambitious');
    expect(assessGoal(50, 1100).status).toBe('unrealistic');
  });
});

describe('workouts.ts: km i trajanje iz komponenti', () => {
  it('ponavljanja zadata distancom: km tačni, trajanje procenjeno', () => {
    const w = buildWorkout(
      'quality',
      'I',
      'x',
      [
        { kind: 'warmup', km: 2 },
        { kind: 'reps', zone: 'I', reps: 3, rep: { km: 1 }, recovery: { km: 0.4 } },
        { kind: 'cooldown', km: 1.5 }
      ],
      p
    );
    expect(w.segments.map((s) => s.kind)).toEqual([
      'warmup',
      'rep',
      'recovery',
      'rep',
      'recovery',
      'rep',
      'cooldown'
    ]);
    expect(w.km).toBe(2 + 3 + 0.8 + 1.5);
    const e = Math.round((307 + 338) / 2);
    expect(w.sec).toBe(
      Math.round(2 * e) + 3 * 235 + 2 * Math.round(0.4 * 338) + Math.round(1.5 * e)
    );
    expect(w.workKm.I).toBe(3);
    expect(w.maxBoutSec.I).toBe(235);
    expect(w.kmBasis).toBe('exact');
    expect(w.secBasis).toBe('estimated');
  });

  it('oporavak zadat vremenom: trajanje tačno, km procenjeni', () => {
    const w = buildWorkout(
      'quality',
      'T_cruise',
      'x',
      [{ kind: 'reps', zone: 'T', reps: 2, rep: { sec: 600 }, recovery: { sec: 60 } }],
      p
    );
    expect(w.sec).toBe(1260);
    expect(w.kmBasis).toBe('estimated');
    expect(w.secBasis).toBe('exact');
    expect(w.km).toBeCloseTo((600 / 255) * 2 + 60 / 338, 1);
  });

  it('progresivni segmenti: isti zona u nizu = jedan blok', () => {
    const w = buildWorkout(
      'quality',
      'T_short',
      'x',
      [
        {
          kind: 'progression',
          steps: [
            { zone: 'E', km: 2 },
            { zone: 'T', km: 2 },
            { zone: 'T', km: 1 }
          ]
        }
      ],
      p
    );
    expect(w.km).toBe(5);
    expect(w.workKm.T).toBe(3);
    expect(w.maxBoutSec.T).toBe(3 * 255);
  });

  it('izbor ponavljanja: prva opcija koja popuni ≥ 70% budžeta, bez petlje smanjivanja', () => {
    expect(chooseReps(1.9, [1.2, 1.0, 0.8, 0.6], 235, 2, 6, 300)).toEqual({ reps: 2, repKm: 0.8 });
    expect(chooseReps(3.6, [1.2, 1.0, 0.8], 235, 2, 6, 300)).toEqual({ reps: 3, repKm: 1.2 });
    expect(chooseReps(1.0, [1.2, 1.0, 0.8], 235, 2, 6, 300)).toBeNull();
    // Ponavljanje duže od 5 min se ne bira.
    expect(chooseReps(5, [1.6], 235, 2, 6, 300)).toBeNull();
  });

  it('budžet se zaokružuje naniže', () => {
    expect(qualityBudgets(19.9)).toEqual({ I: 1.59, T: 1.99, R: 0.99 });
  });
});

describe('raspored i obim', () => {
  it('šablon: dugi vikendom, zahtevni dani ciklično razmaknuti', () => {
    expect(choosePattern(['tue', 'thu', 'sat', 'sun'])).toEqual({
      ok: true,
      pattern: { long: 'sun', q1: 'tue', q2: 'thu', easy: 'sat' }
    });
    expect(choosePattern(['mon', 'tue', 'wed', 'thu']).ok).toBe(false);
    // pon/sre/pet/ned: ned–pon su susedni ciklično → zahtevni su pon, sre, pet ili sre, pet, ned.
    const r = choosePattern(['mon', 'wed', 'fri', 'sun']);
    expect(r.ok && r.pattern.long).toBe('sun');
    expect(r.ok && r.pattern.easy).toBe('mon');
  });

  it('volume.ts: start, +8%, vrh ≤ 1,3×, rasterećenje, taper, trkačka nedelja', () => {
    const frames = periodize(START, 14);
    const v = planVolume(frames, 35);
    expect(v.targets[0]).toBe(35);
    expect(v.peakKm).toBeLessThanOrEqual(35 * 1.3);
    expect(v.targets.slice(-3)).toEqual([
      Math.round(v.peakKm * 8.5) / 10,
      Math.round(v.peakKm * 7) / 10,
      Math.round(v.peakKm * 5) / 10
    ]);
    frames.forEach((f, i) => {
      if (f.deload) expect(v.targets[i]).toBe(Math.round(v.targets[i - 1]! * 8) / 10);
    });
  });
});
