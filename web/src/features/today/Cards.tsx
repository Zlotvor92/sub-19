import {
  morningRows,
  sessionCompareCard,
  watchRows,
  zonesCard,
  type CardRow,
  type CompareContext,
  type RichPart
} from '../../domain/day';
import type { ResolvedDay, ResolvedPlan } from '../../domain/plan';
import type { StoredPredRow } from '../../domain/training/adaptation';
import type { LogEntry } from '../../domain/state';
import { trainingHour, type ForecastHours } from '../../domain/weather';
import { zoneSource } from '../../domain/zones';
import { useActiveGenPlan, useSettingsStore, useTrainingStore } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { Section } from '../../components/ui/primitives';
import { currentPaths } from '../../lib/copy';

const TONE_VAR: Record<string, string> = {
  green: 'var(--ok)',
  pink: 'var(--accent-text)',
  muted: 'var(--text-3)',
  amber: 'var(--warn)',
  red: 'var(--bad)',
  neutral: 'var(--text-2)'
};

function Part({ p }: { p: RichPart }) {
  const style = p.tone ? { color: TONE_VAR[p.tone] } : undefined;
  if (p.tag === 'b') return <b style={style}>{p.text}</b>;
  if (p.tag === 'small') return <small style={style}>{p.text}</small>;
  if (p.tag === 'sec')
    return (
      <span className="sec">
        {p.text}
        {(p.children ?? []).map((c, i) => (
          <Part key={i} p={c} />
        ))}
      </span>
    );
  return <>{p.text}</>;
}

export function Rows({ rows }: { rows: readonly CardRow[] }) {
  return (
    <dl className="facts">
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd>
            {r.parts.map((p, i) => (
              <Part key={i} p={p} />
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Dan kome pripadaju podaci sa sata i jutarnja merenja: pravi datum trčanja ako je poznat. */
export const dataDate = (log: LogEntry | undefined, planDate: string): string =>
  log?.runDate || log?.ts || planDate;

const useCurrentZones = () => {
  const icu = useSettingsStore((s) => s.icu);
  const strava = useSettingsStore((s) => s.strava);
  return zoneSource(icu, strava);
};

/** „Sa sata": ono što je sat izmerio (temperatura iz prognoze za sat trčanja, uz oznaku izvora). */
export function WatchCard({ log, date }: { log: LogEntry | undefined; date: string }) {
  const zones = useCurrentZones();
  const forecast = useSettingsStore((s) => s.vreme);
  const hourSetting = useSettingsStore((s) => s.ui.satTreninga);
  const sati = forecast?.['sati'];
  const rows = watchRows(log, date, {
    zones,
    forecast: sati && typeof sati === 'object' ? { sati: sati as ForecastHours } : null,
    trainingHour: trainingHour(hourSetting)
  });
  if (!rows.length) return null;
  return (
    <Section title="Sa sata">
      <Rows rows={rows} />
    </Section>
  );
}

const ZONE_COLORS = [
  'var(--text-3)',
  'var(--ph-build)',
  'var(--accent)',
  'var(--warn)',
  'var(--bad)'
];

/** „Po zonama": vreme po zonama pulsa; bez raspodele samo razlog (kad ga ima). */
export function ZonesCard({ log }: { log: LogEntry | undefined }) {
  const current = useCurrentZones();
  const icu = useSettingsStore((s) => s.icu);
  const connected = !!(icu && icu['athleteId'] && (icu['token'] || icu['apiKey']));
  const zoneError = typeof icu?.['zoneGreska'] === 'string' ? icu['zoneGreska'] : null;
  const model = zonesCard(log, { current, icuConnected: connected, zoneError });
  if (!model) return null;
  return (
    <Section title="Po zonama" extra={model.extra}>
      {model.reason ? (
        <p className="note-src">{currentPaths(model.reason)}</p>
      ) : (
        <>
          <dl className="facts">
            {model.rows.map((r) => (
              <div key={r.n}>
                <dt>
                  <b>Z{r.n}</b>
                  {r.name ? <> {r.name}</> : null}
                </dt>
                <dd>
                  <span
                    className="zbar"
                    style={{
                      width: `${Math.max(2, r.pct)}%`,
                      background: ZONE_COLORS[Math.min(r.n - 1, ZONE_COLORS.length - 1)]
                    }}
                  />
                  {r.pct} % <small>{r.minutes} min</small>
                </dd>
              </div>
            ))}
          </dl>
          <p className="note-src">{currentPaths(model.note)}</p>
        </>
      )}
    </Section>
  );
}

/** „Jutros": jutarnja merenja za dan trčanja. */
export function MorningCard({ date }: { date: string }) {
  const wellness = useRecoveryStore((s) => s.wellness);
  const rows = morningRows(wellness, date);
  if (!rows.length) return null;
  return (
    <Section title="Jutros">
      <Rows rows={rows} />
    </Section>
  );
}

/** „Ista sesija ranije" / „Slično lagano ranije": poređenje sa ranijim istim treningom. */
export function CompareCard({ day, plan }: { day: ResolvedDay; plan: ResolvedPlan }) {
  const log = useTrainingStore((s) => s.log);
  const pred = useTrainingStore((s) => s.pred);
  const alts = useTrainingStore((s) => s.alts);
  const genPlan = useActiveGenPlan();
  const forecast = useSettingsStore((s) => s.vreme);
  const hourSetting = useSettingsStore((s) => s.ui.satTreninga);
  const sati = forecast?.['sati'];
  const ctx: CompareContext = {
    dated: plan.dated,
    weeks: plan.weeks,
    log,
    pred,
    predRows: (genPlan?.pred ?? []).filter((r): r is StoredPredRow => typeof r.id === 'string'),
    alts,
    qs: genPlan?.qs,
    forecast: sati && typeof sati === 'object' ? { sati: sati as ForecastHours } : null,
    trainingHour: trainingHour(hourSetting)
  };
  const model = sessionCompareCard(day, ctx);
  if (!model) return null;
  return (
    <Section title={model.title} extra={model.extra}>
      <dl className="facts">
        {model.rows.map((r) => (
          <div key={r.label}>
            <dt>
              {r.label}
              {r.sub ? <> {r.sub}</> : null}
            </dt>
            <dd>
              {r.parts.map((p, i) => (
                <Part key={i} p={p} />
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="note-src">{model.note}</p>
    </Section>
  );
}
