import { useState } from 'react';
import { dowShort, fmtDayMonthYear } from '../../domain/format';
import { confirmAction } from '../../app/confirm';
import { PhaseBadge, StatusBadge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/icons';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { deleteEntry, setStatus } from '../../stores/dayActions';
import { useUIStore } from '../../stores/uiStore';
import { useCycleModel } from '../cycle/useCycleModel';
import { sessionView } from '../session/sessionModel';
import { useEasyPace } from '../session/useEasyPace';
import { WorkoutBrief } from '../session/WorkoutBrief';
import { AiCard } from '../today/AiCard';
import { CompareCard, MorningCard, WatchCard, ZonesCard, dataDate } from '../today/Cards';
import { Description } from '../today/DayCard';
import { DayEntry } from '../today/DayEntry';

type Status = 'pending' | 'done' | 'skip';
const STATUSES: ReadonlyArray<readonly [Status, string, string]> = [
  ['pending', 'Predstoji', ''],
  ['done', 'Odrađen', 'c-done '],
  ['skip', 'Preskočen', 'c-skip ']
];
const TONE = { pending: 'none', done: 'ok', skip: 'warn' } as const;

/* LIST DANA: opis, status, forma za unos, izmena i brisanje unosa. Dan odmora nema formu ni status — samo izmenu. */
export function DaySheet({ id }: { id: string }) {
  const plan = useResolvedPlan();
  const day = plan?.byId.get(id);
  const status = useTrainingStore((s) => s.log[id]?.status || 'pending');
  const hasEntry = useTrainingStore((s) => !!s.log[id]);
  const entry = useTrainingStore((s) => s.log[id]);
  const alt = useTrainingStore((s) => s.alts[id]);
  const edited = !!alt;
  const cycle = useCycleModel();
  const easy = useEasyPace();
  const today = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [, bump] = useState(0);
  if (!plan || !day) return null;
  const rest = day.rest;
  const view = sessionView(day, { alt, easyPaceSec: easy });
  const phase = cycle?.weeks.find((w) => w.w === day.w)?.phase ?? null;
  const weekFocus = plan?.weeks.find((w) => w.w === day.w)?.focus ?? '';
  return (
    <>
      <div className="sheet-top">
        <div className="eyebrow">
          N{day.w} ·{' '}
          {day.test ? 'TEST (opciono)' : `${dowShort(day.date)} ${fmtDayMonthYear(day.date)}`}
        </div>
        <div className="sheet-badges">
          {phase ? <PhaseBadge phase={phase} /> : null}
          {rest ? null : (
            <StatusBadge tone={TONE[status as Status]}>
              {STATUSES.find((x) => x[0] === status)?.[1]}
            </StatusBadge>
          )}
        </div>
      </div>
      <h2 className="sh-t big">
        {rest ? 'Odmor' : view.title}
        {edited ? <small> · izmenjen</small> : null}
      </h2>
      {rest ? null : view.rows ? (
        <WorkoutBrief view={view} phase={phase} weekFocus={weekFocus} />
      ) : (
        <>
          <Description desc={day.desc} />
          <WorkoutBrief view={view} phase={phase} weekFocus={weekFocus} />
        </>
      )}
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
      {rest ? null : (
        <>
          <WatchCard log={entry} date={dataDate(entry, day.date)} />
          <ZonesCard log={entry} />
          <MorningCard date={dataDate(entry, day.date)} />
          <CompareCard day={day} plan={plan} />
          <AiCard day={day} />
        </>
      )}
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
            <Icon name="edit" size={18} />
            Izmeni trening
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
