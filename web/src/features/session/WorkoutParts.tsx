import { fmtClock, fmtKm } from '../../domain/format';
import { ProvenanceBadge } from '../../components/ui/Badge';
import { Section, Facts } from '../../components/ui/primitives';
import { SessionProfile } from '../../components/ui/SessionProfile';
import { PHASE_LINE, type PhaseKey } from '../cycle/cycle';
import type { SessionView } from './sessionModel';

const minutesText = (m: number): string =>
  m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;

const find = (view: SessionView, label: string) => view.rows?.find((r) => r[0] === label);

/** Ciljevi treninga u jednoj listi: tempo (sa poreklom), distanca, trajanje, napor. Prikazuje se samo ono što postoji. */
export function WorkoutFacts({ view }: { view: SessionView }) {
  const items: Array<{ label: string; value: React.ReactNode }> = [];
  if (view.paceSec != null)
    items.push({
      label: 'Ciljni tempo',
      value: (
        <>
          <span className="num">{fmtClock(view.paceSec)} /km</span>{' '}
          {view.paceOwn ? (
            <span className="badge">Tvoj cilj</span>
          ) : (
            <ProvenanceBadge kind="estimated" />
          )}
        </>
      )
    });
  if (view.km != null)
    items.push({ label: 'Distanca', value: <span className="num">{fmtKm(view.km)} km</span> });
  if (view.minutes != null)
    items.push({
      label: 'Trajanje',
      value: (
        <>
          <span className="num">oko {minutesText(view.minutes)}</span>{' '}
          <ProvenanceBadge kind="estimated" />
        </>
      )
    });
  if (view.rpe)
    items.push({
      label: 'Napor',
      value: (
        <>
          <span className="num">
            RPE {view.rpe.min}–{view.rpe.max}
          </span>
          <small>{view.rpe.txt}</small>
        </>
      )
    });
  if (!items.length) return null;
  return <Facts items={items} />;
}

/** Struktura sesije: zagrevanje / rad / hlađenje srazmerno trajanju, pa profil (visina = brzina) i tabela koraka kad je sesija razlomljena. */
export function WorkoutStructure({ view }: { view: SessionView }) {
  const wu = find(view, 'Zagrevanje');
  const work = find(view, 'Radni deo');
  const rest = find(view, 'Odmor');
  const cd = find(view, 'Hlađenje');
  const seg = view.segments;
  if (!work && !seg && !view.rows) return null;
  const sum = (kinds: string[]): number =>
    seg ? seg.filter((s) => kinds.includes(s.kind)).reduce((a, s) => a + s.sec, 0) : 0;
  const wWu = sum(['wu', 'steady']);
  const wWork = sum(['rep', 'rec']);
  const wCd = sum(['cd']);
  const flex = seg && wWu + wWork + wCd > 0 ? [wWu, wWork, wCd] : [1, 1.2, 1];
  const [workMain, workPace] = work ? work[1].split(' @ ') : ['', ''];
  return (
    <Section title="Struktura" extra={view.rows ? `${view.rows.length} koraka` : undefined}>
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
        <SessionProfile
          segments={seg}
          label={`Profil treninga: ${view.core || view.title}`}
          height={56}
        />
      ) : null}
      {view.rows && !work ? (
        <dl className="facts">
          {view.rows.map(([k, v]) => (
            <div key={k + v}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {view.note ? <p className="note-src">{view.note}</p> : null}
    </Section>
  );
}

/** „Zašto ovaj trening“: jedna rečenica o svrsi treninga i jedna o svrsi faze. */
export function WorkoutWhy({
  view,
  phase,
  weekFocus
}: {
  view: SessionView;
  phase: PhaseKey | null;
  weekFocus: string;
}) {
  if (!view.guide && !phase && !weekFocus) return null;
  return (
    <Section title="Zašto ovaj trening">
      {view.guide ? <p className="why-t">{view.guide}</p> : null}
      {phase ? (
        <p className="note-src">
          Faza <b>{phase}</b>: {PHASE_LINE[phase]}
          {weekFocus ? ` Fokus nedelje: ${weekFocus}.` : ''}
        </p>
      ) : null}
    </Section>
  );
}
