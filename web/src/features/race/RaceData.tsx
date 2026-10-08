import { useState } from 'react';
import { getApp } from '../../app/appContext';
import type { ResolvedDay } from '../../domain/plan';
import { defaultRaceContext, type RaceContext } from '../../domain/race/analysis';
import { useTrainingStore } from '../../stores';
import { fmtClock } from '../../domain/format';
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const value = (v: unknown): string =>
  typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '—';

export function RaceData({ day, context }: { day: ResolvedDay; context?: RaceContext }) {
  const entry = useTrainingStore((s) => s.log[day.id]);
  const data = obj(entry?.['raceDetails']);
  const date = context?.date ?? defaultRaceContext(entry ?? {}, day.date).date;
  const rows =
    data['date'] === date && Array.isArray(data['perKm']) ? (data['perKm'] as unknown[]) : [];
  const race = obj(entry?.['raceAi']);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = (): void => {
    setBusy(true);
    void getApp()
      .activities.raceDetails(day.id, date, true)
      .then((r) => {
        setMessage(r.error ?? `Povučeno deonica: ${r.splits}. Sada pokreni novu analizu.`);
      })
      .catch(() => setMessage('Povlačenje nije uspelo. Pokušaj ponovo.'))
      .finally(() => setBusy(false));
  };
  return (
    <div className="race-data">
      <button
        type="button"
        className="ai-again"
        disabled={busy || !!race['aiPosao']}
        onClick={refresh}
      >
        {busy ? 'Povlačim prolaze…' : 'Osveži kilometarske prolaze'}
      </button>
      {message ? <p role="status">{message}</p> : null}
      {race['dataUpdated'] ? (
        <p className="muted">
          Stara analiza je nastala pre osvežavanja prolaza. Pokreni novu analizu.
        </p>
      ) : null}
      {rows.length ? (
        <details>
          <summary>
            Prolazi po kilometru · {data['source'] === 'icu' ? 'intervals.icu' : 'Strava'} ·{' '}
            {rows.length} deonica
          </summary>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Km</th>
                  <th>Tempo/km</th>
                  <th>Puls</th>
                  <th>Uspon/pad</th>
                  <th>Pauza</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((raw, i) => {
                  const r = obj(raw);
                  return (
                    <tr key={i}>
                      <td>
                        {value(r['km'])}
                        {r['partial'] ? ` (${value(r['distanceM'])} m)` : ''}
                      </td>
                      <td>
                        {typeof r['paceSec'] === 'number' ? fmtClock(r['paceSec']) : '—'}
                        {r['timeBasis'] === 'elapsed' ? '*' : ''}
                      </td>
                      <td>{value(r['hr'])}</td>
                      <td>{value(r['elevM'])} m</td>
                      <td>{value(r['stopSec'])} s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted">
            GPS prolazi; završna nepotpuna deonica je posebno označena. * Tempo iz proteklog vremena
            kada servis nema podatke o kretanju.
          </p>
        </details>
      ) : (
        <p className="muted">
          Povuci prolaze sa Strave i intervals.icu pre analize. Ručni unos bez povezanog servisa
          sadrži samo prosek.
        </p>
      )}
    </div>
  );
}
