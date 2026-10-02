import { describe, expect, it } from 'vitest';
import type { AltRecord } from '../../domain/state';
import type { Session } from '../../domain/training/types';
import {
  estimateMinutes,
  paceFromDesc,
  sessionSegments,
  targetPace,
  type Segment
} from './sessionModel';

const base = { kind: 'Intervali', wuKm: 2, cdKm: 1, paceSec: 240, overrides: {} };
const interval: Session = { ...base, type: 'int', reps: 4, repM: 1000, restSec: 90 };
const tempo: Session = { ...base, kind: 'Tempo', type: 'tempo', qKm: 5 };
const fartlek: Session = {
  ...base,
  kind: 'Fartlek',
  type: 'fartlek',
  reps: 3,
  repSec: 60,
  restSec: 60,
  easyPaceSec: 330
};
const prog: Session = { ...base, kind: 'Progresivno', type: 'prog', qKm: 3, easyPaceSec: 320 };
const sum = (s: Segment[] | null): number => (s ?? []).reduce((n, x) => n + x.sec, 0);

describe('paceFromDesc', () => {
  it('čita tempo iz opisa, sa „~" i razmacima; bez tempa je null', () => {
    expect(paceFromDesc('Lagano 8 km @ ~5:09/km')).toBe(309);
    expect(paceFromDesc('Tempo @ 4:17 /km')).toBe(257);
    expect(paceFromDesc('Lagano 8 km')).toBeNull();
    expect(paceFromDesc(null)).toBeNull();
    expect(paceFromDesc('@ 0:00/km')).toBeNull();
  });
});

describe('sessionSegments', () => {
  it('intervali: zagrevanje, ponavljanja sa pauzama između (ne posle zadnjeg), hlađenje', () => {
    const s = sessionSegments({ session: interval, km: 8 }, 310);
    expect(s?.map((x) => x.kind)).toEqual([
      'wu',
      'rep',
      'rec',
      'rep',
      'rec',
      'rep',
      'rec',
      'rep',
      'cd'
    ]);
    expect(s?.[0]).toEqual({ kind: 'wu', sec: 2 * 310, paceSec: 310 });
    expect(s?.[1]).toEqual({ kind: 'rep', sec: 240, paceSec: 240 }); // 1000 m @ 4:00
    expect(s?.[2]).toEqual({ kind: 'rec', sec: 90, paceSec: 310 });
  });

  it('bez poznatog laganog tempa sesija sa km-zagrevanjem nema profil (ništa se ne izmišlja)', () => {
    expect(sessionSegments({ session: interval, km: 8 }, null)).toBeNull();
    expect(sessionSegments({ session: tempo, km: 8 }, null)).toBeNull();
  });

  it('fartlek i progresivno nose sopstveni lagan tempo i rade bez rezerve', () => {
    const f = sessionSegments({ session: fartlek, km: 8 }, null);
    expect(f?.filter((x) => x.kind === 'rep')).toHaveLength(3);
    expect(f?.[0]?.paceSec).toBe(330);
    const p = sessionSegments({ session: prog, km: 10 }, null);
    expect(p?.map((x) => x.kind)).toEqual(['steady', 'rep']);
    expect(p?.[0]?.sec).toBe((10 - 3) * 320);
    expect(sessionSegments({ session: prog, km: null }, null)).toBeNull();
  });

  it('dan bez sesije nema segmente', () => {
    expect(sessionSegments({ session: undefined, km: 8 }, 310)).toBeNull();
  });
});

describe('estimateMinutes', () => {
  it('iz segmenata: zbir sekundi zaokružen na minut', () => {
    const seg = sessionSegments({ session: tempo, km: 8 }, 300);
    expect(
      estimateMinutes(
        { tag: 'tempo', km: 8, desc: '', rest: false, runWalk: false } as never,
        seg,
        300
      )
    ).toBe(Math.round(sum(seg) / 60));
  });

  it('lagano trčanje: km × tempo iz opisa, a bez njega lagan tempo; run/walk, odmor i drugo nemaju procenu', () => {
    const day = { tag: 'lako', km: 8, desc: 'Lagano @ ~5:00/km', rest: false, runWalk: false };
    expect(estimateMinutes(day as never, null, 330)).toBe(40);
    expect(estimateMinutes({ ...day, desc: 'Lagano' } as never, null, 330)).toBe(44);
    expect(estimateMinutes({ ...day, desc: 'Lagano' } as never, null, null)).toBeNull();
    expect(estimateMinutes({ ...day, runWalk: true } as never, null, 330)).toBeNull();
    expect(estimateMinutes({ ...day, rest: true } as never, null, 330)).toBeNull();
    expect(estimateMinutes({ ...day, tag: 'snaga' } as never, null, 330)).toBeNull();
    expect(estimateMinutes({ ...day, km: null } as never, null, 330)).toBeNull();
  });
});

describe('targetPace', () => {
  const alt = (over: Partial<AltRecord>): AltRecord => ({
    tag: 'lako',
    km: 6,
    desc: 'Lagano @ ~5:30/km',
    pace: null,
    paceAuto: false,
    rw: null,
    ...over
  });

  it('sesija nosi svoj tempo; opis je rezerva; odmor nema tempo', () => {
    expect(targetPace({ session: interval, desc: '', tag: 'int', rest: false }, undefined)).toEqual(
      {
        sec: 240,
        own: false
      }
    );
    expect(
      targetPace(
        { session: undefined, desc: 'Lagano @ ~5:09/km', tag: 'lako', rest: false },
        undefined
      )
    ).toEqual({
      sec: 309,
      own: false
    });
    expect(targetPace({ session: interval, desc: '', tag: 'int', rest: true }, undefined)).toEqual({
      sec: null,
      own: false
    });
  });

  it('ručna izmena: sopstveni cilj se označava, automatski prilagođen tempo ne', () => {
    const d = { session: interval, desc: 'Lagano @ ~5:30/km', tag: 'lako' as const, rest: false };
    expect(targetPace(d, alt({ pace: 300 }))).toEqual({ sec: 300, own: true });
    expect(targetPace(d, alt({ pace: 250, paceAuto: true }))).toEqual({ sec: 250, own: false });
    expect(targetPace(d, alt({ pace: null }))).toEqual({ sec: 330, own: false });
  });
});
