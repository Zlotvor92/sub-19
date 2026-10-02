import { useCallback, useEffect, useState } from 'react';
import { fmtDayLong } from '../../domain/format';
import { weekOf, type ResolvedDay } from '../../domain/plan';
import { confirmAction } from '../../app/confirm';
import { Icon } from '../../components/ui/icons';
import { useTrainingStore } from '../../stores';
import { setStatus } from '../../stores/dayActions';
import { useUIStore } from '../../stores/uiStore';
import { useCycleModel } from '../cycle/useCycleModel';
import { sessionView } from '../session/sessionModel';
import { useEasyPace } from '../session/useEasyPace';
import { DayHeader, NextLine, Description, type DayStatus } from './DayCard';
import { AiCard } from './AiCard';
import { CompareCard, MorningCard, WatchCard, ZonesCard, dataDate } from './Cards';
import { CycleSummary } from './CycleSummary';
import { DayEntry } from './DayEntry';
import { Banners } from './Banners';
import { FocusPanel } from './FocusPanel';
import { NextDone } from './NextDone';
import { WeatherCard } from './WeatherCard';
import { useTodayModel } from './useTodayModel';

/* Potvrda završetka: kvačica se crta (CSS `.done-pop`), ukloni se sama. */
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

/* EKRAN DANAS. Jedan dominantan blok (trening), pa „šta je urađeno / šta dolazi", pa „gde sam u ciklusu". Dve kolone na širokom ekranu. */
export default function TodayPage() {
  const model = useTodayModel();
  const log = useTrainingStore((s) => s.log);
  const alts = useTrainingStore((s) => s.alts);
  const openSheet = useUIStore((s) => s.openSheet);
  const cycle = useCycleModel();
  const easy = useEasyPace();
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

  const phase = day ? (cycle?.weeks.find((w) => w.w === day.w)?.phase ?? null) : null;
  const week = weekOf(plan, today);
  const done = day ? log[day.id]?.status === 'done' : false;

  return (
    <>
      <Banners today={today} />
      <header className="screen-head">
        <h1>Danas</h1>
        <p>{fmtDayLong(today)}</p>
      </header>
      <div className="cols">
        <div className="col col-main">
          {!day ? (
            <div className="state">
              <Icon name="clock" size={28} />
              <b>
                {today < (plan.weeks[0]?.start ?? '') ? 'Plan još nije počeo' : 'Plan je završen'}
              </b>
              <p>
                {today < (plan.weeks[0]?.start ?? '')
                  ? `Plan počinje ${fmtDayLong(plan.weeks[0]?.start)}.`
                  : `Rezultat trke je u tabu Plan → N${plan.weeks.length}.`}
              </p>
            </div>
          ) : day.rest ? (
            <section
              className="card card--focus"
              aria-labelledby="rest-h"
              style={{ ['--phase' as string]: 'var(--line-strong)' }}
            >
              <span className="eyebrow">Danas</span>
              <h2 id="rest-h" className="focus-title">
                Odmor
              </h2>
              <Description desc={day.desc || 'Dan odmora po planu.'} />
              <NextLine plan={plan} from={today} hasAlt={hasAlt} />
            </section>
          ) : (
            <>
              <FocusPanel
                day={day}
                view={sessionView(day, { alt: alts[day.id], easyPaceSec: easy })}
                status={(log[day.id]?.status || 'pending') as DayStatus}
                phase={phase}
                entry={log[day.id]}
                alt={alts[day.id]}
                onStatus={(s) => void onStatus(day, s)}
                onDetails={() => openSheet({ kind: 'day', props: { id: day.id } })}
              />
              <WeatherCard day={day} today={today} />
              {done ? (
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
              {done ? (
                <div className="analysis">
                  <div className="section-head">
                    <h2>Analiza treninga</h2>
                  </div>
                  <WatchCard log={log[day.id]} date={dataDate(log[day.id], day.date)} />
                  <ZonesCard log={log[day.id]} />
                  <MorningCard date={dataDate(log[day.id], day.date)} />
                  <CompareCard day={day} plan={plan} />
                  <AiCard day={day} />
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="col col-side">
          <NextDone plan={plan} log={log} today={today} weekNo={week?.w ?? null} />
          <CycleSummary
            cycle={cycle}
            daysToRace={model.daysToRace}
            raceDate={model.raceDate}
            streak={model.streak}
          />
        </div>
      </div>
      {pop ? <DonePop onDone={donePop} /> : null}
    </>
  );
}
