import { addDays } from '../../domain/date';
import { fmtDayMonth } from '../../domain/format';
import { weekPhase, type ResolvedWeek } from '../../domain/plan';
import type { AltRecord, LogEntry } from '../../domain/state';
import { Row } from '../../components/ui/primitives';
import { DayRow } from './DayRow';

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
  today,
  easyPaceSec,
  onDay,
  onSwap
}: {
  week: ResolvedWeek;
  totalWeeks: number;
  current: boolean;
  log: Readonly<Record<string, LogEntry>>;
  alts: Readonly<Record<string, AltRecord | undefined>>;
  today: string;
  easyPaceSec: number | null;
  onDay: (id: string) => void;
  onSwap: (w: number) => void;
}) {
  const dows = week.days.filter((d) => !d.test).map((d) => d.dow);
  const endOffset = week.w === totalWeeks && dows.length ? Math.max(...dows) : 6;
  const phase = weekPhase(week, totalWeeks);
  const sub = phase === 'DELOAD' ? week.focus : week.focus ? `${phase} · ${week.focus}` : phase;
  return (
    <div className="pl-body">
      <p className="pl-bh">
        N{week.w} · {fmtDayMonth(week.start)} – {fmtDayMonth(addDays(week.start, endOffset))}
        {current ? ' · tekuća nedelja' : ''}
        <span>{sub}</span>
      </p>
      <div className="rows">
        {week.days
          .slice()
          .sort(byDate)
          .map((d) => (
            <DayRow
              key={d.id}
              day={d}
              entry={log[d.id]}
              alt={alts[d.id]}
              today={today}
              easyPaceSec={easyPaceSec}
              onOpen={() => onDay(d.id)}
            />
          ))}
        <Row icon="swap" title="Pomeri treninge" onClick={() => onSwap(week.w)} />
      </div>
    </div>
  );
}
