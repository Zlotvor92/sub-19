import { addDays } from '../../domain/date';
import { sessionCore } from '../../domain/day';
import { dowShort, fmtDayMonth, fmtKm } from '../../domain/format';
import { dayLabel, safeTag, weekPhase, type ResolvedWeek } from '../../domain/plan';
import type { LogEntry } from '../../domain/state';

/* Dani jedne nedelje, najranije prvo (dan bez datuma — opcioni test — na kraju). */
const byDate = (a: { date: string }, b: { date: string }): number => {
  const da = a.date || '9999-99-99';
  const db = b.date || '9999-99-99';
  return da < db ? -1 : da > db ? 1 : 0;
};

export function WeekBody({
  week,
  totalWeeks,
  current,
  log,
  alts,
  onDay,
  onSwap
}: {
  week: ResolvedWeek;
  totalWeeks: number;
  current: boolean;
  log: Readonly<Record<string, LogEntry>>;
  alts: Readonly<Record<string, unknown>>;
  onDay: (id: string) => void;
  onSwap: (w: number) => void;
}) {
  const dows = week.days.filter((d) => !d.test).map((d) => d.dow);
  const endOffset = week.w === totalWeeks && dows.length ? Math.max(...dows) : 6;
  const phase = weekPhase(week, totalWeeks);
  const sub = phase === 'DELOAD' ? week.focus : week.focus ? `${phase} · ${week.focus}` : phase;
  return (
    <div className="pl-body">
      <div className="pl-bh">
        N{week.w} · {fmtDayMonth(week.start)} – {fmtDayMonth(addDays(week.start, endOffset))}
        {current ? ' · tekuća nedelja' : ''}
        <span>{sub}</span>
      </div>
      <button
        type="button"
        className="day"
        style={{
          justifyContent: 'center',
          color: 'var(--txt)',
          fontWeight: 800,
          fontSize: '.82rem',
          minHeight: 44
        }}
        onClick={() => onSwap(week.w)}
      >
        ⇄ Pomeri treninge
      </button>
      {week.days
        .slice()
        .sort(byDate)
        .map((d) => {
          const s = d.rest ? 'rest' : log[d.id]?.status || 'pending';
          return (
            <button
              type="button"
              key={d.id}
              className={`day t-${d.rest ? 'rest' : safeTag(d.tag)}`}
              onClick={() => onDay(d.id)}
            >
              <div className="day-d">
                <span className="dw">{d.test ? 'TT' : dowShort(d.date)}</span>
                {d.date ? <span className="dn">{d.date.slice(8, 10)}</span> : null}
              </div>
              <div className="day-mid">
                <div className="day-type">{d.rest ? 'Odmor' : dayLabel(d, !!alts[d.id])}</div>
                <div className="day-desc">{d.rest ? d.desc || '—' : sessionCore(d)}</div>
              </div>
              <div className="day-km">{d.km != null ? `${fmtKm(d.km)} km` : ''}</div>
              <span className={`day-st ${s}`}>{s === 'done' ? '✓' : s === 'skip' ? '⏭' : ''}</span>
            </button>
          );
        })}
    </div>
  );
}
