import { describe, expect, it } from 'vitest';
import { migrateState, seedState, type OffPlanRun } from '../state';
import { recordOffPlanRuns, stravaActivityIssue, syncStatus } from './offPlan';

/* 08c: trčanja van plana (samo plan 5K v2) — pravila zapisa i čišćenje perzistiranog polja. */

const base = { src: 'strava' as const, planStart: '2026-11-02', today: '2026-11-15' };
const run = (id: number, date: string, km: number, sec: number | null = Math.round(km * 360)) => ({
  id,
  distance: km * 1000,
  moving_time: sec,
  start_date_local: `${date}T07:00:00Z`
});

describe('recordOffPlanRuns', () => {
  it('uparena trčanja, pre plana i posle danas se ne beleže; duplikat (< 1 %) se ne broji; ključ izvor:ID', () => {
    const next = recordOffPlanRuns({
      ...base,
      current: {},
      byDate: {
        '2026-10-30': [run(1, '2026-10-30', 6)],
        '2026-11-09': [run(2, '2026-11-09', 7), run(3, '2026-11-09', 7)],
        '2026-11-10': [run(4, '2026-11-10', 5)],
        '2026-11-16': [run(5, '2026-11-16', 5)],
        '2026-11-11': [run(6, '2026-11-11', 0, 1800), run(7, '2026-11-11', 0, null)]
      },
      paired: new Set(['4']),
      window: { from: '2026-10-05', to: '2026-11-15' }
    });
    expect(next).toEqual({
      'strava:2': { date: '2026-11-09', km: 7, sec: 2520, src: 'strava', id: '2' },
      'strava:6': { date: '2026-11-11', km: 0, sec: 1800, src: 'strava', id: '6' }
    });
  });

  it('ceo spisak zamenjuje zapise svog perioda (oba izvora); nepotpun spisak samo dopunjuje; bez promene → null', () => {
    const current: Record<string, OffPlanRun> = {
      'icu:i9': { date: '2026-11-09', km: 7, sec: 2520, src: 'icu', id: 'i9' },
      'strava:8': { date: '2026-11-12', km: 4, sec: 1440, src: 'strava', id: '8' },
      'strava:old': { date: '2026-09-01', km: 4, sec: 1440, src: 'strava', id: 'old' }
    };
    const byDate = { '2026-11-09': [run(2, '2026-11-09', 7)] };
    const whole = recordOffPlanRuns({
      ...base,
      current,
      byDate,
      paired: new Set(),
      window: { from: '2026-11-01', to: '2026-11-15' }
    });
    expect(Object.keys(whole ?? {})).toEqual(['strava:2']);
    const partial = recordOffPlanRuns({
      ...base,
      current,
      byDate,
      paired: new Set(['8']),
      window: null
    });
    expect(Object.keys(partial ?? {}).sort()).toEqual(['icu:i9', 'strava:2']);
    expect(
      recordOffPlanRuns({ ...base, current: whole!, byDate, paired: new Set(), window: null })
    ).toBeNull();
  });

  it('neobrađena aktivnost i stanje veze: fullSync se pomera samo bez problema', () => {
    expect(stravaActivityIssue({ id: 1, type: null, sport_type: null })).toBe(
      'nepoznat tip aktivnosti'
    );
    expect(stravaActivityIssue({ id: 1, type: 'Ride', start_date_local: null })).toBeNull();
    expect(
      stravaActivityIssue({ id: 1, type: 'Run', start_date_local: null, distance: 5000 })
    ).toBe('trčanje nema datum početka');
    const prev = { fullSync: 5, fullSyncFrom: '2026-10-01' };
    expect(syncStatus(prev, [], '2026-10-05', 9)).toEqual({
      fullSync: 9,
      fullSyncFrom: '2026-10-05',
      syncIssues: []
    });
    const issue = { date: '2026-11-10', id: '3', reason: 'x' };
    expect(syncStatus(prev, [issue], '2026-10-05', 9)).toEqual({ ...prev, syncIssues: [issue] });
  });
});

describe('vanPlanaV2 u stanju', () => {
  it('migracija čisti neispravne zapise; stanje bez polja ostaje bez njega', () => {
    const seed = JSON.parse(JSON.stringify(seedState())) as Record<string, unknown>;
    expect(migrateState(seed)).not.toHaveProperty('vanPlanaV2');
    const m = migrateState({
      ...seed,
      vanPlanaV2: {
        'strava:1': { date: '2026-11-09', km: 7.123, sec: 2520.4, src: 'strava', id: '1' },
        'strava:2': { date: '2026-11-09', km: 7, sec: null, src: 'icu', id: '2' },
        'icu:x': { date: 'juče', km: 5, sec: 100, src: 'icu', id: 'x' },
        'icu:y': { date: '2026-11-10', km: 0, sec: null, src: 'icu', id: 'y' }
      }
    });
    expect(m?.vanPlanaV2).toEqual({
      'strava:1': { date: '2026-11-09', km: 7.12, sec: 2520, src: 'strava', id: '1' }
    });
  });
});
