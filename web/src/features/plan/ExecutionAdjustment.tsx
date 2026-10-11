import { useMemo, useState } from 'react';
import { Section } from '../../components/ui/primitives';
import { fmtDayMonth } from '../../domain/format';
import type { ResolvedPlan } from '../../domain/plan';
import { getPlanRevisions } from '../../domain/plan/versions';
import { useRecoveryStore, useTrainingStore } from '../../stores';
import {
  commitPlanChange,
  executionModel,
  previewExecution,
  previewRestore,
  type PlanChangePreview
} from '../../stores/executionActions';

const kmText = (km: number): string => km.toFixed(1).replace('.', ',');
type ReadyPreview = Extract<PlanChangePreview, { ok: true }>;

/** A proposal is a preview until the runner explicitly applies it. Missing logs never confirm a pause. */
export function ExecutionAdjustment({ plan, today }: { plan: ResolvedPlan; today: string }) {
  const training = useTrainingStore();
  useRecoveryStore((s) => s.vanPlana);
  const { analysis, recommendation } = executionModel(plan, today);
  const revisions = useMemo(() => getPlanRevisions(training.genPlan), [training.genPlan]);
  const [mode, setMode] = useState<'reduce' | 'return'>('reduce');
  const [pauseConfirmed, setPauseConfirmed] = useState(false);
  const [breakDays, setBreakDays] = useState('7');
  const [weeklyKm, setWeeklyKm] = useState('');
  const [longRunKm, setLongRunKm] = useState('');
  const [preview, setPreview] = useState<ReadyPreview | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!training.genPlan?.ulaz) return null;
  const resetPreview = (): void => {
    setPreview(null);
    setError('');
    setMessage('');
  };
  const showPreview = (result: PlanChangePreview): void => {
    setMessage('');
    if (!result.ok) {
      setPreview(null);
      setError(result.reason);
      return;
    }
    setError('');
    setPreview(result);
  };
  const reviewExecution = (): void => {
    if (mode === 'return' && !pauseConfirmed) {
      setError('Potvrdi da si zaista pravio pauzu. Nedostatak unosa to ne potvrđuje.');
      return;
    }
    const base = weeklyKm.trim() ? Number(weeklyKm) : recommendation.weeklyKm;
    const lr = longRunKm.trim() ? Number(longRunKm) : recommendation.recentLongRunKm;
    if (base === undefined || !Number.isFinite(base) || base <= 0) {
      setError('Unesi stvarni pozitivan nedeljni obim na koji se oslanjamo.');
      return;
    }
    if (lr !== undefined && (!Number.isFinite(lr) || lr <= 0 || lr > base)) {
      setError('Dužina treba da bude pozitivna i najviše jednaka nedeljnom obimu.');
      return;
    }
    showPreview(
      previewExecution(plan, today, {
        weeklyKm: base,
        ...(lr !== undefined ? { recentLongRunKm: lr } : {}),
        ...(mode === 'return' ? { breakDays: Number(breakDays) } : {})
      })
    );
  };
  const apply = (): void => {
    if (!preview) return;
    const result = commitPlanChange(preview);
    setPreview(null);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError('');
    setMessage('Promena je primenjena. Prethodni plan je sačuvan u istoriji.');
  };

  return (
    <>
      <Section title="Prema odrađenim treninzima" id="execution-adjustment">
        <p className="prop-m">{recommendation.reason}</p>
        <p className="note-src">
          Poslednjih 28 dana: {analysis.completed} završeno, {analysis.missed} označeno kao
          preskočeno, {analysis.unknown} bez potvrde. Upisano {kmText(analysis.actualKm)} km;
          kilometraža je poznata za {Math.round(analysis.volumeCoverage * 100)}% treninga.
        </p>
        <p className="note-src">
          Neupisan trening ne računamo kao preskočen. Završeni trening bez kilometara ne potvrđuje
          planirani obim. Propuštene kilometre ne nadoknađujemo.
        </p>
        {analysis.reasons.map((reason) => (
          <p className="note-src" key={reason}>
            {reason}
          </p>
        ))}
        <div className="f-field full alt-block">
          <label htmlFor="execution-mode">Šta želiš da prilagodiš?</label>
          <select
            id="execution-mode"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as 'reduce' | 'return');
              setPauseConfirmed(false);
              resetPreview();
            }}
          >
            <option value="reduce">Opterećenje prema trenutnom obimu</option>
            <option value="return">Povratak posle potvrđene pauze</option>
          </select>
        </div>
        {mode === 'return' ? (
          <>
            <div className="f-field full alt-block">
              <label htmlFor="execution-break">Trajanje pauze</label>
              <select
                id="execution-break"
                value={breakDays}
                onChange={(e) => {
                  setBreakDays(e.target.value);
                  resetPreview();
                }}
              >
                <option value="7">7 dana</option>
                <option value="14">14 dana</option>
                <option value="28">28 dana</option>
              </select>
            </div>
            <label className="note-src" htmlFor="execution-pause-confirmed">
              <input
                id="execution-pause-confirmed"
                type="checkbox"
                checked={pauseConfirmed}
                onChange={(e) => {
                  setPauseConfirmed(e.target.checked);
                  resetPreview();
                }}
              />{' '}
              Potvrđujem da sam pravio navedenu pauzu od trčanja
            </label>
          </>
        ) : null}
        <div className="f-field full alt-block">
          <label htmlFor="execution-weekly">
            {mode === 'return'
              ? 'Ponovljiva baza pre pauze (km/ned)'
              : 'Trenutna odrađena baza (km/ned)'}
          </label>
          <input
            id="execution-weekly"
            type="number"
            inputMode="decimal"
            min="1"
            step="0.1"
            value={weeklyKm}
            placeholder={recommendation.weeklyKm?.toString() ?? 'Unesi stvarni obim'}
            onChange={(e) => {
              setWeeklyKm(e.target.value);
              resetPreview();
            }}
          />
        </div>
        <div className="f-field full alt-block">
          <label htmlFor="execution-lr">
            {mode === 'return'
              ? 'Ponovljiva dužina pre pauze (km, opciono)'
              : 'Nedavna ponovljiva dužina (km, opciono)'}
          </label>
          <input
            id="execution-lr"
            type="number"
            inputMode="decimal"
            min="1"
            step="0.1"
            value={longRunKm}
            placeholder={
              recommendation.recentLongRunKm?.toString() ?? 'Najduži redovno odrađeni trening'
            }
            onChange={(e) => {
              setLongRunKm(e.target.value);
              resetPreview();
            }}
          />
        </div>
        <div className="btnrow start">
          <button type="button" className="btn ghost" onClick={reviewExecution}>
            Pregledaj predlog
          </button>
        </div>
      </Section>

      {revisions.length ? (
        <Section title="Prethodne verzije plana" id="plan-revisions">
          <p className="note-src">
            Čuvamo poslednjih pet verzija. Vraćanje prethodne verzije prvo prikazuje predlog za
            preostale dane; tvoji unosi treninga ostaju sačuvani.
          </p>
          {[...revisions].reverse().map((revision) => (
            <div className="alt-block" key={revision.id}>
              <p className="note-src">
                {fmtDayMonth(revision.date)} · {revision.summary}
              </p>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => showPreview(previewRestore(revision.id, today))}
                aria-label={`Pregledaj vraćanje: ${revision.summary}`}
              >
                Pregledaj vraćanje
              </button>
            </div>
          ))}
        </Section>
      ) : null}

      {preview ? (
        <Section title="Pregled promene" id="plan-change-preview">
          <p className="prop-m">{preview.summary}</p>
          <p className="note-src">
            Preostali km i opterećenje odnose se na dane posle danas; raniji i današnji plan nisu
            deo ovih zbirnih vrednosti.
          </p>
          <div className="race-data" style={{ overflowX: 'auto' }}>
            <table aria-label="Preostali km pre i posle promene">
              <thead>
                <tr>
                  <th scope="col">Nedelja</th>
                  <th scope="col">Pre, km</th>
                  <th scope="col">Posle, km</th>
                  <th scope="col">Dužina, km</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.slice(0, 4).map((change) => (
                  <tr key={change.week}>
                    <th scope="row">{change.week}</th>
                    <td>{kmText(change.beforeKm)}</td>
                    <td>{kmText(change.afterKm)}</td>
                    <td>{kmText(change.longRunKm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.changes.slice(0, 4).map((change) =>
            change.qualityMinutesBefore !== undefined &&
            change.qualityMinutesAfter !== undefined ? (
              <p className="note-src" key={`dose-${change.week}`}>
                Nedelja {change.week}: kvalitetan rad {kmText(change.qualityMinutesBefore)} →{' '}
                {kmText(change.qualityMinutesAfter)} min
                {change.demandingDaysBefore !== undefined && change.demandingDaysAfter !== undefined
                  ? `; zahtevni treninzi ${change.demandingDaysBefore} → ${change.demandingDaysAfter}`
                  : ''}
                .
              </p>
            ) : null
          )}
          {preview.changes.length > 4 ? (
            <p className="note-src">Prikazane su prve četiri preostale nedelje.</p>
          ) : null}
          {preview.notes.map((note) => (
            <p className="note-src" key={note}>
              {note}
            </p>
          ))}
          <div className="btnrow start">
            <button type="button" className="btn" onClick={apply}>
              Primeni prikazanu promenu
            </button>
            <button type="button" className="btn ghost" onClick={resetPreview}>
              Odustani
            </button>
          </div>
        </Section>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </>
  );
}
