import { addDays } from '../../domain/date';
import { sessionCore } from '../../domain/day';
import { dowShort, fmtDayMonth, fmtKm } from '../../domain/format';
import { dayLabel, safeTag, weekPhase, type ResolvedWeek } from '../../domain/plan';
import type { LogEntry } from '../../domain/state';
import { Icon } from '../../components/ui/icons';
import { kindOf } from '../cycle/dayCells';

/* Dani jedne nedelje, najranije prvo (dan bez datuma — opcioni test — na kraju). */
const byDate = (a: { date: string }, b: { date: string }): number => {
  const da = a.date || '9999-99-99';
  const db = b.date || '9999-99-99';
  return da < db ? -1 : da > db ? 1 : 0;
};

const STATUS_TEXT = { done: 'odrađen', skip: 'preskočen' } as const;

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
      <button type="button" className="day swap-btn" onClick={() => onSwap(week.w)}>
        <Icon name="swap" size={18} />
        Pomeri treninge
      </button>
      {week.days
        .slice()
        .sort(byDate)
        .map((d) => {
          const st = d.rest ? 'rest' : (log[d.id]?.status ?? 'pending');
          const kind = d.rest ? 'rest' : kindOf(d.tag);
          return (
            <button
              type="button"
              key={d.id}
              className={`day t-${d.rest ? 'rest' : safeTag(d.tag)} k-${kind}`}
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
              <div className="day-km num">{d.km != null ? `${fmtKm(d.km)} km` : ''}</div>
              <span className={`day-st ${st}`}>
                {st === 'done' ? <Icon name="check" size={14} strokeWidth={3} /> : null}
                {st === 'skip' ? <Icon name="skip" size={12} strokeWidth={2.4} /> : null}
                {st === 'done' || st === 'skip' ? (
                  <span className="sr-only">{STATUS_TEXT[st]}</span>
                ) : null}
              </span>
            </button>
          );
        })}
    </div>
  );
}
