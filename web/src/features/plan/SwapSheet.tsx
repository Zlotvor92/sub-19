import { useState } from 'react';
import { dowShort, fmtDayMonth, fmtKm } from '../../domain/format';
import { confirmAction } from '../../app/confirm';
import { Icon } from '../../components/ui/icons';
import { useResolvedPlan, useTrainingStore, useV4Doc } from '../../stores';
import { applyMove, undoWeekMoves as undoV4WeekMoves } from '../../integrations/v4';
import { commitV4Edit } from './v4Edit';

/* POMERANJE TRENINGA: dodir na dan, pa dodir na drugi dan iste nedelje → zamena. Kad se otvori iz Detalja treninga, dan je već izabran, pa je
   dovoljan jedan dodir. Odrađeni dani (sa kvačicom) se ne pomeraju. */
export function SwapSheet({ w, from }: { w: number; from?: string }) {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const moves = useTrainingStore((s) => s.moves);
  const swapDays = useTrainingStore((s) => s.swapDays);
  const undoWeekMoves = useTrainingStore((s) => s.undoWeekMoves);
  const [sel, setSel] = useState<string | null>(() =>
    from && log[from]?.status !== 'done' ? from : null
  );
  const [err, setErr] = useState('');
  /* F9 korak 7: plan iz V4 → zamena je `applyMove` nad planom V4 (ne `moves`). */
  const v4Doc = useV4Doc();
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
  const isMoved = (d: (typeof week.days)[number]): boolean =>
    v4Doc ? d.origDate !== d.date : moves[d.id] != null;
  const v4Week = v4Doc?.weeks.find((x) => x.index === w);
  const moved = v4Doc
    ? !!v4Week?.days.some(
        (d) => d.movedFrom !== undefined || (d.origin === 'manual' && d.base === undefined)
      )
    : week.days.some((x) => !x.test && isMoved(x));
  const selDay = sel ? plan.byId.get(sel) : undefined;

  const pick = (id: string): void => {
    setErr('');
    if (!sel) return setSel(id);
    if (sel === id) return setSel(null);
    if (v4Doc) {
      const target = plan.byId.get(id)?.date;
      const from = sel;
      setSel(null);
      if (!target) return setErr('Zamena nije uspela: nepoznat dan');
      void commitV4Edit(v4Doc, (doc, ctx) => applyMove(doc, from, target, ctx)).then((e) => {
        if (e !== null) setErr(`Zamena nije uspela: ${e}`);
      });
      return;
    }
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
        <div role="alert" className="note-src err">
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
              <span className="swap-d">
                {dowShort(d.date)}
                <small>{fmtDayMonth(d.date)}</small>
              </span>
              <span className={`swap-t${d.rest ? ' muted' : ''}`}>
                {title}
                {isMoved(d) ? <small>pomeren sa {fmtDayMonth(d.origDate)}</small> : null}
              </span>
              <span className="swap-km num">{d.km != null ? `${fmtKm(d.km)} km` : ''}</span>
              <span className="swap-st" aria-hidden="true">
                {locked ? <Icon name="check" size={18} strokeWidth={2.4} /> : null}
                {selected ? <Icon name="swap" size={18} strokeWidth={2.2} /> : null}
              </span>
              {locked ? <span className="sr-only">odrađen, ne pomera se</span> : null}
            </>
          );
          return locked ? (
            <div key={d.id} className="swap-row lock">
              {content}
            </div>
          ) : (
            <button
              type="button"
              key={d.id}
              className={`swap-row${selected ? ' sel' : ''}`}
              aria-pressed={selected}
              onClick={() => pick(d.id)}
            >
              {content}
            </button>
          );
        })}
      </div>
      {moved ? (
        <div className="btnrow">
          <button
            type="button"
            className="btn ghost block"
            onClick={() => {
              void confirmAction(
                'Vratiti sve pomerene dane ove nedelje na originalni raspored iz plana?'
              ).then((ok) => {
                if (!ok) return;
                if (v4Doc) {
                  setSel(null);
                  void commitV4Edit(v4Doc, (doc, ctx) =>
                    undoV4WeekMoves(
                      doc,
                      doc.weeks.findIndex((x) => x.index === w),
                      ctx
                    )
                  ).then((e) => {
                    if (e !== null) setErr(`Vraćanje nije uspelo: ${e}`);
                  });
                  return;
                }
                undoWeekMoves(w);
                setSel(null);
              });
            }}
          >
            Vrati raspored nedelje na plan
          </button>
        </div>
      ) : null}
      <p className="note-src">
        Odrađeni dani (sa kvačicom) se ne pomeraju — istorija ostaje netaknuta. Zamena je moguća
        unutar iste nedelje.
      </p>
    </>
  );
}
