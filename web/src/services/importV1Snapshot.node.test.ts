import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { adaptGeneratedPlan, generatePlan } from '@/test/generators';
import {
  emptyImportState,
  mixedScenario,
  runIcu,
  runStrava,
  type SyncSnapshot
} from '@/test/importScenario';
import type { GenPlanState } from '../domain/state';

/* SEGMENT 08c — UVOZ ZA PLANOVE v1 JE BAJT-ISTI. Isti mešovit scenario (trčanja na dane plana i na dane odmora, dva
   trčanja dnevno, pre plana, bez tipa, bez km i trajanja, neispravna stavka, otkazi tokova i detalja) za 5K v1, 10K, HM i
   maraton, kroz Stravu i intervals.icu (automatski i ručno sa otkazom detalja). Snimak = svako upisano stanje + svaki
   upis veze + ishod; poredi se SHA-256 kanonskog JSON-a sa snimkom napravljenim na f09a50a (pre izmene 08c).
   Ponovno snimanje (samo na kodu PRE izmene): IMPORT_V1_RECORD=1. */

const FIXTURE = fileURLToPath(new URL('./importV1Snapshot.f09a50a.json', import.meta.url));
const START = '2026-01-05';
const TODAY = '2026-02-20';
const NOW = Date.UTC(2026, 1, 20, 9);
const ICU_LINK = { athleteId: 'i77', apiKey: 'k', lastSync: null };
const STRAVA_LINK = { access: 'a', refresh: 'r', expiresAt: 99999999999, lastSync: 0 };

function v1Plan(raceDistM: number, pbSec: number, goalSec: number, weeks: number): GenPlanState {
  const start = new Date(`${START}T00:00:00Z`);
  const race = new Date(start.getTime() + (weeks * 7 - 1) * 864e5).toISOString().slice(0, 10);
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: START,
      raceDate: race,
      raceDistM,
      pb: { distM: raceDistM, sec: pbSec },
      goalSec,
      weeklyKm: 45,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!a) throw new Error(`plan ${raceDistM}`);
  return a;
}

const PLANS: ReadonlyArray<[string, () => GenPlanState]> = [
  ['5K v1', () => v1Plan(5000, 1260, 1200, 10)],
  ['10K', () => v1Plan(10000, 2640, 2520, 12)],
  ['HM', () => v1Plan(21097.5, 5820, 5580, 14)],
  ['maraton', () => v1Plan(42195, 12600, 12000, 18)]
];

const sha = (x: unknown): string => createHash('sha256').update(JSON.stringify(x)).digest('hex');

async function snapshots(name: string, plan: GenPlanState, seed: number) {
  const sc = mixedScenario(plan, seed, TODAY);
  const state = emptyImportState(plan);
  const o = { now: NOW, today: TODAY };
  const out: Record<string, SyncSnapshot> = {};
  const pick = ({ result, commits, links }: SyncSnapshot): SyncSnapshot => ({
    result,
    commits,
    links
  });
  out[`${name} | strava`] = pick(await runStrava(state, sc.strava, STRAVA_LINK, o));
  out[`${name} | icu auto`] = pick(await runIcu(state, sc.icu, ICU_LINK, { ...o, manual: false }));
  out[`${name} | icu ručno, detalji otkazali`] = pick(
    await runIcu(state, { ...sc.icu, failDetails: true }, ICU_LINK, { ...o, manual: true })
  );
  return out;
}

describe('08c: uvoz za planove v1 (5K v1, 10K, HM, maraton) bajt-isti kao na f09a50a', () => {
  it('Strava + intervals.icu: upisano stanje i veza posle sinhronizacije', async () => {
    const all: Record<string, SyncSnapshot> = {};
    let seed = 801;
    for (const [name, make] of PLANS) Object.assign(all, await snapshots(name, make(), seed++));
    const got = Object.fromEntries(
      Object.entries(all).map(([k, v]) => [
        k,
        { sha256: sha(v), bytes: JSON.stringify(v).length, commits: v.commits.length }
      ])
    );
    if (process.env['IMPORT_V1_RECORD'] === '1' || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, `${JSON.stringify(got, null, 2)}\n`);
      if (process.env['IMPORT_V1_RECORD'] !== '1')
        throw new Error('snimak nije postojao — napravljen');
    }
    const want = JSON.parse(readFileSync(FIXTURE, 'utf8')) as typeof got;
    expect(Object.keys(got)).toHaveLength(12);
    expect(got).toEqual(want);
    // Scenario zaista sadrži ono što 08c menja za v2 (inače dokaz ne bi ništa pokrivao).
    const s = all['10K | strava']!;
    expect(s.commits).toHaveLength(1);
  });
});
