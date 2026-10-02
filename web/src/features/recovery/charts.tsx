import { fmtDayMonth, fmtDayMonthYear, fmtNum } from '../../domain/format';
import {
  partName,
  type PainModel,
  type SeriesModel,
  type WeightModel
} from '../../domain/recovery';
import type { WellnessRecord } from '../../domain/state';

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

/** Dodirni cilj preko tačke (r=11 je ~44 px na telefonu — preporučeni minimum za dodir). */
function Hit({
  x,
  y,
  onClick,
  label
}: {
  x: number;
  y: number;
  onClick: () => void;
  label: string;
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

/** HRV / puls u miru kroz vreme sa isprekidanom sedmodnevnom osnovom. */
export function SeriesChart({
  model,
  field,
  color,
  caption,
  selected,
  onSelect,
  describe
}: {
  model: SeriesModel<WellnessRecord>;
  field: 'hrv' | 'pulsUMiru';
  color: string;
  caption: string;
  selected: number | null;
  onSelect: (i: number | null) => void;
  describe: (rec: WellnessRecord, base: number) => string;
}) {
  const { items, base, left: L, right: R, bottom: B, top: T, width: W, height: H } = model;
  const sel = selected != null ? items[selected] : undefined;
  const last = items[items.length - 1];
  const first = items[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 10 }}>
      {sel ? info(L, describe(sel.rec, model.baseValues[selected as number] as number)) : hint(L)}
      <polyline
        points={poly(base)}
        fill="none"
        stroke="var(--txt3)"
        strokeWidth="1.4"
        strokeDasharray="4 4"
        opacity=".65"
      />
      <polyline
        className="ln"
        points={poly(items)}
        fill="none"
        stroke={color}
        strokeWidth="2.1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {items.map((p, i) => {
        const isLast = i === items.length - 1;
        const isSel = selected === i;
        return (
          <g key={p.rec.datum}>
            {isLast || isSel ? (
              <circle
                cx={p.x.toFixed(1)}
                cy={p.y.toFixed(1)}
                r={isSel ? 5 : 4.2}
                fill={isSel ? color : 'var(--bg)'}
                stroke={isSel ? '#fff' : color}
                strokeWidth={isSel ? 1 : 2}
              />
            ) : (
              <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={2.6} fill={color} opacity=".75" />
            )}
            <Hit
              x={p.x}
              y={p.y}
              label={`${fmtDayMonth(p.rec.datum)}: ${fmtNum(p.value, field === 'hrv' ? 1 : 0)}`}
              onClick={() => onSelect(isSel ? null : i)}
            />
          </g>
        );
      })}
      {first ? (
        <text x={L} y={B + 16} fontSize="9" fill="var(--txt3)">
          {fmtDayMonth(first.rec.datum)}
        </text>
      ) : null}
      {last ? (
        <>
          <text x={W - R} y={B + 16} textAnchor="end" fontSize="9" fill="var(--txt3)">
            {fmtDayMonth(last.rec.datum)}
          </text>
          <text
            x={W - R}
            y={(last.y - 9).toFixed(1)}
            textAnchor="end"
            fontSize="11"
            fontWeight="800"
            fill={color}
          >
            {fmtNum(last.value, field === 'hrv' ? 1 : 0)}
          </text>
        </>
      ) : null}
      <text x={L} y={T + 2} fontSize="9" fill="var(--txt3)">
        {caption}
      </text>
    </svg>
  );
}

