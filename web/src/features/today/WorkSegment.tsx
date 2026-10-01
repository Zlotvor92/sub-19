import { fmtClock, fmtNum, parseTimeStr } from '../../domain/format';
import { gaugeView, vdotDeltaView } from '../../domain/day';
import type { VdotRecord } from '../../domain/state';
import { DraftInput } from './DraftInput';

const TONE_COLOR = {
  none: 'var(--txt3)',
  faster: 'var(--green)',
  slower: 'var(--pink)',
  same: 'var(--txt2)'
} as const;

export function Gauge({ plan, done }: { plan: number | null; done: number | null }) {
  const g = gaugeView(plan, done);
  const color = TONE_COLOR[g.tone];
  return (
    <>
      <svg viewBox="0 0 104 74" aria-hidden="true">
        <path
          d={g.arc}
          fill="none"
          stroke="rgba(255,255,255,.14)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <line
          x1="52"
          y1="6"
          x2="52"
          y2="18"
          stroke="rgba(255,255,255,.55)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {g.dot ? (
          <circle
            cx={g.dot[0]}
            cy={g.dot[1]}
            r="7"
            fill={color}
            stroke="var(--bg)"
            strokeWidth="3"
          />
        ) : null}
      </svg>
      <span className="wseg-d" style={{ color }}>
        {g.delta == null ? '—' : `${g.delta > 0 ? '+' : ''}${g.delta} s`}
      </span>
    </>
  );
}

export function VdotDelta({ pace, entry }: { pace: number | null; entry: VdotRecord | undefined }) {
  const v = vdotDeltaView(pace, entry);
  if (v.kind === 'enter')
    return <span style={{ color: 'var(--txt3)', fontSize: '.78rem' }}>unesi tempo →</span>;
  if (v.kind === 'none') return <span style={{ color: 'var(--txt3)', fontSize: '.78rem' }}>—</span>;
  const color =
    v.tone === 'up' ? 'var(--green)' : v.tone === 'down' ? 'var(--pink)' : 'var(--txt2)';
  const d = v.delta ?? 0;
  return (
    <span style={{ color, fontWeight: 800, fontSize: '.82rem' }}>
      VDOT {fmtNum(v.vdot, 1)} {v.arrow}{' '}
      <span style={{ fontSize: '.72rem' }}>
        ({d > 0 ? '+' : ''}
        {fmtNum(d, 1)})
      </span>
    </span>
  );
}

const paceText = (raw: string): string => {
  const s = parseTimeStr(raw);
  return s ? fmtClock(s) : '';
};

export interface WorkSegmentProps {
  predId: string;
  label: string;
  q: number;
  planPace: number | null;
  /** Tempo koji je korisnik izabrao kao cilj za taj dan (ručna izmena). */
  ownGoal: boolean;
  pace: number | null;
  vdot: VdotRecord | undefined;
  rejectedAuto: number | null | undefined;
  onPace: (raw: string) => void;
}

export function WorkSegment(p: WorkSegmentProps) {
  return (
    <>
      <div className="wseg" data-wseg={p.predId}>
        <div className="wseg-gauge">
          <Gauge plan={p.planPace} done={p.pace} />
        </div>
        <div className="wseg-info">
          <div className="wseg-l">
            {p.label} · Q {fmtNum(p.q, 1)} km
          </div>
          <div className="wseg-plan">
            plan <b>{fmtClock(p.planPace)} /km</b>
            {p.ownGoal ? <small style={{ color: 'var(--pink)' }}> (tvoj cilj)</small> : null}
          </div>
          <DraftInput
            className="wseg-in"
            inputMode="numeric"
            placeholder="356"
            aria-label="Ostvaren tempo radnog dela"
            value={p.pace ? fmtClock(p.pace) : ''}
            normalize={paceText}
            onCommit={p.onPace}
          />
          <div className="wseg-out">
            <VdotDelta pace={p.pace} entry={p.vdot} />
          </div>
        </div>
      </div>
      {p.pace == null && p.rejectedAuto ? (
        <div className="note-src" style={{ color: 'var(--amber)', marginTop: 6 }}>
          Automatski izmeren tempo ({fmtClock(p.rejectedAuto)} /km) ne odgovara tvojoj formi —
          verovatno su u prosek ušla i kaskanja između deonica. Nije upisan; unesi tempo radnog dela
          ručno.
        </div>
      ) : null}
    </>
  );
}
