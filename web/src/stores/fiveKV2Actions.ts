/* 5K v2 (segment 08b): ČINJENICE IZ APLIKACIJE za prilagođavanje — skupljanje iz store-ova (bol, testovi, trčanja pre
   plana, stanje sinhronizacije). Prevod u činjenice i sve odluke su u domenu (`fiveK/v2/app/facts.ts`, `adaptFiveKV2`);
   ovde je samo čitanje stanja i sata (dan poslednje uspešne sinhronizacije). */

import { useMemo } from 'react';
import { icuCanReadActivities } from '../domain/icu/link';
import {
  fiveKV2AdaptPreview,
  isFiveKV2Plan,
  type AdaptationSources
} from '../domain/generators/select';
import { parseIsoDate } from '../domain/date';
import { localDate } from '../lib/clock';
import { useRecoveryStore } from './recoveryStore';
import { useSettingsStore } from './settingsStore';
import { useTrainingStore } from './trainingStore';
import { useUIStore } from './uiStore';

type Link = Record<string, unknown> | null;

/** Povezani izvori sinhronizacije treninga: Strava (`lastSync`, posle uspešnog upisa) i intervals.icu sa pravom čitanja
 *  treninga (`trSync`). Dan je lokalni kalendarski dan poslednje uspešne sinhronizacije. */
export function syncSources(strava: Link, icu: Link): NonNullable<AdaptationSources['sync']> {
  const day = (ms: unknown) =>
    typeof ms === 'number' && Number.isFinite(ms) && ms > 0
      ? parseIsoDate(localDate(new Date(ms)))
      : null;
  const out: Array<NonNullable<AdaptationSources['sync']>[number]> = [];
  if (strava) out.push({ source: 'strava', lastSuccessDate: day(strava['lastSync']) });
  if (icuCanReadActivities(icu)) out.push({ source: 'icu', lastSuccessDate: day(icu?.['trSync']) });
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
        sync: syncSources(strava, icu),
        confirmedDays: null
      }
    });
    return r.ok ? r.needed : [];
  }, [genPlan, log, alts, moves, t3k, knee, vanPlana, strava, icu, todayStr]);
}
