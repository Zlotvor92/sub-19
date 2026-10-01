import { fmtClock, fmtDayMonth, fmtNum } from '../../domain/format';
import type { PaceChartModel, PredictionChartModel, VdotTrendModel } from '../../domain/race';

const hint = (x: number) => (
  <text className="chart-hint" x={x} y={14} textAnchor="start">
    Dodirni tačku za detalje
  </text>
);
const info = (x: number, text: string) => (
  <text className="chart-info" x={x} y={14} textAnchor="start">
    {text}
  </text>
);

function Hit({
  x,
  y,
  label,
  onClick
}: {
  x: number;
  y: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <circle
      cx={x.toFixed(1)}
      cy={y.toFixed(1)}
      r={11}
      fill="transparent"
      role="button"
      aria-label={label}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    />
  );
}

const poly = (pts: ReadonlyArray<{ x: number; y: number }>): string =>
  pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

function Gradient({
  id,
  color,
  stops
}: {
  id: string;
  color: string;
  stops: Array<[string, number]>;
}) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        {stops.map(([o, a]) => (
          <stop key={o} offset={o} stopColor={color} stopOpacity={a} />
        ))}
      </linearGradient>
    </defs>
  );
}

export function VdotTrendChart({
  model,
  goal,
  selected,
  onSelect
}: {
  model: VdotTrendModel;
  goal: number;
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const { items, left: L, right: R, bottom: B, width: W, height: H } = model;
  const sel = selected != null ? items[selected] : undefined;
  const first = items[0];
  const last = items[items.length - 1];
  const line = poly(items);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {sel
        ? info(
            L,
            `${sel.rec.ts ? fmtDayMonth(String(sel.rec.ts).slice(0, 10)) : ''} · VDOT ${fmtNum(sel.rec.vdot, 1)}${sel.rec.delta != null ? ` (${sel.rec.delta > 0 ? '+' : ''}${fmtNum(sel.rec.delta, 1)})` : ''}${sel.rec.measured != null ? ` · izmereno ${fmtNum(sel.rec.measured, 1)}` : ''}`
          )
        : hint(L)}
      <line
        x1={L}
        y1={model.goalY.toFixed(1)}
        x2={W - R}
        y2={model.goalY.toFixed(1)}
        stroke="var(--cyan)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
      />
      <text
        x={W - R}
        y={(model.goalY - 4).toFixed(1)}
        textAnchor="end"
        fontSize="9"
        fontWeight="700"
        fill="var(--cyan)"
      >
        cilj {fmtNum(goal, 1)}
      </text>
      <line
        x1={L}
        y1={model.baseY.toFixed(1)}
        x2={W - R}
        y2={model.baseY.toFixed(1)}
        stroke="var(--txt3)"
        strokeWidth="1"
        strokeDasharray="2 3"
        opacity="0.5"
      />
      <Gradient
        id="vdotGrad"
        color="var(--pink)"
        stops={[
          ['0%', 0.38],
          ['55%', 0.08],
          ['100%', 0]
        ]}
      />
      {first && last ? (
        <polygon
          points={`${first.x.toFixed(1)},${B} ${line} ${last.x.toFixed(1)},${B}`}
          fill="url(#vdotGrad)"
        />
      ) : null}
      <polyline
        className="ln"
        points={line}
        fill="none"
        stroke="var(--pink)"
        strokeWidth="2.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {items.map((p, i) => {
        const isLast = i === items.length - 1;
        const isSel = selected === i;
        return (
          <g key={`${String(p.rec.id)}-${i}`}>
            <circle
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r={isSel ? 5 : isLast ? 4.4 : 3.2}
              fill={isLast && !isSel ? 'var(--bg)' : 'var(--pink)'}
              stroke={isSel ? '#fff' : isLast ? 'var(--pink)' : 'none'}
              strokeWidth={isSel ? 1 : 2}
            />
            <Hit
              x={p.x}
              y={p.y}
              label={`VDOT ${fmtNum(p.rec.vdot, 1)}`}
              onClick={() => onSelect(isSel ? null : i)}
            />
          </g>
        );
      })}
      {first ? (
        <text
          x={first.x.toFixed(1)}
          y={(first.y - 9).toFixed(1)}
          fontSize="10"
          fontWeight="700"
          fill="var(--txt2)"
        >
          {fmtNum(first.rec.vdot, 1)}
        </text>
      ) : null}
      {last ? (
        <text
          x={last.x.toFixed(1)}
          y={(last.y - 9).toFixed(1)}
          textAnchor="end"
          fontSize="11"
          fontWeight="800"
          fill="var(--pink)"
        >
          {fmtNum(last.rec.vdot, 1)}
        </text>
      ) : null}
    </svg>
  );
}

