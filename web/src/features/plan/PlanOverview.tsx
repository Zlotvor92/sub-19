import { useMemo, useState } from 'react';
import { diffDays, parseIsoDate } from '../../domain/date';
import {
  effectiveRaceDate,
  planSummary,
  weekChart,
  weekRunCount,
  weekRunDone
} from '../../domain/day';
import { fmtDayLong, fmtKm, pl3 } from '../../domain/format';
import { ScreenFrame } from '../../components/ui/Shell';
import { Num } from '../../components/ui/Num';
import { Bar, Section } from '../../components/ui/primitives';
import { useActiveGenPlan, useResolvedPlan, useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { PHASE_COLOR, type PhaseKey } from '../cycle/cycle';
import { CycleRail } from '../cycle/CycleRail';
import { weekCells } from '../cycle/dayCells';
import { useCycleModel } from '../cycle/useCycleModel';
import { useEasyPace } from '../session/useEasyPace';
import { WeekBody } from './WeekBody';
import { WeekChart } from './WeekChart';
import { WeekRow } from './WeekRow';

const STATE_WORD = { done: 'završeno', now: 'u toku', future: '' } as const;
const kmFmt = (n: number): string => fmtKm(Math.round(n * 10) / 10);
const pctFmt = (n: number): string => `${Math.round(n)}%`;

/* PREGLED CELOG PLANA: cela priprema na jednom mestu — traka ciklusa, koliko je urađeno, kilometraža po nedeljama i faze sa nedeljama. Nedelja se
   otvara dodirom i nosi dane (Detalji treninga, pomeranje). Ovo je ono što je ranije bio ceo tab Plan, bez dupliranja sa Napretkom. */
export function PlanOverview() {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const alts = useTrainingStore((s) => s.alts);
  const gen = useActiveGenPlan();
  const todayStr = useUIStore((s) => s.today);
  const openScreen = useUIStore((s) => s.openScreen);
  const openSheet = useUIStore((s) => s.openSheet);
  const cycle = useCycleModel();
  const easy = useEasyPace();
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const [chartSel, setChartSel] = useState<number | null>(null);
  const today = parseIsoDate(todayStr);

  const view = useMemo(() => {
    if (!plan || !today) return null;
    return {
      sum: planSummary(plan, log, today),
      chart: weekChart(plan, log),
      race: effectiveRaceDate(plan, gen?.meta?.['raceDate'])
    };
  }, [plan, today, log, gen]);
  const phases = useMemo(
    () => new Map<number, PhaseKey>((cycle?.weeks ?? []).map((w) => [w.w, w.phase])),
    [cycle]
  );
  if (!plan || !today || !view || !cycle) return null;
  const { sum, chart, race } = view;
  const toggle = (w: number): void =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (!next.delete(w)) next.add(w);
      return next;
    });
  const total = Math.max(sum.total, 1);
  const selBar = chartSel != null ? chart.bars.find((b) => b.w === chartSel) : undefined;
  const nowW = cycle.current?.w ?? null;
  const daysToRace = race ? diffDays(today, race) : null;

  return (
    <ScreenFrame>
      <header className="screen-head">
        <h1>Cela priprema</h1>
        <p>
          {cycle.total} {pl3(cycle.total, 'nedelja', 'nedelje', 'nedelja')}
          {race ? ` · trka ${fmtDayLong(race).toLowerCase()}` : ''}
        </p>
      </header>
      <CycleRail model={cycle} daysToRace={daysToRace} />

      <Section title="Gde sam u planu" id="pl-sum">
        <div className="stats">
          <div className="stat">
            <b className="stat-v num">
              <Num value={sum.keepingPlanPct} format={pctFmt} />
            </b>
            <span className="stat-l">od plana do sada</span>
            <span className="stat-s num">
              {fmtKm(sum.run)} / {fmtKm(sum.untilToday)} km
            </span>
          </div>
          <div className="stat">
            <b className="stat-v num">
              <Num value={sum.wholePlanPct} format={pctFmt} />
            </b>
            <span className="stat-l">ceo plan</span>
            <span className="stat-s num">
              {fmtKm(sum.run)} / {fmtKm(sum.total)} km
            </span>
          </div>
        </div>
        <Bar
          value={sum.run / total}
          ghost={sum.untilToday / total}
          label={`Ostvareno ${kmFmt(sum.run)} od ${kmFmt(sum.total)} km; do danas planirano ${kmFmt(sum.untilToday)} km`}
        />
        <div className="legend">
          <span>ostvareno</span>
          <span>planirano do danas (svetla traka)</span>
        </div>
      </Section>

      <Section title="Nedeljna kilometraža" extra="plan i ostvareno" id="pl-ch">
        <p className="chart-msg" aria-live="polite">
          {selBar
            ? `N${selBar.w} · plan ${fmtKm(selBar.planKm)} km · urađeno ${fmtKm(selBar.realKm)} km`
            : 'Dodirni nedelju za detalje'}
        </p>
        <WeekChart
          chart={chart}
          selected={chartSel}
          onSelect={setChartSel}
          phases={phases}
          current={nowW}
        />
      </Section>

      {cycle.phases.map((p) => (
        <section
          key={`${p.key}-${p.from}`}
          className={`phase-block ${p.state}`}
          style={{ ['--c' as string]: PHASE_COLOR[p.key] }}
          aria-labelledby={`ph-${p.from}`}
        >
          <header className="phase-head">
            <h2 id={`ph-${p.from}`}>
              <i className="led" aria-hidden="true" />
              {p.key}
            </h2>
            <span className="num">
              N{p.from}
              {p.to > p.from ? `–N${p.to}` : ''} ·{' '}
              {p.state === 'future' ? '' : `${kmFmt(p.realKm)}/`}
              {kmFmt(p.planKm)} km
            </span>
            {STATE_WORD[p.state] ? <em>{STATE_WORD[p.state]}</em> : null}
          </header>
          {p.weeks.map((w) => {
            const rw = plan.weeks.find((x) => x.w === w.w);
            if (!rw) return null;
            const isOpen = open.has(w.w);
            return (
              <div key={w.w}>
                <WeekRow
                  week={w}
                  cells={weekCells(rw, log, today)}
                  open={isOpen}
                  onToggle={() => toggle(w.w)}
                  runsText={`${weekRunDone(rw, log)} od ${weekRunCount(rw, log)} trčanja`}
                />
                {isOpen ? (
                  <WeekBody
                    week={rw}
                    totalWeeks={plan.weeks.length}
                    current={nowW === w.w}
                    log={log}
                    alts={alts}
                    today={todayStr}
                    easyPaceSec={easy}
                    onDay={(id) => openScreen({ kind: 'trening', props: { id } })}
                    onSwap={(wn) => openSheet({ kind: 'swap', props: { w: wn } })}
                  />
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
      <p className="note-src key-note">
        Ćelije: popunjeno = urađeno · prsten = danas · kontura = predstoji · isprekidano =
        propušteno ili preskočeno · tačka = odmor.
      </p>
    </ScreenFrame>
  );
}
