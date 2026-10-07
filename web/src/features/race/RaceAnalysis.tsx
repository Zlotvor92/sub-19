import { useId, useMemo, useState } from 'react';
import { parseIsoDate } from '../../domain/date';
import { fmtClock } from '../../domain/format';
import type { ResolvedDay } from '../../domain/plan';
import {
  defaultRaceContext,
  normalizeRaceContext,
  type RaceContext
} from '../../domain/race/analysis';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { AiCard } from '../today/AiCard';

export function RaceAnalysis() {
  const account = useAuthStore((s) => s.userId);
  return <RaceAnalysisForm key={account} />;
}
function RaceAnalysisForm() {
  const fieldId = useId();
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const today = useUIStore((s) => s.today);
  const runs = useMemo(
    () =>
      Object.entries(log)
        .filter(([, l]) => (l.km ?? 0) > 0 && (l.sec ?? 0) > 0)
        .sort((a, b) =>
          String(b[1].runDate || b[1].ts || '').localeCompare(String(a[1].runDate || a[1].ts || ''))
        ),
    [log]
  );
  const [selection, setSelection] = useState('');
  const [manualId, setManualId] = useState('');
  const id =
    selection === 'manual'
      ? manualId
      : selection ||
        runs.find(
          ([key, l]) =>
            plan?.byId.get(key)?.tag === 'trka' ||
            /polumaraton|maraton|half marathon|race|trka/i.test(
              typeof l['stravaName'] === 'string' ? l['stravaName'] : ''
            )
        )?.[0] ||
        runs[0]?.[0] ||
        '';
  const entry = log[id];
  const stored = entry?.['raceAi'];
  const storedContext =
    stored && typeof stored === 'object' ? (stored as Record<string, unknown>)['context'] : null;
  const initial = defaultRaceContext(entry ?? {}, entry?.runDate || entry?.ts || today);
  const [draft, setDraft] = useState<RaceContext | null>(null);
  const context = draft ?? normalizeRaceContext(storedContext, initial);
  const [official, setOfficial] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [manualTime, setManualTime] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const patch = (p: Partial<RaceContext>) => {
    setDraft({ ...context, ...p });
    setDirty(true);
  };
  const seconds = (s: string): number | null => {
    if (!s.trim()) return null;
    const parts = s.trim().split(':');
    if (!/^(\d+:)?\d{1,2}:\d{2}$/.test(s.trim())) return NaN;
    const nums = parts.map(Number);
    if (nums.slice(1).some((n) => n >= 60)) return NaN;
    return nums.reduce((n, v) => n * 60 + v, 0);
  };
  const save = () => {
    const off = official === null ? context.officialSec : seconds(official),
      goal = target === null ? context.targetSec : seconds(target),
      manual = seconds(manualTime);
    if (
      !(context.distanceM >= 1000 && context.distanceM <= 100000) ||
      [off, goal].some((n) => n !== null && (!Number.isFinite(n) || n <= 0 || n > 172800)) ||
      !parseIsoDate(context.date) ||
      context.date > today ||
      (selection === 'manual' && (!manual || !Number.isFinite(manual)))
    ) {
      setError('Proveri datum, distancu i vreme (mm:ss ili hh:mm:ss).');
      return;
    }
    const next = { ...context, officialSec: off, targetSec: goal };
    const key = id || 'race-' + context.date + '-' + Date.now().toString(36);
    const t = useTrainingStore.getState();
    const base =
      selection === 'manual'
        ? {
            ...t.log[key],
            status: 'done',
            km: context.distanceM / 1000,
            sec: manual,
            ts: context.date,
            runDate: context.date,
            stravaName: context.name
          }
        : t.log[key];
    if (!base) {
      setError('Izaberi trčanje ili unesi rezultat ručno.');
      return;
    }
    const previous = base['raceAi'];
    t.patch(
      {
        log: {
          ...t.log,
          [key]: {
            ...base,
            raceAi: { ...(previous && typeof previous === 'object' ? previous : {}), context: next }
          }
        }
      },
      'now'
    );
    if (selection === 'manual') setManualId(key);
    setDraft(next);
    setOfficial(null);
    setTarget(null);
    setError('');
    setDirty(false);
  };
  const date = parseIsoDate(context.date);
  const original = plan?.byId.get(id);
  const day: ResolvedDay | null =
    date && entry
      ? {
          id,
          w: 0,
          weekStart: date,
          dow: 0,
          origDate: date,
          rest: false,
          km: entry.km ?? null,
          desc: context.name,
          runWalk: undefined,
          snaga: false,
          session: undefined,
          mlr: false,
          test: false,
          origin: {
            tag: 'trka',
            km: entry.km ?? null,
            desc: context.name,
            rest: false,
            runWalk: undefined
          },
          ...original,
          tag: 'trka',
          date
        }
      : null;
  return (
    <section className="card race-analysis" aria-labelledby="race-analysis-heading">
      <div className="dhead">
        <h2 id="race-analysis-heading">Analiza trke</h2>
      </div>
      <p className="muted">
        Izaberi već odrađeno trčanje, čak i ako nije bilo trka u planu, ili unesi rezultat ručno.
        Analiza trke se čuva odvojeno od analize treninga.
      </p>
      <div className="field">
        <label htmlFor={fieldId + '-1'}>Trčanje</label>
        <select
          id={fieldId + '-1'}
          value={selection || id}
          onChange={(e) => {
            setSelection(e.target.value);
            setManualId('');
            setDirty(false);
            setDraft(null);
            setOfficial(null);
            setTarget(null);
            setError('');
          }}
        >
          {!runs.length ? <option value="">Izaberi trčanje</option> : null}
          {runs.map(([key, l]) => (
            <option value={key} key={key}>
              {l.runDate || l.ts} ·{' '}
              {typeof l['stravaName'] === 'string' ? l['stravaName'] : 'Trčanje'} · {l.km} km ·{' '}
              {fmtClock(l.sec ?? 0)}
            </option>
          ))}
          <option value="manual">Unesi trku ručno</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={fieldId + '-2'}>Naziv trke</label>
        <input
          id={fieldId + '-2'}
          value={context.name}
          maxLength={120}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={fieldId + '-3'}>Datum trke</label>
        <input
          id={fieldId + '-3'}
          type="date"
          value={context.date}
          max={today}
          onChange={(e) => patch({ date: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={fieldId + '-4'}>Zvanična distanca (km)</label>
        <input
          id={fieldId + '-4'}
          type="number"
          min="1"
          max="100"
          step="0.0005"
          value={context.distanceM / 1000}
          onChange={(e) => patch({ distanceM: Number(e.target.value) * 1000 })}
        />
      </div>
      <div className="field">
        <label htmlFor={fieldId + '-5'}>Namera nastupa</label>
        <select
          id={fieldId + '-5'}
          value={context.intent}
          onChange={(e) => patch({ intent: e.target.value as RaceContext['intent'] })}
        >
          <option value="race">Trka za najbolji rezultat</option>
          <option value="controlled">Kontrolna trka</option>
          <option value="first_distance">Prvi put na ovoj distanci</option>
        </select>
      </div>
      {selection === 'manual' ? (
        <div className="field">
          <label htmlFor={fieldId + '-6'}>Vreme trčanja</label>
          <input
            id={fieldId + '-6'}
            placeholder="1:45:00"
            value={manualTime}
            onChange={(e) => setManualTime(e.target.value)}
          />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={fieldId + '-7'}>Zvanično vreme (opciono)</label>
        <input
          id={fieldId + '-7'}
          placeholder="hh:mm:ss ili mm:ss"
          value={official ?? (context.officialSec ? fmtClock(context.officialSec) : '')}
          onChange={(e) => {
            setOfficial(e.target.value);
            setDirty(true);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor={fieldId + '-8'}>Ciljno vreme te trke (opciono)</label>
        <input
          id={fieldId + '-8'}
          placeholder="hh:mm:ss ili mm:ss"
          value={target ?? (context.targetSec ? fmtClock(context.targetSec) : '')}
          onChange={(e) => {
            setTarget(e.target.value);
            setDirty(true);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor={fieldId + '-9'}>Unos hrane i tečnosti</label>
        <textarea
          id={fieldId + '-9'}
          maxLength={600}
          value={context.nutrition}
          onChange={(e) => patch({ nutrition: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={fieldId + '-10'}>Uslovi i osećaj tokom trke</label>
        <textarea
          id={fieldId + '-10'}
          maxLength={600}
          value={context.conditions}
          onChange={(e) => patch({ conditions: e.target.value })}
        />
      </div>
      <button type="button" className="btn" onClick={save}>
        Sačuvaj kontekst trke
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {dirty || !storedContext ? <p className="muted">Pre analize sačuvaj kontekst trke.</p> : null}
      {day &&
      !dirty &&
      (draft !== null || storedContext != null) &&
      official === null &&
      target === null ? (
        <AiCard key={id} day={day} raceContext={context} />
      ) : null}
    </section>
  );
}
