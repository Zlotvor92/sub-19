import { morningRows, watchRows, zonesCard, type CardRow, type RichPart } from '../../domain/day';
import type { LogEntry } from '../../domain/state';
import { trainingHour, type ForecastHours } from '../../domain/weather';
import { zoneSource } from '../../domain/zones';
import { useSettingsStore } from '../../stores';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { DayHeader } from './DayCard';

const TONE_VAR: Record<string, string> = {
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  neutral: 'var(--txt2)'
};

function Part({ p }: { p: RichPart }) {
  const style = p.tone ? { color: TONE_VAR[p.tone] } : undefined;
  if (p.tag === 'b') return <b style={style}>{p.text}</b>;
  if (p.tag === 'small') return <small>{p.text}</small>;
  return <>{p.text}</>;
}

export function Rows({ rows }: { rows: readonly CardRow[] }) {
  return (
    <div className="drows">
      {rows.map((r) => (
        <div className="drow" key={r.label}>
          <span className="l">{r.label}</span>
          <span className="v">
            {r.parts.map((p, i) => (
              <Part key={i} p={p} />
            ))}
          </span>
        </div>
      ))}
    </div>
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
    <div className="card">
      <DayHeader title="Sa sata" />
      <Rows rows={rows} />
    </div>
  );
}

const ZONE_COLORS = ['var(--txt3)', 'var(--green)', 'var(--cyan)', 'var(--amber)', 'var(--red)'];

/** „Po zonama": vreme po zonama pulsa; bez raspodele samo razlog (kad ga ima). */
export function ZonesCard({ log }: { log: LogEntry | undefined }) {
  const current = useCurrentZones();
  const icu = useSettingsStore((s) => s.icu);
  const connected = !!(icu && icu['athleteId'] && (icu['token'] || icu['apiKey']));
  const zoneError = typeof icu?.['zoneGreska'] === 'string' ? icu['zoneGreska'] : null;
  const model = zonesCard(log, { current, icuConnected: connected, zoneError });
  if (!model) return null;
  return (
    <div className="card">
      <DayHeader title="Po zonama" extra={model.extra} />
      {model.reason ? (
        <div className="note-src" style={{ margin: 0 }}>
          {model.reason}
        </div>
      ) : (
        <>
          <div className="drows">
            {model.rows.map((r) => (
              <div className="drow" key={r.n}>
                <span className="l">
                  <b>Z{r.n}</b>
                  {r.name ? (
                    <>
                      {' '}
                      <small>{r.name}</small>
                    </>
                  ) : null}
                </span>
                <span className="v">
                  <span
                    style={{
                      display: 'inline-block',
                      width: `${Math.max(2, r.pct)}%`,
                      maxWidth: 90,
                      height: 6,
                      borderRadius: 3,
                      background: ZONE_COLORS[Math.min(r.n - 1, ZONE_COLORS.length - 1)],
                      verticalAlign: 'middle',
                      marginRight: 8
                    }}
                  />
                  <b>{r.pct} %</b> <small>{r.minutes} min</small>
                </span>
              </div>
            ))}
          </div>
          <div className="note-src">{model.note}</div>
        </>
      )}
    </div>
  );
}

/** „Jutros": jutarnja merenja za dan trčanja. */
export function MorningCard({ date }: { date: string }) {
  const wellness = useRecoveryStore((s) => s.wellness);
  const rows = morningRows(wellness, date);
  if (!rows.length) return null;
  return (
    <div className="card">
      <DayHeader title="Jutros" />
      <Rows rows={rows} />
    </div>
  );
}
