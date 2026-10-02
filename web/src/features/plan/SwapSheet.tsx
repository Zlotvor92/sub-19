import { useState } from 'react';
import { dowShort, fmtDayMonth, fmtKm } from '../../domain/format';
import { confirmAction } from '../../app/confirm';
import { useResolvedPlan, useTrainingStore } from '../../stores';

/* POMERANJE TRENINGA: dodir na dan, pa dodir na drugi dan iste nedelje → zamena. Odrađeni dani (✓) se ne pomeraju. */
export function SwapSheet({ w }: { w: number }) {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const moves = useTrainingStore((s) => s.moves);
  const swapDays = useTrainingStore((s) => s.swapDays);
  const undoWeekMoves = useTrainingStore((s) => s.undoWeekMoves);
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const week = plan?.weeks.find((x) => x.w === w);
  if (!plan || !week) return null;
  const days = week.days
    .filter((x) => !x.test)
    .slice()
    .sort((a, b) => {
      const da = a.date || '9999-99-99';
      const db = b.date || '9999-99-99';
      return da < db ? -1 : da > db ? 1 : 0;
    });
  const moved = week.days.some((x) => !x.test && moves[x.id] != null);
  const selDay = sel ? plan.byId.get(sel) : undefined;

  const pick = (id: string): void => {
    setErr('');
    if (!sel) return setSel(id);
    if (sel === id) return setSel(null);
    const r = swapDays(sel, id);
    setSel(null);
    if (!r.ok) setErr(`Zamena nije uspela: ${r.err || 'nepoznata greška'}`);
  };

  return (
    <>
      <div className="sh-t">Pomeranje treninga · N{w}</div>
      <div className="sh-s">
        {selDay
          ? `Izabrano: ${dowShort(selDay.date)} ${fmtDayMonth(selDay.date)} — dodirni dan sa kojim će zameniti mesto`
          : 'Dodirni dan koji hoćeš da pomeriš'}
      </div>
      {err ? (
        <div role="alert" style={{ fontSize: '.75rem', color: 'var(--red)', marginBottom: 10 }}>
          {err}
        </div>
      ) : null}
      <div className="swap-list">
        {days.map((d) => {
          const locked = log[d.id]?.status === 'done';
          const selected = sel === d.id;
          const title = d.rest ? d.desc || 'Odmor' : (d.desc || '').split('\n')[0];
          const content = (
            <>
              <div className="day-d">
                {dowShort(d.date)}
                <small>{fmtDayMonth(d.date)}</small>
              </div>
              <div className="day-t" style={d.rest ? { color: 'var(--txt3)' } : undefined}>
                {title}
                {moves[d.id] != null ? <small>pomeren sa {fmtDayMonth(d.origDate)}</small> : null}
              </div>
              <div className="day-km">{d.km != null ? fmtKm(d.km) : ''}</div>
              <span className={`st ${locked ? 'done' : selected ? 'skip' : 'pending'}`}>
                {locked ? '✓' : selected ? '⇄' : '○'}
              </span>
            </>
          );
          return locked ? (
            <div key={d.id} className="day swap-lock">
              {content}
            </div>
          ) : (
            <button
              type="button"
              key={d.id}
              className={`day${selected ? ' swap-sel' : ''}`}
              aria-pressed={selected}
              onClick={() => pick(d.id)}
            >
              {content}
            </button>
          );
        })}
      </div>
      {moved ? (
        <div className="btnrow" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              void confirmAction(
                'Vratiti sve pomerene dane ove nedelje na originalni raspored iz plana?'
              ).then((ok) => {
                if (!ok) return;
                undoWeekMoves(w);
                setSel(null);
              });
            }}
          >
            Vrati raspored nedelje na plan
          </button>
        </div>
      ) : null}
      <div className="note-src">
        Odrađeni dani (✓) se ne pomeraju — istorija ostaje netaknuta. Zamena je moguća unutar iste
        nedelje.
      </div>
    </>
  );
}
