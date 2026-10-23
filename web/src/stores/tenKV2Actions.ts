/* 10K v2 (segment 06): ČINJENICE IZ APLIKACIJE za prilagođavanje — skupljanje iz store-ova (bol, testovi 3 km, trčanja pre
   plana, trčanja van plana, stanje sinhronizacije) i upis rezultata testa 5 km na dan testa. Prevod u činjenice i sve
   odluke su u domenu (`tenK/v2/app/facts.ts`, `adaptTenKV2`); ovde je samo čitanje stanja i sata. Stanje sinhronizacije
   čita isti `syncSources` kao 5K v2 (samo `fullSync`, ne `lastSync`/`trSync`). */

import { useMemo } from 'react';
import {
  isTenKV2Plan,
  TEN_K_V2_TEST_FIELD,
  tenKV2AdaptPreview,
  type AdaptationSources
} from '../domain/generators/select';
import { parseIsoDate } from '../domain/date';
import { parseTimeStr } from '../domain/format';
import { syncSources } from './fiveKV2Actions';
import { useRecoveryStore } from './recoveryStore';
import { useSettingsStore } from './settingsStore';
import { useTrainingStore } from './trainingStore';
import { useUIStore } from './uiStore';

/** Činjenice van dnevnika iz store-ova; `confirmedDays` = potvrda korisnika u toku prilagođavanja. */
export function tenKV2Sources(confirmedDays: number | null = null): AdaptationSources {
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
 *  budući deo plana 10K v2; prazno = ništa. Samo prikaz — upis ide kroz pregled i potvrdu. */
export function useTenKV2Needed(): string[] {
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
    if (!genPlan || !today || !isTenKV2Plan(genPlan)) return [];
    const r = tenKV2AdaptPreview(genPlan, today, {
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

/** Vreme testa 5 km [s] upisano na unosu dana; `null` kad ga nema. */
export function tenKV2TestSec(entry: Record<string, unknown> | undefined): number | null {
  const v = entry?.[TEN_K_V2_TEST_FIELD];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/** Upis vremena testa 5 km (samo deonica testa, bez zagrevanja i hlađenja) na unos odrađenog dana testa plana 10K v2.
 *  Prazno briše. Vreme je činjenica — tempo menja tek prilagođavanje plana (pregled i potvrda). */
export function setTenKV2TestResult(
  dayId: string,
  raw: string
): { ok: true; sec: number | null } | { ok: false; reason: string } {
  const t = useTrainingStore.getState();
  if (!isTenKV2Plan(t.genPlan)) return { ok: false, reason: 'Plan nije 10K v2.' };
  const entry = t.log[dayId];
  if (entry?.status !== 'done')
    return { ok: false, reason: 'Prvo upiši odrađen trening (km i vreme), pa vreme testa.' };
  if (raw.trim() === '') {
    const { [TEN_K_V2_TEST_FIELD]: _removed, ...rest } = entry;
    t.patch({ log: { ...t.log, [dayId]: rest } }, 'now');
    return { ok: true, sec: null };
  }
  const sec = parseTimeStr(raw.trim());
  // 5 km: od 10:00 do 1:30:00 (van toga je greška u unosu; da li rezultat menja tempo odlučuje v2, VDOT 30–80).
  if (!sec || !Number.isFinite(sec) || sec < 600 || sec > 5400)
    return { ok: false, reason: 'Unesi vreme 5 km kao mm:ss (npr. 24:30).' };
  t.patch({ log: { ...t.log, [dayId]: { ...entry, [TEN_K_V2_TEST_FIELD]: sec } } }, 'now');
  return { ok: true, sec };
}
