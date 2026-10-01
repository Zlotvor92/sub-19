import { useMemo, useState } from 'react';
import { addDays, parseIsoDate } from '../../domain/date';
import {
  planPhases,
  planSummary,
  weekChart,
  weekPlanKm,
  weekRealKm,
  weekRunCount,
  weekRunDone,
  weekTone,
  type RingTone
} from '../../domain/day';
import { fmtKm, pl3 } from '../../domain/format';
import { weekOf } from '../../domain/plan';
import { useResolvedPlan, useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';
import { Ring } from './Ring';
import { WeekBody } from './WeekBody';
import { WeekChart } from './WeekChart';

const TONE: Record<RingTone, string> = {
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  cyan: 'var(--cyan)',
  faint: 'rgba(238,240,255,.22)'
};

const DayCardTitle = ({ title, extra }: { title: string; extra?: string }) => (
  <div className="dhead">
    <span className="card-t">{title}</span>
    {extra ? <span className="dhead-x">{extra}</span> : null}
  </div>
);

export default function PlanPage() {
  const plan = useResolvedPlan();
  const log = useTrainingStore((s) => s.log);
  const alts = useTrainingStore((s) => s.alts);
  const warnings = useTrainingStore((s) => s.genPlan?.meta?.dayWarnings);
  const todayStr = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const [chartSel, setChartSel] = useState<number | null>(null);
  const today = parseIsoDate(todayStr);

  const view = useMemo(() => {
    if (!plan || !today) return null;
    return {
      sum: planSummary(plan, log, today),
      chart: weekChart(plan, log),
      phases: planPhases(plan),
      current: weekOf(plan, today)
    };
  }, [plan, log, today]);
  if (!plan || !today || !view) return null;
  const { sum, chart, phases, current } = view;
  const toggle = (w: number): void =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (!next.delete(w)) next.add(w);
      return next;
    });
  const holdTone: RingTone =
    sum.keepingPlanPct >= 95 ? 'green' : sum.keepingPlanPct >= 80 ? 'amber' : 'red';

  return (
    <>
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

      <div className="card pl-sum">
        <div className="pl-rings">
          <div className="pl-ring">
            <Ring
              share={sum.untilToday ? sum.run / sum.untilToday : 0}
              text={`${sum.keepingPlanPct}%`}
              size={104}
              color={TONE[holdTone]}
            />
            <b>
              {fmtKm(sum.run)} <span>/ {fmtKm(sum.untilToday)} km</span>
            </b>
            <span className="pl-lbl">od plana do sada</span>
          </div>
          <div className="pl-ring">
            <Ring
              share={sum.total ? sum.run / sum.total : 0}
              text={`${sum.wholePlanPct}%`}
              size={104}
              color="var(--cyan)"
            />
            <b>
              {fmtKm(sum.run)} <span>/ {fmtKm(sum.total)} km</span>
            </b>
            <span className="pl-lbl">ceo plan</span>
          </div>
        </div>
        <div className="pl-facts">
          <div>
            <b>{sum.average != null ? fmtKm(sum.average) : '—'}</b>
            <span>km nedeljno</span>
          </div>
          <div>
            <b>{sum.strongestKm > 0 ? fmtKm(sum.strongestKm) : '—'}</b>
            <span>
              {sum.strongestKm > 0 ? `najjača · N${sum.strongest?.w}` : 'najjača nedelja'}
            </span>
          </div>
          <div>
            <b>{fmtKm(sum.remaining)}</b>
            <span>
              ostalo · {sum.remainingWeeks}{' '}
              {pl3(sum.remainingWeeks, 'nedelja', 'nedelje', 'nedelja')}
            </span>
          </div>
          <div>
            <b>
              {sum.runsDone}
              <span>/{sum.runsTotal}</span>
            </b>
            <span>trčanja</span>
          </div>
        </div>
      </div>

      <div className="card">
        <DayCardTitle title="Nedeljna kilometraža" extra="plan vs. realizovano" />
        <WeekChart chart={chart} selected={chartSel} onSelect={setChartSel} />
      </div>

      {phases.map((g) => {
        const km = g.weeks.reduce((s, w) => s + weekRealKm(w, log), 0);
        const pk = g.weeks.reduce((s, w) => s + weekPlanKm(w), 0);
        const rows: (typeof g.weeks)[] = [];
        for (let i = 0; i < g.weeks.length; i += 4) rows.push(g.weeks.slice(i, i + 4));
        return (
          <div key={`${g.name}-${g.weeks[0]?.w}`}>
            <div className="pl-faza">
              <b>{g.name}</b>
              <i />
              <span className="pl-fkm">
                N{g.weeks[0]?.w}–N{g.weeks[g.weeks.length - 1]?.w} · {fmtKm(km)}/{fmtKm(pk)} km
              </span>
            </div>
            {rows.map((row) => (
              <div key={row[0]?.w}>
                <div className="pl-grid">
                  {row.map((w) => {
                    const pkw = weekPlanKm(w);
                    const rkw = weekRealKm(w, log);
                    const isCur = current?.w === w.w;
                    const past = addDays(w.start, 6) < today;
                    const share = pkw ? rkw / pkw : 0;
                    return (
                      <button
                        type="button"
                        key={w.w}
                        className={`pl-w${isCur ? ' now' : ''}${past && rkw === 0 ? ' prazna' : ''}${open.has(w.w) ? ' on' : ''}`}
                        aria-expanded={open.has(w.w)}
                        aria-label={`Nedelja ${w.w}`}
                        onClick={() => toggle(w.w)}
                      >
                        <Ring
                          share={share}
                          text={String(w.w)}
                          size={58}
                          color={TONE[weekTone(share, rkw, isCur)]}
                        />
                        <b>
                          {rkw > 0 ? fmtKm(rkw) : '—'}
                          <span>/{fmtKm(pkw)}</span>
                        </b>
                        <span className="pl-t">
                          {weekRunDone(w, log)}/{weekRunCount(w, log)} trč.
                        </span>
                      </button>
                    );
                  })}
                </div>
                {row
                  .filter((w) => open.has(w.w))
                  .map((w) => (
                    <WeekBody
                      key={w.w}
                      week={w}
                      totalWeeks={plan.weeks.length}
                      current={current?.w === w.w}
                      log={log}
                      alts={alts}
                      onDay={(id) => openSheet({ kind: 'day', props: { id } })}
                      onSwap={(wn) => openSheet({ kind: 'swap', props: { w: wn } })}
                    />
                  ))}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
