import { ProvenanceBadge } from '../../components/ui/Badge';
import { ScreenFrame } from '../../components/ui/Shell';
import { Section } from '../../components/ui/primitives';
import { hmV2FormHistory } from '../../domain/generators/select';
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

/* NAPREDAK → FORMA za plan polumaratona v2 (segment HM-06, kopija obrasca 10K v2 06): VDOT samo iz rezultata
   (čarobnjak, test 5 km na danu testa, unete trke na 5 ili 10 km, polumaratonu ili maratonu) i ocena cilja v2 doslovno.
   Lanac forme iz tempa treninga se u v2 ne koristi, pa ga ovde nema; test 3 km nije rezultat HM v2 (A1). */
export function FormHmV2({ plan }: { plan: GenPlanState }) {
  const log = useTrainingStore((s) => s.log);
  const todayStr = useUIStore((s) => s.today);
  const today = parseIsoDate(todayStr);
  const m = today ? hmV2FormHistory({ plan, today, log }) : null;
  if (!m) return null;
  return (
    <ScreenFrame>
      <header className="screen-head">
        <h1>Forma i predikcija</h1>
        <p>Polumaraton · plan v2</p>
      </header>
      <Section title="Forma plana" id="v2-form" extra={<ProvenanceBadge kind="estimated" />}>
        {m.mode === 'vdot' && m.current !== null ? (
          <p className="prop-m">
            VDOT plana: <b className="num">{fmtNum(m.current, 1)}</b>
            {m.predictedHmSec !== null
              ? ` · procena polumaratona ${fmtClock(Math.round(m.predictedHmSec))}`
              : ''}
          </p>
        ) : (
          <p className="prop-m">
            {m.next
              ? 'Ova nedelja je još po osećaju (RPE).'
              : 'Plan po osećaju: tempo nastaje iz rezultata — istrči test 5 km kad ga plan predvidi (vreme upisuješ na danu testa), pa prilagodi plan.'}
          </p>
        )}
        {m.next ? (
          <p className="note-src" id="v2-form-next">
            Od nedelje {m.next.week} tempo iz rezultata: VDOT {fmtNum(m.next.vdot, 1)}.
          </p>
        ) : null}
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
          Plan polumaratona v2 ne meri formu iz tempa treninga; nov rezultat (test 5 km plana ili
          trka punim naporom na 5 ili 10 km, polumaratonu ili maratonu) menja tempo od sledeće
          nedelje, kroz Plan → Prilagodi plan. Test 3 km se u ovom planu ne koristi.
        </p>
      </Section>
    </ScreenFrame>
  );
}
