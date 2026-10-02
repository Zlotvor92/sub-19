import { fmtDayLong, plDan } from '../../domain/format';
import type { IsoDate } from '../../domain/date';
import type { CycleModel } from '../cycle/cycle';
import { PhaseList } from '../cycle/PhaseList';

/** Gde sam u ciklusu: dana do trke, serija, faze sa kilometrima. */
export function CycleSummary({
  cycle,
  daysToRace,
  raceDate,
  streak
}: {
  cycle: CycleModel | null;
  daysToRace: number;
  raceDate: IsoDate;
  streak: number;
}) {
  const raceText =
    daysToRace > 0
      ? `${plDan(daysToRace)} do trke`
      : daysToRace === 0
        ? 'danas je trka'
        : 'trka je prošla';
  return (
    <section className="card" aria-labelledby="cyc-h">
      <div className="dhead">
        <h3 id="cyc-h">Ciklus</h3>
        {cycle?.current ? (
          <span className="dhead-x">
            nedelja {cycle.current.w} od {cycle.total}
          </span>
        ) : null}
      </div>
      <div className="stats">
        <div className="stat">
          <b className="stat-v num">{daysToRace > 0 ? daysToRace : daysToRace === 0 ? '0' : '✓'}</b>
          <span className="stat-l">{raceText}</span>
          <span className="stat-s">{fmtDayLong(raceDate)}</span>
        </div>
        <div className="stat">
          <b className="stat-v num">{streak}</b>
          <span className="stat-l">{plDan(streak)} po planu</span>
          <span className="stat-s">serija bez propusta</span>
        </div>
      </div>
      {cycle ? <PhaseList model={cycle} /> : null}
    </section>
  );
}
