import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { effectiveRaceDate } from '../day';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { GenPlanState, LogEntry, VdotRecord, WellnessRecord } from '../state';
import type { StoredPredRow } from '../training/adaptation';
import { generatePlan } from '../training/generator/generatePlan';
import { raceRefs } from '../race';
import { zoneSource } from '../zones';
import { buildTrendSummary, planAhead, progressRate } from './trend';

/* parity: trendSummary, planUnapred, tempoKaCilju (app.js). Oblik je ugovor sa api/analyze.js (`{trend, goalCtx}`). */

const NOW = '2026-07-14T14:30:00Z';
const TODAY = '2026-07-14' as IsoDate;
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
  legacy = await loadLegacyApp(NOW);
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;

describe('trend naspram starog koda', () => {
  it('sažetak: tempo iz zaključanog unosa/krugova/proseka, drift po krugu i po km, nedeljni obim, VDOT, oporavak, naredne nedelje, tempo napretka', () => {
    const r = rng(19);
    let summaries = 0;
    let withLocked = 0;
    let withLapDrift = 0;
    let withKmDrift = 0;
    let withProg = 0;
    let withGap = 0;
    let withRate = 0;
    let withRest = 0;
    for (const [dist, sec, weeks, back, runDays] of [
      [10000, 2570, 14, 8, 5],
      [5000, 1237, 12, 6, 6],
      [21097.5, 5700, 18, 12, 5],
      [5000, 1237, 8, 9, 5] // trka je već prošla: poslednja nedelja se računa sa donjom granicom od 0,1
    ] as const) {
      const start = addDays('2026-07-13' as IsoDate, -back * 7);
      const gen = adaptGeneratedPlan(
        generatePlan({
          startDate: start,
          raceDate: addDays(start, weeks * 7 + 3),
          raceDistM: dist,
          pb: { distM: dist, sec },
          weeklyKm: 45,
          runDays,
          quality: 2,
          intensity: 'std',
          trainedRecently: true
        })
      );
      if (!gen) throw new Error('adapt');
      const plan: GenPlanState = gen;
      const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
      const predRows = (plan.pred ?? []).filter(
        (x): x is StoredPredRow => typeof x.id === 'string'
      );
      for (let variant = 0; variant < 6; variant++) {
        const log: Record<string, LogEntry> = {};
        const pred: Record<string, unknown> = {};
        const predLock: Record<string, unknown> = {};
        for (const d of resolved.dated) {
          if (d.rest || d.date >= TODAY || r() < 0.15) continue;
          const e: LogEntry = {
            status: r() < 0.9 ? 'done' : 'skip',
            km: d.km,
            sec: Math.round((d.km ?? 8) * 300),
            ts: d.date
          };
          if (r() < 0.8) e['hr'] = 150;
          const form = r();
          if (form < 0.35)
            e['laps'] = Array.from({ length: 4 + Math.floor(r() * 4) }, (_, i) => ({
              n: i + 1,
              distM: i === 0 ? 1600 : 400 + (i % 2) * 600,
              paceSec: 235 + Math.floor(r() * 12),
              avgHr: r() < 0.9 ? 150 + i * 3 : null,
              cadence: r() < 0.7 ? 86 : null,
              ...(r() < 0.5 ? { gapSec: 230 } : {}),
              ...(r() < 0.5 ? { restSec: 60 + i * 5 } : {})
            }));
          else if (form < 0.6)
            e['perKm'] = Array.from({ length: 4 + Math.floor(r() * 8) }, (_, i) => ({
              km: i + 1,
              paceSec: r() < 0.8 ? 330 + (r() < 0.2 ? i * 12 : 0) : 0,
              hr: r() < 0.9 ? 140 + i : 0,
              cadence: r() < 0.6 ? 170 : null
            }));
          if (r() < 0.4) e['decoupling'] = { n: r() < 0.9 ? 3.4 : null };
          if (r() < 0.3) e['icu'] = { efikasnost: 1.3, opterecenje: 60, osecaSe: 5 };
          if (r() < 0.3) e['relEffort'] = 40;
          if (r() < 0.3) e['rpe'] = 6;
          if (r() < 0.2) e['runDate'] = addDays(d.date, 1);
          log[d.id] = e;
        }
        for (const row of predRows)
          if (r() < 0.6) {
            pred[row.id] = 228 + Math.floor(r() * 20);
            if (r() < 0.4) predLock[row.id] = true;
          }
        const vdotLog: VdotRecord[] = [];
        const n = [0, 2, 2, 3, 5, 6][variant] as number;
        const gapDays = variant === 1 ? 13 : variant === 2 ? 14 : 0; // granica „bar 14 dana"
        for (let k = 0; k < n; k++)
          vdotLog.push({
            id: `g1_${k}`,
            ts: addDays(
              TODAY,
              -(gapDays && k === 1 ? 60 - gapDays : 60 - k * (variant === 3 ? 3 : 14))
            ),
            vdot: 46 + k * 0.4,
            prev: 46,
            delta: 0.4,
            measured: 46
          });
        const wellness: Record<string, WellnessRecord> = {};
        for (let o = 1; o <= 150; o++)
          if (r() < 0.95) {
            const rec: Record<string, unknown> = { datum: addDays(TODAY, -o) };
            const x = r();
            if (x < 0.8) rec['hrv'] = 50 + Math.floor(r() * 10);
            if (x < 0.5) rec['pulsUMiru'] = 50;
            if (x < 0.3) rec['sanH'] = 7;
            wellness[addDays(TODAY, -o)] = rec as unknown as WellnessRecord;
          }
        const icuHr =
          r() < 0.5
            ? [
                { min: 1, max: 130 },
                { min: 131, max: null }
              ]
            : null;
        ctx()['__p'] = j(plan);
        ctx()['__l'] = j(log);
        ctx()['__pr'] = j(pred);
        ctx()['__pl'] = j(predLock);
        ctx()['__vl'] = j(vdotLog);
        ctx()['__w'] = j(wellness);
        ctx()['__ic'] = icuHr ? { hrZones: icuHr } : null;
        legacy.evalIn(
          'S.genPlan=__p; S.alts={}; S.moves={}; S.log=__l; S.pred=__pr; S.predLock=__pl; S.vdotLog=__vl; S.wellness=__w; S.icu=__ic; S.strava=null; setActivePlan(); rebuildDateIndex(); 0'
        );
        const old = j<Record<string, unknown>>(legacy.evalIn('trendSummary()'));
        const meta = plan.meta as Record<string, unknown>;
        const mine = j<Record<string, unknown>>(
          buildTrendSummary({
            plan: resolved,
            log,
            pred,
            predLock,
            predRows,
            qs: plan.qs,
            vdotLog,
            wellness,
            currentZones: zoneSource(icuHr ? { hrZones: icuHr } : null, null),
            today: TODAY,
            raceDate: effectiveRaceDate(resolved, meta['raceDate']),
            baselineVdot: raceRefs(meta).baselineVdot,
            goalVdot: raceRefs(meta).goalVdot
          })
        );
        expect(mine, `${dist} v${variant}`).toEqual(old);
        summaries++;
        const t = mine['treninzi'] as Array<Record<string, unknown>>;
        if (Object.keys(predLock).length && t.length) withLocked++;
        if (t.some((x) => x['repova'] != null && x['drift'] != null)) withLapDrift++;
        if (t.some((x) => x['progresivno'])) withProg++;
        if (t.some((x) => x['drift'] != null && x['repova'] == null)) withKmDrift++;
        if (t.some((x) => x['gap'] != null)) withGap++;
        if (mine['tempoNapretka']) withRate++;
        if ((mine['naredno'] as Array<{ deload: boolean }>).some((x) => x.deload)) withRest++;
      }
    }
    expect(summaries).toBe(24);
    expect(withLocked).toBeGreaterThan(8);
    expect(withLapDrift).toBeGreaterThan(8);
    expect(withKmDrift).toBeGreaterThan(5);
    expect(withProg).toBeGreaterThan(2);
    expect(withGap).toBeGreaterThan(5);
    expect(withRate).toBeGreaterThan(4);
    expect(withRest).toBeGreaterThan(2);
  });

  it('tempo napretka: prekratak razmak, bez cilja i bez trke daje null', () => {
    const vl = [
      { ts: '2026-06-01', vdot: 46 },
      { ts: '2026-06-10', vdot: 46.5 }
    ];
    expect(progressRate(vl, 51, TODAY, '2026-09-01' as IsoDate)).toBeNull(); // 9 dana
    expect(
      progressRate(
        [
          { ts: '2026-05-01', vdot: 46 },
          { ts: '2026-06-10', vdot: 47 }
        ],
        null,
        TODAY,
        '2026-09-01' as IsoDate
      )
    ).toBeNull();
    expect(
      progressRate(
        [
          { ts: '2026-05-01', vdot: 46 },
          { ts: '2026-06-10', vdot: 47 }
        ],
        51,
        TODAY,
        null
      )
    ).toBeNull();
    const ok = progressRate(
      [
        { ts: '2026-05-01', vdot: 46 },
        { ts: '2026-06-10', vdot: 47 }
      ],
      51,
      TODAY,
      '2026-09-01' as IsoDate
    );
    expect(ok).toMatchObject({ odVdot: 46, doVdot: 47, cilj: 51 });
    expect(planAhead({ weeks: [] } as never, TODAY)).toEqual([]);
  });
});
