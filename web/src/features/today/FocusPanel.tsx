import { dowShort, fmtClock, fmtDayMonth, fmtKm } from '../../domain/format';
import type { ResolvedDay } from '../../domain/plan';
import type { AltRecord, LogEntry } from '../../domain/state';
import { Disclosure } from '../../components/ui/Disclosure';
import { ProvenanceBadge, StatusBadge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/icons';
import { SessionProfile } from '../../components/ui/SessionProfile';
import { PHASE_COLOR, PHASE_LINE, type PhaseKey } from '../cycle/cycle';
import type { SessionView } from '../session/sessionModel';
import { Description, type DayStatus } from './DayCard';

const STATUS: Record<DayStatus, { label: string; tone: 'none' | 'ok' | 'warn' }> = {
  pending: { label: 'Predstoji', tone: 'none' },
  done: { label: 'Odrađen', tone: 'ok' },
  skip: { label: 'Preskočen', tone: 'warn' }
};

const minutesText = (m: number): string =>
  m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;

/** Kratak opis profila za čitač ekrana. */
const profileLabel = (v: SessionView): string =>
  `Profil treninga: ${v.core || v.title}${v.minutes ? `, oko ${v.minutes} minuta` : ''}`;

/** Šta je upisano za odrađen dan: „8,6 km · 44:12 · 5:08/km". */
function entrySummary(entry: LogEntry | undefined): string {
  if (!entry) return '';
  const parts: string[] = [];
  if (typeof entry.km === 'number' && entry.km > 0) parts.push(`${fmtKm(entry.km)} km`);
  if (typeof entry.sec === 'number' && entry.sec > 0) parts.push(fmtClock(entry.sec));
  if (
    typeof entry.km === 'number' &&
    entry.km > 0 &&
    typeof entry.sec === 'number' &&
    entry.sec > 0
  )
    parts.push(`${fmtClock(Math.round(entry.sec / entry.km))}/km`);
  return parts.join(' · ');
}

/**
 * JEDAN DOMINANTAN BLOK NA EKRANU DANAS: šta je trening, ciljni tempo, koliko traje, koliko napora, profil, jedno primarno dugme.
 * Sve ostalo (struktura, „zašto") je iza progresivnog otkrivanja. Traka sa leve strane je u boji faze.
 */
export function FocusPanel({
  day,
  view,
  status,
  phase,
  entry,
  alt,
  onStatus,
  onDetails
}: {
  day: ResolvedDay;
  view: SessionView;
  status: DayStatus;
  phase: PhaseKey | null;
  entry: LogEntry | undefined;
  alt: AltRecord | undefined;
  onStatus: (s: DayStatus) => void;
  onDetails: () => void;
}) {
  const st = STATUS[status];
  const summary = status === 'done' ? entrySummary(entry) : '';
  const hasHero = view.paceSec != null;
  const showKm = view.km != null;
  return (
    <section
      className="card card--focus focus"
      id="tcard"
      data-status={status}
      aria-labelledby="focus-title"
      style={{ ['--phase' as string]: phase ? PHASE_COLOR[phase] : 'var(--text-2)' }}
    >
      <div className="focus-top">
        <span className="eyebrow">
          N{day.w}
          {day.date
            ? ` · ${dowShort(day.date)} ${fmtDayMonth(day.date)}`
            : ' · opciono, kraj nedelje'}
        </span>
        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
      </div>
      <h2 id="focus-title" className="focus-title">
        {view.title}
      </h2>
      {view.rows ? <p className="focus-core">{view.core}</p> : <Description desc={day.desc} />}

      {hasHero || showKm ? (
        <div className="focus-main">
          {hasHero ? (
            <div className="pace">
              <span className="eyebrow">
                Ciljni tempo{' '}
                {view.paceOwn ? (
                  <span className="badge">Tvoj cilj</span>
                ) : (
                  <ProvenanceBadge kind="estimated" />
                )}
              </span>
              <b className="pace-v num">
                <span>{fmtClock(view.paceSec)}</span>
                <small>/km</small>
              </b>
            </div>
          ) : null}
          <dl className="facts">
            {showKm ? (
              <div>
                <dt>Distanca</dt>
                <dd className="num">{fmtKm(view.km)} km</dd>
              </div>
            ) : null}
            {view.minutes != null ? (
              <div>
                <dt>Trajanje</dt>
                <dd className="num">≈ {minutesText(view.minutes)}</dd>
              </div>
            ) : null}
            {view.rpe ? (
              <div>
                <dt>Napor</dt>
                <dd className="num">
                  RPE {view.rpe.min}–{view.rpe.max}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {view.segments ? (
        <SessionProfile segments={view.segments} label={profileLabel(view)} />
      ) : null}

      {view.rows ? (
        <Disclosure title="Struktura" meta={`${view.rows.length} koraka`}>
          <div className="sess-struct">
            {view.rows.map(([k, v, hl]) => (
              <div className="sess-row" key={k + v}>
                <span className="k">{k}</span>
                <span className={`v${hl ? ' hl' : ''}`}>{v}</span>
              </div>
            ))}
          </div>
          {view.note ? <p className="note-src">{view.note}</p> : null}
        </Disclosure>
      ) : null}
      {view.guide ? (
        <Disclosure title="Zašto ovaj trening">
          <p className="why-t">{view.guide}</p>
          {phase ? (
            <p className="note-src">
              Faza {phase}: {PHASE_LINE[phase]}
            </p>
          ) : null}
        </Disclosure>
      ) : null}

      {status === 'done' ? (
        <p className="done-line">
          <Icon name="check" size={18} strokeWidth={2.6} />
          <span>
            Odrađeno{summary ? ` · ${summary}` : ''}
            {alt ? ' · izmenjen trening' : ''}
          </span>
        </p>
      ) : null}
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
      <button type="button" className="linkrow" onClick={onDetails}>
        <span>Detalji treninga</span>
        <Icon name="chevron" size={18} />
      </button>
    </section>
  );
}
