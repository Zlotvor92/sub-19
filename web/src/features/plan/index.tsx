import { useMemo, useState } from 'react';
import { parseIsoDate } from '../../domain/date';
import {
  effectiveRaceDate,
  planSummary,
  weekChart,
  weekRunCount,
  weekRunDone,
  type RingTone
} from '../../domain/day';
import { fmtDayLong, fmtKm, pl3 } from '../../domain/format';
import { useActiveGenPlan, useResolvedPlan, useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { Num } from '../../components/ui/Num';
import { PHASE_COLOR, type PhaseKey } from '../cycle/cycle';
import { weekCells } from '../cycle/dayCells';
import { useCycleModel } from '../cycle/useCycleModel';
import { WeekBody } from './WeekBody';
import { WeekChart } from './WeekChart';
import { WeekRow } from './WeekRow';

const TONE: Record<RingTone, string> = {
  green: 'var(--ok)',
  amber: 'var(--warn)',
  red: 'var(--bad)',
  cyan: 'var(--ph-build)',
  faint: 'var(--text-3)'
};
const STATE_WORD = { done: 'završeno', now: 'u toku', future: '' } as const;

const kmFmt = (n: number): string => fmtKm(Math.round(n * 10) / 10);
const pctFmt = (n: number): string => `${Math.round(n)}%`;

/* EKRAN PLAN: gde sam u celini (jedna traka umesto dva prstena), poruka grafikona, pa MAPA CIKLUSA — faze, nedelje sa sedam ćelija dana.
   Nedelja se otvara dodirom i nosi dane (list dana, pomeranje). Na širokom ekranu: pregled levo, mapa desno. */
export default function PlanPage() {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const alts = useTrainingStore((s) => s.alts);
  const gen = useActiveGenPlan();
  const warnings = gen?.meta?.dayWarnings;
  const todayStr = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const cycle = useCycleModel();
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
  const holdTone: RingTone =
    sum.keepingPlanPct >= 95 ? 'green' : sum.keepingPlanPct >= 80 ? 'amber' : 'red';
  const total = Math.max(sum.total, 1);
  const selBar = chartSel != null ? chart.bars.find((b) => b.w === chartSel) : undefined;
  const nowW = cycle.current?.w ?? null;

  return (
    <>
      <header className="screen-head">
        <h1>Plan</h1>
        <p>
          {cycle.total} {pl3(cycle.total, 'nedelja', 'nedelje', 'nedelja')}
          {race ? ` · trka ${fmtDayLong(race).toLowerCase()}` : ''}
        </p>
      </header>
      <div className="cols plan-cols">
        <div className="col col-side">
          {warnings?.length ? (
            <div className="pl-warn">
              <div className="gw-h">Na šta da paziš u ovom planu</div>
              {warnings.map((t) => (
                <div className="gw" key={t}>
                  <p>{t}</p>
                </div>
              ))}
            </div>
          ) : null}

          <section className="card" aria-labelledby="pl-sum-h">
            <h2 id="pl-sum-h" className="lbl">
              Gde sam u planu
            </h2>
            <div className="stats">
              <div className="stat">
                <b className="stat-v num" style={{ color: TONE[holdTone] }}>
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
            <div
              className="planbar"
              role="img"
              aria-label={`Ostvareno ${kmFmt(sum.run)} od ${kmFmt(sum.total)} km; do danas planirano ${kmFmt(sum.untilToday)} km`}
            >
              <i className="ghost" style={{ width: `${(sum.untilToday / total) * 100}%` }} />
              <i
                className="run"
                style={{ width: `${(sum.run / total) * 100}%`, background: TONE[holdTone] }}
              />
            </div>
            <div className="planbar-l">
              <span>ostvareno</span>
              <span>planirano do danas</span>
              <span className="num">{fmtKm(sum.total)} km</span>
            </div>
            <dl className="facts4">
              <div>
                <dt>km nedeljno</dt>
                <dd className="num">{sum.average != null ? fmtKm(sum.average) : '—'}</dd>
              </div>
              <div>
                <dt>
                  {sum.strongestKm > 0 ? `najjača · N${sum.strongest?.w}` : 'najjača nedelja'}
                </dt>
                <dd className="num">{sum.strongestKm > 0 ? fmtKm(sum.strongestKm) : '—'}</dd>
              </div>
              <div>
                <dt>
                  ostalo · {sum.remainingWeeks}{' '}
                  {pl3(sum.remainingWeeks, 'nedelja', 'nedelje', 'nedelja')}
                </dt>
                <dd className="num">{fmtKm(sum.remaining)}</dd>
              </div>
              <div>
                <dt>trčanja</dt>
                <dd className="num">
                  {sum.runsDone}
                  <span>/{sum.runsTotal}</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="card chart-card" aria-labelledby="pl-ch-h">
            <div className="dhead">
              <h2 id="pl-ch-h" className="lbl">
                Nedeljna kilometraža
              </h2>
              <span className="dhead-x">plan i ostvareno</span>
            </div>
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
            <div className="legend">
              <span>
                <i className="lg-plan" />
                plan
              </span>
              <span>
                <i style={{ background: 'var(--text-2)' }} />
                ostvareno (boja faze)
              </span>
            </div>
          </section>
        </div>

        <div className="col col-main">
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
                        onDay={(id) => openSheet({ kind: 'day', props: { id } })}
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
        </div>
      </div>
    </>
  );
}
