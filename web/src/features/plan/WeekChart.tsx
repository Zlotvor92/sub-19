import { fmtKm } from '../../domain/format';
import type { WeekChart as WeekChartData } from '../../domain/day';

const W = 340;
const H = 168;
const L = 26;
const B = 146;
const T = 24;

/* Grafikon „plan vs. realizovano": blede trake su plan, ružičaste urađeno. Nevidljiva puna kolona preko svake nedelje je
   širi, udobniji dodirni cilj od uskog bara. Isti dodir opet poništava izbor. */
export function WeekChart({
  chart,
  selected,
  onSelect
}: {
  chart: WeekChartData;
  selected: number | null;
  onSelect: (w: number | null) => void;
}) {
  const n = Math.max(chart.bars.length, 1);
  const gw = (W - L - 6) / n;
  const sel = selected != null ? chart.bars.find((b) => b.w === selected) : undefined;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      {sel ? (
        <text className="chart-info" x={L} y={14} textAnchor="start">
          N{sel.w} · plan {fmtKm(sel.planKm)} km · urađeno {fmtKm(sel.realKm)} km
        </text>
      ) : (
        <text className="chart-hint" x={L} y={14} textAnchor="start">
          Dodirni nedelju za detalje
        </text>
      )}
      {chart.ticks.map((v) => {
        const y = B - (v / chart.max) * (B - T);
        return (
          <g key={v}>
            <line className="gl" x1={L} y1={y} x2={W - 2} y2={y} />
            <text className="ax" x={L - 4} y={y + 3} textAnchor="end">
              {v}
            </text>
          </g>
        );
      })}
      {chart.bars.map((b, i) => {
        const x = L + i * gw + 2.5;
        const isSel = selected === b.w;
        const ph = (b.planKm / chart.max) * (B - T);
        const rh = (b.realKm / chart.max) * (B - T);
        return (
          <g key={b.w}>
            <rect
              x={x}
              y={B - ph}
              width={gw / 2 - 1.5}
              height={Math.max(ph, 1)}
              rx={2}
              fill={isSel ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.16)'}
            />
            {rh > 0 ? (
              <rect
                x={x + gw / 2 - 0.5}
                y={B - rh}
                width={gw / 2 - 1.5}
                height={Math.max(rh, 1)}
                rx={2}
                fill="var(--pink)"
                {...(isSel ? { stroke: '#fff', strokeWidth: 0.8 } : {})}
              />
            ) : null}
            <text
              className="ax"
              x={x + gw / 2 - 1.5}
              y={B + 12}
              textAnchor="middle"
              {...(isSel ? { fill: 'var(--pink)' } : {})}
            >
              {b.w}
            </text>
            <rect
              x={x - 2.5}
              y={T}
              width={gw - 1}
              height={B - T}
              fill="transparent"
              data-wk={b.w}
              onClick={() => onSelect(isSel ? null : b.w)}
            />
          </g>
        );
      })}
    </svg>
  );
}
