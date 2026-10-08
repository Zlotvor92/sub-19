import { useCallback, useEffect, useState } from 'react';
import { fmtDayLong, fmtKm } from '../../domain/format';
import { weekOf, type ResolvedDay } from '../../domain/plan';
import { nextTraining, weekPlanKm, weekRealKm } from '../../domain/day';
import { confirmAction } from '../../app/confirm';
import { AppBar } from '../../components/ui/Shell';
import { Bar, Row, Section } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/icons';
import { dowLongCap } from '../../lib/dates';
import { useTrainingStore } from '../../stores';
import { setStatus } from '../../stores/dayActions';
import { useUIStore } from '../../stores/uiStore';
import { sessionView } from '../session/sessionModel';
import { useEasyPace } from '../session/useEasyPace';
import { Advisories } from './Advisories';
import { Description, type DayStatus } from './DayCard';
import { TodayHero } from './TodayHero';
import { useTodayModel } from './useTodayModel';
import { useWeatherModel, weatherLine } from './WeatherCard';

/* Potvrda završetka: kvačica se crta (CSS `.done-pop`), ukloni se sama. */
function DonePop({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="done-pop" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="fade-out">
        <path d="M28 52 L44 67 L73 35" />
      </svg>
    </div>
  );
}

/* Dan koji ima trening: jedan blok sa jednim glavnim dugmetom. Hook za vreme mora da se zove bezuslovno, pa je ovo zasebna komponenta. */
function TrainingToday({
  day,
  today,
  onStatus
}: {
  day: ResolvedDay;
  today: string;
  onStatus: (d: ResolvedDay, s: DayStatus) => void;
}) {
  const log = useTrainingStore((s) => s.log);
  const alts = useTrainingStore((s) => s.alts);
  const openScreen = useUIStore((s) => s.openScreen);
  const easy = useEasyPace();
  const weather = useWeatherModel(day, today);
  return (
    <TodayHero
      view={sessionView(day, { alt: alts[day.id], easyPaceSec: easy })}
      status={(log[day.id]?.status || 'pending') as DayStatus}
      entry={log[day.id]}
      weather={weather ? weatherLine(weather) : null}
      onStatus={(s) => onStatus(day, s)}
      onDetails={() => openScreen({ kind: 'trening', props: { id: day.id } })}
    />
  );
}

/* EKRAN DANAS: odgovara na „šta danas radim?“. Redosled: (upozorenje kad postoji) → trening ili odmor sa jednim glavnim dugmetom → napredak nedelje →
   sledeći trening. Ništa drugo ne stoji na početnoj; ostalo je u Detaljima treninga, Planu i Napredku. */
export default function TodayPage() {
  const model = useTodayModel();
  const log = useTrainingStore((s) => s.log);
  const openScreen = useUIStore((s) => s.openScreen);
  const setTab = useUIStore((s) => s.setTab);
  const [pop, setPop] = useState(false);
  const donePop = useCallback(() => setPop(false), []);

  if (!model) return null;
  const { today, plan, day } = model;

  const onStatus = async (d: ResolvedDay, s: DayStatus): Promise<void> => {
    if (s === 'skip' && !(await confirmAction('Označi trening kao preskočen?'))) return;
    setStatus(d, s, today);
    if (s === 'done') setPop(true);
  };

  const week = weekOf(plan, today);
  const weekDone = week ? weekRealKm(week, log) : 0;
  const weekPlan = week ? weekPlanKm(week) : 0;
  const next = nextTraining(plan, today);
  const before = today < (plan.weeks[0]?.start ?? '');

  return (
    <>
      <AppBar right={fmtDayLong(today)} />
      <h1 className="sr-only">Danas</h1>
      <Advisories today={today} />

      {!day ? (
        <div className="state">
          <Icon name="clock" size={28} />
          <b>{before ? 'Plan još nije počeo' : 'Plan je završen'}</b>
          <p>
            {before
              ? `Plan počinje ${fmtDayLong(plan.weeks[0]?.start)}.`
              : `Rezultat trke je u planu, nedelja N${plan.weeks.length}.`}
          </p>
          <button type="button" className="btn ghost" onClick={() => setTab('plan')}>
            Otvori plan
          </button>
        </div>
      ) : day.rest ? (
        <section className="today" id="tcard" data-status="rest" aria-labelledby="rest-h">
          <div className="hero" aria-hidden="true">
            <span className="hero-v word">Odmor</span>
          </div>
          <h2 id="rest-h" className="sr-only">
            Odmor
          </h2>
          <div className="today-sub">
            <Description desc={day.desc || 'Dan odmora po planu.'} />
          </div>
          <button
            type="button"
            className="btn ghost block today-cta"
            onClick={() => openScreen({ kind: 'trening', props: { id: day.id } })}
          >
            Detalji dana
          </button>
        </section>
      ) : (
        <TrainingToday day={day} today={today} onStatus={(d, s) => void onStatus(d, s)} />
      )}

      {week ? (
        <Section>
          <div className="week-line">
            <h2>Ove nedelje</h2>
            <span className="num week-km">
              <b>{fmtKm(weekDone)}</b> / {fmtKm(weekPlan)} km
            </span>
          </div>
          <Bar
            value={weekPlan > 0 ? weekDone / weekPlan : 0}
            label={`Ove nedelje ${fmtKm(weekDone)} od ${fmtKm(weekPlan)} km`}
          />
        </Section>
      ) : null}

      {next ? (
        <div className="rows today-next">
          <Row
            title="Sledeće trčanje"
            end={
              <span className="num">
                {dowLongCap(next.date)}
                {next.km ? ` · ${fmtKm(next.km)} km` : ''}
              </span>
            }
            onClick={() => openScreen({ kind: 'trening', props: { id: next.id } })}
          />
        </div>
      ) : null}
      {pop ? <DonePop onDone={donePop} /> : null}
    </>
  );
}
