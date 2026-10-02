import { fmtClock, fmtKm } from '../../domain/format';
import { ProvenanceBadge } from '../../components/ui/Badge';
import { SessionProfile } from '../../components/ui/SessionProfile';
import { PHASE_COLOR, PHASE_LINE, type PhaseKey } from '../cycle/cycle';
import type { SessionView } from './sessionModel';

const minutesText = (m: number): string =>
  m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;

const find = (view: SessionView, label: string) => view.rows?.find((r) => r[0] === label);

/* TRENING U JEDNOM POGLEDU (list dana): PRE / RAD / POSLE srazmerno trajanju, ispod profil, pa vrednosti i „zašto". Dvanaest informacija iz
   zadatka je ovde slojevito: prvo šta i koliko (lanci), pa ciljevi (tabela), pa razlog (rečenica). Ništa se ne računa novo osim procene trajanja. */
export function WorkoutBrief({
  view,
  phase,
  weekFocus
}: {
  view: SessionView;
  phase: PhaseKey | null;
  weekFocus: string;
}) {
  const wu = find(view, 'Zagrevanje');
  const work = find(view, 'Radni deo');
  const rest = find(view, 'Odmor');
  const cd = find(view, 'Hlađenje');
  const seg = view.segments;
  const sum = (kinds: string[]): number =>
    seg ? seg.filter((s) => kinds.includes(s.kind)).reduce((a, s) => a + s.sec, 0) : 0;
  const wWu = sum(['wu', 'steady']);
  const wWork = sum(['rep', 'rec']);
  const wCd = sum(['cd']);
  const flex = seg && wWu + wWork + wCd > 0 ? [wWu, wWork, wCd] : [1, 1.2, 1];
  const [workMain, workPace] = work ? work[1].split(' @ ') : ['', ''];
  return (
    <>
      {view.paceSec != null ? (
        <div className="brief-pace">
          <div>
            <span className="eyebrow">Ciljni tempo</span>
            <b className="pace-v num">
              <span>{fmtClock(view.paceSec)}</span>
              <small>/km</small>
            </b>
          </div>
          {view.paceOwn ? (
            <span className="badge">Tvoj cilj</span>
          ) : (
            <ProvenanceBadge kind="estimated" />
          )}
        </div>
      ) : null}

      {work ? (
        <div className="lanes" role="group" aria-label="Struktura treninga">
          <div className="lane" style={{ flex: flex[0] }}>
            <span className="eyebrow">Pre</span>
            <b className="num">{wu?.[1] ?? '—'}</b>
            <span>zagrevanje</span>
          </div>
          <div className="lane work" style={{ flex: flex[1] }}>
            <span className="eyebrow">Rad</span>
            <b className="num">{workMain}</b>
            {workPace ? <span className="num">{workPace}</span> : null}
            {rest ? <span>odmor {rest[1]}</span> : null}
          </div>
          <div className="lane" style={{ flex: flex[2] }}>
            <span className="eyebrow">Posle</span>
            <b className="num">{cd?.[1] ?? '—'}</b>
            <span>hlađenje</span>
          </div>
        </div>
      ) : null}
      {seg ? (
        <SessionProfile segments={seg} label={`Profil treninga: ${view.core}`} height={56} />
      ) : null}

      <dl className="params">
        {view.km != null ? (
          <div>
            <dt>Distanca</dt>
            <dd className="num">{fmtKm(view.km)} km</dd>
          </div>
        ) : null}
        {view.minutes != null ? (
          <div>
            <dt>Trajanje</dt>
            <dd className="num">
              ≈ {minutesText(view.minutes)} <ProvenanceBadge kind="estimated" />
            </dd>
          </div>
        ) : null}
        {view.rpe ? (
          <div>
            <dt>Napor</dt>
            <dd className="num">
              RPE {view.rpe.min}–{view.rpe.max}
              <small>{view.rpe.txt}</small>
            </dd>
          </div>
        ) : null}
        {view.note ? (
          <div>
            <dt>Napomena</dt>
            <dd>{view.note}</dd>
          </div>
        ) : null}
      </dl>

      {view.guide || phase || weekFocus ? (
        <div className="why">
          <h3>Zašto ovaj trening</h3>
          {view.guide ? <p>{view.guide}</p> : null}
          {phase ? (
            <p className="note-src">
              Faza <b style={{ color: PHASE_COLOR[phase] }}>{phase}</b>: {PHASE_LINE[phase]}
              {weekFocus ? ` Fokus nedelje: ${weekFocus}.` : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
