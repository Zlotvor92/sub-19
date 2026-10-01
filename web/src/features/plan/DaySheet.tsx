import { useState } from 'react';
import { sessionGuide } from '../../domain/day';
import { dowShort, fmtDayMonthYear, fmtKm } from '../../domain/format';
import { dayLabel, sessKind } from '../../domain/plan';
import { confirmAction } from '../../app/confirm';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { deleteEntry, setStatus } from '../../stores/dayActions';
import { useUIStore } from '../../stores/uiStore';
import { Description } from '../today/DayCard';
import { DayEntry } from '../today/DayEntry';

type Status = 'pending' | 'done' | 'skip';
const STATUSES: ReadonlyArray<readonly [Status, string, string]> = [
  ['pending', 'Predstoji', ''],
  ['done', 'Odrađen', 'c-done '],
  ['skip', 'Preskočen', 'c-skip ']
];

/* LIST DANA: opis, status, forma za unos, izmena i brisanje unosa. Dan odmora nema formu ni status — samo izmenu. */
export function DaySheet({ id }: { id: string }) {
  const plan = useResolvedPlan();
  const day = plan?.byId.get(id);
  const status = useTrainingStore((s) => s.log[id]?.status || 'pending');
  const hasEntry = useTrainingStore((s) => !!s.log[id]);
  const edited = useTrainingStore((s) => !!s.alts[id]);
  const today = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [, bump] = useState(0);
  if (!plan || !day) return null;
  const rest = day.rest;
  const guide = rest ? null : sessionGuide(sessKind(day, edited));
  return (
    <>
      <div className="sh-t">
        N{day.w} ·{' '}
        {day.test ? 'TEST (opciono)' : `${dowShort(day.date)} ${fmtDayMonthYear(day.date)}`}
      </div>
      <div className="sh-s">
        {rest ? 'Odmor' : dayLabel(day, edited)}
        {day.km != null ? ` · plan ${fmtKm(day.km)} km` : ''}
        {edited ? ' · izmenjen' : ''}
      </div>
      {rest ? null : (
        <div style={{ fontSize: '.85rem' }}>
          <Description desc={day.desc} />
        </div>
      )}
      {guide ? (
        <div className="note-src" style={{ marginTop: 6 }}>
          💡 {guide}
        </div>
      ) : null}
      {rest ? null : (
        <div className="seg" id="seg">
          {STATUSES.map(([s, label, cls]) => (
            <button
              type="button"
              key={s}
              className={`${cls}${status === s ? 'on' : ''}`.trim()}
              aria-pressed={status === s}
              onClick={() => {
                setStatus(day, s, today);
                bump((n) => n + 1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {rest ? null : <DayEntry day={day} plan={plan} today={today} />}
      {day.test ? (
        <div className="note-src">
          Rezultat unesi u tabu <b>Trka → Test 3 km</b>. Test se ne mora istrčati baš na ovaj dan —
          tamo mu upisuješ i datum.
        </div>
      ) : (
        <div className="btnrow" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => openSheet({ kind: 'alt', props: { id } })}
          >
            ✏️ Izmeni trening
          </button>
        </div>
      )}
      {!rest && hasEntry ? (
        <div className="btnrow">
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              void confirmAction('Obriši sve unete podatke za ovaj trening?').then((ok) => {
                if (!ok) return;
                deleteEntry(id);
                closeSheet();
              });
            }}
          >
            Obriši unos
          </button>
        </div>
      ) : null}
      <div className="note-src">Sve izmene se čuvaju automatski.</div>
    </>
  );
}
