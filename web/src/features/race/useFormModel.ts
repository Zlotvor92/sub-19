import { useMemo } from 'react';
import { addDays, parseIsoDate } from '../../domain/date';
import { planSummary } from '../../domain/day';
import { fmtClock } from '../../domain/format';
import { PERSONAL, isPersonalMeta, startingRace } from '../../domain/personal';
import {
  completedRuns,
  paceChartModel,
  predictionChartModel,
  raceRefs,
  vdotTrendModel
} from '../../domain/race';
import { currentVdot, type StoredPredRow } from '../../domain/training/adaptation';
import { predictionSummary } from '../../domain/training/prediction/summary';
import { t3kRows, t3kSeries } from '../../domain/training/test3k';
import { raceTimeForVdot } from '../../domain/training/vdot/racePrediction';
import { useActiveGenPlan, useResolvedPlan, useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { gapToGoal } from './journey';

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

export type Verdict = { word: string; tone: 'none' | 'ok' | 'bad' };

/* MODEL FORME — jedan izvor za Napredak (sažetak) i „Forma i predikcija“. Isti ulazi i iste funkcije domena kao ranije na ekranu Trka; ništa se ne računa novo.
   `null` dok nema plana, generisanog plana (ili ugrađenog ličnog) ili datuma. */
export function useFormModel() {
  const plan = useResolvedPlan();
  const genPlan = useActiveGenPlan();
  const log = useTrainingStore((s) => s.log);
  const pred = useTrainingStore((s) => s.pred);
  const vdotLog = useTrainingStore((s) => s.vdotLog);
  const t3k = useTrainingStore((s) => s.t3k);
  const alts = useTrainingStore((s) => s.alts);
  const todayStr = useUIStore((s) => s.today);
  return useMemo(() => {
    const today = parseIsoDate(todayStr);
    if (!plan || !genPlan || !today) return null;
    const refs = raceRefs(genPlan.meta);
    const rows = genPlan.pred.filter((r): r is StoredPredRow => typeof r.id === 'string');
    const paces: Record<string, number | undefined> = {};
    for (const [k, v] of Object.entries(pred)) if (typeof v === 'number') paces[k] = v;
    const start = plan.weeks[0]?.start ?? todayStr;
    const weekNo = (d: string): number | null =>
      plan.weeks.find((w) => d >= w.start && d <= addDays(w.start, 6))?.w ?? null;
    const summary = predictionSummary({
      pred: rows,
      paces,
      chain: vdotLog,
      tests: t3kRows(t3k, weekNo, start, plan.weeks.length),
      raceDistM: refs.raceDistM
    });
    const cv = currentVdot(vdotLog);
    const bv = refs.baselineVdot;
    const goal = refs.goalVdot ?? bv;
    const runs = completedRuns(plan, log, alts);
    const personal = isPersonalMeta(genPlan.meta);
    const delta = cv != null && bv != null ? Math.round((cv - bv) * 10) / 10 : null;
    const baseSec = bv != null ? raceTimeForVdot(bv, refs.raceDistM) : null;
    const estSec = cv != null ? raceTimeForVdot(cv, refs.raceDistM) : null;
    const verdict: Verdict =
      cv == null
        ? { word: 'Još nema merenja', tone: 'none' }
        : delta != null && delta > 0.05
          ? { word: 'Da', tone: 'ok' }
          : delta != null && delta < -0.05
            ? { word: 'Ne', tone: 'bad' }
            : { word: 'Za sada isto', tone: 'none' };
    return {
      plan,
      genPlan,
      refs,
      rows,
      summary,
      cv,
      bv,
      delta,
      formVdot: cv ?? bv,
      baseSec,
      estSec,
      gap: gapToGoal(estSec, refs.goalSec),
      verdict,
      personal,
      goalText: personal ? PERSONAL.goalText : refs.goalSec != null ? fmtClock(refs.goalSec) : '—',
      starting: personal ? startingRace(log) : null,
      measurements: vdotLog.filter((r) => r && num(r.vdot) != null).length,
      trend: bv != null && goal != null ? vdotTrendModel(vdotLog, bv, goal) : null,
      chart: predictionChartModel(rows, summary, refs.goalSec),
      runs,
      pace: paceChartModel(runs),
      sum: planSummary(plan, log, today),
      projectionSec: num(genPlan.meta?.['predictedSec']),
      tests: t3kSeries(t3k).slice().reverse()
    };
  }, [plan, genPlan, pred, vdotLog, t3k, log, alts, todayStr]);
}
