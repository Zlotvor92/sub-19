import { useCallback, useEffect, useState } from 'react';
import { fmtDayLong } from '../../domain/format';
import type { ResolvedDay } from '../../domain/plan';
import { confirmAction } from '../../app/confirm';
import { useTrainingStore } from '../../stores';
import { setStatus } from '../../stores/dayActions';
import { DayHeader, NextLine, PlanCard, Description, type DayStatus } from './DayCard';
import { AiCard } from './AiCard';
import { CompareCard, MorningCard, WatchCard, ZonesCard, dataDate } from './Cards';
import { DayEntry } from './DayEntry';
import { Banners } from './Banners';
import { Hero } from './Hero';
import { WeatherCard } from './WeatherCard';
import { useTodayModel } from './useTodayModel';

/* Potvrda završetka: kratka animacija kvačice (CSS `.done-pop`), ukloni se sama. */
function DonePop({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="done-pop" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="fade-out">
        <circle cx="50" cy="50" r="46" />
        <path d="M30 52 L45 66 L72 37" />
      </svg>
    </div>
  );
}

export default function TodayPage() {
  const model = useTodayModel();
  const log = useTrainingStore((s) => s.log);
  const alts = useTrainingStore((s) => s.alts);
  const [pop, setPop] = useState(false);
  const donePop = useCallback(() => setPop(false), []);

  if (!model) return null;
  const { today, plan, day } = model;
  const hasAlt = (id: string): boolean => !!alts[id];

  const onStatus = async (d: ResolvedDay, s: DayStatus): Promise<void> => {
    if (s === 'skip' && !(await confirmAction('Označi trening kao preskočen?'))) return;
    setStatus(d, s, today);
    if (s === 'done') setPop(true);
  };

  return (
    <>
      <Banners today={today} />
      <Hero
        daysToRace={model.daysToRace}
        raceDate={model.raceDate}
        streak={model.streak}
        week={model.week}
      />
      <div
        style={{ fontSize: '.8rem', color: 'var(--txt2)', fontWeight: 700, margin: '2px 2px 10px' }}
      >
        {fmtDayLong(today)}
      </div>
      {!day ? (
        <div className="card empty">
          {today < (plan.weeks[0]?.start ?? '')
            ? `Plan počinje ${fmtDayLong(plan.weeks[0]?.start)}.`
            : `Plan je završen. Rezultat trke je u tabu Plan → N${plan.weeks.length}.`}
        </div>
      ) : day.rest ? (
        <div className="card">
          <span className="tag odmor">Odmor</span>
          <Description desc={day.desc || 'Dan odmora po planu.'} />
          <NextLine plan={plan} from={today} hasAlt={hasAlt} />
        </div>
      ) : (
        <>
          <PlanCard
            day={day}
            plan={plan}
            log={log}
            hasAlt={hasAlt(day.id)}
            onStatus={(s) => void onStatus(day, s)}
          />
          <WeatherCard day={day} today={today} />
          {log[day.id]?.status === 'done' ? (
            <div className="card">
              <DayHeader
                title="Uneto"
                extra={
                  log[day.id]?.src === 'strava'
                    ? `sa Strave${log[day.id]?.lock ? ' · ručno korigovano' : ''}`
                    : ''
                }
              />
              <DayEntry day={day} plan={plan} today={today} />
            </div>
          ) : null}
          {log[day.id]?.status === 'done' ? (
            <>
              <WatchCard log={log[day.id]} date={dataDate(log[day.id], day.date)} />
              <ZonesCard log={log[day.id]} />
              <MorningCard date={dataDate(log[day.id], day.date)} />
              <CompareCard day={day} plan={plan} />
              <AiCard day={day} />
            </>
          ) : null}
        </>
      )}
      {pop ? <DonePop onDone={donePop} /> : null}
    </>
  );
}
