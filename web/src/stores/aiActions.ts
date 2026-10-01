/* AI ANALIZA: spona između stanja i servisa. Zahtev za model gradi domen (`buildAiPayload`), tok vodi servis (`createAiJobs`); ovde se samo
   čitaju store-ovi i upisuje zapis dana. */

import { buildAiPayload, buildTrendSummary, goalContext } from '../domain/ai';
import { parseIsoDate } from '../domain/date';
import { effectiveRaceDate } from '../domain/day';
import { raceRefs } from '../domain/race';
import type { ResolvedDay } from '../domain/plan';
import type { LogEntry } from '../domain/state';
import type { StoredPredRow } from '../domain/training/adaptation';
import { trainingHour, type ForecastHours } from '../domain/weather';
import { zoneSource } from '../domain/zones';
import type { AiLogPort } from '../services/ai/aiJobs';
import { useRecoveryStore } from './recoveryStore';
import { useSettingsStore } from './settingsStore';
import { currentPlan, useTrainingStore } from './trainingStore';

/** Zapis dana kao priključak za servis: jedan upis po akciji, odmah (korisnik ne sme da izgubi rezultat zatvaranjem aplikacije). */
export const aiLogPort: AiLogPort = {
  get: (id) => useTrainingStore.getState().log[id],
  set: (id, entry: LogEntry) => {
    const t = useTrainingStore.getState();
    t.patch({ log: { ...t.log, [id]: entry } }, 'now');
  },
  ids: () => Object.keys(useTrainingStore.getState().log)
};

/** Zahtev za model za dati dan; `null` kad nema plana ili zapisa. */
export function aiPayloadFor(day: ResolvedDay): Record<string, unknown> | null {
  const t = useTrainingStore.getState();
  const plan = currentPlan();
  const log = t.log[day.id];
  if (!plan || !log) return null;
  const s = useSettingsStore.getState();
  const sati = s.vreme?.['sati'];
  return buildAiPayload({
    day,
    log,
    plan,
    predRows: (t.genPlan?.pred ?? []).filter((r): r is StoredPredRow => typeof r.id === 'string'),
    pred: t.pred,
    alts: t.alts,
    meta: t.genPlan?.meta,
    currentZones: zoneSource(s.icu, s.strava),
    wellness: useRecoveryStore.getState().wellness,
    forecast: sati && typeof sati === 'object' ? { sati: sati as ForecastHours } : null,
    trainingHour: trainingHour(s.ui.satTreninga)
  });
}

/** Zahtev za trend analizu iz trenutnog stanja; `null` kad nema plana. */
export function aiTrendRequest(
  today: string
): { summary: ReturnType<typeof buildTrendSummary>; goalCtx: string | null } | null {
  const t = useTrainingStore.getState();
  const plan = currentPlan();
  const day = parseIsoDate(today);
  if (!plan || !day) return null;
  const s = useSettingsStore.getState();
  const meta = t.genPlan?.meta as Record<string, unknown> | undefined;
  const refs = raceRefs(meta);
  const summary = buildTrendSummary({
    plan,
    log: t.log,
    pred: t.pred,
    predLock: t.predLock,
    predRows: (t.genPlan?.pred ?? []).filter((r): r is StoredPredRow => typeof r.id === 'string'),
    qs: t.genPlan?.qs,
    vdotLog: t.vdotLog,
    wellness: useRecoveryStore.getState().wellness,
    currentZones: zoneSource(s.icu, s.strava),
    today: day,
    raceDate: effectiveRaceDate(plan, meta?.['raceDate']),
    baselineVdot: refs.baselineVdot,
    goalVdot: refs.goalVdot
  });
  return { summary, goalCtx: goalContext(meta) };
}
