import { describe, expect, it } from 'vitest';
import type { SessionView } from '../session/sessionModel';
import { averagePace } from '../session/WorkoutParts';
import { effortLine } from './TodayHero';

/* Tempo radnog dela (deonice) nije tempo celog treninga: ne sme da stoji sam, kao da važi za svih 7,9 km. */
const fartlek: SessionView = {
  title: 'Fartlek',
  core: '4× 30 s @ 4:36/km',
  paceSec: 276,
  paceOwn: false,
  workPace: true,
  km: 7.9,
  minutes: 42,
  rpe: null,
  segments: null,
  rows: [['Radni deo', '4× 30 s @ 4:36/km']],
  guide: null,
  note: '',
  hasAlt: false
};

describe('effortLine', () => {
  it('tempo rada se ne ponavlja kad ga red sa strukturom već nosi; prosek celog treninga je posebno označen', () => {
    expect(effortLine(fartlek, fartlek.core)).toBe('oko 42 min · prosek ≈ 5:19 /km');
  });

  it('bez reda sa strukturom tempo rada piše „rad …“', () => {
    expect(effortLine(fartlek)).toBe('rad 4:36 /km · oko 42 min · prosek ≈ 5:19 /km');
  });

  it('lagano trčanje: jedan tempo važi za ceo trening, bez proseka', () => {
    const easy: SessionView = {
      ...fartlek,
      title: 'Lako',
      core: '',
      workPace: false,
      rows: null,
      paceSec: 332,
      km: 7.6,
      minutes: 42
    };
    expect(effortLine(easy)).toBe('5:32 /km · oko 42 min');
    expect(averagePace(easy)).toBeNull();
  });
});
