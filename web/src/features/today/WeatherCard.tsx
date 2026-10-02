import {
  useActiveGenPlan,
  useResolvedPlan,
  useSettingsStore,
  useTrainingStore
} from '../../stores';
import { currentVdot } from '../../domain/training/adaptation';
import { weatherCard, trainingHour, type ForecastHours } from '../../domain/weather';
import type { ResolvedDay } from '../../domain/plan';
import { localHour } from '../../lib/clock';
import { predRowsForDay } from '../../stores/dayActions';
import type { StoredPredRow } from '../../domain/training/adaptation';
import { DayHeader } from './DayCard';

/* Kartica „Vreme": stoji ODMAH ispod plana i vidi se DOK trening još predstoji — posle je kasno, to je jedini podatak koji menja
   odluku unapred. Odluke (vrućina, hladniji sat, tempo uz vrućinu) su u `domain/weather`. */
export function WeatherCard({ day, today }: { day: ResolvedDay; today: string }) {
  const geo = useSettingsStore((s) => s.ui.geo);
  const forecast = useSettingsStore((s) => s.vreme);
  const hourSetting = useSettingsStore((s) => s.ui.satTreninga);
  const plan = useResolvedPlan();
  const vdotLog = useTrainingStore((s) => s.vdotLog);
  const pred = useActiveGenPlan()?.pred;

  const sati = forecast?.['sati'];
  const cache = sati && typeof sati === 'object' ? { sati: sati as ForecastHours } : null;
  const rows = (pred ?? []).filter((r): r is StoredPredRow => typeof r.id === 'string');
  const model = weatherCard({
    day,
    today,
    nowHour: localHour(),
    trainingHour: trainingHour(hourSetting),
    cache,
    hasLocation: !!geo,
    predPace: plan ? (predRowsForDay(plan, day, rows)[0]?.pt ?? null) : null,
    vdot: currentVdot(vdotLog)
  });
  if (!model) return null;
  return (
    <div className="card">
      <DayHeader title="Vreme" extra={model.extra} />
      <div className="drows">
        {model.rows.map((r) => (
          <div className="drow" key={r.label}>
            <span className="l">{r.label}</span>
            <span className="v">
              {r.parts.map((p, i) => (
                <span key={i}>
                  {i ? ' ' : ''}
                  {p.kind === 'b' ? <b>{p.text}</b> : <small>{p.text}</small>}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="note-src">{model.note}</div>
    </div>
  );
}
