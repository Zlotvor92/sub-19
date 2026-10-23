import { ProvenanceBadge } from '../../components/ui/Badge';
import { ScreenFrame } from '../../components/ui/Shell';
import { Section } from '../../components/ui/primitives';
import { fiveKV2FormHistory } from '../../domain/generators/select';
import { parseIsoDate } from '../../domain/date';
import { fmtClock, fmtDayLong, fmtNum } from '../../domain/format';
import type { GenPlanState } from '../../domain/state';
import { useTrainingStore } from '../../stores';
import { useUIStore } from '../../stores/uiStore';

const STATUS: Record<'used' | 'pending' | 'old', string> = {
  used: 'u planu',
  pending: 'čeka prilagođavanje',
  old: 'ne menja tempo'
};

/* NAPREDAK → FORMA za plan 5K v2 (08b): VDOT samo iz rezultata (čarobnjak, test 3 km, unete trke) i ocena cilja v2
   doslovno. Lanac forme iz tempa treninga se u v2 ne koristi, pa ga ovde nema. */
export function FormV2({ plan }: { plan: GenPlanState }) {
  const t3k = useTrainingStore((s) => s.t3k);
  const log = useTrainingStore((s) => s.log);
  const todayStr = useUIStore((s) => s.today);
  const openSheet = useUIStore((s) => s.openSheet);
  const today = parseIsoDate(todayStr);
  const m = today ? fiveKV2FormHistory({ plan, today, tests: t3k, log }) : null;
  if (!m) return null;
  return (
    <ScreenFrame>
      <header className="screen-head">
        <h1>Forma i predikcija</h1>
        <p>5K · plan v2</p>
      </header>
      <Section title="Forma plana" id="v2-form" extra={<ProvenanceBadge kind="estimated" />}>
        {m.mode === 'vdot' && m.current !== null ? (
          <p className="prop-m">
            VDOT plana: <b className="num">{fmtNum(m.current, 1)}</b>
            {m.predicted5kSec !== null
              ? ` · procena 5K ${fmtClock(Math.round(m.predicted5kSec))}`
              : ''}
          </p>
        ) : (
          <p className="prop-m">
            {m.mode === 'runWalk'
              ? 'Plan trčanje/hodanje ne koristi tempo: napredak je nivo sesija (Plan).'
              : 'Plan po osećaju: tempo nastaje iz rezultata — istrči test 3 km kad ga plan predvidi, pa prilagodi plan.'}
          </p>
        )}
        {m.goal ? (
          <p className="note-src" id="v2-form-goal">
            Cilj: {m.goal.label} — {m.goal.message}
          </p>
        ) : null}
      </Section>
      <Section title="VDOT iz rezultata" extra={<ProvenanceBadge kind="measured" />}>
        {m.points.length ? (
          <ul aria-label="Istorija VDOT-a iz rezultata">
            {m.points.map((p) => (
              <li className="note-src" key={`${p.date}-${p.label}`}>
                {fmtDayLong(p.date)} · VDOT {fmtNum(p.vdot, 1)} · {p.label} ({STATUS[p.status]})
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Još nema rezultata. Tempo plana se menja samo iz rezultata.</p>
        )}
        <p className="note-src">
          Plan 5K v2 ne meri formu iz tempa treninga; nov rezultat (test 3 km ili trka punim naporom
          na 3, 5 ili 10 km) menja tempo od sledeće nedelje, kroz Plan → Prilagodi plan.
        </p>
        <div className="btnrow start">
          <button
            type="button"
            className="btn ghost"
            onClick={() => openSheet({ kind: 't3k', props: { id: null } })}
          >
            Unesi test na 3 km
          </button>
        </div>
      </Section>
    </ScreenFrame>
  );
}
