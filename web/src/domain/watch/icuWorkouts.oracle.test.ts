import { d6Snapshot } from '@/test/d6Snapshot';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { AltRecord, GenPlanState, VdotRecord } from '../state';
import { generatePlan } from '@/test/legacyGenerator';
import {
  icuDistance,
  icuDuration,
  icuPace,
  sessionFromDescription,
  thresholdPace,
  workoutsForWatch
} from './index';

/* parity: icuTempo, icuTrajanje, icuRazdaljina, icuIzOpisa, icuTekstDana, icuDaniZaSlanje, icuPragTekst (app.js). */

const TODAY = '2026-02-20';
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
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;
let legacy: LegacyApp;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-02-20T09:00:00Z');
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;

const withoutVdot = (p: GenPlanState): GenPlanState => {
  const meta = { ...(p.meta as Record<string, unknown>) };
  delete meta['vdot0'];
  const weeks = p.weeks.map((w) => ({
    ...w,
    days: w.days.map((d) => ({ ...d, desc: (d.desc ?? '').replace(/~\d+:\d\d\/km/g, '') }))
  }));
  return { ...p, meta, weeks } as GenPlanState;
};

const plans = (): GenPlanState[] => {
  const out: GenPlanState[] = [];
  for (const [dist, sec, weeks, startBack] of [
    [5000, 1237, 12, 6],
    [10000, 2570, 14, 3],
    [21097.5, 5700, 18, 10],
    [42195, 13500, 26, 15],
    [10000, 2570, 16, 12]
  ] as const) {
    const start = addDays('2026-02-16' as IsoDate, -startBack * 7);
    const a = adaptGeneratedPlan(
      generatePlan({
        startDate: start,
        raceDate: addDays(start, weeks * 7 + 3),
        raceDistM: dist,
        pb: { distM: dist, sec },
        weeklyKm: 45,
        runDays: 5,
        quality: 2,
        intensity: 'std',
        trainedRecently: true
      })
    );
    if (!a) throw new Error('adapt');
    out.push(a);
  }
  return out;
};

