import {
  descriptionLines,
  sessionBreakdown,
  sessionNote,
  weekPlanKm,
  weekRunCount,
  weekRunDone,
  nextTraining
} from '../../domain/day';
import { dowShort, fmtDayMonth, fmtKm } from '../../domain/format';
import {
  dayLabel,
  safeTag,
  sessKind,
  type ResolvedDay,
  type ResolvedPlan
} from '../../domain/plan';
import type { LogEntry } from '../../domain/state';

export type DayStatus = 'pending' | 'done' | 'skip';

const STATUS_LABEL: Record<string, string> = {
  done: 'Odrađen',
  skip: 'Preskočen'
};

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

export function PlanCard({
  day,
  plan,
  log,
  hasAlt,
  onStatus
}: {
  day: ResolvedDay;
  plan: ResolvedPlan;
  log: Readonly<Record<string, LogEntry>>;
  hasAlt: boolean;
  onStatus: (s: DayStatus) => void;
}) {
  const status = (log[day.id]?.status || 'pending') as DayStatus;
  const week = plan.weeks.find((w) => w.w === day.w);
  const rows = sessionBreakdown(day);
  const note = rows ? sessionNote(day) : '';
  const quality = day.tag === 'int' || day.tag === 'tempo';
  return (
    <div className={`card${quality ? ' accent' : ''}`} id="tcard">
      <DayHeader
        title="Plan"
        extra={`N${day.w}${day.date ? ` · ${dowShort(day.date)} ${fmtDayMonth(day.date)}` : ' · opciono, kraj nedelje'}`}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10
        }}
      >
        <span className={`tag ${safeTag(day.tag)}`}>{dayLabel(day, hasAlt)}</span>
        <span className={`st ${status}`}>{STATUS_LABEL[status] ?? 'Predstoji'}</span>
      </div>
      {rows ? (
        <>
          <div className="sess-struct">
            {rows.map(([k, v, hl]) => (
              <div className="sess-row" key={k + v}>
                <span className="k">{k}</span>
                <span className={`v${hl ? ' hl' : ''}`}>{v}</span>
              </div>
            ))}
          </div>
          {note ? <div className="sess-note">{note}</div> : null}
        </>
      ) : (
        <Description desc={day.desc} />
      )}
      <WeekMeta day={day} week={week} log={log} />
      {status === 'pending' ? (
        <div className="btnrow">
          <button type="button" className="btn" onClick={() => onStatus('done')}>
            Završi trening
          </button>
          <button type="button" className="btn ghost" onClick={() => onStatus('skip')}>
            Preskoči
          </button>
        </div>
      ) : status === 'skip' ? (
        <div className="btnrow">
          <button type="button" className="btn ghost" onClick={() => onStatus('done')}>
            Ipak sam odradio
          </button>
          <button type="button" className="btn ghost sm" onClick={() => onStatus('pending')}>
            Vrati
          </button>
        </div>
      ) : null}
    </div>
  );
}

function WeekMeta({
  day,
  week,
  log
}: {
  day: ResolvedDay;
  week: ResolvedPlan['weeks'][number] | undefined;
  log: Readonly<Record<string, LogEntry>>;
}) {
  if (!week) return null;
  return (
    <div className="meta">
      {day.km != null ? (
        <div>
          <b>{fmtKm(day.km)} km</b>plan
        </div>
      ) : null}
      <div>
        <b>{fmtKm(weekPlanKm(week))} km</b>nedelja N{week.w}
      </div>
      <div>
        <b>
          {weekRunDone(week, log)}/{weekRunCount(week, log)}
        </b>
        trčanja
      </div>
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