export function WeightChart({
  model,
  selected,
  onSelect
}: {
  model: WeightModel;
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const {
    items,
    ticks,
    dateLabels,
    left: L,
    right: R,
    bottom: B,

    width: W,
    height: H
  } = model;
  const sel = selected != null ? items[selected] : undefined;
  const line = poly(items);
  const first = items[0];
  const lastPt = items[items.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      {sel ? info(L, `${fmtDayMonthYear(sel.rec.date)} · ${fmtNum(sel.rec.kg, 1)} kg`) : hint(L)}
      {ticks.map((t) => (
        <g key={t.value}>
          <line className="gl" x1={L} y1={t.y.toFixed(1)} x2={W - R} y2={t.y.toFixed(1)} />
          <text className="ax" x={L - 4} y={(t.y + 3).toFixed(1)} textAnchor="end">
            {fmtNum(t.value, 1)}
          </text>
        </g>
      ))}
      {dateLabels.map((l, k) => (
        <text
          key={l.date}
          className="ax"
          x={l.x.toFixed(1)}
          y={B + 12}
          textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}
        >
          {fmtDayMonth(l.date)}
        </text>
      ))}
      {items.length > 1 && first && lastPt ? (
        <>
          <defs>
            <linearGradient id="wtGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--pink)" stopOpacity=".32" />
              <stop offset="100%" stopColor="var(--pink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`${first.x.toFixed(1)},${B} ${line} ${lastPt.x.toFixed(1)},${B}`}
            fill="url(#wtGrad)"
          />
          <polyline
            className="ln"
            fill="none"
            stroke="var(--pink)"
            strokeWidth="2.25"
            strokeLinejoin="round"
            points={line}
          />
        </>
      ) : null}
      {items.map((p, i) => {
        const isSel = selected === i;
        return (
          <g key={`${p.rec.date}-${p.rec.kg}-${i}`}>
            <circle
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r={isSel ? 4.8 : 3.4}
              fill="var(--pink)"
              {...(isSel ? { stroke: '#fff', strokeWidth: 1 } : {})}
            />
            <Hit
              x={p.x}
              y={p.y}
              label={`${fmtDayMonth(p.rec.date)}: ${fmtNum(p.rec.kg, 1)} kg`}
              onClick={() => onSelect(isSel ? null : i)}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function PainChart({
  model,
  selected,
  onSelect
}: {
  model: PainModel;
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const { items, yOf, left: L, right: R, bottom: B, width: W, height: H } = model;
  const sel = selected != null ? items[selected] : undefined;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      {sel
        ? info(
            L,
            `${fmtDayMonth(sel.rec.date)} · bol ${sel.rec.pain}/10 · ${partName(sel.rec.part)}${sel.rec.act ? ` · ${sel.rec.act}` : ''}${sel.rec.note ? ` — ${sel.rec.note.slice(0, 32)}` : ''}`
          )
        : hint(L)}
      {[0, 5, 10].map((v) => (
        <g key={v}>
          <line className="gl" x1={L} y1={yOf(v)} x2={W - R} y2={yOf(v)} />
          <text className="ax" x={L - 4} y={yOf(v) + 3} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <line
        x1={L}
        y1={yOf(3)}
        x2={W - R}
        y2={yOf(3)}
        stroke="rgba(255,176,32,.4)"
        strokeDasharray="3 4"
      />
      <line
        x1={L}
        y1={yOf(6)}
        x2={W - R}
        y2={yOf(6)}
        stroke="rgba(255,69,58,.4)"
        strokeDasharray="3 4"
      />
      {items.length > 1 ? (
        <polyline
          className="ln"
          fill="none"
          stroke="rgba(255,255,255,.3)"
          strokeWidth="1.5"
          points={poly(items)}
        />
      ) : null}
      {items.map((p, i) => {
        const isSel = selected === i;
        const pain = p.rec.pain;
        return (
          <g key={p.rec.id ?? `${p.rec.date}-${i}`}>
            <circle
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r={isSel ? 5.2 : 3.6}
              fill={pain >= 6 ? 'var(--red)' : pain >= 1 ? 'var(--amber)' : 'var(--green)'}
              {...(isSel ? { stroke: '#fff', strokeWidth: 1 } : {})}
            />
            <Hit
              x={p.x}
              y={p.y}
              label={`${fmtDayMonth(p.rec.date)}: bol ${pain}/10`}
              onClick={() => onSelect(isSel ? null : i)}
            />
          </g>
        );
      })}
      <text className="ax" x={L} y={B + 12}>
        {fmtDayMonth(model.from)}
      </text>
      <text className="ax" x={W - R} y={B + 12} textAnchor="end">
        {fmtDayMonth(model.to)}
      </text>
    </svg>
  );
}
