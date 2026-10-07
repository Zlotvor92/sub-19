import { describe, expect, it } from 'vitest';
import { dayWorkoutText, icuDuration } from './icuWorkouts';
import type { IntervalSession } from '../training/types';

const day = {
  rest: false,
  tag: 'lako' as const,
  desc: 'Lagano',
  km: 2.8,
  mlr: false,
  session: undefined
};
describe('faithful structured watch export', () => {
  it('preserves non-minute durations exactly', () => {
    for (const s of [90, 105, 150, 169, 235]) expect(icuDuration(s)).toBe(`${s}s`);
  });
  it('exports explicit alternating run/walk steps instead of continuous running', () => {
    const text = dayWorkoutText(
      { ...day, runWalk: { runSec: 60, walkSec: 60, label: '1/1' } },
      450
    );
    expect(text).toContain('Trčanje 1m');
    expect(text).toContain('Hod 1m');
    expect(text).not.toContain('- 2.8km');
  });
  it('keeps both portions of a fast-finish long run', () => {
    const text = dayWorkoutText(
      { ...day, tag: 'lr', km: 22, finish: { km: 7.7, paceSec: 311, zone: 'M' } },
      363
    );
    expect(text).toContain('Lagani deo 14.3km');
    expect(text).toContain('Brzi završetak 7.7km 5:11/km Pace');
  });
  it('keeps an ordinary easy run easy and exports a pace range', () => {
    expect(dayWorkoutText({ ...day, desc: '2.8 km lako @ ~7:30/km' }, 450)).toBe(
      'Lagano\n- 2.8km 8:10-7:30/km Pace'
    );
  });
  it('exports recovery only between repetitions, with an individual easy range', () => {
    const session: IntervalSession = {
      type: 'int',
      kind: 'Tempo isprekidan',
      wuKm: 1,
      cdKm: 1,
      reps: 3,
      repM: 1000,
      restSec: 90,
      paceSec: 380,
      overrides: {}
    };
    const text = dayWorkoutText({ ...day, tag: 'tempo', session }, 480);
    expect(text).toContain('Tempo isprekidan 2x');
    expect(text).toContain('Oporavak kaskanje 90s 8:40-8:00/km Pace');
    expect(text).toContain('Poslednja deonica\n- 1km 6:20/km Pace\n\nHlađenje');
  });
  it('exports strides with their recoveries', () => {
    const text = dayWorkoutText(
      { ...day, km: 6, strides: { reps: 4, runSec: 20, restSec: 60, paceSec: 220 } },
      330
    )!;
    expect(text.match(/Ubrzanje 20s/g)).toHaveLength(4);
    expect(text.match(/Oporavak kaskanje/g)).toHaveLength(3);
  });
});
