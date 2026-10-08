import {
  useActiveGenPlan,
  useResolvedPlan,
  useSettingsStore,
  useTrainingStore
} from '../../stores';
import { currentVdot } from '../../domain/training/adaptation';
import {
  weatherCard,
  trainingHour,
  type ForecastHours,
  type WeatherCardModel
} from '../../domain/weather';
import type { ResolvedDay } from '../../domain/plan';
import { localHour } from '../../lib/clock';
import { predRowsForDay } from '../../stores/dayActions';
import type { StoredPredRow } from '../../domain/training/adaptation';
import { Section } from '../../components/ui/primitives';

/* VREME ZA DAN KOJI PREDSTOJI. Odluke (vrućina, hladniji sat, tempo uz vrućinu) su u `domain/weather`; domen vraća `null` kad prikaz nema smisla (odmor,
   prošlost, bez lokacije ili prognoze). Na Danas stoji JEDAN red (ono što menja odluku pre izlaska), a puna slika u Detaljima treninga. */
export function useWeatherModel(day: ResolvedDay, today: string): WeatherCardModel | null {
  const geo = useSettingsStore((s) => s.ui.geo);
  const forecast = useSettingsStore((s) => s.vreme);
  const hourSetting = useSettingsStore((s) => s.ui.satTreninga);
  const plan = useResolvedPlan();
  const vdotLog = useTrainingStore((s) => s.vdotLog);
  const pred = useActiveGenPlan()?.pred;

  const sati = forecast?.['sati'];
  const cache = sati && typeof sati === 'object' ? { sati: sati as ForecastHours } : null;
  const rows = (pred ?? []).filter((r): r is StoredPredRow => typeof r.id === 'string');
  return weatherCard({
    day,
    today,
    nowHour: localHour(),
    trainingHour: trainingHour(hourSetting),
    cache,
    hasLocation: !!geo,
    predPace: plan ? (predRowsForDay(plan, day, rows)[0]?.pt ?? null) : null,
    vdot: currentVdot(vdotLog)
  });
}

/** Jedan red za Danas: „Vreme u 7:00 · 14 °C, oseća se 12 °C · tempo uz vrućinu 5:50". */
export function weatherLine(model: WeatherCardModel): string {
  const main = model.rows.find((r) => r.label === 'temperatura' || /^u \d/.test(r.label));
  const heat = model.rows.find((r) => r.label === 'tempo uz vrućinu');
  const text = (r: { parts: Array<{ text: string }> }): string =>
    r.parts.map((p) => p.text).join(', ');
  const at = /u (\d+:\d+)$/.exec(model.extra)?.[1];
  const parts = [
    `Vreme${at ? ` u ${at}` : ''}${main ? ` · ${text(main)}` : ''}`,
    heat ? `tempo uz vrućinu ${heat.parts[0]?.text ?? ''}` : ''
  ].filter(Boolean);
  return parts.join(' · ');
}

/** Puna slika za Detalje treninga. */
export function WeatherSection({ day, today }: { day: ResolvedDay; today: string }) {
  const model = useWeatherModel(day, today);
  if (!model) return null;
  return (
    <Section title="Vreme" extra={model.extra}>
      <dl className="facts">
        {model.rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>
              {r.parts.map((p, i) => (
                <span key={i}>
                  {i ? ' ' : ''}
                  {p.kind === 'b' ? p.text : <small>{p.text}</small>}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="note-src">{model.note}</p>
    </Section>
  );
}