export function PredictionChart({
  model,
  goalSec,
  describe,
  selected,
  onSelect
}: {
  model: PredictionChartModel;
  goalSec: number | null;
  describe: (index: number) => string | null;
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const { left: L, right: R, bottom: B, width: W, height: H } = model;
  const first = model.entries[0];
  const last = model.entries[model.entries.length - 1];
  const text = selected != null ? describe(selected) : null;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      {text ? info(L, text) : hint(L)}
      {model.ticks.map((t) => (
        <g key={t.minutes}>
          <line className="gl" x1={L} y1={t.y.toFixed(1)} x2={W - R} y2={t.y.toFixed(1)} />
          <text className="ax" x={L - 4} y={(t.y + 3).toFixed(1)} textAnchor="end">
            {fmtClock(t.minutes * 60)}
          </text>
        </g>
      ))}
      {model.goalY != null ? (
        <line
          x1={L}
          y1={model.goalY.toFixed(1)}
          x2={W - R}
          y2={model.goalY.toFixed(1)}
          stroke="var(--cyan)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
      ) : null}
      <polyline
        fill="none"
        stroke="rgba(255,255,255,.25)"
        strokeWidth="1.5"
        points={poly(model.planLine)}
      />
      {model.entries.length > 1 && first && last ? (
        <>
          <Gradient
            id="predGrad"
            color="var(--pink)"
            stops={[
              ['0%', 0.38],
              ['55%', 0.08],
              ['100%', 0]
            ]}
          />
          <polygon
            points={`${first.x.toFixed(1)},${B} ${poly(model.entries)} ${last.x.toFixed(1)},${B}`}
            fill="url(#predGrad)"
          />
          <polyline
            fill="none"
            stroke="var(--pink)"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={poly(model.entries)}
          />
        </>
      ) : null}
      {model.entries.map((e, idx) => {
        const isLast = idx === model.entries.length - 1;
        const isSel = selected === e.index;
        return (
          <g key={e.index}>
            <circle
              cx={e.x.toFixed(1)}
              cy={e.y.toFixed(1)}
              r={isSel ? 5 : isLast ? 4.4 : 3.2}
              fill={isLast && !isSel ? 'var(--bg)' : 'var(--pink)'}
              stroke={isSel ? '#fff' : isLast ? 'var(--pink)' : 'none'}
              strokeWidth={isSel ? 1 : 2}
            />
            <Hit
              x={e.x}
              y={e.y}
              label={`Predikcija ${fmtClock(e.pred)}`}
              onClick={() => onSelect(isSel ? null : e.index)}
            />
          </g>
        );
      })}
      {model.tests.map((t) => {
        const r = 4.6;
        return (
          <path
            key={`${t.x}-${t.y}`}
            d={`M${t.x.toFixed(1)},${(t.y - r).toFixed(1)} L${(t.x + r).toFixed(1)},${t.y.toFixed(1)} L${t.x.toFixed(1)},${(t.y + r).toFixed(1)} L${(t.x - r).toFixed(1)},${t.y.toFixed(1)} Z`}
            fill="var(--cyan)"
            stroke="var(--bg)"
            strokeWidth="1"
          />
        );
      })}
      {model.goalY != null && goalSec != null ? (
        <text
          className="ax"
          x={W - R}
          y={(model.goalY - 5).toFixed(1)}
          textAnchor="end"
          fill="var(--cyan)"
        >
          cilj {fmtClock(goalSec)}
        </text>
      ) : null}
    </svg>
  );
}

export function PaceChart({
  model,
  selected,
  onSelect
}: {
  model: PaceChartModel;
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const { items, left: L, right: R, bottom: B, width: W, height: H } = model;
  const sel = selected != null ? items[selected] : undefined;
  const first = items[0];
  const last = items[items.length - 1];
  const line = poly(items);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      {sel
        ? info(
            L,
            `${sel.run.date ? fmtDayMonth(sel.run.date) : ''} · ${sel.run.kind ? `${sel.run.kind} · ` : ''}${fmtClock(sel.run.t)}/km · ${fmtNum(sel.run.km, 1)} km · ${fmtClock(sel.run.sec)}`
          )
        : hint(L)}
      {model.ticks.map((t) => (
        <g key={t.sec}>
          <line className="gl" x1={L} y1={t.y.toFixed(1)} x2={W - R} y2={t.y.toFixed(1)} />
          <text className="ax" x={L - 4} y={(t.y + 3).toFixed(1)} textAnchor="end">
            {fmtClock(t.sec)}
          </text>
        </g>
      ))}
      {items.length > 1 && first && last ? (
        <>
          <Gradient
            id="tempoGrad"
            color="var(--cyan)"
            stops={[
              ['0%', 0.3],
              ['100%', 0]
            ]}
          />
          <polygon
            points={`${first.x.toFixed(1)},${B} ${line} ${last.x.toFixed(1)},${B}`}
            fill="url(#tempoGrad)"
          />
          <polyline
            className="ln"
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="2.25"
            strokeLinejoin="round"
            points={line}
          />
        </>
      ) : null}
      {items.map((p, i) => {
        const isLast = i === items.length - 1;
        const isSel = selected === i;
        return (
          <g key={`${p.run.date}-${i}`}>
            <circle
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r={isSel ? 5 : isLast ? 4.2 : 3.2}
              fill={isLast && !isSel ? 'var(--bg)' : 'var(--cyan)'}
              stroke={isSel ? '#fff' : isLast ? 'var(--cyan)' : 'none'}
              strokeWidth={isSel ? 1 : 2}
            />
            <Hit
              x={p.x}
              y={p.y}
              label={`${fmtClock(p.run.t)}/km`}
              onClick={() => onSelect(isSel ? null : i)}
            />
          </g>
        );
      })}
      <text className="ax" x={W - R} y={B + 12} textAnchor="end">
        gore = brže
      </text>
    </svg>
  );
}