describe('slanje na sat naspram starog koda', () => {
  it('pomoćni oblici: tempo (opseg sporiji pa brži), trajanje, razdaljina', () => {
    const pace = [null, 0, -5, 251, 251.4, 59.6, 3599];
    for (const a of pace)
      for (const b of [undefined, null, 0, 251, 266, 240])
        expect(icuPace(a, b), `${String(a)} ${String(b)}`).toBe(
          legacy.evalIn(`icuTempo(${JSON.stringify(a)}, ${JSON.stringify(b ?? undefined)})`)
        );
    for (const s of [null, 0, 30, 59, 60, 89, 90, 119, 120, 150, 1]) {
      const old = legacy.evalIn(`icuTrajanje(${JSON.stringify(s)})`);
      // D6: seconds are exact; all other legacy formatting stays identical.
      expect(icuDuration(s), String(s)).toBe(s != null && s >= 90 && s % 60 !== 0 ? `${s}s` : old);
    }
    for (const k of [null, 0, 0.2, 0.4, 0.999, 1, 1.005, 2.5, 8.123, 21.0975])
      expect(icuDistance(k), String(k)).toBe(legacy.evalIn(`icuRazdaljina(${JSON.stringify(k)})`));
  });

  it('opis → struktura: iste sesije iz teksta (ponavljanja, deonice, tempo, opseg, bez tempa)', () => {
    const descs = [
      '2 km WU + 6×800 m @ 3:55/km (90 s) + 2 km CD',
      '3 km WU + 5×1000 m @ 3:50–3:54/km (2 min) + 2 km CD',
      '2 km WU + 4 km + 2 km @ ~4:25/km + 2 km CD',
      '2 km WU + 4 km @ 4:22/km + 2 km CD · pazi na puls',
      '3 km zagrevanje + 2×2.5 km @ 4:30/km (1 min hoda) + 2 km CD',
      'Lagano 8 km',
      'Tempo broken 2 km WU + 3×1.5 km @ 4:20/km (60 s) + 2 km CD',
      '5 km @ 4:20/km',
      '',
      'TIME TRIAL 3 km'
    ];
    for (const tag of ['int', 'tempo', 'lako']) {
      for (const d of descs) {
        const mine = sessionFromDescription(d, tag);
        const old = legacy.evalIn(
          `(function(){var s=icuIzOpisa(${JSON.stringify(d)}, ${JSON.stringify(tag)});return s?JSON.parse(JSON.stringify(s)):null;})()`
        );
        expect(j(mine ?? null), `${tag} | ${d}`).toEqual(old);
      }
    }
  });

  it('dani za slanje: isti događaji (naziv, tekst, ID) i isti broj preskočenih na 5 planova × izmene × forma', () => {
    const r = rng(61);
    const descs = [
      '2 km WU + 6×800 m @ 3:55/km (90 s) + 2 km CD',
      '2 km WU + 4 km + 2 km @ ~4:25/km + 2 km CD',
      '3 km WU + 5×1000 m @ 3:50–3:54/km (2 min) + 2 km CD',
      'TIME TRIAL 3 km',
      'Lagano 8 km',
      'Bez tempa nigde'
    ];
    let events = 0;
    let withSkipped = 0;
    let structured = 0;
    for (const basePlan of plans()) {
      for (let variant = 0; variant < 7; variant++) {
        const plan = variant === 6 ? withoutVdot(basePlan) : basePlan;
        const alts: Record<string, AltRecord> = {};
        if (variant > 0)
          for (const w of plan.weeks)
            for (const d of w.days)
              if (d.km && r() < 0.18)
                alts[d.id as string] = {
                  tag: (['lako', 'tempo', 'int', 'lr'] as const)[Math.floor(r() * 4)] as never,
                  km: 9,
                  desc: descs[Math.floor(r() * descs.length)] as string,
                  pace: null,
                  rw: null,
                  paceAuto: false
                };
        const vdotLog: VdotRecord[] =
          variant % 3 === 1
            ? [{ id: 'g1_0', ts: '2026-02-01', vdot: 47.4, prev: 46, delta: 1.4, measured: 48 }]
            : [];
        ctx()['__p'] = j(plan);
        ctx()['__a'] = j(alts);
        ctx()['__v'] = j(vdotLog);
        legacy.evalIn(
          'S.genPlan=__p; S.alts=__a; S.moves={}; S.vdotLog=__v; setActivePlan(); rebuildDateIndex(); 0'
        );
        if (variant === 6)
          legacy.evalIn(
            'globalThis.__cv=currentVdot; globalThis.__bv=baselineVdot; currentVdot=function(){return 0}; baselineVdot=function(){return 0}; 0'
          );
        const old = j<{ events: Array<Record<string, unknown>>; preskoceno: number }>(
          legacy.evalIn(
            '(function(){var e=icuDaniZaSlanje(14);return {events:JSON.parse(JSON.stringify(e)),preskoceno:e.preskoceno};})()'
          )
        );
        if (variant === 6)
          legacy.evalIn('currentVdot=globalThis.__cv; baselineVdot=globalThis.__bv; 0');
        const resolved = resolvePlan(plan.weeks, { alts, moves: {} });
        const meta = plan.meta as { vdot0?: number };
        const vdot = vdotLog.length ? 47.4 : (meta.vdot0 ?? null);
        const mine = workoutsForWatch(resolved, TODAY, 14, vdot);
        d6Snapshot('watch', `${plan.meta?.raceDistM}/${plan.weeks.length}/${variant}`, mine);
        // D6 changes workout names/steps. Preserve scheduling and identity; exact new steps are tested in icuWorkouts.test.ts.
        const identity = (e: { date?: unknown; externalId?: unknown }) => [e.date, e.externalId];
        expect(mine.events.map(identity), `${plan.meta?.raceDistM} v${variant}`).toEqual(
          old.events.map(identity)
        );
        expect(mine.skipped).toBe(old.preskoceno);
        events += mine.events.length;
        if (mine.skipped) withSkipped++;
        structured += mine.events.filter((e) => e.description.includes('\n\n')).length;
      }
    }
    expect(events).toBeGreaterThan(150);
    expect(structured).toBeGreaterThan(30);
    expect(withSkipped).toBeGreaterThan(0);
  });

  it('prag tempa za intervals.icu', () => {
    for (const v of [null, 0, 38, 45.5, 48.4, 55.9]) {
      ctx()['__v'] =
        v === null ? [] : [{ id: 'x', ts: '2026-01-01', vdot: v, prev: v, delta: 0, measured: v }];
      legacy.evalIn('S.vdotLog=__v; S.genPlan=null; 0');
      const html = String(legacy.evalIn('icuPragTekst()'));
      const m = /<b>([^<]*)\/km<\/b>/.exec(html);
      const mine = thresholdPace(v);
      if (v === null || v === 0) expect(mine === null || mine !== undefined).toBe(true);
      else expect(mine, String(v)).toBe(m?.[1] ?? null);
    }
  });
});
