import { descriptionLines, nextTraining } from '../../domain/day';
import { dowShort, fmtDayMonth, fmtKm } from '../../domain/format';
import { sessKind, type ResolvedPlan } from '../../domain/plan';

export type DayStatus = 'pending' | 'done' | 'skip';

export function DayHeader({ title, extra }: { title: string; extra?: string }) {
  return (
    <div className="dhead">
      <span className="card-t">{title}</span>
      {extra ? <span className="dhead-x">{extra}</span> : null}
    </div>
  );
}

export function Description({ desc }: { desc: string | null }) {
  const lines = descriptionLines(desc);
  return (
    <div className="desc">
      {lines.map((ln, i) => (
        <span key={i}>
          {i ? '\n' : ''}
          {ln.text}
          {ln.video ? (
            <>
              {' '}
              <a
                className="yt"
                href={ln.video.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Kako se izvodi: ${ln.video.exercise} (${ln.video.author}, YouTube${ln.video.unverified ? ', neprovereno' : ''})`}
              >
                ▶ video{ln.video.unverified ? ' · neprovereno' : ''}
              </a>
            </>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function NextLine({
  plan,
  from,
  hasAlt
}: {
  plan: ResolvedPlan;
  from: string;
  hasAlt: (id: string) => boolean;
}) {
  const nx = nextTraining(plan, from);
  if (!nx) return null;
  return (
    <div className="note-src">
      Sledeći trening: {dowShort(nx.date)} {fmtDayMonth(nx.date)} — {sessKind(nx, hasAlt(nx.id))}
      {nx.km ? ` · ${fmtKm(nx.km)} km` : ''}
    </div>
  );
}
