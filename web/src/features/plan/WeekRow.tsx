import { fmtKm } from '../../domain/format';
import { Icon } from '../../components/ui/icons';
import type { Cell } from '../cycle/dayCells';
import type { CycleWeek } from '../cycle/cycle';

/** Red nedelje u mapi ciklusa: N#, sedam ćelija dana (vrsta + stanje), kilometri. Ceo red je jedno dugme (≥ 44 px) koje otvara dane nedelje. */
export function WeekRow({
  week,
  cells,
  open,
  onToggle,
  runsText
}: {
  week: CycleWeek;
  cells: readonly Cell[];
  open: boolean;
  onToggle: () => void;
  runsText: string;
}) {
  const id = `wk-d-${week.w}`;
  const started = week.state !== 'future';
  return (
    <button
      type="button"
      className={`wk-row ${week.state}${open ? ' on' : ''}`}
      aria-expanded={open}
      aria-label={`Nedelja ${week.w}`}
      aria-describedby={id}
      onClick={onToggle}
    >
      <b className="wk-n num">N{week.w}</b>
      <span className="cells" aria-hidden="true">
        {cells.map((c, i) => (
          <i key={i} className={`cell k-${c.kind} s-${c.state}`} />
        ))}
      </span>
      <span className="wk-km num">
        {started ? <b>{fmtKm(week.realKm)}</b> : null}
        <span>
          {started ? ' / ' : ''}
          {fmtKm(week.planKm)}
        </span>
        {week.deload ? <small>rasterećenje</small> : null}
      </span>
      <Icon name="chevron-down" size={16} />
      <span className="sr-only" id={id}>
        {`${fmtKm(week.realKm)} od ${fmtKm(week.planKm)} km, ${runsText}. ${cells.map((c) => c.label).join('; ')}`}
      </span>
    </button>
  );
}
