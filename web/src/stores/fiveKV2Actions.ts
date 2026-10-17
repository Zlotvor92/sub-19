/* 5K v2 (segment 08b): ČINJENICE IZ APLIKACIJE za prilagođavanje — skupljanje iz store-ova (bol, testovi, trčanja pre
   plana, 08c: trčanja van plana, stanje sinhronizacije). Prevod u činjenice i sve odluke su u domenu
   (`fiveK/v2/app/facts.ts`, `adaptFiveKV2`); ovde je samo čitanje stanja i sata (dan poslednje POTPUNE sinhronizacije). */

import { useMemo } from 'react';
import { icuCanReadActivities } from '../domain/icu/link';
import {
  fiveKV2AdaptPreview,
  isFiveKV2Plan,
  type AdaptationSources
} from '../domain/generators/select';
import { parseIsoDate } from '../domain/date';
import type { SyncIssue } from '../domain/state';
import { localDate } from '../lib/clock';
import { useRecoveryStore } from './recoveryStore';
import { useSettingsStore } from './settingsStore';
import { useTrainingStore } from './trainingStore';
import { useUIStore } from './uiStore';

type Link = Record<string, unknown> | null;

/** Povezani izvori sinhronizacije treninga: Strava i intervals.icu sa pravom čitanja treninga. Pokrivenost čita
 *  ISKLJUČIVO `fullSync` (08c: sve aktivnosti perioda preuzete i obrađene) — ne `lastSync`/`trSync` (spisak preuzet, i kad
 *  tokovi ili detalji ne uspeju). Dan je lokalni kalendarski dan; uz njega prvi dan perioda i neobrađene aktivnosti. */
export function syncSources(strava: Link, icu: Link): NonNullable<AdaptationSources['sync']> {
  const day = (ms: unknown) =>
    typeof ms === 'number' && Number.isFinite(ms) && ms > 0
      ? parseIsoDate(localDate(new Date(ms)))
      : null;
  const of = (source: 'strava' | 'icu', l: Record<string, unknown>) => ({
    source,
    lastSuccessDate: day(l['fullSync']),
    fromDate: parseIsoDate(l['fullSyncFrom']),
    issues: Array.isArray(l['syncIssues']) ? (l['syncIssues'] as SyncIssue[]) : []
  });
  const out: Array<NonNullable<AdaptationSources['sync']>[number]> = [];
  if (strava) out.push(of('strava', strava));
  if (icu && icuCanReadActivities(icu)) out.push(of('icu', icu));
  return out;
}

/** Činjenice van dnevnika iz store-ova; `confirmedDays` = potvrda korisnika u toku prilagođavanja. */
export function fiveKV2Sources(confirmedDays: number | null = null): AdaptationSources {
  const t = useTrainingStore.getState();
  const r = useRecoveryStore.getState();
  const s = useSettingsStore.getState();
  return {
    pain: r.knee,
    tests: t.t3k,
    outOfPlan: r.vanPlana,
    ...(r.vanPlanaV2 ? { offPlanRuns: r.vanPlanaV2 } : {}),
    sync: syncSources(s.strava, s.icu),
    confirmedDays
  };
}

/** Traka „Plan treba prilagoditi": aktivna ograničenja iz činjenica (bez potvrde i bez prijavljenih pauza) koja menjaju
 *  budući deo plana 5K v2; prazno = ništa. Samo prikaz — upis ide kroz pregled i potvrdu. */
export function useFiveKV2Needed(): string[] {
  const genPlan = useTrainingStore((s) => s.genPlan);
  const log = useTrainingStore((s) => s.log);
  const alts = useTrainingStore((s) => s.alts);
  const moves = useTrainingStore((s) => s.moves);
  const t3k = useTrainingStore((s) => s.t3k);
  const knee = useRecoveryStore((s) => s.knee);
  const vanPlana = useRecoveryStore((s) => s.vanPlana);
  const vanPlanaV2 = useRecoveryStore((s) => s.vanPlanaV2);
  const strava = useSettingsStore((s) => s.strava);
  const icu = useSettingsStore((s) => s.icu);
  const todayStr = useUIStore((s) => s.today);
  return useMemo(() => {
    const today = parseIsoDate(todayStr);
    if (!genPlan || !today || !isFiveKV2Plan(genPlan)) return [];
    const r = fiveKV2AdaptPreview(genPlan, today, {
      log,
      alts,
      moves,
      facts: {
        pain: knee,
        tests: t3k,
        outOfPlan: vanPlana,
        ...(vanPlanaV2 ? { offPlanRuns: vanPlanaV2 } : {}),
        sync: syncSources(strava, icu),
        confirmedDays: null
      }
    });
    return r.ok ? r.needed : [];
  }, [genPlan, log, alts, moves, t3k, knee, vanPlana, vanPlanaV2, strava, icu, todayStr]);
}
