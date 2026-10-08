import { useMemo, useState } from 'react';
import { addDays, diffDays, parseIsoDate } from '../../domain/date';
import { effectiveRaceDate, weekPlanKm, weekRealKm } from '../../domain/day';
import { fmtDayLong, fmtDayMonth, fmtKm, plDan } from '../../domain/format';
import { raceRefs } from '../../domain/race';
import { AppBar } from '../../components/ui/Shell';
import { Icon } from '../../components/ui/icons';
import { Disclosure } from '../../components/ui/Disclosure';
import { Row } from '../../components/ui/primitives';
import { dayOfMonth, dowInitial } from '../../lib/dates';
import { useActiveGenPlan, useIcuConnected, useResolvedPlan, useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { PHASE_LINE, type PhaseKey } from '../cycle/cycle';
import { useCycleModel } from '../cycle/useCycleModel';
import { useEasyPace } from '../session/useEasyPace';
import { DayRow } from './DayRow';

const byDate = (a: { date: string }, b: { date: string }): number => {
  const da = a.date || '9999-99-99';
  const db = b.date || '9999-99-99';
  return da < db ? -1 : da > db ? 1 : 0;
};

/* EKRAN PLAN: jedna nedelja odjednom (tekuća, a ‹ › pomeraju na ostale), sa stanjem svakog dana — završeno, danas, predstoji, odmor. Ispod su
   dve radnje: cela priprema (faze, nedelje, kilometri) i prilagođavanje plana. Sve ostalo što je Plan ranije nosio je u „Pregledu celog plana“. */
export default function PlanPage() {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const alts = useTrainingStore((s) => s.alts);
  const gen = useActiveGenPlan();
  const icuOn = useIcuConnected();
  const todayStr = useUIStore((s) => s.today);
  const openScreen = useUIStore((s) => s.openScreen);
  const openSheet = useUIStore((s) => s.openSheet);
  const cycle = useCycleModel();
  const easy = useEasyPace();
  const [picked, setPicked] = useState<number | null>(null);
  const today = parseIsoDate(todayStr);

  const warnings = gen?.meta?.dayWarnings;
  const view = useMemo(() => {
    if (!plan || !today) return null;
    return { race: effectiveRaceDate(plan, gen?.meta?.['raceDate']) };
  }, [plan, today, gen]);
  if (!plan || !today || !view || !cycle) return null;

  /* Tekuća nedelja; pre početka plana prva, posle kraja poslednja. */
  const last = plan.weeks[plan.weeks.length - 1];
  const nowW =
    cycle.current?.w ??
    (today < (plan.weeks[0]?.start ?? '') ? (plan.weeks[0]?.w ?? 1) : (last?.w ?? 1));
  const w = picked ?? nowW;
  const week = plan.weeks.find((x) => x.w === w) ?? plan.weeks[0];
  if (!week) return null;
  const idx = plan.weeks.findIndex((x) => x.w === week.w);
  const prev = plan.weeks[idx - 1];
  const next = plan.weeks[idx + 1];
  const phase: PhaseKey | null = cycle.weeks.find((x) => x.w === week.w)?.phase ?? null;
  const isNow = cycle.current?.w === week.w;
  const started = week.start <= todayStr;
  const planKm = weekPlanKm(week);
  const realKm = weekRealKm(week, log);
  const days = week.days.slice().sort(byDate);
  const stripDays = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  const refs = gen ? raceRefs(gen.meta) : null;
  const daysToRace = view.race ? diffDays(today, view.race) : null;
  const rangeText = `${fmtDayMonth(week.start)} – ${fmtDayMonth(addDays(week.start, 6))}`;

  return (
    <>
      <AppBar right={phase} tag />
      <header className="screen-head">
        <h1>Tvoj plan</h1>
        {view.race ? (
          <p>
            {refs?.raceName ? `${refs.raceName} · ` : 'Trka · '}
            {fmtDayLong(view.race).toLowerCase()}
            {daysToRace != null && daysToRace > 0
              ? ` · za ${daysToRace} ${plDan(daysToRace)}`
              : daysToRace === 0
                ? ' · danas'
                : ''}
          </p>
        ) : null}
      </header>

      <div className="weeknav">
        <div className="weeknav-t">
          <h2 id="week-h">
            Nedelja {week.w} od {plan.weeks.length}
          </h2>
          <span className="weeknav-s">
            {rangeText}
            {isNow ? ' · ova nedelja' : ''}
          </span>
        </div>
        <div className="weeknav-b">
          <button
            type="button"
            className="iconbtn"
            aria-label="Prethodna nedelja"
            disabled={!prev}
            onClick={() => prev && setPicked(prev.w)}
          >
            <Icon name="chevron-left" size={22} />
          </button>
          <button
            type="button"
            className="iconbtn"
            aria-label="Sledeća nedelja"
            disabled={!next}
            onClick={() => next && setPicked(next.w)}
          >
            <Icon name="chevron" size={22} />
          </button>
        </div>
      </div>
      {phase ? (
        <p className="phase-line">
          Faza {phase}: {PHASE_LINE[phase]}
          {week.deload || /^DELOAD/i.test(week.focus) ? ' Nedelja rasterećenja.' : ''}
        </p>
      ) : null}

      <div className="daystrip" aria-hidden="true">
        {stripDays.map((d) => (
          <span key={d} className={`ds${d === todayStr ? ' now' : ''}`}>
            <span className="ds-l">{dowInitial(d)}</span>
            <span className="ds-n num">{dayOfMonth(d)}</span>
          </span>
        ))}
      </div>

      <div className="weekkm">
        <div className="hero">
          <span className="hero-v num">{fmtKm(planKm)}</span>
          <span className="hero-u">km</span>
        </div>
        <p className="weekkm-l">
          {isNow
            ? `planirano ove nedelje · ostvareno ${fmtKm(realKm)} km`
            : started
              ? `planirano · ostvareno ${fmtKm(realKm)} km`
              : 'planirano za ovu nedelju'}
        </p>
      </div>

      <div className="rows" aria-labelledby="week-h">
        {days.map((d) => (
          <DayRow
            key={d.id}
            day={d}
            entry={log[d.id]}
            alt={alts[d.id]}
            today={todayStr}
            easyPaceSec={easy}
            onOpen={() => openScreen({ kind: 'trening', props: { id: d.id } })}
          />
        ))}
      </div>

      {warnings?.length ? (
        <div className="plan-warn">
          <Disclosure title="Na šta da paziš u ovom planu" meta={String(warnings.length)}>
            {warnings.map((t) => (
              <p className="note-src" key={t}>
                {t}
              </p>
            ))}
          </Disclosure>
        </div>
      ) : null}

      <div className="plan-acts">
        <Row
          icon="swap"
          title="Pomeri treninge"
          sub="Zameni dane u ovoj nedelji"
          onClick={() => openSheet({ kind: 'swap', props: { w: week.w } })}
        />
        <Row
          icon="sliders"
          title="Prilagodi plan"
          sub="Cilj, forma, bol, novi plan"
          onClick={() => openScreen({ kind: 'plan-prilagodi' })}
        />
        {icuOn ? (
          <Row
            icon="watch"
            title="Pošalji na sat"
            sub="Narednih 14 dana"
            onClick={() => openScreen({ kind: 'sat' })}
          />
        ) : null}
      </div>
      <button
        type="button"
        className="btn ghost block plan-cta"
        onClick={() => openScreen({ kind: 'plan-pregled' })}
      >
        Pregled celog plana
      </button>
    </>
  );
}
