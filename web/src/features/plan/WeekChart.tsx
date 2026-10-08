import { fmtKm } from '../../domain/format';
import type { WeekChart as WeekChartData } from '../../domain/day';
import { PHASE_COLOR, type PhaseKey } from '../cycle/cycle';

const W = 340;
const H = 178;
const L = 26;
const B = 128;
const T = 8;

/* GRAFIKON „plan vs. ostvareno": stub je PLANIRANI km (kontura), unutra je OSTVARENO (puna boja faze) — čita se kao napredak u kupi. Ispod stubova traka
   boja faza (sa nazivom tamo gde faza ima bar dve nedelje). Tekuća nedelja je uokvirena. Pogodak na nedelju je ceo stub; isto što i lista nedelja ispod,
   koja je dodirna meta od 44 px. Dodir ponovo na istu nedelju poništava izbor. */
export function WeekChart({
  chart,
  selected,
  onSelect,
  phases,
  current
}: {
  chart: WeekChartData;
  selected: number | null;
  onSelect: (w: number | null) => void;
  phases: ReadonlyMap<number, PhaseKey>;
  current: number | null;
}) {
  const n = Math.max(chart.bars.length, 1);
  const gw = (W - L - 6) / n;
  const bw = gw - 4;
  const Y = (v: number): number => B - (v / chart.max) * (B - T);
  const runs: Array<{ key: PhaseKey; from: number; len: number }> = [];
  chart.bars.forEach((b, i) => {
    const p = phases.get(b.w);
    if (!p) return;
    const last = runs[runs.length - 1];
    if (last && last.key === p) last.len += 1;
    else runs.push({ key: p, from: i, len: 1 });
  });
  return (
    <svg
      className="chart wk-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label="Nedeljna kilometraža: plan i ostvareno"
    >
      {chart.ticks.map((v) => (
        <g key={v}>
          <line className="gl" x1={L} y1={Y(v)} x2={W - 2} y2={Y(v)} />
          <text className="ax" x={L - 5} y={Y(v) + 3.5} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {chart.bars.map((b, i) => {
        const x = L + i * gw + 2;
        const phase = phases.get(b.w);
        const color = phase ? PHASE_COLOR[phase] : 'var(--text-2)';
        const ph = (b.planKm / chart.max) * (B - T);
        const rh = (b.realKm / chart.max) * (B - T);
        const isSel = selected === b.w;
        const isNow = current === b.w;
        return (
          <g key={b.w}>
            <rect
              className={`wk-plan${isSel ? ' sel' : ''}${isNow ? ' now' : ''}`}
              x={x}
              y={B - ph}
              width={bw}
              height={Math.max(ph, 1)}
              rx={2}
            />
            {rh > 0 ? (
              <rect
                className="wk-real"
                style={{ fill: color }}
                x={x}
                y={B - rh}
                width={bw}
                height={Math.max(rh, 1)}
                rx={2}
              />
            ) : null}
            <text
              className={`ax wk-n${isNow ? ' now' : ''}`}
              x={x + bw / 2}
              y={B + 14}
              textAnchor="middle"
            >
              {b.w}
            </text>
            <rect
              className="wk-hit"
              x={x - 2}
              y={T}
              width={gw}
              height={B - T + 18}
              data-wk={b.w}
              role="button"
              tabIndex={0}
              aria-label={`Nedelja ${b.w}: plan ${fmtKm(b.planKm)} km, urađeno ${fmtKm(b.realKm)} km`}
              aria-pressed={isSel}
              onClick={() => onSelect(isSel ? null : b.w)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(isSel ? null : b.w);
                }
              }}
            />
          </g>
        );
      })}
      {runs.map((r) => (
        <g key={`${r.key}-${r.from}`}>
          <rect
            className="wk-phase"
            x={L + r.from * gw + 2}
            y={B + 22}
            width={r.len * gw - 4}
            height={5}
            rx={2}
            style={{ fill: PHASE_COLOR[r.key] }}
          />
          {r.len >= 2 ? (
            <text
              className="ax wk-pl"
              x={L + r.from * gw + 2}
              y={B + 42}
              style={{ fill: PHASE_COLOR[r.key] }}
            >
              {r.key}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
