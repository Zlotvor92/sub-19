import { useMemo } from 'react';
import type { IsoDate } from '../../domain/date';
import { dowShort, fmtKm } from '../../domain/format';
import { dayLabel, type ResolvedDay, type ResolvedPlan } from '../../domain/plan';
import { realKm } from '../../domain/recovery/load';
import type { LogEntry } from '../../domain/state';
import { kindOf } from '../cycle/dayCells';

type Log = Readonly<Record<string, LogEntry>>;

function Item({ d, km, done }: { d: ResolvedDay; km: string; done?: boolean }) {
  return (
    <li>
      <i className={`kd k-${kindOf(d.tag)}`} aria-hidden="true" />
      <span>
        {d.date ? dowShort(d.date) : 'TT'} · {dayLabel(d, false)}
      </span>
      <b className="num">{km}</b>
      {done ? <span className="sr-only">odrađeno</span> : null}
    </li>
  );
}

/** ZAVRŠENO ove nedelje / SLEDEĆE: dve kolone, bez ponavljanja današnjeg treninga (on je u glavnom bloku). */
export function NextDone({
  plan,
  log,
  today,
  weekNo
}: {
  plan: ResolvedPlan;
  log: Log;
  today: IsoDate;
  weekNo: number | null;
}) {
  const { done, next, weekDone, weekPlan } = useMemo(() => {
    const week = plan.weeks.find((w) => w.w === weekNo);
    const done: ResolvedDay[] = week
      ? week.days
          .filter((d) => !d.rest && d.date && d.date <= today && log[d.id]?.status === 'done')
          .sort((a, b) => (a.date < b.date ? -1 : 1))
      : [];
    const next: ResolvedDay[] = plan.dated
      .filter((d) => !d.rest && d.date > today && log[d.id]?.status !== 'done')
      .slice(0, 3);
    return {
      done,
      next,
      weekDone: week ? week.days.reduce((s, d) => s + realKm(log, d), 0) : 0,
      weekPlan: week ? week.days.reduce((s, d) => s + (d.km || 0), 0) : 0
    };
  }, [plan, log, today, weekNo]);
  return (
    <div className="two">
      <section className="card" aria-labelledby="nd-done">
        <h3 id="nd-done">Završeno{weekNo ? ` · N${weekNo}` : ''}</h3>
        {done.length ? (
          <ul className="items">
            {done.map((d) => (
              <Item key={d.id} d={d} done km={d.km != null ? fmtKm(realKm(log, d) || d.km) : '✓'} />
            ))}
          </ul>
        ) : (
          <p className="none">Još nijedan trening ove nedelje.</p>
        )}
        {weekNo ? (
          <p className="sum num">
            {fmtKm(weekDone)} od {fmtKm(weekPlan)} km
          </p>
        ) : null}
      </section>
      <section className="card" aria-labelledby="nd-next">
        <h3 id="nd-next">Sledeće</h3>
        {next.length ? (
          <ul className="items">
            {next.map((d) => (
              <Item key={d.id} d={d} km={d.km != null ? fmtKm(d.km) : ''} />
            ))}
          </ul>
        ) : (
          <p className="none">Nema novih treninga u planu.</p>
        )}
      </section>
    </div>
  );
}
