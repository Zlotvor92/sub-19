/* AI ANALIZA: spona između stanja i servisa. Zahtev za model gradi domen (`buildAiPayload`), tok vodi servis (`createAiJobs`); ovde se samo
   čitaju store-ovi i upisuje zapis dana. */

import { racePayload, type RaceContext } from '../domain/race/analysis';
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
import { activeGenPlan, currentPlan, useTrainingStore } from './trainingStore';

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
  const active = activeGenPlan();
  const log = t.log[day.id];
  if (!plan || !log) return null;
  const s = useSettingsStore.getState();
  const sati = s.vreme?.['sati'];
  return buildAiPayload({
    day,
    log,
    plan,
    predRows: (active?.pred ?? []).filter((r): r is StoredPredRow => typeof r.id === 'string'),
    pred: t.pred,
    alts: t.alts,
    meta: active?.meta,
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
  const active = activeGenPlan();
  const meta = active?.meta as Record<string, unknown> | undefined;
  const refs = raceRefs(meta);
  const summary = buildTrendSummary({
    plan,
    log: t.log,
    pred: t.pred,
    predLock: t.predLock,
    predRows: (active?.pred ?? []).filter((r): r is StoredPredRow => typeof r.id === 'string'),
    qs: active?.qs,
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

// LogEntry is an extensible record; existing clients preserve this nested namespace.
const AI_FIELDS = ['aiText', 'aiAt', 'aiCount', 'aiGreska', 'aiPosao'] as const;
export const raceAiLogPort: AiLogPort = {
  get(id) {
    const base = aiLogPort.get(id);
    if (!base) return undefined;
    const out = { ...base };
    for (const key of AI_FIELDS) delete out[key];
    const race = base['raceAi'];
    if (race && typeof race === 'object')
      for (const key of AI_FIELDS) {
        if (key in race) out[key] = (race as Record<string, unknown>)[key];
      }
    return out;
  },
  set(id, entry) {
    const base = aiLogPort.get(id);
    if (!base) return;
    const old = base['raceAi'];
    const race: Record<string, unknown> = { ...(old && typeof old === 'object' ? old : {}) };
    for (const key of AI_FIELDS) {
      if (key in entry) race[key] = entry[key];
      else delete race[key];
    }
    aiLogPort.set(id, { ...base, raceAi: race });
  },
  ids: () => aiLogPort.ids().filter((id) => !!aiLogPort.get(id)?.['raceAi'])
};
export function aiRacePayloadFor(
  day: ResolvedDay,
  context: RaceContext
): Record<string, unknown> | null {
  const log = aiLogPort.get(day.id);
  if (!log) return null;
  const enriched = aiPayloadFor(day);
  return {
    ...enriched,
    ...racePayload(log, context, enriched?.['entered'] as Record<string, unknown> | undefined)
  };
}

export function saveRaceContext(id: string, context: RaceContext): void {
  const base = aiLogPort.get(id);
  if (!base) return;
  const old = base['raceAi'];
  aiLogPort.set(id, {
    ...base,
    raceAi: { ...(old && typeof old === 'object' ? old : {}), context }
  });
}
