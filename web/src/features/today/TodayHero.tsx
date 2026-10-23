import { fmtClock, fmtKm } from '../../domain/format';
import type { LogEntry } from '../../domain/state';
import { Icon } from '../../components/ui/icons';
import type { SessionView } from '../session/sessionModel';
import { averagePace, WorkoutLanes } from '../session/WorkoutParts';
import type { DayStatus } from './DayCard';

const minutesText = (m: number): string =>
  m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;

/** Šta je upisano za odrađen dan: „8,6 km · 44:12 · 5:08 /km“. */
export function entrySummary(entry: LogEntry | undefined): string {
  if (!entry) return '';
  const km = typeof entry.km === 'number' && entry.km > 0 ? entry.km : null;
  const sec = typeof entry.sec === 'number' && entry.sec > 0 ? entry.sec : null;
  const parts: string[] = [];
  if (km) parts.push(`${fmtKm(km)} km`);
  if (sec) parts.push(fmtClock(sec));
  if (km && sec) parts.push(`${fmtClock(Math.round(sec / km))} /km`);
  return parts.join(' · ');
}

/** Jedna rečenica o tempu ili naporu, ono što postoji: „5:42 /km · oko 45 min“. Tempo radnog dela se ne prikazuje kao tempo celog treninga: piše „rad …“,
 *  a izostaje kad ga red sa strukturom (`shownCore`) već nosi. */
export function effortLine(view: SessionView, shownCore = ''): string {
  const parts: string[] = [];
  if (view.paceSec != null) {
    const pace = fmtClock(view.paceSec);
    if (!view.workPace) parts.push(`${pace} /km${view.paceOwn ? ' · tvoj cilj' : ''}`);
    else if (!shownCore.includes(pace)) parts.push(`rad ${pace} /km`);
  }
  if (view.paceSec == null && view.rpe) parts.push(`napor ${view.rpe.min}–${view.rpe.max} od 10`);
  if (view.minutes != null) parts.push(`oko ${minutesText(view.minutes)}`);
  const avg = averagePace(view);
  if (avg != null) parts.push(`prosek ≈ ${fmtClock(avg)} /km`);
  return parts.join(' · ');
}

/**
 * TRENING DANAS: jedan veliki broj (kilometri, a bez njih minuti), vrsta treninga, tempo ili napor, struktura (zagrevanje / rad / hlađenje) dok trening
 * predstoji, i JEDNO glavno dugme za detalje. Završetak i preskakanje su tihe radnje ispod — česte su, ali nisu glavna odluka ekrana. Ostalo („zašto“,
 * vreme, analiza) je u Detaljima.
 */
export function TodayHero({
  view,
  status,
  entry,
  weather,
  onStatus,
  onDetails
}: {
  view: SessionView;
  status: DayStatus;
  entry: LogEntry | undefined;
  weather: string | null;
  onStatus: (s: DayStatus) => void;
  onDetails: () => void;
}) {
  const summary = status === 'done' ? entrySummary(entry) : '';
  const hasNumber = view.km != null || view.minutes != null;
  const showCore = !!(view.rows && view.core && view.core !== view.title);
  const effort = effortLine(view, showCore ? view.core : '');
  return (
    <section className="today" id="tcard" data-status={status} aria-labelledby="focus-title">
      {hasNumber ? (
        <div className="hero" aria-hidden="true">
          <span className="hero-v num">{view.km != null ? fmtKm(view.km) : view.minutes}</span>
          <span className="hero-u">{view.km != null ? 'km' : 'min'}</span>
        </div>
      ) : (
        <div className="hero" aria-hidden="true">
          <span className="hero-v word">{view.title}</span>
        </div>
      )}
      <h2 id="focus-title" className="today-title">
        {view.title}
        {hasNumber ? (
          <span className="sr-only">
            , {view.km != null ? `${fmtKm(view.km)} kilometara` : `${view.minutes} minuta`}
          </span>
        ) : null}
      </h2>
      {showCore ? <p className="today-core">{view.core}</p> : null}
      {effort ? <p className="today-sub">{effort}</p> : null}
      {status === 'pending' ? <WorkoutLanes view={view} compact /> : null}
      {weather && status === 'pending' ? <p className="today-sub">{weather}</p> : null}

      {status === 'done' ? (
        <p className="done-line">
          <Icon name="check" size={20} strokeWidth={2.4} />
          <span>
            Odrađeno{summary ? ` · ${summary}` : ''}
            {view.hasAlt ? ' · izmenjen trening' : ''}
          </span>
        </p>
      ) : null}
      {status === 'skip' ? (
        <p className="done-line skip">
          <Icon name="skip" size={18} />
          <span>Preskočeno</span>
        </p>
      ) : null}

      <button type="button" className="btn block today-cta" onClick={onDetails}>
        Detalji treninga
        <Icon name="chevron" size={20} />
      </button>

      {status === 'pending' ? (
        <div className="today-acts">
          <button type="button" className="btn quiet" onClick={() => onStatus('done')}>
            Završi trening
          </button>
          <button type="button" className="btn quiet" onClick={() => onStatus('skip')}>
            Preskoči
          </button>
        </div>
      ) : status === 'skip' ? (
        <div className="today-acts">
          <button type="button" className="btn quiet" onClick={() => onStatus('done')}>
            Ipak sam odradio
          </button>
          <button type="button" className="btn quiet" onClick={() => onStatus('pending')}>
            Vrati
          </button>
        </div>
      ) : null}
    </section>
  );
}
