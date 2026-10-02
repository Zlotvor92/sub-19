import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import type { IsoDate } from '../date';
import type { LogEntry, PainRecord, WeightRecord, WellnessRecord } from '../state';
import {
  acwrPosition,
  addWeight,
  deleteWeight,
  deleteWeightsBefore,
  detachWeightFromLog,
  painClass,
  partLevel,
  wellnessFor
} from './index';

/* parity: oporavakZa, dodajMasu, obrisiMasu, obrisiMasuPre, partLevel, painClass, acwrPolozaj (app.js). */

const TODAY = '2026-01-07' as IsoDate;
let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;
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
const day = (n: number): string => {
  const d = new Date(Date.UTC(2025, 11, 1 + n));
  return d.toISOString().slice(0, 10);
};

describe('oporavak naspram starog koda', () => {
  it('wellnessFor: osnova HRV-a i pulsa na 300 nasumičnih nizova (praznine, null, malo dana)', () => {
    const r = rng(11);
    for (let i = 0; i < 300; i++) {
      const w: Record<string, WellnessRecord> = {};
      const n = 1 + Math.floor(r() * 25);
      for (let k = 0; k < n; k++) {
        if (r() < 0.2) continue;
        const date = day(Math.floor(r() * 40));
        w[date] = {
          datum: date,
          hrv: r() < 0.25 ? null : Math.round(40 + r() * 40),
          pulsUMiru: r() < 0.25 ? null : Math.round(44 + r() * 14),
          sanH: Math.round((5 + r() * 4) * 10) / 10
        } as WellnessRecord;
      }
      ctx()['__w'] = j(w);
      legacy.evalIn('S.wellness=__w; 0');
      const probe = day(Math.floor(r() * 40));
      expect(wellnessFor(w, probe), `${i} ${probe}`).toEqual(
        legacy.evalIn(
          `(function(){var o=oporavakZa(${JSON.stringify(probe)});return o?JSON.parse(JSON.stringify(o)):null;})()`
        )
      );
    }
  });

  it('addWeight: iste greške i isti rezultat (zarez, granice, budući datum, zamena ručnog unosa)', () => {
    const base: WeightRecord[] = [
      { date: '2026-01-02', kg: 80 },
      { date: '2026-01-05', kg: 79.5, src: 'g1d1' },
      { date: '2026-01-06', kg: 79.8 }
    ];
    const dates = ['2026-01-06', '2026-01-05', '2026-01-07', '2026-01-08', 'abc', '2026-02-31', ''];
    const inputs = [
      '79,4',
      '79.4',
      ' 80 ',
      '19.9',
      '20',
      '300',
      '300.1',
      'x',
      '',
      '80kg',
      '1e2',
      null
    ];
    for (const date of dates)
      for (const input of inputs) {
        ctx()['__kg'] = j(base);
        const old = j<{ ok: boolean; err?: string; kg?: number }>(
          legacy.evalIn(`S.kg=__kg; dodajMasu(${JSON.stringify(date)}, ${JSON.stringify(input)})`)
        );
        const mine = addWeight(base, date, input, TODAY);
        expect(mine.ok, `${date} ${String(input)}`).toBe(old.ok);
        if (!mine.ok) expect(mine.err).toBe(old.err);
        else {
          expect(mine.value).toBe(old.kg);
          expect(mine.kg).toEqual(j(legacy.evalIn('S.kg')));
        }
      }
  });

  it('deleteWeight / deleteWeightsBefore: ista lista i isti unosi u dnevniku', () => {
    const kg: WeightRecord[] = [
      { date: '2025-12-20', kg: 81, src: 'g0d1' },
      { date: '2025-12-28', kg: 80.5 },
      { date: '2026-01-02', kg: 80, src: 'g1d1' },
      { date: '2026-01-06', kg: 79.8 }
    ];
    const log: Record<string, LogEntry> = {
      g0d1: { status: 'done', kg: 81 },
      g1d1: { status: 'done', kg: 80, km: 5 }
    };
    for (let i = 0; i < kg.length; i++) {
      ctx()['__kg'] = j(kg);
      ctx()['__lg'] = j(log);
      legacy.evalIn(`S.kg=__kg; S.log=__lg; obrisiMasu(${i}); 0`);
      const mine = deleteWeight(kg, i);
      expect(mine?.kg).toEqual(j(legacy.evalIn('S.kg')));
      expect(detachWeightFromLog(log, mine?.detach ?? [])).toEqual(j(legacy.evalIn('S.log')));
    }
    expect(deleteWeight(kg, 9)).toBeNull();
    for (const date of ['2025-12-25', '2026-01-03', '2026-02-01', '2025-01-01']) {
      ctx()['__kg'] = j(kg);
      ctx()['__lg'] = j(log);
      const n = legacy.evalIn(`S.kg=__kg; S.log=__lg; obrisiMasuPre(${JSON.stringify(date)})`);
      const mine = deleteWeightsBefore(kg, date);
      expect(kg.length - mine.kg.length).toBe(n);
      expect(mine.kg).toEqual(j(legacy.evalIn('S.kg')));
      expect(detachWeightFromLog(log, mine.detach)).toEqual(j(legacy.evalIn('S.log')));
    }
  });

  it('partLevel / painClass / acwrPosition', () => {
    const r = rng(12);
    const parts = ['koleno-L', 'list-D', 'peta-L'];
    for (let i = 0; i < 100; i++) {
      const knee: PainRecord[] = [];
      for (let k = 0; k < 8; k++)
        knee.push({
          id: `k${k}`,
          date: day(Math.floor(r() * 45)),
          pain: Math.floor(r() * 11),
          part: parts[Math.floor(r() * 3)],
          act: 'Trčanje'
        });
      ctx()['__k'] = j(knee);
      legacy.evalIn('S.knee=__k; 0');
      for (const p of parts)
        expect(partLevel(knee, p, TODAY), `${i} ${p}`).toBe(
          legacy.evalIn(`partLevel(${JSON.stringify(p)})`)
        );
    }
    for (const v of [null, 0, 1, 2, 3, 5, 6, 10]) {
      expect(painClass(v)).toBe(legacy.evalIn(`painClass(${JSON.stringify(v)})`));
    }
    for (const v of [0, 0.5, 1.3, 1.5, 2, 3])
      expect(acwrPosition(v)).toBe(legacy.evalIn(`acwrPolozaj(${v})`));
  });
});
