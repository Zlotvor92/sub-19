import { describe, expect, it } from 'vitest';
import { sessionCore } from '../day/planView';
import { resolvePlan as appResolve } from '../plan/resolve';
import type { AltRecord, StoredWeek } from '../state';
import * as fiveK from './fiveK';
import * as halfMarathon from './halfMarathon';
import * as marathon from './marathon';
import * as tenK from './tenK';

/* NALAZ 4: ručna izmena dana sa sesijom („intervali → lagano") mora da prikaže VAŽEĆI propis, ne stari trening.
   `session` = važeći propis (nema ga kad izmena nema strukturu), `originSession` = original (istorija i spajanje sa
   predikcijom). Odluku donosi samo `resolvePlan`; ista pravila važe za zajednički i za svaku kopiju u generatoru. */

const intervals = {
  type: 'int' as const,
  kind: 'Intervali',
  wuKm: 2,
  cdKm: 1.5,
  paceSec: 240,
  reps: 5,
  repM: 1000,
  restSec: 120,
  zone: 'I' as const,
  overrides: {}
};

const weeks = [
  {
    w: 1,
    start: '2026-10-12',
    deload: false,
    focus: '',
    days: [
      {
        id: 'g1d2',
        dow: 1,
        tag: 'int',
        km: 9.5,
        desc: '2 km zagrevanje + 5×1000 m @ 4:00/km + 1,5 km hlađenje',
        session: intervals
      }
    ]
  }
] as unknown as StoredWeek[];

const alt = (a: Partial<AltRecord>): Record<string, AltRecord> => ({
  g1d2: {
    tag: 'int',
    km: 9.5,
    desc: '2 km zagrevanje + 5×1000 m @ 4:00/km + 1,5 km hlađenje',
    pace: null,
    rw: null,
    paceAuto: false,
    ...a
  }
});

const resolvers = {
  app: appResolve,
  '5k': fiveK.resolvePlan,
  '10k': tenK.resolvePlan,
  hm: halfMarathon.resolvePlan,
  marathon: marathon.resolvePlan
} as const;

describe.each(Object.entries(resolvers))('važeći i originalni propis (%s)', (_name, resolve) => {
  const day = (alts: Record<string, AltRecord>) =>
    resolve(weeks, { alts, moves: {} }).byId.get('g1d2')!;

  it('bez izmene: važeći = original', () => {
    const d = day({});
    expect(d.session).toEqual(intervals);
    expect(d.originSession).toEqual(intervals);
  });

  it('intervali → lagano: važeći nema strukturu, original ostaje, prikaz je nov trening', () => {
    const d = day(alt({ tag: 'lako', km: 8, desc: '8 km lagano' }));
    expect(d.session).toBeUndefined();
    expect(d.originSession).toEqual(intervals);
    expect(sessionCore(d)).toBe('8 km lagano');
  });

  it('isti tip, ručno prepisan opis: struktura više nije važeća', () => {
    const d = day(
      alt({ desc: '2 km zagrevanje + 3×2000 m @ 4:10/km + 1,5 km hlađenje', km: 10.5 })
    );
    expect(d.session).toBeUndefined();
    expect(d.originSession).toEqual(intervals);
    expect(sessionCore(d)).toBe('3×2000 m @ 4:10/km');
  });

  it('izmena samo tempa/snage/ritma zadržava strukturu', () => {
    const d = day(alt({ pace: 235, paceAuto: true, snaga: true }));
    expect(d.session).toEqual(intervals);
    expect(d.originSession).toEqual(intervals);
  });

  it('dan pretvoren u odmor nema važeći propis', () => {
    const d = day(alt({ tag: 'odmor', km: null, desc: 'Odmor' }));
    expect(d.session).toBeUndefined();
    expect(d.originSession).toEqual(intervals);
  });
});

describe('izvoz na sat čita važeći propis', () => {
  it('intervali → tempo (ručni opis): sat ne dobija stare intervale', () => {
    const plan = appResolve(weeks, {
      alts: alt({ tag: 'tempo', km: 8, desc: '2 km zagrevanje + 5 km @ 4:20/km + 1 km hlađenje' }),
      moves: {}
    });
    const before = halfMarathon.workoutsForWatch(
      appResolve(weeks, { alts: {}, moves: {} }),
      '2026-10-12',
      14,
      45
    );
    const after = halfMarathon.workoutsForWatch(plan, '2026-10-12', 14, 45);
    expect(JSON.stringify(before.events)).toContain('Intervali');
    expect(JSON.stringify(after.events)).not.toContain('Intervali');
    expect(JSON.stringify(after.events)).not.toContain('1000');
  });
});
