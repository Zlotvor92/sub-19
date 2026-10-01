import { useId } from 'react';
import { applyLogField, averagePace, fieldText, type LogField } from '../../domain/day';
import { fmtClock } from '../../domain/format';
import type { ResolvedDay } from '../../domain/plan';
import type { LogEntry, VdotRecord } from '../../domain/state';
import type { StoredPredRow } from '../../domain/training/adaptation';
import { effectivePace } from '../../domain/training/adaptation';
import { DraftInput, useDraft } from './DraftInput';
import { WorkSegment } from './WorkSegment';

const normalizer = (field: LogField) => (raw: string) =>
  fieldText(applyLogField(undefined, field, raw, 'pending'), field);

const NORMALIZE: Record<LogField, (raw: string) => string> = {
  km: normalizer('km'),
  sec: normalizer('sec'),
  hr: normalizer('hr'),
  rpe: normalizer('rpe'),
  knee: normalizer('knee'),
  kg: normalizer('kg'),
  ts: (raw) => raw,
  note: (raw) => raw
};

function Scale({
  id,
  label,
  from,
  to,
  value,
  onChange
}: {
  id: string;
  label: string;
  from: number;
  to: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const opts: number[] = [];
  for (let i = from; i <= to; i++) opts.push(i);
  return (
    <div className="f-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {opts.map((i) => (
          <option key={i} value={String(i)}>
            {i}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface EntryFormProps {
  day: ResolvedDay;
  entry: LogEntry | undefined;
  today: string;
  rows: readonly StoredPredRow[];
  pred: Readonly<Record<string, unknown>>;
  alts: Readonly<Record<string, { pace?: number | null }>>;
  vdotLog: readonly VdotRecord[];
  onField: (field: LogField, raw: string) => void;
  onPace: (predId: string, raw: string) => void;
  onBlur: () => void;
}

export function EntryForm(p: EntryFormProps) {
  const uid = useId();
  const fid = (f: string): string => `f-${f}-${uid}`;
  const l = p.entry;
  const avg = averagePace(l);
  const bind = (f: LogField) => ({
    value: fieldText(l, f, p.day.date || p.today),
    normalize: NORMALIZE[f],
    onCommit: (raw: string) => p.onField(f, raw),
    onBlurCommit: p.onBlur
  });
  return (
    <div className="f-grid" data-day={p.day.id}>
      <div className="f-field">
        <label htmlFor={fid('km')}>
          Distanca (km) <span className="f-req">*</span>
        </label>
        <DraftInput
          id={fid('km')}
          type="text"
          inputMode="decimal"
          placeholder="npr. 8"
          {...bind('km')}
        />
      </div>
      <div className="f-field">
        <label htmlFor={fid('sec')}>
          Vreme <span className="f-req">*</span>
        </label>
        <DraftInput
          id={fid('sec')}
          type="text"
          inputMode="numeric"
          placeholder="4233 = 42:33"
          {...bind('sec')}
        />
      </div>
      <div className="f-field">
        <span className="f-lbl" id={`lbl-tempo-${uid}`}>
          Pros. tempo
        </span>
        <div className="calc" role="status" aria-labelledby={`lbl-tempo-${uid}`}>
          {avg ? `${fmtClock(avg)} /km` : '—'}
        </div>
      </div>
      <div className="f-field">
        <label htmlFor={fid('hr')}>Pros. puls</label>
        <DraftInput
          id={fid('hr')}
          type="text"
          inputMode="numeric"
          placeholder="bpm"
          {...bind('hr')}
        />
      </div>
      {p.rows.length ? (
        <div
          className="f-field full wseg-wrap"
          role="group"
          aria-label="Radni deo — ostvaren tempo"
        >
          <span className="wseg-title">Radni deo — ostvaren tempo</span>
          {p.rows.map((r) => {
            const cur = p.pred[r.id];
            const own = p.alts[p.day.id]?.pace;
            return (
              <WorkSegment
                key={r.id}
                predId={r.id}
                label={r.l.split('·')[1]?.trim() || r.l}
                q={r.q}
                planPace={effectivePace(p.alts as never, p.day, r.pt)}
                ownGoal={own != null}
                pace={typeof cur === 'number' && cur > 0 ? cur : null}
                vdot={p.vdotLog.find((e) => e.id === r.id)}
                rejectedAuto={typeof l?.['autoOdbijen'] === 'number' ? l['autoOdbijen'] : null}
                onPace={(raw) => p.onPace(r.id, raw)}
              />
            );
          })}
        </div>
      ) : null}
      <details className="f-field full more-details">
        <summary>Više detalja (RPE, bol, masa, datum, beleška)</summary>
        <div className="more-grid">
          <Scale
            id={fid('rpe')}
            label="RPE (1–10)"
            from={1}
            to={10}
            value={fieldText(l, 'rpe')}
            onChange={(v) => p.onField('rpe', v)}
          />
          <Scale
            id={fid('knee')}
            label="Bol (0–10)"
            from={0}
            to={10}
            value={fieldText(l, 'knee')}
            onChange={(v) => p.onField('knee', v)}
          />
          <div className="f-field">
            <label htmlFor={fid('kg')}>Telesna masa (kg)</label>
            <DraftInput
              id={fid('kg')}
              type="text"
              inputMode="decimal"
              placeholder="npr. 80,5"
              {...bind('kg')}
            />
          </div>
          <div className="f-field">
            <label htmlFor={fid('ts')}>Datum</label>
            <DraftInput id={fid('ts')} type="date" {...bind('ts')} />
          </div>
          <div className="f-field full">
            <label htmlFor={fid('note')}>Beleška</label>
            <NoteField id={fid('note')} {...bind('note')} />
          </div>
        </div>
      </details>
    </div>
  );
}

function NoteField({
  id,
  value,
  normalize,
  onCommit,
  onBlurCommit
}: {
  id: string;
  value: string;
  normalize: (raw: string) => string;
  onCommit: (raw: string) => void;
  onBlurCommit?: () => void;
}) {
  const [draft, setDraft] = useDraft(value, normalize);
  return (
    <textarea
      id={id}
      value={draft}
      placeholder="Kako je bilo…"
      onChange={(e) => {
        setDraft(e.target.value);
        onCommit(e.target.value);
      }}
      onBlur={onBlurCommit}
    />
  );
}
