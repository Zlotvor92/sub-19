import type { KeyboardEvent, MouseEvent } from 'react';
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

/** Dodirni cilj preko tačke (r=15 u viewBox-u od 340 je ~30 px prečnika pri širini telefona; susedne tačke se ne preklapaju zbog razmaka među merenjima). */
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
      r={15}
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
  caption,
  selected,
  onSelect,
  describe
}: {
  model: SeriesModel<WellnessRecord>;
  field: 'hrv' | 'pulsUMiru';
  caption: string;
  selected: number | null;
  onSelect: (i: number | null) => void;
  describe: (rec: WellnessRecord, base: number) => string;
}) {
  const { items, base, left: L, right: R, bottom: B, top: T, width: W, height: H } = model;
  const color = 'var(--measured)';
  const sel = selected != null ? items[selected] : undefined;
  const last = items[items.length - 1];
  const first = items[0];
  const text = sel ? describe(sel.rec, model.baseValues[selected as number] as number) : null;
  /* Dnevni nizovi su gusti (do 90 tačaka u ~330 px), pa se tačka bira po najbližem x (dodir) ili strelicama — ne po jednoj meti za svaku. */
  const pick = (e: MouseEvent<SVGSVGElement>): void => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    items.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs((items[best]?.x ?? 0) - x)) best = i;
    });
    onSelect(selected === best ? null : best);
  };
  const key = (e: KeyboardEvent<SVGSVGElement>): void => {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (e.key === 'Escape') onSelect(null);
    if (!step) return;
    e.preventDefault();
    const from = selected ?? (step < 0 ? items.length : -1);
    onSelect(Math.max(0, Math.min(items.length - 1, from + step)));
  };
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="chart series"
      role="slider"
      tabIndex={0}
      aria-label={caption}
      aria-valuemin={1}
      aria-valuemax={items.length}
      aria-valuenow={(selected ?? items.length - 1) + 1}
      aria-valuetext={text ?? 'Nijedan dan nije izabran'}
      onClick={pick}
      onKeyDown={key}
    >
      {text ? info(L, text) : hint(L)}
      <polyline
        points={poly(base)}
        fill="none"
        stroke="var(--text-3)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
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
          </g>
        );
      })}
      {first ? (
        <text x={L} y={B + 16} fontSize="10.5" fontWeight="600" fill="var(--text-3)">
          {fmtDayMonth(first.rec.datum)}
        </text>
      ) : null}
      {last ? (
        <>
          <text
            x={W - R}
            y={B + 16}
            textAnchor="end"
            fontSize="10.5"
            fontWeight="600"
            fill="var(--text-3)"
          >
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
      <text x={L} y={T + 2} fontSize="10.5" fontWeight="600" fill="var(--text-3)">
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
          <polyline
            className="ln"
            fill="none"
            stroke="var(--measured)"
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
              fill="var(--measured)"
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
        stroke="var(--warn)"
        opacity=".6"
        strokeDasharray="3 4"
      />
      <line
        x1={L}
        y1={yOf(6)}
        x2={W - R}
        y2={yOf(6)}
        stroke="var(--bad)"
        opacity=".6"
        strokeDasharray="3 4"
      />
      {items.length > 1 ? (
        <polyline
          className="ln"
          fill="none"
          stroke="var(--text-3)"
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
              fill={pain >= 6 ? 'var(--bad)' : pain >= 1 ? 'var(--warn)' : 'var(--ok)'}
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
