import { useState } from 'react';
import { Icon } from '../../components/ui/icons';
import { parseIsoDate, type IsoDate } from '../../domain/date';
import { dowShort, fmtDayMonth, fmtDayMonthYear, fmtNum, pl3 } from '../../domain/format';
import { weightModel } from '../../domain/recovery';
import type { WeightRecord } from '../../domain/state';
import { WeightChart } from './charts';

/* TELESNA MASA: grafikon, ručni unos (zamenjuje prethodni ručni za isti datum), brisanje merenja i merenja pre početka plana. */
export function WeightCard({
  kg,
  today,
  planStart,
  onAdd,
  onDelete,
  onDeleteBefore
}: {
  kg: readonly WeightRecord[];
  today: IsoDate;
  planStart: string;
  onAdd: (date: string, input: string) => { ok: true } | { ok: false; err: string };
  onDelete: (index: number) => void;
  onDeleteBefore: () => void;
}) {
  const [date, setDate] = useState<string>(today);
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const valid = kg
    .map((x, i) => ({ x, i }))
    .filter((o) => o.x && parseIsoDate(o.x.date))
    .sort((a, b) => (a.x.date < b.x.date ? 1 : a.x.date > b.x.date ? -1 : 0));
  const old = valid.filter((o) => o.x.date < planStart).length;
  const model = weightModel(kg, today);
  return (
    <section aria-label="Telesna masa">
      {model ? (
        <WeightChart model={model} selected={sel} onSelect={setSel} />
      ) : (
        <p className="empty">Još nema merenja — unesi prvo ispod.</p>
      )}
      <div className="f-grid">
        <div className="f-field">
          <label htmlFor="wt-date">Datum</label>
          <input
            type="date"
            id="wt-date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="f-field">
          <label htmlFor="wt-kg">Masa (kg)</label>
          <input
            type="text"
            id="wt-kg"
            inputMode="decimal"
            placeholder="npr. 79,4"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
      </div>
      {err ? (
        <p role="alert" className="note-src err">
          {err}
        </p>
      ) : null}
      <div className="btnrow start">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const r = onAdd(date, input);
            setSel(null);
            if (r.ok) {
              setErr('');
              setInput('');
            } else setErr(r.err);
          }}
        >
          Sačuvaj merenje
        </button>
      </div>
      {old ? (
        <div className="btnrow start">
          <button type="button" className="btn ghost" onClick={onDeleteBefore}>
            Obriši {old} {pl3(old, 'merenje', 'merenja', 'merenja')} pre {fmtDayMonth(planStart)}
          </button>
        </div>
      ) : null}
      {valid.length ? (
        <details className="help">
          <summary>Sva merenja ({valid.length})</summary>
          {valid.map((o) => (
            <div className="wt-row" key={`${o.i}-${o.x.date}`}>
              <div className="wt-i">
                <b className="num">{fmtNum(o.x.kg, 1)} kg</b>
                <span>
                  {dowShort(o.x.date)} {fmtDayMonthYear(o.x.date)}
                  {o.x.src ? ' · iz treninga' : ''}
                </span>
              </div>
              <button
                type="button"
                className="wt-del"
                aria-label={`Obriši merenje ${fmtNum(o.x.kg, 1)} kg od ${fmtDayMonth(o.x.date)}`}
                onClick={() => {
                  setSel(null);
                  onDelete(o.i);
                }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
        </details>
      ) : null}
    </section>
  );
}
