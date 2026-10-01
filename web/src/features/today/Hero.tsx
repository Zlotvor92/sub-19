import { dowShort, fmtDayLong, fmtDayMonth, plDan } from '../../domain/format';
import type { DayState } from '../../domain/day';
import type { IsoDate } from '../../domain/date';

const STATE_NAME: Record<DayState, string> = {
  da: 'odrađen',
  odmor: 'odmor po planu',
  ne: 'propušten',
  danas: 'danas — predstoji',
  van: 'van plana'
};

export function Hero({
  daysToRace,
  raceDate,
  streak,
  week
}: {
  daysToRace: number;
  raceDate: IsoDate;
  streak: number;
  week: ReadonlyArray<{ date: IsoDate; state: DayState }>;
}) {
  const byPlan = week.filter((x) => x.state === 'da' || x.state === 'odmor').length;
  return (
    <div className="hero">
      <div className="card accent">
        <div className="big">{daysToRace > 0 ? daysToRace : daysToRace === 0 ? '🏁' : '✓'}</div>
        <div className="big-sub">
          {daysToRace > 0
            ? `${plDan(daysToRace)} do trke`
            : daysToRace === 0
              ? 'danas je trka'
              : 'trka je prošla'}
        </div>
        <div className="big-sub" style={{ color: 'var(--txt3)' }}>
          {fmtDayLong(raceDate)}
        </div>
      </div>
      <div className="card">
        <div className="big" style={{ color: 'var(--green)' }}>
          {streak}
        </div>
        <div className="big-sub">{plDan(streak)} po planu</div>
        <div className="niz7" role="img" aria-label={`Poslednjih 7 dana: ${byPlan} po planu`}>
          {week.map((x) => (
            <i
              key={x.date}
              className={`n-${x.state}`}
              title={`${dowShort(x.date)} ${fmtDayMonth(x.date)} — ${STATE_NAME[x.state]}`}
            />
          ))}
        </div>
        <div className="niz7-l">poslednjih 7 dana</div>
      </div>
    </div>
  );
}
