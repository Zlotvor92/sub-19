import { fmtClock } from '../../domain/format';
import { journeyModel, type JourneyKey, type JourneyPoint } from './journey';

const LABEL: Readonly<Record<JourneyKey, string>> = {
  start: 'start',
  now: 'sada · procena',
  goal: 'cilj',
  projection: 'plan vodi do'
};

/** Redosled čitanja (čitač ekrana): put ide od starta preko sadašnjosti do cilja i projekcije, bez obzira na položaj na osi. */
const ORDER: readonly JourneyKey[] = ['start', 'now', 'goal', 'projection'];

/** Jedna osa: gde sam krenuo, gde sam po proceni, gde je cilj i do kuda plan vodi (brže je desno). */
export function Journey({
  start,
  now,
  goal,
  projection
}: {
  start: number | null;
  now: number | null;
  goal: number | null;
  projection: number | null;
}) {
  const pts = journeyModel({ start, now, goal, projection });
  if (!pts.length) return null;
  const by = (k: JourneyKey): JourneyPoint | undefined => pts.find((p) => p.key === k);
  const s = by('start');
  const n = by('now');
  const label = ORDER.map(by)
    .filter((p): p is JourneyPoint => !!p)
    .map((p) => `${LABEL[p.key]} ${fmtClock(p.sec)}`)
    .join(', ');
  return (
    <div className="journey" role="img" aria-label={`Put do cilja: ${label}`}>
      <div className="j-axis" />
      {s && n && n.pos > s.pos ? (
        <div className="j-fill" style={{ left: `${s.pos}%`, width: `${n.pos - s.pos}%` }} />
      ) : null}
      {pts.map((p) => (
        <div
          key={p.key}
          className={`j-pt ${p.key} ${p.side} al-${p.align}`}
          style={{ left: `${p.pos}%` }}
        >
          <i />
          <span>
            <b className="num">{fmtClock(p.sec)}</b>
            {LABEL[p.key]}
          </span>
        </div>
      ))}
    </div>
  );
}
